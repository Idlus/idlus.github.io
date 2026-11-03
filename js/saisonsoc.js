/* ============================================================================
   Saison 1, lot 5 (partie moteur, sans DOM) : autocollants du chat, blason de guilde, meubles rares du Havre-Sac.
   Images générées par Mathis avec ChatGPT (lot IDLUS-S1, 02/11 ; maquette « Mise en situation » : 5A autocollants,
   6A créateur de blason, 7A meubles rares). Rien ne change la puissance :
   - autocollants : 12, quatre offerts, cinq par les succès, trois dans la vitrine de saison ;
   - blason : forme + emblème + 2 couleurs, rangé dans le champ « ic » de la guilde (lettres seulement, comme le veut
     guild_set) : « bl_ » + forme (a-h) + emblème (a-x) + 2e couleur (a-p) ; la 1re couleur reste « col » ;
   - meubles rares : une vitrine de collection au Havre-Sac, sans place de meuble ni bonus (le serveur du classement n'a
     donc rien à recalculer) ; cinq par les boss en stasis 5, sept dans la vitrine de saison.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const nAch = (S) => (E.achCount ? E.achCount(S) : 0);
  const stMax = (S, id) => (((S.stasis || {})[id] || {}).max || 0);
  const vit = (id) => (S) => !!(E.vitOwned && E.vitOwned(S, id));

  /* ---------------- autocollants ---------------- */
  E.STICKERS = [
    { n: 1, nm: "Mort de rire", ok: () => true, req: "Offert" },
    { n: 2, nm: "Wabbit en larmes", ok: (S) => nAch(S) >= 25, req: "Obtenir 25 succès" },
    { n: 3, nm: "Tofu choqué", ok: () => true, req: "Offert" },
    { n: 4, nm: "Iop motivé", ok: () => true, req: "Offert" },
    { n: 5, nm: "Dragodinde endormie", ok: (S) => nAch(S) >= 50, req: "Obtenir 50 succès" },
    { n: 6, nm: "Bravo !", ok: (S) => nAch(S) >= 100, req: "Obtenir 100 succès" },
    { n: 7, nm: "Iop furieux", ok: () => true, req: "Offert" },
    { n: 8, nm: "Gobelin malin", ok: (S) => nAch(S) >= 150, req: "Obtenir 150 succès" },
    { n: 9, nm: "Abraknyde épuisé", ok: vit("v_st9"), req: "Vitrine de la Saison 1" },
    { n: 10, nm: "Sanglier blasé", ok: vit("v_st10"), req: "Vitrine de la Saison 1" },
    { n: 11, nm: "Arakne paniquée", ok: (S) => nAch(S) >= 200, req: "Obtenir 200 succès" },
    { n: 12, nm: "Craqueleur au top", ok: vit("v_st12"), req: "Vitrine de la Saison 1" },
  ];
  E.stOk = (S, n) => { const t = E.STICKERS.find((x) => x.n === +n); return !!(t && t.ok(S)); };
  E.stMine = (S) => E.STICKERS.filter((t) => t.ok(S));
  E.ST_RE = /^:st:(\d{1,2}):$/; // un message qui n'est qu'un autocollant

  /* ---------------- blason de guilde ---------------- */
  const L = "abcdefghijklmnopqrstuvwx";
  E.CREST_SHAPES = ["Écu", "Rond", "Bouclier", "Bannière", "Médaillon", "Étoile", "Losange", "Étendard"];
  E.CREST_EMB = ["Bouftou", "Tofu", "Dofus", "Épée", "Arc", "Couronne", "Clé", "Dragon", "Champignon", "Lune", "Soleil", "Flamme", "Goutte", "Feuille", "Crâne", "Ailes", "Sablier", "Marteau", "Plume", "Étoile", "Œil", "Patte", "Poisson", "Trèfle"];
  E.CREST_COLS = ["#8cc63f", "#3fa34d", "#2f7d6d", "#3b82c4", "#1e4f8a", "#6b4fbf", "#a24fbf", "#c94f7c", "#d9443a", "#e07a2e", "#e8c063", "#f4e6b0", "#ffffff", "#9aa0a6", "#4a4a4a", "#1b1b1b"];
  E.crestCode = (shape, emb, col2) => `bl_${L[shape] || "a"}${L[emb] || "a"}${L[col2] || "a"}`;
  E.crestOf = (ic) => { const m = /^bl_([a-h])([a-x])([a-p])$/.exec(ic || ""); return m ? { shape: L.indexOf(m[1]), emb: L.indexOf(m[2]), col2: E.CREST_COLS[L.indexOf(m[3])], c2: L.indexOf(m[3]) } : null; };

  /* ---------------- meubles rares (vitrine de collection du Havre-Sac) ---------------- */
  E.RARE_FURN = [
    { n: 1, nm: "Statue du Bouftou Royal", ok: (S) => stMax(S, "cour_bouftou_royal") >= 5, req: "Cour du Bouftou Royal en stasis 5" },
    { n: 2, nm: "Trophée de Ben le Ripate", ok: (S) => stMax(S, "epave_grolandais") >= 5, req: "Épave du Grolandais violent en stasis 5" },
    { n: 3, nm: "Sculpture de givre", ok: vit("v_mb3"), req: "Vitrine de la Saison 1" },
    { n: 4, nm: "Horloge du Village", ok: vit("v_mb4"), req: "Vitrine de la Saison 1" },
    { n: 5, nm: "Tableau des Dofus", ok: vit("v_mb5"), req: "Vitrine de la Saison 1" },
    { n: 6, nm: "Coffre du Ripate", ok: vit("v_mb6"), req: "Vitrine de la Saison 1" },
    { n: 7, nm: "Fontaine du Temps", ok: vit("v_mb7"), req: "Vitrine de la Saison 1" },
    { n: 8, nm: "Armure du Comte", ok: (S) => stMax(S, "donjon_harebourg") >= 5, req: "Donjon du Comte Harebourg en stasis 5" },
    { n: 9, nm: "Cheminée de Frigost", ok: vit("v_mb9"), req: "Vitrine de la Saison 1" },
    { n: 10, nm: "Bibliothèque du Tynril", ok: (S) => stMax(S, "labo_tynril") >= 5, req: "Laboratoire du Tynril en stasis 5" },
    { n: 11, nm: "Tapis de guerre de Razof", ok: (S) => stMax(S, "camp_razof") >= 5, req: "Camp du Comte Razof en stasis 5" },
    { n: 12, nm: "Bannière du Sablier", ok: vit("v_mb12"), req: "Vitrine de la Saison 1" },
  ];
  E.rfMine = (S) => E.RARE_FURN.filter((f) => f.ok(S));

  /* ---------------- dans la vitrine de saison (js/vitrine.js) ---------------- */
  if (E.VIT) {
    [[9, "r"], [10, "r"], [12, "e"]].forEach(([n, rar]) => E.VIT.push({ id: "v_st" + n, k: "st", n: "Autocollant « " + E.STICKERS[n - 1].nm + " »", st: n, rar }));
    [[3, "e"], [4, "l"], [5, "e"], [6, "r"], [7, "l"], [9, "e"], [12, "s"]].forEach(([n, rar]) => E.VIT.push({ id: "v_mb" + n, k: "mb", n: E.RARE_FURN[n - 1].nm, mb: n, rar }));
    const P = { r: 60, e: 120, l: 200, s: 160 }; E.VIT.forEach((v) => { if (!v.prix) v.prix = P[v.rar]; });
  }
  if (typeof module !== "undefined") module.exports = E;
  void D;
})(typeof window !== "undefined" ? window : globalThis);
