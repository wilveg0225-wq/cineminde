import React, { useState, useEffect, useRef } from "react";
import {
  Bookmark,
  CheckCircle2,
  Trash2,
  Sparkles,
  Star,
  Search,
  Plus,
  Check,
  Loader2,
} from "lucide-react";
import {
  MovieRecommendation,
  TmdbMovieEnrichment,
  SWEDISH_STREAMING_SERVICES,
  normalizeMovieTitle,
  lookupCuratedTmdbMovie,
  movieMatchesStreamingProviders,
  filterMoviesByStreamingServices,
} from "../utils/movieLogic";
import { MoviePoster, SwedishStreamingSection } from "./MovieVisuals";

interface WatchlistTabProps {
  watchlist: MovieRecommendation[];
  onAddToWatchlist: (movie: MovieRecommendation) => void;
  onMarkWatchlistAsWatched: (movie: MovieRecommendation) => void;
  onRemoveFromWatchlist: (id: string) => void;
  onGoToTonight: () => void;
}

export const WatchlistTab: React.FC<WatchlistTabProps> = ({
  watchlist,
  onAddToWatchlist,
  onMarkWatchlistAsWatched,
  onRemoveFromWatchlist,
  onGoToTonight,
}) => {
  const [movieInput, setMovieInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<TmdbMovieEnrichment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = movieInput.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const storedTmdbKey = localStorage.getItem("tmdbApiKey") || "";
        const headers: Record<string, string> = {};
        if (storedTmdbKey) {
          headers["x-tmdb-key"] = storedTmdbKey;
        }
        const res = await fetch(
          `/api/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            setSearchResults(data.results.slice(0, 5));
            setShowDropdown(true);
          }
        }
      } catch {
        // Ignore network error
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [movieInput]);

  const isInWatchlist = (title: string) => {
    const norm = normalizeMovieTitle(title);
    return watchlist.some((w) => normalizeMovieTitle(w.title) === norm);
  };

  const handleSelectAutocompleteHit = (hit: TmdbMovieEnrichment) => {
    setShowDropdown(false);
    setMovieInput("");
    const customNote = noteInput.trim();
    setNoteInput("");
    setInputError(null);

    onAddToWatchlist({
      id: `manual-wl-${Date.now()}`,
      title: hit.title,
      originalTitle: hit.originalTitle,
      year: hit.year || "",
      runtime: "",
      mediaType: hit.mediaType || "movie",
      matchPercentage: 0,
      whyYouWillLikeIt: customNote,
      vibeTags: ["Till helgen"],
      tmdbId: hit.tmdbId,
      posterPath: hit.posterPath,
      tmdbRating: hit.voteAverage,
      swedishProviders: hit.swedishProviders,
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = movieInput.trim();
    if (!trimmed) {
      setInputError("Skriv in namnet på en film eller serie först.");
      return;
    }
    setInputError(null);
    setShowDropdown(false);
    setMovieInput("");
    const customNote = noteInput.trim();
    setNoteInput("");

    const meta =
      searchResults.find(
        (r) => normalizeMovieTitle(r.title) === normalizeMovieTitle(trimmed)
      ) ||
      searchResults[0] ||
      lookupCuratedTmdbMovie(trimmed);

    onAddToWatchlist({
      id: `manual-wl-${Date.now()}`,
      title: meta.title || trimmed,
      originalTitle: meta.originalTitle,
      year: meta.year || "",
      runtime: "",
      mediaType: meta.mediaType || "movie",
      matchPercentage: 0,
      whyYouWillLikeIt: customNote,
      vibeTags: ["Till helgen"],
      tmdbId: meta.tmdbId,
      posterPath: meta.posterPath,
      tmdbRating: meta.voteAverage,
      swedishProviders: meta.swedishProviders,
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Add Movie to Watchlist Panel */}
      <section
        aria-label="Lägg till film i Watchlist"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              Spara en film eller serie till helgen
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Såg du en poster eller fick ett tips? Sök upp filmen eller serien här så hämtas
              poster, betyg och svenska streamingtjänster direkt.
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#0a0a0c] border border-white/[0.08] text-xs font-mono-num font-semibold text-[#f59e0b] shrink-0">
            {watchlist.length} {watchlist.length === 1 ? "titel" : "titlar"}
          </div>
        </div>

        <div ref={searchContainerRef} className="relative">
          <form onSubmit={handleAddSubmit} className="space-y-2.5">
            <label htmlFor="watchlist-movie-title-input" className="sr-only">
              Sök eller skriv in filmens eller seriens namn
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="watchlist-movie-title-input"
                  type="text"
                  autoComplete="off"
                  value={movieInput}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true);
                  }}
                  onChange={(e) => {
                    setMovieInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  placeholder="Sök på en film eller serie du vill se..."
                  className="w-full min-h-[44px] rounded-xl bg-[#0a0a0c] border border-white/[0.08] pl-9 pr-8 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48] transition-colors"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 text-[#f59e0b] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-[#e11d48]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Spara</span>
              </button>
            </div>

            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Valfri notis (t.ex. 'Se med familjen på fredag' eller 'Såg trailer')"
              className="w-full min-h-[38px] rounded-xl bg-[#0a0a0c]/70 border border-white/[0.06] px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/[0.2] transition-colors"
            />

            {inputError && (
              <p role="alert" className="text-xs text-rose-400 pl-1">
                {inputError}
              </p>
            )}
          </form>

          {/* Live Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div
              role="listbox"
              aria-label="Sökförslag från TMDB"
              className="absolute left-0 right-0 top-full mt-2 z-30 bg-[#16161a] border border-white/[0.14] rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/[0.06]"
            >
              {searchResults.map((hit) => {
                const showOrig =
                  hit.originalTitle &&
                  normalizeMovieTitle(hit.originalTitle) !==
                    normalizeMovieTitle(hit.title);
                const alreadySaved = isInWatchlist(hit.title);

                return (
                  <button
                    key={`${hit.tmdbId}-${hit.title}`}
                    type="button"
                    role="option"
                    aria-selected={alreadySaved}
                    onClick={() => handleSelectAutocompleteHit(hit)}
                    className="w-full min-h-[56px] p-2.5 flex items-center gap-3 text-left hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <MoviePoster
                      title={hit.title}
                      year={hit.year}
                      posterPath={hit.posterPath}
                      size="w92"
                      className="w-9 h-13 rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {hit.title}{" "}
                        {showOrig && (
                          <span className="text-xs font-normal text-zinc-400 italic">
                            ({hit.originalTitle})
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono-num mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-medium text-zinc-300">
                          {hit.mediaType === "tv" ? "TV-serie" : "Film"}
                        </span>
                        <span>{hit.year}</span>
                        {typeof hit.voteAverage === "number" &&
                          hit.voteAverage > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#f59e0b]">
                                TMDB {hit.voteAverage.toFixed(1)}
                              </span>
                            </>
                          )}
                      </div>
                    </div>
                    {alreadySaved ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#f59e0b] px-2 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>Sparad</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#e11d48] px-2 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Watchlist</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Saved Watchlist Movies */}
      <section aria-label="Din Watchlist" className="space-y-4">
        {watchlist.length === 0 ? (
          <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-8 text-center space-y-4">
            <Bookmark className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-200">
                Din Watchlist är tom
              </p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Sök efter en film här ovanför som du är sugen på att se till
                helgen, eller spara tips från fliken "Ikväll".
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToTonight}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Hitta filmer för ikväll</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Streaming Service Sorter/Filter for Watchlist */}
            <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-300">
                  Filtrera efter dina streamingtjänster
                </span>
                {selectedServices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedServices([])}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Rensa ({selectedServices.length})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SWEDISH_STREAMING_SERVICES.map((service) => {
                  const active = selectedServices.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      aria-pressed={active}
                      className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60"
                          : "bg-[#0a0a0c] text-zinc-300 border border-white/[0.09] hover:border-white/[0.22]"
                      }`}
                    >
                      {active && <Check className="w-3 h-3 text-emerald-400" />}
                      <span>{service}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const filteredWatchlist = filterMoviesByStreamingServices(
                watchlist,
                selectedServices
              );

              if (filteredWatchlist.length === 0 && selectedServices.length > 0) {
                return (
                  <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-6 text-center space-y-2">
                    <p className="text-sm font-semibold text-zinc-200">
                      Inga sparade titlar på {selectedServices.join(", ")}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Ingen av titlarna i din Watchlist finns tillgänglig på{" "}
                      {selectedServices.join(", ")} just nu.
                    </p>
                  </div>
                );
              }

              return filteredWatchlist.map((movie) => {
              const showOriginal =
                movie.originalTitle &&
                normalizeMovieTitle(movie.originalTitle) !==
                  normalizeMovieTitle(movie.title);
              const streamMatch = movieMatchesStreamingProviders(
                movie.swedishProviders,
                selectedServices
              );

              return (
                <article
                  key={movie.id}
                  className={`bg-[#16161a] border rounded-2xl p-5 space-y-3.5 transition-colors ${
                    streamMatch.matchesFlatrate
                      ? "border-emerald-500/40"
                      : "border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <MoviePoster
                      title={movie.title}
                      year={movie.year}
                      posterPath={movie.posterPath}
                      size="w185"
                      className="w-16 h-24"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                            movie.mediaType === "tv"
                              ? "bg-purple-500/20 border border-purple-500/40 text-purple-300"
                              : "bg-white/[0.06] border border-white/[0.1] text-zinc-300"
                          }`}
                        >
                          {movie.mediaType === "tv" ? "TV-serie" : "Film"}
                        </span>
                        {movie.matchPercentage > 0 ? (
                          <span className="text-xs font-mono-num font-semibold text-[#f59e0b]">
                            {movie.matchPercentage}% matchning
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#f59e0b]/15 border border-[#f59e0b]/35 text-[10px] font-semibold text-[#f59e0b]">
                            Eget val · Till helgen
                          </span>
                        )}
                        {streamMatch.matchesFlatrate && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-semibold">
                            ✓ Ingår på {streamMatch.matchedNames.join(", ")}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-0.5 leading-snug">
                        {movie.title}
                      </h3>
                      {showOriginal && (
                        <p className="text-xs italic text-zinc-400 mt-0.5 truncate">
                          {movie.originalTitle}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 mt-1.5 font-mono-num">
                        {movie.year && <span>{movie.year}</span>}
                        {movie.runtime && (
                          <>
                            {movie.year && <span aria-hidden="true">·</span>}
                            <span>{movie.runtime}</span>
                          </>
                        )}
                        {typeof movie.tmdbRating === "number" &&
                          movie.tmdbRating > 0 && (
                            <>
                              {(movie.year || movie.runtime) && (
                                <span aria-hidden="true">·</span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[#f59e0b] font-semibold">
                                <Star className="w-3 h-3 fill-[#f59e0b] text-[#f59e0b]" />
                                <span>TMDB {movie.tmdbRating.toFixed(1)}</span>
                              </span>
                            </>
                          )}
                      </div>
                    </div>
                  </div>

                  {movie.whyYouWillLikeIt && (
                    <p className="text-xs text-zinc-300 leading-relaxed pt-2 border-t border-white/[0.06]">
                      {movie.whyYouWillLikeIt}
                    </p>
                  )}

                  {movie.vibeTags && movie.vibeTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                      {movie.vibeTags.map((tag, idx) => (
                        <React.Fragment key={tag}>
                          {idx > 0 && (
                            <span
                              aria-hidden="true"
                              className="text-zinc-600"
                            >
                              ·
                            </span>
                          )}
                          <span>{tag}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  <SwedishStreamingSection
                    swedishProviders={movie.swedishProviders}
                  />

                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => onMarkWatchlistAsWatched(movie)}
                      aria-label={`Markera ${movie.title} som sedd`}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Markera som sedd</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromWatchlist(movie.id)}
                      aria-label={`Ta bort ${movie.title} från Watchlist`}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0a0a0c] hover:bg-rose-500/15 text-xs font-semibold text-zinc-300 hover:text-rose-300 border border-white/[0.1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Ta bort</span>
                    </button>
                  </div>
                </article>
              );
            });
            })()}
          </div>
        )}
      </section>
    </div>
  );
};
