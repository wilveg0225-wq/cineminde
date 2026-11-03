import React, { useState } from "react";
import {
  Compass,
  RefreshCw,
  Star,
  UserCheck,
  LogIn,
  LogOut,
  CloudCheck,
  Ban,
  Plus,
  X,
} from "lucide-react";
import {
  WatchedMovie,
  MovieRecommendation,
  calculateTasteStats,
  COMMON_DISLIKED_CATEGORIES,
} from "../utils/movieLogic";
import { User } from "firebase/auth";

interface TasteProfileTabProps {
  watchedMovies: WatchedMovie[];
  watchlist: MovieRecommendation[];
  tasteProfileSummary: string;
  dislikedCategories: string[];
  onAddDislikedCategory: (category: string) => void;
  onRemoveDislikedCategory: (category: string) => void;
  isUpdatingProfile: boolean;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const TasteProfileTab: React.FC<TasteProfileTabProps> = ({
  watchedMovies,
  watchlist,
  tasteProfileSummary,
  dislikedCategories,
  onAddDislikedCategory,
  onRemoveDislikedCategory,
  isUpdatingProfile,
  currentUser,
  onOpenAuthModal,
  onLogout,
}) => {
  const [customInput, setCustomInput] = useState("");
  const stats = calculateTasteStats(watchedMovies);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onAddDislikedCategory(trimmed);
    setCustomInput("");
  };

  const availableQuickPicks = COMMON_DISLIKED_CATEGORIES.filter(
    (cat) =>
      !dislikedCategories.some(
        (selected) => selected.toLowerCase() === cat.toLowerCase()
      )
  );

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

      {/* Kategorier du inte gillar (Undvik dessa kategorier) */}
      <section
        aria-label="Kategorier du vill undvika"
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Ban className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">
                Kategorier du inte gillar
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Välj kategorier och genrer du vill slippa få rekommenderade
              </p>
            </div>
          </div>

          {dislikedCategories.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[11px] font-mono-num text-rose-300">
              {dislikedCategories.length}{" "}
              {dislikedCategories.length === 1 ? "blockerad" : "blockerade"}
            </span>
          )}
        </div>

        {/* Aktiva ogillade kategorier */}
        <div className="pt-1">
          {dislikedCategories.length === 0 ? (
            <p className="text-xs text-zinc-400 py-1 italic">
              Inga kategorier blockerade ännu. Välj bland de vanliga kategorierna nedan eller skriv en egen för att undvika att få förslag inom dem.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dislikedCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs font-medium text-rose-200 shadow-sm"
                >
                  <Ban className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveDislikedCategory(cat)}
                    aria-label={`Ta bort ${cat} från ogillade kategorier`}
                    className="p-0.5 rounded-md hover:bg-rose-500/30 text-rose-300 hover:text-white transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Snabbval av vanliga kategorier att välja bort */}
        {availableQuickPicks.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <p className="text-[11px] font-medium text-zinc-400">
              Snabbval – tryck för att blockera:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableQuickPicks.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  onClick={() => onAddDislikedCategory(pick)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0a0a0c] hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/30 text-xs text-zinc-300 hover:text-rose-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-zinc-400" />
                  <span>{pick}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulär för att skriva in egen kategori */}
        <form
          onSubmit={handleAddSubmit}
          className="pt-2 border-t border-white/[0.06] flex items-center gap-2"
        >
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Skriv egen kategori (t.ex. Splatter, Zombies...)"
            className="flex-1 min-h-[38px] px-3.5 rounded-xl bg-[#0a0a0c] border border-white/[0.1] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition-all"
          />
          <button
            type="submit"
            disabled={!customInput.trim()}
            className="min-h-[38px] px-3.5 rounded-xl bg-[#0a0a0c] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.2] text-xs font-medium text-zinc-200 hover:text-white flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lägg till</span>
          </button>
        </form>
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
