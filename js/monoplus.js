/* ============================================================================
   Monocompte — « Saison plus » et idées retenues par Mathis le 21/10/2026 (maquette validée), partie moteur (sans DOM) :
   - Serment de fer (décision 3) : choisi au début de la saison ; sans Sablier ni mercenaire (ni renfort d'un ami) ;
     passage au fer tant que le héros n'a pas dépassé le niveau 20 et n'a encore reçu aucune aide ; abandon à tout moment
     (on perd seulement le classement de fer et l'aura). Le jeu bloque le Sablier, le mercenaire et le renfort sous serment.
     Compteur d'aides fiable dans la sauvegarde, lu par le serveur (résumé du Bouclier Monocompte) :
       S.mono.serment = { t: "fer" | "ord", at, lvl, rompu?: date de l'abandon }
       S.mono.aide    = { sab: secondes de jeu accélérées par le Sablier, merc: donjons avec un mercenaire, ren: donjons avec un renfort }
     Le serveur retire du classement de fer une partie dont le résumé montre une aide (supabase/mono_social.sql).
   - Renfort d'un ami (décision 4) : la copie du héros d'un ami Monocompte (photo publiée depuis sa partie validée)
     prend la place du mercenaire dans un donjon solo : l'un ou l'autre, jamais les deux ; aucun gain pour l'ami
     (un compteur cosmétique sur le serveur) ; le mercenaire reste disponible.
   - Mutation de la semaine (décision 5) : une règle par semaine sur les donjons de stasis 7 et plus du Monocompte,
     sans puissance en plus (chaque règle a sa contrepartie, réglée par tools/sim_mutations.js : ± 0,5 stasis) ;
     semaine de saison du serveur (ou de la partie hors connexion) ; défi de groupe de la semaine payé en Éclats du Temps
     dans le quota (registre : activité « mut », une source par semaine) ; les deux semaines suivantes sont annoncées.
   - Bilan de fin de saison (décision 6) : la carte gardée au passage à l'Éternel, et son texte pour Discord.
   Crochets du moteur : E.mutFight (début du combat) et E.mutTurn (début de chaque tour) dans js/engine.js.
   Rien ne change au Classique : chaque crochet vérifie E.isMono (une partie Classique n'a jamais S.dungeon.mut).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const M = E.MONO; if (!M) return;
  const mono = (S) => !!(E.isMono && E.isMono(S));
  const season = (S) => mono(S) && !E.monoEternal(S);
  const hero = (S) => S.chars.find((c) => !c.merc) || S.chars[0];

  /* ======================= Serment de fer ======================= */
  const SR = (M.serment = { lvlMax: 20, aura: "fer_aura" });
  E.monoAide = (S) => { const A = (S.mono.aide = S.mono.aide || {}); ["sab", "merc", "ren"].forEach((k) => { if (!(A[k] >= 0)) A[k] = 0; }); return A; };
  E.monoAided = (S) => { if (!mono(S)) return false; const A = E.monoAide(S); return A.sab > 0 || A.merc > 0 || A.ren > 0; };
  E.monoSerment = (S) => (mono(S) && S.mono.serment ? S.mono.serment.t : null);
  E.monoFer = (S) => season(S) && E.monoSerment(S) === "fer"; // serment de fer en cours (règles appliquées)
  E.monoFerOk = (S) => mono(S) && E.monoSerment(S) === "fer" && !E.monoAided(S); // fer tenu (classement, aura)
  E.monoOathPending = (S) => season(S) && !S.mono.serment; // à choisir au début de la saison
  /* t : "fer" ou "ord". Passer au fer : niveau 20 au plus, aucune aide reçue, jamais après un abandon. */
  E.monoSwearErr = (S, t) => {
    if (!season(S)) return "Le serment se prête pendant une saison du Monocompte.";
    if (t !== "fer" && t !== "ord") return "Serment inconnu.";
    const cur = S.mono.serment;
    if (t === "ord") return cur && cur.t === "fer" ? "Pour quitter le Serment de fer, choisis « Renoncer au serment »." : null;
    if (cur && cur.t === "fer") return "Tu as déjà prêté le Serment de fer.";
    if (cur && cur.rompu) return "Tu as renoncé au Serment de fer cette saison : il ne se reprête pas.";
    if ((hero(S) || {}).lvl > SR.lvlMax) return `Le Serment de fer se prête tant que ton héros n'a pas dépassé le niveau ${SR.lvlMax}.`;
    if (E.monoAided(S)) return "Ton héros a déjà reçu de l'aide (Sablier, mercenaire ou renfort) : le Serment de fer n'est plus possible cette saison.";
    return null;
  };
  E.monoSwear = (S, t) => {
    const err = E.monoSwearErr(S, t); if (err) return err;
    const cur = S.mono.serment;
    S.mono.serment = Object.assign({}, cur && cur.rompu ? { rompu: cur.rompu } : {}, { t, at: E.now(), lvl: (hero(S) || {}).lvl || 1 });
    if (t === "fer") { const B = S.sablier; if (B) B.spd = 1; E.monoAide(S); if (E.note) E.note(S, "Serment de fer prêté : un seul héros, aucune aide. Le Sablier et le mercenaire sont fermés pour la saison.", "rare"); }
    return null;
  };
  E.monoOathBreak = (S) => {
    if (!E.monoFer(S)) return "Tu n'as pas prêté le Serment de fer.";
    S.mono.serment = { t: "ord", at: S.mono.serment.at, lvl: S.mono.serment.lvl, rompu: E.now() };
    if (E.note) E.note(S, "Tu as renoncé au Serment de fer : tu quittes son classement et son aura. Sablier et mercenaire sont de nouveau ouverts.", "info");
    return null;
  };
  // l'aura de fer : portée pendant la saison sous serment, puis gardée dans l'Éternel (et, par le serveur, dans les saisons suivantes)
  E.ferWorn = (S) => !!(S && mono(S) && !((S.settings && S.settings.tfOff) || {}).fer && (E.monoFerOk(S) && season(S) || (S.unlocks && S.unlocks[SR.aura])));

  /* Sablier : fermé sous serment ; ailleurs, chaque seconde accélérée est comptée */
  const sabSet0 = E.sabSet;
  E.sabSet = function (S, v) { if (E.monoFer(S) && +v > 1) return "Serment de fer : pas de Sablier pendant la saison."; return sabSet0.apply(this, arguments); };
  const sabSpend0 = E.sabSpend;
  E.sabSpend = function (S, realMs) {
    if (E.monoFer(S)) { const B = S.sablier; if (B && B.spd > 1) B.spd = 1; return 1; }
    const r = sabSpend0.apply(this, arguments);
    if (r > 1 && season(S)) { const A = E.monoAide(S); A.sab += Math.max(1, Math.round(((+realMs || 0) * (r - 1)) / 1000)); }
    return r;
  };

  /* ======================= Mercenaire et renfort d'un ami ======================= */
  M.renfort = { ecart: 10, get: null }; // get(u) : le renfort publié par un ami (js/amis.js) // la copie d'un ami : son héros au plus 10 niveaux au-dessus du tien
  const enter0 = E.monoEnter;
  /* mercCls : classe du mercenaire, ou { ami: { u, p, snap } } pour le renfort d'un ami (l'un ou l'autre) */
  E.monoEnter = function (S, did, stasis, mercCls) {
    if (!mono(S)) return enter0.apply(this, arguments);
    if (typeof mercCls === "string" && mercCls.startsWith("ami:")) { const R = M.renfort.get ? M.renfort.get(mercCls.slice(4)) : null; return E.monoEnterRenfort(S, did, stasis, R); } // choix fait dans la boîte du donjon (js/amis.js tient les renforts)
    if (mercCls && typeof mercCls === "object") return E.monoEnterRenfort(S, did, stasis, mercCls.ami);
    if (mercCls && E.monoFer(S)) return "Serment de fer : pas de mercenaire pendant la saison.";
    const r = enter0.apply(this, arguments);
    if (!r && mercCls && season(S) && S.mono.merc) E.monoAide(S).merc++;
    return r;
  };
  /* une photo de héros publiée par un ami (E.monoSnap), vérifiée avant d'entrer */
  E.monoSnapOk = (h) => !!(h && typeof h === "object" && D.CLASSES[h.cls] && h.lvl >= 1 && h.lvl <= 200 && h.st && typeof h.st === "object" && Array.isArray(h.sp) && h.sp.length <= 40);
  E.monoRenfortErr = (S, R) => {
    if (!mono(S) || !season(S)) return "Le renfort d'un ami se prend pendant une saison du Monocompte.";
    if (E.monoFer(S)) return "Serment de fer : pas de renfort pendant la saison.";
    if (!R || !R.u || !E.monoSnapOk(R.snap)) return "Ce renfort n'est pas disponible.";
    const me = hero(S); if (!me) return "Héros introuvable.";
    if (R.snap.lvl > me.lvl + M.renfort.ecart) return `Le héros de ${R.p || "ton ami"} est trop fort pour t'accompagner (${M.renfort.ecart} niveaux au-dessus du tien au plus).`;
    return null;
  };
  E.monoEnterRenfort = (S, did, stasis, R) => {
    const err = E.monoRenfortErr(S, R); if (err) return err;
    const h = JSON.parse(JSON.stringify(R.snap)); const me = hero(S);
    E.monoMercClear(S);
    const c = E.addChar(S, h.cls, `${String(R.p || h.n || "Ami").slice(0, 16)} (renfort)`, Math.max(1, Math.min(200, Math.floor(h.lvl))), h.sex);
    Object.assign(c, { merc: 1, renfort: { u: R.u, p: String(R.p || "").slice(0, 20) }, inTeam: true, head: h.head || 0, snap: h,
      spells: h.sp.map((x) => Object.assign({}, x)), atkMode: h.am ? "ordre" : undefined, spellsManual: true });
    E.TEAM_MAX = Math.max(E.TEAM_MAX, 2);
    const e2 = E.enterDungeon(S, did, stasis);
    if (e2) { E.monoMercClear(S); return e2; }
    S.mono.merc = c.id; E.monoAide(S).ren++;
    S.mono.renN = (S.mono.renN || 0) + 1;
    if (E.note) E.note(S, `${R.p || "Ton ami"} t'envoie la copie de son héros pour ce donjon (renfort, sans gain pour lui).`, "info");
    if (E.monoRenfortUsed) try { E.monoRenfortUsed(R.u); } catch (e) {} // compteur cosmétique du serveur (js/amis.js)
    return null;
  };

  /* ======================= Mutation de la semaine ======================= */
  /* fx : effets posés au début du combat et à chaque tour, avec leur contrepartie (réglage : tools/sim_mutations.js).
     monHp, monDmg : PV et dégâts des monstres (×) ; regen : % de PV max soignés au début du tour d'un monstre ;
     dot : poisons sur les monstres (×) ; shield : bouclier des monstres (% de PV) ; reflect : renvoi de 30 % des dégâts reçus ;
     first : les monstres jouent avant ; vamp / heroVamp : vol de vie ; heroPa : PA des héros en moins ; heroDmg : % de dégâts des héros. */
  const MU = (M.mut = {
    from: 7,
    defi: { need: 5, n: 20, kind: "mut" }, // défi de groupe : 5 donjons de stasis 7+ en groupe sous la mutation ; 20 Éclats (une source par semaine, dans le quota)
    list: [
      { id: "seve", n: "Sève tenace", d: "Les monstres se soignent de 3 % de leurs PV au début de chaque tour. Les poisons font 25 % de dégâts en plus.", fx: { regen: 3, dot: 1.25, monHp: 0.94 }, c: "Racines arrachées", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous la Sève tenace" },
      { id: "compte", n: "Temps compté", d: "Tes héros ont 2 PA de moins, mais leurs coups font 60 % de dégâts en plus.", fx: { heroPa: 2, heroDmg: 60 }, c: "Chaque seconde compte", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous le Temps compté" },
      { id: "miroir", n: "Miroir", d: "Les monstres renvoient 30 % des dégâts qu'ils reçoivent, mais ont 14 % de PV en moins.", fx: { reflect: 1, monHp: 0.86 }, c: "Briser les reflets", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous le Miroir" },
      { id: "ambre", n: "Carapace d'ambre", d: "Les monstres commencent le combat avec un bouclier de 20 % de leurs PV, mais frappent 12 % moins fort.", fx: { shield: 0.2, monDmg: 0.88 }, c: "Fendre l'ambre", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous la Carapace d'ambre" },
      { id: "verre", n: "Verre fragile", d: "Tes héros frappent 30 % plus fort, les monstres 20 % plus fort.", fx: { heroDmg: 30, monDmg: 1.2 }, c: "Coups de cristal", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous le Verre fragile" },
      { id: "sang", n: "Pacte de sang", d: "Héros et monstres volent 15 % des dégâts qu'ils infligent.", fx: { vamp: 0.15, heroVamp: 0.15 }, c: "Le prix du sang", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous le Pacte de sang" },
      { id: "aube", n: "Aube pressée", d: "Les monstres jouent toujours avant tes héros, mais ont 10 % de PV en moins.", fx: { first: 1, monHp: 0.9 }, c: "Plus vite que l'aube", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous l'Aube pressée" },
      { id: "colere", n: "Colère du Temps", d: "Sous la moitié de leurs PV, les monstres font 25 % de dégâts en plus ; au-dessus, ils frappent 10 % moins fort.", fx: { enrage: 1, monDmg: 0.9 }, c: "Apaiser la colère", cd: "Finir 5 donjons de stasis 7 et plus en groupe sous la Colère du Temps" },
    ],
  });
  MU.byId = {}; MU.list.forEach((x) => (MU.byId[x.id] = x));
  MU.force = undefined; // simulateur : une mutation imposée (id), ou null pour aucune
  MU.srv = null;        // semaine de saison du serveur : { semaine, at } (js/amis.js, mono_couronne, partie Monocompte en ligne)
  MU.cur = null;        // mutation de la partie Monocompte chargée (pour les combats de groupe joués à part)
  /* la règle d'une semaine de saison (1 à 8) : rotation de 8 règles, décalée de 3 à chaque saison */
  E.monoMutAt = (s, w) => { const n = MU.list.length; const i = (((Math.max(1, +s || 1) - 1) * 3 + Math.max(1, +w || 1) - 1) % n + n) % n; return MU.list[i]; };
  E.monoMutWeek = (S) => { const R = MU.srv; if (R && R.semaine >= 1 && (!E.tfSrv || E.tfSrv.live(S))) return Math.min(8, R.semaine); return E.monoWeek ? E.monoWeek(S) : 1; };
  E.monoMutOf = (S) => { if (!season(S)) return null; if (MU.force !== undefined) return MU.force ? MU.byId[MU.force] || null : null; return E.monoMutAt(S.mono.s || 1, E.monoMutWeek(S)); };
  /* les semaines suivantes annoncées (au plus jusqu'à la semaine 8) */
  E.monoMutNext = (S, n = 2) => { const w = E.monoMutWeek(S), out = []; for (let k = 1; k <= n; k++) if (w + k <= 8) out.push({ w: w + k, m: E.monoMutAt(S.mono.s || 1, w + k) }); return out; };
  /* combat de groupe joué à part (même combat chez chacun) : la mutation de la partie chargée, ou celle donnée */
  if (E.monoGroupSetup) { const gs0 = E.monoGroupSetup; E.monoGroupSetup = function (snaps, did, stasis, mut) {
    const G = gs0.apply(this, arguments); if (G && G.S2 && G.S2.dungeon) { const id = (stasis || 1) >= MU.from ? (mut !== undefined ? mut : MU.force !== undefined ? MU.force : MU.cur) : null; G.S2.dungeon.mut = id && MU.byId[id] ? id : null; }
    return G; }; }
  /* la mutation d'un combat de donjon (lue à chaque combat : une montée de stasis qui passe la stasis 7 la prend en route) */
  E.monoMutFight = (S) => {
    if (!mono(S) || !S.dungeon || (S.dungeon.stasis || 1) < MU.from) return null;
    if (S.dungeon.mut !== undefined) return S.dungeon.mut ? MU.byId[S.dungeon.mut] || null : null;
    return E.monoMutOf(S);
  };
  E.mutFight = (S, F) => {
    const m = E.monoMutFight(S); if (!m) return;
    const X = m.fx; F.mut = m.id;
    F.ents.forEach((e) => {
      if (e.side === "m") {
        if (X.monHp) e.hpMax = e.hp = Math.max(1, Math.round(e.hpMax * X.monHp));
        if (X.monDmg) e.dmg *= X.monDmg;
        if (X.shield) e.shield = (e.shield || 0) + Math.round(e.hpMax * X.shield);
        if (X.reflect) e.reflect = true;
        if (X.vamp) e.vamp = Math.max(e.vamp || 0, X.vamp);
        if (X.enrage) e.enrageMod = true;
        if (X.first) e.ini += 1e6;
      } else if (e.side === "c" && !e.summon) {
        if (X.heroPa && e.st) e.st = Object.assign({}, e.st, { pa: Math.max(3, (e.st.pa || 6) - X.heroPa) });
        if (X.heroVamp) e.vamp = Math.max(e.vamp || 0, X.heroVamp);
      }
    });
    try { E.fightApi.flog(F, `✦ Mutation de la semaine : ${m.n}. ${m.d}`, "buff"); } catch (e) {}
  };
  E.mutTurn = (F, e) => {
    const m = MU.byId[F.mut]; if (!m) return; const X = m.fx;
    // dégâts des héros : posés au premier tour (le moteur recalcule dmgBonus au premier pas du combat, après E.mutFight)
    if (X.heroDmg && !F.mutH) { F.mutH = 1; F.ents.forEach((h) => { if (h.side === "c" && !h.summon) h.dmgBonus = (h.dmgBonus || 0) + X.heroDmg; }); }
    if (!e || !e.alive || e.side !== "m") return;
    if (X.dot && e.dots && e.dots.length) e.dots.forEach((d) => { if (!d.mu && !d.role) { d.v *= X.dot; d.mu = 1; } });
    if (X.regen && e.hp < e.hpMax) E.fightApi.doHeal(e, (e.hpMax * X.regen) / 100, F);
  };
  /* défi de groupe de la semaine : progression gardée par semaine, payée une fois (registre, activité « mut ») */
  E.monoMutDefi = (S) => {
    if (!season(S)) return null; const w = E.monoMutWeek(S), m = E.monoMutOf(S); if (!m) return null;
    const key = `s${S.mono.s || 1}-w${w}`; let R = S.mono.mutd; if (!R || R.k !== key) R = S.mono.mutd = { k: key, n: 0, paid: 0 };
    return { w, m, n: R.n, need: MU.defi.need, paid: R.paid, gain: MU.defi.n, src: `${key}-mut` };
  };
  E.monoMutPay = (S) => {
    const X = E.monoMutDefi(S); if (!X || X.paid || X.n < X.need || !E.tfState) return 0;
    const T = E.tfState(S); const q = Math.max(0, E.tfQuota(S) - E.tfActTotal(S)); const g = Math.min(X.gain, q);
    S.mono.mutd.paid = E.now();
    if (g <= 0) return 0;
    E.tfPost(S, g, "act", `act:${X.src}`, `Défi de groupe de la semaine : ${X.m.c}`);
    if (E.tfSrvOf(S) || (E.tfSrv && E.tfSrv.live(S))) { (T.q = T.q || []).push({ t: "act", k: MU.defi.kind, n: g, src: X.src }); try { if (E.tfSrv && E.tfSrv.live(S)) E.tfSrv.flush(S); } catch (e) {} }
    if (E.note) E.note(S, `Défi de groupe de la semaine « ${X.m.c} » réussi : +${g} Éclats du Temps.`, "rare");
    return g;
  };
  const emit0 = E.emit;
  E.emit = function (S, t, d) {
    const r = emit0.apply(this, arguments);
    if (t === "dungeon" && S && !S.monoRun && season(S)) try {
      d = d || {};
      if (d.group && (d.stasis || 1) >= MU.from) { const X = E.monoMutDefi(S); if (X && !X.paid) { S.mono.mutd.n++; E.monoMutPay(S); } }
      if (d.group && Array.isArray(d.with) && d.with.length) { const G = (S.mono.grpWith = S.mono.grpWith || {}); const k = d.with.map((x) => String(x).slice(0, 20)).sort().join(", "); G[k] = (G[k] || 0) + 1; }
    } catch (e) {}
    return r;
  };
  const boot0 = E.monoBoot;
  E.monoBoot = function (S) { const r = boot0.apply(this, arguments); try {
    const m = E.monoMutOf(S); MU.cur = m ? m.id : null;
    // une partie déjà avancée (au-delà du niveau 20) sans serment : serment ordinaire d'office, le choix n'a plus d'objet
    if (E.monoOathPending(S) && (hero(S) || {}).lvl > SR.lvlMax) S.mono.serment = { t: "ord", at: E.now(), lvl: hero(S).lvl, auto: 1 };
  } catch (e) {} return r; };

  /* ======================= Bilan de fin de saison ======================= */
  const DOFUS_STAGE = () => (M.sdofus && M.sdofus.stages) || [];
  /* srv : ce que le serveur sait (rang au classement de donjon de groupe, semaines couronné), si la partie est en ligne */
  E.monoBilan = (S, srv) => {
    if (!mono(S)) return null;
    const ET = S.mono.eternel || null, c = hero(S) || {}, C = D.CLASSES[c.cls] || {};
    const sid = (ET && ET.s) || S.mono.s || 1, def = E.monoSeasonDef(sid);
    const T = E.tfState ? E.tfState(S) : null; const TF = M.tf;
    const paid = T && TF ? TF.DEFIS.map((x) => ((T.d[x.id] || {}).paid) || 0) : [];
    let dof = null; try { const Q = E.dofusQuest && E.DOFUS && E.DOFUS.phenix ? E.dofusQuest(S, "phenix") : null;
      if (Q && Q.done) { const st = DOFUS_STAGE()[E.phxStage ? E.phxStage(S) : 0]; dof = { n: "Phénix", d: st ? `stade « ${st.n} »` : "Dofus de saison" }; }
      else if (Q) dof = { n: `Étape ${Math.min(5, (Q.step || 0) + 1)} / 5`, d: "quête du Phénix" }; } catch (e) {}
    const AL = (ET && ET.al) || (S.align && S.align.side ? { s: S.align.side, r: E.alignRankIdx ? E.alignRankIdx(S) : 0 } : null);
    const G = S.mono.grpWith || {}; const gk = Object.keys(G).sort((a, b) => G[b] - G[a])[0] || null;
    const fer = ET ? !!ET.fer : E.monoFerOk(S);
    return {
      s: sid, saison: def.nom, theme: def.theme || "", jours: Math.round(M.len / 86400000),
      nom: c.name || "", cls: c.cls || "", classe: C.name || "", lvl: c.lvl || 1, fer,
      dofus: dof, defis: paid.filter((p) => p > 0).length, defisOr: paid.filter((p) => p >= 3).length, defisTot: paid.length || 12,
      rangGrp: srv && srv.rang_grp ? +srv.rang_grp : null, couronnes: srv && srv.couronnes != null ? +srv.couronnes : null,
      camp: AL ? { s: AL.s, nom: (E.ALIGN && E.ALIGN[AL.s] && E.ALIGN[AL.s].name) || AL.s, r: AL.r || 0 } : null,
      groupe: gk ? { n: gk, fois: G[gk] } : null, grp: S.mono.grp || 0, renforts: S.mono.renN || 0,
    };
  };
  const ord = (n) => (n === 1 ? "1er" : `${n}e`);
  E.monoBilanText = (B) => {
    if (!B) return "";
    const L = [`**${B.nom}**, ${B.classe}${B.fer ? " de fer" : ""} · ${B.saison}${B.theme ? ` « ${B.theme} »` : ""} (Monocompte d'Idlus)`,
      `Niveau ${B.lvl}${B.dofus ? ` · Dofus : ${B.dofus.n} (${B.dofus.d})` : ""}`,
      `Défis réussis : ${B.defis} / ${B.defisTot}${B.defisOr ? ` (dont ${B.defisOr} en or)` : ""}`,
      `Donjon de groupe : ${B.rangGrp ? ord(B.rangGrp) + " du classement" : "pas classé"}${B.couronnes ? ` · ${B.couronnes} semaine${B.couronnes > 1 ? "s" : ""} couronné de la Couronne du Temps` : ""}`,
      B.camp ? `Camp : ${B.camp.nom}, rang ${B.camp.r} / 20` : "Sans camp",
      B.groupe ? `Groupe principal : ${B.groupe.n} (${B.groupe.fois} donjon${B.groupe.fois > 1 ? "s" : ""})` : B.grp ? `${B.grp} donjon${B.grp > 1 ? "s" : ""} en groupe` : "Seul jusqu'au bout",
      B.fer ? "Serment de fer tenu jusqu'au bout : un seul héros, aucune aide." : ""];
    return L.filter(Boolean).join("\n") + "\nhttps://idlus.github.io/";
  };

  /* passage à l'Éternel : l'aura de fer reste au héros, et la carte du bilan est gardée telle quelle */
  const et0 = E.monoToEternal;
  E.monoToEternal = function (S) {
    const fer = S && season(S) && E.monoFerOk(S);
    const r = et0.apply(this, arguments);
    if (r && S.mono.eternel) {
      if (fer) { S.mono.eternel.fer = 1; S.unlocks = S.unlocks || {}; S.unlocks[SR.aura] = 1; }
      try { S.mono.eternel.bilan = E.monoBilan(S); } catch (e) {}
    }
    return r;
  };
  /* ce que la saison suivante garde : l'aura de fer aussi (le serveur la garde de son côté dans cosm_droits) */
  const leg0 = E.monoLegacy;
  E.monoLegacy = function (S) { const L = leg0.apply(this, arguments); if (S && S.unlocks && S.unlocks[SR.aura] && !L.u.includes(SR.aura)) L.u.push(SR.aura); return L; };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
