"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Keyboard, Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { lookupProduct, type ProductLookup } from "@/server/actions/ai-extract";
import { applyInventoryMovement, createInventoryItem } from "@/server/actions/inventory";
import { addShoppingItem } from "@/server/actions/grocery";
import { uploadHouseholdImage, validateImageFile } from "@/lib/media";
import type { InventoryLocation } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Live barcode scanning where the browser has BarcodeDetector (Android Chrome),
 * a photo-based fallback everywhere else (iPhone Safari has no BarcodeDetector),
 * and manual entry. The result is always shown for confirmation.
 */
export function BarcodeScanner({ householdId, locations, aiConfigured }: { householdId: string; locations: InventoryLocation[]; aiConfigured: boolean }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProductLookup | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("יח׳");
  const [qty, setQty] = useState("1");
  const [location, setLocation] = useState("");

  useEffect(() => setSupported(typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia), []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const code = codes[0]?.rawValue;
          if (code && /^[0-9]{6,14}$/.test(code)) {
            setScanning(false);
            if (navigator.vibrate) navigator.vibrate(20);
            void lookup({ barcode: code, image_path: null });
          }
        }, 350);
      } catch {
        toast.error("אין גישה למצלמה. אפשר לאשר הרשאה בהגדרות הדפדפן, או לצלם תמונה.");
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup is stable enough for the scan session
  }, [scanning]);

  async function lookup(input: { barcode: string | null; image_path: string | null }) {
    setBusy(true);
    const res = await lookupProduct(input);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setResult(res.data);
    setName(res.data.name ?? "");
    setBrand(res.data.brand ?? "");
    setUnit(res.data.unit || "יח׳");
  }

  async function photo(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setBusy(true);
    try {
      const path = await uploadHouseholdImage(householdId, "inventory", file);
      await lookup({ barcode: manual && /^[0-9]{6,14}$/.test(manual) ? manual : null, image_path: path });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  async function addToInventory() {
    if (!name.trim()) return void toast.error("יש להזין שם מוצר");
    setBusy(true);
    const q = Number(qty) > 0 ? Number(qty) : 1;
    const res = result?.inventory_item_id
      ? await applyInventoryMovement({ item_id: result.inventory_item_id, kind: "add", quantity: q, idempotency_key: `scan:${result.inventory_item_id}:${Date.now()}` })
      : await createInventoryItem({ name, brand, barcode: result?.barcode ?? "", unit, initial_quantity: q, location_id: location || null, category_id: null, min_threshold: null, restock_quantity: null, expires_on: null, image_path: null, notes: null });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${name} במלאי`);
    router.push(`/inventory/${res.data.id}`);
  }

  async function addToList() {
    if (!name.trim()) return void toast.error("יש להזין שם מוצר");
    setBusy(true);
    const res = await addShoppingItem({ name, brand, unit, quantity: Number(qty) > 0 ? Number(qty) : 1, save_to_catalog: true });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${name} ברשימת הקניות`);
    setResult(null);
  }

  return (
    <>
      <PageHeader title="סריקת מוצר" back={{ href: "/inventory", label: "מלאי" }} subtitle="ברקוד או צילום של המוצר" />
      <div className="space-y-5 pb-10">
        {!result && (
          <>
            {scanning ? (
              <div className="relative overflow-hidden rounded-[var(--radius)] bg-black">
                <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
                <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-2 border-white/80" />
                <Button variant="secondary" className="absolute inset-x-4 bottom-4" onClick={() => setScanning(false)}>
                  ביטול
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                {supported && (
                  <Button size="lg" onClick={() => setScanning(true)} disabled={busy}>
                    <ScanBarcode /> סריקת ברקוד
                  </Button>
                )}
                <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => photo(e.target.files?.[0])} />
                <Button size="lg" variant={supported ? "secondary" : "primary"} disabled={busy || !aiConfigured} onClick={() => photoRef.current?.click()}>
                  {busy ? <Loader2 className="animate-spin" /> : <Camera />} צילום המוצר
                </Button>
                {!aiConfigured && <p className="footnote text-muted">זיהוי מתמונה דורש חיבור ל-AI. אפשר להקליד ברקוד.</p>}
                {supported === false && <p className="footnote text-muted">בדפדפן הזה אין סריקת ברקוד חיה (למשל ב-iPhone). צלמו את המוצר או הקלידו את המספר.</p>}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (/^[0-9]{6,14}$/.test(manual)) void lookup({ barcode: manual, image_path: null });
                else toast.error("ברקוד הוא 6 עד 14 ספרות");
              }}
              className="flex gap-2"
            >
              <Input dir="ltr" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))} placeholder="7290000000000" aria-label="מספר ברקוד" />
              <Button type="submit" variant="secondary" disabled={busy}>
                <Keyboard /> חיפוש
              </Button>
            </form>
          </>
        )}

        {result && (
          <section className="space-y-4 rounded-[var(--radius)] border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              {result.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- public product image
                <img src={result.image_url} alt="" className="size-16 rounded-xl object-contain" referrerPolicy="no-referrer" />
              ) : (
                <span className="cat-tint grid size-16 place-items-center rounded-xl text-[30px]" style={{ "--h": 55 } as React.CSSProperties}>
                  📦
                </span>
              )}
              <div className="min-w-0">
                <p className="footnote text-muted">{result.barcode ? `ברקוד ${result.barcode}` : "ללא ברקוד"}</p>
                <p className="text-[14px] text-muted">{result.note}</p>
              </div>
            </div>
            <Field label="שם המוצר" htmlFor="sc-name">
              <Input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="מותג" htmlFor="sc-brand">
                <Input id="sc-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </Field>
              <Field label="כמות" htmlFor="sc-qty">
                <Input id="sc-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Field label="יחידה" htmlFor="sc-unit">
                <Input id="sc-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
            </div>
            {!result.inventory_item_id && (
              <Field label="מיקום" htmlFor="sc-loc">
                <Select id="sc-loc" value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="">ללא</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={addToInventory} loading={busy}>
                {result.inventory_item_id ? "הוספה לכמות במלאי" : "הוספה למלאי"}
              </Button>
              <Button variant="secondary" onClick={addToList} disabled={busy}>
                לרשימת הקניות
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setResult(null)}>
              סריקה נוספת
            </Button>
          </section>
        )}
      </div>
    </>
  );
}
