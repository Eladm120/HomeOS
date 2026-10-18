"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleDashed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectHomeAssistant, disconnectIntegration } from "@/server/actions/integrations";
import { scanGmailForBills, syncGoogleCalendar } from "@/server/actions/google-sync";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";

export interface ConnectionView {
  provider: "home_assistant" | "google_calendar" | "gmail";
  status: "connected" | "error" | "disconnected";
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_error: string | null;
}

type Env = { ai: boolean; encryption: boolean; google: boolean; push: boolean };

function Status({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[14px]">
      {ok ? <CheckCircle2 className="size-4 text-sage" /> : warn ? <CircleAlert className="size-4 text-amber" /> : <CircleDashed className="size-4 text-muted" />}
      {label}
    </span>
  );
}

export function IntegrationsView({ env, connections, isOwner, flash }: { env: Env; connections: ConnectionView[]; isOwner: boolean; flash: { connected?: string; error?: string } }) {
  const router = useRouter();
  const ha = connections.find((c) => c.provider === "home_assistant");
  const gcal = connections.find((c) => c.provider === "google_calendar");
  const gmail = connections.find((c) => c.provider === "gmail");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConnectionView["provider"] | null>(null);

  useEffect(() => {
    if (flash.connected) toast.success("החיבור ל-Google הושלם");
    if (flash.error) toast.error(flash.error === "google_unavailable" ? "חיבור ל-Google לא הוגדר בשרת" : "החיבור ל-Google נכשל. נסו שוב.");
  }, [flash.connected, flash.error]);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, success: (d: unknown) => string) {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return void toast.error(r.error ?? "שגיאה");
    toast.success(success(r.data));
    router.refresh();
  }

  const canConnect = isOwner;

  return (
    <>
      <PageHeader title="חיבורים" back={{ href: "/household", label: "משק הבית" }} subtitle="כל חיבור אופציונלי. האפליקציה עובדת גם בלעדיהם." />
      <div className="space-y-6 pb-10">
        <section>
          <PanelHeading title="מצב השרת" />
          <Panel>
            <div className="space-y-2 px-4 py-3">
              <Status ok={env.ai} label={env.ai ? "AI מחובר (Claude)" : "AI לא מחובר — חסר ANTHROPIC_API_KEY"} />
              <Status ok={env.encryption} label={env.encryption ? "הצפנת טוקנים פעילה" : "חסר INTEGRATION_ENCRYPTION_KEY — אי אפשר לשמור חיבורים"} />
              <Status ok={env.google} label={env.google ? "Google OAuth מוגדר" : "Google לא מוגדר — חסרים GOOGLE_CLIENT_ID/SECRET"} />
              <Status ok={env.push} label={env.push ? "התראות דחיפה מוגדרות" : "התראות דחיפה לא מוגדרות (VAPID) — ההתראות מופיעות בתוך האפליקציה"} />
            </div>
          </Panel>
        </section>

        <section>
          <PanelHeading title="🏠 Home Assistant" action={ha ? <Badge tone={ha.status === "connected" ? "sage" : "danger"}>{ha.status === "connected" ? "מחובר" : "שגיאה"}</Badge> : <Badge>לא מחובר</Badge>} />
          <div className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
            <p className="text-[14px] text-muted">שליטה במזגן, בדוד ובתאורה דרך Home Assistant. צריך כתובת https שנגישה מהאינטרנט (למשל Home Assistant Cloud) וטוקן גישה ארוך-טווח (Profile → Security → Long-lived access tokens). הטוקן נשמר מוצפן ולא מגיע לדפדפן.</p>
            {ha ? (
              <>
                <p className="text-[14px]">
                  {String(ha.config.base_url ?? "")}
                  {ha.last_sync_at ? ` · עודכן ${timeAgo(ha.last_sync_at)}` : ""}
                </p>
                {ha.last_error && <p className="text-[14px] text-danger">{ha.last_error}</p>}
                {canConnect && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setConfirm("home_assistant")}>
                    ניתוק
                  </Button>
                )}
              </>
            ) : canConnect ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("ha", () => connectHomeAssistant({ base_url: url, token }), (d) => `מחובר · ${(d as { devices: number }).devices} מכשירים`);
                }}
              >
                <Field label="כתובת" htmlFor="ha-url">
                  <Input id="ha-url" dir="ltr" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.ui.nabu.casa" />
                </Field>
                <Field label="טוקן גישה" htmlFor="ha-token">
                  <Input id="ha-token" dir="ltr" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
                </Field>
                <Button type="submit" disabled={!env.encryption || !url || !token || busy === "ha"}>
                  {busy === "ha" ? <Loader2 className="animate-spin" /> : null} חיבור ובדיקה
                </Button>
              </form>
            ) : (
              <p className="text-[14px] text-muted">רק מנהל/ת הבית יכול/ה לחבר.</p>
            )}
          </div>
        </section>

        <section>
          <PanelHeading title="📅 Google Calendar" action={gcal ? <Badge tone={gcal.status === "connected" ? "sage" : "danger"}>{gcal.status === "connected" ? "מחובר" : "שגיאה"}</Badge> : <Badge>לא מחובר</Badge>} />
          <div className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
            <p className="text-[14px] text-muted">מייבא אירועים מהיומן הראשי ל-90 הימים הקרובים, ומוסיף ליומן ב-Google אירועים שנוצרו ב-HomeOS. כל אירוע נשמר פעם אחת.</p>
            {gcal ? (
              <>
                <p className="text-[14px]">
                  {String(gcal.config.account ?? "")}
                  {gcal.last_sync_at ? ` · סונכרן ${timeAgo(gcal.last_sync_at)}` : ""}
                </p>
                {gcal.last_error && <p className="text-[14px] text-danger">{gcal.last_error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === "gcal"} onClick={() => run("gcal", syncGoogleCalendar, (d) => `יובאו ${(d as { imported: number }).imported}, נוספו ל-Google ${(d as { exported: number }).exported}`)}>
                    {busy === "gcal" ? <Loader2 className="animate-spin" /> : null} סנכרון עכשיו
                  </Button>
                  {canConnect && (
                    <Button size="sm" variant="danger-ghost" onClick={() => setConfirm("google_calendar")}>
                      ניתוק
                    </Button>
                  )}
                </div>
              </>
            ) : (
              canConnect && (
                <Button disabled={!env.google || !env.encryption} onClick={() => (window.location.href = "/api/integrations/google/start?provider=google_calendar")}>
                  חיבור Google Calendar
                </Button>
              )
            )}
          </div>
        </section>

        <section>
          <PanelHeading title="✉️ חשבונות מהמייל (Gmail)" action={gmail ? <Badge tone={gmail.status === "connected" ? "sage" : "danger"}>{gmail.status === "connected" ? "מחובר" : "שגיאה"}</Badge> : <Badge>לא מחובר</Badge>} />
          <div className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
            <p className="text-[14px] text-muted">קריאה בלבד: מחפש קובצי PDF של חשבונות מספקים מוכרים (חברת החשמל, תאגידי מים, ארנונה, גז ותקשורת) מ-60 הימים האחרונים. כל חשבון נקלט לבדיקה שלכם לפני שהוא נחשב מאומת. לחברות האלה אין ממשק API לצרכנים, לכן המייל וההעלאה הידנית הם הדרכים הנתמכות.</p>
            {gmail ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === "gmail" || !env.ai} onClick={() => run("gmail", scanGmailForBills, (d) => `נקלטו ${(d as { imported: number }).imported} חשבונות`)}>
                  {busy === "gmail" ? <Loader2 className="animate-spin" /> : null} סריקת המייל
                </Button>
                {canConnect && (
                  <Button size="sm" variant="danger-ghost" onClick={() => setConfirm("gmail")}>
                    ניתוק
                  </Button>
                )}
              </div>
            ) : (
              canConnect && (
                <Button disabled={!env.google || !env.encryption} onClick={() => (window.location.href = "/api/integrations/google/start?provider=gmail")}>
                  חיבור Gmail
                </Button>
              )
            )}
          </div>
        </section>
      </div>
      <ConfirmSheet
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="לנתק את החיבור?"
        description="הטוקן יימחק. נתונים שכבר יובאו יישארו."
        confirmLabel="ניתוק"
        destructive
        onConfirm={() => {
          if (confirm) void run("disconnect", () => disconnectIntegration(confirm), () => "נותק");
          setConfirm(null);
        }}
      />
    </>
  );
}
