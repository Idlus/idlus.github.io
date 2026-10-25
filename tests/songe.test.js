/* Le Songe infini (0.1.48) : carte de la semaine, salles, intensités, validation, Bribes, Marché onirique,
   conversion des anciennes sauvegardes de l'Expédition, sans navigateur.
   Lancer : node tests/songe.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
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
  // sans équipement, une équipe niveau 60 valide le Rêve environ 85 % du temps (mesuré sur 80 graines) : jusqu'à 3 essais,
  // pour que le test ne dépende pas du nombre de tirages de butin des combats (1.0.18 : plus d'objets sur les monstres)
  let S, r, L;
  for (let i = 0; i < 3; i++) { S = team(60); E.act(S, "expStart", 0); r = E.expAutoPlay(S, 400); L = S.expLast;
    assert.ok(!E.expActive(S) && L, "le songe se termine"); if (r.valid) break; }
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

// 11. 1.0.30 : des Bribes à chaque vague tenue, gardées même sans valider ; un songe validé rapporte autant qu'avant
{
  const S = team(60); E.songe(S).unl = 1; E.act(S, "expStart", 1); const X = S.exp; const end = X.nodes.find((n) => n.t === "end");
  const per = E.sgWaveBribes(1); assert.ok(per > 0, "Bribes par vague");
  const br0 = E.songe(S).br; X.pick = end.i; X.wave = 1; E.expWin(S, { ents: [], rewards: null });
  assert.strictEqual(E.songe(S).br, br0 + per, "Bribes de la vague 1");
  assert.ok(!X.valid && E.expPending(S).t === "wave", "pas encore validé en Paradoxe 1");
  E.act(S, "expChoose", 0); assert.strictEqual(X.wave, 2, "vague 2");
  E.expLose(S, { ents: [], rewards: null, label: "test", round: 3 });
  assert.ok(!E.expActive(S) && !S.expLast.valid && S.expLast.bribes === per && E.songe(S).br === br0 + per, "défaite : les Bribes de la vague tenue restent");
  const T = team(60); E.songe(T).unl = 1; E.act(T, "expStart", 1); const Y = T.exp; Y.pick = Y.nodes.find((n) => n.t === "end").i;
  for (let w = 1; w <= 3; w++) { Y.wave = w; E.expWin(T, { ents: [], rewards: null }); if (w < 3) E.act(T, "expChoose", 0); }
  assert.ok(Y.valid && Y.bribes === E.sgBribesFor(1, 3), "validé : le même total qu'avant (" + Y.bribes + ")");
  E.expQuit(T);
  console.log("ok - songe : Bribes à chaque vague,", per, "par vague en Paradoxe 1");
}

// 12. 1.0.30 : Marché onirique tournant : 3 offres de la semaine, les mêmes pour tous, en quantité limitée
{
  const w = E.weekIdx(); const A = E.sgWeekShop(w);
  assert.strictEqual(A.length, 3, "3 offres"); assert.strictEqual(new Set(A.map((o) => o.id)).size, 3, "3 offres différentes");
  assert.deepStrictEqual(E.sgWeekShop(w), A, "les mêmes toute la semaine");
  let other = false; for (let k = 1; k < 6; k++) if (E.sgWeekShop(w + k).map((o) => o.id).join() !== A.map((o) => o.id).join()) other = true;
  assert.ok(other, "d'autres offres les semaines suivantes");
  A.forEach((o) => assert.ok(o.name && o.price > 0 && o.lim >= 1 && (o.cons ? D.CONSUMABLES[o.cons] : o.dust || o.stat), "offre complète : " + o.id));
  const S = team(60); const o = A[0]; assert.ok(typeof E.act(S, "sgBuyWeek", o.id) === "string", "pas assez de Bribes");
  E.sgGive(S, o.price * (o.lim + 1)); const br = E.songe(S).br;
  for (let i = 0; i < o.lim; i++) assert.strictEqual(E.act(S, "sgBuyWeek", o.id), null, "achat " + (i + 1));
  assert.ok(typeof E.act(S, "sgBuyWeek", o.id) === "string" && E.sgWeekLeft(S, o.id) === 0, "limite de la semaine");
  assert.strictEqual(E.songe(S).br, br - o.price * o.lim, "Bribes payées");
  if (o.cons) assert.ok((S.cons[o.cons] || 0) >= o.lim, "objet reçu");
  now += 7 * 86400000; const B = E.sgWeekShop(); assert.ok(B.length === 3 && E.sgWeekLeft(S, B[0].id) === B[0].lim, "la semaine suivante, de nouvelles quantités");
  console.log("ok - songe : Marché onirique de la semaine,", A.map((x) => x.name).join(", "));
}

// 13. 1.0.30 : rejeu du serveur pour le classement : même équipe, même graine, même résultat ; le hasard revient ensuite
{
  const S = team(60); const txt = E.serialize(S);
  const a = E.sgReplay(txt, 0, 777, now), b = E.sgReplay(txt, 0, 777, now);
  assert.deepStrictEqual(a, b, "rejeu reproductible");
  assert.ok(a.ok ? a.waves >= 1 : typeof a.err === "string", "rejeu : " + JSON.stringify(a));
  assert.strictEqual(E.sgReplay(txt, 3, 777, now).ok, false, "intensité jamais débloquée refusée");
  assert.strictEqual(E.sgReplay("pas une partie", 0, 1, now).ok, false, "partie illisible");
  assert.strictEqual(E.sgOfficial(20, 10), 13, "un quart de vagues de plus que le rejeu, au plus");
  assert.strictEqual(E.sgOfficial(8, 10), 8, "jamais plus que ce que le joueur annonce");
  assert.strictEqual(E.sgOfficial(5, 1), 3, "au moins 2 vagues de marge");
  E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
  E.setClock(() => now);
  console.log("ok - songe : rejeu du serveur", JSON.stringify(a));
}

// « Songe sans fin » (Ley, 1A 2A de Mathis, 25/10) : plus de plafond à 50, paliers 75/100/150 en Cauchemar, une fois par semaine
{
  const S = team(200); E.songe(S).unl = 7; assert.strictEqual(E.expStart(S, 5), null, "Cauchemar 1 lancé");
  const X = S.exp; const end = X.nodes.findIndex((n) => n.t === "end"); X.at = end; X.pick = end; X.valid = true; X.chest = {};
  const fakeF = () => ({ ents: [], rewards: { xp: {}, kamas: 0, res: {}, items: [] } });
  const chests = () => (S.cons && S.cons[E.SG_MILE_CHEST]) || 0; const c0 = chests();
  for (let w = 50; w <= 100; w++) { X.wave = w; X.pend = []; E.expWin(S, fakeF()); assert.ok(E.expActive(S), "le songe continue après la vague " + w); }
  assert.strictEqual(X.waves, 100, "100 vagues tenues"); assert.strictEqual(chests() - c0, 2, "paliers 75 et 100 : deux coffres");
  assert.deepStrictEqual(E.sgMilesGot(S), [75, 100], "paliers notés pour la semaine");
  E.expQuit(S); assert.strictEqual(E.expStart(S, 7), null, "un autre songe la même semaine");
  const Y = S.exp; const e2 = Y.nodes.findIndex((n) => n.t === "end"); Y.at = e2; Y.pick = e2; Y.valid = true;
  Y.wave = 75; E.expWin(S, fakeF()); assert.strictEqual(chests() - c0, 2, "palier 75 déjà reçu cette semaine");
  E.expQuit(S); E.expStart(S, 1); const Z = S.exp; const e3 = Z.nodes.findIndex((n) => n.t === "end"); Z.at = e3; Z.pick = e3; Z.valid = true; Z.wave = 150; E.expWin(S, fakeF());
  assert.strictEqual(chests() - c0, 2, "pas de palier sous Cauchemar"); E.expQuit(S);
  console.log("ok - songe : sans fin, paliers de la semaine");
}

console.log("songe.test.js : tout est bon");
