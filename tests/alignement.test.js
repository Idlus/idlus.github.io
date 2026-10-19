/* Alignement 1.0.30 (choix 34A) : quêtes des cités, un seul camp (7 jours d'attente), guerre de la semaine, sans navigateur.
   Lancer : node tests/alignement.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "quetes", "verify", "koli", "alignement", "honneur"].forEach((f) => require("../js/" + f + ".js"));
const D = require("../js/data.js");
const V = globalThis.VERIFY;

let seed = 31;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true; E.dungeonUnlocked = () => true;

const team = (L) => { const S = E.newState("Camp", "iop"); S.chars[0].lvl = L; ["eni", "cra"].forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); E.checkAch(S); return S; };
const win = (S, sub, n) => E.emit(S, "win", { sub, mons: Array.from({ length: n }, () => ({ key: E.SUBS[sub].monsters[0] })) });
const missions = (S, n) => { S.cnt.alignq = (S.cnt.alignq || 0) + n; E.emit(S, "harvest", { n: 0 }); E.emit(S, "commande", {}); };

// 1. Les chapitres : 5 par cité, 5 étapes chacun, données valides, titre au bout.
{
  for (const side of ["bonta", "brakmar"]) {
    const L = E.ALIGN_CH[side]; assert.strictEqual(L.length, 5, "5 chapitres pour " + side);
    L.forEach((C) => { assert.strictEqual(C.steps.length, 5, "5 étapes : " + C.name);
      C.steps.forEach((st) => {
        if (st.t === "kill") assert.ok(E.SUBS[st.sub], "zone " + st.sub);
        if (st.t === "boss") assert.ok(D.DUNGEONS[st.dg], "donjon " + st.dg);
        if (st.t === "res") assert.ok(D.RES[st.res], "ressource " + st.res);
        assert.ok(st.name && st.txt && !st.txt.includes("—"), "textes de l'étape");
      }); });
    assert.strictEqual(L[4].steps[4].t, "rank", "le dernier chapitre finit par le rang 10");
  }
  assert.deepStrictEqual(E.ALIGN_CH_LVL, [30, 60, 100, 140, 180]);
  console.log("ok - alignement : 2 × 5 chapitres de 5 étapes");
}

// 2. Un chapitre complet : missions, chasse, donjon, rang ; récompenses et points de guerre.
{
  const S = team(60); assert.strictEqual(E.chooseAlign(S, "bonta", "coeur"), null);
  assert.ok(S.align.q && S.align.q.side === "bonta" && S.align.q.c === 0, "quêtes de Bonta au chapitre 1");
  const k0 = S.kamas, i0 = S.tokens.insignes || 0;
  missions(S, 2); assert.strictEqual(S.align.q.i, 1, "missions : étape 1 faite");
  assert.strictEqual(E.alWarPts(S), 2 * E.ALIGN_WAR.mis + E.ALIGN_WAR.step, "points de guerre : 2 missions et une étape");
  win(S, "ama_bworks", 25); assert.strictEqual(S.align.q.p, 25, "chasse comptée"); win(S, "ama_bworks", 20); assert.strictEqual(S.align.q.i, 2, "chasse : étape 2 faite");
  win(S, "ama_bandits", 40); assert.strictEqual(S.align.q.i, 2, "pas la bonne zone");
  win(S, "ama_passage_brakmar", 40); assert.strictEqual(S.align.q.i, 3, "étape 3 faite");
  S.progress.bossKills.donjon_bworks = 1; E.emit(S, "dungeon", { id: "donjon_bworks", stasis: 1 }); assert.strictEqual(S.align.q.i, 4, "donjon : étape 4 faite");
  assert.ok(S.kamas > k0 && S.tokens.insignes > i0, "kamas et insignes des étapes");
  const c0 = S.cons.coffre_argent || 0;
  E.giveAlignXp(S, 20000); E.emit(S, "harvest", { n: 0 }); E.alCheck(S);
  assert.ok(E.alignRankIdx(S) >= 1 && S.align.q.c === 1 && S.align.q.done === 1, "rang 2 : chapitre 1 terminé");
  assert.strictEqual(S.cons.coffre_argent, c0 + 1, "coffre du chapitre");
  console.log("ok - alignement : chapitre 1 de Bonta,", E.alWarPts(S), "points de guerre");
}

// 3. Remise de ressources, chapitre fermé sous son niveau, titre « Héros de … » au bout du chapitre 5.
{
  const S = team(60); E.chooseAlign(S, "brakmar", "oeil"); const Q = S.align.q; Q.c = 1; Q.i = 0;
  win(S, "bra_bordure", 50); assert.strictEqual(Q.i, 1, "étape de chasse du chapitre 2");
  const st = E.alStep(S); assert.strictEqual(st.t, "res");
  assert.ok(typeof E.act(S, "alGive") === "string", "il manque les ressources");
  S.res[st.res] = st.n + 2; assert.strictEqual(E.act(S, "alGive"), null, "ressources remises"); assert.strictEqual(S.res[st.res], 2, "ressources prises"); assert.strictEqual(Q.i, 2);
  Q.c = 2; Q.i = 0; assert.ok(!E.alOpen(S), "chapitre 3 fermé au niveau 60");
  win(S, "bra_entrailles", 80); assert.strictEqual(Q.i, 0, "rien ne compte avant le niveau du chapitre");
  const T = team(200); E.chooseAlign(T, "brakmar", "coeur"); T.align.q.c = 4; T.align.q.i = 4; T.align.lvl = 99; E.giveAlignXp(T, 100000); E.alCheck(T);
  assert.ok(T.titlesExtra.includes("Héros de Brâkmar") && T.align.q.done === 5, "titre « Héros de Brâkmar »");
  assert.strictEqual(E.alStep(T), null, "toutes les quêtes finies");
  console.log("ok - alignement : remises, niveaux des chapitres, titre final");
}

// 4. Un seul camp : changer demande 7 jours, puis retour au rang 1 et nouvelles quêtes ; on peut annuler.
{
  const S = team(80); E.chooseAlign(S, "bonta", "esprit"); S.align.lvl = 70; S.align.q.c = 2;
  assert.strictEqual(E.chooseAlign(S, "bonta", "oeil"), null); assert.ok(S.align.order === "oeil" && S.align.lvl === 70, "changer d'ordre reste immédiat");
  assert.strictEqual(E.chooseAlign(S, "brakmar", "coeur"), null);
  assert.ok(S.align.side === "bonta" && S.align.pend && S.align.pend.side === "brakmar", "attente de 7 jours");
  assert.ok(Math.abs(E.alSwitchLeft(S) - 7 * 86400000) < 1000);
  assert.strictEqual(E.act(S, "alignCancel"), null); assert.ok(!S.align.pend, "annulé");
  E.chooseAlign(S, "brakmar", "coeur"); now += 3 * 86400000; E.tick(S, 1000); assert.strictEqual(S.align.side, "bonta", "toujours Bonta après 3 jours");
  const N = E.deserialize(E.serialize(S)); assert.ok(N.align.pend && N.align.pend.side === "brakmar", "attente gardée dans la sauvegarde");
  now += 4 * 86400000 + 1000; E.tick(S, 1000);
  assert.ok(S.align.side === "brakmar" && !S.align.pend, "Brâkmar après 7 jours");
  assert.ok(S.align.lvl <= E.ALIGN_SWITCH_LVL && E.alignRankIdx(S) <= 2 && S.align.pur === 0, "retour au rang 2 au plus, bourse vidée");
  assert.ok(S.align.q.side === "brakmar" && S.align.q.c === 0, "quêtes de Brâkmar au chapitre 1");
  const M = E.deserialize(E.serialize(N)); assert.strictEqual(M.align.side, "brakmar", "le changement se fait aussi au chargement");
  console.log("ok - alignement : changement de camp en 7 jours, rang 1");
}

// 5. Points de guerre : plafonnés, nouvelle semaine, résumé envoyé au serveur.
{
  const S = team(60); E.chooseAlign(S, "bonta", "coeur");
  for (let i = 0; i < 100; i++) E.alWarAdd(S, 10); assert.strictEqual(E.alWarPts(S), E.ALIGN_WAR.cap, "plafond de la semaine");
  const m = V.summary(E, S).align; assert.ok(m && m.s === "bonta" && m.o === "coeur" && m.p === E.ALIGN_WAR.cap && m.w === E.weekIdx() && m.ps === null, "camp et points dans le résumé");
  now += 7 * 86400000; assert.strictEqual(E.alWarPts(S), 0, "nouvelle semaine, nouveaux points");
  assert.strictEqual(V.summary(E, team(10)).align, null, "pas de camp : rien");
  assert.strictEqual(E.alignWarOn(), false, "la guerre de la semaine est remplacée par les régions (tests/alignement2.test.js)");
  const P = team(60); E.chooseAlign(P, "bonta", "coeur"); E.chooseAlign(P, "brakmar", "coeur"); assert.strictEqual(E.alWarAdd(P, 10), 0, "pas de points pendant un changement de camp");
  console.log("ok - alignement : guerre des cités");
}

// 6. Migration : une ancienne partie alignée reçoit ses quêtes et ses points sans rien perdre (et une seule fois).
{
  const S = team(120); S.align = { side: "brakmar", order: "esprit", lvl: 45, xp: 12 }; S.alignQuest = null; S.cnt.alignq = 17;
  const txt = JSON.stringify(JSON.parse(E.serialize(S)));
  const N = E.deserialize(txt);
  assert.ok(N.align.q && N.align.q.side === "brakmar" && N.align.q.mq === 17 && N.align.war && N.align.hon === E.honFromLvl(45) && E.alignRankIdx(N) === 4, "quêtes ajoutées, niveau 45 devenu de l'honneur (rang 4)");
  N.align.q.p = 1; const N2 = E.deserialize(E.serialize(N)); assert.strictEqual(N2.align.q.p, 1, "la migration ne repart pas de zéro");
  const T = team(20); const T2 = E.deserialize(E.serialize(T)); assert.strictEqual(T2.align, null, "sans camp : rien");
  console.log("ok - alignement : migration des anciennes parties");
}

console.log("alignement.test.js : tout est bon");
