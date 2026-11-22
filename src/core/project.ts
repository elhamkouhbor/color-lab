// The editor project (what is saved, undone and exported) and its file format.
import { AUTO_ROLES, sanitizePalette, sanitizeRoles, type Palette, type Roles } from "./palette";

export const FORMAT = "elham-color-lab/project";
export const PROJECT_EXTENSION = ".colorlab.json";

export interface Doc {
  palette: Palette;
  roles: Roles;
  /** dark arrangement of the automatic roles (background = darkest colour) */
  dark: boolean;
}
export interface ProjectFile { format: typeof FORMAT; version: 1; savedAt: string; doc: Doc; original?: Palette }

export function makeDoc(palette: Palette): Doc {
  return { palette: { ...palette, colors: palette.colors.map((c) => ({ ...c })) }, roles: { ...AUTO_ROLES }, dark: false };
}
export function serializeProject(doc: Doc, original?: Palette): string {
  const file: ProjectFile = { format: FORMAT, version: 1, savedAt: new Date().toISOString(), doc, ...(original ? { original } : {}) };
  return JSON.stringify(file, null, 2);
}
export function sanitizeDoc(input: unknown): Doc | null {
  if (!input || typeof input !== "object") return null;
  const d = input as { palette?: unknown; roles?: unknown; dark?: unknown };
  const palette = sanitizePalette(d.palette);
  if (!palette) return null;
  return { palette, roles: sanitizeRoles(d.roles, palette.colors.length), dark: d.dark === true };
}
/** Parses a project file. Throws an Error with an English message the UI translates. */
export function parseProject(text: string): { doc: Doc; original?: Palette } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const f = raw as Partial<ProjectFile> | null;
  if (!f || f.format !== FORMAT) throw new Error("This is not a Color Lab project file.");
  if (f.version !== 1) throw new Error("This project was saved by a newer version of Color Lab.");
  const doc = sanitizeDoc(f.doc);
  if (!doc) throw new Error("The project contains no valid colours.");
  const original = sanitizePalette(f.original) ?? undefined;
  return { doc, ...(original ? { original } : {}) };
}

// ---------- undo / redo (immutable snapshots, consecutive edits of one control can be merged)
export interface History { past: Doc[]; present: Doc; future: Doc[]; mergeKey: string | null; mergeAt: number }
export const HISTORY_LIMIT = 200;
export const initHistory = (doc: Doc): History => ({ past: [], present: doc, future: [], mergeKey: null, mergeAt: 0 });
/** Records a change. Edits with the same `mergeKey` within 800 ms (a slider drag) become one step. */
export function commit(h: History, next: Doc, mergeKey: string | null = null, now = Date.now()): History {
  if (JSON.stringify(next) === JSON.stringify(h.present)) return h;
  if (mergeKey && mergeKey === h.mergeKey && now - h.mergeAt < 800) return { ...h, present: next, future: [], mergeAt: now };
  const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], mergeKey, mergeAt: now };
}
export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], mergeKey: null, mergeAt: 0 };
}
export function redo(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), mergeKey: null, mergeAt: 0 };
}

// ---------- palette operations (pure)
export function moveColor(doc: Doc, from: number, to: number): Doc {
  const n = doc.palette.colors.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return doc;
  const colors = [...doc.palette.colors];
  const [c] = colors.splice(from, 1);
  colors.splice(to, 0, c);
  // keep role assignments pointing at the same colours
  const map = (i: number) => (i === from ? to : from < to && i > from && i <= to ? i - 1 : from > to && i >= to && i < from ? i + 1 : i);
  const roles = Object.fromEntries(Object.entries(doc.roles).map(([k, v]) => [k, typeof v === "number" ? map(v) : v])) as Roles;
  return { ...doc, palette: { ...doc.palette, colors }, roles };
}
export function removeColor(doc: Doc, index: number): Doc {
  if (doc.palette.colors.length <= 1) return doc;
  const colors = doc.palette.colors.filter((_, i) => i !== index);
  const roles = Object.fromEntries(Object.entries(doc.roles).map(([k, v]) => [k, typeof v === "number" ? (v === index ? "auto" : v > index ? v - 1 : v) : v])) as Roles;
  return { ...doc, palette: { ...doc.palette, colors }, roles };
}
