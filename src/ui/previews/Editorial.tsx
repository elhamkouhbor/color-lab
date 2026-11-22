// Editorial preview: a poster whose composition is driven by the palette. Each colour becomes one
// concentric band (darkest outside), the primary accent is the sun, and the index lists the colours.
import { useId } from "react";
import type { Paint } from "../../core/palette";
import { t } from "../../i18n/i18n";

export function EditorialPreview({ paint, name }: { paint: Paint; name: string }) {
  const W = 600, H = 800;
  const clip = `poster-${useId().replace(/:/g, "")}`;
  const bands = paint.bands.length > 8
    ? Array.from({ length: 8 }, (_, i) => paint.bands[Math.round((i / 7) * (paint.bands.length - 1))])
    : paint.bands;
  const R = 520, step = Math.min(64, (R - 120) / Math.max(1, bands.length));
  const serif = "Fraunces, Georgia, 'Times New Roman', serif", sans = "Manrope, ui-sans-serif, system-ui, sans-serif";
  const index = paint.series.slice(0, 6);
  const shownName = name.length > 24 ? `${name.slice(0, 23)}…` : name;
  return (
    <div className="pv pv-edit" data-testid="pv-editorial">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Editorial poster using the palette")}>
        <defs><clipPath id={clip}><rect width={W} height={H} /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          <rect width={W} height={H} fill={paint.bg} />
          {/* the sun */}
          <circle cx={430} cy={250} r={132} fill={paint.primary} />
          {/* concentric bands rising from the lower left corner */}
          {bands.map((c, i) => <circle key={i} cx={-20} cy={H + 120} r={R - i * step} fill={c} />)}
          <circle cx={-20} cy={H + 120} r={Math.max(40, R - bands.length * step)} fill={paint.bg} />
          {/* typography */}
          <text x={48} y={70} fontFamily={sans} fontSize={12} fontWeight={700} letterSpacing={3} fill={paint.fg}>{t("COLOUR NOTES")}</text>
          <text x={W - 48} y={70} textAnchor="end" fontFamily={sans} fontSize={12} fontWeight={600} letterSpacing={2} fill={paint.muted}>{t("NO. 07")}</text>
          <line x1={48} x2={W - 48} y1={88} y2={88} stroke={paint.border} strokeWidth={1.5} />
          <text x={46} y={186} fontFamily={serif} fontSize={84} fontWeight={420} letterSpacing={-2} fill={paint.fg}>{t("Still life")}</text>
          <text x={46} y={268} fontFamily={serif} fontSize={84} fontWeight={300} fontStyle="italic" letterSpacing={-2} fill={paint.fg}>{t("in colour")}</text>
          <text x={48} y={316} fontFamily={sans} fontSize={15} fontWeight={500} fill={paint.muted}>{t("An exhibition of everyday objects")}</text>
          <text x={48} y={338} fontFamily={sans} fontSize={15} fontWeight={500} fill={paint.muted}>{t("arranged by the colour of their shadows.")}</text>
          {/* date block */}
          <rect x={W - 210} y={420} width={162} height={134} rx={4} fill={paint.surface} stroke={paint.border} />
          <text x={W - 192} y={452} fontFamily={sans} fontSize={11} fontWeight={700} letterSpacing={2} fill={paint.muted}>{t("OPENING")}</text>
          <text x={W - 192} y={490} fontFamily={serif} fontSize={32} fontWeight={500} fill={paint.fg}>{t("12 March")}</text>
          <text x={W - 192} y={516} fontFamily={sans} fontSize={12.5} fontWeight={600} fill={paint.secondary}>{t("Gallery Two, 18:00")}</text>
          <text x={W - 192} y={538} fontFamily={sans} fontSize={11.5} fontWeight={600} fill={paint.muted}>{t("Free entry")}</text>
          {/* colour index */}
          <rect x={W - 260} y={H - 222} width={212} height={124} rx={4} fill={paint.surface} stroke={paint.border} />
          <text x={W - 242} y={H - 192} fontFamily={sans} fontSize={11} fontWeight={700} letterSpacing={2} fill={paint.fg}>{t("PALETTE")}</text>
          <text x={W - 242} y={H - 170} fontFamily={serif} fontSize={14} fontStyle="italic" fill={paint.muted}>{shownName}</text>
          {index.map((c, i) => <circle key={i} cx={W - 230 + i * 30} cy={H - 131} r={12} fill={c} stroke={paint.border} />)}
        </g>
      </svg>
    </div>
  );
}
