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
    return `<div class="panel ch-panel ch-hunt"><div class="phead"><h2>${crown} Champions</h2><button class="btn sm ch-ghost" data-act="chp-page">Tout voir</button></div><div class="pad">
      <div class="ch-sech"><b>Trophées de la zone</b><span class="ch-chip ${done ? "on" : ""}" data-tip="Vaincre un Champion de chaque pouvoir dans ${h(sub.name)} : +${e.CHAMP_ZONE_BONUS} % d'XP, de kamas et de butin dans cette zone.">${done ? `+${e.CHAMP_ZONE_BONUS} % actif` : `${got} / 6 · +${e.CHAMP_ZONE_BONUS} %`}</span></div>
      <div class="ch-tro">${e.SEAL_ORDER.map((k) => `<span class="${z[k] ? "ok" : "no"}" data-tip="${e.SEALS[k].name} : ${z[k] ? "vaincu dans cette zone" : "pas encore vaincu ici"}">${ico(k)}${e.SEALS[k].name}</span>`).join("")}</div>
      <div class="ch-sech"><b>Traque</b><span class="xs muted">${t} / ${T} pistes${legN ? ` · vaincu ${legN}×` : ""}</span></div>
      <div class="ch-trail">${Array.from({ length: T }, (_, i) => `<i class="${i < t ? "on" : ""}"></i>`).join("")}</div>
      ${legBtn}
      <div class="xs muted ch-hint">${t >= T ? `Titre « Traqueur de ${h(sub.name)} » et ${e.CHAMP_LEG_SHARDS} Éclats à la clé.` : "Chaque Champion vaincu ici laisse une piste."}</div>
      <div class="ch-stats"><div><span class="xs muted">Chance</span><b>1 combat sur ${Math.round(1 / e.CHAMP_CHANCE)}</b></div>${near ? `<div><span class="xs muted">Sceau le plus proche</span><b>${ico(near[0])} ${e.SEALS[near[0]].name} ${near[1]}/${near[2]}</b></div>` : ""}</div></div></div>`;
  }

  /* ---------- page du héros : une ligne compacte, la gestion complète est dans le menu Chasse ---------- */
  function heroLine(S, c) {
    const e = E(); if (!e.SEALS || !c) return "";
    const cur = e.sealOf(S, c); const any = e.SEAL_ORDER.some((k) => e.sealKills(S, k) > 0);
    const txt = cur ? `<b class="ch-gold">${h(e.sealName(cur.key))}</b><small>${cur.list.map((x) => h(e.SEALS[x.k].txt(x.v))).join(" · ")}</small>`
      : any ? `<b>Aucun Sceau porté</b><small>Choisis-en un dans le menu Chasse.</small>` : `<b>Sceau de champion</b><small>Vaincs un Champion en chasse pour débloquer ton premier Sceau.</small>`;
    return `<div class="panel ch-panel ch-line"><div class="ch-ic">${cur ? icoSeal(cur.key) : crown}</div><div class="ch-lt">${txt}</div>${cur && cur.cri ? `<span class="ch-cri" data-tip="Une fois par combat sous 30 % de PV : pouvoirs doublés pendant 2 tours.">Cri prêt</span>` : ""}<button class="btn sm" data-act="chp-page">${cur ? "Changer" : "Menu Chasse"}</button></div>`;
  }

  /* ---------- menu Chasse : Champions, Sceaux de l'équipe, fusions, trophées et traque de toutes les zones ---------- */
  const st = { f: "cours" };
  const D = () => window.DATA;
  function zoneRows(S) {
    const e = E(); const C = e.champState(S);
    const rows = [];
    D().ZONES.forEach((Z, zi) => Z.subs.forEach((sb, si) => {
      const sub = e.SUBS[sb.id]; if (!sub || sub.hidden || !e.subUnlocked(S, sb.id)) return;
      const z = C.z[sb.id] || {}; const got = e.SEAL_ORDER.filter((k) => z[k]).length; const t = Math.min(e.CHAMP_TRAILS, C.t[sb.id] || 0);
      rows.push({ id: sb.id, sub, zone: Z.name, ord: zi * 100 + si, got, t, leg: C.l[sb.id] || 0 });
    }));
    return rows;
  }
  function zoneCard(S, r) {
    const e = E(); const C = e.champState(S); const z = C.z[r.id] || {}; const T = e.CHAMP_TRAILS; const here = S.hunting && !S.dungeon && S.sub === r.id;
    const go = here ? (r.t >= T && C.pend !== r.id && !e.champLegHere(S) ? `<button class="btn sm gold" data-act="chp-leg">${crown} Légendaire</button>` : `<span class="ch-tag soft">Tu y es</span>`)
      : `<button class="btn sm primary" data-act="hunt" data-id="${r.id}" ${S.dungeon ? "disabled" : ""}>Y aller</button>`;
    return `<div class="ch-zc ${r.got === 6 ? "done" : ""} ${here ? "here" : ""}"><span class="ch-zn"><b>${h(r.sub.name)}${r.got === 6 ? ` <span class="ch-chip on">+${e.CHAMP_ZONE_BONUS} %</span>` : ""}</b><small>${h(r.zone)} · niv. ${r.sub.lvl[0]}-${r.sub.lvl[1]}${r.leg ? ` · ${crown}×${r.leg}` : ""}</small></span>
      <span class="ch-zi">${e.SEAL_ORDER.map((k) => `<span class="${z[k] ? "ok" : "no"}" data-tip="${e.SEALS[k].name} : ${z[k] ? "vaincu ici" : "pas encore vaincu ici"}">${ico(k)}</span>`).join("")}<span class="ch-zt" data-tip="Traque : ${r.t} / ${T} pistes${r.leg ? ` · légendaire vaincu ${r.leg} fois` : ""}">${Array.from({ length: T }, (_, i) => `<i class="${i < r.t ? "on" : ""}"></i>`).join("")}</span></span>
      <span class="ch-zg2">${go}</span></div>`;
  }
  function page(main) {
    const S = window.DX.S; const e = E(); if (!e.SEALS) return;
    const C = e.champState(S); const team = e.team(S);
    const rows = zoneRows(S); const done = rows.filter((r) => r.got === 6).length; const legs = Object.values(C.l).reduce((a, b) => a + b, 0);
    const kinds = new Set(team.flatMap((x) => (x.seal ? x.seal.split("+") : []))); const worn = team.filter((x) => e.sealOf(S, x)).length; const reso = worn >= 4 && kinds.size >= 4;
    const tile = (n, l, ic) => `<div class="ch-kpi">${ic}<span><b>${n}</b><small>${l}</small></span></div>`;
    const kpis = `<div class="ch-kpis">${tile(X().fmt(S.champs || 0), "Champions vaincus", crown)}${tile(legs, "légendaires vaincus", ico("meneur"))}${tile(`${done} / ${rows.length}`, "zones complètes", ico("traqueur"))}${tile(C.sh, "Éclats de champion", '<span class="ch-sh">◆</span>')}</div>`;
    // Sceaux de l'équipe : un sélecteur par héros
    const opts = (c) => { const L = e.SEAL_ORDER.filter((k) => e.sealRank(S, k) > 0).map((k) => [k, `${e.SEALS[k].name} · rang ${e.sealRank(S, k)}`]).concat(C.f.map((f) => [f, `${e.SEAL_FUSIONS[f]} (fusion)`]));
      return `<option value="">Aucun Sceau</option>` + L.map(([k, n]) => `<option value="${k}" ${c.seal === k ? "selected" : ""}>${h(n)}</option>`).join(""); };
    const teamRows = team.map((c) => { const cur = e.sealOf(S, c);
      return `<div class="ch-tr"><span class="ch-tn">${window.DX.social.cmed(c.cls, c.lvl)}<span><b>${h(c.name)}</b><small>niv. ${c.lvl}</small></span></span><span class="ch-tc">${cur ? icoSeal(cur.key) : ""}<select data-act="chp-wearsel" data-id="${c.id}" aria-label="Sceau de ${h(c.name)}">${opts(c)}</select></span><span class="ch-te xs muted">${cur ? cur.list.map((x) => h(e.SEALS[x.k].txt(x.v))).join(" · ") : "—"}</span></div>`; }).join("");
    const teamBox = `<section class="panel ch-panel"><div class="phead"><h2>${crown} Sceaux de l'équipe</h2><span class="ch-chip ${reso ? "on" : ""}" data-tip="Conclave des Champions : au moins 4 héros portent un Sceau, avec 4 pouvoirs différents en tout. Bonus : +${e.SEAL_RESO} % de dégâts et de PV pour toute l'équipe.">Conclave ${Math.min(kinds.size, 4)}/4${reso ? ` · +${e.SEAL_RESO} %` : ""}</span></div><div class="pad"><div class="ch-team">${teamRows}</div></div></section>`;
    // les 6 Sceaux (progression du compte) et les fusions : le panneau du héros, sans les boutons Porter
    const tiles = e.SEAL_ORDER.map((k) => { const n = e.sealKills(S, k), r = e.sealRank(S, k), nx = nextAt(n); const w = S.chars.filter((x) => x.seal === k).map((x) => x.name);
      return `<div class="ch-st ${r ? "" : "off"}"><div class="ch-sth">${ico(k)}<b>${e.SEALS[k].name}</b>${pips(r)}</div><span class="ch-std">${r ? h(e.SEALS[k].txt(e.sealVal(k, r))) : `Vaincs un Champion ${e.SEALS[k].name} pour le débloquer.`}</span><div class="ch-bar"><i style="width:${barPct(n, r)}%"></i></div>
        <div class="ch-stf"><span class="ch-cnt">${nx ? `${X().fmt(n)} / ${nx}` : `${X().fmt(n)} · max`}${w.length ? `<small>${h(w.join(", "))}</small>` : ""}</span><span class="ch-btns">${C.sh > 0 && nx ? `<button class="btn sm ch-ghost" data-act="chp-shard" data-v="${k}" data-tip="Utiliser un Éclat : compte comme un Champion ${e.SEALS[k].name} vaincu">+1 ◆</button>` : ""}</span></div></div>`; }).join("");
    const ready = e.SEAL_ORDER.filter((k) => e.sealRank(S, k) >= 5); const pairs = []; for (let i = 0; i < ready.length; i++) for (let j = i + 1; j < ready.length; j++) pairs.push(e.fuseKey(ready[i], ready[j]));
    const toFuse = pairs.filter((p) => !C.f.includes(p));
    const fz = C.f.map((f) => `<div class="ch-fc ok"><span class="ch-fi">${icoSeal(f)}</span><span class="ch-fn"><b>${h(e.SEAL_FUSIONS[f])}</b><small>${f.split("+").map((k) => e.SEALS[k].name).join(" + ")}</small></span></div>`)
      .concat(toFuse.map((f) => `<div class="ch-fc"><span class="ch-fi">${icoSeal(f)}</span><span class="ch-fn"><b>???</b><small>${f.split("+").map((k) => e.SEALS[k].name).join(" + ")}</small></span><button class="btn sm gold" data-act="chp-fuse" data-v="${f}">Fusionner</button></div>`)).join("");
    const sealBox = `<section class="panel ch-panel"><div class="phead"><h2>${crown} Sceaux</h2><span class="small muted">rangs à 1, 5, 15, 40 et 100 Champions</span></div><div class="pad"><div class="ch-seals six">${tiles}</div>
      <div class="ch-sec"><div class="ch-sech"><b>Fusions</b><span class="xs muted">${C.f.length} / 15 découvertes</span></div>${fz ? `<div class="ch-fz">${fz}</div>` : ""}<div class="xs muted">Deux Sceaux au rang 5 donnent un Sceau double au nom unique, qui garde les deux pouvoirs à 70 %.</div></div></div></section>`;
    // zones : « En cours » (un Champion déjà vaincu ici, ou la zone de chasse), « Complètes », « Toutes » rangées par région
    const live = (r) => r.got < 6 && (r.got > 0 || r.t > 0 || (S.hunting && r.id === S.sub));
    const cnt = { cours: rows.filter(live).length, done, all: rows.length };
    const chips = `<div class="ch-flt">${[["cours", "En cours"], ["done", "Complètes"], ["all", "Toutes"]].map(([k, n]) => `<button class="${st.f === k ? "on" : ""}" data-act="chp-flt" data-v="${k}">${n} <small>${cnt[k]}</small></button>`).join("")}</div>`;
    let zl;
    if (st.f === "all") { const g = []; rows.forEach((r) => { let G = g.find((x) => x.n === r.zone); if (!G) g.push((G = { n: r.zone, L: [] })); G.L.push(r); });
      zl = g.map((G) => { const ok = G.L.filter((r) => r.got === 6).length; const open = G.L.some((r) => r.id === S.sub);
        return `<details class="ch-zg" ${open ? "open" : ""}><summary><b>${h(G.n)}</b><span class="xs muted">${ok} / ${G.L.length} complètes</span></summary><div class="ch-zl">${G.L.map((r) => zoneCard(S, r)).join("")}</div></details>`; }).join(""); }
    else { const L = rows.filter(st.f === "done" ? (r) => r.got === 6 : live).sort((x, y) => (y.id === S.sub) - (x.id === S.sub) || y.got + y.t / 10 - (x.got + x.t / 10) || x.ord - y.ord);
      zl = L.length ? `<div class="ch-zl">${L.map((r) => zoneCard(S, r)).join("")}</div>` : `<p class="muted small">${st.f === "done" ? "Aucune zone complète pour l'instant." : "Vaincs un Champion en chasse : sa zone apparaîtra ici."}</p>`; }
    const zoneBox = `<section class="panel ch-panel"><div class="phead"><h2>${crown} Zones</h2>${chips}</div><div class="pad"><p class="xs muted ch-zhelp">Les 6 pouvoirs vaincus dans une zone : +${e.CHAMP_ZONE_BONUS} % d'XP, de kamas et de butin. Chaque Champion vaincu laisse une piste ; à 3 pistes, appelle le Champion légendaire.</p>${zl}</div></section>`;
    const html = `<div class="page ch-page"><div class="ch-ph"><h1>Chasse aux Champions</h1><p class="muted small">Un combat de chasse sur ${Math.round(1 / e.CHAMP_CHANCE)}, un monstre devient Champion.</p></div>${kpis}<div class="ch-cols"><div class="ch-cl">${teamBox}${sealBox}</div><div class="ch-cr">${zoneBox}</div></div></div>`;
    if (main.querySelector(".ch-page") && window.DX.morph) window.DX.morph(main, html); else main.innerHTML = html; // la boucle du jeu garde une liste déroulante ouverte
  }

  function act(a, t) {
    const S = window.DX.S; const e = E(); const d = t.dataset; let r = null;
    if (a === "chp-wear") { r = e.act(S, "sealWear", +d.id, d.v || null); if (!r) X().toast(d.v ? `Sceau ${e.sealName(d.v)} porté.` : "Sceau retiré."); }
    else if (a === "chp-fuse") { const [x, y] = d.v.split("+"); r = e.act(S, "sealFuse", x, y); if (!r) X().toast(`Fusion découverte : Sceau ${e.SEAL_FUSIONS[d.v]} !`); }
    else if (a === "chp-shard") { r = e.act(S, "sealShard", d.v); if (!r) X().toast(`Éclat utilisé : Sceau ${e.SEALS[d.v].name}.`); }
    else if (a === "chp-page") { window.DX.ui.tab = "chasse"; window.DX.render(); window.scrollTo(0, 0); return; }
    else if (a === "chp-flt") { st.f = d.v; window.DX.render(); return; }
    else if (a === "chp-wearsel") { r = e.act(S, "sealWear", +d.id, t.value || null); if (!r) X().toast(t.value ? `Sceau ${e.sealName(t.value)} porté.` : "Sceau retiré."); }
    else if (a === "chp-leg") { r = e.act(S, "champLegGo"); if (!r) X().toast("Le Champion légendaire arrive au prochain combat !"); }
    if (r) { X().toast(r); return; }
    X().markDirty(); X().render();
  }

  window.CHAMPUI = { heroPanel, heroLine, banner, huntPanel, act, page };
  window.DX.pages.chasse = page;
})();
