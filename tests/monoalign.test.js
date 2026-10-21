/* Monocompte, étape 3 : les alignements du Classique branchés sur le Monocompte (js/monoalign.js).
   Un camp par saison, table des rangs du Monocompte (P-A1), agressions et défenses à un héros, régions à +5 % (P-A2),
   quête du Phénix par l'honneur (P-A3), hauts faits « Camp » en rangs et agressions (P-A4), équipements de rang
   gardés dans l'Éternel (P-A5), migration des anciennes parties, Classique identique. Sans navigateur.
   Lancer : node tests/monoalign.test.js (une vingtaine de secondes : deux saisons de 56 jours simulées) */
"use strict";
const assert = require("assert");
const path = require("path");
const { execFileSync } = require("child_process");

/* ---------- partie Classique témoin, jouée dans un processus à part avec ou sans js/monoalign.js ---------- */
if (process.argv.includes("--scenario")) {
  const E = require("../js/engine.js");
  ["systems", "pets", "mounts", "elevage", "idols", "renaissance", "archis", "welcome", "defi", "koli", "legendaires", "dofusp", "mono", "monopass", "monodofus", "wboss", "quetes", "saison1", "verify", "alignement", "honneur"].forEach((f) => require("../js/" + f + ".js"));
  if (!process.env.SANS) require("../js/monoalign.js");
  let seed = 9; E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
  let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now); E.subUnlocked = () => true; E.dungeonUnlocked = () => true;
  const S = E.newState("Classique", "iop"); S.chars[0].lvl = 150; ["eni", "cra"].forEach((k, i) => { const c = E.addChar(S, k, "H" + i, 150); c.inTeam = true; });
  S.chars.forEach((c) => { E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c)); });
  E.chooseAlign(S, "brakmar", "esprit"); const out = [];
  for (let d = 0; d < 3; d++) {
    now += 86400000; E.honInit(S);
    E.alignRegSet(d % 2 ? { held: { amakna: "brakmar" }, side: "brakmar" } : { held: {}, side: null });
    for (let i = 0; i < 5; i++) { const r = E.agrFight(S, i); out.push(r.err || [r.win, r.hon, r.war]); }
    S.align.ag.defAt = 1; const df = E.honDefTick(S); out.push(df && [df.won, df.n]);
    E.emit(S, "dungeon", { id: "donjon_bworks", stasis: 2, chals: [], down: 0 }); E.giveAlignXp(S, 2000, 1); out.push(E.honGive(S, 100));
  }
  out.push(E.agrTargets(S).map((T) => [T.n, T.hon, T.lvl]), E.alignRankIdx(S), E.honCum(20), E.chooseAlign(S, "bonta", "coeur"), !!S.align.pend);
  out.push(JSON.stringify(S.align), E.serialize(S).length);
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const SIM = require("../tools/sim_honneur_mono.js");
const { E, D } = SIM;

// 1. Classique identique : la même partie, avec et sans js/monoalign.js, donne exactement le même résultat.
{
  const run = (sans) => execFileSync(process.execPath, [__filename, "--scenario"], { env: Object.assign({}, process.env, sans ? { SANS: "1" } : {}), cwd: path.join(__dirname, ".."), maxBuffer: 1 << 26 }).toString();
  const a = run(true), b = run(false);
  assert.ok(a.length > 300 && a.includes("brakmar"), "scénario joué");
  assert.strictEqual(b, a, "Classique : agressions, défenses, honneur, rang, changement de camp et sauvegarde identiques");
  console.log("ok - Classique identique avec ou sans js/monoalign.js");
}

/* aléatoire et horloge du test (après le scénario, qui a les siens) */
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
const mono = (cls, lvl) => { const S = E.monoStart(E.newState("Mono", cls || "iop")); E.monoBoot(S); S.chars[0].lvl = lvl || 200; S.chars[0].inTeam = true; return S; };

// 2. Table des rangs du Monocompte (P-A1) : 1 400 honneur au rang 1, +30 par rang ; posée au démarrage d'une partie Monocompte.
{
  const S = mono();
  assert.strictEqual(E.honStep(1), 1400); assert.strictEqual(E.honStep(20), 1970); assert.strictEqual(E.honCum(10), 15350); assert.strictEqual(E.honCum(20), 33700);
  assert.strictEqual(E.chooseAlign(S, "bonta", "coeur"), null); assert.strictEqual(S.align.cm, 1, "nouveau camp : table du Monocompte");
  assert.strictEqual(E.honGive(S, 1399, "", true), 1399); assert.strictEqual(E.alignRankIdx(S), 0); E.honGive(S, 1, "", true); assert.strictEqual(E.alignRankIdx(S), 1);
  assert.ok(E.honGive(S, -20, "agression perdue", true) === 0 && E.alignRankIdx(S) === 1, "une défaite ne fait jamais perdre un rang");
  console.log("ok - table des rangs du Monocompte");
}

// 3. Un camp par saison, libre dans l'Éternel.
{
  const S = mono(); E.chooseAlign(S, "bonta", "coeur");
  assert.ok(/un seul camp par saison/.test(E.chooseAlign(S, "brakmar", "coeur")), "pas de changement de camp pendant la saison");
  assert.ok(!S.align.pend && S.align.side === "bonta"); assert.ok(E.monoCampLocked(S));
  assert.strictEqual(E.chooseAlign(S, "bonta", "oeil"), null, "changer d'ordre reste possible"); assert.strictEqual(S.align.order, "oeil");
  S.mono.eternel = { s: 1, at: now, lvl: 200 }; assert.ok(!E.monoCampLocked(S));
  assert.strictEqual(E.chooseAlign(S, "brakmar", "coeur"), null); assert.ok(S.align.pend && S.align.pend.side === "brakmar", "Éternel : changement de camp avec l'attente du Classique");
  console.log("ok - un camp par saison");
}

// 4. Agressions et défenses à un héros (fantômes à un héros, réglage 1 contre 1 du Kolizéum), 5 par jour.
{
  const S = mono("cra"); E.chooseAlign(S, "brakmar", "coeur"); E.honInit(S);
  const L = E.agrTargets(S); assert.strictEqual(L.length, 5); assert.ok(L.every((T) => T.n === 1), "fantômes à un héros");
  const W = E.agrFight(S, 2, { watch: true }).watch; const ents = W.S2.fight.ents.filter((e) => !e.summon);
  assert.deepStrictEqual([ents.filter((e) => e.tm === 0).length, ents.filter((e) => e.tm === 1).length], [1, 1], "1 contre 1");
  assert.strictEqual(E.honDefSize(S), 1); assert.strictEqual(E.honDefSize(E.newState("C", "iop")), 3, "Classique : défenses à 3");
  let won = 0; for (let i = 0; i < 5; i++) { const r = E.agrFight(S, i); assert.ok(!r.err, r.err); if (r.win) won++; }
  assert.ok(/Plus d'agression/.test(E.agrFight(S, 0).err), "5 par jour");
  assert.strictEqual(E.bpState(S).cnt.agrWin || 0, won, "haut fait « Soldat de la guerre » : agressions gagnées");
  S.align.ag.defAt = 1; const df = E.honDefTick(S); assert.ok(df && typeof df.won === "boolean", "défense jouée");
  console.log(`ok - agressions à un héros (${won} / 5 gagnées)`);
}

// 5. Régions (P-A2) : +5 % d'XP et de butin dans une région tenue par ton camp, données par le serveur Monocompte seulement.
{
  const S = mono(); E.chooseAlign(S, "bonta", "coeur"); const sub = Object.keys(E.SUBS).find((k) => E.regOfSub(k) === "amakna"); S.sub = sub;
  E.monoRegSet({ held: {}, side: "bonta" }); E.tick(S, 0); const x0 = E.evMult("xp", now), d0 = E.evMult("drop", now);
  E.monoRegSet({ held: { amakna: "bonta" }, side: "bonta" }); E.tick(S, 0);
  assert.ok(Math.abs(E.evMult("xp", now) / x0 - 1.05) < 1e-9 && Math.abs(E.evMult("drop", now) / d0 - 1.05) < 1e-9, "+5 % d'XP et de butin");
  assert.strictEqual(E.ALIGN_REG_BONUS, 5); E.monoRegSet({ held: {}, side: null }); S.sub = null;
  console.log("ok - régions : +5 % d'XP et de butin");
}

// 6. Rythme des rangs pour UN héros sur 56 jours (P-A1) et quête du Phénix (P-A3), par le simulateur (tools/sim_honneur_mono.js).
{
  const A = SIM.season("iop", "actif", "bonta"), O = SIM.season("cra", "occasionnel", "brakmar");
  const step = E.DOFUS.phenix.steps[0]; assert.strictEqual(step.k, "hon");
  assert.ok(A.agr[0] / A.agr[1] > 0.6, `agressions à un héros gagnées en majorité par un actif bien équipé (${A.agr[0]} / ${A.agr[1]})`);
  const phx = A.hon.findIndex((h) => h >= step.n) + 1;
  assert.ok(A.rankDay[10] >= 20 && A.rankDay[10] <= 36, `actif : rang 10 vers la mi-saison (jour ${A.rankDay[10]})`);
  assert.ok(A.rankDay[20] && A.rankDay[20] <= 56, `actif : rang 20 avant la fin de la saison (jour ${A.rankDay[20]})`);
  assert.ok(A.rankDay[20] >= 40, `actif : rang 20 pas trop tôt (jour ${A.rankDay[20]})`);
  assert.ok(O.rank >= 6, `occasionnel : rang 6 atteint (rang ${O.rank})`);
  assert.ok(phx > 0 && phx < 29, `actif : étape d'honneur du Phénix avant la manche 3 (jour ${phx})`);
  console.log(`ok - rythme : actif rang 6 j${A.rankDay[6]}, 10 j${A.rankDay[10]}, 20 j${A.rankDay[20]} · occasionnel rang ${O.rank} (rang 6 j${O.rankDay[6]}) · Phénix ${step.n} honneur j${phx}`);
  // la quête finie de bout en bout : honneur, Défi de la manche, Boss de saison, pass, boss niveau 180 en stasis 7
  now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
  const S = A.S; E.monoBoot(S); // la partie de l'actif simulée : son honneur vient des agressions, missions et donjons joués
  assert.ok(S.align.hon >= step.n, "étape d'honneur faite en jouant");
  E.emit(S, "harvest", { n: 0 }); assert.ok(E.dofusQuest(S, "phenix").step >= 1, "étape 1 validée");
  const B = E.bpState(S); E.mdState(S).best = 6; B.sb = { days: { 1: { tries: 1 }, 2: { tries: 1 }, 3: { tries: 2 }, 4: { tries: 3 } }, best: 0, tot: 0 }; B.pts = 25 * E.MONO.bp.step;
  const dg = Object.keys(D.DUNGEONS).find((k) => D.DUNGEONS[k].lvl >= 180); E.stasisInfo(S, dg).max = 7;
  E.emit(S, "harvest", { n: 0 }); assert.ok(E.dofusQuest(S, "phenix").done && E.dofusOwned(S, "phenix"), "quête du Phénix finie, Dofus donné");
  console.log("ok - quête du Phénix finie de bout en bout");
}

// 7. Hauts faits « Camp » (P-A4) : rang d'honneur et agressions gagnées ; l'ancienne guerre ne compte plus.
{
  const H = (id) => E.MONO_HF.find((x) => x.id === id);
  assert.deepStrictEqual(H("c_align").m, [4, 10, 20]); assert.ok(/Rang/.test(H("c_align").d)); assert.ok(/Agressions/.test(H("c_war").d));
  const S = mono(); E.chooseAlign(S, "bonta", "coeur"); E.honGive(S, E.honCum(10), "", true);
  assert.strictEqual(E.hfValue(S, H("c_align")), 10); E.hfCheck(S); assert.strictEqual(E.bpState(S).hf.c_align, 2, "argent au rang 10");
  E.emit(S, "win", { mons: [{ key: "x" }], sub: "ast_cite" }); assert.ok(!E.bpState(S).war, "plus de points de guerre par combat de chasse");
  console.log("ok - hauts faits « Camp »");
}

// 8. Éternel (P-A5) : le héros garde son rang et ses équipements de rang ; bilan de saison.
{
  now = Date.UTC(2030, 2, 1, 12, 0);
  const S = mono("sacri"); E.chooseAlign(S, "brakmar", "coeur"); E.honGive(S, E.honCum(10), "", true); S.align.pur = 20000;
  E.HON_GEAR_SLOTS.forEach((sl) => assert.strictEqual(E.act(S, "honBuy", sl), null, sl));
  const c = S.chars[0]; Object.values(S.items).filter((it) => D.ITEMS[it.tpl].bound).forEach((it) => E.equip(S, c.id, it.uid, D.ITEMS[it.tpl].slot === "anneau" ? "anneau1" : D.ITEMS[it.tpl].slot));
  const gear = Object.values(c.equip).filter((u) => S.items[u] && D.ITEMS[S.items[u].tpl].bound).sort();
  assert.strictEqual(gear.length, 5);
  now += 57 * 86400000; assert.ok(E.monoOver(S)); E.monoToEternal(S);
  assert.ok(E.monoEternal(S)); assert.deepStrictEqual(S.mono.eternel.al, { s: "brakmar", r: 10, h: S.align.hon }, "bilan : camp, rang et honneur");
  const T = E.deserialize(E.serialize(S)); E.monoBoot(T);
  assert.deepStrictEqual(Object.values(T.chars[0].equip).filter((u) => T.items[u] && D.ITEMS[T.items[u].tpl].bound).sort(), gear, "équipements de rang portés dans l'Éternel");
  assert.strictEqual(E.alignRankIdx(T), 10, "rang gardé"); assert.strictEqual(T.align.hon, S.align.hon, "honneur gardé (pas de seconde conversion)");
  console.log("ok - Éternel : rang et équipements de rang gardés");
}

// 9. Migration des anciennes parties Monocompte (honneur sur la table du Classique, ancienne guerre, changement de camp en attente).
{
  now = Date.UTC(2030, 0, 9, 12, 0);
  const S = E.monoStart(E.newState("Ancienne", "eni")); S.chars[0].lvl = 200; const B = E.bpState(S);
  const CL = (r) => { let a = 0; for (let k = 1; k <= r; k++) a += E.HON_STEP_CL(k); return a; };
  S.align = { side: "bonta", order: "esprit", lvl: 25, xp: 0, hon: CL(5) + Math.round(E.HON_STEP_CL(6) / 2), pur: 777, pend: { side: "brakmar", order: "coeur", at: now + 3 * 86400000 } };
  B.war = { 1: { z: { ast_cite: 40 }, tot: 40 } }; B.hf = { c_war: 1 };
  const it = E.rollItem(S, "hon_bonta_coiffe", { radiant: false }); it.locked = true; S.items[it.uid] = it; S.honGear = { hon_bonta_coiffe: 1 };
  const uids = Object.keys(S.items).sort(), kam = S.kamas;
  E.honCurve(E.HON_STEP_CL); // comme au chargement d'une page : la table du Monocompte n'est posée qu'au démarrage de la partie
  const T = E.deserialize(E.serialize(S)); E.monoBoot(T);
  assert.strictEqual(T.align.side, "bonta"); assert.ok(!T.align.pend, "changement de camp en attente annulé (le camp reste)");
  assert.strictEqual(E.alignRankIdx(T), 5, "même rang"); assert.strictEqual(T.align.hon, E.honCum(5) + Math.round(E.honStep(6) / 2), "même avancée dans le rang");
  assert.strictEqual(T.align.pur, 777, "bourse d'honneur gardée"); assert.strictEqual(T.align.cm, 1);
  assert.deepStrictEqual(Object.keys(T.items).sort(), uids, "aucun objet perdu"); assert.strictEqual(T.kamas, kam);
  assert.deepStrictEqual(T.mono.bp.war, B.war, "ancienne guerre gardée telle quelle, sans effet"); assert.strictEqual(T.mono.bp.hf.c_war, 1, "médaille gagnée gardée");
  const U = E.deserialize(E.serialize(T)); E.monoBoot(U); assert.strictEqual(U.align.hon, T.align.hon, "une seule conversion");
  // partie v13 (niveau d'alignement 0-100) : convertie en honneur par le moteur, puis sur la table du Monocompte, rang gardé
  const V = E.monoStart(E.newState("V13", "iop")); V.chars[0].lvl = 120; V.align = { side: "brakmar", order: "oeil", lvl: 100, xp: 0 }; V.v = 13;
  E.honCurve(E.HON_STEP_CL); const W = E.deserialize(E.serialize(V)); E.monoBoot(W); assert.strictEqual(E.alignRankIdx(W), 10); assert.strictEqual(W.align.hon, E.honCum(10));
  console.log("ok - migration des anciennes parties Monocompte (rang, objets et kamas gardés)");
}
console.log("Monocompte, alignements : tout est bon");
