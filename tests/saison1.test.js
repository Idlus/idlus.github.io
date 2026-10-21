/* Monocompte, Saison 1 « Les Fragments du Temps » (js/saison1.js, lot 1) : date de saison et horloge de test, quota des
   Éclats du Temps (hors ligne et Sablier compris), défis payés une fois, boutique, ni vente directe ni marchand,
   jauge sans Éclats, passage dans l'Éternel, protection des sauvegardes du Classique. Sans navigateur.
   Lancer : node tests/saison1.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js"); require("../js/maitrise_moteur.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/alignement.js"); require("../js/wboss.js"); require("../js/defi.js"); require("../js/koli.js");
require("../js/legendaires.js"); require("../js/dofusp.js"); require("../js/mono.js"); require("../js/monopass.js"); require("../js/monodofus.js"); require("../js/vente.js");
require("../js/saison1.js");
const D = require("../js/data.js");

let seed = 2020;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const DAY = 86400000;
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true; E.dungeonUnlocked = () => true;
const TF = E.MONO.tf, RES = TF.res;
const mono = () => { const S = E.monoStart(E.newState("Héros", "iop")); S.chars[0].lvl = 120; return S; };
const dj = (lvl) => Object.keys(D.DUNGEONS).find((k) => D.DUNGEONS[k].lvl >= lvl);
const at = (S, day) => { now = E.monoT0(S) + (day - 1) * DAY + 3600000; };

// 1. Durées réelles et date de saison.
{
  assert.strictEqual(E.MONO.dur.season, 56 * DAY); assert.strictEqual(E.MONO.dur.manche, 14 * DAY); assert.strictEqual(E.MONO.dur.week, 7 * DAY);
  assert.strictEqual(E.MONO.len, 56 * DAY); assert.strictEqual(E.MONO.jobs.manche, 14 * DAY);
  assert.strictEqual(E.MONO.saisons[1].theme, "Les Fragments du Temps");
  const S = mono(); assert.strictEqual(E.monoDay(S), 1); assert.strictEqual(E.monoManche(S), 1);
  at(S, 15); assert.strictEqual(E.monoManche(S), 2); at(S, 43); assert.strictEqual(E.monoManche(S), 4); assert.strictEqual(E.monoWeek(S), 7);
  at(S, 1);
  console.log("ok - durées réelles 56, 14 et 7 jours");
}

// 2. Horloge de test : sans effet hors partie de test ; parcourt J1 à J56 (4 manches, 8 semaines) sans changer les durées.
{
  const S = mono(); now = E.monoT0(S);
  S.mono.clk = { t: now + 40 * DAY, at: now, spd: 168, pause: false }; // posée à la main, sans le drapeau de test
  assert.strictEqual(E.monoDate(S), now, "hors partie de test, l'horloge est ignorée");
  assert.ok(/partie de test/.test(E.monoClockSet(S, { day: 30 })));
  delete S.mono.clk;
  assert.strictEqual(E.monoTestClock(S, true), null);
  const man = new Set(), wk = new Set();
  assert.strictEqual(E.monoClockSet(S, { spd: 168 }), null);
  for (let h = 0; h < 8 * 24 && !E.monoOver(S); h++) { man.add(E.monoManche(S)); wk.add(E.monoWeek(S)); now += 3600000 / 24; } // 8 heures réelles
  assert.ok(E.monoOver(S), "à ×168, 56 jours de saison passent en 8 heures");
  assert.deepStrictEqual([...man].sort(), [1, 2, 3, 4]); assert.deepStrictEqual([...wk].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.strictEqual(E.MONO.dur.season, 56 * DAY, "les durées réelles ne bougent pas");
  const T = mono(); E.monoTestClock(T, true); assert.strictEqual(E.monoClockSet(T, { day: 29 }), null); assert.strictEqual(E.monoManche(T), 3);
  assert.ok(/avant/.test(E.monoClockSet(T, { day: 10 })), "l'horloge de test n'avance que vers l'avant");
  E.monoClockSet(T, { pause: true }); const t0 = E.monoDate(T); now += 5 * DAY; assert.strictEqual(E.monoDate(T), t0, "pause");
  assert.ok(/Vitesse/.test(E.monoClockSet(T, { spd: 1000 })));
  E.monoTestClock(T, false); assert.strictEqual(E.monoDate(T), now, "coupée, la date de saison redevient la vraie");
  console.log("ok - horloge de test");
}

// 3. Quota d'activité : 20 par jour au plus, 100 par semaine cumulables, 800 en tout ; hors ligne compris.
{
  const S = mono(); at(S, 1); const did = dj(110);
  for (let i = 0; i < 30; i++) E.emit(S, "dungeon", { id: did, stasis: 1 });
  assert.strictEqual(E.tfActTotal(S), TF.ACT.dj.max, "8 donjons par jour");
  const arch = { mons: [{ key: "x", archi: true }], offline: true };
  for (let i = 0; i < 10; i++) E.emit(S, "win", arch); // hors ligne (et Sablier : même chemin) compris
  assert.strictEqual(E.tfActTotal(S), 8 + TF.ACT.arch.max, "archimonstres hors ligne comptés, 4 par jour");
  E.emit(S, "harvest", { n: 1000 }); assert.strictEqual(E.tfActTotal(S), 8 + TF.ACT.arch.max + 4, "métiers : 4 par jour");
  for (let i = 0; i < 5; i++) E.emit(S, "dungeon", { id: did, stasis: 1, group: true }); assert.strictEqual(E.tfActTotal(S), TF.DAYMAX, "20 par jour au plus");
  assert.strictEqual(TF.DAYMAX, 20);
  for (let d = 2; d <= 7; d++) { at(S, d); for (let i = 0; i < 10; i++) { E.emit(S, "dungeon", { id: did, stasis: 1 }); E.emit(S, "win", arch); } E.emit(S, "harvest", { n: 300 }); }
  assert.strictEqual(E.tfActTotal(S), 100, "100 la première semaine");
  // une semaine sans jouer : le quota se cumule
  at(S, 15); for (let i = 0; i < 40; i++) { E.emit(S, "win", arch); E.emit(S, "dungeon", { id: did, stasis: 1, group: true }); E.emit(S, "harvest", { n: 200 }); }
  assert.strictEqual(E.tfActTotal(S), 120);
  // tous les jours jusqu'au bout : jamais plus que le quota du moment, 800 au plus
  for (let d = 16; d <= 56; d++) { at(S, d); for (let i = 0; i < 12; i++) { E.emit(S, "win", arch); E.emit(S, "dungeon", { id: did, stasis: 1, group: true }); } E.emit(S, "harvest", { n: 400 });
    assert.ok(E.tfActTotal(S) <= E.tfQuota(S), `jour ${d} : quota respecté`); }
  assert.ok(E.tfActTotal(S) <= 800);
  console.log(`ok - quota d'activité (${E.tfActTotal(S)} sur la saison)`);
}

// 4. Une dépense ne remet pas le quota à zéro ; défis hors quota ; un palier ne paie qu'une fois.
{
  const S = mono(); at(S, 1); const did = dj(110);
  for (let i = 0; i < 8; i++) E.emit(S, "dungeon", { id: did, stasis: 1 });
  const low = dj(1); for (let i = 0; i < 60; i++) E.emit(S, "dungeon", { id: low, stasis: 1 });
  const d1 = E.tfDefi("d1"); assert.strictEqual(E.tfTier(S, d1), 3);
  const paidDefi = E.tfLedger(S).filter((l) => l.o === "defi").reduce((a, l) => a + l.n, 0);
  assert.strictEqual(paidDefi, 40 + 56 + 64, "bronze, argent, or payés une fois");
  E.tfCheck(S); E.tfCheck(S); assert.strictEqual(E.tfLedger(S).filter((l) => l.o === "defi").length, 3, "pas de double paiement");
  const act0 = E.tfActTotal(S); assert.ok(act0 <= TF.ACT.dj.max);
  E.tfPost(S, 400, "recu", "test:recu", "reçu"); // Éclats reçus (hors quota)
  const bal0 = E.tfBalance(S); assert.strictEqual(E.tfBuy(S, "emb"), null);
  assert.strictEqual(E.tfBalance(S), bal0 - 200, "le prix exact, une seule fois");
  assert.ok(/Déjà/.test(E.tfBuy(S, "emb")), "pas deux fois");
  assert.strictEqual(E.tfActTotal(S), act0, "la dépense ne touche pas le quota");
  assert.strictEqual(S.res[RES], E.tfBalance(S), "le sac montre la copie du registre");
  S.res[RES] = 99999; E.tick(S, 1000); assert.strictEqual(S.res[RES], E.tfBalance(S), "le registre fait foi, pas le sac");
  // défis pas encore ouverts : rien ne compte
  const d4 = E.tfDefi("d4"); E.emit(S, "win", { mons: [{ key: "x", archi: true }] }); assert.strictEqual(E.tfProgress(S, d4), 0, "défi de la manche II fermé au jour 1");
  at(S, 15); E.emit(S, "win", { mons: [{ key: "x", archi: true }] }); assert.strictEqual(E.tfProgress(S, d4), 1);
  at(S, 50); E.emit(S, "win", { mons: [{ key: "x", archi: true }] }); assert.strictEqual(E.tfProgress(S, d4), 2, "rattrapable jusqu'au jour 56");
  assert.strictEqual(TF.TOTAL, 1600); TF.MANCHES.forEach((m, i) => assert.strictEqual(TF.DEFIS.filter((x) => x.m === i).reduce((a, x) => a + E.tfReward(x).reduce((s, v) => s + v, 0), 0), 400));
  const d9 = E.tfDefi("d9"); at(S, 29); E.emit(S, "agression", { win: false }); assert.strictEqual(E.tfProgress(S, d9), 0, "agression perdue : rien");
  E.emit(S, "agression", { win: true }); E.emit(S, "agression", { win: true }); assert.strictEqual(E.tfProgress(S, d9), 2, "défi 9 : agressions gagnées");
  assert.strictEqual(E.tfDefi("d12").n, "Rendez-vous du temps"); assert.deepStrictEqual(E.tfDefi("d9").need, [5, 20, 50]);
  console.log("ok - défis et dépenses");
}

// 5. Boutique : 2 200 en tout ; cosmétique lié au compte (gardé pour la saison suivante), objet de collection échangeable.
{
  assert.strictEqual(TF.SHOP_TOTAL, 2200); assert.deepStrictEqual(TF.SHOP.map((x) => x.p), [200, 300, 350, 600, 250, 500]);
  const S = mono(); at(S, 2); E.tfPost(S, 2200, "recu", "t:1", "reçu");
  TF.SHOP.forEach((x) => assert.strictEqual(E.tfBuy(S, x.id), null, x.id));
  assert.strictEqual(E.tfBalance(S), 0); assert.ok(!S.res[RES], "solde nul : rien dans le sac");
  assert.ok(E.ornUnlocked(S, "tf_orn") && E.sframeOk(S, "tf_cadre") && E.tfWorn(S, "emb") && E.tfWorn(S, "aura"));
  TF.SHOP.filter((x) => x.lie).forEach((x) => assert.strictEqual(x.t !== "Objet de collection", true));
  TF.SHOP.filter((x) => !x.lie).forEach((x) => assert.strictEqual(E.tfState(S).col[x.id], 1, "objet de collection gardé"));
  const L = E.monoLegacy(S); ["tf_emb", "tf_aura", "gift_o_tf_orn", "gift_f_tf_cadre"].forEach((k) => assert.ok(L.u.includes(k), `${k} suit le compte`));
  assert.ok(E.tfSellable("Blé") && !E.tfSellable(RES));
  console.log("ok - boutique");
}

// 6. Ni vente directe ni marchand ni « Garder au maximum » pour les Éclats du Temps.
{
  const S = mono(); E.tfPost(S, 50, "recu", "t:2", "reçu");
  assert.strictEqual(E.resPrice(RES), 0, "pas de prix au jeu (donc pas de « Garder au maximum »)");
  assert.strictEqual(E.venteOk(RES), false, "pas de vente directe");
  const k0 = S.kamas; assert.strictEqual(E.merchantRes(S, RES, 50), 0); assert.strictEqual(S.kamas, k0); assert.strictEqual(E.tfBalance(S), 50, "le marchand ne prend rien");
  S.resCap = S.resCap || {}; S.resCap[RES] = 0; E.tick(S, 1000); assert.strictEqual(E.tfBalance(S), 50);
  assert.ok(E.venteOk("Blé") && E.resPrice("Blé") > 0, "les autres ressources ne changent pas");
  console.log("ok - ni vente directe ni marchand");
}

// 7. Événement final : jauge sans Éclats créés ni dépensés.
{
  const S = mono(); at(S, 49); assert.ok(!E.tfFinOpen(S)); at(S, 50); assert.ok(E.tfFinOpen(S));
  E.tfPost(S, 300, "recu", "t:3", "reçu"); const b0 = E.tfBalance(S), a0 = E.tfActTotal(S);
  for (let d = 50; d <= 56; d++) { at(S, d); E.emit(S, "craft", { tpl: Object.keys(D.ITEMS).find((k) => D.ITEMS[k].lvl < 50 && D.ITEMS[k].craft) }); }
  assert.strictEqual(E.tfFinDays(S), 7);
  assert.strictEqual(E.tfBalance(S) - b0, E.tfActTotal(S) - a0, "seules les activités ordinaires créditent : la jauge ne donne ni ne prend rien");
  assert.ok(!E.tfLedger(S).some((l) => /jauge|fin/i.test(l.o)));
  console.log("ok - jauge finale");
}

// 8. Fin de saison : les Éclats passent dans l'Éternel, Boutique d'Archives, plus de gains ni de défis.
{
  const S = mono(); E.monoTestClock(S, true); E.tfPost(S, 700, "recu", "t:4", "reçu");
  assert.strictEqual(E.monoClockSet(S, { day: 57 }), null); assert.ok(E.monoOver(S));
  E.monoToEternal(S); assert.ok(E.monoEternal(S)); assert.ok(!S.mono.clk && !S.mono.test, "l'horloge de test ne passe pas dans l'Éternel");
  assert.strictEqual(E.tfBalance(S), 700); assert.strictEqual(S.res[RES], 700);
  const T = E.deserialize(E.serialize(S)); assert.strictEqual(E.tfBalance(T), 700, "le registre survit à la sauvegarde");
  E.emit(T, "dungeon", { id: dj(110), stasis: 1 }); assert.strictEqual(E.tfBalance(T), 700, "plus de gains dans l'Éternel");
  assert.strictEqual(E.tfBuy(T, "cri"), null, "Boutique d'Archives"); assert.strictEqual(E.tfBalance(T), 200);
  console.log("ok - Éternel et Boutique d'Archives");
}

// 9. Protection des sauvegardes : le Classique n'a jamais d'Éclats du Temps ; une ancienne partie Monocompte se charge sans perte.
{
  const C = E.newState("Classique", "iop"); C.chars[0].lvl = 120; const before = E.serialize(C);
  E.emit(C, "dungeon", { id: dj(110), stasis: 1 }); E.emit(C, "win", { mons: [{ key: "x", archi: true }] });
  assert.ok(!C.res[RES] && !C.mono, "aucun Éclat du Temps au Classique");
  assert.strictEqual(E.tfBuy(C, "emb"), "La boutique est fermée.");
  C.res[RES] = 5; E.tick(C, 1000); assert.ok(!(RES in C.res), "un Éclat du Temps glissé dans une partie Classique est retiré");
  const once = E.serialize(E.deserialize(before)); const C2 = E.deserialize(once);
  assert.strictEqual(E.serialize(C2), once, "la sauvegarde Classique ne bouge pas en repassant par le chargement");
  assert.ok(!once.includes(RES) && !once.includes('"tf"'), "rien de la Saison 1 dans une sauvegarde Classique");
  assert.ok(!E.tfWorn(C2, "emb"));
  // ancienne partie Monocompte (avant le lot) : pas de registre, tout le reste intact
  const O = mono(); O.kamas = 12345; delete O.mono.tf; const txt = E.serialize(O);
  const O2 = E.deserialize(txt); assert.strictEqual(O2.kamas, 12345); assert.strictEqual(E.tfBalance(O2), 0); assert.deepStrictEqual(O2.chars.map((c) => c.lvl), O.chars.map((c) => c.lvl));
  console.log("ok - sauvegardes protégées");
}

// 10. Joyaux de Maîtrise : 4 % dans le Monocompte, 8 % au Classique.
{
  const n = 20000; let mono4 = 0, cla = 0; const S = mono(), C = E.newState("Classique", "iop");
  for (let i = 0; i < n; i++) { if (E.joyDrop(S, 10, {})) mono4++; if (E.joyDrop(C, 10, {})) cla++; }
  assert.ok(Math.abs(mono4 / n - 0.04) < 0.008, `Monocompte ${(mono4 / n * 100).toFixed(1)} %`);
  assert.ok(Math.abs(cla / n - 0.08) < 0.01, `Classique ${(cla / n * 100).toFixed(1)} %`);
  assert.strictEqual(E.joyRate(10), 0.08, "le taux du Classique ne change pas");
  console.log("ok - joyaux à 4 %");
}
// 11. La date de saison survit au démarrage d'une partie Monocompte (monodofus.js pose E.monoNow = 1 au boot).
{
  const S = mono(); if (E.monoBoot) E.monoBoot(S);
  assert.strictEqual(typeof E.monoDate, "function"); assert.ok(E.monoDate(S) > 0); assert.ok(E.monoDay(S) >= 1);
  console.log("ok - date de saison distincte du drapeau du Dofus de saison");
}
// Registre du serveur (étape 6b, branché par js/mono_online.js) : le solde affiché vient du serveur, les gains partent dans une file,
// l'achat passe par le serveur d'abord ; sans serveur, le registre de la partie reste celui qu'on affiche.
(async () => {
  const S = mono(); at(S, 1); let on = true; const sent = [];
  E.tfSrv = { live: () => on, flush: (s) => { const T = E.tfState(s); sent.push(...T.q.splice(0)); }, buy: async (s, id) => (id === "emb" ? { ok: true, solde: 300, genere: 1, quota: 100, numero: null } : { err: "Il faut 600 Éclats du Temps." }) };
  assert.strictEqual(E.tfActivity(S, "dj"), 1); assert.strictEqual(sent.length, 0, "6a : gain d'activité jamais envoyé (bons de butin du serveur)"); assert.ok(E.tfLedger(S).some((l) => l.src === "act:1:dj"), "ligne du jour gardée pour le serveur");
  E.tfSrvSet(S, { solde: 500, genere: 1, quota: 100, reste: 99, semaine: 1, jour: 1, saison: 0 });
  assert.strictEqual(E.tfBalance(S), 500, "solde du serveur"); assert.strictEqual(S.res[RES], 500, "le sac recopie le solde du serveur");
  E.tfState(S).q = [{ t: "act", k: "arch", n: 2 }]; assert.strictEqual(E.tfBalance(S), 502, "gain pas encore envoyé compté"); assert.strictEqual(E.tfActTotal(S), 3); E.tfState(S).q = [];
  const p = E.tfBuy(S, "emb"); assert.ok(p && p.then, "achat en ligne : une promesse"); assert.strictEqual(await p, null);
  assert.ok(S.unlocks.tf_emb && E.tfState(S).own.emb); assert.strictEqual(E.tfBalance(S), 300, "solde du serveur après l'achat");
  assert.strictEqual(await E.tfBuy(S, "aura"), "Il faut 600 Éclats du Temps."); assert.ok(!S.unlocks.tf_aura, "refus du serveur : rien d'acheté");
  E.tfSrv.buy = async () => { throw new Error("Failed to fetch"); }; assert.match(await E.tfBuy(S, "orn"), /connexion/); assert.ok(!E.tfState(S).own.orn);
  on = false; assert.strictEqual(E.tfBalance(S), 300, "coupure : la dernière copie du serveur reste affichée");
  assert.match(E.tfBuy(S, "sab"), /Connexion au serveur/, "coupure : pas d'achat sans le serveur"); E.tfActivity(S, "arch");
  assert.strictEqual((E.tfState(S).q || []).length, 0, "coupure : rien en file (le serveur paiera d'après la partie)"); assert.strictEqual(E.tfBalance(S), 300);
  const S2 = mono(); at(S2, 1); E.tfActivity(S2, "dj"); assert.strictEqual(E.tfBalance(S2), 1, "partie jamais en ligne : registre de la partie"); assert.ok(!(E.tfState(S2).q || []).length);
  for (let i = 0; i < 4; i++) E.tfPost(S2, 100, "defi", "t" + i); assert.strictEqual(E.tfBuy(S2, "emb"), null, "partie jamais en ligne : achat local, sans promesse");
  E.tfSrv = null;
  console.log("ok - registre du serveur : solde affiché, file des gains, achat fait par le serveur, repli sur la partie");
  console.log("saison1 : tout est bon");
})().catch((e) => { console.error(e); process.exit(1); });
