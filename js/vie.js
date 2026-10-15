/* idlus — 0.1.23.2 « Artisans et temples » : commandes d'artisans, Dopeuls des temples, consignes d'absence.
   (Les sons du jeu sont côté interface, dans ui.js.)
   Chaque système garde son état dans la sauvegarde : S.cmd, S.temple, S.consigne. */
(function (root) {
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { MONSTERS, CLASSES, GATHER_JOBS, CRAFT_JOBS } = D;
  const SUBS = E.SUBS;
  const rnd = () => E.rnd();
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const topLvl = (S) => Math.max(1, ...S.chars.map((c) => c.lvl));
  const day = () => E.dayKey(E.now());
  const fmtK = (n) => Math.round(n).toLocaleString("fr-FR");

  /* ======================= Commandes d'artisans ======================= */
  E.CMD_SLOTS = 3;
  E.CMD_DAY_MAX = 10;     // 1.0.24.1 : une commande livrée est remplacée aussitôt, jusqu'à 10 livrées par jour
  E.CMD_PRIMES = [[3, null], [10, "coffre_or"]]; // primes du jour : 3 livrées (bois, ou argent avec une urgente), 10 livrées (or)
  E.CMD_RANKS = [3, 10, 25];   // commandes livrées à un même artisan pour passer un rang (+10 % de kamas par rang)
  E.CMD_TITLE = "Fournisseur officiel";
  E.CMD_ARTS = {
    paysan: "Aurélien le Meunier", bucheron: "Bran la Scieuse", mineur: "Grogrut le Fondeur", alchimiste: "Élisa l'Herboriste", pecheur: "Pépé Hameçon",
    tailleur: "Tissandre la Tailleuse", bijoutier: "Perlette la Joaillière", cordonnier: "Godasse le Cordonnier", forgeron: "Ferraille le Forgeron",
    sculpteur: "Copeau le Sculpteur", faconneur: "Bouclard le Façonneur", bricoleur: "Clé-de-Douze le Bricoleur",
  };
  const jobName = (job) => (GATHER_JOBS[job] || CRAFT_JOBS[job] || { name: job }).name;
  E.cmdState = (S) => {
    if (!S.cmd || typeof S.cmd !== "object") S.cmd = { day: null, list: [], rep: {}, n: 0, swap: null, bonus: null };
    const C = S.cmd; if (!Array.isArray(C.list)) C.list = []; if (!C.rep) C.rep = {};
    if (C.day !== day()) { C.day = day(); C.list = []; C.swap = null; C.dn = 0; C.made = 0; C.urg = false; C.bonus2 = null; for (let i = 0; i < E.CMD_SLOTS; i++) if (addOrder(S, i === 0 && rnd() < 0.35)) C.made++; }
    if (C.dn === undefined) { C.dn = C.list.filter((o) => o.got >= o.n).length; C.made = C.list.length; C.urg = C.list.some((o) => o.urgent && o.got >= o.n); } // parties d'avant la 1.0.24.1
    refill(S); // 1.0.25.1 : une commande déjà livrée (avant la mise à jour, ou si aucune n'a pu être tirée) est remplacée dès que possible
    return C;
  };
  E.cmdRank = (S, art) => { const n = (S.cmd && S.cmd.rep[art]) || 0; return E.CMD_RANKS.filter((x) => n >= x).length; };
  /* ressources lâchées par les monstres des zones débloquées proches du niveau de l'équipe */
  const dropPool = (S) => {
    const top = topLvl(S); const out = new Map();
    Object.values(SUBS).filter((s) => !s.hidden && E.subUnlocked(S, s.id) && s.lvl[0] <= top + 3 && s.lvl[1] >= top - 20).forEach((s) => (s.monsters || []).forEach((k) => {
      const m = MONSTERS[k]; if (!m || m.boss || m.archiOf) return;
      (m.drops || []).forEach(([r, p]) => { if (p >= 10 && !E.isKey(r) && E.resPrice(r) > 0 && !out.has(r)) out.set(r, m.lvl[0]); });
    }));
    return [...out.entries()];
  };
  /* 1.0.24.1 : chaque commande livrée est remplacée, jusqu'à E.CMD_DAY_MAX commandes tirées dans la journée */
  function refill(S) {
    const C = S.cmd;
    for (let i = 0; i < C.list.length && (C.made || 0) < E.CMD_DAY_MAX; i++) {
      const o = C.list[i]; if (o.got < o.n) continue;
      C.list.splice(i, 1); const nw = addOrder(S, rnd() < 0.2);
      if (!nw) { C.list.splice(i, 0, o); break; } // rien à tirer pour l'instant : on réessaiera
      C.list.splice(C.list.length - 1, 1); C.list.splice(i, 0, nw); C.made = (C.made || 0) + 1;
      E.note(S, `Nouvelle commande : ${E.CMD_ARTS[nw.art]} demande ${nw.n} × ${nw.res}.`, "info");
    }
  }
  function addOrder(S, urgent) {
    const C = S.cmd; const taken = new Set(C.list.map((o) => o.art)); const used = new Set(C.list.map((o) => o.res));
    let o = null;
    for (let tries = 0; tries < 30 && !o; tries++) {
      if (rnd() < 0.5) { // métier de récolte : une ressource que l'équipe sait déjà récolter
        const job = pick(Object.keys(GATHER_JOBS)); if (taken.has(job)) continue;
        const jl = (S.jobs[job] && S.jobs[job].lvl) || 1;
        const can = GATHER_JOBS[job].items.filter(([, l]) => l <= jl).slice(-3); if (!can.length) continue;
        const [res, rl] = pick(can); if (used.has(res)) continue;
        o = { art: job, kind: "g", res, rl, n: 20 + 10 * Math.floor(rnd() * 5) };
      } else { // artisan : une ressource de monstre des zones de l'équipe
        const job = pick(Object.keys(CRAFT_JOBS)); if (taken.has(job)) continue;
        const pool = dropPool(S); if (!pool.length) continue;
        const [res, rl] = pick(pool); if (used.has(res)) continue;
        o = { art: job, kind: "c", res, rl, n: 10 + 5 * Math.floor(rnd() * 5) };
      }
    }
    if (!o) return null;
    const price = Math.max(2, E.resPrice(o.res) || 0);
    o.id = (S.cmd.seq = (S.cmd.seq || 0) + 1); o.got = 0; o.urgent = !!urgent;
    o.kamas = Math.round((o.n * price * 2.5 + 100 + o.rl * 15 + 25 * topLvl(S)) * (urgent ? 1.5 : 1));
    o.jxp = Math.round(o.n * (4 + o.rl * 0.6) * (urgent ? 1.5 : 1));
    C.list.push(o); return o;
  }
  E.cmdReward = (S, o) => Math.round(o.kamas * (1 + 0.1 * E.cmdRank(S, o.art)));
  const giveJobXp = (S, job, x) => {
    const gather = !!GATHER_JOBS[job]; const J = gather ? S.jobs[job] : S.crafts[job]; if (!J) return;
    J.xp += x;
    while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; E.note(S, `${jobName(job)} niveau ${J.lvl}`, "up"); if (gather) E.emit(S, "joblvl", { job, lvl: J.lvl }); }
  };
  /* livrer : tout ce qu'on a, jusqu'à la quantité demandée (les livraisons partielles comptent) */
  E.cmdDeliver = (S, id) => {
    const C = E.cmdState(S); const o = C.list.find((x) => x.id === id); if (!o) return "Commande introuvable.";
    if (o.got >= o.n) return "Commande déjà livrée.";
    const q = Math.min(S.res[o.res] || 0, o.n - o.got); if (q <= 0) return `Il faut des ${o.res}.`;
    S.res[o.res] -= q; if (!S.res[o.res]) delete S.res[o.res]; o.got += q;
    if (o.got < o.n) { E.note(S, `${E.CMD_ARTS[o.art]} : ${q} × ${o.res} livrés (${o.got}/${o.n}).`, "info"); return null; }
    const k = E.cmdReward(S, o); const r0 = E.cmdRank(S, o.art);
    S.kamas += k; giveJobXp(S, o.art, o.jxp);
    C.rep[o.art] = (C.rep[o.art] || 0) + 1; C.n = (C.n || 0) + 1;
    const r1 = E.cmdRank(S, o.art);
    E.note(S, `Commande livrée à ${E.CMD_ARTS[o.art]} : +${fmtK(k)} kamas, +${fmtK(o.jxp)} XP ${jobName(o.art)}.${r1 > r0 ? ` Rang ${r1} : +${r1 * 10} % de kamas avec cet artisan.` : ""}`, "rare");
    C.dn = (C.dn || 0) + 1; if (o.urgent) C.urg = true;
    if (C.bonus !== C.day && C.dn >= E.CMD_PRIMES[0][0]) { // 1re prime du jour : 3 commandes livrées
      C.bonus = C.day; const chest = E.cmdChest(S); E.addCons(S, chest);
      E.note(S, `Prime du jour : ${C.dn} commandes livrées ! ${D.CONSUMABLES[chest].name} offert.`, "rare");
    }
    if (C.bonus2 !== C.day && C.dn >= E.CMD_PRIMES[1][0]) { // 2e prime : 10 commandes livrées
      C.bonus2 = C.day; E.addCons(S, E.CMD_PRIMES[1][1]);
      E.note(S, `Grande prime : ${C.dn} commandes livrées aujourd'hui ! ${D.CONSUMABLES[E.CMD_PRIMES[1][1]].name} offert.`, "rare");
    }
    refill(S); // une nouvelle commande prend sa place
    E.emit(S, "commande", { art: o.art }); if (E.checkAch) E.checkAch(S);
    return null;
  };
  E.cmdChest = (S) => (S.cmd && (S.cmd.urg || S.cmd.list.some((x) => x.urgent && x.got < x.n)) ? "coffre_argent" : "coffre_bois");
  E.cmdLeft = (S) => { const C = E.cmdState(S); return Math.max(0, E.CMD_DAY_MAX - (C.made || 0)); }; // commandes encore à venir aujourd'hui
  E.cmdSwapCost = (S) => (S.cmd && S.cmd.swap === day() ? 25 * topLvl(S) : 0);
  E.cmdSwap = (S, id) => {
    const C = E.cmdState(S); const i = C.list.findIndex((x) => x.id === id); if (i < 0) return "Commande introuvable.";
    if (C.list[i].got > 0) return "Commande déjà commencée.";
    const cost = E.cmdSwapCost(S); if (S.kamas < cost) return `Il faut ${fmtK(cost)} kamas.`;
    const old = C.list.splice(i, 1)[0]; const o = addOrder(S, old.urgent);
    if (!o) { C.list.splice(i, 0, old); return "Aucune autre commande pour le moment."; }
    C.list.splice(C.list.length - 1, 1); C.list.splice(i, 0, o);
    S.kamas -= cost; C.swap = day(); return null;
  };
  E.cmdNeeds = (S) => { const C = S.cmd && S.cmd.day === day() ? S.cmd : null; return C ? C.list.filter((o) => o.got < o.n).map((o) => o.res) : []; };

  /* ======================= Dopeuls des temples ======================= */
  E.TEMPLE_TITLE = "Maître des temples";
  E.TEMPLE_TITLE_N = 10; // Dopeuls de classes différentes vaincus
  const EL_OF = { fo: "t", ine: "f", cha: "e", age: "a" };
  E.templeState = (S) => {
    if (!S.temple || typeof S.temple !== "object") S.temple = { day: null, done: {}, beat: {}, pend: null, fighting: null, streak: { n: 0, last: null }, n: 0 };
    const T = S.temple; if (T.day !== day()) { T.day = day(); T.done = {}; }
    if (!T.beat) T.beat = {}; if (!T.streak) T.streak = { n: 0, last: null };
    return T;
  };
  /* le Dopeul a le niveau du plus fort héros de sa classe */
  E.templeHero = (S, cls) => S.chars.filter((c) => c.cls === cls).sort((a, b) => b.lvl - a.lvl)[0] || null;
  E.templeClasses = (S) => D.CLASS_ORDER.filter((k) => E.templeHero(S, k));
  /* force du Dopeul (réglée par simulation : une équipe bien équipée gagne la plupart du temps, une équipe sans équipement perd) */
  E.DOPEUL = { hp0: 1.8, hpN: 0.7, dmg: 1.35, less: 0 };
  E.doplons = (lvl) => 1 + Math.floor(lvl / 40);
  E.templeFight = (S, cls) => {
    const T = E.templeState(S); const c = E.templeHero(S, cls);
    if (!c) return `Il faut un héros ${CLASSES[cls] ? CLASSES[cls].name : ""} pour entrer dans ce temple.`;
    if (T.done[cls]) return "Ce Dopeul a déjà été vaincu aujourd'hui.";
    if (S.dungeon) return "Quittez d'abord le donjon.";
    if (S.exp && S.exp.on) return "Réveille d'abord l'équipe du Songe infini.";
    if (!S.hunting || !S.sub) return "Lancez d'abord une chasse : le Dopeul vient défier l'équipe sur place.";
    if (S.tresor && S.tresor.cur && S.tresor.cur.ready) return "Battez d'abord le gardien du trésor.";
    T.pend = cls; E.note(S, `Le Dopeul ${CLASSES[cls].name} arrive au prochain combat.`, "info"); return null;
  };
  E.templeCancel = (S) => { const T = E.templeState(S); T.pend = null; return null; };
  const prot0 = E.protGroup;
  E.protGroup = (S, sub, team, monsterEntity) => {
    const T = S.temple; const cls = T && T.pend;
    if (!cls || S.dungeon) return prot0(S, sub, team, monsterEntity);
    const hero = E.templeHero(S, cls); T.pend = null; if (!hero) return prot0(S, sub, team, monsterEntity);
    const pool = (sub.monsters || []).filter((m) => MONSTERS[m] && !MONSTERS[m].boss && !MONSTERS[m].archiOf); if (!pool.length) return prot0(S, sub, team, monsterEntity);
    const g = monsterEntity(pick(pool), clamp(hero.lvl, 1, 200));
    g.name = `Dopeul ${CLASSES[cls].name}`; g.dop = { cls, sex: hero.sex || CLASSES[cls].sex || "m", head: hero.head || 0 };
    g.el = EL_OF[CLASSES[cls].main] || g.el; g.res = { t: 10, f: 10, e: 10, a: 10, n: 10 };
    const P = E.DOPEUL, z = E.foeSize(team.length, g.lvl); g.hpMax = g.hp = Math.round(g.hpMax * (P.hp0 + team.length * P.hpN) * z.hp); g.dmg *= P.dmg * z.dmg; g.attacks = team.length > 1 ? 2 : 1; g.ini += 80;
    const mons = [g].concat(E.makeGroup(S, sub, team.length).slice(0, Math.max(0, team.length - 1 - P.less)));
    T.fighting = cls; T.need = true;
    return { mons, label: `Temple ${CLASSES[cls].name} · Dopeul niveau ${g.lvl}` };
  };
  const start0 = E.startFight;
  if (typeof start0 === "function") E.startFight = function (S, ...a) {
    const r = start0.call(this, S, ...a);
    const T = S && S.temple; if (T && T.need && S.fight) { S.fight.dopeul = T.fighting; T.need = false; }
    return r;
  };
  const az0 = E.autoZone;
  E.autoZone = (S, win) => {
    const T = S && S.temple;
    if (T && T.fighting && S.fight && S.fight.dopeul) { const cls = T.fighting; T.fighting = null; templeEnd(S, cls, win); }
    return az0(S, win);
  };
  function templeEnd(S, cls, win) {
    const T = E.templeState(S); const name = CLASSES[cls].name;
    if (!win) { E.note(S, `Le Dopeul ${name} l'emporte. Le temple reste ouvert : réessaie quand l'équipe est prête.`, "warn"); return; }
    const hero = E.templeHero(S, cls); const lvl = hero ? hero.lvl : 1;
    let n = E.doplons(lvl);
    const yest = E.dayKey(E.now() - 864e5); const st = T.streak;
    let bonus = false; if (st.last !== T.day) { st.n = st.last === yest ? st.n + 1 : 1; st.last = T.day; if (st.n % 7 === 0) { n += 3; bonus = true; } }
    const first = !T.beat[cls];
    T.done[cls] = 1; T.beat[cls] = (T.beat[cls] || 0) + 1; T.n = (T.n || 0) + 1;
    S.tokens.doplons = (S.tokens.doplons || 0) + n;
    E.note(S, `Dopeul ${name} vaincu : +${n} Doplon${n > 1 ? "s" : ""}${bonus ? ` (série de ${st.n} jours : +3)` : ""}.${first ? " Nouveau temple dans ta collection !" : ""}`, "rare");
    if (Object.keys(T.beat).length >= E.TEMPLE_TITLE_N && !S.titlesExtra.includes(E.TEMPLE_TITLE)) { S.titlesExtra.push(E.TEMPLE_TITLE); E.note(S, `Titre obtenu : « ${E.TEMPLE_TITLE} ».`, "rare"); }
    E.emit(S, "dopeul", { cls, first }); if (E.checkAch) E.checkAch(S);
  }
  /* le combat a disparu sans fin normale (chasse arrêtée, donjon…) : le Dopeul reste disponible */
  const tick0 = E.tick;
  E.tick = (S, dt, realMs) => {
    const T = S && S.temple; if (T && T.fighting && !(S.fight && S.fight.dopeul)) T.fighting = null;
    return tick0(S, dt, realMs);
  };
  /* Comptoir des temples (monnaie : Doplons) */
  if (E.SHOPS && !E.SHOPS.temple) E.SHOPS.temple = { name: "Comptoir des temples", cur: "doplons", curName: "Doplons", icon: "🪙", items: [
    { id: "d1", cons: "coffre_bois", cost: 3 }, { id: "d2", cons: "parchemin_avis", cost: 2 }, { id: "d3", cons: "pierre_ame", cost: 4 },
    { id: "d4", cons: "potion_savoir", cost: 6 }, { id: "d5", cons: "coffre_argent", cost: 10 }, { id: "d10", cons: "coffre_or", cost: 25 }, { id: "d6", tresor: true, name: "Parchemin de chasse au trésor", cost: 5 },
    ...["fo", "ine", "cha", "age", "vit", "sa"].map((k, i) => ({ id: "p" + i, cons: "parch_" + k + "_p", cost: 6 })),
    { id: "d7", cons: "bonbon_royal", cost: 14 }, { id: "d8", title: "Ombre du temple", cost: 30 }, { id: "d9", orn: "dopeul", name: "Ornement « Reflet du temple »", cost: 50 },
  ] };
  const buy0 = E.buyShop;
  E.buyShop = (S, shop, id, qty, arg) => {
    const Sh = E.SHOPS[shop]; const it = Sh && Sh.items.find((x) => x.id === id);
    if (!it || !it.tresor) return buy0(S, shop, id, qty, arg);
    const TR = E.tresorState ? E.tresorState(S) : null; if (!TR) return "Indisponible.";
    if (TR.stock.filter((x) => E.tresorP(x).k !== "leg").length >= E.TRESOR_STOCK) return `Tu as déjà ${E.TRESOR_STOCK} parchemins de chasse.`;
    if ((S.tokens[Sh.cur] || 0) < it.cost) return `Il faut ${it.cost} ${Sh.curName.toLowerCase()}.`;
    S.tokens[Sh.cur] -= it.cost; const lvl = clamp(Math.round(E.team(S).reduce((a, c) => a + c.lvl, 0) / Math.max(1, E.team(S).length)), 1, 200);
    TR.stock.push(lvl); E.note(S, `Comptoir des temples : parchemin de chasse au trésor niveau ${lvl} obtenu.`, "up"); return null;
  };
  const owned0 = E.shopOwned;
  E.shopOwned = (S, it) => (it && it.tresor ? false : owned0(S, it));
  const name0 = E.shopItemName;
  E.shopItemName = (S, it) => (it && it.tresor ? it.name : name0(S, it));

  /* ======================= Consignes d'absence ======================= */
  E.CONSIGNE_DEF = { roam: false, back: true, cap: 0, alm: false, cmd: false };
  E.consigne = (S) => { if (!S.consigne || typeof S.consigne !== "object") S.consigne = Object.assign({}, E.CONSIGNE_DEF); return S.consigne; };
  E.consigneSet = (S, k, v) => {
    const C = E.consigne(S); if (!(k in E.CONSIGNE_DEF)) return "Consigne inconnue.";
    C[k] = k === "cap" ? clamp(Math.round(+v || 0), 0, 1e6) : !!v; return null;
  };
  const catch0 = E.catchUp;
  E.catchUp = (S, seconds) => {
    const C = E.consigne(S); const from = S.sub; const tmpRoam = C.roam && !S.settings.roam && S.hunting && !S.dungeon;
    if (tmpRoam) S.settings.roam = true;
    let r; try { r = catch0(S, seconds); } finally { if (tmpRoam) S.settings.roam = false; }
    if (!r) return r;
    const out = [];
    if (tmpRoam && r.roamed && r.roamed.length) out.push(`Itinérance pendant l'absence : ${r.roamed.length} changement${r.roamed.length > 1 ? "s" : ""} de zone.`);
    if (C.back && from && S.sub !== from && !(S.tresor && S.tresor.cur && S.tresor.cur.follow) && SUBS[from] && !S.dungeon && E.subUnlocked(S, from)) { E.startHunt(S, from); out.push(`Retour à ta zone : ${SUBS[from].name}.`); }
    if (C.cap > 0) { // limite de banque : le surplus gagné pendant l'absence part au marchand de secours (sauf favoris, clés et ressources réservées)
      const keep = new Set([...E.cmdNeeds(S), ...(E.almanax ? [E.almanax(S).res] : [])]);
      // 1.0.30 : compte connecté, le surplus est vendu au prix de la vente directe (js/venteui.js lit S.venteQ, E.venteSurplus)
      const vd = !!(E.venteDirect && E.venteDirect(S) && E.venteFix); if (vd) E.venteFix(S);
      let n = 0, k0 = S.kamas;
      Object.keys(r.res || {}).forEach((name) => {
        if (keep.has(name) || (S.resFav && S.resFav[name]) || E.isKey(name) || (S.resCap && S.resCap[name] !== undefined) || !E.resPrice(name)) return;
        const ex = (S.res[name] || 0) - C.cap; if (ex <= 0) return;
        if (vd && E.venteOk(name)) S.venteQ[name] = C.cap; else E.merchantRes(S, name, ex);
        n += ex;
      });
      const dk = S.kamas - k0;
      if (n && vd) out.push(`Limite de banque : ${fmtK(n)} ressources en trop, vendues dans quelques minutes au prix de la vente directe${dk > 0 ? ` (+${fmtK(dk)} kamas au marchand de secours)` : ""}.`);
      else if (n) out.push(`Limite de banque : ${fmtK(n)} ressources en trop vendues au marchand de secours (+${fmtK(dk)} kamas).`);
    }
    if (C.alm && E.almanaxOffer) { const A = E.almanax(S); if (!A.done && (S.res[A.res] || 0) >= A.qty) { if (!E.almanaxOffer(S)) out.push(`Offrande à l'Almanax faite : ${A.bonus.txt}.`); } }
    if (C.cmd) { const Cm = E.cmdState(S); let nd = 0;
      Cm.list.forEach((o) => { if (o.got < o.n && (S.res[o.res] || 0) >= o.n - o.got && !E.cmdDeliver(S, o.id)) nd++; });
      if (nd) out.push(`${nd} commande${nd > 1 ? "s" : ""} d'artisan livrée${nd > 1 ? "s" : ""}.`); }
    r.consigne = out; return r;
  };

  /* ======================= actions, succès, ornements, recherche ======================= */
  Object.assign(E.ACTIONS, { cmdDeliver: "livrer une commande d'artisan", cmdSwap: "changer une commande d'artisan", templeFight: "défier un Dopeul", templeCancel: "annuler le défi du Dopeul", consigneSet: "régler une consigne d'absence" });
  if (E.carnetCat) E.carnetCat({ cmdDeliver: "commande", cmdSwap: "quete", buyShop: "boutique" });
  if (E.carnetWrap) E.carnetWrap();
  if (E.ACH) {
    const has = (id) => E.ACH.some((a) => a.id === id); const addA = (o) => { if (!has(o.id)) E.ACH.push(o); };
    addA({ id: "cmd1", cat: "Métiers", name: "Premier client", desc: "Livrer une commande d'artisan.", test: (S) => (S.cmd && S.cmd.n || 0) >= 1, kamas: 1500 });
    addA({ id: "cmd25", cat: "Métiers", name: E.CMD_TITLE, desc: "Livrer 25 commandes d'artisans.", test: (S) => (S.cmd && S.cmd.n || 0) >= 25, kamas: 20000, title: E.CMD_TITLE });
    addA({ id: "cmd100", cat: "Métiers", name: "Tablier d'artisan", desc: "Livrer 100 commandes d'artisans (ornement « Tablier d'artisan »).", test: (S) => (S.cmd && S.cmd.n || 0) >= 100, kamas: 80000 });
    addA({ id: "dop1", cat: "Combat", name: "Face à son reflet", desc: "Vaincre un Dopeul dans son temple.", test: (S) => (S.temple && S.temple.n || 0) >= 1, kamas: 3000 });
    addA({ id: "dop50", cat: "Combat", name: "Habitué des temples", desc: "Vaincre 50 Dopeuls.", test: (S) => (S.temple && S.temple.n || 0) >= 50, kamas: 40000 });
  }
  if (E.ORN) {
    if (!E.ORN.tablier) E.ORN.tablier = { name: () => "Tablier d'artisan", req: "Livrer 100 commandes d'artisans", ok: (S) => (S.cmd && S.cmd.n || 0) >= 100 };
    if (!E.ORN.dopeul) E.ORN.dopeul = { name: () => "Reflet du temple", req: "Comptoir des temples (50 Doplons)", ok: (S) => !!(S.unlocks && S.unlocks.dopeul) };
  }
  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "commandes")) E.SEARCH_PAGES.push(["commandes", "Commandes d'artisans", "Journal › Quêtes › Commandes : livrer des ressources"], ["temples", "Temples et Dopeuls", "Journal › Quêtes › Temples : Doplons"], ["consignes", "Consignes d'absence", "Options : ce que fait l'équipe pendant ton absence"]);

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
