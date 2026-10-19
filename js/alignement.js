/* ============================================================================
   ALIGNEMENT — Idlus 1.0.30 (choix 34A) : quêtes des cités, un seul camp, guerre de la semaine.
   - 5 chapitres de quêtes par cité (Bonta et Brâkmar), 5 étapes chacun, du niveau 30 au niveau 180 :
     chasses, remises, donjons, missions d'alignement et rangs. Le dernier chapitre donne le titre
     « Héros de Bonta » ou « Héros de Brâkmar ».
   - Un seul camp par compte : changer de camp demande 7 jours d'attente (S.align.pend), puis le niveau
     d'alignement retombe au rang 1 et les quêtes de la nouvelle cité commencent au chapitre 1.
     Le serveur tient le camp du compte (supabase/alignement.sql) : il suit la même attente.
   - Guerre des cités : missions, étapes de quête, donjons et avis rapportent des points de guerre au camp
     (S.align.war, plafonnés par semaine). Ils partent au serveur dans le résumé de la partie, qui les plafonne
     encore selon le temps écoulé. Le camp gagnant a +5 % d'XP et de butin toute la semaine suivante
     (E.alignWarSet, rempli par l'interface avec la réponse du serveur ; jamais les chances de Dofus).
   L'alignement de base (camps, ordres, rangs, missions) reste dans systems.js. Pas de DOM ici : l'interface
   est dans js/alignui.js. État : S.align.q (quêtes), S.align.war (points de la semaine), S.align.pend.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { MONSTERS, DUNGEONS } = D;
  const SUBS = E.SUBS;
  const topLvl = (S) => Math.max(1, ...S.chars.map((c) => c.lvl));
  const fmtK = (n) => Math.round(n).toLocaleString("fr-FR");
  const note = (S, t, k) => E.note(S, t, k);
  const stasisMax = (S, did) => ((S.stasis || {})[did] || {}).max || 0;

  /* ---------- réglages ---------- */
  E.ALIGN_SWITCH_MS = 7 * 86400000;                 // attente pour changer de camp
  E.ALIGN_SWITCH_LVL = 20;                          // niveau d'alignement après le changement (rang 1)
  E.ALIGN_WAR = { mis: 10, step: 25, chap: 60, dg: 2, bounty: 3, cap: 600 }; // points de guerre, plafond par semaine
  E.ALIGN_WAR_BONUS = 5;                            // +5 % d'XP et de butin pour le camp gagnant

  /* ---------- les chapitres ---------- */
  const subName = (sub) => (SUBS[sub] ? SUBS[sub].name : sub);
  const K = (sub, n, name, txt) => ({ t: "kill", sub, n, name, txt: txt || `Chasser ${n} monstres dans ${subName(sub)}` });
  const B = (dg, s, name, txt) => ({ t: "boss", dg, s, name, txt: txt || `Vaincre ${MONSTERS[DUNGEONS[dg].boss].name} (${DUNGEONS[dg].name})${s > 1 ? `, stasis ${s} ou plus` : ""}` });
  const M = (n, name, txt) => ({ t: "mis", n, name, txt: txt || `Accomplir ${n} missions d'alignement` });
  const R = (r, name, txt) => ({ t: "rank", r, name, txt: txt || `Atteindre le rang ${r} d'alignement` });
  const G = (res, n, name, txt) => ({ t: "res", res, n, name, txt: txt || `Remettre ${n} × ${res} à la Milice` });
  const CH_LVL = [30, 60, 100, 140, 180];
  const CHEST = ["coffre_argent", "coffre_argent", "coffre_or", "coffre_or", "coffre_obsidienne"];
  E.ALIGN_CH = {
    bonta: [
      { name: "Le serment de la Milice", where: "Amakna", steps: [
        M(2, "Le serment de la Milice", "Accomplir 2 missions pour la Milice de Bonta"),
        K("ama_bworks", 40, "Des Bworks aux portes", "Repousser 40 monstres du Campement des Bworks"),
        K("ama_passage_brakmar", 40, "L'espion de Brâkmar", "Traquer 40 monstres dans le Passage vers Brâkmar"),
        B("donjon_bworks", 1, "La relique d'Amayiro", "Reprendre la relique à la Bworkette (Donjon des Bworks)"),
        R(2, "Milicien de Bonta")] },
      { name: "Le Cimetière des Héros", where: "Bonta", steps: [
        K("bon_cimetiere_heros", 50, "Les tombes profanées", "Chasser 50 Chafers du Cimetière des Héros"),
        G("Slip en cuir du Chafer Lancier", 15, "Les reliques des héros"),
        B("pitons_craqueleur", 2, "Les pitons rocheux"),
        M(3, "Patrouilles de nuit"),
        R(4, "Gardien des remparts")] },
      { name: "Les Canaux méphitiques", where: "Bonta", steps: [
        K("bon_canaux", 60, "La puanteur des canaux", "Chasser 60 monstres des Canaux méphitiques"),
        G("Poil de Rat Bontarien", 20, "Des preuves pour le Conseil"),
        B("garde_manger_rat_blanc", 3, "Le Rat Blanc"),
        M(4, "Les ordres d'Amayiro"),
        R(6, "Chevalier de Bonta")] },
      { name: "Le Dédale du Dark Vlad", where: "Amakna", steps: [
        K("ama_dark_vlad", 70, "La forêt maudite", "Chasser 70 monstres du Dédale du Dark Vlad"),
        B("tertre_long_sommeil", 4, "Le long sommeil"),
        G("Sachet de Poudre Temporelle", 20, "Le sablier brisé"),
        M(5, "L'avant-garde"),
        R(8, "Le grand serment")] },
      { name: "Le jugement de Jiva", where: "Landes de Sidimote", steps: [
        K("sid_gisgoul", 80, "Les terres de Gisgoul", "Chasser 80 monstres à Gisgoul"),
        B("grotte_bworker", 6, "Le Bworker"),
        G("Furoncle de la Mama Bwork", 25, "Le dernier trophée"),
        M(6, "La dernière croisade"),
        R(10, "Le jugement de Jiva", "Atteindre le rang 10 d'alignement : titre « Héros de Bonta »")] },
    ],
    brakmar: [
      { name: "Le pacte des Ombres", where: "Amakna", steps: [
        M(2, "Le pacte des Ombres", "Accomplir 2 missions pour la Milice de Brâkmar"),
        K("ama_bandits", 40, "Des alliés peu recommandables", "Mettre au pas 40 monstres du Territoire des Bandits"),
        K("ama_passage_brakmar", 40, "Le passage gardé", "Tenir le Passage vers Brâkmar : 40 monstres"),
        B("donjon_bworks", 1, "Le pacte des Bworks", "Soumettre la Bworkette (Donjon des Bworks)"),
        R(2, "Milicien de Brâkmar")] },
      { name: "La Bordure de Brâkmar", where: "Brâkmar", steps: [
        K("bra_bordure", 50, "Les fantômes de la Bordure", "Chasser 50 fantômes de la Bordure de Brâkmar"),
        G("Makroute Déchiqueté", 15, "Les offrandes à Djaul"),
        B("pitons_craqueleur", 2, "Les pitons rocheux"),
        M(3, "Raids de nuit"),
        R(4, "Sentinelle des ténèbres")] },
      { name: "Les Entrailles de Brâkmar", where: "Brâkmar", steps: [
        K("bra_entrailles", 60, "Sous la cité sombre", "Chasser 60 monstres des Entrailles de Brâkmar"),
        G("Poil de Rat Brâkmarien", 20, "Le tribut des rats"),
        B("sousouriciere_rat_noir", 3, "Le Rat Noir"),
        M(4, "Les ordres du Conseil"),
        R(6, "Chevalier de Brâkmar")] },
      { name: "Le Dédale du Dark Vlad", where: "Amakna", steps: [
        K("ama_dark_vlad", 70, "Les serviteurs du Dark Vlad", "Chasser 70 monstres du Dédale du Dark Vlad"),
        B("tertre_long_sommeil", 4, "Le réveil de Hell Mina"),
        G("Sachet de Poudre Temporelle", 20, "Le temps volé"),
        M(5, "La nuit des longs couteaux"),
        R(8, "Le grand pacte")] },
      { name: "Le jugement de Djaul", where: "Landes de Sidimote", steps: [
        K("sid_gisgoul", 80, "Les Bworks de Gisgoul", "Chasser 80 monstres à Gisgoul"),
        B("grotte_bworker", 6, "Le Bworker"),
        G("Furoncle de la Mama Bwork", 25, "Le dernier trophée"),
        M(6, "La nuit éternelle"),
        R(10, "Le jugement de Djaul", "Atteindre le rang 10 d'alignement : titre « Héros de Brâkmar »")] },
    ],
  };
  E.ALIGN_CH_LVL = CH_LVL;
  E.alHeroTitle = (side) => `Héros de ${E.ALIGN[side] ? E.ALIGN[side].name : "Bonta"}`;
  /* récompenses d'une étape et d'un chapitre (niveau du chapitre L) */
  E.alStepRew = (c) => { const L = CH_LVL[c] || 30; return { kamas: Math.round(L * L * 0.3 + L * 15), axp: 300 + 6 * L, ins: 5 + 5 * c }; };
  E.alChapRew = (c) => { const L = CH_LVL[c] || 30; return { kamas: L * 400, ins: 30 * (c + 1), chest: CHEST[c] }; };

  /* ---------- état (migration idempotente : ajoute ce qui manque) ---------- */
  const weekNow = () => E.weekIdx();
  E.alInit = (S) => {
    const A = S && S.align; if (!A || typeof A !== "object") return null;
    if (!A.q || typeof A.q !== "object" || A.q.side !== A.side) A.q = { side: A.side, c: 0, i: 0, p: 0, done: 0, mq: (S.cnt && S.cnt.alignq) || 0 };
    if (A.q.mq === undefined) A.q.mq = (S.cnt && S.cnt.alignq) || 0;
    if (!A.war || typeof A.war !== "object" || A.war.w !== weekNow()) A.war = { w: weekNow(), p: 0 };
    if (A.pend && !(E.ALIGN[A.pend.side] && A.pend.side !== A.side && A.pend.at > 0)) delete A.pend;
    return A;
  };
  E.alChapter = (S) => { const A = E.alInit(S); if (!A) return null; const L = E.ALIGN_CH[A.side]; return L && A.q.c < L.length ? L[A.q.c] : null; };
  E.alStep = (S) => { const C = E.alChapter(S); return C ? C.steps[S.align.q.i] || null : null; };
  E.alOpen = (S) => { const A = E.alInit(S); return !!A && A.q.c < CH_LVL.length && topLvl(S) >= CH_LVL[A.q.c]; };
  E.alProgress = (S) => {
    const st = E.alStep(S); if (!st) return [1, 1]; const Q = S.align.q;
    if (st.t === "kill" || st.t === "mis") return [Math.min(Q.p, st.n), st.n];
    if (st.t === "res") return [Math.min(S.res[st.res] || 0, st.n), st.n];
    if (st.t === "boss") return [S.progress && S.progress.bossKills && S.progress.bossKills[st.dg] && (st.s <= 1 || stasisMax(S, st.dg) >= st.s) ? 1 : 0, 1];
    if (st.t === "rank") return [Math.min(E.alignRankIdx(S), st.r), st.r];
    return [0, 1];
  };
  /* points de guerre de la semaine (ton camp), plafonnés */
  E.alWarAdd = (S, n) => { const A = E.alInit(S); if (!A || !(n > 0) || A.pend) return 0; const v = Math.max(0, Math.min(E.ALIGN_WAR.cap - A.war.p, Math.round(n))); A.war.p += v; return v; };
  E.alWarPts = (S) => { const A = E.alInit(S); return A ? A.war.p : 0; };

  const advance = (S, quiet) => {
    const A = S.align, Q = A.q, c = Q.c; const r = E.alStepRew(c); const C = E.ALIGN_CH[A.side][c];
    const st = C.steps[Q.i];
    S.kamas += r.kamas; S.tokens = S.tokens || {}; S.tokens.insignes = (S.tokens.insignes || 0) + r.ins;
    Q.i++; Q.p = 0; E.alWarAdd(S, E.ALIGN_WAR.step);
    if (!quiet) note(S, `Quête de ${E.ALIGN[A.side].name} · ${st.name} : étape terminée (+${fmtK(r.kamas)} kamas, +${r.ins} insignes).`, "up");
    E.giveAlignXp(S, r.axp);
    if (Q.i >= C.steps.length) {
      const R2 = E.alChapRew(c); Q.c++; Q.i = 0; Q.p = 0; Q.done = Math.max(Q.done || 0, Q.c);
      S.kamas += R2.kamas; S.tokens.insignes += R2.ins; if (R2.chest && D.CONSUMABLES[R2.chest]) E.addCons(S, R2.chest);
      E.alWarAdd(S, E.ALIGN_WAR.chap);
      let extra = "";
      if (Q.c >= E.ALIGN_CH[A.side].length) { const t = E.alHeroTitle(A.side); S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); extra = `, titre « ${t} »`; }
      note(S, `Chapitre terminé : ${C.name} (+${fmtK(R2.kamas)} kamas, +${R2.ins} insignes, ${D.CONSUMABLES[R2.chest] ? D.CONSUMABLES[R2.chest].name : "coffre"}${extra}).`, "rare");
      E.emit(S, "alchap", { side: A.side, c: Q.c });
    }
  };
  /* étapes qui se valident toutes seules (chasse, missions, donjon, rang) ; les remises se font avec un bouton */
  let busy = false;
  E.alCheck = (S) => {
    if (busy || !S || !S.align) return; busy = true;
    try {
      E.alInit(S); let guard = 0;
      while (guard++ < 12 && E.alOpen(S)) {
        const st = E.alStep(S); if (!st || st.t === "res") break;
        const [a, b] = E.alProgress(S); if (a < b) break;
        advance(S);
      }
    } finally { busy = false; }
  };
  E.alGive = (S) => {
    if (!E.alOpen(S)) return "Ce chapitre n'est pas encore ouvert.";
    const st = E.alStep(S); if (!st || st.t !== "res") return "Rien à remettre pour l'instant.";
    if ((S.res[st.res] || 0) < st.n) return `Il faut ${st.n} × ${st.res}.`;
    S.res[st.res] -= st.n; if (!S.res[st.res]) delete S.res[st.res];
    advance(S); E.alCheck(S); return null;
  };

  /* ---------- changer de camp : 7 jours d'attente, puis retour au rang 1 ---------- */
  const choose0 = E.chooseAlign;
  E.chooseAlign = (S, side, order) => {
    const A = S.align;
    if (!A || A.side === side) {
      const r = choose0(S, side, order); if (r) return r;
      if (S.align && S.align.pend) { delete S.align.pend; note(S, "Changement de camp annulé : tu restes fidèle à ta cité.", "info"); }
      E.alInit(S); E.alCheck(S); return null;
    }
    if (!E.ALIGN[side] || !E.ALIGN[side].orders[order]) return "Choix invalide.";
    E.alInit(S);
    if (A.pend && A.pend.side === side) { A.pend.order = order; return null; }
    A.pend = { side, order, at: E.now() + E.ALIGN_SWITCH_MS };
    note(S, `Tu demandes à rejoindre ${E.ALIGN[side].name} : changement dans 7 jours, puis retour au rang 1. Tu peux annuler d'ici là.`, "warn");
    return null;
  };
  E.alignCancel = (S) => { const A = S.align; if (!A || !A.pend) return "Aucun changement de camp en cours."; delete A.pend; note(S, "Changement de camp annulé.", "info"); return null; };
  E.alSwitchLeft = (S) => (S.align && S.align.pend ? Math.max(0, S.align.pend.at - E.now()) : 0);
  E.alSwitchTick = (S) => {
    const A = S && S.align; if (!A || !A.pend || A.pend.at > E.now()) return false;
    const P = A.pend; const from = E.ALIGN[A.side].name;
    S.align = { side: P.side, order: E.ALIGN[P.side].orders[P.order] ? P.order : "coeur", lvl: Math.min(A.lvl || 0, E.ALIGN_SWITCH_LVL), xp: 0 };
    S.alignQuest = null; if (E.newAlignQuest) E.newAlignQuest(S); E.alInit(S); if (WAR.side) WAR.side = P.side;
    note(S, `Tu quittes ${from} : te voici ${E.ALIGN[P.side].adj}, ordre ${E.ALIGN[P.side].orders[S.align.order].name}, au rang ${E.alignRankIdx(S)}.`, "rare");
    E.emit(S, "align", { side: P.side }); return true;
  };
  Object.assign(E.ACTIONS, { alGive: "remettre des ressources pour une quête de cité", alignCancel: "annuler un changement de camp" });

  /* ---------- événements : chasses, missions, donjons, avis ---------- */
  const emit0 = E.emit;
  E.emit = (S, type, data) => {
    if (emit0) emit0(S, type, data);
    if (!S || !S.align || !S.cnt || !data) return;
    try {
      const A = E.alInit(S); const Q = A.q; const st = E.alStep(S); const open = E.alOpen(S);
      if (type === "win" && data.sub && !data.dungeon && open && st && st.t === "kill" && st.sub === data.sub) Q.p += (data.mons || []).length;
      const mq = S.cnt.alignq || 0;
      if (mq > Q.mq) { const d = mq - Q.mq; Q.mq = mq; if (open && st && st.t === "mis") Q.p += d; E.alWarAdd(S, d * E.ALIGN_WAR.mis); }
      if (type === "dungeon" && !data.down) E.alWarAdd(S, E.ALIGN_WAR.dg);
      if (type === "bounty") E.alWarAdd(S, E.ALIGN_WAR.bounty);
      if (type !== "harvest") E.alCheck(S);
    } catch (e) { /* une quête ne doit jamais casser une partie */ }
  };
  const tick0 = E.tick;
  E.tick = (S, dt, realMs) => { const r = tick0(S, dt, realMs); if (S && S.align && S.align.pend) { try { E.alSwitchTick(S); } catch (e) {} } return r; };
  const des0 = E.deserialize;
  E.deserialize = (txt) => { const S = des0(txt); try { if (S.align) { E.alInit(S); E.alSwitchTick(S); E.alCheck(S); } } catch (e) {} return S; };

  /* ---------- guerre des cités : le camp gagnant de la semaine passée (donné par le serveur) ---------- */
  const WAR = { w: -1, win: null, side: null };
  E.alignWarSet = (o) => { Object.assign(WAR, o || {}); };
  E.alignWarOn = (t) => !!(WAR.win && WAR.side && WAR.side === WAR.win && E.weekIdx(t || E.now()) === WAR.w);
  const ev0 = E.evMult;
  if (ev0 && !ev0.al) { E.evMult = (kind, t) => ev0(kind, t) * ((kind === "xp" || kind === "drop") && E.alignWarOn(t) ? 1 + E.ALIGN_WAR_BONUS / 100 : 1); E.evMult.al = true; }

  /* ---------- résumé envoyé au serveur avec la partie (classements, camp, guerre) ---------- */
  E.alignMeta = (S) => {
    const A = S && S.align; if (!A || !E.ALIGN[A.side]) return null; E.alInit(S);
    return { s: A.side, o: A.order, l: Math.max(0, Math.min(100, A.lvl || 0)), w: A.war.w, p: A.war.p, ps: A.pend ? A.pend.side : null, c: A.q.done || 0 };
  };
  const V = root.VERIFY;
  if (V && V.summary && !V.summary.al) { const sum0 = V.summary; V.summary = (E2, S) => Object.assign(sum0(E2, S), { align: E.alignMeta(S) }); V.summary.al = true; }

  /* ---------- succès ---------- */
  if (E.ACH) {
    const add = (o) => { if (!E.ACH.some((a) => a.id === o.id)) E.ACH.push(o); };
    const done = (S) => (S.align && S.align.q ? S.align.q.done || 0 : 0);
    add({ id: "alch1", cat: "Alignement", name: "Premier chapitre", desc: "Terminer le premier chapitre des quêtes de ta cité.", test: (S) => done(S) >= 1, kamas: 3000 });
    add({ id: "alch3", cat: "Alignement", name: "Fidèle à la cité", desc: "Terminer 3 chapitres des quêtes de ta cité.", test: (S) => done(S) >= 3, kamas: 15000 });
    add({ id: "alch5", cat: "Alignement", name: "Héros de la cité", desc: "Terminer les 5 chapitres des quêtes de ta cité.", test: (S) => done(S) >= 5, kamas: 60000 });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
