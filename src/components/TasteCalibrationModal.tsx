import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Ban,
  SkipForward,
  Undo2,
  Film,
  Tv,
  Check,
} from "lucide-react";
import {
  WatchedMovie,
  DismissedMovie,
  CalibrationVerdict,
  TasteCalibrationItem,
  TmdbMovieEnrichment,
  getTasteCalibrationDeck,
  buildWatchedMovieFromCalibration,
  buildDismissedMovieFromCalibration,
  normalizeMovieTitle,
} from "../utils/movieLogic";
import { MoviePoster } from "./MovieVisuals";

export interface TasteCalibrationResult {
  watched: WatchedMovie[];
  dismissed: DismissedMovie[];
}

interface TasteCalibrationModalProps {
  isOpen: boolean;
  watchedMovies: WatchedMovie[];
  dismissedMovies?: DismissedMovie[];
  onClose: () => void;
  onComplete: (result: TasteCalibrationResult) => void;
}

type DeckItem = TasteCalibrationItem & TmdbMovieEnrichment;

interface CalibrationDecision {
  item: DeckItem;
  verdict: CalibrationVerdict;
  watchedEntry?: WatchedMovie;
  dismissedEntry?: DismissedMovie;
}

export const TasteCalibrationModal: React.FC<TasteCalibrationModalProps> = ({
  isOpen,
  watchedMovies,
  dismissedMovies = [],
  onClose,
  onComplete,
}) => {
  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<CalibrationDecision[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const wasOpenRef = useRef(false);

  // Freeze the calibration deck when the modal opens so background cloud syncs
  // never reshuffle or shift cards mid-session.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const initialDeck = getTasteCalibrationDeck(
        watchedMovies,
        10,
        dismissedMovies
      );
      setDeck(initialDeck);
      setCurrentIndex(0);
      setDecisions([]);
      setShowExitConfirm(false);

      // Enrich any calibration cards missing posterPath in the background
      const missingPosters = initialDeck.filter((item) => !item.posterPath);
      if (missingPosters.length > 0) {
        let cancelled = false;
        const enrichDeck = async () => {
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
                movies: missingPosters.map((m) => ({
                  title: m.originalTitle || m.title,
                  year: m.year,
                  mediaType: m.mediaType,
                })),
              }),
            });
            if (!res.ok || cancelled) return;
            const data = await res.json();
            const enrichedList: TmdbMovieEnrichment[] = Array.isArray(data.enriched)
              ? data.enriched
              : [];
            if (enrichedList.length === 0 || cancelled) return;

            setDeck((prev) =>
              prev.map((card) => {
                const n1 = normalizeMovieTitle(card.title);
                const n2 = normalizeMovieTitle(card.originalTitle);
                const hit = enrichedList.find(
                  (e) =>
                    normalizeMovieTitle(e.title) === n1 ||
                    normalizeMovieTitle(e.originalTitle) === n1 ||
                    (n2 &&
                      (normalizeMovieTitle(e.title) === n2 ||
                        normalizeMovieTitle(e.originalTitle) === n2))
                );
                if (!hit) return card;
                return {
                  ...card,
                  tmdbId: hit.tmdbId || card.tmdbId,
                  posterPath: hit.posterPath || card.posterPath,
                  voteAverage: hit.voteAverage || card.voteAverage,
                  swedishProviders: hit.swedishProviders || card.swedishProviders,
                  tmdbGenreIds: hit.tmdbGenreIds || card.tmdbGenreIds,
                  tmdbGenres: hit.tmdbGenres || card.tmdbGenres,
                  ageRating: hit.ageRating || card.ageRating,
                };
              })
            );
          } catch {
            // Keep graceful poster placeholder on failure
          }
        };
        void enrichDeck();
        return () => {
          cancelled = true;
        };
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, watchedMovies, dismissedMovies]);

  const collectedWatched = decisions
    .map((d) => d.watchedEntry)
    .filter((w): w is WatchedMovie => Boolean(w));
  const collectedDismissed = decisions
    .map((d) => d.dismissedEntry)
    .filter((d): d is DismissedMovie => Boolean(d));
  const totalSavedSignals = collectedWatched.length + collectedDismissed.length;

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (totalSavedSignals > 0) {
          setShowExitConfirm(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, totalSavedSignals, onClose]);

  if (!isOpen) return null;

  const currentItem = deck[currentIndex];
  const isFinished = deck.length === 0 || currentIndex >= deck.length;
  const progressPercent =
    deck.length > 0
      ? Math.min(100, Math.round((currentIndex / deck.length) * 100))
      : 100;

  const commitResults = (
    watched: WatchedMovie[],
    dismissed: DismissedMovie[]
  ) => {
    if (watched.length > 0 || dismissed.length > 0) {
      onComplete({ watched, dismissed });
    } else {
      onClose();
    }
  };

  const handleVerdict = (verdict: CalibrationVerdict) => {
    if (!currentItem) return;
    setShowExitConfirm(false);

    let watchedEntry: WatchedMovie | undefined;
    let dismissedEntry: DismissedMovie | undefined;

    if (verdict === "love" || verdict === "like" || verdict === "dislike") {
      watchedEntry = buildWatchedMovieFromCalibration(currentItem, verdict);
    } else if (verdict === "not_my_style") {
      dismissedEntry = buildDismissedMovieFromCalibration(currentItem);
    }

    const nextDecisions: CalibrationDecision[] = [
      ...decisions,
      { item: currentItem, verdict, watchedEntry, dismissedEntry },
    ];
    setDecisions(nextDecisions);

    const nextIdx = currentIndex + 1;
    if (nextIdx >= deck.length) {
      const finalWatched = nextDecisions
        .map((d) => d.watchedEntry)
        .filter((w): w is WatchedMovie => Boolean(w));
      const finalDismissed = nextDecisions
        .map((d) => d.dismissedEntry)
        .filter((d): d is DismissedMovie => Boolean(d));
      commitResults(finalWatched, finalDismissed);
    } else {
      setCurrentIndex(nextIdx);
    }
  };

  const handleUndo = () => {
    if (currentIndex === 0 || decisions.length === 0) return;
    setShowExitConfirm(false);
    setDecisions((prev) => prev.slice(0, -1));
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleRequestClose = () => {
    if (totalSavedSignals > 0 && !isFinished) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleFinishEarly = () => {
    commitResults(collectedWatched, collectedDismissed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Snabb smak-kalibrering"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleRequestClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-[#16161a] border border-white/[0.1] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#f59e0b]" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Snabb smak-kalibrering
              </h2>
              <p className="text-[11px] text-zinc-400">
                {deck.length > 0 && !isFinished
                  ? `Kort ${currentIndex + 1} av ${deck.length} · ${totalSavedSignals} val gjorda`
                  : "Kalibrera din profil på 30 sekunder"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Stäng smak-kalibrering"
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        {deck.length > 0 && (
          <div className="w-full h-1 bg-white/[0.06]">
            <div
              className="h-full bg-gradient-to-r from-[#e11d48] to-[#f59e0b] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Unsaved exit confirmation banner */}
        {showExitConfirm && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <p className="text-xs text-amber-200 font-medium">
              Du har {totalSavedSignals} osparade val. Vill du spara dem innan du stänger?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFinishEarly}
                className="flex-1 min-h-[34px] px-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-[11px] font-semibold text-white cursor-pointer"
              >
                Spara & stäng
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[34px] px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-medium text-zinc-300 cursor-pointer"
              >
                Kasta
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="min-h-[34px] px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-zinc-400 cursor-pointer"
              >
                Fortsätt
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-5">
          {isFinished ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Du har redan kalibrerat alla titlar!
                </h3>
                <p className="text-xs text-zinc-400">
                  Din smakprofil har redan gott om underlag för skräddarsydda förslag.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Stäng
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Card preview */}
              <div className="flex gap-4 items-center bg-[#0e0e12] border border-white/[0.08] rounded-2xl p-3.5">
                <div className="w-24 shrink-0">
                  <MoviePoster
                    title={currentItem.title}
                    posterPath={currentItem.posterPath}
                    size="w185"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-medium text-zinc-300">
                      {currentItem.mediaType === "tv" ? (
                        <>
                          <Tv className="w-3 h-3 text-[#f59e0b]" />
                          <span>TV-serie</span>
                        </>
                      ) : (
                        <>
                          <Film className="w-3 h-3 text-[#e11d48]" />
                          <span>Film</span>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] font-mono-num text-zinc-400">
                      {currentItem.year}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white leading-snug">
                    {currentItem.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {currentItem.vibeSummary}
                  </p>
                </div>
              </div>

              {/* 4 clear verdict buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleVerdict("love")}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-semibold text-emerald-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-emerald-400/40 text-emerald-400 shrink-0" />
                  <span>Älskar (5★)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerdict("like")}
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-semibold text-amber-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ThumbsUp className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Bra (4★)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerdict("dislike")}
                  title="Loggas som sedd med 2★ (Gillade inte)"
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-semibold text-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ThumbsDown className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Gillade inte (2★)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerdict("not_my_style")}
                  title="Styr bort från liknande utan att lägga till i Sedda"
                  className="min-h-[48px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.12] text-xs font-medium text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Inte min grej</span>
                </button>
              </div>

              {/* Undo & Skip row */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={currentIndex === 0}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    currentIndex === 0
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                  }`}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Tillbaka</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerdict("unseen")}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ej sett · Hoppa över</span>
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Footer action */}
              {totalSavedSignals > 0 && (
                <button
                  type="button"
                  onClick={handleFinishEarly}
                  className="w-full min-h-[42px] rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Klar – spara {totalSavedSignals} val & uppdatera profil
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
