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
  E.WB_S1_ITEMS = /*WB_S1_ITEMS*/{"eq":{"i8877":{"b":"kralamoure","name":"Kralano","icon":9142,"slot":"anneau","lvl":199,"stats":{"vit":[151,200],"ine":[31,50],"age":[31,50],"sa":[31,50],"cri":[2,3],"do":[4,6],"so":[6,10],"pp":[6,10],"rn":[6,10],"xn":[6,10]},"set":"s97"},"i9464":{"b":"kralamoure","name":"Kralamansion","icon":1142,"slot":"amulette","lvl":194,"stats":{"vit":[251,350],"sa":[31,40],"pui":[21,30],"cri":[4,5],"pa":[1,1],"do":[11,15],"so":[6,10],"pp":[21,30]},"set":"s97"},"i8991":{"b":"kralamoure","name":"Annolamour","icon":9145,"slot":"anneau","lvl":189,"stats":{"vit":[201,250],"fo":[31,50],"cha":[31,50],"sa":[31,50],"pui":[11,20],"do":[6,10],"pp":[11,15],"ini":[501,700],"xf":[6,10],"xe":[6,10]},"set":"s97"},"i13117":{"b":"kralamoure","name":"Amulette d'Otomaï","icon":1217,"slot":"amulette","lvl":197,"stats":{"vit":[301,350],"ine":[61,80],"sa":[31,50],"cri":[4,6],"pa":[1,1],"df":[14,18],"so":[8,12],"rf":[5,7],"re":[5,7],"tac":[4,6]},"set":"s241"},"i13118":{"b":"kralamoure","name":"Bottes d'Otomaï","icon":11217,"slot":"bottes","lvl":192,"stats":{"vit":[251,300],"ine":[61,80],"sa":[31,45],"cri":[2,3],"pm":[1,1],"df":[12,16],"so":[6,8],"rt":[7,10],"tac":[6,8]},"set":"s241"},"i13119":{"b":"kralamoure","name":"Épée d'Otomaï","icon":6719,"slot":"arme","lvl":196,"stats":{"vit":[251,300],"ine":[61,80],"sa":[21,30],"cri":[2,3],"df":[14,18],"pp":[11,15],"ini":[301,400],"xn":[16,20],"xe":[16,20],"tac":[7,10]},"set":"s241"},"i30689":{"b":"kralamoure","name":"Fiole d'Otomaï","icon":82513,"slot":"bouclier","lvl":196,"stats":{"vit":[151,200],"ine":[51,70],"sa":[21,30],"cri":[4,5],"pp":[11,15],"rn":[5,7],"rf":[5,7]},"set":"s241"},"i27510":{"b":"cire_momore","name":"Claymomore","icon":6755,"slot":"arme","lvl":200,"stats":{"vit":[451,500],"sa":[31,40],"pui":[41,50],"dt":[9,12],"df":[9,12],"de":[9,12],"da":[9,12],"pp":[11,15],"rn":[2,3],"rt":[2,3],"rf":[2,3],"re":[2,3],"ra":[2,3],"tac":[11,15]},"set":"s507"},"i27511":{"b":"cire_momore","name":"Chagrin de Cire","icon":16751,"slot":"coiffe","lvl":200,"stats":{"vit":[451,500],"sa":[31,40],"pui":[41,50],"dt":[9,12],"df":[9,12],"de":[9,12],"da":[9,12],"pp":[11,15],"ini":[301,400],"rn":[7,10],"tac":[16,20]},"set":"s507"},"i27512":{"b":"cire_momore","name":"Âmes Hurlantes","icon":17564,"slot":"cape","lvl":200,"stats":{"vit":[451,500],"sa":[31,40],"pui":[41,50],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"ini":[501,600],"ra":[7,10],"tac":[11,15]},"set":"s507"},"i27513":{"b":"cire_momore","name":"Lourd Fardeau","icon":1323,"slot":"amulette","lvl":200,"stats":{"vit":[351,400],"sa":[41,50],"pui":[41,50],"pa":[1,1],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[7,10],"re":[7,10],"tac":[16,20]},"set":"s507"},"i27514":{"b":"cire_momore","name":"Éternelle Poursuite","icon":11376,"slot":"bottes","lvl":200,"stats":{"vit":[351,400],"sa":[31,40],"pui":[41,50],"pm":[1,1],"dt":[11,15],"df":[11,15],"de":[11,15],"da":[11,15],"pp":[7,10],"rf":[7,10],"tac":[7,10]},"set":"s507"},"i27515":{"b":"cire_momore","name":"Triste Sceau","icon":9378,"slot":"anneau","lvl":200,"stats":{"vit":[251,300],"sa":[16,20],"pui":[31,40],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[7,10],"rt":[7,10],"tac":[5,7]},"set":"s507"}},"ap":{"i18632":{"b":"kralamoure","name":"Bouclier du Kralamoure géant","icon":82147,"kind":"Bouclier d'apparat"},"i27371":{"b":"cire_momore","name":"Cuirasse de Cire Momore","icon":82421,"kind":"Bouclier d'apparat"},"i29114":{"b":"grozilla","name":"Vulklier","icon":82455,"kind":"Bouclier d'apparat"},"i20136":{"b":"grozilla","name":"Bouloute d'Halouine","icon":18153,"kind":"Familier d'apparat"},"i20052":{"b":"grozilla","name":"Minowang","icon":18150,"kind":"Familier d'apparat"},"i21147":{"b":"grozilla","name":"Lagon-dinde","icon":182039,"kind":"Monture d'apparat"},"i21148":{"b":"grozilla","name":"Muldo d'eau","icon":182040,"kind":"Monture d'apparat"}},"sets":{"s241":{"name":"Panoplie d'Otomaï","bonus":{"2":{"ine":40,"cri":5,"pp":20,"tac":10},"3":{"pp":20,"pa":1,"tac":10,"cri":5,"ine":40},"4":{"pp":20,"pa":1,"tac":10,"cri":5,"ine":40}},"size":4},"s507":{"name":"Malédiction de Cire Momore","bonus":{"2":{"fui":-10,"ini":300,"rn":2,"rf":2,"ra":2,"re":2,"rt":2,"pui":30,"tac":7},"3":{"fui":-20,"ini":500,"rn":4,"rf":4,"ra":4,"re":4,"rt":4,"pui":60,"tac":10,"pa":1},"4":{"pa":1,"tac":15,"pui":100,"rt":6,"re":6,"ra":6,"rf":6,"rn":6,"ini":750,"fui":-25},"5":{"pa":1,"tac":20,"pui":150,"rt":8,"re":8,"ra":8,"rf":8,"rn":8,"ini":1000,"fui":-35},"6":{"fui":-50,"ini":1500,"rf":10,"re":10,"ra":10,"rt":10,"rn":10,"pui":200,"tac":30,"pa":2}},"size":6},"s97":{"name":"Panoplie Ventouse","bonus":{"2":{"pui":40,"sa":30,"ra":5,"re":5,"rf":5,"rt":5,"pp":30,"so":50},"3":{"xa":30,"xt":30,"ra":5,"re":5,"rf":5,"rt":5,"pui":40,"sa":30,"pp":30,"so":50,"pa":1,"xe":20,"xf":20}},"size":3}}}/*/WB_S1_ITEMS*/; // objets des géants (tools/wboss_s1_items.py)
  /* prix en Fragments d'anomalie (boutique de la page) */
  E.WB_SHOP = [["i31789", 120], ["i31786", 100], ["i31787", 100], ["i31788", 80]];
  if (E.RES_SOURCE) E.RES_SOURCE[FRAG] = "Boss des mondes : chaque essai (selon le grade) et la mort du boss.";

  /* ---------- règles ---------- */
  E.WB_TRIES = 3;     // essais par jour (heure de Paris)
  E.WB_ROUNDS = 15;   // tours par essai
  E.WB_HP_MULT = 1000;
  E.WB_PV = 100;      // affichage : 1 point = 100 PV
  E.WB_HP0 = 10000;   // PV (en points) du premier passage de Gargandyas : environ 2 jours (choix G4 ; 20 000 jusqu'en 0.1.50.3)
  E.WB_DAY_S = 86400; // un boss doit tenir environ un jour : les PV du suivant s'ajustent (supabase/wboss.sql)
  /* grades d'un essai (points) : coffre ouvert tout de suite et Fragments d'anomalie */
  /* 0.1.56 : grille recalculée avec le nouveau calcul (8 héros bien équipés : B au niveau 60, S vers 120-160, SSS au niveau 200)
     1.0.4.6 : l'essai compte le TOTAL de ses 3 combats, la grille est donc ×3 (mêmes grades qu'avant avec la moyenne) */
  E.WB_GRADES = [
    { g: "SSS", min: 1500, cons: { coffre_obsidienne: 1 }, frag: 6 },
    { g: "SS", min: 1050, cons: { coffre_or: 1 }, frag: 5 },
    { g: "S", min: 600, cons: { coffre_argent: 2 }, frag: 4 },
    { g: "A", min: 300, cons: { coffre_argent: 1 }, frag: 3 },
    { g: "B", min: 150, cons: { coffre_bois: 2 }, frag: 2 },
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
  E.WB_POW = /*WB_POW*/{"garga":0.83,"cavernes_kolosso":0.58,"antre_korriandre":0.42,"donjon_harebourg":0.47,"temple_ougah":0.58,"palais_nidas":0.77,"belvedere_ilyzaelle":0.66,"labo_nileza":0.44,"oeil_vortex":0.78,"s1_garga":0.85,"s1_kralamoure":0.4,"s1_cire_momore":0.6,"s1_grozilla":0.74,"s1_chazino":0.52}/*/WB_POW*/;
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
    const S2 = E.deserialize(E.serialize(S)); // comme le serveur (fonction « record ») : même partie, même combat
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
      S2.dungeon = { id: tmp, room: 1, stasis: 4, chain: 1, t: 0, syncLvl: Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length), mods: [], eliteRoom: -1, gboss: true }; W.lvl = S2.dungeon.syncLvl; W.n = team.length;
      const F = E.startFight(S2); if (!F) return { err: "Combat impossible." };
      const B = F.ents[F.bossIdx]; if (!B) return { err: "Boss introuvable." };
      F.ents.forEach((e) => { if (e.side === "m" && e !== B) { e.alive = false; e.hp = 0; e.gone = true; } }); // seul contre le boss
      B.mech = E.wbMechs(def); B.mturn = 0; B.shield = 0;
      W.base = B.hpMax; B.hpRef = W.base; B.hpMax = B.hp = W.base * E.WB_HP_MULT; // 2.0.6 : vie de référence (comme le boss de guilde)
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
  /* 0.1.56 « Boss des mondes rééquilibré » (choix de Mathis) :
     - le niveau compte : ×2,2 au niveau 200, courbe en puissance 1,7 (8 héros bien équipés : B au niveau 60, SSS au niveau 200) ;
       WB_LVLPOW corrige d'abord l'écart naturel entre niveaux (sans lui, les niveaux 60-80 faisaient le plus de points) ;
     - le nombre de héros compte : les PV du boss sont ramenés à une équipe de 8 (4 héros font environ moitié moins) ;
     - l'équipement compte toujours, puisque les dégâts viennent du vrai combat. */
  E.WB_LVLPOW = [[20, 0.95], [40, 0.93], [60, 0.55], [80, 0.53], [100, 0.67], [120, 0.78], [140, 0.82], [160, 0.71], [180, 0.72], [200, 1.03]];
  E.wbLvlPow = (lvl) => { const T = E.WB_LVLPOW; if (lvl <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (lvl <= T[i][0]) { const [a, x] = T[i - 1], [b, y] = T[i]; return x + ((y - x) * (lvl - a)) / (b - a); } return T[T.length - 1][1]; };
  E.WB_LVL200 = 2.2; E.WB_LVLEXP = 1.7; E.WB_TEAM_REF = 8;
  E.wbTeamK = (n) => (1 + Math.max(1, n) * 1.1) / (1 + E.WB_TEAM_REF * 1.1); // même formule que les PV des boss de donjon (engine.js)
  E.wbMult = (lvl, n) => E.wbLvlPow(lvl) * E.WB_LVL200 * Math.pow(Math.max(1, lvl) / 200, E.WB_LVLEXP) * E.wbTeamK(n);
  E.WB_CHARGE = 1.5; // la Charge du boss des mondes frappe ×1,5 (×2,2 en donjon) : elle balayait toute l'équipe un essai sur deux
  E.wbResult = (W) => {
    const F = W.S2.fight; const B = W.B;
    const dmg = Math.max(0, B.hpMax - Math.max(0, B.hp)); const raw = (dmg / W.base) * 100;
    const points = Math.round(raw * (W.def.pow || 1) * E.wbMult(W.lvl || 1, W.n || 1));
    return { points, raw: Math.round(raw), pv: points * E.WB_PV, grade: E.wbGrade(points).g, rounds: Math.min(F.round, E.WB_ROUNDS), alive: F.ents.filter((e) => e.side === "c" && !e.summon && e.alive).length };
  };
  /* Un combat joué d'un coup. Renvoie { points, raw, pv, grade, rounds, alive } ou { err }. */
  E.wbFight = (S, def, phase, seed, now = E.now()) => {
    const W = E.wbWatch(S, def, phase, seed, now); if (W.err) return W;
    for (let g = 0; g < 200000 && !W.done; g++) E.wbWatchStep(W);
    return E.wbResult(W);
  };
  /* 0.1.56 : un essai = 3 combats (hasard tiré de seed) ; watchSeed = le combat le plus proche de la moyenne (« Revoir le combat »).
     1.0.4.6 : les points de l'essai sont le TOTAL des 3 combats (avant : la moyenne, un seul combat semblait compter) ; raw reste la moyenne (calibrage). */
  E.WB_FIGHTS = 3;
  E.wbSim = (S, def, phase, seed, now = E.now()) => {
    const L = [];
    for (let i = 0; i < E.WB_FIGHTS; i++) { const sd = i ? hash(`${seed >>> 0}|${i}`) : seed >>> 0; const r = E.wbFight(S, def, phase, sd, now); if (r.err) return r; L.push(Object.assign({ seed: sd }, r)); }
    const points = L.reduce((a, r) => a + r.points, 0); const avg = points / L.length;
    const near = L.slice().sort((a, b) => Math.abs(a.points - avg) - Math.abs(b.points - avg))[0];
    return { points, raw: Math.round(L.reduce((a, r) => a + r.raw, 0) / L.length), pv: points * E.WB_PV, grade: E.wbGrade(points).g, rounds: near.rounds, alive: near.alive, watchSeed: near.seed,
      fights: L.map((r) => ({ points: r.points, rounds: r.rounds, alive: r.alive, seed: r.seed })) };
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


  /* ============================================================================
     SAISON 1 (Classique · Saison 1, E.isS1c) — refonte validée par Mathis le 03/11/2026 (maquette « Boss des mondes Saison 1 ») :
     1A un boss par semaine de saison, qui s'enfuit à la fin de sa semaine ; 2A paliers du serveur à 25/50/75/100 % ;
     3A paliers d'essais (Bronze 3, Argent 9, Or 18) et podium du meilleur essai ; 4B Fragments d'anomalie et boutique ;
     5 rotation Gargandyas + 4 géants de DOFUS (Kralamoure Géant, Cire Momore, Grozilla et Grasmera, Chazino), puis 3 retours
     avec une mécanique en plus ; 7A une mécanique propre à chaque boss, annoncée ; 9A-12A boutique (équipements, apparat,
     consommables ; rayon ouvert à l'arrivée du boss ; prix 55-90 ; onglet de la page). Plafond de 6 000 points par essai.
     L'Éternel garde les règles du dessus. Serveur : supabase/wboss_s1.sql (espace s1).
     ========================================================================== */
  const MON = (k, name, dbid, img, el, res, sp) => { if (!MONSTERS[k]) MONSTERS[k] = { name, dbid, img, lvl: [200, 200], el, res, race: 324, boss: true, wboss: true, items: [], drops: [], hp: 5, dmg: 1.25, sp }; };
  const dmgSp = (n, el, min, max, cd = 0, extra) => ({ n, cd, fx: [Object.assign({ k: "dmg", el, min, max, n: 1 }, extra || {})] });
  MON("m423", "Kralamoure Géant", 423, 227, "e", { e: 30, t: 10, f: 20, a: 20 }, [dmgSp("Tentacule", "e", 70, 90), dmgSp("Encre des abysses", "e", 45, 60, 2, { n: 6 }), dmgSp("Ventouse", "t", 50, 65, 3)]);
  MON("m7222", "Cire Momore", 7222, 2299, "f", { f: 30, e: 10, t: 20, a: 20 }, [dmgSp("Cire brûlante", "f", 72, 92), dmgSp("Lamentation", "a", 40, 55, 2, { n: 7 }), dmgSp("Triste Sceau", "f", 55, 70, 3)]);
  MON("m3142", "Grozilla et Grasmera", 3142, 874, "t", { t: 30, a: 10, f: 20, e: 20 }, [dmgSp("Morsure de Grozilla", "t", 75, 95), dmgSp("Souffle de Grasmera", "f", 45, 58, 2, { n: 7 }), dmgSp("Queue de lave", "t", 50, 65, 3)]);
  MON("m4363", "Chazino", 4363, 1391, "a", { a: 30, f: 10, t: 20, e: 20 }, [dmgSp("Lame du croupier", "a", 70, 90), dmgSp("Mise doublée", "a", 42, 58, 2, { n: 7 }), dmgSp("Jeton maudit", "e", 50, 65, 3)]);
  if (D.RACES && !D.RACES[324]) D.RACES[324] = "Titans";
  /* les objets des géants (DOFUS) : seulement à la boutique d'anomalie, jamais en coffre (wboss) */
  const SI = E.WB_S1_ITEMS || { eq: {}, sets: {}, ap: {} };
  Object.entries(SI.eq || {}).forEach(([id, o]) => { if (!ITEMS[id]) ITEMS[id] = { name: o.name, dbid: +id.slice(1), icon: o.icon, slot: o.slot, lvl: o.lvl, stats: o.stats, wboss: o.b, set: o.set }; });
  if (D.SETS) Object.entries(SI.sets || {}).forEach(([id, s]) => { if (!D.SETS[id]) D.SETS[id] = s; });

  /* mécaniques propres (7A) ; les autres viennent du moteur (E.BOSS_MECHS) */
  if (E.BOSS_MECHS) {
    E.BOSS_MECHS.etreinte = { sig: true, name: "Étreinte des abysses", tip: "boucliers", desc: "Tous les 3 tours, un tentacule saisit le héros qui a fait le plus de dégâts : il perd son tour. Un bouclier sur lui l'en protège et le Kralamoure subit 10 % de dégâts en plus 2 tours." };
    E.BOSS_MECHS.des = { sig: true, name: "Coup de dés", tip: "équipe", desc: "Tous les 3 tours, le Chazino lance les dés : 1-2 il se soigne, 3-4 il frappe toute l'équipe, 5-6 il s'expose et subit 50 % de dégâts en plus 1 tour." };
  }
  ["etreinte", "des"].forEach((k) => KEEP.add(k));
  E.WB_S1 = {
    cap: 6000, hp0: 20000, // PV (points) du premier boss : la semaine suivante, 70 % des dégâts de la semaine passée (supabase/wboss_s1.sql)
    week: 7 * 86400000, weeks: 8,
    tiers: [{ id: "bronze", n: "Bronze", k: 3, cons: { coffre_argent: 1 }, frag: 0 }, { id: "argent", n: "Argent", k: 9, cons: { coffre_or: 1 }, frag: 3 }, { id: "or", n: "Or", k: 18, cons: { coffre_or: 1 }, frag: 5, title: true }],
    pal: [{ p: 25, cons: { coffre_argent: 1 }, frag: 2 }, { p: 50, cons: { coffre_or: 1 }, frag: 3 }, { p: 75, cons: { coffre_or: 1 }, frag: 5 }, { p: 100, cons: { coffre_douze: 1 }, frag: 10, xp: true }],
    podium: { n: 3, frag: 30, title: "Fléau des mondes" },
    B: {
      garga: { mon: GARGA, weak: "a", res: "t", mech: ["charge", "seisme", "terreur"], more: "frenesie", sig: "charge", line: "a brisé son collier !", story: "Le Titan enchaîné par les Osamodas ouvre la saison. Tout le serveur doit l'abattre avant qu'il ne s'enfuie.", ph: ["Cri Primitif", "Gargameha"] },
      kralamoure: { mon: "m423", weak: "t", res: "e", mech: ["etreinte", "maree"], more: "condamne", sig: "etreinte", line: "surgit des profondeurs !", story: "Le Kralamoure Géant sort de son terrier d'Otomaï. Ses tentacules saisissent les plus forts.", ph: ["Remous", "Abysses"] },
      cire_momore: { mon: "m7222", weak: "e", res: "f", mech: ["condamne", "putrefaction"], more: "mutisme", sig: "condamne", sigName: "Triste Sceau", line: "traîne son lourd fardeau !", story: "Cire Momore erre avec ses âmes hurlantes. Celui qu'il marque doit être protégé.", ph: ["Chagrin", "Malédiction"] },
      grozilla: { mon: "m3142", weak: "a", res: "t", mech: ["glyphes", "seisme", "taureau"], sig: "glyphes", sigName: "Deux têtes", line: "font trembler Vulkania !", story: "Grozilla et Grasmera quittent le cratère. Une tête encaisse, l'autre se protège : frappez au bon tour.", ph: ["Éruption", "Magma"] },
      chazino: { mon: "m4363", weak: "e", res: "a", mech: ["des", "larcin"], sig: "des", line: "ouvre les jeux !", story: "Le Chazino des Matougarous fait sauter la banque. Chaque coup de dés change le combat.", ph: ["Mise", "Tapis"] },
    },
    rot: ["garga", "kralamoure", "cire_momore", "grozilla", "chazino", "garga", "kralamoure", "cire_momore"],
  };
  /* boss de la semaine w (1…8) ; au 2e passage, une mécanique en plus */
  E.wbS1Def = (w) => {
    const C = E.WB_S1; const i = (Math.max(1, w | 0) - 1) % C.rot.length; const key = C.rot[i]; const B = C.B[key];
    const pass = C.rot.slice(0, i + 1).filter((k) => k === key).length; const M = MONSTERS[B.mon] || {};
    const mech = pass > 1 && B.more ? B.mech.concat(B.more) : B.mech.slice();
    return { n: w | 0, i, key, s1: true, pass, mon: B.mon, name: M.name || "?", img: M.img, weak: B.weak, res: B.res, mech, sig: B.sig, sigName: B.sigName || (E.BOSS_MECHS[B.sig] || {}).name, more: pass > 1 ? B.more : null,
      line: B.line, story: B.story, phNames: B.ph, pow: E.WB_POW["s1_" + key] || E.WB_POW[key === "garga" ? "garga" : key] || 0.6 };
  };
  E.wbS1Weeks = (key) => E.WB_S1.rot.map((k, i) => (k === key ? i + 1 : 0)).filter(Boolean);
  E.wbS1Cap = (pts) => Math.min(E.WB_S1.cap, Math.max(0, pts | 0));
  /* « Dernier soir » (Mathis 03/11) : le dernier soir de la semaine du boss, de 20 h à 22 h (Paris), s'il a perdu 75 % de ses PV sans
     tomber, chacun reçoit un 4e essai pour l'achever avant sa fuite (même règle que wb_last_night dans supabase/wboss_s1.sql). */
  E.WB_S1.night = { h0: 20, h1: 22, pct: 75, plus: 1 };
  const parisHour = (t) => { try { const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t)); const g = (k) => +(p.find((x) => x.type === k) || {}).value || 0; return g("hour") + g("minute") / 60; } catch (e) { return new Date(t).getHours(); } };
  E.wbS1LastDay = (ends, now = E.now()) => ends > now && ends - now < 864e5;
  E.wbS1Night = (s, now = E.now()) => { const N = E.WB_S1.night; const h = parisHour(now); return !!s && E.wbS1LastDay(s.ends, now) && s.dmg < s.hp && s.dmg * 100 >= s.hp * N.pct && h >= N.h0 && h < N.h1; };
  E.wbS1Tries = (s, now = E.now()) => E.WB_TRIES + (E.wbS1Night(s, now) ? E.WB_S1.night.plus : 0);
  E.wbS1Tier = (tries) => E.WB_S1.tiers.filter((t) => tries >= t.k).pop() || null;

  /* mécaniques propres, jouées par le moteur (crochet E.wbMechHook de bossMech) */
  E.wbMechHook = (F, e, t, X) => {
    if (!e.mech) return false; let skip = false;
    if (X.has("etreinte") && t % 3 === 0) {
      const hs = X.heroesOf(F).filter((h) => !(h.stun > 0)); if (hs.length > 1) {
        const h = hs.slice().sort((a, b) => (b.dealt || 0) - (a.dealt || 0))[0];
        if (h.shield > 0) { h.shield = 0; e.debuffs.push({ vuln: 10, turns: 2 }); X.say(`Le bouclier de ${h.name} fait glisser l'étreinte : ${e.name} est exposé !`, "Parade"); F.par = (F.par || 0) + 1; }
        else { h.stun = 1; X.say(`Un tentacule de ${e.name} saisit ${h.name}, qui passera son tour.`, "Étreinte"); }
      }
    }
    if (X.has("des") && t % 3 === 0) {
      const r = 1 + Math.floor(E.getRng()() * 6);
      if (r <= 2) { const g = X.doHeal(e, (e.hpRef || e.hpMax) * 0.05, F); X.say(`${e.name} lance les dés : ${r}. Il encaisse ses gains (+${g} PV).`, "Dés : " + r); }
      else if (r <= 4) { X.say(`${e.name} lance les dés : ${r}. Il frappe toute la table !`, "Dés : " + r); X.hitAll(X.heroesOf(F), 1.2, "des"); skip = true; }
      else { e.debuffs.push({ vuln: 50, turns: 1 }); X.say(`${e.name} lance les dés : ${r}. Il perd sa mise et s'expose !`, "Dés : " + r); }
    }
    return skip;
  };
  E.wbForecast = (F, m, t, add, nx, hs) => {
    if (!m.mech) return;
    if (m.mech.includes("etreinte")) { const h = hs.filter((x) => !(x.stun > 0)).sort((a, b) => (b.dealt || 0) - (a.dealt || 0))[0]; if (h) add("etreinte", nx(3, 0), "hit", h.name, [h]); }
    if (m.mech.includes("des")) add("des", nx(3, 0), "warn", "la table", []);
  };
  /* ---------- boutique d'anomalie de saison (9A équipements + apparat + consommables, 10A rayon ouvert à l'arrivée du boss, 11A 55-90) ---------- */
  E.WB_S1_SHOP = {
    garga: [["i31789", 90], ["i31786", 80], ["i31787", 80], ["i31788", 60]],
    kralamoure: [["i8877", 70], ["i9464", 70], ["i8991", 55], ["i13117", 70], ["i13118", 60], ["i13119", 65], ["i30689", 55], ["ap:i18632", 40]],
    cire_momore: [["i27510", 80], ["i27511", 70], ["i27512", 70], ["i27513", 70], ["i27514", 65], ["i27515", 65], ["ap:i27371", 40]],
    grozilla: [["ap:i29114", 40], ["ap:i20136", 60], ["ap:i20052", 120], ["ap:i21147", 150], ["ap:i21148", 150]],
    chazino: [["cons:coffre_or", 12], ["cons:coffre_obsidienne", 25], ["cons:coffre_douze", 35]],
  };
  E.wbS1ShelfOpen = (S, key) => { const w = E.s1cWeek ? E.s1cWeek(S) : 1; return E.wbS1Weeks(key)[0] <= w; };
  E.wbS1Owns = (S, ap) => !!(S.wbCos && S.wbCos.includes(ap));
  E.wbS1Buy = (S, key, ref) => {
    if (!E.isS1c || !E.isS1c(S)) return { err: "Boutique de la Saison 1." };
    const row = (E.WB_S1_SHOP[key] || []).find(([r]) => r === ref); if (!row) return { err: "Objet inconnu." };
    if (!E.wbS1ShelfOpen(S, key)) return { err: "Ce rayon ouvre à l'arrivée de son boss." };
    const [r, p] = row;
    if (r.startsWith("ap:") && E.wbS1Owns(S, r.slice(3))) return { err: "Tu l'as déjà dans ta Garde-robe." };
    if (E.wbFrags(S) < p) return { err: `Il te faut ${p} Fragments d'anomalie.` };
    if (!r.startsWith("ap:") && !r.startsWith("cons:") && !ITEMS[r]) return { err: "Objet inconnu." };
    S.res[FRAG] -= p; if (!S.res[FRAG]) delete S.res[FRAG];
    if (r.startsWith("ap:")) { S.wbCos = (S.wbCos || []).concat(r.slice(3)); return { ok: true, ap: r.slice(3) }; }
    if (r.startsWith("cons:")) { E.addCons(S, r.slice(5), 1); return { ok: true, cons: r.slice(5) }; }
    return { ok: true, it: E.rollItem(S, r) };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
