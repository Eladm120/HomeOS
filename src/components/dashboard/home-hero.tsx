"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpLeft, ImagePlus, ListChecks, Loader2, ShoppingCart, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadHouseholdImage, validateImageFile } from "@/lib/media";
import { setHouseholdCover } from "@/server/actions/household";
import { SignedImage } from "@/components/media/signed-image";

export interface HeroStat {
  key: string;
  icon: LucideIcon;
  value: number | string;
  label: string;
  href: string;
}

/**
 * The home itself, as a picture: the household's own photo (or a soft
 * illustrated room until there is one), with the day's numbers on glass.
 */
export function HomeHero({
  householdId,
  householdName,
  coverPath,
  canEdit,
  stats,
  preview,
}: {
  householdId: string;
  householdName: string;
  coverPath: string | null;
  canEdit: boolean;
  stats: HeroStat[];
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
    <section aria-label={householdName} className="relative isolate h-[218px] overflow-hidden rounded-[1.75rem] shadow-[var(--card-shadow)]">
      {coverPath ? <SignedImage path={coverPath} alt="" thumb={false} className="absolute inset-0 -z-10 size-full object-cover" /> : <RoomArt />}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/20 to-black/5" />

      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="pressable absolute top-3 start-3 flex h-9 items-center gap-1.5 rounded-full bg-black/35 px-3 text-[13px] font-semibold text-white backdrop-blur-md"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {coverPath ? "החלפת תמונה" : "תמונה של הבית"}
          </button>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[22px] leading-tight font-bold tracking-[-0.02em] [font-family:var(--font-display)]">{householdName}</p>
            <p className="mt-0.5 text-[13px] text-white/75">{stats.length ? "מה קורה בבית היום" : "הכל רגוע בבית"}</p>
          </div>
          <Link href="/household" aria-label="למשק הבית" className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-md">
            <ArrowUpLeft className="size-5" />
          </Link>
        </div>
        {stats.length > 0 && (
          <div className="mt-3 flex gap-1.5">
            {stats.map((s) => (
              <Link key={s.key} href={s.href} className="pressable flex h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/15 px-2.5 backdrop-blur-md">
                <s.icon className="size-4 shrink-0 opacity-85" />
                <span className="min-w-0 leading-none">
                  <span className="num block text-[15px] font-bold">{s.value}</span>
                  <span className="block truncate text-[10.5px] text-white/75">{s.label}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const STAT_ICONS = { grocery: ShoppingCart, tasks: ListChecks, meals: UtensilsCrossed };

/** Until the household adds a photo: a calm illustrated living room in the accent's light. */
function RoomArt() {
  return (
    <svg aria-hidden viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 size-full">
      <defs>
        <linearGradient id="hh-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--accent) 38%, #2b3a33)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--gold) 22%, #2a2422)" }} />
        </linearGradient>
        <radialGradient id="hh-light" cx="0.78" cy="0.15" r="0.6">
          <stop offset="0" stopColor="rgba(255,240,210,0.55)" />
          <stop offset="1" stopColor="rgba(255,240,210,0)" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill="url(#hh-wall)" />
      <rect width="400" height="220" fill="url(#hh-light)" />
      {/* window (behind the photo button) */}
      <rect x="250" y="14" width="120" height="96" rx="10" fill="rgba(255,250,235,0.14)" />
      <path d="M310 14v96M250 62h120" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
      {/* floor */}
      <rect y="170" width="400" height="50" fill="rgba(0,0,0,0.22)" />
      {/* the room sits on the left; the title lives on the right */}
      <g opacity="0.85">
        {/* lamp */}
        <path d="M150 170V92" stroke="rgba(255,255,255,0.45)" strokeWidth="3" />
        <path d="M134 94h32l-7-20h-18z" fill="rgba(255,236,200,0.9)" />
        {/* sofa */}
        <rect x="8" y="118" width="128" height="46" rx="16" fill="rgba(245,240,232,0.8)" />
        <rect x="16" y="104" width="54" height="34" rx="12" fill="rgba(250,246,240,0.88)" />
        <rect x="74" y="104" width="54" height="34" rx="12" fill="rgba(250,246,240,0.88)" />
        {/* plant */}
        <rect x="176" y="146" width="22" height="26" rx="5" fill="rgba(240,230,215,0.7)" />
        <path d="M187 146c-12-15-13-33-3-46M187 146c8-17 18-25 28-28M187 146c-3-18 5-38 18-48" style={{ stroke: "color-mix(in oklab, var(--accent) 80%, #3c6b4f)" }} strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
