// Local storage in IndexedDB (this browser only; no accounts, no network). Falls back to memory when
// IndexedDB is unavailable (private windows in some browsers), so the app keeps working.
//   kv:        "favourites" -> string[], "current" -> autosaved project, "prefs" -> view preferences
//   palettes:  saved custom palettes { id, name, colors, savedAt, basedOn? }
import { sanitizePalette, type Palette } from "../core/palette";
import { sanitizeDoc, type Doc } from "../core/project";

const DB = "elham-color-lab", VERSION = 1;
export interface SavedPalette extends Palette { id: string; savedAt: string; basedOn?: string }

let dbp: Promise<IDBDatabase | null> | null = null;
const memory = { kv: new Map<string, unknown>(), palettes: new Map<string, SavedPalette>() };

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("palettes")) db.createObjectStore("palettes", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
export async function storageMode(): Promise<"indexeddb" | "memory"> { return (await open()) ? "indexeddb" : "memory"; }

function run<T>(store: "kv" | "palettes", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve, reject) => {
    if (!db) return resolve(undefined);
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export async function getKv<T>(key: string): Promise<T | undefined> {
  if (!(await open())) return memory.kv.get(key) as T | undefined;
  return run<T>("kv", "readonly", (s) => s.get(key) as IDBRequest<T>);
}
export async function setKv(key: string, value: unknown): Promise<void> {
  if (!(await open())) { memory.kv.set(key, value); return; }
  await run("kv", "readwrite", (s) => { s.put(value, key); });
}

export async function listPalettes(): Promise<SavedPalette[]> {
  const all = (await open()) ? ((await run<SavedPalette[]>("palettes", "readonly", (s) => s.getAll() as IDBRequest<SavedPalette[]>)) ?? []) : [...memory.palettes.values()];
  return all.flatMap((p) => { const ok = sanitizePalette(p); return ok ? [{ ...ok, id: String(p.id), savedAt: String(p.savedAt ?? ""), ...(p.basedOn ? { basedOn: String(p.basedOn) } : {}) }] : []; })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export async function putPalette(p: SavedPalette): Promise<void> {
  if (!(await open())) { memory.palettes.set(p.id, p); return; }
  await run("palettes", "readwrite", (s) => { s.put(p); });
}
export async function deletePalette(id: string): Promise<void> {
  if (!(await open())) { memory.palettes.delete(id); return; }
  await run("palettes", "readwrite", (s) => { s.delete(id); });
}

// ---------- backup / restore (one JSON file with everything stored locally)
export const BACKUP_FORMAT = "elham-color-lab/backup";
export interface Backup { format: typeof BACKUP_FORMAT; version: 1; savedAt: string; favourites: string[]; palettes: SavedPalette[]; current?: Doc }
export async function makeBackup(current?: Doc): Promise<string> {
  const b: Backup = { format: BACKUP_FORMAT, version: 1, savedAt: new Date().toISOString(), favourites: (await getKv<string[]>("favourites")) ?? [], palettes: await listPalettes(), ...(current ? { current } : {}) };
  return JSON.stringify(b, null, 2);
}
/** Restores a backup by merging it into local storage. Returns counts. Throws English messages. */
export async function restoreBackup(text: string): Promise<{ palettes: number; favourites: number; current: Doc | null }> {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const b = raw as Partial<Backup> | null;
  if (!b || b.format !== BACKUP_FORMAT) throw new Error("This is not a Color Lab backup file.");
  const favs = Array.isArray(b.favourites) ? b.favourites.filter((x): x is string => typeof x === "string").slice(0, 5000) : [];
  const merged = [...new Set([...((await getKv<string[]>("favourites")) ?? []), ...favs])];
  await setKv("favourites", merged);
  let n = 0;
  for (const p of Array.isArray(b.palettes) ? b.palettes.slice(0, 2000) : []) {
    const ok = sanitizePalette(p);
    if (!ok || typeof p.id !== "string") continue;
    await putPalette({ ...ok, id: p.id.slice(0, 80), savedAt: typeof p.savedAt === "string" ? p.savedAt : new Date().toISOString() });
    n++;
  }
  return { palettes: n, favourites: favs.length, current: sanitizeDoc(b.current) };
}
export const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
