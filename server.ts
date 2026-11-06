import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  WatchedMovie,
  MovieRecommendation,
  EveningPreferences,
  TmdbMovieEnrichment,
  buildRecommendationSystemPrompt,
  filterDuplicateRecommendations,
  generateSmartFallbackRecommendations,
  generateSmartFallbackTasteProfile,
  parseTmdbSwedishProviders,
  lookupCuratedTmdbMovie,
  searchCuratedTmdbMovies,
  sortMoviesByStreamingServices,
  filterMoviesByStreamingServices,
  mapTmdbGenreIdsToNames,
  filterAndVerifyMoviesByTmdbCategories,
  normalizeProviderKey,
  movieMatchesStreamingProviders,
  extractTmdbVerificationRules,
  normalizeMovieTitle,
  filterOutDislikedCategories,
  getDislikedGenreIds,
  isMovieMatchingDislikedCategories,
  getSeriesSeasonCount,
  KNOWN_SERIES_SEASON_COUNTS,
} from "./src/utils/movieLogic";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getEffectiveTmdbKey(headerKey?: string): string | null {
  const candidate = (headerKey || process.env.TMDB_API_KEY || "").trim();
  if (!candidate || candidate === "MY_TMDB_API_KEY") {
    return null;
  }
  return candidate;
}

const tmdbEnrichCache = new Map<string, TmdbMovieEnrichment>();

async function fetchFromTmdbApi(
  endpointPath: string,
  tmdbKey: string
): Promise<unknown> {
  const isBearerToken = tmdbKey.length > 45 || tmdbKey.startsWith("eyJ");
  const separator = endpointPath.includes("?") ? "&" : "?";
  const url = isBearerToken
    ? `https://api.themoviedb.org/3${endpointPath}`
    : `https://api.themoviedb.org/3${endpointPath}${separator}api_key=${encodeURIComponent(
        tmdbKey
      )}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (isBearerToken) {
    headers.Authorization = `Bearer ${tmdbKey}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) {
    throw new Error(`TMDB HTTP ${response.status}`);
  }
  return response.json();
}

const TMDB_STREAMING_PROVIDER_MAP: Record<string, number[]> = {
  netflix: [8],
  max: [1899, 1825],
  "disney+": [337],
  "prime video": [119],
  viaplay: [76],
  skyshowtime: [1773],
  "tv4 play": [1944, 383],
  "apple tv+": [350, 2],
  "apple tv": [350, 2],
  "sf anytime": [426],
};

function getTmdbProviderIds(selectedServices: string[]): number[] {
  const ids: number[] = [];
  for (const s of selectedServices) {
    const key = normalizeProviderKey(s);
    const mapped = TMDB_STREAMING_PROVIDER_MAP[key];
    if (mapped) {
      for (const id of mapped) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}

function pickBestTmdbCandidate(
  results: Array<Record<string, unknown>>,
  targetYear?: string
): Record<string, unknown> | undefined {
  if (!results || results.length === 0) return undefined;
  if (!targetYear) return results[0];

  const cleanTarget = targetYear.replace(/[^0-9]/g, "").slice(0, 4);
  if (!cleanTarget) return results[0];

  const targetNum = Number(cleanTarget);
  // 1. Exact release year match
  const exact = results.find((r) => {
    const d = String(r.release_date || r.first_air_date || "").slice(0, 4);
    return d === cleanTarget;
  });
  if (exact) return exact;

  // 2. Near release year match (within 1 year)
  const near = results.find((r) => {
    const d = Number(
      String(r.release_date || r.first_air_date || "").slice(0, 4)
    );
    return d > 1900 && Math.abs(d - targetNum) <= 1;
  });
  if (near) return near;

  // 3. Fallback to candidate with highest popularity
  return [...results].sort((a, b) => {
    const popA = typeof a.popularity === "number" ? a.popularity : 0;
    const popB = typeof b.popularity === "number" ? b.popularity : 0;
    return popB - popA;
  })[0];
}

async function discoverTmdbCandidates(
  preferences: EveningPreferences,
  selectedServices: string[],
  tmdbKey: string,
  limit = 20,
  dislikedCategories: string[] = [],
  previousTitles: string[] = [],
  startPage = 1,
  watchedMovies: WatchedMovie[] = []
): Promise<MovieRecommendation[]> {
  try {
    const hasProviders = selectedServices.length > 0;
    const providerIds = hasProviders ? getTmdbProviderIds(selectedServices) : [];
    if (hasProviders && providerIds.length === 0) return [];

    const typesToQuery: Array<"movie" | "tv"> =
      preferences.mediaType === "tv"
        ? ["tv"]
        : preferences.mediaType === "movie"
        ? ["movie"]
        : ["movie", "tv"];

    const { genreRules, minYear, maxYear } =
      extractTmdbVerificationRules(preferences);

    const previousNorms = new Set(
      (previousTitles || []).map((t) => normalizeMovieTitle(t)).filter(Boolean)
    );

    const dislikedGenreIds: number[] = [];
    for (const cat of dislikedCategories) {
      for (const id of getDislikedGenreIds(cat)) {
        if (!dislikedGenreIds.includes(id)) {
          dislikedGenreIds.push(id);
        }
      }
    }
    const withoutGenreParam =
      dislikedGenreIds.length > 0
        ? `&without_genres=${encodeURIComponent(dislikedGenreIds.join(","))}`
        : "";

    let watchParam = "";
    if (hasProviders) {
      const providerParam = encodeURIComponent(providerIds.join("|"));
      const hasRentBuyOnly = selectedServices.some((s) => {
        const k = normalizeProviderKey(s);
        return k === "sf anytime";
      });
      const monetization = hasRentBuyOnly
        ? "flatrate|rent|buy"
        : "flatrate|free|ads";
      watchParam = `&watch_region=SE&with_watch_providers=${providerParam}&watch_provider_monetization_types=${monetization}`;
    }

    const discovered: MovieRecommendation[] = [];

    const movieGenresValid = [
      28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878,
      10770, 53, 10752, 37,
    ];
    const tvGenresValid = [
      10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765,
      10766, 10767, 10768, 37,
    ];

    const initialPage = Math.max(1, Number(startPage) || 1);

    for (const mediaType of typesToQuery) {
      const validSet = new Set(
        mediaType === "movie" ? movieGenresValid : tvGenresValid
      );

      // Comma-separated genre rule tokens enforce AND-logic across distinct chosen categories
      const ruleTokens: string[] = [];
      for (const rule of genreRules) {
        const matchingIds = rule.allowedGenreIds.filter((gid) =>
          validSet.has(gid)
        );
        if (matchingIds.length > 0) {
          ruleTokens.push(matchingIds.slice(0, 2).join("|"));
        }
      }

      // If no specific evening genres were chosen (e.g. taste profile mode in "För dig"),
      // derive target genres from the user's loved movies (rated >= 4 and liked)
      if (ruleTokens.length === 0 && watchedMovies.length > 0) {
        const loved = watchedMovies.filter(
          (m) => m.rating >= 4 && m.liked !== false
        );
        const sourceMovies = loved.length > 0 ? loved : watchedMovies;
        const genreCounts: Record<number, number> = {};
        for (const m of sourceMovies) {
          for (const gid of m.tmdbGenreIds || []) {
            if (validSet.has(gid) && !dislikedGenreIds.includes(gid)) {
              genreCounts[gid] = (genreCounts[gid] || 0) + 1;
            }
          }
        }
        const topGids = Object.entries(genreCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => Number(id));
        if (topGids.length > 0) {
          ruleTokens.push(topGids.slice(0, 3).join("|"));
        }
      }

      const genreParam =
        ruleTokens.length > 0
          ? `&with_genres=${encodeURIComponent(ruleTokens.join(","))}`
          : "";

      let yearParam = "";
      const currentYear = new Date().getFullYear();
      if (mediaType === "movie") {
        if (minYear) yearParam += `&primary_release_date.gte=${minYear}-01-01`;
        yearParam += `&primary_release_date.lte=${maxYear || currentYear}-12-31`;
      } else {
        if (minYear) yearParam += `&first_air_date.gte=${minYear}-01-01`;
        yearParam += `&first_air_date.lte=${maxYear || currentYear}-12-31`;
      }

      const voteCountMin = hasProviders ? 25 : 100;

      // Query across multiple pages if needed so we never run out of fresh titles
      const maxPagesToFetch = 3;
      for (let p = initialPage; p < initialPage + maxPagesToFetch; p++) {
        if (discovered.length >= limit * 2) break;

        const url = `/discover/${mediaType}?language=sv-SE&sort_by=popularity.desc&vote_count.gte=${voteCountMin}&page=${p}${watchParam}${genreParam}${withoutGenreParam}${yearParam}`;

        let data: { results?: Array<Record<string, unknown>> } | null = null;
        try {
          data = (await fetchFromTmdbApi(url, tmdbKey)) as {
            results?: Array<Record<string, unknown>>;
          };
        } catch {
          continue;
        }

        // If strict combination yielded 0 hits and we had 3+ rules, relax to the first 2 rules
        if (
          (!data?.results || data.results.length === 0) &&
          ruleTokens.length > 2
        ) {
          const relaxedParam = `&with_genres=${encodeURIComponent(
            ruleTokens.slice(0, 2).join(",")
          )}`;
          const fallbackVoteCount = hasProviders ? 15 : 40;
          const fallbackUrl = `/discover/${mediaType}?language=sv-SE&sort_by=popularity.desc&vote_count.gte=${fallbackVoteCount}&page=${p}${watchParam}${relaxedParam}${withoutGenreParam}${yearParam}`;
          try {
            data = (await fetchFromTmdbApi(fallbackUrl, tmdbKey)) as {
              results?: Array<Record<string, unknown>>;
            };
          } catch {
            continue;
          }
        }

        const hits = data?.results || [];
        for (const hit of hits) {
          const title = String(hit.title || hit.name || "").trim();
          const originalTitle = String(
            hit.original_title || hit.original_name || title
          ).trim();

          // Strictly skip titles that were already shown/swiped
          const t1 = normalizeMovieTitle(title);
          const t2 = originalTitle ? normalizeMovieTitle(originalTitle) : "";
          if (
            (t1 && previousNorms.has(t1)) ||
            (t2 && previousNorms.has(t2))
          ) {
            continue;
          }

          const dateStr = String(hit.release_date || hit.first_air_date || "");
          const year = dateStr ? dateStr.slice(0, 4) : "";
          const rawGenreIds = Array.isArray(hit.genre_ids)
            ? hit.genre_ids
                .map(Number)
                .filter((n) => !Number.isNaN(n) && n > 0)
            : [];
          const tmdbGenres = mapTmdbGenreIdsToNames(rawGenreIds);
          const voteAverage =
            typeof hit.vote_average === "number" && hit.vote_average > 0
              ? Math.round(hit.vote_average * 10) / 10
              : 7.8;
          const posterPath = hit.poster_path
            ? String(hit.poster_path)
            : undefined;
          const overview = String(hit.overview || "").trim();

          const motivation =
            overview.length > 30
              ? overview
              : hasProviders
              ? `Topprankad och bekräftad titel på ${selectedServices.join(
                  ", "
                )} i Sverige som matchar dina val och stämningar med högt betyg (${voteAverage}/10).`
              : `Topprankad och hyllad titel som förenar dina valda genrer och kategorier med högt betyg (${voteAverage}/10).`;

          const matchedProviders = hasProviders
            ? selectedServices.map((name) => ({
                provider_id: providerIds[0] || 8,
                provider_name: name,
              }))
            : [];

          discovered.push({
            id: `tmdb-disc-${hit.id}`,
            title,
            originalTitle,
            year: year || "2023",
            mediaType,
            runtime: mediaType === "tv" ? "TV-serie" : "Film",
            matchPercentage: Math.min(
              96,
              Math.max(90, Math.round(86 + (voteAverage || 7.5)))
            ),
            whyYouWillLikeIt: motivation,
            vibeTags: tmdbGenres.slice(0, 3),
            tmdbId: Number(hit.id),
            posterPath,
            tmdbRating: voteAverage,
            tmdbGenreIds: rawGenreIds,
            tmdbGenres,
            swedishProviders: {
              type: hasProviders ? "flatrate" : "none",
              providers: matchedProviders,
            },
          });
        }
      }
    }

    let verifiedDiscovered = filterAndVerifyMoviesByTmdbCategories(
      discovered,
      preferences
    );
    if (dislikedCategories.length > 0) {
      verifiedDiscovered = filterOutDislikedCategories(
        verifiedDiscovered,
        dislikedCategories
      );
    }
    // Final check against previous titles
    verifiedDiscovered = verifiedDiscovered.filter((m) => {
      const t1 = normalizeMovieTitle(m.title);
      const t2 = m.originalTitle ? normalizeMovieTitle(m.originalTitle) : "";
      return !previousNorms.has(t1) && (!t2 || !previousNorms.has(t2));
    });

    return verifiedDiscovered.slice(0, limit);
  } catch {
    return [];
  }
}

async function enrichSingleMovieWithTmdb(
  title: string,
  year?: string,
  tmdbKey?: string | null,
  preferredMediaType?: "movie" | "tv"
): Promise<TmdbMovieEnrichment> {
  const curated = lookupCuratedTmdbMovie(title, year);
  if (!tmdbKey) {
    return curated;
  }

  const cleanYear = year ? year.replace(/[^0-9]/g, "").slice(0, 4) : "";
  const cacheKey = `${preferredMediaType || "any"}:${title.trim().toLowerCase()}:${cleanYear}`;
  const cached = tmdbEnrichCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const typesToTry: Array<"movie" | "tv"> =
      preferredMediaType === "tv"
        ? ["tv", "movie"]
        : preferredMediaType === "movie"
        ? ["movie", "tv"]
        : ["movie", "tv"];

    let topHit: Record<string, unknown> | undefined;
    let resolvedType: "movie" | "tv" = preferredMediaType || "movie";

    for (const type of typesToTry) {
      const yearParam = cleanYear
        ? type === "tv"
          ? `&first_air_date_year=${encodeURIComponent(cleanYear)}`
          : `&year=${encodeURIComponent(cleanYear)}`
        : "";
      const searchData = (await fetchFromTmdbApi(
        `/search/${type}?query=${encodeURIComponent(title)}${yearParam}&language=sv-SE`,
        tmdbKey
      )) as { results?: Array<Record<string, unknown>> };

      let candidate = pickBestTmdbCandidate(searchData?.results || [], cleanYear);
      if (!candidate && yearParam) {
        const retryData = (await fetchFromTmdbApi(
          `/search/${type}?query=${encodeURIComponent(title)}&language=sv-SE`,
          tmdbKey
        )) as { results?: Array<Record<string, unknown>> };
        candidate = pickBestTmdbCandidate(retryData?.results || [], cleanYear);
      }

      if (candidate && candidate.id) {
        topHit = candidate;
        resolvedType = type;
        break;
      }
    }

    if (!topHit || !topHit.id) {
      return curated;
    }

    const tmdbId = Number(topHit.id);
    const releaseDate = String(
      topHit.release_date || topHit.first_air_date || ""
    );
    const hitYear = releaseDate ? releaseDate.slice(0, 4) : year || curated.year;
    const voteAverage =
      typeof topHit.vote_average === "number" && topHit.vote_average > 0
        ? Math.round(topHit.vote_average * 10) / 10
        : curated.voteAverage;
    const posterPath = topHit.poster_path
      ? String(topHit.poster_path)
      : curated.posterPath;

    let swedishProviders = curated.swedishProviders;
    try {
      const providersData = (await fetchFromTmdbApi(
        `/${resolvedType}/${tmdbId}/watch/providers`,
        tmdbKey
      )) as { results?: Record<string, unknown> };
      const seObj = providersData?.results?.SE;
      swedishProviders = parseTmdbSwedishProviders(seObj);
    } catch {
      // Keep curated Swedish providers if watch/providers fails
    }

    const hitTitle = String(topHit.title || topHit.name || title);
    const hitOriginal = String(
      topHit.original_title || topHit.original_name || hitTitle
    );
    const rawGenreIds = Array.isArray(topHit.genre_ids)
      ? topHit.genre_ids.map(Number).filter((n) => !Number.isNaN(n) && n > 0)
      : [];
    const tmdbGenreIds =
      rawGenreIds.length > 0 ? rawGenreIds : curated.tmdbGenreIds;
    const tmdbGenres =
      tmdbGenreIds && tmdbGenreIds.length > 0
        ? mapTmdbGenreIdsToNames(tmdbGenreIds)
        : curated.tmdbGenres;

    let seasonCount = curated.seasonCount;
    if (resolvedType === "tv") {
      seasonCount = getSeriesSeasonCount(hitTitle);
      try {
        const tvDetails = (await fetchFromTmdbApi(
          `/tv/${tmdbId}?language=sv-SE`,
          tmdbKey
        )) as { number_of_seasons?: number };
        if (
          typeof tvDetails?.number_of_seasons === "number" &&
          tvDetails.number_of_seasons > 0
        ) {
          seasonCount = tvDetails.number_of_seasons;
        }
      } catch {
        // Keep seasonCount from getSeriesSeasonCount
      }
    }

    const result: TmdbMovieEnrichment = {
      tmdbId,
      title: hitTitle,
      originalTitle: hitOriginal,
      year: hitYear,
      mediaType: resolvedType,
      posterPath,
      voteAverage,
      swedishProviders,
      tmdbGenreIds,
      tmdbGenres,
      seasonCount,
    };
    if (tmdbEnrichCache.size > 500) {
      const oldestKey = tmdbEnrichCache.keys().next().value;
      if (oldestKey) tmdbEnrichCache.delete(oldestKey);
    }
    tmdbEnrichCache.set(cacheKey, result);
    return result;
  } catch {
    return curated;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Lightweight health check endpoint for keep-alive cron jobs / Render monitors
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).send("OK");
  });

  app.use(express.json({ limit: "2mb" }));

  // TMDB Live Autocomplete Search Endpoint (supports both Movies and TV Series)
  app.get("/api/tmdb/search", async (req, res) => {
    try {
      const query = String(req.query.query || "").trim();
      if (query.length < 2) {
        return res.json({ results: [] });
      }

      const headerKey = req.header("x-tmdb-key");
      const tmdbKey = getEffectiveTmdbKey(headerKey);

      if (tmdbKey) {
        try {
          const searchData = (await fetchFromTmdbApi(
            `/search/multi?query=${encodeURIComponent(query)}&language=sv-SE`,
            tmdbKey
          )) as { results?: Array<Record<string, unknown>> };

          const validHits = (searchData?.results || []).filter(
            (h) => h.media_type === "movie" || h.media_type === "tv"
          );

          if (validHits.length > 0) {
            const results: TmdbMovieEnrichment[] = validHits
              .slice(0, 6)
              .map((hit) => {
                const isTv = hit.media_type === "tv";
                const releaseDate = String(
                  hit.release_date || hit.first_air_date || ""
                );
                const hitTitle = String(hit.title || hit.name || query);
                const hitOrig = String(
                  hit.original_title || hit.original_name || hitTitle
                );
                const curated = lookupCuratedTmdbMovie(hitTitle);
                return {
                  tmdbId: Number(hit.id),
                  title: hitTitle,
                  originalTitle: hitOrig,
                  year: releaseDate ? releaseDate.slice(0, 4) : curated.year,
                  mediaType: isTv ? "tv" : "movie",
                  posterPath: hit.poster_path
                    ? String(hit.poster_path)
                    : curated.posterPath,
                  voteAverage:
                    typeof hit.vote_average === "number" && hit.vote_average > 0
                      ? Math.round(hit.vote_average * 10) / 10
                      : curated.voteAverage,
                  swedishProviders: curated.swedishProviders,
                  seasonCount: isTv
                    ? curated.seasonCount || getSeriesSeasonCount(hitTitle)
                    : undefined,
                };
              });
            return res.json({ results });
          }
        } catch {
          // Fall through to curated search
        }
      }

      const curatedResults = searchCuratedTmdbMovies(query);
      return res.json({ results: curatedResults });
    } catch {
      return res.json({ results: [] });
    }
  });

  // TMDB Series Seasons Count Endpoint
  app.get("/api/tmdb/series-seasons", async (req, res) => {
    try {
      const tmdbId = req.query.tmdbId ? Number(req.query.tmdbId) : null;
      const title = String(req.query.title || "").trim();
      const headerKey = req.header("x-tmdb-key");
      const tmdbKey = getEffectiveTmdbKey(headerKey);

      let count = getSeriesSeasonCount(title);

      if (tmdbKey) {
        try {
          let targetId = tmdbId;
          if (!targetId && title) {
            const searchData = (await fetchFromTmdbApi(
              `/search/tv?query=${encodeURIComponent(title)}&language=sv-SE`,
              tmdbKey
            )) as { results?: Array<{ id: number }> };
            if (searchData?.results?.[0]?.id) {
              targetId = Number(searchData.results[0].id);
            }
          }

          if (targetId) {
            const tvDetails = (await fetchFromTmdbApi(
              `/tv/${targetId}?language=sv-SE`,
              tmdbKey
            )) as {
              number_of_seasons?: number;
              seasons?: Array<{ season_number: number }>;
            };
            if (
              typeof tvDetails?.number_of_seasons === "number" &&
              tvDetails.number_of_seasons > 0
            ) {
              count = tvDetails.number_of_seasons;
            } else if (Array.isArray(tvDetails?.seasons)) {
              const valid = tvDetails.seasons.filter((s) => s.season_number > 0);
              if (valid.length > 0) {
                count = valid.length;
              }
            }
          }
        } catch {
          // Fallback to local count
        }
      }

      return res.json({ seasonCount: Math.max(1, count) });
    } catch {
      return res.json({ seasonCount: 1 });
    }
  });

  // TMDB Batch Enrichment Endpoint (for Watched & Watchlist items)
  app.post("/api/tmdb/enrich", async (req, res) => {
    try {
      const { movies = [] } = req.body as {
        movies: Array<{ title: string; year?: string; mediaType?: "movie" | "tv" }>;
      };
      const headerKey = req.header("x-tmdb-key");
      const tmdbKey = getEffectiveTmdbKey(headerKey);

      const enriched = await Promise.all(
        movies.slice(0, 20).map((m) =>
          enrichSingleMovieWithTmdb(m.title, m.year, tmdbKey, m.mediaType)
        )
      );
      return res.json({ enriched });
    } catch {
      return res.json({ enriched: [] });
    }
  });

  app.post("/api/recommendations", async (req, res) => {
    try {
      const {
        watchedMovies = [],
        watchlist = [],
        tasteProfileSummary = "",
        preferences = {
          moods: [],
          genres: [],
          contents: [],
          frameworks: [],
          customText: "",
        },
        previousTitles = [],
        limit = 5,
        dislikedCategories = [],
      } = req.body as {
        watchedMovies: WatchedMovie[];
        watchlist: MovieRecommendation[];
        tasteProfileSummary: string;
        preferences: EveningPreferences;
        previousTitles?: string[];
        limit?: number;
        dislikedCategories?: string[];
      };

      const requestedLimit = Math.max(5, Math.min(15, Number(limit) || 5));
      const requestPage = Math.max(
        1,
        Number(req.body.page) || Math.floor((previousTitles.length || 0) / 10) + 1
      );
      const headerKey = req.header("x-tmdb-key");
      const tmdbKey = getEffectiveTmdbKey(headerKey);
      const ai = getGenAIClient();
      let recommendations: MovieRecommendation[] = [];

      const selectedServices = Array.isArray(preferences.streamingProviders)
        ? preferences.streamingProviders
        : [];
      const candidateTargetCount =
        selectedServices.length > 0
          ? Math.max(12, requestedLimit + 4)
          : Math.max(10, requestedLimit + 2);

      let discoveredPool: MovieRecommendation[] = [];
      if (tmdbKey) {
        discoveredPool = await discoverTmdbCandidates(
          preferences,
          selectedServices,
          tmdbKey,
          20,
          dislikedCategories,
          previousTitles,
          requestPage,
          watchedMovies
        );
      }

      if (ai) {
        const systemInstruction = buildRecommendationSystemPrompt(
          watchedMovies,
          watchlist,
          tasteProfileSummary,
          preferences,
          previousTitles,
          dislikedCategories
        );

        const sampleTitles =
          selectedServices.length > 0
            ? discoveredPool
                .slice(0, 8)
                .map((d) => `"${d.title}" (${d.year})`)
                .join(", ")
            : "";

        const isTasteProfileOnly =
          (preferences.moods || []).length === 0 &&
          (preferences.genres || []).length === 0 &&
          (preferences.contents || []).length === 0 &&
          !preferences.customText;

        const chosenCategoriesList = [
          ...(preferences.genres || []),
          ...(preferences.contents || []),
          ...(preferences.moods || []),
          ...(preferences.frameworks || []),
        ];

        const userPrompt = `Ta fram ${candidateTargetCount} skräddarsydda rekommendationer för användaren. ${
          isTasteProfileOnly
            ? `HÅRT FOKUS PÅ PERSONLIG SMAKPROFIL: Rekommendera titlar uteslutande baserat på användarens unika smakprofil, högt betygsatta favoriter och undvik det hen ogillar.
VIKTIG REGEL MOT KLYSCHOR & UPPENBARA STANDARDVAL: Föreslå INTE bara de mest förutsägbara mainstream-klassikerna (som The Dark Knight, Inception, Interstellar, Gladiator, Fight Club eller Pulp Fiction) som nästan alla filmintresserade redan har sett. Gräv djupare! Ge användaren en inspirerande, varierad och personlig mix av högklassiga filmer och serier – både hyllade mästerverk, moderna pärlor och dolda guldkorn – som fångar exakt den regi, ton, atmosfär, nerv och tematik som användaren älskar i sina 4- och 5-stjärniga betyg!`
            : `Alla ${candidateTargetCount} titlar MÅSTE 100% matcha användarens valda kategorier, genrer, innehåll och stämning under KVÄLLENS VAL.`
        }${
          chosenCategoriesList.length > 1
            ? ` SAMLAD BEDÖMNING AV FLERA KATEGORIER (STRIKT OCH-LOGIK): Användaren har valt flera kategorier samtidigt: [${chosenCategoriesList.join(
                ", "
              )}]. SAMTLIGA titlar MÅSTE förena ALLA dessa kategorier samtidigt! Föreslå ALDRIG en titel som bara matchar en av kategorierna (om användaren t.ex. valt både Animerat och Action får du ALDRIG föreslå filmer som Trolls eller Sing som saknar action, och ALDRIG spelfilmer utan animation).`
            : ""
        }${
          dislikedCategories.length > 0
            ? ` TOTALFÖRBUD MOT OGILLADE KATEGORIER: Användaren har i sin smakprofil uttryckligen angett att hen ogillar och INTE vill ha förslag inom följande kategorier: [${dislikedCategories.join(
                ", "
              )}]. Du får ALDRIG rekommendera filmer eller serier som tillhör eller huvudsakligen kretsar kring någon av dessa ogillade kategorier!`
            : ""
        }${
          selectedServices.length > 0
            ? ` HÅRT KRAV FÖR STREAMING: Samtliga ${candidateTargetCount} titlar MÅSTE finnas tillgängliga i Sverige på minst en av följande valda tjänster: ${selectedServices.join(
                ", "
              )}. Föreslå ALDRIG en titel som bara finns på andra streamingtjänster!${
                sampleTitles
                  ? ` Exempel på titlar som bekräftat finns på ${selectedServices.join(
                      ", "
                    )} i Sverige för dessa val: ${sampleTitles}. Du kan rekommendera från dessa eller andra titlar som du VET finns på ${selectedServices.join(
                      ", "
                    )} i Sverige.`
                  : ""
              }`
            : ""
        } Om användarens val tydligt pekar på en specifik titel (även om den redan är sedd), sätt den som #1 med isExactPinpointMatch: true. Annars ska du aldrig föreslå titlar som redan finns i sedda eller i watchlist. Svara ENDAST med en giltig JSON-array med ${candidateTargetCount} objekt.`;

        try {
          let response;
          const modelsToTry: Array<{ name: string; disableThinking: boolean }> = [
            { name: "gemini-2.5-flash", disableThinking: true },
            { name: "gemini-2.0-flash", disableThinking: true },
            { name: "gemini-1.5-flash", disableThinking: false },
            { name: "gemini-2.5-pro", disableThinking: false },
            { name: "gemini-3-flash-preview", disableThinking: true },
            { name: "gemini-3.1-flash-lite-preview", disableThinking: true },
          ];
          for (const modelSpec of modelsToTry) {
            try {
              response = await ai.models.generateContent({
                model: modelSpec.name,
                contents: userPrompt,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  ...(modelSpec.disableThinking
                    ? { thinkingConfig: { thinkingBudget: 0 } }
                    : {}),
                  temperature: 0.85,
                  abortSignal: AbortSignal.timeout(10000),
                },
              });
              if (response?.text) break;
            } catch {
              // Try next model
            }
          }

          const rawText = response?.text?.trim();
          if (rawText) {
            const cleanedText = rawText
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/\s*```$/, "")
              .replace(/,\s*([}\]])/g, "$1")
              .trim();
            const parsed = JSON.parse(cleanedText);
            const itemsArray = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.recommendations)
              ? parsed.recommendations
              : [];
            if (itemsArray.length > 0) {
              recommendations = itemsArray.map((item: Record<string, unknown>, idx: number) => {
                const rt = String(item.runtime || "2 tim");
                const rawMedia = String(item.mediaType || "").toLowerCase();
                const inferredType: "movie" | "tv" =
                  preferences.mediaType === "tv"
                    ? "tv"
                    : preferences.mediaType === "movie"
                    ? "movie"
                    : rawMedia === "tv" ||
                      rawMedia === "series" ||
                      rt.toLowerCase().includes("säsong") ||
                      rt.toLowerCase().includes("avsnitt") ||
                      rt.toLowerCase().includes("miniserie")
                    ? "tv"
                    : "movie";

                return {
                  id: `ai-rec-${Date.now()}-${idx}`,
                  title: String(item.title || "Okänd titel"),
                  originalTitle: item.originalTitle
                    ? String(item.originalTitle)
                    : undefined,
                  year: String(item.year || "2020"),
                  runtime: rt,
                  mediaType: inferredType,
                  matchPercentage: Math.min(
                    99,
                    Math.max(80, Number(item.matchPercentage) || 92)
                  ),
                  whyYouWillLikeIt: String(
                    item.whyYouWillLikeIt ||
                      item.motivation ||
                      item.motivering ||
                      item.reason ||
                      item.description ||
                      ""
                  ),
                  vibeTags: Array.isArray(item.vibeTags)
                    ? item.vibeTags.slice(0, 4).map(String)
                    : [],
                  isExactPinpointMatch: Boolean(item.isExactPinpointMatch),
                };
              });
            }
          }
        } catch {
          // Graceful fallback to smart local curator below
        }
      }

      // Deduplicate against watchedMovies, watchlist, and previously shown titles
      let uniqueRecs = filterDuplicateRecommendations(
        recommendations,
        watchedMovies,
        watchlist,
        previousTitles
      );

      // Ensure we have candidates, topping up from discovered pool if available
      if (uniqueRecs.length < candidateTargetCount && discoveredPool.length > 0) {
        const existingTitles = new Set([
          ...watchedMovies.map((m) => normalizeMovieTitle(m.title)),
          ...watchlist.map((m) => normalizeMovieTitle(m.title)),
          ...uniqueRecs.map((m) => normalizeMovieTitle(m.title)),
          ...(previousTitles || []).map((t) => normalizeMovieTitle(t)),
        ]);
        for (const disc of discoveredPool) {
          const t1 = normalizeMovieTitle(disc.title);
          const t2 = normalizeMovieTitle(disc.originalTitle);
          if (!existingTitles.has(t1) && !existingTitles.has(t2)) {
            uniqueRecs.push(disc);
            existingTitles.add(t1);
            if (uniqueRecs.length >= candidateTargetCount) break;
          }
        }
      }

      if (uniqueRecs.length < 5) {
        const fallbacks = generateSmartFallbackRecommendations(
          watchedMovies,
          [...watchlist, ...uniqueRecs],
          preferences,
          dislikedCategories,
          previousTitles
        );
        uniqueRecs = [...uniqueRecs, ...fallbacks].slice(0, candidateTargetCount);
      } else {
        uniqueRecs = uniqueRecs.slice(0, candidateTargetCount);
      }

      // Enrich candidate recommendations with TMDB poster, rating, official TMDB categories, and Swedish streaming providers
      const enrichedCandidates = await Promise.all(
        uniqueRecs.map(async (rec) => {
          if (
            rec.tmdbId &&
            rec.posterPath &&
            rec.swedishProviders &&
            rec.swedishProviders.type !== "none" &&
            rec.swedishProviders.providers.length > 0
          ) {
            return rec;
          }
          const meta = await enrichSingleMovieWithTmdb(
            rec.originalTitle || rec.title,
            rec.year,
            tmdbKey,
            rec.mediaType
          );
          const finalPoster = meta.posterPath || rec.posterPath;
          const finalRating = meta.voteAverage || rec.tmdbRating;
          const finalProviders =
            meta.swedishProviders && meta.swedishProviders.providers.length > 0
              ? meta.swedishProviders
              : rec.swedishProviders && rec.swedishProviders.providers.length > 0
              ? rec.swedishProviders
              : meta.swedishProviders || rec.swedishProviders;

          return {
            ...rec,
            year: meta.year || rec.year,
            mediaType: rec.mediaType || meta.mediaType || "movie",
            tmdbId: meta.tmdbId || rec.tmdbId,
            posterPath: finalPoster,
            tmdbRating: finalRating,
            swedishProviders: finalProviders,
            tmdbGenreIds: meta.tmdbGenreIds || rec.tmdbGenreIds,
            tmdbGenres: meta.tmdbGenres || rec.tmdbGenres,
          };
        })
      );

      // Step 1: Double-check all candidates against official TMDB categories & release year
      let verifiedCandidates: MovieRecommendation[] =
        filterAndVerifyMoviesByTmdbCategories(enrichedCandidates, preferences);

      // Step 1.5: Strictly filter out any candidates that match user's disliked categories
      if (dislikedCategories.length > 0) {
        verifiedCandidates = filterOutDislikedCategories(
          verifiedCandidates,
          dislikedCategories
        );
      }

      // Step 2: If streaming services are selected, strictly filter to those services
      if (selectedServices.length > 0) {
        verifiedCandidates = filterMoviesByStreamingServices(
          verifiedCandidates,
          selectedServices
        );
      }

      // Step 3: If fewer than requestedLimit candidates survived, top up with 100% verified titles
      if (verifiedCandidates.length < requestedLimit) {
        // Priority 3A: Top up from TMDB Discovered pool (guaranteed on selected services in SE & verified categories)
        if (discoveredPool.length > 0) {
          const existingTitles = new Set([
            ...watchedMovies.map((m) => normalizeMovieTitle(m.title)),
            ...watchlist.map((m) => normalizeMovieTitle(m.title)),
            ...verifiedCandidates.map((m) => normalizeMovieTitle(m.title)),
            ...(previousTitles || []).map((t) => normalizeMovieTitle(t)),
          ]);
          const unusedDiscovered = discoveredPool.filter((d) => {
            const t1 = normalizeMovieTitle(d.title);
            const t2 = normalizeMovieTitle(d.originalTitle);
            return !existingTitles.has(t1) && !existingTitles.has(t2);
          });
          let verifiedDiscovered = filterAndVerifyMoviesByTmdbCategories(
            unusedDiscovered,
            preferences
          );
          if (dislikedCategories.length > 0) {
            verifiedDiscovered = filterOutDislikedCategories(
              verifiedDiscovered,
              dislikedCategories
            );
          }
          for (const cand of verifiedDiscovered) {
            if (verifiedCandidates.length >= requestedLimit) break;
            verifiedCandidates.push(cand);
            existingTitles.add(normalizeMovieTitle(cand.title));
          }
        }

        // Priority 3B: If still fewer than requestedLimit, do a broader discover keeping genres
        if (verifiedCandidates.length < requestedLimit && tmdbKey) {
          try {
            const broaderPool = await discoverTmdbCandidates(
              { ...preferences, moods: [], frameworks: [] },
              selectedServices,
              tmdbKey,
              20,
              dislikedCategories,
              previousTitles,
              requestPage + 1
            );
            let verifiedBroader = filterAndVerifyMoviesByTmdbCategories(
              broaderPool,
              preferences
            );
            if (dislikedCategories.length > 0) {
              verifiedBroader = filterOutDislikedCategories(
                verifiedBroader,
                dislikedCategories
              );
            }
            const existingTitles = new Set([
              ...watchedMovies.map((m) => normalizeMovieTitle(m.title)),
              ...watchlist.map((m) => normalizeMovieTitle(m.title)),
              ...verifiedCandidates.map((m) => normalizeMovieTitle(m.title)),
              ...(previousTitles || []).map((t) => normalizeMovieTitle(t)),
            ]);
            for (const cand of verifiedBroader) {
              const t1 = normalizeMovieTitle(cand.title);
              const t2 = normalizeMovieTitle(cand.originalTitle);
              if (!existingTitles.has(t1) && !existingTitles.has(t2)) {
                verifiedCandidates.push(cand);
                existingTitles.add(t1);
                if (verifiedCandidates.length >= requestedLimit) break;
              }
            }
          } catch {
            // Proceed to local fallbacks
          }
        }

        // Priority 3C: Local curated fallbacks (strictly matching streaming services if specified)
        if (verifiedCandidates.length < requestedLimit) {
          const extraFallbacks = generateSmartFallbackRecommendations(
            watchedMovies,
            [...watchlist, ...verifiedCandidates],
            preferences,
            dislikedCategories,
            previousTitles
          );
          const enrichedExtra = await Promise.all(
            extraFallbacks.map(async (rec) => {
              if (
                rec.tmdbId &&
                rec.posterPath &&
                rec.swedishProviders &&
                rec.swedishProviders.type !== "none" &&
                rec.swedishProviders.providers.length > 0
              ) {
                return rec;
              }
              const meta = await enrichSingleMovieWithTmdb(
                rec.originalTitle || rec.title,
                rec.year,
                tmdbKey,
                rec.mediaType
              );
              const finalPoster = meta.posterPath || rec.posterPath;
              const finalRating = meta.voteAverage || rec.tmdbRating;
              const finalProviders =
                meta.swedishProviders && meta.swedishProviders.providers.length > 0
                  ? meta.swedishProviders
                  : rec.swedishProviders && rec.swedishProviders.providers.length > 0
                  ? rec.swedishProviders
                  : meta.swedishProviders || rec.swedishProviders;

              return {
                ...rec,
                year: meta.year || rec.year,
                mediaType: rec.mediaType || meta.mediaType || "movie",
                tmdbId: meta.tmdbId || rec.tmdbId,
                posterPath: finalPoster,
                tmdbRating: finalRating,
                swedishProviders: finalProviders,
                tmdbGenreIds: meta.tmdbGenreIds || rec.tmdbGenreIds,
                tmdbGenres: meta.tmdbGenres || rec.tmdbGenres,
              };
            })
          );
          let verifiedExtra: MovieRecommendation[] =
            filterAndVerifyMoviesByTmdbCategories(enrichedExtra, preferences);
          if (dislikedCategories.length > 0) {
            verifiedExtra = filterOutDislikedCategories(
              verifiedExtra,
              dislikedCategories
            );
          }
          if (selectedServices.length > 0) {
            verifiedExtra = filterMoviesByStreamingServices(
              verifiedExtra,
              selectedServices
            );
          }
          verifiedCandidates = filterDuplicateRecommendations(
            [...verifiedCandidates, ...verifiedExtra],
            watchedMovies,
            watchlist,
            previousTitles
          );
        }
      }

      // Final safeguard: if verifiedCandidates is still completely empty, supply smart fallbacks
      if (verifiedCandidates.length === 0) {
        verifiedCandidates = generateSmartFallbackRecommendations(
          watchedMovies,
          watchlist,
          preferences,
          dislikedCategories,
          previousTitles
        );
      }

      if (dislikedCategories.length > 0) {
        verifiedCandidates = filterOutDislikedCategories(
          verifiedCandidates,
          dislikedCategories
        );
      }

      // Strict guarantee: never re-serve a movie present in previousTitles
      const previousNorms = new Set(
        (previousTitles || []).map((t) => normalizeMovieTitle(t)).filter(Boolean)
      );
      verifiedCandidates = verifiedCandidates.filter((m) => {
        const t1 = normalizeMovieTitle(m.title);
        const t2 = m.originalTitle ? normalizeMovieTitle(m.originalTitle) : "";
        return !previousNorms.has(t1) && (!t2 || !previousNorms.has(t2));
      });

      const finalRecs = verifiedCandidates.slice(0, requestedLimit);

      res.json({ recommendations: finalRecs });
    } catch {
      res.status(500).json({
        error: "Kunde inte generera filmrekommendationer just nu.",
      });
    }
  });

  app.post("/api/taste-profile", async (req, res) => {
    try {
      const { watchedMovies = [], dislikedCategories = [] } = req.body as {
        watchedMovies: WatchedMovie[];
        dislikedCategories?: string[];
      };

      if (!Array.isArray(watchedMovies) || watchedMovies.length === 0) {
        return res.json({
          summary: generateSmartFallbackTasteProfile([], dislikedCategories),
        });
      }

      const ai = getGenAIClient();
      if (ai) {
        const moviesText = watchedMovies
          .map((m) => {
            if (m.seasons && m.seasons.length > 0) {
              return m.seasons
                .map(
                  (s) =>
                    `- "${m.title} (Säsong ${s.seasonNumber})" (${s.rating}/5 stjärnor, ${
                      s.liked ? "Gillade" : "Gillade inte"
                    }): Taggar: [${(s.tags || []).join(", ")}]${
                      s.thoughts ? ` | Tankar: "${s.thoughts}"` : ""
                    }`
                )
                .join("\n");
            }
            return `- "${m.title}" (${m.rating}/5 stjärnor, ${
              m.liked ? "Gillade" : "Gillade inte"
            }): Taggar: [${(m.tags || []).join(", ")}]${
              m.thoughts ? ` | Tankar: "${m.thoughts}"` : ""
            }`;
          })
          .join("\n");

        const prompt = `Analysera följande filmer/serier och kvaliteter som användaren har sett och betygsatt:
${moviesText}${
          dislikedCategories.length > 0
            ? `\n\nObservera även: Användaren har i sin smakprofil uttryckligen angett att hen ogillar och vill undvika följande kategorier: [${dislikedCategories.join(
                ", "
              )}].`
            : ""
        }

Skriv en träffsäker, personlig sammanfattning på svenska (3–4 meningar, direkt tilltal "Du...") av användarens unika smak för film och serier:
1. Vilka tydliga mönster ser du i verken användaren älskar (4–5 stjärnor) och de kvaliteter som lyfts fram?
2. Vad söker användaren i regi, ton, tempo och känsla?
3. Om det finns titlar med lågt betyg (1–2 stjärnor / Gillade inte) eller uttryckligen ogillade kategorier, nämn tydligt vilken typ av stil, klichéer eller element användaren ogillar och vill undvika.
4. OBSERVERA SÄSONGSBETYG: Om användaren har gett olika betyg på olika säsonger av samma serie (t.ex. Säsong 1 med 5 stjärnor och Säsong 2 med 2 stjärnor), behandla dem som separata omdömen och slå ALDRIG ihop dem till ett medelvärde. Fånga vad som gjorde favoritsäsongen stark kontra vad som brast i den svagare säsongen.
Svara ENDAST med ett JSON-objekt på formatet: {"summary": "Din personliga sammanfattning här..."}`;

        try {
          let response;
          const modelsToTry: Array<{ name: string; disableThinking: boolean }> = [
            { name: "gemini-2.5-flash", disableThinking: true },
            { name: "gemini-2.0-flash", disableThinking: true },
            { name: "gemini-1.5-flash", disableThinking: false },
            { name: "gemini-2.5-pro", disableThinking: false },
            { name: "gemini-3-flash-preview", disableThinking: true },
            { name: "gemini-3.1-flash-lite-preview", disableThinking: true },
          ];
          for (const modelSpec of modelsToTry) {
            try {
              response = await ai.models.generateContent({
                model: modelSpec.name,
                contents: prompt,
                config: {
                  responseMimeType: "application/json",
                  ...(modelSpec.disableThinking
                    ? { thinkingConfig: { thinkingBudget: 0 } }
                    : {}),
                  temperature: 0.7,
                  abortSignal: AbortSignal.timeout(10000),
                },
              });
              if (response?.text) break;
            } catch {
              // Try next model
            }
          }

          const rawText = response?.text?.trim();
          if (rawText) {
            const cleanedText = rawText
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/\s*```$/, "")
              .replace(/,\s*([}\]])/g, "$1")
              .trim();
            const parsed = JSON.parse(cleanedText);
            if (parsed && typeof parsed.summary === "string" && parsed.summary.trim()) {
              return res.json({ summary: parsed.summary.trim() });
            }
          }
        } catch {
          // Graceful fallback below
        }
      }

      const fallbackSummary = generateSmartFallbackTasteProfile(
        watchedMovies,
        dislikedCategories
      );
      return res.json({ summary: fallbackSummary });
    } catch {
      res.status(500).json({
        error: "Kunde inte uppdatera smakprofilen just nu.",
      });
    }
  });

  const distPath = path.join(__dirname, "dist");
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    fs.existsSync(path.join(distPath, "index.html"));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
