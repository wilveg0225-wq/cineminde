export interface StreamingProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
}

export interface SwedishWatchProviders {
  type: "flatrate" | "rent_buy" | "none";
  providers: StreamingProvider[];
  link?: string;
}

export interface TmdbMovieEnrichment {
  tmdbId: number;
  title: string;
  originalTitle?: string;
  year: string;
  mediaType?: "movie" | "tv";
  posterPath?: string;
  voteAverage?: number;
  swedishProviders?: SwedishWatchProviders;
  tmdbGenreIds?: number[];
  tmdbGenres?: string[];
}

export interface WatchedMovie {
  id: string;
  title: string;
  originalTitle?: string;
  year?: string;
  mediaType?: "movie" | "tv";
  rating: number; // 1 to 5
  liked: boolean; // true = Gillade, false = Gillade inte
  tags: string[];
  thoughts?: string;
  addedAt: string;
  tmdbId?: number;
  posterPath?: string;
  tmdbRating?: number;
  swedishProviders?: SwedishWatchProviders;
  tmdbGenreIds?: number[];
  tmdbGenres?: string[];
}

export interface MovieRecommendation {
  id: string;
  title: string;
  originalTitle?: string;
  year: string;
  runtime: string;
  mediaType?: "movie" | "tv";
  matchPercentage: number;
  whyYouWillLikeIt: string;
  vibeTags: string[];
  isExactPinpointMatch?: boolean;
  tmdbId?: number;
  posterPath?: string;
  tmdbRating?: number;
  swedishProviders?: SwedishWatchProviders;
  tmdbGenreIds?: number[];
  tmdbGenres?: string[];
}

export interface ExpandableChipGroup {
  id: string;
  label: string;
  subchips: readonly string[];
}

export interface EveningPreferences {
  moods: string[];
  genres?: string[];
  contents: string[];
  frameworks: string[];
  customText: string;
  streamingProviders?: string[];
  mediaType?: "any" | "movie" | "tv";
}

export const SWEDISH_STREAMING_SERVICES = [
  "Netflix",
  "HBO Max",
  "Disney+",
  "Prime Video",
  "Viaplay",
  "SkyShowtime",
  "TV4 Play",
  "Apple TV+",
  "SF Anytime",
] as const;

export function normalizeProviderKey(name: string): string {
  const lower = (name || "").toLowerCase().trim();
  if (lower.includes("netflix")) return "netflix";
  if (lower === "max" || lower.includes("hbo max") || lower.includes("hbo")) return "max";
  if (lower.includes("disney")) return "disney+";
  if (lower.includes("prime video") || lower.includes("amazon prime")) return "prime video";
  if (lower.includes("viaplay")) return "viaplay";
  if (lower.includes("skyshowtime")) return "skyshowtime";
  if (lower.includes("tv4") || lower.includes("c more")) return "tv4 play";
  if (lower.includes("apple tv")) return "apple tv+";
  if (lower.includes("sf anytime")) return "sf anytime";
  if (lower.includes("cineasterna")) return "cineasterna";
  return lower;
}

export function movieMatchesStreamingProviders(
  swedishProviders: SwedishWatchProviders | undefined,
  selectedServices: string[]
): {
  matchesFlatrate: boolean;
  matchesRentBuy: boolean;
  matchedNames: string[];
} {
  if (
    !swedishProviders ||
    swedishProviders.type === "none" ||
    !Array.isArray(swedishProviders.providers) ||
    swedishProviders.providers.length === 0 ||
    !Array.isArray(selectedServices) ||
    selectedServices.length === 0
  ) {
    return { matchesFlatrate: false, matchesRentBuy: false, matchedNames: [] };
  }

  const selectedKeys = new Set(selectedServices.map(normalizeProviderKey));
  const matchedNames: string[] = [];

  for (const p of swedishProviders.providers) {
    const key = normalizeProviderKey(p.provider_name);
    if (selectedKeys.has(key) && !matchedNames.includes(p.provider_name)) {
      matchedNames.push(p.provider_name);
    }
  }

  const hasMatch = matchedNames.length > 0;
  return {
    matchesFlatrate: hasMatch && swedishProviders.type === "flatrate",
    matchesRentBuy: hasMatch && swedishProviders.type === "rent_buy",
    matchedNames,
  };
}

export function sortMoviesByStreamingServices<
  T extends { swedishProviders?: SwedishWatchProviders; matchPercentage?: number }
>(movies: T[], selectedServices: string[]): T[] {
  if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
    return movies;
  }

  return [...movies].sort((a, b) => {
    const mA = movieMatchesStreamingProviders(a.swedishProviders, selectedServices);
    const mB = movieMatchesStreamingProviders(b.swedishProviders, selectedServices);

    const tierA = mA.matchesFlatrate ? 2 : mA.matchesRentBuy ? 1 : 0;
    const tierB = mB.matchesFlatrate ? 2 : mB.matchesRentBuy ? 1 : 0;

    if (tierB !== tierA) return tierB - tierA;
    if (mB.matchedNames.length !== mA.matchedNames.length) {
      return mB.matchedNames.length - mA.matchedNames.length;
    }
    return (b.matchPercentage || 0) - (a.matchPercentage || 0);
  });
}

export function filterMoviesByStreamingServices<
  T extends { swedishProviders?: SwedishWatchProviders; matchPercentage?: number }
>(movies: T[], selectedServices: string[]): T[] {
  if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
    return movies;
  }

  const matching = movies.filter((m) => {
    const match = movieMatchesStreamingProviders(
      m.swedishProviders,
      selectedServices
    );
    return match.matchesFlatrate || match.matchesRentBuy;
  });

  return sortMoviesByStreamingServices(matching, selectedServices);
}

export const TMDB_OFFICIAL_GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Äventyr",
  16: "Animerat",
  35: "Komedi",
  80: "Krim",
  99: "Dokumentär",
  18: "Drama",
  10751: "Familj",
  14: "Fantasy",
  36: "Historia",
  27: "Skräck",
  10402: "Musik",
  9648: "Mysterium",
  10749: "Romantik",
  878: "Sci-Fi",
  10770: "TV-film",
  53: "Thriller",
  10752: "Krig",
  37: "Western",
  10759: "Action & Äventyr",
  10762: "Barn",
  10765: "Sci-Fi & Fantasy",
  10768: "Krig & Politik",
};

export function mapTmdbGenreIdsToNames(genreIds?: number[]): string[] {
  if (!Array.isArray(genreIds) || genreIds.length === 0) return [];
  const names: string[] = [];
  for (const id of genreIds) {
    const label = TMDB_OFFICIAL_GENRE_NAMES[Number(id)];
    if (label && !names.includes(label)) {
      names.push(label);
    }
  }
  return names;
}

interface TmdbCategoryRule {
  id: string;
  label: string;
  allowedGenreIds: number[];
}

export function extractTmdbVerificationRules(preferences: EveningPreferences): {
  genreRules: TmdbCategoryRule[];
  minYear?: number;
  maxYear?: number;
} {
  const allSelected = [
    ...(preferences.genres || []),
    ...(preferences.contents || []),
    ...(preferences.frameworks || []),
    ...(preferences.moods || []),
  ];

  const ruleMap = new Map<string, TmdbCategoryRule>();
  const addRule = (id: string, label: string, allowedGenreIds: number[]) => {
    if (!ruleMap.has(id)) {
      ruleMap.set(id, { id, label, allowedGenreIds });
    }
  };

  for (const chip of allSelected) {
    // 1. Action / Strid / Biljakter
    if (
      [
        "Action",
        "Kampsport & Närkamp",
        "Spion- & Agent-action",
        "Hämnd-action (Vigilante)",
        "Biljakter & Adrenalin",
        "Gun-fu / Lönnmördare",
        "Over-the-top / Explosivt",
        "Svärdsstrider / Närkamp",
        "Välkoreograferad action",
        "En mot alla (One-man army)",
        "Gladiator- / Turnering & Arena",
        "Prisjägare / Yrkesmördare",
      ].includes(chip)
    ) {
      addRule("action", "Action", [28, 10759]);
    } else if (
      chip === "Militär & Specialstyrkor" ||
      chip === "Strid, Action & Hämnd"
    ) {
      addRule("action", "Action / Krig", [28, 10759, 10752, 10768]);
    } else if (chip === "Action-romans") {
      addRule("action", "Action", [28, 10759]);
      addRule("romance", "Romantik", [10749]);
    } else if (chip === "Action-komedi") {
      addRule("action", "Action", [28, 10759]);
      addRule("comedy", "Komedi", [35]);
    } else if (chip === "Sci-Fi-action") {
      addRule("action", "Action", [28, 10759]);
      addRule("scifi", "Sci-Fi", [878, 10765]);
    }

    // 2. Komedi
    if (
      [
        "Komedi",
        "Romantisk komedi (Rom-com)",
        "Romantisk komedi",
        "Mörk / Svart komedi",
        "Buddy-komedi (Omaka par)",
        "Kriminalkomedi",
        "Feelgood-komedi",
        "Satir & Parodi",
        "Urflippad / Slapstick",
        "High school & Ungdom",
        "Dramakomedi (Dramedy)",
        "Skrattfest & Charmig",
      ].includes(chip)
    ) {
      addRule("comedy", "Komedi", [35]);
    }

    // 3. Sci-Fi & Rymden
    if (
      [
        "Sci-Fi",
        "Rymdäventyr & Främmande planeter",
        "Tidsresor & Tidsloop",
        "Cyberpunk & AI / Robotar",
        "Dystopi & Postapokalyps",
        "Utomjordingar / First Contact",
        "Mind-bending Sci-Fi",
        "Realistisk hård Sci-Fi",
        "Genetik, Kloning & Experiment",
        "Retro-futurism / Steampunk",
        "Tidsresor, Lore & Sci-Fi",
        "Tidsresor / Tidsloop",
        "Parallella universum / Multiverse",
        "AI / Robot med medvetande",
        "Rymden & Framtiden",
        "Rymdskepp & Rymdstation",
        "Främmande planet",
        "Cyberpunk-megastad",
        "Nära framtid (High-tech)",
      ].includes(chip)
    ) {
      addRule("scifi", "Sci-Fi", [878, 10765]);
    }

    // 4. Fantasy
    if (
      [
        "Fantasy",
        "Episk High Fantasy (Alver & Drakar)",
        "Mörk Fantasy & Monsterjakt",
        "Svärd & Magi (Sword & Sorcery)",
        "Mytologi & Folklore",
        "Gotisk saga",
        "Urban / Nutida Fantasy",
        "Riddare & Medeltida riken",
        "Portal till annan värld",
        "Monster / Mörk fantasy",
      ].includes(chip)
    ) {
      addRule("fantasy", "Fantasy", [14, 10765]);
    }

    // 5. Krim & Mysterium
    if (
      [
        "Krim & Mysterium",
        "Pusseldeckare (Whodunnit)",
        "Becksvart Neo-Noir",
        "Maffia & Gangstervärld",
        "Polisutredning & Detektiv",
        "Seriemördarjakt",
        "Bankrån & Heist",
        "Rättssalsdrama",
        "True Crime (Verklighetsbaserat)",
        "Undercover & Infiltratör",
        "Gåta, Brott & Kupp",
        "Kriminalgåta / Däckare",
        "Mordgåta i slutet sällskap",
        "Seriemördare med gåtor/mönster",
      ].includes(chip)
    ) {
      addRule("crime_mystery", "Krim / Mysterium", [80, 9648]);
    } else if (chip === "Heist & Kupplan" || chip === "Heist / Kupplan") {
      addRule("heist", "Krim / Thriller / Action", [80, 53, 28, 10759]);
    }

    // 6. Thriller & Spänning
    if (
      [
        "Thriller & Spänning",
        "Psykologisk thriller",
        "Kriminalthriller / Seriemördare",
        "Mysterie- & Pusselthriller",
        "Överlevnadsthriller",
        "Konspirations- & Politisk thriller",
        "Spionthriller",
        "Gisslan & Belägring",
        "Hämndthriller",
        "Tekno- / Cyberthriller",
        "Katastrofthriller",
      ].includes(chip)
    ) {
      addRule("thriller", "Thriller / Mysterium", [53, 9648, 80]);
    }

    // 7. Skräck
    if (
      [
        "Skräck",
        "Psykologisk skräck",
        "Övernaturligt & Spöken",
        "Monster & Varelser",
        "Slasher & Maskerad mördare",
        "Folk horror / Sekt & Kult",
        "Kosmisk & Sci-Fi-skräck",
        "Sci-Fi-skräck",
        "Zombies & Smitta",
        "Skräckkomedi",
        "Found footage",
        "Gotisk skräck",
      ].includes(chip)
    ) {
      addRule("horror", "Skräck", [27]);
    }

    // 8. Drama
    if (
      [
        "Drama",
        "Känslostarkt & Gripande",
        "Biografi & Verkliga livsöden",
        "Karaktärsstudie & Besatthet",
        "Familje- & Relationsdrama",
        "Historiskt kostymdrama",
        "Sport- & Underdog-drama",
        "Fängelsedrama",
        "Musik- & Konstnärsdrama",
        "Uppväxtskildring (Coming-of-age)",
      ].includes(chip)
    ) {
      addRule("drama", "Drama", [18]);
    }

    // 9. Romantik
    if (
      [
        "Romantik",
        "Episk & Ödesmättad kärlek",
        "Enemies to Lovers (Rivaler blir kära)",
        "Förbjuden kärlek",
        "Olycklig / Bitterljuv kärlek",
        "Historisk romans",
        "Sci-Fi- / Tidsrese-romans",
        "Romantisk & Pirrig",
      ].includes(chip)
    ) {
      addRule("romance", "Romantik", [10749]);
    }

    // 10. Äventyr & Krig / Western
    if (
      [
        "Äventyr & Krig",
        "Skattjakt & Arkeologi",
        "Överlevnad i vildmarken",
        "Vikingar & Nordisk myt",
        "Antiken & Gladiatorer",
        "Pirater & Havsäventyr",
        "Roadtrip & Resa",
      ].includes(chip)
    ) {
      addRule("adventure", "Äventyr", [12, 10759]);
    } else if (
      chip === "Episkt krig & Fältslag" ||
      chip === "Andra världskriget"
    ) {
      addRule("war", "Krig", [10752, 10768]);
    } else if (chip === "Western / Vilda Västern" || chip === "Vilda Västern") {
      addRule("western", "Western", [37]);
    }

    // 11. Animerat
    if (
      [
        "Animerat",
        "Anime / Japansk animation",
        "Studio Ghibli-känsla",
        "Pixar / DreamWorks-stil",
        "Vuxenanimation",
      ].includes(chip)
    ) {
      addRule("animation", "Animerat", [16]);
    } else if (chip === "Animerad action & Sci-Fi") {
      addRule("animation", "Animerat", [16]);
      addRule("action", "Action", [28, 10759]);
      addRule("scifi", "Sci-Fi", [878, 10765]);
    } else if (chip === "Familjefilm för alla åldrar") {
      addRule("family", "Familj / Animerat", [10751, 10762, 16]);
    }
  }

  // Release year / decade rules verified against official TMDB release_date / first_air_date
  let minYear: number | undefined;
  let maxYear: number | undefined;
  for (const fw of preferences.frameworks || []) {
    if (fw === "2020-talet (Helt nytt)") {
      minYear = Math.max(minYear ?? 0, 2020);
    } else if (fw === "2010-talet (2010–2019)") {
      minYear = Math.max(minYear ?? 0, 2010);
      maxYear = Math.min(maxYear ?? 9999, 2019);
    } else if (fw === "2000-talet (2000–2009)") {
      minYear = Math.max(minYear ?? 0, 2000);
      maxYear = Math.min(maxYear ?? 9999, 2009);
    } else if (fw === "1990-talet (90-talsklassiker)") {
      minYear = Math.max(minYear ?? 0, 1990);
      maxYear = Math.min(maxYear ?? 9999, 1999);
    } else if (fw === "1980-talet (80-talsklassiker)") {
      minYear = Math.max(minYear ?? 0, 1980);
      maxYear = Math.min(maxYear ?? 9999, 1989);
    } else if (fw === "Äldre klassiker (före 1980)") {
      maxYear = Math.min(maxYear ?? 9999, 1979);
    } else if (fw === "Nyare än 2015") {
      minYear = Math.max(minYear ?? 0, 2015);
    } else if (fw === "Klassiker") {
      maxYear = Math.min(maxYear ?? 9999, 2012);
    }
  }

  return {
    genreRules: Array.from(ruleMap.values()),
    minYear,
    maxYear,
  };
}

export function verifyMovieAgainstTmdbCategories(
  movie: { tmdbGenreIds?: number[]; year?: string; runtime?: string },
  preferences: EveningPreferences
): {
  verified: boolean;
  matchedRuleCount: number;
  totalRuleCount: number;
  matchRatio: number;
} {
  const { genreRules, minYear, maxYear } =
    extractTmdbVerificationRules(preferences);

  // Check TV series season count if a series length filter was chosen
  const moods = preferences.moods || [];
  const rtLower = (movie.runtime || "").toLowerCase();
  const seasonMatch = rtLower.match(/(\d+)\s*säsong/);
  const seasons = seasonMatch ? Number(seasonMatch[1]) : undefined;

  if (seasons !== undefined && seasons > 0) {
    if (
      moods.includes("Miniserie (1 kort säsong)") &&
      seasons > 1 &&
      !rtLower.includes("miniserie")
    ) {
      return {
        verified: false,
        matchedRuleCount: 0,
        totalRuleCount: genreRules.length + 1,
        matchRatio: 0,
      };
    }
    if (moods.includes("Kort serie (1–2 säsonger)") && seasons > 2) {
      return {
        verified: false,
        matchedRuleCount: 0,
        totalRuleCount: genreRules.length + 1,
        matchRatio: 0,
      };
    }
    if (
      moods.includes("Mellanlång serie (3–5 säsonger)") &&
      (seasons < 3 || seasons > 5)
    ) {
      return {
        verified: false,
        matchedRuleCount: 0,
        totalRuleCount: genreRules.length + 1,
        matchRatio: 0,
      };
    }
    if (moods.includes("Långkörare (6+ säsonger)") && seasons < 6) {
      return {
        verified: false,
        matchedRuleCount: 0,
        totalRuleCount: genreRules.length + 1,
        matchRatio: 0,
      };
    }
  }

  // Check release year against TMDB year if era filter was chosen
  if (minYear !== undefined || maxYear !== undefined) {
    const yearNum = Number((movie.year || "").replace(/[^0-9]/g, "").slice(0, 4));
    if (yearNum > 1900) {
      if (minYear !== undefined && yearNum < minYear) {
        return {
          verified: false,
          matchedRuleCount: 0,
          totalRuleCount: genreRules.length + 1,
          matchRatio: 0,
        };
      }
      if (maxYear !== undefined && yearNum > maxYear) {
        return {
          verified: false,
          matchedRuleCount: 0,
          totalRuleCount: genreRules.length + 1,
          matchRatio: 0,
        };
      }
    }
  }

  if (genreRules.length === 0) {
    return {
      verified: true,
      matchedRuleCount: 0,
      totalRuleCount: 0,
      matchRatio: 1,
    };
  }

  const genreIds = Array.isArray(movie.tmdbGenreIds) ? movie.tmdbGenreIds : [];
  if (genreIds.length === 0) {
    // If TMDB didn't return genre_ids for an obscure title, give it a neutral pass
    return {
      verified: true,
      matchedRuleCount: 0,
      totalRuleCount: genreRules.length,
      matchRatio: 0.5,
    };
  }

  const idSet = new Set(genreIds.map(Number));
  let matchedRuleCount = 0;

  for (const rule of genreRules) {
    if (rule.allowedGenreIds.some((gid) => idSet.has(gid))) {
      matchedRuleCount++;
    }
  }

  const matchRatio = matchedRuleCount / genreRules.length;
  const verified =
    genreRules.length === 1
      ? matchedRuleCount >= 1
      : genreRules.length === 2
      ? matchedRuleCount === 2
      : matchedRuleCount >= 2 && matchRatio >= 0.6;

  return {
    verified,
    matchedRuleCount,
    totalRuleCount: genreRules.length,
    matchRatio,
  };
}

export function filterAndVerifyMoviesByTmdbCategories<
  T extends {
    tmdbGenreIds?: number[];
    year?: string;
    runtime?: string;
    matchPercentage?: number;
  }
>(movies: T[], preferences: EveningPreferences): T[] {
  const { genreRules, minYear, maxYear } =
    extractTmdbVerificationRules(preferences);
  const hasSeriesLengthRule = (preferences.moods || []).some((m) =>
    [
      "Miniserie (1 kort säsong)",
      "Kort serie (1–2 säsonger)",
      "Mellanlång serie (3–5 säsonger)",
      "Långkörare (6+ säsonger)",
    ].includes(m)
  );
  if (
    genreRules.length === 0 &&
    minYear === undefined &&
    maxYear === undefined &&
    !hasSeriesLengthRule
  ) {
    return movies;
  }

  const evaluated = movies.map((movie) => ({
    movie,
    check: verifyMovieAgainstTmdbCategories(movie, preferences),
  }));

  // If we have full matches (100% of all chosen TMDB category groups), strictly prefer those!
  const fullMatches = evaluated.filter(
    (item) => item.check.matchRatio === 1 && item.check.verified
  );
  if (fullMatches.length > 0) {
    fullMatches.sort(
      (a, b) => (b.movie.matchPercentage || 0) - (a.movie.matchPercentage || 0)
    );
    return fullMatches.map((item) => item.movie);
  }

  // Filter to candidates that passed verification
  const verified = evaluated.filter((item) => item.check.verified);
  if (verified.length === 0) {
    return [];
  }

  // Sort by highest official TMDB category match ratio first, then matchPercentage
  verified.sort((a, b) => {
    if (b.check.matchRatio !== a.check.matchRatio) {
      return b.check.matchRatio - a.check.matchRatio;
    }
    return (b.movie.matchPercentage || 0) - (a.movie.matchPercentage || 0);
  });

  return verified.map((item) => item.movie);
}

export interface TasteStats {
  totalWatched: number;
  averageRating: number;
  likedCount: number;
  topTags: {
    tag: string;
    count: number;
    percentage: number;
  }[];
}

export interface ExportedAppData {
  version: number;
  exportedAt: string;
  watchedMovies: WatchedMovie[];
  watchlist: MovieRecommendation[];
  tasteProfileSummary: string;
}

export const GENRE_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "action",
    label: "Action",
    subchips: [
      "Action-romans",
      "Action-komedi",
      "Kampsport & Närkamp",
      "Spion- & Agent-action",
      "Heist & Kupplan",
      "Hämnd-action (Vigilante)",
      "Biljakter & Adrenalin",
      "Militär & Specialstyrkor",
      "Gun-fu / Lönnmördare",
      "Over-the-top / Explosivt",
      "Sci-Fi-action",
    ],
  },
  {
    id: "comedy",
    label: "Komedi",
    subchips: [
      "Romantisk komedi (Rom-com)",
      "Action-komedi",
      "Mörk / Svart komedi",
      "Buddy-komedi (Omaka par)",
      "Kriminalkomedi",
      "Feelgood-komedi",
      "Satir & Parodi",
      "Urflippad / Slapstick",
      "High school & Ungdom",
      "Dramakomedi (Dramedy)",
    ],
  },
  {
    id: "thriller",
    label: "Thriller & Spänning",
    subchips: [
      "Psykologisk thriller",
      "Kriminalthriller / Seriemördare",
      "Mysterie- & Pusselthriller",
      "Överlevnadsthriller",
      "Konspirations- & Politisk thriller",
      "Spionthriller",
      "Gisslan & Belägring",
      "Hämndthriller",
      "Tekno- / Cyberthriller",
      "Katastrofthriller",
    ],
  },
  {
    id: "scifi",
    label: "Sci-Fi",
    subchips: [
      "Rymdäventyr & Främmande planeter",
      "Tidsresor & Tidsloop",
      "Cyberpunk & AI / Robotar",
      "Dystopi & Postapokalyps",
      "Utomjordingar / First Contact",
      "Mind-bending Sci-Fi",
      "Realistisk hård Sci-Fi",
      "Sci-Fi-skräck",
      "Genetik, Kloning & Experiment",
      "Retro-futurism / Steampunk",
    ],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    subchips: [
      "Episk High Fantasy (Alver & Drakar)",
      "Mörk Fantasy & Monsterjakt",
      "Svärd & Magi (Sword & Sorcery)",
      "Mytologi & Folklore",
      "Gotisk saga",
      "Urban / Nutida Fantasy",
      "Riddare & Medeltida riken",
      "Portal till annan värld",
    ],
  },
  {
    id: "crime",
    label: "Krim & Mysterium",
    subchips: [
      "Pusseldeckare (Whodunnit)",
      "Becksvart Neo-Noir",
      "Maffia & Gangstervärld",
      "Polisutredning & Detektiv",
      "Seriemördarjakt",
      "Bankrån & Heist",
      "Rättssalsdrama",
      "True Crime (Verklighetsbaserat)",
      "Undercover & Infiltratör",
    ],
  },
  {
    id: "horror",
    label: "Skräck",
    subchips: [
      "Psykologisk skräck",
      "Övernaturligt & Spöken",
      "Monster & Varelser",
      "Slasher & Maskerad mördare",
      "Folk horror / Sekt & Kult",
      "Kosmisk & Sci-Fi-skräck",
      "Zombies & Smitta",
      "Skräckkomedi",
      "Found footage",
      "Gotisk skräck",
    ],
  },
  {
    id: "drama",
    label: "Drama",
    subchips: [
      "Känslostarkt & Gripande",
      "Biografi & Verkliga livsöden",
      "Karaktärsstudie & Besatthet",
      "Familje- & Relationsdrama",
      "Historiskt kostymdrama",
      "Sport- & Underdog-drama",
      "Fängelsedrama",
      "Musik- & Konstnärsdrama",
      "Uppväxtskildring (Coming-of-age)",
    ],
  },
  {
    id: "romance",
    label: "Romantik",
    subchips: [
      "Romantisk komedi",
      "Action-romans",
      "Episk & Ödesmättad kärlek",
      "Enemies to Lovers (Rivaler blir kära)",
      "Förbjuden kärlek",
      "Olycklig / Bitterljuv kärlek",
      "Historisk romans",
      "Sci-Fi- / Tidsrese-romans",
    ],
  },
  {
    id: "adventure",
    label: "Äventyr & Krig",
    subchips: [
      "Skattjakt & Arkeologi",
      "Överlevnad i vildmarken",
      "Episkt krig & Fältslag",
      "Andra världskriget",
      "Vikingar & Nordisk myt",
      "Antiken & Gladiatorer",
      "Pirater & Havsäventyr",
      "Western / Vilda Västern",
      "Roadtrip & Resa",
    ],
  },
  {
    id: "animation",
    label: "Animerat",
    subchips: [
      "Anime / Japansk animation",
      "Studio Ghibli-känsla",
      "Pixar / DreamWorks-stil",
      "Vuxenanimation",
      "Animerad action & Sci-Fi",
      "Familjefilm för alla åldrar",
    ],
  },
];

export const CONTENT_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "plot-twist",
    label: "Twist & Gåta",
    subchips: [
      "Smart plot-twist",
      "Ingenting är vad det verkar",
      "Opålitlig berättare",
      "Dubbelliv & Hemlig identitet",
      "Dröm eller verklighet",
      "Minnesförlust (Amnesi)",
      "Psykologiskt rävspel",
    ],
  },
  {
    id: "crime-investigation",
    label: "Krim & Utredning",
    subchips: [
      "Kriminalgåta / Däckare",
      "Mordgåta i slutet sällskap",
      "Katt-och-råtta-lek",
      "Seriemördare med gåtor/mönster",
      "Konspiration & Hemligheter",
      "Oskyldigt anklagad på flykt",
    ],
  },
  {
    id: "heist-plan",
    label: "Kupp & Heist",
    subchips: [
      "Heist / Kupplan",
      "Bankrån & Kupp",
      "Maffiauppgörelse",
      "Infiltration & Bluff",
    ],
  },
  {
    id: "combat-action",
    label: "Strid & Action",
    subchips: [
      "Svärdsstrider / Närkamp",
      "Välkoreograferad action",
      "En mot alla (One-man army)",
      "Gladiator- / Turnering & Arena",
      "Prisjägare / Yrkesmördare",
    ],
  },
  {
    id: "revenge-justice",
    label: "Hämnd & Skydd",
    subchips: [
      "Hämndberättelse",
      "Skydda någon till varje pris",
      "Uppgörelse med det förflutna",
      "Rättvisa utanför lagen",
    ],
  },
  {
    id: "survival-threat",
    label: "Överlevnad & Hot",
    subchips: [
      "Överlevnad",
      "Instängda på isolerad plats",
      "Människa mot naturkraft",
      "Utbrott / Pandemi & Undergång",
      "Räddningsuppdrag mot klockan",
    ],
  },
  {
    id: "fantasy-creatures",
    label: "Monster & Fantasy",
    subchips: [
      "Monster / Mörk fantasy",
      "Utvald hjälte / Profetia",
      "Magi & Uråldriga krafter",
      "Mytologiska väsen",
    ],
  },
  {
    id: "lore-time",
    label: "Tidsresor & Sci-Fi",
    subchips: [
      "Tidsresor / Tidsloop",
      "Fast i samma dag (Tidsloop)",
      "Parallella universum / Multiverse",
      "AI / Robot med medvetande",
      "Djup lore / Världsbygge",
    ],
  },
  {
    id: "character-real",
    label: "Karaktärer & Verklighet",
    subchips: [
      "Verklighetsbaserat",
      "Omaka par som tvingas samarbeta",
      "Rivalitet & Besatthet",
      "Mästare & Lärjunge",
      "Underdog mot alla odds",
      "Hemligt sällskap / Gille",
    ],
  },
];

export const SETTING_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "space-future",
    label: "Rymd & Framtid",
    subchips: [
      "Rymdskepp & Rymdstation",
      "Främmande planet",
      "Cyberpunk-megastad",
      "Postapokalyptisk ödemark",
      "Nära framtid (High-tech)",
    ],
  },
  {
    id: "isolated",
    label: "Isolerade platser",
    subchips: [
      "Stormig ö / Öde ö",
      "Isolerad stuga / Herrgård",
      "Fängelse / Mentalsjukhus",
      "Ubåt / Fartyg till havs",
      "Tåg / Flygplan / Hotell",
      "Underjordisk bunker / Grotta",
    ],
  },
  {
    id: "nature-wilderness",
    label: "Natur & Vildmark",
    subchips: [
      "Skog, Berg & Vildmark",
      "Snö, Is & Arktisk kyla",
      "Öken & Hetta",
      "Solig kust / Medelhavet",
    ],
  },
  {
    id: "city-vibe",
    label: "Städer & Metropoler",
    subchips: [
      "Regnig storstad på natten (Noir)",
      "Småstad med mörka hemligheter",
      "London / Brittisk miljö",
      "New York / Amerikansk storstad",
      "Tokyo / Asiatisk metropol",
    ],
  },
  {
    id: "history-ancient-medieval",
    label: "Forntid & Medeltid",
    subchips: [
      "Antiken (Rom / Grekland)",
      "Vikingatid & Medeltid",
      "1700- & 1800-tal (Gotiskt / Sekelskifte)",
    ],
  },
  {
    id: "history-modern-era",
    label: "1900-tal & Western",
    subchips: [
      "Vilda Västern",
      "1920–1940-tal (Noir & Världskrig)",
      "1970- & 1980-talsmiljö",
    ],
  },
  {
    id: "release-decade",
    label: "Utgivningsår",
    subchips: [
      "2020-talet (Helt nytt)",
      "2010-talet (2010–2019)",
      "2000-talet (2000–2009)",
      "1990-talet (90-talsklassiker)",
      "1980-talet (80-talsklassiker)",
      "Äldre klassiker (före 1980)",
      "Nyare än 2015",
      "Klassiker",
    ],
  },
];

export const MOOD_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "dark-tense",
    label: "Mörk & Nervkittlande",
    subchips: [
      "Mörk & rå",
      "Spännande på helspänn",
      "Kuslig & Obehaglig",
      "Klaustrofobisk & Tät",
      "Becksvart & Kompromisslös",
      "Adrenalin & Puls",
    ],
  },
  {
    id: "mind-smart",
    label: "Smart & Psykologisk",
    subchips: [
      "Mind-bending / Psykologisk",
      "Mysterietät & Gåtfull",
      "Filosofisk & Tankeväckande",
      "Oförutsägbar",
      "Drömsk & Surrealistisk",
    ],
  },
  {
    id: "warm-feelgood",
    label: "Feelgood & Mys",
    subchips: [
      "Mysig & stämningfull",
      "Feelgood & Varm",
      "Lättsam",
      "Nostalgisk",
    ],
  },
  {
    id: "humor-romance",
    label: "Humor & Romantik",
    subchips: [
      "Skrattfest & Charmig",
      "Romantisk & Pirrig",
      "Rapp dialog & Kemi",
      "Dråplig & Knasig",
    ],
  },
  {
    id: "epic-grand",
    label: "Episk & Spektakulär",
    subchips: [
      "Episk & storslagen",
      "Visuellt mästerverk (Foto & Musik)",
      "Inspirerande & Triumferande",
    ],
  },
  {
    id: "emotional-moving",
    label: "Känslosam & Gripande",
    subchips: [
      "Känslosam & Gripande",
      "Melankolisk & Vacker",
      "Hjärtekrossande",
      "Tårframkallande",
    ],
  },
  {
    id: "pace-tempo",
    label: "Berättartempo",
    subchips: [
      "Högt tempo direkt (ingen seg start)",
      "Slow-burn (bygger spänning)",
      "Intensivt & Rastlöst",
      "Meditativt & Lugnt",
      "Kritikerrosat mästerverk",
      "Dold pärla",
    ],
  },
  {
    id: "format-length",
    label: "Speltid & Längd",
    subchips: [
      "Max 90 minuter",
      "Max 2 timmar",
      "2+ timmar (Långfilm)",
      "Miniserie (1 kort säsong)",
      "Kort serie (1–2 säsonger)",
      "Mellanlång serie (3–5 säsonger)",
      "Långkörare (6+ säsonger)",
      "Korta avsnitt (ca 20–30 min)",
      "Avslutad serie (helt färdig)",
    ],
  },
];

export const MOVIE_LENGTH_SUBCHIPS: readonly string[] = [
  "Max 90 minuter",
  "Max 2 timmar",
  "2+ timmar (Långfilm)",
];

export const TV_SERIES_LENGTH_SUBCHIPS: readonly string[] = [
  "Miniserie (1 kort säsong)",
  "Kort serie (1–2 säsonger)",
  "Mellanlång serie (3–5 säsonger)",
  "Långkörare (6+ säsonger)",
  "Korta avsnitt (ca 20–30 min)",
  "Avslutad serie (helt färdig)",
];

export function getMoodGroupsForMediaType(
  mediaType: "any" | "movie" | "tv" = "any"
): readonly ExpandableChipGroup[] {
  const baseGroups = MOOD_GROUPS.filter((g) => g.id !== "format-length");

  const lengthSubchips =
    mediaType === "tv"
      ? [...TV_SERIES_LENGTH_SUBCHIPS]
      : mediaType === "movie"
      ? [...MOVIE_LENGTH_SUBCHIPS]
      : [...MOVIE_LENGTH_SUBCHIPS, ...TV_SERIES_LENGTH_SUBCHIPS];

  const lengthGroup: ExpandableChipGroup = {
    id: "format-length",
    label:
      mediaType === "tv"
        ? "Serielängd"
        : mediaType === "movie"
        ? "Speltid"
        : "Speltid & Längd",
    subchips: lengthSubchips,
  };

  return [...baseGroups, lengthGroup];
}

export const QUALITY_TAGS: readonly string[] = [
  "Stämningen / Atmosfären",
  "Karaktärerna & Skådespeleriet",
  "Världsbygget / Miljön",
  "Action- & Stridsscenerna",
  "Manuset & Dialogen",
  "Spänningen & Tempot",
  "Twisten / Slutet",
  "Musiken & Fotot",
];

export function getTmdbPosterUrl(
  posterPath?: string,
  size: "w92" | "w185" | "w500" = "w500"
): string | null {
  if (!posterPath) return null;
  if (posterPath.startsWith("http://") || posterPath.startsWith("https://") || posterPath.startsWith("data:")) {
    return posterPath;
  }
  if (posterPath.startsWith("/")) {
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  }
  return null;
}

export function getTmdbLogoUrl(logoPath?: string): string | null {
  if (!logoPath) return null;
  if (logoPath.startsWith("http://") || logoPath.startsWith("https://") || logoPath.startsWith("data:")) {
    return logoPath;
  }
  if (logoPath.startsWith("/")) {
    return `https://image.tmdb.org/t/p/w92${logoPath}`;
  }
  return null;
}

export function parseTmdbSwedishProviders(seResult: unknown): SwedishWatchProviders {
  if (!seResult || typeof seResult !== "object") {
    return { type: "none", providers: [] };
  }
  const se = seResult as {
    link?: string;
    flatrate?: StreamingProvider[];
    free?: StreamingProvider[];
    ads?: StreamingProvider[];
    rent?: StreamingProvider[];
    buy?: StreamingProvider[];
  };

  const dedupe = (list: StreamingProvider[]): StreamingProvider[] => {
    const seen = new Set<string>();
    const out: StreamingProvider[] = [];
    for (const item of list) {
      if (!item || !item.provider_name) continue;
      const rawName = String(item.provider_name).trim();
      const displayName =
        rawName.toLowerCase() === "max" ? "HBO Max" : rawName;
      const key = displayName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        provider_id: Number(item.provider_id) || out.length + 1,
        provider_name: displayName,
        logo_path: item.logo_path ? String(item.logo_path) : undefined,
      });
    }
    return out;
  };

  const streamable = [
    ...(Array.isArray(se.flatrate) ? se.flatrate : []),
    ...(Array.isArray(se.free) ? se.free : []),
    ...(Array.isArray(se.ads) ? se.ads : []),
  ];

  if (streamable.length > 0) {
    return {
      type: "flatrate",
      providers: dedupe(streamable).slice(0, 6),
      link: se.link,
    };
  }

  const rentAndBuy = [
    ...(Array.isArray(se.rent) ? se.rent : []),
    ...(Array.isArray(se.buy) ? se.buy : []),
  ];

  if (rentAndBuy.length > 0) {
    return {
      type: "rent_buy",
      providers: dedupe(rentAndBuy).slice(0, 5),
      link: se.link,
    };
  }

  return { type: "none", providers: [] };
}

// Swedish streaming provider presets (used when enriching or when live TMDB key is not yet provided)
const PROVIDERS = {
  NETFLIX: { provider_id: 8, provider_name: "Netflix" },
  MAX: { provider_id: 1899, provider_name: "HBO Max" },
  VIAPLAY: { provider_id: 76, provider_name: "Viaplay" },
  DISNEY: { provider_id: 337, provider_name: "Disney+" },
  PRIME: { provider_id: 119, provider_name: "Prime Video" },
  SKYSHOWTIME: { provider_id: 1773, provider_name: "SkyShowtime" },
  TV4PLAY: { provider_id: 383, provider_name: "TV4 Play" },
  APPLETV: { provider_id: 2, provider_name: "Apple TV" },
  SFANYTIME: { provider_id: 426, provider_name: "SF Anytime" },
};

export const CURATED_TMDB_MOVIES: TmdbMovieEnrichment[] = [
  {
    tmdbId: 146233,
    title: "Prisoners",
    originalTitle: "Prisoners",
    year: "2013",
    voteAverage: 8.1,
    tmdbGenreIds: [18, 53, 80],
    tmdbGenres: ["Drama", "Thriller", "Krim"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 120,
    title: "Sagan om ringen: Härskarringen",
    originalTitle: "The Lord of the Rings: The Fellowship of the Ring",
    year: "2001",
    voteAverage: 8.4,
    tmdbGenreIds: [12, 14, 28],
    tmdbGenres: ["Äventyr", "Fantasy", "Action"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 546554,
    title: "Knives Out",
    originalTitle: "Knives Out",
    year: "2019",
    voteAverage: 7.9,
    tmdbGenreIds: [35, 80, 9648],
    tmdbGenres: ["Komedi", "Krim", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 693134,
    title: "Dune: Part Two",
    originalTitle: "Dune: Part Two",
    year: "2024",
    voteAverage: 8.3,
    tmdbGenreIds: [878, 12, 28],
    tmdbGenres: ["Sci-Fi", "Äventyr", "Action"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 438631,
    title: "Dune",
    originalTitle: "Dune",
    year: "2021",
    voteAverage: 7.8,
    tmdbGenreIds: [878, 12],
    tmdbGenres: ["Sci-Fi", "Äventyr"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 807,
    title: "Se7en",
    originalTitle: "Se7en",
    year: "1995",
    voteAverage: 8.4,
    tmdbGenreIds: [80, 9648, 53],
    tmdbGenres: ["Krim", "Mysterium", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 639933,
    title: "The Northman",
    originalTitle: "The Northman",
    year: "2022",
    voteAverage: 7.1,
    tmdbGenreIds: [28, 12, 14],
    tmdbGenres: ["Action", "Äventyr", "Fantasy"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.SKYSHOWTIME, PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 1949,
    title: "Zodiac",
    originalTitle: "Zodiac",
    year: "2007",
    voteAverage: 7.5,
    tmdbGenreIds: [80, 18, 9648, 53],
    tmdbGenres: ["Krim", "Drama", "Mysterium", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 1124,
    title: "The Prestige",
    originalTitle: "The Prestige",
    year: "2006",
    voteAverage: 8.2,
    tmdbGenreIds: [18, 9648, 878],
    tmdbGenres: ["Drama", "Mysterium", "Sci-Fi"],
    swedishProviders: {
      type: "rent_buy",
      providers: [PROVIDERS.APPLETV, PROVIDERS.SFANYTIME],
    },
  },
  {
    tmdbId: 1417,
    title: "Pan's Labyrinth",
    originalTitle: "El laberinto del fauno",
    year: "2006",
    voteAverage: 7.8,
    tmdbGenreIds: [14, 18, 10752],
    tmdbGenres: ["Fantasy", "Drama", "Krig"],
    swedishProviders: {
      type: "rent_buy",
      providers: [PROVIDERS.SFANYTIME, PROVIDERS.APPLETV],
    },
  },
  {
    tmdbId: 329865,
    title: "Arrival",
    originalTitle: "Arrival",
    year: "2016",
    voteAverage: 7.6,
    tmdbGenreIds: [18, 878, 9648],
    tmdbGenres: ["Drama", "Sci-Fi", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.SKYSHOWTIME],
    },
  },
  {
    tmdbId: 559907,
    title: "The Green Knight",
    originalTitle: "The Green Knight",
    year: "2021",
    voteAverage: 6.6,
    tmdbGenreIds: [12, 18, 14],
    tmdbGenres: ["Äventyr", "Drama", "Fantasy"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.PRIME, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 11324,
    title: "Shutter Island",
    originalTitle: "Shutter Island",
    year: "2010",
    voteAverage: 8.2,
    tmdbGenreIds: [18, 53, 9648],
    tmdbGenres: ["Drama", "Thriller", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.SKYSHOWTIME, PROVIDERS.TV4PLAY],
    },
  },
  {
    tmdbId: 245891,
    title: "John Wick",
    originalTitle: "John Wick",
    year: "2014",
    voteAverage: 7.4,
    tmdbGenreIds: [28, 53],
    tmdbGenres: ["Action", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.PRIME, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 6312,
    title: "Brotherhood of the Wolf",
    originalTitle: "Le Pacte des loups",
    year: "2001",
    voteAverage: 7.0,
    tmdbGenreIds: [28, 12, 36, 27, 9648],
    tmdbGenres: ["Action", "Äventyr", "Historia", "Skräck", "Mysterium"],
    swedishProviders: {
      type: "none",
      providers: [],
    },
  },
  {
    tmdbId: 11423,
    title: "Memories of Murder",
    originalTitle: "Salinui chueok",
    year: "2003",
    voteAverage: 8.1,
    tmdbGenreIds: [80, 18, 53],
    tmdbGenres: ["Krim", "Drama", "Thriller"],
    swedishProviders: {
      type: "rent_buy",
      providers: [PROVIDERS.SFANYTIME, PROVIDERS.APPLETV],
    },
  },
  {
    tmdbId: 98,
    title: "Gladiator",
    originalTitle: "Gladiator",
    year: "2000",
    voteAverage: 8.2,
    tmdbGenreIds: [28, 18, 12],
    tmdbGenres: ["Action", "Drama", "Äventyr"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.SKYSHOWTIME, PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 522627,
    title: "The Gentlemen",
    originalTitle: "The Gentlemen",
    year: "2019",
    voteAverage: 7.7,
    tmdbGenreIds: [28, 80, 35],
    tmdbGenres: ["Action", "Krim", "Komedi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 27205,
    title: "Inception",
    originalTitle: "Inception",
    year: "2010",
    voteAverage: 8.4,
    tmdbGenreIds: [28, 878, 12],
    tmdbGenres: ["Action", "Sci-Fi", "Äventyr"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 157336,
    title: "Interstellar",
    originalTitle: "Interstellar",
    year: "2014",
    voteAverage: 8.4,
    tmdbGenreIds: [12, 18, 878],
    tmdbGenres: ["Äventyr", "Drama", "Sci-Fi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 496243,
    title: "Parasite",
    originalTitle: "Gisaengchung",
    year: "2019",
    voteAverage: 8.5,
    tmdbGenreIds: [35, 53, 18],
    tmdbGenres: ["Komedi", "Thriller", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 210577,
    title: "Gone Girl",
    originalTitle: "Gone Girl",
    year: "2014",
    voteAverage: 7.9,
    tmdbGenreIds: [18, 9648, 53],
    tmdbGenres: ["Drama", "Mysterium", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.DISNEY, PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 76341,
    title: "Mad Max: Fury Road",
    originalTitle: "Mad Max: Fury Road",
    year: "2015",
    voteAverage: 7.6,
    tmdbGenreIds: [28, 12, 878],
    tmdbGenres: ["Action", "Äventyr", "Sci-Fi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 706510,
    title: "The Witcher: Nightmare of the Wolf",
    originalTitle: "The Witcher: Nightmare of the Wolf",
    year: "2021",
    voteAverage: 7.5,
    tmdbGenreIds: [16, 28, 14],
    tmdbGenres: ["Animerat", "Action", "Fantasy"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 324857,
    title: "Spider-Man: Into the Spider-Verse",
    originalTitle: "Spider-Man: Into the Spider-Verse",
    year: "2018",
    voteAverage: 8.4,
    tmdbGenreIds: [28, 12, 16, 878],
    tmdbGenres: ["Action", "Äventyr", "Animerat", "Sci-Fi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 569094,
    title: "Spider-Man: Across the Spider-Verse",
    originalTitle: "Spider-Man: Across the Spider-Verse",
    year: "2023",
    voteAverage: 8.4,
    tmdbGenreIds: [16, 28, 12, 878],
    tmdbGenres: ["Animerat", "Action", "Äventyr", "Sci-Fi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 9806,
    title: "Superhjältarna",
    originalTitle: "The Incredibles",
    year: "2004",
    voteAverage: 7.7,
    tmdbGenreIds: [28, 12, 16, 10751],
    tmdbGenres: ["Action", "Äventyr", "Animerat", "Familj"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.DISNEY],
    },
  },
  {
    tmdbId: 128,
    title: "Prinsessan Mononoke",
    originalTitle: "もののけ姫",
    year: "1997",
    voteAverage: 8.3,
    tmdbGenreIds: [12, 16, 14, 28],
    tmdbGenres: ["Äventyr", "Animerat", "Fantasy", "Action"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 149,
    title: "Akira",
    originalTitle: "AKIRA",
    year: "1988",
    voteAverage: 7.9,
    tmdbGenreIds: [16, 878, 28],
    tmdbGenres: ["Animerat", "Sci-Fi", "Action"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 315162,
    title: "Mästerkatten 2: Den sista önskan",
    originalTitle: "Puss in Boots: The Last Wish",
    year: "2022",
    voteAverage: 8.2,
    tmdbGenreIds: [16, 12, 35, 14, 10751, 28],
    tmdbGenres: ["Animerat", "Äventyr", "Komedi", "Fantasy", "Action"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.SKYSHOWTIME],
    },
  },
  {
    tmdbId: 105248,
    title: "Cyberpunk: Edgerunners",
    originalTitle: "Cyberpunk: Edgerunners",
    year: "2022",
    mediaType: "tv",
    voteAverage: 8.6,
    tmdbGenreIds: [16, 10765, 10759],
    tmdbGenres: ["Animerat", "Sci-Fi & Fantasy", "Action & Äventyr"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 155,
    title: "The Dark Knight",
    originalTitle: "The Dark Knight",
    year: "2008",
    voteAverage: 8.5,
    tmdbGenreIds: [18, 28, 80, 53],
    tmdbGenres: ["Drama", "Action", "Krim", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 414906,
    title: "The Batman",
    originalTitle: "The Batman",
    year: "2022",
    voteAverage: 7.7,
    tmdbGenreIds: [80, 9648, 53],
    tmdbGenres: ["Krim", "Mysterium", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 747,
    title: "Shaun of the Dead",
    originalTitle: "Shaun of the Dead",
    year: "2004",
    voteAverage: 7.5,
    tmdbGenreIds: [27, 35],
    tmdbGenres: ["Skräck", "Komedi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.SKYSHOWTIME],
    },
  },
  {
    tmdbId: 246741,
    title: "What We Do in the Shadows",
    originalTitle: "What We Do in the Shadows",
    year: "2014",
    voteAverage: 7.6,
    tmdbGenreIds: [35, 27],
    tmdbGenres: ["Komedi", "Skräck"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 46838,
    title: "Tucker & Dale vs Evil",
    originalTitle: "Tucker and Dale vs Evil",
    year: "2010",
    voteAverage: 7.2,
    tmdbGenreIds: [35, 27],
    tmdbGenres: ["Komedi", "Skräck"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 19908,
    title: "Zombieland",
    originalTitle: "Zombieland",
    year: "2009",
    voteAverage: 7.3,
    tmdbGenreIds: [35, 27, 28],
    tmdbGenres: ["Komedi", "Skräck", "Action"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 4771,
    title: "The Cabin in the Woods",
    originalTitle: "The Cabin in the Woods",
    year: "2012",
    voteAverage: 6.6,
    tmdbGenreIds: [27, 35, 9648],
    tmdbGenres: ["Skräck", "Komedi", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 587792,
    title: "Palm Springs",
    originalTitle: "Palm Springs",
    year: "2020",
    voteAverage: 7.3,
    tmdbGenreIds: [35, 878, 10749],
    tmdbGenres: ["Komedi", "Sci-Fi", "Romantik"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 926,
    title: "Galaxy Quest",
    originalTitle: "Galaxy Quest",
    year: "1999",
    voteAverage: 7.1,
    tmdbGenreIds: [35, 878],
    tmdbGenres: ["Komedi", "Sci-Fi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.SKYSHOWTIME],
    },
  },
  {
    tmdbId: 335984,
    title: "Blade Runner 2049",
    originalTitle: "Blade Runner 2049",
    year: "2017",
    voteAverage: 7.6,
    tmdbGenreIds: [878, 18],
    tmdbGenres: ["Sci-Fi", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 872585,
    title: "Oppenheimer",
    originalTitle: "Oppenheimer",
    year: "2023",
    voteAverage: 8.1,
    tmdbGenreIds: [18, 36],
    tmdbGenres: ["Drama", "Historia"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.SKYSHOWTIME],
    },
  },
  {
    tmdbId: 273481,
    title: "Sicario",
    originalTitle: "Sicario",
    year: "2015",
    voteAverage: 7.4,
    tmdbGenreIds: [28, 80, 53],
    tmdbGenres: ["Action", "Krim", "Thriller"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.PRIME, PROVIDERS.TV4PLAY],
    },
  },
  {
    tmdbId: 530385,
    title: "Midsommar",
    originalTitle: "Midsommar",
    year: "2019",
    voteAverage: 7.2,
    tmdbGenreIds: [27, 18, 9648],
    tmdbGenres: ["Skräck", "Drama", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 15472,
    title: "Män som hatar kvinnor",
    originalTitle: "Män som hatar kvinnor",
    year: "2009",
    voteAverage: 7.4,
    tmdbGenreIds: [18, 53, 80, 9648],
    tmdbGenres: ["Drama", "Thriller", "Krim", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY, PROVIDERS.VIAPLAY],
    },
  },
  {
    tmdbId: 87108,
    title: "Chernobyl",
    originalTitle: "Chernobyl",
    year: "2019",
    mediaType: "tv",
    voteAverage: 8.7,
    tmdbGenreIds: [18, 36],
    tmdbGenres: ["Drama", "Historia"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.APPLETV],
    },
  },
  {
    tmdbId: 126308,
    title: "Shōgun",
    originalTitle: "Shōgun",
    year: "2024",
    mediaType: "tv",
    voteAverage: 8.6,
    tmdbGenreIds: [18, 10768, 10759],
    tmdbGenres: ["Drama", "Krig & Politik", "Action & Äventyr"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.DISNEY],
    },
  },
  {
    tmdbId: 46648,
    title: "True Detective",
    originalTitle: "True Detective",
    year: "2014",
    mediaType: "tv",
    voteAverage: 8.3,
    tmdbGenreIds: [18, 9648, 80],
    tmdbGenres: ["Drama", "Mysterium", "Krim"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 95396,
    title: "Severance",
    originalTitle: "Severance",
    year: "2022",
    mediaType: "tv",
    voteAverage: 8.4,
    tmdbGenreIds: [18, 9648, 10765],
    tmdbGenres: ["Drama", "Mysterium", "Sci-Fi & Fantasy"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.APPLETV],
    },
  },
  {
    tmdbId: 4613,
    title: "Band of Brothers",
    originalTitle: "Band of Brothers",
    year: "2001",
    mediaType: "tv",
    voteAverage: 8.6,
    tmdbGenreIds: [18, 10768],
    tmdbGenres: ["Drama", "Krig & Politik"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 70523,
    title: "Dark",
    originalTitle: "Dark",
    year: "2017",
    mediaType: "tv",
    voteAverage: 8.4,
    tmdbGenreIds: [18, 9648, 10765, 80],
    tmdbGenres: ["Drama", "Mysterium", "Sci-Fi & Fantasy", "Krim"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 67744,
    title: "Mindhunter",
    originalTitle: "Mindhunter",
    year: "2017",
    mediaType: "tv",
    voteAverage: 8.1,
    tmdbGenreIds: [18, 80],
    tmdbGenres: ["Drama", "Krim"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 94605,
    title: "Arcane",
    originalTitle: "Arcane",
    year: "2021",
    mediaType: "tv",
    voteAverage: 8.8,
    tmdbGenreIds: [16, 10765, 10759, 18],
    tmdbGenres: ["Animerat", "Sci-Fi & Fantasy", "Action & Äventyr", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 76479,
    title: "The Boys",
    originalTitle: "The Boys",
    year: "2019",
    mediaType: "tv",
    voteAverage: 8.5,
    tmdbGenreIds: [10765, 10759, 35],
    tmdbGenres: ["Sci-Fi & Fantasy", "Action & Äventyr", "Komedi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 1398,
    title: "The Sopranos",
    originalTitle: "The Sopranos",
    year: "1999",
    mediaType: "tv",
    voteAverage: 8.7,
    tmdbGenreIds: [18, 80],
    tmdbGenres: ["Drama", "Krim"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 1399,
    title: "Game of Thrones",
    originalTitle: "Game of Thrones",
    year: "2011",
    mediaType: "tv",
    voteAverage: 8.4,
    tmdbGenreIds: [10765, 18, 10759],
    tmdbGenres: ["Sci-Fi & Fantasy", "Drama", "Action & Äventyr"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 60059,
    title: "Better Call Saul",
    originalTitle: "Better Call Saul",
    year: "2015",
    mediaType: "tv",
    voteAverage: 8.7,
    tmdbGenreIds: [80, 18],
    tmdbGenres: ["Krim", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 79744,
    title: "The Rookie",
    originalTitle: "The Rookie",
    year: "2018",
    mediaType: "tv",
    posterPath: "/70kTz0OmjjZe7zHvIDrq2iKW7PJ.jpg",
    voteAverage: 8.5,
    tmdbGenreIds: [80, 18],
    tmdbGenres: ["Krim", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY, PROVIDERS.NETFLIX],
    },
  },
  {
    tmdbId: 1426,
    title: "Luther",
    originalTitle: "Luther",
    year: "2010",
    mediaType: "tv",
    posterPath: "/hDxOMX8zzH1FiqKWVBzNaYGBkle.jpg",
    voteAverage: 8.0,
    tmdbGenreIds: [80, 18, 9648],
    tmdbGenres: ["Krim", "Drama", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY, PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 124364,
    title: "FROM",
    originalTitle: "FROM",
    year: "2022",
    mediaType: "tv",
    posterPath: "/pRtJagIxpfODzzb0T0NAvZSzErC.jpg",
    voteAverage: 8.2,
    tmdbGenreIds: [9648, 10765, 18],
    tmdbGenres: ["Mysterium", "Sci-Fi & Fantasy", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY],
    },
  },
  {
    tmdbId: 31934,
    title: "Solsidan",
    originalTitle: "Solsidan",
    year: "2010",
    mediaType: "tv",
    posterPath: "/wX03E7J1G2QhV6eLd5OqT9k1d44.jpg",
    voteAverage: 7.9,
    tmdbGenreIds: [35],
    tmdbGenres: ["Komedi"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY],
    },
  },
  {
    tmdbId: 99966,
    title: "Bäckström",
    originalTitle: "Bäckström",
    year: "2020",
    mediaType: "tv",
    posterPath: "/5V87k3Xv2Z4gK2l1f0Qj6p9y1r4.jpg",
    voteAverage: 7.6,
    tmdbGenreIds: [80, 18],
    tmdbGenres: ["Krim", "Drama"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY],
    },
  },
  {
    tmdbId: 40874,
    title: "Morden i Sandhamn",
    originalTitle: "Morden i Sandhamn",
    year: "2010",
    mediaType: "tv",
    posterPath: "/6yG9H2fK3p4m1Qj5V8r9y1x0b22.jpg",
    voteAverage: 7.4,
    tmdbGenreIds: [80, 18, 9648],
    tmdbGenres: ["Krim", "Drama", "Mysterium"],
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.TV4PLAY],
    },
  },
];

export function normalizeMovieTitle(title?: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupCuratedTmdbMovie(
  title: string,
  year?: string
): TmdbMovieEnrichment {
  const norm = normalizeMovieTitle(title);
  const exact = CURATED_TMDB_MOVIES.find(
    (m) =>
      normalizeMovieTitle(m.title) === norm ||
      normalizeMovieTitle(m.originalTitle) === norm
  );
  if (exact) return exact;

  const partial = CURATED_TMDB_MOVIES.find(
    (m) =>
      (norm.length >= 3 && normalizeMovieTitle(m.title).includes(norm)) ||
      (norm.length >= 3 && norm.includes(normalizeMovieTitle(m.title)))
  );
  if (partial) return partial;

  // Deterministic fallback for unknown titles when live TMDB key isn't active
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) % 100000;
  }
  const voteAverage = 7.2 + (hash % 15) / 10;

  return {
    tmdbId: 900000 + hash,
    title: title.trim(),
    originalTitle: title.trim(),
    year: year || "2021",
    voteAverage: Math.round(voteAverage * 10) / 10,
    swedishProviders: { type: "none", providers: [] },
  };
}

export function searchCuratedTmdbMovies(query: string): TmdbMovieEnrichment[] {
  const norm = normalizeMovieTitle(query);
  if (!norm || norm.length < 2) return [];

  const matches = CURATED_TMDB_MOVIES.filter((m) => {
    const tNorm = normalizeMovieTitle(m.title);
    const oNorm = normalizeMovieTitle(m.originalTitle);
    return tNorm.includes(norm) || oNorm.includes(norm);
  });

  if (matches.length > 0) {
    return matches.slice(0, 5);
  }

  // If the user typed a custom title not in our curated list, return it as a selectable option
  return [lookupCuratedTmdbMovie(query.trim())];
}

export const DEFAULT_WATCHED_MOVIES: WatchedMovie[] = [
  {
    id: "seed-1",
    title: "Prisoners",
    originalTitle: "Prisoners",
    year: "2013",
    rating: 5,
    liked: true,
    tags: [
      "Stämningen / Atmosfären",
      "Karaktärerna & Skådespeleriet",
      "Spänningen & Tempot",
      "Musiken & Fotot",
    ],
    thoughts: "Otroligt mörk och tät stämning hela vägen med briljant skådespeleri.",
    addedAt: "2026-10-18T20:00:00.000Z",
    tmdbId: 146233,
    tmdbRating: 8.1,
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
  {
    id: "seed-2",
    title: "Sagan om ringen: Härskarringen",
    originalTitle: "The Lord of the Rings: The Fellowship of the Ring",
    year: "2001",
    rating: 5,
    liked: true,
    tags: [
      "Världsbygget / Miljön",
      "Stämningen / Atmosfären",
      "Action- & Stridsscenerna",
      "Musiken & Fotot",
    ],
    thoughts: "Oslagbart världsbygge, magisk musik och storslagen äventyrskänsla.",
    addedAt: "2026-10-20T19:30:00.000Z",
    tmdbId: 120,
    tmdbRating: 8.4,
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX, PROVIDERS.PRIME],
    },
  },
  {
    id: "seed-3",
    title: "Knives Out",
    originalTitle: "Knives Out",
    year: "2019",
    rating: 4,
    liked: true,
    tags: [
      "Manuset & Dialogen",
      "Karaktärerna & Skådespeleriet",
      "Twisten / Slutet",
    ],
    thoughts: "Skarp dialog och underhållande pusseldeckare med oväntade vändningar.",
    addedAt: "2026-10-22T21:15:00.000Z",
    tmdbId: 546554,
    tmdbRating: 7.9,
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.NETFLIX, PROVIDERS.VIAPLAY],
    },
  },
];

export const DEFAULT_TASTE_PROFILE =
  "Du dras till filmer med tät, uppslukande atmosfär och ett kompromisslöst hantverk. Oavsett om det gäller mörka psykologiska kriminalgåtor som Prisoners eller storslagna fantasivärldar som Sagan om ringen värdesätter du starkt världsbygge, minnesvärda karaktärer och ett manus som håller spänningen vid liv. Du uppskattar smarta vändningar och visuellt berättande, men bör undvika ytliga actionfilmer utan karaktärsdjup eller förutsägbara komedier.";

export function isMovieExcluded(
  candidate: { title: string; originalTitle?: string },
  watchedMovies: WatchedMovie[],
  watchlist: MovieRecommendation[]
): boolean {
  const candNorm = normalizeMovieTitle(candidate.title);
  const candOrigNorm = normalizeMovieTitle(candidate.originalTitle);

  const checkMatch = (existingTitle?: string, existingOrig?: string) => {
    const tNorm = normalizeMovieTitle(existingTitle);
    const oNorm = normalizeMovieTitle(existingOrig);
    if (candNorm && (candNorm === tNorm || (oNorm && candNorm === oNorm))) {
      return true;
    }
    if (
      candOrigNorm &&
      (candOrigNorm === tNorm || (oNorm && candOrigNorm === oNorm))
    ) {
      return true;
    }
    return false;
  };

  for (const w of watchedMovies) {
    if (checkMatch(w.title, w.originalTitle)) return true;
  }
  for (const wl of watchlist) {
    if (checkMatch(wl.title, wl.originalTitle)) return true;
  }
  return false;
}

export function filterDuplicateRecommendations(
  recommendations: MovieRecommendation[],
  watchedMovies: WatchedMovie[],
  watchlist: MovieRecommendation[]
): MovieRecommendation[] {
  const seen = new Set<string>();
  const result: MovieRecommendation[] = [];

  for (const rec of recommendations) {
    if (
      !rec.isExactPinpointMatch &&
      isMovieExcluded(rec, watchedMovies, watchlist)
    ) {
      continue;
    }
    const normTitle = normalizeMovieTitle(rec.title);
    const normOrig = normalizeMovieTitle(rec.originalTitle);
    if (
      (normTitle && seen.has(normTitle)) ||
      (normOrig && seen.has(normOrig))
    ) {
      continue;
    }
    if (normTitle) seen.add(normTitle);
    if (normOrig) seen.add(normOrig);
    result.push(rec);
  }

  return result;
}

export function calculateTasteStats(watchedMovies: WatchedMovie[]): TasteStats {
  const totalWatched = watchedMovies.length;
  if (totalWatched === 0) {
    return {
      totalWatched: 0,
      averageRating: 0,
      likedCount: 0,
      topTags: [],
    };
  }

  const sumRatings = watchedMovies.reduce((acc, m) => acc + (m.rating || 0), 0);
  const averageRating = Math.round((sumRatings / totalWatched) * 10) / 10;
  const likedCount = watchedMovies.filter((m) => m.liked ?? m.rating >= 3).length;

  const tagCounts = new Map<string, number>();
  for (const movie of watchedMovies) {
    for (const tag of movie.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({
      tag,
      count,
      percentage: Math.round((count / totalWatched) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "sv"));

  return {
    totalWatched,
    averageRating,
    likedCount,
    topTags,
  };
}

export function validateAndParseImportData(jsonString: string): {
  valid: boolean;
  data?: ExportedAppData;
  error?: string;
} {
  if (!jsonString || !jsonString.trim()) {
    return { valid: false, error: "Ingen JSON-data angiven." };
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "Ogiltigt JSON-objekt." };
    }

    if (!Array.isArray(parsed.watchedMovies)) {
      return {
        valid: false,
        error: "Saknar fältet 'watchedMovies' (måste vara en lista).",
      };
    }

    if (!Array.isArray(parsed.watchlist)) {
      return {
        valid: false,
        error: "Saknar fältet 'watchlist' (måste vara en lista).",
      };
    }

    const watchedMovies: WatchedMovie[] = parsed.watchedMovies
      .filter((m: unknown) => Boolean(m && typeof m === "object" && (m as WatchedMovie).title))
      .map((m: Partial<WatchedMovie>, idx: number) => ({
        id: String(m.id || `imported-w-${Date.now()}-${idx}`),
        title: String(m.title).trim(),
        originalTitle: m.originalTitle ? String(m.originalTitle).trim() : undefined,
        year: m.year ? String(m.year).trim() : undefined,
        rating: Math.min(5, Math.max(1, Number(m.rating) || 4)),
        liked: typeof m.liked === "boolean" ? m.liked : (Number(m.rating) || 4) >= 3,
        tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
        thoughts: m.thoughts ? String(m.thoughts) : undefined,
        addedAt: m.addedAt ? String(m.addedAt) : new Date().toISOString(),
        tmdbId: m.tmdbId ? Number(m.tmdbId) : undefined,
        posterPath: m.posterPath ? String(m.posterPath) : undefined,
        tmdbRating: m.tmdbRating ? Number(m.tmdbRating) : undefined,
        swedishProviders: m.swedishProviders,
      }));

    const watchlist: MovieRecommendation[] = parsed.watchlist
      .filter((m: unknown) => Boolean(m && typeof m === "object" && (m as MovieRecommendation).title))
      .map((m: Partial<MovieRecommendation>, idx: number) => ({
        id: String(m.id || `imported-wl-${Date.now()}-${idx}`),
        title: String(m.title).trim(),
        originalTitle: m.originalTitle ? String(m.originalTitle).trim() : undefined,
        year: String(m.year || "Okänt år"),
        runtime: String(m.runtime || "2 tim"),
        matchPercentage: Math.min(99, Math.max(50, Number(m.matchPercentage) || 90)),
        whyYouWillLikeIt: String(
          m.whyYouWillLikeIt || "Sparad i din watchlist."
        ),
        vibeTags: Array.isArray(m.vibeTags) ? m.vibeTags.map(String) : [],
        tmdbId: m.tmdbId ? Number(m.tmdbId) : undefined,
        posterPath: m.posterPath ? String(m.posterPath) : undefined,
        tmdbRating: m.tmdbRating ? Number(m.tmdbRating) : undefined,
        swedishProviders: m.swedishProviders,
      }));

    const tasteProfileSummary =
      typeof parsed.tasteProfileSummary === "string"
        ? parsed.tasteProfileSummary
        : DEFAULT_TASTE_PROFILE;

    return {
      valid: true,
      data: {
        version: Number(parsed.version) || 1,
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        watchedMovies,
        watchlist,
        tasteProfileSummary,
      },
    };
  } catch {
    return {
      valid: false,
      error: "Kunde inte tolka JSON-formatet. Kontrollera att all text är korrekt kopierad.",
    };
  }
}

export function buildRecommendationSystemPrompt(
  watchedMovies: WatchedMovie[],
  watchlist: MovieRecommendation[],
  tasteProfileSummary: string,
  preferences: EveningPreferences,
  previousTitles: string[] = []
): string {
  const excludedTitles = [
    ...watchedMovies.map((m) =>
      m.originalTitle && m.originalTitle !== m.title
        ? `${m.title} (${m.originalTitle})`
        : m.title
    ),
    ...watchlist.map((m) =>
      m.originalTitle && m.originalTitle !== m.title
        ? `${m.title} (${m.originalTitle})`
        : m.title
    ),
  ];

  const lovedMovies = watchedMovies.filter((m) => m.rating >= 4 && m.liked !== false);
  const dislikedMovies = watchedMovies.filter((m) => m.rating <= 2 || m.liked === false);
  const neutralMovies = watchedMovies.filter(
    (m) => m.rating === 3 && m.liked !== false
  );

  const formatMovieLine = (m: WatchedMovie) =>
    `- "${m.title}" (${m.rating}/5 stjärnor, ${
      m.liked ? "Gillade" : "Gillade inte"
    }) | Kvaliteter: [${m.tags.join(", ")}]${
      m.thoughts ? ` | Egna tankar: "${m.thoughts}"` : ""
    }`;

  const watchedSummary =
    watchedMovies.length > 0
      ? [
          lovedMovies.length > 0
            ? `FAVORITER (4–5 stjärnor – använd för att styra stil, ton, berättartempo och djup inom kvällens valda kategorier):\n${lovedMovies
                .map(formatMovieLine)
                .join("\n")}`
            : "",
          neutralMovies.length > 0
            ? `HELT OKEJ (3 stjärnor):\n${neutralMovies
                .map(formatMovieLine)
                .join("\n")}`
            : "",
          dislikedMovies.length > 0
            ? `OGILLADE FILMER (1–2 stjärnor / Gillade inte – UNDVIK filmer med denna ton, kliché eller svaghet även inom kvällens kategorier!):\n${dislikedMovies
                .map(formatMovieLine)
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : "Inga loggade filmer ännu.";

  const hasTvLengthChip = (preferences.moods || []).some((m) =>
    TV_SERIES_LENGTH_SUBCHIPS.includes(m)
  );
  const hasMovieLengthChip = (preferences.moods || []).some((m) =>
    MOVIE_LENGTH_SUBCHIPS.includes(m)
  );
  const mediaPref =
    preferences.mediaType && preferences.mediaType !== "any"
      ? preferences.mediaType
      : hasTvLengthChip && !hasMovieLengthChip
      ? "tv"
      : hasMovieLengthChip && !hasTvLengthChip
      ? "movie"
      : "any";

  const tvLengthRules: string[] = [];
  for (const m of preferences.moods || []) {
    if (m === "Miniserie (1 kort säsong)") {
      tvLengthRules.push(
        `- MINISERIE (100% HÅRT KRAV): Rekommendera ENDAST miniserier / begränsade serier med exakt 1 säsong (ca 3–10 avsnitt totalt, t.ex. Chernobyl, Band of Brothers, Mare of Easttown, The Queen's Gambit). Föreslå ALDRIG serier med flera säsonger!`
      );
    } else if (m === "Kort serie (1–2 säsonger)") {
      tvLengthRules.push(
        `- KORT SERIE (100% HÅRT KRAV): Rekommendera ENDAST serier som har max 1 eller 2 säsonger (t.ex. Mindhunter, Severance, Shōgun, Arcane, Andor). Föreslå ALDRIG långa serier med 3+ säsonger!`
      );
    } else if (m === "Mellanlång serie (3–5 säsonger)") {
      tvLengthRules.push(
        `- MELLANLÅNG SERIE (100% HÅRT KRAV): Rekommendera ENDAST serier som har 3 till 5 säsonger (t.ex. Dark 3 säsonger, Succession 4 säsonger, Breaking Bad 5 säsonger, The Boys, Stranger Things).`
      );
    } else if (m === "Långkörare (6+ säsonger)") {
      tvLengthRules.push(
        `- LÅNGKÖRARE (100% HÅRT KRAV): Rekommendera ENDAST långa serier med minst 6 säsonger att sträckkolla (t.ex. Game of Thrones 8 säsonger, The Sopranos 6 säsonger, Better Call Saul 6 säsonger, Peaky Blinders 6 säsonger, Dexter 8 säsonger, The Shield 7 säsonger, Mad Men 7 säsonger, Suits 9 säsonger, The Office 9 säsonger). Föreslå ALDRIG miniserier eller korta serier på 1–3 säsonger!`
      );
    } else if (m === "Korta avsnitt (ca 20–30 min)") {
      tvLengthRules.push(
        `- KORTA AVSNITT (100% HÅRT KRAV): Rekommendera ENDAST serier där avsnitten är ca 20–35 minuter långa (t.ex. The Bear, Barry, Fleabag, The Office, Silicon Valley).`
      );
    } else if (m === "Avslutad serie (helt färdig)") {
      tvLengthRules.push(
        `- AVSLUTAD SERIE (100% HÅRT KRAV): Rekommendera ENDAST serier som är helt färdigsända och avslutade (inga pågående eller oavslutade serier).`
      );
    }
  }

  const mediaInstruction =
    mediaPref === "movie"
      ? `FORMATKRAV (100% HÅRT KRAV): ENDAST LÅNGFILMER ("mediaType": "movie")!
   - Användaren vill enbart se långfilmer ikväll. Du får INTE föreslå några TV-serier eller miniserier.`
      : mediaPref === "tv"
      ? `FORMATKRAV (100% HÅRT KRAV): ENDAST TV-SERIER / MINISERIER ("mediaType": "tv")!
   - Användaren vill enbart se TV-serier eller miniserier ikväll. Du får INTE föreslå några långfilmer.
   - Ange antal säsonger och ungefärlig avsnittslängd på svenska i fältet "runtime" (t.ex. "1 säsong · 5 avsnitt" eller "6 säsonger · ~55 min/avsnitt").${
     tvLengthRules.length > 0 ? `\n${tvLengthRules.join("\n")}` : ""
   }`
      : `FORMATKRAV (FILM ELLER SERIE – DET SOM PASSAR ABSOLUT BÄST!):
   - Användaren har INTE låst sig vid bara film eller bara serie.
   - Välj de 5 titlar (antingen långfilmer, TV-serier/miniserier eller en mix av båda) som passar ABSOLUT BÄST med kvällens valda kategorier och användarens smakprofil!
   - Sätt "mediaType": "movie" för långfilmer (med speltid t.ex. "2 tim 12 min" i "runtime") och "mediaType": "tv" för TV-serier (med t.ex. "1 säsong · 6 avsnitt" eller "3 säsonger · 50 min/avsnitt" i "runtime").${
     tvLengthRules.length > 0 ? `\n${tvLengthRules.join("\n")}` : ""
   }`;

  return `Du är CineMinde – en elitskribent och expert på både film och TV-serier på svenska. Din uppgift är att rekommendera exakt 5 skräddarsydda titlar för ikväll som en JSON-array.

${mediaInstruction}

TVÅSTEGS-PRINCIPEN – HUR KVÄLLENS VAL OCH SMAKPROFILEN SAMSPELAR:
1. STEG 1 – KVÄLLENS VALDA KATEGORIER ÄR EN HÅRD RAM (100% KRAV):
   - Alla 5 rekommendationer MÅSTE direkt och tydligt tillhöra de kategorier och underkategorier som användaren har bockat i under "KVÄLLENS VALDA KATEGORIER" nedan!
   - Du får ALDRIG föreslå en titel som bryter mot kvällens valda kategorier (t.ex. aldrig föreslå en renodlad mörk deckare när användaren har valt Rymden, Komedi eller Biljakter).

SAMLAD BEDÖMNING AV FLERA VALDA KATEGORIER (STRIKT OCH-LOGIK / INTERSECTION – 100% HÅRT KRAV):
- När användaren har bockat i FLERA kategorier samtidigt (t.ex. två eller fler genrer som "Animerat" och "Action", eller kombination av genre, stämning och handling):
  * Din uppgift är att göra en SAMLAD BEDÖMNING av samtliga ikryssade val. Varje rekommenderad film/serie MÅSTE genuint uppfylla och förena SAMTLIGA valda kategorier i kombination!
  * TOTALFÖRBUD MOT ENSIDIGA TRÄFFAR: Föreslå ALDRIG en titel som bara är det ena och ignorerar det andra. Om användaren t.ex. valt "Animerat" och "Action" får du ALDRIG föreslå en ren animerad barnfilm som 'Trolls' eller 'Sing' som saknar genuin action, och ALDRIG en ren spelfilm som 'John Wick' utan animation!
  * Samtliga 5 titlar MÅSTE ligga i den exakta skärningspunkten där ALLA valda kategorier möts (t.ex. för Animerat + Action: 'Spider-Man: Into the Spider-Verse', 'Spider-Man: Across the Spider-Verse', 'Arcane', 'Superhjältarna (The Incredibles)', 'Prinsessan Mononoke', 'Mästerkatten 2: Den sista önskan', 'Akira', 'Demon Slayer', 'Kung Fu Panda', 'Invincible', 'Cyberpunk: Edgerunners').
  * Förklara i motiveringen ("whyYouWillLikeIt") hur titeln uppfyller och förenar SAMTLIGA valda kategorier.

2. STEG 2 – SMAKPROFILEN OCH SEDDA TITLAR STYR VILKA 5 TITLAR INOM KATEGORIN SOM VÄLJS:
   - Inom ramen för kvällens valda kategorier finns det alltid dussintals starka filmer och serier med helt olika ton, tempo, humor, mörker och stil. Du MÅSTE använda användarens Smakprofil, Favoriter (4–5★) och Ogillade titlar (1–2★) för att välja exakt de 5 titlar *inom de valda kategorierna* som passar just denna person!
   - Hur du anpassar urvalet inom den valda kategorin:
     * Om användarens profil visar kärlek för psykologiskt djup, rå realism, mörk atmosfär och starkt foto: välj de mest nervkittlande, jordnära, vuxna och regimässigt skarpa titlarna som uppfyller kvällens kategorier.
     * Om användarens profil visar kärlek för humor, charm, rapp dialog och lekfull energi: välj de mest underhållande, kvicktänkta och karismatiska titlarna som uppfyller kvällens kategorier.
     * Om användarens profil utvecklas mot t.ex. storslagna koncept, filosofiska vändningar, världsbyggen eller kampsportskoreografi: låt urvalet inom kvällens kategorier tydligt spegla den utvecklingen.
   - HÅRD REGEL FÖR OGILLADE TITLAR (1–2★ / "Gillade inte"): Om användaren har gett lågt betyg till vissa titlar eller skrivit vad hen ogillar i sina tankar (t.ex. överdriven CGI, glättiga skämt, segt tempo eller extremt mörker), MÅSTE du aktivt sålla bort titlar med sådana inslag även om de råkar passa genren.

PRICKSÄKER MATCHNING & HANTERING AV SVÅRA/SMALA KATEGORIER:
- Om de valda kategorierna, underkategorierna och fritexten tillsammans pekar mot en specifik, välkänd film eller serie som stämmer in på SAMTLIGA valda kriterier, MÅSTE den titeln placeras som #1 med "matchPercentage": 99!
- Om användaren väljer en SVÅR, SMAL eller OVÄNTAD kombination av kategorier (t.ex. flera specifika underkategorier från olika flikar samtidigt):
  1. Gräv djupt i film- och seriehistorien (internationella mästerverk, hyllade kultverk, miniserier, moderna indiepärlor och klassiker) för att hitta 5 titlar som genuint kombinerar dessa element.
  2. Om ingen titel i världen har 100% av alla 6–8 valda detaljkategorier samtidigt, välj de 5 titlar som prickar in FLEST av de valda kategorierna i kombination och förklara tydligt i "whyYouWillLikeIt" hur titeln binder ihop dessa val.
  3. TOTALFÖRBUD MOT SLENTRIAN-TITLAR: Du får ALDRIG "ge upp" vid svåra kategorival och falla tillbaka på standardfilmer som Se7en, Zodiac, The Prestige eller Shutter Island om inte användaren uttryckligen har valt just seriemördare/mörk deckare/illusionister!

REGEL FÖR REDAN SEDDA TITLAR OCH WATCHLIST:
Användarens Sedda-lista och Watchlist:
${excludedTitles.length > 0 ? excludedTitles.join(", ") : "Inga exkluderade titlar."}
${previousTitles.length > 0 ? `Undvik även dessa titlar som nyss visades (om inte användaren tydligt söker exakt en av dem): ${previousTitles.join(", ")}` : ""}
- NORMALFALL: Du får ALDRIG rekommendera någon titel från listan över sedda eller watchlist ovan! Sätt "isExactPinpointMatch": false på alla 5 titlar.
- UNDANTAG ENDAST VID DETEKTIV-SÖKNING: Endast om användaren i Fritext beskriver en specifik handling, eller har kombinerat minst 4 mycket smala detaljkategorier som uppenbart pekar på en enda specifik titel som hen försöker komma på namnet på, får du ta med en redan sedd titel som #1 med "isExactPinpointMatch": true. Vid vanliga kategorival (som 1–3 genrer/teman) är det TOTALFÖRBJUDET att föreslå en redan sedd titel!

KVÄLLENS VALDA KATEGORIER & UNDERKATEGORIER ("IKVÄLL" – HÅRD RAM):
- Format (Film / Serie): ${mediaPref === "movie" ? "Endast Långfilm" : mediaPref === "tv" ? "Endast TV-serie / Miniserie" : "Både Film & Serie (välj det som passar kategorierna absolut bäst)"}
- Genrer & Undergenrer: ${(preferences.genres || []).length > 0 ? (preferences.genres || []).join(", ") : "Valfri"}
- Handling & Troper: ${preferences.contents.length > 0 ? preferences.contents.join(", ") : "Valfri"}
- Miljö, Plats & Tidsålder: ${preferences.frameworks.length > 0 ? preferences.frameworks.join(", ") : "Valfri"}
- Stämning, Vibe & Tempo: ${preferences.moods.length > 0 ? preferences.moods.join(", ") : "Valfri"}
- Valda streamingtjänster i Sverige (100% HÅRT KRAV OM ANGIVET): ${
    (preferences.streamingProviders || []).length > 0
      ? `ENDAST TITLAR PÅ ${(preferences.streamingProviders || []).join(", ")}! Varje rekommenderad film/serie MÅSTE finnas tillgänglig i Sverige på minst en av dessa valda tjänster (${(preferences.streamingProviders || []).join(", ")}). Du får INTE föreslå titlar som enbart finns på andra tjänster (t.ex. om användaren bara har valt Netflix får du absolut inte föreslå en titel som bara finns på HBO Max eller Disney+). Om en titel finns på den valda tjänsten OCH samtidigt på andra tjänster (t.ex. både Netflix och Apple TV / Viaplay) är den helt tillåten.`
      : "Alla tjänster tillåtna"
  }
- Fritext / Egna ord: ${preferences.customText.trim() || "Ingen fritext angiven"}

ANVÄNDARENS SEDDA TITLAR (STYR URVALET INOM KVÄLLENS KATEGORIER):
${watchedSummary}

ANVÄNDARENS SMAKPROFIL (STYR TON, STIL OCH KVALITET INOM KVÄLLENS KATEGORIER):
${tasteProfileSummary || "Ingen sammanfattning skapad ännu."}

SVARSFORMAT (MÅSTE VARA EN GILTIG JSON-ARRAY MED EXAKT 5 OBJEKT – INGA TRAILING COMMAS):
Exempel på exakt fältstruktur för varje objekt i JSON-arrayen:
[
  {
    "title": "Titel i Sverige",
    "originalTitle": "Original Title",
    "year": "2019",
    "runtime": "2 tim 10 min (eller '1 säsong · 5 avsnitt' för serier)",
    "mediaType": "movie",
    "matchPercentage": 96,
    "whyYouWillLikeIt": "2–3 meningar på svenska som direkt förklarar BÅDE hur filmen/serien uppfyller kvällens valda kategorier OCH varför just denna titel inom kategorin passar användarens specifika smakprofil och tidigare sedda titlar.",
    "vibeTags": ["Tagg 1", "Tagg 2", "Tagg 3"],
    "isExactPinpointMatch": false
  }
]`;
}

interface CatalogEntry {
  title: string;
  originalTitle: string;
  year: string;
  runtime: string;
  runtimeMinutes: number;
  yearNum: number;
  mediaType?: "movie" | "tv";
  vibeTags: string[];
  matchingMoods: string[];
  matchingContents: string[];
  matchingQualityTags: string[];
  hookSwedish: string;
  connectionReasonSwedish: string;
}

const FALLBACK_CATALOG: CatalogEntry[] = [
  {
    title: "Mad Max: Fury Road",
    originalTitle: "Mad Max: Fury Road",
    year: "2015",
    runtime: "2 tim 0 min",
    runtimeMinutes: 120,
    yearNum: 2015,
    vibeTags: ["Explosiva biljakter", "Non-stop adrenalin", "Episk skala", "Postapokalyps"],
    matchingMoods: ["Episk & storslagen", "Adrenalin & Puls", "Spännande på helspänn", "Högt tempo direkt (ingen seg start)"],
    matchingContents: ["Biljakter & Adrenalin", "Strid, Action & Hämnd", "Välkoreograferad action", "Överlevnad", "Action"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Spänningen & Tempot", "Världsbygget / Miljön", "Musiken & Fotot"],
    hookSwedish: "En skoningslös, högoktanig jakt genom öknen där vrålande fordon, akrobatiska strider och praktiska effekter skapar ren filmmagi.",
    connectionReasonSwedish: "de hisnande biljakterna, den kompromisslösa actionkoreografin och den episka intensiteten från första till sista rutan",
  },
  {
    title: "The Dark Knight",
    originalTitle: "The Dark Knight",
    year: "2008",
    runtime: "2 tim 32 min",
    runtimeMinutes: 152,
    yearNum: 2008,
    vibeTags: ["Episk storstadsaction", "Biljakter & Kupp", "Ikonisk skurk", "Tät spänning"],
    matchingMoods: ["Episk & storslagen", "Mörk & rå", "Spännande på helspänn", "Adrenalin & Puls"],
    matchingContents: ["Biljakter & Adrenalin", "Strid, Action & Hämnd", "Heist / Kupplan", "Katt-och-råtta-lek", "Action"],
    matchingQualityTags: ["Karaktärerna & Skådespeleriet", "Action- & Stridsscenerna", "Spänningen & Tempot", "Musiken & Fotot"],
    hookSwedish: "Christopher Nolans storslagna kraftmätning i Gotham bjuder på ikoniska biljakter, intensiv närkamp och ett psykologiskt rävspel på liv och död.",
    connectionReasonSwedish: "kombinationen av storslagen action, explosiva fordonsjakter och en nervkittlande katt-och-råtta-lek",
  },
  {
    title: "Gladiator",
    originalTitle: "Gladiator",
    year: "2000",
    runtime: "2 tim 35 min",
    runtimeMinutes: 155,
    yearNum: 2000,
    vibeTags: ["Episkt hämnddrama", "Svärdsstrider i arenan", "Ikonisk filmmusik", "Storslagen klassiker"],
    matchingMoods: ["Episk & storslagen", "Spännande på helspänn", "Känslosam & Gripande"],
    matchingContents: ["Svärdsstrider / Närkamp", "Strid, Action & Hämnd", "Hämndberättelse", "Gladiator- / Turnering & Arena", "Äventyr & Krig"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Musiken & Fotot", "Karaktärerna & Skådespeleriet", "Världsbygget / Miljön"],
    hookSwedish: "En förrådd romersk general tvingas kämpa som gladiator i Colosseum för att utkräva hämnd mot en korrupt kejsare.",
    connectionReasonSwedish: "de mäktiga striderna, Hans Zimmers odödliga musik och den episka skalan",
  },
  {
    title: "John Wick",
    originalTitle: "John Wick",
    year: "2014",
    runtime: "1 tim 41 min",
    runtimeMinutes: 101,
    yearNum: 2014,
    vibeTags: ["Knivskarp koreografi", "Biljakter & Gun-fu", "Högt tempo direkt", "Neon-noir"],
    matchingMoods: ["Adrenalin & Puls", "Spännande på helspänn", "Mörk & rå", "Högt tempo direkt (ingen seg start)"],
    matchingContents: ["Välkoreograferad action", "Strid, Action & Hämnd", "Hämndberättelse", "Biljakter & Adrenalin", "Action"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Världsbygget / Miljön", "Spänningen & Tempot"],
    hookSwedish: "En legendarisk yrkesmördare tvingas tillbaka in i en undre värld styrd av guldmynt, hederskodex och skoningslös närkamp.",
    connectionReasonSwedish: "den sylvasst koreograferade actionen, det fascinerande världsbygget och det höga tempot",
  },
  {
    title: "Dune: Part Two",
    originalTitle: "Dune: Part Two",
    year: "2024",
    runtime: "2 tim 46 min",
    runtimeMinutes: 166,
    yearNum: 2024,
    vibeTags: ["Episk sci-fi", "Storslagna strider", "Mästerligt världsbygge", "Visuell triumf"],
    matchingMoods: ["Episk & storslagen", "Spännande på helspänn", "Visuellt mästerverk (Foto & Musik)"],
    matchingContents: ["Djup lore / Världsbygge", "Strid, Action & Hämnd", "Svärdsstrider / Närkamp", "Sci-Fi"],
    matchingQualityTags: ["Världsbygget / Miljön", "Musiken & Fotot", "Action- & Stridsscenerna"],
    hookSwedish: "Paul Atreides förenar sig med fremenerna i ett storslaget fälttåg över ökenplaneten Arrakis för att ta hämnd på konspiratörerna.",
    connectionReasonSwedish: "den monumentala skalan, de spektakulära stridsscenerna och det uppslukande världsbygget",
  },
  {
    title: "Arrival",
    originalTitle: "Arrival",
    year: "2016",
    runtime: "1 tim 56 min",
    runtimeMinutes: 116,
    yearNum: 2016,
    vibeTags: ["Mind-bending sci-fi", "Smart vändning", "Stämningsfullt foto", "Känslomässig tyngd"],
    matchingMoods: ["Mind-bending / Psykologisk", "Spännande på helspänn", "Episk & storslagen", "Känslosam & Gripande"],
    matchingContents: ["Smart plot-twist", "Djup lore / Världsbygge", "Tidsresor / Tidsloop", "Sci-Fi"],
    matchingQualityTags: ["Stämningen / Atmosfären", "Twisten / Slutet", "Musiken & Fotot", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "När tolv gåtfulla farkoster landar på jorden måste en lingvist dechiffrera ett språk som förändrar själva tidsuppfattningen.",
    connectionReasonSwedish: "den gåtfulla atmosfären, den hypnotiska ljudbilden och en twist som vänder upp och ner på allt",
  },
  {
    title: "The Gentlemen",
    originalTitle: "The Gentlemen",
    year: "2019",
    runtime: "1 tim 53 min",
    runtimeMinutes: 113,
    yearNum: 2019,
    vibeTags: ["Skarp dialog", "Brittisk kriminallabyrint", "Högt tempo", "Underhållande vändningar"],
    matchingMoods: ["Lättsam", "Spännande på helspänn", "Mysig & stämningfull"],
    matchingContents: ["Smart plot-twist", "Kriminalgåta / Däckare", "Välkoreograferad action", "Heist / Kupplan", "Komedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet", "Spänningen & Tempot", "Twisten / Slutet"],
    hookSwedish: "När en amerikansk kung i Londons undre värld vill sälja sitt imperium utlöses en kedja av utpressning, kuppförsök och sylvass dialog.",
    connectionReasonSwedish: "det rappa manuset, de färgstarka karaktärerna och de lekfulla vändningarna under resans gång",
  },
  {
    title: "The Northman",
    originalTitle: "The Northman",
    year: "2022",
    runtime: "2 tim 17 min",
    runtimeMinutes: 137,
    yearNum: 2022,
    vibeTags: ["Brutal vikingamyt", "Svärdsstrider", "Mörk folklore", "Hypnotiskt foto"],
    matchingMoods: ["Mörk & rå", "Episk & storslagen"],
    matchingContents: ["Svärdsstrider / Närkamp", "Strid, Action & Hämnd", "Monster / Mörk fantasy", "Djup lore / Världsbygge", "Välkoreograferad action"],
    matchingQualityTags: ["Världsbygget / Miljön", "Action- & Stridsscenerna", "Stämningen / Atmosfären", "Musiken & Fotot"],
    hookSwedish: "Ett rått, mytologiskt hämndepos fyllt av nordisk mystik, tunga svärdsstrider och vulkanisk vrede.",
    connectionReasonSwedish: "det kompromisslösa världsbygget, den fysiska närkampen och den suggestiva atmosfären",
  },
  {
    title: "Shutter Island",
    originalTitle: "Shutter Island",
    year: "2010",
    runtime: "2 tim 18 min",
    runtimeMinutes: 138,
    yearNum: 2010,
    vibeTags: ["Psykologisk gåta", "Stormig ö-miljö", "Chockerande twist", "Gotisk thriller"],
    matchingMoods: ["Spännande på helspänn", "Mind-bending / Psykologisk", "Mörk & rå"],
    matchingContents: ["Smart plot-twist", "Kriminalgåta / Däckare", "Thriller & Spänning"],
    matchingQualityTags: ["Twisten / Slutet", "Stämningen / Atmosfären", "Karaktärerna & Skådespeleriet", "Spänningen & Tempot"],
    hookSwedish: "En federal sheriff utreder ett mystiskt försvinnande på ett isolerat mentalsjukhus medan en orkan stänger in ön.",
    connectionReasonSwedish: "den krypande osäkerheten, den tunga atmosfären och en mästerligt uppbyggd plot-twist",
  },
  {
    title: "The Prestige",
    originalTitle: "The Prestige",
    year: "2006",
    runtime: "2 tim 10 min",
    runtimeMinutes: 130,
    yearNum: 2006,
    vibeTags: ["Genialisk plot-twist", "Sekelskiftesmystik", "Rivalitet", "Psykologiskt pussel"],
    matchingMoods: ["Spännande på helspänn", "Mind-bending / Psykologisk"],
    matchingContents: ["Smart plot-twist", "Psykologiskt rävspel"],
    matchingQualityTags: ["Twisten / Slutet", "Manuset & Dialogen"],
    hookSwedish: "Två rivaliserande illusionister i ett dimhöljt London driver varandra till vansinne i jakten på det ultimata tricket.",
    connectionReasonSwedish: "det briljanta manuspusslet, de oväntade vändningarna och den mörkt eleganta stämningen",
  },
  {
    title: "Se7en",
    originalTitle: "Se7en",
    year: "1995",
    runtime: "2 tim 7 min",
    runtimeMinutes: 127,
    yearNum: 1995,
    vibeTags: ["Becksvart neo-noir", "Kriminalgåta", "Oförglömlig twist", "Regnig atmosfär"],
    matchingMoods: ["Mörk & rå", "Kuslig & Obehaglig"],
    matchingContents: ["Kriminalgåta / Däckare", "Seriemördare med gåtor/mönster"],
    matchingQualityTags: ["Stämningen / Atmosfären", "Twisten / Slutet"],
    hookSwedish: "En kompromisslös och regntung jakt på en metodisk seriemördare där varje ledtråd drar åt snaran.",
    connectionReasonSwedish: "den klaustrofobiska spänningen, det mörka fotot och ett slut som dröjer sig kvar länge",
  },
  {
    title: "Zodiac",
    originalTitle: "Zodiac",
    year: "2007",
    runtime: "2 tim 37 min",
    runtimeMinutes: 157,
    yearNum: 2007,
    mediaType: "movie",
    vibeTags: ["Verklighetsbaserad gåta", "Besatthet", "Tät 70-talskänsla", "Knivskarpt manus"],
    matchingMoods: ["Slow-burn (bygger spänning)"],
    matchingContents: ["Kriminalgåta / Däckare", "Verklighetsbaserat"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "David Finchers mästerliga granskning av jakten på Zodiac-mördaren där pusslet långsamt slukar utredarna.",
    connectionReasonSwedish: "den metodiska spänningen, de välskrivna karaktärerna och den kusligt täta atmosfären",
  },
  {
    title: "Chernobyl",
    originalTitle: "Chernobyl",
    year: "2019",
    runtime: "1 säsong · 5 avsnitt",
    runtimeMinutes: 300,
    yearNum: 2019,
    mediaType: "tv",
    vibeTags: ["Miniserie", "Verklighetsbaserad katastrof", "Klaustrofobisk spänning", "Mästerverk"],
    matchingMoods: ["Mörk & rå", "Spännande på helspänn", "Klaustrofobisk & Instängd", "Intellektuell & Tankeväckande"],
    matchingContents: ["Verklighetsbaserat", "Överlevnad & Kamp mot naturen", "Konspiration & Mörkläggning", "Historia & Epok"],
    matchingQualityTags: ["Stämningen / Atmosfären", "Karaktärerna & Skådespeleriet", "Spänningen & Tempot"],
    hookSwedish: "En skakande och otroligt tät miniserie om kärnkraftsolyckan 1986 och kampen mot både strålningen och statsapparatens lögner.",
    connectionReasonSwedish: "den krypande spänningen, den historiska tyngden och det kompromisslösa skådespeleriet",
  },
  {
    title: "Shōgun",
    originalTitle: "Shōgun",
    year: "2024",
    runtime: "1 säsong · 10 avsnitt",
    runtimeMinutes: 600,
    yearNum: 2024,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Feodala Japan", "Politiskt rävspel", "Episka svärdsstrider"],
    matchingMoods: ["Episk & storslagen", "Spännande på helspänn", "Visuellt mästerverk (Foto & Musik)"],
    matchingContents: ["Strid, Action & Hämnd", "Psykologiskt spel & Manipulation", "Djup lore / Världsbygge", "Äventyr"],
    matchingQualityTags: ["Världsbygget / Miljön", "Karaktärerna & Skådespeleriet", "Action- & Stridsscenerna"],
    hookSwedish: "Ett storslaget drama i 1600-talets Japan där samurajer, politiska intriger och maktkamp kolliderar med total autenticitet.",
    connectionReasonSwedish: "det magnifika världsbygget, det politiska rävspelet och de oförglömliga karaktärerna",
  },
  {
    title: "True Detective",
    originalTitle: "True Detective",
    year: "2014",
    runtime: "4 säsonger · Antologi",
    runtimeMinutes: 480,
    yearNum: 2014,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Mörk sydstatsgotik", "Detektivgåta", "Hypnotisk stämning"],
    matchingMoods: ["Mörk & rå", "Spännande på helspänn", "Långsamt uppbyggd (Slow-burn)"],
    matchingContents: ["Detektiv & Utredning", "Mysterium & Deckare", "Seriemördare & Psykopater"],
    matchingQualityTags: ["Stämningen / Atmosfären", "Karaktärerna & Skådespeleriet", "Manuset & Dialogen"],
    hookSwedish: "Två omaka kriminalare jagar en rituell seriemördare i Louisianas dimmiga träskmarker under 17 års tid.",
    connectionReasonSwedish: "den täta atmosfären, den knivskarpa dialogen och det mörka mysteriet",
  },
  {
    title: "Severance",
    originalTitle: "Severance",
    year: "2022",
    runtime: "2 säsonger · ~50 min/avsnitt",
    runtimeMinutes: 450,
    yearNum: 2022,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Mind-bending sci-fi", "Konspiration", "Knivskarpa twister"],
    matchingMoods: ["Mind-bending / Psykologisk", "Spännande på helspänn", "Skruvad & Absurd"],
    matchingContents: ["Ovväntade vändningar (Plot-twists)", "Konspiration & Mörkläggning", "Sci-Fi"],
    matchingQualityTags: ["Twisten / Slutet", "Manuset & Dialogen", "Världsbygget / Miljön"],
    hookSwedish: "Anställda på ett gåtfullt storföretag har kirurgiskt separerat sina jobbminnen från sina privatliv – tills sanningen börjar läcka.",
    connectionReasonSwedish: "det originella konceptet, den krypande mystiken och en säsongsfinal på helspänn",
  },
  {
    title: "Band of Brothers",
    originalTitle: "Band of Brothers",
    year: "2001",
    runtime: "1 säsong · 10 avsnitt",
    runtimeMinutes: 600,
    yearNum: 2001,
    mediaType: "tv",
    vibeTags: ["Miniserie", "Andra världskriget", "Brödraskap", "Intensiva strider"],
    matchingMoods: ["Episk & storslagen", "Känslosam & Gripande", "Adrenalin & Puls"],
    matchingContents: ["Strid, Action & Hämnd", "Verklighetsbaserat", "Överlevnad & Kamp mot naturen", "Krig"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Karaktärerna & Skådespeleriet", "Spänningen & Tempot"],
    hookSwedish: "Följ Easy Company från fallskärmshoppen under D-dagen till krigsslutet i en av tidernas mest hyllade miniserier.",
    connectionReasonSwedish: "de realistiska stridsscenerna, kamratskapen och den emotionella tyngden",
  },
  {
    title: "Dark",
    originalTitle: "Dark",
    year: "2017",
    runtime: "3 säsonger · 26 avsnitt",
    runtimeMinutes: 540,
    yearNum: 2017,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Tidsresor & Mysterium", "Mörk småstad", "Mind-bending"],
    matchingMoods: ["Mörk & rå", "Mind-bending / Psykologisk", "Spännande på helspänn"],
    matchingContents: ["Tidsresor / Tidsloop", "Smart plot-twist", "Mysterium & Deckare", "Sci-Fi"],
    matchingQualityTags: ["Twisten / Slutet", "Stämningen / Atmosfären", "Manuset & Dialogen"],
    hookSwedish: "När ett barn försvinner i en tysk småstad nystas en svindlande tidsresekonspiration upp som spänner över fyra familjer och tre generationer.",
    connectionReasonSwedish: "det briljanta pusslet, den kusliga stämningen och de oförutsägbara vändningarna",
  },
  {
    title: "Mindhunter",
    originalTitle: "Mindhunter",
    year: "2017",
    runtime: "2 säsonger · 19 avsnitt",
    runtimeMinutes: 520,
    yearNum: 2017,
    mediaType: "tv",
    vibeTags: ["TV-serie", "FBI-profilering", "Psykologisk spänning", "David Fincher"],
    matchingMoods: ["Mörk & rå", "Slow-burn (bygger spänning)", "Mind-bending / Psykologisk"],
    matchingContents: ["Kriminalgåta / Däckare", "Seriemördare med gåtor/mönster", "Verklighetsbaserat"],
    matchingQualityTags: ["Karaktärerna & Skådespeleriet", "Manuset & Dialogen", "Stämningen / Atmosfären"],
    hookSwedish: "Under slutet av 70-talet börjar två FBI-agenter intervjua fängslade seriemördare för att förstå hur de tänker och lösa pågående fall.",
    connectionReasonSwedish: "den knivskarpa dialogen, den psykologiska nerven och det metodiska utredningsarbetet",
  },
  {
    title: "Arcane",
    originalTitle: "Arcane",
    year: "2021",
    runtime: "2 säsonger · 18 avsnitt",
    runtimeMinutes: 400,
    yearNum: 2021,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Storslagen animation", "Steampunk & Magi", "Syskonrivalitet"],
    matchingMoods: ["Episk & storslagen", "Känslosam & Gripande", "Visuellt mästerverk (Foto & Musik)", "Adrenalin & Puls"],
    matchingContents: ["Animerat", "Action", "Animerad action & Sci-Fi", "Vuxenanimation", "Djup lore / Världsbygge", "Välkoreograferad action", "Rivalitet & Besatthet", "Fantasy"],
    matchingQualityTags: ["Världsbygget / Miljön", "Musiken & Fotot", "Action- & Stridsscenerna"],
    hookSwedish: "Två systrar hamnar på motsatta sidor i en explosiv konflikt mellan den glittrande överklasstaden Piltover och den förtryckta underjorden Zaun.",
    connectionReasonSwedish: "det makalösa världsbygget, den visuella briljansen och de laddade karaktärsrelationerna",
  },
  {
    title: "Spider-Man: Into the Spider-Verse",
    originalTitle: "Spider-Man: Into the Spider-Verse",
    year: "2018",
    runtime: "1 tim 57 min",
    runtimeMinutes: 117,
    yearNum: 2018,
    mediaType: "movie",
    vibeTags: ["Stilbildande animation", "Superhjälte", "Multiverse", "Hög puls"],
    matchingMoods: ["Adrenalin & Puls", "Visuellt mästerverk (Foto & Musik)", "Högt tempo direkt (ingen seg start)", "Skrattfest & Charmig"],
    matchingContents: ["Animerat", "Action", "Animerad action & Sci-Fi", "Superhjälte & Serietidning", "Parallella universum / Multiverse", "Välkoreograferad action"],
    matchingQualityTags: ["Musiken & Fotot", "Action- & Stridsscenerna", "Manuset & Dialogen"],
    hookSwedish: "Tonåringen Miles Morales blir biten av en radioaktiv spindel och tvingas samarbeta med alternativa Spider-hjältar från parallella universum för att rädda all existens.",
    connectionReasonSwedish: "den banbrytande visuella animationsstilen, soundtracket och den oemotståndliga blandningen av hjärta och högoktanig action",
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    originalTitle: "Spider-Man: Across the Spider-Verse",
    year: "2023",
    runtime: "2 tim 20 min",
    runtimeMinutes: 140,
    yearNum: 2023,
    mediaType: "movie",
    vibeTags: ["Visuellt mästerverk", "Multiverse-action", "Känslofyllt", "Intensivt"],
    matchingMoods: ["Visuellt mästerverk (Foto & Musik)", "Adrenalin & Puls", "Episk & storslagen", "Spännande på helspänn"],
    matchingContents: ["Animerat", "Action", "Animerad action & Sci-Fi", "Superhjälte & Serietidning", "Parallella universum / Multiverse", "Sci-Fi"],
    matchingQualityTags: ["Musiken & Fotot", "Action- & Stridsscenerna", "Världsbygget / Miljön"],
    hookSwedish: "Miles Morales återförenas med Gwen Stacy och slungas tvärs över multiversum där han ställs mot ett helt sällskap av Spider-hjältar kring vad det verkligen innebär att vara en hjälte.",
    connectionReasonSwedish: "den överväldigande konstnärliga ambitionen, de hisnande actionsekvenserna och det känslomässiga djupet",
  },
  {
    title: "Prinsessan Mononoke",
    originalTitle: "もののけ姫",
    year: "1997",
    runtime: "2 tim 14 min",
    runtimeMinutes: 134,
    yearNum: 1997,
    mediaType: "movie",
    vibeTags: ["Studio Ghibli", "Episkt anime-mästerverk", "Natur vs Människa", "Mytologiskt"],
    matchingMoods: ["Episk & storslagen", "Visuellt mästerverk (Foto & Musik)", "Känslosam & Gripande", "Tänkvärt & Filosofiskt"],
    matchingContents: ["Animerat", "Action", "Studio Ghibli-känsla", "Anime / Japansk animation", "Svärdsstrider / Närkamp", "Episk High Fantasy (Alver & Drakar)", "Fantasy"],
    matchingQualityTags: ["Världsbygget / Miljön", "Musiken & Fotot", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Den unge prinsen Ashitaka drabbas av en dödlig förbannelse och reser västerut där han hamnar mitt i en episk strid mellan skogens uråldriga gudar och en expanderande järnstad.",
    connectionReasonSwedish: "Hayao Miyazakis kompromisslösa mästerverk där makalösa strider, moralisk komplexitet och underskön animation skapar ren filmkonst",
  },
  {
    title: "The Witcher: Nightmare of the Wolf",
    originalTitle: "The Witcher: Nightmare of the Wolf",
    year: "2021",
    runtime: "1 tim 23 min",
    runtimeMinutes: 83,
    yearNum: 2021,
    mediaType: "movie",
    vibeTags: ["Mörk animation", "Monsterjakt", "Witcher-lore", "Rå action"],
    matchingMoods: ["Mörk & rå", "Adrenalin & Puls", "Spännande på helspänn"],
    matchingContents: ["Animerat", "Action", "Vuxenanimation", "Monster / Mörk fantasy", "Svärdsstrider / Närkamp", "Fantasy"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Stämningen / Atmosfären"],
    hookSwedish: "Innan Geralt fanns Vesemir – en ung häxkarl som dödar monster för mynt och ära men tvingas konfrontera demonerna från sitt eget förflutna.",
    connectionReasonSwedish: "de blixtsnabba svärdsstriderna, den vuxna tonen och det mörka monsterfyllda fantasyvärldsbygget",
  },
  {
    title: "Superhjältarna",
    originalTitle: "The Incredibles",
    year: "2004",
    runtime: "1 tim 55 min",
    runtimeMinutes: 115,
    yearNum: 2004,
    mediaType: "movie",
    vibeTags: ["Pixar-klassiker", "Superhjälte-action", "Charmig familjedynamik", "Högt tempo"],
    matchingMoods: ["Skrattfest & Charmig", "Adrenalin & Puls", "Högt tempo direkt (ingen seg start)"],
    matchingContents: ["Animerat", "Action", "Pixar / DreamWorks-stil", "Superhjälte & Serietidning", "Familjefilm för alla åldrar"],
    matchingQualityTags: ["Manuset & Dialogen", "Action- & Stridsscenerna"],
    hookSwedish: "En familj av pensionerade superhjältar tvingas dölja sina krafter men dras in i en hemlig kamp mot ett mekaniskt hot på en avlägsen ö.",
    connectionReasonSwedish: "Brad Birds genialiska regi, den explosiva James Bond-inspirerade superhjälteactionen och humorn",
  },
  {
    title: "Shaun of the Dead",
    originalTitle: "Shaun of the Dead",
    year: "2004",
    runtime: "1 tim 39 min",
    runtimeMinutes: 99,
    yearNum: 2004,
    mediaType: "movie",
    vibeTags: ["Zombiekomedi", "Kultklassiker", "Träffsäker brittisk humor", "Skräck"],
    matchingMoods: ["Skrattfest & Charmig", "Högt tempo direkt (ingen seg start)", "Spännande på helspänn"],
    matchingContents: ["Skräck", "Komedi", "Skräckkomedi (Zombier / Svart humor)", "Överlevnad & Skräck", "Mörk / Svart komedi", "Buddy-komedi (Omaka par)"],
    matchingQualityTags: ["Manuset & Dialogen", "Spänningen & Tempot", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Den håglöse Shaun vaknar upp till en zombieapokalyps i London och måste rädda sin mamma, sin flickvän och nå sitt favoritställe – puben The Winchester.",
    connectionReasonSwedish: "Edgar Wrights klockrena komiska tajming, charmiga brittiska humor och genuint underhållande zombieskräck",
  },
  {
    title: "What We Do in the Shadows",
    originalTitle: "What We Do in the Shadows",
    year: "2014",
    runtime: "1 tim 26 min",
    runtimeMinutes: 86,
    yearNum: 2014,
    mediaType: "movie",
    vibeTags: ["Mockumentär", "Vampyrer", "Svart humor", "Kultfavorit"],
    matchingMoods: ["Skrattfest & Charmig", "Feelgood & Lättsamt", "Mörk humor"],
    matchingContents: ["Skräck", "Komedi", "Skräckkomedi (Zombier / Svart humor)", "Vampyrer & Ockult", "Mörk / Svart komedi", "Satir & Parodi"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Ett filmteam följer fyra vampyrer som delar lägenhet i Wellington och försöker hantera vardagsbestyr som disken samtidigt som de törstar efter människoblod.",
    connectionReasonSwedish: "Taika Waititis briljanta improvisationer, den hysteriska dialogen och den perfekta balansen mellan vampyrmyter och vardagstristess",
  },
  {
    title: "Tucker & Dale vs Evil",
    originalTitle: "Tucker and Dale vs Evil",
    year: "2010",
    runtime: "1 tim 29 min",
    runtimeMinutes: 89,
    yearNum: 2010,
    mediaType: "movie",
    vibeTags: ["Skräckparodi", "Missförståndshumor", "Gore & Skratt", "Kultfilm"],
    matchingMoods: ["Skrattfest & Charmig", "Högt tempo direkt (ingen seg start)"],
    matchingContents: ["Skräck", "Komedi", "Skräckkomedi (Zombier / Svart humor)", "Satir & Parodi", "Mörk / Svart komedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Spänningen & Tempot"],
    hookSwedish: "Två godhjärtade hillbillies åker till sin stuga i skogen där en grupp collegeungdomar misstar dem för brutala mördare med hysteriska konsekvenser.",
    connectionReasonSwedish: "den genialiska idén att vända klassiska slasher-troper uppochner med fantastiskt charmiga huvudkaraktärer",
  },
  {
    title: "Zombieland",
    originalTitle: "Zombieland",
    year: "2009",
    runtime: "1 tim 28 min",
    runtimeMinutes: 88,
    yearNum: 2009,
    mediaType: "movie",
    vibeTags: ["Hög puls", "Zombie-action", "Roliga överlevnadsregler", "Woody Harrelson"],
    matchingMoods: ["Adrenalin & Puls", "Skrattfest & Charmig", "Högt tempo direkt (ingen seg start)"],
    matchingContents: ["Skräck", "Komedi", "Action", "Skräckkomedi (Zombier / Svart humor)", "Action-komedi", "Överlevnad"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Manuset & Dialogen"],
    hookSwedish: "En blyg collegestudent slår sig ihop med en vapengalning och två förslagna systrar för att överleva en zombieapokalyps och hitta Twinkies.",
    connectionReasonSwedish: "det vansinniga tempot, den underbara ensemblen och de uppfinningsrika zombiedråpen",
  },
  {
    title: "The Cabin in the Woods",
    originalTitle: "The Cabin in the Woods",
    year: "2012",
    runtime: "1 tim 35 min",
    runtimeMinutes: 95,
    yearNum: 2012,
    mediaType: "movie",
    vibeTags: ["Meta-skräck", "Mysterium", "Svart komedi", "Plottwist"],
    matchingMoods: ["Spännande på helspänn", "Gåtfullt & Mystiskt", "Skrattfest & Charmig"],
    matchingContents: ["Skräck", "Komedi", "Mysterium & Gåtor", "Skräckkomedi (Zombier / Svart humor)", "Mörk / Svart komedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Spänningen & Tempot"],
    hookSwedish: "Fem vänner åker till en enslig stuga i skogen, omedvetna om att de styrs av tekniker i ett underjordiskt kontrollrum med en mörk hemlighet.",
    connectionReasonSwedish: "den makalösa dekonstruktionen av hela skräckgenren fylld av överraskningar och mörk humor",
  },
  {
    title: "Palm Springs",
    originalTitle: "Palm Springs",
    year: "2020",
    runtime: "1 tim 30 min",
    runtimeMinutes: 90,
    yearNum: 2020,
    mediaType: "movie",
    vibeTags: ["Tidsslinga", "Romantisk komedi", "Existentiell charm", "Feelgood"],
    matchingMoods: ["Skrattfest & Charmig", "Feelgood & Lättsamt", "Tänkvärt & Filosofiskt"],
    matchingContents: ["Sci-Fi", "Komedi", "Tidsslinga / Parallella tidslinjer", "Romantisk komedi (Rom-com)", "Sci-Fi-komedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Nyles fastnar i en ändlös tidsslinga på ett bröllop i Palm Springs och drar av misstag med sig brudens cyniska syster in i evigheten.",
    connectionReasonSwedish: "den underbara kemin mellan Andy Samberg och Cristin Milioti samt en fräsch sci-fi-twist på romcom-formatet",
  },
  {
    title: "Galaxy Quest",
    originalTitle: "Galaxy Quest",
    year: "1999",
    runtime: "1 tim 42 min",
    runtimeMinutes: 102,
    yearNum: 1999,
    mediaType: "movie",
    vibeTags: ["Rymdäventyr", "Sci-Fi-parodi", "Hjärtlig humor", "Kultklassiker"],
    matchingMoods: ["Skrattfest & Charmig", "Feelgood & Lättsamt", "Episk & storslagen"],
    matchingContents: ["Sci-Fi", "Komedi", "Rymdopera & Utomjordingar", "Satir & Parodi", "Sci-Fi-komedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Skådespelarna från en gammal sci-fi-serie misstas av riktiga utomjordingar för att vara sanna rymdhjältar och dras in i ett kosmiskt krig.",
    connectionReasonSwedish: "den kärleksfulla hyllningen till fandom, det fantastiska manuset och den oslagbara skådespelartruppen",
  },
  {
    title: "The Boys",
    originalTitle: "The Boys",
    year: "2019",
    runtime: "4 säsonger · ~60 min/avsnitt",
    runtimeMinutes: 500,
    yearNum: 2019,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Becksvart action-satir", "Korrupta superhjältar", "Högoktanigt"],
    matchingMoods: ["Adrenalin & Puls", "Becksvart & Kompromisslös", "Högt tempo direkt (ingen seg start)", "Mellanlång serie (3–5 säsonger)"],
    matchingContents: ["Hämndberättelse", "Välkoreograferad action", "Konspiration & Hemligheter", "Action"],
    matchingQualityTags: ["Spänningen & Tempot", "Action- & Stridsscenerna", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "En grupp hänsynslösa vigilantes tar upp kampen mot korrupta superhjältar som missbrukar sin makt bakom en polerad fasad.",
    connectionReasonSwedish: "det kompromisslösa tempot, den svarta humorn och den intensiva spänningen",
  },
  {
    title: "The Sopranos",
    originalTitle: "The Sopranos",
    year: "1999",
    runtime: "6 säsonger · 86 avsnitt",
    runtimeMinutes: 5100,
    yearNum: 1999,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Långkörare", "Maffiaimperium", "Karaktärsmästerverk"],
    matchingMoods: ["Mörk & rå", "Långkörare (6+ säsonger)", "Avslutad serie (helt färdig)", "Kritikerrosat mästerverk"],
    matchingContents: ["Maffia & Gangstervärld", "Krim & Mysterium", "Karaktärsstudie & Besatthet", "Drama"],
    matchingQualityTags: ["Karaktärerna & Skådespeleriet", "Manuset & Dialogen", "Stämningen / Atmosfären"],
    hookSwedish: "Maffiabossen Tony Soprano försöker balansera familjelivet i New Jersey med ledarskapet över en hänsynslös kriminell organisation.",
    connectionReasonSwedish: "det oöverträffade karaktärsdjupet, den sylvassa dialogen och sex säsonger av ren briljans",
  },
  {
    title: "Game of Thrones",
    originalTitle: "Game of Thrones",
    year: "2011",
    runtime: "8 säsonger · 73 avsnitt",
    runtimeMinutes: 4300,
    yearNum: 2011,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Långkörare", "Episk fantasy", "Maktkamp & Drakar"],
    matchingMoods: ["Episk & storslagen", "Långkörare (6+ säsonger)", "Avslutad serie (helt färdig)", "Spännande på helspänn"],
    matchingContents: ["Episk High Fantasy (Alver & Drakar)", "Djup lore / Världsbygge", "Svärdsstrider / Närkamp", "Fantasy", "Action"],
    matchingQualityTags: ["Världsbygget / Miljön", "Karaktärerna & Skådespeleriet", "Action- & Stridsscenerna"],
    hookSwedish: "Adelsätter utkämpar ett blodigt och intrigfyllt krig om Järntronen i en episk fantasyvärld där ingen går säker.",
    connectionReasonSwedish: "det enorma världsbygget, det politiska rävspelet och de storslagna fältslagen",
  },
  {
    title: "Better Call Saul",
    originalTitle: "Better Call Saul",
    year: "2015",
    runtime: "6 säsonger · 63 avsnitt",
    runtimeMinutes: 3150,
    yearNum: 2015,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Långkörare", "Knivskarpt drama", "Undre världen"],
    matchingMoods: ["Långkörare (6+ säsonger)", "Avslutad serie (helt färdig)", "Slow-burn (bygger spänning)", "Kritikerrosat mästerverk"],
    matchingContents: ["Kriminalgåta / Däckare", "Psykologiskt rävspel", "Rättssalsdrama", "Krim & Mysterium", "Drama"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet", "Musiken & Fotot"],
    hookSwedish: "Följ den småfiffiga juristen Jimmy McGills gradvisa och gripande förvandling till den skrupelfria kriminella advokaten Saul Goodman.",
    connectionReasonSwedish: "det mästerliga manuset, det visuella berättandet och sex helgjutna säsonger",
  },
  {
    title: "The Rookie",
    originalTitle: "The Rookie",
    year: "2018",
    runtime: "6 säsonger · 108 avsnitt",
    runtimeMinutes: 4600,
    yearNum: 2018,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Långkörare", "Polisdrama", "Högoktanigt"],
    matchingMoods: ["Långkörare (6+ säsonger)", "Hög energi & Underhållande", "Spännande på helspänn"],
    matchingContents: ["Polisutredning & Detektiv", "Krim & Mysterium", "Action", "Drama"],
    matchingQualityTags: ["Karaktärerna & Skådespeleriet", "Spänningen & Tempot"],
    hookSwedish: "45-årige John Nolan lämnar sitt gamla liv och flyttar till Los Angeles för att bli den äldsta rookien i LAPD:s historia.",
    connectionReasonSwedish: "den underhållande mixen av action, charm och polisvardag i högt tempo",
  },
  {
    title: "Luther",
    originalTitle: "Luther",
    year: "2010",
    runtime: "5 säsonger · 20 avsnitt",
    runtimeMinutes: 1100,
    yearNum: 2010,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Mellanlång serie", "Mörk neo-noir", "Seriemördarjakt"],
    matchingMoods: ["Mellanlång serie (3–5 säsonger)", "Mörk & rå", "Intensiv & kompromisslös", "Psykologiskt tät"],
    matchingContents: ["Seriemördarjakt", "Polisutredning & Detektiv", "Psykologiskt rävspel", "Krim & Mysterium"],
    matchingQualityTags: ["Karaktärerna & Skådespeleriet", "Stämningen / Atmosfären", "Spänningen & Tempot"],
    hookSwedish: "Den briljante men plågade poliskommissarien John Luther jagar Londons mest depraverade seriemördare medan hans eget psyke sätts på prov.",
    connectionReasonSwedish: "Idris Elbas magnetiska rollprestation och de becksvarta psykologiska mördarkatterna och råttorna",
  },
  {
    title: "FROM",
    originalTitle: "FROM",
    year: "2022",
    runtime: "3 säsonger · 30 avsnitt",
    runtimeMinutes: 1500,
    yearNum: 2022,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Mellanlång serie", "Klaustrofobisk skräck", "Mysterium"],
    matchingMoods: ["Mellanlång serie (3–5 säsonger)", "Mörk & rå", "Spännande på helspänn", "Gåtfullt & Mystiskt"],
    matchingContents: ["Mysterium & Gåtor", "Överlevnad & Skräck", "Mörk stämning"],
    matchingQualityTags: ["Spänningen & Tempot", "Stämningen / Atmosfären"],
    hookSwedish: "En mardrömslik småstad i USA fångar alla som kör in i den, och när solen går ner kryper skrämmande varelser fram ur skogen.",
    connectionReasonSwedish: "det oerhörda mysteriet och de olidligt spännande cliffhangers i varje avsnitt",
  },
  {
    title: "Solsidan",
    originalTitle: "Solsidan",
    year: "2010",
    runtime: "8 säsonger · 80 avsnitt",
    runtimeMinutes: 1800,
    yearNum: 2010,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Långkörare", "Svensk komedi", "Igenkänningshumor"],
    matchingMoods: ["Långkörare (6+ säsonger)", "Feelgood & Lättsamt", "Skrattfest & Charmig"],
    matchingContents: ["Feelgood-komedi", "Relationsdrama / Romantik", "Komedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Alex och Anna flyttar till idylliska Solsidan i Saltsjöbaden där fasaderna hålls skinande medan vardagskatastroferna avlöser varandra.",
    connectionReasonSwedish: "den träffsäkra humorn, de älskade karaktärerna och svensk situationskomik i absolut toppklass",
  },
];

export function generateSmartFallbackRecommendations(
  watchedMovies: WatchedMovie[],
  watchlist: MovieRecommendation[],
  preferences: EveningPreferences
): MovieRecommendation[] {
  const stats = calculateTasteStats(watchedMovies);
  const topUserTags = new Set(stats.topTags.slice(0, 4).map((t) => t.tag));

  const referenceMovie =
    watchedMovies.find((m) => m.rating >= 4) || watchedMovies[0];
  const secondReferenceMovie =
    watchedMovies.length > 1
      ? watchedMovies.find((m) => m.id !== referenceMovie?.id && m.rating >= 4) ||
        watchedMovies[1]
      : undefined;

  const customLower = preferences.customText.toLowerCase();
  const mediaPref = preferences.mediaType || "any";
  const selectedServices = Array.isArray(preferences.streamingProviders)
    ? preferences.streamingProviders
    : [];

  const baseCandidates = FALLBACK_CATALOG.filter((entry) => {
    if (isMovieExcluded(entry, watchedMovies, watchlist)) return false;
    const entryType = entry.mediaType || "movie";
    if (mediaPref === "movie" && entryType !== "movie") return false;
    if (mediaPref === "tv" && entryType !== "tv") return false;
    return true;
  });

  const serviceFilteredCandidates =
    selectedServices.length > 0
      ? baseCandidates.filter((entry) => {
          const tmdbMeta = lookupCuratedTmdbMovie(entry.title, entry.year);
          const match = movieMatchesStreamingProviders(
            tmdbMeta.swedishProviders,
            selectedServices
          );
          return match.matchesFlatrate || match.matchesRentBuy;
        })
      : baseCandidates;

  const activePool =
    selectedServices.length > 0
      ? serviceFilteredCandidates
      : baseCandidates;

  const scored = activePool.map((entry) => {
    let score = 86;
    let matchedCategoryCount = 0;
    const entrySearchText = [
      ...entry.matchingMoods,
      ...entry.matchingContents,
      ...entry.vibeTags,
      entry.hookSwedish,
    ]
      .join(" ")
      .toLowerCase();

    const matchesOption = (opt: string, exactList: string[]) => {
      if (exactList.includes(opt)) return true;
      const words = opt
        .toLowerCase()
        .replace(/[^a-zåäö0-9\s]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !["eller", "under", "kring", "film"].includes(w));
      return words.some((w) => entrySearchText.includes(w.slice(0, 5)));
    };

    let matchedGenreCount = 0;
    let matchedMoodCount = 0;
    let matchedContentCount = 0;

    for (const mood of preferences.moods) {
      if (matchesOption(mood, entry.matchingMoods)) {
        score += 6;
        matchedMoodCount++;
        matchedCategoryCount++;
      }
    }
    for (const genre of preferences.genres || []) {
      if (matchesOption(genre, entry.matchingContents)) {
        score += 8;
        matchedGenreCount++;
        matchedCategoryCount++;
      }
    }
    for (const content of preferences.contents) {
      if (matchesOption(content, entry.matchingContents)) {
        score += 6;
        matchedContentCount++;
        matchedCategoryCount++;
      }
    }

    const totalChosenGenres = (preferences.genres || []).length;
    if (totalChosenGenres >= 2) {
      if (matchedGenreCount === totalChosenGenres) {
        // Combined match: all chosen genres matched!
        score += 16;
      } else if (matchedGenreCount > 0 && matchedGenreCount < totalChosenGenres) {
        // Penalize partial match that ignores one of the user's primary genres
        score -= 20;
      }
    }

    const totalChosenCategories =
      preferences.moods.length +
      (preferences.genres || []).length +
      preferences.contents.length;

    if (totalChosenCategories === 0 || matchedCategoryCount > 0) {
      for (const qTag of entry.matchingQualityTags) {
        if (topUserTags.has(qTag)) score += 1;
      }
    }

    if (
      preferences.frameworks.includes("Max 2 timmar") &&
      entry.runtimeMinutes <= 120
    ) {
      score += 4;
    }
    if (
      preferences.frameworks.includes("2+ timmar (Långfilm)") &&
      entry.runtimeMinutes >= 120
    ) {
      score += 4;
    }
    if (
      preferences.frameworks.includes("Nyare än 2015") &&
      entry.yearNum > 2015
    ) {
      score += 4;
    }
    if (
      preferences.frameworks.includes("Klassiker") &&
      entry.yearNum <= 2010
    ) {
      score += 4;
    }
    if (
      customLower &&
      (customLower.includes("witcher") ||
        customLower.includes("fantasy") ||
        customLower.includes("svärd") ||
        customLower.includes("monster"))
    ) {
      if (
        entry.matchingContents.includes("Monster / Mörk fantasy") ||
        entry.matchingContents.includes("Svärdsstrider / Närkamp")
      ) {
        score += 6;
      }
    }
    if (
      customLower &&
      (customLower.includes("thriller") ||
        customLower.includes("mörk") ||
        customLower.includes("gåta") ||
        customLower.includes("deckare"))
    ) {
      if (
        entry.matchingContents.includes("Kriminalgåta / Däckare") ||
        entry.matchingMoods.includes("Mörk & rå")
      ) {
        score += 6;
      }
    }

    const matchPercentage = Math.min(99, Math.max(85, score));

    const chosenChips = [
      ...preferences.moods,
      ...(preferences.genres || []),
      ...preferences.contents,
      ...preferences.frameworks,
    ];
    const chipPhrase =
      chosenChips.length > 0
        ? `Ditt val av ${chosenChips.slice(0, 2).join(" och ").toLowerCase()} gör denna till en fullträff ikväll.`
        : `En klockren matchning för din smakprofil ikväll.`;

    const refPhrase = referenceMovie
      ? `Eftersom du gav högt betyg till "${referenceMovie.title}"${
          secondReferenceMovie ? ` och "${secondReferenceMovie.title}"` : ""
        } (där du särskilt lyfte fram ${(
          referenceMovie.tags.slice(0, 2).join(" och ") || "atmosfären"
        ).toLowerCase()}) kommer du älska ${entry.connectionReasonSwedish}.`
      : `Du kommer att uppskatta ${entry.connectionReasonSwedish}.`;

    const whyYouWillLikeIt = `${entry.hookSwedish} ${chipPhrase} ${refPhrase}`;
    const tmdbMeta = lookupCuratedTmdbMovie(entry.title, entry.year);

    return {
      id: `rec-${normalizeMovieTitle(entry.title)}-${Date.now()}`,
      title: entry.title,
      originalTitle: entry.originalTitle,
      year: entry.year,
      runtime: entry.runtime,
      mediaType: entry.mediaType || "movie",
      matchPercentage,
      whyYouWillLikeIt,
      vibeTags: entry.vibeTags,
      tmdbId: tmdbMeta.tmdbId,
      posterPath: tmdbMeta.posterPath,
      tmdbRating: tmdbMeta.voteAverage,
      swedishProviders: tmdbMeta.swedishProviders,
      tmdbGenreIds: tmdbMeta.tmdbGenreIds,
      tmdbGenres: tmdbMeta.tmdbGenres,
    };
  });

  scored.sort((a, b) => b.matchPercentage - a.matchPercentage);
  const tmdbVerified = filterAndVerifyMoviesByTmdbCategories(scored, preferences);
  return tmdbVerified.slice(0, 5);
}

export function generateSmartFallbackTasteProfile(
  watchedMovies: WatchedMovie[]
): string {
  if (watchedMovies.length === 0) {
    return "Du har inte loggat några sedda filmer ännu. Lägg till några favoriter under fliken 'Sedda' och bocka i vad du gillade bäst med dem, så bygger CineMinde upp din personliga smakprofil!";
  }

  const stats = calculateTasteStats(watchedMovies);
  const topTagNames = stats.topTags.slice(0, 3).map((t) => t.tag.toLowerCase());
  const favMovies = watchedMovies
    .filter((m) => m.rating >= 4 && m.liked !== false)
    .slice(0, 4)
    .map((m) => m.title);
  const dislikedMovies = watchedMovies
    .filter((m) => m.rating <= 2 || m.liked === false)
    .slice(0, 2)
    .map((m) => m.title);

  const favText =
    favMovies.length > 0
      ? `Dina högst betygsatta filmer som ${favMovies.join(", ")} visar tydligt vilken typ av berättande, ton och hantverk som engagerar dig mest.`
      : `Utifrån dina ${stats.totalWatched} loggade filmer syns ett tydligt mönster i vad som engagerar dig.`;

  const tagText =
    topTagNames.length > 0
      ? `Du värdesätter framför allt ${topTagNames.join(", ")}, vilket går som en röd tråd genom dina favoriter.`
      : `Du uppskattar välregisserade berättelser med genomtänkt tempo och stark karaktärsnärvaro.`;

  const dislikeText =
    dislikedMovies.length > 0
      ? `Samtidigt visar dina lägre betyg på filmer som ${dislikedMovies.join(" och ")} vad du föredrar att undvika när kvällens film väljs.`
      : `Din profil hjälper CineMinde att lyfta fram filmer som matchar din kvalitetsnivå oavsett vilken genre eller stämning du väljer för kvällen.`;

  return `${favText} ${tagText} ${dislikeText}`;
}
