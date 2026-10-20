"use client";

import { Emoji3D } from "@/components/ui/emoji-3d";
import { useMemo, useState } from "react";
import { Refrigerator } from "lucide-react";
import type { Appliance, Room } from "@/lib/types";
import { daysUntil, formatShortDate } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { AddButton, Panel, PanelRow, SearchField } from "@/components/ui/panel";
import { SignedImage } from "@/components/media/signed-image";
import { ApplianceSheet } from "./appliance-sheet";

export function warrantyBadge(until: string | null): { text: string; tone: "sage" | "amber" | "neutral" } | null {
  if (!until) return null;
  const d = daysUntil(until);
  if (d < 0) return { text: "האחריות הסתיימה", tone: "neutral" };
  if (d <= 30) return { text: `אחריות: עוד ${d} ימים`, tone: "amber" };
  return { text: `באחריות עד ${formatShortDate(until)}`, tone: "sage" };
}

const KIND_EMOJI: [RegExp, string][] = [
  [/מקרר|מקפיא/, "🧊"],
  [/כביסה|מייבש/, "🫧"],
  [/מדיח/, "🍽️"],
  [/תנור|כיריים|מיקרו/, "🔥"],
  [/מזגן/, "❄️"],
  [/דוד/, "♨️"],
  [/טלוויזיה|מסך/, "📺"],
  [/שואב|רובוט/, "🧹"],
];
export const applianceEmoji = (a: Pick<Appliance, "name" | "kind">) => KIND_EMOJI.find(([re]) => re.test(`${a.kind ?? ""} ${a.name}`))?.[1] ?? "🔌";

export function AppliancesView({ householdId, appliances, rooms, signedUrls }: { householdId: string; appliances: Appliance[]; rooms: Room[]; signedUrls: Record<string, string> }) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);
  useOpenFromQuery(() => setSheet(true));
  const filtered = appliances.filter((a) => {
    const q = query.trim().toLowerCase();
    return !q || [a.name, a.kind, a.brand, a.model].some((f) => f?.toLowerCase().includes(q));
  });
  const ending = appliances.filter((a) => a.warranty_until && daysUntil(a.warranty_until) >= 0 && daysUntil(a.warranty_until) <= 30).length;

  return (
    <>
      <PageHeader
        title="מכשירי חשמל"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={appliances.length ? `${appliances.length} מכשירים${ending ? ` · ${ending} עם אחריות שמסתיימת` : ""}` : "אחריות, חשבוניות ותחזוקה"}
        actions={<AddButton onClick={() => setSheet(true)} label="מכשיר" />}
      />
      {appliances.length > 3 && (
        <div className="mb-4">
          <SearchField value={query} onChange={setQuery} placeholder="חיפוש לפי שם, יצרן או דגם…" />
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={<Refrigerator />} title={appliances.length ? "אין תוצאות" : "עוד אין מכשירים"} description="רשמו את המקרר, מכונת הכביסה והמזגן עם תאריך קנייה ואחריות. HomeOS יזכיר לפני שהאחריות נגמרת." />
      ) : (
        <Panel>
          {filtered.map((a) => {
            const b = warrantyBadge(a.warranty_until);
            return (
              <PanelRow
                key={a.id}
                href={`/appliances/${a.id}`}
                leading={
                  a.image_path ? (
                    <SignedImage path={a.image_path} alt={a.name} className="size-11 shrink-0 rounded-[14px]" />
                  ) : (
                    <span aria-hidden className="cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ "--h": 235 } as React.CSSProperties}>
                      <Emoji3D emoji={applianceEmoji(a)} className="size-[72%]" />
                    </span>
                  )
                }
                title={a.name}
                subtitle={[a.brand, a.model, rooms.find((r) => r.id === a.room_id)?.name].filter(Boolean).join(" · ") || undefined}
                trailing={b ? <Badge tone={b.tone}>{b.text}</Badge> : undefined}
              />
            );
          })}
        </Panel>
      )}
      <ApplianceSheet open={sheet} onOpenChange={setSheet} householdId={householdId} appliance={null} rooms={rooms} />
    </>
  );
}
