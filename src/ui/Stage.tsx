// Centre stage: preview tabs, the colour-vision controls, the palette strip and the previews.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Columns2, Eye, Info, Lock, Plus } from "lucide-react";
import { HelpButton, openHelp } from "./help/Help";
import { t, tk, useLang } from "../i18n/i18n";
import { CVD_TYPES, hasSeverity, isIdentity, simulateHex, type CvdType, type Vision } from "../core/cvd";
import { MAX_COLORS, paintFor, resolveRoles, type Paint } from "../core/palette";
import { addColor, move, setState, useStore, type PreviewId } from "../state/store";
import { WebsitePreview } from "./previews/Website";
import { EditorialPreview } from "./previews/Editorial";
import { InterfacePreview } from "./previews/Interface";
import { ContrastView } from "./previews/ContrastView";

const ImageTool = lazy(() => import("./previews/ImageTool"));

export const VISION_NAME: Record<CvdType, string> = { normal: tk("Normal vision"), protan: tk("Protanopia"), deutan: tk("Deuteranopia"), tritan: tk("Tritanopia"), achroma: tk("Achromatopsia") };
const ANOMALY_NAME: Partial<Record<CvdType, string>> = { protan: tk("Protanomaly"), deutan: tk("Deuteranomaly"), tritan: tk("Tritanomaly") };
const VISION_NOTE: Record<CvdType, string> = {
  normal: tk("Unmodified colours."),
  protan: tk("Reduced or missing sensitivity of the long-wavelength (red) cones."),
  deutan: tk("Reduced or missing sensitivity of the medium-wavelength (green) cones. The most common type."),
  tritan: tk("Reduced or missing sensitivity of the short-wavelength (blue) cones. Rare."),
  achroma: tk("Approximation of seeing lightness only. Real achromatopsia also affects acuity and light sensitivity."),
};
/** "Deuteranopia" at full severity, "Deuteranomaly, severity 0.60" below it. */
export function visionLabel(v: Vision): string {
  if (hasSeverity(v.type) && v.severity < 1) return t("{name}, severity {s}", { name: t(ANOMALY_NAME[v.type]!), s: v.severity.toFixed(2) });
  return t(VISION_NAME[v.type]);
}

const PREVIEWS: { id: PreviewId; label: string }[] = [
  { id: "website", label: tk("Website") }, { id: "editorial", label: tk("Editorial") }, { id: "interface", label: tk("Interface") },
  { id: "contrast", label: tk("Contrast") }, { id: "image", label: tk("Image") },
];

export function Stage() {
  useLang();
  const preview = useStore((s) => s.preview);
  const vision = useStore((s) => s.vision);
  const compare = useStore((s) => s.compare);
  const d = useStore((s) => s.history.present);
  const resolved = useMemo(() => resolveRoles(d.palette, d.roles, d.dark), [d]);
  const original = useMemo(() => paintFor(d.palette, resolved, null), [d.palette, resolved]);
  const simulated = useMemo(() => (isIdentity(vision) ? original : paintFor(d.palette, resolved, vision)), [d.palette, resolved, vision, original]);
  const render = (paint: Paint) => {
    switch (preview) {
      case "website": return <WebsitePreview paint={paint} />;
      case "editorial": return <EditorialPreview paint={paint} name={d.palette.name} />;
      case "interface": return <InterfacePreview paint={paint} />;
      case "contrast": return <ContrastView paint={paint} />;
      default: return null;
    }
  };
  return (
    <>
      <div className="stage-toolbar">
        <div className="segmented preview-tabs" role="tablist" aria-label={t("Preview")}>
          {PREVIEWS.map((p) => (
            <button key={p.id} role="tab" aria-selected={preview === p.id} className={preview === p.id ? "on" : ""} onClick={() => setState({ preview: p.id })} data-testid={`preview-${p.id}`}>{t(p.label)}</button>
          ))}
        </div>
        <div className="toolbar-right"><CompareButton /><span className="hide-mobile"><HelpButton topic="previews" /></span></div>
      </div>
      <VisionBar />
      <PaletteStrip />
      <div className={`preview-area ${preview}`} data-testid="preview-area">
        {preview === "image"
          ? <Suspense fallback={<p className="legend-note pad">{t("Loading…")}</p>}><ImageTool vision={vision} compare={compare} /></Suspense>
          : <Compared vision={vision} compare={compare} original={render(original)} simulated={isIdentity(vision) ? null : render(simulated)} scroll={preview !== "editorial"} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- colour vision controls
function CompareButton() {
  useLang();
  const vision = useStore((s) => s.vision);
  const compare = useStore((s) => s.compare);
  return (
    <button className={`tb-btn compare-btn ${compare ? "on" : ""}`} aria-pressed={compare} disabled={vision.type === "normal"} onClick={() => setState({ compare: !compare })}
        data-tip={vision.type === "normal" ? t("Choose a colour vision type to compare with the original") : t("Show the original and the simulation together")} data-testid="compare-toggle">
        <Columns2 size={16} /><span>{t("Compare")}</span>
      </button>
  );
}

export function VisionBar() {
  useLang();
  const vision = useStore((s) => s.vision);
  const setVision = (v: Vision) => setState({ vision: v });
  const sev = hasSeverity(vision.type);
  return (
    <section className={`vision-bar ${vision.type !== "normal" ? "active" : ""}`} aria-label={t("Colour vision simulator")} data-testid="vision-bar">
      <div className="vision-row">
        <span className="vision-title"><Eye size={16} aria-hidden="true" />{t("Colour vision")}</span>
        <div className="vision-modes" role="radiogroup" aria-label={t("Colour vision")}>
          {CVD_TYPES.map((type) => {
            const on = vision.type === type;
            return (
              <button key={type} role="radio" aria-checked={on} className={`vmode ${on ? "on" : ""}`} data-mode={type}
                onClick={() => setVision({ type, severity: type === vision.type ? vision.severity : 1 })} data-tip={t(VISION_NOTE[type])}>
                {on && hasSeverity(type) && vision.severity < 1 ? t(ANOMALY_NAME[type]!) : t(VISION_NAME[type])}
              </button>
            );
          })}
        </div>

        <button className="tb-btn icon-only" onClick={() => openHelp("vision")} aria-label={t("About the simulation")} data-tip={t("How the simulation works and its limits")}><Info size={16} /></button>
      </div>
      {vision.type !== "normal" && (
        <div className="vision-row sub">
          {sev ? (
            <label className="severity" data-tip={t("Severity 1 is a complete absence of that cone type (dichromacy). Lower values model anomalous trichromacy, where the cone response is shifted.")}>
              <span>{t("Severity")}</span>
              <input type="range" min={0} max={1} step={0.05} value={vision.severity} onChange={(e) => setVision({ ...vision, severity: Number(e.target.value) })} aria-valuetext={visionLabel(vision)} data-testid="severity" />
              <output>{vision.severity.toFixed(2)}</output>
            </label>
          ) : null}
          <p className="vision-note"><strong>{visionLabel(vision)}.</strong> <span className="vn-desc">{t(VISION_NOTE[vision.type])} </span>{t("An approximation from the Machado, Oliveira and Fernandes (2009) model. Individual vision varies.")}</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- palette strip
export function PaletteStrip() {
  useLang();
  const colors = useStore((s) => s.history.present.palette.colors);
  const selected = useStore((s) => s.selected);
  const vision = useStore((s) => s.vision);
  const sim = !isIdentity(vision);
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <div className="pstrip" role="listbox" aria-label={t("Palette colours")} aria-orientation="horizontal" data-testid="palette-strip"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const n = Math.max(0, Math.min(colors.length - 1, selected + (e.key === "ArrowRight" ? 1 : -1)));
          if (e.altKey) move(selected, n); else setState({ selected: n });
          (e.currentTarget.querySelectorAll<HTMLElement>("[role=option]")[n])?.focus();
          e.preventDefault();
        }
      }}>
      {colors.map((c, i) => {
        const seen = sim ? simulateHex(c.hex, vision) : c.hex;
        return (
          <div key={i} role="option" aria-selected={i === selected} tabIndex={i === selected ? 0 : -1} className={`pswatch ${i === selected ? "sel" : ""} ${drag === i ? "dragging" : ""}`}
            draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); if (Number.isInteger(from)) move(from, i); setDrag(null); }} onDragEnd={() => setDrag(null)}
            onClick={() => setState({ selected: i, tab: "colour" })} aria-label={`${t("Colour {n}", { n: i + 1 })} ${c.hex}${c.name ? ` ${c.name}` : ""}${sim ? `, ${t("seen as {hex}", { hex: seen })}` : ""}`}
            data-tip={t("Select to edit. Drag (or Alt + arrow keys) to reorder.")}>
            <span className="pswatch-fill" style={{ background: seen }}>{c.locked && <Lock size={12} aria-hidden="true" />}</span>
            <span className="pswatch-hex">{c.hex.toUpperCase()}</span>
            {sim ? <span className="pswatch-seen">{t("seen as {hex}", { hex: seen.toUpperCase() })}</span> : <span className="pswatch-name">{c.name ?? " "}</span>}
          </div>
        );
      })}
      <button className="padd" onClick={() => addColor()} disabled={colors.length >= MAX_COLORS} aria-label={t("Add colour")} data-tip={colors.length >= MAX_COLORS ? t("A palette can hold up to {n} colours", { n: MAX_COLORS }) : t("Add a colour after the selected one")}><Plus size={18} /></button>
      {sim && <span className="sim-flag" aria-hidden="true">{t("Simulated")}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- original / simulated frames
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(1200);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Compared({ vision, compare, original, simulated, scroll = true }: { vision: Vision; compare: boolean; original: ReactNode; simulated: ReactNode | null; scroll?: boolean }) {
  useLang();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [split, setSplit] = useState(50);
  const a = useRef<HTMLDivElement>(null), b = useRef<HTMLDivElement>(null), lock = useRef(false);
  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || lock.current) return;
    lock.current = true;
    to.scrollTop = from.scrollTop * ((to.scrollHeight - to.clientHeight) / Math.max(1, from.scrollHeight - from.clientHeight));
    requestAnimationFrame(() => { lock.current = false; });
  };
  const label = visionLabel(vision);
  let body: ReactNode;
  const cls = (extra = "") => `frame ${extra}`;
  const inner = (node: ReactNode, r?: RefObject<HTMLDivElement>, other?: RefObject<HTMLDivElement>) => (
    <div className={`frame-body ${scroll ? "scroll" : "fit"}`} ref={r} onScroll={r && other ? () => sync(r.current, other.current) : undefined}>{node}</div>
  );
  if (!simulated) {
    body = <div className={cls("single")} data-testid="frame-original">{inner(original)}</div>;
  } else if (!compare) {
    body = <div className={cls("single")} data-testid="frame-simulated"><div className="frame-head"><span className="frame-label sim">{t("Simulated")}: {label}</span></div>{inner(simulated)}</div>;
  } else if (width >= 760) {
    body = (
      <div className="frames-2">
        <div className={cls()} data-testid="frame-original"><div className="frame-head"><span className="frame-label">{t("Original")}</span></div>{inner(original, a, b)}</div>
        <div className={cls()} data-testid="frame-simulated"><div className="frame-head"><span className="frame-label sim">{label}</span></div>{inner(simulated, b, a)}</div>
      </div>
    );
  } else {
    body = (
      <div className="before-after" data-testid="before-after">
        <div className={cls("ba")}>
          <div className="frame-head split"><span className="frame-label">{t("Original")}</span><span className="frame-label sim">{label}</span></div>
          {inner(
            <div className="ba-stack">
              <div className="ba-layer">{original}</div>
              <div className="ba-layer top" style={{ clipPath: `inset(0 0 0 ${split}%)` }} aria-hidden="true">{simulated}</div>
              <div className="ba-line" style={{ left: `${split}%` }} aria-hidden="true" />
            </div>,
          )}
        </div>
        <label className="ba-control">
          <span className="sr-only">{t("Divider position between original and simulated")}</span>
          <input type="range" min={0} max={100} step={1} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-valuetext={t("{n}% original", { n: split })} data-testid="ba-slider" />
        </label>
      </div>
    );
  }
  return <div className="compared" ref={ref}>{body}</div>;
}
