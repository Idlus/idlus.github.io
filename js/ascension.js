/* ============================================================================
   L'ASCENSION — Idlus (1.1), mode solo « rogue » (choix de Mathis, maquette https://claude.ai/artifact/H6JCvoGzGAXmphiifBgKnn)
   - Un héros neuf pour chaque montée : 3 classes tirées au hasard (1 relance par jour), puis 3 sorts de niveau 1
     choisis parmi 6 piochés dans toutes les classes, plus le sort signature de la classe (toujours gardé).
   - La tour du mois : 100 étages (Normal et Difficile), la même pour tous, remise à zéro le 1er du mois.
     Après l'étage 100 en Normal : l'Au-delà, des étages infinis remis à zéro chaque lundi.
   - Tous les 5 étages : 1 sort parmi 3, de plus en plus rares (6 sorts au plus ; un sort repris monte de niveau, 3 au plus).
     3 sorts d'une même classe donnent son « écho » (un bonus nommé d'après son passif) ; quelques combos cachés.
   - Étages spéciaux : boss tous les 10 étages (un boss de donjon, son âme peut être capturée), prisonnier ou mercenaire
     (recrue, 2 au plus), marchand, autel maudit. Une règle par étage (sauf ceux qui finissent par 5 ou 0).
   - Une vie et un Sursis par montée. Les ennemis gardent leurs blessures d'un essai à l'autre (tout le mois).
   - Volonté : 30 au plus, +1 toutes les 20 min (même hors ligne, plus vite avec le Sablier), 1 par essai sur un étage
     pas encore réussi ce mois-ci. Fioles de Volonté (+5) gagnées ailleurs dans le jeu.
   - Manuel par défaut (la tour attend tes choix) ; en auto elle choisit seule, avec −30 % de Fragments sur ces étages.
   - Fragments (permanents) : pioche de sorts, classes de départ, bonus de départ, boss du bestiaire.
     Écus de l'Ascension : boutique d'apparences et de titres. Rien ne donne de puissance dans le jeu principal.
   Les combats se jouent sur une partie de travail à part (comme le Kolizéum) : aucun effet sur l'équipe du joueur.
   Pas de DOM ici : l'interface est dans js/ascensionui.js. Chargé aussi par les tests et le simulateur.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const { CLASSES, MONSTERS, DUNGEONS, STATS } = D;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const seeded = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- réglages ---------- */
  const A = E.ASC = {
    floors: 100, volMax: 30, volMs: 20 * 60000, fiole: 5, fioleId: "fiole_volonte",
    spellMax: 6, spellLvMax: 3, every: 5, start: 6, keep: 3, recruitsMax: 2, sursis: 1,
    autoFrag: 0.7,                 // en auto : −30 % de Fragments
    heroHp: 2, heroPui: 20, heroPuiLv: 2, bossHp: 2.5, bossDmg: 0.7, resCap: 25, monHpLv: 0.014, monDmgLv: 0.007, // le grimpeur est seul : bénédiction de la Tour (réglée par tools/ascension_sim.js)
    stepMs: 260,                   // un pas de combat affiché (l'interface)
    fightPauseMs: 1500,            // pause entre deux étages
    autoPickMs: 30000,             // l'auto choisit après ce délai si personne ne le fait
    souls: { turns: 3, pow: 0.5, cd: 4 },
    soulCost: 150,                 // Fragments pour mettre un boss du bestiaire dans la pioche
  };
  E.ASC_MODES = { n: "Normal", d: "Difficile", x: "Au-delà" };

  /* ---------- dates : la tour du mois, l'Au-delà de la semaine ---------- */
  E.ascMonth = (t = E.now()) => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  E.ascMonthEnd = (t = E.now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
  E.ascMonthName = (m) => ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][((m % 12) + 12) % 12];
  E.ascDay = (t = E.now()) => Math.floor(t / 86400000);

  /* ---------- les sorts : tous ceux des 19 classes ---------- */
  let ALL = null;
  E.ascSpells = () => {
    if (ALL) return ALL;
    ALL = [];
    D.CLASS_ORDER.forEach((cls) => (CLASSES[cls] ? CLASSES[cls].spells : []).forEach((s) => {
      if (!s.grades || !s.grades.length) return;
      const g = s.grades[0]; const kind = E.spellKind(g);
      ALL.push({ k: `${cls}:${s.id}`, cls, id: s.id, name: s.name, icon: s.icon, lvl: s.lvl, el: s.el || null, kind, pa: g.pa });
    }));
    return ALL;
  };
  E.ascSpell = (k) => E.ascSpells().find((x) => x.k === k) || null;
  /* sort signature d'une classe : son premier sort de niveau 1 qui fait des dégâts */
  E.ascSignature = (cls) => { const L = E.ascSpells().filter((x) => x.cls === cls && x.lvl <= 1); return (L.find((x) => ["dmg", "aoe", "drain"].includes(x.kind)) || L[0] || {}).k || null; };
  /* raretés : selon l'écart entre le niveau du sort et celui du héros */
  E.ASC_RAR = { c: { name: "Commun", w: 60 }, r: { name: "Rare", w: 28 }, e: { name: "Épique", w: 10 }, l: { name: "Légendaire", w: 2 } };
  E.ascRarity = (sp, lvl) => { const d = sp.lvl / Math.max(1, lvl); return sp.lvl >= 150 && d > 0.8 ? "l" : d > 0.75 ? "e" : d > 0.45 ? "r" : "c"; };

  /* ---------- l'« écho » de classe : 3 sorts d'une classe (choix 5A) ---------- */
  /* fx : pui (% dégâts), hp (% PV), cri (% critique), res (résistances), ini (joue en premier), pa (PA), heal (% soins reçus) */
  E.ASC_ECHO = {
    feca: { fx: { res: 12 }, d: "+12 % de résistances" }, osa: { fx: { hp: 12 }, d: "+12 % de PV" }, enu: { fx: { pui: 8, cri: 4 }, d: "+8 % de dégâts, +4 % de critique" },
    sram: { fx: { cri: 10 }, d: "+10 % de critique" }, xelor: { fx: { ini: 1, pui: 5 }, d: "Joue en premier, +5 % de dégâts" }, eca: { fx: { cri: 8, pui: 4 }, d: "+8 % de critique, +4 % de dégâts" },
    eni: { fx: { hp: 8, res: 5 }, d: "+8 % de PV, +5 % de résistances" }, iop: { fx: { pui: 12 }, d: "+12 % de dégâts" }, cra: { fx: { ini: 1, cri: 5 }, d: "Joue en premier, +5 % de critique" },
    sadi: { fx: { hp: 10, pui: 4 }, d: "+10 % de PV, +4 % de dégâts" }, sacri: { fx: { hp: 15 }, d: "+15 % de PV" }, panda: { fx: { res: 8, hp: 6 }, d: "+8 % de résistances, +6 % de PV" },
    roub: { fx: { pui: 10 }, d: "+10 % de dégâts" }, zobal: { fx: { res: 6, pui: 6 }, d: "+6 % de résistances, +6 % de dégâts" }, steam: { fx: { hp: 8, pui: 6 }, d: "+8 % de PV, +6 % de dégâts" },
    elio: { fx: { pui: 7, cri: 5 }, d: "+7 % de dégâts, +5 % de critique" }, hupper: { fx: { pui: 9, res: 4 }, d: "+9 % de dégâts, +4 % de résistances" },
    ougi: { fx: { pui: 8, hp: 6 }, d: "+8 % de dégâts, +6 % de PV" }, forge: { fx: { res: 10, pui: 4 }, d: "+10 % de résistances, +4 % de dégâts" },
  };
  /* combos cachés : deux classes à 2 sorts chacune */
  E.ASC_COMBOS = [
    { id: "tirdebarrage", a: "iop", b: "cra", name: "Tir de barrage", fx: { pui: 10, cri: 5 } },
    { id: "sablierdore", a: "xelor", b: "eca", name: "Sablier doré", fx: { pa: 1 } },
    { id: "pactedes", a: "sacri", b: "eni", name: "Pacte des contraires", fx: { hp: 15, res: 5 } },
    { id: "ruche", a: "osa", b: "sadi", name: "Ruche sauvage", fx: { hp: 10, pui: 8 } },
    { id: "contrebande", a: "sram", b: "roub", name: "Contrebande", fx: { cri: 12 } },
    { id: "rempart", a: "feca", b: "forge", name: "Rempart", fx: { res: 15 } },
  ];
  E.ascClassCount = (R) => { const n = {}; (R.spells || []).forEach((s) => { const c = s.k.split(":")[0]; n[c] = (n[c] || 0) + 1; }); return n; };
  E.ascEchoes = (R) => { const n = E.ascClassCount(R); return Object.keys(n).filter((c) => n[c] >= 3 && E.ASC_ECHO[c]); };
  E.ascCombos = (R) => { const n = E.ascClassCount(R); return E.ASC_COMBOS.filter((x) => (n[x.a] || 0) >= 2 && (n[x.b] || 0) >= 2); };

  /* ---------- glyphes (choix 18A) : posés sur un sort, 2 au plus, perdus en fin de montée ---------- */
  E.ASC_GLYPHS = {
    rapide: { name: "Rapide", d: "−1 PA (1 au moins)" },
    vampire: { name: "Vampire", d: "Le sort vole de la vie" },
    echo: { name: "Écho", d: "+1 lancer par tour" },
    fendoir: { name: "Fendoir", d: "+15 % de dégâts" },
    ancre: { name: "Ancre", d: "Effets qui durent 1 tour de plus" },
  };
  /* le sort tel qu'il est joué : niveau du sort (×1,2 / ×1,4 et −1 PA au niveau 3) et glyphes */
  E.ascDef = (x) => {
    const [cls, id] = x.k.split(":"); const base = CLASSES[cls] && CLASSES[cls].spells.find((s) => s.id === id); if (!base) return null;
    const gl = x.gl || []; const lv = x.lv || 1; const m = (lv >= 3 ? 1.4 : lv >= 2 ? 1.2 : 1) * (gl.includes("fendoir") ? 1.15 : 1);
    const grades = base.grades.map((g) => Object.assign({}, g, {
      pa: Math.max(1, g.pa - (gl.includes("rapide") ? 1 : 0) - (lv >= 3 ? 1 : 0)),
      casts: g.casts ? g.casts + (gl.includes("echo") ? 1 : 0) : g.casts,
      fx: g.fx.map((f) => {
        const o = Object.assign({}, f);
        if (o.min !== undefined && ["dmg", "drain", "dot", "heal"].includes(o.k)) { o.min = Math.round(o.min * m); o.max = Math.round(o.max * m); }
        if (gl.includes("vampire") && o.k === "dmg") o.k = "drain";
        if (gl.includes("ancre") && o.t) o.t += 1;
        return o;
      }),
    }));
    return Object.assign({}, base, { id: x.k, grades, ascLv: lv, ascGl: gl.slice() });
  };
  /* le moteur cherche les sorts par classe ; ceux de l'Ascension ont un id « a~<n> » (n = place dans la barre du combat en cours) */
  E.ASC_DEFS = [];
  const sd0 = E.spellDef;
  E.spellDef = (cls, id) => (typeof id === "string" && id.charCodeAt(0) === 97 && id.startsWith("a~") ? E.ASC_DEFS[+id.slice(2)] || null : sd0(cls, id));

  /* ---------- règles d'étage (choix 16A : règles inédites, plus quelques classiques) ---------- */
  /* fn(F, hero, mons, W) au début du combat ; round(F, W) à chaque nouveau tour ; die(F, m, W) quand un monstre tombe */
  E.ASC_RULES = {
    pacte: { name: "Pacte de sang", ic: "🩸", d: "Tes sorts font +40 % de dégâts, mais tu perds 4 % de tes PV à chaque tour." },
    maree: { name: "Marée montante", ic: "🌊", d: "Les ennemis font +5 % de dégâts de plus à chaque tour." },
    silence: { name: "Silence", ic: "🤫", d: "Ton sort le plus utilisé est interdit sur cet étage." },
    element: { name: "Un seul élément", ic: "🎯", d: "Seuls les sorts de l'élément de ton premier sort sont utilisables." },
    brouillard: { name: "Brouillard", ic: "🌫", d: "Les PV des ennemis sont cachés." },
    dette: { name: "Dette", ic: "📜", d: "Cet étage est plus facile (−20 % de PV ennemis), le suivant a +30 % de PV ennemis." },
    greve: { name: "Recrues en grève", ic: "✋", d: "Tes recrues ne combattent pas, mais tu fais +25 % de dégâts." },
    eclats: { name: "Éclats fragiles", ic: "💥", d: "Un ennemi qui tombe explose : 15 % de ses PV en dégâts à chaque autre combattant." },
    echange: { name: "Échange d'âmes", ic: "🔄", d: "Au tour 3, ta part de PV et celle de l'ennemi le plus fort sont échangées." },
    halouine: { name: "Nuit d'Halouine", ic: "🎃", d: "Les ennemis reviennent une fois à 30 % de PV.", hal: true },
    pa: { name: "Fatigue", ic: "⚡", d: "−1 PA pour toi sur cet étage." },
    blindes: { name: "Blindés", ic: "🛡", d: "Les ennemis commencent avec un bouclier de 15 % de leurs PV." },
    vampires: { name: "Vampires", ic: "🦇", d: "Les ennemis volent 15 % des dégâts qu'ils font." },
    veloces: { name: "Véloces", ic: "💨", d: "Les ennemis jouent avant toi." },
    nombreux: { name: "Nombreux", ic: "👥", d: "Un ennemi de plus." },
    geants: { name: "Géants", ic: "⛰", d: "Un ennemi de moins, mais +40 % de PV pour les autres." },
  };
  const RULE_POOL = Object.keys(E.ASC_RULES).filter((k) => !E.ASC_RULES[k].hal);

  /* ---------- la tour du mois ---------- */
  /* niveau du héros et des monstres à l'étage f (choix : un étage = 2 niveaux, 200 à l'étage 100 et dans l'Au-delà) */
  E.ascLvl = (f) => clamp(f * 2 - 1, 1, 200);
  const monPools = {};
  const monPool = (L) => {
    const b = Math.round(L / 5) * 5; if (monPools[b]) return monPools[b];
    const zone = E.ASC_ZMONS || (E.ASC_ZMONS = new Set(D.ZONES.flatMap((z) => z.subs.flatMap((x) => x.monsters || []))));
    let pool = Object.keys(MONSTERS).filter((k) => { const m = MONSTERS[k]; return zone.has(k) && !m.boss && !m.archi && !m.archiOf && m.img && m.lvl && m.lvl[0] <= b + 6 && m.lvl[1] >= b - 12 && m.sp; });
    if (pool.length < 6) pool = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].boss && MONSTERS[k].img && MONSTERS[k].lvl).sort((x, y) => Math.abs(MONSTERS[x].lvl[0] - b) - Math.abs(MONSTERS[y].lvl[0] - b)).slice(0, 30);
    return (monPools[b] = pool);
  };
  const bossList = () => Object.keys(DUNGEONS).filter((d) => MONSTERS[DUNGEONS[d].boss]).map((d) => ({ d, boss: DUNGEONS[d].boss, lvl: DUNGEONS[d].lvl })).sort((a, b) => a.lvl - b.lvl);
  E.ascBossFor = (L, r) => { const B = bossList(); const near = B.filter((x) => Math.abs(x.lvl - L) <= 15); const P = near.length ? near : B.slice().sort((a, b) => Math.abs(a.lvl - L) - Math.abs(b.lvl - L)).slice(0, 3); return P[Math.floor(r() * P.length)]; };
  const towerCache = {};
  /* un étage : { f, t: fight|boss|event|shop|altar, rule, mobs, boss, lvl } ; même tour pour tous (graine du mois et du mode) */
  E.ascFloorAt = (key, f, hal) => {
    const r = seeded(hash(`idlus|ascension|${key}|${f}`));
    const lvl = E.ascLvl(f); const dec = f % 10;
    let t = "fight";
    if (dec === 0) t = "boss";
    else if (dec !== 5) { const d = Math.floor((f - 1) / 10); const ev = 1 + ((hash(`ev|${key}|${d}`) >>> 3) % 4); const sh = 6 + ((hash(`sh|${key}|${d}`) >>> 5) % 4);
      if (dec === ev && f > 1) t = "event"; else if (dec === sh) t = d % 2 ? "altar" : "shop"; }
    const fl = { f, t, lvl, rule: null, mobs: [], boss: null };
    if (t === "fight" && dec !== 5 && f > 2) { const pool = RULE_POOL.concat(hal ? ["halouine"] : []); fl.rule = pool[Math.floor(r() * pool.length)]; }
    if (t === "fight") { const P = monPool(lvl); const n = clamp(2 + Math.floor(f / 30) + (r() < 0.35 ? 1 : 0), 2, 5); for (let i = 0; i < n; i++) fl.mobs.push(P[Math.floor(r() * P.length)]); }
    if (t === "boss") { const b = E.ascBossFor(lvl, r); fl.boss = b.boss; fl.did = b.d; const dg = DUNGEONS[b.d]; const P = (dg.bossMobs || []).filter((k) => MONSTERS[k]); const n = 1 + Math.floor(f / 40); for (let i = 0; i < n; i++) fl.mobs.push(P.length ? P[Math.floor(r() * P.length)] : monPool(lvl)[0]); }
    if (t === "event") fl.ev = ["prisoner", "merc", "tame"][Math.floor(r() * 3)];
    return fl;
  };
  E.ascKey = (S, mode, t = E.now()) => (mode === "x" ? `x${E.weekIdx(t)}` : `${mode}${E.ascMonth(t)}`);
  E.ascFloor = (S, mode, f, t = E.now()) => { const key = E.ascKey(S, mode, t); const ck = key + "|" + f; if (towerCache[ck]) return towerCache[ck];
    return (towerCache[ck] = E.ascFloorAt(key, f, !!(E.halWin && E.halWin(t)))); };
  /* difficulté : PV et dégâts des monstres (réglés par simulation, tools/simulate.js --ascension) */
  E.ASC_DIFF = { n: { hp: 1, dmg: 1 }, d: { hp: 1.3, dmg: 1.2 }, x: { hp: 0.8, dmg: 0.8 } };
  E.ascMult = (mode, f) => { const B = E.ASC_DIFF[mode] || E.ASC_DIFF.n; const k = mode === "x" ? Math.pow(1.04, Math.max(0, f - 100)) : 1; const L = E.ascLvl(f); const g = (x) => 1 / (1 + L * x); // sans équipement : les monstres sont taillés pour un grimpeur nu
    return { hp: B.hp * k * (0.9 + f * 0.004) * g(A.monHpLv), dmg: B.dmg * Math.sqrt(k) * (0.9 + f * 0.003) * g(A.monDmgLv) }; };

  /* ---------- l'état ---------- */
  E.ascState = (S) => {
    if (!S.asc) S.asc = { m: E.ascMonth(), w: E.weekIdx(), best: { n: 0, d: 0, x: 100 }, wounds: {}, vol: A.volMax, volT: E.now(), volAcc: 0, frag: 0, ecus: 0,
      unl: { pool: [], cls: [], start: 0, bonus: {} }, best0: 0, bestiary: {}, souls: [], run: null, auto: false, prio: "dmg", roll: { d: 0, n: 0 }, runs: 0, titles: [], hist: [] };
    const Q = S.asc;
    if (Q.m !== E.ascMonth()) { Q.m = E.ascMonth(); Q.best.n = 0; Q.best.d = 0; Q.wounds = {}; Q.chest = {}; if (Q.run && Q.run.mode !== "x") E.ascEnd(S, "reset"); } // 1.1.0.1 : la montée en cours rend ses Fragments et Écus au changement de mois
    if (Q.w !== E.weekIdx()) { Q.w = E.weekIdx(); Q.best.x = 100; Object.keys(Q.wounds).forEach((k) => { if (k[0] === "x") delete Q.wounds[k]; }); if (Q.run && Q.run.mode === "x") E.ascEnd(S, "reset"); }
    return Q;
  };
  /* classes que le tirage peut sortir : 12 au départ, les autres avec des Fragments */
  E.ASC_BASE_CLS = ["iop", "cra", "eni", "feca", "sram", "xelor", "eca", "sadi", "sacri", "panda", "osa", "enu"];
  E.ascClsPool = (Q) => E.ASC_BASE_CLS.concat(Q.unl.cls || []);
  /* classes dont les sorts de niveau 1 sont dans la pioche de départ : 12 au départ aussi */
  E.ascSpellCls = (Q) => E.ASC_BASE_CLS.concat(Q.unl.pool || []);

  /* ---------- Volonté ---------- */
  E.ascVolSync = (S, t = E.now()) => { const Q = E.ascState(S);
    if (Q.vol >= A.volMax) { Q.volT = t; return Q.vol; }
    const ms = E.ascVolMs(S); const n = Math.floor((t - Q.volT) / ms); if (n > 0) { Q.vol = Math.min(A.volMax, Q.vol + n); Q.volT = Q.vol >= A.volMax ? t : Q.volT + n * ms; }
    return Q.vol; };
  E.ascVolNext = (S, t = E.now()) => { const Q = E.ascState(S); return Q.vol >= A.volMax ? 0 : Math.max(0, Q.volT + E.ascVolMs(S) - t); };
  /* bonus de guilde (Fiole F) : +1 Volonté par heure, soit une toutes les 15 minutes au lieu de 20 */
  E.ascGuild = (S) => !!(S.guild && S.guild.id);
  E.ascVolMs = (S) => (E.ascGuild(S) ? 15 * 60000 : A.volMs);
  E.ascFioles = (S) => (S.cons && S.cons[A.fioleId]) || 0;
  E.ascDrink = (S) => { const Q = E.ascState(S); if (E.ascFioles(S) < 1) return "Tu n'as pas de Fiole de Volonté.";
    if (Q.vol >= A.volMax) return "Ta Volonté est déjà pleine.";
    S.cons[A.fioleId]--; if (!S.cons[A.fioleId]) delete S.cons[A.fioleId]; Q.vol = Math.min(A.volMax + A.fiole, Q.vol + A.fiole); return null; };
  /* un essai coûte 1, sauf sur un étage déjà réussi ce mois-ci (cette semaine pour l'Au-delà) */
  E.ascCost = (S, mode, f) => { const Q = E.ascState(S); return f <= (Q.best[mode] || 0) ? 0 : 1; };

  /* ---------- une montée ---------- */
  const dayRng = (S, salt) => seeded(hash(`idlus|asc|${E.ascDay()}|${(S.chars[0] && S.chars[0].name) || ""}|${salt}`));
  E.ascClassChoices = (S) => { const Q = E.ascState(S); if (Q.roll.d !== E.ascDay()) Q.roll = { d: E.ascDay(), n: 0 };
    return shuffle(E.ascClsPool(Q), dayRng(S, "cls" + Q.roll.n + "|" + Q.runs)).slice(0, 3); };
  E.ascReroll = (S) => { const Q = E.ascState(S); E.ascClassChoices(S); if (Q.roll.n >= 1) return "Une seule relance par jour."; if (Q.run) return "Une montée est déjà en cours.";
    Q.roll.n++; return null; };
  E.ascCanStart = (S, mode) => { const Q = E.ascState(S);
    if (Q.run) return "Une montée est déjà en cours.";
    if (mode === "x" && (Q.best0 || 0) < 100 && Q.best.n < 100) return "L'Au-delà s'ouvre après l'étage 100 de la tour en Normal.";
    if (!E.ASC_MODES[mode]) return "Mode inconnu.";
    return null; };
  /* départ : classe choisie parmi les 3 du jour */
  E.ascStart = (S, mode, cls) => {
    const Q = E.ascState(S); const err = E.ascCanStart(S, mode); if (err) return err;
    if (!E.ascClassChoices(S).includes(cls)) return "Choisis une des 3 classes proposées.";
    const sig = E.ascSignature(cls);
    Q.runs++; Q.run = { mode, cls, f: mode === "x" ? 101 : 1, t0: E.now(), spells: sig ? [{ k: sig, lv: 1, gl: [], sig: 1 }] : [], sursis: A.sursis + ((Q.unl.bonus || {}).sursis ? 1 : 0),
      recruits: [], soul: null, frag: 0, ecus: 0, auto: 0, fights: 0, used: {}, top: mode === "x" ? 100 : 0, extra: mode === "x" ? 8 : 0, dette: 0, curse: 0, log: [], pend: null, at: E.now(), pause: 0 };
    if (Q.unl.bonus && Q.unl.bonus.glyph) Q.run.glyphs = [pickOf(Object.keys(E.ASC_GLYPHS), seeded(Q.runs * 977))];
    Q.run.pend = { t: "start", opts: E.ascStartChoices(S), at: E.now() };
    return null;
  };
  const pickOf = (a, r) => a[Math.floor(r() * a.length)];
  /* 6 sorts de niveau 1 de toutes les classes de la pioche (hors classe du héros, déjà servie par son sort signature) */
  E.ascStartChoices = (S) => { const Q = E.ascState(S); const R = Q.run; const pool = E.ascSpells().filter((x) => x.lvl <= 1 && x.cls !== R.cls && E.ascSpellCls(Q).includes(x.cls) && x.kind !== "summon");
    return shuffle(pool, seeded(hash(`start|${Q.runs}|${E.ascDay()}`))).slice(0, A.start).map((x) => x.k); };
  /* tirage d'un palier : 3 sorts, raretés pondérées, sorts du niveau du héros au plus ; un sort possédé peut revenir (il monte de niveau) */
  E.ascPickChoices = (S) => {
    const Q = E.ascState(S); const R = Q.run; const L = E.ascLvl(R.f); const r = seeded(hash(`pick|${Q.runs}|${R.f}|${R.fights}`));
    const allowed = new Set(E.ascSpellCls(Q).concat([R.cls]));
    const souls = (Q.souls || []).map((b) => "soul:" + b);
    const pool = E.ascSpells().filter((x) => x.lvl <= L && allowed.has(x.cls) && x.kind !== "summon");
    const out = []; const W = E.ASC_RAR;
    for (let g = 0; out.length < 3 && g < 200; g++) {
      let roll = r() * 100, rar = "c"; for (const k of ["l", "e", "r", "c"]) { if (roll < W[k].w) { rar = k; break; } roll -= W[k].w; }
      const P = pool.filter((x) => E.ascRarity(x, L) === rar && !out.includes(x.k)); if (!P.length) continue;
      const own = R.spells.filter((s) => !s.soul && (s.lv || 1) < A.spellLvMax).map((s) => s.k);
      const k = own.length && r() < 0.2 ? pickOf(own, r) : pickOf(P, r).k;
      if (!out.includes(k)) out.push(k);
    }
    if (souls.length && r() < 0.15 && !R.spells.some((s) => s.soul)) out[2] = pickOf(souls, r); // un boss du bestiaire (acheté avec des Fragments)
    return out;
  };

  /* ---------- choix en attente ---------- */
  const fin = (S, R) => { R.pend = null; R.at = E.now(); // l'Au-delà commence à l'étage 101 : 3 tirages de sorts de plus avant le premier combat
    if (R.extra > 0) { R.extra--; R.pend = { t: "pick", opts: E.ascPickChoices(S), at: E.now() }; } };
  E.ascChoose = (S, i, j) => {
    const Q = E.ascState(S); const R = Q.run; if (!R || !R.pend) return "Rien à choisir.";
    const P = R.pend;
    if (P.t === "start") {
      const sel = Array.isArray(i) ? i : [i]; if (sel.length !== A.keep || new Set(sel).size !== A.keep || sel.some((x) => !P.opts[x])) return `Choisis ${A.keep} sorts.`;
      sel.forEach((x) => R.spells.push({ k: P.opts[x], lv: 1, gl: [] }));
      (R.glyphs || []).forEach((g) => { const s = R.spells[0]; if (s && s.gl.length < 2) s.gl.push(g); }); R.glyphs = [];
      fin(S, R); return null;
    }
    if (P.t === "pick") {
      if (i === -1) { fin(S, R); return null; } // passer
      const k = P.opts[i]; if (!k) return "Choix inconnu.";
      if (k.startsWith("soul:")) return E.ascTakeSoul(S, k.slice(5), j);
      const own = R.spells.find((s) => s.k === k);
      if (own) { own.lv = Math.min(A.spellLvMax, (own.lv || 1) + 1); fin(S, R); return null; }
      if (R.spells.length >= A.spellMax) { const s = R.spells[j]; if (!s) return "Choisis le sort à remplacer."; if (s.sig) return "Le sort signature ne peut pas être remplacé."; R.spells.splice(j, 1); }
      R.spells.push({ k, lv: 1, gl: [] }); fin(S, R); return null;
    }
    if (P.t === "soul") { // âme capturée sur un boss (choix 21A)
      if (i === -1) { fin(S, R); return null; }
      return E.ascTakeSoul(S, P.boss, j);
    }
    if (P.t === "glyph") {
      if (i === -1) { fin(S, R); return null; }
      const s = R.spells[i]; if (!s || s.soul) return "Choisis un sort.";
      if ((s.gl || []).length >= 2) return "2 glyphes au plus par sort.";
      if (s.gl.includes(P.g)) return "Ce sort a déjà ce glyphe.";
      s.gl.push(P.g); fin(S, R); return null;
    }
    if (P.t === "event") return E.ascEvent(S, i);
    if (P.t === "shop") return E.ascShop(S, i, j);
    if (P.t === "altar") { if (i === 1) { R.curse = Math.max(R.curse, R.f + 10); const k = P.leg; if (k) { R.pend = { t: "pick", opts: [k], at: E.now(), leg: 1 }; return null; } } fin(S, R); return null; }
    return "Choix inconnu.";
  };
  E.ascTakeSoul = (S, boss, j) => {
    const Q = E.ascState(S); const R = Q.run; if (!MONSTERS[boss]) return "Âme inconnue.";
    const old = R.spells.findIndex((s) => s.soul); if (old >= 0) R.spells.splice(old, 1);
    if (R.spells.length >= A.spellMax) { const s = R.spells[j]; if (!s) return "Choisis le sort à remplacer."; if (s.sig) return "Le sort signature ne peut pas être remplacé."; R.spells.splice(j, 1); }
    R.spells.push({ k: "soul:" + boss, soul: 1, lv: 1, gl: [] }); fin(S, R); return null;
  };
  /* événements : prisonnier (gratuit), mercenaire (Fragments de la montée), monstre à apprivoiser (un combat de plus, puis il te suit) */
  E.ascEvent = (S, i) => {
    const Q = E.ascState(S); const R = Q.run; const P = R.pend; if (i === -1 || i === 1) { fin(S, R); return null; }
    if (R.recruits.length >= A.recruitsMax) return "2 recrues au plus : en voilà déjà 2.";
    if (P.ev === "merc") { if (R.frag < P.price) return `Il faut ${P.price} Fragments gagnés pendant cette montée.`; R.frag -= P.price; }
    R.recruits.push({ key: P.mon, hp: 1 }); fin(S, R); return null;
  };
  E.ASC_SHOP = [
    { id: "heal", name: "Soin des recrues", d: "Tes recrues reviennent à tous leurs PV.", price: 30 },
    { id: "glyph", name: "Glyphe", d: "Un glyphe au hasard à poser sur un sort.", price: 60 },
    { id: "pick", name: "Nouveau tirage de sorts", d: "1 sort parmi 3, tout de suite.", price: 50 },
    { id: "sursis", name: "Sursis", d: "Un Sursis de plus pour cette montée (1 fois).", price: 90 },
  ];
  E.ascShop = (S, i) => {
    const Q = E.ascState(S); const R = Q.run; if (i === -1) { fin(S, R); return null; }
    const o = E.ASC_SHOP[i]; if (!o) return "Offre inconnue.";
    if (R.frag < o.price) return `Il faut ${o.price} Fragments gagnés pendant cette montée.`;
    if (o.id === "sursis" && R.boughtSursis) return "Un seul Sursis par montée chez le marchand.";
    R.frag -= o.price;
    if (o.id === "heal") R.recruits.forEach((x) => (x.hp = 1));
    if (o.id === "sursis") { R.sursis++; R.boughtSursis = 1; }
    if (o.id === "glyph") { R.pend = { t: "glyph", g: pickOf(Object.keys(E.ASC_GLYPHS), seeded(hash(`gl|${Q.runs}|${R.f}`))), at: E.now() }; return null; }
    if (o.id === "pick") { R.pend = { t: "pick", opts: E.ascPickChoices(S), at: E.now() }; return null; }
    return null;
  };

  /* ---------- le combat ---------- */
  const mg0 = E.makeGroup;
  E.makeGroup = (S, sub, size) => (S && S.ascAtk ? S.ascAtk : mg0(S, sub, size));
  const domStat = (defs) => { const n = {}; defs.forEach((d) => { if (!d) return; const el = d.el && d.el !== "best" ? d.el : null; if (el) n[el] = (n[el] || 0) + 1; });
    const el = Object.keys(n).sort((a, b) => n[b] - n[a])[0] || "t"; return (D.ELEMENTS[el] && D.ELEMENTS[el].stat) || "fo"; };
  /* PV d'un monstre à un étage (blessures gardées : choix 15A) */
  E.ascWoundKey = (mode, f) => `${mode === "x" ? "x" : mode}${f}`;
  /* prépare un combat : renvoie W { S2, F, fl, ... } (rien n'est retiré à la partie du joueur) */
  E.ascSetup = (S, seed) => {
    const Q = E.ascState(S); const R = Q.run; if (!R) return null;
    const fl = E.ascFloor(S, R.mode, R.f); if (!["fight", "boss"].includes(fl.t)) return null;
    const rng0 = E.getRng(), evLen = E.events.length; const rng = seeded(seed >>> 0); E.setRng(rng);
    try {
      const L = fl.lvl; const S2 = E.newState("Grimpeur", R.cls); S2.journal = []; const c = S2.chars[0]; c.name = (S.chars[0] && S.chars[0].name) || "Grimpeur";
      c.head = (S.chars[0] && S.chars[0].head) || 0; c.sex = (S.chars[0] && S.chars[0].sex) || c.sex;
      const rule = fl.rule; const bar = R.spells.filter((s) => !s.soul);
      let list = bar.map((s) => s);
      if (rule === "silence" && list.length > 1) { const top = list.slice().sort((a, b) => (R.used[b.k] || 0) - (R.used[a.k] || 0))[0]; list = list.filter((s) => s !== top); }
      E.ASC_DEFS = list.map((s) => E.ascDef(s));
      if (rule === "element") { const el = (E.ASC_DEFS[0] || {}).el; const keep = E.ASC_DEFS.map((d, i) => (d && (d.el === el || !d.el || d.el === "best") ? i : -1)).filter((i) => i >= 0); list = keep.map((i) => list[i]); E.ASC_DEFS = keep.map((i) => E.ASC_DEFS[i]); }
      c.lvl = L; c.autoStat = domStat(E.ASC_DEFS); E.resetPoints(S2, c.id);
      c.spells = E.ASC_DEFS.map((d, i) => ({ id: "a~" + i, cond: d ? E.defaultCond(d, c) : "always", tgt: "low" }));
      /* monstres */
      const M = E.ascMult(R.mode, R.f); const mons = [];
      const geants = rule === "geants"; const mobs = fl.mobs.slice(0, geants ? Math.max(1, fl.mobs.length - 1) : 9);
      if (rule === "nombreux") mobs.push(mobs[0]);
      if (fl.t === "boss") { const b = E.monsterEntity(fl.boss, L + 2); const ref = E.monsterEntity(monPool(L)[0], L); // un boss taillé pour un grimpeur seul
        b.hpMax = b.hp = Math.round(ref.hpMax * A.bossHp); b.dmg = ref.dmg * A.bossDmg; b.mech = E.bossMechs ? E.bossMechs(fl.did) : []; b.mturn = 0; mons.push(b); }
      mobs.forEach((k) => mons.push(E.monsterEntity(k, L - (fl.t === "boss" ? 2 : 0))));
      const debt = R.dette === R.f ? 1.3 : 1; const easy = rule === "dette" ? 0.8 : 1; const curse = R.curse >= R.f ? 1.2 : 1;
      mons.forEach((m) => { m.res = Object.fromEntries(Object.entries(m.res || {}).map(([k, v]) => [k, Math.min(A.resCap, v)])); // seul avec 1 ou 2 éléments : pas de monstre immunisé
        if (m.sp) m.sp = m.sp.map((x) => ({ ...x, fx: (x.fx || []).map((f) => (f.k === "shield" ? { ...f, pct: Math.min(f.pct || 0, 8) } : f.k === "healpct" ? { ...f, v: Math.min(f.v || 0, 8) } : f)) })); // boucliers et soins à la taille d'un duel
        m.hpMax = m.hp = Math.round(m.hpMax * M.hp * debt * easy * curse * (geants ? 1.4 : 1)); m.dmg *= M.dmg;
        if (rule === "blindes") m.shield = Math.round(m.hpMax * 0.15); if (rule === "vampires") m.vamp = 0.15; if (rule === "veloces") m.ini += 1e6; });
      S2.ascAtk = mons; S2.sub = E.ASC_SUB || (E.ASC_SUB = Object.keys(E.SUBS)[0]); S2.hunting = true; S2.settings.manual = false;
      const F = E.startFight(S2); if (!F) return null;
      F.label = `${E.ASC_MODES[R.mode]} · étage ${R.f}`; F.asc = 1;
      const hero = F.ents.find((e) => e.side === "c" && !e.summon);
      /* blessures gardées */
      const wk = E.ascWoundKey(R.mode, R.f); const wd = Q.wounds[wk];
      if (wd) F.ents.filter((e) => e.side === "m").forEach((m, i) => { const p = wd.hp[i]; if (p !== undefined) { m.hp = Math.max(1, Math.round(m.hpMax * p)); if (p <= 0) { m.hp = 0; m.alive = false; } } });
      /* échos de classe et combos */
      const fx = {}; E.ascEchoes(R).forEach((k) => Object.entries(E.ASC_ECHO[k].fx).forEach(([a, v]) => (fx[a] = (fx[a] || 0) + v)));
      E.ascCombos(R).forEach((x) => Object.entries(x.fx).forEach(([a, v]) => (fx[a] = (fx[a] || 0) + v)));
      if (rule === "pacte") fx.pui = (fx.pui || 0) + 40; if (rule === "greve") fx.pui = (fx.pui || 0) + 25;
      hero.st = Object.assign({}, hero.st); hero.hpMax = hero.hp = Math.round(hero.hpMax * A.heroHp); fx.pui = (fx.pui || 0) + A.heroPui + A.heroPuiLv * L;
      if (fx.pui) hero.st.pui = (hero.st.pui || 0) + fx.pui;
      if (fx.cri) hero.st.cri = (hero.st.cri || 0) + fx.cri;
      if (fx.pa) hero.st.pa += fx.pa; if (rule === "pa") hero.st.pa = Math.max(3, hero.st.pa - 1);
      if (fx.res) ["rt", "rf", "re", "ra", "rn"].forEach((k) => (hero.st[k] = (hero.st[k] || 0) + fx.res));
      if (fx.hp) { hero.hpMax = hero.hp = Math.round(hero.hpMax * (1 + fx.hp / 100)); }
      if (fx.ini) hero.expFirst = true;
      /* recrues (choix 6A) : elles se battent comme des invocations, gardent leurs PV d'un étage à l'autre */
      const hi = F.ents.indexOf(hero);
      if (rule !== "greve") R.recruits.forEach((x, n) => { if (!(x.hp > 0) || !MONSTERS[x.key]) return; const m = MONSTERS[x.key];
        const hp = Math.round(hero.hpMax * 0.45); const s = { side: "c", tm: 0, summon: true, recruit: n, owner: hi, name: m.name, img: m.img, cls: hero.cls, lvl: L, hpMax: hp, hp: Math.max(1, Math.round(hp * x.hp)), ini: hero.ini - 1,
          dmg: (6 + L * 1.25) * 1.1, el: m.el || "t", buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, paLoss: 0 };
        F.ents.push(s); F.order.push(F.ents.indexOf(s)); });
      const W = { S2, F, fl, rule, hero: hi, seed, soulCd: 0, soulOn: -1, round: 1, dead: {}, swapped: false, rng, mode: R.mode, f: R.f };
      E.setRng(rng0); return W;
    } finally { E.setRng(rng0); E.events.length = evLen; }
  };
  /* un pas de combat (avec les règles d'étage, l'âme invoquée et les recrues) */
  E.ascStep = (S, W) => {
    const F = W.F; if (F.over) return "end";
    const rng0 = E.getRng(), evLen = E.events.length; E.setRng(W.rng);
    const Q = E.ascState(S); const R = Q.run;
    E.ASC_DEFS = W.defs || E.ASC_DEFS;
    try {
      if (F.round !== W.round) { W.round = F.round; roundFx(S, W, R); }
      E.step(W.S2);
      F.ents.forEach((m, i) => { if (m.side !== "m" || m.alive || W.dead[i]) return; W.dead[i] = 1; dieFx(W, m); });
      if (F.over) return "end";
      return "step";
    } finally { E.setRng(rng0); E.events.length = evLen; }
  };
  const roundFx = (S, W, R) => {
    const F = W.F; const hero = F.ents[W.hero]; const rule = W.rule;
    if (rule === "pacte" && hero.alive) { hero.hp = Math.max(1, hero.hp - Math.round(hero.hpMax * 0.04)); }
    if (rule === "maree") F.ents.forEach((m) => { if (m.side === "m") { m.dmg0 = m.dmg0 || m.dmg; m.dmg = m.dmg0 * (1 + 0.05 * (F.round - 1)); } });
    if (rule === "echange" && F.round === 3 && !W.swapped && hero.alive) { const t = F.ents.filter((m) => m.side === "m" && m.alive).sort((a, b) => b.hp - a.hp)[0];
      if (t) { W.swapped = true; const ph = hero.hp / hero.hpMax, pm = t.hp / t.hpMax; hero.hp = Math.max(1, Math.round(hero.hpMax * pm)); t.hp = Math.max(1, Math.round(t.hpMax * ph)); F.log.push({ txt: "Échange d'âmes : les PV sont échangés !", cls: "dim" }); } }
    /* âme de boss (choix 21A) : apparaît 3 tours, revient 4 tours après son départ */
    const soul = R && R.spells.find((s) => s.soul);
    if (soul && hero.alive) {
      const cur = W.soulOn >= 0 ? F.ents[W.soulOn] : null;
      if (cur && cur.alive && F.round - W.soulT >= A.souls.turns) { cur.alive = false; cur.hp = 0; W.soulOn = -1; W.soulCd = F.round + A.souls.cd; F.log.push({ txt: `${cur.name} retourne dans son âme.`, cls: "dim" }); }
      else if (W.soulOn < 0 && F.round >= W.soulCd) {
        const key = soul.k.slice(5); const m = MONSTERS[key]; if (m) {
          const b = E.monsterEntity(key, hero.lvl); const hp = Math.round(hero.hpMax * 0.8);
          const s = { side: "c", tm: 0, summon: true, soul: 1, owner: W.hero, name: m.name, img: m.img, cls: hero.cls, lvl: hero.lvl, hpMax: hp, hp, ini: hero.ini - 1,
            dmg: (8 + hero.lvl * 1.6) * A.souls.pow * 2.2, el: m.el || "t", buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, paLoss: 0 };
          F.ents.push(s); F.order.push(F.ents.indexOf(s)); W.soulOn = F.ents.indexOf(s); W.soulT = F.round; F.fx.push({ seq: F.seq, k: "summon", t: W.soulOn });
          F.log.push({ txt: `Tu invoques l'âme de ${m.name} : elle se bat ${A.souls.turns} tours.`, cls: "c" });
          R.used[soul.k] = (R.used[soul.k] || 0) + 1;
        }
      }
    }
  };
  const dieFx = (W, m) => {
    const F = W.F;
    if (W.rule === "halouine" && !m.risen) { m.risen = true; m.alive = true; m.hp = Math.round(m.hpMax * 0.3); F.log.push({ txt: `${m.name} revient d'entre les morts !`, cls: "ko" }); delete W.dead[F.ents.indexOf(m)]; return; }
    if (W.rule === "eclats") { const d = Math.round(m.hpMax * 0.15); F.ents.forEach((x) => { if (x !== m && x.alive) { x.hp -= Math.round(d * (x.side === "m" ? 1 : 0.5)); if (x.hp <= 0) { x.hp = 0; x.alive = false; } } }); F.log.push({ txt: `${m.name} explose (−${d}) !`, cls: "ko" }); }
  };
  /* joue un combat d'un coup (simulation, mode auto hors écran) */
  E.ascSim = (S, W) => { for (let g = 0; g < 100000 && !W.F.over; g++) E.ascStep(S, W); return E.ascResult(W); };
  E.ascResult = (W) => { const F = W.F; const mons = F.ents.filter((e) => e.side === "m" && !e.summon);
    return { win: F.result === "win", rounds: F.round, monHp: mons.map((m) => (m.alive ? m.hp / m.hpMax : 0)), heroHp: F.ents[W.hero].alive ? F.ents[W.hero].hp / F.ents[W.hero].hpMax : 0,
      recruits: F.ents.filter((e) => e.recruit !== undefined).map((e) => ({ n: e.recruit, hp: e.alive ? e.hp / e.hpMax : 0 })) }; };
  E.ascNewFight = (S) => { const Q = E.ascState(S); const R = Q.run; if (!R) return null;
    const W = E.ascSetup(S, hash(`fight|${Q.runs}|${R.f}|${R.fights}|${E.ascDay()}`)); if (W) W.defs = E.ASC_DEFS; return W; };

  /* ---------- fin d'un combat ---------- */
  E.ASC_FRAG = (f, boss) => Math.round((8 + f * 0.6) * (boss ? 3 : 1));
  /* paye l'essai, applique le résultat ; renvoie un petit résumé */
  E.ascPay = (S) => { const Q = E.ascState(S); const R = Q.run; E.ascVolSync(S); const c = E.ascCost(S, R.mode, R.f); if (c > Q.vol) return "Plus de Volonté : elle remonte de 1 toutes les 20 minutes (ou bois une Fiole de Volonté)."; Q.vol -= c; if (c && Q.vol < A.volMax && Q.vol + c >= A.volMax) Q.volT = E.now(); return null; };
  E.ascApply = (S, W, res, auto) => {
    const Q = E.ascState(S); const R = Q.run; const fl = W.fl; const out = { win: res.win, f: R.f };
    R.fights++; R.used = R.used || {}; if (R.mode === "d" && R.f > 90) R.r91 = (R.r91 || 0) + res.rounds;
    (W.F.fx || []).forEach((x) => { if (x.k === "cast" && x.sp && String(x.sp).startsWith("a~")) { const d = W.defs[+x.sp.slice(2)]; if (d) R.used[d.id] = (R.used[d.id] || 0) + 1; } });
    res.recruits.forEach((x) => { if (R.recruits[x.n]) R.recruits[x.n].hp = x.hp; }); R.recruits = R.recruits.filter((x) => x.hp > 0);
    const wk = E.ascWoundKey(R.mode, R.f);
    if (res.win) {
      delete Q.wounds[wk];
      let fr = E.ASC_FRAG(R.f, fl.t === "boss"); if (auto) { fr = Math.round(fr * A.autoFrag); R.auto++; }
      R.frag += fr; out.frag = fr;
      if (fl.rule === "dette") R.dette = R.f + 1;
      if (fl.t === "boss") { // capture d'âme : toujours proposée au premier boss d'une montée, puis 1 fois sur 2
        const first = !Q.bestiary[fl.boss]; Q.bestiary[fl.boss] = (Q.bestiary[fl.boss] || 0) + 1; out.boss = fl.boss; if (first) { out.newSoul = 1; E.note(S, `Ascension : âme de ${MONSTERS[fl.boss].name} inscrite au bestiaire.`, "rare"); }
        R.ecus += 2 + Math.floor(R.f / 20);
      }
      E.ascAdvance(S, out, auto);
    } else {
      Q.wounds[wk] = { hp: res.monHp };
      if (R.sursis > 0) { R.sursis--; R.usedSursis = 1; out.sursis = 1; }
      else { out.dead = 1; E.ascEnd(S, "dead"); }
    }
    return out;
  };
  /* classements (choix 20 A B C D F) : Rapidité (étages 91-100 en Difficile, sans auto, en tours de combat), par classe, sans Sursis, Puriste, Au-delà */
  E.ascRk = (S) => { const Q = E.ascState(S); if (!Q.rk || Q.rk.m !== Q.m) Q.rk = { m: Q.m, cls: {}, nos: 0, pur: 0, spd: 0 }; if (!Q.rkx || Q.rkx.w !== Q.w) Q.rkx = { w: Q.w, x: 0 }; return Q.rk; };
  E.ascRkNote = (S, R, done, auto) => { const Q = E.ascState(S); const K = E.ascRk(S);
    if (R.mode === "x") { Q.rkx.x = Math.max(Q.rkx.x, done); return; }
    if (R.mode !== "d") return; // les classements du mois se jouent en Difficile
    K.cls[R.cls] = Math.max(K.cls[R.cls] || 0, done);
    if (!R.usedSursis) K.nos = Math.max(K.nos, done);
    if (R.spells.every((s) => s.soul || s.k.split(":")[0] === R.cls) && !R.impure) K.pur = Math.max(K.pur, done); else R.impure = 1;
    if (done > 90 && auto) R.auto91 = 1;
    if (done === 100 && !R.auto91 && R.r91) K.spd = K.spd ? Math.min(K.spd, R.r91) : R.r91; }; // Rapidité : le moins de tours de combat sur les étages 91 à 100
  /* étage suivant : record, titres, coffres ; palier, âme, événement… */
  E.ascAdvance = (S, out, auto) => {
    const Q = E.ascState(S); const R = Q.run; const done = R.f; const fl = E.ascFloor(S, R.mode, done);
    if (done > (Q.best[R.mode] || 0)) { Q.best[R.mode] = done; if (R.mode === "n" && done >= 100) Q.best0 = Math.max(Q.best0 || 0, 100); E.ascMilestone(S, R.mode, done); }
    R.top = Math.max(R.top, done); R.f = done + 1; E.ascRkNote(S, R, done, auto || (out && out.auto));
    if (R.mode !== "x" && R.f > A.floors) { E.ascEnd(S, "top"); out.top = 1; return; }
    if (fl.t === "boss" && out && out.boss && (out.newSoul || hash(`soul|${Q.runs}|${done}`) % 2 === 0)) R.pend = { t: "soul", boss: out.boss, at: E.now() };
    else if (done % A.every === 0) R.pend = { t: "pick", opts: E.ascPickChoices(S), at: E.now() };
    E.ascEnter(S);
  };
  /* arrivée sur un étage sans combat */
  E.ascEnter = (S) => {
    const Q = E.ascState(S); const R = Q.run; if (!R || R.pend) return;
    const fl = E.ascFloor(S, R.mode, R.f); const r = seeded(hash(`ev|${Q.runs}|${R.f}`)); R.seen = R.f;
    if (fl.t === "event") { const P = monPool(fl.lvl); const mon = P[Math.floor(r() * P.length)];
      R.pend = { t: "event", ev: fl.ev, mon, price: fl.ev === "merc" ? 20 + R.f : 0, at: E.now() }; }
    else if (fl.t === "shop") R.pend = { t: "shop", at: E.now() };
    else if (fl.t === "altar") { const L = fl.lvl; const P = E.ascSpells().filter((x) => x.lvl <= L && x.kind !== "summon" && E.ascRarity(x, L) === "l"); const Q2 = P.length ? P : E.ascSpells().filter((x) => x.lvl <= L && x.kind !== "summon").sort((a, b) => b.lvl - a.lvl).slice(0, 12);
      R.pend = { t: "altar", leg: Q2.length ? Q2[Math.floor(r() * Q2.length)].k : null, at: E.now() }; }
  };
  /* étage passé sans combat (événement, marchand, autel) : on monte */
  E.ascLeave = (S) => { const Q = E.ascState(S); const R = Q.run; if (!R || R.pend) return; const fl = E.ascFloor(S, R.mode, R.f); if (["fight", "boss"].includes(fl.t)) return;
    E.ascAdvance(S, null, false); };
  /* fin de montée : Fragments et Écus gardés */
  E.ascEnd = (S, why) => {
    const Q = E.ascState(S); const R = Q.run; if (!R) return null;
    Q.frag += R.frag; Q.ecus += R.ecus;
    const sum = { why, mode: R.mode, cls: R.cls, top: R.top, frag: R.frag, ecus: R.ecus, t: E.now(), spells: R.spells.map((s) => s.k), sursis: R.sursis, auto: R.auto };
    Q.last = sum; Q.hist.unshift(sum); if (Q.hist.length > 10) Q.hist.length = 10;
    S.cnt = S.cnt || {}; S.cnt.ascRuns = (S.cnt.ascRuns || 0) + 1; S.cnt.ascBest = Math.max(S.cnt.ascBest || 0, R.top);
    Q.run = null; E.note(S, `Ascension : montée finie à l'étage ${sum.top} (${sum.frag} Fragments).`, "info");
    return sum;
  };
  E.ascQuit = (S) => { const Q = E.ascState(S); if (!Q.run) return "Aucune montée en cours."; E.ascEnd(S, "quit"); return null; };

  /* ---------- récompenses (choix 11A : le maximum, sans puissance) ---------- */
  E.ascTitle = (f, mode) => (mode === "d" ? (f >= 100 ? "Sommet du Difficile" : `Grimpeur aguerri ${f}`) : mode === "x" ? `Au-delà ${f}` : f >= 100 ? "Sommet de l'Ascension" : `Grimpeur des ${f}`);
  E.ASC_CHEST = [25, 50, 75, 100];
  E.ascMilestone = (S, mode, f) => {
    const Q = E.ascState(S);
    if (mode !== "x" && f % 10 === 0) { const t = E.ascTitle(f, mode); S.titlesExtra = S.titlesExtra || []; if (!S.titlesExtra.includes(t)) { S.titlesExtra.push(t); E.note(S, `Ascension : titre « ${t} » débloqué.`, "rare"); } }
    if (mode === "d" && f >= 100 && !Q.d100) Q.d100 = E.now(); // course de lancement de la 1.1 (supabase/classements.sql, kind race11)
    if (mode !== "x" && E.ASC_CHEST.includes(f)) { Q.chest = Q.chest || {}; const k = mode + f; if (!Q.chest[k]) { Q.chest[k] = 1; E.ascChest(S, mode, f); } }
  };
  /* coffre du mois : Kamas, Poussière, Sablier, Cristal de Forgemagie (petites quantités) */
  E.ascChest = (S, mode, f) => {
    const k = mode === "d" ? 2 : 1; const q = f / 25; const got = [];
    const kam = Math.round(20000 * q * q * k); S.kamas += kam; got.push(`${kam.toLocaleString("fr-FR")} kamas`);
    if (E.POUSSIERE) { E.addRes(S, E.POUSSIERE, 10 * q * k); got.push(`${10 * q * k} ${E.POUSSIERE}`); }
    if (f >= 50 && E.sabGift) { E.sabGift(S, k); got.push(`${k} h de Sablier`); }
    if (f >= 75 && D.CONSUMABLES.cristal_fm) { E.addCons(S, "cristal_fm", k); got.push(`${k} Cristal de Forgemagie`); }
    const Q = E.ascState(S); Q.ecus += 5 * q * k; got.push(`${5 * q * k} Écus`);
    E.note(S, `Ascension : coffre de l'étage ${f} (${E.ASC_MODES[mode]}) : ${got.join(", ")}.`, "rare");
    return got;
  };

  /* ---------- Fragments : progression permanente (choix 9A) ---------- */
  E.ascUnlocks = (S) => { const Q = E.ascState(S); const out = []; const du = (n) => (/^[AEIOUÉÈ]/.test(n) ? `de l'${n}` : `du ${n}`), le = (n) => (/^[AEIOUÉÈ]/.test(n) ? `L'${n}` : `Le ${n}`);
    D.CLASS_ORDER.filter((c) => !E.ASC_BASE_CLS.includes(c)).forEach((c, i) => {
      if (!(Q.unl.pool || []).includes(c)) out.push({ id: "pool:" + c, kind: "pool", name: `Sorts ${du(CLASSES[c].name)}`, d: `Ajoute les sorts ${du(CLASSES[c].name)} à la pioche.`, price: 150 + 50 * i });
      if (!(Q.unl.cls || []).includes(c)) out.push({ id: "cls:" + c, kind: "cls", name: `Classe ${CLASSES[c].name}`, d: `${le(CLASSES[c].name)} peut sortir au tirage des classes.`, price: 250 + 50 * i });
    });
    if (!Q.unl.bonus.glyph) out.push({ id: "bonus:glyph", kind: "bonus", name: "Glyphe de départ", d: "Chaque montée commence avec un glyphe sur ton sort signature.", price: 400 });
    if (!Q.unl.bonus.sursis) out.push({ id: "bonus:sursis", kind: "bonus", name: "Second Sursis", d: "Chaque montée commence avec 2 Sursis.", price: 900 });
    Object.keys(Q.bestiary).filter((b) => !(Q.souls || []).includes(b)).forEach((b) => out.push({ id: "soul:" + b, kind: "soul", name: `Âme : ${MONSTERS[b].name}`, d: "Ce boss peut apparaître dans les tirages de sorts.", price: A.soulCost }));
    return out; };
  E.ascUnlock = (S, id) => { const Q = E.ascState(S); const u = E.ascUnlocks(S).find((x) => x.id === id); if (!u) return "Déjà débloqué.";
    if (Q.frag < u.price) return `Il faut ${u.price} Fragments.`; Q.frag -= u.price; const [k, v] = id.split(":");
    if (k === "pool") Q.unl.pool.push(v); else if (k === "cls") Q.unl.cls.push(v); else if (k === "bonus") Q.unl.bonus[v] = 1; else if (k === "soul") (Q.souls = Q.souls || []).push(v);
    return null; };
  /* boutique des Écus : titres et ornements (apparences) */
  E.ASC_ECU_SHOP = [
    { id: "t_grimoire", kind: "title", v: "Le Grimoire vivant", price: 40 }, { id: "t_arpenteur", kind: "title", v: "Arpenteur de la Tour", price: 25 },
    { id: "t_ame", kind: "title", v: "Chasseur d'âmes", price: 60 }, { id: "t_vertige", kind: "title", v: "Sans vertige", price: 80 },
  ];
  E.ascBuy = (S, id) => { const Q = E.ascState(S); const o = E.ASC_ECU_SHOP.find((x) => x.id === id); if (!o) return "Offre inconnue.";
    S.titlesExtra = S.titlesExtra || []; if (o.kind === "title" && S.titlesExtra.includes(o.v)) return "Déjà acheté.";
    if (Q.ecus < o.price) return `Il faut ${o.price} Écus de l'Ascension.`; Q.ecus -= o.price; if (o.kind === "title") S.titlesExtra.push(o.v); return null; };

  /* ---------- le temps qui passe : Volonté, combats automatiques, choix auto (choix 8A) ---------- */
  E.ascAutoPick = (S) => {
    const Q = E.ascState(S); const R = Q.run; const P = R && R.pend; if (!P) return;
    const prio = Q.prio || "dmg"; const score = (k) => { if (k.startsWith("soul:")) return 50; const x = E.ascSpell(k); if (!x) return 0; const own = R.spells.some((s) => s.k === k);
      const kind = x.kind; const base = prio === "heal" ? (["heal", "drain"].includes(kind) ? 60 : 20) : prio === "ctrl" ? (["buff", "shield"].includes(kind) ? 50 : 25) : prio === "cls" ? (x.cls === R.cls ? 60 : 20) : (["dmg", "aoe", "drain"].includes(kind) ? 50 : 15);
      return base + x.lvl / 4 + (own ? 15 : 0); };
    const worst = () => { let j = -1, w = 1e9; R.spells.forEach((s, i) => { if (s.sig) return; const v = s.soul ? 50 : score(s.k) - 10; if (v < w) { w = v; j = i; } }); return j; };
    if (P.t === "start") { const sc = P.opts.map((k, i) => [score(k), i]).sort((a, b) => b[0] - a[0]).slice(0, A.keep).map((x) => x[1]); return E.ascChoose(S, sc); }
    if (P.t === "pick") { let bi = 0; P.opts.forEach((k, i) => { if (score(k) > score(P.opts[bi])) bi = i; }); return E.ascChoose(S, bi, worst()); }
    if (P.t === "soul") return E.ascChoose(S, 0, worst());
    if (P.t === "glyph") { const i = R.spells.findIndex((s) => !s.soul && (s.gl || []).length < 2 && !s.gl.includes(P.g)); return E.ascChoose(S, i >= 0 ? i : -1); }
    if (P.t === "event") return E.ascChoose(S, P.ev === "prisoner" ? 1 : P.ev === "merc" && R.frag >= P.price + 40 && R.recruits.length < A.recruitsMax ? 0 : 1); // 1.1.0.1 : pas de mercenaire de plus quand l'équipe a déjà ses recrues (la montée restait bloquée) // l'auto ne libère pas de prisonnier (événement risqué)
    if (P.t === "shop") return E.ascChoose(S, -1);
    if (P.t === "altar") return E.ascChoose(S, 0); // l'auto refuse toujours l'autel
    return E.ascChoose(S, -1);
  };
  /* résout un étage d'un coup (hors écran ou en auto) ; renvoie le résumé ou un message */
  E.ascStepFloor = (S, auto) => {
    const Q = E.ascState(S); const R = Q.run; if (!R) return "Aucune montée.";
    if (R.pend) { if (!auto) return "Un choix t'attend."; const e = E.ascAutoPick(S); if (e) R.pend = null; return { pick: 1 }; }
    const fl = E.ascFloor(S, R.mode, R.f);
    if (!["fight", "boss"].includes(fl.t)) { if (R.seen !== R.f) { E.ascEnter(S); if (R.pend) return { enter: fl.t }; } E.ascLeave(S); return { pass: 1 }; }
    const e = E.ascPay(S); if (e) return e;
    const W = E.ascNewFight(S); if (!W) return "Combat impossible.";
    const res = E.ascSim(S, W); return E.ascApply(S, W, res, auto);
  };
  /* tick : la Volonté remonte (le Sablier l'accélère), et la montée avance seule si l'interface ne la joue pas */
  E.ascTick = (S, dt, realMs) => {
    if (!S.asc) return; const Q = E.ascState(S);
    if (realMs != null && dt > realMs && Q.vol < A.volMax) Q.volT -= dt - realMs; // vitesse ×2 / ×3 : la Volonté remonte plus vite
    E.ascVolSync(S);
    const R = Q.run; if (!R || E.ASC_LIVE) return; // l'interface joue le combat en cours
    R.pause = (R.pause || 0) + dt; if (R.pause < A.fightPauseMs * 4) return; R.pause = 0;
    if (R.pend && (Q.auto || (Q.autoPick !== false && E.now() - R.pend.at > A.autoPickMs && Q.auto))) { if (E.ascAutoPick(S) && R.pend) R.pend = null; return; }
    if (R.pend) return;
    const fl = E.ascFloor(S, R.mode, R.f);
    if (["fight", "boss"].includes(fl.t) && E.ascCost(S, R.mode, R.f) > Q.vol) return;
    E.ascStepFloor(S, Q.auto);
  };
  const tick0 = E.tick;
  E.tick = (S, dt, realMs) => { const r = tick0(S, dt, realMs); if (S && S.asc) { try { E.ascTick(S, dt, realMs); } catch (e) { if (typeof console !== "undefined") console.warn("ascension", e); } } return r; };

  /* ---------- actions (E.act) ---------- */
  Object.assign(E.ACTIONS, { ascStart: "commencer une montée (Ascension)", ascReroll: "relancer les classes (Ascension)", ascChoose: "faire un choix (Ascension)", ascQuit: "abandonner la montée",
    ascDrink: "boire une Fiole de Volonté", ascUnlock: "débloquer (Fragments)", ascBuy: "acheter (Écus de l'Ascension)", ascBrew: "préparer une Fiole de Volonté", ascSetAuto: "mode auto (Ascension)", ascSetPrio: "priorité de l'auto (Ascension)" });
  E.ascSetAuto = (S, on) => { E.ascState(S).auto = !!on; return null; };
  E.ascSetPrio = (S, p) => { if (!["dmg", "heal", "ctrl", "cls"].includes(p)) return "Priorité inconnue."; E.ascState(S).prio = p; return null; };

  /* ---------- Fioles de Volonté (+5) : où en trouver hors de l'Ascension (choix A B C E F) ---------- */
  D.CONSUMABLES[A.fioleId] = { name: "Fiole de Volonté", icon: "🧪", pimg: 26002, kind: "util", desc: "+5 Volonté pour L'Ascension (au-delà du maximum de 30). Se boit sur la page L'Ascension." };
  const useSp0 = E.useSpecial;
  E.useSpecial = (S, id, arg) => (id === A.fioleId ? E.ascDrink(S) : useSp0 ? useSp0(S, id, arg) : "Inutilisable.");
  const giveFiole = (S, why) => { E.addCons(S, A.fioleId, 1); E.note(S, `Fiole de Volonté obtenue (${why}).`, "rare"); };
  A.fioleDrop = 0.05; A.fioleDrop6 = 0.1; A.brewDay = 3;
  // A : boss de donjon, 5 % (10 % dès la stasis 6) ; B : offrande de l'Almanax
  const emitF = E.emit;
  E.emit = (S, type, data) => { const r = emitF(S, type, data);
    try {
      if (type === "dungeon" && S && S.chars && E.rnd() < ((data && data.stasis) >= 6 ? A.fioleDrop6 : A.fioleDrop)) giveFiole(S, "boss de donjon");
      if (type === "almanax" && S) giveFiole(S, "offrande de l'Almanax");
    } catch (e) { /* jamais bloquer le jeu */ }
    return r; };
  // B : Défi du jour réussi (la bourse du jour, une fois par jour)
  if (E.defiPlay) { const dp0 = E.defiPlay; E.defiPlay = (S, tid) => { const out = dp0(S, tid); if (out && out.chest && !out.chest.from) { giveFiole(S, "Défi du jour"); // 1.1.0.1 : une seule par jour (avant : une par bourse, jusqu'à 3)
      out.fiole = 1; } return out; }; }
  // C : recette de l'Alchimiste, 3 par jour (la fiole se vend à l'Hôtel de vente comme tout consommable)
  E.ASC_BREW = { lvl: 20, herb: [["Sauge", 10], ["Trèfle à 5 feuilles", 5]], kamas: 5000 };
  E.ascBrewLeft = (S) => { const Q = E.ascState(S); const d = E.ascDay(); return Q.brew && Q.brew.d === d ? Math.max(0, A.brewDay - Q.brew.n) : A.brewDay; };
  E.ascBrew = (S) => { const Q = E.ascState(S); const R = E.ASC_BREW;
    if (((S.jobs && S.jobs.alchimiste) || {}).lvl < R.lvl) return `Alchimiste niveau ${R.lvl} requis.`;
    if (E.ascBrewLeft(S) < 1) return `${A.brewDay} fioles par jour au plus : reviens demain.`;
    for (const [r, n] of R.herb) if ((S.res[r] || 0) < n) return `Il faut ${n} × ${r}.`;
    if (S.kamas < R.kamas) return `Il faut ${R.kamas.toLocaleString("fr-FR")} kamas.`;
    R.herb.forEach(([r, n]) => { S.res[r] -= n; if (!S.res[r]) delete S.res[r]; }); S.kamas -= R.kamas;
    const d = E.ascDay(); Q.brew = Q.brew && Q.brew.d === d ? { d, n: Q.brew.n + 1 } : { d, n: 1 }; E.addCons(S, A.fioleId, 1); return null; };
  // E : boutique du Kolizéum et Marché onirique, 1 par jour chacun
  if (E.SHOPS && E.SHOPS.koli && !E.SHOPS.koli.items.some((x) => x.cons === A.fioleId)) E.SHOPS.koli.items.push({ id: "p7", cons: A.fioleId, cost: 15, many: true, day: 1, sec: "progres" });
  if (E.SG_SHOP && !E.SG_SHOP.some((x) => x.id === A.fioleId)) {
    E.SG_SHOP.push({ id: A.fioleId, kind: "coffre", name: "Fiole de Volonté", price: 150, desc: "+5 Volonté pour L'Ascension (1 par jour)", cons: A.fioleId });
    const sb0 = E.sgBuy; E.sgBuy = (S, id) => { if (id !== A.fioleId) return sb0(S, id); const Q = E.ascState(S); const d = E.ascDay();
      if (Q.sgDay === d) return "1 Fiole de Volonté par jour au Marché onirique : reviens demain."; const r = sb0(S, id); if (!r) Q.sgDay = d; return r; };
  }

  root.ENGINE = E;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
