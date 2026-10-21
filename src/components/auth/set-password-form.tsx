"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("לפחות 8 תווים");
    setLoading(true);
    setError(undefined);
    const { error } = await getSupabaseBrowser().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message.toLowerCase().includes("different") ? "זו כבר הסיסמה הנוכחית — אפשר להיכנס איתה" : "לא הצלחנו לשמור. נסו שוב.");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3.5">
      <label className="flex h-14 items-center gap-3 rounded-2xl border border-[#e4ddd0] bg-[#fdfbf7] px-4 focus-within:border-[#7d9a62] focus-within:ring-2 focus-within:ring-[#7d9a62]/20">
        <Lock className="size-[22px] shrink-0 text-[#5d6b55]" strokeWidth={1.7} />
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה חדשה (לפחות 8 תווים)"
          aria-label="סיסמה חדשה"
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-[#8f8a7d]"
        />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"} className="grid size-9 place-items-center rounded-full text-[#5d6b55]">
          {show ? <EyeOff className="size-[22px]" strokeWidth={1.7} /> : <Eye className="size-[22px]" strokeWidth={1.7} />}
        </button>
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-[#fbe9e4] px-3 py-2 text-[14px] text-[#a6402b]">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#6b8a55,#56744a)] text-[19px] font-bold text-white disabled:opacity-70">
        {loading && <Loader2 className="size-5 animate-spin" />}
        שמירה וכניסה
      </button>
    </form>
  );
}
