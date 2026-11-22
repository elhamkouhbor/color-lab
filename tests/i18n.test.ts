// Every visible string has a Swedish translation, placeholders match, help topics have the same
// structure in both languages, and visible copy uses no em dashes, en dashes or semicolons.
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain ESM helper without types
import { uiKeys } from "../scripts/i18n-keys.mjs";
import { SV } from "../src/i18n/sv";
import { HELP, HELP_ORDER } from "../src/i18n/help";
import { CHECKS } from "../src/core/contrast";
import { ROLE_LABEL } from "../src/core/palette";
import { CATEGORY_LABEL, CATEGORY_NOTE, SOURCES } from "../src/data/library";

const ERRORS = ["This file is not valid JSON.", "This is not a Color Lab project file.", "This project was saved by a newer version of Color Lab.", "The project contains no valid colours.", "This is not a Color Lab backup file."];
const keys: string[] = [...uiKeys("src"), ...CHECKS.map((c) => c.label), ...Object.values(ROLE_LABEL), ...Object.values(CATEGORY_LABEL), ...Object.values(CATEGORY_NOTE), ...ERRORS];
const ph = (s: string) => [...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]).sort().join(",");
const BANNED = /[—–;]/;

test("every UI string has a Swedish translation", () => {
  assert.ok(keys.length > 400, `found ${keys.length} keys`);
  const missing = keys.filter((k) => SV[k] === undefined);
  assert.deepEqual(missing, []);
});
test("Swedish strings keep the placeholders", () => {
  for (const [en, sv] of Object.entries(SV)) assert.equal(ph(sv).replace(/,?\bn\b/g, ""), ph(en).replace(/,?\bn\b/g, ""), en);
  for (const [en, sv] of Object.entries(SV)) if (en.includes("{n}")) assert.ok(sv.includes("{n}"), en);
});
test("no unused Swedish strings", () => {
  const set = new Set(keys);
  assert.deepEqual(Object.keys(SV).filter((k) => !set.has(k)), []);
});
test("help has the same structure in English and Swedish", () => {
  for (const k of HELP_ORDER) {
    assert.equal(HELP.en[k].points.length, HELP.sv[k].points.length, k);
    assert.equal(!!HELP.en[k].tip, !!HELP.sv[k].tip, k);
  }
});
test("visible copy has no em dashes, en dashes or semicolons", () => {
  const texts = [...keys, ...Object.values(SV), ...HELP_ORDER.flatMap((k) => (["en", "sv"] as const).flatMap((l) => [HELP[l][k].title, HELP[l][k].intro, ...HELP[l][k].points, HELP[l][k].tip ?? ""])), ...SOURCES.flatMap((s) => [s.name, s.by])];
  const bad = texts.filter((s) => BANNED.test(s));
  assert.deepEqual(bad, []);
});
