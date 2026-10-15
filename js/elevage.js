/* ============================================================================
   ÉLEVAGE (refonte de la 1.1) — Idlus
   Choix de Mathis (séries 1 à 3) : étoiles ★1-5 et capacités DOFUS (1A), éleveur automatique avec objectif et
   journal (2A, 3 couples de base, 4e en kamas), Essence en relâchant (3A), ascendance : les lignées pures donnent
   plus souvent la nouvelle couleur (4A), page « Élevage » (5A), récompenses du carnet (6A), pas de sexes (7A),
   objets d'élevage achetés en kamas + Essence qui s'usent (8A), 3 commandes par jour (9A), naissances
   exceptionnelles annoncées dans le chat (10A, supabase/elevage.sql), classement Élevage (12A), balades (13A),
   chromatiques 1 sur 150 (14A), filtres et relâcher en masse (15A), noms et famille (17A), places en kamas (18A).
   Série 4 : résumé « Pendant ton absence » (19A), quête « Apprenti éleveur » (22A), 10 succès d'élevage (23A),
   jours Almanax « Efficacité des enclos » = évènement d'élevage (24A). Pas de planificateur (20B), pas de don (21B).

   Champs ajoutés à une monture (js/mounts.js) : st (étoiles), cap (capacité), chr (chromatique), nm (nom),
   pc (couleurs des parents), gc (couleurs des grands-parents), pol (jour du dernier polissage d'étoile).
   État du compte : S.elev = { ess, inv, slots, auto, log, ord, bal, buy, c4, rare, chrSeen, done, n }.
   Les couples restent dans S.enclos.pairs (p.s = emplacement, p.T = durée totale).
   Les étoiles ne touchent que la stat de la couleur (PA, PM et Invocation jamais) : simulation 1.1, aucune
   différence de stasis même à ★7 Endurante (scratch/sim_qualite). Pas de DOM ici (aussi chargé par le serveur).
   ============================================================================ */
(function (root) {
  "use strict";
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  if (!E || !E.MOUNTS) { if (typeof module !== "undefined" && module.exports) module.exports = E; return; }
  const MOUNTS = E.MOUNTS;
  const rnd = () => E.rnd();
  const note = (S, t, k) => E.note(S, t, k);
  const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
  const day = () => (E.dayKey ? E.dayKey() : new Date(E.now()).toISOString().slice(0, 10));
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; };
  const fem = (sp) => (sp === "dd" ? "e" : "");

  /* ---------- réglages ---------- */
  E.ST_BASE = 5;                 // étoiles au plus (+1 espèce complète au carnet, +1 chromatique)
  E.ST_STEP = 0.125;             // +12,5 % de la stat de couleur par étoile au-dessus de la première
  E.ST_UP = 30; E.ST_DOWN = 10;  // % : une étoile de plus / de moins que la moyenne des parents
  E.CAP_PCT = 20;                // % : une capacité à la naissance
  E.CHR_ODDS = 150;              // une naissance chromatique sur 150
  E.PAIRS_BASE = 3; E.PAIR4_COST = 5000000;
  E.BREED_PRE = 20;              // Précoce : élevage dès le niveau 20
  E.BIRTH_MIN = 2 * 3600e3;
  E.ESS_LVL = 100;               // Essence pour un niveau
  E.ESS_STAR = 2000;             // Essence pour polir une étoile (une fois par jour et par monture)
  E.STABLE_BUY = 5; E.STABLE_BUY_COST = 1000000; E.STABLE_MAXCAP = 50; E.STABLE_CARNET = 5;
  E.ITEM_USES = 20;              // naissances par objet d'élevage
  E.BAL_MAX = 2; E.BAL_LVL = 50;
  E.ORD_N = 3; E.ORD_LVL = 50;
  E.LOG_N = 30;
  E.CAPS = {
    pre:   { name: "Précoce",       txt: `peut se reproduire dès le niveau ${20}` },
    sage:  { name: "Sage",          txt: "gagne 50 % d'XP en plus" },
    repro: { name: "Reproductrice", txt: "peut avoir 2 petits de plus" },
    pred:  { name: "Prédisposée",   txt: "+10 % de chance de nouvelle couleur quand elle est parent" },
    endu:  { name: "Endurante",     txt: "+20 % à la stat de sa couleur" },
    infa:  { name: "Infatigable",   txt: "naissance 25 % plus rapide quand elle est parent" },
  };
  E.CAP_ORDER = ["pre", "sage", "repro", "pred", "endu", "infa"];
  /* 8A : objets d'élevage, 5 niveaux, achetés en kamas + Essence, usés après 20 naissances sur leur emplacement */
  E.ELV_ITEMS = {
    baf: { name: "Baffeur",    v: [5, 7.5, 10, 12.5, 15],  txt: (v) => `+${String(v).replace(".", ",")} % de chance d'étoile en plus` },
    car: { name: "Caresseur",  v: [4, 6, 8, 10, 12],       txt: (v) => `+${v} % de chance de capacité` },
    fou: { name: "Foudroyeur", v: [10, 15, 20, 25, 30],    txt: (v) => `naissance ${v} % plus rapide` },
    dra: { name: "Dragofesse", v: [2, 3, 4, 5, 6],         txt: (v) => `+${v} % de chance de nouvelle couleur` },
  };
  E.ELV_ORDER = ["baf", "car", "fou", "dra"];
  E.ELV_KAMAS = [50000, 120000, 300000, 700000, 1500000];
  E.ELV_ESS = [100, 250, 600, 1200, 2500];
  E.ROMAN5 = ["I", "II", "III", "IV", "V"];
  E.SP_TITLE = { dd: "Éleveur de dragodindes", mu: "Éleveur de muldos", vk: "Éleveur de volkornes" };
  E.GRAND_TITLE = "Grand Éleveur";

  /* ---------- état ---------- */
  E.elevState = (S) => {
    const v = S.elev || (S.elev = {});
    if (typeof v.ess !== "number") v.ess = 0;
    if (!Array.isArray(v.inv)) v.inv = [];
    if (!Array.isArray(v.slots)) v.slots = [];
    if (!v.auto || typeof v.auto !== "object") v.auto = { on: false, goal: "carnet" };
    if (!Array.isArray(v.log)) v.log = [];
    if (!v.ord || typeof v.ord !== "object") v.ord = { day: "", done: [] };
    if (!Array.isArray(v.bal)) v.bal = [];
    if (!v.buy) v.buy = 0;
    if (!Array.isArray(v.rare)) v.rare = [];
    if (!v.chrSeen) v.chrSeen = {};
    if (!v.done) v.done = {};
    if (!v.n) v.n = { births: 0, chr: 0, ord: 0, bal: 0, rel: 0 };
    if (S.enclos) { if (!Array.isArray(S.enclos.pairs)) S.enclos.pairs = []; S.enclos.pairs.forEach((p, i) => { if (p.s == null) p.s = i; if (!p.T) p.T = Math.max(p.t || 0, E.BIRTH_MS); }); }
    for (const uid in S.mounts || {}) { const M = S.mounts[uid]; if (!M.st) M.st = 1; }
    while (v.slots.length < E.pairCap(S)) v.slots.push({});
    if ((v.q || 0) < 6 && E.ELQ) questTick(S);
    return v;
  };
  const EV = (S) => (S.elev && S.elev.log ? S.elev : E.elevState(S));
  const log = (S, txt) => { const L = EV(S).log; L.unshift({ t: E.now(), txt }); if (L.length > E.LOG_N) L.length = E.LOG_N; };
  E.elevLog = log;

  /* ---------- carnet (6A) ---------- */
  E.spColours = (sp) => Object.keys(MOUNTS[sp].cols);
  E.spSeen = (S, sp) => E.spColours(sp).filter((c) => S.mountSeen[sp] && S.mountSeen[sp][c]).length;
  E.spDone = (S, sp) => E.spSeen(S, sp) >= E.spColours(sp).length;
  E.spDoneN = (S) => E.MOUNT_ORDER.filter((sp) => E.spDone(S, sp)).length;
  E.grandEleveur = (S) => E.spDoneN(S) >= E.MOUNT_ORDER.length;
  const checkCarnet = (S, sp) => {
    const v = EV(S); if (v.done[sp] || !E.spDone(S, sp)) return;
    v.done[sp] = 1; S.titlesExtra = S.titlesExtra || [];
    const t = E.SP_TITLE[sp]; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t);
    note(S, `Carnet des ${MOUNTS[sp].name.toLowerCase()}s complet ! Titre « ${t} », +${E.STABLE_CARNET} places à l'écurie et une 6e étoile possible pour cette espèce.`, "rare");
    log(S, `Carnet des ${MOUNTS[sp].name.toLowerCase()}s complet : titre « ${t} »`);
    if (E.grandEleveur(S) && !S.titlesExtra.includes(E.GRAND_TITLE)) {
      S.titlesExtra.push(E.GRAND_TITLE);
      note(S, `Les trois carnets sont complets : titre « ${E.GRAND_TITLE} » et un 4e couple à l'enclos !`, "rare");
      log(S, `Grand Éleveur : 4e couple débloqué`);
    }
    E.celebrate({ t: "elevcarnet", sp });
  };
  E.elevCheckCarnet = checkCarnet;

  /* ---------- étoiles et stats (1A) ---------- */
  E.starCap = (S, M) => E.ST_BASE + (S && E.spDone(S, M.sp) ? 1 : 0) + (M.chr ? 1 : 0);
  E.starMult = (M) => 1 + E.ST_STEP * (Math.max(1, M.st || 1) - 1) + (M.cap === "endu" ? 0.2 : 0);
  const WHOLE = ["pa", "pm", "inv"];
  const isBico = (c) => c.includes("|");
  /* bonus au niveau 100 : base de l'espèce + stat de la couleur, multipliée par les étoiles (et Endurante) */
  E.mountStatsMax = (sp, c, M) => {
    const Sp = MOUNTS[sp]; const o = Object.assign({}, Sp.base); const f = M ? E.starMult(M) : 1;
    const add = (s, w) => { for (const k in s) o[k] = (o[k] || 0) + (WHOLE.includes(k) ? Math.round(s[k] * w) : Math.round(s[k] * w * f)); };
    if (isBico(c)) c.split("|").forEach((x) => add(Sp.cols[x].s, 2 / 3)); else add(Sp.cols[c].s, 1);
    return o;
  };
  E.mountStatsAt = (M) => {
    const mx = E.mountStatsMax(M.sp, M.c, M); const o = {};
    for (const k in mx) o[k] = WHOLE.includes(k) ? (M.lvl >= E.MOUNT_MAX ? mx[k] : 0) : Math.max(1, Math.round(mx[k] * Math.min(E.MOUNT_MAX, M.lvl) / E.MOUNT_MAX));
    return o;
  };
  E.mountName = (M) => `${MOUNTS[M.sp].name} ${E.colourName(M.sp, M.c)}${M.chr ? " chromatique" : ""}`;
  E.mountLabel = (M) => (M.nm ? `« ${M.nm} »` : E.mountName(M));
  E.capName = (k) => (E.CAPS[k] ? E.CAPS[k].name : "");

  /* ---------- écurie (18A, 6A) ---------- */
  E.stableCap = (S) => Math.min(E.STABLE_MAXCAP + 1, E.STABLE + ((S.elev && S.elev.qPlace) || 0) + (S.enclos && S.enclos.built ? E.STABLE_ENCLOS : 0) + E.STABLE_CARNET * E.spDoneN(S) + E.STABLE_BUY * ((S.elev && S.elev.buy) || 0));
  E.stableBuyCost = (S) => E.STABLE_BUY_COST * Math.pow(2, (S.elev && S.elev.buy) || 0);
  E.stableBuy = (S) => {
    const v = EV(S); if (E.stableCap(S) + E.STABLE_BUY > E.STABLE_MAXCAP) return `L'écurie a déjà ${E.STABLE_MAXCAP} places au plus.`;
    const c = E.stableBuyCost(S); if (S.kamas < c) return `Il faut ${fmt(c)} kamas.`;
    S.kamas -= c; v.buy++; note(S, `L'écurie gagne ${E.STABLE_BUY} places (${E.stableCap(S)} en tout).`, "up"); return null;
  };
  E.onBalade = (S, uid) => !!(S.elev && S.elev.bal.some((b) => b.uid === uid));
  E.mountBusy = (S, M) => (E.mountOwner(S, M.uid) ? "montée" : E.inPair(S, M.uid) ? "à l'enclos" : E.onBalade(S, M.uid) ? "en balade" : null);

  /* ---------- naissance d'une monture (capture, enclos, commande…) ---------- */
  E.giveMount = (S, sp, c, why, opts = {}) => {
    if (!MOUNTS[sp] || !(isBico(c) ? MOUNTS[sp].bico[c] : MOUNTS[sp].cols[c])) return null;
    if (E.stableN(S) >= E.stableCap(S)) { if (!opts.quiet) note(S, `Écurie pleine (${E.stableCap(S)} places) : ${MOUNTS[sp].name} ${E.colourName(sp, c)} relâché${fem(sp)}.`, "warn"); return null; }
    const uid = S.mountUid++; const M = S.mounts[uid] = { uid, sp, c, lvl: 1, xp: 0, kids: 0, got: E.now(), st: 1 };
    if (opts.st) M.st = opts.st; if (opts.cap) M.cap = opts.cap; if (opts.chr) M.chr = 1; if (opts.pc) M.pc = opts.pc; if (opts.gc) M.gc = opts.gc;
    const neu = !(S.mountSeen[sp] && S.mountSeen[sp][c]); E.seeColour(S, sp, c);
    if (M.chr) { const v = EV(S); (v.chrSeen[sp] = v.chrSeen[sp] || {})[E.mainColour(c)] = 1; v.n.chr++; }
    noteStar(S, M);
    if (!isBico(c) && E.gen(sp, c) >= 3 && Array.isArray(M.pc) && Array.isArray(M.gc) && M.pc.concat(M.gc).every((x) => x === E.mainColour(c))) EV(S).n.pure = (EV(S).n.pure || 0) + 1;
    const extra = [M.st > 1 ? "★".repeat(M.st) : "", M.cap ? E.capName(M.cap) : ""].filter(Boolean).join(", ");
    note(S, `${neu ? "Nouvelle couleur : " : "Monture : "}${E.mountName(M)}${extra ? ` (${extra})` : ""}${why ? " (" + why + ")" : ""} !`, "rare");
    E.celebrate({ t: "mount", uid, neu });
    if (neu && !isBico(c)) checkCarnet(S, sp);
    return M;
  };

  /* ---------- XP : Sage (+50 %) ---------- */
  const gx0 = E.giveMountXp;
  E.giveMountXp = (S, M, g) => gx0(S, M, M && M.cap === "sage" && g > 0 ? Math.round(g * 1.5) : g);

  /* ---------- couples ---------- */
  E.pairCap = (S) => E.PAIRS_BASE + (S.elev && (S.elev.c4 || E.grandEleveur(S)) ? 1 : 0);
  E.pair4Buy = (S) => {
    const v = EV(S); if (v.c4 || E.grandEleveur(S)) return "Le 4e couple est déjà là.";
    if (S.kamas < E.PAIR4_COST) return `Il faut ${fmt(E.PAIR4_COST)} kamas.`;
    S.kamas -= E.PAIR4_COST; v.c4 = 1; E.elevState(S); note(S, "L'enclos accueille un 4e couple.", "up"); return null;
  };
  E.kidsCap = (S, M) => E.KIDS + (E.furnBonus ? E.furnBonus(S, "kids") : 0) + (M && M.cap === "repro" ? 2 : 0);
  E.breedLvl = (M) => (M && M.cap === "pre" ? E.BREED_PRE : E.BREED_LVL);
  E.breedWhy = (S, M) => (M.lvl < E.breedLvl(M) ? `niveau ${E.breedLvl(M)} requis` : M.kids >= E.kidsCap(S, M) ? "a eu tous ses petits" : E.inPair(S, M.uid) ? "déjà à l'enclos" : E.onBalade(S, M.uid) ? "en balade" : null);
  const slotOf = (S, i) => (EV(S).slots[i] || (EV(S).slots[i] = {}));
  const itemV = (S, si, k) => { const it = si == null ? null : slotOf(S, si)[k]; return it ? E.ELV_ITEMS[k].v[it.t] : 0; };
  E.slotItemV = itemV;
  E.freeSlot = (S) => { for (let i = 0; i < E.pairCap(S); i++) if (!S.enclos.pairs.some((p) => p.s === i)) return i; return -1; };
  /* 4A : pureté = parents de la même couleur que la monture (capture ou monture d'avant la refonte : pure) */
  E.purity = (M) => (Array.isArray(M.pc) ? M.pc.filter((x) => x === E.mainColour(M.c)).length : 2);
  E.birthMs = (S, A, B, si) => {
    let ms = E.furnBonus && E.furnBonus(S, "birth") ? E.BIRTH_FAST_MS : E.BIRTH_MS;
    if ((A && A.cap === "infa") || (B && B.cap === "infa")) ms *= 0.75;
    ms *= 1 - itemV(S, si, "fou") / 100;
    return Math.max(E.BIRTH_MIN, Math.round(ms));
  };
  /* chances de couleur : [couleur, %, nouvelle couleur ?] */
  E.newColourPct = (S, A, B, si) => Math.min(60, 20 + 5 * (E.purity(A) + E.purity(B)) + (A.cap === "pred" ? 10 : 0) + (B.cap === "pred" ? 10 : 0) + itemV(S, si, "dra"));
  E.breedOdds = (S, A, B, si) => {
    const a = E.mainColour(A.c), b = E.mainColour(B.c); const child = E.childOf(A.sp, A.c, B.c); const bk = E.bicoKey(A.sp, a, b);
    const list = [];
    if (child) {
      const n = E.newColourPct(S, A, B, si); const bi = bk && a !== b ? 5 : 0; const rest = 100 - n - bi;
      list.push([child, n, true], [a, rest / 2], [b, rest / 2]); if (bi) list.push([bk, bi]);
    } else {
      const o = E.ODDS.free; list.push([a, o[1]], [b, o[2]]);
      if (bk && a !== b) list.push([bk, o[3]]); else list[list.length - 1][1] += o[3];
    }
    return list;
  };
  E.starUpPct = (S, si) => E.ST_UP + itemV(S, si, "baf") + (E.elevAlm(S) ? E.ALM_STAR : 0);
  E.capPct = (S, si) => E.CAP_PCT + itemV(S, si, "car");
  E.breedInfo = (S, A, B, si) => ({ odds: E.breedOdds(S, A, B, si), st: Math.round(((A.st || 1) + (B.st || 1)) / 2), up: E.starUpPct(S, si), down: E.ST_DOWN, cap: E.capPct(S, si), ms: E.birthMs(S, A, B, si) });
  E.startBreed = (S, ua, ub, why) => {
    if (!S.enclos.built) return "Construisez d'abord l'enclos.";
    const A = S.mounts[ua], B = S.mounts[ub]; if (!A || !B || A === B) return "Choisissez deux montures.";
    if (A.sp !== B.sp) return "Les deux montures doivent être de la même espèce.";
    const si = E.freeSlot(S); if (si < 0) return "L'enclos est occupé : attendez une naissance.";
    for (const M of [A, B]) { const w = E.breedWhy(S, M); if (w) return `${E.mountName(M)} : ${w}.`; }
    E.elevState(S); const T = E.birthMs(S, A, B, si);
    S.enclos.pairs.push({ a: ua, b: ub, t: T, T, s: si });
    const txt = `${E.mountName(A)} et ${E.mountName(B)} sont à l'enclos : naissance dans ${E.etaTxt ? E.etaTxt(Math.ceil(T / 1000)) : Math.round(T / 3600e3) + " h"}.`;
    if (why === "auto") log(S, `Éleveur : ${E.colourName(A.sp, A.c)} + ${E.colourName(B.sp, B.c)} lancés à l'enclos`); else note(S, txt, "info");
    return null;
  };
  E.stopBreed = (S, i) => { const p = S.enclos.pairs[i]; if (!p) return "Couple introuvable."; S.enclos.pairs.splice(i, 1); return null; };

  /* ---------- naissance ---------- */
  const pick = (odds) => { let r = rnd() * 100; let c = odds[odds.length - 1][0]; for (const [col, pc] of odds) { if (r < pc) return col; r -= pc; } return c; };
  const wear = (S, si) => {
    const sl = slotOf(S, si);
    for (const k of E.ELV_ORDER) { const it = sl[k]; if (!it) continue; it.n--; if (it.n <= 0) { delete sl[k]; const nm = `${E.ELV_ITEMS[k].name} ${E.ROMAN5[it.t]}`; note(S, `${nm} est usé (couple ${si + 1}).`, "warn"); log(S, `${nm} usé sur le couple ${si + 1}`); EV(S).worn = (EV(S).worn || 0) + 1; } }
  };
  const birth = (S, p) => {
    const A = S.mounts[p.a], B = S.mounts[p.b]; if (!A || !B) return true; // monture disparue : couple annulé
    if (E.stableN(S) >= E.stableCap(S)) { if (!p.wait) { p.wait = true; note(S, "Un petit attend à l'enclos : l'écurie est pleine. Relâchez une monture pour lui faire de la place.", "warn"); log(S, "Un petit attend : écurie pleine"); } return false; }
    const si = p.s; const odds = E.breedOdds(S, A, B, si); const c = pick(odds);
    const chr = rnd() < 1 / E.CHR_ODDS;
    const proto = { sp: A.sp, c, chr };
    let st = Math.round(((A.st || 1) + (B.st || 1)) / 2); const r = rnd() * 100;
    if (r < E.starUpPct(S, si)) st++; else if (r < E.starUpPct(S, si) + E.ST_DOWN) st--;
    st = Math.max(1, Math.min(E.starCap(S, proto), st));
    const cap = rnd() * 100 < E.capPct(S, si) ? E.CAP_ORDER[Math.floor(rnd() * E.CAP_ORDER.length)] : null;
    const pc = [E.mainColour(A.c), E.mainColour(B.c)];
    const gc = [].concat(A.pc || [E.mainColour(A.c), E.mainColour(A.c)], B.pc || [E.mainColour(B.c), E.mainColour(B.c)]).slice(0, 4);
    A.kids++; B.kids++; S.enclos.births = (S.enclos.births || 0) + 1; EV(S).n.births++;
    const neu = !(S.mountSeen[A.sp] && S.mountSeen[A.sp][c]);
    const M = E.giveMount(S, A.sp, c, `né${fem(A.sp)} à l'enclos, ${E.colourName(A.sp, A.c)} + ${E.colourName(B.sp, B.c)}`, { st, cap, chr, pc, gc });
    wear(S, si); elevCheck(S);
    if (M) {
      log(S, `Naissance : ${E.mountName(M)} ${"★".repeat(M.st)}${M.cap ? `, ${E.capName(M.cap)}` : ""}${neu ? " (nouvelle couleur)" : ""}`);
      /* 10A : naissance exceptionnelle (dernière génération jamais vue, ★5 ou plus, chromatique) : fête et annonce dans le chat */
      const gmax = Math.max(...Object.values(MOUNTS[A.sp].cols).map((x) => x.g));
      const kind = M.chr ? "chr" : M.st >= 5 ? "st" : neu && !isBico(c) && E.gen(A.sp, c) === gmax ? "gen" : null;
      if (kind) {
        const v = EV(S); const key = kind === "st" ? `st:${A.sp}:${E.mainColour(c)}:${M.st}` : `${kind}:${A.sp}:${E.mainColour(c)}`;
        if (!v.rare.includes(key)) { v.rare.push(key); if (v.rare.length > 20) v.rare.shift(); }
        E.celebrate({ t: "elevrare", uid: M.uid, kind });
      }
    }
    return true;
  };
  E.elevBirth = birth;

  /* ---------- objets d'élevage (8A) ---------- */
  E.elvPrice = (S, k, t) => { const f = E.elevAlm(S) ? 1 - E.ALM_ITEMS / 100 : 1; return { k: Math.round(E.ELV_KAMAS[t] * f), e: Math.round(E.ELV_ESS[t] * f) }; };
  E.elvBuy = (S, k, t) => {
    const v = EV(S); t = t | 0; if (!E.ELV_ITEMS[k] || t < 0 || t > 4) return "Objet inconnu.";
    const P = E.elvPrice(S, k, t);
    if (S.kamas < P.k) return `Il faut ${fmt(P.k)} kamas.`;
    if (v.ess < P.e) return `Il faut ${fmt(P.e)} Essence.`;
    S.kamas -= P.k; v.ess -= P.e; v.inv.push({ k, t, n: E.ITEM_USES });
    note(S, `${E.ELV_ITEMS[k].name} ${E.ROMAN5[t]} acheté : ${E.ELV_ITEMS[k].txt(E.ELV_ITEMS[k].v[t])}, pendant ${E.ITEM_USES} naissances.`, "info");
    return null;
  };
  /* poser un objet du sac sur un emplacement (l'objet déjà posé du même type revient au sac, avec ses naissances restantes) */
  E.elvEquip = (S, si, idx) => {
    const v = EV(S); const it = v.inv[idx]; if (!it) return "Objet introuvable."; if (si < 0 || si >= E.pairCap(S)) return "Emplacement inconnu.";
    const sl = slotOf(S, si); if (sl[it.k]) v.inv.push(sl[it.k]); sl[it.k] = it; v.inv.splice(idx, 1); return null;
  };
  E.elvUnequip = (S, si, k) => { const v = EV(S); const sl = slotOf(S, si); if (!sl[k]) return "Rien à retirer."; v.inv.push(sl[k]); delete sl[k]; return null; };
  /* le meilleur objet du sac de chaque type sur chaque emplacement vide (éleveur automatique, bouton « Équiper au mieux ») */
  E.elvAutoEquip = (S, si) => {
    const v = EV(S); let n = 0; const list = si == null ? [...Array(E.pairCap(S)).keys()] : [si];
    for (const i of list) { const sl = slotOf(S, i); for (const k of E.ELV_ORDER) { if (sl[k]) continue;
      let best = -1; v.inv.forEach((it, j) => { if (it.k === k && (best < 0 || it.t > v.inv[best].t || (it.t === v.inv[best].t && it.n < v.inv[best].n))) best = j; });
      if (best >= 0) { sl[k] = v.inv[best]; v.inv.splice(best, 1); n++; } } }
    return n;
  };

  /* ---------- Essence (3A) ---------- */
  E.releaseEss = (M) => Math.max(1, (M.lvl || 1) * (M.st || 1));
  E.releaseMount = (S, uid) => {
    const M = S.mounts && S.mounts[uid]; if (!M) return "Monture introuvable.";
    if (E.inPair(S, M.uid)) return "Elle est à l'enclos : annulez d'abord le couple.";
    if (E.onBalade(S, M.uid)) return "Elle est en balade : attendez son retour.";
    const o = E.mountOwner(S, M.uid); if (o) { delete o.mount; E.refreshSpells(o, E.charStats(S, o)); }
    const ess = E.releaseEss(M); EV(S).ess += ess; EV(S).n.rel++;
    delete S.mounts[uid]; S.stats.released = (S.stats.released || 0) + 1;
    note(S, `${E.mountName(M)} (niveau ${M.lvl}) est relâché${fem(M.sp)} : +${fmt(ess)} Essence, une place se libère à l'écurie.`, "info");
    if (o) E.emit(S, "equip", {});
    return null;
  };
  /* 15A : relâcher en masse les montures faibles (★1-2, sans capacité, ni chromatiques, ni occupées) ; garde la meilleure de chaque couleur */
  E.massReleaseList = (S, maxSt = 2) => {
    const all = Object.values(S.mounts || {});
    const keep = new Set(); const best = {};
    for (const M of all) { const k = M.sp + ":" + M.c; const b = best[k]; if (!b || (M.st || 1) > (b.st || 1) || ((M.st || 1) === (b.st || 1) && M.lvl > b.lvl)) best[k] = M; }
    for (const k in best) keep.add(best[k].uid);
    return all.filter((M) => !keep.has(M.uid) && (M.st || 1) <= maxSt && !M.cap && !M.chr && !M.nm && !E.mountBusy(S, M));
  };
  E.massRelease = (S, maxSt = 2) => {
    const L = E.massReleaseList(S, maxSt); if (!L.length) return "Aucune monture à relâcher.";
    let ess = 0; for (const M of L) { ess += E.releaseEss(M); delete S.mounts[M.uid]; }
    const v = EV(S); v.ess += ess; v.n.rel += L.length; S.stats.released = (S.stats.released || 0) + L.length;
    note(S, `${L.length} monture${L.length > 1 ? "s relâchées" : " relâchée"} : +${fmt(ess)} Essence.`, "info");
    return null;
  };
  E.feedMount = (S, uid, n = 1) => {
    const v = EV(S); const M = S.mounts[uid]; if (!M) return "Monture introuvable."; n = Math.max(1, n | 0);
    n = Math.min(n, E.MOUNT_MAX - M.lvl); if (n <= 0) return "Elle est déjà au niveau maximum.";
    const c = n * E.ESS_LVL; if (v.ess < c) return `Il faut ${fmt(c)} Essence.`;
    v.ess -= c; M.lvl += n; M.xp = 0;
    const o = E.mountOwner(S, M.uid); if (o) { if (M.lvl >= E.MOUNT_MAX) o.mountShare = 0; E.refreshSpells(o, E.charStats(S, o)); E.emit(S, "equip", {}); }
    return null;
  };
  E.polishMount = (S, uid) => {
    const v = EV(S); const M = S.mounts[uid]; if (!M) return "Monture introuvable.";
    if ((M.st || 1) >= E.starCap(S, M)) return `Déjà ${E.starCap(S, M)} étoiles, le maximum.`;
    if (M.pol === day()) return "Une étoile par jour et par monture : revenez demain.";
    if (v.ess < E.ESS_STAR) return `Il faut ${fmt(E.ESS_STAR)} Essence.`;
    v.ess -= E.ESS_STAR; M.st = (M.st || 1) + 1; M.pol = day(); noteStar(S, M); elevCheck(S);
    const o = E.mountOwner(S, M.uid); if (o) { E.refreshSpells(o, E.charStats(S, o)); E.emit(S, "equip", {}); }
    note(S, `${E.mountName(M)} gagne une étoile : ${"★".repeat(M.st)}.`, "up");
    return null;
  };
  /* 17A : nom (20 caractères au plus, vide = nom de la couleur) */
  E.renameMount = (S, uid, nm) => {
    const M = S.mounts[uid]; if (!M) return "Monture introuvable.";
    nm = String(nm || "").replace(/[<>"&\u0000-\u001f]/g, "").trim().slice(0, 20);
    if (nm) M.nm = nm; else delete M.nm; return null;
  };

  /* ---------- éleveur automatique (2A) ---------- */
  const free = (S, M) => !E.mountOwner(S, M.uid) && !E.breedWhy(S, M);
  const rank = (M) => E.purity(M) * 1000 + (M.st || 1) * 100 + M.lvl;
  const bestOf = (S, sp, col, not) => Object.values(S.mounts).filter((M) => M.sp === sp && E.mainColour(M.c) === col && M.uid !== not && free(S, M)).sort((x, y) => (isBico(x.c) ? 1 : 0) - (isBico(y.c) ? 1 : 0) || rank(y) - rank(x))[0] || null;
  const owns = (S, sp, col) => Object.values(S.mounts).some((M) => M.sp === sp && E.mainColour(M.c) === col);
  /* le chemin vers une couleur : croisements à faire, du premier au dernier ([[parent, parent, enfant], …]) */
  E.colourPath = (S, sp, col, seen = {}) => {
    const C = MOUNTS[sp].cols[col]; if (!C || !C.p || seen[col]) return [];
    seen[col] = 1; let out = [];
    for (const x of C.p) if (!owns(S, sp, x)) out = out.concat(E.colourPath(S, sp, x, seen));
    out.push([C.p[0], C.p[1], col]); return out;
  };
  /* le croisement à lancer pour une couleur visée (ou null) */
  const towards = (S, sp, col, depth = 0) => {
    const C = MOUNTS[sp].cols[col]; if (!C || !C.p || depth > 6) return null;
    const [x, y] = C.p;
    for (const p of [x, y]) if (!owns(S, sp, p)) return towards(S, sp, p, depth + 1);
    const A = bestOf(S, sp, x), B = A && bestOf(S, sp, y, A.uid);
    return A && B ? [A, B] : null;
  };
  E.autoGoalTxt = (g) => {
    if (!g || g === "carnet") return "Compléter le carnet";
    const [k, sp, c] = String(g).split(":"); if (!MOUNTS[sp]) return "Compléter le carnet";
    return k === "col" ? `Obtenir : ${MOUNTS[sp].name} ${c}` : `Étoiles : ${MOUNTS[sp].name} ${c}`;
  };
  E.autoPick = (S) => {
    const g = EV(S).auto.goal || "carnet";
    if (g === "carnet") {
      for (const sp of E.MOUNT_ORDER) {
        const cols = MOUNTS[sp].cols; const L = Object.keys(cols).filter((c) => cols[c].p && !(S.mountSeen[sp] && S.mountSeen[sp][c])).sort((a, b) => cols[a].g - cols[b].g);
        for (const c of L) { const [x, y] = cols[c].p; if (!owns(S, sp, x) || !owns(S, sp, y)) continue; const A = bestOf(S, sp, x), B = A && bestOf(S, sp, y, A.uid); if (A && B) return [A, B]; }
      }
      return null;
    }
    const [k, sp, c] = g.split(":"); if (!MOUNTS[sp] || !MOUNTS[sp].cols[c]) return null;
    if (k === "col") return S.mountSeen[sp] && S.mountSeen[sp][c] ? null : towards(S, sp, c);
    /* étoiles : les deux meilleures de la couleur, tant qu'aucune n'a le maximum */
    const L = Object.values(S.mounts).filter((M) => M.sp === sp && M.c === c && free(S, M)).sort((x, y) => (y.st || 1) - (x.st || 1) || y.lvl - x.lvl);
    if (Object.values(S.mounts).some((M) => M.sp === sp && M.c === c && (M.st || 1) >= E.starCap(S, M))) return null;
    return L.length >= 2 ? [L[0], L[1]] : null;
  };
  E.autoDone = (S) => {
    const g = EV(S).auto.goal || "carnet";
    if (g === "carnet") return E.grandEleveur(S);
    const [k, sp, c] = g.split(":"); if (!MOUNTS[sp] || !MOUNTS[sp].cols[c]) return true;
    if (k === "col") return !!(S.mountSeen[sp] && S.mountSeen[sp][c]);
    return Object.values(S.mounts).some((M) => M.sp === sp && M.c === c && (M.st || 1) >= E.starCap(S, M));
  };
  E.setAuto = (S, on, goal) => {
    const v = EV(S); if (goal != null) v.auto.goal = String(goal).slice(0, 60);
    if (on != null) v.auto.on = !!on;
    if (v.auto.on) { v.autoT = 0; v.autoUsed = 1; elevCheck(S); log(S, `Éleveur automatique : ${E.autoGoalTxt(v.auto.goal)}`); }
    return null;
  };
  const autoTick = (S, ms) => {
    const v = S.elev; if (!v || !v.auto || !v.auto.on || !S.enclos.built) return;
    v.autoT = (v.autoT || 0) - ms; if (v.autoT > 0) return; v.autoT = 5000;
    if (E.autoDone(S)) { v.auto.on = false; log(S, `Objectif atteint : ${E.autoGoalTxt(v.auto.goal)}. L'éleveur s'arrête.`); note(S, `Éleveur automatique : objectif atteint (${E.autoGoalTxt(v.auto.goal)}).`, "rare"); return; }
    for (let k = 0; k < 4 && E.freeSlot(S) >= 0 && E.stableN(S) < E.stableCap(S); k++) {
      const P = E.autoPick(S); if (!P) { if (!v.idle) { v.idle = 1; log(S, "Éleveur : aucun croisement possible pour l'instant (niveaux, petits, montures occupées)"); } return; }
      v.idle = 0; const si = E.freeSlot(S); E.elvAutoEquip(S, si);
      if (E.startBreed(S, P[0].uid, P[1].uid, "auto")) return;
    }
  };

  /* ---------- balades (13A) ---------- */
  E.BAL = { 4: { ess: 60, res: [3, 6], net: 0 }, 8: { ess: 140, res: [4, 8], net: 1 / 20 } };
  E.baladeWhy = (S, M) => (M.lvl < E.BAL_LVL ? `niveau ${E.BAL_LVL} requis` : E.mountOwner(S, M.uid) ? "montée par un héros" : E.inPair(S, M.uid) ? "à l'enclos" : E.onBalade(S, M.uid) ? "déjà en balade" : null);
  E.baladeStart = (S, uid, h) => {
    const v = EV(S); const M = S.mounts[uid]; if (!M) return "Monture introuvable."; h = +h === 8 ? 8 : 4;
    if (v.bal.length >= E.BAL_MAX) return `${E.BAL_MAX} balades à la fois au plus.`;
    const w = E.baladeWhy(S, M); if (w) return `${E.mountName(M)} : ${w}.`;
    v.bal.push({ uid, h, t: h * 3600e3 }); return null;
  };
  E.baladeStop = (S, uid) => { const v = EV(S); const i = v.bal.findIndex((b) => b.uid === uid); if (i < 0) return "Pas en balade."; v.bal.splice(i, 1); return null; };
  const baladeEnd = (S, b) => {
    const M = S.mounts[b.uid]; if (!M) return;
    const R = E.BAL[b.h] || E.BAL[4]; const v = EV(S); const x2 = E.elevAlm(S) ? 2 : 1; v.ess += R.ess * x2; v.n.bal++;
    const sub = E.SUBS && E.SUBS[E.MOUNT_SP[M.sp].sub]; const got = {};
    const D = root.DATA || {};
    if (sub && D.MONSTERS) {
      const drops = []; (sub.monsters || []).forEach((m) => { const mo = D.MONSTERS[m]; if (mo && mo.drops) mo.drops.forEach(([r, p]) => { if (!(E.isKey && E.isKey(r))) drops.push([r, p]); }); });
      const tot = drops.reduce((a, d) => a + d[1], 0); const n = (R.res[0] + Math.floor(rnd() * (R.res[1] - R.res[0] + 1))) * x2;
      for (let i = 0; i < n && tot > 0; i++) { let x = rnd() * tot; for (const [r, p] of drops) { if (x < p) { got[r] = (got[r] || 0) + 1; break; } x -= p; } }
      for (const r in got) E.addRes(S, r, got[r]);
    }
    let net = false; if (R.net && rnd() < R.net) { E.addCons(S, "filet", 1); net = true; }
    const res = Object.entries(got).map(([r, q]) => `${q} × ${r}`).join(", ");
    elevCheck(S);
    log(S, `Balade finie : ${E.mountName(M)} rapporte ${R.ess * x2} Essence${res ? `, ${res}` : ""}${net ? " et un filet" : ""}`);
    note(S, `${E.mountName(M)} revient de balade : +${R.ess * x2} Essence${res ? `, ${res}` : ""}${net ? ", un filet de capture" : ""}.`, "info");
  };

  /* ---------- commandes (9A) ---------- */
  E.orders = (S) => {
    const v = EV(S); const d = day(); if (v.ord.day !== d) v.ord = { day: d, done: [] };
    const seed = String(S.created || 0) + d; const out = [];
    const pool = []; for (const sp of E.MOUNT_ORDER) for (const c of Object.keys(MOUNTS[sp].cols)) if (S.mountSeen[sp] && S.mountSeen[sp][c]) pool.push([sp, c]);
    if (!pool.length) return out;
    pool.sort((x, y) => hash(seed + x.join(":")) - hash(seed + y.join(":"))); // trois couleurs différentes quand c'est possible
    for (let i = 0; i < E.ORD_N; i++) {
      const [sp, c] = pool[i % pool.length];
      const g = MOUNTS[sp].cols[c].g; const st = 1 + Math.floor(hash(seed + "s" + i) * Math.min(4, 1 + Math.floor(g / 2) + (i === 2 ? 1 : 0)));
      const hard = st >= 3;
      out.push({ i, sp, c, st, lvl: E.ORD_LVL, kamas: Math.round(20000 * g * st * (hard ? 1.5 : 1) / 1000) * 1000, ess: 40 * g + 60 * st, nets: hard ? 3 : 0, done: v.ord.done.includes(i) });
    }
    return out;
  };
  E.orderFits = (S, o) => Object.values(S.mounts).filter((M) => M.sp === o.sp && M.c === o.c && (M.st || 1) >= o.st && M.lvl >= o.lvl && !E.mountBusy(S, M) && !M.chr).sort((x, y) => (x.st || 1) - (y.st || 1) || (x.cap ? 1 : 0) - (y.cap ? 1 : 0) || x.lvl - y.lvl);
  E.orderDeliver = (S, i, uid) => {
    const o = E.orders(S)[i]; if (!o) return "Commande introuvable."; if (o.done) return "Commande déjà livrée.";
    const L = E.orderFits(S, o); const M = uid != null ? L.find((x) => x.uid === +uid) : L[0];
    if (!M) return `Il faut ${MOUNTS[o.sp].name} ${o.c} ${"★".repeat(o.st)} niveau ${o.lvl}, libre.`;
    const v = EV(S); delete S.mounts[M.uid]; v.ord.done.push(i); v.n.ord++;
    S.kamas += o.kamas; v.ess += o.ess; if (o.nets) E.addCons(S, "filet", o.nets);
    note(S, `Commande livrée : ${E.mountName(M)}. +${fmt(o.kamas)} kamas, +${fmt(o.ess)} Essence${o.nets ? `, ${o.nets} filets` : ""}.`, "rare");
    log(S, `Commande livrée : ${E.mountName(M)}`); elevCheck(S); return null;
  };

  /* ---------- temps réel (ms), en jeu comme hors ligne ---------- */
  E.enclosTick = (S, ms) => {
    if (!S.enclos) return; const v = EV(S);
    if (S.enclos.pairs.length) {
      for (const p of S.enclos.pairs) p.t = Math.max(0, p.t - ms);
      S.enclos.pairs = S.enclos.pairs.filter((p) => p.t > 0 || !birth(S, p));
    }
    if (v.bal.length) {
      for (const b of v.bal) b.t = Math.max(0, b.t - ms);
      const done = v.bal.filter((b) => b.t <= 0); if (done.length) { v.bal = v.bal.filter((b) => b.t > 0); done.forEach((b) => baladeEnd(S, b)); }
    }
    autoTick(S, ms);
  };

  /* ---------- carnet : croisements à portée (nouvelles chances) ---------- */
  E.nextCrosses = (S, sp) => {
    const cols = MOUNTS[sp].cols; const seen = S.mountSeen[sp] || {}; const out = [];
    for (const c in cols) {
      const p = cols[c].p; if (!p || seen[c] || !owns(S, sp, p[0]) || !owns(S, sp, p[1])) continue;
      const A = bestOf(S, sp, p[0]), B = A && bestOf(S, sp, p[1], A.uid);
      out.push({ c, p, a: A, b: B, ok: !!(A && B && S.enclos.built && E.freeSlot(S) >= 0), pct: A && B ? E.newColourPct(S, A, B, E.freeSlot(S) >= 0 ? E.freeSlot(S) : null) : null });
    }
    return out;
  };

  /* ---------- classement et annonces (10A, 12A) ---------- */
  E.elevSummary = (S) => {
    let c = 0, chr = 0; for (const sp of E.MOUNT_ORDER) { c += E.spSeen(S, sp); chr += Object.keys((S.elev && S.elev.chrSeen && S.elev.chrSeen[sp]) || {}).length; }
    const s = Object.values(S.mounts || {}).reduce((a, M) => a + (M.st || 1), 0);
    return { c, s: Math.min(400, s), chr };
  };
  E.elevColoursTotal = () => E.MOUNT_ORDER.reduce((a, sp) => a + E.spColours(sp).length, 0);

  /* ---------- série 4 ---------- */
  /* 24A : les jours Almanax « Efficacité des enclos » sont des jours de l'élevage, pour tout le monde (l'offrande garde son ×1,5) */
  E.ALM_ITEMS = 30; E.ALM_STAR = 10;
  E.elevAlm = (S) => !!(E.almDay && E.almDay().kind === "enclos");
  E.elevAlmTxt = () => `Objets d'élevage −${E.ALM_ITEMS} %, balades ×2, +${E.ALM_STAR} % de chance d'étoile`;
  function noteStar(S, M) { const v = EV(S); if ((M.st || 1) > (v.n.maxSt || 1)) v.n.maxSt = M.st || 1; }
  /* 22A : quête « Apprenti éleveur », 6 étapes validées toutes seules, dans l'ordre */
  E.ELQ = [
    { t: "Capturer une monture", ok: (S) => (S.stats.captures || 0) >= 1 || Object.keys(S.mounts || {}).length > 0, r: "5 filets de capture", give: (S) => E.addCons(S, "filet", 5) },
    { t: "Construire l'enclos", ok: (S) => !!S.enclos.built, r: "200 Essence", give: (S) => { EV(S).ess += 200; } },
    { t: "Faire naître un premier petit", ok: (S) => (EV(S).n.births || 0) >= 1, r: "un Baffeur I", give: (S) => { EV(S).inv.push({ k: "baf", t: 0, n: E.ITEM_USES }); } },
    { t: "Obtenir une monture ★★", ok: (S) => (EV(S).n.maxSt || 1) >= 2, r: "500 Essence", give: (S) => { EV(S).ess += 500; } },
    { t: "Allumer l'éleveur automatique", ok: (S) => !!EV(S).autoUsed, r: "1 place d'écurie", give: (S) => { EV(S).qPlace = 1; } },
    { t: "Trouver une couleur de génération 3", ok: (S) => E.MOUNT_ORDER.some((sp) => Object.keys(S.mountSeen[sp] || {}).some((c) => !isBico(c) && E.gen(sp, c) >= 3)), r: "titre « Éleveur en herbe »", give: (S) => { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes("Éleveur en herbe")) S.titlesExtra.push("Éleveur en herbe"); } },
  ];
  function questTick(S) {
    const v = EV(S); v.q = v.q || 0;
    while (v.q < E.ELQ.length && E.ELQ[v.q].ok(S)) {
      const Q = E.ELQ[v.q]; Q.give(S); v.q++;
      note(S, `Apprenti éleveur ${v.q}/${E.ELQ.length} : ${Q.t}. Récompense : ${Q.r}.`, "rare"); log(S, `Quête : ${Q.t} (${Q.r})`);
    }
  }
  function elevCheck(S) { questTick(S); if (E.checkAch) E.checkAch(S); }
  E.elevCheck = elevCheck;
  /* 23A : 10 succès d'élevage */
  if (E.ACH) {
    const add = (o) => { if (!E.ACH.some((a) => a.id === o.id)) E.ACH.push(Object.assign({ cat: "Élevage" }, o)); };
    const n = (S, k) => (S.elev && S.elev.n && S.elev.n[k]) || 0;
    const colours = (S) => E.MOUNT_ORDER.reduce((a, sp) => a + E.spSeen(S, sp), 0);
    add({ id: "elv1", name: "Premier petit", desc: "Faire naître une monture à l'enclos.", test: (S) => n(S, "births") >= 1, prog: (S) => [n(S, "births"), 1], kamas: 2000 });
    add({ id: "elv100", name: "Cent naissances", desc: "Faire naître 100 montures à l'enclos.", test: (S) => n(S, "births") >= 100, prog: (S) => [n(S, "births"), 100], kamas: 30000, title: "Sage-femme des Douze" });
    add({ id: "elvst5", name: "Pur-sang", desc: "Avoir une monture ★★★★★.", test: (S) => n(S, "maxSt") >= 5, prog: (S) => [Math.max(1, n(S, "maxSt")), 5], kamas: 20000 });
    add({ id: "elvst7", name: "Étoile filante", desc: "Avoir une monture à 7 étoiles (chromatique d'une espèce au carnet complet).", test: (S) => n(S, "maxSt") >= 7, prog: (S) => [Math.max(1, n(S, "maxSt")), 7], kamas: 100000, title: "Dresseur étoilé" });
    add({ id: "elv41", name: "Arc-en-ciel", desc: "Trouver les 41 couleurs de montures.", test: (S) => colours(S) >= 41, prog: (S) => [colours(S), 41], kamas: 200000, title: "l'Arc-en-ciel" });
    add({ id: "elvchr", name: "Chromatique !", desc: "Faire naître une monture chromatique (une naissance sur 150).", test: (S) => n(S, "chr") >= 1, kamas: 30000 });
    add({ id: "elvpure", name: "Lignée pure", desc: "Faire naître une couleur de génération 3 ou plus dont les 2 parents et les 4 grands-parents ont sa couleur.", test: (S) => n(S, "pure") >= 1, kamas: 15000 });
    add({ id: "elvord", name: "Grand livreur", desc: "Livrer 50 commandes d'élevage.", test: (S) => n(S, "ord") >= 50, prog: (S) => [n(S, "ord"), 50], kamas: 50000, title: "Grand livreur" });
    add({ id: "elvbal", name: "Promeneur", desc: "Finir 50 balades.", test: (S) => n(S, "bal") >= 50, prog: (S) => [n(S, "bal"), 50], kamas: 20000 });
    add({ id: "elvst100", name: "Écurie étoilée", desc: "Avoir 100 étoiles en tout dans l'écurie.", test: (S) => Object.values(S.mounts || {}).reduce((a, M) => a + (M.st || 1), 0) >= 100, prog: (S) => [Object.values(S.mounts || {}).reduce((a, M) => a + (M.st || 1), 0), 100], kamas: 40000 });
  }
  /* 19A : « Pendant ton absence » : ce que l'élevage a fait hors ligne (affiché en haut de la page Élevage) */
  if (E.catchUp && !E.catchUp.__elev) {
    const c0 = E.catchUp;
    E.catchUp = (S, seconds) => {
      const v = S && S.mounts ? EV(S) : null; if (!v) return c0(S, seconds);
      const b = { uid: S.mountUid, births: v.n.births, bal: v.n.bal, ess: v.ess, worn: v.worn || 0, seen: E.MOUNT_ORDER.reduce((a, sp) => a + Object.keys(S.mountSeen[sp] || {}).length, 0) };
      const r = c0(S, seconds);
      try {
        const kids = Object.values(S.mounts).filter((M) => M.uid >= b.uid).map((M) => M.uid);
        const A = { at: E.now(), sec: Math.round(seconds), births: v.n.births - b.births, bal: v.n.bal - b.bal, ess: Math.max(0, v.ess - b.ess), worn: (v.worn || 0) - b.worn, neu: E.MOUNT_ORDER.reduce((a, sp) => a + Object.keys(S.mountSeen[sp] || {}).length, 0) - b.seen, kids: kids.slice(-6) };
        if (seconds >= 600 && (A.births || A.bal || A.worn)) v.away = A;
      } catch (e) { /* résumé facultatif */ }
      return r;
    };
    E.catchUp.__elev = 1;
  }
  E.awayOk = (S) => { delete EV(S).away; return null; };
  E.elevTodo = (S) => {
    const v = EV(S); const out = [];
    for (let i = 0; i < E.pairCap(S); i++) { const sl = v.slots[i] || {}; if (!E.ELV_ORDER.some((k) => sl[k]) && v.inv.length) out.push(`objet d'élevage à poser sur le couple ${i + 1}`); }
    const O = E.orders(S).filter((o) => !o.done && E.orderFits(S, o).length); if (O.length) out.push(`${O.length} commande${O.length > 1 ? "s" : ""} prête${O.length > 1 ? "s" : ""} à livrer`);
    if (S.enclos.pairs.some((p) => p.wait)) out.push("un petit attend : écurie pleine");
    if (S.enclos.built && E.freeSlot(S) >= 0 && !v.auto.on) out.push("un couple libre à l'enclos");
    return out;
  };

  /* ---------- sauvegarde ---------- */
  if (E.deserialize && !E.deserialize.__elev) { const d0 = E.deserialize; E.deserialize = (txt) => { const S = d0(txt); try { if (S) E.elevState(S); } catch (e) { /* partie sans montures */ } return S; }; E.deserialize.__elev = 1; }
  if (E.newState && !E.newState.__elev) { const n0 = E.newState; E.newState = function () { const S = n0.apply(this, arguments); try { if (S && S.enclos) E.elevState(S); } catch (e) {} return S; }; E.newState.__elev = 1; }

  if (E.ACTIONS) Object.assign(E.ACTIONS, {
    elvBuy: "acheter un objet d'élevage", elvEquip: "poser un objet d'élevage", elvUnequip: "retirer un objet d'élevage", elvAutoEquip: "poser les meilleurs objets d'élevage",
    feedMount: "nourrir une monture d'Essence", polishMount: "polir une étoile de monture", renameMount: "renommer une monture", massRelease: "relâcher des montures en masse",
    setAuto: "régler l'éleveur automatique", baladeStart: "envoyer une monture en balade", baladeStop: "rappeler une monture de balade", orderDeliver: "livrer une commande d'élevage",
    stableBuy: "agrandir l'écurie", pair4Buy: "acheter le 4e couple", awayOk: "fermer le résumé de l'élevage",
  });

  root.ELEVAGE_READY = true;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
