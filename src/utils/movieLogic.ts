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
  seasonCount?: number;
  runtimeMinutes?: number;
  episodeRuntimeMinutes?: number;
  tvStatus?: string;
  originalLanguage?: string;
  ageRating?: string;
}

export interface SeasonRating {
  seasonNumber: number; // 1, 2, 3...
  rating: number; // 1 to 5
  liked: boolean; // true = Gillade, false = Gillade inte
  tags: string[]; // Kvalitetstaggar för säsongen
  thoughts?: string; // Egna tankar om säsongen
}

export interface WatchedMovie {
  id: string;
  title: string;
  originalTitle?: string;
  year?: string;
  mediaType?: "movie" | "tv";
  rating: number; // 1 to 5 (helhetsbetyg eller genomsnitt)
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
  seasonCount?: number;
  seasons?: SeasonRating[]; // Säsongsbetyg om serien bedömts per säsong
  ageRating?: string;
}

export interface MovieRecommendation {
  id: string;
  title: string;
  originalTitle?: string;
  year: string;
  runtime: string;
  runtimeMinutes?: number;
  mediaType?: "movie" | "tv";
  seasonCount?: number;
  episodeRuntimeMinutes?: number;
  tvStatus?: string;
  originalLanguage?: string;
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
  ageRating?: string;
}

export interface ExpandableChipGroup {
  id: string;
  label: string;
  subchips: readonly string[];
}

export interface MovieSteeringSliders {
  mood: number; // -2 (Mycket varmare/lättare) .. 0 (Samma) .. +2 (Mycket mörkare/tyngre)
  pace: number; // -2 (Mycket lugnare/mer atmosfär) .. 0 (Samma) .. +2 (Mycket snabbare/mer fart)
  depth: number; // -2 (Mycket enklare/koppla av) .. 0 (Samma) .. +2 (Mycket djupare/mer tankeväckande)
  tone: number; // -2 (Mycket mer humor/lekfullt) .. 0 (Samma) .. +2 (Mycket mer allvar/spänning)
}

export interface MovieSteeringContext {
  anchorMovie: {
    title: string;
    originalTitle?: string;
    year?: string;
    runtime?: string;
    mediaType?: "movie" | "tv";
    vibeTags?: string[];
    tmdbGenres?: string[];
  };
  sliders: MovieSteeringSliders;
  quickTweaks: string[];
  note?: string;
}

export const DEFAULT_STEERING_SLIDERS: MovieSteeringSliders = {
  mood: 0,
  pace: 0,
  depth: 0,
  tone: 0,
};

export const STEERING_QUICK_TWEAKS = [
  "Kortare",
  "Nyare",
  "Dold pärla",
  "Starkare twist",
  "Mer känslosam",
] as const;

export function describeSteeringAdjustments(
  steering?: MovieSteeringContext | null
): string[] {
  if (!steering) return [];
  const parts: string[] = [];
  const { mood, pace, depth, tone } = steering.sliders;

  if (mood <= -2) parts.push("mycket varmare och lättare i tonen");
  else if (mood === -1) parts.push("lite varmare och lättare");
  else if (mood === 1) parts.push("lite mörkare och tyngre");
  else if (mood >= 2) parts.push("mycket mörkare, råare och tyngre");

  if (pace <= -2) parts.push("mycket lugnare och mer atmosfäriskt tempo");
  else if (pace === -1) parts.push("lite lugnare och mer stämningsfullt");
  else if (pace === 1) parts.push("lite snabbare tempo och mer driv");
  else if (pace >= 2) parts.push("mycket högre tempo och mer action/fart direkt");

  if (depth <= -2) parts.push("mycket enklare och mer lättsmält för att koppla av");
  else if (depth === -1) parts.push("lite mer lättillgänglig och avslappnad");
  else if (depth === 1) parts.push("lite djupare och mer tankeväckande");
  else if (depth >= 2) parts.push("mycket djupare, smartare och mer tankeväckande");

  if (tone <= -2) parts.push("mycket mer humor och lekfullhet");
  else if (tone === -1) parts.push("lite mer humor och charm");
  else if (tone === 1) parts.push("lite mer allvar och spänning");
  else if (tone >= 2) parts.push("mycket mer allvar, nerv och spänning");

  for (const tweak of steering.quickTweaks || []) {
    if (tweak.trim()) parts.push(tweak.trim());
  }

  if (steering.note && steering.note.trim()) {
    parts.push(steering.note.trim());
  }

  return parts;
}

export function buildSteeringPromptLines(
  steering?: MovieSteeringContext | null
): string[] {
  if (!steering) return [];
  const lines: string[] = [];
  const { mood, pace, depth, tone } = steering.sliders;
  const anchorRuntime = steering.anchorMovie?.runtime;
  const anchorYear = steering.anchorMovie?.year;

  if (mood <= -2) lines.push("KÄNSLA: Mycket varmare, ljusare och lättare i tonen än referensfilmen.");
  else if (mood === -1) lines.push("KÄNSLA: Lite varmare och lättare än referensfilmen.");
  else if (mood === 1) lines.push("KÄNSLA: Lite mörkare och tyngre än referensfilmen.");
  else if (mood >= 2) lines.push("KÄNSLA: Mycket mörkare, råare och tyngre än referensfilmen.");

  if (pace <= -2) lines.push("TEMPO: Mycket lugnare och mer atmosfäriskt tempo än referensfilmen.");
  else if (pace === -1) lines.push("TEMPO: Lite lugnare och mer stämningsfullt.");
  else if (pace === 1) lines.push("TEMPO: Lite snabbare tempo och mer driv.");
  else if (pace >= 2) lines.push("TEMPO: Mycket högre tempo och mer action/fart direkt från start.");

  if (depth <= -2) lines.push("HJÄRNKAPACITET: Mycket enklare och mer lättsmält för att koppla av.");
  else if (depth === -1) lines.push("HJÄRNKAPACITET: Lite mer lättillgänglig och avslappnad.");
  else if (depth === 1) lines.push("HJÄRNKAPACITET: Lite djupare och mer tankeväckande.");
  else if (depth >= 2) lines.push("HJÄRNKAPACITET: Mycket djupare, smartare och mer tankeväckande.");

  if (tone <= -2) lines.push("TON: Mycket mer humor, charm och lekfullhet.");
  else if (tone === -1) lines.push("TON: Lite mer humor och charm.");
  else if (tone === 1) lines.push("TON: Lite mer allvar och spänning.");
  else if (tone >= 2) lines.push("TON: Mycket mer allvar, nerv och spänning.");

  for (const rawTweak of steering.quickTweaks || []) {
    const tweak = rawTweak.trim();
    if (!tweak) continue;
    if (tweak === "Kortare") {
      lines.push(
        anchorRuntime
          ? `KORTARE ÄN REFERENSFILMEN (100% HÅRT KRAV): Referensfilmen har speltiden ${anchorRuntime}. Samtliga 5 förslag MÅSTE vara märkbart kortare än ${anchorRuntime} (för serier: färre säsonger eller kortare total speltid). Föreslå ALDRIG en titel som är lika lång eller längre än ${anchorRuntime}!`
          : "KORTARE ÄN REFERENSFILMEN (100% HÅRT KRAV): Samtliga 5 förslag MÅSTE ha en märkbart kortare speltid än referensfilmen (för serier: färre säsonger eller kortare total speltid). Föreslå ALDRIG en titel som är lika lång eller längre än referensfilmen!"
      );
    } else if (tweak === "Nyare") {
      const anchorYearNum = Number(anchorYear);
      const minSuggestedYear =
        !Number.isNaN(anchorYearNum) && anchorYearNum >= 2015
          ? Math.max(2018, anchorYearNum)
          : 2018;
      lines.push(
        `NYARE TITLAR (100% HÅRT KRAV): Samtliga 5 förslag MÅSTE vara nya/moderna – utgivna från ${minSuggestedYear} eller senare. Föreslå ALDRIG äldre filmer från 90- eller 00-talet!`
      );
    } else if (tweak === "Dold pärla") {
      lines.push(
        "DOLDA PÄRLOR (100% HÅRT KRAV): Undvik uppenbara mainstream-blockbusters och de mest kända standardklassikerna. Välj hyllade men mindre kända indiefilmer, internationella mästerverk eller underskattade guldkorn!"
      );
    } else if (tweak === "Starkare twist") {
      lines.push(
        "STARKARE TWIST (100% HÅRT KRAV): Samtliga 5 förslag MÅSTE ha en tydlig, minnesvärd vändning, överraskande avslöjande eller smart pusselstruktur."
      );
    } else if (tweak === "Mer känslosam") {
      lines.push(
        "MER KÄNSLOSAM (100% HÅRT KRAV): Samtliga 5 förslag MÅSTE ha starkt hjärta, emotionellt djup och berörande mänskliga relationer."
      );
    } else {
      lines.push(`EXTRA KRAV: ${tweak}`);
    }
  }

  if (steering.note && steering.note.trim()) {
    lines.push(`ANVÄNDARENS EGNA NOTERING (HÅRT KRAV): "${steering.note.trim()}"`);
  }

  return lines;
}

export interface EveningPreferences {
  moods: string[];
  genres?: string[];
  contents: string[];
  frameworks: string[];
  customText: string;
  streamingProviders?: string[];
  mediaType?: "any" | "movie" | "tv";
  steering?: MovieSteeringContext | null;
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

/**
 * Normalizes Swedish or international movie/TV age certifications into
 * clean Swedish age rating labels: "Btl", "7+", "11+", "15+", or "18+".
 */
export function normalizeSwedishAgeRating(
  raw?: string | null
): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned || cleaned === "NR" || cleaned === "UNRATED" || cleaned === "N/A") {
    return undefined;
  }

  // Exact or Swedish formats
  if (
    cleaned === "BTL" ||
    cleaned === "BARNTILLÅTEN" ||
    cleaned === "ALLA" ||
    cleaned === "ALLA ÅLDRAR" ||
    cleaned === "0" ||
    cleaned === "0+" ||
    cleaned === "A" ||
    cleaned === "G" ||
    cleaned === "U" ||
    cleaned === "TV-G" ||
    cleaned === "TV-Y" ||
    cleaned === "S" ||
    cleaned === "AL"
  ) {
    return "Btl";
  }

  if (
    cleaned === "7" ||
    cleaned === "7+" ||
    cleaned === "7 ÅR" ||
    cleaned === "FRÅN 7 ÅR" ||
    cleaned === "6" ||
    cleaned === "6+" ||
    cleaned === "PG" ||
    cleaned === "TV-Y7" ||
    cleaned === "TV-Y7-FV" ||
    cleaned === "TV-PG" ||
    cleaned === "K-7"
  ) {
    return "7+";
  }

  if (
    cleaned === "11" ||
    cleaned === "11+" ||
    cleaned === "11 ÅR" ||
    cleaned === "FRÅN 11 ÅR" ||
    cleaned === "9" ||
    cleaned === "10" ||
    cleaned === "12" ||
    cleaned === "12+" ||
    cleaned === "12A" ||
    cleaned === "13" ||
    cleaned === "13+" ||
    cleaned === "PG-13" ||
    cleaned === "TV-14" ||
    cleaned === "14" ||
    cleaned === "14+" ||
    cleaned === "K-12"
  ) {
    return "11+";
  }

  if (
    cleaned === "15" ||
    cleaned === "15+" ||
    cleaned === "15 ÅR" ||
    cleaned === "FRÅN 15 ÅR" ||
    cleaned === "16" ||
    cleaned === "16+" ||
    cleaned === "R" ||
    cleaned === "TV-MA" ||
    cleaned === "MA15+" ||
    cleaned === "K-16"
  ) {
    return "15+";
  }

  if (
    cleaned === "18" ||
    cleaned === "18+" ||
    cleaned === "18 ÅR" ||
    cleaned === "NC-17" ||
    cleaned === "X" ||
    cleaned === "K-18"
  ) {
    return "18+";
  }

  // Extract numeric age fallback (e.g. "Från 11 år" or "FSK 12")
  const numMatch = cleaned.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    const age = Number(numMatch[1]);
    if (age <= 5) return "Btl";
    if (age <= 9) return "7+";
    if (age <= 14) return "11+";
    if (age <= 17) return "15+";
    return "18+";
  }

  return undefined;
}

const AGE_RATING_COUNTRY_PRIORITY = ["SE", "NO", "DK", "FI", "GB", "US", "DE"];

export function parseTmdbMovieAgeRating(
  releaseDatesData: unknown
): string | undefined {
  if (!releaseDatesData || typeof releaseDatesData !== "object") {
    return undefined;
  }
  const results = (releaseDatesData as { results?: unknown }).results;
  if (!Array.isArray(results)) return undefined;

  const byCountry = new Map<string, Array<{ certification?: string }>>();
  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const iso = String(
      (entry as { iso_3166_1?: string }).iso_3166_1 || ""
    ).toUpperCase();
    const dates = (entry as { release_dates?: unknown }).release_dates;
    if (iso && Array.isArray(dates)) {
      byCountry.set(iso, dates as Array<{ certification?: string }>);
    }
  }

  for (const country of AGE_RATING_COUNTRY_PRIORITY) {
    const dates = byCountry.get(country);
    if (!dates) continue;
    for (const d of dates) {
      const normalized = normalizeSwedishAgeRating(d?.certification);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

export function parseTmdbTvAgeRating(
  contentRatingsData: unknown
): string | undefined {
  if (!contentRatingsData || typeof contentRatingsData !== "object") {
    return undefined;
  }
  const results = (contentRatingsData as { results?: unknown }).results;
  if (!Array.isArray(results)) return undefined;

  const byCountry = new Map<string, string>();
  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const iso = String(
      (entry as { iso_3166_1?: string }).iso_3166_1 || ""
    ).toUpperCase();
    const rating = String((entry as { rating?: string }).rating || "").trim();
    if (iso && rating) {
      byCountry.set(iso, rating);
    }
  }

  for (const country of AGE_RATING_COUNTRY_PRIORITY) {
    const raw = byCountry.get(country);
    if (!raw) continue;
    const normalized = normalizeSwedishAgeRating(raw);
    if (normalized) return normalized;
  }
  return undefined;
}

export function inferAgeRatingFromGenres(tmdbGenreIds?: number[]): string {
  const ids = new Set((tmdbGenreIds || []).map(Number));
  if (ids.has(27)) return "15+"; // Skräck
  if (ids.has(10752) || ids.has(10768)) return "15+"; // Krig
  if (ids.has(80) && (ids.has(53) || ids.has(28))) return "15+"; // Krim + Thriller/Action
  if (ids.has(10762)) return "Btl"; // Barn
  if (ids.has(10751)) return ids.has(12) || ids.has(14) || ids.has(28) ? "7+" : "Btl"; // Familj
  if (ids.has(16) && !ids.has(28) && !ids.has(53) && !ids.has(80)) return "7+"; // Animerat
  if (ids.has(53) || ids.has(80)) return "15+"; // Thriller / Krim
  if (ids.has(28) || ids.has(10759) || ids.has(878) || ids.has(10765)) return "11+"; // Action / Sci-Fi
  if (ids.has(35) || ids.has(10749) || ids.has(99) || ids.has(10402)) return "7+"; // Komedi / Romantik / Dokumentär
  return "11+";
}

export const KNOWN_SERIES_SEASON_COUNTS: Record<string, number> = {
  // Miniserier / 1 säsong
  chernobyl: 1,
  shogun: 1,
  "shōgun": 1,
  "band of brothers": 1,
  "mare of easttown": 1,
  "the queen's gambit": 1,
  "queens gambit": 1,
  kalifat: 1,
  "cyberpunk: edgerunners": 1,
  "cyberpunk edgerunners": 1,
  watchmen: 1,
  "station eleven": 1,
  dopesick: 1,
  "sharp objects": 1,
  "when they see us": 1,
  "the night of": 1,
  unbelievable: 1,
  maid: 1,
  beef: 1,
  ripley: 1,
  "baby reindeer": 1,
  "normal people": 1,
  "the last of us": 1,
  fallout: 1,
  andor: 1,

  // 2 säsonger
  severance: 2,
  arcane: 2,
  mindhunter: 2,
  "snabba cash": 2,
  "house of the dragon": 2,
  "the white lotus": 2,
  "white lotus": 2,
  fleabag: 2,
  "squid game": 2,
  silo: 2,
  "good omens": 2,
  "the flight attendant": 2,
  loki: 2,

  // 3 säsonger
  dark: 3,
  "the bear": 3,
  from: 3,
  backstrom: 3,
  "bäckström": 3,
  "ted lasso": 3,
  narcos: 3,
  "narcos: mexico": 3,
  "narcos mexico": 3,
  "the mandalorian": 3,
  mandalorian: 3,
  "twin peaks": 3,
  deadwood: 3,

  // 4 säsonger
  succession: 4,
  "the boys": 4,
  "true detective": 4,
  "stranger things": 4,
  bron: 4,
  broen: 4,
  "bron / broen": 4,
  ozark: 4,
  barry: 4,
  sherlock: 4,
  "slow horses": 4,
  "jack ryan": 4,

  // 5 säsonger
  "breaking bad": 5,
  "the wire": 5,
  fargo: 5,
  luther: 5,
  yellowstone: 5,
  "boardwalk empire": 5,
  "prison break": 5,
  gomorrah: 5,
  gomorra: 5,
  "person of interest": 5,
  gotham: 5,

  // 6 säsonger
  "the sopranos": 6,
  sopranos: 6,
  "better call saul": 6,
  "peaky blinders": 6,
  "the crown": 6,
  lost: 6,
  vikings: 6,
  "silicon valley": 6,
  "downton abbey": 6,
  community: 6,
  "schitt's creek": 6,
  "schitts creek": 6,
  justified: 6,
  "the americans": 6,
  "black mirror": 6,

  // 7 säsonger
  "the shield": 7,
  "mad men": 7,
  "the rookie": 7,
  "sons of anarchy": 7,
  "parks and recreation": 7,
  "billions": 7,
  "workin' moms": 7,

  // 8 säsonger
  "game of thrones": 8,
  dexter: 8,
  solsidan: 8,
  homeland: 8,
  "brooklyn nine-nine": 8,
  "brooklyn 99": 8,
  house: 8,
  "house m.d.": 8,
  arrow: 8,

  // 9 säsonger
  suits: 9,
  "the office": 9,
  seinfeld: 9,
  "peep show": 9,

  // 10+ säsonger
  friends: 10,
  "morden i sandhamn": 10,
  "modern family": 11,
  "the walking dead": 11,
  "curb your enthusiasm": 12,
  "the big bang theory": 12,
  supernatural: 15,
  "it's always sunny in philadelphia": 16,
  "its always sunny in philadelphia": 16,
  "greys anatomy": 20,
  "grey's anatomy": 20,
  "the simpsons": 36,
  "south park": 26,
};

export function getSeriesSeasonCount(title: string): number {
  const norm = normalizeMovieTitle(title);
  if (KNOWN_SERIES_SEASON_COUNTS[norm]) {
    return KNOWN_SERIES_SEASON_COUNTS[norm];
  }
  for (const [key, count] of Object.entries(KNOWN_SERIES_SEASON_COUNTS)) {
    const keyNorm = normalizeMovieTitle(key);
    if (norm === keyNorm || (norm.length >= 4 && norm.includes(keyNorm))) {
      return count;
    }
  }
  return 1;
}

export const COMMON_DISLIKED_CATEGORIES: readonly string[] = [
  "Skräck",
  "Romantik",
  "Musikal",
  "Sci-Fi",
  "Fantasy",
  "Komedi",
  "Animerat",
  "Action",
  "Krigsfilm",
  "Dokumentär",
  "Reality",
  "Splatter & Våld",
];

export const DISLIKED_CATEGORY_TMDB_MAP: Record<string, number[]> = {
  skräck: [27],
  horror: [27],
  romantik: [10749],
  romance: [10749],
  kärlek: [10749],
  komedi: [35],
  comedy: [35],
  action: [28, 10759],
  "sci-fi": [878, 10765],
  scifi: [878, 10765],
  "science fiction": [878, 10765],
  fantasy: [14, 10765],
  animerat: [16],
  animation: [16],
  tecknat: [16],
  anime: [16],
  krim: [80],
  kriminal: [80],
  deckare: [80, 9648],
  mysterium: [9648],
  mystery: [9648],
  thriller: [53],
  drama: [18],
  dokumentär: [99],
  documentary: [99],
  musikal: [10402],
  musik: [10402],
  musical: [10402],
  krig: [10752, 10768],
  krigsfilm: [10752, 10768],
  war: [10752, 10768],
  western: [37],
  familj: [10751, 10762],
  familjefilm: [10751, 10762],
  barnfilm: [10751, 10762],
  reality: [10764],
  äventyr: [12, 10759],
  adventure: [12, 10759],
  historia: [36],
  historiskt: [36],
};

export function getDislikedGenreIds(category: string): number[] {
  const norm = category.trim().toLowerCase();
  if (DISLIKED_CATEGORY_TMDB_MAP[norm]) {
    return DISLIKED_CATEGORY_TMDB_MAP[norm];
  }
  for (const [key, ids] of Object.entries(DISLIKED_CATEGORY_TMDB_MAP)) {
    if (norm.includes(key) || key.includes(norm)) {
      return ids;
    }
  }
  return [];
}

export function isMovieMatchingDislikedCategories(
  movie: {
    title?: string;
    originalTitle?: string;
    tmdbGenreIds?: number[];
    tmdbGenres?: string[];
    vibeTags?: string[];
    matchingContents?: string[];
    matchingMoods?: string[];
    hookSwedish?: string;
    whyYouWillLikeIt?: string;
  },
  dislikedCategories: string[]
): boolean {
  if (!Array.isArray(dislikedCategories) || dislikedCategories.length === 0) {
    return false;
  }

  let genreIds = movie.tmdbGenreIds;
  let genres = movie.tmdbGenres;
  if ((!genreIds || genreIds.length === 0) && movie.title) {
    const meta = lookupCuratedTmdbMovie(movie.originalTitle || movie.title);
    if (meta.tmdbGenreIds && meta.tmdbGenreIds.length > 0) {
      genreIds = meta.tmdbGenreIds;
    }
    if (meta.tmdbGenres && meta.tmdbGenres.length > 0) {
      genres = meta.tmdbGenres;
    }
  }

  const genreIdSet = new Set((genreIds || []).map(Number));
  const genresLower = (genres || []).map((g) => g.toLowerCase());
  const vibeTagsLower = (movie.vibeTags || []).map((t) => t.toLowerCase());
  const matchingContentsLower = (movie.matchingContents || []).map((c) =>
    c.toLowerCase()
  );
  const matchingMoodsLower = (movie.matchingMoods || []).map((m) =>
    m.toLowerCase()
  );
  const textPool = [
    movie.title || "",
    movie.originalTitle || "",
    movie.hookSwedish || "",
    movie.whyYouWillLikeIt || "",
    ...genresLower,
    ...vibeTagsLower,
    ...matchingContentsLower,
    ...matchingMoodsLower,
  ]
    .join(" ")
    .toLowerCase();

  for (const rawCat of dislikedCategories) {
    const cat = rawCat.trim().toLowerCase();
    if (!cat) continue;

    // 1. TMDB Genre IDs
    const mappedIds = getDislikedGenreIds(cat);
    if (mappedIds.length > 0 && mappedIds.some((id) => genreIdSet.has(id))) {
      return true;
    }

    // 2. TMDB Genres names
    if (genresLower.some((g) => g.includes(cat) || cat.includes(g))) {
      return true;
    }

    // 3. Vibe tags & matching contents
    if (vibeTagsLower.some((t) => t.includes(cat) || cat.includes(t))) {
      return true;
    }
    if (matchingContentsLower.some((c) => c.includes(cat) || cat.includes(c))) {
      return true;
    }

    // 4. Keyword in textPool (min 3 chars)
    if (cat.length >= 3) {
      const cleanWord = cat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|\\W)${cleanWord}($|\\W)`, "i");
      if (regex.test(textPool) || textPool.includes(cat)) {
        return true;
      }
    }
  }

  return false;
}

export function filterOutDislikedCategories<
  T extends {
    title?: string;
    originalTitle?: string;
    tmdbGenreIds?: number[];
    tmdbGenres?: string[];
    vibeTags?: string[];
    matchingContents?: string[];
    matchingMoods?: string[];
    hookSwedish?: string;
    whyYouWillLikeIt?: string;
  }
>(movies: T[], dislikedCategories: string[]): T[] {
  if (!Array.isArray(dislikedCategories) || dislikedCategories.length === 0) {
    return movies;
  }
  return movies.filter(
    (movie) => !isMovieMatchingDislikedCategories(movie, dislikedCategories)
  );
}

interface TmdbCategoryRule {
  id: string;
  label: string;
  allowedGenreIds: number[];
}

export interface TmdbDiscoverFilters {
  originCountries: string[];
  originalLanguages: string[];
  companyIds: number[];
  keywordGroups: number[][];
  strictKeywords?: boolean;
  withoutKeywordIds: number[];
  fallbackGenreIds: number[];
  withoutGenreIds: number[];
  minRuntime?: number;
  maxRuntime?: number;
  maxYearOverride?: number;
  tvMaxEpisodeRuntime?: number;
  tvEndedOnly?: boolean;
  tvMiniseriesOnly?: boolean;
  tvShortSeries?: boolean;
  sortBy?: string;
  minVoteCount?: number;
  maxVoteCount?: number;
  minVoteAverage?: number;
}

export const ALL_TV_SERIES_LENGTH_CHIPS: readonly string[] = [
  "Serielängd",
  "Miniserie",
  "1–2 säsonger",
  "3–5 säsonger",
  "6+ säsonger",
  "Korta avsnitt",
  "Avslutad serie",
  "Miniserie (1 kort säsong)",
  "Kort serie (1–2 säsonger)",
  "Mellanlång serie (3–5 säsonger)",
  "Långkörare (6+ säsonger)",
  "Avslutad serie (helt färdig)",
];

export const ALL_MOVIE_LENGTH_CHIPS: readonly string[] = [
  "Speltid",
  "Max 90 min",
  "Max 90 minuter",
  "Max 2 tim",
  "Max 2 timmar",
  "Över 2 tim",
  "2+ timmar (Långfilm)",
];

export function hasSeriesLengthFilter(preferences: EveningPreferences): boolean {
  const moods = preferences.moods || [];
  return moods.some((m) => ALL_TV_SERIES_LENGTH_CHIPS.includes(m));
}

export function hasMovieLengthFilter(preferences: EveningPreferences): boolean {
  const moods = preferences.moods || [];
  const frameworks = preferences.frameworks || [];
  return [...moods, ...frameworks].some((m) =>
    ALL_MOVIE_LENGTH_CHIPS.includes(m)
  );
}

export function resolveEffectiveMediaType(
  preferences: EveningPreferences
): "any" | "movie" | "tv" {
  if (hasSeriesLengthFilter(preferences) && preferences.mediaType !== "movie") {
    return "tv";
  }
  if (
    hasMovieLengthFilter(preferences) &&
    !hasSeriesLengthFilter(preferences) &&
    (!preferences.mediaType || preferences.mediaType === "any")
  ) {
    return "movie";
  }
  return preferences.mediaType || "any";
}

export function parseRuntimeMinutes(runtime?: string): number | undefined {
  if (!runtime || typeof runtime !== "string") return undefined;
  const lower = runtime.toLowerCase().trim();
  if (!lower || lower.includes("säsong") || lower.includes("miniserie")) {
    return undefined;
  }
  const hrMinMatch = lower.match(/(\d+)\s*(?:tim(?:mar)?|h)\s*(?:(\d+)\s*m(?:in)?)?/);
  if (hrMinMatch) {
    const hours = Number(hrMinMatch[1]);
    const mins = hrMinMatch[2] ? Number(hrMinMatch[2]) : 0;
    if (!Number.isNaN(hours) && hours > 0 && hours <= 12) {
      return hours * 60 + (Number.isNaN(mins) ? 0 : mins);
    }
  }
  const minOnlyMatch = lower.match(/\b(\d{2,3})\s*min\b/);
  if (minOnlyMatch) {
    const mins = Number(minOnlyMatch[1]);
    if (!Number.isNaN(mins) && mins >= 20 && mins <= 600) {
      return mins;
    }
  }
  return undefined;
}

export function formatRuntimeMinutes(minutes?: number): string | undefined {
  if (typeof minutes !== "number" || Number.isNaN(minutes) || minutes <= 0) {
    return undefined;
  }
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} tim`;
  return `${hours} tim ${mins} min`;
}

export function hasNonLatinScript(text?: string): boolean {
  if (!text) return false;
  return (
    /\p{L}/u.test(text) &&
    /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}]/u.test(text)
  );
}

export function extractTmdbDiscoverFilters(
  preferences: EveningPreferences
): TmdbDiscoverFilters {
  const allSelected = [
    ...(preferences.genres || []),
    ...(preferences.contents || []),
    ...(preferences.frameworks || []),
    ...(preferences.moods || []),
  ];
  const fw = preferences.frameworks || [];
  const moods = preferences.moods || [];

  const originCountries: string[] = [];
  const originalLanguages: string[] = [];
  const companyIds: number[] = [];
  const keywordGroups: number[][] = [];
  const withoutKeywordSet = new Set<number>();
  const fallbackGenreSet = new Set<number>();
  const withoutGenreSet = new Set<number>();

  const addCountry = (...codes: string[]) => {
    for (const c of codes) {
      if (!originCountries.includes(c)) originCountries.push(c);
    }
  };
  const addLang = (...langs: string[]) => {
    for (const l of langs) {
      if (!originalLanguages.includes(l)) originalLanguages.push(l);
    }
  };
  const addCompany = (...ids: number[]) => {
    for (const id of ids) {
      if (!companyIds.includes(id)) companyIds.push(id);
    }
  };
  const addKeywords = (...ids: number[]) => {
    if (ids.length > 0) keywordGroups.push(ids);
  };
  const addWithoutKeywords = (...ids: number[]) => {
    for (const id of ids) withoutKeywordSet.add(id);
  };
  const addFallbackGenres = (...ids: number[]) => {
    for (const id of ids) fallbackGenreSet.add(id);
  };
  const addWithoutGenres = (...ids: number[]) => {
    for (const id of ids) withoutGenreSet.add(id);
  };

  const hasExplicitAction = allSelected.some((c) =>
    ["Action", "Superhjältar", "Strid & Action", "Actionkomedi", "Actionromans", "Sci-Fi-action"].includes(c)
  );
  const hasExplicitAnimation = allSelected.some((c) =>
    ["Animerat", "Anime", "Studio Ghibli", "Pixar", "Disney", "Vuxenanimation", "Animerad action"].includes(c)
  );
  const hasExplicitHorror = allSelected.some((c) =>
    ["Skräck", "Psykologisk skräck", "Slasher", "Zombies", "Vampyrer", "Spöken", "Skräckkomedi"].includes(c)
  );

  // Origin countries & languages
  if (fw.includes("Sverige") || fw.includes("Stockholm")) {
    addCountry("SE");
    addLang("sv");
    if (fw.includes("Stockholm")) {
      addKeywords(8085, 271015); // stockholm, sweden / stockholm
    }
  } else if (fw.includes("Sverige & Norden") || fw.includes("Norden")) {
    addCountry("SE", "NO", "DK", "FI", "IS");
  } else if (fw.includes("Europa")) {
    addCountry("SE", "NO", "DK", "FI", "GB", "FR", "DE", "ES", "IT");
  }
  if (fw.includes("London")) {
    addKeywords(212); // london, england (plats-nyckelord utan GB-låsning så alla genrer/länder i London kommer med)
  }
  if (fw.includes("Tokyo")) {
    addCountry("JP");
    addKeywords(233); // japan
  }
  if (fw.includes("New York")) {
    addKeywords(242); // new york city
  }

  // Production companies (all live-verified via TMDB /3/company/{id})
  if (allSelected.some((c) => ["Studio Ghibli", "Studio Ghibli-känsla"].includes(c))) {
    addCompany(10342); // Studio Ghibli
  }
  if (allSelected.includes("Pixar")) {
    addCompany(3); // Pixar
  }
  if (allSelected.includes("Disney")) {
    addCompany(2, 6125); // Walt Disney Pictures, Walt Disney Animation Studios
  }
  if (allSelected.includes("Marvel")) {
    addCompany(420); // Marvel Studios
  }
  if (allSelected.includes("DC")) {
    addCompany(9993, 128064); // DC Entertainment, DC Films
  }

  // Anime / Studio Ghibli -> Japanese original language & Japan origin
  if (
    allSelected.some((c) =>
      ["Anime", "Anime / Japansk animation", "Studio Ghibli", "Studio Ghibli-känsla"].includes(c)
    )
  ) {
    addLang("ja");
    addCountry("JP");
  }

  // Adult animation excludes Family / Kids
  let minVoteAverage: number | undefined;
  let maxYearOverride: number | undefined;
  if (allSelected.includes("Vuxenanimation")) {
    addWithoutGenres(10751, 10762);
    minVoteAverage = 7.0;
  }

  const hasExplicitFamilyOrKids = allSelected.some((c) =>
    [
      "Familj",
      "Familjefilm",
      "Barnfilm",
      "Familjeäventyr",
      "Familjekomedi",
      "Sagovärld",
      "Julfilm",
      "Disney",
      "Pixar",
    ].includes(c)
  );
  if (!hasExplicitFamilyOrKids) {
    // Exclude TMDB TV "Kids" genre (10762) by default so adult genres like Superhjältar don't return kids cartoons (Teen Titans Go!, Henry Danger, etc.)
    addWithoutGenres(10762);
  }

  let strictKeywords = false;

  // Superheroes (9715 = superhero, 2095 = anti hero, 33637 = super power, 155030 = superhero team)
  if (
    allSelected.some((c) =>
      [
        "Superhjältar",
        "Marvel",
        "DC",
        "Antihjältar",
        "Mörka hjältar",
        "Superkrafter",
        "Hjälteteam",
      ].includes(c)
    )
  ) {
    strictKeywords = true;
    addKeywords(9715);
    if (allSelected.includes("Antihjältar") || allSelected.includes("Mörka hjältar")) {
      addKeywords(2095);
    } else if (allSelected.includes("Superkrafter")) {
      addKeywords(33637);
    } else if (allSelected.includes("Hjälteteam")) {
      addKeywords(155030, 265979); // superhero team, superhero teamup
    }
  }

  if (
    allSelected.some((c) =>
      [
        "Zombies",
        "Vampyrer",
        "Spöken",
        "Rymden",
        "Tidsresor",
        "AI & Robotar",
        "Dystopi",
        "Seriemördare",
        "Maffia",
        "Spionage",
        "Heist / Kupp",
        "Biljakter",
        "Sport",
        "Kampsport",
      ].includes(c)
    )
  ) {
    strictKeywords = true;
  }

  // Narrow genre & content keywords (ALL live-verified via TMDB /3/keyword/{id})
  if (allSelected.includes("Natur")) {
    addKeywords(18330, 221355, 9902); // nature, nature documentary, wildlife
  }
  if (allSelected.includes("Vetenskap")) {
    addKeywords(287067, 14760, 9882); // science, scientist, space
  }
  if (allSelected.includes("Historia")) {
    addKeywords(282633, 15126, 1956, 2504); // history, historical, world war ii, world war i
  }
  if (allSelected.includes("Omaka par") || allSelected.includes("Buddy-komedi (Omaka par)")) {
    addKeywords(167316, 187376); // buddy cop, odd couple
  }
  if (allSelected.includes("Urflippad") || allSelected.includes("Urflippad / Slapstick")) {
    addKeywords(9253, 386752); // slapstick comedy, slapstick
  }
  if (allSelected.includes("Ungdomskomedi") || allSelected.includes("High school & Ungdom")) {
    addKeywords(155722, 6270); // teen comedy, high school
  }
  if (allSelected.includes("Psykologisk") || allSelected.includes("Psykologisk thriller")) {
    addKeywords(12565); // psychological thriller
  }
  if (allSelected.includes("Experiment") || allSelected.includes("Genetik, Kloning & Experiment")) {
    addKeywords(1706, 240435); // experiment, scientific experiment
  }
  if (allSelected.includes("Retro-Sci-Fi")) {
    maxYearOverride = 1989;
  }
  if (allSelected.includes("Rymdskräck") || allSelected.includes("Kosmisk & Sci-Fi-skräck")) {
    addKeywords(9882, 252634, 9951); // space, outer space, alien
  }
  if (allSelected.includes("Relationsdrama")) {
    addKeywords(14534, 15160); // relationship, divorce
  }
  if (allSelected.includes("Rivaler blir kära")) {
    addKeywords(282986, 4516); // enemies to lovers, romantic rivalry
  }
  if (allSelected.includes("Förbjuden kärlek")) {
    addKeywords(3691); // forbidden love
  }
  if (allSelected.includes("Vildmark")) {
    addKeywords(3593, 10349); // wilderness, survival
  }
  if (allSelected.includes("Dröm eller verklighet")) {
    addKeywords(10597, 346773, 9887); // lucid dreaming, dream, surrealism
  }
  if (allSelected.includes("Psykologiskt spel")) {
    addKeywords(184312, 226106, 12565); // mind game, mind games, psychological thriller
  }
  if (allSelected.includes("Skydda någon")) {
    addKeywords(3088); // bodyguard
  }
  if (allSelected.includes("Mörkt förflutet")) {
    addKeywords(164148); // dark past
  }
  if (allSelected.includes("Egen rättvisa")) {
    addKeywords(7002, 266013); // vigilante, vigilante justice
  }
  if (allSelected.includes("Instängda")) {
    addKeywords(18029, 2147, 193110); // trapped, claustrophobia, locked room
  }
  if (allSelected.includes("Ny start")) {
    addKeywords(208476, 34004, 224472, 253309); // starting over, second chance, new life, new beginning
  }
  if (allSelected.includes("Mörk fantasy") || allSelected.includes("Mörk Fantasy & Monsterjakt")) {
    addKeywords(177895); // dark fantasy
    if (!hasExplicitAnimation) addWithoutGenres(16, 10751);
  }
  if (allSelected.includes("Mörk deckare") || allSelected.includes("Becksvart Neo-Noir")) {
    addKeywords(207268, 9807); // neo-noir, film noir
  }
  if (allSelected.includes("Rättssalsdrama")) {
    addKeywords(33519, 214780, 11038); // courtroom, courtroom drama, trial
  }
  if (allSelected.includes("Psykologisk skräck")) {
    addKeywords(295907, 12565); // psychological horror, psychological thriller
  }
  if (allSelected.includes("Sport") || allSelected.includes("Sportdrama")) {
    addKeywords(6075); // sports
  }
  if (allSelected.includes("Musik") || allSelected.includes("Musikbiografi")) {
    addKeywords(5565, 4344); // biography, musical
  }
  if (allSelected.includes("Klassisk musikal") || allSelected.includes("Musikal")) {
    addKeywords(4344); // musical
  }
  if (allSelected.includes("Konsert")) {
    addKeywords(6029, 156205); // concert, concert film
  }
  if (allSelected.includes("Rock")) {
    addKeywords(11700, 155710); // rock music, rock musical
  }
  if (allSelected.includes("Pop")) {
    addKeywords(33922); // pop music
  }
  if (allSelected.includes("Dansfilm")) {
    addKeywords(1691); // dance
  }
  if (allSelected.includes("Kampsport") || allSelected.includes("Närkamp")) {
    addKeywords(779); // martial arts
  }
  if (allSelected.includes("Biljakter")) {
    addKeywords(382327, 9844); // car chase, car crash
  }
  if (allSelected.includes("Hämndaction") || allSelected.includes("Hämndthriller") || allSelected.includes("Hämnd") || allSelected.includes("Hämnd & Skydd")) {
    addKeywords(9748); // revenge
  }
  if (allSelected.includes("Lönnmördare")) {
    addKeywords(782); // assassin
  }
  if (allSelected.includes("Militär")) {
    addKeywords(6092); // army
  }
  if (allSelected.includes("Svärdsstrider")) {
    addKeywords(1938, 9725); // sword, sword fight
  }
  if (allSelected.includes("Turnering")) {
    addKeywords(12380); // tournament
  }
  if (allSelected.includes("Prisjägare")) {
    addKeywords(801); // bounty hunter
  }
  if (allSelected.includes("Svart komedi") || allSelected.includes("Mörk / Svart komedi")) {
    addKeywords(10123, 383021); // dark comedy, black comedy
  }
  if (allSelected.includes("Parodi")) {
    addKeywords(9755); // parody
  }
  if (allSelected.includes("Satir")) {
    addKeywords(8201); // satire
  }
  if (allSelected.includes("Uppväxt")) {
    addKeywords(10683); // coming of age
  }
  if (allSelected.includes("Djur")) {
    addKeywords(18165, 361118); // animals, animal
  }
  if (allSelected.includes("Skattjakt")) {
    addKeywords(6956, 215470); // treasure hunt, treasure hunter
  }
  if (allSelected.includes("Roadtrip")) {
    addKeywords(7312); // road trip
  }
  if (allSelected.includes("Slasher")) {
    addKeywords(12339); // slasher
  }
  if (allSelected.includes("Sekter")) {
    addKeywords(6158, 162766); // cult, religious cult
  }
  if (allSelected.includes("Handkamera") || allSelected.includes("Found footage")) {
    addKeywords(163053); // found footage
  }
  if (allSelected.includes("Monster")) {
    addKeywords(1299); // monster
  }
  if (allSelected.includes("Monsterjakt")) {
    addKeywords(303364, 9259, 186425, 1299); // monster hunter, vampire hunter, demon hunter, monster
    if (!hasExplicitAnimation) addWithoutGenres(16, 10751);
  }
  if (allSelected.includes("Drakar")) {
    addKeywords(12554); // dragon
  }
  if (allSelected.includes("Magi") || allSelected.includes("Uråldrig magi")) {
    addKeywords(2343); // magic
  }
  if (allSelected.includes("Mytologi") || allSelected.includes("Mytologiska väsen")) {
    addKeywords(2035); // mythology
  }
  if (allSelected.includes("Mordgåta") || allSelected.includes("Deckargåta")) {
    addKeywords(207046, 12570); // murder mystery, whodunit
  }
  if (allSelected.includes("Slutet sällskap")) {
    addKeywords(12570, 207046, 193110, 236429); // whodunit, murder mystery, locked room, locked room mystery
  }
  if (allSelected.includes("Detektiv") || allSelected.includes("Polis")) {
    addKeywords(703); // detective
  }
  if (allSelected.includes("Undercover")) {
    addKeywords(1568); // undercover
  }
  if (allSelected.includes("Verkliga brott")) {
    addKeywords(33722); // true crime
  }
  if (allSelected.includes("Gisslandrama")) {
    addKeywords(1562, 18233); // hostage, hostage situation
  }
  if (allSelected.includes("Hackers")) {
    addKeywords(2157); // hacker
  }
  if (allSelected.includes("Katastrof") || allSelected.includes("Naturkatastrof")) {
    addKeywords(10617, 5096); // disaster, natural disaster
  }
  if (allSelected.includes("Pandemi")) {
    addKeywords(188973); // pandemic
  }
  if (allSelected.includes("Räddningsuppdrag")) {
    addKeywords(10084, 11107); // rescue, rescue mission
  }
  if (allSelected.includes("AI") || allSelected.includes("Levande AI") || allSelected.includes("Robotar")) {
    addKeywords(310); // artificial intelligence (a.i.)
  }
  if (allSelected.includes("Dystopi")) {
    addKeywords(4565); // dystopia
  }
  if (allSelected.includes("Postapokalyps")) {
    addKeywords(4458, 12332); // post-apocalyptic future, apocalypse
  }
  if (allSelected.includes("Utomjordingar")) {
    addKeywords(9951); // alien
  }
  if (allSelected.includes("Parallella världar")) {
    addKeywords(336874, 243230); // multiverse, parallel universe
  }
  if (allSelected.includes("Nära framtid")) {
    addKeywords(244256, 4565); // near future, dystopia
  }
  if (allSelected.includes("Oväntad twist") || allSelected.includes("Twist & Gåta")) {
    addKeywords(275311, 326438); // plot twist, twist ending
  }
  if (allSelected.includes("Opålitlig berättare")) {
    addKeywords(174089); // unreliable narrator
  }
  if (allSelected.includes("Dubbelliv")) {
    addKeywords(848); // double life
  }
  if (allSelected.includes("Minnesförlust")) {
    addKeywords(1453); // amnesia
  }
  if (allSelected.includes("Hemligt sällskap")) {
    addKeywords(2908); // secret society
  }
  if (allSelected.includes("Katt och råtta")) {
    addKeywords(15076); // cat and mouse
  }
  if (allSelected.includes("Oskyldigt anklagad")) {
    addKeywords(769, 12662, 15124, 271331); // falsely accused, wrongful imprisonment, framed, wrongly accused
  }
  if (allSelected.includes("Bluff")) {
    addKeywords(10453); // con artist
  }
  if (allSelected.includes("Infiltration")) {
    addKeywords(12347, 1568); // infiltration, undercover
  }
  if (allSelected.includes("Vänskap") || allSelected.includes("Vänskap & Relationer")) {
    addKeywords(6054); // friendship
  }
  if (allSelected.includes("Familjekonflikt")) {
    addKeywords(155294, 10041); // family conflict, dysfunctional family
  }
  if (allSelected.includes("Skilsmässa")) {
    addKeywords(15160); // divorce
  }
  if (allSelected.includes("Föräldraskap")) {
    addKeywords(15025); // parenting
  }
  if (allSelected.includes("Grannar")) {
    addKeywords(10226); // neighbor
  }
  if (allSelected.includes("Underdog")) {
    addKeywords(240); // underdog
  }
  if (allSelected.includes("Rivalitet")) {
    addKeywords(9823); // rivalry
  }
  if (allSelected.includes("Mästare och lärjunge")) {
    addKeywords(1310); // mentor
  }
  if (
    allSelected.some((c) =>
      ["Kostymdrama", "Historiskt kostymdrama", "Historisk romans"].includes(c)
    )
  ) {
    addKeywords(15060, 195013, 207928); // period drama, costume drama, 19th century
  }
  if (allSelected.includes("Andra världskriget")) {
    addKeywords(1956); // world war ii
  }
  if (
    allSelected.some((c) =>
      ["Verklighetsbaserat", "Biografi", "Biografi & Verkliga livsöden"].includes(c)
    )
  ) {
    addKeywords(9672, 5565); // based on true story, biography
  }
  if (allSelected.includes("Tidsloop")) {
    addKeywords(10854); // strictly time loop (not generic time travel)
  } else if (
    allSelected.some((c) =>
      ["Tidsresor", "Tidsresor & Tidsloop", "Tidsresor / Tidsloop"].includes(c)
    )
  ) {
    addKeywords(4379, 10854); // time travel, time loop
  }
  if (
    allSelected.some((c) =>
      ["Kupp & Heist", "Kupp", "Smart kupp", "Bankrån", "Bankrån & Heist", "Heist & Kupplan"].includes(c)
    )
  ) {
    addKeywords(10051, 15363); // heist, bank robbery
  }
  if (
    allSelected.some((c) =>
      ["Överlevnad", "Överlevnad & Hot", "Överlevnadsthriller", "Överlevnad i vildmarken"].includes(c)
    )
  ) {
    addKeywords(10349); // survival
  }
  if (allSelected.some((c) => ["Zombies", "Zombies & Smitta"].includes(c))) {
    addKeywords(12377); // zombie
  }
  if (allSelected.includes("Vampyrer")) {
    addKeywords(3133); // vampire
  }
  if (allSelected.some((c) => ["Spöken", "Övernaturligt & Spöken"].includes(c))) {
    addKeywords(162846); // ghost
  }
  if (allSelected.includes("Forntid & Medeltid")) {
    addKeywords(161257, 41406, 5049, 1405, 162861); // medieval, middle ages, ancient rome, roman empire, ancient greece
    addWithoutKeywords(1956, 2504, 2652, 1739); // exclude WW2, WW1, Nazi, Holocaust
    addWithoutGenres(10752);
  }
  if (allSelected.some((c) => ["Vikingar", "Vikingatid", "Vikingar & Nordisk myt"].includes(c))) {
    addKeywords(5895, 384863, 363879); // vikings (norsemen), viking, vikings
    addWithoutKeywords(1956, 2504, 2652, 1739);
    if (!hasExplicitAnimation) addWithoutGenres(16, 10751);
  }
  if (allSelected.some((c) => ["Pirater", "Pirater & Havsäventyr"].includes(c))) {
    addKeywords(12988); // pirate
  }
  if (allSelected.some((c) => ["Gladiatorer", "Antiken", "Antiken & Gladiatorer"].includes(c))) {
    addKeywords(5049, 1394, 1405, 162861); // ancient rome, gladiator, roman empire, ancient greece
    addWithoutKeywords(1956, 2504, 2652, 1739);
  }
  if (allSelected.some((c) => ["Medeltid", "Riddare", "Riddare & Medeltida riken"].includes(c))) {
    addKeywords(161257, 41406, 10466, 4152); // medieval, middle ages, knight, kingdom
    addWithoutKeywords(1956, 2504, 2652, 1739);
  }
  if (allSelected.includes("1700-tal")) {
    addKeywords(160279); // 18th century
    addWithoutKeywords(1956, 2504, 2652, 1739);
    addWithoutGenres(10752);
  }
  if (allSelected.includes("1800-tal")) {
    addKeywords(207928); // 19th century
    addWithoutKeywords(1956, 2504, 2652, 1739);
    addWithoutGenres(10752);
  }
  if (allSelected.includes("1920-tal")) {
    addKeywords(207876); // 1920s
  }
  if (allSelected.includes("1940-tal")) {
    addKeywords(207883); // 1940s
  }
  if (allSelected.includes("1970-tal")) {
    addKeywords(1228); // 1970s
  }
  if (allSelected.includes("1980-tal")) {
    addKeywords(208289); // 1980s
  }
  if (allSelected.includes("Julfilm")) {
    addKeywords(207317, 65); // christmas, holiday
  }
  if (allSelected.some((c) => ["Maffia", "Maffiakrig", "Maffia & Gangstervärld"].includes(c))) {
    addKeywords(10391, 3149); // mafia, gangster
  }
  if (allSelected.some((c) => ["Spioner", "Spionthriller", "Spion- & Agent-action"].includes(c))) {
    addKeywords(470); // spy
  }
  if (allSelected.some((c) => ["Konspiration", "Konspirations- & Politisk thriller"].includes(c))) {
    addKeywords(10410); // conspiracy
  }
  if (allSelected.some((c) => ["Seriemördare", "Seriemördarjakt", "Gåtfull mördare"].includes(c))) {
    addKeywords(10714); // serial killer
  }
  if (allSelected.some((c) => ["Makt & Politik", "Politik", "Maktspel", "Intriger"].includes(c))) {
    addKeywords(6078, 209817, 41282); // politics, political thriller, political intrigue
    if (!hasExplicitAction) addWithoutGenres(28);
    if (!hasExplicitAnimation) addWithoutGenres(16, 10751);
  }
  if (allSelected.includes("Korruption")) {
    addKeywords(417, 6078); // corruption, politics
  }
  if (allSelected.includes("Kungahus")) {
    addKeywords(2471, 9920); // monarchy, royalty
    if (!hasExplicitAnimation) addWithoutGenres(16, 10751);
  }
  if (allSelected.includes("Företagsdrama")) {
    addKeywords(10177, 12094); // corporate, business
  }

  // Setting keywords & fallback genres (ALL live-verified!)
  if (fw.includes("Isolerade platser") || moods.includes("Klaustrofobisk")) {
    addFallbackGenres(53, 9648, 27);
    addKeywords(201713, 2147); // isolated, claustrophobia
  }
  if (fw.includes("Öde ö")) {
    addFallbackGenres(12, 53, 18);
    addKeywords(155746, 2041); // deserted island, island
  }
  if (fw.includes("Stuga")) {
    addFallbackGenres(27, 53, 9648);
    addKeywords(3623, 4010); // cabin, log cabin
  }
  if (fw.includes("Herrgård")) {
    addFallbackGenres(9648, 53, 27, 18);
    addKeywords(12545); // mansion
  }
  if (fw.includes("Fängelse") || allSelected.includes("Fängelsedrama")) {
    addFallbackGenres(18, 80, 53);
    addKeywords(378); // prison
  }
  if (fw.includes("Fartyg")) {
    addFallbackGenres(12, 53, 18);
    addKeywords(658, 3799); // sea, ship
  }
  if (fw.includes("Ubåt")) {
    addFallbackGenres(53, 28, 10752);
    addKeywords(339); // submarine
  }
  if (fw.includes("Tåg")) {
    addFallbackGenres(53, 28, 9648);
    addKeywords(13008); // train
  }
  if (fw.includes("Flygplan")) {
    addFallbackGenres(53, 28);
    addKeywords(3800, 12617); // airplane, airplane crash
  }
  if (fw.includes("Hotell")) {
    addFallbackGenres(53, 9648, 18, 35);
    addKeywords(612); // hotel
  }
  if (fw.includes("Bunker")) {
    addFallbackGenres(53, 878, 27);
    addKeywords(2321); // bunker
  }
  if (
    fw.some((c) =>
      ["Natur & Vildmark", "Skog", "Berg", "Vinter", "Öken", "Kust"].includes(c)
    )
  ) {
    addFallbackGenres(12, 53, 18);
    if (fw.includes("Berg")) addKeywords(1262); // mountain
    else if (fw.includes("Skog")) addKeywords(5774); // forest
    else if (fw.includes("Öken")) addKeywords(18034); // desert
    else if (fw.includes("Kust")) addKeywords(658); // sea
    else if (fw.includes("Vinter")) addKeywords(1442, 10794); // winter, snow
    else addKeywords(3593, 18330); // wilderness, nature
  }
  if (fw.some((c) => ["Städer & Metropoler", "Storstad"].includes(c))) {
    addFallbackGenres(80, 53, 18);
  }
  if (fw.includes("Småstad")) {
    addFallbackGenres(18, 9648, 53);
    addKeywords(1415); // small town
  }
  if (fw.includes("Landsbygd")) {
    addFallbackGenres(18, 10749, 35);
    addKeywords(548, 251619, 4932); // countryside, rural, farm
  }
  if (
    fw.some((c) =>
      ["Skola & Jobb", "Skola", "Universitet", "Sjukhus", "Kontor", "Restaurang", "Advokatbyrå"].includes(c)
    )
  ) {
    addFallbackGenres(18, 35);
    if (fw.includes("Skola")) addKeywords(6270); // high school
    else if (fw.includes("Universitet")) addKeywords(3616); // college
    else if (fw.includes("Sjukhus")) addKeywords(11612, 13005, 258786); // hospital, doctor, medical
    else if (fw.includes("Kontor")) addKeywords(1438, 6282); // office, workplace
    else if (fw.includes("Restaurang")) addKeywords(1946); // restaurant
    else if (fw.includes("Advokatbyrå")) addKeywords(10909, 162813); // lawyer, law firm
    else addKeywords(6282, 6270); // workplace, high school
  }

  // Mood fallback genres + protective withoutGenres (so horror/action/erotica never leak into cozy/emotional/smart)
  if (
    moods.some((m) =>
      ["Mörk & Nervkittlande", "Mörk", "Rå", "Nagelbitande", "Klaustrofobisk", "Hög puls"].includes(m)
    )
  ) {
    addFallbackGenres(53, 80, 9648);
  }
  if (moods.includes("Kuslig")) {
    addFallbackGenres(27, 9648, 53);
  }
  if (
    moods.some((m) =>
      ["Smart & Psykologisk", "Klurig", "Gåtfull", "Tankeväckande", "Oförutsägbar", "Drömsk"].includes(m)
    )
  ) {
    addFallbackGenres(9648, 53);
    if (!hasExplicitAction) {
      addWithoutGenres(28, 12, 10751); // Exclude superhero/action/adventure blockbusters
    }
    if (moods.includes("Klurig") || moods.includes("Oförutsägbar")) {
      addKeywords(275311, 326438, 12565); // plot twist, twist ending, psychological thriller
    } else if (moods.includes("Gåtfull")) {
      addKeywords(9228, 207046, 12565); // puzzle, murder mystery, psychological thriller
    } else if (moods.includes("Drömsk")) {
      addKeywords(9887, 10597, 346773); // surrealism, lucid dreaming, dream
    } else if (moods.includes("Smart & Psykologisk")) {
      addKeywords(12565, 275311); // psychological thriller, plot twist
    }
  }
  if (
    moods.some((m) =>
      ["Feelgood & Mys", "Mysig", "Feelgood", "Lättsam", "Nostalgisk", "Slökolla", "Avkopplande"].includes(m)
    )
  ) {
    addFallbackGenres(35, 10751, 10749);
    if (!hasExplicitHorror) addWithoutGenres(27, 53, 80, 10752); // Never horror, thriller, crime, war in feelgood!
  }
  if (moods.includes("Skarp dialog")) {
    addFallbackGenres(35, 18);
    if (!hasExplicitAction) addWithoutGenres(28);
    if (!hasExplicitAnimation) addWithoutGenres(16);
    if (!hasExplicitHorror) addWithoutGenres(27);
    addKeywords(319397); // witty
  }
  if (
    moods.some((m) =>
      ["Humor & Romantik", "Charmig", "Romantisk", "Knasig"].includes(m)
    ) ||
    allSelected.includes("Romantik")
  ) {
    if (moods.some((m) => ["Humor & Romantik", "Charmig", "Knasig"].includes(m))) {
      addFallbackGenres(35, 10749);
    }
    if (!hasExplicitAction) addWithoutGenres(28);
    if (!hasExplicitAnimation) addWithoutGenres(16);
    if (!hasExplicitHorror) addWithoutGenres(27, 53, 10752);
  }
  if (
    moods.some((m) =>
      ["Episk & Spektakulär", "Storslagen", "Snyggt foto", "Inspirerande"].includes(m)
    )
  ) {
    addFallbackGenres(12, 14, 878, 18);
  }
  if (
    moods.some((m) =>
      ["Känslosam & Gripande", "Gripande", "Vemodig", "Hjärtekrossande", "Tårframkallande"].includes(m)
    )
  ) {
    addFallbackGenres(18);
    addWithoutGenres(27, 28, 35, 53); // Pure emotional drama, no horror/action/comedy!
  }
  if (moods.some((m) => ["Högt tempo", "Intensivt"].includes(m))) {
    addFallbackGenres(28, 53, 12);
  }
  if (moods.some((m) => ["Långsamt tempo", "Lugnt"].includes(m))) {
    addFallbackGenres(18, 99);
    addWithoutGenres(27, 28, 53); // Calm, never horror/action/thriller!
  }

  // Runtime & TV series length filters
  let minRuntime: number | undefined;
  let maxRuntime: number | undefined;
  if (moods.includes("Max 90 min") || moods.includes("Max 90 minuter")) {
    minRuntime = 45;
    maxRuntime = 90;
  } else if (
    moods.includes("Max 2 tim") ||
    moods.includes("Max 2 timmar") ||
    fw.includes("Max 2 timmar")
  ) {
    minRuntime = 60;
    maxRuntime = 120;
  } else if (
    moods.includes("Över 2 tim") ||
    moods.includes("2+ timmar (Långfilm)") ||
    fw.includes("2+ timmar (Långfilm)")
  ) {
    minRuntime = 121;
  }

  const tvMaxEpisodeRuntime = moods.includes("Korta avsnitt") ? 35 : undefined;
  const tvEndedOnly =
    moods.includes("Avslutad serie") ||
    moods.includes("Avslutad serie (helt färdig)")
      ? true
      : undefined;
  const tvMiniseriesOnly =
    moods.includes("Miniserie") || moods.includes("Miniserie (1 kort säsong)")
      ? true
      : undefined;
  const tvShortSeries =
    moods.includes("1–2 säsonger") ||
    moods.includes("Kort serie (1–2 säsonger)")
      ? true
      : undefined;

  let sortBy: string | undefined;
  let minVoteCount: number | undefined;
  let maxVoteCount: number | undefined;
  if (moods.includes("Mästerverk")) {
    sortBy = "vote_average.desc";
    minVoteCount = 2000;
    minVoteAverage = 7.8;
  } else if (moods.includes("Dold pärla")) {
    sortBy = "vote_average.desc";
    minVoteCount = 250;
    maxVoteCount = 1200;
    minVoteAverage = 7.4;
    maxYearOverride = 2024;
    if (!hasExplicitAnimation) addWithoutGenres(16);
    addWithoutGenres(99, 10402);
  }

  return {
    originCountries,
    originalLanguages,
    companyIds,
    keywordGroups,
    strictKeywords: strictKeywords || undefined,
    withoutKeywordIds: Array.from(withoutKeywordSet),
    fallbackGenreIds: Array.from(fallbackGenreSet),
    withoutGenreIds: Array.from(withoutGenreSet),
    minRuntime,
    maxRuntime,
    maxYearOverride,
    tvMaxEpisodeRuntime,
    tvEndedOnly,
    tvMiniseriesOnly,
    tvShortSeries,
    sortBy,
    minVoteCount,
    maxVoteCount,
    minVoteAverage,
  };
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
        "Strid & Action",
        "Kampsport",
        "Kampsport & Närkamp",
        "Spioner",
        "Spion- & Agent-action",
        "Hämndaction",
        "Hämnd-action (Vigilante)",
        "Biljakter",
        "Biljakter & Adrenalin",
        "Lönnmördare",
        "Gun-fu / Lönnmördare",
        "Explosivt",
        "Over-the-top / Explosivt",
        "Svärdsstrider",
        "Svärdsstrider / Närkamp",
        "Närkamp",
        "Välkoreograferad action",
        "En mot alla",
        "En mot alla (One-man army)",
        "Turnering",
        "Gladiator- / Turnering & Arena",
        "Prisjägare",
        "Prisjägare / Yrkesmördare",
      ].includes(chip)
    ) {
      addRule("action", "Action", [28, 10759]);
    } else if (chip === "Kupp") {
      // "Kupp" is a subchip under Action
      addRule("action", "Action", [28, 10759]);
    } else if (
      chip === "Militär" ||
      chip === "Militär & Specialstyrkor" ||
      chip === "Strid, Action & Hämnd"
    ) {
      addRule("action", "Action / Krig", [28, 10759, 10752, 10768]);
    } else if (chip === "Actionromans" || chip === "Action-romans") {
      addRule("action", "Action", [28, 10759]);
      addRule("romance", "Romantik", [10749]);
    } else if (chip === "Actionkomedi" || chip === "Action-komedi") {
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
        "Svart komedi",
        "Mörk / Svart komedi",
        "Omaka par",
        "Buddy-komedi (Omaka par)",
        "Feelgood",
        "Feelgood-komedi",
        "Parodi",
        "Satir",
        "Satir & Parodi",
        "Urflippad",
        "Urflippad / Slapstick",
        "Ungdomskomedi",
        "High school & Ungdom",
        "Rolig",
        "Skrattfest & Charmig",
      ].includes(chip)
    ) {
      addRule("comedy", "Komedi", [35]);
    } else if (
      chip === "Romantisk komedi" ||
      chip === "Romantisk komedi (Rom-com)"
    ) {
      addRule("comedy", "Komedi", [35]);
      addRule("romance", "Romantik", [10749]);
    } else if (chip === "Kriminalkomedi") {
      addRule("comedy", "Komedi", [35]);
      addRule("crime_mystery", "Krim / Mysterium", [80, 9648]);
    } else if (chip === "Dramakomedi" || chip === "Dramakomedi (Dramedy)") {
      addRule("comedy", "Komedi", [35]);
      addRule("drama", "Drama", [18]);
    }

    // 3. Sci-Fi & Rymden
    if (
      [
        "Sci-Fi",
        "Rymdäventyr",
        "Rymdäventyr & Främmande planeter",
        "Tidsresor",
        "Tidsloop",
        "Tidsresor & Tidsloop",
        "AI",
        "Robotar",
        "Cyberpunk & AI / Robotar",
        "Dystopi",
        "Postapokalyps",
        "Dystopi & Postapokalyps",
        "Utomjordingar",
        "Utomjordingar / First Contact",
        "Klurig Sci-Fi",
        "Mind-bending Sci-Fi",
        "Realistisk Sci-Fi",
        "Realistisk hård Sci-Fi",
        "Experiment",
        "Genetik, Kloning & Experiment",
        "Retro-Sci-Fi",
        "Retro-futurism / Steampunk",
        "Tidsresor & Sci-Fi",
        "Tidsresor, Lore & Sci-Fi",
        "Tidsresor / Tidsloop",
        "Parallella världar",
        "Parallella universum / Multiverse",
        "Levande AI",
        "AI / Robot med medvetande",
        "Rymd & Framtid",
        "Rymden & Framtiden",
        "Rymdskepp",
        "Rymdskepp & Rymdstation",
        "Främmande planet",
        "Framtidsstad",
        "Cyberpunk-megastad",
        "Nära framtid",
        "Nära framtid (High-tech)",
      ].includes(chip)
    ) {
      addRule("scifi", "Sci-Fi", [878, 10765]);
    } else if (chip === "Stort världsbygge") {
      addRule("worldbuilding", "Sci-Fi / Fantasy", [878, 14, 10765, 12]);
    }

    // 4. Fantasy
    if (
      [
        "Fantasy",
        "Monster & Fantasy",
        "Drakar",
        "Episk High Fantasy (Alver & Drakar)",
        "Mörk fantasy",
        "Mörk Fantasy & Monsterjakt",
        "Magi",
        "Uråldrig magi",
        "Svärd & Magi (Sword & Sorcery)",
        "Mytologi",
        "Mytologi & Folklore",
        "Mytologiska väsen",
        "Utvald hjälte",
        "Mörk saga",
        "Gotisk saga",
        "Nutida fantasy",
        "Urban / Nutida Fantasy",
        "Riddare",
        "Riddare & Medeltida riken",
        "Annan värld",
        "Portal till annan värld",
        "Monsterjakt",
        "Monster / Mörk fantasy",
      ].includes(chip)
    ) {
      addRule("fantasy", "Fantasy", [14, 10765]);
    }

    // 5. Krim & Mysterium
    if (
      [
        "Krim & Mysterium",
        "Krim & Utredning",
        "Mordgåta",
        "Pusseldeckare (Whodunnit)",
        "Mörk deckare",
        "Becksvart Neo-Noir",
        "Maffia",
        "Maffiakrig",
        "Maffia & Gangstervärld",
        "Polis",
        "Detektiv",
        "Polisutredning & Detektiv",
        "Seriemördarjakt",
        "Bankrån",
        "Bankrån & Heist",
        "Rättssalsdrama",
        "Undercover",
        "Undercover & Infiltratör",
        "Gåta, Brott & Kupp",
        "Deckargåta",
        "Kriminalgåta / Däckare",
        "Slutet sällskap",
        "Mordgåta i slutet sällskap",
        "Gåtfull mördare",
        "Seriemördare med gåtor/mönster",
        "Katt och råtta",
        "Oskyldigt anklagad",
      ].includes(chip)
    ) {
      addRule("crime_mystery", "Krim / Mysterium", [80, 9648]);
    } else if (
      chip === "Verkliga brott" ||
      chip === "True Crime (Verklighetsbaserat)"
    ) {
      addRule("true_crime", "Dokumentär / True Crime", [99]);
    } else if (
      chip === "Kupp & Heist" ||
      chip === "Smart kupp" ||
      chip === "Heist & Kupplan" ||
      chip === "Heist / Kupplan" ||
      chip === "Bluff" ||
      chip === "Infiltration"
    ) {
      addRule("heist", "Krim / Thriller / Action", [80, 53, 28, 10759]);
    }

    // 6. Thriller & Spänning / Twist & Gåta / Hämnd & Överlevnad
    if (
      [
        "Thriller & Spänning",
        "Psykologisk",
        "Psykologisk thriller",
        "Seriemördare",
        "Kriminalthriller / Seriemördare",
        "Mysterie- & Pusselthriller",
        "Överlevnad",
        "Överlevnadsthriller",
        "Konspiration",
        "Konspirations- & Politisk thriller",
        "Spionthriller",
        "Gisslandrama",
        "Gisslan & Belägring",
        "Hämndthriller",
        "Hackers",
        "Tekno- / Cyberthriller",
        "Katastrof",
        "Katastrofthriller",
      ].includes(chip)
    ) {
      addRule("thriller", "Thriller / Mysterium", [53, 9648, 80]);
    } else if (chip === "Mysterium") {
      addRule("mystery", "Mysterium", [9648]);
    } else if (
      [
        "Twist & Gåta",
        "Oväntad twist",
        "Opålitlig berättare",
        "Dubbelliv",
        "Dröm eller verklighet",
        "Minnesförlust",
        "Psykologiskt spel",
        "Hemligt sällskap",
      ].includes(chip)
    ) {
      addRule("twist_mystery", "Thriller / Mysterium", [53, 9648, 18, 878]);
    } else if (
      ["Hämnd & Skydd", "Hämnd", "Skydda någon", "Mörkt förflutet", "Egen rättvisa"].includes(chip)
    ) {
      addRule("revenge", "Action / Thriller / Krim", [28, 53, 80, 10759, 18]);
    } else if (
      ["Överlevnad & Hot", "Instängda", "Naturkatastrof", "Pandemi", "Räddningsuppdrag"].includes(chip)
    ) {
      addRule("survival", "Thriller / Äventyr", [53, 12, 28, 18, 878, 27]);
    }

    // 7. Skräck
    if (
      [
        "Skräck",
        "Psykologisk skräck",
        "Spöken",
        "Övernaturligt & Spöken",
        "Monster",
        "Monster & Varelser",
        "Slasher",
        "Slasher & Maskerad mördare",
        "Sekter",
        "Folk horror / Sekt & Kult",
        "Zombies",
        "Zombies & Smitta",
        "Handkamera",
        "Found footage",
        "Vampyrer",
        "Gotisk skräck",
      ].includes(chip)
    ) {
      addRule("horror", "Skräck", [27]);
    } else if (
      chip === "Rymdskräck" ||
      chip === "Kosmisk & Sci-Fi-skräck" ||
      chip === "Sci-Fi-skräck"
    ) {
      addRule("horror", "Skräck", [27]);
      addRule("scifi", "Sci-Fi", [878, 10765]);
    } else if (chip === "Skräckkomedi") {
      addRule("horror", "Skräck", [27]);
      addRule("comedy", "Komedi", [35]);
    }

    // 8. Drama
    if (
      [
        "Drama",
        "Känslostarkt",
        "Känslostarkt & Gripande",
        "Biografi",
        "Biografi & Verkliga livsöden",
        "Karaktärsstudie",
        "Karaktärsstudie & Besatthet",
        "Familjedrama",
        "Relationsdrama",
        "Familje- & Relationsdrama",
        "Kostymdrama",
        "Historiskt kostymdrama",
        "Sportdrama",
        "Sport- & Underdog-drama",
        "Fängelsedrama",
        "Uppväxt",
        "Uppväxtskildring (Coming-of-age)",
      ].includes(chip)
    ) {
      addRule("drama", "Drama", [18]);
    } else if (chip === "Musikdrama" || chip === "Musik- & Konstnärsdrama") {
      addRule("drama", "Drama", [18]);
      addRule("music", "Musik / Musikal", [10402]);
    } else if (
      [
        "Karaktärer & Verklighet",
        "Verklighetsbaserat",
        "Rivalitet",
        "Mästare och lärjunge",
        "Underdog",
      ].includes(chip)
    ) {
      addRule("character_drama", "Drama / Biografi", [18, 36, 99, 35]);
    }

    // 9. Romantik
    if (
      [
        "Romantik",
        "Romantisk",
        "Storslagen kärlek",
        "Episk & Ödesmättad kärlek",
        "Rivaler blir kära",
        "Enemies to Lovers (Rivaler blir kära)",
        "Förbjuden kärlek",
        "Olycklig kärlek",
        "Olycklig / Bitterljuv kärlek",
        "Historisk romans",
        "Romantisk & Pirrig",
      ].includes(chip)
    ) {
      addRule("romance", "Romantik", [10749]);
    } else if (
      chip === "Sci-Fi-romans" ||
      chip === "Sci-Fi- / Tidsrese-romans"
    ) {
      addRule("romance", "Romantik", [10749]);
      addRule("scifi", "Sci-Fi", [878, 10765]);
    }

    // 10. Äventyr & Krig / Western
    if (
      [
        "Äventyr & Krig",
        "Skattjakt",
        "Skattjakt & Arkeologi",
        "Vildmark",
        "Överlevnad i vildmarken",
        "Vikingar",
        "Vikingar & Nordisk myt",
        "Gladiatorer",
        "Antiken & Gladiatorer",
        "Pirater",
        "Pirater & Havsäventyr",
        "Roadtrip",
        "Roadtrip & Resa",
      ].includes(chip)
    ) {
      addRule("adventure", "Äventyr", [12, 10759]);
    } else if (
      chip === "Krigsfilm" ||
      chip === "Episkt krig & Fältslag" ||
      chip === "Andra världskriget"
    ) {
      addRule("war", "Krig", [10752, 10768]);
    } else if (chip === "Western / Vilda Västern" || chip === "Vilda Västern") {
      addRule("western", "Western", [37]);
    }

    // 11. Animerat & Familj
    if (
      [
        "Animerat",
        "Anime",
        "Anime / Japansk animation",
        "Studio Ghibli",
        "Studio Ghibli-känsla",
        "Pixar",
        "Disney",
        "Pixar / DreamWorks-stil",
        "Vuxenanimation",
      ].includes(chip)
    ) {
      addRule("animation", "Animerat", [16]);
    } else if (
      chip === "Animerad action" ||
      chip === "Animerad action & Sci-Fi"
    ) {
      addRule("animation", "Animerat", [16]);
      addRule("action", "Action", [28, 10759]);
    } else if (
      [
        "Familj",
        "Familjefilm",
        "Familjefilm för alla åldrar",
        "Barnfilm",
        "Djur",
        "Sagovärld",
        "Julfilm",
      ].includes(chip)
    ) {
      // Strictly require Family (10751) or Kids (10762) — NEVER allow adult Animation (16) alone!
      addRule("family", "Familj", [10751, 10762]);
    } else if (chip === "Familjeäventyr") {
      addRule("family", "Familj", [10751, 10762]);
      addRule("adventure", "Äventyr", [12, 10759]);
    } else if (chip === "Familjekomedi") {
      addRule("family", "Familj", [10751, 10762]);
      addRule("comedy", "Komedi", [35]);
    }

    // 12. Dokumentär (strictly require genre 99 for all documentary subchips!)
    if (
      ["Dokumentär", "Natur", "Vetenskap", "Historia", "Sport", "Musik"].includes(
        chip
      )
    ) {
      addRule("documentary", "Dokumentär", [99]);
    }

    // 13. Superhjältar
    if (
      [
        "Superhjältar",
        "Marvel",
        "DC",
        "Antihjältar",
        "Mörka hjältar",
        "Superkrafter",
        "Hjälteteam",
      ].includes(chip)
    ) {
      addRule("superhero", "Action / Sci-Fi / Fantasy", [
        28, 12, 878, 14, 10759, 10765,
      ]);
    }

    // 14. Musikal (strictly require Music 10402 on movies; TV handled in verifyMovieAgainstTmdbCategories)
    if (
      [
        "Musikal",
        "Klassisk musikal",
        "Konsert",
        "Rock",
        "Pop",
        "Musikbiografi",
        "Dansfilm",
      ].includes(chip)
    ) {
      addRule("music", "Musik / Musikal", [10402]);
    }

    // 15. Makt & Politik
    if (
      [
        "Makt & Politik",
        "Maktspel",
        "Politik",
        "Korruption",
        "Kungahus",
        "Företagsdrama",
        "Intriger",
      ].includes(chip)
    ) {
      addRule("politics", "Drama / Politik", [18, 36, 10768, 53, 80]);
    }

    // 16. Vänskap & Relationer
    if (
      [
        "Vänskap & Relationer",
        "Vänskap",
        "Familjekonflikt",
        "Ny start",
        "Skilsmässa",
        "Föräldraskap",
        "Grannar",
      ].includes(chip)
    ) {
      addRule("relations", "Drama / Komedi", [18, 35, 10749, 10751]);
    }

    // 17. Historiska epoker (SETTING_GROUPS)
    if (
      [
        "Forntid & Medeltid",
        "Antiken",
        "Vikingatid",
        "Medeltid",
        "1700-tal",
        "1800-tal",
      ].includes(chip)
    ) {
      addRule("history_era", "Historia / Epok", [36]);
    } else if (
      ["1900-tal & Western", "1920-tal", "1940-tal", "1970-tal", "1980-tal"].includes(
        chip
      )
    ) {
      addRule("modern_era", "Epok / Historia", [36, 18, 37]);
    }
  }

  // Release year / decade rules verified against official TMDB release_date / first_air_date
  let minYear: number | undefined;
  let maxYear: number | undefined;
  for (const fw of preferences.frameworks || []) {
    if (fw === "2020-talet" || fw === "2020-talet (Helt nytt)") {
      minYear = Math.max(minYear ?? 0, 2020);
    } else if (fw === "2010-talet" || fw === "2010-talet (2010–2019)") {
      minYear = Math.max(minYear ?? 0, 2010);
      maxYear = Math.min(maxYear ?? 9999, 2019);
    } else if (fw === "2000-talet" || fw === "2000-talet (2000–2009)") {
      minYear = Math.max(minYear ?? 0, 2000);
      maxYear = Math.min(maxYear ?? 9999, 2009);
    } else if (fw === "1990-talet" || fw === "1990-talet (90-talsklassiker)") {
      minYear = Math.max(minYear ?? 0, 1990);
      maxYear = Math.min(maxYear ?? 9999, 1999);
    } else if (fw === "1980-talet" || fw === "1980-talet (80-talsklassiker)") {
      minYear = Math.max(minYear ?? 0, 1980);
      maxYear = Math.min(maxYear ?? 9999, 1989);
    } else if (fw === "Före 1980" || fw === "Äldre klassiker (före 1980)") {
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
  movie: {
    tmdbGenreIds?: number[];
    year?: string;
    runtime?: string;
    runtimeMinutes?: number;
    mediaType?: "movie" | "tv";
    seasonCount?: number;
    episodeRuntimeMinutes?: number;
    tvStatus?: string;
    originalLanguage?: string;
  },
  preferences: EveningPreferences
): {
  verified: boolean;
  matchedRuleCount: number;
  totalRuleCount: number;
  matchRatio: number;
} {
  const { genreRules, minYear, maxYear } =
    extractTmdbVerificationRules(preferences);
  const failResult = {
    verified: false,
    matchedRuleCount: 0,
    totalRuleCount: genreRules.length + 1,
    matchRatio: 0,
  };

  // Check TV series length & format rules
  const moods = preferences.moods || [];
  const frameworks = preferences.frameworks || [];
  const hasSeriesRule = hasSeriesLengthFilter(preferences);

  if (hasSeriesRule && movie.mediaType === "movie") {
    return failResult;
  }

  const rtLower = (movie.runtime || "").toLowerCase();
  const seasonMatch = rtLower.match(/(\d+)\s*säsong/);
  const parsedSeasons = seasonMatch ? Number(seasonMatch[1]) : undefined;
  const seasons =
    typeof movie.seasonCount === "number" && movie.seasonCount > 0
      ? movie.seasonCount
      : parsedSeasons;

  const wantsMini =
    moods.includes("Miniserie") || moods.includes("Miniserie (1 kort säsong)");
  const wants1to2 =
    moods.includes("1–2 säsonger") ||
    moods.includes("Kort serie (1–2 säsonger)");
  const wants3to5 =
    moods.includes("3–5 säsonger") ||
    moods.includes("Mellanlång serie (3–5 säsonger)");
  const wants6plus =
    moods.includes("6+ säsonger") ||
    moods.includes("Långkörare (6+ säsonger)");
  const wantsShortEps = moods.includes("Korta avsnitt");
  const wantsEnded =
    moods.includes("Avslutad serie") ||
    moods.includes("Avslutad serie (helt färdig)");

  if (seasons !== undefined && seasons > 0) {
    if (wantsMini && seasons !== 1) {
      return failResult;
    }
    if (wants1to2 && (seasons < 1 || seasons > 2)) {
      return failResult;
    }
    if (wants3to5 && (seasons < 3 || seasons > 5)) {
      return failResult;
    }
    if (wants6plus && seasons < 6) {
      return failResult;
    }
  }

  if (
    wantsShortEps &&
    typeof movie.episodeRuntimeMinutes === "number" &&
    movie.episodeRuntimeMinutes > 35
  ) {
    return failResult;
  }

  if (wantsEnded && movie.tvStatus) {
    const statusLower = movie.tvStatus.toLowerCase();
    if (statusLower !== "ended" && statusLower !== "canceled") {
      return failResult;
    }
  }

  // Check movie runtime rules (Max 90 min, Max 2 tim, Över 2 tim)
  const runtimeMinutes =
    typeof movie.runtimeMinutes === "number" && movie.runtimeMinutes > 0
      ? movie.runtimeMinutes
      : parseRuntimeMinutes(movie.runtime);
  const wantsMax90 =
    moods.includes("Max 90 min") || moods.includes("Max 90 minuter");
  const wantsMax120 =
    moods.includes("Max 2 tim") ||
    moods.includes("Max 2 timmar") ||
    frameworks.includes("Max 2 timmar");
  const wantsOver120 =
    moods.includes("Över 2 tim") ||
    moods.includes("2+ timmar (Långfilm)") ||
    frameworks.includes("2+ timmar (Långfilm)");

  if (runtimeMinutes !== undefined && runtimeMinutes > 0) {
    if (wantsMax90 && runtimeMinutes > 90) {
      return failResult;
    }
    if (wantsMax120 && runtimeMinutes > 120) {
      return failResult;
    }
    if (wantsOver120 && runtimeMinutes < 120) {
      return failResult;
    }
  }

  // Check Anime / Studio Ghibli Japanese language requirement when originalLanguage is known
  const allSelected = [
    ...(preferences.genres || []),
    ...(preferences.contents || []),
    ...(preferences.frameworks || []),
    ...moods,
  ];
  const wantsAnime = allSelected.some((c) =>
    [
      "Anime",
      "Anime / Japansk animation",
      "Studio Ghibli",
      "Studio Ghibli-känsla",
    ].includes(c)
  );
  if (wantsAnime && movie.originalLanguage && movie.originalLanguage !== "ja") {
    return failResult;
  }

  // Check Swedish language requirement when Sverige or Stockholm is explicitly chosen
  const wantsSwedish = (preferences.frameworks || []).some((c) =>
    ["Sverige", "Stockholm"].includes(c)
  );
  if (wantsSwedish && movie.originalLanguage && movie.originalLanguage !== "sv") {
    return failResult;
  }

  // Check release year against TMDB year if era filter was chosen
  if (minYear !== undefined || maxYear !== undefined) {
    const yearNum = Number((movie.year || "").replace(/[^0-9]/g, "").slice(0, 4));
    if (yearNum > 1900) {
      if (minYear !== undefined && yearNum < minYear) {
        return failResult;
      }
      if (maxYear !== undefined && yearNum > maxYear) {
        return failResult;
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
    // TMDB TV has no Music genre (10402); allow Drama/Comedy/Animation for TV musical shows
    const effectiveIds =
      rule.id === "music" && movie.mediaType === "tv"
        ? [...rule.allowedGenreIds, 18, 35, 16]
        : rule.allowedGenreIds;
    if (effectiveIds.some((gid) => idSet.has(gid))) {
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
    runtimeMinutes?: number;
    mediaType?: "movie" | "tv";
    seasonCount?: number;
    episodeRuntimeMinutes?: number;
    tvStatus?: string;
    originalLanguage?: string;
    matchPercentage?: number;
  }
>(movies: T[], preferences: EveningPreferences): T[] {
  const { genreRules, minYear, maxYear } =
    extractTmdbVerificationRules(preferences);
  const hasSeriesLengthRule = hasSeriesLengthFilter(preferences);
  const hasMovieRuntimeRule = hasMovieLengthFilter(preferences);
  const wantsAnime = [
    ...(preferences.genres || []),
    ...(preferences.contents || []),
  ].some((c) =>
    [
      "Anime",
      "Anime / Japansk animation",
      "Studio Ghibli",
      "Studio Ghibli-känsla",
    ].includes(c)
  );
  if (
    genreRules.length === 0 &&
    minYear === undefined &&
    maxYear === undefined &&
    !hasSeriesLengthRule &&
    !hasMovieRuntimeRule &&
    !wantsAnime
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
  dislikedCategories?: string[];
}

export const GENRE_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "action",
    label: "Action",
    subchips: [
      "Actionromans",
      "Actionkomedi",
      "Kampsport",
      "Spioner",
      "Kupp",
      "Hämndaction",
      "Biljakter",
      "Militär",
      "Lönnmördare",
      "Explosivt",
      "Sci-Fi-action",
    ],
  },
  {
    id: "comedy",
    label: "Komedi",
    subchips: [
      "Romantisk komedi",
      "Actionkomedi",
      "Svart komedi",
      "Omaka par",
      "Kriminalkomedi",
      "Feelgood",
      "Parodi",
      "Satir",
      "Urflippad",
      "Ungdomskomedi",
      "Dramakomedi",
    ],
  },
  {
    id: "thriller",
    label: "Thriller & Spänning",
    subchips: [
      "Psykologisk",
      "Seriemördare",
      "Mysterium",
      "Överlevnad",
      "Konspiration",
      "Spionthriller",
      "Gisslandrama",
      "Hämndthriller",
      "Hackers",
      "Katastrof",
    ],
  },
  {
    id: "scifi",
    label: "Sci-Fi",
    subchips: [
      "Rymdäventyr",
      "Tidsresor",
      "AI",
      "Robotar",
      "Dystopi",
      "Postapokalyps",
      "Utomjordingar",
      "Klurig Sci-Fi",
      "Realistisk Sci-Fi",
      "Sci-Fi-skräck",
      "Experiment",
      "Retro-Sci-Fi",
    ],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    subchips: [
      "Drakar",
      "Mörk fantasy",
      "Magi",
      "Mytologi",
      "Mörk saga",
      "Nutida fantasy",
      "Riddare",
      "Annan värld",
    ],
  },
  {
    id: "crime",
    label: "Krim & Mysterium",
    subchips: [
      "Mordgåta",
      "Mörk deckare",
      "Maffia",
      "Polis",
      "Detektiv",
      "Seriemördarjakt",
      "Bankrån",
      "Rättssalsdrama",
      "Verkliga brott",
      "Undercover",
    ],
  },
  {
    id: "horror",
    label: "Skräck",
    subchips: [
      "Psykologisk skräck",
      "Spöken",
      "Monster",
      "Slasher",
      "Sekter",
      "Rymdskräck",
      "Zombies",
      "Skräckkomedi",
      "Handkamera",
      "Vampyrer",
    ],
  },
  {
    id: "drama",
    label: "Drama",
    subchips: [
      "Känslostarkt",
      "Biografi",
      "Karaktärsstudie",
      "Familjedrama",
      "Relationsdrama",
      "Kostymdrama",
      "Sportdrama",
      "Fängelsedrama",
      "Musikdrama",
      "Uppväxt",
    ],
  },
  {
    id: "romance",
    label: "Romantik",
    subchips: [
      "Romantisk komedi",
      "Actionromans",
      "Storslagen kärlek",
      "Rivaler blir kära",
      "Förbjuden kärlek",
      "Olycklig kärlek",
      "Historisk romans",
      "Sci-Fi-romans",
    ],
  },
  {
    id: "adventure",
    label: "Äventyr & Krig",
    subchips: [
      "Skattjakt",
      "Vildmark",
      "Krigsfilm",
      "Andra världskriget",
      "Vikingar",
      "Gladiatorer",
      "Pirater",
      "Vilda Västern",
      "Roadtrip",
    ],
  },
  {
    id: "animation",
    label: "Animerat",
    subchips: [
      "Anime",
      "Studio Ghibli",
      "Pixar",
      "Disney",
      "Vuxenanimation",
      "Animerad action",
      "Familjefilm",
    ],
  },
  {
    id: "documentary",
    label: "Dokumentär",
    subchips: [
      "Natur",
      "Verkliga brott",
      "Historia",
      "Sport",
      "Musik",
      "Vetenskap",
    ],
  },
  {
    id: "superhero",
    label: "Superhjältar",
    subchips: [
      "Marvel",
      "DC",
      "Antihjältar",
      "Mörka hjältar",
      "Superkrafter",
      "Hjälteteam",
    ],
  },
  {
    id: "family",
    label: "Familj",
    subchips: [
      "Barnfilm",
      "Familjeäventyr",
      "Familjekomedi",
      "Djur",
      "Sagovärld",
      "Julfilm",
    ],
  },
  {
    id: "musical",
    label: "Musikal",
    subchips: [
      "Klassisk musikal",
      "Dansfilm",
      "Musikbiografi",
      "Konsert",
      "Rock",
      "Pop",
    ],
  },
];

export const CONTENT_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "plot-twist",
    label: "Twist & Gåta",
    subchips: [
      "Oväntad twist",
      "Opålitlig berättare",
      "Dubbelliv",
      "Dröm eller verklighet",
      "Minnesförlust",
      "Psykologiskt spel",
    ],
  },
  {
    id: "crime-investigation",
    label: "Krim & Utredning",
    subchips: [
      "Deckargåta",
      "Slutet sällskap",
      "Katt och råtta",
      "Gåtfull mördare",
      "Konspiration",
      "Oskyldigt anklagad",
    ],
  },
  {
    id: "heist-plan",
    label: "Kupp & Heist",
    subchips: [
      "Smart kupp",
      "Bankrån",
      "Maffiakrig",
      "Bluff",
      "Infiltration",
    ],
  },
  {
    id: "combat-action",
    label: "Strid & Action",
    subchips: [
      "Svärdsstrider",
      "Närkamp",
      "En mot alla",
      "Turnering",
      "Prisjägare",
    ],
  },
  {
    id: "revenge-justice",
    label: "Hämnd & Skydd",
    subchips: [
      "Hämnd",
      "Skydda någon",
      "Mörkt förflutet",
      "Egen rättvisa",
    ],
  },
  {
    id: "survival-threat",
    label: "Överlevnad & Hot",
    subchips: [
      "Överlevnad",
      "Instängda",
      "Naturkatastrof",
      "Pandemi",
      "Räddningsuppdrag",
    ],
  },
  {
    id: "fantasy-creatures",
    label: "Monster & Fantasy",
    subchips: [
      "Monsterjakt",
      "Utvald hjälte",
      "Uråldrig magi",
      "Mytologiska väsen",
    ],
  },
  {
    id: "lore-time",
    label: "Tidsresor & Sci-Fi",
    subchips: [
      "Tidsresor",
      "Tidsloop",
      "Parallella världar",
      "Levande AI",
      "Stort världsbygge",
    ],
  },
  {
    id: "character-real",
    label: "Karaktärer & Verklighet",
    subchips: [
      "Verklighetsbaserat",
      "Omaka par",
      "Rivalitet",
      "Mästare och lärjunge",
      "Underdog",
      "Hemligt sällskap",
    ],
  },
  {
    id: "power-politics",
    label: "Makt & Politik",
    subchips: [
      "Maktspel",
      "Politik",
      "Korruption",
      "Kungahus",
      "Företagsdrama",
      "Intriger",
    ],
  },
  {
    id: "friendship-relations",
    label: "Vänskap & Relationer",
    subchips: [
      "Vänskap",
      "Familjekonflikt",
      "Ny start",
      "Skilsmässa",
      "Föräldraskap",
      "Grannar",
    ],
  },
];

export const SETTING_GROUPS: readonly ExpandableChipGroup[] = [
  {
    id: "space-future",
    label: "Rymd & Framtid",
    subchips: [
      "Rymdskepp",
      "Främmande planet",
      "Framtidsstad",
      "Ödemark",
      "Nära framtid",
    ],
  },
  {
    id: "isolated",
    label: "Isolerade platser",
    subchips: [
      "Öde ö",
      "Stuga",
      "Herrgård",
      "Fängelse",
      "Fartyg",
      "Ubåt",
      "Tåg",
      "Flygplan",
      "Hotell",
      "Bunker",
    ],
  },
  {
    id: "nature-wilderness",
    label: "Natur & Vildmark",
    subchips: [
      "Skog",
      "Berg",
      "Vinter",
      "Öken",
      "Kust",
    ],
  },
  {
    id: "city-vibe",
    label: "Städer & Metropoler",
    subchips: [
      "Storstad",
      "Småstad",
      "London",
      "New York",
      "Tokyo",
    ],
  },
  {
    id: "sweden-nordic",
    label: "Sverige & Norden",
    subchips: [
      "Sverige",
      "Norden",
      "Europa",
      "Stockholm",
      "Landsbygd",
    ],
  },
  {
    id: "school-work",
    label: "Skola & Jobb",
    subchips: [
      "Skola",
      "Universitet",
      "Sjukhus",
      "Kontor",
      "Restaurang",
      "Advokatbyrå",
    ],
  },
  {
    id: "history-ancient-medieval",
    label: "Forntid & Medeltid",
    subchips: [
      "Antiken",
      "Vikingatid",
      "Medeltid",
      "1700-tal",
      "1800-tal",
    ],
  },
  {
    id: "history-modern-era",
    label: "1900-tal & Western",
    subchips: [
      "Vilda Västern",
      "1920-tal",
      "1940-tal",
      "1970-tal",
      "1980-tal",
    ],
  },
  {
    id: "release-decade",
    label: "Utgivningsår",
    subchips: [
      "2020-talet",
      "2010-talet",
      "2000-talet",
      "1990-talet",
      "1980-talet",
      "Före 1980",
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
      "Mörk",
      "Rå",
      "Nagelbitande",
      "Kuslig",
      "Klaustrofobisk",
      "Hög puls",
    ],
  },
  {
    id: "mind-smart",
    label: "Smart & Psykologisk",
    subchips: [
      "Klurig",
      "Gåtfull",
      "Tankeväckande",
      "Oförutsägbar",
      "Drömsk",
    ],
  },
  {
    id: "warm-feelgood",
    label: "Feelgood & Mys",
    subchips: [
      "Mysig",
      "Feelgood",
      "Lättsam",
      "Nostalgisk",
      "Slökolla",
      "Avkopplande",
    ],
  },
  {
    id: "humor-romance",
    label: "Humor & Romantik",
    subchips: [
      "Rolig",
      "Charmig",
      "Romantisk",
      "Skarp dialog",
      "Knasig",
    ],
  },
  {
    id: "epic-grand",
    label: "Episk & Spektakulär",
    subchips: [
      "Storslagen",
      "Snyggt foto",
      "Inspirerande",
    ],
  },
  {
    id: "emotional-moving",
    label: "Känslosam & Gripande",
    subchips: [
      "Gripande",
      "Vemodig",
      "Hjärtekrossande",
      "Tårframkallande",
    ],
  },
  {
    id: "pace-tempo",
    label: "Berättartempo",
    subchips: [
      "Högt tempo",
      "Långsamt tempo",
      "Intensivt",
      "Lugnt",
      "Mästerverk",
      "Dold pärla",
    ],
  },
  {
    id: "format-length",
    label: "Speltid & Längd",
    subchips: [
      "Max 90 min",
      "Max 2 tim",
      "Över 2 tim",
      "Miniserie",
      "1–2 säsonger",
      "3–5 säsonger",
      "6+ säsonger",
      "Korta avsnitt",
      "Avslutad serie",
    ],
  },
];

export const MOVIE_LENGTH_SUBCHIPS: readonly string[] = [
  "Max 90 min",
  "Max 2 tim",
  "Över 2 tim",
];

export const TV_SERIES_LENGTH_SUBCHIPS: readonly string[] = [
  "Miniserie",
  "1–2 säsonger",
  "3–5 säsonger",
  "6+ säsonger",
  "Korta avsnitt",
  "Avslutad serie",
];

export function formatSelectedChipsWithContext(
  chips: readonly string[] | undefined,
  groups: readonly ExpandableChipGroup[]
): string[] {
  if (!Array.isArray(chips) || chips.length === 0) return [];
  const chipSet = new Set(chips);
  return chips.map((chip) => {
    // If it's a main group label itself, keep as-is
    if (groups.some((g) => g.label === chip)) return chip;
    // Find parent groups containing this subchip
    const parents = groups.filter((g) => g.subchips.includes(chip));
    if (parents.length === 1) {
      const parentLabel = parents[0].label;
      // Avoid redundant parenthetical if parent is already selected or chip already contains parent word
      if (
        chipSet.has(parentLabel) ||
        chip.toLowerCase().includes(parentLabel.toLowerCase())
      ) {
        return chip;
      }
      return `${chip} (${parentLabel})`;
    }
    if (parents.length > 1) {
      const selectedParent = parents.find((p) => chipSet.has(p.label));
      if (selectedParent) {
        return chip;
      }
      return `${chip} (${parents.map((p) => p.label).join(" / ")})`;
    }
    return chip;
  });
}

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
    tmdbId: 61889,
    title: "Daredevil",
    originalTitle: "Marvel's Daredevil",
    year: "2015",
    mediaType: "tv",
    voteAverage: 8.2,
    tmdbGenreIds: [10759, 80, 18],
    tmdbGenres: ["Action & Äventyr", "Krim", "Drama"],
    ageRating: "15+",
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.DISNEY],
    },
  },
  {
    tmdbId: 95557,
    title: "Invincible",
    originalTitle: "Invincible",
    year: "2021",
    mediaType: "tv",
    voteAverage: 8.6,
    tmdbGenreIds: [16, 10765, 10759, 18],
    tmdbGenres: ["Animerat", "Sci-Fi & Fantasy", "Action & Äventyr", "Drama"],
    ageRating: "15+",
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.PRIME],
    },
  },
  {
    tmdbId: 79788,
    title: "Watchmen",
    originalTitle: "Watchmen",
    year: "2019",
    mediaType: "tv",
    voteAverage: 7.9,
    tmdbGenreIds: [10765, 18, 9648, 10759],
    tmdbGenres: ["Sci-Fi & Fantasy", "Drama", "Mysterium", "Action & Äventyr"],
    ageRating: "15+",
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
    },
  },
  {
    tmdbId: 110492,
    title: "Peacemaker",
    originalTitle: "Peacemaker",
    year: "2022",
    mediaType: "tv",
    voteAverage: 8.3,
    tmdbGenreIds: [10759, 35, 10765],
    tmdbGenres: ["Action & Äventyr", "Komedi", "Sci-Fi & Fantasy"],
    ageRating: "15+",
    swedishProviders: {
      type: "flatrate",
      providers: [PROVIDERS.MAX],
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

const CANONICAL_FRANCHISE_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: "harry potter", pattern: /\bharry potter\b/ },
  {
    key: "lord of the rings",
    pattern:
      /\b(lord of the rings|sagan om ringen|sagan om de tva tornen|sagan om konungens aterkomst|harskarringen)\b/,
  },
  { key: "star wars", pattern: /\b(star wars|stjarnornas krig)\b/ },
  { key: "indiana jones", pattern: /\bindiana jones\b/ },
  { key: "jurassic", pattern: /\bjurassic (park|world)\b/ },
  { key: "batman", pattern: /\b(batman|the dark knight)\b/ },
  { key: "bourne", pattern: /\bthe bourne\b|\bjason bourne\b/ },
  { key: "fast furious", pattern: /\b(fast\s*(and|&)?\s*furious|fast x|the fast and the furious)\b/ },
  { key: "28 days later", pattern: /\b28 (days|weeks|years) later\b/ },
  { key: "hunger games", pattern: /\b(hunger games|hungerspelen)\b/ },
  { key: "mission impossible", pattern: /\bmission impossible\b/ },
  { key: "pirates of the caribbean", pattern: /\bpirates of the caribbean\b/ },
  { key: "how to train your dragon", pattern: /\b(how to train your dragon|draktranaren)\b/ },
  { key: "despicable me", pattern: /\b(despicable me|dumma mej|minions|minioner)\b/ },
  { key: "kung fu panda", pattern: /\bkung fu panda\b/ },
  { key: "shrek", pattern: /\bshrek\b/ },
  { key: "spiderman", pattern: /\bspider\s*man\b/ },
  { key: "avengers", pattern: /\bavengers\b/ },
  { key: "john wick", pattern: /\bjohn wick\b/ },
  { key: "godzilla", pattern: /\bgodzilla\b/ },
  { key: "avatar", pattern: /^avatar(\b|$)/ },
  { key: "a quiet place", pattern: /\ba quiet place\b/ },
  { key: "toy story", pattern: /\btoy story\b/ },
  { key: "the godfather", pattern: /\b(the godfather|gudfadern)\b/ },
  { key: "frozen", pattern: /^(frozen|frost)(\s+\d+|\s*:|$)/ },
  { key: "moana", pattern: /^(moana|vaiana)(\s+\d+|\s*:|$)/ },
  { key: "terminator", pattern: /\bterminator\b/ },
  { key: "dune", pattern: /^dune(\s*:|\s+part|\s+\d+|$)/ },
  { key: "rocky", pattern: /^rocky(\s+[ivx]+|\s+\d+|\s*:|$)/ },
  { key: "alien", pattern: /^aliens?(\s*:|\s+\d+|\s+vs|\s+romulus|\s+covenant|\s+resurrection|$)/ },
  { key: "paddington", pattern: /^paddington(\b|$)/ },
  { key: "hotel transylvania", pattern: /\b(hotel transylvania|hotell transylvanien)\b/ },
  { key: "puss in boots", pattern: /\b(puss in boots|masterkatten)\b/ },
  { key: "knives out", pattern: /\b(knives out|glass onion)\b/ },
];

function extractBaseFranchiseFromSingleTitle(raw?: string): string {
  if (!raw || !raw.trim()) return "";

  const normalizedFull = normalizeMovieTitle(raw);
  if (!normalizedFull) return "";

  for (const { key, pattern } of CANONICAL_FRANCHISE_PATTERNS) {
    if (pattern.test(normalizedFull)) {
      return key;
    }
  }

  // Strip subtitle after colon or spaced dash when prefix is meaningful (>= 4 chars)
  let base = raw.trim();
  const sepMatch = base.match(/^(.{4,}?)(?:\s*:\s*|\s+[-–—]\s+).+$/);
  if (sepMatch && sepMatch[1].trim().length >= 4) {
    base = sepMatch[1].trim();
  }

  let norm = normalizeMovieTitle(base);
  // Strip trailing sequel markers like "del 2", "del ii", "part two", "chapter 3", "vol 2"
  norm = norm
    .replace(/\b(del|part|chapter|vol|volume)\s+(one|two|three|four|five|six|i|ii|iii|iv|v|vi|\d+)\b$/i, "")
    .trim();
  // Strip trailing small sequel numbers (2-9) or Roman numerals (ii-vi) when base has >= 3 chars
  const withoutTrailingNum = norm.replace(/\s+(?:[2-9]|ii|iii|iv|v|vi)$/i, "").trim();
  if (withoutTrailingNum.length >= 3) {
    norm = withoutTrailingNum;
  }

  return norm || normalizedFull;
}

export function getMovieFranchiseKey(title?: string, originalTitle?: string): string {
  const fromOrig = extractBaseFranchiseFromSingleTitle(originalTitle);
  const fromTitle = extractBaseFranchiseFromSingleTitle(title);

  // If either matched a canonical franchise key, prefer that so Swedish & English titles map identically
  for (const { key } of CANONICAL_FRANCHISE_PATTERNS) {
    if (fromOrig === key || fromTitle === key) return key;
  }

  return fromOrig || fromTitle;
}

export function limitOnePerFranchise<
  T extends { title: string; originalTitle?: string; isExactPinpointMatch?: boolean }
>(list: T[]): T[] {
  const seenFranchises = new Set<string>();
  const result: T[] = [];
  for (const item of list) {
    if (item.isExactPinpointMatch) {
      result.push(item);
      continue;
    }
    const fKey = getMovieFranchiseKey(item.title, item.originalTitle);
    if (fKey && seenFranchises.has(fKey)) continue;
    if (fKey) seenFranchises.add(fKey);
    result.push(item);
  }
  return result;
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
  if (exact) {
    return {
      ...exact,
      ageRating:
        normalizeSwedishAgeRating(exact.ageRating) ||
        inferAgeRatingFromGenres(exact.tmdbGenreIds),
      seasonCount:
        exact.seasonCount ||
        (exact.mediaType === "tv" ? getSeriesSeasonCount(exact.title) : undefined),
    };
  }

  const partial = CURATED_TMDB_MOVIES.find(
    (m) =>
      (norm.length >= 3 && normalizeMovieTitle(m.title).includes(norm)) ||
      (norm.length >= 3 && norm.includes(normalizeMovieTitle(m.title)))
  );
  if (partial) {
    return {
      ...partial,
      ageRating:
        normalizeSwedishAgeRating(partial.ageRating) ||
        inferAgeRatingFromGenres(partial.tmdbGenreIds),
      seasonCount:
        partial.seasonCount ||
        (partial.mediaType === "tv"
          ? getSeriesSeasonCount(partial.title)
          : undefined),
    };
  }

  // Check if title is in known TV series dictionary
  const knownSeasonCount = KNOWN_SERIES_SEASON_COUNTS[norm];

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
    mediaType: knownSeasonCount ? "tv" : undefined,
    seasonCount: knownSeasonCount,
    voteAverage: Math.round(voteAverage * 10) / 10,
    swedishProviders: { type: "none", providers: [] },
    ageRating: "11+",
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
  watchlist: MovieRecommendation[],
  previousTitles: string[] = []
): MovieRecommendation[] {
  const seen = new Set<string>();
  const previousNorms = new Set(
    (previousTitles || [])
      .map((t) => normalizeMovieTitle(t))
      .filter(Boolean)
  );
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

    // Strictly skip movies already presented to the user
    if (
      (normTitle && previousNorms.has(normTitle)) ||
      (normOrig && previousNorms.has(normOrig))
    ) {
      continue;
    }

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
    const effectiveTags = new Set(movie.tags || []);
    if (Array.isArray(movie.seasons)) {
      for (const s of movie.seasons) {
        for (const stag of s.tags || []) {
          effectiveTags.add(stag);
        }
      }
    }
    for (const tag of effectiveTags) {
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
        mediaType: m.mediaType === "tv" ? "tv" : m.mediaType === "movie" ? "movie" : undefined,
        seasonCount: m.seasonCount ? Number(m.seasonCount) : undefined,
        seasons: Array.isArray(m.seasons)
          ? m.seasons
              .filter(
                (s: unknown) =>
                  Boolean(
                    s &&
                      typeof s === "object" &&
                      typeof (s as SeasonRating).seasonNumber === "number"
                  )
              )
              .map((s: Partial<SeasonRating>) => ({
                seasonNumber: Number(s.seasonNumber),
                rating: Math.min(5, Math.max(1, Number(s.rating) || 3)),
                liked:
                  typeof s.liked === "boolean"
                    ? s.liked
                    : (Number(s.rating) || 3) >= 3,
                tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
                thoughts: s.thoughts ? String(s.thoughts) : undefined,
              }))
          : undefined,
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
        mediaType: m.mediaType === "tv" ? "tv" : m.mediaType === "movie" ? "movie" : undefined,
      }));

    const tasteProfileSummary =
      typeof parsed.tasteProfileSummary === "string"
        ? parsed.tasteProfileSummary
        : DEFAULT_TASTE_PROFILE;

    const dislikedCategories = Array.isArray(parsed.dislikedCategories)
      ? parsed.dislikedCategories
          .map(String)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      : undefined;

    return {
      valid: true,
      data: {
        version: Number(parsed.version) || 1,
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        watchedMovies,
        watchlist,
        tasteProfileSummary,
        ...(dislikedCategories && dislikedCategories.length > 0
          ? { dislikedCategories }
          : {}),
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
  previousTitles: string[] = [],
  dislikedCategories: string[] = [],
  targetCount = 5
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

  interface PromptWatchedEntry {
    title: string;
    rating: number;
    liked: boolean;
    tags: string[];
    thoughts?: string;
  }

  const promptEntries: PromptWatchedEntry[] = [];
  let hasSeasonSpecificRatings = false;

  for (const m of watchedMovies) {
    if (m.seasons && m.seasons.length > 0) {
      hasSeasonSpecificRatings = true;
      for (const s of m.seasons) {
        promptEntries.push({
          title: `${m.title} (Säsong ${s.seasonNumber})`,
          rating: s.rating,
          liked: s.liked,
          tags: s.tags && s.tags.length > 0 ? s.tags : m.tags,
          thoughts:
            s.thoughts ||
            (m.thoughts ? `[Seriehelhet: ${m.thoughts}]` : undefined),
        });
      }
    } else {
      promptEntries.push({
        title: m.title,
        rating: m.rating,
        liked: m.liked,
        tags: m.tags,
        thoughts: m.thoughts,
      });
    }
  }

  const lovedMovies = promptEntries.filter(
    (m) => m.rating >= 4 && m.liked !== false
  );
  const dislikedMovies = promptEntries.filter(
    (m) => m.rating <= 2 || m.liked === false
  );
  const neutralMovies = promptEntries.filter(
    (m) => m.rating === 3 && m.liked !== false
  );

  const formatMovieLine = (m: PromptWatchedEntry) =>
    `- "${m.title}" (${m.rating}/5 stjärnor, ${
      m.liked ? "Gillade" : "Gillade inte"
    }) | Kvaliteter: [${(m.tags || []).join(", ")}]${
      m.thoughts ? ` | Egna tankar: "${m.thoughts}"` : ""
    }`;

  const seasonInstruction = hasSeasonSpecificRatings
    ? `\n\nVIKTIG REGEL FÖR SÄSONGSBETYG PÅ SERIER: Användaren har angett olika betyg på olika säsonger av samma serie (t.ex. en säsong med högt betyg och en annan med lågt betyg). Slå ALDRIG ihop serien till ett platt medelbetyg! Du MÅSTE analysera exakt vad som gjorde favoritsäsongen fantastisk (t.ex. skarp regi, intimt mysterium, spännande tempo) och vad som gjorde den svagare säsongen ogillad (t.ex. seg handling, förlorad riktning), och styra rekommendationerna därefter.`
    : "";

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
            ? `OGILLADE FILMER & SÄSONGER (1–2 stjärnor / Gillade inte – UNDVIK filmer/serier med denna ton, kliché eller svaghet även inom kvällens kategorier!):\n${dislikedMovies
                .map(formatMovieLine)
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n") + seasonInstruction
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
    if (m === "Miniserie" || m === "Miniserie (1 kort säsong)") {
      tvLengthRules.push(
        `- MINISERIE (100% HÅRT KRAV): Rekommendera ENDAST miniserier / begränsade serier med exakt 1 säsong (ca 3–10 avsnitt totalt, t.ex. Chernobyl, Band of Brothers, Mare of Easttown, The Queen's Gambit). Föreslå ALDRIG serier med flera säsonger!`
      );
    } else if (m === "1–2 säsonger" || m === "Kort serie (1–2 säsonger)") {
      tvLengthRules.push(
        `- KORT SERIE (100% HÅRT KRAV): Rekommendera ENDAST serier som har max 1 eller 2 säsonger (t.ex. Mindhunter, Severance, Shōgun, Arcane, Andor). Föreslå ALDRIG långa serier med 3+ säsonger!`
      );
    } else if (
      m === "3–5 säsonger" ||
      m === "Mellanlång serie (3–5 säsonger)"
    ) {
      tvLengthRules.push(
        `- MELLANLÅNG SERIE (100% HÅRT KRAV): Rekommendera ENDAST serier som har 3 till 5 säsonger (t.ex. Dark 3 säsonger, Succession 4 säsonger, Breaking Bad 5 säsonger, The Boys, Stranger Things).`
      );
    } else if (m === "6+ säsonger" || m === "Långkörare (6+ säsonger)") {
      tvLengthRules.push(
        `- LÅNGKÖRARE (100% HÅRT KRAV): Rekommendera ENDAST långa serier med minst 6 säsonger att sträckkolla (t.ex. Game of Thrones 8 säsonger, The Sopranos 6 säsonger, Better Call Saul 6 säsonger, Peaky Blinders 6 säsonger, Dexter 8 säsonger, The Shield 7 säsonger, Mad Men 7 säsonger, Suits 9 säsonger, The Office 9 säsonger). Föreslå ALDRIG miniserier eller korta serier på 1–3 säsonger!`
      );
    } else if (
      m === "Korta avsnitt" ||
      m === "Korta avsnitt (ca 20–30 min)"
    ) {
      tvLengthRules.push(
        `- KORTA AVSNITT (100% HÅRT KRAV): Rekommendera ENDAST serier där avsnitten är ca 20–35 minuter långa (t.ex. The Bear, Barry, Fleabag, The Office, Silicon Valley).`
      );
    } else if (
      m === "Avslutad serie" ||
      m === "Avslutad serie (helt färdig)"
    ) {
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

  const steering = preferences.steering;
  const steeringPromptLines = buildSteeringPromptLines(steering);
  const steeringInstruction =
    steering && steering.anchorMovie?.title
      ? `
STYRNING & VIDARESÖKNING UTIFRÅN VALD FILM (HÖGSTA PRIORITET – FÖLJ EXAKT!):
- Användaren valde "${steering.anchorMovie.title}"${
          steering.anchorMovie.year ? ` (${steering.anchorMovie.year})` : ""
        }${
          steering.anchorMovie.runtime ? `, speltid: ${steering.anchorMovie.runtime}` : ""
        }${
          steering.anchorMovie.originalTitle &&
          steering.anchorMovie.originalTitle !== steering.anchorMovie.title
            ? ` [Originaltitel: ${steering.anchorMovie.originalTitle}]`
            : ""
        } som en titel som är "åt rätt håll" ikväll!${
          steering.anchorMovie.tmdbGenres && steering.anchorMovie.tmdbGenres.length > 0
            ? `\n- Referensfilmens genrer: ${steering.anchorMovie.tmdbGenres.join(", ")}`
            : ""
        }${
          steering.anchorMovie.vibeTags && steering.anchorMovie.vibeTags.length > 0
            ? `\n- Referensfilmens vibe: ${steering.anchorMovie.vibeTags.join(", ")}`
            : ""
        }
- DIN UPPGIFT: Utgå från kärnkänslan, kvaliteten och dragningskraften i "${steering.anchorMovie.title}", men STYR samtliga 5 nya förslag i exakt den riktning användaren ställt in med reglagen och snabbjusteringarna:
${
  steeringPromptLines.length > 0
    ? steeringPromptLines.map((line) => `  * ${line}`).join("\n")
    : "  * Behåll i stort sett samma känsla, tempo och ton som i referensfilmen, men ge 5 helt nya och lika träffsäkra alternativ."
}
- Föreslå ALDRIG "${steering.anchorMovie.title}" själv igen.
- VIKTIGT FÖR MOTIVERINGEN ("whyYouWillLikeIt"): Förklara tydligt och konkret hur varje ny film/serie bygger vidare på "${steering.anchorMovie.title}" och på vilket sätt den uppfyller styrningen och eventuella snabbjusteringar.
`
      : "";

  return `Du är CineMinde – en elitskribent och expert på både film och TV-serier på svenska. Din uppgift är att rekommendera exakt ${targetCount} skräddarsydda titlar för ikväll som en JSON-array.

${mediaInstruction}
${steeringInstruction}

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
${
  previousTitles.length > 0
    ? `TOTALFÖRBUD MOT TIDIGARE VISADE / SWIPADE TITLAR:
Användaren har nyligen visats och bläddrat förbi följande titlar (totalt ${previousTitles.length} st):
${previousTitles.slice(-50).join(", ")}
TOTALFÖRBUD: Du får ALDRIG rekommendera någon av dessa titlar igen! Föreslå uteslutande helt NYA titlar som användaren inte har sett än.`
    : ""
}
- NORMALFALL: Du får ALDRIG rekommendera någon titel från listan över sedda eller watchlist ovan! Sätt "isExactPinpointMatch": false på alla 5 titlar.
- UNDANTAG ENDAST VID DETEKTIV-SÖKNING: Endast om användaren i Fritext beskriver en specifik handling, eller har kombinerat minst 4 mycket smala detaljkategorier som uppenbart pekar på en enda specifik titel som hen försöker komma på namnet på, får du ta med en redan sedd titel som #1 med "isExactPinpointMatch": true. Vid vanliga kategorival (som 1–3 genrer/teman) är det TOTALFÖRBJUDET att föreslå en redan sedd titel!

KVÄLLENS VALDA KATEGORIER & UNDERKATEGORIER ("IKVÄLL" – HÅRD RAM):
- Format (Film / Serie): ${mediaPref === "movie" ? "Endast Långfilm" : mediaPref === "tv" ? "Endast TV-serie / Miniserie" : "Både Film & Serie (välj det som passar kategorierna absolut bäst)"}
- Genrer & Undergenrer: ${(preferences.genres || []).length > 0 ? formatSelectedChipsWithContext(preferences.genres, GENRE_GROUPS).join(", ") : "Valfri"}
- Handling & Troper: ${preferences.contents.length > 0 ? formatSelectedChipsWithContext(preferences.contents, CONTENT_GROUPS).join(", ") : "Valfri"}
- Miljö, Plats & Tidsålder: ${preferences.frameworks.length > 0 ? formatSelectedChipsWithContext(preferences.frameworks, SETTING_GROUPS).join(", ") : "Valfri"}
- Stämning, Vibe & Tempo: ${preferences.moods.length > 0 ? formatSelectedChipsWithContext(preferences.moods, MOOD_GROUPS).join(", ") : "Valfri"}
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
${
  dislikedCategories.length > 0
    ? `
ANVÄNDARENS OGILLADE KATEGORIER / GENRER (TOTALFÖRBUD MOT OGILLADE KATEGORIER – 100% STRIKT KRAV):
Användaren har i sin smakprofil uttryckligen angett att hen ogillar och INTE vill ha förslag inom följande kategorier:
[${dislikedCategories.join(", ")}]
- TOTALFÖRBUD: Du får ALDRIG rekommendera filmer eller serier som tillhör, har inslag av eller huvudsakligen kretsar kring någon av dessa ogillade kategorier!`
    : ""
}

SVARSFORMAT (MÅSTE VARA EN GILTIG JSON-ARRAY MED EXAKT ${targetCount} OBJEKT – INGA TRAILING COMMAS):
Exempel på exakt fältstruktur för varje objekt i JSON-arrayen:
[
  {
    "title": "Titel i Sverige",
    "originalTitle": "Original Title",
    "year": "2019",
    "runtime": "2 tim 10 min (eller '1 säsong · 5 avsnitt' för serier)",
    "mediaType": "movie",
    "ageRating": "15+ (svensk åldersgräns: 'Btl', '7+', '11+' eller '15+')",
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
    matchingContents: ["Superhjältar", "Antihjältar", "Mörka hjältar", "Superkrafter", "Hämndberättelse", "Välkoreograferad action", "Konspiration & Hemligheter", "Action"],
    matchingQualityTags: ["Spänningen & Tempot", "Action- & Stridsscenerna", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "En grupp hänsynslösa vigilantes tar upp kampen mot korrupta superhjältar som missbrukar sin makt bakom en polerad fasad.",
    connectionReasonSwedish: "det kompromisslösa tempot, den svarta humorn och den intensiva spänningen",
  },
  {
    title: "Daredevil",
    originalTitle: "Marvel's Daredevil",
    year: "2015",
    runtime: "3 säsonger · ~55 min/avsnitt",
    runtimeMinutes: 55,
    yearNum: 2015,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Mörk superhjälte", "Rå närkamp", "Hell's Kitchen"],
    matchingMoods: ["Mörk & rå", "Spännande på helspänn", "Mellanlång serie (3–5 säsonger)"],
    matchingContents: ["Superhjältar", "Marvel", "Mörka hjältar", "Kampsport", "Närkamp", "Action", "Krim"],
    matchingQualityTags: ["Action- & Stridsscenerna", "Karaktärerna & Skådespeleriet", "Stämningen / Atmosfären"],
    hookSwedish: "Den blinde advokaten Matt Murdock bekämpar brottslighet i rättssalen på dagen och som maskerad vigilante på gatorna i Hell's Kitchen om natten.",
    connectionReasonSwedish: "den jordnära realismen, de råa en-tagningsstriderna och de starka karaktärerna",
  },
  {
    title: "Invincible",
    originalTitle: "Invincible",
    year: "2021",
    runtime: "3 säsonger · ~45 min/avsnitt",
    runtimeMinutes: 45,
    yearNum: 2021,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Vuxenanimation", "Brutal superhjälteserie", "Stark twist"],
    matchingMoods: ["Adrenalin & Puls", "Mörk & rå", "Spännande på helspänn", "Mellanlång serie (3–5 säsonger)"],
    matchingContents: ["Superhjältar", "Superkrafter", "Animerat", "Vuxenanimation", "Action", "Sci-Fi"],
    matchingQualityTags: ["Spänningen & Tempot", "Action- & Stridsscenerna", "Manuset & Dialogen"],
    hookSwedish: "Tonåringen Mark Grayson utvecklar superkrafter precis som sin pappa – jordens mäktigaste hjälte – men upptäcker snart en chockerande mörk sanning.",
    connectionReasonSwedish: "det skarpa berättandet, de brutala vändningarna och det höga känslomässiga insatserna",
  },
  {
    title: "Watchmen",
    originalTitle: "Watchmen",
    year: "2019",
    runtime: "1 säsong · 9 avsnitt",
    runtimeMinutes: 60,
    yearNum: 2019,
    mediaType: "tv",
    vibeTags: ["Miniserie", "Mörk superhjälte", "Smart konspiration", "Hyllat mästerverk"],
    matchingMoods: ["Mörk & rå", "Tankeväckande", "Miniserie", "Avslutad serie"],
    matchingContents: ["Superhjältar", "DC", "Mörka hjältar", "Antihjältar", "Mysterium", "Konspiration & Hemligheter", "Action"],
    matchingQualityTags: ["Manuset & Dialogen", "Världsbygget / Miljön", "Stämningen / Atmosfären"],
    hookSwedish: "I en alternativ nutid där maskerade poliser och gamla superhjältar lever under ytan nystar detektiven Angela Abar upp en djupt gående konspiration.",
    connectionReasonSwedish: "det briljanta världsbygget, det täta mysteriet och den vuxna, tankeväckande tonen",
  },
  {
    title: "Peacemaker",
    originalTitle: "Peacemaker",
    year: "2022",
    runtime: "2 säsonger · ~45 min/avsnitt",
    runtimeMinutes: 45,
    yearNum: 2022,
    mediaType: "tv",
    vibeTags: ["TV-serie", "Antihjälte", "Actionkomedi", "Skruvad humor"],
    matchingMoods: ["Rolig & rapp", "Adrenalin & Puls", "1–2 säsonger"],
    matchingContents: ["Superhjältar", "DC", "Antihjältar", "Hjälteteam", "Action", "Komedi", "Actionkomedi"],
    matchingQualityTags: ["Manuset & Dialogen", "Action- & Stridsscenerna", "Karaktärerna & Skådespeleriet"],
    hookSwedish: "Den skruvade antihjälten Peacemaker rekryteras till ett hemligt uppdrag fyllt av konspirationer, stenhård action och oväntat mycket hjärta.",
    connectionReasonSwedish: "den rappa humorn, den energiska actionkoreografin och den oväntade karaktärsutvecklingen",
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
  preferences: EveningPreferences,
  dislikedCategories: string[] = [],
  previousTitles: string[] = []
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

  const previousNorms = new Set(
    (previousTitles || []).map((t) => normalizeMovieTitle(t)).filter(Boolean)
  );

  const isAlreadyShown = (entry: { title: string; originalTitle?: string }) => {
    const t1 = normalizeMovieTitle(entry.title);
    const t2 = entry.originalTitle ? normalizeMovieTitle(entry.originalTitle) : "";
    return previousNorms.has(t1) || (t2 && previousNorms.has(t2));
  };

  const baseCandidates = FALLBACK_CATALOG.filter((entry) => {
    if (isMovieExcluded(entry, watchedMovies, watchlist)) return false;
    if (isAlreadyShown(entry)) return false;
    if (isMovieMatchingDislikedCategories(entry, dislikedCategories)) return false;
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
        .filter((w) => w.length >= 2 && !["eller", "under", "kring", "film", "och", "med", "som"].includes(w));
      return words.some((w) =>
        w.length <= 3
          ? new RegExp(`\\b${w}\\b`, "i").test(entrySearchText)
          : entrySearchText.includes(w.slice(0, 5))
      );
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
      } else {
        score -= 25;
      }
    } else if (totalChosenGenres === 1 && matchedGenreCount === 0) {
      // Penalize entries that don't match the user's chosen genre
      score -= 18;
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
      (preferences.moods.includes("Max 90 min") ||
        preferences.moods.includes("Max 90 minuter")) &&
      entry.runtimeMinutes <= 95
    ) {
      score += 4;
    }
    if (
      (preferences.moods.includes("Max 2 tim") ||
        preferences.moods.includes("Max 2 timmar") ||
        preferences.frameworks.includes("Max 2 timmar")) &&
      entry.runtimeMinutes <= 120
    ) {
      score += 4;
    }
    if (
      (preferences.moods.includes("Över 2 tim") ||
        preferences.moods.includes("2+ timmar (Långfilm)") ||
        preferences.frameworks.includes("2+ timmar (Långfilm)")) &&
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
      ageRating:
        tmdbMeta.ageRating || inferAgeRatingFromGenres(tmdbMeta.tmdbGenreIds),
    };
  });

  scored.sort((a, b) => {
    const diff = b.matchPercentage - a.matchPercentage;
    if (diff !== 0) return diff;
    // Tie-breaker: vary candidate ordering so fallback recommendations don't always start with the exact same 5 titles
    return (
      Math.sin(a.title.length * 31 + Number(a.year || 0)) -
      Math.sin(b.title.length * 31 + Number(b.year || 0))
    );
  });
  const tmdbVerified = filterAndVerifyMoviesByTmdbCategories(scored, preferences);
  return tmdbVerified.slice(0, 5);
}

export function generateSmartFallbackTasteProfile(
  watchedMovies: WatchedMovie[],
  dislikedCategories: string[] = []
): string {
  if (watchedMovies.length === 0) {
    if (dislikedCategories.length > 0) {
      return `Du har angett att du vill undvika ${dislikedCategories.join(
        ", "
      )}. Logga några sedda favoriter under fliken 'Sedda' så bygger CineMinde upp din personliga smakprofil!`;
    }
    return "Du har inte loggat några sedda filmer ännu. Lägg till några favoriter under fliken 'Sedda' och bocka i vad du gillade bäst med dem, så bygger CineMinde upp din personliga smakprofil!";
  }

  const stats = calculateTasteStats(watchedMovies);
  const topTagNames = stats.topTags.slice(0, 3).map((t) => t.tag.toLowerCase());

  const favItems: string[] = [];
  const dislikedItems: string[] = [];

  for (const m of watchedMovies) {
    if (m.seasons && m.seasons.length > 0) {
      for (const s of m.seasons) {
        if (s.rating >= 4 && s.liked !== false) {
          favItems.push(`${m.title} (Säsong ${s.seasonNumber})`);
        } else if (s.rating <= 2 || s.liked === false) {
          dislikedItems.push(`${m.title} (Säsong ${s.seasonNumber})`);
        }
      }
    } else {
      if (m.rating >= 4 && m.liked !== false) {
        favItems.push(m.title);
      } else if (m.rating <= 2 || m.liked === false) {
        dislikedItems.push(m.title);
      }
    }
  }

  const favMovies = favItems.slice(0, 4);
  const dislikedMovies = dislikedItems.slice(0, 2);

  const favText =
    favMovies.length > 0
      ? `Dina högst betygsatta filmer som ${favMovies.join(", ")} visar tydligt vilken typ av berättande, ton och hantverk som engagerar dig mest.`
      : `Utifrån dina ${stats.totalWatched} loggade filmer syns ett tydligt mönster i vad som engagerar dig.`;

  const tagText =
    topTagNames.length > 0
      ? `Du värdesätter framför allt ${topTagNames.join(", ")}, vilket går som en röd tråd genom dina favoriter.`
      : `Du uppskattar välregisserade berättelser med genomtänkt tempo och stark karaktärsnärvaro.`;

  const explicitDislikes =
    dislikedCategories.length > 0
      ? `Du undviker dessutom aktivt kategorier som ${dislikedCategories.join(", ")}.`
      : "";

  const dislikeText =
    dislikedMovies.length > 0
      ? `Samtidigt visar dina lägre betyg på filmer som ${dislikedMovies.join(" och ")} vad du föredrar att undvika när kvällens film väljs.${explicitDislikes ? " " + explicitDislikes : ""}`
      : explicitDislikes || `Din profil hjälper CineMinde att lyfta fram filmer som matchar din kvalitetsnivå oavsett vilken genre eller stämning du väljer för kvällen.`;

  return `${favText} ${tagText} ${dislikeText}`;
}
