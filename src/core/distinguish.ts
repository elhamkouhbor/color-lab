// Palette distinguishability under a simulated colour vision. A SCREENING aid: CIEDE2000 differences
// between the simulated colours are compared against two rough bands. A small ΔE00 means the colours
// are close for the model's average observer at large patch sizes. Thin lines, small marks, viewing
// conditions and individual vision all change this, so no threshold proves that colours are distinct.
import { deltaE2000 } from "./color";
import { simulateHex, type Vision } from "./cvd";

/** Below this the simulated pair is very hard to tell apart (rough band, ΔE00). */
export const VERY_CLOSE = 5;
/** Below this the simulated pair may be hard to tell apart, especially in small areas (rough band, ΔE00). */
export const CLOSE = 10;

export interface PairIssue {
  i: number; j: number;
  original: [string, string];
  simulated: [string, string];
  deltaOriginal: number;
  deltaSimulated: number;
  level: "very-close" | "close";
  /** true when the pair is already close in normal vision (not caused by the simulation) */
  alsoNormal: boolean;
}

export function confusablePairs(colors: string[], vision: Vision): PairIssue[] {
  const sim = colors.map((c) => simulateHex(c, vision));
  const out: PairIssue[] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const ds = deltaE2000(sim[i], sim[j]);
      if (ds >= CLOSE) continue;
      const d0 = deltaE2000(colors[i], colors[j]);
      out.push({
        i, j, original: [colors[i], colors[j]], simulated: [sim[i], sim[j]], deltaOriginal: d0, deltaSimulated: ds,
        level: ds < VERY_CLOSE ? "very-close" : "close", alsoNormal: d0 < CLOSE,
      });
    }
  }
  return out.sort((a, b) => a.deltaSimulated - b.deltaSimulated);
}
