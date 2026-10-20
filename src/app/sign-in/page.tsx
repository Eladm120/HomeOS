import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { HomeMark, Landscape } from "@/components/auth/landscape";
import { getUser } from "@/server/context";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "התחברות" };

/**
 * Sign-in: a painted morning landscape with the HomeOS mark, and a cream
 * sheet with the form. Always light — it's the front door, before any theme.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getUser()) redirect(nextPath);

  return (
    <div className="min-h-dvh bg-[#efe8dc] text-[#2c3527]">
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden bg-[#f7f3ec] shadow-[0_0_60px_rgba(80,60,30,0.12)]">
        <div className="relative h-[min(470px,58dvh)] shrink-0">
          <Landscape className="absolute inset-0 size-full" />
          <div className="relative flex flex-col items-center pt-[calc(env(safe-area-inset-top)+3.25rem)] animate-fade-up">
            <HomeMark className="h-[74px] w-[86px] drop-shadow-[0_2px_6px_rgba(255,255,255,0.6)]" />
            <h1 className="mt-1 text-[60px] leading-none font-extrabold tracking-[-0.045em] [font-family:var(--font-heebo),system-ui] [direction:ltr]">
              <span className="text-[#2a3a25]">Home</span>
              <span className="text-[#6b8a55]">OS</span>
            </h1>
          </div>
        </div>

        <div className="relative z-10 -mt-14 flex-1 rounded-t-[2.25rem] bg-[#f7f3ec] px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-18px_rgba(60,50,30,0.35)] animate-fade-up [animation-delay:120ms]">
          <SignInForm nextPath={nextPath} initialError={error ? "ההתחברות נכשלה. נסו שוב." : undefined} />
        </div>
      </div>
    </div>
  );
}
