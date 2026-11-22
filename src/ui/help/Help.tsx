// Contextual help: one global tooltip layer for every element with `data-tip`, the per-section
// "?" buttons, the Help dialog and the language switch.
//   - mouse: tooltip after a short hover delay; keyboard: on focus (focus-visible); touch: long-press
//   - the tooltip is announced to assistive technology through aria-describedby while shown
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleHelp, Languages, X } from "lucide-react";
import { HELP, HELP_ORDER, type HelpTopic } from "../../i18n/help";
import { LANGS, setLang, t, useLang } from "../../i18n/i18n";

// ---- tooltip layer
const TIP_ID = "elham-tooltip";
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let timer = 0, press = 0, suppressClick = false;
    const show = (el: HTMLElement) => {
      const text = el.getAttribute("data-tip"); if (!text) return;
      hide();
      target.current = el;
      const prev = el.getAttribute("aria-describedby");
      if (!prev?.includes(TIP_ID)) { el.dataset.prevDescribedby = prev ?? ""; el.setAttribute("aria-describedby", prev ? `${prev} ${TIP_ID}` : TIP_ID); }
      const r = el.getBoundingClientRect();
      const below = r.top < 70;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom : r.top, below });
    };
    const hide = () => {
      clearTimeout(timer);
      const el = target.current;
      if (el) {
        const prev = el.dataset.prevDescribedby;
        if (prev) el.setAttribute("aria-describedby", prev); else el.removeAttribute("aria-describedby");
        delete el.dataset.prevDescribedby;
      }
      target.current = null; setTip(null);
    };
    const tipTarget = (e: Event) => (e.target instanceof Element ? (e.target.closest("[data-tip]") as HTMLElement | null) : null);
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = tipTarget(e);
      if (el === target.current) return;
      clearTimeout(timer);
      if (!el) { hide(); return; }
      timer = window.setTimeout(() => show(el), target.current ? 80 : 450);
    };
    const out = (e: PointerEvent) => { if (e.pointerType === "mouse" && !(e.relatedTarget instanceof Element && target.current?.contains(e.relatedTarget))) { const el = tipTarget(e); if (el && el === target.current) hide(); else clearTimeout(timer); } };
    const focusIn = (e: FocusEvent) => { const el = tipTarget(e); if (el && (e.target as HTMLElement).matches?.(":focus-visible")) show(el); };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") { hide(); return; }
      const el = tipTarget(e); clearTimeout(press);
      if (el) press = window.setTimeout(() => { show(el); suppressClick = true; timer = window.setTimeout(hide, 3500); }, 550);
    };
    const up = () => clearTimeout(press);
    const click = (e: MouseEvent) => { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); } };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerover", over, opts); document.addEventListener("pointerout", out, opts);
    document.addEventListener("focusin", focusIn, true); document.addEventListener("focusout", hide, true);
    document.addEventListener("pointerdown", down, opts); document.addEventListener("pointerup", up, opts); document.addEventListener("pointercancel", up, opts);
    document.addEventListener("click", click, true); document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", hide, true); window.addEventListener("blur", hide);
    return () => {
      clearTimeout(timer); clearTimeout(press);
      document.removeEventListener("pointerover", over, opts); document.removeEventListener("pointerout", out, opts);
      document.removeEventListener("focusin", focusIn, true); document.removeEventListener("focusout", hide, true);
      document.removeEventListener("pointerdown", down, opts); document.removeEventListener("pointerup", up, opts); document.removeEventListener("pointercancel", up, opts);
      document.removeEventListener("click", click, true); document.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", hide, true); window.removeEventListener("blur", hide);
    };
  }, []);
  // clamp horizontally once the size is known
  const [dx, setDx] = useState(0);
  useEffect(() => {
    const el = tipRef.current; if (!el || !tip) return;
    const w = el.offsetWidth, left = tip.x - w / 2, max = window.innerWidth - 8;
    setDx(left < 8 ? 8 - left : left + w > max ? max - (left + w) : 0);
  }, [tip]);
  return (
    <div ref={tipRef} id={TIP_ID} role="tooltip" className={`tooltip ${tip?.below ? "below" : ""}`} hidden={!tip} data-testid="tooltip"
      style={tip ? { left: tip.x + dx, top: tip.below ? tip.y + 8 : tip.y - 8 } : undefined}>{tip?.text}</div>
  );
}

// ---- help dialog store
let openTopic: HelpTopic | null = null;
const helpListeners = new Set<() => void>();
export function openHelp(topic: HelpTopic | null) { openTopic = topic; for (const l of helpListeners) l(); }
const useHelpTopic = () => useSyncExternalStore((l) => { helpListeners.add(l); return () => { helpListeners.delete(l); }; }, () => openTopic, () => openTopic);

/** Small "?" button next to a section title; opens that section's help. */
export function HelpButton({ topic }: { topic: HelpTopic }) {
  const lang = useLang();
  const title = HELP[lang][topic].title;
  return <button type="button" className="help-q" onClick={(e) => { e.stopPropagation(); e.preventDefault(); openHelp(topic); }} aria-label={t("Help: {topic}", { topic: title })} data-tip={t("What is {topic}? Opens the help for this section.", { topic: title })} data-help-topic={topic}><CircleHelp size={14} /></button>;
}

export function HelpDialog() {
  const lang = useLang(), topic = useHelpTopic();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!topic) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") openHelp(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [topic]);
  if (!topic) return null;
  const h = HELP[lang][topic];
  return (
    <div className="modal-backdrop" onClick={() => openHelp(null)}>
      <div className="modal help" role="dialog" aria-modal="true" aria-labelledby="help-title" data-testid="help-dialog" data-topic={topic} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2 id="help-title">{h.title}</h2><button ref={closeRef} className="tb-btn icon-only" onClick={() => openHelp(null)} aria-label={t("Close help")}><X size={17} /></button></div>
        <p className="help-intro">{h.intro}</p>
        <ul className="help-list">{h.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        {h.tip && <p className="help-tip">{h.tip}</p>}
        <nav className="help-topics" aria-label={t("Help topics")}>
          {HELP_ORDER.map((k) => <button key={k} className={`chip ${k === topic ? "on" : ""}`} aria-current={k === topic ? "page" : undefined} onClick={() => openHelp(k)}>{HELP[lang][k].title}</button>)}
        </nav>
      </div>
    </div>
  );
}

/** Toggles English ⇄ Swedish (remembered in this browser). */
export function LanguageButton({ className = "tb-btn" }: { className?: string }) {
  const lang = useLang();
  const cur = LANGS.find((l) => l.id === lang)!, next = LANGS.find((l) => l.id !== lang)!;
  return (
    <button className={`${className} lang-btn`} onClick={() => setLang(next.id)} aria-label={t("Language: {current}. Switch to {next}", { current: cur.name, next: next.name })}
      data-tip={t("Language: {current}. Click to switch to {next}.", { current: cur.name, next: next.name })} data-testid="lang-toggle" lang={lang}>
      <Languages size={16} /><span>{cur.short}</span>
    </button>
  );
}
