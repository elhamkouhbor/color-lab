// Builds src/data/library.json from the bundled open sources (run once after a source update):
//   node scripts/build-data.mjs
// Sources (all redistributable, see src/data/sources.ts for the attribution shown in the app):
//   - data/source/dcc/*  The Dictionary of Color Combinations archive (colorcombinations.org/data), CC BY 4.0
//   - @radix-ui/colors   Radix Colors scales, MIT
//   - open-color         Open Color, MIT
//   - d3-scale-chromatic ISC; ColorBrewer schemes Apache 2.0
// Nothing is fetched at run time: the app ships this JSON.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const SRC = join(root, "data/source/dcc");

// ---- tiny RFC 4180 CSV parser (quoted fields, commas and newlines inside quotes)
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const hex = (h) => {
  const s = String(h).trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(s)) throw new Error(`bad hex ${h}`);
  return s;
};
// Source descriptions use spaced em dashes. The app's copy style avoids them, so they are shown as commas
// (a change noted on the sources page, as CC BY 4.0 asks).
const noDash = (s) => s.replace(/\s+[—–]\s+/g, ", ").replace(/[—–]/g, "-").replace(/;/g, ",");

const palettes = [];

// ---- 1. The Dictionary of Color Combinations
const index = JSON.parse(readFileSync(join(SRC, "palettes.json"), "utf8"));
const csv = new Map(parseCsv(readFileSync(join(SRC, "palettes.csv"), "utf8")).map((r) => [r.slug, r]));
for (const p of index.palettes) {
  const row = csv.get(p.slug);
  if (!row) throw new Error(`palette ${p.slug} missing from palettes.csv`);
  const colors = p.colors.map(hex);
  const names = colors.map((_, i) => row[`color_${i + 1}`] || "");
  const wada = /^wada-\d+/.test(p.slug);
  const plate = wada ? Number(/^wada-(\d+)/.exec(p.slug)[1]) : undefined;
  palettes.push({
    id: `dcc/${p.slug}`,
    name: p.title,
    ...(p.titleJa ? { nameJa: p.titleJa } : {}),
    colors,
    names,
    source: wada ? "wada" : "dcc",
    category: wada ? "historical" : "editorial",
    moods: p.moods,
    ...(wada ? { plate } : { era: p.era, summary: noDash(p.summary) }),
    url: p.url,
  });
}
if (palettes.length !== 378) throw new Error(`expected 378 DCC palettes, got ${palettes.length}`);

const collections = readdirSync(join(SRC, "collections")).filter((f) => f.endsWith(".json")).sort().map((f) => {
  const c = JSON.parse(readFileSync(join(SRC, "collections", f), "utf8"));
  const ids = c.palettes.map((p) => `dcc/${p.slug}`);
  for (const id of ids) if (!palettes.some((p) => p.id === id)) throw new Error(`collection ${c.slug}: unknown ${id}`);
  return { id: c.slug, title: c.title.replace(/^Color Palettes for /, "").replace(/^Color Palettes /, ""), palettes: ids };
});
if (collections.length !== 71) throw new Error(`expected 71 collections, got ${collections.length}`);

// ---- 2. Radix Colors (12-step interface scales, light and dark)
const radix = require("@radix-ui/colors");
const RADIX = ["gray", "mauve", "slate", "sage", "olive", "sand", "tomato", "red", "ruby", "crimson", "pink", "plum", "purple", "violet", "iris", "indigo", "blue", "cyan", "teal", "jade", "green", "grass", "bronze", "gold", "brown", "orange", "amber", "yellow", "lime", "mint", "sky"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
for (const name of RADIX) {
  for (const dark of [false, true]) {
    const scale = radix[dark ? `${name}Dark` : name];
    if (!scale) throw new Error(`radix ${name} missing`);
    const colors = Array.from({ length: 12 }, (_, i) => hex(scale[`${name}${i + 1}`]));
    palettes.push({
      id: `radix/${name}${dark ? "-dark" : ""}`, name: `${cap(name)}${dark ? " dark" : ""}`, colors,
      names: colors.map((_, i) => `${cap(name)} ${i + 1}`), source: "radix", category: "interface", kind: dark ? "dark" : "light",
    });
  }
}

// ---- 3. Open Color (10-step scales)
const oc = JSON.parse(readFileSync(require.resolve("open-color/open-color.json"), "utf8"));
for (const [name, value] of Object.entries(oc)) {
  if (!Array.isArray(value)) continue;
  const colors = value.map(hex);
  palettes.push({ id: `open-color/${name}`, name: cap(name), colors, names: colors.map((_, i) => `${name} ${i}`), source: "open-color", category: "interface", kind: "light" });
}

// ---- 4. d3-scale-chromatic (ColorBrewer and perceptual scales)
const d3 = await import("d3-scale-chromatic");
const toHex = (c) => {
  if (c.startsWith("#")) return hex(c);
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c);
  return "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
};
const CATEGORICAL = [["Category10", "d3"], ["Observable10", "d3"], ["Accent", "brewer"], ["Dark2", "brewer"], ["Paired", "brewer"], ["Pastel1", "brewer"], ["Pastel2", "brewer"], ["Set1", "brewer"], ["Set2", "brewer"], ["Set3", "brewer"]];
for (const [n, by] of CATEGORICAL) {
  const colors = d3[`scheme${n}`].map(toHex);
  palettes.push({ id: `d3/${n}`, name: n, colors, source: by === "brewer" ? "colorbrewer" : "d3", category: "dataviz", kind: "categorical" });
}
const DIVERGING = ["BrBG", "PRGn", "PiYG", "PuOr", "RdBu", "RdGy", "RdYlBu", "RdYlGn", "Spectral"];
const SEQUENTIAL = ["Blues", "Greens", "Greys", "Oranges", "Purples", "Reds", "BuGn", "BuPu", "GnBu", "OrRd", "PuBuGn", "PuBu", "PuRd", "RdPu", "YlGnBu", "YlGn", "YlOrBr", "YlOrRd"];
for (const n of DIVERGING) palettes.push({ id: `d3/${n}`, name: n, colors: d3[`scheme${n}`][9].map(toHex), source: "colorbrewer", category: "dataviz", kind: "diverging" });
for (const n of SEQUENTIAL) palettes.push({ id: `d3/${n}`, name: n, colors: d3[`scheme${n}`][9].map(toHex), source: "colorbrewer", category: "dataviz", kind: "sequential" });
for (const n of ["Viridis", "Cividis", "Magma", "Inferno", "Plasma", "Turbo"]) {
  const f = d3[`interpolate${n}`];
  palettes.push({ id: `d3/${n}`, name: n, colors: Array.from({ length: 9 }, (_, i) => toHex(f(i / 8))), source: "d3", category: "dataviz", kind: "sequential" });
}

const ids = new Set();
for (const p of palettes) { if (ids.has(p.id)) throw new Error(`duplicate ${p.id}`); ids.add(p.id); }

mkdirSync(join(root, "src/data"), { recursive: true });
const out = { generated: new Date().toISOString().slice(0, 10), palettes, collections };
writeFileSync(join(root, "src/data/library.json"), JSON.stringify(out));
const by = palettes.reduce((a, p) => ((a[p.source] = (a[p.source] || 0) + 1), a), {});
console.log(`library.json: ${palettes.length} palettes, ${collections.length} collections`, by);
