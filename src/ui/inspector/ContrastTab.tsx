// Contrast laboratory: pick a pair (with transparency), read the WCAG 2.2 results and request an
// adjusted colour that meets a chosen threshold.
import { useState } from "react";
import { ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react";
import { HelpButton } from "../help/Help";
import { t, useLang } from "../../i18n/i18n";
import { normalizeHex } from "../../core/color";
import { CHECKS, formatRatio, suggestContrast } from "../../core/contrast";
import { setColor, setState, useStore, type ContrastPick } from "../../state/store";
import { useActivePair } from "../contrastPick";

export function ContrastTab() {
  useLang();
  const pair = useActivePair();
  const colors = useStore((s) => s.history.present.palette.colors);
  const [target, setTarget] = useState(4.5);
  const [which, setWhich] = useState<"fg" | "bg">("fg");
  const update = (p: Partial<ContrastPick>) => setState({ contrast: { fg: pair.fg, bg: pair.bg, fgAlpha: pair.fgAlpha, bgAlpha: pair.bgAlpha, base: pair.base, ...p } });
  const translucent = pair.fgAlpha < 1 || pair.bgAlpha < 1;
  // suggestions work on the colours as seen (opaque); the adjusted colour replaces the opaque part
  const adjustSeen = which === "fg" ? pair.result.fgSeen : pair.result.bgSeen;
  const fixedSeen = which === "fg" ? pair.result.bgSeen : pair.result.fgSeen;
  const sug = translucent ? null : suggestContrast(adjustSeen, fixedSeen, target);
  const idx = which === "fg" ? pair.fgIndex : pair.bgIndex;
  const apply = () => {
    if (!sug) return;
    if (idx !== null) setColor(idx, sug.hex, null);
    update(which === "fg" ? { fg: sug.hex } : { bg: sug.hex });
  };

  return (
    <div className="ktab">
      <section className="panel-section">
        <h2 className="section-title">{t("Contrast lab")}<HelpButton topic="contrast" /></h2>
        <PickRow label={t("Text or foreground")} hex={pair.fg} alpha={pair.fgAlpha} colors={colors.map((c) => c.hex)} onHex={(fg) => update({ fg })} onAlpha={(fgAlpha) => update({ fgAlpha })} testid="fg" />
        <button className="btn swap" onClick={() => update({ fg: pair.bg, bg: pair.fg, fgAlpha: pair.bgAlpha, bgAlpha: pair.fgAlpha })} data-tip={t("Swap foreground and background")}><ArrowLeftRight size={15} />{t("Swap")}</button>
        <PickRow label={t("Background")} hex={pair.bg} alpha={pair.bgAlpha} colors={colors.map((c) => c.hex)} onHex={(bg) => update({ bg })} onAlpha={(bgAlpha) => update({ bgAlpha })} testid="bg" />
        {pair.bgAlpha < 1 && (
          <label className="field">{t("Backdrop behind the translucent background")}
            <input className="mono" defaultValue={pair.base} onBlur={(e) => { const h = normalizeHex(e.target.value); if (h) update({ base: h }); else e.target.value = pair.base; }} />
          </label>
        )}
        {translucent && <p className="legend-note">{t("Translucent colours are composited (source over, in sRGB) before measuring. Seen as {fg} on {bg}.", { fg: pair.result.fgSeen.toUpperCase(), bg: pair.result.bgSeen.toUpperCase() })}</p>}
        {pair.fgIndex === null || pair.bgIndex === null ? <p className="legend-note">{t("Tip: select a cell in the contrast matrix on the Contrast preview to test any palette pair.")}</p> : null}
      </section>

      <section className="panel-section" aria-live="polite">
        <div className="ratio-big" data-testid="ratio"><span className="ratio-num">{formatRatio(pair.result.ratio)}</span><span className="legend-note">{t("Exact ratio {r}", { r: pair.result.ratio.toFixed(4) })}</span></div>
        <ul className="check-list" data-testid="checks">
          {pair.result.results.map(({ check, pass }) => (
            <li key={check.id} className={pass ? "pass" : "fail"}>
              {pass ? <CheckCircle2 size={17} aria-hidden="true" /> : <XCircle size={17} aria-hidden="true" />}
              <span className="check-name">{t(check.label)}<small>{t("WCAG {sc}, at least {n}:1", { sc: check.criterion, n: check.threshold })}</small></span>
              <strong>{pass ? t("Pass") : t("Fail")}</strong>
            </li>
          ))}
        </ul>
        <p className="legend-note">{t("Passing these checks does not make a whole design accessible. Size, weight, focus states, colour-only information and real content still need review.")}</p>
      </section>

      <section className="panel-section">
        <h2 className="section-title">{t("Suggest an adjustment")}</h2>
        <div className="filter-grid">
          <label className="field">{t("Target")}
            <select value={target} onChange={(e) => setTarget(Number(e.target.value))} data-testid="target">
              {[...new Map(CHECKS.map((c) => [c.threshold, c])).values()].sort((a, b) => a.threshold - b.threshold).map((c) => <option key={c.threshold} value={c.threshold}>{c.threshold}:1 · {c.threshold === 3 ? t("large text AA, non-text") : c.threshold === 4.5 ? t("normal text AA, large AAA") : t("normal text AAA")}</option>)}
            </select>
          </label>
          <label className="field">{t("Change")}
            <select value={which} onChange={(e) => setWhich(e.target.value as "fg" | "bg")}>
              <option value="fg">{t("Foreground")}</option><option value="bg">{t("Background")}</option>
            </select>
          </label>
        </div>
        {translucent ? <p className="legend-note">{t("Make both colours opaque to get a suggestion.")}</p> : sug === null ? (
          <p className="banner inline" role="status">{t("No lightness of this colour reaches {n}:1 against the other colour. Try changing the other colour instead.", { n: target })}</p>
        ) : sug.deltaE === 0 ? (
          <p className="legend-note">{t("This pair already meets {n}:1.", { n: target })}</p>
        ) : (
          <div className="suggestion" data-testid="suggestion">
            <div className="sug-pair">
              <figure><span style={{ background: which === "fg" ? pair.result.bgSeen : adjustSeen, color: which === "fg" ? adjustSeen : pair.result.fgSeen }}>Aa</span><figcaption>{t("Original")}<br /><b className="mono">{adjustSeen.toUpperCase()}</b><br />{formatRatio(pair.result.ratio)}</figcaption></figure>
              <figure><span style={{ background: which === "fg" ? pair.result.bgSeen : sug.hex, color: which === "fg" ? sug.hex : pair.result.fgSeen }}>Aa</span><figcaption>{t("Suggested")}<br /><b className="mono">{sug.hex.toUpperCase()}</b><br />{formatRatio(sug.ratio)}</figcaption></figure>
            </div>
            <p className="legend-note">{sug.direction === "darker" ? t("Darker, same hue and chroma where possible. Colour difference ΔE00 {d}.", { d: sug.deltaE.toFixed(1) }) : t("Lighter, same hue and chroma where possible. Colour difference ΔE00 {d}.", { d: sug.deltaE.toFixed(1) })}</p>
            <button className="btn primary" onClick={apply} data-testid="apply-suggestion">{idx !== null ? t("Apply to colour {n}", { n: idx + 1 }) : t("Use this colour")}</button>
          </div>
        )}
      </section>
    </div>
  );
}

function PickRow({ label, hex, alpha, colors, onHex, onAlpha, testid }: { label: string; hex: string; alpha: number; colors: string[]; onHex: (h: string) => void; onAlpha: (a: number) => void; testid: string }) {
  return (
    <fieldset className="pick-row" data-testid={`pick-${testid}`}>
      <legend>{label}</legend>
      <div className="chip-swatches">
        {colors.map((c, i) => <button key={i} className={`mini-sw ${c === hex ? "on" : ""}`} style={{ background: c }} aria-pressed={c === hex} onClick={() => onHex(c)} aria-label={t("Colour {n}", { n: i + 1 }) + ` ${c}`} />)}
      </div>
      <div className="pick-inputs">
        <input className="mono" key={hex} defaultValue={hex} aria-label={t("{label} hex", { label })} onBlur={(e) => { const h = normalizeHex(e.target.value); if (h) onHex(h); else e.target.value = hex; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <label className="alpha" data-tip={t("Opacity. Translucent colours are measured after compositing.")}><span>{t("Opacity")}</span><input type="range" min={0} max={1} step={0.01} value={alpha} onChange={(e) => onAlpha(Number(e.target.value))} aria-label={t("{label} opacity", { label })} /><output>{Math.round(alpha * 100)}%</output></label>
      </div>
    </fieldset>
  );
}
