/* ============================================================================
   COLLECTIONS — Idlus 1.0.30 (choix 32A, avec plus de bonus et des bonus uniques)
   Collection de panoplies : une panoplie compte dès que chacune de ses pièces a été obtenue au moins une fois
   (comme l'Encyclopédie › Équipements, E.itemDex). La collection ne baisse jamais, même si on brise ou vend des pièces.
   9 paliers, récompenses permanentes du compte (dont 4 uniques) :
     5 titre « Couturier » · 10 +2 % de kamas en chasse · 15 Garde-robe (+1 tenue enregistrée par héros) · 25 +2 % d'XP ·
     40 Retouche (changer de tenue sans rien perdre : une pièce vendue ou brisée est remplacée par une autre copie du sac) ·
     60 +2 % de butin · 80 +3 % de kamas en chasse · 100 Couture fine (il manque 1 pièce, le bonus complet reste) ·
     150 titre « Grand Couturier » et aura dorée en combat.
   Régions : chaque panoplie appartient à la région où tombent la plupart de ses pièces ; une région complète
   (toutes ses panoplies) donne +5 % de butin et de kamas en chasse dans cette région.
   Tous ces bonus passent par E.bonus (systems.js), sous les plafonds habituels. Aucun ne touche aux chances d'obtenir un Dofus.
   Chargé aussi par les tests et le serveur (Couture fine change les caractéristiques : records et Kolizéum). Pas de DOM ici :
   l'interface (page Familiers et montures, Encyclopédie › Panoplies, Potentiel des Dofus) est dans collui.js.
   État : S.collT (paliers déjà annoncés), titres dans S.titlesExtra, g.tp dans les tenues (modèles des pièces, pour la Retouche).
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { ITEMS, SETS, ZONES, DUNGEONS, STATS } = D;
  const SUBS = E.SUBS;

  E.COLL_TIERS = [
    { n: 5, k: "title", title: "Couturier", txt: "Titre « Couturier »" },
    { n: 10, k: "kamas", v: 2, txt: "+2 % de kamas en chasse" },
    { n: 15, k: "gear", u: 1, name: "Garde-robe", txt: "Garde-robe : +1 tenue enregistrée par héros" },
    { n: 25, k: "xp", v: 2, txt: "+2 % d'XP" },
    { n: 40, k: "retouche", u: 1, name: "Retouche", txt: "Retouche : changer de tenue sans rien perdre, une pièce vendue ou brisée est remplacée par une autre copie du sac" },
    { n: 60, k: "drop", v: 2, txt: "+2 % de butin" },
    { n: 80, k: "kamas", v: 3, txt: "+3 % de kamas en chasse" },
    { n: 100, k: "fine", u: 1, name: "Couture fine", txt: "Couture fine : il manque 1 pièce, le bonus complet reste (panoplies de 3 pièces et plus)" },
    { n: 150, k: "aura", u: 1, name: "Grand Couturier", title: "Grand Couturier", txt: "Titre « Grand Couturier » et aura dorée en combat" },
  ];
  E.COLL_REGION = 5; // % de butin et de kamas en chasse dans une région complète

  /* ---------- panoplies et régions (calculé une fois, comme le carnet de panoplies) ---------- */
  let REG = null;
  const zOrder = {}; ZONES.forEach((z, i) => (zOrder[z.id] = i));
  const regIdx = () => {
    if (REG) return REG;
    const dgZone = (did) => { const a = DUNGEONS[did] && DUNGEONS[did].access; return a && SUBS[a] ? SUBS[a].zone : null; };
    const setReg = {}, regSets = {}, ids = [];
    for (const sid in SETS) {
      const P = E.setPieces(sid); if (!P.length) continue; ids.push(sid);
      const zc = {};
      P.forEach((t) => { const zs = new Set();
        E.itemSources(t).forEach((s) => { if (s.k === "craft") return; (s.subs || []).forEach((x) => SUBS[x] && zs.add(SUBS[x].zone)); (s.dgs || []).forEach((d) => { const z = dgZone(d); if (z) zs.add(z); }); });
        zs.forEach((z) => (zc[z] = (zc[z] || 0) + 1)); });
      const best = Object.keys(zc).sort((a, b) => zc[b] - zc[a] || (zOrder[a] || 0) - (zOrder[b] || 0))[0] || null;
      setReg[sid] = best; if (best) (regSets[best] = regSets[best] || []).push(sid);
    }
    const regs = Object.keys(regSets).sort((a, b) => (zOrder[a] || 0) - (zOrder[b] || 0));
    return (REG = { setReg, regSets, ids, regs });
  };
  E.collSets = () => regIdx().ids;
  E.collTotal = () => regIdx().ids.length;
  E.setRegion = (sid) => regIdx().setReg[sid] || null;
  E.regionSets = (z) => regIdx().regSets[z] || [];
  E.collRegions = () => regIdx().regs;
  E.zoneLabel = (z) => { const Z = ZONES.find((x) => x.id === z); return Z ? Z.name : z || ""; };

  /* ---------- état de la collection (gardé en mémoire tant que l'Encyclopédie ne grandit pas) ---------- */
  const cache = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  E.collState = (S) => {
    const dex = E.itemDex(S); const nDex = Object.keys(dex).length; const old = cache && cache.get(S);
    if (old && old.nDex === nDex) return old;
    const done = new Set(); regIdx().ids.forEach((sid) => { if (E.setPieces(sid).every((t) => dex[t])) done.add(sid); });
    const regs = new Set(); regIdx().regs.forEach((z) => { if (regIdx().regSets[z].every((s) => done.has(s))) regs.add(z); });
    const C = { nDex, done, n: done.size, regs };
    if (cache) cache.set(S, C);
    return C;
  };
  E.collN = (S) => E.collState(S).n;
  E.collDone = (S, sid) => E.collState(S).done.has(sid);
  E.collTierIdx = (S) => { const n = E.collN(S); let i = 0; while (i < E.COLL_TIERS.length && n >= E.COLL_TIERS[i].n) i++; return i; }; // paliers atteints
  E.collHas = (S, k) => { const n = E.collN(S); return E.COLL_TIERS.some((T) => T.k === k && n >= T.n); };
  E.collNext = (S) => E.COLL_TIERS[E.collTierIdx(S)] || null;
  /* pièces d'une panoplie : obtenue un jour (dex), dans le sac en ce moment (own) */
  E.collPieces = (S, sid) => { const dex = E.itemDex(S); const own = E.ownedTpls(S); return E.setPieces(sid).map((t) => ({ t, dex: !!dex[t], own: own[t] || 0 })); };
  E.collMissing = (S, sid) => E.setPieces(sid).filter((t) => !E.itemDex(S)[t]);

  /* ---------- bonus du compte (appelé par E.bonus : systems.js) ---------- */
  E.collBonus = (S, kind) => {
    if (!S || !S.chars || (kind !== "xp" && kind !== "drop" && kind !== "kamas")) return 0;
    const C = E.collState(S); const hunt = !S.dungeon; let b = 0;
    E.COLL_TIERS.forEach((T) => { if (T.k === kind && C.n >= T.n && (kind !== "kamas" || hunt)) b += T.v; });
    if ((kind === "kamas" || kind === "drop") && hunt && S.sub && SUBS[S.sub] && C.regs.has(SUBS[S.sub].zone)) b += E.COLL_REGION;
    return b;
  };
  /* Couture fine : une panoplie de 3 pièces et plus à qui il manque 1 pièce donne son bonus complet (appelé par E.charStats) */
  const fullOf = (sid) => (SETS[sid] ? SETS[sid].size || E.setPieces(sid).length : 0); // pièces de la panoplie dans le jeu
  E.setCountFx = (S, sid, n) => { const full = fullOf(sid); return full >= 3 && n === full - 1 && E.collHas(S, "fine") ? full : n; };

  /* ---------- Garde-robe : une tenue de plus par héros ---------- */
  E.maxGear = (S) => E.MAX_GEAR + (S && E.collHas(S, "gear") ? 1 : 0);
  const tplsOf = (S, eq) => { const o = {}; for (const sl in eq) { const it = S.items[eq[sl]]; if (it) o[sl] = it.tpl; } return o; };
  if (!E.saveGear.coll) {
    const save0 = E.saveGear;
    E.saveGear = (S, cid, idx, name) => {
      const c = S.chars.find((x) => x.id === cid);
      if (c && idx >= E.MAX_GEAR && idx < E.maxGear(S)) { // emplacement de la Garde-robe
        c.gear = c.gear || [];
        c.gear[idx] = { name: (name || (c.gear[idx] && c.gear[idx].name) || `Tenue ${idx + 1}`).slice(0, 24), eq: Object.assign({}, c.equip) };
        E.syncGearLocks(S);
      } else save0(S, cid, idx, name);
      const g = c && c.gear && c.gear[idx]; if (g) g.tp = tplsOf(S, g.eq); // modèles des pièces : la Retouche s'en sert
    };
    E.saveGear.coll = 1;
    /* Retouche : une pièce de la tenue vendue ou brisée est remplacée par une autre copie libre du sac */
    const power = (it) => { let s = 0; for (const k in it.stats || {}) s += (+it.stats[k] || 0) * ((STATS[k] && STATS[k].w) || 1); return s; };
    const apply0 = E.applyGear;
    E.applyGear = (S, cid, idx) => {
      const c = S.chars.find((x) => x.id === cid); const g = c && c.gear && c.gear[idx]; let fixed = 0;
      if (g && g.tp && E.collHas(S, "retouche")) {
        const used = new Set(Object.values(g.eq).map(String));
        for (const sl of Object.keys(g.eq)) {
          if (S.items[g.eq[sl]]) continue; const tpl = g.tp[sl]; if (!tpl || !ITEMS[tpl] || ITEMS[tpl].lvl > c.lvl) continue;
          const alt = Object.values(S.items).filter((it) => it.tpl === tpl && !used.has(String(it.uid)) && !E.equippedBy(S, it.uid) && !E.inGear(S, it.uid)).sort((a, b) => power(b) - power(a))[0];
          if (alt) { g.eq[sl] = alt.uid; used.add(String(alt.uid)); fixed++; }
        }
        if (fixed) E.syncGearLocks(S);
      }
      const r = apply0(S, cid, idx); if (r && fixed) r.fixed = fixed;
      return r;
    };
  }

  /* ---------- « Équiper sur » : toutes les pièces libres du sac sur ce héros, en un clic ---------- */
  E.equipSet = (S, cid, sid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    const P = E.setPieces(sid); if (!P.length) return "Panoplie inconnue.";
    const power = (it) => { let s = 0; for (const k in it.stats || {}) s += (+it.stats[k] || 0) * ((STATS[k] && STATS[k].w) || 1); return s; };
    let n = 0, miss = 0, lvl = 0;
    P.forEach((t) => {
      if (ITEMS[t].lvl > c.lvl) { lvl++; return; }
      if (Object.values(c.equip).some((u) => S.items[u] && S.items[u].tpl === t)) { n++; return; }
      const it = Object.values(S.items).filter((x) => x.tpl === t && !E.equippedBy(S, x.uid)).sort((a, b) => power(b) - power(a))[0];
      if (!it) { miss++; return; }
      if (E.equip(S, cid, it.uid)) miss++; else n++;
    });
    return { n, miss, lvl };
  };
  Object.assign(E.ACTIONS, { equipSet: "équiper une panoplie sur un héros (Collection de panoplies)" });

  /* ---------- annonces : panoplie complète, palier, région ; titres ---------- */
  const giveTitle = (S, t) => { S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) S.titlesExtra.push(t); };
  E.collCheck = (S, quiet) => {
    if (!S || !S.chars) return;
    const i = E.collTierIdx(S); const from = typeof S.collT === "number" ? S.collT : i;
    E.COLL_TIERS.slice(0, i).forEach((T, j) => {
      if (T.title) giveTitle(S, T.title);
      if (j >= from && !quiet) { E.note(S, `Collection de panoplies : palier ${T.n} atteint. ${T.txt}.`, "rare"); if (E.celebrate) E.celebrate({ t: "coll", n: T.n }); }
    });
    S.collT = i;
  };
  if (E.itemDexAdd && !E.itemDexAdd.coll) {
    const add0 = E.itemDexAdd; let initing = false;
    E.itemDexAdd = (S, tpl) => {
      const T = ITEMS[tpl]; const fresh = T && T.set && S && S.itemDex && !S.itemDex[tpl] && S.itemDexInit;
      const before = fresh ? E.collState(S) : null;
      add0(S, tpl);
      if (T && T.set && S && S.chars && !S.itemDexInit && !initing) { initing = true; try { E.itemDex(S); } finally { initing = false; } E.collCheck(S); return; } // partie neuve : l'Encyclopédie se remplit d'un coup
      if (!before) return;
      const after = E.collState(S); if (after.n <= before.n) return;
      after.done.forEach((sid) => { if (!before.done.has(sid)) E.note(S, `Collection de panoplies : ${SETS[sid].name} complète (${after.n} / ${E.collTotal()}).`, "up"); });
      after.regs.forEach((z) => { if (!before.regs.has(z)) E.note(S, `Collection de panoplies : toutes les panoplies de ${E.zoneLabel(z)} ! +${E.COLL_REGION} % de butin et de kamas en chasse dans la région.`, "rare"); });
      E.collCheck(S);
    };
    E.itemDexAdd.coll = 1;
  }
  /* état : partie neuve (rien à reprendre) ; partie d'avant la 1.0.30 (collT absent du texte) : titres donnés sans annonce */
  if (!E.newState.coll) {
    const new0 = E.newState; E.newState = (name, cls) => { const S = new0(name, cls); S.collT = 0; return S; }; E.newState.coll = 1;
    const des0 = E.deserialize; E.deserialize = (txt) => {
      const had = typeof txt === "string" && txt.indexOf('"collT"') >= 0; const S = des0(txt);
      try { if (!had) { delete S.collT; E.collCheck(S, true); } else E.collCheck(S); } catch (e) { /* données d'objets absentes : rien */ }
      return S;
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
