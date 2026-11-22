// Semantic roles: which palette colour the previews use for background, text, accents and so on.
import { useMemo } from "react";
import { HelpButton } from "../help/Help";
import { t, tk, useLang } from "../../i18n/i18n";
import { contrastRatio } from "../../core/color";
import { formatRatio } from "../../core/contrast";
import { resolveRoles, ROLE_LABEL, ROLES, type Role } from "../../core/palette";
import { setDark, setRole, setState, useStore } from "../../state/store";

const ROLE_NOTE: Record<Role, string> = {
  background: tk("Page background"),
  foreground: tk("Body text and headings"),
  surface: tk("Cards and panels"),
  primary: tk("Main buttons, links and highlights"),
  secondary: tk("Supporting accents and tags"),
  buttonText: tk("Text on primary buttons"),
  border: tk("Lines, dividers and field outlines"),
};

export function RolesTab() {
  useLang();
  const d = useStore((s) => s.history.present);
  const r = useMemo(() => resolveRoles(d.palette, d.roles, d.dark), [d]);
  const checks: [string, Role, Role, number][] = [
    [t("Text on background"), "foreground", "background", 4.5],
    [t("Text on surface"), "foreground", "surface", 4.5],
    [t("Button text on primary"), "buttonText", "primary", 4.5],
    [t("Primary on background"), "primary", "background", 3],
    [t("Borders on background"), "border", "background", 3],
  ];
  return (
    <div className="rtab">
      <section className="panel-section">
        <h2 className="section-title">{t("Semantic roles")}<HelpButton topic="roles" /></h2>
        <p className="legend-note">{t("Choose which palette colour each part of the designs uses. Automatic picks a sensible colour from the palette.")}</p>
        <label className="toggle dark-toggle"><input type="checkbox" checked={d.dark} onChange={(e) => setDark(e.target.checked)} data-testid="dark-arrangement" />{t("Dark arrangement (automatic background is the darkest colour)")}</label>
        <ul className="role-list">
          {ROLES.map((role) => (
            <li key={role}>
              <span className="role-sw" style={{ background: r[role].hex }} aria-hidden="true" />
              <label className="role-field">
                <span className="role-name">{t(ROLE_LABEL[role])}<small>{t(ROLE_NOTE[role])}</small></span>
                <select value={String(d.roles[role])} onChange={(e) => setRole(role, e.target.value === "auto" ? "auto" : Number(e.target.value))} data-testid={`role-${role}`}>
                  <option value="auto">{r[role].derived ? t("Automatic (derived {hex})", { hex: r[role].hex }) : t("Automatic (colour {n})", { n: (r[role].index ?? 0) + 1 })}</option>
                  {d.palette.colors.map((c, i) => <option key={i} value={i}>{t("Colour {n}", { n: i + 1 })} · {c.hex.toUpperCase()}{c.name ? ` · ${c.name}` : ""}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ul>
        <p className="legend-note">{t("Derived colours are mixed from the background and foreground in OKLab. They are not palette colours.")}</p>
      </section>
      <section className="panel-section">
        <h2 className="section-title">{t("Quick contrast check")}</h2>
        <ul className="quick-checks">
          {checks.map(([label, a, b, need]) => {
            const ratio = contrastRatio(r[a].hex, r[b].hex), ok = ratio >= need;
            return (
              <li key={label}>
                <button className="link-btn qc" onClick={() => setState({ contrast: { fg: r[a].hex, bg: r[b].hex, fgAlpha: 1, bgAlpha: 1, base: "#ffffff" }, tab: "contrast" })} data-tip={t("Open this pair in the contrast lab")}>
                  <span className="qc-sample" style={{ background: r[b].hex, color: r[a].hex }}>Aa</span>
                  <span className="qc-label">{label}<small>{t("needs {n}:1", { n: need })}</small></span>
                  <span className={`badge ${ok ? "good" : "bad"}`}>{ok ? "✓ " : "✕ "}{formatRatio(ratio)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
