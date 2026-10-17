"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, LogOut, Plus, Trash2, UserPlus, X } from "lucide-react";
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
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { InvitePanel } from "./invite-panel";
import { formatShortDate } from "@/lib/format";

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
    <div className="space-y-4 pb-6">
      <Card>
        <CardHeader title="הפרופיל שלי" subtitle={props.email} />
        <div className="px-5 pb-5">
          <InlineEdit initial={props.displayName} label="השם שלי" onSave={(name) => run(() => updateDisplayName({ name }), "השם עודכן")} />
        </div>
      </Card>

      <Card>
        <CardHeader title="משק הבית" />
        <div className="px-5 pb-5">
          {props.isOwner ? (
            <InlineEdit initial={props.householdName} label="שם משק הבית" onSave={(name) => run(() => renameHousehold({ name }), "השם עודכן")} />
          ) : (
            <p className="font-medium">{props.householdName}</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="חברי הבית"
          action={
            props.isOwner && (
              <Button size="sm" variant="soft" onClick={() => setInviteOpen(true)}>
                <UserPlus /> הזמנה
              </Button>
            )
          }
        />
        <ul className="divide-y divide-border/70 px-5 pb-2">
          {props.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-3">
              <div className="grid size-10 place-items-center rounded-full bg-primary-soft font-semibold text-primary">
                {m.name.slice(0, 1) || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {m.name || "ללא שם"}
                  {m.userId === props.currentUserId && <span className="text-xs text-muted">(את/ה)</span>}
                </div>
                <div className="text-xs text-muted">{m.role === "owner" ? "בעלים" : "חבר/ה"}</div>
              </div>
              {m.role === "owner" && <Crown className="size-4 text-amber" aria-label="בעלים" />}
              {(props.isOwner || m.userId === props.currentUserId) && (
                <Button
                  size="icon-sm"
                  variant="danger-ghost"
                  aria-label={m.userId === props.currentUserId ? "עזיבת משק הבית" : `הסרת ${m.name}`}
                  onClick={() => setConfirmMember({ userId: m.userId, name: m.name })}
                >
                  {m.userId === props.currentUserId ? <LogOut /> : <X />}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {props.invitations.length > 0 && (
          <div className="border-t border-border/70 px-5 py-3">
            <p className="mb-2 text-xs font-medium text-muted">הזמנות פתוחות</p>
            <ul className="space-y-2">
              {props.invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 text-sm">
                  <span className="num min-w-0 flex-1 truncate">{inv.email ?? "קישור פתוח"}</span>
                  <span className="text-xs text-muted">עד {formatShortDate(inv.expires_at)}</span>
                  <Button size="sm" variant="ghost" onClick={() => run(() => revokeInvitation(inv.id), "ההזמנה בוטלה")}>
                    ביטול
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <ListEditor title="חדרים" items={props.rooms} onAdd={(name) => run(() => addRoom({ name }))} onDelete={(id) => run(() => deleteRoom(id))} />
      <ListEditor title="קטגוריות מוצרים" items={props.categories} onAdd={(name) => run(() => addCategory({ name }))} onDelete={(id) => run(() => deleteCategory(id))} />
      <ListEditor title="מקומות אחסון" items={props.locations} onAdd={(name) => run(() => addLocation({ name }))} onDelete={(id) => run(() => deleteLocation(id))} />

      <Card className="flex items-center justify-between px-5 py-3">
        <span className="font-medium">מצב תצוגה</span>
        <ThemeToggle />
      </Card>

      <form
        action={signOut}
        onSubmit={() => {
          // Remove this device's offline copies of household data.
          navigator.serviceWorker?.controller?.postMessage("clear-caches");
          void import("idb-keyval").then((m) => m.clear()).catch(() => undefined);
        }}
      >
        <Button type="submit" variant="outline" className="w-full">
          <LogOut /> התנתקות
        </Button>
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
    <Card>
      <CardHeader title={title} subtitle={`${items.length} פריטים`} />
      <div className="px-5 pb-5">
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <Badge key={i.id} className="h-8 gap-1 pe-1 ps-3 text-sm">
              {i.name}
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full hover:bg-surface-3"
                aria-label={`מחיקת ${i.name}`}
                onClick={() => onDelete(i.id)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </Badge>
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
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="הוספה…" maxLength={60} className="h-10" />
          <Button type="submit" size="icon-sm" variant="secondary" aria-label="הוספה" className="size-10">
            <Plus />
          </Button>
        </form>
      </div>
    </Card>
  );
}
