// Colour primitives. Pure, framework-free. All channel values are 0..1 floats unless noted.
//  - sRGB transfer functions and relative luminance follow IEC 61966-2-1 / WCAG 2.2 exactly.
//  - OKLab/OKLCH, HSL, CIEDE2000 and CSS Color 4 gamut mapping come from culori (MIT).
import {
  useMode, modeRgb, modeLrgb, modeOklab, modeOklch, modeHsl, modeLab65,
  differenceCiede2000, toGamut, type Oklch, type Rgb,
} from "culori/fn";

const toRgb = useMode(modeRgb) as (c: unknown) => Rgb;
useMode(modeLrgb); useMode(modeLab65);
const toHsl = useMode(modeHsl) as (c: unknown) => { h?: number; s: number; l: number };
const oklab = useMode(modeOklab);
const oklch = useMode(modeOklch);
const ciede2000 = differenceCiede2000();
/** CSS Color 4 gamut mapping: reduce OKLCH chroma at constant lightness and hue until in sRGB (JND 0.02). */
const mapToSrgb = toGamut("rgb", "oklch");

export type RGB = readonly [number, number, number];
export interface RGBA { r: number; g: number; b: number; a: number }

// ---------- parsing / formatting
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa (with or without #). Returns null for anything else. */
export function parseHex(input: unknown): RGBA | null {
  if (typeof input !== "string") return null;
  const m = HEX.exec(input.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}
export const isHex = (s: unknown): s is string => parseHex(s) !== null;
const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 255);
/** #rrggbb (lower case). Out-of-range channels are clipped; NaN becomes 0. */
export function toHex(c: RGB | RGBA): string {
  const [r, g, b] = Array.isArray(c) ? c : [(c as RGBA).r, (c as RGBA).g, (c as RGBA).b];
  return "#" + [r, g, b].map((v) => to255(v).toString(16).padStart(2, "0")).join("");
}
/** Normalises any accepted hex form to #rrggbb, or returns null. Alpha is dropped. */
export function normalizeHex(input: unknown): string | null {
  const c = parseHex(input);
  return c ? toHex(c) : null;
}
export function hexToRgb(hex: string): RGB {
  const c = parseHex(hex);
  if (!c) throw new Error(`Invalid colour: ${String(hex)}`);
  return [c.r, c.g, c.b];
}
export const rgb255 = (hex: string): [number, number, number] => hexToRgb(hex).map((v) => Math.round(v * 255)) as [number, number, number];

// ---------- sRGB transfer (IEC 61966-2-1)
export const srgbToLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG 2.2 relative luminance of an opaque sRGB colour (unrounded). */
export function luminance(c: RGB | string): number {
  const [r, g, b] = typeof c === "string" ? hexToRgb(c) : c;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
/** WCAG contrast ratio (L1 + 0.05) / (L2 + 0.05), unrounded, 1..21. */
export function contrastRatio(a: RGB | string, b: RGB | string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Source-over compositing of a translucent colour onto an opaque backdrop, in gamma-encoded sRGB:
 * this is what browsers and design tools paint, so contrast is measured on the colour actually seen.
 */
export function composite(fg: RGBA, backdrop: RGB): RGB {
  const a = Math.min(1, Math.max(0, fg.a));
  return [fg.r * a + backdrop[0] * (1 - a), fg.g * a + backdrop[1] * (1 - a), fg.b * a + backdrop[2] * (1 - a)];
}

// ---------- perceptual spaces (culori)
export interface LCH { l: number; c: number; h: number }
export function hexToOklch(hex: string): LCH {
  const [r, g, b] = hexToRgb(hex);
  const o = oklch({ mode: "rgb", r, g, b }) as Oklch;
  return { l: o.l, c: o.c, h: Number.isFinite(o.h) ? (o.h as number) : 0 };
}
/** Is an OKLCH colour inside the sRGB gamut (with a tiny tolerance for rounding)? */
export function inSrgb(l: number, c: number, h: number): boolean {
  const rgb = oklchToRgbRaw(l, c, h);
  return rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}
function oklchToRgbRaw(l: number, c: number, h: number): RGB {
  const o = oklab({ mode: "oklch", l, c, h }) as { l: number; a: number; b: number };
  // OKLab -> linear sRGB (Ottosson 2020), then transfer
  const l_ = o.l + 0.3963377774 * o.a + 0.2158037573 * o.b;
  const m_ = o.l - 0.1055613458 * o.a - 0.0638541728 * o.b;
  const s_ = o.l - 0.0894841775 * o.a - 1.291485548 * o.b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  return lin.map((v) => Math.sign(v) * linearToSrgb(Math.abs(v))) as unknown as RGB;
}
/**
 * OKLCH -> #rrggbb. Out-of-gamut colours are mapped with the CSS Color 4 algorithm (chroma reduction at
 * constant lightness and hue), so the result is predictable: the same input always gives the same colour.
 */
export function oklchToHex(l: number, c: number, h: number): string {
  const L = Math.min(1, Math.max(0, l)), C = Math.max(0, c);
  if (inSrgb(L, C, h)) return toHex(oklchToRgbRaw(L, C, h));
  const m = mapToSrgb({ mode: "oklch", l: L, c: C, h }) as Rgb;
  return toHex([m.r, m.g, m.b]);
}

export interface HSL { h: number; s: number; l: number }
export function hexToHsl(hex: string): HSL {
  const [r, g, b] = hexToRgb(hex);
  const o = toHsl({ mode: "rgb", r, g, b });
  return { h: Number.isFinite(o.h) ? (o.h as number) : 0, s: o.s, l: o.l };
}
export function hslToHex(h: number, s: number, l: number): string {
  const rgb = toRgb({ mode: "hsl", h, s: Math.min(1, Math.max(0, s)), l: Math.min(1, Math.max(0, l)) });
  return toHex([rgb.r, rgb.g, rgb.b]);
}

/** CIEDE2000 colour difference between two opaque sRGB colours (D65). */
export function deltaE2000(a: string | RGB, b: string | RGB): number {
  const A = typeof a === "string" ? hexToRgb(a) : a, B = typeof b === "string" ? hexToRgb(b) : b;
  return ciede2000({ mode: "rgb", r: A[0], g: A[1], b: A[2] }, { mode: "rgb", r: B[0], g: B[1], b: B[2] });
}

/** Mix two colours in OKLab (perceptually even); t = 0 gives a, 1 gives b. */
export function mixOklab(a: string, b: string, t: number): string {
  const A = oklab({ mode: "rgb", ...rgbObj(a) }) as { l: number; a: number; b: number };
  const B = oklab({ mode: "rgb", ...rgbObj(b) }) as { l: number; a: number; b: number };
  const o = { mode: "oklab" as const, l: A.l + (B.l - A.l) * t, a: A.a + (B.a - A.a) * t, b: A.b + (B.b - A.b) * t };
  const r = toRgb(o);
  return toHex([r.r, r.g, r.b]);
}
const rgbObj = (hex: string) => { const [r, g, b] = hexToRgb(hex); return { r, g, b }; };

/** Text colours for display: "rgb(12 34 56)", "hsl(...)", "oklch(...)". */
export function formatRgb(hex: string): string { const [r, g, b] = rgb255(hex); return `rgb(${r} ${g} ${b})`; }
export function formatHsl(hex: string): string { const o = hexToHsl(hex); return `hsl(${Math.round(o.h)} ${Math.round(o.s * 100)}% ${Math.round(o.l * 100)}%)`; }
export function formatOklch(hex: string): string { const o = hexToOklch(hex); return `oklch(${(o.l * 100).toFixed(1)}% ${o.c.toFixed(3)} ${o.c < 1e-4 ? 0 : o.h.toFixed(1)})`; }

/** Hue family used by the library filter (OKLCH hue; low chroma is neutral). */
export type HueFamily = "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink" | "neutral";
export const HUE_FAMILIES: HueFamily[] = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "neutral"];
export function hueFamily(hex: string): HueFamily {
  const { l, c, h } = hexToOklch(hex);
  if (c < 0.035 || l < 0.12 || (l > 0.97 && c < 0.06)) return "neutral";
  if (h >= 330 || h < 15 || (h < 60 && l > 0.8 && c < 0.12)) return "pink";
  if (h < 45) return "red";
  if (h < 75) return "orange";
  if (h < 110) return "yellow";
  if (h < 165) return "green";
  if (h < 215) return "teal";
  if (h < 285) return "blue";
  return "purple";
}
