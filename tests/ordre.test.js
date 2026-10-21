/* 2.1.21 « Mon ordre » devenu 2.1.32 « Ma rotation » : la liste exacte des lancers du tour, sorts impossibles passés, arme comprise ;
   conversion de « Mon ordre », stratégies, Kolizéum ; l'Auto connaît le passif de l'Huppermage et les bonus qui se cumulent. Lancer : node tests/ordre.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/identite.js");
const D = require("../js/data.js");
const ids = (P, r) => P.rounds[r].casts.map((x) => x.sp);
// Iop : Puissance (3 PA, recharge) → Concentration ×2, puis la case d'arme (sans arme : passée)
{
  const S = E.newState("Test", "iop"); S.chars.length = 0;
  const c = E.addChar(S, "iop", "Brak", 200); c.inTeam = true;
  c.spells = ["s13118", "s13148", "s13120", "s13123", "s13125", "s13106"].map((id) => ({ id, cond: null, tgt: "low" })); c.spellsManual = true;
  c.atkMode = "rot"; c.rot = [{ id: "s13118" }, { id: "s13123" }, { id: "s13123" }, { id: "arme" }];
  const P = E.poutchPreview(S, c.id, {});
  assert.deepStrictEqual(ids(P, 0), ["s13118", "s13123", "s13123"], "tour 1 : exactement la liste");
  assert.ok((P.rounds[0].skips || []).some((k) => k.sp === "arme" && k.why === "arme"), "case d'arme passée sans arme");
  assert.deepStrictEqual(ids(P, 1), ["s13123", "s13123"], "tour 2 : Puissance en recharge est passée");
  assert.ok(P.rounds[1].skips.some((k) => k.sp === "s13118" && k.why === "cd"), "la raison est donnée");
  assert.ok(P.rounds.every((r) => r.casts.length <= 3), "au bout de la liste, le tour s'arrête");
  assert.ok(P.rounds.every((r) => !r.casts.some((x) => x.sp === "s13106")), "un sort absent de la liste ne part jamais");
  // condition propre à la case : Concentration seulement contre un boss → passée contre le Poutch
  c.rot = [{ id: "s13123", cond: "boss" }, { id: "s13106" }];
  const Q = E.poutchPreview(S, c.id, {});
  assert.deepStrictEqual(ids(Q, 0), ["s13106"], "condition de la case respectée");
  assert.ok(Q.rounds[0].skips.some((k) => k.why === "cond"), "condition non remplie dite");
  // rotation vide : le héros joue en Auto
  c.rot = []; assert.ok(E.poutchPreview(S, c.id, {}).rounds[0].casts.length > 0, "rotation vide = Auto");
  // stratégies et Kolizéum
  c.rot = [{ id: "s13106" }, { id: "s13123", cond: "boss" }];
  E.savePreset(S, c.id, 0, "Rot"); delete c.atkMode; E.savePreset(S, c.id, 1, "Auto");
  E.applyPreset(S, c.id, 0); assert.strictEqual(c.atkMode, "rot"); assert.deepStrictEqual(c.rot, [{ id: "s13106" }, { id: "s13123", cond: "boss" }], "rotation gardée dans la stratégie");
  E.applyPreset(S, c.id, 1); assert.strictEqual(c.atkMode, undefined, "stratégie en Auto");
  E.applyPreset(S, c.id, 0); const snap = E.koliSnap(S, [c.id]); assert.strictEqual(snap[0].am, 2); assert.strictEqual(snap[0].rot.length, 2, "rotation dans l'équipe du Kolizéum");
  const S2 = E.koliSetup(snap, snap); const h2 = S2.chars[0]; assert.strictEqual(h2.atkMode, "rot"); assert.strictEqual(h2.rot[1].cond, "boss", "le serveur rejoue la rotation");
  const old = snap.map((h) => Object.assign({}, h, { am: 1, rot: undefined })); const S3 = E.koliSetup(old, old);
  assert.strictEqual(S3.chars[0].atkMode, "rot"); assert.ok(S3.chars[0].rot.length >= 2, "ancienne équipe en « Mon ordre » : rotation équivalente");
}
// conversion des sauvegardes en « Mon ordre »
{
  const S = E.newState("Test", "cra"); const c = S.chars[0]; c.lvl = 120; E.refreshSpells(c, E.charStats(S, c));
  c.atkMode = "ordre"; c.presets = [{ name: "Ordre", spells: c.spells.map((x) => ({ ...x })), am: "ordre" }];
  const S2 = E.deserialize(E.serialize ? E.serialize(S) : JSON.stringify(S)); const c2 = S2.chars[0];
  assert.strictEqual(c2.atkMode, "rot", "« Mon ordre » devient « Ma rotation »"); assert.ok(c2.rot.length >= 2, "rotation remplie");
  assert.strictEqual(c2.presets[0].am, "rot"); assert.ok(c2.presets[0].rot.length >= 2, "stratégie convertie aussi");
  assert.ok((S2.migration || []).some((t) => /Ma rotation/.test(t)), "le joueur est prévenu");
  const S3 = E.deserialize(JSON.stringify(S2)); assert.deepStrictEqual(S3.chars[0].rot, c2.rot, "conversion faite une seule fois");
}
// Auto : les bonus qui se cumulent (Furia du Zobal) et le passif de l'Huppermage
{
  const run = (cls, cumul) => { const S = E.newState("T", cls); S.chars.length = 0; const c = E.addChar(S, cls, "H", 200); c.inTeam = true; E.refreshSpells(c, E.charStats(S, c)); E.PLAN.cumul = cumul; const P = E.poutchPreview(S, c.id, {}); E.PLAN.cumul = true; return P; };
  const z0 = run("zobal", false), z1 = run("zobal", true);
  assert.ok(z1.total > z0.total * 1.2, "le Zobal cumule Furia en Auto");
  const S = E.newState("Test", "hupper"); S.chars.length = 0;
  const c = E.addChar(S, "hupper", "Runa", 200); c.inTeam = true; E.refreshSpells(c, E.charStats(S, c));
  c.spells = ["s13668", "s13666", "s13669", "s13667"].map((id) => ({ id })); c.spellsManual = true;
  E.PLAN.passifs = false; const off = E.poutchPreview(S, c.id, {}); E.PLAN.passifs = true; const on = E.poutchPreview(S, c.id, {});
  const switches = (Q) => { const l = Q.rounds.flatMap((r) => r.casts.map((x) => x.sp)); let n = 0; for (let i = 1; i < l.length; i++) if (l[i] !== l[i - 1]) n++; return n; };
  assert.ok(switches(on) >= switches(off), "l'Auto alterne au moins autant les sorts quand il connaît le passif");
}
// aperçu : un tour du héros par ligne
{
  const S = E.newState("Test", "iop"); S.chars.length = 0; const c = E.addChar(S, "iop", "B", 200); c.inTeam = true; E.refreshSpells(c, E.charStats(S, c));
  const P = E.poutchPreview(S, c.id, {}); assert.ok(P.rounds.every((r) => r.pa <= P.paMax + 2), "« Tour 1 » ne contient plus deux tours");
}
console.log("ok - Ma rotation, conversion de Mon ordre, stratégies, Kolizéum, Auto (cumuls, Huppermage) et aperçu");
