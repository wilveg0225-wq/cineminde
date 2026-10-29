import React from "react";
import {
  Compass,
  RefreshCw,
  Star,
  UserCheck,
  LogIn,
  LogOut,
  CloudCheck,
} from "lucide-react";
import {
  WatchedMovie,
  MovieRecommendation,
  calculateTasteStats,
} from "../utils/movieLogic";
import { User } from "firebase/auth";

interface TasteProfileTabProps {
  watchedMovies: WatchedMovie[];
  watchlist: MovieRecommendation[];
  tasteProfileSummary: string;
  isUpdatingProfile: boolean;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const TasteProfileTab: React.FC<TasteProfileTabProps> = ({
  watchedMovies,
  watchlist,
  tasteProfileSummary,
  isUpdatingProfile,
  currentUser,
  onOpenAuthModal,
  onLogout,
}) => {
  const stats = calculateTasteStats(watchedMovies);

  return (
    <div className="space-y-6 pb-8">
      {/* Statistik-kort */}
      <section aria-label="Statistik över din filmsmak" className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-zinc-400">Sedda filmer</p>
            <p className="text-2xl font-bold text-white font-mono-num mt-1">
              {stats.totalWatched}
            </p>
          </div>

          <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-zinc-400">Snittbetyg</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-bold text-[#f59e0b] font-mono-num">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
              </p>
              <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
            </div>
          </div>

          <div className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-zinc-400">Watchlist</p>
            <p className="text-2xl font-bold text-white font-mono-num mt-1">
              {watchlist.length}
            </p>
          </div>
        </div>
      </section>

      {/* Personlig Smakprofil */}
      <section
        aria-label="Din smakprofil"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-[#e11d48] shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">
                Din Smakprofil
              </h2>
              <p className="text-xs text-zinc-400">
                Förfinas automatiskt varje gång du betygsätter en film
              </p>
            </div>
          </div>

          {isUpdatingProfile && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e11d48]/15 border border-[#e11d48]/30 text-[11px] font-medium text-rose-300 shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Uppdateras...</span>
            </span>
          )}
        </div>

        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-sm text-zinc-200 leading-relaxed">
            {tasteProfileSummary}
          </p>
        </div>
      </section>

      {/* Topp-taggar */}
      <section
        aria-label="Topp-kvaliteter du gillar"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-4"
      >
        <div>
          <h2 className="text-base font-bold text-white">
            Dina topp-taggar i filmer
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Kvaliteter du oftast lyfter fram när du betygsätter filmer
          </p>
        </div>

        {stats.topTags.length === 0 ? (
          <p className="text-xs text-zinc-400 py-2">
            Betygsätt några filmer under "Sedda" och välj vad som var bäst med
            dem för att se dina topp-taggar här.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.topTags.map((item) => (
              <div key={item.tag} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200">{item.tag}</span>
                  <span className="font-mono-num text-zinc-400">
                    {item.count} {item.count === 1 ? "film" : "filmer"} ·{" "}
                    <span className="text-[#f59e0b] font-semibold">
                      {item.percentage}%
                    </span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#0a0a0c] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#e11d48] to-[#f59e0b] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(12, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Konto & Molnsynkning (Firebase) */}
      <section
        aria-label="Konto och molnsynkning"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CloudCheck className="w-5 h-5 text-[#f59e0b] shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">
                Konto & Molnsynkning
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {currentUser
                  ? "Dina filmer, betyg och watchlist synkas automatiskt med ditt konto."
                  : "Logga in för att spara dina filmer på ditt konto och synka mellan mobil och dator."}
              </p>
            </div>
          </div>
        </div>

        {currentUser ? (
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {currentUser.displayName || currentUser.email}
                </p>
                <p className="text-[11px] text-emerald-400">
                  Inloggad · Molnsynkning aktiv
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0a0a0c] hover:bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logga ut</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-[#e11d48]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>Logga in / Skapa konto</span>
          </button>
        )}
      </section>
    </div>
  );
};
