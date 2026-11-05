/* 2.2.8.5 « Consommables » (signalé par Ley : « le parfum de pistage ne fonctionne pas en combat ») : chaque consommable
   utilisable a bien son effet, en Classique comme en Monocompte. Sans navigateur (l'affichage : tests/consommables_ui.test.js).
   Lancer : node tests/consommables.test.js */
"use strict";
const assert = require("assert");
global.window = global;
for (const f of ["gamedata", "looks", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur",
  "identite", "identmon", "identboss", "archis", "chroma", "welcome", "defi", "gboss", "koli", "alliance", "legendaires", "dofusp", "sram", "mono", "monopass", "monodofus",
  "outils", "bureau_combat", "champions", "collections", "songe", "wboss", "expeditions", "suivi", "vie", "forge", "quetes", "vente", "saison1", "saisonc", "boucliers",
  "alignement", "honneur", "monoalign", "monoplus", "ascension"]) require("../js/" + f + ".js");
const E = window.ENGINE, D = window.DATA, C = D.CONSUMABLES;
let seed = 7; E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
let now = Date.UTC(2030, 0, 9, 12, 0); E.setClock(() => now);

// 1. Tous les bonus temporaires sont lus quelque part : la clé de chaque consommable « boost » change une valeur du jeu.
const effect = (S) => ({ archi: E.archiMult(S), xp: E.boostPct(S, "xp"), drop: E.bonus(S, "drop"), kamas: E.bonus(S, "kamas"), gather: E.bonus(S, "gather"), bxp: E.bonus(S, "xp") });
const WANT = { piste: (a, b) => b.archi > a.archi, archi: (a, b) => b.archi > a.archi, xp: (a, b) => b.xp > a.xp, drop: (a, b) => b.drop > a.drop,
  kamas: (a, b) => b.kamas > a.kamas, gather: (a, b) => b.gather > a.gather, royal: (a, b) => b.drop > a.drop && b.kamas > a.kamas && b.bxp > a.bxp };
for (const mono of [false, true]) {
  for (const id of Object.keys(C).filter((k) => C[k].kind === "boost")) {
    let S = E.newState("T", "iop"); if (mono) S = E.monoStart(S);
    assert.ok(WANT[C[id].boost], `${id} : bonus « ${C[id].boost} » sans effet connu`);
    S.cons[id] = 1; const a = effect(S); const r = E.useConsumable(S, id); const b = effect(S);
    assert.strictEqual(r, null, `${id} : ${r}`); assert.ok(!S.cons[id], `${id} consommé`);
    assert.ok(WANT[C[id].boost](a, b), `${id}${mono ? " (Monocompte)" : ""} : aucun effet ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  }
}
console.log("ok - chaque bonus temporaire a un effet (Classique et Monocompte)");

// 2. Le Parfum de pistage double vraiment les archimonstres des groupes de chasse (×2, et ×3 avec le Bonbon Traqueur).
{
  const sid = Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && !E.SUBS[k].hidden && E.SUBS[k].monsters.length && E.subMid(E.SUBS[k]) > 40);
  // tirage fixé : r = 1,5 × la chance de base (archi seulement à ×2), puis 2,5 × (archi seulement à ×3)
  const sub = E.SUBS[sid]; const c0 = E.ARCHI_CHANCE * E.almMult(E.newState("T", "iop"), "archi");
  const archis = (S, r) => { E.setRng(() => r); try { return E.makeGroup(S, sub, 4).filter((m) => m.archi).length; } finally { E.setRng(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }); } };
  const S = E.newState("T", "iop");
  assert.strictEqual(archis(S, 1.5 * c0), 0, "sans parfum : pas d'archimonstre à 1,5 × la chance");
  S.cons.parfum_piste = 1; assert.strictEqual(E.useConsumable(S, "parfum_piste"), null);
  assert.ok(archis(S, 1.5 * c0) > 0, "Parfum de pistage : chances ×2 dans les groupes de chasse");
  assert.strictEqual(archis(S, 2.5 * c0), 0, "mais pas ×3");
  S.cons.bonbon_traqueur = 1; assert.strictEqual(E.useConsumable(S, "bonbon_traqueur"), null);
  assert.ok(archis(S, 2.5 * c0) > 0, "Parfum + Bonbon Traqueur : ×3");
  assert.strictEqual(E.archiMult(S), 3);
  // 2 h de bonus, puis plus rien
  now += 2 * 3600e3 + 1000; assert.strictEqual(E.boostPct(S, "piste"), 0); now -= 2 * 3600e3 + 1000;
  // la Pierre d'âme dorée (×3) ne se cumule pas : le refus nomme le Parfum et la pierre reste dans le sac
  S.cons.pierre_ame_doree = 1; const r = E.useConsumable(S, "pierre_ame_doree");
  assert.ok(/Parfum de pistage/.test(r) && S.cons.pierre_ame_doree === 1, r);
  console.log("ok - Parfum de pistage : archimonstres ×2 (×3 avec le Bonbon Traqueur)");
}

// 3. Un bonbon de butin ou de kamas n'est pas consommé quand le bonus est déjà au plafond (il n'ajouterait rien).
{
  const S = E.newState("T", "iop");
  const sb = E.starBonus; E.starBonus = () => 1000; // étoiles de zone : butin et XP au plafond
  try {
    S.cons.bonbon_prospecteur = 1; delete S.boosts.drop;
    const r = E.useConsumable(S, "bonbon_prospecteur");
    assert.ok(/plafond/.test(r) && S.cons.bonbon_prospecteur === 1 && !S.boosts.drop, `prospecteur au plafond : ${r}`);
    S.cons.bonbon_royal = 1; assert.strictEqual(E.useConsumable(S, "bonbon_royal"), null, "le Royal donne encore des kamas"); assert.ok(!S.cons.bonbon_royal);
    S.cons.bonbon_sagesse = 1; assert.strictEqual(E.useConsumable(S, "bonbon_sagesse"), null, "la Sagesse est hors plafond");
  } finally { E.starBonus = sb; }
  S.cons.bonbon_prospecteur = 1; assert.strictEqual(E.useConsumable(S, "bonbon_prospecteur"), null, "sous le plafond : utilisable");
  console.log("ok - bonbon gardé quand le plafond est atteint");
}

// 4. Les consommables à effet immédiat.
for (const mono of [false, true]) {
  let S = E.newState("T", "iop"); if (mono) S = E.monoStart(S);
  const tag = mono ? " (Monocompte)" : "";
  // Potion de Savoir : au moins un niveau de métier de récolte
  const job = Object.keys(D.GATHER_JOBS)[0]; const l0 = S.jobs[job].lvl; S.cons.potion_savoir = 1;
  assert.strictEqual(E.useConsumable(S, "potion_savoir", job), null); assert.ok(S.jobs[job].lvl > l0, "Potion de Savoir" + tag);
  // Cristal de Forgemagie
  S.cons.cristal_fm = 1; assert.strictEqual(E.useConsumable(S, "cristal_fm"), null); assert.strictEqual(S.fmShield, true, "Cristal" + tag);
  // parchemins de caractéristique
  S.cons.parch_fo_g = 1; assert.strictEqual(E.useConsumable(S, "parch_fo_g", S.chars[0].id), null); assert.strictEqual(S.chars[0].scrolls.fo, 3, "Grand parchemin" + tag);
  // coffres
  for (const k of ["coffre_bois", "coffre_argent", "coffre_or", "coffre_obsidienne", "coffre_douze"]) { const k0 = S.kamas; S.cons[k] = 1; assert.strictEqual(E.useConsumable(S, k), null, k + tag); assert.ok(S.kamas > k0, k + " donne des kamas" + tag); }
  // automatiques : refus clair, rien n'est retiré
  for (const k of ["fiole_resu", "parchemin_avis", "filet", "pierre_ame"]) { S.cons[k] = 1; assert.ok(/automatiquement/.test(E.useConsumable(S, k)) && S.cons[k] === 1, k + tag); }
  console.log("ok - effets immédiats" + tag);
}
// Sablier : Fiole de temps et Grain de Xélor remplissent la réserve (Classique)
{
  const S = E.newState("T", "iop"); E.sabUnlocked = () => true; const r0 = E.sab(S).r;
  S.cons.fiole_temps = 1; assert.strictEqual(E.useConsumable(S, "fiole_temps"), null); assert.strictEqual(E.sab(S).r - r0, 3600, "Fiole de temps");
  S.cons.grain_xelor = 1; assert.strictEqual(E.useConsumable(S, "grain_xelor"), null); assert.strictEqual(E.sab(S).r - r0, 4500, "Grain de Xélor");
  console.log("ok - Sablier");
}
console.log("consommables.test : OK");
