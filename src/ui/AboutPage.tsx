// About: privacy, palette sources and licences, colour science and its limits, software licences.
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { LogoFull } from "./brand/Logo";
import { LanguageButton } from "./help/Help";
import { t, useLang } from "../i18n/i18n";
import { BRAND } from "../app/brand";
import { CATEGORIES, CATEGORY_LABEL, CATEGORY_NOTE, PALETTES, SOURCES } from "../data/library";
import { navigate } from "../App";

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href} rel="noopener" target="_blank">{children}<ArrowUpRight size={12} aria-hidden="true" /></a>;

export default function AboutPage() {
  useLang();
  const count = (id: string) => PALETTES.filter((p) => p.source === id).length;
  return (
    <div className="about-page">
      <header className="about-head">
        <button className="tb-btn" onClick={() => navigate("/")} data-testid="about-back"><ArrowLeft size={16} />{t("Back to Color Lab")}</button>
        <LogoFull />
        <LanguageButton />
      </header>
      <main className="about-main">
        <h1>{t("About Color Lab")}</h1>
        <p className="lead">{t("Color Lab is a colour exploration tool by Elham Kouhbor, part of the same family as Elham Fold Studio and Elham Dieline Creator. It is made for design students, graphic designers and anyone learning how colours work together.")}</p>
        <p className="lead"><Ext href={BRAND.portfolio}>{t("Elham Kouhbor's portfolio")}</Ext> · {BRAND.siblings.map((s, i) => <span key={s.url}>{i ? " · " : ""}<Ext href={s.url}>{s.name}</Ext></span>)} · <Ext href={BRAND.repository}>{t("Source code")}</Ext></p>

        <section className="about-card">
          <h2>{t("Privacy and storage")}</h2>
          <p>{t("Color Lab runs entirely in your browser. There is no account, no server processing, no analytics and no AI. Palettes, favourites and images never leave your computer.")}</p>
          <p>{t("Saved palettes, favourites and your current work are kept in this browser's IndexedDB storage. Browsers can clear this storage, for example when you clear site data, so it is not a permanent backup. Use Export, then Download backup, to keep a copy.")}</p>
          <p>{t("After the first visit the app is cached, so it also works without a network connection.")}</p>
        </section>

        <section className="about-card" id="sources">
          <h2>{t("Palette sources and licences")}</h2>
          <p>{t("The library contains {n} palettes, bundled with the app. No palette is fetched while you use it.", { n: PALETTES.length })}</p>
          {CATEGORIES.map((c) => <p key={c}><b>{t(CATEGORY_LABEL[c])}.</b> {t(CATEGORY_NOTE[c])}</p>)}
          <ul className="source-list">
            {SOURCES.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b> ({t("{n} {n|palette|palettes}", { n: count(s.id) })})<br />
                {s.by}. {t("Licence")}: <Ext href={s.licenceUrl}>{s.licence}</Ext> · <Ext href={s.url}>{t("Source")}</Ext>
              </li>
            ))}
          </ul>
          <p>{t("Data: The Dictionary of Color Combinations (colorcombinations.org), CC BY 4.0. Changes: the archive was converted to Color Lab's format, and the em dashes and semicolons in the editorial descriptions were replaced with commas. Thematic collections and colour names are kept as published.")}</p>
          <p>{t("Generated colours (relationships, variations, suggestions) are always your own edits. They are never presented as historical or curated palettes.")}</p>
        </section>

        <section className="about-card" id="method">
          <h2>{t("Colour science")}</h2>
          <h3>{t("Contrast")}</h3>
          <p>{t("Contrast follows WCAG 2.2: relative luminance from linearised sRGB (IEC 61966-2-1) with the weights 0.2126, 0.7152 and 0.0722, and the ratio (L1 + 0.05) / (L2 + 0.05). Pass or fail uses the unrounded ratio. Translucent colours are composited source over in sRGB, as browsers paint them, before measuring.")}</p>
          <h3>{t("Colour vision simulation")}</h3>
          <p>{t("Protanopia, deuteranopia and tritanopia, and their partial forms, use the physiologically based model of Machado, Oliveira and Fernandes (2009). Each colour is converted from sRGB to linear light, multiplied by the published 3 × 3 matrix for the type and severity (linearly interpolated between the published steps of 0.1) and converted back. Results outside the displayable range are clipped per channel. The same function is used for swatches, previews, exports and images, and it is tested against the colorspacious reference implementation.")}</p>
          <p>{t("Achromatopsia is shown as luminance only. This is a simplification: the condition also brings reduced sharpness and strong light sensitivity, which no colour transform can show.")}</p>
          <p><Ext href="https://doi.org/10.1109/TVCG.2009.113">Machado, G. M., Oliveira, M. M. &amp; Fernandes, L. A. F. (2009). A Physiologically-based Model for Simulation of Color Vision Deficiency. IEEE TVCG 15(6), 1291 to 1298.</Ext></p>
          <h3>{t("Distinguishability")}</h3>
          <p>{t("Close pairs are found with the CIEDE2000 colour difference between simulated colours. Below 10 they may be hard to tell apart, below 5 very hard. These bands are a rough screening aid: patch size, viewing distance and individual vision all matter.")}</p>
          <h3>{t("Editing")}</h3>
          <p>{t("OKLCH and OKLab (Björn Ottosson, 2020) are used for editing, mixing and relationships. Colours outside sRGB are mapped with the CSS Color 4 method, which lowers chroma at constant lightness and hue.")}</p>
          <h3>{t("Limits")}</h3>
          <p>{t("Simulations approximate an average observer. They cannot reproduce a particular person's vision, a display's calibration or the viewing conditions, and they are not a diagnosis. Passing contrast checks or a simulation does not make a design accessible on its own.")}</p>
        </section>

        <section className="about-card">
          <h2>{t("Software and fonts")}</h2>
          <ul className="source-list">
            <li>React (MIT), lucide-react icons (ISC), culori (MIT): <Ext href="https://culorijs.org/">culorijs.org</Ext></li>
            <li>Fraunces and Manrope, SIL Open Font License 1.1, {t("used in the design previews")}</li>
            <li>{t("Machado matrices as tabulated in colorspacious (MIT) by Nathaniel J. Smith, from the authors' published data")}</li>
          </ul>
          <p>{t("Color Lab code © Elham Kouhbor. Version {v}.", { v: BRAND.version })}</p>
        </section>
      </main>
    </div>
  );
}
