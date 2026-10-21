/* 2.1.34.2 (tickets #138 et #143) : le classement des succès vient du résumé calculé par le serveur (fonction « record »).
   Le serveur ne charge pas suivi.js, vie.js, ui.js ni guide.js : leurs succès sont comptés par VERIFY.ACH_EXTRA, avec les
   mêmes points que dans le jeu. Lancer : node tests/succes_serveur.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/defi.js"); require("../js/suivi.js"); require("../js/vie.js"); require("../js/quetes.js");
const V = require("../js/verify.js");
const SRV = fs.readFileSync(path.join(ROOT, "tools", "build_server.js"), "utf8");
["suivi", "vie", "ui", "guide"].forEach((f) => assert.ok(!SRV.includes(`"${f}"`), f + ".js chargé par le serveur : retirer ses succès de VERIFY.ACH_EXTRA"));
assert.ok(SRV.includes('"quetes"'), "quetes.js dans le code du serveur (points de succès)");
// succès de suivi.js et vie.js : mêmes points
["tresor1", "tresor10", "tresor50", "cmd1", "cmd25", "cmd100", "dop1", "dop50"].forEach((id) => {
  const a = E.ACH.find((x) => x.id === id); assert.ok(a, id + " existe"); assert.strictEqual(V.ACH_EXTRA[id], E.achPts(a), "points de " + id); });
// succès de ui.js (Mélomane) et guide.js (Érudit) : lus dans leur source
const UI = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), GD = fs.readFileSync(path.join(ROOT, "js", "guide.js"), "utf8");
assert.ok(/\[\[10, 5000\], \[25, 15000\], \[MELO, 40000\]\]/.test(UI), "succès Mélomane inchangés");
[["melo10", 5000], ["melo25", 15000], ["melo", 40000]].forEach(([id, k]) => assert.strictEqual(V.ACH_EXTRA[id], E.achPts({ kamas: k }), "points de " + id));
const g = GD.match(/id: "guide_erudit"[^}]*kamas: (\d+)/); assert.ok(g, "succès Érudit trouvé");
assert.strictEqual(V.ACH_EXTRA.guide_erudit, E.achPts({ kamas: +g[1] }));
assert.strictEqual(Object.keys(V.ACH_EXTRA).length, 12, "tout succès d'ACH_EXTRA est vérifié ici");
console.log("ok - succès hors serveur : 12, mêmes points que dans le jeu");
// une partie avec tous ces succès : même total que la page Succès (pas de double compte quand le jeu les connaît)
const S = E.newState("Succès", "iop"); E.ACH.slice(0, 30).forEach((a) => (S.ach[a.id] = 1)); ["tresor1", "cmd1", "dop1", "melo10", "guide_erudit"].forEach((k) => (S.ach[k] = 1));
const m = V.summary(E, S);
assert.strictEqual(m.succes, E.achCount(S) + 2, "melo10 et guide_erudit comptés en plus, le reste une seule fois");
assert.strictEqual(m.pts, E.achPoints(S) + 20 + 20);
console.log("ok - résumé : " + m.succes + " succès, " + m.pts + " points");
