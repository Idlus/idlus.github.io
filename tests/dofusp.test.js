/* Les passifs des Dofus (1.0.16) : 31 passifs, un par Dofus, en plus des caractéristiques ; gains d'équipe une seule
   fois ; Éveil des Dragons ; Kolizéum à moitié ; aucun effet sur les chances d'obtenir un Dofus. Sans navigateur.
   Lancer : node tests/dofusp.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/koli.js"); require("../js/legendaires.js"); require("../js/dofusp.js");
const D = require("../js/data.js"); const { ITEMS } = D;

let seed = 4242;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);
E.subUnlocked = () => true;
const team = (L, cls = ["iop", "eni", "feca", "cra"]) => { const S = E.newState("Dof", cls[0]); S.chars[0].lvl = L; cls.slice(1).forEach((k, i) => { const c = E.addChar(S, k, "H" + i, L); c.inTeam = true; }); S.chars.forEach((c) => { c.inTeam = true; E.refreshSpells(c, E.charStats(S, c)); }); return S; };
const wear = (S, c, ids) => ids.forEach((id, i) => { const it = E.rollItem(S, "dofus_" + id, { radiant: false }); assert.strictEqual(E.equip(S, c.id, it.uid, D.DOFUS_SLOTS[i]), null, "équiper " + id); });
const hunt = (S, lvl) => { const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] <= lvl).sort((a, b) => b.lvl[0] - a.lvl[0])[0]; assert.ok(!E.startHunt(S, sub.id)); for (let i = 0; i < 40 && !S.fight; i++) { now += 1000; E.tick(S, now); } assert.ok(S.fight, "un combat"); return S.fight; };

// 1. Un passif par Dofus : nom, texte, famille, déclencheur et rôle connus ; les caractéristiques des Dofus ne bougent pas.
{
  assert.strictEqual(E.DOFUS_ORDER.length, 35);
  E.DOFUS_ORDER.forEach((id) => { const P = E.DOFP_LIST[id]; assert.ok(P, "passif de " + id);
    assert.ok(E.dofpName(id).length > 2 && E.dofpTxt(id).length > 10, "texte " + id);
    assert.ok(E.DOFP_FAMS.includes(E.dofpFam(id)), "famille " + id); assert.ok(E.dofpTrig(id), "déclencheur " + id); assert.ok(E.DOFP_FOR[E.dofpForKey(id)], "rôle " + id); });
  assert.strictEqual(new Set(E.DOFUS_ORDER.map((id) => E.dofpName(id))).size, 35, "35 noms différents");
  assert.strictEqual(E.DOFP_PRIM.length, 6); assert.ok(E.DOFP_PRIM.every((id) => E.DOFUS[id]));
  assert.ok(Object.keys(ITEMS.dofus_vulbis.stats).length > 0, "le Vulbis garde ses caractéristiques");
  assert.ok(!/\d,\d0/.test(E.DOFUS_ORDER.map((id) => E.dofpTxt(id, true) + E.dofpTxt(id, false, true)).join(" ")), "nombres propres");
  console.log("ok - dofus : 35 passifs");
}

// 2. Portés : sans doublon, sur l'entité de combat, Éveil des Dragons avec les 6 primordiaux.
{
  const S = team(200); const [a, b] = S.chars;
  wear(S, a, ["vulbis", "ocre", "ivoire"]); const dup = E.rollItem(S, "dofus_ocre", {}); assert.ok(E.equip(S, a.id, dup.uid, "dofus4"), "le jeu refuse deux fois le même Dofus");
  assert.deepStrictEqual(E.dofpOf(S, a), ["vulbis", "ocre", "ivoire"], "un même Dofus ne compte qu'une fois");
  wear(S, b, E.DOFP_PRIM); assert.ok(E.dofpReso(S, b) && !E.dofpReso(S, a));
  const F = hunt(S, 200); const ea = F.ents.find((e) => e.cid === a.id), eb = F.ents.find((e) => e.cid === b.id);
  assert.deepStrictEqual(ea.dp, ["vulbis", "ocre", "ivoire"]); assert.ok(eb.dpBoost && !ea.dpBoost);
  assert.ok(eb.shield > 0 || (F.dpN[b.id] || {}).emeraude > 0, "Souffle d'Aerafal : bouclier au début du combat");
  assert.strictEqual(E.dofpVal("pourpre", true), 12.5); assert.strictEqual(E.dofpVal("ivoire", true), 35); assert.strictEqual(E.dofpVal("ocre", true), 1);
  console.log("ok - dofus : passifs portés et Éveil des Dragons");
}

// 3. Effets en combat : Carapace d'ivoire, Lueur d'Ilyzaelle, Prison d'ambre, Fonte des armures, Colère du Bworker.
{
  const S = team(200); const [a, b, c] = S.chars; wear(S, a, ["ivoire"]); wear(S, b, ["argente", "dofoozbz"]); wear(S, c, ["ocre", "forgelave"]);
  const F = hunt(S, 200); const API = E.fightApi;
  const ea = F.ents.find((e) => e.cid === a.id), eb = F.ents.find((e) => e.cid === b.id), ec = F.ents.find((e) => e.cid === c.id);
  const mon = F.ents.find((e) => e.side === "m" && e.alive);
  // 1.0.30 : selon le tirage, des héros ont pu tomber dès les premiers tours (et la Lueur servir) : on repart d'une équipe debout
  F.ents.forEach((e) => { if (e.side === "c" && !e.summon) { e.alive = true; e.hp = e.hpMax; } }); F.deaths = F.deaths.filter((i) => F.ents[i].side !== "c");
  eb.dpS.save = 1; eb.dpS.rage = 0; F.dpN = {}; F.dpSeen = {}; F.dpArg = {};
  ea.shield = 0; ea.hp = ea.hpMax; const d = API.dealDamage(F, mon, ea, ea.hpMax * 3, null);
  assert.ok(d <= Math.ceil(ea.hpMax * 0.4) && ea.alive, `Carapace d'ivoire : coup de ${d} pour ${ea.hpMax} PV`);
  ea.hp = 5; ea.shield = 0; API.dealDamage(F, mon, ea, ea.hpMax, null);
  assert.ok(ea.alive && ea.hp === 1, "Lueur d'Ilyzaelle (portée par un allié) : reste debout à 1 PV");
  ea.hp = 5; ec.dpS.save = 1; ec.dp = (ec.dp || []).concat("argente"); API.dealDamage(F, mon, ea, ea.hpMax, null); assert.ok(!ea.alive, "une seule fois par combat et par équipe, même avec un 2e porteur"); ec.dp = ec.dp.filter((x) => x !== "argente"); ec.dpS.save = 0;
  assert.strictEqual(eb.dpS.rage, 1, "Colère du Bworker : +1 allié à terre");
  const m2 = F.ents.find((e) => e.side === "m" && e.alive && !e.boss); if (m2) { ec.dpS = {}; m2.stun = 0; delete m2.lgStun; delete m2.dpMelt; m2.hp = m2.hpMax * 10; m2.hpMax *= 10; API.dealDamage(F, ec, m2, 1, null); assert.ok(m2.stun === 1 && m2.lgStun, "Prison d'ambre : figé"); assert.ok(m2.dpMelt >= 2 && m2.dpMeltS === "c", "Fonte des armures");
    API.dealDamage(F, ec, m2, 1, null); assert.ok(ec.dpS.amber === 1); }
  assert.ok(F.log.some((l) => /✦ Lueur d'Ilyzaelle/.test(l.txt) && /dofpl/.test(l.cls)), "ligne dorée dans le journal");
  assert.ok(F.dpN[b.id].argente === 1 && F.dpN[a.id].ivoire >= 1, "compteur par héros");
  console.log("ok - dofus : effets en combat");
}

// 4. Chacun des 31 passifs, porté par toute l'équipe : combats sans plantage, PV cohérents.
{
  E.DOFUS_ORDER.forEach((id) => { const L = Math.max(E.DOFUS[id].lvl, 20); const S = team(L); S.chars.forEach((c) => wear(S, c, [id]));
    const sub = Object.values(E.SUBS).filter((s) => s.lvl[0] <= L).sort((a, b) => b.lvl[0] - a.lvl[0])[0]; assert.ok(!E.startHunt(S, sub.id));
    for (let i = 0; i < 40; i++) { now += 1000; E.tick(S, now); const F = S.fight; if (F) F.ents.forEach((e) => assert.ok(Number.isFinite(e.hp) && e.hp >= 0 && e.hp <= e.hpMax + 1e-9, `${id} : PV ${e.hp}/${e.hpMax}`)); }
    assert.ok(S.stats.fights > 0, "combats " + id); });
  console.log("ok - dofus : les 35 passifs en combat");
}

// 5. Gains : kamas et butin une seule fois par équipe, XP pour le seul porteur, tout dans les plafonds.
{
  const S = team(100); const [a, b] = S.chars;
  const k0 = E.bonus(S, "kamas"), d0 = E.bonus(S, "drop"), x0 = E.bonus(S, "xp");
  wear(S, a, ["argent", "dokille", "jyfus"]); wear(S, b, ["argent", "dokille"]);
  assert.strictEqual(E.bonus(S, "kamas") - k0, 5, "Reflet d'argent : +5 %, une fois"); assert.strictEqual(E.bonus(S, "drop") - d0, 5, "Os à ronger : +5 %, une fois");
  assert.strictEqual(E.bonus(S, "xp"), x0, "Jyfus : pas un bonus d'équipe");
  assert.strictEqual(E.dofpXpBonus(S, a), Math.min(E.capOf(S, "xp"), E.bonusRaw(S, "xp") + 5)); assert.strictEqual(E.dofpXpBonus(S, b), E.bonus(S, "xp"));
  assert.ok(E.bonusParts(S, "kamas").some((p) => p.k === "dofus" && p.v === 5), "détail des bonus");
  S.chars.forEach((c) => (c.inTeam = c === a)); const hi = E.bonusRaw; E.bonusRaw = (s, k) => (k === "xp" ? 1000 : hi(s, k));
  assert.strictEqual(E.dofpXpBonus(S, a), E.capOf(S, "xp"), "plafond d'XP"); E.bonusRaw = hi;
  console.log("ok - dofus : gains");
}

// 6. Aucun passif ne touche aux chances d'obtenir un Dofus (règle de Mathis) : le tirage ne lit aucun bonus.
{
  const S = team(200); S.chars.forEach((c) => wear(S, c, ["dokille", "argent", "jyfus"]));
  const b0 = E.bonus, r0 = E.bonusRaw; let calls = 0; E.bonus = (...x) => { calls++; return b0(...x); }; E.bonusRaw = (...x) => { calls++; return r0(...x); };
  const did = E.DOFUS.vulbis.dg; for (let i = 0; i < 200; i++) E.dofusDrop(S, did, 10, []);
  E.bonus = b0; E.bonusRaw = r0; assert.strictEqual(calls, 0, "le butin des Dofus ignore les bonus");
  console.log("ok - dofus : chances des Dofus intactes");
}

// 7. Kolizéum : passifs dans la photo d'équipe, moitié de l'effet, combat rejouable à l'identique.
{
  const S = team(200, ["iop", "eni", "cra"]); S.chars.forEach((c) => wear(S, c, E.DOFP_PRIM));
  const A = E.koliSnap(S, S.chars.map((c) => c.id)); assert.ok(A.every((h) => h.dp.length === 6 && h.dpB), "photo avec les passifs");
  const B = E.koliGhost(77, 200);
  const W = E.koliSetup(A, B); const e0 = W.fight.ents.find((e) => e.tm === 0);
  assert.ok(e0.dp.length === 6 && e0.dpBoost && W.fight.pvp, "entité d'arène avec ses passifs");
  assert.strictEqual(E.dofpVal("nebuleux", false, true), 7.5); assert.strictEqual(E.dofpVal("ivoire", false, true), 70); assert.strictEqual(E.dofpVal("vulbis", false, true), 1);
  const r1 = E.koliSim(A, B, 9), r2 = E.koliSim(A, B, 9); assert.deepStrictEqual(r1, r2, "même graine, même combat");
  const r3 = E.koliSim(B, A, 9); assert.ok(r3 && r3.rounds >= 1, "passifs côté défenseur");
  console.log("ok - dofus : Kolizéum");
}

// 8. Le Dokoko soigne toujours son porteur au début de son tour (ancien effet, devenu son passif).
{
  const S = team(100); wear(S, S.chars[0], ["dokoko"]); const F = hunt(S, 100); const e = F.ents.find((x) => x.cid === S.chars[0].id);
  e.alive = true; e.hp = Math.round(e.hpMax / 2); const h0 = e.hp; E.dofusTurn(S, F, e); assert.ok(e.hp > h0, "Sève de Moon");
  console.log("ok - dofus : Dokoko");
}

// 9. La page et la fonction serveur chargent bien js/dofusp.js (après les légendaires, avant le Boss des mondes).
{
  const fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), i = html.indexOf('<script src="js/dofusp.js?v=');
  assert.ok(i > html.indexOf("js/legendaires.js") && i < html.indexOf("js/wboss.js"), "dofusp.js dans index.html, après legendaires.js");
  assert.ok(/"legendaires", "dofusp"/.test(fs.readFileSync(path.join(ROOT, "tools", "build_server.js"), "utf8")), "dofusp dans la fonction serveur");
  console.log("ok - dofus : fichier chargé par le jeu et le serveur");
}


// 1.0.29.5 : la quête du Dokille ne se termine plus en salle (stasis 6 déjà faite avant) ; il faut revaincre le boss pendant la dernière étape
{ const S = E.newState("Q", "iop"); S.cnt = S.cnt || {}; const Q = E.dofusQuest(S, "dokille"); Q.step = 1; Q.prog = 29;
  E.stasisInfo(S, "cimetiere_mastodontes").max = 6;
  E.emit(S, "win", { mons: [], sub: null, chals: ["survivant"] });
  assert.strictEqual(Q.step, 2, "challenge validé"); assert.ok(!Q.done && !E.dofusOwned(S, "dokille"), "pas de Dokille avant le boss");
  E.emit(S, "dungeon", { id: "cimetiere_mastodontes", stasis: 6, chals: [], down: 0 });
  assert.ok(Q.done && E.dofusOwned(S, "dokille"), "Dokille en battant le boss"); }
console.log("ok - Dokille seulement après le boss");

// 1.0.32.11 « Dofus retrouvé » : sac plein à la fin d'une quête, le Dofus reste dans le sac (avant : parti au trop-plein) ;
// au chargement, un Dofus du trop-plein revient et une quête terminée sans Dofus le rend ; un Dofus ne se brise pas.
{ const S = team(200); E.ITEM_CAP0 = E.ITEM_CAP; E.ITEM_CAP = 5;
  for (let i = 0; i < 6; i++) E.rollItem(S, Object.keys(ITEMS).find((t) => ITEMS[t].slot === "coiffe"), { radiant: false });
  const Q = E.dofusQuest(S, "dokille"); Q.step = E.DOFUS.dokille.steps.length; E.refreshArchis(S); E.bagFlush(S);
  assert.ok(Q.done && E.dofusOwned(S, "dokille"), "Dofus dans le sac même sac plein");
  assert.ok(!(S.over || []).some((o) => o.tpl === "dofus_dokille"), "pas au trop-plein");
  const uid = Object.values(S.items).find((it) => it.tpl === "dofus_dokille").uid;
  assert.strictEqual(typeof E.breakItem(S, uid, null), "string", "un Dofus ne se brise pas");
  // ancienne partie : le Dofus au trop-plein, un autre Dofus de quête jamais remis
  delete S.items[uid]; S.over.push({ uid, tpl: "dofus_dokille", stats: {}, at: now });
  const Q2 = E.dofusQuest(S, "dokoko"); Q2.done = now; S.migration = null;
  const N = E.deserialize(E.serialize(S)); E.ITEM_CAP = E.ITEM_CAP0;
  assert.ok(E.dofusOwned(N, "dokille") && E.dofusOwned(N, "dokoko"), "Dofus rendus au chargement");
  assert.ok(N.migration && N.migration.some((m) => /Dofus/.test(m)), "message au joueur");
  assert.strictEqual(E.dofusRepair(N).length, 0, "rien de plus au chargement suivant"); }
console.log("ok - Dofus de quête jamais perdu (sac plein, trop-plein, brisage)");

// 1.1.2.11 : un compte fondateur qui a perdu son Jyfus le retrouve au chargement ; un compte non fondateur ne le reçoit pas
{ const S = team(200); S.unlocks = S.unlocks || {}; S.unlocks.fondateur = 1;
  Object.keys(S.items).filter((u) => S.items[u].tpl === E.DOFUS.jyfus.tpl).forEach((u) => delete S.items[u]);
  const N = E.deserialize(E.serialize(S));
  assert.ok(E.dofusOwned(N, "jyfus"), "Jyfus rendu au fondateur");
  assert.ok(N.migration && N.migration.some((m) => /fondateur/.test(m)), "message au fondateur");
  assert.strictEqual(E.dofusRepair(N).length, 0, "un seul Jyfus");
  const T = team(200); if (T.unlocks) delete T.unlocks.fondateur;
  Object.keys(T.items).filter((u) => T.items[u].tpl === E.DOFUS.jyfus.tpl).forEach((u) => delete T.items[u]);
  assert.ok(!E.dofusOwned(E.deserialize(E.serialize(T)), "jyfus"), "pas de Jyfus sans être fondateur"); }
console.log("ok - Jyfus rendu aux fondateurs");

// 2.1.34.2 (ticket #142) : Colère du Bworker sur une entité sans dpS ; le Poutch pendant un combat marqué par l'Ébène
{ const S = team(200); const [a, b] = S.chars; wear(S, a, ["dofoozbz"]); const F = hunt(S, 200);
  const ea = F.ents.find((e) => e.cid === a.id), eb = F.ents.find((e) => e.cid === b.id); delete ea.dpS; eb.dp = eb.dp || ["vulbis"];
  assert.doesNotThrow(() => E.dofpDeath(F, eb), "Colère du Bworker sans dpS"); assert.strictEqual(ea.dpS.rage, 1);
  ea.dpS.markT = F.ents.find((e) => e.side === "m"); ea.dpS.markT.back = ea; // entité gardée par la Marque d'ébène : JSON circulaire
  assert.doesNotThrow(() => E.poutchPreview(S, a.id), "Poutch pendant un combat"); }
console.log("ok - Colère du Bworker et Poutch pendant un combat");

console.log("dofusp.test.js : tout est bon");
