/* ============================================================================
   Saison 1, lot 8 : les Expéditions de saison (Mathis, exclusivités 1A : « Expéditions de saison, 3 par manche, avec des
   règles et un classement ; en Monocompte, le Défi de la manche est la première »).
   - Chaque manche (14 jours) ouvre 3 expéditions, les mêmes pour tous : un donjon, une stasis, 2 modificateurs, 3 règles
     du Défi du jour et une règle d'équipe. Plus l'expédition est loin (1 à 3), plus elle est dure (stasis, un modificateur
     de plus pour la 3e). Le palier (Découverte, Aventure, Légende, Élite) suit le héros le plus fort de l'équipe.
   - Le combat se joue d'un coup sur une copie de la partie, avec le moteur du Défi du jour (js/defi.js) : même score en
     points, mêmes bourses (bronze, argent, or). Le hasard est tiré de la manche, de l'expédition et de l'essai.
   - 2 essais par jour et par expédition ; le meilleur score de la manche compte. Classement : la somme des 3 meilleurs
     scores de la manche (envoyée au serveur à l'installation de la saison).
   - Récompenses, une fois par manche, par expédition et par bourse : un coffre (argent, or, obsidienne), un booster de
     cartes à l'or. Titre « Explorateur du Temps » pour 3 bourses en or dans une manche. Seulement dans la partie de saison.
   - Monocompte : une seule expédition par manche (le Défi de la manche), avec une règle d'équipe jouable à un héros.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const s1 = (S) => !!(E.isS1c && E.isS1c(S));

  E.EXPS1_N = 3;
  E.EXPS1_TRIES = 2; // essais par jour et par expédition
  E.EXPS1_NAMES = ["Le Sentier des Heures", "Les Ruines du Sablier", "Le Cœur de la Faille"];
  const CH = { br: "coffre_argent", ar: "coffre_or", or: "coffre_obsidienne" };
  const T_GOLD = "Explorateur du Temps";
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const pickN = (pool, n, hf, tag) => { const p = pool.slice(), out = []; for (let i = 0; i < n && p.length; i++) out.push(p.splice(hf(tag + i) % p.length, 1)[0]); return out; };
  const dayOf = (t) => (E.defiDay ? E.defiDay(t) : Math.floor(t / 86400000));

  E.exps1Count = (S) => (S && S.mono ? 1 : E.EXPS1_N);
  /* l'expédition i (0 à 2) de la manche m, pour un palier : même définition que le Défi du jour (E.defiSim la joue) */
  E.exps1Def = (m, i, tid, mono) => {
    const T = E.defiTier && E.defiTier(tid); if (!T) return null;
    const DG = D.DUNGEONS || {};
    const ids = Object.keys(DG).sort().filter((d) => DG[d].lvl >= (T.id === "eli" ? 141 : T.lo) && DG[d].lvl <= T.hi && DG[d].rooms && DG[d].rooms.length);
    if (!ids.length) return null;
    const h = (s) => hash(`idlus|s1exp|${m}|${i}|${T.id}|${s}`);
    const did = ids[h("donjon") % ids.length];
    const span = T.k[1] - T.k[0];
    const k = Math.min(10, T.k[0] + Math.round((span * i) / Math.max(1, E.EXPS1_N - 1)));
    const mods = pickN(E.DEFI_MODS, 2 + (i >= 2 ? 1 : 0), h, "mod");
    const rules = pickN(E.DEFI_RULES, 3, h, "regle");
    const tk = Object.keys(E.DEFI_TEAM); let team = tk[h("equipe") % tk.length];
    if (mono && !E.defiSoloOk(team)) { const solo = tk.filter(E.defiSoloOk); team = solo[h("equipe-mono") % solo.length]; }
    // day négatif : jamais confondu avec un vrai jour du Défi (équipe adaptée, règles héroïques)
    return { day: -(m * 10 + i + 1), tier: T.id, did, k, mods, rules, extra: [], team, sun: false, mult: 1, seed: h("hasard"), exp: i, m, mono: !!mono };
  };
  E.exps1Tier = (S) => (E.defiTierDefault ? E.defiTierDefault(S) : "dec");
  /* l'équipe adaptée à la règle : null si l'équipe la respecte déjà */
  E.exps1Pick = (S, def) => { const R = def && E.DEFI_TEAM[def.team]; if (!R || R.ok(E.team(S))) return null; const L = E.defiSuggest(S, def); return L.length && R.ok(L) ? L.map((c) => c.id) : null; };
  E.exps1For = (S, i) => E.exps1Def(E.s1cManche(S), i, E.exps1Tier(S), !!S.mono);

  /* l'état de la manche : best[i] = { score, medal, tier, turns, hp } ; tries[i] = { d: jour, n } ; got = bourses reçues */
  const M = (S) => { const c = S.s1c; const m = E.s1cManche(S); if (!c.exps || c.exps.m !== m) c.exps = { m, best: {}, tries: {}, got: {} }; return c.exps; };
  E.exps1State = (S) => (s1(S) ? M(S) : null);
  E.exps1Left = (S, i) => { if (!s1(S) || E.s1cOver(S)) return 0; const t = M(S).tries[i]; return t && t.d === dayOf(E.now()) ? Math.max(0, E.EXPS1_TRIES - t.n) : E.EXPS1_TRIES; };
  E.exps1Total = (S) => { if (!s1(S)) return 0; const B = M(S).best; return Object.keys(B).reduce((a, k) => a + ((B[k] && B[k].score) || 0), 0); };
  E.exps1Gold = (S) => { if (!s1(S)) return 0; const B = M(S).best; return Object.keys(B).filter((k) => B[k] && B[k].medal === "or").length; };

  /* jouer un essai : renvoie un message d'erreur ou { r, def, best, medal, rew: { cons: [], booster, title } } */
  E.exps1Play = (S, i) => {
    if (!s1(S)) return "Les Expéditions de saison se jouent dans la partie de saison.";
    if (E.s1cOver(S)) return "La saison est finie.";
    i = Math.floor(+i); if (!(i >= 0 && i < E.exps1Count(S))) return "Expédition inconnue.";
    if (!E.team(S).length) return "Il faut au moins un héros dans l'équipe.";
    if (!E.exps1Left(S, i)) return "Plus d'essai aujourd'hui pour cette expédition : reviens demain.";
    const C = M(S), d = dayOf(E.now());
    const t = C.tries[i] && C.tries[i].d === d ? C.tries[i] : (C.tries[i] = { d, n: 0 });
    const def0 = E.exps1For(S, i); if (!def0) return "Aucun donjon pour ce palier.";
    const def = Object.assign({}, def0, { seed: (def0.seed + Math.imul(d, 7919) + t.n * 104729) | 0 });
    // si l'équipe ne respecte pas la règle, les héros les plus forts qui la respectent partent (l'équipe de farm ne change pas)
    const pick0 = S.defiPick, ids = E.exps1Pick(S, def);
    if (ids) S.defiPick = { day: def.day, tier: def.tier, ids };
    let r; try { const te = E.defiTeamErr(S, def); if (te) return te.replace("Règle d'équipe du jour", "Règle d'équipe de l'expédition"); r = E.defiSim(S, def); }
    finally { if (pick0 === undefined) delete S.defiPick; else S.defiPick = pick0; }
    if (r.err) return r.err;
    t.n++;
    const med = r.win ? E.defiMedal(r.score) : null;
    const rew = { cons: [], booster: 0, title: null };
    const cur = C.best[i];
    if (r.win && (!cur || r.score > cur.score)) C.best[i] = { score: r.score, medal: med ? med.id : "", tier: def.tier, turns: r.turns, hp: r.hp };
    if (med) { const L = E.DEFI_MEDALS; for (let j = 0; j <= L.indexOf(med); j++) { const key = `${i}${L[j].id}`; if (C.got[key]) continue; C.got[key] = 1;
      const ch = CH[L[j].id]; E.addCons(S, ch); rew.cons.push(ch); if (L[j].id === "or" && E.boosterGive) rew.booster += E.boosterGive(S, 1); } }
    if (E.exps1Gold(S) >= E.exps1Count(S)) { S.s1c.expGold = (S.s1c.expGold || 0) + (C.got.all ? 0 : 1); if (!C.got.all) { C.got.all = 1; rew.title = T_GOLD; } }
    S.s1c.expBest = Math.max(S.s1c.expBest || 0, r.win ? r.score : 0);
    E.emit(S, "exps1", { i, win: r.win, score: r.score });
    return { r, def, best: C.best[i] || null, medal: med, rew, picked: ids ? ids.length : 0 };
  };

  /* titres (de collection) et succès de la saison */
  { const t0 = E.titles; if (t0) E.titles = (S) => { const t = t0(S); if (((S.s1c && S.s1c.expGold) || 0) >= 1 && !t.includes(T_GOLD)) t.push(T_GOLD); return t; }; }
  { const ACH = E.ACH || []; const add = (o) => { if (!ACH.some((a) => a.id === o.id)) ACH.push(Object.assign({ s1: true, cat: "Saison 1", grp: "Expéditions de saison" }, o)); };
    const sb = (S) => (S.s1c && S.s1c.expBest) || 0;
    add({ id: "s1exp1", name: "Premier pas dans la Faille", desc: "Réussir une Expédition de saison.", test: (S) => E.isS1c(S) && sb(S) > 0, prog: (S) => [sb(S) > 0 ? 1 : 0, 1], kamas: 20000 });
    add({ id: "s1exp2", name: "Bourse en or", desc: "Obtenir 2 000 points dans une Expédition de saison.", test: (S) => E.isS1c(S) && sb(S) >= 2000, prog: (S) => [Math.min(2000, sb(S)), 2000], kamas: 60000 });
    add({ id: "s1exp3", name: T_GOLD, desc: "Obtenir les bourses en or de toutes les expéditions d'une manche.", test: (S) => E.isS1c(S) && ((S.s1c && S.s1c.expGold) || 0) >= 1, prog: (S) => [Math.min(1, (S.s1c && S.s1c.expGold) || 0), 1], kamas: 150000 }); }
  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
