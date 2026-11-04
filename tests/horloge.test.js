/* 04/11/2026 « Heure du serveur » (Mathis : « comment faire pour empêcher cette triche ? ») :
   - le moteur a une heure de base réglable (E.setBaseClock) : E.setClock(null) y revient, pas à l'heure brute de l'appareil ;
   - V.horlogeFaussee reconnaît les raisons du Bouclier qui prouvent du temps de jeu inventé (seule exception au « signaler seulement ») ;
   - le jeu relève l'heure du serveur avant de compter l'absence (js/ui.js, js/online.js). Lancer : node tests/horloge.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
global.window = global;
for (const f of ["gamedata", "looks", "data", "engine", "systems"]) require("../js/" + f + ".js");
const E = window.ENGINE;
const V = require("../js/verify.js");

// 1. heure de base
const off = -55 * 86400000; // appareil avancé de 55 jours
E.setBaseClock(() => Date.now() + off);
assert.ok(Math.abs(E.now() - (Date.now() + off)) < 50, "le moteur suit l'heure de base");
E.setClock(() => 123); assert.strictEqual(E.now(), 123, "une heure de test passe devant");
E.setClock(null); assert.ok(Math.abs(E.now() - (Date.now() + off)) < 50, "E.setClock(null) revient à l'heure de base");
const c0 = E.getClock(); E.setClock(() => 5); E.setClock(c0); assert.ok(Math.abs(E.now() - (Date.now() + off)) < 50, "rendre l'heure gardée garde la base");
// le Sablier ne se remplit pas quand l'heure du jeu recule (appareil remis à l'heure du serveur)
const S = E.newState("Test", "iop"); E.setBaseClock(null); const B = E.sab(S); B.r = 0; B.at = Date.now() + 30 * 86400000;
E.sab(S); assert.ok(B.r < 1, "pas de recharge pour un Sablier daté du futur");
E.setBaseClock(null); assert.ok(Math.abs(E.now() - Date.now()) < 50, "base remise à l'heure de l'appareil");

// 2. raisons du Bouclier
const pt = (h) => ({ k: 0, r: 0, lv: 0, mt: 0, dof: 0, pt: h, sx: 0 });
const c = V.check(E, pt(1), pt(52), 3.4, {}, V.RES_MAX, 50);
assert.ok(!c.ok && V.horlogeFaussee(c.why), "51 h de jeu en 3,4 h réelles : temps inventé (" + c.why + ")");
V.now = () => V.SAB_T0 + 86400000;
const imp = V.impossible(E, { chars: [], items: {}, kamas: 0, sabMt: { xp: 36750 } });
assert.ok(V.horlogeFaussee(imp), "XP de Maîtrise du temps impossible : temps inventé");
delete V.now;
assert.ok(!V.horlogeFaussee("Iop : 99 999 en Vitalité"), "objet retouché : pas l'exception horloge");
assert.ok(!V.horlogeFaussee("+1 000 000 000 kamas en 0,1 h réelles"), "kamas : pas l'exception horloge");
assert.ok(!V.horlogeFaussee(null), "pas de raison");

// 3. côté jeu et serveur
const ui = fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), on = fs.readFileSync(path.join(__dirname, "../js/online.js"), "utf8");
assert.ok(/ON\.horloge = async/.test(on) && /auth\/v1\/health/.test(on), "relevé de l'heure du serveur");
assert.ok(/await horlogeSync\(3000\);[\s\S]{0,80}\n  await ON\.ready\(\);/.test(ui), "heure du serveur relevée avant le chargement de la partie");
assert.ok(/horlogeSync\(2500\)\.then/.test(ui), "heure du serveur relevée au retour sur l'onglet, avant l'absence");
const rec = fs.readFileSync(path.join(__dirname, "../supabase/functions/record/index.ts"), "utf8");
assert.ok(rec.indexOf("V.horlogeFaussee(why)") > 0 && rec.indexOf("V.horlogeFaussee(why)") < rec.indexOf('from("saves_ok").upsert'), "Classique : temps inventé non affiché");
assert.ok(/!\(V\.horlogeFaussee && V\.horlogeFaussee\(r\.why\)\)/.test(fs.readFileSync(path.join(__dirname, "../supabase/functions/mono/index.ts"), "utf8")), "Monocompte : temps inventé non affiché");
console.log("horloge.test : heure du serveur et exception horloge du Bouclier OK");
