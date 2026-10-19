/* ============================================================================
   LES PASSIFS DES DOFUS — Idlus (1.0.16)
   Chacun des 31 Dofus a un passif unique, en plus de ses caractéristiques (choix de Mathis : 1A 2A 3A 4A 5A,
   puis 1B 2A 3A sur la maquette 2).
   - Les 6 Dofus portés donnent chacun leur passif ; un même Dofus porté deux fois ne compte qu'une fois.
   - Passif par héros. Les gains d'équipe (kamas de l'Argenté, butin du Dokille) ne comptent qu'une fois par
     équipe ; l'XP du Jyfus ne vaut que pour son porteur. Tous restent dans les plafonds habituels.
   - Kolizéum : moitié de l'effet (sauf les effets « tout ou rien » : Vulbis, Argenté Scintillant, Ocre).
   - Éveil des Dragons : un héros qui porte les 6 Dofus primordiaux (Émeraude, Pourpre, Turquoise, Ocre, Ivoire,
     Ébène) a leurs passifs renforcés de 25 %.
   - En combat : ligne dorée dans le journal pour les passifs marquants (une fois par tour et par héros) et
     compteur par héros (F.dpN) montré sous le héros. Aucune étiquette sur l'arène (choix 1B).
   - Aucun passif ne touche aux chances d'obtenir un Dofus.
   Les points d'appel sont dans engine.js (comme les légendaires) et systems.js (gains). Pas de DOM ici :
   l'affichage est dans ui.js et questui.js. Chargé aussi par les tests, le simulateur et le serveur.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  if (!E.DOFUS && typeof require !== "undefined") require("./archis.js");
  const rnd = () => E.rnd();
  const pc = (v) => String(Math.round(v * 10) / 10).replace(".", ",");

  E.DOFP_PVP = 0.5;  // Kolizéum : part de l'effet
  E.DOFP_RESO = 25;  // Éveil des Dragons : % de renfort des passifs
  E.DOFP_PRIM = ["emeraude", "pourpre", "turquoise", "ocre", "ivoire", "ebene"]; // les 6 Dofus primordiaux
  E.DOFP_FAMS = ["Attaque", "Défense", "Soin", "Contrôle", "Gains"];
  E.DOFP_TRIG = { every: "Tous les 4 tours", hit: "À chaque coup", crit: "Coup critique", hurt: "Quand il est touché", turn: "Début de son tour",
    kill: "Ennemi vaincu", once: "Une fois par combat", ally: "Allié à terre", always: "Toujours actif", first: "Premier tour", heal: "Quand il soigne", gain: "Hors combat" };
  E.DOFP_FOR = { front: "Première ligne", heal: "Soigneurs", sum: "Invocateurs", dps: "Attaquants", all: "Tous les héros" };
  /* [nom du passif, texte(valeur), valeur, famille, déclencheur, idéal pour] */
  E.DOFP_LIST = {
    dofawa:    ["Premier envol", (v) => `+${pc(v)} % de dégâts et de soins au premier tour de chaque combat.`, 10, "Attaque", "first", "all"],
    jyfus:     ["J'y étais !", (v) => `+${pc(v)} % d'XP pour le porteur (dans le plafond).`, 5, "Gains", "gain", "all"],
    argent:    ["Reflet d'argent", (v) => `+${pc(v)} % de kamas pour l'équipe (dans le plafond, une seule fois par équipe).`, 5, "Gains", "gain", "all"],
    cacao:     ["Gourmandise", (v) => `Chaque ennemi vaincu par le porteur lui rend ${pc(v)} % de ses PV.`, 5, "Soin", "kill", "dps"],
    cawotte:   ["Terrier", (v) => `La première fois qu'il passe sous 50 % de PV, le porteur se met à l'abri : bouclier de ${pc(v)} % de ses PV.`, 15, "Défense", "once", "front"],
    dokoko:    ["Sève de Moon", (v) => `Au début de son tour, le porteur récupère ${pc(v)} % de ses PV.`, 3, "Soin", "turn", "front"],
    dokille:   ["Os à ronger", (v) => `+${pc(v)} % de butin pour l'équipe (dans le plafond, une seule fois par équipe).`, 5, "Gains", "gain", "all"],
    kaliptus:  ["Feuilles apaisantes", (v) => `Les soins reçus par le porteur sont augmentés de ${pc(v)} %, et du double sous 30 % de PV.`, 15, "Soin", "always", "front"],
    emeraude:  ["Souffle d'Aerafal", (v) => `Au début du combat puis tous les 4 tours, le vent d'Aerafal donne au porteur un bouclier de ${pc(v)} % de ses PV.`, 8, "Défense", "every", "front"],
    dolmanax:  ["Chaos des éléments", (v) => `Les coups du porteur ignorent ${pc(v)} % des résistances de la cible.`, 20, "Attaque", "hit", "dps"],
    veilleurs: ["Sentinelle", (v) => `Le premier coup reçu à chaque tour de jeu est réduit de ${pc(v)} %.`, 15, "Défense", "hurt", "front"],
    pourpre:   ["Brasier d'Ignemikhal", (v) => `Chaque coup critique du porteur embrase les autres ennemis : ${pc(v)} % des dégâts du coup à chacun.`, 10, "Attaque", "crit", "dps"],
    dotruche:  ["Plume protectrice", (v) => `${pc(v)} % des soins lancés par le porteur deviennent aussi un bouclier (jusqu'à 30 % des PV).`, 25, "Soin", "heal", "heal"],
    domakuro:  ["Encre noire", (v) => `Les invocations du porteur font +${pc(v)} % de dégâts.`, 25, "Attaque", "always", "sum"],
    dorigami:  ["Pli de papier", (v) => `${pc(v)} % de chance d'éviter complètement une attaque.`, 10, "Défense", "hurt", "front"],
    turquoise: ["Source d'Aguabrial", (v) => `Le premier coup critique du porteur à chaque tour soigne l'allié le plus blessé de ${pc(v)} % de ses PV.`, 3, "Soin", "crit", "dps"],
    ocre:      ["Prison d'ambre", () => `Le premier ennemi touché par le porteur à chaque combat est figé dans l'ambre et passe son tour (un boss joue seulement en dernier).`, 1, "Contrôle", "once", "dps"],
    dofoozbz:  ["Colère du Bworker", (v) => `Chaque allié à terre donne au porteur +${pc(v)} % de dégâts jusqu'à la fin du combat.`, 25, "Attaque", "ally", "dps"],
    vulbis:    ["Éclat de Vulbis", () => `+1 PA au premier tour de chaque combat.`, 1, "Attaque", "first", "all"],
    ivoire:    ["Carapace d'ivoire", (v) => `Un seul coup ne peut pas retirer plus de ${pc(v)} % des PV du porteur.`, 40, "Défense", "hurt", "front"],
    ebene:     ["Marque d'ébène", (v) => `L'ennemi frappé par le porteur est marqué : toute l'équipe lui fait +${pc(v)} % de dégâts jusqu'au tour suivant (une marque à la fois).`, 6, "Contrôle", "hit", "dps"],
    glaces:    ["Cœur de glace", (v) => `Quand le porteur est touché, ${pc(v)} % de chance de geler l'attaquant : il perd 1 PM et joue en dernier au tour suivant.`, 35, "Contrôle", "hurt", "front"],
    sylvestre: ["Sève sylvestre", (v) => `Au début du tour du porteur, l'allié le plus blessé récupère ${pc(v)} % de ses PV.`, 3, "Soin", "turn", "heal"],
    argente:   ["Lueur d'Ilyzaelle", () => `Une fois par combat et par équipe (même avec plusieurs porteurs), quand un allié tombe à 0 PV, la lueur le garde debout avec 1 PV.`, 1, "Défense", "ally", "all"],
    cauchemar: ["Terreur nocturne", (v) => `Les ennemis touchés par le porteur infligent ${pc(v)} % de dégâts en moins jusqu'à leur prochain tour.`, 5, "Contrôle", "hit", "dps"],
    verdoyant: ["Floraison", (v) => `Chaque allié soigné par le porteur fleurit : son prochain coup fait +${pc(v)} % de dégâts.`, 10, "Soin", "heal", "heal"],
    tachete:   ["Écailles tachetées", (v) => `Chaque coup reçu durcit ses écailles : −2 % de dégâts subis jusqu'à la fin du combat (jusqu'à −${pc(v)} %).`, 10, "Défense", "hurt", "front"],
    nebuleux:  ["Voile nébuleux", (v) => `Tant qu'il a plus de 80 % de ses PV, le porteur subit ${pc(v)} % de dégâts en moins.`, 15, "Défense", "always", "front"],
    forgelave: ["Fonte des armures", (v) => `Chaque coup du porteur fait fondre la cible : −2 % de résistances pour toute l'équipe, jusqu'à −${pc(v)} %.`, 10, "Contrôle", "hit", "all"],
    abyssal:   ["Appel des abysses", (v) => `+1 % de dégâts par tranche de 4 % de PV perdus par le porteur (jusqu'à +${pc(v)} %).`, 25, "Attaque", "always", "front"],
    dompin:    ["Pluie de pommes de pin", (v) => `Au début de son tour, le porteur lance une pomme de pin sur un ennemi au hasard : ${pc(v)} % de ses PV (moitié sur les boss).`, 3, "Attaque", "turn", "all"],
    /* 1.1 : les 4 Dofus de la 1.1 (simulés en stasis 8 : chacun dans la moyenne des 31 autres) */
    alliances: ["Bannière levée", (v) => `Tant que le porteur est debout, toute l'équipe fait +${pc(v)} % de dégâts et de soins (une seule bannière par équipe).`, 3, "Attaque", "always", "all"],
    trool:     ["Roue du Trool", (v) => `Au début de chaque combat, la roue tire un bonus au hasard pour le porteur : +${pc(v)} % de dégâts, +${pc(v)} % de soins, un bouclier de ${pc(v)} % de ses PV ou +1 PM au premier tour.`, 12, "Attaque", "first", "all"],
    onirique:  ["Berceuse", (v) => `Tous les 4 tours, l'ennemi le plus dangereux s'assoupit : il joue en dernier au tour suivant et fait ${pc(v)} % de dégâts en moins jusque-là (une berceuse par équipe).`, 20, "Contrôle", "every", "all"],
    idlus:     ["Temps suspendu", (v) => `Pendant que tu es hors ligne, +${pc(v)} % d'XP, de kamas et de butin pour l'équipe (dans le plafond, une seule fois par équipe).`, 10, "Gains", "gain", "all"],
  };
  const FIXED = ["vulbis", "argente", "ocre"]; // effets « tout ou rien » : ni renforcés, ni réduits au Kolizéum
  /* passifs qui agissent à chaque coup ou en continu : comptés, mais sans ligne dans le journal (il reste lisible) */
  const QUIET = ["alliances", "ebene", "cauchemar", "forgelave", "veilleurs", "nebuleux", "kaliptus", "dotruche", "verdoyant", "tachete", "dokoko"];
  /* r : rang de Potentiel du Dofus (1.0.30, 0 à X) : +5 % par rang ; l'Ivoire (un plafond) descend de 2,5 % par rang */
  E.dofpVal = (id, boost, pvp, r) => { const P = E.DOFP_LIST[id]; if (!P) return 0; let v = P[2]; if (FIXED.includes(id)) return v;
    const m = r > 0 ? Math.min(r, E.DPOT_MAX) * E.DPOT_PCT / 100 : 0;
    if (id === "ivoire") return Math.round((pvp ? 70 : boost ? 35 : v) * (1 - m / 2) * 10) / 10; // un plafond : plus bas = plus fort
    if (boost) v *= 1 + E.DOFP_RESO / 100; if (pvp) v *= E.DOFP_PVP; return Math.round(v * (1 + m) * 10) / 10; };
  E.dofpName = (id) => (E.DOFP_LIST[id] || [])[0] || "";
  E.dofpTxt = (id, boost, pvp, r) => { const P = E.DOFP_LIST[id]; return P ? P[1](E.dofpVal(id, boost, pvp, r)) : ""; };
  E.dofpFam = (id) => (E.DOFP_LIST[id] || [])[3] || "";
  E.dofpTrig = (id) => E.DOFP_TRIG[(E.DOFP_LIST[id] || [])[4]] || "";
  E.dofpForKey = (id) => (E.DOFP_LIST[id] || [])[5] || "all";
  E.dofpFor = (id) => E.DOFP_FOR[E.dofpForKey(id)] || "";
  E.dofpOnce = (id) => id === "argent" || id === "dokille";
  /* rôle d'un héros, pour « Idéal pour » et l'ordre du choix du Dofus */
  E.dofpRole = (S, c) => { if (c.cls === "eni") return "heal"; if (["osa", "sadi", "steam"].includes(c.cls)) return "sum";
    try { if (c.inTeam && E.frontSet(S).has(c.id)) return "front"; } catch (e) { /* hors équipe */ }
    return E.TANK_CLASSES && E.TANK_CLASSES.includes(c.cls) ? "front" : "dps"; };
  E.dofpFits = (S, c, id) => { const k = E.dofpForKey(id), r = E.dofpRole(S, c); return k === "all" || k === r || (k === "dps" && r !== "heal"); }; // un héros de première ligne ou un invocateur attaque aussi

  /* passifs portés par un héros (dans l'ordre des emplacements, sans doublon) */
  E.dofpOf = (S, c) => { const out = [];
    D.DOFUS_SLOTS.forEach((sl) => { const it = c && c.equip && S.items[c.equip[sl]]; const id = it && D.ITEMS[it.tpl] && D.ITEMS[it.tpl].dofus; if (id && E.DOFP_LIST[id] && !out.includes(id)) out.push(id); });
    return out; };
  E.dofpReso = (S, c) => { const w = E.dofpOf(S, c); return E.DOFP_PRIM.every((id) => w.includes(id)); };
  /* gains hors combat : XP du porteur (Jyfus), kamas et butin pour l'équipe, une seule fois (Argenté, Dokille) */
  const wears = (S, c, id) => E.dofpOf(S, c).includes(id);
  /* 1.1 : Temps suspendu (Dofus d'Idlus) : +XP, kamas et butin pendant le rattrapage hors ligne, une fois par équipe */
  const idlusOff = (S) => (E.dpOffline && E.team(S).some((c) => wears(S, c, "idlus")) ? E.dofpVal("idlus", false, false, E.dpotRank(S, "idlus")) : 0);
  E.dofpTeamBonus = (S, kind) => { if (!S || !S.chars || !E.team) return 0; const id = kind === "kamas" ? "argent" : kind === "drop" ? "dokille" : null;
    return (id && E.team(S).some((c) => wears(S, c, id)) ? E.dofpVal(id, false, false, E.dpotRank(S, id)) : 0) + (id ? idlusOff(S) : 0); };
  E.dofpXpBonus = (S, c) => { const b = E.bonusRaw(S, "xp") + (c && wears(S, c, "jyfus") ? E.dofpVal("jyfus", false, false, E.dpotRank(S, "jyfus")) : 0) + (S && S.chars && E.team ? idlusOff(S) : 0); return Math.min(b, E.capOf(S, "xp")); };
  { const cu = E.catchUpGen; if (cu) E.catchUpGen = function* (S, seconds) { E.dpOffline = true; try { return yield* cu(S, seconds); } finally { E.dpOffline = false; } }; }

  const has = (e, id) => !!(e && e.dp && e.dp.includes(id));
  const V = (F, id, e) => E.dofpVal(id, !!(e && e.dpBoost), !!(F && F.pvp), e && e.dpP ? e.dpP[id] || 0 : 0);
  const A = () => E.fightApi;
  /* un passif s'est déclenché : compteur du héros, et une ligne dorée par tour au plus pour les passifs marquants */
  const proc = (F, e, id, what) => {
    if (!F || !e) return; const N = F.dpN || (F.dpN = {}); const k = e.cid != null ? e.cid : e.name; (N[k] = N[k] || {})[id] = (N[k][id] || 0) + 1;
    if (QUIET.includes(id)) return;
    const seen = F.dpSeen || (F.dpSeen = {}); const key = k + ":" + id; if (seen[key] === F.round) return; seen[key] = F.round;
    A().flog(F, `✦ ${E.dofpName(id)} · ${e.name}${what ? " : " + what : ""}`, "buff dofpl");
  };

  /* 1.1 : Bannière levée : un porteur debout dans l'équipe (une seule bannière compte) */
  const banner = (F, e) => { if (!F || !F.ents || !e || e.side === "m") return 1;
    const w = F.ents.find((m) => m.alive && m.side === e.side && !m.summon && has(m, "alliances")); return w ? 1 + V(F, "alliances", w) / 100 : 1; };
  E.dofpFight = (S, F) => {
    F.dpN = {}; F.dpSeen = {};
    F.ents.forEach((e) => { if (!e.dp || e.summon) return; e.dpS = {};
      e.dpP = E.dpotMap(S, e.dp); e.dpSub = e.dp.some((id) => E.dpotSub(S, id)); // 1.0.30 : Potentiel, aura dorée des Dofus Sublimés
      if (has(e, "emeraude")) { e.shield = (e.shield || 0) + Math.round(e.hpMax * V(F, "emeraude", e) / 100); proc(F, e, "emeraude", "bouclier"); }
      if (has(e, "vulbis")) e.paBonus = (e.paBonus || 0) + 1;
      if (has(e, "argente")) e.dpS.save = 1;
      if (has(e, "cawotte")) e.dpS.burrow = 1;
      if (has(e, "trool")) { const r = Math.floor(rnd() * 4); e.dpS.troll = r; const v = V(F, "trool", e); // 1.1 : Roue du Trool
        if (r === 2) e.shield = (e.shield || 0) + Math.round(e.hpMax * v / 100); if (r === 3) { e.st.pm = (e.st.pm || 0) + 1; e.dpS.trPm = 1; }
        proc(F, e, "trool", ["+" + pc(v) + " % de dégâts", "+" + pc(v) + " % de soins", "bouclier", "+1 PM"][r]); } });
  };
  E.dofpDmg = (F, e, tgt, crit, v) => {
    const S0 = e.dpS || (e.dpS = {}); S0.crit = crit;
    if (e.dpBloom) { v *= 1 + e.dpBloom / 100; e.dpBloom = 0; }
    v *= banner(F, e); // 1.1 : Bannière levée, pour toute l'équipe du porteur
    if (!e.dp.length) return v;
    if (has(e, "trool") && S0.troll === 0) v *= 1 + V(F, "trool", e) / 100;
    if (has(e, "dofawa") && F && F.round === 1) v *= 1 + V(F, "dofawa", e) / 100;
    if (has(e, "dofoozbz") && S0.rage) v *= 1 + S0.rage * V(F, "dofoozbz", e) / 100;
    if (has(e, "abyssal") && e.hp < e.hpMax) v *= 1 + Math.min(V(F, "abyssal", e), Math.floor((1 - e.hp / e.hpMax) * 25)) / 100;
    return v;
  };
  /* résistances de la cible : Fonte des armures (pour toute l'équipe du fondeur) et Chaos des éléments */
  E.dofpRes = (src, tgt, res) => {
    if (tgt && tgt.dpMelt && tgt.dpMeltS === src.side) res -= tgt.dpMelt;
    if (res > 0 && !src.summon && has(src, "dolmanax")) res *= 1 - E.dofpVal("dolmanax", src.dpBoost, !!src.koli, src.dpP ? src.dpP.dolmanax || 0 : 0) / 100;
    return res;
  };
  E.dofpSummon = (F, own) => (has(own, "domakuro") ? 1 + V(F, "domakuro", own) / 100 : 1);
  /* avant les dégâts : marque, peur, puis les défenses du héros touché ; 0 = attaque évitée */
  E.dofpPre = (F, src, tgt, v) => {
    if (!src || src.side === tgt.side) return v;
    if (src.dpWeak && src.dpWeak.r >= F.round) v *= 1 - src.dpWeak.v / 100;
    if (tgt.dpMark && tgt.dpMark.r >= F.round && tgt.dpMark.s === src.side) v *= 1 + tgt.dpMark.v / 100;
    if (!tgt.dp || !tgt.dp.length) return v; const T = tgt.dpS || (tgt.dpS = {});
    if (has(tgt, "dorigami") && rnd() * 100 < V(F, "dorigami", tgt)) { proc(F, tgt, "dorigami", "attaque évitée"); return 0; }
    if (has(tgt, "veilleurs") && T.sent !== F.round) { T.sent = F.round; v *= 1 - V(F, "veilleurs", tgt) / 100; proc(F, tgt, "veilleurs"); }
    if (has(tgt, "nebuleux") && tgt.hp > tgt.hpMax * 0.8) { v *= 1 - V(F, "nebuleux", tgt) / 100; proc(F, tgt, "nebuleux"); }
    if (has(tgt, "tachete") && T.sc) v *= 1 - Math.min(V(F, "tachete", tgt), 2 * T.sc) / 100;
    if (has(tgt, "ivoire")) { const cap = tgt.hpMax * V(F, "ivoire", tgt) / 100; if (v > cap) { v = cap; proc(F, tgt, "ivoire", "coup plafonné"); } }
    return v;
  };
  /* Lueur d'Ilyzaelle : un porteur debout (ou le héros lui-même) le garde en vie à 1 PV, une fois par combat */
  E.dofpSave = (F, tgt) => {
    if (!tgt.dp || tgt.summon) return;
    const tm = tgt.tm !== undefined ? tgt.tm : tgt.side; F.dpArg = F.dpArg || {}; if (F.dpArg[tm]) return; // grand équilibrage : une seule lueur par équipe et par combat
    const w = F.ents.find((m) => m.side === tgt.side && !m.summon && (m.alive || m === tgt) && m.dpS && m.dpS.save && has(m, "argente")); if (!w) return;
    w.dpS.save = 0; F.dpArg[tm] = 1; tgt.hp = 1;
    F.fx.push({ seq: F.seq, k: "phase", t: F.ents.indexOf(tgt) }); proc(F, w, "argente", `${tgt.name} reste debout`);
  };
  /* après un coup du porteur */
  E.dofpHit = (F, src, tgt, v, el) => {
    if (!src.dp || !src.dp.length || src.side === tgt.side || F.dpEcho) return; const S0 = src.dpS || (src.dpS = {});
    if (!tgt.alive) { if (has(src, "cacao") && src.alive) { A().doHeal(src, src.hpMax * V(F, "cacao", src) / 100, F); proc(F, src, "cacao"); } return; }
    if (S0.crit && has(src, "turquoise") && S0.tqR !== F.round) { S0.tqR = F.round;
      const low = F.ents.filter((m) => m.alive && m.side === src.side && !m.summon && m.hp < m.hpMax).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (low) { A().doHeal(low, low.hpMax * V(F, "turquoise", src) / 100, F); proc(F, src, "turquoise", low.name); } }
    if (S0.crit && has(src, "pourpre")) { const o = F.ents.filter((m) => m.alive && m.side === tgt.side && m !== tgt && !m.fake);
      if (o.length) { F.dpEcho = true; o.forEach((m) => { A().dealDamage(F, src, m, v * V(F, "pourpre", src) / 100, el || "f"); if (!m.alive) A().flog(F, `${m.name} est vaincu.`, "ko"); }); F.dpEcho = false;
        proc(F, src, "pourpre", `${o.length} ennemi${o.length > 1 ? "s" : ""} embrasé${o.length > 1 ? "s" : ""}`); } }
    if (has(src, "ocre") && !S0.amber && tgt.alive) { S0.amber = 1;
      if (tgt.boss) { tgt.slowR = F.round + 1; proc(F, src, "ocre", `${tgt.name} joue en dernier`); } else { tgt.lgStun = 1; tgt.stun = 1; proc(F, src, "ocre", `${tgt.name} est figé`); } }
    if (has(src, "ebene")) { if (S0.markT && S0.markT !== tgt) delete S0.markT.dpMark; S0.markT = tgt; tgt.dpMark = { v: V(F, "ebene", src), r: F.round + 1, s: src.side }; proc(F, src, "ebene"); }
    if (has(src, "cauchemar")) { tgt.dpWeak = { v: V(F, "cauchemar", src), r: F.round + 1 }; proc(F, src, "cauchemar"); }
    if (has(src, "forgelave")) { const cap = V(F, "forgelave", src); if ((tgt.dpMelt || 0) < cap) { tgt.dpMelt = Math.min(cap, (tgt.dpMelt || 0) + 2 * (F.pvp ? E.DOFP_PVP : 1)); tgt.dpMeltS = src.side; proc(F, src, "forgelave"); } }
  };
  /* après un coup reçu par le porteur */
  E.dofpHurt = (F, src, tgt, v) => {
    if (!tgt.dp || !tgt.dp.length || !src || src.side === tgt.side || v <= 0) return; const T = tgt.dpS || (tgt.dpS = {});
    if (has(tgt, "tachete") && 2 * (T.sc || 0) < V(F, "tachete", tgt)) { T.sc = (T.sc || 0) + 1; proc(F, tgt, "tachete"); }
    if (has(tgt, "glaces") && src.alive && T.gelR !== F.round && src.slowR !== F.round + 1 && rnd() * 100 < V(F, "glaces", tgt)) { T.gelR = F.round; src.slowR = F.round + 1; proc(F, tgt, "glaces", `${src.name} est gelé`); }
    if (T.burrow && tgt.alive && tgt.hp < tgt.hpMax * 0.5) { T.burrow = 0; tgt.shield = (tgt.shield || 0) + Math.round(tgt.hpMax * V(F, "cawotte", tgt) / 100); proc(F, tgt, "cawotte", "bouclier"); }
  };
  /* un héros tombe : la Colère du Bworker monte chez ses alliés */
  E.dofpDeath = (F, tgt) => {
    if (!tgt.dp || tgt.summon) return;
    F.ents.forEach((m) => { if (m.alive && m.side === tgt.side && m !== tgt && has(m, "dofoozbz")) { m.dpS.rage = (m.dpS.rage || 0) + 1; proc(F, m, "dofoozbz", `+${pc(m.dpS.rage * V(F, "dofoozbz", m))} % de dégâts`); } });
  };
  /* soins : reçus (Kaliptus), lancés (Dofawa au premier tour), et leurs effets (Dotruche, Verdoyant) */
  E.dofpHealIn = (F, t) => (has(t, "kaliptus") ? 1 + V(F, "kaliptus", t) * (t.hp < t.hpMax * 0.3 ? 2 : 1) / 100 : 1);
  E.dofpHealOut = (F, a) => (a && has(a, "dofawa") && F && F.round === 1 ? 1 + V(F, "dofawa", a) / 100 : 1) * banner(F, a) * (a && has(a, "trool") && a.dpS && a.dpS.troll === 1 ? 1 + V(F, "trool", a) / 100 : 1);
  E.dofpHealed = (F, a, t, g) => {
    if (!a || g <= 0 || a.summon) return;
    if (has(a, "dotruche")) { t.shield = Math.min(Math.round(t.hpMax * 0.3), (t.shield || 0) + Math.round(g * V(F, "dotruche", a) / 100)); proc(F, a, "dotruche"); }
    if (has(a, "verdoyant") && t !== a && t.dp) { t.dpBloom = Math.max(t.dpBloom || 0, V(F, "verdoyant", a)); proc(F, a, "verdoyant"); }
    if (has(t, "kaliptus")) proc(F, t, "kaliptus");
  };
  /* début du tour du porteur (remplace l'ancien soin du Dokoko d'archis.js, devenu son passif) */
  E.dofpTurn = (S, F, e) => {
    if (!e.dp || !e.dp.length || !e.alive || e.summon) return; const S0 = e.dpS || (e.dpS = {});
    if (S0.trPm && F.round > 1) { S0.trPm = 0; e.st.pm = Math.max(0, (e.st.pm || 0) - 1); } // 1.1 : le PM de la Roue du Trool ne vaut qu'au premier tour
    if (has(e, "onirique") && F.round % 4 === 0) { const B = F.dpOni || (F.dpOni = {}); // 1.1 : Berceuse, une par équipe et par tour
      if (B[e.side] !== F.round) { const o = F.ents.filter((m) => m.alive && m.side !== e.side && !m.fake && !m.summon).sort((a, b) => (b.boss ? 1e9 : 0) + b.hpMax - (a.boss ? 1e9 : 0) - a.hpMax)[0];
        if (o) { B[e.side] = F.round; o.slowR = F.round + 1; o.dpWeak = { v: V(F, "onirique", e), r: F.round + 1 }; proc(F, e, "onirique", `${o.name} s'assoupit`); } } }
    if (has(e, "dokoko") && e.hp < e.hpMax) { A().doHeal(e, e.hpMax * V(F, "dokoko", e) / 100, F); proc(F, e, "dokoko"); }
    if (has(e, "sylvestre")) { const low = F.ents.filter((m) => m.alive && m.side === e.side && !m.summon && m.hp < m.hpMax).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (low) { A().doHeal(low, low.hpMax * V(F, "sylvestre", e) / 100, F); proc(F, e, "sylvestre", low.name); } }
    if (has(e, "emeraude") && F.round > 1 && (F.round - 1) % 4 === 0 && S0.emR !== F.round) { S0.emR = F.round; e.shield = (e.shield || 0) + Math.round(e.hpMax * V(F, "emeraude", e) / 100); proc(F, e, "emeraude", "bouclier"); }
    if (has(e, "dompin")) { const o = F.ents.filter((m) => m.alive && m.side !== e.side && !m.fake); const t = o[Math.floor(rnd() * o.length)];
      if (t) { F.dpEcho = true; const d = A().dealDamage(F, e, t, E.hpRef(t) * V(F, "dompin", e) / 100 * (t.boss ? 0.5 : 1), "t"); F.dpEcho = false; proc(F, e, "dompin", `${t.name} −${d}`); if (!t.alive) A().flog(F, `${t.name} est vaincu.`, "ko"); } }
  };
  E.dofusTurn = (S, F, e) => E.dofpTurn(S, F, e);
  /* le Dokoko n'a pas de caractéristiques : sa ligne de bonus renvoie à son passif */
  const bonusTxt = E.dofusBonusTxt; E.dofusBonusTxt = (id) => (id === "dokoko" ? "Pas de caractéristiques : tout est dans son passif." : bonusTxt(id));

  /* ============================================================================
     1.0.30 « POTENTIEL DES DOFUS » (choix 42A, beaucoup plus lent)
     Chaque Dofus du compte a un Potentiel de 0 à X (état S.dofPot[id] = { r: rang, e: éclat en réserve }).
     - Éclat : chaque donjon terminé donne E.DPOT_ECL (4) éclats par niveau de stasis à chaque Dofus porté dans l'équipe
       (un même Dofus porté par deux héros ne compte qu'une fois).
     - Rang n : E.dpotNeed(n) éclats (2 000 pour le rang I … 8 000 pour le rang X, 50 000 en tout) et n² × 2 M kamas (770 M en tout).
     - Une copie du même Dofus (dans le sac : ni portée, ni dans une tenue, ni verrouillée) donne d'un coup l'éclat d'un rang.
     - +5 % par rang aux caractéristiques et au passif. PA, PM, Portée et Invocations ne montent pas,
       ni les passifs « tout ou rien » (Vulbis, Argenté Scintillant, Ocre).
     - Rang X : Dofus Sublimé (+50 %), aura dorée en combat, annonce à tout le serveur (résumé « dsub », supabase/collections.sql).
     Rythme visé (jeu régulier en stasis 7 : 20 donjons par jour, environ 1 h 45 de donjon) : 560 éclats par jour,
     rang V vers 30 jours, rang X vers 89 jours ; stasis 10 : 40 éclats par donjon. Aucune chance d'obtenir un Dofus ne change.
     ========================================================================== */
  E.DPOT_MAX = 10; E.DPOT_PCT = 5; E.DPOT_ECL = 4; E.DPOT_KAMAS = 2000000;
  E.DPOT_FIX = ["pa", "pm", "po", "inv"]; // ne montent pas
  E.dpotNeed = (n) => (n >= 1 && n <= E.DPOT_MAX ? Math.round((n + 2) * 20 / 3) * 100 : 0); // éclat pour passer du rang n−1 au rang n
  E.dpotCost = (n) => (n >= 1 && n <= E.DPOT_MAX ? n * n * E.DPOT_KAMAS : 0);
  E.dpotNeedAll = (n) => { let t = 0; for (let i = 1; i <= n; i++) t += E.dpotNeed(i); return t; };
  E.dpot = (S, id) => (S && S.dofPot && S.dofPot[id]) || { r: 0, e: 0 };
  const potW = (S, id) => { if (!S.dofPot || typeof S.dofPot !== "object") S.dofPot = {}; const P = S.dofPot[id] || (S.dofPot[id] = { r: 0, e: 0 }); P.r = Math.max(0, Math.min(E.DPOT_MAX, P.r | 0)); P.e = Math.max(0, +P.e || 0); return P; };
  E.dpotRank = (S, id) => Math.max(0, Math.min(E.DPOT_MAX, E.dpot(S, id).r | 0));
  E.dpotSub = (S, id) => E.dpotRank(S, id) >= E.DPOT_MAX;
  E.dpotPct = (r) => Math.max(0, Math.min(E.DPOT_MAX, r | 0)) * E.DPOT_PCT;
  E.dpotSublimes = (S) => (E.DOFUS_ORDER || []).filter((id) => E.dpotSub(S, id) && E.dofusOwned(S, id));
  /* rangs des Dofus portés, pour les passifs en combat ({ id: rang } ou null) */
  E.dpotMap = (S, ids) => { let o = null; (ids || []).forEach((id) => { const r = E.dpotRank(S, id); if (r) (o = o || {})[id] = r; }); return o; };
  /* caractéristiques en plus d'un Dofus au rang r (sur ses caractéristiques de base) */
  E.dpotStatsOf = (id, r) => { const Df = E.DOFUS && E.DOFUS[id]; const out = {}; if (!Df || !r) return out; const T = D.ITEMS[Df.tpl];
    for (const k in (T && T.stats) || {}) { if (E.DPOT_FIX.includes(k)) continue; const v = T.stats[k][1]; const add = Math.round(v * E.dpotPct(r) / 100); if (add) out[k] = add; }
    return out; };
  /* point d'appel de E.charStats (engine.js) : les Dofus portés par le héros */
  E.dofPotStats = (S, c) => { let out = null;
    D.DOFUS_SLOTS.forEach((sl) => { const it = c && c.equip && S.items[c.equip[sl]]; const id = it && D.ITEMS[it.tpl] && D.ITEMS[it.tpl].dofus; if (!id) return;
      const x = E.dpotStatsOf(id, E.dpotRank(S, id)); for (const k in x) { out = out || {}; out[k] = (out[k] || 0) + x[k]; } });
    return out; };
  /* une copie qu'on peut fondre dans le Potentiel : dans le sac, ni portée, ni dans une tenue, ni verrouillée, et il en reste une autre */
  E.dpotCopies = (S, id) => Object.values(S.items || {}).filter((it) => it.tpl === "dofus_" + id && !E.equippedBy(S, it.uid) && !(E.inGear && E.inGear(S, it.uid)) && !it.locked);
  E.dpotCanCopy = (S, id) => E.dpotRank(S, id) < E.DPOT_MAX && E.dofusOwned(S, id) && Object.values(S.items || {}).filter((it) => it.tpl === "dofus_" + id).length >= 2 && E.dpotCopies(S, id).length > 0;
  /* état d'un Dofus pour l'écran : rang, éclat, prochain rang, ce qui manque */
  E.dpotInfo = (S, id) => { const r = E.dpotRank(S, id); const e = Math.floor(E.dpot(S, id).e || 0); const n = r + 1; const max = r >= E.DPOT_MAX;
    const need = max ? 0 : E.dpotNeed(n), cost = max ? 0 : E.dpotCost(n);
    return { r, e, max, next: max ? null : n, need, cost, pct: max ? 100 : Math.min(100, Math.floor(e / need * 100)), ready: !max && e >= need && S.kamas >= cost, eclOk: !max && e >= need, kamasOk: S.kamas >= cost, copies: E.dpotCopies(S, id).length, canCopy: E.dpotCanCopy(S, id) }; };

  /* actions du joueur */
  E.dofPotUp = (S, id) => {
    if (!E.DOFUS || !E.DOFUS[id]) return "Dofus inconnu.";
    if (!E.dofusOwned(S, id)) return "Il faut posséder ce Dofus.";
    const P = potW(S, id); if (P.r >= E.DPOT_MAX) return "Ce Dofus est déjà Sublimé.";
    const n = P.r + 1, need = E.dpotNeed(n), cost = E.dpotCost(n);
    if (P.e < need) return `Il manque ${Math.ceil(need - P.e).toLocaleString("fr-FR")} éclats.`;
    if (S.kamas < cost) return `Il faut ${cost.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= cost; P.e -= need; P.r = n;
    const Df = E.DOFUS[id];
    if (n >= E.DPOT_MAX) {
      P.sub = E.now(); E.note(S, `${Df.name} est Sublimé : Potentiel X, +50 % aux caractéristiques et au passif, aura dorée en combat !`, "rare");
      if (E.celebrate) E.celebrate({ t: "dsub", id });
    } else { E.note(S, `${Df.name} : Potentiel ${E.roman ? E.roman(n) : n} (+${E.dpotPct(n)} %).`, "up"); if (E.celebrate) E.celebrate({ t: "dpot", id, r: n }); }
    E.emit(S, "dpot", { id, r: n });
    return null;
  };
  E.dofPotCopy = (S, id, uid) => {
    if (!E.DOFUS || !E.DOFUS[id]) return "Dofus inconnu.";
    if (E.dpotRank(S, id) >= E.DPOT_MAX) return "Ce Dofus est déjà Sublimé.";
    if (!E.dpotCanCopy(S, id)) return "Il faut une autre copie de ce Dofus dans le sac (ni portée, ni dans une tenue, ni verrouillée).";
    const L = E.dpotCopies(S, id); const it = (uid != null && L.find((x) => x.uid === uid || String(x.uid) === String(uid))) || L[0];
    const P = potW(S, id); const add = E.dpotNeed(P.r + 1);
    delete S.items[it.uid]; P.e += add; P.cp = (P.cp || 0) + 1;
    E.note(S, `${E.DOFUS[id].name} : une copie fondue dans le Potentiel, +${add.toLocaleString("fr-FR")} éclats.`, "up");
    return null;
  };
  Object.assign(E.ACTIONS, { dofPotUp: "monter le Potentiel d'un Dofus", dofPotCopy: "fondre une copie de Dofus dans son Potentiel" });
  /* éclat : chaque donjon terminé, pour chaque Dofus porté dans l'équipe (une fois par Dofus) */
  E.dpotGain = (S, stasis) => {
    const k = Math.max(1, Math.min(10, stasis | 0)); const add = E.DPOT_ECL * k; const seen = new Set();
    E.team(S).forEach((c) => D.DOFUS_SLOTS.forEach((sl) => { const it = c.equip && S.items[c.equip[sl]]; const id = it && D.ITEMS[it.tpl] && D.ITEMS[it.tpl].dofus; if (id && E.DOFUS[id]) seen.add(id); }));
    const got = [];
    seen.forEach((id) => { if (E.dpotRank(S, id) >= E.DPOT_MAX) return; const P = potW(S, id); const need = E.dpotNeed(P.r + 1); const was = P.e; P.e += add; got.push(id);
      if (was < need && P.e >= need) E.note(S, `${E.DOFUS[id].name} : assez d'éclat pour le Potentiel ${E.roman ? E.roman(P.r + 1) : P.r + 1} (Héros › Dofus › Potentiel).`, "up"); });
    return got;
  };
  const prevEmit = E.emit; let depth = 0;
  E.emit = (S, type, data) => {
    if (prevEmit) prevEmit(S, type, data);
    if (type !== "dungeon" || !S || !S.chars || !data || depth > 0) return;
    depth++; try { E.dpotGain(S, data.stasis); } finally { depth--; }
  };
  /* Kolizéum : la photo de l'équipe garde les rangs de Potentiel des Dofus portés (les caractéristiques y sont déjà, par E.charStats) */
  if (E.koliSnap && !E.koliSnap.dpot) {
    const snap0 = E.koliSnap; E.koliSnap = (S, ids) => { const out = snap0(S, ids);
      out.forEach((x) => { const m = x.dp ? E.dpotMap(S, x.dp) : null; if (m) x.dpP = m; if (x.dp && x.dp.some((id) => E.dpotSub(S, id))) x.dpX = 1; });
      return out; }; E.koliSnap.dpot = 1;
    const setup0 = E.koliSetup; E.koliSetup = (A, B, opts) => { const S2 = setup0(A, B, opts); const F = S2 && S2.fight; if (!F) return S2;
      [A, B].forEach((T, tm) => { const ents = F.ents.filter((e) => e.tm === tm); (T || []).forEach((hh, i) => { const e = ents[i]; if (!e || !hh) return;
        if (hh.dpP && typeof hh.dpP === "object") { const m = {}; for (const id in hh.dpP) if (E.DOFP_LIST[id]) m[id] = Math.max(0, Math.min(E.DPOT_MAX, hh.dpP[id] | 0)); e.dpP = m; }
        if (hh.dpX) e.dpSub = true; }); });
      return S2; };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
