/* ============================================================================
   IDENTITÉ DES SORTS DES MONSTRES — Idlus
   Chaque sort de monstre reçoit une mécanique tirée de son nom (Morsure → saignement,
   Souffle → zone, Glace → gel…) ou, à défaut, de ses effets et de son élément.
   Deux sorts d'un même monstre n'ont jamais la même mécanique.
   Les boss ont en plus une attaque signature : ils la préparent un tour (icône au-dessus
   d'eux), puis la lâchent sur toute l'équipe.
   Branché sur le moteur par E.midPick / midTargets / midHit / midPost / midTurn.
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  if (!E || !D) return;
  const env = (k) => { try { return typeof process !== "undefined" && process.env ? process.env[k] : undefined; } catch (e) { return undefined; } };
  if (env("NO_MID")) { E.midOn = false; return; }
  E.MID_P = +(env("MID_P") || 0.9); // force des mécaniques des monstres
  E.MID_G = +(env("MID_G") || 1); // dégâts des sorts de monstre (compensation)
  E.MID_SIG = env("NO_SIG") ? 0 : 1; // signatures des boss
  E.MID_S = +(env("MID_S") || 0.7); // force de la signature (sur toute l'équipe)

  /* mécaniques : nom affiché, phrase (fiche du Bestiaire) */
  const T = {
    saigne: { n: "Saignement", d: "La cible saigne : elle perd des PV pendant 2 tours." },
    poison: { n: "Venin", d: "Empoisonne la cible pendant 3 tours ; le venin se cumule jusqu'à 3 fois." },
    brulure: { n: "Brûlure", d: "La cible brûle au tour suivant." },
    gel: { n: "Gel", d: "Une chance sur trois de geler la cible : elle perd 1 PA." },
    zone: { n: "Zone", d: "Touche aussi un autre héros, à moitié des dégâts." },
    charge: { n: "Charge", d: "Fonce sur la deuxième ligne quand il y en a une, avec plus de force." },
    entrave: { n: "Entrave", d: "Une chance sur trois d'entraver la cible : elle joue en dernier au tour suivant." },
    vampire: { n: "Vampirisme", d: "Le monstre récupère un tiers des dégâts infligés." },
    peur: { n: "Effroi", d: "La cible tremble : elle frappe moins fort pendant 2 tours." },
    armure: { n: "Carapace", d: "Le monstre se couvre d'un bouclier." },
    rage: { n: "Rage", d: "Le monstre enrage : chaque lancer l'enhardit un peu plus (3 fois au plus)." },
    eclair: { n: "Arc", d: "Une chance sur deux de rebondir sur un deuxième héros." },
    choc: { n: "Choc", d: "La cible est sonnée : elle subit un peu plus de dégâts au tour suivant." },
    marque: { n: "Marque", d: "Marque la cible : les autres monstres la visent et la frappent plus fort." },
    soin: { n: "Régénération", d: "Le soin continue au tour suivant." },
  };
  E.MID_T = T;
  const RULES = [
    ["saigne", /morsure|mord|croc|griff|mâch|lacér|dent|étrip|entaille|lame|couteau|tranch|bec|serre|dague|épée|hache|scie|empal|éventr|équarr|déboyaut|rong|estoc|mandibul/i],
    ["poison", /poison|venin|piq|dard|toxi|spore|pestil|infect|pourri|vase|bave|acide|morve|glair|souill|crach|postillon|flatu|gerb|malsain/i],
    ["brulure", /feu|flam|brûl|incend|braise|lave|ardent|enflam|fournaise|cendre|cautér/i],
    ["gel", /glac|gel|givr|froid|neige|frim/i],
    ["zone", /souffle|vague|onde|explos|tempête|séisme|sism|trembl|pluie|nuée|tourbillon|éruption|déferl|cyclone|ouragan|averse|marée|tornade|rafale|circulaire|dispersion|rayonnement/i],
    ["charge", /charge|ruée|coup de tête|bond|saut|plong|corne|encorn|percut|bousc|piétin|écras|fonc|fougue|téméraire|impact/i],
    ["entrave", /racine|ronce|toile|lien|liane|filet|glu|coll|enlis|embourb|immobil|piège|entrav|chaîne|herbe|épineu/i],
    ["vampire", /vampir|suce|sang|drain|aspir|sangsue/i],
    ["peur", /malédic|maléfice|hant|effroi|effray|peur|terr|cauchem|ombre|ténèbre|spectr|fantôm|lugubr|sinistr|moquer|regard|provoc|fuyez/i],
    ["armure", /carapace|cuirasse|armure|écaille|coquille|protect|bouclier|blind|rempart|boutonclier/i],
    ["rage", /rage|furie|fureur|colère|frénésie|cri|hurl|rugiss|beugl|grogn|motivation|euphorie|force/i],
    ["eclair", /éclair|foudre|électr|tonnerre|orage|étincel|psych|spirit/i],
    ["choc", /pouss|poing|gifle|claque|baffe|repouss|marteau|martèl|caill|pierre|roc|frappe|coup/i],
    ["marque", /flèche|tir|lancer|vis|bigle|aveugl|trouv/i],
    ["soin", /soin|guéri|reconstit|régén|jeunesse|ron-ron/i],
  ];
  const FX_K = { dot: "poison", drain: "vampire", apdrain: "gel", weaken: "peur", vuln: "marque", shield: "armure", buff: "rage", heal: "soin", healpct: "soin", leech: "vampire" };
  const EL_K = { f: "brulure", e: "gel", t: "choc", a: "eclair", n: "saigne" };
  const ATK = ["saigne", "poison", "brulure", "gel", "zone", "charge", "entrave", "vampire", "peur", "eclair", "choc", "marque"];
  const isAtk = (sp) => sp.fx.some((f) => f.k === "dmg" || f.k === "drain" || f.k === "dot");
  const guess = (sp) => {
    const r = RULES.find(([, re]) => re.test(sp.n)); if (r && (isAtk(sp) || !ATK.includes(r[0]))) return r[0];
    const f = sp.fx.find((x) => FX_K[x.k] && x.k !== "dmg"); if (f) return FX_K[f.k];
    const d = sp.fx.find((x) => x.k === "dmg"); if (d && d.n > 1) return "zone";
    if (d) return EL_K[d.el] || "saigne";
    return isAtk(sp) ? "saigne" : "rage";
  };
  /* table : clé du monstre → nom du sort → mécanique, distincte au sein d'un monstre */
  const MID = (E.MID = {});
  const sig = {};
  for (const k in D.MONSTERS) {
    const m = D.MONSTERS[k]; const sp = m.sp || []; if (!sp.length) continue;
    const used = new Set(), row = (MID[k] = {});
    sp.forEach((s, i) => {
      let t = guess(s);
      if (used.has(t)) { const pool = isAtk(s) ? ATK : ["rage", "armure", "soin", "peur", "gel", "marque"]; const off = (s.n.length + i) % pool.length; for (let j = 0; j < pool.length; j++) { const c = pool[(off + j) % pool.length]; if (!used.has(c)) { t = c; break; } } }
      used.add(t); row[s.n] = t;
    });
    if (m.boss) { // signature : le sort de dégâts le plus fort
      const atk = sp.filter(isAtk); const avg = (s) => { const f = s.fx.find((x) => x.k === "dmg" || x.k === "drain" || x.k === "dot"); return f ? (f.min + f.max) / 2 * (f.n > 1 ? 1.3 : 1) : 0; };
      const best = atk.sort((a, b) => avg(b) - avg(a))[0]; if (best) sig[k] = best.n;
    }
  }
  E.MID_SIGS = sig;
  E.midOf = (key, n) => (MID[key] && MID[key][n]) || null;
  E.midSig = (key) => sig[key] || null;
  E.midOn = true;

  const API = () => E.fightApi;
  const rnd = () => E.rnd();
  const alive = (F, s) => F.ents.filter((x) => x.alive && x.side === s);
  const say = (F, t, idx) => F.fx.push({ seq: F.seq, k: "buff", t: F.ents.indexOf(t), txt: "", idx });
  const P = () => E.MID_P;

  /* début du tour du monstre : la signature d'un boss se prépare un tour sur trois */
  E.midTurn = (F, e) => {
    if (E.midUTurn && e.boss) E.midUTurn(F, e);
    if (!E.MID_SIG || !e.boss || !e.sp) return; const s = sig[e.key]; if (!s) return;
    e.midT = (e.midT || 0) + 1;
    if (e.midPrep) { e.midGo = e.midPrep; e.midPrep = null; return; }
    if (e.midT % 3 === 2) { e.midPrep = s; say(F, e, "m_prep"); API().flog(F, `${e.name} prépare son attaque signature…`, "m"); } // sans le nom du sort (choix 1A de la 1.2.6)
  };
  /* choix du sort : la signature préparée part en premier */
  E.midPick = (F, e, sp) => {
    if (!e.midGo || !e.sp) return sp; const s = e.sp.find((x) => x.n === e.midGo); e.midGo = null; if (!s) return sp; e.midSigNow = true; return s;
  };
  /* cibles : la signature frappe toute l'équipe ; Charge vise la deuxième ligne ; Marque attire les coups */
  E.midTargets = (F, e, sp, f, ts, targets) => {
    if (e.midSigNow) return targets.slice();
    const u = E.midU && E.midU(e, sp); if (u) return u.tgt ? u.tgt(E.midKit(F, e, null), ts, targets, f.n).filter(Boolean) : ts;
    const k = E.midOf(e.key, sp.n);
    if (k === "charge" && f.n <= 1) { const bk = targets.filter((t) => !t.summon && (t.row || "f") === "b"); if (bk.length) return [bk[Math.floor(rnd() * bk.length)]]; }
    if (f.n <= 1) { const mk = targets.find((t) => t.midMark >= F.round); if (mk && rnd() < 0.5) return [mk]; }
    return ts;
  };
  /* multiplicateur de dégâts du sort */
  E.midMul = (F, e, sp, t) => {
    let m = E.MID_G; const k = E.midOf(e.key, sp.n);
    if (e.midSigNow) m *= E.MID_S;
    const u = E.midU && E.midU(e, sp); if (u) return m * (u.mul && t ? u.mul(E.midKit(F, e, null), t) : 1);
    if (k === "charge") m *= 1 + 0.15 * P();
    if (t && t.midMark >= F.round) m *= 1 + 0.1 * P();
    if (t && t.midChoc >= F.round) m *= 1 + 0.08 * P();
    return m;
  };
  /* après chaque coup */
  E.midHit = (F, e, sp, t, d, el) => {
    const u = E.midU && E.midU(e, sp); if (u) { if (u.hit) u.hit(E.midKit(F, e, el), t, d || 0, el); return; }
    const k = E.midOf(e.key, sp.n); if (!k || !t.alive && k !== "vampire") return; const p = P(); const r = F.round;
    if (k === "saigne" && !t.noDot) { t.dots.push({ v: Math.max(1, d * 0.12 * p), turns: 2, el: null, src: e.name }); say(F, t, "m_saigne"); }
    else if (k === "poison" && !t.noDot && t.dots.filter((x) => x.mven).length < 3) { t.dots.push({ v: Math.max(1, d * 0.08 * p), turns: 3, el, src: e.name, mven: 1 }); say(F, t, "m_poison"); }
    else if (k === "brulure" && !t.noDot) { t.dots.push({ v: Math.max(1, d * 0.2 * p), turns: 1, el: "f", src: e.name }); say(F, t, "m_brulure"); }
    else if (k === "gel" && rnd() < 0.33 * p) { t.paLoss = Math.min(2, (t.paLoss || 0) + 1); say(F, t, "m_gel"); }
    else if (k === "entrave" && rnd() < 0.33 * p) { t.slowR = r + 1; say(F, t, "m_entrave"); }
    else if (k === "vampire") { API().doHeal(e, d * 0.33 * p, F); say(F, e, "m_vampire"); }
    else if (k === "peur") { t.debuffs.push({ weak: Math.round(8 * p), turns: 2 }); say(F, t, "m_peur"); }
    else if (k === "choc") { t.midChoc = r + 1; say(F, t, "m_choc"); }
    else if (k === "marque") { t.midMark = r + 1; say(F, t, "m_marque"); }
  };
  /* après le sort : Zone et Arc touchent un héros de plus, Rage, Carapace, Régénération */
  E.midPost = (F, e, sp, base, el, hitT) => {
    const k = E.midOf(e.key, sp.n); const p = P(); const sigNow = e.midSigNow; e.midSigNow = false;
    if (sigNow) say(F, e, "m_sig");
    const u = E.midU && E.midU(e, sp); if (u) { if (u.post) u.post(E.midKit(F, e, el), hitT || [], base); return; }
    if (!k) return;
    if ((k === "zone" || (k === "eclair" && rnd() < 0.5)) && base > 0 && !sigNow) {
      const o = alive(F, "c").filter((t) => !hitT.includes(t)); if (o.length) { const t = o[Math.floor(rnd() * o.length)]; const d = API().dealDamage(F, e, t, base * (k === "zone" ? 0.5 : 0.6) * p, el); say(F, t, k === "zone" ? "m_zone" : "m_eclair"); E.midHit(F, e, sp, t, d, el); }
    }
    if (k === "rage") { const n = e.buffs.filter((b) => b.mrage).length; if (n < 3) e.buffs.push({ mdmg: Math.round(6 * p), turns: 99, mrage: 1 }); say(F, e, "m_rage"); }
    if (k === "armure") { e.shield = Math.max(e.shield || 0, Math.round(e.hpMax * 0.06 * p)); say(F, e, "m_armure"); }
    if (k === "soin") { const t = alive(F, "m").sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0]; if (t && t.hp < t.hpMax) { API().doHeal(t, t.hpMax * 0.04 * p, F); say(F, t, "m_soin"); } }
  };
  /* fiche du Bestiaire : mécaniques des sorts d'un monstre */
  E.midText = (key) => { const m = D.MONSTERS[key]; if (!m || !m.sp) return []; return m.sp.map((s) => { const k = E.midOf(key, s.n); const u = E.MID_U && E.MID_U[key]; if (u && u.sp === s.n) return { sp: s.n, k: "uniq", n: u.n, d: u.d, sig: sig[key] === s.n, uniq: true }; return k ? { sp: s.n, k, n: T[k].n, d: T[k].d, sig: sig[key] === s.n } : null; }).filter(Boolean); };
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
