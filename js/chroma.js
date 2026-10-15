/* 1.0.33 « Chromatiques » (Mathis 1A-8A, 5A « avec encore plus de fonctionnalités », 9A-16A).
   N'importe quel monstre (chasse et donjon, boss compris ; ni archimonstre, ni Songe, ni boss de guilde) peut apparaître
   en version chromatique : 1 sur 4 096 par monstre, puis 1 chromatique sur 50 est prismatique.
   Couleurs inversées et halo doré (comme les montures chromatiques de l'Élevage), même force qu'un monstre normal,
   butin et XP ×3, 1 Éclat chromatique (5 pour un prismatique). Chances : chaîne dans la même zone (jusqu'à ×3 après
   500 victoires d'affilée), Charme de l'album (palier 100, ×1,5), espèce recherchée (×2 pour elle seule, 1 changement par jour).
   Les Dofus ne sont jamais touchés (leur chance est tirée à part, dans stasisClear).
   L'album (Encyclopédie › Chromatiques) : une case par espèce, fiche de rencontre, paliers 5/10/25/50/100 (5A, abaissés avec la chance de 1 sur 4 096),
   trophées chromatiques de sous-zone (+3 % de butin et d'XP), vitrine de 3, compteur de chasse, Atelier du prisme.
   Interface : js/chromaui.js. Serveur : supabase/classements.sql (colonnes chroma*) et supabase/chat.sql (Hauts faits). */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const { MONSTERS } = D;
  const SUBS = E.SUBS;
  const rnd = () => E.rnd();
  const DAY = 86400000;

  E.CHROMA_CHANCE = 1 / 4096;   // par monstre (2A ; Mathis 15/10 : 1 sur 4 096, comme Pokémon)
  E.PRISM_CHANCE = 1 / 50;      // part des chromatiques qui sont prismatiques (16A)
  E.CHROMA_MULT = 3;            // butin et XP (4A)
  E.CHROMA_CHAIN_N = 500;       // victoires d'affilée pour la chaîne pleine (7A)
  E.CHROMA_CHAIN_MAX = 3;
  E.CHROMA_CHARM = 1.5;         // palier 100 (5A)
  E.CHROMA_WANT = 2;            // espèce recherchée (13A)
  E.CHROMA_TROPHY = 3;          // % de butin et d'XP dans une sous-zone complète (9A)
  E.CHROMA_VIT = 3;             // vitrine (10A)

  /* les espèces de l'album : les monstres des sous-zones et des donjons (sans les archimonstres ni les boss à part,
     comme les boss de guilde, qu'on ne rencontre pas en chasse ni en donjon) */
  const REACH = new Set(); Object.values(SUBS).forEach((s) => s.monsters.forEach((k) => REACH.add(k)));
  E.chromaDgMons = {}; // donjon → ses espèces qu'on ne trouve dans aucune sous-zone (rangées sous « Donjons » dans l'album)
  { const inSub = new Set(REACH);
    Object.keys(D.DUNGEONS).forEach((id) => { const d = D.DUNGEONS[id]; const L = [];
      d.rooms.forEach((r) => (r.mobs || []).forEach((k) => L.push(k))); (d.bossMobs || []).forEach((k) => L.push(k)); L.push(d.boss);
      E.chromaDgMons[id] = [...new Set(L)].filter((k) => MONSTERS[k] && !MONSTERS[k].archiOf && !inSub.has(k) && !REACH.has(k) ? (REACH.add(k), true) : false); }); }
  E.CHROMA_KEYS = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].archiOf && REACH.has(k));
  E.CHROMA_TOTAL = E.CHROMA_KEYS.length;
  const subOf = {}; Object.values(SUBS).forEach((s) => s.monsters.forEach((k) => { if (MONSTERS[k] && !MONSTERS[k].archiOf) (subOf[k] = subOf[k] || []).push(s.id); }));
  E.chromaSubMons = (sid) => (SUBS[sid] ? [...new Set(SUBS[sid].monsters.filter((k) => MONSTERS[k] && !MONSTERS[k].archiOf))] : []);

  const C = (S) => {
    if (!S.chroma) S.chroma = { dex: {}, since: 0, rec: { tot: 0, sum: 0 }, chain: { loc: null, n: 0 }, want: null, ec: 0, vit: [], tro: {}, shop: {}, dyes: 0, last: [], tiers: 0 };
    return S.chroma;
  };
  E.chroma = C;
  E.chromaCount = (S) => Object.keys(C(S).dex).length;
  E.chromaPrismCount = (S) => Object.values(C(S).dex).filter((d) => d.p).length;
  E.chromaHas = (S, k) => !!C(S).dex[k];

  /* ---------- paliers de l'album (5A) ---------- */
  E.CHROMA_TIERS = [
    { n: 5, txt: "Titre « Œil de lynx »", title: "Œil de lynx" },
    { n: 10, txt: "Ornement « Éclat chromatique »", orn: "chroma" },
    { n: 25, txt: "Une teinture chromatique pour un héros", dye: 1 },
    { n: 50, txt: "Charme chromatique : chances ×1,5", charm: true },
    { n: 100, txt: "Titre « Maître des couleurs » et Cadre chromatique", title: "Maître des couleurs", frame: true },
  ];
  const giveTitle = (S, t) => { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); };
  const tierCheck = (S, quiet) => {
    const X = C(S); const n = E.chromaCount(S);
    E.CHROMA_TIERS.forEach((T, i) => {
      if (X.tiers > i || n < T.n) return;
      X.tiers = i + 1;
      if (T.title) giveTitle(S, T.title);
      if (T.dye) X.dyes = (X.dyes || 0) + T.dye;
      E.note(S, `Album chromatique, palier ${T.n} : ${T.txt} !`, "rare");
      if (!quiet && E.celebrate) E.celebrate({ t: "chromatier", n: T.n, txt: T.txt });
    });
  };
  const tierN = (k) => E.CHROMA_TIERS.find((T) => T[k]).n;
  E.chromaCharm = (S) => E.chromaCount(S) >= tierN("charm");

  /* ---------- chances ---------- */
  const locOf = (S) => (S.dungeon ? (S.dungeon.gboss ? null : "dg:" + S.dungeon.id) : S.sub && S.hunting ? S.sub : null);
  E.chromaChainMult = (S) => { const ch = C(S).chain; return ch.loc && ch.loc === locOf(S) ? 1 + (E.CHROMA_CHAIN_MAX - 1) * Math.min(1, ch.n / E.CHROMA_CHAIN_N) : 1; };
  E.chromaOdds = (S, key) => E.CHROMA_CHANCE * E.chromaChainMult(S) * (E.chromaCharm(S) ? E.CHROMA_CHARM : 1) * (key && C(S).want && C(S).want.k === key ? E.CHROMA_WANT : 1);
  const can = (m) => m && m.side === "m" && !m.summon && !m.archi && REACH.has(m.base || m.key) && !MONSTERS[m.base || m.key].archiOf;
  /* tirage à l'apparition d'un groupe (combat réel ou chasse hors ligne) */
  E.chromaRoll = (S, mons, opts = {}) => {
    if (!opts.offline && !locOf(S)) return 0;
    let n = 0;
    mons.forEach((m) => {
      if (!can(m) || m.chroma) return;
      const force = E.chromaForce && !opts.offline ? E.chromaForce : null; // panel de test (js/admin.js) : le prochain monstre
      if (force) { E.chromaForce = null; m.chroma = true; if (force === "p") m.prism = true; n++; E.note(S, `✦ Un ${m.name} ${m.prism ? "prismatique" : "chromatique"} apparaît !`, "rare"); return; }
      if (rnd() < E.chromaOdds(S, m.base || m.key)) { m.chroma = true; if (rnd() < E.PRISM_CHANCE) m.prism = true; n++;
        if (!opts.offline) E.note(S, `✦ Un ${m.name} ${m.prism ? "prismatique" : "chromatique"} apparaît !`, "rare"); }
    });
    return n;
  };

  /* ---------- victoire : compteur, chaîne, album ---------- */
  const teamNames = (S) => E.team(S).map((c) => c.name).slice(0, 8);
  E.chromaWin = (S, mons, opts = {}) => {
    const X = C(S); const out = [];
    const loc = opts.offline ? S.sub : locOf(S);
    if (loc) { if (X.chain.loc === loc) X.chain.n++; else X.chain = { loc, n: 1 }; }
    mons.forEach((m) => {
      X.since = (X.since || 0) + 1;
      if (!m.chroma) return;
      const k = m.base || m.key; const after = X.since; X.since = 0;
      const r = X.rec; r.tot = (r.tot || 0) + 1; r.sum = (r.sum || 0) + after;
      if (!r.fast || after < r.fast[0]) r.fast = [after, k];
      if (!r.slow || after > r.slow[0]) r.slow = [after, k];
      X.ec = (X.ec || 0) + (m.prism ? 5 : 1);
      const old = X.dex[k]; const first = !old; const prismNew = !!m.prism && !(old && old.p); const firstPrism = m.prism && !(old && old.p) && !Object.values(X.dex).some((d) => d.p);
      const where = S.dungeon && D.DUNGEONS[S.dungeon.id] ? D.DUNGEONS[S.dungeon.id].name : SUBS[S.sub] ? SUBS[S.sub].name : "";
      const d = X.dex[k] = old || { t: E.now(), n: 0, where, team: teamNames(S), after, lvl: m.lvl };
      d.n++; if (m.prism && !d.p) d.p = E.now();
      if (X.want && X.want.k === k) X.want = null;
      if (first || prismNew) { X.last = [{ k, p: m.prism ? 1 : 0, t: E.now() }].concat((X.last || []).filter((x) => x.k !== k)).slice(0, 3); }
      if (firstPrism) giveTitle(S, "Prisme vivant");
      E.note(S, `✦ ${m.name} ${m.prism ? "prismatique" : "chromatique"} vaincu${first ? ` : nouveau dans l'album (${E.chromaCount(S)})` : ""} !`, "rare");
      if (!opts.offline && E.celebrate && (first || prismNew)) E.celebrate({ t: "chroma", k, p: !!m.prism, first, n: E.chromaCount(S), after, where }); // 6A : la fête seulement la première fois (ou le premier prismatique de l'espèce)
      out.push({ k, p: !!m.prism, first, after });
      if (first) trophyCheck(S, k, opts.offline);
    });
    if (out.length) tierCheck(S, opts.offline);
    return out;
  };

  /* ---------- trophées chromatiques de sous-zone (9A) ---------- */
  const trophyCheck = (S, k, quiet) => {
    const X = C(S);
    (subOf[k] || []).forEach((sid) => {
      if (X.tro[sid]) return;
      const ks = E.chromaSubMons(sid); if (!ks.length || !ks.every((x) => X.dex[x])) return;
      X.tro[sid] = E.now();
      E.note(S, `🏆 Trophée chromatique : ${SUBS[sid].name} (+${E.CHROMA_TROPHY} % de butin et d'XP dans cette sous-zone) !`, "rare");
      if (!quiet && E.celebrate) E.celebrate({ t: "chromatro", sid });
    });
  };
  E.chromaTrophy = (S, sid) => !!(S.chroma && S.chroma.tro && S.chroma.tro[sid]);
  { const prev = E.trophyZoneMult;
    E.trophyZoneMult = (S, opts = {}) => prev(S, opts) * (opts.dungeon || S.dungeon || !S.sub || (E.expActive && E.expActive(S)) || !E.chromaTrophy(S, S.sub) ? 1 : 1 + E.CHROMA_TROPHY / 100); }

  /* ---------- espèce recherchée (13A) ---------- */
  const dayOf = (t) => Math.floor((t + 2 * 3600000) / DAY); // jour de Paris (à peu près), comme l'Almanax
  E.chromaWantFree = (S) => { const w = C(S).want; return !w || !w.t || dayOf(w.t) !== dayOf(E.now()); };
  E.chromaSetWant = (S, k) => {
    if (!MONSTERS[k] || MONSTERS[k].archiOf) return "Espèce inconnue.";
    if (!(S.bestiary[k] > 0)) return "Rencontre d'abord ce monstre au moins une fois.";
    if (C(S).dex[k]) return "Ce chromatique est déjà dans l'album.";
    if (!E.chromaWantFree(S)) return "Tu as déjà changé d'espèce recherchée aujourd'hui.";
    C(S).want = { k, t: E.now() }; return null;
  };

  /* ---------- vitrine (10A) ---------- */
  E.chromaSetVit = (S, k, on) => {
    const X = C(S); if (on && !X.dex[k]) return "Ce chromatique n'est pas encore dans l'album.";
    X.vit = (X.vit || []).filter((x) => x !== k && X.dex[x]);
    if (on) { if (X.vit.length >= E.CHROMA_VIT) return `La vitrine a ${E.CHROMA_VIT} places : retires-en un d'abord.`; X.vit.push(k); }
    return null;
  };

  /* ---------- Atelier du prisme (15A) ---------- */
  E.CHROMA_SHOP = [
    { id: "dye", name: "Teinture chromatique", txt: "Teint un héros aux couleurs chromatiques (Héros › Apparence)", cost: 5, many: true },
    { id: "orn", name: "Ornement « Prisme »", txt: "Un ornement arc-en-ciel pour tes héros", cost: 8 },
    { id: "frame", name: "Cadre « Prisme »", txt: "Un cadre de portrait arc-en-ciel (Héros › Apparence › Cadre)", cost: 13 },
    { id: "aura", name: "Aura chromatique", txt: "Tes héros brillent en combat (réglable dans l'atelier)", cost: 20 },
  ];
  E.chromaBuy = (S, id) => {
    const X = C(S); const it = E.CHROMA_SHOP.find((x) => x.id === id); if (!it) return "Article inconnu.";
    if (!it.many && X.shop[id]) return "Déjà acheté.";
    if ((X.ec || 0) < it.cost) return `Il faut ${it.cost} Éclats chromatiques.`;
    X.ec -= it.cost;
    if (id === "dye") X.dyes = (X.dyes || 0) + 1; else X.shop[id] = E.now();
    if (id === "aura") X.auraOn = true;
    E.note(S, `Atelier du prisme : ${it.name} !`, "rare");
    return null;
  };
  /* teinture d'un héros : une teinture le teint pour toujours, puis on l'active ou non librement */
  E.chromaDye = (S, cid, on) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (on && !c.chromaDye) { const X = C(S); if (!(X.dyes > 0)) return `Il te faut une teinture chromatique (album, palier ${tierN("dye")}, ou Atelier du prisme).`; X.dyes--; c.chromaDye = 1; }
    c.chroma = !!on; return null;
  };

  /* ---------- ornements et cadres ---------- */
  if (E.ORN) {
    E.ORN.chroma = { name: () => "Éclat chromatique", req: `Album chromatique : ${tierN("orn")} chromatiques`, ok: (S) => E.chromaCount(S) >= tierN("orn") };
    E.ORN.prisme = { name: () => "Prisme", req: `Atelier du prisme (${E.CHROMA_SHOP.find((x) => x.id === "orn").cost} Éclats chromatiques)`, ok: (S) => !!(S.chroma && S.chroma.shop && S.chroma.shop.orn) };
  }
  if (E.SFRAMES) {
    E.SFRAMES.chroma = { name: () => "Cadre chromatique", req: `Album chromatique : ${tierN("frame")} chromatiques`, ok: (S) => E.chromaCount(S) >= tierN("frame") };
    E.SFRAMES.prisme = { name: () => "Cadre « Prisme »", req: `Atelier du prisme (${E.CHROMA_SHOP.find((x) => x.id === "frame").cost} Éclats chromatiques)`, ok: (S) => !!(S.chroma && S.chroma.shop && S.chroma.shop.frame) };
  }

  /* ---------- hors ligne (8A) : les chromatiques trouvés pendant l'absence vont dans le résumé ---------- */
  { const prev = E.catchUp;
    E.catchUp = (S, seconds) => { const X = C(S); const t0 = X.rec.tot || 0; const before = new Set(Object.keys(X.dex));
      E._chromaOff = []; const r = prev(S, seconds); const got = E._chromaOff; E._chromaOff = null;
      if (r && (X.rec.tot || 0) > t0) { const by = {}; // une ligne par espèce : combien, prismatique ou non, nouvelle dans l'album ou non
        got.forEach((x) => { const o = by[x.k] || (by[x.k] = { k: x.k, p: 0, n: 0, neu: !before.has(x.k) }); o.n++; if (x.p) o.p = 1; });
        r.chroma = Object.values(by).sort((a, b) => b.p - a.p || b.neu - a.neu || b.n - a.n); }
      return r; }; }
  E.chromaOffline = (S, g) => { E.chromaRoll(S, g, { offline: true }); const out = E.chromaWin(S, g, { offline: true }); if (out.length && E._chromaOff) E._chromaOff.push(...out); };

  /* ---------- données envoyées avec la partie (classement « Chromatiques », vitrine, Hauts faits) ---------- */
  E.chromaMeta = (S) => { const X = C(S); return { chroma: E.chromaCount(S), chromaVit: (X.vit || []).filter((k) => X.dex[k]).map((k) => [k, X.dex[k].p ? 1 : 0]), chromaNew: (X.last || []).map((x) => [x.k, x.p]) }; };

  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
