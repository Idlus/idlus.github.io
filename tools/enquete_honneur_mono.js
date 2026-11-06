/* 06/11/2026 : refus « honneur au jour » du Bouclier Monocompte. Lecture seule : pour chaque partie du relevé (JSON
   [{pseudo, quoi, at, data}]), n'affiche que des chiffres de jeu liés à l'honneur (jamais la partie).
   Lancer : node tools/enquete_honneur_mono.js releve.json */
"use strict";
const fs = require("fs");
const L = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const r of L) {
  let S; try { S = JSON.parse(r.data); } catch (e) { console.log(r.pseudo, r.quoi, "illisible"); continue; }
  const A = S.align || {}; const h = (S.chars || []).find((c) => !c.merc) || {};
  const cnt = S.cnt || {}; const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o && o[k] != null).map((k) => [k, o[k]]));
  console.log(JSON.stringify({ pseudo: r.pseudo, quoi: r.quoi, at: r.at, niv: h.lvl, jeu_h: Math.round(((S.stats && S.stats.playtime) || 0) / 36) / 100,
    hon: Math.round(A.hon || 0), pur: Math.round(A.pur || 0), cm: A.cm, side: A.side, ag: A.ag, q: A.q ? { c: A.q.c, i: A.q.i, done: A.q.done } : null,
    tal: A.tal || A.talents || null, war: A.war, quete: S.alignQuest ? { t: S.alignQuest.t, axp: S.alignQuest.axp } : null,
    cnt: pick(cnt, ["bounty", "bboss", "alq", "cityq", "agr", "agrWin", "def", "dg", "dungeons"]), autres: Object.keys(A).filter((k) => !["hon", "pur", "ag", "q", "war", "side"].includes(k)) }));
}
