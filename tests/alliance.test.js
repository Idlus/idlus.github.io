/* Alliances et prismes (1.1) : règles du jeu (js/alliance.js) et mêmes chiffres côté serveur (supabase/alliances.sql).
   Lancer : node tests/alliance.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/koli.js"); require("../js/alliance.js");
const D = require("../js/data.js");
const sql = fs.readFileSync(path.join(__dirname, "../supabase/alliances.sql"), "utf8");
const data = fs.readFileSync(path.join(__dirname, "../supabase/alliances_data.sql"), "utf8");

// 14B : égalité en tête, la région redevient libre ; 5 points pour prendre une région ; le tenant garde sans adversaire assez fort
assert.strictEqual(E.allyOutcome({ 1: 6, 2: 3 }, 2), 1);
assert.strictEqual(E.allyOutcome({ 1: 4 }, 2), 2);
assert.strictEqual(E.allyOutcome({ 1: 4 }, null), null);
assert.strictEqual(E.allyOutcome({ 1: 5 }, null), 1);
assert.strictEqual(E.allyOutcome({ 1: 5, 2: 5 }, 2), null);
assert.strictEqual(E.allyOutcome({}, 3), 3);
assert.strictEqual(E.allyOutcome({ 2: 9, 1: 7 }, 2), 2);

// 7B : la bataille (heure de Paris), le même jour et les mêmes heures que le serveur
const sqlInt = (fn) => +(sql.match(new RegExp(`function public\\.${fn}\\(\\) returns int language sql \\w+ as \\$\\$ select (\\d+) \\$\\$`)) || [])[1];
assert.strictEqual(sqlInt("al_battle_day"), E.ALLY.day, "jour de la bataille différent entre le jeu et le serveur");
assert.strictEqual(sqlInt("al_battle_from"), E.ALLY.from);
assert.strictEqual(sqlInt("al_battle_to"), E.ALLY.to);
const sat = Date.parse("2026-10-17T19:30:00Z"); // samedi 21 h 30 à Paris (heure d'été)
assert.strictEqual(E.allyBattle(sat).on, E.ALLY.day === 6);
assert.strictEqual(E.allyBattleWhen(), "samedi de 21 h à 22 h");
assert.ok(E.allyBattle(Date.parse("2026-10-15T10:00:00Z")).ms > 0);

// 8A : prix des améliorations identiques des deux côtés
for (const [k, M] of Object.entries(E.ALLY_MODS)) {
  const m = sql.match(new RegExp(`when '${k}' then \\(array\\[([\\d, ]+)\\]`)); assert.ok(m, `prix de ${k} absent du serveur`);
  assert.deepStrictEqual(m[1].split(",").map(Number), M.k, `prix de ${k} différents`);
}
assert.strictEqual(E.allyModK("ralliement", 1), null);

// 12A : prisme et gardes (+30 %, +10 % par rang de Rempart), assaillants +30 %
const lvl = 150, g0 = E.koliGhost(42, lvl), P = E.prismGuards(42, lvl, 2), A = E.prismAssail(42, lvl);
P.forEach((h, i) => assert.strictEqual(h.st.hpMax, Math.round(g0[i].st.hpMax * 1.5)));
A.forEach((h, i) => assert.strictEqual(h.st.hpMax, Math.round(g0[i].st.hpMax * 1.3)));
assert.strictEqual(P[0].n, "Prisme");
const B = E.allyPercoBoost(E.percoGuards(7, 100, 0, 0)); assert.ok(B[0].st.hpMax > E.percoGuards(7, 100, 0, 0)[0].st.hpMax);

// 6A : bonus du prisme, sans doubler celui de la domination de sa guilde
const pr = { mods: { sagesse: 2, prospection: 1 } };
assert.strictEqual(E.allyBonus(pr, "xp", 0), 7);
assert.strictEqual(E.allyBonus(pr, "drop", 5), 1);
assert.strictEqual(E.allyBonus(pr, "kamas", 0), 5);
assert.strictEqual(E.allyBonus(pr, "vitesse", 0), 0);
assert.strictEqual(E.allyFights({ mods: { ralliement: 1 } }, true), 12);
assert.strictEqual(E.allyFights({ mods: { ralliement: 1 } }, false), 10);

// régions : une par zone de la carte, chaque zone et chaque donjon rangé dans sa région (comme la domination)
assert.strictEqual((data.match(/^\('[a-z_]+', '[^\n]*', \d+, \d+\)/gm) || []).length, D.ZONES.length);
for (const z of D.ZONES) for (const s of z.subs) { assert.strictEqual(E.allyRegion(s.id), z.id); assert.ok(data.includes(`('${s.id}', '${z.id}')`), `${s.id} absent de alliances_data.sql`); }
assert.strictEqual(E.allyRegion(Object.keys(E.DUNGEON_SUB)[0]), E.SUBS[E.DUNGEON_SUB[Object.keys(E.DUNGEON_SUB)[0]]].zone);

// 10A : ornement débloqué par le titre
assert.ok(E.ORN.souverain && E.ORN.souverain.ok({ titlesExtra: [E.ALLY.title] }) && !E.ORN.souverain.ok({ titlesExtra: [] }));
assert.ok(fs.existsSync(path.join(__dirname, "../assets/ui/orn/orn_souverain.svg")));
assert.ok(E.allyNameOk("Les Gardiens d'Émeraude") && !E.allyNameOk("ab") && !E.allyNameOk("<script>"));

console.log("alliances : OK");
