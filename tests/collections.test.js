/* 1.0.30 « Collections » : Collection de panoplies (paliers, bonus uniques, régions, Garde-robe, Retouche, Couture fine,
   « Équiper sur », migration) et Potentiel des Dofus (éclat, rangs, kamas, copies, caractéristiques, passifs, Kolizéum,
   rythme visé). Aucun bonus ne touche aux chances d'obtenir un Dofus. Sans navigateur.
   Lancer : node tests/collections.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/koli.js"); require("../js/legendaires.js"); require("../js/dofusp.js");
require("../js/collections.js");
const D = require("../js/data.js"); const { ITEMS, SETS } = D;

let seed = 3030;
E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const fresh = (cls = "iop") => { const S = E.newState("Coll", cls); const c = S.chars[0]; c.lvl = 200; c.inTeam = true; return S; };
const give = (S, sid) => E.setPieces(sid).forEach((t) => E.rollItem(S, t, { radiant: false }));
const ids = E.collSets();

// 1. Les paliers : 9, dont 4 uniques, dans l'ordre demandé
assert.deepStrictEqual(E.COLL_TIERS.map((T) => T.n), [5, 10, 15, 25, 40, 60, 80, 100, 150]);
assert.deepStrictEqual(E.COLL_TIERS.filter((T) => T.u).map((T) => T.k), ["gear", "retouche", "fine", "aura"], "4 bonus uniques");
assert.deepStrictEqual(E.COLL_TIERS.filter((T) => T.v).map((T) => `${T.k}${T.v}`), ["kamas2", "xp2", "drop2", "kamas3"]);
assert.deepStrictEqual(E.COLL_TIERS.filter((T) => T.title).map((T) => T.title), ["Couturier", "Grand Couturier"]);
assert.ok(ids.length > 400 && ids.length === E.collTotal(), "toutes les panoplies du jeu comptent");
assert.ok(E.collRegions().length > 10 && E.collRegions().every((z) => E.regionSets(z).length > 0), "chaque région a ses panoplies");
assert.ok(ids.every((sid) => !E.setRegion(sid) || E.collRegions().includes(E.setRegion(sid))));
console.log(`ok - ${ids.length} panoplies, ${E.collRegions().length} régions, 9 paliers dont 4 uniques`);

// 2. Une panoplie compte quand chacune de ses pièces a été obtenue une fois ; la collection ne baisse jamais
{
  const S = fresh(); assert.strictEqual(E.collN(S), 0); assert.strictEqual(S.collT, 0);
  const sid = ids.find((x) => E.setPieces(x).length >= 3);
  const P = E.setPieces(sid); P.slice(0, -1).forEach((t) => E.rollItem(S, t, { radiant: false }));
  assert.strictEqual(E.collN(S), 0, "il manque une pièce");
  assert.deepStrictEqual(E.collMissing(S, sid), [P[P.length - 1]]);
  E.rollItem(S, P[P.length - 1], { radiant: false });
  assert.strictEqual(E.collN(S), 1); assert.ok(E.collDone(S, sid));
  Object.keys(S.items).forEach((u) => { if (P.includes(S.items[u].tpl)) delete S.items[u]; }); // tout brisé ou vendu
  assert.strictEqual(E.collN(S), 1, "la collection ne baisse pas");
  assert.ok(S.journal.some((n) => /Collection de panoplies : .* complète \(1 \//.test(n.txt)), "annonce de la panoplie complète");
}
console.log("ok - une panoplie complète compte pour toujours");

// 3. Paliers : titres, annonces, bonus d'XP, de butin et de kamas (kamas en chasse seulement), plafonds habituels
{
  const S = fresh(); E.events.length = 0;
  ids.slice(0, 104).forEach((sid) => give(S, sid));
  const n = E.collN(S); assert.ok(n >= 100 && n < 150, `100 panoplies ou plus (${n})`);
  assert.strictEqual(S.collT, 8, "8 paliers annoncés");
  assert.deepStrictEqual(E.events.filter((e) => e.kind === "cele" && e.t === "coll").map((e) => e.n), [5, 10, 15, 25, 40, 60, 80, 100]);
  assert.ok(S.titlesExtra.includes("Couturier") && !S.titlesExtra.includes("Grand Couturier"));
  assert.ok(E.collHas(S, "fine") && E.collHas(S, "gear") && E.collHas(S, "retouche") && !E.collHas(S, "aura"));
  S.sub = null; S.dungeon = null;
  assert.strictEqual(E.collBonus(S, "xp"), 2); assert.strictEqual(E.collBonus(S, "drop"), 2); assert.strictEqual(E.collBonus(S, "kamas"), 5);
  assert.strictEqual(E.collBonus(S, "offrate"), 0, "rien d'autre");
  const parts = E.bonusParts(S, "kamas"); assert.ok(parts.some((p) => p.k === "coll" || /Collection de panoplies/.test(JSON.stringify(p))), "ligne « Collection de panoplies » dans le détail des bonus");
  S.dungeon = { id: Object.keys(D.DUNGEONS)[0], room: 0, stasis: 1 };
  assert.strictEqual(E.collBonus(S, "kamas"), 0, "les kamas de la collection sont pour la chasse");
  assert.strictEqual(E.collBonus(S, "xp"), 2);
  S.dungeon = null;
  // plafond : on ne dépasse jamais E.BONUS_CAP
  const b0 = E.bonus(S, "kamas"); assert.ok(b0 <= E.BONUS_CAP.kamas);
  ids.forEach((sid) => give(S, sid)); E.collCheck(S);
  assert.strictEqual(E.collN(S), ids.length); assert.ok(S.titlesExtra.includes("Grand Couturier") && E.collHas(S, "aura"));
  ["xp", "drop", "kamas"].forEach((k) => assert.ok(E.bonus(S, k) <= E.BONUS_CAP[k], `plafond ${k}`));
}
console.log("ok - paliers, titres, bonus d'XP, de butin et de kamas sous les plafonds");

// 4. Région complète : +5 % de butin et de kamas en chasse dans la région, nulle part ailleurs
{
  const z = E.collRegions().slice().sort((a, b) => E.regionSets(a).length - E.regionSets(b).length)[0];
  const S = fresh(); E.regionSets(z).forEach((sid) => give(S, sid));
  assert.ok(E.collState(S).regs.has(z), "région complète");
  const sub = Object.keys(E.SUBS).find((s) => E.SUBS[s].zone === z); const other = Object.keys(E.SUBS).find((s) => E.SUBS[s].zone !== z);
  const base = (k) => E.COLL_TIERS.filter((T) => T.k === k && E.collN(S) >= T.n).reduce((a, T) => a + T.v, 0);
  S.sub = sub; assert.strictEqual(E.collBonus(S, "drop"), base("drop") + 5); assert.strictEqual(E.collBonus(S, "kamas"), base("kamas") + 5);
  assert.strictEqual(E.collBonus(S, "xp"), base("xp"), "pas d'XP en plus");
  S.sub = other; assert.strictEqual(E.collBonus(S, "drop"), base("drop"), "rien hors de la région");
}
console.log("ok - région complète : +5 % de butin et de kamas dans la région");

// 5. Garde-robe (15) : une tenue de plus ; Retouche (40) : une pièce disparue est remplacée par une copie du sac
{
  const S = fresh(); const c = S.chars[0];
  ids.slice(0, 10).forEach((sid) => give(S, sid));
  assert.strictEqual(E.maxGear(S), E.MAX_GEAR); E.saveGear(S, c.id, E.MAX_GEAR, "Trop"); assert.ok(!(c.gear || [])[E.MAX_GEAR], "pas de 4e tenue avant la Garde-robe");
  ids.slice(10, 45).forEach((sid) => give(S, sid)); assert.ok(E.collHas(S, "gear") && E.collHas(S, "retouche"));
  assert.strictEqual(E.maxGear(S), E.MAX_GEAR + 1);
  const sid = ids.slice(0, 45).find((x) => E.setLvl(x) <= 200 && E.setPieces(x).length >= 3);
  const r = E.act(S, "equipSet", c.id, sid); assert.ok(r && r.n >= 1, "« Équiper sur » met les pièces du sac");
  E.saveGear(S, c.id, E.MAX_GEAR, "Garde-robe"); const g = c.gear[E.MAX_GEAR]; assert.ok(g && g.tp, "4e tenue enregistrée, avec les modèles des pièces");
  const [sl, u] = Object.entries(g.eq)[0]; const tpl = S.items[u].tpl;
  E.rollItem(S, tpl, { radiant: false }); delete S.items[u]; delete c.equip[sl];
  const ra = E.applyGear(S, c.id, E.MAX_GEAR); assert.strictEqual(ra.fixed, 1, "Retouche : la pièce est remplacée"); assert.strictEqual(ra.missing, 0);
  assert.ok(S.items[c.equip[sl]] && S.items[c.equip[sl]].tpl === tpl);
}
console.log("ok - Garde-robe (une tenue de plus) et Retouche");

// 6. Couture fine (100) : il manque 1 pièce, le bonus complet reste (panoplies de 3 pièces et plus)
{
  const S = fresh(); const c = S.chars[0];
  const sid = ids.find((x) => E.setPieces(x).length >= 3 && (SETS[x].size || E.setPieces(x).length) === E.setPieces(x).length && E.setLvl(x) <= 200 && SETS[x].bonus[E.setPieces(x).length]);
  const full = E.setPieces(sid).length;
  give(S, sid); E.equipSet(S, c.id, sid);
  const slot = Object.keys(c.equip).find((s) => S.items[c.equip[s]] && E.setPieces(sid).includes(S.items[c.equip[s]].tpl)); E.unequip(S, c.id, slot);
  assert.strictEqual(E.setCounts(S, c)[sid], full - 1);
  assert.strictEqual(E.setCountFx(S, sid, full - 1), full - 1, "pas encore de Couture fine");
  ids.filter((x) => x !== sid).slice(0, 105).forEach((x) => give(S, x)); assert.ok(E.collHas(S, "fine"));
  assert.strictEqual(E.setCountFx(S, sid, full - 1), full, "Couture fine : bonus complet");
  assert.strictEqual(E.setCountFx(S, sid, full - 2), full - 2, "seulement s'il manque une pièce");
  const two = ids.find((x) => (SETS[x].size || E.setPieces(x).length) === 2); if (two) assert.strictEqual(E.setCountFx(S, two, 1), 1, "pas pour les panoplies de 2 pièces");
}
console.log("ok - Couture fine");

// 7. Migration : une partie d'avant la 1.0.30 reçoit ses titres sans fête ; une partie à jour ne refait pas la fête
{
  const S = fresh(); ids.slice(0, 30).forEach((sid) => give(S, sid));
  const txt = E.serialize(S).replace(/,"collT":\d+/, "").replace(/"collT":\d+,/, "").replace(/,"titlesExtra":\[[^\]]*\]/, "");
  assert.ok(!txt.includes('"collT"'));
  E.events.length = 0; const N = E.deserialize(txt);
  assert.strictEqual(N.collT, 4); assert.ok((N.titlesExtra || []).includes("Couturier"));
  assert.strictEqual(E.events.filter((e) => e.kind === "cele").length, 0, "pas de fête pour l'ancien");
  E.events.length = 0; const N2 = E.deserialize(E.serialize(N)); assert.strictEqual(N2.collT, 4); assert.strictEqual(E.events.filter((e) => e.kind === "cele").length, 0);
}
console.log("ok - migration sans annonce (S.collT)");

// 8. Potentiel des Dofus : éclat, kamas, rangs
assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(E.dpotNeed), [2000, 2700, 3300, 4000, 4700, 5300, 6000, 6700, 7300, 8000]);
assert.strictEqual(E.dpotNeedAll(10), 50000); assert.strictEqual(E.dpotNeedAll(5), 16700);
assert.strictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, n) => a + E.dpotCost(n), 0), 770e6, "770 M de kamas jusqu'au rang X");
assert.strictEqual(E.dpotCost(3), 18e6, "rang² × 2 M");
{
  // rythme visé : 20 donjons par jour en stasis 7, un mois pour le rang V, trois mois pour le rang X
  const perDay = 20 * E.DPOT_ECL * 7;
  const d5 = E.dpotNeedAll(5) / perDay, d10 = E.dpotNeedAll(10) / perDay;
  assert.ok(d5 >= 27 && d5 <= 33, `rang V en ${d5.toFixed(1)} jours`); assert.ok(d10 >= 80 && d10 <= 95, `rang X en ${d10.toFixed(1)} jours`);
  console.log(`ok - rythme : rang V en ${d5.toFixed(0)} jours, rang X en ${d10.toFixed(0)} jours (20 donjons par jour en stasis 7)`);
}
const wear = (S, c, id, slot) => { const it = E.rollItem(S, "dofus_" + id, { radiant: false }); assert.strictEqual(E.equip(S, c.id, it.uid, slot), null, "équiper " + id); return it; };
{
  const S = fresh(); const c = S.chars[0]; S.kamas = 0;
  assert.ok(E.act(S, "dofPotUp", "pourpre"), "sans le Dofus : refusé");
  wear(S, c, "pourpre", "dofus1"); wear(S, c, "dofoozbz", "dofus2"); wear(S, c, "ocre", "dofus3");
  assert.match(E.act(S, "dofPotUp", "pourpre"), /éclats/, "sans éclat : refusé");
  // éclat : chaque donjon terminé, 4 par stasis, pour chaque Dofus porté (une fois par Dofus)
  const h2 = E.addChar(S, "eni", "Deux", 200); h2.inTeam = true; wear(S, h2, "pourpre", "dofus1");
  E.emit(S, "dungeon", { id: Object.keys(D.DUNGEONS)[0], stasis: 7, chals: [], down: 0 });
  assert.strictEqual(E.dpot(S, "pourpre").e, 28, "28 éclats en stasis 7, une seule fois même porté deux fois");
  assert.strictEqual(E.dpot(S, "ocre").e, 28); assert.strictEqual(E.dpot(S, "emeraude").e, 0, "pas porté : rien");
  E.emit(S, "dungeon", { id: Object.keys(D.DUNGEONS)[0], stasis: 10, chals: [], down: 0 }); assert.strictEqual(E.dpot(S, "pourpre").e, 68);
  S.dofPot.pourpre.e = 2000; assert.match(E.act(S, "dofPotUp", "pourpre"), /kamas/, "sans kamas : refusé");
  S.kamas = 2e6; assert.strictEqual(E.act(S, "dofPotUp", "pourpre"), null);
  assert.strictEqual(E.dpotRank(S, "pourpre"), 1); assert.strictEqual(S.kamas, 0); assert.strictEqual(E.dpot(S, "pourpre").e, 0);
  // caractéristiques : +5 % par rang, PA, PM, Portée et Invocations ne montent pas
  const base = E.charStats(S, c);
  S.dofPot = { pourpre: { r: 10, e: 0 }, dofoozbz: { r: 10, e: 0 }, ocre: { r: 10, e: 0 } };
  const st = E.charStats(S, c);
  const T = ITEMS.dofus_pourpre.stats; for (const k in T) assert.strictEqual(E.dpotStatsOf("pourpre", 10)[k], Math.round(T[k][1] * 0.5), "Pourpre +50 % " + k);
  assert.strictEqual(st.pa, base.pa, "PA de l'Ocre : ne monte pas"); assert.strictEqual(st.inv, base.inv, "Invocation du Dofoozbz : ne monte pas");
  assert.strictEqual(E.dpotStatsOf("dofoozbz", 10).pui, 15); assert.ok(!("inv" in E.dpotStatsOf("dofoozbz", 10)));
  assert.ok(!Object.keys(E.dpotStatsOf("vulbis", 10)).length && !Object.keys(E.dpotStatsOf("sylvestre", 10)).length, "PM et Portée : rien");
  // passifs : +5 % par rang ; les passifs « tout ou rien » ne bougent pas ; l'Ivoire baisse son plafond
  assert.strictEqual(E.dofpVal("pourpre", false, false, 10), E.dofpVal("pourpre", false, false, 0) * 1.5);
  assert.strictEqual(E.dofpVal("pourpre", false, false, 4), E.dofpVal("pourpre", false, false, 0) * 1.2);
  ["vulbis", "argente", "ocre"].forEach((id) => assert.strictEqual(E.dofpVal(id, false, false, 10), E.dofpVal(id, false, false, 0), id + " tout ou rien"));
  assert.ok(E.dofpVal("ivoire", false, false, 10) < E.dofpVal("ivoire", false, false, 0), "Ivoire : plafond plus bas = plus fort");
  assert.deepStrictEqual(E.dpotSublimes(S), ["pourpre", "ocre", "dofoozbz"].filter((id) => E.DOFUS_ORDER.includes(id)).sort((a, b) => E.DOFUS_ORDER.indexOf(a) - E.DOFUS_ORDER.indexOf(b)));
  // Kolizéum : la photo de l'équipe garde les rangs (passifs) et le Sublimé (aura)
  const A = E.koliSnap(S, [c.id]); assert.strictEqual(A[0].dpP.pourpre, 10); assert.strictEqual(A[0].dpX, 1);
  const W = E.koliSetup(A, A, {}); const ents = W.fight.ents.filter((e) => e.side === "c" || e.tm === 0);
  assert.ok(W.fight.ents.some((e) => e.dpP && e.dpP.pourpre === 10 && e.dpSub), "rangs et Sublimé repris en Kolizéum");
  assert.ok(ents.length >= 1);
}
console.log("ok - éclat, rangs, kamas, caractéristiques (PA, PM, Portée, Invocations à part), passifs, Kolizéum");
{
  // rang X : Dofus Sublimé, fête et note
  const S = fresh(); const c = S.chars[0]; wear(S, c, "emeraude", "dofus1"); S.kamas = 1e9; S.dofPot = { emeraude: { r: 9, e: 8000 } };
  E.events.length = 0; assert.strictEqual(E.act(S, "dofPotUp", "emeraude"), null);
  assert.ok(E.dpotSub(S, "emeraude")); assert.ok(E.events.some((e) => e.kind === "cele" && e.t === "dsub" && e.id === "emeraude"));
  assert.match(E.act(S, "dofPotUp", "emeraude"), /Sublimé/);
  E.emit(S, "dungeon", { id: Object.keys(D.DUNGEONS)[0], stasis: 10, chals: [], down: 0 }); assert.strictEqual(E.dpot(S, "emeraude").e, 0, "plus d'éclat après le rang X");
  // copies : il faut une autre copie libre (ni portée, ni dans une tenue, ni verrouillée)
  const S2 = fresh(); const c2 = S2.chars[0]; wear(S2, c2, "turquoise", "dofus1");
  assert.ok(E.act(S2, "dofPotCopy", "turquoise"), "une seule copie, portée : refusé");
  const cp = E.rollItem(S2, "dofus_turquoise", { radiant: false }); cp.locked = true;
  assert.ok(E.act(S2, "dofPotCopy", "turquoise"), "copie verrouillée : refusé");
  cp.locked = false; assert.strictEqual(E.act(S2, "dofPotCopy", "turquoise"), null);
  assert.ok(!S2.items[cp.uid], "la copie est fondue"); assert.strictEqual(E.dpot(S2, "turquoise").e, 2000, "l'éclat d'un rang");
  assert.ok(Object.values(S2.items).some((it) => it.tpl === "dofus_turquoise"), "le Dofus porté reste");
}
console.log("ok - Sublimé et copies");

// 9. Aucune chance d'obtenir un Dofus ne change : mêmes tirages avec ou sans collection et Potentiel
{
  const run = (S) => { seed = 77; const out = []; for (let i = 0; i < 4000; i++) E.dofusDrop(S, E.DOFUS.pourpre.dg, 10, out); return out.length; };
  const A = fresh(); const B = fresh(); ids.forEach((sid) => give(B, sid)); B.dofPot = { pourpre: { r: 10, e: 0 } }; wear(B, B.chars[0], "pourpre", "dofus1");
  const odds = E.DOFUS_ODDS.slice();
  assert.strictEqual(run(A), run(B), "mêmes Dofus en butin");
  assert.deepStrictEqual(E.DOFUS_ODDS, odds);
}
console.log("ok - les chances d'obtenir un Dofus ne changent pas");

// 10. La page charge les collections ; le serveur aussi (Couture fine et Potentiel changent les caractéristiques)
{
  const ROOT = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const at = (f) => html.indexOf(`<script src="${f}?v=`);
  assert.ok(at("js/collections.js") > at("js/dofusp.js") && at("js/dofusp.js") > 0, "collections.js après dofusp.js");
  assert.ok(at("js/collui.js") > at("js/ui.js") && at("js/ui.js") > 0, "collui.js après ui.js");
  assert.ok(html.includes('href="css/collections.css?v='), "css/collections.css");
  assert.ok(/"dofusp", "collections"/.test(fs.readFileSync(path.join(ROOT, "tools", "build_server.js"), "utf8")), "collections.js dans le code du serveur");
  const sql = fs.readFileSync(path.join(ROOT, "supabase", "collections.sql"), "utf8");
  assert.ok(!/\b(delete\s+from|truncate|drop\s+table|update\s+public\.)/i.test(sql), "le SQL ne supprime ni ne modifie de données");
  assert.ok(/create table if not exists/.test(sql) && /create or replace function public\.dsub_from_save/.test(sql) && /drop trigger if exists saves_sublime/.test(sql), "SQL relançable");
}
console.log("ok - index.html, serveur et SQL");
