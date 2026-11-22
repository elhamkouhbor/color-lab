import type { CSSProperties } from "react";
import type { Paint } from "../../core/palette";

/** CSS custom properties for a preview. Previews must only paint with these (or explicit paint values). */
export function paintVars(p: Paint): CSSProperties {
  return {
    "--p-bg": p.bg, "--p-fg": p.fg, "--p-surface": p.surface, "--p-primary": p.primary, "--p-secondary": p.secondary,
    "--p-on-primary": p.onPrimary, "--p-border": p.border, "--p-muted": p.muted, "--p-faint": p.faint,
    "--p-primary-soft": p.primarySoft, "--p-secondary-soft": p.secondarySoft,
    "--p-success": p.success, "--p-warning": p.warning, "--p-danger": p.danger,
    "--p-success-soft": p.successSoft, "--p-warning-soft": p.warningSoft, "--p-danger-soft": p.dangerSoft,
  } as CSSProperties;
}
