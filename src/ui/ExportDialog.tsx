// Export, project files and local backup.
import { useEffect, useRef, useState } from "react";
import { Copy, Download, FolderOpen, X } from "lucide-react";
import { t, tr, useLang } from "../i18n/i18n";
import type { CvdType } from "../core/cvd";
import { exportComparisonSvg, exportContrastReport, exportCss, exportHex, exportJson, exportSvgSheet, exportTokens, slug } from "../core/export";
import { parseProject, PROJECT_EXTENSION, serializeProject } from "../core/project";
import { getKv, makeBackup, restoreBackup } from "../storage/db";
import { getState, openDoc, reloadSaved, setState, toast, useStore } from "../state/store";
import { VISION_NAME } from "./Stage";

export function download(name: string, data: string | Blob, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type: `${type};charset=utf-8` }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("svg")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

const COMPARE_TYPES: CvdType[] = ["protan", "deutan", "tritan", "achroma"];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  useLang();
  const doc = useStore((s) => s.history.present);
  const [types, setTypes] = useState<CvdType[]>(["protan", "deutan", "tritan"]);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const base = slug(doc.palette.name);
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast(t("Copied to the clipboard")); } catch { toast(t("Copy is not available here")); } };
  const comparison = () => exportComparisonSvg(doc, [{ label: t("Original"), vision: null }, ...types.map((type) => ({ label: t(VISION_NAME[type]), vision: { type, severity: 1 } }))]);
  const png = async (svg: string, name: string) => { setBusy(true); try { download(name, await svgToPng(svg)); } catch { toast(t("The PNG could not be created")); } finally { setBusy(false); } };

  const rows: { label: string; note: string; ext: string; make: () => string; type: string; testid: string }[] = [
    { label: t("HEX values"), note: t("One value per line"), ext: "txt", make: () => exportHex(doc), type: "text/plain", testid: "hex" },
    { label: t("CSS custom properties"), note: t("Palette colours and semantic roles"), ext: "css", make: () => exportCss(doc), type: "text/css", testid: "css" },
    { label: t("JSON palette data"), note: t("HEX, RGB, HSL, OKLCH and roles"), ext: "json", make: () => exportJson(doc), type: "application/json", testid: "json" },
    { label: t("Design tokens"), note: t("W3C Design Tokens format"), ext: "tokens.json", make: () => exportTokens(doc), type: "application/json", testid: "tokens" },
    { label: t("Contrast report"), note: t("Markdown table of WCAG results"), ext: "contrast.md", make: () => exportContrastReport(doc), type: "text/markdown", testid: "report" },
  ];

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    try { const p = parseProject(await file.text()); openDoc(p.doc, p.original); toast(t("Opened {name}", { name: p.doc.palette.name })); onClose(); }
    catch (e) { toast(tr((e as Error).message)); }
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await restoreBackup(await file.text());
      await reloadSaved();
      setState({ favourites: (await getKv<string[]>("favourites")) ?? getState().favourites });
      if (r.current) openDoc(r.current);
      toast(t("Restored {p} palettes and {f} favourites", { p: r.palettes, f: r.favourites }));
    } catch (e) { toast(tr((e as Error).message)); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal export" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()} data-testid="export-dialog">
        <div className="modal-head"><h2 id="export-title">{t("Export")}</h2><button ref={closeRef} className="tb-btn icon-only" onClick={onClose} aria-label={t("Close")}><X size={17} /></button></div>
        <p className="help-tip">{t("Exports always contain your original colours. The colour vision simulation is never applied to them, except in the comparison sheet, where simulated rows are labelled.")}</p>

        <h3 className="mini-title">{t("Palette")}</h3>
        <ul className="export-list">
          {rows.map((r) => (
            <li key={r.testid}>
              <span><b>{r.label}</b><small>{r.note}</small></span>
              <button className="btn" onClick={() => void copy(r.make())} aria-label={t("Copy {what}", { what: r.label })}><Copy size={14} /></button>
              <button className="btn" onClick={() => download(`${base}.${r.ext}`, r.make(), r.type)} data-testid={`export-${r.testid}`}><Download size={14} />.{r.ext.split(".").pop()}</button>
            </li>
          ))}
          <li>
            <span><b>{t("Swatch sheet")}</b><small>{t("Colours with HEX, RGB and OKLCH values")}</small></span>
            <button className="btn" onClick={() => download(`${base}-swatches.svg`, exportSvgSheet(doc), "image/svg+xml")} data-testid="export-svg"><Download size={14} />.svg</button>
            <button className="btn" disabled={busy} onClick={() => void png(exportSvgSheet(doc), `${base}-swatches.png`)} data-testid="export-png"><Download size={14} />.png</button>
          </li>
        </ul>

        <h3 className="mini-title">{t("Colour vision comparison sheet")}</h3>
        <fieldset className="cmp-types">
          <legend className="sr-only">{t("Simulations to include")}</legend>
          {COMPARE_TYPES.map((type) => (
            <label key={type} className="toggle"><input type="checkbox" checked={types.includes(type)} onChange={(e) => setTypes(e.target.checked ? [...types, type] : types.filter((x) => x !== type))} />{t(VISION_NAME[type])}</label>
          ))}
        </fieldset>
        <div className="row-actions">
          <button className="btn" onClick={() => download(`${base}-colour-vision.svg`, comparison(), "image/svg+xml")} data-testid="export-compare-svg"><Download size={14} />.svg</button>
          <button className="btn" disabled={busy} onClick={() => void png(comparison(), `${base}-colour-vision.png`)}><Download size={14} />.png</button>
        </div>

        <h3 className="mini-title">{t("Project")}</h3>
        <div className="row-actions wrap">
          <button className="btn" onClick={() => download(`${base}${PROJECT_EXTENSION}`, serializeProject(doc, getState().original ?? undefined), "application/json")} data-testid="export-project"><Download size={14} />{t("Save project file")}</button>
          <label className="btn file-btn"><FolderOpen size={14} />{t("Open project file")}<input type="file" accept=".json,application/json" onChange={(e) => { void openProject(e.target.files?.[0]); e.target.value = ""; }} data-testid="open-project" /></label>
        </div>

        <h3 className="mini-title">{t("Backup")}</h3>
        <div className="row-actions wrap">
          <button className="btn" onClick={async () => download(`color-lab-backup-${new Date().toISOString().slice(0, 10)}.json`, await makeBackup(doc), "application/json")}><Download size={14} />{t("Download backup")}</button>
          <label className="btn file-btn"><FolderOpen size={14} />{t("Restore backup")}<input type="file" accept=".json,application/json" onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
        <p className="legend-note">{t("Saved palettes, favourites and the current palette are stored in this browser only. Clearing site data removes them, so download a backup now and then.")}</p>
      </div>
    </div>
  );
}
