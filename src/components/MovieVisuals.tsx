import React, { useState, useEffect } from "react";
import { Film, Tv } from "lucide-react";
import {
  SwedishWatchProviders,
  StreamingProvider,
  getTmdbPosterUrl,
  getTmdbLogoUrl,
} from "../utils/movieLogic";

interface MoviePosterProps {
  title: string;
  year?: string;
  posterPath?: string;
  size?: "w92" | "w185" | "w500";
  className?: string;
}

const POSTER_PALETTES = [
  "from-rose-950 via-zinc-900 to-black border-rose-500/20",
  "from-amber-950 via-zinc-900 to-black border-amber-500/20",
  "from-indigo-950 via-zinc-900 to-black border-indigo-500/20",
  "from-emerald-950 via-zinc-900 to-black border-emerald-500/20",
  "from-purple-950 via-zinc-900 to-black border-purple-500/20",
  "from-sky-950 via-zinc-900 to-black border-sky-500/20",
];

function getPaletteForTitle(title: string): string {
  let sum = 0;
  for (let i = 0; i < title.length; i++) {
    sum += title.charCodeAt(i);
  }
  return POSTER_PALETTES[sum % POSTER_PALETTES.length];
}

export const MoviePoster: React.FC<MoviePosterProps> = ({
  title,
  year,
  posterPath,
  size = "w500",
  className = "w-24 h-36",
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const posterUrl = getTmdbPosterUrl(posterPath, size);
  const palette = getPaletteForTitle(title);

  useEffect(() => {
    setImgFailed(false);
  }, [posterPath]);

  if (posterUrl && !imgFailed) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-[#0a0a0c] border border-white/[0.1] shrink-0 ${className}`}
      >
        <img
          src={posterUrl}
          alt={`Filmposter för ${title}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Stylized cinema poster fallback (Zero-Broken-Image Policy)
  const isTiny = size === "w92";
  const isMedium = size === "w185";
  return (
    <div
      aria-label={`Filmposter för ${title}`}
      className={`relative overflow-hidden rounded-xl bg-gradient-to-b ${palette} border flex flex-col justify-between ${
        isTiny ? "p-1.5" : "p-2.5"
      } select-none shrink-0 ${className}`}
    >
      <div className="flex items-center justify-between opacity-75">
        <Film
          className={
            isTiny ? "w-3 h-3 text-[#f59e0b]" : "w-3.5 h-3.5 text-[#f59e0b]"
          }
        />
        {year && !isTiny && (
          <span className="text-[9px] font-mono-num text-zinc-300">{year}</span>
        )}
      </div>

      <div className="my-auto py-0.5">
        <p
          className={`font-display font-bold text-white leading-tight break-words line-clamp-3 ${
            isTiny
              ? "text-[8px]"
              : isMedium
              ? "text-[10px]"
              : "text-xs"
          }`}
        >
          {title}
        </p>
      </div>

      {!isTiny && (
        <div className="w-5 h-0.5 bg-[#e11d48]/80 rounded-full" />
      )}
    </div>
  );
};

function getProviderBrandStyle(name: string): {
  bg: string;
  abbr: string;
} {
  const lower = name.toLowerCase();
  if (lower.includes("netflix")) {
    return { bg: "bg-[#E50914] text-white", abbr: "N" };
  }
  if (lower.includes("max") || lower.includes("hbo")) {
    return { bg: "bg-[#002BE7] text-white", abbr: "M" };
  }
  if (lower.includes("viaplay")) {
    return { bg: "bg-[#FF3355] text-white", abbr: "V" };
  }
  if (lower.includes("disney")) {
    return { bg: "bg-[#0A1D56] text-sky-300", abbr: "D+" };
  }
  if (lower.includes("prime") || lower.includes("amazon")) {
    return { bg: "bg-[#00A8E1] text-white", abbr: "P" };
  }
  if (lower.includes("skyshowtime")) {
    return { bg: "bg-purple-700 text-white", abbr: "S" };
  }
  if (lower.includes("tv4")) {
    return { bg: "bg-red-600 text-white", abbr: "4" };
  }
  if (lower.includes("apple")) {
    return { bg: "bg-zinc-800 text-white", abbr: "" };
  }
  if (lower.includes("sf")) {
    return { bg: "bg-rose-800 text-white", abbr: "SF" };
  }
  return {
    bg: "bg-zinc-800 text-zinc-200",
    abbr: name.slice(0, 2).toUpperCase(),
  };
}

const ProviderLogoItem: React.FC<{ provider: StreamingProvider }> = ({
  provider,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = getTmdbLogoUrl(provider.logo_path);

  useEffect(() => {
    setLogoFailed(false);
  }, [provider.logo_path]);

  const displayName =
    provider.provider_name.trim().toLowerCase() === "max"
      ? "HBO Max"
      : provider.provider_name;
  const brand = getProviderBrandStyle(displayName);

  return (
    <div
      className="inline-flex items-center gap-1.5"
      title={displayName}
    >
      {logoUrl && !logoFailed ? (
        <img
          src={logoUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
          className="w-5 h-5 rounded-full object-cover border border-white/[0.15] shrink-0"
        />
      ) : (
        <span
          aria-hidden="true"
          className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center border border-white/[0.15] shrink-0 ${brand.bg}`}
        >
          {brand.abbr}
        </span>
      )}
      <span className="text-xs text-zinc-200 font-medium whitespace-nowrap">
        {displayName}
      </span>
    </div>
  );
};

interface SwedishStreamingSectionProps {
  swedishProviders?: SwedishWatchProviders;
}

export const SwedishStreamingSection: React.FC<
  SwedishStreamingSectionProps
> = ({ swedishProviders }) => {
  if (
    !swedishProviders ||
    swedishProviders.type === "none" ||
    swedishProviders.providers.length === 0
  ) {
    return (
      <div className="pt-2.5 border-t border-white/[0.06] flex items-center gap-2 text-xs text-zinc-500">
        <Tv className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        <span>Ej på svensk streaming just nu</span>
      </div>
    );
  }

  const label =
    swedishProviders.type === "flatrate"
      ? "Streama på:"
      : "Finns att hyra/köpa på:";

  return (
    <div className="pt-2.5 border-t border-white/[0.06] space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <Tv className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {swedishProviders.providers.map((p) => (
          <ProviderLogoItem
            key={`${p.provider_id}-${p.provider_name}`}
            provider={p}
          />
        ))}
      </div>
    </div>
  );
};
