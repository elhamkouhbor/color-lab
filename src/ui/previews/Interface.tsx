// Interface preview: a small print-studio application. Statuses always carry an icon and a label,
// the form error has an icon and a message, and the chart legend is labelled (patterns optional),
// so meaning never depends on colour alone.
import { useId } from "react";
import { setState, useStore } from "../../state/store";
import { AlertCircle, AlertTriangle, BarChart3, Check, CheckCircle2, Clock3, FileText, Home, Layers, Plus, Search, Settings, Users, XCircle } from "lucide-react";
import type { Paint } from "../../core/palette";
import { t } from "../../i18n/i18n";
import { paintVars } from "./vars";

type Status = "printed" | "proof" | "failed" | "queued";
const STATUS_ICON = { printed: CheckCircle2, proof: AlertTriangle, failed: XCircle, queued: Clock3 };

export function InterfacePreview({ paint }: { paint: Paint }) {
  const patterns = useStore((s) => s.chartPatterns);
  const setPatterns = (v: boolean) => setState({ chartPatterns: v });
  const uid = useId().replace(/:/g, "");
  const series = paint.accents.slice(0, 4);
  const months = [t("Jan"), t("Feb"), t("Mar"), t("Apr")];
  const data = [[12, 18, 9, 14], [8, 11, 15, 10], [5, 7, 6, 12], [9, 4, 11, 7]];
  const seriesNames = [t("Cotton rag"), t("Recycled"), t("Coated"), t("Kraft")];
  const statusLabel: Record<Status, string> = { printed: t("Printed"), proof: t("Waiting for proof"), failed: t("Failed"), queued: t("Queued") };
  const statusColor: Record<Status, string> = { printed: paint.success, proof: paint.warning, failed: paint.danger, queued: paint.muted };
  const jobs: [string, string, Status][] = [[t("Exhibition posters"), "A2 · 40", "printed"], [t("Wedding invitations"), "A6 · 120", "proof"], [t("Zine, issue 4"), "A5 · 300", "failed"], [t("Menu cards"), "A4 · 60", "queued"]];
  const pat = ["", `url(#${uid}-p1)`, `url(#${uid}-p2)`, `url(#${uid}-p3)`];
  return (
    <div className="pv pv-ui" style={paintVars(paint)} data-testid="pv-interface">
      <aside className="u-side">
        <span className="u-brand"><span className="u-mark" />{t("Print Room")}</span>
        <nav aria-label={t("Example navigation")}>
          {[[Home, t("Overview")], [FileText, t("Jobs")], [Users, t("Clients")], [Layers, t("Papers")], [Settings, t("Settings")]].map(([Icon, label], i) => {
            const I = Icon as typeof Home;
            return <span key={i} className={`u-nav ${i === 0 ? "on" : ""}`}><I size={16} aria-hidden="true" />{label as string}</span>;
          })}
        </nav>
      </aside>
      <div className="u-main">
        <header className="u-top">
          <h3 className="u-h1">{t("Overview")}</h3>
          <span className="u-search"><Search size={15} aria-hidden="true" />{t("Search jobs")}</span>
          <span className="u-btn primary"><Plus size={15} aria-hidden="true" />{t("New job")}</span>
        </header>

        <div className="u-stats">
          {([[t("Printed this week"), "24", "printed", t("12% more than last week")], [t("Waiting for proof"), "5", "proof", t("2 due today")], [t("Failed prints"), "2", "failed", t("Paper jam on press 2")]] as [string, string, Status, string][]).map(([label, value, s, note]) => {
            const I = STATUS_ICON[s];
            return (
              <div key={label} className="u-card u-stat">
                <span className="u-stat-label">{label}</span>
                <span className="u-stat-value">{value}</span>
                <span className="u-stat-note"><I size={14} color={statusColor[s]} aria-hidden="true" />{note}</span>
              </div>
            );
          })}
        </div>

        <div className="u-grid">
          <section className="u-card u-chart">
            <div className="u-card-head">
              <h4><BarChart3 size={16} aria-hidden="true" />{t("Prints by paper")}</h4>
              <label className="u-toggle"><input type="checkbox" checked={patterns} onChange={(e) => setPatterns(e.target.checked)} />{t("Patterns")}</label>
            </div>
            <svg className="u-bars" viewBox="0 0 340 170" role="img" aria-label={t("Bar chart of prints by paper and month")}>
              <defs>
                <pattern id={`${uid}-p1`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill={series[1 % series.length]} /><rect width="2.2" height="6" fill={paint.surface} /></pattern>
                <pattern id={`${uid}-p2`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={series[2 % series.length]} /><circle cx="3" cy="3" r="1.3" fill={paint.surface} /></pattern>
                <pattern id={`${uid}-p3`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={series[3 % series.length]} /><rect y="2" width="6" height="2" fill={paint.surface} /></pattern>
              </defs>
              {[0, 1, 2, 3].map((k) => <line key={k} x1="30" x2="336" y1={20 + k * 40} y2={20 + k * 40} stroke={paint.border} strokeWidth="1" />)}
              {[20, 15, 10, 5].map((v, k) => <text key={v} x="22" y={24 + k * 40} textAnchor="end" fontSize="9" fill={paint.muted}>{v}</text>)}
              {months.map((m, mi) => (
                <g key={m}>
                  {series.map((c, si) => {
                    const v = data[mi][si], h = (v / 20) * 120;
                    return <rect key={si} x={40 + mi * 76 + si * 15} y={140 - h} width="12" height={h} fill={patterns && pat[si] ? pat[si] : c} />;
                  })}
                  <text x={40 + mi * 76 + series.length * 7.5} y="156" textAnchor="middle" fontSize="10" fill={paint.muted}>{m}</text>
                </g>
              ))}
            </svg>
            <ul className="u-legend">
              {series.map((c, i) => (
                <li key={i}><svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" rx="3" fill={patterns && pat[i] ? pat[i] : c} /></svg>{seriesNames[i]}</li>
              ))}
            </ul>
          </section>

          <section className="u-card u-form">
            <h4>{t("New print job")}</h4>
            <div className="u-field"><span className="u-label">{t("Client")}</span><span className="u-input">{t("Harbour Gallery")}</span></div>
            <div className="u-field"><span className="u-label">{t("Paper")}</span><span className="u-input">{t("Cotton rag, 300 g")}</span></div>
            <div className="u-field error">
              <span className="u-label">{t("Quantity")}</span>
              <span className="u-input">0</span>
              <span className="u-error"><AlertCircle size={14} aria-hidden="true" />{t("Enter a quantity between 1 and 500.")}</span>
            </div>
            <span className="u-check"><span className="u-box"><Check size={12} aria-hidden="true" /></span>{t("Email the client when printed")}</span>
            <div className="u-actions"><span className="u-btn primary">{t("Create job")}</span><span className="u-btn">{t("Save draft")}</span></div>
          </section>
        </div>

        <section className="u-card u-jobs">
          <h4>{t("Recent jobs")}</h4>
          <ul>
            {jobs.map(([name, meta, s]) => {
              const I = STATUS_ICON[s];
              return (
                <li key={name}>
                  <span className="u-job">{name}<small>{meta}</small></span>
                  <span className={`u-pill ${s}`}><I size={14} color={statusColor[s]} aria-hidden="true" />{statusLabel[s]}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
