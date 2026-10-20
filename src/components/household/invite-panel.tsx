"use client";

import { useState } from "react";
import { Check, Copy, Link2, Mail, MailCheck, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createInvitation } from "@/server/actions/household";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function InvitePanel({ householdName, onCreated }: { householdName: string; onCreated?: () => void }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  async function generate() {
    setLoading(true);
    setError(undefined);
    const res = await createInvitation({ email });
    setLoading(false);
    if (!res.ok) return setError(res.fieldErrors?.email?.[0] ?? res.error);
    setLink(res.data.url);
    setEmailed(res.data.emailed ? email.trim() : null);
    if (res.data.emailed) toast.success(`ההזמנה נשלחה ל-${email.trim()}`);
    onCreated?.();
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("הקישור הועתק");
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!link) return;
    const text = `הצטרפו אליי למשק הבית "${householdName}" ב-HomeOS`;
    if (navigator.share) {
      await navigator.share({ title: "HomeOS", text, url: link }).catch(() => undefined);
    } else {
      await copy();
    }
  }

  // No mail provider configured: open the inviter's own mail app with everything filled in.
  const mailto = link
    ? `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(`הזמנה להצטרף ל${householdName} ב-HomeOS`)}&body=${encodeURIComponent(`היי! הזמנתי אותך להצטרף למשק הבית "${householdName}" ב-HomeOS — רשימת קניות משותפת, משימות וארוחות במקום אחד.\n\nלהצטרפות: ${link}\n\n(הקישור תקף ל-7 ימים)`)}`
    : "";

  if (link) {
    return (
      <div className="space-y-3">
        {emailed ? (
          <p className="flex items-center gap-2 rounded-2xl bg-sage-soft px-3 py-2.5 text-[15px] font-medium text-sage">
            <MailCheck className="size-5 shrink-0" /> ההזמנה נשלחה במייל ל-<span dir="ltr">{emailed}</span>
          </p>
        ) : email.trim() ? (
          <a href={mailto} className={buttonVariants({ size: "lg", className: "w-full" })}>
            <Mail /> שליחת ההזמנה במייל
          </a>
        ) : null}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-3">
          <Link2 className="size-4 shrink-0 text-muted" />
          <span dir="ltr" className="min-w-0 flex-1 truncate text-sm">
            {link}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={share}>
            <Share2 /> שיתוף
          </Button>
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check /> : <Copy />} העתקה
          </Button>
        </div>
        <p className="text-xs text-muted">הקישור חד-פעמי ותקף ל-7 ימים. שלחו אותו בוואטסאפ או בכל דרך אחרת.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="המייל של בן/בת הזוג" htmlFor="invite-email" error={error} hint="נשלח הזמנה למייל הזה, ורק מי שנרשם איתו יוכל להשתמש בה. אפשר גם להשאיר ריק ולשתף קישור.">
        <Input id="invite-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" />
      </Field>
      <Button className="w-full" onClick={generate} loading={loading}>
        {email.trim() ? "שליחת הזמנה" : "יצירת קישור הזמנה"}
      </Button>
    </div>
  );
}
