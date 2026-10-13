/* ============================================================================
   BOSS DES MONDES — Idlus (multijoueur, 0.1.49)
   Tout le serveur frappe le même boss : une barre de PV commune. Quand elle tombe à zéro,
   tous ceux qui l'ont frappé sont récompensés et le boss suivant de la rotation arrive aussitôt.
   Comme le World Boss de Summoners War : 3 essais par jour, 15 tours par essai, un grade de C à SSS.
   Gargandyas, le Titan enchaîné par les Osamodas, ouvre la rotation ; ses 4 objets de DOFUS
   s'échangent contre des Fragments d'anomalie gagnés à chaque essai.
   Ici : les règles et le combat (sans DOM). Le serveur (supabase/wboss.sql + fonction « record »)
   tient la barre commune et rejoue chaque essai avec ce même fichier. Interface : js/wbossui.js.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { DUNGEONS, MONSTERS, ITEMS, RES } = D;

  /* ---------- Gargandyas et son butin (données de DOFUS, via DofusDB) ---------- */
  const GARGA = "m8062";
  if (!MONSTERS[GARGA]) MONSTERS[GARGA] = {
    name: "Gargandyas", dbid: 8062, img: 2513, lvl: [200, 200], el: "t", res: { t: 30, f: 20, e: 20, a: 10 }, race: 324, boss: true, wboss: true, items: [], drops: [], hp: 5, dmg: 1.25,
    sp: [
      { n: "Sceaux Telluriques", cd: 0, fx: [{ k: "dmg", el: "t", min: 76, max: 95, n: 1 }] },
      { n: "Rafale Bestiale", cd: 2, fx: [{ k: "dmg", el: "a", min: 61, max: 80, n: 9 }] },
      { n: "Amnésie Animale", cd: 3, fx: [{ k: "dmg", el: "t", min: 41, max: 50, n: 1 }, { k: "apdrain", v: 2, n: 1 }] },
    ],
  };
  if (D.RACES && !D.RACES[324]) D.RACES[324] = "Titans";
  const FRAG = "Fragment d'anomalie";
  if (!RES[FRAG]) RES[FRAG] = { id: 26870, icon: 176051, lvl: 200, price: 1, type: 266 };
  const ITEM = (id, name, icon, slot, stats) => { if (!ITEMS[id]) ITEMS[id] = { name, dbid: +id.slice(1), icon, slot, lvl: 200, stats, wboss: GARGA }; };
  ITEM("i31789", "Collier de Gargandyas", 1328, "amulette", { vit: [451, 500], sa: [41, 60], pui: [41, 60], cri: [3, 4], pa: [2, 2] });
  ITEM("i31786", "Griffe de Gargandyas", 6114, "arme", { vit: [451, 500], sa: [51, 60], pui: [61, 80], cri: [4, 7], dn: [16, 20], dt: [16, 20], df: [16, 20], de: [16, 20], da: [16, 20], ini: [401, 500] });
  ITEM("i31787", "Fureur de Gargandyas", 7091, "arme", { vit: [451, 500], sa: [51, 60], pui: [61, 80], cri: [4, 7], dn: [16, 20], dt: [16, 20], df: [16, 20], de: [16, 20], da: [16, 20], ini: [401, 500], dcri: [16, 20] });
  ITEM("i31788", "Bélier de Gargandyas", 82344, "bouclier", { vit: [201, 250], sa: [31, 50], ini: [401, 500], rn: [4, 5], rt: [4, 5], rf: [4, 5], re: [4, 5], ra: [4, 5] });
  E.WB_FRAG = FRAG;
  /* prix en Fragments d'anomalie (boutique de la page) */
  E.WB_SHOP = [["i31789", 120], ["i31786", 100], ["i31787", 100], ["i31788", 80]];
  if (E.RES_SOURCE) E.RES_SOURCE[FRAG] = "Boss des mondes : chaque essai (selon le grade) et la mort du boss.";

  /* ---------- règles ---------- */
  E.WB_TRIES = 3;     // essais par jour (heure de Paris)
  E.WB_ROUNDS = 15;   // tours par essai
  E.WB_HP_MULT = 1000;
  E.WB_PV = 100;      // affichage : 1 point = 100 PV
  E.WB_HP0 = 20000;   // PV (en points) du premier passage de Gargandyas : environ 2 jours (choix G4)
  E.WB_DAY_S = 86400; // un boss doit tenir environ un jour : les PV du suivant s'ajustent (supabase/wboss.sql)
  /* grades d'un essai (points) : coffre ouvert tout de suite et Fragments d'anomalie */
  E.WB_GRADES = [
    { g: "SSS", min: 600, cons: { coffre_obsidienne: 1 }, frag: 6 },
    { g: "SS", min: 450, cons: { coffre_or: 1 }, frag: 5 },
    { g: "S", min: 300, cons: { coffre_argent: 2 }, frag: 4 },
    { g: "A", min: 200, cons: { coffre_argent: 1 }, frag: 3 },
    { g: "B", min: 100, cons: { coffre_bois: 2 }, frag: 2 },
    { g: "C", min: 0, cons: { coffre_bois: 1 }, frag: 1 },
  ];
  E.wbGrade = (pts) => E.WB_GRADES.find((x) => pts >= x.min) || E.WB_GRADES[E.WB_GRADES.length - 1];
  /* récompenses à la mort du boss (même chose dans supabase/wboss.sql) */
  E.WB_KILL = { all: { cons: { coffre_or: 1 }, frag: 10 }, top3: { cons: { coffre_douze: 1 }, frag: 30, title: "Fléau des mondes" }, first: "Briseur de Titan", xpH: 1, xp: 10 };
  /* phases liées à la barre commune (choix G1) : sous 66 % il frappe 30 % plus fort, sous 33 % il est enragé et subit 25 % de plus */
  E.wbPhase = (dmg, hp) => { const r = hp > 0 ? dmg / hp : 0; return r >= 2 / 3 ? 3 : r >= 1 / 3 ? 2 : 1; };

  /* La rotation (choix 9 et G5) : Gargandyas, puis huit grands boss, puis Gargandyas revient. weak / res = élément faible (+50 %) et résistant (−50 %). */
  E.WB_ROT = [
    { mon: GARGA, weak: "a", res: "t", line: "a brisé son collier !", story: "Le Titan enchaîné par les Osamodas est libre. Tout le serveur doit l'abattre avant qu'il ne ravage le Monde des Douze.", ph: ["Cri Primitif", "Gargameha"], mech: ["charge", "seisme", "terreur"] },
    { did: "cavernes_kolosso", weak: "f", res: "a", line: "sort des glaces !", story: "Le colosse de glace a quitté ses cavernes. Le froid gagne tout le Monde des Douze." },
    { did: "antre_korriandre", weak: "t", res: "a", line: "étend ses racines !", story: "La gardienne de la forêt se réveille et ses racines envahissent les routes." },
    { did: "donjon_harebourg", weak: "f", res: "e", line: "arrête le temps !", story: "Le Comte Harebourg a quitté Frigost. Ses horloges sonnent pour tout le monde." },
    { did: "temple_ougah", weak: "a", res: "e", line: "a faim !", story: "Ougah est sorti de son temple et dévore tout sur son passage." },
    { did: "palais_nidas", weak: "e", res: "t", line: "veut tout changer en or !", story: "Le Roi Nidas ouvre les portes de son palais. Ce qu'il touche devient or." },
    { did: "belvedere_ilyzaelle", weak: "e", res: "f", line: "descend de son belvédère !", story: "Ilyzaelle et ses serviteurs se dressent contre les héros." },
    { did: "labo_nileza", weak: "t", res: "e", line: "lâche ses inventions !", story: "Les machines de Nileza envahissent le Monde des Douze." },
    { did: "oeil_vortex", weak: "f", res: "t", line: "aspire le monde !", story: "Le Vortex grandit : il faut le refermer avant qu'il n'avale tout." },
  ];
  E.WB_PH_NAMES = ["Colère", "Fureur"];
  /* Force de chaque boss : multiplicateur de points pour qu'une équipe bien équipée fasse environ 300 points (grade S) par essai.
     Table générée par `node tools/wboss_calib.js`. */
  E.WB_POW = /*WB_POW*/{"garga":1.02,"cavernes_kolosso":0.59,"antre_korriandre":0.42,"donjon_harebourg":0.48,"temple_ougah":0.57,"palais_nidas":0.8,"belvedere_ilyzaelle":0.66,"labo_nileza":0.43,"oeil_vortex":0.76}/*/WB_POW*/;
  const ELN = { n: "Neutre", t: "Terre", f: "Feu", e: "Eau", a: "Air" };
  E.wbElName = (k) => ELN[k] || k;
  /* boss n (1, 2, 3…) de la rotation */
  E.wbDef = (n) => {
    const i = ((Math.max(1, n | 0) - 1) % E.WB_ROT.length + E.WB_ROT.length) % E.WB_ROT.length; const R = E.WB_ROT[i];
    const mon = R.mon || (DUNGEONS[R.did] && DUNGEONS[R.did].boss); const M = MONSTERS[mon] || {};
    return Object.assign({ n: n | 0, i, key: R.mon ? "garga" : R.did, mon, name: M.name || "?", img: M.img, pow: E.WB_POW[R.mon ? "garga" : R.did] || 1, phNames: R.ph || E.WB_PH_NAMES }, R);
  };

  /* mécaniques gardées sur un boss des mondes : rien qui demande des serviteurs, bloque les dégâts ou change ses résistances */
  const KEEP = new Set(["enrage", "charge", "weakspot", "seisme", "riposte", "reflet", "miasmes", "brise", "putrefaction", "condamne", "mutisme", "terreur", "frenesie",
    "distorsion", "tapis", "maree", "petrif", "aspiration", "dore", "larcin", "taureau", "glyphes", "racines", "glace"]);
  E.wbMechs = (def) => (def.mech || E.bossMechs(def.did)).filter((k) => KEEP.has(k));

  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* hasard d'un essai : boss n, joueur, numéro de l'essai sur ce boss (le serveur le refait) */
  E.wbSeed = (n, uid, k) => hash(`idlus|wb|${n}|${uid}|${k}`);

  /* Un essai pas à pas (pour « Revoir le combat ») : W.S2 est une copie de la partie, le hasard est fixé par seed. */
  E.wbWatch = (S, def, phase, seed, now = E.now()) => {
    const S2 = JSON.parse(E.serialize(S));
    S2.fight = null; S2.pause = 0; S2.acc = 0; S2.hunting = false; S2.protector = null; S2.manualLive = false;
    S2.settings = Object.assign({}, S2.settings, { manual: false });
    S2.cons = Object.assign({}, S2.cons); delete S2.cons.fiole_resu;
    S2.idols = Object.assign({}, S2.idols, { active: [] });
    const team = E.team(S2); if (!team.length) return { err: "Il faut au moins un héros dans l'équipe." };
    const W = { def, phase, rng: mulberry(seed >>> 0), now, S2, done: false };
    const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    const host = def.did && DUNGEONS[def.did];
    const mobs = host ? host.bossMobs : DUNGEONS.donjon_harebourg ? DUNGEONS.donjon_harebourg.bossMobs : DUNGEONS[Object.keys(DUNGEONS).find((k) => (DUNGEONS[k].bossMobs || []).length)].bossMobs;
    W.tmp = "wb_" + def.key; W.dg = { name: def.name, lvl: 200, boss: def.mon, rooms: [{}], bossMobs: mobs, coBoss: [] }; const tmp = W.tmp; DUNGEONS[tmp] = W.dg;
    try {
      E.setRng(W.rng); E.setClock(() => now);
      S2.dungeon = { id: tmp, room: 1, stasis: 4, chain: 1, t: 0, syncLvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length), mods: [], eliteRoom: -1, gboss: true };
      const F = E.startFight(S2); if (!F) return { err: "Combat impossible." };
      const B = F.ents[F.bossIdx]; if (!B) return { err: "Boss introuvable." };
      F.ents.forEach((e) => { if (e.side === "m" && e !== B) { e.alive = false; e.hp = 0; e.gone = true; } }); // seul contre le boss
      B.mech = E.wbMechs(def); B.mturn = 0; B.shield = 0;
      W.base = B.hpMax; B.hpMax = B.hp = W.base * E.WB_HP_MULT;
      const R = { n: 0, t: 0, f: 0, e: 0, a: 0 }; R[def.weak] = -50; R[def.res] = 50; B.res = R;
      if (phase >= 2) B.dmg *= 1.3;
      if (phase >= 3) B.debuffs.push({ vuln: 25, turns: 9999 });
      F.label = `Boss des mondes · ${def.name}${phase > 1 ? ` · ${def.phNames[phase - 2]}` : ""}`; F.wboss = true;
      W.B = B; W.S2.dungeon.wb = true;
      return W;
    } finally { delete DUNGEONS[tmp]; E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  E.wbWatchStep = (W) => {
    if (W.done) return "end";
    const F = W.S2.fight; const rng0 = E.getRng(), clock0 = E.getClock(), evLen = E.events.length;
    try {
      E.setRng(W.rng); E.setClock(() => W.now); DUNGEONS[W.tmp] = W.dg; // le donjon de passage n'existe que pendant le combat
      E.step(W.S2);
      if (F.over || F.round > E.WB_ROUNDS || !F.ents.some((e) => e.side === "c" && !e.summon && e.alive)) { W.done = true; return "end"; }
      return "step";
    } finally { delete DUNGEONS[W.tmp]; E.setRng(rng0); E.setClock(clock0); E.events.length = evLen; }
  };
  E.wbResult = (W) => {
    const F = W.S2.fight; const B = W.B;
    const dmg = Math.max(0, B.hpMax - Math.max(0, B.hp)); const raw = (dmg / W.base) * 100;
    const points = Math.round(raw * (W.def.pow || 1));
    return { points, raw: Math.round(raw), pv: points * E.WB_PV, grade: E.wbGrade(points).g, rounds: Math.min(F.round, E.WB_ROUNDS), alive: F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length };
  };
  /* Un essai joué d'un coup. Renvoie { points, raw, pv, grade, rounds, alive } ou { err }. */
  E.wbSim = (S, def, phase, seed, now = E.now()) => {
    const W = E.wbWatch(S, def, phase, seed, now); if (W.err) return W;
    for (let g = 0; g < 200000 && !W.done; g++) E.wbWatchStep(W);
    return E.wbResult(W);
  };

  /* ---------- boutique de Fragments ---------- */
  E.wbFrags = (S) => (S.res && S.res[FRAG]) || 0;
  E.wbBuy = (S, tpl) => {
    const e = E.WB_SHOP.find(([t]) => t === tpl); if (!e || !ITEMS[tpl]) return { err: "Objet inconnu." };
    if (E.wbFrags(S) < e[1]) return { err: `Il te faut ${e[1]} Fragments d'anomalie.` };
    S.res[FRAG] -= e[1]; if (!S.res[FRAG]) delete S.res[FRAG];
    const it = E.rollItem(S, tpl); return { ok: true, it };
  };

  /* ---------- bonus d'XP pour tout le monde après une victoire (choix 8) : donné par le serveur ---------- */
  E.wbXpUntil = 0;
  const ev0 = E.evMult;
  if (ev0 && !ev0.wb) { E.evMult = (kind, t) => ev0(kind, t) * (kind === "xp" && (t || E.now()) < E.wbXpUntil ? 1 + E.WB_KILL.xp / 100 : 1); E.evMult.wb = true; }

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
