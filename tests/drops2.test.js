/* 2.2.5 « Refonte des drops » (Mathis 04/11 : 1B 3C 4B 5B 6C, late game idée 1). Lancer : node tests/drops2.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "armes", "drops", "data", "engine", "systems"]) require("../js/" + f + ".js");
const E = window.ENGINE; const { ITEMS, MONSTERS, DUNGEONS } = window.DATA;
let seed = 9; E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
E.EVENT = null; E.celebrate = () => {};
const mk = () => { const S = E.newState("T", "iop"); S.chars = []; ["iop", "cra", "eni", "sacri"].forEach((c, i) => { E.addChar(S, c, "H" + i, 200).inTeam = true; }); S.settings.auto = { action: "none" }; return S; };
// 1B : ×1 jusqu'au niveau 60, ×3 au niveau 200
assert.strictEqual(E.dropLvlMult(1), 1); assert.strictEqual(E.dropLvlMult(60), 1); assert.strictEqual(E.dropLvlMult(200), 3); assert.ok(E.dropLvlMult(130) > 1.3 && E.dropLvlMult(130) < 2);
console.log("ok - rythme selon le niveau");
// 3C : paliers (≈ 12 % Beau, 3 % Superbe, 8 % de Superbe en stasis 15), planchers respectés
{ const S = mk(); const t = Object.keys(ITEMS).find((k) => ITEMS[k].lvl === 200 && ITEMS[k].set); const n = { 0: 0, 1: 0, 2: 0 }; const N = 6000;
  for (let i = 0; i < N; i++) { const o = { items: [] }; const it = E.dropGive(S, t, { key: "m31" }, { offline: true }, o); n[it.tier || 0]++;
    if (it.tier) { const f = it.tier === 2 ? 0.8 : 0.5; for (const k in ITEMS[t].stats) { const [a, b] = ITEMS[t].stats[k]; if (b > a) assert.ok(it.stats[k] >= a + (b - a) * f - 1e-9, "plancher " + k); } } delete S.items[it.uid]; }
  assert.ok(Math.abs(n[2] / N - 0.03) < 0.01 && Math.abs(n[1] / N - 0.12) < 0.02, JSON.stringify(n));
  assert.ok(Math.abs(E.superbeP(15) - 0.08) < 1e-9 && E.superbeP(10) === 0.03);
  S.settings.auto = { action: "break", q: 100 }; const o = { items: [] }; let sup = null; for (let i = 0; i < 500 && !sup; i++) { const it = E.dropGive(S, t, null, { offline: true }, o); if (it.tier === 2) sup = it; }
  assert.ok(sup && S.items[sup.uid], "un Superbe n'est jamais brisé automatiquement"); }
console.log("ok - paliers Beau et Superbe");
// 4B : fusion d'une ligne, plafond 1 sous le maximum, coût, doublon sacrifié
{ const S = mk(); S.kamas = 100000; const t = Object.keys(ITEMS).find((k) => ITEMS[k].lvl === 200 && ITEMS[k].stats.vit && ITEMS[k].stats.vit[1] > ITEMS[k].stats.vit[0] + 5);
  const a = E.rollItem(S, t, { radiant: false }), b = E.rollItem(S, t, { radiant: false }); a.stats.vit = ITEMS[t].stats.vit[0]; b.stats.vit = ITEMS[t].stats.vit[1];
  const l = E.fuseLines(S, a.uid).find((x) => x.k === "vit"); assert.ok(l && l.v === ITEMS[t].stats.vit[1] - 1, "plafond 1 sous le maximum");
  b.locked = true; assert.ok(E.fuseItem(S, a.uid, b.uid, "vit"), "doublon protégé refusé"); b.locked = false;
  assert.strictEqual(E.fuseItem(S, a.uid, b.uid, "vit"), null); assert.strictEqual(a.stats.vit, ITEMS[t].stats.vit[1] - 1); assert.ok(!S.items[b.uid]); assert.strictEqual(S.kamas, 100000 - 20000); }
console.log("ok - fusion des doublons");
// 5B : jauge du boss (+k, +12 à +20 en 11-15), pièce jamais obtenue d'abord
{ const S = mk(); const did = "donjon_harebourg"; const L = E.bossGaugeItems(did); assert.ok(L.length >= 4);
  assert.strictEqual(E.bossGaugeGain(5), 5); assert.strictEqual(E.bossGaugeGain(10), 10); assert.strictEqual(E.bossGaugeGain(11), 12); assert.strictEqual(E.bossGaugeGain(15), 20);
  const got = []; for (let i = 0; i < 20 * L.length; i++) { const it = E.bossGauge(S, did, 10, []); if (it) got.push(it.tpl); }
  assert.strictEqual(got.length, L.length); assert.strictEqual(new Set(got).size, L.length, "jamais deux fois la même tant qu'il en manque"); }
console.log("ok - jauge du boss");
// 6C : objet suivi garanti au plus tard au double du temps moyen
{ const S = mk(); const mon = Object.keys(MONSTERS).find((k) => !MONSTERS[k].boss && (MONSTERS[k].items || []).some(([t, p]) => ITEMS[t] && ITEMS[t].lvl < 60 && p < 0.05));
  const [tpl, p] = MONSTERS[mon].items.find(([t, p]) => ITEMS[t] && ITEMS[t].lvl < 60 && p < 0.05);
  assert.strictEqual(E.trackSet(S, tpl), null); E.dropMult = () => 1; const exp = 100 / (p * 4); let k = 0, got = 0;
  while (k < exp * 2.2 && !got) { k++; const r = E.giveRewards(S, [{ key: mon, lvl: 50, name: "x" }], { offline: true }); got = r.items.filter((u) => S.items[u].tpl === tpl).length; }
  assert.ok(got && k <= Math.ceil(exp * 2) + 1, `garanti avant 2× le temps moyen (${k} / ${exp.toFixed(0)})`); assert.strictEqual(S.track.g, 0); }
console.log("ok - objet suivi");
// 3.1.4 (ticket #198) : l'objet suivi qui tombe n'est pas brisé par le tri automatique (doublon / jet bas) et arrive verrouillé
{ const S = mk(); const mon = Object.keys(MONSTERS).find((k) => !MONSTERS[k].boss && (MONSTERS[k].items || []).some(([t, p]) => ITEMS[t] && ITEMS[t].lvl < 60 && p < 0.05));
  const [tpl, p] = MONSTERS[mon].items.find(([t, p]) => ITEMS[t] && ITEMS[t].lvl < 60 && p < 0.05);
  const old = E.rollItem(S, tpl, { floor: 1 }); S.items[old.uid] = S.items[old.uid] || old; // un exemplaire parfait déjà au sac
  S.settings.auto = { recycle: true, action: "break", q: 101, low: 0, lowLvl: 0 };
  assert.strictEqual(E.trackSet(S, tpl), null); const exp = 100 / (p * 4); let k = 0, got = [];
  while (k < exp * 2.2 && !got.length) { k++; const r = E.giveRewards(S, [{ key: mon, lvl: 50, name: "x" }], { offline: true }); got = r.items.filter((u) => S.items[u] && S.items[u].tpl === tpl); }
  assert.ok(got.length, "l'objet suivi arrive dans le sac malgré le tri automatique"); assert.ok(S.items[got[0]].locked, "verrouillé"); assert.strictEqual(S.track.n, 1);
  S.track.g = E.TRACK_CAP * 0.999; assert.ok(E.trackPct(S) < 100, "la jauge n'affiche 100 % que quand il tombe"); }
console.log("ok - objet suivi protégé du tri automatique");
console.log("drops2.test.js : tout est bon");
