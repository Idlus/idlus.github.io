/* 1.0.22 : musique et sons composés pour Idlus, joués par le navigateur (Web Audio) : aucun fichier, aucune œuvre d'Ankama. Utilisé par js/ui.js (sndPlay, musSync) */
(function () {
  const A = {};
  let ctx = null, master, musicBus, sfxBus, reverb, seq = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a) => (Math.random() * 2 - 1) * a;

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); graph(); return ctx;
  }
  function graph() {
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(2.8, 2.4);
    const rv = ctx.createGain(); rv.gain.value = 0.9; reverb.connect(rv); rv.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    const ms = ctx.createGain(); ms.gain.value = 0.28; musicBus.connect(ms); ms.connect(reverb);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    const ss = ctx.createGain(); ss.gain.value = 0.16; sfxBus.connect(ss); ss.connect(reverb);
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  let noiseBuf = null;
  function noise() { if (noiseBuf) return noiseBuf; const n = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }
  function env(g, t, v, att, len, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + att); g.gain.setTargetAtTime(0.0001, t + Math.max(att, len), rel); }

  /* ---------- instruments ---------- */
  const ks = {};
  function ksBuf(m, damp) {
    const key = m + "_" + damp; if (ks[key]) return ks[key];
    const sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / mtof(m) - 0.5)), len = Math.floor(sr * 2.4);
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let k = 0; k < 2; k++) for (let i = 0; i < N; i++) ring[i] = (ring[i] + ring[(i + 1) % N]) * 0.5; // attaque plus douce
    let p = 0; for (let i = 0; i < len; i++) { const a = ring[p]; d[i] = a; ring[p] = (a + ring[(p + 1) % N]) * 0.5 * damp; p = (p + 1) % N; }
    return (ks[key] = b);
  }
  // luth / harpe (corde pincée)
  function pluck(t, m, d, v, dest, o = {}) {
    const s = ctx.createBufferSource(); s.buffer = ksBuf(m, o.damp || 0.996);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.cut || 3200;
    const g = ctx.createGain(); g.gain.setValueAtTime(v * 1.6, t); g.gain.setTargetAtTime(0.0001, t + d, 0.25);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + d + 1.4);
  }
  // flûte en bois
  function flute(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.cut || 2600;
    const parts = [[1, 1, "sine"], [2, 0.18, "sine"], [3, 0.06, "sine"]];
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.007, t + Math.min(0.5, d)); lfo.connect(lg);
    parts.forEach(([k, a, type]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = type; os.frequency.value = f0 * k; og.gain.value = a; lg.connect(os.frequency); os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + 0.6); });
    const n = ctx.createBufferSource(); n.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f0 * 2; bp.Q.value = 1.2;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.25, t + 0.04); ng.gain.setTargetAtTime(0.03, t + 0.06, 0.08); ng.gain.setTargetAtTime(0.0001, t + d, 0.08);
    n.connect(bp); bp.connect(ng); ng.connect(lp); n.start(t); n.stop(t + d + 0.5);
    lfo.start(t); lfo.stop(t + d + 0.6);
    env(g, t, v * 0.5, o.att || 0.07, d, 0.09); lp.connect(g); g.connect(dest);
  }
  // cor (cuivre doux, pour le donjon et la fanfare)
  function horn(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(o.cut || 1400, t + (o.att || 0.12)); lp.frequency.setTargetAtTime(o.cut ? o.cut * 0.7 : 900, t + 0.2, 0.3);
    [-4, 4].forEach((c) => { const os = ctx.createOscillator(); os.type = "sawtooth"; os.frequency.value = f0; os.detune.value = c; os.connect(lp); os.start(t); os.stop(t + d + 0.6); });
    env(g, t, v * 0.33, o.att || 0.12, d, 0.12); lp.connect(g); g.connect(dest);
  }
  // nappe de cordes
  function pad(t, ms, d, v, dest, o = {}) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.cut || 1000; lp.Q.value = 0.4;
    ms.forEach((m) => [-7, 7].forEach((c) => { const os = ctx.createOscillator(); os.type = "sawtooth"; os.frequency.value = mtof(m); os.detune.value = c + rnd(2); os.connect(lp); os.start(t); os.stop(t + d + 2); }));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05 / Math.sqrt(ms.length), t + (o.att || 0.9)); g.gain.setValueAtTime(v * 0.05 / Math.sqrt(ms.length), t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 1.4);
    lp.connect(g); g.connect(dest);
  }
  // cloche / boîte à musique / cristal
  function bell(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), parts = o.parts || [[1, 1, 1.6], [2, 0.32, 0.6], [3.01, 0.12, 0.35], [4.2, 0.06, 0.2]];
    parts.forEach(([k, a, dec]) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = "sine"; os.frequency.value = f0 * k;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * a * 0.35, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.005, dec * (o.len || 1) / 3);
      os.connect(g); g.connect(dest); os.start(t); os.stop(t + dec * (o.len || 1) * 2 + 0.2); });
  }
  // marimba (bois)
  function marimba(t, m, v, dest, o = {}) { bell(t, m, 0.4, v, dest, { parts: [[1, 1, o.dec || 0.5], [3.93, 0.18, 0.08], [9.2, 0.05, 0.03]] }); }
  // basse douce
  function bass(t, m, d, v, dest) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    [["triangle", 1], ["sine", 0.8]].forEach(([type, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = type; os.frequency.value = f0; og.gain.value = a; os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + 0.6); });
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.42, t + 0.015); g.gain.setTargetAtTime(v * 0.18, t + 0.05, 0.4); g.gain.setTargetAtTime(0.0001, t + d, 0.12);
    lp.connect(g); g.connect(dest);
  }
  // tambourin et grosse caisse en peau
  function drum(t, kind, v, dest) {
    if (kind === "low") {
      const os = ctx.createOscillator(), g = ctx.createGain(); os.type = "sine"; os.frequency.setValueAtTime(120, t); os.frequency.exponentialRampToValueAtTime(52, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.9, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.13);
      os.connect(g); g.connect(dest); os.start(t); os.stop(t + 0.8);
    }
    const n = ctx.createBufferSource(); n.buffer = noise(); const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === "low") { f.type = "lowpass"; f.frequency.value = 380; } else if (kind === "jingle") { f.type = "highpass"; f.frequency.value = 6500; } else { f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.9; }
    const dec = kind === "jingle" ? 0.06 : kind === "low" ? 0.07 : 0.025, a = kind === "low" ? 0.5 : kind === "jingle" ? 0.22 : 0.3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * a, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.005, dec);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + 0.5);
  }
  function voice(e, t, spb, dest) {
    const d = e.d * spb, v = (e.v || 0.7) * (1 + rnd(0.08)); t += rnd(0.006);
    if (e.i === "pluck") pluck(t, e.m, d, v, dest, e.o); else if (e.i === "flute") flute(t, e.m, d, v, dest, e.o); else if (e.i === "horn") horn(t, e.m, d, v, dest, e.o);
    else if (e.i === "pad") pad(t, e.m, d, v, dest, e.o); else if (e.i === "bell") bell(t, e.m, d, v, dest, e.o); else if (e.i === "bass") bass(t, e.m, d, v, dest);
    else if (e.i === "drum") drum(t, e.m, v, dest);
  }

  /* ---------- morceaux ---------- */
  const C = (r, t) => ({ r, t }); // racine, tierce (3 mineure, 4 majeure)
  function melodyEv(bars, bpb, inst, v, shift = 0, o) {
    const ev = []; bars.forEach((bar, i) => { let b = i * bpb; bar.forEach(([m, d]) => { if (m) ev.push({ b, i: inst, m: m + shift, d: d * 0.95, v, o }); b += d; }); }); return ev;
  }
  const TRACKS = {
    foret: { name: "Forêt d'Amakna", bpm: 76, bpb: 4,
      ch: [C(55, 4), C(45, 4), C(47, 3), C(52, 3), C(48, 4), C(45, 4), C(50, 4), C(50, 4)],
      mel: [[[74, 2], [71, 1], [69, 1]], [[73, 3], [76, 1]], [[78, 2], [74, 2]], [[76, 4]], [[79, 1.5], [76, 0.5], [72, 2]], [[73, 2], [69, 1], [76, 1]], [[78, 2], [76, 1], [74, 1]], [[69, 4]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4, off = [0, 7, 12, c.t + 12, 19, c.t + 12, 12, 7];
          off.forEach((o, k) => ev.push({ b: b0 + k * 0.5, i: "pluck", m: c.r + o, d: 1.6, v: k === 0 ? 0.55 : 0.38 }));
          ev.push({ b: b0, i: "pad", m: [c.r + 12, c.r + 12 + c.t, c.r + 19], d: 4, v: 0.9 }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: 3.6, v: 0.6 }); });
        if (p > 0) ev.push(...(p % 3 === 0 ? melodyEv(this.mel, 4, "pluck", 0.75, 0, { damp: 0.997, cut: 4200 }) : melodyEv(this.mel, 4, "flute", 0.8)));
        return ev.sort((a, b) => a.b - b.b); } },
    taverne: { name: "Taverne d'Astrub", gain: 0.72, bpm: 132, bpb: 3,
      ch: [C(50, 3), C(48, 4), C(50, 3), C(45, 3), C(53, 4), C(48, 4), C(55, 4), C(45, 3), C(50, 3), C(48, 4), C(50, 3), C(45, 3), C(53, 4), C(55, 4), C(45, 3), C(50, 3)],
      mel: [[[69, 1], [74, 1], [76, 0.5], [77, 0.5]], [[76, 1], [72, 1], [67, 1]], [[69, 0.5], [71, 0.5], [72, 0.5], [74, 0.5], [76, 1]], [[72, 2], [69, 1]], [[77, 1], [76, 0.5], [74, 0.5], [72, 1]], [[76, 1], [79, 1], [76, 1]], [[74, 1], [71, 1], [67, 0.5], [69, 0.5]], [[69, 3]],
        [[74, 1], [77, 1], [81, 1]], [[79, 1], [76, 0.5], [79, 0.5], [72, 1]], [[77, 0.5], [76, 0.5], [74, 1], [69, 1]], [[72, 1], [76, 1], [81, 1]], [[81, 0.5], [79, 0.5], [77, 1], [72, 1]], [[71, 1], [74, 1], [79, 1]], [[76, 1], [72, 0.5], [71, 0.5], [69, 1]], [[74, 3]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 3; [0, 7, 12, c.t + 12, 19, 12].forEach((o, k) => ev.push({ b: b0 + k * 0.5, i: "pluck", m: c.r + o, d: 1, v: k === 0 ? 0.5 : 0.34, o: { cut: 2600, damp: 0.994 } }));
          ev.push({ b: b0, i: "bass", m: c.r - 12, d: 2.6, v: 0.55 }); ev.push({ b: b0, i: "drum", m: "low", d: 0.5, v: 0.55 }); ev.push({ b: b0 + 1, i: "drum", m: "tap", d: 0.5, v: 0.4 }); ev.push({ b: b0 + 2, i: "drum", m: "tap", d: 0.5, v: 0.4 }); ev.push({ b: b0 + 2.5, i: "drum", m: "jingle", d: 0.5, v: 0.35 }); });
        ev.push(...(p % 3 === 2 ? melodyEv(this.mel, 3, "pluck", 0.7, 0, { damp: 0.996, cut: 4000 }) : melodyEv(this.mel, 3, "flute", 0.75)));
        return ev.sort((a, b) => a.b - b.b); } },
    boite: { name: "Boîte à musique du Havre-Sac", gain: 1.4, bpm: 88, bpb: 3,
      ch: [C(53, 4), C(48, 4), C(50, 3), C(46, 4), C(53, 4), C(48, 4), C(46, 4), C(48, 4)],
      mel: [[[72, 1], [69, 1], [77, 1]], [[76, 2], [72, 1]], [[74, 1], [77, 1], [81, 1]], [[79, 2], [77, 0.5], [74, 0.5]], [[72, 1], [77, 1], [81, 1]], [[79, 1], [76, 1], [72, 1]], [[77, 1], [74, 1], [70, 1]], [[76, 1], [79, 1], [76, 1]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 3; ev.push({ b: b0, i: "pluck", m: c.r, d: 2.8, v: 0.45, o: { cut: 1800 } });
          [1, 2].forEach((k) => [c.r + 12 + c.t, c.r + 19].forEach((m) => ev.push({ b: b0 + k, i: "pluck", m, d: 0.9, v: 0.22, o: { cut: 2200 } })));
          ev.push({ b: b0, i: "pad", m: [c.r + 12, c.r + 12 + c.t, c.r + 19], d: 3, v: 0.6, o: { cut: 800 } });
          if (p % 2 === 1) ev.push({ b: b0, i: "flute", m: c.r + 24 + c.t, d: 2.8, v: 0.35, o: { att: 0.4 } }); });
        ev.push(...melodyEv(this.mel, 3, "bell", 0.75, 12, { len: 1.4 }));
        return ev.sort((a, b) => a.b - b.b); } },
    donjon: { name: "Profondeurs du donjon", bpm: 64, bpb: 4,
      ch: [C(50, 3), C(51, 4), C(50, 3), C(48, 4), C(46, 4), C(51, 4), C(50, 3), C(45, 4)],
      mel: [[[69, 3], [65, 1]], [[67, 2], [70, 2]], [[69, 4]], [[67, 2], [64, 2]], [[65, 2], [62, 1], [65, 1]], [[67, 2], [63, 2]], [[62, 2], [65, 1], [69, 1]], [[73, 2], [69, 2]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4;
          ev.push({ b: b0, i: "pad", m: [c.r - 12, c.r - 5, c.r, c.r + c.t], d: 4, v: 1.1, o: { cut: 600 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: 3.8, v: 0.7 });
          [0, 7, 12, c.t + 12].forEach((o, k) => ev.push({ b: b0 + k, i: "pluck", m: c.r + o, d: 1.2, v: 0.3, o: { cut: 1500, damp: 0.993 } }));
          ev.push({ b: b0, i: "drum", m: "low", d: 1, v: 0.8 }); ev.push({ b: b0 + 2, i: "drum", m: "low", d: 1, v: 0.4 }); ev.push({ b: b0 + 3.5, i: "drum", m: "low", d: 1, v: 0.3 }); });
        if (p > 0) ev.push(...(p % 3 === 0 ? melodyEv(this.mel, 4, "bell", 0.6, 12, { len: 1.6 }) : melodyEv(this.mel, 4, "horn", 0.8)));
        return ev.sort((a, b) => a.b - b.b); } },
  };
  Object.values(TRACKS).forEach((T) => (T.len = T.ch.length * T.bpb));

  function tick() {
    const s = seq; if (!s) return; const spb = 60 / s.T.bpm, horizon = ctx.currentTime + 0.5;
    for (let guard = 0; guard < 400; guard++) {
      if (s.idx >= s.ev.length) { s.start += s.T.len * spb; s.pass++; s.ev = s.T.build(s.pass); s.idx = 0; }
      const e = s.ev[s.idx], t = s.start + e.b * spb; if (t > horizon) break;
      if (t >= ctx.currentTime - 0.02) voice(e, t, spb, s.out); s.idx++;
    }
  }
  A.play = function (id) {
    if (!init()) return; A.stop(0.6); const T = TRACKS[id]; if (!T) return;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(T.gain || 1, ctx.currentTime + 1.5); out.connect(musicBus);
    seq = { id, T, pass: 0, start: ctx.currentTime + 0.12, ev: T.build(0), idx: 0, out }; seq.timer = setInterval(tick, 60); tick();
  };
  A.stop = function (fade = 1) {
    if (!seq) return; const s = seq; seq = null; clearInterval(s.timer);
    try { s.out.gain.cancelScheduledValues(ctx.currentTime); s.out.gain.setValueAtTime(s.out.gain.value, ctx.currentTime); s.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade); } catch (e) {}
    setTimeout(() => { try { s.out.disconnect(); } catch (e) {} }, fade * 1000 + 3000);
  };
  A.playing = () => (seq ? seq.id : null);
  A.tracks = Object.fromEntries(Object.entries(TRACKS).map(([k, T]) => [k, T.name]));
  A.setMusicVol = (v) => { if (init()) musicBus.gain.setTargetAtTime(0.55 * v, ctx.currentTime, 0.05); };
  A.setSfxVol = (v) => { if (init()) sfxBus.gain.setTargetAtTime(0.7 * v, ctx.currentTime, 0.05); };

  /* ---------- sons du jeu, 3 styles ---------- */
  const SFX = {
    bois: {
      clic: (t, o) => { marimba(t, 91, 0.35, o, { dec: 0.12 }); drum(t, "tap", 0.25, o); },
      victoire: (t, o) => { marimba(t, 79, 0.7, o); marimba(t + 0.09, 84, 0.8, o); },
      butin: (t, o) => { [88, 92, 95, 100].forEach((m, i) => bell(t + i * 0.06, m, 0.5, 0.55, o, { len: 0.8 })); drum(t + 0.2, "jingle", 0.4, o); },
      niveau: (t, o) => { [60, 62, 64, 65, 67, 69, 71, 72, 74, 76].forEach((m, i) => pluck(t + i * 0.035, m + 12, 1.2, 0.5, o, { damp: 0.997, cut: 5000 })); [72, 76, 79, 84].forEach((m) => bell(t + 0.42, m, 1, 0.45, o, { len: 1.4 })); },
      donjon: (t, o) => { drum(t, "low", 0.8, o); [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [84, 0.62]].forEach(([m, d]) => bell(t + d, m, 0.6, 0.6, o, { len: d > 0.6 ? 2 : 0.8 })); [72, 76, 79].forEach((m) => pluck(t + 0.62, m, 2, 0.4, o)); drum(t + 0.62, "low", 0.6, o); },
      dofus: (t, o) => { [76, 80, 83, 88, 92, 95].forEach((m, i) => bell(t + i * 0.09, m, 1, 0.45, o, { len: 1.8 })); pad(t, [64, 68, 71, 76], 1.4, 3, o, { att: 0.3, cut: 2500 }); },
      commande: (t, o) => { [100, 103].forEach((m, i) => bell(t + i * 0.07, m, 0.3, 0.6, o, { len: 0.5 })); drum(t, "jingle", 0.6, o); drum(t + 0.07, "jingle", 0.5, o); },
      message: (t, o) => { bell(t, 88, 0.6, 0.5, o, { len: 1 }); bell(t + 0.16, 84, 0.6, 0.45, o, { len: 1.2 }); },
      erreur: (t, o) => { marimba(t, 55, 0.7, o, { dec: 0.15 }); marimba(t + 0.11, 50, 0.7, o, { dec: 0.2 }); },
    },
    fanfare: {
      clic: (t, o) => { drum(t, "tap", 0.45, o); },
      victoire: (t, o) => { horn(t, 67, 0.1, 0.7, o, { att: 0.03, cut: 2200 }); horn(t + 0.11, 72, 0.25, 0.75, o, { att: 0.03, cut: 2200 }); },
      butin: (t, o) => { [76, 79, 76, 79, 84].forEach((m, i) => horn(t + i * 0.07, m, 0.07, 0.55, o, { att: 0.02, cut: 2600 })); },
      niveau: (t, o) => { [[60, 0, 0.1], [64, 0.1, 0.1], [67, 0.2, 0.1], [72, 0.3, 0.55]].forEach(([m, d, l]) => horn(t + d, m, l, 0.75, o, { att: 0.03, cut: 2400 })); horn(t + 0.3, 64, 0.55, 0.4, o, { att: 0.05 }); drum(t + 0.3, "low", 0.6, o); },
      donjon: (t, o) => { for (let i = 0; i < 6; i++) drum(t + i * 0.05, "tap", 0.3 + i * 0.05, o); [[67, 0.3, 0.12], [67, 0.43, 0.12], [72, 0.56, 0.7]].forEach(([m, d, l]) => { horn(t + d, m, l, 0.75, o, { att: 0.03, cut: 2400 }); horn(t + d, m - 5, l, 0.45, o, { att: 0.03 }); }); drum(t + 0.56, "low", 0.8, o); },
      dofus: (t, o) => { [[72, 0, 0.15], [76, 0.15, 0.15], [79, 0.3, 0.15], [84, 0.45, 0.9]].forEach(([m, d, l]) => horn(t + d, m, l, 0.7, o, { att: 0.04, cut: 2600 })); pad(t + 0.45, [60, 64, 67, 72], 1, 3, o, { att: 0.1, cut: 2000 }); drum(t + 0.45, "low", 0.8, o); },
      commande: (t, o) => { horn(t, 79, 0.08, 0.5, o, { att: 0.02, cut: 2600 }); horn(t + 0.09, 84, 0.18, 0.55, o, { att: 0.02, cut: 2600 }); drum(t, "jingle", 0.5, o); },
      message: (t, o) => { horn(t, 72, 0.14, 0.5, o, { att: 0.04 }); horn(t + 0.16, 79, 0.25, 0.5, o, { att: 0.04 }); },
      erreur: (t, o) => { horn(t, 50, 0.16, 0.7, o, { att: 0.03, cut: 800 }); horn(t + 0.18, 45, 0.3, 0.7, o, { att: 0.03, cut: 700 }); },
    },
    bips: {}, // les sons actuels du jeu (bips synthétiques), pour comparer
  };
  const BIPS = {
    clic: [[1200, 0, 0.03, "square"]], victoire: [[523, 0, 0.09], [659, 0.08, 0.12]], niveau: [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.22]],
    butin: [[1319, 0, 0.07, "triangle"], [1760, 0.06, 0.07, "triangle"], [2093, 0.12, 0.16, "triangle"]], donjon: [[392, 0, 0.14, "square"], [523, 0.13, 0.14, "square"], [659, 0.26, 0.14, "square"], [784, 0.39, 0.3, "square"]],
    commande: [[1568, 0, 0.05, "triangle"], [2093, 0.05, 0.12, "triangle"]], dofus: [[880, 0, 0.12], [1109, 0.1, 0.12], [1319, 0.2, 0.12], [1760, 0.3, 0.3]],
    message: [[1319, 0, 0.08, "triangle"], [988, 0.1, 0.12, "triangle"]], erreur: [[220, 0, 0.1, "square"], [165, 0.1, 0.16, "square"]],
  };
  Object.keys(BIPS).forEach((k) => (SFX.bips[k] = (t, o) => BIPS[k].forEach(([f, at, len, type]) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = type || "sine"; os.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.4, t + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len); os.connect(g); g.connect(o); os.start(t + at); os.stop(t + at + len + 0.05); })));
  A.sfx = function (style, kind) { if (!init()) return; const fn = (SFX[style] || SFX.bois)[kind]; if (fn) fn(ctx.currentTime + 0.01, sfxBus); };
  A.kinds = ["clic", "victoire", "butin", "niveau", "donjon", "dofus", "commande", "message", "erreur"];
  // contrôle : rend un morceau ou un son hors ligne et mesure le niveau
  A._offline = async function (what, secs) {
    const live = ctx; ctx = new OfflineAudioContext(2, Math.floor(44100 * secs), 44100); Object.keys(ks).forEach((k) => delete ks[k]); noiseBuf = null; graph();
    if (TRACKS[what]) { const T = TRACKS[what], spb = 60 / T.bpm, out = ctx.createGain(); out.connect(musicBus); let p = 0, st = 0.05;
      while (st < secs) { T.build(p).forEach((e) => { const t = st + e.b * spb; if (t < secs) voice(e, t, spb, out); }); st += T.len * spb; p++; } }
    else { const [style, kind] = what.split(":"); SFX[style][kind](0.05, sfxBus); }
    const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let peak = 0, sum = 0, nan = 0; const per = [];
    for (let i = 0; i < d.length; i++) { const x = d[i]; if (x !== x) nan++; else { peak = Math.max(peak, Math.abs(x)); sum += x * x; } if (i % 44100 === 44099) { per.push(+Math.sqrt(sum / 44100).toFixed(3)); sum = 0; } }
    ctx = live; Object.keys(ks).forEach((k) => delete ks[k]); noiseBuf = null; if (live) graph();
    return { peak: +peak.toFixed(3), nan, rmsPerSec: per, wav: A._wav ? A._wav(buf) : null };
  };
  window.IdlusAudio = A;
})();
