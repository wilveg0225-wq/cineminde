import React, { useState, useEffect } from "react";
import { Star, ThumbsUp, ThumbsDown, X, Check } from "lucide-react";
import {
  QUALITY_TAGS,
  WatchedMovie,
  SwedishWatchProviders,
} from "../utils/movieLogic";
import { MoviePoster } from "./MovieVisuals";

export interface RateMovieDraft {
  id?: string;
  title: string;
  originalTitle?: string;
  year?: string;
  mediaType?: "movie" | "tv";
  initialRating?: number;
  initialLiked?: boolean;
  initialTags?: string[];
  initialThoughts?: string;
  fromWatchlistId?: string;
  tmdbId?: number;
  posterPath?: string;
  tmdbRating?: number;
  swedishProviders?: SwedishWatchProviders;
}

interface RateMovieModalProps {
  draft: RateMovieDraft | null;
  onClose: () => void;
  onSave: (
    movie: Omit<WatchedMovie, "id" | "addedAt">,
    existingId?: string,
    fromWatchlistId?: string
  ) => void;
}

export const RateMovieModal: React.FC<RateMovieModalProps> = ({
  draft,
  onClose,
  onSave,
}) => {
  const [rating, setRating] = useState<number>(4);
  const [liked, setLiked] = useState<boolean>(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState<string>("");
  const [year, setYear] = useState<string>("");

  useEffect(() => {
    if (draft) {
      setRating(draft.initialRating ?? 4);
      setLiked(draft.initialLiked ?? true);
      setSelectedTags(draft.initialTags ?? []);
      setThoughts(draft.initialThoughts ?? "");
      setYear(draft.year ?? "");
    }
  }, [draft]);

  if (!draft) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleStarClick = (starValue: number) => {
    setRating(starValue);
    setLiked(starValue >= 3);
  };

  const handleLikedToggle = (isLiked: boolean) => {
    setLiked(isLiked);
    if (isLiked && rating < 3) {
      setRating(4);
    } else if (!isLiked && rating >= 3) {
      setRating(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      {
        title: draft.title.trim(),
        originalTitle: draft.originalTitle?.trim() || draft.title.trim(),
        year: year.trim() || undefined,
        mediaType: draft.mediaType,
        rating,
        liked,
        tags: selectedTags,
        thoughts: thoughts.trim() || undefined,
        tmdbId: draft.tmdbId,
        posterPath: draft.posterPath,
        tmdbRating: draft.tmdbRating,
        swedishProviders: draft.swedishProviders,
      },
      draft.id,
      draft.fromWatchlistId
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-modal-title"
    >
      <div className="w-full max-w-md bg-[#16161a] border-t sm:border border-white/[0.1] rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-5 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Top grab handle for iOS sheet feel */}
        <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <MoviePoster
              title={draft.title}
              year={draft.year}
              posterPath={draft.posterPath}
              size="w185"
              className="w-12 h-18"
            />
            <div>
              <p className="text-xs text-[#f59e0b] font-medium tracking-wide">
                Betygsätt & förfina din smakprofil
              </p>
              <h2
                id="rate-modal-title"
                className="text-lg font-bold text-white mt-0.5 leading-snug"
              >
                {draft.title}
              </h2>
              {draft.year && (
                <p className="text-xs text-zinc-400 font-mono-num mt-0.5">
                  {draft.year}
                  {draft.tmdbRating ? ` · TMDB ${draft.tmdbRating.toFixed(1)}` : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng betygsfönster"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Betyg: 1-5 stjärnor + Gillade / Gillade inte */}
          <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-2xl p-4">
            <label className="block text-xs font-semibold text-zinc-300 mb-3">
              1. Ditt betyg på filmen
            </label>

            <div className="flex items-center justify-between gap-2 mb-3">
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Välj antal stjärnor från 1 till 5"
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= rating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(star)}
                      aria-label={`${star} av 5 stjärnor`}
                      aria-pressed={rating === star}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/[0.05] transition-transform active:scale-95 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          active
                            ? "fill-[#f59e0b] text-[#f59e0b]"
                            : "text-zinc-600"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-sm font-mono-num font-semibold text-[#f59e0b]">
                {rating} / 5
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => handleLikedToggle(true)}
                aria-pressed={liked}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  liked
                    ? "bg-[#e11d48]/20 text-white border border-[#e11d48]"
                    : "bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:text-zinc-200"
                }`}
              >
                <ThumbsUp className="w-4 h-4 text-[#f59e0b]" />
                <span>Gillade</span>
              </button>
              <button
                type="button"
                onClick={() => handleLikedToggle(false)}
                aria-pressed={!liked}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  !liked
                    ? "bg-zinc-800 text-white border border-zinc-500"
                    : "bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:text-zinc-200"
                }`}
              >
                <ThumbsDown className="w-4 h-4 text-zinc-400" />
                <span>Gillade inte</span>
              </button>
            </div>
          </div>

          {/* 2. VIKTIGAST: Vad var bäst med filmen? */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-200">
                2. Vad var bäst med filmen?
              </label>
              <span className="text-[11px] text-zinc-400">
                Välj 1–4 kvaliteter
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUALITY_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm"
                        : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Egna tankar (valfritt) */}
          <div>
            <label
              htmlFor="movie-thoughts-input"
              className="block text-xs font-semibold text-zinc-300 mb-1.5"
            >
              3. Egna tankar (valfritt)
            </label>
            <textarea
              id="movie-thoughts-input"
              rows={2}
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              placeholder="T.ex. Älskade stämningen i början och musiken..."
              className="w-full rounded-xl bg-[#0a0a0c] border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-sm font-semibold text-white shadow-lg shadow-[#e11d48]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Spara i Sedda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
