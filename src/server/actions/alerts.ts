"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { addDays, todayInZone } from "@/lib/format";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import { addInventoryItemToList } from "@/server/actions/grocery";
import { completeChore } from "@/server/actions/chores";
import { setBillPaid, waterPlant } from "@/server/actions/admin";
import { dismissSuggestion } from "@/server/actions/intelligence";

const actionSchema = z.object({
  type: z.enum(["add_to_list", "complete_chore", "bill_paid", "charge_paid", "water_plant", "dismiss_suggestion"]),
  id: z.uuid(),
});

/** Advance a date by a recurring charge's frequency (month math clamps to month end). */
function nextDue(iso: string, frequency: string): string {
  if (frequency === "weekly") return addDays(iso, 7);
  const months = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 }[frequency] ?? 1;
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** One button on an alert: do the obvious thing and say what happened. */
export async function resolveAlert(input: z.input<typeof actionSchema>): Promise<ActionResult<{ message: string }>> {
  const p = actionSchema.safeParse(input);
  if (!p.success) return fail("פעולה לא תקינה");
  const { type, id } = p.data;

  let res: ActionResult<unknown>;
  let message = "בוצע";
  switch (type) {
    case "add_to_list": {
      const r = await addInventoryItemToList(id);
      res = r;
      if (r.ok) message = r.data.created ? "נוסף לרשימת הקניות 🛒" : "כבר ברשימת הקניות";
      break;
    }
    case "complete_chore":
      res = await completeChore(id);
      message = "סומן כבוצע ✓";
      break;
    case "bill_paid":
      res = await setBillPaid(id, true);
      message = "החשבון סומן כשולם";
      break;
    case "water_plant":
      res = await waterPlant(id);
      message = "נרשמה השקיה 💧";
      break;
    case "dismiss_suggestion":
      res = await dismissSuggestion(id, "snooze");
      message = "נזכיר שוב בעוד כמה ימים";
      break;
    case "charge_paid":
      res = await withHousehold(async (ctx, supabase) => {
        const { data: c } = await supabase
          .from("recurring_charges")
          .select("id, title, category, amount, frequency, next_due_on")
          .eq("id", id)
          .eq("household_id", ctx.household.id)
          .maybeSingle();
        if (!c) return fail("החיוב לא נמצא");
        const today = todayInZone(new Date(), ctx.household.timezone);
        const { error: expErr } = await supabase.from("household_expenses").insert({
          household_id: ctx.household.id,
          title: c.title,
          category: c.category,
          amount: c.amount,
          spent_on: today,
          recurring_charge_id: c.id,
        });
        if (expErr) return dbFail("alerts.charge_expense", expErr);
        const next = nextDue(c.next_due_on ?? today, c.frequency);
        const { error } = await supabase.from("recurring_charges").update({ next_due_on: next }).eq("id", c.id).eq("household_id", ctx.household.id);
        if (error) return dbFail("alerts.charge_advance", error);
        message = `${c.title} שולם · נרשם בהוצאות`;
        return ok(null);
      });
      revalidatePath("/expenses");
      break;
  }
  if (!res.ok) return res;
  revalidatePath("/");
  revalidatePath("/notifications");
  return ok({ message });
}
