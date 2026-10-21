"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, KeyRound, Leaf, Loader2, LogIn, Lock, Mail, User, UserPlus, Users } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "מייל או סיסמה שגויים. נכנסתם בעבר עם קישור במייל? לחשבון עדיין אין סיסמה — לחצו ״קביעת סיסמה״ למטה.";
  if (m.includes("already registered") || m.includes("already been registered")) return "המייל כבר רשום — נסו להתחבר";
  if (m.includes("rate limit") || m.includes("security purposes")) return "יותר מדי ניסיונות. המתינו דקה ונסו שוב.";
  if (m.includes("email not confirmed")) return "החשבון קיים אבל השרת עדיין דורש אישור מייל. אחרי שההגדרה תכובה אפשר להתחבר מיד.";
  if (m.includes("password")) return "הסיסמה חייבת להכיל לפחות 8 תווים";
  if (m.includes("email")) return "כתובת המייל לא תקינה";
  return "משהו השתבש. נסו שוב.";
}

/**
 * Email + password only. Joining is the same form with a name: no magic link,
 * no confirmation step — a new member is signed in right away. Email is used
 * only to invite a partner and, once, to set a password (accounts created by
 * the old email-link sign-in have none).
 */
export function SignInForm({ nextPath, initialError }: { nextPath: string; initialError?: string }) {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [reset, setReset] = useState<"off" | "form" | "sent">("off");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);

  function done() {
    router.replace(nextPath);
    router.refresh();
  }

  /** One email, only for this: a link to choose a (new) password. */
  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/set-password")}`,
    });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    setReset("sent");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    setLoading(true);
    setError(undefined);
    const mail = email.trim();
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { data: { display_name: displayName.trim() } } });
      if (error) {
        setLoading(false);
        return setError(friendlyAuthError(error.message));
      }
      if (data.session) return done();
      // No session back (older projects): sign in directly with the same details.
    }
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    done();
  }

  const field = "flex h-14 items-center gap-3 rounded-2xl border border-[#e4ddd0] bg-[#fdfbf7] px-4 shadow-[0_1px_2px_rgba(60,50,30,0.04)] focus-within:border-[#7d9a62] focus-within:ring-2 focus-within:ring-[#7d9a62]/20";
  const input = "h-full min-w-0 flex-1 bg-transparent text-[17px] text-[#2c3527] outline-none placeholder:text-[#8f8a7d]";

  if (reset !== "off") {
    return (
      <form onSubmit={sendReset} className="space-y-3.5">
        <h2 className="mb-2 flex items-center justify-center gap-2.5 text-[30px] leading-none font-extrabold tracking-[-0.02em] text-[#253020]">
          <KeyRound className="size-8 text-[#6f8c55]" strokeWidth={1.7} />
          קביעת סיסמה
        </h2>
        {reset === "sent" ? (
          <p className="rounded-2xl bg-[#e8efe0] px-4 py-3 text-[15px] leading-relaxed text-[#2f4a26]">
            שלחנו קישור אל <b dir="ltr">{email.trim()}</b>. פתחו אותו <b>בדפדפן הזה</b> ובחרו סיסמה — מכאן והלאה נכנסים רק עם מייל וסיסמה.
          </p>
        ) : (
          <>
            <p className="mb-4 text-center text-[15px] text-[#5d6b55]">נשלח קישור חד־פעמי למייל, ובו בוחרים סיסמה.</p>
            <label className={field}>
              <Mail className="size-[22px] shrink-0 text-[#5d6b55]" strokeWidth={1.7} />
              <input className={input} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="כתובת אימייל" aria-label="כתובת אימייל" />
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-[#fbe9e4] px-3 py-2 text-[14px] text-[#a6402b]">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="mt-2 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-full bg-[linear-gradient(180deg,#6b8a55,#56744a)] text-[18px] font-bold text-white disabled:opacity-70">
              {loading ? <Loader2 className="size-5 animate-spin" /> : <Mail className="size-5" />}
              שליחת קישור לקביעת סיסמה
            </button>
          </>
        )}
        <button type="button" onClick={() => { setReset("off"); setError(undefined); }} className="mt-2 w-full text-center text-[15px] font-semibold text-[#56744a]">
          חזרה להתחברות
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <h2 className="mb-5 flex items-center justify-center gap-2.5 text-[34px] leading-none font-extrabold tracking-[-0.02em] text-[#253020]">
        <Leaf className="size-9 -scale-x-100 text-[#6f8c55]" strokeWidth={1.6} />
        {isSignUp ? "הצטרפות" : "ברוכים הבאים"}
      </h2>

      {isSignUp && (
        <label className={field}>
          <User className="size-[22px] shrink-0 text-[#5d6b55]" strokeWidth={1.7} />
          <input className={input} autoComplete="given-name" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="איך לקרוא לך?" aria-label="שם" />
        </label>
      )}

      <label className={field}>
        <Mail className="size-[22px] shrink-0 text-[#5d6b55]" strokeWidth={1.7} />
        <input className={input} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="כתובת אימייל" aria-label="כתובת אימייל" />
      </label>

      <label className={field}>
        <Lock className="size-[22px] shrink-0 text-[#5d6b55]" strokeWidth={1.7} />
        <input
          className={input}
          type={showPassword ? "text" : "password"}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignUp ? "סיסמה (לפחות 8 תווים)" : "סיסמה"}
          aria-label="סיסמה"
        />
        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "הסתרת הסיסמה" : "הצגת הסיסמה"} className="grid size-9 shrink-0 place-items-center rounded-full text-[#5d6b55] active:bg-black/5">
          {showPassword ? <EyeOff className="size-[22px]" strokeWidth={1.7} /> : <Eye className="size-[22px]" strokeWidth={1.7} />}
        </button>
      </label>

      {!isSignUp && (
        <button type="button" onClick={() => { setReset("form"); setError(undefined); }} className="block px-1 text-[15px] font-semibold text-[#56744a] underline underline-offset-4">
          שכחתי סיסמה / קביעת סיסמה
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-[#fbe9e4] px-3 py-2 text-[14px] text-[#a6402b]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-full bg-[linear-gradient(180deg,#6b8a55,#56744a)] text-[19px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(60,90,40,0.8),inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform active:scale-[0.98] disabled:opacity-70"
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : isSignUp ? <UserPlus className="size-5" /> : <LogIn className="size-5 -scale-x-100" />}
        {isSignUp ? "יצירת חשבון" : "התחברות"}
      </button>

      <button
        type="button"
        onClick={() => {
          setIsSignUp((v) => !v);
          setError(undefined);
        }}
        className={cn("mt-4 flex h-14 w-full items-center gap-3 rounded-2xl bg-[#eceee2] px-4 text-[16px] text-[#3c4a34] transition-colors active:bg-[#e2e5d5]")}
      >
        <Users className="size-6 shrink-0 text-[#5d6b55]" strokeWidth={1.7} />
        <span className="flex-1 text-start">{isSignUp ? "כבר יש לכם חשבון? התחברות" : "אין לכם חשבון? הצטרפו ל-HomeOS"}</span>
        <ChevronLeft className="size-5 shrink-0 text-[#5d6b55]" />
      </button>
    </form>
  );
}
