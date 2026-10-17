import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AppGlyph } from "@/components/layout/app-nav";
import { getUser } from "@/server/context";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "התחברות" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getUser()) redirect(nextPath);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div className="aurora" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex animate-fade-up flex-col items-center text-center">
          <AppGlyph className="mb-5 size-[88px]" />
          <h1 className="large-title">HomeOS</h1>
          <p className="mt-2 text-[17px] text-muted">הבית שלכם. מסודר, משותף, חכם.</p>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <SignInForm nextPath={nextPath} initialError={error ? "ההתחברות נכשלה או שהקישור פג. נסו שוב." : undefined} />
        </div>
      </div>
    </div>
  );
}
