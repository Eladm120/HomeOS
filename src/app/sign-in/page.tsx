import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getUser } from "@/server/context";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "התחברות" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getUser()) redirect(nextPath);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--primary-soft),transparent_60%)] px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-[1.4rem] bg-primary text-2xl font-bold text-primary-foreground shadow-lift">
            H
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">HomeOS</h1>
          <p className="mt-2 text-muted">הבית שלכם, מסודר. במקום אחד, ביחד.</p>
        </div>
        <SignInForm nextPath={nextPath} initialError={error ? "ההתחברות נכשלה או שהקישור פג. נסו שוב." : undefined} />
      </div>
    </div>
  );
}
