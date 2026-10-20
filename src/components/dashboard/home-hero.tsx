"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpLeft, ImagePlus, ListChecks, Loader2, ShoppingCart, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadHouseholdImage, validateImageFile } from "@/lib/media";
import { setHouseholdCover } from "@/server/actions/household";
import { SignedImage } from "@/components/media/signed-image";
import { HouseScene, type DayPeriod } from "./house-scene";

export interface HeroStat {
  key: string;
  icon: LucideIcon;
  value: number | string;
  label: string;
  href: string;
}

/**
 * The home itself, as a picture: a cozy illustrated cottage that follows the
 * time of day (or the household's own photo, if the owner uploads one), with
 * the day's numbers on glass.
 */
export function HomeHero({
  householdId,
  householdName,
  coverPath,
  canEdit,
  stats,
  period,
  preview,
}: {
  householdId: string;
  householdName: string;
  coverPath: string | null;
  canEdit: boolean;
  stats: HeroStat[];
  period: DayPeriod;
  preview?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file || preview) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setBusy(true);
    try {
      const path = await uploadHouseholdImage(householdId, "household", file);
      const res = await setHouseholdCover({ path });
      if (!res.ok) return void toast.error(res.error);
      toast.success("התמונה של הבית עודכנה");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "העלאת התמונה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={householdName} className="relative isolate h-[250px] overflow-hidden rounded-[1.75rem] shadow-[var(--card-shadow)]">
      {coverPath ? (
        <SignedImage path={coverPath} alt="" thumb={false} className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <HouseScene period={period} className="absolute inset-0 -z-10 size-full" />
      )}
      {/* Just enough shade for the text on top and the numbers at the bottom */}
      <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-black/30 to-transparent" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="flex items-start justify-between gap-2 p-4 text-white">
        <div className="min-w-0 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
          <p className="truncate text-[20px] leading-tight font-bold tracking-[-0.02em] [font-family:var(--font-display)]">{householdName}</p>
          <p className="mt-0.5 text-[13px] text-white/85">{PERIOD_LINE[period]}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                aria-label={coverPath ? "החלפת התמונה של הבית" : "להעלות תמונה של הבית במקום האיור"}
                className="pressable grid size-10 place-items-center rounded-full bg-black/25 backdrop-blur-md"
              >
                {busy ? <Loader2 className="size-[18px] animate-spin" /> : <ImagePlus className="size-[18px]" />}
              </button>
              <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </>
          )}
          <Link href="/household" aria-label="למשק הבית" className="pressable grid size-10 place-items-center rounded-full bg-black/25 backdrop-blur-md">
            <ArrowUpLeft className="size-5" />
          </Link>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex gap-1.5 p-3 text-white">
          {stats.map((s) => (
            <Link key={s.key} href={s.href} className="pressable flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/18 px-2.5 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.25)] backdrop-blur-md">
              <s.icon className="size-4 shrink-0 opacity-90" />
              <span className="min-w-0 leading-none">
                <span className="num block text-[16px] font-bold">{s.value}</span>
                <span className="block truncate text-[10.5px] text-white/85">{s.label}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const PERIOD_LINE: Record<DayPeriod, string> = {
  morning: "בוקר רגוע בבית",
  day: "יום נעים בבית",
  evening: "האורות נדלקים בבית",
  night: "הבית נרדם בשקט",
};

export const STAT_ICONS = { grocery: ShoppingCart, tasks: ListChecks, meals: UtensilsCrossed };
