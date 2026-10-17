"use client";

import { useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COMMIT = 96;

/**
 * iOS-style swipe actions. Drag one way to complete, the other way to delete.
 * Vertical scrolling is preserved (axis is locked after the first few pixels).
 */
export function SwipeRow({
  children,
  onComplete,
  onDelete,
  completeLabel = "סימון",
  className,
}: {
  children: React.ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  completeLabel?: string;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const start = useRef<{ x: number; y: number; axis: "x" | "y" | null; id: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
    setAnimating(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (s.axis === "x") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (s.axis !== "x") return;
    let next = mx;
    if (next > 0 && !onComplete) next = 0;
    if (next < 0 && !onDelete) next = 0;
    // rubber-band past the commit point
    const sign = Math.sign(next);
    const abs = Math.abs(next);
    setDx(sign * (abs > COMMIT ? COMMIT + (abs - COMMIT) * 0.35 : abs));
  }

  function onPointerUp() {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== "x") return;
    setAnimating(true);
    if (dx >= COMMIT && onComplete) {
      if (navigator.vibrate) navigator.vibrate(10);
      onComplete();
    } else if (dx <= -COMMIT && onDelete) {
      if (navigator.vibrate) navigator.vibrate(10);
      onDelete();
    }
    setDx(0);
  }

  const reveal = Math.min(1, Math.abs(dx) / COMMIT);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {dx !== 0 && (
        <div
          aria-hidden
          className={cn("absolute inset-0 flex items-center px-6 text-white", dx > 0 ? "justify-end bg-sage" : "justify-start bg-danger")}
          style={{ opacity: 0.35 + reveal * 0.65 }}
        >
          <span className="flex flex-col items-center gap-0.5 text-[12px] font-semibold" style={{ transform: `scale(${0.7 + reveal * 0.3})` }}>
            {dx > 0 ? <Check className="size-6" strokeWidth={2.75} /> : <Trash2 className="size-6" />}
            {dx > 0 ? completeLabel : "מחיקה"}
          </span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative bg-surface [touch-action:pan-y]"
        style={{ transform: `translateX(${dx}px)`, transition: animating ? "transform 0.45s cubic-bezier(0.32,0.72,0,1)" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}
