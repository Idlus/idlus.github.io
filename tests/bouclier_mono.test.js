/* Bouclier Monocompte (plan directeur, étape 5 ; js/verify_mono.js) : le code que la fonction serveur « mono » exécute,
   sans base de données.
   1. Une semaine de jeu normal simulée par le vrai moteur (chasse automatique, Sablier, hors ligne à 80 %, camp et
      spécialités, un combat de groupe en direct à 2 à 4 joueurs chaque jour, un donjon avec mercenaire) : chaque envoi
      (deux par jour) est accepté. Aucun faux refus, seul ou en groupe.
   2. Parties trichées : toutes refusées, et la partie validée ne change pas.
   Lancer : node tests/bouclier_mono.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "koli", "legendaires", "dofusp",
  "collections", "sram", "champions", "chroma", "alignement", "honneur", "quetes", "mono", "monopass", "monodofus", "monoalign", "saison1"].forEach((f) => require("../js/" + f + ".js"));
const V = require("../js/verify.js"); const VM = require("../js/verify_mono.js");
const D = require("../js/data.js");
assert.strictEqual(V.mono, VM);

let seed = 11; E.setRng(() => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
const DEBUT = Date.parse("2026-11-01T23:00:00Z"); // lundi 2 novembre, minuit à Paris
let now = DEBUT + 8 * 3600e3; E.setClock(() => now); V.now = () => now;
E.weekly = () => null; E.flash = () => [];

/* ---------- le serveur, en mémoire : dernière partie validée et ce qu'il refuse ---------- */
const H = { ok: null, refus: [], acc: 0 };
const ctx = () => ({ debut: DEBUT, date: now });
const regOf = (S) => ({ solde: E.tfBalance(S), genere: E.tfActTotal(S), max: E.tfBalance(S) });
const push = (S, label, o = {}) => {
  const txt = E.serialize(S);
  const r = VM.verifier(E, txt, Object.assign({ prev: H.ok, at: now, ctx: ctx(), reg: regOf(S) }, o));
  E.setClock(() => now); // la vérification rend l'horloge au jeu
  if (r.ok) { H.ok = { bilan: r.bilan, res: r.res, at: now, txt, resume: r.resume }; H.acc++; } else H.refus.push(label + " : " + r.why);
  return r;
};

/* ---------- une semaine de jeu normal ---------- */
const S = E.monoStart(E.newState("Évangéline", "iop")); S.mono.t0 = DEBUT; E.monoBoot(S); E.MONO.saisons[1].debut = DEBUT;
const me = S.chars[0]; me.inTeam = true;
S.settings.autoZone = true;
E.startHunt(S, Object.keys(E.SUBS).find((k) => E.SUBS[k].lvl && E.SUBS[k].lvl[0] <= 1));
assert(push(S, "départ").ok, "première partie refusée : " + H.refus.join(" | "));
const pal = (cls, lvl, n) => { const T = E.monoStart(E.newState(n, cls)); T.chars[0].lvl = lvl; E.autoAllocate(T, T.chars[0]); E.refreshSpells(T.chars[0], E.charStats(T, T.chars[0])); return E.monoSnap(T, T.chars[0]); };
const PALS = ["cra", "eni", "feca"];
let groups = 0, mercs = 0, agr = 0;
const tick = (h) => { for (let t = 0; t < h * 3600e3; t += 1000) { now += 1000; E.tick(S, 1000); } };
for (let day = 1; day <= 7; day++) {
  // soirée active : 3 h de jeu, Sablier ×2 tant qu'il reste de la réserve
  if (S.sablier) { S.sablier.open = true; S.sablier.spd = 2; }
  tick(1.5);
  if (me.lvl >= 30 && !(S.align && S.align.side)) assert.strictEqual(E.chooseAlign(S, "bonta", "coeur"), null);
  if (S.align && S.align.side) { E.honInit(S); for (let i = 0; i < 5; i++) { const r = E.agrFight(S, i); if (r.err) break; agr++; } for (let k = 0; k < 3; k++) { S.align.ag.defAt = 1; E.honDefTick(S); } } // 5 agressions et 3 défenses par jour (joueur actif)
  if (!(S.mono.spec || []).filter(Boolean).length) { E.monoSetSpec(S, 0, "paysan"); E.monoSetSpec(S, 1, "bucheron"); }
  // un combat de groupe en direct (2 à 4 joueurs), butin individuel
  const did = Object.keys(D.DUNGEONS).filter((d) => D.DUNGEONS[d].lvl <= me.lvl).sort((a, b) => D.DUNGEONS[b].lvl - D.DUNGEONS[a].lvl)[0];
  if (did) {
    const snaps = [E.monoSnap(S, me)].concat(PALS.slice(0, 1 + (day % 3)).map((c, i) => pal(c, me.lvl, "Ami" + i)));
    const R = E.monoGroupRun(snaps, did, 1, 1000 + day); R.did = did; R.stasis = 1;
    E.monoGroupLoot(S, R); groups++;
  }
  // un donjon seul avec mercenaire si on a la clef
  const dk = did && D.DUNGEONS[did].key;
  if (dk && (S.res[dk] || 0) > 0 && S.kamas >= E.MONO.merc.cost && !S.dungeon) { if (!E.monoEnter(S, did, 1, "eni")) { mercs++; tick(0.25); } }
  tick(1.5);
  if (S.dungeon) tick(0.5);
  assert(push(S, `jour ${day}, soir`).ok, `jour ${day} soir refusé : ${H.refus.join(" | ")}`);
  // nuit et journée hors ligne (21 h), rendement hors ligne du Monocompte (80 %)
  E.catchUp(S, 21 * 3600); now += 21 * 3600e3;
  assert(push(S, `jour ${day + 1}, retour`).ok, `jour ${day + 1} retour refusé : ${H.refus.join(" | ")}`);
}
assert.strictEqual(H.refus.length, 0, "faux refus : " + H.refus.join(" | "));
const R0 = H.ok.resume;
console.log(`ok - semaine normale : ${H.acc} envois acceptés, aucun faux refus (niveau ${me.lvl}, ${S.kamas.toLocaleString("fr-FR")} kamas, ${groups} combats de groupe, ${mercs} donjons avec mercenaire, ${agr} agressions, honneur ${Math.round((S.align || {}).hon || 0)}, rang ${R0.rang})`);
assert(R0.niveau === me.lvl && R0.classe === "iop" && R0.nom === "Évangéline" && R0.camp === "bonta" && R0.phenix && typeof R0.defis === "object", "résumé du serveur : " + JSON.stringify(R0));
assert(me.lvl < VM.lvlCap(ctx()), "le plafond de niveau garde de la marge");

/* ---------- parties trichées : toutes refusées, partie validée inchangée ---------- */
const good = H.ok.txt;
const cheat = (label, fn, o) => {
  const T = VM.load(E, good); fn(T); const before = H.ok.txt;
  const r = push(T, label, o); assert(!r.ok, `${label} : accepté`); assert.strictEqual(H.ok.txt, before, `${label} : la partie validée a changé`);
  console.log(`ok - refusé : ${label} (${r.why})`); return r;
};
now += 600e3;
const hero = (T) => T.chars.find((c) => !c.merc);
const dofusTpls = Object.keys(D.ITEMS).filter((k) => /^dofus_/.test(k) && k !== "dofus_phenix").slice(0, 4);
const RES = [];
RES.push(cheat("kamas gonflés", (T) => { T.kamas += 1e9; }));
RES.push(cheat("héros en double", (T) => { const c = JSON.parse(JSON.stringify(hero(T))); c.id = 99; c.name = "Clone"; T.chars.push(c); }));
RES.push(cheat("mercenaire gardé hors donjon", (T) => { const c = JSON.parse(JSON.stringify(hero(T))); c.id = 98; c.merc = 1; c.equip = {}; T.chars.push(c); T.dungeon = null; }));
RES.push(cheat("Maîtrise", (T) => { hero(T).mt = { lvl: 900, bn: 0 }; }));
RES.push(cheat("objet impossible", (T) => { const tpl = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].stats.vit && D.ITEMS[k].lvl <= 20); const it = E.rollItem(T, tpl, { radiant: false }); it.stats.vit = 99999; }));
RES.push(cheat("4ᵉ Dofus porté", (T) => { const c = hero(T); dofusTpls.forEach((tpl, i) => { const it = E.rollItem(T, tpl, { radiant: false }); c.equip["dofus" + (i + 1)] = it.uid; }); }));
RES.push(cheat("4 spécialités", (T) => { T.mono.spec = ["paysan", "bucheron", "mineur", "pecheur"]; }));
RES.push(cheat("métier à 150 hors spécialité", (T) => { T.jobs.mineur = { lvl: 150, xp: 0 }; }));
RES.push(cheat("pass de saison gonflé", (T) => { E.bpState(T).pts = 25000; }));
RES.push(cheat("palier du pass pris sans les points", (T) => { E.bpState(T).free[40] = now; }));
RES.push(cheat("honneur impossible", (T) => { T.align.hon = 200000; }));
RES.push(cheat("Dofus du Phénix sans sa quête", (T) => { E.rollItem(T, "dofus_phenix", { radiant: false }); }));
RES.push(cheat("quête du Phénix sautée", (T) => { E.dofusQuest(T, "phenix").step = 3; }));
RES.push(cheat("niveau 200 en une semaine… au jour 1", (T) => { hero(T).lvl = 200; }, { ctx: { debut: DEBUT, date: DEBUT + 20 * 3600e3 } }));
RES.push(cheat("défi gonflé", (T) => { const t = E.tfState(T); t.d.d1 = { p: 400, paid: 0 }; }));
RES.push(cheat("meilleure stasis de défi jamais faite", (T) => { const t = E.tfState(T); t.d.d7 = { p: 8, paid: 0 }; }));
RES.push(cheat("solde d'Éclats différent du registre (copie)", (T) => { E.tfState(T).srv = { solde: 5000, genere: 100, quota: 100, at: now }; E.tfSync(T); }, { reg: { solde: 40, genere: 40, max: 60 } }));
RES.push(cheat("solde d'Éclats différent du registre (registre provisoire)", (T) => { E.tfPost(T, 5000, "correction", "triche"); }));
RES.push(cheat("Éclats d'activité au-delà de la borne du jour", (T) => { E.tfPost(T, 60, "act", "act:9:job"); }));
RES.push(cheat("objet numéroté d'un autre joueur", (T) => { const it = E.rollItem(T, Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "cape" && D.ITEMS[k].lvl <= 20), { radiant: false }); it.sn = 77; }, { ctx: { debut: DEBUT, date: now, objets: { 12: true } } }));
{ const T = VM.load(E, good); const u = Object.keys(T.items)[0]; T.hdv = { op: 40, log: [] };
  const r = VM.verifier(E, E.serialize(T), { prev: H.ok, at: now, ctx: { debut: DEBUT, date: now, sortis: [{ uid: +u, tpl: T.items[u].tpl, op: 31 }] }, reg: regOf(T) }); E.setClock(() => now);
  assert(!r.ok && /encore dans le sac/.test(r.why), "objet vendu encore dans le sac : " + JSON.stringify(r)); console.log(`ok - refusé : objet vendu ou échangé encore dans le sac (${r.why})`); RES.push(r); }
// partie reculée après un gain : la partie de la veille, renvoyée après la partie validée
{ const T0 = VM.load(E, good); const old = E.serialize(T0); tick(0.5); push(S, "après"); const r = VM.verifier(E, old, { prev: H.ok, at: now + 60e3, ctx: ctx(), reg: regOf(T0) }); E.setClock(() => now);
  assert(!r.ok && /reculée/.test(r.why), "partie reculée acceptée : " + JSON.stringify(r)); console.log(`ok - refusé : partie reculée (${r.why})`); RES.push(r); }
{ const T = VM.load(E, H.ok.txt); T.hdv = { op: 5 }; const r = VM.verifier(E, E.serialize(T), { prev: Object.assign({}, H.ok, { bilan: Object.assign({}, H.ok.bilan, { op: 20 }) }), at: now + 60e3, ctx: ctx(), reg: regOf(T) }); E.setClock(() => now);
  assert(!r.ok && /reculée/.test(r.why), "opérations du serveur reculées : " + JSON.stringify(r)); console.log(`ok - refusé : opérations du serveur en arrière (${r.why})`); RES.push(r); }
assert(RES.every((r) => !r.ok), "100 % de refus");
console.log(`ok - ${RES.length} parties trichées, ${RES.length} refusées (100 %)`);
// une partie du Classique ou de l'Éternel n'entre jamais dans la saison
{ const C = E.newState("Classique", "iop"); const r = VM.verifier(E, E.serialize(C), { prev: null, at: now, ctx: ctx() }); assert(!r.ok, "partie Classique acceptée"); }
{ const T = VM.load(E, good); T.mono.eternel = { s: 1, at: now }; const r = VM.verifier(E, E.serialize(T), { prev: H.ok, at: now, ctx: ctx() }); E.setClock(() => now); assert(!r.ok, "partie de l'Éternel acceptée"); }
console.log("ok - partie Classique et partie de l'Éternel refusées dans la saison");
