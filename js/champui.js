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

  // une icône et une couleur par pouvoir, reprises partout (Sceaux, trophées, bandeau)
  const ICO = {
    enrage: ["#ff8a4c", "M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .2 2 1 3 2 3.5C11 8 11 5 12 2z"],
    blinde: ["#8fc1ff", "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"],
    vampire: ["#ff6b85", "M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"],
    veloce: ["#ffe066", "M13 2L4 14h6l-1 8 9-12h-6z"],
    meneur: ["#c49bff", "M5 2h2v20H5zM8 3h11l-2.5 4L19 11H8z"],
    traqueur: ["#8be06e", "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zm0 4a6 6 0 1 1 0 12a6 6 0 1 1 0-12zm0 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6z"],
  };
  const ico = (k, cls = "") => { const i = ICO[k]; return i ? `<svg class="ch-pw ${cls}" viewBox="0 0 24 24" style="--pw:${i[0]}" aria-hidden="true"><path fill-rule="evenodd" d="${i[1]}"/></svg>` : crown; };
  const icoSeal = (key) => key.split("+").map((k) => ico(k)).join("");

  /* ---------- page du héros ---------- */
  function heroPanel(S, c) {
    const e = E(); if (!e.SEALS || !c) return "";
    const C = e.champState(S); const cur = e.sealOf(S, c);
    const any = e.SEAL_ORDER.some((k) => e.sealKills(S, k) > 0);
    if (!any) return `<div class="panel ch-panel"><div class="pad row ch-empty"><div class="ch-ic">${crown}</div><div><b class="ch-gold">Sceau de champion</b><div class="xs muted">Un combat de chasse sur ${Math.round(1 / e.CHAMP_CHANCE)}, un monstre devient Champion. Le vaincre débloque le Sceau de son pouvoir, que ton héros pourra porter.</div></div></div></div>`;
    const wornBy = (key) => S.chars.filter((x) => x.seal === key && x.id !== c.id).map((x) => x.name);
    // Éclats et Conclave : deux pastilles dans l'en-tête plutôt que deux encadrés
    const team = e.team(S); const kinds = new Set(team.flatMap((x) => (x.seal ? x.seal.split("+") : [])));
    const worn = team.filter((x) => e.sealOf(S, x)).length; const reso = worn >= 4 && kinds.size >= 4;
    const chips = `<div class="ch-chips">${C.sh > 0 ? `<span class="ch-chip gold" data-tip="Éclats de champion, gagnés contre les Champions légendaires. Un Éclat compte comme un Champion vaincu, pour le Sceau de ton choix (bouton +1 sur un Sceau).">◆ ${C.sh} Éclat${C.sh > 1 ? "s" : ""}</span>` : ""}<span class="ch-chip ${reso ? "on" : ""}" data-tip="Conclave des Champions : au moins 4 héros de l'équipe portent un Sceau, avec 4 pouvoirs différents en tout. Bonus : +${e.SEAL_RESO} % de dégâts et de PV pour toute l'équipe.">Conclave ${Math.min(kinds.size, 4)}/4${reso ? ` · +${e.SEAL_RESO} %` : ""}</span></div>`;
    const head = cur ? `<div class="ch-eq"><div class="ch-ic">${icoSeal(cur.key)}</div><div class="ch-eqb"><div class="ch-eqn">${h(e.sealName(cur.key))}</div><div class="ch-eqs">${cur.key.includes("+") ? `Fusion ${cur.list.map((x) => e.SEALS[x.k].name).join(" + ")} · pouvoirs à 70 %` : `Rang ${cur.list[0].r} / 5`}</div><ul>${cur.list.map((x) => `<li>${h(e.SEALS[x.k].txt(x.v))}</li>`).join("")}</ul>${cur.cri ? `<span class="ch-cri" data-tip="Une fois par combat, quand ${h(c.name)} passe sous 30 % de PV : ses pouvoirs de Sceau sont doublés pendant 2 tours.">Cri du Champion prêt</span>` : ""}</div><button class="btn sm ch-ghost" data-act="chp-wear" data-id="${c.id}" data-v="">Retirer</button></div>`
      : `<div class="ch-eq off"><div class="ch-ic">${crown}</div><div class="ch-eqb"><div class="ch-eqn">Aucun Sceau porté</div><div class="ch-eqs">Choisis un Sceau ci-dessous pour ${h(c.name)}.</div></div></div>`;
    const tiles = e.SEAL_ORDER.map((k) => {
      const n = e.sealKills(S, k), r = e.sealRank(S, k), nx = nextAt(n), on = c.seal === k, w = wornBy(k);
      const act = on ? `<span class="ch-tag">Porté</span>` : r ? `<button class="btn sm" data-act="chp-wear" data-id="${c.id}" data-v="${k}">Porter</button>` : "";
      const shard = C.sh > 0 && nx ? `<button class="btn sm ch-ghost" data-act="chp-shard" data-v="${k}" data-tip="Utiliser un Éclat : compte comme un Champion ${e.SEALS[k].name} vaincu">+1 ◆</button>` : "";
      return `<div class="ch-st ${on ? "on" : ""} ${r ? "" : "off"}"><div class="ch-sth">${ico(k)}<b>${e.SEALS[k].name}</b>${pips(r)}</div>
        <span class="ch-std">${r ? h(e.SEALS[k].txt(e.sealVal(k, r))) : `Vaincs un Champion ${e.SEALS[k].name} pour le débloquer.`}</span>
        <div class="ch-bar"><i style="width:${barPct(n, r)}%"></i></div>
        <div class="ch-stf"><span class="ch-cnt">${nx ? `${X().fmt(n)} / ${nx}` : `${X().fmt(n)} · max`}${w.length ? `<small>Aussi : ${h(w.join(", "))}</small>` : ""}</span><span class="ch-btns">${shard}${act}</span></div></div>`;
    }).join("");
    const ready = e.SEAL_ORDER.filter((k) => e.sealRank(S, k) >= 5);
    const pairs = []; for (let i = 0; i < ready.length; i++) for (let j = i + 1; j < ready.length; j++) pairs.push(e.fuseKey(ready[i], ready[j]));
    const toFuse = pairs.filter((p) => !C.f.includes(p));
    const fz = C.f.map((f) => `<div class="ch-fc ok ${c.seal === f ? "on" : ""}"><span class="ch-fi">${icoSeal(f)}</span><span class="ch-fn"><b>${h(e.SEAL_FUSIONS[f])}</b><small>${f.split("+").map((k) => e.SEALS[k].name).join(" + ")}</small></span>${c.seal === f ? `<span class="ch-tag">Porté</span>` : `<button class="btn sm" data-act="chp-wear" data-id="${c.id}" data-v="${f}">Porter</button>`}</div>`)
      .concat(toFuse.map((f) => `<div class="ch-fc"><span class="ch-fi">${icoSeal(f)}</span><span class="ch-fn"><b>???</b><small>${f.split("+").map((k) => e.SEALS[k].name).join(" + ")}</small></span><button class="btn sm gold" data-act="chp-fuse" data-v="${f}">Fusionner</button></div>`)).join("");
    const fusions = `<div class="ch-sec"><div class="ch-sech"><b>Fusions</b><span class="xs muted">${C.f.length} / 15 découvertes</span></div>
      ${fz ? `<div class="ch-fz">${fz}</div>` : ""}<div class="xs muted">${ready.length < 2 ? "Deux Sceaux au rang 5 se fusionnent en un Sceau double au nom unique (les deux pouvoirs à 70 %)." : toFuse.length ? "Deux Sceaux au rang 5 donnent un Sceau double au nom unique, qui garde les deux pouvoirs à 70 %." : "Toutes les fusions possibles avec tes Sceaux sont découvertes."}</div></div>`;
    return `<div class="panel ch-panel"><div class="phead"><h2>${crown} Sceau de champion</h2>${chips}</div><div class="pad">${head}
      <div class="ch-seals">${tiles}</div>${fusions}
      <p class="ch-foot xs muted">Un Sceau par héros. Chaque Champion vaincu fait monter le Sceau de son pouvoir (rangs à 1, 5, 15, 40 et 100). Le premier rang 5 donne un titre. Les Sceaux sont gardés à la Renaissance.</p></div></div>`;
  }

  /* ---------- combat : bandeau et panneau de la sous-zone ---------- */
  function banner(S, F) {
    const e = E(); if (!F || F.over || !e.CHAMP_POWERS) return "";
    const m = F.ents.find((x) => x.side === "m" && x.champ && x.alive); if (!m) return "";
    const P = e.CHAMP_POWERS[m.champ];
    if (m.champLeg) return `<div class="ch-ban leg"><span class="ch-bi">${crown}</span><div><b>${h(m.name)}</b><small>Champion légendaire, tous les pouvoirs · PV ×${e.CHAMP_LEG_HP}, dégâts ×${e.CHAMP_LEG_DMG} · récompense : titre et ${e.CHAMP_LEG_SHARDS} Éclats</small></div></div>`;
    const tail = e.SEALS && e.SEALS[m.champ] ? `fait monter ton Sceau ${e.SEALS[m.champ].name}` : "butin doublé";
    return `<div class="ch-ban"><span class="ch-bi">${ico(m.champ)}</span><div><b>Champion ${h(P.name)} : ${h(m.name)}</b><small>${h(P.desc.replace(/\.$/, ""))} · PV ×2, dégâts +20 % · ${tail}</small></div></div>`;
  }
  function huntPanel(S) {
    const e = E(); if (!e.SEALS || !S.hunting || S.dungeon || !S.sub || !e.SUBS[S.sub] || (e.expActive && e.expActive(S))) return "";
    const C = e.champState(S); const sid = S.sub; const sub = e.SUBS[sid];
    const z = C.z[sid] || {}; const got = e.SEAL_ORDER.filter((k) => z[k]).length; const done = got === 6;
    const T = e.CHAMP_TRAILS; const t = Math.min(T, C.t[sid] || 0); const legN = C.l[sid] || 0;
    const near = e.SEAL_ORDER.map((k) => [k, e.sealKills(S, k)]).map(([k, n]) => [k, n, nextAt(n)]).filter((x) => x[2]).sort((a, b) => b[1] / b[2] - a[1] / a[2])[0];
    const legTip = `Le Champion légendaire a tous les pouvoirs, PV ×${e.CHAMP_LEG_HP} et dégâts ×${e.CHAMP_LEG_DMG}. Le vaincre : titre « Traqueur de ${sub.name} » et ${e.CHAMP_LEG_SHARDS} Éclats de champion. Si l'équipe perd, les pistes restent.`;
    const legBtn = e.champLegHere(S) ? `<div class="ch-legst">Légendaire en combat</div>` : C.pend === sid ? `<div class="ch-legst">Arrive au prochain combat</div>`
      : `<button class="btn sm ch-legb ${t >= T ? "gold" : ""}" data-act="chp-leg" ${t >= T ? "" : "disabled"} data-tip="${h(legTip)}">${crown} Appeler le légendaire</button>`;
    return `<div class="panel ch-panel ch-hunt"><div class="phead"><h2>${crown} Champions</h2><span class="small muted">${X().fmt(S.champs || 0)} vaincus</span></div><div class="pad">
      <div class="ch-sech"><b>Trophées de la zone</b><span class="ch-chip ${done ? "on" : ""}" data-tip="Vaincre un Champion de chaque pouvoir dans ${h(sub.name)} : +${e.CHAMP_ZONE_BONUS} % d'XP, de kamas et de butin dans cette zone.">${done ? `+${e.CHAMP_ZONE_BONUS} % actif` : `${got} / 6 · +${e.CHAMP_ZONE_BONUS} %`}</span></div>
      <div class="ch-tro">${e.SEAL_ORDER.map((k) => `<span class="${z[k] ? "ok" : "no"}" data-tip="${e.SEALS[k].name} : ${z[k] ? "vaincu dans cette zone" : "pas encore vaincu ici"}">${ico(k)}${e.SEALS[k].name}</span>`).join("")}</div>
      <div class="ch-sech"><b>Traque</b><span class="xs muted">${t} / ${T} pistes${legN ? ` · vaincu ${legN}×` : ""}</span></div>
      <div class="ch-trail">${Array.from({ length: T }, (_, i) => `<i class="${i < t ? "on" : ""}"></i>`).join("")}</div>
      ${legBtn}
      <div class="xs muted ch-hint">${t >= T ? `Titre « Traqueur de ${h(sub.name)} » et ${e.CHAMP_LEG_SHARDS} Éclats à la clé.` : "Chaque Champion vaincu ici laisse une piste."}</div>
      <div class="ch-stats"><div><span class="xs muted">Chance</span><b>1 combat sur ${Math.round(1 / e.CHAMP_CHANCE)}</b></div>${near ? `<div><span class="xs muted">Sceau le plus proche</span><b>${ico(near[0])} ${e.SEALS[near[0]].name} ${near[1]}/${near[2]}</b></div>` : ""}</div></div></div>`;
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
