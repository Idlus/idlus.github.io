/* Saison 1, lot 8 (js/duel.js) : Duel de caisses, kamas seulement, même retour moyen qu'une caisse seule, limites du jour,
   seulement en saison. Lancer : node tests/duel.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "gboss", "koli", "legendaires", "dofusp", "songe", "wboss", "suivi", "vie", "quetes", "vente", "foire", "mono", "saisonc", "duel"]) require("../js/" + f + ".js");
const E = window.ENGINE; const F = E.FOIRE;
let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t); const t0 = t;
const mk = () => { const S = E.newState("Joueur", "iop"); E.s1cStart(S, t); S.kamas = 1e9; return S; };
{ const S = mk(); E.emit(S, "noop", {}); const k0 = S.kamas; const r = E.duelOpen(S, "bois", 2, 3);
  assert.strictEqual(typeof r, "object", String(r)); assert.strictEqual(r.seats.length, 4); assert.strictEqual(r.mise, 100000);
  assert.ok(r.seats.every((x) => x.lots.length === 2));
  assert.ok([0, 4000].includes(S.kamas - (k0 - 100000 + r.gain)), "seulement des kamas (+ succès du premier duel gagné)");
  assert.strictEqual(r.gain > 0, r.win.includes(0)); assert.ok(r.seats.slice(1).every((x) => !x.me), "les adversaires sont du Trool");
  assert.strictEqual(E.foireLeft(S), F.DAY - 2, "chaque manche compte comme une ouverture"); }
console.log("ok - un duel : 4 places, 2 manches, mise et gain en kamas, ouvertures du jour comptées");
{ const S = mk(); for (let i = 0; i < E.DUEL.DAY; i++) assert.strictEqual(typeof E.duelOpen(S, "bois", 1, 1), "object");
  assert.strictEqual(typeof E.duelOpen(S, "bois", 1, 1), "string", "5 duels par jour");
  t += 86400000; assert.strictEqual(E.duelLeft(S), E.DUEL.DAY, "le lendemain"); t = t0;
  const P = mk(); P.kamas = 10; assert.strictEqual(typeof E.duelOpen(P, "bois", 1, 1), "string", "pas assez de kamas");
  const Q = mk(); E.foireState(Q).n = F.DAY - 1; assert.strictEqual(typeof E.duelOpen(Q, "bois", 2, 1), "string", "limite des 20 ouvertures");
  assert.strictEqual(typeof E.duelOpen(Q, "bois", 4, 1), "string"); assert.strictEqual(typeof E.duelOpen(Q, "bois", 1, 2), "string");
  const O = E.newState("x", "iop"); O.kamas = 1e9; assert.strictEqual(typeof E.duelOpen(O, "bois", 1, 1), "string", "hors saison : non"); }
console.log("ok - limites : 5 duels par jour, 20 ouvertures de caisse, kamas, seulement en saison");
// retour moyen : celui d'une caisse seule (89,5 %)
{ let mise = 0, gain = 0; for (let d = 0; d < 1200; d++) { t = t0 + d * 86400000; const S = mk(); E.foireState(S).seed = 1000 + d * 7919;
    for (let i = 0; i < 5; i++) { const r = E.duelOpen(S, "argent", 3, i % 2 ? 3 : 1); mise += r.mise; gain += r.gain; } }
  t = t0; const rtp = gain / mise; assert.ok(rtp > 0.8 && rtp < 1.0, "retour moyen " + rtp);
  console.log("ok - retour moyen d'un duel : " + (rtp * 100).toFixed(1) + " % (une caisse seule : " + (E.foireRtp() * 100).toFixed(1) + " %)"); }
{ const S = mk(); S.s1c.duel = { d: -1, wins: E.DUEL.WINS }; assert.ok(E.titles(S).includes(E.DUEL.TITLE)); assert.ok(E.ACH.some((a) => a.id === "s1duel1" && a.s1)); }
console.log("ok - titre et succès");
