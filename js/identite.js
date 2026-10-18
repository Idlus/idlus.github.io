/* ============================================================================
   IDENTITÉ DES SORTS — Idlus
   Chaque sort reçoit une identité tirée de sa vraie description DOFUS : une ou deux mécaniques
   (cumul, retardement, état nommé, piège, glyphe, bombe, téléportation…) qui changent vraiment
   ce qu'il fait en combat, et un motif visuel. Deux sorts d'une même classe n'ont jamais la même
   identité. La puissance globale reste la même : les dégâts de base d'un sort baissent un peu
   quand sa mécanique lui apporte un avantage (E.ID_K).
   Branché sur le moteur par E.idPre / idMul / idHit / idPost / idTurn / idDef / idHeal.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const { CLASSES } = D;
  const rnd = () => E.rnd();
  const API = () => E.fightApi;
  const alive = (F, side) => F.ents.filter((x) => x.alive && x.side === side);
  const idx = (F, x) => F.ents.indexOf(x);
  const say = (F, t, txt, x) => { if (F.fx && t) F.fx.push({ seq: F.seq, k: "buff", t: idx(F, t), txt, idx: x || "esquive" }); }; // texte flottant + effet visuel (js/animid.js)

  /* ---------- bibliothèque des mécaniques ----------
     v : valeur moyenne estimée (part de dégâts en plus), compensée sur les dégâts de base */
  const T = {
    cumul: { n: "Cumul", v: 0.12, d: (p) => `+${p.a} % de dégâts à chaque lancer (jusqu'à ${p.max} fois)` },
    retard: { n: "Retardement", v: 0.1, d: () => "un tiers des dégâts explose plus fort au tour suivant de la cible" },
    etat: { n: "État", v: 0.08, d: (p) => `applique l'état ${p.st} : vos coups suivants sur la cible font +12 %` },
    contagion: { n: "Contagion", v: 0.14, d: (p) => `touche aussi tous les ennemis ${p.st ? "dans l'état " + p.st : "marqués"} (40 %)` },
    erosion: { n: "Érosion", v: 0.06, d: () => "la cible reçoit 40 % de soins en moins et +6 % de dégâts pendant 2 tours" },
    vol: { n: "Vol", v: 0.08, d: (p) => `vole ${p.st} : +6 % de dégâts pour le lanceur (cumulable 3 fois)` },
    sape: { n: "Sape", v: 0.06, d: (p) => `retire ${p.st} : la cible fait 5 % de dégâts en moins pendant 2 tours` },
    crit: { n: "Critique", v: 0.05, d: () => "+20 % de chances de coup critique" },
    contact: { n: "Corps à corps", v: 0.08, d: () => "+18 % de dégâts si le lanceur est en première ligne" },
    recul: { n: "Recul", v: 0.06, d: () => "le lanceur recule : −15 % sur la prochaine attaque reçue" },
    attire: { n: "Attirance", v: 0.06, d: () => "la cible attirée subit +10 % de dégâts de toute l'équipe jusqu'à son tour" },
    tp: { n: "Téléportation", v: 0.05, d: () => "le lanceur disparaît : la prochaine attaque reçue fait 20 % de moins" },
    telefrag: { n: "Téléfrag", v: 0.06, d: () => "30 % de chances de gagner 1 PA au prochain tour" },
    piege: { n: "Piège", v: 0.1, d: () => "piège la cible : sa prochaine attaque lui renvoie 40 % de ce sort" },
    glyphe: { n: "Glyphe", v: 0.1, d: () => "laisse un glyphe : 20 % du sort sur tous les ennemis au début des 2 tours suivants" },
    bombe: { n: "Bombe", v: 0.12, d: () => "pose une bombe qui explose au tour suivant du lanceur (50 % en zone, +25 % par Combo)" },
    portail: { n: "Portail", v: 0.05, d: () => "ouvre un portail : le prochain sort de zone de l'équipe fait +15 %" },
    relance: { n: "Relance", v: 0.07, d: () => "30 % de chances de rendre ses PA" },
    elan: { n: "Élan", v: 0.04, d: () => "le lanceur joue en premier au tour suivant" },
    entrave: { n: "Entrave", v: 0.05, d: () => "40 % de chances que la cible joue en dernier au tour suivant" },
    garde: { n: "Garde", v: 0.04, d: () => "le lanceur subit 6 % de dégâts en moins jusqu'à son prochain tour" },
    regen: { n: "Régénération", v: 0.06, d: () => "soigne aussi 2 % des PV au début des 3 tours suivants" },
    sacrifice: { n: "Sacrifice", v: 0.0, d: () => "coûte 5 % des PV du lanceur, effet +25 %" },
    hasard: { n: "Hasard", v: 0.05, d: () => "effet tiré au sort entre ×0,6 et ×1,7" },
    pioche: { n: "Pioche", v: 0.06, d: () => "pioche une carte : à la 3e carte, le sort suivant fait +35 %" },
    rune: { n: "Rune", v: 0.07, d: () => "laisse une rune : un sort d'un autre élément sur la cible fait +20 %" },
    acharne: { n: "Acharnement", v: 0.09, d: () => "+8 % par coup d'affilée sur la même cible (jusqu'à +32 %)" },
    pleine: { n: "Zone pleine", v: 0.08, d: () => "les dégâts de zone ne baissent pas sur les cibles secondaires" },
    puissance: { n: "Puissance", v: 0.05, d: () => "+5 % de dégâts pour le lanceur pendant 2 tours" },
    execute: { n: "Exécution", v: 0.07, d: () => "+25 % sur une cible sous 30 % de PV" },
    premier: { n: "Premier sang", v: 0.06, d: () => "+20 % sur une cible qui n'a encore rien subi" },
    percegarde: { n: "Brise-bouclier", v: 0.04, d: () => "détruit la moitié du bouclier de la cible avant de frapper" },
    echo: { n: "Écho", v: 0.08, d: () => "20 % de chances de frapper une seconde fois à 50 %" },
    brulure: { n: "Empreinte", v: 0.07, d: (p) => `laisse une empreinte ${p.el} : 15 % du coup au début du tour de la cible` },
    soutien: { n: "Soutien", v: 0, d: () => "l'allié le plus blessé récupère aussi 3 % de ses PV" },
    bouclier: { n: "Rempart", v: 0.04, d: () => "le lanceur gagne un bouclier égal à 15 % des dégâts infligés" },
    invoc: { n: "Invocation", v: 0, d: (p) => `${p.st || "l'invocation"} arrive avec +15 % de PV` },
    poussee: { n: "Poussée", v: 0, d: () => "repousse : la cible peut percuter un autre monstre" },
    retraitpa: { n: "Retrait de PA", v: 0, d: () => "la cible perd des PA à son prochain tour" },
    volvie: { n: "Vol de vie", v: 0, d: () => "rend au lanceur la moitié des dégâts infligés" },
  };
  E.ID_TRAITS = T;
  const env = (k) => { try { return typeof process !== "undefined" && process.env ? process.env[k] : undefined; } catch (e) { return undefined; } }; // serveur (Deno) : pas d'accès à l'environnement
  E.ID_G = +(env("ID_G") || 0.9);
  E.ID_DEF = +(env("ID_DEF") || 0.5); // force des mécaniques défensives et de tempo
  E.ID_K = +(env("ID_K") || 1); // part de la valeur des mécaniques retirée aux dégâts de base (1 = neutre)

  /* ---------- lecture des descriptions DOFUS ---------- */
  const STATN = { Puissance: "de la Puissance", Force: "de la Force", Intelligence: "de l'Intelligence", Chance: "de la Chance", "Agilité": "de l'Agilité", Sagesse: "de la Sagesse", Vitalité: "de la Vitalité", Critiques: "des Critiques", Fuite: "de la Fuite", Tacle: "du Tacle", Portée: "de la Portée", Résistances: "des Résistances" };
  const RULES = [
    ["bombe", /\bBombe|\bCombo/],
    ["piege", /\bpi[eè]ge/i],
    ["glyphe", /\bglyphe/i],
    ["portail", /\bportail/i],
    ["cumul", /après chaque lancer|cumulable \d+ fois/i],
    ["retard", /retardement|poison \w+ de (début|fin) de tour/i],
    ["contagion", /tous les ennemis \w+s?\b|sur tous les/i],
    ["acharne", /\bProie\b|\bRage\b/],
    ["rune", /[ée]tat élémentaire|Combinaisons? [ÉE]lémentaire/i],
    ["pioche", /\bPioche\b/],
    ["hasard", /aléatoire/i],
    ["telefrag", /T[ée]l[ée]frag/i],
    ["erosion", /[ÉEé]ro(de|sion)|réduit les soins reçus/i],
    ["vol", /\bVole de la (Puissance|Force|Intelligence|Chance|Agilité|Sagesse)|\bVole de l'(Intelligence|Agilité)/],
    ["sape", /\bRetire (de la |de l'|des )(Puissance|Force|Intelligence|Chance|Agilité|Sagesse|Critiques|Fuite|Tacle|Portée|Résistances)/i],
    ["pleine", /pas dégressifs/i],
    ["sacrifice", /\bSacrifie|transf[eè]re une partie de la vie|perd(re)? des PV|consomme des PV/i],
    ["regen", /soigne au début|au début de son tour.{0,40}soign|soins? de début de tour/i],
    ["attire", /\battire/i],
    ["contact", /\bau contact|rapproche le lanceur|téléporte le lanceur jusqu'à la cible/i],
    ["recul", /[ÉE]loigne le lanceur|recule? le lanceur/i],
    ["tp", /t[ée]l[ée]port|échange de position|symétrique/i],
    ["crit", /Critique/],
    ["relance", /remboursé|réinitialis|temps de relance est réduit/i],
    ["elan", /Augmente (également )?(les |ses )?PM du lanceur|augmente les PM/i],
    ["entrave", /retire (des )?PM|Fuite/i],
    ["garde", /Intaclable|Indéplaçable|réduit les dommages subis|Invulnérable|Pesanteur/i],
    ["puissance", /augmente (également )?la Puissance du lanceur|Augmente la Puissance/i],
    ["etat", /l'état ([A-ZÉÈ][\wéèêàçûî'-]+)/],
  ];
  const FALL = ["execute", "premier", "echo", "brulure", "percegarde", "bouclier", "acharne", "crit", "puissance", "garde", "elan", "relance"];
  const FALL_SUP = ["soutien", "elan", "garde", "relance", "regen", "puissance"];
  const ELN = { t: "de terre", f: "de feu", e: "d'eau", a: "d'air", n: "neutre" };

  const kindOf = (g) => (E.spellKind ? E.spellKind(g) : "dmg");
  const isAtk = (g) => g.fx.some((f) => ["dmg", "drain", "dot"].includes(f.k));
  const stOf = (desc) => { const m = /l'état ([A-ZÉÈ][\wéèêàçûî'-]+)/.exec(desc); if (m) return m[1];
    const t = /tous les ennemis ([A-ZÉ][a-zéèê]+?)s?\b/.exec(desc) || /\b(Infect)e/.exec(desc); return t ? (t[1] === "Infect" ? "Infecté" : t[1]) : null; };
  const sig = (id) => id.tr.map((t) => t.k + ":" + (t.st || "") + ":" + (t.a || "")).sort().join("|");

  const GEN = new Set(["tp", "garde", "puissance", "relance", "elan", "entrave", "attire", "crit", "regen", "poussee", "volvie", "retraitpa", "sape", "contact", "recul"]); // mécaniques courantes, plafonnées
  const CAP = 4; // une même mécanique au plus 4 fois par classe : chaque sort garde sa personnalité
  const ALLATK = Object.keys(T).filter((k) => !["invoc", "poussee", "retraitpa", "volvie", "soutien", "regen"].includes(k) && T[k].v > 0);
  const build = (cls) => {
    const out = {}; const seen = new Set(); const list = CLASSES[cls].spells; const used = {};
    list.forEach((sp, i) => {
      const desc = (sp.desc || "").replace(/\{\{[^}]*?::([^}]*)\}\}/g, "$1").replace(/<[^>]+>|\{\{[^}]*\}\}/g, " ");
      const g = sp.grades[sp.grades.length - 1]; const atk = isAtk(g); const st = stOf(desc);
      const tr = [];
      const cand = RULES.slice();
      if (g.fx.some((f) => f.k === "push")) cand.push(["poussee", /./]);
      if (g.fx.some((f) => f.k === "apdrain")) cand.push(["retraitpa", /./]);
      if (g.fx.some((f) => f.k === "drain")) cand.push(["volvie", /./]);
      for (const [k, re] of cand) {
        if (tr.length >= 2) break;
        if ((used[k] || 0) >= CAP && GEN.has(k)) continue;
        const m = re.exec(desc); if (!m) continue;
        if (!atk && ["cumul", "retard", "contagion", "acharne", "rune", "pleine", "crit", "execute", "erosion", "sape", "vol", "contact", "attire", "piege", "bombe", "glyphe"].includes(k) && !g.fx.some((f) => f.k === "summon")) continue;
        const p = { k };
        if (k === "cumul") { const c = /cumulable (\d+)/i.exec(desc); p.max = Math.min(4, c ? +c[1] : 3); p.a = p.max >= 3 ? 10 : 15; }
        if (k === "etat" || k === "contagion") p.st = st;
        if (k === "vol" || k === "sape") p.st = STATN[m[m.length - 1]] || STATN[m[1]] || "des caractéristiques";
        if (k === "etat" && tr.some((x) => x.k === "contagion")) continue;
        tr.push(p);
      }
      if (g.fx.some((f) => f.k === "summon") && !tr.some((t) => t.k === "invoc")) { const s = (D.SUMMONS || {})[String((g.fx.find((f) => f.k === "summon") || {}).mid)]; tr.unshift({ k: "invoc", st: s && s.name }); tr.length = Math.min(tr.length, 2); }
      if (!tr.length) { const pool = atk ? FALL : FALL_SUP; tr.push({ k: pool[i % pool.length] }); }
      if (tr.some((t) => t.k === "brulure")) tr.find((t) => t.k === "brulure").el = ELN[(g.fx.find((f) => f.el) || {}).el || "n"];
      let id = { tr }; let s = sig(id); let j = 0;
      while (seen.has(s) && j < 200) { // jamais deux sorts identiques dans une classe : on ajoute une seconde mécanique
        const pool = j < 12 ? (atk ? FALL : FALL_SUP) : atk ? ALLATK : FALL_SUP.concat(["telefrag", "portail", "pioche", "tp", "recul"]); const k = pool[(i * 7 + j) % pool.length];
        if (!tr.some((t) => t.k === k)) { if (tr.length >= 2) tr.pop(); tr.push({ k, el: ELN[(g.fx.find((f) => f.el) || {}).el || "n"] }); }
        s = sig(id); j++;
      }
      if (seen.has(s)) { const pool = atk ? ALLATK : FALL_SUP.concat(["telefrag", "portail", "pioche", "tp", "recul"]); for (const k of pool) { if (tr.some((t) => t.k === k)) continue; tr.push({ k }); if (!seen.has(sig(id))) break; tr.pop(); } s = sig(id); } // dernier recours : une troisième mécanique
      tr.forEach((t) => { // 1.2.6.3 : une mécanique ajoutée pour départager deux sorts reçoit aussi ses réglages (sans eux, Cumul donnait des PV NaN aux monstres)
        if (t.k === "cumul" && !(t.max > 0 && t.a > 0)) { t.max = 3; t.a = 10; }
        if ((t.k === "etat" || t.k === "contagion") && !t.st) t.st = st || "Marqué";
        if ((t.k === "vol" || t.k === "sape") && !t.st) t.st = "des caractéristiques";
      });
      seen.add(s); tr.forEach((t) => (used[t.k] = (used[t.k] || 0) + 1));
      id.v = tr.reduce((a, t) => a + ((T[t.k] && T[t.k].v) || 0), 0);
      id.motif = motif(sp.name, desc, g);
      out[sp.id] = id;
    });
    return out;
  };
  const MOTIFS = [["fleche", /Fl[eè]che|Tir |Carreau|Arc/i], ["bombe", /bombe|Explo/i], ["piege", /Pi[eè]ge/i], ["lance", /Lance|Javeline|Trident|Estoc|Pique/i], ["epee", /[ÉE]p[ée]e|Lame|Couperet|Tranche|Tailleur/i], ["carte", /Carte|Valet|Dame|Roi|Belote|Jass|Blakjak|Kraps|Topkaj|Yams/i], ["horloge", /Horloge|Temps|Aiguille|Sablier|Rouage|Engrenage|Tic|Rembobinage|Cadran/i], ["mot", /^Mot /i], ["ronce", /Ronce|Arbre|Feuill|Herbe|Puissance Sylvestre|Poupée/i], ["biere", /Bi[eè]re|Ethylo|Gueule de bois|Schnaps|Flasque|Eau-de-vie|Ivresse|Saoul/i], ["sang", /Sang|H[ée]morragie|Supplice|Absorption|Mutilation|Sacrifice|Douleur/i], ["portail", /Portail|Wakfu|Rayon/i], ["rune", /Rune|[ÉE]ther|M[ée]t[ée]ore|Stalag|Déluge|Lance-flamme|Onde/i], ["masque", /Masque|Cavalcade|Furia|Ginga|Capoeira/i], ["eau", /Mar[ée]e|Torpille|Harpon|Ressac|Vapeur|Scaphandre/i], ["os", /Os |Molosse|Carcasse|Charogne|Cubitus|Tibia|Dépouille/i], ["piece", /Pi[eè]ce|Or\b|Pelle|Banqueroute|Avarice/i], ["glyphe", /Glyphe|Bouclier|Armure|Barricade|Rempart|Bastion/i], ["bete", /Corbac|Tofu|Bouftou|Dragoune|Crapaud|Granouille|Chtigre|Prespic|Piranya|Ours|Fouet/i]];
  const motif = (name, desc) => { for (const [k, re] of MOTIFS) if (re.test(name)) return k; for (const [k, re] of MOTIFS) if (re.test(desc)) return k; return null; };

  E.ID = {};
  for (const cls of Object.keys(CLASSES)) Object.assign(E.ID, build(cls));
  E.idOf = (sp) => (sp && E.ID[sp.id]) || null;
  E.idText = (sp) => { const id = E.idOf(sp); if (!id) return []; return id.tr.map((t) => ({ k: t.k, n: t.k === "etat" && t.st ? `État ${t.st}` : (T[t.k] || {}).n || t.k, d: (T[t.k] || { d: () => "" }).d(t) })); };

  /* compensation de puissance : les dégâts de base baissent de la valeur de la mécanique */
  E.idScale = (k) => {
    for (const cls of Object.keys(CLASSES)) for (const sp of CLASSES[cls].spells) {
      const id = E.ID[sp.id]; if (!id || !id.v) continue;
      const f0 = id.f0 = id.f0 || 1; const f1 = 1 / (1 + id.v * k); id.f0 = f1;
      sp.grades.forEach((g) => g.fx.forEach((f) => { if (["dmg", "drain", "dot"].includes(f.k) && f.min !== undefined) { f.min = Math.max(1, Math.round(f.min / f0 * f1)); f.max = Math.max(f.min, Math.round(f.max / f0 * f1)); } }));
    }
  };
  if (!env("NO_ID")) E.idScale(E.ID_K);
  E.idOn = !env("NO_ID");

  /* ---------- moteur ---------- */
  const OFF = new Set((env("ID_OFF") || "").split(",")); // simulations : couper une mécanique
  const has = (id, k) => !OFF.has(k) && id && id.tr.find((t) => t.k === k);
  /* avant le sort : renvoie le contexte (ou null) */
  E.idPre = (F, e, sp, g, parts) => {
    if (!E.idOn || F.pvp && !E.idPvp) return null;
    const id = E.ID[sp.id]; if (!id) return null;
    const c = { id, sp, m: E.ID_G, crit: 0, tgt: null }; // E.ID_G : les mécaniques ajoutent de la puissance, la base baisse d'autant
    const x = (e.idn = e.idn || {});
    const cu = has(id, "cumul"); if (cu) { const n = x["c" + sp.id] || 0; c.m *= 1 + (cu.a || 10) * n / 100; if (n) { parts.push(`cumul ×${n}`); say(F, e, `Cumul ×${n}`, "cumul"); } x["c" + sp.id] = Math.min(cu.max || 3, n + 1); }
    if (has(id, "hasard")) { c.m *= 0.6 + rnd() * 1.1; }
    if (has(id, "sacrifice") && e.hp > e.hpMax * 0.2) { e.hp -= Math.round(e.hpMax * 0.05); c.m *= 1.25; c.heal = 1.25; parts.push("sacrifice"); say(F, e, "Sacrifice", "sacrifice"); }
    if (has(id, "contact") && (e.row || "f") === "f") c.m *= 1.18;
    if (x.card >= 3) { c.m *= 1.35; x.card = 0; parts.push("main pleine !"); say(F, e, "Main pleine !", "pioche"); }
    if (x.vol) c.m *= 1 + 0.06 * x.vol.n;
    if (x.pui && x.pui.r >= F.round) c.m *= 1.05;
    const multi = g.fx.some((f) => f.n > 1 && ["dmg", "drain", "dot"].includes(f.k));
    const side = alive(F, "c"); const pt = side.find((a) => a.idPortal);
    if (multi && pt) { c.m *= 1.15; pt.idPortal = 0; parts.push("portail"); say(F, e, "Portail", "portail"); }
    if (has(id, "pleine") && multi) c.full = 1;
    if (has(id, "crit")) c.crit = 20;
    return c;
  };
  /* 2.1.21 : valeur attendue d'un sort pour l'IA (planTurn), selon la situation : sans elle, l'IA ne voyait que les dégâts de base,
     baissés pour compenser la mécanique, et délaissait les sorts à cumul, bombe, écho… (Pandawa, Osamodas) */
  E.idPlan = (F, e, sp) => {
    if (!E.idOn || F.pvp && !E.idPvp) return null; const id = E.ID[sp.id]; if (!id) return null;
    const x = e.idn || {}; let m = E.ID_G;
    const cu = has(id, "cumul"); if (cu) { const n = x["c" + sp.id] || 0; m *= 1 + (cu.a || 10) * n / 100 + (n < (cu.max || 3) ? (cu.a || 10) / 200 : 0); } // le prochain lancer en profitera aussi
    if (has(id, "contact") && (e.row || "f") === "f") m *= 1.18;
    if (x.vol) m *= 1 + 0.06 * x.vol.n; if (x.pui && x.pui.r >= F.round) m *= 1.05;
    if (has(id, "crit")) m *= 1.06; if (has(id, "echo")) m *= 1.1; if (has(id, "retard")) m *= 1.17; if (has(id, "brulure")) m *= 1.15;
    if (has(id, "relance")) m *= 1.12; if (has(id, "bombe")) m *= 1.4; if (has(id, "glyphe")) m *= 1 + 0.4 * Math.min(3, alive(F, "m").length) / 2;
    if (has(id, "puissance")) m *= 1.06; if (has(id, "vol")) m *= 1.06; if (has(id, "piege")) m *= 1.2;
    return { m, premier: !!has(id, "premier"), execute: !!has(id, "execute"), etat: !!has(id, "etat"), src: e };
  };
  E.idPlanT = (F, P, t) => { // même chose, pour une cible
    let m = 1; const tn = t.idn || {};
    if (tn.st && tn.st.src === P.src && tn.st.r >= F.round) m *= 1.12;
    if (tn.att && tn.att >= F.round) m *= 1.1;
    if (P.premier && t.hp >= t.hpMax) m *= 1.2;
    if (P.execute && t.hp < t.hpMax * 0.3) m *= 1.25;
    return m;
  };
  /* multiplicateur par cible */
  E.idMul = (F, e, c, t, f) => {
    let m = c.m; const id = c.id; const tn = t.idn || {};
    if (tn.st && tn.st.src === e && tn.st.r >= F.round) m *= 1.12;
    if (tn.rune && tn.rune.el !== f.el && tn.rune.r >= F.round) { m *= 1.2; tn.rune = null; }
    if (has(id, "execute") && t.hp < t.hpMax * 0.3) m *= 1.25;
    if (has(id, "premier") && t.hp >= t.hpMax) m *= 1.2;
    if (has(id, "acharne")) { const x = e.idn; const n = x.lastT === t ? Math.min(4, (x.ach || 0) + 1) : 0; m *= 1 + 0.08 * n; }
    if (has(id, "percegarde") && t.shield > 0) t.shield = Math.round(t.shield / 2);
    if (c.full && f.n > 1) m /= 0.85;
    if (tn.att && tn.att >= F.round) m *= 1.1;
    return m;
  };
  /* après un coup porté (d : dégâts infligés) */
  E.idHit = (F, e, c, t, d, f, vals) => {
    const id = c.id; const tn = (t.idn = t.idn || {}); const x = e.idn;
    if (has(id, "acharne")) { x.ach = x.lastT === t ? Math.min(4, (x.ach || 0) + 1) : 0; x.lastT = t; }
    if (!t.alive) return;
    const r = F.round;
    const et = has(id, "etat"); if (et) { if (!(tn.st && tn.st.r >= r)) say(F, t, `État ${et.st || "marqué"}`, "etat"); tn.st = { n: et.st, src: e, r: r + 1 }; }
    const ru = has(id, "rune"); if (ru) { tn.rune = { el: f.el, r: r + 1 }; say(F, t, "Rune", "rune"); }
    if (has(id, "retard") && d > 2) { const v = d * 0.5; t.hp = Math.min(t.hpMax, t.hp + Math.round(d / 3)); (tn.del = tn.del || []).push({ v, el: f.el, src: e }); vals.push("retardement"); say(F, t, "Retardement", "retard"); }
    if (has(id, "erosion")) { tn.ero = r + 2; say(F, t, "Érosion", "erosion"); t.debuffs.push({ vuln: 6, turns: 2 }); if (t.side === "c") t.debuffs.push({ healcut: 40, turns: 2 }); }
    if (has(id, "sape")) t.debuffs.push({ weak: Math.round(5 * E.ID_DEF), turns: 2 });
    if (has(id, "attire")) { tn.att = r + 1; say(F, t, "Attiré", "attire"); }
    if (has(id, "entrave") && rnd() < 0.4 * E.ID_DEF) t.slowR = r + 1;
    if (has(id, "piege")) { tn.trap = { v: d * 0.4, el: f.el, src: e }; say(F, t, "Piégé", "piege"); }
    if (has(id, "glyphe")) { (F.idGly = F.idGly || []).push({ v: d * 0.2, el: f.el, src: e, n: 2 }); say(F, t, "Glyphe", "glyphe"); }
    if (has(id, "bombe")) { const b = (x.bomb = x.bomb || { v: 0, combo: 0 }); b.combo = b.v ? b.combo + 1 : 0; b.v = Math.max(b.v, d * 0.5); b.el = f.el; if (!x.bombSaid || x.bombSaid !== F.seq) { x.bombSaid = F.seq; say(F, e, b.combo ? `Combo ×${b.combo}` : "Bombe armée", "bombe"); } }
    if (has(id, "brulure") && !t.noDot) t.dots.push({ v: Math.max(1, d * 0.15), turns: 1, el: f.el, src: e.name });
    if (has(id, "echo") && rnd() < 0.2) { const d2 = API().dealDamage(F, e, t, d * 0.5, f.el); vals.push(`écho −${d2}`); say(F, t, "Écho", "echo"); }
  };
  /* après le sort */
  E.idPost = (F, e, c, g, dealt, hitIdx, parts) => {
    const id = c.id; const x = e.idn; let pa = 0; const r = F.round;
    const foes = hitIdx.map((i) => F.ents[i]).filter((t) => t.side === "m");
    const ct = has(id, "contagion");
    if (ct && dealt && foes.length) {
      const extra = alive(F, "m").filter((m) => !foes.includes(m) && m.idn && m.idn.st && m.idn.st.r >= r);
      const per = dealt / foes.length * 0.4; extra.forEach((m) => API().dealDamage(F, e, m, per, null));
      if (extra.length) { parts.push(`contagion ×${extra.length}`); extra.forEach((m) => say(F, m, "Contagion", "contagion")); }
      foes.forEach((t) => { if (t.alive) { const tn = (t.idn = t.idn || {}); tn.st = tn.st || { n: ct.st || "Marqué", src: e, r: r + 1 }; tn.st.r = r + 1; } });
    }
    if (has(id, "vol") && dealt) { x.vol = { n: Math.min(3, ((x.vol && x.vol.r >= r) ? x.vol.n : 0) + 1), r: r + 2 }; }
    if (x.vol && x.vol.r < r) x.vol = null;
    if (has(id, "puissance")) x.pui = { r: r + 2 };
    if (has(id, "recul")) e.idHalf = Math.max(e.idHalf || 0, 0.15 * E.ID_DEF);
    if (has(id, "tp")) { e.idHalf = 0.2 * E.ID_DEF; say(F, e, "Téléportation", "tp"); }
    if (has(id, "garde")) e.idGuard = r + 1;
    if (has(id, "elan") && rnd() < E.ID_DEF) e.idFirst = r + 1;
    if (has(id, "portail")) { e.idPortal = 1; say(F, e, "Portail ouvert", "portail"); }
    if (has(id, "telefrag") && rnd() < 0.3) { e.paBonus = Math.max(e.paBonus || 0, 1); parts.push("téléfrag +1 PA"); say(F, e, "Téléfrag", "telefrag"); }
    if (has(id, "relance") && rnd() < 0.3) { pa += g.pa; parts.push("relance"); say(F, e, "Relance", "relance"); }
    if (has(id, "pioche")) { x.card = (x.card || 0) + 1; parts.push(`carte ${x.card}/3`); say(F, e, `Carte ${x.card}/3`, "pioche"); }
    if (has(id, "regen")) (e.idRegen = e.idRegen || []).push({ n: 3 });
    if (has(id, "bouclier") && dealt) e.shield = Math.max(e.shield || 0, Math.round(dealt * 0.15));
    if (has(id, "soutien")) { const al = alive(F, "c").filter((a) => a.hp < a.hpMax).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (al) API().doHeal(al, al.hpMax * 0.03 * E.ID_DEF, F); }
    const bo = has(id, "bombe"); if (bo && !dealt) { const sm = F.ents[F.ents.length - 1]; const b = (x.bomb = x.bomb || { v: 0, combo: 0 }); b.combo = b.v ? b.combo + 1 : 0; b.v = Math.max(b.v, sm && sm.summon && sm.owner === idx(F, e) ? sm.dmg * 2 : 8 + e.lvl * 1.5); b.el = (g.fx.find((f) => f.el) || {}).el || null; parts.push(b.combo ? `Combo ×${b.combo}` : "bombe armée"); say(F, e, b.combo ? `Combo ×${b.combo}` : "Bombe armée", "bombe"); }
    if (has(id, "invoc")) { const s = F.ents[F.ents.length - 1]; if (s && s.summon && s.owner === idx(F, e) && !s.idB) { s.idB = 1; s.hpMax = Math.round(s.hpMax * 1.15); s.hp = s.hpMax; } }
    if (c.crit) e.idCrit = 0;
    return pa;
  };
  /* début de tour d'une entité : retardement, glyphes, bombes, régénération */
  E.idTurn = (F, e) => {
    const tn = e.idn;
    if (tn && tn.del && tn.del.length) { const L = tn.del; tn.del = []; L.forEach((d) => { if (!e.alive) return; const v = API().dealDamage(F, d.src, e, d.v, d.el); API().flog(F, `Retardement : ${e.name} −${v}`, "c"); say(F, e, "Boum !", "retard2"); }); }
    if (e.side === "c" && !e.summon) {
      const x = e.idn || {};
      if (x.bomb && x.bomb.v) { const b = x.bomb; x.bomb = null; const v = b.v * (1 + 0.25 * b.combo); const hit = alive(F, "m"); hit.forEach((m) => API().dealDamage(F, e, m, v / Math.max(1, Math.sqrt(hit.length)), b.el)); if (hit.length) { API().flog(F, `La bombe de ${e.name} explose${b.combo ? ` (Combo ×${b.combo})` : ""} !`, "c"); say(F, e, "Explosion !", "boom"); } }
      if (e.idRegen && e.idRegen.length) { e.idRegen = e.idRegen.filter((r) => { API().doHeal(e, e.hpMax * 0.02 * E.ID_DEF, F); return --r.n > 0; }); }
      if (F.idGly && F.idGly.length && F.idGlyR !== F.round) { F.idGlyR = F.round; F.idGly = F.idGly.filter((gl) => { alive(F, "m").forEach((m) => API().dealDamage(F, gl.src, m, gl.v, gl.el)); say(F, gl.src, "Glyphe", "glyphe2"); return --gl.n > 0; }); }
    }
    if (e.idGuard < F.round) e.idGuard = 0;
    return e.alive;
  };
  /* dégâts reçus : esquive, garde, piège */
  E.idDef = (F, src, tgt, v) => {
    if (tgt.idHalf && src && src.side !== tgt.side) { v *= 1 - tgt.idHalf; tgt.idHalf = 0; say(F, tgt, "Esquive"); }
    if (tgt.idGuard >= F.round) v *= 1 - 0.06 * E.ID_DEF;
    if (src && src.idn && src.idn.trap && src.side === "m" && tgt.side === "c" && !F.idTrapping) { const tr = src.idn.trap; src.idn.trap = null; F.idTrapping = 1; const d = API().dealDamage(F, tr.src, src, tr.v, tr.el); F.idTrapping = 0; API().flog(F, `Piège ! ${src.name} −${d}`, "c"); say(F, src, "Piège !", "piege2"); }
    return v;
  };
  E.idHealIn = (t, F) => (t.side === "m" && t.idn && t.idn.ero >= (F ? F.round : Infinity) ? 0.6 : 1); // 1.2.9.1 : 2 tours, plus tout le combat

  if (typeof module !== "undefined") module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
