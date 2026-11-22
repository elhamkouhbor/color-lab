// Screenshots of the built app (npm run build first): desktop, tablet and phone, light and dark.
//   node scripts/screenshots.mjs [outDir]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || "screenshots";
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", "5191", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const url = "http://localhost:5191/";
const browser = await chromium.launch();
try {
  const shots = [
    ["desktop-website", { width: 1440, height: 900 }, async () => {}],
    ["desktop-deutan-compare", { width: 1440, height: 900 }, async (p) => { await p.click('[data-mode="deutan"]'); await p.click('[data-testid="compare-toggle"]'); }],
    ["desktop-editorial-protan", { width: 1440, height: 900 }, async (p) => { await p.click('[data-testid="preview-editorial"]'); await p.click('[data-mode="protan"]'); await p.click('[data-testid="compare-toggle"]'); }],
    ["desktop-interface", { width: 1440, height: 900 }, async (p) => { await p.click('[data-testid="preview-interface"]'); }],
    ["desktop-contrast", { width: 1440, height: 900 }, async (p) => { await p.click('[data-testid="preview-contrast"]'); await p.click('[data-testid="insp-contrast"]'); }],
    ["desktop-vision-tab", { width: 1440, height: 900 }, async (p) => { await p.click('[data-testid="preview-interface"]'); await p.click('[data-mode="deutan"]'); await p.click('[data-testid="insp-vision"]'); }],
    ["tablet", { width: 1024, height: 768 }, async () => {}],
    ["phone-preview", { width: 390, height: 844, mobile: true }, async () => {}],
    ["phone-compare", { width: 390, height: 844, mobile: true }, async (p) => { await p.click('[data-mode="deutan"]'); await p.click('[data-testid="compare-toggle"]'); }],
    ["phone-library", { width: 390, height: 844, mobile: true }, async (p) => { await p.click('[data-testid="tab-library"]'); }],
    ["phone-inspect", { width: 390, height: 844, mobile: true }, async (p) => { await p.click('[data-testid="tab-inspect"]'); }],
  ];
  for (const dark of [false, true]) {
    for (const [name, vp, act] of shots) {
      if (dark && !name.startsWith("desktop-website") && !name.startsWith("phone-preview") && !name.startsWith("desktop-contrast")) continue;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, colorScheme: dark ? "dark" : "light", deviceScaleFactor: vp.mobile ? 2 : 1 });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e)));
      p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await p.goto(url, { waitUntil: "networkidle" });
      await p.waitForSelector('[data-ready="1"]');
      await act(p);
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/${name}${dark ? "-dark" : ""}.png` });
      if (errors.length) console.log(name, "ERRORS", errors);
      await ctx.close();
    }
  }
} finally { await browser.close(); server.kill(); }
console.log("screenshots in", out);
