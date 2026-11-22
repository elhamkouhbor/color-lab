// Website preview: a complete small studio website painted only with the resolved palette roles.
// Every colour comes from `paint` (no opacity on coloured elements), so a simulated paint changes
// every pixel of the composition consistently.
import { ArrowRight, Menu } from "lucide-react";
import type { Paint } from "../../core/palette";
import { t } from "../../i18n/i18n";
import { paintVars } from "./vars";

export function WebsitePreview({ paint }: { paint: Paint }) {
  const a = paint.accents;
  const at = (i: number) => a[i % a.length];
  return (
    <div className="pv pv-web" style={paintVars(paint)} data-testid="pv-website">
      <header className="w-head">
        <span className="w-logo">Mira<span className="w-dot" /></span>
        <nav className="w-nav" aria-label={t("Example navigation")}>
          <span className="on">{t("Work")}</span><span>{t("Studio")}</span><span>{t("Journal")}</span><span>{t("Shop")}</span>
        </nav>
        <span className="w-btn small">{t("Visit the studio")}</span>
        <span className="w-menu" aria-hidden="true"><Menu size={18} /></span>
      </header>

      <section className="w-hero">
        <div className="w-hero-text">
          <p className="w-eyebrow">{t("New collection")}</p>
          <h3 className="w-h1">{t("Objects made slowly, for everyday light.")}</h3>
          <p className="w-lead">{t("Hand-thrown ceramics and woven textiles, glazed and dyed in small batches in our studio by the sea.")}</p>
          <div className="w-actions">
            <span className="w-btn">{t("Explore the collection")}<ArrowRight size={15} /></span>
            <span className="w-btn ghost">{t("Book a visit")}</span>
          </div>
        </div>
        <div className="w-hero-art" aria-hidden="true">
          <svg viewBox="0 0 400 340" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width="400" height="340" rx="18" fill={paint.surface} />
            <circle cx="290" cy="96" r="58" fill={at(1)} />
            <rect x="0" y="246" width="400" height="94" fill={paint.secondarySoft} />
            {/* vessels */}
            <path d="M70 250 C58 200 62 150 92 120 L92 96 L122 96 L122 120 C152 150 156 200 144 250 Z" fill={at(0)} />
            <rect x="88" y="88" width="38" height="12" rx="3" fill={at(0)} />
            <path d="M170 250 C160 228 162 196 176 182 L240 182 C254 196 256 228 246 250 Z" fill={at(2)} />
            <path d="M268 250 C258 232 262 214 276 208 C290 186 330 186 344 208 C358 214 362 232 352 250 Z" fill={at(3)} />
            <path d="M176 196 L240 196" stroke={paint.bg} strokeWidth="3" />
            <path d="M284 222 C300 230 320 230 336 222" stroke={paint.bg} strokeWidth="3" fill="none" />
            <rect x="40" y="250" width="320" height="6" rx="3" fill={paint.fg} />
          </svg>
        </div>
      </section>

      <section className="w-section">
        <div className="w-section-head">
          <h4 className="w-h2">{t("From the studio")}</h4>
          <span className="w-link">{t("All stories")}<ArrowRight size={14} /></span>
        </div>
        <div className="w-cards">
          {[
            { title: t("Glaze studies"), text: t("Forty test tiles, three kilns and one quiet blue that finally held its colour."), tag: t("Process") },
            { title: t("The weaving room"), text: t("Linen warps dyed with plants from the garden, woven on a floor loom from 1952."), tag: t("Textiles") },
            { title: t("Visiting hours"), text: t("Open on Fridays and Saturdays. Watch a throwing session and take home a seconds piece."), tag: t("Studio") },
          ].map((c, i) => (
            <article key={i} className="w-card">
              <div className="w-card-art" aria-hidden="true">
                <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice">
                  <rect width="300" height="150" fill={at(i + 1)} />
                  {i === 0 && <>{[0, 1, 2, 3, 4].map((k) => <rect key={k} x={24 + k * 54} y="40" width="42" height="70" rx="6" fill={k % 2 ? paint.bg : at(i + 2)} />)}</>}
                  {i === 1 && <>{[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <rect key={k} x={k * 38} y="0" width="18" height="150" fill={k % 2 ? at(i + 2) : paint.surface} />)}</>}
                  {i === 2 && <><circle cx="150" cy="150" r="96" fill={paint.bg} /><circle cx="150" cy="150" r="56" fill={at(i + 2)} /></>}
                </svg>
              </div>
              <div className="w-card-body">
                <span className="w-tag">{c.tag}</span>
                <h5 className="w-h3">{c.title}</h5>
                <p>{c.text}</p>
                <span className="w-link">{t("Read more")}<ArrowRight size={14} /></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="w-quote">
        <p className="w-quote-text">{t("“Colour is the first thing you notice and the last thing you forget.”")}</p>
        <p className="w-quote-by">{t("Notes from the glaze book")}</p>
      </section>

      <section className="w-news">
        <div>
          <h4 className="w-h2">{t("Letters from the studio")}</h4>
          <p className="w-muted">{t("Four letters a year about new work, open days and the occasional failed firing.")}</p>
        </div>
        <div className="w-form">
          <span className="w-input">{t("Your email address")}</span>
          <span className="w-btn">{t("Subscribe")}</span>
        </div>
      </section>

      <footer className="w-foot">
        <span className="w-logo small">Mira<span className="w-dot" /></span>
        <span>{t("Harbour Road 4, by the sea")}</span>
        <span className="w-foot-links"><span>Instagram</span><span>{t("Journal")}</span><span>{t("Contact")}</span></span>
      </footer>
    </div>
  );
}

