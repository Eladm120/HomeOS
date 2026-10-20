/**
 * The home as a cozy little illustration: a cottage with a garden under a sky
 * that follows the time of day in the household's timezone — a peachy
 * morning, a bright noon, a sunset evening with the lights coming on, and a
 * starry night with glowing windows and fireflies. Pure SVG (gradients, soft
 * shadows and a touch of paper grain), so it is crisp at any size, works
 * offline and costs a few kilobytes.
 */
export type DayPeriod = "morning" | "day" | "evening" | "night";

export function periodFromGreeting(greeting: string): DayPeriod {
  if (greeting.includes("בוקר")) return "morning";
  if (greeting.includes("צהריים")) return "day";
  if (greeting.includes("ערב")) return "evening";
  return "night";
}

interface Palette {
  sky: [string, string, string];
  glow: string;
  orb: { x: number; y: number; r: number; color: string; halo: string; moon?: boolean };
  cloud: string;
  hillFar: [string, string];
  hillMid: [string, string];
  lawn: [string, string];
  wall: [string, string];
  roof: [string, string];
  window: string;
  windowGlow: number;
  tree: [string, string];
  shade: number;
  stars: boolean;
  smoke: boolean;
}

const PALETTES: Record<DayPeriod, Palette> = {
  morning: {
    sky: ["#f7c9a8", "#f3dcc4", "#bfd9e6"],
    glow: "#ffe7b8",
    orb: { x: 92, y: 74, r: 22, color: "#ffe4a3", halo: "#ffd98a" },
    cloud: "#fff7ef",
    hillFar: ["#a9bfa0", "#93ab8c"],
    hillMid: ["#86a66f", "#6f9159"],
    lawn: ["#6f9a52", "#4e7638"],
    wall: ["#fbeedd", "#efd9c0"],
    roof: ["#d0694a", "#a94c33"],
    window: "#fbe6b0",
    windowGlow: 0.15,
    tree: ["#7fae5e", "#4f7f3a"],
    shade: 0.18,
    stars: false,
    smoke: true,
  },
  day: {
    sky: ["#7fb6e6", "#a9d0ee", "#dcecf5"],
    glow: "#ffffff",
    orb: { x: 262, y: 50, r: 20, color: "#fff3c4", halo: "#fff6d6" },
    cloud: "#ffffff",
    hillFar: ["#9cc28f", "#86b27a"],
    hillMid: ["#79ad5e", "#5e9446"],
    lawn: ["#69a24a", "#4b8034"],
    wall: ["#fff6ea", "#f1e1cc"],
    roof: ["#d9694a", "#b14d34"],
    window: "#cfe6f5",
    windowGlow: 0,
    tree: ["#78b456", "#4a8a34"],
    shade: 0.22,
    stars: false,
    smoke: false,
  },
  evening: {
    sky: ["#4c4675", "#a8728a", "#f2b07c"],
    glow: "#ffc68a",
    orb: { x: 318, y: 112, r: 24, color: "#ffd28c", halo: "#ffb36b" },
    cloud: "#f3c1b0",
    hillFar: ["#6b6a7d", "#585a6e"],
    hillMid: ["#55684e", "#41553b"],
    lawn: ["#41583a", "#2c3f28"],
    wall: ["#f3d9c2", "#d9b79c"],
    roof: ["#b5533d", "#8a3b2b"],
    window: "#ffd27a",
    windowGlow: 0.8,
    tree: ["#4f6e44", "#344d2e"],
    shade: 0.3,
    stars: false,
    smoke: true,
  },
  night: {
    sky: ["#0f1530", "#1d2a4f", "#34426b"],
    glow: "#8fa4d8",
    orb: { x: 246, y: 72, r: 17, color: "#f4efd8", halo: "#c9d4f2", moon: true },
    cloud: "#3c4a72",
    hillFar: ["#26304a", "#1f283f"],
    hillMid: ["#223527", "#192a1e"],
    lawn: ["#1b2b1c", "#111d13"],
    wall: ["#c9b7a6", "#9f8c7c"],
    roof: ["#7d3a2e", "#5a2820"],
    window: "#ffcf6e",
    windowGlow: 1,
    tree: ["#2c4630", "#1b2f1f"],
    shade: 0.35,
    stars: true,
    smoke: true,
  },
};

const STARS = [
  [24, 22, 1.2], [58, 44, 0.9], [96, 18, 1.4], [132, 52, 0.8], [168, 26, 1.1], [204, 12, 0.9], [236, 40, 1.3], [262, 20, 0.8],
  [286, 88, 0.9], [350, 24, 1.1], [376, 58, 0.9], [44, 82, 0.8], [118, 92, 1], [384, 104, 0.8], [12, 112, 0.9], [222, 70, 0.7],
];

const FLOWERS = [
  [96, 196, "#f6a6b8"], [108, 202, "#fff1a8"], [120, 197, "#f6a6b8"], [282, 200, "#ffd1a1"], [294, 195, "#fff"], [306, 203, "#f6a6b8"], [318, 197, "#fff1a8"],
] as const;

export function HouseScene({ period, className }: { period: DayPeriod; className?: string }) {
  const p = PALETTES[period];
  const id = `hs-${period}`;
  const lit = p.windowGlow > 0;
  return (
    <svg aria-hidden viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" className={className}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.55" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor={p.orb.halo} stopOpacity="0.85" />
          <stop offset="0.35" stopColor={p.orb.halo} stopOpacity="0.25" />
          <stop offset="1" stopColor={p.orb.halo} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.hillFar[0]} />
          <stop offset="1" stopColor={p.hillFar[1]} />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.hillMid[0]} />
          <stop offset="1" stopColor={p.hillMid[1]} />
        </linearGradient>
        <linearGradient id={`${id}-lawn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.lawn[0]} />
          <stop offset="1" stopColor={p.lawn[1]} />
        </linearGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p.wall[0]} />
          <stop offset="1" stopColor={p.wall[1]} />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.roof[0]} />
          <stop offset="1" stopColor={p.roof[1]} />
        </linearGradient>
        <radialGradient id={`${id}-tree`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={p.tree[0]} />
          <stop offset="1" stopColor={p.tree[1]} />
        </radialGradient>
        <radialGradient id={`${id}-win`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor={p.window} stopOpacity={0.9 * p.windowGlow} />
          <stop offset="1" stopColor={p.window} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity={p.shade} />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        {/* paper grain: the "a little real" part */}
        <filter id={`${id}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0" />
        </filter>
      </defs>

      {/* Sky, sun/moon */}
      <rect width="400" height="250" fill={`url(#${id}-sky)`} />
      <circle cx={p.orb.x} cy={p.orb.y} r={p.orb.r * 4} fill={`url(#${id}-halo)`} />
      {p.stars && (
        <g fill="#fff">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} className="hs-twinkle" style={{ animationDelay: `${(i % 5) * 0.7}s` }} />
          ))}
        </g>
      )}
      <circle cx={p.orb.x} cy={p.orb.y} r={p.orb.r} fill={p.orb.color} />
      {p.orb.moon && (
        <>
          <circle cx={p.orb.x + 7} cy={p.orb.y - 5} r={p.orb.r * 0.92} fill={p.sky[0]} opacity="0.9" />
          <circle cx={p.orb.x - 7} cy={p.orb.y + 4} r="2.2" fill="#000" opacity="0.06" />
        </>
      )}

      {/* Clouds drift slowly */}
      <g fill={p.cloud} opacity={period === "night" ? 0.55 : 0.9} className="hs-drift">
        <g transform="translate(40 50)">
          <ellipse cx="0" cy="8" rx="30" ry="9" />
          <ellipse cx="-10" cy="2" rx="14" ry="11" />
          <ellipse cx="8" cy="0" rx="16" ry="13" />
        </g>
        <g transform="translate(232 34) scale(0.8)">
          <ellipse cx="0" cy="8" rx="32" ry="9" />
          <ellipse cx="-12" cy="2" rx="14" ry="10" />
          <ellipse cx="8" cy="-1" rx="17" ry="14" />
        </g>
      </g>

      {/* Hills */}
      <path d="M0 150 C 60 118 120 122 180 140 S 300 112 400 132 V250 H0Z" fill={`url(#${id}-far)`} />
      <path d="M0 172 C 70 146 150 150 220 166 S 340 146 400 160 V250 H0Z" fill={`url(#${id}-mid)`} />

      {/* Back trees on the hill */}
      <g>
        <circle cx="338" cy="150" r="11" fill={`url(#${id}-tree)`} />
        <circle cx="352" cy="155" r="8" fill={`url(#${id}-tree)`} />
        <circle cx="54" cy="160" r="9" fill={`url(#${id}-tree)`} />
      </g>

      {/* Lawn */}
      <path d="M0 192 C 90 176 170 178 250 186 S 360 180 400 186 V250 H0Z" fill={`url(#${id}-lawn)`} />

      {/* House shadow + cottage */}
      <ellipse cx="200" cy="190" rx="70" ry="9" fill={`url(#${id}-shadow)`} />
      <g>
        {/* chimney + smoke */}
        <rect x="222" y="98" width="12" height="26" rx="1.5" fill={p.roof[1]} />
        <rect x="220" y="95" width="16" height="5" rx="1.5" fill={p.roof[0]} />
        {p.smoke && (
          <g fill={period === "night" ? "#9aa6c4" : "#ffffff"} opacity="0.55" className="hs-smoke">
            <circle cx="229" cy="86" r="4" />
            <circle cx="233" cy="76" r="5" />
            <circle cx="238" cy="64" r="6" />
          </g>
        )}
        {/* walls */}
        <path d="M156 136 L200 104 L244 136 V188 H156Z" fill={`url(#${id}-wall)`} />
        <path d="M244 136 L200 104 L200 188 H244Z" fill="#000" opacity="0.06" />
        {/* roof with eaves */}
        <path d="M146 140 L200 96 L254 140 L248 143 L200 104 L152 143Z" fill={`url(#${id}-roof)`} />
        <path d="M152 143 L200 104 L248 143" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="1.5" />
        {/* round attic window */}
        <circle cx="200" cy="124" r="6.5" fill={lit ? p.window : p.window} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" />
        {/* windows */}
        {[166, 214].map((x) => (
          <g key={x}>
            {lit && <rect x={x - 10} y="134" width="40" height="40" fill={`url(#${id}-win)`} />}
            <rect x={x} y="146" width="20" height="18" rx="2" fill={p.window} stroke="#fff" strokeWidth="2" />
            <path d={`M${x + 10} 146 V164 M${x} 155 H${x + 20}`} stroke="#fff" strokeWidth="1.6" />
            <rect x={x - 2} y="164" width="24" height="3.5" rx="1.5" fill={p.roof[1]} opacity="0.8" />
          </g>
        ))}
        {/* door + porch light */}
        <rect x="191" y="158" width="18" height="30" rx="9" fill={p.roof[1]} />
        <circle cx="205" cy="174" r="1.4" fill="#f5d48a" />
        {lit && <circle cx="186" cy="152" r="9" fill={`url(#${id}-win)`} />}
        <circle cx="186" cy="152" r="2" fill={lit ? "#ffe2a0" : "#d9c9b0"} />
      </g>

      {/* Path to the door */}
      <path d="M193 188 C 188 206 176 222 160 250 H232 C 220 224 210 206 207 188Z" fill={p.wall[1]} opacity="0.55" />

      {/* Garden: tree, bushes, fence, flowers */}
      <g>
        <rect x="111" y="150" width="6" height="40" rx="2" fill="#6b4a33" />
        <ellipse cx="114" cy="191" rx="18" ry="3.5" fill={`url(#${id}-shadow)`} />
        <circle cx="114" cy="138" r="20" fill={`url(#${id}-tree)`} />
        <circle cx="100" cy="150" r="13" fill={`url(#${id}-tree)`} />
        <circle cx="128" cy="150" r="14" fill={`url(#${id}-tree)`} />
        <circle cx="108" cy="130" r="6" fill="#fff" opacity="0.1" />
      </g>
      <g fill={`url(#${id}-tree)`}>
        <ellipse cx="150" cy="190" rx="12" ry="8" />
        <ellipse cx="252" cy="190" rx="13" ry="8" />
        <ellipse cx="266" cy="192" rx="9" ry="6" />
      </g>
      <g stroke={period === "night" ? "#8d8478" : "#fbf3e6"} strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
        {[272, 284, 296, 308, 320, 332].map((x) => (
          <path key={x} d={`M${x} 204 V190`} />
        ))}
        <path d="M268 194 H336 M268 200 H336" strokeWidth="1.6" />
      </g>
      {FLOWERS.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2.6" fill={c} opacity={period === "night" ? 0.6 : 1} />
          <circle cx={x} cy={y} r="0.9" fill="#f2c14e" />
        </g>
      ))}

      {/* Fireflies at night */}
      {period === "night" && (
        <g fill="#f8e58c" filter={`url(#${id}-soft)`}>
          {[[70, 200], [140, 214], [258, 210], [330, 220], [96, 226]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.6" className="hs-twinkle" style={{ animationDelay: `${i * 0.9}s` }} />
          ))}
        </g>
      )}

      {/* Warm evening light washes over everything */}
      {period === "evening" && <rect width="400" height="250" fill="#ff9a5a" opacity="0.08" />}
      <rect width="400" height="250" filter={`url(#${id}-grain)`} />
    </svg>
  );
}
