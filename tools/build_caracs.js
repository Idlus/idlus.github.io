/* 1.0.30 « Nouvelles caractéristiques » (Mathis : 41A) : PM, Tacle, Fuite et Dommages de poussée sur les équipements qui les ont dans DOFUS,
   et les sorts de classe qui repoussent leur cible.
   tools/build_data.py et tools/build_pieces.js lisent maintenant ces lignes (STAT : 128/169 PM, 753/755 Tacle, 752/754 Fuite,
   414/415 Dommages de poussée ; effets 5 et 1021 « Repousse de X cases »), mais build_data.py a besoin de l'import brut complet
   de DofusDB pour tout refaire. Ce fichier fait la même chose sur les données déjà générées, sans rien toucher d'autre :
     - js/gamedata.js : lignes des objets (ITEMS), bonus de panoplie (SETS), effet « push » des grades de sorts (CLASS_KITS) ;
     - js/pieces.js : lignes des pièces de panoplie et des faux.
   Les lignes viennent de DofusDB (mêmes règles de jets que build_data.py) ; relancer le script donne le même résultat
   (les anciennes lignes de ces quatre caractéristiques sont retirées puis remises). Les autres caractéristiques ne bougent pas.
   Lancer : node tools/build_caracs.js   (environ 1 minute) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const UA = { "User-Agent": "Idlus-fan-idle-import (perso)", Accept: "application/json" };
// mêmes correspondances que tools/build_data.py (STAT), pour l'ordre des lignes ; NEW = les quatre caractéristiques ajoutées ici
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
  128: ["pm", 1], 169: ["pm", -1], 753: ["tac", 1], 755: ["tac", -1], 752: ["fui", 1], 754: ["fui", -1], 414: ["pou", 1], 415: ["pou", -1] };
const NEW = ["pm", "tac", "fui", "pou"];
const PUSH = [5, 1021]; // « Repousse de X cases » (1103, « sans dommages », ne compte pas)
/* jets d'une ligne, comme stats_of() de build_data.py : [min, max], un malus donne des valeurs négatives */
const statsOf = (effects) => { const st = {};
  for (const e of effects || []) { const s = STAT[e.effectId || e.actionId]; if (!s) continue; const [k, sign] = s;
    const a = e.diceNum || 0, b = e.diceSide || 0; let [lo, hi] = b ? [a, b] : [a, a]; if (lo > hi) [lo, hi] = [hi, lo];
    lo *= sign; hi *= sign; if (sign < 0) [lo, hi] = [hi, lo];
    st[k] = st[k] ? [st[k][0] + lo, st[k][1] + hi] : [lo, hi]; }
  return st; };
const get = async (u) => { for (let i = 0; i < 5; i++) { try { const r = await fetch("https://api.dofusdb.fr/" + u, { headers: UA }); if (r.ok) return await r.json(); } catch (e) { /* nouvel essai */ } await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } throw new Error("DofusDB injoignable : " + u); };
const many = async (ep, ids, key = "id") => { const out = [];
  for (let i = 0; i < ids.length; i += 40) { const q = ids.slice(i, i + 40).map((x) => `${key}[$in][]=${x}`).join("&");
    for (let skip = 0; ;) { const r = await get(`${ep}?$limit=50&$skip=${skip}&${q}`); out.push(...r.data); skip += r.data.length; if (!r.data.length || skip >= r.total) break; } }
  return out; };
/* nouvelles lignes d'un objet : on retire les anciennes, puis on remet les lignes de DofusDB à leur place (ordre des effets DOFUS
   si les autres lignes y sont dans le même ordre, sinon à la fin) */
const patchStats = (old, db) => {
  const keep = Object.keys(old).filter((k) => !NEW.includes(k)); const add = NEW.filter((k) => db[k]);
  const order = Object.keys(db).filter((k) => keep.includes(k) || add.includes(k));
  const same = order.filter((k) => keep.includes(k)).join() === keep.join() && order.length === keep.length + add.length;
  const o = {}; (same ? order : keep.concat(add)).forEach((k) => (o[k] = keep.includes(k) ? old[k] : db[k]));
  return o;
};

(async () => {
  const gdPath = path.join(ROOT, "js", "gamedata.js"); const src = fs.readFileSync(gdPath, "utf8");
  const a = src.indexOf("const GAMEDATA = ") + 17, b = src.indexOf(";\n  root.GAMEDATA");
  const G = JSON.parse(src.slice(a, b));
  const pcPath = path.join(ROOT, "js", "pieces.js"); const PIECES = require(pcPath);
  const count = { items: 0, sets: 0, spells: 0, lines: { pm: 0, tac: 0, fui: 0, pou: 0 } };

  /* 1. objets (gamedata + pièces) */
  const all = Object.assign({}, G.ITEMS, PIECES.items);
  const ids = [...new Set(Object.values(all).map((T) => T.dbid).filter((x) => x > 0))].sort((x, y) => x - y);
  const raw = {}; (await many("items", ids)).forEach((it) => (raw[it.id] = it));
  const miss = [];
  const fix = (T) => { const it = raw[T.dbid]; if (!it) { if (T.dbid) miss.push(T.name); return; }
    const db = statsOf(it.possibleEffects); const before = JSON.stringify(T.stats);
    T.stats = patchStats(T.stats, db); if (JSON.stringify(T.stats) !== before) count.items++;
    NEW.forEach((k) => { if (T.stats[k]) count.lines[k]++; }); };
  Object.values(G.ITEMS).forEach(fix); Object.values(PIECES.items).forEach(fix);

  /* 2. bonus de panoplie (effects[0] = 1 objet porté, comme dans build_data.py) */
  const sids = Object.keys(G.SETS).map((s) => +s.slice(1)).sort((x, y) => x - y);
  for (const s of await many("item-sets", sids)) {
    const Z = G.SETS["s" + s.id]; if (!Z) continue; const before = JSON.stringify(Z.bonus);
    for (const n in Z.bonus) { NEW.forEach((k) => delete Z.bonus[n][k]); if (!Object.keys(Z.bonus[n]).length) delete Z.bonus[n]; }
    (s.effects || []).forEach((effs, n) => { const add = {};
      (effs || []).forEach((e) => { const st = STAT[e.effectId]; if (st && NEW.includes(st[0])) add[st[0]] = (add[st[0]] || 0) + st[1] * Math.abs(e.from || 0); /* malus écrits en négatif par DOFUS */ });
      if (Object.keys(add).length) Z.bonus[n + 1] = Object.assign(Z.bonus[n + 1] || {}, add); });
    if (JSON.stringify(Z.bonus) !== before) count.sets++;
  }

  /* 3. sorts de classe qui repoussent la cible : {k:"push", v: cases} sur chaque grade (même grade = même niveau de joueur) */
  const kitSpells = []; for (const cls in G.CLASS_KITS) G.CLASS_KITS[cls].forEach((pair) => pair.forEach((sp) => kitSpells.push(sp)));
  const lv = {}; (await many("spell-levels", [...new Set(kitSpells.map((sp) => sp.id))], "spellId")).forEach((L) => { (lv[L.spellId] = lv[L.spellId] || []).push(L); });
  for (const sp of kitSpells) {
    let touched = false;
    sp.grades.forEach((g) => {
      const n0 = g.fx.length; g.fx = g.fx.filter((f) => f.k !== "push"); if (g.fx.length !== n0) touched = true;
      const L = (lv[sp.id] || []).find((x) => Math.max(1, x.minPlayerLevel || 1) === g.lvl); if (!L) return;
      const e = (L.effects || []).find((x) => PUSH.includes(x.effectId) && (x.diceNum || 0) > 0 && /A|^$/.test(x.targetMask || ""));
      if (e) { g.fx.push({ k: "push", v: Math.min(4, e.diceNum) }); touched = true; }
    });
    if (touched && sp.grades.some((g) => g.fx.some((f) => f.k === "push"))) count.spells++;
  }

  /* écriture : même format que build_data.py et build_pieces.js */
  fs.writeFileSync(gdPath, src.slice(0, a) + JSON.stringify(G) + src.slice(b));
  const ps = fs.readFileSync(pcPath, "utf8"); const i0 = ps.indexOf("  items: {\n") + 11, i1 = ps.indexOf("\n  },\n  drops:");
  const body = Object.entries(PIECES.items).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  fs.writeFileSync(pcPath, ps.slice(0, i0) + body + ps.slice(i1));
  console.log(`${count.items} objets touchés (lignes : ${NEW.map((k) => `${k} ${count.lines[k]}`).join(", ")}), ${count.sets} panoplies, ${count.spells} sorts qui repoussent`);
  if (miss.length) console.log("!! objets absents de DofusDB :", miss.join(", "));
})();
