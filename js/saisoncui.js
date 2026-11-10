/* ============================================================================
   Classique · Saison 1, lot 1 (interface) : tableau de bord de saison en haut de l'accueil (Mathis 8A « Incroyable pour le
   visuel ») et choix des bénédictions (3A). Seulement dans la partie Classique · Saison 1 (js/saisonc.js) : ailleurs, rien.
   Le bandeau reprend l'image de serveur du Classique de saison (assets/s1/srv-2.webp, générée avec ChatGPT, validée le 02/11).
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social, E = () => window.DX.E, S = () => window.DX.S;
  const h = (s) => X().h(s);
  const C = () => E().S1C;
  const dur = (ms) => { const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000); return d ? `${d} j ${hh} h` : `${hh} h`; };
  const on = () => { const s = S(); return !!(s && E().isS1c && E().isS1c(s)); };

  function homeHtml() {
    if (!on()) return "";
    const s = S(), e = E(), c = C(), m = e.s1cManche(s), over = e.s1cOver(s);
    const fr = e.s1cFrag(s), act = e.s1cFragAct(s), q = e.s1cQuota(s), left = e.s1cDayLeft(s);
    const offer = e.s1cBoonOffer(s), got = e.s1cBoonTxt(s), cap = e.s1cMtCap(s);
    const manches = c.manches.map((n, i) => `<span class="s1m ${i + 1 < m ? "done" : i + 1 === m ? "on" : ""}" title="${h(n)}"><b>${i + 1}</b><i>${h(n)}</i></span>`).join("");
    return `<section class="panel s1dash" style="margin-top:14px">
      <div class="s1ban" style="background-image:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.15)),url(assets/s1/srv-2.webp)">
        <div><span class="xs s1kick">${h(c.nom)} · ${h(c.titre)}</span><h2>${over ? "Saison terminée" : `Manche ${m} · ${h(c.manches[m - 1])}`}</h2>
        <span class="small">${over ? "Ton héros rejoindra l'Éternel avec son niveau et ses cosmétiques." : `Fin de la manche dans ${dur(e.s1cMancheLeft(s))} · fin de la saison dans ${dur(e.s1cLeft(s))}`}</span></div>
        <div class="s1ms">${manches}</div></div>
      <div class="s1grid">
        <div class="s1t"><span class="xs muted">Fragments du Temps</span><b class="num">${fr}</b><div class="bar"><i style="width:${q ? Math.min(100, (act / q) * 100) : 0}%"></i></div><span class="xs muted">${act} / ${q} gagnés par les activités${left && !over ? ` · encore ${left} aujourd'hui` : ""}</span></div>
        <div class="s1t"><span class="xs muted">Bénédictions</span><b class="num">${e.s1cBoonGot(s).length} / 20</b><span class="xs muted">${got.length ? h(got.join(" · ")) : "Une à choisir tous les 10 niveaux"}</span>${offer ? `<button class="btn sm primary" data-act="s1c-boon">Choisir (niv. ${offer.lvl})</button>` : ""}</div>
        <div class="s1t"><span class="xs muted">Vitrine de la semaine ${e.s1cWeek(s)}</span><b class="num">${e.VIT ? e.vitWeek(s).filter((v) => !e.vitOwned(s, v.id)).length : 0} / ${e.VIT_N || 0}</b><span class="xs muted">cosmétiques à prendre en Fragments du Temps</span><button class="btn sm" data-act="s1c-vit">Voir la vitrine</button></div>
        <div class="s1t"><span class="xs muted">Caisse du jour</span><img class="s1case" src="${window.coIco("saison")}" alt=""><span class="xs muted">${e.freeCaseLeft(s) ? "Gratuite, une par jour" : `Prochaine dans ${dur(e.freeCaseNext(s))}`}</span>${e.freeCaseLeft(s) && !over ? `<button class="btn sm primary" data-act="s1c-case">Ouvrir</button>` : ""}<button class="btn sm" data-act="s1c-ctr">Contrats (${e.contratLeft(s)})</button></div>
        ${window.CARTEUI ? window.CARTEUI.tile(s) : ""}
        <div class="s1t"><span class="xs muted">Maîtrise de la manche</span><b class="num">${cap === Infinity ? "Sans limite" : cap}</b><span class="xs muted">${cap === Infinity ? "plus de plafond de points pendant la saison" : "points au plus pendant cette manche, relevé à la suivante"}</span></div>
      </div></section>`;
  }
  function boonSheet() {
    const s = S(), e = E(), o = e.s1cBoonOffer(s); if (!o) return;
    const B = (id) => C().BOONS.find((x) => x.id === id);
    X().openSheet(`<h2>Bénédiction du niveau ${o.lvl}</h2><span class="small muted">Choisis-en une : elle dure toute la saison et se cumule avec les autres. Tous les joueurs ont les mêmes trois choix à ce palier.</span>
      <div class="s1boons">${o.ids.map((id) => `<button class="s1b" data-act="s1c-pick" data-id="${id}"><b>${h(B(id).n)}</b><span class="small">${h(B(id).d)}</span></button>`).join("")}</div>
      <div><button class="btn" data-act="closesheet">Plus tard</button></div>`);
  }
  /* lot 4 : vitrine de la semaine (js/vitrine.js) */
  const FR = () => `<img src="assets/i/995001.png" alt="Fragments du Temps">`;
  const vitPic = (v) => (v.k === "bg" ? `<img src="${v.url}" alt="">` : v.k === "aura" ? `<span class="gr-aura gr-a-${v.id} mini"></span>` : v.k === "vic" ? `<span class="gr-vfx gr-v-${v.id} mini"><i></i><i></i><i></i><i></i><i></i></span>`
    : v.k === "st" ? `<img src="assets/s1/st/${v.st}.webp" alt="">` : v.k === "mb" ? `<img src="assets/s1/mb/${v.mb}.webp" alt="">`
    : v.k === "pcol" ? `<span class="gr-pc gr-pc-${v.id}"><b>${h((ON() && ON().profile && ON().profile.pseudo) || S().chars[0].name)}</b></span>` : v.k === "titre" ? `<span class="gr-ttl gr-t-${v.rar}">${h(v.t)}</span>` : `<span class="head lg" data-fr="horloge"></span>`);
  const KN = { aura: "Aura", vic: "Effet de victoire", pcol: "Couleur du pseudo", titre: "Titre", bg: "Décor", cadre: "Cadre", st: "Autocollant du chat", mb: "Meuble rare" };
  function ctrSheet() {
    const s = S(), e = E(), C = window.DATA.CONSUMABLES;
    X().openSheet(`<h2>Contrats de coffres</h2><span class="small muted">Des coffres d'un palier contre un coffre du palier au-dessus, sans hasard. C'est toujours un peu perdant : ça sert à ranger ton sac. Encore ${e.contratLeft(s)} aujourd'hui.</span>
      <div class="stack" style="gap:8px">${e.CONTRAT.map(([f, n, t]) => `<div class="row" style="gap:8px;align-items:center"><img class="s1case" src="${window.coIco(C[f].img)}" alt=""><span class="grow small">${n} × ${h(C[f].name)} → 1 × ${h(C[t].name)}<br><span class="xs muted">tu en as ${s.cons[f] || 0}</span></span><img class="s1case" src="${window.coIco(C[t].img)}" alt=""><button class="btn sm" data-act="s1c-ctrgo" data-id="${f}" ${(s.cons[f] || 0) >= n && e.contratLeft(s) ? "" : "disabled"}>Échanger</button></div>`).join("")}</div>
      <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
  }
  function vitSheet() {
    const s = S(), e = E(), L = e.vitWeek(s), RN = e.GR_RAR;
    X().openSheet(`<h2>Vitrine de la semaine ${e.s1cWeek(s)}</h2><span class="small muted">Les mêmes 6 cosmétiques pour tout le monde cette semaine ; ce qui part revient plus tard dans la saison. Ils restent à ton compte, aussi dans l'Éternel. Tu as <span class="vit-frag">${FR()} ${e.s1cFrag(s)}</span>.</span>
      <div class="vit-grid">${L.map((v) => { const o = e.vitOwned(s, v.id); return `<div class="vit-it r-${v.rar}${o ? " own" : ""}"><span class="vit-pic">${vitPic(v)}</span><b>${h(v.n)}</b><small>${KN[v.k]} · ${RN[v.rar]}</small>${o ? `<span class="xs">✓ à toi</span>` : `<button class="btn sm primary" data-act="s1c-buy" data-id="${v.id}"><span class="vit-frag">${FR()} ${v.prix}</span></button>`}</div>`; }).join("")}</div>
      <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
  }
  /* le serveur garde le registre et les achats dès que la saison est installée (js/online.js, supabase/saison1_vitrine.sql) */
  const ON = () => window.ONLINE;
  async function buy(id) {
    const s = S(), e = E(), v = (e.VIT || []).find((x) => x.id === id);
    const pre = !v || !e.vitWeek(s).some((x) => x.id === id) ? "Pas dans la vitrine cette semaine." : e.vitOwned(s, id) ? "Déjà à toi." : e.s1cFrag(s) < v.prix ? `Il faut ${v.prix} Fragments du Temps.` : null;
    if (pre) { X().toast(pre); return; }
    if (ON() && ON().s1Srv && ON().user) { await flush(); const err = await ON().vitBuy(id); if (err && err !== "hors ligne") { X().toast(err); return; } }
    const err = e.vitBuy(s, id); X().toast(err || "Ajouté à ta Garde-robe !"); if (!err) { X().markDirty(); vitSheet(); X().render(); }
  }
  let busy = false;
  async function flush() {
    const s = S(), e = E(); if (busy || !s || !e.isS1c(s) || !ON() || !ON().s1Srv || !ON().user || !s.s1c.f) return;
    const rows = s.s1c.f.led.filter((l) => l.o === "act" && !l.sv).slice(0, 60); if (!rows.length) return;
    busy = true; try { const r = await ON().fragPush(rows.map((l) => ({ src: l.src, n: l.n }))); if (!r.err) { rows.forEach((l) => (l.sv = 1)); X().markDirty(); } } finally { busy = false; }
  }
  setInterval(flush, 60000);
  // partie Éternel : relire les cosmétiques de vitrine du compte gardés par le serveur
  setTimeout(async () => { const s = S(), e = E(); if (!s || s.mono || (e.isS1c && e.isS1c(s)) || !ON() || !ON().s1Srv || !ON().vitMine) return;
    const L = await ON().vitMine(); if (Array.isArray(L) && L.length) { s.xshop = Object.assign(s.xshop || {}, Object.fromEntries(L.map((id) => [id, 1]))); X().markDirty(); } }, 8000);
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t || !/^s1c-/.test(t.dataset.act) || !on()) return;
    if (t.dataset.act === "s1c-boon") { boonSheet(); return; }
    if (t.dataset.act === "s1c-vit") { vitSheet(); return; }
    if (t.dataset.act === "s1c-ctr") { ctrSheet(); return; }
    if (t.dataset.act === "s1c-ctrgo") { const err = E().contrat(S(), t.dataset.id); X().toast(err || "Contrat signé : coffre ajouté à ton sac."); if (!err) { X().markDirty(); ctrSheet(); X().render(); } return; }
    if (t.dataset.act === "s1c-buy") { buy(t.dataset.id); return; }
    if (t.dataset.act === "s1c-case") { const c = E().freeCaseTier(S()); const err = E().freeCaseOpen(S()); X().toast(err || `Caisse du jour : ${window.DATA.CONSUMABLES[c].name} ajouté à ton sac.`); if (!err) { X().markDirty(); X().render(); } return; }
    if (t.dataset.act === "s1c-pick") { const err = E().s1cBoonPick(S(), t.dataset.id); X().closeSheet(); X().toast(err || "Bénédiction choisie !"); X().render(); }
  });
  window.S1CUI = { homeHtml, boonSheet, vitSheet };
})();
