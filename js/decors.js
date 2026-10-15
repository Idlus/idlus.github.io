/* ============================================================================
   DÉCORS DE COMBAT — vraies cartes DOFUS (rendus de cartes DofusDB, assets/z pour les sous-zones, assets/asc pour les
   salles de boss des donjons), posées derrière le combat avec un lent travelling, des poussières et un voile.
   Demande de Mathis (15/10/2026) : d'abord pour L'Ascension, puis les zones et les donjons. Crédit visible sur la scène.
   Pour changer de source d'images : seules les deux dossiers et les deux fonctions ci-dessous sont à toucher.
   ========================================================================== */
(function () {
  "use strict";
  const ALIAS = { koa_bordure: "koa_kaliptus", koa_pentes: "koa_canyon", abr_oree: "abr_sombre" }; // sous-zones sans carte propre
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const D = () => window.DATA || {};
  const subName = (id) => { let n = ""; Object.values(D().ZONES || {}).forEach((z) => (z.subs || []).forEach((s) => { if (s.id === id) n = s.name; })); return n; };
  /* { url, name } du décor d'un combat, ou null : donjon = salle du boss, sinon la sous-zone */
  const of = (F) => {
    if (!F) return null;
    if (F.dungeonId && (D().DUNGEONS || {})[F.dungeonId]) return { url: `assets/asc/${F.dungeonId}.webp`, name: D().DUNGEONS[F.dungeonId].name };
    const sub = ALIAS[F.sub] || F.sub; if (!sub || F.wboss || F.koli || F.pvp) return null;
    return { url: `assets/z/${sub}.webp`, name: subName(F.sub) };
  };
  /* les couches à poser dans l'arène (classes partagées avec la scène de L'Ascension, css/ascension.css) */
  const html = (F) => { const d = of(F); if (!d) return "";
    return `<div class="as-bg" style="background-image:url(${d.url})"></div><div class="as-motes">${Array.from({ length: 9 }, (_, k) => `<i style="--i:${k}"></i>`).join("")}</div><div class="as-veil"></div><span class="as-credit">${esc(d.name)} · rendu de carte DofusDB</span>`; };
  window.DECORS = { of, html };
})();
