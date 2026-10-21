/* Bureau des Aventuriers (js/bureau_combat.js), sans base ni navigateur : le combat de groupe joué par le serveur (photos des
   parties validées, règles 1B et 4A), le même combat image par image côté jeu, le butin appliqué une seule fois, la durée du
   combat (js/mono.js : R.t, onTick sans tirage au hasard), la règle du défi 12.
   Le parcours complet avec la base (salons, recherche, transition, triche) : tests/bureau_sql.test.js (IDLUS_PG).
   Lancer : node tests/bureau.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/alignement.js"); require("../js/wboss.js"); require("../js/defi.js"); require("../js/koli.js"); require("../js/mono.js"); require("../js/monopass.js");
const D = require("../js/data.js");
const BC = require("../js/bureau_combat.js");
const VM = require("../js/verify_mono.js");

let seed = 99;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
assert.strictEqual(E.BUREAU, BC, "E.BUREAU");

const DJ = "crypte_kardorim";
const game = (cls, lvl, o = {}) => {
  const S = E.monoStart(E.newState("B" + cls, cls)); E.monoBoot(S);
  const c = S.chars[0]; c.lvl = lvl; c.inTeam = true; E.autoAllocate(S, c); E.refreshSpells(c, E.charStats(S, c));
  E.stasisInfo(S, DJ).max = o.smax == null ? 3 : o.smax;
  if (o.dungeon) S.dungeon = { id: DJ };
  return S;
};
const M = (i, S) => ({ user: "u" + i, data: E.serialize(S) });

// 1. le serveur joue le combat depuis les parties validées ; même graine, même combat
{
  const ms = [M(1, game("iop", 40)), M(2, game("eni", 40)), M(3, game("cra", 40))];
  const t0 = Date.now();
  const AT = now - 30000; // heure du lancement, donnée par la base
  const A = BC.combat(VM, ms, DJ, 2, 1234, AT), B2 = BC.combat(VM, ms, DJ, 2, 1234, AT);
  const ms1 = Date.now() - t0;
  assert.ok(!A.err && !A.exclus, JSON.stringify(A.err || A.exclus));
  assert.strictEqual(A.snaps, B2.snaps); assert.deepStrictEqual(A.R, B2.R, "même photos et même graine : même combat");
  assert.strictEqual(JSON.parse(A.snaps).length, 3); assert.ok(JSON.parse(A.snaps).every((x) => x.lvl === 40 && !x.merc));
  assert.strictEqual(A.cle, D.DUNGEONS[DJ].key);
  assert.ok(A.duree > 0 && A.duree === A.R.t && A.duree % 1000 === 0, "durée en secondes entières de combat");
  assert.ok(A.R.rooms.length >= 1 && A.R.players === 3);
  // l'heure de calcul, les modificateurs de la semaine et le donjon éclair ne changent rien (horloge arrêtée sur l'heure du lancement)
  const w0 = E.weekly; E.weekly = () => ({ id: "x", mods: { dmg: 3 } }); now += 7 * 86400e3;
  const C = BC.combat(VM, ms, DJ, 2, 1234, AT); E.weekly = w0;
  assert.deepStrictEqual(C.R, A.R, "le même combat à toute heure");
  assert.strictEqual(E.now(), now, "horloge du moteur rendue après le combat");
  // côté jeu : le même combat image par image
  now += 3600e3; const V = BC.voir(A.snaps, DJ, 2, 1234, AT);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(BC.resume(V.R))), JSON.parse(JSON.stringify(A.R)), "même combat côté jeu et serveur");
  assert.strictEqual(V.frames.length, A.duree / 1000, "une image par seconde");
  const f0 = BC.image(V, 0), fz = BC.image(V, 1e9);
  const fx = V.frames.find((f) => f.ents.length); assert.ok(f0 && fx, "images du combat");
  assert.ok(fx.ents.filter((e) => e.s === "c").length === 3 && fx.ents.some((e) => e.s === "m"), "les 3 héros et les monstres dans l'image : " + JSON.stringify(fx));
  assert.ok(V.frames.every((f) => f.ents.every((e) => e.hp >= 0 && e.mx >= 1 && e.hp <= e.mx)));
  assert.ok(V.frames.some((f) => f.boss), "salle du boss");
  assert.strictEqual(fz, V.frames[V.frames.length - 1]); assert.strictEqual(BC.image(null, 0), null);
  console.log(`ok - combat du serveur déterministe (${A.R.rooms.length} salles, ${A.duree / 1000} s de combat, ${ms1} ms pour deux calculs), même combat côté jeu`);
}

// 2. règles du départ : 1B (donjon solo), 4A (donjon débloqué, stasis précédente), partie illisible, 2 à 4 joueurs
{
  const ok1 = M(1, game("iop", 40)), ok2 = M(2, game("eni", 40));
  let r = BC.combat(VM, [ok1, M(2, game("eni", 40, { dungeon: true }))], DJ, 1, 5);
  assert.ok(r.exclus && r.exclus.length === 1 && r.exclus[0].user === "u2" && /donjon solo/.test(r.exclus[0].why), "1B : " + JSON.stringify(r));
  r = BC.combat(VM, [ok1, { user: "u9", data: "{pas une partie" }], DJ, 1, 5);
  assert.ok(r.exclus && /pas de héros validé/.test(r.exclus[0].why), "partie illisible");
  const classic = { user: "u8", data: E.serialize(E.newState("Classique", "iop")) };
  assert.ok(/pas de héros validé/.test(BC.combat(VM, [ok1, classic], DJ, 1, 5).exclus[0].why), "partie Classique refusée");
  r = BC.combat(VM, [M(1, game("iop", 40, { smax: 1 })), M(2, game("eni", 40, { smax: 0 }))], DJ, 3, 5);
  assert.ok(r.exclus && r.exclus.length === 2 && /stasis 2/.test(r.exclus[0].why), "4A : personne n'a réussi la stasis 2");
  assert.ok(!BC.combat(VM, [M(1, game("iop", 40, { smax: 2 })), M(2, game("eni", 40, { smax: 0 }))], DJ, 3, 5).exclus, "4A : un seul membre suffit");
  const du0 = E.dungeonUnlocked; E.dungeonUnlocked = (S, did) => S.chars[0].cls !== "eni" && du0(S, did);
  r = BC.combat(VM, [ok1, ok2], DJ, 1, 5); E.dungeonUnlocked = du0;
  assert.ok(r.exclus && /pas encore débloqué/.test(r.exclus[0].why) && r.exclus[0].user === "u2", "4A : donjon débloqué par tous");
  assert.ok(/2 à 4/.test(BC.combat(VM, [ok1], DJ, 1, 5).err)); assert.ok(/2 à 4/.test(BC.combat(VM, [ok1, ok2, ok1, ok2, ok1], DJ, 1, 5).err));
  assert.ok(/inconnu/.test(BC.combat(VM, [ok1, ok2], "pas_un_donjon", 1, 5).err)); assert.ok(/impossible/.test(BC.combat(VM, [ok1, ok2], DJ, 99, 5).err));
  console.log("ok - règles du départ refusées par le serveur : 1B, 4A (débloqué, stasis précédente), partie illisible ou Classique, 2 à 4 joueurs");
}

// 2 bis. les marques testées par BC.renfort sont bien celles que produit le serveur : VM.renfort (js/verify_mono.js, copie
//        prêtée = resume.renfort, rendue par mono_renfort_prendre) et le renfort pris dans une partie (js/monoplus.js)
{
  const A0 = game("cra", 40); const cp = VM.renfort(E, A0);
  assert.ok(cp && cp.rf === 1 && cp.merc === 0 && BC.renfort(cp), "VM.renfort : copie marquée rf, reconnue par BC.renfort (merc = 0 : la marque rf suffit)");
  assert.ok(BC.renfort(JSON.parse(JSON.stringify(cp))), "marque rf gardée après passage en JSON (base, jsonb)");
  // la copie rendue par le serveur portée par le héros (marques renfort + snap posées par E.monoEnterRenfort)
  let S = game("eni", 40); Object.assign(S.chars[0], { renfort: { u: "ami", p: "Ami" }, snap: cp });
  let r = BC.combat(VM, [M(1, game("iop", 40)), M(2, S)], DJ, 1, 5);
  assert.ok(r.exclus && r.exclus[0].user === "u2" && /renfort/.test(r.exclus[0].why), "héros qui porte la copie rendue par le serveur : " + JSON.stringify(r));
  assert.ok(!BC.renfort(E.monoSnap(A0, A0.chars[0])), "la photo d'un vrai héros n'a aucune marque de renfort");
  console.log("ok - marques de renfort : VM.renfort (rf) et E.monoEnterRenfort (renfort, snap) reconnues par BC.renfort");
}

// 3. butin individuel : une seule fois par partie, défi 12 compté avec les autres joueurs
{
  const ms = [M(1, game("iop", 60, { smax: 5 })), M(2, game("eni", 60, { smax: 5 }))];
  let A = null; for (let s = 1; s < 40 && !(A && A.R.done); s++) A = BC.combat(VM, ms, DJ, 1, s);
  assert.ok(A.R.done, "une victoire pour le test du butin");
  const S = game("iop", 60, { smax: 0 }); const lvl0 = S.chars[0].lvl, xp0 = S.chars[0].xp, k0 = S.kamas;
  let ev = null; const emit0 = E.emit; E.emit = function (s, t, d) { if (t === "dungeon") ev = d; return emit0.apply(this, arguments); };
  const b = { combat: 7, did: DJ, stasis: 1, result: JSON.stringify(A.R), ids: ["u2"] };
  const got = BC.butin(S, b); E.emit = emit0;
  assert.ok(got && got.xp > 0, "butin appliqué");
  assert.ok(S.chars[0].lvl > lvl0 || S.chars[0].xp > xp0 || S.kamas > k0);
  assert.strictEqual(BC.butin(S, b), null, "jamais deux fois dans la même partie (deux onglets, retour après coupure)");
  assert.ok(ev && ev.group && ev.ids && ev.ids[0] === "u2" && ev.players === 2, "événement « dungeon » de groupe avec les autres joueurs (défi 12)");
  assert.strictEqual(E.stasisInfo(S, DJ).max, 1, "stasis réussie notée");
  const T = E.deserialize(E.serialize(S)); E.monoBoot(T); assert.strictEqual(BC.butin(T, b), null, "toujours une seule fois après rechargement");
  for (let i = 0; i < 70; i++) BC.butin(S, Object.assign({}, b, { combat: 100 + i }));
  assert.ok(Object.keys(S.mono.gpris).length <= 60, "liste des butins pris bornée");
  assert.strictEqual(BC.butin(E.newState("C", "iop"), b), null, "pas de butin de groupe dans le Classique");
  assert.strictEqual(BC.D12.manche, 4); assert.ok(BC.D12.victoire);
  console.log("ok - butin individuel une seule fois par partie, défi 12 (autres joueurs), Classique intact");
}

// 4. js/mono.js : onTick ne change pas le combat
{
  const snap = (cls) => { const T = E.monoStart(E.newState("G" + cls, cls)); T.chars[0].lvl = 50; return E.monoSnap(T, T.chars[0]); };
  const g = [snap("iop"), snap("feca")];
  let n = 0; const R1 = E.monoGroupRun(g, DJ, 1, 31), R2 = E.monoGroupRun(g, DJ, 1, 31, () => n++);
  assert.strictEqual(JSON.stringify(R1), JSON.stringify(R2), "onTick sans effet sur le combat"); assert.strictEqual(n * 1000, R1.t);
  console.log("ok - E.monoGroupRun : durée R.t et onTick sans tirage au hasard");
}

// 5. triche : un héros prêté en renfort par un ami (copie « rf » rendue par le serveur, mono_social.sql) ne joue jamais dans un
//    groupe de joueurs, même si la partie le présente comme son propre héros
{
  const ok1 = M(1, game("iop", 40));
  const lend = (mut) => { const S = game("cra", 40); mut(S, S.chars[0]); return M(2, S); };
  const cas = {
    "marque rf sur le héros": (S, c) => { c.rf = 1; },
    "marque renfort sur le héros": (S, c) => { c.renfort = { u: "u7" }; },
    "copie d'ami à la place du héros (snap)": (S, c) => { c.snap = Object.assign(E.monoSnap(S, c), { rf: 1 }); },
    "renfort sans héros à soi": (S, c) => { c.merc = true; c.renfort = { u: "u7" }; c.snap = E.monoSnap(S, c); },
  };
  for (const k in cas) {
    const r = BC.combat(VM, [ok1, lend(cas[k])], DJ, 1, 5);
    assert.ok(r.exclus && r.exclus.some((x) => x.user === "u2" && /renfort|pas de héros validé/.test(x.why)) && !r.snaps, `${k} : ${JSON.stringify(r).slice(0, 200)}`);
  }
  // l'ami qui joue lui-même son héros reste accepté ; un renfort à côté du héros (mercenaire) n'entre jamais dans la photo
  const S3 = game("eni", 40); const fr = E.monoStart(E.newState("Ami", "sram")); fr.chars[0].lvl = 40;
  S3.chars.push(Object.assign(JSON.parse(JSON.stringify(fr.chars[0])), { id: 999, merc: true, renfort: { u: "u7" }, snap: Object.assign(E.monoSnap(fr, fr.chars[0]), { rf: 1 }) }));
  const r = BC.combat(VM, [ok1, M(3, S3)], DJ, 1, 5);
  assert.ok(!r.exclus && !r.err, JSON.stringify(r.exclus || r.err));
  assert.ok(JSON.parse(r.snaps).every((x) => !BC.renfort(x) && x.id !== 999) && JSON.parse(r.snaps).length === 2, "photos : seulement le héros de chaque compte");
  console.log("ok - triche : héros prêté en renfort refusé dans le groupe (4 cas), renfort à côté du héros jamais photographié");
}
