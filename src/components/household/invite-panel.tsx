"use client";

import { useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createInvitation } from "@/server/actions/household";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function InvitePanel({ householdName, onCreated }: { householdName: string; onCreated?: () => void }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
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

  if (link) {
    return (
      <div className="space-y-3">
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
      <Field label="המייל של בן/בת הזוג (לא חובה)" htmlFor="invite-email" error={error} hint="אם תזינו מייל — רק מי שמתחבר עם המייל הזה יוכל להשתמש בהזמנה.">
        <Input id="invite-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" />
      </Field>
      <Button className="w-full" onClick={generate} loading={loading}>
        יצירת קישור הזמנה
      </Button>
    </div>
  );
}
