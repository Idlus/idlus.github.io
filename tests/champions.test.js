/* La refonte du Champion (js/champions.js) : Sceaux et rangs, trophées de zone, traque et Champion légendaire,
   fusions, Cri du Champion, Conclave, pas d'effet au Kolizéum, sauvegarde. Sans navigateur.
   Lancer : node tests/champions.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/koli.js"); require("../js/legendaires.js"); require("../js/dofusp.js");
require("../js/champions.js");

let seed = 777;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true;
const team = (L, cls = ["iop", "eni", "feca", "cra"]) => { const S = E.newState("Champ", cls[0]); S.chars[0].lvl = L; cls.slice(1).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c))); return S; };
const subAt = (lvl) => Object.values(E.SUBS).filter((s) => s.lvl[0] <= lvl && !s.hidden).sort((a, b) => b.lvl[0] - a.lvl[0])[0];
const kill = (S, k, n = 1) => { for (let i = 0; i < n; i++) E.champKill(S, { champ: k }, {}); };

// 1. Chance : 1 combat de chasse sur 50 (2B) ; 6 Sceaux, rangs à 1, 5, 15, 40 et 100
assert.strictEqual(E.CHAMP_CHANCE, 1 / 50);
assert.deepStrictEqual(E.SEAL_ORDER, Object.keys(E.CHAMP_POWERS), "un Sceau par pouvoir de Champion");
{
  const S = team(60);
  assert.strictEqual(E.sealRank(S, "enrage"), 0);
  [[1, 1], [4, 1], [5, 2], [15, 3], [40, 4], [99, 4], [100, 5], [400, 5]].forEach(([n, r]) => { S.ch = { k: { enrage: n } }; assert.strictEqual(E.sealRank(S, "enrage"), r, `${n} Champions = rang ${r}`); });
  assert.strictEqual(E.sealVal("enrage", 5), 15); assert.strictEqual(E.sealVal("meneur", 5), 5); assert.strictEqual(E.sealVal("traqueur", 1), 4);
}

// 2. Porter un Sceau : il faut l'avoir débloqué ; titre au premier rang 5, une seule fois
{
  const S = team(60); const c = S.chars[0];
  assert.ok(E.act(S, "sealWear", c.id, "blinde"), "Sceau pas encore débloqué");
  kill(S, "blinde");
  assert.strictEqual(E.act(S, "sealWear", c.id, "blinde"), null);
  assert.deepStrictEqual(E.sealOf(S, c).list, [{ k: "blinde", r: 1, w: 0, v: 2 }]);
  kill(S, "enrage", 100); kill(S, "vampire", 100);
  assert.ok(S.titlesExtra.includes("Champion Enragé"), "titre du premier rang 5");
  assert.ok(!S.titlesExtra.includes("Champion Vampirique"), "un seul titre « Champion »");
  assert.strictEqual(E.act(S, "sealWear", c.id, null), null); assert.strictEqual(E.sealOf(S, c), null, "Sceau retiré");
}

// 3. Trophées de zone et traque (chasse seulement) ; rien de tout ça en donjon
{
  const S = team(60); const sub = subAt(60); assert.ok(!E.startHunt(S, sub.id));
  ["enrage", "blinde", "vampire", "veloce", "meneur"].forEach((k) => kill(S, k));
  assert.ok(!E.champZoneDone(S, sub.id)); const m0 = E.trophyZoneMult(S);
  kill(S, "traqueur");
  assert.ok(E.champZoneDone(S, sub.id), "les 6 pouvoirs vaincus");
  assert.ok(Math.abs(E.trophyZoneMult(S) / m0 - 1.05) < 1e-9, "+5 % dans la sous-zone");
  assert.strictEqual(E.trophyZoneMult(S, { dungeon: true }), 1, "pas en donjon");
  assert.strictEqual(S.ch.t[sub.id], 3, "pistes plafonnées à 3");
  const S2 = team(60); S2.sub = sub.id; S2.dungeon = { id: Object.keys(require("../js/data.js").DUNGEONS)[0], stasis: 1 };
  kill(S2, "enrage");
  assert.strictEqual(E.sealKills(S2, "enrage"), 1, "un Champion de donjon (mutateur, idole) compte pour le Sceau");
  assert.ok(!S2.ch.z[sub.id] && !S2.ch.t[sub.id], "mais pas pour les trophées ni la traque");
}

// 4. Champion légendaire : 3 pistes, appelé au prochain groupe, tous les pouvoirs, PV ×12 ; le vaincre : titre et 10 Éclats
{
  const S = team(60); const sub = subAt(60); E.startHunt(S, sub.id);
  assert.ok(E.act(S, "champLegGo"), "il faut 3 pistes");
  S.ch.t[sub.id] = 3;
  assert.strictEqual(E.act(S, "champLegGo"), null); assert.strictEqual(S.ch.pend, sub.id);
  const g = E.makeGroup(S, sub, 4); const L = g.filter((m) => m.champLeg);
  assert.strictEqual(L.length, 1, "un seul légendaire"); assert.ok(!g.some((m) => m.champ && !m.champLeg), "pas d'autre Champion dans le groupe");
  const m = L[0]; const base = E.monsterEntity(m.key, m.lvl);
  assert.strictEqual(m.hpMax, Math.round(Math.round(base.hpMax * 2) / 2 * E.CHAMP_LEG_HP), "PV ×12"); assert.strictEqual(E.CHAMP_LEG_HP, 12);
  assert.ok(m.shield > 0 && m.vamp === 0.15 && m.enrageMod && m.champ === "meneur", "tous les pouvoirs");
  assert.strictEqual(S.ch.pend, null);
  E.champKill(S, m, {});
  assert.strictEqual(S.ch.t[sub.id], 0); assert.strictEqual(S.ch.sh, 10); assert.ok(S.titlesExtra.includes(`Traqueur de ${sub.name}`));
  assert.strictEqual(E.act(S, "sealShard", "veloce"), null); assert.strictEqual(E.sealKills(S, "veloce"), 1); assert.strictEqual(S.ch.sh, 9);
  S.ch.pend = sub.id; assert.ok(!E.makeGroup(S, sub, 4).some((x) => x.champLeg), "sans pistes, pas de légendaire");
}

// 4 bis (2.1.20). Appel automatique : dès 3 pistes, le légendaire vient au groupe suivant ; après une défaite, pause de 30 min dans la zone
{
  const S = team(60); const sub = subAt(60); E.startHunt(S, sub.id); S.ch = S.ch || {}; E.champState(S);
  S.ch.t[sub.id] = 3; assert.ok(!E.makeGroup(S, sub, 4).some((x) => x.champLeg), "coupé par défaut");
  assert.strictEqual(E.act(S, "champAuto", true), null); assert.strictEqual(S.ch.auto, true);
  assert.strictEqual(E.makeGroup(S, sub, 4).filter((x) => x.champLeg).length, 1, "appelé tout seul");
  assert.ok(!E.makeGroup(S, sub, 4).some((x) => x.champLeg), "défaite : pas de nouvel appel tout de suite");
  now += E.CHAMP_AUTO_PAUSE + 1000; const g = E.makeGroup(S, sub, 4); const m = g.find((x) => x.champLeg); assert.ok(m, "30 min plus tard, nouvel appel");
  E.champKill(S, m, {}); assert.ok(!S.ch.autoAt[sub.id], "victoire : plus de pause"); assert.strictEqual(S.ch.t[sub.id], 0);
  assert.ok(!E.makeGroup(S, sub, 4).some((x) => x.champLeg), "sans pistes, rien");
  S.ch.t[sub.id] = 3; E.catchingUp = true; assert.ok(!E.makeGroup(S, sub, 4).some((x) => x.champLeg), "jamais pendant l'absence"); E.catchingUp = false;
  E.act(S, "champAuto", false); assert.ok(!E.makeGroup(S, sub, 4).some((x) => x.champLeg), "coupé");
}

// 5. Fusions : deux Sceaux au rang 5, 15 noms, les deux pouvoirs à 70 %
{
  assert.strictEqual(Object.keys(E.SEAL_FUSIONS).length, 15);
  const S = team(60); const c = S.chars[0];
  kill(S, "enrage", 100); kill(S, "vampire", 99);
  assert.ok(E.act(S, "sealFuse", "vampire", "enrage"), "Vampirique pas encore au rang 5");
  assert.ok(E.act(S, "sealWear", c.id, "enrage+vampire"), "fusion pas découverte");
  kill(S, "vampire");
  assert.strictEqual(E.act(S, "sealFuse", "vampire", "enrage"), null);
  assert.deepStrictEqual(S.ch.f, ["enrage+vampire"]); assert.strictEqual(E.sealName("enrage+vampire"), "Berserker");
  assert.strictEqual(E.act(S, "sealWear", c.id, "enrage+vampire"), null);
  const s = E.sealOf(S, c); assert.deepStrictEqual(s.list.map((x) => x.v), [10.5, 5.6]); assert.ok(s.cri, "Cri du Champion avec un Sceau au rang 5");
}

// 6. En combat : Blindé, Vampirique, Meneur, Conclave ; Cri du Champion une fois sous 30 % ; rien au Kolizéum
{
  const S = team(60); const sub = subAt(60);
  E.SEAL_ORDER.forEach((k) => kill(S, k, 100));
  ["blinde", "vampire", "meneur", "traqueur"].forEach((k, i) => (S.chars[i].seal = k));
  const sf0 = E.sealFight; let sh0 = null; E.sealFight = (S2, F2) => { sf0(S2, F2); const h0 = F2.ents.find((e) => e.side === "c" && !e.summon); if (sh0 === null && h0) sh0 = { s: h0.shield, m: h0.hpMax }; }; // bouclier lu au début du combat (les premiers tours peuvent l'entamer)
  E.startHunt(S, sub.id); for (let i = 0; i < 40 && !S.fight; i++) { now += 1000; E.tick(S, now); }
  E.sealFight = sf0;
  const F = S.fight; assert.ok(F, "un combat");
  const hs = F.ents.filter((e) => e.side === "c" && !e.summon);
  assert.strictEqual(F.sealReso, 3, "Conclave : 4 pouvoirs différents"); assert.strictEqual(F.sealMen, 5, "Meneur rang 5");
  assert.ok(sh0 && sh0.s >= Math.round(sh0.m * 0.1), "bouclier du Blindé"); assert.strictEqual(hs[1].vamp, 0.08, "vol de vie du Vampirique");
  const e = hs[3]; const tgt = { hp: 10, hpMax: 100 };
  const v0 = E.sealDmg(F, e, tgt, 100); assert.ok(Math.abs(v0 - 100 * 1.08 * 1.2) < 1e-9, "Meneur + Conclave + Traqueur");
  e.hp = Math.floor(e.hpMax * 0.2); const v1 = E.sealDmg(F, e, tgt, 100);
  assert.ok(e.criUsed && Math.abs(v1 - 100 * 1.08 * 1.4) < 1e-9, "Cri du Champion : Traqueur doublé");
  e.criOn = 0; e.criUsed = true; assert.ok(Math.abs(E.sealDmg(F, e, tgt, 100) - v0) < 1e-9, "une fois par combat");
  assert.strictEqual(E.sealDmg({ pvp: true }, e, tgt, 100), 100, "pas de Sceaux au Kolizéum");
}

// 7. Sauvegarde : S.ch et les Sceaux portés passent la sauvegarde ; une vieille partie sans S.ch marche
{
  const S = team(60); kill(S, "meneur", 5); S.chars[0].seal = "meneur";
  const S2 = E.deserialize(E.serialize(S));
  assert.strictEqual(E.sealRank(S2, "meneur"), 2); assert.strictEqual(S2.chars[0].seal, "meneur");
  const old = team(60); delete old.ch; assert.strictEqual(E.sealOf(old, old.chars[0]), null); assert.strictEqual(E.sealRank(old, "enrage"), 0);
}

// 8. Fichiers : chargé après les passifs des Dofus, affichage chargé, hors-ligne et serveur
{
  const ROOT = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(html.indexOf("js/champions.js") > html.indexOf("js/dofusp.js"), "champions.js après dofusp.js");
  assert.ok(html.includes("js/champui.js"), "champui.js dans index.html");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"); assert.ok(sw.includes('"js/champions.js"') && sw.includes('"js/champui.js"'), "hors-ligne");
  assert.ok(fs.readFileSync(path.join(ROOT, "tools", "build_server.js"), "utf8").includes('"champions"'), "le serveur rejoue les combats avec les Sceaux");
}

// 2.1.x « Les Éclats du Traqueur » : Éveil des Sceaux et Comptoir des Éclats (choix 2C)
{
  const S = team(200); const c = S.chars[0]; const C = E.champState(S);
  kill(S, "enrage", 100); kill(S, "vampire", 100); kill(S, "veloce", 100); kill(S, "blinde", 4);
  assert.ok(/rang 5/.test(E.act(S, "sealEveil", "blinde")), "il faut le rang 5");
  assert.ok(/100 Éclats/.test(E.act(S, "sealEveil", "enrage")), "il faut des Éclats");
  C.sh = 2100;
  assert.strictEqual(E.act(S, "sealEveil", "enrage"), null); assert.strictEqual(C.sh, 2000); assert.strictEqual(E.sealEv(S, "enrage"), 1);
  E.act(S, "sealWear", c.id, "enrage"); assert.strictEqual(E.sealOf(S, c).list[0].v, 16.5, "Éveil 1 : +10 % (15 → 16,5)");
  for (let i = 0; i < 4; i++) assert.strictEqual(E.act(S, "sealEveil", "enrage"), null);
  assert.strictEqual(C.sh, 100, "100 + 200 + 350 + 550 + 800 = 2 000 Éclats"); assert.strictEqual(E.sealOf(S, c).list[0].v, 22.5, "Éveil complet : +50 %");
  assert.ok(/déjà/.test(E.act(S, "sealEveil", "enrage")));
  // fusion : suit le Sceau le moins éveillé ; Véloce garde « joue en premier » et frappe plus fort au premier tour
  E.act(S, "sealFuse", "enrage", "vampire"); E.act(S, "sealWear", c.id, "enrage+vampire");
  assert.deepStrictEqual(E.sealOf(S, c).list.map((x) => x.v), [10.5, 5.6], "vampire pas éveillé : fusion à 70 % sans bonus");
  C.ev.vampire = 2; assert.deepStrictEqual(E.sealOf(S, c).list.map((x) => x.v), [12.6, 6.7], "fusion : Éveil 2 des deux");
  C.ev.veloce = 3; E.act(S, "sealWear", c.id, "veloce"); const sv = E.sealOf(S, c).list[0]; assert.strictEqual(sv.v, 1); assert.strictEqual(sv.w, 3);
  const F = { round: 1 }; assert.strictEqual(Math.round(E.sealDmg(F, { side: "c", seal: E.sealOf(S, c), hp: 100, hpMax: 100 }, null, 100)), 112, "Véloce Éveil 3 : +12 % au premier tour");
  F.round = 2; assert.strictEqual(Math.round(E.sealDmg(F, { side: "c", seal: E.sealOf(S, c), hp: 100, hpMax: 100 }, null, 100)), 100);
  E.act(S, "sealFuse", "vampire", "veloce"); E.act(S, "sealWear", c.id, "vampire+veloce"); F.round = 1;
  assert.strictEqual(Math.round(E.sealDmg(F, { side: "c", seal: E.sealOf(S, c), hp: 100, hpMax: 100 }, null, 100) * 10) / 10, 105.6, "fusion : bonus de Véloce à 70 % (Éveil 2 : 8 % → 5,6 %)");
  // Comptoir des Éclats
  C.sh = 2000; const k0 = S.kamas;
  assert.strictEqual(E.act(S, "shardBuy", "vente"), null); assert.strictEqual(S.kamas, k0 + 100000); assert.strictEqual(C.sh, 1990);
  assert.ok(/pouvoir/.test(E.act(S, "shardBuy", "appat", "nope")));
  assert.strictEqual(E.act(S, "shardBuy", "appat", "meneur"), null); assert.strictEqual(C.bait, "meneur"); assert.ok(/attend déjà/.test(E.act(S, "shardBuy", "appat", "enrage")));
  const sub = subAt(195); E.startHunt(S, sub.id); const g = E.makeGroup(S, E.SUBS[sub.id], 4);
  assert.strictEqual(g.filter((m) => m.champ === "meneur").length, 1, "l'appât donne un Champion Meneur au prochain combat"); assert.strictEqual(C.bait, null);
  assert.strictEqual(E.act(S, "shardBuy", "piste"), null); assert.strictEqual(C.t[S.sub], 1);
  assert.strictEqual(E.act(S, "shardBuy", "coffre"), null); assert.strictEqual(S.cons.coffre_argent, 1);
  assert.strictEqual(E.act(S, "shardBuy", "orn"), null); assert.ok(E.ornUnlocked(S, "eclat")); assert.ok(/Déjà/.test(E.act(S, "shardBuy", "orn")));
  assert.strictEqual(E.act(S, "shardBuy", "titre"), null); assert.ok(S.titlesExtra.includes("Collectionneur d'éclats"));
  assert.strictEqual(C.sh, 1990 - 15 - 20 - 30 - 400 - 1000);
  const S2 = E.deserialize(E.serialize(S)); assert.strictEqual(S2.ch.ev.enrage, 5); assert.strictEqual(S2.ch.sh, C.sh);
}

console.log("champions.test.js : OK");
