// Browser tests against the production build (npm run build first), or a deployed URL:
//   node scripts/browser.mjs                       -> serves dist/ with vite preview
//   APP_URL=https://www.elhamkouhbor.com/color-lab/ node scripts/browser.mjs
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// the same simulation code the app uses, for reference values
mkdirSync("node_modules/.cache", { recursive: true });
await build({ entryPoints: ["src/core/cvd.ts"], bundle: true, platform: "node", format: "esm", outfile: "node_modules/.cache/cvd.mjs", logLevel: "error" });
const { simulateHex } = await import(new URL("../node_modules/.cache/cvd.mjs", import.meta.url));

let server = null;
let url = process.env.APP_URL;
if (!url) {
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", "5192", "--strictPort"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  url = "http://localhost:5192/";
}
const browser = await chromium.launch();
let pass = 0, fail = 0;
const results = [];
async function check(name, fn) {
  try { await fn(); pass++; results.push(`ok   ${name}`); }
  catch (e) { fail++; results.push(`FAIL ${name}\n     ${String(e.message || e).split("\n")[0]}`); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, acceptDownloads: true, locale: opts.locale ?? "en-GB" });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") p.errors.push(m.text()); });
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-ready="1"]');
  return p;
}
const swatchFill = (p, i) => p.$$eval(".pswatch-fill", (els, i) => getComputedStyle(els[i]).backgroundColor, i);
const rgbToHex = (s) => "#" + s.match(/\d+/g).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("");
const download = async (p, sel) => { const [d] = await Promise.all([p.waitForEvent("download"), p.click(sel)]); return readFileSync(await d.path(), "utf8"); };

try {
  const p = await page();

  await check("loads with a palette, three previews and no console errors", async () => {
    assert((await p.$$(".pswatch")).length >= 2, "no swatches");
    assert(await p.$('[data-testid="pv-website"]'), "no website preview");
    assert(p.errors.length === 0, p.errors.join(" | "));
  });

  await check("library: 496 palettes, search and filters", async () => {
    const count = async () => Number((await p.textContent(".lib-count")).match(/\d+/)[0]);
    assert((await count()) === 496, `count ${await count()}`);
    await p.fill('[data-testid="lib-search"]', "cherry");
    await p.waitForTimeout(200);
    assert((await count()) >= 1 && (await count()) < 20, `search ${await count()}`);
    await p.fill('[data-testid="lib-search"]', "");
    await p.click('[data-testid="lib-filters"]');
    await p.selectOption(".lib-filters select >> nth=0", "2");
    await p.waitForTimeout(150);
    const two = await count();
    assert(two > 100 && two < 496, `two-colour ${two}`);
    await p.click("text=Clear filters");
    await p.click('.cat-chips button:has-text("Data viz")');
    await p.waitForTimeout(150);
    assert((await count()) === 43, `dataviz ${await count()}`);
    await p.click('.cat-chips button:has-text("All")');
    await p.click('[data-testid="lib-filters"]');
  });

  await check("opening a palette updates the strip and previews", async () => {
    await p.fill('[data-testid="lib-search"]', "Set2");
    await p.waitForTimeout(200);
    await p.click('[data-id="d3/Set2"]');
    await p.waitForTimeout(150);
    assert((await p.$$(".pswatch")).length === 8, "Set2 has 8 colours");
    assert((await p.inputValue(".project-title")) === "Set2", "title");
    await p.fill('[data-testid="lib-search"]', "");
  });

  await check("favourites", async () => {
    await p.click('.pcard >> nth=0 >> .star');
    await p.click('.lib-tools button:has-text("Favourites")');
    await p.waitForTimeout(150);
    assert((await p.$$('[data-testid="lib-list"] .pcard')).length === 1, "one favourite");
    await p.click('.lib-tools button:has-text("Favourites")');
  });

  await check("editing a hex value updates swatch, values and website preview; undo and redo", async () => {
    await p.click(".pswatch >> nth=0");
    await p.fill('[data-testid="hex-input"]', "#123456");
    await p.waitForTimeout(100);
    assert(rgbToHex(await swatchFill(p, 0)) === "#123456", "swatch");
    const usesIt = await p.$eval('[data-testid="pv-website"]', (el) => el.outerHTML.includes("#123456") || [...el.querySelectorAll("*")].some((n) => getComputedStyle(n).backgroundColor === "rgb(18, 52, 86)" || getComputedStyle(n).fill === "rgb(18, 52, 86)"));
    assert(usesIt, "preview does not use the new colour");
    await p.click('[aria-label="Undo"]');
    assert(rgbToHex(await swatchFill(p, 0)) !== "#123456", "undo");
    await p.click('[aria-label="Redo"]');
    assert(rgbToHex(await swatchFill(p, 0)) === "#123456", "redo");
  });

  await check("OKLCH slider, add, reorder, lock and variation", async () => {
    const n0 = (await p.$$(".pswatch")).length;
    await p.click('.ctab button:has-text("Add colour")');
    assert((await p.$$(".pswatch")).length === n0 + 1, "add");
    await p.click('[aria-label="Remove colour"]');
    assert((await p.$$(".pswatch")).length === n0, "remove");
    await p.click(".pswatch >> nth=0");
    const before = rgbToHex(await swatchFill(p, 0));
    await p.click('.ctab button:has-text("Lock")');
    await p.click('[data-testid="vary"]');
    assert(rgbToHex(await swatchFill(p, 0)) === before, "locked colour changed");
    await p.click('.ctab button:has-text("Locked")');
  });

  await check("saving keeps the palette in this browser after a reload", async () => {
    await p.fill(".project-title", "Browser test palette");
    await p.keyboard.press("Control+s");
    await p.waitForTimeout(400);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForSelector('[data-ready="1"]');
    await p.waitForTimeout(300);
    assert((await p.inputValue(".project-title")) === "Browser test palette", "autosave restore");
    assert(await p.$('.lib-section:has-text("Browser test palette")'), "not under My palettes");
  });

  // every vision mode: swatches use the node reference simulation
  for (const [mode, sev] of [["protan", 1], ["deutan", 1], ["tritan", 1], ["achroma", 1], ["deutan", 0.6]]) {
    await check(`vision ${mode} ${sev}: swatches match the reference simulation`, async () => {
      await p.click(`[data-mode="${mode}"]`);
      if (sev !== 1) { await p.$eval('[data-testid="severity"]', (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); }, sev); }
      await p.waitForTimeout(120);
      const hexes = await p.$$eval(".pswatch-hex", (els) => els.map((e) => e.textContent.toLowerCase()));
      for (let i = 0; i < hexes.length; i++) {
        const got = rgbToHex(await swatchFill(p, i));
        const want = simulateHex(hexes[i], { type: mode, severity: sev });
        assert(got === want, `${hexes[i]}: ${got} != ${want}`);
      }
      assert(await p.$('[data-testid="frame-simulated"]'), "preview not simulated");
    });
  }

  await check("simulation covers every pixel of the composition (compare mode, pixel check)", async () => {
    await p.click('[data-mode="deutan"]');
    await p.$eval('[data-testid="severity"]', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "1"); el.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.click('[data-testid="preview-website"]');
    if (!(await p.$('[data-testid="frame-original"]'))) await p.click('[data-testid="compare-toggle"]');
    await p.waitForTimeout(300);
    const a = await (await p.$('[data-testid="frame-original"] .frame-body')).screenshot();
    const b = await (await p.$('[data-testid="frame-simulated"] .frame-body')).screenshot();
    const decode = async (buf) => p.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      return { w: img.width, h: img.height, d: Array.from(x.getImageData(0, 0, img.width, img.height).data) };
    }, buf.toString("base64"));
    const A = await decode(a), B = await decode(b);
    assert(A.w === B.w && Math.abs(A.h - B.h) <= 1, "frame sizes differ");
    let checked = 0, bad = 0;
    for (let y = 2; y < Math.min(A.h, B.h) - 2; y += 7) for (let x = 2; x < A.w - 2; x += 7) {
      // only flat areas (no anti-aliased edges)
      const at = (D, xx, yy) => (yy * D.w + xx) * 4;
      const i = at(A, x, y);
      let flat = true;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { const j = at(A, x + dx, y + dy); if (Math.abs(A.d[i] - A.d[j]) + Math.abs(A.d[i + 1] - A.d[j + 1]) + Math.abs(A.d[i + 2] - A.d[j + 2]) > 0) flat = false; }
      if (!flat) continue;
      const hex = "#" + [A.d[i], A.d[i + 1], A.d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      const want = simulateHex(hex, { type: "deutan", severity: 1 }).match(/\w\w/g).map((h) => parseInt(h, 16));
      const k = at(B, x, y);
      const d = Math.max(Math.abs(B.d[k] - want[0]), Math.abs(B.d[k + 1] - want[1]), Math.abs(B.d[k + 2] - want[2]));
      checked++; if (d > 2) bad++;
    }
    assert(checked > 500, `only ${checked} flat samples`);
    assert(bad / checked < 0.01, `${bad} of ${checked} pixels differ from the reference simulation`);
  });

  await check("compare mode shows two synchronised frames on desktop", async () => {
    assert((await p.$$(".frames-2 .frame")).length === 2, "two frames");
    await p.$eval('[data-testid="frame-original"] .frame-body', (el) => { el.scrollTop = 400; el.dispatchEvent(new Event("scroll")); });
    await p.waitForTimeout(150);
    const top = await p.$eval('[data-testid="frame-simulated"] .frame-body', (el) => el.scrollTop);
    assert(Math.abs(top - 400) < 30, `not synchronised (${top})`);
  });

  await check("controls are not simulated (application chrome keeps its colours)", async () => {
    const brand = await p.$eval(".vmode.on", (el) => getComputedStyle(el).backgroundColor);
    assert(brand === "rgb(79, 70, 229)", `vision chip colour ${brand}`);
  });

  await check("switching modes 300 times stays fast and does not leak", async () => {
    const heap0 = await p.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    const t0 = Date.now();
    await p.evaluate(async () => {
      const modes = [...document.querySelectorAll(".vmode")];
      for (let i = 0; i < 300; i++) { modes[i % modes.length].click(); if (i % 10 === 0) await new Promise((r) => requestAnimationFrame(r)); }
    });
    const ms = Date.now() - t0;
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    const heap1 = await p.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    assert(ms < 15000, `${ms} ms`);
    assert(!heap0 || heap1 - heap0 < 30e6, `heap grew ${(heap1 - heap0) / 1e6} MB`);
    results.push(`     (300 switches in ${ms} ms, heap ${(heap0 / 1e6).toFixed(1)} -> ${(heap1 / 1e6).toFixed(1)} MB)`);
    assert(p.errors.length === 0, p.errors.join(" | "));
  });

  await check("exports contain original colours while a simulation is active", async () => {
    await p.click('[data-mode="deutan"]');
    const hexes = await p.$$eval(".pswatch-hex", (els) => els.map((e) => e.textContent.toLowerCase()));
    await p.click('[data-testid="open-export"]');
    const css = await download(p, '[data-testid="export-css"]');
    const txt = await download(p, '[data-testid="export-hex"]');
    const json = JSON.parse(await download(p, '[data-testid="export-json"]'));
    const tokens = JSON.parse(await download(p, '[data-testid="export-tokens"]'));
    const report = await download(p, '[data-testid="export-report"]');
    const svg = await download(p, '[data-testid="export-svg"]');
    for (const h of hexes) {
      assert(css.includes(h) && txt.toLowerCase().includes(h) && svg.includes(h), `missing ${h}`);
      const sim = simulateHex(h, { type: "deutan", severity: 1 });
      if (sim !== h) assert(!css.includes(sim) && !txt.toLowerCase().includes(sim) && !JSON.stringify(json).includes(sim), `simulated ${sim} leaked`);
    }
    assert(json.colors.length === hexes.length && tokens.color && report.startsWith("# Contrast report"), "formats");
    const [d] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="export-png"]')]);
    const png = readFileSync(await d.path());
    assert(png.subarray(1, 4).toString() === "PNG" && png.readUInt32BE(16) > 400, "png");
    const project = await download(p, '[data-testid="export-project"]');
    assert(JSON.parse(project).format === "elham-color-lab/project", "project");
    await p.click('[aria-label="Close"]');
  });

  await check("project import restores a palette", async () => {
    await p.click('[data-testid="open-export"]');
    const file = JSON.stringify({ format: "elham-color-lab/project", version: 1, doc: { palette: { name: "Imported", colors: [{ hex: "#112233" }, { hex: "#ddeeff" }] }, roles: {}, dark: false } });
    await p.setInputFiles('[data-testid="open-project"]', { name: "x.colorlab.json", mimeType: "application/json", buffer: Buffer.from(file) });
    await p.waitForTimeout(300);
    assert((await p.inputValue(".project-title")) === "Imported", "import");
  });

  await check("contrast lab: ratio, checks and an adjustment that passes", async () => {
    await p.click('[data-mode="normal"]');
    await p.click('[data-testid="insp-contrast"]');
    await p.fill('[data-testid="pick-fg"] input.mono', "#888888"); await p.press('[data-testid="pick-fg"] input.mono', "Enter");
    await p.fill('[data-testid="pick-bg"] input.mono', "#ffffff"); await p.press('[data-testid="pick-bg"] input.mono', "Enter");
    await p.waitForTimeout(150);
    const ratio = await p.textContent('[data-testid="ratio"] .ratio-num');
    assert(ratio === "3.54:1", `ratio ${ratio}`);
    const checks = await p.$$eval('[data-testid="checks"] li', (els) => els.map((e) => e.className));
    assert(checks.join() === "fail,pass,fail,fail,pass", checks.join());
    await p.click('[data-testid="apply-suggestion"]');
    await p.waitForTimeout(150);
    const after = Number((await p.textContent('[data-testid="ratio"] .ratio-num')).split(":")[0]);
    assert(after >= 4.5, `after ${after}`);
  });

  await check("contrast matrix and editorial/interface previews render", async () => {
    await p.click('[data-testid="preview-contrast"]');
    assert(await p.$('[data-testid="contrast-matrix"]'), "matrix");
    await p.click('[data-testid="preview-editorial"]');
    assert(await p.$('[data-testid="pv-editorial"] svg circle'), "poster");
    await p.click('[data-testid="preview-interface"]');
    assert(await p.$('[data-testid="pv-interface"] .u-bars'), "chart");
  });

  await check("vision report lists a confusable red/green pair", async () => {
    await p.click('[data-testid="open-export"]');
    const file = JSON.stringify({ format: "elham-color-lab/project", version: 1, doc: { palette: { name: "RG", colors: [{ hex: "#d62728" }, { hex: "#2ca02c" }, { hex: "#ffffff" }, { hex: "#1b1b1b" }] } } });
    await p.setInputFiles('[data-testid="open-project"]', { name: "rg.json", mimeType: "application/json", buffer: Buffer.from(file) });
    await p.waitForTimeout(200);
    await p.click('[data-mode="deutan"]');
    await p.click('[data-testid="insp-vision"]');
    assert(await p.$('[data-testid="pair-list"] li'), "no pair listed");
    assert((await p.textContent('[data-testid="cue-list"]')).length > 50, "cues");
  });

  await check("image tool simulates a PNG locally and offers a PNG download", async () => {
    // 4 x 1 PNG: red, green, blue, grey
    const raw = Buffer.from([0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255]);
    const crc = (buf) => { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
    const pngBuf = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
    await p.click('[data-testid="preview-image"]');
    await p.setInputFiles('[data-testid="image-input"]', { name: "t.png", mimeType: "image/png", buffer: pngBuf });
    await p.waitForSelector('[data-testid="image-simulated"]', { timeout: 10000 });
    const px = await p.$eval('[data-testid="image-simulated"]', async (img) => { await img.decode(); const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = 1; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return Array.from(x.getImageData(0, 0, 4, 1).data); });
    const want = ["#ff0000", "#00ff00", "#0000ff", "#808080"].map((h) => simulateHex(h, { type: "deutan", severity: 1 }).match(/\w\w/g).map((v) => parseInt(v, 16)));
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) assert(Math.abs(px[i * 4 + k] - want[i][k]) <= 1, `pixel ${i}: ${px.slice(i * 4, i * 4 + 3)} vs ${want[i]}`);
    const [d] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="image-download"]')]);
    assert(/deutan.*simulated\.png$/.test(d.suggestedFilename()), d.suggestedFilename());
    await p.click('[data-testid="preview-website"]');
  });

  await check("Swedish interface", async () => {
    await p.click('[data-testid="lang-toggle"]');
    assert((await p.textContent(".vision-title")).includes("Färgseende"), "vision title");
    assert((await p.textContent('[data-testid="preview-website"]')) === "Webbplats", "tab");
    await p.click('[data-testid="lang-toggle"]');
  });

  await check("about page with sources and licences", async () => {
    await p.click('[aria-label="About, sources and licences"]');
    await p.waitForSelector(".about-main");
    const txt = await p.textContent(".about-main");
    for (const s of ["CC BY 4.0", "Machado", "Radix Colors", "Open Color", "ColorBrewer", "Apache 2.0"]) assert(txt.includes(s), s);
    await p.click('[data-testid="about-back"]');
    await p.waitForSelector('[data-ready="1"]');
  });

  await check("accessibility basics: names on every button and input, one main, visible focus", async () => {
    const unnamed = await p.$$eval("button, input, select", (els) => els.filter((e) => {
      if (e.type === "hidden" || e.closest("[aria-hidden=true]")) return false;
      const name = e.getAttribute("aria-label") || e.textContent.trim() || e.labels?.[0]?.textContent.trim() || e.getAttribute("title") || e.getAttribute("placeholder");
      return !name;
    }).map((e) => e.outerHTML.slice(0, 80)));
    assert(unnamed.length === 0, unnamed.join(" | "));
    assert((await p.$$("main")).length === 1, "main");
    await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
    const shadow = await p.evaluate(() => getComputedStyle(document.activeElement).boxShadow + getComputedStyle(document.activeElement).outlineStyle);
    assert(shadow && shadow !== "nonenone", "no focus indicator");
  });

  await check("no console errors during the desktop run", async () => { assert(p.errors.length === 0, p.errors.join(" | ")); });
  await p.context().close();

  // phone
  const m = await page({ viewport: { width: 390, height: 844 }, mobile: true });
  await check("phone: panes and before/after comparison", async () => {
    assert(await m.isVisible('[data-testid="preview-area"]'), "preview visible");
    assert(!(await m.isVisible(".cl-inspector")), "inspector hidden");
    await m.click('[data-mode="tritan"]');
    await m.click('[data-testid="compare-toggle"]');
    assert(await m.isVisible('[data-testid="before-after"]'), "before/after");
    await m.$eval('[data-testid="ba-slider"]', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "20"); el.dispatchEvent(new Event("input", { bubbles: true })); });
    const clip = await m.$eval(".ba-layer.top", (el) => el.style.clipPath);
    assert(clip.includes("20%"), clip);
    await m.click('[data-testid="tab-library"]');
    assert(await m.isVisible('[data-testid="lib-list"]'), "library");
    await m.click('[data-testid="tab-inspect"]');
    assert(await m.isVisible('[data-testid="big-swatch"]'), "inspector");
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow <= 0, `horizontal overflow ${overflow}px`);
    assert(m.errors.length === 0, m.errors.join(" | "));
  });
  await m.context().close();

  // reduced motion + offline after first load (production build only)
  await check("works offline after the first visit (service worker)", async () => {
    const ctx = await browser.newContext();
    const q = await ctx.newPage();
    await q.goto(url, { waitUntil: "networkidle" });
    await q.waitForSelector('[data-ready="1"]');
    const ok = await q.evaluate(async () => { const r = await navigator.serviceWorker?.ready; return !!r; });
    assert(ok, "no service worker");
    await q.waitForTimeout(1200);
    await ctx.setOffline(true);
    await q.reload({ waitUntil: "load" });
    await q.waitForSelector('[data-ready="1"]', { timeout: 8000 });
    assert((await q.$$(".pswatch")).length > 0, "offline reload failed");
    await ctx.close();
  });
} finally {
  await browser.close();
  server?.kill();
}
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
