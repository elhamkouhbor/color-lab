// Colour editor for the selected palette colour, plus palette-wide actions and colour relationships.
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Lock, LockOpen, Pipette, Plus, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { HelpButton } from "../help/Help";
import { t, tk, useLang } from "../../i18n/i18n";
import { formatHsl, formatOklch, formatRgb, hexToOklch, inSrgb, normalizeHex, oklchToHex } from "../../core/color";
import { relation, RELATIONS, scale, type Relation } from "../../core/harmony";
import { MAX_COLORS } from "../../core/palette";
import { addColor, applyVariation, deleteColor, move, replaceColors, restoreOriginal, setColor, setColorName, toast, toggleLock, useStore } from "../../state/store";

const REL_LABEL: Record<Relation, string> = { complementary: tk("Complementary"), analogous: tk("Analogous"), triadic: tk("Triadic"), split: tk("Split complementary"), tetradic: tk("Tetradic"), monochromatic: tk("Monochromatic") };

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast(t("Copied {text}", { text })); } catch { toast(t("Copy is not available here")); }
}

export function ColourTab() {
  useLang();
  const colors = useStore((s) => s.history.present.palette.colors);
  const i = useStore((s) => s.selected);
  const seed = useStore((s) => s.seed);
  const hasOriginal = useStore((s) => !!s.original);
  const c = colors[i];
  const [hexDraft, setHexDraft] = useState(c?.hex ?? "");
  const [lch, setLch] = useState(() => (c ? hexToOklch(c.hex) : { l: 0, c: 0, h: 0 }));
  const [rel, setRel] = useState<Relation>("complementary");
  // keep the requested OKLCH values while dragging (the displayed colour may be gamut mapped)
  useEffect(() => { if (c) { setHexDraft(c.hex); if (oklchToHex(lch.l, lch.c, lch.h) !== c.hex) setLch(hexToOklch(c.hex)); } }, [c?.hex, i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const setFromLch = (next: { l: number; c: number; h: number }) => { setLch(next); setColor(i, oklchToHex(next.l, next.c, next.h), `lch-${i}`); };
  const mapped = !inSrgb(lch.l, lch.c, lch.h);
  const related = relation(c.hex, rel);
  const unlocked = colors.filter((x) => !x.locked).length;

  return (
    <div className="ctab">
      <section className="panel-section">
        <h2 className="section-title">{t("Colour {n}", { n: i + 1 })}<HelpButton topic="editor" /></h2>
        <div className="big-swatch" style={{ background: c.hex }} data-testid="big-swatch">
          <label className="picker" data-tip={t("Open the system colour picker")}>
            <Pipette size={15} aria-hidden="true" /><span>{t("Pick")}</span>
            <input type="color" value={c.hex} onChange={(e) => setColor(i, e.target.value, `picker-${i}`)} aria-label={t("Pick a colour")} />
          </label>
        </div>
        <div className="hex-row">
          <label className="field grow">{t("HEX")}
            <input className="mono" value={hexDraft} spellCheck={false} data-testid="hex-input"
              onChange={(e) => { setHexDraft(e.target.value); const h = normalizeHex(e.target.value); if (h && /^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) setColor(i, h, `hex-${i}`); }}
              onBlur={() => { const h = normalizeHex(hexDraft); if (h) setColor(i, h, `hex-${i}`); else setHexDraft(c.hex); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              aria-invalid={!normalizeHex(hexDraft)} aria-describedby="hex-help" />
          </label>
          <label className="field grow">{t("Name")}
            <input value={c.name ?? ""} onChange={(e) => setColorName(i, e.target.value)} placeholder={t("Optional")} />
          </label>
        </div>
        <p id="hex-help" className="legend-note">{normalizeHex(hexDraft) ? t("Type 3 or 6 hex digits, with or without #.") : t("Not a valid hex colour yet.")}</p>
        <dl className="values">
          {[["HEX", c.hex.toUpperCase()], ["RGB", formatRgb(c.hex)], ["HSL", formatHsl(c.hex)], ["OKLCH", formatOklch(c.hex)]].map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd className="mono">{v}</dd><button className="link-btn icon" onClick={() => void copy(v)} aria-label={t("Copy {k} value", { k })} data-tip={t("Copy")}><Copy size={13} /></button></div>
          ))}
        </dl>
        <fieldset className="lch">
          <legend>{t("Adjust in OKLCH")}</legend>
          <label><span>{t("Lightness")}</span><input type="range" min={0} max={1} step={0.005} value={lch.l} onChange={(e) => setFromLch({ ...lch, l: Number(e.target.value) })} data-testid="lch-l" /><output>{(lch.l * 100).toFixed(1)}%</output></label>
          <label><span>{t("Chroma")}</span><input type="range" min={0} max={0.37} step={0.002} value={lch.c} onChange={(e) => setFromLch({ ...lch, c: Number(e.target.value) })} /><output>{lch.c.toFixed(3)}</output></label>
          <label><span>{t("Hue")}</span><input type="range" min={0} max={360} step={1} value={lch.h} onChange={(e) => setFromLch({ ...lch, h: Number(e.target.value) })} className="hue-range" /><output>{Math.round(lch.h)}°</output></label>
          <p className={`legend-note gamut ${mapped ? "warn" : ""}`} role="status">{mapped ? t("Outside the sRGB gamut. Shown with chroma reduced at the same lightness and hue (CSS Color 4 mapping).") : t("Inside the sRGB gamut.")}</p>
        </fieldset>
        <div className="row-actions">
          <button className="btn" onClick={() => toggleLock(i)} aria-pressed={!!c.locked} data-tip={t("Locked colours are kept when you generate variations")}>{c.locked ? <Lock size={15} /> : <LockOpen size={15} />}{c.locked ? t("Locked") : t("Lock")}</button>
          <button className="btn icon-btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={t("Move left")} data-tip={t("Move left")}><ArrowLeft size={15} /></button>
          <button className="btn icon-btn" onClick={() => move(i, i + 1)} disabled={i === colors.length - 1} aria-label={t("Move right")} data-tip={t("Move right")}><ArrowRight size={15} /></button>
          <button className="btn danger icon-btn" onClick={() => deleteColor(i)} disabled={colors.length <= 1} aria-label={t("Remove colour")} data-tip={t("Remove this colour from the palette")}><Trash2 size={15} /></button>
        </div>
      </section>

      <section className="panel-section">
        <h2 className="section-title">{t("Palette")}</h2>
        <div className="row-actions wrap">
          <button className="btn" onClick={() => addColor()} disabled={colors.length >= MAX_COLORS}><Plus size={15} />{t("Add colour")}</button>
          <button className="btn" onClick={applyVariation} disabled={!unlocked} data-tip={t("Moves every unlocked colour slightly in lightness, chroma and hue. The same variation number always gives the same result.")} data-testid="vary"><Shuffle size={15} />{t("Variation {n}", { n: seed })}</button>
          <button className="btn" onClick={restoreOriginal} disabled={!hasOriginal} data-tip={t("Return to the palette as it was opened or last saved")}><RotateCcw size={15} />{t("Restore original")}</button>
        </div>
      </section>

      <section className="panel-section">
        <h2 className="section-title">{t("Relationships")}</h2>
        <select value={rel} onChange={(e) => setRel(e.target.value as Relation)} aria-label={t("Colour relationship")}>
          {RELATIONS.map((r) => <option key={r} value={r}>{t(REL_LABEL[r])}</option>)}
        </select>
        <div className="chip-swatches">
          {related.map((h, k) => <button key={k} className="mini-sw" style={{ background: h }} onClick={() => addColor(h)} aria-label={t("Add {hex}", { hex: h })} data-tip={t("Add {hex} to the palette", { hex: h })} disabled={colors.length >= MAX_COLORS} />)}
        </div>
        <div className="row-actions wrap">
          <button className="btn" disabled={!unlocked} onClick={() => {
            let k = 0;
            replaceColors(colors.map((x) => (x.locked ? x.hex : related[k++ % related.length])));
          }} data-tip={t("Replace the unlocked colours with this relationship")}>{t("Use for unlocked colours")}</button>
        </div>
        <p className="legend-note">{t("Relationships are rotations on the OKLCH hue circle from the selected colour. They are a starting point, not a guarantee of an attractive or accessible palette.")}</p>
        <h3 className="mini-title">{t("Tints and shades")}</h3>
        <div className="chip-swatches">
          {scale(c.hex).map((h, k) => <button key={k} className="mini-sw" style={{ background: h }} onClick={() => setColor(i, h, null)} aria-label={t("Use {hex}", { hex: h })} data-tip={t("Use {hex} for this colour", { hex: h })} />)}
        </div>
      </section>
    </div>
  );
}
