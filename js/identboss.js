/* ============================================================================
   SORTS UNIQUES DES BOSS — Idlus
   Chaque boss a un sort qui porte une mécanique que lui seul possède (en général son
   attaque signature). Elle remplace la mécanique commune de ce sort.
   Lu par identmon.js (midHit / midPost / midMul / midTargets / midTurn / midText).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  if (!E || !E.midOn) return;
  try { if (typeof process !== "undefined" && process.env && process.env.NO_UBOSS) return; } catch (e) { /* navigateur */ }
  const API = () => E.fightApi;
  const rnd = () => E.rnd();
  const DG = () => ((root.DATA || (typeof require !== "undefined" ? require("./data.js") : {})).DUNGEONS || {});
  /* les serviteurs d'un boss : ceux de son donjon, même hors du donjon (Songe infini) ; jamais une copie du boss (1.2.9.4) */
  const minionKey = (F, e) => { const bk = e.base || e.key; let k = F.dungeonId ? API().mobKey(F, e) : null;
    if (!k || k === bk) { const L = Object.values(DG()).filter((d) => d.boss === bk && d.bossMobs && d.bossMobs.length); const d = L.length ? L[Math.floor(rnd() * L.length)] : null; k = d ? d.bossMobs[Math.floor(rnd() * d.bossMobs.length)] : null; }
    return k && k !== bk ? k : null; };
  const P = () => E.MID_P;

  /* boîte à outils : chaque mécanique unique est une combinaison de ces gestes */
  const kit = (F, e, el) => {
    const A = API(); const ei = (x) => F.ents.indexOf(x);
    const say = (t, idx) => F.fx.push({ seq: F.seq, k: "buff", t: ei(t), txt: "", idx });
    const heroes = () => F.ents.filter((x) => x.alive && x.side === "c" && !x.summon);
    const mons = () => F.ents.filter((x) => x.alive && x.side === "m");
    const row = (t) => A.rowOf(t);
    const p = P();
    const h = {
      F, e, p, heroes, mons, row, say,
      ch: (c) => rnd() < c * p,
      log: (txt) => A.flog(F, txt, "m"),
      hit: (t, v, elx) => { if (!t || !t.alive) return 0; const d = A.dealDamage(F, e, t, v * p, elx === undefined ? el : elx); return d; },
      bleed: (t, d, f, n = 2) => { if (t.noDot) return; t.dots.push({ v: Math.max(1, d * f * p), turns: n, el: null, src: e.name }); say(t, "m_saigne"); },
      burn: (t, d, f, n = 1) => { if (t.noDot) return; t.dots.push({ v: Math.max(1, d * f * p), turns: n, el: "f", src: e.name }); say(t, "m_brulure"); },
      poison: (t, d, f, n = 3) => { if (t.noDot) return; t.dots.push({ v: Math.max(1, d * f * p), turns: n, el, src: e.name }); say(t, "m_poison"); },
      pa: (t, n = 1) => { if (A.resists(t, "epa")) return; t.paLoss = Math.min(2, (t.paLoss || 0) + n); say(t, "m_gel"); },
      slow: (t) => { if (A.resists(t, "epm")) return; t.slowR = F.round + 1; say(t, "m_entrave"); },
      stun: (t) => { if (heroes().length < 2 || t.stun > 0 || A.resists(t, "epa")) return false; t.stun = 1; say(t, "m_entrave"); A.flog(F, `${t.name} est assommé et passera son tour.`, "m"); return true; },
      silence: (t, n = 2) => { if (A.resists(t, "epa")) return; t.silence = n + 1; say(t, "m_peur"); },
      root: (t, n = 2) => { if (A.resists(t, "epm")) return; t.rooted = n + 1; say(t, "m_entrave"); },
      noHeal: (t, n = 2) => { if (A.resists(t, "epm")) return; t.noHeal = Math.max(t.noHeal || 0, n + 1); say(t, "m_entrave"); }, // 2.1.40.8 : « ne peut plus être soigné » (avant : il ne pouvait plus soigner mais recevait les soins)
      weak: (t, v, n = 2) => { t.debuffs.push({ weak: Math.round(v * p), turns: n }); say(t, "m_peur"); },
      vuln: (t, v, n = 2) => { t.debuffs.push({ vuln: Math.round(v * p), turns: n }); say(t, "m_choc"); },
      mark: (t) => { t.midMark = F.round + 1; say(t, "m_marque"); },
      strip: (t) => { const had = (t.shield || 0) > 0 || t.buffs.length > 0; t.shield = 0; t.buffs = t.buffs.filter((b) => b.turns > 50); if (had) say(t, "m_choc"); return had; },
      cd: (t) => { for (const k in t.cd) if (t.cd[k] > 0) t.cd[k]++; say(t, "m_gel"); },
      toBack: (t) => { if (row(t) === "b" || A.resists(t, "epm")) return; t.fearRow = "f"; t.row = "b"; t.fearT = 3; say(t, "m_choc"); },
      toFront: (t) => { if (row(t) === "f" || A.resists(t, "epm")) return; t.fearRow = "b"; t.row = "f"; t.fearT = 3; say(t, "m_charge"); },
      heal: (x, f) => { const v = A.doHeal(x, x.hpMax * f * p, F); if (v) say(x, "m_soin"); return v; },
      drain: (d, f) => { const v = A.doHeal(e, d * f * p, F); if (v) say(e, "m_vampire"); return v; },
      shield: (x, f) => { x.shield = Math.max(x.shield || 0, Math.round(x.hpMax * f * p)); say(x, "m_armure"); },
      buff: (v, max, tag) => { if (e.buffs.filter((b) => b[tag]).length >= max) return; e.buffs.push({ mdmg: Math.round(v * p), turns: 99, [tag]: 1 }); say(e, "m_rage"); },
      tbuff: (x, v, n) => { x.buffs.push({ mdmg: Math.round(v * p), turns: n }); say(x, "m_rage"); },
      cleanse: () => { e.debuffs = e.debuffs.filter((d) => d.turns > 50); e.dots = []; say(e, "m_soin"); },
      summon: (max, hp) => { if (mons().filter((m) => m.midSum === e.key).length >= max || mons().length >= 9) return null; const k = minionKey(F, e); if (!k) return null; const m = A.spawnMon(F, k, e.lvl - 3, { fake: true, hp: e.hpMax * hp }); m.midSum = e.key; m.dmg *= 0.6; return m; },
      rand: (l) => (l.length ? l[Math.floor(rnd() * l.length)] : null),
      low: (l) => l.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0],
      frail: (l) => l.slice().sort((a, b) => a.hpMax - b.hpMax)[0],
      tough: (l) => l.slice().sort((a, b) => b.hpMax - a.hpMax)[0],
      later: (n, fn) => { (e.midLater = e.midLater || []).push({ r: F.round + n, fn }); },
    };
    return h;
  };

  /* boss → sort → mécanique unique. hit : après chaque coup ; post : après le sort ;
     mul : multiplicateur de dégâts ; tgt : choix des cibles ; turn : début du tour du boss */
  const U = {};
  const add = (key, sp, n, d, o) => { U[key] = Object.assign({ sp, n, d }, o); };

  /* ——— niveaux 10 à 70 ——— */
  add("m4051", "Casse-crâne", "Crâne fêlé", "Une chance sur quatre d'assommer chaque héros touché : il passe son tour.", { hit: (h, t) => { if (h.ch(0.25)) h.stun(t); } });
  add("m799", "Goinfrage", "Ventre plein", "Dévore les PV volés : chaque Goinfrage le soigne et lui donne 5 % de dégâts en plus (5 fois au plus).", { hit: (h, t, d) => h.drain(d, 0.5), post: (h) => h.buff(5, 5, "mgoinf") });
  add("m928", "Dégraissage", "Essorage", "Retire le bouclier de chaque héros touché et s'en couvre à son tour.", { hit: (h, t) => { const s = t.shield || 0; if (s > 0) { t.shield = 0; h.e.shield = (h.e.shield || 0) + Math.round(s * 0.6 * h.p); h.say(h.e, "m_armure"); } } });
  add("m147", "Morsure du Bouftou Royal", "Laine royale", "Chaque morsure fait pousser sa laine : un bouclier de 4 % de ses PV, qui se cumule jusqu'à 20 %.", { post: (h) => { h.e.shield = Math.min(Math.round(h.e.hpMax * 0.2), (h.e.shield || 0) + Math.round(h.e.hpMax * 0.04 * h.p)); h.say(h.e, "m_armure"); } });
  add("m3945", "Blathération", "Pinces d'acier", "Pince le héros le plus fragile une deuxième fois.", { post: (h, ts, b) => { const t = h.frail(h.heroes()); if (t && b) { h.hit(t, b * 0.6); h.say(t, "m_saigne"); } } });
  add("m800", "Lancer de Tofu Fugace", "Nuée de Tofus", "Lâche trois petits Tofus qui frappent des héros au hasard.", { post: (h, ts, b) => { if (!b) return; for (let i = 0; i < 3; i++) { const t = h.rand(h.heroes()); if (t) { h.hit(t, b * 0.25); h.say(t, "m_marque"); } } } });
  add("m3238", "Bushido", "Voie du sabre", "Défie le héros le plus en forme : vise celui qui a le plus de PV, +25 % de dégâts s'il est indemne.", { tgt: (h, ts, all, n) => (n <= 1 ? [all.slice().sort((a, b) => b.hp - a.hp)[0]] : ts), mul: (h, t) => (t.hp >= t.hpMax ? 1 + 0.25 * h.p : 1) });
  add("m797", "Picoti", "Picots dorés", "Change l'or volé en carapace : un bouclier égal à la moitié des PV drainés.", { hit: (h, t, d) => { h.e.shield = (h.e.shield || 0) + Math.round(d * 0.5 * h.p); h.say(h.e, "m_armure"); } });
  add("m2975", "Le Dentiste", "Arrache-dent", "Arrache une dent : la cible frappe 15 % moins fort et saigne pendant 3 tours.", { hit: (h, t, d) => { h.weak(t, 15, 2); h.bleed(t, d, 0.08, 3); } });
  add("m792", "Abolissement", "Colère de Bwork", "Frappe d'autant plus fort qu'elle est blessée : jusqu'à +50 % sous 20 % de PV.", { mul: (h) => 1 + 0.5 * h.p * Math.min(1, (1 - h.e.hp / h.e.hpMax) / 0.8) });
  add("m2995", "Kwakoukas Kwayal", "Kwabolition", "Retire les bonus et le bouclier de chaque héros touché.", { hit: (h, t) => h.strip(t) });
  add("m6903", "Cuvée des Gobs", "Heure de retenue", "Met en retenue le héros le plus solide : il joue en dernier et perd 1 PA.", { post: (h) => { const t = h.tough(h.heroes()); if (t) { h.slow(t); h.pa(t, 1); } } });
  add("m7197", "Serpette", "Fauchage", "Fauche toute la première ligne : chaque héros devant saigne pendant 3 tours.", { post: (h, ts, b) => { if (!b) return; h.heroes().filter((t) => h.row(t) === "f").forEach((t) => h.bleed(t, b, 0.07, 3)); } });
  add("m252", "Tchaiste", "Coffre fermé", "Après ce sort, il se referme : −50 % de dégâts reçus jusqu'à son prochain tour.", { post: (h) => { h.e.midShut = h.F.round + 1; h.say(h.e, "m_armure"); }, def: (h, v) => (h.e.midShut >= h.F.round ? v * (1 - 0.5 * h.p) : v) });
  add("m1027", "Frappe de Corail Magistrale", "Récif", "Fait pousser un corail sur lui : il récupère 3 % de ses PV pendant 3 tours.", { post: (h) => { h.e.midRegen = { r: h.F.round + 3, f: 0.03 }; h.say(h.e, "m_soin"); } });
  add("m457", "Déglutition", "Enlisement", "Avale la cible : elle perd 1 PA et ne peut plus être soignée pendant 2 tours.", { hit: (h, t) => { h.pa(t, 1); h.noHeal(t, 2); } });
  add("m1184", "Blopunition Royale", "Division royale", "Chaque fois qu'il le lance sous 66 % de PV, un Blop se détache de lui (2 au plus).", { post: (h) => { if (h.e.hp < h.e.hpMax * 0.66) { const m = h.summon(2, 0.08); if (m) h.log(`Un Blop se détache de ${h.e.name} !`); } } });
  add("m180", "Abwutissement", "Pluie de carottes", "Ses carottes soignent tous les monstres de 4 % de leurs PV.", { post: (h) => h.mons().forEach((m) => h.heal(m, 0.04)) });
  add("m58", "Royale Bleuet Os", "Gélatine", "Tant que la gelée tremble (2 tours), aucun coup ne lui retire plus de 6 % de ses PV.", { post: (h) => { h.e.midJelly = h.F.round + 2; h.say(h.e, "m_armure"); }, def: (h, v) => (h.e.midJelly >= h.F.round ? Math.min(v, h.e.hpMax * 0.06 / h.p) : v) });
  add("m5653", "Éclat", "Chocolave", "Nappe l'arrière de chocolat brûlant : chaque héros derrière brûle pendant 2 tours.", { post: (h, ts, b) => { if (!b) return; h.heroes().filter((t) => h.row(t) === "b").forEach((t) => h.burn(t, b, 0.12, 2)); } });
  add("m2960", "Bouboule", "Marmite", "Jette la cible dans la marmite : une chance sur trois qu'elle passe son tour, et elle cuit pendant 2 tours.", { hit: (h, t, d) => { if (h.ch(0.33)) h.stun(t); h.burn(t, d, 0.1, 2); } });
  add("m3100", "Soin Diffus", "Mord-mollet", "Mord le héros le plus fragile de l'arrière et se soigne de la moitié des dégâts.", { post: (h, ts, b) => { const bk = h.heroes().filter((t) => h.row(t) === "b"); const t = h.frail(bk.length ? bk : h.heroes()); if (t) { const d = h.hit(t, (b || h.e.dmg) * 0.6, null); h.drain(d, 0.5); } } });
  add("m669", "Frappe du Craqueleur Légendaire", "Peau de pierre", "Durcit sa peau à chaque lancer : −6 % de dégâts reçus (jusqu'à −30 %) ; elle s'effrite quand il passe sous la moitié de ses PV.", { post: (h) => { if (h.e.hp > h.e.hpMax * 0.5) { h.e.midStone = Math.min(5, (h.e.midStone || 0) + 1); h.say(h.e, "m_armure"); } else h.e.midStone = 0; }, def: (h, v) => v * (1 - 0.06 * h.p * (h.e.midStone || 0)) });
  add("m5823", "Knout", "Drakaaris", "Le fouet attise son dragon : au tour suivant, un souffle de feu brûle toute l'équipe.", { post: (h, ts, b) => { if (b) h.later(1, (k) => k.heroes().forEach((t) => { k.hit(t, b * 0.3, "f"); k.say(t, "m_brulure"); })); } });
  add("m1051", "Bombarde", "Tonneau de poudre", "Pose un tonneau qui explose sur la première ligne deux tours plus tard.", { post: (h, ts, b) => { if (b) { h.log(`${h.e.name} roule un tonneau de poudre vers la première ligne…`); h.later(2, (k) => k.heroes().filter((t) => k.row(t) === "f").forEach((t) => { k.hit(t, b * 0.7, "f"); k.say(t, "m_zone"); })); } } });

  /* ——— niveaux 80 à 130 ——— */
  add("m3460", "Mékattwaction", "Aimant wobotique", "Attire la cible en première ligne pendant 2 tours.", { hit: (h, t) => h.toFront(t) });
  add("m4621", "Force Poigne", "Tombeau des sables", "Enterre la cible : elle recule à l'arrière et ne peut plus être soignée pendant 2 tours.", { hit: (h, t) => { h.toBack(t); h.noHeal(t, 2); } });
  add("m230", "Coup de Sabre Maudit", "Malédiction du Chouque", "Maudit la cible : elle subit 15 % de dégâts en plus pendant 3 tours.", { hit: (h, t) => h.vuln(t, 15, 3) });
  add("m4860", "Vinriktus", "Tour de passe-passe", "Échange la première ligne et l'arrière de l'équipe.", { post: (h) => { h.heroes().forEach((t) => { if (h.row(t) === "f") h.toBack(t); else h.toFront(t); }); } });
  add("m173", "Morsure Sylvestre", "Racines anciennes", "Enracine la cible : ses sorts à recharge attendent un tour de plus.", { hit: (h, t) => h.cd(t) });
  add("m3996", "Cisaillage", "Cocon de soie", "Un lancer sur deux, emmaillote le héros le plus fragile touché : il passe son tour.", { post: (h, ts) => { h.e.midCoc = (h.e.midCoc || 0) + 1; if (h.e.midCoc % 2 === 0) { const t = h.frail(ts.filter((x) => x.alive)); if (t) h.stun(t); } } });
  add("m670", "Calumet de la paix", "Fumée de la paix", "Toute l'équipe frappe 12 % moins fort pendant 2 tours.", { post: (h) => h.heroes().forEach((t) => h.weak(t, 12, 2)) });
  add("m232", "Étripage", "Curée", "Frappe deux fois plus fort un héros sous 30 % de ses PV.", { mul: (h, t) => (t.hp < t.hpMax * 0.3 ? 1 + 1 * h.p : 1) });
  add("m226", "Choc Sismique", "Secousse de Moon", "Une chance sur trois de faire reculer chaque héros de la première ligne.", { hit: (h, t) => { if (h.row(t) === "f" && h.ch(0.33)) h.toBack(t); } });
  add("m113", "Croutage", "Croûte de cochon", "Chaque Croutage le protège : un bouclier de 5 % de ses PV, et il se défait de ses malus.", { post: (h) => { h.shield(h.e, 0.05); h.cleanse(); } });
  add("m5819", "Cri déchirant", "Écho de Kharnozor", "Le cri revient au tour suivant, deux fois moins fort.", { post: (h, ts, b) => { if (b) h.later(1, (k) => ts.filter((t) => t.alive).forEach((t) => { k.hit(t, b * 0.5); k.say(t, "m_eclair"); })); } });
  add("m3476", "Tirer les ficelles", "Pantin", "Fait de la cible son pantin : elle frappe plus faiblement (−20 %) et joue en dernier.", { hit: (h, t) => { h.weak(t, 20, 1); h.slow(t); } });
  add("m3652", "Ka Dabor", "Grimoire de Malléfisk", "Rend muette la cible : plus de sorts à recharge pendant 2 tours (une chance sur deux).", { hit: (h, t) => { if (h.ch(0.5)) h.silence(t, 2); } });
  add("m289", "Sanction Ténébreuse", "Nuée de corbeaux", "Les corbeaux becquettent toute l'équipe : chaque héros saigne pendant 2 tours.", { post: (h, ts, b) => { if (b) h.heroes().forEach((t) => h.bleed(t, b, 0.05, 2)); } });
  add("m1071", "Modération", "Rasboul", "Prend 1 PA à chaque héros touché et se donne 4 % de dégâts par PA volé (5 fois au plus).", { hit: (h, t) => { h.pa(t, 1); h.buff(4, 5, "mrasb"); } });
  add("m6326", "Urticaire", "Ronces de Damadrya", "Les ronces restent : chaque héros touché saigne et frappe 10 % moins fort.", { hit: (h, t, d) => { h.bleed(t, d, 0.06, 2); h.weak(t, 10, 2); } });
  add("m4278", "Poulvérisation", "Poudre aux yeux", "Aveugle les héros touchés : les autres monstres les visent en priorité et les frappent plus fort.", { hit: (h, t) => h.mark(t) });
  add("m940", "Ravage", "Duel des rats", "Plus fort tant que le Rat Noir vit : +25 % de dégâts.", { mul: (h) => (h.mons().some((m) => m.key === "m939") ? 1 + 0.25 * h.p : 1) });
  add("m939", "Peste Noire", "Peste", "La peste saute de héros en héros : un venin qui se transmet au voisin au tour suivant.", { hit: (h, t, d) => { h.poison(t, d, 0.06, 2); h.later(1, (k) => { const o = k.rand(k.heroes().filter((x) => x !== t)); if (o) k.poison(o, d, 0.06, 2); }); } });
  add("m121", "Sabotage", "Labyrinthe", "Égare la cible : elle passe à l'autre ligne et joue en dernier.", { hit: (h, t) => { if (h.row(t) === "f") h.toBack(t); else h.toFront(t); h.slow(t); } });
  add("m854", "Souffle", "Gueule du marais", "Chaque souffle lui donne faim : il se soigne de 3 % de ses PV par héros touché.", { post: (h, ts) => h.heal(h.e, 0.03 * ts.length) });
  add("m2854", "Lichemouth", "Crapaud gourmand", "Avale aussi un bonus de la cible et s'en sert : +6 % de dégâts par bonus avalé (4 au plus).", { hit: (h, t) => { const b = t.buffs.findIndex((x) => x.turns < 50); if (b >= 0) { t.buffs.splice(b, 1); h.buff(6, 4, "mlich"); } } });
  add("m780", "Chant Immobilisant", "Mélopée de Skeunk", "Le chant endort : les héros touchés jouent en dernier, et perdent 1 PA s'ils sont à l'arrière.", { hit: (h, t) => { h.slow(t); if (h.row(t) === "b") h.pa(t, 1); } });
  add("m382", "Écrasement Royal", "Plumes royales", "Laisse des plumes : chaque héros touché est marqué et prend 10 % de dégâts en plus au tour suivant.", { hit: (h, t) => { h.mark(t); h.vuln(t, 10, 1); } });
  add("m1188", "Blopoutrage Royal", "Arc-en-Blop", "Change de couleur à chaque lancer : il résiste à l'élément de son dernier coup reçu.", { post: (h) => { h.e.midResEl = h.e.midLastEl || null; h.say(h.e, "m_armure"); }, def: (h, v, el) => { h.e.midLastEl = el; return el && el === h.e.midResEl ? v * (1 - 0.4 * h.p) : v; } });
  add("m3852", "Instabilité temporelle", "Boucle temporelle", "Les sorts à recharge de l'équipe attendent un tour de plus.", { post: (h) => h.heroes().forEach((t) => h.cd(t)) });
  add("m3618", "Flatulences buccales", "Tête dans le sable", "Après ce sort, elle cache la tête : les dégâts qu'elle reçoit sont réduits de 35 % au tour suivant.", { post: (h) => { h.e.midShut = h.F.round + 1; h.e.midShutF = 0.35; h.say(h.e, "m_armure"); } });
  add("m3753", "Dansorcellement", "Danse du pirate", "Fait danser l'équipe : chaque héros échange de ligne avec une chance sur deux.", { post: (h) => h.heroes().forEach((t) => { if (h.ch(0.5)) { if (h.row(t) === "f") h.toBack(t); else h.toFront(t); } }) });
  add("m4609", "Piképik", "Piquants", "Ses piquants restent : il renvoie 15 % des dégâts reçus jusqu'à son tour suivant.", { post: (h) => { h.e.midThorn = h.F.round + 1; h.say(h.e, "m_armure"); }, thorn: 0.15 });
  add("m5664", "Total Impwâkt", "Impwâkt", "Fend l'armure : chaque héros touché perd son bouclier, puis subit 15 % de dégâts en plus.", { hit: (h, t) => { h.strip(t); h.vuln(t, 15, 1); } });
  add("m6256", "Colère bouillonnante", "Source chaude", "Plus il est blessé, plus elle bout : il se soigne de 6 % de ses PV sous la moitié de sa vie.", { post: (h) => { if (h.e.hp < h.e.hpMax * 0.5) h.heal(h.e, 0.06); } });
  add("m6218", "Casse-noisettes", "Casse-noisettes", "Brise les boucliers : dégâts doublés sur un héros protégé, et son bouclier saute.", { mul: (h, t) => ((t.shield || 0) > 0 ? 1 + 1 * h.p : 1), hit: (h, t) => { t.shield = 0; } });

  /* ——— niveaux 140 à 190 ——— */
  add("m1087", "Helse", "Ahurissement", "Ahurit la cible : une chance sur trois qu'elle frappe 25 % moins fort au tour suivant.", { hit: (h, t) => { if (h.ch(0.33)) h.weak(t, 25, 1); } });
  add("m2848", "Mansoluble", "Banquise", "Gèle le sol : tous les héros perdent 1 PA au tour suivant (une chance sur deux chacun).", { post: (h) => h.heroes().forEach((t) => { if (h.ch(0.5)) h.pa(t, 1); }) });
  add("m257", "Tornade de Branches", "Ramure", "Chaque branche le soigne : il récupère la moitié des dégâts de la tornade, partagée avec ses alliés.", { hit: (h, t, d) => { const m = h.low(h.mons()); if (m) { const v = API().doHeal(m, d * 0.4 * h.p, h.F); if (v) h.say(m, "m_soin"); } } });
  add("m6249", "Fumée asphyxiante", "Asphyxie", "La fumée étouffe : les héros touchés ne peuvent plus être soignés pendant 2 tours.", { hit: (h, t) => h.noHeal(t, 2) });
  add("m6204", "Grande Lame du Vent", "Lame du vent", "Le vent coupe deux fois : un second coup frappe le héros derrière la cible.", { post: (h, ts, b) => { const t = h.rand(h.heroes().filter((x) => h.row(x) === "b" && !ts.includes(x))); if (t && b) { h.hit(t, b * 0.5, "a"); h.say(t, "m_eclair"); } } });
  add("m107", "Bond Maléfique", "Bond maléfique", "Bondit sur l'arrière : vise toujours un héros de la deuxième ligne quand il y en a un.", { tgt: (h, ts, all, n) => { const bk = all.filter((t) => h.row(t) === "b"); return n <= 1 && bk.length ? [h.rand(bk)] : ts; } });
  add("m943", "Rasoir", "Rasage de près", "Chaque coup le rend plus tranchant : +5 % de dégâts par héros touché, jusqu'à +25 %.", { hit: (h) => h.buff(5, 5, "mraso") });
  add("m2877", "Mousse Haillon", "Pavillon noir", "Appelle un matelot en renfort quand l'équipe a plus de héros debout que lui d'alliés.", { post: (h) => { if (h.heroes().length > h.mons().length) { const m = h.summon(2, 0.1); if (m) h.log(`${h.e.name} appelle un matelot à la rescousse !`); } } });
  add("m3651", "Bain de lave", "Lave figée", "La lave refroidit sur la cible : elle brûle, puis perd 1 PA au tour suivant.", { hit: (h, t, d) => { h.burn(t, d, 0.15, 1); h.later(1, (k) => { if (t.alive) k.pa(t, 1); }); } });
  add("m827", "Destinos", "Destin du Minotot", "Marque un destin : la cible prend 30 % de dégâts en plus de tous les monstres pendant 2 tours.", { hit: (h, t) => { h.vuln(t, 30, 2); h.mark(t); } });
  add("m1045", "Furie du Kimbo", "Pair et impair", "Frappe 30 % plus fort les tours pairs, et se protège les tours impairs.", { mul: (h) => (h.F.round % 2 === 0 ? 1 + 0.3 * h.p : 1), post: (h) => { if (h.F.round % 2 === 1) h.shield(h.e, 0.06); } });
  add("m2924", "Objection", "Objection !", "Objection retenue : la cible perd son bouclier et ne peut plus être soignée au tour suivant.", { hit: (h, t) => { h.strip(t); h.noHeal(t, 1); } });
  add("m3556", "Chachyène cinglante", "Matriarche", "Appelle ses petits : les autres monstres frappent 15 % plus fort pendant 2 tours.", { post: (h) => h.mons().filter((m) => m !== h.e).forEach((m) => h.tbuff(m, 15, 2)) });
  add("m4264", "Pulsation Malsaine", "Pulsation", "Le venin bat comme un cœur : il frappe tous les deux tours pendant 4 tours.", { hit: (h, t, d) => { h.later(2, (k) => { if (t.alive) k.poison(t, d, 0.15, 1); }); h.later(4, (k) => { if (t.alive) k.poison(t, d, 0.15, 1); }); } });
  add("m6388", "Shin Kûdaigyoku", "Vent divin", "Le vent repousse : les héros touchés de la première ligne reculent, ceux de l'arrière jouent en dernier.", { hit: (h, t) => { if (h.row(t) === "f") { if (h.ch(0.4)) h.toBack(t); } else h.slow(t); } });
  add("m8052", "Abzlation", "Ablation", "Retire 1 PA, et 1 de plus à un héros déjà sans bouclier.", { hit: (h, t) => h.pa(t, (t.shield || 0) > 0 ? 1 : 2) });
  add("m2967", "Malice glacée", "Farce glacée", "Gèle les sorts : la cible perd 1 PA, et ses sorts à recharge attendent un tour de plus.", { hit: (h, t) => { h.pa(t, 1); h.cd(t); } });
  add("m3849", "Souffle démoniaque", "Pacte démoniaque", "Paie de sa vie : perd 3 % de ses PV pour frapper 40 % plus fort.", { mul: () => 1 + 0.4 * P(), post: (h) => { h.e.hp = Math.max(1, h.e.hp - Math.round(h.e.hpMax * 0.03)); } });
  add("m4726", "Paternalisme", "Paternalisme", "Soigne et protège ses petits : les autres monstres reçoivent un bouclier de 8 % de leurs PV.", { post: (h) => h.mons().filter((m) => m !== h.e).forEach((m) => h.shield(m, 0.08)) });
  add("m6394", "Aura des Kitsounebi", "Feux follets", "Allume trois feux follets qui brûlent des héros au hasard au tour suivant.", { post: (h, ts, b) => { if (b) h.later(1, (k) => { for (let i = 0; i < 3; i++) { const t = k.rand(k.heroes()); if (t) { k.hit(t, b * 0.2, "f"); k.say(t, "m_brulure"); } } }); } });
  add("m1159", "Opiniâtreté", "Spores", "Disperse des spores : chaque héros touché est empoisonné, et les spores le soignent lui de 2 % par héros touché.", { hit: (h, t, d) => h.poison(t, d, 0.05, 3), post: (h, ts) => h.heal(h.e, 0.02 * ts.length) });
  add("m2968", "Loute", "Coup de froid", "Gèle la cible : elle perd 1 PA ; si elle en avait déjà perdu, elle passe son tour.", { hit: (h, t) => { if ((t.paLoss || 0) > 0) h.stun(t); else h.pa(t, 1); } });
  add("m3752", "Vile ruse", "Ruse du Toxoliath", "Vise le héros qui soigne le plus (le plus de Sagesse ou d'Intelligence) et lui coupe les soins 2 tours.", { tgt: (h, ts, all, n) => (n <= 1 ? [all.slice().sort((a, b) => (b.st && b.st.int || 0) - (a.st && a.st.int || 0))[0]] : ts), hit: (h, t) => h.root(t, 2) });
  add("m478", "Fauchoir", "Moisson du Bworker", "Fauche : les dégâts augmentent de 20 % pour chaque héros déjà à terre.", { mul: (h) => 1 + 0.2 * h.p * h.F.ents.filter((x) => x.side === "c" && !x.summon && !x.alive).length });
  add("m7219", "Ninfernal", "Cloche", "La cloche sonne : toute l'équipe joue en dernier au tour suivant.", { post: (h) => h.heroes().forEach((t) => h.slow(t)) });
  add("m2986", "Razepoutine", "Mur de glace", "Dresse un mur : tous les monstres reçoivent un bouclier de 5 % de leurs PV.", { post: (h) => h.mons().forEach((m) => h.shield(m, 0.05)) });
  add("m2942", "Banquise", "Blizzard", "Le blizzard s'abat : chaque héros touché perd 1 PA (une chance sur deux) et le boss se couvre de givre.", { hit: (h, t) => { if (h.ch(0.5)) h.pa(t, 1); }, post: (h) => h.shield(h.e, 0.04) });
  add("m2864", "Gloursondulation", "Hibernation", "Sous 40 % de PV, se roule en boule une fois : il se soigne de 15 % et se protège.", { post: (h) => { if (!h.e.midHib && h.e.hp < h.e.hpMax * 0.4) { h.e.midHib = 1; h.heal(h.e, 0.15); h.shield(h.e, 0.08); h.log(`${h.e.name} hiberne un instant !`); } } });
  add("m3564", "Distorsion", "Ombre portée", "Son ombre frappe à son tour : un deuxième coup sur un héros au hasard, à 40 %.", { post: (h, ts, b) => { const t = h.rand(h.heroes()); if (t && b) { h.hit(t, b * 0.4, "e"); h.say(t, "m_peur"); } } });
  add("m4803", "Pelliste", "Trophée", "Si la cible tombe, il prend un trophée : +10 % de dégâts pour le reste du combat (3 au plus).", { hit: (h, t) => { if (!t.alive) { h.buff(10, 3, "mtroph"); h.log(`${h.e.name} ajoute un trophée à sa collection !`); } } });

  /* ——— niveau 200 ——— */
  add("m3397", "Glace sèche", "Fragment de Nileza", "Laisse un éclat de glace : la cible saigne 3 tours, et le saignement gèle 1 PA au dernier tour.", { hit: (h, t, d) => { h.bleed(t, d, 0.08, 3); h.later(3, (k) => { if (t.alive) k.pa(t, 1); }); } });
  add("m3409", "Poinçon", "Poinçon de Sylargh", "Poinçonne : la cible perd 1 PA et Sylargh se blinde d'un bouclier de 3 % de ses PV.", { hit: (h, t) => { h.pa(t, 1); h.shield(h.e, 0.03); } });
  add("m3384", "Cuir moustache", "Cuisson lente", "Le feu cuit lentement : la brûlure dure 3 tours et grossit à chaque tour.", { hit: (h, t, d) => { h.burn(t, d, 0.05, 1); h.later(1, (k) => { if (t.alive) k.burn(t, d, 0.1, 1); }); h.later(2, (k) => { if (t.alive) k.burn(t, d, 0.15, 1); }); } });
  add("m3391", "Sang froid", "Sang-froid", "Garde son sang-froid : sous 50 % de PV, elle prend 20 % de dégâts en moins pendant 2 tours après ce sort.", { post: (h) => { if (h.e.hp < h.e.hpMax * 0.5) { h.e.midShut = h.F.round + 2; h.e.midShutF = 0.2; h.say(h.e, "m_armure"); } } });
  add("m3416", "Multicomte", "Horloge du Comte", "Chaque coup avance l'horloge : la quatrième Multicomte frappe deux fois plus fort.", { mul: (h) => (((h.e.midClock || 0) % 4) === 3 ? 1 + 1 * h.p : 1), post: (h) => { h.e.midClock = (h.e.midClock || 0) + 1; h.say(h.e, "m_rage"); } });
  add("m4967", "Hantâme", "Âme hantée", "Hante la cible : elle prend 20 % de dégâts en plus et frappe 10 % moins fort pendant 2 tours.", { hit: (h, t) => { h.vuln(t, 20, 2); h.weak(t, 10, 2); } });
  add("m3534", "Sondage de Bronze", "Ancre de bronze", "Jette l'ancre : les héros touchés de l'arrière sont tirés en première ligne.", { hit: (h, t) => { if (h.row(t) === "b" && h.ch(0.5)) h.toFront(t); } });
  add("m3648", "Liquidation", "Or du roi", "Paie ses mercenaires : chaque héros touché lui rapporte un bouclier de 2 % de ses PV.", { post: (h, ts) => { h.e.shield = (h.e.shield || 0) + Math.round(h.e.hpMax * 0.02 * ts.length * h.p); h.say(h.e, "m_armure"); } });
  add("m3835", "Heuristique", "Tourbillon du Vortex", "Aspire un bonus de chaque héros touché et change de place deux héros au hasard.", { hit: (h, t) => { const b = t.buffs.findIndex((x) => x.turns < 50); if (b >= 0) t.buffs.splice(b, 1); }, post: (h) => { const l = h.heroes(); const a = h.rand(l); if (a) { if (h.row(a) === "f") h.toBack(a); else h.toFront(a); } } });
  add("m4263", "Toilette Ecaflip", "Pile ou face", "Joue à pile ou face : soit il frappe deux fois plus fort, soit il soigne la cible de 5 %.", { mul: (h) => { h.e.midCoin = rnd() < 0.55; return h.e.midCoin ? 1 + 1 * h.p : 0.2; }, hit: (h, t) => { if (!h.e.midCoin && t.alive) API().doHeal(t, t.hpMax * 0.05, h.F); } });
  add("m4744", "Transe-Perse", "Transe", "Perce les défenses : ignore le bouclier de la cible et la laisse saigner.", { mul: (h, t) => { if ((t.shield || 0) > 0) { t.midShieldKeep = t.shield; t.shield = 0; } return 1; }, hit: (h, t, d) => { if (t.midShieldKeep) { t.shield = t.midShieldKeep; t.midShieldKeep = 0; } h.bleed(t, d, 0.07, 2); } });
  add("m3828", "Électrocution", "Surcharge", "Électrocute : la cible ne peut plus soigner 2 tours, et l'éclair rebondit sur un héros en bouclier.", { hit: (h, t) => h.root(t, 2), post: (h, ts, b) => { const t = h.rand(h.heroes().filter((x) => (x.shield || 0) > 0 && !ts.includes(x))); if (t && b) { h.hit(t, b * 0.5, "a"); h.say(t, "m_eclair"); } } });
  add("m5110", "Pantang", "Gardienne des Pandala", "Tant qu'un autre monstre est debout, elle encaisse 25 % de dégâts en moins après ce sort.", { post: (h) => { h.e.midGuard = h.F.round + 1; h.say(h.e, "m_armure"); }, def: (h, v) => (h.e.midGuard >= h.F.round && h.mons().length > 1 ? v * (1 - 0.25 * h.p) : v) });
  add("m5319", "Ninflitration", "Infiltration", "Passe derrière les lignes : vise l'arrière et rend muette la cible.", { tgt: (h, ts, all, n) => { const bk = all.filter((t) => h.row(t) === "b"); return n <= 1 && bk.length ? [h.rand(bk)] : ts; }, hit: (h, t) => { if (h.ch(0.5)) h.silence(t, 1); } });
  add("m4460", "Matière Volatile", "Matière instable", "La matière explose au tour suivant sur la cible et ses voisins de ligne.", { hit: (h, t, d) => { h.later(1, (k) => k.heroes().filter((x) => k.row(x) === k.row(t)).forEach((x) => { k.hit(x, d * 0.4, "a"); k.say(x, "m_zone"); })); } });
  add("m4453", "Frappe Koutonienne", "Folie de Koutoulou", "Rend fou : une chance sur trois que la cible se blesse elle-même (−10 % de ses PV).", { hit: (h, t) => { if (t.alive && h.ch(0.33)) { t.hp = Math.max(1, t.hp - Math.round(t.hpMax * 0.1 * h.p)); h.say(t, "m_peur"); h.log(`${t.name} perd la raison un instant !`); } } });
  add("m4444", "Siphon d'Âme", "Siphon", "Aspire l'âme : le soin volé passe aussi aux autres monstres.", { hit: (h, t, d) => h.mons().forEach((m) => { const v = API().doHeal(m, d * 0.2 * h.p, h.F); if (v) h.say(m, "m_vampire"); }) });
  add("m4882", "Vampyrisme", "Goule", "Change la cible en goule : plus de soins pendant 2 tours, et la Shushess récupère 30 % des dégâts.", { hit: (h, t, d) => { h.noHeal(t, 2); h.drain(d, 0.3); } });
  add("m5100", "Aube Saine", "Midi solaire", "Le soleil monte : chaque lancer est 10 % plus fort que le précédent (jusqu'à +50 %).", { mul: (h) => 1 + 0.1 * h.p * Math.min(5, h.e.midSun || 0), post: (h) => { h.e.midSun = (h.e.midSun || 0) + 1; h.say(h.e, "m_rage"); } });
  add("m5666", "Spatule Tranche-Gourmands", "Régime", "Met la cible au régime : plus de soins pendant 2 tours, et elle frappe 10 % moins fort.", { hit: (h, t) => { h.noHeal(t, 2); h.weak(t, 10, 2); } });
  add("m5806", "Faisceau lunaire", "Phases de la lune", "Chaque faisceau change la lune : nouvelle lune = −1 PA, pleine lune = +30 % de dégâts.", { mul: (h) => ((h.e.midMoon || 0) % 2 === 1 ? 1 + 0.3 * h.p : 1), hit: (h, t) => { if ((h.e.midMoon || 0) % 2 === 0) h.pa(t, 1); }, post: (h) => { h.e.midMoon = (h.e.midMoon || 0) + 1; } });
  add("m6026", "Bêche corrompue", "Semis corrompu", "Sème la corruption : un rejeton corrompu sort de terre à côté du boss (2 au plus).", { post: (h) => { const m = h.summon(2, 0.06); if (m) h.log(`Un rejeton corrompu sort de terre !`); } });
  add("m5955", "Tyrannie", "Joug", "Asservit la cible : elle perd 1 PA et frappe 15 % moins fort tant que Servitude est debout.", { hit: (h, t) => { h.pa(t, 1); h.weak(t, 15, 2); } });
  add("m5990", "Grand Urubu", "Charognard", "Fond sur le héros le plus blessé : +40 % de dégâts sur un héros sous la moitié de ses PV.", { tgt: (h, ts, all, n) => (n <= 1 ? [h.low(all)] : ts), mul: (h, t) => (t.hp < t.hpMax * 0.5 ? 1 + 0.4 * h.p : 1) });
  add("m6014", "Magmaléfice", "Champ de bataille", "Laisse le sol en fusion : la première ligne brûle pendant 2 tours.", { post: (h, ts, b) => { if (b) h.heroes().filter((t) => h.row(t) === "f").forEach((t) => h.burn(t, b, 0.1, 2)); } });
  add("m6472", "Roque Papier Ciseaux", "Chifoumi", "Papier, pierre ou ciseaux : frappe 50 % plus fort, assomme, ou coupe le bouclier, au hasard.", { mul: (h) => { h.e.midRps = Math.floor(rnd() * 3); return h.e.midRps === 0 ? 1 + 0.5 * h.p : 1; }, hit: (h, t) => { if (h.e.midRps === 1 && h.ch(0.5)) h.stun(t); if (h.e.midRps === 2) h.strip(t); } });
  add("m6478", "Monarchie des Roses Noires", "Roses noires", "Les épines restent : chaque héros touché saigne 2 tours, et la Reine se soigne de 2 % par héros touché.", { hit: (h, t, d) => h.bleed(t, d, 0.06, 2), post: (h, ts) => h.heal(h.e, 0.02 * ts.length) });
  add("m6654", "Ratafia Putride", "Ratafia", "Enivre : le poison se cumule à chaque lancer (4 fois au plus) et la cible joue en dernier.", { hit: (h, t, d) => { if (t.dots.filter((x) => x.mrat).length < 4 && !t.noDot) { t.dots.push({ v: Math.max(1, d * 0.4 * h.p), turns: 3, el: null, src: h.e.name, mrat: 1 }); h.say(t, "m_poison"); } h.slow(t); } });
  add("m6792", "Poing de la Cité Sombre", "Conflit éternel", "Alterne Bonta et Brâkmar : un coup sur deux affaiblit (−20 %), l'autre rend vulnérable (+20 %).", { hit: (h, t) => { if ((h.e.midCity || 0) % 2) h.vuln(t, 20, 2); else h.weak(t, 20, 2); }, post: (h) => { h.e.midCity = (h.e.midCity || 0) + 1; } });
  add("m7210", "Déchainement fantasmagorique", "Charme fatal", "Charme un héros touché (une chance sur cinq) : il passe son tour et Belladone se soigne de 5 %.", { hit: (h, t) => { if (h.ch(0.2) && h.stun(t)) h.heal(h.e, 0.05); } });
  add("m8047", "Saut Impérieux", "Réveil du Vénérable", "Retombe lourdement : la première ligne est assommée une fois sur quatre, l'arrière perd 1 PA.", { hit: (h, t) => { if (h.row(t) === "f") { if (h.ch(0.25)) h.stun(t); } else h.pa(t, 1); } });
  add("m8037", "Atermoiement", "Atermoiement", "Retarde la douleur : la moitié des dégâts est différée et retombe au tour suivant.", { mul: () => 0.5, hit: (h, t, d) => { h.later(1, (k) => { if (t.alive) { k.hit(t, d * 1.1 / P(), null); k.say(t, "m_choc"); } }); } });

  /* ——— boss des donjons à plusieurs boss (variantes royales, Tynrils, Hanshi, Fuji, Xa) ——— */
  add("m430", "Royale Citron Os", "Acidité", "Le citron pique les yeux : chaque héros touché frappe 10 % moins fort et prend 10 % de dégâts en plus au tour suivant.", { hit: (h, t) => { h.weak(t, 10, 1); h.vuln(t, 10, 1); } });
  add("m86", "Royale Fraise Os", "Confiture brûlante", "La confiture colle et brûle : la cible brûle 2 tours et joue en dernier.", { hit: (h, t, d) => { h.burn(t, d, 0.1, 2); h.slow(t); } });
  add("m85", "Royale Menthe Os", "Fraîcheur mentholée", "Rafraîchit les gelées : chaque lancer soigne de 3 % les autres monstres.", { post: (h) => h.mons().filter((m) => m !== h.e).forEach((m) => h.heal(m, 0.03)) });
  add("m1186", "Blopunition Royale", "Éclaboussure indigo", "Éclabousse d'eau : la cible perd 1 PA, et le drain soigne tous les Blops.", { hit: (h, t, d) => { h.pa(t, 1); h.mons().filter((m) => m !== h.e).forEach((m) => { const v = API().doHeal(m, d * 0.2 * h.p, h.F); if (v) h.say(m, "m_soin"); }); } });
  add("m1187", "Blopunition Royale", "Pépins de reinette", "Crache des pépins : un second coup sur un héros de l'arrière, à 40 %.", { post: (h, ts, b) => { const t = h.rand(h.heroes().filter((x) => h.row(x) === "b")); if (t && b) { h.hit(t, b * 0.4, "t"); h.say(t, "m_marque"); } } });
  add("m1185", "Blopunition Royale", "Noyau de griotte", "Le noyau reste coincé : la cible saigne 2 tours, et elle est marquée pour les autres Blops.", { hit: (h, t, d) => { h.bleed(t, d, 0.07, 2); h.mark(t); } });
  add("m1072", "Helse", "Consternation", "Consterne : la cible ne peut plus lancer de sorts à recharge au tour suivant (une chance sur deux).", { hit: (h, t) => { if (h.ch(0.5)) h.silence(t, 1); } });
  add("m1085", "Helse", "Déconcertation", "Déconcerte : la cible change de ligne au hasard et perd 1 PA.", { hit: (h, t) => { if (h.row(t) === "f") h.toBack(t); else h.toFront(t); h.pa(t, 1); } });
  add("m1086", "Helse", "Perfidie", "Frappe dans le dos : +40 % de dégâts sur un héros de l'arrière.", { mul: (h, t) => (h.row(t) === "b" ? 1 + 0.4 * h.p : 1) });
  add("m6212", "Da Bàng", "Bâton du maître", "Le bâton désarme : la cible perd ses bonus et frappe 15 % moins fort pendant 2 tours.", { hit: (h, t) => { const b = t.buffs.length; t.buffs = t.buffs.filter((x) => x.turns > 50); h.weak(t, b ? 15 : 8, 2); } });
  add("m3234", "Foufoux", "Instinct maternel", "Protège sa portée : chaque Foufoux donne aux autres monstres +10 % de dégâts pendant 2 tours et un petit bouclier.", { post: (h) => h.mons().filter((m) => m !== h.e).forEach((m) => { h.tbuff(m, 10, 2); h.shield(m, 0.03); }) });
  add("m2992", "Cerebro", "Lecture des pensées", "Lit dans les pensées : vise le héros qui a le plus de bonus actifs et lui retire 1 PA.", { tgt: (h, ts, all, n) => (n <= 1 ? [all.slice().sort((a, b) => b.buffs.length - a.buffs.length)[0]] : ts), hit: (h, t) => h.pa(t, 1) });

  E.MID_U = U;
  E.midU = (e, sp) => { const u = U[e.key]; return u && sp && u.sp === sp.n ? u : null; };
  E.midKit = kit;
  /* début du tour du boss : effets différés, régénération */
  E.midUTurn = (F, e) => {
    if (e.midLater && e.midLater.length) { const now = e.midLater.filter((x) => x.r <= F.round); e.midLater = e.midLater.filter((x) => x.r > F.round); if (now.length && e.alive) { const h = kit(F, e, e.el === "n" ? null : e.el); now.forEach((x) => x.fn(h)); } }
    if (e.midRegen && e.midRegen.r >= F.round) { const h = kit(F, e, null); h.heal(e, e.midRegen.f); }
  };
  /* dégâts reçus par un boss qui porte une mécanique défensive */
  E.midUDef = (F, src, e, v, el) => {
    const u = U[e.key]; if (!u) return v; const h = kit(F, e, null);
    if (u.def) v = u.def(h, v, el);
    if (e.midShut >= F.round && e.midShutF) v *= 1 - e.midShutF * P();
    if (u.thorn && e.midThorn >= F.round && src && src.alive && src.side === "c") { const r = v * u.thorn * P(); if (r >= 1) { src.hp = Math.max(1, src.hp - Math.round(r)); } }
    return v;
  };
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
