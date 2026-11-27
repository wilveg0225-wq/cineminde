import React, { useState, useEffect, useRef } from "react";
import { Clapperboard, UserCheck, LogIn } from "lucide-react";
import { User } from "firebase/auth";
import { BottomNav, TabId } from "./components/BottomNav";
import { RecommendedTab } from "./components/RecommendedTab";
import { TonightTab } from "./components/TonightTab";
import { WatchedTab } from "./components/WatchedTab";
import { WatchlistTab } from "./components/WatchlistTab";
import { TasteProfileTab, CloudSyncStatus } from "./components/TasteProfileTab";
import { RateMovieModal, RateMovieDraft } from "./components/RateMovieModal";
import { AuthModal } from "./components/AuthModal";
import {
  TasteCalibrationModal,
  TasteCalibrationResult,
} from "./components/TasteCalibrationModal";
import {
  subscribeToAuthChanges,
  loadOrInitializeUserCloudData,
  saveUserCloudData,
  subscribeToUserCloudData,
  logoutFirebaseUser,
  isAdminResetTestAccount,
  resetUserCloudData,
} from "./utils/firebase";
import {
  WatchedMovie,
  MovieRecommendation,
  DismissedMovie,
  EveningPreferences,
  MovieSteeringContext,
  TmdbMovieEnrichment,
  DEFAULT_WATCHED_MOVIES,
  DEFAULT_TASTE_PROFILE,
  ExportedAppData,
  normalizeMovieTitle,
  filterDuplicateRecommendations,
  generateSmartFallbackRecommendations,
  generateSmartFallbackTasteProfile,
  lookupCuratedTmdbMovie,
  inferAgeRatingFromGenres,
} from "./utils/movieLogic";

const STORAGE_KEYS = {
  WATCHED: "watchedMovies",
  WATCHLIST: "watchlist",
  TASTE_PROFILE: "tasteProfileSummary",
  RECOMMENDATIONS: "cineminde_recommendations",
  STREAMING_PROVIDERS: "cineminde_streaming_providers",
  DISLIKED_CATEGORIES: "cineminde_disliked_categories",
  DISMISSED_MOVIES: "cineminde_dismissed_movies",
};

function loadInitialDismissedMovies(): DismissedMovie[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISMISSED_MOVIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((d) => d && typeof d.title === "string" && d.title.trim())
      : [];
  } catch {
    return [];
  }
}

function loadInitialDislikedCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISLIKED_CATEGORIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(String).filter((s) => s.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function loadInitialStreamingProviders(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STREAMING_PROVIDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function enrichWatchedWithCurated(movies: WatchedMovie[]): WatchedMovie[] {
  return movies.map((m) => {
    const meta = lookupCuratedTmdbMovie(m.originalTitle || m.title, m.year);
    return {
      ...m,
      year: m.year || meta.year,
      tmdbId: m.tmdbId || meta.tmdbId,
      posterPath: m.posterPath || meta.posterPath,
      tmdbRating: m.tmdbRating || meta.voteAverage,
      swedishProviders: m.swedishProviders || meta.swedishProviders,
      ageRating:
        m.ageRating ||
        meta.ageRating ||
        inferAgeRatingFromGenres(m.tmdbGenreIds || meta.tmdbGenreIds),
    };
  });
}

function enrichRecsWithCurated(
  recs: MovieRecommendation[]
): MovieRecommendation[] {
  return recs.map((r) => {
    const meta = lookupCuratedTmdbMovie(r.originalTitle || r.title, r.year);
    return {
      ...r,
      year: r.year || meta.year,
      tmdbId: r.tmdbId || meta.tmdbId,
      posterPath: r.posterPath || meta.posterPath,
      tmdbRating: r.tmdbRating || meta.voteAverage,
      swedishProviders: r.swedishProviders || meta.swedishProviders,
      ageRating:
        r.ageRating ||
        meta.ageRating ||
        inferAgeRatingFromGenres(r.tmdbGenreIds || meta.tmdbGenreIds),
    };
  });
}

function loadInitialWatched(): WatchedMovie[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCHED);
    if (raw === null) {
      const initial = enrichWatchedWithCurated(DEFAULT_WATCHED_MOVIES);
      localStorage.setItem(STORAGE_KEYS.WATCHED, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? enrichWatchedWithCurated(parsed)
      : enrichWatchedWithCurated(DEFAULT_WATCHED_MOVIES);
  } catch {
    return enrichWatchedWithCurated(DEFAULT_WATCHED_MOVIES);
  }
}

function loadInitialWatchlist(): MovieRecommendation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? enrichRecsWithCurated(parsed) : [];
  } catch {
    return [];
  }
}

function loadInitialTasteProfile(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASTE_PROFILE);
    if (raw === null) {
      localStorage.setItem(STORAGE_KEYS.TASTE_PROFILE, DEFAULT_TASTE_PROFILE);
      return DEFAULT_TASTE_PROFILE;
    }
    return raw;
  } catch {
    return DEFAULT_TASTE_PROFILE;
  }
}

function loadInitialRecommendations(
  watched: WatchedMovie[],
  watchlist: MovieRecommendation[],
  dislikedCategories: string[] = [],
  dismissedMovies: DismissedMovie[] = []
): MovieRecommendation[] {
  const dismissedNorms = new Set(
    (dismissedMovies || []).flatMap((d) => {
      const n1 = normalizeMovieTitle(d.title);
      const n2 = d.originalTitle ? normalizeMovieTitle(d.originalTitle) : "";
      return n2 ? [n1, n2] : [n1];
    })
  );
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = (parsed as MovieRecommendation[]).filter((r) => {
          const n1 = normalizeMovieTitle(r.title);
          const n2 = r.originalTitle ? normalizeMovieTitle(r.originalTitle) : "";
          return !dismissedNorms.has(n1) && (!n2 || !dismissedNorms.has(n2));
        });
        if (filtered.length > 0) {
          return enrichRecsWithCurated(filtered);
        }
      }
    }
  } catch {
    // Fallback below
  }
  return generateSmartFallbackRecommendations(
    watched,
    watchlist,
    {
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
    },
    dislikedCategories,
    [],
    dismissedMovies
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("tonight");
  const [watchedMovies, setWatchedMovies] =
    useState<WatchedMovie[]>(loadInitialWatched);
  const [watchlist, setWatchlist] =
    useState<MovieRecommendation[]>(loadInitialWatchlist);
  const [tasteProfileSummary, setTasteProfileSummary] = useState<string>(
    loadInitialTasteProfile
  );
  const [dislikedCategories, setDislikedCategories] = useState<string[]>(
    loadInitialDislikedCategories
  );
  const [dismissedMovies, setDismissedMovies] = useState<DismissedMovie[]>(
    loadInitialDismissedMovies
  );
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>(
    () =>
      loadInitialRecommendations(
        watchedMovies,
        watchlist,
        loadInitialDislikedCategories(),
        loadInitialDismissedMovies()
      )
  );

  const [preferences, setPreferences] = useState<EveningPreferences>(() => ({
    moods: [],
    genres: [],
    contents: [],
    frameworks: [],
    customText: "",
    streamingProviders: loadInitialStreamingProviders(),
  }));

  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [activeSteering, setActiveSteering] =
    useState<MovieSteeringContext | null>(null);
  const [seenTonightTitles, setSeenTonightTitles] = useState<string[]>([]);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [rateDraft, setRateDraft] = useState<RateMovieDraft | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    undoLabel?: string;
    onUndo?: () => void;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("synced");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const enrichedKeysRef = useRef<Set<string>>(new Set());
  const isCloudHydratedRef = useRef(false);
  const skipNextCloudSaveRef = useRef(false);
  const watchedMoviesRef = useRef(watchedMovies);
  watchedMoviesRef.current = watchedMovies;
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const tasteProfileSummaryRef = useRef(tasteProfileSummary);
  tasteProfileSummaryRef.current = tasteProfileSummary;
  const dislikedCategoriesRef = useRef(dislikedCategories);
  dislikedCategoriesRef.current = dislikedCategories;
  const dismissedMoviesRef = useRef(dismissedMovies);
  dismissedMoviesRef.current = dismissedMovies;
  const recsAbortControllerRef = useRef<AbortController | null>(null);

  // Firebase Auth & Real-time Firestore Cloud Sync
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = subscribeToAuthChanges(async (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        isCloudHydratedRef.current = false;
        return;
      }

      const isAdminReset = isAdminResetTestAccount(user.email);
      if (isAdminReset) {
        const sessionKey = `cineminde_admin_session_reset_${user.uid}`;
        let alreadyResetThisSession = false;
        try {
          alreadyResetThisSession = sessionStorage.getItem(sessionKey) === "1";
        } catch {
          alreadyResetThisSession = false;
        }

        if (!alreadyResetThisSession) {
          try {
            sessionStorage.setItem(sessionKey, "1");
          } catch {
            // Ignore sessionStorage errors
          }
          const emptySummary = generateSmartFallbackTasteProfile([], []);
          skipNextCloudSaveRef.current = true;
          try {
            localStorage.removeItem("cineminde_recommended_deck");
            localStorage.removeItem("cineminde_recommended_seen_titles");
            localStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
            localStorage.removeItem(STORAGE_KEYS.STREAMING_PROVIDERS);
            localStorage.setItem(STORAGE_KEYS.WATCHED, "[]");
            localStorage.setItem(STORAGE_KEYS.WATCHLIST, "[]");
            localStorage.setItem(STORAGE_KEYS.DISLIKED_CATEGORIES, "[]");
            localStorage.setItem(STORAGE_KEYS.DISMISSED_MOVIES, "[]");
            localStorage.setItem(STORAGE_KEYS.TASTE_PROFILE, emptySummary);
          } catch {
            // Ignore storage errors
          }
          setWatchedMovies([]);
          setWatchlist([]);
          setDislikedCategories([]);
          setDismissedMovies([]);
          setTasteProfileSummary(emptySummary);
          setPreferences({
            moods: [],
            genres: [],
            contents: [],
            frameworks: [],
            customText: "",
            streamingProviders: [],
          });
          setActiveSteering(null);
          setSeenTonightTitles([]);
          setRecommendations(
            generateSmartFallbackRecommendations(
              [],
              [],
              { moods: [], genres: [], contents: [], frameworks: [], customText: "" },
              []
            )
          );
          showToast(
            "Admin-testkonto inloggat – profilen är helt nollställd för test!"
          );
          try {
            await resetUserCloudData(user.uid);
            setCloudSyncStatus("synced");
          } catch {
            // Local reset is already applied even if Firestore rules/network fail
            setCloudSyncStatus("error");
          }
        } else {
          // Page reload within the same admin test session: preserve local test state
          // so persistence across F5 can be verified cleanly.
          setCloudSyncStatus("local_only");
        }
        isCloudHydratedRef.current = true;
        return;
      }

      try {
        const cloudData = await loadOrInitializeUserCloudData(user.uid, {
          watchedMovies: watchedMoviesRef.current,
          watchlist: watchlistRef.current,
          tasteProfileSummary: tasteProfileSummaryRef.current,
          dislikedCategories: dislikedCategoriesRef.current,
          dismissedMovies: dismissedMoviesRef.current,
        });
        setCloudSyncStatus("synced");
        skipNextCloudSaveRef.current = true;
        setWatchedMovies(enrichWatchedWithCurated(cloudData.watchedMovies));
        setWatchlist(enrichRecsWithCurated(cloudData.watchlist));
        setTasteProfileSummary(cloudData.tasteProfileSummary);
        if (Array.isArray(cloudData.dislikedCategories)) {
          setDislikedCategories(cloudData.dislikedCategories);
        }
        if (Array.isArray(cloudData.dismissedMovies)) {
          setDismissedMovies(cloudData.dismissedMovies);
        }
        isCloudHydratedRef.current = true;

        unsubscribeSnapshot = subscribeToUserCloudData(
          user.uid,
          (liveData) => {
            setCloudSyncStatus("synced");
            skipNextCloudSaveRef.current = true;
            setWatchedMovies(enrichWatchedWithCurated(liveData.watchedMovies));
            setWatchlist(enrichRecsWithCurated(liveData.watchlist));
            setTasteProfileSummary(liveData.tasteProfileSummary);
            if (Array.isArray(liveData.dislikedCategories)) {
              setDislikedCategories(liveData.dislikedCategories);
            }
            if (Array.isArray(liveData.dismissedMovies)) {
              setDismissedMovies(liveData.dismissedMovies);
            }
          },
          () => {
            setCloudSyncStatus("error");
          }
        );
      } catch {
        // Fallback to local state if Firestore rules or network deny access
        setCloudSyncStatus("error");
        isCloudHydratedRef.current = true;
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Automatically save changes to Firestore when logged in
  useEffect(() => {
    if (!currentUser || !isCloudHydratedRef.current) return;
    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }
    void saveUserCloudData(currentUser.uid, {
      watchedMovies,
      watchlist,
      tasteProfileSummary,
      dislikedCategories,
      dismissedMovies,
    })
      .then(() => {
        setCloudSyncStatus((prev) => (prev === "error" ? "synced" : prev));
      })
      .catch(() => {
        // Gracefully degrade to localStorage without unhandled promise rejection
        setCloudSyncStatus("error");
      });
  }, [watchedMovies, watchlist, tasteProfileSummary, dislikedCategories, dismissedMovies, currentUser]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WATCHED, JSON.stringify(watchedMovies));
    } catch {
      // Ignore storage quota errors
    }
  }, [watchedMovies]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.DISLIKED_CATEGORIES,
        JSON.stringify(dislikedCategories)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [dislikedCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.DISMISSED_MOVIES,
        JSON.stringify(dismissedMovies.slice(-150))
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [dismissedMovies]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(watchlist));
    } catch {
      // Ignore storage quota errors
    }
  }, [watchlist]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASTE_PROFILE, tasteProfileSummary);
    } catch {
      // Ignore storage quota errors
    }
  }, [tasteProfileSummary]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.RECOMMENDATIONS,
        JSON.stringify(recommendations)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [recommendations]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.STREAMING_PROVIDERS,
        JSON.stringify(preferences.streamingProviders || [])
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [preferences.streamingProviders]);

  // Background TMDB enrichment for movies in Watched, Watchlist, and Recommendations
  // Runs only after login so we never fire aborted requests on the auth screen,
  // and automatically fills in missing posters (e.g. after admin reset or fallback load).
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const runBackgroundEnrichment = async () => {
      const titlesToEnrich = new Map<
        string,
        { title: string; year?: string; mediaType?: "movie" | "tv" }
      >();
      const queueIfMissing = (item: {
        title: string;
        originalTitle?: string;
        year?: string;
        mediaType?: "movie" | "tv";
        posterPath?: string;
        swedishProviders?: unknown;
        ageRating?: string;
      }) => {
        if (!item.posterPath || !item.swedishProviders || !item.ageRating) {
          const norm = normalizeMovieTitle(item.title);
          if (norm && !enrichedKeysRef.current.has(norm)) {
            titlesToEnrich.set(norm, {
              title: item.originalTitle || item.title,
              year: item.year,
              mediaType: item.mediaType,
            });
          }
        }
      };

      for (const w of watchedMovies) queueIfMissing(w);
      for (const wl of watchlist) queueIfMissing(wl);
      for (const r of recommendations) queueIfMissing(r);

      if (titlesToEnrich.size === 0) return;
      for (const norm of titlesToEnrich.keys()) {
        enrichedKeysRef.current.add(norm);
      }

      try {
        const storedTmdbKey = localStorage.getItem("tmdbApiKey") || "";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (storedTmdbKey) {
          headers["x-tmdb-key"] = storedTmdbKey;
        }
        const res = await fetch("/api/tmdb/enrich", {
          method: "POST",
          headers,
          body: JSON.stringify({
            movies: Array.from(titlesToEnrich.values()),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const enrichedList: TmdbMovieEnrichment[] = Array.isArray(data.enriched)
          ? data.enriched
          : [];
        if (enrichedList.length === 0 || cancelled) return;

        const lookupByNorm = (title: string, orig?: string) => {
          const n1 = normalizeMovieTitle(title);
          const n2 = normalizeMovieTitle(orig);
          return enrichedList.find(
            (e) =>
              normalizeMovieTitle(e.title) === n1 ||
              normalizeMovieTitle(e.originalTitle) === n1 ||
              (n2 &&
                (normalizeMovieTitle(e.title) === n2 ||
                  normalizeMovieTitle(e.originalTitle) === n2))
          );
        };

        setWatchedMovies((prev) =>
          prev.map((m) => {
            const hit = lookupByNorm(m.title, m.originalTitle);
            if (!hit) return m;
            return {
              ...m,
              year: m.year || hit.year,
              tmdbId: hit.tmdbId || m.tmdbId,
              posterPath: hit.posterPath || m.posterPath,
              tmdbRating: hit.voteAverage || m.tmdbRating,
              swedishProviders: hit.swedishProviders || m.swedishProviders,
              ageRating: hit.ageRating || m.ageRating,
            };
          })
        );

        setWatchlist((prev) =>
          prev.map((m) => {
            const hit = lookupByNorm(m.title, m.originalTitle);
            if (!hit) return m;
            return {
              ...m,
              year: m.year || hit.year,
              tmdbId: hit.tmdbId || m.tmdbId,
              posterPath: hit.posterPath || m.posterPath,
              tmdbRating: hit.voteAverage || m.tmdbRating,
              swedishProviders: hit.swedishProviders || m.swedishProviders,
              ageRating: hit.ageRating || m.ageRating,
            };
          })
        );

        setRecommendations((prev) =>
          prev.map((m) => {
            const hit = lookupByNorm(m.title, m.originalTitle);
            if (!hit) return m;
            return {
              ...m,
              year: m.year || hit.year,
              tmdbId: hit.tmdbId || m.tmdbId,
              posterPath: hit.posterPath || m.posterPath,
              tmdbRating: hit.voteAverage || m.tmdbRating,
              swedishProviders: hit.swedishProviders || m.swedishProviders,
              ageRating: hit.ageRating || m.ageRating,
            };
          })
        );
      } catch {
        // Allow retry if network failed
        for (const norm of titlesToEnrich.keys()) {
          enrichedKeysRef.current.delete(norm);
        }
      }
    };

    void runBackgroundEnrichment();
    return () => {
      cancelled = true;
    };
  }, [currentUser, watchedMovies, watchlist, recommendations]);

  const showToast = (
    msg: string,
    action?: { undoLabel: string; onUndo: () => void }
  ) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastState({
      message: msg,
      undoLabel: action?.undoLabel,
      onUndo: action?.onUndo,
    });
    toastTimerRef.current = setTimeout(
      () => {
        setToastState((current) => (current?.message === msg ? null : current));
      },
      action ? 5500 : 3200
    );
  };

  const fetchTonightRecommendations = async (
    steeringOverride: MovieSteeringContext | null
  ) => {
    // Avbryt ev. pågående äldre sökning så snabba klick aldrig skriver över nya resultat
    recsAbortControllerRef.current?.abort();
    const controller = new AbortController();
    recsAbortControllerRef.current = controller;

    setIsLoadingRecs(true);
    setRecsError(null);
    setActiveSteering(steeringOverride);

    const currentTitles = recommendations.map((r) => r.title);
    const allPrevious = Array.from(
      new Set([
        ...(steeringOverride ? seenTonightTitles : []),
        ...currentTitles,
        ...(steeringOverride?.anchorMovie?.title
          ? [steeringOverride.anchorMovie.title]
          : []),
      ])
    ).slice(-60);

    if (steeringOverride) {
      setSeenTonightTitles(allPrevious);
    } else {
      setSeenTonightTitles(currentTitles);
    }

    const effectivePreferences: EveningPreferences = {
      ...preferences,
      steering: steeringOverride,
    };

    try {
      const storedTmdbKey = localStorage.getItem("tmdbApiKey") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (storedTmdbKey) {
        headers["x-tmdb-key"] = storedTmdbKey;
      }

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          watchedMovies,
          watchlist,
          tasteProfileSummary,
          preferences: effectivePreferences,
          dislikedCategories,
          dismissedMovies,
          previousTitles: allPrevious,
        }),
      });

      if (controller.signal.aborted) return;

      if (!response.ok) {
        throw new Error("Kunde inte hämta rekommendationer");
      }

      const data = await response.json();
      if (controller.signal.aborted) return;

      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        const clean = filterDuplicateRecommendations(
          data.recommendations,
          watchedMovies,
          watchlist
        );
        if (clean.length > 0) {
          setRecommendations(enrichRecsWithCurated(clean));
          if (steeringOverride) {
            setSeenTonightTitles((prev) =>
              Array.from(
                new Set([...prev, ...clean.map((c) => c.title)])
              ).slice(-60)
            );
          }
        } else {
          const fallback = generateSmartFallbackRecommendations(
            watchedMovies,
            watchlist,
            effectivePreferences,
            dislikedCategories,
            allPrevious,
            dismissedMovies
          );
          setRecommendations(fallback);
        }
      } else {
        const fallback = generateSmartFallbackRecommendations(
          watchedMovies,
          watchlist,
          effectivePreferences,
          dislikedCategories,
          allPrevious,
          dismissedMovies
        );
        setRecommendations(fallback);
      }
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        return;
      }
      setRecsError(
        "Kunde inte nå servern just nu – visar reservförslag i stället."
      );
      const fallback = generateSmartFallbackRecommendations(
        watchedMovies,
        watchlist,
        effectivePreferences,
        dislikedCategories,
        allPrevious,
        dismissedMovies
      );
      setRecommendations(fallback);
    } finally {
      if (recsAbortControllerRef.current === controller) {
        setIsLoadingRecs(false);
      }
    }
  };

  const handleFindMovies = async () => {
    await fetchTonightRecommendations(null);
  };

  const handleSteerFromMovie = async (steering: MovieSteeringContext) => {
    await fetchTonightRecommendations(steering);
  };

  const handleDismissMovie = (movie: MovieRecommendation, removeFromTonight = false) => {
    const norm = normalizeMovieTitle(movie.title);
    if (!norm) return;
    setDismissedMovies((prev) => {
      const filtered = prev.filter((d) => normalizeMovieTitle(d.title) !== norm);
      return [
        ...filtered,
        {
          title: movie.title,
          originalTitle: movie.originalTitle,
          tmdbId: movie.tmdbId,
          mediaType: movie.mediaType,
          tmdbGenres: movie.tmdbGenres,
          vibeTags: movie.vibeTags,
          dismissedAt: new Date().toISOString(),
        },
      ].slice(-150);
    });
    if (removeFromTonight) {
      const originalIndex = recommendations.findIndex(
        (r) => normalizeMovieTitle(r.title) === norm
      );
      setRecommendations((prev) =>
        prev.filter((r) => normalizeMovieTitle(r.title) !== norm)
      );
      showToast(`"${movie.title}" gömdes – vi styr bort från liknande.`, {
        undoLabel: "Ångra",
        onUndo: () => {
          setDismissedMovies((prev) =>
            prev.filter((d) => normalizeMovieTitle(d.title) !== norm)
          );
          setRecommendations((prev) => {
            if (prev.some((r) => normalizeMovieTitle(r.title) === norm)) {
              return prev;
            }
            const copy = [...prev];
            const insertAt =
              originalIndex >= 0 ? Math.min(originalIndex, copy.length) : 0;
            copy.splice(insertAt, 0, movie);
            return copy;
          });
          setToastState(null);
        },
      });
    }
  };

  const handleRestoreDismissedMovie = (movie: MovieRecommendation) => {
    const norm = normalizeMovieTitle(movie.title);
    if (!norm) return;
    setDismissedMovies((prev) =>
      prev.filter((d) => normalizeMovieTitle(d.title) !== norm)
    );
  };

  const handleRestoreDismissedByTitle = (title: string) => {
    const norm = normalizeMovieTitle(title);
    if (!norm) return;
    setDismissedMovies((prev) =>
      prev.filter((d) => normalizeMovieTitle(d.title) !== norm)
    );
    showToast(`"${title}" återställdes och kan rekommenderas igen.`);
  };

  const handleClearDismissedMovies = () => {
    setDismissedMovies([]);
    showToast("Alla bortvalda förslag har rensats.");
  };

  const handleAddToWatchlist = async (movie: MovieRecommendation) => {
    const norm = normalizeMovieTitle(movie.title);
    if (watchlist.some((w) => normalizeMovieTitle(w.title) === norm)) {
      showToast(`"${movie.title}" finns redan i din Watchlist`);
      return;
    }
    setWatchlist((prev) => [movie, ...prev]);
    showToast(`"${movie.title}" sparades i din Watchlist`);

    // Automatically fetch live Swedish streaming providers & poster if missing
    try {
      const storedTmdbKey = localStorage.getItem("tmdbApiKey") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (storedTmdbKey) {
        headers["x-tmdb-key"] = storedTmdbKey;
      }
      const res = await fetch("/api/tmdb/enrich", {
        method: "POST",
        headers,
        body: JSON.stringify({
          movies: [{ title: movie.originalTitle || movie.title, year: movie.year }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const hit: TmdbMovieEnrichment | undefined = data?.enriched?.[0];
        if (hit) {
          setWatchlist((prev) =>
            prev.map((item) =>
              item.id === movie.id
                ? {
                    ...item,
                    year: item.year || hit.year,
                    tmdbId: hit.tmdbId || item.tmdbId,
                    posterPath: hit.posterPath || item.posterPath,
                    tmdbRating: hit.voteAverage || item.tmdbRating,
                    swedishProviders:
                      hit.swedishProviders || item.swedishProviders,
                  }
                : item
            )
          );
        }
      }
    } catch {
      // Ignore background enrichment error
    }
  };

  const handleRemoveFromWatchlist = (id: string) => {
    const target = watchlist.find((w) => w.id === id);
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    if (target) {
      showToast(`"${target.title}" togs bort från Watchlist`, {
        undoLabel: "Ångra",
        onUndo: () => {
          setWatchlist((prev) => {
            const norm = normalizeMovieTitle(target.title);
            if (prev.some((w) => normalizeMovieTitle(w.title) === norm)) {
              return prev;
            }
            return [target, ...prev];
          });
          setToastState(null);
        },
      });
    }
  };

  const handleOpenRateFromRecommendation = (movie: MovieRecommendation) => {
    setRateDraft({
      title: movie.title,
      originalTitle: movie.originalTitle,
      year: movie.year,
      mediaType: movie.mediaType,
      initialRating: 4,
      initialLiked: true,
      initialTags: [],
      tmdbId: movie.tmdbId,
      posterPath: movie.posterPath,
      tmdbRating: movie.tmdbRating,
      swedishProviders: movie.swedishProviders,
      seasonCount: movie.seasonCount,
      ageRating: movie.ageRating,
    });
  };

  const handleOpenRateFromWatchlist = (movie: MovieRecommendation) => {
    setRateDraft({
      title: movie.title,
      originalTitle: movie.originalTitle,
      year: movie.year,
      mediaType: movie.mediaType,
      initialRating: 4,
      initialLiked: true,
      initialTags: [],
      fromWatchlistId: movie.id,
      tmdbId: movie.tmdbId,
      posterPath: movie.posterPath,
      tmdbRating: movie.tmdbRating,
      swedishProviders: movie.swedishProviders,
      seasonCount: movie.seasonCount,
      ageRating: movie.ageRating,
    });
  };

  const refreshTasteProfileInBackground = async (
    movies: WatchedMovie[],
    dislikes: string[] = dislikedCategories
  ) => {
    setIsUpdatingProfile(true);
    try {
      const response = await fetch("/api/taste-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchedMovies: movies,
          dislikedCategories: dislikes,
        }),
      });

      if (!response.ok) {
        throw new Error("Kunde inte uppdatera smakprofilen");
      }

      const data = await response.json();
      if (data && typeof data.summary === "string" && data.summary.trim()) {
        setTasteProfileSummary(data.summary.trim());
      } else {
        throw new Error("Tomt svar");
      }
    } catch {
      const fallback = generateSmartFallbackTasteProfile(movies, dislikes);
      setTasteProfileSummary(fallback);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAddDislikedCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    const exists = dislikedCategories.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      showToast(`"${trimmed}" finns redan bland dina ogillade kategorier.`);
      return;
    }
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const updated = [...dislikedCategories, formatted];
    setDislikedCategories(updated);
    showToast(`Kategorin "${formatted}" sållas nu bort från dina förslag.`);
    void refreshTasteProfileInBackground(watchedMovies, updated);
  };

  const handleRemoveDislikedCategory = (category: string) => {
    const updated = dislikedCategories.filter(
      (c) => c.toLowerCase() !== category.trim().toLowerCase()
    );
    setDislikedCategories(updated);
    showToast(`Kategorin "${category}" togs bort från ogillade.`);
    void refreshTasteProfileInBackground(watchedMovies, updated);
  };

  const handleCompleteCalibration = (result: TasteCalibrationResult) => {
    setIsCalibrationOpen(false);
    const { watched: newWatchedEntries, dismissed: newDismissedEntries } = result;

    const existingWatchedNorms = new Set(
      watchedMovies.map((m) => normalizeMovieTitle(m.title))
    );
    const uniqueNewWatched = (newWatchedEntries || []).filter(
      (m) => !existingWatchedNorms.has(normalizeMovieTitle(m.title))
    );

    const existingDismissedNorms = new Set(
      dismissedMovies.map((d) => normalizeMovieTitle(d.title))
    );
    const uniqueNewDismissed = (newDismissedEntries || []).filter(
      (d) =>
        !existingDismissedNorms.has(normalizeMovieTitle(d.title)) &&
        !existingWatchedNorms.has(normalizeMovieTitle(d.title))
    );

    if (uniqueNewWatched.length === 0 && uniqueNewDismissed.length === 0) return;

    const updatedWatched =
      uniqueNewWatched.length > 0
        ? [...uniqueNewWatched, ...watchedMovies]
        : watchedMovies;
    if (uniqueNewWatched.length > 0) {
      setWatchedMovies(updatedWatched);
    }

    if (uniqueNewDismissed.length > 0) {
      setDismissedMovies((prev) => [...prev, ...uniqueNewDismissed].slice(-150));
    }

    const removedFromRecsNorms = new Set([
      ...uniqueNewWatched.map((m) => normalizeMovieTitle(m.title)),
      ...uniqueNewDismissed.map((d) => normalizeMovieTitle(d.title)),
    ]);
    const watchedNorms = new Set(
      uniqueNewWatched.map((m) => normalizeMovieTitle(m.title))
    );
    if (watchedNorms.size > 0) {
      setWatchlist((prev) =>
        prev.filter((w) => !watchedNorms.has(normalizeMovieTitle(w.title)))
      );
    }
    setRecommendations((prev) =>
      prev.filter((r) => !removedFromRecsNorms.has(normalizeMovieTitle(r.title)))
    );

    const parts: string[] = [];
    if (uniqueNewWatched.length > 0) {
      parts.push(`${uniqueNewWatched.length} betyg sparade`);
    }
    if (uniqueNewDismissed.length > 0) {
      parts.push(`${uniqueNewDismissed.length} bortvalda`);
    }
    showToast(`Kalibrering sparad (${parts.join(", ")}) – smakprofilen uppdateras!`);
    if (uniqueNewWatched.length > 0) {
      void refreshTasteProfileInBackground(updatedWatched, dislikedCategories);
    }
  };

  const handleSaveWatchedMovie = (
    movieData: Omit<WatchedMovie, "id" | "addedAt">,
    existingId?: string,
    fromWatchlistId?: string
  ) => {
    const normNew = normalizeMovieTitle(movieData.title);
    const meta = lookupCuratedTmdbMovie(movieData.title, movieData.year);
    const enrichedMovieData: Omit<WatchedMovie, "id" | "addedAt"> = {
      ...movieData,
      mediaType: movieData.mediaType || meta.mediaType,
      year: movieData.year || meta.year,
      tmdbId: movieData.tmdbId || meta.tmdbId,
      posterPath: movieData.posterPath || meta.posterPath,
      tmdbRating: movieData.tmdbRating || meta.voteAverage,
      swedishProviders: movieData.swedishProviders || meta.swedishProviders,
    };

    let nextWatched: WatchedMovie[];

    if (existingId) {
      nextWatched = watchedMovies.map((m) =>
        m.id === existingId
          ? {
              ...m,
              ...enrichedMovieData,
            }
          : m
      );
      setWatchedMovies(nextWatched);
      showToast(`Uppdaterade "${movieData.title}"`);
    } else {
      const existingByName = watchedMovies.find(
        (m) => normalizeMovieTitle(m.title) === normNew
      );
      if (existingByName) {
        nextWatched = watchedMovies.map((m) =>
          m.id === existingByName.id
            ? {
                ...m,
                ...enrichedMovieData,
              }
            : m
        );
        setWatchedMovies(nextWatched);
      } else {
        const newMovie: WatchedMovie = {
          ...enrichedMovieData,
          id: `watched-${Date.now()}`,
          addedAt: new Date().toISOString(),
        };
        nextWatched = [newMovie, ...watchedMovies];
        setWatchedMovies(nextWatched);
      }
      showToast(`"${movieData.title}" loggades och smakprofilen uppdateras`);
    }

    // Remove from Watchlist if it was there
    setWatchlist((prev) =>
      prev.filter(
        (w) =>
          w.id !== fromWatchlistId &&
          normalizeMovieTitle(w.title) !== normNew
      )
    );

    // Also remove from active recommendations so already-watched movies don't linger
    setRecommendations((prev) =>
      prev.filter((r) => normalizeMovieTitle(r.title) !== normNew)
    );

    setRateDraft(null);

    // Automatically update AI taste profile in the background
    void refreshTasteProfileInBackground(nextWatched);
  };

  const handleDeleteWatched = (id: string) => {
    const target = watchedMovies.find((m) => m.id === id);
    const nextWatched = watchedMovies.filter((m) => m.id !== id);
    setWatchedMovies(nextWatched);
    if (target) {
      showToast(`"${target.title}" togs bort från Sedda`);
    }
    void refreshTasteProfileInBackground(nextWatched);
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        sessionStorage.removeItem(`cineminde_admin_session_reset_${currentUser.uid}`);
      } catch {
        // Ignore storage errors
      }
    }
    await logoutFirebaseUser();
    setCurrentUser(null);
    isCloudHydratedRef.current = false;
    showToast("Du har loggat ut");
  };

  const handleResetAdminTestAccount = async () => {
    if (!currentUser || !isAdminResetTestAccount(currentUser.email)) return;
    const emptySummary = generateSmartFallbackTasteProfile([], []);
    skipNextCloudSaveRef.current = true;
    enrichedKeysRef.current.clear();
    try {
      localStorage.removeItem("cineminde_recommended_deck");
      localStorage.removeItem("cineminde_recommended_seen_titles");
      localStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
      localStorage.removeItem(STORAGE_KEYS.STREAMING_PROVIDERS);
      localStorage.setItem(STORAGE_KEYS.WATCHED, "[]");
      localStorage.setItem(STORAGE_KEYS.WATCHLIST, "[]");
      localStorage.setItem(STORAGE_KEYS.DISLIKED_CATEGORIES, "[]");
      localStorage.setItem(STORAGE_KEYS.DISMISSED_MOVIES, "[]");
      localStorage.setItem(STORAGE_KEYS.TASTE_PROFILE, emptySummary);
    } catch {
      // Ignore storage errors
    }
    setWatchedMovies([]);
    setWatchlist([]);
    setDislikedCategories([]);
    setDismissedMovies([]);
    setTasteProfileSummary(emptySummary);
    setPreferences({
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
      streamingProviders: [],
    });
    setActiveSteering(null);
    setSeenTonightTitles([]);
    setRecommendations(
      generateSmartFallbackRecommendations(
        [],
        [],
        { moods: [], genres: [], contents: [], frameworks: [], customText: "" },
        []
      )
    );
    showToast("Admin-testkontot är nu helt nollställt!");
    try {
      await resetUserCloudData(currentUser.uid);
    } catch {
      // Local reset already succeeded
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6] flex flex-col items-center justify-center p-4 pt-safe-top pb-safe-bottom">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#e11d48] to-[#f43f5e] flex items-center justify-center shadow-xl shadow-[#e11d48]/30 mb-4 animate-pulse">
          <Clapperboard className="w-7 h-7 text-white" />
        </div>
        <p className="text-xs text-zinc-400 font-medium">Laddar CineMinde...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthModal
          isOpen={true}
          standalone={true}
          onAuthSuccess={(msg) => showToast(msg)}
        />
        {toastState && (
          <div
            role="status"
            className="fixed top-[calc(env(safe-area-inset-top,0px)+1rem)] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#1e1e24] border border-white/[0.15] text-xs font-medium text-white shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <span>{toastState.message}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6] pb-36">
      <div className="max-w-md mx-auto px-4 pt-safe-top">
        {/* Compact Top Header */}
        <header className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#e11d48]/15 border border-[#e11d48]/40 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4 h-4 text-[#e11d48]" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              CineMinde
            </h1>
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              title={`Inloggad och synkad som ${currentUser.email || currentUser.displayName} (Klicka för smakprofil & konto)`}
              className="min-h-[30px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/25 transition-colors shrink-0 max-w-[180px]"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {currentUser.displayName || currentUser.email?.split("@")[0] || "Synkad"}
              </span>
            </button>
          )}
        </header>

        {/* Active Tab View */}
        <main>
          {activeTab === "recommended" && (
            <RecommendedTab
              watchedMovies={watchedMovies}
              watchlist={watchlist}
              tasteProfileSummary={tasteProfileSummary}
              dislikedCategories={dislikedCategories}
              dismissedMovies={dismissedMovies}
              onAddToWatchlist={handleAddToWatchlist}
              onMarkAsWatched={handleOpenRateFromRecommendation}
              onDismissMovie={(m) => handleDismissMovie(m, false)}
              onRestoreDismissedMovie={handleRestoreDismissedMovie}
              onGoToWatchlist={() => setActiveTab("watchlist")}
            />
          )}

          {activeTab === "tonight" && (
            <TonightTab
              preferences={preferences}
              onChangePreferences={setPreferences}
              recommendations={recommendations}
              isLoading={isLoadingRecs}
              error={recsError}
              onFindMovies={handleFindMovies}
              onSteerFromMovie={handleSteerFromMovie}
              activeSteering={activeSteering}
              onClearSteering={() => setActiveSteering(null)}
              onAddToWatchlist={handleAddToWatchlist}
              onMarkAsWatched={handleOpenRateFromRecommendation}
              onDismissMovie={(m) => handleDismissMovie(m, true)}
              watchlist={watchlist}
              watchedMovies={watchedMovies}
              watchedCount={watchedMovies.length}
            />
          )}

          {activeTab === "watched" && (
            <WatchedTab
              watchedMovies={watchedMovies}
              onOpenRateModal={(draft) => setRateDraft(draft)}
              onDeleteWatched={handleDeleteWatched}
            />
          )}

          {activeTab === "watchlist" && (
            <WatchlistTab
              watchlist={watchlist}
              onAddToWatchlist={handleAddToWatchlist}
              onMarkWatchlistAsWatched={handleOpenRateFromWatchlist}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
              onGoToTonight={() => setActiveTab("tonight")}
            />
          )}

          {activeTab === "profile" && (
            <TasteProfileTab
              watchedMovies={watchedMovies}
              watchlist={watchlist}
              tasteProfileSummary={tasteProfileSummary}
              dislikedCategories={dislikedCategories}
              dismissedMovies={dismissedMovies}
              onAddDislikedCategory={handleAddDislikedCategory}
              onRemoveDislikedCategory={handleRemoveDislikedCategory}
              onRestoreDismissedByTitle={handleRestoreDismissedByTitle}
              onClearDismissedMovies={handleClearDismissedMovies}
              isUpdatingProfile={isUpdatingProfile}
              currentUser={currentUser}
              cloudSyncStatus={cloudSyncStatus}
              isAdminTestAccount={isAdminResetTestAccount(currentUser?.email)}
              onResetAdminTestAccount={handleResetAdminTestAccount}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* Fixed Floating Feedback & Undo Toast */}
      {toastState && (
        <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
          <div
            role="status"
            aria-live="polite"
            className="max-w-md mx-auto pointer-events-auto px-4 py-2.5 rounded-xl bg-[#16161a]/95 backdrop-blur-md border border-[#f59e0b]/50 text-xs font-medium text-[#f59e0b] shadow-2xl shadow-black/70 flex items-center justify-between gap-3"
          >
            <span className="flex-1 text-left">{toastState.message}</span>
            {toastState.onUndo && toastState.undoLabel && (
              <button
                type="button"
                onClick={toastState.onUndo}
                className="px-3 py-1 rounded-lg bg-[#f59e0b]/20 hover:bg-[#f59e0b]/35 border border-[#f59e0b]/50 text-[11px] font-bold text-amber-200 shrink-0 cursor-pointer transition-colors"
              >
                {toastState.undoLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        watchedCount={watchedMovies.length}
        watchlistCount={watchlist.length}
      />

      {/* Rating & Quality Tags Modal */}
      <RateMovieModal
        draft={rateDraft}
        onClose={() => setRateDraft(null)}
        onSave={handleSaveWatchedMovie}
      />

      {/* Quick 30-second Taste Calibration Modal */}
      <TasteCalibrationModal
        isOpen={isCalibrationOpen}
        watchedMovies={watchedMovies}
        dismissedMovies={dismissedMovies}
        onClose={() => setIsCalibrationOpen(false)}
        onComplete={handleCompleteCalibration}
      />

      {/* Firebase Account Login & Cloud Sync Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(msg) => showToast(msg)}
      />
    </div>
  );
}
