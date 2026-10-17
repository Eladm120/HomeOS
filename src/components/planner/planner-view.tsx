"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sofa } from "lucide-react";
import type { PlannedPurchase, PlannedPurchaseStatus, Room } from "@/lib/types";
import { PURCHASE_STATUS } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { AddButton, FilterPills, Panel, PanelHeading, PanelRow, SearchField } from "@/components/ui/panel";
import { SignedImage } from "@/components/media/signed-image";
import { PurchaseSheet } from "./purchase-sheet";

type View = "rooms" | "board" | "grid";
type StatusFilter = "open" | "purchased" | "all";
const OPEN: PlannedPurchaseStatus[] = ["idea", "researching", "considering", "ready"];

export function PurchaseThumb({ p, className }: { p: Pick<PlannedPurchase, "name" | "image_path">; className?: string }) {
  return p.image_path ? (
    <SignedImage path={p.image_path} alt={p.name} className={cn("size-12 shrink-0 rounded-[14px]", className)} />
  ) : (
    <span aria-hidden className={cn("cat-tint grid size-12 shrink-0 place-items-center rounded-[14px] text-[22px]", className)} style={{ "--h": 100 } as React.CSSProperties}>
      🛋️
    </span>
  );
}

function priceLine(p: PlannedPurchase): string {
  const parts = [p.store, p.price != null ? formatCurrency(Number(p.price) * p.quantity, p.currency) : null, p.quantity > 1 ? `${p.quantity} יח׳` : null];
  return parts.filter(Boolean).join(" · ");
}

export function PlannerView({
  householdId,
  purchases,
  rooms,
  projects,
  signedUrls,
}: {
  householdId: string;
  purchases: PlannedPurchase[];
  rooms: Room[];
  projects: { id: string; title: string }[];
  signedUrls: Record<string, string>;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  useRealtimeRefresh("planned_purchases", householdId);
  const [view, setView] = useState<View>("rooms");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);
  const [defaults, setDefaults] = useState<{ project_id?: string; room_id?: string }>({});
  useOpenFromQuery(() => {
    const params = new URLSearchParams(window.location.search);
    const project = params.get("project");
    setDefaults(project && projects.some((x) => x.id === project) ? { project_id: project } : {});
    setSheet(true);
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchases.filter((p) => {
      if (status === "open" && !OPEN.includes(p.status)) return false;
      if (status === "purchased" && p.status !== "purchased") return false;
      if (!q) return true;
      return [p.name, p.store, p.notes, p.color, p.material].some((f) => f?.toLowerCase().includes(q));
    });
  }, [purchases, status, query]);

  const openTotal = purchases.filter((p) => OPEN.includes(p.status) && p.price != null).reduce((s, p) => s + Number(p.price) * p.quantity, 0);
  const counts = {
    open: purchases.filter((p) => OPEN.includes(p.status)).length,
    purchased: purchases.filter((p) => p.status === "purchased").length,
    all: purchases.length,
  };

  const roomGroups = useMemo(() => {
    const byRoom = new Map<string | null, PlannedPurchase[]>();
    for (const p of filtered) byRoom.set(p.room_id, [...(byRoom.get(p.room_id) ?? []), p]);
    const ordered = rooms.filter((r) => byRoom.has(r.id)).map((r) => ({ id: r.id, name: r.name, items: byRoom.get(r.id)! }));
    if (byRoom.has(null)) ordered.push({ id: "none", name: "ללא חדר", items: byRoom.get(null)! });
    return ordered;
  }, [filtered, rooms]);

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name;

  return (
    <>
      <PageHeader
        title="תכנון רכישות"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={counts.open ? `${counts.open} פריטים פתוחים${openTotal ? ` · סה״כ ${formatCurrency(openTotal)}` : ""}` : "מה חסר לבית, לפי חדרים"}
        actions={
          <AddButton
            onClick={() => {
              setDefaults({});
              setSheet(true);
            }}
            label="פריט"
          />
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="חיפוש לפי שם, חנות, צבע…" />
        <Segmented
          label="תצוגה"
          value={view}
          onChange={setView}
          options={[
            { value: "rooms", label: "לפי חדר" },
            { value: "board", label: "לוח" },
            { value: "grid", label: "כרטיסים" },
          ]}
        />
        <FilterPills
          label="סטטוס"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "פתוחים", count: counts.open },
            { value: "purchased", label: "נקנו", count: counts.purchased },
            { value: "all", label: "הכל", count: counts.all },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Sofa />}
          title={purchases.length ? "אין תוצאות" : "עוד אין פריטים"}
          description={purchases.length ? "נסו חיפוש או סינון אחר." : "רשמו רעיונות לרהיטים ומוצרים לבית, עם תמונה, קישור ומחיר, ושניכם תראו אותם."}
        />
      ) : view === "rooms" ? (
        <div className="space-y-5">
          {roomGroups.map((g) => (
            <section key={g.id}>
              <PanelHeading title={g.name} count={g.items.length} />
              <Panel>
                {g.items.map((p) => (
                  <PanelRow
                    key={p.id}
                    href={`/planner/${p.id}`}
                    leading={<PurchaseThumb p={p} />}
                    title={p.name}
                    subtitle={priceLine(p) || undefined}
                    trailing={<Badge tone={PURCHASE_STATUS[p.status].tone}>{PURCHASE_STATUS[p.status].label}</Badge>}
                  />
                ))}
              </Panel>
            </section>
          ))}
        </div>
      ) : view === "board" ? (
        <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {(status === "purchased" ? (["purchased"] as PlannedPurchaseStatus[]) : status === "open" ? OPEN : ([...OPEN, "purchased", "canceled"] as PlannedPurchaseStatus[])).map((s) => {
            const col = filtered.filter((p) => p.status === s);
            return (
              <section key={s} className="w-[78vw] max-w-[300px] shrink-0 snap-start">
                <PanelHeading title={PURCHASE_STATUS[s].label} count={col.length} />
                <div className="flex flex-col gap-2">
                  {col.map((p) => (
                    <Link key={p.id} href={`/planner/${p.id}`} className="pressable flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                      <PurchaseThumb p={p} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="footnote block truncate text-muted">{[roomName(p.room_id), priceLine(p)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  ))}
                  {col.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-[14px] text-muted">ריק</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/planner/${p.id}`} className="pressable overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
              <PurchaseThumb p={p} className="aspect-square h-auto w-full rounded-none text-[44px]" />
              <div className="p-3">
                <p className="truncate font-medium">{p.name}</p>
                <p className="footnote truncate text-muted">{priceLine(p) || roomName(p.room_id) || " "}</p>
                <Badge className="mt-2" tone={PURCHASE_STATUS[p.status].tone}>
                  {PURCHASE_STATUS[p.status].label}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <PurchaseSheet open={sheet} onOpenChange={setSheet} householdId={householdId} rooms={rooms} projects={projects} purchase={null} defaults={defaults} />
    </>
  );
}
