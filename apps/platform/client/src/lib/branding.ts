/**
 * Runtime white-labeling. The design system's colors are CSS variables
 * (Tailwind v4 @theme tokens), so re-branding a tenant = overriding the navy
 * scale on :root with shades derived from the org's single primary color.
 */

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${h.toFixed(1)} ${Math.max(0, Math.min(100, s)).toFixed(1)}% ${Math.max(0, Math.min(100, l)).toFixed(1)}%)`;

const VARS = [
  "--color-navy-950",
  "--color-navy-900",
  "--color-navy-800",
  "--color-navy-700",
  "--color-navy-600",
  "--color-navy",
];

/** Override the primary palette with shades of `primary`, or reset to default. */
export function applyBrandColor(primary: string | null | undefined) {
  const root = document.documentElement;
  const parsed = primary ? hexToHsl(primary) : null;
  if (!parsed) {
    for (const v of VARS) root.style.removeProperty(v);
    return;
  }
  const [h, s, l] = parsed;
  root.style.setProperty("--color-navy-950", hsl(h, s, Math.max(6, l - 8)));
  root.style.setProperty("--color-navy-900", hsl(h, s, l));
  root.style.setProperty("--color-navy-800", hsl(h, s, l + 7));
  root.style.setProperty("--color-navy-700", hsl(h, s, l + 14));
  root.style.setProperty("--color-navy-600", hsl(h, s, l + 21));
  root.style.setProperty("--color-navy", hsl(h, s, l));
}
