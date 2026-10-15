/* 1.3 : mesure le volume de chaque son de js/sons.js (rendu hors ligne, pondération K, fenêtre de 0,4 s) et écrit la table LV.
   node tools/mesure_sons.js  → remplace la ligne « const LV = … » de js/sons.js */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), F = path.join(ROOT, "js/sons.js");
const TGT = (id) => { const [k, a, b] = id.split(":");
  if (k === "ui") return ["clic", "onglet", "inter", "decoche", "epingle", "recherche"].includes(a) ? -36 : ["butin", "kamas", "quete"].includes(a) ? -25 : -31;
  if (k === "cbt") return a === "cast" ? -37 : a === "impact" ? -31 : a === "crit" ? -26 : ["victoire", "defaite", "tombe"].includes(a) ? -25 : a === "esquive" ? -36 : -30;
  return ["etage", "rel_legendaire"].includes(a) ? -19 : a === "rel_commune" ? -28 : a === "rel_rare" ? -25.5 : ["niveau", "donjon", "dofus"].includes(a) ? -21 : -22.5; };
(async () => {
  const src = fs.readFileSync(F, "utf8").replace(/const LV = \{[^\n]*\};/, "const LV = {};");
  const br = await chromium.launch(); const p = await br.newPage(); await p.setContent("<html><body></body></html>");
  await p.addScriptTag({ content: fs.readFileSync(path.join(ROOT, "js/musique.js"), "utf8") }); await p.addScriptTag({ content: src });
  const db = await p.evaluate(async () => { const S = window.SONS, H = window.IdlusAudio._h, ids = [];
    Object.keys(S.UI).forEach((k) => S.THEMES.forEach((t) => ids.push(`ui:${t}:${k}`)));
    ["cast", "impact", "crit"].forEach((k) => ["f", "e", "t", "a", "n"].forEach((el) => ids.push(`cbt:${k}:${el}`)));
    Object.keys(S.CBT).filter((k) => !["cast", "impact", "crit"].includes(k)).forEach((k) => ids.push(`cbt:${k}`));
    Object.keys(S.EVT).forEach((k) => ids.push(`evt:${k}`));
    const out = {};
    for (const id of ids) { const oc = new OfflineAudioContext(2, 44100 * 3, 44100); H.setCtx(oc); try { oc.resume = () => Promise.resolve(); } catch (e) {} S.play(id, 0.05); const buf = await oc.startRendering();
      const k = new OfflineAudioContext(1, buf.length, 44100), s = k.createBufferSource(); s.buffer = buf; const hs = k.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 1500; hs.gain.value = 4; const hp = k.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 38;
      s.connect(hs); hs.connect(hp); hp.connect(k.destination); s.start(); const d = (await k.startRendering()).getChannelData(0);
      const W = Math.floor(0.4 * 44100); let best = 0, acc = 0; for (let i = 0; i < d.length; i++) { acc += d[i] * d[i]; if (i >= W) acc -= d[i - W] * d[i - W]; if (i >= W - 1) best = Math.max(best, acc / W); }
      out[id] = 10 * Math.log10(best + 1e-12); }
    return out; });
  await br.close();
  const LV = {}; for (const id in db) { const [k, a, b] = id.split(":"); const key = k === "ui" ? `ui:${b}:${a}` : id; LV[key] = +Math.min(5, Math.max(0.15, Math.pow(10, (TGT(k === "ui" ? `ui:${b}` : id) - db[id]) / 20))).toFixed(2); }
  const s = fs.readFileSync(F, "utf8"); if (!/const LV = \{[^\n]*\};/.test(s)) throw new Error("ligne LV introuvable");
  fs.writeFileSync(F, s.replace(/const LV = \{[^\n]*\};/, "const LV = " + JSON.stringify(LV) + ";"));
  const ext = Object.entries(LV).filter(([, v]) => v >= 4.9 || v <= 0.16); console.log(Object.keys(LV).length, "sons mesurés", ext.length ? "aux limites : " + ext.map((x) => x.join("=")).join(" ") : "");
})();
