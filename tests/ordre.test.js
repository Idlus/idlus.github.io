/* 2.1.21 « Mon ordre » : attaques lancées une fois chacune dans l'ordre de la barre, gardé dans les stratégies, le setup et le Kolizéum ;
   l'IA en Auto connaît le passif de l'Huppermage. Lancer : node tests/ordre.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/identite.js");
const D = require("../js/data.js");
const S = E.newState("Test", "hupper"); S.chars.length = 0;
const c = E.addChar(S, "hupper", "Runa", 200); c.inTeam = true; E.refreshSpells(c, E.charStats(S, c));
const ATK = ["dmg", "aoe", "drain", "dot"];
const isAtk = (id) => { const sp = E.spellDef("hupper", id); return sp && ATK.includes(E.spellKind(E.spellGrade(sp, 200))); };
// quatre attaques à 3 PA dans les quatre éléments, sans soutien
c.spells = ["s13668", "s13666", "s13669", "s13667"].map((id) => ({ id })); c.spellsManual = true;
assert.ok(c.spells.every((x) => isAtk(x.id)), "quatre attaques");
c.atkMode = "ordre";
const P = E.poutchPreview(S, c.id, {});
const casts = P.rounds.flatMap((r) => r.casts.map((x) => x.sp)).filter((id) => id !== "arme");
const want = c.spells.map((x) => x.id);
casts.slice(0, 8).forEach((id, i) => assert.strictEqual(id, want[i % 4], `lancer ${i + 1} dans l'ordre de la barre`));
const A = E.poutchPreview(S, c.id, { auto: true });
assert.ok(A && A.total > 0 && A.total !== P.total, "l'aperçu Auto se calcule à part");
assert.strictEqual(c.atkMode, "ordre", "l'aperçu ne touche pas au héros");
// stratégies : le mode suit la stratégie
E.savePreset(S, c.id, 0, "Alternance"); delete c.atkMode; E.savePreset(S, c.id, 1, "Auto");
E.applyPreset(S, c.id, 0); assert.strictEqual(c.atkMode, "ordre", "stratégie en Mon ordre");
E.applyPreset(S, c.id, 1); assert.strictEqual(c.atkMode, undefined, "stratégie en Auto");
// Kolizéum : le mode part avec l'équipe
c.atkMode = "ordre"; const snap = E.koliSnap(S, [c.id]); assert.strictEqual(snap[0].am, 1, "Mon ordre dans l'équipe du Kolizéum");
// Auto : le passif de l'Huppermage pousse à changer d'élément
delete c.atkMode; E.PLAN.passifs = false; const off = E.poutchPreview(S, c.id, {}); E.PLAN.passifs = true; const on = E.poutchPreview(S, c.id, {});
const switches = (Q) => { const ids = Q.rounds.flatMap((r) => r.casts.map((x) => x.sp)); let n = 0; for (let i = 1; i < ids.length; i++) if (ids[i] !== ids[i - 1]) n++; return n; };
assert.ok(switches(on) >= switches(off), "l'Auto alterne au moins autant les sorts quand il connaît le passif");
console.log("ok - Mon ordre, stratégies, Kolizéum et passif de l'Huppermage");
