/* ============================================================================
   CHANTIER DU SERVEUR — Idlus 3.0 (Mathis 12/11/2026) : tout le serveur verse des kamas (Marché › Chantier) ; une fois
   l'objectif atteint, ×2 XP et ×2 butin pour tout le serveur pendant 48 h (hors Dofus et runes Ga, qui ne passent pas
   par le multiplicateur de butin). Au plus un Chantier par semaine ; objectif calé par le serveur sur les kamas réels.
   Règles et vérifications : supabase/chantier.sql (Éternel, et Saison 1 par l'espace s1), supabase/mono_chantier.sql.
   Ce fichier lit l'état pour TOUS les joueurs (le ×2 compte même sans la 3.0) ; la page est dans js/v3.js.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE; if (!E) return;
  const C = (window.CHANTIER = { st: null, off: 0, last: 0, busy: false, seen: null });
  /* le ×2 : jamais en plus d'un événement ×2 de Mathis (pas de ×4) */
  E.chUntil = 0;
  /* 3.1.8 (retour d'Aglouglou, 14/11) : au chargement de la page, le gain hors ligne était calculé avant la première
     réponse du serveur (4 s), donc sans le ×2. Le dernier Chantier connu est gardé sur l'appareil (début et fin du bonus,
     par serveur) et, hors ligne, le ×2 vaut pour la part de l'absence couverte par le bonus (comme les potions d'XP). */
  const KEY = "idlus-chantier-bonus";
  const memo = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  const win = () => { const w = C.where && C.where(); const m = w ? memo()[w] : null; const b = m ? Date.parse(m.b) : 0; return b ? { a: Date.parse(m.d) || b - 48 * 3600e3, b } : null; };
  E.chEnd = () => { if (E.chUntil) return E.chUntil; const W = win(); return W ? W.b : 0; };
  E.chFrac = null; // part de l'absence couverte par le bonus, pendant le calcul hors ligne
  const ev0 = E.evMult;
  if (ev0 && !ev0.ch) { E.evMult = (kind, t) => ev0(kind, t) * ((kind === "xp" || kind === "drop") && !(E.eventOn && E.eventOn(t)) ? (E.chFrac != null && !t ? 1 + E.chFrac : (t || E.now()) < E.chEnd() ? 2 : 1) : 1); E.evMult.ch = true; }
  const cu0 = E.catchUpGen;
  if (cu0 && !cu0.ch) {
    E.catchUpGen = function* (S, seconds) {
      if (E.chFrac != null) return yield* cu0(S, seconds);
      const now = E.now(), from = now - seconds * 1000, W = win(), b = E.chUntil || (W ? W.b : 0), a = W ? W.a : b - 48 * 3600e3;
      E.chFrac = b && seconds > 0 ? Math.max(0, Math.min(now, b) - Math.max(from, a)) / (seconds * 1000) : 0;
      try { return yield* cu0(S, seconds); } finally { E.chFrac = null; }
    };
    E.catchUpGen.ch = true;
  }
  C.on = () => E.now() < E.chEnd();
  C.left = () => Math.max(0, E.chEnd() - E.now());

  const ON = window.ONLINE;
  if (!ON || !ON.enabled) return;
  const S = () => window.DX && window.DX.S;
  /* quel Chantier : la saison Monocompte ouverte (emplacement 4), sinon celui du serveur Classique de la partie (Éternel ou s1) ;
     l'Éternel du Monocompte et les parties solo n'en ont pas */
  C.where = () => { const s = S(); if (!s) return null; if (ON.monoGame && ON.monoGame()) return ON.monoMarket && ON.monoMarket() ? "mono" : null; return ON.solo && ON.solo() ? null : "classic"; };
  const apply = (st) => {
    C.st = st || null; if (!C.st) { E.chUntil = 0; return; }
    const now = Date.parse(C.st.now) || Date.now(); C.off = now - Date.now();
    const b = C.st.bonus ? Date.parse(C.st.bonus) : 0;
    E.chUntil = b > now ? E.now() + (b - now) : 0;
    { const w = C.where(); if (w) { const m = memo(); if (b) { m[w] = { d: C.st.done, b: C.st.bonus }; try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} } } }
    let seen = C.seen; try { seen = localStorage.getItem("idlus-chantier-vu"); } catch (e) {}
    if (E.chUntil && seen !== C.st.bonus && window.DX && window.DX.social) { C.seen = C.st.bonus; try { localStorage.setItem("idlus-chantier-vu", C.st.bonus); } catch (e) {} window.DX.social.toast("Chantier du serveur fini : ×2 XP et ×2 butin pour tout le monde pendant 48 h !", "rare"); }
  };
  C.poll = async function () {
    const w = C.where(); if (!w || !ON.rpc || ON.state === "offline") { if (!w) apply(null); return; }
    C.last = Date.now();
    const r = await ON.rpc(w === "mono" ? "mono_chantier_state" : "chantier_state");
    if (r.err || !r.data || r.data.err) return;
    apply(r.data);
    if (window.V3 && window.V3.chantierPaint) window.V3.chantierPaint();
  };
  /* verser : le serveur vérifie les kamas de la partie en ligne, puis renvoie l'opération à appliquer (js/market.js) */
  C.give = async function (k) {
    const w = C.where(); if (!w) return { err: "Le Chantier se joue avec ta partie en ligne (partie 1, Saison 1 ou Monocompte)." };
    if (!ON.user) return { err: "Connecte-toi à un compte (gratuit) pour participer au Chantier." };
    if (C.busy) return { err: "Un instant…" }; C.busy = true;
    try {
      try { if (window.DX.social && window.DX.social.onPush) await window.DX.social.onPush(); } catch (e) {} // la partie part en ligne avant le don
      const s = S(); const after = (s && s.hdv && s.hdv.op) || 0;
      const r = w === "mono" ? await ON.rpc("mono_chantier_give", { p_after: after, p_amount: Math.floor(k) }) : await ON.rpc("chantier_give", { p_amount: Math.floor(k) });
      if (r.err) return { err: r.err }; if (r.data && r.data.err) return { err: r.data.err };
      if (r.data.ops && window.MARKET) window.MARKET.apply(r.data.ops, true, w === "mono" ? "mono" : "classic");
      if (r.data.state) apply(r.data.state);
      return { ok: true, given: r.data.given };
    } finally { C.busy = false; }
  };
  setTimeout(() => C.poll(), 4000);
  setInterval(() => { if (document.visibilityState === "visible" && Date.now() - C.last >= (C.st && !C.st.done ? 120e3 : 300e3)) C.poll(); }, 5000);
})();
