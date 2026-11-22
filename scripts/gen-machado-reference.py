import json, sys, numpy as np
from colorspacious import cspace_convert
from colorspacious.cvd import MACHADO_ET_AL_MATRICES as M
out_ts, out_ref = sys.argv[1], sys.argv[2]
types = {"protan": "protanomaly", "deutan": "deuteranomaly", "tritan": "tritanomaly"}
lines = ["// Machado, Oliveira & Fernandes (2009), \"A Physiologically-Based Model for Simulation of Color",
 "// Vision Deficiency\", IEEE TVCG 15(6), doi:10.1109/TVCG.2009.113. Matrices published by the authors",
 "// (supplementary material, severities 0.0 to 1.0 in steps of 0.1), as tabulated in colorspacious 1.1.2",
 "// (MIT, colorspacious/cvd.py). They operate on LINEAR-light sRGB. Generated, do not edit.",
 "export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];",
 "export const MACHADO: Record<\"protan\" | \"deutan\" | \"tritan\", readonly Mat3[]> = {"]
for k, name in types.items():
    rows = []
    for s in range(0, 101, 10):
        m = np.asarray(M[name][s]).flatten().tolist()
        rows.append("    [" + ", ".join(repr(float(v)) for v in m) + "],")
    lines.append(f"  {k}: [\n" + "\n".join(rows) + "\n  ],")
lines.append("};\n")
open(out_ts, "w").write("\n".join(lines))
rng = np.random.default_rng(2009)
cols = [[0,0,0],[1,1,1],[1,0,0],[0,1,0],[0,0,1],[0.5,0.5,0.5]] + rng.random((24,3)).tolist()
cases = []
for c in cols:
    for k, name in types.items():
        for sev in [0, 25, 50, 73, 100]:
            r = cspace_convert(np.asarray(c), {"name": "sRGB1+CVD", "cvd_type": name, "severity": sev}, "sRGB1")
            cases.append({"in": [round(v, 6) for v in c], "type": k, "severity": sev / 100, "out": np.clip(r, 0, 1).tolist()})
json.dump({"source": "colorspacious 1.1.2 cspace_convert(sRGB1+CVD -> sRGB1), clipped to [0,1]", "cases": cases}, open(out_ref, "w"))
print(len(cases))
