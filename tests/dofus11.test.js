/* Les 4 Dofus de la 1.1 (choix de Mathis : 2B 3B 4A 5A 6A 7A 8A, œufs 1B 2B 3B 4C) : Dofus des Alliances, du Trool,
   Onirique et d'Idlus. Quêtes (nouvelles étapes), butins (aucun bonus ne change les chances), passifs, titre des 4.
   Sans navigateur. Lancer : node tests/dofus11.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "gboss", "koli", "legendaires", "dofusp", "songe", "foire"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA; const { DUNGEONS, ITEMS } = D;

let seed = 1111;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true;
const team = (L, cls = ["iop", "eni", "feca", "cra"]) => { const S = E.newState("Dof", cls[0]); S.chars[0].lvl = L; cls.slice(1).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); S.chars.forEach((c) => { c.inTeam = true; E.refreshSpells(c, E.charStats(S, c)); }); return S; };
const wear = (S, c, ids) => ids.forEach((id, i) => { const it = E.rollItem(S, "dofus_" + id, { radiant: false }); assert.strictEqual(E.equip(S, c.id, it.uid, D.DOFUS_SLOTS[i]), null, "équiper " + id); });
const N4 = ["alliances", "trool", "onirique", "idlus"];

// 1. Les 4 Dofus : objets, icônes, passifs, quêtes.
{
  assert.deepStrictEqual(E.DOFUS_11, N4);
  N4.forEach((id) => { const Df = E.DOFUS[id]; assert.ok(Df && ITEMS["dofus_" + id], id); assert.ok(E.DOFP_LIST[id], "passif " + id);
    assert.ok(require("fs").existsSync(`${__dirname}/../assets/i/${Df.icon}.png`), "œuf " + id);
    Df.steps.forEach((st) => assert.ok(E.dofusStepTxt(st).length > 8, `${id} : texte de l'étape ${st.t}`)); });
  assert.strictEqual(E.DOFUS.alliances.lvl, 180); assert.strictEqual(E.DOFUS.trool.dg, "fabrique_foux"); assert.strictEqual(E.DOFUS.idlus.dg, "horologium_xlii");
  assert.ok(DUNGEONS.fabrique_foux && DUNGEONS.horologium_xlii);
  console.log("ok - 4 Dofus, œufs, passifs et étapes");
}

// 2. Butins : Alliances sur tout boss de niveau 180+ dès la stasis 6 (×5) ; Onirique jamais en donjon ; Trool et Idlus sur leur boss.
{
  const hi = Object.keys(DUNGEONS).find((d) => DUNGEONS[d].lvl >= 180 && d !== "horologium_xlii"); const lo = Object.keys(DUNGEONS).find((d) => DUNGEONS[d].lvl < 180);
  assert.strictEqual(E.dofusDropOdds("alliances", hi, 5), 0, "pas avant la stasis 6");
  assert.strictEqual(E.dofusDropOdds("alliances", hi, 6), E.dofusOdds(6) * 5);
  assert.strictEqual(E.dofusDropOdds("alliances", hi, 10), 20000);
  assert.strictEqual(E.dofusDropOdds("alliances", lo, 10), 0, "pas sous le niveau 180");
  assert.strictEqual(E.dofusDropOdds("onirique", hi, 10), 0, "l'Onirique ne tombe que dans le Songe");
  assert.strictEqual(E.dofusDropOdds("trool", "fabrique_foux", 1), E.dofusOdds(1)); assert.strictEqual(E.dofusDropOdds("trool", hi, 10), 0);
  assert.strictEqual(E.dofusDropOdds("idlus", "horologium_xlii", 10), E.dofusOdds(10));
  assert.strictEqual(E.dofusDropOdds("ocre", hi, 10), E.ocreOdds(10, DUNGEONS[hi].lvl), "l'Ocre ne change pas");
  const I = E.dofusDropInfo("alliances"); assert.ok(I.dgs.length >= 40 && I.minLvl === 180 && I.k === 6);
  const J = E.dofusDropInfo("onirique"); assert.ok(J.songe && J.lad.length === E.SG_INT.length && J.lad[0] === 8000 && J.lad[7] === 4000);
  // le butin du Songe : une chance par héros, sans aucun bonus
  const S = team(200); let got = 0; E.setRng(() => 0); const out = []; E.dofusSongeDrop(S, 7, out); got = out.filter((n) => n === "Dofus Onirique").length;
  assert.strictEqual(got, 4, "une chance par héros"); E.setRng(() => 0.99999); const out2 = []; E.dofusSongeDrop(S, 7, out2); assert.strictEqual(out2.length, 0);
  E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
  console.log("ok - butins : Alliances ×5 dès la stasis 6, Onirique dans le Songe, aucun bonus");
}

// 3. Quêtes : les nouvelles étapes avancent avec le Kolizéum, la Foire, la guilde, le Songe et le temps hors ligne.
{
  const S = team(200); const q = (id) => E.dofusQuest(S, id);
  // Alliances : 3 boss 180+ en stasis 6 (déjà faits, ça compte)
  const hi = Object.keys(DUNGEONS).filter((d) => DUNGEONS[d].lvl >= 180).slice(0, 3);
  hi.forEach((d) => { E.stasisInfo(S, d).max = 6; S.progress.bossKills[d] = 1; }); E.refreshArchis(S);
  assert.strictEqual(q("alliances").step, 1, "3 boss de niveau 180+ en stasis 6");
  for (let i = 0; i < 20; i++) E.dofusQuestEvent(S, "guild", { k: "dep", kamas: i ? 10000 : 9999 }); assert.strictEqual(q("alliances").step, 1, "19 dons de 10 000 et un trop petit");
  E.dofusQuestEvent(S, "guild", { k: "dep", kamas: 50000 }); assert.strictEqual(q("alliances").step, 2, "20 dons");
  for (let i = 0; i < 25; i++) E.dofusQuestEvent(S, "koli", { win: true }); E.dofusQuestEvent(S, "koli", { win: false }); assert.strictEqual(q("alliances").step, 3, "25 victoires au Kolizéum");
  for (let i = 0; i < 3; i++) E.dofusQuestEvent(S, "guild", { k: "boss" }); assert.strictEqual(q("alliances").step, 4, "3 coups au boss de guilde");
  const d190 = Object.keys(DUNGEONS).find((d) => DUNGEONS[d].lvl >= 190);
  E.emit(S, "dungeon", { id: d190, stasis: 7 }); assert.strictEqual(q("alliances").step, 4, "stasis 7 ne suffit pas");
  E.emit(S, "dungeon", { id: d190, stasis: 8 }); assert.ok(q("alliances").done && E.dofusOwned(S, "alliances"), "Dofus des Alliances gagné");
  // Trool : Foire du Trool (vraies caisses)
  const st = E.DOFUS.trool.steps; S.dofusQ.trool.step = 1;
  for (let i = 0; i < 30; i++) { E.foireState(S).n = 0; S.kamas = 50000; assert.ok(E.foireOpen(S, E.FOIRE.CAISSES[0].id).ok); }
  assert.strictEqual(q("trool").step, 2, "30 caisses ouvertes"); assert.strictEqual(st[2].t, "chal");
  // Onirique : Songe
  E.dofusQuestEvent(S, "songe", { k: "valid", ii: 0 }); assert.strictEqual(q("onirique").step, 1);
  for (let i = 0; i < 3; i++) E.dofusQuestEvent(S, "songe", { k: "archi" }); assert.strictEqual(q("onirique").step, 2);
  E.dofusQuestEvent(S, "songe", { k: "valid", ii: 2 }); assert.strictEqual(q("onirique").step, 2, "Paradoxe 2 ne suffit pas");
  E.dofusQuestEvent(S, "songe", { k: "valid", ii: 3 }); E.dofusQuestEvent(S, "songe", { k: "valid", ii: 5 }); assert.ok(q("onirique").done, "Cauchemar 1 validé");
  // Idlus : 24 h hors ligne pendant l'étape (plafond du rattrapage compris)
  S.dofusQ.idlus.step = 1; S.lastTick = now;
  for (let i = 0; i < 2; i++) { now += 10 * 3600 * 1000; E.catchUp(S, 10 * 3600); }
  const [a, b] = E.dofusStepProgress(S, "idlus", 1); assert.ok(a >= 16 && a < 24 && b === 24, `heures hors ligne ${a}`);
  for (let i = 0; i < 2; i++) { now += 8 * 3600 * 1000; E.catchUp(S, 8 * 3600); } assert.strictEqual(q("idlus").step, 2, "24 h hors ligne");
  console.log("ok - quêtes : guilde, Kolizéum, Foire, Songe, hors ligne");
}

// 4. Titre « Gardien de la 1.1 » avec les 4 ; l'ornement unique vient du serveur (10 premiers).
{
  const S = team(200); N4.slice(0, 3).forEach((id) => E.giveDofus(S, id, "test")); assert.ok(!S.titlesExtra.includes(E.GARDIEN_TITLE));
  E.giveDofus(S, "idlus", "test"); assert.ok(S.titlesExtra.includes(E.GARDIEN_TITLE), "titre des 4");
  assert.ok(!E.ornUnlocked(S, "gardien")); assert.ok(E.grantGardien(S, 3) && E.ornUnlocked(S, "gardien") && !E.grantGardien(S, 1));
  const sql = require("fs").readFileSync(`${__dirname}/../supabase/classements.sql`, "utf8"); assert.ok(/'gardien11'/.test(sql) && /array\['alliances', 'trool', 'onirique', 'idlus'\]/.test(sql));
  console.log("ok - Gardien de la 1.1");
}

// 5. Passifs : la Bannière ne compte qu'une fois et tombe avec son porteur ; la Berceuse ralentit le plus dangereux ; Temps suspendu seulement hors ligne.
{
  const S = team(200); const [a, b, c] = S.chars; wear(S, a, ["alliances"]); wear(S, b, ["alliances"]); wear(S, c, ["onirique"]);
  const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] <= 200).sort((x, y) => y.lvl[0] - x.lvl[0])[0]; assert.ok(!E.startHunt(S, sub.id));
  for (let i = 0; i < 40 && !S.fight; i++) { now += 1000; E.tick(S, now); } const F = S.fight; assert.ok(F);
  const ea = F.ents.find((e) => e.cid === a.id), eb = F.ents.find((e) => e.cid === b.id), ed = F.ents.find((e) => e.cid === S.chars[3].id);
  const m = F.ents.find((e) => e.side === "m");
  const hit = () => { ed.dpBloom = 0; return E.dofpDmg(F, ed, m, false, 1000); }; assert.deepStrictEqual(ed.dp, []);
  const d1 = hit(); ea.alive = false; const d2 = hit(); eb.alive = false; const d3 = hit(); ea.alive = eb.alive = true;
  assert.ok(Math.abs(d1 / d3 - 1.03) < 0.002 && Math.abs(d2 / d3 - 1.03) < 0.002, `+3 % une seule fois (${d1} ${d2} ${d3})`);
  F.round = 4; F.dpOni = null; E.dofpTurn(S, F, F.ents.find((e) => e.cid === c.id));
  const slow = F.ents.filter((e) => e.side === "m" && e.slowR === 5); assert.strictEqual(slow.length, 1, "un ennemi assoupi");
  const S2 = team(200); wear(S2, S2.chars[0], ["idlus"]); const k0 = E.bonus(S2, "kamas"); E.dpOffline = true; const k1 = E.bonus(S2, "kamas"); E.dpOffline = false;
  assert.ok(k1 > k0 && E.bonus(S2, "kamas") === k0, "Temps suspendu seulement hors ligne");
  console.log("ok - passifs de la 1.1");
}
console.log("dofus11.test.js : tout est bon");
