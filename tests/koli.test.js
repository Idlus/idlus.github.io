/* Kolizéum (0.1.44), sans navigateur.
   Lancer : node tests/koli.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis", "defi", "gboss", "verify", "koli"]) require("../js/" + f + ".js");
const E = window.ENGINE; const D = window.DATA;
const K = E.KOLI;

// 1. Semaine de Paris (lundi minuit), comme le boss de guilde.
let t = Date.UTC(2030, 0, 6, 22, 59); E.setClock(() => t);
const w0 = E.koliWeek(); t += 2 * 60000; assert.strictEqual(E.koliWeek(), w0 + 1, "lundi minuit à Paris");
assert.strictEqual(E.koliWeek(), E.gbossWeek(), "même semaine que le boss de guilde (gb_week)");
assert.ok(E.koliLeft() > 6.9 * 86400000 && E.koliLeft() <= 7 * 86400000);
console.log("ok - semaines");

// 2. Grades et cote.
assert.deepStrictEqual([0, 1099, 1100, 1300, 1500, 1700, 2500].map((c) => E.koliGrade(c).id), ["bronze", "bronze", "argent", "or", "cristal", "diamant", "diamant"]);
assert.strictEqual(E.koliGrade(1200, true).id, "legende");
const st = E.koliStakes(1000, 1000), sg = E.koliStakes(1000, 1000, true);
assert.deepStrictEqual(st, { win: 16, lose: 16 }); assert.deepStrictEqual(sg, { win: 8, lose: 8 }, "Fantôme : moitié");
assert.ok(E.koliStakes(1000, 1300).win > E.koliStakes(1300, 1000).win, "battre plus fort rapporte plus");
assert.strictEqual(E.koliSoft(1400), 1200); assert.strictEqual(E.koliSoft(900), 950);
console.log("ok - grades et cote");

// 3. Fantômes : même graine, même équipe ; combat rejouable ; la vue du joueur (ids) ne change rien.
const g1 = E.koliGhost(1234, 80), g2 = E.koliGhost(1234, 80);
assert.deepStrictEqual(g1, g2); assert.strictEqual(g1.length, K.size); assert.ok(g1.every((x) => x.lvl === 80 && x.st && x.st.hpMax > 0));
assert.strictEqual(new Set(g1.map((x) => x.cls)).size, K.size, "trois classes différentes");
const g3 = E.koliGhost(99, 80);
const r1 = E.koliSim(g1, g3, 42), r2 = E.koliSim(g1, g3, 42);
assert.deepStrictEqual(r1, r2, "même graine, même combat");
const W = E.koliWatch(g1, g3, 42, { ids: [7, 8, 9], me: 1 }); for (let i = 0; i < 20000 && !W.done; i++) E.koliWatchStep(W);
assert.deepStrictEqual(E.koliResult(W), r1, "regarder le combat donne le même résultat");
assert.ok(r1.rounds >= 1 && r1.rounds <= K.maxRound);
const o = E.koliGhostOpp(555, 60, 1200, 50); assert.deepStrictEqual(o, E.koliGhostOpp(555, 60, 1200, 50)); assert.strictEqual(o.lvl, 52); assert.strictEqual(E.koliGhostOpp(555, 0, 1000, 50, 1).team.length, 1, "Fantôme à la taille de ton équipe");
console.log("ok - Fantômes et combat rejouable");

// 4. Une partie : tickets du jour, équipe d'arène, combat hors ligne, récompense de la semaine.
const S = E.newState("Arène", "iop"); S.chars[0].lvl = 60;
["eni", "feca", "cra"].forEach((k, i) => { const x = E.addChar(S, k, "H" + i, 60); x.inTeam = true; });
S.chars.forEach((c) => E.refreshSpells(c, E.charStats(S, c)));
const Q = E.koliState(S);
assert.strictEqual(E.koliTickets(S), K.daily, "10 tickets le premier jour"); assert.strictEqual(Q.team.length, K.size);
t += 86400000 * 5; E.koliState(S); assert.strictEqual(E.koliTickets(S), K.tkMax, "réserve plafonnée à 30");
assert.ok(E.koliToggle(S, Q.team[0]) === null && E.koliState(S).team.length === 2);
assert.ok(E.koliToggle(S, S.chars.find((c) => !E.koliState(S).team.includes(c.id)).id) === null);
assert.strictEqual(E.koliToggle(S, S.chars.find((c) => !E.koliState(S).team.includes(c.id)).id), `${K.size} héros au plus dans l'équipe d'arène.`);
const opps = E.koliGhostOpps(S); assert.strictEqual(opps.length, 3);
assert.deepStrictEqual(E.koliGhostOpps(S).map((x) => x.seed), opps.map((x) => x.seed), "même liste tant que rien ne change");
const tk0 = E.koliTickets(S), k0 = S.kamas;
const f = E.act(S, "koliFight", 1); assert.strictEqual(typeof f, "object", f);
assert.strictEqual(E.koliTickets(S), tk0 - 1, "un ticket par combat");
assert.strictEqual(Q.n, 1); assert.strictEqual(Q.log.length, 1); assert.ok(Q.log[0].A, "de quoi revoir le combat");
assert.strictEqual(E.koliKz(S), f.win ? K.kzWin : K.kzLoss);
if (f.win) assert.strictEqual(S.kamas - k0, K.purseK * E.koliLvl(S));
assert.notDeepStrictEqual(E.koliGhostOpps(S).map((x) => x.seed), opps.map((x) => x.seed), "nouveaux adversaires après un combat");
const rf = E.koliRefresh(S); assert.strictEqual(rf, null, "1 changement gratuit"); const tk1 = E.koliTickets(S);
assert.strictEqual(E.koliRefresh(S), null); assert.strictEqual(E.koliTickets(S), tk1 - 1, "ensuite un ticket");
for (let i = 0; i < 5; i++) E.act(S, "koliFight", i % 3);
assert.strictEqual(Q.log.filter((l) => l.A).length, 5, "on garde de quoi revoir les 5 derniers");
Q.cote = 1520; const kz = E.koliKz(S), wk = Q.w;
t += 7 * 86400000; E.koliState(S);
assert.strictEqual(S.koli.w, wk + 1); assert.strictEqual(S.koli.cote, E.koliSoft(1520)); assert.strictEqual(S.koli.n, 0);
assert.strictEqual(E.koliKz(S), kz + 50, "Cristal : 50 Kolizetons"); assert.ok(S.titlesExtra.includes("Gladiateur") && S.unlocks.koli, "titre de l'Or, ornement du Cristal");
assert.strictEqual(E.koliReward(S, { w: wk, cote: 2000, n: 9 }), null, "une seule récompense par semaine");
console.log("ok - tickets, équipe, combat hors ligne, semaine");

// 5. En ligne : fiche du serveur, semaines finies, défenses réussies.
const T = E.newState("Ligne", "iop"); const q = E.koliState(T);
let out = E.koliSync(T, { cote: 1180, best: 1200, n: 3, rank: 4 }, [{ w: q.w - 1, cote: 1350, n: 6, rank: 12 }], [{ id: 5, def: "me", win: false }], "me");
assert.strictEqual(q.cote, 1180); assert.strictEqual(out.weeks.length, 1); assert.ok(T.titlesExtra.includes("Gladiateur"));
assert.strictEqual(out.def, 0, "la première fois, les anciennes défenses ne comptent pas");
out = E.koliSync(T, null, [{ w: q.w - 1, cote: 1350, n: 6, rank: 12 }], [{ id: 6, def: "me", win: false }, { id: 5, def: "me", win: false }, { id: 7, def: "me", win: true }], "me");
assert.strictEqual(out.weeks.length, 0); assert.strictEqual(out.def, 1, "une nouvelle défense réussie");
t += 7 * 86400000; const kz2 = E.koliKz(T); E.koliState(T); assert.strictEqual(E.koliKz(T), kz2, "en ligne, la semaine est payée par le serveur");
const R = E.koliOnline(T, { win: true, seed: 3, rounds: 8, delta: 14, cote: 1194, opp: { name: "Xener", cote: 1200, ghost: false } });
assert.strictEqual(q.cote, 1194); assert.strictEqual(R.delta, 14); assert.strictEqual(q.log.length, 0, "en ligne, le journal vient du serveur");
console.log("ok - en ligne");

// 6. Équilibre : table de puissance pour chaque classe, aux 5 niveaux.
for (const c in D.CLASSES) { assert.ok(E.KOLI_POW[c] && E.KOLI_POW[c].length === E.KOLI_LVLS.length, "puissance manquante : " + c); }
assert.ok(E.SHOPS.koli && E.ORN.koli && E.ORN.koli_ban && D.CONSUMABLES[E.KOLI_TICKET]);
console.log("ok - équilibre et boutique");

// 7. Galets (0.1.45 ; 1.0.6 bonus facultatif de fabrication) : aucune recette ne les demande, la boutique les vend.
E.KOLI_GALETS.forEach((g) => { assert.ok(D.RES[g.name] && D.RES[g.name].lvl === g.lvl, "Galet dans les ressources : " + g.name); assert.ok(E.RES_SOURCE[g.name]); });
const withG = Object.values(D.ITEMS).filter((it) => it.craft && it.craft.ing.some(([r]) => /^Galet /.test(r)));
assert.strictEqual(withG.length, 0, "aucune recette ne demande de Galet");
assert.strictEqual(E.SHOPS.koli.items.filter((x) => x.res && /^Galet /.test(x.res)).length, 6, "les 6 Galets en boutique");
{ // bonus de fabrication
  const G = E.newState("Galets", "iop"); const tpl = "i8271"; const T = D.ITEMS[tpl]; // Anneau du Dragon Cochon, niv. 108
  assert.deepStrictEqual(E.galetsFor(tpl).map((g) => g.name), ["Galet rutilant", "Galet Lunaire"]);
  G.crafts[T.craft.job].lvl = 200; const fill = () => T.craft.ing.forEach(([n, q]) => { G.res[n] = q * 400; }); fill();
  assert.ok(/Plus de Galet rutilant/.test(E.craftItem(G, tpl, "Galet rutilant")), "sans Galet en stock");
  G.res["Galet cramoisi"] = 1; assert.ok(/niveau 50 à 99/.test(E.craftItem(G, tpl, "Galet cramoisi")), "mauvais niveau");
  G.res["Galet rutilant"] = 2; const it = E.craftItem(G, tpl, "Galet rutilant"); assert.ok(it && it.uid && G.res["Galet rutilant"] === 1, "1 Galet consommé");
  const plain = E.craftItem(G, tpl); assert.ok(plain && plain.uid && G.res["Galet rutilant"] === 1, "sans Galet : recette normale");
  // Lunaire : 1 chance sur 10 d'un 2e objet
  G.res["Galet Lunaire"] = 300; E.itemCap = () => 1e9; let twins = 0;
  for (let i = 0; i < 300; i++) { fill(); const r = E.craftMany(G, "tpl", tpl, 1, "Galet Lunaire"); twins += r.twins || 0; }
  assert.ok(twins > 10 && twins < 60, "Lunaire ≈ 30 doubles sur 300 : " + twins); assert.ok(!G.res["Galet Lunaire"]);
  // gains moyens (simulation) : chaque Galet améliore un peu, sans excès
  const q = (o) => { let s = 0; for (let i = 0; i < 3000; i++) { const x = E.rollItem(G, tpl, o); s += E.itemQuality(x); delete G.items[x.uid]; } return s / 3000; };
  const q0 = q({ radiant: false }), q2 = q({ radiant: false, best2: true }), qf = q({ radiant: false, floor: 0.25 });
  assert.ok(q2 > q0 + 0.05 && q2 < q0 + 0.25 && qf > q0 + 0.05 && qf < q0 + 0.3, `qualité ${q0.toFixed(2)} → ${q2.toFixed(2)} / ${qf.toFixed(2)}`);
  const rf = E.galetFx(G, "i11720", "Galet brasillant"); assert.ok(typeof rf === "string"); // pas en stock
}
{ // 2A : Galets des sacs repris une fois au prix payé
  const R = E.newState("Repris", "iop"); assert.ok(!R.galRef, "le drapeau ne vient pas des nouvelles parties (deserialize les complète)");
  R.res["Galet cramoisi"] = 4; R.res["Galet rutilant"] = 3; R.tokens[E.KOLI_CUR] = 5;
  const back = E.deserialize(E.serialize(R)); assert.strictEqual(E.koliKz(back), 5 + 4 * 2 + 3 * 3); assert.ok(!back.res["Galet cramoisi"] && back.galRefNote);
  back.res["Galet cramoisi"] = 2; const again = E.deserialize(E.serialize(back)); assert.strictEqual(again.res["Galet cramoisi"], 2, "une seule fois");
}
const B = E.newState("Boutique", "iop"); B.tokens[E.KOLI_CUR] = 30;
const ch = E.SHOPS.koli.items.find((x) => x.cons === "coffre_bois");
assert.strictEqual(E.buyShop(B, "koli", ch.id, 1), null); assert.strictEqual(B.cons.coffre_bois, 1); assert.strictEqual(E.koliKz(B), 30 - ch.cost);
assert.ok(/Il faut/.test(E.buyShop(B, "koli", ch.id, 100)), "pas assez de Kolizetons"); assert.strictEqual(B.cons.coffre_bois, 1);
const dust = E.SHOPS.koli.items.find((x) => x.res === E.POUSSIERE); const d0 = B.res[E.POUSSIERE] || 0;
assert.strictEqual(E.buyShop(B, "koli", dust.id), null); assert.strictEqual(B.res[E.POUSSIERE], d0 + dust.n);
const tit = E.SHOPS.koli.items.find((x) => x.title); B.tokens[E.KOLI_CUR] = 1000; E.buyShop(B, "koli", tit.id, 10);
assert.strictEqual(E.koliKz(B), 1000 - tit.cost, "un titre ne s'achète qu'une fois, même avec ×10");
assert.ok(E.SHOPS.koli.items.every((x) => ["galets", "combat", "coffres", "look"].includes(x.sec)));
console.log("ok - Galets en bonus de fabrication et boutique en rayons");

// 1.0.7.2 : chance par petits morceaux = même résultat que le calcul d'un bloc, et s'arrête si on quitte la page.
(async () => {
  const A = E.koliGhost(11, 120, 3), Bt = E.koliGhost(22, 120, 3);
  assert.strictEqual(await E.koliChanceAsync(A, Bt), E.koliChance(A, Bt), "même chance qu'avant");
  const Ah = E.koliGhost(5, 200, 3), Bh = E.koliGhost(6, 200, 3);
  assert.strictEqual(await E.koliChanceAsync(Ah, Bh, () => false), null, "arrêt quand la page change");
  assert.ok(K.autoGapOn >= 6000, "mode auto en ligne : combats espacés pour ménager le serveur");
  console.log("ok - chance sans figer le jeu");
})().catch((e) => { console.error(e); process.exit(1); });
