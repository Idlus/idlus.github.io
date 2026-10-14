/* ============================================================================
   VENTE DIRECTE, Idlus 1.0.30 « L'économie » (choix 13 à 17)
   Vendre ses ressources au jeu, au prix du serveur : prix de base (E.resPrice) × un coef commun à tout le serveur,
   de ×0,1 (plancher) à ×3 (plafond).
   - Chaque vente le fait baisser de (quantité vendue / VOL) : vendre 2 000 unités d'une ressource la fait baisser de ×1.
     Un gros lot est payé unité par unité au coef du moment (aire sous le coef) : le prix baisse pendant la vente.
   - Quand personne n'en vend, il remonte tout seul vers ×3 : la moitié de l'écart en 6 h.
   Pour un débit continu de r unités par heure, le coef se stabilise là où la remontée compense les ventes :
     λ × (3 − coef) = r / VOL avec λ = ln 2 / 6 par heure, donc coef = 3 − r / 231.
   Une heure de chasse donne 300 à 1 500 unités de chacune des ressources d'une zone (simulation de chasse, équipe bien équipée) :
   un joueur qui en vend 300 par heure la tient vers ×1,7 ; qui en vend 650 par heure, vers ×0,2 ; à plusieurs, ×0,1.
   Le serveur ne peut donc pas créer plus de 2,25 × 231 × prix de base kamas par heure et par ressource, quel que soit le
   nombre de vendeurs. Simulation de 50 joueurs actifs (8 h de chasse, 70 % des ressources vendues) : ×0,53 en moyenne,
   environ 1,8 fois ce que payait le marchand de secours, et +60 % de kamas par rapport au seul butin des combats.
   Le serveur fait le même calcul (supabase/vente.sql) ; le jeu s'en sert pour afficher le prix et la courbe.
   Elle remplace le marchand de secours (30 % de la valeur) pour les comptes connectés (partie 1) : le surplus au-delà
   de « Garder au maximum » (S.resCap) et de la limite de banque d'une absence (S.venteQ) est vendu au prix du moment
   par js/venteui.js. Sans compte, hors ligne ou en partie solo, le marchand de secours reste comme avant.
   Pas de DOM ici : ce fichier se charge aussi dans les tests (node).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; const D = root.DATA;
  if (!E || !D || E.VENTE) return;

  E.VENTE = { MIN: 0.1, MAX: 3, VOL: 2000, HALF_H: 6 }; // VOL : unités vendues pour faire baisser le prix de ×1
  const V = E.VENTE;
  const clampC = (c) => Math.min(V.MAX, Math.max(V.MIN, +c || 0));
  /* ressources vendables au jeu : celles qui ont une valeur, sauf les clefs et les Fragments d'anomalie (monnaie du Boss des mondes) */
  E.venteOk = (n) => !!D.RES[n] && E.resPrice(n) > 0 && !E.isKey(n) && n !== (E.WB_FRAG || "Fragment d'anomalie");
  /* coef c et volume récent v (ventes du serveur, qui s'effacent de moitié en 6 h) h heures plus tard, sans nouvelle vente */
  E.venteNow = (c, v, h) => {
    const f = Math.pow(2, -Math.max(0, +h || 0) / V.HALF_H);
    return { c: f === 1 ? clampC(c) : clampC(V.MAX - (V.MAX - clampC(c)) * f), v: Math.max(0, (+v || 0) * f) };
  };
  /* Vendre q unités d'un coup au coef c : le coef baisse pendant la vente, chaque unité est payée au coef du moment.
     Total = prix de base × (aire sous le coef), arrondi à l'inférieur ; mult = bonus (Comptoir de guilde : 1,05). */
  E.venteLot = (base, c, q, mult = 1) => {
    q = Math.max(0, Math.floor(+q || 0)); c = clampC(c);
    const end = c - q / V.VOL;
    let units; // somme des coefs payés
    if (end >= V.MIN) units = (q * (c + end)) / 2;
    else { const q1 = (c - V.MIN) * V.VOL; units = (q1 * (c + V.MIN)) / 2 + (q - q1) * V.MIN; } // le plancher est atteint pendant la vente
    return { k: Math.floor(base * units * mult + 1e-9), c: Math.max(V.MIN, end) };
  };
  /* Tendance : la remontée (3 − c) contre le volume récent (v / VOL) ; pour un vendeur continu à l'équilibre, les deux sont égaux.
     1 : remonte (▲), −1 : baisse (▼), 0 : stable (=) */
  E.venteTrend = (c, v) => { const d = (V.MAX - clampC(c)) - (+v || 0) / V.VOL; return d > 0.05 ? 1 : d < -0.05 ? -1 : 0; };
  /* Courbe des 48 dernières heures, un point par heure (49 points, le dernier = maintenant).
     rows : [[t (ms) de la dernière vente de l'heure, coef juste après, quantité vendue dans l'heure], …] (vente_courbe du serveur).
     Avant la première vente connue, le prix est au plafond. */
  E.venteCourbe = (rows, now) => {
    const L = (rows || []).filter((r) => r && r[0] <= now).slice().sort((a, b) => a[0] - b[0]);
    const out = []; let j = -1;
    for (let i = 48; i >= 0; i--) {
      const m = now - i * 3600000;
      while (j + 1 < L.length && L[j + 1][0] <= m) j++;
      out.push(j < 0 ? V.MAX : E.venteNow(L[j][1], 0, (m - L[j][0]) / 3600000).c);
    }
    return out;
  };
  /* Quantité vendue sur le serveur ces dernières 24 h (même liste) */
  E.vente24 = (rows, now) => (rows || []).reduce((a, r) => a + (r && r[0] > now - 86400000 && r[0] <= now ? +r[2] || 0 : 0), 0);

  /* ---------- surplus à vendre ----------
     S.venteQ[ressource] = limite : la limite de banque d'une absence (consignes, js/vie.js) ; vendue une seule fois puis effacée.
     Migration 1.0.30 (sans E.VERSION) : S.venteQ est créé s'il manque, à la lecture de la partie et à la première vente. */
  const fix = (S) => { if (S && (!S.venteQ || typeof S.venteQ !== "object" || Array.isArray(S.venteQ))) S.venteQ = {}; return S; };
  E.venteFix = fix;
  E.venteSurplus = (S) => {
    fix(S); const out = []; const names = new Set([...Object.keys(S.resCap || {}), ...Object.keys(S.venteQ)]);
    names.forEach((n) => {
      if (!E.venteOk(n)) return;
      const lim = [S.resCap && S.resCap[n], S.venteQ[n]].filter((x) => typeof x === "number" && x >= 0);
      if (!lim.length) return;
      const ex = Math.floor((S.res[n] || 0) - Math.min(...lim)); if (ex > 0) out.push([n, ex]);
    });
    return out.sort((a, b) => b[1] * E.resPrice(b[0]) - a[1] * E.resPrice(a[0]) || (a[0] < b[0] ? -1 : 1));
  };
  /* La vente directe est-elle ouverte pour cette partie ? (compte connecté, partie 1, serveur prêt : réglé par js/venteui.js).
     Sinon (sans compte, hors ligne, tests), le surplus part au marchand de secours comme avant. */
  E.venteHook = null;
  E.venteDirect = (S) => !!(E.venteHook && E.venteHook(S));

  if (E.deserialize) { const d0 = E.deserialize; E.deserialize = (txt) => fix(d0(txt)); }
  if (E.newState) { const n0 = E.newState; E.newState = (...a) => fix(n0(...a)); }
})(typeof window !== "undefined" ? window : globalThis);
