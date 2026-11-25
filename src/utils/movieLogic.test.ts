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
  verifyMovieAgainstTmdbCategories,
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

test("Superhjältar + Serie enforces strict keywords, excludes Kids (10762), and fallback returns superhero series", () => {
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
  const titles = fallbacks.map((r) => r.title);
  assert.ok(titles.includes("The Boys"));
  assert.ok(titles.includes("Daredevil"));
  assert.ok(titles.includes("Invincible"));
  assert.ok(!titles.some((t) => t.toLowerCase().includes("witcher")));
});
