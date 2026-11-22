// Colour relationships and deterministic variations, computed in OKLCH (perceptually even hue and
// lightness). Results are mapped into sRGB with the CSS Color 4 method. These are geometric
// relationships on the hue circle: they are starting points, not a promise of a good or accessible
// palette.
import { hexToOklch, oklchToHex } from "./color";

export type Relation = "complementary" | "analogous" | "triadic" | "split" | "tetradic" | "monochromatic";
export const RELATIONS: Relation[] = ["complementary", "analogous", "triadic", "split", "tetradic", "monochromatic"];

const wrap = (h: number) => ((h % 360) + 360) % 360;

/** Colours related to `base` (base first). */
export function relation(base: string, kind: Relation): string[] {
  const { l, c, h } = hexToOklch(base);
  const at = (dh: number, dl = 0, k = 1) => oklchToHex(l + dl, c * k, wrap(h + dh));
  switch (kind) {
    case "complementary": return [base, at(180)];
    case "analogous": return [at(-30), base, at(30)];
    case "triadic": return [base, at(120), at(240)];
    case "split": return [base, at(150), at(210)];
    case "tetradic": return [base, at(90), at(180), at(270)];
    case "monochromatic": {
      // five lightness steps around the base, chroma eased off towards the extremes
      const steps = [0.95, 0.82, l, 0.42, 0.26];
      return steps.map((L, i) => (i === 2 ? base : oklchToHex(L, c * (1 - Math.abs(L - l) * 0.6), h)));
    }
  }
}

/** Tints and shades of one colour: 9 lightness steps at the same hue and chroma (gamut mapped). */
export function scale(base: string, steps = 9): string[] {
  const { c, h } = hexToOklch(base);
  return Array.from({ length: steps }, (_, i) => oklchToHex(0.97 - (i / (steps - 1)) * 0.8, c, h));
}

/** mulberry32: small, fast, deterministic PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deterministic variation: every unlocked colour moves a little in lightness, chroma and hue.
 * The same seed always gives the same result, so a variation can be found again.
 */
export function vary(colors: string[], locked: boolean[], seed: number, amount = 1): string[] {
  const r = rng(seed);
  return colors.map((hex, i) => {
    const d = [r(), r(), r()]; // drawn for every colour so locks do not shift the sequence
    if (locked[i]) return hex;
    const { l, c, h } = hexToOklch(hex);
    const dl = (d[0] - 0.5) * 0.16 * amount, dc = (d[1] - 0.5) * 0.06 * amount, dh = (d[2] - 0.5) * 40 * amount;
    return oklchToHex(Math.min(0.98, Math.max(0.08, l + dl)), Math.max(0, c + dc), wrap(h + dh));
  });
}
