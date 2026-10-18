/* Le nouveau Sram (js/sram.js) : pièges posés qui explosent au tour ennemi (donjon et Kolizéum), invisibilité −50 %,
   passif Assassin ; et la classe à l'honneur (rotation de la semaine, +10 % d'XP et de butin). Sans navigateur.
   Lancer : node tests/sram.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/verify.js"); require("../js/koli.js"); require("../js/sram.js");
const D = require("../js/data.js");

let seed = 777;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true;

// 1. Textes : passif Assassin, signature, phrases des sorts de piège et d'invisibilité.
{
  const C = D.CLASSES.sram;
  assert.strictEqual(C.passive.id, "assassin");
  assert.ok(/pièges posés/.test(C.signature), "signature du Sram");
  const traps = C.spells.filter((sp) => /Pi[eè]ge/i.test(sp.name) && !/Immobilisation/i.test(sp.name));
  assert.ok(traps.length >= 3, "le Sram a des pièges");
  assert.ok(traps.every((sp) => /^Pose un piège/.test(sp.desc)), "description des pièges");
  assert.ok(C.spells.some((sp) => /^Invisibilit/.test(sp.name) && /invisible 2 tours/.test(sp.desc)), "description de l'Invisibilité");
  const S = E.newState("Sr", "sram"); const c = S.chars[0]; c.lvl = 100;
  const sp = traps.find((x) => x.lvl <= 100); const r = E.spellEstimate(S, c, sp, 0);
  assert.ok(/^Pose un piège/.test(E.srSentence(c, sp, r, String)), "phrase de la fiche du piège");
  assert.strictEqual(E.passiveInfo(c, null).n, "Pièges");
  console.log("ok - textes du Sram");
}

// 2. Donjon : les pièges se posent (3 au plus) et explosent au tour des monstres.
{
  const S = E.newState("Sr", "sram"); S.chars[0].lvl = 120;
  ["sram", "sram", "sram"].forEach((k, i) => { const c = E.addChar(S, k, "S" + i, 120); c.inTeam = true; }); S.chars.forEach((c) => { c.inTeam = true; E.autoAllocate(S, c); });
  const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] <= 110).sort((a, b) => b.lvl[0] - a.lvl[0])[0];
  assert.ok(!E.startHunt(S, sub.id));
  let posed = 0, boom = 0, maxTraps = 0;
  for (let i = 0; i < 4000 && (posed === 0 || boom === 0); i++) {
    now += 1000; E.tick(S, now); const F = S.fight; if (!F) continue;
    S.chars.forEach((c) => { const n = (F.srTraps || []).filter((t) => t.src && t.src.name === c.name).length; maxTraps = Math.max(maxTraps, n); });
    if (F.log.some((l) => /pose un piège/.test(l.txt))) posed++; if (F.log.some((l) => /explose sous/.test(l.txt))) boom++;
  }
  assert.ok(posed > 0, "un piège posé"); assert.ok(boom > 0, "un piège qui explose");
  assert.ok(maxTraps <= E.SR_TRAP_MAX, "3 pièges au plus par Sram");
  console.log("ok - pièges en donjon");
}

// 3. Kolizéum : les pièges explosent sous les héros adverses ; l'invisibilité marche des deux côtés.
{
  const trig0 = E.srTrig; let kz = 0; E.srTrig = (S, F, m) => { const n = F.srTraps.length; trig0(S, F, m); if (F.srTraps.length < n) { kz++; assert.ok(m.tm !== undefined, "victime d'arène"); } };
  let sd = 1; while (!E.koliGhost(sd, 150).some((h) => h.cls === "sram")) sd++;
  const A = E.koliGhost(sd, 150), B = E.koliGhost(sd + 1000, 150); // une équipe d'arène avec un Sram
  for (let i = 0; i < 30 && !kz; i++) E.koliSim(A, B, 100 + i);
  E.srTrig = trig0;
  assert.ok(kz > 0, "un piège explose au Kolizéum");
  const F = { ents: [] }; const sr = { side: "m", srInvis: 2, hp: 1000, hpMax: 1000, alive: true, name: "Sr" }; const foe = { side: "c", name: "X" };
  F.ents.push(sr, foe); F.fx = []; F.seq = 0; F.log = [];
  const v = E.fightApi.dealDamage(F, foe, sr, 100, "n");
  assert.ok(v <= 60, "invisible : −50 % même quand le Sram est du côté « m » (Kolizéum)");
  console.log("ok - pièges et invisibilité au Kolizéum");
}

// 4. La classe à l'honneur : Sram d'abord, une classe par semaine, toutes les classes passent.
{
  assert.strictEqual(new Set(E.HONOR_ORDER).size, D.CLASS_ORDER.length, "toutes les classes dans la rotation");
  assert.ok(D.CLASS_ORDER.every((k) => E.HONOR_ORDER.includes(k)));
  assert.strictEqual(E.honorCls(Date.parse("2026-10-18T15:00:00Z")), "sram", "avant le premier lundi : le Sram");
  assert.strictEqual(E.honorCls(Date.parse("2026-10-21T12:00:00Z")), "sram");
  assert.strictEqual(E.honorCls(Date.parse("2026-10-26T12:00:00Z")), E.HONOR_ORDER[1], "la semaine suivante");
  const t = Date.parse("2026-10-21T12:00:00Z"); now = t;
  const S = E.newState("Hn", "iop"); const sr = E.addChar(S, "sram", "S", 50); sr.inTeam = true;
  assert.strictEqual(E.honorXp(sr), 1.1); assert.strictEqual(E.honorXp(S.chars[0]), 1, "les autres classes : rien");
  sr.lvl = E.MAX_LVL; assert.strictEqual(E.honorXp(sr), 1.1, "aussi sur la Maîtrise au niveau 200 (choix 2B)");
  assert.strictEqual(E.honorDrop(S), 1.1, "butin +10 % avec un Sram");
  sr.inTeam = false; assert.strictEqual(E.honorDrop(S), 1, "sans Sram dans l'équipe : rien");
  console.log("ok - classe à l'honneur");
}
console.log("sram.test.js : tout est bon");
