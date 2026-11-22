# CLAUDE.md

Guidance for AI coding assistants (and humans) working on Elham Color Lab. Keep it current.

- Stack: React 18 + Vite 5 + TypeScript, lucide-react icons, culori. Same family as Elham Fold Studio and
  Dieline Creator: reuse `src/ui/family.css` patterns (top bar, segmented, chips, cards, help, tooltips).
- 100% client-side. No network requests at run time, no analytics, no AI, no new runtime dependencies
  without good reason.
- Colour maths lives in `src/core/` and is pure. Contrast pass/fail uses unrounded ratios; display truncates.
- Every simulated colour must come from `simulateHex` / `simulatePixels` (`src/core/cvd.ts`). Previews paint
  only with `Paint` values (`paintFor`), never with opacity on coloured elements, so a simulated paint
  covers the whole composition. Layout decisions are made on the ORIGINAL colours.
- Exporters never take a vision setting. Only the comparison sheet shows simulated values, labelled.
- UI text is bilingual: `t("English")` (or `tk()` in tables) and add the Swedish text to `src/i18n/sv.ts`;
  `npm test` fails on a missing key. Every control gets a `data-tip`; sections get a `HelpButton`.
- Visible copy: no em dashes, en dashes or semicolons (tested). Never present generated colours as
  historical or curated palettes.
- Behaviour changes add or adjust a test (`tests/*.test.ts`, `scripts/browser.mjs`).
