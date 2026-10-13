/* Fondations du multijoueur : horloge réglable, hasard rejouable, liste des actions, sauvegarde.
   Lancer : node tests/core.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
const SV = require("../js/save.js");
const D = require("../js/data.js");
const firstSub = D.ZONES[0].subs[0].id;

const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 1. L'horloge du jeu est réglable : la partie lit l'heure imposée, pas celle de l'appareil.
const T0 = Date.UTC(2030, 0, 7, 12, 0, 0);
E.setClock(() => T0);
assert.strictEqual(E.now(), T0);
assert.strictEqual(E.newState("Horloge", "iop").created, T0, "la partie neuve doit prendre l'heure du jeu");
console.log("ok - horloge du jeu réglable");

// 2. Même hasard + même horloge = exactement la même partie (le serveur pourra rejouer).
function run() {
  let t = T0; E.setClock(() => t); E.setRng(mulberry(777));
  const S = E.newState("Rejeu", "cra");
  assert.strictEqual(E.act(S, "startHunt", firstSub), null);
  for (let i = 0; i < 20 * 60 * 4; i++) { t += 250; E.tick(S, 250); }
  return E.serialize(S);
}
const a = run(), b = run();
assert.ok(JSON.parse(a).stats.fights > 5, "trop peu de combats");
assert.strictEqual(a, b, "deux parties rejouées avec le même hasard et la même horloge diffèrent");
console.log("ok - partie rejouable à l'identique (20 min de chasse)");

// 3. La liste des actions : toutes existent, prennent la partie en premier, le reste est refusé.
for (const k in E.ACTIONS) assert.strictEqual(typeof E[k], "function", `action ${k} introuvable dans le moteur`);
const S0 = E.newState("Actions", "iop");
assert.ok(/inconnue/.test(E.act(S0, "serialize")), "une fonction hors liste doit être refusée");
assert.ok(/inconnue/.test(E.act(S0, "constructor")), "un nom piégé doit être refusé");
console.log(`ok - ${Object.keys(E.ACTIONS).length} actions du joueur`);

// 4. Sauvegarde avec un support factice (comme le serveur demain).
const mem = {}; SV.useStore({ get: (k) => (k in mem ? mem[k] : null), set: (k, v) => { mem[k] = v; return true; }, del: (k) => { delete mem[k]; } });
SV.init({ key: "test-save", version: "9.9.9", engine: E });
assert.strictEqual(SV.load().state, null, "aucune partie au départ");
const S1 = E.newState("Sauve", "iop");
assert.ok(SV.write(E.serialize(S1), S1));
assert.strictEqual(SV.copies().length, 1, "première écriture : une copie automatique");
assert.strictEqual(SV.load().state.chars[0].name, "Sauve");
SV.beforeUpdate(S1, null); assert.strictEqual(mem["test-save-version"], "9.9.9");
mem["test-save"] = "illisible";
const r = SV.load(); assert.ok(r.state && r.restored, "partie illisible : la copie doit prendre le relais");
SV.remove(); assert.strictEqual(SV.read(), null);
const tr = SV.load(E.serialize(S1)); assert.ok(tr.transferred && tr.state, "reprise depuis l'ancienne adresse");
console.log("ok - sauvegarde (écriture, copies, partie illisible, reprise)");

// Quête « Dévotion » : une offrande à l'Almanax faite AVANT d'arriver à l'étape compte (0.1.29.5).
{
  E.setClock(() => T0);
  const S = E.newState("Devotion", "iop"); E.refreshSystems(S);
  const stepAlm = E.MAIN_QUEST.findIndex((q) => q.t === "almanax");
  S.almanax = { day: E.dayKey(), kind: "xp", pct: 15 }; // offrande déjà faite aujourd'hui
  S.quest = { step: stepAlm, prog: 0 };                  // le joueur arrive ensuite à l'étape
  const L = E.deserialize(E.serialize(S));               // chargement du jeu
  assert.ok(L.quest.step > stepAlm, "l'étape Dévotion doit être validée par l'offrande du jour");
  console.log("ok - offrande du jour déjà faite : étape Dévotion validée");
}

// Fabrication en série (0.1.30.1) : ×N = N fabrications une par une (jets séparés), limitée par les ressources et le sac.
{
  E.setClock(() => T0);
  const S = E.newState("Serie", "iop");
  const tpl = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].craft && D.ITEMS[t].lvl <= 3);
  const T = D.ITEMS[tpl];
  T.craft.ing.forEach(([r, q]) => E.addRes(S, r, q * 7));
  assert.strictEqual(E.craftCount(S, "tpl", tpl), 7, "7 exemplaires possibles");
  const before = E.itemCount(S); const r = E.craftMany(S, "tpl", tpl, 10);
  assert.strictEqual(r.n, 7, "s'arrête quand les ressources manquent"); assert.ok(r.err, "raison de l'arrêt");
  assert.strictEqual(E.itemCount(S) - before, 7, "7 objets dans le sac"); assert.strictEqual(new Set(r.items.map((it) => it.uid)).size, 7, "7 objets distincts");
  assert.strictEqual(E.craftCount(S, "tpl", tpl), 0); assert.strictEqual(typeof E.craftMany(S, "tpl", tpl, 10), "string", "plus rien à fabriquer");
  console.log("ok - fabrication en série");
}

// 0.1.35 : jusqu'à 12 héros (8 en équipe au plus) et congédier un héros
{
  const S = E.newState("Réserve", "iop"); S.kamas = 1e9; S.chars[0].lvl = 120;
  const cls = ["cra", "eni", "sram", "feca", "osa", "xelor", "panda", "sadi", "enu", "eca", "roub"];
  cls.forEach((k) => assert.strictEqual(E.recruit(S, k, k), null, `recrutement ${k}`));
  assert.strictEqual(S.chars.length, 12); assert.strictEqual(E.recruit(S, "iop", "Treize"), null, "13e héros accepté");
  assert.strictEqual(S.chars.length, 13); assert.ok(/13 héros au plus/.test(E.recruit(S, "iop", "Trop")), "14e héros refusé");
  E.dismiss(S, S.chars[12].id); assert.strictEqual(S.chars.length, 12);
  assert.strictEqual(E.team(S).length, 8); assert.strictEqual(E.activeCount(S), 8, "4 héros au repos, pas 12 en équipe");
  assert.strictEqual(S.recLv, 12 * 60, "niveaux donnés par les recrutements");
  const rest = S.chars.find((c) => !c.inTeam); assert.ok(/8 héros au plus/.test(E.toggleTeam(S, rest.id)), "équipe pleine");
  // un récolteur rappelé quand l'équipe est pleine va au repos
  const fighter = E.team(S)[1]; assert.strictEqual(E.setJob(S, fighter.id, "paysan"), null);
  assert.strictEqual(E.toggleTeam(S, rest.id), null, "une place s'est libérée");
  assert.strictEqual(E.setJob(S, fighter.id, null), null); assert.strictEqual(fighter.inTeam, false, "rappelé au repos");
  assert.strictEqual(E.activeCount(S), 8);
  // congédier : objets au sac, moitié du prix rendue, prochain recrutement moins cher
  const it = Object.keys(S.items)[0]; const out = S.chars.find((c) => !c.inTeam && !c.job);
  if (it) out.equip.coiffe = +it; S.mainHero = out.id; S.training = out.id;
  const k0 = S.kamas, refund = Math.floor(E.recruitCost(12) / 2);
  assert.strictEqual(E.dismiss(S, out.id), null);
  assert.strictEqual(S.chars.length, 11); assert.strictEqual(S.kamas - k0, refund, "moitié du prix rendue");
  if (it) assert.ok(S.items[it] && !S.chars.some((c) => Object.values(c.equip).includes(+it)), "l'objet revient au sac");
  assert.strictEqual(S.training, null); assert.ok(S.chars.some((c) => c.id === S.mainHero), "nouveau héros principal");
  assert.strictEqual(E.recruitCost(S.chars.length + 1), E.recruitCost(12), "le prochain recrutement redevient moins cher");
  const solo = E.newState("Seul", "iop"); assert.ok(/au moins un héros/.test(E.dismiss(solo, solo.chars[0].id)), "dernier héros gardé");
  // classement : les 8 meilleurs héros
  const V = require("../js/verify.js"); const sum = V.summary(E, S);
  const best8 = S.chars.map((c) => c.lvl + (c.ren || 0) * 200).sort((a, b) => b - a).slice(0, 8).reduce((a, n) => a + n, 0);
  assert.strictEqual(sum.level, best8); assert.strictEqual(sum.heroes.length, 11); assert.strictEqual(sum.rec, S.recLv);
  console.log("ok - 12 héros, 8 en équipe, congédier un héros");
}

// 0.1.37 : sac de 1 000 places, Coffre de trop-plein (rien n'est perdu), « Briser les doublons »
{
  E.setRng(mulberry(37)); const S = E.newState("Sac", "iop");
  assert.strictEqual(E.itemCap(S), 1000);
  const tpl = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].lvl === 20 && D.ITEMS[k].slot === "coiffe");
  for (let i = 0; i < 1000 - E.itemCount(S); ) E.rollItem(S, tpl, { radiant: false });
  const last = E.rollItem(S, tpl, { radiant: false }); E.rollItem(S, tpl, { radiant: false });
  E.tick(S, 10);
  assert.strictEqual(E.itemCount(S), 1000, "le sac reste à sa taille");
  assert.strictEqual(S.over.length, 2, "les deux objets en trop sont dans le trop-plein");
  assert.ok(S.over.some((o) => o.uid === last.uid), "les plus récents vont au trop-plein");
  assert.ok(/Sac plein/.test(E.overTake(S, last.uid)), "reprendre un objet : sac plein");
  // trop-plein plein : le plus ancien est brisé
  for (let i = 0; i < E.overCap(S); i++) E.rollItem(S, tpl, { radiant: false });
  const runes0 = Object.values(S.runes).reduce((a, b) => a + b, 0);
  E.bagFlush(S);
  assert.strictEqual(S.over.length, E.overCap(S)); assert.ok(!S.over.some((o) => o.uid === last.uid), "le plus ancien a été brisé");
  assert.ok(Object.values(S.runes).reduce((a, b) => a + b, 0) > runes0, "il a rendu des runes");
  // briser les doublons : garde le meilleur jet, rien d'autre
  const r = E.breakDupes(S);
  const left = Object.values(S.items).filter((it) => it.tpl === tpl);
  assert.ok(r.n > 500 && left.filter((it) => !E.isPerfect(it)).length <= 1, "il reste le meilleur jet (et les objets parfaits)");
  assert.strictEqual(E.dupesList(S).length, 0);
  assert.strictEqual(E.overTake(S, S.over[0].uid), null, "reprendre un objet quand il y a de la place");
  const b = E.overBreakAll(S); assert.ok(b.n > 0 && S.over.length === 0);
  // la sauvegarde garde le trop-plein
  E.rollItem(S, tpl); for (let i = E.itemCount(S); i <= 1000; i++) E.rollItem(S, tpl, { radiant: false }); E.bagFlush(S);
  const S2 = E.deserialize(E.serialize(S)); assert.strictEqual(S2.over.length, S.over.length);
  console.log("ok - sac de 1 000 places, trop-plein, doublons");
}
// 0.1.38 : fin de la vente au jeu (marchand de secours, achats du jour, règles qui brisent)
{
  E.setRng(mulberry(38)); const S = E.newState("Vente", "iop");
  assert.ok(!E.ACTIONS.sellItem && !E.ACTIONS.sellRes && E.ACTIONS.gameBuySell, "plus de vente au jeu dans les actions");
  assert.strictEqual(S.settings.auto.action, "break"); assert.strictEqual(S.settings.auto.recycle, "break");
  const old = E.deserialize(E.serialize(Object.assign(S, { settings: Object.assign({}, S.settings, { auto: { action: "sell", q: 50, recycle: "sell" } }) })));
  assert.strictEqual(old.settings.auto.action, "break", "règle « vendre » devenue « briser »"); assert.strictEqual(old.settings.auto.recycle, "break");
  // marchand de secours : 30 % de la valeur
  const r = "Laine de Bouftou"; S.res[r] = 1000; const k0 = S.kamas; E.merchantRes(S, r, 100);
  assert.strictEqual(S.kamas - k0, Math.floor(E.resPrice(r) * 100 * 0.3)); assert.strictEqual(S.res[r], 900);
  // 0.1.54 : commandes du jour : une par tranche de 20 niveaux jusqu'au meilleur héros, 2 000 chacune, payées selon son niveau
  S.chars[0].lvl = 185;
  const G = E.gameBuys(S); assert.strictEqual(G.list.length, 10); assert.strictEqual(new Set(G.list.map((o) => o.res)).size, 10);
  assert.deepStrictEqual(E.gameBuys(S).list.map((o) => o.res), G.list.map((o) => o.res), "même liste dans la journée");
  G.list.forEach((o, b) => { assert.strictEqual(o.lo, b * 20 + 1); assert.strictEqual(o.max, 2000); assert.strictEqual(o.price, Math.round(0.375 * 185)); });
  const o = G.list[2]; S.res[o.res] = 2250; const k1 = S.kamas;
  assert.strictEqual(E.act(S, "gameBuySell", o.res, 300), null);
  assert.strictEqual(S.kamas - k1, 300 * o.price); assert.strictEqual(S.res[o.res], 1950);
  assert.strictEqual(E.act(S, "gameBuyAll"), null, "tout livrer");
  assert.strictEqual(S.res[o.res], 250); assert.strictEqual(S.kamas - k1, 2000 * o.price);
  assert.ok(E.act(S, "gameBuySell", o.res, 10), "commande déjà livrée");
  assert.ok(E.act(S, "gameBuySell", "Ressource inconnue", 1), "ressource non commandée refusée");
  assert.ok(E.act(S, "gameBuyAll"), "rien à livrer");
  S.chars[0].lvl = 30; assert.strictEqual(E.gameBuys(S).list.length, 2, "pas de tranche au-dessus du meilleur héros");
  // boutique de la maison et agrandissements
  S.kamas = 2e6; assert.strictEqual(E.roomSlots(S, "atelier"), 2); assert.ok(E.act(S, "growRoom", "atelier"), "l'atelier ne s'agrandit pas"); const sl = E.roomSlots(S, "biblio");
  assert.strictEqual(E.act(S, "growRoom", "biblio"), null); assert.strictEqual(E.roomSlots(S, "biblio"), sl + 1); assert.ok(S.kamas < 1.6e6, "500 000 kamas payés");
  assert.strictEqual(E.growCost(S, "biblio"), 1e6); assert.ok(E.act(S, "growRoom", "enclos"), "l'enclos ne s'agrandit pas");
  const xp0 = E.furnBonus(S, "xp"); S.kamas = 2e6; const kf = S.kamas; assert.strictEqual(E.act(S, "buyFurn", "Pupitre de lecture"), null);
  assert.ok(E.isPlaced(S, "Pupitre de lecture"), "placé tout de suite"); assert.strictEqual(E.furnBonus(S, "xp"), xp0 + 1); assert.ok(S.kamas <= kf - 500000 + 50000, "500 000 kamas payés"); S.kamas = 1e6;
  assert.ok(E.act(S, "buyFurn", "Pupitre de lecture"), "déjà acheté"); assert.ok(E.act(S, "buyFurn", "Planétarium d'Osamodas"), "pas assez de kamas");
  S.kamas = 9e6; assert.strictEqual(E.act(S, "buyFurn", "Établi d'artisan"), null); assert.strictEqual(E.furnBonus(S, "atelier"), 15);
  const back = E.deserialize(E.serialize(S)); assert.strictEqual(E.roomSlots(back, "biblio"), sl + 1); assert.ok(E.isPlaced(back, "Pupitre de lecture"));
  console.log("ok - commandes du jour et boutique de la maison :", G.list.map((x) => `${x.lo}-${x.hi} ${x.res}`).join(", "));
}

// 0.1.37.1 : enchaîner des donjons, « course n sur N », « Arrêter après celui-ci »
{
  E.setClock(() => T0);
  const S = E.newState("Chaîne", "iop"); const did = Object.keys(D.DUNGEONS)[0]; const key = D.DUNGEONS[did].key;
  const keep = E.dungeonUnlocked; E.dungeonUnlocked = () => true;
  S.res[key] = 5;
  assert.ok(/Aucun/.test(E.stopChain(S)), "hors donjon, rien à arrêter");
  assert.strictEqual(E.act(S, "enterDungeon", did, 1, 5), null);
  assert.deepStrictEqual([S.dungeon.chain, S.dungeon.tot, S.dungeon.run], [5, 5, 1]);
  assert.strictEqual(E.act(S, "stopChain"), undefined);
  assert.strictEqual(S.dungeon.chain, 1); assert.strictEqual(S.dungeon.tot, 5);
  assert.ok(/Aucun/.test(E.stopChain(S)), "déjà le dernier");
  assert.strictEqual(S.res[key], 4, "une seule clé utilisée");
  E.dungeonUnlocked = keep;
  console.log("ok - enchaînement de donjons et arrêt après le donjon en cours");
}

// 0.1.50.1 : renommer un héros (premier changement gratuit, ensuite 50 000 kamas) et filtre des noms
{
  const S = E.newState("Tristepin", "iop"); const c = S.chars[0]; S.kamas = 60000;
  assert.ok(D.NAMES.every((n) => !E.nameBad(n)), "aucun nom au hasard n'est refusé");
  assert.ok(E.nameBad("Merde2Bouftou") && E.nameBad("X3n3r") && !E.nameBad("Kap Dofus") && !E.nameBad("Stupde"));
  assert.strictEqual(E.renameChar(S, c.id, "Merde"), "Ce nom n'est pas autorisé.");
  assert.strictEqual(E.renameChar(S, c.id, "  Tristepin   le Brave "), null);
  assert.strictEqual(c.name, "Tristepin le Brave"); assert.strictEqual(S.kamas, 60000, "premier changement gratuit");
  assert.strictEqual(E.renameChar(S, c.id, "Tristepin le Brave"), null); assert.strictEqual(S.kamas, 60000, "même nom : rien ne se passe");
  assert.strictEqual(E.renameChar(S, c.id, "Goultard"), null); assert.strictEqual(S.kamas, 10000);
  assert.ok(/Il te manque/.test(E.renameChar(S, c.id, "Tristepin"))); assert.strictEqual(c.name, "Goultard");
  assert.ok(E.renameChar(S, c.id, "x".repeat(21)));
  S.kamas = 1e6; assert.strictEqual(E.recruit(S, "cra", "Pute du 92"), "Ce nom n'est pas autorisé."); assert.strictEqual(S.chars.length, 1);
  console.log("ok - renommer un héros et filtre des noms");
}

/* 0.1.55 : Autel des Douze, plafonds relevés */
{
  const S = E.newState("Autel", "iop");
  assert.strictEqual(E.capOf(S, "xp"), 175, "plafond d'XP de base");
  assert.strictEqual(E.capOf(S, "kamas"), 200, "plafond de kamas de base");
  S.kamas = 100; assert.ok(E.buyAltar(S), "pas assez de kamas");
  S.kamas = 1e9; assert.strictEqual(E.buyAltar(S), null); assert.strictEqual(S.kamas, 1e9 - 500000, "premier niveau à 500 000");
  assert.strictEqual(E.capOf(S, "drop"), 180, "+5 par niveau");
  for (let i = 0; i < 20; i++) E.buyAltar(S);
  assert.strictEqual(E.altarLvl(S), 15, "15 niveaux au plus");
  assert.strictEqual(E.capOf(S, "xp"), 250); assert.strictEqual(E.capOf(S, "kamas"), 275); assert.strictEqual(E.capOf(S, "offtime"), E.BONUS_CAP.offtime, "le hors ligne ne bouge pas");
  S.havre.xp = 50; S.align = { side: "bonta", order: "esprit", lvl: 100, xp: 0 };
  assert.strictEqual(E.bonusRaw(S, "xp"), 115); assert.strictEqual(E.bonus(S, "xp"), 115);
  assert.deepStrictEqual(E.bonusParts(S, "xp").map((p) => [p.k, p.v]), [["havre", 100], ["align", 15]]);
  console.log("ok autel des douze");
}

{
  // 1.0.3.1 : la Baguette Rikiki en arme (Sculpteur) ouvre aussi la Planque des Vilinsekts, et l'accès reste
  const S = E.newState("Rikiki", "iop"); S.progress.bossKills.crypte_kardorim = 1;
  assert.strictEqual(E.subUnlocked(S, "ast_planque"), false, "lieu caché fermé au départ");
  const tpl = Object.keys(D.ITEMS).find((t) => D.ITEMS[t].name === "Baguette Rikiki");
  S.items[999999] = { uid: 999999, tpl, stats: {} };
  assert.strictEqual(E.subUnlocked(S, "ast_planque"), true, "l'arme doit ouvrir la planque");
  delete S.items[999999];
  assert.strictEqual(E.subUnlocked(S, "ast_planque"), true, "l'accès doit rester après la vente");
  const S2 = E.newState("Rikiki2", "iop"); S2.progress.bossKills.crypte_kardorim = 1; S2.res["Baguette Rikiki"] = 1;
  assert.strictEqual(E.subUnlocked(S2, "ast_planque"), true, "la baguette du Bricoleur ouvre toujours");
  console.log("ok baguette rikiki");
}
