/* ============================================================================
   BOUCLIER MONOCOMPTE — Idlus (plan directeur, étape 5 ; fonction serveur « mono », supabase/functions/mono)
   Le Bouclier du Classique (js/verify.js) paramétré pour UN héros et une saison de 56 jours :
   - V.impossible du Classique, avec la Maîtrise et la Maîtrise du temps comptées depuis le début de la saison
     (réserve du Sablier de départ : 3 h, E.MONO.sabStart) ;
   - en plus : un seul héros (le mercenaire seulement pendant un donjon), 3 Dofus portés, 3 spécialités (métiers à 100
     hors spécialités), niveau, honneur (table du Monocompte, js/monoalign.js), points du pass et quête du Phénix
     plafonnés par la date de saison, progression des défis plafonnée par heure réelle, copie du registre des Éclats
     du Temps comparée au registre du serveur, objets numérotés par le serveur jamais chez deux joueurs ;
   - V.check du Classique (kamas, ressources, Dofus, bêtes, temps de jeu : ses rythmes, marge × 25, valent aussi pour
     un héros seul : la simulation d'une semaine normale en gagne bien moins), plus la partie reculée (opérations du
     serveur, Éclats d'activité, défis, temps de jeu, XP qui baissent après une partie validée).
   Rien ne change pour le Classique : ce fichier n'est chargé que par la fonction « mono » et par ses tests.
   ========================================================================== */
(function (root) {
  "use strict";
  const V = root.VERIFY || require("./verify.js");
  const DAY = 86400000;
  const VM = (V.mono = {});
  /* Plafonds (marges comprises). Semaine normale simulée (tests/bouclier_mono.test.js) : niveau 50 à 70 au jour 7 ;
     tools/sim_honneur_mono.js : 800 honneur par jour au plus (actif, fin de saison) ; pass : 3 quêtes du jour (100),
     3 de la semaine (350) et le Défi de la manche. */
  VM.LVL0 = 30; VM.LVL_D = 70;     // niveau du héros au plus 30 + 70 × √(jours de saison) (100 au jour 1, 200 au jour 6)
  VM.HON0 = 2000; VM.HON_D = 2500; // honneur au plus 2 000 + 2 500 par jour de saison (3 fois l'actif)
  VM.BP0 = 2000; VM.BP_D = 1000;   // points du pass au plus 2 000 + 1 000 par jour de saison
  VM.HON_H = 400;                  // honneur gagné par heure réelle entre deux parties validées (+ 2 000 de marge)
  VM.PHX_H = 120;                  // renaissances du Phénix par heure réelle (+ 30)
  // progression des défis par heure réelle (+ 5 de marge) : donjons, archimonstres, objets fabriqués, runes, agressions
  VM.DEFI_H = { d1: 40, d3: 40, d4: 120, d5: 3000, d8: 3000, d9: 30, d11: 600 };
  VM.SERVER_DEFIS = ["d6", "d12"]; // comptés par le serveur seulement (HdV de saison, groupes en direct)

  const hero = (S) => (S.chars || []).find((c) => !c.merc) || null;
  const days = (ctx) => Math.max(0, ((ctx.date || 0) - (ctx.debut || 0)) / DAY);
  const n0 = (x) => Math.max(0, Math.floor(+x || 0));
  VM.days = days;
  VM.lvlCap = (ctx) => Math.min(200, Math.floor(VM.LVL0 + VM.LVL_D * Math.sqrt(days(ctx))));
  VM.honCap = (ctx) => Math.floor(VM.HON0 + VM.HON_D * days(ctx));
  VM.bpCap = (ctx) => Math.floor(VM.BP0 + VM.BP_D * days(ctx));

  /* Le calendrier du jeu lit la date de saison du serveur pendant la vérification (manches, défis ouverts). */
  VM.withClock = (E, S, ctx, fn) => {
    const M = E.MONO; const s = (S && S.mono && S.mono.s) || 1;
    const def = M.saisons[s] || (M.saisons[s] = { nom: `Saison ${s}`, debut: null }); const d0 = def.debut;
    if (ctx.debut != null) def.debut = ctx.debut;
    if (ctx.date != null) E.setClock(() => ctx.date);
    const ck = S && S.mono && S.mono.clk; if (ck) delete S.mono.clk; // l'horloge de test de la partie ne compte pas : seule la date du serveur
    try { return fn(); } finally { def.debut = d0; E.setClock(null); if (ck) S.mono.clk = ck; }
  };
  VM.load = (E, txt) => { const S = E.deserialize(txt); if (E.events) E.events.length = 0; if (S && S.mono && E.monoBoot) E.monoBoot(S); return S; };

  const xpTot = (E, c) => { let t = Math.max(0, +c.xp || 0); for (let l = 1; l < (c.lvl || 1); l++) t += E.xpNeed(l); return t; };
  const tfAct = (E, S) => (E.tfLedger ? E.tfLedger(S) : []).filter((l) => /^act:\d+:\w+$/.test(l.src)).reduce((a, l) => a + Math.max(0, +l.n || 0), 0);
  const defRaw = (E, S) => { const T = E.tfState && E.tfState(S); const o = {}; if (T && T.d) for (const k in T.d) o[k] = Math.max(0, +T.d[k].p || 0); return o; };

  // Éclats d'activité par jour et par activité ({ "jour:activité": n }) : un jour passé ne gagne plus rien après une validation
  const actDays = (E, S) => { const o = {}; for (const l of (E.tfLedger ? E.tfLedger(S) : [])) { const m = /^act:(\d+):(\w+)$/.exec(l.src || ""); if (m) o[m[1] + ":" + m[2]] = (o[m[1] + ":" + m[2]] || 0) + n0(l.n); } return o; };

  /* Bilan : celui du Classique, plus ce que la partie ne peut jamais perdre (partie reculée) */
  VM.bilan = (E, S) => {
    const b = V.bilan(E, S); const c = hero(S) || {}; const B = E.bpState ? E.bpState(S) : null; const T = E.tfState ? E.tfState(S) : null;
    return Object.assign(b, { op: n0(S.hdv && S.hdv.op), xpt: c.lvl ? xpTot(E, c) : 0, acts: tfAct(E, S), tfs: T ? n0(T.seq) : 0,
      hon: S.align ? Math.max(0, Math.round(+S.align.hon || 0)) : 0, bp: B ? n0(B.pts) : 0, phx: n0(S.mono && S.mono.phx), def: defRaw(E, S), actd: actDays(E, S) });
  };

  /* Gains d'activité de la partie, par jour et par activité (le serveur en fait ses bons de butin, js/saison1.js : lignes act:jour:activité) */
  VM.acts = (E, S) => (E.tfLedger ? E.tfLedger(S) : []).map((l) => { const m = /^act:(\d+):(\w+)$/.exec(l.src || ""); return m && { j: +m[1], k: m[2], n: n0(l.n) }; }).filter((x) => x && x.j >= 1 && x.j <= 56 && x.n > 0);

  /* Résumé calculé par le serveur (contrat avec les classements de saison : mono.parties_ok.resume) */
  VM.resume = (E, S, ctx) => VM.withClock(E, S, ctx, () => {
    const c = hero(S) || {}; const TF = E.MONO.tf || {};
    const Q = E.dofusQuest && E.DOFUS && E.DOFUS.phenix ? E.dofusQuest(S, "phenix") : { step: 0, done: 0 };
    const defis = {}, ok = {};
    (TF.DEFIS || []).forEach((x) => { if (VM.SERVER_DEFIS.includes(x.id)) return; const p = E.tfProgress(S, x); defis[x.id] = p; const t = x.need.filter((v) => p >= v).length; if (t) ok[x.id] = t; });
    return {
      niveau: c.lvl || 1, classe: c.cls || null, nom: String(c.name || "").slice(0, 20), xp: c.lvl ? xpTot(E, c) : 0,
      phenix: { etape: n0(Q.step), fini: !!Q.done, renaissances: E.phxReborn ? E.phxReborn(S) : 0, stade: E.phxStage ? E.phxStage(S) : 0 },
      groupe: (S.mono && S.mono.gbest && typeof S.mono.gbest === "object") ? S.mono.gbest : {}, // { donjon: { stasis: { t, at } } } (groupes en direct)
      serment: (S.mono && (S.mono.serment || S.mono.fer)) || null,
      camp: (S.align && S.align.side) || null, rang: S.align && E.alignRankIdx ? E.alignRankIdx(S) : 0, honneur: S.align ? Math.max(0, Math.round(+S.align.hon || 0)) : 0,
      pass: E.bpTier ? E.bpTier(S) : 0, defis, defis_ok: ok, eternel: !!(S.mono && S.mono.eternel),
    };
  });

  /* Ce qu'aucune partie Monocompte honnête ne peut contenir. ctx : { debut, date (date de saison), objets, sortis } */
  VM.impossible = (E, S, ctx, nu0) => {
    if (!S || !S.mono) return "partie du serveur Classique";
    const M = E.MONO;
    const w = V.impossible(E, S, nu0, { mtT0: ctx.debut, sabT0: ctx.debut, sabH0: (M.sabStart || 3 * 3600) / 3600 });
    if (w) return w;
    return VM.withClock(E, S, ctx, () => {
      const solo = (S.chars || []).filter((c) => !c.merc), mercs = (S.chars || []).filter((c) => c.merc);
      if (solo.length !== 1) return `${solo.length} héros dans la partie (un seul par saison)`;
      if (mercs.length > 1 || (mercs.length && !S.dungeon)) return "mercenaire en dehors d'un donjon";
      const c = solo[0], nm = String(c.name || "le héros").slice(0, 20);
      // 3 Dofus portés au plus, sur les emplacements du Monocompte
      const D = root.DATA || E.DATA || {}; const ITEMS = D.ITEMS || {};
      const okSlots = E.monoDofusSlots ? E.monoDofusSlots(S) : null; let dof = 0;
      for (const sl in c.equip || {}) { const it = S.items[c.equip[sl]]; const T = it && ITEMS[it.tpl]; if (!T || T.slot !== "dofus") continue; dof++; if (okSlots && !okSlots.includes(sl)) return `${nm} : Dofus porté hors des ${M.dofus} emplacements`; }
      if (dof > M.dofus) return `${nm} : ${dof} Dofus portés (au plus ${M.dofus})`;
      // 3 spécialités ; métiers de récolte et d'artisanat au niveau 100 hors spécialités
      const sp = (S.mono.spec || []).filter(Boolean);
      if ((S.mono.spec || []).length > M.jobs.spec || sp.length > M.jobs.spec) return `${sp.length} spécialités (au plus ${M.jobs.spec})`;
      if (new Set(sp).size !== sp.length) return "spécialité en double";
      for (const j of sp) if (!(D.GATHER_JOBS[j] || D.CRAFT_JOBS[j])) return `spécialité inconnue (${String(j).slice(0, 20)})`;
      const jobs = Object.assign({}, S.jobs || {}, S.crafts || {});
      for (const j in jobs) { const J = jobs[j]; const cap = sp.includes(j) ? 200 : M.jobs.cap; if ((+(J && J.lvl) || 1) > cap) return `métier ${(D.GATHER_JOBS[j] || D.CRAFT_JOBS[j] || { name: j }).name} au niveau ${J.lvl} (au plus ${cap}${sp.includes(j) ? "" : " hors spécialité"})`; }
      // niveau, honneur, pass : plafonnés par la date de saison
      const L = VM.lvlCap(ctx); if ((c.lvl || 1) > L) return `${nm} : niveau ${c.lvl} au jour ${Math.floor(days(ctx)) + 1} (au plus ${L})`;
      if ((+c.ren || 0) > 0) return `${nm} : renaissance dans une partie Monocompte`;
      if (S.align) { const h = +S.align.hon || 0, cap = VM.honCap(ctx); if (!(h >= 0) || h > cap) return `${Math.round(h).toLocaleString("fr-FR")} honneur (au plus ${cap.toLocaleString("fr-FR")} au jour ${Math.floor(days(ctx)) + 1})`; }
      const B = E.bpState ? E.bpState(S) : null;
      if (B) { const cap = VM.bpCap(ctx); if (!(+B.pts >= 0) || +B.pts > cap) return `pass de saison : ${B.pts} points (au plus ${cap})`;
        const t = E.bpTier(S); for (const l of ["free", "pres"]) for (const k in B[l] || {}) if (+k > t || +k < 1) return `pass de saison : palier ${k} pris au palier ${t}`; }
      // quête du Phénix : chaque étape passée doit être vraie dans la partie
      if (E.DOFUS && E.DOFUS.phenix) {
        const Q = E.dofusQuest(S, "phenix"), st = E.DOFUS.phenix.steps, own = E.dofusOwned(S, "phenix");
        if (own && !Q.done) return "Dofus du Phénix sans sa quête";
        const k = Q.done ? st.length : Math.min(n0(Q.step), st.length);
        if (n0(Q.step) > st.length) return "quête du Phénix illisible";
        for (let i = 0; i < k; i++) { const s = st[i]; const need = s.k === "hon" ? Math.floor(s.n * 0.9) : s.n; // l'honneur peut redescendre un peu (défaites)
          const v = s.k === "hon" ? (S.align ? +S.align.hon || 0 : 0) : s.k === "bp" ? E.bpTier(S) : s.k === "boss" ? (Object.keys(D.DUNGEONS).some((d) => D.DUNGEONS[d].lvl >= s.lvl && E.stasisInfo(S, d).max >= s.n) ? s.n : 0)
            : s.k === "md" ? Math.max(0, ...Object.values((B && B.md) || {}).map((r) => +r.best || 0)) : s.k === "sb" ? Object.values((B && B.sb && B.sb.days) || {}).filter((d) => d.tries > 0).length : s.n;
          if (v < need) return `quête du Phénix : étape ${i + 1} passée sans ${s.k === "hon" ? "l'honneur" : s.k === "bp" ? "le palier du pass" : s.k === "boss" ? "le boss" : s.k === "md" ? "le Défi de la manche" : "le Boss de saison"}`; }
      }
      // défis : paliers payés au plus ceux atteints ; meilleures stasis au plus celles de la partie
      const TF = M.tf || {}; const T = E.tfState(S);
      for (const x of TF.DEFIS || []) { const r = (T.d || {})[x.id]; if (!r) continue;
        if (n0(r.paid) > 3) return `défi ${x.id} illisible`;
        if (x.best) { const lv = x.id === "d7" ? 150 : 190; const top = Math.max(0, ...Object.keys(D.DUNGEONS).filter((d) => D.DUNGEONS[d].lvl >= lv).map((d) => E.stasisInfo(S, d).max || 0));
          if ((+r.p || 0) > top) return `défi ${x.n} : stasis ${r.p} jamais faite (au plus ${top})`; } }
      // objets numérotés par le serveur (HdV et échanges) : jamais deux fois, jamais chez deux joueurs
      const seen = new Set();
      for (const u in S.items || {}) { const sn = S.items[u].sn; if (sn == null) continue; if (seen.has(sn)) return `objet n° ${sn} en double`; seen.add(sn);
        if (ctx.objets && ctx.objets[sn] !== true && !(ctx.objets[sn] > n0(S.hdv && S.hdv.op))) return `objet n° ${sn} : il appartient à un autre joueur`; }
      for (const o of ctx.sortis || []) if (o.op <= n0(S.hdv && S.hdv.op) && S.items[o.uid] && S.items[o.uid].tpl === o.tpl) return `${(ITEMS[o.tpl] || { name: o.tpl }).name} : vendu ou échangé, encore dans le sac`;
      return null;
    });
  };

  /* Copie du registre des Éclats du Temps dans la partie (S.mono.tf.srv) comparée au registre du serveur.
     reg : { solde, genere, max (plus haut solde jamais atteint dans la saison) }. Une copie en retard est normale ; une copie
     plus haute que le registre ne l'a jamais été, ou un sac qui ne suit pas sa copie, ne l'est pas. */
  VM.registre = (E, S, reg) => {
    if (!reg) return null; const T = E.tfState && E.tfState(S); if (!T) return null;
    const R = T.srv; const tf = (E.MONO.tf || {}).res; const sac = Math.max(0, +((S.res || {})[tf]) || 0);
    if (R) {
      if ((+R.solde || 0) > Math.max(+reg.max || 0, +reg.solde || 0)) return `Éclats du Temps : ${R.solde} dans la copie du registre, le registre du serveur n'en a jamais eu plus de ${Math.max(+reg.max || 0, +reg.solde || 0)}`;
      if ((+R.genere || 0) > (+reg.genere || 0)) return `Éclats du Temps : ${R.genere} générés dans la copie, ${reg.genere} au registre`;
    }
    if (!R) { // partie jamais en ligne : son registre provisoire ne contient que des gains possibles (le serveur en fera ses bons)
      const TF = E.MONO.tf || {}; let act = 0;
      for (const l of T.led || []) { const n = +l.n || 0; let m;
        if (l.o === "act" && (m = /^act:(\d+):(\w+)$/.exec(l.src || "")) && TF.ACT[m[2]] && n > 0 && n <= TF.ACT[m[2]].max) { act += n; continue; }
        if (l.o === "defi" && (m = /^defi:(d\d+):([0-2])$/.exec(l.src || "")) && E.tfDefi(m[1]) && n === TF.REW[E.tfDefi(m[1]).c][+m[2]]) continue;
        if (l.o === "achat" && n < 0) continue;
        return `registre provisoire des Éclats du Temps illisible (${String(l.src || "").slice(0, 30)} : ${n})`; }
      if (act > (TF.cap || 800)) return `${act} Éclats d'activité dans le registre provisoire (au plus ${TF.cap || 800})`;
    }
    const ACT = (E.MONO.tf || {}).ACT || {};
    for (const l of T.led || []) { const m = /^act:(\d+):(\w+)$/.exec(l.src || ""); if (!m) continue;
      if (!ACT[m[2]] || (+l.n || 0) > ACT[m[2]].max || +m[1] < 1 || +m[1] > 56) return `Éclats d'activité impossibles (${l.src} : ${l.n})`; }
    if (sac > Math.max(0, E.tfBalance(S))) return `Éclats du Temps : ${sac} dans le sac pour ${E.tfBalance(S)} au registre`;
    return null;
  };

  /* Gains depuis la dernière partie validée : V.check du Classique, plus la partie reculée et les défis */
  VM.check = (E, prev, cur, hours, gift, res0, top, sure) => {
    const h = Math.max(0, hours);
    if (prev.op != null && cur.op < prev.op) return { ok: false, why: `partie reculée : opérations du serveur ${cur.op} après ${prev.op}` };
    if (prev.acts != null && cur.acts < prev.acts) return { ok: false, why: `partie reculée : ${cur.acts} Éclats d'activité après ${prev.acts}` };
    if (prev.xpt != null && cur.xpt < prev.xpt) return { ok: false, why: "partie reculée : moins d'XP que la partie validée" };
    if (prev.tfs != null && cur.tfs < prev.tfs) return { ok: false, why: "partie reculée : registre des Éclats en arrière" };
    if (prev.pt != null && cur.pt < prev.pt - 0.02) return { ok: false, why: "partie reculée : moins de temps de jeu que la partie validée" };
    if (prev.phx != null && cur.phx - prev.phx > 30 + VM.PHX_H * h) return { ok: false, why: `+${cur.phx - prev.phx} renaissances du Phénix` };
    if (prev.hon != null && cur.hon - prev.hon > 2000 + VM.HON_H * h) return { ok: false, why: `+${cur.hon - prev.hon} honneur en ${(Math.round(h * 10) / 10).toLocaleString("fr-FR")} h` };
    // Éclats d'activité : seuls le jour de la partie validée et les suivants peuvent encore gagner (bons de butin du serveur)
    if (prev.actd && prev.jour) for (const key in cur.actd || {}) { const j = +key.split(":")[0];
      if (j < prev.jour && cur.actd[key] > (prev.actd[key] || 0)) return { ok: false, why: `Éclats d'activité ajoutés au jour ${j}, déjà passé à la dernière validation (jour ${prev.jour})` }; }
    for (const id in cur.def || {}) { const a = (prev.def || {})[id] || 0, b = cur.def[id];
      if (b < a) return { ok: false, why: `partie reculée : défi ${id}` };
      if (VM.DEFI_H[id] && b - a > 5 + VM.DEFI_H[id] * h) return { ok: false, why: `défi ${id} : +${b - a} en ${(Math.round(h * 10) / 10).toLocaleString("fr-FR")} h` }; }
    return V.check(E, prev, cur, hours, gift, res0, top, sure);
  };

  /* Ce que le serveur a donné entre la partie validée (op0) et la partie envoyée (op1) : opérations de l'HdV de saison et
     des échanges déjà appliquées par le jeu (kamas, ressources, Éclats du Temps, objets, montures, familiers). */
  VM.gift = (ops, op0, op1) => {
    const g = { k: 0, r: 0, dof: 0, mt: 0, ms: 0, pt: 0 };
    for (const o of ops || []) { if (!(o.id > op0 && o.id <= op1)) continue; const p = o.p || {};
      g.k += Math.max(0, +p.k || 0); g.r += Math.max(0, +p.tf || 0);
      for (const b of ["res", "runes", "cons"]) for (const x in p[b] || {}) if (b === "res") g.r += Math.max(0, +p[b][x] || 0);
      for (const it of p.add || []) if (it && /^dofus_/.test(String(it.tpl))) g.dof++;
      for (const m of p.addM || []) { g.mt++; g.ms += Math.max(1, Math.floor(+(m && m.st) || 1)); }
      g.pt += (p.addP || []).length; }
    return g;
  };

  /* Vérification complète d'un envoi (appelée par la fonction serveur « mono » et par les tests).
     o : { prev: { bilan, res, at } (dernière partie validée) | null, at (date de l'envoi), ctx: { debut, date, objets, sortis },
           gift (ce que le serveur a donné entre-temps) ou ops (opérations du serveur depuis la partie validée), reg (registre des Éclats), admin, accept (« C'est bon » de Mathis), sure }
     Renvoie { ok: false, why } ou { ok: true, bilan, res, resume, acts }. */
  VM.verifier = (E, txt, o) => {
    let S; try { S = VM.load(E, txt); } catch (e) { return { ok: false, why: "partie illisible" }; }
    if (!S || !S.mono) return { ok: false, why: "partie du serveur Classique" };
    if (S.mono.eternel) return { ok: false, why: "partie de l'Éternel : elle ne revient pas dans la saison" };
    const ctx = o.ctx || {}; const prev = o.prev || null;
    let bil, why = null, res = prev ? prev.res : null;
    try { bil = VM.bilan(E, S); bil.jour = VM.withClock(E, S, ctx, () => (E.monoDay ? E.monoDay(S) : 0)); } catch (e) { return { ok: false, why: "partie illisible" }; }
    const nu0 = prev && prev.bilan ? +prev.bilan.nu0 || 0 : +S.nextUid || 0;
    if (!o.admin) {
      why = VM.impossible(E, S, ctx, nu0) || VM.registre(E, S, o.reg);
      if (!why && prev && prev.bilan && !o.accept) {
        const hours = Math.max(0, ((o.at || 0) - (prev.at || 0)) / 3600000);
        const top = Math.max(1, ...(S.chars || []).filter((c) => !c.merc).map((c) => c.lvl || 1));
        const gift = o.gift || (o.ops ? VM.gift(o.ops, n0(prev.bilan.op), n0(bil.op)) : {});
        const c = VM.check(E, prev.bilan, bil, hours, gift, res, top, !!o.sure);
        if (!c.ok) why = c.why; else res = c.res;
      }
    }
    if (why) return { ok: false, why };
    bil.nu0 = nu0;
    return { ok: true, bilan: bil, res: res == null ? V.RES_MAX : res, resume: VM.resume(E, S, ctx), acts: VM.acts(E, S) };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = VM;
})(typeof window !== "undefined" ? window : globalThis);
