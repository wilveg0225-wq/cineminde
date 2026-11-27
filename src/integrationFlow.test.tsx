import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Duplex } from "node:stream";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createApp } from "../server";
import { TonightTab } from "./components/TonightTab";
import {
  MovieRecommendation,
  NO_EXACT_MATCH_FALLBACK_MESSAGE,
} from "./utils/movieLogic";

class InMemorySocket extends Duplex {
  public chunks: Buffer[] = [];
  _read() {}
  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }
}

async function invokePostRecommendations(
  app: ReturnType<typeof createApp>,
  payload: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const jsonBody = Buffer.from(JSON.stringify(payload), "utf8");
  const reqSocket = new InMemorySocket();
  const req = new http.IncomingMessage(reqSocket as never);
  req.method = "POST";
  req.url = "/api/recommendations";
  req.headers = {
    "content-type": "application/json",
    "content-length": String(jsonBody.length),
  };

  const res = new http.ServerResponse(req);
  const resSocket = new InMemorySocket();
  res.assignSocket(resSocket as never);

  const responsePromise = new Promise<{
    status: number;
    body: Record<string, unknown>;
  }>((resolve, reject) => {
    res.on("finish", () => {
      try {
        const raw = Buffer.concat(resSocket.chunks).toString("utf8");
        const headerEnd = raw.indexOf("\r\n\r\n");
        const bodyText = headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw;
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        resolve({ status: res.statusCode, body: parsed });
      } catch (err) {
        reject(err);
      }
    });
    res.on("error", reject);
  });

  req.push(jsonBody);
  req.push(null);

  app(req as never, res as never);
  return await responsePromise;
}

async function withOfflineEnv(run: () => Promise<void>): Promise<void> {
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevTmdb = process.env.TMDB_API_KEY;
  process.env.GEMINI_API_KEY = "";
  process.env.TMDB_API_KEY = "";
  try {
    await run();
  } finally {
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    if (prevTmdb === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = prevTmdb;
  }
}

test("POST /api/recommendations enforces strict multi-category AND-matching for movies & TV and returns closest-match fallback notice on 0 exact matches", async () => {
  await withOfflineEnv(async () => {
    const app = createApp();

    // 1. Movies: 3 categories (Action + Sci-Fi + Komedi) -> 5 exact movie matches
    const movieRes = await invokePostRecommendations(app, {
      watchedMovies: [],
      watchlist: [],
      tasteProfileSummary: "",
      preferences: {
        moods: [],
        genres: ["Action", "Sci-Fi", "Komedi"],
        contents: [],
        frameworks: [],
        customText: "",
        mediaType: "movie",
      },
    });
    assert.equal(movieRes.status, 200);
    const movieData = movieRes.body as {
      recommendations: MovieRecommendation[];
      exactMatchesFound: boolean;
      fallbackMessage?: string;
    };
    assert.equal(movieData.exactMatchesFound, true);
    assert.equal(movieData.fallbackMessage, undefined);
    assert.equal(movieData.recommendations.length, 5);
    for (const r of movieData.recommendations) {
      assert.equal(r.mediaType, "movie");
      const ids = new Set(r.tmdbGenreIds || []);
      assert.ok(ids.has(28) && ids.has(878) && ids.has(35));
    }

    // 2. TV series: 2 categories (Animerat + Action) -> 5 exact TV matches
    const tvRes = await invokePostRecommendations(app, {
      watchedMovies: [],
      watchlist: [],
      tasteProfileSummary: "",
      preferences: {
        moods: [],
        genres: ["Animerat", "Action"],
        contents: [],
        frameworks: [],
        customText: "",
        mediaType: "tv",
      },
    });
    assert.equal(tvRes.status, 200);
    const tvData = tvRes.body as {
      recommendations: MovieRecommendation[];
      exactMatchesFound: boolean;
      fallbackMessage?: string;
    };
    assert.equal(tvData.exactMatchesFound, true);
    assert.equal(tvData.recommendations.length, 5);
    for (const r of tvData.recommendations) {
      assert.equal(r.mediaType, "tv");
      const ids = new Set(r.tmdbGenreIds || []);
      assert.ok(ids.has(16));
      assert.ok(ids.has(10759) || ids.has(28));
    }

    // 3. 0 exact matches (movie & tv) -> returns 5 closest matches + fallbackMessage
    for (const mediaType of ["movie", "tv"] as const) {
      const zeroRes = await invokePostRecommendations(app, {
        watchedMovies: [],
        watchlist: [],
        tasteProfileSummary: "",
        preferences: {
          moods: [],
          genres: ["Dokumentär", "Skräck", "Musikal"],
          contents: [],
          frameworks: [],
          customText: "",
          mediaType,
        },
      });
      assert.equal(zeroRes.status, 200);
      const zeroData = zeroRes.body as {
        recommendations: MovieRecommendation[];
        exactMatchesFound: boolean;
        fallbackMessage?: string;
      };
      assert.equal(zeroData.exactMatchesFound, false);
      assert.equal(zeroData.fallbackMessage, NO_EXACT_MATCH_FALLBACK_MESSAGE);
      assert.equal(zeroData.recommendations.length, 5);
      assert.ok(
        zeroData.recommendations.every((r) => r.mediaType === mediaType),
        `All 5 closest matches for ${mediaType} must preserve mediaType`
      );
    }

    // 4. Watchlist allowance (Tonight flow) vs exclusion (RecommendedTab swipe deck)
    const watchlistItem: MovieRecommendation = {
      id: "wl-api-1",
      title: "Cyberpunk: Edgerunners",
      year: "2022",
      runtime: "1 säsong · 10 avsnitt",
      mediaType: "tv",
      matchPercentage: 94,
      whyYouWillLikeIt: "Animerad sci-fi action",
      vibeTags: ["Vuxenanimation", "Cyberpunk"],
      tmdbId: 105248,
      tmdbGenreIds: [16, 10765, 10759],
      tmdbGenres: ["Animerat", "Sci-Fi & Fantasy", "Action & Äventyr"],
    };

    const allowedRes = await invokePostRecommendations(app, {
      watchedMovies: [],
      watchlist: [watchlistItem],
      tasteProfileSummary: "Älskar mörk cyberpunk och vuxenanimation.",
      preferences: {
        moods: [],
        genres: ["Animerat", "Action"],
        contents: [],
        frameworks: [],
        customText: "",
        mediaType: "tv",
      },
      allowWatchlistInResults: true,
    });
    const allowedData = allowedRes.body as {
      recommendations: MovieRecommendation[];
    };
    assert.ok(
      allowedData.recommendations.some(
        (r) => r.title === "Cyberpunk: Edgerunners"
      ),
      "Tonight API flow must allow matching watchlist titles"
    );

    const excludedRes = await invokePostRecommendations(app, {
      watchedMovies: [],
      watchlist: [watchlistItem],
      tasteProfileSummary: "Älskar mörk cyberpunk och vuxenanimation.",
      preferences: {
        moods: [],
        genres: ["Animerat", "Action"],
        contents: [],
        frameworks: [],
        customText: "",
        mediaType: "tv",
      },
      allowWatchlistInResults: false,
    });
    const excludedData = excludedRes.body as {
      recommendations: MovieRecommendation[];
    };
    assert.ok(
      !excludedData.recommendations.some(
        (r) => r.title === "Cyberpunk: Edgerunners"
      ),
      "RecommendedTab swipe-deck API flow (allowWatchlistInResults=false) must exclude watchlist titles"
    );

    // 5. Regression (M1-i2 Bug 3): 5 exact matches containing a franchise pair preserve all 5 in POST /api/recommendations
    const franchiseRes = await invokePostRecommendations(app, {
      watchedMovies: [],
      watchlist: [],
      tasteProfileSummary: "",
      previousTitles: [
        "Dune: Part Two",
        "Everything Everywhere All at Once",
        "Free Guy",
        "Men in Black",
        "Deadpool & Wolverine",
        "The Adam Project",
        "Akira",
      ],
      preferences: {
        moods: [],
        genres: ["Action", "Sci-Fi"],
        contents: [],
        frameworks: [],
        customText: "",
        mediaType: "movie",
      },
    });
    assert.equal(franchiseRes.status, 200);
    const franchiseData = franchiseRes.body as {
      recommendations: MovieRecommendation[];
      exactMatchesFound: boolean;
    };
    assert.equal(franchiseData.exactMatchesFound, true);
    assert.equal(franchiseData.recommendations.length, 5);

    // 6. Regression (M1-i2 Minor 2 & Finding 4): TV4 Play + 0 exact matches returns 5 TV4 Play movies and never leaks watchlist when allowWatchlistInResults=false
    const tv4WatchlistItem: MovieRecommendation = {
      id: "wl-tv4-1",
      title: "Män som hatar kvinnor",
      year: "2009",
      runtime: "2 tim 32 min",
      mediaType: "movie",
      matchPercentage: 95,
      whyYouWillLikeIt: "Svensk kriminalthriller",
      vibeTags: ["Krim", "Thriller"],
      tmdbId: 15472,
      tmdbGenreIds: [18, 53, 80, 9648],
      swedishProviders: {
        type: "flatrate",
        providers: [{ provider_id: 383, provider_name: "TV4 Play" }],
      },
    };
    const tv4Res = await invokePostRecommendations(app, {
      watchedMovies: [],
      watchlist: [tv4WatchlistItem],
      tasteProfileSummary: "Älskar svensk krim och spänning.",
      preferences: {
        moods: [],
        genres: ["Dokumentär", "Skräck", "Musikal"],
        contents: [],
        frameworks: [],
        customText: "",
        streamingProviders: ["TV4 Play"],
        mediaType: "movie",
      },
      allowWatchlistInResults: false,
    });
    assert.equal(tv4Res.status, 200);
    const tv4Data = tv4Res.body as {
      recommendations: MovieRecommendation[];
      exactMatchesFound: boolean;
      fallbackMessage?: string;
    };
    assert.equal(tv4Data.exactMatchesFound, false);
    assert.equal(tv4Data.fallbackMessage, NO_EXACT_MATCH_FALLBACK_MESSAGE);
    assert.equal(tv4Data.recommendations.length, 5);
    assert.ok(
      !tv4Data.recommendations.some((r) => r.title === "Män som hatar kvinnor"),
      "Watchlist item must never leak when allowWatchlistInResults=false even under restrictive streaming filter"
    );
  });
});

test("TonightTab renders fallback notice banner with 5 closest-match cards when fallbackNotice is set and omits it when null", () => {
  const sampleRecs: MovieRecommendation[] = [1, 2, 3, 4, 5].map((i) => ({
    id: `rec-${i}`,
    title: `Testfilm ${i}`,
    year: "2022",
    runtime: "1 tim 50 min",
    mediaType: "movie",
    matchPercentage: 90 - i,
    whyYouWillLikeIt: `Motivering ${i}`,
    vibeTags: ["Spänning"],
  }));

  const baseProps = {
    preferences: {
      moods: [],
      genres: ["Dokumentär", "Skräck", "Musikal"],
      contents: [],
      frameworks: [],
      customText: "",
      mediaType: "movie" as const,
    },
    onChangePreferences: () => {},
    recommendations: sampleRecs,
    isLoading: false,
    error: null,
    onFindMovies: () => {},
    onAddToWatchlist: () => {},
    onMarkAsWatched: () => {},
    watchlist: [],
    watchedCount: 0,
  };

  const htmlWithNotice = renderToStaticMarkup(
    <TonightTab
      {...baseProps}
      fallbackNotice={NO_EXACT_MATCH_FALLBACK_MESSAGE}
    />
  );
  assert.ok(htmlWithNotice.includes('data-testid="fallback-notice-banner"'));
  assert.ok(htmlWithNotice.includes(NO_EXACT_MATCH_FALLBACK_MESSAGE));
  assert.ok(htmlWithNotice.includes("5 skräddarsydda val för dig ikväll"));
  for (let i = 1; i <= 5; i++) {
    assert.ok(htmlWithNotice.includes(`Testfilm ${i}`));
  }

  const htmlWithoutNotice = renderToStaticMarkup(
    <TonightTab {...baseProps} fallbackNotice={null} />
  );
  assert.equal(
    htmlWithoutNotice.includes('data-testid="fallback-notice-banner"'),
    false
  );
  assert.equal(
    htmlWithoutNotice.includes(NO_EXACT_MATCH_FALLBACK_MESSAGE),
    false
  );
});
