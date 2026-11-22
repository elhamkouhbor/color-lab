// The colour pair being tested in the contrast laboratory. Until the user picks colours it follows the
// foreground and background roles.
import { useMemo } from "react";
import { evaluatePair, type PairResult } from "../core/contrast";
import { resolveRoles } from "../core/palette";
import { useStore, type ContrastPick } from "../state/store";

export interface ActivePair extends ContrastPick { fgIndex: number | null; bgIndex: number | null; result: PairResult; fgHex8: string; bgHex8: string }
const a8 = (a: number) => (a >= 1 ? "" : Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0"));

export function useActivePair(): ActivePair {
  const d = useStore((s) => s.history.present);
  const pick = useStore((s) => s.contrast);
  return useMemo(() => {
    const colors = d.palette.colors.map((c) => c.hex);
    let p: ContrastPick;
    if (pick) p = pick;
    else {
      const r = resolveRoles(d.palette, d.roles, d.dark);
      p = { fg: r.foreground.hex, bg: r.background.hex, fgAlpha: 1, bgAlpha: 1, base: "#ffffff" };
    }
    const idx = (hex: string) => { const i = colors.indexOf(hex); return i >= 0 ? i : null; };
    const fgHex8 = p.fg + a8(p.fgAlpha), bgHex8 = p.bg + a8(p.bgAlpha);
    return { ...p, fgIndex: idx(p.fg), bgIndex: idx(p.bg), fgHex8, bgHex8, result: evaluatePair({ fg: fgHex8, bg: bgHex8, base: p.base }) };
  }, [d, pick]);
}
