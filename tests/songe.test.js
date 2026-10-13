/* Le Songe infini (0.1.48) : carte de la semaine, salles, intensités, validation, Bribes, Marché onirique,
   conversion des anciennes sauvegardes de l'Expédition, sans navigateur.
   Lancer : node tests/songe.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/legendaires.js"); require("../js/songe.js");
const D = require("../js/data.js");

// aléatoire reproductible (mulberry32)
let seed = 4242;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);

const team = (L, cls = ["iop", "eni", "feca", "cra"]) => { const S = E.newState("Songe", cls[0]); S.chars[0].lvl = L; cls.slice(1).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); S.chars.forEach((c) => { E.resetPoints(S, c.id); E.refreshSpells(c, E.charStats(S, c)); }); E.checkAch(S); return S; };

// 1. La carte : 26 salles en 5 paliers, Fontaines aux salles 4/10/16/25, Fin du rêve en 26, la même pour tous la même semaine.
{
  const w = E.weekIdx(); const M = E.sgMap(w);
  assert.strictEqual(Math.max(...M.map((n) => n.d)), 26, "26 salles");
  [4, 10, 16, 25].forEach((d) => assert.ok(M.filter((n) => n.d === d).every((n) => n.t === "fount"), "Fontaine en salle " + d));
  assert.ok(M.filter((n) => n.d === 26).length === 1 && M.find((n) => n.d === 26).t === "end", "Fin du rêve en salle 26");
  assert.deepStrictEqual(E.sgMap(w).map((n) => n.t), M.map((n) => n.t), "carte stable dans la semaine");
  assert.notDeepStrictEqual(E.sgMap(w + 1).map((n) => n.t + n.l), M.map((n) => n.t + n.l), "une autre carte la semaine suivante");
  M.filter((n) => n.d < 26).forEach((n) => assert.ok(n.nx.length >= 1 && n.nx.every((j) => M[j].d === n.d + 1), "chaque salle mène à la suivante"));
  assert.strictEqual(E.SG_INT.length, 8, "Rêve, Paradoxe 1-4, Cauchemar 1-3");
  assert.deepStrictEqual(E.SG_INT.map((x) => x.waves), [1, 3, 3, 3, 3, 5, 5, 5], "vagues pour valider");
  console.log("ok - songe : carte de la semaine", M.length, "salles");
}

// 2. Conditions d'entrée : niveau 10, intensités dans l'ordre ; pas de chasse ni de donjon pendant le songe.
{
  const S = team(5); assert.ok(typeof E.expCanStart(S, 0) === "string", "niveau 10 requis");
  const T = team(60); assert.strictEqual(E.expCanStart(T, 0), null);
  assert.ok(typeof E.expCanStart(T, 1) === "string", "Paradoxe 1 fermé tant que le Rêve n'est pas validé");
  assert.strictEqual(E.act(T, "expStart", 0), null, "départ en Rêve");
  assert.ok(E.expActive(T) && T.exp.sg === 1 && T.exp.nodes.length > 26);
  assert.ok(typeof E.startHunt(T, D.ZONES[0].subs[0].id) === "string", "pas de chasse pendant le songe");
  assert.ok(typeof E.toggleTeam(T, T.chars[1].id) === "string", "équipe figée");
  console.log("ok - songe : entrée et verrous");
}

// 3. Un songe complet en Rêve au niveau 60 : validé, Bribes gagnées, Paradoxe 1 débloqué, monstres au niveau de l'équipe.
{
  const S = team(60); E.act(S, "expStart", 0);
  const r = E.expAutoPlay(S, 400); const L = S.expLast;
  assert.ok(!E.expActive(S) && L, "le songe se termine");
  assert.ok(r.valid && L.valid, "validé en Rêve");
  assert.ok(E.songe(S).br > 0 && L.bribes === E.songe(S).br, "Bribes de rêve à la validation");
  assert.ok(E.songe(S).unl >= 1, "Paradoxe 1 débloqué");
  assert.ok(L.fights >= 20, "une vingtaine de combats");
  console.log("ok - songe : Rêve validé niv. 60,", L.waves, "vagues,", L.bribes, "Bribes,", L.fights, "combats");
}

// 4. Défaite : le songe s'arrête sans Bribes (pas validé), le butin des combats reste ; le Sable de Draconiros propose de rejouer.
{
  const S = team(30); E.songe(S).unl = 7; E.act(S, "expStart", 7); // Cauchemar 3 au niveau 30 : perdu à coup sûr
  const br0 = E.songe(S).br; const r = E.expAutoPlay(S, 400);
  assert.ok(!r.valid && !E.expActive(S) && !S.expLast.valid, "défaite");
  assert.strictEqual(E.songe(S).br, br0, "pas de Bribes sans validation");
  const T = team(30); E.songe(T).unl = 7; E.act(T, "expStart", 7); T.exp.sable = 1;
  let p = null; for (let i = 0; i < 200 && E.expActive(T) && !(p && p.t === "sable"); i++) { now += 1500; E.tick(T, now); p = E.expPending(T); if (p && p.t !== "sable") E.act(T, "expChoose", p.t === "fount" ? "no" : 0); p = E.expPending(T); }
  assert.ok(p && p.t === "sable", "le Sable est proposé après la défaite");
  assert.strictEqual(E.act(T, "expChoose", 0), null); assert.ok(E.expActive(T) && T.exp.sable === 0, "combat rejoué, Sable consommé");
  E.expQuit(T);
  console.log("ok - songe : défaite et Sable de Draconiros");
}

// 5. Difficulté : chaque intensité est plus dure que la précédente, et les salles plus loin aussi.
{
  const st = E.SG_INT.map((_, ii) => E.sgStasis(ii, 1)); for (let i = 1; i < st.length; i++) assert.ok(st[i] > st[i - 1], "intensité croissante");
  assert.ok(E.sgStasis(3, 20) > E.sgStasis(3, 1), "salle 20 plus dure que salle 1");
  console.log("ok - songe : stasis", st.map((x) => x.toFixed(1)).join(" "));
}

// 6. Marché onirique : achats avec les Bribes, objets uniques une seule fois.
{
  const S = team(60); E.sgGive(S, 20000);
  assert.strictEqual(E.act(S, "sgBuy", "titre"), null); assert.ok(typeof E.act(S, "sgBuy", "titre") === "string", "titre une seule fois");
  const c0 = (S.cons.coffre_or || 0); assert.strictEqual(E.act(S, "sgBuy", "coffre_or"), null); assert.ok((S.cons.coffre_or || 0) === c0 + 1, "coffre reçu");
  assert.strictEqual(E.act(S, "sgBuy", "draco"), null); assert.ok(S.pets && Object.values(S.pets).some((p) => p.id === "draconiros_mini") || JSON.stringify(S).includes("draconiros_mini"), "Draconiros miniature");
  const T = team(60); assert.ok(typeof E.act(T, "sgBuy", "coffre_or") === "string", "pas assez de Bribes");
  console.log("ok - songe : Marché onirique, il reste", E.songe(S).br, "Bribes");
}

// 7. Conversion d'une sauvegarde de l'Expédition : Éclats ×5 + 150 par amélioration du campement, record gardé, expédition en cours arrêtée.
{
  const S = team(60); S.camp = { ec: 300, ups: { a: 1, b: 1, c: 1 } }; S.cnt.expBestAll = 42; S.exp = { on: true, floor: 12, lives: 2, relics: [] };
  const N = E.deserialize(E.serialize(S));
  assert.strictEqual(E.songe(N).br, 300 * 5 + 3 * 150, "Bribes converties");
  assert.ok(!E.expActive(N), "expédition en cours arrêtée");
  assert.strictEqual(N.cnt.expBestAll, 42, "record gardé");
  const again = E.deserialize(E.serialize(N)); assert.strictEqual(E.songe(again).br, E.songe(N).br, "conversion une seule fois");
  console.log("ok - songe : conversion de l'Expédition,", E.songe(N).br, "Bribes");
}

// 8. Sauvegarde pendant un songe : la partie se recharge et continue.
{
  const S = team(60); E.act(S, "expStart", 0); for (let i = 0; i < 30; i++) { now += 1500; E.tick(S, now); const p = E.expPending(S); if (p) E.act(S, "expChoose", p.t === "fount" ? "no" : 0); }
  const N = E.deserialize(E.serialize(S)); assert.ok(E.expActive(N) && N.exp.nodes.length === S.exp.nodes.length, "songe rechargé");
  const r = E.expAutoPlay(N, 400); assert.ok(!E.expActive(N) && r, "il se termine après rechargement");
  console.log("ok - songe : rechargement en cours de route");
}

// 9. 1.0.7.2 : un vœu acheté à la Fontaine reste marqué « pris » (même après sauvegarde) et ne se rachète pas
{
  const S = team(60); E.act(S, "expStart", 0); const X = S.exp;
  const n3 = X.nodes.find((n) => n.d === 3); X.at = n3.i; X.path = [n3.i]; X.pts = 40;
  assert.strictEqual(E.act(S, "expDoor", E.sgNext(X).find((i) => X.nodes[i].t === "fount")), null, "entrée dans la Fontaine");
  const i = E.expPending(S).opts.findIndex((o) => o.k === "sable"); const pr = E.expPending(S).opts[i].price;
  assert.strictEqual(E.act(S, "expBuy", i), null, "vœu acheté");
  assert.ok(E.expPending(S).opts[i].sold && S.exp.pts === 40 - pr && S.exp.sable === 1, "vœu marqué pris, points payés");
  const N = E.deserialize(E.serialize(S)); const p = E.expPending(N);
  assert.ok(p && p.t === "fount" && p.opts[i].sold && N.exp.pts === 40 - pr, "vœu toujours pris après rechargement");
  assert.strictEqual(E.act(N, "expBuy", i), "Déjà pris.", "pas deux fois le même vœu");
  console.log("ok - songe : vœu de Fontaine enregistré");
}

// 10. 1.0.10.4 : le dernier résultat d'une ancienne Expédition (sans intensité) est oublié au chargement, un vrai songe est gardé
{
  const S = team(60); S.expLast = { t: now, how: "fall", floor: 12, best: 12, prev: 10, record: true, rew: { kamas: 10, xp: 0, dust: 0, res: 0, items: 0 }, eclats: 3, lives: 0, fights: 4, relics: [], bless: [], lost: null, loss: null, lvl: 60, dur: 1000 };
  const N = E.deserialize(E.serialize(S)); assert.strictEqual(N.expLast, null, "ancien résultat d'Expédition oublié");
  E.act(N, "expStart", 0); E.expQuit(N); const L = N.expLast; assert.ok(L && L.ii === 0, "résultat du songe enregistré");
  assert.strictEqual(E.deserialize(E.serialize(N)).expLast.ii, 0, "résultat du songe gardé au rechargement");
  console.log("ok - songe : ancien résultat d'Expédition oublié");
}

console.log("songe.test.js : tout est bon");
