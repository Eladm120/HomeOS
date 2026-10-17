// Generates PWA / Apple touch icons from an inline SVG. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M136 236 L256 136 L376 236 V364 a20 20 0 0 1 -20 20 H156 a20 20 0 0 1 -20 -20 Z"/>
    <path d="M216 384 V300 h80 v84"/>
  </g>`;

const icon = ({ rounded, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8714a"/><stop offset="1" stop-color="#a5532f"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  ${glyph(scale)}
</svg>`;

mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["icon-192.png", 192, { rounded: true, scale: 1 }],
  ["icon-512.png", 512, { rounded: true, scale: 1 }],
  ["icon-maskable-512.png", 512, { rounded: false, scale: 0.78 }],
  ["apple-touch-icon.png", 180, { rounded: false, scale: 0.9 }],
];
for (const [name, size, opts] of jobs) {
  await sharp(Buffer.from(icon(opts))).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote", name);
}
await sharp(Buffer.from(icon({ rounded: true, scale: 1 }))).resize(48, 48).png().toFile("src/app/icon.png");
