/* ============================================================================
   LA REFONTE DU CHAMPION — affichage (moteur : js/champions.js)
   - page du héros (onglet Équipement) : panneau « Sceau de champion » (Sceaux, Éclats, fusions, Cri, Conclave, titre)
   - combat de chasse : bandeau doré quand un Champion est là (4A) et panneau « Champions » de la sous-zone
     (trophées, traque, chance, Sceau le plus proche)
   HTML déterministe (pas d'heure ni de hasard) : ui.js le pose dans la page et le met à jour en combat.
   Actions « chp-… » relayées par ui.js.
   ========================================================================== */
(function () {
  "use strict";
  const X = () => window.DX.social;
  const E = () => window.DX.E;
  const h = (s) => X().h(s);
  const crown = '<svg class="ch-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z"/><rect x="3" y="18.6" width="18" height="2.4" rx="1"/></svg>';
  const pips = (r) => `<span class="ch-pips" aria-label="rang ${r} sur 5">${"●".repeat(r)}${"○".repeat(5 - r)}</span>`;
  const nextAt = (n) => E().SEAL_RANKS.find((x) => x > n);
  const barPct = (n, r) => { const nx = nextAt(n); if (!nx) return 100; const prev = [0, ...E().SEAL_RANKS][r]; return Math.round((n - prev) / (nx - prev) * 100); };

  /* ---------- page du héros ---------- */
  function heroPanel(S, c) {
    const e = E(); if (!e.SEALS || !c) return "";
    const C = e.champState(S); const cur = e.sealOf(S, c);
    const any = e.SEAL_ORDER.some((k) => e.sealKills(S, k) > 0);
    if (!any) return `<div class="panel ch-panel"><div class="pad row ch-empty">${crown}<div><b>Sceau de champion</b><div class="xs muted">Un combat de chasse sur 50, un monstre devient Champion. Le vaincre débloque le Sceau de son pouvoir, que ton héros pourra porter.</div></div></div></div>`;
    const wornBy = (key) => S.chars.filter((x) => x.seal === key && x.id !== c.id).map((x) => x.name);
    const head = cur ? `<div class="ch-eq"><div class="ch-ic">${crown}</div><div class="grow"><div class="ch-eqn">Sceau ${h(e.sealName(cur.key))}${cur.key.includes("+") ? ` <span class="xs muted">(${cur.list.map((x) => e.SEALS[x.k].name).join(" + ")})</span>` : ` · rang ${cur.list[0].r}/5`}</div>${cur.list.map((x) => `<div class="small">${h(e.SEALS[x.k].txt(x.v))}</div>`).join("")}${cur.cri ? `<div class="xs ch-gold">Cri du Champion prêt : sous 30 % de PV, pouvoirs doublés pendant 2 tours.</div>` : ""}</div><button class="btn sm" data-act="chp-wear" data-id="${c.id}" data-v="">Retirer</button></div>`
      : `<div class="ch-eq off"><div class="ch-ic">${crown}</div><div class="grow"><div class="ch-eqn">Aucun Sceau porté</div><div class="xs muted">Choisis un Sceau ci-dessous pour ${h(c.name)}.</div></div></div>`;
    const tiles = e.SEAL_ORDER.map((k) => {
      const n = e.sealKills(S, k), r = e.sealRank(S, k), nx = nextAt(n), on = c.seal === k, w = wornBy(k);
      return `<div class="ch-st ${on ? "on" : ""} ${r ? "" : "off"}"><b>${e.SEALS[k].name}</b>${pips(r)}<span class="xs">${r ? h(e.SEALS[k].txt(e.sealVal(k, r))) : `Vaincre un Champion ${e.SEALS[k].name}`}</span>
        <div class="ch-bar"><i style="width:${barPct(n, r)}%"></i></div><span class="xs muted">${X().fmt(n)} vaincu${n > 1 ? "s" : ""}${nx ? ` · rang suivant à ${nx}` : " · rang max"}</span>
        <div class="row ch-btns">${on ? `<span class="pill gold xs">Porté</span>` : r ? `<button class="btn sm" data-act="chp-wear" data-id="${c.id}" data-v="${k}">Porter</button>` : ""}${C.sh > 0 && nx ? `<button class="btn sm" data-act="chp-shard" data-v="${k}" data-tip="Un Éclat de champion compte comme un Champion ${e.SEALS[k].name} vaincu">+1 Éclat</button>` : ""}</div>${w.length ? `<span class="xs muted">Aussi porté par ${h(w.join(", "))}</span>` : ""}</div>`;
    }).join("");
    const ready = e.SEAL_ORDER.filter((k) => e.sealRank(S, k) >= 5);
    const pairs = []; for (let i = 0; i < ready.length; i++) for (let j = i + 1; j < ready.length; j++) pairs.push(e.fuseKey(ready[i], ready[j]));
    const toFuse = pairs.filter((p) => !C.f.includes(p));
    const fusions = `<div class="ch-new"><div class="ch-nh"><b>Fusion de Sceaux</b><span class="xs muted">${C.f.length} / 15 découvertes</span></div>
      <div class="xs">Deux Sceaux au rang 5 se fusionnent en un Sceau double au nom unique, qui garde les deux pouvoirs à 70 %.</div>
      ${C.f.length ? `<div class="ch-fz">${C.f.map((f) => `<span class="ok ${c.seal === f ? "on" : ""}">${h(e.SEAL_FUSIONS[f])}<small>${f.split("+").map((k) => e.SEALS[k].name).join(" + ")}</small>${c.seal === f ? `<em>Porté</em>` : `<button class="btn sm" data-act="chp-wear" data-id="${c.id}" data-v="${f}">Porter</button>`}</span>`).join("")}</div>` : ""}
      ${toFuse.length ? `<div class="ch-fz">${toFuse.map((f) => `<span>???<small>${f.split("+").map((k) => e.SEALS[k].name).join(" + ")}</small><button class="btn sm gold" data-act="chp-fuse" data-v="${f}">Fusionner</button></span>`).join("")}</div>` : `<div class="xs muted">${ready.length < 2 ? `Monte deux Sceaux au rang 5 (100 Champions chacun) pour ta première fusion.` : "Toutes les fusions possibles avec tes Sceaux sont découvertes."}</div>`}</div>`;
    const team = E().team(S); const kinds = new Set(team.flatMap((x) => (x.seal ? x.seal.split("+") : [])));
    const worn = team.filter((x) => e.sealOf(S, x)).length;
    const conclave = `<div class="ch-new"><div class="ch-nh"><b>Conclave des Champions</b><span class="tag ${worn >= 4 && kinds.size >= 4 ? "good" : "soft"}">${Math.min(kinds.size, 4)} / 4 pouvoirs</span></div><div class="xs">Quand au moins 4 héros de l'équipe portent un Sceau, avec 4 pouvoirs différents en tout : +${e.SEAL_RESO} % de dégâts et de PV pour toute l'équipe.</div></div>`;
    const shards = C.sh > 0 ? `<div class="ch-new"><div class="ch-nh"><b>Éclats de champion ×${C.sh}</b></div><div class="xs">Gagnés contre les Champions légendaires. Un Éclat compte comme un Champion vaincu, pour le Sceau de ton choix (bouton « +1 Éclat »).</div></div>` : "";
    return `<div class="panel ch-panel"><div class="phead"><h2>${crown} Sceau de champion</h2><span class="small muted">un Sceau par héros</span></div><div class="pad">${head}
      <div class="ch-seals">${tiles}</div>${shards}${fusions}${conclave}
      <p class="note xs">Chaque Champion vaincu fait monter le Sceau de son pouvoir (rangs à 1, 5, 15, 40 et 100). Le premier Sceau au rang 5 donne un titre. Les Sceaux sont gardés à la Renaissance.</p></div></div>`;
  }

  /* ---------- combat : bandeau et panneau de la sous-zone ---------- */
  function banner(S, F) {
    const e = E(); if (!F || F.over || !e.CHAMP_POWERS) return "";
    const m = F.ents.find((x) => x.side === "m" && x.champ && x.alive); if (!m) return "";
    const P = e.CHAMP_POWERS[m.champ];
    if (m.champLeg) return `<div class="ch-ban leg">${crown}<div>Le Champion légendaire est là : ${h(m.name)} !<small>Tous les pouvoirs : bouclier, vol de vie, joue en premier, rage, aura de Meneur · PV ×${e.CHAMP_LEG_HP}, dégâts ×${e.CHAMP_LEG_DMG} · le vaincre : titre et ${e.CHAMP_LEG_SHARDS} Éclats de champion</small></div></div>`;
    const tail = e.SEALS && e.SEALS[m.champ] ? `le vaincre fait progresser ton Sceau ${e.SEALS[m.champ].name}` : "butin doublé";
    return `<div class="ch-ban">${crown}<div>Un Champion apparaît : ${h(m.name)} (${h(P.name)}) !<small>PV ×2, dégâts +20 % · ${h(P.desc.replace(/\.$/, ""))} · ${tail}</small></div></div>`;
  }
  function huntPanel(S) {
    const e = E(); if (!e.SEALS || !S.hunting || S.dungeon || !S.sub || !e.SUBS[S.sub] || (e.expActive && e.expActive(S))) return "";
    const C = e.champState(S); const sid = S.sub; const sub = e.SUBS[sid];
    const z = C.z[sid] || {}; const got = e.SEAL_ORDER.filter((k) => z[k]).length; const done = got === 6;
    const t = Math.min(e.CHAMP_TRAILS, C.t[sid] || 0); const legN = C.l[sid] || 0;
    const near = e.SEAL_ORDER.map((k) => [k, e.sealKills(S, k)]).map(([k, n]) => [k, n, nextAt(n)]).filter((x) => x[2]).sort((a, b) => b[1] / b[2] - a[1] / a[2])[0];
    const per = Math.round(e.CHAMP_CHANCE * 100 * 2) / 2;
    const legBtn = e.champLegHere(S) ? `<span class="pill gold xs">Légendaire en combat</span>` : C.pend === sid ? `<span class="pill gold xs">Au prochain combat</span>` : `<button class="btn sm ${t >= e.CHAMP_TRAILS ? "gold" : ""}" data-act="chp-leg" ${t >= e.CHAMP_TRAILS ? "" : "disabled"}>Appeler le légendaire${t >= e.CHAMP_TRAILS ? "" : ` (${t}/${e.CHAMP_TRAILS})`}</button>`;
    return `<div class="panel ch-panel ch-hunt"><div class="phead"><h2>${crown} Champions · ${h(sub.name)}</h2><span class="small muted">${X().fmt(S.champs || 0)} vaincus</span></div><div class="pad">
      <div class="ch-row"><span><b>Trophées de la zone</b> ${got} / 6 : ${done ? `<span class="ch-gold">+${e.CHAMP_ZONE_BONUS} % d'XP, de kamas et de butin ici</span>` : `les 6 pouvoirs vaincus ici donnent +${e.CHAMP_ZONE_BONUS} % d'XP, de kamas et de butin dans la zone`}</span></div>
      <div class="ch-tro">${e.SEAL_ORDER.map((k) => `<span class="${z[k] ? "" : "no"}">${z[k] ? "✓ " : ""}${e.SEALS[k].name}</span>`).join("")}</div>
      <div class="ch-row"><span><b>Traque</b> ${t} / ${e.CHAMP_TRAILS} pistes : chaque Champion vaincu ici laisse une piste${legN ? ` · légendaire vaincu ${legN} fois` : ""}</span>${legBtn}</div>
      <div class="ch-bar big"><i style="width:${Math.round(t / e.CHAMP_TRAILS * 100)}%"></i></div>
      <div class="ch-row"><span class="xs muted">Le légendaire (tous les pouvoirs, PV ×${e.CHAMP_LEG_HP}, dégâts ×${e.CHAMP_LEG_DMG}) donne le titre « Traqueur de ${h(sub.name)} » et ${e.CHAMP_LEG_SHARDS} Éclats de champion.</span></div>
      <div class="ch-row"><span>${crown} Chance de Champion : <b>1 combat sur ${Math.round(1 / e.CHAMP_CHANCE)}</b></span><span class="xs muted">${per} %</span></div>
      ${near ? `<div class="ch-row"><span>Sceau le plus proche : <b>${e.SEALS[near[0]].name}</b> ${near[1]} / ${near[2]}</span>${pips(e.sealRank(S, near[0]))}</div>` : ""}</div></div>`;
  }

  function act(a, t) {
    const S = window.DX.S; const e = E(); const d = t.dataset; let r = null;
    if (a === "chp-wear") { r = e.act(S, "sealWear", +d.id, d.v || null); if (!r) X().toast(d.v ? `Sceau ${e.sealName(d.v)} porté.` : "Sceau retiré."); }
    else if (a === "chp-fuse") { const [x, y] = d.v.split("+"); r = e.act(S, "sealFuse", x, y); if (!r) X().toast(`Fusion découverte : Sceau ${e.SEAL_FUSIONS[d.v]} !`); }
    else if (a === "chp-shard") { r = e.act(S, "sealShard", d.v); if (!r) X().toast(`Éclat utilisé : Sceau ${e.SEALS[d.v].name}.`); }
    else if (a === "chp-leg") { r = e.act(S, "champLegGo"); if (!r) X().toast("Le Champion légendaire arrive au prochain combat !"); }
    if (r) { X().toast(r); return; }
    X().markDirty(); X().render();
  }

  window.CHAMPUI = { heroPanel, banner, huntPanel, act };
})();
