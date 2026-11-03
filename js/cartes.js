/* ============================================================================
   Saison 1, lot 6 : l'album de cartes et les boosters (Mathis 1A « cérémonie du booster », 2A brillante 1 sur 100,
   plan du 02/11 : « album au niveau du compte, cartes illustrées + version brillante rare, ouverture carte par carte,
   pas de duels de cartes »).
   - Une carte par boss de donjon (121), rangées en 4 raretés selon le niveau du donjon. Les cartes illustrées (images
     générées par Mathis avec ChatGPT, toutes livrées le 03/11) sont dans assets/s1/ca/<donjon>.webp ; un nouveau donjon sans image montre son boss.
   - Boosters dans la partie de saison seulement : un offert par jour, un de plus tous les 10 donjons de saison (2 par jour
     au plus). 5 cartes, la 5e rare ou mieux ; chaque carte a 1 chance sur 100 d'être brillante.
   - Les doubles donnent de la Poussière d'étoile, qui fabrique une carte manquante (jamais une brillante).
   - Purement de collection : aucune carte ne change la puissance. L'album est lié au compte : la partie Éternel relit
     celui de la saison (S.xcards, posé au lancement par js/ui.js), comme la vitrine (js/vitrine.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));
  const DAY = 86400000;

  const RAR = (E.CARTE_RAR = { c: "Commune", r: "Rare", e: "Épique", l: "Légendaire", h: "Héros d'Idlus" });
  const POIDS = { c: 62, r: 27, e: 9, l: 2 }; // chances d'une carte de booster (la 5e : rare ou mieux)
  const DUST = (E.CARTE_DUST = { c: 2, r: 5, e: 15, l: 40, h: 40 }); // poussière d'un double (×5 pour une brillante)
  const CRAFT = (E.CARTE_CRAFT = { c: 20, r: 50, e: 150, l: 400, h: 400 }); // poussière pour fabriquer une carte manquante
  E.CARTE_SHINY = 0.01;
  E.BOOSTER_N = 5;
  E.BOOSTER_DJ = 5; // donjons de saison pour un booster (03/11 : 10 → 5, Mathis veut plus de boosters)
  E.BOOSTER_DJ_JOUR = 4; // boosters gagnés en donjon par jour, au plus (03/11 : 2 → 4)
  E.BOOSTER_MAX = 30; // boosters gardés en réserve, au plus
  // cartes illustrées (1 : illustration, 2 : illustration + version brillante dessinée)
  const ART = (E.CARTE_ART = Object.assign(Object.fromEntries("akademie_gobs antichambre_gloursons antre_blop_multicolore antre_crocabulia antre_dragon_cochon antre_korriandre antre_reine_nyee aquadome_merkator arbre_moon arbre_mort atelier_tanukoui aurore_pourpre autel_dechireuse bambusaie_damadrya bastion_marteaux bateau_chouque belvedere_ilyzaelle biblio_corbac boyau_pere_ver brasserie_dazak breuil_venerable cache_kankreblath cale_arche_otomai camp_razof canopee_kimbo cave_toxoliath caverne_el_piko caverne_koulosse cavernes_kolosso chambre_malefices chambre_tal_kasha chapiteau_riktus chateau_ensable chateau_wa_wabbit cimetiere_mastodontes clairiere_chene_mou clos_blops cour_bouftou_royal croquanterie crypte_kardorim defi_chaloeil demeure_esprits dojo_vent domaine_ancestral donjon_bworks donjon_forgerons donjon_larves donjon_scarafeuilles donjon_squelettes donjon_tofus epave_grolandais epreuve_draegnerys excavation_mansot fabrique_foux fabrique_mallefisk fers_tyrannie fonderie_waddicts forgefroide_frizz galerie_phossile garde_manger_rat_blanc gelaxieme_dimension goulet_rasboul grange_tournesol grotte_bworker grotte_hesque grotte_kanigroula horologium_xlii hypogee_obsidiantre labo_brumen labo_nileza labo_tynril labyrinthe_minotoror maison_fantome manoir_katrepat megalithe_fraktale memoire_orukam miausolee_pounicheur mine_sakai nid_kwakwa oeil_vortex palais_dantinea palais_nidas pitons_craqueleur plateau_ush poste_supervizoeuf pyramide_ombre refuge_sylvestre repaire_kharnozor repaire_skeunk repaire_sphincter ring_ekarlatte rituel_kabahal salle_minotot salons_klime sanctuaire_torkelonia sentence_balance serre_royalmouth sousouriciere_rat_noir souvenir_imagiro taniere_givrefoux taniere_meulou tempete_eliocalypse temple_kao temple_koutoulou temple_ougah terrier_wa_wabbit tertre_long_sommeil theatre_dramak tofulailler_royal tombe_tofugawa tour_bethel tour_solar transporteur_sylargh trone_cour_sombre trone_sang vaisseau_meno vallee_dame_eaux ventre_baleine village_kanniboul voliere_haute_truche".split(" ").map((id) => [id, 1])), { donjon_harebourg: 2 }));

  /* ---------------- les cartes : un boss par donjon, rareté selon le niveau ---------------- */
  const L = Object.entries(D.DUNGEONS || {}).sort((a, b) => a[1].lvl - b[1].lvl || (a[0] < b[0] ? -1 : 1));
  const N = L.length, cut = [Math.round(N * 0.4), Math.round(N * 0.7), Math.round(N * 0.9)];
  const C = (E.CARTES = L.map(([id, d], i) => { const m = (D.MONSTERS || {})[d.boss] || {};
    return { id, n: m.name || d.name, d: d.name, lvl: d.lvl, el: m.el || "n", rar: i < cut[0] ? "c" : i < cut[1] ? "r" : i < cut[2] ? "e" : "l",
      img: m.img != null ? `assets/m/${m.img}.png` : "", art: ART[id] ? `assets/s1/ca/${id}.webp` : "", artB: ART[id] === 2 ? `assets/s1/ca/${id}-b.webp` : "" }; }));
  /* Héros d'Idlus (Mathis, 03/11) : la carte d'un héros de joueur, les 10 Légendes de la 1.1 d'abord, puis toute carte demandée.
     Une entrée par carte livrée (image assets/s1/ca/<id>.webp, brillante <id>-b.webp) ; « qui » = pseudo du joueur, qui a la
     sienne d'office. Dans les boosters : 1 booster sur 50 remplace une commune par un héros tiré au hasard, donc les chances des
     cartes de donjon ne bougent pas quand la page grandit. */
  E.CARTE_HEROS_P = 0.02; // Mathis 03/11 : 1 booster sur 50
  const HEROS = (E.CARTE_HEROS = [
    { id: "legende_zeph", n: "Zeph", d: "Zeph-Crâ, 1re Légende de la 1.1", cls: "cra", el: "a", qui: "Zeph", leg: 1 },
    { id: "legende_ley", n: "Ley", d: "Ley-Crâ, 9e Légende de la 1.1", cls: "cra", el: "a", qui: "Ley", leg: 9 },
    { id: "legende_gagou", n: "Gagou", d: "Sacrigag, 1er à réunir tous les Dofus", cls: "sacri", el: "f", qui: "Gagou", leg: 6 },
    { id: "legende_zoukani", n: "Zoukani", d: "Kosea, Sacrieuse fidèle de Missiz Frizz", cls: "sacri", el: "e", qui: "Zoukani" },
  ]);
  const BY = Object.fromEntries(C.map((c) => [c.id, c]));
  const heroCard = (x) => { const c = { id: x.id, n: x.n, d: x.d, lvl: 200, el: x.el || "n", rar: "h", qui: x.qui || "", leg: x.leg || 0, img: "", art: `assets/s1/ca/${x.id}.webp`, artB: `assets/s1/ca/${x.id}-b.webp` };
    C.push(c); BY[c.id] = c; return c; };
  HEROS.forEach(heroCard);
  E.carteHerosAdd = (x) => { if (BY[x.id]) return BY[x.id]; HEROS.push(x); return heroCard(x); }; // pour les tests
  E.carte = (id) => BY[id] || null;

  /* ---------------- l'album du compte ---------------- */
  const A = (S) => { const c = S.s1c; if (!c.cards) c.cards = { o: {}, b: {}, pd: 0, bst: 0, free: 0, dj: 0, djd: 0, djn: 0, nb: 0 }; return c.cards; };
  const me = () => { const O = root.ONLINE || root.ON, p = O && O.profile && O.profile.pseudo; return p ? String(p).toLowerCase() : ""; };
  const mine = (S) => { const a = (S.s1c && S.s1c.cards) || {}, x = S.xcards || {};
    const o = Object.assign({}, x.o || {}, a.o || {}), b = Object.assign({}, x.b || {}, a.b || {}), m = me();
    if (m) HEROS.forEach((h) => { if (h.qui && h.qui.toLowerCase() === m) o[h.id] = o[h.id] || 1; }); // son propre héros, d'office
    return { o, b }; };
  E.cardMine = mine;
  E.cardHas = (S, id) => !!mine(S).o[id];
  E.cardShiny = (S, id) => !!mine(S).b[id];
  E.cardCount = (S) => Object.keys(mine(S).o).filter((id) => BY[id]).length;
  E.cardShinyCount = (S) => Object.keys(mine(S).b).filter((id) => BY[id]).length;
  E.cardDust = (S) => (s1(S) ? A(S).pd : 0);
  E.cardOf = (St) => (St && St.s1c && St.s1c.cards ? { o: Object.assign({}, St.s1c.cards.o), b: Object.assign({}, St.s1c.cards.b) } : null);
  E.cardImport = (S, St) => { if (s1(S) || S.mono) return; const o = E.cardOf(St); if (o) S.xcards = o; };

  /* ---------------- les boosters ---------------- */
  const dayOf = (t) => Math.floor(t / DAY);
  E.boosterFree = (S) => (s1(S) && !E.s1cOver(S) && dayOf(A(S).free || 0) !== dayOf(E.now()) ? 1 : 0);
  E.boosterLeft = (S) => (s1(S) ? A(S).bst + E.boosterFree(S) : 0);
  E.boosterNext = () => (dayOf(E.now()) + 1) * DAY - E.now();
  E.boosterDjLeft = (S) => { if (!s1(S)) return 0; const a = A(S); return a.djd === dayOf(E.now()) ? Math.max(0, E.BOOSTER_DJ_JOUR - a.djn) : E.BOOSTER_DJ_JOUR; };
  E.boosterGive = (S, n) => { if (!s1(S)) return 0; const a = A(S); const k = Math.max(0, Math.min(n || 1, E.BOOSTER_MAX - a.bst)); a.bst += k; return k; };
  const pick = (r) => { const L2 = C.filter((c) => c.rar === r); return L2[Math.floor(E.rnd() * L2.length)]; };
  const roll = (best) => { const W = best ? { r: POIDS.r, e: POIDS.e, l: POIDS.l } : POIDS; const tot = Object.values(W).reduce((a, b) => a + b, 0);
    let x = E.rnd() * tot; for (const [r, w] of Object.entries(W)) { if ((x -= w) < 0) return r; } return "c"; };
  // renvoie les 5 cartes tirées [{ id, sh, nw, pd }] ou un message d'erreur
  E.boosterOpen = (S) => {
    if (!s1(S)) return "Les boosters sont dans la partie de saison.";
    if (E.s1cOver(S)) return "La saison est finie : l'album reste, les boosters s'arrêtent.";
    const a = A(S); let from = "";
    if (E.boosterFree(S)) { a.free = E.now(); from = "jour"; } else if (a.bst > 0) { a.bst--; from = "reserve"; } else return "Plus de booster : un nouveau demain, ou en finissant des donjons de saison.";
    const out = [], hero = HEROS.length && E.rnd() < E.CARTE_HEROS_P;
    for (let i = 0; i < E.BOOSTER_N; i++) {
      const c = hero && i === 0 ? pick("h") : pick(roll(i === E.BOOSTER_N - 1)), sh = E.rnd() < E.CARTE_SHINY;
      const had = sh ? !!a.b[c.id] : !!a.o[c.id];
      let pd = 0;
      if (sh) { if (had) pd = DUST[c.rar] * 5; a.b[c.id] = (a.b[c.id] || 0) + 1; a.o[c.id] = a.o[c.id] || 1; }
      else { if (had) pd = DUST[c.rar]; a.o[c.id] = (a.o[c.id] || 0) + 1; }
      a.pd += pd; out.push({ id: c.id, sh, nw: !had, pd });
    }
    a.nb = (a.nb || 0) + 1;
    E.emit(S, "booster", { from, n: out.length });
    return out;
  };
  // fabriquer une carte manquante avec la Poussière d'étoile (jamais une brillante)
  E.cardCraft = (S, id) => {
    if (!s1(S)) return "La fabrication se fait dans la partie de saison."; const c = BY[id]; if (!c) return "Carte inconnue.";
    const a = A(S); if (a.o[id]) return "Tu as déjà cette carte."; const p = CRAFT[c.rar]; if (a.pd < p) return `Il faut ${p} Poussières d'étoile.`;
    a.pd -= p; a.o[id] = 1; return null;
  };

  /* ---------------- les donjons de saison donnent des boosters ---------------- */
  { const emit0 = E.emit; E.emit = function (S, t, d) { const r = emit0.apply(this, arguments);
      if (t === "dungeon" && S && s1(S) && !S.mono && !E.s1cOver(S)) try { const a = A(S), day = dayOf(E.now());
        if (a.djd !== day) { a.djd = day; a.djn = 0; }
        a.dj = (a.dj || 0) + 1;
        if (a.dj >= E.BOOSTER_DJ) { a.dj = 0; if (a.djn < E.BOOSTER_DJ_JOUR && E.boosterGive(S, 1)) a.djn++; }
      } catch (e) {}
      return r; }; }

  /* ---------------- paliers de l'album : titres (de collection) et succès de la saison ---------------- */
  const PAL = (E.CARTE_PAL = [[30, "Collectionneur de cartes"], [60, "Archiviste du Temps"], [90, "Gardien de l'Album"], [N, "Maître de l'Album"]]);
  const SHT = "Chasseur de brillantes";
  { const t0 = E.titles; if (t0) E.titles = (S) => { const t = t0(S); const n = E.cardCount(S);
      PAL.forEach(([k, nm]) => { if (n >= k && !t.includes(nm)) t.push(nm); }); if (E.cardShinyCount(S) && !t.includes(SHT)) t.push(SHT); return t; }; }
  { const ACH = E.ACH || []; const add = (o) => { if (!ACH.some((a) => a.id === o.id)) ACH.push(Object.assign({ s1: true, cat: "Saison 1", grp: "Album de cartes" }, o)); };
    PAL.forEach(([k, nm]) => add({ id: "s1ca" + k, name: nm, desc: `Avoir ${k} cartes différentes dans l'album.`, test: (S) => E.isS1c(S) && E.cardCount(S) >= k, prog: (S) => [Math.min(k, E.cardCount(S)), k], kamas: k * 1000 }));
    add({ id: "s1cash", name: SHT, desc: "Trouver une carte brillante dans un booster.", test: (S) => E.isS1c(S) && E.cardShinyCount(S) >= 1, prog: (S) => [Math.min(1, E.cardShinyCount(S)), 1], kamas: 50000 }); }
})(typeof window !== "undefined" ? window : globalThis);
