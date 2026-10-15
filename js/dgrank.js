/* ============================================================================
   CLASSEMENT D'UN DONJON DANS SA FICHE — Idlus 1.0.30 (choix 22A et 23B de Mathis)
   Avant de lancer un donjon : le top 5 du serveur et ta place, juste au-dessus du choix de la stasis,
   Records / Cette semaine (donjons de la semaine seulement) et un lien vers Classements › Donjons.
   Chaque record montre l'équipe qui l'a fait (classes des héros du combat rejoué par le serveur,
   colonne team de supabase/classements.sql) ; les records d'avant la 1.0.30 n'en ont pas.
   Mêmes vues publiques que la page Classements (lb_records, lb_week) : rien n'est envoyé d'ici.
   Réponses gardées 5 min par donjon et par mode (1 min après un échec) ; hors ligne, le bloc n'apparaît pas.
   La réponse ne redessine que le bloc (#dgRank), jamais la fiche.
   ========================================================================== */
(function () {
  "use strict";
  const ON = window.ONLINE && window.ONLINE.enabled ? window.ONLINE : null;
  const E = window.ENGINE, D = window.DATA, VF = window.VERIFY;
  const X = () => window.DX.social;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const LB = () => window.DX.LB;
  const recTime = (t) => { t = Math.max(0, Math.round(t || 0)); const m = Math.floor(t / 60), s = t % 60; return m ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`; };
  const weekNow = () => VF.weekIdx(E.now());
  const isWeekly = (did) => VF.weeklyDungeons(D.DUNGEONS, weekNow()).some((x) => x.did === did);
  const DGR = { cache: {}, busy: {}, mode: "all" };
  const TTL = 300000, TTL_ERR = 60000, N = 5;
  const modeOf = (did) => (DGR.mode === "week" && isWeekly(did) ? "week" : "all");

  /* colonnes ajoutées au serveur après coup, demandées une fois (partagées avec la page Classements) :
     main_lvl (cadre du médaillon) et team (équipe du record) ; sans réseau, on redemandera */
  async function cols(db) {
    const L = LB();
    if (L.ml === undefined) { const { error } = await db.from("lb_level").select("main_lvl").limit(1); L.ml = !error; }
    if (L.rteam === undefined) { const { error } = await db.from("lb_records").select("team").limit(1); if (!error) L.rteam = true; else if (error.code) L.rteam = false; }
  }
  const teamOf = (T) => (Array.isArray(T) ? T.filter((c) => D.CLASSES[c]).slice(0, 8) : []);
  /* équipe d'un record en petites médailles (rien pour un record d'avant la 1.0.30) */
  const teamMini = (T) => { const c = teamOf(T); return c.length ? `<span class="tmini" data-tip="${h("Équipe : " + c.map((x) => D.CLASSES[x].name).join(", "))}">${c.map((x) => X().cmed(x)).join("")}</span>` : ""; };

  function box(did) {
    if (!ON || !ON.db || !ON.db() || !D.DUNGEONS[did]) return "";
    return `<div class="dgrank" id="dgRank" data-did="${h(did)}">${inner(did)}</div>`;
  }
  function patch() { const el = $("#dgRank"); if (el && D.DUNGEONS[el.dataset.did]) el.innerHTML = inner(el.dataset.did); }
  async function fetchTop(did, mode) {
    const db = ON.db(), me = ON.user && ON.user.id, week = mode === "week";
    await cols(db);
    const L = LB(), c = "user_id,pseudo,main,k,t" + (week ? ",r" : "") + (L.ml ? ",main_lvl" : "") + (L.rteam ? ",team" : "");
    const q = () => (week ? db.from("lb_week").select(c).eq("w", weekNow()) : db.from("lb_records").select(c)).eq("did", did);
    const rec = (r) => ({ u: r.user_id, p: r.pseudo, cls: r.main, fl: r.main_lvl, k: r.k, t: r.t, team: teamOf(r.team) });
    const [{ data, error }, sb] = await Promise.all([q().order("k", { ascending: false }).order("t", { ascending: true }).limit(N),
      db.from("firsts").select("key,pseudo").eq("kind", "sb").like("key", did + ":%").then((r) => r, () => ({}))]);
    if (error) return { err: true };
    const out = { rows: (data || []).map(rec), me: null, sb: sb && sb.data ? {} : null };
    ((sb && sb.data) || []).forEach((r) => { const k = +String(r.key).split(":")[1]; if (k) out.sb[k] = r.pseudo; }); /* 2.0.3 : sb null si la liste n'a pas pu être lue */ // Premiers depuis les sorts des boss
    if (me && !out.rows.some((r) => r.u === me)) {
      const { data: m } = await q().eq("user_id", me).limit(1);
      if (m && m[0]) {
        out.me = rec(m[0]);
        out.me.rank = week ? m[0].r : ((await db.from("lb_records").select("user_id", { count: "exact", head: true }).eq("did", did).or(`k.gt.${m[0].k},and(k.eq.${m[0].k},t.lt.${m[0].t})`)).count || 0) + 1;
      }
    }
    return out;
  }
  async function load(did, mode) {
    const key = did + "|" + mode; if (DGR.busy[key]) return; DGR.busy[key] = true;
    let out;
    try { out = await Promise.race([fetchTop(did, mode), new Promise((ok) => setTimeout(() => ok({ err: true }), 12000))]); } catch (e) { out = { err: true }; }
    out.at = Date.now(); DGR.cache[key] = out; DGR.busy[key] = false;
    patch();
  }
  function inner(did) {
    const mode = modeOf(did), week = mode === "week", c = DGR.cache[did + "|" + mode];
    if (!c || Date.now() - c.at > (c.err ? TTL_ERR : TTL)) load(did, mode); // l'ancienne réponse reste affichée pendant le rechargement
    const seg = isWeekly(did) ? `<span class="seg">${[["all", "Records"], ["week", "Cette semaine"]].map(([v, n]) => `<button data-act="dgr-mode" data-v="${v}" aria-pressed="${mode === v}">${n}</button>`).join("")}</span>` : "";
    const head = `<div class="row between dgr-h"><b>${X().IC("trophee")} Classement du serveur <span class="xs muted">· ${h(D.DUNGEONS[did].name)}</span></b>${seg}</div>`;
    const all = `<div class="row"><button class="btn sm" data-act="lb-goto" data-v="${h(did)}" data-w="${week ? 1 : 0}">Classement complet</button></div>`;
    if (!c) return `${head}<span class="xs muted">Chargement du classement…</span>${all}`;
    if (c.err) return `${head}<span class="xs muted">Classement indisponible : le serveur ne répond pas.</span>${all}`;
    const me = ON.user && ON.user.id, inTop = !!me && c.rows.some((r) => r.u === me);
    const row = (r, i, mine) => { const tm = teamMini(r.team);
      return `<div class="lbr${mine ? " me" : r.u === me ? " mine" : ""}${X().staffCls(r.u)}"><span class="rk">${mine ? r.rank : i + 1}</span>${X().cmed(r.cls, r.fl)}<span class="nm">${mine ? X().pname((ON.profile && ON.profile.pseudo) || r.p || "Toi", me) : X().pname(r.p, r.u)}${mine || r.u === me ? ` <small class="inl">toi</small>` : ""}${tm ? `<small>${tm}</small>` : ""}</span><span class="sc">Stasis ${r.k} · ${recTime(r.t)}</span></div>`; };
    const r5 = c.rows[N - 1], foot = [];
    if (!c.rows.length) foot.push(week ? "Personne n'est encore classé cette semaine dans ce donjon : à toi de jouer !" : "Aucun record vérifié ici pour l'instant. Termine une stasis de ce donjon pour ouvrir le classement !");
    else if (!inTop) foot.push(r5 ? `Pour entrer dans le top ${N} : ${r5.k < E.STASIS_MAX ? `stasis ${r5.k + 1}, ou ` : ""}stasis ${r5.k} en moins de ${recTime(r5.t)}.` : `Il reste des places dans le top ${N} : termine une stasis de ce donjon pour y entrer.`);
    if (!me) foot.push("Connecte-toi pour que tes records y entrent.");
    else if (ON.solo && ON.solo()) foot.push("Ta partie solo n'entre pas aux classements : seule la partie 1 y compte.");
    else if (!inTop && !c.me && c.rows.length) foot.push("Toi : pas encore classé ici.");
    if (c.rows.some((r) => r.team.length) || (c.me && c.me.team.length)) foot.push("Les équipes sont celles du combat vérifié par le serveur.");
    // Premiers depuis les sorts des boss : la stasis la plus haute déjà prise et la prochaine encore libre
    const sbK = Object.keys(c.sb || {}).map(Number).sort((a, b) => b - a), sbTop = sbK[0], sbFree = Array.from({ length: E.STASIS_MAX }, (_, i) => i + 1).find((k) => !(c.sb || {})[k]);
    const sbLine = !c.sb ? "" : `<span class="xs dgr-sb">${X().IC("couronne")} <b>Premiers depuis les sorts des boss</b> : ${sbTop ? `stasis ${sbTop} par ${h(c.sb[sbTop] || "?")}. ` : ""}${sbFree ? `La stasis ${sbFree} attend encore son premier.` : "toutes les stasis ont leur premier."}</span>`;
    const list = c.rows.length || c.me ? `<div class="lbt">${c.rows.map((r, i) => row(r, i, false)).join("")}${c.me ? row(c.me, 0, true) : ""}</div>` : "";
    return `${head}${list}${foot.length ? `<span class="xs muted">${foot.join(" ")}</span>` : ""}${sbLine}${all}`;
  }
  /* après un record envoyé (recSubmit) : la fiche du donjon montre la nouvelle place */
  function reset(did) { Object.keys(DGR.cache).forEach((k) => { if (!did || k.startsWith(did + "|")) delete DGR.cache[k]; }); }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-act="dgr-mode"]'); if (!t) return;
    DGR.mode = t.dataset.v === "week" ? "week" : "all"; patch();
  });

  window.DGRANK = { box, reset, cols, teamMini };
})();
