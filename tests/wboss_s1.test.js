/* Boss des mondes · Saison 1 (rotation hebdomadaire, mécaniques, boutique d'anomalie), sans navigateur.
   Lancer : node tests/wboss_s1.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js"); require("../js/gboss.js"); require("../js/wboss.js"); require("../js/mono.js"); require("../js/saisonc.js");
const D = require("../js/data.js");

// 1. Rotation : Gargandyas + 4 géants sur 8 semaines, 2e passage = une mécanique en plus, tous calibrés.
const C = E.WB_S1;
assert.deepStrictEqual(C.rot, ["garga", "kralamoure", "cire_momore", "grozilla", "chazino", "garga", "kralamoure", "cire_momore"]);
for (let w = 1; w <= C.weeks; w++) {
  const d = E.wbS1Def(w); assert.ok(D.MONSTERS[d.mon], "boss inconnu " + w); assert.ok(d.pow > 0 && E.WB_POW["s1_" + d.key] > 0, "non calibré " + d.key);
  assert.notStrictEqual(d.weak, d.res); assert.ok(d.mech.length >= 1); d.mech.forEach((m) => assert.ok(E.BOSS_MECHS[m], "mécanique inconnue " + m));
}
assert.strictEqual(E.wbS1Def(1).name, "Gargandyas");
assert.strictEqual(E.wbS1Def(2).pass, 1); assert.strictEqual(E.wbS1Def(7).pass, 2);
assert.ok(E.wbS1Def(7).mech.length > E.wbS1Def(2).mech.length, "2e passage plus dur");
assert.deepStrictEqual(E.wbS1Weeks("garga"), [1, 6]);
assert.strictEqual(E.wbS1Cap(9999), C.cap); assert.strictEqual(E.wbS1Cap(-5), 0);
assert.deepStrictEqual([0, 2, 3, 8, 9, 17, 18, 40].map((k) => (E.wbS1Tier(k) || {}).id || null), [null, null, "bronze", "bronze", "argent", "argent", "or", "or"]);
// les objets des géants n'arrivent jamais dans un coffre : ils portent le drapeau wboss
Object.values(E.WB_S1_SHOP).flat().forEach(([r]) => { if (!r.includes(":")) assert.ok(D.ITEMS[r] && D.ITEMS[r].wboss, "objet de boutique hors coffre : " + r); });
console.log("ok - rotation, calibrage, paliers d'essais");

// 2. Combats : les mécaniques propres se jouent (Étreinte, Coup de dés) et le même hasard donne les mêmes points.
const t0 = Date.UTC(2030, 0, 6, 12); E.setClock(() => t0);
const G = E.newState("Équipe", "iop"); G.chars[0].lvl = 200; ["eni", "feca", "cra", "sacri", "osa", "panda", "sram"].forEach((k, i) => { const x = E.addChar(G, k, "H" + i, 200); x.inTeam = true; });
G.chars.forEach((c) => E.refreshSpells(c, E.charStats(G, c)));
const seen = {};
for (let w = 1; w <= 5; w++) {
  const d = E.wbS1Def(w); const seed = E.wbSeed(w, "u", 0);
  const r1 = E.wbSim(G, d, 1, seed, t0), r2 = E.wbSim(G, d, 1, seed, t0);
  assert.deepStrictEqual(r1, r2, "même essai, même résultat " + d.key);
  assert.ok(r1.points >= 0 && r1.rounds <= E.WB_ROUNDS, JSON.stringify(r1));
  const W = E.wbWatch(G, d, 2, seed, t0); assert.ok(!W.err, W.err);
  for (let i = 0; i < 400 && !W.done; i++) E.wbWatchStep(W);
  const txt = JSON.stringify((W.S2.fight && W.S2.fight.log) || W.log || []);
  if (/tentacule|étreinte/i.test(txt)) seen.etreinte = 1; if (/lance les dés/.test(txt)) seen.des = 1;
}
assert.ok(seen.etreinte, "l'Étreinte des abysses se joue"); assert.ok(seen.des, "le Coup de dés se joue");
console.log("ok - mécaniques Étreinte et Coup de dés jouées, combats reproductibles");

// 3. Boutique d'anomalie : réservée à la Saison 1, rayon ouvert à l'arrivée du boss, prix en Fragments d'anomalie, apparat une fois.
const FRAG = E.WB_FRAG;
const S = E.newState("Saison", "iop");
assert.ok(E.wbS1Buy(S, "garga", "i31789").err, "hors saison : refusé");
E.s1cStart(S, t0);
S.res[FRAG] = 50;
assert.ok(/Il te faut 90/.test(E.wbS1Buy(S, "garga", "i31789").err));
S.res[FRAG] = 500;
const b1 = E.wbS1Buy(S, "garga", "i31789"); assert.ok(b1.ok && b1.it, JSON.stringify(b1)); assert.strictEqual(E.wbFrags(S), 410);
assert.ok(/rayon ouvre/.test(E.wbS1Buy(S, "kralamoure", "ap:i18632").err), "rayon du Kralamoure fermé en semaine 1");
E.setClock(() => t0 + 8 * 864e5);
const b2 = E.wbS1Buy(S, "kralamoure", "ap:i18632"); assert.ok(b2.ok, JSON.stringify(b2)); assert.ok(E.wbS1Owns(S, "i18632"));
assert.ok(/déjà/.test(E.wbS1Buy(S, "kralamoure", "ap:i18632").err), "apparat une seule fois");
assert.ok(E.wbS1Buy(S, "chazino", "cons:coffre_or").err, "rayon du Chazino fermé en semaine 2");
E.setClock(() => t0 + 29 * 864e5);
const n0 = (S.cons && S.cons.coffre_or) || 0; assert.ok(E.wbS1Buy(S, "chazino", "cons:coffre_or").ok); assert.strictEqual(S.cons.coffre_or, n0 + 1);
assert.ok(E.wbS1Buy(S, "garga", "i_inconnu").err);
console.log("ok - boutique d'anomalie");

// 4. Dernier soir : dernier jour de la semaine, 20 h - 22 h à Paris, boss sous 25 % → 4 essais (même règle que wb_last_night).
const ends = Date.UTC(2030, 0, 13, 23); // lundi 00:00 à Paris (UTC+1 en hiver)
const at = (h, m = 0) => Date.UTC(2030, 0, 13, h - 1, m); // dimanche, heure de Paris
const B = { ends, hp: 10000, dmg: 7600 };
assert.strictEqual(E.wbS1Tries(B, at(20, 30)), 4, "dernier soir : 4 essais");
assert.strictEqual(E.wbS1Tries(B, at(19, 59)), 3); assert.strictEqual(E.wbS1Tries(B, at(22, 0)), 3);
assert.strictEqual(E.wbS1Tries(B, at(20, 30) - 864e5), 3, "seulement le dernier soir");
assert.strictEqual(E.wbS1Tries({ ends, hp: 10000, dmg: 7400 }, at(20, 30)), 3, "boss encore au-dessus de 25 %");
assert.strictEqual(E.wbS1Tries({ ends, hp: 10000, dmg: 10000 }, at(20, 30)), 3, "boss déjà tombé");
console.log("ok - dernier soir");

// 5. Bilan du lundi sur Discord (tools/wboss_recap.js --print) : chute, podium, paliers, nouveau boss et sa mécanique.
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync } = require("child_process");
const tmp = path.join(os.tmpdir(), "wb_recap_test.json");
fs.writeFileSync(tmp, JSON.stringify([{ r: [{ n: 6, name: "Gargandyas", fled: true, hp: 20000, cap: 12000, players: 12, top: [{ p: "A", best: 900 }], pct: 60, pal: 50, tiers: { bronze: 4 }, next_n: 7, next: "Kralamoure Géant" }] }]));
const out = execFileSync("node", [path.join(__dirname, "..", "tools", "wboss_recap.js"), tmp, "--print"], { encoding: "utf8" });
assert.ok(/s'est enfui\*\* avec 40 % de vie/.test(out) && /paliers du serveur : 50 %/.test(out) && /Kralamoure Géant\*\*, qui revient plus fort/.test(out) && /Étreinte des abysses \+ /.test(out), out);
fs.writeFileSync(tmp, "[]"); assert.ok(/Pas de bilan/.test(execFileSync("node", [path.join(__dirname, "..", "tools", "wboss_recap.js"), tmp, "--print"], { encoding: "utf8" })));
console.log("ok - bilan du lundi");
E.setClock(null);
