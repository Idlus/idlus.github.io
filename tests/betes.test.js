/* 2.1.30 « Marché des bêtes » : montures et familiers à l'hôtel de vente et en échange (1A 2A 3A 4A 5B 6A de Mathis).
   Une bête vendue quitte la partie (mountGone / petGone), une bête achetée garde tout (4A) mais est marquée b :
   elle ne compte ni au classement d'élevage ni à l'album (5B). Le Bouclier borne les bêtes apparues hors du serveur.
   Lancer : node tests/betes.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/maitrise_moteur.js"); require("../js/dofusp.js"); require("../js/collections.js"); require("../js/chroma.js"); require("../js/alignement.js");
require("../js/data.js");
const V = require("../js/verify.js");

let seed = 2130;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const fresh = () => { const S = E.newState("Bêtes", "iop"); S.chars[0].lvl = 200; S.chars[0].inTeam = true; S.kamas = 1e9; S.enclos.built = true; E.elevState(S); return S; };

// 1. Monture vendue : elle quitte l'écurie, le cavalier, les couples et les balades
{
  const S = fresh();
  const M = E.giveMount(S, "dd", "Rousse", "test", { quiet: true, st: 3 }); M.lvl = 100;
  E.equipMount(S, S.chars[0].id, M.uid); assert.strictEqual(S.chars[0].mount, M.uid);
  S.enclos.pairs = [{ a: M.uid, b: 999 }]; S.elev.bal = [{ uid: M.uid }];
  E.mountGone(S, M.uid);
  assert.ok(!S.mounts[M.uid] && !S.chars[0].mount, "plus d'écurie ni de cavalier");
  assert.strictEqual(S.enclos.pairs.length, 0); assert.strictEqual(S.elev.bal.length, 0);
  E.mountGone(S, 12345); // absente : rien
  console.log("ok - monture vendue : quitte l'écurie, le cavalier, l'enclos et les balades");
}

// 2. Monture achetée : garde tout (4A), nouvel uid, marquée b, hors classement d'élevage (5B) ; données bornées
{
  const S = fresh();
  const s0 = E.elevSummary(S).s;
  const M = E.mountIn(S, { sp: "dd", c: "Amande|Dorée", lvl: 74, st: 4, kids: 2, cap: "sage", nm: "Pierrot", res: 1, b: 1, uid: 7 });
  assert.ok(M && M.uid !== 7 && S.mounts[M.uid] === M);
  assert.deepStrictEqual([M.lvl, M.st, M.kids, M.cap, M.b], [74, 4, 2, "sage", 1], "niveau, étoiles, petits, capacité gardés");
  assert.ok(!M.nm && !M.res, "le surnom ne suit pas");
  assert.strictEqual(E.elevSummary(S).s, s0, "achetée : ne compte pas au classement d'élevage");
  const back = E.mountIn(S, { sp: "dd", c: "Rousse", lvl: 50 }); assert.ok(!back.b, "une annonce retirée revient à soi");
  assert.strictEqual(E.elevSummary(S).s, s0 + 1);
  const big = E.mountIn(S, { sp: "dd", c: "Rousse", lvl: 999, st: 99, cap: "triche" });
  assert.strictEqual(big.lvl, E.MOUNT_MAX); assert.strictEqual(big.st, E.ST_BASE + 2); assert.ok(!big.cap);
  assert.strictEqual(E.mountIn(S, { sp: "dd", c: "Arc-en-ciel" }), null, "couleur inconnue refusée");
  assert.strictEqual(E.mountIn(S, { sp: "zz", c: "Rousse" }), null, "espèce inconnue refusée");
  console.log("ok - monture achetée : tout est gardé, marquée achetée, hors classement d'élevage");
}

// 3. Familiers : vendu (quitte le héros et la pension), acheté (marqué b, hors album, un vrai trouvé reste nouveau)
{
  const S = fresh();
  const id = Object.keys(E.PETS).find((k) => E.PETS[k].kind === "zone");
  const P = E.givePet(S, id, "test"); E.equipPet(S, S.chars[0].id, P.uid); S.petPension = P.uid;
  const a0 = E.petAlbum(S);
  E.petGone(S, P.uid);
  assert.ok(!S.pets[P.uid] && !S.chars[0].pet && !S.petPension);
  assert.strictEqual(E.petAlbum(S), a0 - 1);
  const B = E.petIn(S, { id, g: 63, st: 2, b: 1 });
  assert.deepStrictEqual([B.g, B.st, B.b], [63, 2, 1]);
  assert.strictEqual(E.petAlbum(S), a0 - 1, "acheté : ne compte pas à l'album");
  const G = E.givePet(S, id, "trouvé en chasse");
  assert.ok(G && G.uid !== B.uid && !G.b, "le trouver soi-même n'est pas un double : il compte à l'album");
  assert.strictEqual(E.petAlbum(S), a0);
  assert.strictEqual(E.petIn(S, { id: "chacha_dore", g: 100 }), null, "le Chacha Doré ne s'échange pas");
  assert.strictEqual(E.petIn(S, { id: "inconnu" }), null);
  const over = E.petIn(S, { id, g: 500, st: 40 }); assert.strictEqual(over.g, 100); assert.strictEqual(over.st, E.PET_STAR_COST.length);
  console.log("ok - familier vendu ou acheté : hors album si acheté, le trouver ensuite compte");
}

// 4. Bouclier : bêtes inconnues refusées ; bêtes apparues hors du serveur bornées, sauf si le serveur les a livrées
{
  const S = fresh();
  assert.strictEqual(V.impossible(E, S, 0), null);
  S.mounts[900] = { uid: 900, sp: "dd", c: "Licorne", lvl: 1, st: 1 };
  assert.ok(/monture inconnue/.test(V.impossible(E, S, 0))); delete S.mounts[900];
  S.pets[900] = { uid: 900, id: "faux", g: 1, st: 0 };
  assert.ok(/familier inconnu/.test(V.impossible(E, S, 0))); delete S.pets[900];
  const b0 = V.bilan(E, S);
  assert.ok(b0.mn != null && b0.ms != null && b0.pn != null, "le bilan compte les bêtes");
  const at = (o) => Object.assign({}, b0, o);
  assert.ok(V.check(E, b0, at({ mn: b0.mn + 10, ms: b0.ms + 20 }), 1, {}, null, 200).ok, "10 naissances en 1 h : normal");
  assert.ok(!V.check(E, b0, at({ mn: b0.mn + 200, ms: b0.ms + 200 }), 1, {}, null, 200).ok, "200 montures en 1 h : refusé");
  assert.ok(V.check(E, b0, at({ mn: b0.mn + 200, ms: b0.ms + 1400 }), 1, { mt: 200, ms: 1400 }, null, 200).ok, "sauf si le serveur les a livrées (achat, échange)");
  assert.ok(!V.check(E, b0, at({ mn: b0.mn + 5, ms: b0.ms + 500 }), 1, {}, null, 200).ok, "500 étoiles d'un coup : refusé");
  assert.ok(!V.check(E, b0, at({ pn: b0.pn + 100 }), 0.5, {}, null, 200).ok, "100 familiers en 30 min : refusé");
  assert.ok(V.check(E, b0, at({ pn: b0.pn + 100 }), 0.5, { pt: 100 }, null, 200).ok);
  assert.ok(V.check(E, b0, at({ mn: b0.mn - 20, ms: b0.ms - 60, pn: b0.pn - 5 }), 0.1, {}, null, 200).ok, "vendre ses bêtes : toujours permis");
  const old = Object.assign({}, b0); delete old.mn; delete old.ms; delete old.pn;
  assert.ok(V.check(E, old, at({ mn: 500, ms: 3000, pn: 140 }), 1, {}, null, 200).ok, "ancien bilan sans bêtes : pas de faux refus");
  console.log("ok - Bouclier : bêtes inconnues refusées, bêtes hors serveur bornées, livraisons du serveur permises");
}
