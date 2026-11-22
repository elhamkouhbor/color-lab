// WCAG 2.2 contrast checks (SC 1.4.3, 1.4.6, 1.4.11). Pass/fail always uses the UNROUNDED ratio.
import { composite, contrastRatio, deltaE2000, hexToOklch, normalizeHex, oklchToHex, parseHex, type RGB, hexToRgb, toHex } from "./color";

export type CheckId = "aa-normal" | "aa-large" | "aaa-normal" | "aaa-large" | "non-text";
export interface Check { id: CheckId; label: string; criterion: string; threshold: number }
// Labels are English data; the UI translates them with t().
export const CHECKS: Check[] = [
  { id: "aa-normal", label: "Normal text AA", criterion: "1.4.3", threshold: 4.5 },
  { id: "aa-large", label: "Large text AA", criterion: "1.4.3", threshold: 3 },
  { id: "aaa-normal", label: "Normal text AAA", criterion: "1.4.6", threshold: 7 },
  { id: "aaa-large", label: "Large text AAA", criterion: "1.4.6", threshold: 4.5 },
  { id: "non-text", label: "Interface components and graphics", criterion: "1.4.11", threshold: 3 },
];
export const passes = (ratio: number, threshold: number) => ratio >= threshold;

/** Display value: truncated (not rounded) to 2 decimals, so a failing 4.499 never reads as 4.50. */
export function formatRatio(r: number): string {
  return `${(Math.floor(r * 100 + 1e-9) / 100).toFixed(2)}:1`;
}

export interface PairInput {
  fg: string;          // #rrggbb or #rrggbbaa
  bg: string;          // #rrggbb or #rrggbbaa
  base?: string;       // opaque backdrop behind a translucent background (default white)
}
export interface PairResult {
  ratio: number;
  fgSeen: string;      // composited, opaque colours actually measured
  bgSeen: string;
  results: { check: Check; pass: boolean }[];
}
/**
 * Contrast of a (possibly translucent) foreground on a (possibly translucent) background.
 * The background is first composited over `base`, then the foreground over that result.
 */
export function evaluatePair({ fg, bg, base = "#ffffff" }: PairInput): PairResult {
  const F = parseHex(fg), B = parseHex(bg), BASE = parseHex(base);
  if (!F || !B || !BASE) throw new Error("Invalid colour");
  const baseRgb: RGB = [BASE.r, BASE.g, BASE.b];
  const bgSeen = composite(B, baseRgb);
  const fgSeen = composite(F, bgSeen);
  const ratio = contrastRatio(fgSeen, bgSeen);
  return { ratio, fgSeen: toHex(fgSeen), bgSeen: toHex(bgSeen), results: CHECKS.map((check) => ({ check, pass: passes(ratio, check.threshold) })) };
}

/** All ordered pairs of a palette (opaque colours); the matrix is symmetric. */
export function contrastMatrix(colors: string[]): number[][] {
  return colors.map((a) => colors.map((b) => contrastRatio(a, b)));
}

export interface Suggestion { hex: string; ratio: number; deltaE: number; direction: "lighter" | "darker" }
/**
 * Finds the closest colour to `adjust` (same OKLCH hue and chroma, lightness changed in steps of 0.001,
 * out-of-gamut colours mapped with the CSS Color 4 method) that reaches `target` against `fixed`.
 * Deterministic: the same inputs always give the same suggestion. Returns null if no lightness works.
 * Both colours are opaque here; callers composite translucent colours first.
 */
export function suggestContrast(adjust: string, fixed: string, target: number): Suggestion | null {
  const a = normalizeHex(adjust), f = normalizeHex(fixed);
  if (!a || !f) return null;
  if (contrastRatio(a, f) >= target) return { hex: a, ratio: contrastRatio(a, f), deltaE: 0, direction: "lighter" };
  const { l, c, h } = hexToOklch(a);
  const found: Suggestion[] = [];
  for (const dir of [1, -1] as const) {
    for (let step = 1; step <= 1000; step++) {
      const L = l + dir * step * 0.001;
      if (L < 0 || L > 1) break;
      const hex = oklchToHex(L, c, h);
      const ratio = contrastRatio(hex, f);
      if (ratio >= target) { found.push({ hex, ratio, deltaE: deltaE2000(a, hex), direction: dir > 0 ? "lighter" : "darker" }); break; }
    }
    // the extremes (white / black) are always worth trying if the hue-preserving walk fell short
    if (!found.some((s) => s.direction === (dir > 0 ? "lighter" : "darker"))) {
      const hex = dir > 0 ? "#ffffff" : "#000000";
      const ratio = contrastRatio(hex, f);
      if (ratio >= target) found.push({ hex, ratio, deltaE: deltaE2000(a, hex), direction: dir > 0 ? "lighter" : "darker" });
    }
  }
  if (!found.length) return null;
  return found.sort((x, y) => x.deltaE - y.deltaE || x.hex.localeCompare(y.hex))[0];
}

/** Keeps the alpha byte of `withAlpha` (if any) on an opaque replacement colour. */
export function keepAlpha(withAlpha: string, opaque: string): string {
  const c = parseHex(withAlpha);
  if (!c || c.a >= 1) return opaque;
  return opaque + Math.round(c.a * 255).toString(16).padStart(2, "0");
}
export const opaquePart = (hex: string) => toHex(hexToRgb(hex));
