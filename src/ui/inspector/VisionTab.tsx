// Colour-vision report: which palette pairs may become hard to tell apart in a simulation, and the
// common places where meaning is carried by colour alone.
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { HelpButton } from "../help/Help";
import { t, useLang } from "../../i18n/i18n";
import { deltaE2000 } from "../../core/color";
import { isIdentity, simulateHex, type CvdType, type Vision } from "../../core/cvd";
import { CLOSE, confusablePairs, VERY_CLOSE } from "../../core/distinguish";
import { paintFor, resolveRoles } from "../../core/palette";
import type { Doc } from "../../core/project";
import { setState, useStore } from "../../state/store";
import { VISION_NAME, visionLabel } from "../Stage";

const OVERVIEW: CvdType[] = ["protan", "deutan", "tritan", "achroma"];

export function VisionTab() {
  useLang();
  const vision = useStore((s) => s.vision);
  const d = useStore((s) => s.history.present);
  const colors = d.palette.colors.map((c) => c.hex);
  const issues = useMemo(() => (isIdentity(vision) ? [] : confusablePairs(colors, vision)), [colors.join(), vision]); // eslint-disable-line react-hooks/exhaustive-deps
  const overview = useMemo(() => OVERVIEW.map((type) => ({ type, n: confusablePairs(colors, { type, severity: 1 }).filter((p) => !p.alsoNormal).length })), [colors.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const normalClose = useMemo(() => confusablePairs(colors, { type: "normal", severity: 1 }), [colors.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const cues = useMemo(() => colourOnlyChecks(d, vision), [d, vision]);

  return (
    <div className="vtab">
      <section className="panel-section">
        <h2 className="section-title"><Eye size={16} aria-hidden="true" />{t("Colour vision report")}<HelpButton topic="vision" /></h2>
        <p className="legend-note">{t("Pairs whose simulated colours are close (CIEDE2000 below {a}) may be hard to tell apart, especially in small areas. Below {b} they are very hard to tell apart. This is a screening aid, not a verdict.", { a: CLOSE, b: VERY_CLOSE })}</p>
        <table className="overview" data-testid="vision-overview">
          <caption className="sr-only">{t("Close pairs per type at full severity")}</caption>
          <thead><tr><th scope="col">{t("Type (full severity)")}</th><th scope="col">{t("Close pairs")}</th></tr></thead>
          <tbody>
            {overview.map(({ type, n }) => (
              <tr key={type} className={vision.type === type ? "on" : ""}>
                <th scope="row"><button className="link-btn" onClick={() => setState({ vision: { type, severity: 1 } })} data-tip={t("Show this simulation")}>{t(VISION_NAME[type])}</button></th>
                <td>{n === 0 ? <span className="ok-text"><CheckCircle2 size={14} aria-hidden="true" />{t("None found")}</span> : <span className="warn-text"><AlertTriangle size={14} aria-hidden="true" />{t("{n} {n|pair|pairs}", { n })}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {normalClose.length > 0 && <p className="legend-note">{t("{n} {n|pair is|pairs are} already close in normal vision and {n|is|are} not counted above.", { n: normalClose.length })}</p>}
      </section>

      <section className="panel-section" aria-live="polite">
        <h2 className="section-title">{isIdentity(vision) ? t("Choose a simulation") : t("Close pairs in {mode}", { mode: visionLabel(vision).charAt(0).toLowerCase() + visionLabel(vision).slice(1) })}</h2>
        {isIdentity(vision) ? (
          <p className="legend-note">{t("Select a colour vision type above the preview, or a row in the table, to list the pairs that may be confused.")}</p>
        ) : issues.length === 0 ? (
          <p className="ok-text block"><CheckCircle2 size={15} aria-hidden="true" />{t("No close pairs found in this simulation. Small text and thin lines can still be hard to tell apart.")}</p>
        ) : (
          <ul className="pair-list" data-testid="pair-list">
            {issues.map((p) => (
              <li key={`${p.i}-${p.j}`} className={p.level}>
                <div className="pair-sw">
                  <span className="pair-col"><small>{t("Original")}</small><span><i style={{ background: p.original[0] }} /><i style={{ background: p.original[1] }} /></span></span>
                  <span className="pair-col"><small>{t("Simulated")}</small><span><i style={{ background: p.simulated[0] }} /><i style={{ background: p.simulated[1] }} /></span></span>
                </div>
                <div className="pair-text">
                  <strong><AlertTriangle size={14} aria-hidden="true" />{p.level === "very-close" ? t("Colours {a} and {b}: very hard to tell apart", { a: p.i + 1, b: p.j + 1 }) : t("Colours {a} and {b}: may be hard to tell apart", { a: p.i + 1, b: p.j + 1 })}</strong>
                  <span>{t("ΔE00 {s} in this simulation, {o} in normal vision.", { s: p.deltaSimulated.toFixed(1), o: p.deltaOriginal.toFixed(1) })}</span>
                  <span>{p.alsoNormal ? t("They are similar in normal vision too. Use them for related things only.") : t("Consider changing their lightness or adding another visual distinction.")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-section">
        <h2 className="section-title">{t("Colour-only information")}</h2>
        <p className="legend-note">{t("Contrast and colour distinction are separate checks. Wherever colour carries meaning, add text, icons, patterns or position as well.")}</p>
        <ul className="cue-list" data-testid="cue-list">
          {cues.map((c) => (
            <li key={c.id} className={c.ok ? "ok" : "warn"}>
              {c.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
              <span><strong>{c.title}</strong>{c.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section limits">
        <h2 className="section-title">{t("Limits of the simulation")}</h2>
        <p className="legend-note">{t("The previews use the Machado, Oliveira and Fernandes (2009) model, applied in linear sRGB. It approximates an average observer. It cannot reproduce a particular person's vision, your display, the lighting or the exact severity. It is a design aid, not a medical test or a full accessibility audit.")}</p>
      </section>
    </div>
  );
}

interface Cue { id: string; ok: boolean; title: string; text: string }
function colourOnlyChecks(doc: Doc, vision: Vision): Cue[] {
  const r = resolveRoles(doc.palette, doc.roles, doc.dark);
  const p = paintFor(doc.palette, r, null);
  const v = isIdentity(vision) ? { type: "deutan" as CvdType, severity: 1 } : vision;
  const label = visionLabel(v);
  const mode = label.charAt(0).toLowerCase() + label.slice(1); // used mid-sentence
  const near = (a: string, b: string) => deltaE2000(simulateHex(a, v), simulateHex(b, v)) < CLOSE;
  const out: Cue[] = [];
  const statusClose = near(p.success, p.danger) || near(p.success, p.warning) || near(p.warning, p.danger);
  const fallback = !p.statusFromPalette.success || !p.statusFromPalette.warning || !p.statusFromPalette.danger;
  out.push({ id: "status", ok: !statusClose, title: t("Status indicators"), text: (statusClose
    ? t("Success, warning and error colours may look alike in {mode}. Keep an icon and a text label on every status, as the interface preview does.", { mode })
    : t("Status colours stay distinct in {mode}. Keep icons and labels anyway, for everyone who cannot rely on colour.", { mode }))
    + (fallback ? " " + t("This palette has no suitable green, amber or red for every status, so the preview uses standard status colours for the missing ones.") : "") });
  const series = p.accents.slice(0, 4);
  const pairs: string[] = [];
  for (let i = 0; i < series.length; i++) for (let j = i + 1; j < series.length; j++) if (near(series[i], series[j])) pairs.push(`${i + 1} & ${j + 1}`);
  out.push({ id: "chart", ok: pairs.length === 0, title: t("Chart series"), text: pairs.length
    ? t("Series {pairs} may be hard to tell apart in {mode}. Label series directly, add patterns or change lightness.", { pairs: pairs.join(", "), mode })
    : t("The first chart series stay distinct in {mode}. Legends still need text labels.", { mode }) });
  const btn = near(p.primary, p.secondary);
  out.push({ id: "buttons", ok: !btn, title: t("Button states"), text: btn
    ? t("Primary and secondary accents may look the same in {mode}. Differ buttons by fill, outline or label, not hue alone.", { mode })
    : t("Primary and secondary accents stay distinct in {mode}.", { mode }) });
  const err = near(p.danger, p.fg) || near(p.danger, p.border);
  out.push({ id: "forms", ok: !err, title: t("Form errors"), text: err
    ? t("The error colour may blend with text or borders in {mode}. Show an icon and a written message with every error.", { mode })
    : t("The error colour stands out in {mode}. Still pair every error with an icon and a written message.", { mode }) });
  out.push({ id: "legend", ok: true, title: t("Legends and links"), text: t("Give legends text labels or patterns, and underline links in body text so they do not rely on colour.") });
  return out;
}
