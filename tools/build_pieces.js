/* 1.0.18 « Panoplies complètes » (Mathis : 1A 2B 3A) : pièces de panoplie et faux qui manquaient au jeu, écrites dans js/pieces.js.
   tools/build_data.py n'a gardé que les recettes à 2 ingrédients absents au plus (et aucune sous le niveau 50), et jamais les faux :
   60 panoplies avaient donc un dernier bonus impossible. Ce fichier ajoute, depuis DofusDB :
     - les pièces manquantes de ces panoplies (niveau 200 au plus), avec leur recette DOFUS sans les ingrédients absents d'Idlus ;
     - toutes les faux de DOFUS (niveau 200 au plus) qui ont une recette.
   Les caractéristiques et bonus de panoplie restent ceux de DOFUS (Mathis 3A : rien n'est baissé).
   Une pièce sans recette (Bottes de Stroud) tombe sur les mêmes monstres que sa sœur fabricable, à la même chance (taux au format DofusDB).
   js/data.js ajoute ces objets aux données ; tools/build_armes.js et tools/build_drops.js les prennent ensuite comme les autres.
   Lancer : node tools/build_pieces.js && node tools/build_armes.js && node tools/build_drops.js */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global;
require(path.join(ROOT, "js/gamedata.js")); const G = global.GAMEDATA; // données générées seules : les pièces déjà écrites ne comptent pas
require(path.join(ROOT, "js/drops.js")); const DROPS = global.DROPS;
const LEG_DB = new Set([32117]); // Jugement de Thanatena : déjà un légendaire du Songe (js/legendaires.js)
const UA = { "User-Agent": "Idlus-fan-idle-import (perso)", Accept: "application/json" };

// mêmes correspondances que tools/build_data.py (STAT, SLOT_BY_TYPE, JOB), plus les faux (type 22)
const STAT = { 125: ["vit", 1], 153: ["vit", -1], 124: ["sa", 1], 156: ["sa", -1], 118: ["fo", 1], 157: ["fo", -1],
  126: ["ine", 1], 155: ["ine", -1], 123: ["cha", 1], 152: ["cha", -1], 119: ["age", 1], 154: ["age", -1],
  138: ["pui", 1], 186: ["pui", -1], 112: ["do", 1], 145: ["do", -1], 115: ["cri", 1], 171: ["cri", -1],
  178: ["so", 1], 179: ["so", -1], 176: ["pp", 1], 177: ["pp", -1], 174: ["ini", 1], 175: ["ini", -1],
  111: ["pa", 1], 168: ["pa", -1], 210: ["rt", 1], 215: ["rt", -1], 213: ["rf", 1], 218: ["rf", -1],
  211: ["re", 1], 216: ["re", -1], 212: ["ra", 1], 217: ["ra", -1], 214: ["rn", 1], 219: ["rn", -1],
  418: ["dcri", 1], 419: ["dcri", -1], 422: ["dt", 1], 423: ["dt", -1], 424: ["df", 1], 425: ["df", -1],
  426: ["de", 1], 427: ["de", -1], 428: ["da", 1], 429: ["da", -1], 430: ["dn", 1], 431: ["dn", -1],
  240: ["xt", 1], 245: ["xt", -1], 241: ["xe", 1], 246: ["xe", -1], 242: ["xa", 1], 247: ["xa", -1],
  243: ["xf", 1], 248: ["xf", -1], 244: ["xn", 1], 249: ["xn", -1], 2812: ["dsort", 1], 2813: ["dsort", -1],
  128: ["pm", 1], 169: ["pm", -1], 753: ["tac", 1], 755: ["tac", -1], 752: ["fui", 1], 754: ["fui", -1], 414: ["pou", 1], 415: ["pou", -1] }; // 1.0.30 : PM, Tacle, Fuite, Dommages de poussée
const SLOT_BY_TYPE = { 1: "amulette", 9: "anneau", 10: "ceinture", 11: "bottes", 16: "coiffe", 17: "cape",
  2: "arme", 3: "arme", 4: "arme", 5: "arme", 6: "arme", 7: "arme", 8: "arme", 19: "arme", 22: "arme", 271: "arme", 82: "bouclier" };
const JOB = { 11: "forgeron", 13: "sculpteur", 15: "cordonnier", 16: "bijoutier", 27: "tailleur", 60: "faconneur", 65: "bricoleur" };
const MAX_LVL = 200;
const statsOf = (effects) => { const st = {};
  for (const e of effects || []) { const s = STAT[e.effectId || e.actionId]; if (!s) continue; const [k, sign] = s;
    const a = e.diceNum || 0, b = e.diceSide || 0; let [lo, hi] = b ? [a, b] : [a, a]; if (lo > hi) [lo, hi] = [hi, lo];
    lo *= sign; hi *= sign; if (sign < 0) [lo, hi] = [hi, lo];
    st[k] = st[k] ? [st[k][0] + lo, st[k][1] + hi] : [lo, hi]; }
  return st; };
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch("https://api.dofusdb.fr/" + u, { headers: UA }); if (r.ok) return await r.json(); } catch (e) { /* nouvel essai */ } await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } throw new Error("DofusDB injoignable : " + u); };

(async () => {
  const have = new Set(Object.values(G.ITEMS).map((T) => T.dbid));
  const size = {}; for (const T of Object.values(G.ITEMS)) if (T.set) size[T.set] = (size[T.set] || 0) + 1;
  const want = new Map(); // id DofusDB -> raison
  // 1. panoplies au dernier palier impossible
  const sets = Object.keys(G.SETS).filter((sid) => Math.max(...Object.keys(G.SETS[sid].bonus).map(Number)) > (size[sid] || 0));
  for (const sid of sets) { const s = await get(`item-sets/${sid.slice(1)}?lang=fr`);
    for (const it of s.items || []) if (!have.has(it.id) && SLOT_BY_TYPE[it.typeId] && (it.level || 1) <= MAX_LVL) want.set(it.id, "set"); }
  // 2. les faux de DOFUS qui ont une recette
  for (let skip = 0; ; skip += 50) { const r = await get(`items?typeId=22&level[$lte]=${MAX_LVL}&$limit=50&$skip=${skip}&lang=fr`);
    r.data.forEach((it) => { if (it.hasRecipe && !have.has(it.id) && !LEG_DB.has(it.id) && !want.has(it.id)) want.set(it.id, "faux"); });
    if (skip + 50 >= r.total) break; }
  const items = {}, drops = [], imgs = [];
  for (const id of [...want.keys()].sort((a, b) => a - b)) {
    const it = await get(`items/${id}?lang=fr`); const rec = ((await get(`recipes?resultId=${id}&lang=fr`)).data || [])[0];
    const o = { name: it.name.fr, dbid: id, icon: it.iconId, slot: SLOT_BY_TYPE[it.typeId], lvl: Math.max(1, it.level || 1), stats: statsOf(it.possibleEffects) };
    if (it.itemSetId > 0 && G.SETS["s" + it.itemSetId]) o.set = "s" + it.itemSetId;
    if (rec && JOB[rec.jobId]) {
      const ing = rec.ingredients.map((x, i) => [x.name.fr, rec.quantities[i]]); const ok = ing.filter(([n]) => G.RES[n]);
      o.craft = { job: JOB[rec.jobId], ing: ok }; if (ok.length < ing.length) o.craft.simpl = ing.length - ok.length;
    } else if (o.set) { // sans recette : les monstres et la chance de sa sœur fabricable (js/drops.js), au format DofusDB (× 0,04 / 4 héros dans tools/build_drops.js)
      const sis = Object.keys(G.ITEMS).filter((t) => G.ITEMS[t].set === o.set && G.ITEMS[t].craft);
      for (const k in DROPS) DROPS[k].forEach(([t, p]) => { if (t === sis[0]) drops.push([k, "i" + id, +(p * 4 / 0.04).toPrecision(3)]); });
    }
    items["i" + id] = o;
    const img = path.join(ROOT, "assets", "i", it.iconId + ".png");
    if (!fs.existsSync(img)) { const r = await fetch(it.img || `https://api.dofusdb.fr/img/items/${it.iconId}.png`, { headers: UA }); if (r.ok) { fs.writeFileSync(img, Buffer.from(await r.arrayBuffer())); imgs.push(it.iconId); } }
  }
  const body = Object.entries(items).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  fs.writeFileSync(path.join(ROOT, "js", "pieces.js"), `/* Généré par tools/build_pieces.js — ne pas modifier à la main. Données DOFUS via DofusDB, © Ankama Games.
   Pièces de panoplie et faux absentes de js/gamedata.js (même format que ses objets). js/data.js les ajoute au jeu.
   drops : [monstre, objet, taux DofusDB] pour les pièces sans recette. */
(function (root) {
  const PIECES = {
  items: {
${body}
  },
  drops: ${JSON.stringify(drops)},
  };
  root.PIECES = PIECES;
  if (typeof module !== "undefined" && module.exports) module.exports = PIECES;
})(typeof window !== "undefined" ? window : globalThis);
`);
  const n = Object.values(items); const left = sets.filter((sid) => Math.max(...Object.keys(G.SETS[sid].bonus).map(Number)) > (size[sid] || 0) + n.filter((T) => T.set === sid).length);
  console.log(`js/pieces.js : ${n.length} objets (${[...want.values()].filter((x) => x === "set").length} pièces de ${sets.length} panoplies, ${[...want.values()].filter((x) => x === "faux").length} autres faux), ${n.filter((T) => !T.craft).length} sans recette, ${imgs.length} images ajoutées`);
  if (left.length) console.log("!! panoplies encore incomplètes :", left.map((s) => G.SETS[s].name).join(", "));
})();
