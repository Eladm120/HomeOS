"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveProject, saveServiceProvider } from "@/server/actions/projects";
import type { HomeProject, ProjectKind, Room, ServiceProvider } from "@/lib/types";
import { PRIORITY_LABEL, PROJECT_STATUS, options } from "@/lib/labels";
import { todayInZone } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";

type Form = Record<
  | "title" | "description" | "room_id" | "priority" | "status" | "owner_id" | "due_on" | "estimated_cost" | "actual_cost"
  | "provider_id" | "symptoms" | "first_reported_on" | "warranty_notes" | "resolution" | "notes" | "appliance_id",
  string
> & { kind: ProjectKind };

function toForm(p: HomeProject | null, kind: ProjectKind, defaults?: Partial<Form>): Form {
  return {
    kind: p?.kind ?? kind,
    title: p?.title ?? "",
    description: p?.description ?? "",
    room_id: p?.room_id ?? "",
    priority: p?.priority ?? "normal",
    status: p?.status ?? (kind === "repair" ? "planned" : "idea"),
    owner_id: p?.owner_id ?? "",
    due_on: p?.due_on ?? "",
    estimated_cost: p?.estimated_cost != null ? String(p.estimated_cost) : "",
    actual_cost: p?.actual_cost != null ? String(p.actual_cost) : "",
    provider_id: p?.provider_id ?? "",
    symptoms: p?.symptoms ?? "",
    first_reported_on: p?.first_reported_on ?? (kind === "repair" ? todayInZone() : ""),
    warranty_notes: p?.warranty_notes ?? "",
    resolution: p?.resolution ?? "",
    notes: p?.notes ?? "",
    appliance_id: p?.appliance_id ?? "",
    ...defaults,
  };
}

export function ProjectSheet({
  open,
  onOpenChange,
  project,
  initialKind = "project",
  rooms,
  members,
  providers,
  appliances = [],
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: HomeProject | null;
  initialKind?: ProjectKind;
  rooms: Room[];
  members: { id: string; name: string }[];
  providers: ServiceProvider[];
  appliances?: { id: string; name: string }[];
  defaults?: Partial<Form>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(project, initialKind, defaults));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [providerList, setProviderList] = useState(providers);
  const [newProvider, setNewProvider] = useState<{ name: string; phone: string; trade: string } | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(project, initialKind, defaults));
      setErrors({});
      setProviderList(providers);
      setNewProvider(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [open, project, initialKind]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const repair = form.kind === "repair";

  async function addProvider() {
    if (!newProvider?.name.trim()) return;
    const res = await saveServiceProvider(null, { ...newProvider, email: null });
    if (!res.ok) return void toast.error(res.error);
    setProviderList((l) => [...l, res.data]);
    set("provider_id", res.data.id);
    setNewProvider(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveProject(project?.id ?? null, {
      ...form,
      priority: form.priority as HomeProject["priority"],
      status: form.status as HomeProject["status"],
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    onOpenChange(false);
    if (!project) router.push(`/projects/${res.data.id}`);
    else router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={project ? "עריכה" : repair ? "דיווח על תקלה" : "פרויקט חדש"}
      footer={
        <Button type="submit" form="project-form" size="lg" className="w-full" loading={saving}>
          שמירה
        </Button>
      }
    >
      <form id="project-form" onSubmit={submit} className="flex flex-col gap-4">
        {!project && (
          <Segmented
            label="סוג"
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v, status: v === "repair" ? "planned" : "idea", first_reported_on: v === "repair" ? f.first_reported_on || todayInZone() : f.first_reported_on }))}
            options={[
              { value: "project", label: "פרויקט / שדרוג" },
              { value: "repair", label: "תיקון / תקלה" },
            ]}
          />
        )}
        <Field label={repair ? "מה התקלקל?" : "שם הפרויקט"} htmlFor="pj-title" error={errors.title}>
          <Input
            id="pj-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={repair ? "המזגן בסלון מרעיש" : "פינת קריאה בחדר העבודה"}
            required
            maxLength={160}
          />
        </Field>
        {repair ? (
          <Field label="תסמינים — מה קורה בדיוק?" htmlFor="pj-symptoms">
            <Textarea id="pj-symptoms" value={form.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="רעש טרטור חזק כשהמאוורר על מהירות גבוהה" />
          </Field>
        ) : (
          <Field label="תיאור" htmlFor="pj-desc">
            <Textarea id="pj-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="חדר" htmlFor="pj-room">
            <Select id="pj-room" value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
              <option value="">ללא</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="סטטוס" htmlFor="pj-status">
            <Select id="pj-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {options(PROJECT_STATUS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="אחראי/ת" htmlFor="pj-owner">
            <Select id="pj-owner" value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">לא נקבע</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="עדיפות" htmlFor="pj-prio">
            <Select id="pj-prio" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {options(PRIORITY_LABEL).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={repair ? "דווח לראשונה" : "תאריך יעד"} htmlFor="pj-date">
            <Input
              id="pj-date"
              type="date"
              value={repair ? form.first_reported_on : form.due_on}
              onChange={(e) => set(repair ? "first_reported_on" : "due_on", e.target.value)}
            />
          </Field>
          {repair && (
            <Field label="תאריך יעד" htmlFor="pj-due">
              <Input id="pj-due" type="date" value={form.due_on} onChange={(e) => set("due_on", e.target.value)} />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="עלות משוערת (₪)" htmlFor="pj-est" error={errors.estimated_cost}>
            <Input id="pj-est" inputMode="decimal" value={form.estimated_cost} onChange={(e) => set("estimated_cost", e.target.value)} />
          </Field>
          <Field label="עלות בפועל (₪)" htmlFor="pj-act" error={errors.actual_cost}>
            <Input id="pj-act" inputMode="decimal" value={form.actual_cost} onChange={(e) => set("actual_cost", e.target.value)} />
          </Field>
        </div>
        {appliances.length > 0 && (
          <Field label="מכשיר קשור" htmlFor="pj-appliance">
            <Select id="pj-appliance" value={form.appliance_id} onChange={(e) => set("appliance_id", e.target.value)}>
              <option value="">ללא</option>
              {appliances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="בעל מקצוע / ספק" htmlFor="pj-provider">
          {newProvider ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
              <Input value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} placeholder="שם" aria-label="שם בעל המקצוע" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={newProvider.trade} onChange={(e) => setNewProvider({ ...newProvider, trade: e.target.value })} placeholder="תחום (טכנאי מזגנים)" aria-label="תחום" />
                <Input dir="ltr" inputMode="tel" value={newProvider.phone} onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })} placeholder="טלפון" aria-label="טלפון" />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={addProvider}>
                  הוספה
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewProvider(null)}>
                  ביטול
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select id="pj-provider" value={form.provider_id} onChange={(e) => set("provider_id", e.target.value)}>
                <option value="">ללא</option>
                {providerList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.trade ? ` · ${p.trade}` : ""}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => setNewProvider({ name: "", phone: "", trade: "" })}>
                חדש
              </Button>
            </div>
          )}
        </Field>
        {repair && (
          <>
            <Field label="אחריות (אם יש)" htmlFor="pj-warranty">
              <Input id="pj-warranty" value={form.warranty_notes} onChange={(e) => set("warranty_notes", e.target.value)} placeholder="באחריות עד 03/2027 אצל…" />
            </Field>
            {project && (
              <Field label="איך זה נפתר?" htmlFor="pj-resolution">
                <Textarea id="pj-resolution" value={form.resolution} onChange={(e) => set("resolution", e.target.value)} />
              </Field>
            )}
          </>
        )}
        <Field label="הערות" htmlFor="pj-notes">
          <Textarea id="pj-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Sheet>
  );
}
