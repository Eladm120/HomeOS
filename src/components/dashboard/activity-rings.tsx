"use client";

import { useEffect, useState } from "react";

export interface Ring {
  label: string;
  value: number | null; // 0..1
  color: string;
  track: string;
}

/** Apple-Fitness-style concentric rings that animate in on mount. */
export function ActivityRings({ rings, size = 132 }: { rings: Ring[]; size?: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const stroke = size * 0.105;
  const gap = stroke * 0.18;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => `${r.label} ${r.value === null ? "אין נתונים" : `${Math.round(r.value * 100)}%`}`).join(", ")}>
      {rings.map((ring, i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * r;
        const v = ring.value ?? 0;
        return (
          <g key={ring.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.track} strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ring.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={drawn ? c * (1 - Math.min(1, Math.max(0.001, v))) : c}
              style={{ transition: `stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.15}s`, filter: `drop-shadow(0 0 6px ${ring.color}66)` }}
            />
          </g>
        );
      })}
    </svg>
  );
}
