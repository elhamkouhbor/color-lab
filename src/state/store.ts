// Application state: one small external store (no dependency) read with useStore(selector).
import { useSyncExternalStore } from "react";
import { hexToOklch, normalizeHex, oklchToHex } from "../core/color";
import { NORMAL, type Vision } from "../core/cvd";
import { vary } from "../core/harmony";
import { MAX_COLORS, type Palette, type Role, type RoleRef } from "../core/palette";
import { commit, initHistory, makeDoc, moveColor, redo, removeColor, undo, type Doc, type History } from "../core/project";
import { BY_ID, type LibraryPalette } from "../data/library";
import { getKv, setKv, listPalettes, putPalette, deletePalette, newId, type SavedPalette } from "../storage/db";

export type PreviewId = "website" | "editorial" | "interface" | "contrast" | "image";
export type InspectorTab = "colour" | "roles" | "contrast" | "vision";
export type Pane = "library" | "stage" | "inspect";

export interface ContrastPick { fg: string; bg: string; fgAlpha: number; bgAlpha: number; base: string }
export interface State {
  history: History;
  original: Palette | null;      // the palette as loaded (for "Restore original")
  selected: number;
  vision: Vision;
  compare: boolean;
  preview: PreviewId;
  tab: InspectorTab;
  pane: Pane;                    // phone layout: which pane is shown
  contrast: ContrastPick | null; // null = follow the foreground / background roles
  favourites: string[];
  saved: SavedPalette[];
  savedId: string | null;        // the saved palette this document came from or was saved as
  seed: number;
  chartPatterns: boolean;
  toast: string | null;
  ready: boolean;
}

const DEFAULT_ID = "dcc/kurenai-kon";
function fromLibrary(p: LibraryPalette): Palette {
  return { name: p.name, sourceId: p.id, colors: p.colors.map((hex, i) => ({ hex, ...(p.names?.[i] ? { name: p.names[i] } : {}) })) };
}
const fallback = fromLibrary(BY_ID.get(DEFAULT_ID) ?? [...BY_ID.values()][0]);

let state: State = {
  history: initHistory(makeDoc(fallback)), original: fallback, selected: 0, vision: NORMAL, compare: false,
  preview: "website", tab: "colour", pane: "stage", contrast: null, favourites: [], saved: [], savedId: null, seed: 1, chartPatterns: false, toast: null, ready: false,
};
const listeners = new Set<() => void>();
export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}
export const doc = () => state.history.present;

// ---------- document edits (undoable)
export function edit(fn: (d: Doc) => Doc, mergeKey: string | null = null) {
  setState((s) => {
    const next = fn(s.history.present);
    const history = commit(s.history, next, mergeKey);
    const n = history.present.palette.colors.length;
    return { history, selected: Math.min(s.selected, n - 1) };
  });
  scheduleSave();
}
export const doUndo = () => { setState((s) => ({ history: undo(s.history) })); clampSel(); scheduleSave(); };
export const doRedo = () => { setState((s) => ({ history: redo(s.history) })); clampSel(); scheduleSave(); };
const clampSel = () => setState((s) => ({ selected: Math.max(0, Math.min(s.selected, s.history.present.palette.colors.length - 1)) }));

export function setColor(i: number, hexIn: string, mergeKey?: string | null) {
  const hex = normalizeHex(hexIn);
  if (!hex) return;
  edit((d) => ({ ...d, palette: { ...d.palette, colors: d.palette.colors.map((c, k) => (k === i ? { ...c, hex } : c)) } }), mergeKey === undefined ? `color-${i}` : mergeKey);
}
export function setColorName(i: number, name: string) {
  edit((d) => ({ ...d, palette: { ...d.palette, colors: d.palette.colors.map((c, k) => (k === i ? { ...c, name: name.slice(0, 60) || undefined } : c)) } }), `name-${i}`);
}
export function toggleLock(i: number) {
  edit((d) => ({ ...d, palette: { ...d.palette, colors: d.palette.colors.map((c, k) => (k === i ? { ...c, locked: !c.locked || undefined } : c)) } }));
}
export function addColor(hexIn?: string) {
  const d = doc();
  if (d.palette.colors.length >= MAX_COLORS) return;
  const base = d.palette.colors[state.selected]?.hex ?? "#888888";
  let hex = hexIn ? normalizeHex(hexIn) : null;
  if (!hex) {
    // a neighbour of the selected colour: same hue, lightness moved towards the middle of the range
    const o = hexToOklch(base);
    hex = varyOne(base, o.l > 0.5 ? -0.18 : 0.18);
  }
  edit((x) => ({ ...x, palette: { ...x.palette, colors: [...x.palette.colors.slice(0, state.selected + 1), { hex: hex! }, ...x.palette.colors.slice(state.selected + 1)] } }));
  setState((s) => ({ selected: Math.min(s.selected + 1, s.history.present.palette.colors.length - 1) }));
}
function varyOne(hex: string, dl: number) { const o = hexToOklch(hex); return oklchToHex(Math.min(0.97, Math.max(0.1, o.l + dl)), o.c, o.h); }
export function deleteColor(i: number) { edit((d) => removeColor(d, i)); }
export function move(from: number, to: number) {
  edit((d) => moveColor(d, from, to));
  setState({ selected: to });
}
export function setRole(role: Role, ref: RoleRef) { edit((d) => ({ ...d, roles: { ...d.roles, [role]: ref } })); }
export function setDark(dark: boolean) { edit((d) => ({ ...d, dark })); }
export function renamePalette(name: string) { edit((d) => ({ ...d, palette: { ...d.palette, name: name.slice(0, 80) } }), "rename"); }
export function replaceColors(hexes: string[], mergeKey: string | null = null) {
  edit((d) => ({ ...d, palette: { ...d.palette, colors: hexes.map((hex, i) => ({ ...(d.palette.colors[i] ?? {}), hex })) } }), mergeKey);
}
export function applyVariation() {
  const d = doc();
  const seed = state.seed;
  const out = vary(d.palette.colors.map((c) => c.hex), d.palette.colors.map((c) => !!c.locked), seed);
  edit((x) => ({ ...x, palette: { ...x.palette, colors: x.palette.colors.map((c, i) => ({ ...c, hex: out[i], ...(out[i] !== c.hex ? { name: undefined } : {}) })) } }));
  setState({ seed: seed + 1 });
}
export function restoreOriginal() {
  const o = state.original;
  if (!o) return;
  edit((d) => ({ ...d, palette: { ...o, colors: o.colors.map((c) => ({ ...c })) } }));
}

// ---------- loading palettes
export function openPalette(p: Palette, savedId: string | null = null) {
  setState({ history: initHistory(makeDoc(p)), original: p, selected: 0, contrast: null, savedId, pane: window.matchMedia?.("(max-width: 760px)").matches ? "stage" : state.pane });
  scheduleSave();
}
export const openLibraryPalette = (p: LibraryPalette) => openPalette(fromLibrary(p));
export function openDoc(d: Doc, original?: Palette) {
  setState({ history: initHistory(d), original: original ?? d.palette, selected: 0, contrast: null, savedId: null });
  scheduleSave();
}

// ---------- favourites and saved palettes
export async function toggleFavourite(id: string) {
  const has = state.favourites.includes(id);
  const favourites = has ? state.favourites.filter((x) => x !== id) : [...state.favourites, id];
  setState({ favourites });
  await setKv("favourites", favourites);
}
export async function saveCurrent(asNew = false): Promise<SavedPalette> {
  const d = doc();
  const id = !asNew && state.savedId ? state.savedId : newId();
  const p: SavedPalette = { ...d.palette, id, savedAt: new Date().toISOString(), ...(d.palette.sourceId ? { basedOn: d.palette.sourceId } : {}) };
  await putPalette(p);
  setState({ saved: await listPalettes(), savedId: id, original: d.palette });
  return p;
}
export async function removeSaved(id: string) {
  await deletePalette(id);
  setState((s) => ({ saved: s.saved.filter((p) => p.id !== id), savedId: s.savedId === id ? null : s.savedId }));
}
export async function reloadSaved() { setState({ saved: await listPalettes() }); }

// ---------- notifications
let toastTimer = 0;
export function toast(msg: string) {
  setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => setState({ toast: null }), 3200);
}

// ---------- autosave (debounced) and start-up
let saveTimer = 0, pending = false;
const writeCurrent = () => { pending = false; clearTimeout(saveTimer); void setKv("current", { doc: doc(), original: state.original, savedId: state.savedId }).catch(() => undefined); };
function scheduleSave() {
  if (!state.ready) return;
  pending = true;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(writeCurrent, 400);
}
/** Writes a pending autosave immediately (the page is being hidden or closed). */
export function flushSave() { if (pending) writeCurrent(); }
export async function boot() {
  try {
    const [favourites, saved, current, prefs] = await Promise.all([getKv<string[]>("favourites"), listPalettes(), getKv<{ doc: unknown; original?: unknown; savedId?: unknown }>("current"), getKv<Partial<State>>("prefs")]);
    const patch: Partial<State> = { favourites: Array.isArray(favourites) ? favourites.filter((x) => typeof x === "string") : [], saved };
    const { sanitizeDoc } = await import("../core/project");
    const { sanitizePalette } = await import("../core/palette");
    const d = current ? sanitizeDoc(current.doc) : null;
    if (d) {
      patch.history = initHistory(d);
      patch.original = sanitizePalette(current?.original) ?? d.palette;
      patch.savedId = typeof current?.savedId === "string" ? current.savedId : null;
    }
    if (prefs && typeof prefs === "object") {
      const ids: PreviewId[] = ["website", "editorial", "interface", "contrast", "image"];
      if (ids.includes(prefs.preview as PreviewId)) patch.preview = prefs.preview;
    }
    setState(patch);
  } catch { /* storage unavailable: start fresh */ }
  setState({ ready: true });
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });
  let lastPreview = state.preview;
  subscribe(() => {
    if (state.preview === lastPreview) return;
    lastPreview = state.preview;
    void setKv("prefs", { preview: state.preview }).catch(() => undefined);
  });
}
