import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeMark } from "@/components/auth/landscape";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { getUser } from "@/server/context";

export const metadata: Metadata = { title: "קביעת סיסמה" };

/** Reached from the one-time email link (the session is already set by /auth/confirm). */
export default async function SetPasswordPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in?error=link");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f3ec] px-6 py-10 text-[#2c3527]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <HomeMark className="h-14 w-16" />
          <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.02em]">בחירת סיסמה</h1>
          <p className="mt-1 text-[15px] text-[#5d6b55]" dir="auto">
            {user.email}
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </div>
  );
}
