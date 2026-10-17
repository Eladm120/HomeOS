"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, Attachment, HomeProject, ProjectActivity, ProjectTask, ServiceProvider } from "@/lib/types";
import { flattenZodError } from "@/lib/validation";
import {
  attachmentSchema,
  projectActivitySchema,
  projectSchema,
  projectTaskSchema,
  serviceProviderSchema,
  type AttachmentInput,
  type ProjectActivityInput,
  type ProjectInput,
  type ServiceProviderInput,
} from "@/lib/schemas";
import { PROJECT_STATUS } from "@/lib/labels";
import { assertOwnPath, dbFail, fail, ok, withHousehold } from "@/server/action-utils";

const uuid = z.uuid();

function refresh(id?: string) {
  revalidatePath("/projects");
  revalidatePath("/");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function saveProject(id: string | null, input: ProjectInput): Promise<ActionResult<HomeProject>> {
  if (id && !uuid.safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const { appliance_id, ...v } = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, v.cover_path)) return fail("קובץ לא מורשה");
    const values = { ...v, ...(appliance_id ? { appliance_id } : {}) };
    const q = id
      ? supabase.from("home_projects").update(values).eq("id", id).eq("household_id", ctx.household.id)
      : supabase.from("home_projects").insert({ ...values, household_id: ctx.household.id });
    const { data, error } = await q.select("*").single();
    if (error) return dbFail("projects.save", error);
    refresh(data.id);
    return ok(data as HomeProject);
  });
}

/** Status change also writes a timeline entry, so the history explains itself. */
export async function setProjectStatus(id: string, status: HomeProject["status"], note?: string): Promise<ActionResult<HomeProject>> {
  const parsed = z
    .object({ id: uuid, status: projectSchema.shape.status, note: z.string().trim().max(2000).optional() })
    .safeParse({ id, status, note });
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("home_projects")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .eq("household_id", ctx.household.id)
      .select("*")
      .single();
    if (error) return dbFail("projects.status", error);
    await supabase.from("project_activities").insert({
      household_id: ctx.household.id,
      project_id: id,
      kind: "status_change",
      body: `${PROJECT_STATUS[parsed.data.status].label}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
    });
    refresh(id);
    return ok(data as HomeProject);
  });
}

export async function deleteProject(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("home_projects").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("projects.delete", error);
    await supabase.from("attachments").delete().eq("household_id", ctx.household.id).eq("entity_type", "project").eq("entity_id", id);
    refresh();
    return ok(null);
  });
}

// ---- Tasks -------------------------------------------------------------------------
export async function addProjectTask(projectId: string, input: z.input<typeof projectTaskSchema>): Promise<ActionResult<ProjectTask>> {
  if (!uuid.safeParse(projectId).success) return fail("מזהה לא תקין");
  const parsed = projectTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { count } = await supabase.from("project_tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({ ...parsed.data, project_id: projectId, household_id: ctx.household.id, sort_order: count ?? 0 })
      .select("*")
      .single();
    if (error) return dbFail("projects.task.add", error);
    refresh(projectId);
    return ok(data as ProjectTask);
  });
}

export async function setProjectTaskDone(projectId: string, taskId: string, done: boolean): Promise<ActionResult<null>> {
  if (!uuid.safeParse(taskId).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("project_tasks")
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq("id", taskId)
      .eq("household_id", ctx.household.id);
    if (error) return dbFail("projects.task.done", error);
    refresh(projectId);
    return ok(null);
  });
}

export async function deleteProjectTask(projectId: string, taskId: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(taskId).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId).eq("household_id", ctx.household.id);
    if (error) return dbFail("projects.task.delete", error);
    refresh(projectId);
    return ok(null);
  });
}

// ---- Timeline ----------------------------------------------------------------------
export async function addProjectActivity(projectId: string, input: ProjectActivityInput): Promise<ActionResult<ProjectActivity>> {
  if (!uuid.safeParse(projectId).success) return fail("מזהה לא תקין");
  const parsed = projectActivitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const { occurred_on, ...rest } = parsed.data;
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("project_activities")
      .insert({ ...rest, ...(occurred_on ? { occurred_on } : {}), project_id: projectId, household_id: ctx.household.id })
      .select("*")
      .single();
    if (error) return dbFail("projects.activity.add", error);
    refresh(projectId);
    return ok(data as ProjectActivity);
  });
}

export async function deleteProjectActivity(projectId: string, id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("project_activities").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("projects.activity.delete", error);
    refresh(projectId);
    return ok(null);
  });
}

// ---- Service providers -------------------------------------------------------------
export async function saveServiceProvider(id: string | null, input: ServiceProviderInput): Promise<ActionResult<ServiceProvider>> {
  if (id && !uuid.safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = serviceProviderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const q = id
      ? supabase.from("service_providers").update(parsed.data).eq("id", id).eq("household_id", ctx.household.id)
      : supabase.from("service_providers").insert({ ...parsed.data, household_id: ctx.household.id });
    const { data, error } = await q.select("*").single();
    if (error) return dbFail("providers.save", error);
    revalidatePath("/projects");
    return ok(data as ServiceProvider);
  });
}

// ---- Attachments (shared by projects, purchases, appliances, plants, bills) ----------
const ATTACHMENT_PATHS: Record<Attachment["entity_type"], string> = {
  project: "/projects",
  planned_purchase: "/planner",
  appliance: "/appliances",
  plant: "/plants",
  utility_bill: "/bills",
};

export async function addAttachment(input: AttachmentInput): Promise<ActionResult<Attachment>> {
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, parsed.data.path)) return fail("קובץ לא מורשה");
    const { data, error } = await supabase
      .from("attachments")
      .insert({ ...parsed.data, household_id: ctx.household.id })
      .select("*")
      .single();
    if (error) return dbFail("attachments.add", error);
    revalidatePath(`${ATTACHMENT_PATHS[parsed.data.entity_type]}/${parsed.data.entity_id}`);
    return ok(data as Attachment);
  });
}

export async function deleteAttachment(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("attachments")
      .delete()
      .eq("id", id)
      .eq("household_id", ctx.household.id)
      .select("path, entity_type, entity_id")
      .maybeSingle();
    if (error) return dbFail("attachments.delete", error);
    if (data) {
      const paths = data.path.endsWith(".webp") ? [data.path, data.path.replace(/\.webp$/, "_thumb.webp")] : [data.path];
      await supabase.storage.from("household-media").remove(paths);
      revalidatePath(`${ATTACHMENT_PATHS[data.entity_type as Attachment["entity_type"]]}/${data.entity_id}`);
    }
    return ok(null);
  });
}
