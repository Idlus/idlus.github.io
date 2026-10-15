/* 1.0.30 « Place à l'optimisation » : heures de donjon (donjon pendant l'absence) et expéditions, sans navigateur.
   Lancer : node tests/idle.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/legendaires.js"); require("../js/songe.js"); require("../js/koli.js");
require("../js/expeditions.js"); require("../js/suivi.js"); require("../js/vie.js"); require("../js/quetes.js");
const D = require("../js/data.js");

let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
let seed = 777; const rng = () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; E.setRng(rng);
const subU = E.subUnlocked; E.subUnlocked = () => true; const dgU = E.dungeonUnlocked; E.dungeonUnlocked = () => true;
E.weekly = () => null; E.flash = () => [];
const H1 = 3600 * 1000;
const party = (lvl, n = 4) => { const S = E.newState("Idle", "iop"); S.chars[0].lvl = lvl; S.chars[0].pts = (lvl - 1) * 5; E.autoAllocate(S, S.chars[0]); ["eni", "feca", "cra", "sacri", "osa", "enu", "sram"].slice(0, n - 1).forEach((k, i) => { E.addChar(S, k, "H" + i, lvl); }); return S; };

/* ---------- 1. Heures de donjon : banque ---------- */
{
  const S = party(40);
  const H = E.dgh(S);
  assert.strictEqual(H.b, 2 * 3600, "2 h en banque au départ");
  assert.strictEqual(H.on, true, "« Continuer quand je pars » est actif par défaut");
  t += 24 * H1; E.dgh(S); assert.strictEqual(H.b, 4 * 3600, "+2 h le lendemain");
  t += 5 * 24 * H1; E.dgh(S); assert.strictEqual(H.b, 8 * 3600, "gardées jusqu'à 8 h");
  const d = H.d; t -= 3 * 24 * H1; E.dgh(S); t += 3 * 24 * H1; E.dgh(S); assert.strictEqual(H.d, d, "horloge reculée puis revenue : pas de nouveau crédit"); assert.strictEqual(H.b, 8 * 3600);
  console.log("ok - heures de donjon : +2 h par jour, 8 h au plus");
}

/* ---------- 2. mesure des vraies courses, puis donjon pendant l'absence ---------- */
const did = "cour_bouftou_royal"; const dg = D.DUNGEONS[did];
const played = party(42);
played.res[dg.key] = 6; E.stasisInfo(played, did).max = 1;
let n0 = 0;
for (let i = 0; i < 4 * 3600 * 4 && (played.progress.bossKills[did] || 0) < 3; i++) { if (!played.dungeon) { assert.strictEqual(E.enterDungeon(played, did, 1, 1), null); n0++; } t += 250; E.tick(played, 250); }
{
  const rec = E.dgh(played).st[did + ":1"];
  assert.ok(rec && rec.n >= 3, "les courses jouées sont mesurées"); assert.ok(rec.s > 30 && rec.s < 3600, "durée d'une course mesurée : " + rec.s); assert.ok(rec.w > 0.5, "réussite mesurée");
  const est = E.dghEst(played, did, 1); assert.strictEqual(est.src, "mesure");
  console.log(`ok - mesure : ${rec.n} courses, ${rec.s} s par course, ${Math.round(rec.w * 100)} % de réussite`);
}
{
  const S = E.deserialize(E.serialize(played)); E.stasisInfo(S, did).best[1] = 999;
  const H = E.dgh(S); H.b = 8 * 3600; H.did = did; H.k = 1; S.res[dg.key] = 3;
  const kills = S.progress.bossKills[did]; const k0 = S.kamas; let drops = 0; const dd = E.dofusDrop;
  E.dofusDrop = function (S2, d2, k2) { drops++; assert.strictEqual(d2, did); assert.strictEqual(k2, 1, "même stasis qu'en jeu"); return dd.apply(this, arguments); };
  const r = E.dghRun(S, 8 * 3600, 0.25, {}); E.dofusDrop = dd;
  assert.strictEqual(r.keys, 3, "une clé par course"); assert.strictEqual(r.runs, 3); assert.strictEqual(S.res[dg.key] || 0, 0);
  assert.strictEqual(r.why, "keysout", "arrêt faute de clés");
  assert.strictEqual(S.progress.bossKills[did] - kills, r.wins, "boss comptés");
  assert.strictEqual(drops, r.wins, "le Dofus est tiré par E.dofusDrop une fois par victoire, comme en jeu");
  assert.ok(S.kamas > k0 && r.kamas === S.kamas - k0, "kamas gagnés");
  assert.ok(H.b < 8 * 3600 && H.b > 0, "heures consommées seulement pour les courses faites");
  assert.strictEqual(E.stasisInfo(S, did).best[1], 999, "le record de temps n'est pas touché");
  assert.ok(H.last && H.last.runs === 3, "compte rendu gardé pour la page des donjons");
  console.log(`ok - donjon pendant l'absence : ${r.runs} courses, ${r.wins} victoires, ${E.hrsTxt(r.used)} utilisées`);
}
{
  const S = E.deserialize(E.serialize(played)); const H = E.dgh(S); H.b = 8 * 3600; H.did = did; H.k = 1; S.res[dg.key] = 5;
  assert.strictEqual(E.dghRun(S, 10 * 60, 0.25, {}).why, "short", "absence de 10 min : rien"); assert.strictEqual(H.b, 8 * 3600); assert.strictEqual(S.res[dg.key], 5);
  E.stasisInfo(S, did).max = 0; const r = E.dghRun(S, 8 * 3600, 0.25, {}); assert.strictEqual(r.why, "stasis", "stasis jamais réussie : pas de donjon hors ligne"); assert.strictEqual(S.res[dg.key], 5);
  E.stasisInfo(S, did).max = 1; H.on = false; assert.strictEqual(E.dghRun(S, 8 * 3600, 0.25, {}), null, "désactivé");
  H.on = true; H.did = null; assert.strictEqual(E.dghRun(S, 8 * 3600, 0.25, {}), null, "aucun donjon choisi ni en cours");
  assert.strictEqual(E.dghTarget(S, { id: did, stasis: 1 }).did, did, "sans choix : le donjon en cours au départ");
  assert.strictEqual(E.dghSet(S, { did, k: 4 }), "Stasis 4 pas encore réussie.");
  console.log("ok - donjon pendant l'absence : absence courte, stasis non réussie, désactivé");
}
/* intégré à E.catchUp : le donjon d'abord, puis la chasse sur le reste ; rendement hors ligne */
{
  const base = E.deserialize(E.serialize(played)); base.dungeon = null; E.startHunt(base, "inc_cimetiere");
  const S1 = E.deserialize(E.serialize(base)); E.dgh(S1).on = false;
  const S2 = E.deserialize(E.serialize(base)); const H = E.dgh(S2); H.b = 8 * 3600; H.did = did; H.k = 1; S2.res[dg.key] = 4;
  const r1 = E.catchUp(S1, 8 * 3600); const r2 = E.catchUp(S2, 8 * 3600);
  assert.ok(!r1.dg, "sans heures de donjon : rien de changé");
  assert.ok(r2.dg && r2.dg.runs === 4, "4 courses avec 4 clés"); assert.ok(r2.fights < r1.fights, "la chasse ne prend que le reste de l'absence");
  assert.ok(Math.abs(r2.dg.rate - E.offRate(S2)) < 1e-9, "au rendement hors ligne");
  console.log(`ok - absence de 8 h : ${r2.dg.runs} courses (${E.hrsTxt(r2.dg.used)}) puis ${r2.fights} combats de chasse (au lieu de ${r1.fights})`);
}

/* ---------- 3. Expéditions ---------- */
const S = party(60, 8); E.addChar(S, "xelor", "Horloge", 58); E.addChar(S, "enu", "Pièce", 61); E.addChar(S, "feca", "Bouclier", 55); E.addChar(S, "osa", "Fouet", 50);
const bench = S.chars.filter((c) => !E.team(S).includes(c));
assert.strictEqual(bench.length, 4, "4 héros hors de l'équipe");
{
  const b1 = JSON.stringify(E.misBoard(S)); S.mis.day = -1; const b2 = JSON.stringify(E.misBoard(S));
  assert.strictEqual(b1, b2, "le tableau du jour est toujours le même ce jour-là");
  const B = E.misBoard(S); assert.strictEqual(B.length, E.MIS.board);
  B.forEach((m) => { assert.ok(E.MIS_TYPES[m.t] && E.SUBS[m.sub], "mission valide"); const s = E.SUBS[m.sub]; assert.ok(m.lvl >= s.lvl[0] && m.lvl <= Math.min(200, s.lvl[1]), "niveau dans la zone"); assert.ok(m.req.length >= 2, "au moins deux exigences"); });
  assert.ok(new Set(B.map((m) => m.sub)).size === B.length, "une zone différente par mission");
  assert.ok(Object.keys(E.MIS_TYPES).every((k) => E.MIS_TYPES[k].h >= 4 && E.MIS_TYPES[k].h <= 12), "de 4 à 12 h");
  let pools = 0; B.forEach((m) => E.misItemPool(m).forEach((tpl) => { pools++; assert.ok(!D.ITEMS[tpl].dofus && D.ITEMS[tpl].slot !== "dofus", "jamais de Dofus"); }));
  assert.ok(pools > 0);
  console.log("ok - tableau du jour : 8 missions, mêmes missions toute la journée, jamais de Dofus");
}
{
  const B = E.misBoard(S); const tm = E.team(S)[0];
  assert.ok(/dans l'équipe/.test(E.misSend(S, tm.id, B[0].id)), "un héros de l'équipe ne part pas");
  const [a, b, c, d] = bench; const fit = (h) => B.find((m) => m.taken == null && E.misInfo(S, h, m).ok);
  E.setTraining(S, d.id); assert.strictEqual(S.training, d.id);
  for (const h of [a, b, c]) { const m = fit(h); assert.ok(m, "une mission à sa portée"); assert.strictEqual(E.misSend(S, h.id, m.id), null); }
  assert.ok(/places/.test(E.misSend(S, d.id, fit(d).id)), "3 places");
  E.kamas = 0; S.kamas = E.MIS.roomCost; assert.strictEqual(E.misBuildRoom(S), null); assert.strictEqual(E.misSlots(S), 4, "la Salle des cartes donne une 4e place");
  if (E.koliToggle) { // équipe d'arène : un héros en expédition n'y entre pas, un héros de l'arène ne part pas
    const Q = E.koliState(S); const t0 = Q.team.slice(); Q.team = Q.team.filter((id) => id !== a.id);
    assert.ok(/expédition/.test(E.koliToggle(S, a.id) || ""), "un héros en expédition n'entre pas dans l'équipe d'arène");
    Q.team = [d.id]; assert.ok(/arène/.test(E.misSend(S, d.id, (fit(d) || B[0]).id) || ""), "un héros de l'équipe d'arène ne part pas"); Q.team = t0; }
  assert.strictEqual(E.misSend(S, d.id, fit(d).id), null); assert.strictEqual(S.training, null, "le héros quitte la salle d'entraînement");
  // un héros en mission ne fait rien d'autre
  assert.ok(/expédition/.test(E.toggleTeam(S, a.id)), "pas d'équipe"); assert.ok(!a.inTeam);
  assert.ok(/expédition/.test(E.setJob(S, a.id, "paysan")), "pas de récolte");
  assert.ok(/expédition/.test(E.setTraining(S, a.id)), "pas d'entraînement");
  assert.ok(/expédition/.test(E.dismiss(S, a.id)), "pas de départ");
  assert.ok(/expédition/.test(E.act(S, "toggleTeam", a.id)), "par les actions du joueur aussi");
  S.comps = [{ ids: [a.id, tm.id], rows: {}, auto: true, focus: "auto", name: "x" }]; assert.ok(/expédition/.test(E.applyComp(S, 0).err), "pas de composition");
  // rappel : la mission revient au tableau
  const run = E.misRun(S, d.id); assert.strictEqual(E.misRecall(S, d.id), null); assert.ok(!E.misRun(S, d.id)); assert.strictEqual(B.find((m) => m.id === run.m.id).taken, null);
  console.log("ok - expéditions : héros hors de l'équipe seulement, 3 places (+1), héros indisponible pendant la mission, rappel");
}
{
  // retour : réussite (tirage 0) puis échec (tirage 0,99) : un quart
  const runs = S.mis.runs.slice(); assert.strictEqual(runs.length, 3);
  const [r1, r2] = runs; const c1 = S.chars.find((x) => x.id === r1.cid), c2 = S.chars.find((x) => x.id === r2.cid);
  r1.t1 = t - 1; const R1 = E.misReward(S, c1, r1.m); const k1 = S.kamas; const key0 = r1.m.key ? S.res[r1.m.key] || 0 : 0;
  E.setRng(() => 0); E.misTick(S);
  const L1 = S.mis.log[0]; assert.ok(L1 && L1.ok, "mission réussie"); assert.strictEqual(L1.kamas, R1.kamas); assert.ok(S.kamas - k1 >= R1.kamas, "kamas versés (plus un éventuel succès de niveau)");
  if (r1.m.key && R1.keys) assert.strictEqual((S.res[r1.m.key] || 0) - key0, R1.keys, "clés de la zone");
  assert.ok(!E.misRun(S, c1.id), "le héros est revenu"); assert.ok(!/expédition/.test(E.toggleTeam(S, c1.id) || ""), "et peut de nouveau rejoindre l'équipe (ici pleine)");
  r2.t1 = t - 1; const R2 = E.misReward(S, c2, r2.m); const k2 = S.kamas; E.setRng(() => 0.99); E.tick(S, 250); E.setRng(rng);
  const L2 = S.mis.log[0]; assert.ok(L2 && !L2.ok && L2.cid === c2.id, "mission ratée, terminée pendant le jeu (E.tick)"); assert.strictEqual(L2.kamas, Math.round(R2.kamas * E.MIS.fail), "un quart des kamas"); assert.ok(S.kamas - k2 >= L2.kamas); assert.ok(!L2.item && !L2.keys, "ni objet ni clé");
  console.log(`ok - retour d'expédition : réussie +${L1.kamas} kamas, ratée +${L2.kamas} kamas (un quart)`);
}
{
  // retours pendant l'absence : dans le compte rendu de E.catchUp
  const r3 = S.mis.runs[0]; assert.ok(r3); t += 13 * H1;
  const r = E.catchUp(S, 13 * 3600); assert.ok(r.mis && r.mis.some((x) => x.cid === r3.cid), "retour d'expédition dans le compte rendu de l'absence");
  assert.strictEqual(S.mis.runs.length, 0);
  console.log("ok - expédition terminée pendant l'absence");
}
{
  // chance : niveau, caractéristiques, élément, classe ; jamais au-dessus de 95 %
  const c = S.chars.find((x) => x.cls === "xelor"); const st = E.charStats(S, c); const el = E.heroEl(S, c, st);
  const m = { t: "fouille", sub: "inc_cimetiere", lvl: c.lvl, req: [{ k: "st", s: "ini", v: 1 }, { k: "el", e: el }, { k: "cls", c: ["xelor"] }], key: null };
  const hi = E.misChance(S, c, m); assert.ok(hi >= 0.8 && hi <= 0.95, "exigences remplies : " + hi);
  const lo = E.misChance(S, c, Object.assign({}, m, { req: [{ k: "st", s: "ini", v: 99999 }, { k: "el", e: el === "t" ? "f" : "t" }, { k: "cls", c: ["iop"] }] }));
  assert.ok(lo < hi - 0.4, "exigences ratées : bien moins de chances");
  assert.ok(E.misChance(S, c, Object.assign({}, m, { lvl: c.lvl + 10 })) < hi, "mission plus haute : moins de chances");
  console.log(`ok - chance de réussite : ${Math.round(hi * 100)} % exigences remplies, ${Math.round(lo * 100)} % sinon`);
}
{
  // équilibrage (garde-fou, voir tools/idle_sim.js) : au mieux, une expédition rapporte bien moins en kamas qu'un héros qui chasse (équipe de 8)
  const HUNT = { 20: 7965, 50: 30221, 80: 59223, 110: 66616, 140: 79761, 170: 82267, 195: 102068 };
  for (const L in HUNT) {
    const c = { lvl: +L, cls: "iop", ren: 0 }; const T = E.MIS_TYPES.patrouille; const Lm = Math.min(200, +L + E.misGap(+L));
    const R = E.misReward(S, null, { t: "patrouille", lvl: Lm, req: [], key: "x" }); const ev = 0.95 + 0.05 * E.MIS.fail;
    const kh = R.kamas / (1 + E.bonus(S, "kamas") / 100) * ev / T.h; assert.ok(kh < 0.8 * HUNT[L], `niveau ${L} : ${Math.round(kh)} k/h contre ${HUNT[L]}`); void c;
  }
  console.log("ok - garde-fou d'équilibrage des expéditions");
}
{
  // sauvegarde : gardé tel quel ; une ancienne partie reçoit les champs vides au chargement
  const S2 = E.deserialize(E.serialize(S)); assert.deepStrictEqual(S2.mis.log.length, S.mis.log.length); assert.strictEqual(S2.dgh.b, S.dgh.b);
  const o = JSON.parse(E.serialize(S)); delete o.mis; delete o.dgh; const S3 = E.deserialize(JSON.stringify(o));
  assert.ok(S3.mis && Array.isArray(S3.mis.runs) && S3.dgh && S3.dgh.b === 2 * 3600, "migration : champs créés au chargement");
  const S4 = E.deserialize(E.serialize(S3)); assert.strictEqual(E.serialize(S4), E.serialize(E.deserialize(E.serialize(S4))), "idempotent");
  console.log("ok - sauvegarde et chargement d'une partie d'avant la 1.0.30");
}
E.subUnlocked = subU; E.dungeonUnlocked = dgU;
console.log("idle : tout est bon");
