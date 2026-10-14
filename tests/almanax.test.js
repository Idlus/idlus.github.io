/* Almanax 0.1.39 : calendrier de DOFUS, bonus ciblés, offrande. Lancer : node tests/almanax.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js"); require("../js/systems.js"); require("../js/mounts.js");
const D = require("../js/data.js");
const at = (d) => Date.parse(d + "T10:00:00");
let now = at("2026-10-13"); E.now = () => now;

// 1. Le calendrier : 366 jours, un Méryde par jour, les fêtes
const A = E.almanax(E.newState("A", "iop"));
assert.strictEqual(A.mer, "Astirout"); assert.strictEqual(A.kind, "xp"); assert.ok(A.target && A.target.name);
const seen = new Set(); for (let i = 0; i < 366; i++) { const x = E.almDay(at("2028-01-01") + i * 864e5); assert.ok(x.mer && E.ALM_KINDS[x.kind], "jour " + i); seen.add(x.kind); }
assert.strictEqual(seen.size, Object.keys(E.ALM_KINDS).length, "tous les types de bonus apparaissent dans l'année");
assert.strictEqual(E.almDay(at("2026-10-31")).kind, "fete"); assert.strictEqual(E.almDay(at("2027-01-01")).fete, "Nouvel An");
console.log("ok - calendrier : 366 jours, " + seen.size + " types de bonus, fêtes");

// 2. Sans offrande, rien ; avec, la famille ciblée seulement, et à part du plafond
const S = E.newState("B", "iop"); S.chars[0].lvl = 64; S.chars[0].inTeam = true;
const B = E.almanax(S); const fam = E.RACE_MONS[B.target.id][0]; const other = Object.keys(D.MONSTERS).find((k) => D.MONSTERS[k].race !== undefined && String(D.MONSTERS[k].race) !== String(B.target.id));
assert.strictEqual(E.almMult(S, "xp", { key: fam }), 1);
S.res[B.res] = B.qty; const xp0 = S.chars[0].xp + S.chars[0].lvl * 1e9; const k0 = S.kamas;
assert.strictEqual(E.almanaxOffer(S), null);
assert.ok(S.kamas - k0 >= B.kamas && S.chars[0].xp + S.chars[0].lvl * 1e9 > xp0, "l'offrande donne kamas et XP");
assert.strictEqual(E.almMult(S, "xp", { key: fam }), 1.3); assert.strictEqual(E.almMult(S, "xp", { key: other }), 1);
assert.strictEqual(E.almMult(S, "drop"), 1); assert.strictEqual(E.bonus(S, "xp"), E.bonus(E.newState("C", "iop"), "xp"), "le plafond commun n'est pas touché");
now += 864e5; assert.strictEqual(E.almMult(S, "xp", { key: fam }), 1, "le bonus s'arrête à minuit");
console.log("ok - offrande : kamas + XP, +30 % d'XP sur la famille du jour seulement, à part du plafond, jusqu'à minuit");

// 3. Les autres types
const day = (d) => { now = at(d); const s = E.newState("D", "iop"); s.chars[0].lvl = 64; const x = E.almanax(s); s.res[x.res] = x.qty; assert.strictEqual(E.almanaxOffer(s), null); return [s, x]; };
const find = (k) => { for (let i = 0; i < 366; i++) { const t = at("2027-01-01") + i * 864e5; const x = E.almDay(t); if (x.kind === k) return new Date(t).toISOString().slice(0, 10); } };
{ const [s, x] = day(find("dg")); s.dungeon = { id: x.target.id }; assert.strictEqual(E.almMult(s, "drop"), 1.45); s.dungeon = null; assert.strictEqual(E.almMult(s, "drop"), 1); }
{ const [s, x] = day(find("drop")); s.sub = x.target.id; assert.strictEqual(E.almMult(s, "drop"), 1.3); }
{ const [s, x] = day(find("gather")); assert.strictEqual(E.almMult(s, "gather", x.job), 1.5); assert.strictEqual(E.almMult(s, "gather", "zzz"), 1); }
{ const [s] = day(find("chal1")); assert.strictEqual(E.almMult(s, "chal1"), 1); }
{ const [s] = day(find("eco")); let n = 0; for (let i = 0; i < 4000; i++) n += E.almChance(s, "eco") ? 1 : 0; assert.ok(n > 300 && n < 500, "Économie ≈ 10 % : " + n); }
{ const [s] = day(find("archi")); assert.strictEqual(E.almMult(s, "archi"), 2); }
console.log("ok - donjon du jour, butin de zone, récolte d'un métier, challenge en plus, économie 10 %, traque ×2");

// 4. 0.1.44.2 : l'offrande et la cible restent les mêmes toute la journée, même si un héros gagne des niveaux
{ now = at("2026-10-13"); const s = E.newState("F", "iop"); s.chars[0].lvl = 20; const a = E.almanax(s);
  s.chars[0].lvl = 45; const b = E.almanax(s); assert.strictEqual(b.res, a.res); assert.strictEqual(b.qty, a.qty); assert.deepStrictEqual(b.target, a.target);
  now += 864e5; const c = E.almanax(s); assert.notStrictEqual(c.day, a.day); assert.strictEqual(s.almLvl.lvl, 45, "le lendemain, le niveau du jour est repris"); }
console.log("ok - offrande et cible figées pour la journée malgré les niveaux gagnés");

// 5. 1.0.29.4 : les offrandes déjà faites comptent pour les quêtes de Dofus (avant, seules celles faites pendant l'étape comptaient)
{ require("../js/pets.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
  now = at("2026-10-14"); const s = E.newState("G", "iop"); s.chars[0].lvl = 64; E.refreshSystems(s);
  const vi = E.DOFUS.veilleurs.steps.findIndex((x) => x.t === "almanax"); const ka = E.DOFUS.kaliptus.steps.findIndex((x) => x.t === "almanax");
  s.cnt.almanax = 6; Object.assign(E.dofusQuest(s, "veilleurs"), { step: vi, prog: 0 }); Object.assign(E.dofusQuest(s, "kaliptus"), { step: ka, prog: 0 });
  E.refreshArchis(s);
  assert.strictEqual(E.dofusQuest(s, "veilleurs").step, vi + 1, "6 offrandes déjà faites : l'étape des 5 offrandes est validée au chargement");
  assert.deepStrictEqual(E.dofusStepProgress(s, "kaliptus", ka), [6, 7]); assert.strictEqual(E.dofusQuest(s, "kaliptus").step, ka);
  const x = E.almanax(s); s.res[x.res] = x.qty; assert.strictEqual(E.almanaxOffer(s), null);
  assert.strictEqual(E.dofusQuest(s, "kaliptus").step, ka + 1, "la 7e offrande valide l'étape du Kaliptus"); }
console.log("ok - quêtes de Dofus : les offrandes déjà faites comptent");
