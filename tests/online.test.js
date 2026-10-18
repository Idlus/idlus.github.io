/* Test du compte et de la sauvegarde en ligne (0.1.15) dans un vrai navigateur, avec un faux serveur
   Supabase en mémoire (window.__IDLUS_SB) : connexion, pseudo, envoi, reprise, deux appareils.
   Lancer : node tests/online.test.js */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg" };
// le jeu est servi sous /beta/, comme la version de test
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/beta/, "");
  let file = path.join(ROOT, path.normalize(u).replace(/^(\.\.[/\\])+/, ""));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

/* Faux serveur : l'état vit dans le localStorage sous « __mock » (session, profils, partie). */
const MOCK = () => {
  const db = () => JSON.parse(localStorage.getItem("__mock") || '{"session":null,"profiles":[],"saves":{}}');
  const put = (d) => localStorage.setItem("__mock", JSON.stringify(d));
  const ts = () => new Date(Date.now()).toISOString().replace("Z", "000Z").replace(/\.(\d{3})000Z$/, ".$1" + String(Math.floor(Math.random() * 1000)).padStart(3, "0") + "Z");
  const q = (table) => {
    const f = []; let ins = null, del = false, ord = [], lim = 1e9, head = false;
    const rowsOf = () => { const d = db(); if (table === "profiles") return d.profiles; if (table === "saves") return Object.entries(d.saves).map(([user_id, s]) => Object.assign({ user_id }, s));
      if (table === "save_slots") return Object.entries(d.slots || {}).map(([k, s]) => Object.assign({ user_id: k.split(":")[0], slot: +k.split(":")[1] }, s)); // 1.0.11 : parties 2 et 3
      return (d.views || {})[table] || []; };
    const run = () => { let rows = rowsOf().slice(); f.forEach((fn) => { rows = rows.filter(fn); });
      ord.slice().reverse().forEach(([k, asc]) => rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1))); return rows.slice(0, lim); };
    const b = {
      select: (c, o) => { head = !!(o && o.head); return b; }, limit: (n) => { lim = n; return b; }, order: (k, o) => { ord.push([k, !o || o.ascending !== false]); return b; },
      eq: (k, v) => { f.push((r) => r[k] === v); return b; }, in: (k, v) => { f.push((r) => v.includes(r[k])); return b; }, delete: () => { del = true; return b; }, gt: (k, v) => { f.push((r) => r[k] > v); return b; }, lte: (k, v) => { f.push((r) => r[k] <= v); return b; },
      or: () => { f.push(() => false); return b; },
      ilike: (k, v) => { v = v.replace(/\\/g, ""); f.push((r) => String(r[k]).toLowerCase() === v.toLowerCase()); return b; },
      like: (k, v) => { const p = String(v).replace(/%$/, ""); f.push((r) => String(r[k]).startsWith(p)); return b; }, neq: (k, v) => { f.push((r) => r[k] !== v); return b; }, // Premiers depuis les sorts des boss
      insert: (o) => { ins = o; return b; },
      maybeSingle: () => Promise.resolve({ data: run()[0] || null, error: null }),
      then: (ok, ko) => {
        if (table === "chat_msgs" && window.__chatFail && !ins) return Promise.resolve({ data: null, error: { message: "canceling statement due to statement timeout" } }).then(ok, ko); // 1.0.9.1 : serveur lent
        if (ins && table !== "profiles") { const d = db(); d.views = d.views || {}; (d.views[table] = d.views[table] || []).push(ins); put(d); return Promise.resolve({ error: null }).then(ok, ko); }
        if (del) { const d = db(); const gone = run(); d.views[table] = (d.views[table] || []).filter((r) => !gone.some((g) => JSON.stringify(g) === JSON.stringify(r))); put(d); return Promise.resolve({ error: null }).then(ok, ko); }
        if (ins) { const d = db(); if (d.profiles.some((p) => p.pseudo.toLowerCase() === ins.pseudo.toLowerCase())) return Promise.resolve({ error: { message: "duplicate key" } }).then(ok, ko); d.profiles.push(ins); put(d); return Promise.resolve({ error: null }).then(ok, ko); }
        const rows = run(); return Promise.resolve(head ? { count: rows.length, error: null } : { data: rows, error: null }).then(ok, ko);
      },
    };
    return b;
  };
  const user = () => db().session;
  /* 1.0.30 : faux serveur des guildes (supabase/guildes.sql et gboss.sql) : code GUILDES, invitation, coffre, améliorations,
     Percepteurs, attaques entre guildes, boss en 5 phases, fiche d'une autre guilde. L'état vit dans d.gm. */
  const guildMock = (name, a, d, u, me) => {
    const E = window.ENGINE; const iso = (ms) => new Date(Date.now() + (ms || 0)).toISOString();
    const gm = (d.gm = d.gm || {}); if (gm.chest == null) Object.assign(gm, { in: false, gift: true, chest: 3000000, seats: 5, ups: { poche: 2, sagesse: 2 }, sale: 0, op: 100, chestlog: [{ at: iso(-3600e3), k: 215000, t: "Percepteur de la zone récolté par Lynaë", n: 1 }] });
    const ok = (x) => { put(d); return { data: x, error: null }; };
    const sid = Object.keys(E.SUBS).find((k) => E.SUBS[k].monsters && E.SUBS[k].monsters.length && E.percoCap(k)); const zone = E.percoName(sid);
    const G3 = { id: 3, name: "Les Bouftous", ic: "dofus", col: "#8cc63f", lvl: 14 }, G4 = { id: 4, name: "Ordre du Kralamour", ic: "phenix", col: "#7fb3ff", lvl: 22 }, G5 = { id: 5, name: "Les Tofus Enragés", ic: "ailes", col: "#ff8a6b", lvl: 9 };
    const hd = (cls, lvl) => ({ cls, sex: "m", head: 1, lvl });
    const pseudo = (me && me.pseudo) || "Moi";
    if (name === "gift_redeem") { if (a.p_code !== "GUILDES" || !gm.gift) return ok({ err: "Ce code n'existe pas." }); gm.gift = false; return ok({ reward: { k: 300000, s: 6 }, msg: "Refonte des guildes" }); }
    if (name === "guild_list") return ok([Object.assign({ open: true, motd: "", n: gm.in ? 5 : 4, cap: 5, chef: "Kralamour", shield: null, w: 6, l: 2, percos: 2 }, G3), Object.assign({ open: false, motd: "", n: 12, cap: 12, chef: "Kraken", shield: null, w: 18, l: 4, percos: 2 }, G4), Object.assign({ open: true, motd: "", n: 3, cap: 5, chef: "Nyx", shield: iso(70 * 60e3), w: 0, l: 0, percos: 0 }, G5, { lvl: 1 })]);
    if (name === "guild_me") {
      if (!gm.in) return ok({ g: null, gift: gm.gift, invites: [Object.assign({ gid: 3, n: 4, cap: 5, by: "Kralamour" }, G3)], asks: [] });
      const base = 450000 * 13 * 14 * 27 / 6, next = 450000 * 14 * 15 * 29 / 6;
      const mem = [[u.id, pseudo, 1, "iop", 150], ["u9", "Kralamour", 0, "iop", 200], ["u8", "Tofuline", 2, "eni", 150], ["u7", "Lynaë", 2, "eni", 187], ["u6", "Baloo", 3, "panda", 164]];
      return ok({ g: Object.assign({ motd: "Ce soir : on reprend le Percepteur des Pitons !", open: true, xp: 400000000, base, next, created: iso(-5 * 864e5), chest: gm.chest, seats: gm.seats, ups: gm.ups, shield: null, pvp: [6, 2], chest24: 1210000 }, G3),
        rank: 1, share: 0, share_by: null, sale: gm.sale, chestlog: gm.chestlog,
        members: mem.map(([uu, p, rank, cls, lvl]) => ({ u: uu, p, rank, share: 10, sby: null, given: 1000, week: 500, joined: iso(-864e5), cls, lvl, seen: iso() })),
        log: [{ at: iso(-60e3), t: "⚔ Nyx (Les Tofus Enragés) attaque le Percepteur !" }], asks: [], invited: [] });
    }
    if (name === "guild_leave") { gm.in = false; gm.left = (gm.left || 0) + 1; return ok({ ok: true }); }
    if (name === "guild_answer" || name === "guild_join") { gm.in = true; return ok({ ok: name === "guild_join" ? "in" : true }); }
    if (name === "guild_give") return ok(gm.in ? { ok: true, lvl: 14 } : { ok: false, none: true });
    if (name === "guild_chat") return ok([]);
    if (name === "guild_deposit") { gm.chest += a.p_k; gm.chestlog.unshift({ at: iso(), k: a.p_k, t: "Dépôt de " + pseudo, n: 1 }); gm.op = d.op = Math.max(gm.op, d.op || 100) + 1; return ok({ ok: true, chest: gm.chest, ops: [{ id: gm.op, p: { k: -a.p_k }, t: "Dépôt au coffre de guilde" }] }); }
    if (name === "guild_sale_pct") { gm.sale = a.p_pct; return ok({ ok: true, sale: a.p_pct }); }
    if (name === "guild_buy") {
      const U = E.GUILD_UQ_BY[a.p_k]; const r = gm.ups[a.p_k] || 0;
      const price = a.p_k === "place" ? E.guildSeatPrice(gm.seats + 1) : U ? U.cost : E.guildRankPrice(r + 1);
      if (gm.chest < price) return ok({ err: "Il manque des kamas dans le coffre." });
      gm.chest -= price; if (a.p_k === "place") gm.seats++; else gm.ups = Object.assign({}, gm.ups, { [a.p_k]: r + 1 });
      gm.chestlog.unshift({ at: iso(), k: -price, t: a.p_k + " acheté", n: 1 }); return ok({ ok: true, ups: gm.ups, seats: gm.seats, chest: gm.chest });
    }
    if (name === "guild_view" && a.p_id === 6) // Chasse aux Percepteurs : la guilde de la revanche
      return ok({ id: 6, name: "Les Bouftous Fous", ic: "trophee", col: "#e8c063", lvl: 12, motd: "", n: 4, cap: 5, created: iso(-864e5), chef: "Bouf", shield: null, pvp: [1, 3], war: null, boss: 0, trophies: 0, rob: 1, fort: null, spy: false, mine: false, mylvl: 14, members: [],
        percos: [{ id: 61, sid, name: zone, zlvl: E.percoLvl(sid), dj: false, fill: 1, shield: null, monsters: false, raid: null, pocket: null, stars: 1 }] });
    if (name === "guild_view") {
      const spy = !!gm.ups.espionnage;
      return ok(Object.assign({ motd: "On farm et on assume.", n: 12, cap: 12, created: iso(-2 * 864e5), chef: "Kraken", shield: null, pvp: [18, 4], war: { pts: 20, win: 6, loss: 1 }, boss: 3, trophies: 1, rob: 6, fort: spy ? false : null, spy, mine: false, mylvl: 14,
        members: [["Kraken", 0, "iop", 200], ["Gloubi", 1, "osa", 160], ["Rakoon", 2, "roub", 155]].map(([p, rank, cls, lvl]) => ({ p, rank, cls, lvl, team: spy ? [hd(cls, lvl), hd("eni", lvl), hd("sacri", lvl)] : null })),
        percos: [{ id: 41, sid, name: zone, zlvl: E.percoLvl(sid), dj: false, fill: 0.7, shield: null, monsters: false, raid: null, pocket: spy ? E.percoGain(E.percoCap(sid), 0.7, { poche: 3 }) : null },
          { id: 42, sid: "x", name: "Plaines Rocheuses", zlvl: 65, dj: false, fill: 0.35, shield: iso(4 * 3600e3), monsters: false, raid: null, pocket: null }] }, G4));
    }
    if (name === "guild_extra") {
      const cap = E.percoCap(sid);
      const rIn = gm.def ? [] : [{ id: 77, pid: 31, sid, zone, st: "open", at: iso(-42 * 60e3), ends: iso(78 * 60e3), res: null, by: "Nyx", me: false, heads: [hd("sram", 196), hd("eni", 190), hd("osa", 185)], lvl: 190, ag: G5, dg: G3, tries: [{ p: "Lynaë", win: false, at: iso(-31 * 60e3), heads: [hd("eni", 187)] }], tried: false }];
      const rOut = [{ id: 70, pid: 99, sid, zone: "Coin des Bouftous", st: "won", at: iso(-3 * 3600e3), ends: iso(-3600e3), res: { k: 31000, res: { "Laine de Bouftou": 212, "Corne de Boufton": 208 }, part: 0.25, half: true, fort: false, zone: "Coin des Bouftous" }, by: pseudo, me: true, heads: [], lvl: 150, ag: G3, dg: { id: 6, name: "Les Bouftous Fous", ic: "trophee", col: "#e8c063", lvl: 4 }, tries: [{ p: "Gloubi", win: false, at: iso(-2 * 3600e3) }, { p: "Rakoon", win: false, at: iso(-2 * 3600e3) }], tried: false }]
        .concat(gm.go ? [{ id: 80, pid: 41, sid, zone, st: "open", at: iso(), ends: iso(2 * 3600e3), res: null, by: pseudo, me: true, heads: [], lvl: 150, ag: G3, dg: G4, tries: [], tried: false }] : []);
      return ok({ boss: { w: E.gbossWeek(), pts: gm.bp || 25000, goal: 75000, active: 5, members: 6, lvl: 150, done: 2, tok: gm.tok != null ? gm.tok : 4.3, every: 120, next: 420, mine: 3200, tries: 2, today: 3, hitters: [{ p: "Kralamour", pts: 9000, n: 30, best: 410 }, { p: "Lynaë", pts: 600, n: 2, best: 320 }],
          top: [Object.assign({ pts: 60000, who: 12, ph: 3 }, G4), Object.assign({ pts: 42100, who: 5, ph: 2 }, G3)], last: [], trophies: [], claim: false },
        percos: [{ id: 31, sid, name: zone, zlvl: E.percoLvl(sid), dj: false, cap, fill: 0.82, by: "Lynaë", placed: iso(-864e5), wins: 3, losses: 1, next: iso(10 * 3600e3), shield: null, raided: !gm.def, atk: null },
          { id: 32, sid, name: zone + " (bis)", zlvl: E.percoLvl(sid), dj: false, cap, fill: gm.col ? 0 : 1, by: "Baloo", placed: iso(-864e5), wins: 0, losses: 0, next: iso(12 * 3600e3), shield: null, raided: false, atk: null }],
        slots: 3, ko: [], raids_in: rIn, raids_out: rOut, left: gm.go ? 2 : 3, max: 3,
        war: { me: { pts: 7, win: 2, loss: 1, def: 1 }, rank: 2, top: [Object.assign({ pts: 20, win: 6, loss: 1, def: 2 }, G4), Object.assign({ pts: 7, win: 2, loss: 1, def: 1 }, G3)], last: [] },
        taken: {}, holds: {}, glvl: 14, rank: 1, ups: gm.ups, now: iso(), nuit: false,
        revenge: [{ gid: 6, name: "Les Bouftous Fous", ic: "trophee", col: "#e8c063", zone, at: iso(-40 * 60e3), until: iso(320 * 60e3), used: false }] });
    }
    /* Chasse aux Percepteurs : tous les Percepteurs du serveur, primes */
    if (name === "perco_map") {
      const z2 = Object.keys(E.SUBS).filter((k) => E.SUBS[k].zone !== E.SUBS[sid].zone && E.percoCap(k)); const dj = Object.keys(E.DUNGEON_SUB).find((k) => E.percoCap(k));
      const P = (id, gid, s2, o) => Object.assign({ id, gid, sid: s2, zlvl: E.percoLvl(s2), dj: E.percoIsDj(s2), fill: 0.7, stars: 0, shield: null, monsters: false, raid: null, bounty: null }, o);
      return ok({ now: iso(), nuit: false, me: gm.in ? 3 : null, percos: [P(31, 3, sid, { fill: 0.82 }), P(32, 3, sid, { fill: 1 }), P(41, 4, sid, { stars: 3, bounty: gm.bnty ? [{ k: gm.bnty, gid: 3, by: "Les Bouftous", until: iso(3 * 864e5) }] : [{ k: 750000, gid: 5, by: "Les Tofus Enragés", until: iso(2 * 864e5) }] }),
        P(42, 4, z2[5], { shield: iso(4 * 3600e3) }), P(43, 4, z2[9], { fill: 0.4 }), P(51, 5, z2[5 + 1], { fill: 0.9 }), P(61, 6, z2[20], { fill: 1, stars: 1 }), P(62, 6, dj, { fill: 0.6 })],
        guilds: { 3: Object.assign({ rob: 2, young: null }, G3), 4: Object.assign({ rob: 6, young: null }, G4), 5: Object.assign({ rob: 0, young: iso(70 * 60e3) }, G5), 6: { name: "Les Bouftous Fous", ic: "trophee", col: "#e8c063", lvl: 12, rob: 1, young: null } } });
    }
    if (name === "guild_bounty") { if (gm.chest < a.p_k) return ok({ err: "coffre" }); gm.chest -= a.p_k; gm.bnty = a.p_k; return ok({ ok: true, chest: gm.chest }); }
    if (name === "perco_collect") { gm.col = true; gm.op = d.op = Math.max(gm.op, d.op || 100) + 1; return ok({ ok: true, k: 108000, res: { "Laine de Bouftou": 40 }, item: null, gxp: 5000, txp: 0.02, zl: 30, ops: [{ id: gm.op, p: { res: { "Laine de Bouftou": 40 } }, t: "Percepteur récolté" }] }); }
    if (name === "gboss_claim") return ok({ ok: 0, k: 0, dust: 0, titles: [], ops: [] });
    /* Alliances et prismes (1.1, supabase/alliances.sql) : invitation, prismes, bataille en cours, Percepteur allié attaqué */
    if (name === "ally_me") {
      const am = (gm.al = gm.al || { in: false, used: 3, pts: { 1: 4, 2: 6 } }); const z1 = E.SUBS[sid].zone;
      const AL = { 1: { name: "Les Gardiens d'Émeraude", tag: "GDE", ic: "couronne", col: "#8cc63f" }, 2: { name: "Pacte de Djaul", tag: "DJL", ic: "combat", col: "#e0674f" } };
      const base = { now: iso(), w: E.gbossWeek(), battle: { on: true, start: iso(-20 * 60e3), end: iso(40 * 60e3), done: false }, gid: 3, glvl: 14, rank: 0, chest: gm.chest, alliances: AL,
        prisms: [{ zone: z1, aid: 1, gid: 3, g: "Les Bouftous", by: "Kralamour", at: iso(-864e5), mods: { rempart: 2, sagesse: 1, ralliement: 1 } }, { zone: "cania", aid: 2, gid: 6, g: "Les Fils de Djaul", by: "Nyx", at: iso(-2 * 864e5), mods: { rempart: 1 } }],
        score: { [z1]: { 1: 9, 2: 7 }, cania: am.pts }, fights: { used: am.used, max: 10, extra: {} }, mine: [], top: [Object.assign({ id: 2, n: 2, regions: 1, wins: 13 }, AL[2]), Object.assign({ id: 1, n: 2, regions: 1, wins: 9 }, AL[1])], last: null, claim: false };
      if (!am.in) return ok(Object.assign(base, { al: null, invites: [{ aid: 1, name: AL[1].name, tag: "GDE", ic: "couronne", col: "#8cc63f", n: 1, by: "Kraken" }], asked: [], list: [{ id: 2, name: AL[2].name, tag: "DJL", ic: "combat", col: "#e0674f", n: 2, regions: 1, guilds: ["Les Fils de Djaul", "Brâkmar Éternel"] }], dom: [], help: [] }));
      return ok(Object.assign(base, { al: Object.assign({ id: 1, founder: 4, created: iso(-3 * 864e5), lead: false, asks: [], invited: [],
          guilds: [Object.assign({ n: 12, joined: iso(-3 * 864e5), chef: "Kraken", percos: 2 }, G4), Object.assign({ n: 5, joined: iso(), chef: "Kralamour", percos: 2 }, G3)] }, AL[1]),
        invites: [], asked: [], list: null, dom: [{ zone: "moon", gid: 4, g: "Ordre du Kralamour" }],
        help: [{ id: 88, sid, zone: "Plaine des Scarafeuilles", ends: iso(72 * 60e3), by: "Nyx", dg: G4, ag: G5, tried: false, n: 1 }] }));
    }
    if (name === "ally_answer") { gm.al.in = true; return ok({ ok: true }); }
    if (name === "ally_found") { gm.found = a; return ok(a.p_name && /^[A-Z0-9]{2,4}$/.test(a.p_tag || "") ? { ok: true, id: 9 } : { err: "Nom ou sigle vide" }); }
    if (name === "ally_chat") return ok((gm.al && gm.al.in) ? [{ id: 5, ch: "a", user_id: "u9", pseudo: "Kraken", cls: "iop", lvl: 200, body: "Tous à Cania ce soir !", kind: "msg", gname: "Ordre du Kralamour", created_at: iso(-60e3) }] : []);
    if (name === "ally_say") return ok(null);
    if (name === "prism_place") { if (gm.chest < 1000000) return ok({ err: "coffre" }); gm.chest -= 1000000; gm.al.placed = a.p_zone; return ok({ ok: true, chest: gm.chest }); }
    return undefined;
  };
  /* fonction serveur « record » pour les guildes : boss, défense contre les monstres, attaques */
  const guildInvoke = (body) => {
    const d = db(); const gm = (d.gm = d.gm || {}); gm.calls = (gm.calls || []).concat([body]); let r;
    if (body.raid && body.raid.def) { gm.def = true; r = { ok: true, raid: true, def: true, win: true, rounds: 7, by: "Nyx" }; }
    else if (body.raid && body.raid.go) { gm.go = true; r = { ok: true, raid: true, id: 80, ends: new Date(Date.now() + 7200e3).toISOString(), zone: "la zone", g: "Ordre du Kralamour", left: 2 }; }
    else if (body.prism) { gm.al.used = (gm.al.used || 0) + 1; gm.al.pts = { 1: 5, 2: 6 }; r = { ok: true, prism: true, zone: body.prism, def: false, free: false, win: true, rounds: 9, used: gm.al.used, extra: false, pts: { 1: 5, 2: 6 } }; }
    else if (body.gboss) { gm.bp = (gm.bp || 25000) + 310; gm.tok = (gm.tok != null ? gm.tok : 4.3) - 1; gm.bn = (gm.bn || 0) + 1; r = { ok: true, gboss: true, boss: "Boss", points: 310, rounds: 15, alive: 3, pts: gm.bp, goal: 75000, left: 0, phase: 3, done: 2, tok: gm.tok, every: 120, n: gm.bn, w: window.ENGINE.gbossWeek(), heroes: [{ n: "Iop", d: 52000 }, { n: "Eni", d: 9000 }], mech: ["Totem"] }; }
    else r = { ok: false, err: "refusé" };
    put(d); return { data: r, error: null };
  };
  window.__IDLUS_SB = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: user() ? { user: user() } : null } }),
      onAuthStateChange: (cb) => { window.__authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; }, // 1.0.29.6 : __authCb rejoue les évènements de la bibliothèque
      signInWithOAuth: async () => { const d = db(); d.session = { id: "u1", email: "test@idlus.fr", identities: [{ provider: "discord", identity_data: { global_name: "Testeur" } }] }; put(d); location.reload(); return { error: null }; },
      signInWithOtp: async () => ({ error: null }),
      signOut: async (o) => { const d = db(); d.session = null; d.signOutScope = (o && o.scope) || "global"; put(d); return { error: null }; },
      linkIdentity: async () => ({ error: null }),
    },
    from: q,
    channel: () => { const hs = []; const ch = { on: (ev, o, cb) => { if (ev === "postgres_changes") hs.push(cb); return ch; }, subscribe: (cb) => { window.__chatSub = cb; if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; }, track: () => {}, presenceState: () => ({ u1: [{}], u9: [{}], u8: [{}] }) };
      window.__chatEmit = (m) => hs.forEach((cb) => cb({ new: m })); return ch; },
    removeChannel: () => {},
    functions: { invoke: async (name, o) => { if (o.body.gboss || o.body.raid || o.body.perco || o.body.prism) return guildInvoke(o.body); const d = db();
      if (o.body.verif) { d.verifs = (d.verifs || 0) + 1; put(d); return { data: { ok: true }, error: null }; } // 2.1.4 « Bouclier du serveur »
      if (o.body.dofus) { d.dofusSent = (d.dofusSent || []).concat([o.body.dofus]); put(d); return { data: { ok: true, giga: true }, error: null }; } // 1.0.30 : GIGA annonce d'un Dofus
      if (o.body.songe) { d.songeSub = (d.songeSub || 0) + 1; put(d); return { data: { ok: true, songe: 1, w: Math.floor((Date.now() / 864e5 + 3) / 7), ii: 2, waves: 20, claim: 20, best: 20, improved: true, rank: 3, fii: 2, fwaves: 20 }, error: null }; } // 1.0.30 : Songe infini rejoué par le serveur
      d.invoked = (d.invoked || []).concat([o.body.did]); put(d); return { data: Object.assign({ ok: true, did: o.body.did, dname: "Donjon test", k: 3, t: 72, improved: true, rank: 2 }, d.recordReply || {}), error: null }; } },
    rpc: async (name, a) => {
      // 1.0.23 : builds partagés (supabase/builds.sql) ; la liste et les vues marchent sans compte
      if (/^builds?_|^adm_builds?/.test(name)) {
        const d = db(); const u = user(); const B = (d.builds = d.builds || []); const ok = (data) => { put(d); return { data, error: null }; };
        const row = (b) => Object.assign({}, b, { by: b.pseudo, liked: !!(u && (b.likers || []).includes(u.id)), mine: !!(u && b.user_id === u.id), wk: (b.likers || []).length, likes: (b.likers || []).length, hidden: !!(u && b.user_id === u.id && b.hidden) });
        if (name === "builds_list") {
          let L = B.filter((b) => !b.removed && (a.p_sort === "mine" ? u && b.user_id === u.id : !b.hidden));
          if (a.p_cls) L = L.filter((b) => b.cls === a.p_cls); if (a.p_el) L = L.filter((b) => b.el === a.p_el); if (a.p_bud) L = L.filter((b) => b.bud === a.p_bud);
          if (a.p_br) { const [lo, hi] = a.p_br.includes("-") ? a.p_br.split("-").map(Number) : [+a.p_br, +a.p_br]; L = L.filter((b) => b.lvl >= lo && b.lvl <= hi); }
          if (a.p_q) L = L.filter((b) => b.title.toLowerCase().includes(a.p_q.toLowerCase()) || (a.p_items || []).some((t) => b.items.includes(t)));
          if (a.p_sort === "fav") L = L.filter((b) => (a.p_ids || []).includes(b.id));
          L.sort((x, y) => (a.p_sort === "views" ? y.views - x.views : a.p_sort === "new" ? y.id - x.id : (y.likers || []).length - (x.likers || []).length || y.id - x.id));
          const off = a.p_off || 0; const w = B.filter((b) => !b.hidden && !b.removed && (b.likers || []).length >= 3).sort((x, y) => y.likers.length - x.likers.length)[0];
          return ok(Object.assign({ n: L.length, rows: L.slice(off, off + (a.p_sort === "mine" ? 30 : 24)).map(row) }, off === 0 && a.p_sort !== "mine" && a.p_sort !== "fav" ? { week: w ? row(w) : null } : {}));
        }
        if (name === "build_view") { const b = B.find((x) => x.id === a.p_id); const who = u ? u.id : "g:" + a.p_guest; if (!b || (b.seen || []).includes(who)) return ok(false); b.seen = (b.seen || []).concat([who]); b.views++; return ok(true); }
        if (!u) return { data: null, error: { message: "non connecté" } };
        const me = d.profiles.find((p) => p.id === u.id);
        if (name === "builds_me") return ok(B.filter((b) => b.user_id === u.id && !b.removed).map((b) => ({ id: b.id, hid: b.hid, title: b.title, cls: b.cls, lvl: b.lvl, likes: (b.likers || []).length, views: b.views, hidden: b.hidden, el: b.el, tags: b.tags, note: b.note, code: b.code, at: b.at })));
        if (name === "build_publish") {
          let j; try { j = JSON.parse(decodeURIComponent(escape(atob(a.p_code.slice(7))))); } catch (e) { return ok({ err: "Ce build ne peut pas être lu." }); }
          const items = Object.values(j.eq || {}); if (items.length < 3) return ok({ err: "Équipe au moins 3 objets sur ce héros avant de publier son build." });
          d.pubs = (d.pubs || []).concat([a]);
          if (a.p_id) { const b = B.find((x) => x.id === a.p_id && x.user_id === u.id && !x.removed); if (!b) return ok({ err: "Ce build n'existe plus : publie-le à nouveau.", gone: true });
            Object.assign(b, { code: a.p_code, cls: j.cls, lvl: j.lvl, items, bud: a.p_bud, at: new Date().toISOString() }, a.p_title == null ? {} : { title: a.p_title, note: a.p_note, tags: a.p_tags, el: a.p_el }); return ok({ id: b.id, upd: true }); }
          if (!a.p_title || a.p_title.length < 4) return ok({ err: "Donne un titre à ton build (4 caractères au moins)." });
          if (B.filter((x) => x.user_id === u.id && !x.removed).length >= 30) return ok({ err: "Tu as déjà 30 builds publiés." }); // 1.0.25.2 : 30 (10 avant)
          const id = B.reduce((m, x) => Math.max(m, x.id), 0) + 1;
          B.push({ id, user_id: u.id, pseudo: me ? me.pseudo : "?", hid: a.p_hid, cls: j.cls, lvl: j.lvl, el: a.p_el, bud: a.p_bud, tags: a.p_tags || [], title: a.p_title, note: a.p_note || "", code: a.p_code, items, sex: a.p_sex, head: a.p_head, likers: [], views: 0, reports: [], hidden: false, removed: false, at: new Date().toISOString(), new: new Date().toISOString() });
          return ok({ id });
        }
        const b = B.find((x) => x.id === a.p_id);
        if (name === "build_like") { if (!b) return ok({ err: "Ce build n'est plus disponible." }); if (b.user_id === u.id) return ok({ err: "Tu ne peux pas aimer ton propre build." });
          const on = !(b.likers || []).includes(u.id); b.likers = on ? (b.likers || []).concat([u.id]) : b.likers.filter((x) => x !== u.id); return ok({ liked: on, likes: b.likers.length }); }
        if (name === "build_report") { if (!b) return ok("Ce build n'est plus disponible."); if ((b.reports || []).some((r) => r[0] === u.id)) return ok("Tu as déjà signalé ce build."); b.reports = (b.reports || []).concat([[u.id, a.p_reason]]); if (b.reports.length >= 3) b.hidden = true; return ok(null); }
        if (name === "build_delete") { d.builds = B.filter((x) => !(x.id === a.p_id && x.user_id === u.id)); put(d); return { data: null, error: null }; }
        if (name === "adm_builds") return ok(B.map((x) => ({ id: x.id, pseudo: x.pseudo, cls: x.cls, lvl: x.lvl, title: x.title, note: x.note, likes: (x.likers || []).length, views: x.views, reports: (x.reports || []).length, hidden: x.hidden, removed: x.removed, at: x.at, reasons: (x.reports || []).map((r) => r[1]).join(" · ") })));
        if (name === "adm_build_set") { d.admCalls = (d.admCalls || []).concat([[name, a]]); if (b) { if (a.p_act === "ok") Object.assign(b, { hidden: false, reports: [] }); if (a.p_act === "hide") b.hidden = true; if (a.p_act === "del") b.removed = true; if (a.p_act === "restore") Object.assign(b, { removed: false, hidden: false }); } return ok(null); }
      }
      // 1.0.30 : vente directe et Jackpot du Trool (supabase/vente.sql, supabase/foire.sql) ; les prix et le pot se lisent sans compte.
      // Le serveur lit la partie en ligne (ressources, kamas) et répond par des opérations, comme l'HdV.
      if (/^vente_|^foire_/.test(name)) {
        const d = db(); const u = user(); const E = window.ENGINE; const ok = (data) => { put(d); return { data, error: null }; };
        if (d.ecoOff) return { data: null, error: { message: `Could not find the function public.${name} without parameters in the schema cache` } }; // SQL pas encore appliqué
        if (window.__offline) throw new Error("Failed to fetch");
        const V = (d.vente = d.vente || { c: { "Laine de Bouftou": [0.4, 4000, 9000], "Bois de Frêne": [2.6, 300, 300], "Plume de Tofu": [1.2, 9000, 2500] } });
        const hr = Math.floor(Date.now() / 3600000) * 3600000;
        const J = (d.jack = d.jack || { hour: hr, n: 4, mine: 0, day: 0, last: [{ p: "Kralamour", k: 270000, n: 30, h: hr - 3600000, me: false }, { p: "Tofuline", k: 90000, n: 10, h: hr - 7200000, me: false }] });
        if (J.hour < hr || d.jackDraw) { // tirage de l'heure finie au premier appel : le joueur gagne s'il avait des tickets (une seule chance dans ce faux serveur)
          if (J.mine && u) { d.op = (d.op || 100) + 1; d.syncOps = (d.syncOps || []).concat([{ id: d.op, p: { k: J.n * 9000, jack: 1 }, t: `Jackpot du Trool : tu remportes le pot de ${J.n * 9000} kamas (${J.n} tickets) !` }]); J.last.unshift({ p: "Bouftou", k: J.n * 9000, n: J.n, h: J.hour, me: true }); }
          Object.assign(J, { hour: hr, n: 0, mine: 0 }); d.jackDraw = false;
        }
        const jst = () => ({ hour: hr, end: hr + 3600000, now: Date.now(), pot: J.n * 9000, tickets: J.n, players: J.n ? 1 + (J.mine ? 1 : 0) : 0, mine: u ? J.mine : 0, day: u ? J.day : 0, max: 100, last: J.last.slice(0, 6) });
        if (name === "vente_cours") return ok({ c: V.c, up: !!(u && d.venteUp), t: Date.now() });
        if (name === "vente_courbe") { const x = V.c[a.p_key]; return ok({ pts: x ? [[Date.now() - 30 * 3600000, 1.5, 500], [Date.now() - 20 * 60000, x[0], 120]] : [], c: x ? [x[0], x[1]] : [3, 0], base: E.resPrice(a.p_key), t: Date.now() }); }
        if (name === "foire_jackpot") return ok(jst());
        if (!u) return { data: null, error: { message: "non connecté" } };
        const sv = d.saves[u.id] ? JSON.parse(d.saves[u.id].data) : null;
        if (!sv) return ok({ err: "Pas de partie en ligne pour la vente directe." });
        if (name === "vente_sell") {
          const sold = {}, res = {}, cs = {}; let k = 0;
          Object.keys(a.p_lots || {}).sort().forEach((n) => { const q = Math.min(Math.floor(+a.p_lots[n] || 0), Math.floor((sv.res || {})[n] || 0)); if (!(q >= 1) || !E.venteOk(n)) return;
            const x = V.c[n] || [3, 0, 0]; const L = E.venteLot(E.resPrice(n), x[0], q, d.venteUp ? 1.05 : 1); k += L.k; V.c[n] = [L.c, x[1] + q, (x[2] || 0) + q]; sold[n] = q; res[n] = -q; cs[n] = [L.c, x[1] + q]; });
          d.sells = (d.sells || []).concat([a.p_lots]);
          if (!Object.keys(sold).length) return ok({ err: "Rien à vendre : ta partie en ligne n'a pas ces ressources (attends quelques secondes et réessaie)." });
          const share = d.guildShare ? Math.floor(k * d.guildShare) : 0; d.op = (d.op || 100) + 1;
          const op = { id: d.op, p: { k: k - share, res, vd: 1 }, t: `Vente directe : ${Object.keys(sold).length} ressource(s) pour ${k - share} kamas` };
          return ok({ ok: true, sold, k: k - share, share, up: !!d.venteUp, c: cs, ops: [op] });
        }
        if (name === "foire_jackpot_buy") {
          const n = a.p_n; if (!(n >= 1 && n <= 10)) return ok({ err: "De 1 à 10 tickets d'un coup." });
          if (J.day + n > 100) return ok({ err: J.day >= 100 ? "Tu as déjà tes 100 tickets du jour : reviens demain." : `Encore ${100 - J.day} tickets au plus aujourd'hui.` });
          if ((sv.kamas || 0) < n * 10000) return ok({ err: "Pas assez de kamas (ou ta partie en ligne n'est pas encore à jour : attends quelques secondes)." });
          J.n += n; J.mine += n; J.day += n; d.op = (d.op || 100) + 1;
          return ok(Object.assign(jst(), { ok: true, ops: [{ id: d.op, p: { k: -n * 10000, jt: n }, t: `Jackpot du Trool : ${n} ticket(s) pour ${n * 10000} kamas` }] }));
        }
        return { data: null, error: { message: "fonction inconnue " + name } };
      }
      const d = db(); const u = user(); if (!u) return { error: { message: "non connecté" } };
      if (window.__offline) throw new Error("Failed to fetch");
      const s = d.saves[u.id];
      // 0.1.50.1 : changer son pseudo (une fois tous les 30 jours)
      if (name === "pseudo_info") { const me = d.profiles.find((p) => p.id === u.id); return { data: me ? { at: me.pseudo_at || null, next: me.pseudo_at ? new Date(Date.parse(me.pseudo_at) + 30 * 864e5).toISOString() : null } : null, error: null }; }
      if (name === "pseudo_change") { const me = d.profiles.find((p) => p.id === u.id); const p = a.p_pseudo;
        if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,16}$/.test(p)) return { data: "3 à 16 caractères", error: null };
        if (me.pseudo_at && Date.now() - Date.parse(me.pseudo_at) < 30 * 864e5) return { data: "Tu pourras rechanger de pseudo le 12/11.", error: null };
        if (d.profiles.some((x) => x.id !== u.id && x.pseudo.toLowerCase() === p.toLowerCase())) return { data: "Ce pseudo est déjà pris.", error: null };
        me.pseudo = p; me.pseudo_at = new Date().toISOString(); put(d); return { data: null, error: null }; }
      // 1.0.11 : parties 2 et 3 (tools/emplacements.sql)
      if (name === "slot_info") { const x = (d.slots || {})[u.id + ":" + a.p_slot]; return { data: x ? [{ updated_at: x.updated_at, meta: x.meta, device: x.device, game_version: x.game_version }] : [], error: null }; }
      if (name === "push_slot") { d.slots = d.slots || {}; const k = u.id + ":" + a.p_slot, x = d.slots[k];
        if (!a.p_force && ((a.p_expected == null && x) || (a.p_expected != null && (!x || x.updated_at !== a.p_expected)))) return { data: null, error: null };
        d.slots[k] = { data: a.p_data, meta: a.p_meta, device: a.p_device, game_version: a.p_version, updated_at: ts() }; d.slotPushes = (d.slotPushes || 0) + 1; put(d); return { data: d.slots[k].updated_at, error: null }; }
      if (name === "delete_slot") { d.slots = d.slots || {}; delete d.slots[u.id + ":" + a.p_slot]; put(d); return { data: null, error: null }; }
      if (name === "save_info") return { data: s ? [{ updated_at: s.updated_at, meta: s.meta, device: s.device, game_version: s.game_version }] : [], error: null };
      if (name === "push_save") {
        if (a.p_force && s && s.meta && s.meta.remise) a = Object.assign({}, a, { p_force: false }); // remise imposée, comme push_save
        if (!a.p_force && ((a.p_expected == null && s) || (a.p_expected != null && (!s || s.updated_at !== a.p_expected)))) return { data: null, error: null };
        d.saves[u.id] = { data: a.p_data, meta: a.p_meta, device: a.p_device, game_version: a.p_version, updated_at: ts() }; d.pushes = (d.pushes || 0) + 1; put(d);
        if (window.__lostReply) { window.__lostReply = false; throw new Error("Failed to fetch"); } // 1.0.10.2 : enregistré en ligne, mais la réponse se perd (serveur lent)
        return { data: d.saves[u.id].updated_at, error: null };
      }
      const me = d.profiles.find((p) => p.id === u.id); const log = () => { d.admCalls = (d.admCalls || []).concat([[name, a]]); put(d); };
      if (name === "chat_send") {
        if (/www\.|https?:/.test(a.p_body)) return { data: "Les liens ne sont pas autorisés dans le chat.", error: null };
        d.views = d.views || {}; const L = (d.views.chat_msgs = d.views.chat_msgs || []);
        const m = { id: 1000 + L.length, ch: a.p_to ? "p" : a.p_ch || "g", user_id: u.id, to_id: a.p_to, pseudo: me && me.pseudo, cls: "iop", lvl: 50, body: a.p_body, item: a.p_item, kind: "msg", created_at: new Date().toISOString() };
        L.push(m); put(d); setTimeout(() => window.__chatEmit && window.__chatEmit(m), 50); return { data: null, error: null };
      }
      if (name === "chat_report") { d.reports = (d.reports || []).concat([a]); put(d); return { data: null, error: null }; }
      if (name === "chat_me") return { data: { banned: false, closed: !!d.chatClosed }, error: null };
      if (name === "adm_msg_del") { log(); d.views.chat_msgs = (d.views.chat_msgs || []).filter((x) => x.id !== a.p_id); put(d); return { data: null, error: null }; } // 1.2.10.1
      if (name === "adm_chat_close") { log(); d.chatClosed = a.p_on; put(d); return { data: null, error: null }; }
      if (name === "staff_list") return { data: [{ u: "u9", p: "Kralamour", r: "crea" }, { u: "u8", p: "Tofuline", r: "mod" }], error: null };
      if (name === "my_role") return { data: d.role || null, error: null };
      if (name === "adm_overview") return { data: { accounts: d.profiles.length, active: 1, reports: 1, flagged: 0, muted: 0, signups: [{ id: "u9", pseudo: "Kralamour", cls: "iop", at: new Date().toISOString() }], log: [{ at: new Date().toISOString(), txt: "test", who: "Xener" }], settings: { min_level: 0, slow_s: 4, closed: !!d.chatClosed }, role: d.role }, error: null };
      if (name === "adm_players") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", level: 4812, playtime: 7200, heroes: [{ cls: "iop", lvl: 200, ren: 1 }], created_at: new Date().toISOString(), last_save: new Date().toISOString(), reports: 1, flagged: false }], error: null };
      if (name === "adm_msgs" || name === "adm_mods") return { data: [], error: null };
      // 2.1.4 « Bouclier du serveur » : un compte retenu par le serveur, ses raisons, ses ventes et ses copies des 7 jours
      if (name === "adm_flagged") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", reason: "Bouclier : +48 000 000 kamas en 6 min (au plus 48 h de jeu possibles, il en faudrait 61,3)", level: 4812, updated_at: new Date().toISOString(), flagged: false }], error: null };
      if (name === "adm_bouclier") { const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); return { data: { held: true, okAt: new Date(Date.now() - 3600e3).toISOString(), log: [{ why: "+48 000 000 kamas en 6 min (au plus 48 h de jeu possibles, il en faudrait 61,3)", at: new Date(Date.now() - 600e3).toISOString() }, { why: "Épée de Fouraille : 99999 Vitalité (au plus 810)", at: new Date(Date.now() - 900e3).toISOString() }], sold: [{ to: "Tofuline", n: 3, k: 2400000 }, { to: "Pandawa_92", n: 1, k: 900000 }], trades: 1, days: [0, 1, 2, 3].map((n) => ({ day: day(n), lvl: 4812 - n * 40, kamas: 52000000 - n * 4e6, at: new Date().toISOString() })) }, error: null }; }
      if (name === "adm_save_restore") { log(); return { data: null, error: null }; }
      if (name === "adm_reports") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", n: 1, reasons: "Spam", bodies: ["coucou"] }], error: null };
      // 1.1.2.4 : annonces en boucle (supabase/annonces_boucle.sql) : la première part tout de suite (bandeau + chat)
      if (name === "ann_tick") { const L = (d.loops || []).filter((x) => x.active && Date.parse(x.next_at) <= Date.now()); L.forEach((x) => { d.views = d.views || {}; (d.views.announces = d.views.announces || []).push({ id: 100 + x.id * 10 + x.sent, body: x.body, banner: true, until: new Date(Date.now() + 6e5).toISOString() }); x.sent++; x.last_at = new Date().toISOString(); x.next_at = new Date(Date.now() + x.every_min * 6e4).toISOString(); }); put(d); return { data: (d.loops || []).filter((x) => x.active).map((x) => x.next_at).sort()[0] || null, error: null }; }
      if (name === "adm_loops") return { data: d.loops || [], error: null };
      if (name === "adm_loop_save") { log(); d.loops = d.loops || []; const x = a.p_id ? d.loops.find((l) => l.id === a.p_id) : { id: d.loops.length + 1, sent: 0, active: true }; Object.assign(x, { body: a.p_body, every_min: a.p_every, banner: a.p_banner, chat: a.p_chat, show_min: a.p_show, ends: a.p_ends, next_at: a.p_now ? new Date().toISOString() : new Date(Date.now() + a.p_every * 6e4).toISOString() }); if (!a.p_id) d.loops.push(x); put(d); return { data: null, error: null }; }
      if (name === "adm_loop_on") { log(); const x = (d.loops || []).find((l) => l.id === a.p_id); if (x) x.active = a.p_on; put(d); return { data: null, error: null }; }
      if (name === "adm_loop_del") { log(); d.loops = (d.loops || []).filter((l) => l.id !== a.p_id); put(d); return { data: null, error: null }; }
      // 1.2.8 : pluie de kamas (supabase/pluie.sql) : d.rain = état renvoyé par rain_state
      if (name === "rain_state") return { data: d.rain || null, error: null };
      if (name === "rain_join") { if (!d.rain || d.rain.st !== "open") return { data: { err: "Cette pluie de kamas est déjà finie." }, error: null }; d.rainJoin = (d.rainJoin || 0) + 1; d.rain.in = true; d.rain.n++; put(d); return { data: d.rain, error: null }; }
      if (name === "adm_rain_open") { log(); d.rain = { id: 1, st: "open", total: a.p_total, msg: a.p_msg, by: "Xener", ends: new Date(Date.now() + a.p_min * 6e4).toISOString(), now: new Date().toISOString(), n: 0, share: 0, in: false, mine: true }; put(d); return { data: { ok: true, id: 1, ops: [] }, error: null }; } // pas d'opération : les numéros de l'hôtel de vente du test restent libres
      if (name === "adm_rains") return { data: d.rain ? [Object.assign({ status: d.rain.st, at: new Date().toISOString() }, d.rain)] : [], error: null };
      if (name === "adm_announce") { log(); d.views = d.views || {}; (d.views.announces = d.views.announces || []).push({ id: 7, body: a.p_body, banner: true, until: null }); put(d); return { data: null, error: null }; }
      // 0.1.20 : hôtel de vente (une seule annonce, achetée une fois)
      const tpl = Object.keys(window.DATA.ITEMS).find((k) => window.DATA.ITEMS[k].lvl === 60 && window.DATA.ITEMS[k].slot === "coiffe"); const T = window.DATA.ITEMS[tpl];
      const item = { tpl, stats: Object.fromEntries(Object.entries(T.stats).map(([k, [lo]]) => [k, lo])) };
      if (name === "hdv_search") return { data: d.hdvSold ? [] : [{ cat: "eq", key: tpl, name: T.name, lvl: T.lvl, slot: T.slot, n: 1, qty: 1, unit: 5000 }], error: null };
      if (name === "hdv_offers") return { data: d.hdvSold ? [] : [{ id: 1, qty: 1, price: 5000, item, mine: false, exp: new Date(Date.now() + 864e5 * 14).toISOString() }], error: null };
      if (name === "hdv_market") return { data: d.hdvSold ? [] : [{ cat: "eq", key: tpl, name: T.name, lvl: T.lvl, slot: T.slot, n: 1, qty: 1, unit: 5000, p1: 5000, avg: 6000 }], error: null };
      if (name === "hdv_history") return { data: { avg: 4800, week: 3, days: [{ d: "2026-10-10", u: 4600, q: 1 }, { d: "2026-10-11", u: 5000, q: 2 }] }, error: null };
      if (name === "hdv_bought") return { data: d.hdvSold ? [{ cat: "eq", key: tpl, name: T.name, qty: 1, price: 5000, at: new Date().toISOString(), seller: "Vendeur" }] : [], error: null };
      if (name === "hdv_stats") return { data: { avg: 4800, week: 3, days: [{ d: "2026-10-10", u: 4600 }, { d: "2026-10-11", u: 5000 }] }, error: null };
      if (name === "hdv_mine") return { data: { open: [], sold: [] }, error: null };
      if (name === "brisage_list" || name === "brisage_hit") return { data: {}, error: null };
      // 1.0.30 « Forge » : coefficients de 10 % à 200 % (supabase/brisage.sql), départ il y a 50 h : un objet jamais brisé est à 150 %
      if (name === "brisage_sync" || name === "brisage_hit_sync") {
        const E = window.ENGINE, now = Date.now(); if (!d.brT0) d.brT0 = now - 50 * 3600000; const B = (d.brCoef = d.brCoef || {}); const def = E.coefAt(100, d.brT0, now);
        (a.p_tpls || []).forEach((t) => { const c = B[t]; B[t] = [Math.max(10, (c ? Math.min(def, E.coefAt(c[0], c[1], now)) : def) - 3), now]; }); put(d);
        const since = a.p_since ? Date.parse(a.p_since) : 0; const rows = {}; for (const t in B) if (since ? B[t][1] > since : E.coefAt(B[t][0], B[t][1], now) < def) rows[t] = B[t];
        return { data: { now, t0: d.brT0, since: new Date(now - 60000).toISOString(), rows }, error: null };
      }
      if (name === "hdv_prix7") { const o = {}; (a.p_keys || []).forEach((k) => { if (window.DATA.ITEMS[k]) o[k] = 5000; else if (k.startsWith("ra:")) o[k] = 120; else if (k.startsWith("pa:")) o[k] = 35; else if (k.startsWith(":")) o[k] = 10; });
        d.prix7 = (d.prix7 || 0) + 1; put(d); return { data: o, error: null }; }
      if (name === "hdv_sync" || name === "trade_state") return { data: name === "hdv_sync" ? { ops: (d.syncOps || []).filter((o) => o.id > (a.p_after || 0)) } : null, error: null }; // 1.0.30 : gain du Jackpot
      if (name === "hdv_buy") { if (d.hdvSold) return { data: { err: "Déjà vendu." }, error: null }; d.hdvSold = true; put(d); return { data: { ok: true, ops: [{ id: 1, p: { k: -5000, add: [item] }, t: "Acheté : " + T.name }] }, error: null }; }
      // 0.1.33 : offres d'achat
      if (name === "hdv_orders_list") return { data: d.ordSold ? [] : [{ id: 5, cat: "res", key: "Laine de Bouftou", name: "Laine de Bouftou", lvl: 1, left: 50, qty: 50, price: 30, exp: new Date(Date.now() + 864e5 * 3).toISOString(), mine: false }], error: null };
      if (name === "hdv_orders_mine") return { data: d.ordMine || [], error: null };
      if (name === "hdv_order_new") { const held = a.p_qty * a.p_price + Math.ceil(a.p_qty * a.p_price * 0.02); d.ordMine = [{ id: 9, cat: a.p_cat, key: a.p_key, name: a.p_name, qty: a.p_qty, filled: 0, price: a.p_price, held, st: "open", exp: new Date(Date.now() + 864e5 * a.p_days).toISOString() }]; put(d);
        return { data: { ok: true, ops: [{ id: 3, p: { k: -held }, t: "Offre d'achat" }] }, error: null }; }
      if (name === "hdv_order_fill") { d.ordSold = true; put(d); return { data: { ok: true, n: a.p_qty, k: a.p_qty * 30, ops: [{ id: 2, p: { k: a.p_qty * 30, res: { "Laine de Bouftou": -a.p_qty } }, t: "Vendu à une offre d'achat" }] }, error: null }; }
      if (/^(guild_|perco_|gboss_|ally_|prism_)/.test(name) || name === "gift_redeem") { const r = guildMock(name, a, d, u, me); if (r) return r; } // 1.0.30 : refonte des guildes
      if (name === "adm_hdv") return { data: { open: 1, sellers: 1, sales7: 0, vol7: 0, trades7: 0, last: [], top: [{ id: 1, name: T.name, qty: 1, price: 5000, s: "Kralamour" }] }, error: null };
      // 0.1.36 : boîte à idées
      if (name === "idea_send") { const L = (d.ideas = d.ideas || []); if (L.some((x) => x.user_id === u.id && Date.now() - x.t < 600000)) return { data: "Une idée toutes les 10 minutes : réessaie un peu plus tard.", error: null };
        L.push({ id: L.length + 1, user_id: u.id, t: Date.now(), pseudo: me && me.pseudo, info: a.p_info, tag: a.p_tag, title: a.p_title, body: a.p_body, hidden: false, url: null, created_at: new Date().toISOString(), guest: false }); put(d); return { data: null, error: null }; }
      // 1.1.1.3 : signaler un bug
      if (name === "bug_send") { const L = (d.bugs = d.bugs || []); if (L.some((x) => x.user_id === u.id && Date.now() - x.t < 120000)) return { data: { err: "Un signalement toutes les 2 minutes : réessaie un peu plus tard." }, error: null };
        L.push({ id: L.length + 1, user_id: u.id, t: Date.now(), pseudo: me && me.pseudo, what: a.p_what, expected: a.p_expected, page: a.p_page, version: a.p_version, device: a.p_device, diag: a.p_diag, status: "nouveau", issue: null, created_at: new Date().toISOString(), guest: false }); put(d); return { data: { id: L.length }, error: null }; }
      if (name === "bug_mine") return { data: (d.bugs || []).map((b) => ({ id: b.id, what: b.what, status: b.id === 1 ? "corrige" : b.status, fixed_in: b.id === 1 ? "1.1.0.9" : null, note: null, created_at: b.created_at })).reverse(), error: null };
      if (name === "adm_bugs") return { data: (d.bugs || []).slice().reverse(), error: null };
      // 0.1.52.1 : fiches joueurs (la partie en ligne du joueur = la partie de ce navigateur)
      if (name === "adm_roster") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", level: 4812, main_lvl: 200, playtime: 7200, guild: "Les Tofus", cote: 1240, last_save: new Date().toISOString(), created_at: new Date().toISOString() }, { id: "u8", pseudo: "Tofuline", cls: "eni", level: 150, created_at: new Date().toISOString() }], error: null };
      if (name === "adm_player") return { data: { id: a.p_user, pseudo: "Kralamour", acc: { created_at: new Date().toISOString(), last_login: new Date().toISOString(), providers: ["discord"], discord: "Krala" },
        save: { data: window.ENGINE.serialize(window.DX.S), version: "0.1.52.1", device: "PC", at: new Date().toISOString(), size: 10 }, ladder: { main: "iop", main_lvl: 200, level: 4812 },
        guild: { name: "Les Tofus", lvl: 3, rank: 0, given: 12000 }, koli: { cote: 1240, best: 1300, win: 4, loss: 1, dwin: 2, dloss: 3, fights: 10 },
        hdv: { open: 2, open_k: 15000, sold: 3, sold_k: 42000, bought: 1, bought_k: 900, orders: 0, trades: 1, last: [{ name: "Blé", qty: 100, price: 900, at: new Date().toISOString(), sold: false }] },
        boss: { wb_n: 3, wb_pts: 125000, gb_n: 0, gb_pts: 0 }, gifts: [{ code: "SABLIER", at: new Date().toISOString() }], ideas: [], chat: { pub: 12, pub7: 4, priv: 2 }, mod: { reports: 1, reported: 0, log: [{ at: new Date().toISOString(), txt: "Kralamour rendu muet 1 h" }] } }, error: null };
      if (name === "adm_ideas") return { data: (d.ideas || []).slice().reverse(), error: null };
      if (name === "adm_pin") { log(); d.views = d.views || {}; d.views.chat_settings = [{ id: 1, pin_body: a.p_body, pin_chs: a.p_chs, pin_at: ts() }]; put(d); return { data: null, error: null }; } // 0.1.50.2
      // 1.0.30 : guerre des cités (supabase/alignement.sql) et lots du Songe infini (supabase/songe.sql)
      if (name === "align_war_state") { const w = d.war || {}; return { data: { w: a.p_w, b: w.b || 0, k: w.k || 0, nb: 3, nk: 2, cb: 5, ck: 4, prev: { w: a.p_w - 1, b: 900, k: 1100, win: "brakmar" } }, error: null }; }
      if (name === "align_me") return { data: {}, error: null };
      if (name === "songe_claim") { d.claims = (d.claims || 0) + 1; put(d); return { data: { ok: 1, bribes: 0, top: false, ops: [] }, error: null }; } // ops vides : les numéros d'opération de l'HdV restent ceux du test
      if (name.startsWith("adm_")) { log(); return { data: null, error: null }; }
      if (name === "gift_mine") return d.giftMine ? { data: d.giftMine, error: null } : { data: null, error: { message: "pas encore" } }; // 1.0.6.2
      if (name === "delete_my_account") { delete d.saves[u.id]; d.profiles = d.profiles.filter((p) => p.id !== u.id); d.session = null; put(d); return { data: null, error: null }; }
    },
  }) };
};

/* 1.2 : une page peut être repliée dans sa famille (ou rangée en onglet) : on ouvre la famille puis on clique, sinon DX.go */
const navClick = async (page, k) => { const how = await page.evaluate((k) => { const vis = (e) => !!(e && (e.offsetWidth || e.offsetHeight)); let b = document.querySelector(`#nav .sn-side [data-nk="${k}"]`); if (vis(b)) return "nav"; const F = window.DX.NAV.find((F) => F.pages.some((p) => p[0] === k)); const fh = F && document.querySelector(`#nav .sn-side .sn-fh[data-fam="${F.id}"]`); if (fh && fh.getAttribute("aria-expanded") !== "true") { fh.click(); const w = document.querySelector("#wtip"); if (w) w.remove(); } b = document.querySelector(`#nav .sn-side [data-nk="${k}"]`); return vis(b) ? "nav" : "go"; }, k); if (how === "nav") await page.click(`#nav .sn-side [data-nk="${k}"]`); else await page.evaluate((k) => window.DX.go(k), k); };
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/beta/`;
  const errors = []; const fail = (m) => errors.push(m);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(MOCK);
    await ctx.addInitScript(() => { window.__IDLUS_NOLAUNCH = true; }); // 1.0 : pas d'écran de lancement pendant ce test
    await ctx.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") fail(`console : ${m.text()}`); });
    page.on("pageerror", (e) => fail(`exception : ${e.message}`));
    const mock = () => page.evaluate(() => JSON.parse(localStorage.getItem("__mock") || "{}"));
    const S = () => page.evaluate(() => window.DX.S && { kamas: window.DX.S.kamas, n: window.DX.S.chars.length });

    // 1. premier lancement : pas de compte obligatoire, on arrive directement sur le choix du héros
    await page.goto(base); await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    if (await page.$('[data-act="on-discord"]')) fail("écran de connexion au premier lancement");
    // « Se connecter » depuis l'écran de départ : écran « Choisis ta partie » (1.0.11) avec Discord en haut, puis partie 1 sans compte
    await page.click('.start [data-act="on-loginscreen"]'); await page.waitForSelector('.svm [data-act="on-discord"]', { timeout: 10000 });
    if ((await page.$$(".svm .svc2")).length !== 3) fail("choix des parties : il faut 3 emplacements");
    await page.click('.svc2[data-slot="1"] [data-act="sv-play"]'); await page.waitForSelector('[data-act="startgame"]');
    await page.reload(); await page.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    if (await page.$(".svm")) fail("choix des parties : affiché alors qu'il n'y a aucune partie ni compte");
    // 2. partie sans compte, puis connexion depuis les Options : la partie de l'appareil est proposée
    await page.click('[data-act="startgame"]'); await page.waitForSelector("#nav [data-nk]");
    await page.evaluate(() => { window.DX.S.kamas = 4321; window.DX.saveNow(); });
    await page.evaluate(() => window.DX.social.options("sauvegarde")); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-loginscreen"]');
    await page.waitForSelector('[data-act="on-discord"]', { timeout: 10000 });
    await page.click('[data-act="on-discord"]');
    await page.waitForSelector("#onPseudo", { timeout: 10000 });
    await page.fill("#onPseudo", "a b"); await page.click('[data-act="on-pseudo"]'); await page.waitForTimeout(200);
    if (!/3 à 16/.test(await page.textContent("#onMsg"))) fail("pseudo invalide accepté");
    await page.fill("#onPseudo", "Xen3r"); await page.click('[data-act="on-pseudo"]'); await page.waitForTimeout(200);
    if ((await mock()).profiles.length) fail("pseudo qui imite le créateur accepté");
    await page.fill("#onPseudo", "Bouftou"); await page.click('[data-act="on-pseudo"]');
    // la partie de l'appareil n'est pas encore sur le compte : la carte de la partie 1 le dit, « Jouer » l'envoie
    await page.waitForSelector('.svc2[data-slot="1"] .svnote', { timeout: 10000 });
    if (!/pas encore sur ton compte/.test(await page.textContent('.svc2[data-slot="1"]'))) fail("choix des parties : partie pas encore sur le compte non signalée");
    if (!(await page.$('.svc2[data-slot="1"] [data-act="sv-fresh"]'))) fail("choix des parties : « Nouvelle partie à la place » absent");
    if (!/4 321|4,3 k/.test((await page.textContent('.svc2[data-slot="1"]')).replace(/\s/g, " "))) fail("choix des parties : kamas de la partie absents de la carte");
    await page.click('.svc2[data-slot="1"] [data-act="sv-play"]'); await page.waitForSelector("#nav [data-nk]");
    await page.waitForFunction(() => document.querySelector("#onPill") && document.querySelector("#onPill").dataset.st === "ok", null, { timeout: 10000 });
    let m = await mock();
    if (!m.saves.u1 || JSON.parse(m.saves.u1.data).kamas < 4321) fail("la partie n'a pas été envoyée");
    if (m.profiles[0].pseudo !== "Bouftou") fail("pseudo non enregistré");
    // 3. rechargement : écran « Choisis ta partie » (1A), la partie 1 est à jour : un seul « Jouer », pas de question
    await page.reload(); await page.waitForSelector(".svm", { timeout: 10000 });
    if (await page.$(".svm .svver") || await page.$(".sheet .svc")) fail("question inattendue au rechargement");
    if (!/Bouftou/.test(await page.textContent(".svacc")) || !(await page.$('.svm [data-act="sv-logout"]'))) fail("choix des parties : compte connecté absent");
    if (!/Classements/.test(await page.textContent('.svc2[data-slot="1"]')) || !/Solo/.test(await page.textContent('.svc2[data-slot="2"]'))) fail("choix des parties : rôle des parties absent");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/menu.png", fullPage: true }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOTS + "/menu-mob.png", fullPage: true }); await page.setViewportSize(vp); }
    // « Ouvrir directement ma dernière partie » : les rechargements suivants vont droit dans la partie
    await page.click('.svm [data-act="sv-auto"]');
    await page.reload(); await page.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    if (await page.$(".svm")) fail("choix des parties : la case « Ouvrir directement » est ignorée");
    if ((await S()).kamas < 4321) fail("partie perdue au rechargement");
    // 4. autre appareil : la partie en ligne change, celle d'ici n'a pas bougé depuis le dernier envoi -> reprise directe
    await page.evaluate(() => { window.DX.saveNow(); });
    await page.click("#onPill"); await page.waitForTimeout(300);
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const st = JSON.parse(d.saves.u1.data); st.kamas = 99999; st.savedAt = Date.now(); d.saves.u1.data = JSON.stringify(st); d.saves.u1.updated_at = "2099-01-01T00:00:00.000001Z"; d.saves.u1.meta = Object.assign({}, d.saves.u1.meta, { pid: "autre-appareil" }); localStorage.setItem("__mock", JSON.stringify(d)); });
    // la page est rechargée sans laisser le jeu sauvegarder entre-temps
    await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("dofousxen-save-beta-online")); const st = JSON.parse(localStorage.getItem("dofousxen-save-beta")); l.savedAt = st.savedAt + 10 ** 9; localStorage.setItem("dofousxen-save-beta-online", JSON.stringify(l)); });
    await page.reload(); await page.waitForSelector("#nav [data-nk]", { timeout: 10000 }); await page.waitForTimeout(300);
    if ((await S()).kamas < 99999) fail("partie en ligne plus récente non reprise");
    // 5. conflit : les deux ont avancé -> question, on garde celle en ligne
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const st = JSON.parse(d.saves.u1.data); st.kamas = 55555; d.saves.u1.data = JSON.stringify(st); d.saves.u1.updated_at = "2099-01-02T00:00:00.000001Z"; d.saves.u1.meta = Object.assign({}, d.saves.u1.meta, { pid: "autre-appareil-2" }); localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => { window.DX.S.kamas = 11111; });
    await page.click("#onPill");
    await page.waitForSelector('[data-act="on-keepremote"]', { timeout: 10000 });
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/conflit.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOTS + "/conflit-mob.png" }); await page.setViewportSize(vp); }
    await page.click('[data-act="on-keepremote"]'); await page.waitForTimeout(500);
    if ((await S()).kamas < 55555) fail("conflit : version en ligne non chargée");
    // 5 bis. remise imposée : Mathis a remis la partie à une copie (meta.remise) -> la version en ligne est chargée sans question,
    // l'envoi forcé est refusé et l'envoi suivant efface la marque
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const st = JSON.parse(d.saves.u1.data); st.kamas = 33333; d.saves.u1.data = JSON.stringify(st); d.saves.u1.updated_at = "2099-01-02T12:00:00.000001Z"; d.saves.u1.meta = Object.assign({}, d.saves.u1.meta, { pid: "panel", remise: "2099-01-02T12:00:00" }); localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => { window.DX.S.kamas = 22222; });
    await page.click("#onPill"); await page.waitForTimeout(1200);
    if (await page.$('[data-act="on-keepremote"]')) fail("remise imposée : le choix « Deux versions » est encore proposé");
    if ((await S()).kamas !== 33333) fail("remise imposée : version remise non chargée (" + (await S()).kamas + ")");
    await page.evaluate(() => { window.DX.S.kamas = 33334; window.DX.saveNow(); }); await page.click("#onPill"); await page.waitForTimeout(800);
    m = await mock(); if (JSON.parse(m.saves.u1.data).kamas !== 33334 || (m.saves.u1.meta || {}).remise) fail("remise imposée : envoi suivant refusé ou marque restée");
    // 6. conflit au lancement, on garde celle d'ici (envoi forcé)
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.saves.u1.updated_at = "2099-01-03T00:00:00.000001Z"; d.saves.u1.meta = Object.assign({}, d.saves.u1.meta, { pid: "autre-appareil-3" }); localStorage.setItem("__mock", JSON.stringify(d)); window.DX.S.kamas = 77777; window.DX.saveNow(); });
    // 4A : même avec « Ouvrir directement », les deux versions sont montrées dans la carte, la plus avancée marquée
    await page.reload(); await page.waitForSelector('.svc2[data-slot="1"] .svver', { timeout: 10000 });
    if ((await page.$$('.svc2[data-slot="1"] .svver .vl')).length !== 2 || !(await page.$('.svc2[data-slot="1"] .svver .vl.best'))) fail("choix des parties : les deux versions ne sont pas montrées");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/menu-conflit.png", fullPage: true }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOTS + "/menu-conflit-mob.png", fullPage: true }); await page.setViewportSize(vp); }
    await page.click('.svc2[data-slot="1"] [data-act="sv-play"][data-w="local"]'); await page.waitForTimeout(1200);
    m = await mock();
    if (JSON.parse(m.saves.u1.data).kamas < 77777) fail("conflit : version d'ici non envoyée");
    if (!(await page.evaluate(() => JSON.parse(localStorage.getItem("dofousxen-save-beta-copies") || "[]").some((c) => c.why === "enligne")))) fail("conflit : la version en ligne n'est pas gardée en copie de secours");
    // 6 bis (1.0.10.2) : envoi enregistré en ligne mais réponse perdue (serveur lent) -> pas de faux conflit, ni en jeu ni au rechargement
    await page.waitForFunction(() => document.querySelector("#onPill") && document.querySelector("#onPill").dataset.st === "ok", null, { timeout: 10000 });
    await page.evaluate(() => { window.__lostReply = true; window.DX.S.kamas = 88888; window.DX.saveNow(); }); await page.click("#onPill"); await page.waitForTimeout(500);
    if ((await page.$eval("#onPill", (e) => e.dataset.st)) !== "off" && (await page.$eval("#onPill", (e) => e.dataset.st)) !== "offline") fail("réponse perdue : pastille pas hors ligne (" + (await page.$eval("#onPill", (e) => e.dataset.st)) + ")");
    await page.evaluate(() => { window.DX.S.kamas = 88889; window.DX.saveNow(); }); await page.click("#onPill"); await page.waitForTimeout(800);
    if (await page.$('[data-act="on-keeplocal"]')) fail("réponse perdue : faux conflit « Deux versions de ta partie » en jeu");
    if (JSON.parse((await mock()).saves.u1.data).kamas !== 88889) fail("réponse perdue : partie non envoyée après le retour du serveur");
    await page.evaluate(() => { window.__lostReply = true; window.DX.S.kamas = 88890; window.DX.saveNow(); }); await page.click("#onPill"); await page.waitForTimeout(500);
    await page.reload(); await page.waitForSelector("#nav [data-nk]", { timeout: 10000 }); await page.waitForTimeout(400);
    if (await page.$('[data-act="on-keeplocal"]')) fail("réponse perdue : faux conflit au lancement");
    if ((await S()).kamas < 88890) fail("réponse perdue : partie d'ici perdue au lancement");
    // 7. hors ligne : pastille grise, le jeu continue
    await page.evaluate(() => { window.__offline = true; }); await page.click("#onPill"); await page.waitForTimeout(400);
    if ((await page.getAttribute("#onPill", "data-st")) !== "offline") fail("pastille hors ligne absente");
    await page.evaluate(() => { window.__offline = false; });
    // 7b. classements : liste, onglets, profil, record vérifié
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const H = [{ cls: "iop", lvl: 120, ren: 1, name: "Grokk", gear: [] }];
      d.views = { lb_level: [{ user_id: "u9", pseudo: "Kralamour", main: "iop", level: 4812, album: 150, succes: 300, heroes: H }, { user_id: "u8", pseudo: "Tofuline", main: "eni", level: 4650, album: 120, succes: 250, heroes: H }, { user_id: "u7", pseudo: "Bworkman", main: "sacri", level: 4377, album: 90, succes: 200, heroes: H }, { user_id: "u6", pseudo: "Xenerium", main: "cra", level: 4102, album: 80, succes: 150, heroes: H }],
        lb_class: [{ user_id: "u9", pseudo: "Kralamour", cls: "iop", score: 320 }], lb_records: [{ user_id: "u9", pseudo: "Kralamour", main: "iop", did: "x", dname: "Château", k: 10, t: 72 }], lb_week: [], lb_asc: [{ user_id: "u8", pseudo: "Grimpeur", main: "iop", m: window.ENGINE.ascMonth(), cat: "classe", k: "cra", score: 73, at: "2026-10-15T10:00:00Z" }, { user_id: "u8", pseudo: "Grimpeur", main: "iop", m: window.ENGINE.ascMonth(), cat: "classe", k: "iop", score: 40, at: "2026-10-15T09:00:00Z" }],
        firsts: [{ kind: "race11", key: "1", label: "Course de lancement de la 1.1 (L'Ascension) : n° 1 sur 10", pseudo: "Zephyr", user_id: "u7", at: "2026-10-15T17:23:57Z" }, { kind: "lvl200", key: "", label: "Premier héros au niveau 200", pseudo: "Kralamour", user_id: "u9", at: "2026-10-12T10:00:00Z" }, { kind: "job200", key: "tailleur", label: "Premier Tailleur au niveau 200", pseudo: "Kralamour", user_id: "u9", at: "2026-10-12T11:00:00Z" }],
        lb_jobs: [{ user_id: "u9", pseudo: "Kralamour", main: "iop", main_lvl: 200, job: "tous", lvl: 812, xp: 900, alljobs: { tailleur: [200, 0], bijoutier: [190, 500], forgeron: [180, 400], tous: [812, 900] } }, { user_id: "u8", pseudo: "Tofuline", main: "eni", main_lvl: 180, job: "tous", lvl: 640, xp: 10, alljobs: { tailleur: [150, 10] } },
          { user_id: "u9", pseudo: "Kralamour", main: "iop", main_lvl: 200, job: "tailleur", lvl: 200, xp: 0 }, { user_id: "u8", pseudo: "Tofuline", main: "eni", main_lvl: 180, job: "tailleur", lvl: 150, xp: 10 },
          { user_id: "u9", pseudo: "Kralamour", main: "iop", main_lvl: 200, job: "tous_recolte", lvl: 600, xp: 0, alljobs: { paysan: [150, 0], mineur: [140, 0] } }, { user_id: "u8", pseudo: "Tofuline", main: "eni", main_lvl: 180, job: "tous_recolte", lvl: 400, xp: 0, alljobs: { paysan: [90, 0] } }] };
      // 1.0.9 : semaine (u1 = moi, 3e), guildes
      const W = Math.floor((Date.now() / 86400000 + 3) / 7);
      d.views.lb_jobs_week = [{ user_id: "u9", pseudo: "Kralamour", main: "iop", main_lvl: 200, w: W, job: "tous", gain: 90000, lvl: 812, r: 1 }, { user_id: "u8", pseudo: "Tofuline", main: "eni", main_lvl: 180, w: W, job: "tous", gain: 50000, lvl: 640, r: 2 },
        { user_id: "u1", pseudo: "Testeur", main: "iop", main_lvl: 10, w: W, job: "tous", gain: 12000, lvl: 9, r: 3 }, { user_id: "u7", pseudo: "Bworkman", main: "sacri", main_lvl: 150, w: W, job: "tous", gain: 800, lvl: 300, r: 4 }];
      d.views.lb_jobs_guild = [{ guild_id: 1, name: "Les Artisans", ic: "combat", col: "#e0a030", job: "tous", members: 4, lvl: 2100, total: 9000000, best: "Kralamour" }, { guild_id: 2, name: "Bwork Team", ic: "dofus", col: "#30a0e0", job: "tous", members: 2, lvl: 900, total: 2000000, best: "Bworkman" }];
      d.views.lb_jobs_guild_week = [];
      localStorage.setItem("__mock", JSON.stringify(d)); });
    await navClick(page, "ladder");
    // 1.0.5 : l'onglet Course s'ouvre en premier : 10 places, puis les joueurs en course
    await page.waitForSelector("#lbList .rc-slots", { timeout: 10000 });
    if ((await page.$$("#lbList .rc-slot")).length !== 20) fail("course : il faut 10 places pour L'Ascension (1.1) et 10 pour la 1.0");
    // 1.2.3.2 : la course de lancement de L'Ascension (race11, lb_asc cat classe) s'affiche en premier
    { const t = await page.$eval("#lbList", (e) => e.textContent); if (!/Course de lancement de L'Ascension/.test(t) || !/Zephyr/.test(t) || !/Grimpeur/.test(t)) fail("course de L'Ascension absente : " + t.slice(0, 200)); }
    await page.click('[data-act="lb-tab"][data-v="lvl"]');
    await page.waitForSelector(".podium .pod", { timeout: 10000 });
    if ((await page.$$(".lbt .lbr")).length < 2) fail("classement : lignes manquantes (dont la mienne)");
    if (!(await page.$(".pod.is-crea .xtag")) || !(await page.$(".pod .mtag"))) fail("classement : badges créateur et modérateur absents");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/lb.png" });
    // 2.1.12 : classement par classe : niveau + points de Maîtrise (score 320 = niv. 200 et 120 de Maîtrise)
    await page.selectOption('[data-act="lb-cls"]', "iop"); await page.waitForTimeout(500);
    { const t = await page.textContent("#lbList"); if (!/Maîtrise 120/.test(t) || /renaissance/.test(t)) fail("classement par classe : la Maîtrise n'apparaît pas : " + t.slice(0, 200)); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/lb-classe.png" });
    await page.selectOption('[data-act="lb-cls"]', ""); await page.waitForTimeout(300);
    // 1.0.8 : classement des métiers (tuiles, « Tous les métiers », un métier, ma ligne, Premiers)
    await page.click('[data-act="lb-tab"][data-v="job"]'); await page.waitForSelector("#lbList .podium .pod", { timeout: 10000 });
    if ((await page.$$(".jlb-tiles button")).length !== 8) fail("métiers : il faut 8 tuiles (tous + 7 métiers)");
    if (!(await page.$("#lbList .jlb-mini"))) fail("métiers : meilleurs métiers absents sous le nom");
    if (!(await page.$("#lbList .lbr.me"))) fail("métiers : ma ligne absente");
    await page.click('.jlb-tiles [data-v="tailleur"]'); await page.waitForTimeout(400);
    if (!/niv\. 200/.test(await page.textContent("#lbList")) || !(await page.$("#lbList .jlb-bar"))) fail("métiers : classement du Tailleur incorrect");
    await page.click('.pod.p1'); await page.waitForSelector(".sheet .tm", { timeout: 5000 });
    if (!(await page.$(".sheet .jlb-prof"))) fail("métiers : la fiche du joueur ne montre pas ses métiers");
    await page.click('[data-act="closesheet"].btn');
    // 1.0.9 : Récolte (6 tuiles), Forgemagie (7 tuiles), semaine avec l'objectif sur ma ligne, guildes
    await page.click('[data-act="lb-jgrp"][data-v="gather"]'); await page.waitForSelector("#lbList .podium .pod", { timeout: 10000 });
    if ((await page.$$(".jlb-tiles button")).length !== 6 || !/Kralamour/.test(await page.textContent("#lbList"))) fail("métiers : classement de la récolte incorrect");
    await page.click('[data-act="lb-jgrp"][data-v="fm"]'); await page.waitForTimeout(400);
    if ((await page.$$(".jlb-tiles button")).length !== 7) fail("métiers : il faut 7 tuiles en forgemagie");
    await page.click('[data-act="lb-jgrp"][data-v="craft"]'); await page.click('[data-act="lb-jmode"][data-v="week"]'); await page.waitForSelector("#lbList .podium .pod", { timeout: 10000 });
    if (!/\+90 000 XP/.test((await page.textContent("#lbList")).replace(/\s/g, " ")) || !/Métiers de la semaine/.test(await page.textContent("#main"))) fail("métiers : classement de la semaine incorrect");
    if (!/Encore 38 001 XP pour dépasser Tofuline/.test((await page.textContent("#lbList .jlb-podgoal .jlb-goal")).replace(/\s/g, " "))) fail("métiers : objectif « Encore … XP pour dépasser … » absent de ma ligne");
    await page.click('[data-act="lb-jwho"][data-v="g"]'); await page.waitForTimeout(400);
    if (!/Aucune guilde/.test(await page.textContent("#lbList"))) fail("métiers : guildes de la semaine (vide) incorrect");
    await page.click('[data-act="lb-jmode"][data-v="all"]'); await page.waitForSelector("#lbList .lbr.jlb-g", { timeout: 10000 });
    if ((await page.$$("#lbList .lbr.jlb-g .gemb")).length !== 2 || !/2 100 niveaux/.test((await page.textContent("#lbList")).replace(/\s/g, " "))) fail("métiers : classement des guildes incorrect");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/lb-jobs-guild.png" });
    await page.click('[data-act="lb-jwho"][data-v="p"]'); await page.waitForTimeout(300);
    for (const tb of ["dj", "album", "succ", "first", "job", "lvl"]) { await page.click(`[data-act="lb-tab"][data-v="${tb}"]`); await page.waitForTimeout(250); if (/Chargement/.test(await page.textContent("#lbList"))) fail(`classement ${tb} : chargement sans fin`); }
    await page.selectOption('[data-act="lb-cls"]', "iop"); await page.waitForTimeout(250);
    if (!/Kralamour/.test(await page.textContent("#lbList"))) fail("filtre par classe vide");
    await page.click('.pod.p1'); await page.waitForSelector(".sheet .tm", { timeout: 5000 }); await page.click('[data-act="closesheet"].btn');
    await page.evaluate(() => { const S = window.DX.S; const did = Object.keys(window.DATA.DUNGEONS)[0]; S.stasis = S.stasis || {}; S.stasis[did] = { max: 3, sel: 3, firsts: {}, best: { 3: 80 }, sz: window.ENGINE.STASIS_SAISON, sk: 3, st: 80 }; window.DX.saveNow(); });
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const did = Object.keys(window.DATA.DUNGEONS)[0];
      d.views.firsts = (d.views.firsts || []).concat([{ kind: "sb", key: did + ":1", pseudo: "Kralamour", user_id: "u9", at: new Date().toISOString() }]);
      d.views.lb_first_sb = [{ did, k: 1, pseudo: "Kralamour", user_id: "u9", at: new Date().toISOString() }]; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.click("#onPill"); await page.waitForSelector(".bigrec", { timeout: 8000 });
    if (!/Stasis 3/.test(await page.textContent(".bigrec"))) fail("fiche de record incorrecte");
    await page.click('[data-act="lb-goto"]'); await page.waitForTimeout(300);
    // Premiers depuis les sorts des boss : grille des 15 stasis du donjon, puis l'onglet Premiers › Sorts des boss
    await page.click('[data-act="lb-tab"][data-v="first"]'); await page.waitForTimeout(300); await page.click('[data-act="lb-tab"][data-v="dj"]'); await page.click('[data-act="lb-dmode"][data-v="all"]'); await page.waitForSelector("#lbList .sbgrid", { timeout: 5000 });
    if ((await page.$$("#lbList .sbgrid .sbk")).length !== 15 || (await page.$$("#lbList .sbgrid .sbk.on")).length !== 1) fail("Premiers des sorts des boss : grille du donjon incorrecte");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/lb-sb.png", fullPage: true }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOTS + "/lb-sb-mob.png" }); await page.setViewportSize(vp); await page.waitForTimeout(300); }
    await page.click('[data-act="lb-tab"][data-v="first"]'); await page.waitForTimeout(300);
    if (!/Kralamour/.test(await page.textContent("#lbList")) || !/stasis 1/.test(await page.textContent("#lbList"))) fail("Premiers › Sorts des boss : ligne absente");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/lb-first-sb.png", fullPage: true });
    await page.click('[data-act="lb-fview"][data-v="all"]'); await page.waitForTimeout(300);
    m = await mock(); if (!(m.invoked || []).length) fail("record non envoyé au serveur");
    if (!m.verifs) fail("2.1.4 : la partie envoyée n'a pas été vérifiée par le serveur (bouclier)");
    // 1.0.30 : classement du donjon dans sa fiche : top 5 et ma place, équipe de chaque record, Records / Cette semaine, « Classement complet »
    const dgW = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const V = window.VERIFY; const W = V.weekIdx(Date.now()); const did = V.weeklyDungeons(window.DATA.DUNGEONS, W)[0].did;
      const P = [["u9", "Kralamour", "iop", 10, 250, ["iop", "eni", "sacri", "cra"]], ["u8", "Tofuline", "eni", 10, 300, ["eni", "feca"]], ["u7", "Bworkman", "sacri", 9, 200, []], ["u6", "Xenerium", "cra", 8, 400, ["cra", "osa", "eni"]], ["u5", "Nyx", "sram", 8, 450, ["sram"]], ["u4", "Gloubi", "osa", 7, 500, ["osa", "cra"]]];
      d.views.lb_records = (d.views.lb_records || []).concat(P.map(([u, p, c, k, t, team]) => ({ user_id: u, pseudo: p, main: c, did, dname: "x", k, t, team, main_lvl: 150 })), [{ user_id: "u1", pseudo: "Bouftou", main: "iop", did, dname: "x", k: 3, t: 600, team: ["iop"], main_lvl: 20 }]);
      d.views.lb_week = P.slice(0, 2).map(([u, p, c, k, t, team], i) => ({ user_id: u, pseudo: p, main: c, w: W, did, k, t, r: i + 1, team, main_lvl: 150 }));
      localStorage.setItem("__mock", JSON.stringify(d)); Object.keys(window.DX.LB.cache).forEach((k) => delete window.DX.LB.cache[k]); return did; }); // classements déjà vus : oubliés (le faux serveur vient de changer)
    const dgOpen = (did) => page.evaluate((id) => { const o = document.createElement("button"); o.dataset.act = "dgopen"; o.dataset.id = id; o.style.display = "none"; document.querySelector("#main").appendChild(o); o.click(); o.remove(); }, did);
    await dgOpen(dgW); await page.waitForSelector("#dgRank .lbr", { timeout: 8000 }).catch(() => fail("fiche du donjon : classement absent"));
    if ((await page.$$("#dgRank .lbr")).length !== 6 || !(await page.$("#dgRank .lbr.me"))) fail("fiche du donjon : il faut le top 5 et ma place");
    if ((await page.$$("#dgRank .tmini")).length !== 5) fail("fiche du donjon : équipes des records absentes (ou montrées pour un record sans équipe)");
    if (!/top 5 : stasis 9, ou stasis 8 en moins de 7 min 30 s/.test(await page.textContent("#dgRank"))) fail("fiche du donjon : seuil du top 5 absent");
    if (await page.evaluate(() => { const r = document.querySelector("#dgRank"), s = r && r.parentElement.querySelector(".stasisrow"); return !s || !(r.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); })) fail("fiche du donjon : le classement doit être juste au-dessus du choix de la stasis");
    if (!(await page.$('#dgRank [data-act="dgr-mode"][data-v="week"]'))) fail("fiche du donjon : bascule Records / Cette semaine absente (donjon de la semaine)");
    if (process.env.SHOTS) { await page.addStyleTag({ content: "body.shots .wtip{display:none!important}" }); await page.evaluate(() => document.body.classList.add("shots")); await page.$eval("#dgRank", (e) => e.scrollIntoView({ block: "center" })); await page.screenshot({ path: process.env.SHOTS + "/dgrank-pc.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.$eval("#dgRank", (e) => e.scrollIntoView({ block: "center" })); await page.screenshot({ path: process.env.SHOTS + "/dgrank-tel.png" }); await page.setViewportSize(vp); await page.evaluate(() => document.body.classList.remove("shots")); }
    await page.click('#dgRank [data-act="dgr-mode"][data-v="week"]'); await page.waitForFunction(() => document.querySelectorAll("#dgRank .lbr").length === 2, null, { timeout: 8000 }).catch(() => fail("fiche du donjon : classement de la semaine incorrect"));
    if (!/pas encore classé/.test(await page.textContent("#dgRank"))) fail("fiche du donjon : « pas encore classé » absent cette semaine");
    await page.click('#dgRank [data-act="dgr-mode"][data-v="all"]'); await page.waitForTimeout(100);
    if ((await page.$$("#dgRank .lbr")).length !== 6) fail("fiche du donjon : retour aux records (cache) incorrect");
    await page.click('#dgRank [data-act="lb-goto"]'); await page.waitForSelector("#lbList .podium .pod", { timeout: 10000 }).catch(() => fail("fiche du donjon : « Classement complet » ne charge pas le classement"));
    if (await page.$("#sheet .sheet") || (await page.$eval('[data-act="lb-tab"][data-v="dj"]', (e) => e.getAttribute("aria-pressed"))) !== "true" || (await page.$eval('select[data-act="lb-did"]', (e) => e.value)) !== dgW) fail("fiche du donjon : « Classement complet » n'ouvre pas Classements › Donjons sur ce donjon");
    if ((await page.$$("#lbList .lbt .tmini")).length !== 4) fail("classement des donjons : équipes des records absentes");
    // 1.0.30 : un Dofus tombé sur un boss est noté, puis demandé au serveur pour la GIGA annonce une fois la partie envoyée
    const gq = await page.evaluate(async () => { const E = window.ENGINE, S = window.DX.S; const id = E.DOFUS_ORDER.find((x) => E.DOFUS[x].dg && !(E.DOFUS[x].steps[0] && E.DOFUS[x].steps[0].t === "gift"));
      const c0 = E.celebrate; let n = 0; E.celebrate = null; E.setRng(() => (n++ ? 0.99 : 0));
      try { E.dofusDrop(S, E.DOFUS[id].dg, 7, []); } finally { E.setRng(Math.random); E.celebrate = c0; }
      const q = (window.ONLINE.link().dofq || []).slice(); await window.GIGA.flush(); q.forEach((x) => delete S.items[x.uid]);
      return { q, left: (window.ONLINE.link().dofq || []).length }; });
    m = await mock();
    if (gq.q.length !== 1 || !(m.dofusSent || []).length || m.dofusSent[0].uid !== gq.q[0].uid || m.dofusSent[0].k !== 7 || gq.left) fail(`GIGA annonce : Dofus tombé non demandé au serveur (${JSON.stringify([gq, m.dofusSent])})`);
    // 7c. chat : lecture, envoi, refus d'un lien, objet montré, menu d'un joueur, signalement, ignorer, privé
    await page.evaluate(() => { const S = window.DX.S; S.settings.snd = Object.assign({}, S.settings.snd, { asked: true, nv13: true }); document.querySelectorAll("#sndask").forEach((x) => x.remove()); }); // la bulle « Jouer en musique ? » ne cache pas les onglets du chat
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const t = new Date().toISOString();
      d.views.chat_msgs = [{ id: 1, ch: "g", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, title: "Maître de la semaine", body: "Salut !", kind: "msg", created_at: t },
        { id: 2, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, kind: "ann", data: { t: "first", label: "Premier héros au niveau 200" }, created_at: t }];
      d.views.chat_settings = [{ id: 1, pin_body: "💡 Une idée pour améliorer Idlus ? Partagez-la ici ou dans la Boîte à idées !", pin_chs: "g", pin_at: "2026-10-13T10:00:00Z" }];
      localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.CHAT.refresh()); await page.waitForSelector("#chat .chmin", { timeout: 5000 });
    await page.click("#chat .chmin"); await page.waitForSelector("#chat .ch-list .msg", { timeout: 5000 });
    // 0.1.50.2 : message épinglé en haut du Général (ampoule du jeu à la place de l'emoji), absent du Commerce, la croix le cache jusqu'au lendemain
    if (!(await page.$("#chat .ch-pin .pi"))) fail("chat : message épinglé absent du Général");
    else if (/💡/.test(await page.textContent("#chat .ch-pin")) || !/Une idée pour améliorer Idlus \?/.test(await page.textContent("#chat .ch-pin b"))) fail("chat : message épinglé mal affiché");
    if (!(await page.$('#chat .ch-pin [data-act="nav"][data-v="sugg"]'))) fail("chat : bouton Boîte à idées absent du message épinglé");
    await page.click('#chat [data-act="ch-tab"][data-v="c"]'); await page.waitForTimeout(100);
    if (await page.$("#chat .ch-pin")) fail("chat : message épinglé dans le Commerce");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(100);
    await page.click('#chat [data-act="ch-pinx"]'); await page.waitForTimeout(100);
    if (await page.$("#chat .ch-pin")) fail("chat : message épinglé toujours là après la croix");
    // 1.0.9.1 : chargement raté (serveur lent) → le chat réessaie au lieu de rester sur « Connexion au chat… »
    await page.evaluate(() => { window.__chatFail = true; window.CHAT.state.loaded = false; return window.CHAT.refresh(); });
    if (!/reconnexion automatique/.test(await page.textContent("#chat .ch-list"))) fail("chat : pas de message de nouvel essai quand le serveur est lent");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/chat-essai.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOTS + "/chat-essai-mob.png" }); await page.setViewportSize(vp); }
    await page.evaluate(() => { window.__chatFail = false; }); await page.click('#chat [data-act="ch-retry"]');
    await page.waitForSelector("#chat .ch-list .msg", { timeout: 5000 }).catch(() => fail("chat : « Réessayer maintenant » ne recharge pas les messages"));
    await page.evaluate(() => { window.__chatFail = true; return window.CHAT.refresh(); });
    if (!(await page.$("#chat .ch-list .msg"))) fail("chat : un rechargement raté efface les messages déjà affichés");
    await page.evaluate(() => { window.__chatFail = false; });
    // 1.0.10.2 : direct coupé (panne Supabase Realtime) → ligne d'explication, qui disparaît au retour du direct
    await page.evaluate(() => { window.__chatSub("CHANNEL_ERROR"); window.CHAT.repaint(); });
    if (!/Chat en direct perturbé/.test(await page.textContent("#chat .ch-list"))) fail("chat : pas d'explication quand le direct est coupé");
    await page.evaluate(() => { window.__chatSub("SUBSCRIBED"); window.CHAT.repaint(); });
    if (/Chat en direct perturbé/.test(await page.textContent("#chat .ch-list"))) fail("chat : explication restée après le retour du direct");
    // 0.1.33.2 : les hauts faits ont leur onglet, le Général ne garde que les joueurs et les annonces officielles
    if (/entre dans l'histoire/.test(await page.textContent("#chat .ch-list"))) fail("chat : haut fait encore dans le Général");
    await page.click('#chat [data-act="ch-tab"][data-v="h"]'); await page.waitForTimeout(100);
    if (!/entre dans l'histoire/.test(await page.textContent("#chat .ch-list"))) fail("chat : haut fait absent de l'onglet Hauts faits");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-hf.png" });
    // 0.1.35.3 : le bouton pour réduire le chat reste dans le cadre, même avec tous les onglets et des pastilles
    if (await page.evaluate(() => { const C = window.CHAT.state; C.unread = 120; C.unreadP = 15; C.unreadH = 99; window.CHAT.repaint(); const c = document.querySelector("#chat").getBoundingClientRect(), x = document.querySelector("#chat .ch-x").getBoundingClientRect(); C.unread = C.unreadP = C.unreadH = 0; window.CHAT.repaint(); return x.right > c.right || x.left < c.left; })) fail("chat : bouton de fermeture hors du cadre (PC)");
    // 0.1.48.2 : salons Commerce et PvP
    await page.click('#chat [data-act="ch-tab"][data-v="c"]'); await page.waitForSelector("#chIn");
    if (!/Commerce : achat/.test(await page.textContent("#chat .ch-list"))) fail("chat : salon Commerce absent");
    await page.fill("#chIn", "Je vends une Coiffe Bouftou"); await page.press("#chIn", "Enter"); await page.waitForTimeout(400);
    if (!(await mock()).views.chat_msgs.some((x) => x.ch === "c" && /Coiffe Bouftou/.test(x.body))) fail("chat : message de commerce non envoyé dans le bon salon");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-commerce.png" });
    await page.click('#chat [data-act="ch-tab"][data-v="v"]'); await page.waitForTimeout(100);
    if (!/PvP : Kolizéum/.test(await page.textContent("#chat .ch-list"))) fail("chat : salon PvP absent");
    await page.evaluate(() => window.__chatEmit({ id: 777, ch: "v", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, kind: "ann", data: { t: "koli", g: 3, cote: 1520 }, created_at: new Date().toISOString() })); await page.waitForTimeout(100);
    if (!/grade/.test(await page.textContent("#chat .ch-list"))) fail("chat : annonce du Kolizéum absente du salon PvP");
    // 1.0.30 : GIGA annonce d'un Dofus : plein écran chez tous (le Dofus en grand, qui, où, sa chance), puis une ligne dans le Général
    const giga = await page.evaluate(() => { const E = window.ENGINE, D = window.DATA; const id = E.DOFUS_ORDER.find((x) => E.DOFUS[x].dg && D.DUNGEONS[E.DOFUS[x].dg]); const did = E.DOFUS[id].dg;
      window.__chatEmit({ id: 778, ch: "g", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, kind: "ann", data: { t: "giga", id, did, dname: D.DUNGEONS[did].name, boss: D.MONSTERS[D.DUNGEONS[did].boss].name, k: 7, odds: 6400 }, created_at: new Date().toISOString() });
      return { name: E.DOFUS[id].name, dname: D.DUNGEONS[did].name }; });
    await page.waitForSelector("#giga .giga-t", { timeout: 3000 }).catch(() => fail("GIGA annonce : pas de plein écran à la réception"));
    if (await page.$("#giga")) {
      const gt = (await page.textContent("#giga")).replace(/\s+/g, " ");
      if (!gt.includes(giga.name.toUpperCase()) || !/Kralamour/.test(gt) || !gt.includes(giga.dname) || !/1 chance sur 6 400 par héros · stasis 7/.test(gt)) fail(`GIGA annonce : Dofus, joueur, lieu ou chance absents (${gt})`);
      if (process.env.SHOTS) { await page.evaluate(() => document.body.classList.add("shots")); await page.waitForTimeout(800); await page.screenshot({ path: process.env.SHOTS + "/giga-pc.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOTS + "/giga-tel.png" }); await page.setViewportSize(vp); await page.evaluate(() => document.body.classList.remove("shots")); }
      await page.click('#giga .btn[data-act="giga-x"]'); await page.waitForTimeout(100);
      if (await page.$("#giga")) fail("GIGA annonce : « Fermer » ne la ferme pas");
    }
    await page.evaluate(() => window.__chatEmit({ id: 778, ch: "g", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, kind: "ann", data: { t: "giga", id: window.ENGINE.DOFUS_ORDER[0], did: "x", k: 7 }, created_at: new Date().toISOString() }));
    await page.evaluate(() => window.__chatEmit({ id: 779, ch: "g", user_id: "u9", pseudo: "Kralamour", cls: "iop", lvl: 200, kind: "ann", data: { t: "giga", id: window.ENGINE.DOFUS_ORDER[0], did: "x", k: 7 }, created_at: new Date(Date.now() - 600000).toISOString() }));
    await page.waitForTimeout(500);
    if (await page.$("#giga")) fail("GIGA annonce : remontrée deux fois, ou montrée alors qu'elle est vieille de 10 min");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(100);
    if (!(await page.$("#chat .ch-list .ann.giga-ann")) || !new RegExp(`obtient le ${giga.name}`).test(await page.textContent("#chat .ch-list"))) fail("GIGA annonce : ligne absente du Général");
    else { await page.click("#chat .ch-list .ann.giga-ann"); await page.waitForSelector("#giga", { timeout: 2000 }).catch(() => fail("GIGA annonce : un clic sur la ligne du Général ne la remontre pas")); await page.keyboard.press("Escape"); await page.waitForTimeout(100); if (await page.$("#giga")) fail("GIGA annonce : Échap ne la ferme pas"); }
    await page.click('#chat [data-act="ch-tab"][data-v="h"]'); await page.waitForTimeout(100);
    if (await page.$("#chat .ch-list .giga-ann")) fail("GIGA annonce : rangée dans les Hauts faits au lieu du Général");
    await page.click('#chat [data-act="ch-tab"][data-v="v"]'); await page.waitForTimeout(100);
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(4200); // le Général garde son rythme de 4 s
    // 0.1.47.6 : chat ouvert, les notifications s'écartent ; pendant qu'on écrit, elles attendent
    await page.evaluate(() => window.DX.social.toast("Test de notification"));
    if (await page.evaluate(() => { const t = document.querySelector("#toasts").getBoundingClientRect(), c = document.querySelector("#chat").getBoundingClientRect(); return t.right > c.left; })) fail("notifications : elles recouvrent le chat (PC)");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/notif-pc.png" });
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForSelector("#chIn");
    await page.fill("#chIn", "Je suis en train d'écrire"); await page.focus("#chIn");
    await page.evaluate(() => { document.querySelectorAll("#toasts .toast").forEach((e) => e.remove()); window.DX.social.toast("Pendant la frappe"); });
    if (await page.$("#toasts .toast")) fail("notifications : affichées pendant qu'on écrit");
    await page.fill("#chIn", ""); await page.waitForTimeout(900);
    if (!/Pendant la frappe/.test(await page.textContent("#toasts"))) fail("notifications : pas rendues une fois le champ vidé");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(100);
    // 0.1.29.1 : badge du créateur (liste donnée par le serveur)
    if (!(await page.$("#chat .msg.is-crea .xen .crown")) || !/Créateur/.test(await page.textContent("#chat .msg.is-crea"))) fail("chat : badge du créateur absent");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat.png" });
    await page.fill("#chIn", "va sur www.test.fr"); await page.press("#chIn", "Enter"); await page.waitForSelector("#chat .ch-hint .bad", { timeout: 5000 });
    await page.fill("#chIn", "Bonjour à tous"); await page.press("#chIn", "Enter"); await page.waitForTimeout(400);
    if (!/Bonjour à tous/.test(await page.textContent("#chat .ch-list"))) fail("chat : message envoyé absent");
    await page.evaluate(() => { const m = { id: 50, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Coucou en direct", kind: "msg", created_at: new Date().toISOString() };
      const d = JSON.parse(localStorage.getItem("__mock")); d.views.chat_msgs.push(m); localStorage.setItem("__mock", JSON.stringify(d)); window.__chatEmit(m); }); await page.waitForTimeout(200);
    if (!/Coucou en direct/.test(await page.textContent("#chat .ch-list"))) fail("chat : message en temps réel absent");
    // 1.0.3.3 : copier-coller au téléphone — un message reçu ne recrée pas la zone d'écriture (clavier et bulle « Coller » gardés),
    // ne coupe pas un texte surligné, et le menu du pseudo propose « Copier le message »
    await page.fill("#chIn", "texte collé"); await page.focus("#chIn"); await page.evaluate(() => { window.__in = document.querySelector("#chIn"); });
    // (le message est aussi sur le faux serveur, comme en vrai : un rechargement du chat qui tombe au même moment le garde)
    await page.evaluate(() => { const m = { id: 51, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Pendant que tu colles", kind: "msg", created_at: new Date().toISOString() };
      const d = JSON.parse(localStorage.getItem("__mock")); d.views.chat_msgs.push(m); localStorage.setItem("__mock", JSON.stringify(d)); window.__chatEmit(m); }); await page.waitForTimeout(100);
    if (!(await page.evaluate(() => window.__in === document.querySelector("#chIn") && document.activeElement === window.__in && window.__in.value === "texte collé"))) fail("chat : la zone d'écriture est recréée à chaque message reçu");
    if (!/Pendant que tu colles/.test(await page.textContent("#chat .ch-list"))) fail("chat : message reçu absent pendant l'écriture");
    await page.fill("#chIn", "");
    await page.evaluate(() => { const tx = [...document.querySelectorAll("#chat .msg .tx")].find((e) => /Coucou en direct/.test(e.textContent)); const r = document.createRange(); r.selectNodeContents(tx); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    // 1.0.30 : le message est aussi rangé sur le faux serveur (comme le 51), sinon un rechargement du chat pendant la copie le faisait disparaître (test instable)
    await page.evaluate(() => { const m = { id: 52, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Pendant que tu copies", kind: "msg", created_at: new Date().toISOString() };
      const d = JSON.parse(localStorage.getItem("__mock")); d.views.chat_msgs.push(m); localStorage.setItem("__mock", JSON.stringify(d)); window.__chatEmit(m); }); await page.waitForTimeout(100);
    if ((await page.evaluate(() => String(getSelection()))) !== "Coucou en direct") fail("chat : un message reçu efface le texte surligné");
    await page.evaluate(() => getSelection().removeAllRanges()); await page.waitForTimeout(150);
    if (!/Pendant que tu copies/.test(await page.textContent("#chat .ch-list"))) fail("chat : message reçu pendant la copie jamais affiché");
    await page.evaluate(() => [...document.querySelectorAll('#chat [data-act="ch-who"]')].find((b) => b.dataset.id === "50").click());
    if (!(await page.$('#chMenu [data-act="ch-copy"]'))) fail("chat : « Copier le message » absent du menu");
    else { await page.click('#chMenu [data-act="ch-copy"]'); await page.waitForTimeout(150); if (!/copi/i.test(await page.textContent("#toasts"))) fail("chat : copie du message sans retour"); }
    // 0.1.53.7 : mentions @pseudo — surlignées, pastille « @ » sur le salon où l'on est mentionné, suggestions de pseudos en tapant « @ »
    await page.evaluate(() => { const me = window.ONLINE.profile.pseudo; const t = new Date().toISOString();
      window.__chatEmit({ id: 5000, ch: "c", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: `@${me} je t'achète ta coiffe`, kind: "msg", created_at: t });
      window.__chatEmit({ id: 5001, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: `Salut @${me.toLowerCase()} et @Kralamour !`, kind: "msg", created_at: t }); }); await page.waitForTimeout(150);
    if (!(await page.$('#chat [data-act="ch-tab"][data-v="c"] .n.at'))) fail("chat : pas de pastille @ sur le Commerce après une mention");
    if (!(await page.$("#chat .msg.ment .mt.me")) || !(await page.$("#chat .msg.ment .mt:not(.me)"))) fail("chat : mention mal surlignée");
    await page.click('#chat [data-act="ch-tab"][data-v="c"]'); await page.waitForTimeout(100);
    if (!(await page.$("#chat .msg.ment"))) fail("chat : message qui me mentionne pas mis en évidence (Commerce)");
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(100);
    if (await page.$('#chat [data-act="ch-tab"][data-v="c"] .n.at')) fail("chat : pastille @ encore là après lecture");
    await page.fill("#chIn", ""); await page.type("#chIn", "Coucou @tof"); await page.waitForTimeout(100);
    if (!/Tofuline/.test((await page.textContent("#chAc")) || "")) fail("chat : pseudo non proposé en tapant @");
    await page.press("#chIn", "Tab"); if ((await page.inputValue("#chIn")) !== "Coucou @Tofuline ") fail("chat : la suggestion ne complète pas le pseudo");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-mention.png" });
    await page.fill("#chIn", "");
    // 0.1.31.1 : le chat garde la position de lecture quand il se redessine, et signale les nouveaux messages
    await page.evaluate(() => { const C = window.CHAT.state; for (let i = 0; i < 40; i++) C.g.push({ id: 500 + i, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Ligne " + i, kind: "msg", created_at: new Date().toISOString() }); window.CHAT.repaint(); document.querySelector("#chat .ch-list").scrollTop = 120; window.CHAT.repaint(); });
    if ((await page.evaluate(() => document.querySelector("#chat .ch-list").scrollTop)) !== 120) fail("chat : la lecture remonte quand le chat se redessine");
    await page.evaluate(() => window.__chatEmit({ id: 600, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Plus bas", kind: "msg", created_at: new Date().toISOString() })); await page.waitForTimeout(100);
    if (!(await page.$("#chat .ch-new"))) fail("chat : bouton « Nouveaux messages » absent"); else { await page.click("#chat .ch-new"); if (await page.evaluate(() => { const l = document.querySelector("#chat .ch-list"); return l.scrollTop + l.clientHeight < l.scrollHeight - 30; })) fail("chat : « Nouveaux messages » ne descend pas"); }
    await page.evaluate(() => { const tpl = Object.keys(window.DATA.ITEMS)[0]; window.DX.social.itemSheet(tpl); }); await page.click('[data-act="ch-share"]');
    await page.waitForSelector("#chat .ch-att", { timeout: 3000 }); await page.waitForTimeout(4000); await page.click('[data-act="ch-send"]'); await page.waitForTimeout(400);
    if (!(await page.$("#chat .ch-list .itm"))) fail("chat : objet montré absent");
    await page.click('#chat .ps[data-u="u9"]'); await page.waitForSelector("#chMenu", { timeout: 3000 }); await page.click('#chMenu [data-act="ch-rep"]');
    await page.waitForSelector('[data-act="ch-repgo"]', { timeout: 3000 }); await page.click('[data-act="ch-repgo"]'); await page.waitForTimeout(500);
    m = await mock(); if (!(m.reports || []).length) fail("chat : signalement non envoyé");
    if (/Salut !/.test(await page.textContent("#chat .ch-list"))) fail("chat : joueur ignoré encore visible");
    await page.click('#chat .ps[data-u="u8"]'); await page.click('#chMenu [data-act="ch-pm"]'); await page.waitForTimeout(4200);
    await page.fill("#chIn", "Message privé"); await page.press("#chIn", "Enter"); await page.waitForTimeout(400);
    m = await mock(); if (!m.views.chat_msgs.some((x) => x.ch === "p" && x.to_id === "u8")) fail("chat : message privé non envoyé");
    // 7d. panel admin
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.role = "admin"; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.CHAT.refresh()); await page.waitForSelector('#status [data-act="adm-open"]', { timeout: 5000 });
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector(".adm .kpis", { timeout: 5000 });
    if (!(await page.$('.adm [data-act="adm-test"]'))) fail("panel admin : bouton Panel de test absent"); // 1.0.8.2
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    await page.click('.adm [data-act="adm-tab"][data-v="joueurs"]'); await page.waitForSelector('.adm [data-act="adm-sel"]', { timeout: 5000 });
    await page.click('.adm [data-act="adm-sel"]'); await page.waitForSelector(".adm .fiche", { timeout: 5000 });
    await page.click('.adm [data-act="adm-mute"][data-v="60"]'); await page.waitForTimeout(400);
    // 2.1.4 « Bouclier du serveur » (4A) : onglet En vérification › Détails : raisons, ventes, remettre la partie à un jour
    await page.click('.adm [data-act="adm-tab"][data-v="verif"]'); await page.waitForSelector('.adm [data-act="adm-bdet"]', { timeout: 5000 });
    await page.click('.adm [data-act="adm-bdet"]'); await page.waitForSelector('.adm .bq-det [data-act="adm-brest"]', { timeout: 5000 });
    if (!/Partie retenue/.test(await page.textContent(".adm .bq-det")) || !/Tofuline/.test(await page.textContent(".adm .bq-det"))) fail("bouclier : détails incomplets dans le panel");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/bouclier-pc.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); const cx = await page.$('#chat [data-act="ch-close"]'); if (cx) { await cx.click(); await page.waitForTimeout(300); } await page.evaluate(() => { const e = document.querySelector(".adm .bq-det"); if (e) e.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOTS + "/bouclier-mob.png" }); await page.setViewportSize(vp); await page.waitForTimeout(200); if (cx) { const op = await page.$('[data-act="ch-open"]'); if (op) { await op.click(); await page.waitForTimeout(300); } } }
    page.once("dialog", (dg) => dg.accept()); await page.click('.adm .bq-det [data-act="adm-brest"]'); await page.waitForTimeout(500);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_save_restore" && x[1].p_user === "u9")) fail("bouclier : remise en arrière non envoyée");
    await page.click('.adm [data-act="adm-tab"][data-v="ann"]'); await page.waitForSelector("#admAnn", { timeout: 5000 });
    await page.fill("#admAnn", "Maintenance ce soir"); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(600);
    // 1.2.10.1 : tous les droits de Mathis sur le chat : supprimer un message, sanctions depuis le pseudo, fermer le chat
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.waitForTimeout(200);
    await page.click('#chat .ps[data-u="u8"]'); await page.waitForSelector('#chMenu [data-act="adm-del"]', { timeout: 5000 });
    if (!(await page.$('#chMenu [data-act="adm-mute"][data-v="10080"]')) || !(await page.$('#chMenu [data-act="adm-ban"]'))) fail("chat admin : sanctions absentes du menu du pseudo");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/chat-admin.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.click('#chat .ps[data-u="u8"]'); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOTS + "/chat-admin-mob.png" }); await page.setViewportSize(vp); await page.waitForTimeout(300); await page.click('#chat .ps[data-u="u8"]'); await page.waitForSelector('#chMenu [data-act="adm-del"]'); }
    const delId = +(await page.getAttribute('#chMenu [data-act="adm-del"]', "data-id")); await page.click('#chMenu [data-act="adm-del"]'); await page.waitForTimeout(500);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_msg_del" && x[1].p_id === delId)) fail("chat admin : suppression non envoyée");
    if (await page.$(`#chat [data-id="${delId}"]`)) fail("chat admin : message supprimé encore affiché");
    await page.click('.adm [data-act="adm-tab"][data-v="vue"]'); await page.waitForSelector('.adm [data-act="adm-chclose"]', { timeout: 5000 });
    await page.click('.adm [data-act="adm-chclose"][data-v="1"]'); await page.waitForTimeout(500);
    m = await mock(); if (!m.chatClosed) fail("chat admin : fermeture du chat non envoyée");
    if (!(await page.$('.adm [data-act="adm-chclose"][data-v="0"]'))) fail("chat admin : bouton Rouvrir absent");
    await page.click('.adm [data-act="adm-chclose"][data-v="0"]'); await page.waitForTimeout(500);
    await page.click('.adm [data-act="adm-tab"][data-v="ann"]'); await page.waitForSelector("#admPin", { timeout: 5000 });
    m = await mock(); const calls = (m.admCalls || []).map((x) => x[0]);
    if (!calls.includes("adm_mute") || !calls.includes("adm_announce")) fail("panel admin : actions non envoyées " + calls.join(","));
    if (!/Maintenance ce soir/.test(await page.textContent("#annbar"))) fail("panel admin : bandeau d'annonce absent");
    // 0.1.50.2 : le message épinglé se change dans l'onglet Annonces, et revient chez le joueur qui l'avait fermé
    await page.fill("#admPin", "Nouveau texte épinglé ! Venez sur le Discord."); await page.check("#admPinc"); await page.click('[data-act="adm-pin"]'); await page.waitForTimeout(600);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_pin" && x[1].p_chs === "g,c")) fail("panel admin : message épinglé non envoyé");
    await page.evaluate(() => { window.CHAT.state.tab = "c"; window.CHAT.repaint(); });
    if (!(await page.$("#chat .ch-pin")) || !/Nouveau texte épinglé/.test(await page.textContent("#chat .ch-pin"))) fail("chat : nouveau message épinglé absent après le changement");
    // 1.1.2.4 : annonce en boucle : lancée depuis l'onglet Annonces, elle part tout de suite dans le bandeau et se met en pause
    await page.fill("#admLoop", "Rejoignez le Discord d'Idlus !"); await page.selectOption("#admLoopE", "60"); await page.click('[data-act="adm-loop"]'); await page.waitForTimeout(800);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_loop_save" && x[1].p_every === 60 && x[1].p_now && x[1].p_body === "Rejoignez le Discord d'Idlus !")) fail("annonces en boucle : boucle non envoyée");
    if (!/Rejoignez le Discord/.test(await page.textContent("#annbar"))) fail("annonces en boucle : bandeau absent après le lancement");
    if (!/toutes les 1 h/.test(await page.textContent(".adm"))) fail("annonces en boucle : boucle absente de la liste");
    if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/annonces-boucle.png", fullPage: true }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOTS + "/annonces-boucle-mob.png", fullPage: true }); await page.setViewportSize(vp); }
    await page.click('[data-act="adm-loopon"][data-v="0"]'); await page.waitForTimeout(500);
    if (!/en pause/.test(await page.textContent(".adm"))) fail("annonces en boucle : pause non prise");
    // 1.2.8 : pluie de kamas : Xener la lance depuis l'onglet Annonces (avec confirmation), un joueur participe depuis l'accueil puis reçoit sa part
    const rk0 = await page.evaluate(() => window.DX.S.kamas);
    await page.evaluate(() => { window.DX.S.kamas = 1e6; window.PLUIE.P.f.total = ""; window.CHAT.repaintAdmin(); }); await page.waitForSelector("#plTot", { timeout: 5000 });
    await page.fill("#plTot", "5000"); await page.click('[data-act="pl-open"]'); await page.waitForSelector('[data-act="pl-open"][data-v="1"]', { timeout: 3000 });
    await page.click('[data-act="pl-open"][data-v="1"]'); await page.waitForTimeout(800);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_rain_open" && x[1].p_total === 5000 && x[1].p_min === 5 && x[1].p_announce === true)) fail("pluie de kamas : lancement non envoyé");
    if (!/En cours/.test(await page.textContent("#plAdm"))) fail("pluie de kamas : pluie en cours absente du panel");
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.rain.mine = false; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.PLUIE.poll()); await page.waitForSelector("#plpill", { timeout: 3000 });
    if (process.env.SHOTS) { await page.evaluate(() => { document.querySelectorAll("#wtip,#sndask").forEach((w) => w.remove()); }); await page.screenshot({ path: process.env.SHOTS + "/pluie-pastille.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOTS + "/pluie-pastille-mob.png" }); await page.setViewportSize(vp); }
    await page.evaluate(() => { window.DX.ui.tab = "home"; window.DX.ui.home = "apercu"; window.DX.render(); }); await page.waitForSelector('.pl-card [data-act="pl-join"]', { timeout: 3000 }); await page.waitForTimeout(1200);
    if (await page.$("#plpill")) fail("pluie de kamas : pastille affichée en plus de la carte sur l'accueil");
    if (process.env.SHOTS) { await page.evaluate(() => { document.querySelectorAll("#wtip,#sndask").forEach((w) => w.remove()); const c = document.querySelector(".pl-card"); scrollTo(0, Math.max(0, c.getBoundingClientRect().top + scrollY - 120)); }); await page.screenshot({ path: process.env.SHOTS + "/pluie-avant.png" }); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await page.evaluate(() => { const c = document.querySelector(".pl-card"); scrollTo(0, Math.max(0, c.getBoundingClientRect().top + scrollY - 120)); }); await page.screenshot({ path: process.env.SHOTS + "/pluie-avant-mob.png" }); await page.setViewportSize(vp); }
    await page.click('.pl-card [data-act="pl-join"]'); await page.waitForTimeout(800);
    if (!/Tu participes/.test(await page.textContent(".pl-card"))) fail("pluie de kamas : participation non affichée");
    if (process.env.SHOTS) { const shot = async (f) => { await page.evaluate(() => { document.querySelectorAll("#wtip,#sndask").forEach((w) => w.remove()); const c = document.querySelector(".pl-card"); scrollTo(0, Math.max(0, c.getBoundingClientRect().top + scrollY - 120)); }); await page.screenshot({ path: process.env.SHOTS + f }); };
      await shot("/pluie-accueil.png"); const vp = page.viewportSize(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await shot("/pluie-accueil-mob.png"); await page.setViewportSize(vp); }
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); Object.assign(d.rain, { st: "done", share: 5000 }); localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.PLUIE.poll()); await page.waitForTimeout(300);
    if (!/\+5[\s\u202f\u00a0]?000 kamas/.test(await page.textContent(".pl-card"))) fail("pluie de kamas : part reçue non affichée : " + await page.textContent(".pl-card"));
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); delete d.rain; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.PLUIE.poll()); await page.waitForTimeout(300);
    if (await page.$(".pl-card")) fail("pluie de kamas : carte encore là sans pluie");
    await page.evaluate((k) => { window.DX.S.kamas = k; }, rk0);
    await page.evaluate(() => window.CHAT.openAdmin("vue")); await page.waitForSelector(".adm .kpis", { timeout: 5000 });
    // 1.0.5.2 : codes cadeaux, la liste de choix reste ouverte quand le panel se redessine
    await page.click('.adm [data-act="adm-tab"][data-v="codes"]'); await page.waitForSelector("#gcCode", { timeout: 5000 });
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // 1.0.30 : le menu a deux pages de plus, la bulle « Équiper un objet » descend sur le bouton
    await page.click('[data-act="gc-add"]'); await page.waitForSelector("#gcN1"); await page.click("#gcN1"); await page.keyboard.type("coffr"); await page.waitForTimeout(300);
    await page.evaluate(() => window.CHAT.repaintAdmin()); await page.waitForTimeout(200);
    if (!(await page.evaluate(() => document.activeElement.id === "gcN1" && document.activeElement.value === "coffr" && document.querySelectorAll(".gc-sug:not([hidden]) .gc-opt").length > 0))) fail("codes cadeaux : la liste de choix se referme au redessin");
    await page.click(".gc-sug .gc-opt"); await page.waitForTimeout(300);
    if (!/^Coffre/.test(await page.inputValue("#gcN1")) || !/Coffre/.test(await page.textContent(".gc-card"))) fail("codes cadeaux : choix dans la liste non pris");
    // 1.1.1.4 : tout le reste dans les codes : une monture et des Kolizetons s'ajoutent et s'affichent dans l'aperçu
    await page.click('[data-act="gc-add"]'); await page.waitForSelector("#gcT2"); await page.selectOption("#gcT2", "x:mt"); await page.waitForSelector("#gcN2");
    await page.click("#gcN2"); await page.keyboard.type("Dragodinde Rous"); await page.waitForTimeout(300); await page.click("#gcN2 ~ .gc-sug .gc-opt"); await page.waitForTimeout(300);
    await page.click('[data-act="gc-add"]'); await page.waitForSelector("#gcT3"); await page.selectOption("#gcT3", "x:m"); await page.waitForSelector("#gcN3");
    await page.click("#gcN3"); await page.keyboard.type("Kolizet"); await page.waitForTimeout(300); await page.click("#gcN3 ~ .gc-sug .gc-opt"); await page.fill("#gcQ3", "40"); await page.waitForTimeout(400);
    { const t = await page.textContent(".gc-card"); if (!/monture Dragodinde Rousse/.test(t) || !/40 Kolizetons/.test(t)) fail("codes cadeaux : monture ou monnaie absente de l'aperçu : " + t); }
    await page.click('.adm [data-act="adm-tab"][data-v="hdv"]'); await page.waitForSelector('.adm [data-act="mk-admdel"]', { timeout: 5000 });
    // 0.1.52.1 : fiches joueurs (réservées à l'admin), avec la partie lue par le jeu
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // 1.0.12.8 : chat ouvert à 1280 px, le menu en icônes laisse la bulle « Découverte » sur la liste des joueurs
    await page.click('.adm [data-act="adm-tab"][data-v="fiches"]'); await page.waitForSelector('.adm [data-act="fj-sel"]', { timeout: 5000 });
    await page.click('.adm [data-act="fj-sel"]'); await page.waitForSelector(".adm .fj-hero", { timeout: 5000 });
    { const tx = await page.textContent(".adm .fj-main"); if (!/Les Tofus/.test(tx) || !/Quête principale/.test(tx) || !/Kolizéum/.test(tx)) fail("fiches joueurs : fiche incomplète"); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/fiche.png", fullPage: true });
    // 7d bis (0.1.36). boîte à idées : envoi depuis Communauté › Suggestions, puis lecture dans le panel admin
    await page.evaluate(() => window.scrollTo(0, 0));
    await navClick(page, "sugg"); await page.waitForSelector("#idTitle", { timeout: 5000 });
    await page.click('[data-act="id-send"]'); await page.waitForTimeout(200);
    if (!/Choisis ce que ton idée concerne/.test(await page.textContent("#main"))) fail("idées : envoi sans catégorie accepté");
    await page.click('[data-act="id-tag"][data-v="Contenu"]'); await page.fill("#idTitle", "Un donjon pour le Bouftou Royal"); await page.fill("#idBody", "Un petit donjon niveau 20 à Astrub avec le Bouftou Royal en boss.");
    await page.click('[data-act="id-send"]'); await page.waitForSelector(".sheet", { timeout: 5000 });
    if (!/ton idée est partie/.test(await page.textContent(".sheet"))) fail("idées : pas de remerciement");
    await page.click('.sheet [data-act="closesheet"]');
    m = await mock(); const idea = (m.ideas || [])[0];
    if (!idea || idea.tag !== "Contenu" || idea.title !== "Un donjon pour le Bouftou Royal" || !/niv\. \d+ · /.test(idea.info || "")) fail("idées : idée mal envoyée " + JSON.stringify(idea));
    if (!(await page.$('[data-act="id-send"][disabled]')) || !/Prochaine idée dans 10 min/.test(await page.textContent("#main"))) fail("idées : attente de 10 minutes absente");
    if (!/Un donjon pour le Bouftou Royal/.test(await page.textContent("#main"))) fail("idées : absente de « Tes idées envoyées »");
    // 7d bis (1.1.1.3). signaler un bug : fenêtre depuis la page Suggestions, diagnostic joint, suivi « Corrigé dans la … », panel admin
    await page.waitForSelector('#main [data-act="reportbug"]', { timeout: 5000 }); await page.click('#main [data-act="reportbug"]'); await page.waitForSelector("#bgWhat", { timeout: 5000 });
    await page.click('[data-act="bg-send"]'); await page.waitForTimeout(200);
    if (!/Décris un peu plus le bug/.test(await page.textContent(".sheet"))) fail("bugs : envoi vide accepté");
    await page.fill("#bgWhat", "Ma cape a disparu de l'équipement de mon héros."); await page.fill("#bgExp", "La cape reste équipée.");
    await page.click('[data-act="bg-send"]'); await page.waitForFunction(() => /signalement est parti/.test((document.querySelector(".sheet") || {}).textContent || ""), null, { timeout: 5000 }).catch(() => fail("bugs : pas de remerciement"));
    m = await mock(); const bug = (m.bugs || [])[0];
    if (!bug || bug.what !== "Ma cape a disparu de l'équipement de mon héros." || bug.expected !== "La cape reste équipée." || !/Diagnostic idlus/.test(bug.diag || "") || !/Suggestions/.test(bug.page || "") || !bug.version) fail("bugs : signalement mal envoyé " + JSON.stringify(bug && Object.assign({}, bug, { diag: (bug.diag || "").slice(0, 80) })));
    await page.click('.sheet [data-act="closesheet"]'); await page.click('#main [data-act="reportbug"]');
    await page.waitForFunction(() => /Corrigé dans la 1\.1\.0\.9/.test((document.querySelector(".sheet") || {}).textContent || ""), null, { timeout: 5000 }).catch(() => fail("bugs : suivi « Corrigé dans la … » absent"));
    // 1.2.3.2 : onglet « Idée » de la même fenêtre (Boîte à idées : ici l'attente de 10 minutes après l'idée envoyée plus haut)
    await page.click('.sheet [data-act="bg-mode"][data-v="idee"]'); await page.waitForSelector("#bgTitle", { timeout: 5000 });
    if (!(await page.$('.sheet [data-act="bg-idea"][disabled]')) || !/Prochaine idée dans 10 min/.test(await page.textContent(".sheet"))) fail("bugs : onglet Idée sans l'attente de 10 minutes");
    await page.click('.sheet [data-act="closesheet"]');
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector(".adm .kpis", { timeout: 5000 });
    await page.click('.adm [data-act="adm-tab"][data-v="idees"]'); await page.waitForSelector('.adm [data-act="id-hide"]', { timeout: 5000 });
    if (!/Bouftou Royal/.test(await page.textContent(".adm"))) fail("idées : absente du panel admin");
    await page.click('.adm [data-act="adm-tab"][data-v="bugs"]'); await page.waitForFunction(() => /Ma cape a disparu/.test((document.querySelector(".adm") || {}).textContent || ""), null, { timeout: 5000 }).catch(() => fail("bugs : absent du panel admin"));
    // 7d ter (1.0.23). builds partagés : liste, build de la semaine, filtres, recherche, fiche, j'aime, favori, appliquer, signaler, publier, mise à jour en un clic, panel admin
    await page.evaluate(() => { const S = window.DX.S; S.settings.snd = Object.assign({}, S.settings.snd, { asked: true, nv13: true }); document.querySelectorAll("#sndask").forEach((x) => x.remove()); }); // 1.0.22 : la bulle « Jouer en musique ? » ne cache pas les clics du test
    const myCls = await page.evaluate(() => { const D = window.DATA, E = window.ENGINE, S = window.DX.S;
      const pick = (sl, L) => Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === sl && D.ITEMS[k].lvl <= L && D.ITEMS[k].craft).sort((a, b) => D.ITEMS[b].lvl - D.ITEMS[a].lvl)[0];
      const code = (cls, lvl, st) => { const eq = {}; ["coiffe", "cape", "amulette", "ceinture", "bottes"].forEach((sl) => (eq[sl] = pick(sl, lvl))); eq.dofus1 = "dofus_cacao"; return E.BUILD_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, cls, lvl, n: "Héros", st, as: "", ac: 200, at: "vit", sp: [], eq })))); };
      const mk = (id, uid, pseudo, cls, lvl, el, bud, title, likers, views) => { const c = code(cls, lvl, { vit: 300, [el]: 200 }); const j = JSON.parse(decodeURIComponent(escape(atob(c.slice(7)))));
        return { id, user_id: uid, pseudo, hid: 1, cls, lvl, el, bud, tags: ["Donjon"], title, note: "Passer en Colère dès le 3e tour.", code: c, items: Object.values(j.eq), sex: "m", head: 0, likers, views, reports: [], hidden: false, removed: false, at: new Date().toISOString(), new: new Date().toISOString() }; };
      const mc = S.chars[0].cls; const other = mc === "eni" ? "cra" : "eni";
      const d = JSON.parse(localStorage.getItem("__mock")); d.builds = [mk(1, "u9", "Kralamour", mc, 200, "fo", "pre", "Build Terre increvable", ["u7", "u6", "u5"], 120), mk(2, "u8", "Tofuline", other, 120, "ine", "abo", "Build Feu soin", [], 4)];
      localStorage.setItem("__mock", JSON.stringify(d)); return { mc, other }; });
    await page.evaluate(() => window.scrollTo(0, 0));
    await navClick(page, "builds"); await page.waitForSelector("#bdPage .bd-card", { timeout: 8000 });
    if ((await page.$$("#bdPage .bd-card")).length !== 2) fail("builds : il faut 2 cartes");
    if (!(await page.$("#bdPage .bd-week")) || !/Build Terre increvable/.test(await page.textContent("#bdPage .bd-week"))) fail("builds : build de la semaine absent");
    if ((await page.$$("#bdPage .bd-cls button")).length !== 19) fail("builds : il faut les 19 classes dans les filtres");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/builds.png", fullPage: true });
    await page.click(`[data-act="bd-f"][data-k="cls"][data-v="${myCls.other}"]`); await page.waitForTimeout(500);
    if ((await page.$$("#bdPage .bd-card")).length !== 1 || !/Build Feu soin/.test(await page.textContent("#bdPage .bd-grid"))) fail("builds : filtre par classe incorrect");
    await page.click(`[data-act="bd-f"][data-k="cls"][data-v="${myCls.other}"]`); await page.waitForTimeout(500);
    await page.click('[data-act="bd-f"][data-k="br"][data-v="101-150"]'); await page.waitForTimeout(500);
    if ((await page.$$("#bdPage .bd-card")).length !== 1) fail("builds : filtre par niveau incorrect");
    await page.click('[data-act="bd-f"][data-k="br"][data-v=""]'); await page.waitForTimeout(500);
    const bCoiffe = await page.evaluate(() => window.DATA.ITEMS[JSON.parse(localStorage.getItem("__mock")).builds[0].items[0]].name);
    await page.fill("#bdQ", bCoiffe); await page.waitForTimeout(1200);
    if ((await page.$$("#bdPage .bd-card")).length !== 1 || !/Build Terre increvable/.test(await page.textContent("#bdPage .bd-grid"))) fail("builds : recherche par objet incorrecte");
    if ((await page.inputValue("#bdQ")) !== bCoiffe) fail("builds : la recherche s'efface au redessin");
    await page.fill("#bdQ", ""); await page.waitForTimeout(1200);
    await page.click('.bd-card[data-id="1"]'); await page.waitForSelector("#bdPage .bd-doll", { timeout: 5000 });
    if ((await page.$$("#bdPage .bd-doll .dslot.filled")).length !== 6) fail("builds : fiche, il faut 6 objets dans la poupée");
    if ((await page.$$("#bdPage .bd-st")).length < 3) fail("builds : fiche, caractéristiques absentes");
    if (!(await page.$("#bdPage .bd-cmpt"))) fail("builds : fiche, comparaison avec mon héros absente");
    if (!(await page.$("#bdPage .bd-dofp .dofp"))) fail("builds : fiche, passif du Dofus absent");
    await page.waitForTimeout(300);
    if (!/👁 121/.test(await page.textContent("#bdPage .bd-dhead"))) fail("builds : vue non comptée");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/build-fiche.png", fullPage: true });
    await page.click('#bdPage .bd-dhead [data-act="bd-like"]'); await page.waitForTimeout(300);
    if (!/❤ 4/.test(await page.textContent("#bdPage .bd-dhead"))) fail("builds : j'aime non compté");
    await page.click('#bdPage .bd-dhead [data-act="bd-fav"]'); await page.waitForTimeout(200);
    if (!(await page.evaluate(() => (window.DX.S.bdFav || []).includes(1)))) fail("builds : favori non gardé");
    await page.click('#bdPage [data-act="bd-apply"]'); await page.waitForSelector('.sheet [data-act="bd-applygo"]', { timeout: 3000 });
    await page.click('.sheet [data-act="bd-applygo"]'); await page.waitForTimeout(300);
    if (!(await page.evaluate(() => window.DX.S.chars[0].alloc.fo > 0 || window.DX.S.chars[0].lvl === 1))) fail("builds : « Appliquer » sans effet");
    await page.click('#bdPage [data-act="bd-report"]'); await page.waitForSelector('.sheet [data-act="bd-reportgo"]', { timeout: 3000 });
    await page.click('.sheet [data-act="bd-reportgo"]'); await page.waitForTimeout(400);
    if (((await mock()).builds[0].reports || []).length !== 1) fail("builds : signalement non envoyé");
    await page.click('#bdPage [data-act="bd-back"]'); await page.waitForSelector("#bdPage .bd-grid", { timeout: 3000 });
    await page.selectOption("#bdSort", "fav"); await page.waitForTimeout(500);
    if ((await page.$$("#bdPage .bd-card")).length !== 1) fail("builds : tri « Mes favoris » incorrect");
    // publier depuis « Partager le build », avec 3 objets sur le héros
    await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE, D = window.DATA; const c = S.chars[0];
      ["amulette", "ceinture", "bottes"].forEach((sl) => { const t = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === sl && D.ITEMS[k].lvl <= c.lvl && D.ITEMS[k].craft); const it = E.rollItem(S, t); E.equip(S, c.id, it.uid); }); }); // pas de coiffe ni de cape : le rendu d'Ankama refuse le jeu (403)
    await page.click('#bdPage [data-act="bd-pub"]'); await page.waitForSelector(".sheet #bdPub #bdPT", { timeout: 5000 });
    if (!/Partager le build/.test(await page.textContent(".sheet h2")) || !(await page.$(".sheet #buildOut"))) fail("builds : la fenêtre « Partager le build » a perdu le code");
    await page.fill("#bdPT", "Mon premier build"); await page.click('.sheet [data-act="bd-ptag"][data-v="Farm"]'); await page.fill("#bdPN", "À essayer !");
    await page.click('.sheet [data-act="bd-send"]'); await page.waitForTimeout(800);
    m = await mock();
    { const pb = (m.builds || []).find((x) => x.title === "Mon premier build"); if (!pb || pb.tags[0] !== "Farm" || pb.note !== "À essayer !" || !["abo", "moy", "pre"].includes(pb.bud) || !["fo", "ine", "cha", "age", "multi"].includes(pb.el)) fail("builds : publication incorrecte " + JSON.stringify(pb && { t: pb.tags, n: pb.note, b: pb.bud, e: pb.el })); }
    if (!(await page.evaluate(() => window.DX.S.chars[0].bd > 0))) fail("builds : le build publié n'est pas relié au héros");
    if (!/Mettre à jour le build publié/.test(await page.textContent(".sheet #bdPub"))) fail("builds : bouton de mise à jour absent après la publication");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/build-publier.png" });
    await page.click('.sheet [data-act="closesheet"].btn');
    // le héros change : « Mettre à jour mon build publié » dans ⋯ Plus, en un clic
    await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE, D = window.DATA, c = S.chars[0]; const t = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "anneau" && D.ITEMS[k].lvl <= c.lvl && D.ITEMS[k].craft); E.equip(S, c.id, E.rollItem(S, t).uid); });
    if (!(await page.evaluate(() => window.BUILDS.changed(window.DX.S.chars[0])))) fail("builds : changement du héros non vu");
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.builds.forEach((b) => { if (b.title === "Mon premier build") b.at = new Date(Date.now() - 60000).toISOString(); }); localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => { const S = window.DX.S; window.DX.ui.tab = "team"; window.DX.ui.tview = "hero"; window.DX.ui.cid = S.chars[0].id; window.DX.ui.heroMore = true; window.DX.render(); });
    await page.waitForSelector('.hmenu [data-act="bd-quickupd"]', { timeout: 3000 }).catch(() => fail("builds : « Mettre à jour mon build publié » absent du menu du héros"));
    if (await page.$('.hmenu [data-act="bd-quickupd"]')) { await page.click('.hmenu [data-act="bd-quickupd"]'); await page.waitForTimeout(800);
      m = await mock(); const last = (m.pubs || [])[(m.pubs || []).length - 1]; if (!last || last.p_title !== null || !last.p_id) fail("builds : mise à jour en un clic incorrecte");
      if (await page.evaluate(() => window.BUILDS.changed(window.DX.S.chars[0]))) fail("builds : toujours « changé » après la mise à jour"); }
    // 1.0.25.2 : onglet « Mes builds » (compteur sur 30, mise à jour depuis le héros, suppression sur la carte)
    await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE, D = window.DATA, c = S.chars[0]; const t = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "anneau" && D.ITEMS[k].lvl <= c.lvl && D.ITEMS[k].craft)[1]; E.equip(S, c.id, E.rollItem(S, t).uid, "anneau2"); window.DX.ui.heroMore = false; window.DX.ui.tab = "builds"; window.DX.ui.bdOpen = null; window.DX.render(); });
    await page.click('#bdPage [data-act="bd-tab"][data-v="mine"]'); await page.waitForSelector("#bdPage .bd-own", { timeout: 5000 }).catch(() => fail("builds : onglet « Mes builds » sans ses builds"));
    { const tx = await page.textContent("#bdPage"); if (!/Mes builds 1\/30/.test(tx) || !/1 build publié sur 30/.test(tx)) fail("builds : compteur de « Mes builds » faux : " + tx.slice(0, 160)); if (await page.$("#bdPage #bdSort")) fail("builds : les filtres ne doivent pas être dans « Mes builds »"); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/builds-mine.png", fullPage: true });
    if (await page.$('#bdPage .bd-own [data-act="bd-upd"]')) { const n0 = ((await mock()).pubs || []).length; await page.click('#bdPage .bd-own [data-act="bd-upd"]'); await page.waitForTimeout(800); m = await mock(); if ((m.pubs || []).length !== n0 + 1 || m.pubs[n0].p_title !== null) fail("builds : « Mettre à jour depuis » de « Mes builds » sans effet"); }
    else fail("builds : « Mettre à jour depuis » absent de « Mes builds » alors que le héros a changé");
    await page.waitForSelector('#bdPage .bd-own [data-act="bd-del"]', { timeout: 5000 }); await page.click('#bdPage .bd-own [data-act="bd-del"]'); await page.waitForSelector('.sheet [data-act="bd-delgo"]', { timeout: 3000 }); await page.click('.sheet [data-act="bd-delgo"]'); await page.waitForTimeout(800);
    m = await mock(); if (!(m.builds.find((x) => x.title === "Mon premier build") || {}).removed && m.builds.some((x) => x.title === "Mon premier build")) fail("builds : suppression depuis « Mes builds » sans effet");
    if (await page.evaluate(() => window.DX.S.chars[0].bd)) fail("builds : le héros reste relié à un build supprimé");
    if (!/Tu n'as encore publié aucun build/.test(await page.textContent("#bdPage"))) fail("builds : « Mes builds » vide sans message");
    await page.click('#bdPage [data-act="bd-tab"][data-v="all"]'); await page.waitForSelector("#bdPage #bdSort", { timeout: 5000 });
    // panel admin : onglet Builds, cacher un build
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector('.adm [data-act="adm-tab"][data-v="builds"]', { timeout: 5000 });
    await page.click('.adm [data-act="adm-tab"][data-v="builds"]'); await page.waitForSelector('.adm [data-act="bd-adm"]', { timeout: 5000 });
    await page.click('.adm [data-act="bd-adm"][data-id="2"][data-v="hide"]'); await page.waitForTimeout(500);
    m = await mock(); if (!(m.builds.find((x) => x.id === 2) || {}).hidden) fail("builds : « Cacher » du panel admin sans effet");
    // téléphone : la page et la fiche tiennent dans l'écran
    await page.setViewportSize({ width: 390, height: 844 }); await navClick(page, "builds").catch(async () => { await page.evaluate(() => { window.DX.ui.tab = "builds"; window.DX.render(); }); });
    await page.evaluate(() => { window.DX.ui.tab = "builds"; window.DX.ui.bdOpen = null; window.DX.render(); }); await page.selectOption("#bdSort", "week"); await page.waitForSelector("#bdPage .bd-card", { timeout: 5000 });
    { const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`builds : page trop large sur téléphone : ${w}px`); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/builds-mob.png", fullPage: true });
    await page.$eval('.bd-card[data-id="1"]', (e) => e.click()); await page.waitForSelector("#bdPage .bd-doll", { timeout: 5000 }); // le chat ouvert couvre la page au téléphone
    { const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`builds : fiche trop large sur téléphone : ${w}px`); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/build-fiche-mob.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 }); await page.evaluate(() => { window.DX.ui.bdOpen = null; window.DX.ui.tab = "admin"; window.DX.render(); });
    // 7e. hôtel de vente : achat d'un objet, il arrive dans le sac et les kamas baissent
    await page.click("#chat .ch-x"); await page.evaluate(() => window.scrollTo(0, 0));
    await navClick(page, "hdv");
    await page.waitForSelector('.mktr2[data-k]', { timeout: 8000 });
    if (!(await page.$(".mkdot.good"))) fail("hôtel de vente : repère de prix absent");
    await page.click('.mktr2[data-k]');
    await page.waitForSelector('.mkdet [data-act="mk-ask"]', { timeout: 8000 });
    const before = await page.evaluate(() => ({ k: window.DX.S.kamas, n: Object.keys(window.DX.S.items).length }));
    await page.click('.mkdet [data-act="mk-ask"]'); await page.click('.mkdet [data-act="mk-buy"]'); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ k: window.DX.S.kamas, n: Object.keys(window.DX.S.items).length, op: window.DX.S.hdv && window.DX.S.hdv.op }));
    if (after.n !== before.n + 1 || after.k !== Math.max(0, before.k - 5000) || after.op !== 1) fail("hôtel de vente : achat mal appliqué " + JSON.stringify([before, after]));
    // 0.1.38 : « Vendre à l'HdV » depuis une ressource ouvre la mise en vente ; prix bas = confirmation, 1 kama l'unité au plus bas
    await page.evaluate(() => { const S = window.DX.S; S.res = S.res || {}; S.res["Laine de Bouftou"] = 150; });
    await page.evaluate(() => { window.MARKET.sellRes("Laine de Bouftou"); window.MARKET.render(document.querySelector("#main")); }); await page.waitForSelector("#mkPrice", { timeout: 5000 });
    if (!/Valeur de base/.test(await page.textContent(".mkdet"))) fail("hôtel de vente : valeur de base absente");
    await page.fill("#mkPrice", "99"); await page.waitForTimeout(800);
    if (!/Au moins 1 kama par unité/.test(await page.textContent(".mkdet"))) fail("hôtel de vente : 1 kama par unité non vérifié");
    await page.fill("#mkPrice", "100"); await page.waitForTimeout(800);
    if (!(await page.$(".mkdet .mklow")) || (await page.$('.mkdet [data-act="mk-sell"]'))) fail("hôtel de vente : pas de confirmation pour un prix très bas");
    await page.click('.mkdet [data-act="mk-lowok"]'); await page.waitForTimeout(200);
    if (!(await page.$('.mkdet [data-act="mk-sell"]:not([disabled])'))) fail("hôtel de vente : vente impossible après confirmation");
    await page.click('.subtabs [data-act="mk-tab"][data-v="log"]'); await page.waitForTimeout(300);
    if (!/Acheté/.test(await page.textContent("#main"))) fail("hôtel de vente : historique vide");
    // 7e bis. offres d'achat (0.1.33) : vendre à une offre, puis publier la sienne
    await page.evaluate(() => { const S = window.DX.S; S.res = S.res || {}; S.res["Laine de Bouftou"] = 20; S.kamas = Math.max(S.kamas, 10000); });
    await page.click('.subtabs [data-act="mk-tab"][data-v="ord"]'); await page.waitForSelector('[data-act="mk-ofill"]', { timeout: 5000 });
    const ob = await page.evaluate(() => window.DX.S.kamas);
    await page.click('[data-act="mk-ofill"]'); await page.waitForTimeout(600);
    const oa = await page.evaluate(() => ({ k: window.DX.S.kamas, r: (window.DX.S.res || {})["Laine de Bouftou"] || 0 }));
    if (oa.k !== ob + 600 || oa.r !== 0) fail("offres d'achat : vente mal appliquée " + JSON.stringify([ob, oa]));
    await page.click('[data-act="mk-oview"][data-v="mine"]'); await page.fill("#mkOF", "blé"); await page.waitForTimeout(500);
    await page.click('[data-act="mk-opick"][data-k="Blé"]'); await page.waitForSelector("#mkOQty"); await page.fill("#mkOQty", "10"); await page.waitForTimeout(650); await page.click("#mkOPrice"); await page.keyboard.type("5", { delay: 50 }); await page.waitForTimeout(800); await page.keyboard.press("Home"); await page.waitForTimeout(800); await page.keyboard.press("Delete"); await page.keyboard.type("5"); await page.waitForTimeout(800); await page.keyboard.press("End"); await page.keyboard.type("0"); await page.waitForTimeout(800);
    if ((await page.inputValue("#mkOPrice")) !== "50") fail("offres d'achat : saisie du prix cassée par le rafraîchissement : " + (await page.inputValue("#mkOPrice")));
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/offre.png" });
    // 0.1.38 : plus de prix minimum, mais une confirmation sous la moitié du prix moyen
    if (!(await page.$(".mklow")) || (await page.$('[data-act="mk-onewgo"]'))) fail("offres d'achat : pas de confirmation pour un prix très bas");
    await page.click('[data-act="mk-lowok"]'); await page.waitForTimeout(200);
    await page.click('[data-act="mk-onewgo"]'); await page.waitForTimeout(800);
    if ((await page.evaluate(() => window.DX.S.kamas)) !== oa.k - 510) fail("offres d'achat : kamas non mis de côté");
    if (!/0 \/ 10 reçus/.test(await page.textContent("#main"))) fail("offres d'achat : offre absente de Mes offres");
    // 7e ter (1.0.30 « Forge ») : coefficients de 10 % à 200 % donnés par le serveur (brisage_sync), atelier de brisage aux prix moyens de l'HdV sur 7 jours (hdv_prix7)
    await page.waitForFunction(() => window.ENGINE.netCoef && window.ENGINE.netCoefT0, null, { timeout: 20000 });
    const fx = await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE, IT = window.DATA.ITEMS; const tpl = Object.keys(IT).find((k) => IT[k].lvl === 60 && IT[k].slot === "coiffe");
      const a = E.rollItem(S, tpl, { radiant: false }); window.DX.ui.tab = "forge"; window.DX.ui.fg = "brisage"; window.DX.render(); window.scrollTo(0, 0); return { tpl, a: a.uid, base: E.coefBase(S), c: E.getCoef(S, tpl) }; });
    if (fx.base !== 150 || fx.c !== 150) fail("brisage : coefficient de départ du serveur non appliqué " + JSON.stringify(fx));
    await page.waitForSelector(".fcstrip", { timeout: 5000 });
    if (!/jamais brisés/.test(await page.textContent(".fcstrip")) || !/150 %/.test(await page.textContent(".fcstrip"))) fail("brisage : bandeau des coefficients sans les objets jamais brisés à 150 %");
    if (!(await page.$(`.pbri[data-k="${fx.a}"] .fco.hi`))) fail("brisage : coefficient au-dessus de 100 % pas mis en avant");
    await page.click(`.pbri[data-k="${fx.a}"] input[data-act="brtog"]`); await page.waitForSelector(".fbat .frt", { timeout: 5000 });
    await page.waitForSelector(".fbat .fval .big", { timeout: 8000 }).catch(() => fail("atelier de brisage : valeur des runes aux prix de l'HdV absente"));
    if (!/k/.test(await page.textContent(".fbat .fval")) || !/Revendre/.test(await page.textContent(".fbat .fval"))) fail("atelier de brisage : valeur ou revente absente");
    if ((await page.$$(".fbat .ffc .fchip")).length < 2) fail("atelier de brisage : focus absents");
    if (!(await page.$(`.pbri[data-k="${fx.a}"] .frent`))) fail("brisage : « ×1,8 » ou « vendre » absent de la ligne");
    if (!(await page.$(".fbat .fbgo .frent"))) fail("atelier de brisage : verdict briser ou vendre absent");
    if (process.env.SHOTS) { await page.evaluate(() => window.scrollTo(0, document.querySelector(".fcstrip").getBoundingClientRect().top + window.scrollY - 76)); await page.screenshot({ path: process.env.SHOTS + "/atelier-en-ligne.png" }); }
    await page.click('.fbat [data-act="brask"]'); await page.click('.fbat [data-act="brgo"]'); await page.waitForTimeout(300);
    if (await page.evaluate((u) => !!window.DX.S.items[u], fx.a)) fail("atelier de brisage : objet pas brisé");
    await page.waitForFunction((t) => { const d = JSON.parse(localStorage.getItem("__mock")); return d.brCoef && d.brCoef[t]; }, fx.tpl, { timeout: 20000 }).catch(() => fail("brisage : brisage pas envoyé au serveur (brisage_hit_sync)"));
    { const r = await page.evaluate((t) => ({ srv: JSON.parse(localStorage.getItem("__mock")).brCoef[t][0], c: window.ENGINE.getCoef(window.DX.S, t) }), fx.tpl); if (r.srv !== 147 || r.c !== 147) fail("brisage : coefficient commun après brisage " + JSON.stringify(r)); }
    // 7e quater (1.0.30). vente directe : fiche d'une ressource (prix du serveur, tendance, courbe 48 h, « Vendre » et « Vendre à l'HdV »),
    // flèche sur chaque case, vente vérifiée par le serveur, surplus au-delà de « Garder au maximum », page Cours des ressources
    await page.evaluate(() => { const S = window.DX.S; Object.assign(S.res, { "Laine de Bouftou": 3000, "Bois de Frêne": 50, "Plume de Tofu": 20 }); S.resCap = {}; const ui = window.DX.ui; ui.tab = "inv"; ui.inv = "res"; ui.resView = "grid"; ui.resQ = ""; ui.resF = "all"; ui.resSel = "Laine de Bouftou"; window.DX.render(); window.scrollTo(0, 0); });
    await page.waitForSelector(".vd-box .vd-price", { timeout: 8000 }).catch(() => fail("vente directe : prix absent de la fiche"));
    { const t = (await page.textContent(".vd-box")).replace(/\s/g, " ");
      if (!/×0,4/.test(t) || !/▲/.test(t)) fail("vente directe : prix ou tendance faux dans la fiche : " + t.slice(0, 160));
      if (!(await page.$(".vd-box #vdSpark")) || !(await page.$('.vd-box [data-act="vd-sell"]')) || !(await page.$('.vd-box [data-act="hdvres"]'))) fail("vente directe : courbe, « Vendre » ou « Vendre à l'HdV » absent"); }
    if (!(await page.$(".rtile .vd-ar.vd-up")) || !(await page.$(".rtile .vd-ar.vd-dn"))) fail("vente directe : flèches ▲ ▼ absentes des cases");
    { const k0 = await page.evaluate(() => window.DX.S.kamas);
      await page.fill("#vdQty", "1000"); await page.waitForTimeout(100);
      if (!/Vendre 1 000/.test((await page.textContent("#vdGo")).replace(/\s/g, " "))) fail("vente directe : le bouton ne suit pas la quantité");
      await page.click("#vdGo"); await page.waitForTimeout(900);
      const r = await page.evaluate(() => ({ k: window.DX.S.kamas, q: window.DX.S.res["Laine de Bouftou"], exp: window.ENGINE.venteLot(window.ENGINE.resPrice("Laine de Bouftou"), 0.4, 1000).k, log: (window.DX.S.venteLog || [])[0], sells: (JSON.parse(localStorage.getItem("__mock")).sells || []).length }));
      if (r.q !== 2000 || r.k - k0 !== r.exp || r.sells !== 1 || !r.log || !/Vente directe/.test(r.log.t)) fail("vente directe : vente mal appliquée " + JSON.stringify([k0, r])); 
      if (!/Vendu : 1 000/.test(((await page.textContent(".vd-box .vd-done").catch(() => "")) || "").replace(/\s/g, " "))) fail("vente directe : résultat de la vente absent de la fiche");
      // 1.0.30.7 : tout vendre garde la fiche ouverte avec le résultat (avant : elle se fermait, « rien ne se passe »)
      await page.fill("#vdQty", "2000"); await page.click("#vdGo"); await page.waitForTimeout(900);
      if (await page.evaluate(() => window.DX.S.res["Laine de Bouftou"] || 0)) fail("vente directe : tout vendre n'a pas tout vendu");
      if (!/Vendu : 2 000/.test(((await page.textContent(".vd-box .vd-done").catch(() => "")) || "").replace(/\s/g, " "))) fail("vente directe : la fiche se ferme après avoir tout vendu");
      await page.evaluate(() => { window.DX.S.res["Laine de Bouftou"] = 3000; window.DX.render(); }); }
    { const r = await page.evaluate(async () => { const S = window.DX.S, E = window.ENGINE; S.resCap["Bois de Frêne"] = 10; E.emit(S, "harvest", { n: 1 }); const kept = S.res["Bois de Frêne"]; await window.VENTEUI.surplus(); return { kept, now: S.res["Bois de Frêne"], direct: E.venteDirect(S) }; });
      if (!r.direct || r.kept !== 50 || r.now !== 10) fail("vente directe : le surplus n'est pas vendu au prix du moment " + JSON.stringify(r)); }
    // serveur pas encore à jour (supabase/vente.sql pas appliqué) : retour au marchand de secours, puis la vente revient
    { const r = await page.evaluate(async () => { const S = window.DX.S, E = window.ENGINE; const d = JSON.parse(localStorage.getItem("__mock")); d.ecoOff = true; localStorage.setItem("__mock", JSON.stringify(d));
        await window.VENTEUI.load(true); const off = E.venteDirect(S); S.res["Bois de Frêne"] = 30; S.resCap["Bois de Frêne"] = 5; E.emit(S, "harvest", { n: 1 }); const merch = S.res["Bois de Frêne"];
        d.ecoOff = false; localStorage.setItem("__mock", JSON.stringify(d)); await window.VENTEUI.load(true); delete S.resCap["Bois de Frêne"]; return { off, merch, back: E.venteDirect(S) }; });
      if (r.off || r.merch !== 5 || !r.back) fail("vente directe : sans les fonctions du serveur, le marchand de secours ne reprend pas " + JSON.stringify(r)); }
    if (!(await page.evaluate(() => window.DX.NAV.some((F) => F.pages.some((p) => p[0] === "cours"))))) fail("vente directe : Cours des ressources absent du menu");
    await page.click('.vd-box [data-act="nav"][data-v="cours"]'); await page.waitForSelector(".vd-cours", { timeout: 5000 });
    { const t = await page.textContent("#main"); if (!/Les plus chères/.test(t) || !/Les plus vendues/.test(t) || !/Laine de Bouftou/.test(t) || !/Tes dernières ventes directes/.test(t)) fail("cours des ressources : page incomplète"); }
    await page.fill("#vdCq", "frene"); await page.waitForTimeout(400);
    if (!/Bois de Frêne/.test(await page.textContent("#vdList")) || /Les plus chères/.test(await page.textContent("#vdList"))) fail("cours des ressources : recherche cassée");
    await page.fill("#vdCq", "");
    // Foire du Trool : Jackpot du serveur (ticket, pot, gain versé comme une vente de l'HdV) et Caisses du Trool
    await page.evaluate(() => { window.DX.S.kamas = Math.max(window.DX.S.kamas, 3e6); });
    await navClick(page, "foire"); await page.waitForSelector("#foJack .fo-jack", { timeout: 8000 }).catch(() => fail("foire : Jackpot absent"));
    if (!/36 000 k/.test((await page.textContent("#foJack .fo-jack")).replace(/\s/g, " "))) fail("foire : pot de l'heure faux");
    { const k0 = await page.evaluate(() => window.DX.S.kamas);
      await page.click('[data-act="fo-jbuy"][data-n="1"]'); await page.waitForTimeout(900);
      const k1 = await page.evaluate(() => window.DX.S.kamas);
      if (k0 - k1 !== 10000 || !/45 000 k/.test((await page.textContent("#foJack")).replace(/\s/g, " ")) || !/tu as 1 ticket/.test(await page.textContent("#foJack"))) fail("foire : ticket de Jackpot mal acheté " + JSON.stringify([k0, k1]));
      const r = await page.evaluate(async () => { const d = JSON.parse(localStorage.getItem("__mock")); d.jackDraw = true; localStorage.setItem("__mock", JSON.stringify(d)); await window.FOIREUI.jLoad(); await window.MARKET.sync(); return { k: window.DX.S.kamas, log: window.DX.S.hdv.log[0] && window.DX.S.hdv.log[0].t }; });
      if (r.k - k1 !== 45000 || !/Jackpot du Trool : tu remportes/.test(r.log || "")) fail("foire : gain du Jackpot non versé " + JSON.stringify(r)); }
    { const k0 = await page.evaluate(() => window.DX.S.kamas);
      await page.click('[data-act="fo-pick"][data-v="bois"]'); await page.click("#foGo"); await page.waitForTimeout(4500);
      const r = await page.evaluate(() => ({ k: window.DX.S.kamas, left: window.ENGINE.foireLeft(window.DX.S), lot: window.FOIREUI.st.last && window.FOIREUI.st.last.lot }));
      if (r.left !== 19 || !r.lot || r.k !== k0 - 50000 + r.lot.k || !(await page.$(".fo-track .it.win")) || !/!/.test(await page.textContent("#foRes"))) fail("foire : caisse mal ouverte " + JSON.stringify([k0, r])); }
    // Comptoirs : les 6 boutiques, point sur le menu quand on peut acheter du neuf, achat, offre de la semaine
    await page.evaluate(() => { const S = window.DX.S; S.tokens.jetons = 50; window.DX.render(); });
    if (!(await page.evaluate(() => /navdot/.test(window.DX.navBadges().comptoirs || "")))) fail("comptoirs : pas de point sur le menu avec de quoi acheter");
    await navClick(page, "comptoirs"); await page.waitForSelector(".cp-shops", { timeout: 5000 });
    if ((await page.$$(".cp-sh")).length !== 6 || !(await page.$(".cp-offer")) || !/NOUVEAU/.test(await page.textContent(".cp-items"))) fail("comptoirs : page incomplète");
    await page.click('.cp-sh[data-v="prime"]'); await page.waitForTimeout(100);
    { const b0 = await page.evaluate(() => [window.DX.S.tokens.jetons, window.DX.S.cons.bonbon_sagesse || 0]);
      await page.click('[data-act="cp-buy"][data-s="prime"][data-id="b1"][data-q="1"]:not([data-o])'); await page.waitForTimeout(200);
      const b1 = await page.evaluate(() => [window.DX.S.tokens.jetons, window.DX.S.cons.bonbon_sagesse || 0]);
      if (b1[0] !== b0[0] - 4 || b1[1] !== b0[1] + 1) fail("comptoirs : achat mal fait " + JSON.stringify([b0, b1])); }
    await navClick(page, "world"); await page.waitForTimeout(200);
    if (await page.evaluate(() => window.ENGINE.cptNew(window.DX.S, "prime").length)) fail("comptoirs : les objets vus restent neufs");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tb of ["cours", "foire", "comptoirs"]) { await page.evaluate((x) => { window.DX.ui.tab = x; window.DX.render(); }, tb); await page.waitForTimeout(250); const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`${tb} : page trop large sur téléphone : ${w}px`); }
    await page.setViewportSize({ width: 1280, height: 800 }); await page.evaluate(() => { window.DX.ui.tab = "world"; window.DX.render(); });
    // 7f. guildes : invitation reçue, liste, formulaire de fondation
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // bulle « Équiper un objet » après l'achat
    await navClick(page, "guild"); await page.waitForSelector('[data-act="g-inv"]', { timeout: 8000 });
    if (!(await page.$("#gName")) || !(await page.$('[data-act="g-join"]'))) fail("guildes : page incomplète");
    // la page se redessine pendant la frappe : le curseur doit rester à sa place (le nom s'écrivait à l'envers)
    await page.click("#gName"); await page.keyboard.type("Les Bouf", { delay: 120 }); await page.waitForTimeout(700); await page.keyboard.type("tous", { delay: 500 }); await page.waitForTimeout(700);
    const gn = await page.inputValue("#gName"); if (gn !== "Les Bouftous") fail("guildes : saisie du nom cassée par le rafraîchissement : " + JSON.stringify(gn));
    if (!(await page.evaluate(() => document.activeElement && document.activeElement.id === "gName"))) fail("guildes : le champ du nom perd le focus");
    // 7g. 1.0.30 : refonte des guildes : code GUILDES, invitation, coffre, améliorations, Percepteurs, attaques, boss, autres guildes
    const gtxt = async () => (await page.textContent("#main")).replace(/\s/g, " ");
    const gwide = async (what, shot) => { // téléphone : rien ne déborde (et captures PC et téléphone avec SHOTS)
      if (shot && process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${shot}-pc.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250); const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`guildes : ${what} trop large sur téléphone : ${w}px`);
      if (shot && process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${shot}-mob.png`, fullPage: true });
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150); };
    if (!/Les guildes repartent de zéro/.test(await gtxt()) || !/25 000 kamas et un héros niveau 20/.test(await gtxt())) fail("guildes : bandeau du code GUILDES ou fondation à 25 000 absent");
    await gwide("la page sans guilde", "guilde-sans");
    { const k0 = await page.evaluate(() => window.DX.S.kamas);
      await page.click('[data-act="g-gift"]'); await page.waitForTimeout(700);
      if ((await page.evaluate(() => window.DX.S.kamas)) !== k0 + 300000) fail("guildes : code GUILDES non reçu");
      if (await page.$('[data-act="g-gift"]')) fail("guildes : bandeau du code GUILDES encore là après usage"); }
    await page.click('[data-act="g-inv"][data-v="1"]'); await page.waitForSelector('.subtabs [data-act="g-tab"][data-v="coffre"]', { timeout: 8000 });
    await page.waitForFunction(() => /phase 3 \/ 5/i.test(document.querySelector("#main").textContent), null, { timeout: 8000 }).catch(() => fail("guildes : boss absent de l'accueil"));
    { const t = await gtxt(); if (!/Dans le coffre/.test(t) || !/6e place/.test(t) || !/Guerre des Percepteurs/.test(t) || !/attaqué par Les Tofus Enragés/.test(t)) fail("guildes : accueil incomplet"); }
    if ((await page.$$("#main .gx-ph > div")).length !== 5) fail("guildes : barre de vie du boss absente de l'accueil");
    if (!(await page.$('#main [data-act="g-boss"]:not([disabled])')) || !/Lancer mes 4 essais/.test(await gtxt())) fail("guildes : bouton « Lancer mes essais » absent de l'accueil"); // 1.0.32.9, 1.0.33
    await gwide("l'accueil", "guilde-accueil");
    // coffre : dépôt (opération de partie) et part des ventes
    await page.click('[data-act="g-tab"][data-v="coffre"]'); await page.waitForSelector("#gDep");
    await page.evaluate(() => { window.DX.S.kamas = Math.max(window.DX.S.kamas, 500000); });
    { const k1 = await page.evaluate(() => window.DX.S.kamas);
      await page.fill("#gDep", "100000"); await page.click('[data-act="g-deposit"]'); await page.waitForTimeout(800);
      if ((await page.evaluate(() => window.DX.S.kamas)) !== k1 - 100000) fail("guildes : dépôt au coffre mal appliqué");
      if (!/3 100 000 k/.test(await gtxt()) || !/Personne ne peut retirer/.test(await gtxt())) fail("guildes : coffre mal affiché après le dépôt"); }
    await page.$eval("#gSale", (e) => { e.value = "10"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await page.waitForTimeout(500);
    if ((await mock()).gm.sale !== 10) fail("guildes : part des ventes non envoyée");
    await gwide("le coffre", "guilde-coffre");
    // améliorations : une unique achetée avec le coffre (deux clics), lue par E.guildHas
    await page.click('[data-act="g-tab"][data-v="upg"]'); await page.waitForSelector('[data-act="g-buy"][data-k="espionnage"]');
    if ((await page.$$(".gx-uq .gx-card")).length !== 8 || (await page.$$(".gx-up .gx-card")).length !== 4) fail("guildes : 8 améliorations uniques et 4 rangs attendus");
    await page.click('[data-act="g-buy"][data-k="espionnage"]'); await page.click('[data-act="g-buy"][data-k="espionnage"]'); await page.waitForTimeout(800);
    if (!(await page.evaluate(() => window.ENGINE.guildHas(window.DX.S, "espionnage")))) fail("guildes : amélioration unique non achetée");
    await gwide("les améliorations", "guilde-ameliorations");
    // Percepteurs : attaque d'une autre guilde, victoire, récolte (Sagesse), défense avec l'équipe d'arène
    await page.evaluate(() => { const S = window.DX.S; window.ENGINE.koliState(S); S.koli.team = S.chars.slice(0, 3).map((c) => c.id); });
    await page.click('[data-act="g-tab"][data-v="percos"]'); await page.waitForSelector(".gx-alert", { timeout: 8000 });
    { const t = await gtxt(); if (!/Victoire/.test(t) || !/Et si personne ne gagne/.test(t) || !/Règles des attaques/.test(t) || !/Défenseurs/.test(t)) fail("guildes : page des Percepteurs incomplète"); }
    await gwide("les Percepteurs", "guilde-percepteurs");
    { const x0 = await page.evaluate(() => { const c = window.DX.S.chars[0]; if (c.lvl < 40) { c.lvl = 40; c.xp = 0; } return JSON.stringify(window.DX.S.chars.map((x) => [x.lvl, x.xp])); });
      await page.click('[data-act="g-collect"]:not([disabled])'); await page.waitForTimeout(800);
      if (x0 === (await page.evaluate(() => JSON.stringify(window.DX.S.chars.map((c) => [c.lvl, c.xp]))))) fail("guildes : la Sagesse ne donne pas d'XP à l'équipe qui récolte"); }
    await page.click('[data-act="g-rdef"]'); await page.waitForTimeout(1000);
    if (!((await mock()).gm.calls || []).some((b) => b.raid && b.raid.def === 77)) fail("guildes : défense non envoyée au serveur");
    if (await page.$(".gx-alert")) fail("guildes : l'attaque repoussée est encore affichée");
    await page.click('[data-act="g-rseen"]'); await page.waitForTimeout(200);
    if (/Victoire !/.test(await gtxt())) fail("guildes : l'encart de victoire ne se ferme pas");
    // boss en 5 phases, essais en réserve
    await page.click('[data-act="g-tab"][data-v="boss"]'); await page.waitForSelector(".gx-ph");
    if ((await page.$$(".gx-ph > div")).length !== 5 || !/4 essais en réserve \(12 au plus\)/.test(await gtxt()) || !/5 membres actifs sur 6/.test(await gtxt()) || !/2 \/ 3 essais/.test(await gtxt())) fail("guildes : boss en 5 phases incomplet");
    await page.click('[data-act="g-boss"]:not([data-all])'); await page.waitForTimeout(1000);
    if (!/310 points en 15 tours/.test(await gtxt()) || !/3 essais en réserve/.test(await gtxt()) || !(await page.$(".gbrep .gbrow")) || !/Mécaniques du boss : Totem/.test(await gtxt())) fail("guildes : essai de boss mal affiché (1.0.33 : rapport d'essai)");
    // 1.0.33 (6B) : revoir l'essai, puis revenir à la guilde
    await page.click('[data-act="g-bwatch"]'); await page.waitForSelector("#arena", { timeout: 5000 }).catch(() => fail("guildes : « Revoir le combat » ne s'ouvre pas"));
    await page.click('[data-act="sm-wskip"]').catch(() => {}); await page.waitForTimeout(400);
    await page.click('[data-act="sm-wquit"]'); await page.waitForSelector('[data-act="g-tab"][data-v="boss"]', { timeout: 5000 }).catch(() => fail("guildes : pas de retour à la guilde après le revisionnage"));
    // 1.0.33 (1A) : « Lancer mes essais » joue toute la réserve
    await page.waitForSelector('[data-act="g-boss"][data-all]:not([disabled])', { timeout: 5000 });
    { const n0 = ((await mock()).gm.calls || []).filter((b) => b.gboss).length; await page.click('[data-act="g-boss"][data-all]');
      await page.waitForFunction(() => /3 essais · 930 points/.test(document.querySelector("#main").textContent), null, { timeout: 20000 }).catch(() => fail("guildes : « Lancer mes essais » incomplet"));
      if (((await mock()).gm.calls || []).filter((b) => b.gboss).length - n0 !== 3) fail("guildes : « Lancer mes essais » n'a pas joué 3 essais"); }
    await gwide("le boss", "guilde-boss");
    // autres guildes : fiche (avec l'Espionnage) puis attaque
    await page.click('[data-act="g-tab"][data-v="others"]'); await page.waitForSelector('[data-act="g-view"][data-g="4"]', { timeout: 8000 });
    await page.click('[data-act="g-view"][data-g="4"]'); await page.waitForSelector('[data-act="g-atk"]', { timeout: 8000 });
    { const t = await gtxt(); if (!/Robustesse rang 6/.test(t) || !/équipes d'arène \(Espionnage\)/.test(t) || !/18 victoires/.test(t)) fail("guildes : fiche d'une autre guilde incomplète"); }
    await gwide("la fiche d'une guilde", "guilde-fiche");
    await page.click('[data-act="g-atk"]'); await page.waitForSelector('[data-act="g-rgo"]:not([disabled])', { timeout: 5000 }).catch(() => fail("guildes : attaque impossible"));
    if (!/À gagner/.test(await gtxt()) || !/Ton équipe d'arène \(1 héros/.test(await gtxt())) fail("guildes : écran d'attaque incomplet");
    await gwide("l'écran d'attaque", "guilde-attaque");
    await page.click('[data-act="g-rgo"]'); await page.waitForTimeout(1000);
    if (!((await mock()).gm.calls || []).some((b) => b.raid && b.raid.go === 41)) fail("guildes : attaque non envoyée au serveur");
    if (!/Attaque en cours/.test(await gtxt())) fail("guildes : attaque en cours absente des Percepteurs");
    // Chasse aux Percepteurs : liste groupée par guilde, revanche, prime, vétérans, carte et domination
    await page.click('[data-act="g-tab"][data-v="chasse"]'); await page.waitForSelector(".pc-grp", { timeout: 8000 }).catch(() => fail("chasse : onglet vide"));
    { const t = await gtxt(); ["Revanche contre Les Bouftous Fous", "Ordre du Kralamour", "Avis de recherche", "Nuit des Percepteurs", "Prime 750 000 k", "★★★"].forEach((x) => { if (!t.includes(x)) fail("chasse : « " + x + " » absent"); });
      if ((await page.$$(".pc-grp")).length !== 3) fail("chasse : 3 guildes ennemies attendues");
      if (!/Les Bouftous Fous/.test(await page.textContent(".pc-grp"))) fail("chasse : la guilde de la revanche n'est pas en tête"); }
    await page.click('[data-act="hc-f"][data-v="dj"]'); await page.waitForTimeout(200);
    if ((await page.$$(".pc-row")).length !== 1) fail("chasse : filtre Donjons");
    await page.click('[data-act="hc-f"][data-v="all"]'); await page.waitForTimeout(200);
    await gwide("la chasse aux Percepteurs", "guilde-chasse");
    { const c0 = (await mock()).gm.chest;
      await page.click('[data-act="hc-bnty"][data-p="43"]'); await page.waitForSelector("#chBnty"); await page.fill("#chBnty", "300000"); await page.click('[data-act="hc-bnty2"]'); await page.waitForTimeout(800);
      if ((await mock()).gm.chest !== c0 - 300000) fail("chasse : prime non payée par le coffre"); }
    await page.click('.pc-rev'); await page.waitForSelector('[data-act="g-rgo"]', { timeout: 5000 }).catch(() => fail("chasse : la revanche n'ouvre pas l'attaque"));
    if (!/Lancer la revanche/.test(await gtxt()) || !/ne compte pas dans tes attaques du jour/.test(await gtxt())) fail("chasse : écran de revanche incomplet");
    await page.click('[data-act="g-atkback"]');
    if (!(await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE; const sub0 = S.sub; const sid = window.CHASSE.find(31).sid; S.sub = sid; const a = E.guildBonus(S, "kamas"); S.sub = sub0; return a >= E.HUNT.dom; }))) fail("chasse : la région dominée ne donne pas +5 % de kamas");
    await page.click('[data-act="hc-map"]'); await page.waitForSelector(".pc-legend", { timeout: 5000 }).catch(() => fail("chasse : légende absente de la carte"));
    await page.evaluate(() => { window.DX.ui.mapTier = -1; window.DX.render(); }); await page.waitForTimeout(200);
    if (!/domine/.test(await page.textContent("#main"))) fail("chasse : domination absente de la carte");
    await gwide("la carte des Percepteurs", "guilde-carte");
    // Alliances et prismes (1.1) : invitation acceptée, bataille en cours, combat, Percepteur allié, salon du chat, carte
    await page.evaluate(() => { const G = window.GUILD.G; G.tab = "alliance"; G.atk = null; G.view = null; window.DX.ui.tab = "guild"; window.DX.render(); window.ALLY.load(true); });
    await page.waitForSelector('[data-act="al-inv"][data-v="1"]', { timeout: 8000 }).catch(() => fail("alliances : invitation absente"));
    { const t = await gtxt(); ["Fonder une alliance", "Alliogemme", "Pacte de Djaul", "Les Gardiens d'Émeraude"].forEach((x) => { if (!t.includes(x)) fail("alliances : « " + x + " » absent (sans alliance)"); }); }
    await gwide("l'alliance (sans alliance)", "alliance-fonder");
    // fonder : le nom et le sigle tapés doivent survivre au choix de l'emblème et aux rafraîchissements de la page
    await page.fill("#alName", "Les Veilleurs"); await page.fill("#alTag", "vlr");
    await page.click('[data-act="al-ic"]:nth-child(2)'); await page.click('[data-act="al-col"]:nth-child(3)'); await page.waitForTimeout(4600);
    if ((await page.inputValue("#alName")) !== "Les Veilleurs") fail("alliances : le nom tapé s'efface (emblème ou rafraîchissement)");
    await page.click('[data-act="al-found"]'); await page.waitForTimeout(800);
    { const f = (await mock()).gm.found; if (!f || f.p_name !== "Les Veilleurs" || f.p_tag !== "VLR") fail("alliances : fondation mal envoyée (" + JSON.stringify(f) + ")"); }
    await page.waitForSelector('[data-act="al-inv"][data-v="1"]', { timeout: 8000 });
    await page.click('[data-act="al-inv"][data-v="1"]'); await page.waitForSelector(".al-ban", { timeout: 8000 }).catch(() => fail("alliances : l'alliance ne s'affiche pas après l'invitation"));
    { const t = await gtxt(); ["Bataille des prismes", "Nos prismes", "Rempart rang 2", "Percepteurs alliés", "Aider à défendre", "Poser un prisme", "Île de Moon", "Classement des alliances", "Tes combats : 3 / 10"].forEach((x) => { if (!t.includes(x)) fail("alliances : « " + x + " » absent"); }); }
    await gwide("l'alliance", "alliance");
    await page.click('[data-act="al-fight"][data-z="cania"]'); await page.waitForTimeout(1000);
    if (!((await mock()).gm.calls || []).some((b) => b.prism === "cania")) fail("alliances : combat de bataille non envoyé au serveur");
    if (!/Victoire à <b>|Victoire à Plaines de Cania/.test(await page.innerHTML("#main")) || !/Tes combats : 4 \/ 10/.test(await gtxt())) fail("alliances : résultat du combat mal affiché");
    if (!(await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE; const sub0 = S.sub; const sid = Object.keys(E.SUBS).find((k) => E.SUBS[k].zone === window.ALLY.A.d.prisms[0].zone); S.sub = sid; const a = E.guildBonus(S, "xp"); S.sub = "zzz"; const b = E.guildBonus(S, "xp"); S.sub = sub0; return a - b === 6; }))) fail("alliances : le prisme ne donne pas +5 % (+1 % de Sagesse) d'XP dans sa région");
    await page.click('[data-act="g-rdef"][data-g="88"]'); await page.waitForTimeout(800);
    if (!((await mock()).gm.calls || []).some((b) => b.raid && b.raid.def === 88)) fail("alliances : défense d'un Percepteur allié non envoyée");
    await page.click('[data-act="al-chat"]'); await page.waitForTimeout(800);
    if (!(await page.$('#chat [data-act="ch-tab"][data-v="a"]'))) fail("alliances : salon Alliance absent du chat");
    if (!/Tous à Cania ce soir/.test(await page.textContent("#chat"))) fail("alliances : messages de l'alliance absents du chat");
    await page.click('[data-act="ch-close"]').catch(() => {});
    await page.evaluate(() => { window.DX.ui.tab = "world"; window.DX.ui.world = "map"; window.DX.ui.mapTier = -1; window.DX.render(); }); await page.waitForTimeout(300);
    if (!(await page.$(".al-legend")) || !(await page.$(".zonefold .al-chip, .wm-z.pr"))) fail("alliances : prismes absents de la carte du Monde");
    await gwide("la carte des prismes", "alliance-carte");
    // retour à l'accueil de la guilde pour le test du départ
    await page.evaluate(() => { const G = window.GUILD.G; G.tab = "home"; G.atk = null; G.view = null; window.DX.ui.tab = "guild"; window.DX.render(); });
    await page.waitForSelector(".gban", { timeout: 8000 }).catch(() => fail("guildes : bandeau absent au retour"));
    // 1.0.34.1 : quitter la guilde depuis le bandeau (confirmation, Annuler, puis Oui, quitter)
    await page.click('.gban [data-act="g-leave"]'); await page.waitForSelector('.gban [data-act="g-leave2"]');
    if (!/Tu pourras en rejoindre une autre/.test(await page.textContent(".gban"))) fail("guildes : quitter sans explication");
    await gwide("la confirmation de départ", "guilde-quitter");
    await page.click('.gban [data-act="g-leave0"]'); await page.waitForSelector('.gban [data-act="g-leave"]');
    if ((await mock()).gm.left) fail("guildes : Annuler a quitté la guilde");
    await page.click('.gban [data-act="g-leave"]'); await page.click('.gban [data-act="g-leave2"]');
    await page.waitForSelector('.gban', { state: "detached", timeout: 8000 }).catch(() => fail("guildes : toujours dans la guilde après Quitter"));
    if ((await mock()).gm.left !== 1) fail("guildes : départ non envoyé au serveur");
    await navClick(page, "world");
    // 7h. 1.0.30 : la Communauté. Alignement (camp du serveur, guerre de la semaine), Songe infini classé, Panel Xener
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const W = window.ENGINE.weekIdx();
      d.views.lb_align = [{ user_id: "u9", pseudo: "Kralamour", side: "brakmar", ord: "coeur", lvl: 80, chap: 3, main: "iop", main_lvl: 200 }, { user_id: "u8", pseudo: "Tofuline", side: "bonta", ord: "coeur", lvl: 41, chap: 2, main: "eni", main_lvl: 180 }];
      d.views.lb_songe = [{ user_id: "u9", pseudo: "Kralamour", main: "iop", main_lvl: 200, w: W, ii: 4, waves: 30, r: 1 }, { user_id: "u8", pseudo: "Tofuline", main: "eni", main_lvl: 180, w: W, ii: 3, waves: 22, r: 2 }];
      d.war = { b: 1200, k: 800 }; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE; S.chars[0].lvl = Math.max(S.chars[0].lvl, E.ALIGN_MIN_LVL); E.chooseAlign(S, "brakmar", "coeur"); window.DX.ui.tab = "quests"; window.DX.ui.qt = "align"; window.DX.render(); });
    await page.evaluate(() => Promise.all([window.ALIGNUI.warLoad(true), window.ALIGNUI.campLoad(true)])); await page.waitForTimeout(300);
    { const tx = await page.textContent("#main"); ["Guerre des cités", "Bonta 60 %", "Kralamour", "victoire de Brâkmar", "Quêtes de Brâkmar"].forEach((x) => { if (!tx.includes(x)) fail("alignement : « " + x + " » absent de la page"); }); if (/—/.test(tx)) fail("alignement : tiret long dans la page"); }
    if (!(await page.evaluate(() => window.ENGINE.alignWarOn()))) fail("alignement : le camp gagnant de la semaine passée n'a pas son bonus");
    if (!(await page.evaluate(() => /al-w k/.test(window.DX.social.pname("Kralamour", "u9")) && /al-w b/.test(window.DX.social.pname("Tofuline", "u8"))))) fail("alignement : le camp du serveur n'est pas affiché à côté du pseudo");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/alignement.png", fullPage: true });
    // Songe infini : classement de la semaine, record envoyé au serveur (rejoué là-bas), lots récupérés
    await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE; const wk = E.sgWeek(S); wk.ii = 2; wk.waves = 20; S.panelUsed = false; window.DX.ui.tab = "exp"; window.DX.render(); });
    await page.evaluate(() => window.SGUI.rkLoad(true)); await page.waitForTimeout(200);
    if (!/Kralamour/.test((await page.textContent("#sgRank").catch(() => "")) || "")) fail("Songe : classement de la semaine absent");
    await page.evaluate(() => window.SGUI.submit()); await page.waitForTimeout(400);
    m = await mock(); if (!(m.songeSub >= 1)) fail("Songe : record de la semaine non envoyé au serveur");
    if (!(m.claims >= 1)) fail("Songe : lots de la semaine passée jamais demandés");
    { const r = await page.evaluate(() => { const S = window.DX.S, E = window.ENGINE; const op = S.hdv && S.hdv.op; const b0 = E.songe(S).br; window.MARKET.apply([{ id: 99999, p: { bribes: 1000 } }], true); const b1 = E.songe(S).br; S.hdv.op = op; return b1 - b0; });
      if (r !== 1000) fail("Songe : Bribes des lots non ajoutées (" + r + ")"); }
    // 2.1.26.3 : Grand défi du dimanche lancé depuis l'Accueil : la règle votée est lue au serveur avant de jouer (le serveur rejoue avec elle)
    { const r = await page.evaluate(async () => {
        const E = window.ENGINE, S = window.DX.S; const day0 = E.defiDay, sun0 = E.defiSunday; const fake = day0() + 7 * 52;
        const keep = JSON.stringify({ defi: S.defi, defiStreak: S.defiStreak, defiLog: S.defiLog, defiHist: S.defiHist, defiVoteRes: S.defiVoteRes, kamas: S.kamas, cnt: S.cnt });
        E.defiDay = () => fake; E.defiSunday = () => true;
        try {
          const wk = E.defiWeek(fake); const opts = E.defiVoteOpts(wk); delete E.DEFI_VOTE[wk];
          const d = JSON.parse(localStorage.getItem("__mock")); d.views = d.views || {}; d.views.defi_vote_count = [{ week: wk, rule: opts[2], n: 8 }, { week: wk, rule: opts[0], n: 1 }]; localStorage.setItem("__mock", JSON.stringify(d));
          const T = E.DEFI_TIERS.find((x) => E.defiTierOk(S, x.id)); if (!T) return "aucun palier";
          const b = document.createElement("button"); b.dataset.act = "sm-dplay"; b.dataset.v = T.id; document.querySelector("#main").appendChild(b); b.click(); b.remove();
          for (let i = 0; i < 40 && !(S.defi && S.defi.day === fake && S.defi.tries.length); i++) await new Promise((ok) => setTimeout(ok, 50));
          const st = S.defi && S.defi.day === fake ? S.defi : null; if (!st || !st.tries.length) return "défi pas joué";
          return E.defiVoteWin(wk) === opts[2] && E.defi(T.id, fake).rules.includes(opts[2]) ? "ok" : "règle votée absente : " + E.defi(T.id, fake).rules.join(",");
        } finally { E.defiDay = day0; E.defiSunday = sun0; Object.assign(S, JSON.parse(keep)); window.DX.social.closeSheet(); }
      });
      if (r !== "ok") fail("Grand défi : la règle votée n'est pas lue avant de jouer depuis l'Accueil (" + r + ")"); }
    // Panel Xener : menu par thème, recherche d'actions, onglet Test ; les modérateurs ne voient que le chat
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector(".adm .px-nav", { timeout: 5000 }).catch(() => fail("Panel Xener : menu par thème absent"));
    await page.click("#pxQ"); await page.keyboard.type("Krala"); await page.waitForTimeout(200);
    if (await page.$('#pxRes button:has-text("Chercher le joueur")')) { await page.click('#pxRes button:has-text("Chercher le joueur")'); await page.waitForSelector('.adm [data-act="adm-sel"]', { timeout: 5000 }).catch(() => fail("Panel Xener : la recherche d'un pseudo n'ouvre pas Joueurs")); }
    else fail("Panel Xener : « Chercher le joueur » absent de la recherche");
    await page.click('.adm [data-act="adm-tab"][data-v="test"]'); await page.waitForSelector('.adm [data-adm="preset"]', { timeout: 5000 }).catch(() => fail("Panel Xener : onglet Test absent"));
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.role = "mod"; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.CHAT.refresh()); await page.waitForTimeout(300);
    await page.click('#status [data-act="adm-open"]'); await page.click('.adm [data-act="adm-tab"][data-v="vue"]'); await page.waitForSelector(".adm .kpis", { timeout: 5000 }).catch(() => fail("Panel Xener : vue des modérateurs absente"));
    { const V = await page.$$eval('.adm [data-act="adm-tab"]', (L) => L.map((b) => b.dataset.v)); if (V.some((v) => !["vue", "joueurs", "sig", "test"].includes(v)) || (await page.$(".adm #pxQ"))) fail("Panel Xener : un modérateur voit des outils réservés à l'admin : " + V.join(", ")); } // « test » : outils de la version de test, sur la partie de l'appareil seulement
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.role = "admin"; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.evaluate(() => window.CHAT.refresh()); await page.waitForTimeout(300);
    await page.evaluate(() => { window.DX.ui.tab = "world"; window.DX.render(); window.scrollTo(0, 0); });
    // 8. mobile : la pastille tient dans la barre
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // bulle de découverte du tutoriel (comme en 7f)
    const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`page trop large sur téléphone : ${w}px`);
    await page.click("#chat .chmin"); await page.waitForSelector("#chat .ch-list", { timeout: 3000 });
    const cw = await page.evaluate(() => document.querySelector("#chat").getBoundingClientRect().width); if (cw > 392) fail(`chat trop large sur téléphone : ${cw}px`);
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-mob.png" });
    await page.click('#chat [data-act="ch-tab"][data-v="g"]'); await page.evaluate(() => window.__chatEmit({ id: 900, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Copie-moi", kind: "msg", created_at: new Date().toISOString() })); await page.waitForTimeout(100);
    await page.click('#chat [data-act="ch-who"][data-id="900"]'); // 1.0.3.3 : « Copier le message » au téléphone
    if (await page.evaluate(() => { const m = document.querySelector("#chMenu"), b = m && m.querySelector('[data-act="ch-copy"]'); if (!b) return true; const r = m.getBoundingClientRect(); return r.right > innerWidth || r.left < 0 || r.bottom > innerHeight; })) fail("chat : menu « Copier le message » absent ou hors de l'écran (téléphone)");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/chat-copier-mob.png" });
    await page.evaluate(() => { const m = document.querySelector("#chMenu"); if (m) m.remove(); });
    const hw = await page.evaluate(() => document.querySelector("#chat .ch-head").scrollWidth); if (hw > 392) fail(`onglets du chat trop larges sur téléphone : ${hw}px`);
    // 0.1.35.3 : le bouton pour réduire le chat reste dans le cadre, même avec tous les onglets et des pastilles
    if (await page.evaluate(() => { const C = window.CHAT.state; C.unread = 120; C.unreadP = 15; C.unreadH = 99; window.CHAT.repaint(); const c = document.querySelector("#chat").getBoundingClientRect(), x = document.querySelector("#chat .ch-x").getBoundingClientRect(); C.unread = C.unreadP = C.unreadH = 0; window.CHAT.repaint(); return x.right > c.right || x.left < c.left; })) fail("chat : bouton de fermeture hors du cadre (téléphone)");
    await page.evaluate(() => { document.querySelectorAll("#toasts .toast").forEach((e) => e.remove()); window.DX.social.toast("Un"); window.DX.social.toast("Deux"); });
    if (await page.evaluate(() => { const v = [...document.querySelectorAll("#toasts .toast")].filter((e) => e.offsetParent); const r = document.querySelector("#chIn").getBoundingClientRect(); return v.length !== 1 || v[0].getBoundingClientRect().bottom > r.top; })) fail("notifications : mal placées au téléphone, chat ouvert");
    await page.waitForTimeout(400);
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/notif-tel.png" });
    await page.click("#chat .ch-x");
    // 8 bis. 0.1.50.1 : changer son pseudo depuis Options › Sauvegarde, puis refus avant 30 jours
    await page.evaluate(() => window.DX.social.options("sauvegarde")); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-renpseudo"]');
    await page.waitForSelector("#onRenPseudo"); await page.fill("#onRenPseudo", "Bouftoune"); await page.press("#onRenPseudo", "Enter"); await page.waitForTimeout(400);
    m = await mock(); if (m.profiles[0].pseudo !== "Bouftoune") fail("pseudo : changement non enregistré");
    if (!/Bouftoune/.test(await page.textContent(".sheet"))) fail("pseudo : nouveau pseudo absent des Options");
    await page.click('.sheet [data-act="on-renpseudo"]'); await page.waitForTimeout(300);
    if (!(await page.$('.sheet [data-act="on-renpseudogo"][disabled]'))) fail("pseudo : second changement possible avant 30 jours");
    if (!/Prochain changement possible/.test(await page.textContent(".sheet"))) fail("pseudo : date du prochain changement absente");
    await page.click('.sheet [data-act="on-renpseudono"]'); await page.click('.sheet [data-act="closesheet"]').catch(() => {}); await page.keyboard.press("Escape");
    // 8 ter. 1.0.6.3 : un code utilisé dont la partie a perdu la trace (code MERCI) est redonné tout seul, une seule fois
    const gb = await page.evaluate(() => { const S = window.DX.S; delete (S.gifts || {})["srv:MERCI"]; return { or: (S.cons || {}).coffre_or || 0, t: (S.titlesExtra || []).length }; });
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); d.giftMine = [{ code: "MERCI", reward: { c: [["coffre_or", 1], ["coffre_argent", 1], ["coffre_bois", 1]], s: 1, t: "Xener va jamais pouvoir jouer" }, msg: "Merci !" }]; localStorage.setItem("__mock", JSON.stringify(d)); });
    await page.waitForFunction(() => (window.DX.S.gifts || {})["srv:MERCI"], null, { timeout: 15000 }).catch(() => fail("code MERCI : récompenses non récupérées"));
    await page.waitForTimeout(5500);
    const ga = await page.evaluate(() => { const S = window.DX.S; return { or: (S.cons || {}).coffre_or || 0, t: (S.titlesExtra || []).filter((x) => x === "Xener va jamais pouvoir jouer").length }; });
    if (ga.or !== gb.or + 1 || ga.t !== 1) fail("code MERCI : récompenses mal redonnées " + JSON.stringify([gb, ga]));
    // 8 quater. 1.0.29.6 : connexion qui se renouvelle en boucle (heure de l'appareil 2 h en avance) : coupée sur cet appareil seulement, joueur prévenu
    const sess = (await mock()).session;
    const renew = (n) => page.evaluate((n) => { const iat = Math.round(Date.now() / 1000) - 2 * 3600; const s = { expires_in: 3600, expires_at: iat + 3600, user: JSON.parse(localStorage.getItem("__mock")).session }; for (let i = 0; i < n; i++) window.__authCb("TOKEN_REFRESHED", s); }, n);
    await renew(20); await page.waitForTimeout(300);
    if (!(await mock()).session || (await page.$eval("#onPill", (e) => e.dataset.st)) === "anon") fail("boucle de connexion : coupée avant 20 renouvellements en une minute");
    await renew(1); await page.waitForTimeout(400);
    m = await mock();
    if (m.session || m.signOutScope !== "local") fail("boucle de connexion : session pas fermée sur cet appareil seulement (" + m.signOutScope + ")");
    if (!/2 h d'avance/.test(await page.textContent("#toasts"))) fail("boucle de connexion : le joueur n'est pas prévenu de l'heure de son appareil");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/boucle-connexion.png" });
    if (!(await S())) fail("boucle de connexion : partie perdue");
    await page.evaluate((s) => { const d = JSON.parse(localStorage.getItem("__mock")); d.session = s; delete d.signOutScope; localStorage.setItem("__mock", JSON.stringify(d)); }, sess);
    await page.reload(); await page.waitForSelector("#nav [data-nk]", { state: "attached", timeout: 10000 });
    await page.waitForFunction(() => document.querySelector("#onPill") && document.querySelector("#onPill").dataset.st === "ok", null, { timeout: 10000 });
    // 8 quinquies. 1.0.30 : un Dofus Sublimé part dans le résumé envoyé (meta.dsub) : le serveur l'annonce (supabase/collections.sql)
    await page.evaluate(() => { const { E, S } = window.DX; E.rollItem(S, "dofus_emeraude", { radiant: false }); (S.dofPot = S.dofPot || {}).emeraude = { r: 10, e: 0 }; return window.DX.social.onPush(); });
    await page.waitForTimeout(300);
    m = await mock(); { const mt = (m.saves.u1 || {}).meta || {}; if (!(mt.dsub || []).includes("emeraude") || !(mt.dofus || []).includes("emeraude")) fail("Dofus Sublimé absent du résumé envoyé : " + JSON.stringify(mt.dsub)); }
    // 9. suppression du compte
    await page.evaluate(() => window.DX.social.options("sauvegarde")); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-askdelete"]');
    await page.fill("#onDelPseudo", "bouftoune"); await page.click('[data-act="on-delete"]'); await page.waitForTimeout(400);
    m = await mock(); if (m.saves.u1 || m.profiles.length) fail("compte non supprimé");
    if (!(await S())) fail("partie de l'appareil perdue après suppression");

    // 10. 1.0.11 : « Choisis ta partie » : trois parties, la 1 pour les classements, la 2 et la 3 en solo
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx2.addInitScript(MOCK);
    await ctx2.addInitScript(() => { window.__IDLUS_NOLAUNCH = true; if (localStorage.getItem("__wipe")) { ["dofousxen-save-beta", "dofousxen-save-beta-copies", "dofousxen-save-beta-online", "dofousxen-save-beta-version"].forEach((k) => localStorage.removeItem(k)); localStorage.removeItem("__wipe"); } }); // __wipe : appareil vidé avant le chargement (la page sauvegarde en partant)
    await ctx2.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    const p2 = await ctx2.newPage();
    p2.on("console", (x) => { if (x.type() === "error") fail(`parties, console : ${x.text()}`); });
    p2.on("pageerror", (e) => fail(`parties, exception : ${e.message}`));
    const mock2 = () => p2.evaluate(() => JSON.parse(localStorage.getItem("__mock") || "{}"));
    const S2 = () => p2.evaluate(() => window.DX.S && { kamas: window.DX.S.kamas, n: window.DX.S.chars.length, name: window.DX.S.chars[0].name });
    const card = (n) => `.svc2[data-slot="${n}"]`;
    // compte déjà connecté avec une partie 1 en ligne, aucune partie sur cet appareil (nouvel appareil)
    await p2.goto(base); await p2.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await p2.fill("#startName", "Premier"); await p2.click('[data-act="startgame"]'); await p2.waitForSelector("#nav [data-nk]");
    await p2.evaluate(() => { window.DX.S.kamas = 50000; window.DX.saveNow(); const txt = localStorage.getItem("dofousxen-save-beta");
      const d = JSON.parse(localStorage.getItem("__mock") || '{"session":null,"profiles":[],"saves":{}}'); d.session = { id: "u2", email: "deux@idlus.fr", identities: [{ provider: "discord", identity_data: { global_name: "Deux" } }] };
      d.profiles.push({ id: "u2", pseudo: "Sadidette" }); d.saves.u2 = { data: txt, meta: { level: 1, succes: 0, n: 1, lvl: 1, pid: "pc" }, device: "ordinateur", game_version: "1.0.10", updated_at: "2026-10-13T10:00:00.000001Z" };
      localStorage.setItem("__mock", JSON.stringify(d)); localStorage.setItem("__wipe", "1"); });
    await p2.reload(); await p2.waitForSelector(".svm", { timeout: 10000 });
    if (!/Sur ton compte/.test(await p2.textContent(card(1)))) fail("parties : la partie en ligne d'un nouvel appareil n'est pas proposée");
    await p2.click(`${card(1)} [data-act="sv-play"]`); await p2.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    if ((await S2()).kamas !== 50000) fail("parties : la partie 1 en ligne n'est pas chargée");
    // partie 2 : nouvelle aventure, sauvegarde à part (sur l'appareil et en ligne), jamais dans saves
    await p2.evaluate(() => window.DX.social.options("sauvegarde")); await p2.click('.sheet [data-act="opttab"][data-v="sauvegarde"]');
    if (!/Partie 1/.test(await p2.textContent(".sheet"))) fail("parties : la partie en cours n'est pas indiquée dans les Options");
    await p2.click('.sheet [data-act="sv-menu"]'); await p2.waitForSelector(".svm", { timeout: 10000 });
    if (!(await p2.$(`${card(1)}.last`))) fail("parties : « Dernière jouée » absent");
    await p2.click(`${card(2)} [data-act="sv-play"]`); await p2.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    if (!/Partie 2/.test(await p2.textContent(".svback"))) fail("parties : le choix du héros n'indique pas la partie 2");
    await p2.fill("#startName", "Second"); await p2.click('[data-act="startgame"]'); await p2.waitForSelector("#nav [data-nk]");
    await p2.waitForFunction(() => document.querySelector("#onPill") && document.querySelector("#onPill").dataset.st === "ok", null, { timeout: 10000 }).catch(() => fail("parties : la partie 2 n'est pas envoyée en ligne"));
    let m2 = await mock2();
    if (!m2.slots || !m2.slots["u2:2"] || JSON.parse(m2.slots["u2:2"].data).chars[0].name !== "Second") fail("parties : partie 2 absente du serveur");
    if (JSON.parse(m2.saves.u2.data).chars[0].name !== "Premier") fail("parties : la partie 2 a écrasé la partie 1 en ligne");
    if (JSON.parse(await p2.evaluate(() => localStorage.getItem("dofousxen-save-beta"))).chars[0].name !== "Premier") fail("parties : la partie 2 a écrasé la partie 1 de l'appareil");
    // une partie solo n'entre pas aux classements et ne touche ni à l'Hôtel de vente, ni à la guilde, ni au Kolizéum classé
    const inv0 = (m2.invoked || []).length;
    const solo = await p2.evaluate(async () => { const O = window.ONLINE; return { solo: O.solo(), rec: await O.submitRecord("x"), hdv: await O.rpc("hdv_buy", { p_id: 1 }), sync: await O.rpc("hdv_sync", { p_after: 0 }), vd: await O.rpc("vente_sell", { p_after: 0, p_lots: {} }), jt: await O.rpc("foire_jackpot_buy", { p_after: 0, p_n: 1 }), list: (await O.rpc("guild_list")).err || null }; });
    if (!solo.solo || solo.rec.ok !== false || !solo.hdv.err || !solo.sync.err || !solo.vd.err || !solo.jt.err || solo.list) fail("parties : une partie solo peut agir sur le serveur " + JSON.stringify(solo));
    if (((await mock2()).invoked || []).length !== inv0) fail("parties : record envoyé depuis une partie solo");
    await p2.evaluate(() => { window.DX.ui.tab = "hdv"; window.DX.render(); }); await p2.waitForTimeout(300);
    if (!/Partie 2 : solo/.test(await p2.textContent("#main"))) fail("parties : l'Hôtel de vente ne signale pas la partie solo");
    await p2.evaluate(() => { window.DX.ui.tab = "guild"; window.DX.render(); }); await p2.waitForTimeout(300);
    if (!/Partie 2 : solo/.test(await p2.textContent("#main"))) fail("parties : la guilde ne signale pas la partie solo");
    await p2.evaluate(() => { window.DX.ui.tab = "koli"; window.DX.render(); }); await p2.waitForTimeout(300);
    if (!/Partie solo/.test(await p2.textContent("#main"))) fail("parties : le Kolizéum ne signale pas la partie solo");
    await p2.evaluate(() => { window.DX.ui.tab = "ladder"; window.DX.render(); }); await p2.waitForTimeout(300);
    if (!/Partie 2 : solo/.test(await p2.textContent("#main"))) fail("parties : les classements ne signalent pas la partie solo");
    if (process.env.SHOTS) await p2.screenshot({ path: process.env.SHOTS + "/solo-classements.png" });
    await p2.evaluate(() => { window.DX.ui.tab = "home"; window.DX.render(); });
    // 4A sur la partie 2 : un autre appareil a avancé en ligne, celui-ci aussi -> les deux versions, on prend celle en ligne
    await p2.evaluate(() => { window.DX.S.kamas = 7000; window.DX.saveNow(); }); await p2.click("#onPill"); await p2.waitForTimeout(400);
    await p2.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock")); const x = d.slots["u2:2"]; const st = JSON.parse(x.data); st.kamas = 9999; x.data = JSON.stringify(st); x.updated_at = "2099-02-01T00:00:00.000001Z"; x.device = "téléphone"; x.meta = Object.assign({}, x.meta, { pid: "tel", km: 9999 }); localStorage.setItem("__mock", JSON.stringify(d)); window.DX.S.kamas = 8000; window.DX.saveNow(); });
    await p2.reload(); await p2.waitForSelector(".svm", { timeout: 10000 });
    if (!(await p2.$(`${card(2)} .svver`)) || !/téléphone/.test(await p2.textContent(`${card(2)} .svver`))) fail("parties : conflit de la partie 2 non montré");
    await p2.click(`${card(2)} [data-act="sv-play"][data-w="remote"]`); await p2.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    if ((await S2()).kamas !== 9999) fail("parties : version en ligne de la partie 2 non chargée");
    if (!(await p2.evaluate(() => JSON.parse(localStorage.getItem("dofousxen-save-beta-2-copies") || "[]").some((c) => c.why === "avant")))) fail("parties : l'autre version de la partie 2 n'est pas gardée en copie");
    // supprimer la partie 2 : effacée de l'appareil et du compte, une copie reste
    await p2.evaluate(() => window.DX.social.options("sauvegarde")); await p2.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await p2.click('.sheet [data-act="sv-menu"]'); await p2.waitForSelector(".svm", { timeout: 10000 });
    await p2.click(`${card(2)} [data-act="sv-del"]`); await p2.click(`${card(2)} [data-act="sv-delgo"]`); await p2.waitForSelector(`${card(2)}.empty`, { timeout: 5000 });
    m2 = await mock2();
    if (m2.slots["u2:2"] || (await p2.evaluate(() => localStorage.getItem("dofousxen-save-beta-2")))) fail("parties : partie 2 pas supprimée");
    if (!m2.saves.u2) fail("parties : la suppression de la partie 2 a touché la partie 1");
    // serveur injoignable au lancement : l'écran montre les parties de l'appareil et laisse jouer
    await p2.evaluate(() => { window.__offline = true; });
    await p2.addInitScript(() => { window.__offline = true; });
    await p2.reload(); await p2.waitForSelector(".svm", { timeout: 10000 });
    if (!/Serveur injoignable/.test(await p2.textContent(".svacc"))) fail("parties : serveur coupé non signalé");
    if (process.env.SHOTS) await p2.screenshot({ path: process.env.SHOTS + "/menu-hors-ligne.png", fullPage: true });
    await p2.click(`${card(1)} [data-act="sv-play"]`); await p2.waitForSelector("#nav [data-nk]", { timeout: 10000 });
    if ((await S2()).name !== "Premier") fail("parties : partie 1 non jouable serveur coupé");
    await ctx2.close();
    // parties 2 et 3 tant que le serveur n'a pas leur table (tools/emplacements.sql pas encore appliqué) : sur l'appareil seulement
    const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx3.addInitScript(MOCK); await ctx3.addInitScript(() => { window.__IDLUS_NOLAUNCH = true; window.__IDLUS_NOSLOTS = true; });
    await ctx3.route((url) => !url.href.startsWith(base), (route) => route.fulfill({ status: 200, body: "" }));
    const p3 = await ctx3.newPage();
    p3.on("console", (x) => { if (x.type() === "error") fail(`parties (téléphone), console : ${x.text()}`); });
    p3.on("pageerror", (e) => fail(`parties (téléphone), exception : ${e.message}`));
    await p3.goto(base); await p3.waitForSelector('[data-act="startgame"]', { timeout: 10000 });
    await p3.click('[data-act="startgame"]'); await p3.waitForSelector("#nav [data-nk]", { state: "attached" });
    await p3.evaluate(() => { const d = JSON.parse(localStorage.getItem("__mock") || '{"session":null,"profiles":[],"saves":{}}'); d.session = { id: "u3", identities: [] }; d.profiles.push({ id: "u3", pseudo: "Troisieme" }); localStorage.setItem("__mock", JSON.stringify(d)); });
    await p3.reload(); await p3.waitForSelector(".svm", { timeout: 10000 });
    await p3.click(`${card(3)} [data-act="sv-play"]`); await p3.waitForSelector('[data-act="startgame"]'); await p3.click('[data-act="startgame"]'); await p3.waitForSelector("#nav [data-nk]", { state: "attached" });
    await p3.waitForTimeout(600);
    if (await p3.$("#onPill")) fail("parties : pastille d'envoi sur une partie qui reste sur l'appareil");
    if (((await p3.evaluate(() => JSON.parse(localStorage.getItem("__mock")))).slotPushes || 0) > 0) fail("parties : envoi en ligne alors que le serveur n'a pas les parties 2 et 3");
    await p3.reload(); await p3.waitForSelector(".svm", { timeout: 10000 });
    if (!/Gardée sur cet appareil/.test(await p3.textContent(card(3)))) fail("parties : la partie 3 ne dit pas qu'elle reste sur l'appareil");
    const w3 = await p3.evaluate(() => document.documentElement.scrollWidth); if (w3 > 392) fail(`parties : écran trop large sur téléphone : ${w3}px`);
    if (process.env.SHOTS) await p3.screenshot({ path: process.env.SHOTS + "/menu-tel-3.png", fullPage: true });
    // sans compte (5A) : même écran, « Se connecter avec Discord » en haut
    await p3.click('.svm [data-act="sv-logout"]'); await p3.waitForSelector('.svm [data-act="on-discord"]', { timeout: 10000 });
    if ((await p3.$$(".svm .svc2:not(.empty)")).length !== 2) fail("parties : sans compte, les parties de l'appareil ne sont pas toutes montrées");
    // 1.0.30 : sans compte, la vente directe montre les prix et invite à créer un compte ; le surplus part au marchand de secours (v-guest)
    await p3.click('.svc2[data-slot="1"] [data-act="sv-play"]'); await p3.waitForSelector("#nav [data-nk]", { state: "attached", timeout: 10000 });
    await p3.evaluate(() => { const S = window.DX.S; S.res["Laine de Bouftou"] = 500; S.resCap["Laine de Bouftou"] = 100; window.ENGINE.emit(S, "harvest", { n: 1 }); window.DX.ui.tab = "cours"; window.DX.render(); });
    await p3.waitForSelector(".vd-cours", { timeout: 8000 }).catch(() => fail("vente directe (invité) : prix absents"));
    if (!(await p3.$('.vd-guest [data-act="on-loginscreen"]'))) fail("vente directe (invité) : pas d'invitation à créer un compte");
    if ((await p3.evaluate(() => window.DX.S.res["Laine de Bouftou"])) !== 100) fail("vente directe (invité) : le marchand de secours ne rachète plus le surplus");
    if (process.env.SHOTS) await p3.screenshot({ path: process.env.SHOTS + "/cours-invite-mob.png", fullPage: true });
    await p3.evaluate(() => { window.DX.ui.tab = "foire"; window.DX.render(); }); await p3.waitForSelector("#foJack .fo-jack", { timeout: 8000 }).catch(() => fail("foire (invité) : pot absent"));
    if (!(await p3.$('#foJack [data-act="on-loginscreen"]')) || (await p3.$('[data-act="fo-jbuy"]'))) fail("foire (invité) : tickets achetables sans compte");
    await p3.evaluate(() => window.DX.saveNow()); await p3.reload(); await p3.waitForSelector(".svm", { timeout: 10000 });
    if (process.env.SHOTS) await p3.screenshot({ path: process.env.SHOTS + "/menu-invite-mob.png", fullPage: true });
    await ctx3.close();
  } catch (e) { if (errors.length) console.error("Déjà en échec avant l'arrêt :\n" + errors.join("\n")); throw e; } // 1.0.23 : les échecs déjà notés ne sont plus perdus
  finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC :\n" + errors.join("\n")); process.exit(1); }
  console.log("Compte et sauvegarde en ligne : OK");
})();
