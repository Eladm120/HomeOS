"use client";

import { useMemo, useState } from "react";
import { Hammer } from "lucide-react";
import type { HomeProject, ProjectKind, Room, ServiceProvider } from "@/lib/types";
import { PROJECT_STATUS } from "@/lib/labels";
import { daysUntil, relativeDays } from "@/lib/format";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterPills, Panel, PanelRow, SearchField } from "@/components/ui/panel";
import { ProjectSheet } from "./project-sheet";

type KindFilter = "all" | ProjectKind;
type StateFilter = "open" | "done";

export function ProjectIcon({ kind, className }: { kind: ProjectKind; className?: string }) {
  return (
    <span aria-hidden className={cn("cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]", className)} style={{ "--h": kind === "repair" ? 30 : 185 } as React.CSSProperties}>
      {kind === "repair" ? "🔧" : "🛠️"}
    </span>
  );
}

export function ProjectsView({
  householdId,
  projects,
  taskStats,
  rooms,
  members,
  providers,
  appliances,
}: {
  householdId: string;
  projects: HomeProject[];
  taskStats: Record<string, { done: number; total: number }>;
  rooms: Room[];
  members: { id: string; name: string }[];
  providers: ServiceProvider[];
  appliances: { id: string; name: string }[];
}) {
  useRealtimeRefresh("home_projects", householdId);
  const [kind, setKind] = useState<KindFilter>("all");
  const [state, setState] = useState<StateFilter>("open");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<ProjectKind | null>(null);
  useOpenFromQuery(() => setSheet(new URLSearchParams(window.location.search).get("kind") === "repair" ? "repair" : "project"));

  const isOpen = (p: HomeProject) => p.status !== "completed" && p.status !== "canceled";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (kind === "all" || p.kind === kind) && (state === "open" ? isOpen(p) : !isOpen(p)))
      .filter((p) => !q || [p.title, p.description, p.symptoms, p.notes].some((f) => f?.toLowerCase().includes(q)));
  }, [projects, kind, state, query]);

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name;
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name;
  const openRepairs = projects.filter((p) => p.kind === "repair" && isOpen(p)).length;

  return (
    <>
      <PageHeader
        title="פרויקטים ותיקונים"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={openRepairs ? `${openRepairs} תקלות פתוחות` : "שיפורים, תיקונים ובעלי מקצוע"}
      />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => setSheet("repair")}>
          🔧 דיווח על תקלה
        </Button>
        <Button variant="secondary" onClick={() => setSheet("project")}>
          🛠️ פרויקט חדש
        </Button>
      </div>
      <div className="mb-4 flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="חיפוש בפרויקטים ובתקלות…" />
        <FilterPills
          label="סוג"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "הכל" },
            { value: "repair", label: "תיקונים", count: projects.filter((p) => p.kind === "repair" && isOpen(p)).length },
            { value: "project", label: "פרויקטים", count: projects.filter((p) => p.kind === "project" && isOpen(p)).length },
          ]}
        />
        <FilterPills
          label="מצב"
          value={state}
          onChange={setState}
          options={[
            { value: "open", label: "פתוחים" },
            { value: "done", label: "הושלמו / בוטלו" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Hammer />}
          title={projects.length ? "אין תוצאות" : "הכל תקין בבית"}
          description={projects.length ? "נסו סינון אחר." : "תקלה במזגן? מדף להתקין? רשמו כאן, עם תמונות, מה ניסיתם ומי הטכנאי."}
        />
      ) : (
        <Panel>
          {filtered.map((p) => {
            const stats = taskStats[p.id];
            const due = p.due_on && isOpen(p) ? daysUntil(p.due_on) : null;
            return (
              <PanelRow
                key={p.id}
                href={`/projects/${p.id}`}
                leading={<ProjectIcon kind={p.kind} />}
                title={p.title}
                subtitle={[
                  roomName(p.room_id),
                  memberName(p.owner_id),
                  stats?.total ? `${stats.done}/${stats.total} משימות` : null,
                  due != null ? (due < 0 ? `באיחור (${relativeDays(due)})` : `יעד ${relativeDays(due)}`) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined}
                trailing={<Badge tone={p.priority === "high" && isOpen(p) ? "danger" : PROJECT_STATUS[p.status].tone}>{p.priority === "high" && isOpen(p) ? "דחוף" : PROJECT_STATUS[p.status].label}</Badge>}
              />
            );
          })}
        </Panel>
      )}

      <ProjectSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        project={null}
        initialKind={sheet ?? "project"}
        rooms={rooms}
        members={members}
        providers={providers}
        appliances={appliances}
      />
    </>
  );
}
