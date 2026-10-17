import type { ActivityEvent } from "@/lib/types";

/**
 * One line per audit event, written as a noun phrase ("הוספה לקניות: חלב") so
 * it reads naturally next to any member's name without guessing grammatical gender.
 */
export function describeActivity(e: ActivityEvent): string | null {
  const name = (e.summary.name as string | undefined) ?? (e.summary.title as string | undefined) ?? "";
  switch (`${e.entity_type}:${e.action}`) {
    case "shopping_item:created":
      return `הוספה לקניות: ${name}`;
    case "shopping_item:deleted":
      return `הסרה מהקניות: ${name}`;
    case "shopping_item:status_changed":
      return e.summary.to === "purchased" ? `נקנה: ${name}` : `חזר לרשימה: ${name}`;
    case "inventory_item:created":
      return `נוסף למלאי: ${name}`;
    case "inventory_item:archived":
      return `הועבר לארכיון: ${name}`;
    case "inventory_item:deleted":
      return `נמחק מהמלאי: ${name}`;
    case "household:created":
      return "יצירת משק הבית";
    case "membership:joined":
      return "הצטרפות לבית";
    case "invitation:created":
      return "יצירת הזמנה לבית";
    case "chore:completed":
      return `משימה הושלמה: ${name}`;
    case "chore:created":
      return `משימה חדשה: ${name}`;
    case "project:created":
      return `פרויקט חדש: ${name}`;
    case "project:status_changed":
      return `עדכון פרויקט: ${name}`;
    case "repair:created":
      return `דיווח על תקלה: ${name}`;
    case "repair:resolved":
      return `תקלה טופלה: ${name}`;
    case "recipe:created":
      return `מתכון חדש: ${name}`;
    case "planned_purchase:created":
      return `רעיון לקנייה לבית: ${name}`;
    case "planned_purchase:status_changed":
      return e.summary.to === "purchased" ? `נרכש לבית: ${name}` : `עדכון קנייה לבית: ${name}`;
    case "utility_bill:created":
      return `חשבון חדש: ${name}`;
    case "appliance:created":
      return `מכשיר נוסף: ${name}`;
    case "document:created":
      return `מסמך הועלה: ${name}`;
    case "event:created":
      return `אירוע ביומן: ${name}`;
    case "plant:watered":
      return `השקיה: ${name}`;
    case "receipt:confirmed":
      return `קבלה עודכנה במלאי${name ? `: ${name}` : ""}`;
    default:
      return null;
  }
}
