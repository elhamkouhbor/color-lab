// Exporters. Every palette export takes the ORIGINAL document only: none of these functions accepts a
// vision setting, so a simulation can never leak into exported palette values. The comparison sheet
// is the only export with simulated colours, and labels every simulated row as such.
import { formatHsl, formatOklch, hexToOklch, rgb255 } from "./color";
import { CHECKS, contrastMatrix, formatRatio, passes } from "./contrast";
import { simulateHex, type Vision } from "./cvd";
import { resolveRoles, ROLE_LABEL, ROLES, type Role } from "./palette";
import type { Doc } from "./project";

export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "palette";
const kebab = (r: Role) => r.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function exportHex(doc: Doc): string {
  return doc.palette.colors.map((c) => c.hex.toUpperCase()).join("\n") + "\n";
}

export function exportCss(doc: Doc): string {
  const r = resolveRoles(doc.palette, doc.roles, doc.dark);
  const lines = [`/* ${doc.palette.name.replace(/\*\//g, "")} (Color Lab) */`, ":root {"];
  doc.palette.colors.forEach((c, i) => lines.push(`  --color-${i + 1}: ${c.hex};${c.name ? ` /* ${c.name.replace(/\*\//g, "")} */` : ""}`));
  lines.push("");
  for (const role of ROLES) lines.push(`  --${kebab(role)}: ${r[role].hex};${r[role].derived ? " /* derived */" : ""}`);
  lines.push("}", "");
  return lines.join("\n");
}

export function exportJson(doc: Doc): string {
  const r = resolveRoles(doc.palette, doc.roles, doc.dark);
  return JSON.stringify({
    name: doc.palette.name,
    ...(doc.palette.sourceId ? { source: doc.palette.sourceId } : {}),
    colors: doc.palette.colors.map((c) => {
      const o = hexToOklch(c.hex);
      const [R, G, B] = rgb255(c.hex);
      return { hex: c.hex, ...(c.name ? { name: c.name } : {}), rgb: [R, G, B], hsl: formatHsl(c.hex), oklch: { l: +o.l.toFixed(4), c: +o.c.toFixed(4), h: +o.h.toFixed(2) } };
    }),
    roles: Object.fromEntries(ROLES.map((role) => [role, { hex: r[role].hex, ...(r[role].index !== null ? { color: r[role].index! + 1 } : { derived: true }) }])),
  }, null, 2) + "\n";
}

/** Design tokens in the W3C Design Tokens Community Group format. */
export function exportTokens(doc: Doc): string {
  const r = resolveRoles(doc.palette, doc.roles, doc.dark);
  const palette: Record<string, unknown> = {};
  doc.palette.colors.forEach((c, i) => { palette[String(i + 1)] = { $type: "color", $value: c.hex, ...(c.name ? { $description: c.name } : {}) }; });
  const semantic: Record<string, unknown> = {};
  for (const role of ROLES) semantic[kebab(role)] = { $type: "color", $value: r[role].index !== null ? `{color.palette.${r[role].index! + 1}}` : r[role].hex, ...(r[role].derived ? { $description: "derived" } : {}) };
  return JSON.stringify({ color: { palette, semantic } }, null, 2) + "\n";
}

// ---------- swatch sheets (SVG; the PNG export rasterises the same SVG)
const FONT = "font-family=\"Manrope, ui-sans-serif, system-ui, sans-serif\"";
const ink = (hex: string) => (hexToOklch(hex).l > 0.62 ? "#15171c" : "#ffffff");

export function exportSvgSheet(doc: Doc): string {
  const cols = doc.palette.colors;
  const n = cols.length, w = 160, gap = 16, pad = 40, H = 300;
  const W = pad * 2 + n * w + (n - 1) * gap;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 120}" viewBox="0 0 ${W} ${H + 120}">`,
    `<rect width="100%" height="100%" fill="#fbfaf8"/>`,
    `<text x="${pad}" y="${pad + 8}" ${FONT} font-size="20" font-weight="700" fill="#15171c">${xml(doc.palette.name)}</text>`];
  cols.forEach((c, i) => {
    const x = pad + i * (w + gap), y = pad + 32;
    const [R, G, B] = rgb255(c.hex);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${H - 80}" rx="10" fill="${c.hex}"/>`);
    parts.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${H - 81}" rx="10" fill="none" stroke="#000" stroke-opacity=".08"/>`);
    parts.push(`<text x="${x + 12}" y="${y + H - 104}" ${FONT} font-size="12" fill="${ink(c.hex)}">${i + 1}</text>`);
    parts.push(`<text x="${x}" y="${y + H - 54}" ${FONT} font-size="15" font-weight="700" fill="#15171c">${c.hex.toUpperCase()}</text>`);
    parts.push(`<text x="${x}" y="${y + H - 34}" ${FONT} font-size="11.5" fill="#4a5160">RGB ${R} ${G} ${B}</text>`);
    parts.push(`<text x="${x}" y="${y + H - 18}" ${FONT} font-size="11.5" fill="#4a5160">${xml(formatOklch(c.hex))}</text>`);
    if (c.name) parts.push(`<text x="${x}" y="${y + H - 2}" ${FONT} font-size="11.5" fill="#7b8292">${xml(c.name.slice(0, 22))}</text>`);
  });
  parts.push(`<text x="${pad}" y="${H + 96}" ${FONT} font-size="11" fill="#7b8292">Original colours. Color Lab by Elham Kouhbor</text>`, "</svg>");
  return parts.join("\n");
}

export interface ComparisonRow { label: string; vision: Vision | null }
/** Original palette plus labelled simulated rows. Simulated rows show "seen as" values, not palette colours. */
export function exportComparisonSvg(doc: Doc, rows: ComparisonRow[]): string {
  const cols = doc.palette.colors.map((c) => c.hex);
  const n = cols.length, w = 120, gap = 10, pad = 40, rowH = 150, labelW = 220;
  const W = pad * 2 + labelW + n * w + (n - 1) * gap, H = pad * 2 + 60 + rows.length * rowH + 40;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`, `<rect width="100%" height="100%" fill="#fbfaf8"/>`,
    `<text x="${pad}" y="${pad + 10}" ${FONT} font-size="20" font-weight="700" fill="#15171c">${xml(doc.palette.name)}: colour vision comparison</text>`,
    `<text x="${pad}" y="${pad + 34}" ${FONT} font-size="12" fill="#4a5160">Simulated rows are approximations (Machado, Oliveira and Fernandes 2009). They are not palette colours and not a diagnosis.</text>`];
  rows.forEach((row, r) => {
    const y = pad + 60 + r * rowH;
    parts.push(`<text x="${pad}" y="${y + 40}" ${FONT} font-size="14" font-weight="700" fill="#15171c">${xml(row.label)}</text>`);
    parts.push(`<text x="${pad}" y="${y + 60}" ${FONT} font-size="11.5" fill="#7b8292">${row.vision ? "Simulated" : "Original colours"}</text>`);
    cols.forEach((hex, i) => {
      const seen = row.vision ? simulateHex(hex, row.vision) : hex;
      const x = pad + labelW + i * (w + gap);
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${rowH - 50}" rx="8" fill="${seen}"/>`);
      parts.push(`<text x="${x}" y="${y + rowH - 32}" ${FONT} font-size="12" font-weight="600" fill="#15171c">${row.vision ? "seen as " : ""}${seen.toUpperCase()}</text>`);
    });
  });
  parts.push(`<text x="${pad}" y="${H - pad + 10}" ${FONT} font-size="11" fill="#7b8292">Color Lab by Elham Kouhbor</text>`, "</svg>");
  return parts.join("\n");
}

/** A plain-text (Markdown) contrast report for the palette and its semantic roles. */
export function exportContrastReport(doc: Doc, date = new Date()): string {
  const cols = doc.palette.colors.map((c) => c.hex);
  const r = resolveRoles(doc.palette, doc.roles, doc.dark);
  const m = contrastMatrix(cols);
  const yes = (b: boolean) => (b ? "pass" : "fail");
  const out = [`# Contrast report: ${doc.palette.name}`, "", `Generated by Color Lab on ${date.toISOString().slice(0, 10)}. WCAG 2.2 contrast ratios (sRGB relative luminance). Pass or fail uses the unrounded ratio. Ratios are shown truncated to two decimals.`, "",
    "Thresholds: normal text AA 4.5:1, large text AA 3:1, normal text AAA 7:1, large text AAA 4.5:1, interface components and graphics 3:1 (SC 1.4.11).", "",
    "## Semantic pairs", "", "| Pair | Colours | Ratio | Normal AA | Large AA | Normal AAA | Large AAA | Non-text 3:1 |", "|---|---|---|---|---|---|---|---|"];
  const pairs: [string, Role, Role][] = [["Text on background", "foreground", "background"], ["Text on surface", "foreground", "surface"], ["Button text on primary", "buttonText", "primary"], ["Primary on background", "primary", "background"], ["Secondary on background", "secondary", "background"], ["Borders on background", "border", "background"]];
  for (const [label, a, b] of pairs) {
    const rr = contrastMatrix([r[a].hex, r[b].hex])[0][1];
    out.push(`| ${label} (${ROLE_LABEL[a]} / ${ROLE_LABEL[b]}) | ${r[a].hex} on ${r[b].hex} | ${formatRatio(rr)} | ${CHECKS.map((c) => yes(passes(rr, c.threshold))).join(" | ")} |`);
  }
  out.push("", "## All palette pairs", "", "| Foreground | Background | Ratio | Normal AA | Large AA | Normal AAA | Large AAA | Non-text 3:1 |", "|---|---|---|---|---|---|---|---|");
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
    out.push(`| ${i + 1} ${cols[i]} | ${j + 1} ${cols[j]} | ${formatRatio(m[i][j])} | ${CHECKS.map((c) => yes(passes(m[i][j], c.threshold))).join(" | ")} |`);
  }
  out.push("", "Passing a contrast check does not make a design accessible on its own. Text size, weight, focus states, colour-only information and real content all need review.", "");
  return out.join("\n");
}
