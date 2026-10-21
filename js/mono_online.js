/* ============================================================================
   Monocompte en ligne — registre des Éclats du Temps du serveur (étape 6b) et droits cosmétiques partagés (lot 2, point 8).
   Branche le moteur de la Saison 1 (js/saison1.js, E.tfSrv) sur les fonctions du serveur (js/online.js, supabase/monocompte.sql),
   seulement quand la partie Monocompte est en ligne : compte autorisé (testeur ou admin), saison ouverte, partie 4 jouée.
   Sinon rien ne change : le registre provisoire de la partie reste celui qu'on affiche.
   - 6a : les gains d'activité ne s'envoient plus : à chaque envoi, la fonction serveur « mono » vérifie la partie (Bouclier)
     et crée un bon de butin par gain (bornes du jour et quota), puis paie les défis atteints ; sa réponse (ON.monoVerif)
     donne le registre. Les paliers de défi demandés par le jeu partent encore (file S.mono.tf.q) ;
   - 6c : la partie suit la date de saison du serveur (début, horloge de test, fin de saison et clôture) ;
   - HdV de saison et échanges : js/market.js (ON.monoMarket) ; Boutique d'Archives d'un héros de l'Éternel : par le serveur ;
   - un achat en boutique passe par le serveur d'abord (débit + droit en une opération) ;
   - les droits partagés du compte (cosm_mine) sont redonnés à la partie au démarrage.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, ON = window.ONLINE;
  /* Clés bêta (supabase/mono_cles.sql) : le champ « Code testeur » d'Options › Compte (js/ui.js) les envoie ici quand le
     Monocompte en ligne est actif (flag mono de js/online.js) ; le serveur seul dit si la clé est bonne (une clé = un compte,
     sans limite d'essais depuis 2.1.35.2). Clé acceptée : l'accès du compte (mono_acces) est relu. Flag coupé : le jeu garde l'ancien code. */
  if (ON) {
    ON.monoCleOn = () => !!(ON.enabled && ON.monoSrv);
    ON.monoCle = async (code) => {
      if (!ON.monoCleOn()) return { err: "Serveur Monocompte indisponible." };
      if (!ON.user) return { err: "Connecte-toi d'abord à ton compte (Options › Compte)." };
      const r = await ON.rpc("mono_cle_utiliser", { p_code: String(code || "").slice(0, 60) });
      if (r.err) return { err: r.err === "Pas de connexion au serveur." ? "Pas de connexion au serveur : réessaie dans un instant." : r.err };
      const d = r.data || {}; if (d.err || !d.ok) return { err: d.err || "Clé refusée." };
      try { await ON.monoCheck(); } catch (e) {}
      return { ok: true, deja: !!d.deja, msg: d.msg || null };
    };
  }
  if (!E || !E.MONO || !E.MONO.tf || !ON || !ON.enabled || !window.DX) return;
  const NET = "Pas de connexion au serveur.";
  const live = (S) => !!(S && S.mono && !S.mono.eternel && ON.monoOn() && ON.slot() === 4);
  const dirty = () => { try { window.DX.social.markDirty(); } catch (e) {} };
  let busy = null;
  /* envoie les gains en attente, un par un ; une coupure les garde pour plus tard, un refus du serveur les retire */
  const flush = (S) => {
    if (busy || !live(S)) return busy || Promise.resolve();
    const T = E.tfState(S); if (!T || !(T.q || []).length) return Promise.resolve();
    busy = (async () => {
      try {
        while (live(S) && T.q.length) {
          const op = T.q[0];
          if (op.t !== "defi") { T.q.shift(); continue; } // ancien gain d'activité en file : le serveur le paie par un bon de butin
          const r = await ON.tfDefi(op.id, op.i);
          if (r.err === NET) break;
          T.q.shift();
          if (r.data && !r.data.err) E.tfSrvSet(S, r.data);
          dirty();
        }
      } finally { busy = null; }
    })();
    return busy;
  };
  const refresh = async (S) => { if (!live(S)) return; const r = await ON.tfEtat(); if (r.data && r.data.solde != null) { E.tfSrvSet(S, r.data); dirty(); } };
  const buy = async (S, id) => {
    const r = await ON.tfAchat(id); if (r.err) return { err: r.err === NET ? "Pas de connexion au serveur : réessaie dans un instant." : r.err };
    if (r.data && r.data.ok) { ON.cosmRefresh().catch(() => {}); dirty(); }
    return r.data || null;
  };
  /* Boutique d'Archives (6c) : héros de l'Éternel d'une saison jouée en ligne (S.mono.sid : numéro de la saison sur le serveur) */
  const archive = async (S, id) => {
    if (!ON.user || !ON.mono || !ON.mono.ok || !S || !S.mono || S.mono.sid == null) return { err: "Connexion au serveur nécessaire pour la Boutique d'Archives." };
    const r = await ON.tfAchat(id, S.mono.sid); if (r.err) return { err: r.err === NET ? "Pas de connexion au serveur : réessaie dans un instant." : r.err };
    if (r.data && r.data.ok) { ON.cosmRefresh().catch(() => {}); dirty(); }
    return r.data || null;
  };
  E.tfSrv = { live, flush, buy, refresh, archive, market: () => !!(ON.monoMarket && ON.monoMarket()) };
  /* 6c : date de saison du serveur. Début de la saison, horloge de test (vitesse, pause) et fin de saison (clôture) : la partie
     les suit ; hors saison de test, la date de saison est la vraie date. */
  const clock = (S) => {
    const A = ON.mono; if (!S || !S.mono || S.mono.eternel || !A || !A.ok || !A.saison) return;
    const def = E.MONO.saisons[S.mono.s] || (E.MONO.saisons[S.mono.s] = { nom: A.saison.nom || `Saison ${S.mono.s}`, debut: null });
    if (S.mono.sid != null && S.mono.sid !== A.saison.id) return; // partie d'une autre saison du serveur
    const d0 = Date.parse(A.saison.debut); if (d0 > 0) def.debut = d0;
    def.closed = A.saison.etat !== "ouverte";
    if (def.closed) return;
    S.mono.sid = A.saison.id;
    if (A.saison.test && A.clk && A.date) { const t = Date.parse(A.date); if (!(t > 0)) return;
      const k = S.mono.clk; const at0 = ON.monoAt || E.now();
      if (!k || k.src !== at0) { S.mono.test = true; S.mono.clk = { t, at: at0, spd: Math.max(1, +A.clk.v || 1), pause: !!A.clk.pause, src: at0 }; dirty(); } }
    else if (S.mono.clk) { delete S.mono.clk; delete S.mono.test; dirty(); } // 2.1.35 : saison en temps réel : aucune horloge accélérée de l'appareil
  };
  /* au démarrage d'une partie Monocompte en ligne : droits partagés du compte, état du registre, gains en attente */
  let seen = null;
  const boot = (S) => {
    seen = S; clock(S);
    try { if (ON.monoCosm && E.monoApplyLegacy(S, ON.monoCosm)) dirty(); } catch (e) {}
    refresh(S).then(() => flush(S)).catch(() => {});
  };
  ON.onMonoPush = (v) => { const S = window.DX.S; if (!live(S)) return;
    if (v && v.ok && v.registre) { E.tfSrvSet(S, v.registre); dirty(); } // partie validée par le Bouclier : bons et défis payés
    flush(S).then(() => refresh(S)).catch(() => {}); };
  setInterval(() => { try { clock(window.DX.S); } catch (e) {} }, 5000);
  setInterval(() => { const S = window.DX.S; if (!live(S)) return; if (S !== seen) return boot(S);
    const T = E.tfState(S); if (T && ((T.q || []).length || !T.srv || E.now() - (T.srv.at || 0) > 60000)) flush(S).then(() => refresh(S)).catch(() => {}); }, 2000);
})();
