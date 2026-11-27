import React, { useRef, useState } from "react";
import {
  Sparkles,
  Check,
  Plus,
  Minus,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Star,
  X,
  Film,
  Tv,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Compass,
} from "lucide-react";
import {
  GENRE_GROUPS,
  CONTENT_GROUPS,
  SETTING_GROUPS,
  MOOD_GROUPS,
  MOVIE_LENGTH_SUBCHIPS,
  TV_SERIES_LENGTH_SUBCHIPS,
  getMoodGroupsForMediaType,
  SWEDISH_STREAMING_SERVICES,
  ExpandableChipGroup,
  EveningPreferences,
  MovieRecommendation,
  WatchedMovie,
  MovieSteeringContext,
  MovieSteeringSliders,
  DEFAULT_STEERING_SLIDERS,
  STEERING_QUICK_TWEAKS,
  describeSteeringAdjustments,
  normalizeMovieTitle,
  movieMatchesStreamingProviders,
  filterMoviesByStreamingServices,
  inferAgeRatingFromGenres,
} from "../utils/movieLogic";
import {
  MoviePoster,
  SwedishStreamingSection,
  AgeRatingBadge,
} from "./MovieVisuals";

type FilterCategoryKey = "genres" | "contents" | "frameworks" | "moods";

const FILTER_CATEGORIES: {
  key: FilterCategoryKey;
  label: string;
  subtitle: string;
  groups: readonly ExpandableChipGroup[];
  accent: "rose" | "amber";
}[] = [
  {
    key: "genres",
    label: "Genrer",
    subtitle: "Välj genre eller tryck [+] för underkategorier",
    groups: GENRE_GROUPS,
    accent: "rose",
  },
  {
    key: "contents",
    label: "Handling",
    subtitle: "Välj handling eller tryck [+] för underkategorier",
    groups: CONTENT_GROUPS,
    accent: "rose",
  },
  {
    key: "frameworks",
    label: "Miljö/Era",
    subtitle: "Välj miljö eller era, tryck [+] för underkategorier",
    groups: SETTING_GROUPS,
    accent: "amber",
  },
  {
    key: "moods",
    label: "Stämning",
    subtitle: "Välj stämning eller tryck [+] för underkategorier",
    groups: MOOD_GROUPS,
    accent: "rose",
  },
];

interface SteeringSliderConfig {
  key: keyof MovieSteeringSliders;
  title: string;
  leftLabel: string;
  rightLabel: string;
  valueLabels: Record<number, string>;
}

const STEERING_SLIDER_CONFIGS: readonly SteeringSliderConfig[] = [
  {
    key: "mood",
    title: "Känsla",
    leftLabel: "Varmare & lättare",
    rightLabel: "Mörkare & tyngre",
    valueLabels: {
      [-2]: "Mycket lättare",
      [-1]: "Lite lättare",
      0: "Samma",
      1: "Lite mörkare",
      2: "Mycket mörkare",
    },
  },
  {
    key: "pace",
    title: "Tempo",
    leftLabel: "Lugnare & atmosfär",
    rightLabel: "Snabbare & mer fart",
    valueLabels: {
      [-2]: "Mycket lugnare",
      [-1]: "Lite lugnare",
      0: "Samma",
      1: "Lite snabbare",
      2: "Mycket snabbare",
    },
  },
  {
    key: "depth",
    title: "Hjärnkapacitet",
    leftLabel: "Enklare / koppla av",
    rightLabel: "Djupare / tankeväckande",
    valueLabels: {
      [-2]: "Mycket enklare",
      [-1]: "Lite enklare",
      0: "Samma",
      1: "Lite djupare",
      2: "Mycket djupare",
    },
  },
  {
    key: "tone",
    title: "Ton",
    leftLabel: "Mer humor & lekfullt",
    rightLabel: "Mer allvar & spänning",
    valueLabels: {
      [-2]: "Mycket mer humor",
      [-1]: "Lite mer humor",
      0: "Samma",
      1: "Lite mer spänning",
      2: "Mycket mer spänning",
    },
  },
];

interface TonightTabProps {
  preferences: EveningPreferences;
  onChangePreferences: (prefs: EveningPreferences) => void;
  recommendations: MovieRecommendation[];
  isLoading: boolean;
  error: string | null;
  onFindMovies: () => Promise<void> | void;
  onSteerFromMovie?: (steering: MovieSteeringContext) => Promise<void> | void;
  activeSteering?: MovieSteeringContext | null;
  onClearSteering?: () => void;
  onAddToWatchlist: (movie: MovieRecommendation) => void;
  onMarkAsWatched: (movie: MovieRecommendation) => void;
  onDismissMovie?: (movie: MovieRecommendation) => void;
  watchlist: MovieRecommendation[];
  watchedMovies?: WatchedMovie[];
  watchedCount: number;
}

export const TonightTab: React.FC<TonightTabProps> = ({
  preferences,
  onChangePreferences,
  recommendations,
  isLoading,
  error,
  onFindMovies,
  onSteerFromMovie,
  activeSteering = null,
  onClearSteering,
  onAddToWatchlist,
  onMarkAsWatched,
  onDismissMovie,
  watchlist,
  watchedMovies = [],
  watchedCount,
}) => {
  const resultsRef = useRef<HTMLElement | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<FilterCategoryKey>("genres");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [showStreamingFilters, setShowStreamingFilters] = useState(false);
  const [steeringCardKey, setSteeringCardKey] = useState<string | null>(null);
  const [steeringSliders, setSteeringSliders] = useState<MovieSteeringSliders>({
    ...DEFAULT_STEERING_SLIDERS,
  });
  const [steeringTweaks, setSteeringTweaks] = useState<string[]>([]);
  const [steeringNote, setSteeringNote] = useState<string>("");

  const openSteeringForCard = (cardKey: string) => {
    if (steeringCardKey === cardKey) {
      setSteeringCardKey(null);
      return;
    }
    setSteeringCardKey(cardKey);
    setSteeringSliders({ ...DEFAULT_STEERING_SLIDERS });
    setSteeringTweaks([]);
    setSteeringNote("");
  };

  const resetSteeringControls = () => {
    setSteeringSliders({ ...DEFAULT_STEERING_SLIDERS });
    setSteeringTweaks([]);
    setSteeringNote("");
  };

  const toggleSteeringTweak = (tweak: string) => {
    setSteeringTweaks((prev) =>
      prev.includes(tweak) ? prev.filter((t) => t !== tweak) : [...prev, tweak]
    );
  };

  const hasCustomSteeringInput =
    Object.values(steeringSliders).some((v) => v !== 0) ||
    steeringTweaks.length > 0 ||
    steeringNote.trim().length > 0;

  const handleSubmitSteering = async (rec: MovieRecommendation) => {
    if (!onSteerFromMovie) return;
    const context: MovieSteeringContext = {
      anchorMovie: {
        title: rec.title,
        originalTitle: rec.originalTitle,
        year: rec.year,
        runtime: rec.runtime,
        mediaType: rec.mediaType,
        vibeTags: rec.vibeTags,
        tmdbGenres: rec.tmdbGenres,
      },
      sliders: { ...steeringSliders },
      quickTweaks: [...steeringTweaks],
      note: steeringNote.trim() || undefined,
    };
    setSteeringCardKey(null);
    await onSteerFromMovie(context);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const selectedProviders = preferences.streamingProviders || [];

  const toggleStreamingProvider = (service: string) => {
    const isMax = service === "HBO Max";
    const exists = selectedProviders.some(
      (s) =>
        s.toLowerCase() === service.toLowerCase() ||
        (isMax && s.toLowerCase() === "max")
    );
    const updated = exists
      ? selectedProviders.filter(
          (s) =>
            s.toLowerCase() !== service.toLowerCase() &&
            (!isMax || s.toLowerCase() !== "max")
        )
      : [...selectedProviders, service];
    onChangePreferences({
      ...preferences,
      streamingProviders: updated,
    });
  };

  const handleFindClick = async () => {
    setShowCategoryFilters(false);
    setShowStreamingFilters(false);
    await onFindMovies();
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const getCategoryValues = (category: FilterCategoryKey): string[] => {
    return preferences[category] || [];
  };

  const toggleChip = (category: FilterCategoryKey, chip: string) => {
    const current = getCategoryValues(category);
    const updated = current.includes(chip)
      ? current.filter((c) => c !== chip)
      : [...current, chip];
    onChangePreferences({
      ...preferences,
      [category]: updated,
    });
  };

  const mediaType = preferences.mediaType || "any";

  const toggleMediaType = (target: "movie" | "tv") => {
    const next = mediaType === target ? "any" : target;
    let updatedMoods = preferences.moods || [];
    if (next === "tv") {
      updatedMoods = updatedMoods.filter(
        (m) => !MOVIE_LENGTH_SUBCHIPS.includes(m)
      );
    } else if (next === "movie") {
      updatedMoods = updatedMoods.filter(
        (m) => !TV_SERIES_LENGTH_SUBCHIPS.includes(m)
      );
    }
    onChangePreferences({
      ...preferences,
      mediaType: next,
      moods: updatedMoods,
    });
  };

  const resetFilters = () => {
    onChangePreferences({
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
      streamingProviders: [],
      mediaType: "any",
    });
  };

  const selectedTags: { category: FilterCategoryKey; chip: string }[] = [
    ...getCategoryValues("genres").map((chip) => ({
      category: "genres" as const,
      chip,
    })),
    ...getCategoryValues("contents").map((chip) => ({
      category: "contents" as const,
      chip,
    })),
    ...getCategoryValues("frameworks").map((chip) => ({
      category: "frameworks" as const,
      chip,
    })),
    ...getCategoryValues("moods").map((chip) => ({
      category: "moods" as const,
      chip,
    })),
  ];

  const totalSelectedCount =
    selectedTags.length +
    (preferences.customText.trim() ? 1 : 0) +
    (mediaType !== "any" ? 1 : 0);

  const baseCatConfig =
    FILTER_CATEGORIES.find((c) => c.key === activeCategory) ||
    FILTER_CATEGORIES[0];

  const currentCatConfig =
    baseCatConfig.key === "moods"
      ? {
          ...baseCatConfig,
          subtitle:
            mediaType === "tv"
              ? "Välj stämning, tempo eller serielängd med [+]"
              : mediaType === "movie"
              ? "Välj stämning, tempo eller speltid med [+]"
              : "Välj stämning, tempo eller längd med [+]",
          groups: getMoodGroupsForMediaType(mediaType),
        }
      : baseCatConfig;

  const expandedGroup =
    currentCatConfig.groups.find((g) => g.id === expandedGroupId) || null;

  const isInWatchlist = (rec: MovieRecommendation) => {
    const norm = normalizeMovieTitle(rec.title);
    return watchlist.some((w) => normalizeMovieTitle(w.title) === norm);
  };

  const isAlreadyWatched = (rec: MovieRecommendation) => {
    const norm = normalizeMovieTitle(rec.title);
    const normOrig = normalizeMovieTitle(rec.originalTitle);
    return watchedMovies.some((w) => {
      const wNorm = normalizeMovieTitle(w.title);
      const wOrig = normalizeMovieTitle(w.originalTitle);
      return (
        (norm && (norm === wNorm || (wOrig && norm === wOrig))) ||
        (normOrig && (normOrig === wNorm || (wOrig && normOrig === wOrig)))
      );
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Intro & Filter Panel */}
      <section
        aria-label="Kvällens önskemål"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              Vad är du sugen på ikväll?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Kombinera genrer och inslag – CineMinde matchar dina val mot dina{" "}
              <span className="text-zinc-200 font-mono-num font-semibold">
                {watchedCount}
              </span>{" "}
              sedda titlar.
            </p>
          </div>
          {totalSelectedCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Rensa alla filterval"
              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rensa</span>
            </button>
          )}
        </div>

        {/* Film eller Serie Selector (valfritt – inget valt = det som passar bäst) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-300">
              Format (valfritt)
            </span>
            <span className="text-[11px] text-zinc-400">
              {mediaType === "movie"
                ? "Endast långfilmer"
                : mediaType === "tv"
                ? "Endast TV-serier"
                : "Inget valt = Bästa träff (film eller serie)"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleMediaType("movie")}
              aria-pressed={mediaType === "movie"}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                mediaType === "movie"
                  ? "bg-[#e11d48] text-white border-[#e11d48] shadow-sm"
                  : "bg-[#0a0a0c] text-zinc-300 border-white/[0.09] hover:border-white/[0.22]"
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Film</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMediaType("tv")}
              aria-pressed={mediaType === "tv"}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                mediaType === "tv"
                  ? "bg-[#e11d48] text-white border-[#e11d48] shadow-sm"
                  : "bg-[#0a0a0c] text-zinc-300 border-white/[0.09] hover:border-white/[0.22]"
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Serie</span>
            </button>
          </div>

          {/* Snabbval för längd beroende på valt format (Film eller Serie) */}
          {mediaType === "tv" && (
            <div className="pt-2 space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400 block">
                Välj serielängd (valfritt):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TV_SERIES_LENGTH_SUBCHIPS.map((chip) => {
                  const active = getCategoryValues("moods").includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip("moods", chip)}
                      aria-pressed={active}
                      className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm"
                          : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.09] hover:border-white/[0.22]"
                      }`}
                    >
                      {active && <Check className="w-3 h-3 text-white" />}
                      <span>{chip}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mediaType === "movie" && (
            <div className="pt-2 space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400 block">
                Välj speltid (valfritt):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MOVIE_LENGTH_SUBCHIPS.map((chip) => {
                  const active = getCategoryValues("moods").includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip("moods", chip)}
                      aria-pressed={active}
                      className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm"
                          : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.09] hover:border-white/[0.22]"
                      }`}
                    >
                      {active && <Check className="w-3 h-3 text-white" />}
                      <span>{chip}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Compact Filter Drawer Toggles: Genrer & Streamingtjänster */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCategoryFilters((prev) => !prev);
                setShowStreamingFilters(false);
              }}
              aria-expanded={showCategoryFilters}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 border transition-colors cursor-pointer ${
                showCategoryFilters
                  ? "bg-[#e11d48]/15 text-white border-[#e11d48]/50"
                  : selectedTags.length > 0
                  ? "bg-[#0a0a0c] text-white border-[#f59e0b]/45 hover:bg-white/[0.05]"
                  : "bg-[#0a0a0c] text-zinc-200 border-white/[0.1] hover:bg-white/[0.05]"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                <span className="truncate">Filter</span>
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                {selectedTags.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#f59e0b] text-[#0a0a0c] text-[10px] font-mono-num font-bold leading-none">
                    {selectedTags.length}
                  </span>
                )}
                {showCategoryFilters ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowStreamingFilters((prev) => !prev);
                setShowCategoryFilters(false);
              }}
              aria-expanded={showStreamingFilters}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 border transition-colors cursor-pointer ${
                showStreamingFilters
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/50"
                  : selectedProviders.length > 0
                  ? "bg-[#0a0a0c] text-emerald-300 border-emerald-500/45 hover:bg-white/[0.05]"
                  : "bg-[#0a0a0c] text-zinc-200 border-white/[0.1] hover:bg-white/[0.05]"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Tv className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Streaming</span>
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                {selectedProviders.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-[#0a0a0c] text-[10px] font-mono-num font-bold leading-none">
                    {selectedProviders.length}
                  </span>
                )}
                {showStreamingFilters ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </span>
            </button>
          </div>

          {showCategoryFilters && (
            <div className="space-y-2.5 pt-1">
              <div
                role="tablist"
                aria-label="Filterkategorier"
                className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0a0a0c] border border-white/[0.07]"
              >
            {FILTER_CATEGORIES.map((cat) => {
              const isTabActive = activeCategory === cat.key;
              const count = getCategoryValues(cat.key).length;
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={isTabActive}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setExpandedGroupId(null);
                  }}
                  className={`relative min-h-[36px] px-1.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap ${
                    isTabActive
                      ? "bg-[#1e1e24] text-white border border-white/[0.14] shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <span className="truncate">{cat.label}</span>
                  {count > 0 && (
                    <span
                      className={`pointer-events-none absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-mono-num font-bold flex items-center justify-center ${
                        cat.accent === "amber"
                          ? "bg-[#f59e0b] text-[#0a0a0c]"
                          : "bg-[#e11d48] text-white"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Category Panel: Compact 2-column grid for phone screens */}
          <div className="rounded-xl bg-[#101014] border border-white/[0.06] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-zinc-400">
                {currentCatConfig.subtitle}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {currentCatConfig.groups.map((group) => {
                const catValues = getCategoryValues(currentCatConfig.key);
                const mainSelected = catValues.includes(group.label);
                const selectedSubCount = group.subchips.filter((s) =>
                  catValues.includes(s)
                ).length;
                const isExpanded = expandedGroup?.id === group.id;
                const isAmber = currentCatConfig.accent === "amber";

                return (
                  <div
                    key={group.id}
                    className={`relative flex items-stretch rounded-xl border transition-colors min-w-0 ${
                      mainSelected
                        ? isAmber
                          ? "bg-[#f59e0b] text-[#0a0a0c] border-[#f59e0b] shadow-sm"
                          : "bg-[#e11d48] text-white border-[#e11d48] shadow-sm"
                        : isExpanded || selectedSubCount > 0
                        ? isAmber
                          ? "bg-[#1a1814] text-white border-[#f59e0b]/60"
                          : "bg-[#1d1418] text-white border-[#e11d48]/60"
                        : "bg-[#0a0a0c] text-zinc-200 border-white/[0.09] hover:border-white/[0.22]"
                    }`}
                  >
                    {/* Floating corner badge for selected subcategories */}
                    {selectedSubCount > 0 && (
                      <span
                        className={`pointer-events-none absolute -top-1.5 -right-1.5 z-10 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono-num font-bold flex items-center justify-center shadow ${
                          isAmber
                            ? "bg-[#f59e0b] text-[#0a0a0c]"
                            : "bg-[#e11d48] text-white"
                        }`}
                      >
                        {selectedSubCount}
                      </span>
                    )}

                    {/* Left side: Select main category */}
                    <button
                      type="button"
                      onClick={() =>
                        toggleChip(currentCatConfig.key, group.label)
                      }
                      aria-pressed={mainSelected}
                      className="flex-1 min-w-0 min-h-[38px] pl-2 sm:pl-2.5 pr-1 sm:pr-1.5 py-1.5 rounded-l-xl text-[11px] sm:text-xs font-medium flex items-center justify-start text-left cursor-pointer"
                    >
                      <span className="truncate">{group.label}</span>
                    </button>

                    {/* Right side: [+] Open subcategories popup */}
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId(group.id)}
                      aria-haspopup="dialog"
                      aria-expanded={isExpanded}
                      aria-label={`Öppna underkategorier för ${group.label}`}
                      title={`Välj underkategorier för ${group.label}`}
                      className={`min-h-[38px] w-7 sm:w-8 rounded-r-xl flex items-center justify-center border-l transition-colors cursor-pointer shrink-0 ${
                        mainSelected
                          ? "border-black/20 hover:bg-black/15"
                          : selectedSubCount > 0
                          ? isAmber
                            ? "border-[#f59e0b]/40 bg-[#f59e0b]/20 text-[#f59e0b]"
                            : "border-[#e11d48]/40 bg-[#e11d48]/25 text-rose-200"
                          : "border-white/[0.08] hover:bg-white/[0.08] text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
            </div>
          )}

          {/* Integrated Popup Modal / Bottom Sheet for [+] Subcategories */}
          {expandedGroup && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Underkategorier för ${expandedGroup.label}`}
              onClick={() => setExpandedGroupId(null)}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#16161a] border border-white/[0.14] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl max-h-[82vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.08]">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#f59e0b]">
                      {currentCatConfig.label} · Underkategorier
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {expandedGroup.label}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Välj en eller flera underkategorier
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedGroupId(null)}
                    aria-label="Stäng popup"
                    className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Option to also toggle the whole main category */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/[0.07]">
                  <span className="text-xs text-zinc-300">
                    Huvudkategori:{" "}
                    <strong className="text-white">{expandedGroup.label}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      toggleChip(currentCatConfig.key, expandedGroup.label)
                    }
                    className={`min-h-[30px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      getCategoryValues(currentCatConfig.key).includes(
                        expandedGroup.label
                      )
                        ? "bg-[#e11d48] text-white"
                        : "bg-white/[0.06] text-zinc-300 hover:text-white"
                    }`}
                  >
                    {getCategoryValues(currentCatConfig.key).includes(
                      expandedGroup.label
                    )
                      ? "Vald"
                      : "Välj hela"}
                  </button>
                </div>

                {/* Subcategory Grid (2 columns, matching main category clarity) */}
                <div className="overflow-y-auto pr-0.5 flex-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {expandedGroup.subchips.map((subchip) => {
                      const subActive = getCategoryValues(
                        currentCatConfig.key
                      ).includes(subchip);
                      const isAmber = currentCatConfig.accent === "amber";
                      return (
                        <button
                          key={subchip}
                          type="button"
                          onClick={() =>
                            toggleChip(currentCatConfig.key, subchip)
                          }
                          aria-pressed={subActive}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between gap-1.5 text-left transition-colors cursor-pointer ${
                            subActive
                              ? isAmber
                                ? "bg-[#f59e0b] text-[#0a0a0c] border border-[#f59e0b] shadow-sm"
                                : "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm"
                              : "bg-[#0a0a0c] text-zinc-200 border border-white/[0.09] hover:border-white/[0.22]"
                          }`}
                        >
                          <span className="truncate">{subchip}</span>
                          {subActive && (
                            <Check className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-400 font-mono-num">
                    {
                      expandedGroup.subchips.filter((s) =>
                        getCategoryValues(currentCatConfig.key).includes(s)
                      ).length
                    }{" "}
                    valda i {expandedGroup.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedGroupId(null)}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Klar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Row of All Selected Chips Across Categories */}
          {selectedTags.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Dina valda filter ({selectedTags.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map(({ category, chip }) => {
                  const isAmber = category === "frameworks";
                  return (
                    <button
                      key={`${category}-${chip}`}
                      type="button"
                      onClick={() => toggleChip(category, chip)}
                      title="Klicka för att ta bort"
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isAmber
                          ? "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/35 hover:bg-[#f59e0b]/25"
                          : "bg-[#e11d48]/15 text-rose-200 border border-[#e11d48]/35 hover:bg-[#e11d48]/25"
                      }`}
                    >
                      <span>{chip}</span>
                      <X className="w-3 h-3 opacity-75" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mina streamingtjänster (hopfällbar panel) */}
        {showStreamingFilters && (
        <div className="pt-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-300">
              Mina streamingtjänster i Sverige
            </span>
            {selectedProviders.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onChangePreferences({
                    ...preferences,
                    streamingProviders: [],
                  })
                }
                className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Rensa tjänster ({selectedProviders.length})
              </button>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            Välj de tjänster du har – endast filmer och serier som finns på dina valda tjänster visas.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() =>
                onChangePreferences({
                  ...preferences,
                  streamingProviders: [],
                })
              }
              aria-pressed={selectedProviders.length === 0}
              className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedProviders.length === 0
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 shadow-sm"
                  : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.09] hover:border-white/[0.22]"
              }`}
            >
              {selectedProviders.length === 0 && (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Alla tjänster (inget filter)</span>
            </button>
            {SWEDISH_STREAMING_SERVICES.map((service) => {
              const isMax = service === "HBO Max";
              const active = selectedProviders.some(
                (s) =>
                  s.toLowerCase() === service.toLowerCase() ||
                  (isMax && s.toLowerCase() === "max")
              );
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => toggleStreamingProvider(service)}
                  aria-pressed={active}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 shadow-sm"
                      : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.09] hover:border-white/[0.22]"
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{service}</span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Fritextfält (valfritt) */}
        <div className="pt-3 border-t border-white/[0.06]">
          <label
            htmlFor="custom-tonight-input"
            className="block text-xs font-semibold text-zinc-300 mb-2"
          >
            Eller beskriv med egna ord...
          </label>
          <input
            id="custom-tonight-input"
            type="text"
            value={preferences.customText}
            onChange={(e) =>
              onChangePreferences({
                ...preferences,
                customText: e.target.value,
              })
            }
            placeholder="t.ex. som The Witcher, mörk thriller..."
            className="w-full min-h-[44px] rounded-xl bg-[#0a0a0c] border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48] transition-colors"
          />
        </div>

        {/* Action Button: Hitta kvällens val */}
        <button
          type="button"
          onClick={handleFindClick}
          disabled={isLoading}
          className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-60 text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-[#e11d48]/20 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyserar din smakprofil...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {mediaType === "movie"
                  ? "Hitta kvällens film"
                  : mediaType === "tv"
                  ? "Hitta kvällens serie"
                  : "Hitta kvällens film eller serie"}
              </span>
            </>
          )}
        </button>

        {error && (
          <div
            role="alert"
            className="mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-200"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={onFindMovies}
              disabled={isLoading}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Försök igen
            </button>
          </div>
        )}
      </section>

      {/* Resultat-vy: 5 skräddarsydda filmrekommendationer */}
      {recommendations.length > 0 && (() => {
        const displayedRecs =
          selectedProviders.length > 0
            ? filterMoviesByStreamingServices(recommendations, selectedProviders)
            : recommendations;

        return (
          <section
            ref={resultsRef}
            aria-label="Kvällens rekommendationer"
            className="space-y-4 scroll-mt-4"
          >
            <div className="space-y-2 px-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {displayedRecs.length} skräddarsydda val för dig ikväll
                  </h2>
                  {onSteerFromMovie && displayedRecs.length > 0 && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Klicka på en film som känns åt rätt håll för att styra vidare med reglagen.
                    </p>
                  )}
                  {selectedProviders.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <p className="text-[11px] text-emerald-400">
                        Visar endast titlar som finns på{" "}
                        {selectedProviders
                          .map((s) => (s.toLowerCase() === "max" ? "HBO Max" : s))
                          .join(", ")}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          onChangePreferences({
                            ...preferences,
                            streamingProviders: [],
                          })
                        }
                        className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        (Visa alla tjänster)
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-xs text-zinc-400 font-mono-num">
                  TMDB & Streaming SE
                </span>
              </div>

              {activeSteering && (
                <div className="flex items-start justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#e11d48]/10 border border-[#e11d48]/35 text-xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <Compass className="w-4 h-4 text-[#e11d48] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        Styrda vidare från{" "}
                        <span className="text-[#f59e0b]">
                          {activeSteering.anchorMovie.title}
                        </span>
                      </p>
                      {describeSteeringAdjustments(activeSteering).length > 0 && (
                        <p className="text-[11px] text-zinc-300 mt-0.5">
                          {describeSteeringAdjustments(activeSteering).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {onClearSteering && (
                    <button
                      type="button"
                      onClick={onClearSteering}
                      aria-label="Rensa styrning"
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {displayedRecs.length === 0 && selectedProviders.length > 0 ? (
              <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-zinc-200">
                  Inga av förslagen från föregående sökning finns på{" "}
                  {selectedProviders
                    .map((s) => (s.toLowerCase() === "max" ? "HBO Max" : s))
                    .join(", ")}
                </p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Du kan antingen nollställa streamingfiltret för att se titlar
                  från alla tjänster, eller klicka nedan för att hämta 5 nya
                  förslag för {selectedProviders.map((s) => (s.toLowerCase() === "max" ? "HBO Max" : s)).join(", ")}.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangePreferences({
                        ...preferences,
                        streamingProviders: [],
                      })
                    }
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Visa från alla tjänster</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFindClick}
                    disabled={isLoading}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      Hämta förslag för{" "}
                      {selectedProviders
                        .map((s) => (s.toLowerCase() === "max" ? "HBO Max" : s))
                        .join(", ")}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedRecs.map((rec, idx) => {
                const cardKey = rec.id || `${rec.title}-${idx}`;
                const isSteeringOpen = steeringCardKey === cardKey;
                const saved = isInWatchlist(rec);
                const showOriginal =
                  rec.originalTitle &&
                  normalizeMovieTitle(rec.originalTitle) !==
                    normalizeMovieTitle(rec.title);
                const streamMatch = movieMatchesStreamingProviders(
                  rec.swedishProviders,
                  selectedProviders
                );

                return (
                  <article
                    key={cardKey}
                    className={`bg-[#16161a] border rounded-2xl p-5 space-y-4 transition-colors ${
                      isSteeringOpen
                        ? "border-[#e11d48]/70 shadow-lg shadow-[#e11d48]/10"
                        : streamMatch.matchesFlatrate
                        ? "border-emerald-500/40"
                        : "border-white/[0.08]"
                    }`}
                  >
                    {/* Clickable top area to open steering sliders */}
                    <div
                      onClick={() => {
                        if (onSteerFromMovie) openSteeringForCard(cardKey);
                      }}
                      className={`flex items-start gap-4 ${
                        onSteerFromMovie ? "cursor-pointer group" : ""
                      }`}
                    >
                      <MoviePoster
                        title={rec.title}
                        year={rec.year}
                        posterPath={rec.posterPath}
                        size="w500"
                        className="w-24 h-36"
                      />

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono-num font-semibold text-[#f59e0b]">
                              {rec.matchPercentage}% matchning
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-zinc-200 text-[10px] font-medium inline-flex items-center gap-1">
                              {rec.mediaType === "tv" ? (
                                <>
                                  <Tv className="w-2.5 h-2.5 text-[#f59e0b]" />
                                  <span>TV-serie</span>
                                </>
                              ) : (
                                <>
                                  <Film className="w-2.5 h-2.5 text-[#e11d48]" />
                                  <span>Film</span>
                                </>
                              )}
                            </span>
                            {streamMatch.matchesFlatrate && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-semibold">
                                ✓ Ingår på {streamMatch.matchedNames.join(", ")}
                              </span>
                            )}
                            {!streamMatch.matchesFlatrate && streamMatch.matchesRentBuy && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-semibold">
                                Hyr/köp på {streamMatch.matchedNames.join(", ")}
                              </span>
                            )}
                            {rec.isExactPinpointMatch && (
                              <span className="px-2 py-0.5 rounded-md bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] text-[10px] font-semibold">
                                {isAlreadyWatched(rec)
                                  ? "Exakt träff · Sedd tidigare"
                                  : "Exakt träff"}
                              </span>
                            )}
                          </div>
                          <span className="font-mono-num text-zinc-500">
                            #{idx + 1}
                          </span>
                        </div>

                      <div>
                        <h3 className="text-lg font-bold text-white leading-snug">
                          {rec.title}
                        </h3>
                        {showOriginal && (
                          <p className="text-xs italic text-zinc-400 mt-0.5 truncate">
                            {rec.originalTitle}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-300 font-mono-num">
                        <span>
                          {rec.year} · {rec.runtime}
                        </span>
                        <AgeRatingBadge
                          ageRating={
                            rec.ageRating ||
                            inferAgeRatingFromGenres(rec.tmdbGenreIds)
                          }
                        />
                        {typeof rec.tmdbRating === "number" &&
                          rec.tmdbRating > 0 && (
                            <span className="inline-flex items-center gap-1 text-[#f59e0b] font-semibold">
                              <Star className="w-3 h-3 fill-[#f59e0b] text-[#f59e0b]" />
                              <span>TMDB {rec.tmdbRating.toFixed(1)}</span>
                            </span>
                          )}
                      </div>

                      {/* Verifierade officiella TMDB-kategorier */}
                      {rec.tmdbGenres && rec.tmdbGenres.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mr-0.5">
                            TMDB:
                          </span>
                          {rec.tmdbGenres.map((genre) => (
                            <span
                              key={genre}
                              className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.09] text-[10px] font-medium text-zinc-200"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 3-4 vibe-taggar (filtrera bort rena dubbletter av TMDB-genrer) */}
                      {(() => {
                        const tmdbGenreSet = new Set(
                          (rec.tmdbGenres || []).map((g) => g.trim().toLowerCase())
                        );
                        const uniqueVibeTags = (rec.vibeTags || []).filter(
                          (tag) => !tmdbGenreSet.has(tag.trim().toLowerCase())
                        );
                        if (uniqueVibeTags.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-zinc-400 pt-0.5">
                            {uniqueVibeTags.map((tag, tIdx) => (
                              <React.Fragment key={tag}>
                                {tIdx > 0 && (
                                  <span
                                    aria-hidden="true"
                                    className="text-zinc-600"
                                  >
                                    ·
                                  </span>
                                )}
                                <span className="text-zinc-300">{tag}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Varför du kommer gilla den */}
                  <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
                    <p className="text-xs font-semibold text-zinc-200">
                      Varför du kommer gilla den:
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {rec.whyYouWillLikeIt}
                    </p>
                  </div>

                  {/* Var kan jag se filmen i Sverige? (TMDB Watch Providers SE) */}
                  <SwedishStreamingSection
                    swedishProviders={rec.swedishProviders}
                  />

                  {/* 2×2 åtgärdsknappar: Watchlist, Redan sett, Åt rätt håll & Inte intresserad */}
                  <div className="pt-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => onAddToWatchlist(rec)}
                        disabled={saved}
                        aria-label={
                          saved
                            ? `I Watchlist (${rec.title})`
                            : `+ Watchlist (${rec.title})`
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                          saved
                            ? "bg-white/[0.04] text-[#f59e0b] border border-[#f59e0b]/40 cursor-default"
                            : "bg-[#0a0a0c] hover:bg-white/[0.06] text-white border border-white/[0.12] cursor-pointer"
                        }`}
                      >
                        {saved ? (
                          <>
                            <Check className="w-4 h-4 text-[#f59e0b] shrink-0" />
                            <span>I Watchlist</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-[#f59e0b] shrink-0" />
                            <span>Watchlist</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onMarkAsWatched(rec)}
                        aria-label={`Redan sett (${rec.title})`}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#0a0a0c] hover:bg-white/[0.06] text-zinc-200 hover:text-white border border-white/[0.12] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#e11d48] shrink-0" />
                        <span>Redan sett</span>
                      </button>

                      {onSteerFromMovie && (
                        <button
                          type="button"
                          onClick={() => openSteeringForCard(cardKey)}
                          aria-expanded={isSteeringOpen}
                          aria-label={`Åt rätt håll – styr vidare från ${rec.title}`}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                            !onDismissMovie ? "col-span-2" : ""
                          } ${
                            isSteeringOpen
                              ? "bg-[#e11d48]/15 text-white border-[#e11d48]/50"
                              : "bg-[#0a0a0c] hover:bg-white/[0.06] text-zinc-200 hover:text-white border-white/[0.12]"
                          }`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                          <span>
                            {isSteeringOpen ? "Styr riktning" : "Åt rätt håll?"}
                          </span>
                          {isSteeringOpen ? (
                            <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          )}
                        </button>
                      )}

                      {onDismissMovie && (
                        <button
                          type="button"
                          onClick={() => onDismissMovie(rec)}
                          aria-label={`Inte intresserad av ${rec.title}`}
                          title="Inte intresserad – göm och styr bort från liknande"
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#0a0a0c] hover:bg-white/[0.06] text-zinc-200 hover:text-white border border-white/[0.12] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                            !onSteerFromMovie ? "col-span-2" : ""
                          }`}
                        >
                          <X className="w-4 h-4 text-[#e11d48] shrink-0" />
                          <span>Inte intresserad</span>
                        </button>
                      )}
                    </div>

                    {isSteeringOpen && (
                        <div className="mt-3 rounded-xl bg-[#0e0e12] border border-white/[0.1] p-4 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-white">
                                Utgå från {rec.title}
                              </h4>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                Mitten = som denna film. Dra i det du vill justera:
                              </p>
                            </div>
                            {hasCustomSteeringInput && (
                              <button
                                type="button"
                                onClick={resetSteeringControls}
                                className="text-[11px] text-zinc-400 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Nollställ</span>
                              </button>
                            )}
                          </div>

                          {/* 4 relative steering sliders */}
                          <div className="space-y-3.5">
                            {STEERING_SLIDER_CONFIGS.map((cfg) => {
                              const val = steeringSliders[cfg.key];
                              const activeText = cfg.valueLabels[val] || "Samma";
                              return (
                                <div key={cfg.key} className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <label
                                      htmlFor={`steer-${cardKey}-${cfg.key}`}
                                      className="text-xs font-semibold text-zinc-200"
                                    >
                                      {cfg.title}
                                    </label>
                                    <span
                                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                        val === 0
                                          ? "bg-white/[0.05] text-zinc-400"
                                          : "bg-[#e11d48]/20 text-rose-200 border border-[#e11d48]/40"
                                      }`}
                                    >
                                      {activeText}
                                    </span>
                                  </div>
                                  <input
                                    id={`steer-${cardKey}-${cfg.key}`}
                                    type="range"
                                    min={-2}
                                    max={2}
                                    step={1}
                                    value={val}
                                    onChange={(e) =>
                                      setSteeringSliders((prev) => ({
                                        ...prev,
                                        [cfg.key]: Number(e.target.value),
                                      }))
                                    }
                                    className="w-full accent-[#e11d48] cursor-pointer h-1.5 bg-white/[0.12] rounded-lg"
                                  />
                                  <div className="flex items-center justify-between text-[10.5px] text-zinc-400">
                                    <span>{cfg.leftLabel}</span>
                                    <span>{cfg.rightLabel}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Quick tweaks */}
                          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                            <span className="text-[11px] font-medium text-zinc-400 block">
                              Snabbjusteringar (valfritt):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {STEERING_QUICK_TWEAKS.map((tweak) => {
                                const active = steeringTweaks.includes(tweak);
                                return (
                                  <button
                                    key={tweak}
                                    type="button"
                                    onClick={() => toggleSteeringTweak(tweak)}
                                    aria-pressed={active}
                                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                      active
                                        ? "bg-[#f59e0b] text-[#0a0a0c] font-semibold"
                                        : "bg-[#16161a] text-zinc-300 border border-white/[0.1] hover:border-white/[0.25]"
                                    }`}
                                  >
                                    {active && <Check className="w-3 h-3" />}
                                    <span>{tweak}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Optional short note */}
                          <input
                            type="text"
                            value={steeringNote}
                            onChange={(e) => setSteeringNote(e.target.value)}
                            placeholder="Valfritt: t.ex. mer 90-tal, i rymden..."
                            className="w-full min-h-[38px] rounded-xl bg-[#16161a] border border-white/[0.09] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48] transition-colors"
                          />

                          {/* Submit steered search */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSubmitSteering(rec)}
                            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-60 text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-md shadow-[#e11d48]/20 active:scale-[0.99] transition-all cursor-pointer"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Söker vidare...</span>
                              </>
                            ) : (
                              <>
                                <Compass className="w-4 h-4" />
                                <span className="truncate">
                                  Sök vidare från {rec.title}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                </article>
              );
            })}
          </div>
          )}
        </section>
      );
      })()}
    </div>
  );
};
