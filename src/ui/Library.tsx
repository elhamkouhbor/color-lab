// Palette library: search, filters, favourites and locally saved palettes.
import { memo, useDeferredValue, useMemo, useState } from "react";
import { Search, Star, Trash2, X, SlidersHorizontal } from "lucide-react";
import { HelpButton } from "./help/Help";
import { t, tk, useLang } from "../i18n/i18n";
import { HUE_FAMILIES, type HueFamily } from "../core/color";
import { CATEGORIES, CATEGORY_LABEL, COLLECTIONS, filterPalettes, MOODS, NO_FILTER, PALETTES, SOURCE_SHORT, SOURCES, type Category, type CountFilter, type Filter, type LibraryPalette } from "../data/library";
import { openLibraryPalette, openPalette, removeSaved, toggleFavourite, useStore } from "../state/store";

const HUE_DOT: Record<HueFamily, string> = { red: "#c8382c", orange: "#e07b25", yellow: "#e2bf2c", green: "#3f9a4c", teal: "#2b9a95", blue: "#3466c2", purple: "#7b4dc0", pink: "#d6609b", neutral: "#9a9a9a" };
const HUE_LABEL: Record<HueFamily, string> = { red: tk("Red"), orange: tk("Orange"), yellow: tk("Yellow"), green: tk("Green"), teal: tk("Teal"), blue: tk("Blue"), purple: tk("Purple"), pink: tk("Pink"), neutral: tk("Neutral") };
const MOOD_LABEL: Record<string, string> = { refined: tk("Refined"), warm: tk("Warm"), austere: tk("Austere"), bold: tk("Bold"), cool: tk("Cool"), solemn: tk("Solemn"), serene: tk("Serene"), earthy: tk("Earthy"), playful: tk("Playful") };
const KIND_LABEL: Record<string, string> = { light: tk("light scale"), dark: tk("dark scale"), categorical: tk("categorical"), sequential: tk("sequential"), diverging: tk("diverging") };
const SHORT_CAT: Record<Category, string> = { historical: tk("Historical"), editorial: tk("Editorial"), interface: tk("Interface"), dataviz: tk("Data viz") };
const PAGE = 120;

export function Library() {
  useLang();
  const favourites = useStore((s) => s.favourites);
  const saved = useStore((s) => s.saved);
  const currentSource = useStore((s) => s.history.present.palette.sourceId);
  const [f, setF] = useState<Filter>(NO_FILTER);
  const [more, setMore] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const query = useDeferredValue(f.query);
  const favSet = useMemo(() => new Set(favourites), [favourites]);
  const list = useMemo(() => filterPalettes(PALETTES, { ...f, query }, favSet), [f, query, favSet]);
  const set = (p: Partial<Filter>) => { setF((x) => ({ ...x, ...p })); setLimit(PAGE); };
  const active = (Object.keys(NO_FILTER) as (keyof Filter)[]).filter((k) => k !== "query" && k !== "category" && f[k] !== NO_FILTER[k]).length;

  return (
    <div className="lib">
      <div className="lib-head">
        <h2 className="section-title">{t("Palette library")}<HelpButton topic="library" /></h2>
        <label className="search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={f.query} onChange={(e) => set({ query: e.target.value })} placeholder={t("Search names, colours or hex")} aria-label={t("Search palettes")} data-testid="lib-search" />
          {f.query && <button className="link-btn" onClick={() => set({ query: "" })} aria-label={t("Clear search")}><X size={14} /></button>}
        </label>
        <div className="cat-chips" role="group" aria-label={t("Category")}>
          <button className={`chip ${f.category === "all" ? "on" : ""}`} aria-pressed={f.category === "all"} onClick={() => set({ category: "all" })}>{t("All")}</button>
          {CATEGORIES.map((c) => <button key={c} className={`chip ${f.category === c ? "on" : ""}`} aria-pressed={f.category === c} onClick={() => set({ category: c })} data-tip={t(CATEGORY_LABEL[c])}>{t(SHORT_CAT[c])}</button>)}
        </div>
        <div className="lib-tools">
          <button className={`chip ${more ? "on" : ""}`} aria-expanded={more} onClick={() => setMore(!more)} data-testid="lib-filters" data-tip={t("Filter by hue, number of colours, source, mood or collection")}><SlidersHorizontal size={13} />{t("Filters")}{active ? ` · ${active}` : ""}</button>
          <button className={`chip ${f.only === "favourites" ? "on" : ""}`} aria-pressed={f.only === "favourites"} onClick={() => set({ only: f.only === "favourites" ? "all" : "favourites" })} data-tip={t("Show only palettes you starred")}><Star size={13} />{t("Favourites")}</button>
          <span className="lib-count" aria-live="polite">{t("{n} {n|palette|palettes}", { n: list.length })}</span>
        </div>
        {more && (
          <div className="lib-filters">
            <fieldset className="hue-row">
              <legend>{t("Contains hue")}</legend>
              <button className={`hue-chip ${f.hue === "all" ? "on" : ""}`} aria-pressed={f.hue === "all"} onClick={() => set({ hue: "all" })}>{t("Any")}</button>
              {HUE_FAMILIES.map((h) => <button key={h} className={`hue-chip ${f.hue === h ? "on" : ""}`} aria-pressed={f.hue === h} onClick={() => set({ hue: h })}><span className="dot" style={{ background: HUE_DOT[h] }} aria-hidden="true" />{t(HUE_LABEL[h])}</button>)}
            </fieldset>
            <div className="filter-grid">
              <label className="field">{t("Colours")}
                <select value={f.count} onChange={(e) => set({ count: e.target.value as CountFilter })}>
                  <option value="any">{t("Any number")}</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5-8">{t("5 to 8")}</option><option value="9+">{t("9 or more")}</option>
                </select>
              </label>
              <label className="field">{t("Source")}
                <select value={f.source} onChange={(e) => set({ source: e.target.value as Filter["source"] })}>
                  <option value="all">{t("All sources")}</option>
                  {SOURCES.map((s) => <option key={s.id} value={s.id}>{SOURCE_SHORT[s.id]}</option>)}
                </select>
              </label>
              <label className="field">{t("Mood")}
                <select value={f.mood} onChange={(e) => set({ mood: e.target.value })} data-tip={t("Moods come from the Dictionary of Color Combinations metadata")}>
                  <option value="all">{t("Any mood")}</option>
                  {MOODS.map((m) => <option key={m} value={m}>{t(MOOD_LABEL[m])}</option>)}
                </select>
              </label>
              <label className="field">{t("Collection")}
                <select value={f.collection} onChange={(e) => set({ collection: e.target.value })}>
                  <option value="all">{t("All collections")}</option>
                  {COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
            </div>
            {active > 0 && <button className="chip" onClick={() => set({ ...NO_FILTER, query: f.query, category: f.category })}>{t("Clear filters")}</button>}
          </div>
        )}
      </div>

      <div className="lib-scroll">
        {saved.length > 0 && f.only === "all" && !f.query && (
          <section className="lib-section" aria-labelledby="mine">
            <h3 id="mine" className="lib-label">{t("My palettes")}</h3>
            <ul className="cards">
              {saved.map((p) => (
                <li key={p.id} className="pcard">
                  <button className="pcard-open" onClick={() => openPalette({ name: p.name, colors: p.colors, sourceId: p.sourceId }, p.id)} aria-label={t("Open {name}", { name: p.name })}>
                    <Strip colors={p.colors.map((c) => c.hex)} />
                    <span className="pcard-name">{p.name}</span>
                    <span className="pcard-meta">{t("Saved in this browser")} · {p.colors.length}</span>
                  </button>
                  <button className="star" onClick={() => void removeSaved(p.id)} aria-label={t("Delete {name}", { name: p.name })} data-tip={t("Delete this saved palette from this browser")}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ul className="cards" data-testid="lib-list">
          {list.slice(0, limit).map((p) => <Card key={p.id} p={p} fav={favSet.has(p.id)} current={p.id === currentSource} />)}
        </ul>
        {list.length > limit && <button className="btn more-btn" onClick={() => setLimit(limit + PAGE * 2)}>{t("Show more ({n} left)", { n: list.length - limit })}</button>}
        {!list.length && <p className="legend-note empty">{f.only === "favourites" ? t("No favourites yet. Star a palette to keep it here.") : t("No palettes match. Try fewer filters.")}</p>}
        <p className="legend-note lib-credit">{t("Palette data: The Dictionary of Color Combinations (CC BY 4.0), Radix Colors, Open Color, ColorBrewer and d3. See About for licences.")}</p>
      </div>
    </div>
  );
}

const Card = memo(function Card({ p, fav, current }: { p: LibraryPalette; fav: boolean; current: boolean }) {
  useLang();
  const meta = p.plate ? t("Plate {n}", { n: p.plate }) : p.kind ? t(KIND_LABEL[p.kind] ?? p.kind) : SOURCE_SHORT[p.source];
  return (
    <li className={`pcard ${current ? "current" : ""}`}>
      <button className="pcard-open" onClick={() => openLibraryPalette(p)} aria-label={t("Open {name}", { name: p.name })} aria-current={current ? "true" : undefined} data-id={p.id}>
        <Strip colors={p.colors} />
        <span className="pcard-name">{p.name}</span>
        <span className="pcard-meta">{SOURCE_SHORT[p.source]}{meta !== SOURCE_SHORT[p.source] ? ` · ${meta}` : ""} · {p.colors.length}</span>
      </button>
      <button className={`star ${fav ? "on" : ""}`} onClick={() => void toggleFavourite(p.id)} aria-pressed={fav} aria-label={fav ? t("Remove {name} from favourites", { name: p.name }) : t("Add {name} to favourites", { name: p.name })} data-tip={fav ? t("Remove from favourites") : t("Add to favourites")}>
        <Star size={14} fill={fav ? "currentColor" : "none"} />
      </button>
    </li>
  );
});

export function Strip({ colors, tall }: { colors: string[]; tall?: boolean }) {
  return (
    <span className={`strip ${tall ? "tall" : ""}`} aria-hidden="true">
      {colors.map((c, i) => <span key={i} style={{ background: c }} />)}
    </span>
  );
}
