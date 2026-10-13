/* Lot Suivi : carnet de bord et chasse au trésor, sans navigateur.
   Lancer : node tests/suivi.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/suivi.js");

let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
// hasard fixé : les combats (et donc le test) se jouent toujours pareil
let seed = 12345; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
const team = (lvl) => { const S = E.newState("Suivi", "iop"); S.chars[0].lvl = lvl; ["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S, k, "H" + i, lvl).inTeam = true; }); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20)); return S; };
const run = (S, ms, stop) => { for (let i = 0; i < ms / 250; i++) { t += 250; E.tick(S, 250); if (stop && stop()) return true; } return false; };

// 1. Le carnet compte l'XP, les kamas et les combats de la chasse, heure par heure.
const S = team(60);
const sub = Object.values(E.SUBS).find((s) => !s.hidden && s.lvl[0] >= 35 && s.lvl[1] <= 55);
assert.strictEqual(E.startHunt(S, sub.id), null);
const k0 = S.kamas; run(S, 30 * 60000);
const T = E.carnetTotals(S, 7);
assert.ok(T.f > 5 && T.xp > 0 && T.k > 0, "combats, XP et kamas comptés");
const L = E.carnetLedger(S, 7); const net = L.inn.reduce((s, x) => s + x.v, 0) - L.out.reduce((s, x) => s + x.v, 0);
assert.strictEqual(net, S.kamas - k0, "le bilan des kamas tombe juste");
assert.ok(L.inn.find((x) => x.k === "chasse"), "les kamas de chasse sont rangés dans « Chasse »");
// une vente au jeu (achats du jour) va dans « vente »
const gb = E.gameBuys(S).list[0]; S.res[gb.res] = (S.res[gb.res] || 0) + 5; const kv = S.kamas;
assert.strictEqual(E.gameBuySell(S, gb.res, 5), null); const p = S.kamas - kv;
assert.strictEqual(p, 5 * gb.price);
assert.strictEqual(E.carnetLedger(S, 7).inn.find((x) => x.k === "vente").v, p);
// l'absence : heures marquées hors ligne
const before = E.carnetTotals(S, 7).f; t += 3 * 3600000; const cu = E.catchUp(S, 3 * 3600);
assert.ok(cu && E.carnetTotals(S, 7).f > before, "combats hors ligne comptés");
assert.ok(E.carnetSeries(S, 7, "xp").filter((x) => x.off).length >= 3, "heures hors ligne repérées");
// une mise à jour devient un moment
E.carnetVersion(S, "0.1.0"); E.carnetVersion(S, "0.1.21");
assert.ok(S.carnet.mom.some((m) => m.k === "maj" && /0\.1\.21/.test(m.txt)));
// taille dans la sauvegarde et du résumé envoyé
t += 8 * 86400000; run(S, 60000);
assert.ok(JSON.stringify(S.carnet).length < 9000, "le carnet reste petit : " + JSON.stringify(S.carnet).length);
assert.ok(JSON.stringify(E.carnetSummary(S)).length < 2000, "résumé petit");
console.log("ok - carnet de bord :", JSON.stringify(S.carnet).length, "octets");

// 2. Chasse au trésor : parchemin du jour, indices, gardien, coffre.
t = Date.UTC(2030, 1, 3, 9, 0);
const G = team(100); // équipe sans équipement : bien au-dessus du parchemin 40 pour gagner à coup sûr
assert.strictEqual(E.tresorClaim(G), null); assert.ok(typeof E.tresorClaim(G) === "string", "un parchemin gratuit par jour");
G.tresor.stock[0] = 40;
assert.strictEqual(E.tresorStart(G), null);
const c = G.tresor.cur; assert.strictEqual(c.steps.length, E.tresorSteps(40));
c.steps.forEach((st) => { const s = E.SUBS[st.sub]; assert.ok(E.subUnlocked(G, st.sub) && s.lvl[1] >= 40 - 30 && s.lvl[0] <= 48, "zone à portée"); });
assert.strictEqual(G.sub, c.steps[0].sub, "l'équipe part vers le premier indice");
const kT = G.kamas;
const done = run(G, 3 * 3600000, () => !G.tresor.cur);
assert.ok(done && G.tresor.n === 1, "trésor trouvé au bout des indices");
assert.ok(G.tresor.last.got.length >= 3);
assert.ok(E.carnetLedger(G, 7).inn.find((x) => x.k === "tresor"), "le coffre apparaît dans le bilan");
assert.ok(G.carnet.mom.some((m) => m.k === "tresor"));
// abandon, réserve pleine
G.tresor.stock = [40, 40, 40]; assert.ok(typeof E.tresorClaim(G) === "string" || E.tresorFreeOk(G) === false);
assert.strictEqual(E.tresorStart(G, 1), null); assert.strictEqual(G.tresor.stock.length, 2);
assert.ok(typeof E.tresorStart(G) === "string", "une chasse à la fois");
assert.strictEqual(E.tresorQuit(G), null); assert.strictEqual(G.tresor.cur, null);
// le trésor passe avant l'itinérance
G.settings.roam = true; E.tresorStart(G); assert.ok(E.tresorHold(G), "l'itinérance attend la fin du trésor");
assert.strictEqual(E.roam(G, E.now() + 9e9), null);
console.log("ok - chasse au trésor");

// 1.0.7.7 : l'indice de donjon donne sa clé (sinon la chasse légendaire restait bloquée), même après un donjon perdu
{ const L = team(120); Object.keys(E.DUNGEONS || require("../js/data.js").DUNGEONS).forEach((d) => (L.progress.bossKills[d] = 1));
  const DG = require("../js/data.js").DUNGEONS;
  L.tresor = { stock: [{ l: 120, k: "leg" }], cur: null, n: 0 }; assert.strictEqual(E.tresorStart(L, 0), null);
  const c = L.tresor.cur; const j = c.steps.findIndex((x) => x.t === "dg"); assert.ok(j > 0, "un indice de donjon");
  const key = DG[c.steps[j].dg].key; delete L.res[key];
  c.i = j - 1; c.steps[j - 1].t = undefined; c.steps[j - 1].got = E.TRESOR_NEED - 1;
  E.emit(L, "win", { mons: [], sub: c.steps[j - 1].sub }); assert.strictEqual(c.i, j);
  assert.strictEqual(L.res[key], 1, "la clé du donjon est donnée");
  L.res[key] = 0; t += 250; E.tick(L, 250); assert.strictEqual(L.res[key], 1, "clé rendue après un donjon perdu");
  E.emit(L, "dungeon", { id: c.steps[j].dg, stasis: 1 }); assert.strictEqual(c.i, j + 1, "donjon fait : indice suivant"); }
// 1.0.7.7 : hors ligne, l'équipe suit les indices (avant, elle restait dans la zone du premier)
{ const O = team(100); O.stats.recent = Array.from({ length: 10 }, () => ({ d: 20, w: 1 }));
  O.tresor = { stock: [100], cur: null, n: 0 }; assert.strictEqual(E.tresorStart(O, 0), null); const c = O.tresor.cur;
  t += 8 * 3600000; const r = E.catchUp(O, 8 * 3600);
  assert.ok(c.ready, "tous les indices résolus hors ligne"); assert.strictEqual(O.sub, c.steps[c.steps.length - 1].sub, "l'équipe attend le gardien sur place");
  assert.ok(r.tresor && r.tresor.length >= 2, "le résumé d'absence montre le trajet"); assert.ok(!O.settings.roam, "l'itinérance n'est pas allumée en douce"); }
console.log("ok - trésor : clé de donjon et indices hors ligne");

// 3. Le défi du jour reste identique avec le carnet branché (même hasard).
const D1 = team(60); const def = E.defi("dec");
const a = E.defiSim(D1, def, t), b = E.defiSim(JSON.parse(E.serialize(D1)), def, t);
assert.deepStrictEqual(a, b);
console.log("ok - lot Suivi");
