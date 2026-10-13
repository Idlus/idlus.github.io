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
    const heroes = S.chars.map((c) => ({ cls: c.cls, lvl: c.lvl || 1, ren: c.ren || 0, name: String(c.name || "").slice(0, 20), gear: gear(c) }));
    const main = S.chars.find((c) => c.id === S.mainHero) || S.chars[0];
    // 0.1.35 : jusqu'à 12 héros, mais le classement compte les 8 meilleurs (comme l'équipe)
    const level = heroes.map((h) => h.lvl + h.ren * V.REB_LVL).sort((x, y) => y - x).slice(0, 8).reduce((a, n) => a + n, 0);
    const album = E.soulCount ? E.soulCount(S) : Object.keys(S.souls || {}).length;
    const succes = Object.keys(S.ach || {}).filter((k) => S.ach[k]).length;
    const lvl200 = heroes.some((h) => h.lvl >= 200 || h.ren > 0);
    const dofus = E.DOFUS_ORDER && E.dofusOwned ? E.DOFUS_ORDER.filter((id) => E.dofusOwned(S, id)) : [];
    // 1.0.8 : niveau et XP des métiers d'artisanat (classement des métiers ; le serveur ne garde que les métiers connus)
    // 1.0.9 : + métiers de récolte et de forgemagie (appris), et l'XP totale depuis le niveau 1 (classement de la semaine)
    const jobs = {}, cum = {};
    const total = (need, l, xp) => { const k = need === E.fmNeed ? "fm" : "job"; let c = cum[k]; if (!c) { c = cum[k] = [0, 0]; for (let i = 1; i < 200; i++) c.push(c[i] + need(i)); } return c[l] + xp; };
    const put = (k, J, need) => { const l = Math.max(1, Math.min(200, (J && J.lvl) || 1)), xp = Math.max(0, Math.floor((J && J.xp) || 0)); jobs[k] = [l, xp, need ? total(need, l, xp) : 0]; };
    for (const k in S.crafts || {}) put(k, S.crafts[k], E.jobXpNeed);
    for (const k in S.jobs || {}) put(k, S.jobs[k], E.jobXpNeed);
    if (S.fmJobs && E.FM_JOBS && E.fmNeed) for (const k in E.FM_JOBS) if (S.fmJobs[k] && (!E.fmLearned || E.fmLearned(S, k))) put(k, S.fmJobs[k], E.fmNeed);
    return { rec: S.recLv || 0, main: main ? main.cls : null, mainLvl: main ? main.lvl || 1 : 1, title: main && main.title ? String(main.title).slice(0, 40) : null, heroes, level, album, succes, pts: E.achPoints ? E.achPoints(S) : 0, lvl200, mainq: E.mainQuestDone ? E.mainQuestDone(S) : false, qstep: Math.max(0, Math.min(500, (S.quest && S.quest.step) || 0)), dofus, jobs, panel: !!S.panelUsed, playtime: Math.round((S.stats && S.stats.playtime) || 0), created: S.created || 0 };
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

  root.VERIFY = V;
  if (typeof module !== "undefined" && module.exports) module.exports = V;
})(typeof window !== "undefined" ? window : globalThis);
