/* ============================================================================
   PASSAGE DE RELAIS VERS DIABLOFUS — Idlus 3.2 (Mathis 25/11/2026, maquette « Relais vers Diablofus » :
   1A 2A 3A+B 4A 5C 6A). Page « Diablofus » (menu, Aide, recherche) et bannière fermable sur l'accueil.
   - Récompenses de Vétéran (2A, 3A+B) : 3 paliers ; chaque palier donne un cosmétique ET des Ogrines dans Diablofus.
   - Code personnel (4A) : calculé par le serveur (fonction record, mode « veteran », supabase/relais.sql) ; à coller dans
     Diablofus › Options › Compte › Code cadeau. Le même code donne la suite quand le palier monte.
   - Défi d'adieu (5C) : 14 jours, 5 objectifs (js/adieu.js).
   ========================================================================== */
(function (root) {
  "use strict";
  const DX = () => root.DX, E = () => root.ENGINE, ON = () => root.ONLINE;
  const URL_DF = "https://diablofus.com/?depuis=idlus-relais";
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = (root.RELAIS = {
    TIERS: [
      { n: "Bronze", crit: "Un héros niveau 50", cos: ["titre", "Titre", "Vétéran d'Idlus"], og: 300 },
      { n: "Argent", crit: "Un héros niveau 200", cos: ["orn", "Ornement de nom", "Feuille d'Idlus"], og: 700 },
      { n: "Or", crit: "Stasis 6 réussie ou 6 Dofus", cos: ["aur", "Auréole exclusive", "Émeraude d'Idlus"], og: 1500 },
    ],
    srv: null, // dernière réponse du serveur { code, palier, adieu }
    busy: false, msg: "",
  });
  const S = () => DX() && DX().S;
  const nf = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const quand = (t) => { const d = new Date(t); const j = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" }); try { return f.format(d).replace(":00", " h").replace(":", " h "); } catch (e) { return j[d.getDay()]; } };
  const reste = (ms) => { const hh = Math.max(0, Math.floor(ms / 3600000)); return hh >= 24 ? `${Math.floor(hh / 24)} j ${hh % 24} h` : `${hh} h ${Math.floor((ms % 3600000) / 60000)} min`; };

  /* ---------- bannière de l'accueil (1A) ---------- */
  R.banner = () => {
    const s = S(); if (!s || (s.settings && s.settings.relaisBanX)) return "";
    const ph = E().adieuPhase ? E().adieuPhase() : "fini";
    const sub = ph === "en cours" ? "Le Défi d'adieu est ouvert : 5 objectifs pour un titre dans Diablofus, en plus de tes récompenses de Vétéran."
      : "Joue au nouveau jeu du créateur d'Idlus et récupère tes récompenses de Vétéran.";
    return `<div class="rx-ban"><img class="l" src="assets/relais/diablofus-logo.webp" alt="Diablofus" width="112" height="46"><span class="rx-bt"><b>Idlus passe le relais à Diablofus</b><small>${h(sub)}</small></span><button class="rx-go" data-act="nav" data-v="diablofus">Découvrir</button><button class="rx-x" data-rx="banx" aria-label="Fermer la bannière" title="Fermer">✕</button></div>`;
  };

  /* ---------- page ---------- */
  const rw = (k, lab, val) => `<div class="rx-rw">${k === "aur" ? '<span class="rx-aur" aria-hidden="true"></span>' : `<span class="ic" aria-hidden="true">${{ titre: "🏷️", orn: "✨", og: "💎" }[k]}</span>`}<span><small>${h(lab)}</small>${k === "titre" ? `<span class="rx-title">${h(val)}</span>` : k === "orn" ? `<span class="rx-orn">${h(val)}</span>` : k === "og" ? `<span class="rx-og">${h(val)}</span>` : h(val)}</span></div>`;
  function tiersHtml(s) {
    const v = E().veteranOf(s); const sp = R.srv ? R.srv.palier : null;
    const prog = [Math.min(1, v.lvl / 50), Math.min(1, v.lvl / 200), Math.min(1, Math.max(v.dof / 6, v.stz / 6))];
    const sub = ["", "", `${Math.min(6, v.dof)} / 6 Dofus · meilleure stasis ${v.stz}`];
    return `<div class="rx-tiers">${R.TIERS.map((t, i) => { const ok = sp != null ? sp > i : v.palier > i;
      return `<div class="rx-t ${ok ? "ok" : "no"}"><div class="h"><b>${t.n}</b><span class="rx-st">${ok ? (sp != null ? "Obtenu" : "Atteint ici") : "En cours"}</span></div><div class="rx-crit">${h(t.crit)}</div>
        <div class="rx-bar"><i style="width:${Math.round((ok ? 1 : prog[i]) * 100)}%"></i></div>${sub[i] && !ok ? `<div class="rx-crit xs">${h(sub[i])}</div>` : ""}
        ${rw(t.cos[0], t.cos[1], t.cos[2])}${rw("og", "Ogrines", nf(t.og) + " Ogrines")}</div>`; }).join("")}</div>`;
  }
  function adieuHtml(s) {
    const A = E().ADIEU, ph = E().adieuPhase(), now = E().now();
    const head = `<div><h2>Défi d'adieu</h2><div class="sub">${ph === "avant" ? `Du ${h(quand(A.from))} au ${h(quand(A.to))} · 5 objectifs` : ph === "en cours" ? `14 jours · 5 objectifs · encore ${reste(A.to - now)}` : "Terminé"}</div></div>`;
    const L = E().adieuList(s), n = L.filter((o) => o.done).length;
    const list = `<div class="rx-obj">${L.map((o) => `<div><span class="ck ${o.done ? "on" : ""}" aria-hidden="true">${o.done ? "✓" : "·"}</span><span class="grow">${h(o.name)}</span><span class="xs">${nf(o.v)} / ${nf(o.goal)}</span></div>`).join("")}</div>`;
    const done = E().adieuDone(s);
    const foot = `<div class="rx-rw">${'<span class="ic" aria-hidden="true">🏷️</span>'}<span><small>Récompense Diablofus (${n} / 5)</small><span class="rx-title">${h(A.TITLE)}</span></span>${done ? '<span class="rx-st on">Réussi</span>' : ""}</div>`;
    const note = ph === "avant" ? "Les objectifs se comptent seulement pendant les 14 jours, sur la partie que tu joues." : ph === "en cours" ? "Comptés sur la partie que tu joues. Après le défi, Idlus passe en mode entretien : le jeu reste en ligne et tes sauvegardes sont gardées." : "Merci d'avoir joué ! Idlus reste en ligne, en mode entretien.";
    return `<section class="rx-ev" id="rx-ev">${head}${list}${foot}<p class="sub">${h(note)}</p></section>`;
  }
  function codeHtml() {
    const on = ON() && ON().user;
    if (!on) return `<p class="rx-crit">Ton palier est calculé par le serveur sur tes parties en ligne (Éternel, Saison 1 et Monocompte, la meilleure compte). Connecte ton compte pour obtenir ton code.</p><div class="row"><button class="btn primary" data-act="options">Se connecter (Options)</button></div>`;
    const r = R.srv;
    const steps = `<ol class="rx-steps"><li>Ouvre <a href="${URL_DF}" target="_blank" rel="noopener">Diablofus</a> sur PC et connecte-toi avec Discord (mode « En ligne »).</li><li>Options › Compte › Code cadeau : colle ton code.</li><li>Tes récompenses arrivent sur ton compte Diablofus. Si tu montes de palier plus tard, reviens ici puis entre le même code : il donne la suite.</li></ol>`;
    if (!r) return `<p class="rx-crit">Un code unique pour ton compte, valable pour un seul compte Diablofus. Aucune nouvelle donnée demandée.</p><div class="row"><button class="btn primary" data-rx="code" ${R.busy ? "disabled" : ""}>${R.busy ? "Calcul du palier…" : "Obtenir mon code"}</button></div>${R.msg ? `<p class="rx-crit">${h(R.msg)}</p>` : ""}`;
    const pal = r.palier > 0 ? `Palier confirmé par le serveur : <b>${R.TIERS[r.palier - 1].n}</b>${r.adieu ? " et Défi d'adieu réussi" : ""}.` : r.adieu ? "Défi d'adieu réussi (pas encore de palier)." : "Pas encore de palier : monte un héros au niveau 50, puis redemande ton code.";
    return `<p class="rx-crit">${pal}</p><div class="rx-code"><code id="rxCode">${h(r.code)}</code><button class="rx-go" data-rx="copy">Copier</button><button class="btn sm" data-rx="code" ${R.busy ? "disabled" : ""}>Recalculer</button></div>${R.msg ? `<p class="rx-crit">${h(R.msg)}</p>` : ""}${steps}`;
  }
  function page(el) {
    const s = S(); if (!s) return;
    if (E().adieuPhase() === "en cours") E().adieuVisit(s);
    el.innerHTML = `<div class="rx-pg">
      <section class="rx-hero"><span class="rx-tag">Gratuit · PC · coop 2 à 4</span><img class="l" src="assets/relais/diablofus-logo.webp" alt="Diablofus : Les Douze Enfers" width="330" height="136">
        <p>Le nouveau jeu du créateur d'Idlus : un action-RPG en temps réel dans le Monde des Douze. 10 classes, les sorts officiels, des boss à affronter seul ou à plusieurs.</p>
        <div class="row"><a class="rx-go" href="${URL_DF}" target="_blank" rel="noopener">Jouer à Diablofus</a><span class="rx-url">diablofus.com · sur PC, clavier et souris</span></div></section>
      <section class="rx-sec"><h2>Pourquoi tu vas aimer</h2><div class="rx-3">
        <div class="rx-c"><img src="assets/relais/d-1-groupe.webp" alt="" loading="lazy"><div><b>En coop</b>Jusqu'à 4 amis dans la même partie.</div></div>
        <div class="rx-c"><img src="assets/relais/d-2-sort.webp" alt="" loading="lazy"><div><b>Tes classes de Dofus</b>Les vrais sorts et leurs animations.</div></div>
        <div class="rx-c"><img src="assets/relais/d-3-butin.webp" alt="" loading="lazy"><div><b>Du butin à la pelle</b>Équipe-toi, forgemage, recommence.</div></div></div></section>
      ${adieuHtml(s)}
      <section class="rx-sec" id="rx-tiers"><h2>Tes récompenses de Vétéran</h2><div class="sub">Calculées sur ta progression dans Idlus, tous serveurs confondus. Chaque palier s'ajoute aux précédents. Uniquement de l'apparence et des Ogrines dans Diablofus, aucune puissance.</div>${tiersHtml(s)}</section>
      <section class="rx-sec" id="rx-link"><h2>Récupérer tes récompenses dans Diablofus</h2>${codeHtml()}</section>
    </div>`;
  }
  R.page = page;
  const reg = () => { if (DX() && DX().pages) { DX().pages.diablofus = page; return true; } return false; };
  if (!reg()) { const t = setInterval(() => { if (reg()) clearInterval(t); }, 200); setTimeout(() => clearInterval(t), 20000); }

  async function getCode() {
    if (R.busy) return; R.busy = true; R.msg = ""; rerender();
    const r = await ON().veteran();
    R.busy = false;
    if (r && r.ok) { R.srv = { code: r.code, palier: r.palier, adieu: r.adieu }; R.msg = ""; }
    else R.msg = r && r.err === "trop tôt" ? "Un instant : réessaie dans 20 secondes." : r && r.err === "non connecté" ? "Connecte ton compte d'abord." : "Le serveur ne répond pas, réessaie plus tard.";
    rerender();
  }
  const rerender = () => { if (DX() && DX().ui && DX().ui.tab === "diablofus") DX().render(); };
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-rx]"); if (!b) return;
    const k = b.dataset.rx;
    if (k === "banx") { const s = S(); if (s) { s.settings.relaisBanX = true; b.closest(".rx-ban") && b.closest(".rx-ban").remove(); } }
    else if (k === "code") getCode();
    else if (k === "copy") {
      const t = R.srv && R.srv.code; if (!t) return;
      const ok = () => { b.textContent = "Copié"; setTimeout(() => (b.textContent = "Copier"), 1500); };
      try { navigator.clipboard.writeText(t).then(ok, () => {}); } catch (e) { /* sélection à la main */ }
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
