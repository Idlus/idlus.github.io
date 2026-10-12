/* 0.1.17 : lot Bienvenue — logique pure (pas de DOM), l'affichage est dans ui.js.
   1. Bulles de découverte : 19 explications montrées une fois, la première fois qu'un système apparaît (E.TIPS, E.tipDue).
      Les bulles vues sont gardées dans la partie (S.tips), donc elles suivent le compte en ligne.
   2. Recherche rapide : un index de tout le jeu (pages, zones, donjons, objets, ressources, monstres, panoplies, idoles,
      familiers, montures, Dofus, consommables, succès), sans accents ni majuscules, avec une tolérance d'une faute (E.search).
   3. Réglages d'affichage : tailles de texte proposées (E.TEXT_SIZES). */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const { ITEMS, MONSTERS, DUNGEONS, ZONES, RES, SETS, CONSUMABLES, SLOTS } = D;

  /* ---------------- 1. Bulles de découverte ----------------
     cond : la découverte est faite (la bulle peut se montrer) · dofus : sautée quand le joueur connaît DOFUS
     anchor : bouton à entourer d'or si visible (sinon la bulle flotte en bas) · hint : quand elle viendra (carnet) */
  const maxLvl = (S) => Math.max(...S.chars.map((c) => c.lvl || 1));
  const qstep = (S) => (S.quest ? S.quest.step : 0);
  E.TIPS = [
    { id: "combat", name: "Le combat automatique", hint: "premier combat", anchor: '.navfight, #subnav [data-tab="combat"]',
      cond: (S) => S.stats.fights >= 1 || S.hunting,
      txt: "Tes héros jouent seuls : ils choisissent leurs sorts et leurs cibles. Tu règles tout ça dans Héros › Sorts, ou tu passes en mode manuel sur la page Combat pour jouer toi-même chaque tour." },
    { id: "equip", name: "Équiper un objet", hint: "premier objet ramassé", anchor: '[data-fam="team"]',
      cond: (S) => Object.keys(S.items).length >= 1,
      txt: "Ton premier objet est dans le sac. Équipe › Héros pour l'équiper toi-même, ou « Tout équiper au mieux » sur la page Équipe : le jeu choisit le meilleur pour chaque héros." },
    { id: "stats", name: "Les caractéristiques", hint: "niveau 2", dofus: true, anchor: '[data-act="herotab"][data-v="stats"]',
      cond: (S) => maxLvl(S) >= 2,
      txt: "À chaque niveau, un héros gagne 5 points. La Force fait taper les sorts de Terre, l'Intelligence ceux de Feu, la Vitalité donne des PV. Tu peux aussi laisser le jeu répartir tout seul (Héros › Caractéristiques)." },
    { id: "harvest", name: "La récolte", hint: "quête « Mettre la main à la pâte »", anchor: '[data-fam="craft"]',
      cond: (S) => qstep(S) >= 4,
      txt: "Un héros envoyé récolter ne combat plus, mais remplit tes ressources, même hors ligne. Métiers › Récolte : choisis un métier, puis ce qu'il ramasse." },
    { id: "protector", name: "Les protecteurs", hint: "premier protecteur", anchor: '[data-act="protgo"]',
      cond: (S) => !!(S.protector && S.protector.until > E.now()),
      txt: "Un gardien de ressource est apparu pendant la récolte. Seule l'équipe qui chasse peut l'affronter : clique sur « Combattre », les héros qui récoltent reviennent le temps du combat puis reprennent leur travail. Victoire : cette ressource ×2 pendant 20 min." },
    { id: "keys", name: "Clés et stasis", hint: "première clé fabricable", anchor: '[data-fam="adv"]',
      cond: (S) => qstep(S) >= 5,
      txt: "Une clé = une entrée dans le donjon ; elle se fabrique avec les ressources de la zone. La stasis règle la difficulté et le butin, de 1 à 10 : commence à 1, monte quand ça passe sans mal." },
    { id: "offline", name: "Le résumé d'absence", hint: "premier retour après une absence",
      cond: (S) => !!(S.tips && S.tips.ev && S.tips.ev.offline),
      txt: "Pendant ton absence, l'équipe a continué à chasser (8 h de base, plus avec le Havre-Sac). Le résumé dit ce qu'elle a gagné ; le journal, sur l'Accueil, garde la trace." },
    { id: "loss", name: "Une défaite", hint: "première défaite", anchor: '[data-act="losssheet"]',
      cond: (S) => (S.losses || []).length >= 1,
      txt: "Une défaite n'enlève rien : l'équipe se relève et recommence. Le rapport dit qui est tombé et pourquoi. Change de zone, d'équipement ou de sorts plutôt que d'insister." },
    { id: "havre", name: "Le Havre-Sac", hint: "quête « Le Havre-Sac »", anchor: '[data-home="havre"]',
      cond: (S) => qstep(S) >= 8,
      txt: "Ton Havre-Sac est une maison qui s'améliore avec des kamas : expérience, butin, récolte, place dans le sac… Ses meubles donnent leurs bonus à toute l'équipe (Accueil › Havre-Sac)." },
    { id: "almanax", name: "L'Almanax", hint: "quête « Dévotion »", dofus: true, anchor: '[data-tab="quests"]',
      cond: (S) => qstep(S) >= 11,
      txt: "Chaque jour, l'Almanax demande une offrande (quelques ressources) et donne un bonus jusqu'à minuit. Quêtes › Almanax." },
    { id: "pets", name: "Les familiers", hint: "niveau 10", dofus: true, anchor: '[data-act="herotab"][data-v="pet"]',
      cond: (S) => maxLvl(S) >= (E.PET_LVL || 10),
      txt: "Dès le niveau 10, un héros peut adopter un familier. Il mange tes ressources et grandit, puis donne un bonus. Chaque sous-zone cache le sien (Héros › Familier)." },
    { id: "stars", name: "Les étoiles de zone", hint: "après une heure de jeu", anchor: '[data-tab="world"]',
      cond: (S) => (S.stats.playtime || 0) >= 3600 && qstep(S) >= 3,
      txt: "Une zone gagne une étoile toutes les 2 h sans chasse, jusqu'à 5 : +10 % d'XP et de butin par étoile. Elles fondent quand tu y chasses : change de zone pour en profiter." },
    { id: "align", name: "L'alignement", hint: "niveau 30", dofus: true, anchor: '[data-tab="quests"]',
      cond: (S) => maxLvl(S) >= 30,
      txt: "Au niveau 30, choisis Bonta ou Brâkmar dans Quêtes › Alignement : des quêtes, des grades et des ailes qui grandissent avec toi." },
    { id: "fm", name: "La forgemagie", hint: "quête « Forgemage débutant »", dofus: true, anchor: '[data-tab="forge"]',
      cond: (S) => qstep(S) >= 16 || (S.fmJob && S.fmJob.lvl >= 2),
      txt: "La forgemagie monte le jet d'un objet avec des runes (Artisanat › Forgemagie). Un essai peut échouer, mais le puits garde la mémoire des échecs pour protéger les suivants." },
    { id: "mounts", name: "Les montures", hint: "niveau 60", dofus: true, anchor: '[data-act="herotab"][data-v="pet"]',
      cond: (S) => maxLvl(S) >= (E.MOUNT_LVL || 60),
      txt: "À partir du niveau 60, capture une monture avec un filet dans les Plaines de Cania. Elle grandit avec l'XP de son héros et lui donne des bonus (Héros › Familier)." },
    { id: "archis", name: "Les archimonstres", hint: "premier archimonstre croisé", dofus: true, anchor: '[data-act="archis"]',
      cond: (S) => Object.keys(S.archis || {}).length >= 1,
      txt: "Tu as croisé un archimonstre ! Avec une pierre d'âme dans le sac, son âme rejoint ton album. L'album complet mène au Dofus Ocre." },
    { id: "idols", name: "Les idoles", hint: "Bricoleur niveau 20", anchor: '[data-act="idols"]',
      cond: (S) => (S.crafts.bricoleur && S.crafts.bricoleur.lvl >= 20) || (E.idolCount && E.idolCount(S) >= 1),
      txt: "Une idole rend les combats plus durs contre plus d'XP et de butin. Elle se fabrique une fois chez le Bricoleur, puis reste à toi. Jusqu'à 6 actives, une par famille." },
    { id: "account", name: "Le compte en ligne", hint: "après une heure de jeu sans compte", anchor: '[data-act="options"]',
      cond: (S, ctx) => !!(ctx && ctx.online && !ctx.user) && (S.stats.playtime || 0) >= 3600,
      txt: "Un compte garde ta partie en ligne : tu la retrouves sur un autre ordinateur ou sur ton téléphone. Il te fait aussi entrer dans les classements et écrire dans le chat. Ta partie actuelle te suit. Options › Compte, connexion avec Discord ou par e-mail." },
    { id: "ren", name: "La Renaissance", hint: "premier héros niveau 200", anchor: '[data-tab="ren"]',
      cond: (S) => maxLvl(S) >= (E.MAX_LVL || 200),
      txt: "Un héros au niveau 200 peut renaître : il repart du niveau 1 avec +30 % d'XP et un Éveil. Il garde son apparence, ses titres et ses Dofus (Équipe › Renaissance)." },
  ];
  E.TIP_GAP_MS = 2 * 60 * 1000;      // au plus une bulle toutes les 2 minutes
  E.TIP_LATER_MS = 10 * 60 * 1000;   // « Plus tard » : elle revient après 10 minutes
  const tipById = (id) => E.TIPS.find((t) => t.id === id);

  /* État dans la partie. Une partie déjà avancée (mise à jour) considère comme vues les découvertes déjà faites :
     pas de pluie de bulles sur un joueur qui connaît le jeu, mais le carnet les garde. */
  E.tipState = (S, ctx) => {
    if (!S.tips) {
      S.tips = { know: null, off: false, seen: {}, later: {}, last: 0, ev: {} };
      if (S.stats.fights > 0) E.TIPS.forEach((t) => { if (t.cond(S, ctx)) S.tips.seen[t.id] = 1; });
    }
    return S.tips;
  };
  E.tipsStart = (S, know) => { S.tips = { know: !!know, off: false, seen: {}, later: {}, last: 0, ev: {} }; return S.tips; };
  /* Les bulles qui concernent ce joueur (celles propres à DOFUS sont sautées s'il connaît le jeu). */
  E.tipList = (S) => E.TIPS.filter((t) => !(S.tips && S.tips.know && t.dofus));
  /* La prochaine bulle à montrer, ou null. ctx : { online, user, now } */
  E.tipDue = (S, ctx = {}) => {
    const T = E.tipState(S, ctx); if (T.off) return null;
    const now = ctx.now || E.now();
    if (T.last && now - T.last < E.TIP_GAP_MS) return null;
    return E.tipList(S).find((t) => !T.seen[t.id] && !(T.later[t.id] && now - T.later[t.id] < E.TIP_LATER_MS) && t.cond(S, ctx)) || null;
  };
  E.tipSeen = (S, id, now) => { const T = E.tipState(S); T.seen[id] = now || E.now(); delete T.later[id]; T.last = now || E.now(); };
  E.tipLater = (S, id, now) => { const T = E.tipState(S); T.later[id] = now || E.now(); T.last = now || E.now(); };
  E.tipMark = (S, ev) => { const T = E.tipState(S); T.ev = T.ev || {}; T.ev[ev] = 1; };
  E.tipCount = (S) => { const T = E.tipState(S); const L = E.tipList(S); return [L.filter((t) => T.seen[t.id]).length, L.length]; };
  E.tipInfo = (id) => tipById(id);

  /* ---------------- 2. Recherche rapide ---------------- */
  E.searchNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
  /* une faute de frappe tolérée (lettre en trop, en moins, changée ou deux lettres inversées) */
  const near = (a, b) => {
    if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
    let i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) { if (a.slice(i + 1) === b.slice(i + 1)) return true; return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); }
    return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
  };
  const SUBS = () => E.SUBS;
  const zoneName = (zid) => { const z = ZONES.find((x) => x.id === zid); return z ? z.name : ""; };
  const subName = (sid) => { const s = SUBS()[sid]; return s ? `${s.name} (${zoneName(s.zone)})` : ""; };
  let INDEX = null;
  const add = (L, k, id, name, sub, extra) => L.push(Object.assign({ k, id, name, sub: sub || "", n: E.searchNorm(name) }, extra || {}));
  E.SEARCH_KINDS = { page: "Pages", dg: "Donjons", zone: "Zones", item: "Objets", set: "Panoplies", res: "Ressources", mon: "Monstres", dofus: "Dofus", idol: "Idoles", pet: "Familiers", mount: "Montures", cons: "Consommables", ach: "Succès" };
  E.SEARCH_PAGES = [
    ["home", "Accueil", "aperçu de la partie, journal"], ["havre", "Havre-Sac", "maison et améliorations"], ["world", "Monde", "carte des zones de chasse"],
    ["combat", "Combat", "le combat en cours"], ["quests", "Quêtes", "quête principale"], ["dofusq", "Quêtes des Dofus", "Quêtes › Dofus"], ["bounty", "Avis de recherche", "Quêtes › Avis"],
    ["align", "Alignement", "Bonta ou Brâkmar"], ["almanax", "Almanax", "offrande du jour"], ["ach", "Succès", "Quêtes › Succès"], ["ladder", "Classements", "Aventure › Classements"], ["defi", "Défi du jour", "Aventure › Donjons"], ["exp", "Expédition sans fin", "Aventure › Expédition"], ["wardrobe", "Garde-robe", "apparence des héros"], ["card", "Partager mon équipe", "carte d'équipe"],
    ["team", "Équipe", "composition et placement"], ["heroes", "Héros", "équipement du héros"], ["hstats", "Caractéristiques", "Héros › Caractéristiques"], ["spells", "Sorts", "Héros › Sorts"],
    ["pet", "Familier et monture", "Héros › Familier"], ["inv", "Inventaire", "objets"], ["invres", "Ressources", "Inventaire › Ressources"], ["invcons", "Consommables", "Inventaire › Consommables"],
    ["sets", "Carnet de panoplies", "Inventaire › Panoplies"], ["ren", "Renaissance", "Équipe › Renaissance"], ["recolte", "Récolte", "Métiers › Récolte"], ["craft", "Artisanat", "Métiers › Artisanat"],
    ["forge", "Forgemagie", "runes et puits"], ["options", "Options", "thème, affichage, sauvegarde"], ["account", "Compte en ligne", "Options › Compte"], ["archis", "Album des archimonstres", "âmes capturées"],
    ["idols", "Idoles", "difficulté et bonus"], ["tips", "Carnet des découvertes", "relire les bulles d'aide"], ["changelog", "Nouveautés", "notes de mise à jour"],
  ];
  E.searchIndex = () => {
    if (INDEX) return INDEX;
    const L = [];
    E.SEARCH_PAGES.forEach(([id, name, sub]) => add(L, "page", id, name, sub));
    for (const did in DUNGEONS) { const dg = DUNGEONS[did]; const s = SUBS()[E.DUNGEON_SUB[did]]; add(L, "dg", did, dg.name, `niv. ${dg.lvl}${s ? " · " + zoneName(s.zone) : ""}`, { lvl: dg.lvl }); }
    for (const sid in SUBS()) { const s = SUBS()[sid]; if (s.hidden) continue; add(L, "zone", sid, s.name, `${zoneName(s.zone)} · niv. ${s.lvl[0]}–${s.lvl[1]}`, { lvl: s.lvl[0] }); }
    for (const t in ITEMS) { const T = ITEMS[t]; add(L, "item", t, T.name, `${SLOTS[T.slot] || SLOTS[T.slot + "1"] || T.slot} · niv. ${T.lvl}`, { lvl: T.lvl }); }
    for (const sid in SETS) add(L, "set", sid, SETS[sid].name, `${SETS[sid].size} pièces`);
    for (const n in RES) add(L, "res", n, n, `ressource · niv. ${RES[n].lvl}`, { lvl: RES[n].lvl });
    for (const k in MONSTERS) { const m = MONSTERS[k]; if (!m.lvl) continue; add(L, "mon", k, m.name, `${m.boss ? "boss" : "monstre"} · niv. ${m.lvl[0]}–${m.lvl[1]}`, { lvl: m.lvl[0], boss: !!m.boss }); }
    if (E.DOFUS) for (const id in E.DOFUS) add(L, "dofus", id, E.DOFUS[id].name, `Dofus · niv. ${E.DOFUS[id].lvl}`);
    if (E.IDOLS) for (const id in E.IDOLS) add(L, "idol", id, E.IDOLS[id].name, `idole · score ${E.IDOLS[id].score}`);
    if (E.PETS) for (const id in E.PETS) { const P = E.PETS[id]; add(L, "pet", id, P.name, P.sub && SUBS()[P.sub] ? SUBS()[P.sub].name : P.kind === "monti" ? "montilier" : "familier"); }
    if (E.MOUNTS) for (const sp in E.MOUNTS) { const M = E.MOUNTS[sp]; add(L, "mount", sp, M.name, "monture"); for (const c in M.cols) add(L, "mount", sp, `${M.name} ${c}`, "monture"); }
    if (CONSUMABLES) for (const id in CONSUMABLES) add(L, "cons", id, CONSUMABLES[id].name, CONSUMABLES[id].desc || "consommable");
    if (E.ACH) E.ACH.forEach((a) => add(L, "ach", a.id, a.name, a.desc || "succès"));
    return (INDEX = L);
  };
  const KIND_ORDER = Object.keys(E.SEARCH_KINDS);
  /* Résultats pour une saisie. ctx : { S, online } ; un monstre jamais rencontré s'affiche « ??? » (comme dans le bestiaire). */
  E.search = (q, ctx = {}) => {
    const S = ctx.S; const nq = E.searchNorm(q); if (!nq) return [];
    const toks = nq.split(" ").filter(Boolean); const out = [];
    E.searchIndex().forEach((e) => {
      if (e.k === "page" && e.id === "ladder" && !ctx.online) return;
      const words = e.n.split(" ");
      let score = 0;
      for (const t of toks) {
        let s = 0;
        if (e.n.startsWith(t)) s = 4; else if (words.some((w) => w.startsWith(t))) s = 3; else if (e.n.includes(t)) s = 2;
        else if (t.length >= 4 && words.some((w) => near(w, t) || (w.length > t.length + 1 && near(w.slice(0, t.length), t)))) s = 1;
        if (!s) { score = 0; break; } score += s;
      }
      if (!score) return;
      const r = Object.assign({ score }, e);
      if (e.k === "mon" && S && !(S.bestiary && S.bestiary[e.id])) { r.unknown = true; r.name = "???"; r.sub = `${e.boss ? "boss" : "monstre"} jamais rencontré · niv. ${MONSTERS[e.id].lvl[0]}–${MONSTERS[e.id].lvl[1]}`; }
      out.push(r);
    });
    out.sort((a, b) => b.score - a.score || KIND_ORDER.indexOf(a.k) - KIND_ORDER.indexOf(b.k) || (a.lvl || 0) - (b.lvl || 0) || a.name.localeCompare(b.name, "fr"));
    const per = {}; const res = [];
    for (const r of out) { per[r.k] = (per[r.k] || 0) + 1; if (per[r.k] <= 8) res.push(r); if (res.length >= 40) break; }
    res.sort((a, b) => KIND_ORDER.indexOf(a.k) - KIND_ORDER.indexOf(b.k) || b.score - a.score || (a.lvl || 0) - (b.lvl || 0));
    return res;
  };
  E.searchSubName = subName;

  /* ---------------- 3. Affichage ---------------- */
  E.TEXT_SIZES = [90, 100, 115, 130];
})(typeof window !== "undefined" ? window : global);
