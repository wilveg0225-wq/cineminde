import React, { useState, useEffect, useRef } from "react";
import { Clapperboard, UserCheck, LogIn } from "lucide-react";
import { User } from "firebase/auth";
import { BottomNav, TabId } from "./components/BottomNav";
import { RecommendedTab } from "./components/RecommendedTab";
import { TonightTab } from "./components/TonightTab";
import { WatchedTab } from "./components/WatchedTab";
import { WatchlistTab } from "./components/WatchlistTab";
import { TasteProfileTab } from "./components/TasteProfileTab";
import { RateMovieModal, RateMovieDraft } from "./components/RateMovieModal";
import { AuthModal } from "./components/AuthModal";
import {
  subscribeToAuthChanges,
  loadOrInitializeUserCloudData,
  saveUserCloudData,
  subscribeToUserCloudData,
  logoutFirebaseUser,
} from "./utils/firebase";
import {
  WatchedMovie,
  MovieRecommendation,
  EveningPreferences,
  TmdbMovieEnrichment,
  DEFAULT_WATCHED_MOVIES,
  DEFAULT_TASTE_PROFILE,
  ExportedAppData,
  normalizeMovieTitle,
  filterDuplicateRecommendations,
  generateSmartFallbackRecommendations,
  generateSmartFallbackTasteProfile,
  lookupCuratedTmdbMovie,
} from "./utils/movieLogic";

const STORAGE_KEYS = {
  WATCHED: "watchedMovies",
  WATCHLIST: "watchlist",
  TASTE_PROFILE: "tasteProfileSummary",
  RECOMMENDATIONS: "cineminde_recommendations",
  STREAMING_PROVIDERS: "cineminde_streaming_providers",
};

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
    const meta = lookupCuratedTmdbMovie(m.title, m.year);
    return {
      ...m,
      year: m.year || meta.year,
      tmdbId: m.tmdbId || meta.tmdbId,
      posterPath: m.posterPath || meta.posterPath,
      tmdbRating: m.tmdbRating || meta.voteAverage,
      swedishProviders: m.swedishProviders || meta.swedishProviders,
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
    };
  });
}

function loadInitialWatched(): WatchedMovie[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCHED);
    if (raw === null) {
      localStorage.setItem(
        STORAGE_KEYS.WATCHED,
        JSON.stringify(DEFAULT_WATCHED_MOVIES)
      );
      return DEFAULT_WATCHED_MOVIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? enrichWatchedWithCurated(parsed)
      : DEFAULT_WATCHED_MOVIES;
  } catch {
    return DEFAULT_WATCHED_MOVIES;
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
  watchlist: MovieRecommendation[]
): MovieRecommendation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return enrichRecsWithCurated(parsed);
      }
    }
  } catch {
    // Fallback below
  }
  return generateSmartFallbackRecommendations(watched, watchlist, {
    moods: [],
    genres: [],
    contents: [],
    frameworks: [],
    customText: "",
  });
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
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>(
    () => loadInitialRecommendations(watchedMovies, watchlist)
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
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [rateDraft, setRateDraft] = useState<RateMovieDraft | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isCloudHydratedRef = useRef(false);
  const skipNextCloudSaveRef = useRef(false);
  const watchedMoviesRef = useRef(watchedMovies);
  watchedMoviesRef.current = watchedMovies;
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const tasteProfileSummaryRef = useRef(tasteProfileSummary);
  tasteProfileSummaryRef.current = tasteProfileSummary;

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

      try {
        const cloudData = await loadOrInitializeUserCloudData(user.uid, {
          watchedMovies: watchedMoviesRef.current,
          watchlist: watchlistRef.current,
          tasteProfileSummary: tasteProfileSummaryRef.current,
        });
        skipNextCloudSaveRef.current = true;
        setWatchedMovies(enrichWatchedWithCurated(cloudData.watchedMovies));
        setWatchlist(enrichRecsWithCurated(cloudData.watchlist));
        setTasteProfileSummary(cloudData.tasteProfileSummary);
        isCloudHydratedRef.current = true;

        unsubscribeSnapshot = subscribeToUserCloudData(user.uid, (liveData) => {
          skipNextCloudSaveRef.current = true;
          setWatchedMovies(enrichWatchedWithCurated(liveData.watchedMovies));
          setWatchlist(enrichRecsWithCurated(liveData.watchlist));
          setTasteProfileSummary(liveData.tasteProfileSummary);
        });
      } catch {
        // Fallback to local state if Firestore is not yet enabled
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
    });
  }, [watchedMovies, watchlist, tasteProfileSummary, currentUser]);

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

  // Background TMDB enrichment for already saved movies in Watched, Watchlist, and Recommendations
  useEffect(() => {
    let cancelled = false;
    const runBackgroundEnrichment = async () => {
      const titlesToEnrich = new Map<string, { title: string; year?: string }>();
      for (const w of watchedMovies) {
        if (!w.posterPath || !w.swedishProviders) {
          titlesToEnrich.set(normalizeMovieTitle(w.title), {
            title: w.originalTitle || w.title,
            year: w.year,
          });
        }
      }
      for (const wl of watchlist) {
        if (!wl.posterPath || !wl.swedishProviders) {
          titlesToEnrich.set(normalizeMovieTitle(wl.title), {
            title: wl.originalTitle || wl.title,
            year: wl.year,
          });
        }
      }
      for (const r of recommendations) {
        if (!r.posterPath || !r.swedishProviders) {
          titlesToEnrich.set(normalizeMovieTitle(r.title), {
            title: r.originalTitle || r.title,
            year: r.year,
          });
        }
      }

      if (titlesToEnrich.size === 0) return;

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
            };
          })
        );
      } catch {
        // Ignore background enrichment errors
      }
    };

    runBackgroundEnrichment();
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  const handleFindMovies = async () => {
    setIsLoadingRecs(true);
    setRecsError(null);
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
        body: JSON.stringify({
          watchedMovies,
          watchlist,
          tasteProfileSummary,
          preferences,
          previousTitles: recommendations.map((r) => r.title),
        }),
      });

      if (!response.ok) {
        throw new Error("Kunde inte hämta rekommendationer");
      }

      const data = await response.json();
      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        const clean = filterDuplicateRecommendations(
          data.recommendations,
          watchedMovies,
          watchlist
        );
        if (clean.length > 0) {
          setRecommendations(enrichRecsWithCurated(clean));
        } else {
          const fallback = generateSmartFallbackRecommendations(
            watchedMovies,
            watchlist,
            preferences
          );
          setRecommendations(fallback);
        }
      } else {
        const fallback = generateSmartFallbackRecommendations(
          watchedMovies,
          watchlist,
          preferences
        );
        setRecommendations(fallback);
      }
    } catch {
      const fallback = generateSmartFallbackRecommendations(
        watchedMovies,
        watchlist,
        preferences
      );
      setRecommendations(fallback);
    } finally {
      setIsLoadingRecs(false);
    }
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
      showToast(`"${target.title}" togs bort från Watchlist`);
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
    });
  };

  const refreshTasteProfileInBackground = async (movies: WatchedMovie[]) => {
    setIsUpdatingProfile(true);
    try {
      const response = await fetch("/api/taste-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedMovies: movies }),
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
      const fallback = generateSmartFallbackTasteProfile(movies);
      setTasteProfileSummary(fallback);
    } finally {
      setIsUpdatingProfile(false);
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
    await logoutFirebaseUser();
    setCurrentUser(null);
    isCloudHydratedRef.current = false;
    showToast("Du har loggat ut");
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
        {toastMessage && (
          <div
            role="status"
            className="fixed top-[calc(env(safe-area-inset-top,0px)+1rem)] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#1e1e24] border border-white/[0.15] text-xs font-medium text-white shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <span>{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6] pb-28">
      <div className="max-w-md mx-auto px-4 pt-safe-top">
        {/* Compact Top Header */}
        <header className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e11d48]/15 border border-[#e11d48]/40 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4 h-4 text-[#e11d48]" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              CineMinde
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400 font-mono-num whitespace-nowrap">
              {watchedMovies.length} sedda · {watchlist.length} sparade
            </span>

            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                title={`Inloggad och synkad som ${currentUser.email || currentUser.displayName} (Klicka för smakprofil & konto)`}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/25 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[100px] truncate">
                  {currentUser.displayName || currentUser.email?.split("@")[0] || "Synkad"}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Feedback Toast Banner */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 px-4 py-2.5 rounded-xl bg-[#16161a] border border-[#f59e0b]/40 text-xs font-medium text-[#f59e0b] text-center shadow-lg"
          >
            {toastMessage}
          </div>
        )}

        {/* Active Tab View */}
        <main>
          {activeTab === "recommended" && (
            <RecommendedTab
              watchedMovies={watchedMovies}
              watchlist={watchlist}
              tasteProfileSummary={tasteProfileSummary}
              onAddToWatchlist={handleAddToWatchlist}
              onMarkAsWatched={handleOpenRateFromRecommendation}
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
              onAddToWatchlist={handleAddToWatchlist}
              onMarkAsWatched={handleOpenRateFromRecommendation}
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
              isUpdatingProfile={isUpdatingProfile}
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

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

      {/* Firebase Account Login & Cloud Sync Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(msg) => showToast(msg)}
      />
    </div>
  );
}
