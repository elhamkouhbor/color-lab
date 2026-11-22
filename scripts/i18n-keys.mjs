// Lists every UI string passed to t() or tk() in src/ (used by the i18n completeness test).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
export function uiKeys(root = "src") {
  const keys = new Set();
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !p.includes("i18n")) {
    const s = readFileSync(p, "utf8");
    for (const m of s.matchAll(/\b(?:t|tk)\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
  } } };
  walk(root);
  return [...keys].sort();
}
if (import.meta.url === `file://${process.argv[1]}`) { const k = uiKeys(); console.log(JSON.stringify(k, null, 1)); console.error(k.length, "keys"); }
