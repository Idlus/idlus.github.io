/* Kolizetons gagnés : une semaine de combats classés contre les Fantômes, adversaire « Conseillé » comme le mode auto.
   Lancer : node tools/koli_kz_sim.js [combats=150] [niveaux=60,120,200] */
"use strict";
global.window = global;
for (const f of ["gamedata", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "verify", "koli"]) require("../js/" + f + ".js");
const E = window.ENGINE; const K = E.KOLI;
const N = +process.argv[2] || 150; const LVLS = (process.argv[3] || "60,120,200").split(",").map(Number);
for (const lvl of LVLS) {
  let cote = K.start, w = 0, kz = 0, t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const A = E.koliGhost(900000 + lvl * 7 + (i % 5), lvl); // ton équipe : 3 héros bien équipés de ce niveau
    const opps = E.KOLI_GHOST_D.map((d, j) => E.koliGhostOpp((i * 97 + j * 1013 + lvl) >>> 0, d, cote, lvl, 3));
    let b = null, bv = -1e9; for (const o of opps) { const c = E.koliChance(A, o.team, 10) / 100; const st = E.koliStakes(cote, o.cote, true); const v = c * st.win - (1 - c) * st.lose; if (v > bv) { bv = v; b = o; } }
    const r = E.koliSim(A, b.team, (i * 2654435761) >>> 0); const st = E.koliStakes(cote, b.cote, true);
    cote = Math.max(0, cote + (r.win ? st.win : -st.lose)); if (r.win) { w++; kz += K.kzWin; } else kz += K.kzLoss;
  }
  console.log(`niveau ${lvl} : ${Math.round((100 * w) / N)} % de victoires, ${(kz / N).toFixed(2)} Kolizetons/combat (auto ${(0.75 * kz / N).toFixed(2)}), cote finale ${cote} (${E.koliGrade(cote).name}), ${((Date.now() - t0) / N).toFixed(0)} ms/combat`);
}
