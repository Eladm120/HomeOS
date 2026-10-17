"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <TriangleAlert className="size-10 text-amber" />
      <h1 className="text-xl font-semibold">משהו השתבש</h1>
      <p className="max-w-xs text-sm text-muted">
        {typeof navigator !== "undefined" && !navigator.onLine ? "נראה שאין חיבור לאינטרנט." : "לא הצלחנו לטעון את העמוד. נסו שוב."}
      </p>
      <Button onClick={reset} variant="secondary">
        <RotateCcw /> ניסיון נוסף
      </Button>
    </div>
  );
}
