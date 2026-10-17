"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addProjectActivity,
  addProjectTask,
  deleteProject,
  deleteProjectActivity,
  deleteProjectTask,
  setProjectStatus,
  setProjectTaskDone,
} from "@/server/actions/projects";
import type { Attachment, HomeProject, PlannedPurchase, ProjectActivity, ProjectActivityKind, ProjectTask, Room, ServiceProvider } from "@/lib/types";
import { ACTIVITY_KIND, PRIORITY_LABEL, PROJECT_KIND, PROJECT_STATUS, PURCHASE_STATUS, options } from "@/lib/labels";
import { daysUntil, formatCurrency, formatShortDate, relativeDays, todayInZone } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { AttachmentsPanel } from "@/components/media/attachments";
import { CheckCircle } from "@/components/grocery/item-row";
import { PurchaseThumb } from "@/components/planner/planner-view";
import { ProjectSheet } from "./project-sheet";
import { ProjectIcon } from "./projects-view";

const ACTIVITY_ICON: Record<ProjectActivityKind, string> = {
  note: "📝",
  troubleshooting: "🧪",
  technician_visit: "🧰",
  quote: "🧾",
  status_change: "🔄",
  resolution: "✅",
};

export function ProjectDetail({
  householdId,
  project: p,
  tasks,
  activities,
  purchases,
  attachments,
  rooms,
  members,
  providers,
  appliances,
  signedUrls,
}: {
  householdId: string;
  project: HomeProject;
  tasks: ProjectTask[];
  activities: ProjectActivity[];
  purchases: PlannedPurchase[];
  attachments: Attachment[];
  rooms: Room[];
  members: { id: string; name: string }[];
  providers: ServiceProvider[];
  appliances: { id: string; name: string }[];
  signedUrls: Record<string, string>;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [entry, setEntry] = useState<ProjectActivityKind | null>(null);
  const [taskDraft, setTaskDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const repair = p.kind === "repair";
  const open = p.status !== "completed" && p.status !== "canceled";
  const provider = providers.find((x) => x.id === p.provider_id);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name;
  const due = p.due_on ? daysUntil(p.due_on) : null;
  const doneTasks = tasks.filter((t) => t.done).length;
  const quotes = activities.filter((a) => a.kind === "quote" && a.amount != null);
  const purchaseTotal = purchases.filter((x) => x.status !== "canceled" && x.price != null).reduce((s, x) => s + Number(x.price) * x.quantity, 0);

  async function move(status: HomeProject["status"]) {
    setBusy(true);
    const res = await setProjectStatus(p.id, status);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = taskDraft.trim();
    if (!title) return;
    const res = await addProjectTask(p.id, { title, due_on: null });
    if (!res.ok) return void toast.error(res.error);
    setTaskDraft("");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={p.title}
        back={{ href: "/projects", label: "פרויקטים ותיקונים" }}
        subtitle={[PROJECT_KIND[p.kind], rooms.find((r) => r.id === p.room_id)?.name].filter(Boolean).join(" · ")}
        actions={
          <Button size="icon-sm" variant="secondary" onClick={() => setEdit(true)} aria-label="עריכה">
            <Pencil />
          </Button>
        }
      />

      <div className="space-y-6">
        <section className="flex items-center gap-3">
          <ProjectIcon kind={p.kind} className="size-14 text-[28px]" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>
            {p.priority === "high" && <Badge tone="danger">דחוף</Badge>}
            {due != null && open && <Badge tone={due < 0 ? "danger" : "neutral"}>יעד {relativeDays(due)}</Badge>}
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {open && p.status !== "in_progress" && (
            <Button onClick={() => move("in_progress")} loading={busy}>
              התחלנו לטפל
            </Button>
          )}
          {open && (
            <Button variant={p.status === "in_progress" ? "primary" : "secondary"} onClick={() => move("completed")} loading={busy}>
              {repair ? "תוקן ✓" : "הושלם ✓"}
            </Button>
          )}
          {open && p.status !== "waiting" && (
            <Button variant="secondary" onClick={() => move("waiting")} loading={busy}>
              ממתין לגורם חיצוני
            </Button>
          )}
          {!open && (
            <Button variant="secondary" onClick={() => move("in_progress")} loading={busy}>
              פתיחה מחדש
            </Button>
          )}
        </section>

        {repair && (p.symptoms || p.resolution || p.warranty_notes || p.first_reported_on) && (
          <Panel>
            {p.symptoms && <InfoBlock label="תסמינים" value={p.symptoms} />}
            {p.first_reported_on && <InfoLine label="דווח לראשונה" value={formatShortDate(p.first_reported_on)} />}
            {p.warranty_notes && <InfoLine label="אחריות" value={p.warranty_notes} />}
            {p.resolution && <InfoBlock label="איך נפתר" value={p.resolution} />}
          </Panel>
        )}
        {!repair && p.description && (
          <Panel>
            <InfoBlock label="תיאור" value={p.description} />
          </Panel>
        )}

        <Panel>
          <InfoLine label="אחראי/ת" value={nameOf(p.owner_id) ?? "לא נקבע"} />
          <InfoLine label="עדיפות" value={PRIORITY_LABEL[p.priority]} />
          {p.estimated_cost != null && <InfoLine label="עלות משוערת" value={formatCurrency(Number(p.estimated_cost), p.currency)} />}
          {p.actual_cost != null && <InfoLine label="עלות בפועל" value={formatCurrency(Number(p.actual_cost), p.currency)} />}
          {quotes.length > 0 && <InfoLine label="הצעות מחיר" value={quotes.map((q) => formatCurrency(Number(q.amount))).join(" · ")} />}
          {appliances.find((a) => a.id === p.appliance_id) && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-[15px]">
              <span className="text-muted">מכשיר</span>
              <Link href={`/appliances/${p.appliance_id}`} className="font-medium text-primary">
                {appliances.find((a) => a.id === p.appliance_id)!.name}
              </Link>
            </div>
          )}
          {provider && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-[15px]">
              <span className="shrink-0 text-muted">בעל מקצוע</span>
              <span className="flex items-center gap-2 text-end">
                <span>
                  {provider.name}
                  {provider.trade ? ` · ${provider.trade}` : ""}
                </span>
                {provider.phone && (
                  <a href={`tel:${provider.phone.replace(/[^\d+]/g, "")}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-primary" dir="ltr">
                    <Phone className="size-3.5" />
                    <span className="select-all">{provider.phone}</span>
                  </a>
                )}
              </span>
            </div>
          )}
        </Panel>

        {/* Tasks */}
        <section>
          <PanelHeading title="משימות" count={tasks.length ? doneTasks : undefined} action={tasks.length ? <span className="footnote text-muted">{`${doneTasks}/${tasks.length}`}</span> : undefined} />
          <Panel>
            {tasks.map((t) => (
              <div key={t.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <CheckCircle
                  checked={t.done}
                  label={t.done ? `ביטול סימון ${t.title}` : `סימון ${t.title} כבוצע`}
                  onToggle={async () => {
                    const r = await setProjectTaskDone(p.id, t.id, !t.done);
                    if (!r.ok) toast.error(r.error);
                    router.refresh();
                  }}
                />
                <span className={cn("min-w-0 flex-1 text-[16px]", t.done && "text-muted line-through")}>
                  {t.title}
                  {t.assignee_id && <span className="footnote block text-muted">{nameOf(t.assignee_id)}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`מחיקת ${t.title}`}
                  className="grid size-8 place-items-center rounded-full text-muted active:bg-fill"
                  onClick={async () => {
                    const r = await deleteProjectTask(p.id, t.id);
                    if (!r.ok) toast.error(r.error);
                    router.refresh();
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <form onSubmit={addTask} className="flex items-center gap-2 px-3 py-2">
              <Input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="משימה חדשה…" aria-label="משימה חדשה" maxLength={200} className="bg-transparent" />
              <Button type="submit" size="icon-sm" disabled={!taskDraft.trim()} aria-label="הוספת משימה">
                <Plus />
              </Button>
            </form>
          </Panel>
        </section>

        {/* Timeline */}
        <section>
          <PanelHeading title={repair ? "יומן התקלה" : "יומן הפרויקט"} />
          <div className="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {(repair ? (["troubleshooting", "technician_visit", "quote", "note", "resolution"] as ProjectActivityKind[]) : (["note", "quote", "technician_visit"] as ProjectActivityKind[])).map((k) => (
              <button key={k} type="button" onClick={() => setEntry(k)} className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[14px] font-medium">
                <span aria-hidden>{ACTIVITY_ICON[k]}</span> {ACTIVITY_KIND[k]}
              </button>
            ))}
          </div>
          {activities.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-dashed border-border p-4 text-center text-[15px] text-muted">
              {repair ? "רשמו מה ניסיתם (למשל: ״הרעש נעלם כשהורדנו מהירות מאוורר״), ביקורי טכנאי והצעות מחיר." : "רשמו התקדמות, החלטות והצעות מחיר."}
            </p>
          ) : (
            <Panel>
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 px-4 py-3">
                  <span aria-hidden className="mt-0.5 text-[18px]">
                    {ACTIVITY_ICON[a.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="footnote text-muted">
                      {ACTIVITY_KIND[a.kind]} · {formatShortDate(a.occurred_on)}
                      {nameOf(a.created_by) ? ` · ${nameOf(a.created_by)}` : ""}
                      {a.amount != null ? ` · ${formatCurrency(Number(a.amount))}` : ""}
                      {a.provider_id ? ` · ${providers.find((x) => x.id === a.provider_id)?.name ?? ""}` : ""}
                    </p>
                    <p className="text-[15px] whitespace-pre-wrap">{a.body}</p>
                  </div>
                  {a.kind !== "status_change" && (
                    <button
                      type="button"
                      aria-label="מחיקת רשומה"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-fill"
                      onClick={async () => {
                        const r = await deleteProjectActivity(p.id, a.id);
                        if (!r.ok) toast.error(r.error);
                        router.refresh();
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </Panel>
          )}
        </section>

        {/* Linked purchases */}
        <section>
          <PanelHeading
            title="רכישות לפרויקט"
            count={purchases.length || undefined}
            action={
              <Link href={`/planner?new=1&project=${p.id}`} className="footnote font-semibold text-primary">
                + פריט
              </Link>
            }
          />
          {purchases.length ? (
            <Panel>
              {purchases.map((x) => (
                <PanelRow
                  key={x.id}
                  href={`/planner/${x.id}`}
                  leading={<PurchaseThumb p={x} />}
                  title={x.name}
                  subtitle={x.price != null ? formatCurrency(Number(x.price) * x.quantity, x.currency) : undefined}
                  trailing={<Badge tone={PURCHASE_STATUS[x.status].tone}>{PURCHASE_STATUS[x.status].label}</Badge>}
                />
              ))}
              {purchaseTotal > 0 && <InfoLine label="סה״כ מוצרים" value={formatCurrency(purchaseTotal)} />}
            </Panel>
          ) : (
            <p className="px-1 text-[15px] text-muted">מוצרים שצריך לקנות לפרויקט יופיעו כאן.</p>
          )}
        </section>

        <AttachmentsPanel householdId={householdId} entityType="project" entityId={p.id} module="projects" attachments={attachments} allowPdf title="תמונות, סרטונים וקבצים" />

        <Button variant="danger-ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> מחיקה
        </Button>
      </div>

      <ProjectSheet open={edit} onOpenChange={setEdit} project={p} rooms={rooms} members={members} providers={providers} appliances={appliances} />
      <ActivitySheet kind={entry} onClose={() => setEntry(null)} projectId={p.id} providers={providers} />
      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`למחוק את "${p.title}"?`}
        description="המשימות, היומן והתמונות יימחקו. רכישות מקושרות יישארו בתכנון."
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const r = await deleteProject(p.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/projects");
        }}
      />
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="footnote mb-0.5 text-muted">{label}</p>
      <p className="text-[15px] whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ActivitySheet({ kind, onClose, projectId, providers }: { kind: ProjectActivityKind | null; onClose: () => void; projectId: string; providers: ServiceProvider[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [date, setDate] = useState(todayInZone());
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("");
  const [saving, setSaving] = useState(false);
  const [k, setK] = useState<ProjectActivityKind>("note");
  const [seen, setSeen] = useState<ProjectActivityKind | null>(null);
  if (kind !== seen) {
    setSeen(kind);
    if (kind) {
      setK(kind);
      setBody("");
      setAmount("");
      setProvider("");
      setDate(todayInZone());
    }
  }
  const withMoney = k === "quote" || k === "technician_visit";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await addProjectActivity(projectId, { kind: k, body, occurred_on: date, amount, provider_id: provider });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    onClose();
    router.refresh();
  }

  const placeholder: Record<ProjectActivityKind, string> = {
    troubleshooting: "מה ניסיתם ומה קרה? למשל: הורדנו את מהירות המאוורר והרעש נעלם",
    technician_visit: "מה הטכנאי בדק ואמר",
    quote: "על מה ההצעה",
    note: "הערה",
    resolution: "מה פתר את הבעיה",
    status_change: "",
  };

  return (
    <Sheet
      open={!!kind}
      onOpenChange={(o) => !o && onClose()}
      title={ACTIVITY_KIND[k]}
      footer={
        <Button type="submit" form="activity-form" size="lg" className="w-full" loading={saving}>
          שמירה
        </Button>
      }
    >
      <form id="activity-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="סוג" htmlFor="act-kind">
          <Select id="act-kind" value={k} onChange={(e) => setK(e.target.value as ProjectActivityKind)}>
            {options(ACTIVITY_KIND)
              .filter((o) => o.value !== "status_change")
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="פרטים" htmlFor="act-body">
          <Textarea id="act-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder[k]} required maxLength={5000} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך" htmlFor="act-date">
            <Input id="act-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {withMoney && (
            <Field label="סכום (₪)" htmlFor="act-amount">
              <Input id="act-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
        </div>
        {withMoney && providers.length > 0 && (
          <Field label="בעל מקצוע" htmlFor="act-provider">
            <Select id="act-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">—</option>
              {providers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </form>
    </Sheet>
  );
}
