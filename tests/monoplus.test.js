/* Monocompte « Saison plus » (js/monoplus.js) : Serment de fer (choix, passage au fer jusqu'au niveau 20, abandon, Sablier
   et mercenaire bloqués, compteur d'aides), renfort d'un ami (à la place du mercenaire, sans gain), mutation de la semaine
   (rotation, semaines suivantes, stasis 7 et plus, Classique jamais touché, défi de groupe payé une fois dans le quota),
   bilan de fin de saison (carte, texte pour Discord, aura de fer gardée dans l'Éternel). Sans navigateur.
   Lancer : node tests/monoplus.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/alignement.js"); require("../js/wboss.js"); require("../js/defi.js"); require("../js/koli.js");
require("../js/legendaires.js"); require("../js/dofusp.js"); require("../js/mono.js"); require("../js/monopass.js"); require("../js/monodofus.js"); require("../js/vente.js");
require("../js/saison1.js"); require("../js/honneur.js"); require("../js/monoalign.js"); require("../js/monoplus.js");
const VM = require("../js/verify_mono.js"); // Bouclier Monocompte : copie du héros pour le renfort, renfort vérifié
const D = require("../js/data.js");

let seed = 77;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const DAY = 86400000;
let now = Date.UTC(2030, 0, 7, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true; E.dungeonUnlocked = () => true;
const MU = E.MONO.mut;
const mono = (lvl = 15) => { const S = E.monoStart(E.newState("Héros", "iop")); S.chars[0].lvl = lvl; E.monoBoot(S); return S; };
const dj = (lvl) => Object.keys(D.DUNGEONS).find((k) => D.DUNGEONS[k].lvl >= lvl);
const enter = (S, did, k, merc) => { const SI = E.stasisInfo(S, did); SI.max = Math.max(SI.max, k - 1); S.res[D.DUNGEONS[did].key] = (S.res[D.DUNGEONS[did].key] || 0) + 1; return E.monoEnter(S, did, k, merc); };
const fightOf = (S) => { for (let t = 0; !S.fight && t < 60000; t += 500) E.tick(S, 500); return S.fight; };
const finish = (S) => { for (let t = 0; S.dungeon && t < 3 * 3600 * 1000; t += 1000) E.tick(S, 1000); };

// 1. Serment de fer : choix au début de la saison, passage au fer jusqu'au niveau 20, abandon sans retour
{
  const S = mono(12);
  assert(E.monoOathPending(S), "le serment se choisit au début de la saison");
  assert.strictEqual(E.monoSwear(S, "ord"), null); assert.strictEqual(E.monoSerment(S), "ord"); assert(!E.monoOathPending(S));
  assert.strictEqual(E.monoSwear(S, "fer"), null, "passage au fer depuis l'ordinaire, niveau 12"); assert(E.monoFer(S) && E.monoFerOk(S));
  assert.match(E.monoSwear(S, "ord"), /Renoncer/);
  // Sablier fermé, rien n'est compté ; le mercenaire est refusé
  S.sablier = { r: 3 * 3600, at: now, spd: 1, open: true };
  assert.match(E.sabSet(S, 2), /Serment de fer/); S.sablier.spd = 3; S.dungeon = { id: dj(10), room: 0 };
  assert.strictEqual(E.sabSpend(S, 60000), 1, "sous serment : pas de temps accéléré"); assert.strictEqual(S.sablier.spd, 1); S.dungeon = null;
  S.kamas = 1e6; assert.match(enter(S, dj(10), 1, "eni"), /pas de mercenaire/); assert.strictEqual(S.kamas, 1e6);
  assert.deepStrictEqual(E.monoAide(S), { sab: 0, merc: 0, ren: 0 });
  assert(E.ferWorn(S), "aura de fer portée sous serment");
  // abandon à tout moment : on perd le classement et l'aura, Sablier et mercenaire reviennent ; pas de retour au fer
  assert.strictEqual(E.monoOathBreak(S), null); assert(!E.monoFer(S) && !E.monoFerOk(S) && !E.ferWorn(S));
  assert(S.mono.serment.rompu > 0); assert.match(E.monoSwear(S, "fer"), /ne se reprête pas/);
  assert.strictEqual(E.sabSet(S, 2), null);
  // compteur fiable : chaque seconde accélérée est comptée
  S.sablier.spd = 2; S.dungeon = { id: dj(10), room: 0 }; const m = E.sabSpend(S, 30000); S.dungeon = null;
  assert(m > 1); assert.strictEqual(E.monoAide(S).sab, 30, "30 s réelles à ×2 = 30 s accélérées");
}
{ // au-dessus du niveau 20, ou après une aide : plus de passage au fer
  const S = mono(21); assert.match(E.monoSwear(S, "fer"), /niveau 20/);
  const T = mono(20); T.kamas = 1e6; assert.strictEqual(enter(T, dj(1), 1, "cra"), null); assert.strictEqual(E.monoAide(T).merc, 1, "mercenaire compté");
  finish(T); assert(!T.chars.some((c) => c.merc), "le mercenaire repart");
  assert.match(E.monoSwear(T, "fer"), /déjà reçu de l'aide/);
  const C = E.newState("Classique", "iop"); assert.match(E.monoSwear(C, "fer"), /saison du Monocompte/); assert.strictEqual(E.monoSerment(C), null);
}

// 2. Renfort d'un ami : la copie de son héros à la place du mercenaire, sans gain ; l'un ou l'autre
{
  const F = mono(60); F.chars[0].name = "Ami"; E.autoAllocate(F, F.chars[0]); E.refreshSpells(F.chars[0], E.charStats(F, F.chars[0]));
  const snap = E.monoSnap(F, F.chars[0]); assert(E.monoSnapOk(snap));
  const S = mono(55); S.kamas = 5e5; const k0 = S.kamas;
  const R = { u: "00000000-0000-0000-0000-000000000002", p: "Ombrelune", snap };
  const did = dj(40);
  assert.strictEqual(enter(S, did, 1, { ami: R }), null);
  const rc = S.chars.find((c) => c.merc); assert(rc && rc.renfort && rc.renfort.p === "Ombrelune" && rc.snap, "renfort dans l'équipe");
  assert.strictEqual(S.chars.filter((c) => c.merc).length, 1, "un seul : pas de mercenaire en plus");
  assert.strictEqual(S.kamas, k0, "le renfort ne coûte rien");
  assert.strictEqual(E.monoPlayers(S, E.team(S)), 1.5, "compte pour un demi-joueur, comme le mercenaire");
  const xp0 = rc.xp || 0; finish(S);
  assert(!S.chars.some((c) => c.merc), "le renfort repart à la fin du donjon"); assert.strictEqual(rc.xp || 0, xp0, "aucun gain pour la copie");
  assert.strictEqual(E.monoAide(S).ren, 1, "renfort compté dans les aides");
  // copie construite par le serveur (Bouclier, résumé de la partie validée) : jamais d'identifiant de partie, marquée « rf »
  const SV = VM.renfort(E, F); assert(E.monoSnapOk(SV) && SV.rf === 1 && SV.hid === F.chars[0].id && SV.id === undefined && SV.n === "Ami", "copie du serveur");
  assert.strictEqual(VM.resume(E, F, {}).renfort.cls, F.chars[0].cls, "la copie est dans le résumé de la partie validée");
  assert.match(E.monoGroupSetup([E.monoSnap(S, S.chars[0]), SV], did, 1).err, /Pas de renfort/, "renfort en groupe : refusé");
  // Bouclier : un renfort dans la partie doit être une copie rendue par le serveur à ce compte (mono_renfort_prendre)
  { const B = mono(55); B.kamas = 5e5; const RS = { u: R.u, p: "Ombrelune", snap: SV }; assert.strictEqual(enter(B, did, 1, { ami: RS }), null);
    const ctx = { debut: now - 2 * DAY, date: now };
    const imp = (c) => VM.withClock(E, B, c, () => null) || VM.impossible(E, B, c, +B.nextUid || 0);
    assert.strictEqual(imp(Object.assign({ renforts: [{ u: R.u, snap: JSON.parse(JSON.stringify(SV)) }] }, ctx)), null, "copie du serveur : acceptée");
    assert.strictEqual(imp(Object.assign({ renforts: [] }, ctx)), "renfort d'un ami qui ne vient pas du serveur", "aucune copie rendue : refusé");
    assert.strictEqual(imp(Object.assign({ renforts: [{ u: "autre", snap: SV }] }, ctx)), "renfort d'un ami qui ne vient pas du serveur", "copie d'un autre ami : refusé");
    const rc2 = B.chars.find((c) => c.merc); rc2.snap.st.hpMax *= 10; // copie forgée dans la partie
    assert.strictEqual(imp(Object.assign({ renforts: [{ u: R.u, snap: SV }] }, ctx)), "renfort d'un ami qui ne vient pas du serveur", "copie forgée : refusé");
    E.setClock(() => now); } // le Bouclier remet l'horloge du moteur à zéro après sa vérification
  // trop fort, photo illisible, sous serment
  assert.match(enter(mono(30), did, 1, { ami: R }), /trop fort/);
  assert.match(enter(mono(60), did, 1, { ami: { u: "x", snap: { cls: "??" } } }), /pas disponible/);
  const T = mono(10); E.monoSwear(T, "fer"); assert.match(enter(T, dj(1), 1, { ami: Object.assign({}, R, { snap: Object.assign({}, snap, { lvl: 10 }) }) }), /pas de renfort/);
}

// 3. Mutation de la semaine : rotation, semaines suivantes, stasis 7 et plus seulement, jamais au Classique
{
  assert(MU.list.length >= 6, "au moins 6 règles"); assert.strictEqual(new Set(MU.list.map((m) => m.id)).size, MU.list.length);
  assert.strictEqual(MU.list[0].n, "Sève tenace"); assert.deepStrictEqual([MU.list[0].fx.regen, MU.list[0].fx.dot], [3, 1.25], "Sève tenace : +3 % de PV soignés par tour, poisons +25 %");
  const wk = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => E.monoMutAt(1, w).id); assert.strictEqual(new Set(wk).size, 8, "8 semaines, 8 règles différentes");
  assert.notStrictEqual(E.monoMutAt(2, 1).id, E.monoMutAt(1, 1).id, "décalée d'une saison à l'autre");
  const S = mono(150); const T0 = E.monoT0(S);
  now = T0 + 2 * 7 * DAY + 3600000; assert.strictEqual(E.monoMutWeek(S), 3, "semaine de la partie hors connexion");
  assert.strictEqual(E.monoMutOf(S).id, E.monoMutAt(1, 3).id);
  assert.deepStrictEqual(E.monoMutNext(S).map((x) => x.w), [4, 5], "les deux semaines suivantes annoncées");
  now = T0 + 7 * 7 * DAY + 3600000; assert.deepStrictEqual(E.monoMutNext(S).map((x) => x.w), [], "semaine 8 : rien après");
  now = T0 + 2 * 7 * DAY + 3600000;
  // semaine du serveur quand la partie est en ligne
  MU.srv = { s: 1, semaine: 6 }; const live0 = E.tfSrv; E.tfSrv = { live: () => true, flush: () => {} };
  assert.strictEqual(E.monoMutWeek(S), 6, "semaine de saison du serveur"); E.tfSrv = live0; MU.srv = null;
  // combats : stasis 6 sans mutation ; stasis 7 avec ; le Classique jamais
  const did = dj(140);
  assert.strictEqual(enter(S, did, 6), null); assert(fightOf(S) && !S.fight.mut, "stasis 6 : pas de mutation"); E.leaveDungeon ? E.leaveDungeon(S) : (S.dungeon = null); S.fight = null;
  const S7 = mono(150); assert.strictEqual(enter(S7, did, 7), null); fightOf(S7);
  assert.strictEqual(S7.fight.mut, E.monoMutOf(S7).id, "stasis 7 : mutation de la semaine");
  const C = E.newState("Classique", "iop"); C.chars[0].lvl = 150; const SI = E.stasisInfo(C, did); SI.max = 8; C.res[D.DUNGEONS[did].key] = 1;
  assert.strictEqual(E.enterDungeon(C, did, 8), null); fightOf(C); assert(C.fight && !C.fight.mut && C.dungeon.mut === undefined, "Classique : jamais de mutation");
  // effets : Sève tenace soigne les monstres et renforce les poisons ; Temps compté retire 2 PA aux héros
  MU.force = "seve"; const S2 = mono(150); enter(S2, did, 8); fightOf(S2);
  const m = S2.fight.ents.find((e) => e.side === "m" && e.alive); m.hp = Math.round(m.hpMax / 2); m.dots = [{ v: 100, turns: 2 }]; const h0 = m.hp;
  E.mutTurn(S2.fight, m); assert.strictEqual(m.dots[0].v, 125, "poison +25 %"); assert(m.hp > h0 && m.hp - h0 <= Math.round(m.hpMax * 0.03) + 1, "soin de 3 % des PV");
  E.mutTurn(S2.fight, m); assert.strictEqual(m.dots[0].v, 125, "le poison n'est renforcé qu'une fois");
  MU.force = "compte"; const S3 = mono(150); enter(S3, did, 8); fightOf(S3);
  const h = S3.fight.ents.find((e) => e.side === "c" && !e.summon); assert.strictEqual(h.st.pa, Math.max(3, E.charStats(S3, S3.chars[0]).pa - 2), "Temps compté : 2 PA de moins");
  for (let i = 0; i < 20 && !S3.fight.mutH; i++) E.step(S3); assert(S3.fight.mutH, "dégâts des héros posés au premier tour");
  MU.force = null; const S4 = mono(150); enter(S4, did, 8); fightOf(S4); for (let i = 0; i < 20 && !S4.fight.dmgInit; i++) E.step(S4);
  const h4 = S4.fight.ents.find((e) => e.side === "c" && !e.summon); assert.strictEqual(h.dmgBonus - h4.dmgBonus, 60, "Temps compté : +60 % de dégâts, après le calcul du premier pas");
  // groupe : la mutation de la partie chargée, ou celle donnée
  MU.force = undefined; MU.cur = "miroir"; const sn = [E.monoSnap(S3, S3.chars[0])];
  assert.strictEqual(E.monoGroupSetup(sn, did, 9).S2.dungeon.mut, "miroir"); assert.strictEqual(E.monoGroupSetup(sn, did, 9, "verre").S2.dungeon.mut, "verre"); assert.strictEqual(E.monoGroupSetup(sn, did, 6).S2.dungeon.mut, null);
  MU.cur = null;
}

// 4. Défi de groupe de la semaine : 5 donjons de stasis 7+ en groupe, 20 Éclats une fois, dans le quota
{
  const S = mono(150); now = E.monoT0(S) + 3600000; // semaine 1 : quota de 100
  const X0 = E.monoMutDefi(S); assert.deepStrictEqual([X0.n, X0.need, X0.gain, X0.src], [0, 5, 20, "s1-w1-mut"]);
  const did = dj(140);
  for (let i = 0; i < 4; i++) E.emit(S, "dungeon", { id: did, stasis: 7, group: true, players: 2, with: ["Ombrelune"] });
  E.emit(S, "dungeon", { id: did, stasis: 6, group: true }); E.emit(S, "dungeon", { id: did, stasis: 9 }); // stasis 6, ou seul : pas compté
  assert.strictEqual(E.monoMutDefi(S).n, 4); const b0 = E.tfBalance(S);
  E.emit(S, "dungeon", { id: did, stasis: 8, group: true, with: ["Ombrelune"] });
  assert(E.monoMutDefi(S).paid > 0, "défi réussi"); assert.strictEqual(E.tfLedger(S).filter((l) => l.src === "act:1:mut").reduce((a, l) => a + l.n, 0), 20, "20 Éclats d'activité");
  const b1 = E.tfBalance(S); E.emit(S, "dungeon", { id: did, stasis: 8, group: true }); assert.strictEqual(E.tfLedger(S).filter((l) => l.src === "act:1:mut").reduce((a, l) => a + l.n, 0), 20, "payé une seule fois");
  assert(b1 - b0 >= 20); assert(E.tfActTotal(S) <= E.tfQuota(S), "dans le quota");
  // quota déjà rempli : rien de plus (la règle des 800 tient)
  const T = mono(150); now = E.monoT0(T) + 3600000; E.tfPost(T, 100, "act", "act:plein", "test");
  for (let i = 0; i < 5; i++) E.emit(T, "dungeon", { id: did, stasis: 7, group: true });
  assert.strictEqual(E.tfActTotal(T), 100, "quota plein : le défi ne crée rien");
  // serveur : le gain part au registre (activité « mut », source unique de la semaine)
  const V = mono(150); now = E.monoT0(V) + 3600000; const live0 = E.tfSrv; let flushed = 0; E.tfSrv = { live: () => true, flush: () => flushed++ };
  for (let i = 0; i < 5; i++) E.emit(V, "dungeon", { id: did, stasis: 7, group: true });
  // 6a : rien dans la file : la ligne « act:<jour>:mut » du registre provisoire devient des bons de butin à la partie validée
  assert.deepStrictEqual((E.tfState(V).q || []).filter((o) => o.k === "mut"), []); E.tfSrv = live0; void flushed;
  assert.strictEqual(E.tfLedger(V).filter((l) => l.src === "act:1:mut").reduce((a, l) => a + l.n, 0), 20, "ligne du jour pour le serveur");
  assert.deepStrictEqual(VM.acts(E, V).filter((a) => a.k === "mut"), [{ j: 1, k: "mut", n: 20 }], "le Bouclier en fait des bons (activité mut)");
  assert.strictEqual(S.mono.grpWith.Ombrelune, 5, "groupe principal suivi");
}

// 5. Bilan de fin de saison et passage dans l'Éternel
{
  const S = mono(14); E.monoSwear(S, "fer"); S.chars[0].name = "Xener"; S.chars[0].lvl = 200;
  const T = E.tfState(S); T.d.d1 = { p: 60, paid: 3 }; T.d.d2 = { p: 50, paid: 1 };
  S.mono.grpWith = { "Ombrelune": 12, "Krokmou": 3 };
  let B = E.monoBilan(S, { rang_grp: 4, couronnes: 2 });
  assert.deepStrictEqual([B.nom, B.lvl, B.fer, B.defis, B.defisOr, B.defisTot, B.rangGrp, B.couronnes, B.groupe.n], ["Xener", 200, true, 2, 1, 12, 4, 2, "Ombrelune"]);
  const txt = E.monoBilanText(B);
  assert(/Xener/.test(txt) && /Iop de fer/.test(txt) && /Défis réussis : 2 \/ 12/.test(txt) && /4e du classement/.test(txt) && /2 semaines couronné/.test(txt) && /Ombrelune/.test(txt), txt);
  assert(!/https?:\/\/(?!idlus\.github\.io)/.test(txt), "aucun autre lien");
  now = E.monoEnd(S) + 1000; assert(E.monoOver(S));
  const got = E.monoToEternal(S); assert(got);
  assert.strictEqual(S.mono.eternel.fer, 1); assert(S.unlocks.fer_aura, "aura de fer gardée dans l'Éternel"); assert(E.ferWorn(S));
  assert(S.mono.eternel.bilan && S.mono.eternel.bilan.fer && S.mono.eternel.bilan.lvl === 200, "carte du bilan gardée");
  assert(E.monoLegacy(S).u.includes("fer_aura"), "aura de fer gardée pour la saison suivante (droit du compte)");
  // sans serment tenu : pas d'aura
  const N = mono(14); E.monoSwear(N, "ord"); now = E.monoEnd(N) + 1000; E.monoToEternal(N);
  assert(!N.mono.eternel.fer && !(N.unlocks || {}).fer_aura && !E.ferWorn(N));
  // la sauvegarde garde tout (aller-retour)
  const S2 = E.deserialize(E.serialize(S)); assert.deepStrictEqual(S2.mono.serment, S.mono.serment); assert.deepStrictEqual(S2.mono.aide, S.mono.aide);
}

// 6. Classique : rien ne change (pas de serment, pas d'aide comptée, pas de mutation)
{
  const C = E.newState("Classique", "iop"); C.sablier = { r: 3600, at: now, spd: 2, open: true }; C.dungeon = { id: dj(10), room: 0 };
  assert.strictEqual(E.sabSpend(C, 10000), 2); assert(!C.mono, "aucune donnée Monocompte dans une partie Classique"); C.dungeon = null;
  assert.strictEqual(E.monoBilan(C), null); assert.strictEqual(E.monoMutOf(C), null); assert(!E.ferWorn(C));
}
console.log("ok - Saison plus : Serment de fer (choix, niveau 20, abandon, Sablier et mercenaire bloqués, aides comptées), renfort sans gain, mutation de la semaine (8 règles, stasis 7+, jamais au Classique), défi de groupe dans le quota, bilan et aura de fer");
