/* ============================================================================
   VÉRIFICATION — Idlus (multijoueur, étape 3 : classements)
   Code commun au jeu et au serveur (fonction Supabase « classement ») :
   - rejouer un donjon avec l'équipe d'une sauvegarde (record de donjon) ;
   - résumer une sauvegarde pour les classements (niveau, album, succès, héros) ;
   - tirer les donjons de la semaine (les mêmes pour tous).
   Les progrès impossibles sont repérés par la base (supabase/classements.sql).
   Pas de DOM ici. Le moteur (window.ENGINE) doit être chargé avant.
   ========================================================================== */
(function (root) {
  "use strict";
  const V = {};
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  V.REB_LVL = 200; // une renaissance compte 200 niveaux

  /* Résumé public d'une partie : ce que montrent les classements et le profil. */
  V.summary = (E, S) => {
    const gear = (c) => Object.values(c.equip || {}).map((uid) => S.items[uid] && S.items[uid].tpl).filter(Boolean);
    const heroes = S.chars.map((c) => ({ cls: c.cls, lvl: c.lvl || 1, ren: c.ren || 0, name: String(c.name || "").slice(0, 20), gear: gear(c),
      ...(E.mtPts && E.mtPts(c) ? { mt: E.mtPts(c), ks: E.mtStats && c.lvl >= 200 ? E.mtStats(S, c).ks.slice(0, 2).map((k) => k.n) : [], ...(E.mtCode && c.lvl >= 200 && c.mt ? { mc: E.mtCode(c) } : {}) } : {}) })); // 2.0 : Maîtrise (classement) ; 2.1 : code de l'arbre (« Voir l'arbre »)
    const main = S.chars.find((c) => c.id === S.mainHero) || S.chars[0];
    // 0.1.35 : jusqu'à 12 héros, mais le classement compte les 8 meilleurs (comme l'équipe)
    // 2.1.12 : chaque point de Maîtrise compte un niveau ; mtl = Maîtrise comptée dans level (le serveur ne la prend pas pour une montée suspecte au premier envoi)
    const best = heroes.map((h) => ({ t: h.lvl + h.ren * V.REB_LVL + (h.mt || 0), mt: h.mt || 0 })).sort((x, y) => y.t - x.t).slice(0, 8);
    const level = best.reduce((a, x) => a + x.t, 0), mtl = best.reduce((a, x) => a + x.mt, 0);
    const album = E.soulCount ? E.soulCount(S) : Object.keys(S.souls || {}).length;
    const succes = E.achCount ? E.achCount(S) : Object.keys(S.ach || {}).filter((k) => S.ach[k]).length;
    const lvl200 = heroes.some((h) => h.lvl >= 200 || h.ren > 0);
    const dofus = E.DOFUS_ORDER && E.dofusOwned ? E.DOFUS_ORDER.filter((id) => E.dofusOwned(S, id)) : [];
    // 1.0.8 : niveau et XP des métiers d'artisanat (classement des métiers ; le serveur ne garde que les métiers connus)
    // 1.0.9 : + métiers de récolte et de forgemagie (appris), et l'XP totale depuis le niveau 1 (classement de la semaine)
    const jobs = {}, cum = {};
    const total = (need, l, xp) => { const k = need === E.fmNeed ? "fm" : "job"; let c = cum[k]; if (!c) { c = cum[k] = [0, 0]; for (let i = 1; i < 200; i++) c.push(c[i] + need(i)); } return c[l] + xp; };
    // 1.0.25 « Renaissance des métiers » : l'XP totale compte toutes les vies (renXp), et le nombre de renaissances part en 4e
    const put = (k, J, need) => { const l = Math.max(1, Math.min(200, (J && J.lvl) || 1)), xp = Math.max(0, Math.floor((J && J.xp) || 0)), rn = Math.max(0, Math.min(10, Math.floor((J && J.ren) || 0)));
      jobs[k] = [l, xp, need ? total(need, l, xp) + (rn ? Math.max(0, Math.floor(J.renXp || 0)) : 0) : 0]; if (rn) jobs[k].push(rn); };
    for (const k in S.crafts || {}) put(k, S.crafts[k], E.jobXpNeed);
    for (const k in S.jobs || {}) put(k, S.jobs[k], E.jobXpNeed);
    if (S.fmJobs && E.FM_JOBS && E.fmNeed) for (const k in E.FM_JOBS) if (S.fmJobs[k] && (!E.fmLearned || E.fmLearned(S, k))) put(k, S.fmJobs[k], E.fmNeed);
    // 1.0.19 : cobj = métiers d'objets au niveau des objets (le serveur ne compte pas la conversion dans la semaine ni pour les « Premiers »)
    return { cobj: S.craftObj ? 1 : 0, rec: S.recLv || 0, main: main ? main.cls : null, mainLvl: main ? main.lvl || 1 : 1, title: main && main.title ? String(main.title).slice(0, 40) : null, heroes, level, mtl, album, succes, pts: E.achPoints ? E.achPoints(S) : 0, lvl200, ascd100: !!(S.asc && S.asc.d100), asc: S.asc && (S.asc.rk || S.asc.rkx) ? { m: S.asc.rk ? S.asc.rk.m : -1, cls: (S.asc.rk && S.asc.rk.cls) || {}, nos: (S.asc.rk && S.asc.rk.nos) || 0, pur: (S.asc.rk && S.asc.rk.pur) || 0, spd: (S.asc.rk && S.asc.rk.spd) || 0, w: S.asc.rkx ? S.asc.rkx.w : -1, x: (S.asc.rkx && S.asc.rkx.x) || 0 } : null, mainq: E.mainQuestDone ? E.mainQuestDone(S) : false, qstep: Math.max(0, Math.min(500, (S.quest && S.quest.step) || 0)), dofus, jobs, panel: !!S.panelUsed, playtime: Math.round((S.stats && S.stats.playtime) || 0), created: S.created || 0, ...(E.chromaMeta && S.chroma ? E.chromaMeta(S) : {}) }; // 1.0.33 : chromatiques (classement, vitrine, Hauts faits)
  };

  /* Donjons de la semaine : un par tranche de niveau, les mêmes pour tous les joueurs
     (le serveur et le jeu font le même tirage à partir du numéro de la semaine). */
  V.BRACKETS = [[1, 40], [41, 80], [81, 120], [121, 160], [161, 200]];
  V.weekIdx = (t) => Math.floor((t / 86400000 + 3) / 7); // semaines commençant le lundi (UTC), comme le mutateur
  V.weeklyDungeons = (DUNGEONS, w) => V.BRACKETS.map(([a, b], i) => {
    const ids = Object.keys(DUNGEONS).sort().filter((d) => DUNGEONS[d].lvl >= a && DUNGEONS[d].lvl <= b);
    if (!ids.length) return null;
    let x = Math.imul((w + i * 7919) ^ 0x2545f491, 0x9e3779b1) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0; x = (x ^ (x >>> 13)) >>> 0;
    return { bracket: i, did: ids[x % ids.length], from: a, to: b };
  }).filter(Boolean);
  V.bracketOf = (lvl) => Math.max(0, V.BRACKETS.findIndex(([a, b]) => lvl >= a && lvl <= b));

  /* Rejoue la stasis k du donjon did avec l'équipe de la sauvegarde.
     Renvoie { ok, t (secondes de combat), err }. Le hasard et l'heure sont fixés par le serveur. */
  V.replay = (E, txt, did, k, seed, now) => {
    const keepUnlock = E.dungeonUnlocked; // le hasard et l'heure reviennent ensuite aux réglages normaux
    let t = now || Date.now();
    try {
      E.setRng(mulberry(seed >>> 0)); E.setClock(() => t);
      const S = E.deserialize(txt);
      const dg = (root.DATA || E.DATA || {}).DUNGEONS ? (root.DATA || E.DATA).DUNGEONS[did] : null;
      S.dungeon = null; S.fight = null; S.acc = 0; S.pause = 0;
      const SI = E.stasisInfo(S, did);
      if ((SI.max || 0) < k) return { ok: false, err: "stasis jamais terminée dans cette partie" };
      SI.max = k - 1; delete SI.best[k];
      const key = dg ? dg.key : null; if (key) S.res[key] = (S.res[key] || 0) + 1;
      E.dungeonUnlocked = () => true;
      const err = E.enterDungeon(S, did, k); if (err) return { ok: false, err };
      for (let ms = 0; S.dungeon && ms < 3 * 3600 * 1000; ms += 1000) { t += 1000; E.tick(S, 1000); }
      E.events && E.events.splice(0);
      if (SI.max >= k && SI.best[k] != null) return { ok: true, t: SI.best[k] };
      return { ok: false, err: "l'équipe ne termine pas cette stasis" };
    } catch (e) {
      return { ok: false, err: "partie illisible" };
    } finally { E.setRng(Math.random); E.setClock(null); E.dungeonUnlocked = keepUnlock; }
  };

  /* 2.1.4 « Bouclier du serveur » (choix 1A 2A de Mathis) : le serveur calcule lui-même le résumé des classements depuis la
     partie (avant, le jeu l'envoyait à part et le serveur le croyait), puis vérifie la partie avant de la garder comme
     « dernière partie validée » (table saves_ok : classements, hôtel de vente, combats rejoués). */
  V.fullSummary = (E, S) => {
    const r = V.summary(E, S);
    try { if (E.alignMeta) r.align = E.alignMeta(S); } catch (e) { /* sans alignement */ }
    try { if (E.dpotSublimes) { const L = E.dpotSublimes(S); if (L.length) r.dsub = L; } } catch (e) { /* sans Potentiel */ }
    try { if (S.mounts && E.elevSummary) { r.elev = E.elevSummary(S); if (S.elev && S.elev.rare && S.elev.rare.length) r.mrare = S.elev.rare.slice(-10); } } catch (e) { /* sans élevage */ }
    return r;
  };

  /* Bilan d'une partie : ce que le serveur compare d'une partie validée à la suivante. */
  V.bilan = (E, S) => {
    let r = 0; for (const k in S.res || {}) r += Math.max(0, +S.res[k] || 0);
    let mt = 0, bn = 0, lv = 0;
    (S.chars || []).forEach((c) => { lv += c.lvl || 1; if (c.mt) { mt += c.mt.lvl || 0; bn += c.mt.bn || 0; } });
    const dof = Object.values(S.items || {}).filter((it) => /^dofus_/.test(it.tpl)).length;
    // 2.1.25 : pt = heures de temps de jeu (le vrai temps, même en vitesse ×2 / ×3)
    return { k: Math.floor(+S.kamas || 0), r: Math.floor(r), mt, bn, lv, dof, rec: Math.max(0, Math.floor(+S.recLv || 0)), pt: Math.max(0, (+(S.stats && S.stats.playtime) || 0) / 3600) };
  };

  /* Ce qu'aucune partie honnête ne peut contenir, quel que soit le temps de jeu. Renvoie la raison, ou null. */
  V.impossible = (E, S, nu0) => { // nu0 : objets nés avant le bouclier (uid plus petit) : marge plus large (anciens jets d'avant un rééquilibrage)
    const D = root.DATA || E.DATA || {}; const ITEMS = D.ITEMS || {}, STATS = D.STATS || {};
    const MAX = E.MAX_LVL || 200;
    for (const c of S.chars || []) {
      const nm = String(c.name || "un héros").slice(0, 20);
      if (!(c.lvl >= 1 && c.lvl <= MAX)) return `${nm} : niveau ${c.lvl}`;
      if (E.pointCost && c.alloc) { let spent = Math.max(0, +c.pts || 0);
        for (const k in c.alloc) { const n = Math.max(0, Math.floor(+c.alloc[k] || 0)); if (n > 5000) return `${nm} : ${n} points en ${k}`; for (let i = 0; i < n; i++) spent += E.pointCost(k, i); }
        if (spent > (c.lvl - 1) * 5 + 5) return `${nm} : ${spent} points de caractéristiques pour ${(c.lvl - 1) * 5} possibles`; }
      for (const k in c.scrolls || {}) if ((+c.scrolls[k] || 0) > (E.SCROLL_MAX || 100)) return `${nm} : ${c.scrolls[k]} parchemins en ${k}`;
    }
    const itemBad = (it) => {
      const T = ITEMS[it.tpl]; if (!T) return `objet inconnu (${String(it.tpl).slice(0, 30)})`;
      for (const k in it.stats || {}) {
        const v = +it.stats[k]; if (!isFinite(v)) return `${T.name} : ${k} illisible`;
        if (v <= 0) continue;
        const cap = E.fmCap && STATS[k] ? E.fmCap(T, k) : T.stats[k] ? T.stats[k][1] : 0;
        const lim = Math.ceil(Math.max(cap, T.stats[k] ? T.stats[k][1] : 0, 1) * (+it.uid < (nu0 || 0) ? 3 : 1.6)) + 2; // Rayonnant (+50 % au plus), parfait (+2 %), forgemagie
        if (v > lim) return `${T.name} : ${v} ${STATS[k] ? STATS[k].name : k} (au plus ${lim})`;
      }
      return null;
    };
    for (const u in S.items || {}) { const w = itemBad(S.items[u]); if (w) return w; }
    for (const it of Array.isArray(S.over) ? S.over : []) { const w = itemBad(it); if (w) return w; }
    const PS = E.PET_STAR_COST ? E.PET_STAR_COST.length : 5;
    for (const u in S.pets || {}) if ((+S.pets[u].st || 0) > PS) return `familier à ${S.pets[u].st} étoiles`;
    for (const u in S.mounts || {}) { const M = S.mounts[u]; const cap = (E.ST_BASE || 5) + 2; if ((+M.st || 1) > cap) return `monture à ${M.st} étoiles`; }
    if (!(+S.kamas >= 0) || +S.kamas > 1e13) return `kamas illisibles (${S.kamas})`;
    { /* 2.1.17 : Maîtrise plafonnée par le temps écoulé depuis le reset de la Maîtrise lente (2.1.15, 16/10 18:15 Paris) : sans ça,
         une partie retouchée envoyée pour la première fois (ou après une coupure) passait, VERIFY.check ne comparant qu'à la partie validée d'avant */
      const h = Math.max(0, ((V.now ? V.now() : Date.now()) - V.MT_T0) / 3600000) * V.RES_RATE;
      // 2.1.25 : plafond par héros tiré du coût réel des points (Maîtrise lente) : 225 fois l'XP du niveau 199 par heure, 4 fois le meilleur
      // joueur vérifié mesuré le 18/10 (91 points en 48 h, soit environ 56 fois cette XP par heure), + 20 points de marge
      const X = V.MT_XP_H * h, hero = E.MT_LENT && E.mtXpTot ? Math.floor((-20.1 + Math.sqrt(20.1 * 20.1 + 0.4 * X)) / 0.2) + V.MT_PAD : Math.floor(V.MT_HERO0 + V.MT_HERO_H * h);
      const team = Math.floor(V.MT_TEAM0 + V.MT_TEAM_H * h); let tot = 0;
      for (const c of S.chars || []) { if (!c.mt) continue; const nm = String(c.name || "un héros").slice(0, 20), lv = Math.max(0, Math.floor(+c.mt.lvl || 0));
        if (E.MT_RESET && (+c.mt.bn || 0) > 0) return `${nm} : ${c.mt.bn} points de Maîtrise des vies passées (remis à 0 avec la Maîtrise lente)`;
        if (lv > hero) return `${nm} : ${lv} points de Maîtrise (au plus ${hero} depuis le reset)`; tot += lv; }
      if (tot > team) return `${tot} points de Maîtrise dans l'équipe (au plus ${team} depuis le reset)`; }
    return null;
  };
  /* rythmes de V.rates, marge comprise : 180 points par heure pour l'équipe, 30 pour un seul héros (4,8 mesurés × 5, arrondi) */
  V.MT_T0 = Date.UTC(2026, 9, 16, 16, 0); V.MT_HERO0 = 50; V.MT_HERO_H = 30; V.MT_TEAM0 = 300; V.MT_TEAM_H = 180; V.MT_XP_H = 225; V.MT_PAD = 20;

  /* Gains depuis la dernière partie validée, comparés à une réserve d'heures de jeu (comme un sablier) :
     la réserve se remplit de 1,25 h par heure réelle (Sablier compris) jusqu'à 48 h, et chaque gain en consomme
     selon le meilleur rythme honnête (× 3 de marge). Les kamas et ressources donnés par le serveur (hôtel de vente,
     codes cadeaux, lots) sont retirés avant. Renvoie { ok, res (réserve restante), why }. */
  V.RES_MAX = 48; V.RES_RATE = 1.25;
  /* Rythmes mesurés par simulation (tools/simulate.js --chasse 20,60,120,200 --profils optimise, équipe de 8, 16/10/2026) :
     kamas par heure de chasse sans bonus 75 000 (niv. 20), 385 000 (60), 510 000 (120), 870 000 (200) ; environ 6 000 ressources
     par heure ; 4,8 points de Maîtrise par héros et par heure au niveau 200. Marge × 5 (double gain, Almanax, potions, donjons,
     récolte, lots de quête), soit 180 points de Maîtrise par heure pour toute l'équipe. */
  V.KAMAS_PTS = [[1, 20000], [20, 75000], [60, 385000], [120, 510000], [200, 870000]];
  V.KAMAS_H = (l) => { const P = V.KAMAS_PTS; for (let i = 1; i < P.length; i++) if (l <= P[i][0]) { const [a, x] = P[i - 1], [b, y] = P[i]; return x + (y - x) * (l - a) / (b - a); } return P[P.length - 1][1]; };
  V.rates = (lv) => { // ce qu'une heure de jeu peut rapporter au plus, pour une équipe dont le meilleur héros est au niveau lv
    const l = Math.max(1, Math.min(200, lv || 1));
    // 2.1.18 : kamas × 25 et 500 000 ressources par heure : les meilleurs joueurs honnêtes (stasis 10+, tout tombe × 15, ventes au jeu
    // d'un stock accumulé) gagnaient 3 à 9 millions de ressources par jour et jusqu'à 25 millions de kamas par heure, et restaient bloqués
    return { k: 25 * V.KAMAS_H(l), r: 500000, mt: 180, lv: 960 };
  };
  /* 2.1.25 : sure = compte vérifié par Mathis : kamas, ressources et Dofus jugés 2 fois plus large, mais la Maîtrise, les niveaux,
     les points des vies passées et le temps de jeu restent contrôlés comme pour tout le monde (en 2.1.18, un compte vérifié
     ne passait plus du tout ce contrôle, et une partie retouchée à 1,6 milliard de kamas et +160 h de jeu en 27 h passait) */
  V.SURE = 2;
  V.check = (E, prev, cur, hours, gift, res0, topLvl, sure) => {
    let res = Math.min(V.RES_MAX, (res0 == null ? V.RES_MAX : res0) + Math.max(0, hours) * V.RES_RATE);
    const R = Object.assign({}, V.rates(topLvl)); gift = gift || {};
    if (sure) { R.k *= V.SURE; R.r *= V.SURE; }
    if (prev.pt != null && cur.pt != null && cur.pt - prev.pt > Math.max(0, hours) * 1.5 + 2) {
      const h1 = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
      return { ok: false, res, why: `+${h1(cur.pt - prev.pt)} h de temps de jeu en ${h1(Math.max(0, hours))} h réelles` };
    }
    const dk = cur.k - prev.k - (gift.k || 0), dr = cur.r - prev.r - (gift.r || 0), dm = cur.mt - prev.mt, dl = cur.lv - prev.lv - Math.max(0, (cur.rec || 0) - (prev.rec || 0)) - (gift.lv || 0);
    if (cur.bn > prev.bn) return { ok: false, res, why: `points de Maîtrise des vies passées en hausse (+${cur.bn - prev.bn})` };
    // 2.1.18 : un Dofus de plus permis toutes les 4 h (échelle des Dofus jusqu'à la stasis 15 ; un compte bloqué accumulait sans fin)
    if (cur.dof - prev.dof > (2 + Math.floor(Math.max(0, hours) / 4)) * (sure ? V.SURE : 1) + (gift.dof || 0)) return { ok: false, res, why: `+${cur.dof - prev.dof} Dofus d'un coup` };
    const need = { k: Math.max(0, dk) / R.k, r: Math.max(0, dr) / R.r, mt: Math.max(0, dm) / R.mt, lv: Math.max(0, dl) / R.lv };
    const used = Math.max(need.k, need.r, need.mt, need.lv);
    if (used > res + 0.01) {
      const fm = (n) => Math.round(n).toLocaleString("fr-FR");
      const why = need.k === used ? `+${fm(dk)} kamas` : need.r === used ? `+${fm(dr)} ressources` : need.mt === used ? `+${fm(dm)} points de Maîtrise` : `+${fm(dl)} niveaux`;
      const h1 = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
      return { ok: false, res, why: `${why} en ${hours < 1 ? Math.max(1, Math.round(hours * 60)) + " min" : h1(hours) + " h"} (au plus ${h1(res)} h de jeu possibles, il en faudrait ${h1(used)})` };
    }
    return { ok: true, res: res - used };
  };

  root.VERIFY = V;
  if (typeof module !== "undefined" && module.exports) module.exports = V;
})(typeof window !== "undefined" ? window : globalThis);
