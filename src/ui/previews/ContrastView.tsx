// Contrast workspace on the stage: a large sample of the tested pair (text sizes and a UI component)
// and the pairwise matrix of the whole palette. Ratios are always WCAG ratios of the ORIGINAL colours;
// the swatches follow the selected colour vision simulation.
import { Check, Search, X } from "lucide-react";
import { contrastMatrix, formatRatio } from "../../core/contrast";
import { simulateHex } from "../../core/cvd";
import type { Paint } from "../../core/palette";
import { t, useLang } from "../../i18n/i18n";
import { setState, useStore } from "../../state/store";
import { useActivePair } from "../contrastPick";

export function levelOf(r: number): { label: string; ok: boolean } {
  if (r >= 7) return { label: "AAA", ok: true };
  if (r >= 4.5) return { label: "AA", ok: true };
  if (r >= 3) return { label: t("AA large"), ok: true };
  return { label: t("Fail"), ok: false };
}

export function ContrastView({ paint }: { paint: Paint }) {
  useLang();
  const pair = useActivePair();
  const vision = useStore((s) => s.vision);
  const colors = useStore((s) => s.history.present.palette.colors);
  const show = (hex: string) => (paint.simulated ? simulateHex(hex, vision) : hex);
  const fg = show(pair.result.fgSeen), bg = show(pair.result.bgSeen);
  const hexes = colors.map((c) => c.hex);
  const m = contrastMatrix(hexes);
  const big = pair.result.ratio;
  return (
    <div className="pv pv-contrast" data-testid="pv-contrast">
      <section className="cv-sample" style={{ background: bg, color: fg }}>
        <div className="cv-sample-text">
          <span className="cv-aa" style={{ color: fg }}>Aa</span>
          <p className="cv-large" style={{ color: fg }}>{t("Large text is 24 px, or 18.66 px bold.")}</p>
          <p className="cv-normal" style={{ color: fg }}>{t("Normal body text needs more contrast because thin strokes and small letters are harder to read, especially for people with low vision.")}</p>
        </div>
        <div className="cv-sample-ui" aria-hidden="true">
          <span className="cv-input" style={{ borderColor: fg, color: fg }}><Search size={15} />{t("Search")}</span>
          <span className="cv-icons" style={{ color: fg }}><Check size={22} strokeWidth={2.5} /><X size={22} strokeWidth={2.5} /></span>
        </div>
        <div className="cv-ratio" style={{ color: fg }}>
          <strong data-testid="cv-ratio">{formatRatio(big)}</strong>
          <span>{pair.result.fgSeen.toUpperCase()} {t("on")} {pair.result.bgSeen.toUpperCase()}</span>
        </div>
      </section>
      {paint.simulated && <p className="legend-note cv-note">{t("Swatches are simulated. Ratios are WCAG ratios of the original colours, which is what the guidelines measure.")}</p>}

      <section className="cv-matrix-wrap">
        <h4 className="cv-h">{t("All pairs in the palette")}</h4>
        <p className="legend-note">{t("Each cell shows a row colour as text on a column colour. Select a cell to test that pair.")}</p>
        <div className="cv-scroll">
          <table className="cv-matrix" data-testid="contrast-matrix">
            <thead>
              <tr><th scope="col"><span className="sr-only">{t("Text colour")}</span></th>{hexes.map((h, j) => <th key={j} scope="col"><span className="cv-head-sw" style={{ background: show(h) }} />{j + 1}</th>)}</tr>
            </thead>
            <tbody>
              {hexes.map((fgHex, i) => (
                <tr key={i}>
                  <th scope="row"><span className="cv-head-sw" style={{ background: show(fgHex) }} />{i + 1}</th>
                  {hexes.map((bgHex, j) => {
                    if (i === j) return <td key={j} className="cv-self" aria-label={t("Same colour")}>·</td>;
                    const r = m[i][j], lv = levelOf(r);
                    return (
                      <td key={j}>
                        <button className={`cv-cell ${lv.ok ? "" : "fail"}`} style={{ background: show(bgHex), color: show(fgHex) }}
                          onClick={() => setState({ contrast: { fg: fgHex, bg: bgHex, fgAlpha: 1, bgAlpha: 1, base: "#ffffff" }, tab: "contrast" })}
                          aria-label={t("Colour {a} on colour {b}: {ratio}, {level}", { a: i + 1, b: j + 1, ratio: formatRatio(r), level: lv.label })}>
                          <span className="cv-cell-aa">Aa</span>
                          <span className="cv-cell-meta">{(Math.floor(r * 10 + 1e-9) / 10).toFixed(1)}<b>{lv.label}</b></span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
