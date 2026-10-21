/* ============================================================================
   Monocompte — écrans « Saison plus » (moteur : js/monoplus.js ; serveur : supabase/mono_social.sql ; amis : js/amis.js),
   d'après la maquette validée par Mathis le 21/10/2026 :
   - Classements de saison (Défis) : Couronne du Temps, puis Niveau, Dofus du Phénix, Donjon de groupe, Serment de fer ;
     lus seulement sur la partie validée par le Bouclier Monocompte (mono_classement) ;
   - Serment de fer (Défis) : les deux serments, l'abandon ;
   - Mutation de la semaine (Défis) : la règle, le défi de groupe, les deux semaines suivantes ;
   - Bilan de saison (Éternel) : la carte, « Partager sur Discord » (texte copié), « Enregistrer l'image » (dessinée sur
     l'appareil), « Aller à l'Éternel » ; montrée à la première visite de l'Éternel ;
   - boîte du donjon : serment, renfort d'un ami à la place du mercenaire, mutation de la semaine.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE; if (!E || !E.MONO || !E.MONO.mut || !window.DX) return;
  const D = window.DATA;
  const X = () => window.DX.social;
  const S = () => window.DX.S;
  const UI = () => window.DX.ui;
  const h = (s) => X().h(s);
  const ON = window.ONLINE;
  const MU = E.MONO.mut;
  const mono = () => { const s = S(); return !!(s && E.isMono && E.isMono(s)); };
  const season = () => mono() && !E.monoEternal(S());
  const hero = () => { const s = S(); return s.chars.find((c) => !c.merc) || s.chars[0]; };
  const AM = () => window.AMIS;
  const srvOn = () => !!(AM() && AM().monoLive());
  const CROWN = (c) => `<svg class="mp-crown ${c || ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9-4.6 3.8L12 5l-2.8 7.8L4.6 9z" fill="#e8c45a" stroke="#7a5a0c" stroke-width="1.2"/><circle cx="12" cy="5" r="1.4" fill="#7fe6ff"/></svg>`;
  const head = (t, sub) => `<div class="pagehead"><h1>${t}</h1>${sub ? `<span class="small muted">${sub}</span>` : ""}</div>`;
  const dur = (ms) => { if (!(ms > 0)) return "–"; const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`; };
  const redraw = () => { if (UI().tab === "ladder") return X().render(); const m = document.getElementById("main"); const P = window.DX.pages[UI().tab]; if (m && P) P(m); }; // 2.1.35.2 : la page Classements affiche aussi les classements de saison
  const leave = () => { UI().tab = "home"; X().render(); };

  /* ---------- menu (appelé par monoNav dans js/ui.js) ---------- */
  function nav(F, DESC, eternal) {
    const has = (k) => F.pages.some((p) => p[0] === k);
    const drop = (k) => { const i = F.pages.findIndex((p) => p[0] === k); if (i >= 0) F.pages.splice(i, 1); };
    if (eternal) { ["saisonlb", "mutation", "serment"].forEach(drop); if (!has("bilan")) F.pages.push(["bilan", "Bilan de saison", "trophee"]); DESC.bilan = "La carte de ta saison, à partager"; return; }
    drop("bilan");
    if (!has("saisonlb")) F.pages.push(["saisonlb", "Classements de saison", "trophee"], ["mutation", "Mutation de la semaine", "cristal"], ["serment", "Serment de fer", "ailes"]);
    DESC.saisonlb = "Niveau, Phénix, donjon de groupe, Serment de fer et Couronne du Temps"; DESC.mutation = "La règle de la semaine des donjons de stasis 7 et plus"; DESC.serment = "Un seul héros, aucune aide : le classement à part";
  }

  /* ---------- Classements de saison et Couronne du Temps ---------- */
  const LB = { type: "grp", data: {}, at: {}, err: "" };
  const TYPES = [["niveau", "Niveau"], ["phenix", "Dofus du Phénix"], ["grp", "Donjon de groupe"], ["fer", "Serment de fer"]];
  async function lbLoad(t) {
    if (!srvOn() || (LB.at[t] && Date.now() - LB.at[t] < 60000)) return; LB.at[t] = Date.now();
    const r = await ON.rpc("mono_classement", { p_type: t, p_saison: null, p_limit: 50 });
    if (r.err) { LB.err = "Classement indisponible pour l'instant."; } else { LB.data[t] = r.data; LB.err = ""; }
    if (UI().tab === "saisonlb" || UI().tab === "ladder") redraw();
  }
  function crownBox() {
    const K = AM() && AM().couronne();
    const P = K && K.porteur, T = K && K.en_tete;
    const when = "la couronne change de tête lundi à 00 h 00, heure de Paris";
    if (!srvOn()) return `<div class="mp-crownbox">${CROWN("big")}<div class="mp-fi"><span class="mp-k">Couronne du Temps</span><b>Une seule couronne, chaque semaine</b><span class="xs muted">Elle va au meilleur temps en donjon de groupe, à la plus haute stasis de la semaine, et se porte toute la semaine suivante. Elle se suit avec le serveur Monocompte.</span></div><span class="mp-o mp-pa">Cosmétique</span></div>`;
    return `<div class="mp-crownbox">${CROWN("big")}<div class="mp-fi"><span class="mp-k">Couronne du Temps · semaine ${K ? K.semaine : "–"}</span>
      <b>${P ? `${h(P.p)} la porte cette semaine` : "Personne ne la porte encore"}</b>
      <span class="xs muted">${P ? `Meilleur temps de la semaine ${P.semaine} (stasis ${P.k}) : ${dur(P.ms)}` : "Le meilleur temps de cette semaine la prendra lundi"}${T ? ` · en tête cette semaine : ${h(T.p)}, stasis ${T.k} en ${dur(T.ms)}` : ""} · ${when}${K && K.moi ? ` · tu l'as portée ${K.moi} semaine${K.moi > 1 ? "s" : ""}` : ""}</span></div><span class="mp-o mp-pa">Cosmétique</span></div>`;
  }
  function lbPage(main) {
    if (!season()) return leave();
    const t = LB.type, R = LB.data[t], s = S(), c = hero();
    const score = (r) => (t === "grp" ? `stasis ${r.k} · ${dur(r.ms)}` : t === "phenix" ? (r.phenix >= 1000 ? `étape ${Math.floor(r.phenix / 1000)}` : "en route") : `niv. ${r.niveau}`);
    const line = (r, me) => `<div class="mp-lr ${me ? "me" : ""}"><span class="mp-rk">${r.rang}</span>${X().cmed(r.cls, r.niveau)}<div class="mp-fi"><b>${X().pname(r.p || "", r.u)}${r.fer ? ` <span class="mp-o mp-fer">fer</span>` : ""}</b><span class="xs muted">${h(r.nom || "")}${t === "grp" && r.at ? ` · ${new Date(r.at).toLocaleDateString("fr-FR")}` : ""}</span></div><b class="mp-sc">${score(r)}</b></div>`;
    let body;
    if (!srvOn()) body = `<div class="mp-card"><b>Les classements de saison passent par le serveur</b><span class="small muted">Ils ne lisent que la partie validée par le Bouclier Monocompte. Hors connexion, ta partie reste sur l'appareil : ${h(c.name)}, niveau ${c.lvl}${E.monoFerOk(s) ? ", sous le Serment de fer" : ""}.</span></div>`;
    else if (!R) { body = `<div class="mp-card"><div class="empty">${LB.err ? h(LB.err) : "Chargement…"}</div></div>`; lbLoad(t); }
    else { const me = ON.user && ON.user.id; const rows = R.rows || [];
      body = `<div class="mp-card">${rows.length ? rows.map((r) => line(r, r.u === me)).join("") : `<span class="small muted">${t === "fer" ? "Personne n'a encore de partie validée sous le Serment de fer." : "Pas encore de partie validée dans ce classement."}</span>`}
        ${R.moi && !rows.some((r) => r.u === me) ? `<div class="mp-sep">…</div>${line(R.moi, true)}` : ""}</div>`; }
    main.innerHTML = `${head("Classements de saison", `${h(E.monoSeasonDef(s.mono.s || 1).nom)} · Monocompte`)}
      ${crownBox()}
      <div class="mp-tabs" role="tablist">${TYPES.map(([k, n]) => `<button role="tab" data-act="mp-lbt" data-v="${k}" aria-selected="${k === t}" class="${k === t ? "on" : ""}">${n}</button>`).join("")}</div>
      ${body}<span class="xs muted">Lus seulement sur la partie validée par le Bouclier Monocompte.${t === "fer" ? " Une partie qui montre le Sablier, un mercenaire ou un renfort quitte ce classement." : ""}</span>`;
  }

  /* ---------- Serment de fer ---------- */
  function oathCards(pend) {
    const s = S(), cur = s.mono.serment || null, fer = E.monoFer(s), lvlOk = hero().lvl <= E.MONO.serment.lvlMax;
    const errFer = E.monoSwearErr(s, "fer");
    const btnOrd = pend ? `<button class="btn" data-act="mp-swear" data-v="ord">Choisir</button>` : cur && cur.t === "ord" ? `<span class="mp-o mp-mo">Ton serment</span>` : "";
    const btnFer = fer ? `<span class="mp-o mp-fer">Serment prêté</span><button class="btn ghost" data-act="mp-break">Renoncer au serment</button>` : errFer ? `<span class="xs muted">${h(errFer)}</span>` : `<button class="btn primary" data-act="mp-swear" data-v="fer">Prêter serment</button>`;
    return `<div class="mp-oaths">
      <div class="mp-card mp-oath ${cur && cur.t === "ord" ? "cur" : ""}"><span class="mp-k">Serment ordinaire</span><b>Le Monocompte tel qu'il est</b><ul><li>Sablier et mercenaire disponibles, renfort d'un ami aussi</li><li>Classements de saison habituels</li><li>Tu peux passer au Serment de fer tant que ton héros n'a pas dépassé le niveau ${E.MONO.serment.lvlMax}${lvlOk ? "" : " (c'est passé)"}</li></ul>${btnOrd}</div>
      <div class="mp-card mp-oath iron ${fer ? "cur" : ""}"><span class="mp-k">Serment de fer</span><b>Un seul héros, aucune aide</b><ul><li>Pas de Sablier, pas de mercenaire, pas de renfort</li><li>Classement « Serment de fer » à part</li><li>Aura de fer réservée, gardée dans l'Éternel</li><li>Tu peux y renoncer à tout moment : tu perds le classement et l'aura, rien d'autre</li></ul>${btnFer}</div></div>`;
  }
  function oathPage(main) {
    if (!season()) return leave();
    const s = S(), pend = E.monoOathPending(s), A = E.monoAide(s);
    main.innerHTML = `${head(pend ? "Début de la saison" : "Serment de fer", pend ? `Choisis ton serment pour la ${h(E.monoSeasonDef(s.mono.s || 1).nom)}` : "Monocompte")}
      ${oathCards(pend)}
      <div class="mp-card"><div class="mp-ct">Aides reçues cette saison</div><div class="mp-stats sm"><div><b>${A.sab ? dur(A.sab * 1000) : "0"}</b><span>accélérées au Sablier</span></div><div><b>${A.merc}</b><span>donjon${A.merc > 1 ? "s" : ""} avec mercenaire</span></div><div><b>${A.ren}</b><span>donjon${A.ren > 1 ? "s" : ""} avec renfort</span></div></div></div>
      <span class="xs muted">Le serveur vérifie le serment à chaque envoi de partie : une partie qui a utilisé le Sablier, le mercenaire ou un renfort quitte le classement de fer.</span>`;
  }

  /* ---------- Mutation de la semaine ---------- */
  function mutPage(main) {
    if (!season()) return leave();
    const s = S(), m = E.monoMutOf(s), w = E.monoMutWeek(s), DF = E.monoMutDefi(s), nx = E.monoMutNext(s, 2);
    const K = AM() && AM().couronne(); const until = K && K.change_at ? new Date(K.change_at).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) : "lundi 00 h 00";
    const pc = DF ? Math.min(100, Math.round((DF.n / DF.need) * 100)) : 0;
    main.innerHTML = `${head("Mutation de la semaine", `Donjons de stasis ${MU.from} et plus · Monocompte`)}
      ${m ? `<div class="mp-card mp-mut"><span class="mp-k">Semaine ${w} · jusqu'à ${h(until)}</span><b class="mp-big">${h(m.n)}</b><p>${h(m.d)}</p><div class="row" style="gap:6px;flex-wrap:wrap"><span class="mp-o mp-mo">Aucune puissance en plus</span><span class="mp-o mp-cl">Règle pour tous les joueurs</span><span class="mp-o mp-pa">Stasis ${MU.from} et plus</span></div></div>` : `<div class="mp-card"><span class="small muted">Pas de mutation en ce moment.</span></div>`}
      ${DF ? `<div class="mp-card"><div class="mp-ct">Défi de groupe de la semaine</div><div class="mp-lr"><div class="mp-fi"><b>${h(DF.m.c)}</b><span class="xs muted">${h(DF.m.cd)}</span><div class="mp-bar"><div style="width:${pc}%"></div></div>
        <span class="xs muted">${Math.min(DF.n, DF.need)} / ${DF.need} · ${DF.paid ? "réussi cette semaine" : `${DF.gain} Éclats du Temps, comptés dans le quota de la semaine`}</span></div></div></div>` : ""}
      <div class="mp-card"><div class="mp-ct">Les prochaines semaines</div>${nx.length ? nx.map((x) => `<div class="mp-lr sm"><b>Semaine ${x.w}</b><span class="xs muted">${h(x.m.n)} : ${h(x.m.d)}</span></div>`).join("") : `<span class="xs muted">C'est la dernière semaine de la saison.</span>`}</div>
      <span class="xs muted">Chaque règle a sa contrepartie : vérifié par simulation, elle ne déplace pas la stasis atteinte de plus d'une demi-stasis.${srvOn() ? "" : " Hors connexion, la semaine est celle de ta partie."}</span>`;
  }

  /* ---------- Bilan de saison ---------- */
  const BL = { srv: null, asked: 0 };
  const bilanOf = () => {
    const s = S(), ET = s.mono.eternel || {}; const B = Object.assign({}, ET.bilan || E.monoBilan(s));
    if (BL.srv) { if (BL.srv.rang_grp) B.rangGrp = +BL.srv.rang_grp; if (BL.srv.couronnes != null) B.couronnes = +BL.srv.couronnes; }
    return B;
  };
  async function bilanSrv() {
    if (BL.asked || !(ON && ON.enabled && ON.user && ON.rpc)) return; BL.asked = 1;
    const s = S(), sid = (s.mono.eternel && s.mono.eternel.s) || s.mono.s || 1;
    const r = await ON.rpc("mono_bilan", { p_saison: sid }); if (!r.err && r.data && r.data.saison != null) { BL.srv = r.data; if (UI().tab === "bilan" || UI().tab === "eternel") redraw(); }
  }
  const ord = (n) => (n === 1 ? "1er" : `${n}e`);
  function bilanHtml() {
    const s = S(), B = bilanOf(), c = hero();
    const tile = (v, l) => `<div><b>${h(String(v))}</b><span>${h(l)}</span></div>`;
    return `<div class="mp-bilan ${B.fer ? "fer" : ""}" id="mpBilan"><div class="mp-bl">${X().heroCard(c, "", { act: "noop" })}</div>
      <div class="mp-br"><span class="mp-k">${h(B.saison)}${B.theme ? ` · ${h(B.theme)}` : ""} · ${B.jours} jours</span><b class="mp-big">${h(B.nom)}, ${h(B.classe)}${B.fer ? " de fer" : ""}</b>
        <div class="mp-stats">${tile(B.lvl, "niveau")}${tile(B.dofus ? B.dofus.n : "–", B.dofus ? B.dofus.d : "Dofus de saison")}${tile(`${B.defis} / ${B.defisTot}`, "défis réussis")}${tile(B.rangGrp ? ord(B.rangGrp) : "–", "donjon de groupe")}${tile(B.couronnes != null ? B.couronnes : "–", "semaines couronné")}${tile(B.camp ? `${B.camp.nom}` : "–", B.camp ? `camp, rang ${B.camp.r}` : "sans camp")}${tile(B.groupe ? B.groupe.n : B.grp ? `${B.grp} donjons` : "Seul", B.groupe ? "groupe principal" : "en groupe")}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="mp-share">${X().G("share")} Partager sur Discord</button><button class="btn" data-act="mp-png">Enregistrer l'image</button><button class="btn ghost" data-act="mp-eternel">Aller à l'Éternel</button></div>
        <span class="xs muted">« Partager » copie le texte du bilan, à coller dans Discord. L'image est dessinée sur ton appareil.</span></div></div>`;
  }
  function bilanPage(main) {
    const s = S(); if (!mono() || !E.monoEternal(s)) return leave();
    bilanSrv();
    main.innerHTML = `${head(`Fin de la ${h(E.monoSeasonDef(s.mono.eternel.s).nom)}`, "Ton héros entre dans l'Éternel")}${bilanHtml()}`;
  }
  // première visite de l'Éternel : le bilan d'abord, une seule fois
  const et0 = window.DX.pages.eternel;
  if (et0) window.DX.pages.eternel = (main) => { const s = S(); if (s && s.mono && s.mono.eternel && !s.mono.eternel.bilanVu && E.monoEternal(s)) { UI().tab = "bilan"; bilanPage(main); return; } return et0(main); };

  /* image du bilan : dessinée sur l'appareil (canvas), rien n'est envoyé */
  async function bilanPng() {
    const B = bilanOf(); const W = 1200, H = 630; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, B.fer ? "#1f2a33" : "#1d2a22"); gr.addColorStop(1, "#120e0a"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = B.fer ? "#c6d6e2" : "#e4b955"; g.lineWidth = 6; g.strokeRect(14, 14, W - 28, H - 28);
    const img = document.querySelector("#mpBilan .mp-bl img"); if (img && img.complete && img.naturalWidth) { try { const r = Math.min(360 / img.naturalWidth, 520 / img.naturalHeight); g.drawImage(img, 60 + (360 - img.naturalWidth * r) / 2, 60 + (520 - img.naturalHeight * r) / 2, img.naturalWidth * r, img.naturalHeight * r); } catch (e) {} }
    const x0 = 460; g.fillStyle = "#e4b955"; g.font = "800 22px Nunito, sans-serif"; g.fillText(`${B.saison}${B.theme ? " · " + B.theme : ""} · Monocompte d'Idlus`.toUpperCase(), x0, 92);
    g.fillStyle = "#f5ead2"; g.font = "48px Kavoon, serif"; g.fillText(`${B.nom}, ${B.classe}${B.fer ? " de fer" : ""}`.slice(0, 34), x0, 156);
    const T = [[B.lvl, "niveau"], [B.dofus ? B.dofus.n : "–", "Dofus de saison"], [`${B.defis} / ${B.defisTot}`, "défis réussis"], [B.rangGrp ? ord(B.rangGrp) : "–", "donjon de groupe"], [B.couronnes != null ? B.couronnes : "–", "semaines couronné"], [B.camp ? B.camp.nom : "–", B.camp ? `camp, rang ${B.camp.r}` : "sans camp"]];
    T.forEach(([v, l], i) => { const x = x0 + (i % 3) * 235, y = 200 + Math.floor(i / 3) * 140; g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x, y, 220, 120); g.fillStyle = "#e4b955"; g.font = "900 36px Nunito, sans-serif"; g.fillText(String(v).slice(0, 12), x + 16, y + 58); g.fillStyle = "#c2b395"; g.font = "600 20px Nunito, sans-serif"; g.fillText(l, x + 16, y + 94); });
    g.fillStyle = "#c2b395"; g.font = "600 20px Nunito, sans-serif"; g.fillText(B.groupe ? `Groupe principal : ${B.groupe.n}`.slice(0, 60) : "idlus.github.io", x0, 520); g.fillText("idlus.github.io", x0, 560);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png")); if (!blob) { X().toast("Image impossible sur cet appareil."); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `idlus-bilan-saison-${B.s}.png`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- boîte du donjon (js/ui.js, monoDgBox) ---------- */
  const renfortOn = () => { const m = UI().mercCls; return typeof m === "string" && m.startsWith("ami:"); };
  function mutLine() {
    if (!season()) return ""; const m = E.monoMutOf(S()); if (!m) return "";
    return `<div class="smallbox mp-mutl">${X().IC("cristal")} <span><b>Mutation de la semaine, stasis ${MU.from} et plus : ${h(m.n)}</b>. ${h(m.d)}</span></div>`;
  }
  function pendLine() { return season() && E.monoOathPending(S()) ? `<div class="smallbox mp-oathl"><span><b>Début de saison :</b> choisis ton serment (ordinaire ou de fer) avant de dépasser le niveau ${E.MONO.serment.lvlMax}.</span><button class="btn sm" data-act="nav" data-v="serment">Choisir</button></div>` : ""; }
  function dgBox(fer) {
    if (fer) return `${mutLine()}<div class="mercbox mp-ferbox"><b>Serment de fer</b><span class="xs">Un seul héros, aucune aide : ni mercenaire, ni renfort d'un ami, ni Sablier.</span><button class="btn sm ghost" data-act="nav" data-v="serment">Voir le serment</button></div>`;
    const u = UI().mercCls.slice(4); const R = (AM() && AM().renforts().find((x) => x.u === u)) || null; const err = R ? R.err || E.monoRenfortErr(S(), { u: R.u, p: R.p, snap: R.snap }) : "Ce renfort n'est plus disponible.";
    return `${mutLine()}<div class="mercbox"><div class="row between" style="gap:8px;flex-wrap:wrap"><b>Renfort d'un ami</b><span class="xs muted">à la place du mercenaire · sans gain pour ton ami</span></div>
      ${R ? `<div class="mp-lr sm">${X().cmed(R.cls, R.lvl)}<div class="mp-fi"><b>${h(R.p)}</b><span class="xs muted">${h((D.CLASSES[R.cls] || {}).name || "")} niveau ${R.lvl}, copie de sa partie validée</span></div></div>` : ""}
      ${err ? `<span class="xs" style="color:var(--danger)">${h(err)}</span>` : `<span class="xs muted">Il prend ta part de demi-joueur, ne prend ni XP ni butin, et repart à la fin du donjon. Ton ami ne gagne rien, seulement un compteur.</span>`}
      <div><button class="btn sm ghost" data-act="mercpick" data-v="">Revenir au mercenaire</button></div></div>`;
  }
  function renfortPick() {
    if (!season() || E.monoFer(S())) return pendLine();
    const L = AM() ? AM().renforts() : []; if (!srvOn()) return pendLine();
    return `${pendLine()}<div class="mercbox"><div class="row between" style="gap:8px;flex-wrap:wrap"><b>Renfort d'un ami</b><span class="xs muted">la copie de son héros à la place du mercenaire, l'un ou l'autre</span></div>
      ${L.length ? `<div class="mp-renf">${L.map((R) => { const e = R.err || E.monoRenfortErr(S(), { u: R.u, p: R.p, snap: R.snap }); return `<button data-act="mercpick" data-v="ami:${h(R.u)}" ${e ? `disabled data-tip="${h(e)}"` : ""}>${X().cmed(R.cls, R.lvl)}<span>${h(R.p)}</span></button>`; }).join("")}</div>` : `<span class="xs muted">Aucun ami n'a encore publié son héros. Ajoute des amis dans Communauté › Amis.</span>`}</div>`;
  }

  /* ---------- clics ---------- */
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t || !/^mp-/.test(t.dataset.act) || !S()) return; const a = t.dataset.act;
    if (a === "mp-lbt") { LB.type = t.dataset.v; redraw(); return; }
    if (a === "mp-swear") { if (t.dataset.v === "fer" && !confirm("Prêter le Serment de fer ? Plus de Sablier, de mercenaire ni de renfort pendant la saison.")) return; const r = E.monoSwear(S(), t.dataset.v); if (r) { X().toast(r); return; } X().toast(t.dataset.v === "fer" ? "Serment de fer prêté." : "Serment ordinaire choisi."); X().markDirty(); X().render(); return; }
    if (a === "mp-break") { if (!confirm("Renoncer au Serment de fer ? Tu quittes son classement et son aura, et il ne se reprête pas cette saison.")) return; const r = E.monoOathBreak(S()); if (r) X().toast(r); X().markDirty(); X().render(); return; }
    if (a === "mp-share") { const txt = E.monoBilanText(bilanOf()); try { await navigator.clipboard.writeText(txt); X().toast("Bilan copié : colle-le dans Discord."); } catch (e) { X().openSheet(`<h2>Partager sur Discord</h2><p class="small muted">Copie ce texte et colle-le dans Discord.</p><textarea readonly rows="8" style="width:100%">${h(txt)}</textarea><div><button class="btn" data-act="closesheet">Fermer</button></div>`); } return; }
    if (a === "mp-png") { bilanPng(); return; }
    if (a === "mp-eternel") { const s = S(); if (s.mono.eternel) s.mono.eternel.bilanVu = 1; X().markDirty(); UI().tab = "eternel"; X().render(); window.scrollTo(0, 0); return; }
  });

  window.DX.pages.saisonlb = lbPage;
  window.DX.pages.serment = oathPage;
  window.DX.pages.mutation = mutPage;
  window.DX.pages.bilan = bilanPage;
  // la partie a pu démarrer avant ce fichier (monoNav de js/ui.js) : le menu est complété ici
  try { const s = S(); const F = (window.DX.NAV || []).find((x) => x.id === "df"); if (s && mono() && F) { nav(F, window.DX.NAV_DESC || {}, E.monoEternal(s)); if (window.DX.nav) window.DX.nav(); } } catch (e) {}
  window.MONOPLUSUI = { nav, dgBox, mutLine, renfortPick, renfortOn, bilanText: () => E.monoBilanText(bilanOf()) };
})();
