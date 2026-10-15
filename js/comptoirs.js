/* ============================================================================
   COMPTOIRS, Idlus 1.0.30 « L'économie » (choix 35A)
   Les 6 boutiques du jeu réunies (page Économie › Comptoirs, js/comptoirsui.js), chacune avec sa monnaie :
   Bureau des primes (jetons), Comptoir de la cité (insignes), Comptoir des temples (Doplons), Kolizéum (Kolizetons),
   Marché onirique (Bribes de rêve) et Boss des mondes (Fragments d'anomalie).
   Les boutiques gardent leurs règles et leurs fonctions d'achat (E.buyShop, E.sgBuy, E.wbBuy) : rien n'est cassé,
   la page les appelle. En plus :
   - des objets qu'on rachète dans les comptoirs qui n'en avaient presque pas (Sablier, Trousseau de clés, coffres,
     parchemins) et une teinture par comptoir (palette de couleurs des héros, Héros › Apparence) ;
   - une offre de la semaine par boutique : un objet qu'on rachète à −30 %, 3 fois par semaine au plus ;
   - un point sur le menu quand une monnaie peut acheter quelque chose de neuf (S.cpt.seen : vu sur la page).
   Pas de DOM ici : ce fichier se charge aussi dans les tests (node).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; const D = root.DATA;
  if (!E || !D || !E.SHOPS || E.CPT) return;
  const { CONSUMABLES, ITEMS, DUNGEONS } = D;

  /* ---------- teintures : palettes verrouillées (la couleur 1, la peau, est gardée) ---------- */
  E.TEINTURES = [
    { id: "chasseur", name: "Chasseur", c: [0x4a3520, 0x6b8e23, 0x3b2a18, 0xd2b48c] },
    { id: "cite_bonta", name: "Bonta", c: [0xdfe6f2, 0x3a6fd8, 0x8fa3c8, 0xf2d06b] },
    { id: "cite_brakmar", name: "Brâkmar", c: [0x2b1014, 0xb3261e, 0x4d1a1d, 0x6b6b6b] },
    { id: "temple", name: "Temples", c: [0x4a3418, 0xd4a017, 0x6b4a1e, 0xf6e7b0] },
  ];
  const LK = root.LOOKS;
  if (LK && Array.isArray(LK.PALETTES)) E.TEINTURES.forEach((t) => { if (!LK.PALETTES.some((p) => p.id === "t_" + t.id)) LK.PALETTES.push({ id: "t_" + t.id, name: t.name, c: t.c, lock: "teint_" + t.id }); });
  const teintId = (S, it) => (it.teint === "cite" ? "cite_" + (S.align ? S.align.side : "bonta") : it.teint);

  /* ---------- objets ajoutés aux comptoirs (identifiants uniques : les limites par jour et par semaine les comptent) ---------- */
  const add = (shop, items) => { const Sh = E.SHOPS[shop]; if (!Sh) return; items.forEach((it) => { if (!Sh.items.some((x) => x.id === it.id)) Sh.items.push(it); }); };
  const SAB = "1 heure de Sablier de Xélor", KEY = "Trousseau de clés";
  add("prime", [
    { id: "ps1", sab: 1, name: SAB, cost: 12, many: true, day: 1 }, { id: "pk1", key: 1, name: KEY, cost: 8, many: true, week: 3 },
    { id: "pc1", cons: "coffre_argent", cost: 12, many: true }, { id: "pt1", teint: "chasseur", name: "Teinture du chasseur", cost: 40 },
  ]);
  add("cite", [
    { id: "cs1", sab: 1, name: SAB, cost: 40, many: true, day: 1 }, { id: "ck1", key: 1, name: KEY, cost: 60, many: true, week: 3 },
    { id: "cc1", cons: "coffre_argent", cost: 90, many: true },
    ...["fo", "ine", "cha", "age", "vit", "sa"].map((k) => ({ id: "cq_" + k, cons: "parch_" + k + "_p", cost: 12, many: true })),
    { id: "ct1", teint: "cite", name: "Teinture de la cité", cost: 200 },
  ]);
  add("temple", [
    { id: "ds1", sab: 1, name: SAB, cost: 8, many: true, day: 1 }, { id: "dk1", key: 1, name: KEY, cost: 6, many: true, week: 3 },
    { id: "dt1", teint: "temple", name: "Teinture des temples", cost: 60 },
  ]);
  /* la teinture : nom, « déjà obtenue », achat (le reste passe par les fonctions d'origine) */
  const name0 = E.shopItemName; E.shopItemName = (S, it) => (it && it.teint ? (it.teint === "cite" && S.align ? `Teinture de ${E.ALIGN[S.align.side].name}` : it.name) : name0(S, it));
  const owned0 = E.shopOwned; E.shopOwned = (S, it) => (it && it.teint ? !!(S.unlocks && S.unlocks["teint_" + teintId(S, it)]) : owned0(S, it));
  const buy0 = E.buyShop;
  E.buyShop = (S, shop, id, qty, arg) => {
    const Sh = E.SHOPS[shop]; const it = Sh && Sh.items.find((x) => x.id === id);
    if (!it || !it.teint) return buy0(S, shop, id, qty, arg);
    if (shop === "cite" && !S.align) return "Choisissez d'abord un alignement.";
    if (E.shopOwned(S, it)) return "Déjà obtenu.";
    if ((S.tokens[Sh.cur] || 0) < it.cost) return `Il faut ${it.cost} ${Sh.curName.toLowerCase()}.`;
    S.tokens[Sh.cur] -= it.cost; S.unlocks["teint_" + teintId(S, it)] = 1;
    E.note(S, `${Sh.name} : ${E.shopItemName(S, it)} obtenue (Héros › Apparence).`, "up"); return null;
  };

  /* ---------- les 6 boutiques ---------- */
  const tok = (cur) => ({ bal: (S) => (S.tokens && S.tokens[cur]) || 0, add: (S, x) => { S.tokens = S.tokens || {}; S.tokens[cur] = (S.tokens[cur] || 0) + x; } });
  const fromShop = (id, icon, extra) => Object.assign({ id, icon, name: () => E.SHOPS[id].name, cur: () => E.SHOPS[id].curName }, tok(E.SHOPS[id] ? E.SHOPS[id].cur : id), {
    items: (S) => (E.SHOPS[id] ? E.SHOPS[id].items : []).map((it) => ({
      id: it.id, it, name: E.shopItemName(S, it), cost: it.cost, many: !!it.many, owned: E.shopOwned(S, it),
      left: E.shopWeekLeft(S, it), per: it.day ? "jour" : it.week ? "semaine" : null, lim: it.day || it.week || 0,
      rebuy: !!(it.many || it.cons || it.res || it.sab || it.key || it.tresor) && !it.title && !it.titleSide && !it.orn && !it.wing && !it.furn && !it.teint,
      key: !!it.key,
    })),
    buy: (S, iid, q, arg) => E.buyShop(S, id, iid, q, arg),
  }, extra || {});
  const FRAG = () => E.WB_FRAG || "Fragment d'anomalie";
  E.CPT = [
    fromShop("prime", "quetes", { desc: "Jetons de chasseur : un par avis de recherche rempli (deux pour un boss)." }),
    fromShop("cite", "ailes", { desc: "Insignes de cité : 3 par mission d'alignement, 5 pour un boss.", need: (S) => (S.align ? null : "Choisis d'abord un alignement (Journal › Quêtes › Alignement).") }),
    fromShop("temple", "cristal", { desc: "Doplons : en battant les Dopeuls des temples." }),
    fromShop("koli", "combat", { desc: "Kolizetons : en combattant au Kolizéum.", page: "koli" }),
    { id: "songe", icon: "carte", name: () => "Marché onirique", cur: () => E.BRIBES || "Bribes de rêve", desc: "Bribes de rêve : au Songe infini.", page: "exp",
      bal: (S) => (E.songe ? E.songe(S).br : 0), add: (S, x) => { E.songe(S).br += x; },
      items: (S) => (E.SG_SHOP || []).map((o) => ({ id: o.id, o, name: o.name, cost: o.price, many: false, owned: !!(o.once && E.sgOwned(S, o.id)), left: Infinity, per: null, lim: 0, rebuy: !o.once })),
      buy: (S, iid) => E.sgBuy(S, iid) },
    { id: "wb", icon: "couronne", name: () => "Boss des mondes", cur: () => "Fragments d'anomalie", desc: "Fragments d'anomalie : à chaque essai contre le Boss des mondes.", page: "wb",
      bal: (S) => (E.wbFrags ? E.wbFrags(S) : 0), add: (S, x) => { const v = (S.res[FRAG()] || 0) + x; if (v > 0) S.res[FRAG()] = v; else delete S.res[FRAG()]; },
      items: (S) => (E.WB_SHOP || []).filter(([t]) => ITEMS[t]).map(([t, c]) => ({ id: t, tpl: t, name: ITEMS[t].name, cost: c, many: false, owned: false, left: Infinity, per: null, lim: 0, rebuy: true })),
      buy: (S, iid) => { const r = E.wbBuy(S, iid); return r.err || null; } },
  ];
  E.cptShop = (id) => E.CPT.find((x) => x.id === id) || null;

  /* ---------- état (migration 1.0.30, sans E.VERSION : créé s'il manque) ---------- */
  const week = () => (E.koliWeek ? E.koliWeek() : E.weekIdx());
  E.cptState = (S) => {
    if (!S.cpt || typeof S.cpt !== "object") S.cpt = {};
    if (!S.cpt.seen || typeof S.cpt.seen !== "object") S.cpt.seen = {};
    if (!S.cpt.off || typeof S.cpt.off !== "object") S.cpt.off = {};
    const w = week(); for (const k in S.cpt.seen) { const m = /:w(\d+)$/.exec(k); if (m && +m[1] < w - 1) delete S.cpt.seen[k]; } // vieilles offres oubliées
    return S.cpt;
  };
  /* offre de la semaine : un objet qu'on rachète, choisi par la semaine (le même pour tout le monde), −30 %, 3 par semaine */
  E.CPT_OFF = { pct: 30, n: 3 };
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  E.cptOffer = (S, sid) => {
    const B = E.cptShop(sid); if (!B) return null; const w = week();
    const L = B.items(S).filter((x) => x.rebuy).sort((a, b) => (a.id < b.id ? -1 : 1)); if (!L.length) return null;
    const x = L[hash(sid + ":" + w) % L.length]; const st = E.cptState(S).off[sid];
    const used = st && st.w === w ? st.n : 0;
    return { id: x.id, item: x, w, cost: Math.ceil(x.cost * (100 - E.CPT_OFF.pct) / 100), left: Math.max(0, E.CPT_OFF.n - used) };
  };
  /* acheter (offre = au prix de l'offre de la semaine si c'est elle) ; renvoie null ou le message d'erreur */
  E.cptBuy = (S, sid, iid, q, arg, offer) => {
    const B = E.cptShop(sid); if (!B) return "Boutique inconnue.";
    const need = B.need && B.need(S); if (need) return need;
    const x = B.items(S).find((i) => i.id === iid); if (!x) return "Article inconnu.";
    const n = x.many ? Math.max(1, Math.min(100, Math.floor(+q || 1))) : 1;
    const O = offer ? E.cptOffer(S, sid) : null;
    if (!O || O.id !== iid) return B.buy(S, iid, n, arg);
    if (O.left < n) return O.left ? `Encore ${O.left} à ce prix cette semaine.` : "Offre de la semaine épuisée : retour lundi.";
    if (B.bal(S) < O.cost * n) return `Il faut ${O.cost * n} ${B.cur().toLowerCase()}.`;
    const gift = (x.cost - O.cost) * n; B.add(S, gift); // la remise : ajoutée juste avant l'achat au prix normal, reprise si l'achat échoue
    const r = B.buy(S, iid, n, arg);
    if (r) { B.add(S, -gift); return r; }
    const st = E.cptState(S).off; st[sid] = { w: O.w, n: (st[sid] && st[sid].w === O.w ? st[sid].n : 0) + n };
    return null;
  };
  /* objets « neufs » : achetables maintenant (assez de monnaie, pas déjà obtenus, limite pas atteinte) et pas encore vus sur la page */
  const seenKey = (sid, x, O) => `${sid}:${x.id}${O && O.id === x.id ? ":w" + O.w : ""}`;
  E.cptNew = (S, sid) => {
    const B = E.cptShop(sid); if (!B || (B.need && B.need(S))) return [];
    const C = E.cptState(S); const bal = B.bal(S); const O = E.cptOffer(S, sid);
    return B.items(S).filter((x) => !x.owned && x.left > 0 && bal >= (O && O.id === x.id && O.left ? O.cost : x.cost) && (!x.key || E.shopKeys(S).length) && !C.seen[seenKey(sid, x, O)]).map((x) => x.id);
  };
  /* vus : ceux qu'on a montrés comme neufs (par défaut, ceux qui le sont maintenant) ; un objet encore trop cher redeviendra neuf */
  E.cptSeen = (S, sid, ids) => { const C = E.cptState(S); const B = E.cptShop(sid); if (!B) return; const O = E.cptOffer(S, sid); const L = ids || E.cptNew(S, sid);
    B.items(S).forEach((x) => { if (L.includes(x.id)) C.seen[seenKey(sid, x, O)] = 1; }); };
  E.cptHasNew = (S) => E.CPT.some((B) => E.cptNew(S, B.id).length > 0);

  if (E.deserialize) { const d0 = E.deserialize; E.deserialize = (txt) => { const S = d0(txt); if (S && S.cpt) E.cptState(S); return S; }; }
})(typeof window !== "undefined" ? window : globalThis);
