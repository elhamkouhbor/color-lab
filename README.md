# Elham Color Lab

A colour exploration tool by **Elham Kouhbor**, in the same family as
[Elham Fold Studio](https://elhamkouhbor.github.io/fold/) and
[Elham Dieline Creator](https://elhamkouhbor.github.io/Dieline/).

**Live:** https://www.elhamkouhbor.com/color-lab/

Browse about 500 open palettes, edit colours, assign them to semantic roles, measure WCAG 2.2 contrast,
simulate colour vision deficiencies and see the palette in a website, an editorial poster and an
application interface. Everything runs in the browser: no server, no account, no analytics, no AI.

## Features

- **Library:** 378 palettes from The Dictionary of Color Combinations (348 plates from Sanzo Wada's 1933
  book and 30 editorial combinations), Radix Colors and Open Color interface scales, and ColorBrewer and d3
  data visualization schemes. Search, filters (hue, colour count, source, mood, collection), favourites and
  locally saved palettes.
- **Editor:** HEX, RGB, HSL and OKLCH values, OKLCH sliders with CSS Color 4 gamut mapping, add, remove,
  reorder, lock, deterministic variations, colour relationships, tints and shades, undo and redo, restore
  original.
- **Roles:** background, foreground, surface, primary and secondary accents, button text and borders,
  automatic or assigned.
- **Contrast lab:** WCAG 2.2 ratio on unrounded values, AA and AAA for normal and large text, 3:1 for
  interface components, translucent colours composited, pairwise matrix, deterministic suggestions that
  keep the hue.
- **Colour vision simulator:** protanopia, deuteranopia and tritanopia with severity (Machado, Oliveira and
  Fernandes 2009, in linear sRGB), a luminance-only achromatopsia approximation, side-by-side comparison
  (before and after slider on phones), close-pair screening with CIEDE2000 and colour-only checks.
- **Previews:** website, editorial poster, application interface, contrast view and a local image tool
  (web worker, PNG download).
- **Export:** HEX, CSS custom properties, JSON, W3C design tokens, SVG and PNG swatch sheets, a Markdown
  contrast report, a colour vision comparison sheet, project files and a full backup. Exports contain the
  original colours; only the comparison sheet shows simulated values, labelled as such.
- English and Swedish, light and dark themes, keyboard and screen reader support, offline after the first
  visit.

## Develop

```bash
npm ci
npm run dev            # http://localhost:5190
npm test               # colour maths, simulation reference, library, exports, i18n
npm run build          # typecheck + build + postbuild (404.html, .nojekyll, service worker) -> dist/
npm run test:browser   # 28 browser checks against dist/ (needs a Chromium: npx playwright-core install chromium)
npm run build:pages    # the same with base /color-lab/ (what GitHub Actions deploys)
```

`node scripts/screenshots.mjs out/` renders desktop, tablet and phone screenshots of `dist/`.
`APP_URL=https://www.elhamkouhbor.com/color-lab/ npm run test:browser` runs the browser checks against the
live site.

### Palette data

`src/data/library.json` is generated from `data/source/` and three npm packages:

```bash
npm run data           # node scripts/build-data.mjs
```

The simulation reference values in `tests/reference/` come from colorspacious:
`python -m pip install colorspacious numpy && python scripts/gen-machado-reference.py src/core/machado.ts tests/reference/cvd-colorspacious.json`.

## Architecture

```
src/core/       pure colour code: color.ts (sRGB, luminance, OKLCH, gamut, CIEDE2000), contrast.ts,
                cvd.ts (+ machado.ts), distinguish.ts, harmony.ts, palette.ts (roles, paint), project.ts,
                export.ts
src/data/       library.json + filters and source attribution
src/state/      store (undo history, autosave, favourites, saved palettes)
src/storage/    IndexedDB with an in-memory fallback, backup and restore
src/ui/         shell, library, stage (vision bar, palette strip, compare), inspector tabs, previews,
                export dialog, about page; family.css (shared Elham tool styles) + colorlab.css
src/i18n/       t() with English keys, Swedish dictionary, bilingual help
```

One function, `simulateHex` / `simulatePixels` in `src/core/cvd.ts`, produces every simulated colour: the
swatches, the previews (which paint only with resolved role colours), the comparison sheet and the image
worker. The browser tests check the rendered simulated preview pixel by pixel against it.

## Deployment

`.github/workflows/deploy.yml` tests, builds with base `/color-lab/` and publishes to GitHub Pages on every
push to `main`. Pages source must be set to **GitHub Actions** (Settings, Pages). As a project site of
`elhamkouhbor.github.io` it is served under the portfolio's custom domain at `/color-lab/`; no DNS change
is needed.
If the live page is blank and requests `/src/main.tsx`, the Pages source is still "Deploy from a branch":
GitHub's own branch build then publishes the raw sources over the built app.

## Licences

Code: MIT, © Elham Kouhbor. Palette data, fonts and libraries: see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The simulation is an approximation for design work, not
a medical test.
