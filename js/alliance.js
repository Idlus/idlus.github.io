/* ============================================================================
   ALLIANCES ET PRISMES — Idlus (multijoueur, pour la 1.1)
   Choix de Mathis : 1A (onglet « Alliance » dans la guilde), 2A (3 guildes au plus), 3A (Alliogemme : 1 000 000 de
   kamas du coffre, guilde niveau 10, Meneur), 4A (un prisme par région de la carte), 5A (il faut dominer la région avec
   ses Percepteurs pour y poser un prisme ; il la garde tant qu'il ne tombe pas), 6A (+5 % de kamas, butin et XP dans la
   région pour tous les membres de l'alliance, sous les plafonds ; Percepteurs alliés de la région +20 % de PV),
   7B (grande bataille chaque semaine, toutes les régions à la fois : 1 point par combat gagné, la meilleure alliance
   prend ou garde la région), 8A (améliorations du prisme payées par le coffre), 9A (les alliés défendent les
   Percepteurs les uns des autres et ne peuvent pas s'attaquer), 10A (classement de la semaine, titre « Souverain des
   Douze » et ornement), 11A (salon « Alliance » dans le chat), 12A (en attaque : le prisme et ses gardes, +30 % et
   +10 % par rang de Rempart ; en défense : une vague d'assaillants +30 %), 13A (10 combats par joueur et par bataille,
   +2 avec le Ralliement dans sa région), 14B (égalité : la région redevient libre).
   Pas de DOM ici : l'interface est dans js/allianceui.js. Chargé aussi par le serveur (tools/build_server.js) pour
   rejouer les combats de la bataille ; serveur : supabase/alliances.sql.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");

  /* Chiffres. day : jour de la bataille (1 = lundi … 7 = dimanche, heure de Paris) ; le même réglage est dans
     supabase/alliances.sql (al_battle_day) : changer les deux ensemble. */
  E.ALLY = {
    max: 3, foundK: 1000000, foundLvl: 10, prismK: 1000000, bonus: 5, percoHp: 0.20,
    prism: 0.30, rempart: 0.10, assail: 0.30, fights: 10, rally: 2, freeMin: 5,
    day: 6, from: 21, to: 22, title: "Souverain des Douze", nameMin: 3, nameMax: 24,
  };
  /* Améliorations du prisme (8A), payées par le coffre de la guilde qui l'a posé (ou d'une guilde de l'alliance) */
  E.ALLY_MODS = {
    rempart:     { name: "Rempart",     ic: "🛡", max: 3, k: [500000, 1500000, 4000000], txt: (r) => `+${Math.round(r * E.ALLY.rempart * 100)} % de PV et de dommages pour le prisme et ses gardes pendant la bataille` },
    sagesse:     { name: "Sagesse",     ic: "📘", max: 3, k: [400000, 1200000, 3000000], txt: (r) => `+${r} % d'XP de plus dans la région pour l'alliance` },
    prospection: { name: "Prospection", ic: "🍀", max: 3, k: [400000, 1200000, 3000000], txt: (r) => `+${r} % de butin de plus dans la région pour l'alliance` },
    ralliement:  { name: "Ralliement",  ic: "📯", max: 1, k: [1500000], txt: () => `+${E.ALLY.rally} combats de bataille pour les membres qui défendent cette région` },
  };
  E.allyModK = (id, rank) => { const M = E.ALLY_MODS[id]; return M && rank < M.max ? M.k[rank] : null; };

  /* région (zone de la carte) d'une sous-zone ou d'un donjon : la même que pour la domination des Percepteurs */
  E.allyRegion = (sid) => {
    if (E.huntRegion) return E.huntRegion(sid);
    const sub = E.SUBS && E.SUBS[sid]; if (sub) return sub.zone;
    const acc = E.DUNGEON_SUB && E.DUNGEON_SUB[sid]; return acc && E.SUBS[acc] ? E.SUBS[acc].zone : null;
  };
  /* niveau d'une région : le plus haut de ses zones (borné à 200) */
  E.allyRegionLvl = (zid) => { const z = (D.ZONES || []).find((x) => x.id === zid); return z ? Math.min(200, Math.max(...z.subs.map((s) => s.lvl[1]))) : 1; };

  /* une équipe de Fantômes d'arène renforcée de m (PV et dommages), avec des noms */
  const boosted = (seed, lvl, m, n0, n1) => E.koliGhost(seed >>> 0, Math.max(1, Math.min(200, Math.round(lvl || 1)))).map((h, i) => {
    const st = Object.assign({}, h.st); st.hpMax = Math.round(st.hpMax * (1 + m)); st.dsort = (st.dsort || 0) + m * 100;
    return Object.assign({}, h, { n: i ? n1 : n0, st });
  });
  /* 12A, en attaque : le prisme et ses gardes (+30 %, +10 % par rang de Rempart) */
  E.prismGuards = (seed, lvl, rempart) => boosted(seed, lvl, E.ALLY.prism + E.ALLY.rempart * Math.max(0, Math.min(3, rempart || 0)), "Prisme", "Garde du prisme");
  /* 12A, en défense : une vague d'assaillants (+30 %) */
  E.prismAssail = (seed, lvl) => boosted(seed, lvl, E.ALLY.assail, "Chef des assaillants", "Assaillant");
  E.prismSeed = (w, zone, user, n) => E.raidSeed(`prism|${w}|${zone}`, `${user}|${n}`);
  /* 6A : Percepteur d'une guilde de l'alliance dans une région de son prisme : +20 % de PV pour lui et ses gardes */
  E.allyPercoBoost = (T) => T.map((h) => { const st = Object.assign({}, h.st); st.hpMax = Math.round(st.hpMax * (1 + E.ALLY.percoHp)); return Object.assign({}, h, { st }); });

  /* bonus du prisme pour un joueur (6A + Sagesse/Prospection) ; dom = bonus de domination déjà compté pour ce
     genre (le +5 % du prisme ne s'ajoute pas à celui de la domination de sa propre guilde : on garde le plus grand) */
  E.allyBonus = (prism, kind, dom) => {
    if (!prism || (kind !== "xp" && kind !== "drop" && kind !== "kamas")) return 0;
    const m = prism.mods || {};
    return Math.max(0, E.ALLY.bonus - (dom || 0)) + (kind === "xp" ? m.sagesse || 0 : kind === "drop" ? m.prospection || 0 : 0);
  };
  /* combats de bataille d'un joueur dans une région (13A) */
  E.allyFights = (prism, defending) => E.ALLY.fights + (defending && prism && prism.mods && prism.mods.ralliement ? E.ALLY.rally : 0);

  /* 7B : la bataille, à l'heure de Paris */
  const parisParts = (t) => { const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t)); const o = {}; f.forEach((p) => { o[p.type] = p.value; }); return { wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(o.weekday) + 1, h: +o.hour, m: +o.minute }; };
  /* { on: bataille en cours, ms: temps avant sa fin (si en cours) ou avant son début } */
  E.allyBattle = (t) => {
    t = t == null ? E.now() : t; const p = parisParts(t); const cur = ((p.wd - 1) * 24 + p.h) * 60 + p.m;
    const st = ((E.ALLY.day - 1) * 24 + E.ALLY.from) * 60, en = ((E.ALLY.day - 1) * 24 + E.ALLY.to) * 60;
    if (cur >= st && cur < en) return { on: true, ms: (en - cur) * 60000 };
    return { on: false, ms: (((st - cur) % 10080 + 10080) % 10080) * 60000 };
  };
  const DAYS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  E.allyBattleWhen = () => `${DAYS[E.ALLY.day]} de ${E.ALLY.from} h à ${E.ALLY.to} h`;
  /* 7B + 14B : qui garde ou prend une région d'après les points { allianceId: pts } ; holder = alliance du prisme.
     Égalité en tête : la région redevient libre. Pour prendre une région (libre ou pas), il faut au moins 5 points
     et plus que tout le monde ; sinon celle qui la tient la garde. Même calcul que al_resolve (supabase/alliances.sql). */
  E.allyOutcome = (pts, holder) => {
    holder = holder || null;
    const e = Object.entries(pts || {}).map(([a, n]) => [+a, +n || 0]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (!e.length) return holder;
    if (e[1] && e[1][1] === e[0][1]) return null;
    if (e[0][0] === holder) return holder;
    return e[0][1] < E.ALLY.freeMin ? holder : e[0][0];
  };
  E.allyNameOk = (s) => { s = String(s || "").trim(); return s.length >= E.ALLY.nameMin && s.length <= E.ALLY.nameMax && /^[\p{L}\p{N} '’\-]+$/u.test(s); };

  /* 10A : ornement des membres de l'alliance première du classement (gardé une fois gagné, comme le titre) */
  if (E.ORN) E.ORN.souverain = { name: () => "Prisme des Douze", req: "Être membre de l'alliance première du classement des prismes un lundi", ok: (S) => !!(S.titlesExtra && S.titlesExtra.includes(E.ALLY.title)) };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
