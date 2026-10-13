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

// 7. Galets (0.1.45) : ressources, recettes de DOFUS, achat à l'unité ou par 5/10.
E.KOLI_GALETS.forEach((g) => { assert.ok(D.RES[g.name] && D.RES[g.name].lvl === g.lvl, "Galet dans les ressources : " + g.name); assert.ok(E.RES_SOURCE[g.name]); });
assert.ok(E.KOLI_GALET_ITEMS >= 290, "les recettes de DOFUS redemandent leurs Galets : " + E.KOLI_GALET_ITEMS);
const withG = Object.values(D.ITEMS).filter((it) => it.craft && it.craft.ing.some(([r]) => /^Galet /.test(r)));
assert.strictEqual(withG.length, E.KOLI_GALET_ITEMS); assert.ok(withG.every((it) => it.lvl >= 50 && it.craft.ing.filter(([r]) => /^Galet /.test(r)).length === 1));
const U = E.KOLI_GALET_USE["Galet cramoisi"]; assert.ok(U.n > 0 && U.lo >= 50 && U.hi < 100);
const B = E.newState("Boutique", "iop"); B.tokens[E.KOLI_CUR] = 30;
const g1i = E.SHOPS.koli.items.find((x) => x.res === "Galet cramoisi");
assert.strictEqual(E.buyShop(B, "koli", g1i.id, 5), null); assert.strictEqual(B.res["Galet cramoisi"], 5); assert.strictEqual(E.koliKz(B), 30 - 5 * g1i.cost);
assert.ok(/Il faut/.test(E.buyShop(B, "koli", g1i.id, 100)), "pas assez de Kolizetons"); assert.strictEqual(B.res["Galet cramoisi"], 5);
const dust = E.SHOPS.koli.items.find((x) => x.res === E.POUSSIERE); const d0 = B.res[E.POUSSIERE] || 0;
assert.strictEqual(E.buyShop(B, "koli", dust.id), null); assert.strictEqual(B.res[E.POUSSIERE], d0 + dust.n);
const tit = E.SHOPS.koli.items.find((x) => x.title); B.tokens[E.KOLI_CUR] = 1000; E.buyShop(B, "koli", tit.id, 10);
assert.strictEqual(E.koliKz(B), 1000 - tit.cost, "un titre ne s'achète qu'une fois, même avec ×10");
assert.ok(E.SHOPS.koli.items.every((x) => ["galets", "combat", "coffres", "look"].includes(x.sec)));
console.log("ok - Galets et boutique en rayons");
