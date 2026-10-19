/* ============================================================================
   Monocompte — Pass de saison et hauts faits (maquette finale validée par Mathis le 18/10/2026, « 1A » ; « Go » le 19/10)
   - Pass gratuit de 50 paliers, monté avec les points des quêtes de saison (3 quêtes du jour, 3 de la semaine,
     les mêmes pour tout le serveur). Jamais payant.
   - Ligne Prestige : ses récompenses s'ouvrent avec les points de Prestige gagnés par les hauts faits de saison
     (bronze 1, argent +1, or +1) : la récompense Prestige du palier n demande le palier n atteint et n points.
   - Hauts faits en 4 familles (Solo, Groupe, Artisan, Camp), 6 par famille, plus des hauts faits secrets.
     Famille complète (ses 6 hauts faits au moins en bronze) : un cosmétique. Ceux qui attendent le serveur
     (groupes en direct, Boss de saison, guerre des camps) sont affichés « à venir ».
   Réglage : 500 points par palier (25 000 pour les 50). Une saison de 8 semaines rapporte jusqu'à
   56 × 300 (jour) + 8 × 1 050 (semaine) = 25 200 points : les 50 paliers demandent de jouer presque chaque jour.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  if (!E.MONO) return;
  const BP = (E.MONO.bp = { tiers: 50, step: 500, day: 100, week: 350 });

  /* ---------- récompenses (format des codes cadeaux : k kamas, c consommables, x lignes de E.GIFT_X) ---------- */
  const R = {
    k: (n) => ({ k: n }), c: (id, q = 1) => ({ c: [[id, q]] }), x: (t, id, q = 1) => ({ x: [[t, id, q]] }),
  };
  const sum = (...a) => a.reduce((o, d) => ({ k: (o.k || 0) + (d.k || 0), c: (o.c || []).concat(d.c || []), x: (o.x || []).concat(d.x || []) }), {});
  E.MONO_TITLES = { vet: "Vétéran de la Saison 1", pres: "Prestige de la Saison 1", artisan: "Maître artisan de la Saison 1" };
  const FREE = {}, PRES = {};
  for (let t = 1; t <= BP.tiers; t++) {
    // ligne gratuite : kamas, temps de Sablier, coffres ; grands paliers tous les 5
    FREE[t] = [R.k(20000 + 2000 * t), R.c("fiole_temps"), R.c("coffre_argent"), R.x("m", "essence", 300), R.c("coffre_or")][t % 5];
    PRES[t] = [R.x("m", "essence", 500), R.k(40000 + 4000 * t), R.c("grain_xelor"), R.c("coffre_or"), R.c("fiole_temps", 2)][t % 5];
  }
  Object.assign(FREE, { 5: R.c("coffre_or"), 10: R.x("pet", "bwak_de_feu"), 15: sum(R.c("coffre_obsidienne"), R.x("dgh", "h", 2)), 20: R.c("coffre_obsidienne"),
    25: R.x("orn", "mono_s1"), 30: R.x("mt", "dd/Émeraude"), 35: R.c("coffre_obsidienne"), 40: R.x("wing", "argent"), 45: sum(R.c("coffre_obsidienne"), R.c("fiole_temps", 3)),
    50: sum(R.c("coffre_douze"), R.x("aura", "aura"), R.x("tit", E.MONO_TITLES.vet)) });
  Object.assign(PRES, { 5: R.x("tit", E.MONO_TITLES.pres), 10: R.x("pet", "nomoon"), 15: R.c("coffre_obsidienne"), 20: R.c("coffre_douze"),
    25: R.x("orn", "mono_pres"), 30: R.x("mt", "dd/Ivoire"), 35: R.c("coffre_douze"), 40: R.x("wing", "or"), 45: R.c("coffre_douze", 2), 50: sum(R.c("coffre_douze", 2), R.x("fr", "mono_pres")) });
  E.MONO_PASS = { free: FREE, pres: PRES };

  /* ---------- état ---------- */
  E.bpState = (S) => {
    const M = S.mono; if (!M) return null; const s = M.s || 1;
    if (!M.bp || M.bp.s !== s) M.bp = { s, pts: 0, free: {}, pres: {}, q: {}, hf: {}, cnt: {} };
    return M.bp;
  };
  E.bpTier = (S) => { const B = E.bpState(S); return B ? Math.min(BP.tiers, Math.floor(B.pts / BP.step)) : 0; };
  E.bpPrestigePts = (S) => { const B = E.bpState(S); return B ? Object.values(B.hf).reduce((a, m) => a + m, 0) : 0; };
  E.bpCanClaim = (S, line, t) => { const B = E.bpState(S); if (!B || !(t >= 1 && t <= BP.tiers) || B[line][t]) return false;
    return E.bpTier(S) >= t && (line === "free" || E.bpPrestigePts(S) >= t); };
  const giveR = (S, d) => {
    if (d.k) S.kamas += d.k;
    (d.c || []).forEach(([id, q]) => { if (D.CONSUMABLES[id]) E.addCons(S, id, q); });
    (d.x || []).forEach(([t, id, q]) => { const X = E.GIFT_X && E.GIFT_X[t]; if (X && X.ok(id)) try { X.give(S, id, q || 1); } catch (e) {} });
  };
  E.bpRewardText = (d) => (E.giftText ? E.giftText(d) : "");
  E.bpClaim = (S, line, t) => {
    if (!E.isMono(S)) return "Réservé au Monocompte.";
    const B = E.bpState(S); const d = (line === "pres" ? PRES : FREE)[t]; if (!d) return "Palier inconnu.";
    if (B[line][t]) return "Déjà récupéré.";
    if (E.bpTier(S) < t) return `Palier ${t} pas encore atteint.`;
    if (line === "pres" && E.bpPrestigePts(S) < t) return `Il faut ${t} points de Prestige (hauts faits de saison).`;
    B[line][t] = E.now(); giveR(S, d);
    E.note(S, `Pass de saison, palier ${t}${line === "pres" ? " Prestige" : ""} : ${E.bpRewardText(d)}.`, "rare");
    return null;
  };
  E.bpClaimAll = (S) => { let n = 0; for (let t = 1; t <= BP.tiers; t++) for (const l of ["free", "pres"]) if (E.bpCanClaim(S, l, t) && !E.bpClaim(S, l, t)) n++; return n; };

  /* ---------- ornements et cadre de saison (sceaux dessinés par des émojis, comme les ornements du Défi) ---------- */
  if (E.ORN) {
    E.ORN.mono_s1 = { name: () => "Sceau de la Saison 1", req: "Pass de saison du Monocompte, palier 25", ok: (S) => !!(S.unlocks && S.unlocks.gift_o_mono_s1) };
    E.ORN.mono_pres = { name: () => "Étoile Prestige", req: "Pass de saison du Monocompte, palier 25 Prestige", ok: (S) => !!(S.unlocks && S.unlocks.gift_o_mono_pres) };
    E.ORN.mono_solo = { name: () => "Lame du héros seul", req: "Monocompte : tous les hauts faits Solo d'une saison", ok: (S) => !!(S.unlocks && S.unlocks.gift_o_mono_solo) };
  }
  if (E.SFRAMES) E.SFRAMES.mono_pres = { name: () => "Cadre Prestige", req: "Pass de saison du Monocompte, palier 50 Prestige", ok: (S) => !!(S.unlocks && S.unlocks.gift_f_mono_pres) };

  /* ---------- quêtes de saison : 3 du jour, 3 de la semaine, tirées pour tout le serveur ---------- */
  // ev : événement du moteur ; n(d) : avancée ; need : objectif
  const QD = [
    { id: "dj", n: "Finir 3 donjons", ev: "dungeon", need: 3 },
    { id: "win", n: "Gagner 60 combats", ev: "win", need: 60 },
    { id: "boss", n: "Vaincre un boss en stasis 3 ou plus", ev: "dungeon", f: (d) => (d.stasis || 1) >= 3, need: 1 },
    { id: "arch", n: "Vaincre un archimonstre", ev: "win", f: (d) => (d.mons || []).some((m) => m.archi), need: 1 },
    { id: "harv", n: "Récolter 300 ressources", ev: "harvest", v: (d) => d.n || 0, need: 300 },
    { id: "craft", n: "Fabriquer 5 objets", ev: "craft", need: 5 },
    { id: "fm", n: "Tenter 20 runes de forgemagie", ev: "fm", need: 20 },
    { id: "sb", n: "Participer au Boss de saison (21 h)", ev: "sboss", need: 1 },
  ];
  const QW = [
    { id: "wdj", n: "Finir 20 donjons", ev: "dungeon", need: 20 },
    { id: "wst", n: "Finir un donjon en stasis 5 ou plus", ev: "dungeon", f: (d) => (d.stasis || 1) >= 5, need: 1 },
    { id: "wwin", n: "Gagner 400 combats", ev: "win", need: 400 },
    { id: "wharv", n: "Récolter 3 000 ressources", ev: "harvest", v: (d) => d.n || 0, need: 3000 },
    { id: "wcraft", n: "Fabriquer 40 objets", ev: "craft", need: 40 },
    { id: "wnod", n: "Finir 5 donjons sans qu'aucun héros tombe", ev: "dungeon", f: (d) => !d.down, need: 5 },
    { id: "wmd", n: "Défi de la manche : 3 essais", ev: "mdefi", need: 3 },
  ];
  E.MONO_QUESTS = { day: QD, week: QW };
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
  const pick = (L, key, n) => { const a = L.slice(); let r = hash(key); for (let i = a.length - 1; i > 0; i--) { r = Math.imul(r ^ (r >>> 13), 1103515245) + 12345 >>> 0; const j = r % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  // jour et semaine à l'heure de Paris (le lundi commence la semaine)
  const paris = (t) => { const d = new Date(t); const off = (() => { try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(d); return ((+p - d.getUTCHours() + 24) % 24) * 3600000; } catch (e) { return 3600000; } })(); return t + off; };
  E.bpDay = (t = E.now()) => Math.floor(paris(t) / 86400000);
  E.bpWeek = (t = E.now()) => Math.floor((E.bpDay(t) + 3) / 7); // jour 0 = jeudi 1/1/1970
  E.bpLeft = (kind, t = E.now()) => { const p = paris(t); const day = 86400000; const end = kind === "day" ? (Math.floor(p / day) + 1) * day : ((E.bpWeek(t) + 1) * 7 - 3) * day; return Math.max(0, end - p); };
  E.bpQuests = (S) => {
    const B = E.bpState(S); if (!B) return null; const s = B.s;
    const dk = "d" + E.bpDay(), wk = "w" + E.bpWeek();
    if (!B.q[dk]) { for (const k in B.q) if (k[0] === "d") delete B.q[k]; B.q[dk] = pick(QD, `s${s}:${dk}`, 3).map((q) => ({ id: q.id, p: 0 })); }
    if (!B.q[wk]) { for (const k in B.q) if (k[0] === "w") delete B.q[k]; B.q[wk] = pick(QW, `s${s}:${wk}`, 3).map((q) => ({ id: q.id, p: 0 })); }
    return { day: B.q[dk], week: B.q[wk] };
  };
  const qDef = (id) => QD.find((q) => q.id === id) || QW.find((q) => q.id === id);
  const addPts = (S, n, why) => { const B = E.bpState(S); const t0 = E.bpTier(S); B.pts += n; const t1 = E.bpTier(S);
    E.note(S, `Pass de saison : +${n} points (${why}).`, "info"); if (t1 > t0) E.note(S, `Pass de saison : palier ${t1} atteint !`, "rare"); };
  const onQuest = (S, ev, d) => {
    const Q = E.bpQuests(S); if (!Q) return;
    [["day", BP.day], ["week", BP.week]].forEach(([k, pts]) => Q[k].forEach((x) => { const q = qDef(x.id); if (!q || q.ev !== ev || x.p >= q.need) return;
      if (q.f && !q.f(d)) return; x.p = Math.min(q.need, x.p + (q.v ? q.v(d) : 1)); if (x.p >= q.need) addPts(S, pts, q.n); }));
  };

  /* ---------- hauts faits de saison ---------- */
  // v(S, B) : valeur actuelle ; m : seuils bronze, argent, or ; soon : attend le serveur ; secret : nom caché tant qu'il n'est pas obtenu
  const C = (k) => (B) => B.cnt[k] || 0;
  const HF = [
    { id: "s_stasis", fam: "solo", n: "Seul contre tous", d: "Finir un donjon seul en stasis", m: [5, 6, 7], v: C("soloSt") },
    { id: "s_boss", fam: "solo", n: "Chasseur de boss", d: "Boss de donjon vaincus", m: [25, 100, 300], v: C("dj") },
    { id: "s_lvl", fam: "solo", n: "Héros de la saison", d: "Niveau du héros", m: [100, 160, 200], v: (B, S) => Math.max(0, ...S.chars.filter((c) => !c.merc).map((c) => c.lvl)) },
    { id: "s_arch", fam: "solo", n: "Traqueur d'archimonstres", d: "Archimonstres vaincus", m: [5, 20, 50], v: C("arch") },
    { id: "s_clean", fam: "solo", n: "Sans une égratignure", d: "Donjons finis sans qu'aucun héros tombe", m: [10, 50, 150], v: C("clean") },
    { id: "s_tour", fam: "solo", n: "Tour du monde", d: "Donjons différents finis", m: [10, 30, 60], v: (B) => Object.keys(B.cnt.djs || {}).length },
    { id: "g_merc", fam: "groupe", n: "Compagnon d'armes", d: "Donjons finis avec un mercenaire", m: [5, 20, 60], v: C("merc") },
    { id: "g_dj", fam: "groupe", n: "Toujours à plusieurs", d: "Donjons finis en groupe", m: [5, 25, 100], v: C("grp"), soon: 1 },
    { id: "g_st", fam: "groupe", n: "Cordée", d: "Finir un donjon en groupe en stasis", m: [7, 8, 9], v: C("grpSt"), soon: 1 },
    { id: "g_four", fam: "groupe", n: "Groupe complet", d: "Donjons finis à 4 joueurs", m: [1, 10, 40], v: C("grp4"), soon: 1 },
    { id: "g_boss", fam: "groupe", n: "Briseur de Comte", d: "Boss de saison vaincus avec ton camp", m: [1, 5, 15], v: C("sboss"), soon: 1 },
    { id: "g_koli", fam: "groupe", n: "Duelliste", d: "Combats de Kolizéum 1 contre 1 gagnés", m: [5, 25, 100], v: C("koli"), soon: 1 },
    { id: "a_craft", fam: "artisan", n: "Établi chaud", d: "Objets fabriqués", m: [50, 250, 1000], v: C("craft") },
    { id: "a_harv", fam: "artisan", n: "Moissonneur", d: "Ressources récoltées", m: [2000, 10000, 40000], v: C("harv") },
    { id: "a_fm", fam: "artisan", n: "Main de forgemage", d: "Runes de forgemagie tentées", m: [100, 500, 2000], v: C("fm") },
    { id: "a_spec", fam: "artisan", n: "Spécialiste", d: "Niveau de ta meilleure spécialité", m: [100, 150, 200], v: (B, S) => Math.max(0, ...E.monoSpecs(S).filter(Boolean).map((j) => ((D.GATHER_JOBS[j] ? S.jobs[j] : (S.crafts || {})[j]) || {}).lvl || 0)) },
    { id: "a_jobs", fam: "artisan", n: "Touche-à-tout", d: "Métiers au niveau 100", m: [3, 6, 10], v: (B, S) => Object.values(S.jobs || {}).concat(Object.values(S.crafts || {})).filter((J) => J && J.lvl >= 100).length },
    { id: "a_exo", fam: "artisan", n: "Exotique", d: "Runes exotiques passées", m: [1, 3, 10], v: C("exo") },
    { id: "c_align", fam: "camp", n: "Fidèle à son camp", d: "Niveau d'alignement", m: [20, 50, 100], v: (B, S) => (S.align && S.align.lvl) || 0 },
    { id: "c_bounty", fam: "camp", n: "Chasseur de primes", d: "Avis de recherche remplis", m: [5, 20, 50], v: C("bounty") },
    { id: "c_war", fam: "camp", n: "Soldat de la guerre", d: "Combats gagnés pour ton camp", m: [200, 1000, 4000], v: (B) => Object.values(B.war || {}).reduce((a, w) => a + (w.tot || 0), 0) },
    { id: "c_hold", fam: "camp", n: "Gardien de zone", d: "Jours où ton camp tient une zone", m: [3, 10, 30], v: C("hold"), soon: 1 },
    { id: "c_live", fam: "camp", n: "Rendez-vous de 21 h", d: "Soirées de Boss de saison", m: [1, 5, 15], v: C("live") },
    { id: "c_top", fam: "camp", n: "Fer de lance", d: "Semaines dans le top 10 de ton camp", m: [1, 3, 6], v: C("top"), soon: 1 },
    { id: "x_ten", fam: "secret", secret: 1, n: "Au-delà du possible", d: "Finir un donjon seul en stasis 10", m: [1, 1, 1], v: (B) => ((B.cnt.soloSt || 0) >= 10 ? 1 : 0) },
    { id: "x_day", fam: "secret", secret: 1, n: "Infatigable", d: "Finir 30 donjons dans la même journée", m: [1, 1, 1], v: (B) => (B.cnt.bestDay || 0) >= 30 ? 1 : 0 },
  ];
  E.MONO_HF = HF;
  E.MONO_FAM = { solo: { n: "Solo", gift: R.x("orn", "mono_solo"), txt: "ornement « Lame du héros seul »" }, groupe: { n: "Groupe", gift: R.x("wing", "sombre"), txt: "ailes sombres" },
    artisan: { n: "Artisan", gift: R.x("tit", E.MONO_TITLES.artisan), txt: `titre « ${E.MONO_TITLES.artisan} »` }, camp: { n: "Camp", gift: R.x("mt", "dd/Pourpre"), txt: "Dragodinde Pourpre" } };
  // médaille : 0 rien, 1 bronze, 2 argent, 3 or (un haut fait secret donne 3 d'un coup)
  E.hfMedal = (S, H) => { const B = E.bpState(S); const v = H.v(B, S) || 0; return H.secret ? (v >= 1 ? 3 : 0) : H.m.filter((x) => v >= x).length; };
  E.hfValue = (S, H) => H.v(E.bpState(S), S) || 0;
  E.hfCheck = (S) => {
    if (!E.isMono(S)) return; const B = E.bpState(S);
    HF.forEach((H) => { if (H.soon) return; const m = E.hfMedal(S, H), o = B.hf[H.id] || 0; if (m <= o) return; B.hf[H.id] = m;
      E.note(S, `Haut fait de saison${H.secret ? " secret" : ""} : « ${H.n} » ${["", "bronze", "argent", "or"][m]} (+${m - o} Prestige).`, "rare"); });
    Object.keys(E.MONO_FAM).forEach((f) => { const L = HF.filter((H) => H.fam === f); if (B.fam && B.fam[f]) return;
      if (L.every((H) => (B.hf[H.id] || 0) >= 1)) { (B.fam = B.fam || {})[f] = E.now(); giveR(S, E.MONO_FAM[f].gift); E.note(S, `Famille ${E.MONO_FAM[f].n} complète : ${E.MONO_FAM[f].txt}.`, "rare"); } });
  };


  /* ---------- Défi de la manche : un donjon imposé pendant 2 semaines, le même pour tout le serveur ----------
     On monte la stasis une par une (pas besoin de clé, essais libres). Chaque nouvelle stasis du défi donne des points
     de pass ; la meilleure stasis de la manche donne un coffre, à récupérer à la manche suivante. Les classements
     (seul et en groupe) arriveront avec le serveur Monocompte. */
  const MD = (E.MONO.md = { band: [[50, 100], [120, 170], [180, 200], [200, 200]], pts: 60, chest: [[10, "coffre_douze"], [8, "coffre_obsidienne"], [6, "coffre_or"], [3, "coffre_argent"]] });
  E.mdDungeon = (S, m) => { const s = (S.mono && S.mono.s) || 1; m = m || Math.min(4, E.monoManche(S)); const [a, b] = MD.band[(m - 1) % 4];
    const L = Object.keys(D.DUNGEONS).filter((k) => D.DUNGEONS[k].lvl >= a && D.DUNGEONS[k].lvl <= b).sort(); return L[hash(`md:${s}:${m}`) % L.length]; };
  E.mdState = (S) => { const B = E.bpState(S); if (!B) return null; const m = Math.min(4, E.monoManche(S)); B.md = B.md || {}; return (B.md[m] = B.md[m] || { did: E.mdDungeon(S, m), best: 0, tries: 0 }); };
  E.mdChest = (best) => { const r = MD.chest.find(([k]) => best >= k); return r ? r[1] : null; };
  // coffres des manches passées pas encore récupérés
  E.mdPending = (S) => { const B = E.bpState(S); if (!B || !B.md) return []; const m = Math.min(4, E.monoManche(S));
    return Object.keys(B.md).map(Number).filter((k) => k < m && !B.md[k].got && E.mdChest(B.md[k].best)).map((k) => ({ m: k, best: B.md[k].best, chest: E.mdChest(B.md[k].best) })); };
  E.mdClaim = (S, m) => { const B = E.bpState(S); const R = B && B.md && B.md[m]; if (!R || R.got) return "Rien à récupérer."; if (m >= Math.min(4, E.monoManche(S))) return "La manche n'est pas finie.";
    const c = E.mdChest(R.best); if (!c) return "Pas de coffre pour cette manche."; R.got = E.now(); E.addCons(S, c, 1);
    E.note(S, `Défi de la manche ${m} : ${(D.CONSUMABLES[c] || {}).name} (stasis ${R.best}).`, "rare"); return null; };
  E.mdEnter = (S) => {
    if (!E.isMono(S)) return "Réservé au Monocompte."; if (S.dungeon) return "Vous êtes déjà en donjon.";
    const R = E.mdState(S); const dg = D.DUNGEONS[R.did]; const k = Math.min(E.STASIS_MAX, R.best + 1);
    const SI = E.stasisInfo(S, R.did); const max0 = SI.max || 0; SI.max = Math.max(max0, k - 1);
    const du = E.dungeonUnlocked; E.dungeonUnlocked = () => true; S.res[dg.key] = (S.res[dg.key] || 0) + 1; let err;
    try { err = E.enterDungeon(S, R.did, k); } finally { E.dungeonUnlocked = du; }
    if (err) { SI.max = max0; S.res[dg.key]--; if (!S.res[dg.key]) delete S.res[dg.key]; return err; }
    R.tries++; S.mono.mdRun = { did: R.did, k, max0 }; onQuest(S, "mdefi", {}); return null;
  };
  const mdDone = (S, d) => { const run = S.mono.mdRun; if (!run || d.id !== run.did) return; const R = E.mdState(S); delete S.mono.mdRun;
    if ((d.stasis || 1) > R.best) { const n = (d.stasis || 1) - R.best; R.best = d.stasis || 1; addPts(S, MD.pts * n, `Défi de la manche, stasis ${R.best}`); } };
  const tickMd = E.tick;
  E.tick = function (S) { const r = tickMd.apply(this, arguments);
    if (S && S.mono && S.mono.mdRun && (!S.dungeon || S.dungeon.id !== S.mono.mdRun.did)) { const run = S.mono.mdRun; delete S.mono.mdRun; const SI = E.stasisInfo(S, run.did); if ((SI.max || 0) < run.k) SI.max = run.max0; }
    return r; };

  /* ---------- Guerre Bonta / Brâkmar (partie du jeu ; les totaux du serveur arriveront avec le serveur Monocompte) ----------
     Le camp (l'alignement) se choisit une fois par saison. Chaque combat gagné en chasse donne 1 point à ton camp dans
     cette zone pour la manche ; le serveur additionnera les points de tous les joueurs pour savoir qui tient la zone. */
  const choose1 = E.chooseAlign;
  E.chooseAlign = function (S, side) {
    if (S && E.isMono(S) && S.align && S.align.side && S.align.side !== side) return "Monocompte : un seul camp par saison. Tu pourras changer à la saison suivante.";
    return choose1.apply(this, arguments);
  };
  E.warState = (S) => { const B = E.bpState(S); if (!B) return null; const m = Math.min(4, E.monoManche(S)); B.war = B.war || {}; return (B.war[m] = B.war[m] || { z: {}, tot: 0 }); };
  const warWin = (S, d) => { if (!S.align || !S.align.side || !d.sub || d.dungeon) return; const W = E.warState(S); W.z[d.sub] = (W.z[d.sub] || 0) + 1; W.tot++; };

  /* ---------- Boss de saison : Comte Harebourg, tous les soirs de 21 h à 22 h (heure de Paris), 3 essais ----------
     Le combat est celui du Boss des mondes (js/wboss.js) ; ici seul ou avec un mercenaire, en groupe avec le serveur.
     Les dégâts de tous les joueurs d'un camp s'additionneront sur le serveur (le camp en tête : +10 % d'XP pour la manche). */
  const SB = (E.MONO.sb = { did: "donjon_harebourg", hour: 21, tries: 3, evenings: 5 });
  E.sbDef = () => { if (!E.WB_ROT || !E.wbDef) return null; const i = E.WB_ROT.findIndex((r) => r.did === SB.did); return i < 0 ? null : E.wbDef(i + 1); };
  E.sbOpen = (t = E.now()) => { const p = paris(t); const h = Math.floor((p % 86400000) / 3600000); return h === SB.hour; };
  E.sbNext = (t = E.now()) => { const p = paris(t), day = 86400000; const today = Math.floor(p / day) * day + SB.hour * 3600000; return E.sbOpen(t) ? 0 : (p < today ? today : today + day) - p; };
  E.sbState = (S) => { const B = E.bpState(S); if (!B) return null; B.sb = B.sb || { days: {}, best: 0, tot: 0 }; const k = E.bpDay(); return { B: B.sb, day: (B.sb.days[k] = B.sb.days[k] || { tries: 0, pts: 0 }) }; };
  E.sbTry = (S) => {
    if (!E.isMono(S)) return { err: "Réservé au Monocompte." };
    if (!E.sbOpen()) return { err: "Le Boss de saison n'est là que de 21 h à 22 h (heure de Paris)." };
    if (S.dungeon) return { err: "Termine d'abord ton donjon." };
    const def = E.sbDef(); if (!def) return { err: "Boss introuvable." };
    const st = E.sbState(S); if (st.day.tries >= SB.tries) return { err: `${SB.tries} essais par soir : reviens demain à 21 h.` };
    const r = E.wbSim(S, def, 1, hash(`sb|${S.mono.s}|${E.bpDay()}|${st.day.tries}|${(S.chars[0] || {}).name}`)); if (r.err) return r;
    st.day.tries++; st.day.pts += r.points; st.B.tot += r.points; st.B.best = Math.max(st.B.best, r.points);
    const G = E.wbGrade(r.points); Object.entries(G.cons || {}).forEach(([id, q]) => E.addCons(S, id, q));
    const evenings = Object.values(st.B.days).filter((x) => x.tries > 0).length; inc(E.bpState(S), "live", 0); E.bpState(S).cnt.live = evenings;
    if (evenings >= SB.evenings) { S.unlocks = S.unlocks || {}; if (!S.unlocks.gift_o_mono_sb) { S.unlocks.gift_o_mono_sb = 1; E.note(S, "Boss de saison : 5 soirées, ornement « Horloge du Comte » débloqué.", "rare"); } }
    E.note(S, `Boss de saison : ${r.points} points (grade ${r.grade}).`, "info"); E.emit(S, "sboss", { pts: r.points });
    return Object.assign({}, r, { grade: G });
  };
  if (E.ORN) E.ORN.mono_sb = { name: () => "Horloge du Comte", req: "Monocompte : Boss de saison 5 soirs", ok: (S) => !!(S.unlocks && S.unlocks.gift_o_mono_sb) };
  /* ---------- écoute du moteur ---------- */
  const inc = (B, k, n = 1) => (B.cnt[k] = (B.cnt[k] || 0) + n);
  const emit0 = E.emit;
  E.emit = function (S, t, d) {
    const r = emit0.apply(this, arguments);
    if (S && S.mono && !S.monoRun && !(d && d.offline && t === "win")) try {
      const B = E.bpState(S); d = d || {};
      if (t === "dungeon") { mdDone(S, d); inc(B, "dj"); (B.cnt.djs = B.cnt.djs || {})[d.id] = 1; if (!d.down) inc(B, "clean");
        const day = E.bpDay(); if (B.cnt.dayK !== day) { B.cnt.dayK = day; B.cnt.dayN = 0; } B.cnt.dayN++; B.cnt.bestDay = Math.max(B.cnt.bestDay || 0, B.cnt.dayN);
        if (d.group) { inc(B, "grp"); B.cnt.grpSt = Math.max(B.cnt.grpSt || 0, d.stasis || 1); if (d.players >= 4) inc(B, "grp4"); }
        else { if (S.mono.merc) inc(B, "merc"); else B.cnt.soloSt = Math.max(B.cnt.soloSt || 0, d.stasis || 1); } }
      if (t === "win") { (d.mons || []).forEach((m) => { if (m.archi) inc(B, "arch"); }); warWin(S, d); }
      if (t === "harvest") inc(B, "harv", d.n || 0);
      if (t === "craft") inc(B, "craft");
      if (t === "fm") inc(B, "fm");
      if (t === "exo") inc(B, "exo");
      if (t === "bounty") inc(B, "bounty");
      onQuest(S, t, d);
      if (/^(dungeon|win|harvest|craft|fm|exo|bounty|level|joblvl|align|sboss)$/.test(t)) E.hfCheck(S);
    } catch (e) {}
    return r;
  };
})(typeof window !== "undefined" ? window : globalThis);
