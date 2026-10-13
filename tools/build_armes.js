/* 0.1.51 « Armes » : récupère sur DofusDB les dégâts propres de chaque arme du jeu (type, coût en PA, critique, portée,
   lignes de dégâts) et écrit js/armes.js. tools/build_data.py ne garde que les caractéristiques des objets ;
   ce fichier complète les armes sans toucher aux données générées.
   Lancer : node tools/build_armes.js   (à relancer quand des armes sont ajoutées au jeu) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global;
require(path.join(ROOT, "js/engine.js")); require(path.join(ROOT, "js/systems.js"));
require(path.join(ROOT, "js/legendaires.js")); require(path.join(ROOT, "js/wboss.js"));
const D = require(path.join(ROOT, "js/data.js")); const E = global.ENGINE;

// effets DofusDB -> [élément, vol de vie]
const EFF = { 96: ["e", 0], 97: ["t", 0], 98: ["a", 0], 99: ["f", 0], 100: ["n", 0], 91: ["e", 1], 92: ["t", 1], 93: ["a", 1], 94: ["f", 1], 95: ["n", 1], 2822: ["best", 0], 2828: ["best", 1], 108: ["soin", 2] };
const TYPES = [2, 3, 4, 5, 6, 7, 8, 19, 22, 271];
/* deux légendaires du Songe n'existent pas dans DOFUS : leurs dégâts sont faits à la main, au niveau des armes de leur rang */
const HAND = {
  leg_paradoxe: [6, 4, 8, 10, 1, 1, 1, [["t", 24, 30], ["a", 24, 30]], 0],
  leg_nuits: [4, 4, 6, 8, 1, 3, 1, [["f", 30, 38], ["f", 12, 15, 1]], 0],
};

(async () => {
  const want = {}; // tpl -> dbid
  for (const [tpl, T] of Object.entries(D.ITEMS)) {
    if (T.slot !== "arme" || HAND[tpl]) continue;
    const db = T.leg ? (E.LEG[T.leg] || {}).db : T.dbid || +String(tpl).replace(/^i/, "");
    if (db > 0) want[tpl] = db;
  }
  const ids = [...new Set(Object.values(want))]; const raw = {};
  for (let i = 0; i < ids.length; i += 50) {
    const q = ids.slice(i, i + 50).map((x) => "id[$in][]=" + x).join("&");
    const r = await fetch("https://api.dofusdb.fr/items?$limit=50&" + q, { headers: { "User-Agent": "Idlus-fan-idle-import (perso)" } });
    const j = await r.json(); for (const it of j.data) raw[it.id] = it;
  }
  const out = {}; const miss = [];
  for (const [tpl, db] of Object.entries(want)) {
    const it = raw[db]; if (!it || !TYPES.includes(it.typeId)) { miss.push(tpl); continue; }
    const lines = []; let pa = 0;
    for (const e of it.possibleEffects || []) {
      if (EFF[e.effectId]) { const [el, dr] = EFF[e.effectId]; const a = e.diceNum || 0, b = Math.max(a, e.diceSide || 0); if (b > 0) lines.push(dr ? [el, a, b, dr] : [el, a, b]); }
      if (e.effectId === 101) pa = Math.max(pa, e.diceNum || 1);
    }
    if (!lines.length) { miss.push(tpl); continue; }
    out[tpl] = [it.typeId, it.apCost || 4, it.criticalHitProbability || 0, it.criticalHitBonus || 0, it.minRange || 1, it.range || 1, it.maxCastPerTurn || 1, lines, pa];
  }
  Object.assign(out, HAND);
  const body = Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(",\n");
  const js = `/* Généré par tools/build_armes.js — ne pas modifier à la main. Données DOFUS via DofusDB, © Ankama Games.
   Pour chaque arme : [type, PA, critique 1/x, bonus critique, portée min, portée max, lancers par tour, lignes [élément (best = meilleur élément du héros, soin), min, max, 1 = vol de vie / 2 = soin], PA retirés] */
(function (root) {
  const ARMES = {
${body}
  };
  root.ARMES = ARMES;
  if (typeof module !== "undefined" && module.exports) module.exports = ARMES;
})(typeof window !== "undefined" ? window : globalThis);
`;
  fs.writeFileSync(path.join(ROOT, "js/armes.js"), js);
  console.log(`js/armes.js : ${Object.keys(out).length} armes${miss.length ? `, sans dégâts connus : ${miss.join(", ")}` : ""}`);
})();
