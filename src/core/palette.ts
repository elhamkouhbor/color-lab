// The editable palette, its semantic roles and the resolved "paint" the design previews use.
import { contrastRatio, deltaE2000, hexToOklch, mixOklab, normalizeHex } from "./color";
import { simulateHex, type Vision } from "./cvd";

export interface Swatch { hex: string; name?: string; locked?: boolean }
export interface Palette { name: string; colors: Swatch[]; sourceId?: string }

export type Role = "background" | "foreground" | "surface" | "primary" | "secondary" | "buttonText" | "border";
export const ROLES: Role[] = ["background", "foreground", "surface", "primary", "secondary", "buttonText", "border"];
// English labels (translated with t() in the UI)
export const ROLE_LABEL: Record<Role, string> = {
  background: "Background", foreground: "Foreground", surface: "Surface", primary: "Primary accent",
  secondary: "Secondary accent", buttonText: "Button text", border: "Borders",
};
/** "auto" or the index of a palette colour. */
export type RoleRef = "auto" | number;
export type Roles = Record<Role, RoleRef>;
export const AUTO_ROLES: Roles = { background: "auto", foreground: "auto", surface: "auto", primary: "auto", secondary: "auto", buttonText: "auto", border: "auto" };

export interface ResolvedRole { hex: string; index: number | null; derived: boolean }
export type Resolved = Record<Role, ResolvedRole>;

const L = (hex: string) => hexToOklch(hex).l;
const C = (hex: string) => hexToOklch(hex).c;

/**
 * Resolves every role to a colour. "auto" picks from the palette with simple, documented rules:
 *  background = lightest colour (darkest when `dark`), foreground = best contrast with the background,
 *  primary/secondary = the most chromatic remaining colours (distinct hues preferred),
 *  button text = palette colour, white or black with the best contrast on the primary accent,
 *  surface and borders = derived mixes of background and foreground when not assigned.
 */
export function resolveRoles(palette: Palette, roles: Roles, dark = false): Resolved {
  const hexes = palette.colors.map((s) => s.hex);
  const valid = (r: RoleRef) => typeof r === "number" && r >= 0 && r < hexes.length;
  const pick = (r: RoleRef, fallback: () => ResolvedRole): ResolvedRole => (valid(r) ? { hex: hexes[r as number], index: r as number, derived: false } : fallback());
  const fromIndex = (i: number): ResolvedRole => ({ hex: hexes[i], index: i, derived: false });
  const derivedHex = (hex: string): ResolvedRole => ({ hex, index: null, derived: true });
  if (!hexes.length) {
    const bg = dark ? "#16181d" : "#ffffff", fg = dark ? "#f4f4f5" : "#15171c";
    return { background: derivedHex(bg), foreground: derivedHex(fg), surface: derivedHex(mixOklab(bg, fg, 0.05)), primary: derivedHex(fg), secondary: derivedHex(fg), buttonText: derivedHex(bg), border: derivedHex(mixOklab(bg, fg, 0.18)) };
  }
  const order = hexes.map((_, i) => i).sort((a, b) => (dark ? L(hexes[a]) - L(hexes[b]) : L(hexes[b]) - L(hexes[a])) || a - b);
  // a page background has to be quiet: when the palette has no light (or, in the dark arrangement, no
  // dark) colour, use a derived paper tone mixed from its lightest (darkest) colour
  const background = pick(roles.background, () => {
    const h = hexes[order[0]], l = L(h);
    if (dark ? l <= 0.32 : l >= 0.86) return fromIndex(order[0]);
    return derivedHex(dark ? mixOklab(h, "#0d0e10", 0.82) : mixOklab(h, "#ffffff", 0.86));
  });
  const foreground = pick(roles.foreground, () => {
    let best = -1, bestR = -1;
    hexes.forEach((h, i) => { const r = contrastRatio(h, background.hex); if (i !== background.index && r > bestR) { best = i; bestR = r; } });
    if (best < 0 || bestR < 4.5) {
      const bw = contrastRatio("#000000", background.hex) >= contrastRatio("#ffffff", background.hex) ? "#14161a" : "#fafafa";
      return best >= 0 && bestR >= contrastRatio(bw, background.hex) ? fromIndex(best) : derivedHex(bw);
    }
    return fromIndex(best);
  });
  const used = new Set([background.index, foreground.index].filter((x): x is number => x !== null));
  const byChroma = hexes.map((_, i) => i).filter((i) => !used.has(i)).sort((a, b) => C(hexes[b]) - C(hexes[a]) || a - b);
  const primary = pick(roles.primary, () => (byChroma.length ? fromIndex(byChroma[0]) : foreground));
  const secondary = pick(roles.secondary, () => {
    const rest = byChroma.filter((i) => i !== primary.index);
    if (!rest.length) return derivedHex(mixOklab(primary.hex, background.hex, 0.55));
    const ph = hexToOklch(primary.hex).h;
    const far = rest.find((i) => { const d = Math.abs(hexToOklch(hexes[i]).h - ph) % 360; return Math.min(d, 360 - d) > 40; });
    return fromIndex(far ?? rest[0]);
  });
  const buttonText = pick(roles.buttonText, () => {
    const options: ResolvedRole[] = [...hexes.map((_, i) => fromIndex(i)).filter((r) => r.index !== primary.index), derivedHex("#ffffff"), derivedHex("#000000")];
    return options.sort((a, b) => contrastRatio(b.hex, primary.hex) - contrastRatio(a.hex, primary.hex) || (a.derived ? 1 : 0) - (b.derived ? 1 : 0))[0];
  });
  const surface = pick(roles.surface, () => derivedHex(mixOklab(background.hex, foreground.hex, 0.045)));
  const border = pick(roles.border, () => derivedHex(mixOklab(background.hex, foreground.hex, 0.2)));
  return { background, foreground, surface, primary, secondary, buttonText, border };
}

/** Everything a preview paints. Built from ORIGINAL colours, then (optionally) simulated as a whole. */
export interface Paint {
  bg: string; fg: string; surface: string; primary: string; secondary: string; onPrimary: string; border: string;
  muted: string; faint: string; primarySoft: string; secondarySoft: string;
  series: string[];      // all palette colours in order (charts, editorial forms)
  /** palette colours that stand out from the background (chosen on the ORIGINAL colours) */
  accents: string[];
  /** palette colours from darkest to lightest (ordered on the ORIGINAL colours) */
  byLightness: string[];
  /** byLightness without colours too close to the background (for layered forms) */
  bands: string[];
  success: string; warning: string; danger: string; successSoft: string; warningSoft: string; dangerSoft: string;
  /** which status colours came from the palette (false = standard fallback) */
  statusFromPalette: { success: boolean; warning: boolean; danger: boolean };
  simulated: boolean;
}
/** Picks the palette colour closest to a hue (OKLCH degrees) with some chroma, or null. */
export function closestHue(hexes: string[], hue: number, maxDistance = 40): number | null {
  let best: number | null = null, bestD = maxDistance;
  hexes.forEach((h, i) => {
    const o = hexToOklch(h);
    if (o.c < 0.06 || o.l < 0.25 || o.l > 0.9) return;
    const d = Math.abs(o.h - hue) % 360, dist = Math.min(d, 360 - d);
    if (dist < bestD) { best = i; bestD = dist; }
  });
  return best;
}
const STATUS = { success: { hue: 145, fallback: "#2e7d4f" }, warning: { hue: 75, fallback: "#a66a00" }, danger: { hue: 27, fallback: "#c0352b" } } as const;
export function paintFor(palette: Palette, resolved: Resolved, vision: Vision | null): Paint {
  const r = resolved;
  const base = {
    bg: r.background.hex, fg: r.foreground.hex, surface: r.surface.hex, primary: r.primary.hex, secondary: r.secondary.hex,
    onPrimary: r.buttonText.hex, border: r.border.hex,
    muted: mixOklab(r.foreground.hex, r.background.hex, 0.32),
    faint: mixOklab(r.foreground.hex, r.background.hex, 0.55),
    primarySoft: mixOklab(r.primary.hex, r.background.hex, 0.82),
    secondarySoft: mixOklab(r.secondary.hex, r.background.hex, 0.78),
  };
  const series = palette.colors.map((s) => s.hex);
  const status = (k: keyof typeof STATUS) => { const i = closestHue(series, STATUS[k].hue); return i === null ? { hex: STATUS[k].fallback, ok: false } : { hex: series[i], ok: true }; };
  const su = status("success"), wa = status("warning"), da = status("danger");
  const st = {
    success: su.hex, warning: wa.hex, danger: da.hex,
    successSoft: mixOklab(su.hex, r.background.hex, 0.86), warningSoft: mixOklab(wa.hex, r.background.hex, 0.86), dangerSoft: mixOklab(da.hex, r.background.hex, 0.86),
  };
  const statusFromPalette = { success: su.ok, warning: wa.ok, danger: da.ok };
  // decided on the original colours, so the original and simulated previews have the same layout
  let accents = series.filter((h) => deltaE2000(h, r.background.hex) > 12);
  if (!accents.length) accents = [r.primary.hex, r.secondary.hex, r.foreground.hex];
  const byLightness = [...series].sort((a, b) => hexToOklch(a).l - hexToOklch(b).l);
  let bands = byLightness.filter((h) => deltaE2000(h, r.background.hex) > 12);
  if (!bands.length) bands = [r.foreground.hex, r.primary.hex];
  if (!vision) return { ...base, ...st, series, accents, byLightness, bands, statusFromPalette, simulated: false };
  const s = (h: string) => simulateHex(h, vision);
  return {
    bg: s(base.bg), fg: s(base.fg), surface: s(base.surface), primary: s(base.primary), secondary: s(base.secondary),
    onPrimary: s(base.onPrimary), border: s(base.border), muted: s(base.muted), faint: s(base.faint),
    primarySoft: s(base.primarySoft), secondarySoft: s(base.secondarySoft), series: series.map(s), accents: accents.map(s), byLightness: byLightness.map(s), bands: bands.map(s),
    success: s(st.success), warning: s(st.warning), danger: s(st.danger), successSoft: s(st.successSoft), warningSoft: s(st.warningSoft), dangerSoft: s(st.dangerSoft),
    statusFromPalette, simulated: true,
  };
}

/** Validates and normalises an untrusted palette (project files, storage). */
export function sanitizePalette(input: unknown): Palette | null {
  if (!input || typeof input !== "object") return null;
  const p = input as { name?: unknown; colors?: unknown; sourceId?: unknown };
  if (!Array.isArray(p.colors)) return null;
  const colors: Swatch[] = [];
  for (const c of p.colors.slice(0, 24)) {
    const raw = typeof c === "string" ? c : c && typeof c === "object" ? (c as { hex?: unknown }).hex : null;
    const hex = normalizeHex(raw);
    if (!hex) continue;
    const o = typeof c === "object" && c ? (c as { name?: unknown; locked?: unknown }) : {};
    colors.push({ hex, ...(typeof o.name === "string" && o.name ? { name: o.name.slice(0, 60) } : {}), ...(o.locked === true ? { locked: true } : {}) });
  }
  if (!colors.length) return null;
  return { name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 80) : "Untitled palette", colors, ...(typeof p.sourceId === "string" ? { sourceId: p.sourceId.slice(0, 120) } : {}) };
}
export function sanitizeRoles(input: unknown, n: number): Roles {
  const out: Roles = { ...AUTO_ROLES };
  if (input && typeof input === "object") {
    for (const r of ROLES) {
      const v = (input as Record<string, unknown>)[r];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n) out[r] = v;
    }
  }
  return out;
}
export const MAX_COLORS = 16;
