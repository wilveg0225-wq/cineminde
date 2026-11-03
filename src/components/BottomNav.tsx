import React from "react";
import { Compass, Sparkles, CheckCircle2, Bookmark, BrainCircuit } from "lucide-react";

export type TabId = "recommended" | "tonight" | "watched" | "watchlist" | "profile";

interface BottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  watchedCount: number;
  watchlistCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  watchedCount,
  watchlistCount,
}) => {
  const navItems: {
    id: TabId;
    label: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: "recommended",
      label: "För dig",
      subtitle: "Rekommendationer",
      icon: Compass,
    },
    {
      id: "tonight",
      label: "Ikväll",
      subtitle: "Hitta film",
      icon: Sparkles,
    },
    {
      id: "watched",
      label: "Sedda",
      subtitle: "Logga & betyg",
      icon: CheckCircle2,
      badge: watchedCount,
    },
    {
      id: "watchlist",
      label: "Watchlist",
      subtitle: "Sparade",
      icon: Bookmark,
      badge: watchlistCount,
    },
    {
      id: "profile",
      label: "Profil",
      subtitle: "Smakprofil & konto",
      icon: BrainCircuit,
    },
  ];

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0c]/95 backdrop-blur-md border-t border-white/[0.08] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              title={item.subtitle}
              className={`relative flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-colors cursor-pointer select-none px-0.5 ${
                isActive
                  ? "text-[#e11d48]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? "scale-110 stroke-[2.25]" : "stroke-[1.75]"
                  }`}
                />
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold font-mono-num flex items-center justify-center shadow-sm"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10.5px] sm:text-[11px] leading-tight mt-1 truncate max-w-full text-center ${
                  isActive ? "font-semibold text-[#f4f4f6]" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
