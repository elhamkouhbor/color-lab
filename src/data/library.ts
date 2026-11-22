// The bundled palette library (built by scripts/build-data.mjs; no runtime network requests).
import data from "./library.json";
import { hueFamily, type HueFamily } from "../core/color";

export type SourceId = "wada" | "dcc" | "radix" | "open-color" | "colorbrewer" | "d3";
export type Category = "historical" | "editorial" | "interface" | "dataviz";
export interface LibraryPalette {
  id: string; name: string; nameJa?: string; colors: string[]; names?: string[];
  source: SourceId; category: Category; kind?: string; moods?: string[]; era?: string; plate?: number; summary?: string; url?: string;
}
export interface Collection { id: string; title: string; palettes: string[] }

export const PALETTES = data.palettes as LibraryPalette[];
export const COLLECTIONS = data.collections as Collection[];
export const BY_ID = new Map(PALETTES.map((p) => [p.id, p]));

export const CATEGORIES: Category[] = ["historical", "editorial", "interface", "dataviz"];
// English labels and descriptions (translated in the UI)
export const CATEGORY_LABEL: Record<Category, string> = {
  historical: "Historical combinations",
  editorial: "Editorial combinations",
  interface: "Interface scales",
  dataviz: "Data visualization",
};
export const CATEGORY_NOTE: Record<Category, string> = {
  historical: "Plates from Sanzo Wada's A Dictionary of Color Combinations (1933), as digitised by colorcombinations.org.",
  editorial: "Modern combinations written by the colorcombinations.org editors from traditional Japanese colours. They are not plates from the 1933 book.",
  interface: "Step scales designed for user interfaces (Radix Colors and Open Color).",
  dataviz: "Categorical, sequential and diverging schemes for charts (ColorBrewer and d3).",
};

export interface Source { id: SourceId; name: string; by: string; licence: string; url: string; licenceUrl: string }
export const SOURCES: Source[] = [
  { id: "wada", name: "A Dictionary of Color Combinations (1933 plates)", by: "Sanzo Wada. Digitised by The Dictionary of Color Combinations (colorcombinations.org), derived from the mattdesl/dictionary-of-colour-combinations dataset (MIT)", licence: "CC BY 4.0", url: "https://colorcombinations.org/data/", licenceUrl: "https://creativecommons.org/licenses/by/4.0/" },
  { id: "dcc", name: "The Dictionary of Color Combinations (editorial palettes)", by: "colorcombinations.org", licence: "CC BY 4.0", url: "https://colorcombinations.org/data/", licenceUrl: "https://creativecommons.org/licenses/by/4.0/" },
  { id: "radix", name: "Radix Colors", by: "WorkOS", licence: "MIT", url: "https://github.com/radix-ui/colors", licenceUrl: "https://github.com/radix-ui/colors/blob/main/LICENSE" },
  { id: "open-color", name: "Open Color", by: "heeyeun (Yeun)", licence: "MIT", url: "https://github.com/yeun/open-color", licenceUrl: "https://github.com/yeun/open-color/blob/master/LICENSE" },
  { id: "colorbrewer", name: "ColorBrewer schemes (via d3-scale-chromatic)", by: "Cynthia Brewer, Mark Harrower and The Pennsylvania State University", licence: "Apache 2.0", url: "https://colorbrewer2.org/", licenceUrl: "https://www.apache.org/licenses/LICENSE-2.0" },
  { id: "d3", name: "d3-scale-chromatic", by: "Mike Bostock and contributors. Viridis, magma, inferno and plasma by Nathaniel Smith and Stéfan van der Walt (CC0). Cividis by Nuñez, Anderton and Renslow. Turbo by Anton Mikhailov (Google, Apache 2.0)", licence: "ISC", url: "https://github.com/d3/d3-scale-chromatic", licenceUrl: "https://github.com/d3/d3-scale-chromatic/blob/main/LICENSE" },
];
export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));
export const SOURCE_SHORT: Record<SourceId, string> = { wada: "Wada 1933", dcc: "colorcombinations.org", radix: "Radix Colors", "open-color": "Open Color", colorbrewer: "ColorBrewer", d3: "d3" };

// ---------- filtering (pure; used by the gallery and the tests)
const familyCache = new Map<string, Set<HueFamily>>();
export function familiesOf(p: LibraryPalette): Set<HueFamily> {
  let s = familyCache.get(p.id);
  if (!s) { s = new Set(p.colors.map(hueFamily)); familyCache.set(p.id, s); }
  return s;
}
export const MOODS = ["refined", "warm", "austere", "bold", "cool", "solemn", "serene", "earthy", "playful"];
export type CountFilter = "any" | "2" | "3" | "4" | "5-8" | "9+";

export interface Filter {
  query: string; category: Category | "all"; source: SourceId | "all"; hue: HueFamily | "all";
  count: CountFilter; mood: string; collection: string; only: "all" | "favourites";
}
export const NO_FILTER: Filter = { query: "", category: "all", source: "all", hue: "all", count: "any", mood: "all", collection: "all", only: "all" };

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
function countOk(n: number, f: CountFilter) {
  switch (f) {
    case "any": return true;
    case "5-8": return n >= 5 && n <= 8;
    case "9+": return n >= 9;
    default: return n === Number(f);
  }
}
export function filterPalettes(list: LibraryPalette[], f: Filter, favourites: Set<string> = new Set()): LibraryPalette[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  const coll = f.collection !== "all" ? new Set(COLLECTIONS.find((c) => c.id === f.collection)?.palettes ?? []) : null;
  return list.filter((p) => {
    if (f.only === "favourites" && !favourites.has(p.id)) return false;
    if (f.category !== "all" && p.category !== f.category) return false;
    if (f.source !== "all" && p.source !== f.source) return false;
    if (!countOk(p.colors.length, f.count)) return false;
    if (f.mood !== "all" && !p.moods?.includes(f.mood)) return false;
    if (coll && !coll.has(p.id)) return false;
    if (f.hue !== "all" && !familiesOf(p).has(f.hue)) return false;
    if (words.length) {
      const hay = fold([p.name, p.nameJa ?? "", ...(p.names ?? []), ...p.colors, p.kind ?? "", SOURCE_SHORT[p.source], p.plate ? `plate ${p.plate}` : ""].join(" "));
      if (!words.every((w) => hay.includes(w.replace(/^#/, "#")))) return false;
    }
    return true;
  });
}
