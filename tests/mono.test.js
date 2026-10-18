/* Monocompte (js/mono.js), étapes 1 et 2 : partie à part avec un seul héros, bonus Héros unique, 3 Dofus portés,
   butin d'équipement du héros seul, gains hors ligne à 80 %, mercenaire et combats de groupe. Sans navigateur.
   Lancer : node tests/mono.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/mono.js");
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
console.log("Monocompte : tout est bon");
