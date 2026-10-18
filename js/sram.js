/* ============================================================================
   Le nouveau Sram — Idlus (refonte choisie par Mathis : 1A 2A)
   - Pièges posés : un sort de piège ne frappe plus tout de suite. Il pose le piège (3 au plus par Sram, jamais deux fois le même) ;
     le piège explose au début du tour du prochain ennemi qui joue, sur lui et ses voisins, avec de gros dégâts (×2,6).
     Plusieurs pièges qui explosent dans le même tour de jeu : Réaction en chaîne (+15 % par piège déjà déclenché, +45 % au plus).
     Au Kolizéum, le piège explose sous le prochain héros adverse qui joue.
   - Invisibilité : Invisibilité / Brume rendent le Sram invisible 2 tours : les coups ennemis le touchent mal
     (−50 % de dégâts reçus). Son premier coup en sortant de l'ombre fait +40 %.
   - Passif « Assassin » : +25 % de dégâts sur une cible sous 30 % de PV ; achever un ennemi rend 2 PA (une fois par tour).
     Les poisons +25 % et le butin en double (10 %) du Larcin restent.
   Les crochets sont dans engine.js (E.srCast, E.srMult, E.srPost, E.srDmg, E.srTrig, E.srTurn, et le filtre d'invisibilité dans dealDamage).
   E.SR2 = false rend l'ancien Sram.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const rnd = () => E.rnd();
  const API = () => E.fightApi;
  E.SR2 = true;
  E.SR_TRAP = 2.6;     // dégâts d'un piège posé (× ceux du sort)
  E.SR_TRAP_MAX = 3;   // pièges posés au plus par Sram
  E.SR_CHAIN = 0.15;   // Réaction en chaîne : +15 % par piège déjà déclenché ce tour de jeu
  E.SR_INVIS = 2;      // tours d'invisibilité
  E.SR_AMBUSH = 0.4;   // premier coup en sortant de l'ombre
  E.SR_HIDE = 0.5;     // invisible : −50 % de dégâts reçus des monstres
  E.SR_EXEC = 0.25;    // Assassin : bonus sous 30 % de PV
  E.SR_KILL_PA = 2;    // Assassin : PA rendus en achevant un monstre
  const isTrap = (sp) => /Pi[eè]ge/i.test(sp.name) && !/Immobilisation/i.test(sp.name);
  const isInvis = (sp) => /^(Invisibilit|Brume)/i.test(sp.name);

  if (D.CLASSES && D.CLASSES.sram) {
    D.CLASSES.sram.passive = { id: "assassin", name: "Assassin",
      desc: "Ses pièges se posent et explosent au tour de l'ennemi suivant (3 au plus). +25 % de dégâts sur une cible sous 30 % de PV, achever un ennemi rend 2 PA, poisons +25 %. 10 % de chances par monstre de tirer son butin une seconde fois." };
    D.CLASSES.sram.signature = "Assassin : pièges posés qui explosent au tour ennemi, +25 % sur les cibles sous 30 % de PV, poisons +25 %, 10 % de butin en double.";
    D.CLASSES.sram.spells.forEach((sp) => {
      if (isTrap(sp) && !sp._sr2) { sp._sr2 = 1; sp.desc = "Pose un piège : il explose au début du tour du prochain ennemi, sur lui et ses voisins (dégâts ×2,6).\n" + (sp.desc || ""); }
      if (isInvis(sp) && !sp._sr2) { sp._sr2 = 1; sp.desc = "Le Sram devient invisible 2 tours : les coups ennemis le touchent mal (−50 % de dégâts reçus). Son premier coup en sortant de l'ombre fait +40 %.\n" + (sp.desc || ""); }
    });
  }

  E.srTurn = (F, e) => {
    if (!E.SR2) return;
    if (e.srInvis > 0) { e.srInvis--; if (!e.srInvis) { API().flog(F, `${e.name} redevient visible.`, "dim"); } }
    e.srKillPa = false;
  };

  E.srCast = (S, F, e, sp, g) => {
    if (!E.SR2) return null;
    if (isInvis(sp)) {
      if (e.srInvis > 0) return { ok: false };
      e.srInvis = E.SR_INVIS + 1; e.srAmbush = true;
      F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(e), txt: "Invisible" });
      API().flog(F, `${e.name} · ${sp.name} → disparaît dans l'ombre : −50 % de dégâts reçus pendant ${E.SR_INVIS} tours.`, "c");
      return { ok: true, extraPa: 0 };
    }
    if (!isTrap(sp)) return null;
    const f = g.fx.find((x) => x.k === "dmg" || x.k === "drain");
    if (!f) return null;
    const mine = (F.srTraps = F.srTraps || []).filter((t) => t.src === e);
    if (mine.length >= E.SR_TRAP_MAX) return { ok: false };
    if (mine.some((t) => t.name === sp.name)) return { ok: false }; // jamais deux fois le même piège posé
    F.srTraps.push({ src: e, f, name: sp.name, n: Math.max(1, f.n || 1) });
    F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(e), txt: "Piège posé" });
    API().flog(F, `${e.name} · ${sp.name} → pose un piège (${mine.length + 1}/${E.SR_TRAP_MAX}).`, "c");
    return { ok: true, extraPa: 0 };
  };

  /* un ennemi du Sram commence son tour (monstre, ou héros adverse au Kolizéum) : le plus ancien piège posé contre lui explose sous lui.
     Au Kolizéum, koliStep retourne les camps avant d'appeler : celui qui joue est toujours du côté « c », le Sram du côté « m ». */
  E.srTrig = (S, F, m) => {
    if (!E.SR2 || m.summon || !m.alive) return;
    const i = F.srTraps.findIndex((t) => t.src && t.src.side !== m.side);
    if (i < 0) return;
    const tr = F.srTraps.splice(i, 1)[0];
    F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(m), txt: "Piège !" });
    const foes = F.ents.filter((x) => x.side === m.side && x.alive && x !== m && !x.summon).sort(() => rnd() - 0.5);
    const ts = [m, ...foes].slice(0, tr.n);
    if (F.srChainR !== F.round) { F.srChainR = F.round; F.srChain = 0; }
    const chain = 1 + E.SR_CHAIN * Math.min(3, F.srChain); F.srChain++;
    const mult = E.SR_TRAP * chain * (tr.n > 1 ? 0.85 : 1);
    const vals = [];
    ts.forEach((t) => {
      const r = API().charDamage(S, F, tr.src, tr.f, mult, t);
      const d = API().dealDamage(F, tr.src, t, r.v, r.el); vals.push(`−${d}${r.crit ? "!" : ""}`);
    });
    API().flog(F, `${tr.name} de ${tr.src.name} explose sous ${m.name}${chain > 1 ? ` (réaction en chaîne +${Math.round((chain - 1) * 100)} %)` : ""} : ${vals.join(" / ")}`, "c");
    ts.forEach((t) => { if (!t.alive) API().flog(F, `${t.name} est vaincu.`, "ko"); });
  };

  E.srMult = (F, e, parts) => {
    if (!E.SR2) return 1;
    if (e.srAmbush) { e.srAmbush = false; parts.push("sort de l'ombre !"); return 1 + E.SR_AMBUSH; }
    return 1;
  };
  E.srDmg = (F, e, tgt, v) => (E.SR2 && tgt && tgt.hpMax && tgt.hp < tgt.hpMax * 0.3 ? v * (1 + E.SR_EXEC) : v);
  E.srPost = (F, e, hitIdx, parts) => {
    if (!E.SR2 || e.srKillPa) return 0;
    if (hitIdx.some((i) => F.ents[i] && F.ents[i].side !== e.side && !F.ents[i].alive)) { e.srKillPa = true; parts.push(`+${E.SR_KILL_PA} PA (Assassin)`); return E.SR_KILL_PA; }
    return 0;
  };

  // jauge sous le Sram en combat : pièges posés (0 à 3)
  const pi0 = E.passiveInfo;
  E.passiveInfo = (e, F) => (E.SR2 && e.cls === "sram" ? { n: e.srInvis > 0 ? "Invisible · Pièges" : "Pièges", v: F ? (F.srTraps || []).filter((t) => t.src === e).length : 0, m: E.SR_TRAP_MAX } : pi0(e, F));

  // pastilles de la vue Formation (formation.js) : pièges posés n/3, invisible
  const TRAP_ICO = '<svg viewBox="0 0 12 10" aria-hidden="true"><path d="M0 9.5h12" stroke="currentColor" stroke-width="1.4"/><path d="M1 9l1.5-6L4 9M4.5 9L6 1.5 7.5 9M8 9l1.5-6L11 9" fill="currentColor"/></svg>';
  E.srChip = (F, e) => {
    if (!E.SR2 || e.cls !== "sram" || e.summon) return null;
    const out = [], n = (F.srTraps || []).filter((t) => t.src === e).length;
    if (e.srInvis > 0) out.push(["sh", "◐", `invisible : −${Math.round(E.SR_HIDE * 100)} % de dégâts reçus, encore ${e.srInvis - 1 > 0 ? e.srInvis - 1 + " tour" + (e.srInvis > 2 ? "s" : "") : "ce tour"}`]);
    if (n) out.push(["tr", `${TRAP_ICO}${n}/${E.SR_TRAP_MAX}`, `${n} piège${n > 1 ? "s" : ""} posé${n > 1 ? "s" : ""} sur ${E.SR_TRAP_MAX} : il explose au tour du prochain ennemi`]);
    return out;
  };

  // fiche du sort (Sorts) : la phrase des pièges et de l'invisibilité
  E.srSentence = (c, sp, r, fmt) => {
    if (!E.SR2 || c.cls !== "sram") return null;
    if (isInvis(sp)) return `Rend le Sram <b>invisible ${E.SR_INVIS} tours</b> : il prend <b>−${Math.round(E.SR_HIDE * 100)} %</b> de dégâts, et son premier coup en sortant de l'ombre fait <b>+${Math.round(E.SR_AMBUSH * 100)} %</b>.`;
    if (!isTrap(sp) || !r) return null;
    const g = E.spellGrade(sp, Math.max(c.lvl, sp.lvl)); const f = g.fx.find((x) => x.k === "dmg" || x.k === "drain"); if (!f) return null;
    const n = Math.max(1, f.n || 1);
    return `Pose un piège (${E.SR_TRAP_MAX} au plus) : au début du tour du prochain ennemi, il explose sur <b>${n >= 9 ? "tous les ennemis" : n > 1 ? n + " ennemis" : "lui"}</b> pour <b>≈ ${fmt(r.avg * E.SR_TRAP * (n > 1 ? 0.85 : 1))}</b> dégâts. Plusieurs pièges dans le même tour : +${Math.round(E.SR_CHAIN * 100)} % chacun.`;
  };
})(typeof window !== "undefined" ? window : globalThis);
