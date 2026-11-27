import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMovieTitle,
  getMovieFranchiseKey,
  limitOnePerFranchise,
  normalizeProviderKey,
  movieMatchesStreamingProviders,
  isMovieExcluded,
  filterDuplicateRecommendations,
  calculateTasteStats,
  generateSmartFallbackTasteProfile,
  validateAndParseImportData,
  generateSmartFallbackRecommendations,
  parseTmdbSwedishProviders,
  getTmdbPosterUrl,
  searchCuratedTmdbMovies,
  filterMoviesByStreamingServices,
  filterAndVerifyMoviesByTmdbCategories,
  filterAndVerifyMoviesWithFallback,
  limitAnimatedRecommendations,
  limitEastAsianRecommendations,
  verifyMovieAgainstTmdbCategories,
  NO_EXACT_MATCH_FALLBACK_MESSAGE,
  scoreCandidateForUserProfile,
  generateSmartRecommendationsWithStatus,
  lookupCuratedTmdbMovie,
  isMovieMatchingDislikedCategories,
  filterOutDislikedCategories,
  getDislikedGenreIds,
  buildRecommendationSystemPrompt,
  DEFAULT_WATCHED_MOVIES,
  WatchedMovie,
  MovieRecommendation,
  getSeriesSeasonCount,
  KNOWN_SERIES_SEASON_COUNTS,
  GENRE_GROUPS,
  CONTENT_GROUPS,
  SETTING_GROUPS,
  MOOD_GROUPS,
  formatSelectedChipsWithContext,
  extractTmdbVerificationRules,
  extractTmdbDiscoverFilters,
  resolveEffectiveMediaType,
  parseRuntimeMinutes,
  formatRuntimeMinutes,
  hasNonLatinScript,
  normalizeSwedishAgeRating,
  parseTmdbMovieAgeRating,
  parseTmdbTvAgeRating,
  inferAgeRatingFromGenres,
  selectFavoriteSeedsForTmdb,
  buildHybridCandidatePool,
  formatCandidatePoolForPrompt,
  resolveRecommendationTemperature,
  getTasteCalibrationDeck,
  buildWatchedMovieFromCalibration,
  buildDismissedMovieFromCalibration,
} from "./movieLogic";

test("normalizeMovieTitle normalizes casing, accents, and punctuation", () => {
  assert.equal(
    normalizeMovieTitle("Sagan om ringen: Härskarringen!"),
    "sagan om ringen harskarringen"
  );
  assert.equal(normalizeMovieTitle("  Knives   Out  "), "knives out");
});

test("isMovieExcluded detects duplicates in both watchedMovies and watchlist", () => {
  const watched: WatchedMovie[] = [
    {
      id: "1",
      title: "Prisoners",
      rating: 5,
      liked: true,
      tags: ["Stämningen / Atmosfären"],
      addedAt: "2026-10-01",
    },
  ];
  const watchlist: MovieRecommendation[] = [
    {
      id: "2",
      title: "Se7en",
      originalTitle: "Seven",
      year: "1995",
      runtime: "2 tim 7 min",
      matchPercentage: 95,
      whyYouWillLikeIt: "Test",
      vibeTags: ["Mörk"],
    },
  ];

  assert.equal(
    isMovieExcluded({ title: "prisoners" }, watched, watchlist),
    true
  );
  assert.equal(
    isMovieExcluded({ title: "Seven" }, watched, watchlist),
    true
  );
  assert.equal(
    isMovieExcluded({ title: "Zodiac" }, watched, watchlist),
    false
  );
});

test("filterDuplicateRecommendations removes watched, watchlist, and internal duplicates", () => {
  const watched: WatchedMovie[] = [
    {
      id: "w1",
      title: "Prisoners",
      rating: 5,
      liked: true,
      tags: [],
      addedAt: "2026-10-01",
    },
  ];
  const watchlist: MovieRecommendation[] = [];
  const candidates: MovieRecommendation[] = [
    {
      id: "c1",
      title: "Prisoners",
      year: "2013",
      runtime: "2 tim 33 min",
      matchPercentage: 98,
      whyYouWillLikeIt: "Already watched",
      vibeTags: [],
    },
    {
      id: "c2",
      title: "Zodiac",
      year: "2007",
      runtime: "2 tim 37 min",
      matchPercentage: 96,
      whyYouWillLikeIt: "Fresh 1",
      vibeTags: [],
    },
    {
      id: "c3",
      title: "ZODIAC",
      year: "2007",
      runtime: "2 tim 37 min",
      matchPercentage: 95,
      whyYouWillLikeIt: "Duplicate of c2",
      vibeTags: [],
    },
  ];

  const filtered = filterDuplicateRecommendations(candidates, watched, watchlist);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Zodiac");

  const pinpointCandidates: MovieRecommendation[] = [
    {
      id: "p1",
      title: "Prisoners",
      year: "2013",
      runtime: "2 tim 33 min",
      matchPercentage: 99,
      whyYouWillLikeIt: "Exakt filmen du tänkte på",
      vibeTags: [],
      isExactPinpointMatch: true,
    },
  ];
  const pinpointFiltered = filterDuplicateRecommendations(
    pinpointCandidates,
    watched,
    watchlist
  );
  assert.equal(pinpointFiltered.length, 1);
  assert.equal(pinpointFiltered[0].title, "Prisoners");
});

test("calculateTasteStats computes accurate average rating and top tags", () => {
  const stats = calculateTasteStats(DEFAULT_WATCHED_MOVIES);
  assert.equal(stats.totalWatched, 3);
  assert.equal(stats.averageRating, 4.7);
  assert.equal(stats.likedCount, 3);
  assert.equal(stats.topTags[0].count, 2);
  assert.ok(
    stats.topTags.slice(0, 3).some((t) => t.tag === "Stämningen / Atmosfären")
  );
});

test("validateAndParseImportData validates and sanitizes JSON import payload", () => {
  const validJson = JSON.stringify({
    version: 1,
    watchedMovies: [
      { title: "Dune: Part Two", rating: 5, tags: ["Världsbygget / Miljön"] },
    ],
    watchlist: [],
    tasteProfileSummary: "Älskar sci-fi.",
  });

  const parsed = validateAndParseImportData(validJson);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.data?.watchedMovies.length, 1);
  assert.equal(parsed.data?.watchedMovies[0].title, "Dune: Part Two");

  const invalid = validateAndParseImportData("{ broken json ");
  assert.equal(invalid.valid, false);
});

test("generateSmartFallbackRecommendations returns 5 unique movies with TMDB ratings and Swedish providers", () => {
  const recs = generateSmartFallbackRecommendations(
    DEFAULT_WATCHED_MOVIES,
    [],
    {
      moods: ["Mörk & rå"],
      contents: ["Smart plot-twist"],
      frameworks: [],
      customText: "",
    }
  );
  assert.equal(recs.length, 5);
  for (const r of recs) {
    assert.ok(r.whyYouWillLikeIt.includes("Prisoners"));
    assert.equal(isMovieExcluded(r, DEFAULT_WATCHED_MOVIES, []), false);
    assert.ok(typeof r.tmdbRating === "number" && r.tmdbRating > 0);
    assert.ok(r.swedishProviders);
  }
});

test("parseTmdbSwedishProviders prioritizes flatrate over rent/buy and handles empty SE results", () => {
  const flatrateResult = parseTmdbSwedishProviders({
    flatrate: [
      { provider_id: 8, provider_name: "Netflix", logo_path: "/netflix.jpg" },
    ],
    rent: [{ provider_id: 2, provider_name: "Apple TV" }],
  });
  assert.equal(flatrateResult.type, "flatrate");
  assert.equal(flatrateResult.providers.length, 1);
  assert.equal(flatrateResult.providers[0].provider_name, "Netflix");

  const rentBuyResult = parseTmdbSwedishProviders({
    rent: [{ provider_id: 2, provider_name: "Apple TV" }],
    buy: [
      { provider_id: 2, provider_name: "Apple TV" },
      { provider_id: 426, provider_name: "SF Anytime" },
    ],
  });
  assert.equal(rentBuyResult.type, "rent_buy");
  assert.equal(rentBuyResult.providers.length, 2);

  const noneResult = parseTmdbSwedishProviders(undefined);
  assert.equal(noneResult.type, "none");
});

test("getTmdbPosterUrl formats TMDB paths and searchCuratedTmdbMovies finds matches", () => {
  assert.equal(
    getTmdbPosterUrl("/abc.jpg", "w500"),
    "https://image.tmdb.org/t/p/w500/abc.jpg"
  );
  assert.equal(getTmdbPosterUrl(undefined), null);

  const duneResults = searchCuratedTmdbMovies("Dune");
  assert.ok(duneResults.length >= 2);
  assert.ok(duneResults.some((m) => m.title === "Dune: Part Two"));
});

test("filterMoviesByStreamingServices hides titles only on other services while preserving multi-provider titles", () => {
  const sample: MovieRecommendation[] = [
    {
      id: "1",
      title: "Exclusive HBO Movie",
      year: "2024",
      runtime: "2 tim",
      matchPercentage: 98,
      whyYouWillLikeIt: "Test",
      vibeTags: [],
      swedishProviders: {
        type: "flatrate",
        providers: [{ provider_id: 1899, provider_name: "HBO Max" }],
      },
    },
    {
      id: "2",
      title: "Netflix + Apple TV Movie",
      year: "2023",
      runtime: "2 tim",
      matchPercentage: 95,
      whyYouWillLikeIt: "Test",
      vibeTags: [],
      swedishProviders: {
        type: "flatrate",
        providers: [
          { provider_id: 8, provider_name: "Netflix" },
          { provider_id: 2, provider_name: "Apple TV" },
        ],
      },
    },
  ];

  const filtered = filterMoviesByStreamingServices(sample, ["Netflix"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Netflix + Apple TV Movie");
  assert.equal(filtered[0].swedishProviders?.providers.length, 2);
});

test("filterAndVerifyMoviesByTmdbCategories rejects movies whose official TMDB genres do not match chosen categories", () => {
  const candidates: MovieRecommendation[] = [
    {
      id: "1",
      title: "Se7en",
      year: "1995",
      runtime: "2 tim 7 min",
      matchPercentage: 98,
      whyYouWillLikeIt: "Crime thriller",
      vibeTags: [],
      tmdbGenreIds: [80, 9648, 53], // Krim, Mysterium, Thriller (NO Action/Adventure)
    },
    {
      id: "2",
      title: "Mad Max: Fury Road",
      year: "2015",
      runtime: "2 tim",
      matchPercentage: 96,
      whyYouWillLikeIt: "Action car chase",
      vibeTags: [],
      tmdbGenreIds: [28, 12, 878], // Action, Äventyr, Sci-Fi
    },
  ];

  const verified = filterAndVerifyMoviesByTmdbCategories(candidates, {
    genres: ["Biljakter & Adrenalin"],
    contents: ["Strid, Action & Hämnd"],
    frameworks: [],
    moods: ["Episk & storslagen"],
    customText: "",
  });

  assert.equal(verified.length, 1);
  assert.equal(verified[0].title, "Mad Max: Fury Road");
});

test("filterAndVerifyMoviesByTmdbCategories strictly enforces AND-logic across multiple chosen categories (rejecting Trolls when Animerat + Action is selected)", () => {
  const candidates: MovieRecommendation[] = [
    {
      id: "trolls-1",
      title: "Trolls",
      year: "2016",
      runtime: "1 tim 32 min",
      matchPercentage: 95,
      whyYouWillLikeIt: "Animerad familjefilm",
      vibeTags: ["Animerat", "Familj"],
      tmdbGenreIds: [16, 12, 10751, 35, 14], // Animerat, Äventyr, Familj, Komedi, Fantasy - NO Action (28)!
    },
    {
      id: "john-wick-1",
      title: "John Wick",
      year: "2014",
      runtime: "1 tim 41 min",
      matchPercentage: 94,
      whyYouWillLikeIt: "Rå action",
      vibeTags: ["Action", "Thriller"],
      tmdbGenreIds: [28, 53], // Action, Thriller - NO Animation (16)!
    },
    {
      id: "spider-verse-1",
      title: "Spider-Man: Into the Spider-Verse",
      year: "2018",
      runtime: "1 tim 57 min",
      matchPercentage: 98,
      whyYouWillLikeIt: "Både animerat och högoktanig action",
      vibeTags: ["Animerat", "Action"],
      tmdbGenreIds: [16, 28, 12, 878], // Has BOTH Animerat (16) AND Action (28)!
    },
  ];

  const result = filterAndVerifyMoviesByTmdbCategories(candidates, {
    genres: ["Animerat", "Action"],
    contents: [],
    frameworks: [],
    moods: [],
    customText: "",
  });

  // Trolls (only animation, no action) and John Wick (only action, no animation) MUST be rejected!
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Spider-Man: Into the Spider-Verse");
});

test("lookupCuratedTmdbMovie returns empty providers for unlisted titles and prevents false Netflix leaks", () => {
  const unlisted = lookupCuratedTmdbMovie("Some Random Non-Curated Movie 2026", "2026");
  assert.equal(unlisted.swedishProviders?.type, "none");
  assert.equal(unlisted.swedishProviders?.providers.length, 0);

  const filtered = filterMoviesByStreamingServices(
    [
      {
        id: "x",
        title: "Some Random Non-Curated Movie 2026",
        year: "2026",
        runtime: "2 tim",
        matchPercentage: 90,
        whyYouWillLikeIt: "",
        vibeTags: [],
        swedishProviders: unlisted.swedishProviders,
      },
    ],
    ["Netflix"]
  );
  assert.equal(filtered.length, 0, "Unlisted titles must not leak through Netflix filter");
});

test("normalizeProviderKey normalizes all aliases accurately", () => {
  assert.equal(normalizeProviderKey("Netflix"), "netflix");
  assert.equal(normalizeProviderKey("Max"), "max");
  assert.equal(normalizeProviderKey("HBO Max"), "max");
  assert.equal(normalizeProviderKey("Disney+"), "disney+");
  assert.equal(normalizeProviderKey("Prime Video"), "prime video");
  assert.equal(normalizeProviderKey("Amazon Prime"), "prime video");
  assert.equal(normalizeProviderKey("Viaplay"), "viaplay");
  assert.equal(normalizeProviderKey("SkyShowtime"), "skyshowtime");
  assert.equal(normalizeProviderKey("TV4 Play"), "tv4 play");
  assert.equal(normalizeProviderKey("C More"), "tv4 play");
  assert.equal(normalizeProviderKey("Apple TV+"), "apple tv+");
  assert.equal(normalizeProviderKey("SF Anytime"), "sf anytime");
});

test("movieMatchesStreamingProviders handles null, empty, flatrate, and rent/buy edge cases", () => {
  assert.deepEqual(
    movieMatchesStreamingProviders(undefined, ["Netflix"]),
    { matchesFlatrate: false, matchesRentBuy: false, matchedNames: [] }
  );

  assert.deepEqual(
    movieMatchesStreamingProviders({ type: "none", providers: [] }, ["Netflix"]),
    { matchesFlatrate: false, matchesRentBuy: false, matchedNames: [] }
  );

  assert.deepEqual(
    movieMatchesStreamingProviders(
      { type: "flatrate", providers: [{ provider_id: 8, provider_name: "Netflix" }] },
      []
    ),
    { matchesFlatrate: false, matchesRentBuy: false, matchedNames: [] }
  );

  const flatMatch = movieMatchesStreamingProviders(
    {
      type: "flatrate",
      providers: [
        { provider_id: 8, provider_name: "Netflix" },
        { provider_id: 1899, provider_name: "HBO Max" },
      ],
    },
    ["HBO Max"]
  );
  assert.equal(flatMatch.matchesFlatrate, true);
  assert.equal(flatMatch.matchesRentBuy, false);
  assert.deepEqual(flatMatch.matchedNames, ["HBO Max"]);

  const rentMatch = movieMatchesStreamingProviders(
    {
      type: "rent_buy",
      providers: [{ provider_id: 426, provider_name: "SF Anytime" }],
    },
    ["SF Anytime"]
  );
  assert.equal(rentMatch.matchesFlatrate, false);
  assert.equal(rentMatch.matchesRentBuy, true);
  assert.deepEqual(rentMatch.matchedNames, ["SF Anytime"]);
});

test("calculateTasteStats and generateSmartFallbackTasteProfile handle empty watched list safely", () => {
  const emptyStats = calculateTasteStats([]);
  assert.equal(emptyStats.totalWatched, 0);
  assert.equal(emptyStats.averageRating, 0);
  assert.equal(emptyStats.likedCount, 0);
  assert.deepEqual(emptyStats.topTags, []);

  const emptyProfile = generateSmartFallbackTasteProfile([]);
  assert.ok(emptyProfile.includes("Du har inte loggat några sedda filmer ännu"));

  const singleWatched: WatchedMovie[] = [
    {
      id: "single-1",
      title: "Bad Movie",
      rating: 1,
      liked: false,
      tags: ["Segt tempo"],
      addedAt: "2026-10-01",
    },
  ];
  const singleStats = calculateTasteStats(singleWatched);
  assert.equal(singleStats.totalWatched, 1);
  assert.equal(singleStats.averageRating, 1);
  assert.equal(singleStats.likedCount, 0);
  assert.equal(singleStats.topTags[0].tag, "Segt tempo");
  assert.equal(singleStats.topTags[0].percentage, 100);

  const singleProfile = generateSmartFallbackTasteProfile(singleWatched);
  assert.ok(singleProfile.includes("Bad Movie"));
  assert.ok(singleProfile.includes("undvika"));
});

test("verifyMovieAgainstTmdbCategories verifies release eras and TV series lengths", () => {
  // Era verification
  const movie80s = {
    title: "The Thing",
    year: "1982",
    runtime: "1 tim 49 min",
    tmdbGenreIds: [27, 878, 9648],
  };
  const movie2023 = {
    title: "Oppenheimer",
    year: "2023",
    runtime: "3 tim",
    tmdbGenreIds: [18, 36],
  };

  const era80sPref = {
    moods: [],
    genres: [],
    contents: [],
    frameworks: ["1980-talet (80-talsklassiker)"],
    customText: "",
  };

  const check80s = verifyMovieAgainstTmdbCategories(movie80s, era80sPref);
  assert.equal(check80s.verified, true);

  const checkFail80s = verifyMovieAgainstTmdbCategories(movie2023, era80sPref);
  assert.equal(checkFail80s.verified, false);

  // TV series season count verification
  const miniSeries = {
    title: "Chernobyl",
    year: "2019",
    runtime: "1 säsong · 5 avsnitt",
    tmdbGenreIds: [18, 36],
  };
  const longShow = {
    title: "Game of Thrones",
    year: "2011",
    runtime: "8 säsonger",
    tmdbGenreIds: [18, 10765],
  };

  const miniPref = {
    moods: ["Miniserie (1 kort säsong)"],
    genres: [],
    contents: [],
    frameworks: [],
    customText: "",
  };

  const checkMini = verifyMovieAgainstTmdbCategories(miniSeries, miniPref);
  assert.equal(checkMini.verified, true);

  const checkMiniReject = verifyMovieAgainstTmdbCategories(longShow, miniPref);
  assert.equal(checkMiniReject.verified, false);
});

test("validateAndParseImportData caps extreme ratings and handles corrupted items", () => {
  const corruptedPayload = JSON.stringify({
    version: 1,
    watchedMovies: [
      null,
      { title: "" }, // invalid empty title
      { title: "Valid Movie", rating: 99, liked: "not a bool", tags: [123, "Tag"] },
      { title: "Low Movie", rating: -5 },
    ],
    watchlist: [
      null,
      { title: "Future Movie", matchPercentage: 200 },
    ],
  });

  const parsed = validateAndParseImportData(corruptedPayload);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.data?.watchedMovies.length, 2);
  assert.equal(parsed.data?.watchedMovies[0].rating, 5); // capped at 5
  assert.equal(parsed.data?.watchedMovies[0].liked, true);
  assert.deepEqual(parsed.data?.watchedMovies[0].tags, ["123", "Tag"]);
  assert.equal(parsed.data?.watchedMovies[1].rating, 1); // floored at 1

  assert.equal(parsed.data?.watchlist.length, 1);
  assert.equal(parsed.data?.watchlist[0].matchPercentage, 99); // capped at 99
});

test("isMovieMatchingDislikedCategories accurately detects movies matching disliked categories", () => {
  // Horror movie (TMDB ID 27)
  const horrorMovie = {
    title: "Hereditary",
    tmdbGenreIds: [27, 9648],
    tmdbGenres: ["Skräck", "Mysterium"],
    vibeTags: ["Obehaglig", "Krypande skräck"],
  };

  // Romance movie (TMDB ID 10749)
  const romanceMovie = {
    title: "La La Land",
    tmdbGenreIds: [35, 18, 10749, 10402],
    tmdbGenres: ["Komedi", "Drama", "Romantik", "Musik"],
    vibeTags: ["Romantisk", "Musikalisk"],
  };

  // Sci-Fi / Action movie
  const sciFiActionMovie = {
    title: "The Matrix",
    tmdbGenreIds: [28, 878],
    tmdbGenres: ["Action", "Sci-Fi"],
    vibeTags: ["Mind-bending", "Cyberpunk"],
  };

  // Check horror detection
  assert.equal(isMovieMatchingDislikedCategories(horrorMovie, ["Skräck"]), true);
  assert.equal(isMovieMatchingDislikedCategories(horrorMovie, ["Horror"]), true);
  assert.equal(isMovieMatchingDislikedCategories(horrorMovie, ["Romantik"]), false);

  // Check romance & musical detection
  assert.equal(isMovieMatchingDislikedCategories(romanceMovie, ["Romantik"]), true);
  assert.equal(isMovieMatchingDislikedCategories(romanceMovie, ["Musikal"]), true);
  assert.equal(isMovieMatchingDislikedCategories(romanceMovie, ["Skräck"]), false);

  // Check custom keyword in vibeTags or text
  const zombieMovie = {
    title: "28 Days Later",
    tmdbGenreIds: [53],
    tmdbGenres: ["Thriller"],
    vibeTags: ["Zombies", "Postapokalyps"],
  };
  assert.equal(isMovieMatchingDislikedCategories(zombieMovie, ["Zombies"]), true);

  // Filter out disliked categories
  const pool = [horrorMovie, romanceMovie, sciFiActionMovie];
  const withoutHorror = filterOutDislikedCategories(pool, ["Skräck"]);
  assert.equal(withoutHorror.length, 2);
  assert.equal(withoutHorror.some((m) => m.title === "Hereditary"), false);

  const withoutHorrorAndRomance = filterOutDislikedCategories(pool, [
    "Skräck",
    "Romantik",
  ]);
  assert.equal(withoutHorrorAndRomance.length, 1);
  assert.equal(withoutHorrorAndRomance[0].title, "The Matrix");
});

test("generateSmartFallbackRecommendations never suggests movies from disliked categories", () => {
  const emptyPrefs = {
    moods: [],
    genres: [],
    contents: [],
    frameworks: [],
    customText: "",
  };

  // When "Komedi" is disliked
  const recsWithoutComedy = generateSmartFallbackRecommendations(
    DEFAULT_WATCHED_MOVIES,
    [],
    emptyPrefs,
    ["Komedi"]
  );

  assert.equal(recsWithoutComedy.length, 5);
  for (const movie of recsWithoutComedy) {
    const isComedy =
      (movie.tmdbGenreIds || []).includes(35) ||
      (movie.tmdbGenres || []).some((g) => g.toLowerCase().includes("komedi"));
    assert.equal(
      isComedy,
      false,
      `Film "${movie.title}" should not be a comedy when Komedi is disliked`
    );
  }

  // When "Sci-Fi" is disliked
  const recsWithoutSciFi = generateSmartFallbackRecommendations(
    DEFAULT_WATCHED_MOVIES,
    [],
    emptyPrefs,
    ["Sci-Fi"]
  );

  assert.equal(recsWithoutSciFi.length, 5);
  for (const movie of recsWithoutSciFi) {
    const isSciFi =
      (movie.tmdbGenreIds || []).includes(878) ||
      (movie.tmdbGenres || []).some((g) => g.toLowerCase().includes("sci-fi"));
    assert.equal(
      isSciFi,
      false,
      `Film "${movie.title}" should not be Sci-Fi when Sci-Fi is disliked`
    );
  }
});

test("buildRecommendationSystemPrompt and taste profile reflect disliked categories", () => {
  const prompt = buildRecommendationSystemPrompt(
    DEFAULT_WATCHED_MOVIES,
    [],
    "Gillar spänning.",
    {
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
    },
    [],
    ["Skräck", "Romantik"]
  );

  assert.match(prompt, /TOTALFÖRBUD MOT OGILLADE KATEGORIER/);
  assert.match(prompt, /Skräck, Romantik/);

  // Fallback taste profile
  const profileWithDislikes = generateSmartFallbackTasteProfile(
    DEFAULT_WATCHED_MOVIES,
    ["Musikal", "Reality"]
  );
  assert.match(profileWithDislikes, /Musikal, Reality/);
});

test("validateAndParseImportData preserves dislikedCategories", () => {
  const payload = JSON.stringify({
    version: 1,
    watchedMovies: [{ title: "Testfilm", rating: 4, liked: true, tags: ["Spännande"] }],
    watchlist: [],
    tasteProfileSummary: "Profil här",
    dislikedCategories: ["Skräck", "Musikal", "   "],
  });

  const parsed = validateAndParseImportData(payload);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.data?.dislikedCategories, ["Skräck", "Musikal"]);
});

test("filterDuplicateRecommendations and fallbacks strictly eliminate previousTitles to prevent loops", () => {
  const recommendations: MovieRecommendation[] = [
    {
      id: "1",
      title: "Inception",
      originalTitle: "Inception",
      year: "2010",
      runtime: "2 tim 28 min",
      matchPercentage: 95,
      whyYouWillLikeIt: "Briljant sci-fi.",
      vibeTags: ["Mind-bending"],
    },
    {
      id: "2",
      title: "Interstellar",
      originalTitle: "Interstellar",
      year: "2014",
      runtime: "2 tim 49 min",
      matchPercentage: 94,
      whyYouWillLikeIt: "Rymdäventyr.",
      vibeTags: ["Rymden"],
    },
    {
      id: "3",
      title: "Dune",
      originalTitle: "Dune",
      year: "2021",
      runtime: "2 tim 35 min",
      matchPercentage: 92,
      whyYouWillLikeIt: "Storslaget.",
      vibeTags: ["Sci-Fi"],
    },
  ];

  // User has already seen "Inception" in previous swipes
  const previous = ["Inception"];
  const clean = filterDuplicateRecommendations(
    recommendations,
    [],
    [],
    previous
  );

  assert.equal(clean.length, 2);
  assert.equal(clean.some((m) => m.title === "Inception"), false);
  assert.equal(clean[0].title, "Interstellar");
  assert.equal(clean[1].title, "Dune");

  // Verify that generateSmartFallbackRecommendations gives completely different movies
  // when the first batch is passed in previousTitles
  const emptyPrefs = {
    moods: [],
    genres: [],
    contents: [],
    frameworks: [],
    customText: "",
  };

  const batch1 = generateSmartFallbackRecommendations(
    DEFAULT_WATCHED_MOVIES,
    [],
    emptyPrefs,
    [],
    []
  );
  assert.equal(batch1.length, 5);
  const batch1Titles = batch1.map((m) => m.title);

  // Next batch excludes all titles in batch 1
  const batch2 = generateSmartFallbackRecommendations(
    DEFAULT_WATCHED_MOVIES,
    [],
    emptyPrefs,
    [],
    batch1Titles
  );
  assert.equal(batch2.length, 5);

  // Zero overlap between batch 1 and batch 2
  for (const m of batch2) {
    assert.equal(
      batch1Titles.includes(m.title),
      false,
      `Movie "${m.title}" from batch 1 was repeated in batch 2`
    );
  }
});

test("Season ratings: validateAndParseImportData parses seasons and mediaType", () => {
  const json = JSON.stringify({
    watchedMovies: [
      {
        id: "w1",
        title: "True Detective",
        mediaType: "tv",
        rating: 4,
        liked: true,
        tags: ["Mästerverk"],
        seasons: [
          {
            seasonNumber: 1,
            rating: 5,
            liked: true,
            tags: ["Mästerverk", "Skådespeleriet / Dialogen"],
            thoughts: "Bästa säsongen någonsin skapad.",
          },
          {
            seasonNumber: 2,
            rating: 2,
            liked: false,
            tags: ["Tappade tempo"],
            thoughts: "Rörig handling.",
          },
        ],
      },
    ],
    watchlist: [],
  });

  const res = validateAndParseImportData(json);
  assert.equal(res.valid, true);
  assert.equal(res.data?.watchedMovies.length, 1);
  const movie = res.data!.watchedMovies[0];
  assert.equal(movie.mediaType, "tv");
  assert.equal(movie.seasons?.length, 2);
  assert.equal(movie.seasons[0].seasonNumber, 1);
  assert.equal(movie.seasons[0].rating, 5);
  assert.equal(movie.seasons[0].liked, true);
  assert.equal(movie.seasons[1].seasonNumber, 2);
  assert.equal(movie.seasons[1].rating, 2);
  assert.equal(movie.seasons[1].liked, false);
});

test("Season ratings: buildRecommendationSystemPrompt distinguishes different seasons and warns against lumping them together", () => {
  const watched: WatchedMovie[] = [
    {
      id: "w1",
      title: "True Detective",
      mediaType: "tv",
      rating: 4,
      liked: true,
      tags: ["Mästerverk"],
      addedAt: "2026-10-01",
      seasons: [
        {
          seasonNumber: 1,
          rating: 5,
          liked: true,
          tags: ["Skådespeleriet / Dialogen", "Stämningen / Atmosfären"],
          thoughts: "Fantastisk atmosfär och mysterium.",
        },
        {
          seasonNumber: 2,
          rating: 2,
          liked: false,
          tags: ["Svag story"],
          thoughts: "Splittrad och tråkig.",
        },
      ],
    },
  ];

  const prompt = buildRecommendationSystemPrompt(
    watched,
    [],
    "Gillar täta mysterier",
    { moods: [], contents: [], frameworks: [], customText: "" }
  );

  // Check that Season 1 appears in favorites
  assert.ok(
    prompt.includes('"True Detective (Säsong 1)" (5/5 stjärnor, Gillade)'),
    "Prompt should list Season 1 under favorites"
  );
  // Check that Season 2 appears in disliked
  assert.ok(
    prompt.includes('"True Detective (Säsong 2)" (2/5 stjärnor, Gillade inte)'),
    "Prompt should list Season 2 under disliked"
  );
  // Check that explicit instruction not to lump seasons together is included
  assert.ok(
    prompt.includes("VIKTIG REGEL FÖR SÄSONGSBETYG PÅ SERIER"),
    "Prompt must instruct Gemini not to lump season ratings together"
  );
});

test("Season ratings: generateSmartFallbackTasteProfile separates seasons into fav and disliked", () => {
  const watched: WatchedMovie[] = [
    {
      id: "w1",
      title: "Fargo",
      mediaType: "tv",
      rating: 4,
      liked: true,
      tags: ["Manuset / Storyn"],
      addedAt: "2026-10-01",
      seasons: [
        {
          seasonNumber: 1,
          rating: 5,
          liked: true,
          tags: ["Manuset / Storyn"],
        },
        {
          seasonNumber: 4,
          rating: 2,
          liked: false,
          tags: [],
        },
      ],
    },
  ];

  const summary = generateSmartFallbackTasteProfile(watched);
  assert.ok(
    summary.includes("Fargo (Säsong 1)"),
    "Fallback summary should mention Fargo (Säsong 1) in favorites"
  );
  assert.ok(
    summary.includes("Fargo (Säsong 4)"),
    "Fallback summary should mention Fargo (Säsong 4) in dislikes"
  );
});

test("Series season counts: getSeriesSeasonCount returns exact season counts for known series", () => {
  assert.equal(getSeriesSeasonCount("Chernobyl"), 1);
  assert.equal(getSeriesSeasonCount("Shōgun"), 1);
  assert.equal(getSeriesSeasonCount("Severance"), 2);
  assert.equal(getSeriesSeasonCount("Dark"), 3);
  assert.equal(getSeriesSeasonCount("True Detective"), 4);
  assert.equal(getSeriesSeasonCount("Breaking Bad"), 5);
  assert.equal(getSeriesSeasonCount("The Sopranos"), 6);
  assert.equal(getSeriesSeasonCount("Game of Thrones"), 8);
  assert.equal(getSeriesSeasonCount("Friends"), 10);
});

test("lookupCuratedTmdbMovie identifies series mediaType and seasonCount", () => {
  const td = lookupCuratedTmdbMovie("True Detective");
  assert.equal(td.mediaType, "tv");
  assert.equal(td.seasonCount, 4);

  const bb = lookupCuratedTmdbMovie("Breaking Bad");
  assert.equal(bb.mediaType, "tv");
  assert.equal(bb.seasonCount, 5);

  const movie = lookupCuratedTmdbMovie("Inception");
  assert.notEqual(movie.mediaType, "tv");
});

test("Subcategories are concise, single-concept, and verified by TMDB rules", () => {
  const allGroups = [
    ...GENRE_GROUPS,
    ...CONTENT_GROUPS,
    ...SETTING_GROUPS,
    ...MOOD_GROUPS,
  ];

  for (const group of allGroups) {
    for (const sub of group.subchips) {
      assert.ok(
        !sub.includes("(") && !sub.includes(")"),
        `Subcategory "${sub}" should not contain parentheses`
      );
      assert.ok(
        !sub.includes("&") && !sub.includes("/"),
        `Subcategory "${sub}" should not combine multiple concepts with & or /`
      );
      assert.ok(
        sub.length <= 24,
        `Subcategory "${sub}" should be concise (<= 24 chars)`
      );
    }
  }

  const checkEra = verifyMovieAgainstTmdbCategories(
    { year: "1985", runtime: "1 tim 56 min", tmdbGenreIds: [878, 12] },
    { moods: [], genres: ["Tidsresor"], contents: [], frameworks: ["1980-talet"], customText: "" }
  );
  assert.equal(checkEra.verified, true);

  const checkMini = verifyMovieAgainstTmdbCategories(
    { year: "2019", runtime: "1 säsong · 5 avsnitt", tmdbGenreIds: [18] },
    { moods: ["Miniserie"], genres: [], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(checkMini.verified, true);

  const checkMiniReject = verifyMovieAgainstTmdbCategories(
    { year: "2011", runtime: "8 säsonger", tmdbGenreIds: [18] },
    { moods: ["Miniserie"], genres: [], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(checkMiniReject.verified, false);
});

test("New categories and subcategories map to TMDB rules and include parent context in AI prompts", () => {
  // 1. Parent context formatting for AI prompts
  assert.deepEqual(
    formatSelectedChipsWithContext(["Natur", "Marvel"], GENRE_GROUPS),
    ["Natur (Dokumentär)", "Marvel (Superhjältar)"]
  );
  assert.deepEqual(
    formatSelectedChipsWithContext(["Sverige", "Sjukhus"], SETTING_GROUPS),
    ["Sverige (Sverige & Norden)", "Sjukhus (Skola & Jobb)"]
  );
  assert.deepEqual(
    formatSelectedChipsWithContext(["Slökolla"], MOOD_GROUPS),
    ["Slökolla (Feelgood & Mys)"]
  );

  // 2. Dokumentär & Natur verify TMDB genre 99
  const docPass = verifyMovieAgainstTmdbCategories(
    { year: "2020", tmdbGenreIds: [99] },
    { moods: [], genres: ["Natur"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(docPass.verified, true);
  const docFail = verifyMovieAgainstTmdbCategories(
    { year: "2020", tmdbGenreIds: [28, 53] },
    { moods: [], genres: ["Natur"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(docFail.verified, false);

  // 3. Familj & Julfilm verify TMDB Family (10751) and reject unrelated R-rated comedy
  const familyPass = verifyMovieAgainstTmdbCategories(
    { year: "2014", tmdbGenreIds: [35, 12, 10751] },
    { moods: [], genres: ["Familj"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(familyPass.verified, true);
  const familyReject = verifyMovieAgainstTmdbCategories(
    { year: "2009", tmdbGenreIds: [35] },
    { moods: [], genres: ["Familj"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(familyReject.verified, false);

  // 4. Musikal verifies Music (10402) on movies and allows Drama/Comedy on TV (where 10402 doesn't exist)
  const musicalMoviePass = verifyMovieAgainstTmdbCategories(
    { year: "2016", mediaType: "movie", tmdbGenreIds: [35, 18, 10749, 10402] },
    { moods: [], genres: ["Musikal"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(musicalMoviePass.verified, true);
  const musicalMovieReject = verifyMovieAgainstTmdbCategories(
    { year: "2016", mediaType: "movie", tmdbGenreIds: [28, 53] },
    { moods: [], genres: ["Musikal"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(musicalMovieReject.verified, false);
  const musicalTvPass = verifyMovieAgainstTmdbCategories(
    { year: "2015", mediaType: "tv", tmdbGenreIds: [35, 18] },
    { moods: [], genres: ["Musikal"], contents: [], frameworks: [], customText: "" }
  );
  assert.equal(musicalTvPass.verified, true);

  // 5. Every GENRE_GROUPS main label and subchip produces at least one TMDB rule
  for (const group of GENRE_GROUPS) {
    const mainRules = extractTmdbVerificationRules({
      moods: [],
      genres: [group.label],
      contents: [],
      frameworks: [],
      customText: "",
    });
    assert.ok(
      mainRules.genreRules.length > 0,
      `Main genre "${group.label}" must produce a TMDB verification rule`
    );
    for (const sub of group.subchips) {
      const subRules = extractTmdbVerificationRules({
        moods: [],
        genres: [sub],
        contents: [],
        frameworks: [],
        customText: "",
      });
      assert.ok(
        subRules.genreRules.length > 0,
        `Genre subcategory "${sub}" (under ${group.label}) must produce a TMDB verification rule`
      );
    }
  }

  // 6. Prompt includes parent context for selected subcategories
  const prompt = buildRecommendationSystemPrompt([], [], "", {
    moods: ["Slökolla"],
    genres: ["Natur"],
    contents: ["Maktspel"],
    frameworks: ["Sverige"],
    customText: "",
  });
  assert.ok(prompt.includes("Natur (Dokumentär)"));
  assert.ok(prompt.includes("Maktspel (Makt & Politik)"));
  assert.ok(prompt.includes("Sverige (Sverige & Norden)"));
  assert.ok(prompt.includes("Slökolla (Feelgood & Mys)"));
});

test("Age ratings: normalizes Swedish and international certifications and parses TMDB payloads", () => {
  assert.equal(normalizeSwedishAgeRating("Btl"), "Btl");
  assert.equal(normalizeSwedishAgeRating("Barntillåten"), "Btl");
  assert.equal(normalizeSwedishAgeRating("7"), "7+");
  assert.equal(normalizeSwedishAgeRating("11 år"), "11+");
  assert.equal(normalizeSwedishAgeRating("15"), "15+");
  assert.equal(normalizeSwedishAgeRating("PG-13"), "11+");
  assert.equal(normalizeSwedishAgeRating("R"), "15+");
  assert.equal(normalizeSwedishAgeRating("TV-MA"), "15+");
  assert.equal(normalizeSwedishAgeRating("G"), "Btl");
  assert.equal(normalizeSwedishAgeRating("NR"), undefined);

  // Movie release_dates prefers SE over US
  const moviePayload = {
    results: [
      { iso_3166_1: "US", release_dates: [{ certification: "R" }] },
      { iso_3166_1: "SE", release_dates: [{ certification: "11" }] },
    ],
  };
  assert.equal(parseTmdbMovieAgeRating(moviePayload), "11+");

  // Falls back to US if SE is empty
  const movieFallbackPayload = {
    results: [
      { iso_3166_1: "SE", release_dates: [{ certification: "" }] },
      { iso_3166_1: "US", release_dates: [{ certification: "PG-13" }] },
    ],
  };
  assert.equal(parseTmdbMovieAgeRating(movieFallbackPayload), "11+");

  // TV content_ratings prefers SE over US
  const tvPayload = {
    results: [
      { iso_3166_1: "US", rating: "TV-14" },
      { iso_3166_1: "SE", rating: "15" },
    ],
  };
  assert.equal(parseTmdbTvAgeRating(tvPayload), "15+");

  // Fallback inference & smart recommendations always include ageRating
  assert.equal(inferAgeRatingFromGenres([27]), "15+");
  assert.equal(inferAgeRatingFromGenres([10762]), "Btl");

  const fallbackRecs = generateSmartFallbackRecommendations(
    DEFAULT_WATCHED_MOVIES,
    [],
    { moods: [], genres: [], contents: [], frameworks: [], customText: "" }
  );
  assert.ok(fallbackRecs.length > 0);
  for (const rec of fallbackRecs) {
    assert.ok(rec.ageRating, `Recommendation "${rec.title}" should have an ageRating`);
  }
});

test("Strict genre rules: Familj rejects adult anime, Dokumentär subchips require 99, Musikal subchips require 10402", () => {
  // Adult anime (Animation 16 + Action 28, no Family 10751) MUST fail Familj
  const chainsawMan = { year: "2025", mediaType: "movie" as const, tmdbGenreIds: [16, 28, 14] };
  const paddington = { year: "2017", mediaType: "movie" as const, tmdbGenreIds: [12, 35, 10751] };
  for (const chip of ["Familj", "Barnfilm", "Djur", "Sagovärld", "Julfilm"]) {
    assert.equal(
      verifyMovieAgainstTmdbCategories(chainsawMan, { moods: [], genres: [chip], contents: [], frameworks: [], customText: "" }).verified,
      false,
      `Adult anime must be rejected for "${chip}"`
    );
    assert.equal(
      verifyMovieAgainstTmdbCategories(paddington, { moods: [], genres: [chip], contents: [], frameworks: [], customText: "" }).verified,
      true,
      `Family movie must pass "${chip}"`
    );
  }

  // Dokumentär subchips must require 99
  const featureDrama = { year: "2014", mediaType: "movie" as const, tmdbGenreIds: [18, 36] };
  const realDoc = { year: "2020", mediaType: "movie" as const, tmdbGenreIds: [99] };
  for (const chip of ["Dokumentär", "Natur", "Vetenskap", "Historia", "Sport", "Musik"]) {
    assert.equal(
      verifyMovieAgainstTmdbCategories(featureDrama, { moods: [], genres: [chip], contents: [], frameworks: [], customText: "" }).verified,
      false,
      `Feature drama without 99 must be rejected for Documentary subchip "${chip}"`
    );
    assert.equal(
      verifyMovieAgainstTmdbCategories(realDoc, { moods: [], genres: [chip], contents: [], frameworks: [], customText: "" }).verified,
      true,
      `Documentary (99) must pass "${chip}"`
    );
  }

  // Musikal subchips Dansfilm & Musikbiografi must require 10402 on movies
  const plainDrama = { year: "1994", mediaType: "movie" as const, tmdbGenreIds: [18, 80] };
  const musicBio = { year: "2018", mediaType: "movie" as const, tmdbGenreIds: [18, 10402] };
  for (const chip of ["Dansfilm", "Musikbiografi"]) {
    assert.equal(
      verifyMovieAgainstTmdbCategories(plainDrama, { moods: [], genres: [chip], contents: [], frameworks: [], customText: "" }).verified,
      false
    );
    assert.equal(
      verifyMovieAgainstTmdbCategories(musicBio, { moods: [], genres: [chip], contents: [], frameworks: [], customText: "" }).verified,
      true
    );
  }

  // Action > Kupp requires Action (28)
  assert.equal(
    verifyMovieAgainstTmdbCategories(plainDrama, { moods: [], genres: ["Kupp"], contents: [], frameworks: [], customText: "" }).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2010", mediaType: "movie", tmdbGenreIds: [28, 80, 53] }, { moods: [], genres: ["Kupp"], contents: [], frameworks: [], customText: "" }).verified,
    true
  );
});

test("Hybrid subcategories enforce AND-logic across both component genres", () => {
  // Romantisk komedi requires 35 AND 10749
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2019", tmdbGenreIds: [35, 53] }, { moods: [], genres: ["Romantisk komedi"], contents: [], frameworks: [], customText: "" }).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "1999", tmdbGenreIds: [35, 10749] }, { moods: [], genres: ["Romantisk komedi"], contents: [], frameworks: [], customText: "" }).verified,
    true
  );

  // Sci-Fi-skräck requires 878 AND 27
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2018", tmdbGenreIds: [27] }, { moods: [], genres: ["Sci-Fi-skräck"], contents: [], frameworks: [], customText: "" }).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "1979", tmdbGenreIds: [27, 878] }, { moods: [], genres: ["Sci-Fi-skräck"], contents: [], frameworks: [], customText: "" }).verified,
    true
  );

  // Skräckkomedi requires 27 AND 35
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2004", tmdbGenreIds: [27, 35] }, { moods: [], genres: ["Skräckkomedi"], contents: [], frameworks: [], customText: "" }).verified,
    true
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2018", tmdbGenreIds: [27, 9648] }, { moods: [], genres: ["Skräckkomedi"], contents: [], frameworks: [], customText: "" }).verified,
    false
  );

  // Familjekomedi requires 10751 AND 35
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2017", tmdbGenreIds: [10751, 35] }, { moods: [], genres: ["Familjekomedi"], contents: [], frameworks: [], customText: "" }).verified,
    true
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ year: "2001", tmdbGenreIds: [16, 14] }, { moods: [], genres: ["Familjekomedi"], contents: [], frameworks: [], customText: "" }).verified,
    false
  );
});

test("All CONTENT_GROUPS main labels & subchips produce TMDB rules and duplicate chip Verkliga brott preserves parent context", () => {
  for (const group of CONTENT_GROUPS) {
    const mainRules = extractTmdbVerificationRules({
      moods: [],
      genres: [],
      contents: [group.label],
      frameworks: [],
      customText: "",
    });
    assert.ok(
      mainRules.genreRules.length > 0,
      `CONTENT_GROUPS main label "${group.label}" must produce a TMDB rule`
    );
    for (const sub of group.subchips) {
      const subRules = extractTmdbVerificationRules({
        moods: [],
        genres: [],
        contents: [sub],
        frameworks: [],
        customText: "",
      });
      assert.ok(
        subRules.genreRules.length > 0,
        `CONTENT_GROUPS subchip "${sub}" (under ${group.label}) must produce a TMDB rule`
      );
    }
  }

  assert.deepEqual(
    formatSelectedChipsWithContext(["Verkliga brott"], GENRE_GROUPS),
    ["Verkliga brott (Krim & Mysterium / Dokumentär)"]
  );
});

test("Series length chips force mediaType='tv' and strictly verify seasonCount, episodeRuntimeMinutes, and tvStatus", () => {
  for (const chip of ["Miniserie", "1–2 säsonger", "3–5 säsonger", "6+ säsonger", "Korta avsnitt", "Avslutad serie", "Serielängd"]) {
    assert.equal(
      resolveEffectiveMediaType({ moods: [chip], genres: [], contents: [], frameworks: [], customText: "", mediaType: "any" }),
      "tv",
      `"${chip}" must force mediaType to 'tv' when mediaType is 'any'`
    );
  }

  // Reject movie when 3–5 säsonger is chosen
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2014", mediaType: "movie", tmdbGenreIds: [80, 18] },
      { moods: ["3–5 säsonger"], genres: [], contents: [], frameworks: [], customText: "" }
    ).verified,
    false
  );

  // Verify numeric seasonCount strictly for 3–5 säsonger
  const pref3to5 = { moods: ["3–5 säsonger"], genres: [], contents: [], frameworks: [], customText: "" };
  assert.equal(verifyMovieAgainstTmdbCategories({ mediaType: "tv", seasonCount: 1 }, pref3to5).verified, false);
  assert.equal(verifyMovieAgainstTmdbCategories({ mediaType: "tv", seasonCount: 4 }, pref3to5).verified, true);
  assert.equal(verifyMovieAgainstTmdbCategories({ mediaType: "tv", seasonCount: 7 }, pref3to5).verified, false);

  // Verify Korta avsnitt (<= 35 min) and Avslutad serie (Ended/Canceled)
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "tv", episodeRuntimeMinutes: 22 },
      { moods: ["Korta avsnitt"], genres: [], contents: [], frameworks: [], customText: "" }
    ).verified,
    true
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "tv", episodeRuntimeMinutes: 55 },
      { moods: ["Korta avsnitt"], genres: [], contents: [], frameworks: [], customText: "" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "tv", tvStatus: "Ended" },
      { moods: ["Avslutad serie"], genres: [], contents: [], frameworks: [], customText: "" }
    ).verified,
    true
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "tv", tvStatus: "Returning Series" },
      { moods: ["Avslutad serie"], genres: [], contents: [], frameworks: [], customText: "" }
    ).verified,
    false
  );
});

test("Movie runtime filters force mediaType='movie' and verify runtimeMinutes", () => {
  assert.equal(
    resolveEffectiveMediaType({ moods: ["Max 90 min"], genres: [], contents: [], frameworks: [], customText: "", mediaType: "any" }),
    "movie"
  );
  assert.equal(parseRuntimeMinutes("1 tim 28 min"), 88);
  assert.equal(parseRuntimeMinutes("2 tim 12 min"), 132);
  assert.equal(formatRuntimeMinutes(88), "1 tim 28 min");
  assert.equal(formatRuntimeMinutes(120), "2 tim");

  const max90Pref = { moods: ["Max 90 min"], genres: ["Komedi"], contents: [], frameworks: [], customText: "" };
  assert.equal(
    verifyMovieAgainstTmdbCategories({ mediaType: "movie", runtimeMinutes: 132, tmdbGenreIds: [35] }, max90Pref).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ mediaType: "movie", runtimeMinutes: 86, tmdbGenreIds: [35] }, max90Pref).verified,
    true
  );

  const over2hPref = { moods: ["Över 2 tim"], genres: [], contents: [], frameworks: [], customText: "" };
  assert.equal(
    verifyMovieAgainstTmdbCategories({ mediaType: "movie", runtimeMinutes: 95 }, over2hPref).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories({ mediaType: "movie", runtimeMinutes: 148 }, over2hPref).verified,
    true
  );
});

test("extractTmdbDiscoverFilters maps Anime, Natur, Kostymdrama, London, Tokyo, runtime & detects non-Latin titles", () => {
  const animeFilters = extractTmdbDiscoverFilters({ moods: [], genres: ["Anime", "Familj"], contents: [], frameworks: [], customText: "" });
  assert.deepEqual(animeFilters.originalLanguages, ["ja"]);
  assert.deepEqual(animeFilters.originCountries, ["JP"]);

  // Anime verification rejects non-Japanese originalLanguage
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "movie", tmdbGenreIds: [16, 10751], originalLanguage: "en" },
      { moods: [], genres: ["Anime", "Familj"], contents: [], frameworks: [], customText: "" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "movie", tmdbGenreIds: [16, 10751], originalLanguage: "ja" },
      { moods: [], genres: ["Anime", "Familj"], contents: [], frameworks: [], customText: "" }
    ).verified,
    true
  );

  const naturFilters = extractTmdbDiscoverFilters({ moods: [], genres: ["Dokumentär", "Natur"], contents: [], frameworks: [], customText: "" });
  assert.ok(naturFilters.keywordGroups.some((g) => g.includes(18330)));

  const londonFilters = extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["London"], customText: "" });
  assert.ok(londonFilters.keywordGroups.some((g) => g.includes(212)));

  const max90Filters = extractTmdbDiscoverFilters({ moods: ["Max 90 min"], genres: [], contents: [], frameworks: [], customText: "" });
  assert.equal(max90Filters.maxRuntime, 90);

  assert.equal(hasNonLatinScript("เลือดรักนักฆ่า"), true);
  assert.equal(hasNonLatinScript("Män som hatar kvinnor"), false);
});

test("Round 2: Mysterium requires 9648, Verkliga brott requires 99, Forntid requires 36, plus companies & verified keywords", () => {
  // Thriller > Mysterium requires 9648
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2020", tmdbGenreIds: [53, 28] },
      { moods: [], genres: ["Mysterium"], contents: [], frameworks: [], customText: "" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2020", tmdbGenreIds: [53, 9648] },
      { moods: [], genres: ["Mysterium"], contents: [], frameworks: [], customText: "" }
    ).verified,
    true
  );

  // Verkliga brott requires 99
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2008", tmdbGenreIds: [80, 18] },
      { moods: [], genres: ["Verkliga brott"], contents: [], frameworks: [], customText: "" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2020", tmdbGenreIds: [99, 80] },
      { moods: [], genres: ["Verkliga brott"], contents: [], frameworks: [], customText: "" }
    ).verified,
    true
  );

  // Forntid & Medeltid requires 36 (Historia) and rejects Spider-Man [28, 12, 878]
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2026", tmdbGenreIds: [28, 12, 878] },
      { moods: [], genres: [], contents: [], frameworks: ["Forntid & Medeltid"], customText: "" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2005", tmdbGenreIds: [18, 28, 36] },
      { moods: [], genres: [], contents: [], frameworks: ["Forntid & Medeltid"], customText: "" }
    ).verified,
    true
  );

  // Studio companies
  assert.deepEqual(extractTmdbDiscoverFilters({ moods: [], genres: ["Studio Ghibli"], contents: [], frameworks: [], customText: "" }).companyIds, [10342]);
  assert.deepEqual(extractTmdbDiscoverFilters({ moods: [], genres: ["Pixar"], contents: [], frameworks: [], customText: "" }).companyIds, [3]);
  assert.deepEqual(extractTmdbDiscoverFilters({ moods: [], genres: ["Disney"], contents: [], frameworks: [], customText: "" }).companyIds, [2, 6125]);
  assert.deepEqual(extractTmdbDiscoverFilters({ moods: [], genres: ["Marvel"], contents: [], frameworks: [], customText: "" }).companyIds, [420]);
  assert.deepEqual(extractTmdbDiscoverFilters({ moods: [], genres: ["DC"], contents: [], frameworks: [], customText: "" }).companyIds, [9993, 128064]);

  // Verified keywords & protective withoutGenreIds
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Stuga"], customText: "" }).keywordGroups.some((g) => g.includes(3623)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Hotell"], customText: "" }).keywordGroups.some((g) => g.includes(612)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Öken"], customText: "" }).keywordGroups.some((g) => g.includes(18034)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Tåg"], customText: "" }).keywordGroups.some((g) => g.includes(13008)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Bunker"], customText: "" }).keywordGroups.some((g) => g.includes(2321)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Herrgård"], customText: "" }).keywordGroups.some((g) => g.includes(12545)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Vikingatid"], customText: "" }).keywordGroups.some((g) => g.includes(384863)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: ["Kostymdrama"], contents: [], frameworks: [], customText: "" }).keywordGroups.some((g) => g.includes(195013)));

  const feelgoodFilters = extractTmdbDiscoverFilters({ moods: ["Feelgood & Mys"], genres: [], contents: [], frameworks: [], customText: "" });
  assert.ok(feelgoodFilters.withoutGenreIds.includes(27));
  assert.ok(feelgoodFilters.withoutGenreIds.includes(53));

  const gemFilters = extractTmdbDiscoverFilters({ moods: ["Dold pärla"], genres: [], contents: [], frameworks: [], customText: "" });
  assert.equal(gemFilters.minVoteCount, 250);
  assert.equal(gemFilters.maxVoteCount, 1200);
  assert.equal(gemFilters.minVoteAverage, 7.4);
  assert.equal(gemFilters.maxYearOverride, 2024);
  assert.ok(gemFilters.withoutGenreIds.includes(16));
  assert.ok(gemFilters.withoutGenreIds.includes(99));

  const shortTvFilters = extractTmdbDiscoverFilters({ moods: ["1–2 säsonger"], genres: [], contents: [], frameworks: [], customText: "" });
  assert.equal(shortTvFilters.tvShortSeries, true);
});

test("Round 3: Unicode non-Latin detection (Telugu/Thai), historical withoutKeywordIds, Retro-Sci-Fi, and live-verified keywords", () => {
  // Non-Latin detection catches Telugu, Thai, Japanese, Cyrillic while passing Swedish/Latin
  assert.equal(hasNonLatinScript("రౌద్రం రణం రుధిరం"), true);
  assert.equal(hasNonLatinScript("ఒక్కడు"), true);
  assert.equal(hasNonLatinScript("เลือดรักนักฆ่า"), true);
  assert.equal(hasNonLatinScript("Sagan om ringen: Härskarringen"), false);

  // Historical eras exclude WW1/WW2 keywords
  const ancientFilters = extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Forntid & Medeltid"], customText: "" });
  assert.ok(ancientFilters.withoutKeywordIds.includes(1956));
  assert.ok(ancientFilters.withoutKeywordIds.includes(2504));
  assert.ok(ancientFilters.keywordGroups.some((g) => g.includes(161257)));

  // Retro-Sci-Fi caps year at 1989
  const retroFilters = extractTmdbDiscoverFilters({ moods: [], genres: ["Retro-Sci-Fi"], contents: [], frameworks: [], customText: "" });
  assert.equal(retroFilters.maxYearOverride, 1989);

  // Postapokalyps uses 4458 (post-apocalyptic future)
  const postApoc = extractTmdbDiscoverFilters({ moods: [], genres: ["Postapokalyps"], contents: [], frameworks: [], customText: "" });
  assert.ok(postApoc.keywordGroups.some((g) => g.includes(4458)));

  // Stockholm, Landsbygd, Kungahus, Makt & Politik, Klurig, Romantisk
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Stockholm"], customText: "" }).keywordGroups.some((g) => g.includes(8085)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: [], frameworks: ["Landsbygd"], customText: "" }).keywordGroups.some((g) => g.includes(548)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: ["Kungahus"], frameworks: [], customText: "" }).keywordGroups.some((g) => g.includes(2471)));
  assert.ok(extractTmdbDiscoverFilters({ moods: [], genres: [], contents: ["Makt & Politik"], frameworks: [], customText: "" }).keywordGroups.some((g) => g.includes(209817)));
  assert.ok(extractTmdbDiscoverFilters({ moods: ["Klurig"], genres: [], contents: [], frameworks: [], customText: "" }).withoutGenreIds.includes(28));
  assert.ok(extractTmdbDiscoverFilters({ moods: ["Romantisk"], genres: [], contents: [], frameworks: [], customText: "" }).withoutGenreIds.includes(16));
});

test("Franchise deduplication (max 1 per series) and London location keyword without GB country lock", () => {
  // Harry Potter, Toy Story, Godfather, Frost, Vaiana, Dune all map to canonical franchise keys
  assert.equal(getMovieFranchiseKey("Harry Potter och de vises sten"), "harry potter");
  assert.equal(getMovieFranchiseKey("Harry Potter och dödsrelikerna, del 1"), "harry potter");
  assert.equal(getMovieFranchiseKey("Harry Potter och Halvblodsprinsen"), "harry potter");
  assert.equal(getMovieFranchiseKey("Toy Story"), "toy story");
  assert.equal(getMovieFranchiseKey("Toy Story 5"), "toy story");
  assert.equal(getMovieFranchiseKey("Gudfadern"), "the godfather");
  assert.equal(getMovieFranchiseKey("Gudfadern del II", "The Godfather Part II"), "the godfather");
  assert.equal(getMovieFranchiseKey("Frost"), "frozen");
  assert.equal(getMovieFranchiseKey("Frost 2", "Frozen II"), "frozen");
  assert.equal(getMovieFranchiseKey("Vaiana"), "moana");
  assert.equal(getMovieFranchiseKey("Vaiana 2"), "moana");
  assert.equal(getMovieFranchiseKey("Dune"), "dune");
  assert.equal(getMovieFranchiseKey("Dune: Part Two"), "dune");
  // Unrelated titles stay distinct
  assert.notEqual(getMovieFranchiseKey("1917"), getMovieFranchiseKey("1984"));
  assert.notEqual(getMovieFranchiseKey("Paddington"), getMovieFranchiseKey("Notting Hill"));

  // limitOnePerFranchise keeps max 1 per franchise in order
  const deduped = limitOnePerFranchise([
    { title: "Harry Potter och de vises sten" },
    { title: "Harry Potter och dödsrelikerna, del 1" },
    { title: "Paddington" },
    { title: "Harry Potter och Halvblodsprinsen" },
    { title: "Notting Hill" },
    { title: "Paddington 2" },
  ]);
  assert.deepEqual(
    deduped.map((m) => m.title),
    ["Harry Potter och de vises sten", "Paddington", "Notting Hill"]
  );

  // London uses location keyword 212 (london, england) WITHOUT locking originCountries to GB or excluding Fantasy
  const londonFilters = extractTmdbDiscoverFilters({
    moods: [],
    genres: [],
    contents: [],
    frameworks: ["London"],
    customText: "",
  });
  assert.ok(londonFilters.keywordGroups.some((g) => g.includes(212)));
  assert.equal(londonFilters.originCountries.length, 0);
  assert.equal(londonFilters.withoutGenreIds.includes(14), false);

  // Sverige / Stockholm strictly rejects Danish/English titles when originalLanguage is known
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2021", tmdbGenreIds: [80, 9648], originalLanguage: "da" },
      { moods: [], genres: ["Krim & Mysterium"], contents: [], frameworks: ["Sverige"], customText: "" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { year: "2021", tmdbGenreIds: [80, 18], originalLanguage: "sv" },
      { moods: [], genres: ["Krim & Mysterium"], contents: [], frameworks: ["Sverige"], customText: "" }
    ).verified,
    true
  );
});

test("Superhjältar + Serie enforces strict keywords, excludes Kids (10762), and caps animation to max 1 unless Animerat is selected", () => {
  const filters = extractTmdbDiscoverFilters({
    moods: [],
    genres: ["Superhjältar"],
    contents: [],
    frameworks: [],
    customText: "",
    mediaType: "tv",
  });
  assert.equal(filters.strictKeywords, true);
  assert.ok(filters.keywordGroups.some((g) => g.includes(9715)));
  assert.ok(filters.withoutGenreIds.includes(10762));
  assert.equal(filters.withoutGenreIds.includes(16), false);

  // Without Animerat selected: at most 1 animated title is kept alongside live-action titles
  const mixedList = [
    { title: "The Boys", tmdbGenreIds: [10759, 10765] },
    { title: "Invincible", tmdbGenreIds: [16, 10759, 10765] },
    { title: "One-Punch Man", tmdbGenreIds: [16, 35, 10759] },
    { title: "Daredevil", tmdbGenreIds: [10759, 80, 18] },
    { title: "My Hero Academia", tmdbGenreIds: [16, 10759] },
  ];
  const capped = limitAnimatedRecommendations(
    mixedList,
    { moods: [], genres: ["Superhjältar"], contents: [], frameworks: [], customText: "", mediaType: "tv" },
    1
  );
  assert.deepEqual(
    capped.map((m) => m.title),
    ["The Boys", "Invincible", "Daredevil"]
  );

  // With Animerat selected: no animation cap is applied
  const uncapped = limitAnimatedRecommendations(
    mixedList,
    { moods: [], genres: ["Superhjältar", "Animerat"], contents: [], frameworks: [], customText: "", mediaType: "tv" },
    1
  );
  assert.equal(uncapped.length, 5);

  const fallbacks = generateSmartFallbackRecommendations(
    [],
    [],
    {
      moods: [],
      genres: ["Superhjältar"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "tv",
    }
  );
  assert.equal(fallbacks.length, 5);
  const animatedCount = fallbacks.filter((r) => (r.tmdbGenreIds || []).includes(16)).length;
  assert.ok(animatedCount <= 1);
  assert.ok(!fallbacks.some((r) => r.title.toLowerCase().includes("witcher")));
});

test("selectFavoriteSeedsForTmdb prioritizes 5-star favorites, respects mediaType and franchise cap, and handles season ratings", () => {
  const watched: WatchedMovie[] = [
    {
      id: "w1",
      title: "Prisoners",
      rating: 5,
      liked: true,
      mediaType: "movie",
      tags: [],
      addedAt: "2026-10-10",
    },
    {
      id: "w2",
      title: "Dune",
      rating: 4,
      liked: true,
      mediaType: "movie",
      tags: [],
      addedAt: "2026-10-05",
    },
    {
      id: "w3",
      title: "Dune: Part Two",
      rating: 5,
      liked: true,
      mediaType: "movie",
      tags: [],
      addedAt: "2026-10-12",
    },
    {
      id: "w4",
      title: "Bad Movie",
      rating: 2,
      liked: false,
      mediaType: "movie",
      tags: [],
      addedAt: "2026-10-20",
    },
    {
      id: "w5",
      title: "True Detective",
      rating: 3,
      liked: true,
      mediaType: "tv",
      tags: [],
      addedAt: "2026-10-15",
      seasons: [
        { seasonNumber: 1, rating: 5, liked: true, tags: [] },
        { seasonNumber: 2, rating: 2, liked: false, tags: [] },
      ],
    },
  ];

  const movieSeeds = selectFavoriteSeedsForTmdb(watched, "movie", 5);
  assert.deepEqual(
    movieSeeds.map((m) => m.title),
    ["Dune: Part Two", "Prisoners"]
  );

  const tvSeeds = selectFavoriteSeedsForTmdb(watched, "tv", 5);
  assert.deepEqual(
    tvSeeds.map((m) => m.title),
    ["True Detective"]
  );
});

test("buildHybridCandidatePool merges collaborative and discover hits, boosts overlap, and enforces streaming & disliked filters", () => {
  const watched: WatchedMovie[] = [
    {
      id: "w1",
      title: "Prisoners",
      tmdbId: 146233,
      rating: 5,
      liked: true,
      tags: [],
      addedAt: "2026-10-10",
    },
  ];

  const collaborative: MovieRecommendation[] = [
    {
      id: "c1",
      title: "Sicario",
      year: "2015",
      runtime: "Film",
      mediaType: "movie",
      matchPercentage: 90,
      whyYouWillLikeIt: "Collab",
      vibeTags: ["Thriller"],
      tmdbId: 273481,
      tmdbRating: 7.4,
      tmdbGenreIds: [28, 80, 53],
      tmdbGenres: ["Action", "Kriminal", "Thriller"],
      recommendedFromSeeds: ["Prisoners", "Zodiac"],
    },
    {
      id: "c2",
      title: "The Conjuring",
      year: "2013",
      runtime: "Film",
      mediaType: "movie",
      matchPercentage: 88,
      whyYouWillLikeIt: "Horror collab",
      vibeTags: ["Skräck"],
      tmdbId: 138843,
      tmdbRating: 7.5,
      tmdbGenreIds: [27, 53],
      tmdbGenres: ["Skräck", "Thriller"],
      recommendedFromSeeds: ["Prisoners"],
      swedishProviders: {
        type: "flatrate",
        providers: [{ provider_id: 8, provider_name: "Netflix" }],
      },
    },
    {
      id: "c3",
      title: "Prisoners",
      year: "2013",
      runtime: "Film",
      mediaType: "movie",
      matchPercentage: 95,
      whyYouWillLikeIt: "Already watched",
      vibeTags: ["Thriller"],
      tmdbId: 146233,
      tmdbRating: 8.1,
      tmdbGenreIds: [18, 53],
      recommendedFromSeeds: ["Zodiac"],
    },
  ];

  const discovered: MovieRecommendation[] = [
    {
      id: "d1",
      title: "Sicario",
      year: "2015",
      runtime: "2 tim 1 min",
      mediaType: "movie",
      matchPercentage: 86,
      whyYouWillLikeIt: "Discover",
      vibeTags: ["Thriller"],
      tmdbId: 273481,
      tmdbRating: 7.4,
      tmdbGenreIds: [28, 80, 53],
      tmdbGenres: ["Action", "Kriminal", "Thriller"],
      swedishProviders: {
        type: "flatrate",
        providers: [{ provider_id: 8, provider_name: "Netflix" }],
      },
    },
    {
      id: "d2",
      title: "Nightcrawler",
      year: "2014",
      runtime: "1 tim 57 min",
      mediaType: "movie",
      matchPercentage: 87,
      whyYouWillLikeIt: "Discover only",
      vibeTags: ["Thriller"],
      tmdbId: 242582,
      tmdbRating: 7.7,
      tmdbGenreIds: [80, 18, 53],
      tmdbGenres: ["Kriminal", "Drama", "Thriller"],
      swedishProviders: {
        type: "flatrate",
        providers: [{ provider_id: 8, provider_name: "Netflix" }],
      },
    },
  ];

  const pool = buildHybridCandidatePool({
    collaborativeCandidates: collaborative,
    discoveredCandidates: discovered,
    watchedMovies: watched,
    watchlist: [],
    previousTitles: [],
    dislikedCategories: ["Skräck"],
    preferences: {
      moods: [],
      genres: ["Thriller"],
      contents: [],
      frameworks: [],
      customText: "",
      streamingProviders: ["Netflix"],
      mediaType: "movie",
    },
  });

  // Sicario should rank #1 because it matched BOTH collaborative seeds + Discover,
  // preserving Netflix providers from Discover and seed hints from collaborative
  assert.deepEqual(
    pool.map((p) => p.title),
    ["Sicario", "Nightcrawler"]
  );
  assert.deepEqual(pool[0].recommendedFromSeeds, ["Prisoners", "Zodiac"]);
  assert.equal(pool[0].swedishProviders?.providers[0]?.provider_name, "Netflix");

  const promptBlock = formatCandidatePoolForPrompt(pool, {
    selectedServices: ["Netflix"],
    hasSteering: false,
    hasCustomText: false,
  });
  assert.ok(promptBlock.includes("Sicario"));
  assert.ok(promptBlock.includes("Gillad av fans av Prisoners & Zodiac"));
  assert.ok(promptBlock.includes("Bekräftad på Netflix"));
});

test("resolveRecommendationTemperature lowers temperature for strict/steered queries and raises it for open exploration", () => {
  // Open taste-profile exploration ("För dig")
  assert.equal(
    resolveRecommendationTemperature({
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
    }),
    0.85
  );

  // Open exploration with streaming lock
  assert.equal(
    resolveRecommendationTemperature({
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
      streamingProviders: ["Netflix"],
    }),
    0.75
  );

  // 2–3 simultaneous filter chips -> precise
  assert.equal(
    resolveRecommendationTemperature({
      moods: ["Mörk & rå"],
      genres: ["Thriller"],
      contents: [],
      frameworks: [],
      customText: "",
    }),
    0.6
  );

  // Steering or custom free-text -> strictest precision
  assert.equal(
    resolveRecommendationTemperature({
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "En rymdfilm som Interstellar men kortare",
    }),
    0.5
  );
  assert.equal(
    resolveRecommendationTemperature({
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
      steering: {
        anchorMovie: { title: "Prisoners" },
        sliders: { mood: 0, pace: 1, depth: 0, tone: 0 },
        quickTweaks: ["Kortare"],
      },
    }),
    0.5
  );
});

test("buildRecommendationSystemPrompt includes watchlist as positive taste signal and dismissedMovies as negative signal", () => {
  const prompt = buildRecommendationSystemPrompt(
    [],
    [
      {
        id: "wl-1",
        title: "Arrival",
        year: "2016",
        runtime: "1 tim 56 min",
        matchPercentage: 95,
        whyYouWillLikeIt: "Smart sci-fi",
        vibeTags: ["Mind-bending", "Stämningsfull"],
        tmdbGenres: ["Sci-Fi", "Drama"],
      },
    ],
    "Gillar smart sci-fi.",
    {
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
    },
    [],
    [],
    5,
    [
      {
        title: "Older Dismissed",
        tmdbGenres: ["Komedi"],
        dismissedAt: "2026-10-01T10:00:00Z",
      },
      {
        title: "Bridgerton",
        tmdbGenres: ["Drama", "Romantik"],
        vibeTags: ["Kostymdrama"],
        dismissedAt: "2026-11-26T12:00:00Z",
      },
    ]
  );

  assert.ok(prompt.includes("ANVÄNDARENS WATCHLIST (POSITIV SMAKSIGNAL"));
  assert.ok(prompt.includes('"Arrival" (2016) [Sci-Fi, Drama, Mind-bending, Stämningsfull]'));
  assert.ok(prompt.includes("NYLIGEN BORTSWIPADE / RATADE FÖRSLAG (NEGATIV SMAKSIGNAL"));
  assert.ok(prompt.includes('"Bridgerton" [Drama, Romantik, Kostymdrama]'));
  assert.ok(prompt.indexOf("Bridgerton") < prompt.indexOf("Older Dismissed"));
});

test("buildRecommendationSystemPrompt separates movie and TV taste when both formats are logged", () => {
  const watched: WatchedMovie[] = [
    {
      id: "m1",
      title: "Prisoners",
      mediaType: "movie",
      rating: 5,
      liked: true,
      tags: ["Stämningen / Atmosfären"],
      addedAt: "2026-10-01",
    },
    {
      id: "m2",
      title: "Fast X",
      mediaType: "movie",
      rating: 2,
      liked: false,
      tags: ["Action- & Stridsscenerna"],
      addedAt: "2026-10-02",
    },
    {
      id: "t1",
      title: "Ted Lasso",
      mediaType: "tv",
      rating: 5,
      liked: true,
      tags: ["Karaktärerna & Skådespeleriet"],
      addedAt: "2026-10-03",
    },
    {
      id: "t2",
      title: "The Walking Dead",
      mediaType: "tv",
      rating: 2,
      liked: false,
      tags: ["Spänningen & Tempot"],
      addedAt: "2026-10-04",
    },
  ];

  const tvPrompt = buildRecommendationSystemPrompt(
    watched,
    [],
    "Mixad smak",
    {
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "tv",
    }
  );
  assert.ok(tvPrompt.includes("FAVORITFILMER (4–5 stjärnor"));
  assert.ok(tvPrompt.includes("FAVORITSERIER & SÄSONGER (4–5 stjärnor"));
  assert.ok(tvPrompt.includes("OGILLADE FILMER (1–2 stjärnor"));
  assert.ok(tvPrompt.includes("OGILLADE SERIER & SÄSONGER (1–2 stjärnor"));
  assert.ok(tvPrompt.includes("Användaren söker TV-SERIER nu."));

  const moviePrompt = buildRecommendationSystemPrompt(
    watched,
    [],
    "Mixad smak",
    {
      moods: [],
      genres: [],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie",
    }
  );
  assert.ok(moviePrompt.includes("Användaren söker LÅNGFILMER nu."));
});

test("Taste calibration deck excludes already watched titles and builds valid WatchedMovie verdicts", () => {
  const watched: WatchedMovie[] = [
    {
      id: "w1",
      title: "Inception",
      rating: 5,
      liked: true,
      tags: [],
      addedAt: "2026-10-01",
    },
    {
      id: "w2",
      title: "Chernobyl",
      mediaType: "tv",
      rating: 5,
      liked: true,
      tags: [],
      addedAt: "2026-10-02",
    },
  ];

  const deck = getTasteCalibrationDeck(watched, 10);
  assert.equal(deck.length, 10);
  assert.ok(!deck.some((c) => c.title === "Inception"));
  assert.ok(!deck.some((c) => c.title === "Chernobyl"));
  // Contains both movies and TV series with TMDB metadata
  assert.ok(deck.some((c) => c.mediaType === "movie"));
  assert.ok(deck.some((c) => c.mediaType === "tv"));
  assert.ok(deck.every((c) => typeof c.tmdbId === "number" && c.tmdbId > 0));

  const loved = buildWatchedMovieFromCalibration(deck[0], "love");
  assert.equal(loved.rating, 5);
  assert.equal(loved.liked, true);
  assert.ok(loved.tags.length > 0);

  const disliked = buildWatchedMovieFromCalibration(deck[1], "dislike");
  assert.equal(disliked.rating, 2);
  assert.equal(disliked.liked, false);
  assert.deepEqual(disliked.tags, []);

  // Dismissed calibration titles are excluded without polluting watchedMovies
  const dismissedEntry = buildDismissedMovieFromCalibration(deck[0]);
  assert.equal(dismissedEntry.title, deck[0].title);
  assert.ok(dismissedEntry.dismissedAt);
  const deckAfterDismiss = getTasteCalibrationDeck(watched, 10, [dismissedEntry]);
  assert.ok(!deckAfterDismiss.some((c) => c.title === deck[0].title));

  // Calibration deck includes diverse genres (feel-good, comedy, horror, family, romance)
  const fullFirstTen = getTasteCalibrationDeck([], 10).map((c) => c.title);
  assert.ok(fullFirstTen.includes("En oväntad vänskap"));
  assert.ok(fullFirstTen.includes("Ted Lasso"));
  assert.ok(fullFirstTen.includes("Get Out"));
  assert.ok(fullFirstTen.includes("Coco"));
  assert.ok(fullFirstTen.includes("La La Land"));
  assert.ok(fullFirstTen.includes("Superbad"));
});

test("limitAnimatedRecommendations respects animation-loving users in open taste mode", () => {
  const candidates = [
    { title: "Arcane", tmdbGenreIds: [16, 10765] },
    { title: "Spider-Verse", tmdbGenreIds: [16, 28] },
    { title: "Invincible", tmdbGenreIds: [16, 10759] },
    { title: "The Boys", tmdbGenreIds: [10765, 10759] },
  ];
  const openPrefs = {
    moods: [],
    genres: [],
    contents: [],
    frameworks: [],
    customText: "",
  };
  const animationFan: WatchedMovie[] = [
    {
      id: "anim1",
      title: "Spirited Away",
      rating: 5,
      liked: true,
      tags: [],
      addedAt: "2026-10-01",
      tmdbGenreIds: [16, 14],
    },
  ];
  const liveActionOnly: WatchedMovie[] = [
    {
      id: "la1",
      title: "Prisoners",
      rating: 5,
      liked: true,
      tags: [],
      addedAt: "2026-10-01",
      tmdbGenreIds: [18, 53],
    },
  ];

  // Animation fan in open "För dig" mode keeps all animated titles
  assert.equal(
    limitAnimatedRecommendations(candidates, openPrefs, 1, animationFan).length,
    4
  );
  // Non-animation user still gets capped to max 1 animated title
  assert.equal(
    limitAnimatedRecommendations(candidates, openPrefs, 1, liveActionOnly).length,
    2
  );
  // Even an animation fan gets capped when they explicitly pick a non-animation filter
  assert.equal(
    limitAnimatedRecommendations(
      candidates,
      { ...openPrefs, genres: ["Thriller"] },
      1,
      animationFan
    ).length,
    2
  );
});

test("generateSmartFallbackRecommendations excludes dismissedMovies", () => {
  const initial = generateSmartFallbackRecommendations(
    [],
    [],
    { moods: [], genres: [], contents: [], frameworks: [], customText: "" },
    []
  );
  assert.ok(initial.length > 0);
  const dismissedTitle = initial[0].title;
  const afterDismiss = generateSmartFallbackRecommendations(
    [],
    [],
    { moods: [], genres: [], contents: [], frameworks: [], customText: "" },
    [],
    [],
    [{ title: dismissedTitle, dismissedAt: "2026-11-26T00:00:00.000Z" }]
  );
  assert.ok(!afterDismiss.some((m) => m.title === dismissedTitle));
});

test("Thriller & Spänning rejects gentle Drama/Mystery movies while allowing TV mystery thrillers", () => {
  const thrillerPrefs = {
    moods: [],
    genres: ["Thriller & Spänning"],
    contents: [],
    frameworks: [],
    customText: "",
  };
  // Gentle Drama/Mystery movie (e.g. Remarkably Bright Creatures) should NOT match Thriller & Spänning
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "movie", tmdbGenreIds: [18, 9648] },
      thrillerPrefs
    ).verified,
    false
  );
  // Real thriller movie (Thriller 53) passes
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "movie", tmdbGenreIds: [18, 53, 9648] },
      thrillerPrefs
    ).verified,
    true
  );
  // TV thriller (TMDB TV has no 53 genre, uses 9648) still passes
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { mediaType: "tv", tmdbGenreIds: [18, 9648, 10765] },
      thrillerPrefs
    ).verified,
    true
  );
});

test("AC1: Strict multi-category AND verification for 2+ and 3+ rules rejects missing genres & empty uncurated genres", () => {
  const threeGenrePrefs = {
    moods: [],
    genres: ["Action", "Sci-Fi", "Komedi"],
    contents: [],
    frameworks: [],
    customText: "",
    mediaType: "movie" as const,
  };

  // Missing Komedi (2/3 match) MUST fail strict AND verification
  const partialTwoOfThree = verifyMovieAgainstTmdbCategories(
    { mediaType: "movie", tmdbGenreIds: [28, 878] },
    threeGenrePrefs
  );
  assert.equal(partialTwoOfThree.verified, false);
  assert.equal(partialTwoOfThree.matchedRuleCount, 2);
  assert.equal(partialTwoOfThree.totalRuleCount, 3);

  // All 3 genres present -> verified: true
  const exactThreeOfThree = verifyMovieAgainstTmdbCategories(
    { mediaType: "movie", tmdbGenreIds: [28, 878, 35] },
    threeGenrePrefs
  );
  assert.equal(exactThreeOfThree.verified, true);
  assert.equal(exactThreeOfThree.matchRatio, 1);

  // Empty tmdbGenreIds with active genre rules MUST NOT get neutral verified=true pass
  const emptyGenresCheck = verifyMovieAgainstTmdbCategories(
    { title: "Unknown Unenriched Film 2025", mediaType: "movie", tmdbGenreIds: [] },
    threeGenrePrefs
  );
  assert.equal(emptyGenresCheck.verified, false);
  assert.equal(emptyGenresCheck.matchRatio, 0);

  // TV Musikal must reject non-musical dramas/comedies when text metadata lacks musical cues
  const nonMusicalTv = verifyMovieAgainstTmdbCategories(
    {
      title: "Breaking Bad",
      mediaType: "tv",
      tmdbGenreIds: [18, 80],
      vibeTags: ["Kriminalmästerverk", "Spänning"],
    },
    { moods: [], genres: ["Musikal"], contents: [], frameworks: [], customText: "", mediaType: "tv" }
  );
  assert.equal(nonMusicalTv.verified, false);
});

test("AC1 & AC5: 5-suggestion flow returns 5 exact multi-category matches separately for movies and TV series", () => {
  // Movies: Skräck + Komedi (5 exact movie matches exist)
  const movieRes = generateSmartRecommendationsWithStatus(
    [],
    [],
    {
      moods: [],
      genres: ["Skräck", "Komedi"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie",
    }
  );
  assert.equal(movieRes.exactMatchesFound, true);
  assert.equal(movieRes.fallbackMessage, undefined);
  assert.equal(movieRes.recommendations.length, 5);
  for (const rec of movieRes.recommendations) {
    assert.equal(rec.mediaType, "movie");
    const ids = new Set(rec.tmdbGenreIds || []);
    assert.ok(ids.has(27), `${rec.title} must have Horror (27)`);
    assert.ok(ids.has(35), `${rec.title} must have Comedy (35)`);
  }

  // Movies: 3 categories (Action + Sci-Fi + Komedi) -> still 5 exact matches
  const movie3Res = generateSmartRecommendationsWithStatus(
    [],
    [],
    {
      moods: [],
      genres: ["Action", "Sci-Fi", "Komedi"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie",
    }
  );
  assert.equal(movie3Res.exactMatchesFound, true);
  assert.equal(movie3Res.recommendations.length, 5);
  for (const rec of movie3Res.recommendations) {
    assert.equal(rec.mediaType, "movie");
    const ids = new Set(rec.tmdbGenreIds || []);
    assert.ok(ids.has(28) && ids.has(878) && ids.has(35), `${rec.title} must match Action, Sci-Fi & Comedy`);
  }

  // TV series: Animerat + Action (5 exact TV matches exist: Arcane, Invincible, Cyberpunk: Edgerunners, Castlevania, Blue Eye Samurai, Demon Slayer)
  const tvRes = generateSmartRecommendationsWithStatus(
    [],
    [],
    {
      moods: [],
      genres: ["Animerat", "Action"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "tv",
    }
  );
  assert.equal(tvRes.exactMatchesFound, true);
  assert.equal(tvRes.fallbackMessage, undefined);
  assert.equal(tvRes.recommendations.length, 5);
  for (const rec of tvRes.recommendations) {
    assert.equal(rec.mediaType, "tv");
    const ids = new Set(rec.tmdbGenreIds || []);
    assert.ok(ids.has(16), `${rec.title} must have Animation (16)`);
    assert.ok(ids.has(10759) || ids.has(28), `${rec.title} must have Action (10759/28)`);
  }
});

test("AC2: Partial-match candidates are strictly excluded whenever exact matches exist (movies and TV)", () => {
  const movieCandidates: MovieRecommendation[] = [
    // High-rated partial matches (missing Komedi)
    { id: "p1", title: "Partial Hit 1", year: "2022", runtime: "2 tim", mediaType: "movie", matchPercentage: 99, tmdbRating: 9.6, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 878] },
    { id: "p2", title: "Partial Hit 2", year: "2023", runtime: "2 tim", mediaType: "movie", matchPercentage: 98, tmdbRating: 9.4, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 35] },
    // 5 exact matches with lower ratings
    { id: "e1", title: "Exact 1", year: "2021", runtime: "1 tim 55 min", mediaType: "movie", matchPercentage: 86, tmdbRating: 7.2, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 878, 35] },
    { id: "e2", title: "Exact 2", year: "2020", runtime: "1 tim 50 min", mediaType: "movie", matchPercentage: 85, tmdbRating: 7.1, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 878, 35] },
    { id: "e3", title: "Exact 3", year: "2019", runtime: "1 tim 45 min", mediaType: "movie", matchPercentage: 84, tmdbRating: 7.0, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 878, 35] },
    { id: "e4", title: "Exact 4", year: "2018", runtime: "1 tim 40 min", mediaType: "movie", matchPercentage: 83, tmdbRating: 6.9, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 878, 35] },
    { id: "e5", title: "Exact 5", year: "2017", runtime: "1 tim 38 min", mediaType: "movie", matchPercentage: 82, tmdbRating: 6.8, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [28, 878, 35] },
  ];

  const moviePrefs = {
    moods: [],
    genres: ["Action", "Sci-Fi", "Komedi"],
    contents: [],
    frameworks: [],
    customText: "",
    mediaType: "movie" as const,
  };
  const verifiedMovies = filterAndVerifyMoviesWithFallback(movieCandidates, moviePrefs);
  assert.equal(verifiedMovies.exactMatchesFound, true);
  assert.equal(verifiedMovies.items.length, 5);
  assert.ok(verifiedMovies.items.every((m) => m.title.startsWith("Exact")));

  const tvCandidates: MovieRecommendation[] = [
    { id: "tp1", title: "Partial TV 1", year: "2022", runtime: "2 säsonger", mediaType: "tv", matchPercentage: 99, tmdbRating: 9.5, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [16, 18] },
    { id: "te1", title: "Exact TV 1", year: "2021", runtime: "2 säsonger", mediaType: "tv", matchPercentage: 85, tmdbRating: 7.5, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [16, 10759, 10765] },
    { id: "te2", title: "Exact TV 2", year: "2022", runtime: "1 säsong", mediaType: "tv", matchPercentage: 84, tmdbRating: 7.4, whyYouWillLikeIt: "", vibeTags: [], tmdbGenreIds: [16, 10759, 10765] },
  ];
  const tvPrefs = {
    moods: [],
    genres: ["Animerat", "Action", "Sci-Fi"],
    contents: [],
    frameworks: [],
    customText: "",
    mediaType: "tv" as const,
  };
  const verifiedTv = filterAndVerifyMoviesWithFallback(tvCandidates, tvPrefs);
  assert.equal(verifiedTv.exactMatchesFound, true);
  assert.deepEqual(
    verifiedTv.items.map((t) => t.title),
    ["Exact TV 1", "Exact TV 2"]
  );
});

test("AC3: 0 exact matches triggers closest-match fallback with Swedish notice and 5 closest items (movies & TV)", () => {
  const impossibleMovie = generateSmartRecommendationsWithStatus(
    [],
    [],
    {
      moods: [],
      genres: ["Dokumentär", "Skräck", "Musikal"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie",
    }
  );
  assert.equal(impossibleMovie.exactMatchesFound, false);
  assert.equal(impossibleMovie.fallbackMessage, NO_EXACT_MATCH_FALLBACK_MESSAGE);
  assert.equal(impossibleMovie.recommendations.length, 5);
  assert.ok(impossibleMovie.recommendations.every((r) => r.mediaType === "movie"));

  const impossibleTv = generateSmartRecommendationsWithStatus(
    [],
    [],
    {
      moods: [],
      genres: ["Dokumentär", "Skräck", "Musikal"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "tv",
    }
  );
  assert.equal(impossibleTv.exactMatchesFound, false);
  assert.equal(impossibleTv.fallbackMessage, NO_EXACT_MATCH_FALLBACK_MESSAGE);
  assert.equal(impossibleTv.recommendations.length, 5);
  assert.ok(impossibleTv.recommendations.every((r) => r.mediaType === "tv"));
});

test("AC4: Taste profile and active watchlist weightings rank aligned candidates higher AND allow watchlist titles in 5 results", () => {
  const darkProfileWatched: WatchedMovie[] = [
    {
      id: "w1",
      title: "Prisoners",
      mediaType: "movie",
      rating: 5,
      liked: true,
      tags: ["Stämningen / Atmosfären", "Twisten / Slutet"],
      addedAt: "2026-10-01",
      tmdbGenreIds: [18, 53, 80],
    },
    {
      id: "w2",
      title: "Superbad",
      mediaType: "movie",
      rating: 1,
      liked: false,
      tags: ["Humorn & Lättheten"],
      addedAt: "2026-10-02",
      tmdbGenreIds: [35],
    },
  ];
  const darkWatchlist: MovieRecommendation[] = [
    {
      id: "wl-dark",
      title: "Blade Runner 2049",
      year: "2017",
      runtime: "2 tim 44 min",
      mediaType: "movie",
      matchPercentage: 90,
      whyYouWillLikeIt: "Mörk neo-noir sci-fi",
      vibeTags: ["Mörk", "Atmosfär", "Psykologisk"],
      tmdbGenreIds: [878, 18],
      tmdbGenres: ["Sci-Fi", "Drama"],
    },
  ];
  const darkSummary =
    "Du dras till mörk, psykologisk atmosfär och nervkittlande mysterier, men bör undvika lättsamma komedier och slapstick.";

  const lightProfileWatched: WatchedMovie[] = [
    {
      id: "w3",
      title: "Knives Out",
      mediaType: "movie",
      rating: 5,
      liked: true,
      tags: ["Humorn & Lättheten", "Manuset & Dialogen"],
      addedAt: "2026-10-01",
      tmdbGenreIds: [35, 80, 9648],
    },
    {
      id: "w4",
      title: "Se7en",
      mediaType: "movie",
      rating: 1,
      liked: false,
      tags: ["Stämningen / Atmosfären"],
      addedAt: "2026-10-02",
      tmdbGenreIds: [80, 53],
    },
  ];
  const lightWatchlist: MovieRecommendation[] = [
    {
      id: "wl-light",
      title: "Palm Springs",
      year: "2020",
      runtime: "1 tim 30 min",
      mediaType: "movie",
      matchPercentage: 90,
      whyYouWillLikeIt: "Lättsam och rolig sci-fi-komedi",
      vibeTags: ["Skrattfest", "Charmig", "Feelgood"],
      tmdbGenreIds: [35, 878, 10749],
      tmdbGenres: ["Komedi", "Sci-Fi", "Romantik"],
    },
  ];
  const lightSummary =
    "Du älskar varm humor, lekfull komedi och charmig dialog, men bör undvika becksvarta och råa filmer.";

  // Two candidates both matching Action + Sci-Fi
  const darkSciFiCandidate: MovieRecommendation = {
    id: "cand-dark",
    title: "Dark Cyber Runner",
    year: "2020",
    runtime: "2 tim 5 min",
    mediaType: "movie",
    matchPercentage: 88,
    whyYouWillLikeIt: "Mörk, psykologisk sci-fi-action med tät atmosfär.",
    vibeTags: ["Mörk", "Psykologisk", "Atmosfär"],
    tmdbRating: 7.4,
    tmdbGenreIds: [28, 878, 53],
    tmdbGenres: ["Action", "Sci-Fi", "Thriller"],
  };
  const comedySciFiCandidate: MovieRecommendation = {
    id: "cand-light",
    title: "Cosmic Buddy Laughs",
    year: "2021",
    runtime: "1 tim 45 min",
    mediaType: "movie",
    matchPercentage: 88,
    whyYouWillLikeIt: "Lättsam och rolig feelgood sci-fi-action med charm.",
    vibeTags: ["Skrattfest", "Feelgood", "Charmig"],
    tmdbRating: 7.8,
    tmdbGenreIds: [28, 878, 35],
    tmdbGenres: ["Action", "Sci-Fi", "Komedi"],
  };

  const actionSciFiPrefs = {
    moods: [],
    genres: ["Action", "Sci-Fi"],
    contents: [],
    frameworks: [],
    customText: "",
    mediaType: "movie" as const,
  };

  // Under dark profile + dark watchlist: darkSciFiCandidate MUST rank above comedySciFiCandidate
  const darkScoreForDark = scoreCandidateForUserProfile(darkSciFiCandidate, {
    watchedMovies: darkProfileWatched,
    watchlist: darkWatchlist,
    tasteProfileSummary: darkSummary,
    preferences: actionSciFiPrefs,
  });
  const darkScoreForComedy = scoreCandidateForUserProfile(comedySciFiCandidate, {
    watchedMovies: darkProfileWatched,
    watchlist: darkWatchlist,
    tasteProfileSummary: darkSummary,
    preferences: actionSciFiPrefs,
  });
  assert.ok(
    darkScoreForDark > darkScoreForComedy,
    `Expected dark candidate (${darkScoreForDark}) > comedy candidate (${darkScoreForComedy}) for dark profile+watchlist`
  );

  // Under light profile + light watchlist: comedySciFiCandidate MUST rank above darkSciFiCandidate
  const lightScoreForComedy = scoreCandidateForUserProfile(comedySciFiCandidate, {
    watchedMovies: lightProfileWatched,
    watchlist: lightWatchlist,
    tasteProfileSummary: lightSummary,
    preferences: actionSciFiPrefs,
  });
  const lightScoreForDark = scoreCandidateForUserProfile(darkSciFiCandidate, {
    watchedMovies: lightProfileWatched,
    watchlist: lightWatchlist,
    tasteProfileSummary: lightSummary,
    preferences: actionSciFiPrefs,
  });
  assert.ok(
    lightScoreForComedy > lightScoreForDark,
    `Expected comedy candidate (${lightScoreForComedy}) > dark candidate (${lightScoreForDark}) for light profile+watchlist`
  );

  // Verify buildHybridCandidatePool uses taste+watchlist ranking and allows watchlist items when excludeWatchlist=false
  const watchlistHero: MovieRecommendation = {
    id: "wl-hero",
    title: "Edge of Tomorrow",
    year: "2014",
    runtime: "1 tim 53 min",
    mediaType: "movie",
    matchPercentage: 90,
    whyYouWillLikeIt: "Action sci-fi tidsloop",
    vibeTags: ["Tidsloop", "Mörk"],
    tmdbId: 137113,
    tmdbRating: 7.6,
    tmdbGenreIds: [28, 878],
    tmdbGenres: ["Action", "Sci-Fi"],
  };
  const hybridPool = buildHybridCandidatePool({
    collaborativeCandidates: [],
    discoveredCandidates: [comedySciFiCandidate, darkSciFiCandidate, watchlistHero],
    watchedMovies: darkProfileWatched,
    watchlist: [watchlistHero],
    preferences: actionSciFiPrefs,
    tasteProfileSummary: darkSummary,
    excludeWatchlist: false,
  });
  assert.ok(
    hybridPool.some((m) => m.title === "Edge of Tomorrow"),
    "Watchlist title should be allowed in 5-suggestion pool when excludeWatchlist=false"
  );
  const darkIdx = hybridPool.findIndex((m) => m.title === "Dark Cyber Runner");
  const lightIdx = hybridPool.findIndex((m) => m.title === "Cosmic Buddy Laughs");
  assert.ok(darkIdx !== -1 && lightIdx !== -1 && darkIdx < lightIdx);

  // Watchlist title IS allowed in generateSmartRecommendationsWithStatus for TV too
  const tvWatchlistItem: MovieRecommendation = {
    id: "wl-tv-1",
    title: "Cyberpunk: Edgerunners",
    year: "2022",
    runtime: "1 säsong · 10 avsnitt",
    mediaType: "tv",
    matchPercentage: 95,
    whyYouWillLikeIt: "Sparad animerad sci-fi-action",
    vibeTags: ["Vuxenanimation", "Cyberpunk"],
    tmdbId: 105248,
    tmdbGenreIds: [16, 10765, 10759],
    tmdbGenres: ["Animerat", "Sci-Fi & Fantasy", "Action & Äventyr"],
  };
  const tvWithWatchlist = generateSmartRecommendationsWithStatus(
    [],
    [tvWatchlistItem],
    {
      moods: [],
      genres: ["Animerat", "Action"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "tv",
    },
    [],
    [],
    [],
    "Jag älskar cyberpunk, mörk sci-fi och vuxenanimation."
  );
  assert.equal(tvWithWatchlist.recommendations.length, 5);
  assert.ok(
    tvWithWatchlist.recommendations.some(
      (r) => r.title === "Cyberpunk: Edgerunners"
    ),
    "Matching watchlist series must be allowed among the 5 TV recommendations"
  );

  // RecommendedTab swipe-deck behavior preserved when excludeWatchlist is true (default)
  const excludedForDeck = filterDuplicateRecommendations(
    [tvWatchlistItem],
    [],
    [tvWatchlistItem]
  );
  assert.equal(excludedForDeck.length, 0);
  const allowedForTonight = filterDuplicateRecommendations(
    [tvWatchlistItem],
    [],
    [tvWatchlistItem],
    [],
    { excludeWatchlist: false }
  );
  assert.equal(allowedForTonight.length, 1);
});

test("Regression (M1-i2 Bug 1 & Minor 3): Sverige/Stockholm and Anime strictly reject missing originalLanguage and never leak non-Swedish titles", () => {
  // Missing originalLanguage must fail Sverige, Stockholm, and Anime
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { title: "Unknown Drama Film", mediaType: "movie", tmdbGenreIds: [18] },
      { moods: [], genres: ["Drama"], contents: [], frameworks: ["Sverige"], customText: "", mediaType: "movie" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { title: "Unknown Crime Series", mediaType: "tv", tmdbGenreIds: [80, 18] },
      { moods: [], genres: ["Krim & Mysterium"], contents: [], frameworks: ["Stockholm"], customText: "", mediaType: "tv" }
    ).verified,
    false
  );
  assert.equal(
    verifyMovieAgainstTmdbCategories(
      { title: "Unknown Animated Film", mediaType: "movie", tmdbGenreIds: [16, 28] },
      { moods: [], genres: ["Anime", "Action"], contents: [], frameworks: [], customText: "", mediaType: "movie" }
    ).verified,
    false
  );

  // Older CURATED_TMDB_MOVIES entries carry explicit mediaType: "movie" and originalLanguage
  const darkKnight = lookupCuratedTmdbMovie("The Dark Knight");
  assert.equal(darkKnight.mediaType, "movie");
  assert.equal(darkKnight.originalLanguage, "en");

  // Sverige + Drama (movie) returns only genuine Swedish films
  const swedishMovies = generateSmartRecommendationsWithStatus(
    [],
    [],
    { moods: [], genres: ["Drama"], contents: [], frameworks: ["Sverige"], customText: "", mediaType: "movie" }
  );
  assert.equal(swedishMovies.exactMatchesFound, true);
  assert.equal(swedishMovies.recommendations.length, 5);
  assert.ok(
    swedishMovies.recommendations.every((r) => r.originalLanguage === "sv"),
    `Expected all Sverige Drama results to have originalLanguage='sv', got: ${swedishMovies.recommendations.map((r) => `${r.title}(${r.originalLanguage})`).join(", ")}`
  );

  // Stockholm + Krim & Mysterium (tv) returns only genuine Swedish TV series (never Breaking Bad / The Sopranos)
  const stockholmTv = generateSmartRecommendationsWithStatus(
    [],
    [],
    { moods: [], genres: ["Krim & Mysterium"], contents: [], frameworks: ["Stockholm"], customText: "", mediaType: "tv" }
  );
  assert.equal(stockholmTv.exactMatchesFound, true);
  assert.ok(stockholmTv.recommendations.length >= 2);
  assert.ok(
    stockholmTv.recommendations.every((r) => r.originalLanguage === "sv"),
    `Expected only Swedish TV series for Stockholm, got: ${stockholmTv.recommendations.map((r) => r.title).join(", ")}`
  );

  // Sverige + Sci-Fi (movie) has 0 Swedish Sci-Fi movies -> closest-match fallback notice
  const swedishSciFi = generateSmartRecommendationsWithStatus(
    [],
    [],
    { moods: [], genres: ["Sci-Fi"], contents: [], frameworks: ["Sverige"], customText: "", mediaType: "movie" }
  );
  assert.equal(swedishSciFi.exactMatchesFound, false);
  assert.equal(swedishSciFi.fallbackMessage, NO_EXACT_MATCH_FALLBACK_MESSAGE);
  assert.equal(swedishSciFi.recommendations.length, 5);
});

test("Regression (M1-i2 Bug 2 & Minor 4): Custom enriched watchlist item ranks in top 5 and multi-sentence avoidance summary preserves subsequent positive cues", () => {
  const customWatchlistItem: MovieRecommendation = {
    id: "wl-custom-enriched",
    title: "Custom Enriched Watchlist Thriller",
    year: "2022",
    runtime: "2 tim 4 min",
    mediaType: "movie",
    matchPercentage: 92,
    whyYouWillLikeIt: "Mörk psykologisk kriminalgåta.",
    vibeTags: ["Mörk", "Psykologisk", "Gåtfull"],
    tmdbId: 888888,
    tmdbRating: 8.6,
    tmdbGenreIds: [18, 53, 80, 9648],
    tmdbGenres: ["Drama", "Thriller", "Krim", "Mysterium"],
  };

  const res = generateSmartRecommendationsWithStatus(
    [],
    [customWatchlistItem],
    {
      moods: [],
      genres: ["Drama", "Thriller & Spänning"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie",
    },
    [],
    [],
    [],
    "Du bör undvika lättsamma komedier och slapstick. Du älskar däremot mörka, psykologiska kriminalmysterier."
  );

  assert.equal(res.exactMatchesFound, true);
  assert.equal(res.recommendations.length, 5);
  assert.ok(
    res.recommendations.some((r) => r.title === "Custom Enriched Watchlist Thriller"),
    `Expected custom enriched watchlist item in top 5, got: ${res.recommendations.map((r) => r.title).join(", ")}`
  );

  // Verify multi-sentence avoidance summary (avoidance first, positive second) scores dark sci-fi thriller > slapstick comedy
  const darkSciFiCandidate: MovieRecommendation = {
    id: "c-dark",
    title: "Dark Sci-Fi Mystery",
    year: "2021",
    runtime: "2 tim",
    mediaType: "movie",
    matchPercentage: 88,
    whyYouWillLikeIt: "Mörk, psykologisk sci-fi-thriller med gåtfull nerv.",
    vibeTags: ["Mörk", "Psykologisk", "Gåta"],
    tmdbRating: 7.6,
    tmdbGenreIds: [878, 53, 9648],
  };
  const lightComedyCandidate: MovieRecommendation = {
    id: "c-light",
    title: "Light Slapstick Comedy",
    year: "2021",
    runtime: "1 tim 35 min",
    mediaType: "movie",
    matchPercentage: 88,
    whyYouWillLikeIt: "Lättsam och rolig komedi med slapstick.",
    vibeTags: ["Lättsam", "Slapstick", "Komedi"],
    tmdbRating: 7.6,
    tmdbGenreIds: [35],
  };
  const avoidanceFirstSummary =
    "Du bör undvika lättsamma komedier och slapstick. Du älskar däremot mörk sci-fi och nervkittlande thrillers.";
  const darkScore = scoreCandidateForUserProfile(darkSciFiCandidate, {
    tasteProfileSummary: avoidanceFirstSummary,
  });
  const lightScore = scoreCandidateForUserProfile(lightComedyCandidate, {
    tasteProfileSummary: avoidanceFirstSummary,
  });
  assert.ok(
    darkScore > lightScore,
    `Expected darkScore (${darkScore}) > lightScore (${lightScore}) when avoidance appears in sentence 1 and positive cues in sentence 2`
  );
});

test("Regression (M1-i2 Bug 3): limitOnePerFranchise and generateSmartRecommendationsWithStatus preserve 5 exact matches across a franchise pair", () => {
  const spiderVersePairPool = [
    { title: "Spider-Man: Into the Spider-Verse" },
    { title: "Spider-Man: Across the Spider-Verse" },
    { title: "Inception" },
    { title: "Mad Max: Fury Road" },
    { title: "Edge of Tomorrow" },
  ];
  assert.equal(limitOnePerFranchise(spiderVersePairPool, 5).length, 5);
  // Default preserveMinCount=0 still caps to 1 per franchise
  assert.equal(limitOnePerFranchise(spiderVersePairPool).length, 4);

  const excludeOtherActionSciFi = [
    "Dune: Part Two",
    "Everything Everywhere All at Once",
    "Free Guy",
    "Men in Black",
    "Deadpool & Wolverine",
    "The Adam Project",
    "Akira",
  ];
  const res = generateSmartRecommendationsWithStatus(
    [],
    [],
    {
      moods: [],
      genres: ["Action", "Sci-Fi"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie",
    },
    [],
    excludeOtherActionSciFi
  );
  assert.equal(res.exactMatchesFound, true);
  assert.equal(res.recommendations.length, 5);
  assert.ok(
    res.recommendations.some((r) => r.title === "Spider-Man: Into the Spider-Verse") &&
      res.recommendations.some((r) => r.title === "Spider-Man: Across the Spider-Verse"),
    `Expected both Spider-Verse exact matches preserved when only 5 exact matches remain, got: ${res.recommendations.map((r) => r.title).join(", ")}`
  );
});

test("Strict Sci-Fi + Thriller movie verification requires BOTH Sci-Fi (878) and Thriller (53) and rejects Sci-Fi + Crime (80)", () => {
  const sciFiThrillerPrefs = {
    moods: [],
    genres: ["Sci-Fi", "Thriller & Spänning"],
    contents: [],
    frameworks: [],
    customText: "",
    mediaType: "movie" as const,
  };

  const sciFiAndThriller = verifyMovieAgainstTmdbCategories(
    { title: "Ex Machina", mediaType: "movie", tmdbGenreIds: [18, 878, 53] },
    sciFiThrillerPrefs
  );
  const sciFiOnly = verifyMovieAgainstTmdbCategories(
    { title: "Interstellar", mediaType: "movie", tmdbGenreIds: [12, 18, 878] },
    sciFiThrillerPrefs
  );
  const thrillerOnly = verifyMovieAgainstTmdbCategories(
    { title: "Prisoners", mediaType: "movie", tmdbGenreIds: [18, 53, 80] },
    sciFiThrillerPrefs
  );
  const sciFiAndCrimeNoThriller = verifyMovieAgainstTmdbCategories(
    { title: "Sci-Fi Crime Only", mediaType: "movie", tmdbGenreIds: [878, 80] },
    sciFiThrillerPrefs
  );

  assert.equal(sciFiAndThriller.verified, true);
  assert.equal(sciFiOnly.verified, false);
  assert.equal(thrillerOnly.verified, false);
  assert.equal(
    sciFiAndCrimeNoThriller.verified,
    false,
    "A movie with Sci-Fi + Crime (80) but WITHOUT Thriller (53) must NOT pass Sci-Fi + Thriller"
  );
});

test("limitEastAsianRecommendations prevents Korean/Japanese flood unless explicitly requested", () => {
  const mixedPool = [
    { title: "K-Drama 1", originalLanguage: "ko" },
    { title: "J-Thriller 1", originalLanguage: "ja" },
    { title: "Ex Machina", originalLanguage: "en" },
    { title: "Arrival", originalLanguage: "en" },
    { title: "Dark", originalLanguage: "de" },
    { title: "Bron", originalLanguage: "sv" },
    { title: "Severance", originalLanguage: "en" },
  ];
  const neutralPrefs = {
    moods: [],
    genres: ["Sci-Fi", "Thriller & Spänning"],
    contents: [],
    frameworks: [],
    customText: "",
  };
  const balanced = limitEastAsianRecommendations(mixedPool, neutralPrefs, 0, 5);
  assert.equal(balanced.length, 5);
  assert.ok(
    balanced.every((m) => m.originalLanguage !== "ko" && m.originalLanguage !== "ja"),
    "Should exclude ko/ja titles when 5 non-ko/ja matches exist and user did not ask for Korean/Japanese"
  );

  const koreanPrefs = { ...neutralPrefs, customText: "koreansk thriller" };
  const keptKorean = limitEastAsianRecommendations(mixedPool, koreanPrefs, 0, 5);
  assert.equal(keptKorean.length, mixedPool.length);
  assert.equal(keptKorean[0].originalLanguage, "ko");
});
