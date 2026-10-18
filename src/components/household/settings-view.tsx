"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Plus, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addCategory,
  addLocation,
  addRoom,
  deleteCategory,
  deleteLocation,
  deleteRoom,
  removeMember,
  renameHousehold,
  revokeInvitation,
  signOut,
  updateDisplayName,
} from "@/server/actions/household";
import type { ActionResult } from "@/lib/types";
import { Card, ListRow, SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { InvitePanel } from "./invite-panel";
import { formatShortDate } from "@/lib/format";
import { PrivacySection } from "./privacy-section";

interface Named {
  id: string;
  name: string;
}

export function SettingsView(props: {
  householdName: string;
  isOwner: boolean;
  currentUserId: string;
  email: string;
  displayName: string;
  members: { userId: string; role: string; name: string }[];
  rooms: Named[];
  categories: Named[];
  locations: Named[];
  invitations: { id: string; email: string | null; expires_at: string }[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmMember, setConfirmMember] = useState<{ userId: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run<T>(fn: () => Promise<ActionResult<T>>, success?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        if (success) toast.success(success);
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-6">
      {/* Profile — Apple ID style */}
      <Card className="mb-8 flex flex-col items-center px-4 pt-6 pb-4 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#ff9500] to-[#ff2d55] text-[34px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(255,45,85,0.6)]">
          {props.displayName.slice(0, 1) || "?"}
        </span>
        <div className="title-2 mt-3">{props.displayName || "ללא שם"}</div>
        <div className="footnote num text-muted">{props.email}</div>
        <div className="mt-4 w-full">
          <InlineEdit initial={props.displayName} label="השם שלי" onSave={(name) => run(() => updateDisplayName({ name }), "השם עודכן")} />
        </div>
      </Card>

      <SectionLabel>משק הבית</SectionLabel>
      <Card className="mb-8 px-4 py-3">
        {props.isOwner ? (
          <InlineEdit initial={props.householdName} label="שם משק הבית" onSave={(name) => run(() => renameHousehold({ name }), "השם עודכן")} />
        ) : (
          <p className="text-[17px]">{props.householdName}</p>
        )}
      </Card>

      <SectionLabel>חברי הבית</SectionLabel>
      <Card className="hairline-list-inset mb-8 [--separator-inset:4rem]">
        {props.members.map((m, i) => (
          <div key={m.userId} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[17px] font-semibold text-white",
                i % 2 ? "from-[#5856d6] to-[#007aff]" : "from-[#ff9500] to-[#ff2d55]",
              )}
            >
              {m.name.slice(0, 1) || "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[17px]">
                {m.name || "ללא שם"}
                {m.role === "owner" && <Crown className="size-4 text-amber" aria-label="בעלים" />}
              </span>
              <span className="footnote block text-muted">
                {m.role === "owner" ? "בעלים" : "חבר/ה"}
                {m.userId === props.currentUserId && " · את/ה"}
              </span>
            </span>
            {(props.isOwner || m.userId === props.currentUserId) && (
              <Button
                size="sm"
                variant="danger-ghost"
                aria-label={m.userId === props.currentUserId ? "עזיבת משק הבית" : `הסרת ${m.name}`}
                onClick={() => setConfirmMember({ userId: m.userId, name: m.name })}
              >
                {m.userId === props.currentUserId ? "עזיבה" : "הסרה"}
              </Button>
            )}
          </div>
        ))}
        {props.invitations.map((inv) => (
          <div key={inv.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-muted">
              <UserPlus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="num block truncate text-[17px]">{inv.email ?? "קישור הזמנה פתוח"}</span>
              <span className="footnote block text-muted">ממתין · עד {formatShortDate(inv.expires_at)}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => run(() => revokeInvitation(inv.id), "ההזמנה בוטלה")}>
              ביטול
            </Button>
          </div>
        ))}
        {props.isOwner && (
          <ListRow
            onClick={() => setInviteOpen(true)}
            chevron={false}
            icon={
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <UserPlus className="size-5" />
              </span>
            }
            title={<span className="text-primary">הזמנת בן/בת הזוג</span>}
          />
        )}
      </Card>

      <ListEditor title="חדרים" items={props.rooms} onAdd={(name) => run(() => addRoom({ name }))} onDelete={(id) => run(() => deleteRoom(id))} />
      <ListEditor title="קטגוריות מוצרים" items={props.categories} onAdd={(name) => run(() => addCategory({ name }))} onDelete={(id) => run(() => deleteCategory(id))} />
      <ListEditor title="מקומות אחסון" items={props.locations} onAdd={(name) => run(() => addLocation({ name }))} onDelete={(id) => run(() => deleteLocation(id))} />

      <SectionLabel>תצוגה</SectionLabel>
      <Card className="mb-8 flex min-h-12 items-center justify-between px-4 py-2">
        <span className="text-[17px]">מצב כהה / בהיר</span>
        <ThemeToggle />
      </Card>

      <PrivacySection householdName={props.householdName} isOwner={props.isOwner} />

      <form
        action={signOut}
        onSubmit={() => {
          // Remove this device's offline copies of household data.
          navigator.serviceWorker?.controller?.postMessage("clear-caches");
          void import("idb-keyval").then((m) => m.clear()).catch(() => undefined);
        }}
      >
        <Card>
          <button type="submit" className="flex min-h-12 w-full items-center justify-center text-[17px] text-danger active:bg-fill">
            התנתקות
          </button>
        </Card>
      </form>

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen} title="הזמנה למשק הבית" description="שלחו את הקישור למי שגר איתכם">
        <InvitePanel householdName={props.householdName} onCreated={() => router.refresh()} />
      </Sheet>

      <ConfirmSheet
        open={!!confirmMember}
        onOpenChange={(o) => !o && setConfirmMember(null)}
        title={confirmMember?.userId === props.currentUserId ? "לעזוב את משק הבית?" : `להסיר את ${confirmMember?.name}?`}
        description={
          confirmMember?.userId === props.currentUserId
            ? "לא תהיה לך יותר גישה לנתוני הבית. אפשר להצטרף שוב רק עם הזמנה חדשה."
            : "הגישה שלהם לנתוני הבית תיחסם מיד."
        }
        confirmLabel={confirmMember?.userId === props.currentUserId ? "עזיבה" : "הסרה"}
        destructive
        loading={pending}
        onConfirm={() => {
          const target = confirmMember;
          setConfirmMember(null);
          if (!target) return;
          startTransition(async () => {
            const res = await removeMember(target.userId);
            if (!res.ok) return void toast.error(res.error);
            if (target.userId === props.currentUserId) router.replace("/onboarding");
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function InlineEdit({ initial, label, onSave }: { initial: string; label: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const dirty = value.trim() !== initial && value.trim().length > 0;
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) onSave(value.trim());
      }}
    >
      <Input aria-label={label} value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} />
      {dirty && <Button type="submit">שמירה</Button>}
    </form>
  );
}

function ListEditor({
  title,
  items,
  onAdd,
  onDelete,
}: {
  title: string;
  items: Named[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <SectionLabel>
        {title} · <span className="num">{items.length}</span>
      </SectionLabel>
      <Card className="mb-8 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <span key={i.id} className="inline-flex h-8 items-center gap-1 rounded-full bg-fill ps-3 pe-1 text-[15px]">
              {i.name}
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full text-muted active:bg-fill-strong"
                aria-label={`מחיקת ${i.name}`}
                onClick={() => onDelete(i.id)}
              >
                <X className="size-3.5" strokeWidth={2.75} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onAdd(value.trim());
            setValue("");
          }}
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="הוספה…" maxLength={60} className="h-9" />
          <Button type="submit" size="icon-sm" aria-label="הוספה" className="size-9">
            <Plus strokeWidth={2.75} />
          </Button>
        </form>
      </Card>
    </>
  );
}
