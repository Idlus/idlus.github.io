/* 0.1.13 : archimonstres et Dofus — l'album des âmes et les 18 Dofus.
   Chaque archimonstre vaincu peut être capturé dans l'album avec une Pierre d'âme (automatique, une fois par archimonstre).
   Les pierres se fabriquent chez le Bricoleur (niveau 25) et s'obtiennent au premier passage d'une stasis, au Bureau des primes
   et aux paliers de la quête « Éternelle moisson » (Dofus Ocre). Le Parfum de pistage (Bricoleur 40) double les chances
   d'archimonstre pendant 2 h, le meuble « Autel des âmes » les augmente de 40 %.
   Les 18 Dofus de DOFUS (bonus réels d'après DofusDB) se gagnent par une quête chacun (Quêtes › Dofus), avec une chance
   infime en butin du boss de leur donjon ; une copie pour un autre héros se fabrique chez le Bricoleur avec de la Poussière de stasis. */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const { MONSTERS, ZONES, DUNGEONS, ITEMS, CONSUMABLES, SPECIAL_CRAFTS } = D;
  const SUBS = E.SUBS;
  const rnd = () => E.rnd();

  /* ---------- les archimonstres, rangés par zone ---------- */
  E.ARCHIS = {};
  Object.keys(MONSTERS).forEach((k) => {
    const M = MONSTERS[k]; if (!M.archiOf) return;
    const sub = Object.values(SUBS).find((s) => s.monsters.includes(M.archiOf)); if (!sub) return;
    E.ARCHIS[k] = { k, name: M.name, base: MONSTERS[M.archiOf] ? MONSTERS[M.archiOf].name : M.archiOf, baseKey: M.archiOf, lvl: M.lvl, zone: sub.zone, sub: sub.id };
  });
  E.ARCHI_ZONES = ZONES.map((z) => z.id).filter((z) => Object.values(E.ARCHIS).some((a) => a.zone === z));
  E.archisOf = (zone) => Object.values(E.ARCHIS).filter((a) => a.zone === zone).sort((a, b) => a.lvl[0] - b.lvl[0] || (a.name < b.name ? -1 : 1));
  E.ARCHI_TOTAL = Object.keys(E.ARCHIS).length;
  E.zoneName = (id) => { const z = ZONES.find((x) => x.id === id); return z ? z.name : id; };

  /* ---------- consommables, recettes, meuble, comptoir ---------- */
  CONSUMABLES.pierre_ame = { name: "Pierre d'âme", icon: "🔮", kind: "util", auto: true, desc: "Automatique : quand un archimonstre est vaincu, une pierre capture son âme pour l'album (une fois par archimonstre)." };
  CONSUMABLES.parfum_piste = { name: "Parfum de pistage", icon: "🧴", kind: "boost", boost: "piste", pct: 100, dur: 7200, desc: "Chances d'archimonstre ×2 pendant 2 h (se cumule avec le Bonbon Traqueur)." };
  SPECIAL_CRAFTS["Pierre d'âme"] = { job: "bricoleur", lvl: 25, cons: "pierre_ame", n: 5, ing: [["Bois de Châtaignier", 10], ["Sauge", 10], [E.POUSSIERE, 5]] };
  SPECIAL_CRAFTS["Parfum de pistage"] = { job: "bricoleur", lvl: 40, cons: "parfum_piste", n: 1, ing: [["Menthe Sauvage", 10], ["Trèfle à 5 feuilles", 10], [E.POUSSIERE, 15]] };
  E.ARCHI_FURN = "Autel des âmes";
  if (E.FURN) E.FURN[E.ARCHI_FURN] = { room: "trophees", kind: "archi", v: 40, src: "Éternelle moisson, palier 4", txt: "Chances d'archimonstre ×1,4" };
  if (E.SHOPS && E.SHOPS.prime && !E.SHOPS.prime.items.some((x) => x.cons === "pierre_ame")) E.SHOPS.prime.items.splice(7, 0, { id: "b8", cons: "pierre_ame", cost: 3 });
  const prevMult = E.archiMult;
  E.archiMult = (S) => prevMult(S) * (1 + E.boostPct(S, "piste") / 100) * (1 + (E.furnBonus ? E.furnBonus(S, "archi") : 0) / 100);
  E.archiOdds = (S) => E.ARCHI_CHANCE * E.archiMult(S); // chance par monstre, pour l'affichage

  /* ---------- âmes ---------- */
  const souls = (S) => (S.souls = S.souls || {});
  E.hasSoul = (S, k) => !!souls(S)[k];
  E.soulCount = (S, zone) => Object.keys(souls(S)).filter((k) => E.ARCHIS[k] && (!zone || E.ARCHIS[k].zone === zone)).length;
  E.stones = (S) => (S.cons && S.cons.pierre_ame) || 0;
  /* appelé par le moteur pour chaque archimonstre vaincu : "new" (âme capturée), "dup" (déjà dans l'album), "nostone" */
  E.captureSoul = (S, m, opts = {}) => {
    const k = m.key; if (!E.ARCHIS[k]) return null;
    if (souls(S)[k]) return "dup";
    if (!(E.stones(S) > 0)) { E.note(S, `Pas de Pierre d'âme : l'âme de ${m.name} s'est échappée.`, "warn"); return "nostone"; }
    S.cons.pierre_ame--; if (!S.cons.pierre_ame) delete S.cons.pierre_ame;
    souls(S)[k] = E.now(); S.cnt = S.cnt || {}; S.cnt.souls = E.soulCount(S);
    E.note(S, `Âme capturée : ${m.name} (${S.cnt.souls} / ${E.ARCHI_TOTAL}) !`, "rare");
    if (!opts.offline && E.celebrate) E.celebrate({ t: "soul", key: k });
    E.emit(S, "soul", { key: k, zone: E.ARCHIS[k].zone });
    return "new";
  };
  /* premier passage d'une stasis : des pierres en plus du coffre */
  E.firstPassStones = (S, k, out) => { const n = k >= 8 ? 3 : k >= 4 ? 2 : 1; E.addCons(S, "pierre_ame", n); if (out) out.push(`${n} × Pierre d'âme`); };

  /* ---------- quête de l'Ocre : « Éternelle moisson », six paliers ---------- */
  E.OCRE_TIERS = [
    { name: "Astrub", zones: ["astrub"], rew: { cons: ["pierre_ame", 10], kamas: 20000 }, txt: "10 Pierres d'âme et 20 000 kamas" },
    { name: "Amakna", zones: ["amakna"], rew: { title: "Moissonneur", kamas: 50000 }, txt: "Titre « Moissonneur » et 50 000 kamas" },
    { name: "Cania et Sidimote", zones: ["cania", "sidimote"], rew: { cons: ["parfum_piste", 5], kamas: 100000 }, txt: "5 Parfums de pistage et 100 000 kamas" },
    { name: "Koalaks, Abraknydes et Moon", zones: ["koalaks", "abrak", "moon"], rew: { furn: E.ARCHI_FURN, orn: "ame", kamas: 200000 }, txt: "Meuble « Autel des âmes », ornement « Âme violette » et 200 000 kamas" },
    { name: "Dragoeufs, Otomaï et Minotoror", zones: ["dragoeufs", "otomai", "minotoror"], rew: { cons: ["bonbon_royal", 3], kamas: 400000 }, txt: "3 Bonbons Royaux et 400 000 kamas" },
    { name: "Pandala et Grobe", zones: ["pandala", "grobe"], rew: { dofus: "ocre", title: "Éternel Moissonneur" }, txt: "Dofus Ocre (+1 PA) et titre « Éternel Moissonneur »" },
  ];
  const ocre = (S) => (S.ocre = S.ocre || { tier: 0 });
  E.ocreTier = (S) => ocre(S).tier; // paliers déjà récompensés
  E.ocreProgress = (S, i) => { const T = E.OCRE_TIERS[i]; const all = T.zones.reduce((a, z) => a + E.archisOf(z).length, 0); const d = T.zones.reduce((a, z) => a + E.soulCount(S, z), 0); return [d, all]; };
  const giveTitle = (S, t) => { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); };
  const giveRew = (S, R) => {
    if (R.kamas) S.kamas += R.kamas;
    if (R.cons) E.addCons(S, R.cons[0], R.cons[1]);
    if (R.title) giveTitle(S, R.title);
    if (R.furn && E.giveFurn) E.giveFurn(S, R.furn, "Éternelle moisson");
    if (R.orn) { S.unlocks = S.unlocks || {}; S.unlocks[R.orn] = 1; }
    if (R.dofus) E.giveDofus(S, R.dofus, "Éternelle moisson achevée");
  };
  const checkOcre = (S) => {
    let guard = 0;
    while (ocre(S).tier < E.OCRE_TIERS.length && guard++ < 10) {
      const i = ocre(S).tier; const [d, all] = E.ocreProgress(S, i); if (d < all) return;
      ocre(S).tier = i + 1; const T = E.OCRE_TIERS[i]; giveRew(S, T.rew);
      E.note(S, `Éternelle moisson, palier ${i + 1} (${T.name}) accompli : ${T.txt}.`, "rare");
      if (E.celebrate) E.celebrate({ t: "ocre", tier: i + 1 });
    }
  };

  /* ---------- les 18 Dofus (niveau, icône DofusDB, bonus) et leurs quêtes ---------- */
  /* étapes : dg (vaincre un donjon à une stasis ; chal = avec ce challenge réussi ; nodown = sans héros à terre), dgs (plusieurs donjons),
     kill (monstres vaincus dans une zone), harvest (ressource récoltée), chal (victoires avec ce challenge réussi), soul (âmes d'une zone),
     almanax (offrandes), perfect (objets parfaits possédés), ocre (les six paliers) */
  const dg = (id, k, x) => Object.assign({ t: "dg", dg: id, k }, x || {});
  /* chaque Dofus tombe du boss qui lui correspond dans DOFUS (Mathis : « le drop doit bien représenter le donjon ») :
     Cawotte les champs (le Wa Wabbit n'est pas dans le jeu), Dokoko l'Arbre de Moon, Kaliptus les Koalaks, Émeraude Crocabulia,
     Turquoise (dragon de l'Eau) la Dame des Eaux, Domakuro le Maître Corbac (encre noire), Glaces Missiz Frizz, Argenté Scintillant la déesse Ilyzaelle */
  const L = [
    ["cacao", "Dofus Cacao", 50, 23029, { tac: 10 }, "cour_bouftou_royal", [dg("cour_bouftou_royal", 3), { t: "kill", zone: "astrub", n: 150 }, dg("cour_bouftou_royal", 5)]],
    ["cawotte", "Dofus Cawotte", 60, 23006, { sa: 60 }, "grange_tournesol", [dg("grange_tournesol", 3), { t: "harvest", res: "Orge", n: 200 }, { t: "soul", zone: "astrub", n: 5 }, dg("grange_tournesol", 6)]],
    ["dokoko", "Dokoko", 80, 23022, {}, "arbre_moon", [dg("arbre_moon", 3), { t: "chal", chal: "survivant", n: 50 }, { t: "soul", zone: "moon", n: 3 }, dg("arbre_moon", 6, { nodown: true })]],
    ["kaliptus", "Dofus Kaliptus", 100, 23010, { pp: 30 }, "caverne_koulosse", [{ t: "kill", zone: "koalaks", n: 200 }, dg("caverne_koulosse", 3), { t: "almanax", n: 7 }, { t: "soul", zone: "koalaks", n: 5 }]],
    ["emeraude", "Dofus Émeraude", 100, 23002, { vit: 200 }, "antre_crocabulia", [dg("antre_crocabulia", 4), { t: "harvest", res: "Bois de Chêne", n: 300 }, { t: "soul", zone: "dragoeufs", n: 3 }, dg("antre_crocabulia", 8)]],
    ["dolmanax", "Dolmanax", 100, 23018, { fo: 70, ine: 70, cha: 70, age: 70 }, "repaire_kharnozor", [{ t: "kill", zone: "dragoeufs", n: 300 }, dg("repaire_kharnozor", 5), dg("repaire_kharnozor", 7)]],
    ["pourpre", "Dofus Pourpre", 110, 23001, { pui: 80 }, "antre_dragon_cochon", [dg("antre_dragon_cochon", 4), { t: "chal", chal: "barbare", n: 100 }, dg("antre_dragon_cochon", 7)]],
    ["dotruche", "Dotruche", 110, 23019, { so: 25 }, "voliere_haute_truche", [dg("tofulailler_royal", 4), dg("voliere_haute_truche", 5), { t: "soul", zone: "cania", n: 5 }]],
    ["domakuro", "Domakuro", 120, 23032, { inv: 1 }, "biblio_corbac", [dg("biblio_corbac", 4), { t: "chal", chal: "elitiste", n: 30 }, dg("biblio_corbac", 7)]],
    ["turquoise", "Dofus Turquoise", 160, 23003, { cri: 10 }, "vallee_dame_eaux", [dg("vallee_dame_eaux", 5), { t: "kill", zone: "pandala", n: 300 }, { t: "perfect", n: 1 }, dg("vallee_dame_eaux", 8)]],
    ["ocre", "Dofus Ocre", 160, 23012, { pa: 1 }, null, [{ t: "ocre" }]],
    ["vulbis", "Dofus Vulbis", 180, 23004, { pm: 1 }, "donjon_harebourg", [dg("taniere_givrefoux", 6), { t: "dgs", dgs: ["cavernes_kolosso", "antichambre_gloursons"], k: 7 }, dg("donjon_harebourg", 7), dg("donjon_harebourg", 9)]],
    ["ivoire", "Dofus Ivoire", 180, 23011, { rt: 4, rf: 4, re: 4, ra: 4, rn: 4 }, "palais_nidas", [dg("palais_nidas", 5), dg("aquadome_merkator", 7), dg("palais_nidas", 9)]],
    ["ebene", "Dofus Ébène", 180, 23007, { fui: 40 }, "pyramide_ombre", [dg("pyramide_ombre", 5), dg("trone_cour_sombre", 6), dg("pyramide_ombre", 8, { chal: "chacun" })]],
    ["glaces", "Dofus des Glaces", 180, 23005, { dt: 25, df: 25, de: 25, da: 25, dn: 25 }, "forgefroide_frizz", [{ t: "dgs", dgs: ["labo_nileza", "transporteur_sylargh", "salons_klime"], k: 6 }, { t: "chal", chal: "incurable", n: 20 }, dg("forgefroide_frizz", 8)]],
    ["sylvestre", "Dofus Sylvestre", 180, 23036, { po: 1 }, "antre_korriandre", [dg("antre_korriandre", 5), { t: "soul", zone: "abrak", n: 3 }, dg("antre_korriandre", 8)]],
    ["argente", "Dofus Argenté Scintillant", 180, 23027, { vit: 300 }, "belvedere_ilyzaelle", [dg("oeil_vortex", 5), dg("defi_chaloeil", 6), dg("belvedere_ilyzaelle", 8)]],
    ["cauchemar", "Dofus du Cauchemar", 180, 23034, { ini: 1000 }, "chambre_tal_kasha", [dg("chambre_tal_kasha", 5), { t: "chal", chal: "rapide", n: 50 }, dg("chambre_tal_kasha", 8)]],
  ];
  E.DOFUS = {}; E.DOFUS_ORDER = [];
  E.DOKOKO_PCT = 3; // Dokoko : % des PV max rendus à chaque début de tour
  E.DOFUS_DROP = 1 / 1000;      // butin du boss de son donjon, dès la stasis 5 (Mathis : « extrêmement faible »)
  E.OCRE_DROP = 1 / 5000;       // Dofus Ocre : tout boss de niveau 160 ou plus, dès la stasis 8
  E.DOFUS_DROP_STASIS = 5;
  L.forEach(([id, name, lvl, icon, stats, dgid, steps]) => {
    const tpl = "dofus_" + id;
    E.DOFUS[id] = { id, name, lvl, icon, stats, dg: dgid, steps, tpl };
    E.DOFUS_ORDER.push(id);
    const st = {}; for (const k in stats) st[k] = [stats[k], stats[k]];
    ITEMS[tpl] = { name, slot: "dofus", lvl, stats: st, icon, dofus: id, rarity: "legendaire", desc: id === "dokoko" ? `Chaque début de tour, le porteur récupère ${E.DOKOKO_PCT} % de ses PV.` : null };
    SPECIAL_CRAFTS[`Copie : ${name}`] = { job: "bricoleur", lvl: Math.max(25, lvl - 10), dofus: id, ing: [[E.POUSSIERE, Math.round(lvl * 1.5)]] };
  });
  E.dofusBonusTxt = (id) => { const Df = E.DOFUS[id]; if (id === "dokoko") return ITEMS[Df.tpl].desc; const ks = Object.keys(Df.stats); const v = Df.stats[ks[0]];
    if (ks.length > 1 && ks.every((k) => Df.stats[k] === v)) return `+${v}${/^r/.test(ks[0]) ? " %" : ""} ${ks.length === 5 && /^r/.test(ks[0]) ? "de résistance dans chaque élément" : ks.length === 5 ? "de dommages dans chaque élément" : ks.map((k) => D.STATS[k].name).join(", ")}`;
    return ks.map((k) => `+${Df.stats[k]}${k === "cri" ? " %" : ""} ${D.STATS[k].name.replace("% ", "")}`).join(", "); };
  E.dofusOwned = (S, id) => Object.values(S.items || {}).some((it) => it.tpl === "dofus_" + id);
  E.dofusCount = (S) => E.DOFUS_ORDER.filter((id) => E.dofusOwned(S, id)).length;
  E.dofusWornBy = (S, id) => S.chars.find((c) => Object.values(c.equip).some((u) => S.items[u] && S.items[u].tpl === "dofus_" + id)) || null;
  E.giveDofus = (S, id, why) => {
    const Df = E.DOFUS[id]; if (!Df) return null;
    const first = !E.dofusOwned(S, id);
    const it = E.rollItem(S, Df.tpl, { radiant: false });
    S.cnt = S.cnt || {}; S.cnt.dofus = E.dofusCount(S); S.cnt.dofusAll = (S.cnt.dofusAll || 0) + 1;
    E.note(S, `${first ? "Nouveau Dofus" : "Copie de Dofus"} : ${Df.name} (${why || "obtenu"}) — ${E.dofusBonusTxt(id)}.`, "rare");
    if (E.celebrate) E.celebrate({ t: "dofus", id, first });
    E.emit(S, "dofus", { id, first });
    return it;
  };
  /* butin du boss (fin de donjon) : le Dofus de ce donjon, ou l'Ocre sur les grands boss */
  E.dofusDrop = (S, did, k, out) => {
    E.DOFUS_ORDER.forEach((id) => { const Df = E.DOFUS[id];
      const ok = Df.dg ? Df.dg === did && k >= E.DOFUS_DROP_STASIS && rnd() < E.DOFUS_DROP : DUNGEONS[did].lvl >= 160 && k >= 8 && rnd() < E.OCRE_DROP;
      if (ok) { E.giveDofus(S, id, "butin du boss"); if (out) out.push(Df.name); } });
  };
  E.dofusOfDungeon = (did) => E.DOFUS_ORDER.find((id) => E.DOFUS[id].dg === did) || null;
  /* Dokoko en combat : soin au début du tour du porteur */
  E.dofusTurn = (S, F, e) => {
    if (e.side !== "c" || e.summon || !e.alive) return;
    const c = S.chars.find((x) => x.id === e.cid); if (!c) return;
    if (!Object.values(c.equip).some((u) => S.items[u] && S.items[u].tpl === "dofus_dokoko")) return;
    const v = Math.round(e.hpMax * E.DOKOKO_PCT / 100); if (v > 0 && e.hp < e.hpMax) E.doHeal(e, v, F);
  };

  /* ---------- quêtes des Dofus ---------- */
  const dq = (S, id) => { S.dofusQ = S.dofusQ || {}; return (S.dofusQ[id] = S.dofusQ[id] || { step: 0, prog: 0, done: 0 }); };
  E.dofusQuest = (S, id) => dq(S, id);
  E.dofusStep = (S, id) => { const Q = dq(S, id); return Q.done ? null : E.DOFUS[id].steps[Q.step] || null; };
  const perfects = (S) => Object.values(S.items || {}).filter((it) => E.isPerfect && E.isPerfect(it)).length;
  const dgDone = (S, did, k) => E.stasisInfo(S, did).max >= k;
  /* avancement d'une étape : [fait, à faire] */
  E.dofusStepProgress = (S, id, i) => {
    const Q = dq(S, id); const st = E.DOFUS[id].steps[i]; if (!st) return [0, 1];
    if (Q.done || i < Q.step) return [st.n || (st.dgs ? st.dgs.length : 1), st.n || (st.dgs ? st.dgs.length : 1)];
    const cur = i === Q.step;
    switch (st.t) {
      case "dg": return st.chal || st.nodown ? [cur ? Math.min(Q.prog, 1) : 0, 1] : [dgDone(S, st.dg, st.k) ? 1 : 0, 1];
      case "dgs": return [st.dgs.filter((d) => dgDone(S, d, st.k)).length, st.dgs.length];
      case "soul": return [Math.min(E.soulCount(S, st.zone), st.n), st.n];
      case "perfect": return [Math.min(perfects(S), st.n), st.n];
      case "ocre": return [E.ocreTier(S), E.OCRE_TIERS.length];
      default: return [cur ? Math.min(Q.prog, st.n) : 0, st.n]; // kill, harvest, chal, almanax : comptés pendant l'étape
    }
  };
  E.dofusStepTxt = (st) => {
    const dn = (d) => (DUNGEONS[d] ? MONSTERS[DUNGEONS[d].boss].name : d);
    switch (st.t) {
      case "dg": return `Vaincre ${dn(st.dg)} en stasis ${st.k}${st.chal ? ` avec le challenge ${E.CHALLENGES[st.chal].name} réussi` : ""}${st.nodown ? " sans héros à terre" : ""}`;
      case "dgs": return `Vaincre ${st.dgs.map(dn).join(", ")} en stasis ${st.k}`;
      case "kill": return `Vaincre ${st.n} monstres dans la zone ${E.zoneName(st.zone)}`;
      case "harvest": return `Récolter ${st.n} × ${st.res}`;
      case "chal": return `Gagner ${st.n} combats avec le challenge ${E.CHALLENGES[st.chal].name} réussi`;
      case "soul": return `Capturer ${st.n} âme${st.n > 1 ? "s" : ""} d'archimonstres de la zone ${E.zoneName(st.zone)}`;
      case "almanax": return `Faire ${st.n} offrandes à l'Almanax`;
      case "perfect": return `Posséder ${st.n > 1 ? st.n + " objets Parfaits" : "un objet Parfait"} (toutes les caractéristiques au jet maximum)`;
      case "ocre": return "Éternelle moisson : capturer l'âme des 205 archimonstres, palier par palier";
    }
    return "";
  };
  const zoneOf = (sub) => (sub && SUBS[sub] ? SUBS[sub].zone : null);
  const advance = (S) => {
    E.DOFUS_ORDER.forEach((id) => {
      const Df = E.DOFUS[id]; const Q = dq(S, id); let guard = 0;
      while (!Q.done && guard++ < 8) {
        const st = Df.steps[Q.step]; if (!st) { Q.done = E.now(); E.giveDofus(S, id, "quête terminée"); break; }
        if (st.t === "ocre") break; // l'Ocre est donné par le dernier palier
        const [a, b] = E.dofusStepProgress(S, id, Q.step); if (a < b) break;
        Q.step++; Q.prog = 0;
        if (Q.step < Df.steps.length) E.note(S, `${Df.name} : étape ${Q.step} sur ${Df.steps.length} accomplie.`, "up");
      }
    });
  };
  const onEvent = (S, type, data) => {
    if (type === "win" || type === "harvest" || type === "almanax" || type === "dungeon") E.DOFUS_ORDER.forEach((id) => {
      const Q = dq(S, id); const st = E.dofusStep(S, id); if (!st) return;
      if (type === "win" && st.t === "kill" && zoneOf(data.sub) === st.zone) Q.prog += data.mons.length;
      if (type === "win" && st.t === "chal" && (data.chals || []).includes(st.chal)) Q.prog++;
      if (type === "harvest" && st.t === "harvest" && data.res === st.res) Q.prog += data.n || 1;
      if (type === "almanax" && st.t === "almanax") Q.prog++;
      if (type === "dungeon" && st.t === "dg" && (st.chal || st.nodown) && data.id === st.dg && data.stasis >= st.k && (!st.chal || (data.chals || []).includes(st.chal)) && (!st.nodown || !data.down)) Q.prog++;
    });
    if (type === "soul") checkOcre(S);
    advance(S);
  };
  const prevEmit = E.emit; let depth = 0;
  E.emit = (S, type, data) => {
    if (prevEmit) prevEmit(S, type, data);
    if (!S || !S.cnt || depth > 2) return;
    depth++; try { onEvent(S, type, data); } finally { depth--; }
  };
  E.refreshArchis = (S) => { if (!S.cnt) return; checkOcre(S); advance(S); };
})(typeof window !== "undefined" ? window : global);
