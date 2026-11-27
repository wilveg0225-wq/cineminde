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
  DismissedMovie,
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
  normalizeSwedishAgeRating,
  parseTmdbMovieAgeRating,
  parseTmdbTvAgeRating,
  inferAgeRatingFromGenres,
  filterAndVerifyMoviesByTmdbCategories,
  limitAnimatedRecommendations,
  normalizeProviderKey,
  movieMatchesStreamingProviders,
  extractTmdbVerificationRules,
  extractTmdbDiscoverFilters,
  resolveEffectiveMediaType,
  hasSeriesLengthFilter,
  hasMovieLengthFilter,
  formatRuntimeMinutes,
  hasNonLatinScript,
  normalizeMovieTitle,
  getMovieFranchiseKey,
  filterOutDislikedCategories,
  getDislikedGenreIds,
  isMovieMatchingDislikedCategories,
  getSeriesSeasonCount,
  KNOWN_SERIES_SEASON_COUNTS,
  formatSelectedChipsWithContext,
  describeSteeringAdjustments,
  buildSteeringPromptLines,
  selectFavoriteSeedsForTmdb,
  buildHybridCandidatePool,
  formatCandidatePoolForPrompt,
  resolveRecommendationTemperature,
  GENRE_GROUPS,
  CONTENT_GROUPS,
  SETTING_GROUPS,
  MOOD_GROUPS,
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

function isTransientGeminiError(err: unknown): boolean {
  const msg = String(
    err instanceof Error ? err.message : err || ""
  ).toLowerCase();
  const status = (err as { status?: number; code?: number })?.status ??
    (err as { code?: number })?.code;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed")
  );
}

type GeminiResponseSchema = NonNullable<
  Parameters<GoogleGenAI["models"]["generateContent"]>[0]["config"]
>["responseSchema"];

const RECOMMENDATIONS_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      originalTitle: { type: Type.STRING },
      year: { type: Type.STRING },
      runtime: { type: Type.STRING },
      mediaType: { type: Type.STRING },
      ageRating: { type: Type.STRING },
      matchPercentage: { type: Type.INTEGER },
      whyYouWillLikeIt: { type: Type.STRING },
      vibeTags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      isExactPinpointMatch: { type: Type.BOOLEAN },
    },
    required: [
      "title",
      "year",
      "runtime",
      "mediaType",
      "matchPercentage",
      "whyYouWillLikeIt",
      "vibeTags",
      "isExactPinpointMatch",
    ],
  },
};

const TASTE_PROFILE_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
  },
  required: ["summary"],
};

// Short cooldown map so models returning 503/timeout don't stall subsequent requests
const geminiModelCooldownUntil = new Map<string, number>();
const GEMINI_MODEL_COOLDOWN_MS = 2 * 60 * 1000;

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction?: string;
    temperature: number;
    responseMimeType?: string;
    responseSchema?: GeminiResponseSchema;
    label?: string;
    maxTotalMs?: number;
  }
): Promise<string | null> {
  // Prioritize fast, reliable production Flash models with a hard total time budget
  // so users never wait 15–20 seconds during a Gemini 503/latency spike.
  const allModels: Array<{
    name: string;
    timeoutMs: number;
  }> = [
    { name: "gemini-3.8-flash", timeoutMs: 5000 },
    { name: "gemini-3.5-flash-lite", timeoutMs: 4500 },
    { name: "gemini-flash-latest", timeoutMs: 4500 },
    { name: "gemini-flash-lite-latest", timeoutMs: 4000 },
  ];

  const now = Date.now();
  const maxTotalMs = params.maxTotalMs ?? 7500;
  const deadline = now + maxTotalMs;
  const readyModels = allModels.filter(
    (m) => (geminiModelCooldownUntil.get(m.name) || 0) <= now
  );
  const coolingModels = allModels.filter(
    (m) => (geminiModelCooldownUntil.get(m.name) || 0) > now
  );
  // Try ready models first; only touch cooling models if we still have budget left
  const modelsToTry = [...readyModels, ...coolingModels];

  const tag = params.label || "generateContent";

  const tryModelOnce = async (
    modelSpec: {
      name: string;
      timeoutMs: number;
    },
    attemptTimeoutMs: number
  ): Promise<{ text: string | null; transient: boolean }> => {
    try {
      const response = await ai.models.generateContent({
        model: modelSpec.name,
        contents: params.contents,
        config: {
          ...(params.systemInstruction
            ? { systemInstruction: params.systemInstruction }
            : {}),
          responseMimeType: params.responseMimeType || "application/json",
          ...(params.responseSchema
            ? { responseSchema: params.responseSchema }
            : {}),
          temperature: params.temperature,
          abortSignal: AbortSignal.timeout(attemptTimeoutMs),
        },
      });
      const text = response?.text?.trim();
      if (text) {
        geminiModelCooldownUntil.delete(modelSpec.name);
        return { text, transient: false };
      }
      console.warn(`[Gemini:${tag}] Empty response from ${modelSpec.name}`);
      return { text: null, transient: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const transient = isTransientGeminiError(err);
      if (transient) {
        geminiModelCooldownUntil.set(
          modelSpec.name,
          Date.now() + GEMINI_MODEL_COOLDOWN_MS
        );
      }
      console.warn(
        `[Gemini:${tag}] ${modelSpec.name} failed (transient=${transient}): ${errMsg.slice(
          0,
          200
        )}`
      );
      return { text: null, transient };
    }
  };

  // Single fast pass strictly bounded by maxTotalMs — no slow Pass 2 retries
  for (const modelSpec of modelsToTry) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1200) {
      console.warn(`[Gemini:${tag}] Time budget (${maxTotalMs}ms) reached; falling back.`);
      break;
    }
    const attemptTimeout = Math.min(modelSpec.timeoutMs, remainingMs);
    const res = await tryModelOnce(modelSpec, attemptTimeout);
    if (res.text) return res.text;
  }

  console.warn(`[Gemini:${tag}] All models failed; falling back to TMDB/local curator.`);
  return null;
}

function getEffectiveTmdbKey(headerKey?: string): string | null {
  const candidate = (headerKey || process.env.TMDB_API_KEY || "").trim();
  if (!candidate || candidate === "MY_TMDB_API_KEY") {
    return null;
  }
  return candidate;
}

const WATCH_PROVIDERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const COLLAB_RECS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const tmdbEnrichCache = new Map<string, TmdbMovieEnrichment>();
const tmdbAgeRatingCache = new Map<string, string>();
const tmdbWatchProvidersCache = new Map<
  string,
  { data: ReturnType<typeof parseTmdbSwedishProviders>; expiresAt: number }
>();
const tmdbCollabRecsCache = new Map<
  string,
  { data: Array<Record<string, unknown>>; expiresAt: number }
>();

async function fetchTmdbSwedishProvidersCached(
  tmdbId: number,
  mediaType: "movie" | "tv",
  tmdbKey: string
): Promise<ReturnType<typeof parseTmdbSwedishProviders> | undefined> {
  if (!tmdbId || tmdbId >= 900000) return undefined;
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = tmdbWatchProvidersCache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.data;
    }
    tmdbWatchProvidersCache.delete(cacheKey);
  }

  try {
    const providersData = (await fetchFromTmdbApi(
      `/${mediaType}/${tmdbId}/watch/providers`,
      tmdbKey
    )) as { results?: Record<string, unknown> };
    const parsed = parseTmdbSwedishProviders(providersData?.results?.SE);
    if (tmdbWatchProvidersCache.size > 1500) {
      const oldestKey = tmdbWatchProvidersCache.keys().next().value;
      if (oldestKey) tmdbWatchProvidersCache.delete(oldestKey);
    }
    tmdbWatchProvidersCache.set(cacheKey, {
      data: parsed,
      expiresAt: Date.now() + WATCH_PROVIDERS_CACHE_TTL_MS,
    });
    return parsed;
  } catch {
    return undefined;
  }
}

async function resolveSeedTmdbIdentity(
  movie: WatchedMovie,
  tmdbKey: string
): Promise<{ tmdbId: number; mediaType: "movie" | "tv"; title: string } | null> {
  const inferredType: "movie" | "tv" =
    movie.mediaType === "tv" ||
    (movie.seasons && movie.seasons.length > 0) ||
    (movie.seasonCount && movie.seasonCount > 0)
      ? "tv"
      : "movie";

  if (movie.tmdbId && movie.tmdbId < 900000) {
    return { tmdbId: movie.tmdbId, mediaType: inferredType, title: movie.title };
  }

  const curated = lookupCuratedTmdbMovie(movie.originalTitle || movie.title, movie.year);
  if (curated.tmdbId && curated.tmdbId < 900000) {
    return {
      tmdbId: curated.tmdbId,
      mediaType: curated.mediaType || inferredType,
      title: movie.title,
    };
  }

  try {
    const query = movie.originalTitle || movie.title;
    const searchData = (await fetchFromTmdbApi(
      `/search/${inferredType}?query=${encodeURIComponent(query)}&language=sv-SE`,
      tmdbKey
    )) as { results?: Array<Record<string, unknown>> };
    const best = pickBestTmdbCandidate(
      searchData?.results || [],
      movie.year,
      query
    );
    if (best && best.id) {
      return {
        tmdbId: Number(best.id),
        mediaType: inferredType,
        title: movie.title,
      };
    }
  } catch {
    // Ignore seed lookup failures
  }
  return null;
}

function isLikelySwedishText(text: string): boolean {
  if (!text || text.trim().length < 20) return false;
  const lower = ` ${text.toLowerCase()} `;
  // Swedish diacritics are a strong positive signal
  const hasSwedishChars = /[åäö]/.test(lower);
  const swedishWordHits = (
    lower.match(
      /\b(och|att|som|för|med|det|den|är|på|av|till|från|när|efter|blir|sin|sitt|sig|ett|inte|har|kan|vid|utan|över|under|mellan|genom)\b/g
    ) || []
  ).length;
  const englishWordHits = (
    lower.match(
      /\b(the|with|when|after|about|their|from|into|that|this|they|have|been|where|which|while|through|between|against|becomes|story|follows|young|life)\b/g
    ) || []
  ).length;

  if (englishWordHits >= 3 && !hasSwedishChars && swedishWordHits < 2) {
    return false;
  }
  if (englishWordHits > swedishWordHits * 2 && !hasSwedishChars) {
    return false;
  }
  return hasSwedishChars || swedishWordHits >= 2;
}

async function fetchCollaborativeTmdbCandidates(
  watchedMovies: WatchedMovie[],
  preferences: EveningPreferences,
  tmdbKey: string,
  dislikedCategories: string[] = [],
  previousTitles: string[] = [],
  page = 1,
  limit = 25
): Promise<MovieRecommendation[]> {
  try {
    if (!watchedMovies || watchedMovies.length === 0) return [];
    const effectiveMediaType = resolveEffectiveMediaType(preferences);
    const seedMovies = selectFavoriteSeedsForTmdb(watchedMovies, effectiveMediaType, 5);
    if (seedMovies.length === 0) return [];

    const resolvedSeeds = (
      await Promise.all(seedMovies.map((m) => resolveSeedTmdbIdentity(m, tmdbKey)))
    ).filter((s): s is { tmdbId: number; mediaType: "movie" | "tv"; title: string } =>
      Boolean(s)
    );
    if (resolvedSeeds.length === 0) return [];

    const tmdbPage = Math.max(1, Math.min(3, Number(page) || 1));
    const todayStr = new Date().toISOString().slice(0, 10);
    const previousNorms = new Set(
      (previousTitles || []).map((t) => normalizeMovieTitle(t)).filter(Boolean)
    );

    const seedResults = await Promise.all(
      resolvedSeeds.map(async (seed) => {
        const cacheKey = `${seed.mediaType}:${seed.tmdbId}:p${tmdbPage}`;
        const cachedCollab = tmdbCollabRecsCache.get(cacheKey);
        let results: Array<Record<string, unknown>> | undefined;
        if (cachedCollab) {
          if (cachedCollab.expiresAt > Date.now()) {
            results = cachedCollab.data;
          } else {
            tmdbCollabRecsCache.delete(cacheKey);
          }
        }
        if (!results) {
          try {
            const data = (await fetchFromTmdbApi(
              `/${seed.mediaType}/${seed.tmdbId}/recommendations?language=sv-SE&page=${tmdbPage}`,
              tmdbKey
            )) as { results?: Array<Record<string, unknown>> };
            results = Array.isArray(data?.results) ? data.results : [];
            if (tmdbCollabRecsCache.size > 500) {
              const oldestKey = tmdbCollabRecsCache.keys().next().value;
              if (oldestKey) tmdbCollabRecsCache.delete(oldestKey);
            }
            tmdbCollabRecsCache.set(cacheKey, {
              data: results,
              expiresAt: Date.now() + COLLAB_RECS_CACHE_TTL_MS,
            });
          } catch {
            results = [];
          }
        }
        return { seed, results };
      })
    );

    interface AggregatedCollab {
      hit: Record<string, unknown>;
      mediaType: "movie" | "tv";
      seedTitles: string[];
    }
    const aggregated = new Map<string, AggregatedCollab>();

    for (const { seed, results } of seedResults) {
      for (const hit of results) {
        if (!hit || !hit.id) continue;
        const dateStr = String(hit.release_date || hit.first_air_date || "");
        if (!dateStr || dateStr > todayStr) continue;
        const voteAvg = typeof hit.vote_average === "number" ? hit.vote_average : 0;
        const voteCount = typeof hit.vote_count === "number" ? hit.vote_count : 0;
        if (voteAvg < 6.4 || voteCount < 25) continue;

        const title = String(hit.title || hit.name || "").trim();
        const originalTitle = String(
          hit.original_title || hit.original_name || title
        ).trim();
        const t1 = normalizeMovieTitle(title);
        const t2 = originalTitle ? normalizeMovieTitle(originalTitle) : "";
        if ((t1 && previousNorms.has(t1)) || (t2 && previousNorms.has(t2))) {
          continue;
        }

        const key = `${seed.mediaType}:${hit.id}`;
        const existing = aggregated.get(key);
        if (existing) {
          if (!existing.seedTitles.includes(seed.title)) {
            existing.seedTitles.push(seed.title);
          }
        } else {
          aggregated.set(key, {
            hit,
            mediaType: seed.mediaType,
            seedTitles: [seed.title],
          });
        }
      }
    }

    const sortedAgg = Array.from(aggregated.values()).sort((a, b) => {
      if (b.seedTitles.length !== a.seedTitles.length) {
        return b.seedTitles.length - a.seedTitles.length;
      }
      const ratingA = typeof a.hit.vote_average === "number" ? a.hit.vote_average : 7.0;
      const ratingB = typeof b.hit.vote_average === "number" ? b.hit.vote_average : 7.0;
      return ratingB - ratingA;
    });

    const candidates: MovieRecommendation[] = sortedAgg.slice(0, limit * 2).map(
      ({ hit, mediaType, seedTitles }) => {
        const dateStr = String(hit.release_date || hit.first_air_date || "");
        const year = dateStr.slice(0, 4);
        const title = String(hit.title || hit.name || "").trim();
        const originalTitle = String(
          hit.original_title || hit.original_name || title
        ).trim();
        const originalLanguage = String(hit.original_language || "").trim();
        const rawGenreIds = Array.isArray(hit.genre_ids)
          ? hit.genre_ids.map(Number).filter((n) => !Number.isNaN(n) && n > 0)
          : [];
        const tmdbGenres = mapTmdbGenreIdsToNames(rawGenreIds);
        const voteAverage =
          typeof hit.vote_average === "number" && hit.vote_average > 0
            ? Math.round(hit.vote_average * 10) / 10
            : 7.5;
        const posterPath = hit.poster_path ? String(hit.poster_path) : undefined;
        const overview = String(hit.overview || "").trim();
        const seedLabel = seedTitles.slice(0, 2).join(" och ");
        const genrePhrase =
          tmdbGenres.length > 0
            ? ` inom ${tmdbGenres.slice(0, 2).join(" och ").toLowerCase()}`
            : "";
        const motivation =
          overview.length > 30 && isLikelySwedishText(overview)
            ? `Uppskattas ofta av tittare som gillade ${seedLabel}. ${overview}`
            : `Uppskattas ofta av tittare som gillade ${seedLabel} – stark träff${genrePhrase} med högt publikbetyg (${voteAverage}/10).`;

        return {
          id: `tmdb-collab-${hit.id}`,
          title,
          originalTitle,
          originalLanguage: originalLanguage || undefined,
          year: year || "2020",
          mediaType,
          runtime: mediaType === "tv" ? "TV-serie" : "Film",
          matchPercentage: Math.min(
            94,
            Math.max(84, Math.round(80 + voteAverage + Math.min(3, seedTitles.length) * 2))
          ),
          whyYouWillLikeIt: motivation,
          vibeTags: tmdbGenres.slice(0, 3),
          tmdbId: Number(hit.id),
          posterPath,
          tmdbRating: voteAverage,
          tmdbGenreIds: rawGenreIds,
          tmdbGenres,
          recommendedFromSeeds: seedTitles,
        };
      }
    );

    const effectivePreferences: EveningPreferences = {
      ...preferences,
      mediaType: effectiveMediaType,
    };

    let filtered = filterAndVerifyMoviesByTmdbCategories(
      candidates,
      effectivePreferences
    );
    if (dislikedCategories.length > 0) {
      filtered = filterOutDislikedCategories(filtered, dislikedCategories);
    }

    // Resolve non-Latin titles for top candidates
    const topSlice = filtered.slice(0, limit);
    const cleaned = await Promise.all(
      topSlice.map(async (item) => {
        if (hasNonLatinScript(item.title) && item.tmdbId) {
          const enTitle = await fetchTmdbEnglishTitle(
            item.tmdbId,
            item.mediaType === "tv" ? "tv" : "movie",
            tmdbKey
          );
          if (enTitle) {
            return { ...item, title: enTitle };
          }
        }
        return item;
      })
    );

    return cleaned;
  } catch {
    return [];
  }
}

async function fetchTmdbAgeRating(
  tmdbId: number,
  mediaType: "movie" | "tv",
  tmdbKey: string
): Promise<string | undefined> {
  if (!tmdbId || tmdbId >= 900000) return undefined;
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = tmdbAgeRatingCache.get(cacheKey);
  if (cached) return cached;

  try {
    const endpoint =
      mediaType === "tv"
        ? `/tv/${tmdbId}/content_ratings`
        : `/movie/${tmdbId}/release_dates`;
    const data = await fetchFromTmdbApi(endpoint, tmdbKey);
    const parsed =
      mediaType === "tv"
        ? parseTmdbTvAgeRating(data)
        : parseTmdbMovieAgeRating(data);
    if (parsed) {
      if (tmdbAgeRatingCache.size > 1000) {
        const oldestKey = tmdbAgeRatingCache.keys().next().value;
        if (oldestKey) tmdbAgeRatingCache.delete(oldestKey);
      }
      tmdbAgeRatingCache.set(cacheKey, parsed);
    }
    return parsed;
  } catch {
    return undefined;
  }
}

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
  targetYear?: string,
  targetTitle?: string
): Record<string, unknown> | undefined {
  if (!results || results.length === 0) return undefined;

  const cleanTargetYear = targetYear
    ? targetYear.replace(/[^0-9]/g, "").slice(0, 4)
    : "";
  const targetNum = cleanTargetYear ? Number(cleanTargetYear) : 0;
  const targetNorm = targetTitle ? normalizeMovieTitle(targetTitle) : "";

  const scored = results.map((r) => {
    let score = 0;

    // 1. Title similarity (handles both exact matches and Swedish/English variants like "Parasit" vs "Parasite")
    if (targetNorm) {
      const t1 = normalizeMovieTitle(String(r.title || r.name || ""));
      const t2 = normalizeMovieTitle(
        String(r.original_title || r.original_name || "")
      );
      if (t1 === targetNorm || t2 === targetNorm) {
        score += 32;
      } else if (
        (t1 && (t1.includes(targetNorm) || targetNorm.includes(t1))) ||
        (t2 && (t2.includes(targetNorm) || targetNorm.includes(t2)))
      ) {
        score += 18;
      }
    }

    // 2. Release year proximity (allows ±1 year for festival/Dec-Jan premiere discrepancies)
    if (targetNum > 1900) {
      const candYear = Number(
        String(r.release_date || r.first_air_date || "").slice(0, 4)
      );
      if (candYear > 1900) {
        const diff = Math.abs(candYear - targetNum);
        if (diff === 0) score += 38;
        else if (diff === 1) score += 26;
        else if (diff === 2) score += 8;
        else if (diff > 5) score -= 18;
      }
    }

    // 3. Popularity, vote count & poster presence (strongly favors real well-known releases over obscure 0-vote stubs)
    const voteCount = typeof r.vote_count === "number" ? r.vote_count : 0;
    const pop = typeof r.popularity === "number" ? r.popularity : 0;
    score += Math.min(60, Math.log10(Math.max(0, voteCount) + 1) * 14);
    score += Math.min(12, Math.log10(Math.max(0, pop) + 1) * 4);
    if (r.poster_path) score += 8;

    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.r;
}

async function fetchTmdbEnglishTitle(
  tmdbId: number,
  mediaType: "movie" | "tv",
  tmdbKey: string
): Promise<string | undefined> {
  try {
    const data = (await fetchFromTmdbApi(
      `/${mediaType}/${tmdbId}?language=en-US`,
      tmdbKey
    )) as { title?: string; name?: string };
    const enTitle = String(data?.title || data?.name || "").trim();
    if (enTitle && !hasNonLatinScript(enTitle)) {
      return enTitle;
    }
  } catch {
    // Ignore
  }
  return undefined;
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

    const effectiveMediaType = resolveEffectiveMediaType(preferences);
    const effectivePreferences: EveningPreferences = {
      ...preferences,
      mediaType: effectiveMediaType,
    };

    const typesToQuery: Array<"movie" | "tv"> =
      effectiveMediaType === "tv"
        ? ["tv"]
        : effectiveMediaType === "movie"
        ? ["movie"]
        : ["movie", "tv"];

    const { genreRules, minYear, maxYear } =
      extractTmdbVerificationRules(effectivePreferences);
    const discoverFilters = extractTmdbDiscoverFilters(effectivePreferences);

    const allChosenChips = [
      ...(effectivePreferences.genres || []),
      ...(effectivePreferences.contents || []),
      ...(effectivePreferences.frameworks || []),
      ...(effectivePreferences.moods || []),
    ];
    const hasExplicitEveningFilters =
      allChosenChips.length > 0 || Boolean(effectivePreferences.customText?.trim());

    const originCountryParam =
      discoverFilters.originCountries.length > 0
        ? `&with_origin_country=${encodeURIComponent(
            discoverFilters.originCountries.join("|")
          )}`
        : "";
    const originalLangParam =
      discoverFilters.originalLanguages.length > 0
        ? `&with_original_language=${encodeURIComponent(
            discoverFilters.originalLanguages.join("|")
          )}`
        : "";
    const isRegionalFilter =
      discoverFilters.originCountries.length > 0 ||
      discoverFilters.originalLanguages.length > 0;

    // Build keyword & company query strings
    const companyParam =
      discoverFilters.companyIds.length > 0
        ? `&with_companies=${encodeURIComponent(
            discoverFilters.companyIds.join("|")
          )}`
        : "";
    const keywordParam =
      discoverFilters.keywordGroups.length > 0
        ? `&with_keywords=${encodeURIComponent(
            discoverFilters.keywordGroups
              .slice(0, 2)
              .map((grp) => grp.join("|"))
              .join(",")
          )}`
        : "";
    const softOrKeywordParam =
      discoverFilters.keywordGroups.length > 1
        ? `&with_keywords=${encodeURIComponent(
            Array.from(new Set(discoverFilters.keywordGroups.flat())).join("|")
          )}`
        : "";
    const withoutKeywordParam =
      discoverFilters.withoutKeywordIds.length > 0
        ? `&without_keywords=${encodeURIComponent(
            discoverFilters.withoutKeywordIds.join(",")
          )}`
        : "";

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
    const combinedWithoutGenres = Array.from(
      new Set([...dislikedGenreIds, ...discoverFilters.withoutGenreIds])
    );
    const withoutGenreParam =
      combinedWithoutGenres.length > 0
        ? `&without_genres=${encodeURIComponent(combinedWithoutGenres.join(","))}`
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
      watchParam = `&watch_region=SE&with_watch_providers=${providerParam}&with_watch_monetization_types=${monetization}`;
    } else {
      // Default to titles actually streamable in Sweden right now (also filters out unreleased cinema-only titles)
      watchParam =
        "&watch_region=SE&with_watch_monetization_types=flatrate|free|ads";
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
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const effectiveMaxYear =
      maxYear && discoverFilters.maxYearOverride
        ? Math.min(maxYear, discoverFilters.maxYearOverride)
        : maxYear ?? discoverFilters.maxYearOverride;
    const maxDateStr =
      effectiveMaxYear && effectiveMaxYear < currentYear
        ? `${effectiveMaxYear}-12-31`
        : todayStr;

    const needsSeriesDetails = hasSeriesLengthFilter(effectivePreferences);
    const needsMovieRuntimeDetails = hasMovieLengthFilter(effectivePreferences);

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

      // If no explicit genreRules exist, use mood/setting fallbackGenreIds so Discover isn't unfiltered
      const usedFallbackGenres =
        ruleTokens.length === 0 && discoverFilters.fallbackGenreIds.length > 0;
      if (usedFallbackGenres) {
        const validFallback = discoverFilters.fallbackGenreIds.filter(
          (gid) => validSet.has(gid) && !combinedWithoutGenres.includes(gid)
        );
        if (validFallback.length > 0) {
          ruleTokens.push(validFallback.slice(0, 3).join("|"));
        }
      }

      // If no specific evening filters were chosen (e.g. taste profile mode in "För dig"),
      // derive target genres from the user's loved titles of the SAME mediaType first (separating movie vs TV taste)
      if (
        ruleTokens.length === 0 &&
        !hasExplicitEveningFilters &&
        watchedMovies.length > 0
      ) {
        const inferWatchedType = (m: WatchedMovie): "movie" | "tv" =>
          m.mediaType === "tv" ||
          (m.seasons && m.seasons.length > 0) ||
          (m.seasonCount && m.seasonCount > 0)
            ? "tv"
            : "movie";
        const loved = watchedMovies.filter(
          (m) => m.rating >= 4 && m.liked !== false
        );
        const sameMediaLoved = loved.filter(
          (m) => inferWatchedType(m) === mediaType
        );
        const sourceMovies =
          sameMediaLoved.length > 0
            ? sameMediaLoved
            : loved.length > 0
            ? loved
            : watchedMovies;
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
      if (mediaType === "movie") {
        if (minYear) yearParam += `&primary_release_date.gte=${minYear}-01-01`;
        yearParam += `&primary_release_date.lte=${maxDateStr}`;
      } else {
        if (minYear) yearParam += `&first_air_date.gte=${minYear}-01-01`;
        yearParam += `&first_air_date.lte=${maxDateStr}`;
      }

      // Runtime & TV status/type params
      let extraTypeParam = "";
      if (mediaType === "movie") {
        if (discoverFilters.minRuntime) {
          extraTypeParam += `&with_runtime.gte=${discoverFilters.minRuntime}`;
        }
        if (discoverFilters.maxRuntime) {
          extraTypeParam += `&with_runtime.lte=${discoverFilters.maxRuntime}`;
        }
      } else {
        if (discoverFilters.tvMaxEpisodeRuntime) {
          extraTypeParam += `&with_runtime.lte=${discoverFilters.tvMaxEpisodeRuntime}`;
        }
        if (discoverFilters.tvEndedOnly) {
          extraTypeParam += `&with_status=${encodeURIComponent("3|4")}`;
        }
        if (discoverFilters.tvMiniseriesOnly) {
          extraTypeParam += `&with_type=2`;
        } else if (discoverFilters.tvShortSeries) {
          extraTypeParam += `&with_type=${encodeURIComponent("2|4")}`;
        }
      }

      const sortBy =
        discoverFilters.sortBy ||
        (usedFallbackGenres && discoverFilters.keywordGroups.length === 0
          ? "vote_average.desc"
          : "popularity.desc");
      const voteCountMin =
        discoverFilters.minVoteCount ??
        (isRegionalFilter
          ? 15
          : discoverFilters.companyIds.length > 0
          ? 30
          : discoverFilters.keywordGroups.length > 0
          ? 50
          : usedFallbackGenres
          ? 300
          : hasProviders
          ? 50
          : 150);
      const voteCountMaxParam = discoverFilters.maxVoteCount
        ? `&vote_count.lte=${discoverFilters.maxVoteCount}`
        : "";
      const minVoteAvg =
        discoverFilters.minVoteAverage ??
        (usedFallbackGenres ? 6.8 : 6.6);
      const voteAvgParam = minVoteAvg ? `&vote_average.gte=${minVoteAvg}` : "";

      // Query across multiple pages if needed so we never run out of fresh titles
      const maxPagesToFetch = discoverFilters.tvShortSeries
        ? 3
        : needsSeriesDetails
        ? 3
        : 2;

      // For "1–2 säsonger", query BOTH Miniseries (with_type=2, always 1 season) AND Ended modern series (with_status=3 & first_air_date >= 2015)
      const extraVariantParams: string[] =
        mediaType === "tv" && discoverFilters.tvShortSeries
          ? [
              extraTypeParam.replace(/&with_type=[^&]*/g, "") + "&with_type=2",
              extraTypeParam.replace(/&with_type=[^&]*/g, "") +
                "&with_status=3&first_air_date.gte=2015-01-01",
            ]
          : [extraTypeParam];

      for (const variantExtra of extraVariantParams) {
      for (let p = initialPage; p < initialPage + maxPagesToFetch; p++) {
        if (discovered.length >= (discoverFilters.tvShortSeries ? 50 : limit * 2)) break;

        const baseUrl = `/discover/${mediaType}?language=sv-SE&include_adult=false&sort_by=${sortBy}&vote_count.gte=${voteCountMin}${voteCountMaxParam}${voteAvgParam}&page=${p}${watchParam}${withoutGenreParam}${withoutKeywordParam}${yearParam}${originCountryParam}${originalLangParam}${companyParam}${variantExtra}`;
        let url = `${baseUrl}${genreParam}${keywordParam}`;

        let data: { results?: Array<Record<string, unknown>> } | null = null;
        try {
          data = (await fetchFromTmdbApi(url, tmdbKey)) as {
            results?: Array<Record<string, unknown>>;
          };
        } catch {
          continue;
        }

        // On subsequent pages (p > initialPage), never relax/drop strict filters; stop paging instead
        if (p > initialPage && (!data?.results || data.results.length === 0)) {
          break;
        }

        // Fallback 0: if multiple AND-joined keywords yielded < 5 hits, step down softly to OR-joined keywords BEFORE dropping keywords!
        if (
          (!data?.results || data.results.length < 5) &&
          softOrKeywordParam
        ) {
          const softUrl = `${baseUrl}${genreParam}${softOrKeywordParam}`;
          try {
            const softData = (await fetchFromTmdbApi(softUrl, tmdbKey)) as {
              results?: Array<Record<string, unknown>>;
            };
            if (softData?.results && softData.results.length > (data?.results?.length || 0)) {
              const existing = data?.results || [];
              const existingIds = new Set(existing.map((r) => r.id));
              data = {
                results: [
                  ...existing,
                  ...softData.results.filter((r) => !existingIds.has(r.id)),
                ],
              };
            }
          } catch {
            // Keep existing
          }
        }

        // Fallback 1: if keyword filter still yielded 0 hits, relax keyword filter ONLY when keywords are NOT strict thematic identifiers (e.g. never drop Superhero/Zombie/Space keywords into generic Sci-Fi/Fantasy!)
        if (
          p === initialPage &&
          (!data?.results || data.results.length === 0) &&
          keywordParam &&
          !discoverFilters.strictKeywords
        ) {
          const relaxedUrl = `${baseUrl}${genreParam}`;
          try {
            data = (await fetchFromTmdbApi(relaxedUrl, tmdbKey)) as {
              results?: Array<Record<string, unknown>>;
            };
          } catch {
            // Keep empty
          }
        }

        // Fallback 2: if TV with_type=2 (Miniseries) yielded 0 hits, retry without with_type=2
        if (
          (!data?.results || data.results.length === 0) &&
          mediaType === "tv" &&
          discoverFilters.tvMiniseriesOnly
        ) {
          const noTypeUrl = url.replace("&with_type=2", "");
          try {
            data = (await fetchFromTmdbApi(noTypeUrl, tmdbKey)) as {
              results?: Array<Record<string, unknown>>;
            };
          } catch {
            // Keep empty
          }
        }

        // Fallback 3: if strict combination yielded 0 hits and we had 3+ rules, relax to the first 2 rules
        if (
          (!data?.results || data.results.length === 0) &&
          (ruleTokens.length > 2 || !hasProviders)
        ) {
          const relaxedParam =
            ruleTokens.length > 2
              ? `&with_genres=${encodeURIComponent(
                  ruleTokens.slice(0, 2).join(",")
                )}`
              : genreParam;
          const relaxedWatchParam = hasProviders
            ? watchParam
            : "&watch_region=SE&with_watch_monetization_types=flatrate|free|ads|rent|buy";
          const fallbackVoteCount = hasProviders ? 15 : 40;
          const fallbackUrl = `/discover/${mediaType}?language=sv-SE&include_adult=false&sort_by=${sortBy}&vote_count.gte=${fallbackVoteCount}&page=${p}${relaxedWatchParam}${relaxedParam}${withoutGenreParam}${withoutKeywordParam}${yearParam}${originCountryParam}${originalLangParam}${variantExtra}`;
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
          const dateStr = String(hit.release_date || hit.first_air_date || "");
          // Strictly skip unreleased future titles or dateless stubs
          if (!dateStr || dateStr > todayStr) {
            continue;
          }

          const title = String(hit.title || hit.name || "").trim();
          const originalTitle = String(
            hit.original_title || hit.original_name || title
          ).trim();
          const originalLanguage = String(hit.original_language || "").trim();

          // Strictly skip titles that were already shown/swiped
          const t1 = normalizeMovieTitle(title);
          const t2 = originalTitle ? normalizeMovieTitle(originalTitle) : "";
          if (
            (t1 && previousNorms.has(t1)) ||
            (t2 && previousNorms.has(t2))
          ) {
            continue;
          }

          const year = dateStr.slice(0, 4);
          const rawGenreIds = Array.isArray(hit.genre_ids)
            ? hit.genre_ids
                .map(Number)
                .filter((n) => !Number.isNaN(n) && n > 0)
            : [];
          const tmdbGenres = mapTmdbGenreIdsToNames(rawGenreIds);
          const voteAverage =
            typeof hit.vote_average === "number" && hit.vote_average > 0
              ? Math.round(hit.vote_average * 10) / 10
              : 7.5;
          const posterPath = hit.poster_path
            ? String(hit.poster_path)
            : undefined;
          const overview = String(hit.overview || "").trim();
          const genreSummary =
            tmdbGenres.length > 0
              ? tmdbGenres.slice(0, 2).join(" och ").toLowerCase()
              : "dina valda kategorier";

          const motivation =
            overview.length > 30 && isLikelySwedishText(overview)
              ? overview
              : hasProviders
              ? `Hyllad titel inom ${genreSummary} som ingår på ${selectedServices.join(
                  ", "
                )} i Sverige och matchar kvällens val med högt publikbetyg (${voteAverage}/10).`
              : `Hyllad och topprankad titel inom ${genreSummary} som matchar kvällens val och din smakprofil (${voteAverage}/10 på TMDB).`;

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
            originalLanguage: originalLanguage || undefined,
            year: year || "2023",
            mediaType,
            runtime: mediaType === "tv" ? "TV-serie" : "Film",
            matchPercentage: Math.min(
              89,
              Math.max(81, Math.round(79 + (voteAverage || 7.5)))
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
    }

    // Quality-weighted ranking: prefer critically acclaimed hits (higher TMDB rating) while keeping strong popularity
    discovered.sort((a, b) => {
      const ratingA = a.tmdbRating || 7.0;
      const ratingB = b.tmdbRating || 7.0;
      if (Math.abs(ratingB - ratingA) >= 0.35) {
        return ratingB - ratingA;
      }
      return (b.matchPercentage || 0) - (a.matchPercentage || 0);
    });

    // Deduplicate discovered pool by tmdbId, normalized title, AND max 1 per franchise (e.g. max 1 Harry Potter / Toy Story / Vaiana)
    const seenIds = new Set<number>();
    const seenTitleNorms = new Set<string>();
    const seenFranchises = new Set<string>();
    const franchiseOverflow: typeof discovered = [];
    const dedupedDiscovered: typeof discovered = [];
    for (const d of discovered) {
      if (d.tmdbId && seenIds.has(d.tmdbId)) continue;
      const tNorm = normalizeMovieTitle(d.title);
      if (tNorm && seenTitleNorms.has(tNorm)) continue;
      if (d.tmdbId) seenIds.add(d.tmdbId);
      if (tNorm) seenTitleNorms.add(tNorm);

      const fKey = getMovieFranchiseKey(d.title, d.originalTitle);
      if (fKey && seenFranchises.has(fKey)) {
        franchiseOverflow.push(d);
        continue;
      }
      if (fKey) seenFranchises.add(fKey);
      dedupedDiscovered.push(d);
    }
    // Only append franchise overflow if we don't even have enough unique franchises to fill the list
    if (dedupedDiscovered.length < limit && franchiseOverflow.length > 0) {
      dedupedDiscovered.push(...franchiseOverflow);
    }

    // Enrich top candidates with TMDB details when series-length, movie-runtime, or non-Latin title resolution is needed
    const inspectLimit = discoverFilters.tvShortSeries ? 40 : Math.max(limit, 18);
    const toInspect = dedupedDiscovered.slice(0, inspectLimit);
    const enrichedDiscovered = await Promise.all(
      toInspect.map(async (item) => {
        const needsLatinTitle = hasNonLatinScript(item.title);
        const shouldFetchTv =
          item.mediaType === "tv" && (needsSeriesDetails || needsLatinTitle);
        const shouldFetchMovie =
          item.mediaType === "movie" &&
          (needsMovieRuntimeDetails || needsLatinTitle);

        if (!shouldFetchTv && !shouldFetchMovie) {
          return item;
        }

        let updatedTitle = item.title;
        if (needsLatinTitle && item.tmdbId) {
          const enTitle = await fetchTmdbEnglishTitle(
            item.tmdbId,
            item.mediaType === "tv" ? "tv" : "movie",
            tmdbKey
          );
          if (enTitle) updatedTitle = enTitle;
        }

        if (shouldFetchTv && item.tmdbId) {
          try {
            const tvDetails = (await fetchFromTmdbApi(
              `/tv/${item.tmdbId}?language=sv-SE`,
              tmdbKey
            )) as {
              number_of_seasons?: number;
              seasons?: Array<{ season_number: number }>;
              status?: string;
              episode_run_time?: number[];
              last_episode_to_air?: { runtime?: number };
            };
            let seasonCount =
              typeof tvDetails?.number_of_seasons === "number" &&
              tvDetails.number_of_seasons > 0
                ? tvDetails.number_of_seasons
                : undefined;
            if (!seasonCount && Array.isArray(tvDetails?.seasons)) {
              const valid = tvDetails.seasons.filter((s) => s.season_number > 0);
              if (valid.length > 0) seasonCount = valid.length;
            }
            const epList = Array.isArray(tvDetails?.episode_run_time)
              ? tvDetails.episode_run_time.filter((n) => typeof n === "number" && n > 0)
              : [];
            const epRuntime =
              epList.length > 0
                ? Math.round(epList.reduce((a, b) => a + b, 0) / epList.length)
                : typeof tvDetails?.last_episode_to_air?.runtime === "number" &&
                  tvDetails.last_episode_to_air.runtime > 0
                ? tvDetails.last_episode_to_air.runtime
                : undefined;
            const tvStatus = tvDetails?.status ? String(tvDetails.status) : undefined;
            const rtParts: string[] = [];
            if (seasonCount) {
              rtParts.push(seasonCount === 1 ? "1 säsong" : `${seasonCount} säsonger`);
            }
            if (epRuntime) {
              rtParts.push(`${epRuntime} min/avsnitt`);
            }
            return {
              ...item,
              title: updatedTitle,
              seasonCount: seasonCount ?? getSeriesSeasonCount(updatedTitle),
              episodeRuntimeMinutes: epRuntime,
              tvStatus,
              runtime: rtParts.length > 0 ? rtParts.join(" · ") : item.runtime,
            };
          } catch {
            return { ...item, title: updatedTitle };
          }
        }

        if (shouldFetchMovie && item.tmdbId) {
          try {
            const movieDetails = (await fetchFromTmdbApi(
              `/movie/${item.tmdbId}?language=sv-SE`,
              tmdbKey
            )) as { runtime?: number };
            const runtimeMinutes =
              typeof movieDetails?.runtime === "number" && movieDetails.runtime > 0
                ? movieDetails.runtime
                : undefined;
            const formattedRt = formatRuntimeMinutes(runtimeMinutes);
            return {
              ...item,
              title: updatedTitle,
              runtimeMinutes,
              runtime: formattedRt || item.runtime,
            };
          } catch {
            return { ...item, title: updatedTitle };
          }
        }

        return { ...item, title: updatedTitle };
      })
    );

    let verifiedDiscovered = filterAndVerifyMoviesByTmdbCategories(
      enrichedDiscovered,
      effectivePreferences
    );
    if (dislikedCategories.length > 0) {
      verifiedDiscovered = filterOutDislikedCategories(
        verifiedDiscovered,
        dislikedCategories
      );
    }
    // Final check against previous titles and drop any remaining untranslated non-Latin titles if enough Latin titles exist
    verifiedDiscovered = verifiedDiscovered.filter((m) => {
      const t1 = normalizeMovieTitle(m.title);
      const t2 = m.originalTitle ? normalizeMovieTitle(m.originalTitle) : "";
      return !previousNorms.has(t1) && (!t2 || !previousNorms.has(t2));
    });

    const latinOnly = verifiedDiscovered.filter((m) => !hasNonLatinScript(m.title));
    if (latinOnly.length >= Math.min(5, limit)) {
      verifiedDiscovered = latinOnly;
    }

    verifiedDiscovered = limitAnimatedRecommendations(
      verifiedDiscovered,
      effectivePreferences,
      1,
      watchedMovies
    );

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
      // Search without strict year lock first so ±1 year festival/premiere offsets
      // (e.g. The Gentlemen 2019 vs 2020) never exclude the real film in favor of obscure stubs
      const broadData = (await fetchFromTmdbApi(
        `/search/${type}?query=${encodeURIComponent(title)}&language=sv-SE`,
        tmdbKey
      )) as { results?: Array<Record<string, unknown>> };
      let combinedResults: Array<Record<string, unknown>> = Array.isArray(
        broadData?.results
      )
        ? [...broadData.results]
        : [];

      // If a specific year was requested and none of the broad hits is a well-known match
      // within ±1 year (e.g. Swedish title differs from English query like "Parasit" vs "Parasite",
      // or an older classic sharing a common title), also query the year-filtered endpoint
      if (cleanYear) {
        const targetNum = Number(cleanYear);
        const hasStrongNearYearHit = combinedResults.some((r) => {
          const y = Number(
            String(r.release_date || r.first_air_date || "").slice(0, 4)
          );
          const votes = typeof r.vote_count === "number" ? r.vote_count : 0;
          return y > 1900 && Math.abs(y - targetNum) <= 1 && votes >= 50;
        });
        if (!hasStrongNearYearHit) {
          const yearParam =
            type === "tv"
              ? `&first_air_date_year=${encodeURIComponent(cleanYear)}`
              : `&year=${encodeURIComponent(cleanYear)}`;
          const yearData = (await fetchFromTmdbApi(
            `/search/${type}?query=${encodeURIComponent(title)}${yearParam}&language=en-US`,
            tmdbKey
          )) as { results?: Array<Record<string, unknown>> };
          if (Array.isArray(yearData?.results)) {
            const seenIds = new Set(combinedResults.map((r) => r.id));
            for (const yr of yearData.results) {
              if (!seenIds.has(yr.id)) {
                combinedResults.push(yr);
                seenIds.add(yr.id);
              }
            }
          }
        }
      }

      const candidate = pickBestTmdbCandidate(combinedResults, cleanYear, title);

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
    let ageRating = curated.ageRating;
    let runtimeMinutes = curated.runtimeMinutes;
    let episodeRuntimeMinutes = curated.episodeRuntimeMinutes;
    let tvStatus = curated.tvStatus;
    let seasonCount = curated.seasonCount;
    const originalLanguage =
      typeof topHit.original_language === "string" && topHit.original_language
        ? topHit.original_language
        : curated.originalLanguage;

    const [providersRes, ageRes, detailsRes] = await Promise.allSettled([
      fetchFromTmdbApi(`/${resolvedType}/${tmdbId}/watch/providers`, tmdbKey),
      fetchTmdbAgeRating(tmdbId, resolvedType, tmdbKey),
      fetchFromTmdbApi(`/${resolvedType}/${tmdbId}?language=sv-SE`, tmdbKey),
    ]);
    if (providersRes.status === "fulfilled") {
      const providersData = providersRes.value as {
        results?: Record<string, unknown>;
      };
      const seObj = providersData?.results?.SE;
      swedishProviders = parseTmdbSwedishProviders(seObj);
    }
    if (ageRes.status === "fulfilled" && ageRes.value) {
      ageRating = ageRes.value;
    }

    let hitTitle = String(topHit.title || topHit.name || title);
    const hitOriginal = String(
      topHit.original_title || topHit.original_name || hitTitle
    );
    if (hasNonLatinScript(hitTitle)) {
      const enTitle = await fetchTmdbEnglishTitle(tmdbId, resolvedType, tmdbKey);
      if (enTitle) hitTitle = enTitle;
    }

    const rawGenreIds = Array.isArray(topHit.genre_ids)
      ? topHit.genre_ids.map(Number).filter((n) => !Number.isNaN(n) && n > 0)
      : [];
    const tmdbGenreIds =
      rawGenreIds.length > 0 ? rawGenreIds : curated.tmdbGenreIds;
    const tmdbGenres =
      tmdbGenreIds && tmdbGenreIds.length > 0
        ? mapTmdbGenreIdsToNames(tmdbGenreIds)
        : curated.tmdbGenres;

    if (resolvedType === "tv") {
      seasonCount = getSeriesSeasonCount(hitTitle);
      if (detailsRes.status === "fulfilled" && detailsRes.value) {
        const tvDetails = detailsRes.value as {
          number_of_seasons?: number;
          seasons?: Array<{ season_number: number }>;
          status?: string;
          episode_run_time?: number[];
          last_episode_to_air?: { runtime?: number };
        };
        if (
          typeof tvDetails?.number_of_seasons === "number" &&
          tvDetails.number_of_seasons > 0
        ) {
          seasonCount = tvDetails.number_of_seasons;
        } else if (Array.isArray(tvDetails?.seasons)) {
          const valid = tvDetails.seasons.filter((s) => s.season_number > 0);
          if (valid.length > 0) seasonCount = valid.length;
        }
        if (tvDetails?.status) {
          tvStatus = String(tvDetails.status);
        }
        const epList = Array.isArray(tvDetails?.episode_run_time)
          ? tvDetails.episode_run_time.filter(
              (n) => typeof n === "number" && n > 0
            )
          : [];
        if (epList.length > 0) {
          episodeRuntimeMinutes = Math.round(
            epList.reduce((a, b) => a + b, 0) / epList.length
          );
        } else if (
          typeof tvDetails?.last_episode_to_air?.runtime === "number" &&
          tvDetails.last_episode_to_air.runtime > 0
        ) {
          episodeRuntimeMinutes = tvDetails.last_episode_to_air.runtime;
        }
      }
    } else if (detailsRes.status === "fulfilled" && detailsRes.value) {
      const movieDetails = detailsRes.value as { runtime?: number };
      if (
        typeof movieDetails?.runtime === "number" &&
        movieDetails.runtime > 0
      ) {
        runtimeMinutes = movieDetails.runtime;
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
      runtimeMinutes,
      episodeRuntimeMinutes,
      tvStatus,
      originalLanguage,
      ageRating: ageRating || inferAgeRatingFromGenres(tmdbGenreIds),
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
                const rawGenreIds = Array.isArray(hit.genre_ids)
                  ? hit.genre_ids
                      .map(Number)
                      .filter((n) => !Number.isNaN(n) && n > 0)
                  : [];
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
                  tmdbGenreIds: rawGenreIds.length > 0 ? rawGenreIds : curated.tmdbGenreIds,
                  ageRating:
                    curated.ageRating || inferAgeRatingFromGenres(rawGenreIds),
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
        dismissedMovies = [],
      } = req.body as {
        watchedMovies: WatchedMovie[];
        watchlist: MovieRecommendation[];
        tasteProfileSummary: string;
        preferences: EveningPreferences;
        previousTitles?: string[];
        limit?: number;
        dislikedCategories?: string[];
        dismissedMovies?: DismissedMovie[];
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
          ? Math.max(12, requestedLimit + 5)
          : Math.max(10, requestedLimit + 5);

      const effectiveMediaType = resolveEffectiveMediaType(preferences);
      const effectivePreferences: EveningPreferences = {
        ...preferences,
        mediaType: effectiveMediaType,
      };

      const hasSteering = Boolean(effectivePreferences.steering?.anchorMovie?.title);
      const dismissedTitleStrings = (dismissedMovies || []).flatMap((d) =>
        d.originalTitle && d.originalTitle !== d.title
          ? [d.title, d.originalTitle]
          : [d.title]
      );
      const effectivePreviousTitles = [
        ...(previousTitles || []),
        ...dismissedTitleStrings,
        ...(hasSteering && effectivePreferences.steering?.anchorMovie?.title
          ? [
              effectivePreferences.steering.anchorMovie.title,
              ...(effectivePreferences.steering.anchorMovie.originalTitle
                ? [effectivePreferences.steering.anchorMovie.originalTitle]
                : []),
            ]
          : []),
      ];
      const verificationPreferences: EveningPreferences = hasSteering
        ? {
            ...effectivePreferences,
            genres: [],
            contents: [],
            frameworks: [],
            moods: [],
          }
        : effectivePreferences;

      // Helper to merge TMDB enrichment cleanly into a recommendation object
      const enrichRec = async (
        rec: MovieRecommendation
      ): Promise<MovieRecommendation> => {
        const needsDetails =
          (rec.mediaType === "tv" && rec.seasonCount === undefined) ||
          (rec.mediaType === "movie" &&
            rec.runtimeMinutes === undefined &&
            hasMovieLengthFilter(verificationPreferences));
        if (
          !needsDetails &&
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
        const finalMediaType =
          effectiveMediaType === "tv"
            ? "tv"
            : effectiveMediaType === "movie"
            ? "movie"
            : rec.mediaType || meta.mediaType || "movie";
        const finalSeasonCount =
          finalMediaType === "tv"
            ? meta.seasonCount ?? rec.seasonCount
            : undefined;
        const finalRuntimeMinutes = meta.runtimeMinutes ?? rec.runtimeMinutes;
        const finalEpRuntime =
          meta.episodeRuntimeMinutes ?? rec.episodeRuntimeMinutes;
        const finalTvStatus = meta.tvStatus ?? rec.tvStatus;

        let finalRuntime = rec.runtime;
        if (
          finalMediaType === "movie" &&
          finalRuntimeMinutes &&
          (!finalRuntime || finalRuntime === "Film")
        ) {
          finalRuntime =
            formatRuntimeMinutes(finalRuntimeMinutes) || finalRuntime;
        } else if (
          finalMediaType === "tv" &&
          finalSeasonCount &&
          (!finalRuntime || finalRuntime === "TV-serie")
        ) {
          finalRuntime =
            finalSeasonCount === 1
              ? "1 säsong"
              : `${finalSeasonCount} säsonger`;
          if (finalEpRuntime) {
            finalRuntime += ` · ${finalEpRuntime} min/avsnitt`;
          }
        }

        const finalTitle =
          hasNonLatinScript(rec.title) && meta.title && !hasNonLatinScript(meta.title)
            ? meta.title
            : rec.title;

        return {
          ...rec,
          title: finalTitle,
          year: meta.year || rec.year,
          runtime: finalRuntime,
          runtimeMinutes: finalRuntimeMinutes,
          mediaType: finalMediaType,
          seasonCount: finalSeasonCount,
          episodeRuntimeMinutes: finalEpRuntime,
          tvStatus: finalTvStatus,
          originalLanguage: meta.originalLanguage || rec.originalLanguage,
          tmdbId: meta.tmdbId || rec.tmdbId,
          posterPath: finalPoster,
          tmdbRating: finalRating,
          swedishProviders: finalProviders,
          tmdbGenreIds: meta.tmdbGenreIds || rec.tmdbGenreIds,
          tmdbGenres: meta.tmdbGenres || rec.tmdbGenres,
          ageRating: meta.ageRating || rec.ageRating,
        };
      };

      let discoveredPool: MovieRecommendation[] = [];
      let collaborativePool: MovieRecommendation[] = [];
      let hybridCandidatePool: MovieRecommendation[] = [];

      if (tmdbKey) {
        const [discRes, collabRes] = await Promise.all([
          discoverTmdbCandidates(
            verificationPreferences,
            selectedServices,
            tmdbKey,
            20,
            dislikedCategories,
            effectivePreviousTitles,
            requestPage,
            watchedMovies
          ),
          fetchCollaborativeTmdbCandidates(
            watchedMovies,
            verificationPreferences,
            tmdbKey,
            dislikedCategories,
            effectivePreviousTitles,
            requestPage,
            25
          ),
        ]);
        discoveredPool = discRes;
        collaborativePool = collabRes;

        // When streaming services are selected, verify Swedish watch providers for top
        // collaborative candidates not already present in the streaming-filtered Discover pool
        if (selectedServices.length > 0 && collaborativePool.length > 0) {
          const discoveredIds = new Set(
            discoveredPool
              .filter((d) => d.tmdbId)
              .map((d) => `${d.mediaType || "movie"}:${d.tmdbId}`)
          );
          const toCheck = collaborativePool.slice(0, 15);
          const checked = await Promise.all(
            toCheck.map(async (item) => {
              const idKey = `${item.mediaType || "movie"}:${item.tmdbId}`;
              if (discoveredIds.has(idKey)) return item;
              if (!item.tmdbId) return item;
              const providers = await fetchTmdbSwedishProvidersCached(
                item.tmdbId,
                item.mediaType === "tv" ? "tv" : "movie",
                tmdbKey
              );
              return providers ? { ...item, swedishProviders: providers } : item;
            })
          );
          collaborativePool = [...checked, ...collaborativePool.slice(15)];
        }

        hybridCandidatePool = buildHybridCandidatePool({
          collaborativeCandidates: collaborativePool,
          discoveredCandidates: discoveredPool,
          watchedMovies,
          watchlist,
          previousTitles: effectivePreviousTitles,
          dislikedCategories,
          preferences: verificationPreferences,
          maxCandidates: 30,
        });
      }

      if (ai) {
        const systemInstruction = buildRecommendationSystemPrompt(
          watchedMovies,
          watchlist,
          tasteProfileSummary,
          effectivePreferences,
          effectivePreviousTitles,
          dislikedCategories,
          candidateTargetCount,
          dismissedMovies
        );

        const candidatePoolPromptBlock = formatCandidatePoolForPrompt(
          hybridCandidatePool,
          {
            selectedServices,
            hasSteering,
            hasCustomText: Boolean(effectivePreferences.customText?.trim()),
            maxItems: 28,
          }
        );

        const isTasteProfileOnly =
          !hasSteering &&
          (effectivePreferences.moods || []).length === 0 &&
          (effectivePreferences.genres || []).length === 0 &&
          (effectivePreferences.contents || []).length === 0 &&
          (effectivePreferences.frameworks || []).length === 0 &&
          !effectivePreferences.customText;

        const chosenCategoriesList = [
          ...formatSelectedChipsWithContext(effectivePreferences.genres, GENRE_GROUPS),
          ...formatSelectedChipsWithContext(effectivePreferences.contents, CONTENT_GROUPS),
          ...formatSelectedChipsWithContext(effectivePreferences.moods, MOOD_GROUPS),
          ...formatSelectedChipsWithContext(
            effectivePreferences.frameworks,
            SETTING_GROUPS
          ),
        ];

        const steeringPromptLines = buildSteeringPromptLines(
          effectivePreferences.steering
        );
        const steeringUserPrompt =
          hasSteering && effectivePreferences.steering?.anchorMovie
            ? `STYRNING FRÅN VALD FILM (HÖGSTA PRIORITET): Användaren valde "${
                effectivePreferences.steering.anchorMovie.title
              }" som riktning och vill söka vidare därifrån.${
                steeringPromptLines.length > 0
                  ? ` FÖLJ SAMTLIGA DESSA KRAV FÖR ALLA ${candidateTargetCount} FÖRSLAG: ${steeringPromptLines.join(
                      " | "
                    )}`
                  : " Behåll liknande känsla och kvalitet."
              } Alla ${candidateTargetCount} förslag MÅSTE kännas som en naturlig vidareutveckling från "${
                effectivePreferences.steering.anchorMovie.title
              }" i exakt denna riktning, och i "whyYouWillLikeIt" ska du tydligt förklara kopplingen till "${
                effectivePreferences.steering.anchorMovie.title
              }"!`
            : "";

        const userPrompt = `Ta fram ${candidateTargetCount} skräddarsydda rekommendationer för användaren. ${
          hasSteering
            ? steeringUserPrompt
            : isTasteProfileOnly
            ? `HÅRT FOKUS PÅ PERSONLIG SMAKPROFIL: Rekommendera titlar uteslutande baserat på användarens unika smakprofil, högt betygsatta favoriter och undvik det hen ogillar.
VIKTIG REGEL MOT KLYSCHOR & UPPENBARA STANDARDVAL: Föreslå INTE bara de mest förutsägbara mainstream-klassikerna (som The Dark Knight, Inception, Interstellar, Gladiator, Fight Club eller Pulp Fiction) som nästan alla filmintresserade redan har sett. Gräv djupare! Ge användaren en inspirerande, varierad och personlig mix av högklassiga filmer och serier – både hyllade mästerverk, moderna pärlor och dolda guldkorn – som fångar exakt den regi, ton, atmosfär, nerv och tematik som användaren älskar i sina 4- och 5-stjärniga betyg!`
            : `Alla ${candidateTargetCount} titlar MÅSTE 100% matcha användarens valda kategorier, genrer, innehåll och stämning under KVÄLLENS VAL.`
        }${
          !hasSteering && chosenCategoriesList.length > 1
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
              )}. Föreslå ALDRIG en titel som bara finns på andra streamingtjänster!`
            : ""
        }${candidatePoolPromptBlock} Om användarens val tydligt pekar på en specifik titel (även om den redan är sedd), sätt den som #1 med isExactPinpointMatch: true. Annars ska du aldrig föreslå titlar som redan finns i sedda eller i watchlist. Svara ENDAST med en giltig JSON-array med ${candidateTargetCount} objekt.`;

        try {
          const dynamicTemp = resolveRecommendationTemperature(effectivePreferences);
          const rawText = await callGeminiWithFallback(ai, {
            contents: userPrompt,
            systemInstruction,
            temperature: dynamicTemp,
            responseMimeType: "application/json",
            responseSchema: RECOMMENDATIONS_RESPONSE_SCHEMA,
            label: "recommendations",
          });

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
                  effectiveMediaType === "tv"
                    ? "tv"
                    : effectiveMediaType === "movie"
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
                  ageRating: normalizeSwedishAgeRating(
                    typeof item.ageRating === "string" ? item.ageRating : undefined
                  ),
                  matchPercentage: Math.min(
                    99,
                    Math.max(85, Number(item.matchPercentage) || 93)
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
        } catch (parseErr) {
          console.warn(
            "[Gemini:recommendations] Failed to parse JSON response:",
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          );
        }
      }

      // Deduplicate AI recommendations FIRST without mixing generic discoveredPool into them
      let uniqueAiRecs = filterDuplicateRecommendations(
        recommendations,
        watchedMovies,
        watchlist,
        effectivePreviousTitles
      ).slice(0, candidateTargetCount);

      // Pre-hydrate AI picks that were selected from hybridCandidatePool with already-verified TMDB metadata
      if (hybridCandidatePool.length > 0 && uniqueAiRecs.length > 0) {
        const poolByNorm = new Map<string, MovieRecommendation>();
        for (const p of hybridCandidatePool) {
          const n1 = normalizeMovieTitle(p.title);
          const n2 = p.originalTitle ? normalizeMovieTitle(p.originalTitle) : "";
          if (n1 && !poolByNorm.has(n1)) poolByNorm.set(n1, p);
          if (n2 && !poolByNorm.has(n2)) poolByNorm.set(n2, p);
        }
        uniqueAiRecs = uniqueAiRecs.map((rec) => {
          const match =
            poolByNorm.get(normalizeMovieTitle(rec.title)) ||
            (rec.originalTitle
              ? poolByNorm.get(normalizeMovieTitle(rec.originalTitle))
              : undefined);
          if (!match) return rec;
          return {
            ...rec,
            tmdbId: rec.tmdbId || match.tmdbId,
            posterPath: rec.posterPath || match.posterPath,
            tmdbRating: rec.tmdbRating || match.tmdbRating,
            swedishProviders:
              rec.swedishProviders && rec.swedishProviders.providers.length > 0
                ? rec.swedishProviders
                : match.swedishProviders,
            tmdbGenreIds: rec.tmdbGenreIds || match.tmdbGenreIds,
            tmdbGenres: rec.tmdbGenres || match.tmdbGenres,
            seasonCount: rec.seasonCount ?? match.seasonCount,
            runtimeMinutes: rec.runtimeMinutes ?? match.runtimeMinutes,
            episodeRuntimeMinutes:
              rec.episodeRuntimeMinutes ?? match.episodeRuntimeMinutes,
            tvStatus: rec.tvStatus ?? match.tvStatus,
            originalLanguage: rec.originalLanguage || match.originalLanguage,
            recommendedFromSeeds: match.recommendedFromSeeds,
          };
        });
      }

      // Enrich AI candidates with TMDB metadata (including seasonCount, runtimeMinutes, tvStatus)
      const enrichedAiCandidates = await Promise.all(
        uniqueAiRecs.map((rec) => enrichRec(rec))
      );

      // Step 1: Verify AI candidates against official TMDB categories, release year, runtime & seasonCount
      let verifiedCandidates: MovieRecommendation[] =
        limitAnimatedRecommendations(
          filterAndVerifyMoviesByTmdbCategories(
            enrichedAiCandidates,
            verificationPreferences
          ),
          effectivePreferences,
          1,
          watchedMovies
        );

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

      // Step 3: ONLY if fewer than requestedLimit AI candidates survived, top up with 100% verified titles
      if (verifiedCandidates.length < requestedLimit) {
        // Priority 3A: Top up from Hybrid candidate pool (collaborative favorites + Discover, strictly verified)
        const primaryTopUpPool =
          hybridCandidatePool.length > 0 ? hybridCandidatePool : discoveredPool;
        if (primaryTopUpPool.length > 0) {
          const existingTitles = new Set([
            ...watchedMovies.map((m) => normalizeMovieTitle(m.title)),
            ...watchlist.map((m) => normalizeMovieTitle(m.title)),
            ...verifiedCandidates.map((m) => normalizeMovieTitle(m.title)),
            ...(effectivePreviousTitles || []).map((t) => normalizeMovieTitle(t)),
          ]);
          const unusedPool = primaryTopUpPool.filter((d) => {
            const t1 = normalizeMovieTitle(d.title);
            const t2 = normalizeMovieTitle(d.originalTitle);
            return !existingTitles.has(t1) && !existingTitles.has(t2);
          });
          let verifiedPool = filterAndVerifyMoviesByTmdbCategories(
            unusedPool,
            verificationPreferences
          );
          if (dislikedCategories.length > 0) {
            verifiedPool = filterOutDislikedCategories(
              verifiedPool,
              dislikedCategories
            );
          }
          for (const cand of verifiedPool) {
            if (verifiedCandidates.length >= requestedLimit) break;
            verifiedCandidates.push(cand);
            existingTitles.add(normalizeMovieTitle(cand.title));
          }
        }

        // Priority 3B: If still fewer than requestedLimit, do a broader discover preserving hard length & era rules
        if (verifiedCandidates.length < requestedLimit && tmdbKey) {
          try {
            const preservedMoods = (effectivePreferences.moods || []).filter((m) =>
              [
                "Max 90 min",
                "Max 90 minuter",
                "Max 2 tim",
                "Max 2 timmar",
                "Över 2 tim",
                "2+ timmar (Långfilm)",
                "Miniserie",
                "1–2 säsonger",
                "3–5 säsonger",
                "6+ säsonger",
                "Korta avsnitt",
                "Avslutad serie",
                "Serielängd",
              ].includes(m)
            );
            const preservedFrameworks = (effectivePreferences.frameworks || []).filter(
              (f) =>
                [
                  "2020-talet",
                  "2010-talet",
                  "2000-talet",
                  "1990-talet",
                  "1980-talet",
                  "Före 1980",
                  "Nyare än 2015",
                  "Klassiker",
                  "Sverige",
                  "Norden",
                  "Sverige & Norden",
                  "Europa",
                  "Stockholm",
                  "London",
                  "Tokyo",
                ].includes(f)
            );
            const broaderPrefs: EveningPreferences = {
              ...effectivePreferences,
              moods: preservedMoods,
              frameworks: preservedFrameworks,
            };
            const broaderPool = await discoverTmdbCandidates(
              broaderPrefs,
              selectedServices,
              tmdbKey,
              20,
              dislikedCategories,
              effectivePreviousTitles,
              requestPage + 1
            );
            let verifiedBroader = filterAndVerifyMoviesByTmdbCategories(
              broaderPool,
              broaderPrefs
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
              ...(effectivePreviousTitles || []).map((t) => normalizeMovieTitle(t)),
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
            effectivePreferences,
            dislikedCategories,
            effectivePreviousTitles
          );
          const enrichedExtra = await Promise.all(
            extraFallbacks.map((rec) => enrichRec(rec))
          );
          let verifiedExtra: MovieRecommendation[] =
            filterAndVerifyMoviesByTmdbCategories(
              enrichedExtra,
              verificationPreferences
            );
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
            effectivePreviousTitles
          );
        }
      }

      // Final safeguard: if verifiedCandidates is still completely empty, supply smart fallbacks
      if (verifiedCandidates.length === 0) {
        verifiedCandidates = generateSmartFallbackRecommendations(
          watchedMovies,
          watchlist,
          effectivePreferences,
          dislikedCategories,
          effectivePreviousTitles
        );
      }

      if (dislikedCategories.length > 0) {
        verifiedCandidates = filterOutDislikedCategories(
          verifiedCandidates,
          dislikedCategories
        );
      }

      // Strict guarantee: never re-serve a movie present in previousTitles (or anchor movie), deduplicate by normalized title, AND enforce max 1 movie per franchise
      const previousNorms = new Set(
        (effectivePreviousTitles || [])
          .map((t) => normalizeMovieTitle(t))
          .filter(Boolean)
      );
      const dedupeVerified = (list: MovieRecommendation[], enforceFranchise = true) => {
        const seen = new Set<string>();
        const seenFranchises = new Set<string>();
        return list.filter((m) => {
          const t1 = normalizeMovieTitle(m.title);
          const t2 = m.originalTitle ? normalizeMovieTitle(m.originalTitle) : "";
          if (previousNorms.has(t1) || (t2 && previousNorms.has(t2))) return false;
          if (t1 && seen.has(t1)) return false;
          if (enforceFranchise && !m.isExactPinpointMatch) {
            const fKey = getMovieFranchiseKey(m.title, m.originalTitle);
            if (fKey && seenFranchises.has(fKey)) return false;
            if (fKey) seenFranchises.add(fKey);
          }
          if (t1) seen.add(t1);
          return true;
        });
      };
      verifiedCandidates = limitAnimatedRecommendations(
        dedupeVerified(verifiedCandidates, true),
        effectivePreferences,
        1,
        watchedMovies
      );

      // If deduplication reduced count below requestedLimit, top up from remaining discoveredPool or fallbacks
      if (verifiedCandidates.length < requestedLimit) {
        const existingNorms = new Set([
          ...previousNorms,
          ...watchedMovies.map((m) => normalizeMovieTitle(m.title)),
          ...watchlist.map((m) => normalizeMovieTitle(m.title)),
          ...verifiedCandidates.map((m) => normalizeMovieTitle(m.title)),
        ]);
        const existingFranchises = new Set(
          verifiedCandidates
            .map((m) => getMovieFranchiseKey(m.title, m.originalTitle))
            .filter(Boolean)
        );
        const topUpSource =
          hybridCandidatePool.length > 0 ? hybridCandidatePool : discoveredPool;
        for (const d of topUpSource) {
          if (verifiedCandidates.length >= requestedLimit) break;
          const t1 = normalizeMovieTitle(d.title);
          const t2 = d.originalTitle ? normalizeMovieTitle(d.originalTitle) : "";
          const fKey = getMovieFranchiseKey(d.title, d.originalTitle);
          if (
            !existingNorms.has(t1) &&
            (!t2 || !existingNorms.has(t2)) &&
            (!fKey || !existingFranchises.has(fKey))
          ) {
            verifiedCandidates.push(d);
            existingNorms.add(t1);
            if (fKey) existingFranchises.add(fKey);
          }
        }
        if (verifiedCandidates.length < requestedLimit) {
          const lastResort = generateSmartFallbackRecommendations(
            watchedMovies,
            [...watchlist, ...verifiedCandidates],
            effectivePreferences,
            dislikedCategories,
            effectivePreviousTitles
          );
          for (const fb of lastResort) {
            if (verifiedCandidates.length >= requestedLimit) break;
            const t1 = normalizeMovieTitle(fb.title);
            const fKey = getMovieFranchiseKey(fb.title, fb.originalTitle);
            if (!existingNorms.has(t1) && (!fKey || !existingFranchises.has(fKey))) {
              verifiedCandidates.push(fb);
              existingNorms.add(t1);
              if (fKey) existingFranchises.add(fKey);
            }
          }
        }
        verifiedCandidates = limitAnimatedRecommendations(
        dedupeVerified(verifiedCandidates, true),
        effectivePreferences,
        1,
        watchedMovies
      );
      }

      const finalRecs = await Promise.all(
        verifiedCandidates.slice(0, requestedLimit).map(async (rec) => {
          let finalTitle = rec.title;
          if (hasNonLatinScript(finalTitle) && tmdbKey && rec.tmdbId) {
            const enTitle = await fetchTmdbEnglishTitle(
              rec.tmdbId,
              rec.mediaType === "tv" ? "tv" : "movie",
              tmdbKey
            );
            if (enTitle) finalTitle = enTitle;
          }
          let finalAgeRating = normalizeSwedishAgeRating(rec.ageRating);
          if (!finalAgeRating && tmdbKey && rec.tmdbId) {
            finalAgeRating = await fetchTmdbAgeRating(
              rec.tmdbId,
              rec.mediaType === "tv" ? "tv" : "movie",
              tmdbKey
            );
          }
          if (!finalAgeRating) {
            finalAgeRating = inferAgeRatingFromGenres(rec.tmdbGenreIds);
          }
          let finalSeasonCount = rec.seasonCount;
          if (rec.mediaType === "tv" && !finalSeasonCount) {
            if (tmdbKey && rec.tmdbId) {
              try {
                const tvDetails = (await fetchFromTmdbApi(
                  `/tv/${rec.tmdbId}?language=sv-SE`,
                  tmdbKey
                )) as { number_of_seasons?: number };
                if (
                  typeof tvDetails?.number_of_seasons === "number" &&
                  tvDetails.number_of_seasons > 0
                ) {
                  finalSeasonCount = tvDetails.number_of_seasons;
                }
              } catch {
                // Fallback below
              }
            }
            if (!finalSeasonCount) {
              finalSeasonCount = getSeriesSeasonCount(rec.title);
            }
          }
          let finalRuntime = rec.runtime;
          if (
            rec.mediaType === "movie" &&
            rec.runtimeMinutes &&
            (!finalRuntime || finalRuntime === "Film")
          ) {
            finalRuntime =
              formatRuntimeMinutes(rec.runtimeMinutes) || finalRuntime;
          } else if (
            rec.mediaType === "tv" &&
            finalSeasonCount &&
            (!finalRuntime || finalRuntime === "TV-serie")
          ) {
            finalRuntime =
              finalSeasonCount === 1
                ? "1 säsong"
                : `${finalSeasonCount} säsonger`;
          }
          let finalSwedishProviders = rec.swedishProviders;
          if (
            tmdbKey &&
            rec.tmdbId &&
            (!finalSwedishProviders ||
              finalSwedishProviders.type === "none" ||
              finalSwedishProviders.providers.length === 0)
          ) {
            const fetchedProviders = await fetchTmdbSwedishProvidersCached(
              rec.tmdbId,
              rec.mediaType === "tv" ? "tv" : "movie",
              tmdbKey
            );
            if (fetchedProviders && fetchedProviders.providers.length > 0) {
              finalSwedishProviders = fetchedProviders;
            }
          }
          return {
            ...rec,
            title: finalTitle,
            runtime: finalRuntime,
            seasonCount: rec.mediaType === "tv" ? finalSeasonCount : undefined,
            ageRating: finalAgeRating,
            swedishProviders: finalSwedishProviders,
          };
        })
      );

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
        const formatWatchedForProfile = (m: WatchedMovie) => {
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
        };

        const isTvWatched = (m: WatchedMovie) =>
          m.mediaType === "tv" ||
          (m.seasons && m.seasons.length > 0) ||
          (m.seasonCount && m.seasonCount > 0);
        const movieEntries = watchedMovies.filter((m) => !isTvWatched(m));
        const tvEntries = watchedMovies.filter((m) => isTvWatched(m));

        const moviesText =
          movieEntries.length > 0 && tvEntries.length > 0
            ? `LÅNGFILMER:\n${movieEntries
                .map(formatWatchedForProfile)
                .join("\n")}\n\nTV-SERIER:\n${tvEntries
                .map(formatWatchedForProfile)
                .join("\n")}`
            : watchedMovies.map(formatWatchedForProfile).join("\n");

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
5. FILM VS SERIER: Om användarens smak skiljer sig märkbart mellan långfilmer och TV-serier, fånga kort den skillnaden!
Svara ENDAST med ett JSON-objekt på formatet: {"summary": "Din personliga sammanfattning här..."}`;

        try {
          const rawText = await callGeminiWithFallback(ai, {
            contents: prompt,
            temperature: 0.65,
            responseMimeType: "application/json",
            responseSchema: TASTE_PROFILE_RESPONSE_SCHEMA,
            label: "taste-profile",
          });
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
        } catch (parseErr) {
          console.warn(
            "[Gemini:taste-profile] Failed to parse JSON response:",
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          );
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
