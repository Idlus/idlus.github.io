/* Enquête stasis (demande de Mathis, 04/11, lecture seule) : « X a fait un stasis 15, il triche ? »
   Lit la dernière partie validée d'un joueur (relevé du workflow « Serveur OVH », étape enquete-stasis), liste ses stasis
   les plus hautes par donjon, puis REJOUE chaque stasis 15 (et la plus haute de chaque donjon ≥ 12) avec son équipe et un
   hasard choisi ici (VERIFY.replay, comme le serveur des records). N'affiche que des chiffres de jeu, jamais la partie.
   Lancer : node tools/enquete_stasis.js releve.json */
"use strict";
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
const FILES = ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "gboss", "verify", "koli", "legendaires", "dofusp", "collections", "champions", "wboss", "songe", "alliance", "honneur"];
for (const f of FILES) { const p = path.join(__dirname, "../js", f + ".js"); if (fs.existsSync(p)) require(p); }
const E = globalThis.ENGINE, V = globalThis.VERIFY, D = globalThis.DATA || E.DATA;
const quiet = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };

let R = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); if (Array.isArray(R)) R = R[0];
if (!R || !R.ok_data) { console.log("Aucune partie validée pour ce pseudo."); process.exit(0); }
console.log(`== ${R.pseudo} · partie validée du ${String(R.ok_at).slice(0, 16)}`);
console.log("== Records déjà validés par le serveur (rejoués à l'envoi) :", JSON.stringify(R.records || []));
const S = quiet(() => E.deserialize(R.ok_data)); E.events.length = 0;
const team = E.team(S);
console.log(`== Équipe (${team.length}) : ${team.map((c) => `${c.cls} ${c.lvl}`).join(", ")}`);
const rows = Object.entries(S.stasis || {}).map(([did, si]) => ({ did, name: (D.DUNGEONS[did] || {}).name || did, lvl: (D.DUNGEONS[did] || {}).lvl, max: si.max || 0, best: si.best || {}, firsts: si.firsts || {} }))
  .filter((r) => r.max > 0).sort((a, b) => b.max - a.max || b.lvl - a.lvl);
console.log(`== Donjons terminés : ${rows.length} · stasis 15 : ${rows.filter((r) => r.max >= 15).length} · stasis ≥ 12 : ${rows.filter((r) => r.max >= 12).length}`);
rows.slice(0, 40).forEach((r) => console.log(`  ${r.name} (niv ${r.lvl}) : stasis max ${r.max} · meilleur temps à ${r.max} : ${r.best[r.max] != null ? Math.round(r.best[r.max]) + " s" : "?"} · 1re fois : ${r.firsts[r.max] ? new Date(r.firsts[r.max]).toISOString().slice(5, 16) : "?"}`));
const N = +(process.env.ESSAIS || 3);
const todo = rows.filter((r) => r.max >= 12).slice(0, 12);
console.log(`\n== Rejeux (${N} hasards par donjon, équipe de la partie validée)`);
let seed = 12345;
for (const r of todo) {
  const res = [];
  for (let i = 0; i < N; i++) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; res.push(quiet(() => V.replay(E, R.ok_data, r.did, r.max, seed, Date.now()))); }
  const ok = res.filter((x) => x.ok);
  console.log(`  ${r.name} stasis ${r.max} : ${ok.length}/${N} réussis${ok.length ? ` (temps ${ok.map((x) => Math.round(x.t) + " s").join(", ")})` : ""}${res.find((x) => !x.ok) ? ` · échec : ${res.find((x) => !x.ok).err}` : ""}`);
}
