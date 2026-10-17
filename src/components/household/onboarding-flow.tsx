"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardList, Plus, UserPlus } from "lucide-react";
import { AppGlyph } from "@/components/layout/app-nav";
import { createHousehold, updateDisplayName } from "@/server/actions/household";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { InvitePanel } from "./invite-panel";
import { cn } from "@/lib/utils";

const DEFAULT_ROOMS = ["סלון", "מטבח", "חדר שינה", "חדר עבודה", "חדר רחצה", "מרפסת"];
const EXTRA_ROOMS = ["חדר ילדים", "פינת קריאה", "חדר כביסה", "מחסן", "חדר אורחים", "שירותי אורחים"];

type Step = "welcome" | "rooms" | "invite" | "inventory";
const STEPS: Step[] = ["welcome", "rooms", "invite", "inventory"];

export function OnboardingFlow({
  hasHousehold,
  isOwner,
  householdName: existingName,
  initialDisplayName,
}: {
  hasHousehold: boolean;
  isOwner: boolean;
  householdName: string;
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(hasHousehold && isOwner ? "invite" : "welcome");
  // Joined via invitation: only needs a display name.
  const memberMode = hasHousehold && !isOwner;
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [householdName, setHouseholdName] = useState(existingName || "");
  const [rooms, setRooms] = useState<string[]>(DEFAULT_ROOMS);
  const [customRoom, setCustomRoom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const stepIdx = STEPS.indexOf(step);

  async function submitWelcome(e: React.FormEvent) {
    e.preventDefault();
    if (memberMode) {
      if (!displayName.trim()) return setError("נא להזין שם");
      setLoading(true);
      const res = await updateDisplayName({ name: displayName });
      setLoading(false);
      if (!res.ok) return setError(res.error);
      return finish("/");
    }
    if (!displayName.trim() || !householdName.trim()) return setError("נא למלא את שני השדות");
    setError(undefined);
    setStep("rooms");
  }

  async function submitRooms() {
    setLoading(true);
    setError(undefined);
    const nameRes = await updateDisplayName({ name: displayName });
    if (!nameRes.ok) {
      setLoading(false);
      return setError(nameRes.error);
    }
    const res = await createHousehold({ name: householdName, rooms });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setStep("invite");
  }

  function toggleRoom(name: string) {
    setRooms((r) => (r.includes(name) ? r.filter((x) => x !== name) : [...r, name]));
  }

  function addCustomRoom() {
    const n = customRoom.trim();
    if (n && !rooms.includes(n)) setRooms((r) => [...r, n]);
    setCustomRoom("");
  }

  function finish(path: string) {
    router.replace(path);
    router.refresh();
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8 flex items-center justify-center gap-2" aria-label={`שלב ${stepIdx + 1} מתוך ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1.5 rounded-full transition-all", i <= stepIdx ? "w-8 bg-primary" : "w-4 bg-surface-3")} />
        ))}
      </div>

      {step === "welcome" && (
        <form onSubmit={submitWelcome} className="space-y-6">
          <div className="text-center">
            <AppGlyph className="mx-auto mb-5 size-20" />
            <h1 className="text-2xl font-semibold">{memberMode ? `ברוכים הבאים ל${existingName}` : "ברוכים הבאים ל-HomeOS"}</h1>
            <p className="mt-2 text-muted">כמה פרטים קטנים, ואנחנו מתחילים.</p>
          </div>
          <Card className="space-y-4 p-5">
            <Field label="איך לקרוא לך?" htmlFor="dn">
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="השם שלך" maxLength={60} autoFocus />
            </Field>
            {!memberMode && (
              <Field label="שם משק הבית" htmlFor="hn" hint="למשל: הבית שלנו, בית כהן">
              <Input id="hn" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="הבית שלנו" maxLength={80} />
            </Field>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </Card>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {memberMode ? "כניסה לבית" : "המשך"} <ArrowLeft />
          </Button>
        </form>
      )}

      {step === "rooms" && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">אילו חדרים יש בבית?</h1>
            <p className="mt-2 text-muted">נשתמש בהם לסידור משימות, רכישות ותיקונים. אפשר לשנות בכל עת.</p>
          </div>
          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              {[...new Set([...DEFAULT_ROOMS, ...EXTRA_ROOMS, ...rooms])].map((r) => {
                const on = rooms.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRoom(r)}
                    aria-pressed={on}
                    className={cn(
                      "flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-all active:scale-95",
                      on ? "border-primary bg-primary-soft font-medium text-primary" : "border-border bg-surface text-muted",
                    )}
                  >
                    {on && <Check className="size-4" />}
                    {r}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomRoom();
                  }
                }}
                placeholder="חדר נוסף…"
                maxLength={60}
              />
              <Button type="button" variant="secondary" size="icon" onClick={addCustomRoom} aria-label="הוספת חדר">
                <Plus />
              </Button>
            </div>
          </Card>
          {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={() => setStep("welcome")}>
              חזרה
            </Button>
            <Button size="lg" className="flex-1" onClick={submitRooms} loading={loading}>
              יצירת משק הבית
            </Button>
          </div>
        </div>
      )}

      {step === "invite" && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-sage-soft text-sage">
              <UserPlus className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold">הזמנת בן/בת הזוג</h1>
            <p className="mt-2 text-muted">HomeOS עובד הכי טוב ביחד — רשימה אחת, מסונכרנת בזמן אמת.</p>
          </div>
          <Card className="p-5">
            <InvitePanel householdName={householdName || existingName} />
          </Card>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => setStep("inventory")}>
            המשך <ArrowLeft />
          </Button>
        </div>
      )}

      {step === "inventory" && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-amber-soft text-amber">
              <ClipboardList className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold">מה יש בבית?</h1>
            <p className="mt-2 text-muted">
              הזנת המלאי הראשוני עוזרת ל-HomeOS לדעת מה חסר. אפשר להדביק רשימה שלמה בבת אחת, ולהמשיך בהדרגה.
            </p>
          </div>
          <div className="space-y-2">
            <Button size="lg" className="w-full" onClick={() => finish("/inventory/setup")}>
              הזנת מלאי ראשוני
            </Button>
            <Button size="lg" variant="ghost" className="w-full" onClick={() => finish("/")}>
              אעשה את זה אחר כך
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
