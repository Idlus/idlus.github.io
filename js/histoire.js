/* ============================================================================
   HISTOIRE — la quête principale racontée en scènes (Classique · Saison 1 seulement). Pas de DOM ici (voir histoireui.js).
   Décisions de Mathis (maquette « Refaire les quêtes », 02/11) : 2A des scènes avec un personnage qui parle, 2 à 4 objectifs
   et une récompense ; 7A images de DOFUS (portraits ChatGPT de Mathis, sinon le monstre) ; 9B tout réécrit avant l'ouverture,
   chapitre par chapitre, validé par Mathis. 03/11 : des boosters en récompense (Mathis « Ajoute des booster aussi »).
   Règles :
   - mêmes objectifs que la quête principale de l'Éternel (E.MAIN_QUEST, 93 étapes) et MÊMES récompenses par objectif
     (E.questGive : kamas, XP, clés, coffres, meubles), pour ne pas toucher à l'équilibrage ;
   - les objectifs d'une scène avancent tous en même temps ; un objectif fini paie tout de suite (les clés arrivent à temps) ;
   - S.quest.step = nombre d'objectifs terminés : le Sablier (6), « Héros d'Amakna » (22), la course et les succès de
     chapitre gardent leurs seuils, car les scènes d'un chapitre couvrent exactement les étapes de ce chapitre ;
   - en plus : 2 boosters par scène, 3 de plus par chapitre fini (dans la réserve de 30 de js/cartes.js).
   État : S.hist = { sc: scène en cours, d: [objectifs finis de la scène], p: {objectif: compteur}, vu: dernière scène lue }.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const Q = E.MAIN_QUEST;
  if (!Q) return;
  const { DUNGEONS, MONSTERS } = D;

  /* ---------------- personnages ---------------- */
  // img : portrait ChatGPT de Mathis (assets/s1/npc-N.webp) ; mon : monstre de DOFUS montré en attendant un portrait
  E.HIST_NPC = {
    ganymede: { n: "Ganymède", img: "assets/s1/npc-1.webp", r: "gardien d'Incarnam" },
    ataman: { n: "Ataman l'Archiviste", r: "archiviste d'Astrub" },
    gisele: { n: "Fermière Gisèle", r: "fermière d'Astrub" },
    pretresse: { n: "Prêtresse de l'Almanax", r: "servante des Mérydes" },
    bolet: { n: "Maître Bolet", r: "paysan d'Amakna" },
    heraut: { n: "Héraut des deux cités", r: "messager de Bonta et Brâkmar" },
    cawotte: { n: "Capitaine Cawotte", img: "assets/s1/npc-2.webp", r: "garde des plaines de Cania" },
    wabbit: { n: "Wabbit Repenti", img: "assets/s1/npc-3.webp", r: "ancien sujet du Wa Wabbit" },
  };

  /* ---------------- scènes ----------------
     g : index des étapes de E.MAIN_QUEST (un objectif = une étape) ; txt d'un objectif : celui de l'étape.
     in : ce que dit le personnage en ouvrant la scène ; out : sa réplique à la fin. 200 caractères au plus par réplique. */
  const SC = [
    /* ---- Chapitre 1 · L'éveil (niv. 1-50) : écrit, à valider par Mathis ---- */
    { ch: 0, t: "Le réveil", npc: "ganymede", g: [0, 1, 2],
      in: ["Ah, te voilà enfin réveillé ! Je suis Ganymède, gardien d'Incarnam. Les âmes qui arrivent ici ont tout à apprendre, et toi aussi.",
        "La Route des âmes grouille de petites bêtes. Chasse-les, prends quelques niveaux et mets-toi quelque chose sur le dos. On ne part pas à l'aventure en pyjama."],
      out: "Pas mal du tout ! Tu tiens ton arme dans le bon sens, c'est déjà mieux que la moitié des aventuriers que j'ai vus passer." },
    { ch: 0, t: "Les racines d'Incarnam", npc: "ganymede", g: [3, 4],
      in: ["Un aventurier ne vit pas que de combats. La forêt d'Incarnam regorge de bois, de plantes et de minerais.",
        "Envoie un de tes héros récolter pendant que les autres chassent. Les ressources d'aujourd'hui feront tes armes de demain."],
      out: "Tes sacs commencent à peser. Garde tout : un jour, ce Bois de Frêne deviendra un bâton ou une hache." },
    { ch: 0, t: "La Crypte de Kardorim", npc: "ganymede", g: [5],
      in: ["Une rumeur court au Cimetière : Kardorim s'est relevé dans sa crypte. Ce vieux squelette ne supporte pas qu'on trouble son repos.",
        "Trouve sa clé au Cimetière d'Incarnam, descends dans la crypte et rends-lui la paix. Ensuite, Astrub t'attend."],
      out: "Kardorim est retombé en poussière. Le temps file vite, en bas : tu peux maintenant l'accélérer avec le Sablier. Bonne route !" },
    { ch: 0, t: "Bienvenue à Astrub", npc: "ataman", g: [6, 7, 8],
      in: ["Bienvenue à Astrub, la cité des nouveaux venus ! Je suis Ataman, et j'archive tout ce qui passe ici, aventuriers compris.",
        "Chasse un peu dans la cité, fabrique ton premier objet et installe-toi dans ton Havre-Sac. Tout héros a besoin d'un chez-soi."],
      out: "Te voilà inscrit dans mes registres comme aventurier, logé et artisan. C'est un bon début de légende." },
    { ch: 0, t: "Le Tournesol Affamé", npc: "gisele", g: [9, 10],
      in: ["Au secours ! Un Tournesol Affamé s'est installé dans ma grange. Il mange tout : le blé, les poules, et presque mon mari.",
        "Il est coriace, prends d'abord quelques niveaux. La clé de la grange, tu l'as déjà : Ganymède te l'a donnée après la crypte."],
      out: "Ma grange est sauvée ! Garde son trophée, et prends cette clé : elle ouvre la cour du Bouftou Royal, à Amakna." },
    { ch: 0, t: "Prières et primes", npc: "pretresse", g: [11, 12],
      in: ["Chaque jour, un Méryde veille sur le Monde des Douze. Fais-lui une offrande à l'Almanax, il saura te le rendre.",
        "Et pour des kamas gagnés honnêtement, le tableau des avis de recherche a toujours des primes. Remplis-en trois."],
      out: "Le Méryde a l'air content, et ta bourse aussi. Voilà ce que j'appelle une journée bien remplie." },
    { ch: 0, t: "Le Bouftou Royal", npc: "bolet", g: [13, 14],
      in: ["Les champs d'Amakna sont envahis de Bouftous, et leur roi mène la danse depuis sa cour. Il faut lui couper la laine sous le pied !",
        "Ta clé ouvre sa cour. Ensuite, fais le ménage dans la forêt d'Amakna : ses bêtes n'attendent que toi."],
      out: "Le Bouftou Royal a perdu sa couronne et la forêt respire. Le roi Allister lui-même entendra parler de toi." },
    { ch: 0, t: "Bonta ou Brâkmar", npc: "heraut", g: [15, 16],
      in: ["Deux cités se disputent le monde : Bonta la lumineuse et Brâkmar la ténébreuse. Au niveau 30, il te faudra choisir ton camp.",
        "En attendant, va voir la forgemagie et brise un objet en runes. Un bon guerrier sait aussi améliorer son équipement."],
      out: "Ton choix est fait et tes premières runes brillent. Bonta comme Brâkmar ont besoin d'aventuriers comme toi." },
    { ch: 0, t: "Les Scarafeuilles", npc: "cawotte", g: [17, 18],
      in: ["Capitaine Cawotte, au rapport ! Le Scarabosse Doré et ses Scarafeuilles bloquent la route de Cania. Il faut les écraser.",
        "Ensuite, rejoins-moi dans les plaines : les Porkass piétinent tout. Mes gardes et moi, on ne suffit plus."],
      out: "Les plaines de Cania sont calmes, ou presque. Prends cette clé : le Donjon des Bworks est le prochain sur ta route." },
    { ch: 0, t: "Le Clos des Blops", npc: "cawotte", g: [19, 20, 21],
      in: ["La Bworkette commande les Bworks depuis son donjon, et plus loin, le Blop Coco Royal règne sur le Clos des Blops.",
        "Ce sont les deux plus gros dangers de Cania. Atteins le niveau 50 et va les voir. Après eux, tout Amakna saura ton nom."],
      out: "Tu l'as fait ! Incarnam, Astrub, Amakna et Cania te doivent beaucoup. À partir d'aujourd'hui, tu es un Héros d'Amakna." },
  ];
  /* Chapitres 2 à 5 : en attendant leur texte, une scène par boss (les étapes jusqu'au boss compris), sans dialogue. */
  const CH = E.QUEST_CHAPTERS || [{ start: 0, end: Q.length }];
  const written = new Set(SC.map((x) => x.ch));
  CH.forEach((C, k) => {
    if (written.has(k)) return;
    let g = [];
    for (let i = C.start; i < C.end; i++) {
      g.push(i);
      const q = Q[i]; const last = i === C.end - 1;
      if ((q.t === "boss" && g.length >= 2) || g.length >= 4 || last) {
        const b = g.map((j) => Q[j]).reverse().find((x) => x.t === "boss");
        SC.push({ ch: k, t: (b || q).title, npc: null, mon: b && DUNGEONS[b.dg] ? DUNGEONS[b.dg].boss : null, g, in: [], out: "" });
        g = [];
      }
    }
  });
  SC.sort((a, b) => a.ch - b.ch || Math.min(...a.g) - Math.min(...b.g));
  SC.forEach((x, n) => { x.n = n; x.last = !SC[n + 1] || SC[n + 1].ch !== x.ch; });
  E.HIST_SC = SC;
  const SCN = {}; SC.forEach((x) => x.g.forEach((i) => (SCN[i] = x.n))); // étape → scène
  E.HIST_BOOST = 2; // boosters par scène (Mathis 03/11 « un peu plus »)
  E.HIST_BOOST_CH = 3; // boosters en plus à la fin d'un chapitre

  /* ---------------- état ---------------- */
  E.histOn = (S) => !!(E.isS1c && E.isS1c(S));
  const H = (S) => { if (!S.hist) S.hist = { sc: 0, d: [], p: {}, vu: -1 }; return S.hist; };
  E.hist = H;
  E.histScene = (S) => SC[H(S).sc] || null;
  E.histDone = (S) => H(S).sc >= SC.length;
  const topLvl = (S) => Math.max(1, ...S.chars.filter((c) => !c.merc).map((c) => c.lvl || 1));
  const stepsBefore = (n) => SC.slice(0, n).reduce((a, x) => a + x.g.length, 0);
  const syncStep = (S) => { const T = H(S); S.quest = S.quest || { step: 0, prog: 0 }; S.quest.step = Math.min(Q.length, stepsBefore(T.sc) + T.d.length); };

  /* progression d'un objectif : [a, b] */
  E.histGoalProg = (S, i) => {
    const q = Q[i]; const T = H(S); const n0 = q.n || 1;
    if (SCN[i] < T.sc || (SCN[i] === T.sc && T.d.includes(i))) return [n0, n0]; // scène passée ou objectif fini
    const p = SCN[i] === T.sc ? T.p[i] || 0 : 0; // une scène à venir ne compte pas encore
    switch (q.t) {
      case "kill": case "harvest": case "craft": case "fm": case "brk": case "bounty": return [Math.min(p, q.n), q.n];
      case "almanax": return [Math.min(Math.max(p, E.almanax && E.almanax(S).done ? 1 : 0), q.n), q.n];
      case "lvl": return [Math.min(topLvl(S), q.n), q.n];
      case "equip": return [Math.min(Math.max(0, ...S.chars.map((c) => Object.keys(c.equip || {}).length)), q.n), q.n];
      case "havre": return [Math.min(E.havreTotal ? E.havreTotal(S) : 0, q.n), q.n];
      case "boss": return [S.progress && S.progress.bossKills[q.dg] ? 1 : 0, 1];
      case "align": return [S.align ? 1 : 0, 1];
    }
    return [0, 1];
  };
  E.histGoalDone = (S, i) => { const [a, b] = E.histGoalProg(S, i); return a >= b; };
  // l'objectif mis en avant (bande d'objectifs, accueil) : le premier pas encore fini de la scène
  E.histFocus = (S) => { const sc = E.histScene(S); if (!sc) return null; const T = H(S); return sc.g.find((i) => !T.d.includes(i)) ?? null; };

  /* ---------------- avancer ---------------- */
  let busy = false;
  E.histCheck = (S) => {
    if (!E.histOn(S) || busy) return; busy = true;
    try {
      const T = H(S); let guard = 0;
      while (guard++ < 12) {
        const sc = E.histScene(S); if (!sc) break;
        let moved = false;
        for (const i of sc.g) {
          if (T.d.includes(i) || !E.histGoalDone(S, i)) continue;
          T.d.push(i); delete T.p[i]; syncStep(S); // l'objectif est compté avant de payer (une montée de niveau relance la vérification)
          const r = E.questGive ? E.questGive(S, i) : { kamas: 0, ex: "" };
          E.note(S, `Objectif atteint · ${Q[i].title} (+${r.kamas.toLocaleString("fr-FR")} kamas${r.ex ? ", " + r.ex : ""})`, "rare");
          moved = true;
        }
        if (sc.g.every((i) => T.d.includes(i))) {
          T.sc++; T.d = []; T.p = {}; syncStep(S);
          const nb = E.boosterGive ? E.boosterGive(S, E.HIST_BOOST + (sc.last ? E.HIST_BOOST_CH : 0)) : 0;
          const who = sc.npc ? E.HIST_NPC[sc.npc].n : "";
          E.note(S, `Scène terminée : ${sc.t}${who && sc.out ? ` · ${who} : « ${sc.out} »` : ""}${nb ? ` (+${nb} booster${nb > 1 ? "s" : ""})` : ""}`, "rare");
          if (sc.last) {
            const C = CH[sc.ch];
            if (sc.ch === 0) E.note(S, "Chapitre 1 achevé : vous êtes un Héros d'Amakna !", "rare");
            else if (C) E.note(S, `Chapitre ${sc.ch + 1} achevé : ${C.name} !`, "rare");
            if (T.sc >= SC.length) E.note(S, "Quête principale achevée : vous êtes un Héros du Krosmoz !", "rare");
          }
          E.emit(S, "hscene", { n: sc.n, ch: sc.ch });
          moved = true;
        }
        if (!moved) break;
      }
    } finally { busy = false; }
  };
  E.histSeen = (S) => { const T = H(S); T.vu = T.sc; };
  E.histNew = (S) => E.histOn(S) && !E.histDone(S) && H(S).vu < H(S).sc;

  /* compteurs : seulement pour les objectifs de la scène en cours */
  const count = (S, t, data) => {
    const sc = E.histScene(S); if (!sc) return; const T = H(S);
    sc.g.forEach((i) => {
      if (T.d.includes(i)) return; const q = Q[i];
      if (t === "win" && q.t === "kill" && data.sub === q.sub) T.p[i] = (T.p[i] || 0) + (data.mons || []).length;
      else if (t === "harvest" && q.t === "harvest") T.p[i] = (T.p[i] || 0) + (data.n || 0);
      else if (t === q.t && ["craft", "fm", "brk", "bounty", "almanax"].includes(t)) T.p[i] = (T.p[i] || 0) + 1;
    });
  };
  const emit0 = E.emit;
  E.emit = function (S, t, d) {
    const r = emit0.apply(this, arguments);
    if (S && S.s1c && !S.mono && E.histOn(S) && t !== "hscene") try { count(S, t, d || {}); E.histCheck(S); } catch (e) {}
    return r;
  };

  /* ---------------- ce que voit le reste du jeu ---------------- */
  // bande d'objectifs, accueil, fiche du joueur : l'objectif mis en avant, avec le texte de son étape
  const step0 = E.questStep, prog0 = E.questProgress;
  E.questStep = function (S) {
    if (!E.histOn(S)) return step0.apply(this, arguments);
    const i = E.histFocus(S); return i == null ? null : Q[i];
  };
  E.questProgress = function (S) {
    if (!E.histOn(S)) return prog0.apply(this, arguments);
    const i = E.histFocus(S); return i == null ? null : E.histGoalProg(S, i);
  };
  const des0 = E.deserialize;
  E.deserialize = function () { const S = des0.apply(this, arguments); try { if (S && E.histOn(S)) { H(S); syncStep(S); } } catch (e) {} return S; };

  /* ---------------- personnage d'une scène ---------------- */
  E.histWho = (sc) => {
    if (sc.npc && E.HIST_NPC[sc.npc]) return E.HIST_NPC[sc.npc];
    const m = sc.mon && MONSTERS[sc.mon]; return { n: m ? m.name : "", mon: sc.mon, r: "" };
  };
})(typeof window !== "undefined" ? window : globalThis);
