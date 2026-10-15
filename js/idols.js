/* 0.1.10 : idoles — le joueur choisit sa difficulté partout (chasse et donjon).
   Chaque idole ajoute une contrainte au combat et un score ; chaque point de score donne +0,5 % d'XP et de butin,
   en plus des autres bonus (stasis, challenges), jusqu'au score 60 en donjon. Au plus 6 idoles actives, une par famille.
   Les idoles se fabriquent une fois chez le Bricoleur et restent acquises. Statuettes : les 14 idoles de quêtes de DOFUS
   (DofusDB), une par famille, teintée par le CSS selon le rang. Noms : les idoles classiques de DOFUS, effets adaptés. */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);

  E.IDOL_MAX = 6;        // idoles actives au plus
  E.IDOL_PCT = 0.5;      // % d'XP et de butin par point de score
  E.IDOL_DG_CAP = 60;    // score pris en compte en donjon
  E.IDOL_FAMS = {
    vie:    { name: "Vie",         color: "#8fe36a", icon: 178109 },
    deg:    { name: "Dégâts",      color: "#ff6b6b", icon: 178108 },
    pro:    { name: "Protection",  color: "#7cc4ff", icon: 178112 },
    nb:     { name: "Nombre",      color: "#ffb35c", icon: 178117 },
    tempo:  { name: "Tempo",       color: "#c9a2ff", icon: 178114 },
    rythme: { name: "Rythme",      color: "#f08fb0", icon: 178105 },
    soins:  { name: "Soins",       color: "#5ee0c8", icon: 178048 },
    res:    { name: "Résistances", color: "#9ad7ff", icon: 178110 },
    crit:   { name: "Critiques",   color: "#ffd166", icon: 178116 },
  };
  /* fx : ce que l'idole change en combat (lu par le moteur dans F.idol). dup : modificateur de stasis qui fait doublon (l'idole ne compte pas). */
  const L = [
    ["vie", "hebdo",    "Hebdo",    10, 20,  "Les monstres ont +25 % de PV.",                                                   { hpMul: 1.25 }],
    ["vie", "payo",     "Payo",     20, 60,  "Le monstre le plus fort du combat a ses PV ×3.",                                  { payo: true }],
    ["vie", "muta",     "Muta",     25, 100, "Les monstres ont +60 % de PV.",                                                   { hpMul: 1.6 }],
    ["vie", "walet",    "Walet",    40, 160, "Les monstres ont +100 % de PV.",                                                  { hpMul: 2 }],
    ["deg", "dynamo",   "Dynamo",   10, 25,  "Les monstres infligent +15 % de dégâts.",                                         { dmgMul: 1.15 }],
    ["deg", "brouce",   "Brouce",   15, 55,  "Les monstres s'enragent : +25 % de dégâts sous 50 % de leurs PV.",               { enrage: true }, "enrages"],
    ["deg", "kaminara", "Kaminara", 25, 120, "Les monstres infligent +40 % de dégâts.",                                         { dmgMul: 1.4 }],
    ["deg", "hurzz",    "Hurzz",    40, 170, "Les monstres infligent +80 % de dégâts.",                                         { dmgMul: 1.8 }],
    ["pro", "tynril",   "Tynril",   10, 30,  "Les monstres commencent le combat avec un bouclier de 15 % de leurs PV.",         { shield0: 15 }, "blindes"],
    ["pro", "gakri",    "Gakri",    15, 65,  "Les monstres ignorent les poisons et les dégâts sur la durée.",                   { noDot: true }],
    ["pro", "kori",     "Kori",     20, 85,  "Les monstres gagnent un bouclier de 5 % de leurs PV à chaque tour.",              { shieldRegen: 5 }],
    ["pro", "djim",     "Djim",     30, 160, "Un monstre de chaque combat est un Champion : PV ×2, un pouvoir, butin doublé (ne compte pas pour les Sceaux).",  { champion: true }, "champions"],
    ["nb", "farle",     "Farle",    15, 40,  "Un monstre de plus dans chaque combat.",                                          { extra: 1 }, "nombreux"],
    ["nb", "serpi",     "Serpi",    20, 90,  "Quand un monstre meurt, un renfort arrive (une fois par combat).",                { reinforce: true }, "renforts"],
    ["nb", "nahuss",    "Nahuss",   30, 130, "Deux monstres de plus dans chaque combat.",                                       { extra: 2 }, "nombreux"],
    ["nb", "sakai",     "Sakai",    35, 180, "Chaque monstre revient à la vie une fois, avec 30 % de ses PV.",                  { revive: 30 }],
    ["tempo", "nocturne", "Nocturne", 15, 50, "Les monstres jouent avant vos héros.",                                           { first: true }, "veloces"],
    ["tempo", "minor",  "Minor",    15, 75,  "Vos héros n'esquivent plus aucune attaque (Fuite et esquive de PM annulées).",    { noDodge: true }],
    ["tempo", "major",  "Major",    25, 115, "Les monstres jouent deux fois au premier tour.",                                  { major: true }],
    ["tempo", "kyoub",  "Kyoub",    30, 140, "Vos héros ont 1 PA de moins.",                                                    { heroPa: 1 }],
    ["rythme", "dokoko", "Dokoko",  15, 60,  "Vos héros perdent 3 % de leurs PV maximum au début de chaque tour.",             { hpLoss: 3 }],
    ["rythme", "nehik", "Nehik",    20, 80,  "Les monstres volent 15 % des dégâts qu'ils infligent.",                           { vamp: 0.15 }, "vampires"],
    ["rythme", "pluvior", "Pluvior", 20, 95, "Les boucliers de vos héros sont réduits de moitié.",                              { shieldHalf: true }],
    ["rythme", "jiva",  "Jiva",     30, 150, "Vos héros perdent 6 % de leurs PV maximum au début de chaque tour.",             { hpLoss: 6 }],
    ["soins", "bihilete", "Bihilete", 10, 35, "Les soins de vos héros sont réduits de moitié.",                                 { heals: "half" }],
    ["soins", "abdinde", "Abdinde", 15, 70,  "Les monstres récupèrent 5 % de leurs PV à chaque tour.",                          { monRegen: 5 }],
    ["soins", "chokwa", "Chokwa",   20, 105, "Quand un monstre meurt, les autres se soignent de 15 % de leurs PV.",             { chokwa: 15 }],
    ["soins", "ougah",  "Ougah",    25, 110, "Vos héros ne peuvent plus se soigner : soins et vols de vie annulés.",            { heals: "none" }],
    ["res", "croum",    "Croum",    15, 45,  "Les monstres ont +15 % de résistance à tous les éléments.",                       { resAll: 15 }],
    ["res", "gilimin",  "Gilimin",  15, 55,  "Vos sorts de zone infligent 40 % de dégâts en moins.",                            { aoeMul: 0.6 }],
    ["res", "garu",     "Garu",     25, 125, "Les monstres ont +50 % de résistance à l'élément le plus utilisé par l'équipe.",  { resMain: 50 }],
    ["res", "dinam",    "Dinam",    30, 135, "Les monstres ont +30 % de résistance à tous les éléments.",                       { resAll: 30 }],
    ["crit", "hadibel", "Hadibel",  10, 25,  "Les monstres ont +10 % de coups critiques.",                                      { monCrit: 10 }],
    ["crit", "yushe",   "Yushe",    15, 65,  "Un sort sur dix de vos héros échoue.",                                            { fail: 0.1 }],
    ["crit", "jewai",   "Jewai",    20, 95,  "Vos héros ne font plus de coups critiques.",                                      { noCrit: true }],
    ["crit", "tigel",   "Tigel",    25, 145, "Les monstres ont +25 % de coups critiques et +30 de dommages critiques.",         { monCrit: 25, monDcri: 30 }],
  ];
  E.IDOLS = {}; E.IDOL_ORDER = [];
  const ranks = {};
  L.forEach(([fam, id, name, score, lvl, desc, fx, dup]) => { ranks[fam] = ranks[fam] || 0; E.IDOLS[id] = { id, name, fam, rank: ranks[fam]++, score, lvl, desc, fx, dup: dup || null }; E.IDOL_ORDER.push(id); });
  E.idolsOf = (fam) => E.IDOL_ORDER.filter((id) => E.IDOLS[id].fam === fam);

  /* ---------- recettes (Bricoleur) : ressources de récolte du niveau de l'idole, poussière dès 80, ressource de boss dès 160 ---------- */
  const pickRes = (job, lvl) => { const items = (D.GATHER_JOBS[job] || {}).items || []; const ok = items.filter(([, l]) => l <= Math.max(1, lvl)); return ok.length ? ok[ok.length - 1][0] : items[0] && items[0][0]; };
  const JOBS = [["bucheron", "mineur", "alchimiste"], ["mineur", "paysan", "pecheur"], ["bucheron", "alchimiste", "paysan"]];
  // ressource propre au boss (taux entre 1 et 25 %, jamais les objets de quête à 0 %) d'un donjon du niveau de l'idole, varié selon l'idole
  const bossRes = (lvl, seed) => { const dgs = Object.entries(D.DUNGEONS).filter(([, d]) => d.lvl <= lvl && d.lvl >= lvl - 20).sort((a, b) => b[1].lvl - a[1].lvl || (a[0] < b[0] ? -1 : 1)); for (let i = 0; i < dgs.length; i++) { const d = dgs[(i + seed) % dgs.length][1]; const b = D.MONSTERS[d.boss]; const r = (b.drops || []).filter(([n, p]) => D.RES[n] && !E.isKey(n) && p >= 1 && p <= 25).sort((x, y) => x[1] - y[1])[0]; if (r) return r[0]; } return null; };
  E.idolRecipe = (id) => {
    const I = E.IDOLS[id]; const jobs = JOBS[I.rank % JOBS.length]; const q = [12, 8, 6].map((x) => x + I.rank * 4);
    const ing = jobs.map((j, i) => [pickRes(j, I.lvl - 5 * i), q[i]]).filter(([n]) => n);
    if (I.lvl >= 80) ing.push([E.POUSSIERE, 10 + I.rank * 5]);
    if (I.lvl >= 160) { const r = bossRes(I.lvl, I.score); if (r) ing.push([r, 1]); }
    return ing;
  };
  E.idolCraftName = (id) => `Idole ${E.IDOLS[id].name}`;
  E.IDOL_ORDER.forEach((id) => { D.SPECIAL_CRAFTS[E.idolCraftName(id)] = { job: "bricoleur", lvl: E.IDOLS[id].lvl, idol: id, unique: true, ing: E.idolRecipe(id) }; });

  /* ---------- collection et idoles actives ---------- */
  const st = (S) => (S.idols = S.idols || { own: {}, active: [], presets: [] });
  E.idolOwned = (S, id) => !!st(S).own[id];
  E.idolActive = (S, id) => st(S).active.includes(id);
  E.giveIdol = (S, id, why) => { const I = E.IDOLS[id]; if (!I || st(S).own[id]) return false; st(S).own[id] = 1; S.cnt = S.cnt || {}; S.cnt.idols = Object.keys(st(S).own).length;
    E.note(S, `Idole ${I.name} ${why || "fabriquée"} : ${I.desc}`, "rare"); if (E.celebrate) E.celebrate({ t: "idol", id }); E.emit(S, "idol", { id }); return true; };
  /* active une idole : refuse si pas possédée, remplace l'idole de la même famille, refuse au-delà de 6 */
  E.toggleIdol = (S, id) => {
    const I = E.IDOLS[id]; const A = st(S).active; if (!I) return "Idole inconnue.";
    if (A.includes(id)) { A.splice(A.indexOf(id), 1); return null; }
    if (!st(S).own[id]) return "Idole à fabriquer chez le Bricoleur.";
    const same = A.find((x) => E.IDOLS[x].fam === I.fam); if (same) A.splice(A.indexOf(same), 1);
    if (A.length >= E.IDOL_MAX) return `${E.IDOL_MAX} idoles au plus.`;
    A.push(id); return null;
  };
  E.clearIdols = (S) => { st(S).active = []; };
  // 1.2.9.x : noms propres aux idoles (E.savePreset / E.loadPreset étaient déjà ceux des stratégies de sorts et les écrasaient)
  E.saveIdolPreset = (S, i, name) => { const P = st(S).presets; P[i] = { name: name || P[i] && P[i].name || `Jeu ${i + 1}`, ids: st(S).active.slice() }; };
  E.loadIdolPreset = (S, i) => { const P = st(S).presets[i]; if (!P) return "Préréglage vide."; st(S).active = P.ids.filter((id) => E.IDOLS[id] && st(S).own[id]); return null; };
  /* les anciens clics sur « + Nouvelle stratégie » rangeaient un jeu d'idoles fantôme au numéro du héros : on ne garde que les 3 jeux */
  { const d0 = E.deserialize; if (d0) E.deserialize = (txt) => { const S = d0(txt); try { if (S && S.idols && Array.isArray(S.idols.presets) && S.idols.presets.length > 3) S.idols.presets.length = 3; } catch (e) {} return S; }; }
  /* idoles qui comptent pour un combat : celles qui font doublon avec un modificateur de stasis sont ignorées */
  E.idolsFor = (S, dungeon) => { const mods = dungeon && dungeon.mods || []; return st(S).active.filter((id) => E.IDOLS[id] && !(E.IDOLS[id].dup && mods.includes(E.IDOLS[id].dup))); };
  E.idolScore = (S, dungeon, ids) => (ids || E.idolsFor(S, dungeon)).reduce((a, id) => a + E.IDOLS[id].score, 0);
  E.idolBonus = (S, dungeon, ids) => Math.round(Math.min(E.idolScore(S, dungeon, ids), dungeon ? E.IDOL_DG_CAP : Infinity) * E.IDOL_PCT * 10) / 10;
  E.IDOL_MAXSCORE = (() => { const best = Object.keys(E.IDOL_FAMS).map((f) => Math.max(...E.idolsOf(f).map((id) => E.IDOLS[id].score))).sort((a, b) => b - a); return best.slice(0, E.IDOL_MAX).reduce((a, b) => a + b, 0); })();
  /* effets cumulés pour un combat (lu par le moteur) */
  E.idolFx = (S, dungeon) => {
    const ids = E.idolsFor(S, dungeon); if (!ids.length) return null;
    const X = { ids, score: E.idolScore(S, dungeon, ids), bonus: E.idolBonus(S, dungeon, ids), hpMul: 1, dmgMul: 1, extra: 0, resAll: 0, monCrit: 0, monDcri: 0, hpLoss: 0, shield0: 0, shieldRegen: 0, monRegen: 0, chokwa: 0, heroPa: 0, aoeMul: 1, fail: 0, vamp: 0, revive: 0, resMain: 0 };
    ids.forEach((id) => { const f = E.IDOLS[id].fx; for (const k in f) { const v = f[k];
      if (k === "hpMul" || k === "dmgMul" || k === "aoeMul") X[k] *= v; else if (typeof v === "number") X[k] = Math.max(X[k] || 0, v); else X[k] = v; } });
    return X;
  };
  /* risque pour l'équipe actuelle (même logique que les donjons : stasis équivalente = 1 + score / 20) */
  E.idolRisk = (S, lvl, dungeon) => {
    const team = E.team(S); if (!team.length) return { k: "risk", txt: "Aucun héros" };
    const Lv = team.reduce((a, c) => a + c.lvl, 0) / team.length;
    const g = team.reduce((a, c) => { const s = E.charStats(S, c, { solo: false }); const m = D.CLASSES[c.cls].main; return a + Math.max(0, s[m] - (c.alloc[m] || 0)) + Math.max(0, s.vit - (c.alloc.vit || 0)) / 3; }, 0) / team.length / 2;
    const cap = 3.5 + g / (50 * (0.7 + Lv / 200)) + (team.length - 4) * 0.4;
    const k = 1 + E.idolScore(S, dungeon) / 20 + (dungeon ? (dungeon.stasis || 1) - 1 : 0);
    const sc = k - cap + Math.max(0, (lvl || Lv) - Lv) / 8;
    return sc < -1 ? { k: "easy", txt: "Facile" } : sc < 0.3 ? { k: "mid", txt: "Équilibré" } : { k: "risk", txt: "Risqué" };
  };
  E.idolCount = (S) => Object.keys(st(S).own).length;
})(typeof window !== "undefined" ? window : global);
