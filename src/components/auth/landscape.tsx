/**
 * Sign-in illustration: a warm morning over rolling hills, a cottage with a
 * terracotta roof among olive trees, cypresses, a winding path and flowers in
 * the foreground — painted in SVG (gradients, soft blur for depth, a little
 * grain) so it stays sharp and light.
 */
export function Landscape({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 390 440" preserveAspectRatio="xMidYMax slice" className={className}>
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9cfe2" />
          <stop offset="0.45" stopColor="#d9e6dc" />
          <stop offset="0.75" stopColor="#f5e6c2" />
          <stop offset="1" stopColor="#f3dcae" />
        </linearGradient>
        <radialGradient id="ls-sun">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.25" stopColor="#fff1c9" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffe3a0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffe3a0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c7cfae" />
          <stop offset="1" stopColor="#b3c095" />
        </linearGradient>
        <linearGradient id="ls-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c3cf8a" />
          <stop offset="1" stopColor="#97ad5f" />
        </linearGradient>
        <linearGradient id="ls-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8bd6a" />
          <stop offset="1" stopColor="#7d9a48" />
        </linearGradient>
        <linearGradient id="ls-wall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbf1e2" />
          <stop offset="1" stopColor="#ead7bd" />
        </linearGradient>
        <linearGradient id="ls-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9784f" />
          <stop offset="1" stopColor="#b25a37" />
        </linearGradient>
        <radialGradient id="ls-olive" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#8fa65a" />
          <stop offset="1" stopColor="#566e33" />
        </radialGradient>
        <linearGradient id="ls-cypress" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5d7a3f" />
          <stop offset="1" stopColor="#3d5629" />
        </linearGradient>
        <radialGradient id="ls-glow">
          <stop offset="0" stopColor="#ffd77a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
        </radialGradient>
        <filter id="ls-blur-s"><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id="ls-blur-l"><feGaussianBlur stdDeviation="3.5" /></filter>
        <filter id="ls-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.07 0" />
        </filter>
      </defs>

      <rect width="390" height="440" fill="url(#ls-sky)" />
      <circle cx="318" cy="262" r="120" fill="url(#ls-sun)" />
      <circle cx="318" cy="262" r="30" fill="#fff8e6" opacity="0.9" />

      {/* clouds */}
      <g fill="#fffaf2" opacity="0.85" className="hs-drift">
        <g transform="translate(320 150)">
          <ellipse cx="0" cy="8" rx="44" ry="10" />
          <ellipse cx="-14" cy="0" rx="18" ry="13" />
          <ellipse cx="10" cy="-3" rx="22" ry="17" />
        </g>
        <g transform="translate(70 238) scale(0.8)">
          <ellipse cx="0" cy="8" rx="46" ry="10" />
          <ellipse cx="-12" cy="0" rx="18" ry="12" />
          <ellipse cx="12" cy="-2" rx="20" ry="15" />
        </g>
      </g>

      {/* far hills with tiny cypresses and a far farmhouse */}
      <path d="M0 300 C 60 270 120 274 180 288 S 300 262 390 280 V440 H0Z" fill="url(#ls-far)" opacity="0.9" />
      <g fill="#7f9259" opacity="0.7">
        {[[232, 284], [244, 281], [262, 279], [276, 282]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="2.6" ry="9" />
        ))}
      </g>
      <g opacity="0.75">
        <rect x="196" y="283" width="14" height="8" fill="#f3e6d2" />
        <path d="M194 284 L203 278 L212 284Z" fill="#c76b45" />
      </g>

      {/* middle hills */}
      <path d="M0 330 C 80 300 170 306 250 318 S 350 300 390 306 V440 H0Z" fill="url(#ls-mid)" />
      {/* stripes of the fields */}
      <g stroke="#8ea456" strokeOpacity="0.35" strokeWidth="2" fill="none">
        <path d="M250 330 C 300 322 340 318 390 322" />
        <path d="M240 342 C 300 334 340 330 390 334" />
        <path d="M232 354 C 296 346 344 344 390 346" />
      </g>

      {/* cypresses on the right */}
      {[[336, 300, 11, 46], [356, 290, 13, 58], [376, 304, 10, 42], [318, 318, 8, 30]].map(([x, y, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + ry - 4} rx={rx * 0.9} ry="3" fill="#000" opacity="0.08" />
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="url(#ls-cypress)" />
        </g>
      ))}

      {/* near hill with the cottage */}
      <path d="M0 352 C 70 338 150 336 220 350 S 340 348 390 356 V440 H0Z" fill="url(#ls-near)" />

      {/* olive trees behind the house */}
      <g>
        <rect x="70" y="300" width="5" height="34" rx="2" fill="#6b4c32" />
        <circle cx="72" cy="296" r="22" fill="url(#ls-olive)" />
        <circle cx="56" cy="306" r="14" fill="url(#ls-olive)" />
        <circle cx="90" cy="304" r="15" fill="url(#ls-olive)" />
        <rect x="236" y="306" width="5" height="30" rx="2" fill="#6b4c32" />
        <circle cx="238" cy="300" r="18" fill="url(#ls-olive)" />
        <circle cx="252" cy="310" r="12" fill="url(#ls-olive)" />
      </g>

      {/* cottage */}
      <ellipse cx="160" cy="352" rx="72" ry="7" fill="#000" opacity="0.12" />
      <g>
        <rect x="174" y="296" width="9" height="14" fill="#efe1cc" />
        <rect x="172" y="293" width="13" height="4" rx="1" fill="#d9c7ad" />
        <path d="M100 318 H218 V350 H100Z" fill="url(#ls-wall)" />
        <path d="M184 318 H218 V350 H184Z" fill="#000" opacity="0.05" />
        <path d="M94 320 L118 300 H200 L224 320Z" fill="url(#ls-roof)" />
        <path d="M94 320 H224" stroke="#8f4628" strokeOpacity="0.4" strokeWidth="1.5" />
        {[[112, 326], [136, 326]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x + 6} cy={y + 7} r="13" fill="url(#ls-glow)" />
            <rect x={x} y={y} width="12" height="13" rx="1.5" fill="#ffd77a" stroke="#fff6e4" strokeWidth="1.6" />
            <path d={`M${x + 6} ${y} V${y + 13}`} stroke="#fff6e4" strokeWidth="1.2" />
          </g>
        ))}
        <rect x="190" y="327" width="13" height="23" rx="1.5" fill="#a5683f" />
        <rect x="170" y="328" width="11" height="12" rx="1.5" fill="#f2e2c8" stroke="#fff" strokeWidth="1.2" />
        {/* little bushes along the wall */}
        <g fill="url(#ls-olive)">
          <ellipse cx="104" cy="350" rx="10" ry="7" />
          <ellipse cx="160" cy="351" rx="8" ry="5" />
          <ellipse cx="216" cy="350" rx="9" ry="6" />
        </g>
      </g>

      {/* winding path */}
      <path d="M194 352 C 214 368 236 372 250 384 C 268 400 262 420 248 440 H290 C 302 418 300 396 280 380 C 262 366 228 360 206 350Z" fill="#efe2c6" />
      <path d="M194 352 C 214 368 236 372 250 384 C 268 400 262 420 248 440" fill="none" stroke="#d9c79f" strokeWidth="1.2" />

      {/* foreground flowers (soft, close to the camera) */}
      <g filter="url(#ls-blur-s)">
        <ellipse cx="40" cy="420" rx="70" ry="34" fill="#7f9b47" />
        <ellipse cx="350" cy="424" rx="70" ry="30" fill="#83a04a" />
        {[[18, 404], [44, 396], [70, 410], [32, 424], [86, 422], [318, 404], [344, 398], [368, 410], [332, 422], [380, 426], [300, 418]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="#fffaf0" />
            <circle cx={x} cy={y} r="1.6" fill="#e8c35a" />
          </g>
        ))}
      </g>

      {/* leafy branch at the top-left edge, out of focus */}
      <g filter="url(#ls-blur-l)" opacity="0.9">
        <path d="M-10 40 C 30 70 40 120 30 190" stroke="#5f7a3a" strokeWidth="4" fill="none" />
        {[[6, 54, -30], [30, 80, 25], [16, 104, -35], [40, 128, 20], [22, 150, -30], [38, 176, 15], [0, 120, -50]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="20" ry="9" transform={`rotate(${r} ${x} ${y})`} fill={i % 2 ? "#7d9a4c" : "#6a8740"} />
        ))}
      </g>

      <rect width="390" height="440" filter="url(#ls-grain)" />
    </svg>
  );
}

/** The HomeOS mark: a rounded house outline with a small heart inside. */
export function HomeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={className} aria-hidden>
      <defs>
        <linearGradient id="hm-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d9a62" />
          <stop offset="1" stopColor="#56744a" />
        </linearGradient>
      </defs>
      <path d="M10 50 V26 L32 7 L54 26 V50" fill="none" stroke="url(#hm-g)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 40 C 23 34 22 26 27.5 24 C 30 23.2 31.6 24.6 32 26 C 32.4 24.6 34 23.2 36.5 24 C 42 26 41 34 32 40Z" fill="#e2b25a" />
    </svg>
  );
}
