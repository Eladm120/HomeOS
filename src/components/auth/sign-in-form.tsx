"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, MailCheck } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "code" | "password";
type Step = "email" | "verify" | "check-inbox";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "מייל או סיסמה שגויים";
  if (m.includes("already registered")) return "המייל כבר רשום — נסו להתחבר";
  if (m.includes("rate limit") || m.includes("security purposes")) return "יותר מדי ניסיונות. המתינו דקה ונסו שוב.";
  if (m.includes("token has expired") || m.includes("invalid")) return "הקוד שגוי או שפג תוקפו";
  if (m.includes("password")) return "הסיסמה חייבת להכיל לפחות 8 תווים";
  if (m.includes("email not confirmed")) return "יש לאשר את כתובת המייל דרך הקישור שנשלח";
  return "משהו השתבש. נסו שוב.";
}

export function SignInForm({ nextPath, initialError }: { nextPath: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [step, setStep] = useState<Step>("email");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);

  const supabase = getSupabaseBrowser();
  const redirectTo = () => `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`;

  function done() {
    router.replace(nextPath);
    router.refresh();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo() },
    });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    setStep("verify");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    done();
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo(), data: { display_name: displayName.trim() } },
      });
      setLoading(false);
      if (error) return setError(friendlyAuthError(error.message));
      if (!data.session) return setStep("check-inbox");
      return done();
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    done();
  }

  if (step === "check-inbox") {
    return (
      <Card className="p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-10 text-sage" />
        <h2 className="text-lg font-semibold">בדקו את תיבת המייל</h2>
        <p className="mt-1 text-sm text-muted">
          שלחנו קישור אישור אל <span className="num font-medium text-foreground">{email}</span>. לחצו עליו כדי להמשיך.
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => setStep("email")}>
          חזרה
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(
          [
            ["code", "קוד למייל", Mail],
            ["password", "סיסמה", KeyRound],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setStep("email");
              setError(undefined);
            }}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-all",
              mode === m ? "bg-surface text-foreground shadow-soft" : "text-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "code" && step === "email" && (
        <form onSubmit={sendCode} className="space-y-4">
          <Field label="אימייל" htmlFor="email">
            <Input id="email" type="email" dir="ltr" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            שליחת קוד התחברות
          </Button>
          <p className="text-center text-xs text-muted">נשלח אליכם קוד חד-פעמי. אין צורך בסיסמה.</p>
        </form>
      )}

      {mode === "code" && step === "verify" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-muted">
            הזינו את הקוד שנשלח אל <span className="num font-medium text-foreground">{email}</span>
          </p>
          <Input
            aria-label="קוד אימות"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.5em]"
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            כניסה
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("email")}>
            שינוי כתובת מייל
          </Button>
        </form>
      )}

      {mode === "password" && (
        <form onSubmit={submitPassword} className="space-y-4">
          {isSignUp && (
            <Field label="איך לקרוא לך?" htmlFor="name">
              <Input id="name" autoComplete="given-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="השם שלך" maxLength={60} />
            </Field>
          )}
          <Field label="אימייל" htmlFor="email-pw">
            <Input id="email-pw" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="סיסמה" htmlFor="password" hint={isSignUp ? "לפחות 8 תווים" : undefined}>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {isSignUp ? "יצירת חשבון" : "התחברות"}
          </Button>
          <button type="button" className="w-full text-center text-sm text-primary" onClick={() => setIsSignUp((v) => !v)}>
            {isSignUp ? "כבר יש לך חשבון? התחברות" : "אין לך חשבון? הרשמה"}
          </button>
        </form>
      )}
    </Card>
  );
}
