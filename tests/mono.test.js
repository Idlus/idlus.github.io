/* Monocompte (js/mono.js), étapes 1 et 2 : partie à part avec un seul héros, bonus Héros unique, 3 Dofus portés,
   butin d'équipement du héros seul, gains hors ligne à 80 %, mercenaire et combats de groupe. Sans navigateur.
   Lancer : node tests/mono.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/alignement.js"); require("../js/wboss.js"); require("../js/defi.js"); require("../js/koli.js"); require("../js/mono.js"); require("../js/monopass.js");
const D = require("../js/data.js");

let seed = 4242;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true; E.dungeonUnlocked = () => true;

// 1. Une partie Monocompte : le drapeau survit à la sauvegarde, pas de recrutement.
{
  const S = E.monoStart(E.newState("Solo", "iop"));
  assert.ok(E.isMono(S) && S.mono.s === E.MONO.saison);
  const T = E.deserialize(E.serialize(S));
  assert.ok(E.isMono(T), "le drapeau Monocompte reste après la sauvegarde");
  S.kamas = 1e9;
  assert.ok(/un seul héros/.test(E.recruit(S, "cra", "Deux")), "pas de recrutement");
  assert.strictEqual(S.chars.length, 1);
  const C = E.newState("Classique", "iop"); C.kamas = 1e9;
  assert.strictEqual(E.recruit(C, "cra", "Deux"), null, "le serveur Classique recrute toujours");
  console.log("ok - un seul héros");
}

// 2. 3 Dofus portés au plus.
{
  const S = E.monoStart(E.newState("Solo", "iop")); const c = S.chars[0]; c.lvl = 200;
  const dofus = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === "dofus" && D.ITEMS[id].dofus).slice(0, 4);
  const its = dofus.map((t) => E.rollItem(S, t, {}));
  its.slice(0, 3).forEach((it) => assert.strictEqual(E.equip(S, c.id, it.uid), null));
  assert.ok(/3 Dofus portés au plus/.test(E.equip(S, c.id, its[3].uid)), "4e Dofus refusé");
  assert.ok(/3 Dofus portés au plus/.test(E.equip(S, c.id, its[3].uid, "dofus5")), "emplacement 5 refusé");
  assert.strictEqual(E.equip(S, c.id, its[3].uid, "dofus2"), null, "remplacer un Dofus porté");
  assert.ok(Object.keys(c.equip).filter((k) => k.startsWith("dofus")).every((k) => ["dofus1", "dofus2", "dofus3"].includes(k)));
  console.log("ok - 3 Dofus");
}

// 3. Bonus Héros unique en donjon : PV, dégâts subis et dégâts ; la classe compte.
{
  const S = E.monoStart(E.newState("Solo", "roub")); const c = S.chars[0]; c.lvl = 60; c.inTeam = true;
  const did = Object.keys(D.DUNGEONS).find((k) => D.DUNGEONS[k].lvl === 60);
  S.res[D.DUNGEONS[did].key] = 5;
  assert.strictEqual(E.enterDungeon(S, did, 1), null);
  for (let i = 0; i < 60 && !(S.fight && S.fight.dmgInit); i++) E.tick(S, 1000);
  const h = S.fight.ents.find((e) => e.side === "c" && !e.summon);
  const C = E.newState("Classique", "roub"); C.chars[0].lvl = 60; C.res[D.DUNGEONS[did].key] = 5; E.enterDungeon(C, did, 1); for (let i = 0; i < 30 && !C.fight; i++) E.tick(C, 1000);
  const hc = C.fight.ents.find((e) => e.side === "c" && !e.summon);
  assert.ok(h.hpMax > hc.hpMax * 1.4, "plus de PV que le héros seul du Classique");
  assert.strictEqual(h.smallDr, E.MONO.dr + E.MONO.cls.roub.dr, "dégâts subis réglés pour le Roublard");
  assert.ok(h.dmgBonus >= E.MONO.dmg, "dégâts du Héros unique");
  console.log("ok - bonus Héros unique");
}

// 4. Butin d'équipement : ×4 jusqu'au niveau 100, ×1,5 au-delà.
{
  const S = E.monoStart(E.newState("Solo", "iop"));
  assert.strictEqual(E.monoItem(S, { lvl: 100 }), 4);
  assert.strictEqual(E.monoItem(S, { lvl: 101 }), 1.5);
  // même combat, même tirage : le héros seul du Monocompte trouve plus d'équipements
  const drops = (mono) => { let n = 0; for (let i = 0; i < 2000; i++) { seed = 1000 + i; const T = E.newState("L", "iop"); if (mono) E.monoStart(T); T.chars[0].lvl = 20;
    const sub = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] <= 20 && E.SUBS[k].lvl[1] >= 20);
    const g = E.makeGroup(T, E.SUBS[sub], 1); n += E.giveRewards(T, g, {}).items.length; } return n; };
  const a = drops(false), b = drops(true);
  assert.ok(a > 0 && b > a * 2.5, `butin d'équipement plus généreux (${a} → ${b})`);
  console.log(`ok - butin d'équipement (${a} → ${b})`);
}

// 5. Hors ligne : 80 % des gains.
{
  const run = (mono) => { seed = 99; const T = E.newState("H", "iop"); if (mono) E.monoStart(T); T.chars[0].lvl = 30; T.chars[0].inTeam = true;
    const sub = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] <= 25 && E.SUBS[k].lvl[1] >= 25);
    E.startHunt(T, sub); T.stats.recent = Array.from({ length: 10 }, () => ({ d: 10, w: 1 })); const k0 = T.kamas; E.catchUp(T, 4 * 3600); return T.kamas - k0; };
  const a = run(false), b = run(true);
  assert.ok(b < a * 0.9 && b > a * 0.65, `gains hors ligne vers 80 % (${a} → ${b})`);
  console.log(`ok - hors ligne à 80 % (${a} → ${b})`);
}
// 6. Étape 2 : mercenaire (payé, sans XP ni butin, repart à la fin), combat de groupe déterministe, butin individuel.
{
  const did = Object.keys(D.DUNGEONS).find((k) => D.DUNGEONS[k].lvl === 60);
  const S = E.monoStart(E.newState("Solo", "iop")); const me = S.chars[0]; me.lvl = 60; me.inTeam = true; S.res[D.DUNGEONS[did].key] = 3;
  S.kamas = 100; assert.ok(/kamas pour le mercenaire/.test(E.monoEnter(S, did, 1, "eni")), "mercenaire trop cher");
  S.kamas = 1e6; assert.strictEqual(E.monoEnter(S, did, 1, "eni"), null);
  assert.strictEqual(S.kamas, 1e6 - E.MONO.merc.cost); const m = E.monoMercOf(S);
  assert.ok(m && m.lvl === 60 && E.team(S).length === 2, "le mercenaire combat au niveau du héros");
  assert.strictEqual(E.lootRolls(S), 1, "le mercenaire ne compte pas pour le butin");
  assert.ok(E.monoPlayers(S, E.team(S)) === 1.5 && E.monoFade(1.5) < 1 && E.monoFade(1.5) > E.MONO.group[2], "un demi-joueur");
  const x0 = m.xp; for (let i = 0; i < 4000 && S.dungeon; i++) E.tick(S, 1000);
  assert.ok(!S.dungeon && !E.monoMercOf(S) && !S.mono.merc, "il repart à la fin du donjon");
  assert.ok(!Object.values(S.items).some((it) => it.merc), "son équipement repart avec lui");
  assert.ok(E.recruit(S, "cra", "X"), "toujours un seul héros"); void x0;
  // donjons enchaînés avec mercenaire (ticket #151) : il reste, payé à chaque course ; plus de kamas = fin de l'enchaînement
  S.res[D.DUNGEONS[did].key] = 3; S.kamas = 1e6; me.hp = 1e9;
  assert.strictEqual(E.monoEnter(S, did, 1, "eni", 3), null); assert.strictEqual(S.dungeon.chain, 3);
  let runs = 1, guard = 0; const id0 = S.dungeon;
  for (let last = S.dungeon; S.dungeon && guard < 20000; guard++) { E.tick(S, 1000); if (S.dungeon && S.dungeon !== last) { runs++; last = S.dungeon; assert.ok(E.monoMercOf(S), "le mercenaire reste pour la course suivante"); } }
  assert.strictEqual(runs, 3, "trois donjons enchaînés"); void id0;
  assert.strictEqual(S.kamas >= 1e6 - 3 * E.MONO.merc.cost - 1, true); assert.ok(!E.monoMercOf(S), "il repart à la fin de l'enchaînement");
  S.res[D.DUNGEONS[did].key] = 2; S.kamas = E.MONO.merc.cost; // une seule course payable
  assert.strictEqual(E.monoEnter(S, did, 1, "eni", 2), null); guard = 0; let k1 = S.kamas;
  while (S.dungeon && guard++ < 20000) E.tick(S, 1000);
  assert.ok(!S.dungeon && S.res[D.DUNGEONS[did].key] === 1 && !E.monoMercOf(S), "sans kamas, l'enchaînement s'arrête et la clé reste");
  console.log("ok - donjons enchaînés avec mercenaire (payé à chaque course)"); void k1;
  // groupe : même graine, même combat ; 5 joueurs, mercenaire dans un groupe ou 2 mercenaires refusés
  const snap = (cls) => { const T = E.monoStart(E.newState("G" + cls, cls)); T.chars[0].lvl = 60; return E.monoSnap(T, T.chars[0]); };
  const grp = [snap("iop"), snap("eni"), snap("cra")];
  const R1 = E.monoGroupRun(grp, did, 2, 77), R2 = E.monoGroupRun(grp, did, 2, 77);
  assert.strictEqual(JSON.stringify(R1), JSON.stringify(R2), "combat de groupe déterministe");
  assert.ok(R1.rooms.length > 0, "au moins une salle jouée");
  assert.ok(E.monoGroupRun([snap("iop"), snap("iop"), snap("iop"), snap("iop"), snap("iop")], did, 1, 1).err, "4 joueurs au plus");
  assert.ok(/Pas de mercenaire/.test(E.monoGroupRun([snap("iop"), snap("cra"), E.monoMercSnap("eni", 60, 1)], did, 1, 1).err), "pas de mercenaire dans un groupe de joueurs");
  assert.ok(E.monoGroupRun([snap("iop"), E.monoMercSnap("eni", 60, 1), E.monoMercSnap("cra", 60, 2)], did, 1, 1).err, "un mercenaire au plus");
  assert.ok(!E.monoGroupRun([snap("iop"), E.monoMercSnap("eni", 60, 1)], did, 1, 1).err, "seul avec un mercenaire : accepté");
  assert.strictEqual(JSON.stringify(E.monoMercSnap("eni", 60, 5)), JSON.stringify(E.monoMercSnap("eni", 60, 5)), "même graine, même mercenaire");
  // butin individuel dans la partie de chacun
  const P = E.monoStart(E.newState("P", "iop")); P.chars[0].lvl = 60; const k0 = P.kamas, xp0 = P.chars[0].xp;
  const L = E.monoGroupLoot(P, R1);
  assert.ok(L.kamas > 0 && P.kamas > k0 && (P.chars[0].xp > xp0 || P.chars[0].lvl > 60), "chacun reçoit XP et kamas");
  if (R1.done) assert.strictEqual(E.stasisInfo(P, did).max, 2, "la stasis gagnée en groupe compte");
  console.log(`ok - mercenaire et groupe (${R1.rooms.length} salles, ${L.kamas} kamas)`);
}
// 7. Métiers (M1) : récolte et artisanat jusqu'au niveau 100, forgemagie jusqu'à 200, 3 spécialités jusqu'à 200, un changement par manche ; récolte 2 fois plus rapide.
{
  now = Date.UTC(2030, 0, 9, 12, 0);
  const S = E.monoStart(E.newState("Artisan", "iop")); S.crafts = S.crafts || {};
  const C = E.newState("Classique", "iop");
  assert.strictEqual(E.jobCap(C, "c", "tailleur"), 200, "Classique : 200");
  assert.strictEqual(E.jobCap(S, "c", "tailleur"), 100, "Monocompte : 100 hors spécialité");
  S.jobs.paysan.lvl = 100; S.jobs.paysan.xp = 0;
  const pot = () => { S.cons = S.cons || {}; S.cons.potion_savoir = 5; return E.useConsumable ? E.useConsumable(S, "potion_savoir", "paysan") : null; };
  if (E.useConsumable) { pot(); assert.strictEqual(S.jobs.paysan.lvl, 100, "bloqué au niveau 100"); }
  assert.strictEqual(E.monoSetSpec(S, 0, "tailleur"), null); assert.strictEqual(E.monoSetSpec(S, 1, "paysan"), null); assert.strictEqual(E.monoSetSpec(S, 2, "mineur"), null);
  assert.strictEqual(E.jobCap(S, "c", "tailleur"), 200); assert.strictEqual(E.jobCap(S, "f", "costumage"), 200);
  assert.ok(Object.keys(E.FM_JOBS).every((f) => E.jobCap(S, "f", f) === 200), "toute la forgemagie jusqu'au niveau 200");
  assert.ok(/déjà une spécialité/.test(E.monoSetSpec(S, 1, "tailleur")));
  S.jobs.paysan.lvl = 150; S.jobs.paysan.xp = 7;
  assert.ok(/une fois par manche/.test(E.monoSetSpec(S, 1, "bucheron")) === false, "premier changement libre");
  assert.strictEqual(S.jobs.paysan.lvl, 100, "le métier quitté redescend à 100");
  assert.ok(/une fois par manche/.test(E.monoSetSpec(S, 2, "pecheur")), "un seul changement par manche");
  now += 14 * 86400000; assert.strictEqual(E.monoManche(S), 2);
  assert.strictEqual(E.monoSetSpec(S, 1, "paysan"), null, "manche suivante : on peut changer");
  assert.strictEqual(S.jobs.paysan.lvl, 150, "il retrouve son niveau");
  // récolte : 2 fois plus rapide
  const c = S.chars[0], c2 = C.chars[0]; c.job = { job: "paysan", res: E.jobRes("paysan")[0][0] }; c2.job = { job: "paysan", res: c.job.res };
  assert.ok(Math.abs(E.gatherSpeed(S, "paysan", c) / E.gatherSpeed(C, "paysan", c2) - 2) < 1e-9, "récolte ×2");
  console.log("ok - métiers et spécialités");
}
// 8. Pass de saison et hauts faits.
{
  now = Date.UTC(2030, 0, 9, 12, 0);
  const S = E.monoStart(E.newState("Pass", "iop")); const B = E.bpState(S);
  assert.strictEqual(E.bpTier(S), 0); assert.ok(/pas encore atteint/.test(E.bpClaim(S, "free", 1)));
  const Q = E.bpQuests(S); assert.strictEqual(Q.day.length, 3); assert.strictEqual(Q.week.length, 3);
  const T = E.monoStart(E.newState("Autre", "cra")); assert.deepStrictEqual(E.bpQuests(T).day.map((x) => x.id), Q.day.map((x) => x.id), "mêmes quêtes pour tout le serveur");
  // finir une quête du jour rapporte des points
  const qd = E.MONO_QUESTS.day.find((q) => q.id === Q.day[0].id);
  const evs = { dungeon: { id: Object.keys(D.DUNGEONS)[0], stasis: 5, down: 0 }, win: { mons: [{ key: "x", archi: 1 }] }, harvest: { n: 1000 }, craft: {}, fm: {} };
  for (let i = 0; i < qd.need && Q.day[0].p < qd.need; i++) E.emit(S, qd.ev, evs[qd.ev]);
  assert.ok(B.pts >= E.MONO.bp.day, `quête du jour : +${E.MONO.bp.day} points (${B.pts})`);
  // palier 1 : gratuit oui, Prestige seulement avec 1 point de haut fait
  B.pts = 500; const k0 = S.kamas;
  assert.strictEqual(E.bpClaim(S, "free", 1), null); assert.ok(S.kamas > k0 || Object.keys(S.cons).length, "récompense donnée");
  assert.ok(/Déjà/.test(E.bpClaim(S, "free", 1)));
  B.hf = {}; assert.ok(/Prestige/.test(E.bpClaim(S, "pres", 1)), "Prestige fermé sans haut fait");
  for (let i = 0; i < 25; i++) E.emit(S, "dungeon", { id: "d" + i, stasis: 1, down: 0 });
  assert.ok((B.hf.s_boss || 0) >= 1, "haut fait Chasseur de boss en bronze"); assert.ok(E.bpPrestigePts(S) >= 1);
  assert.strictEqual(E.bpClaim(S, "pres", 1), null, "Prestige ouvert par un haut fait");
  // grand palier 25 : ornement de saison ; 50 : titre
  B.pts = 50 * 500; assert.strictEqual(E.bpClaim(S, "free", 25), null); assert.ok(E.ornUnlocked(S, "mono_s1"), "ornement de saison");
  assert.strictEqual(E.bpClaim(S, "free", 50), null); assert.ok(S.titlesExtra.includes(E.MONO_TITLES.vet));
  // le Classique n'a pas de pass
  const C = E.newState("Classique", "iop"); assert.ok(/Monocompte/.test(E.bpClaim(C, "free", 1)));
  // une nouvelle saison repart de zéro
  S.mono.s = 2; assert.strictEqual(E.bpState(S).pts, 0);
  console.log("ok - pass de saison et hauts faits");
}
// 9. Défi de la manche.
{
  now = Date.UTC(2030, 0, 9, 12, 0);
  const S = E.monoStart(E.newState("Defi", "iop")); const T = E.monoStart(E.newState("Autre", "cra"));
  const R = E.mdState(S); assert.strictEqual(R.did, E.mdState(T).did, "le même donjon pour tout le serveur");
  const dg = D.DUNGEONS[R.did]; assert.ok(dg.lvl >= 50 && dg.lvl <= 100, "manche 1 : donjon de niveau 50 à 100");
  const c = S.chars[0]; c.lvl = 200; c.inTeam = true; const keys = S.res[dg.key] || 0;
  assert.strictEqual(E.mdEnter(S), null); assert.strictEqual(S.dungeon.stasis, 1); assert.strictEqual(S.res[dg.key] || 0, keys, "pas de clé dépensée");
  const p0 = E.bpState(S).pts; for (let i = 0; i < 4000 && S.dungeon; i++) E.tick(S, 1000);
  assert.ok(R.best >= 1 && E.bpState(S).pts >= p0 + E.MONO.md.pts, `stasis gagnée : points de pass (${R.best})`);
  assert.strictEqual(E.mdEnter(S), null); assert.strictEqual(S.dungeon.stasis, R.best + 1, "essai suivant à la stasis d'après"); S.dungeon = null; E.tick(S, 1000);
  assert.ok(!S.mono.mdRun, "essai abandonné effacé");
  // fin de manche : coffre selon la meilleure stasis
  R.best = 6; now += 14 * 86400000; const P = E.mdPending(S); assert.strictEqual(P.length, 1); assert.strictEqual(P[0].chest, "coffre_or");
  assert.strictEqual(E.mdClaim(S, 1), null); assert.strictEqual(S.cons.coffre_or >= 1, true); assert.ok(E.mdClaim(S, 1));
  assert.notStrictEqual(E.mdState(S), R, "nouvelle manche, nouveau défi");
  console.log(`ok - défi de la manche (${dg.name})`);
}
// 10. Camp de la saison et Boss de saison.
{
  now = Date.UTC(2030, 0, 9, 12, 0);
  const S = E.monoStart(E.newState("Camp", "iop")); const c = S.chars[0]; c.lvl = 200; c.inTeam = true;
  assert.strictEqual(E.chooseAlign(S, "bonta", "coeur"), null);
  assert.ok(/un seul camp par saison/.test(E.chooseAlign(S, "brakmar", "coeur")), "un camp par saison");
  E.emit(S, "win", { mons: [{ key: "x" }], sub: "ast_cite" }); E.emit(S, "win", { mons: [{ key: "x" }], sub: "ast_cite", dungeon: "d" });
  assert.ok(!E.warState && !(E.bpState(S).war && Object.keys(E.bpState(S).war).length), "l'ancienne guerre codée (1 point par chasse) n'existe plus : alignements du Classique (js/monoalign.js)");
  assert.ok(E.sbTry(S).err, "fermé hors de 21 h");
  now = Date.UTC(2030, 0, 9, 20, 30); assert.ok(E.sbOpen(), "21 h 30 à Paris (hiver)");
  const r = E.sbTry(S); assert.ok(!r.err, r.err); assert.ok(r.points >= 0 && r.grade);
  E.sbTry(S); E.sbTry(S); assert.ok(/3 essais/.test(E.sbTry(S).err), "3 essais par soir");
  assert.strictEqual(E.bpState(S).cnt.live, 1, "une soirée comptée");
  const C = E.newState("Classique", "iop"); C.chars[0].lvl = 200; assert.strictEqual(E.chooseAlign(C, "bonta", "coeur"), null); assert.strictEqual(E.chooseAlign(C, "brakmar", "coeur"), null, "le Classique peut toujours changer");
  console.log(`ok - guerre et Boss de saison (${r.points} points, ${r.grade.g})`);
}
// 11. Fin de saison et Éternel.
{
  now = Date.UTC(2030, 2, 1, 12, 0);
  const S = E.monoStart(E.newState("Eternel", "cra")); const c = S.chars[0]; c.lvl = 120;
  assert.strictEqual(E.monoCurrent(), 1); assert.ok(!E.monoOver(S));
  const B = E.bpState(S); B.pts = 3 * E.MONO.bp.step; E.mdState(S).best = 8; // 3 paliers à prendre, coffre de la manche 1
  S.titlesExtra = ["Vieux titre"]; S.unlocks = { wing_or: 1, gift_o_mono_s1: 1, autre: 1 };
  now += 55 * 86400000; assert.ok(!E.monoOver(S), "encore dans la saison au jour 55");
  now += 2 * 86400000; assert.ok(E.monoOver(S), "saison finie après 8 semaines");
  const k0 = S.kamas; const got = E.monoToEternal(S);
  assert.ok(got.pass >= 3, `récompenses de pass données (${got.pass})`); assert.deepStrictEqual(got.chests, ["coffre_obsidienne"]);
  assert.ok(E.monoEternal(S) && !E.monoOver(S) && S.kamas >= k0, "le héros est dans l'Éternel avec ses kamas");
  assert.strictEqual(E.monoToEternal(S), null, "une seule fois");
  assert.ok(/saison est finie/.test(E.mdEnter(S)), "plus de Défi de la manche"); assert.ok(/saison est finie/.test(E.sbTry(S).err), "plus de Boss de saison");
  const p0 = E.bpState(S).pts; E.emit(S, "harvest", { n: 50 }); assert.strictEqual(E.bpState(S).pts, p0, "plus de quêtes de saison");
  assert.ok(E.monoCanSwap(S), "spécialités libres");
  S.align = { side: "bonta" }; assert.ok(!/un seul camp/.test(E.chooseAlign(S, "brakmar", "coeur") || ""), "camp libre dans l'Éternel");
  const L = E.monoLegacy(S); assert.ok(L.t.includes("Vieux titre") && L.u.includes("wing_or") && L.u.includes("gift_o_mono_s1") && !L.u.includes("autre"));
  const N = E.monoStart(E.newState("Nouveau", "iop")); assert.ok(E.monoApplyLegacy(N, E.monoLegacyMerge(null, L)) >= 3);
  assert.ok(N.titlesExtra.includes("Vieux titre") && N.unlocks.wing_or && N.chars[0].lvl === 1 && !E.monoEternal(N), "nouvelle saison : niveau 1, titres et apparences gardés");
  // date d'ouverture fixée : la saison est la même pour tous, et rien n'est ouvert après sa fin
  E.MONO.saisons[1].debut = now; assert.strictEqual(E.monoCurrent(), 1); assert.strictEqual(E.monoT0(N), now);
  now += 57 * 86400000; assert.strictEqual(E.monoCurrent(), null, "entre deux saisons"); assert.ok(E.monoOver(N));
  E.MONO.saisons[1].debut = null;
  console.log("ok - fin de saison et Éternel");
}
// 12. Petites règles de saison.
{
  now = Date.UTC(2030, 4, 1, 12, 0);
  const S = E.monoStart(E.newState("Regles", "iop")); E.monoBoot(S);
  assert.strictEqual(Math.round(E.sab(S).r), 3 * 3600, "réserve du Sablier à 3 h"); assert.strictEqual(E.sabMtLvl(S), 1, "Maîtrise du temps au niveau 1");
  assert.strictEqual(E.KOLI.size, 1, "Kolizéum en 1 contre 1");
  S.sablier.open = true; S.sablier.spd = 3; S.hunting = true; S.dungeon = { id: "x" }; assert.strictEqual(E.sabSpend(S, 1000), 3);
  S.mono.live = 1; assert.strictEqual(E.sabSpend(S, 1000), 1, "pas de Sablier en groupe en direct"); S.dungeon = null; S.mono.live = 0;
  const A = E.koliGhost(11, 200, 1), B = E.koliGhost(29, 200, 1); const W = E.koliWatch(A, B, 3);
  const k = E.MONO.koli.cls[A[0].cls] || 0; assert.strictEqual(W.S2.fight.ents.filter((e) => e.tm === 0 && !e.summon)[0].dmgBonus || 0, k, "réglage 1 contre 1 appliqué");
  const r = E.koliSim(A, B, 5); assert.ok(r && typeof r.win === "boolean");
  E.KOLI.size = 3; E.HERO_MAX = 19; E.TEAM_MAX = 8;
  console.log("ok - petites règles de saison");
}
console.log("Monocompte : tout est bon");
