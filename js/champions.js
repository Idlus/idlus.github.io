/* ============================================================================
   LA REFONTE DU CHAMPION — Idlus (choix de Mathis : 1D 2B 3A 4A)
   Un combat de chasse sur 50, un monstre devient Champion (PV ×2, dégâts +20 %, un des 6 pouvoirs).
   Chaque Champion vaincu fait trois choses à la fois :
   - Sceau : il fait monter le Sceau de son pouvoir (rangs à 1, 5, 15, 40 et 100 Champions). Chaque héros porte un Sceau.
     Deux Sceaux au rang 5 se fusionnent en un Sceau double au nom unique (les deux pouvoirs à 70 %, 15 fusions).
     Avec un Sceau au rang 5 : Cri du Champion (une fois par combat, sous 30 % de PV, pouvoirs doublés 2 tours, aura dorée).
     4 héros qui portent 4 pouvoirs différents : Conclave des Champions (+3 % de dégâts et de PV pour l'équipe).
     Le premier Sceau au rang 5 donne le titre « Champion <pouvoir> ». Les Sceaux sont gardés à la Renaissance.
   - Trophées de zone (chasse seulement) : les 6 pouvoirs vaincus dans une sous-zone = +5 % d'XP, de kamas et de butin
     dans cette sous-zone, pour toujours.
   - Traque (chasse seulement) : chaque Champion laisse une piste dans sa sous-zone. À 3 pistes, le Champion légendaire
     de la zone (tous les pouvoirs, PV ×12, dégâts ×2) peut être appelé ; le vaincre consomme les pistes et donne le titre
     « Traqueur de <sous-zone> » et 10 Éclats de champion (un Éclat = un Champion de plus au Sceau de son choix).
   Les Champions restent en chasse seulement (3A) : pas de nouveau Champion en donjon (les mutateurs gardent les leurs,
   qui comptent pour les Sceaux ; ceux de l'idole Djim ne comptent pas, 1.2.10.3). Pas de DOM ici : l'affichage est dans js/champui.js.
   Chargé aussi par les tests, le simulateur et le serveur (les Sceaux comptent dans les combats rejoués).
   État : S.ch = { k: Champions vaincus par pouvoir, f: fusions découvertes, z: trophées par sous-zone,
   t: pistes par sous-zone, l: légendaires vaincus par sous-zone, sh: Éclats, pend: sous-zone du légendaire appelé } ;
   c.seal = "enrage" ou "enrage+vampire" (Sceau fusionné).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const pc = (v) => String(Math.round(v * 10) / 10).replace(".", ",");

  E.SEALS = {
    enrage:   { name: "Enragé",     max: 15, txt: (v) => `+${pc(v)} % de dégâts sous 50 % de PV` },
    blinde:   { name: "Blindé",     max: 10, txt: (v) => `Bouclier de ${pc(v)} % de ses PV au début du combat` },
    vampire:  { name: "Vampirique", max: 8,  txt: (v) => `Vole ${pc(v)} % des dégâts qu'il inflige` },
    veloce:   { name: "Véloce",     max: 1,  txt: () => "Joue avant tout le monde au premier tour" },
    meneur:   { name: "Meneur",     max: 5,  txt: (v) => `+${pc(v)} % de dégâts pour toute l'équipe (le meilleur Meneur compte)` },
    traqueur: { name: "Traqueur",   max: 20, txt: (v) => `+${pc(v)} % de dégâts aux monstres sous 50 % de PV` },
  };
  E.SEAL_ORDER = ["enrage", "blinde", "vampire", "veloce", "meneur", "traqueur"];
  E.SEAL_RANKS = [1, 5, 15, 40, 100];
  E.SEAL_FUSE_PCT = 0.7;   // Sceau fusionné : chaque pouvoir à 70 % de son rang 5
  E.SEAL_RESO = 3;         // Conclave des Champions : +3 % de dégâts et de PV
  E.SEAL_CRI_HP = 0.3;     // Cri du Champion : sous 30 % de PV
  E.SEAL_CRI_TURNS = 2;
  E.CHAMP_ZONE_BONUS = 5;  // trophées complets : +5 % dans la sous-zone
  E.CHAMP_TRAILS = 3;      // pistes pour appeler le légendaire
  E.CHAMP_LEG_HP = 12;     // PV du légendaire (×12 au lieu de ×2) : réglé par simulation (8 héros sans équipement perdent, bien équipés gagnent)
  E.CHAMP_LEG_SHARDS = 10; // Éclats donnés par le légendaire
  E.CHAMP_LEG_DMG = 2;     // dégâts ×2 en plus du +20 % de Champion
  /* 15 fusions (clé : deux pouvoirs dans l'ordre de E.SEAL_ORDER) */
  E.SEAL_FUSIONS = {
    "enrage+blinde": "Colosse", "enrage+vampire": "Berserker", "enrage+veloce": "Furie", "enrage+meneur": "Chef de guerre", "enrage+traqueur": "Bourreau",
    "blinde+vampire": "Rempart sanglant", "blinde+veloce": "Sentinelle", "blinde+meneur": "Porte-étendard", "blinde+traqueur": "Chasseur cuirassé",
    "vampire+veloce": "Ombre", "vampire+meneur": "Seigneur vampire", "vampire+traqueur": "Charognard",
    "veloce+meneur": "Éclaireur", "veloce+traqueur": "Prédateur", "meneur+traqueur": "Maître de chasse",
  };

  const st = (S) => {
    const c = S.ch || (S.ch = {});
    c.k = c.k || {}; c.f = c.f || []; c.z = c.z || {}; c.t = c.t || {}; c.l = c.l || {}; c.sh = c.sh || 0; c.ev = c.ev || {};
    return c;
  };
  E.champState = st;
  E.fuseKey = (a, b) => [a, b].sort((x, y) => E.SEAL_ORDER.indexOf(x) - E.SEAL_ORDER.indexOf(y)).join("+");
  E.sealKills = (S, k) => st(S).k[k] || 0;
  E.sealRank = (S, k) => { const n = E.sealKills(S, k); return E.SEAL_RANKS.filter((x) => n >= x).length; };
  E.sealVal = (k, r) => (k === "veloce" ? 1 : Math.round(E.SEALS[k].max * r / 5 * 10) / 10);
  E.sealName = (key) => (key && key.includes("+") ? E.SEAL_FUSIONS[key] || key : key && E.SEALS[key] ? E.SEALS[key].name : "");
  /* le Sceau porté : { key, list: [{ k, r, v }], cri } ; null sans Sceau ou au rang 0 */
  E.sealOf = (S, c) => {
    if (!c || !c.seal || !S) return null;
    const ks = c.seal.split("+"); const fused = ks.length > 1;
    if (fused && !st(S).f.includes(c.seal)) return null;
    const w = fused ? Math.min(...ks.map((k) => E.sealEv(S, k))) : E.sealEv(S, ks[0]); // 2.1.x : Éveil (une fusion suit le moins éveillé des deux)
    const list = ks.filter((k) => E.SEALS[k]).map((k) => { const r = fused ? 5 : E.sealRank(S, k); const f = r >= 5 && k !== "veloce" ? 1 + E.SEAL_EV_STEP * w : 1;
      return { k, r, w: r >= 5 ? w : 0, v: Math.round((fused ? E.sealVal(k, 5) * E.SEAL_FUSE_PCT : E.sealVal(k, r)) * f * 10) / 10 }; }).filter((x) => x.r);
    return list.length ? { key: c.seal, list, cri: list.every((x) => x.r >= 5) } : null;
  };
  /* texte d'un pouvoir porté : Véloce éveillé affiche aussi son bonus du premier tour (70 % dans une fusion), sinon on ne voyait pas qu'il comptait */
  E.sealVeloceEv = (key, w) => Math.round(E.SEAL_EV_VELOCE * w * (key && key.includes("+") ? E.SEAL_FUSE_PCT : 1) * 10) / 10;
  E.sealPowTxt = (key, x) => (x.k === "veloce" && x.w ? `Joue avant tout le monde et +${pc(E.sealVeloceEv(key, x.w))} % de dégâts au premier tour` : E.SEALS[x.k].txt(x.v));
  E.sealCanWear = (S, key) => (key.includes("+") ? st(S).f.includes(key) : !!E.SEALS[key] && E.sealRank(S, key) > 0);

  /* ---------- actions ---------- */
  E.sealWear = (S, cid, key) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (!key) { c.seal = null; return null; }
    if (!E.sealCanWear(S, key)) return "Ce Sceau n'est pas encore débloqué.";
    c.seal = key; return null;
  };
  E.sealFuse = (S, a, b) => {
    if (!E.SEALS[a] || !E.SEALS[b] || a === b) return "Choisis deux Sceaux différents.";
    if (E.sealRank(S, a) < 5 || E.sealRank(S, b) < 5) return "Les deux Sceaux doivent être au rang 5.";
    const key = E.fuseKey(a, b); const C = st(S);
    if (C.f.includes(key)) return "Cette fusion est déjà découverte.";
    C.f.push(key); E.note(S, `Fusion découverte : Sceau ${E.SEAL_FUSIONS[key]} (${E.SEALS[a].name} + ${E.SEALS[b].name}) !`, "rare");
    return null;
  };
  E.sealShard = (S, k) => {
    const C = st(S); if (!E.SEALS[k]) return "Sceau inconnu."; if (C.sh < 1) return "Aucun Éclat de champion.";
    C.sh--; addKill(S, k, 1); return null;
  };
  E.champLegGo = (S) => {
    const C = st(S); const sid = S.sub;
    if (!S.hunting || !sid || S.dungeon) return "Il faut chasser dans la sous-zone de la traque.";
    if ((C.t[sid] || 0) < E.CHAMP_TRAILS) return `Il faut ${E.CHAMP_TRAILS} pistes dans cette sous-zone.`;
    if (C.pend === sid) return "Le Champion légendaire arrive au prochain combat.";
    if (E.champLegHere(S)) return "Le Champion légendaire est déjà là.";
    C.pend = sid; E.note(S, `Le Champion légendaire de ${E.SUBS[sid].name} arrive au prochain combat !`, "rare");
    return null;
  };
  /* 2.1.20 : appel automatique du légendaire dès 3 pistes dans la zone chassée (idée de Sky). Après une défaite contre lui,
     plus d'appel automatique dans cette zone pendant 30 minutes (sinon une équipe trop faible ne ferait plus que ça). */
  E.CHAMP_AUTO_PAUSE = 30 * 60 * 1000;
  E.champAuto = (S, on) => { st(S).auto = !!on; return null; };
  const autoCall = (S, sub) => {
    const C = S.ch; if (!C || !C.auto || C.pend || E.catchingUp || !S.hunting || S.dungeon || !S.sub || E.SUBS[S.sub] !== sub) return;
    if ((E.expActive && E.expActive(S)) || (C.t[S.sub] || 0) < E.CHAMP_TRAILS || E.champLegHere(S)) return;
    const A = C.autoAt || (C.autoAt = {}); if (A[S.sub] && E.now() - A[S.sub] < E.CHAMP_AUTO_PAUSE) return;
    A[S.sub] = E.now(); C.pend = S.sub; E.note(S, `Appel automatique : le Champion légendaire de ${sub.name} arrive !`, "rare");
  };
  Object.assign(E.ACTIONS, { champAuto: "appel automatique du Champion légendaire", sealWear: "porter un Sceau de champion", sealFuse: "fusionner deux Sceaux de champion", sealShard: "utiliser un Éclat de champion", champLegGo: "appeler le Champion légendaire" });

  /* ---------- Champions vaincus (appelé par giveRewards) ---------- */
  const addKill = (S, k, n) => {
    const C = st(S); const r0 = E.sealRank(S, k); C.k[k] = (C.k[k] || 0) + n; const r1 = E.sealRank(S, k);
    if (r1 > r0) {
      E.note(S, `Sceau ${E.SEALS[k].name} : rang ${r1} !`, "rare");
      if (r1 >= 5 && !(S.titlesExtra || []).some((t) => /^Champion (Enragé|Blindé|Vampirique|Véloce|Meneur|Traqueur)$/.test(t))) {
        (S.titlesExtra = S.titlesExtra || []).push(`Champion ${E.SEALS[k].name}`); E.note(S, `Titre débloqué : « Champion ${E.SEALS[k].name} » !`, "rare");
      }
    }
  };
  E.champLegHere = (S) => !!(S.fight && !S.fight.over && S.fight.ents.some((m) => m.champLeg && m.alive));
  E.champZoneDone = (S, sid) => { const z = st(S).z[sid]; return !!z && E.SEAL_ORDER.every((k) => z[k]); };
  E.champKill = (S, m, opts = {}) => {
    const C = st(S);
    if (m.champLeg) {
      const sid = m.champLeg; if (C.autoAt) delete C.autoAt[sid]; C.l[sid] = (C.l[sid] || 0) + 1; C.t[sid] = Math.max(0, (C.t[sid] || 0) - E.CHAMP_TRAILS); C.sh += E.CHAMP_LEG_SHARDS;
      const sub = E.SUBS[sid]; const title = `Traqueur de ${sub ? sub.name : sid}`;
      if (!(S.titlesExtra || []).includes(title)) (S.titlesExtra = S.titlesExtra || []).push(title);
      E.note(S, `Champion légendaire vaincu ! Titre « ${title} » et ${E.CHAMP_LEG_SHARDS} Éclats de champion.`, "rare");
      return { leg: sid };
    }
    if (m.idolChamp) return null; // 1.2.10.3 : Champion de l'idole Djim, ni Sceau, ni trophée, ni piste
    const k = m.champ; if (!E.SEALS[k]) return null;
    addKill(S, k, 1);
    const sid = S.sub;
    if (opts.dungeon || S.dungeon || !sid || !E.SUBS[sid] || (E.expActive && E.expActive(S)) || opts.noZone) return { k };
    const z = C.z[sid] || (C.z[sid] = {}); const had = E.champZoneDone(S, sid); z[k] = 1;
    if (!had && E.champZoneDone(S, sid)) E.note(S, `Trophées de champion complets : ${E.SUBS[sid].name} (+${E.CHAMP_ZONE_BONUS} % d'XP et de butin ici) !`, "rare");
    const t0 = C.t[sid] || 0; C.t[sid] = Math.min(E.CHAMP_TRAILS, t0 + 1);
    if (t0 < E.CHAMP_TRAILS && C.t[sid] >= E.CHAMP_TRAILS) E.note(S, `Traque : ${E.CHAMP_TRAILS} pistes à ${E.SUBS[sid].name}, le Champion légendaire peut être appelé.`, "rare");
    return { k, sid };
  };

  /* ---------- trophées complets : +5 % dans la sous-zone (XP, kamas et butin passent par trophyZoneMult) ---------- */
  const tzm = E.trophyZoneMult;
  E.trophyZoneMult = (S, opts = {}) => tzm(S, opts) * (opts.dungeon || S.dungeon || !S.sub || (E.expActive && E.expActive(S)) || !S.ch || !E.champZoneDone(S, S.sub) ? 1 : 1 + E.CHAMP_ZONE_BONUS / 100);

  /* ---------- le Champion légendaire : au prochain groupe de la sous-zone appelée ---------- */
  const mg = E.makeGroup;
  E.makeGroup = (S, sub, teamSize) => {
    const g = mg(S, sub, teamSize);
    autoCall(S, sub);
    const C = S.ch; if (!C || !C.pend || E.catchingUp || E.SUBS[C.pend] !== sub) return g; // 1.1.0.1 : jamais pendant l'absence (combat tiré d'avance, gagné sans le voir)
    if ((C.t[C.pend] || 0) < E.CHAMP_TRAILS) { C.pend = null; return g; }
    const cand = g.filter((m) => !m.archi); if (!cand.length) return g;
    const m = cand.sort((a, b) => b.lvl - a.lvl || b.hpMax - a.hpMax)[0];
    g.forEach((x) => { if (x !== m && x.champ) { x.hpMax = x.hp = Math.round(x.hpMax / 2); x.dmg /= 1.2; x.champ = null; x.shield = 0; x.vamp = 0; x.enrageMod = false; } });
    if (!m.champ) E.makeChampion(m, "meneur"); else m.champ = "meneur";
    m.hpMax = m.hp = Math.round(m.hpMax / 2 * E.CHAMP_LEG_HP); m.dmg *= E.CHAMP_LEG_DMG;
    m.shield = Math.round(m.hpMax * 0.15); m.vamp = 0.15; m.ini += 1e6; m.enrageMod = true;
    m.champLeg = C.pend; m.name = `${m.name} légendaire`; C.pend = null;
    return g;
  };

  /* ---------- en combat (points d'appel dans engine.js : charEntity, début de combat, charDamage) ---------- */
  const A = () => E.fightApi;
  E.sealFight = (S, F) => {
    F.sealMen = 0; F.sealReso = 0;
    const hs = F.ents.filter((e) => e.side === "c" && !e.summon && e.seal);
    if (!hs.length) return;
    const kinds = new Set(); hs.forEach((e) => e.seal.list.forEach((x) => kinds.add(x.k)));
    if (hs.length >= 4 && kinds.size >= 4) F.sealReso = E.SEAL_RESO;
    F.ents.forEach((e) => { if (e.side !== "c" || e.summon) return;
      if (F.sealReso && e.st) { const add = Math.round(e.hpMax * F.sealReso / 100); e.hpMax += add; e.hp += add; }
      (e.seal ? e.seal.list : []).forEach((x) => {
        if (x.k === "blinde") e.shield = Math.max(e.shield || 0, Math.round(e.hpMax * x.v / 100));
        if (x.k === "vampire") e.vamp = Math.max(e.vamp || 0, x.v / 100);
        if (x.k === "veloce") e.expFirst = true;
        if (x.k === "meneur") F.sealMen = Math.max(F.sealMen, x.v);
      }); });
    if (F.sealReso && A()) A().flog(F, `Conclave des Champions : +${E.SEAL_RESO} % de dégâts et de PV pour l'équipe.`, "buff");
  };
  E.sealDmg = (F, e, tgt, v) => {
    if (F && F.pvp) return v; // pas de Sceaux au Kolizéum
    if (e.side === "c" && F) v *= 1 + ((F.sealMen || 0) + (F.sealReso || 0)) / 100;
    const s = e.seal; if (!s) return v;
    if (s.cri && !e.criUsed && e.hp < e.hpMax * E.SEAL_CRI_HP) {
      e.criUsed = true; e.criOn = E.SEAL_CRI_TURNS; e.criRound = F ? F.round : 0;
      const b = s.list.find((x) => x.k === "blinde"); if (b) e.shield = Math.max(e.shield || 0, Math.round(e.hpMax * 2 * b.v / 100));
      const vp = s.list.find((x) => x.k === "vampire"); if (vp) e.vamp = 2 * vp.v / 100;
      if (F && A()) { A().flog(F, `Cri du Champion : ${e.name} double les pouvoirs de son Sceau ${E.sealName(s.key)} !`, "buff"); F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(e), txt: "Cri du Champion" }); }
    }
    const mul = e.criOn ? 2 : 1;
    s.list.forEach((x) => {
      if (x.k === "enrage" && e.hp < e.hpMax * 0.5) v *= 1 + x.v * mul / 100;
      if (x.k === "traqueur" && tgt && tgt.hp < tgt.hpMax * 0.5) v *= 1 + x.v * mul / 100;
      if (x.k === "veloce" && x.w && F && F.round <= 1) v *= 1 + E.sealVeloceEv(s.key, x.w) / 100; // Véloce éveillé : +4 % de dégâts au premier tour par Éveil (70 % dans une fusion, comme les autres pouvoirs)
    });
    if (e.criOn && F && F.round !== e.criRound) { e.criRound = F.round; e.criOn--; if (!e.criOn) { const vp = s.list.find((x) => x.k === "vampire"); if (vp) e.vamp = vp.v / 100; } }
    return v;
  };

  /* ---------- 2.1.x « Les Éclats du Traqueur » (Sky, choix 2C de Mathis) ----------
     Éveil : un Sceau au rang 5 s'éveille 5 fois avec des Éclats (100, 200, 350, 550, 800 : 12 000 pour les 6 Sceaux),
     chaque Éveil ajoute 10 % à son effet ; Véloce, qui joue déjà en premier, gagne 4 % de dégâts au premier tour par Éveil (70 % dans une fusion).
     Simulation (équipes de 8, bon équipement et optimisé) : +0,1 stasis entre les Sceaux au rang 5 et l'Éveil complet.
     Comptoir des Éclats : appât, piste, coffre, ornement, titre et revente (10 000 kamas l'Éclat, environ +10 % de kamas en chasse).
     État : S.ch.ev = { pouvoir: Éveil 0-5 }, S.ch.bait = pouvoir de l'appât (prochain combat de chasse). */
  E.SEAL_EV_MAX = 5; E.SEAL_EV_STEP = 0.1; E.SEAL_EV_VELOCE = 4;
  E.SEAL_EV_COST = [100, 200, 350, 550, 800];
  E.sealEv = (S, k) => (S && S.ch && S.ch.ev && S.ch.ev[k]) || 0;
  E.sealEveil = (S, k) => {
    const C = st(S); if (!E.SEALS[k]) return "Sceau inconnu.";
    if (E.sealRank(S, k) < 5) return "Le Sceau doit être au rang 5 pour s'éveiller.";
    const n = E.sealEv(S, k); if (n >= E.SEAL_EV_MAX) return "Ce Sceau est déjà complètement éveillé.";
    const cost = E.SEAL_EV_COST[n]; if (C.sh < cost) return `Il faut ${cost} Éclats.`;
    C.sh -= cost; C.ev[k] = n + 1;
    E.note(S, `Sceau ${E.SEALS[k].name} : Éveil ${n + 1} / ${E.SEAL_EV_MAX} !`, "rare");
    if (E.SEAL_ORDER.every((x) => E.sealEv(S, x) >= E.SEAL_EV_MAX)) { const t = "Champion éveillé"; if (!(S.titlesExtra || []).includes(t)) { (S.titlesExtra = S.titlesExtra || []).push(t); E.note(S, `Les six Sceaux sont éveillés : titre « ${t} » !`, "rare"); } }
    return null;
  };
  E.SHARD_SELL = 10000; E.SHARD_SELL_N = 10;
  E.SHARD_SHOP = {
    appat:  { name: "Appât de Champion", cost: 15, txt: "Ton prochain combat de chasse a un Champion du pouvoir de ton choix" },
    piste:  { name: "Piste fraîche", cost: 20, txt: "+1 piste de traque dans ta zone de chasse" },
    coffre: { name: "Coffre en argent", cost: 30, txt: "Environ 15 minutes de chasse : kamas, poussière, ressources" },
    orn:    { name: "Ornement « Éclat doré »", cost: 400, once: true, txt: "Un ornement de carte de héros" },
    titre:  { name: "Titre « Collectionneur d'éclats »", cost: 1000, once: true, txt: "Un titre de compte" },
    vente:  { name: "Revendre au Traqueur", cost: E.SHARD_SELL_N, txt: `${E.SHARD_SELL_N} Éclats contre ${(E.SHARD_SELL * E.SHARD_SELL_N).toLocaleString("fr-FR")} kamas` },
  };
  E.SHARD_ORDER = ["appat", "piste", "coffre", "orn", "titre", "vente"];
  E.SHARD_TITLE = "Collectionneur d'éclats";
  E.shardOwned = (S, id) => (id === "orn" ? !!(S.unlocks && S.unlocks.eclatDore) : id === "titre" ? (S.titlesExtra || []).includes(E.SHARD_TITLE) : false);
  E.shardBuy = (S, id, arg) => {
    const C = st(S); const it = E.SHARD_SHOP[id]; if (!it) return "Article inconnu.";
    if (it.once && E.shardOwned(S, id)) return "Déjà obtenu.";
    if (C.sh < it.cost) return `Il faut ${it.cost} Éclats.`;
    if (id === "appat") { if (!E.SEALS[arg]) return "Choisis un pouvoir."; if (C.bait) return "Un appât attend déjà le prochain combat de chasse."; C.bait = arg; }
    else if (id === "piste") { const sid = S.sub; if (!S.hunting || !sid || S.dungeon || !E.SUBS[sid]) return "Il faut chasser dans une sous-zone."; if ((C.t[sid] || 0) >= E.CHAMP_TRAILS) return `Déjà ${E.CHAMP_TRAILS} pistes ici.`; C.t[sid] = (C.t[sid] || 0) + 1; }
    else if (id === "coffre") E.addCons(S, "coffre_argent");
    else if (id === "orn") { S.unlocks = S.unlocks || {}; S.unlocks.eclatDore = 1; }
    else if (id === "titre") (S.titlesExtra = S.titlesExtra || []).push(E.SHARD_TITLE);
    else if (id === "vente") S.kamas += E.SHARD_SELL * E.SHARD_SELL_N;
    C.sh -= it.cost;
    E.note(S, id === "appat" ? `Appât de Champion posé : le prochain combat de chasse aura un Champion ${E.SEALS[arg].name}.` : id === "piste" ? `Piste fraîche : ${C.t[S.sub]} / ${E.CHAMP_TRAILS} pistes à ${E.SUBS[S.sub].name}.` : id === "vente" ? `${it.cost} Éclats revendus au Traqueur.` : `Comptoir des Éclats : ${it.name}.`, "info");
    return null;
  };
  Object.assign(E.ACTIONS, { sealEveil: "éveiller un Sceau de champion", shardBuy: "acheter au Comptoir des Éclats" });
  /* l'appât : le prochain groupe de chasse (pas en donjon, ni pendant l'absence, ni face au légendaire) a un Champion du pouvoir choisi */
  const mg2 = E.makeGroup;
  E.makeGroup = (S, sub, teamSize) => {
    const g = mg2(S, sub, teamSize);
    const C = S.ch; if (!C || !C.bait || E.catchingUp || S.dungeon || !S.hunting || g.some((m) => m.champLeg)) return g;
    const k = C.bait; C.bait = null; if (!E.SEALS[k]) return g;
    const cur = g.find((m) => m.champ && !m.idolChamp);
    if (cur) { cur.hpMax = cur.hp = Math.round(cur.hpMax / 2); cur.dmg /= 1.2; cur.shield = 0; cur.vamp = 0; cur.enrageMod = false; if (cur.champ === "veloce") cur.ini -= 1e6; E.makeChampion(cur, k); return g; }
    const cand = g.filter((m) => !m.archi && !m.champ); if (cand.length) E.makeChampion(cand[0], k);
    return g;
  };
})(typeof window !== "undefined" ? window : globalThis);
