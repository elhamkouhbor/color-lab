// Core tests: colour maths, WCAG contrast, colour-vision simulation, palettes, projects, exports, library.
// Run with `npm test` (esbuild bundle + Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import reference from "./reference/cvd-colorspacious.json";
import {
  composite, contrastRatio, deltaE2000, hexToHsl, hexToOklch, hexToRgb, hueFamily, inSrgb, isHex, linearToSrgb, luminance,
  mixOklab, normalizeHex, oklchToHex, parseHex, srgbToLinear, toHex,
} from "../src/core/color";
import { CHECKS, contrastMatrix, evaluatePair, formatRatio, passes, suggestContrast } from "../src/core/contrast";
import { cvdMatrix, IDENTITY, isIdentity, simulateHex, simulatePixels, simulateRgb, type CvdType, type Vision } from "../src/core/cvd";
import { MACHADO } from "../src/core/machado";
import { confusablePairs } from "../src/core/distinguish";
import { relation, vary, scale } from "../src/core/harmony";
import { AUTO_ROLES, paintFor, resolveRoles, sanitizePalette, type Palette } from "../src/core/palette";
import { commit, initHistory, makeDoc, moveColor, parseProject, redo, removeColor, serializeProject, undo } from "../src/core/project";
import { exportComparisonSvg, exportContrastReport, exportCss, exportHex, exportJson, exportSvgSheet, exportTokens } from "../src/core/export";
import { BY_ID, COLLECTIONS, filterPalettes, NO_FILTER, PALETTES } from "../src/data/library";

const close = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} expected ${b}, got ${a} (eps ${eps})`);

// ---------------------------------------------------------------- colour basics
test("hex parsing accepts 3/4/6/8 digits and rejects everything else", () => {
  assert.deepEqual(parseHex("#fff"), { r: 1, g: 1, b: 1, a: 1 });
  assert.equal(normalizeHex("ABC"), "#aabbcc");
  assert.equal(parseHex("#00000080")!.a, 128 / 255);
  for (const bad of ["", "#12", "#12345", "red", "#ggg", null, undefined, 42, "#1234567"]) assert.equal(parseHex(bad), null, String(bad));
  assert.equal(isHex("#123456"), true);
  assert.throws(() => hexToRgb("nope"));
});

test("sRGB transfer functions follow IEC 61966-2-1 and invert each other", () => {
  close(srgbToLinear(0.5), 0.21404114048223255, 1e-12);
  close(srgbToLinear(0.04045), 0.04045 / 12.92, 1e-15);
  close(linearToSrgb(0.0031308), 0.0031308 * 12.92, 1e-12);
  for (let i = 0; i <= 255; i++) close(linearToSrgb(srgbToLinear(i / 255)), i / 255, 1e-12);
  // WCAG 2.0 printed 0.03928 as the threshold; no 8-bit value lies between 0.03928 and 0.04045
  for (let i = 0; i <= 255; i++) { const v = i / 255; assert.equal(v <= 0.03928, v <= 0.04045); }
});

test("relative luminance and contrast ratios match known WCAG values", () => {
  assert.equal(luminance("#ffffff"), 1);
  assert.equal(luminance("#000000"), 0);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#3a7bd5", "#3a7bd5"), 1);
  close(contrastRatio("#777777", "#ffffff"), 4.4781, 1e-4);
  close(contrastRatio("#767676", "#ffffff"), 4.5422, 1e-4);
  close(contrastRatio("#ff0000", "#ffffff"), 3.9985, 1e-4);
  close(contrastRatio("#0000ff", "#ffffff"), 8.5925, 1e-4);
});

test("pass/fail uses the unrounded ratio and the display never rounds a fail up", () => {
  const r = contrastRatio("#777777", "#ffffff");
  assert.equal(passes(r, 4.5), false);
  assert.equal(formatRatio(r), "4.47:1");
  assert.equal(passes(4.5, 4.5), true);
  assert.equal(passes(4.4999999, 4.5), false);
  assert.equal(formatRatio(21), "21.00:1");
  const t = Object.fromEntries(CHECKS.map((c) => [c.id, c.threshold]));
  assert.deepEqual(t, { "aa-normal": 4.5, "aa-large": 3, "aaa-normal": 7, "aaa-large": 4.5, "non-text": 3 });
  const res = evaluatePair({ fg: "#767676", bg: "#ffffff" }).results.map((x) => x.pass);
  assert.deepEqual(res, [true, true, false, true, true]);
});

test("alpha compositing measures the colour actually seen", () => {
  assert.equal(toHex(composite({ r: 0, g: 0, b: 0, a: 0.5 }, [1, 1, 1])), "#808080");
  const e = evaluatePair({ fg: "#00000080", bg: "#ffffff" });
  assert.equal(e.fgSeen, "#7f7f7f", "alpha 0x80 is 128/255, slightly over half");
  close(e.ratio, contrastRatio(composite({ r: 0, g: 0, b: 0, a: 128 / 255 }, [1, 1, 1]), [1, 1, 1]), 1e-12);
  // a translucent background is composited over the base first
  const e2 = evaluatePair({ fg: "#000000", bg: "#ffffff00", base: "#000000" });
  assert.equal(e2.bgSeen, "#000000");
  assert.equal(e2.ratio, 1);
  assert.throws(() => evaluatePair({ fg: "x", bg: "#fff" }));
});

test("OKLCH and HSL conversions match reference values and round-trip", () => {
  const red = hexToOklch("#ff0000");
  close(red.l, 0.62796, 1e-4); close(red.c, 0.25768, 1e-4); close(red.h, 29.2339, 1e-2);
  const w = hexToOklch("#ffffff"); close(w.l, 1, 1e-6); close(w.c, 0, 1e-6);
  const h = hexToHsl("#336699"); close(h.h, 210, 1e-9); close(h.s, 0.5, 1e-9); close(h.l, 0.4, 1e-9);
  for (let i = 0; i < 400; i++) {
    const hex = toHex([(i * 37 % 256) / 255, (i * 91 % 256) / 255, (i * 13 % 256) / 255]);
    const o = hexToOklch(hex);
    assert.equal(oklchToHex(o.l, o.c, o.h), hex, hex);
  }
});

test("out-of-gamut OKLCH is mapped predictably into sRGB", () => {
  assert.equal(inSrgb(0.7, 0.4, 150), false);
  const a = oklchToHex(0.7, 0.4, 150), b = oklchToHex(0.7, 0.4, 150);
  assert.equal(a, b);
  const o = hexToOklch(a);
  close(o.l, 0.7, 0.02, "lightness kept"); close(o.h, 150, 3, "hue kept");
  assert.ok(o.c < 0.4);
  assert.equal(oklchToHex(1.2, 0, 0), "#ffffff");
  assert.equal(oklchToHex(-1, 0.1, 0), "#000000");
});

test("CIEDE2000 is zero for equal colours and symmetric", () => {
  assert.equal(deltaE2000("#123456", "#123456"), 0);
  close(deltaE2000("#ff0000", "#00ff00"), deltaE2000("#00ff00", "#ff0000"), 1e-9);
  close(deltaE2000("#000000", "#ffffff"), 100, 1e-3);
});

// ---------------------------------------------------------------- colour vision simulation
const visions: Vision[] = (["protan", "deutan", "tritan"] as CvdType[]).flatMap((type) => [0.3, 0.7, 1].map((severity) => ({ type, severity })));

test("normal vision and severity 0 leave colours unchanged", () => {
  for (let i = 0; i < 512; i++) {
    const hex = toHex([(i * 53 % 256) / 255, (i * 17 % 256) / 255, (i * 199 % 256) / 255]);
    assert.equal(simulateHex(hex, { type: "normal", severity: 1 }), hex);
    for (const type of ["protan", "deutan", "tritan"] as CvdType[]) assert.equal(simulateHex(hex, { type, severity: 0 }), hex);
  }
  assert.deepEqual(cvdMatrix({ type: "normal", severity: 1 }), IDENTITY);
  assert.ok(isIdentity({ type: "deutan", severity: 0 }));
});

test("the matrices are the ones published by Machado et al. (2009)", () => {
  // severity 1.0 matrices as printed in the paper's supplementary material
  const paper = {
    protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
    tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  };
  for (const [k, m] of Object.entries(paper)) m.forEach((v, i) => close(MACHADO[k as "protan"][10][i], v, 1e-6, `${k}[${i}]`));
  for (const k of ["protan", "deutan", "tritan"] as const) {
    assert.equal(MACHADO[k].length, 11);
    for (const m of MACHADO[k]) for (let r = 0; r < 3; r++) close(m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2], 1, 2e-3, "rows preserve white");
  }
});

test("simulation matches the colorspacious reference implementation", () => {
  const cases = (reference as { cases: { in: number[]; type: CvdType; severity: number; out: number[] }[] }).cases;
  assert.ok(cases.length >= 400);
  for (const c of cases) {
    const out = simulateRgb(c.in as unknown as [number, number, number], { type: c.type, severity: c.severity });
    out.forEach((v, i) => close(v, c.out[i], 1e-5, `${c.type} ${c.severity} ${c.in}`));
  }
});

test("simulation runs in linear light, not on gamma-encoded values", () => {
  const v: Vision = { type: "deutan", severity: 1 };
  const m = cvdMatrix(v);
  const rgb: [number, number, number] = [0.8, 0.3, 0.1];
  const lin = rgb.map(srgbToLinear);
  const expect = [0, 1, 2].map((r) => linearToSrgb(Math.min(1, Math.max(0, m[r * 3] * lin[0] + m[r * 3 + 1] * lin[1] + m[r * 3 + 2] * lin[2]))));
  const got = simulateRgb(rgb, v);
  got.forEach((x, i) => close(x, expect[i], 1e-12));
  const naive = [0, 1, 2].map((r) => m[r * 3] * rgb[0] + m[r * 3 + 1] * rgb[1] + m[r * 3 + 2] * rgb[2]);
  assert.ok(Math.abs(naive[0] - got[0]) > 0.01, "differs from a gamma-space filter");
});

test("severity interpolates linearly between published steps and changes smoothly", () => {
  for (const type of ["protan", "deutan", "tritan"] as const) {
    const m = cvdMatrix({ type, severity: 0.55 });
    m.forEach((x, i) => close(x, (MACHADO[type][5][i] + MACHADO[type][6][i]) / 2, 1e-12));
    let prev = hexToRgb(simulateHex("#c83c28", { type, severity: 0 }));
    for (let s = 1; s <= 100; s++) {
      const cur = simulateRgb(hexToRgb("#c83c28"), { type, severity: s / 100 });
      const jump = Math.max(...cur.map((v, i) => Math.abs(v - prev[i])));
      assert.ok(jump < 0.03, `${type} jump ${jump} at ${s}`);
      prev = cur as [number, number, number];
    }
  }
});

test("invalid simulation input is handled safely", () => {
  assert.equal(simulateHex("not a colour", { type: "deutan", severity: 1 }), "not a colour");
  assert.deepEqual(cvdMatrix({ type: "deutan", severity: Number.NaN }), MACHADO.deutan[10]);
  assert.deepEqual(cvdMatrix({ type: "deutan", severity: 7 }), MACHADO.deutan[10]);
  assert.deepEqual(cvdMatrix({ type: "deutan", severity: -1 }), MACHADO.deutan[0]);
  assert.deepEqual(cvdMatrix({ type: "bogus" as CvdType, severity: 1 }), IDENTITY);
  assert.deepEqual(simulateRgb([Number.NaN, 2, -1], { type: "protan", severity: 1 }).every((v) => v >= 0 && v <= 1), true);
});

test("gamut handling: simulated channels are clipped to [0, 1] consistently", () => {
  for (const v of visions) for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff"]) {
    const out = simulateRgb(hexToRgb(hex), v);
    assert.ok(out.every((x) => x >= 0 && x <= 1), `${hex} ${v.type}`);
  }
  // white and black are fixed points of every model
  for (const v of [...visions, { type: "achroma" as CvdType, severity: 1 }]) {
    assert.equal(simulateHex("#ffffff", v), "#ffffff");
    assert.equal(simulateHex("#000000", v), "#000000");
  }
});

test("achromatopsia approximation keeps relative luminance", () => {
  for (const hex of ["#ff0000", "#3a7bd5", "#c8a020"]) {
    const s = simulateHex(hex, { type: "achroma", severity: 1 });
    const [r, g, b] = hexToRgb(s);
    assert.equal(r, g); assert.equal(g, b);
    close(luminance(s), luminance(hex), 0.004);
  }
});

test("the image pixel path gives the same result as the swatch path", () => {
  const n = 4096, data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { data[i * 4] = (i * 37) & 255; data[i * 4 + 1] = (i * 101) & 255; data[i * 4 + 2] = (i * 7) & 255; data[i * 4 + 3] = 200; }
  for (const v of visions) {
    const copy = new Uint8ClampedArray(data);
    simulatePixels(copy, cvdMatrix(v));
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      const hex = toHex([data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255]);
      const ref = hexToRgb(simulateHex(hex, v)).map((x) => Math.round(x * 255));
      for (let k = 0; k < 3; k++) maxDiff = Math.max(maxDiff, Math.abs(copy[i * 4 + k] - ref[k]));
      assert.equal(copy[i * 4 + 3], 200, "alpha kept");
    }
    assert.ok(maxDiff <= 1, `${v.type} ${v.severity}: max diff ${maxDiff}`);
  }
});

test("previews and palette use the same algorithm", () => {
  const p: Palette = { name: "t", colors: ["#f4eee0", "#9a2a2a", "#1b2a4e", "#a3c293"].map((hex) => ({ hex })) };
  const r = resolveRoles(p, AUTO_ROLES);
  const orig = paintFor(p, r, null);
  const v: Vision = { type: "deutan", severity: 0.8 };
  const sim = paintFor(p, r, v);
  assert.equal(sim.simulated, true);
  for (const k of ["bg", "fg", "surface", "primary", "secondary", "onPrimary", "border", "muted", "faint", "primarySoft", "secondarySoft", "success", "warning", "danger", "successSoft", "warningSoft", "dangerSoft"] as const) assert.equal(sim[k], simulateHex(orig[k], v), k);
  sim.series.forEach((s, i) => assert.equal(s, simulateHex(p.colors[i].hex, v)));
  sim.bands.forEach((s, i) => assert.equal(s, simulateHex(orig.bands[i], v)));
  sim.accents.forEach((s, i) => assert.equal(s, simulateHex(orig.accents[i], v)));
});

test("distinguishability flags a red/green pair for deuteranopia but not normal vision", () => {
  const pal = ["#d62728", "#2ca02c", "#1f3a93", "#ffffff"];
  assert.equal(confusablePairs(pal, { type: "normal", severity: 1 }).length, 0);
  const issues = confusablePairs(pal, { type: "deutan", severity: 1 });
  assert.ok(issues.some((x) => x.i === 0 && x.j === 1), JSON.stringify(issues));
  assert.ok(!issues.some((x) => x.j === 3));
  assert.ok(issues.every((x) => x.deltaSimulated < 10));
});

// ---------------------------------------------------------------- contrast suggestions
test("contrast suggestions reach the target, keep the hue and are deterministic", () => {
  const s = suggestContrast("#888888", "#ffffff", 4.5)!;
  assert.ok(s && s.ratio >= 4.5 && contrastRatio(s.hex, "#ffffff") >= 4.5);
  assert.equal(s.direction, "darker");
  assert.deepEqual(suggestContrast("#888888", "#ffffff", 4.5), s);
  const blue = suggestContrast("#6a9bd8", "#ffffff", 7)!;
  assert.ok(blue.ratio >= 7);
  close(hexToOklch(blue.hex).h, hexToOklch("#6a9bd8").h, 4, "hue kept");
  assert.equal(suggestContrast("#333333", "#777777", 7), null, "unreachable target");
  assert.equal(suggestContrast("#000000", "#ffffff", 4.5)!.deltaE, 0, "already passing");
});

test("contrast matrix is symmetric with ones on the diagonal", () => {
  const m = contrastMatrix(["#000000", "#ffffff", "#777777"]);
  for (let i = 0; i < 3; i++) { assert.equal(m[i][i], 1); for (let j = 0; j < 3; j++) assert.equal(m[i][j], m[j][i]); }
});

// ---------------------------------------------------------------- harmonies and variations
test("relationships rotate hue in OKLCH and variations are deterministic", () => {
  const base = "#b04a3a";
  const [, comp] = relation(base, "complementary");
  const d = Math.abs(hexToOklch(comp).h - hexToOklch(base).h);
  close(Math.min(d, 360 - d), 180, 6);
  assert.equal(relation(base, "triadic").length, 3);
  assert.equal(relation(base, "monochromatic").length, 5);
  assert.equal(scale(base).length, 9);
  const cols = ["#f4eee0", "#9a2a2a", "#1b2a4e"], locked = [false, true, false];
  const a = vary(cols, locked, 42), b = vary(cols, locked, 42), c = vary(cols, locked, 43);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.equal(a[1], "#9a2a2a", "locked colour unchanged");
  assert.ok(a.every(isHex));
});

// ---------------------------------------------------------------- roles, projects, history
test("automatic roles pick light background and readable foreground", () => {
  const p: Palette = { name: "t", colors: ["#9a2a2a", "#f4eee0", "#1b2a4e"].map((hex) => ({ hex })) };
  const r = resolveRoles(p, AUTO_ROLES);
  assert.equal(r.background.hex, "#f4eee0");
  assert.equal(r.foreground.hex, "#1b2a4e");
  assert.equal(r.primary.hex, "#9a2a2a");
  assert.equal(resolveRoles(p, AUTO_ROLES, true).background.hex, "#1b2a4e");
  assert.equal(resolveRoles(p, { ...AUTO_ROLES, background: 0 }).background.hex, "#9a2a2a");
  assert.equal(resolveRoles(p, { ...AUTO_ROLES, background: 9 }).background.hex, "#f4eee0", "invalid index falls back");
  // no light colour: a derived paper tone, never a saturated page
  const loud: Palette = { name: "t", colors: ["#c8452b", "#1f6fa8"].map((hex) => ({ hex })) };
  const lr = resolveRoles(loud, AUTO_ROLES);
  assert.equal(lr.background.derived, true);
  assert.ok(hexToOklch(lr.background.hex).l > 0.9);
  assert.ok(contrastRatio(lr.foreground.hex, lr.background.hex) >= 4.5);
});

test("undo, redo and merged slider edits", () => {
  const d0 = makeDoc({ name: "a", colors: [{ hex: "#000000" }] });
  const d1 = { ...d0, palette: { ...d0.palette, colors: [{ hex: "#111111" }] } };
  const d2 = { ...d0, palette: { ...d0.palette, colors: [{ hex: "#222222" }] } };
  let h = initHistory(d0);
  h = commit(h, d1, "slider", 1000);
  h = commit(h, d2, "slider", 1200);
  assert.equal(h.past.length, 1, "merged");
  h = undo(h); assert.equal(h.present.palette.colors[0].hex, "#000000");
  h = redo(h); assert.equal(h.present.palette.colors[0].hex, "#222222");
  h = commit(h, d1, null, 5000); assert.equal(h.past.length, 2); assert.equal(h.future.length, 0);
  assert.equal(commit(h, h.present), h, "no-op change is not recorded");
});

test("moving and removing colours keep role assignments on the same colours", () => {
  const doc = { ...makeDoc({ name: "a", colors: ["#000000", "#111111", "#222222", "#333333"].map((hex) => ({ hex })) }) };
  doc.roles = { ...doc.roles, primary: 1, background: 3 };
  const moved = moveColor(doc, 1, 3);
  assert.equal(moved.palette.colors[moved.roles.primary as number].hex, "#111111");
  assert.equal(moved.palette.colors[moved.roles.background as number].hex, "#333333");
  const removed = removeColor(doc, 1);
  assert.equal(removed.roles.primary, "auto");
  assert.equal(removed.palette.colors[removed.roles.background as number].hex, "#333333");
  assert.equal(removeColor(makeDoc({ name: "x", colors: [{ hex: "#000000" }] }), 0).palette.colors.length, 1, "never empty");
});

test("projects round-trip and hostile files are rejected or sanitised", () => {
  const doc = makeDoc({ name: "Crimson & Navy", colors: [{ hex: "#9a2a2a", name: "Kurenai", locked: true }, { hex: "#1b2a4e" }], sourceId: "dcc/kurenai-kon" });
  doc.roles.primary = 0;
  const back = parseProject(serializeProject(doc));
  assert.deepEqual(back.doc, doc);
  assert.throws(() => parseProject("{"), /not valid JSON/);
  assert.throws(() => parseProject("{\"format\":\"x\"}"), /not a Color Lab project/);
  assert.throws(() => parseProject(JSON.stringify({ format: "elham-color-lab/project", version: 2 })), /newer version/);
  const evil = parseProject(JSON.stringify({ format: "elham-color-lab/project", version: 1, doc: { palette: { name: "<script>", colors: ["#fff", "javascript:alert(1)", { hex: "#00ff00", name: 5 }] }, roles: { primary: 99, background: "x" } } }));
  assert.deepEqual(evil.doc.palette.colors, [{ hex: "#ffffff" }, { hex: "#00ff00" }]);
  assert.equal(evil.doc.roles.primary, "auto");
  assert.equal(sanitizePalette({ colors: [] }), null);
});

// ---------------------------------------------------------------- exports
test("exports carry the original colours, never simulated ones", () => {
  const doc = makeDoc({ name: "Test", colors: ["#d62728", "#2ca02c", "#f4eee0"].map((hex) => ({ hex })) });
  const sim = simulateHex("#d62728", { type: "deutan", severity: 1 });
  for (const out of [exportHex(doc), exportCss(doc), exportJson(doc), exportTokens(doc), exportSvgSheet(doc), exportContrastReport(doc)]) {
    assert.ok(out.toLowerCase().includes("#d62728"));
    assert.ok(!out.toLowerCase().includes(sim), "no simulated value");
  }
  assert.equal(exportHex(doc), "#D62728\n#2CA02C\n#F4EEE0\n");
  assert.match(exportCss(doc), /--color-1: #d62728;/);
  assert.match(exportCss(doc), /--background: #f4eee0;/);
  const json = JSON.parse(exportJson(doc));
  assert.deepEqual(json.colors[0].rgb, [214, 39, 40]);
  const tokens = JSON.parse(exportTokens(doc));
  assert.equal(tokens.color.palette["1"].$value, "#d62728");
  assert.equal(tokens.color.semantic.background.$value, "{color.palette.3}");
  const cmp = exportComparisonSvg(doc, [{ label: "Original", vision: null }, { label: "Deuteranopia", vision: { type: "deutan", severity: 1 } }]);
  assert.ok(cmp.includes(`seen as ${sim.toUpperCase()}`) && cmp.includes("Original colours") && cmp.includes("Simulated"));
  assert.match(exportContrastReport(doc), /\| 1 #d62728 \| 2 #2ca02c \|/);
  assert.match(exportSvgSheet(doc), /^<svg[^>]+width="\d+"/);
});

// ---------------------------------------------------------------- library
test("the bundled library has the full Dictionary archive and the open scales", () => {
  const n = (s: string) => PALETTES.filter((p) => p.source === s).length;
  assert.equal(n("wada") + n("dcc"), 378);
  assert.equal(n("wada"), 348);
  assert.equal(COLLECTIONS.length, 71);
  assert.equal(new Set(PALETTES.flatMap((p) => p.source === "wada" || p.source === "dcc" ? (p.names ?? []).filter(Boolean) : [])).size >= 200, true, "named colours");
  assert.ok(n("radix") >= 60 && n("open-color") >= 13 && n("colorbrewer") >= 30);
  for (const p of PALETTES) { assert.ok(p.colors.length >= 2 && p.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)), p.id); }
  for (const c of COLLECTIONS) for (const id of c.palettes) assert.ok(BY_ID.has(id));
  // editorial palettes are never labelled as historical plates
  for (const p of PALETTES) if (p.source === "dcc") { assert.equal(p.category, "editorial"); assert.equal(p.plate, undefined); }
  for (const p of PALETTES) if (p.summary) assert.ok(!/[—;]/.test(p.summary), p.id);
});

test("library filters", () => {
  const all = PALETTES.length;
  assert.equal(filterPalettes(PALETTES, NO_FILTER).length, all);
  const two = filterPalettes(PALETTES, { ...NO_FILTER, count: "2" });
  assert.ok(two.length > 100 && two.every((p) => p.colors.length === 2));
  const blue = filterPalettes(PALETTES, { ...NO_FILTER, hue: "blue" });
  assert.ok(blue.length > 20 && blue.every((p) => p.colors.some((c) => hueFamily(c) === "blue")));
  assert.ok(filterPalettes(PALETTES, { ...NO_FILTER, query: "crimson navy" }).some((p) => p.id === "dcc/kurenai-kon"));
  assert.ok(filterPalettes(PALETTES, { ...NO_FILTER, query: "#9A2A2A" }).some((p) => p.id === "dcc/kurenai-kon"));
  assert.ok(filterPalettes(PALETTES, { ...NO_FILTER, mood: "serene" }).every((p) => p.moods?.includes("serene")));
  const fav = filterPalettes(PALETTES, { ...NO_FILTER, only: "favourites" }, new Set(["d3/Set2"]));
  assert.deepEqual(fav.map((p) => p.id), ["d3/Set2"]);
  const coll = COLLECTIONS[0];
  assert.equal(filterPalettes(PALETTES, { ...NO_FILTER, collection: coll.id }).length, coll.palettes.length);
  assert.ok(filterPalettes(PALETTES, { ...NO_FILTER, source: "radix", category: "interface" }).every((p) => p.source === "radix"));
});

test("OKLab mixing and hue families behave", () => {
  assert.equal(mixOklab("#000000", "#ffffff", 0), "#000000");
  assert.equal(mixOklab("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(hueFamily("#808080"), "neutral");
  assert.equal(hueFamily("#1f4e9a"), "blue");
  assert.equal(hueFamily("#2ca02c"), "green");
  assert.equal(hueFamily("#d62728"), "red");
});
