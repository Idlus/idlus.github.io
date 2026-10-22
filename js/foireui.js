/* ============================================================================
   FOIRE DU TROOL (interface), Idlus 1.0.30 « L'économie » (choix 28C + Jackpot, écran v-foire)
   Page Économie › Foire du Trool : le Jackpot du serveur (supabase/foire.sql : ticket 10 000 k, tirage toutes les
   heures, gain versé comme une vente de l'HdV) et les Caisses du Trool (js/foire.js : 3 caisses, 5 raretés
   aux chances affichées, ouverture qui défile, 20 par jour).
   La page n'est dessinée qu'à l'ouverture et après une action ; le compte à rebours et le pot se mettent à jour
   par petites retouches (#foTimer, #foJack), jamais en redessinant toute la page.
   1.0.30.5 « Compteur du Jackpot » (choix 1A 2A 3A 4A) : une pastille dans la ligne du haut (#jpbar) montre le pot et
   le temps avant le tirage sur toutes les pages, pour les joueurs connectés à un compte ; le pot est relu toutes les
   5 minutes (et à chaque achat ou tirage), la pastille brille en or les 5 dernières minutes.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !E.FOIRE || !window.DX) return;
  const ON = window.ONLINE;
  const F = E.FOIRE;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const $ = (s) => document.querySelector(s);
  const h = (s) => X().h(s);
  const fmt = (n) => X().fmt(n);
  const st = { pick: "bois", last: null, rolling: false };
  const J = { data: null, at: 0, off: 0, loading: null, err: false, busy: false, missing: false };

  /* ---------- Jackpot (serveur) ---------- */
  const online = () => !!(ON && ON.enabled);
  const acct = () => !!(online() && ON.user && ON.profile && ON.link().uid === ON.user.id && !(ON.solo && ON.solo()));
  const noFn = (e) => /function|does not exist|could not find|schema cache|PGRST202/i.test(String(e || ""));
  function jLoad() {
    if (!online()) return Promise.resolve(false);
    if (J.loading) return J.loading;
    J.loading = ON.rpc("foire_jackpot").then((r) => {
      J.loading = null;
      if (r.err || !r.data || r.data.err) { J.err = true; if (r.err && noFn(r.err)) J.missing = true; return false; }
      jSet(r.data); return true;
    }).catch(() => { J.loading = null; J.err = true; return false; });
    return J.loading;
  }
  function jSet(d) {
    J.data = d; J.at = Date.now(); J.err = false; J.missing = false; J.off = Date.now() - (+d.now || Date.now());
    const s = S(); if (s && d.mine > 0) { const G = E.foireState(s); G.jend = +d.end + J.off; } // le tirage de cette heure, à demander quand elle sera finie
    paintChip();
  }
  const jLeft = () => (J.data ? Math.max(0, +J.data.end + J.off - Date.now()) : 0);
  const minTxt = (ms) => { const m = Math.ceil(ms / 60000); return m <= 1 ? "moins d'une minute" : `${m} min`; };
  const hourTxt = (ms) => { const d = new Date(+ms + J.off); return `${d.getHours()} h`; };
  async function jBuy(n) {
    if (!acct() || J.busy) return;
    J.busy = true; paintJack();
    try {
      try { await X().onPush(); } catch (e) {}
      const s = S(); const cur = (s && s.hdv && s.hdv.op) || 0;
      const r = await ON.rpc("foire_jackpot_buy", { p_after: cur, p_n: n });
      if (r.err) { X().toast(/connexion/i.test(r.err) ? r.err : "Refusé par le serveur : " + r.err); return; }
      if (!r.data || r.data.err) { X().toast((r.data && r.data.err) || "Refusé par le serveur."); return; }
      if (r.data.ops && window.MARKET) window.MARKET.apply(r.data.ops, true);
      jSet(r.data); X().markDirty();
      X().toast(`${n > 1 ? n + " tickets" : "Ticket"} de Jackpot : bonne chance ! Tirage dans ${minTxt(jLeft())}.`, "rare");
    } finally { J.busy = false; paint(); }
  }
  function jackHtml() {
    const s = S(); const d = J.data;
    const head = `<div class="phead"><h2>${X().IC("bourse")} Jackpot du serveur</h2><span class="tag soft">tirage toutes les heures</span></div>`;
    const rule = `<span class="small fo-c">Chaque ticket coûte 10 000 k : 9 000 k vont au pot, 1 000 k sortent du jeu. Un gagnant tiré au sort toutes les heures parmi les tickets de l'heure.</span>`;
    if (online() && ON.monoPart && ON.monoPart()) return `<section class="panel" id="foJack">${head}<div class="pad stack">${rule}${X().soloPanel("le Jackpot")}</div></section>`; // 2.1.37.x : Jackpot du Classique, rien depuis le Monocompte
    if (!online()) return `<section class="panel" id="foJack">${head}<div class="pad stack">${rule}<div class="empty">Hors ligne : le Jackpot passe par le serveur, il revient avec la connexion.</div></div></section>`;
    if (!d) {
      if (!J.loading && !J.err) jLoad().then(() => paintJack());
      return `<section class="panel" id="foJack">${head}<div class="pad stack">${rule}<div class="empty">${J.missing ? "Le Jackpot n'est pas encore ouvert sur le serveur." : J.err ? `Pas de réponse du serveur. <button class="btn sm" data-act="fo-jretry">Réessayer</button>` : "Lecture du pot…"}</div></div></section>`;
    }
    const solo = ON.user && ON.solo && ON.solo();
    const can = acct() && !J.busy; // 1.0.32.6 : tickets illimités (seuls les kamas comptent)
    const btns = acct() ? `<button class="btn primary" data-act="fo-jbuy" data-n="1" ${can && s.kamas >= 10000 ? "" : "disabled"}>Acheter un ticket · 10 000 k</button><button class="btn" data-act="fo-jbuy" data-n="10" ${can && s.kamas >= 100000 ? "" : "disabled"}>10 tickets · 100 000 k</button><button class="btn" data-act="fo-jbuy" data-n="100" ${can && s.kamas >= 1000000 ? "" : "disabled"}>100 tickets · 1 M</button>`
      : solo ? "" : `<button class="btn primary" data-act="on-loginscreen">Créer mon compte pour jouer</button>`;
    const L = (d.last || []).slice(0, 5);
    const last = L.length ? `<div class="xs fo-c fo-gold">Dernier gagnant : ${h(L[0].p)}, ${fmt(L[0].k)} k (${hourTxt(L[0].h)})${L[0].me ? " : toi !" : ""}</div>` : `<div class="xs muted fo-c">Pas encore de gagnant : le premier tirage aura lieu à la fin de l'heure.</div>`;
    return `<section class="panel" id="foJack">${head}<div class="pad stack">
      <div class="fo-jack num">${fmt(d.pot)} k</div>${rule}
      ${solo ? X().soloPanel("le Jackpot") : ""}
      <div class="row fo-jrow">${btns}<span class="xs muted"><span id="foTimer">tirage dans ${minTxt(jLeft())}</span> · tu as ${fmt(d.mine)} ticket${d.mine > 1 ? "s" : ""} sur ${fmt(d.tickets)} · tickets illimités${acct() && d.day ? ` (${fmt(d.day)} aujourd'hui)` : ""}</span></div>
      ${last}${L.length > 1 ? `<div class="fo-wins">${L.slice(1).map((w) => `<span class="xs"><b>${h(w.p)}</b> ${fmt(w.k)} k · ${hourTxt(w.h)}</span>`).join("")}</div>` : ""}</div></section>`;
  }
  const paintJack = () => { const el = $("#foJack"); if (el && UI().tab === "foire") el.outerHTML = jackHtml(); };

  /* ---------- 1.0.30.5 : pastille du Jackpot dans la ligne du haut ---------- */
  const potShort = (k) => (k >= 1e6 ? `${(Math.floor(k / 1e4) / 100).toLocaleString("fr-FR")} M` : `${fmt(k)} k`);
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CH = { shown: 0, raf: 0 };
  function chipHtml(pot) {
    const left = jLeft(); const t = left > 0 ? minTxt(left) : "tirage en cours";
    const hot = left > 0 && left <= 5 * 60000;
    return X().tchip({ k: "jack", ico: `<img src="assets/ui/bourse.webp" alt="">`, t: `Jackpot <span class="jp-n num">${potShort(pot)}</span>`, d: left > 0 ? `tirage dans ${t}` : t, s: `<span class="jp-n num">${potShort(pot)}</span> · ${left > 0 ? t : "tirage"}`,
      go: `data-act="fo-go"`, tip: `Jackpot du Trool : ${fmt(pot)} kamas dans le pot, ${left > 0 ? `tirage dans ${t}` : "tirage en cours"}. Clique pour aller à la Foire.` }).replace('class="tchip k-jack', `class="tchip k-jack${hot ? " hot" : ""}`);
  }
  /* les chiffres défilent de l'ancien pot au nouveau (1,2 s), sauf si l'appareil demande moins d'animations */
  function rollTo(from, to) {
    cancelAnimationFrame(CH.raf);
    if (reduce() || !(to > from)) { CH.shown = to; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1200); const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      CH.shown = v; document.querySelectorAll("#jpbar .jp-n").forEach((n) => { n.textContent = potShort(v); });
      if (p < 1) CH.raf = requestAnimationFrame(step);
    };
    CH.raf = requestAnimationFrame(step);
  }
  function paintChip() {
    let b = $("#jpbar");
    if (!b) { const up = $("#wbbar") || $("#updbar"); if (!up) return; b = document.createElement("div"); b.id = "jpbar"; up.after(b); }
    const d = J.data; const pot = d ? +d.pot || 0 : 0;
    if (!S() || !acct() || !d || !pot || UI().tab === "foire" || UI().watch) { if (b.innerHTML) b.innerHTML = ""; CH.shown = pot; return; }
    const from = CH.shown && CH.shown < pot ? CH.shown : pot;
    const html = chipHtml(from);
    if (b.dataset.k !== html) { b.dataset.k = html; b.innerHTML = html; }
    if (from < pot) rollTo(from, pot); else CH.shown = pot;
  }

  /* ---------- Caisses du Trool ---------- */
  const caisse = (id) => F.CAISSES.find((c) => c.id === id) || F.CAISSES[0];
  const kShort = (k) => (k >= 1e6 ? `${(Math.round(k / 1e5) / 10).toLocaleString("fr-FR")} M` : `${fmt(k)} k`);
  /* une case de la bande qui défile : image et nom court du lot */
  function lotCell(lot, win) {
    const R = F.RAR[lot.r]; const C = lot.cons ? D.CONSUMABLES[lot.cons[0]] : null;
    const img = lot.title ? "assets/ui/couronne.webp" : lot.item ? X().itemImg(lot.item) : lot.res ? X().resImg(lot.res[0]) : C && C.img ? `assets/ui/coffres/${C.img}.svg` : C && C.pimg ? `assets/ui/potions/${C.pimg}.png`
      : lot.cons ? (/^bonbon/.test(lot.cons[0]) ? "assets/ui/bonbon.webp" : /^parch/.test(lot.cons[0]) ? "assets/ui/parchemin_or.webp" : "assets/ui/cristal.webp") : lot.sab ? "assets/ui/cristal.webp" : lot.key ? "assets/ui/cle.webp" : "assets/ui/kamas.webp";
    const t = lot.title ? "Titre « " + lot.title + " »" : lot.item ? D.ITEMS[lot.item].name : lot.res ? `${lot.res[0]} ×${fmt(lot.res[1])}` : C ? `${C.name}${lot.cons[1] > 1 ? " ×" + lot.cons[1] : ""}` : lot.sab ? `Sablier ${lot.sab} h` : lot.key ? `${lot.key[1]} clé${lot.key[1] > 1 ? "s" : ""}` : kShort(lot.k);
    return `<div class="it${win ? " win" : ""}" style="--r:${R.color}"><img src="${img}" alt="" loading="lazy"><span>${h(t)}</span></div>`;
  }
  const CELL = 68, WIN = 30; // largeur d'une case + écart (62 + 6), position du lot gagné dans la bande
  function rollHtml(spinning) {
    const L = st.last; const cells = L ? L.cells : null;
    const track = cells ? cells.map((c, i) => lotCell(c, !spinning && i === WIN)).join("") : "";
    const x = cells && !spinning ? WIN * CELL + 31 : 31;
    return `<div class="fo-roll" id="foRoll">${cells ? `<div class="fo-track" style="transform:translateX(-${x}px)">${track}</div>` : `<div class="fo-idle small muted">Choisis ta caisse, puis ouvre-la : la bande défile et s'arrête sur ton lot.</div>`}</div>`;
  }
  const resHtml = () => { const L = st.last; if (!L || st.rolling) return `<div class="small fo-c" id="foRes">&nbsp;</div>`; const R = F.RAR[L.lot.r];
    return `<div class="small fo-c" id="foRes"><b style="color:${R.color}">${R.name} !</b> ${h(L.txt[0].toUpperCase() + L.txt.slice(1))}</div>`; };
  function cratesHtml() {
    const s = S(); const C = caisse(st.pick); const left = E.foireLeft(s);
    const cards = F.CAISSES.map((c) => `<button class="fo-crate ${c.id === C.id ? "on" : ""}" data-act="fo-pick" data-v="${c.id}" aria-pressed="${c.id === C.id}"><img src="assets/ui/coffres/${c.img}.svg" alt=""><b class="small">${h(c.name)}</b><span class="xs">${fmt(c.cost)} k</span><span class="xs muted">lots de ${kShort(Math.round(c.cost * F.RAR[0].mult))} à ${kShort(c.cost * F.RAR[4].mult)}</span></button>`).join("");
    const odds = `<div class="fo-odds">${F.RAR.map((r) => `<span style="--r:${r.color}">${r.name}<br>${r.p} %</span>`).join("")}</div>`;
    const can = left > 0 && s.kamas >= C.cost && !st.rolling;
    return `<section class="panel" id="foCrates"><div class="phead"><h2>${X().IC("coffre")} Choisis ta caisse</h2><span class="xs muted">${left ? `encore ${left} ouverture${left > 1 ? "s" : ""} aujourd'hui` : "plus d'ouverture aujourd'hui"}</span></div>
      <div class="pad stack"><div class="fo-crates">${cards}</div>${rollHtml(st.rolling)}${resHtml()}${odds}
      <div class="row fo-c"><button class="btn primary" id="foGo" data-act="fo-open" ${can ? "" : "disabled"}>Ouvrir la ${h(C.name)} · ${kShort(C.cost)}</button></div>
      <span class="xs muted fo-c">${!left ? `Le Trool rouvre ses caisses demain (${F.DAY} par jour).` : s.kamas < C.cost ? `Il te manque ${fmt(C.cost - s.kamas)} kamas.` : `Chaque rareté vaut une part de la mise : ×${String(F.RAR[0].mult).replace(".", ",")} à ×${F.RAR[4].mult}. En moyenne, ${Math.round(E.foireRtp() * 100)} % de la mise revient en lots.`}</span></div></section>`;
  }
  function feedHtml() {
    const s = S(); const L = (E.foireState(s).log || []).filter((x) => x.r >= 2).slice(0, 6);
    return `<section class="panel"><div class="phead"><h2>Tes derniers gros lots</h2></div><div class="list">${L.map((x) => `<div class="li small"><b style="color:${F.RAR[x.r].color}">${F.RAR[x.r].name}</b><span class="grow">${h(x.txt)}</span><span class="xs muted">${h(caisse(x.c).name)}</span></div>`).join("") || `<div class="empty">Pas encore de lot rare : les rares, épiques et légendaires apparaîtront ici.</div>`}</div></section>`;
  }
  function paint() {
    const main = $("#main"); if (!main || UI().tab !== "foire" || !S()) return;
    page(main);
  }
  function page(main) {
    const s = S(); const G = E.foireState(s); const d = J.data;
    const head = `<div class="pagehead"><h1>Foire du Trool</h1><span class="small muted"><span class="coin"></span> <b class="num" id="foKamas">${fmt(s.kamas)}</b> kamas</span></div>`;
    const hd = `<div class="fo-hd"><img src="assets/m/129.png" alt=""><div class="stack" style="gap:4px"><b class="fo-t">Caisses et Jackpot du Trool</b><span class="small">Mise des kamas, et repars avec un lot. Les chances sont affichées. Rien ne s'y achète avec de l'argent réel, et on n'y gagne jamais de Dofus.</span><span class="xs muted">Aujourd'hui : ${G.n} partie${G.n > 1 ? "s" : ""} sur ${F.DAY}${d && d.mine ? ` · ${fmt(d.mine)} ticket${d.mine > 1 ? "s" : ""} de Jackpot cette heure` : ""}</span></div></div>`;
    main.innerHTML = `${head}<div class="stack">${hd}${jackHtml()}${cratesHtml()}${feedHtml()}</div>`;
  }
  window.DX.pages.foire = (main) => { if (st.rolling && $("#foRoll")) return; st.rolling = false; page(main); if (online() && Date.now() - J.at > 60000) jLoad().then(paintJack); };

  /* ouverture : le lot est donné tout de suite (js/foire.js), la bande défile ensuite jusqu'à lui */
  function open() {
    const s = S(); if (!s || st.rolling) return;
    const C = caisse(st.pick); const r = E.foireOpen(s, C.id);
    if (r.err) { X().toast(r.err); return; }
    X().markDirty();
    const cells = []; for (let i = 0; i < WIN + 12; i++) cells.push(i === WIN ? r.lot : E.foireLot(s, C.id, Math.random));
    st.last = { lot: r.lot, txt: r.txt, cells, c: C.id };
    const reduce = document.body.classList.contains("reduced") || document.body.classList.contains("nomotion") || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduce) { paint(); X().renderStatus(); return; }
    st.rolling = true; paint(); X().renderStatus();
    const tr = document.querySelector("#foRoll .fo-track"); if (!tr) { st.rolling = false; paint(); return; }
    const end = () => { if (!st.rolling) return; st.rolling = false; paint(); };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      tr.style.transition = "transform 3.6s cubic-bezier(.12,.75,.15,1)";
      tr.style.transform = `translateX(-${WIN * CELL + 31}px)`;
      tr.addEventListener("transitionend", end, { once: true });
      setTimeout(end, 4000);
    }));
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t) return; const a = t.dataset.act; if (!/^fo-/.test(a) || !S()) return;
    if (a === "fo-pick") { if (st.rolling) return; st.pick = t.dataset.v; paint(); return; }
    if (a === "fo-open") { open(); return; }
    if (a === "fo-jbuy") { jBuy(Math.max(1, Math.min(100, +t.dataset.n || 1))); return; }
    if (a === "fo-jretry") { J.err = false; jLoad().then(paintJack); return; }
    if (a === "fo-go") { UI().tab = "foire"; X().closeSheet(); X().render(); window.scrollTo(0, 0); return; }
  });
  document.addEventListener("click", () => setTimeout(() => { try { paintChip(); } catch (e) { /* jamais bloquer */ } }, 0)); // la page change : la pastille se cache sur la Foire

  /* toutes les 20 s : compte à rebours ; le pot relu chaque minute quand la page est ouverte ;
     une heure finie où l'on a des tickets : on demande le tirage (le gain arrive comme une vente de l'HdV) */
  setInterval(() => {
    const s = S(); if (!s) return;
    if (UI().tab === "foire" && document.visibilityState === "visible") {
      const el = $("#foTimer"); if (el && J.data) el.textContent = jLeft() > 0 ? `tirage dans ${minTxt(jLeft())}` : "tirage en cours…";
      const k = $("#foKamas"); if (k) k.textContent = fmt(s.kamas);
      if (online() && (Date.now() - J.at > 60000 || (J.data && jLeft() <= 0))) jLoad().then(paintJack);
    }
    /* la pastille : pot relu toutes les 5 minutes quand le jeu est à l'écran, et juste après le tirage de l'heure */
    if (acct() && document.visibilityState === "visible" && !J.loading && Date.now() - (J.try || 0) > 30000
      && (!J.data || Date.now() - J.at > 5 * 60000 || jLeft() <= 0)) { J.try = Date.now(); jLoad().then(paintChip); }
    paintChip();
    const G = s.foire; if (G && G.jend && Date.now() > G.jend + 5000 && online() && !J.loading) {
      delete G.jend; X().markDirty();
      jLoad().then(() => { paintJack(); setTimeout(() => { if (window.MARKET) window.MARKET.sync(); }, 2000); });
    }
  }, 20000);

  window.FOIREUI = { jLoad, J, st, paintChip };
})();
