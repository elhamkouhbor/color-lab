// Elham Color Lab identity (original artwork, sister of the Fold Studio and Dieline Creator marks).
// Mark: the Elham "E" whose three arms are colour chips (light, clay, sage) beside a contrast scale.
// Wordmark: monoline vector paths (no font dependency), coloured by currentColor.
import { BRAND } from "../../app/brand";

/** Compact icon. `tone="brand"`: filled tile; `tone="mono"`: currentColor glyph only. */
export function LogoMark({ size = 32, tone = "brand", title }: { size?: number; tone?: "brand" | "mono"; title?: string }) {
  const glyph = tone === "brand" ? "#ffffff" : "currentColor";
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {tone === "brand" && <rect width="32" height="32" rx="8" fill="var(--brand, #4f46e5)" />}
      <rect x="8" y="7" width="4.4" height="18" rx=".6" fill={glyph} />
      <rect x="12.4" y="7" width="11" height="4" rx=".6" fill={tone === "brand" ? "#ffffff" : glyph} />
      <rect x="12.4" y="14" width="8" height="4" rx=".6" fill={tone === "brand" ? "#f2b59c" : glyph} opacity={tone === "brand" ? 1 : 0.7} />
      <rect x="12.4" y="21" width="11" height="4" rx=".6" fill={tone === "brand" ? "#b9d5b2" : glyph} opacity={tone === "brand" ? 1 : 0.45} />
      <circle cx="25.6" cy="16" r="1.25" fill={glyph} opacity=".75" />
    </svg>
  );
}

/** "Elham" wordmark as monoline paths (49 × 20 units, baseline at y=20). */
export function Wordmark({ height = 20 }: { height?: number }) {
  return (
    <svg className="wordmark" height={height} viewBox="-1.5 -1.5 70 23" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 0H0V20H8M0 10H7" />
        <path d="M13 0V20" />
        <path d="M18 0V20M18 13.5a5 5 0 0 1 10 0V20" />
        <circle cx="38" cy="14.5" r="5.5" /><path d="M43.5 9V20" />
        <path d="M49 9V20M49 13.5a4.5 4.5 0 0 1 9 0V20M58 13.5a4.5 4.5 0 0 1 9 0V20" />
      </g>
    </svg>
  );
}

/** Full horizontal logo: mark + "Elham" + product line. */
export function LogoFull({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo-full" aria-label={BRAND.name} role="img">
      <LogoMark size={30} />
      {!compact && <><Wordmark height={17} /><span className="logo-product">{BRAND.productLine}</span></>}
    </span>
  );
}
