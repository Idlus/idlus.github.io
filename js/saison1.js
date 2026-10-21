/* ============================================================================
   Monocompte — Saison 1 « Les Fragments du Temps », partie jeu (lot 1, autorisé par Mathis le 20/10/2026).
   Décisions : 1A Carnet des Fragments (page à part) · 2A Boutique temporelle (page à part, aperçu) · 3A Éclats du Temps
   dans le sac, solde tenu par un registre · 4A 1 600 Éclats de défis, 400 par manche, bronze 25 % / argent 35 % / or 40 % ·
   5A six objets, 2 200 en tout · 6A jauge finale sans création ni dépense d'Éclats · 7A Éclats restants dans l'Éternel,
   Boutique d'Archives · 8A défi 12 « Rendez-vous du temps » · 9A hors ligne et Sablier dans le même quota ·
   ni vente directe ni marchand pour les Éclats du Temps (échanges entre joueurs et HdV de saison seulement).
   Les 9 règles des Éclats du Temps (Mathis, 19/10) :
     1. distincts des Éclats du Classique ; 2. échangeables entre joueurs ; 3. aucune boutique n'en crée contre des kamas ;
     4. plafond de 800 sur 56 jours seulement pour les activités ; 5. défis hors quota ; 6. achats et échanges hors quota ;
     7. rien ne remet le quota à zéro ; 8. le serveur fait autorité ; 9. le reste passe dans l'Éternel.
   REGISTRE PROVISOIRE : sans le registre du serveur, le registre vit dans la partie (S.mono.tf.led).
   Le nombre du sac (S.res) n'en est qu'une copie, réécrite à chaque opération.
   REGISTRE DU SERVEUR (étape 6b, supabase/monocompte.sql) : quand la partie Monocompte est en ligne (compte autorisé, E.tfSrv
   branché par js/mono_online.js), le solde, les Éclats générés et le quota affichés viennent du serveur (S.mono.tf.srv, copie
   gardée dans la sauvegarde), plus les gains pas encore envoyés (S.mono.tf.q). Chaque gain d'activité et chaque palier de défi
   part au serveur, qui applique lui-même les bornes et le quota ; un achat en boutique est fait par le serveur d'abord
   (une seule opération : débit + droit), puis recopié dans la partie. Les écrans ne changent pas.
   DATE DE SAISON : tout ce qui dépend du calendrier (manches, semaines du quota, défis, fin de saison) lit E.monoDate (E.monoNow est déjà pris par monodofus.js).
   Les durées réelles (56, 14 et 7 jours) ne changent jamais ; l'horloge de test (partie de test seulement,
   S.mono.test) fait seulement avancer la date de saison plus vite. Hors partie de test, elle n'a aucun effet.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const M = E.MONO; if (!M) return;
  const DAY = 86400000;
  /* durées réelles de la saison, en un seul réglage (lot 1, étape 3b) */
  M.dur = { season: 56 * DAY, manche: 14 * DAY, week: 7 * DAY, day: DAY };
  M.len = M.dur.season; M.jobs.manche = M.dur.manche;

  /* ---------------- horloge de test ---------------- */
  const TF = (M.tf = { res: "Éclat du Temps", icon: 995001, quota: 100, cap: 800, speeds: [1, 24, 168] });
  E.TF_RES = TF.res;
  // ressource du sac (3A), icône officielle de l'Éclat temporel ; jamais vendue au jeu (voir plus bas)
  if (D.RES && !D.RES[TF.res]) D.RES[TF.res] = { id: 0, icon: TF.icon, lvl: 1, price: 0, type: -2 };
  E.monoClockOn = (S) => !!(S && S.mono && S.mono.test === true && S.mono.clk && !S.mono.eternel);
  E.monoDate = (S) => {
    const now = E.now(); if (!E.monoClockOn(S)) return now; const k = S.mono.clk;
    return k.pause ? k.t : k.t + Math.max(0, now - k.at) * (k.spd || 1);
  };
  const reanchor = (S) => { const t = E.monoDate(S); S.mono.clk = Object.assign(S.mono.clk || {}, { t, at: E.now() }); };
  /* partie de test seulement : met l'horloge en route (on = false la coupe et la date de saison redevient la vraie) */
  E.monoTestClock = (S, on) => {
    if (!E.isMono(S)) return "Réservé au Monocompte.";
    if (on) { S.mono.test = true; if (!S.mono.clk) S.mono.clk = { t: E.now(), at: E.now(), spd: 1, pause: false }; return null; }
    delete S.mono.clk; delete S.mono.test; return null;
  };
  E.monoClockSet = (S, o) => {
    if (!E.monoClockOn(S)) return "Horloge de test coupée (partie de test seulement).";
    reanchor(S); const k = S.mono.clk;
    if (o.spd != null) { if (!TF.speeds.includes(+o.spd)) return "Vitesse inconnue."; k.spd = +o.spd; }
    if (o.pause != null) k.pause = !!o.pause;
    if (o.day != null) { const d = Math.max(1, Math.min(57, Math.floor(+o.day) || 1)); const t = E.monoT0(S) + (d - 1) * DAY; if (t < k.t) return "L'horloge de test n'avance que vers l'avant."; k.t = t; }
    return null;
  };
  /* le calendrier de la saison lit la date de saison */
  E.monoManche = (S) => Math.max(1, Math.floor((E.monoDate(S) - E.monoT0(S)) / M.dur.manche) + 1);
  E.monoOver = (S) => !!(S && S.mono && !S.mono.eternel && (E.monoDate(S) >= E.monoEnd(S) || !!E.monoSeasonDef(S.mono.s).closed)); // 6c : closed = saison fermée par le serveur
  E.monoDay = (S) => Math.max(1, Math.floor((Math.min(E.monoDate(S), E.monoEnd(S) - 1) - E.monoT0(S)) / DAY) + 1); // 1 à 56
  E.monoWeek = (S) => Math.floor((E.monoDay(S) - 1) / 7) + 1; // 1 à 8

  /* ---------------- joyaux de Maîtrise : 4 % au lieu de 8 % dans le Monocompte (décision du 19/10), puissance inchangée ---------------- */
  M.joy = 0.5;
  if (E.joyDrop) { const jd0 = E.joyDrop; E.joyDrop = function (S) {
    if (!E.isMono(S) || !E.joyRate) return jd0.apply(this, arguments);
    const r0 = E.joyRate; E.joyRate = (k) => r0(k) * M.joy; try { return jd0.apply(this, arguments); } finally { E.joyRate = r0; } }; }

  /* ---------------- les 12 défis (P-S11) ---------------- */
  // c : 0 combats, 1 métiers et économie, 2 communauté ; soon : se remplit avec le serveur Monocompte
  TF.MANCHES = [
    { n: "I", nom: "La Fissure" }, { n: "II", nom: "Les Échos du Passé" }, { n: "III", nom: "La Rupture" }, { n: "IV", nom: "Le Dernier Sablier" },
  ];
  TF.CATS = ["Combats", "Métiers et économie", "Communauté"];
  TF.REW = [[40, 56, 64], [30, 42, 48], [30, 42, 48]]; // 400 par manche : 160 + 120 + 120
  const DL = (id) => (D.DUNGEONS[id] || {}).lvl || 0;
  TF.DEFIS = [
    { id: "d1", m: 0, c: 0, n: "Refermer la Fissure", d: "Finir des donjons de niveau 1 à 100", need: [10, 25, 50] },
    { id: "d2", m: 0, c: 1, n: "Premiers outils", d: "Monter une spécialité de métier", need: [40, 70, 100], u: "niv.", val: (S) => Math.max(0, ...E.monoSpecs(S).filter(Boolean).map((j) => ((D.GATHER_JOBS[j] ? S.jobs[j] : (S.crafts || {})[j]) || {}).lvl || 0)) },
    { id: "d3", m: 0, c: 2, n: "Jamais seul", d: "Finir des donjons en groupe ou avec un mercenaire", need: [1, 5, 15] },
    { id: "d4", m: 1, c: 0, n: "Échos des archimonstres", d: "Vaincre des archimonstres", need: [5, 15, 30] },
    { id: "d5", m: 1, c: 1, n: "Mémoire des artisans", d: "Fabriquer des objets de niveau 100 ou plus", need: [30, 100, 250] },
    { id: "d6", m: 1, c: 2, n: "Marché des échos", d: "Vendre des lots à des joueurs différents (HdV de saison)", need: [5, 20, 50], soon: "avec l'HdV de saison du serveur Monocompte" },
    { id: "d7", m: 2, c: 0, n: "Tenir la Rupture", d: "Meilleure stasis sur un donjon de niveau 150 ou plus", need: [4, 6, 8], u: "stasis", best: 1 },
    { id: "d8", m: 2, c: 1, n: "Forger contre la Rupture", d: "Runes de forgemagie réussies sur des objets de niveau 150 ou plus", need: [50, 200, 500] },
    { id: "d9", m: 2, c: 2, n: "Front commun", d: "Agressions gagnées pour ton camp", need: [5, 20, 50] },
    { id: "d10", m: 3, c: 0, n: "Le Dernier Sablier", d: "Stasis sur un donjon de niveau 190 ou plus, seul (en groupe, il faut 2 stasis de plus)", need: [6, 7, 8], u: "stasis", best: 1 },
    { id: "d11", m: 3, c: 1, n: "Horloger", d: "Fabriquer des objets de niveau 200 de ta spécialité", need: [1, 5, 15] },
    { id: "d12", m: 3, c: 2, n: "Rendez-vous du temps", d: "Finir des donjons de la manche IV en groupe, avec des joueurs différents", need: [2, 5, 10], u: "joueurs", soon: "avec les groupes en direct du serveur Monocompte" },
  ];
  TF.TOTAL = TF.DEFIS.reduce((a, x) => a + TF.REW[x.c].reduce((s, v) => s + v, 0), 0); // 1 600
  E.tfDefi = (id) => TF.DEFIS.find((x) => x.id === id);
  E.tfReward = (x) => TF.REW[x.c];

  /* ---------------- gains d'activité (P-S9) : par jour de saison, puis quota de 100 par semaine cumulable ---------------- */
  TF.ACT = {
    dj: { n: "Donjons (niveau du héros − 20 ou plus)", gain: 1, max: 8 },
    arch: { n: "Archimonstres", gain: 2, max: 6 }, // 3 archimonstres
    job: { n: "Métiers (1 toutes les 50 actions)", gain: 1, max: 4, per: 50 },
    grp: { n: "Donjons en groupe (en plus)", gain: 1, max: 2 },
  };
  TF.DAYMAX = Object.values(TF.ACT).reduce((a, x) => a + x.max, 0); // 20

  /* ---------------- boutique (5A) ---------------- */
  TF.SHOP = [
    { id: "emb", ic: 995004, n: "Emblème « Boucle du temps »", t: "Emblème", lie: 1, p: 200, d: "À côté du nom de ton héros (chat, classements et fiche avec le serveur)." },
    { id: "orn", ic: 995008, n: "Ornement « Fissure figée »", t: "Ornement", lie: 1, p: 300, d: "Sur la carte de ton héros." },
    { id: "cadre", ic: 995005, n: "Cadre « Boucle intemporelle »", t: "Cadre", lie: 1, p: 350, d: "Autour du portrait de ton héros." },
    { id: "aura", ic: 995006, n: "Aura « Distorsion temporelle »", t: "Aura", lie: 1, p: 600, d: "Un halo bleu autour de ton héros, sur sa carte et en combat." },
    { id: "sab", ic: 995003, n: "Sablier sacré de la Saison 1", t: "Objet de collection", lie: 0, p: 250, d: "Objet de collection pour le Havre-Sac. Échangeable." },
    { id: "cri", ic: 995002, n: "Cristal intemporel", t: "Objet de collection", lie: 0, p: 500, d: "Objet de collection numéroté pour le Havre-Sac. Échangeable." },
  ];
  TF.SHOP_TOTAL = TF.SHOP.reduce((a, x) => a + x.p, 0); // 2 200
  // cosmétiques liés au compte : clés d'apparence gardées d'une saison à l'autre (E.monoLegacy prend les clés « tf_ »)
  TF.UNLOCK = { emb: "tf_emb", orn: "gift_o_tf_orn", cadre: "gift_f_tf_cadre", aura: "tf_aura" };
  E.tfShopItem = (id) => TF.SHOP.find((x) => x.id === id);
  if (E.ORN) E.ORN.tf_orn = { name: () => "Fissure figée", req: "Monocompte, Saison 1 : Boutique temporelle (300 Éclats du Temps)", ok: (S) => !!(S.unlocks && S.unlocks.gift_o_tf_orn) };
  if (E.SFRAMES) E.SFRAMES.tf_cadre = { name: () => "Cadre « Boucle intemporelle »", req: "Monocompte, Saison 1 : Boutique temporelle (350 Éclats du Temps)", ok: (S) => !!(S.unlocks && S.unlocks.gift_f_tf_cadre) };
  /* emblème et aura : portés dès l'achat, à retirer dans la boutique (réglage de la partie) */
  E.tfWorn = (S, k) => !!(S && E.isMono(S) && S.unlocks && S.unlocks[TF.UNLOCK[k]] && !((S.settings && S.settings.tfOff) || {})[k]);
  E.tfWear = (S, k, on) => { if (!S.unlocks || !S.unlocks[TF.UNLOCK[k]]) return "Pas encore obtenu."; S.settings.tfOff = S.settings.tfOff || {}; if (on) delete S.settings.tfOff[k]; else S.settings.tfOff[k] = 1; return null; };

  /* ---------------- état et registre provisoire ---------------- */
  E.tfState = (S) => {
    if (!E.isMono(S)) return null; const s = S.mono.s || 1;
    const T = S.mono.tf;
    if (!T || T.s !== s) S.mono.tf = { s, seq: 0, led: [], act: {}, jobAcc: 0, d: {}, own: {}, col: {}, fin: {} };
    return S.mono.tf;
  };
  E.tfLedger = (S) => { const T = E.tfState(S); return T ? T.led : []; };
  /* registre du serveur : sa dernière réponse. Une partie qui a été en ligne garde cette copie (et sa file de gains) même
     hors connexion : son registre de la partie n'a pas les gains crédités ailleurs, il ne sert plus qu'aux parties jamais en ligne. */
  E.tfSrv = null;
  E.tfSrvOf = (S) => { const T = E.isMono(S) && E.tfState(S); return T && T.srv ? T.srv : null; };
  const srvLive = (S) => !!(E.tfSrv && E.tfSrv.live(S));
  const pend = (S, o) => ((E.tfState(S) || {}).q || []).reduce((a, x) => a + (!o || x.t === o ? x.n : 0), 0); // gains pas encore envoyés
  E.tfBalance = (S) => { const R = E.tfSrvOf(S); return R ? R.solde + pend(S) : E.tfLedger(S).reduce((a, l) => a + l.n, 0); };
  E.tfActTotal = (S) => { const R = E.tfSrvOf(S); return R ? R.genere + pend(S, "act") : E.tfLedger(S).reduce((a, l) => a + (l.o === "act" ? l.n : 0), 0); }; // Éclats générés par les activités (le quota ne compte que ceux-là)
  E.tfQuota = (S) => { const R = E.tfSrvOf(S); return R && R.quota != null ? R.quota : Math.min(TF.cap, TF.quota * E.monoWeek(S)); }; // déjà débloqué à la date de saison
  /* un gain à envoyer au registre du serveur (gardé dans la partie tant que le serveur ne l'a pas reçu) */
  const fwd = (S, op) => { if (!srvLive(S) && !E.tfSrvOf(S)) return; const T = E.tfState(S); (T.q = T.q || []).push(op); try { if (srvLive(S)) E.tfSrv.flush(S); } catch (e) {} };
  /* réponse du serveur : son état du registre devient celui qu'on affiche */
  E.tfSrvSet = (S, r) => { const T = E.isMono(S) && E.tfState(S); if (!T || !r || r.solde == null) return; T.srv = { solde: r.solde, genere: r.genere, quota: r.quota, reste: r.reste, sem: r.semaine, jour: r.jour, sid: r.saison, at: E.now() }; E.tfSync(S); };
  /* le sac ne montre qu'une copie du registre */
  E.tfSync = (S) => {
    if (!S || !S.res) return;
    if (!E.isMono(S)) { if (S.res[TF.res] != null) delete S.res[TF.res]; return; } // jamais d'Éclats du Temps au Classique
    const b = E.tfBalance(S); if (b > 0) S.res[TF.res] = b; else delete S.res[TF.res];
  };
  /* une opération du registre : src est unique (une même source ne paie jamais deux fois) */
  const post = (S, n, o, src, why) => {
    const T = E.tfState(S); if (!T || !n) return 0;
    if (src && T.led.some((l) => l.src === src)) return 0;
    T.seq++; T.led.push({ id: T.seq, n, o, src: src || `${o}:${T.seq}`, t: E.monoDate(S), why: why || "" });
    E.tfSync(S); return n;
  };
  E.tfPost = post;
  const open = (S) => E.isMono(S) && !E.monoEternal(S) && !E.monoOver(S);

  /* activité : borne du jour (par source), puis quota cumulé de la saison */
  E.tfActivity = (S, kind, n = 1) => {
    if (!open(S)) return 0; const A = TF.ACT[kind]; if (!A) return 0; const T = E.tfState(S);
    const day = E.monoDay(S); if (T.act.day !== day) T.act = { day };
    const room = Math.max(0, A.max - (T.act[kind] || 0));
    const q = Math.max(0, E.tfQuota(S) - E.tfActTotal(S));
    const g = Math.min(n * A.gain, room, q); if (g <= 0) return 0;
    T.act[kind] = (T.act[kind] || 0) + g;
    // une ligne par jour et par source (registre provisoire) ; le registre du serveur écrit une ligne par gain
    const src = `act:${day}:${kind}`; const L = T.led.find((l) => l.src === src);
    if (L) { L.n += g; L.t = E.monoDate(S); E.tfSync(S); } else post(S, g, "act", src, `${A.n}, jour ${day}`);
    // 6a : rien à envoyer : partie en ligne, le serveur crée lui-même un bon de butin par gain (jour et rang du gain dans la journée),
    // d'après cette ligne du registre provisoire, à chaque partie validée par le Bouclier ; il applique les bornes et le quota
    return g;
  };

  /* défis : débloqués au début de leur manche, faisables jusqu'au jour 56 */
  E.tfDefiOpen = (S, x) => open(S) && Math.min(4, E.monoManche(S)) >= x.m + 1;
  E.tfProgress = (S, x) => { const T = E.tfState(S); if (!T) return 0; const r = T.d[x.id] || {}; return x.val ? (E.tfDefiOpen(S, x) ? Math.max(r.p || 0, x.val(S)) : r.p || 0) : r.p || 0; };
  E.tfTier = (S, x) => x.need.filter((v) => E.tfProgress(S, x) >= v).length;
  const pay = (S, x) => {
    const T = E.tfState(S); const r = (T.d[x.id] = T.d[x.id] || { p: 0, paid: 0 }); const tier = E.tfTier(S, x);
    let got = 0; while ((r.paid || 0) < tier) { const i = r.paid || 0; const n = post(S, TF.REW[x.c][i], "defi", `defi:${x.id}:${i}`, `${x.n}, ${["bronze", "argent", "or"][i]}`);
      r.paid = i + 1; got += n; if (n) fwd(S, { t: "defi", id: x.id, i, n }); if (n && E.note) E.note(S, `Carnet des Fragments : « ${x.n} » ${["bronze", "argent", "or"][i]}, +${n} Éclats du Temps.`, "rare"); }
    return got;
  };
  const bump = (S, id, v, best) => {
    const x = E.tfDefi(id); if (!x || !E.tfDefiOpen(S, x)) return; const T = E.tfState(S); const r = (T.d[x.id] = T.d[x.id] || { p: 0, paid: 0 });
    r.p = best ? Math.max(r.p || 0, v) : (r.p || 0) + v; pay(S, x);
  };
  E.tfBump = bump;
  E.tfCheck = (S) => { if (!open(S)) return 0; return TF.DEFIS.reduce((a, x) => a + (E.tfDefiOpen(S, x) ? pay(S, x) : 0), 0); };
  /* partie de test seulement : donner de la progression de défi pour vérifier les paliers pendant la bêta accélérée */
  E.tfTestProgress = (S, id, v) => { if (!E.monoClockOn(S)) return "Partie de test seulement."; const x = E.tfDefi(id); if (!x) return "Défi inconnu.";
    if (!E.tfDefiOpen(S, x)) return "Ce défi n'est pas encore ouvert."; bump(S, id, +v || 0, x.best); return null; };

  /* ---------------- boutique temporelle et Boutique d'Archives ---------------- */
  E.tfOwned = (S, id) => { const T = E.tfState(S); if (!T) return false; const k = TF.UNLOCK[id]; return !!T.own[id] || !!(k && S.unlocks && S.unlocks[k]); };
  E.tfCanBuy = (S) => E.isMono(S) && (E.monoEternal(S) ? !!(S.mono.tf && S.mono.tf.s === S.mono.eternel.s) : !E.monoOver(S));
  E.tfBuy = (S, id) => {
    if (!E.tfCanBuy(S)) return "La boutique est fermée.";
    const x = E.tfShopItem(id); if (!x) return "Objet inconnu."; const T = E.tfState(S);
    if (T.own[id]) return "Déjà acheté cette saison.";
    if (x.lie && E.tfOwned(S, id)) return "Tu l'as déjà : il est lié à ton compte.";
    if (E.tfBalance(S) < x.p) return `Il faut ${x.p} Éclats du Temps.`;
    const done = (no) => {
      T.own[id] = E.monoDate(S);
      post(S, -x.p, "achat", `achat:${id}`, `${E.monoEternal(S) ? "Boutique d'Archives" : "Boutique temporelle"} : ${x.n}`);
      S.unlocks = S.unlocks || {};
      if (x.lie) S.unlocks[TF.UNLOCK[id]] = 1;
      else { T.col[id] = (T.col[id] || 0) + 1; if (id === "cri") T.criNo = no || T.criNo || T.seq; } // sans serveur : numéro provisoire
      if (E.note) E.note(S, `${x.n} acheté pour ${x.p} Éclats du Temps.`, "rare");
      return null;
    };
    // partie en ligne : le serveur fait l'achat (débit + droit en une opération) ; la partie le recopie ensuite. Renvoie une promesse.
    if (E.tfSrvOf(S) && !srvLive(S) && !E.monoEternal(S)) return "Connexion au serveur nécessaire pour la boutique : réessaie dans un instant.";
    // 6c : Boutique d'Archives d'un héros de l'Éternel qui a été en ligne : le serveur débite le registre de sa saison finie
    if (E.monoEternal(S) && E.tfSrvOf(S) && E.tfSrv && E.tfSrv.archive) return Promise.resolve(E.tfSrv.archive(S, id)).then((r) => { if (!r || r.err) return (r && r.err) || "Pas de connexion au serveur : réessaie dans un instant.";
      E.tfSrvSet(S, r); return done(r.numero); }, () => "Pas de connexion au serveur : réessaie dans un instant.");
    if (srvLive(S)) return Promise.resolve(E.tfSrv.buy(S, id)).then((r) => { if (!r || r.err) return (r && r.err) || "Pas de connexion au serveur : réessaie dans un instant.";
      E.tfSrvSet(S, r); return done(r.numero); }, () => "Pas de connexion au serveur : réessaie dans un instant.");
    return done();
  };

  /* ---------------- événement final (6A) : jauge commune, aucun Éclat créé ni dépensé ---------------- */
  TF.FIN = { from: 50, marks: [[25, "Titre « Gardien du temps »"], [50, "Ornement « Temps suspendu »"], [75, "Cadre « Rouages figés »"], [100, "Aura « Sablier stabilisé »"]] };
  E.tfFinOpen = (S) => open(S) && E.monoDay(S) >= TF.FIN.from;
  const finTouch = (S) => { if (!E.tfFinOpen(S)) return; const T = E.tfState(S); T.fin[E.monoDay(S)] = (T.fin[E.monoDay(S)] || 0) + 1; };
  E.tfFinDays = (S) => Object.keys((E.tfState(S) || { fin: {} }).fin).length;

  /* ---------------- ni vente directe, ni marchand, ni « Garder au maximum » pour les Éclats du Temps ---------------- */
  const isTF = (n) => n === TF.res;
  { const p0 = E.resPrice; E.resPrice = function (n) { return isTF(n) ? 0 : p0.apply(this, arguments); }; }
  { const m0 = E.merchantRes; E.merchantRes = function (S, n) { return isTF(n) ? 0 : m0.apply(this, arguments); }; }
  if (E.venteOk) { const v0 = E.venteOk; E.venteOk = function (n) { return !isTF(n) && v0.apply(this, arguments); }; }
  E.tfSellable = (n) => !isTF(n) || !!(E.tfSrv && E.tfSrv.market && E.tfSrv.market()); // 6a : HdV de saison et échange du serveur Monocompte (registre, une seule opération)

  /* ---------------- écoute du moteur ---------------- */
  const heroLvl = (S) => Math.max(1, ...S.chars.filter((c) => !c.merc).map((c) => c.lvl || 1));
  const emit0 = E.emit;
  E.emit = function (S, t, d) {
    const r = emit0.apply(this, arguments);
    if (S && S.mono && !S.monoRun && open(S)) try {
      d = d || {};
      if (t === "dungeon") {
        const lv = DL(d.id), k = d.stasis || 1;
        if (lv >= heroLvl(S) - 20) E.tfActivity(S, "dj");
        if (d.group) E.tfActivity(S, "grp");
        if (lv <= 100) bump(S, "d1", 1);
        if (d.group || S.mono.merc) bump(S, "d3", 1);
        if (lv >= 150) bump(S, "d7", k, true);
        if (lv >= 190) bump(S, "d10", d.group ? k - 2 : k, true);
        if (d.group && Array.isArray(d.ids) && Math.min(4, E.monoManche(S)) === 4) { const T = E.tfState(S); T.rdv = T.rdv || {}; d.ids.forEach((u) => (T.rdv[u] = 1)); bump(S, "d12", Object.keys(T.rdv).length, true); }
        finTouch(S);
      }
      if (t === "win") (d.mons || []).forEach((m) => { if (m.archi) { E.tfActivity(S, "arch"); bump(S, "d4", 1); } });
      if (t === "harvest" || t === "craft") {
        const T = E.tfState(S); T.jobAcc = (T.jobAcc || 0) + (t === "harvest" ? d.n || 0 : 1);
        const per = TF.ACT.job.per; if (T.jobAcc >= per) { const n = Math.floor(T.jobAcc / per); T.jobAcc -= n * per; E.tfActivity(S, "job", n); }
        finTouch(S);
      }
      if (t === "craft" && d.tpl && D.ITEMS[d.tpl]) {
        const I = D.ITEMS[d.tpl]; if (I.lvl >= 100) bump(S, "d5", 1);
        if (I.lvl >= 200 && I.craft && E.monoSpecs(S).includes(I.craft.job)) bump(S, "d11", 1);
      }
      if (t === "joblvl" || t === "craft" || t === "level") { const x = E.tfDefi("d2"); if (E.tfDefiOpen(S, x)) pay(S, x); }
      if (t === "agression" && d.win) bump(S, "d9", 1); // agressions gagnées (js/honneur.js, E.agrEnd)
    } catch (e) {}
    return r;
  };
  /* runes réussies sur un objet de niveau 150 ou plus (défi 8) */
  if (E.forgemage) { const f0 = E.forgemage; E.forgemage = function (S, uid) {
    const it = S && S.items && S.items[uid]; const lv = it && D.ITEMS[it.tpl] ? D.ITEMS[it.tpl].lvl : 0;
    const r = f0.apply(this, arguments);
    try { if (r && r.ok && lv >= 150 && S.mono && open(S)) bump(S, "d8", 1); } catch (e) {}
    return r; }; }
  /* la copie du sac suit le registre, et la saison finie garde ses Éclats pour l'Éternel */
  const tick0 = E.tick;
  E.tick = function (S) { const r = tick0.apply(this, arguments); if (S && S.res) E.tfSync(S); return r; };
  const toEt0 = E.monoToEternal;
  E.monoToEternal = function (S) { if (S && S.mono && !S.mono.eternel) try { E.tfCheck(S); } catch (e) {} const r = toEt0.apply(this, arguments); if (S && S.mono) { delete S.mono.clk; delete S.mono.test; E.tfSync(S); } return r; };
  /* chargement : une vieille partie Monocompte n'a pas de registre (il se crée vide) ; le Classique n'a jamais d'Éclats du Temps */
  const des0 = E.deserialize;
  E.deserialize = function () { const S = des0.apply(this, arguments); try { if (S) E.tfSync(S); } catch (e) {} return S; };
})(typeof window !== "undefined" ? window : globalThis);
