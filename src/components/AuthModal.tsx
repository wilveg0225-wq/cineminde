import React, { useState } from "react";
import {
  X,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  Loader2,
  CloudCheck,
  Clapperboard,
  Sparkles,
} from "lucide-react";
import {
  signInWithGoogle,
  loginWithEmail,
  registerWithEmail,
  isFirebaseConfigured,
} from "../utils/firebase";

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onAuthSuccess: (msg: string) => void;
  standalone?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen = true,
  onClose,
  onAuthSuccess,
  standalone = false,
}) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const configured = isFirebaseConfigured();

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      onAuthSuccess(
        `Inloggad som ${user.displayName || user.email || "användare"}!`
      );
      if (onClose) onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("unauthorized-domain")) {
        setError(
          "Denna domän (tunnel-länken) behöver läggas till under Firebase Console -> Authentication -> Settings -> Authorized domains, eller logga in med E-post & Lösenord nedan!"
        );
      } else if (msg.includes("popup-closed-by-user")) {
        setError("Inloggningsfönstret stängdes.");
      } else {
        setError(
          "Kunde inte logga in med Google. Kontrollera att Google-inloggning är aktiverad i Firebase Authentication."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Fyll i både e-postadress och lösenord.");
      return;
    }
    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await loginWithEmail(email, password);
        onAuthSuccess(`Välkommen tillbaka, ${user.email}!`);
      } else {
        const user = await registerWithEmail(email, password);
        onAuthSuccess(`Konto skapat och inloggad som ${user.email}!`);
      }
      setEmail("");
      setPassword("");
      if (onClose) onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("invalid-credential") ||
        msg.includes("wrong-password") ||
        msg.includes("user-not-found")
      ) {
        setError("Fel e-postadress eller lösenord.");
      } else if (msg.includes("email-already-in-use")) {
        setError(
          "Den här e-postadressen har redan ett konto. Välj 'Logga in' istället."
        );
      } else {
        setError(
          "Kunde inte logga in. Kontrollera att Email/Password är aktiverat under Firebase Authentication."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const formCard = (
    <div className="w-full max-w-sm bg-[#16161a] border border-white/[0.14] rounded-2xl p-5 space-y-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#e11d48]/15 border border-[#e11d48]/40 flex items-center justify-center shrink-0">
            <CloudCheck className="w-4 h-4 text-[#e11d48]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {standalone
                ? mode === "login"
                  ? "Logga in på ditt konto"
                  : "Skapa ditt konto"
                : "Synka ditt konto"}
            </h2>
            <p className="text-xs text-zinc-400">
              {standalone
                ? "Dina filmer, betyg och smakprofil synkas i molnet"
                : "Spara dina filmer, betyg och watchlist i molnet"}
            </p>
          </div>
        </div>
        {!standalone && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!configured ? (
        <div className="p-3.5 rounded-xl bg-[#0a0a0c] border border-[#f59e0b]/40 text-xs text-zinc-300 space-y-1.5">
          <p className="font-semibold text-[#f59e0b]">
            Väntar på Firebase-nycklar
          </p>
          <p className="text-zinc-400 leading-relaxed">
            Klistra in din <code className="text-zinc-200">firebaseConfig</code>{" "}
            i chatten till agenten så aktiveras Google- och e-postinloggning
            direkt!
          </p>
        </div>
      ) : (
        <>
          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-60 text-[#0a0a0c] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Fortsätt med Google</span>
          </button>

          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span>eller med e-post</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0a0a0c] border border-white/[0.07]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === "login"
                  ? "bg-[#1e1e24] text-white border border-white/[0.12]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Logga in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === "register"
                  ? "bg-[#1e1e24] text-white border border-white/[0.12]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Skapa konto
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-postadress"
                autoComplete="email"
                className="w-full min-h-[42px] rounded-xl bg-[#0a0a0c] border border-white/[0.08] pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48]"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Lösenord (minst 6 tecken)"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="w-full min-h-[42px] rounded-xl bg-[#0a0a0c] border border-white/[0.08] pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#e11d48]"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-rose-400 leading-relaxed">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-60 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-[#e11d48]/20 transition-colors cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Logga in</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Skapa konto & kom igång</span>
                </>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#f4f4f6] flex flex-col items-center justify-center p-4 pt-safe-top pb-safe-bottom">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#e11d48] to-[#f43f5e] items-center justify-center shadow-xl shadow-[#e11d48]/30">
              <Clapperboard className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
              <span>CineMinde</span>
              <Sparkles className="w-4 h-4 text-[#f59e0b]" />
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Din personliga filmguide med AI. Logga in eller skapa ett konto
              för att använda appen.
            </p>
          </div>

          {formCard}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Logga in på ditt CineMinde-konto"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        {formCard}
      </div>
    </div>
  );
};
