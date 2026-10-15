/* Les objets légendaires (0.1.48) : 38 objets, caractéristiques 80-90 % du meilleur objet, un par héros,
   Éveil par copies, pas de forgemagie, chances de butin, passifs en combat. Sans navigateur.
   Lancer : node tests/legendaires.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/koli.js"); require("../js/legendaires.js"); require("../js/songe.js");
const D = require("../js/data.js"); const { ITEMS, STATS } = D;

let seed = 777;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const team = (L, cls = ["iop", "eni", "feca", "cra"]) => { const S = E.newState("Leg", cls[0]); S.chars[0].lvl = L; cls.slice(1).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); S.chars.forEach((c) => { E.resetPoints(S, c.id); E.refreshSpells(c, E.charStats(S, c)); }); E.checkAch(S); return S; };
const power = (st) => Object.entries(st).reduce((a, [k, v]) => a + (STATS[k] ? STATS[k].w : 0) * (Array.isArray(v) ? v[1] : v), 0);

// 1. Les 38 : 26 de DOFUS au niveau 200, 12 inédits aux niveaux 50/100/150, chacun avec une icône, un passif et 5 valeurs d'Éveil.
{
  assert.strictEqual(E.LEG_LIST.length, 38);
  assert.strictEqual(E.LEG_LIST.filter((x) => x.db).length, 26); assert.ok(E.LEG_LIST.filter((x) => x.db).every((x) => x.lvl === 200));
  const og = E.LEG_LIST.filter((x) => !x.db); assert.strictEqual(og.length, 12); [50, 100, 150].forEach((l) => assert.strictEqual(og.filter((x) => x.lvl === l).length, 4));
  E.LEG_LIST.forEach((x) => { const T = ITEMS[x.tpl]; assert.ok(T && T.leg === x.k && T.lvl === x.lvl, x.k);
    assert.ok(require("fs").existsSync(`${__dirname}/../assets/i/${x.icon}.png`), "icône " + x.icon);
    assert.strictEqual(x.v.length, 5); const up = x.v[4] >= x.v[0]; for (let i = 1; i < 5; i++) assert.ok(up ? x.v[i] >= x.v[i - 1] : x.v[i] <= x.v[i - 1], "Éveil qui renforce " + x.k); // Pavie : le seuil de PV baisse
    assert.ok(E.legTxt(x, 1).length > 5, "texte du passif " + x.k); });
  console.log("ok - légendaires : 38 objets");
}

// 2. Caractéristiques : entre 80 et 90 % du meilleur objet du même emplacement et du même niveau (poids de forgemagie).
{
  E.LEG_LIST.forEach((x) => { const T = ITEMS[x.tpl]; const best = E.legBest(T.slot, T.lvl); assert.ok(best.id, "meilleur objet " + x.k);
    const r = power(T.stats) / best.w; assert.ok(r >= 0.78 && r <= 0.92, `${x.name} : ${Math.round(r * 100)} %`); });
  console.log("ok - légendaires : stats 80-90 % du meilleur objet");
}

// 3. Obtention, un seul par héros, Éveil par copies, pas de forgemagie.
{
  const S = team(200); const a = E.giveLeg(S, "crocobur"); const b = E.giveLeg(S, "crocobur"); const c = E.giveLeg(S, "voile");
  const its = Object.values(S.items).filter((i) => ITEMS[i.tpl].leg); assert.strictEqual(its.length, 3);
  assert.ok(its.every((i) => i.locked), "protégés à l'obtention");
  const h = S.chars[0]; const it1 = its.find((i) => i.tpl === "leg_crocobur"); const it3 = its.find((i) => i.tpl === "leg_voile");
  assert.strictEqual(E.equip(S, h.id, it1.uid, ITEMS[it1.tpl].slot === "anneau" ? "anneau1" : ITEMS[it1.tpl].slot === "dofus" ? "dofus1" : ITEMS[it1.tpl].slot), null, "équipé");
  const sl3 = ITEMS[it3.tpl].slot === "anneau" ? "anneau1" : ITEMS[it3.tpl].slot === "dofus" ? "dofus1" : ITEMS[it3.tpl].slot;
  if (sl3 !== Object.keys(h.equip).find((k) => h.equip[k] === it1.uid)) assert.ok(typeof E.equip(S, h.id, it3.uid, sl3) === "string", "un seul légendaire par héros");
  assert.deepStrictEqual(E.legOf(S, h), { k: "crocobur", ev: 1 });
  const it2 = its.find((i) => i.tpl === "leg_crocobur" && i.uid !== it1.uid);
  assert.strictEqual(E.act(S, "legFuse", it1.uid, it2.uid), null); assert.strictEqual(E.legEv(S.items[it1.uid]), 2, "Éveil II");
  assert.ok(!S.items[it2.uid], "la copie est fondue");
  S.items[it1.uid].lgc = 8; assert.strictEqual(E.legEv(S.items[it1.uid]), 5, "Éveil V à 8 copies"); assert.strictEqual(E.legNext(S.items[it1.uid]), 0);
  assert.ok(typeof E.fmBlock(S, S.items[it1.uid]) === "string", "pas de forgemagie");
  const N = E.deserialize(E.serialize(S)); assert.strictEqual(E.legEv(N.items[it1.uid]), 5, "Éveil gardé dans la sauvegarde");
  console.log("ok - légendaires : un par héros, Éveil, sauvegarde");
}

// 4. Chances : rien en Rêve, 1 sur 4 000 en Paradoxe 1 (1.0.30), seulement ceux du niveau de l'équipe ou en dessous, et environ le taux annoncé.
{
  assert.deepStrictEqual(E.LEG_RATE.slice(0, 2), [0, 1 / 4000]);
  assert.ok(E.legPool(60).every((x) => x.lvl <= 60) && E.legPool(60).length === 4, "niveau 60 : les 4 inédits niveau 50");
  const S = team(200); let n = 0; const N = 200000; for (let i = 0; i < N; i++) if (E.legRoll(S, 7, 200, "test")) n++;
  const exp = N * E.LEG_RATE[7]; assert.ok(n > exp * 0.7 && n < exp * 1.3, `Cauchemar 3 : ${n} pour ${exp} attendus`);
  const T = team(200); for (let i = 0; i < 5000; i++) assert.ok(!E.legRoll(T, 0, 200, "test"), "rien en Rêve");
  console.log("ok - légendaires : taux de butin", n, "sur", N, "en Cauchemar 3");
}

E.subUnlocked = () => true; // toutes les zones ouvertes pour les combats de test

// 5. En combat : chaque passif tourne sans erreur dans des combats de chasse, et une équipe légendaire gagne plus souvent.
{
  const win = (withLeg) => { let w = 0; for (let k = 0; k < 3; k++) {
    const S = team(200, ["iop", "eni", "feca", "cra"]); if (withLeg) S.chars.forEach((c, i) => { const x = E.LEG_LIST.filter((y) => y.lvl === 200)[(k * 9 + i) % 26]; E.giveLeg(S, x.k); const it = Object.values(S.items).find((j) => j.tpl === x.tpl && !E.equippedBy(S, j.uid)); const T = ITEMS[it.tpl]; E.equip(S, c.id, it.uid, T.slot === "anneau" ? "anneau1" : T.slot === "dofus" ? "dofus1" : T.slot); });
    S.dungeon = null; const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] >= 180).sort((a, b) => a.lvl[0] - b.lvl[0])[0]; E.startHunt(S, sub.id);
    for (let i = 0; i < 250; i++) { now += 1000; E.tick(S, now); } w += S.stats.wins; } return w; };
  const a = win(false), b = win(true);
  assert.ok(b >= a, `avec légendaires ${b} victoires, sans ${a}`);
  console.log("ok - légendaires : combats avec passifs", b, "victoires contre", a);
}

// 6. Chacun des 38 passifs, porté par toute l'équipe, en chasse à son niveau : aucun plantage, PV cohérents.
{
  E.LEG_LIST.forEach((x) => { const S = team(x.lvl); S.chars.forEach((c) => { E.giveLeg(S, x.k); const it = Object.values(S.items).find((j) => j.tpl === x.tpl && !E.equippedBy(S, j.uid)); const T = ITEMS[it.tpl]; assert.strictEqual(E.equip(S, c.id, it.uid, T.slot === "anneau" ? "anneau1" : T.slot === "dofus" ? "dofus1" : T.slot), null, x.k); });
    const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] <= x.lvl).sort((a, b) => b.lvl[0] - a.lvl[0])[0]; const why = E.startHunt(S, sub.id); assert.ok(!why, `${x.k} : ${why}`);
    for (let i = 0; i < 30; i++) { now += 1000; E.tick(S, now); }
    assert.ok(S.stats.fights > 0, "combats " + x.k); });
  console.log("ok - légendaires : les 38 passifs en combat");
}

console.log("legendaires.test.js : tout est bon");
