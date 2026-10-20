"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ClipboardPaste, Link2, Loader2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { draftFromText, importRecipeFromUrl, saveRecipe } from "@/server/actions/recipes";
import { extractRecipeWithAi } from "@/server/actions/ai-extract";
import { uploadHouseholdImage, validateImageFile } from "@/lib/media";
import type { Recipe, RecipeIngredient, RecipeSource, RecipeStep } from "@/lib/types";
import type { RecipeDraft } from "@/lib/recipe-parse";
import { parseIngredientLine } from "@/lib/ingredients";
import { RECIPE_SOURCE, options } from "@/lib/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";
import { PhotoPicker } from "@/components/media/photo-picker";

interface IngRow {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
  note: string;
}

let seq = 0;
const row = (i?: Partial<IngRow>): IngRow => ({ key: `r${++seq}`, name: "", quantity: "", unit: "", optional: false, note: "", ...i });

export function RecipeEditor({
  householdId,
  recipe,
  ingredients = [],
  steps = [],
  categories,
  aiEnabled = false,
  sharedUrl = null,
}: {
  aiEnabled?: boolean;
  /** A link shared into the app (share sheet, dashboard) — imported right away. */
  sharedUrl?: string | null;
  householdId: string;
  recipe: Recipe | null;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  categories: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [imagePath, setImagePath] = useState<string | null>(recipe?.image_path ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(recipe?.image_url ?? null);
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [platform, setPlatform] = useState<RecipeSource>(recipe?.source_platform ?? "manual");
  const [prep, setPrep] = useState(recipe?.prep_minutes != null ? String(recipe.prep_minutes) : "");
  const [cook, setCook] = useState(recipe?.cook_minutes != null ? String(recipe.cook_minutes) : "");
  const [servings, setServings] = useState(recipe?.servings != null ? String(recipe.servings) : "");
  const [category, setCategory] = useState(recipe?.category ?? "");
  const [tags, setTags] = useState((recipe?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [ings, setIngs] = useState<IngRow[]>(() =>
    ingredients.length
      ? ingredients.map((i) => row({ name: i.name, quantity: i.quantity != null ? String(i.quantity) : "", unit: i.unit ?? "", optional: i.optional, note: i.note ?? "" }))
      : [row()],
  );
  const [stepList, setStepList] = useState<string[]>(() => (steps.length ? steps.map((s) => s.body) : [""]));
  const [importUrl, setImportUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  async function runAi(input: { text: string | null; image_path: string | null }) {
    setAiBusy(true);
    const res = await extractRecipeWithAi({ ...input, source_url: sourceUrl || null });
    setAiBusy(false);
    if (!res.ok) return void toast.error(res.error);
    applyDraft({ ...res.data, title: res.data.title || title });
    if (input.image_path && !imagePath) setImagePath(input.image_path);
    setShowPaste(false);
    toast.success("זוהה. בדקו לפני השמירה.");
  }

  async function aiPhoto(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setAiBusy(true);
    try {
      const path = await uploadHouseholdImage(householdId, "recipes", file);
      await runAi({ text: null, image_path: path });
    } catch (e) {
      setAiBusy(false);
      toast.error((e as Error).message);
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  function applyDraft(d: RecipeDraft) {
    if (d.title && (!title || title === "מתכון")) setTitle(d.title);
    if (d.description && !description) setDescription(d.description);
    if (d.image_url) setImageUrl(d.image_url);
    setSourceUrl(d.source_url.startsWith("https://homeos.local") ? sourceUrl : d.source_url);
    if (!d.source_url.startsWith("https://homeos.local")) setPlatform(d.source_platform);
    if (d.prep_minutes) setPrep(String(d.prep_minutes));
    if (d.cook_minutes) setCook(String(d.cook_minutes));
    if (d.servings) setServings(String(d.servings));
    if (d.ingredients.length) {
      setIngs(d.ingredients.map((i) => row({ name: i.name, quantity: i.quantity != null ? String(i.quantity) : "", unit: i.unit ?? "" })));
    }
    if (d.steps.length) setStepList(d.steps);
    setNotice(d.notice);
  }

  async function runImport(link = importUrl) {
    if (!link.trim()) return;
    setImporting(true);
    const res = await importRecipeFromUrl(link.trim());
    setImporting(false);
    if (!res.ok) return void toast.error(res.error);
    applyDraft(res.data);
    if (res.data.completeness === "full") toast.success("המתכון יובא. בדקו ושמרו.");
    else if (res.data.ingredients.length) toast.success("חלק מהפרטים יובאו");
  }

  // Shared from Instagram/TikTok (or the dashboard): import without another tap.
  const sharedDone = useRef(false);
  useEffect(() => {
    if (!sharedUrl || recipe || sharedDone.current) return;
    sharedDone.current = true;
    setImportUrl(sharedUrl);
    void runImport(sharedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the shared link
  }, [sharedUrl, recipe]);

  /** One tap after "Copy link" in Instagram: read the link from the clipboard and import it. */
  async function pasteAndImport() {
    try {
      const text = await navigator.clipboard.readText();
      const link = text.match(/https?:\/\/\S+/)?.[0];
      if (!link) return void toast.error("בלוח אין קישור. העתיקו את הקישור לפוסט ונסו שוב.");
      setImportUrl(link);
      await runImport(link);
    } catch {
      toast.error("אין גישה ללוח. הדביקו את הקישור בשדה.");
    }
  }

  async function runPaste() {
    if (!pasted.trim()) return;
    const res = await draftFromText(pasted, sourceUrl || null);
    if (!res.ok) return void toast.error(res.error);
    if (!res.data.ingredients.length) {
      // No quantified lines: treat every line as an ingredient name.
      const lines = pasted.split(/\r?\n/).map((l) => parseIngredientLine(l)).filter((x): x is NonNullable<typeof x> => !!x);
      setIngs(lines.map((i) => row({ name: i.name, quantity: i.quantity != null ? String(i.quantity) : "", unit: i.unit ?? "" })));
    } else applyDraft({ ...res.data, title: title || res.data.title });
    setShowPaste(false);
    setPasted("");
  }

  const setIng = (key: string, patch: Partial<IngRow>) => setIngs((l) => l.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    setSaving(true);
    const res = await saveRecipe(recipe?.id ?? null, {
      title,
      description,
      image_path: imagePath,
      image_url: imagePath ? null : imageUrl,
      source_url: sourceUrl,
      source_platform: sourceUrl ? (platform === "manual" ? "website" : platform) : platform === "photo" ? "photo" : "manual",
      prep_minutes: prep,
      cook_minutes: cook,
      servings,
      category,
      tags: tags
        .split(/[,،]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
      notes,
      is_favorite: recipe?.is_favorite ?? false,
      rating: recipe?.rating ?? null,
      ingredients: ings
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, optional: i.optional, note: i.note, inventory_item_id: null })),
      steps: stepList.map((s) => s.trim()).filter(Boolean),
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    toast.success("המתכון נשמר");
    router.push(`/recipes/${res.data.id}`);
  }

  return (
    <>
      <PageHeader title={recipe ? "עריכת מתכון" : "מתכון חדש"} back={{ href: recipe ? `/recipes/${recipe.id}` : "/recipes", label: recipe ? recipe.title : "מתכונים" }} />

      <div className="space-y-6 pb-24">
        {!recipe && (
          <section className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
            <h2 className="headline flex items-center gap-2">
              <Link2 className="size-5 text-primary" /> ייבוא מקישור
            </h2>
            <p className="footnote text-muted">אתר מתכונים, Instagram, TikTok או YouTube. מעתיקים את הקישור לפוסט ולוחצים ״הדבקה״ — נקרא את התיאור ונמלא מצרכים והוראות לבדיקה. שום דבר לא נשמר בלי אישור.</p>
            <div className="flex gap-2">
              <Input dir="ltr" inputMode="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://" aria-label="קישור למתכון" />
              {importUrl.trim() ? (
                <Button onClick={() => runImport()} loading={importing}>
                  ייבוא
                </Button>
              ) : (
                <Button onClick={pasteAndImport} loading={importing}>
                  <ClipboardPaste /> הדבקה
                </Button>
              )}
            </div>
            <button type="button" onClick={() => setShowPaste((v) => !v)} className="flex items-center gap-1.5 text-[15px] font-medium text-primary">
              <ClipboardPaste className="size-4" /> הדבקת טקסט (למשל תיאור של פוסט)
            </button>
            {showPaste && (
              <div className="space-y-2">
                <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"• 2 כוסות קמח\n• 3 ביצים\n…"} aria-label="טקסט המתכון" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="soft" onClick={runPaste}>
                    זיהוי מצרכים
                  </Button>
                  {aiEnabled && (
                    <Button size="sm" onClick={() => runAi({ text: pasted, image_path: null })} disabled={!pasted.trim() || aiBusy}>
                      {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} זיהוי חכם (AI)
                    </Button>
                  )}
                </div>
              </div>
            )}
            {aiEnabled && (
              <>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => aiPhoto(e.target.files?.[0])} />
                <button type="button" disabled={aiBusy} onClick={() => photoRef.current?.click()} className="flex items-center gap-1.5 text-[15px] font-medium text-primary disabled:opacity-50">
                  {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} צילום מתכון או צילום מסך (AI)
                </button>
              </>
            )}
            {notice && <p className="rounded-xl bg-amber-soft px-3 py-2 text-[14px] text-amber">{notice}</p>}
          </section>
        )}

        <section className="space-y-4">
          {imageUrl && !imagePath ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote preview from the recipe source */}
              <img src={imageUrl} alt="" className="size-24 rounded-2xl object-cover" referrerPolicy="no-referrer" />
              <Button variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                הסרת התמונה
              </Button>
            </div>
          ) : (
            <PhotoPicker householdId={householdId} module="recipes" value={imagePath} onChange={setImagePath} />
          )}
          <Field label="שם המתכון" htmlFor="rc-title" error={errors.title}>
            <Input id="rc-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </Field>
          <Field label="תיאור קצר" htmlFor="rc-desc">
            <Textarea id="rc-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="הכנה (דק׳)" htmlFor="rc-prep">
              <Input id="rc-prep" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />
            </Field>
            <Field label="בישול (דק׳)" htmlFor="rc-cook">
              <Input id="rc-cook" inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} />
            </Field>
            <Field label="מנות" htmlFor="rc-serv">
              <Input id="rc-serv" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="קטגוריה" htmlFor="rc-cat">
              <Input id="rc-cat" list="rc-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ארוחת ערב" maxLength={60} />
              <datalist id="rc-cats">
                {[...new Set([...categories, "ארוחת בוקר", "ארוחת ערב", "תוספות", "סלטים", "קינוחים", "מאפים", "מרקים"])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="תגיות" htmlFor="rc-tags" hint="מופרדות בפסיק">
              <Input id="rc-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="מהיר, צמחוני" />
            </Field>
          </div>
        </section>

        <section>
          <PanelHeading title="מצרכים" count={ings.filter((i) => i.name.trim()).length} />
          <Panel>
            {ings.map((i) => (
              <div key={i.key} className="flex items-center gap-2 px-3 py-2">
                <Input value={i.quantity} onChange={(e) => setIng(i.key, { quantity: e.target.value })} inputMode="decimal" placeholder="כמות" aria-label="כמות" className="w-16 px-2 text-center" />
                <Input value={i.unit} onChange={(e) => setIng(i.key, { unit: e.target.value })} list="rc-units" placeholder="יחידה" aria-label="יחידה" className="w-20 px-2" />
                <Input value={i.name} onChange={(e) => setIng(i.key, { name: e.target.value })} placeholder="מצרך" aria-label="שם המצרך" className="min-w-0 flex-1" />
                <label className="flex shrink-0 items-center gap-1 text-[12px] text-muted" title="לא חובה">
                  <input type="checkbox" checked={i.optional} onChange={(e) => setIng(i.key, { optional: e.target.checked })} className="accent-[var(--primary)]" />
                  רשות
                </label>
                <button type="button" aria-label="הסרת מצרך" onClick={() => setIngs((l) => (l.length > 1 ? l.filter((r) => r.key !== i.key) : [row()]))} className="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-fill">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setIngs((l) => [...l, row()])} className="flex w-full items-center gap-2 px-4 py-3 text-[15px] font-medium text-primary">
              <Plus className="size-4" /> מצרך
            </button>
          </Panel>
          <datalist id="rc-units">
            {["גרם", "ק״ג", "מ״ל", "ליטר", "כוס", "כף", "כפית", "יח׳", "קופסה", "חבילה", "שן", "קורט"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </section>

        <section>
          <PanelHeading title="אופן ההכנה" count={stepList.filter((s) => s.trim()).length} />
          <Panel>
            {stepList.map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 px-3 py-2">
                <span className="num mt-2.5 w-6 shrink-0 text-center font-bold text-primary">{idx + 1}</span>
                <Textarea value={s} onChange={(e) => setStepList((l) => l.map((x, j) => (j === idx ? e.target.value : x)))} aria-label={`שלב ${idx + 1}`} className="min-h-14 flex-1" />
                <button type="button" aria-label="הסרת שלב" onClick={() => setStepList((l) => (l.length > 1 ? l.filter((_, j) => j !== idx) : [""]))} className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-fill">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setStepList((l) => [...l, ""])} className="flex w-full items-center gap-2 px-4 py-3 text-[15px] font-medium text-primary">
              <Plus className="size-4" /> שלב
            </button>
          </Panel>
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="קישור למקור" htmlFor="rc-src" error={errors.source_url}>
              <Input id="rc-src" dir="ltr" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
            </Field>
            <Field label="מקור" htmlFor="rc-platform">
              <Select id="rc-platform" value={platform} onChange={(e) => setPlatform(e.target.value as RecipeSource)}>
                {options(RECIPE_SOURCE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="הערות שלנו" htmlFor="rc-notes">
            <Textarea id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="פחות סוכר, להכפיל רוטב…" />
          </Field>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(max(0.35rem,env(safe-area-inset-bottom))+74px)] z-30 px-3 lg:start-72 lg:bottom-6">
        <div className="mx-auto max-w-md lg:max-w-xl">
          <Button size="lg" className="w-full shadow-lift" onClick={save} loading={saving} disabled={!title.trim()}>
            שמירת המתכון
          </Button>
        </div>
      </div>
    </>
  );
}
