/* 0.1.24.1 « Artisans et temples » : commandes d'artisans, Dopeuls des temples, consignes d'absence, sans navigateur.
   Lancer : node tests/vie.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/expedition.js");
require("../js/suivi.js"); require("../js/vie.js");

let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
let seed = 4242; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
const team = (lvl) => { const S = E.newState("Vie", "iop"); S.chars[0].lvl = lvl; ["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S, k, "H" + i, lvl).inTeam = true; }); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20)); return S; };
const run = (S, ms, stop) => { for (let i = 0; i < ms / 250; i++) { t += 250; E.tick(S, 250); if (stop && stop()) return true; } return false; };

// 1. Commandes d'artisans
const S = team(60);
const C = E.cmdState(S);
assert.strictEqual(C.list.length, E.CMD_SLOTS, "3 commandes par jour");
assert.strictEqual(new Set(C.list.map((o) => o.art)).size, E.CMD_SLOTS, "trois artisans différents");
const o = C.list[0];
assert.ok(typeof E.cmdDeliver(S, o.id) === "string", "rien à livrer sans la ressource");
S.res[o.res] = Math.floor(o.n / 2);
assert.strictEqual(E.cmdDeliver(S, o.id), null); assert.strictEqual(o.got, Math.floor(o.n / 2), "livraison partielle");
E.checkAch(S); S.res[o.res] = o.n; const k0 = S.kamas; const reward = E.cmdReward(S, o);
assert.strictEqual(E.cmdDeliver(S, o.id), null);
assert.strictEqual(o.got, o.n); assert.strictEqual(S.res[o.res], o.n - (o.n - Math.floor(o.n / 2)), "seul le reste est pris");
assert.strictEqual(S.kamas - k0, reward + 1500, "la récompense est versée (et le succès Premier client)");
assert.strictEqual(S.cmd.n, 1); assert.ok(S.ach.cmd1 || E.ACH.find((a) => a.id === "cmd1").test(S));
assert.ok(E.carnetLedger(S, 7).inn.find((x) => x.k === "commande"), "la commande apparaît dans le bilan des kamas");
// changer une commande : la première du jour est gratuite
const o2 = C.list[1]; const k1 = S.kamas;
assert.strictEqual(E.cmdSwap(S, o2.id), null); assert.strictEqual(S.kamas, k1); assert.ok(!C.list.some((x) => x.id === o2.id));
assert.ok(E.cmdSwapCost(S) > 0, "la deuxième coûte des kamas");
// prime du jour quand tout est livré
C.list.forEach((x) => { if (x.got < x.n) { S.res[x.res] = (S.res[x.res] || 0) + x.n; E.cmdDeliver(S, x.id); } });
assert.strictEqual(C.bonus, C.day); assert.ok((S.cons.coffre_bois || 0) + (S.cons.coffre_argent || 0) >= 1, "coffre de la prime du jour");
// nouveau jour, nouvelles commandes
t += 864e5; assert.notStrictEqual(E.cmdState(S).list[0].id, o.id); assert.strictEqual(E.cmdState(S).list.length, 3);
console.log("ok - commandes d'artisans");

// 2. Dopeuls des temples
const T = team(120); T.sub = Object.values(E.SUBS).find((s) => !s.hidden && s.lvl[0] >= 60 && s.lvl[1] <= 80).id; E.startHunt(T, T.sub);
assert.deepStrictEqual(E.templeClasses(T).sort(), ["cra", "eni", "feca", "iop"]);
assert.ok(typeof E.templeFight(T, "sram") === "string", "pas de temple sans héros de la classe");
const dopFight = () => { const fid = T.fight ? T.fight.id : -1; let F = null; run(T, 2 * 3600000, () => { if (T.fight && T.fight.dopeul && T.fight.id !== fid) F = T.fight; return F && !T.temple.fighting; }); return F; };
assert.strictEqual(E.templeFight(T, "iop"), null);
let F = dopFight(); // équipe sans équipement : le Dopeul (à la force d'un héros du même niveau) gagne
assert.ok(F && F.ents.some((e) => e.dop && e.dop.cls === "iop" && e.lvl === 120), "le Dopeul Iop a le niveau du héros");
assert.ok(!T.temple.done.iop && !T.tokens.doplons, "défaite : le temple reste ouvert");
const P0 = E.DOPEUL; E.DOPEUL = { hp0: 0.2, hpN: 0, dmg: 0.2, less: 9 }; // Dopeul affaibli pour tester la victoire
assert.strictEqual(E.templeFight(T, "iop"), null); F = dopFight(); E.DOPEUL = P0;
assert.ok(F && T.temple.done.iop, "le Dopeul Iop est vaincu");
assert.ok(T.tokens.doplons >= E.doplons(120), "Doplons gagnés");
assert.ok(typeof E.templeFight(T, "iop") === "string", "un Dopeul par classe et par jour");
const before = T.tokens.doplons; T.tokens.doplons = 10;
assert.strictEqual(E.buyShop(T, "temple", "d6"), null, "parchemin de chasse au trésor au comptoir");
assert.strictEqual(T.tresor.stock.length, 1); assert.strictEqual(T.tokens.doplons, 5);
assert.strictEqual(E.buyShop(T, "temple", "d1"), null); assert.strictEqual(T.cons.coffre_bois, 1);
T.tokens.doplons = before;
console.log("ok - Dopeuls des temples");

// 3. Consignes d'absence
const A = team(60); const home = Object.values(E.SUBS).find((s) => !s.hidden && s.lvl[0] >= 35 && s.lvl[1] <= 55).id; E.startHunt(A, home);
A.stats.recent = Array.from({ length: 10 }, () => ({ d: 15, w: 1 }));
E.consigneSet(A, "roam", true); E.consigneSet(A, "back", true); E.consigneSet(A, "cap", 5); E.consigneSet(A, "alm", true);
assert.strictEqual(A.settings.roam, undefined, "l'itinérance n'est pas activée en jeu");
t += 8 * 3600000; const r = E.catchUp(A, 8 * 3600);
assert.ok(r && Array.isArray(r.consigne), "le résumé d'absence liste les consignes");
assert.ok(!A.settings.roam, "l'itinérance s'arrête au retour");
assert.strictEqual(A.sub, home, "l'équipe revient dans sa zone");
const keep = new Set(E.cmdNeeds(A).concat([E.almanax(A).res]));
Object.keys(r.res).forEach((n) => { if (!keep.has(n) && !E.isKey(n) && E.resPrice(n) && !(A.resFav || {})[n]) assert.ok((A.res[n] || 0) <= 5, "surplus vendu : " + n); });
assert.ok(r.consigne.some((l) => l.startsWith("Limite de banque")));
console.log("ok - consignes d'absence");

// le défi du jour reste déterministe
const D1 = team(60), D2 = team(60); const def = E.defi("dec");
assert.deepStrictEqual(E.defiSim(D1, def).score, E.defiSim(D2, def).score);
console.log("ok - artisans et temples");
