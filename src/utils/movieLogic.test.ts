import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMovieTitle,
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
