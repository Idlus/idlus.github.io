/* ============================================================================
   ANIM3 — scène de combat animée de la 3.0 (visuels DOFUS 3 extraits par Diablofus).
   Choix de Mathis (12/11/2026, maquette « Combat 3.0 animé ») : 1B 2A 3A 4C
   - PC : bande de 180 px au-dessus des barres, vue dézoomée (décor élargi en miroir, combattants sur 2 rangs) ;
   - barres de vie sur la scène ET dans les listes ; téléphone : scène de 210 px puis les listes ;
   - effets de sorts réglables (V3.fxMode() : "all" | "big" | "none").
   Le module ne modifie jamais la partie : il lit S.fight et rejoue ses événements F.fx (cast, hit, heal, buff, phase).
   Tout ce qui n'a pas encore d'animation garde son image actuelle (assets/look, assets/m).
   Données : window.A3D (js/anim3data.js, généré par tools/anim3/donnees.py) ; images : A3D.base + "<h|m|fx>/<nom>-<anim>.webp".
   ========================================================================== */
(function () {
  "use strict";
  const D = () => window.A3D || { h: {}, m: {}, fx: {}, s: {}, mk: {} };
  const base = () => (window.A3_BASE || D().base || "").replace(/\/?$/, "/");
  const url = (kind, nom, a) => `${base()}${kind}/${nom}-${a}.webp${D().v ? "?v=" + D().v : ""}`;
  const now = () => performance.now();
  const BIG_CD = 2; // un sort à 2 tours de relance ou plus est un « gros sort »
  const MAX_FX = 14; // effets simultanés au plus

  const css = `
.a3s{position:absolute;inset:0;overflow:hidden;border-radius:inherit;contain:strict}
.a3bg{position:absolute;left:50%;top:50%;height:175%;display:flex;transform:translate(-50%,-38%);pointer-events:none}
.a3bg i{display:block;height:100%;aspect-ratio:1100/522;background:center/cover no-repeat}
.a3bg i.mr{transform:scaleX(-1)}
.a3bg.solo{inset:0;height:auto;transform:none;left:0;top:0;width:100%;display:block}.a3bg.solo i{width:100%;height:100%;aspect-ratio:auto}
.a3s .a3e{position:absolute;width:0;height:0}
.a3s .a3f{position:absolute;left:0;top:0;width:0;height:0}
.a3s .a3e.m .a3f{transform:scaleX(-1)}
.a3s .a3sp{position:absolute;background-repeat:no-repeat;pointer-events:none}
.a3s .a3sp.br,.a3s img.a3st{animation:a3br 2.6s ease-in-out infinite}.a3s .a3e:nth-child(odd) .br,.a3s .a3e:nth-child(odd) img.a3st{animation-delay:-1.3s}
@keyframes a3br{50%{transform:scale(1.015,.975)}}
.a3s img.a3st{transform-origin:50% 96%;position:absolute;pointer-events:none;object-fit:contain}
.a3s .a3hb{position:absolute;height:4px;width:34px;left:-17px;border-radius:3px;background:rgba(0,0,0,.6);overflow:hidden}
.a3s .a3hb i{display:block;height:100%;background:#5fd35a;transition:width .25s}
.a3s .a3e.m .a3hb i{background:#e2483d}
.a3s .a3e.ko .a3hb{visibility:hidden}
.a3s .a3e.ko.st{filter:grayscale(1) brightness(.6);opacity:.5;transition:opacity .4s}
.a3s .a3e.tel .a3f{filter:drop-shadow(0 0 8px #ff4a3a)}
.a3s .a3x{position:absolute;pointer-events:none;background-repeat:no-repeat}
.a3s .a3n{position:absolute;font-weight:900;font-size:11px;color:#13200a;background:#f1cf6e;border-radius:6px;padding:0 6px;white-space:nowrap;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.5);transform:translateX(-50%)}
.a3s .a3d{position:absolute;font-weight:900;color:#ffd0c8;text-shadow:0 2px 0 #4a0d08,0 0 6px #000;pointer-events:none;white-space:nowrap;transform:translateX(-50%)}
.a3s .a3d.h{color:#d8f5a2;text-shadow:0 2px 0 #1e3a0c,0 0 6px #000}
@media (prefers-reduced-motion:reduce){.a3s .a3hb i{transition:none}.a3s .br,.a3s img.a3st{animation:none}}
`;
  let styled = false;
  const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.id = "a3css"; s.textContent = css; document.head.appendChild(s); };

  /* ---------- état de la scène ---------- */
  let host = null, root = null, bgEl = null, bgUrl = "", fid = null, lastSeq = -1, ents = [], raf = 0, W = 0, H = 0, z = 1, nFx = 0;

  const heroKey = (e) => { const k = `${e.cls}_${e.sex === "f" ? "f" : "m"}`; return D().h[k] ? k : null; };
  const monKey = (e) => { const k = D().mk[e.base]; return k && D().m[k] ? k : null; };
  const lookUrl = (e) => `assets/look/${e.cls}_${e.sex === "f" ? "f" : "m"}_${e.head || 0}.webp`;

  /* une planche n'est utilisée qu'une fois son image d'attente chargée : sinon (pas encore en ligne, réseau coupé) l'image actuelle reste */
  const okImg = {};
  function probe(kind, key) {
    const id = kind + "/" + key; if (id in okImg) return okImg[id] === true;
    okImg[id] = null; const im = new Image();
    im.onload = () => { okImg[id] = true; if (cur) { const o = ents.find((x) => x.kind === kind && x.wanted === key && !x.key); if (o) swap(o); } };
    im.onerror = () => { okImg[id] = false; };
    im.src = url(kind, key, "idle"); return false;
  }
  function swap(o) { const n = mkEnt(o.e, o.i); o.el.replaceWith(n.el); ents[ents.indexOf(o)] = n; place(); }
  function mkEnt(e, i) {
    const hero = e.side === "c";
    const wanted = hero ? heroKey(e) : monKey(e), key = wanted && probe(hero ? "h" : "m", wanted) ? wanted : null;
    const meta = key ? (hero ? D().h : D().m)[key] : null;
    const el = document.createElement("div");
    el.className = "a3e " + (hero ? "c" : "m") + (key ? "" : " st");
    el.innerHTML = `<div class="a3f">${meta ? `<div class="a3sp"></div>` : `<img class="a3st" alt="" src="${hero ? lookUrl(e) : `assets/m/${e.img}.png`}">`}</div><div class="a3hb"><i></i></div>`;
    root.appendChild(el);
    const o = { i, e, hero, key, wanted, meta, kind: hero ? "h" : "m", el, f: el.firstChild, sp: el.querySelector(".a3sp"), img: el.querySelector("img"), bar: el.querySelector(".a3hb i"),
      idle: "idle", anim: "idle", t0: now() - Math.random() * 900, dead: !e.alive, bh: 60, frame: -1 };
    o.die = hero ? "mort" : "die";
    if (o.dead) o.anim = meta && meta[o.die] ? o.die : "idle", o.t0 = -1e9;
    return o;
  }

  /* ---------- placement : 2 rangs, héros à gauche, monstres à droite ---------- */
  function place() {
    W = root.clientWidth; H = root.clientHeight; if (!W || !H) return;
    const narrow = W < H * 2.3; z = narrow ? Math.min(1, H / 300) : H / 250;
    const side = (L, left) => { const n = L.length, rows = n > 4 || (narrow && n > 2) ? 3 : n > 1 ? 2 : 1, ys = { 1: [0.94], 2: [0.95, 0.74], 3: [0.97, 0.62, 0.8] }[rows];
      const cols = Math.ceil(n / rows), span = narrow ? 0.4 : 0.42, step = span / Math.max(cols, 1.6);
      L.forEach((o, k) => { const r = k % rows, c = Math.floor(k / rows), boss = !o.hero && o.e.boss;
        const fx = 0.06 + (c + 0.5) * step + (r === 1 ? step * 0.4 : r === 2 ? -step * 0.15 : 0);
        o.x = left ? fx : 1 - fx; o.y = boss ? ys[0] : ys[r]; }); };
    const hs = ents.filter((o) => o.hero), ms = ents.filter((o) => !o.hero);
    const bi = ms.findIndex((o) => o.e.boss); if (bi > 0) ms.unshift(ms.splice(bi, 1)[0]); // le boss devant
    side(hs, true); side(ms, false);
    ents.slice().sort((a, b) => a.y - b.y).forEach((o, k) => { o.z = 10 + k * 3; o.el.style.zIndex = o.z; o.el.style.left = o.x * W + "px"; o.el.style.top = o.y * H + "px"; size(o); });
  }
  const sk = (o) => z * (!o.hero && o.e.boss ? 1.3 : 1);
  function size(o) {
    const k = sk(o);
    if (o.meta) { const A = o.meta.idle; o.bh = Math.min(A[3] * k, H * 0.85); }
    else { const s = (o.hero ? 118 : o.e.boss ? 120 : 84) * k; o.img.style.width = s + "px"; o.img.style.height = s + "px"; o.img.style.left = -s / 2 + "px"; o.img.style.top = -s * 0.96 + "px"; o.bh = s * 0.85; }
    o.el.querySelector(".a3hb").style.top = -o.bh - 8 + "px";
    o.frame = -1;
  }
  /* ---------- dessin d'une image d'animation ---------- */
  function draw(o, t) {
    if (!o.meta) return;
    let A = o.meta[o.anim]; if (!A) { o.anim = o.idle; A = o.meta.idle; }
    const [n, cols, w, h, ox, oy, ips] = A;
    let i = Math.floor(((t - o.t0) / 1000) * ips);
    if (i >= n) { if (o.anim === o.die) i = n - 1; else if (o.anim !== o.idle) { o.anim = o.idle; o.t0 = t; return draw(o, t); } else i %= n; }
    if (i === o.frame && o.drawn === o.anim) return;
    o.frame = i;
    const k = sk(o), s = o.sp.style;
    if (o.drawn !== o.anim) { o.drawn = o.anim; s.backgroundImage = `url(${url(o.kind, o.key, o.anim)})`;
      s.width = w * k + "px"; s.height = h * k + "px"; s.left = -ox * k + "px"; s.top = -oy * k + "px"; s.backgroundSize = `${cols * w * k}px ${Math.ceil(n / cols) * h * k}px`;
      s.transformOrigin = `${ox * k}px ${oy * k}px`; o.sp.classList.toggle("br", n === 1); }
    s.backgroundPosition = `${-(i % cols) * w * k}px ${-Math.floor(i / cols) * h * k}px`;
  }
  const dur = (o, a) => { const A = o.meta && o.meta[a]; return A ? (A[0] / A[6]) * 1000 : 0; };
  function play(o, a) { if (!o.meta || !o.meta[a] || (o.dead && a !== o.die)) return false; o.anim = a; o.t0 = now(); o.drawn = null; return true; }

  function loop(t) {
    raf = 0;
    if (!root || !root.isConnected) return;
    for (const o of ents) draw(o, t);
    if (!document.hidden) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && root && !document.hidden) raf = requestAnimationFrame(loop); };
  document.addEventListener("visibilitychange", kick);

  /* ---------- effets, nombres, bulles ---------- */
  const at = (o, up) => ({ x: o.x * W, y: o.y * H - (up || 0) * o.bh });
  function fxAt(g, o, back) {
    const M = D().fx[g]; if (!M || nFx >= MAX_FX) return; const [n, cols, w, h, ox, oy, ips] = M, k = z;
    const d = document.createElement("div"); d.className = "a3x"; nFx++;
    const p = at(o); Object.assign(d.style, { width: w * k + "px", height: h * k + "px", left: p.x - ox * k + "px", top: p.y - oy * k + "px", zIndex: o.z + (back ? -1 : 2),
      backgroundImage: `url(${url("fx", g, "fx")})`, backgroundSize: `${cols * w * k}px ${Math.ceil(n / cols) * h * k}px` });
    root.appendChild(d); const t0 = now();
    const go = () => { const i = Math.floor(((now() - t0) / 1000) * ips); if (i >= n || !d.isConnected) { d.remove(); nFx--; return; }
      d.style.backgroundPosition = `${-(i % cols) * w * k}px ${-Math.floor(i / cols) * h * k}px`; requestAnimationFrame(go); };
    go();
  }
  function proj(g, a, b) {
    const M = D().fx[g]; if (!M || nFx >= MAX_FX) return; const [n, cols, w, h, ox, oy] = M, k = z;
    const d = document.createElement("div"); d.className = "a3x"; nFx++;
    Object.assign(d.style, { width: w * k + "px", height: h * k + "px", zIndex: 290, backgroundImage: `url(${url("fx", g, "fx")})`, backgroundSize: `${cols * w * k}px ${Math.ceil(n / cols) * h * k}px` });
    root.appendChild(d);
    const p0 = at(a, 0.6), p1 = at(b, 0.5), an = Math.atan2(p1.y - p0.y, (p1.x - p0.x)), t0 = now();
    const go = () => { const q = Math.min(1, (now() - t0) / 260); if (!d.isConnected) { nFx--; return; }
      d.style.left = p0.x + (p1.x - p0.x) * q - ox * k + "px"; d.style.top = p0.y + (p1.y - p0.y) * q - Math.sin(q * Math.PI) * 16 * z - oy * k + "px"; d.style.transform = `rotate(${an}rad)`;
      if (q < 1) requestAnimationFrame(go); else { d.remove(); nFx--; } };
    go();
  }
  function bubble(cls, o, txt, ms, up) {
    const d = document.createElement("div"); d.className = cls; d.textContent = txt; d.style.zIndex = 320;
    const p = at(o, 1), j = cls.startsWith("a3d") ? (Math.random() - 0.5) * 26 : 0; d.style.left = p.x + j + "px"; d.style.top = p.y - (up || 18) + "px"; if (cls.startsWith("a3d")) d.style.fontSize = Math.max(12, 17 * z) + "px";
    root.appendChild(d);
    d.animate(cls.startsWith("a3d") ? [{ transform: "translate(-50%,0)", opacity: 1 }, { transform: "translate(-50%,-22px)", opacity: 1, offset: 0.6 }, { transform: "translate(-50%,-28px)", opacity: 0 }]
      : [{ opacity: 0, transform: "translate(-50%,5px)" }, { opacity: 1, transform: "translate(-50%,0)", offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms });
    setTimeout(() => d.remove(), ms);
  }
  const short = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + " M" : v >= 1e4 ? Math.round(v / 1e3) + " k" : String(Math.round(v)));
  function bump(o, dx) { (o.img || o.sp).animate([{ translate: "0 0" }, { translate: `${dx}px -5px` }, { translate: "0 0" }], { duration: 360 }); }
  function shake(o) { (o.img || o.sp).animate([{ translate: "0 0", filter: "brightness(1)" }, { translate: "-3px 0", filter: "brightness(1.9)" }, { translate: "3px 0" }, { translate: "0 0", filter: "brightness(1)" }], { duration: 280 }); }

  /* ---------- rejouer les événements du moteur ---------- */
  const mode = () => { try { return (window.V3 && V3.fxMode && V3.fxMode()) || "all"; } catch (e) { return "all"; } };
  function spellOf(o, id) {
    const S3 = D().s[id] || null; let big = !!(S3 && (S3.tb || S3.cb)), name = "";
    try { const def = E.spellDef(o.e.cls, id); if (def) { name = def.name || ""; const g = E.spellGrade(def, o.e.lvl || 200); if (g && g.cd >= BIG_CD) big = true; } } catch (e) { /* données absentes */ }
    return { S3, big, name };
  }
  function onHit(o, ev) {
    if (!o) return;
    if (ev.k === "heal") { bubble("a3d h", o, "+" + short(ev.v), 900); return; }
    if (ev.k === "buff") { if (ev.txt) bubble("a3n", o, ev.txt, 1100, 30); return; }
    if (!o.dead && !play(o, "hit")) shake(o);
    if (ev.v > 0) bubble("a3d", o, "-" + short(ev.v), 900);
  }
  function runSeq(evs) {
    const F = cur; if (!F) return;
    const E3 = (i) => ents.find((o) => o.i === i);
    const cast = evs.find((v) => v.k === "cast");
    const others = evs.filter((v) => v !== cast && (v.k === "hit" || v.k === "heal" || v.k === "buff"));
    const c = cast ? E3(cast.s) : null;
    if (!c) { others.forEach((v) => onHit(E3(v.t), v)); return; }
    const tgt = E3((others.find((v) => v.k === "hit") || others[0] || {}).t);
    const md = mode();
    let impact = 220;
    if (c.hero) {
      const sp = cast.sp ? spellOf(c, cast.sp) : { S3: null, big: false, name: "" };
      const a = sp.S3 && sp.S3.a ? sp.S3.a.replace(/^AnimAttaque/, "a") : "arme";
      if (play(c, c.meta && c.meta[a] ? a : "arme")) impact = Math.min(650, dur(c, c.anim) * 0.55); else bump(c, 12);
      if (sp.name && (sp.big || md !== "none")) bubble("a3n", c, sp.name, 1100, 30);
      const on = sp.S3 && (md === "all" || (md === "big" && sp.big));
      if (on) {
        (sp.S3.cb || []).forEach((g) => fxAt(g, c, true)); (sp.S3.c || []).forEach((g) => fxAt(g, c, false));
        if (sp.S3.p && tgt) setTimeout(() => proj(sp.S3.p, c, tgt), Math.max(0, impact - 260));
      }
      setTimeout(() => {
        if (on) others.filter((v) => v.k === "hit").map((v) => E3(v.t)).filter((o, k, L) => o && L.indexOf(o) === k).slice(0, 4)
          .forEach((o) => { (sp.S3.tb || []).forEach((g) => fxAt(g, o, true)); (sp.S3.t || []).forEach((g) => fxAt(g, o, false)); });
        others.forEach((v) => onHit(E3(v.t), v));
      }, impact);
    } else {
      if (play(c, "atk")) impact = Math.min(600, dur(c, "atk") * 0.5); else bump(c, 12);
      if (cast.msp) bubble("a3n", c, cast.msp, 1200, 30);
      setTimeout(() => others.forEach((v) => onHit(E3(v.t), v)), impact);
    }
  }

  /* ---------- synchronisation avec le combat ---------- */
  let cur = null;
  function decor(F) {
    const d = window.DECORS && DECORS.of(F); const u = d ? d.url : "";
    if (u === bgUrl) return; bgUrl = u;
    const wide = W > H * 2.3;
    bgEl.className = "a3bg" + (wide ? "" : " solo");
    bgEl.innerHTML = u ? (wide ? `<i class="mr" style="background-image:url(${u})"></i><i style="background-image:url(${u})"></i><i class="mr" style="background-image:url(${u})"></i>` : `<i style="background-image:url(${u})"></i>`) : "";
  }
  function reset(F) {
    ents.forEach((o) => o.el.remove()); ents = []; root.querySelectorAll(".a3x,.a3n,.a3d").forEach((n) => n.remove()); nFx = 0;
    fid = F ? F.id : null; lastSeq = F ? F.seq : -1;
    if (!F) return;
    F.ents.forEach((e, i) => { if (!e.summon) ents.push(mkEnt(e, i)); });
    place();
  }
  function mount(sc) {
    style(); host = sc;
    root = document.createElement("div"); root.className = "a3s";
    bgEl = document.createElement("div"); bgEl.className = "a3bg"; root.appendChild(bgEl);
    sc.innerHTML = ""; sc.appendChild(root); bgUrl = null; fid = undefined;
    if (window.ResizeObserver) new ResizeObserver(() => { const w = root.clientWidth, h = root.clientHeight; if (w !== W || h !== H) { bgUrl = null; place(); if (cur) decor(cur); } }).observe(root);
  }
  function fx(F, board) {
    const sc = board && board.querySelector ? board.querySelector("#a3scene") : document.getElementById("a3scene");
    if (!sc) return;
    if (sc !== host || !root || !root.isConnected) mount(sc);
    cur = F && F.ents ? F : null;
    if (!cur) { if (fid !== null) reset(null); decor(null); return; }
    if (cur.id !== fid || ents.length !== cur.ents.filter((e) => !e.summon).length) reset(cur);
    decor(cur);
    // les événements arrivés depuis le dernier passage, groupés par action (seq)
    const fresh = cur.fx.filter((v) => v.seq > lastSeq);
    if (fresh.length) {
      lastSeq = Math.max(lastSeq, ...fresh.map((v) => v.seq));
      const by = new Map(); fresh.forEach((v) => { if (!by.has(v.seq)) by.set(v.seq, []); by.get(v.seq).push(v); });
      const groups = [...by.values()];
      if (groups.length <= 8 && !document.hidden) { const step = 300 / groups.length; groups.forEach((g, k) => (k ? setTimeout(() => runSeq(g), k * step) : runSeq(g))); }
    }
    // morts, relèves, barres, télégraphe du boss
    for (const o of ents) {
      const e = cur.ents[o.i]; if (!e) continue; o.e = e;
      if (!e.alive && !o.dead) { o.dead = true; if (o.meta && o.meta[o.die]) { o.anim = o.die; o.t0 = now(); o.drawn = null; } }
      else if (e.alive && o.dead) { o.dead = false; o.anim = o.idle; o.t0 = now(); o.drawn = null; }
      o.el.classList.toggle("ko", o.dead);
      o.el.classList.toggle("tel", !o.hero && !!e.boss && !!e.charging);
      o.bar.style.width = Math.max(0, Math.min(100, (100 * Math.max(0, e.hp)) / (e.hpMax || 1))) + "%";
    }
    kick();
  }
  window.ANIM3 = { fx, pic: () => undefined, _state: () => ({ ents: ents.length, fid, lastSeq, W, H }) };
})();
