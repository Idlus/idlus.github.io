/* ============================================================================
   Monocompte en ligne — registre des Éclats du Temps du serveur (étape 6b) et droits cosmétiques partagés (lot 2, point 8).
   Branche le moteur de la Saison 1 (js/saison1.js, E.tfSrv) sur les fonctions du serveur (js/online.js, supabase/monocompte.sql),
   seulement quand la partie Monocompte est en ligne : compte autorisé (testeur ou admin), saison ouverte, partie 4 jouée.
   Sinon rien ne change : le registre provisoire de la partie reste celui qu'on affiche.
   - chaque gain d'activité et chaque palier de défi est envoyé (file S.mono.tf.q, gardée dans la partie hors connexion) ;
     le serveur applique les bornes du jour et le quota, et renvoie son état du registre (solde, générés, quota) ;
   - un achat en boutique passe par le serveur d'abord (débit + droit en une opération) ;
   - les droits partagés du compte (cosm_mine) sont redonnés à la partie au démarrage.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, ON = window.ONLINE;
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
          const r = op.t === "act" ? await ON.tfAct(op.k, op.n, op.src) : op.t === "defi" ? await ON.tfDefi(op.id, op.i) : { data: { err: "?" } };
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
  E.tfSrv = { live, flush, buy, refresh };
  /* au démarrage d'une partie Monocompte en ligne : droits partagés du compte, état du registre, gains en attente */
  let seen = null;
  const boot = (S) => {
    seen = S;
    try { if (ON.monoCosm && E.monoApplyLegacy(S, ON.monoCosm)) dirty(); } catch (e) {}
    refresh(S).then(() => flush(S)).catch(() => {});
  };
  ON.onMonoPush = () => { const S = window.DX.S; if (live(S)) flush(S).then(() => refresh(S)).catch(() => {}); };
  setInterval(() => { const S = window.DX.S; if (!live(S)) return; if (S !== seen) return boot(S);
    const T = E.tfState(S); if (T && ((T.q || []).length || !T.srv || E.now() - (T.srv.at || 0) > 60000)) flush(S).then(() => refresh(S)).catch(() => {}); }, 2000);
})();
