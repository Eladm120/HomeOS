import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "אין חיבור" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="size-10 text-muted" />
      <h1 className="text-xl font-semibold">אין חיבור לאינטרנט</h1>
      <p className="max-w-xs text-sm text-muted">רשימת הקניות זמינה גם ללא חיבור אם פתחתם אותה לפחות פעם אחת במכשיר הזה. סימונים נשמרים ויסונכרנו כשהחיבור יחזור.</p>
      <Link href="/shopping" className="mt-2 font-medium text-primary">
        לרשימת הקניות
      </Link>
    </div>
  );
}
