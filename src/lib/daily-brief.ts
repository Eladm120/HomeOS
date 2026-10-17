/**
 * Deterministic morning brief built only from confirmed household data.
 * (The AI-written brief arrives in Phase 3; this one never guesses.)
 */
export interface BriefInput {
  pendingGrocery: number;
  urgentGrocery: number;
  outOfStock: string[];
  lowStock: string[];
  expired: string[];
  expiringSoon: { name: string; days: number }[];
}

export interface BriefLine {
  kind: "fact" | "estimate";
  text: string;
}

function list(names: string[], max = 3): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const head = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} ו${shown[shown.length - 1]}` : shown[0] ?? "";
  return rest > 0 ? `${shown.join(", ")} ועוד ${rest}` : head;
}

export function buildDailyBrief(i: BriefInput): BriefLine[] {
  const lines: BriefLine[] = [];
  if (i.outOfStock.length) {
    lines.push({ kind: "fact", text: `לפי המלאי, נגמרו: ${list(i.outOfStock)}.` });
  }
  if (i.lowStock.length) {
    lines.push({ kind: "fact", text: `${list(i.lowStock)} ${i.lowStock.length === 1 ? "נמצא" : "נמצאים"} מתחת למינימום שהגדרתם.` });
  }
  if (i.expired.length) {
    lines.push({ kind: "fact", text: `פג התוקף של ${list(i.expired)} — כדאי לבדוק.` });
  }
  if (i.expiringSoon.length) {
    const soonest = [...i.expiringSoon].sort((a, b) => a.days - b.days);
    const first = soonest[0];
    const when = first.days === 0 ? "היום" : first.days === 1 ? "מחר" : `בעוד ${first.days} ימים`;
    lines.push({
      kind: "fact",
      text:
        soonest.length === 1
          ? `התוקף של ${first.name} מסתיים ${when}.`
          : `${soonest.length} מוצרים עם תוקף קרוב, הראשון — ${first.name} (${when}).`,
    });
  }
  if (i.pendingGrocery) {
    lines.push({
      kind: "fact",
      text:
        `ברשימת הקניות ${i.pendingGrocery === 1 ? "מוצר אחד" : `${i.pendingGrocery} מוצרים`}` +
        (i.urgentGrocery ? `, מתוכם ${i.urgentGrocery === 1 ? "אחד דחוף" : `${i.urgentGrocery} דחופים`}.` : "."),
    });
  }
  return lines;
}
