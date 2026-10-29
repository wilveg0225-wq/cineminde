import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Star,
  Trash2,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  Film,
  Search,
  Loader2,
} from "lucide-react";
import {
  WatchedMovie,
  TmdbMovieEnrichment,
  normalizeMovieTitle,
  lookupCuratedTmdbMovie,
} from "../utils/movieLogic";
import { RateMovieDraft } from "./RateMovieModal";
import { MoviePoster } from "./MovieVisuals";

interface WatchedTabProps {
  watchedMovies: WatchedMovie[];
  onOpenRateModal: (draft: RateMovieDraft) => void;
  onDeleteWatched: (id: string) => void;
}

const QUICK_SUGGESTIONS = [
  "Dune: Part Two",
  "The Witcher: Nightmare of the Wolf",
  "Gone Girl",
  "Mad Max: Fury Road",
  "Inception",
  "Parasite",
];

export const WatchedTab: React.FC<WatchedTabProps> = ({
  watchedMovies,
  onOpenRateModal,
  onDeleteWatched,
}) => {
  const [movieInput, setMovieInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<TmdbMovieEnrichment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
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

  // 300ms debounced TMDB live autocomplete search
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

  const handleSelectAutocompleteHit = (hit: TmdbMovieEnrichment) => {
    setShowDropdown(false);
    setMovieInput("");
    setInputError(null);
    onOpenRateModal({
      title: hit.title,
      originalTitle: hit.originalTitle,
      year: hit.year,
      mediaType: hit.mediaType,
      initialRating: 4,
      initialLiked: true,
      initialTags: [],
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
      setInputError("Skriv in namnet på en film först.");
      return;
    }
    setInputError(null);
    setShowDropdown(false);
    setMovieInput("");

    // Use top autocomplete match if exact, otherwise lookup curated metadata
    const meta =
      searchResults.find(
        (r) => normalizeMovieTitle(r.title) === normalizeMovieTitle(trimmed)
      ) || lookupCuratedTmdbMovie(trimmed);

    onOpenRateModal({
      title: meta.title || trimmed,
      originalTitle: meta.originalTitle,
      year: meta.year,
      mediaType: meta.mediaType,
      initialRating: 4,
      initialLiked: true,
      initialTags: [],
      tmdbId: meta.tmdbId,
      posterPath: meta.posterPath,
      tmdbRating: meta.voteAverage,
      swedishProviders: meta.swedishProviders,
    });
  };

  const availableQuickSuggestions = QUICK_SUGGESTIONS.filter(
    (s) =>
      !watchedMovies.some(
        (w) => normalizeMovieTitle(w.title) === normalizeMovieTitle(s)
      )
  ).slice(0, 4);

  return (
    <div className="space-y-6 pb-8">
      {/* Add Movie Panel with TMDB Live Autocomplete */}
      <section
        aria-label="Lägg till sedd film"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold text-white">
            Logga filmer & serier du har sett
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Sök bland tusentals filmer och TV-serier med live-autofyll eller lägg till
            manuellt.
          </p>
        </div>

        <div ref={searchContainerRef} className="relative">
          <form onSubmit={handleAddSubmit} className="space-y-2">
            <label htmlFor="watched-movie-title-input" className="sr-only">
              Sök eller skriv in filmens eller seriens namn
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="watched-movie-title-input"
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
                  placeholder="Sök på en film eller TV-serie..."
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
                <span>Lägg till</span>
              </button>
            </div>
            {inputError && (
              <p role="alert" className="text-xs text-rose-400 pl-1">
                {inputError}
              </p>
            )}
          </form>

          {/* Live Autocomplete Dropdown (5 best matches) */}
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
                return (
                  <button
                    key={`${hit.tmdbId}-${hit.title}`}
                    type="button"
                    role="option"
                    aria-selected={false}
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 font-sans">
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
                    <span className="text-xs font-semibold text-[#e11d48] px-2 shrink-0">
                      Välj
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick suggestions to log with 1 tap */}
        {availableQuickSuggestions.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06]">
            <p className="text-[11px] text-zinc-400 mb-2">
              Eller klicka för att betygsätta direkt:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableQuickSuggestions.map((title) => {
                const meta = lookupCuratedTmdbMovie(title);
                return (
                  <button
                    key={title}
                    type="button"
                    onClick={() =>
                      onOpenRateModal({
                        title: meta.title,
                        originalTitle: meta.originalTitle,
                        year: meta.year,
                        mediaType: meta.mediaType,
                        initialRating: 4,
                        initialLiked: true,
                        initialTags: [],
                        tmdbId: meta.tmdbId,
                        posterPath: meta.posterPath,
                        tmdbRating: meta.voteAverage,
                        swedishProviders: meta.swedishProviders,
                      })
                    }
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0a0a0c] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-zinc-300 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3 text-[#f59e0b]" />
                    <span>{title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Logged Movies List (Letterboxd-style with w185 Thumbnail Poster) */}
      <section aria-label="Dina loggade filmer" className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-base font-bold text-white">
            Dina sedda filmer
          </h2>
          <span className="text-xs text-zinc-400 font-mono-num">
            {watchedMovies.length} {watchedMovies.length === 1 ? "film" : "filmer"}
          </span>
        </div>

        {watchedMovies.length === 0 ? (
          <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-8 text-center space-y-2">
            <Film className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-200">
              Inga loggade filmer ännu
            </p>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Sök efter en film du sett här ovanför och välj vad som var bäst
              med den för att förfina din personliga smakprofil.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {watchedMovies.map((movie) => (
              <article
                key={movie.id}
                className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3.5">
                  {/* Letterboxd-style w185 thumbnail poster on the left */}
                  <MoviePoster
                    title={movie.title}
                    year={movie.year}
                    posterPath={movie.posterPath}
                    size="w185"
                    className="w-14 h-21"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white leading-snug truncate">
                          {movie.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono-num mt-0.5">
                          {movie.year && <span>{movie.year}</span>}
                          {typeof movie.tmdbRating === "number" &&
                            movie.tmdbRating > 0 && (
                              <>
                                {movie.year && <span aria-hidden="true">·</span>}
                                <span className="text-zinc-300">
                                  TMDB {movie.tmdbRating.toFixed(1)}
                                </span>
                              </>
                            )}
                        </div>
                      </div>

                      {/* Edit & Delete buttons */}
                      <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenRateModal({
                              id: movie.id,
                              title: movie.title,
                              originalTitle: movie.originalTitle,
                              year: movie.year,
                              mediaType: movie.mediaType,
                              initialRating: movie.rating,
                              initialLiked: movie.liked,
                              initialTags: movie.tags,
                              initialThoughts: movie.thoughts,
                              tmdbId: movie.tmdbId,
                              posterPath: movie.posterPath,
                              tmdbRating: movie.tmdbRating,
                              swedishProviders: movie.swedishProviders,
                            })
                          }
                          aria-label={`Redigera ${movie.title}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWatched(movie.id)}
                          aria-label={`Ta bort ${movie.title}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* User Rating & Sentiment */}
                    <div className="flex items-center gap-2.5 mt-2">
                      <div
                        className="flex items-center gap-0.5"
                        aria-label={`Betyg ${movie.rating} av 5 stjärnor`}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= movie.rating
                                ? "fill-[#f59e0b] text-[#f59e0b]"
                                : "text-zinc-700"
                            }`}
                          />
                        ))}
                      </div>
                      <span aria-hidden="true" className="text-zinc-600">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-300">
                        {movie.liked ? (
                          <>
                            <ThumbsUp className="w-3 h-3 text-[#f59e0b]" />
                            <span>Gillade</span>
                          </>
                        ) : (
                          <>
                            <ThumbsDown className="w-3 h-3 text-zinc-400" />
                            <span>Gillade inte</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Selected Quality Tags */}
                {movie.tags && movie.tags.length > 0 && (
                  <div className="pt-2.5 border-t border-white/[0.06]">
                    <p className="text-[11px] text-zinc-400 mb-1">
                      Bäst med filmen:
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-200">
                      {movie.tags.map((tag, idx) => (
                        <React.Fragment key={tag}>
                          {idx > 0 && (
                            <span
                              aria-hidden="true"
                              className="text-[#e11d48]"
                            >
                              ·
                            </span>
                          )}
                          <span>{tag}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Thoughts */}
                {movie.thoughts && (
                  <p className="text-xs text-zinc-400 italic pt-1">
                    "{movie.thoughts}"
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
