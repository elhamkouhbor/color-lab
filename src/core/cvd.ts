// Colour-vision deficiency simulation. ONE implementation is used by every view: swatches, palette,
// contrast lab, the three design previews, exports and the image tool all call simulateHex / cvdMatrix.
//
// Model: Machado, Oliveira & Fernandes (2009), doi:10.1109/TVCG.2009.113.
//  1. decode gamma-encoded sRGB to linear light (IEC 61966-2-1)
//  2. multiply by the published 3x3 matrix for the deficiency and severity
//     (between the published 0.1 steps the matrix is interpolated linearly, as in colorspacious)
//  3. clip each linear channel to [0, 1] (the result can leave the sRGB gamut) and re-encode
// Achromatopsia is approximated as luminance-only vision (Y of linear sRGB). It is a simplification:
// real achromatopsia also involves light sensitivity and reduced acuity, which no colour transform shows.
import { MACHADO, type Mat3 } from "./machado";
import { hexToRgb, isHex, linearToSrgb, srgbToLinear, toHex, type RGB } from "./color";

export type CvdType = "normal" | "protan" | "deutan" | "tritan" | "achroma";
export const CVD_TYPES: CvdType[] = ["normal", "protan", "deutan", "tritan", "achroma"];
export interface Vision { type: CvdType; severity: number }
export const NORMAL: Vision = { type: "normal", severity: 1 };
/** Types where a severity (anomalous trichromacy) is supported by the model. */
export const hasSeverity = (t: CvdType) => t === "protan" || t === "deutan" || t === "tritan";

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ACHROMA: Mat3 = [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722];

const clampSeverity = (s: number) => (Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : 1);

/** The linear-RGB matrix for a vision setting. Unknown types and invalid severities fall back safely. */
export function cvdMatrix(v: Vision): Mat3 {
  if (v.type === "achroma") return ACHROMA;
  if (!hasSeverity(v.type)) return IDENTITY;
  const table = MACHADO[v.type as "protan" | "deutan" | "tritan"];
  const s = clampSeverity(v.severity) * 10;
  const lo = Math.floor(s), hi = Math.min(10, lo + 1), f = s - lo;
  if (f < 1e-9 || lo === 10) return table[lo];
  const a = table[lo], b = table[hi];
  return a.map((x, i) => x * (1 - f) + b[i] * f) as unknown as Mat3;
}

/** True when the setting changes nothing (normal vision, or severity 0). */
export const isIdentity = (v: Vision) => v.type === "normal" || (hasSeverity(v.type) && clampSeverity(v.severity) === 0);

const clip01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);

/** Simulates one gamma-encoded sRGB colour (channels 0..1). */
export function simulateRgb(rgb: RGB, v: Vision, m: Mat3 = cvdMatrix(v)): RGB {
  if (isIdentity(v)) return rgb;
  const r = srgbToLinear(clip01(rgb[0])), g = srgbToLinear(clip01(rgb[1])), b = srgbToLinear(clip01(rgb[2]));
  return [
    linearToSrgb(clip01(m[0] * r + m[1] * g + m[2] * b)),
    linearToSrgb(clip01(m[3] * r + m[4] * g + m[5] * b)),
    linearToSrgb(clip01(m[6] * r + m[7] * g + m[8] * b)),
  ];
}

const cache = new Map<string, string>();
/** Simulates a hex colour and returns #rrggbb. Invalid input is returned unchanged (never throws). */
export function simulateHex(hex: string, v: Vision): string {
  if (!isHex(hex)) return hex;
  if (isIdentity(v)) return toHex(hexToRgb(hex));
  const key = `${hex}|${v.type}|${clampSeverity(v.severity)}`;
  let out = cache.get(key);
  if (out === undefined) {
    out = toHex(simulateRgb(hexToRgb(hex), v));
    if (cache.size > 20000) cache.clear();
    cache.set(key, out);
  }
  return out;
}

// ---------- images (shared by the worker and the tests)
let decodeLut: Float32Array | null = null;
let encodeLut: Uint8Array | null = null;
const ENCODE_STEPS = 65535;
/** 8-bit sRGB -> linear, and linear -> 8-bit sRGB (65 536 steps, well below half an 8-bit step of error). */
export function luts() {
  if (!decodeLut) {
    decodeLut = new Float32Array(256);
    for (let i = 0; i < 256; i++) decodeLut[i] = srgbToLinear(i / 255);
    encodeLut = new Uint8Array(ENCODE_STEPS + 1);
    for (let i = 0; i <= ENCODE_STEPS; i++) encodeLut[i] = Math.round(linearToSrgb(i / ENCODE_STEPS) * 255);
  }
  return { decode: decodeLut, encode: encodeLut! };
}
/**
 * Simulates RGBA pixels in place (alpha is kept). Processes `start`..`end` pixel indices so callers
 * can work in chunks without blocking.
 */
export function simulatePixels(data: Uint8ClampedArray | Uint8Array, m: Mat3, start = 0, end = data.length / 4) {
  const { decode, encode } = luts();
  const enc = (x: number) => encode[x <= 0 ? 0 : x >= 1 ? ENCODE_STEPS : (x * ENCODE_STEPS + 0.5) | 0];
  for (let p = start * 4, stop = end * 4; p < stop; p += 4) {
    const r = decode[data[p]], g = decode[data[p + 1]], b = decode[data[p + 2]];
    data[p] = enc(m[0] * r + m[1] * g + m[2] * b);
    data[p + 1] = enc(m[3] * r + m[4] * g + m[5] * b);
    data[p + 2] = enc(m[6] * r + m[7] * g + m[8] * b);
  }
}
