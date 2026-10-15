/* Lot Se montrer (0.1.19) : défi du jour et garde-robe, sans navigateur.
   Lancer : node tests/defi.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/defi.js");
const D = require("../js/data.js");

// 1. Le jour change à minuit heure de Paris ; le défi est le même pour tous et change chaque jour.
let t = Date.UTC(2030, 0, 7, 22, 59); E.setClock(() => t); // 23 h 59 à Paris (hiver)
const d0 = E.defiDay(); t += 2 * 60000; assert.strictEqual(E.defiDay(), d0 + 1, "minuit à Paris");
t = Date.UTC(2030, 6, 7, 21, 59); const s0 = E.defiDay(); t += 2 * 60000; assert.strictEqual(E.defiDay(), s0 + 1, "minuit à Paris (été)");
const a = E.defi("ave", 9000), b = E.defi("ave", 9000), c = E.defi("ave", 9001);
assert.deepStrictEqual(a, b, "même défi pour tous");
assert.ok(a.did !== c.did || a.k !== c.k || a.mods.join() !== c.mods.join() || a.seed !== c.seed, "il change chaque jour");
for (const T of E.DEFI_TIERS) for (let d = 9000; d < 9030; d++) { const x = E.defi(T.id, d); const dg = D.DUNGEONS[x.did];
  assert.ok(dg.lvl >= (T.id === "eli" ? 141 : T.lo) && dg.lvl <= T.hi, "donjon du palier"); assert.ok(x.k >= T.k[0] && x.k <= Math.min(10, T.k[1] + (x.sun ? 1 : 0)), "stasis du palier");
  assert.strictEqual(new Set(x.mods).size, 2 + (x.sun ? 1 : 0)); assert.strictEqual(new Set(x.rules).size, x.sun ? 4 : 3, "3 règles (4 le dimanche)");
  assert.ok(x.rules.every((r) => E.CHALLENGES[r]) && E.DEFI_TEAM[x.team], "règles connues"); assert.strictEqual(x.sun, (d + 4) % 7 === 0); assert.strictEqual(x.mult, x.sun ? 3 : 1); }
console.log("ok - défi : jour de Paris, même tirage pour tous");

// 2. Le palier : jamais en dessous de son héros le plus fort.
t = Date.UTC(2030, 0, 8, 12, 0);
const S = E.newState("Défi", "iop"); S.chars[0].lvl = 90;
assert.ok(!E.defiTierOk(S, "dec") && E.defiTierOk(S, "ave") && E.defiTierOk(S, "leg"));
assert.strictEqual(E.defiTierDefault(S), "ave");
assert.ok(typeof E.defiPlay(S, "dec") === "string", "palier refusé");

// 3. Même équipe + même jour = même combat ; la partie n'est pas touchée par la simulation.
const G = E.newState("Équipe", "iop"); G.chars[0].lvl = 60; ["eni", "feca", "cra"].forEach((k, i) => { const x = E.addChar(G, k, "H" + i, 60); x.inTeam = true; });
const fitTeam = (S, def) => { const R = E.DEFI_TEAM[def.team]; S.chars.forEach((c) => (c.inTeam = true));
  for (const c of S.chars.slice().reverse()) { if (R.ok(E.team(S))) break; if ((def.team === "noeni" && c.cls === "eni") || (def.team === "noiop" && c.cls === "iop") || def.team.startsWith("max")) c.inTeam = false; }
  if (!R.ok(E.team(S))) S.chars.forEach((c, i) => (c.inTeam = i < 3 && !(def.team === "noeni" && c.cls === "eni") && !(def.team === "noiop" && c.cls === "iop"))); };
const def = E.defi("dec"); fitTeam(G, def); const before = E.serialize(G);
const r1 = E.defiSim(G, def, t), r2 = E.defiSim(G, def, t);
assert.deepStrictEqual(r1, r2, "même résultat à chaque essai");
assert.strictEqual(E.serialize(G), before, "la vraie partie ne bouge pas");
const r3 = E.defiSim(JSON.parse(before), def, t); assert.strictEqual(r3.turns, r1.turns, "le serveur (partie relue) trouve le même résultat");
const WT = E.defiWatch(G, def, t); let n0 = 0;
while (!WT.done && n0++ < 500000) { E.defiWatchStep(WT); E.rnd(); E.rnd(); } // l'écran et le reste du jeu tirent du hasard entre deux pas
assert.deepStrictEqual(E.defiResult(WT), r1, "« Regarder le combat » montre exactement le même combat");
console.log("ok - défi : combat identique à chaque essai et pour le serveur");

// 4. Coffre une fois par jour, série (7 jours = titre). L'équipe suit la règle d'équipe du jour.
let wins = 0; G.kamas = 0;
for (let day = 0; day < 9; day++) {
  t = Date.UTC(2030, 0, 10 + day, 12, 0);
  let r = null; for (const tid of ["dec", "ave", "leg"]) { if (!E.defiTierOk(G, tid)) continue; fitTeam(G, E.defi(tid)); r = E.defiPlay(G, tid); if (typeof r === "string") throw new Error(r); if (r.win) break; }
  if (!r || !r.win) { G.chars.forEach((x) => { x.lvl = Math.min(60, x.lvl); }); continue; }
  wins++; assert.ok(r.chest && r.chest.kamas >= 0 && r.chest.dust > 0, "coffre à la première victoire");
  const again = E.defiPlay(G, r.tier); assert.ok(!again.chest, "un seul coffre par jour");
}
assert.ok(wins >= 1, "une équipe niveau 60 gagne au moins un défi Découverte");
if (wins === 9) { assert.strictEqual(G.defiStreak.n, 9); E.checkAch(G); assert.ok(E.titles(G).includes(E.DEFI_TITLE), "titre à 7 jours"); }
const n = G.defiStreak.n; t += 3 * 86400000; E.defiState(G); assert.strictEqual(E.defiStreakNow(G), 0, "deux jours manqués remettent la série à zéro"); assert.ok(n > 0);
console.log(`ok - défi : coffre, série (${wins}/9 victoires)`);

// 4 bis. Refonte 1.1 : règles tenues, score, bourses, règle d'équipe, joker, Élite.
{
  const P = E.DEFI_PTS;
  const sc = E.defiScore({ win: true, turns: 20, hp: 50, rules: { a: true, b: false, c: true }, nRooms: 4 });
  assert.strictEqual(sc.score, P.win + 2 * P.rule + (P.par * 4 - 20) * P.turn + 50 * P.hp, "score = victoire + règles + tours + PV");
  assert.strictEqual(E.defiScore({ win: false, turns: 3, hp: 90, rules: {} }).score, 0, "défaite : 0 point");
  assert.strictEqual(E.defiMedal(999), null); assert.strictEqual(E.defiMedal(1000).id, "br"); assert.strictEqual(E.defiMedal(1600).id, "ar"); assert.strictEqual(E.defiMedal(2400).id, "or");
  // règle d'équipe : refusée avant de jouer
  t = Date.UTC(2030, 1, 1, 12, 0); let day = E.defiDay(); let def; for (;; day++) { def = E.defi("dec", day); if (def.team === "max3") break; }
  t = Date.UTC(2030, 1, 1, 12, 0) + (day - E.defiDay()) * 86400000;
  const H = E.newState("Règles", "iop"); H.chars[0].lvl = 50; ["feca", "cra", "sram"].forEach((k, i) => { const x = E.addChar(H, k, "R" + i, 50); x.inTeam = true; });
  assert.ok(/3 héros maximum/.test(E.defiPlay(H, "dec")), "4 héros refusés quand la règle dit 3");
  H.chars[3].inTeam = false; const r = E.defiPlay(H, "dec"); assert.ok(typeof r === "object", "3 héros acceptés");
  assert.deepStrictEqual(Object.keys(r.rules).sort(), def.rules.slice().sort(), "chaque règle du jour a un résultat");
  r.rooms.forEach((x) => assert.deepStrictEqual(x.ch.map((c) => c.id).sort(), def.rules.slice().sort(), "les mêmes règles dans chaque salle"));
  if (r.win) { assert.ok(r.score >= 1000 && r.chest && r.chest.medal >= 1, "bourse à la victoire"); const k0 = H.kamas; const again = E.defiPlay(H, "dec"); assert.ok(!again.chest && H.kamas === k0, "pas deux fois la même bourse"); }
  // joker : un jour manqué par semaine
  const J = E.newState("Joker", "iop"); const d0 = 20000; J.defiStreak = { n: 5, last: d0 - 2, best: 5, days: [] };
  assert.strictEqual(E.defiStreakNow(J, d0), 5, "le joker garde la série");
  J.defiStreak.jw = E.defiWeek(d0 - 1); assert.strictEqual(E.defiStreakNow(J, d0), 0, "un seul joker par semaine");
  // Élite : seulement au niveau 200
  const L = E.newState("Élite", "iop"); L.chars[0].lvl = 199; assert.ok(!E.defiTierOk(L, "eli")); L.chars[0].lvl = 200; assert.ok(E.defiTierOk(L, "eli") && E.defiTierOk(L, "leg")); assert.strictEqual(E.defiTierDefault(L), "leg");
  console.log(`ok - défi 1.1 : score ${r.score} (${r.win ? "victoire" : "défaite"}), règle d'équipe, joker, Élite`);
}

// 4 ter. Série 3 de la refonte : équipe du défi (« Adapter mon équipe »), calendrier des bourses, saison du mois.
{
  t = Date.UTC(2030, 1, 1, 12, 0); let day = E.defiDay(); let def; for (;; day++) { def = E.defi("dec", day); if (def.team === "max3") break; }
  t = Date.UTC(2030, 1, 1, 12, 0) + (day - E.defiDay()) * 86400000;
  const A = E.newState("Adapter", "iop"); A.chars[0].lvl = 40; [["feca", 50], ["cra", 30], ["sram", 45]].forEach(([k, l], i) => { const x = E.addChar(A, k, "A" + i, l); x.inTeam = true; });
  assert.ok(E.defiTeamErr(A, def), "4 héros : règle pas respectée");
  const sug = E.defiSuggest(A, def); assert.deepStrictEqual(sug.map((c) => c.lvl).sort((x, y) => y - x), [50, 45, 40], "les 3 plus forts proposés");
  assert.strictEqual(E.defiSetPick(A, "dec", sug.map((c) => c.id)), null);
  assert.strictEqual(E.defiTeamErr(A, def), null, "l'équipe du défi respecte la règle");
  assert.strictEqual(E.team(A).length, 4, "l'équipe de farm ne change pas");
  const r = E.defiPlay(A, "dec"); assert.ok(typeof r === "object" && r.team.length === 3, "le défi se joue à 3");
  const back = E.defiSim(JSON.parse(E.serialize(A)), def, t); assert.strictEqual(back.turns, r.turns, "le serveur rejoue avec la même équipe du défi");
  if (r.win) assert.strictEqual(A.defiHist[day], r.chest.medal, "le calendrier garde la bourse du jour");
  A.chars[3].inTeam = false; assert.ok(!E.defiPicked(A, def), "équipe réglée à la main : l'équipe du défi ne sert plus");
  assert.ok(typeof E.defiSetPick(A, "dec", [A.chars[0].id, A.chars[1].id, A.chars[2].id, A.chars[3].id]) === "string", "pas d'équipe du défi qui casse la règle");
  t += 86400000; const def2 = E.defi("dec"); A.chars.forEach((c) => (c.inTeam = true));
  assert.ok(!A.defiPick || A.defiPick.day !== def2.day || !E.defiPicked(A, def2), "l'équipe du défi ne vaut que pour son jour");
  // saison : mois, nom, récompenses
  assert.strictEqual(E.defiMonth(E.defiDay(Date.UTC(2026, 9, 15, 12))), 2026 * 12 + 9); assert.strictEqual(E.defiDeMois(2026 * 12 + 9), "d'octobre"); assert.strictEqual(E.defiDeMois(2026 * 12 + 10), "de novembre");
  assert.strictEqual(E.defiMonthEnd(E.defiDay(Date.UTC(2026, 9, 15, 12))), E.defiDay(Date.UTC(2026, 9, 31, 12)));
  const Z = E.newState("Saison", "iop"); const m = 2026 * 12 + 9;
  assert.deepStrictEqual(E.defiSeasonGrant(Z, m, [{ tier: "ave", r: 12 }]), [], "hors du top 10 : rien");
  const got = E.defiSeasonGrant(Z, m, [{ tier: "leg", r: 7 }, { tier: "ave", r: 2 }]);
  assert.strictEqual(got.length, 2); assert.ok(E.titles(Z).includes("Défieur d'octobre") && E.ornUnlocked(Z, "couronneDefi") && E.ORN.couronneDefi.name(Z) === "Couronne d'octobre");
  assert.deepStrictEqual(E.defiSeasonGrant(Z, m, [{ tier: "ave", r: 2 }]), [], "une seule fois par mois");
  console.log("ok - défi 1.1 série 3 : équipe du défi, calendrier, saison");
}

// 4 quater. Série 4 : mode héroïque, vote du dimanche, série en danger, carnet, mois doré.
{
  t = Date.UTC(2030, 2, 4, 12, 0); const day = E.defiDay(); const def = E.defi("dec");
  assert.strictEqual(def.extra.length, 3); assert.ok(def.extra.every((r) => !def.rules.includes(r) && E.CHALLENGES[r]), "3 règles héroïques différentes des règles du jour");
  const X = E.newState("Héroïque", "iop"); X.chars[0].lvl = 50; ["feca", "cra"].forEach((k, i) => { const x = E.addChar(X, k, "X" + i, 50); x.inTeam = true; }); fitTeam(X, def);
  assert.strictEqual(E.defiToggleHero(X, "dec", def.extra[0]), null); assert.strictEqual(E.defiToggleHero(X, "dec", def.extra[1]), null);
  assert.ok(typeof E.defiToggleHero(X, "dec", def.extra[2]) === "string", "2 règles héroïques au plus");
  const r = E.defiPlay(X, "dec"); assert.deepStrictEqual(r.hero, def.extra.slice(0, 2), "les règles héroïques comptent dans le combat");
  if (r.win) { const held = def.extra.slice(0, 2).filter((k) => r.rules[k]).length; assert.strictEqual(r.pts.hero, held * E.DEFI_PTS.hero, "+150 par règle héroïque tenue"); assert.ok(X.defiLog[0].day === day && X.defiLog[0].score === r.score, "carnet du défi"); }
  const back = E.defiSim(JSON.parse(E.serialize(X)), def, t); assert.strictEqual(back.score, r.score, "le serveur rejoue avec les mêmes règles héroïques");
  // vote : 3 règles par semaine, la plus votée devient la 4e règle du dimanche
  let sd = day; while (!E.defiSunday(sd)) sd++; const wk = E.defiWeek(sd); const opts = E.defiVoteOpts(wk);
  assert.strictEqual(new Set(opts).size, 3); assert.strictEqual(E.defiVoteWin(wk), opts[0], "aucun vote : la 1re proposée");
  E.DEFI_VOTE[wk] = { [opts[2]]: 5, [opts[1]]: 3 }; const sun = E.defi("ave", sd);
  assert.strictEqual(sun.rules.length, 4); assert.strictEqual(sun.rules[3], opts[2], "règle votée le dimanche"); assert.ok(sun.rules.slice(0, 3).every((r) => !opts.includes(r)));
  assert.ok(!E.defiVoteOpen(sd) && E.defiVoteOpen(sd - 1)); delete E.DEFI_VOTE[wk];
  // série en danger : moins de 4 h, joker déjà pris
  const Z = E.newState("Danger", "iop"); E.defiState(Z); Z.defiStreak = { n: 5, last: day - 1, best: 5, days: [day - 1], jw: E.defiWeek(day) };
  assert.strictEqual(E.defiDanger(Z), 0, "en pleine journée : pas d'alerte");
  const lateT = Date.UTC(2030, 2, 4, 21, 0); // 22 h à Paris
  assert.ok(E.defiDanger(Z, lateT) > 0, "le soir, joker pris : alerte"); Z.defiStreak.jw = -1; assert.strictEqual(E.defiDanger(Z, lateT), 0, "joker libre : pas d'alerte");
  // mois doré
  const G2 = E.newState("Or", "iop"); G2.defiHist = {}; let m0 = E.defiMonth(day), d0 = day; while (E.defiMonth(d0 - 1) === m0) d0--;
  for (let i = 0; i < 20; i++) G2.defiHist[d0 + i] = 3; assert.strictEqual(E.defiGoldCount(G2, d0 + 20), 20);
  console.log("ok - défi 1.1 série 4 : mode héroïque, vote, série en danger, carnet, mois doré");
}

// 5. Garde-robe : tout ce qu'on possède y entre, on garde l'apparence après avoir vendu l'objet.
const W = E.newState("Garde", "iop");
const coiffe = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "coiffe" && D.ITEMS[k].lvl <= 20);
const it = E.rollItem(W, coiffe, { radiant: false });
assert.ok(E.wardrobe(W)[coiffe], "objet obtenu = apparence obtenue");
delete W.items[it.uid];
assert.ok(E.wardrobe(W)[coiffe], "gardée pour toujours");
const h0 = W.chars[0];
assert.strictEqual(E.setShow(W, h0.id, "coiffe", coiffe), null);
assert.strictEqual(E.shownTpl(W, h0, "coiffe"), coiffe);
assert.strictEqual(E.setShow(W, h0.id, "coiffe", "none"), null); assert.strictEqual(E.shownTpl(W, h0, "coiffe"), null);
const other = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "cape" && !E.wardrobe(W)[k]);
assert.ok(typeof E.setShow(W, h0.id, "cape", other) === "string", "apparence pas encore obtenue");
const old = E.newState("Ancienne", "cra"); const it2 = { uid: 99, tpl: coiffe, stats: {} }; old.items[99] = it2; delete old.wardrobe; delete old.wardrobeInit;
assert.ok(E.wardrobe(old)[coiffe], "à la mise à jour, l'inventaire rejoint la garde-robe");
console.log("ok - garde-robe :", E.WARDROBE_ALL.coiffe.length, "coiffes,", E.WARDROBE_ALL.cape.length, "capes");
console.log("ok - lot Se montrer");
