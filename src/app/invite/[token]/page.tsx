import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { AppGlyph } from "@/components/layout/app-nav";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getUser } from "@/server/context";
import { AcceptInviteButton } from "@/components/household/accept-invite-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "הזמנה למשק בית" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[0-9a-f]{48}$/.test(token);
  const supabase = await getSupabaseServer();
  const user = await getUser();

  const { data } = valid
    ? await supabase.rpc("get_invitation_preview", { p_token: token })
    : { data: null };
  const preview = (data as { household_name: string; inviter_name: string | null; is_valid: boolean; email: string | null }[] | null)?.[0];

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <div className="aurora" aria-hidden />
      <Card className="glass relative w-full max-w-sm animate-fade-up p-6 text-center">
        {!preview || !preview.is_valid ? (
          <>
            <TriangleAlert className="mx-auto mb-3 size-10 text-amber" />
            <h1 className="text-xl font-semibold">ההזמנה אינה בתוקף</h1>
            <p className="mt-2 text-sm text-muted">ייתכן שפג תוקפה, שבוטלה או שכבר נוצלה. בקשו קישור חדש.</p>
            <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-6 w-full" })}>
              למסך הראשי
            </Link>
          </>
        ) : (
          <>
            <AppGlyph className="mx-auto mb-5 size-20" />
            <p className="text-sm text-muted">{preview.inviter_name ? `${preview.inviter_name} מזמין/ה אותך להצטרף אל` : "הוזמנת להצטרף אל"}</p>
            <h1 className="mt-1 text-2xl font-semibold">{preview.household_name}</h1>
            <p className="mt-3 text-sm text-muted">רשימת קניות משותפת, מלאי הבית, ובקרוב — הרבה יותר.</p>
            {preview.email && (
              <p className="mt-2 text-xs text-muted">
                ההזמנה מיועדת ל-<span className="num">{preview.email}</span>
              </p>
            )}
            <div className="mt-6">
              {user ? (
                <AcceptInviteButton token={token} />
              ) : (
                <Link
                  href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className={buttonVariants({ size: "lg", className: "w-full" })}
                >
                  התחברות והצטרפות
                </Link>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
