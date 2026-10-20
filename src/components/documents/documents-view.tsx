"use client";

import { Emoji3D } from "@/components/ui/emoji-3d";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import type { HouseholdDocument } from "@/lib/types";
import { DOCUMENT_CATEGORY } from "@/lib/labels";
import { daysUntil, formatShortDate } from "@/lib/format";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { AddButton, FilterPills, Panel, PanelRow, SearchField } from "@/components/ui/panel";
import { DocumentUploadSheet } from "./document-upload";

export function expiryBadge(date: string | null): { text: string; tone: "danger" | "amber" | "neutral" } | null {
  if (!date) return null;
  const d = daysUntil(date);
  if (d < 0) return { text: "פג תוקף", tone: "danger" };
  if (d <= 30) return { text: `בעוד ${d} ימים`, tone: "amber" };
  return { text: `עד ${formatShortDate(date)}`, tone: "neutral" };
}

export function DocIcon({ category }: { category: string }) {
  return (
    <span aria-hidden className="cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ "--h": 260 } as React.CSSProperties}>
      <Emoji3D emoji={(DOCUMENT_CATEGORY[category] ?? DOCUMENT_CATEGORY.other).emoji} className="size-[72%]" />
    </span>
  );
}

export function DocumentsView({ householdId, documents, aiEnabled }: { householdId: string; documents: HouseholdDocument[]; aiEnabled: boolean }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sheet, setSheet] = useState(false);
  useOpenFromQuery(() => setSheet(true));

  // Show only the newest version of each document chain.
  const latest = useMemo(() => {
    const superseded = new Set(documents.map((d) => d.previous_version_id).filter(Boolean));
    return documents.filter((d) => !superseded.has(d.id));
  }, [documents]);
  const categories = [...new Set(latest.map((d) => d.category))];
  const filtered = latest.filter((d) => {
    if (cat !== "all" && d.category !== cat) return false;
    const q = query.trim().toLowerCase();
    return !q || [d.title, d.notes, d.extracted_text, ...d.tags].some((f) => f?.toLowerCase().includes(q));
  });
  const expiringSoon = latest.filter((d) => d.expires_on && daysUntil(d.expires_on) >= 0 && daysUntil(d.expires_on) <= 30).length;

  return (
    <>
      <PageHeader
        title="מסמכים"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={latest.length ? `${latest.length} מסמכים${expiringSoon ? ` · ${expiringSoon} מסתיימים בקרוב` : ""}` : "ביטוחים, חוזים, חשבוניות ואחריות"}
        actions={<AddButton onClick={() => setSheet(true)} label="מסמך" />}
      />
      {latest.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <SearchField value={query} onChange={setQuery} placeholder="חיפוש בשם, בתגיות ובתוכן המסמך…" />
          {categories.length > 1 && (
            <FilterPills
              label="סוג"
              value={cat}
              onChange={setCat}
              options={[{ value: "all", label: "הכל", count: latest.length }, ...categories.map((c) => ({ value: c, label: DOCUMENT_CATEGORY[c]?.label ?? c, count: latest.filter((d) => d.category === c).length }))]}
            />
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={<FileText />} title={latest.length ? "אין תוצאות" : "הכספת ריקה"} description={latest.length ? "נסו מילה אחרת." : "העלו ביטוח דירה, חוזה שכירות או חשבוניות של מכשירים. הקבצים פרטיים לבית שלכם בלבד."} />
      ) : (
        <Panel>
          {filtered.map((d) => {
            const b = expiryBadge(d.expires_on);
            return (
              <PanelRow
                key={d.id}
                href={`/documents/${d.id}`}
                leading={<DocIcon category={d.category} />}
                title={d.title}
                subtitle={[DOCUMENT_CATEGORY[d.category]?.label, d.version > 1 ? `גרסה ${d.version}` : null, d.sensitive ? "🔒 רגיש" : null].filter(Boolean).join(" · ")}
                trailing={b ? <Badge tone={b.tone}>{b.text}</Badge> : undefined}
              />
            );
          })}
        </Panel>
      )}
      <DocumentUploadSheet open={sheet} onOpenChange={setSheet} householdId={householdId} aiEnabled={aiEnabled} />
    </>
  );
}
