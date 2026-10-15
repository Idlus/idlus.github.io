/* Refonte de l'élevage (1.1, js/elevage.js) : étoiles et stats, capacités, ascendance, naissances, objets d'élevage
   qui s'usent, Essence (relâcher, nourrir, polir), relâcher en masse, éleveur automatique, balades, commandes,
   carnet complet (titre, places, 4e couple), places en kamas, nom, migration d'une ancienne partie. Sans navigateur.
   Lancer : node tests/elevage.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const ROOT = path.join(__dirname, "..");

let seed = 1101;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const fresh = () => { const S = E.newState("Élevage", "iop"); S.chars[0].lvl = 200; S.chars[0].inTeam = true; S.kamas = 1e9; S.enclos.built = true; S.elev = { q: 6 }; E.elevState(S); return S; };
const alm0 = E.elevAlm; E.elevAlm = () => false; // jour de l'élevage testé à part (24A)
const mk = (S, sp, c, o = {}) => { const M = E.giveMount(S, sp, c, "test", Object.assign({}, o)); assert.ok(M, "monture donnée"); M.lvl = o.lvl || 100; return M; };

// 1. Étoiles : +12,5 % par étoile sur la stat de couleur seulement (PA, PM, Invocation jamais), Endurante +20 %
{
  const S = fresh();
  const a = mk(S, "dd", "Rousse"), b = mk(S, "dd", "Rousse", { st: 5 }), c = mk(S, "dd", "Rousse", { st: 5, cap: "endu" });
  assert.strictEqual(E.mountStatsAt(a).so, 50); assert.strictEqual(E.mountStatsAt(b).so, 75); assert.strictEqual(E.mountStatsAt(c).so, 85);
  assert.strictEqual(E.mountStatsAt(b).vit, 300, "la base de l'espèce ne bouge pas");
  const d = mk(S, "dd", "Dorée", { st: 5 }); assert.strictEqual(E.mountStatsAt(d).inv, 2, "Invocation jamais multipliée");
  const v = mk(S, "vk", "Pourpre", { st: 5 }); assert.strictEqual(E.mountStatsAt(v).pa, 1, "PA jamais multiplié");
  assert.strictEqual(E.starCap(S, a), 5); assert.strictEqual(E.starCap(S, { sp: "dd", chr: 1 }), 6, "chromatique : une étoile de plus");
  console.log("ok - étoiles : stat de couleur ×1,5 à ★5, Endurante, PA/PM/Invocation intacts");
}

// 2. Ascendance : 20 % + 5 % par parent de la bonne lignée (captures pures : 40 %), Prédisposée, Dragofesse, plafond 60 %
{
  const S = fresh();
  const A = mk(S, "dd", "Rousse"), B = mk(S, "dd", "Dorée");
  let o = E.breedOdds(S, A, B, 0); assert.deepStrictEqual(o[0], ["Indigo", 40, true]); assert.strictEqual(o.reduce((s, x) => s + x[1], 0), 100);
  A.pc = ["Rousse", "Amande"]; B.pc = ["Indigo", "Rousse"]; assert.strictEqual(E.newColourPct(S, A, B, 0), 25);
  A.cap = "pred"; assert.strictEqual(E.newColourPct(S, A, B, 0), 35);
  E.elevState(S).slots[0].dra = { t: 4, n: 20 }; assert.strictEqual(E.newColourPct(S, A, B, 0), 41);
  A.pc = B.pc = null; B.cap = "pred"; assert.strictEqual(E.newColourPct(S, A, B, 0), 60, "plafond 60 %");
  const C = mk(S, "dd", "Rousse"); o = E.breedOdds(S, C, mk(S, "dd", "Rousse"), 1); assert.deepStrictEqual(o.map((x) => x[0]), ["Rousse", "Rousse"]); assert.strictEqual(o[0][1] + o[1][1], 100, "même couleur : toujours cette couleur");
  console.log("ok - ascendance : 40 % pour deux parents purs, 25 % sans lignée, Prédisposée, Dragofesse, 60 % au plus");
}

// 3. Naissances : 3 couples, étoiles autour de la moyenne, capacités ~20 %, chromatiques rares, famille, objets usés après 20 naissances
{
  const S = fresh(); E.elevState(S).buy = 6; assert.strictEqual(E.pairCap(S), 3);
  let ups = 0, caps = 0, n = 0, chr = 0; const A = mk(S, "dd", "Indigo", { st: 3 }), B = mk(S, "dd", "Indigo", { st: 3 });
  E.elevState(S).inv.push({ k: "baf", t: 4, n: 20 }); assert.strictEqual(E.elvAutoEquip(S, 0), 1);
  for (let i = 0; i < 600; i++) {
    A.kids = B.kids = 0; assert.strictEqual(E.startBreed(S, A.uid, B.uid), null);
    const p = S.enclos.pairs[0]; assert.strictEqual(p.s, 0); E.enclosTick(S, p.t + 1);
    const kid = S.mounts[S.mountUid - 1]; assert.ok(kid && kid.c === "Indigo"); n++;
    if (kid.st === 4) ups++; if (kid.cap) caps++; if (kid.chr) chr++;
    assert.deepStrictEqual(kid.pc, ["Indigo", "Indigo"]); assert.strictEqual(kid.gc.length, 4);
    delete S.mounts[kid.uid];
  }
  assert.ok(Math.abs(ups / n - 0.30) < 0.06, `étoile en plus ≈ 30 % (${ups}/${n}) avec le Baffeur usé après 20 naissances`);
  assert.ok(Math.abs(caps / n - 0.20) < 0.05, `capacité ≈ 20 % (${caps}/${n})`);
  assert.ok(chr <= 12, `chromatiques rares (${chr})`);
  assert.ok(!E.elevState(S).slots[0].baf, "Baffeur usé"); assert.strictEqual(E.elevState(S).worn, 1);
  assert.strictEqual(E.elevState(S).n.births, 600);
  console.log(`ok - naissances : ${ups} étoiles en plus, ${caps} capacités, ${chr} chromatiques sur ${n}, famille notée, Baffeur usé`);
}

// 4. Temps de naissance : 8 h, Abreuvoir 6 h, Infatigable ×0,75, Foudroyeur V −30 %, jamais moins de 2 h
{
  const S = fresh(); const A = mk(S, "mu", "Doré"), B = mk(S, "mu", "Pourpre");
  assert.strictEqual(E.birthMs(S, A, B, 0), 8 * 3600e3);
  A.cap = "infa"; assert.strictEqual(E.birthMs(S, A, B, 0), 6 * 3600e3);
  E.elevState(S).slots[0].fou = { t: 4, n: 20 }; assert.strictEqual(E.birthMs(S, A, B, 0), Math.round(6 * 3600e3 * 0.7));
  assert.ok(E.birthMs(S, A, B, 0) >= E.BIRTH_MIN);
  console.log("ok - temps de naissance (Infatigable, Foudroyeur, minimum 2 h)");
}

// 5. Capacités : Précoce (niveau 20), Reproductrice (+2 petits), Sage (+50 % d'XP)
{
  const S = fresh(); const P = mk(S, "dd", "Amande", { cap: "pre", lvl: 25 }); P.lvl = 25; assert.strictEqual(E.breedWhy(S, P), null);
  const Q = mk(S, "dd", "Amande"); Q.lvl = 25; assert.ok(/niveau 50/.test(E.breedWhy(S, Q)));
  const R = mk(S, "dd", "Amande", { cap: "repro" }); assert.strictEqual(E.kidsCap(S, R), E.kidsCap(S) + 2);
  const G = mk(S, "dd", "Amande", { cap: "sage" }); G.lvl = 10; G.xp = 0; const H = mk(S, "dd", "Amande"); H.lvl = 10; H.xp = 0;
  E.giveMountXp(S, G, 1000); E.giveMountXp(S, H, 1000); assert.strictEqual(G.xp, 1500); assert.strictEqual(H.xp, 1000);
  console.log("ok - capacités Précoce, Reproductrice, Sage");
}

// 6. Essence : relâcher (niveau × étoiles), nourrir (100 par niveau), polir une étoile (2 000, une fois par jour)
{
  const S = fresh(); const v = E.elevState(S); const M = mk(S, "dd", "Rousse", { st: 3 }); M.lvl = 60;
  assert.strictEqual(E.releaseMount(S, M.uid), null); assert.strictEqual(v.ess, 180);
  const N = mk(S, "dd", "Rousse"); N.lvl = 40; v.ess = 1000; assert.strictEqual(E.feedMount(S, N.uid, 5), null); assert.strictEqual(N.lvl, 45); assert.strictEqual(v.ess, 500);
  assert.ok(/Essence/.test(E.feedMount(S, N.uid, 10)));
  v.ess = 5000; assert.strictEqual(E.polishMount(S, N.uid), null); assert.strictEqual(N.st, 2); assert.ok(/demain/.test(E.polishMount(S, N.uid)));
  N.st = 5; N.pol = null; assert.ok(/maximum/.test(E.polishMount(S, N.uid)));
  // relâcher en masse : jamais montée, à l'enclos, avec capacité, chromatique, nommée ; garde la meilleure de chaque couleur
  const S2 = fresh(); const keep = mk(S2, "dd", "Amande", { st: 2 }); const weak = [mk(S2, "dd", "Amande"), mk(S2, "dd", "Amande")];
  mk(S2, "dd", "Amande", { cap: "sage" }); mk(S2, "dd", "Amande", { chr: 1 }); const nm = mk(S2, "dd", "Amande"); E.renameMount(S2, nm.uid, "Pétale<b>");
  assert.strictEqual(nm.nm, "Pétaleb", "le nom perd les chevrons");
  const rid = mk(S2, "dd", "Amande"); E.equipMount(S2, S2.chars[0].id, rid.uid);
  const L = E.massReleaseList(S2); assert.deepStrictEqual(L.map((x) => x.uid).sort(), weak.map((x) => x.uid).sort());
  assert.ok(!L.includes(keep)); assert.strictEqual(E.massRelease(S2), null); assert.strictEqual(E.elevState(S2).ess, 200);
  console.log("ok - Essence : relâcher, nourrir, polir, relâcher en masse avec ses protections, nom");
}

// 7. Objets d'élevage : achat en kamas + Essence, poser, retirer, prix des 5 niveaux
{
  const S = fresh(); const v = E.elevState(S); S.kamas = 60000; v.ess = 50;
  assert.ok(/Essence/.test(E.elvBuy(S, "baf", 0))); v.ess = 100; assert.strictEqual(E.elvBuy(S, "baf", 0), null); assert.strictEqual(S.kamas, 10000); assert.strictEqual(v.ess, 0);
  assert.strictEqual(v.inv.length, 1); assert.strictEqual(E.elvEquip(S, 1, 0), null); assert.strictEqual(v.slots[1].baf.n, 20); assert.strictEqual(v.inv.length, 0);
  assert.strictEqual(E.elvUnequip(S, 1, "baf"), null); assert.strictEqual(v.inv.length, 1);
  assert.deepStrictEqual(E.ELV_KAMAS, [50000, 120000, 300000, 700000, 1500000]); assert.deepStrictEqual(E.ELV_ESS, [100, 250, 600, 1200, 2500]);
  console.log("ok - objets d'élevage : achat, poser, retirer");
}

// 8. Éleveur automatique : objectif carnet, jamais les montures montées, s'arrête une fois l'objectif atteint
{
  const S = fresh(); const A = mk(S, "dd", "Rousse"), B = mk(S, "dd", "Dorée"), R = mk(S, "dd", "Amande");
  E.equipMount(S, S.chars[0].id, R.uid); mk(S, "dd", "Amande");
  E.setAuto(S, true, "carnet"); E.enclosTick(S, 6000);
  assert.strictEqual(S.enclos.pairs.length, 1, "un couple lancé (Rousse + Dorée)");
  assert.ok(!E.inPair(S, R.uid), "monture montée jamais utilisée");
  // objectif : une couleur précise
  const S2 = fresh(); mk(S2, "dd", "Rousse"); mk(S2, "dd", "Dorée"); mk(S2, "dd", "Rousse");
  E.setAuto(S2, true, "col:dd:Pourpre"); E.enclosTick(S2, 6000);
  const p = S2.enclos.pairs[0]; assert.ok(p, "il vise d'abord Indigo, parent de Pourpre");
  assert.deepStrictEqual([S2.mounts[p.a].c, S2.mounts[p.b].c].sort(), ["Dorée", "Rousse"]);
  assert.deepStrictEqual(E.colourPath(S2, "dd", "Pourpre").map((x) => x[2]), ["Indigo", "Pourpre"]);
  S2.mountSeen.dd.Pourpre = 1; E.enclosTick(S2, 6000); assert.strictEqual(E.elevState(S2).auto.on, false, "objectif atteint : arrêt");
  console.log("ok - éleveur automatique : carnet, couleur visée, montures montées laissées, arrêt à l'objectif");
}

// 9. Balades : niveau 50, 2 à la fois, Essence et ressources au retour
{
  const S = fresh(); const v = E.elevState(S); const A = mk(S, "dd", "Rousse"), B = mk(S, "dd", "Rousse"), C = mk(S, "dd", "Rousse");
  const low = mk(S, "dd", "Rousse"); low.lvl = 20; assert.ok(/niveau 50/.test(E.baladeStart(S, low.uid, 4)));
  assert.strictEqual(E.baladeStart(S, A.uid, 4), null); assert.strictEqual(E.baladeStart(S, B.uid, 8), null); assert.ok(/2 balades/.test(E.baladeStart(S, C.uid, 4)));
  assert.ok(/balade/.test(E.breedWhy(S, A))); assert.ok(/balade/.test(E.releaseMount(S, A.uid)));
  const r0 = Object.values(S.res).reduce((a, b) => a + b, 0);
  E.enclosTick(S, 4 * 3600e3 + 1); assert.strictEqual(v.bal.length, 1); assert.strictEqual(v.ess, 60);
  const r1 = Object.values(S.res).reduce((a, b) => a + b, 0); assert.ok(r1 - r0 >= 3 && r1 - r0 <= 6, `3 à 6 ressources (${r1 - r0})`);
  E.enclosTick(S, 4 * 3600e3 + 1); assert.strictEqual(v.bal.length, 0); assert.strictEqual(v.ess, 200);
  console.log("ok - balades : 4 h et 8 h, 2 à la fois, Essence et ressources de la zone");
}

// 10. Commandes : 3 par jour, mêmes pour la journée, livrer retire la monture et paie
{
  const S = fresh(); mk(S, "dd", "Rousse"); mk(S, "dd", "Amande"); mk(S, "dd", "Dorée");
  const O = E.orders(S); assert.strictEqual(O.length, 3); assert.deepStrictEqual(E.orders(S), O, "les mêmes toute la journée");
  const o = O[0]; const M = mk(S, o.sp, o.c, { st: o.st }); E.checkAch(S); const k0 = S.kamas, n0 = E.stableN(S);
  assert.strictEqual(E.orderDeliver(S, 0, M.uid), null); assert.strictEqual(S.kamas, k0 + o.kamas); assert.strictEqual(E.stableN(S), n0 - 1);
  assert.ok(/déjà/.test(E.orderDeliver(S, 0))); assert.ok(E.orders(S)[0].done);
  console.log(`ok - commandes : ${O.map((x) => `${x.c} ★${x.st}`).join(", ")}`);
}

// 11. Carnet complet : titre, +5 places, 6e étoile ; les trois : Grand Éleveur et 4e couple ; places en kamas
{
  const S = fresh(); const cap0 = E.stableCap(S);
  for (const c of E.spColours("dd")) mk(S, "dd", c);
  assert.ok(S.titlesExtra.includes("Éleveur de dragodindes")); assert.strictEqual(E.stableCap(S), cap0 + 5); assert.strictEqual(E.starCap(S, { sp: "dd" }), 6);
  for (const sp of ["mu", "vk"]) for (const c of E.spColours(sp)) { if (E.stableN(S) >= E.stableCap(S)) for (const uid in S.mounts) { if (S.mounts[uid].sp === "dd") delete S.mounts[uid]; } mk(S, sp, c); }
  assert.ok(S.titlesExtra.includes("Grand Éleveur")); assert.strictEqual(E.pairCap(S), 4);
  const S2 = fresh(); const c0 = E.stableCap(S2); S2.kamas = 2.5e6;
  assert.strictEqual(E.stableBuy(S2), null); assert.strictEqual(E.stableCap(S2), c0 + 5); assert.strictEqual(S2.kamas, 1.5e6);
  assert.ok(/kamas/.test(E.stableBuy(S2)), "le prix double");
  S2.kamas = 1e12; for (let i = 0; i < 10; i++) E.stableBuy(S2); assert.strictEqual(E.stableCap(S2), 50, "50 places au plus");
  assert.ok(/4e couple|kamas/.test(E.pair4Buy(Object.assign(fresh(), { kamas: 0 }))));
  console.log("ok - carnet complet (titre, places, étoile), Grand Éleveur et 4e couple, places en kamas jusqu'à 50");
}

// 12. Ancienne partie : montures à ★1, couples gardés avec leur emplacement, sauvegarde aller-retour
{
  const S = fresh(); const A = mk(S, "dd", "Rousse"), B = mk(S, "dd", "Dorée"); E.startBreed(S, A.uid, B.uid);
  const old = JSON.parse(E.serialize(S)); delete old.elev; old.mounts[A.uid].st = undefined; delete old.enclos.pairs[0].s; delete old.enclos.pairs[0].T;
  const S2 = E.deserialize(JSON.stringify(old)); assert.strictEqual(S2.mounts[A.uid].st, 1); assert.strictEqual(S2.enclos.pairs[0].s, 0); assert.ok(S2.enclos.pairs[0].T > 0);
  assert.ok(S2.elev.q >= 2 && S2.elev.ess >= 200, "quête Apprenti éleveur : les étapes déjà faites sont validées au chargement"); assert.strictEqual(E.purity(S2.mounts[A.uid]), 2, "monture d'avant la refonte : pure");
  const S3 = E.deserialize(E.serialize(S2)); assert.deepStrictEqual(S3.elev.slots.length, 3);
  console.log("ok - ancienne partie : étoiles, couples, Essence, aller-retour de la sauvegarde");
}

// 14. Série 4 : quête Apprenti éleveur (22A), succès (23A), jour de l'élevage (24A), résumé au retour (19A)
{
  const S = E.newState("Quête", "iop"); S.kamas = 1e9; E.elevState(S); assert.strictEqual(S.elev.q, 0);
  const A = E.giveMount(S, "dd", "Rousse", "t"); A.lvl = 100; S.stats.captures = 1; E.elevCheck(S);
  assert.strictEqual(S.elev.q, 1); assert.strictEqual(S.cons.filet, 5, "5 filets pour la capture");
  S.enclos.built = true; E.elevCheck(S); assert.strictEqual(S.elev.q, 2); assert.strictEqual(S.elev.ess, 200);
  const B = E.giveMount(S, "dd", "Rousse", "t"); B.lvl = 100; E.startBreed(S, A.uid, B.uid); E.enclosTick(S, 9 * 3600e3);
  assert.ok(S.elev.q >= 3 && S.elev.inv.some((it) => it.k === "baf"), "Baffeur I pour le premier petit");
  assert.ok(S.ach.elv1, "succès Premier petit");
  const cap0 = E.stableCap(S); S.elev.n.maxSt = 2; E.setAuto(S, true, "carnet"); assert.strictEqual(S.elev.q, 5); assert.strictEqual(E.stableCap(S), cap0 + 1);
  S.mountSeen.dd.Pourpre = 1; E.elevCheck(S); assert.strictEqual(S.elev.q, 6); assert.ok(S.titlesExtra.includes("Éleveur en herbe"));
  assert.strictEqual(E.ACH.filter((a) => a.cat === "Élevage").length, 10, "10 succès d'élevage");
  // jour de l'élevage : objets −30 %, balades ×2, +10 % d'étoile
  E.elevAlm = () => true;
  assert.deepStrictEqual(E.elvPrice(S, "baf", 0), { k: 35000, e: 70 }); assert.strictEqual(E.starUpPct(S, null), 40);
  const C = E.giveMount(S, "dd", "Amande", "t"); C.lvl = 100; S.elev.ess = 0; E.baladeStart(S, C.uid, 4); E.enclosTick(S, 4 * 3600e3 + 1); assert.strictEqual(S.elev.ess, 120);
  E.elevAlm = () => false; assert.strictEqual(typeof alm0(S), "boolean");
  // résumé au retour
  S.elev.auto.on = false; S.enclos.pairs.length = 0; const D1 = E.giveMount(S, "dd", "Dorée", "t"), D2 = E.giveMount(S, "dd", "Dorée", "t"); D1.lvl = D2.lvl = 100;
  E.startBreed(S, D1.uid, D2.uid); delete S.elev.away; E.catchUp(S, 10 * 3600);
  assert.ok(S.elev.away && S.elev.away.births >= 1 && S.elev.away.kids.length >= 1, "résumé « Pendant ton absence »");
  assert.strictEqual(E.awayOk(S), null); assert.ok(!S.elev.away);
  console.log("ok - série 4 : quête Apprenti éleveur, 10 succès, jour de l'élevage, résumé au retour");
}

// 13. Résumé pour le classement et les annonces ; fichiers du jeu et du serveur
{
  const S = fresh(); mk(S, "dd", "Rousse", { st: 3 }); mk(S, "dd", "Amande", { chr: 1 });
  const r = E.elevSummary(S); assert.strictEqual(r.c, 2); assert.strictEqual(r.s, 4); assert.strictEqual(r.chr, 1);
  assert.strictEqual(E.elevColoursTotal(), 41);
  assert.ok(/"mounts", "elevage"/.test(fs.readFileSync(path.join(ROOT, "tools", "build_server.js"), "utf8")), "elevage.js dans le code du serveur (étoiles dans les stats)");
  assert.ok(/js\/elevage\.js/.test(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")) && /js\/elevage\.js/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")));
  console.log("ok - résumé Élevage (couleurs, étoiles, chromatiques) et fichiers chargés");
}
