/* ============================================================================
   OUTILS DE RÉCOLTE — Idlus 2.1.37 (Mathis, 21/10 : apprenti 1A 2A 3A 4A, menu 1A 2A 3A 4A, outils 1A à 6A)
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
  /* butin : une chance par combat gagné (chasse, donjon, groupe), selon le niveau du monstre le plus fort.
     Tirage hors du générateur du moteur (Math.random) : les combats rejoués avec une graine (serveur, combat de groupe du Bureau)
     doivent tirer exactement les mêmes nombres que le serveur, qui ne charge pas ce fichier. */
  const grnd = () => Math.random();
  E.tgravDrop = (S, mons, opts, out) => {
    if (!mons || !mons.length) return;
    const lvl = Math.max(...mons.map((m) => m.lvl || 0)), r = grnd() / (isMono(S) ? E.TGRAV_DROP.mono : 1);
    const T = lvl >= E.TGRAV_DROP.big.lvl && r < E.TGRAV_DROP.big.p ? 1 : lvl >= E.TGRAV_DROP.small.lvl && r < E.TGRAV_DROP.big.p + E.TGRAV_DROP.small.p ? 0 : -1;
    if (T < 0) return;
    const k = E.TGRAV_ORDER[Math.floor(grnd() * E.TGRAV_ORDER.length)]; const n = E.TGRAV[k].stone[T];
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
    if (J.lvl >= cap && cap < 200) J.xp = Math.min(J.xp, Math.max(0, E.jobXpNeed(J.lvl) - 1));
    E.note(S, "L'Alchimiste prépare une Potion de récolte.", "up"); return null;
  };

  /* ---------------- Atelier des apprentis (Monocompte) ----------------
     2.1.37 : un Apprenti Enutrof engagé 24 h. 2.2.9 « Flotte d'apprentis » (idée d'un joueur, Mathis 05/11 : 1A 2A 3A+3B 5A 6A,
     5 apprentis au plus) : jusqu'à 5 apprentis, un par métier, qui récoltent en même temps.
     - Rangs (kamas) : 50, 55, 60, 65, 70 % du rythme du héros. Le contrat de 24 h suit le rang (il coûte plus que la récolte vendue
       au marchand : la flotte ne fabrique pas de kamas).
     - Niveaux (heures de travail) : 1 à 9 ; talents aux niveaux 3, 6 et 9 (1 au choix sur 2, changer coûte 100 000 kamas).
     - Déblocage des apprentis 2 à 5 : niveau du héros + quête d'atelier + kamas.
     Simulation (5 métiers au 100 + 1 spécialité au 200, héros toujours au combat, outils niveau 10) : 305 h avec 1 apprenti,
     121 h avec 3 au rang 1, 86 h au rang 5. */
  E.APP = { rate: 0.5, dur: 24 * 3600 * 1000, perLvl: 4000, name: "Apprenti Enutrof", max: 5 };
  E.APP_RANKS = [[0.5, 0], [0.55, 150000], [0.6, 450000], [0.65, 1350000], [0.7, 4000000]]; // [rythme, prix du rang]
  E.APP_LVH = [0, 0, 6, 24, 48, 72, 108, 144, 192, 240]; // heures de travail pour atteindre le niveau n (1 à 9)
  E.APP_TAL = {
    3: [{ id: "stu", name: "Studieux", desc: "+10 % d'XP de métier" }, { id: "pro", name: "Prospecteur", desc: "trouvailles ×2 (environ +4 % de ressources)" }],
    6: [{ id: "sou", name: "Sourcier", desc: "filons 50 % plus fréquents (environ +3 % de ressources)" }, { id: "eco", name: "Économe", desc: "contrat 15 % moins cher" }],
    9: [{ id: "fid", name: "Fidèle", desc: "contrat prolongeable jusqu'à 5 jours d'avance" }, { id: "mai", name: "Maître", desc: "+5 % de rythme" }],
  };
  E.APP_RESPEC = 100000;
  E.APP_QUESTS = {
    bras: { name: "Des bras en plus", txt: "Tes apprentis récoltent 2 000 ressources", n: 2000 },
    atelier: { name: "L'atelier grandit", txt: "3 métiers de récolte au niveau 60", n: 3 },
    grand: { name: "Le Grand Atelier", txt: "Tes apprentis récoltent 50 000 ressources", n: 50000 },
    maitre: { name: "Maître d'atelier", txt: "Un apprenti au niveau 9", n: 1 },
  };
  E.APP_SLOTS = [{ lvl: 1, k: 0 }, { lvl: 60, k: 300000, q: "bras" }, { lvl: 120, k: 2000000, q: "atelier" }, { lvl: 160, k: 5000000, q: "grand" }, { lvl: 190, k: 9000000, q: "maitre" }];
  const isMono = (S) => !!(E.isMono && E.isMono(S));
  const hero = (S) => (S.chars || []).find((c) => !c.merc) || (S.chars || [])[0];
  const heroLvl = (S) => Math.max(1, (hero(S) || { lvl: 1 }).lvl || 1);
  E.appName = (i) => (i % 2 ? "Apprentie Enutrof" : "Apprenti Enutrof");
  /* liste des apprentis débloqués (la 1re place est toujours ouverte) ; reprend l'ancien S.mono.app */
  E.appList = (S) => {
    if (!isMono(S)) return [];
    const M = S.mono; if (!Array.isArray(M.apps)) { M.apps = [M.app ? Object.assign({ rk: 0, h: 0, tal: {} }, M.app) : { until: 0, rk: 0, h: 0, tal: {} }]; delete M.app; }
    M.apps.forEach((A) => { if (!(A.rk >= 0)) A.rk = 0; if (!(A.h >= 0)) A.h = 0; if (!A.tal || typeof A.tal !== "object") A.tal = {}; });
    return M.apps;
  };
  E.appGet = (S, i = 0) => E.appList(S)[i] || null;
  E.appState = (S) => E.appGet(S, 0); // compatibilité : le premier apprenti
  E.appTalOn = (A, id) => !!A && [3, 6, 9].some((t) => { const k = A.tal && A.tal[t]; return k != null && E.APP_TAL[t][k] && E.APP_TAL[t][k].id === id; });
  E.appRate = (A) => (E.APP_RANKS[Math.min(4, (A && A.rk) || 0)][0]) + (E.appTalOn(A, "mai") ? 0.05 : 0);
  E.appLvl = (A) => { const h = (A && A.h) || 0; let l = 1; for (let n = 2; n <= 9; n++) if (h >= E.APP_LVH[n]) l = n; return l; };
  E.appCost = (S, i = 0) => { const A = E.appGet(S, i); const r = E.APP_RANKS[Math.min(4, (A && A.rk) || 0)][0];
    return Math.round(E.APP.perLvl * heroLvl(S) * (r / 0.5) * (E.appTalOn(A, "eco") ? 0.85 : 1)); };
  E.appMaxDays = (A) => (E.appTalOn(A, "fid") ? 5 : 3);
  E.appActive = (S, at = E.now(), i = 0) => { const A = E.appGet(S, i); return !!(A && A.until > at); };
  /* quêtes d'atelier : progression [fait, but] */
  E.appQuest = (S, q) => {
    const Q = E.APP_QUESTS[q]; const M = S.mono || {}; let v = 0;
    if (q === "bras" || q === "grand") v = (M.appRes || 0);
    else if (q === "atelier") v = Object.keys(GATHER_JOBS).filter((j) => (S.jobs[j] || {}).lvl >= 60).length;
    else if (q === "maitre") v = E.appList(S).some((A) => E.appLvl(A) >= 9) ? 1 : 0;
    return [Math.min(v, Q.n), Q.n];
  };
  /* ce qui manque pour débloquer la place i (null si possible) */
  E.appUnlockErr = (S, i) => {
    if (!isMono(S)) return "Réservé au Monocompte.";
    const L = E.appList(S), P = E.APP_SLOTS[i]; if (!P) return "Place inconnue.";
    if (i < L.length) return "Déjà débloqué."; if (i > L.length) return "Débloque d'abord l'apprenti précédent.";
    if (heroLvl(S) < P.lvl) return `Héros niveau ${P.lvl} requis.`;
    if (P.q) { const [a, b] = E.appQuest(S, P.q); if (a < b) return `Quête « ${E.APP_QUESTS[P.q].name} » à terminer (${a.toLocaleString("fr-FR")} / ${b.toLocaleString("fr-FR")}).`; }
    if (S.kamas < P.k) return `Il faut ${P.k.toLocaleString("fr-FR")} kamas.`;
    return null;
  };
  E.appUnlock = (S, i) => {
    const err = E.appUnlockErr(S, i); if (err) return err; const P = E.APP_SLOTS[i];
    S.kamas -= P.k; E.appList(S).push({ until: 0, rk: 0, h: 0, tal: {} });
    E.note(S, `Atelier des apprentis : ${E.appName(i)} n° ${i + 1} débloqué${i % 2 ? "e" : ""}. Engage-${i % 2 ? "la" : "le"} dans Économie › Métiers › Récolte.`, "up"); return null;
  };
  E.appRankUp = (S, i) => {
    const A = E.appGet(S, i); if (!A) return "Apprenti verrouillé."; if (A.rk >= 4) return "Rang maximum.";
    const k = E.APP_RANKS[A.rk + 1][1]; if (S.kamas < k) return `Il faut ${k.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= k; A.rk++; E.note(S, `${E.appName(i)} passe au rang ${A.rk + 1} : ${Math.round(E.appRate(A) * 100)} % du rythme du héros.`, "up"); return null;
  };
  /* talent du niveau t : k = 0 ou 1 ; le premier choix est gratuit, le changer coûte E.APP_RESPEC */
  E.appTalent = (S, i, t, k) => {
    const A = E.appGet(S, i); if (!A) return "Apprenti verrouillé."; if (!E.APP_TAL[t] || !E.APP_TAL[t][k]) return "Talent inconnu.";
    if (E.appLvl(A) < t) return `Niveau ${t} requis.`; const cur = A.tal[t]; if (cur === k) return null;
    const pay = cur != null ? E.APP_RESPEC : 0; if (S.kamas < pay) return `Il faut ${pay.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= pay; A.tal[t] = k; return null;
  };
  E.appTalFree = (A) => [3, 6, 9].filter((t) => E.appLvl(A) >= t && A.tal[t] == null);
  /* engage l'apprenti i 24 h (ou prolonge de 24 h) ; job / res : ce qu'il récolte (gardé s'il est omis) */
  E.appHire = (S, job, res, i = 0) => {
    if (!isMono(S)) return "L'apprenti récolteur est réservé au Monocompte.";
    const A = E.appGet(S, i); if (!A) return "Apprenti verrouillé."; const j = job || A.job; if (!j || !GATHER_JOBS[j]) return "Choisis le métier de l'apprenti.";
    const k = E.appCost(S, i); if (S.kamas < k) return `Il faut ${k.toLocaleString("fr-FR")} kamas.`;
    const left = A.until > E.now() ? A.until - E.now() : 0; const md = E.appMaxDays(A); if (left > (md - 1) * E.APP.dur) return `Contrat déjà prolongé au maximum (${md} jours).`;
    const err = E.appSet(S, j, res, true, i); if (err) return err;
    S.kamas -= k; A.until = Math.max(E.now(), A.until || 0) + E.APP.dur; A.w = 0; // w : 1 = rappel « plus qu'1 h » donné, 2 = fin annoncée, 3 = fin vue
    E.note(S, `${E.appName(i)} engagé${i % 2 ? "e" : ""}${left ? " pour 24 h de plus" : " pour 24 h"} (${k.toLocaleString("fr-FR")} kamas).`, "info");
    return null;
  };
  /* prolonge de 24 h tous les apprentis qui ont un métier (dans la limite de leurs jours d'avance) */
  E.appHireAll = (S) => {
    const L = E.appList(S); const ok = L.map((A, i) => i).filter((i) => { const A = L[i]; const left = A.until > E.now() ? A.until - E.now() : 0; return A.job && left <= (E.appMaxDays(A) - 1) * E.APP.dur; });
    if (!ok.length) return "Aucun contrat à prolonger.";
    const tot = ok.reduce((s, i) => s + E.appCost(S, i), 0); if (S.kamas < tot) return `Il faut ${tot.toLocaleString("fr-FR")} kamas.`;
    ok.forEach((i) => E.appHire(S, null, null, i)); return null;
  };
  E.appHireAllCost = (S) => { const L = E.appList(S); return L.reduce((s, A, i) => { const left = A.until > E.now() ? A.until - E.now() : 0; return s + (A.job && left <= (E.appMaxDays(A) - 1) * E.APP.dur ? E.appCost(S, i) : 0); }, 0); };
  /* change ce que récolte l'apprenti i (gratuit) ; un apprenti par métier */
  E.appSet = (S, job, res, hiring, i = 0) => {
    if (!isMono(S)) return "L'apprenti récolteur est réservé au Monocompte.";
    if (!GATHER_JOBS[job]) return "Métier inconnu.";
    const A = E.appGet(S, i); if (!A) return "Apprenti verrouillé.";
    const other = E.appList(S).findIndex((B, k) => k !== i && B.job === job && B.until > E.now()); if (other >= 0) return `${E.appName(other)} n° ${other + 1} travaille déjà en ${GATHER_JOBS[job].name}.`;
    const lvl = S.jobs[job].lvl, list = E.jobRes(job);
    const pick = res && list.find((x) => x[0] === res && x[1] <= lvl) ? res : (list.filter((x) => x[1] <= lvl).pop() || [])[0];
    if (!pick) return "Ressource verrouillée.";
    if (!hiring && !(A.until > E.now())) return "Engage d'abord l'apprenti.";
    if (A.job && A.prog && (A.job !== job || A.res !== pick)) tick1(S, A, i, 0, { flush: true });
    A.job = job; A.res = pick; A.prog = A.prog || 0;
    return null;
  };
  /* rappel 1 h avant la fin du contrat, puis message à la fin (une fois chacun ; pas de rappel pour une fin arrivée hors-ligne) */
  E.APP_WARN = 3600 * 1000;
  const appWarn = (S, A, i, opts) => {
    if (!A.until) return; const left = A.until - E.now(); const w = A.w || 0; const n = `${E.appName(i)} n° ${i + 1}`;
    if (left <= 0 && w < 2) { A.w = 2; E.note(S, `Le contrat de l'${n} est terminé : réengage-${i % 2 ? "la" : "le"} dans Économie › Métiers › Récolte.`, "info"); }
    else if (left > 0 && left <= E.APP_WARN && w < 1) { A.w = 1; if (!opts.offline) E.note(S, `Plus qu'1 h de contrat pour l'${n} : pense à le prolonger.`, "info"); }
  };
  /* pastille sur Métiers : 2 = un contrat fini pas encore vu, 1 = un contrat presque fini, 3 = un talent à choisir */
  E.appAlert = (S) => { let r = 0; E.appList(S).forEach((A) => { if (!A.until) return; const left = A.until - E.now(); const v = left <= 0 ? ((A.w || 0) < 3 ? 2 : 0) : left <= E.APP_WARN ? 1 : 0; r = Math.max(r, v); });
    if (!r && E.appList(S).some((A) => E.appTalFree(A).length)) r = 3; return r; };
  E.appSeen = (S) => { E.appList(S).forEach((A) => { if (A.until && A.until <= E.now() && (A.w || 0) < 3) A.w = 3; }); }; // fin vue dans Métiers : la pastille s'en va
  // faux héros passé au moteur de récolte : pas de classe (pas de passif), pas de Maîtrise
  const pseudo = (A, i) => ({ id: -9 - i, name: E.appName(i), cls: null, job: A });
  const axOf = (A) => ({ xp: E.appTalOn(A, "stu") ? 0.1 : 0, find: E.appTalOn(A, "pro") ? 1 : 0, filon: E.appTalOn(A, "sou") ? 0.5 : 0 });
  const tick1 = (S, A, i, dt, opts) => {
    if (!A.job || !S.jobs[A.job]) return 0;
    const c = pseudo(A, i), rate = E.appRate(A), ax = axOf(A); appWarn(S, A, i, opts);
    if (opts.flush) { const t = E.gatherPeriod(S, c); const f = t > 0 ? Math.min(1, (A.prog || 0) / t) : 0; A.prog = 0; return f > 0 ? E.gatherHit(S, c, f * rate, { quiet: true, app: true, ax }) : 0; }
    const now = E.now(); const start = now - dt * 1000; const live = Math.max(0, Math.min(dt, (A.until - start) / 1000)); if (live <= 0) return 0;
    const def = E.jobRes(A.job).find((x) => x[0] === A.res); if (!def || def[1] > S.jobs[A.job].lvl) return 0;
    const l0 = E.appLvl(A); A.h = (A.h || 0) + live / 3600; const l1 = E.appLvl(A);
    if (l1 > l0) E.note(S, `${E.appName(i)} n° ${i + 1} passe au niveau ${l1}${E.APP_TAL[l1] ? " : un talent est à choisir dans Économie › Métiers › Récolte" : ""}.`, "up");
    A.prog = (A.prog || 0) + live; let n = 0, tot = 0; const t = E.gatherPeriod(S, c);
    while (t > 0 && A.prog >= t && n < 200000) { A.prog -= t; n++; tot += E.gatherHit(S, c, rate, Object.assign({}, opts, { app: true, ax })); }
    return tot;
  };
  /* appelé par le moteur à chaque tic de récolte (E.gatherTick) : chaque apprenti fait des coups de E.HIT_S secondes qui comptent pour son rythme */
  E.appTick = (S, dt, opts = {}) => {
    if (!isMono(S)) return 0; let tot = 0;
    E.appList(S).forEach((A, i) => { tot += tick1(S, A, i, dt, opts); });
    if (tot > 0) S.mono.appRes = (S.mono.appRes || 0) + tot; // quêtes d'atelier
    return tot;
  };
  E.appQty = (S, i = 0) => { const A = E.appGet(S, i); return A && A.job ? E.hitQty(S, pseudo(A, i), E.appRate(A)) : 0; };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
