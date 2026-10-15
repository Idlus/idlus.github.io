/* 1.3 « Refonte des sons » (choix de Mathis 1C 2A 3A 4A 5A 6A) : les sons de l'interface, du combat et des grands moments,
   composés pour Idlus et joués par le navigateur avec les instruments de js/musique.js (aucun fichier, rien d'Ankama).
   - L'interface parle « orchestre de poche » (cordes pincées, harpe, célesta, cor), avec un timbre par thème du jeu :
     Émeraude orchestre, Nuit violette vibraphone, Givre cristal, Ambre luth et flûte de bois, Braise enclume et cuivres, Écume gouttes et harpe, Halouine thérémine et orgue.
   - Trois volumes à soi : interface, combat, récompenses (le volume général et la musique restent dans js/musique.js).
   - Léger : rien ne tourne au silence, chaque son ne vit que le temps de sonner. Utilisé par js/ui.js (uiSnd, sndPlay, cbtSnd). */
(function () {
  const A = window.IdlusAudio; if (!A || !A._h) return; const H = A._h;
  const R = (a) => 1 + (Math.random() * 2 - 1) * a; // une petite variation à chaque fois, pour ne pas lasser

  /* ---------- briques ---------- */
  function rustle(t, f1, f2, len, v, o, q) { const c = H.ctx, n = c.createBufferSource(); n.buffer = H.noise(); const f = c.createBiquadFilter(), g = c.createGain(); f.type = "bandpass"; f.Q.value = q || 1.4;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + len); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + len * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(o); n.start(t, Math.random()); n.stop(t + len + 0.05); }
  function swell(t, f, len, v, o) { const c = H.ctx, n = c.createBufferSource(); n.buffer = H.noise(); const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = "bandpass"; fl.Q.value = 0.9; fl.frequency.setValueAtTime(f * 0.5, t); fl.frequency.exponentialRampToValueAtTime(f * 2, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.04); n.connect(fl); fl.connect(g); g.connect(o); n.start(t, Math.random()); n.stop(t + len + 0.1); }
  const pizz = (t, m, v, o) => H.pluck(t, m, 0.22, v, o, { damp: 0.985, cut: 2400, hp: 140, rel: 0.08 });
  const cel = (t, m, v, o, len) => H.bell(t, m, 0.6, v, o, { parts: [[1, 1, 0.9 * (len || 1)], [2, 0.1, 0.3], [4, 0.14, 0.18]] });
  const coin = (t, v, o) => H.bell(t, 100 + Math.floor(Math.random() * 7), 0.2, v, o, { parts: [[1, 1, 0.22], [2.76, 0.6, 0.14], [5.4, 0.35, 0.07], [8.9, 0.15, 0.04]] });
  const tri = (t, v, o) => H.drum(t, "tri", v, o);
  const drop = (t, m, v, o) => { const f = H.mtof(m); H.sweep(t, f * 0.6, f * 1.25, 0.07, v * 0.5, o); H.bell(t + 0.03, m, 0.3, v * 0.35, o, { parts: [[1, 1, 0.25], [2, 0.15, 0.1]] }); }; // goutte d'eau
  const anvil = (t, m, v, o) => H.bell(t, m, 0.3, v, o, { parts: [[1, 1, 0.3], [2.76, 0.5, 0.16], [5.4, 0.3, 0.08]] });

  /* ---------- un timbre par thème : pk note courte, gl note de harpe, sp étincelle, br voix chantée, ch accord, ex touche du thème ---------- */
  const minor = (m) => { const k = ((m % 12) + 12) % 12; return k === 4 || k === 9 || k === 11 ? m - 1 : m; }; // do majeur → do mineur
  const KIT = {
    emerald: { name: "Orchestre", pk: pizz, gl: (t, m, v, o) => H.harp(t, m, 0.5, v, o), sp: cel, br: (t, m, d, v, o) => H.horn(t, m, d, v, o, { att: 0.03, cut: 2200 }),
      ch: (t, ms, d, v, o) => H.strings(t, ms, d, v, o, { att: 0.1, rel: 0.5 }), ex: null },
    violet: { name: "Vibraphone", pk: (t, m, v, o) => H.vibes(t, m, v * 0.9, o), gl: (t, m, v, o) => H.vibes(t, m, v * 0.8, o), sp: (t, m, v, o, len) => cel(t, m, v, o, (len || 1) * 1.6),
      br: (t, m, d, v, o) => H.flute(t, m, d + 0.1, v * 1.6, o, { att: 0.04 }), ch: (t, ms, d, v, o) => H.choir(t, ms, d, v * 0.9, o, { vow: "u", att: 0.12, rel: 0.7 }),
      ex: (t, o) => [103, 98].forEach((m, i) => cel(t + 0.12 + i * 0.09, m, 0.15, o, 2)) }, // une étoile filante
    givre: { name: "Cristal", pk: (t, m, v, o) => H.bell(t, m + 12, 0.3, v * 0.6, o, { parts: [[1, 1, 0.35], [2.32, 0.4, 0.2], [4.1, 0.2, 0.1]] }), gl: (t, m, v, o) => H.glass(t, [m + 12], 0.12, v * 1.4, o, { att: 0.01 }),
      sp: (t, m, v, o, len) => H.bell(t, m + 12, 0.6, v * 0.8, o, { parts: [[1, 1, 1.1 * (len || 1)], [2.32, 0.3, 0.5], [4.1, 0.2, 0.3]] }),
      br: (t, m, d, v, o) => H.glass(t, [m + 12], d, v * 1.6, o, { att: 0.03 }), ch: (t, ms, d, v, o) => H.glass(t, ms.map((m) => m + 12), d, v * 2, o, { att: 0.08 }),
      ex: (t, o) => { for (let i = 0; i < 4; i++) H.bell(t + 0.1 + Math.random() * 0.25, 105 + Math.floor(Math.random() * 6), 0.2, 0.12, o, { parts: [[1, 1, 0.3]] }); } }, // flocons
    ambre: { name: "Luth et flûte", pk: (t, m, v, o) => H.pluck(t, m, 0.3, v, o, { damp: 0.993, cut: 2600, hp: 110, rel: 0.12 }), gl: (t, m, v, o) => H.pluck(t, m, 0.6, v * 0.9, o, { damp: 0.996, cut: 3000, hp: 90 }),
      sp: (t, m, v, o) => H.marimba(t, m - 12, v * 1.2, o), br: (t, m, d, v, o) => H.flute(t, m + 12, d + 0.08, v * 1.8, o, { att: 0.03 }),
      ch: (t, ms, d, v, o) => H.strings(t, ms, d, v, o, { att: 0.1, rel: 0.5, cut: 1800 }), ex: (t, o) => H.nz(t + 0.05, "bandpass", 1800, 1.2, 0.04, 0.15, o) }, // une page de grimoire
    braise: { name: "Forge", mode: minor, pk: (t, m, v, o) => { pizz(t, m - 12, v * 1.1, o); anvil(t, m + 12, v * 0.25, o); }, gl: (t, m, v, o) => H.pluck(t, m - 12, 0.5, v * 0.3, o, { damp: 0.994, cut: 2000, hp: 80, buzz: true }),
      sp: (t, m, v, o) => anvil(t, m, v * 0.7, o), br: (t, m, d, v, o) => H.horn(t, m - 12, d, v * 1.1, o, { att: 0.04, cut: 1400 }),
      ch: (t, ms, d, v, o) => H.strings(t, ms.map((m) => m - 12), d, v, o, { att: 0.08, rel: 0.5, cut: 1300 }), ex: (t, o) => { for (let i = 0; i < 5; i++) H.nz(t + 0.03 + Math.random() * 0.2, "highpass", 3500 + Math.random() * 2500, 0, 0.004, 0.18, o); } }, // braises qui crépitent
    ecume: { name: "Gouttes et harpe", pk: (t, m, v, o) => drop(t, m + 5, v * 1.3, o), gl: (t, m, v, o) => H.harp(t, m, 0.5, v, o), sp: (t, m, v, o, len) => { cel(t, m, v * 0.8, o, len); drop(t + 0.02, m - 7, v * 0.5, o); },
      br: (t, m, d, v, o) => H.flute(t, m, d + 0.08, v * 1.6, o, { att: 0.05 }), ch: (t, ms, d, v, o) => H.pad(t, ms, d, v * 4, o, { att: 0.15, cut: 1800 }),
      ex: (t, o) => { for (let i = 0; i < 3; i++) H.sweep(t + 0.05 + i * 0.06, 500 + i * 140, 950 + i * 160, 0.04, 0.14, o); } }, // bulles
    halouine: { name: "Thérémine et orgue", mode: minor, pk: pizz, gl: (t, m, v, o) => H.harp(t, m, 0.5, v, o), sp: (t, m, v, o, len) => H.bell(t, m - 12, 0.6, v * 0.9, o, { len: (len || 1) * 0.9 }),
      br: (t, m, d, v, o) => H.whistle(t, m, d + 0.1, v * 2, o, { sl: 3, slt: 0.12, vib: 0.02 }), ch: (t, ms, d, v, o) => H.organ(t, ms, d, v * 2.2, o, { att: 0.06, rel: 0.4 }),
      ex: (t, o) => H.whistle(t + 0.1, 84, 0.35, 0.25, o, { sl: 7, slt: 0.3, vib: 0.03 }) }, // un « wouuu » de fantôme
  };
  const THEMES = Object.keys(KIT);

  /* ---------- la partition de chaque son d'interface, jouée par le timbre du thème ---------- */
  const gliss = (K, t, ms, step, v, o) => ms.forEach((m, i) => K.gl(t + i * step, m, v * (0.8 + 0.2 * (i / ms.length)), o));
  const UI = {
    clic: (K, t, o) => K.pk(t, K.M(79), 0.24, o),
    page: (K, t, o) => gliss(K, t, [72, 76, 79, 84].map(K.M), 0.028, 0.32, o),
    famille: (K, t, o) => { K.gl(t, K.M(67), 0.35, o); K.gl(t + 0.05, K.M(74), 0.35, o); },
    onglet: (K, t, o) => K.pk(t, K.M(84), 0.26, o),
    inter: (K, t, o) => { K.pk(t, K.M(79), 0.25, o); K.pk(t + 0.06, K.M(86), 0.27, o); },
    decoche: (K, t, o) => { K.pk(t, K.M(86), 0.25, o); K.pk(t + 0.06, K.M(79), 0.25, o); },
    fenetre: (K, t, o) => { gliss(K, t, [67, 72, 76, 79, 84, 88].map(K.M), 0.022, 0.28, o); K.sp(t + 0.14, K.M(96), 0.3, o); if (K.ex) K.ex(t, o); },
    fermer: (K, t, o) => gliss(K, t, [84, 79, 72].map(K.M), 0.03, 0.26, o),
    recherche: (K, t, o) => [91, 95, 98].map(K.M).forEach((m, i) => K.sp(t + i * 0.045, m, 0.32, o, 0.6)),
    epingle: (K, t, o) => { K.pk(t, K.M(91), 0.26, o); tri(t + 0.01, 0.1, o); },
    theme: (K, t, o) => { K.ch(t, [60, 67, 72, 76].map(K.M), 0.35, 0.5, o); gliss(K, t + 0.05, [72, 76, 79, 84, 88, 91].map(K.M), 0.035, 0.3, o); if (K.ex) K.ex(t + 0.2, o); },
    erreur: (K, t, o) => { pizz(t, 55, 0.5, o); pizz(t + 0.12, 54, 0.5, o); H.horn(t + 0.12, 50, 0.18, 0.3, o, { att: 0.03, cut: 700 }); },
    message: (K, t, o) => { K.sp(t, K.M(88), 0.45, o); K.sp(t + 0.15, K.M(84), 0.42, o, 1.3); },
    butin: (K, t, o) => { [84, 88, 91, 96].map(K.M).forEach((m, i) => K.sp(t + i * 0.055, m, 0.42, o)); tri(t + 0.2, 0.18, o); },
    kamas: (K, t, o) => { K.pk(t, K.M(91), 0.35, o); H.bell(t + 0.06, 96, 0.3, 0.4, o, { len: 0.5 }); H.bell(t + 0.12, 100, 0.4, 0.45, o, { len: 0.7 }); },
    quete: (K, t, o) => { [[67, 0, 0.1], [72, 0.11, 0.1], [76, 0.22, 0.45]].forEach(([m, d, l]) => K.br(t + d, K.M(m), l, 0.55, o)); K.ch(t + 0.22, [60, 64, 67, 72].map(K.M), 0.6, 0.55, o); K.gl(t + 0.22, 48, 0.4, o); },
  };
  Object.values(KIT).forEach((K) => (K.M = K.mode || ((m) => m)));

  /* ---------- combat : le sort part, le coup arrive, et tout ce qui se passe autour ---------- */
  const CAST = {
    f: (t, o) => { rustle(t, 500, 2600, 0.22, 0.4, o, 0.8); for (let i = 0; i < 4; i++) H.nz(t + 0.03 + Math.random() * 0.16, "highpass", 3500 + Math.random() * 2500, 0, 0.004, 0.2, o); }, // flamme
    e: (t, o) => { H.sweep(t, 280, 880, 0.17, 0.3, o); for (let i = 0; i < 3; i++) H.sweep(t + 0.05 + i * 0.04, 700 + i * 160, 1200 + i * 200, 0.035, 0.12, o); }, // eau
    t: (t, o) => { H.nz(t, "lowpass", 260, 0, 0.12, 0.6, o, 0.09); H.hit(t + 0.08, 80, 55, 0.07, 0.4, o); H.nz(t + 0.02, "bandpass", 900, 2, 0.05, 0.12, o, 0.05); }, // roche
    a: (t, o) => rustle(t, 700, 4200, 0.2, 0.5, o, 1.6), // souffle
    n: (t, o) => rustle(t, 1400, 3200, 0.1, 0.4, o, 1.2),
  };
  const CBT = {
    cast: (t, o, el) => (CAST[el] || CAST.n)(t, o),
    impact: (t, o, el) => H.cbtPlay(el || "n", false, t, o),
    crit: (t, o, el) => { H.cbtPlay(el || "n", true, t, o); H.hit(t, 70, 40, 0.12, 0.45, o); },
    soin: (t, o) => { [79, 84, 88].forEach((m, i) => H.harp(t + i * 0.05, m, 0.5, 0.3, o)); cel(t + 0.15, 96, 0.22, o); },
    bouclier: (t, o) => { swell(t, 700, 0.12, 0.3, o); H.bell(t + 0.11, 67, 0.6, 0.35, o, { parts: [[1, 1, 0.6], [2.32, 0.5, 0.4], [4.1, 0.3, 0.25], [6.2, 0.15, 0.15]] }); },
    esquive: (t, o) => { rustle(t, 2600, 5200, 0.08, 0.35, o, 2); rustle(t + 0.05, 3800, 1800, 0.07, 0.2, o, 2); },
    invocation: (t, o) => { swell(t, 1500, 0.28, 0.35, o); pizz(t + 0.29, 84, 0.45, o); H.hit(t + 0.29, 300, 120, 0.05, 0.3, o); },
    poison: (t, o) => H.cbtPlay("dot", false, t, o),
    vaincu: (t, o) => { H.cbtPlay("ko", false, t, o); rustle(t + 0.08, 900, 300, 0.25, 0.18, o, 0.8); },
    tombe: (t, o) => { H.strings(t, [52, 55, 59], 0.6, 0.6, o, { att: 0.05, rel: 0.6, cut: 1400 }); H.strings(t + 0.3, [50, 53, 57], 0.5, 0.5, o, { att: 0.05, rel: 0.6, cut: 1200 }); H.drum(t, "low", 0.5, o); },
    phase: (t, o) => H.cbtPlay("phase", false, t, o),
    victoire: (t, o) => { [72, 76, 79].forEach((m, i) => H.harp(t + i * 0.06, m, 0.5, 0.35, o)); H.horn(t + 0.18, 79, 0.1, 0.5, o, { att: 0.02, cut: 2400 }); H.horn(t + 0.3, 84, 0.45, 0.55, o, { att: 0.03, cut: 2400 }); H.strings(t + 0.3, [60, 67, 72, 76], 0.5, 0.45, o, { att: 0.06, rel: 0.5 }); tri(t + 0.3, 0.12, o); },
    defaite: (t, o) => { [[64, 0, 0.3], [63, 0.32, 0.3], [62, 0.64, 0.7]].forEach(([m, d, l]) => H.horn(t + d, m - 12, l, 0.45, o, { att: 0.05, cut: 900 })); H.strings(t + 0.64, [50, 53, 57, 62], 0.9, 0.45, o, { att: 0.2, rel: 0.9, cut: 1200 }); H.drum(t + 0.64, "low", 0.6, o); },
  };

  /* ---------- les moments du jeu ; le son grandit avec la rareté ---------- */
  const EVT = {
    succes: (t, o) => { [72, 76, 79, 84].forEach((m, i) => cel(t + i * 0.06, m + 12, 0.38, o)); H.choir(t + 0.2, [60, 64, 67, 72], 0.6, 0.45, o, { vow: "a", att: 0.15, rel: 0.8 }); tri(t + 0.2, 0.15, o); },
    craft: (t, o) => { H.drum(t, "anvil", 0.45, o); H.drum(t + 0.16, "anvil", 0.5, o); [88, 93].forEach((m, i) => cel(t + 0.3 + i * 0.05, m, 0.3, o)); },
    fm_ok: (t, o) => { H.glass(t, [76], 0.2, 0.7, o); H.glass(t + 0.12, [83], 0.4, 0.7, o); [88, 91, 95].forEach((m, i) => cel(t + 0.2 + i * 0.05, m, 0.32, o)); },
    fm_ko: (t, o) => { H.glass(t, [76], 0.2, 0.6, o); H.nz(t + 0.2, "highpass", 2500, 0, 0.05, 0.5, o); for (let i = 0; i < 5; i++) coin(t + 0.22 + i * 0.03, 0.15, o); H.hit(t + 0.2, 160, 90, 0.08, 0.4, o); },
    vente: (t, o) => { for (let i = 0; i < 5; i++) coin(t + i * 0.05, 0.5 - i * 0.05, o); H.bell(t + 0.32, 98, 0.6, 0.45, o, { parts: [[1, 1, 0.7], [2.4, 0.5, 0.4], [3.9, 0.3, 0.3]] }); },
    coffre: (t, o) => { const c = H.ctx, os = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); os.type = "sawtooth"; os.frequency.setValueAtTime(95, t); os.frequency.linearRampToValueAtTime(70, t + 0.35); // le couvercle grince
      f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38); os.connect(f); f.connect(g); g.connect(o); os.start(t); os.stop(t + 0.4);
      H.hit(t + 0.36, 120, 80, 0.06, 0.45, o); [84, 88, 91, 96, 100].forEach((m, i) => cel(t + 0.42 + i * 0.05, m, 0.35, o)); tri(t + 0.6, 0.15, o); },
    monture: (t, o) => { [0, 0.09, 0.16, 0.3, 0.39, 0.46].forEach((d, i) => H.drum(t + d, i % 3 === 2 ? "conga2" : "conga", 0.45, o)); H.horn(t + 0.55, 67, 0.12, 0.5, o, { att: 0.02, cut: 2400 }); H.horn(t + 0.68, 74, 0.12, 0.5, o, { att: 0.02, cut: 2400 }); H.horn(t + 0.81, 79, 0.5, 0.55, o, { att: 0.03, cut: 2400 }); },
    code: (t, o) => { rustle(t, 900, 3200, 0.18, 0.35, o); H.nz(t + 0.18, "bandpass", 3000, 2, 0.02, 0.3, o); [79, 84, 88, 91, 96].forEach((m, i) => cel(t + 0.22 + i * 0.045, m, 0.36, o)); },
    etage: (t, o) => { H.timp(t, 43, 0.6, o); H.timp(t + 0.18, 50, 0.6, o); H.choir(t + 0.18, [55, 62, 67, 71], 0.9, 0.5, o, { vow: "o", att: 0.25, rel: 1 }); H.strings(t + 0.18, [67, 74, 79], 0.9, 0.45, o, { att: 0.2, rel: 0.8 }); },
    rel_commune: (t, o) => cel(t, 88, 0.35, o),
    rel_rare: (t, o) => { cel(t, 84, 0.35, o); cel(t + 0.07, 91, 0.38, o); },
    rel_epique: (t, o) => { [79, 84, 88, 91, 96].forEach((m, i) => cel(t + i * 0.05, m, 0.36, o)); H.pad(t + 0.2, [67, 71, 74, 79], 0.6, 2.2, o, { att: 0.15, cut: 2200 }); },
    rel_legendaire: (t, o) => { swell(t, 2500, 0.35, 0.25, o); [76, 79, 84, 88, 91, 96, 100].forEach((m, i) => cel(t + 0.35 + i * 0.045, m, 0.38, o)); H.choir(t + 0.35, [60, 64, 67, 72], 1.1, 0.55, o, { vow: "a", att: 0.1, rel: 1.2 }); H.drum(t + 0.35, "gong", 0.25, o); H.drum(t + 0.35, "bdrum", 0.4, o); },
    koli_v: (t, o) => { swell(t, 1300, 0.25, 0.3, o); for (let i = 0; i < 6; i++) H.drum(t + 0.25 + i * 0.12 + Math.random() * 0.03, "clap", 0.35, o); H.horn(t + 0.25, 72, 0.12, 0.5, o, { att: 0.02, cut: 2400 }); H.horn(t + 0.38, 79, 0.45, 0.55, o, { att: 0.03, cut: 2400 }); },
    koli_d: (t, o) => { H.choir(t, [60, 64, 67], 0.7, 0.45, o, { vow: "o", att: 0.1, rel: 0.6, sl: -4, slt: 0.6 }); H.horn(t + 0.3, 50, 0.4, 0.35, o, { att: 0.05, cut: 700 }); },
    rare: (t, o) => [88, 92, 95].forEach((m, i) => cel(t + i * 0.05, m, 0.4, o)),
    epique: (t, o) => { [84, 88, 91, 96].forEach((m, i) => cel(t + i * 0.05, m, 0.4, o)); H.choir(t + 0.15, [64, 67, 71, 76], 0.4, 0.35, o, { vow: "a", att: 0.08, rel: 0.6 }); },
    legendaire: (t, o) => { [76, 80, 83, 88, 92, 95].forEach((m, i) => cel(t + i * 0.05, m, 0.42, o)); H.strings(t + 0.25, [64, 68, 71, 76], 0.8, 0.5, o, { att: 0.08, rel: 0.8 }); H.drum(t + 0.25, "crash", 0.25, o); },
    niveau: (t, o) => H.SFX.fanfare.niveau(t, o), donjon: (t, o) => H.SFX.fanfare.donjon(t, o), dofus: (t, o) => H.SFX.fanfare.dofus(t, o), // quand les fanfares sont coupées
  };

  /* ---------- volumes mesurés (rendu hors ligne, pondération K) : chaque son aussi présent que les autres de sa famille ---------- */
  const LV = {"ui:clic:emerald":3.88,"ui:clic:violet":1.36,"ui:clic:givre":2.8,"ui:clic:ambre":1.44,"ui:clic:braise":1.42,"ui:clic:ecume":3.62,"ui:clic:halouine":2.18,"ui:page:emerald":0.99,"ui:page:violet":1.18,"ui:page:givre":1,"ui:page:ambre":1.14,"ui:page:braise":0.65,"ui:page:ecume":0.83,"ui:page:halouine":0.62,"ui:famille:emerald":0.75,"ui:famille:violet":1.4,"ui:famille:givre":1.25,"ui:famille:ambre":0.87,"ui:famille:braise":0.52,"ui:famille:ecume":1,"ui:famille:halouine":0.69,"ui:onglet:emerald":2.17,"ui:onglet:violet":1.19,"ui:onglet:givre":2.28,"ui:onglet:ambre":1.86,"ui:onglet:braise":1.37,"ui:onglet:ecume":3.02,"ui:onglet:halouine":2.84,"ui:inter:emerald":1.14,"ui:inter:violet":0.91,"ui:inter:givre":1.57,"ui:inter:ambre":0.74,"ui:inter:braise":0.73,"ui:inter:ecume":1.97,"ui:inter:halouine":1.12,"ui:decoche:emerald":1.04,"ui:decoche:violet":0.92,"ui:decoche:givre":1.69,"ui:decoche:ambre":1.08,"ui:decoche:braise":0.76,"ui:decoche:ecume":2.14,"ui:decoche:halouine":1.4,"ui:fenetre:emerald":0.7,"ui:fenetre:violet":0.72,"ui:fenetre:givre":0.7,"ui:fenetre:ambre":0.8,"ui:fenetre:braise":0.49,"ui:fenetre:ecume":0.7,"ui:fenetre:halouine":0.64,"ui:fermer:emerald":1.01,"ui:fermer:violet":1.71,"ui:fermer:givre":1.49,"ui:fermer:ambre":1.05,"ui:fermer:braise":0.83,"ui:fermer:ecume":1.07,"ui:fermer:halouine":1.18,"ui:recherche:emerald":0.51,"ui:recherche:violet":0.44,"ui:recherche:givre":0.54,"ui:recherche:ambre":0.57,"ui:recherche:braise":0.97,"ui:recherche:ecume":0.64,"ui:recherche:halouine":0.59,"ui:epingle:emerald":2.09,"ui:epingle:violet":0.95,"ui:epingle:givre":2.41,"ui:epingle:ambre":1.1,"ui:epingle:braise":1.82,"ui:epingle:ecume":1.87,"ui:epingle:halouine":2.1,"ui:theme:emerald":0.63,"ui:theme:violet":0.81,"ui:theme:givre":0.49,"ui:theme:ambre":0.85,"ui:theme:braise":0.51,"ui:theme:ecume":0.73,"ui:theme:halouine":0.52,"ui:erreur:emerald":0.39,"ui:erreur:violet":0.43,"ui:erreur:givre":0.43,"ui:erreur:ambre":0.44,"ui:erreur:braise":0.46,"ui:erreur:ecume":0.44,"ui:erreur:halouine":0.48,"ui:message:emerald":0.85,"ui:message:violet":0.72,"ui:message:givre":0.72,"ui:message:ambre":1.07,"ui:message:braise":1.84,"ui:message:ecume":1.02,"ui:message:halouine":0.91,"ui:butin:emerald":1.15,"ui:butin:violet":0.97,"ui:butin:givre":1.03,"ui:butin:ambre":1.41,"ui:butin:braise":2.19,"ui:butin:ecume":1.41,"ui:butin:halouine":1.19,"ui:kamas:emerald":1.25,"ui:kamas:violet":1.12,"ui:kamas:givre":1.2,"ui:kamas:ambre":1.2,"ui:kamas:braise":1.16,"ui:kamas:ecume":1.18,"ui:kamas:halouine":1.08,"ui:quete:emerald":0.81,"ui:quete:violet":0.4,"ui:quete:givre":0.79,"ui:quete:ambre":0.29,"ui:quete:braise":0.79,"ui:quete:ecume":0.4,"ui:quete:halouine":0.51,"cbt:cast:f":1.59,"cbt:cast:e":1.45,"cbt:cast:t":0.39,"cbt:cast:a":3.13,"cbt:cast:n":3.85,"cbt:impact:f":1.44,"cbt:impact:e":1.54,"cbt:impact:t":0.7,"cbt:impact:a":2.48,"cbt:impact:n":1.2,"cbt:crit:f":0.93,"cbt:crit:e":0.97,"cbt:crit:t":0.75,"cbt:crit:a":0.94,"cbt:crit:n":0.9,"cbt:soin":1.18,"cbt:bouclier":1.86,"cbt:esquive":4.76,"cbt:invocation":1.16,"cbt:poison":3.48,"cbt:vaincu":0.7,"cbt:tombe":1.02,"cbt:phase":0.94,"cbt:victoire":0.95,"cbt:defaite":0.77,"evt:succes":0.96,"evt:craft":1.59,"evt:fm_ok":1.08,"evt:fm_ko":0.85,"evt:vente":1.06,"evt:coffre":0.76,"evt:monture":0.68,"evt:code":0.98,"evt:etage":0.64,"evt:rel_commune":1.31,"evt:rel_rare":1.13,"evt:rel_epique":0.94,"evt:rel_legendaire":0.8,"evt:koli_v":0.96,"evt:koli_d":1.19,"evt:rare":1.13,"evt:epique":0.96,"evt:legendaire":0.82,"evt:niveau":0.59,"evt:donjon":0.49,"evt:dofus":0.49};
  /* ---------- trois bus : interface, combat, récompenses ---------- */
  const CATS = { ui: "interface", cbt: "combat", evt: "recompenses" }; const vol = { interface: 0.5, combat: 0.5, recompenses: 0.8 };
  let bctx = null; const bus = {}; let voices = 0;
  function out(cat) { const c = H.ctx; if (bctx !== c) { bctx = c; voices = 0; Object.values(CATS).forEach((k) => { bus[k] = c.createGain(); bus[k].gain.value = vol[k]; bus[k].connect(H.sfx); }); } return bus[cat]; }
  function play(id, at) { // id : « ui:givre:page », « cbt:cast:f », « evt:coffre »
    if (!H.init()) return false; const [k, a, b] = id.split(":"), cat = CATS[k]; if (!cat) return false;
    const fn = k === "ui" ? UI[b] && KIT[a] && ((t, o) => UI[b](KIT[a], t, o)) : k === "cbt" ? CBT[a] && ((t, o) => CBT[a](t, o, b)) : EVT[a];
    if (!fn) return false; const dst = out(cat); if (voices >= 12) return false; // plafond : jamais plus de 12 sons à la fois
    const c = H.ctx, t = at == null ? c.currentTime + 0.01 : at, g = c.createGain(); g.gain.value = (LV[k === "ui" ? `ui:${b}:${a}` : id] || LV[k === "ui" ? `ui:${b}` : id] || 1) * R(0.05); g.connect(dst);
    try { fn(t, g); } catch (e) { g.disconnect(); return false; }
    voices++; setTimeout(() => { voices--; try { g.disconnect(); } catch (e) {} }, 4000 + Math.max(0, t - c.currentTime) * 1000);
    return true;
  }
  window.SONS = { THEMES, KIT, UI, CBT, EVT, play, vol,
    themeName: (t) => (KIT[t] ? KIT[t].name : ""),
    setVol(o) { Object.assign(vol, o); if (bctx === H.ctx) Object.keys(o).forEach((k) => bus[k] && bus[k].gain.setTargetAtTime(vol[k], bctx.currentTime, 0.05)); } };
})();
