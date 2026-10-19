/**
 * A small illustrated house that keeps the household's time of day: a peach
 * morning, a bright noon, a lavender evening with the lights coming on, and a
 * starry night. Pure SVG, drawn for this screen; motion is slow and stops
 * under prefers-reduced-motion.
 */
export type Period = "morning" | "day" | "evening" | "night";

export function periodFromGreeting(greeting: string): Period {
  if (greeting.includes("בוקר")) return "morning";
  if (greeting.includes("צהריים")) return "day";
  if (greeting.includes("ערב")) return "evening";
  return "night";
}

const SKY: Record<Period, [string, string, string]> = {
  morning: ["#ffd9c2", "#ffe9dc", "#f3ecff"],
  day: ["#cfe4ff", "#e3eeff", "#f4f1ff"],
  evening: ["#b9a8f5", "#e7b9d6", "#ffcfb5"],
  night: ["#241f4a", "#3a2f6b", "#5a4686"],
};
const HILL: Record<Period, [string, string]> = {
  morning: ["#e9dcf7", "#d9c9f2"],
  day: ["#dbe9e2", "#c6dfd2"],
  evening: ["#a993d9", "#8c74c8"],
  night: ["#2f2858", "#251f48"],
};

export function HomeScene({ period, className }: { period: Period; className?: string }) {
  const [top, mid, bottom] = SKY[period];
  const [hillFar, hillNear] = HILL[period];
  const dark = period === "night";
  const lit = period === "evening" || period === "night";
  const orb = period === "night" ? { cx: 74, cy: 34, r: 13, fill: "#fff6d8" } : period === "evening" ? { cx: 52, cy: 92, r: 22, fill: "#ffb48a" } : period === "morning" ? { cx: 64, cy: 66, r: 18, fill: "#ffb079" } : { cx: 82, cy: 36, r: 16, fill: "#ffd45c" };
  const wall = dark ? "#4b3f7f" : "#fffaf6";
  const roof = dark ? "#2a2350" : period === "evening" ? "#6d58b8" : "#7062e8";
  const glass = lit ? "#ffd27a" : "#dfe8ff";

  return (
    <svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.6" stopColor={mid} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <radialGradient id="hs-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hs-orb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={orb.fill} stopOpacity="0.5" />
          <stop offset="1" stopColor={orb.fill} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="360" height="150" fill="url(#hs-sky)" />

      {/* Stars */}
      {(dark || period === "evening") && (
        <g fill="#fff" className="hs-twinkle">
          {[
            [40, 22, 1.2], [92, 40, 0.9], [140, 16, 1.4], [196, 34, 1], [236, 14, 1.1], [262, 52, 0.8], [330, 70, 1], [20, 58, 0.8], [118, 66, 0.7],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity={dark ? 0.9 : 0.55} style={{ animationDelay: `${(i * 0.7) % 4}s` }} />
          ))}
        </g>
      )}

      {/* Sun or moon with a soft halo */}
      <circle cx={orb.cx} cy={orb.cy} r={orb.r * 2.6} fill="url(#hs-orb)" />
      <circle cx={orb.cx} cy={orb.cy} r={orb.r} fill={orb.fill} />
      {dark && <circle cx={orb.cx + 5} cy={orb.cy - 4} r={orb.r * 0.85} fill={top} />}

      {/* A couple of slow clouds by day */}
      {!dark && (
        <g fill="#fff" opacity={period === "evening" ? 0.35 : 0.8} className="hs-drift">
          <path d="M210 44c0-6 5-10 11-10 3-6 13-7 17 0 6 0 9 4 9 9 0 4-3 6-7 6h-24c-4 0-6-2-6-5z" />
          <path d="M108 26c0-4 3-7 8-7 2-4 9-5 12 0 4 0 6 3 6 6 0 3-2 4-5 4h-17c-3 0-4-1-4-3z" opacity="0.8" />
        </g>
      )}

      {/* Hills */}
      <path d="M0 112c40-20 86-26 130-14s84 18 128 4 76-14 102-6v54H0z" fill={hillFar} />
      <path d="M0 128c56-14 104-12 156-2s108 10 204-6v30H0z" fill={hillNear} />

      {/* The house */}
      <g transform="translate(196 62)">
        {lit && <ellipse cx="44" cy="58" rx="70" ry="30" fill="url(#hs-glow)" />}
        {/* chimney + smoke */}
        <rect x="58" y="6" width="9" height="18" rx="1.5" fill={roof} />
        {lit && (
          <g className="hs-smoke" fill="none" stroke={dark ? "#9a8fc9" : "#fff"} strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
            <path d="M62 2c-4-5 4-8 0-13s4-8 1-12" />
          </g>
        )}
        {/* roof */}
        <path d="M-6 30 40 -2l46 32" fill="none" stroke={roof} strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
        {/* walls */}
        <path d="M4 28 40 4l36 24v42a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill={wall} />
        {/* windows */}
        <rect x="14" y="36" width="16" height="16" rx="3" fill={glass} />
        <rect x="50" y="36" width="16" height="16" rx="3" fill={glass} />
        <path d="M22 36v16M14 44h16M58 36v16M50 44h16" stroke={wall} strokeWidth="1.6" />
        {/* round attic window */}
        <circle cx="40" cy="22" r="5" fill={glass} />
        {/* door */}
        <path d="M33 74V60a7 7 0 0 1 14 0v14z" fill={roof} />
        <circle cx="44" cy="67" r="1.1" fill={glass} />
      </g>

      {/* A round bush and a little tree */}
      <circle cx="292" cy="132" r="12" fill={dark ? "#3c3370" : "#9fd3b6"} />
      <circle cx="304" cy="128" r="9" fill={dark ? "#463b80" : "#b7e0c7"} />
      <g transform="translate(160 96)">
        <rect x="-1.5" y="18" width="3" height="16" rx="1.5" fill={dark ? "#3c3370" : "#b48a73"} />
        <circle cx="0" cy="14" r="11" fill={dark ? "#3a3170" : "#a8dcc0"} />
      </g>
    </svg>
  );
}
