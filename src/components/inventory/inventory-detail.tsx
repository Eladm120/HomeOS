"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeftRight,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  History,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { applyInventoryMovement, archiveInventoryItem, deleteInventoryItem } from "@/server/actions/inventory";
import { addInventoryItemToList } from "@/server/actions/grocery";
import type { InventoryItem, InventoryLocation, InventoryMovement, InventoryMovementKind, ProductCategory } from "@/lib/types";
import { MOVEMENT_LABELS, daysSinceVerified, estimateDepletion, expiryState, stockLevel } from "@/lib/inventory-logic";
import { formatQuantity, formatShortDate, relativeDays } from "@/lib/format";
import { RelativeTime } from "@/components/ui/relative-time";
import { primeSignedUrls } from "@/lib/media";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { ImageViewer, SignedImage } from "@/components/media/signed-image";
import { InventoryItemSheet } from "./inventory-item-sheet";

type MoveKind = Exclude<InventoryMovementKind, "initial" | "purchase">;

const MOVE_COPY: Record<MoveKind, { title: string; qtyLabel: string; cta: string }> = {
  consume: { title: "השתמשנו", qtyLabel: "כמה השתמשתם?", cta: "עדכון" },
  add: { title: "הוספה למלאי", qtyLabel: "כמה נוסף?", cta: "הוספה" },
  correct: { title: "ספירה מחדש", qtyLabel: "כמה יש עכשיו בפועל?", cta: "אישור ספירה" },
  discard: { title: "זריקה / פג תוקף", qtyLabel: "כמה נזרק?", cta: "עדכון" },
  transfer: { title: "העברת מיקום", qtyLabel: "", cta: "העברה" },
};

export function InventoryDetail({
  householdId,
  item,
  movements,
  locations,
  categories,
  signedUrls,
  memberNames,
  onShoppingList,
}: {
  householdId: string;
  item: InventoryItem;
  movements: InventoryMovement[];
  locations: InventoryLocation[];
  categories: ProductCategory[];
  signedUrls: Record<string, string>;
  memberNames: Record<string, string>;
  onShoppingList: boolean;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  useRealtimeRefresh("inventory_items", householdId);
  const router = useRouter();

  const [move, setMove] = useState<MoveKind | null>(null);
  const [qty, setQty] = useState("1");
  const [toLocation, setToLocation] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewer, setViewer] = useState(false);

  const level = stockLevel(item);
  const exp = expiryState(item.expires_on);
  const verifiedDays = daysSinceVerified(item);
  const estimate = useMemo(() => estimateDepletion(movements, Number(item.quantity)), [movements, item.quantity]);
  const location = locations.find((l) => l.id === item.location_id)?.name;
  const category = categories.find((c) => c.id === item.category_id)?.name;
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";

  function openMove(kind: MoveKind) {
    setMove(kind);
    setQty(kind === "correct" ? String(Number(item.quantity)) : "1");
    setToLocation("");
    setNote("");
  }

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    if (!move) return;
    setSaving(true);
    const res = await applyInventoryMovement({
      item_id: item.id,
      kind: move,
      quantity: move === "transfer" ? 0 : qty,
      to_location_id: move === "transfer" ? toLocation : null,
      note,
      idempotency_key: crypto.randomUUID(),
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("המלאי עודכן");
    setMove(null);
    router.refresh();
  }

  async function verifyNow() {
    const res = await applyInventoryMovement({ item_id: item.id, kind: "correct", quantity: Number(item.quantity), note: "אומת", idempotency_key: crypto.randomUUID() });
    if (!res.ok) return void toast.error(res.error);
    toast.success("הכמות אומתה");
    router.refresh();
  }

  async function addToList() {
    const res = await addInventoryItemToList(item.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.data.created ? "נוסף לרשימת הקניות" : "כבר נמצא ברשימת הקניות");
    router.refresh();
  }

  async function archive() {
    const res = await archiveInventoryItem(item.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success("המוצר הועבר לארכיון");
    router.replace("/inventory");
  }

  async function remove() {
    const res = await deleteInventoryItem(item.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success("המוצר נמחק");
    router.replace("/inventory");
  }

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={[item.brand, category].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/inventory", label: "מלאי" }}
        actions={
          <Button size="icon" variant="outline" onClick={() => setEditOpen(true)} aria-label="עריכה">
            <Pencil />
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {item.image_path && (
              <button type="button" className="block w-full" onClick={() => setViewer(true)} aria-label="הגדלת תמונה">
                <SignedImage path={item.image_path} alt={item.name} thumb={false} className="aspect-[4/3] w-full" />
              </button>
            )}
            <div className="p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">{item.stock_confidence === "confirmed" ? "כמות במלאי" : "כמות משוערת"}</div>
                  <div className="num mt-0.5 text-4xl font-semibold tracking-tight">
                    {item.stock_confidence === "estimated" && <span className="text-2xl text-muted">~</span>}
                    {formatQuantity(item.quantity)}
                    <span className="ms-1.5 text-base font-normal text-muted">{item.unit}</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {level === "out" && <Badge tone="danger">נגמר</Badge>}
                  {level === "low" && <Badge tone="amber">מתחת למינימום</Badge>}
                  {level === "ok" && item.min_threshold != null && <Badge tone="sage">במלאי</Badge>}
                  {location && <Badge>{location}</Badge>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                <ActionTile icon={<Minus />} label="השתמשנו" onClick={() => openMove("consume")} />
                <ActionTile icon={<Plus />} label="הוספה" onClick={() => openMove("add")} />
                <ActionTile icon={<ClipboardCheck />} label="ספירה" onClick={() => openMove("correct")} />
                <ActionTile icon={<ArrowLeftRight />} label="העברה" onClick={() => openMove("transfer")} />
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
                <CheckCheck className={cn("size-4", verifiedDays !== null && verifiedDays <= 14 ? "text-sage" : "text-muted")} />
                <span className="flex-1 text-muted">
                  {item.last_verified_at ? <RelativeTime value={item.last_verified_at} prefix="נספר לאחרונה " /> : "הכמות לא נספרה עדיין"}
                </span>
                <button type="button" onClick={verifyNow} className="font-medium text-primary">
                  הכמות נכונה
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="מינימום" value={item.min_threshold != null ? `${formatQuantity(item.min_threshold)} ${item.unit}` : "לא הוגדר"} />
              <Info label="כמות לקנייה" value={item.restock_quantity != null ? `${formatQuantity(item.restock_quantity)} ${item.unit}` : "—"} />
              <Info
                label="תוקף"
                value={
                  item.expires_on ? (
                    <span className={cn(exp?.state === "expired" && "text-danger", exp?.state === "soon" && "text-amber")}>
                      {formatShortDate(item.expires_on)} · {relativeDays(exp!.days)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Info label="נקנה לאחרונה" value={item.last_purchased_at ? <RelativeTime value={item.last_purchased_at} /> : "—"} />
              {item.barcode && <Info label="ברקוד" value={<span className="num">{item.barcode}</span>} />}
            </dl>
            {item.notes && <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm whitespace-pre-wrap">{item.notes}</p>}
          </Card>

          <Button variant={level === "ok" ? "secondary" : "primary"} className="w-full" onClick={addToList} disabled={onShoppingList}>
            <ShoppingCart /> {onShoppingList ? "כבר ברשימת הקניות" : "הוספה לרשימת הקניות"}
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="תחזית צריכה" icon={<TrendingDown />} subtitle="הערכה בלבד, מבוססת על עדכוני שימוש" />
            <div className="px-5 pb-5 text-sm">
              {estimate ? (
                <div className="space-y-1">
                  <p>
                    לפי השימוש האחרון, {item.name} {estimate.daysLeft === 0 ? "כנראה כבר נגמר" : `צפוי להיגמר בעוד כ-${estimate.daysLeft} ימים`}.
                  </p>
                  <p className="text-xs text-muted">
                    קצב משוער: <span className="num">{formatQuantity(+estimate.dailyRate.toFixed(2))}</span> {item.unit} ליום · מבוסס על {estimate.basedOnEvents} עדכונים · רמת ביטחון{" "}
                    {estimate.confidence === "high" ? "גבוהה" : estimate.confidence === "medium" ? "בינונית" : "נמוכה"}
                  </p>
                </div>
              ) : (
                <p className="text-muted">אין עדיין מספיק נתוני שימוש לתחזית. עדכנו כשאתם משתמשים במוצר, ו-HomeOS ילמד את הקצב שלכם.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="היסטוריית תנועות" icon={<History />} subtitle={`${movements.length} תנועות`} />
            <ul className="divide-y divide-border/60 px-5 pb-3">
              {movements.length === 0 && <li className="py-4 text-sm text-muted">אין תנועות עדיין</li>}
              {movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3 text-sm">
                  <span
                    className={cn(
                      "num w-14 shrink-0 text-center font-semibold",
                      Number(m.quantity_delta) > 0 ? "text-sage" : Number(m.quantity_delta) < 0 ? "text-danger" : "text-muted",
                    )}
                  >
                    {Number(m.quantity_delta) > 0 ? "+" : ""}
                    {formatQuantity(m.quantity_delta)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {MOVEMENT_LABELS[m.kind]}
                      {m.kind === "transfer" && <span className="font-normal text-muted"> · {locName(m.from_location_id)} ← {locName(m.to_location_id)}</span>}
                    </div>
                    <div className="truncate text-xs text-muted">
                      <RelativeTime value={m.created_at} />
                      {[memberNames[m.created_by ?? ""], m.source === "grocery" ? "מרשימת הקניות" : null, m.note].filter(Boolean).map((s) => ` · ${s}`).join("")}
                    </div>
                  </div>
                  <span className="num text-xs text-muted">= {formatQuantity(m.quantity_after)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => openMove("discard")}>
              <CalendarClock /> זריקה / פג תוקף
            </Button>
            <Button variant="outline" className="flex-1" onClick={archive}>
              <Archive /> ארכיון
            </Button>
            <Button variant="danger-ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="מחיקה לצמיתות">
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={!!move}
        onOpenChange={(o) => !o && setMove(null)}
        title={move ? MOVE_COPY[move].title : ""}
        description={item.name}
        footer={
          <Button type="submit" form="move-form" size="lg" className="w-full" loading={saving}>
            {move ? MOVE_COPY[move].cta : ""}
          </Button>
        }
      >
        <form id="move-form" onSubmit={submitMove} className="space-y-4">
          {move === "transfer" ? (
            <Field label="לאן?">
              <Select value={toLocation} onChange={(e) => setToLocation(e.target.value)} required>
                <option value="">בחירת מיקום</option>
                {locations
                  .filter((l) => l.id !== item.location_id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label={move ? MOVE_COPY[move].qtyLabel : ""}>
              <div className="flex items-center gap-2">
                <Input inputMode="decimal" className="num text-center text-xl" value={qty} onChange={(e) => setQty(e.target.value.replace(",", "."))} autoFocus />
                <span className="text-muted">{item.unit}</span>
              </div>
            </Field>
          )}
          {move === "correct" && <p className="text-xs text-muted">ספירה מחדש מסמנת את הכמות כ״מאומתת״ ומתקנת סטיות.</p>}
          <Field label="הערה (לא חובה)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        </form>
      </Sheet>

      <InventoryItemSheet open={editOpen} onOpenChange={setEditOpen} householdId={householdId} item={item} categories={categories} locations={locations} />
      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="למחוק את המוצר לצמיתות?"
        description="כל היסטוריית התנועות של המוצר תימחק. כדי לשמור היסטוריה, העבירו לארכיון במקום."
        confirmLabel="מחיקה"
        destructive
        onConfirm={remove}
      />
      {item.image_path && <ImageViewer path={item.image_path} alt={item.name} open={viewer} onOpenChange={setViewer} />}
    </>
  );
}

function ActionTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2 py-3 text-xs font-medium transition hover:bg-surface-3 active:scale-95 [&_svg]:size-5"
    >
      {icon}
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
