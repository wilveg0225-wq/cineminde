import React, { useState, useEffect } from "react";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  X,
  Tv,
  Plus,
  Layers,
} from "lucide-react";
import {
  QUALITY_TAGS,
  WatchedMovie,
  SwedishWatchProviders,
  SeasonRating,
  lookupCuratedTmdbMovie,
  getSeriesSeasonCount,
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
  initialSeasons?: SeasonRating[];
  fromWatchlistId?: string;
  tmdbId?: number;
  posterPath?: string;
  tmdbRating?: number;
  swedishProviders?: SwedishWatchProviders;
  seasonCount?: number;
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
  // Determine if this item is a TV series (only series allow season ratings)
  const curatedMeta = draft
    ? lookupCuratedTmdbMovie(draft.title, draft.year)
    : null;

  const isSeries = Boolean(
    draft &&
      (draft.mediaType === "tv" ||
        Boolean(draft.initialSeasons && draft.initialSeasons.length > 0) ||
        (draft.mediaType !== "movie" && curatedMeta?.mediaType === "tv"))
  );

  // Whole-title state
  const [rating, setRating] = useState<number>(4);
  const [liked, setLiked] = useState<boolean>(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState<string>("");
  const [year, setYear] = useState<string>("");

  // Season rating state
  const [isSeasonMode, setIsSeasonMode] = useState<boolean>(false);
  const [seasons, setSeasons] = useState<SeasonRating[]>([]);
  const [activeSeasonNum, setActiveSeasonNum] = useState<number>(1);
  const [seasonRating, setSeasonRating] = useState<number>(4);
  const [seasonLiked, setSeasonLiked] = useState<boolean>(true);
  const [seasonTags, setSeasonTags] = useState<string[]>([]);
  const [seasonThoughts, setSeasonThoughts] = useState<string>("");
  const [seriesSeasonCount, setSeriesSeasonCount] = useState<number>(1);

  useEffect(() => {
    if (draft) {
      setRating(draft.initialRating ?? 4);
      setLiked(draft.initialLiked ?? true);
      setSelectedTags(draft.initialTags ?? []);
      setThoughts(draft.initialThoughts ?? "");
      setYear(draft.year ?? "");

      const hasSeasons = Boolean(
        isSeries && draft.initialSeasons && draft.initialSeasons.length > 0
      );
      setIsSeasonMode(hasSeasons);

      if (hasSeasons && draft.initialSeasons) {
        setSeasons([...draft.initialSeasons]);
        const firstSeason = draft.initialSeasons[0];
        setActiveSeasonNum(firstSeason.seasonNumber);
        setSeasonRating(firstSeason.rating);
        setSeasonLiked(firstSeason.liked);
        setSeasonTags(firstSeason.tags || []);
        setSeasonThoughts(firstSeason.thoughts || "");
      } else {
        setSeasons([]);
        setActiveSeasonNum(1);
        setSeasonRating(draft.initialRating ?? 4);
        setSeasonLiked(draft.initialLiked ?? true);
        setSeasonTags(draft.initialTags ?? []);
        setSeasonThoughts("");
      }

      // Compute initial known season count
      const initialCount =
        draft.seasonCount ||
        curatedMeta?.seasonCount ||
        getSeriesSeasonCount(draft.title);
      setSeriesSeasonCount(Math.max(1, initialCount));
    }
  }, [draft, isSeries]);

  // Dynamically query TMDB for exact season count if it's a TV series
  useEffect(() => {
    if (!draft || !isSeries) return;
    let isCancelled = false;

    const fetchLiveSeasonCount = async () => {
      try {
        const params = new URLSearchParams();
        if (draft.tmdbId) params.append("tmdbId", String(draft.tmdbId));
        if (draft.title) params.append("title", draft.title);

        const res = await fetch(`/api/tmdb/series-seasons?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { seasonCount?: number };
        if (
          !isCancelled &&
          typeof data.seasonCount === "number" &&
          data.seasonCount > 0
        ) {
          setSeriesSeasonCount(data.seasonCount);
        }
      } catch {
        // Retain local known count
      }
    };

    void fetchLiveSeasonCount();
    return () => {
      isCancelled = true;
    };
  }, [draft?.tmdbId, draft?.title, isSeries]);

  if (!draft) return null;

  // Sync active season changes into the seasons array
  const syncCurrentSeason = (
    num: number,
    r: number,
    l: boolean,
    tags: string[],
    th: string
  ) => {
    setSeasons((prev) => {
      const idx = prev.findIndex((s) => s.seasonNumber === num);
      const updated: SeasonRating = {
        seasonNumber: num,
        rating: r,
        liked: l,
        tags,
        thoughts: th.trim() || undefined,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated].sort((a, b) => a.seasonNumber - b.seasonNumber);
    });
  };

  const handleSelectSeason = (newNum: number) => {
    syncCurrentSeason(
      activeSeasonNum,
      seasonRating,
      seasonLiked,
      seasonTags,
      seasonThoughts
    );

    setActiveSeasonNum(newNum);
    const existing = seasons.find((s) => s.seasonNumber === newNum);
    if (existing) {
      setSeasonRating(existing.rating);
      setSeasonLiked(existing.liked);
      setSeasonTags(existing.tags || []);
      setSeasonThoughts(existing.thoughts || "");
    } else {
      setSeasonRating(4);
      setSeasonLiked(true);
      setSeasonTags([]);
      setSeasonThoughts("");
    }
  };

  const handleRemoveSeason = (seasonNum: number) => {
    const next = seasons.filter((s) => s.seasonNumber !== seasonNum);
    setSeasons(next);
    if (activeSeasonNum === seasonNum) {
      const fallbackNum = next[0]?.seasonNumber || 1;
      setActiveSeasonNum(fallbackNum);
      const fallback = next.find((s) => s.seasonNumber === fallbackNum);
      if (fallback) {
        setSeasonRating(fallback.rating);
        setSeasonLiked(fallback.liked);
        setSeasonTags(fallback.tags || []);
        setSeasonThoughts(fallback.thoughts || "");
      } else {
        setSeasonRating(4);
        setSeasonLiked(true);
        setSeasonTags([]);
        setSeasonThoughts("");
      }
    }
  };

  const handleAddExtraSeason = () => {
    const nextSeason =
      Math.max(seriesSeasonCount, ...seasons.map((s) => s.seasonNumber)) + 1;
    setSeriesSeasonCount(nextSeason);
    handleSelectSeason(nextSeason);
  };

  // Whole-title handlers
  const toggleWholeTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleWholeStarClick = (starValue: number) => {
    setRating(starValue);
    setLiked(starValue >= 3);
  };

  const handleWholeLikedToggle = (isLiked: boolean) => {
    setLiked(isLiked);
    if (isLiked && rating < 3) {
      setRating(4);
    } else if (!isLiked && rating >= 3) {
      setRating(2);
    }
  };

  // Season-specific handlers
  const handleSeasonStarClick = (starValue: number) => {
    setSeasonRating(starValue);
    const newLiked = starValue >= 3;
    setSeasonLiked(newLiked);
    syncCurrentSeason(
      activeSeasonNum,
      starValue,
      newLiked,
      seasonTags,
      seasonThoughts
    );
  };

  const handleSeasonLikedToggle = (isLiked: boolean) => {
    const newRating =
      isLiked && seasonRating < 3
        ? 4
        : !isLiked && seasonRating >= 3
        ? 2
        : seasonRating;
    setSeasonLiked(isLiked);
    setSeasonRating(newRating);
    syncCurrentSeason(
      activeSeasonNum,
      newRating,
      isLiked,
      seasonTags,
      seasonThoughts
    );
  };

  const toggleSeasonTag = (tag: string) => {
    const nextTags = seasonTags.includes(tag)
      ? seasonTags.filter((t) => t !== tag)
      : [...seasonTags, tag];
    setSeasonTags(nextTags);
    syncCurrentSeason(
      activeSeasonNum,
      seasonRating,
      seasonLiked,
      nextTags,
      seasonThoughts
    );
  };

  const handleSeasonThoughtsChange = (val: string) => {
    setSeasonThoughts(val);
    syncCurrentSeason(
      activeSeasonNum,
      seasonRating,
      seasonLiked,
      seasonTags,
      val
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSeries && isSeasonMode) {
      // Ensure current active season is synced into seasons list
      const finalSeasonsMap = new Map<number, SeasonRating>();
      for (const s of seasons) {
        finalSeasonsMap.set(s.seasonNumber, s);
      }
      finalSeasonsMap.set(activeSeasonNum, {
        seasonNumber: activeSeasonNum,
        rating: seasonRating,
        liked: seasonLiked,
        tags: seasonTags,
        thoughts: seasonThoughts.trim() || undefined,
      });

      const finalSeasons = Array.from(finalSeasonsMap.values()).sort(
        (a, b) => a.seasonNumber - b.seasonNumber
      );

      // Compute aggregate rating & liked
      const avgRating =
        finalSeasons.length > 0
          ? Math.round(
              finalSeasons.reduce((acc, s) => acc + s.rating, 0) /
                finalSeasons.length
            )
          : rating;
      const aggregateLiked = avgRating >= 3;

      // Union of all season tags
      const allSeasonTags = Array.from(
        new Set(finalSeasons.flatMap((s) => s.tags || []))
      );

      onSave(
        {
          title: draft.title.trim(),
          originalTitle: draft.originalTitle?.trim() || draft.title.trim(),
          year: year.trim() || undefined,
          mediaType: "tv", // Series
          rating: avgRating,
          liked: aggregateLiked,
          tags: allSeasonTags.length > 0 ? allSeasonTags : selectedTags,
          thoughts:
            thoughts.trim() ||
            (finalSeasons.length === 1 && seasonThoughts.trim()
              ? seasonThoughts.trim()
              : undefined),
          seasonCount: Math.max(
            seriesSeasonCount,
            ...finalSeasons.map((s) => s.seasonNumber)
          ),
          seasons: finalSeasons,
          tmdbId: draft.tmdbId,
          posterPath: draft.posterPath,
          tmdbRating: draft.tmdbRating,
          swedishProviders: draft.swedishProviders,
        },
        draft.id,
        draft.fromWatchlistId
      );
    } else {
      onSave(
        {
          title: draft.title.trim(),
          originalTitle: draft.originalTitle?.trim() || draft.title.trim(),
          year: year.trim() || undefined,
          mediaType: isSeries ? "tv" : "movie",
          rating,
          liked,
          tags: selectedTags,
          thoughts: thoughts.trim() || undefined,
          seasonCount: isSeries ? seriesSeasonCount : undefined,
          seasons: undefined, // Standard whole-title rating
          tmdbId: draft.tmdbId,
          posterPath: draft.posterPath,
          tmdbRating: draft.tmdbRating,
          swedishProviders: draft.swedishProviders,
        },
        draft.id,
        draft.fromWatchlistId
      );
    }
  };

  // Generate dropdown options: EXACTLY as many seasons as the series has
  const totalAvailableSeasons = Math.max(
    seriesSeasonCount || 1,
    ...seasons.map((s) => s.seasonNumber),
    activeSeasonNum
  );
  const seasonOptions: number[] = Array.from(
    { length: totalAvailableSeasons },
    (_, i) => i + 1
  );

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
                {isSeries ? "Serie" : "Film"} · Betygsätt din upplevelse
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
                  {isSeries && seriesSeasonCount > 0
                    ? ` · ${seriesSeasonCount} ${
                        seriesSeasonCount === 1 ? "säsong" : "säsonger"
                      }`
                    : ""}
                  {draft.tmdbRating
                    ? ` · TMDB ${draft.tmdbRating.toFixed(1)}`
                    : ""}
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

        {/* Series Season Rating Switcher (ONLY shown for TV Series, NEVER for movies) */}
        {isSeries && (
          <div className="mb-4 p-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#e11d48]/15 border border-[#e11d48]/30 flex items-center justify-center shrink-0">
                <Tv className="w-4 h-4 text-[#e11d48]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white leading-tight">
                  {isSeasonMode
                    ? "Säsongsbetyg aktivt"
                    : "Betygsätt per säsong?"}
                </p>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {isSeasonMode
                    ? `Välj bland seriens ${seriesSeasonCount} säsonger`
                    : "Sätt olika betyg på enskilda säsonger"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isSeasonMode && seasons.length === 0) {
                  syncCurrentSeason(
                    1,
                    rating,
                    liked,
                    selectedTags,
                    thoughts
                  );
                  setActiveSeasonNum(1);
                  setSeasonRating(rating);
                  setSeasonLiked(liked);
                  setSeasonTags(selectedTags);
                  setSeasonThoughts(thoughts);
                }
                setIsSeasonMode(!isSeasonMode);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                isSeasonMode
                  ? "bg-[#e11d48] text-white shadow-md shadow-[#e11d48]/25"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200"
              }`}
            >
              {isSeasonMode ? "Betygsätt hela serien" : "Välj säsong"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSeries && isSeasonMode ? (
            /* ================= SÄSONGSLÄGE (ENDAST FÖR SERIER) ================= */
            <>
              {/* Dropdown för säsong – visar exakt seriens antal säsonger */}
              <div className="bg-[#0a0a0c] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="season-select"
                    className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span>Välj säsong ({seasonOptions.length} totalt):</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <select
                      id="season-select"
                      value={activeSeasonNum}
                      onChange={(e) => handleSelectSeason(Number(e.target.value))}
                      className="bg-[#16161a] border border-white/[0.15] rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-[#e11d48] cursor-pointer"
                    >
                      {seasonOptions.map((num) => {
                        const isRated = seasons.some(
                          (s) => s.seasonNumber === num
                        );
                        return (
                          <option key={num} value={num}>
                            Säsong {num} {isRated ? "✓" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddExtraSeason}
                      title="Lägg till ytterligare en säsong om ny säsong släppts"
                      className="min-h-[32px] px-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[11px] font-semibold text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Ny säsong</span>
                    </button>
                  </div>
                </div>

                {/* Betygsatta säsonger chips */}
                {seasons.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 mb-1.5">
                      Betygsatta säsonger:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {seasons.map((s) => (
                        <div
                          key={s.seasonNumber}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                            s.seasonNumber === activeSeasonNum
                              ? "bg-[#e11d48]/20 border-[#e11d48] text-white"
                              : "bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:border-white/[0.2]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectSeason(s.seasonNumber)}
                            className="font-medium cursor-pointer"
                          >
                            Säsong {s.seasonNumber}: {s.rating}★{" "}
                            {s.liked ? "👍" : "👎"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSeason(s.seasonNumber)}
                            aria-label={`Ta bort betyg för säsong ${s.seasonNumber}`}
                            className="text-zinc-500 hover:text-rose-400 p-0.5 ml-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Betyg för vald säsong */}
              <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Betyg för Säsong {activeSeasonNum}
                  </label>
                  <span className="text-xs font-mono-num font-semibold text-[#f59e0b]">
                    {seasonRating} / 5
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label={`Välj antal stjärnor för säsong ${activeSeasonNum}`}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= seasonRating;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleSeasonStarClick(star)}
                          aria-label={`${star} av 5 stjärnor`}
                          aria-pressed={seasonRating === star}
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
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => handleSeasonLikedToggle(true)}
                    aria-pressed={seasonLiked}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      seasonLiked
                        ? "bg-[#e11d48]/20 text-white border border-[#e11d48]"
                        : "bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:text-zinc-200"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4 text-[#f59e0b]" />
                    <span>Gillade säsongen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSeasonLikedToggle(false)}
                    aria-pressed={!seasonLiked}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      !seasonLiked
                        ? "bg-zinc-800 text-white border border-zinc-500"
                        : "bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:text-zinc-200"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4 text-zinc-400" />
                    <span>Gillade inte</span>
                  </button>
                </div>
              </div>

              {/* 2. Kvalitetstaggar för Säsong */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-200">
                    Vad utmärkte Säsong {activeSeasonNum}?
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Välj 1–4 kvaliteter
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUALITY_TAGS.map((tag) => {
                    const isSelected = seasonTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSeasonTag(tag)}
                        aria-pressed={isSelected}
                        className={`min-h-[48px] px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center text-center transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm font-semibold"
                            : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
                        }`}
                      >
                        <span className="leading-snug">{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Tankar om Säsong */}
              <div>
                <label
                  htmlFor="season-thoughts-input"
                  className="block text-xs font-semibold text-zinc-300 mb-1.5"
                >
                  Egna tankar om Säsong {activeSeasonNum} (valfritt)
                </label>
                <textarea
                  id="season-thoughts-input"
                  rows={2}
                  value={seasonThoughts}
                  onChange={(e) => handleSeasonThoughtsChange(e.target.value)}
                  placeholder="T.ex. Älskade starten men tyckte mitten tappade tempo..."
                  className="w-full rounded-xl bg-[#0a0a0c] border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48] transition-colors"
                />
              </div>
            </>
          ) : (
            /* ================= HELHETSBETYG (FILMER & HELA SERIER) ================= */
            <>
              {/* 1. Betyg: 1-5 stjärnor + Gillade / Gillade inte */}
              <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-2xl p-4">
                <label className="block text-xs font-semibold text-zinc-300 mb-3">
                  1. Ditt betyg på {isSeries ? "serien" : "filmen"}
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
                          onClick={() => handleWholeStarClick(star)}
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
                    onClick={() => handleWholeLikedToggle(true)}
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
                    onClick={() => handleWholeLikedToggle(false)}
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

              {/* 2. Vad var bäst med titeln? */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-200">
                    2. Vad var bäst med {isSeries ? "serien" : "filmen"}?
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Välj 1–4 kvaliteter
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUALITY_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleWholeTag(tag)}
                        aria-pressed={isSelected}
                        className={`min-h-[48px] px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center text-center transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm font-semibold"
                            : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]"
                        }`}
                      >
                        <span className="leading-snug">{tag}</span>
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
                  placeholder={
                    isSeries
                      ? "T.ex. Fantastiska skådespelare och grym stämning rakt igenom..."
                      : "T.ex. Älskade stämningen i början och musiken..."
                  }
                  className="w-full rounded-xl bg-[#0a0a0c] border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48] transition-colors"
                />
              </div>
            </>
          )}

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
              {isSeries && isSeasonMode && seasons.length > 0
                ? `Spara ${seasons.length} ${
                    seasons.length === 1 ? "säsong" : "säsonger"
                  } i Sedda`
                : "Spara i Sedda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
