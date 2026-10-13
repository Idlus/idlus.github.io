/* Lot Quêtes, succès et chasses (0.1.49), sans navigateur.
   Lancer : node tests/quetes.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "idols", "renaissance", "archis", "welcome", "defi", "gboss", "koli", "legendaires", "songe", "suivi", "vie", "quetes"].forEach((m) => require(`../js/${m}.js`));
const D = require("../js/data.js");

let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
let seed = 4242; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
const team = (lvl) => { const S = E.newState("Q", "iop"); S.chars[0].lvl = lvl; ["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S, k, "H" + i, lvl).inTeam = true; }); return S; };
const ok = (m) => console.log("ok - " + m);

// 1. Quête principale : le chapitre 1 ne change pas, 4 chapitres de plus jusqu'au niveau 200
assert.strictEqual(E.MAIN_CH1, 22);
assert.strictEqual(E.QUEST_CHAPTERS.length, 5);
assert.ok(E.MAIN_QUEST.length >= 85, "≈ 90 étapes : " + E.MAIN_QUEST.length);
assert.strictEqual(E.QUEST_CHAPTERS[4].end, E.MAIN_QUEST.length);
E.MAIN_QUEST.forEach((q) => { if (q.t === "kill") assert.ok(E.SUBS[q.sub], q.sub); if (q.t === "boss") assert.ok(D.DUNGEONS[q.dg], q.dg); });
assert.strictEqual(E.questReward(3).kamas, 80 + 3 * 60, "récompense du chapitre 1 inchangée");
{ const S = team(60); S.quest = { step: 22, prog: 0 }; E.checkAch(S);
  assert.ok(S.ach.mainq, "« Héros d'Amakna » reste à la fin du chapitre 1"); assert.ok(E.ornUnlocked(S, "heros"));
  assert.ok(!S.ach.mainch2); S.quest.step = E.QUEST_CHAPTERS[1].end; E.checkAch(S); assert.ok(S.ach.mainch2 && E.titles(S).includes("Aventurier des terres sauvages")); }
ok("quête principale en 5 chapitres");

// 2. Quêtes de région : une par région, chasse et boss tout seuls, remise et fin avec un bouton
assert.ok(E.REGIONS.length >= 27);
{ const S = team(30); const R = E.REGION.incarnam; Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20));
  assert.ok(E.rqOpen(S, R));
  const st0 = R.steps[0]; E.emit(S, "win", { mons: Array.from({ length: st0.n }, () => ({ key: E.SUBS[st0.sub].monsters[0] })), sub: st0.sub });
  assert.strictEqual(E.rqState(S, R.id).i, 1, "la chasse valide l'étape");
  const st1 = R.steps[1]; assert.strictEqual(st1.t, "res");
  assert.ok(typeof E.act(S, "rqGive", R.id) === "string", "il faut les ressources");
  S.res[st1.res] = 12; assert.strictEqual(E.act(S, "rqGive", R.id), null); assert.strictEqual(S.res[st1.res], 2);
  const st2 = R.steps[2]; E.emit(S, "win", { mons: Array.from({ length: st2.n }, () => ({ key: "x" })), sub: st2.sub });
  R.steps.filter((x) => x.t === "boss").forEach((x) => { S.progress.bossKills[x.dg] = 1; S.stasis = S.stasis || {}; S.stasis[x.dg] = { max: 3 }; });
  E.refreshSystems(S);
  assert.strictEqual(R.steps[E.rqState(S, R.id).i].t, "talk", "les boss se valident tout seuls");
  assert.ok(E.rqReady(S, R));
  const k0 = S.kamas; assert.strictEqual(E.act(S, "rqClaim", R.id), null);
  assert.ok(S.kamas - k0 >= E.rqFinalRew(R)); assert.ok(E.rqState(S, R.id).done);
  assert.ok(E.titles(S).includes(E.regionTitle(R)), "titre « l'Ami de … »");
  assert.ok(E.ornUnlocked(S, "reg_incarnam"), "emblème de la région");
  assert.ok(S.ach.rq1 && S.ach.rega_incarnam);
  assert.ok(typeof E.act(S, "rqClaim", R.id) === "string", "une seule fois"); }
assert.ok(!E.rqOpen(team(10), E.REGION.wukin), "une région lointaine reste fermée");
ok("quêtes de région");

// 3. Quêtes de la semaine : 3 quêtes, le coffre quand elles sont faites, nouvelles le lundi
{ const S = team(80); E.refreshSystems(S); const W = S.wk; assert.strictEqual(W.list.length, 3); assert.strictEqual(new Set(W.list.map((q) => q.t)).size, 3);
  const k0 = S.kamas; const c0 = S.cons.coffre_or || 0;
  W.list.forEach((q) => { q.p = q.n - 1; E.wkBump(S, q.t, 1, { lvl: 200 }); });
  assert.ok(W.list.every((q) => q.done) && W.claimed, "coffre de la semaine");
  assert.strictEqual((S.cons.coffre_or || 0) - c0, 1); assert.ok(S.kamas > k0); assert.strictEqual(S.cnt.wk, 1);
  assert.ok(E.tresorState(S).stock.length >= 3, "3 parchemins de chasse");
  const w = W.w; t += 7 * 86400000; E.refreshSystems(S); assert.notStrictEqual(S.wk.w, w, "nouvelles quêtes la semaine suivante"); assert.ok(!S.wk.claimed);
  assert.ok(E.pinInfo(S, { k: "wk", id: 0 }), "une quête de la semaine s'épingle"); }
ok("quêtes de la semaine");

// 4. Avis : 3 monstres + 1 boss à ton niveau, avis trop faciles remplacés, rang de chasseur, élite
{ const S = team(90); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20)); Object.keys(D.DUNGEONS).forEach((d) => (S.progress.bossKills[d] = 1));
  S.bounties = [{ id: 1, key: "m970", sub: "inc_route", n: 12, prog: 0, kamas: 10, xp: 0.1, axp: 1 }];
  E.refreshSystems(S);
  assert.ok(!S.bounties.some((b) => b.id === 1), "l'avis de niveau 1 pas commencé est remplacé");
  assert.strictEqual(S.bounties.filter((b) => !b.boss).length, E.BOUNTY_SLOTS); assert.strictEqual(S.bounties.filter((b) => b.boss).length, 1);
  S.bounties.filter((b) => b.boss).forEach((b) => assert.ok(D.DUNGEONS[b.dg].lvl >= 90 - 25, "boss à ton niveau"));
  S.cnt.bounty = 100; assert.strictEqual(E.hunterRank(S), 2); assert.ok(Math.abs(E.huntBonus(S) - 1.2) < 1e-9);
  const b = S.bounties[0]; b.prog = b.n; const k0 = S.kamas; E.emit(S, "win", { mons: [], sub: b.sub }); E.refreshSystems(S);
  const B0 = E.eliteState(S); assert.ok(B0.key, "un avis d'élite cette semaine");
  E.emit(S, "dungeon", { id: B0.dg, stasis: 5, chals: 0, down: 0 }); assert.ok(!S.belite.done, "stasis 6 au moins");
  E.emit(S, "dungeon", { id: B0.dg, stasis: 6, chals: 0, down: 0 }); assert.ok(S.belite.done && S.cnt.belite === 1); }
ok("avis de recherche");

// 5. Chasse au trésor : courte (jour), légendaire (semaine), nouveaux indices
{ const S = team(90); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20)); Object.keys(D.DUNGEONS).forEach((d) => (S.progress.bossKills[d] = 1));
  assert.strictEqual(E.tresorClaim(S), null); assert.strictEqual(E.tresorP(S.tresor.stock[0]).k, "court");
  assert.strictEqual(E.tresorLegClaim(S), null); assert.ok(typeof E.tresorLegClaim(S) === "string", "une légendaire par semaine");
  assert.strictEqual(E.tresorStart(S, 1), null); const c = S.tresor.cur; assert.strictEqual(c.k, "leg");
  assert.ok(c.steps.length >= 8 && c.steps.some((x) => x.t === "dg"), "8 indices et un donjon");
  E.tresorQuit(S); assert.strictEqual(E.tresorStart(S, 0), null); assert.strictEqual(S.tresor.cur.steps.length, 3, "chasse courte : 3 indices");
  c.steps.forEach((x) => assert.ok(E.tresorClueTxt(x).length > 5)); }
ok("chasse au trésor en 3 tailles");

// 6. Succès : plus de 500, points, paliers, secrets cachés
assert.ok(E.ACH.length >= 500, "succès : " + E.ACH.length);
assert.strictEqual(new Set(E.ACH.map((a) => a.id)).size, E.ACH.length, "identifiants uniques");
assert.strictEqual(E.ACH.filter((a) => a.secret).length, 15);
assert.ok(E.ACH.filter((a) => a.secret).every((a) => a.hint));
assert.strictEqual(E.ACH.filter((a) => /^s10_/.test(a.id)).length, Object.keys(D.DUNGEONS).length, "un succès stasis 10 par donjon");
{ const S = team(50); E.ACH.slice(0, 120).forEach((a) => (S.ach[a.id] = 1)); const p = E.achPoints(S); assert.ok(p > 0);
  E.checkAch(S); const k = E.ACH_PALIERS.filter((x) => x.n <= E.achPoints(S)).length; assert.strictEqual(S.achPal, k);
  if (k >= 2) assert.ok(E.ornUnlocked(S, "pal1"));
  E.ACH.forEach((a) => { const pr = E.achProgress(S, a.id); if (pr) assert.ok(Array.isArray(pr) && pr.length === 2 && isFinite(pr[0]) && isFinite(pr[1]), a.id); }); }
ok("succès, points et paliers");

// 7. Sauvegarde : tout tient en JSON et le résumé du classement donne les points
{ const S = team(120); E.refreshSystems(S); const V = require("../js/verify.js"); const j = JSON.parse(JSON.stringify(S));
  assert.ok(j.wk && j.belite); const sum = V.summary(E, S); assert.ok(typeof sum.pts === "number"); }
ok("sauvegarde et classement des points");
console.log("quetes.test.js : tout est bon");
