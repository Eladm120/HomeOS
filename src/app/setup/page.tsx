import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "הגדרה ראשונית" };

/** Shown when the deployment has no Supabase configuration yet. */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <Card className="w-full max-w-lg p-6">
        <Database className="mb-3 size-10 text-primary" />
        <h1 className="text-xl font-semibold">HomeOS עדיין לא מחובר למסד נתונים</h1>
        <p className="mt-2 text-sm text-muted">כדי להתחיל, יש לחבר פרויקט Supabase:</p>
        <ol className="mt-4 list-decimal space-y-2 ps-5 text-sm leading-relaxed">
          <li>צרו פרויקט חדש ב-supabase.com (אזור מומלץ: Frankfurt / eu-central-1).</li>
          <li>
            הריצו את קובץ ה-SQL שבתיקייה <code dir="ltr" className="rounded bg-surface-2 px-1">supabase/migrations</code> ב-SQL Editor.
          </li>
          <li>
            העתיקו את <code dir="ltr">.env.example</code> אל <code dir="ltr">.env.local</code> ומלאו את ה-URL וה-anon key.
          </li>
          <li>הפעילו מחדש את השרת.</li>
        </ol>
        <p className="mt-4 text-xs text-muted">הוראות מלאות נמצאות בקובץ README.</p>
      </Card>
    </div>
  );
}
