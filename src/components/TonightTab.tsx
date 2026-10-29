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
  normalizeMovieTitle,
  movieMatchesStreamingProviders,
  filterMoviesByStreamingServices,
} from "../utils/movieLogic";
import { MoviePoster, SwedishStreamingSection } from "./MovieVisuals";

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
    subtitle: "Klicka på en genre eller tryck [+] för underkategorier (t.ex. Action-romans)",
    groups: GENRE_GROUPS,
    accent: "rose",
  },
  {
    key: "contents",
    label: "Handling",
    subtitle: "Välj handlingstema eller tryck [+] för specifika troper & vändningar",
    groups: CONTENT_GROUPS,
    accent: "rose",
  },
  {
    key: "frameworks",
    label: "Miljö & Era",
    subtitle: "Välj plats, historisk epok eller utgivningsår med [+]",
    groups: SETTING_GROUPS,
    accent: "amber",
  },
  {
    key: "moods",
    label: "Stämning",
    subtitle: "Välj känsla, tempo och speltid med [+]",
    groups: MOOD_GROUPS,
    accent: "rose",
  },
];

interface TonightTabProps {
  preferences: EveningPreferences;
  onChangePreferences: (prefs: EveningPreferences) => void;
  recommendations: MovieRecommendation[];
  isLoading: boolean;
  error: string | null;
  onFindMovies: () => Promise<void> | void;
  onAddToWatchlist: (movie: MovieRecommendation) => void;
  onMarkAsWatched: (movie: MovieRecommendation) => void;
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
  onAddToWatchlist,
  onMarkAsWatched,
  watchlist,
  watchedMovies = [],
  watchedCount,
}) => {
  const resultsRef = useRef<HTMLElement | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<FilterCategoryKey>("genres");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

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
              ? "Välj känsla, tempo och serielängd (miniserie, antal säsonger) med [+]"
              : mediaType === "movie"
              ? "Välj känsla, tempo och speltid med [+]"
              : "Välj känsla, tempo och längd (film eller serie) med [+]",
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
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-5"
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

        {/* Category Tabs Bar (Single compact row on mobile) */}
        <div className="space-y-2.5">
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
                      className="flex-1 min-w-0 min-h-[38px] pl-2.5 pr-1.5 py-1.5 rounded-l-xl text-xs font-medium flex items-center justify-start text-left cursor-pointer"
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
                      className={`min-h-[38px] w-8 rounded-r-xl flex items-center justify-center border-l transition-colors cursor-pointer shrink-0 ${
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
                      Klicka i en eller flera specifika inriktningar
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

                {/* Subcategory Grid (2 columns, fixed dimensions, zero jump) */}
                <div className="overflow-y-auto pr-0.5 flex-1">
                  <div className="grid grid-cols-2 gap-2">
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
                          className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center text-center leading-tight transition-colors cursor-pointer ${
                            subActive
                              ? isAmber
                                ? "bg-[#f59e0b] text-[#0a0a0c] border border-[#f59e0b] shadow-sm"
                                : "bg-[#e11d48] text-white border border-[#e11d48] shadow-sm"
                              : "bg-[#0a0a0c] text-zinc-200 border border-white/[0.09] hover:border-white/[0.22]"
                          }`}
                        >
                          <span>{subchip}</span>
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

        {/* Mina streamingtjänster (sparar & sorterar automatiskt) */}
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
            placeholder="t.ex. Något i stil med The Witcher eller en mörk thriller"
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
          <p
            role="alert"
            className="text-xs text-rose-400 text-center pt-1"
          >
            {error}
          </p>
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
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-base font-bold text-white">
                  {displayedRecs.length} skräddarsydda val för dig ikväll
                </h2>
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
                    key={rec.id || `${rec.title}-${idx}`}
                    className={`bg-[#16161a] border rounded-2xl p-5 space-y-4 transition-colors ${
                      streamMatch.matchesFlatrate
                        ? "border-emerald-500/40"
                        : "border-white/[0.08]"
                    }`}
                  >
                    {/* Top Header Row with w500 Poster + Title + Match % + TMDB Rating */}
                    <div className="flex items-start gap-4">
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

                      {/* 3-4 vibe-taggar */}
                      {rec.vibeTags && rec.vibeTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-zinc-400 pt-0.5">
                          {rec.vibeTags.map((tag, tIdx) => (
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
                      )}
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

                  {/* Actions: + Watchlist & Redan sett */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => onAddToWatchlist(rec)}
                      disabled={saved}
                      aria-label={
                        saved
                          ? `I Watchlist (${rec.title})`
                          : `+ Watchlist (${rec.title})`
                      }
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        saved
                          ? "bg-white/[0.04] text-[#f59e0b] border border-[#f59e0b]/40 cursor-default"
                          : "bg-[#0a0a0c] hover:bg-white/[0.06] text-white border border-white/[0.12]"
                      }`}
                    >
                      {saved ? (
                        <>
                          <Check className="w-4 h-4 text-[#f59e0b]" />
                          <span>I Watchlist</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-[#f59e0b]" />
                          <span>+ Watchlist</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onMarkAsWatched(rec)}
                      aria-label={`Redan sett (${rec.title})`}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#e11d48]/15 hover:bg-[#e11d48]/25 text-white border border-[#e11d48]/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#e11d48]" />
                      <span>Redan sett</span>
                    </button>
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
