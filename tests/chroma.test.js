/* 1.0.33 « Chromatiques » : apparition, butin ×3, album, paliers, chaîne, espèce recherchée, trophées, atelier, absence.
   Lancer : node tests/chroma.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js"); require("../js/chroma.js");
const D = require("../js/data.js");

let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
let seed = 4242; const rng = () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; E.setRng(rng);
E.subUnlocked = () => true;
const party = (lvl, n = 4) => { const S = E.newState("Chroma", "iop"); S.chars[0].lvl = lvl; S.chars[0].pts = (lvl - 1) * 5; E.autoAllocate(S, S.chars[0]); ["eni", "feca", "cra", "sacri", "osa", "enu", "sram"].slice(0, n - 1).forEach((k, i) => { E.addChar(S, k, "H" + i, lvl); }); return S; };
const sub = D.ZONES.find((z) => z.id === "astrub").subs[0];

/* 1. chances : base, chaîne, charme, espèce recherchée */
{
  const S = party(30); E.setSub(S, sub.id); S.hunting = true;
  const B = E.CHROMA_CHANCE; assert.strictEqual(B, 1 / 4096, "1 sur 4 096 (choix de Mathis)"); assert.strictEqual(E.chromaOdds(S, sub.monsters[0]), B, "1 sur 4 096 au départ");
  E.chroma(S).chain = { loc: sub.id, n: 250 }; assert.ok(Math.abs(E.chromaOdds(S) - 2 * B) < 1e-12, "chaîne à moitié : ×2");
  E.chroma(S).chain.n = 5000; assert.ok(Math.abs(E.chromaOdds(S) - 3 * B) < 1e-12, "chaîne pleine : ×3 au plus");
  E.chroma(S).chain.loc = "ailleurs"; assert.strictEqual(E.chromaOdds(S), B, "autre zone : la chaîne ne compte pas");
  const k = sub.monsters[0];
  assert.ok(E.chromaSetWant(S, k), "il faut avoir rencontré le monstre");
  S.bestiary[k] = 1; assert.strictEqual(E.chromaSetWant(S, k), null); assert.strictEqual(E.chromaOdds(S, k), 2 * B, "espèce recherchée ×2");
  assert.ok(E.chromaSetWant(S, sub.monsters[1]), "un seul changement par jour"); t += 86400000; S.bestiary[sub.monsters[1]] = 1; assert.strictEqual(E.chromaSetWant(S, sub.monsters[1]), null, "le lendemain, oui");
  console.log("ok - chances : 1/4096, chaîne ×3, espèce recherchée ×2 une fois par jour");
}

/* 2. en vrai combat : apparition mesurée, album, compteur, butin ×3 */
{
  const S = party(40, 8); E.setSub(S, sub.id); S.hunting = true;
  let mons = 0; const t0 = t;
  for (let i = 0; i < 3600 * 4 * 30; i++) { t += 250; E.tick(S, 250); }
  const X = E.chroma(S);
  mons = Object.values(S.bestiary).reduce((a, b) => a + b, 0);
  console.log(`  ${mons} monstres en 30 h : ${X.rec.tot} chromatiques, ${E.chromaCount(S)} espèces, ${X.ec} Éclats, chaîne ${X.chain.n}`);
  assert.ok(X.rec.tot >= 10 && X.rec.tot <= 60, "chaîne pleine : environ 1 sur 1 365 : " + X.rec.tot);
  assert.ok(X.ec >= X.rec.tot, "au moins 1 Éclat par chromatique");
  const d = Object.values(X.dex)[0]; assert.ok(d.t && d.n >= 1 && d.where && d.team.length === 8 && d.after > 0, "fiche de rencontre remplie");
  assert.ok(X.rec.fast && X.rec.slow && X.rec.fast[0] <= X.rec.slow[0], "records du compteur");
  console.log("ok - vrais combats : chromatiques, album, fiche, compteur");
}

/* 3. butin et XP ×3 */
{
  const mk = () => { const S = party(40); E.setSub(S, sub.id); S.hunting = true; return S; };
  const runs = (chroma) => { const S = mk(); let res = 0, xp = 0; seed = 99;
    for (let i = 0; i < 400; i++) { S.fight = null; const F = E.startFight(S); F.ents.forEach((e) => { if (e.side === "m") { e.chroma = chroma; e.hp = 0; e.alive = false; } }); const x0 = S.chars[0].xp + S.chars[0].lvl * 1e9; E.step(S); }
    return Object.values(S.res).reduce((a, b) => a + b, 0); };
  const a = runs(false), b = runs(true);
  console.log(`  ressources : normal ${a}, chromatique ${b}`);
  assert.ok(b > a * 2.4 && b < a * 3.6, "ressources ×3 environ");
  console.log("ok - butin ×3");
}

/* 4. paliers, trophée de sous-zone, atelier, teinture, vitrine */
{
  const S = party(30); E.setSub(S, sub.id); S.hunting = true; const X = E.chroma(S);
  const ks = E.chromaSubMons(sub.id);
  const win = (k, prism) => E.chromaWin(S, [{ side: "m", key: k, name: D.MONSTERS[k].name, lvl: 10, chroma: true, prism }], {});
  ks.forEach((k) => win(k));
  assert.ok(E.chromaTrophy(S, sub.id), "toute la sous-zone : trophée chromatique");
  const z0 = E.trophyZoneMult(S, {}); assert.ok(z0 >= 1.03, "+3 % dans la sous-zone");
  const more = E.CHROMA_KEYS.filter((k) => !X.dex[k]).slice(0, 260); more.forEach((k) => win(k));
  assert.strictEqual(X.tiers, 5, "les 5 paliers"); assert.ok(S.titlesExtra.includes("Œil de lynx") && S.titlesExtra.includes("Maître des couleurs"));
  assert.ok(E.chromaCharm(S) && E.ORN.chroma.ok(S) && E.SFRAMES.chroma.ok(S), "charme, ornement et cadre");
  assert.strictEqual(X.dyes, 1, "une teinture au palier 25");
  const c = S.chars[0]; assert.strictEqual(E.chromaDye(S, c.id, true), null); assert.ok(c.chroma && c.chromaDye && X.dyes === 0);
  assert.strictEqual(E.chromaDye(S, c.id, false), null); assert.strictEqual(E.chromaDye(S, c.id, true), null, "déjà teint : gratuit"); 
  assert.ok(E.chromaDye(S, S.chars[1].id, true), "plus de teinture");
  X.ec = 100; ["orn", "frame", "aura", "dye"].forEach((id) => assert.strictEqual(E.chromaBuy(S, id), null)); assert.strictEqual(X.ec, 100 - 8 - 13 - 20 - 5);
  assert.ok(E.chromaBuy(S, "orn"), "déjà acheté"); assert.ok(E.ORN.prisme.ok(S) && E.SFRAMES.prisme.ok(S));
  win(ks[0], true); assert.ok(S.titlesExtra.includes("Prisme vivant") && X.dex[ks[0]].p, "premier prismatique");
  assert.strictEqual(E.chromaSetVit(S, ks[0], true), null); assert.strictEqual(E.chromaSetVit(S, ks[1], true), null); assert.strictEqual(E.chromaSetVit(S, more[0], true), null); assert.ok(E.chromaSetVit(S, more[1], true), "3 places");
  const m = E.chromaMeta(S); assert.strictEqual(m.chroma, E.chromaCount(S)); assert.strictEqual(m.chromaVit.length, 3); assert.ok(m.chromaNew.length >= 1 && m.chromaNew[0][1] === 1);
  console.log("ok - paliers, trophée, atelier, teinture, vitrine, données du classement");
}

/* 5. hors ligne */
{
  const S = party(40, 8); E.setSub(S, sub.id); S.hunting = true; S.stats.recent = [{ d: 10, w: 1 }]; E.CHROMA_CHANCE = 1 / 30;
  S.lastTick = t; t += 8 * 3600 * 1000; const r = E.catchUp(S, 8 * 3600);
  assert.ok(r.chroma && r.chroma.length > 0, "chromatiques pendant l'absence"); E.CHROMA_CHANCE = 1 / 4096;
  const n = r.chroma.reduce((a, x) => a + x.n, 0); assert.strictEqual(new Set(r.chroma.map((x) => x.k)).size, r.chroma.length, "une ligne par espèce dans le résumé");
  assert.ok(r.chroma.filter((x) => x.neu).length <= E.chromaCount(S), "nouveautés comptées une fois");
  console.log(`ok - hors ligne : ${n} chromatiques, ${r.chroma.length} espèces`);
}
console.log("chroma : tout est bon");
