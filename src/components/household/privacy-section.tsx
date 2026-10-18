"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteHousehold } from "@/server/actions/household";
import { Card, SectionLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/field";

/** Data portability and deletion (owner-only, typed confirmation). */
export function PrivacySection({ householdName, isOwner }: { householdName: string; isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SectionLabel>פרטיות ונתונים</SectionLabel>
      <Card className="mb-8 divide-y divide-border">
        <a href="/api/export" className="flex min-h-12 items-center gap-3 px-4 py-2 text-[17px] active:bg-fill">
          <Download className="size-5 text-primary" /> הורדת כל הנתונים (JSON)
        </a>
        {isOwner && (
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-[17px] text-danger active:bg-fill">
            <Trash2 className="size-5" /> מחיקת משק הבית וכל הנתונים
          </button>
        )}
      </Card>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="מחיקת משק הבית"
        description="פעולה בלתי הפיכה"
        footer={
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            disabled={typed.trim() !== householdName.trim() || busy}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await deleteHousehold(typed);
              setBusy(false);
              if (!r.ok) return void toast.error(r.error);
              router.push("/onboarding");
            }}
          >
            מחיקה לצמיתות
          </Button>
        }
      >
        <p className="mb-3 text-[15px]">יימחקו כל הנתונים של שני חברי הבית: רשימות, מלאי, מתכונים, מסמכים, חשבונות, תמונות וחיבורים. מומלץ להוריד קודם את הנתונים.</p>
        <p className="mb-2 text-[14px] text-muted">כדי לאשר, הקלידו את שם משק הבית: <b>{householdName}</b></p>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="שם משק הבית לאישור" />
      </Sheet>
    </>
  );
}
