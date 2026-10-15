/* ============================================================================
   FOIRE DU TROOL, Idlus 1.0.30 « L'économie » (choix 28C + Jackpot)
   Les Caisses du Trool : 3 caisses (bois, argent, dorée) payées en kamas, 5 raretés aux chances affichées.
   20 ouvertures par jour (heure de Paris), toutes caisses confondues. Rien ne s'y achète avec de l'argent réel,
   et on n'y gagne jamais de Dofus (ni objet légendaire, ni objet du Boss des mondes : E.chestItemPool).
   Chaque rareté vaut une part de la mise (MULT) : 60 % ×0,35, 25 % ×0,9, 10 % ×2, 4 % ×4, 1 % ×10 :
   en moyenne 0,895 de la mise revient en lots, la maison garde 10,5 %.
   Un lot en objets compte à sa valeur de référence (REF) ; ce qui manque pour arriver à la valeur du lot est payé
   en kamas. Les ressources comptent ×3 leur valeur de base (le plafond de la vente directe) : revendues, elles ne
   rapportent jamais plus que la valeur du lot.
   Le tirage vient d'une graine gardée dans la partie (S.foire.seed) : recharger la page ne change pas le lot suivant.
   Le Jackpot du serveur (ticket 10 000 k, tirage toutes les heures) est côté serveur : supabase/foire.sql, js/foireui.js.
   Pas de DOM ici : ce fichier se charge aussi dans les tests (node).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE; const D = root.DATA;
  if (!E || !D || E.FOIRE) return;
  const { RES, ITEMS, CONSUMABLES, DUNGEONS } = D;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const topLvl = (S) => Math.max(1, ...S.chars.map((c) => c.lvl || 1));

  E.FOIRE = {
    DAY: 20,
    TITLE: "Chouchou du Trool",
    RAR: [
      { id: "commun", name: "Commun", color: "#9aa3ad", p: 60, mult: 0.35 },
      { id: "peu", name: "Peu commun", color: "#4f9de8", p: 25, mult: 0.9 },
      { id: "rare", name: "Rare", color: "#9b59e8", p: 10, mult: 2 },
      { id: "epique", name: "Épique", color: "#e04fb0", p: 4, mult: 4 },
      { id: "leg", name: "Légendaire", color: "#f0b429", p: 1, mult: 10 },
    ],
    CAISSES: [
      { id: "bois", name: "Caisse en bois", cost: 50000, img: "bois", chest: "coffre_argent" },
      { id: "argent", name: "Caisse d'argent", cost: 250000, img: "argent", chest: "coffre_or" },
      { id: "or", name: "Caisse dorée", cost: 1000000, img: "or", chest: "coffre_obsidienne" },
    ],
    /* sortes de lots par rareté : [sorte, poids] */
    KINDS: [
      [["k", 50], ["res", 50]],
      [["k", 40], ["res", 20], ["bonbon", 25], ["parch", 15]],
      [["k", 40], ["coffre", 25], ["sab", 20], ["potion", 15]],
      [["k", 40], ["item", 30], ["key", 30]],
      [["title", 100]],
    ],
    REF: { bonbon: 15000, parch: 20000, sab: 100000, potion: 100000, keyLvl: 400, keyMin: 8000 },
    BONBONS: ["bonbon_sagesse", "bonbon_prospecteur", "bonbon_dore", "bonbon_recolteur"],
  };
  const F = E.FOIRE;
  /* espérance de la mise rendue en lots (0,895) */
  E.foireRtp = () => F.RAR.reduce((a, r) => a + (r.p / 100) * r.mult, 0);

  /* ---------- état dans la partie (migration 1.0.30 : créé s'il manque, sans E.VERSION) ---------- */
  const today = () => (E.defiDay ? E.defiDay() : Math.floor(E.now() / 86400000));
  E.foireState = (S) => {
    if (!S.foire || typeof S.foire !== "object") S.foire = {};
    const G = S.foire;
    if (!(G.seed >>> 0)) G.seed = (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
    if (G.day !== today()) { G.day = today(); G.n = 0; }
    if (!Array.isArray(G.log)) G.log = [];
    if (!G.tot || typeof G.tot !== "object") G.tot = { n: 0, mise: 0, k: 0 };
    return G;
  };
  E.foireLeft = (S) => Math.max(0, F.DAY - E.foireState(S).n);

  /* tirage à graine (mulberry32) : rng() renvoie [0, 1[ et fait avancer la graine */
  const mkRng = (G) => () => {
    G.seed = (G.seed + 0x6d2b79f5) >>> 0; let t = G.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pickW = (L, x) => { const tot = L.reduce((a, [, w]) => a + w, 0); let y = x * tot; for (const [k, w] of L) { if (y < w) return k; y -= w; } return L[L.length - 1][0]; };
  const rarOf = (x) => { let y = x * 100; for (let i = 0; i < F.RAR.length; i++) { if (y < F.RAR[i].p) return i; y -= F.RAR[i].p; } return 0; };

  /* ressources de la tranche de niveau du meilleur héros (vendables au jeu, sans clefs) */
  const bandCache = {};
  const resBand = (lvl) => {
    const b = Math.floor(lvl / 10); if (bandCache[b]) return bandCache[b];
    const ok = (n) => (E.venteOk ? E.venteOk(n) : E.resPrice(n) > 0 && !E.isKey(n));
    let L = Object.keys(RES).filter((n) => ok(n) && E.resLvl(n) <= b * 10 + 10 && E.resLvl(n) >= b * 10 - 20);
    if (L.length < 5) L = Object.keys(RES).filter(ok);
    return (bandCache[b] = L.sort());
  };
  const keyDungeons = (S) => Object.keys(DUNGEONS).filter((d) => DUNGEONS[d].key && (!E.dungeonUnlocked || E.dungeonUnlocked(S, d)) && RES[DUNGEONS[d].key] !== undefined).sort();

  /* ---------- un lot ----------
     { r (rareté), v (valeur en kamas), k (kamas), res: [nom, n], cons: [id, n], sab (heures), key: [nom, n], item (modèle), title } */
  E.foireLot = (S, caisse, rng) => {
    const C = F.CAISSES.find((x) => x.id === caisse) || F.CAISSES[0];
    const r = rarOf(rng()); const R = F.RAR[r]; const V = Math.round(C.cost * R.mult); const top = topLvl(S);
    let kind = pickW(F.KINDS[r], rng());
    const lot = { r, v: V, k: 0 }; let goods = 0;
    if (kind === "title") { if (!(S.titlesExtra || []).includes(F.TITLE)) lot.title = F.TITLE; kind = "k"; }
    if (kind === "res") {
      const L = resBand(top); const n = L[Math.floor(rng() * L.length)]; const unit = 3 * E.resPrice(n);
      const q = clamp(Math.floor(V / unit), 1, 5000); lot.res = [n, q]; goods = q * unit;
    } else if (kind === "bonbon" || kind === "parch") {
      const id = kind === "bonbon" ? F.BONBONS[Math.floor(rng() * F.BONBONS.length)] : "parch_" + ["fo", "ine", "cha", "age", "vit", "sa"][Math.floor(rng() * 6)] + "_p";
      const q = clamp(Math.floor(V / F.REF[kind]), 1, 10); lot.cons = [id, q]; goods = q * F.REF[kind];
    } else if (kind === "coffre") {
      const T = E.CHEST_TIERS[CONSUMABLES[C.chest].tier]; const ref = 2 * T.k * top;
      const q = clamp(Math.floor(V / ref), 1, 5); lot.cons = [C.chest, q]; goods = q * ref;
    } else if (kind === "potion") {
      const q = clamp(Math.floor(V / F.REF.potion), 1, 5); lot.cons = ["potion_savoir", q]; goods = q * F.REF.potion;
    } else if (kind === "sab") {
      const B = E.sab ? E.sab(S) : null; const room = B && B.open ? Math.floor((E.SAB_GIFT_MAX - B.r) / 3600) : 0;
      const q = Math.min(3, Math.floor(V / F.REF.sab), room);
      if (q >= 1) { lot.sab = q; goods = q * F.REF.sab; } // sinon (Sablier pas encore débloqué ou plein) : des kamas
    } else if (kind === "key") {
      const L = keyDungeons(S);
      if (L.length) { const d = L[Math.floor(rng() * L.length)]; const ref = Math.max(F.REF.keyMin, F.REF.keyLvl * (DUNGEONS[d].lvl || 1));
        const q = clamp(Math.floor(V / ref), 1, 10); lot.key = [DUNGEONS[d].key, q]; goods = q * ref; }
    } else if (kind === "item") {
      const pool = E.chestItemPool ? E.chestItemPool(top).filter((t) => ITEMS[t] && ITEMS[t].slot !== "dofus") : [];
      if (pool.length) { lot.item = pool[Math.floor(rng() * pool.length)]; goods = Math.round(V / 2); }
    }
    lot.k = Math.max(0, V - goods);
    return lot;
  };
  E.foireLotTxt = (lot) => {
    const p = [];
    if (lot.title) p.push(`titre « ${lot.title} »`);
    if (lot.res) p.push(`${lot.res[1].toLocaleString("fr-FR")} × ${lot.res[0]}`);
    if (lot.cons) p.push(`${lot.cons[1] > 1 ? lot.cons[1] + " × " : ""}${CONSUMABLES[lot.cons[0]].name}`);
    if (lot.sab) p.push(`${lot.sab} h de Sablier de Xélor`);
    if (lot.key) p.push(`${lot.key[1] > 1 ? lot.key[1] + " × " : ""}${lot.key[0]}`);
    if (lot.item) p.push(ITEMS[lot.item].name);
    if (lot.k > 0) p.push(`${lot.k.toLocaleString("fr-FR")} kamas`);
    return p.join(" et ");
  };
  const give = (S, lot) => {
    if (lot.k > 0) S.kamas += lot.k;
    if (lot.title) { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(lot.title)) S.titlesExtra.push(lot.title); }
    if (lot.res) E.addRes(S, lot.res[0], lot.res[1]);
    if (lot.cons) E.addCons(S, lot.cons[0], lot.cons[1]);
    if (lot.sab && E.sabGift) E.sabGift(S, lot.sab);
    if (lot.key) E.addRes(S, lot.key[0], lot.key[1]);
    if (lot.item) { const it = E.rollItem(S, lot.item, {}); lot.uid = it && it.uid; }
  };

  /* ---------- ouvrir une caisse ---------- */
  E.foireOpen = (S, caisse) => {
    const C = F.CAISSES.find((x) => x.id === caisse); if (!C) return { err: "Caisse inconnue." };
    const G = E.foireState(S);
    if (G.n >= F.DAY) return { err: `Tu as ouvert tes ${F.DAY} caisses du jour : le Trool rouvre demain.` };
    if (S.kamas < C.cost) return { err: `Il faut ${C.cost.toLocaleString("fr-FR")} kamas pour la ${C.name}.` };
    S.kamas -= C.cost; G.n++;
    const lot = E.foireLot(S, C.id, mkRng(G));
    give(S, lot);
    G.tot.n++; G.tot.mise += C.cost; G.tot.k += lot.k;
    if (E.dofusQuestEvent) E.dofusQuestEvent(S, "foire", { n: 1 }); // 1.1 : étape du Dofus du Trool
    const txt = E.foireLotTxt(lot);
    G.log.unshift({ t: E.now(), c: C.id, r: lot.r, txt }); G.log = G.log.slice(0, 8);
    E.note(S, `${C.name} : ${F.RAR[lot.r].name.toLowerCase()}, ${txt}.`, "info"); // pas de bulle : la page montre le lot au bout du défilement
    return { ok: true, lot, txt, caisse: C };
  };

  /* Carnet de bord (js/suivi.js) : les mises et les kamas des lots ont leur case dans le bilan des kamas */
  if (E.ACTIONS && !E.ACTIONS.foireOpen) E.ACTIONS.foireOpen = "ouvrir une Caisse du Trool";
  if (E.CARNET_IN && E.CARNET_OUT) { E.CARNET_IN.foire = "Foire du Trool"; E.CARNET_OUT.foire = "Foire du Trool"; }
  if (E.carnetCat) E.carnetCat({ foireOpen: "foire" });
  if (E.carnetWrap) E.carnetWrap();

  if (E.deserialize) { const d0 = E.deserialize; E.deserialize = (txt) => { const S = d0(txt); if (S && S.foire) E.foireState(S); return S; }; }
})(typeof window !== "undefined" ? window : globalThis);
