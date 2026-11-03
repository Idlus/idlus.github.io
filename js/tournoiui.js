/* ============================================================================
   Saison 1, lot 8 (interface) : la page Tournoi des guildes (Joueurs). Moteur : js/tournoi.js ; serveur : fonction
   « record » ({ tournoi }) et supabase/tournoi.sql. Classique · Saison 1 et Éternel, pas en Monocompte.
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S, UI = () => window.DX.ui;
  const ON = () => window.ONLINE;
  const h = (s) => X().h(s);
  const G = { v: null, at: 0, busy: false, err: "" };
  const dur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60);
    return d ? `${d} j ${hh} h` : hh ? `${hh} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
  const me = () => (ON() && ON().user ? ON().user.id : "");
  const gName = (st, i) => (i < 0 ? "Exemptée" : h((st.seeds[i] || {}).name || "?"));
  function bracket(st) {
    const e = E(); if (!st || st.void) return `<p class="small muted">${st && st.void ? "Pas assez de guildes inscrites cette semaine : il en faut au moins 2." : "Le tableau se fait samedi à midi."}</p>`;
    const mine = st.seeds.findIndex((s) => s.teams.some((x) => x.u === me()));
    const col = st.rounds.map((R, r) => `<div class="tr-col"><b class="xs">${e.tourRoundName(st, r)}</b>${R.map((m) => {
      const wa = m.d.filter((d) => d.w === 0).length, wb = m.d.filter((d) => d.w === 1).length;
      const row = (i, w) => `<span class="tr-g${m.win === i && i >= 0 ? " win" : ""}${i === mine && i >= 0 ? " me" : ""}"><span class="grow">${gName(st, i)}</span>${m.a >= 0 && m.b >= 0 && m.d.length ? `<b class="num">${w}</b>` : ""}</span>`;
      return `<div class="tr-m">${row(m.a, wa)}${row(m.b, wb)}${m.win === null && m.a >= 0 && m.b >= 0 ? `<span class="xs muted">${R.length === 1 ? "dimanche 20 h" : "à jouer"}</span>` : ""}</div>`; }).join("")}</div>`).join("");
    const champ = st.champ !== null ? `<p class="tr-champ"><img src="assets/s1/tr/1.webp" alt=""> ${gName(st, st.champ)} gagne le Tournoi des guildes !</p>` : "";
    return `${champ}<div class="tr-br">${col}</div>`;
  }
  function pageHtml() {
    const s = S(), e = E(), on = ON();
    const head = `<div class="pagehead"><h1>Tournoi des guildes</h1></div>`;
    if (s.mono) return `${head}<section class="panel"><p class="pad">Pas de tournoi en Monocompte : il n'y a pas de guildes.</p></section>`;
    if (!on || !on.user) return `${head}<section class="panel"><p class="pad">Connecte-toi pour jouer le Tournoi des guildes.</p></section>`;
    const V = G.v, ph = V ? V.phase : e.tourPhase(), T = e.TOUR;
    const when = ph === "inscr" ? `Inscriptions ouvertes : encore ${dur(e.tourUntil(T.INSCR_END))}` : ph === "tours" ? `Tours en cours · finale dans ${dur(e.tourUntil(T.FINAL))}` : "Finale jouée";
    const ins = (V && V.ins) || []; const myRow = ins.find((x) => x.u === me()); const gid = myRow ? myRow.g : null;
    const byG = {}; ins.forEach((x) => { (byG[x.g] = byG[x.g] || { name: x.name, L: [] }).L.push(x); });
    const myG = gid != null ? byG[gid] : null;
    const team = myG ? myG.L.map((x) => `<li><span class="grow">${h(x.n || "?")} · niv. ${x.lvl}</span><span class="xs muted">${(x.heads || []).map((c) => h(((window.DATA.CLASSES || {})[c.cls] || {}).name || c.cls)).join(", ")}</span>${ph === "inscr" && x.u !== me() ? `<button class="btn sm" data-act="tr-kick" data-v="${x.u}" title="Meneur ou Bras droit">Retirer</button>` : ""}</li>`).join("") : "";
    const btns = ph === "inscr" ? `<button class="btn primary" data-act="tr-join"${G.busy ? " disabled" : ""}>${myRow ? "Mettre à jour mon équipe" : "Inscrire mon équipe d'arène"}</button>${myRow ? `<button class="btn" data-act="tr-leave">Me retirer</button>` : ""}` : "";
    const st = V && V.state; const done = V && V.done && st && st.champ !== null;
    const got = s.tour && st && s.tour.got[st.w];
    const claim = done && st.seeds.some((g) => g.teams.some((x) => x.u === me())) ? (got ? `<span class="tag good">Récompense reçue</span>` : `<button class="btn primary" data-act="tr-claim">Recevoir ma récompense</button>`) : "";
    const nG = Object.keys(byG).length;
    return `${head}<div class="stack tr-page">
      <section class="panel"><img class="s1-mo" src="assets/s1/mo/tour.webp" alt="" loading="lazy"><div class="pad stack"><span class="small">Chaque guilde inscrit jusqu'à ${T.TEAMS} équipes d'arène (celle du Kolizéum de chaque membre). Le samedi à midi, le tableau se fait tout seul ; une rencontre, c'est ${T.TEAMS} combats 3 contre 3, la guilde qui en gagne le plus passe. Finale le dimanche à 20 h.</span>
        <div class="tr-sum"><span><span class="xs muted">Cette semaine</span><b>${when}</b></span><span><span class="xs muted">Guildes inscrites</span><b class="num">${nG}</b></span><span><span class="xs muted">Ta guilde</span><b>${myG ? `${h(myG.name)} · ${myG.L.length} / ${T.TEAMS}` : "pas inscrite"}</b></span></div>
        ${team ? `<ul class="tr-team">${team}</ul>` : ""}<div class="row">${btns}${claim}<button class="btn sm" data-act="tr-ref">Actualiser</button></div>
        ${G.err ? `<span class="small bad">${h(G.err)}</span>` : ""}
        <span class="xs muted">Récompenses (une fois par semaine, pour chaque inscrit) : ${T.CHEST.map((c) => h(window.DATA.CONSUMABLES[c].name)).join(" · ")} selon le tour atteint, et le titre « ${T.TITLE} » pour la guilde gagnante.</span></div></section>
      <section class="panel"><div class="phead"><h2>Tableau</h2></div><div class="pad">${V ? bracket(st) : `<p class="small muted">Lecture du tournoi…</p>`}</div></section></div>`;
  }
  async function load(force) {
    if (!ON() || !ON().tourView || G.busy) return; if (!force && Date.now() - G.at < 30000) return;
    G.busy = true; const r = await ON().tourView(); G.busy = false; G.at = Date.now();
    if (r && r.ok) { G.v = r.view; G.err = ""; } else G.err = (r && r.err) || "Pas de réponse du serveur.";
    repaint();
  }
  const page = (main) => { main.innerHTML = pageHtml(); load(false); };
  window.DX.pages.tour = page;
  const repaint = () => { const m = document.querySelector("#main"); if (UI().tab === "tour" && m) m.innerHTML = pageHtml(); };
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^tr-/.test(t.dataset.act) || !S()) return; const a = t.dataset.act;
    if (a === "tr-ref") { load(true); return; }
    if (a === "tr-join") { if (X().pushNow) await X().pushNow(); G.busy = true; repaint(); const r = await ON().tourJoin(); G.busy = false;
      if (!r || !r.ok) { X().toast((r && r.err) || "Pas de réponse du serveur."); repaint(); return; } X().toast("Équipe inscrite au tournoi."); load(true); return; }
    if (a === "tr-leave" || a === "tr-kick") { const r = await ON().tourLeave(a === "tr-kick" ? t.dataset.v : null); const d = r && r.data;
      if (r.err || !d || d.err) { X().toast((d && d.err) || r.err || "Erreur."); return; } X().toast(a === "tr-kick" ? "Équipe retirée." : "Tu t'es retiré du tournoi."); load(true); return; }
    if (a === "tr-claim") { const r = E().tourClaim(S(), G.v && G.v.state, me()); if (typeof r === "string") { X().toast(r); return; }
      X().markDirty(); X().toast(`${window.DATA.CONSUMABLES[r.chest].name} reçu${r.title ? ` et titre « ${r.title} »` : ""} !`); repaint(); }
  });
  window.TOURUI = { pageHtml, bracket };
})();
