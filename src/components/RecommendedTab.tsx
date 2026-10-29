import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Compass,
  Heart,
  X,
  RotateCcw,
  Sparkles,
  Film,
  Tv,
  Star,
  CheckCircle2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Layers,
  Check,
  Plus,
} from "lucide-react";
import {
  MovieRecommendation,
  WatchedMovie,
  getTmdbPosterUrl,
  normalizeMovieTitle,
} from "../utils/movieLogic";
import { MoviePoster, SwedishStreamingSection } from "./MovieVisuals";

interface RecommendedTabProps {
  watchedMovies: WatchedMovie[];
  watchlist: MovieRecommendation[];
  tasteProfileSummary: string;
  onAddToWatchlist: (movie: MovieRecommendation) => void;
  onMarkAsWatched: (movie: MovieRecommendation) => void;
  onGoToWatchlist: () => void;
}

export const RecommendedTab: React.FC<RecommendedTabProps> = ({
  watchedMovies,
  watchlist,
  tasteProfileSummary,
  onAddToWatchlist,
  onMarkAsWatched,
  onGoToWatchlist,
}) => {
  const [deck, setDeck] = useState<MovieRecommendation[]>([]);
  const [history, setHistory] = useState<{
    movie: MovieRecommendation;
    action: "like" | "skip";
  }[]>([]);
  const [seenTitles, setSeenTitles] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setRecsError] = useState<string | null>(null);
  const [showFullInfo, setShowFullInfo] = useState(false);

  // Overview modal state (browse recommendations & restore swiped cards)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [overviewTab, setOverviewTab] = useState<"queue" | "history">("queue");

  // Drag interaction state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipingCard, setSwipingCard] = useState<"like" | "skip" | null>(null);

  const startXRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Fetch a batch of recommendations based purely on the taste profile
  const fetchMoreRecommendations = useCallback(
    async (isInitial = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsLoading(true);
      setRecsError(null);

      try {
        const previousTitles = Array.from(seenTitles);
        const storedTmdbKey = localStorage.getItem("tmdbApiKey") || "";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (storedTmdbKey) {
          headers["x-tmdb-key"] = storedTmdbKey;
        }

        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            watchedMovies,
            watchlist,
            tasteProfileSummary,
            preferences: {
              moods: [],
              genres: [],
              contents: [],
              frameworks: [],
              customText: "",
              streamingProviders: [],
              mediaType: "any",
            },
            previousTitles,
            limit: 10,
          }),
        });

        if (!res.ok) {
          throw new Error("Kunde inte hämta rekommendationer just nu.");
        }

        const data = await res.json();
        const incoming = Array.isArray(data.recommendations)
          ? (data.recommendations as MovieRecommendation[])
          : [];

        // Exclude movies already in watched or watchlist
        const watchedOrWatchlist = new Set([
          ...watchedMovies.map((m) => normalizeMovieTitle(m.title)),
          ...watchlist.map((m) => normalizeMovieTitle(m.title)),
        ]);

        const existingNorms = new Set([
          ...watchedOrWatchlist,
          ...seenTitles,
        ]);

        let filtered = incoming.filter((r) => {
          const norm = normalizeMovieTitle(r.title);
          return !existingNorms.has(norm);
        });

        // If all incoming were in seenTitles but deck is empty, allow cycling through un-saved recommendations
        if (filtered.length === 0 && incoming.length > 0) {
          filtered = incoming.filter((r) => {
            const norm = normalizeMovieTitle(r.title);
            return !watchedOrWatchlist.has(norm);
          });
        }

        setDeck((prev) => (isInitial ? filtered : [...prev, ...filtered]));

        // Track seen titles
        setSeenTitles((prev) => {
          const next = new Set(prev);
          for (const item of filtered) {
            next.add(normalizeMovieTitle(item.title));
            if (item.originalTitle) {
              next.add(normalizeMovieTitle(item.originalTitle));
            }
          }
          return next;
        });
      } catch (err: unknown) {
        setRecsError(
          err instanceof Error
            ? err.message
            : "Kunde inte ladda fler rekommendationer."
        );
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [watchedMovies, watchlist, tasteProfileSummary, seenTitles]
  );

  // Initial load
  useEffect(() => {
    if (deck.length === 0 && !isFetchingRef.current) {
      void fetchMoreRecommendations(true);
    }
  }, []); // Run on mount

  // Auto-fetch more cards when running low
  useEffect(() => {
    if (deck.length > 0 && deck.length <= 2 && !isLoading && !isFetchingRef.current) {
      void fetchMoreRecommendations(false);
    }
  }, [deck.length, isLoading, fetchMoreRecommendations]);

  const currentCard = deck[0];
  const nextCard = deck[1];

  const handleSwipe = (direction: "like" | "skip") => {
    if (!currentCard || swipingCard) return;

    setSwipingCard(direction);

    // Let animation play out smoothly
    setTimeout(() => {
      if (direction === "like") {
        onAddToWatchlist(currentCard);
      }

      setHistory((prev) => [
        ...prev,
        { movie: currentCard, action: direction },
      ]);
      setDeck((prev) => prev.slice(1));
      setDragX(0);
      setIsDragging(false);
      setSwipingCard(null);
      setShowFullInfo(false);
    }, 280);
  };

  const isMovieInWatchlist = (movie: MovieRecommendation) => {
    const norm = normalizeMovieTitle(movie.title);
    return watchlist.some((w) => normalizeMovieTitle(w.title) === norm);
  };

  const handleSelectCard = (movie: MovieRecommendation) => {
    setDeck((prev) => [movie, ...prev.filter((m) => m.id !== movie.id)]);
    setIsOverviewOpen(false);
    setDragX(0);
    setShowFullInfo(false);
  };

  const handleRestoreFromHistory = (index: number) => {
    const target = history[index];
    if (!target) return;
    setHistory((prev) => prev.filter((_, idx) => idx !== index));
    setDeck((prev) => [
      target.movie,
      ...prev.filter((m) => m.id !== target.movie.id),
    ]);
    setIsOverviewOpen(false);
    setDragX(0);
    setShowFullInfo(false);
  };

  const handleUndo = () => {
    if (history.length === 0 || swipingCard) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setDeck((prev) => [last.movie, ...prev]);
    setDragX(0);
    setShowFullInfo(false);
  };

  // Touch and pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipingCard) return;
    setIsDragging(true);
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || swipingCard) return;
    const diff = e.clientX - startXRef.current;
    setDragX(diff);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || swipingCard) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture release error
    }

    if (dragX > 85) {
      handleSwipe("like");
    } else if (dragX < -85) {
      handleSwipe("skip");
    } else {
      setDragX(0);
    }
  };

  // Opacities for LIKE / NOPE badges
  const likeBadgeOpacity = Math.max(0, Math.min(1, (dragX - 20) / 70));
  const nopeBadgeOpacity = Math.max(0, Math.min(1, (-dragX - 20) / 70));

  // Card transform styles
  const getTopCardStyle = () => {
    if (swipingCard === "like") {
      return {
        transform: "translateX(450px) rotate(22deg)",
        opacity: 0,
        transition: "transform 0.28s ease-in, opacity 0.25s ease-in",
      };
    }
    if (swipingCard === "skip") {
      return {
        transform: "translateX(-450px) rotate(-22deg)",
        opacity: 0,
        transition: "transform 0.28s ease-in, opacity 0.25s ease-in",
      };
    }
    if (isDragging) {
      return {
        transform: `translateX(${dragX}px) rotate(${dragX * 0.07}deg)`,
        transition: "none",
      };
    }
    return {
      transform: "translateX(0px) rotate(0deg)",
      transition: "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    };
  };

  return (
    <div className="space-y-4 max-w-sm mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-1.5">
            <Compass className="w-5 h-5 text-[#e11d48]" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Rekommenderat för dig
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Baserat helt på din personliga smakprofil
          </p>
        </div>

        {deck.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setOverviewTab("queue");
              setIsOverviewOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.08] text-[11px] font-mono-num font-semibold transition-colors cursor-pointer"
            title="Visa alla rekommendationer i kön"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>{deck.length} kvar</span>
          </button>
        )}
      </div>

      {/* Main Tinder Card Deck Area */}
      <div className="relative min-h-[530px] w-full flex items-center justify-center">
        {isLoading && deck.length === 0 ? (
          <div className="w-full h-[520px] rounded-3xl bg-[#16161a] border border-white/[0.08] p-6 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#e11d48] animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">
                Analyserar din smakprofil...
              </p>
              <p className="text-xs text-zinc-400 max-w-xs">
                Letar fram filmer och serier som matchar dina sedda favoriter.
              </p>
            </div>
          </div>
        ) : !currentCard ? (
          // Empty State / End of Deck
          <div className="w-full rounded-3xl bg-[#16161a] border border-white/[0.08] p-7 flex flex-col items-center justify-center text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-white">
                Du har gått igenom alla förslag!
              </h2>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Vi har gått igenom alla titlar i denna omgång. Klicka nedan för
                att hämta 10 nya skräddarsydda filmer och serier.
              </p>
            </div>

            <div className="w-full space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => fetchMoreRecommendations(false)}
                disabled={isLoading}
                className="w-full min-h-[46px] rounded-2xl bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Hämta 10 nya förslag</span>
              </button>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOverviewTab("history");
                    setIsOverviewOpen(true);
                  }}
                  className="w-full min-h-[42px] rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-300 font-medium text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Visa swipade titlar ({history.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onGoToWatchlist}
                className="w-full min-h-[42px] rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 font-medium text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Bookmark className="w-4 h-4 text-[#f59e0b]" />
                <span>Öppna Watchlist ({watchlist.length})</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-[520px]">
            {/* Background Card (Peek) */}
            {nextCard && (
              <div
                className="absolute inset-0 rounded-3xl bg-[#141418] border border-white/[0.06] overflow-hidden select-none pointer-events-none transform scale-[0.94] translate-y-3 opacity-60 shadow-lg"
                style={{ zIndex: 1 }}
              >
                {nextCard.posterPath && (
                  <img
                    src={getTmdbPosterUrl(nextCard.posterPath, "w500") || ""}
                    alt=""
                    className="w-full h-full object-cover filter blur-[1px] brightness-[0.7]"
                  />
                )}
              </div>
            )}

            {/* Top Interactive Card */}
            <div
              key={currentCard.id || currentCard.title}
              style={{ ...getTopCardStyle(), zIndex: 10 }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute inset-0 rounded-3xl bg-[#16161a] border border-white/[0.12] overflow-hidden flex flex-col justify-between shadow-2xl cursor-grab active:cursor-grabbing touch-none"
            >
              {/* Poster Background with Vignette Gradient */}
              <div className="absolute inset-0 pointer-events-none">
                {currentCard.posterPath ? (
                  <img
                    src={getTmdbPosterUrl(currentCard.posterPath, "w500") || ""}
                    alt={currentCard.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-zinc-800 via-zinc-900 to-black flex items-center justify-center p-6 text-center">
                    <Film className="w-16 h-16 text-zinc-600 mb-2" />
                  </div>
                )}

                {/* Gradient overlays for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/70 to-transparent" />
                <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
              </div>

              {/* LIKE & NOPE Stamps Overlay */}
              <div
                style={{
                  opacity:
                    swipingCard === "like" ? 1 : likeBadgeOpacity,
                }}
                className="absolute top-8 left-6 z-30 pointer-events-none transform -rotate-12 border-2 border-emerald-400 bg-emerald-950/80 backdrop-blur-md px-3.5 py-1 rounded-xl shadow-lg transition-opacity duration-150"
              >
                <span className="text-sm font-extrabold tracking-wider text-emerald-300">
                  SPARA TILL WATCHLIST
                </span>
              </div>

              <div
                style={{
                  opacity:
                    swipingCard === "skip" ? 1 : nopeBadgeOpacity,
                }}
                className="absolute top-8 right-6 z-30 pointer-events-none transform rotate-12 border-2 border-rose-500 bg-rose-950/80 backdrop-blur-md px-3.5 py-1 rounded-xl shadow-lg transition-opacity duration-150"
              >
                <span className="text-sm font-extrabold tracking-wider text-rose-300">
                  HOPPA ÖVER
                </span>
              </div>

              {/* Top Header Badges on Card */}
              <div className="relative z-20 p-4 flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-sm">
                    {currentCard.matchPercentage}% Match
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/60 text-zinc-200 border border-white/[0.1] backdrop-blur-md inline-flex items-center gap-1">
                    {currentCard.mediaType === "tv" ? (
                      <Tv className="w-3 h-3 text-[#f59e0b]" />
                    ) : (
                      <Film className="w-3 h-3 text-[#f59e0b]" />
                    )}
                    <span>
                      {currentCard.mediaType === "tv" ? "Serie" : "Film"}
                    </span>
                  </span>
                </div>

                {currentCard.tmdbRating && (
                  <span className="px-2 py-1 rounded-full text-[11px] font-mono-num font-semibold bg-black/60 text-amber-300 border border-amber-500/30 backdrop-blur-md inline-flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{currentCard.tmdbRating}</span>
                  </span>
                )}
              </div>

              {/* Bottom Content Area */}
              <div className="relative z-20 p-5 space-y-3 pointer-events-auto">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xl font-bold font-display text-white leading-tight drop-shadow-md">
                      {currentCard.title}
                    </h3>
                    {currentCard.year && (
                      <span className="text-xs text-zinc-400 font-mono-num shrink-0">
                        {currentCard.year}
                      </span>
                    )}
                  </div>
                  {currentCard.runtime && (
                    <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                      {currentCard.runtime}
                    </p>
                  )}
                </div>

                {/* Swedish Streaming Providers */}
                {currentCard.swedishProviders && (
                  <SwedishStreamingSection
                    swedishProviders={currentCard.swedishProviders}
                  />
                )}

                {/* Personalized Reason from Taste Profile */}
                {currentCard.whyYouWillLikeIt && (
                  <div className="bg-[#121216]/90 border border-white/[0.09] rounded-2xl p-3 backdrop-blur-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#e11d48]">
                        Varför du gillar den
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullInfo(!showFullInfo);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        {showFullInfo ? (
                          <>
                            <span>Mindre</span>
                            <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <span>Mer</span>
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    <p
                      className={`text-xs text-zinc-300 leading-relaxed ${
                        showFullInfo ? "" : "line-clamp-2"
                      }`}
                    >
                      {currentCard.whyYouWillLikeIt}
                    </p>
                  </div>
                )}

                {/* Vibe Tags */}
                {Array.isArray(currentCard.vibeTags) &&
                  currentCard.vibeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {currentCard.vibeTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-white/[0.08] text-zinc-300 border border-white/[0.06]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons (Tinder Style) */}
      {currentCard && (
        <div className="flex items-center justify-center gap-5 pt-1">
          {/* Overview / Rekommendationslista & Historik-knapp */}
          <button
            type="button"
            onClick={() => {
              if (history.length > 0 && deck.length === 0) {
                setOverviewTab("history");
              } else {
                setOverviewTab("queue");
              }
              setIsOverviewOpen(true);
            }}
            disabled={deck.length === 0 && history.length === 0}
            aria-label="Visa rekommenderade titlar och swipade kort"
            title="Visa rekommendationslista"
            className="w-12 h-12 rounded-full bg-[#18181c] border border-white/[0.1] text-amber-400 hover:text-amber-300 hover:border-amber-400/40 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer relative"
          >
            <Layers className="w-5 h-5" />
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold font-mono-num flex items-center justify-center shadow">
                {history.length}
              </span>
            )}
          </button>

          {/* Swipe Left (Skip / Nope) */}
          <button
            type="button"
            onClick={() => handleSwipe("skip")}
            disabled={Boolean(swipingCard)}
            aria-label="Hoppa över titel"
            title="Hoppa över"
            className="w-16 h-16 rounded-full bg-[#1e1418] border border-rose-500/40 text-rose-400 hover:text-rose-300 hover:border-rose-500/80 hover:bg-rose-950/40 disabled:opacity-50 flex items-center justify-center transition-transform active:scale-95 shadow-lg shadow-rose-950/30 cursor-pointer"
          >
            <X className="w-8 h-8 stroke-[2.5]" />
          </button>

          {/* Swipe Right (Save / Like) */}
          <button
            type="button"
            onClick={() => handleSwipe("like")}
            disabled={Boolean(swipingCard)}
            aria-label="Spara till Watchlist"
            title="Spara till Watchlist"
            className="w-16 h-16 rounded-full bg-[#121f18] border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/80 hover:bg-emerald-950/40 disabled:opacity-50 flex items-center justify-center transition-transform active:scale-95 shadow-lg shadow-emerald-950/30 cursor-pointer"
          >
            <Heart className="w-8 h-8 fill-emerald-400/30 stroke-[2.5]" />
          </button>

          {/* Mark as Watched Button */}
          <button
            type="button"
            onClick={() => onMarkAsWatched(currentCard)}
            disabled={Boolean(swipingCard)}
            aria-label="Markera som redan sedd och sätt betyg"
            title="Redan sett"
            className="w-12 h-12 rounded-full bg-[#18181c] border border-white/[0.1] text-zinc-300 hover:text-white hover:border-white/[0.25] disabled:opacity-30 flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Swipe tip text */}
      {currentCard && (
        <p className="text-[11px] text-zinc-500 text-center font-medium">
          Dra kortet till höger för att spara · Dra till vänster för att hoppa över
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-400 text-center pt-1">{error}</p>
      )}

      {/* Overview Modal: Browse recommendations & restore swiped cards */}
      {isOverviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rekommenderade titlar och historik"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsOverviewOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141418] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-none">
                    Rekommendationer & Historik
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Bläddra bland förslagen eller gå tillbaka till swipade titlar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOverviewOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Stäng dialogruta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.08] px-4 pt-2 gap-2 bg-[#101014]">
              <button
                type="button"
                onClick={() => setOverviewTab("queue")}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  overviewTab === "queue"
                    ? "border-[#e11d48] text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>Kommande i listan</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/[0.08] text-[10px] font-mono-num text-zinc-300">
                  {deck.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOverviewTab("history")}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  overviewTab === "history"
                    ? "border-amber-400 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>Nyss passerade</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/[0.08] text-[10px] font-mono-num text-zinc-300">
                  {history.length}
                </span>
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-white/[0.05]">
              {overviewTab === "queue" ? (
                deck.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm text-zinc-400">
                      Inga fler titlar i kön just nu.
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchMoreRecommendations(false)}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Hämta 10 nya förslag</span>
                    </button>
                  </div>
                ) : (
                  deck.map((movie, index) => {
                    const inWatchlist = isMovieInWatchlist(movie);
                    const isFirst = index === 0;

                    return (
                      <div
                        key={movie.id || `${movie.title}-${index}`}
                        className={`pt-3 first:pt-0 flex gap-3 items-start rounded-2xl p-2 transition-colors ${
                          isFirst
                            ? "bg-white/[0.03] border border-amber-500/20"
                            : ""
                        }`}
                      >
                        <MoviePoster
                          title={movie.title}
                          year={movie.year}
                          posterPath={movie.posterPath}
                          size="w185"
                          className="w-16 h-24 rounded-xl shrink-0"
                        />

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm font-bold text-white leading-tight">
                                  {movie.title}
                                </h4>
                                {isFirst && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Aktivt kort
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                                {movie.year && <span>{movie.year}</span>}
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  {movie.mediaType === "tv" ? (
                                    <Tv className="w-3 h-3 text-[#f59e0b]" />
                                  ) : (
                                    <Film className="w-3 h-3 text-[#f59e0b]" />
                                  )}
                                  {movie.mediaType === "tv" ? "Serie" : "Film"}
                                </span>
                                {movie.tmdbRating && (
                                  <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-0.5 text-amber-300 font-mono-num">
                                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                      {movie.tmdbRating}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              {movie.matchPercentage}%
                            </span>
                          </div>

                          {movie.whyYouWillLikeIt && (
                            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                              {movie.whyYouWillLikeIt}
                            </p>
                          )}

                          {movie.swedishProviders && (
                            <div className="pt-0.5">
                              <SwedishStreamingSection
                                swedishProviders={movie.swedishProviders}
                              />
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSelectCard(movie)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Compass className="w-3.5 h-3.5 text-[#e11d48]" />
                              <span>
                                {isFirst ? "Visa på kort" : "Välj som aktivt kort"}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onAddToWatchlist(movie)}
                              disabled={inWatchlist}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                inWatchlist
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                  : "bg-[#e11d48]/15 hover:bg-[#e11d48]/25 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {inWatchlist ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>I Watchlist</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Watchlist</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : history.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm text-zinc-400">
                    Du har inte swipat några titlar än.
                  </p>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                    När du swipar sparas titlarna här så att du alltid kan gå
                    tillbaka om du råkade swipa fel eller vill se en titel igen.
                  </p>
                </div>
              ) : (
                // Reverse history so latest swiped is at the top
                [...history].reverse().map((entry, revIndex) => {
                  const originalIndex = history.length - 1 - revIndex;
                  const { movie, action } = entry;
                  const inWatchlist = isMovieInWatchlist(movie);

                  return (
                    <div
                      key={`hist-${movie.id || movie.title}-${originalIndex}`}
                      className="pt-3 first:pt-0 flex gap-3 items-start"
                    >
                      <MoviePoster
                        title={movie.title}
                        year={movie.year}
                        posterPath={movie.posterPath}
                        size="w185"
                        className="w-16 h-24 rounded-xl shrink-0"
                      />

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h4 className="text-sm font-bold text-white leading-tight">
                              {movie.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                              {movie.year && <span>{movie.year}</span>}
                              <span>·</span>
                              <span>
                                {movie.mediaType === "tv" ? "Serie" : "Film"}
                              </span>
                              <span>·</span>
                              <span className="text-emerald-400 font-medium">
                                {movie.matchPercentage}% Match
                              </span>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 shrink-0 ${
                              action === "like"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {action === "like" ? (
                              <>
                                <Heart className="w-2.5 h-2.5 fill-current" />
                                <span>Sparad</span>
                              </>
                            ) : (
                              <>
                                <X className="w-2.5 h-2.5" />
                                <span>Hoppad över</span>
                              </>
                            )}
                          </span>
                        </div>

                        {movie.whyYouWillLikeIt && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {movie.whyYouWillLikeIt}
                          </p>
                        )}

                        {movie.swedishProviders && (
                          <div className="pt-0.5">
                            <SwedishStreamingSection
                              swedishProviders={movie.swedishProviders}
                            />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleRestoreFromHistory(originalIndex)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Flytta tillbaka till toppen av korten så du kan swipa den igen"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Återställ till korten</span>
                          </button>

                          {!inWatchlist && (
                            <button
                              type="button"
                              onClick={() => onAddToWatchlist(movie)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Watchlist</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0d0d10] border-t border-white/[0.08] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  void fetchMoreRecommendations(false);
                }}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#e11d48]" />
                <span>Hämta 10 fler</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOverviewOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.15] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
