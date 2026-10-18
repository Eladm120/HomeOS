"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchHit } from "@/server/search";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/card";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";

export function SearchView({ query, hits }: { query: string; hits: SearchHit[] }) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() !== query) router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, query, router]);

  const groups = [...new Set(hits.map((h) => h.group))];
  return (
    <>
      <PageHeader title="חיפוש" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="מוצר, מתכון, מכשיר, מסמך, חשבון…"
        aria-label="חיפוש בכל הבית"
        enterKeyHint="search"
        className="mb-5 h-12 w-full rounded-2xl border-0 bg-fill px-4 text-[17px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-primary/40"
      />
      {query.length < 2 ? (
        <EmptyState icon={<Search />} title="חיפוש בכל הבית" description="מלאי, קניות, מתכונים, תיקונים, משימות, מכשירים, חשבונות, יומן ומסמכים — במקום אחד." />
      ) : hits.length === 0 ? (
        <EmptyState icon={<Search />} title="לא נמצא" description={`אין תוצאות ל"${query}".`} />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g}>
              <PanelHeading title={g} count={hits.filter((h) => h.group === g).length} />
              <Panel>
                {hits
                  .filter((h) => h.group === g)
                  .map((h, i) => (
                    <PanelRow key={`${h.href}-${i}`} href={h.href} title={h.title} subtitle={h.detail ?? undefined} />
                  ))}
              </Panel>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
