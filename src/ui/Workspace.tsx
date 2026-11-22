// Application shell: top bar, palette library (left), stage with vision controls and previews (centre),
// inspector (right). On phones one pane is shown at a time with a bottom tab bar.
import { useEffect, useState } from "react";
import { ArrowUpRight, CircleHelp, Download, Info, Library as LibraryIcon, Monitor, Moon, PanelsTopLeft, Redo2, Save, SlidersHorizontal, Sun, Undo2 } from "lucide-react";
import { LogoFull } from "./brand/Logo";
import { LanguageButton, openHelp } from "./help/Help";
import { t, useLang } from "../i18n/i18n";
import { applyTheme, readTheme, type ThemeChoice } from "./theme";
import { boot, doRedo, doUndo, renamePalette, saveCurrent, setState, toast, useStore, type Pane } from "../state/store";
import { BRAND } from "../app/brand";
import { navigate } from "../App";
import { Library } from "./Library";
import { Stage } from "./Stage";
import { Inspector } from "./Inspector";
import { ExportDialog } from "./ExportDialog";

export function Workspace() {
  useLang();
  const name = useStore((s) => s.history.present.palette.name);
  const canUndo = useStore((s) => s.history.past.length > 0);
  const canRedo = useStore((s) => s.history.future.length > 0);
  const pane = useStore((s) => s.pane);
  const msg = useStore((s) => s.toast);
  const ready = useStore((s) => s.ready);
  const [exportOpen, setExportOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);

  useEffect(() => { void boot(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); void save(); return; }
      if (typing) return;
      if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); doRedo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const save = async () => { try { await saveCurrent(); toast(t("Saved in this browser")); } catch { toast(t("Could not save in this browser")); } };
  const cycleTheme = () => { const next: ThemeChoice = theme === "system" ? "light" : theme === "light" ? "dark" : "system"; applyTheme(next); setTheme(next); };
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeName = theme === "light" ? t("light") : theme === "dark" ? t("dark") : t("system");

  return (
    <div className="app-shell cl-shell" data-pane={pane} data-ready={ready ? "1" : "0"}>
      <header className="topbar">
        <a className="brand-btn" href={import.meta.env.BASE_URL} aria-label={t("Color Lab home")}><LogoFull /></a>
        <a className="by-line hide-mobile" href={BRAND.portfolio} rel="noopener" data-tip={t("Elham Kouhbor's portfolio and other design tools")}>{t("by Elham Kouhbor")}<ArrowUpRight size={12} aria-hidden="true" /></a>
        <span className="tb-sep hide-mobile" aria-hidden="true" />
        <input className="project-title" value={name} onChange={(e) => renamePalette(e.target.value)} aria-label={t("Palette name")} data-tip={t("Palette name. Click to rename.")} spellCheck={false} />
        <div className="top-actions">
          <button className={`tb-btn lib-toggle ${pane === "library" ? "on" : ""}`} onClick={() => setState({ pane: pane === "library" ? "stage" : "library" })} aria-pressed={pane === "library"} data-tip={t("Show or hide the palette library")}><LibraryIcon size={16} /><span>{t("Library")}</span></button>
          <div className="undo-redo">
            <button className="tb-btn icon-only" onClick={doUndo} disabled={!canUndo} aria-label={t("Undo")} data-tip={t("Undo (Ctrl+Z)")}><Undo2 size={17} /></button>
            <button className="tb-btn icon-only" onClick={doRedo} disabled={!canRedo} aria-label={t("Redo")} data-tip={t("Redo (Ctrl+Shift+Z)")}><Redo2 size={17} /></button>
          </div>
          <span className="tb-sep" aria-hidden="true" />
          <button className="tb-btn" onClick={save} data-tip={t("Save this palette in this browser (Ctrl+S). It appears under My palettes.")}><Save size={16} /><span>{t("Save")}</span></button>
          <button className="tb-btn" onClick={() => setExportOpen(true)} data-tip={t("Export colours, tokens, swatch sheets, reports and projects")} data-testid="open-export"><Download size={16} /><span>{t("Export")}</span></button>
        </div>
        <div className="top-right">
          <LanguageButton />
          <button className="tb-btn icon-only theme-btn" onClick={cycleTheme} aria-label={t("Theme: {name}. Switch theme", { name: themeName })} data-tip={t("Theme: system, light or dark")}><ThemeIcon size={17} /></button>
          <button className="tb-btn icon-only" onClick={() => openHelp("overview")} aria-label={t("Help")} data-tip={t("Help: getting started")}><CircleHelp size={17} /></button>
          <button className="tb-btn icon-only" onClick={() => navigate("/about")} aria-label={t("About, sources and licences")} data-tip={t("About, palette sources, colour science and licences")}><Info size={17} /></button>
        </div>
      </header>

      <aside className="cl-library" aria-label={t("Palette library")}><Library /></aside>
      <main className="stage" id="main"><Stage /></main>
      <aside className="inspector-col cl-inspector" aria-label={t("Inspector")}><Inspector /></aside>

      <nav className="mobile-tabs" aria-label={t("Sections")}>
        {([["library", LibraryIcon, t("Library")], ["stage", PanelsTopLeft, t("Preview")], ["inspect", SlidersHorizontal, t("Edit and check")]] as [Pane, typeof LibraryIcon, string][]).map(([id, Icon, label]) => (
          <button key={id} className={pane === id ? "on" : ""} aria-current={pane === id ? "page" : undefined} onClick={() => setState({ pane: id })} data-testid={`tab-${id}`}><Icon size={19} /><span>{label}</span></button>
        ))}
      </nav>
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      <div className="toast" role="status" aria-live="polite">{msg}</div>
    </div>
  );
}
