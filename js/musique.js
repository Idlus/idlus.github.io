/* 1.0.22 : musique et sons composés pour Idlus, joués par le navigateur (Web Audio) : aucun fichier, aucune œuvre d'Ankama. Utilisé par js/ui.js (sndPlay, musSync) */
(function () {
  const A = {};
  let ctx = null, master, musicBus, musicRv, sfxBus, reverb, seq = null;
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
    musicRv = ctx.createGain(); musicRv.gain.value = 0.55; musicRv.connect(reverb); // envoi vers la réverbération, dosé par morceau (T.rv)
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    const ss = ctx.createGain(); ss.gain.value = 0.16; sfxBus.connect(ss); ss.connect(reverb);
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  let noiseBuf = null;
  function noise() { if (noiseBuf) return noiseBuf; const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }
  function env(g, t, v, att, len, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + att); g.gain.setTargetAtTime(0.0001, t + Math.max(att, len), rel); }
  // hauteur avec glissé d'entrée (o.sl demi-tons sous la note, pendant o.slt secondes)
  function setF(p, f, t, o) { if (o && o.sl) { p.setValueAtTime(f * Math.pow(2, -o.sl / 12), t); p.exponentialRampToValueAtTime(f, t + (o.slt || 0.09)); } else p.setValueAtTime(f, t); }
  let buzzC = null;
  function shaper() { const w = ctx.createWaveShaper(); if (!buzzC) { buzzC = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; buzzC[i] = Math.tanh(3.5 * x) / Math.tanh(3.5); } } w.curve = buzzC; return w; }
  function vib(t, d, f0, depth, rate, delay) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * depth, t + Math.min(delay, Math.max(0.02, d))); lfo.connect(lg); lfo.start(t); lfo.stop(t + d + 0.6); return lg; }

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
  // corde pincée : harpe, guitare, banjo, clavecin, koto, oud (o.hp coupe les graves, o.buzz fait grésiller, o.bend tire la corde)
  function pluck(t, m, d, v, dest, o = {}) {
    const s = ctx.createBufferSource(); s.buffer = ksBuf(m, o.damp || 0.996);
    if (o.sl) { s.playbackRate.setValueAtTime(Math.pow(2, -o.sl / 12), t); s.playbackRate.exponentialRampToValueAtTime(1, t + (o.slt || 0.08)); }
    if (o.bend) { const bt = t + Math.min(d * 0.5, 0.3); s.playbackRate.setValueAtTime(1, bt); s.playbackRate.linearRampToValueAtTime(Math.pow(2, o.bend / 12), bt + 0.15); }
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.cut || 3200; let last = f;
    if (o.hp) { const h = ctx.createBiquadFilter(); h.type = "highpass"; h.frequency.value = o.hp; last.connect(h); last = h; }
    if (o.buzz) { const pk = ctx.createBiquadFilter(), w = shaper(); pk.type = "peaking"; pk.frequency.value = 1800; pk.gain.value = 6; last.connect(pk); pk.connect(w); last = w; }
    const g = ctx.createGain(); g.gain.setValueAtTime(v * 1.6, t); g.gain.setTargetAtTime(0.0001, t + d, o.rel || 0.25);
    s.connect(f); last.connect(g); g.connect(dest); s.start(t); s.stop(t + d + 1.4);
  }
  // flûte en bois, et ses cousines (flûte de pan, ney, shakuhachi, flûte à bec, tin whistle) selon le souffle o.br et les harmoniques o.parts
  function flute(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.cut || 2600;
    const parts = o.parts || [[1, 1], [2, 0.18], [3, 0.06]], lg = vib(t, d, f0, o.vib || 0.007, o.vr || 5.2, o.vd || 0.5);
    parts.forEach(([k, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = "sine"; setF(os.frequency, f0 * k, t, o); og.gain.value = a; lg.connect(os.frequency); os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + 0.6); });
    const n = ctx.createBufferSource(); n.buffer = noise(); n.loop = !!o.br; const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f0 * 2; bp.Q.value = 1.2;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(o.ch || 0.25, t + 0.04); ng.gain.setTargetAtTime(o.br || 0.03, t + 0.06, 0.08); ng.gain.setTargetAtTime(0.0001, t + d, 0.08);
    n.connect(bp); bp.connect(ng); ng.connect(lp); n.start(t); n.stop(t + d + 0.5);
    env(g, t, v * 0.5, o.att || 0.07, d, o.rel || 0.09); lp.connect(g); g.connect(dest);
  }
  // sifflement (western) et thérémine (Halouine) : une onde pure qui glisse
  function whistle(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lg = vib(t, d, f0, o.vib || 0.012, o.vr || 6, o.vd || 0.35);
    [[1, 1], [2, o.h2 || 0]].forEach(([k, a]) => { if (!a) return; const os = ctx.createOscillator(), og = ctx.createGain(); os.type = "sine"; setF(os.frequency, f0 * k, t, { sl: o.sl || 0.7, slt: o.slt || 0.07 }); og.gain.value = a; lg.connect(os.frequency); os.connect(og); og.connect(g); os.start(t); os.stop(t + d + 0.6); });
    env(g, t, v * 0.3, o.att || 0.03, d, o.rel || 0.06); g.connect(dest);
  }
  // cuivres : cor, trompette, tuba, trompette bouchée (o.hp), cuivre saturé (o.buzz)
  function horn(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(o.cut || 1400, t + (o.att || 0.12)); lp.frequency.setTargetAtTime(o.cut ? o.cut * 0.7 : 900, t + 0.2, 0.3);
    [-4, 4].forEach((c) => { const os = ctx.createOscillator(); os.type = "sawtooth"; setF(os.frequency, f0, t, o); os.detune.value = c; os.connect(lp); os.start(t); os.stop(t + d + 0.6); });
    let last = lp;
    if (o.hp) { const h = ctx.createBiquadFilter(); h.type = "highpass"; h.frequency.value = o.hp; last.connect(h); last = h; }
    if (o.buzz) { const w = shaper(); last.connect(w); last = w; }
    env(g, t, v * 0.33 * (o.buzz ? 0.45 : 1), o.att || 0.12, d, o.rel || 0.12); last.connect(g); g.connect(dest);
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
  // vibraphone : lames de métal avec le moteur qui fait onduler le son
  function vibes(t, m, v, dest) { const g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); g.gain.value = 0.75; lfo.frequency.value = 5.5; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + 4);
    bell(t, m, 1, v, g, { parts: [[1, 1, 2.2], [4, 0.16, 0.5], [10, 0.04, 0.1]] }); g.connect(dest); }
  // basse douce
  function bass(t, m, d, v, dest) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    [["triangle", 1], ["sine", 0.8]].forEach(([type, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = type; os.frequency.value = f0; og.gain.value = a; os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + 0.6); });
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.42, t + 0.015); g.gain.setTargetAtTime(v * 0.18, t + 0.05, 0.4); g.gain.setTargetAtTime(0.0001, t + d, 0.12);
    lp.connect(g); g.connect(dest);
  }
  // archet : violon, erhu (nasal, glissé), vielle à roue (o.buzz), violoncelle
  function fiddle(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(); bp.type = "peaking"; bp.frequency.value = o.pk || 2200; bp.gain.value = o.pg || 5; lp.type = "lowpass"; lp.frequency.value = o.cut || 3400;
    const lg = vib(t, d, f0, o.vib || 0.009, o.vr || 5.6, 0.4);
    [-5, 5].forEach((c) => { const os = ctx.createOscillator(); os.type = "sawtooth"; setF(os.frequency, f0, t, o); os.detune.value = c; lg.connect(os.frequency); os.connect(bp); os.start(t); os.stop(t + d + 0.5); });
    bp.connect(lp); let last = lp; if (o.buzz) { const w = shaper(); lp.connect(w); last = w; }
    env(g, t, v * 0.2 * (o.buzz ? 0.55 : 1), o.att || 0.07, d, o.rel || 0.1); last.connect(g); g.connect(dest);
  }
  // accordéon (anches, léger tremolo)
  function accord(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), tr = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = o.cut || 2300;
    [["square", 1, 0, 0.5], ["sawtooth", 1, 9, 0.5], ["sawtooth", 2, -6, 0.15]].forEach(([type, k, c, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = type; os.frequency.value = f0 * k; os.detune.value = c; og.gain.value = a; os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + 0.4); });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6.2; lg.gain.value = 0.12; tr.gain.value = 0.88; lfo.connect(lg); lg.connect(tr.gain); lfo.start(t); lfo.stop(t + d + 0.4);
    env(g, t, v * 0.13, o.att || 0.04, d, 0.08); lp.connect(tr); tr.connect(g); g.connect(dest);
  }
  // anches : clarinette (carré), hautbois et basson (dent de scie, formant o.pk)
  function reed(t, m, d, v, dest, o = {}) {
    const f0 = mtof(m), g = ctx.createGain(), pk = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    pk.type = "peaking"; pk.frequency.value = o.pk || 1000; pk.gain.value = o.pg || 5; pk.Q.value = 1.4; lp.type = "lowpass"; lp.frequency.value = o.cut || 2200;
    const os = ctx.createOscillator(); os.type = o.wave || "square"; setF(os.frequency, f0, t, o); vib(t, d, f0, o.vib || 0.005, 5, 0.6).connect(os.frequency);
    os.connect(pk); pk.connect(lp); env(g, t, v * 0.14, o.att || 0.035, d, o.rel || 0.07); lp.connect(g); g.connect(dest); os.start(t); os.stop(t + d + 0.5);
  }
  // orgue à tirettes (accord ou note seule)
  function organ(t, ms, d, v, dest, o = {}) {
    const arr = [].concat(ms), g = ctx.createGain(), lp = ctx.createBiquadFilter(), tr = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = o.cut || 3200;
    arr.forEach((m) => (o.reg || [[1, 1], [2, 0.5], [3, 0.22], [4, 0.2], [8, 0.07]]).forEach(([k, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = "sine"; os.frequency.value = mtof(m) * k; og.gain.value = a; os.connect(og); og.connect(lp); os.start(t); os.stop(t + d + (o.rel || 0.1) + 0.2); }));
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.8; lg.gain.value = 0.08; tr.gain.value = 0.92; lfo.connect(lg); lg.connect(tr.gain); lfo.start(t); lfo.stop(t + d + (o.rel || 0.1) + 0.2);
    const a = v * 0.1 / Math.sqrt(arr.length), at = Math.min(o.att || 0.025, d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + at); g.gain.setValueAtTime(a, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + (o.rel || 0.1));
    lp.connect(tr); tr.connect(g); g.connect(dest);
  }
  // chœur : voyelles « a », « o », « ou » (accord, ou une seule voix avec o.vib)
  const VOW = { a: [[750, 1], [1150, 0.55], [2800, 0.2]], o: [[450, 1], [800, 0.5], [2700, 0.12]], u: [[330, 1], [750, 0.25], [2500, 0.07]] };
  function choir(t, ms, d, v, dest, o = {}) {
    const arr = [].concat(ms), g = ctx.createGain(), sum = ctx.createGain(), at = o.att || 0.5, rel = o.rel || 1.2, end = t + Math.max(d, at);
    const lg = o.vib ? vib(t, d + rel, mtof(arr[0]), o.vib, 5, 0.6) : null;
    arr.forEach((m) => [-10, 0, 10].forEach((c) => { const os = ctx.createOscillator(); os.type = "sawtooth"; setF(os.frequency, mtof(m), t, o); os.detune.value = c + rnd(4); if (lg) lg.connect(os.frequency); os.connect(sum); os.start(t); os.stop(end + rel + 0.2); }));
    VOW[o.vow || "a"].forEach(([f, a]) => { const bp = ctx.createBiquadFilter(), fg = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 5; fg.gain.value = a; sum.connect(bp); bp.connect(fg); fg.connect(g); });
    const a = v * 0.35 / Math.sqrt(arr.length); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + at); g.gain.setValueAtTime(a, end); g.gain.linearRampToValueAtTime(0.0001, end + rel);
    g.connect(dest);
  }
  // harmonica de verre (Frigost)
  function glass(t, ms, d, v, dest, o = {}) {
    const arr = [].concat(ms), g = ctx.createGain();
    arr.forEach((m) => [[1, 1], [2, 0.12], [3, 0.04]].forEach(([k, a]) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = "sine"; os.frequency.value = mtof(m) * k; og.gain.value = a; os.connect(og); og.connect(g); os.start(t); os.stop(t + d + 1.5); }));
    const a = v * 0.16 / Math.sqrt(arr.length); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + Math.min(o.att || 0.18, d)); g.gain.setValueAtTime(a, t + d); g.gain.setTargetAtTime(0.0001, t + d, 0.25);
    g.connect(dest);
  }
  // didgeridoo : bourdon grave qui « parle » (filtre qui ondule)
  function didge(t, m, d, v, dest, o = {}) {
    const os = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), bg = ctx.createGain(); os.type = "sawtooth"; os.frequency.value = mtof(m);
    lp.type = "lowpass"; lp.frequency.value = 260; bp.type = "bandpass"; bp.Q.value = 5; bp.frequency.value = 650; bg.gain.value = 1.4;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = o.rate || 2.4; lg.gain.value = 380; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t); lfo.stop(t + d + 1);
    os.connect(lp); os.connect(bp); bp.connect(bg); lp.connect(g); bg.connect(g); env(g, t, v * 0.35, 0.08, d, 0.15); g.connect(dest); os.start(t); os.stop(t + d + 1);
  }
  // percussions : une membrane (hauteur qui tombe) et un souffle filtré
  function hit(t, f1, f2, dec, v, dest, type) { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = type || "sine"; os.frequency.setValueAtTime(f1, t); if (f2 !== f1) os.frequency.exponentialRampToValueAtTime(f2, t + dec * 1.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, dec); os.connect(g); g.connect(dest); os.start(t); os.stop(t + dec * 8 + 0.1); }
  function nz(t, type, f, q, dec, v, dest, att) { const n = ctx.createBufferSource(); n.buffer = noise(); const fl = ctx.createBiquadFilter(), g = ctx.createGain(), a = att || 0.003; fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.setTargetAtTime(0.0001, t + a + 0.002, dec); n.connect(fl); fl.connect(g); g.connect(dest); n.start(t, Math.random() * 1.2); n.stop(t + dec * 8 + 0.1); }
  function timp(t, m, v, dest) { const f0 = mtof(m); [[1, 1, 0.5], [1.5, 0.35, 0.3], [1.98, 0.2, 0.25]].forEach(([k, a, dec]) => hit(t, f0 * k * 1.02, f0 * k, dec, v * a * 0.8, dest)); nz(t, "lowpass", 500, 0, 0.05, v * 0.3, dest); }
  const DRUMS = {
    snare: (t, v, o) => { hit(t, 200, 160, 0.04, v * 0.5, o, "triangle"); nz(t, "bandpass", 2200, 0.7, 0.07, v * 0.45, o); },
    clap: (t, v, o) => { [0, 0.011, 0.022].forEach((x) => nz(t + x, "bandpass", 1300, 1.4, 0.012, v * 0.5, o)); nz(t + 0.03, "bandpass", 1300, 1.2, 0.06, v * 0.45, o); },
    shaker: (t, v, o) => nz(t, "highpass", 5500, 0, 0.035, v * 0.22, o, 0.012),
    hat: (t, v, o) => nz(t, "highpass", 7500, 0, 0.02, v * 0.25, o),
    crash: (t, v, o) => { nz(t, "highpass", 3800, 0, 0.6, v * 0.28, o); nz(t, "bandpass", 7000, 1, 0.9, v * 0.12, o); },
    wood: (t, v, o) => { hit(t, 950, 950, 0.035, v * 0.5, o); hit(t, 2600, 2600, 0.015, v * 0.15, o); },
    wood2: (t, v, o) => { hit(t, 700, 700, 0.04, v * 0.5, o); hit(t, 1900, 1900, 0.015, v * 0.15, o); },
    clave: (t, v, o) => hit(t, 2500, 2500, 0.03, v * 0.45, o),
    rim: (t, v, o) => { hit(t, 1700, 1700, 0.012, v * 0.4, o); nz(t, "bandpass", 3200, 2, 0.012, v * 0.3, o); },
    snap: (t, v, o) => { nz(t, "bandpass", 2600, 3, 0.012, v * 0.6, o); hit(t, 1800, 1800, 0.008, v * 0.15, o); },
    conga: (t, v, o) => { hit(t, 340, 300, 0.12, v * 0.7, o); nz(t, "lowpass", 1500, 0, 0.015, v * 0.2, o); },
    conga2: (t, v, o) => { hit(t, 250, 220, 0.14, v * 0.7, o); nz(t, "lowpass", 1200, 0, 0.015, v * 0.2, o); },
    bongo: (t, v, o) => { hit(t, 520, 470, 0.07, v * 0.6, o); nz(t, "bandpass", 2500, 1, 0.01, v * 0.2, o); },
    log: (t, v, o) => { hit(t, 260, 250, 0.18, v * 0.6, o); hit(t, 624, 624, 0.05, v * 0.2, o); },
    log2: (t, v, o) => { hit(t, 390, 375, 0.15, v * 0.55, o); hit(t, 936, 936, 0.04, v * 0.2, o); },
    dum: (t, v, o) => { hit(t, 110, 75, 0.16, v * 0.9, o); nz(t, "lowpass", 600, 0, 0.03, v * 0.3, o); },
    tek: (t, v, o) => { nz(t, "bandpass", 3400, 1.8, 0.025, v * 0.55, o); hit(t, 900, 850, 0.02, v * 0.2, o); },
    ka: (t, v, o) => nz(t, "bandpass", 2800, 1.5, 0.02, v * 0.35, o),
    taiko: (t, v, o) => { hit(t, 95, 55, 0.35, v, o); nz(t, "lowpass", 350, 0, 0.08, v * 0.45, o); },
    tom: (t, v, o) => { hit(t, 160, 110, 0.18, v * 0.8, o); nz(t, "lowpass", 900, 0, 0.03, v * 0.25, o); },
    stomp: (t, v, o) => { hit(t, 75, 45, 0.1, v * 0.9, o); nz(t, "lowpass", 280, 0, 0.05, v * 0.5, o); },
    bodhran: (t, v, o) => { hit(t, 120, 80, 0.15, v * 0.8, o); nz(t, "lowpass", 900, 0, 0.035, v * 0.3, o); },
    tick: (t, v, o) => { hit(t, 3300, 3300, 0.01, v * 0.35, o); nz(t, "highpass", 4500, 0, 0.006, v * 0.25, o); },
    tock: (t, v, o) => { hit(t, 2100, 2100, 0.012, v * 0.35, o); nz(t, "highpass", 3000, 0, 0.006, v * 0.2, o); },
    heart: (t, v, o) => { hit(t, 70, 45, 0.09, v * 0.9, o); hit(t + 0.2, 62, 42, 0.11, v * 0.7, o); },
    gong: (t, v, o) => { bell(t, 41, 4, v * 0.9, o, { parts: [[1, 1, 4], [1.48, 0.5, 3], [2.03, 0.4, 2.5], [2.74, 0.25, 2], [3.6, 0.15, 1.5]] }); nz(t, "bandpass", 1800, 0.8, 0.8, v * 0.06, o, 0.2); },
  };
  // tambourin et grosse caisse en peau
  function drum(t, kind, v, dest) {
    if (DRUMS[kind]) { DRUMS[kind](t, v, dest); return; }
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
  // ambiances : vent, vagues, oiseaux, grillons, chouette, feu, lave, gouttes, jungle, foule, ruisseau (d en secondes)
  function amb(t, kind, d, v, dest) {
    const chirp = (t0, f1, f2, dur, a) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = "sine"; os.frequency.setValueAtTime(f1, t0); os.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a, t0 + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); os.connect(g); g.connect(dest); os.start(t0); os.stop(t0 + dur + 0.05); };
    const bed = (type, f, q, a, att, fEnd) => { const n = ctx.createBufferSource(); n.buffer = noise(); n.loop = true; const fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (fEnd) fl.frequency.linearRampToValueAtTime(fEnd, t + d); if (q) fl.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + d * att); g.gain.linearRampToValueAtTime(0.0001, t + d); n.connect(fl); fl.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + d + 0.1); };
    if (kind === "wind") bed("bandpass", 300 + Math.random() * 300, 2.5, v * 0.5, 0.5, 500 + Math.random() * 500);
    else if (kind === "waves") bed("lowpass", 450, 0.5, v * 0.45, 0.4, 900);
    else if (kind === "stream") bed("bandpass", 2400, 0.6, v * 0.1, 0.5, 3000);
    else if (kind === "crowd") { bed("bandpass", 700, 0.8, v * 0.22, 0.3, 1100); bed("bandpass", 1600, 1.2, v * 0.08, 0.2, 2200); }
    else if (kind === "lava") { bed("lowpass", 90, 1, v * 0.9, 0.5, 130); for (let i = 0; i < 3; i++) if (Math.random() < 0.6) chirp(t + Math.random() * d * 0.8, 160, 70, 0.25, v * 0.2); }
    else if (kind === "fire") { bed("lowpass", 160, 0.7, v * 0.3, 0.5); for (let i = 0; i < 10; i++) nz(t + Math.random() * d, "highpass", 2500 + Math.random() * 2000, 0, 0.004, v * (0.06 + Math.random() * 0.1), dest); }
    else if (kind === "birds") { const n = 2 + Math.floor(Math.random() * 3), f = 2600 + Math.random() * 1200; for (let i = 0; i < n; i++) chirp(t + i * 0.13, f, f * 1.35, 0.07, v * 0.09); }
    else if (kind === "crickets") { for (let i = 0; i < Math.floor(d / 0.9); i++) { const x = t + i * 0.9 + Math.random() * 0.2; for (let k = 0; k < 3; k++) chirp(x + k * 0.045, 4400, 4300, 0.03, v * 0.06); } }
    else if (kind === "jungle") { for (let i = 0; i < Math.floor(d / 0.7); i++) { const x = t + i * 0.7 + Math.random() * 0.2; for (let k = 0; k < 4; k++) chirp(x + k * 0.03, 3300, 3200, 0.02, v * 0.045); } if (Math.random() < 0.4) { const x = t + Math.random() * d * 0.7; chirp(x, 1500, 700, 0.18, v * 0.08); chirp(x + 0.25, 1500, 700, 0.18, v * 0.07); } }
    else if (kind === "drip") chirp(t, 900 + Math.random() * 500, 1900 + Math.random() * 700, 0.05, v * 0.1);
    else if (kind === "owl") [0, 0.5].forEach((x, i) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.type = "sine"; os.frequency.setValueAtTime(400 - i * 30, t + x); os.frequency.linearRampToValueAtTime(370 - i * 30, t + x + 0.35);
      g.gain.setValueAtTime(0.0001, t + x); g.gain.linearRampToValueAtTime(v * 0.1, t + x + 0.07); g.gain.linearRampToValueAtTime(0.0001, t + x + 0.4); os.connect(g); g.connect(dest); os.start(t + x); os.stop(t + x + 0.45); });
  }
  const POLY = new Set(["pad", "organ", "choir", "glass"]);
  const mix = (base, o) => (o ? Object.assign({}, base, o) : base);
  const V = {
    pluck: (t, e, d, v, o) => pluck(t, e.m, d, v, o, e.o),
    gtr: (t, e, d, v, o) => pluck(t, e.m, d, v * 0.9, o, mix({ damp: 0.997, cut: 2300 }, e.o)),
    banjo: (t, e, d, v, o) => pluck(t, e.m, Math.min(d, 0.6), v, o, mix({ damp: 0.986, cut: 6500, hp: 450 }, e.o)),
    harpsi: (t, e, d, v, o) => { const x = mix({ damp: 0.993, cut: 7000, hp: 250, rel: 0.12 }, e.o); pluck(t, e.m, d, v * 0.7, o, x); pluck(t + 0.004, e.m + 12, d, v * 0.3, o, x); },
    koto: (t, e, d, v, o) => pluck(t, e.m, d, v, o, mix({ damp: 0.995, cut: 4800, hp: 180 }, e.o)),
    oud: (t, e, d, v, o) => pluck(t, e.m, d, v * 0.6, o, mix({ damp: 0.991, cut: 3200, buzz: 1 }, e.o)),
    pizz: (t, e, d, v, o) => pluck(t, e.m, Math.min(d, 0.5), v * 1.2, o, mix({ damp: 0.983, cut: 1200 }, e.o)),
    flute: (t, e, d, v, o) => flute(t, e.m, d, v, o, e.o),
    pan: (t, e, d, v, o) => flute(t, e.m, d, v, o, mix({ br: 0.12, ch: 0.45, parts: [[1, 1], [2, 0.1], [3, 0.03]], cut: 3000, vib: 0.004 }, e.o)),
    lowwh: (t, e, d, v, o) => flute(t, e.m, d, v, o, mix({ br: 0.07, ch: 0.3, cut: 1900, vib: 0.009, vr: 4.6, att: 0.1 }, e.o)),
    ney: (t, e, d, v, o) => flute(t, e.m, d, v, o, mix({ br: 0.16, ch: 0.35, parts: [[1, 1], [2, 0.08], [3, 0.03]], cut: 2200, vib: 0.008, vr: 4.8 }, e.o)),
    shaku: (t, e, d, v, o) => flute(t, e.m, d, v, o, mix({ br: 0.2, ch: 0.5, parts: [[1, 1], [2, 0.12]], cut: 1800, vib: 0.01, vr: 4.2, vd: 0.8, att: 0.12 }, e.o)),
    rec: (t, e, d, v, o) => flute(t, e.m, d, v, o, mix({ br: 0.04, ch: 0.2, parts: [[1, 1], [2, 0.3], [3, 0.12], [4, 0.04]], cut: 4000, vib: 0.003 }, e.o)),
    tin: (t, e, d, v, o) => flute(t, e.m, d, v, o, mix({ br: 0.05, ch: 0.3, parts: [[1, 1], [2, 0.22], [3, 0.08]], cut: 5000, vib: 0.006, vr: 6, att: 0.02 }, e.o)),
    whistle: (t, e, d, v, o) => whistle(t, e.m, d, v, o, e.o),
    theremin: (t, e, d, v, o) => whistle(t, e.m, d, v, o, mix({ sl: 2.5, slt: 0.25, vib: 0.022, vr: 6.3, vd: 0.1, att: 0.12, rel: 0.25, h2: 0.15 }, e.o)),
    horn: (t, e, d, v, o) => horn(t, e.m, d, v, o, e.o),
    tpt: (t, e, d, v, o) => horn(t, e.m, d, v, o, mix({ cut: 3200, att: 0.035 }, e.o)),
    tuba: (t, e, d, v, o) => horn(t, e.m, d, v, o, mix({ cut: 550, att: 0.03, rel: 0.06 }, e.o)),
    mute: (t, e, d, v, o) => horn(t, e.m, d, v, o, mix({ cut: 2000, att: 0.03, hp: 700 }, e.o)),
    dist: (t, e, d, v, o) => horn(t, e.m, d, v, o, mix({ cut: 1800, att: 0.03, buzz: 1 }, e.o)),
    reed: (t, e, d, v, o) => reed(t, e.m, d, v, o, e.o),
    oboe: (t, e, d, v, o) => reed(t, e.m, d, v, o, mix({ wave: "sawtooth", pk: 1400, pg: 9, cut: 3600, vib: 0.006 }, e.o)),
    bsn: (t, e, d, v, o) => reed(t, e.m, d, v, o, mix({ wave: "sawtooth", pk: 500, pg: 6, cut: 1300 }, e.o)),
    fiddle: (t, e, d, v, o) => fiddle(t, e.m, d, v, o, e.o),
    erhu: (t, e, d, v, o) => fiddle(t, e.m, d, v, o, mix({ pk: 1100, pg: 8, cut: 3000, vib: 0.014, vr: 6.2 }, e.o)),
    hurdy: (t, e, d, v, o) => fiddle(t, e.m, d, v, o, mix({ pk: 1500, pg: 7, buzz: 1, vib: 0.002 }, e.o)),
    cello: (t, e, d, v, o) => fiddle(t, e.m, d, v, o, mix({ cut: 1500, pk: 700, pg: 4, vib: 0.006 }, e.o)),
    stacc: (t, e, d, v, o) => fiddle(t, e.m, d, v, o, mix({ att: 0.01, rel: 0.04, cut: 2600 }, e.o)),
    acc: (t, e, d, v, o) => accord(t, e.m, d, v, o, e.o),
    pad: (t, e, d, v, o) => pad(t, e.m, d, v, o, e.o),
    organ: (t, e, d, v, o) => organ(t, e.m, d, v, o, e.o),
    choir: (t, e, d, v, o) => choir(t, e.m, d, v, o, e.o),
    choir1: (t, e, d, v, o) => choir(t, e.m, d, v, o, mix({ vib: 0.006, att: 0.12, rel: 0.3 }, e.o)),
    hum: (t, e, d, v, o) => choir(t, e.m, d, v, o, mix({ vow: "u", vib: 0.005, att: 0.15, rel: 0.4 }, e.o)),
    glass: (t, e, d, v, o) => glass(t, e.m, d, v, o, e.o),
    bell: (t, e, d, v, o) => bell(t, e.m, d, v, o, e.o),
    glock: (t, e, d, v, o) => bell(t, e.m, d, v, o, { parts: [[1, 1, 1.4], [2.76, 0.28, 0.3], [5.4, 0.1, 0.12]] }),
    kal: (t, e, d, v, o) => bell(t, e.m, d, v, o, { parts: [[1, 1, 0.9], [5.4, 0.25, 0.05], [8.9, 0.08, 0.03]] }),
    steel: (t, e, d, v, o) => bell(t, e.m, d, v * 1.1, o, { parts: [[1, 1, 0.9], [2, 0.55, 0.5], [3, 0.12, 0.25], [4.02, 0.22, 0.3], [5.98, 0.05, 0.12]] }),
    xylo: (t, e, d, v, o) => bell(t, e.m, d, v, o, { parts: [[1, 1, 0.22], [3, 0.35, 0.05], [6.2, 0.1, 0.02]] }),
    vibes: (t, e, d, v, o) => vibes(t, e.m, v, o),
    mar: (t, e, d, v, o) => marimba(t, e.m, v, o, e.o),
    bass: (t, e, d, v, o) => bass(t, e.m, d, v, o),
    didge: (t, e, d, v, o) => didge(t, e.m, d, v, o, e.o),
    timp: (t, e, d, v, o) => timp(t, e.m, v, o),
    drum: (t, e, d, v, o) => drum(t, e.m, v, o),
    amb: (t, e, d, v, o) => amb(t, e.m, d, v, o),
  };
  function voice(e, t, spb, dest) {
    const d = e.d * spb, v = (e.v || 0.7) * (1 + rnd(0.08)) * (LV[e.i] || 1); t += rnd(0.006);
    if (e.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = e.pan; p.connect(dest); dest = p; }
    const f = V[e.i]; if (f) f(t, e, d, v, dest);
  }
  // niveau de chaque instrument, mesuré pour qu'une même force sonne aussi fort d'un instrument à l'autre
  const LV = { pan: 0.94, lowwh: 1.02, ney: 0.99, shaku: 0.98, rec: 0.98, tin: 0.93, whistle: 1.73, theremin: 1.59, reed: 2.55, oboe: 3.74, bsn: 4.14, fiddle: 2.15, erhu: 1.62, hurdy: 3.91, stacc: 2.26, acc: 6.18, choir1: 3.42, hum: 2.98, tpt: 1.01, mute: 1.23, dist: 1.81, gtr: 0.82, banjo: 1.47, harpsi: 1.48, koto: 0.96, oud: 0.43, pizz: 0.91, glock: 1.09, kal: 1.37, steel: 1.11, xylo: 2.82, vibes: 1.19, tuba: 1.25, didge: 1.85, timp: 0.97, cello: 2.31, organ: 2.3, choir: 1.65, glass: 1.65 };

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
  /* 1.0.24 : airs écrits en notation courte, chacun avec ses instruments, son rythme et son ambiance.
     ch : un accord par mesure (« Dm », « Fmaj7 », « C9 »…) ; mel : notes « La4:1.5 » par mesure séparées par « | » (r = silence, durées en temps, « 1/3 » possible),
     suivies de ~ (glissé), ' (piqué), > (accent), ^ (corde tirée) ; parts : accompagnement (arp, line, chord) ; dr : percussions d'une mesure (ou { len, h } sur plusieurs) ;
     lead : instrument de la mélodie à chaque tour (« flute », « horn-12 »…) ; intro : 1er tour sans mélodie ; rv : réverbération ; dly : écho [temps, retour, niveau] ; amb : ambiance ; sw : swing */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const acc = (x) => (x === "#" ? 1 : x === "b" ? -1 : 0);
  function nm(x) { const m = /^([A-G])([#b]?)(\d)$/.exec(x); if (!m) throw new Error("note " + x); return 12 * (+m[3] + 1) + NOTE[m[1]] + acc(m[2]); }
  const QUAL = { "": [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus: [0, 5, 7], sus2: [0, 2, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14] };
  function chordOf(x) { const m = /^([A-G])([#b]?)(maj7|m7|m9|m6|dim|aug|sus2|sus|m|6|7|9)?$/.exec(x); if (!m) throw new Error("accord " + x); const pc = (NOTE[m[1]] + acc(m[2]) + 12) % 12;
    return { r: 45 + ((pc - 9 + 12) % 12), tones: QUAL[m[3] || ""] }; }
  const dur = (s) => (s.includes("/") ? +s.split("/")[0] / +s.split("/")[1] : +s);
  const parseMel = (x) => x.split("|").map((bar) => bar.trim().split(/\s+/).filter(Boolean).map((y) => { const m = /^(r|[A-G][#b]?\d):([\d./]+)([~'>^]*)$/.exec(y); if (!m) throw new Error("note " + y); return [m[1] === "r" ? 0 : nm(m[1]), dur(m[2]), m[3]]; }));
  function melEv(bars, n, inst, v, sh, lo) {
    const ev = []; bars.forEach((bar, i) => { let b = i * n; bar.forEach(([m, d, fl]) => { if (m) { let o = lo;
      if (fl.includes("~") || fl.includes("^")) { o = Object.assign({}, lo); if (fl.includes("~")) { o.sl = 1.5; o.slt = 0.14; } if (fl.includes("^")) o.bend = 1; }
      ev.push({ b, i: inst, m: m + sh, d: fl.includes("'") ? Math.min(d, 0.5) * 0.6 : d * 0.95, v: v * (fl.includes(">") ? 1.25 : 1), o }); } b += d; }); }); return ev;
  }
  // degré d'accord : 0 = fondamentale, 1 = tierce, 2 = quinte… (au-delà, à l'octave) ; « s3 » = fondamentale + 3 demi-tons ; « c » = demi-ton sous la fondamentale ; « E3 » = note fixe
  function toneOf(c, k, oct) {
    if (typeof k === "string") { if (/^[A-G]/.test(k)) return nm(k); return c.r + (k === "c" ? -1 : +k.slice(1)) + 12 * oct; }
    const L = c.tones.length, q = Math.floor(k / L); return c.r + c.tones[k - q * L] + 12 * (q + oct);
  }
  const PART = {
    arp(ev, c, b0, n, o) { const st = o.step || 0.5, at = o.at || 0, cnt = o.cnt || Math.round((n - at) / st);
      for (let j = 0; j < cnt; j++) { const k = o.seq[j % o.seq.length]; if (k === null) continue; ev.push({ b: b0 + at + j * st, i: o.i || "pluck", m: toneOf(c, k, o.oct || 0), d: o.d || st * 1.6, v: (o.v || 0.4) * (j === 0 && o.acc ? o.acc : 1), o: o.ao, pan: o.pan }); } },
    line(ev, c, b0, n, o) { o.pat.forEach(([x, k, d, v]) => { if (x < n) ev.push({ b: b0 + x, i: o.i || "bass", m: toneOf(c, k, o.oct || 0), d, v: (v || 0.55) * (o.v || 1), o: o.ao, pan: o.pan }); }); },
    chord(ev, c, b0, n, o) { const i = o.i || "pluck", ms = (o.vc || [0, 1, 2]).map((k) => toneOf(c, k, o.oct || 0));
      (o.pat || [[0, n, 0.5]]).forEach(([x, d, v]) => { if (x >= n) return; v = (v || 0.5) * (o.v || 1);
        if (POLY.has(i)) ev.push({ b: b0 + x, i, m: ms, d, v, o: o.ao, pan: o.pan }); else ms.forEach((m, j) => ev.push({ b: b0 + x + j * (o.st || 0), i, m, d, v: v * 0.75, o: o.ao, pan: o.pan })); }); },
  };
  const AMB = {
    wind: (ev, i, n) => { if (i % 2 === 0) ev.push({ b: i * n, i: "amb", m: "wind", d: n * 2.6, v: 0.7 }); },
    waves: (ev, i, n) => { if (i % 2 === 0) ev.push({ b: i * n + Math.random(), i: "amb", m: "waves", d: n * 2.2, v: 0.7 }); },
    stream: (ev, i, n) => { if (i % 2 === 0) ev.push({ b: i * n, i: "amb", m: "stream", d: n * 2.4, v: 0.7 }); },
    crowd: (ev, i, n) => { if (i % 4 === 0) ev.push({ b: i * n, i: "amb", m: "crowd", d: n * 4.4, v: 0.7 }); },
    birds: (ev, i, n) => { if (Math.random() < 0.5) ev.push({ b: i * n + Math.random() * (n - 0.5), i: "amb", m: "birds", d: 1, v: 0.7 }); },
    owl: (ev, i, n) => { if (i % 4 === 2 && Math.random() < 0.6) ev.push({ b: i * n + 1, i: "amb", m: "owl", d: 1, v: 0.7 }); },
    drip: (ev, i, n) => { if (Math.random() < 0.55) ev.push({ b: i * n + Math.random() * (n - 0.5), i: "amb", m: "drip", d: 1, v: 0.7 }); },
    crickets: (ev, i, n) => ev.push({ b: i * n, i: "amb", m: "crickets", d: n, v: 0.7 }),
    jungle: (ev, i, n) => ev.push({ b: i * n, i: "amb", m: "jungle", d: n, v: 0.7 }),
    fire: (ev, i, n) => ev.push({ b: i * n, i: "amb", m: "fire", d: n, v: 0.7 }),
    lava: (ev, i, n) => ev.push({ b: i * n, i: "amb", m: "lava", d: n * 1.2, v: 0.7 }),
  };
  function drumsOf(D, i, n) { if (!D) return []; if (Array.isArray(D)) return D; const off = (i % D.len) * n; return D.h.filter(([x]) => x >= off && x < off + n).map(([x, k, v]) => [x - off, k, v]); }
  const lead = (x) => { const m = /^([a-z0-9]+?)([+-]\d+)?$/.exec(x); return [m[1], +(m[2] || 0)]; };
  function song(S0) {
    const n = S0.bpb, ch = S0.ch.trim().split(/\s+/).map(chordOf), L = ch.length, mel = parseMel(S0.mel), mel2 = S0.mel2 ? parseMel(S0.mel2) : null;
    [mel, mel2].forEach((M) => M && M.forEach((b, i) => { const sum = b.reduce((a, x) => a + x[1], 0); if (Math.abs(sum - n) > 1e-6) throw new Error(`${S0.name} : mesure ${i + 1} = ${sum} temps`); }));
    if (mel.length !== L || (mel2 && mel2.length !== L)) throw new Error(`${S0.name} : ${mel.length} mesures pour ${L} accords`);
    [...S0.lead, S0.lead2 || "flute", ...(S0.parts || []).map(([, o]) => o.i || "pluck")].forEach((x) => { if (!V[lead(x)[0]]) throw new Error(`${S0.name} : instrument ${x}`); });
    return { name: S0.name, bpm: S0.bpm, bpb: n, gain: S0.gain || 1, ch, rv: S0.rv, dly: S0.dly,
      build(p) { const ev = [];
        ch.forEach((c, i) => { const b0 = i * n;
          (S0.parts || []).forEach(([k, o]) => { if ((o.from && p < o.from) || (o.alt && p % 2 === 0) || (o.every && i % o.every)) return; PART[k](ev, c, b0, n, o); });
          if (!(S0.drFrom && p < S0.drFrom)) (S0.fill && i === L - 1 ? S0.fill : drumsOf(S0.dr, i, n)).forEach(([x, k, v]) => ev.push({ b: b0 + x, i: "drum", m: k, d: 0.5, v }));
          (S0.hits || []).forEach(([every, x, k, v]) => { if (i % every === 0) ev.push({ b: b0 + x, i: "drum", m: k, d: 1, v }); });
          [].concat(S0.amb || []).forEach((a) => AMB[a](ev, i, n)); });
        if (!(S0.intro && p === 0)) { const q = S0.intro ? p - 1 : p, [li, sh] = lead(S0.lead[q % S0.lead.length]); ev.push(...melEv(mel, n, li, S0.lv || 0.8, sh, S0.lo && S0.lo[li]));
          if (S0.lead2 && (S0.l2 === "all" || q % 2 === 1)) { const [i2, s2] = lead(S0.lead2); ev.push(...melEv(mel2 || mel, n, i2, S0.l2v || 0.45, s2, S0.lo && S0.lo[i2])); } }
        if (S0.sw) ev.forEach((e) => { if (Math.abs((e.b % 1) - 0.5) < 1e-6) e.b += S0.sw * 0.5; });
        return ev.sort((a, b) => a.b - b.b); } };
  }
  const steps = (xs, k, v) => xs.map((x) => [x, k, v]);
  const EIGHTHS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  const SONGS = {
    /* --- chasse : un air par région --- */
    incarnam: { name: "Premiers pas à Incarnam", gain: 1, bpm: 204, bpb: 6, rv: 0.35, amb: "birds", intro: 1, lead: ["flute", "glock"],
      ch: "G C G D Em C D G",
      mel: "D5:2 G5:1 B5:2 A5:1 | G5:2 E5:1 C5:3 | D5:2 G5:1 B5:2 D6:1 | C6:2 B5:1 A5:3 | B5:2 G5:1 E5:2 G5:1 | E5:2 C5:1 E5:2 G5:1 | F#5:2 A5:1 D6:2 C6:1 | B5:3 G5:3",
      parts: [["arp", { i: "pluck", seq: [0, 1, 2, 3, 2, 1], step: 1, oct: 1, d: 2.5, v: 0.4, acc: 1.3, pan: -0.25, ao: { cut: 3600 } }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 5.5, 0.45]] }],
        ["arp", { i: "glock", seq: [4, null, null, 3, null, null], step: 1, oct: 1, v: 0.18, from: 2, pan: 0.35 }]] },
    marche: { name: "Marché d'Astrub", gain: 0.77, bpm: 128, bpb: 2, rv: 0.12, lead: ["reed", "glock"], lead2: "reed-12", l2v: 0.35,
      ch: "F F C7 C7 C7 C7 F F F F7 Bb Bb F C7 F F",
      mel: "C5:.5' F5:.5' F5:.5' A5:.5' | C6:1 A5:.5' F5:.5' | E5:.5' G5:.5' G5:.5' Bb5:.5' | D6:1 Bb5:.5' G5:.5' | E5:.5' F5:1/4 G5:1/4 A5:.5' Bb5:.5' | C6:.5' Bb5:.5' A5:.5' G5:.5' | F5:.5' A5:.5' G5:.5' E5:.5' | F5:1 r:1 | C5:.5' F5:.5' F5:.5' A5:.5' | C6:1 Eb6:1 | D6:.5' C6:.5' Bb5:.5' D6:.5' | F6:1 D6:.5' Bb5:.5' | A5:.5' C6:.5' F5:.5' A5:.5' | G5:.5' A5:1/4 G5:1/4 E5:.5' C5:.5' | F5:.5' C5:.5' A4:.5' C5:.5' | F5:1 r:1",
      parts: [["line", { i: "tuba", oct: -1, pat: [[0, 0, 0.4, 0.6], [1, 2, 0.4, 0.5]] }],
        ["chord", { i: "horn", oct: 1, pat: [[0.5, 0.25, 0.45], [1.5, 0.25, 0.4]], ao: { att: 0.02, cut: 1800 }, pan: 0.3 }]],
      dr: [[0, "wood", 0.35], [1, "wood2", 0.3], [0.5, "jingle", 0.25], [1.5, "jingle", 0.25]] },
    cania: { name: "Plaines de Cania", gain: 0.86, bpm: 100, bpb: 4, rv: 0.4, dly: [0.75, 0.3, 0.22], amb: "wind", intro: 1, lead: ["whistle+12", "tpt"],
      ch: "Dm Dm C C Bb Bb A A",
      mel: "A4:.5 D5:.5 A5:3 | G5:.5 F5:.5 E5:.5 F5:.5 D5:2 | G4:.5 C5:.5 G5:3 | F5:.5 E5:.5 D5:.5 E5:.5 C5:2 | F4:.5 Bb4:.5 F5:2 D5:1 | Bb4:1 D5:1 F5:1 G5:1 | A5:2 G5:1 F5:1 | E5:1 C#5:1 A4:2",
      parts: [["line", { i: "gtr", pat: [0, 1, 2, 3].flatMap((x) => [[x, x % 2, 0.4, 0.5], [x + 0.5, 2, 0.2, 0.3], [x + 0.75, 3, 0.2, 0.3]]), ao: { cut: 4200, hp: 220, damp: 0.99 }, pan: -0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 1.6, 0.55], [2, 2, 1.6, 0.45]] }],
        ["chord", { i: "choir", oct: 1, pat: [[0, 4, 0.35]], ao: { vow: "o", att: 1 }, from: 2 }]],
      dr: [[0, "low", 0.35], [2, "low", 0.3], [1, "rim", 0.18], [3, "rim", 0.18]] },
    wabbits: { name: "Terriers des Wabbits", gain: 0.81, bpm: 150, bpb: 4, rv: 0.12, lead: ["fiddle", "banjo"],
      ch: "G C G D G C D G",
      mel: "G5:.5 A5:.5 B5:.5 D6:.5 B5:.5 A5:.5 G5:.5 E5:.5 | G5:.5 E5:.5 C5:.5 E5:.5 G5:1 E5:1 | D5:.5 G5:.5 B5:.5 G5:.5 D6:1 B5:.5 G5:.5 | A5:.5 F#5:.5 D5:.5 F#5:.5 A5:1 r:1 | B5:.5 D6:.5 B5:.5 G5:.5 A5:.5 B5:.5 G5:.5 E5:.5 | E5:.5 G5:.5 C6:.5 B5:.5 A5:.5 G5:.5 E5:.5 C5:.5 | D5:.5 F#5:.5 A5:.5 D6:.5 C6:.5 A5:.5 F#5:.5 A5:.5 | G5:1 D5:1 G4:1 r:1",
      parts: [["arp", { i: "banjo", seq: [2, 1, 3, 2, 1, 3, 2, 4], step: 0.5, oct: 1, d: 0.5, v: 0.35, pan: 0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 0.8, 0.6], [2, 2, 0.8, 0.5]] }],
        ["chord", { i: "gtr", oct: 1, pat: [[1, 0.3, 0.35], [3, 0.3, 0.35]], st: 0.02, pan: -0.3 }]],
      dr: [[0, "low", 0.3], [1, "snare", 0.18], [2, "low", 0.3], [3, "snare", 0.18], ...steps([0.5, 1.5, 2.5, 3.5], "shaker", 0.3)] },
    landes: { name: "Landes de Sidimote", gain: 1.03, bpm: 76, bpb: 3, rv: 0.45, amb: "wind", intro: 1, lead: ["lowwh-12", "fiddle"], drFrom: 1,
      ch: "Em D Em A Em G D Em",
      mel: "E5:1 G5:1 A5:1 | B5:2 A5:.5 F#5:.5 | G5:1 E5:2 | C#5:1 E5:1 A5:1 | B5:1.5 D6:.5 B5:1 | A5:1 G5:1 D5:1 | F#5:1 A5:.5 G5:.5 F#5:1 | E5:3",
      parts: [["line", { i: "oboe", pat: [[0, "E3", 3, 0.35], [0, "B3", 3, 0.25]], ao: { att: 0.3, vib: 0.001, cut: 1400 } }],
        ["arp", { i: "pluck", seq: [0, 2, 4], step: 1, oct: 1, d: 2, v: 0.32, pan: -0.3 }]],
      dr: [[0, "bodhran", 0.45], [1.5, "bodhran", 0.2], [2, "bodhran", 0.3]] },
    koalaks: { name: "Sommets des Koalaks", gain: 0.72, bpm: 100, bpb: 4, rv: 0.25, lead: ["horn-12", "pan"],
      ch: "Am Am G Am Am C G Am",
      mel: "E5:1.5 G5:.5 A5:2 | C6:.5 A5:.5 G5:1 E5:2 | D5:1 G5:1 E5:.5 D5:.5 C5:1 | A4:3 r:1 | E5:1 A5:1 C6:1 D6:1 | E6:2 D6:.5 C6:.5 A5:1 | G5:1.5 E5:.5 D5:1 G5:1 | A5:3 r:1",
      parts: [["line", { i: "didge", pat: [[0, "A1", 4, 0.8]] }],
        ["arp", { i: "mar", seq: [0, 2, 3, 2, 4, 3, 2, 1], step: 0.5, oct: 1, v: 0.35, pan: 0.3, ao: { dec: 0.3 } }]],
      dr: [...steps([0, 2], "clave", 0.35), ...steps([1, 1.5, 3, 3.5], "clave", 0.22), [0, "log", 0.5], [2.5, "log2", 0.4]] },
    abrak: { name: "Bois des Abraknydes", gain: 1.08, bpm: 72, bpb: 4, rv: 0.4, dly: [1.5, 0.35, 0.25], amb: "owl", intro: 1, lead: ["cello-12", "bell+12"],
      ch: "Am F Dm E Am F G#dim E",
      mel: "A4:1.5 C5:.5 E5:2 | F5:1 E5:.5 D5:.5 C5:2 | D5:1 F5:1 A5:1.5 G5:.5 | G#4:3 r:1 | C5:1 B4:.5 A4:.5 E5:2 | F5:1.5 A5:.5 G5:1 F5:1 | D5:1 B4:1 G#4:1 B4:1 | E4:4",
      parts: [["arp", { i: "pluck", seq: [0, 2, 4, 2], step: 1, oct: 1, d: 2, v: 0.32, pan: -0.3, ao: { cut: 2400 } }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 3.8, 0.45]] }],
        ["chord", { i: "pad", oct: 1, pat: [[0, 4, 0.7]], ao: { cut: 600 } }]],
      dr: { len: 2, h: [[3, "wood", 0.22], [6.5, "wood2", 0.18], [7, "wood", 0.15]] } },
    moon: { name: "Tambours de Moon", gain: 0.81, bpm: 116, bpb: 4, rv: 0.22, amb: "jungle", lead: ["pan", "mar"],
      ch: "Dm Dm C Dm Dm F C Dm",
      mel: "A5:.5 C6:.5 D6:1 C6:.5 A5:.5 G5:1 | A5:2 r:1 F5:.5 G5:.5 | G5:.5 C6:.5 G5:.5 F5:.5 G5:1 C5:1 | D5:3 r:1 | D6:.5 C6:.5 A5:.5 C6:.5 D6:1 F6:1 | F6:.5 D6:.5 C6:1 A5:2 | G5:.5 A5:.5 C6:.5 A5:.5 G5:1 F5:.5 G5:.5 | D5:2 r:2",
      parts: [["arp", { i: "kal", seq: [0, 2, 3, 4, 3, 2, 1, 2], step: 0.5, oct: 1, v: 0.4, pan: -0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 0.5, 0.6], [1.5, 0, 0.5, 0.45], [2, 2, 0.5, 0.5], [3.5, 1, 0.5, 0.45]] }],
        ["chord", { i: "choir", oct: 1, vc: [0, 2], pat: [[0, 0.5, 0.6], [2.5, 0.4, 0.45]], ao: { vow: "o", att: 0.02, rel: 0.25 }, from: 1, alt: 1 }]],
      dr: [[0, "conga", 0.5], [0.75, "bongo", 0.35], [1, "conga2", 0.4], [1.5, "bongo", 0.35], [2, "conga", 0.5], [2.5, "bongo", 0.3], [2.75, "bongo", 0.3], [3, "conga2", 0.45], [3.5, "bongo", 0.35], [0, "log", 0.45], [2.5, "log2", 0.35]] },
    dragoeufs: { name: "Nid des Dragoeufs", gain: 0.71, bpm: 80, bpb: 4, rv: 0.45, amb: "fire", lead: ["horn-12", "horn"], lead2: "choir1", l2v: 0.4,
      ch: "Cm Ab Bb Cm Cm Ab Bb G",
      mel: "C5:1.5 G4:.5 C5:1 Eb5:1 | Eb5:1.5 C5:.5 Ab4:2 | Bb4:1 D5:1 F5:1.5 Eb5:.5 | G5:4 | G5:1.5 Eb5:.5 C5:1 G5:1 | Ab5:1.5 G5:.5 F5:1 Eb5:1 | D5:1 F5:1 Bb5:1 Ab5:1 | G5:2 B4:1 D5:1",
      parts: [["chord", { i: "choir", oct: 1, pat: [[0, 4, 0.55]], ao: { vow: "a", att: 0.6 } }],
        ["line", { i: "timp", oct: -1, pat: [[0, 0, 1, 0.8], [2.5, 2, 0.5, 0.4], [3, 0, 0.5, 0.6]] }],
        ["line", { i: "cello", pat: [[0, 0, 0.9, 0.5], [1, 0, 0.9, 0.4], [2, 0, 0.9, 0.45], [3, 2, 0.9, 0.4]] }]],
      dr: [[0, "taiko", 0.5], [2, "taiko", 0.35]], hits: [[4, 0, "crash", 0.4]] },
    iles: { name: "Rivages d'Otomaï", gain: 0.93, bpm: 100, bpb: 4, rv: 0.25, amb: "waves", lead: ["steel"], lead2: "steel-12", l2v: 0.35,
      ch: "F Bb C F Dm Bb C F",
      mel: "C5:.5 F5:.5 A5:.75 G5:.25 F5:1 A5:1 | Bb5:.5 A5:.5 G5:.5 F5:1 D5:1.5 | E5:.5 G5:.5 C6:.75 Bb5:.25 A5:1 G5:1 | F5:2.5 r:.5 C5:.5 D5:.5 | F5:.5 A5:.5 D6:.75 C6:.25 A5:1 F5:1 | G5:.5 Bb5:.5 D6:1 C6:.5 Bb5:.5 A5:1 | G5:.5 A5:.5 Bb5:.5 C6:.5 E6:1 D6:.5 C6:.5 | F6:2 r:2",
      parts: [["chord", { i: "organ", oct: 1, pat: steps([0.5, 1.5, 2.5, 3.5], 0.25, 0.45), ao: { cut: 2400 }, pan: 0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 0.7, 0.6], [0.75, 0, 0.2, 0.4], [1.5, 2, 0.45, 0.5], [2.5, 3, 0.45, 0.5], [3, 2, 0.45, 0.45], [3.5, 1, 0.45, 0.45]] }]],
      dr: [[0, "low", 0.4], [2.5, "low", 0.3], [1, "rim", 0.3], [3, "rim", 0.3], ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((k) => [k / 4, "shaker", k % 2 ? 0.18 : 0.3])] },
    pandala: { name: "Jardins de Pandala", gain: 1.26, bpm: 72, bpb: 4, rv: 0.4, amb: "stream", intro: 1, lead: ["erhu", "flute"],
      ch: "G Em C D Em C D G",
      mel: "D5:1~ E5:.5 G5:.5 A5:2 | B5:1.5 A5:.5 G5:1 E5:1 | G5:1~ E5:.5 D5:.5 E5:2 | A4:1 B4:1 D5:1.5~ E5:.5 | E5:.5 G5:.5 A5:1 B5:1~ D6:1 | E6:2 D6:.5 B5:.5 A5:1 | A5:1 B5:.5 A5:.5 D5:1 E5:1 | G5:4~",
      parts: [["arp", { i: "koto", seq: [0, 1, 2, 3, 4, 5], step: 0.25, oct: 1, cnt: 6, d: 2.5, v: 0.3, pan: -0.3 }],
        ["line", { i: "koto", oct: 1, pat: [[2, 0, 1.5, 0.4], [3, 1, 1, 0.35]], pan: -0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 3.5, 0.4]] }]],
      dr: [[0, "wood", 0.18], [2, "wood2", 0.14]], hits: [[4, 0, "gong", 0.5]] },
    frigost: { name: "Neiges de Frigost", gain: 1.18, bpm: 66, bpb: 3, rv: 0.55, dly: [1, 0.4, 0.28], amb: "wind", intro: 1, lead: ["glass", "flute"],
      ch: "Em Cmaj7 Am B Em Cmaj7 Am B",
      mel: "B5:2 G5:1 | E6:2 D6:.5 B5:.5 | C6:1 A5:1 E5:1 | F#5:3 | G5:1 B5:1 E6:1 | G6:2 F#6:.5 E6:.5 | E6:1 C6:1 A5:1 | B5:2 D#6:1",
      parts: [["chord", { i: "glass", oct: 1, pat: [[0, 3, 0.5]] }],
        ["arp", { i: "glock", seq: [3, 4, 5, 4, 3, 2], step: 0.5, oct: 1, v: 0.22, from: 1, pan: 0.35 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 2.8, 0.35]] }]] },
    saharach: { name: "Dunes de Saharach", gain: 0.89, bpm: 96, bpb: 4, rv: 0.35, amb: "wind", lead: ["ney", "oud"],
      ch: "E F E Dm Am F E E",
      mel: "B4:.5 C5:.5 B4:.5 G#4:.5 A4:1/4 B4:1/4 A4:.5 G#4:1 | F4:.5 G#4:.5 A4:1~ C5:1 B4:1 | E5:1.5~ D5:1/4 C5:1/4 B4:1 C5:.5 B4:.5 | A4:.5 B4:.5 C5:.5 D5:.5 F5:1 E5:1 | E5:.5 F5:.5 G#5:.5 A5:.5 B5:1~ A5:1 | C6:.5 B5:1/4 A5:1/4 G#5:.5 A5:.5 F5:2 | E5:.5 F5:.5 G#5:1 F5:.5 E5:.5 D5:1 | E5:4~",
      parts: [["line", { i: "oud", pat: [[0, "E3", 0.5, 0.55], [0.5, "E3", 0.25, 0.35], [0.75, "F3", 0.25, 0.35], [1, "E3", 0.5, 0.45], [2, "E3", 0.5, 0.5], [2.5, "B2", 0.5, 0.4], [3, "E3", 0.5, 0.45], [3.5, "G#3", 0.5, 0.4]], pan: -0.3 }],
        ["line", { i: "bass", pat: [[0, "E2", 3.8, 0.4]] }]],
      dr: [[0, "dum", 0.7], [0.5, "tek", 0.4], [1.5, "tek", 0.4], [2, "dum", 0.6], [3, "tek", 0.45], [3.5, "ka", 0.3]] },
    divines: { name: "Dimensions divines", gain: 1.16, bpm: 60, bpb: 4, rv: 0.7, dly: [2, 0.3, 0.2], intro: 1, lead: ["choir1", "tpt"],
      ch: "D E D E Bm Gmaj7 A D",
      mel: "F#5:2 A5:2 | G#5:3 B5:1 | A5:2 F#5:1 D5:1 | E5:4 | D5:1 F#5:1 B5:2 | A5:2 F#5:1 G5:1 | E5:1 A5:1 C#6:2 | D6:4",
      parts: [["chord", { i: "organ", pat: [[0, 4, 0.5]], ao: { att: 0.4, rel: 0.6, cut: 2400 } }],
        ["line", { i: "organ", oct: -1, pat: [[0, 0, 4, 0.35]] }],
        ["chord", { i: "choir", oct: 1, vc: [1, 2, 3], pat: [[0, 4, 0.45]], ao: { vow: "a", att: 1.2 }, from: 1 }],
        ["arp", { i: "pluck", seq: [0, 1, 2, 3, 4, 5, 6, 7], step: 0.125, oct: 1, cnt: 8, d: 3, v: 0.22, every: 2, pan: -0.35 }],
        ["line", { i: "bell", oct: 1, pat: [[0, 3, 4, 0.25]], every: 4 }]] },
    bonta: { name: "Remparts de Bonta", gain: 0.88, bpm: 112, bpb: 4, rv: 0.3, lead: ["tpt", "horn"], lead2: "tpt", l2: "all", l2v: 0.4,
      ch: "Bb Eb F Bb Gm Eb F Bb",
      mel: "F4:.75 F4:.25 Bb4:1 D5:1 F5:1 | G5:1.5 F5:.5 Eb5:1 G5:1 | F5:.75 Eb5:.25 D5:.75 C5:.25 A4:1 F4:1 | Bb4:2 r:1 F4:.75 F4:.25 | G4:.75 Bb4:.25 D5:1 G5:1.5 F5:.5 | Eb5:.75 F5:.25 G5:1 Bb5:1 G5:1 | F5:.75 G5:.25 F5:.75 Eb5:.25 D5:1 C5:1 | Bb4:3 r:1",
      mel2: "D4:.75 D4:.25 F4:1 Bb4:1 D5:1 | Eb5:1.5 D5:.5 Bb4:1 Eb5:1 | C5:.75 C5:.25 Bb4:.75 A4:.25 F4:1 C4:1 | D4:2 r:1 D4:.75 D4:.25 | D4:.75 G4:.25 Bb4:1 D5:1.5 D5:.5 | G4:.75 Bb4:.25 Eb5:1 G5:1 Eb5:1 | C5:.75 Eb5:.25 C5:.75 C5:.25 Bb4:1 A4:1 | F4:3 r:1",
      parts: [["line", { i: "tuba", oct: -1, pat: [[0, 0, 0.9, 0.6], [2, 2, 0.9, 0.5]] }],
        ["chord", { i: "horn", oct: 1, pat: [[0, 3.8, 0.3]], ao: { cut: 1100, att: 0.2 }, pan: 0.3 }],
        ["line", { i: "timp", oct: -1, pat: [[0, 0, 1, 0.5], [2, 2, 1, 0.35]] }]],
      dr: [[0, "snare", 0.5], [0.75, "snare", 0.22], [1, "snare", 0.32], [2, "snare", 0.45], [2.5, "snare", 0.22], [2.75, "snare", 0.22], [3, "snare", 0.4], [3.5, "snare", 0.28], [0, "low", 0.5], [2, "low", 0.4]],
      fill: [[0, "snare", 0.5], [0, "low", 0.5], ...[1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75].map((x, k) => [x, "snare", 0.18 + k * 0.03])], hits: [[8, 0, "crash", 0.35]] },
    brakmar: { name: "Ruelles de Brâkmar", gain: 0.79, bpm: 100, bpb: 4, sw: 0.3, rv: 0.2, lead: ["bsn", "reed+12"],
      ch: "Cm Cm Fm Fm Ab7 G7 Cm G7",
      mel: "C4:.5' Eb4:.5' r:.5 G4:.5' Gb4:.5' F4:.5' r:1 | Eb4:.5' F4:.5' Gb4:1 G4:1.5 r:.5 | F4:.5' Ab4:.5' r:.5 C5:.5' B4:.5' Bb4:.5' r:1 | Ab4:.5' Bb4:.5' B4:1 C5:1.5 r:.5 | Eb5:1 C5:.5' Ab4:.5' Gb4:1 Eb4:1 | D4:.5' F4:.5' Ab4:.5' B4:.5' D5:1 B4:1 | C5:.5' G4:.5' Eb4:.5' C4:.5' Db4:.5' D4:.5' Eb4:1 | G3:2 r:2",
      parts: [["line", { i: "pizz", oct: -1, pat: [[0, 0, 0.5, 0.7], [1, 1, 0.5, 0.6], [2, 2, 0.5, 0.65], [3, "c", 0.5, 0.6]] }],
        ["chord", { i: "mute", oct: 1, vc: [0, 1, 2, 3], pat: [[1.5, 0.3, 0.35], [3.5, 0.2, 0.3]], from: 1, pan: 0.3 }]],
      dr: [[1, "snap", 0.45], [3, "snap", 0.45], [0, "low", 0.3], ...EIGHTHS.map((x, k) => [x, "shaker", k % 2 ? 0.12 : 0.15])] },
    obscure: { name: "Dimension Obscure", gain: 1.1, bpm: 56, bpb: 4, rv: 0.65, dly: [1.5, 0.45, 0.25], amb: "drip", intro: 1, lead: ["hum-12", "fiddle"], lo: { fiddle: { sl: 1, slt: 0.3 } },
      ch: "Cm Db Cm Gb Cm Db Ab G",
      mel: "G5:3 r:1 | Ab5:2 G5:2 | r:2 Eb5:2 | Db5:4 | C6:3 r:1 | Db6:2 C6:2 | r:1 Eb5:1 C5:2 | B4:4",
      parts: [["chord", { i: "choir", pat: [[0, 4, 0.6]], ao: { vow: "u", att: 1.5 } }],
        ["line", { i: "cello", oct: -1, pat: [[0, 0, 4, 0.4]], ao: { sl: 1, slt: 0.5, att: 0.4 } }]],
      dr: [[0, "heart", 0.6]], hits: [[4, 2, "gong", 0.25]] },
    harebourg: { name: "Château d'Harebourg", gain: 0.9, bpm: 108, bpb: 3, rv: 0.4, lead: ["oboe-12", "harpsi"],
      ch: "Bm F# Bm Em A D Em F#",
      mel: "F#5:1 B5:.5 A5:.5 B5:.5 C#6:.5 | D6:.5 C#6:.5 A#5:1 F#5:1 | B5:.5 C#6:.5 D6:1 F#6:1 | E6:.5 D6:.5 C#6:.5 B5:.5 G5:1 | A5:.5 B5:.5 C#6:.5 A5:.5 E5:1 | F#5:1/4 G5:1/4 A5:.5 D6:1 C#6:.5 B5:.5 | G5:.5 F#5:.5 E5:.5 G5:.5 B5:1 | A#5:1.5 C#6:.5 F#5:1",
      parts: [["line", { i: "harpsi", oct: -1, pat: [[0, 0, 0.9, 0.55]] }],
        ["chord", { i: "harpsi", oct: 1, pat: [[1, 0.4, 0.35], [2, 0.4, 0.3]], st: 0.012, pan: -0.25 }]],
      dr: { len: 2, h: [[0, "tick", 0.35], [1, "tock", 0.3], [2, "tick", 0.3], [3, "tock", 0.3], [4, "tick", 0.3], [5, "tock", 0.3]] } },
    sufokia: { name: "Baie de Sufokia", gain: 0.68, bpm: 276, bpb: 6, rv: 0.2, amb: "waves", lead: ["tin", "acc"],
      ch: "Dm C Dm A Dm G C Dm",
      mel: "A4:2 D5:1 D5:2 E5:1 | F5:2 E5:1 C5:3 | A4:2 D5:1 F5:2 A5:1 | G5:2 F5:1 E5:3 | D6:2 C6:1 A5:2 F5:1 | G5:2 B5:1 D6:3 | C6:2 A5:1 G5:2 E5:1 | D5:3 r:3",
      parts: [["line", { i: "bass", oct: -1, pat: [[0, 0, 2.5, 0.6], [3, 2, 2.5, 0.5]] }],
        ["chord", { i: "acc", oct: 1, pat: [[2, 0.9, 0.35], [5, 0.9, 0.32]], pan: 0.3 }]],
      dr: [[0, "stomp", 0.6], [3, "stomp", 0.5], [3, "clap", 0.3], [2, "jingle", 0.2], [5, "jingle", 0.2]] },
    wukin: { name: "Pagodes de Wukin", gain: 1.33, bpm: 80, bpb: 4, rv: 0.45, intro: 1, lead: ["shaku", "koto+12"], drFrom: 1,
      ch: "Am F Am Esus Am F Dm Esus",
      mel: "E5:2~ F5:1 E5:1 | C5:3~ A4:1 | B4:1 C5:1 E5:2~ | B4:4~ | A5:2~ B5:.5 A5:.5 F5:1 | E5:1.5 F5:.5 A5:2 | F5:1 E5:.5 C5:.5 B4:2~ | E5:4",
      parts: [["arp", { i: "koto", seq: [0, 2, 3, null, 2, 4, 3, null], step: 0.5, oct: 1, d: 1.5, v: 0.32, pan: -0.3 }],
        ["line", { i: "koto", pat: [[0, 0, 3.5, 0.4]] }]],
      dr: [[0, "taiko", 0.6], [1.5, "taiko", 0.3], [2, "taiko", 0.45], [3, "rim", 0.25], [3.5, "taiko", 0.35]] },
    vulkania: { name: "Archipel de Vulkania", gain: 0.65, bpm: 330, bpb: 7, rv: 0.3, amb: "lava", lead: ["dist-12", "horn"],
      ch: "Em F Em F C D Em Em",
      mel: "E5:2 G5:2 B5:3 | A5:2 F5:2 C6:3 | B5:2 G5:1 E5:1 B5:3 | C6:2 A5:2 F5:3 | E5:2 G5:2 C6:3 | D6:2 A5:2 F#5:3 | E6:2 D6:1 B5:1 G5:3 | E5:7",
      parts: [["line", { i: "dist", oct: -1, pat: [[0, 0, 0.8, 0.5], [1, 0, 0.4, 0.3], [2, "s1", 0.8, 0.45], [3, 0, 0.4, 0.3], [4, 0, 0.8, 0.5], [5, "s3", 0.5, 0.35], [6, "s1", 0.8, 0.4]] }]],
      dr: [[0, "taiko", 0.7], [1, "tom", 0.3], [2, "taiko", 0.55], [3, "tom", 0.3], [4, "taiko", 0.6], [5, "tom", 0.35], [6, "snare", 0.45], [6.5, "tom", 0.3]] },
    /* --- pages et lieux --- */
    songe: { name: "Songe infini", gain: 1.53, bpm: 84, bpb: 5, rv: 0.6, dly: [1, 0.45, 0.3], intro: 1, lead: ["bell", "flute"],
      ch: "Fmaj7 G Em7 Am Fmaj7 G Dm7 Esus",
      mel: "A5:2 C6:1 E6:2 | D6:3 B5:2 | G5:2 B5:1 E6:2 | C6:5 | A5:1 C6:1 F6:3 | E6:2 D6:1 B5:2 | A5:2 F5:1 C6:2 | B5:5",
      parts: [["arp", { i: "pluck", seq: [0, 2, 4, 2, 5, 2, 4, 2, 3, 1], step: 0.5, oct: 1, d: 1.2, v: 0.3, pan: 0.35, ao: { cut: 3000 } }],
        ["chord", { i: "choir", oct: 1, vc: [0, 1, 2, 3], pat: [[0, 5, 0.4]], ao: { vow: "o", att: 2, rel: 2 } }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 4.8, 0.3]] }]] },
    koli: { name: "Arène du Kolizéum", gain: 0.68, bpm: 140, bpb: 4, rv: 0.3, amb: "crowd", lead: ["tpt", "horn"], lead2: "horn-12", l2v: 0.35,
      ch: "Am F C G Am F G E",
      mel: "E5:.5 E5:.5 E5:.5 A5:1.5 G5:.5 E5:.5 | F5:.5 F5:.5 F5:.5 C6:1.5 A5:1 | G5:.5 G5:.5 G5:.5 C6:1 B5:.5 A5:.5 G5:.5 | D6:2 B5:1 G5:1 | A5:.5 A5:.5 C6:.5 E6:1.5 D6:.5 C6:.5 | C6:.5 A5:.5 F5:.5 A5:1 C6:1.5 | B5:.5 B5:.5 B5:.5 D6:1 C6:.5 B5:1 | G#5:2 B5:1 E6:1",
      parts: [["line", { i: "bass", oct: -1, pat: EIGHTHS.map((x, k) => [x, k % 2 ? 3 : 0, 0.4, 0.55]) }],
        ["chord", { i: "tpt", oct: 1, pat: [[0, 0.3, 0.45], [2.5, 0.3, 0.35]], from: 1, pan: 0.3 }]],
      dr: [[0, "low", 0.8], [1, "clap", 0.5], [1, "snare", 0.35], [2, "low", 0.7], [2.5, "low", 0.4], [3, "clap", 0.5], [3, "snare", 0.35], ...steps(EIGHTHS, "hat", 0.25)] },
    boss: { name: "Boss des mondes", gain: 0.58, bpm: 76, bpb: 3, rv: 0.55, lead: ["horn-12", "choir1"],
      ch: "Dm Bb Gm A Dm Bb Gm A",
      mel: "D5:2 A4:1 | F5:2 D5:1 | G5:1.5 F5:.5 D5:1 | E5:2 C#5:1 | A5:2 F5:1 | Bb5:2 F5:1 | G5:1 Bb5:1 D6:1 | C#6:3",
      parts: [["chord", { i: "horn", vc: [0, 1, 2, 3], pat: [[0, 2.8, 0.4]], ao: { cut: 900, att: 0.25 } }],
        ["line", { i: "tuba", oct: -1, pat: [[0, 0, 2.8, 0.5]] }],
        ["chord", { i: "choir", oct: 1, pat: [[0, 3, 0.5]], ao: { vow: "a", att: 0.4 }, from: 1 }],
        ["line", { i: "timp", oct: -1, pat: [[0, 0, 1, 0.8], [2, 0, 0.5, 0.45], [2.5, 0, 0.5, 0.55]] }],
        ["arp", { i: "cello", seq: [0, 1, 2, 1, 0, 1], step: 0.5, d: 0.45, v: 0.32, pan: -0.25 }]],
      dr: [[0, "taiko", 0.55]], hits: [[4, 0, "gong", 0.4]] },
    guilde: { name: "Salle de guilde", gain: 0.7, bpm: 252, bpb: 6, rv: 0.18, amb: "fire", lead: ["hurdy-12", "rec"],
      ch: "G F G C Em F D G",
      mel: "G5:1 A5:1 B5:1 D6:2 B5:1 | C6:2 A5:1 F5:2 A5:1 | B5:1 A5:1 G5:1 D5:2 G5:1 | E5:2 G5:1 C6:3 | B5:1 C6:1 D6:1 E6:2 B5:1 | C6:2 A5:1 F5:1 G5:1 A5:1 | F#5:2 A5:1 D6:2 C6:1 | B5:3 G5:3",
      parts: [["line", { i: "hurdy", pat: [[0, "G3", 6, 0.3], [0, "D4", 6, 0.22]], ao: { att: 0.2 } }],
        ["chord", { i: "gtr", oct: 1, vc: [0, 1, 2, 3], pat: [[0, 2, 0.4], [3, 2, 0.35]], st: 0.03, pan: -0.3 }]],
      dr: [[0, "bodhran", 0.5], [2, "jingle", 0.3], [3, "bodhran", 0.35], [4, "tek", 0.2], [5, "jingle", 0.3]] },
    hdv: { name: "Hôtel de vente", gain: 0.79, bpm: 120, bpb: 4, rv: 0.22, lead: ["vibes", "flute"],
      ch: "Fmaj7 Gm7 C9 Fmaj7 Bbmaj7 Am7 Dm7 C7",
      mel: "A5:1.5 C6:.5 E6:1 D6:1 | Bb5:1.5 A5:.5 F5:2 | G5:.5 A5:.5 Bb5:.5 D6:1 C6:1.5 | A5:3 r:1 | D6:1.5 C6:.5 A5:1 F5:1 | G5:1.5 E5:.5 C6:2 | F5:.5 A5:.5 C6:.5 E6:1.5 D6:1 | Bb5:1 G5:1 E5:2",
      parts: [["chord", { i: "gtr", oct: 1, vc: [0, 1, 2, 3], pat: [[0, 0.45, 0.4], [1.5, 0.4, 0.35], [2.5, 0.4, 0.35], [3.5, 0.3, 0.3]], st: 0.012, pan: -0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 1.4, 0.6], [1.5, 2, 0.5, 0.45], [2, 2, 1.4, 0.5], [3.5, 0, 0.5, 0.45]] }]],
      dr: [...steps([0, 1.5, 3], "rim", 0.3), ...EIGHTHS.map((x, k) => [x, "shaker", k % 2 ? 0.2 : 0.3]), [0, "low", 0.25], [2, "low", 0.2]] },
    atelier: { name: "Atelier des artisans", gain: 1.03, bpm: 120, bpb: 4, rv: 0.2, lead: ["xylo", "mute"],
      ch: "C Bb F C C Bb F G",
      mel: "C5:.5 E5:.5 G5:1 G5:.5 A5:.5 G5:1 | F5:.5 D5:.5 Bb4:1 D5:1 F5:1 | A5:.5 G5:.5 F5:1 C5:.5 D5:.5 F5:1 | E5:2 G4:2 | C5:.5 E5:.5 G5:1 C6:.5 Bb5:.5 G5:1 | Bb5:1 A5:.5 G5:.5 F5:1 D5:1 | C5:.5 F5:.5 A5:1 G5:.5 F5:.5 D5:1 | B4:1 D5:1 G5:2",
      parts: [["line", { i: "pizz", pat: [[0, 0, 0.4, 0.5], [0.5, 2, 0.3, 0.35], [1, 1, 0.4, 0.45], [1.5, 2, 0.3, 0.35], [2, 3, 0.4, 0.45], [2.5, 2, 0.3, 0.35], [3, 1, 0.4, 0.45], [3.5, 2, 0.3, 0.35]], pan: -0.3 }],
        ["line", { i: "tuba", oct: -1, pat: [[0, 0, 0.5, 0.6], [2, 2, 0.5, 0.55]] }]],
      dr: [[0, "stomp", 0.45], [1, "anvil", 0.32], [2, "stomp", 0.38], [2.5, "anvil", 0.22], [3, "anvil", 0.32], [3.5, "tick", 0.2]] },
    salleboss: { name: "Salle du boss", gain: 0.6, bpm: 150, bpb: 4, rv: 0.35, lead: ["horn", "tpt"], lead2: "horn-12", l2v: 0.35,
      ch: "Fm Fm Db Eb Fm Fm Db C",
      mel: "C5:1.5 Db5:.5 C5:1 Ab4:1 | F4:1 Ab4:1 C5:1 F5:1 | F5:1.5 Eb5:.5 Db5:1 Ab4:1 | G4:1 Bb4:1 Eb5:1 G5:1 | Ab5:1.5 G5:.5 F5:1 C5:1 | Db5:.5 C5:.5 Bb4:.5 Ab4:.5 C5:2 | F5:1 Ab5:1 Db6:1.5 C6:.5 | B5:1 G5:1 E5:1 C5:1",
      parts: [["arp", { i: "stacc", seq: [0, 0, 2, 0, 0, 3, 0, 2], step: 0.25, d: 0.22, v: 0.3, pan: -0.3 }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 0.4, 0.6], [0.75, 0, 0.2, 0.45], [1.5, 0, 0.4, 0.55], [2, 0, 0.4, 0.6], [2.75, 0, 0.2, 0.45], [3.5, "s1", 0.4, 0.5]] }],
        ["chord", { i: "choir", oct: 1, pat: [[0, 0.5, 0.6], [2.5, 0.5, 0.45]], ao: { vow: "a", att: 0.02, rel: 0.3 }, from: 1 }]],
      dr: [[0, "taiko", 0.7], [0.75, "tom", 0.35], [1, "snare", 0.5], [1.5, "taiko", 0.45], [2, "taiko", 0.6], [2.5, "tom", 0.3], [3, "snare", 0.5], [3.5, "tom", 0.35], [3.75, "tom", 0.4]], hits: [[4, 0, "crash", 0.35]] },
    nuit: { name: "Nuit au Havre-Sac", gain: 1.36, bpm: 60, bpb: 3, rv: 0.45, amb: ["crickets", "owl"], intro: 1, lead: ["flute", "bell"], lv: 0.6,
      ch: "F Dm Bb F Gm C F F",
      mel: "A5:2 F5:1 | A5:1 F5:1 D5:1 | D5:2 F5:1 | C5:3 | Bb4:1 D5:1 G5:1 | G5:2 E5:1 | F5:1 A4:1 C5:1 | F5:3",
      parts: [["arp", { i: "bell", seq: [3, 4, 5, 4, 3, 4], step: 0.5, oct: 1, v: 0.18, ao: { len: 1 } }],
        ["chord", { i: "pad", oct: 1, pat: [[0, 3, 0.5]], ao: { cut: 700 } }],
        ["line", { i: "bass", oct: -1, pat: [[0, 0, 2.8, 0.35]] }]] },

    /* --- événements --- */
    halouine: { name: "Bal d'Halouine", gain: 0.97, bpm: 112, bpb: 3, rv: 0.5, amb: "wind", lead: ["theremin", "bell"],
      ch: "Em Em B B Em Am B Em",
      mel: "E5:1 G5:1 B5:1 | C6:1 B5:1 G5:1 | A5:1 F#5:1 D#5:1 | F#5:3 | E5:1 G5:1 B5:1 | C6:2 A5:1 | D#5:1 F#5:1 A5:1 | G5:1 E5:2",
      parts: [["line", { i: "organ", oct: -1, pat: [[0, 0, 0.9, 0.55]] }],
        ["chord", { i: "organ", oct: 1, pat: [[1, 0.6, 0.35], [2, 0.6, 0.35]], ao: { cut: 1800 } }],
        ["arp", { i: "pizz", seq: [0, null, null], step: 1, v: 0.4 }]],
      dr: [[0, "low", 0.3]] },
    fetes: { name: "Fêtes de fin d'année", gain: 0.79, bpm: 138, bpb: 4, sw: 0.3, rv: 0.35, lead: ["glock+12", "tpt"], lead2: "choir1", l2v: 0.3,
      ch: "G C G D G C D G",
      mel: "B4:1 D5:1 G5:1.5 F#5:.5 | E5:1 G5:1 E5:2 | D5:1 B4:1 G4:1 B4:1 | A4:3 r:1 | B4:1 D5:1 G5:1 B5:1 | C6:1.5 B5:.5 A5:1 G5:1 | F#5:1 E5:1 D5:1 F#5:1 | G5:4",
      parts: [["line", { i: "bass", oct: -1, pat: [[0, 0, 0.9, 0.6], [1, 1, 0.9, 0.5], [2, 2, 0.9, 0.55], [3, "c", 0.9, 0.5]] }],
        ["chord", { i: "horn", oct: 1, pat: [[0, 3.8, 0.25]], ao: { cut: 1000, att: 0.3 }, from: 1 }]],
      dr: [[0, "low", 0.4], [2, "low", 0.3], ...EIGHTHS.map((x) => [x, "jingle", x % 1 ? 0.22 : 0.35])] },
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
  // sortie d'un morceau : son direct, réverbération dosée (T.rv) et écho éventuel (T.dly = [temps, retour, niveau])
  function chain(T) {
    const out = ctx.createGain(), send = ctx.createGain(), nodes = [out, send]; out.connect(musicBus); send.gain.value = T.rv == null ? 0.28 : T.rv; out.connect(send); send.connect(musicRv);
    if (T.dly) { const [beats, fb, wet] = T.dly, dl = ctx.createDelay(2), fg = ctx.createGain(), wg = ctx.createGain(), lp = ctx.createBiquadFilter(); dl.delayTime.value = Math.min(1.9, beats * 60 / T.bpm); fg.gain.value = fb; wg.gain.value = wet; lp.type = "lowpass"; lp.frequency.value = 3000;
      out.connect(dl); dl.connect(lp); lp.connect(fg); fg.connect(dl); lp.connect(wg); wg.connect(musicBus); wg.connect(send); nodes.push(dl, fg, wg, lp); }
    return { out, nodes };
  }
  A.play = function (id, fade = 0.6) { // fade : durée du fondu entre l'air qui s'arrête et le nouveau (2 s quand on change de zone)
    if (!init()) return; A.stop(fade); const T = TRACKS[id]; if (!T) return;
    const { out, nodes } = chain(T); out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(T.gain || 1, ctx.currentTime + Math.max(1.5, fade));
    seq = { id, T, pass: 0, start: ctx.currentTime + 0.12, ev: T.build(0), idx: 0, out, nodes }; seq.timer = setInterval(tick, 60); tick();
  };
  A.stop = function (fade = 1) {
    if (!seq) return; const s = seq; seq = null; clearInterval(s.timer);
    try { s.out.gain.cancelScheduledValues(ctx.currentTime); s.out.gain.setValueAtTime(s.out.gain.value, ctx.currentTime); s.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade); } catch (e) {}
    setTimeout(() => s.nodes.forEach((x) => { try { x.disconnect(); } catch (e) {} }), fade * 1000 + 3000);
  };
  A.playing = () => (seq ? seq.id : null);
  A.tracks = Object.fromEntries(Object.entries(TRACKS).map(([k, T]) => [k, T.name]));
  A.setMusicVol = (v) => { if (init()) [musicBus, musicRv].forEach((b) => b.gain.setTargetAtTime(0.55 * v, ctx.currentTime, 0.05)); };
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
    if (what && what.ev) { const out = chain({ bpm: 60 }).out; what.ev.forEach((e) => voice(e, 0.05 + e.b, 1, out)); } // événements bruts (réglage des instruments)
    else if (TRACKS[what]) { const T = TRACKS[what], spb = 60 / T.bpm, out = chain(T).out; let p = 0, st = 0.05;
      while (st < secs) { T.build(p).forEach((e) => { const t = st + e.b * spb; if (t < secs) voice(e, t, spb, out); }); st += T.len * spb; p++; } }
    else { const [style, kind] = what.split(":"); SFX[style][kind](0.05, sfxBus); }
    const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let peak = 0, sum = 0, nan = 0; const per = [];
    for (let i = 0; i < d.length; i++) { const x = d[i]; if (x !== x) nan++; else { peak = Math.max(peak, Math.abs(x)); sum += x * x; } if (i % 44100 === 44099) { per.push(+Math.sqrt(sum / 44100).toFixed(3)); sum = 0; } }
    ctx = live; Object.keys(ks).forEach((k) => delete ks[k]); noiseBuf = null; if (live) graph();
    return { peak: +peak.toFixed(3), nan, rmsPerSec: per, wav: A._wav ? A._wav(buf) : null };
  };
  window.IdlusAudio = A;
})();
