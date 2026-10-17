import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "אין חיבור" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="size-10 text-muted" />
      <h1 className="text-xl font-semibold">אין חיבור לאינטרנט</h1>
      <p className="max-w-xs text-sm text-muted">מצב קנייה זמין גם ללא חיבור אם פתחתם אותו לפחות פעם אחת במכשיר הזה.</p>
      <Link href="/shopping/mode" className="mt-2 font-medium text-primary">
        למצב קנייה
      </Link>
    </div>
  );
}
