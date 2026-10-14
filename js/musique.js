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
  // violon (archet), pour les airs de ville et d'Orient
  function fiddle(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(); bp.type = "peaking"; bp.frequency.value = 2200; bp.gain.value = 5; lp.type = "lowpass"; lp.frequency.value = o.cut || 3400;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.009, t + Math.min(0.4, d)); lfo.connect(lg);
    [-5, 5].forEach((c) => { const os = ctx.createOscillator(); os.type = "sawtooth"; os.frequency.value = f0; os.detune.value = c; lg.connect(os.frequency); os.connect(bp); os.start(t); os.stop(t + d + 0.5); });
    lfo.start(t); lfo.stop(t + d + 0.5); env(g, t, v * 0.2, o.att || 0.07, d, 0.1); bp.connect(lp); lp.connect(g); g.connect(dest);
  }
  // accordéon (anches, léger tremolo)
  function accord(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), tr = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = o.cut || 2300;
    [["square", 1, 0, 0.5], ["sawtooth", 1, 9, 0.5], ["sawtooth", 2, -6, 0.15]].forEach(([type, k, c, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = type; os.frequency.value = f0 * k; os.detune.value = c; og.gain.value = a; os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + 0.4); });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6.2; lg.gain.value = 0.12; tr.gain.value = 0.88; lfo.connect(lg); lg.connect(tr.gain); lfo.start(t); lfo.stop(t + d + 0.4);
    env(g, t, v * 0.13, o.att || 0.04, d, 0.08); lp.connect(tr); tr.connect(g); g.connect(dest);
  }
  // tambourin et grosse caisse en peau
  function drum(t, kind, v, dest) {
    if (kind === "anvil") { bell(t, 93, 0.3, v, dest, { parts: [[1, 1, 0.22], [2.76, 0.5, 0.12], [5.4, 0.3, 0.06]] }); return; } // marteau sur l'enclume
    if (kind === "low" || kind === "mid") { const hi = kind === "mid";
      const os = ctx.createOscillator(), g = ctx.createGain(); os.type = "sine"; os.frequency.setValueAtTime(hi ? 210 : 120, t); os.frequency.exponentialRampToValueAtTime(hi ? 105 : 52, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.9, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.13);
      os.connect(g); g.connect(dest); os.start(t); os.stop(t + 0.8);
    }
    const n = ctx.createBufferSource(); n.buffer = noise(); const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === "low" || kind === "mid") { f.type = "lowpass"; f.frequency.value = kind === "mid" ? 700 : 380; } else if (kind === "jingle") { f.type = "highpass"; f.frequency.value = 6500; } else { f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.9; }
    const dec = kind === "jingle" ? 0.06 : kind === "low" || kind === "mid" ? 0.07 : 0.025, a = kind === "low" || kind === "mid" ? 0.5 : kind === "jingle" ? 0.22 : 0.3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * a, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.005, dec);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + 0.5);
  }
  function voice(e, t, spb, dest) {
    const d = e.d * spb, v = (e.v || 0.7) * (1 + rnd(0.08)); t += rnd(0.006);
    if (e.i === "pluck") pluck(t, e.m, d, v, dest, e.o); else if (e.i === "flute") flute(t, e.m, d, v, dest, e.o); else if (e.i === "horn") horn(t, e.m, d, v, dest, e.o);
    else if (e.i === "pad") pad(t, e.m, d, v, dest, e.o); else if (e.i === "bell") bell(t, e.m, d, v, dest, e.o); else if (e.i === "bass") bass(t, e.m, d, v, dest);
    else if (e.i === "drum") drum(t, e.m, v, dest); else if (e.i === "mar") marimba(t, e.m, v, dest, e.o);
    else if (e.i === "fiddle") fiddle(t, e.m, d, v, dest, e.o); else if (e.i === "acc") accord(t, e.m, d, v, dest, e.o);
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

    /* 1.0.24 : nouveaux airs (régions, Songe, Kolizéum, boss des mondes, Halouine) */
    cania: { name: "Plaines de Cania", gain: 0.9, bpm: 96, bpb: 4,
      ch: [C(50, 4), C(45, 4), C(47, 3), C(55, 4), C(50, 4), C(55, 4), C(52, 3), C(45, 4)],
      mel: [[[69, 1.5], [74, 0.5], [78, 2]], [[76, 1.5], [73, 0.5], [69, 2]], [[71, 1], [74, 1], [78, 1], [76, 1]], [[74, 3], [71, 1]], [[69, 1], [74, 1], [78, 1.5], [81, 0.5]], [[79, 2], [78, 1], [76, 1]], [[76, 1.5], [79, 0.5], [71, 2]], [[73, 3], [76, 1]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4; [0, 7, 12, c.t + 12, 19, c.t + 12, 12, 7].forEach((o, k) => ev.push({ b: b0 + k * 0.5, i: "pluck", m: c.r + o, d: 1.4, v: k === 0 ? 0.5 : 0.34 }));
          ev.push({ b: b0, i: "pad", m: [c.r + 12, c.r + 12 + c.t, c.r + 19], d: 4, v: 0.9 }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: 3.6, v: 0.6 });
          ev.push({ b: b0, i: "drum", m: "low", d: 1, v: 0.45 }); ev.push({ b: b0 + 2, i: "drum", m: "tap", d: 1, v: 0.25 }); });
        if (p > 0) ev.push(...(p % 2 ? melodyEv(this.mel, 4, "flute", 0.8) : melodyEv(this.mel, 4, "horn", 0.75, -12)));
        return ev.sort((a, b) => a.b - b.b); } },
    iles: { name: "Rivages d'Otomaï", gain: 0.75, bpm: 104, bpb: 4,
      ch: [C(53, 4), C(50, 3), C(46, 4), C(48, 4), C(53, 4), C(45, 3), C(46, 4), C(48, 4)],
      mel: [[[72, 1], [77, 1], [81, 1.5], [79, 0.5]], [[77, 2], [74, 2]], [[74, 1], [77, 1], [82, 1], [81, 1]], [[79, 3], [76, 1]], [[77, 1], [81, 1], [84, 1.5], [81, 0.5]], [[76, 2], [72, 2]], [[74, 1.5], [77, 0.5], [79, 1], [77, 1]], [[76, 2], [79, 2]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4; [0, 12, 7, c.t + 12, 12, 7, c.t + 12, 19].forEach((o, k) => ev.push({ b: b0 + k * 0.5, i: "mar", m: c.r + 12 + o, d: 0.5, v: k % 2 ? 0.35 : 0.5, o: { dec: 0.35 } }));
          ev.push({ b: b0, i: "bass", m: c.r - 12, d: 1.4, v: 0.6 }); ev.push({ b: b0 + 1.5, i: "bass", m: c.r - 12, d: 0.4, v: 0.45 }); ev.push({ b: b0 + 2, i: "bass", m: c.r - 5, d: 1.6, v: 0.5 });
          [0.5, 1.5, 2.5, 3.5].forEach((x) => ev.push({ b: b0 + x, i: "drum", m: "jingle", d: 0.5, v: 0.3 })); ev.push({ b: b0, i: "drum", m: "mid", d: 1, v: 0.35 }); ev.push({ b: b0 + 2.5, i: "drum", m: "mid", d: 1, v: 0.3 }); });
        ev.push(...(p % 3 === 2 ? melodyEv(this.mel, 4, "mar", 0.7, 0, { dec: 0.6 }) : melodyEv(this.mel, 4, "flute", 0.75)));
        return ev.sort((a, b) => a.b - b.b); } },
    frigost: { name: "Neiges de Frigost", gain: 1.8, bpm: 84, bpb: 3,
      ch: [C(52, 3), C(48, 4), C(55, 4), C(50, 4), C(52, 3), C(45, 3), C(47, 4), C(47, 4)],
      mel: [[[83, 2], [79, 1]], [[76, 2], [79, 1]], [[74, 1], [71, 1], [74, 1]], [[78, 3]], [[76, 1], [79, 1], [83, 1]], [[84, 2], [81, 1]], [[78, 1], [75, 1], [78, 1]], [[71, 1], [75, 1], [78, 1]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 3; ev.push({ b: b0, i: "pluck", m: c.r, d: 2.8, v: 0.4, o: { cut: 1600 } });
          [1, 2].forEach((k) => [c.r + 12 + c.t, c.r + 19].forEach((m) => ev.push({ b: b0 + k, i: "pluck", m, d: 0.9, v: 0.2, o: { cut: 2400 } })));
          ev.push({ b: b0, i: "pad", m: [c.r + 12, c.r + 19, c.r + 24 + c.t], d: 3, v: 0.8, o: { cut: 1300, att: 1.2 } }); });
        if (p > 0) ev.push(...melodyEv(this.mel, 3, "bell", 0.7, 0, { len: 1.6 })); if (p % 2 === 0 && p > 0) ev.push(...melodyEv(this.mel, 3, "flute", 0.45, -12, { att: 0.2 }));
        return ev.sort((a, b) => a.b - b.b); } },
    landes: { name: "Landes de Sidimote", gain: 1.1, bpm: 70, bpb: 4,
      ch: [C(47, 3), C(48, 4), C(47, 3), C(45, 4), C(43, 4), C(42, 4), C(47, 3), C(48, 4)],
      mel: [[[66, 3], [67, 1]], [[67, 2], [64, 2]], [[66, 2], [62, 2]], [[64, 2], [61, 2]], [[62, 2], [59, 2]], [[61, 2], [58, 2]], [[59, 3], [62, 1]], [[60, 4]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4;
          ev.push({ b: b0, i: "pad", m: [c.r - 12, c.r - 5, c.r + c.t], d: 4, v: 1.1, o: { cut: 550 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: 3.8, v: 0.55 });
          [0, 7, c.t + 12, 13].forEach((o, k) => ev.push({ b: b0 + k, i: "pluck", m: c.r + o, d: 1.2, v: 0.26, o: { cut: 1400, damp: 0.993 } }));
          if (i % 2 === 0) ev.push({ b: b0, i: "drum", m: "low", d: 1, v: 0.5 });
          if (i % 4 === 3) ev.push({ b: b0 + 2, i: "bell", m: c.r + 37, d: 2, v: 0.3, o: { len: 2 } }); });
        if (p > 0) ev.push(...melodyEv(this.mel, 4, "flute", 0.85, 12, { cut: 1500, att: 0.15 }));
        return ev.sort((a, b) => a.b - b.b); } },
    songe: { name: "Songe infini", gain: 1.6, bpm: 60, bpb: 4,
      ch: [C(48, 4), C(50, 4), C(52, 3), C(50, 4), C(48, 4), C(45, 3), C(50, 4), C(48, 4)],
      mel: [[[79, 4]], [[78, 2], [81, 2]], [[79, 3], [76, 1]], [[78, 4]], [[76, 2], [79, 2]], [[81, 3], [76, 1]], [[78, 2], [74, 2]], [[76, 4]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4; [0, 7, 12, c.t + 12, 19, 24, 19, 12].forEach((o, k) => ev.push({ b: b0 + k * 0.5, i: "bell", m: c.r + 12 + o, d: 1, v: 0.32, o: { len: 1.6 } }));
          ev.push({ b: b0, i: "pad", m: [c.r, c.r + 7, c.r + 12 + c.t, c.r + 19], d: 4, v: 1, o: { cut: 1100, att: 1.5 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: 3.8, v: 0.4 }); });
        if (p > 0) ev.push(...melodyEv(this.mel, 4, "flute", 0.7, 0, { att: 0.3 }));
        return ev.sort((a, b) => a.b - b.b); } },
    koli: { name: "Arène du Kolizéum", gain: 0.7, bpm: 132, bpb: 4,
      ch: [C(45, 3), C(45, 3), C(53, 4), C(55, 4), C(45, 3), C(48, 4), C(52, 4), C(52, 4)],
      mel: [[[69, 0.5], [69, 0.5], [72, 0.5], [76, 0.5], [81, 1], [79, 1]], [[76, 1.5], [74, 0.5], [72, 1], [71, 1]], [[69, 0.5], [72, 0.5], [77, 1], [76, 1], [72, 1]], [[74, 1.5], [71, 0.5], [67, 2]], [[69, 0.5], [72, 0.5], [76, 0.5], [81, 0.5], [84, 1], [83, 1]], [[79, 1.5], [76, 0.5], [72, 2]], [[71, 1], [74, 1], [76, 1], [80, 1]], [[83, 2], [80, 1], [76, 1]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4;
          for (let k = 0; k < 8; k++) ev.push({ b: b0 + k * 0.5, i: "bass", m: c.r - 12 + (k % 2 ? 12 : 0), d: 0.4, v: 0.55 });
          [0.5, 1.5, 2.5, 3.5].forEach((x) => [c.r + 12, c.r + 12 + c.t, c.r + 19].forEach((m) => ev.push({ b: b0 + x, i: "pluck", m, d: 0.3, v: 0.22, o: { cut: 3000, damp: 0.99 } })));
          [0, 2].forEach((x) => ev.push({ b: b0 + x, i: "drum", m: "low", d: 1, v: 0.75 })); [1, 3].forEach((x) => ev.push({ b: b0 + x, i: "drum", m: "mid", d: 1, v: 0.5 }));
          for (let k = 0; k < 8; k++) ev.push({ b: b0 + k * 0.5 + 0.25, i: "drum", m: "jingle", d: 0.2, v: 0.2 }); });
        if (p > 0) ev.push(...(p % 3 === 0 ? melodyEv(this.mel, 4, "pluck", 0.8, 0, { cut: 4000 }) : melodyEv(this.mel, 4, "horn", 0.8, 0, { att: 0.04, cut: 2200 })));
        return ev.sort((a, b) => a.b - b.b); } },
    boss: { name: "Boss des mondes", gain: 0.75, bpm: 88, bpb: 4,
      ch: [C(50, 3), C(50, 3), C(46, 4), C(48, 4), C(50, 3), C(55, 3), C(45, 4), C(45, 4)],
      mel: [[[74, 3], [69, 1]], [[77, 2], [76, 1], [74, 1]], [[74, 2], [77, 2]], [[76, 3], [72, 1]], [[81, 3], [77, 1]], [[79, 2], [82, 1], [81, 1]], [[76, 2], [73, 2]], [[69, 4]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 4;
          for (let k = 0; k < 8; k++) ev.push({ b: b0 + k * 0.5, i: "bass", m: c.r - 12 + (k % 4 === 3 ? 7 : 0), d: 0.45, v: 0.6 });
          ev.push({ b: b0, i: "pad", m: [c.r, c.r + c.t, c.r + 7, c.r + 12], d: 4, v: 1, o: { cut: 900, att: 0.3 } });
          [[0, "low", 0.85], [1.5, "mid", 0.5], [2, "mid", 0.55], [3, "low", 0.7], [3.5, "mid", 0.45]].forEach(([x, k, v]) => ev.push({ b: b0 + x, i: "drum", m: k, d: 1, v }));
          if (i % 4 === 0) ev.push({ b: b0, i: "bell", m: c.r + 24, d: 3, v: 0.4, o: { len: 2 } }); });
        if (p > 0) ev.push(...melodyEv(this.mel, 4, "horn", 0.85, -12, { cut: 1600 })); if (p % 2 === 0 && p > 0) ev.push(...melodyEv(this.mel, 4, "horn", 0.5, 0, { cut: 2200 }));
        return ev.sort((a, b) => a.b - b.b); } },
    halouine: { name: "Bal d'Halouine", gain: 1, bpm: 120, bpb: 3,
      ch: [C(52, 3), C(52, 3), C(47, 4), C(47, 4), C(52, 3), C(45, 3), C(47, 4), C(52, 3)],
      mel: [[[76, 1], [79, 1], [83, 1]], [[84, 1], [83, 1], [79, 1]], [[81, 1], [78, 1], [75, 1]], [[78, 3]], [[76, 1], [79, 1], [83, 1]], [[84, 2], [81, 1]], [[75, 1], [78, 1], [81, 1]], [[79, 1], [76, 2]]],
      build(p) { const ev = []; this.ch.forEach((c, i) => { const b0 = i * 3; ev.push({ b: b0, i: "bass", m: c.r - 12, d: 0.9, v: 0.65 });
          [1, 2].forEach((k) => [c.r + c.t, c.r + 7, c.r + 12].forEach((m) => ev.push({ b: b0 + k, i: "pluck", m, d: 0.35, v: 0.24, o: { cut: 2200, damp: 0.99 } })));
          ev.push({ b: b0, i: "drum", m: "low", d: 1, v: 0.4 }); ev.push({ b: b0 + 1, i: "drum", m: "tap", d: 1, v: 0.25 }); ev.push({ b: b0 + 2, i: "drum", m: "tap", d: 1, v: 0.25 });
          ev.push({ b: b0, i: "pad", m: [c.r, c.r + 6, c.r + 12], d: 3, v: 0.5, o: { cut: 700 } }); });
        ev.push(...melodyEv(this.mel, 3, "bell", 0.7, 0, { len: 1.2 })); if (p % 2) ev.push(...melodyEv(this.mel, 3, "flute", 0.5, -12));
        return ev.sort((a, b) => a.b - b.b); } },
  };
  /* 1.0.24 : airs écrits en notation courte. ch : un accord par mesure ; mel : notes « La4:1.5 » séparées par « | » à chaque mesure ;
     acc : accompagnement ; dr : percussions ; lead : instrument de la mélodie à chaque tour (« flute », « horn-12 »…), intro : 1er tour sans mélodie */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const acc = (x) => (x === "#" ? 1 : x === "b" ? -1 : 0);
  function nm(x) { const m = /^([A-G])([#b]?)(\d)$/.exec(x); if (!m) throw new Error("note " + x); return 12 * (+m[3] + 1) + NOTE[m[1]] + acc(m[2]); }
  function chordOf(x) { const m = /^([A-G])([#b]?)(m|dim|sus)?$/.exec(x); if (!m) throw new Error("accord " + x); const pc = (NOTE[m[1]] + acc(m[2]) + 12) % 12;
    return { r: 45 + ((pc - 9 + 12) % 12), t: m[3] === "m" || m[3] === "dim" ? 3 : m[3] === "sus" ? 5 : 4, f: m[3] === "dim" ? 6 : 7 }; }
  const parseMel = (x) => x.split("|").map((b) => b.trim().split(/\s+/).filter(Boolean).map((y) => { const [n, d] = y.split(":"); return [n === "r" ? 0 : nm(n), +d]; }));
  const ACC = {
    harp: (ev, c, b0, n, o) => { const off = n === 3 ? [0, c.f, 12, c.t + 12, c.f + 12, 12] : [0, c.f, 12, c.t + 12, c.f + 12, c.t + 12, 12, c.f]; off.forEach((x, k) => ev.push({ b: b0 + k * 0.5, i: o.ai || "pluck", m: c.r + x, d: 1.4, v: (k ? 0.34 : 0.5) * (o.av || 1), o: o.ao })); ev.push({ b: b0, i: "bass", m: c.r - 12, d: n - 0.3, v: 0.55 }); },
    waltz: (ev, c, b0, n, o) => { ev.push({ b: b0, i: "bass", m: c.r - 12, d: 0.9, v: 0.62 }); for (let k = 1; k < n; k++) [c.t, c.f, 12].forEach((x) => ev.push({ b: b0 + k, i: o.ai || "pluck", m: c.r + 12 + x, d: 0.4, v: 0.2 * (o.av || 1), o: o.ao || { cut: 2400, damp: 0.99 } })); },
    march: (ev, c, b0, n, o) => { for (let k = 0; k < n; k++) { if (k % 2 === 0) ev.push({ b: b0 + k, i: "bass", m: c.r - 12 + (k ? c.f : 0), d: 0.8, v: 0.6 }); else [c.t, c.f, 12].forEach((x) => ev.push({ b: b0 + k, i: o.ai || "pluck", m: c.r + 12 + x, d: 0.35, v: 0.22 * (o.av || 1), o: o.ao || { cut: 2600, damp: 0.99 } })); } },
    drone: (ev, c, b0, n, o) => { ev.push({ b: b0, i: "bass", m: c.r - 12, d: n - 0.2, v: 0.5 }); for (let k = 0; k < n; k++) ev.push({ b: b0 + k, i: "pluck", m: c.r + [0, c.f, c.t + 12, c.f + 12][k % 4], d: 1.2, v: 0.26, o: { cut: 1400, damp: 0.993 } }); },
    mar: (ev, c, b0, n) => { const off = [0, 12, c.f, c.t + 12, 12, c.f, c.t + 12, c.f + 12]; for (let k = 0; k < n * 2; k++) ev.push({ b: b0 + k * 0.5, i: "mar", m: c.r + 12 + off[k % 8], d: 0.5, v: k % 2 ? 0.35 : 0.5, o: { dec: 0.35 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: 1.4, v: 0.55 }); ev.push({ b: b0 + 2, i: "bass", m: c.r - 12 + c.f, d: 1.4, v: 0.45 }); },
    box: (ev, c, b0, n) => { const off = [0, c.t, c.f, 12, c.f, c.t]; for (let k = 0; k < n * 2; k++) ev.push({ b: b0 + k * 0.5, i: "bell", m: c.r + 24 + off[k % 6], d: 0.5, v: 0.26, o: { len: 1 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: n - 0.2, v: 0.4 }); },
    chime: (ev, c, b0, n) => { const off = [0, c.f, 12, c.t + 12, c.f + 12, 24, c.f + 12, 12]; for (let k = 0; k < n * 2; k++) ev.push({ b: b0 + k * 0.5, i: "bell", m: c.r + 12 + off[k % 8], d: 1, v: 0.3, o: { len: 1.6 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: n - 0.2, v: 0.4 }); },
    stabs: (ev, c, b0, n) => { for (let k = 0; k < n * 2; k++) ev.push({ b: b0 + k * 0.5, i: "bass", m: c.r - 12 + (k % 2 ? 12 : 0), d: 0.4, v: 0.55 }); for (let k = 0; k < n; k++) [12, c.t + 12, c.f + 12].forEach((x) => ev.push({ b: b0 + k + 0.5, i: "pluck", m: c.r + x, d: 0.3, v: 0.22, o: { cut: 3000, damp: 0.99 } })); },
    jig: (ev, c, b0, n, o) => { const off = [0, c.f, 12, c.t + 12, c.f + 12, 12]; for (let k = 0; k < n * 2; k++) ev.push({ b: b0 + k * 0.5, i: "pluck", m: c.r + off[k % 6], d: 1, v: k ? 0.34 : 0.5, o: o.ao || { cut: 2600, damp: 0.994 } }); ev.push({ b: b0, i: "bass", m: c.r - 12, d: n - 0.4, v: 0.55 }); },
    pizz: (ev, c, b0, n) => { for (let k = 0; k < n; k++) { ev.push({ b: b0 + k, i: "bass", m: c.r - 12 + (k % 2 ? c.f : 0), d: 0.4, v: 0.55 }); [c.t + 12, c.f + 12].forEach((x) => ev.push({ b: b0 + k + 0.5, i: "pluck", m: c.r + x, d: 0.25, v: 0.22, o: { cut: 3200, damp: 0.988 } })); } },
  };
  const DR = {
    soft: [[0, "low", 0.45]], slow: [[0, "low", 0.6], [2, "low", 0.3]],
    folk3: [[0, "low", 0.5], [1, "tap", 0.35], [2, "tap", 0.35], [2.5, "jingle", 0.3]], waltz: [[0, "low", 0.4], [1, "tap", 0.25], [2, "tap", 0.25]],
    folk4: [[0, "low", 0.5], [1, "tap", 0.3], [2, "low", 0.35], [3, "tap", 0.3], [3.5, "jingle", 0.3]],
    march: [[0, "low", 0.6], [1, "tap", 0.4], [1.75, "tap", 0.2], [2, "low", 0.45], [3, "tap", 0.4], [3.5, "tap", 0.25], [3.75, "tap", 0.25]],
    tribal: [[0, "low", 0.8], [1.5, "mid", 0.5], [2, "mid", 0.55], [3, "low", 0.7], [3.5, "mid", 0.45]],
    isle: [[0, "low", 0.6], [0.75, "mid", 0.35], [1.5, "mid", 0.45], [2, "low", 0.5], [2.5, "mid", 0.35], [3, "mid", 0.45], [3.5, "jingle", 0.3]],
    desert: [[0, "low", 0.6], [1.5, "mid", 0.4], [2, "tap", 0.3], [3, "mid", 0.45], [3.5, "tap", 0.3]],
    anvil: [[0, "low", 0.5], [1, "anvil", 0.35], [2, "low", 0.4], [2.5, "anvil", 0.25], [3, "anvil", 0.35]],
    sleigh: [[0, "low", 0.45], [2, "low", 0.35], ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((x) => [x, "jingle", x % 1 ? 0.25 : 0.4])],
  };
  function song(S0) {
    const ch = S0.ch.trim().split(/\s+/).map(chordOf), mel = parseMel(S0.mel), n = S0.bpb;
    mel.forEach((b, i) => { const sum = b.reduce((a, x) => a + x[1], 0); if (Math.abs(sum - n) > 1e-6) throw new Error(`${S0.name} : mesure ${i + 1} = ${sum} temps`); });
    if (mel.length !== ch.length) throw new Error(`${S0.name} : ${mel.length} mesures pour ${ch.length} accords`);
    const lead = (x) => { const m = /^([a-z]+)([+-]\d+)?$/.exec(x); return [m[1], +(m[2] || 0)]; };
    return { name: S0.name, bpm: S0.bpm, bpb: n, gain: S0.gain || 1, ch,
      build(p) { const ev = [], o = S0.o || {};
        ch.forEach((c, i) => { const b0 = i * n; ACC[S0.acc](ev, c, b0, n, o);
          if (S0.pad) ev.push({ b: b0, i: "pad", m: [c.r + 12, c.r + 12 + c.t, c.r + 12 + c.f], d: n, v: S0.pad, o: { cut: S0.padCut || 1000, att: 0.8 } });
          (DR[S0.dr] || []).forEach(([x, k, v]) => { if (x < n) ev.push({ b: b0 + x, i: "drum", m: k, d: 0.5, v }); }); });
        if (!(S0.intro && p === 0)) { const L = S0.lead[p % S0.lead.length]; const [i, sh] = lead(L); ev.push(...melodyEv(mel, n, i, S0.lv || 0.8, sh, i === "bell" ? { len: 1.4 } : i === "mar" ? { dec: 0.6 } : undefined));
          if (S0.lead2 && p % 2 === 1) { const [i2, sh2] = lead(S0.lead2); ev.push(...melodyEv(mel, n, i2, 0.45, sh2)); } }
        return ev.sort((a, b) => a.b - b.b); } };
  }
  const SONGS = {
    incarnam: { name: "Premiers pas à Incarnam", gain: 1.1, bpm: 100, bpb: 4, acc: "harp", pad: 0.8, dr: "soft", lead: ["flute", "pluck"], intro: 1, ch: "C G Am F C F G C",
      mel: "E5:1 G5:1 C6:1.5 G5:.5 | G5:1.5 F5:.5 D5:2 | C5:1 E5:1 A5:1 G5:1 | F5:3 r:1 | E5:1 G5:1 C6:1 B5:1 | A5:1.5 G5:.5 F5:1 A5:1 | G5:1 F5:1 E5:1 D5:1 | C5:4" },
    marche: { name: "Marché d'Astrub", gain: 1.25, bpm: 138, bpb: 3, acc: "waltz", dr: "waltz", lead: ["acc", "fiddle"], ch: "G G D D C G D G G Em C D G C D G",
      mel: "D5:1 G5:1 B5:1 | A5:1 G5:1 D5:1 | F#5:1.5 E5:.5 D5:1 | A4:3 | E5:1 G5:1 E5:1 | D5:1 B4:1 G4:1 | A4:1 D5:1 F#5:1 | G5:3 | B5:1 A5:1 G5:1 | E5:2 G5:1 | E5:1 D5:1 C5:1 | A4:2 D5:1 | B4:1 D5:1 G5:1 | E5:1.5 D5:.5 C5:1 | A4:1 B4:1 C5:1 | B4:1 G4:2" },
    bonta: { name: "Remparts de Bonta", gain: 1, bpm: 104, bpb: 4, acc: "march", pad: 0.9, dr: "march", lead: ["horn", "fiddle"], ch: "Bb F Gm Eb Bb Eb F Bb",
      mel: "F4:1 Bb4:1 D5:1.5 C5:.5 | C5:2 A4:1 F4:1 | G4:1 Bb4:1 D5:1 G5:1 | F5:3 Eb5:1 | D5:1.5 F5:.5 Bb5:2 | G5:1 F5:1 Eb5:1 G5:1 | F5:1.5 Eb5:.5 C5:1 A4:1 | Bb4:4" },
    brakmar: { name: "Ruelles de Brâkmar", gain: 1, bpm: 92, bpb: 4, acc: "pizz", pad: 0.9, padCut: 700, dr: "march", lead: ["fiddle", "horn-12"], ch: "Cm Ab Fm G Cm Ab Fm G",
      mel: "G4:1 C5:1 Eb5:1.5 D5:.5 | C5:2 Ab4:2 | F4:1 Ab4:1 C5:1 F5:1 | D5:3 B4:1 | C5:1 Eb5:1 G5:1.5 F5:.5 | Eb5:1 C5:1 Ab4:2 | Ab4:1.5 G4:.5 F4:1 Ab4:1 | B4:2 G4:2" },
    abrak: { name: "Bois des Abraknydes", gain: 1.1, bpm: 80, bpb: 4, acc: "harp", pad: 0.9, dr: "soft", lead: ["flute", "pluck"], intro: 1, ch: "Am D Am G Am D F G",
      mel: "E5:2 A5:1 G5:1 | F#5:3 A5:1 | E5:1 D5:1 C5:1 B4:1 | D5:4 | A4:1 C5:1 E5:1.5 F#5:.5 | A5:2 F#5:1 D5:1 | C5:1.5 D5:.5 F5:1 E5:1 | D5:2 B4:2" },
    koalaks: { name: "Sommets des Koalaks", gain: 0.77, bpm: 96, bpb: 3, acc: "harp", pad: 0.8, dr: "waltz", lead: ["horn-12", "flute"], ch: "F C Dm Bb F Bb C F",
      mel: "C5:1 F5:1 A5:1 | G5:2 E5:1 | F5:1 D5:1 A4:1 | Bb4:2 D5:1 | C5:1 A4:1 F5:1 | D5:1 F5:1 Bb5:1 | A5:1.5 G5:.5 E5:1 | F5:3" },
    dragoeufs: { name: "Nid des Dragoeufs", gain: 0.93, bpm: 96, bpb: 4, acc: "drone", pad: 1, padCut: 600, dr: "tribal", lead: ["horn-12", "fiddle-12"], ch: "Dm Eb Dm C Bb C Eb Dm",
      mel: "D5:1 F5:1 A5:2 | G5:1.5 F5:.5 Eb5:2 | D5:1 A4:1 D5:1 F5:1 | E5:2 G5:2 | F5:1 D5:1 Bb4:2 | C5:1 E5:1 G5:1 E5:1 | Eb5:3 F5:1 | D5:4" },
    saharach: { name: "Dunes de Saharach", gain: 1, bpm: 88, bpb: 4, acc: "drone", pad: 0.9, padCut: 700, dr: "desert", lead: ["fiddle", "flute"], intro: 1, ch: "E F E Dm Am F E E",
      mel: "E5:1 F5:1 G#5:1.5 A5:.5 | A5:1 F5:1 E5:2 | E5:1.5 G#5:.5 B5:2 | A5:1 F5:1 D5:2 | C5:1 E5:1 A5:1 G#5:1 | F5:2 E5:1 D5:1 | E5:1 F5:1 E5:1 D5:1 | E5:4" },
    pandala: { name: "Jardins de Pandala", gain: 1.18, bpm: 76, bpb: 4, acc: "harp", pad: 0.7, dr: "soft", lead: ["flute", "bell"], intro: 1, ch: "D Bm G A D G Bm A",
      mel: "F#5:1 A5:1 B5:2 | A5:1 F#5:1 E5:2 | D5:1 E5:1 B4:2 | A4:2 E5:2 | F#5:1.5 E5:.5 D5:2 | B4:1 D5:1 E5:2 | F#5:1 E5:1 D5:1 B4:1 | A4:4" },
    moon: { name: "Tambours de Moon", gain: 0.8, bpm: 112, bpb: 4, acc: "mar", dr: "isle", lead: ["flute", "mar"], ch: "Am G F G Am G Em Am",
      mel: "A4:.5 C5:.5 D5:.5 E5:.5 G5:1 E5:1 | D5:1.5 C5:.5 D5:2 | C5:1 A4:1 C5:1 D5:1 | E5:2 D5:2 | A5:1 G5:.5 E5:.5 D5:1 E5:1 | G5:1.5 E5:.5 D5:2 | E5:1 D5:1 C5:1 D5:1 | A4:4" },
    wabbits: { name: "Terriers des Wabbits", gain: 0.87, bpm: 126, bpb: 4, acc: "pizz", dr: "folk4", lead: ["pluck", "flute"], ch: "C F C G C F G C",
      mel: "C5:.5 r:.5 E5:.5 r:.5 G5:.5 E5:.5 C5:1 | F5:.5 r:.5 A5:.5 r:.5 C6:1 A5:1 | G5:.5 E5:.5 G5:.5 E5:.5 C5:2 | D5:.5 r:.5 G4:.5 r:.5 B4:1 D5:1 | E5:.5 r:.5 G5:.5 r:.5 C6:.5 B5:.5 A5:.5 G5:.5 | A5:1 F5:1 C5:1 A4:1 | B4:.5 C5:.5 D5:.5 F5:.5 G5:1 B4:1 | C5:2 r:2" },
    sufokia: { name: "Baie de Sufokia", gain: 1.05, bpm: 120, bpb: 3, acc: "jig", dr: "folk3", lead: ["acc", "fiddle"], ch: "Dm Dm C C Dm Dm A A Dm Dm Bb C Dm Gm A Dm",
      mel: "A4:1 D5:1 D5:1 | D5:.5 E5:.5 F5:1 D5:1 | E5:1 C5:1 C5:1 | C5:.5 D5:.5 E5:1 C5:1 | A4:1 D5:1 F5:1 | A5:2 F5:1 | E5:1 C#5:1 A4:1 | E5:3 | F5:1 E5:1 D5:1 | A5:1.5 G5:.5 F5:1 | F5:1 D5:1 Bb4:1 | C5:1 E5:1 G5:1 | F5:1 E5:1 D5:1 | G5:1 Bb5:1 D5:1 | C#5:1 E5:1 A4:1 | D5:3" },
    divines: { name: "Dimensions divines", gain: 1.7, bpm: 66, bpb: 4, acc: "chime", pad: 1, padCut: 1600, lead: ["flute", "bell"], intro: 1, ch: "E F# G#m F# E C#m F# B",
      mel: "G#5:2 B5:2 | A#5:3 F#5:1 | G#5:2 D#5:2 | F#5:4 | E5:2 G#5:1 B5:1 | C#6:3 G#5:1 | A#5:2 F#5:2 | D#5:4" },
    obscure: { name: "Dimension Obscure", gain: 1.6, bpm: 58, bpb: 4, acc: "drone", pad: 1.2, padCut: 500, dr: "slow", lead: ["bell"], lead2: "fiddle-12", intro: 1, ch: "Cm Gb Cm Gb Ab Gb Fm G",
      mel: "G5:3 Gb5:1 | Bb5:2 Db6:2 | C6:3 G5:1 | Gb5:4 | Eb5:2 C5:2 | Db5:2 Bb4:2 | C5:2 Ab4:2 | B4:4" },
    vulkania: { name: "Archipel de Vulkania", gain: 0.7, bpm: 128, bpb: 4, acc: "stabs", pad: 0.8, padCut: 900, dr: "tribal", lead: ["horn", "fiddle"], ch: "Em Em C D Em Em C B",
      mel: "E5:.5 E5:.5 G5:.5 A5:.5 B5:1 G5:1 | E5:1.5 D5:.5 E5:2 | G5:.5 G5:.5 A5:.5 B5:.5 C6:1 B5:1 | A5:1.5 F#5:.5 D5:2 | B5:1 G5:1 E5:1 G5:1 | B5:1.5 A5:.5 G5:1 F#5:1 | E5:1 G5:1 C6:1 B5:1 | F#5:2 D#5:2" },
    wukin: { name: "Pagodes de Wukin", gain: 0.93, bpm: 84, bpb: 4, acc: "harp", pad: 0.8, dr: "desert", lead: ["fiddle", "flute"], intro: 1, ch: "Gm F Eb F Gm Bb F Gm",
      mel: "D5:1 F5:1 G5:2 | F5:1.5 D5:.5 C5:2 | Bb4:1 C5:1 G5:2 | F5:4 | G5:1 Bb5:1 G5:1 F5:1 | D5:2 F5:2 | C5:1 D5:1 F5:1 C5:1 | D5:1 Bb4:1 G4:2" },
    harebourg: { name: "Château d'Harebourg", gain: 1.18, bpm: 100, bpb: 3, acc: "waltz", pad: 0.9, padCut: 900, dr: "waltz", lead: ["bell", "fiddle"], ch: "Bm Bm Em Em F# F# Bm Bm G Em Bm F# G Em F# Bm",
      mel: "F#5:2 D5:1 | B4:2 D5:1 | G5:2 E5:1 | B4:3 | A#4:1 C#5:1 E5:1 | F#5:3 | D5:1 C#5:1 B4:1 | D5:1 F#5:2 | G5:2 B5:1 | G5:1 E5:1 B4:1 | F#5:2 D5:1 | C#5:2 A#4:1 | B4:1 D5:1 G5:1 | E5:2 G5:1 | F#5:1 E5:1 C#5:1 | B4:3" },
    guilde: { name: "Salle de guilde", gain: 0.9, bpm: 108, bpb: 4, acc: "jig", dr: "folk4", lead: ["acc", "flute"], ch: "F Bb F C Dm Bb C F",
      mel: "A4:1 C5:1 F5:1.5 E5:.5 | D5:2 F5:2 | C5:1 A4:1 C5:1 F5:1 | E5:3 G5:1 | F5:1.5 E5:.5 D5:1 A4:1 | Bb4:1 D5:1 F5:2 | G5:1 F5:1 E5:1 G5:1 | F5:4" },
    hdv: { name: "Hôtel de vente", gain: 1.05, bpm: 116, bpb: 4, acc: "pizz", dr: "folk4", lead: ["pluck", "mar"], ch: "Bb Gm Eb F Bb Gm Cm F",
      mel: "D5:.5 F5:.5 Bb5:.5 F5:.5 D5:1 F5:1 | G5:.5 Bb5:.5 G5:.5 D5:.5 G5:2 | Eb5:1 G5:1 Bb5:1 G5:1 | F5:1.5 Eb5:.5 C5:2 | Bb4:.5 D5:.5 F5:.5 Bb5:.5 A5:1 Bb5:1 | G5:1 D5:1 Bb4:2 | C5:.5 Eb5:.5 G5:.5 Eb5:.5 C5:1 Eb5:1 | F5:2 C5:2" },
    atelier: { name: "Atelier des artisans", gain: 1.15, bpm: 100, bpb: 4, acc: "march", dr: "anvil", lead: ["acc", "fiddle"], ch: "C Bb F C C Bb F G",
      mel: "G4:1 C5:1 E5:1 G5:1 | F5:1.5 D5:.5 Bb4:2 | A4:1 C5:1 F5:1 A5:1 | G5:3 E5:1 | E5:1 G5:1 C6:1 G5:1 | Bb5:1.5 A5:.5 F5:2 | A5:1 F5:1 C5:1 A4:1 | B4:2 D5:2" },
    salleboss: { name: "Salle du boss", gain: 0.7, bpm: 124, bpb: 4, acc: "stabs", pad: 1, padCut: 900, dr: "tribal", lead: ["horn", "fiddle"], ch: "Cm Cm Ab Bb Cm Cm Fm G",
      mel: "C5:1 Eb5:1 G5:1 C6:1 | Bb5:1.5 G5:.5 Eb5:2 | C5:.5 Eb5:.5 Ab5:1 G5:1 Eb5:1 | F5:1.5 D5:.5 Bb4:2 | G5:1 C6:1 Bb5:1 G5:1 | Ab5:1 G5:1 Eb5:1 C5:1 | F5:1 Ab5:1 C6:1 Ab5:1 | B5:2 G5:2" },
    nuit: { name: "Nuit au Havre-Sac", gain: 1.2, bpm: 66, bpb: 3, acc: "box", pad: 0.6, padCut: 800, lead: ["flute"], intro: 1, lv: 0.6, ch: "F Dm Bb F Gm C F F",
      mel: "A5:2 F5:1 | A5:1 F5:1 D5:1 | D5:2 F5:1 | C5:3 | Bb4:1 D5:1 G5:1 | G5:2 E5:1 | F5:1 A4:1 C5:1 | F5:3" },
    fetes: { name: "Fêtes de fin d'année", gain: 0.82, bpm: 120, bpb: 4, acc: "pizz", dr: "sleigh", lead: ["bell", "flute"], ch: "G C G D G C D G",
      mel: "B4:1 D5:1 G5:1.5 F#5:.5 | E5:1 G5:1 E5:2 | D5:1 B4:1 G4:1 B4:1 | A4:3 r:1 | B4:1 D5:1 G5:1 B5:1 | C6:1.5 B5:.5 A5:1 G5:1 | F#5:1 E5:1 D5:1 F#5:1 | G5:4" },
  };
  Object.entries(SONGS).forEach(([k, v]) => (TRACKS[k] = song(v)));
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
