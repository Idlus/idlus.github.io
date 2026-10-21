/* ============================================================================
   OUTILS DE RÉCOLTE — Idlus 2.1.36 (Mathis, 21/10 : apprenti 1A 2A 3A 4A, menu 1A 2A 3A 4A, outils 1A à 6A)
   - Gravures : aux niveaux 5, 10, 15, 20, 25 et 30 d'un outil, on grave Prospecteur, Sourcier ou Savant (la même plusieurs fois
     si on veut). Chaque gravure demande une pierre de gravure, objet rare des combats (niveau 20+ pour les petites, 80+ pour les grandes).
   - Maîtrise des ressources : étoile bronze, argent, or à 1 000, 10 000, 100 000 récoltes d'une ressource (+5, +10, +15 %).
   - Potion de récolte : préparée par l'Alchimiste niveau 40, +20 % de ressources pendant 1 h (pas de cumul avec le Bonbon).
   - Apprenti récolteur (Monocompte) : un PNJ engagé 24 h (4 000 kamas × niveau du héros) récolte avec les niveaux de métier,
     à 50 % du rythme du héros (soit un héros récolteur du Classique), sans bonus de classe ni de Maîtrise, même quand le héros
     récolte lui-même. Simulation : héros 200 + 2 métiers au 100 + 1 spécialité au 200 en 176 h au lieu de 264.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const { GATHER_JOBS, CONSUMABLES, RES } = D;
  const rnd = () => E.rnd();

  /* ---------------- Gravures ---------------- */
  E.TGRAV_LV = [5, 10, 15, 20, 25, 30];
  // fx : trouvailles × (1 + find), filons × (1 + filon), XP de métier × (1 + xp), par gravure
  E.TGRAV = {
    pro: { name: "Prospecteur", fx: { find: 1 }, desc: "Trouvailles 2 fois plus fréquentes : environ +4 % de ressources et plus d'Éclats de trouvaille.", stone: ["Gravure de Secousse", "Gravure de Séisme"], icon: 15214 },
    sou: { name: "Sourcier", fx: { filon: 0.5 }, desc: "Filons 50 % plus fréquents : environ +3 % de ressources.", stone: ["Gravure de Crachin", "Gravure de Tsunami"], icon: 15211 },
    sav: { name: "Savant", fx: { xp: 0.15 }, desc: "+15 % d'XP de métier.", stone: ["Gravure d'Étincelle", "Gravure d'Incendie"], icon: 15212 },
  };
  E.TGRAV_ORDER = ["pro", "sou", "sav"];
  // pierres de gravure : petites (gravures des niveaux 5 à 15), grandes (20 à 30)
  E.TGRAV_DROP = { small: { lvl: 20, p: 1 / 3000 }, big: { lvl: 80, p: 1 / 5000 }, mono: 0.5 }; // simulation : ≈ 1 pierre par jour de chasse (équipe de 8 : 75-170 victoires/h ; Monocompte : environ 2 fois plus de victoires, d'où × 0,5)
  if (RES) E.TGRAV_ORDER.forEach((k) => { const G = E.TGRAV[k]; G.stone.forEach((n, i) => { if (!RES[n]) RES[n] = { id: 0, icon: G.icon, lvl: i ? 80 : 20, price: i ? 2000 : 500, type: -2, nosale: true }; }); }); // pas de vente au jeu : elles servent aux gravures
  E.tgravStone = (k, lv) => E.TGRAV[k].stone[lv >= 20 ? 1 : 0];
  E.tgravOf = (S, job) => (S.tgrav && Array.isArray(S.tgrav[job]) ? S.tgrav[job] : []);
  E.tgravFx = (S, job) => { const f = { find: 0, filon: 0, xp: 0 }; for (const k of E.tgravOf(S, job)) { const G = k && E.TGRAV[k]; if (G) for (const x in G.fx) f[x] += G.fx[x]; } return f; };
  /* grave (ou regrave) l'emplacement i (0 à 5) de l'outil du métier job ; une pierre est consommée à chaque fois */
  E.engrave = (S, job, i, k) => {
    if (!GATHER_JOBS[job]) return "Métier inconnu.";
    const G = E.TGRAV[k]; if (!G) return "Gravure inconnue.";
    const lv = E.TGRAV_LV[i]; if (lv == null) return "Emplacement inconnu.";
    if (E.toolLvl(S, job) < lv) return `Il faut l'outil au niveau ${lv}.`;
    const cur = E.tgravOf(S, job); if (cur[i] === k) return `${G.name} est déjà gravé ici.`;
    const st = E.tgravStone(k, lv); if (!(S.res[st] > 0)) return `Il faut 1 ${st} (butin rare des combats, monstres de niveau ${lv >= 20 ? E.TGRAV_DROP.big.lvl : E.TGRAV_DROP.small.lvl} et plus).`;
    S.res[st]--; if (!S.res[st]) delete S.res[st];
    S.tgrav = S.tgrav || {}; const g = (S.tgrav[job] = cur.slice()); while (g.length < E.TGRAV_LV.length) g.push(null); g[i] = k;
    E.note(S, `Gravure ${G.name} sur ${E.toolName(job, E.toolLvl(S, job))} (${GATHER_JOBS[job].name}).`, "up");
    E.emit(S, "tool", { job, grav: k });
    return null;
  };
  /* butin : une chance par combat gagné (chasse, donjon, groupe), selon le niveau du monstre le plus fort */
  E.tgravDrop = (S, mons, opts, out) => {
    if (!mons || !mons.length) return;
    const lvl = Math.max(...mons.map((m) => m.lvl || 0)), r = rnd() / (isMono(S) ? E.TGRAV_DROP.mono : 1);
    const T = lvl >= E.TGRAV_DROP.big.lvl && r < E.TGRAV_DROP.big.p ? 1 : lvl >= E.TGRAV_DROP.small.lvl && r < E.TGRAV_DROP.big.p + E.TGRAV_DROP.small.p ? 0 : -1;
    if (T < 0) return;
    const k = E.TGRAV_ORDER[Math.floor(rnd() * E.TGRAV_ORDER.length)]; const n = E.TGRAV[k].stone[T];
    E.addRes(S, n, 1); if (out) out.res[n] = (out.res[n] || 0) + 1;
    if (!(opts && opts.offline)) E.note(S, `Butin rare : ${n} ! (gravure d'outil)`, "rare");
  };

  /* ---------------- Maîtrise des ressources ---------------- */
  E.RES_MAST = [[1000, 5, "bronze"], [10000, 10, "argent"], [100000, 15, "or"]];
  E.resMastN = (S, r) => (S.resMast && S.resMast[r]) || 0;
  E.resMastStar = (S, r) => { const n = E.resMastN(S, r); let s = 0; E.RES_MAST.forEach(([t], i) => { if (n >= t) s = i + 1; }); return s; };
  E.resMastMult = (S, r) => { const s = E.resMastStar(S, r); return s ? 1 + E.RES_MAST[s - 1][1] / 100 : 1; };
  E.resMastAdd = (S, r, q) => {
    if (!(q > 0)) return; S.resMast = S.resMast || {}; const s0 = E.resMastStar(S, r); S.resMast[r] = (S.resMast[r] || 0) + q;
    const s1 = E.resMastStar(S, r); if (s1 > s0) E.note(S, `Maîtrise des ressources : ${r} passe ${E.RES_MAST[s1 - 1][2]} (+${E.RES_MAST[s1 - 1][1]} % sur cette ressource).`, "up");
  };

  /* ---------------- Potion de récolte (Alchimiste) ---------------- */
  CONSUMABLES.potion_recolte = { name: "Potion de récolte", icon: "🧪", pimg: "12041", kind: "boost", boost: "gather", pct: 20, dur: 3600, desc: "+20 % de ressources récoltées pendant 1 h. Préparée par l'Alchimiste (niveau 40). Ne se cumule pas avec le Bonbon Récolteur." };
  E.POTION_REC = { lvl: 40, ing: [["Ortie", 30], ["Sauge", 15], ["Trèfle à 5 feuilles", 8]], kamas: 2000, xp: 300 };
  E.brewCheck = (S) => {
    const P = E.POTION_REC; const J = S.jobs.alchimiste;
    if (!J || J.lvl < P.lvl) return `Alchimiste niveau ${P.lvl} requis.`;
    if (S.kamas < P.kamas) return `Il faut ${P.kamas.toLocaleString("fr-FR")} kamas.`;
    const miss = P.ing.filter(([r, q]) => (S.res[r] || 0) < q); if (miss.length) return `Il manque : ${miss.map(([r, q]) => `${q - (S.res[r] || 0)} × ${r}`).join(", ")}.`;
    return null;
  };
  E.brewPotion = (S) => {
    const err = E.brewCheck(S); if (err) return err; const P = E.POTION_REC;
    S.kamas -= P.kamas; P.ing.forEach(([r, q]) => { S.res[r] -= q; if (!S.res[r]) delete S.res[r]; });
    E.addCons(S, "potion_recolte"); const J = S.jobs.alchimiste; J.xp += P.xp;
    const cap = E.jobCap(S, "g", "alchimiste"); while (J.lvl < cap && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; }
    if (J.lvl >= cap) J.xp = Math.min(J.xp, Math.max(0, E.jobXpNeed(J.lvl) - 1));
    E.note(S, "L'Alchimiste prépare une Potion de récolte.", "up"); return null;
  };

  /* ---------------- Apprenti récolteur (Monocompte) ---------------- */
  E.APP = { rate: 0.5, dur: 24 * 3600 * 1000, perLvl: 4000, name: "Apprenti Enutrof" };
  const isMono = (S) => !!(E.isMono && E.isMono(S));
  const hero = (S) => (S.chars || []).find((c) => !c.merc) || (S.chars || [])[0];
  E.appState = (S) => (isMono(S) && S.mono.app) || null;
  E.appCost = (S) => E.APP.perLvl * Math.max(1, (hero(S) || { lvl: 1 }).lvl || 1);
  E.appActive = (S, at = E.now()) => { const A = E.appState(S); return !!(A && A.until > at); };
  /* engage l'apprenti 24 h (ou prolonge de 24 h) ; job / res : ce qu'il récolte (gardé s'il est omis) */
  E.appHire = (S, job, res) => {
    if (!isMono(S)) return "L'apprenti récolteur est réservé au Monocompte.";
    const A = S.mono.app || {}; const j = job || A.job; if (!j || !GATHER_JOBS[j]) return "Choisis le métier de l'apprenti.";
    const k = E.appCost(S); if (S.kamas < k) return `Il faut ${k.toLocaleString("fr-FR")} kamas.`;
    const left = A.until > E.now() ? A.until - E.now() : 0; if (left > 2 * E.APP.dur) return "Contrat déjà prolongé au maximum (3 jours).";
    const err = E.appSet(S, j, res, true); if (err) return err;
    S.kamas -= k; S.mono.app.until = Math.max(E.now(), A.until || 0) + E.APP.dur; S.mono.app.w = 0; // w : 1 = rappel « plus qu'1 h » donné, 2 = fin annoncée
    E.note(S, `${E.APP.name} engagé${left ? " pour 24 h de plus" : " pour 24 h"} (${k.toLocaleString("fr-FR")} kamas).`, "info");
    return null;
  };
  /* change ce que récolte l'apprenti (gratuit) */
  E.appSet = (S, job, res, hiring) => {
    if (!isMono(S)) return "L'apprenti récolteur est réservé au Monocompte.";
    if (!GATHER_JOBS[job]) return "Métier inconnu.";
    const lvl = S.jobs[job].lvl, list = E.jobRes(job);
    const pick = res && list.find((x) => x[0] === res && x[1] <= lvl) ? res : (list.filter((x) => x[1] <= lvl).pop() || [])[0];
    if (!pick) return "Ressource verrouillée.";
    const A = S.mono.app || (S.mono.app = { until: 0 });
    if (!hiring && !(A.until > E.now())) return "Engage d'abord l'apprenti.";
    if (A.job && A.prog && (A.job !== job || A.res !== pick)) { E.appTick(S, 0, { flush: true }); }
    A.job = job; A.res = pick; A.prog = A.prog || 0;
    return null;
  };
  /* rappel 1 h avant la fin du contrat, puis message à la fin (une fois chacun ; pas de rappel pour une fin arrivée hors-ligne) */
  E.APP_WARN = 3600 * 1000;
  const appWarn = (S, A, opts) => {
    if (!A.until) return; const left = A.until - E.now(); const w = A.w || 0;
    if (left <= 0 && w < 2) { A.w = 2; E.note(S, `Le contrat de l'${E.APP.name} est terminé : réengage-le dans Économie › Métiers › Récolte.`, "info"); }
    else if (left > 0 && left <= E.APP_WARN && w < 1) { A.w = 1; if (!opts.offline) E.note(S, `Plus qu'1 h de contrat pour l'${E.APP.name} : pense à le prolonger.`, "info"); }
  };
  /* pastille sur Métiers : contrat fini (et pas encore réengagé) ou presque fini */
  E.appAlert = (S) => { const A = E.appState(S); if (!A || !A.until) return 0; const left = A.until - E.now(); return left <= 0 ? ((A.w || 0) < 3 ? 2 : 0) : left <= E.APP_WARN ? 1 : 0; };
  E.appSeen = (S) => { const A = E.appState(S); if (A && A.until && A.until <= E.now() && (A.w || 0) < 3) A.w = 3; }; // fin vue dans Métiers : la pastille s'en va
  // faux héros passé au moteur de récolte : pas de classe (pas de passif), pas de Maîtrise
  const pseudo = (A) => ({ id: -9, name: E.APP.name, cls: null, job: A });
  /* appelé par le moteur à chaque tic de récolte (E.gatherTick) : l'apprenti fait des coups de 30 s qui comptent pour E.APP.rate */
  E.appTick = (S, dt, opts = {}) => {
    const A = E.appState(S); if (!A || !A.job || !S.jobs[A.job]) return 0;
    const c = pseudo(A); appWarn(S, A, opts);
    if (opts.flush) { const t = E.gatherPeriod(S, c); const f = t > 0 ? Math.min(1, (A.prog || 0) / t) : 0; A.prog = 0; return f > 0 ? E.gatherHit(S, c, f * E.APP.rate, { quiet: true, app: true }) : 0; }
    const now = E.now(); const start = now - dt * 1000; const live = Math.max(0, Math.min(dt, (A.until - start) / 1000)); if (live <= 0) return 0;
    const def = E.jobRes(A.job).find((x) => x[0] === A.res); if (!def || def[1] > S.jobs[A.job].lvl) return 0;
    A.prog = (A.prog || 0) + live; let n = 0, tot = 0; const t = E.gatherPeriod(S, c);
    while (t > 0 && A.prog >= t && n < 200000) { A.prog -= t; n++; tot += E.gatherHit(S, c, E.APP.rate, Object.assign({}, opts, { app: true })); }
    return tot;
  };
  E.appQty = (S) => { const A = E.appState(S); return A && A.job ? E.hitQty(S, pseudo(A), E.APP.rate) : 0; };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
