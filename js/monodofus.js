/* ============================================================================
   Monocompte — le Dofus de saison (Mathis 19/10 : 1B un seul Dofus pour tous, 2A quête de saison en plusieurs étapes,
   3 A3 « Second souffle », 4A il reste au héros dans l'Éternel et ne s'obtient plus ensuite).
   Il n'existe que dans une partie Monocompte : sa quête lit le pass, le Défi de la manche, la guerre et le Boss de saison.
   Il ne tombe d'aucun boss. Les autres Dofus ne se gagnent plus par leur quête en Monocompte (un Dofus de quête par saison),
   seulement sur leur boss.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  if (!E.MONO || !E.DOFUS || !E.DOFP_LIST) return;
  const pc = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
  const ms = (k, n, x) => Object.assign({ t: "mono", k, n }, x || {});
  /* étapes : war (chasses gagnées pour ton camp), md (meilleure stasis au Défi de la manche), sb (soirs au Boss de saison),
     bp (palier du pass), boss (boss de niveau lvl ou plus en stasis n). Mathis 1A 2A 3A 4A : fini vers la manche 3. */
  const STEPS = [ms("war", 300), ms("md", 6), ms("sb", 4), ms("bp", 25), ms("boss", 7, { lvl: 180 })];
  const SD = (E.MONO.sdofus = { id: "phenix", s: 1, closed: true });
  const id = SD.id, tpl = "dofus_" + id;
  const stats = { vit: 150, sa: 30 };
  /* passif évolutif (Mathis A) : chaque déclenchement compte comme une renaissance, le stade monte à 25, 100 puis 300.
     Cendres : 25 % de PV et +1 PA une fois par combat · Braise : 30 % · Flamme : deux fois par combat · Phénix : en plus,
     une fois par combat, au lieu de tomber il renaît avec 30 % de ses PV. Le compteur reste sur la partie (et dans l'Éternel). */
  const STAGES = [
    { n: "Cendres", at: 0, icon: 99024, heal: 1, uses: 1 },
    { n: "Braise", at: 25, icon: 99021, heal: 1.2, uses: 1 },
    { n: "Flamme", at: 100, icon: 99025, heal: 1.2, uses: 2 },
    { n: "Phénix", at: 300, icon: 99026, heal: 1.2, uses: 2, reborn: 30 },
  ];
  SD.stages = STAGES;
  const reborn = (S) => (S && S.mono && S.mono.phx) || 0;
  const stageOf = (S) => { let i = 0; STAGES.forEach((g, k) => { if (reborn(S) >= g.at) i = k; }); return i; };
  E.phxReborn = reborn; E.phxStage = stageOf;
  let cur = null; // la partie Monocompte chargée (pour le texte et l'icône du Dofus)
  E.DOFUS[id] = { id, name: "Dofus du Phénix", lvl: 180, icon: STAGES[0].icon, stats, dg: null, steps: STEPS, tpl, drop: { none: 1 }, mono: 1 };
  const st = {}; for (const k in stats) st[k] = [stats[k], stats[k]];
  D.ITEMS[tpl] = { name: E.DOFUS[id].name, slot: "dofus", lvl: 180, stats: st, icon: STAGES[0].icon, dofus: id, rarity: "legendaire", desc: null };
  E.DOFP_TRIG.twice = "Deux fois par combat";
  const setIcon = (S) => { const g = STAGES[stageOf(S)]; E.DOFUS[id].icon = D.ITEMS[tpl].icon = g.icon; E.DOFP_LIST[id][4] = g.uses > 1 ? "twice" : "once"; };
  const txt = (x, g) => { const G = STAGES[g], pv = pc(x * G.heal);
    let t = `${G.uses > 1 ? "Deux fois" : "Une fois"} par combat, quand il passe sous 30 % de ses PV, le porteur récupère ${pv} % de ses PV et gagne +1 PA au tour suivant.`;
    if (G.reborn) t += ` Une fois par combat, au lieu de tomber, il renaît avec ${pc(G.reborn * x / 25)} % de ses PV.`;
    const nx = STAGES[g + 1], r = reborn(cur);
    return t + ` Stade ${g + 1}/4 « ${G.n} »${nx ? ` · ${r}/${nx.at} renaissances vers « ${nx.n} »` : ` · ${r} renaissances`}.`; };
  E.DOFP_LIST[id] = ["Second souffle", (x) => txt(x, stageOf(cur)), 25, "Soin", "once", "all"];
  const has = (e) => !!(e && e.dp && e.dp.includes(id));
  const owner = new WeakMap(); // combat → partie du porteur (le combat est enregistré dans la sauvegarde : pas de lien dedans)
  const count = (F, e) => { const S = owner.get(F); if (!S || E.phxFreeze || !E.isMono(S) || e.side !== "c" || e.summon) return;
    const g0 = stageOf(S); S.mono.phx = reborn(S) + 1; const g1 = stageOf(S);
    if (g1 > g0) { setIcon(S); E.fightApi.flog(F, `✦ Le Dofus du Phénix atteint le stade « ${STAGES[g1].n} » !`, "buff dofpl"); } };
  const fight0 = E.dofpFight;
  E.dofpFight = function (S, F) {
    const r = fight0.apply(this, arguments); owner.set(F, S); const g = STAGES[stageOf(S)];
    F.ents.forEach((e) => { if (!has(e) || e.summon) return; const G = E.isMono(S) && e.side === "c" && !F.pvp ? g : STAGES[0]; // Kolizéum : stade Cendres
      Object.assign((e.dpS = e.dpS || {}), { souffle: G.uses, phxG: STAGES.indexOf(G), phxR: G.reborn ? 1 : 0 }); });
    return r;
  };
  const val0 = (F, e) => E.dofpVal(id, !!e.dpBoost, !!F.pvp, e.dpP ? e.dpP[id] || 0 : 0);
  const note = (F, e) => { const N = F.dpN || (F.dpN = {}); const k = e.cid != null ? e.cid : e.name; (N[k] = N[k] || {})[id] = (N[k][id] || 0) + 1; };
  const hurt0 = E.dofpHurt;
  E.dofpHurt = function (F, src, tgt) {
    hurt0.apply(this, arguments);
    const T = tgt && tgt.dpS; if (!T || !T.souffle || !tgt.alive || tgt.hp >= tgt.hpMax * 0.3) return;
    T.souffle--; const x = val0(F, tgt) * STAGES[T.phxG || 0].heal;
    E.fightApi.doHeal(tgt, Math.round(tgt.hpMax * x / 100), F); tgt.paBonus = (tgt.paBonus || 0) + 1; note(F, tgt);
    E.fightApi.flog(F, `✦ Second souffle · ${tgt.name} : +${pc(x)} % de PV et +1 PA`, "buff dofpl"); count(F, tgt);
  };
  /* stade Phénix : renaît au lieu de tomber (avant la Lueur d'Ilyzaelle, qui reste pour un autre allié) */
  const save0 = E.dofpSave;
  E.dofpSave = function (F, tgt) {
    const T = tgt && tgt.dpS;
    if (T && T.phxR && has(tgt) && tgt.hp <= 0) { T.phxR = 0; const x = STAGES[3].reborn * val0(F, tgt) / 25; tgt.hp = Math.max(1, Math.round(tgt.hpMax * x / 100)); note(F, tgt);
      E.fightApi.flog(F, `✦ Le Phénix renaît · ${tgt.name} se relève avec ${pc(x)} % de ses PV`, "buff dofpl"); count(F, tgt); return; }
    if (save0) return save0.apply(this, arguments);
  };
  /* la quête : lue dans l'état de la saison (js/monopass.js) */
  const val = (S, s) => {
    const B = E.bpState ? E.bpState(S) : null; if (!B) return 0;
    switch (s.k) {
      case "war": return Object.values(B.war || {}).reduce((a, w) => a + (w.tot || 0), 0);
      case "md": return Math.max(0, ...Object.values(B.md || {}).map((r) => r.best || 0));
      case "sb": return Object.values((B.sb && B.sb.days) || {}).filter((d) => d.tries > 0).length;
      case "bp": return E.bpTier(S);
      case "hf": return Object.keys(B.hf || {}).length;
      case "boss": return Object.keys(D.DUNGEONS).some((d) => D.DUNGEONS[d].lvl >= s.lvl && E.stasisInfo(S, d).max >= s.n) ? s.n : 0;
    }
    return 0;
  };
  const closedSteps = new Set();
  E.DOFUS_ORDER.forEach((k) => E.DOFUS[k].steps.forEach((s) => closedSteps.add(s)));
  const closed = (S, k) => SD.closed && E.isMono(S) && k !== id && !(E.DOFUS[k].steps[0] && E.DOFUS[k].steps[0].t === "gift");
  E.dofusClosed = (S, k) => closed(S, k);
  const prog0 = E.dofusStepProgress;
  E.dofusStepProgress = function (S, k, i) {
    if (k === id) { const Q = E.dofusQuest(S, k), s = E.DOFUS[k].steps[i]; if (!s) return [0, 1];
      if (Q.done || i < Q.step) return [s.n, s.n]; if (!E.isMono(S) || E.monoEternal(S) || i > Q.step) return [0, s.n]; return [Math.min(val(S, s), s.n), s.n]; }
    if (closed(S, k)) return [0, 1];
    return prog0.apply(this, arguments);
  };
  const step0 = E.dofusStep;
  E.dofusStep = function (S, k) { if (closed(S, k)) return null; return step0.apply(this, arguments); };
  const txt0 = E.dofusStepTxt;
  E.dofusStepTxt = function (s) {
    if (s && s.t === "mono") switch (s.k) {
      case "war": return `Gagner ${s.n} combats de chasse pour ton camp (Bonta ou Brâkmar)`;
      case "md": return `Atteindre la stasis ${s.n} au Défi de la manche`;
      case "sb": return `Combattre le Boss de saison ${s.n} soirs`;
      case "bp": return `Atteindre le palier ${s.n} du Pass de saison`;
      case "hf": return `Obtenir ${s.n} hauts faits de saison`;
      case "boss": return `Vaincre un boss de niveau ${s.lvl} ou plus en stasis ${s.n}`;
    }
    if (s && closedSteps.has(s) && SD.closed && E.monoNow) return "Monocompte : un seul Dofus de quête par saison. Ce Dofus tombe seulement de son boss.";
    return txt0.apply(this, arguments);
  };
  const info0 = E.dofusDropInfo;
  E.dofusDropInfo = function (k) { if (k === id) return null; return info0.apply(this, arguments); };
  /* seulement dans une partie Monocompte (et dans l'Éternel, pour le héros qui l'a gagné) */
  const boot0 = E.monoBoot;
  E.monoBoot = function (S) { const r = boot0.apply(this, arguments); if (E.isMono(S)) { E.monoNow = 1; cur = S; setIcon(S); if (!E.DOFUS_ORDER.includes(id)) E.DOFUS_ORDER.push(id); } return r; };
})(typeof window !== "undefined" ? window : globalThis);
