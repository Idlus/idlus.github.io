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
  window.__IDLUS_SB = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: user() ? { user: user() } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOAuth: async () => { const d = db(); d.session = { id: "u1", email: "test@idlus.fr", identities: [{ provider: "discord", identity_data: { global_name: "Testeur" } }] }; put(d); location.reload(); return { error: null }; },
      signInWithOtp: async () => ({ error: null }),
      signOut: async () => { const d = db(); d.session = null; put(d); return { error: null }; },
      linkIdentity: async () => ({ error: null }),
    },
    from: q,
    channel: () => { const hs = []; const ch = { on: (ev, o, cb) => { if (ev === "postgres_changes") hs.push(cb); return ch; }, subscribe: (cb) => { window.__chatSub = cb; if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; }, track: () => {}, presenceState: () => ({ u1: [{}], u9: [{}], u8: [{}] }) };
      window.__chatEmit = (m) => hs.forEach((cb) => cb({ new: m })); return ch; },
    removeChannel: () => {},
    functions: { invoke: async (name, o) => { const d = db(); d.invoked = (d.invoked || []).concat([o.body.did]); put(d); return { data: Object.assign({ ok: true, did: o.body.did, dname: "Donjon test", k: 3, t: 72, improved: true, rank: 2 }, d.recordReply || {}), error: null }; } },
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
      if (name === "chat_me") return { data: { banned: false }, error: null };
      if (name === "staff_list") return { data: [{ u: "u9", p: "Kralamour", r: "crea" }, { u: "u8", p: "Tofuline", r: "mod" }], error: null };
      if (name === "my_role") return { data: d.role || null, error: null };
      if (name === "adm_overview") return { data: { accounts: d.profiles.length, active: 1, reports: 1, flagged: 0, muted: 0, signups: [{ id: "u9", pseudo: "Kralamour", cls: "iop", at: new Date().toISOString() }], log: [{ at: new Date().toISOString(), txt: "test", who: "Xener" }], settings: { min_level: 0, slow_s: 4 }, role: d.role }, error: null };
      if (name === "adm_players") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", level: 4812, playtime: 7200, heroes: [{ cls: "iop", lvl: 200, ren: 1 }], created_at: new Date().toISOString(), last_save: new Date().toISOString(), reports: 1, flagged: false }], error: null };
      if (name === "adm_msgs" || name === "adm_mods" || name === "adm_flagged") return { data: [], error: null };
      if (name === "adm_reports") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", n: 1, reasons: "Spam", bodies: ["coucou"] }], error: null };
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
      if (name === "hdv_sync" || name === "trade_state") return { data: name === "hdv_sync" ? { ops: [] } : null, error: null };
      if (name === "hdv_buy") { if (d.hdvSold) return { data: { err: "Déjà vendu." }, error: null }; d.hdvSold = true; put(d); return { data: { ok: true, ops: [{ id: 1, p: { k: -5000, add: [item] }, t: "Acheté : " + T.name }] }, error: null }; }
      // 0.1.33 : offres d'achat
      if (name === "hdv_orders_list") return { data: d.ordSold ? [] : [{ id: 5, cat: "res", key: "Laine de Bouftou", name: "Laine de Bouftou", lvl: 1, left: 50, qty: 50, price: 30, exp: new Date(Date.now() + 864e5 * 3).toISOString(), mine: false }], error: null };
      if (name === "hdv_orders_mine") return { data: d.ordMine || [], error: null };
      if (name === "hdv_order_new") { const held = a.p_qty * a.p_price + Math.ceil(a.p_qty * a.p_price * 0.02); d.ordMine = [{ id: 9, cat: a.p_cat, key: a.p_key, name: a.p_name, qty: a.p_qty, filled: 0, price: a.p_price, held, st: "open", exp: new Date(Date.now() + 864e5 * a.p_days).toISOString() }]; put(d);
        return { data: { ok: true, ops: [{ id: 3, p: { k: -held }, t: "Offre d'achat" }] }, error: null }; }
      if (name === "hdv_order_fill") { d.ordSold = true; put(d); return { data: { ok: true, n: a.p_qty, k: a.p_qty * 30, ops: [{ id: 2, p: { k: a.p_qty * 30, res: { "Laine de Bouftou": -a.p_qty } }, t: "Vendu à une offre d'achat" }] }, error: null }; }
      if (name === "guild_me") return { data: { g: null, invites: [{ gid: 3, name: "Les Bouftous", ic: "dofus", col: "#8cc63f", lvl: 4, n: 7, by: "Kralamour" }], asks: [] }, error: null };
      if (name === "guild_list") return { data: [{ id: 3, name: "Les Bouftous", ic: "dofus", col: "#8cc63f", lvl: 4, open: true, motd: "", n: 7, chef: "Kralamour" }], error: null };
      if (name === "guild_give" || name === "guild_chat") return { data: name === "guild_chat" ? [] : { ok: false, none: true }, error: null };
      if (name === "adm_hdv") return { data: { open: 1, sellers: 1, sales7: 0, vol7: 0, trades7: 0, last: [], top: [{ id: 1, name: T.name, qty: 1, price: 5000, s: "Kralamour" }] }, error: null };
      // 0.1.36 : boîte à idées
      if (name === "idea_send") { const L = (d.ideas = d.ideas || []); if (L.some((x) => x.user_id === u.id && Date.now() - x.t < 600000)) return { data: "Une idée toutes les 10 minutes : réessaie un peu plus tard.", error: null };
        L.push({ id: L.length + 1, user_id: u.id, t: Date.now(), pseudo: me && me.pseudo, info: a.p_info, tag: a.p_tag, title: a.p_title, body: a.p_body, hidden: false, url: null, created_at: new Date().toISOString(), guest: false }); put(d); return { data: null, error: null }; }
      // 0.1.52.1 : fiches joueurs (la partie en ligne du joueur = la partie de ce navigateur)
      if (name === "adm_roster") return { data: [{ id: "u9", pseudo: "Kralamour", cls: "iop", level: 4812, main_lvl: 200, playtime: 7200, guild: "Les Tofus", cote: 1240, last_save: new Date().toISOString(), created_at: new Date().toISOString() }, { id: "u8", pseudo: "Tofuline", cls: "eni", level: 150, created_at: new Date().toISOString() }], error: null };
      if (name === "adm_player") return { data: { id: a.p_user, pseudo: "Kralamour", acc: { created_at: new Date().toISOString(), last_login: new Date().toISOString(), providers: ["discord"], discord: "Krala" },
        save: { data: window.ENGINE.serialize(window.DX.S), version: "0.1.52.1", device: "PC", at: new Date().toISOString(), size: 10 }, ladder: { main: "iop", main_lvl: 200, level: 4812 },
        guild: { name: "Les Tofus", lvl: 3, rank: 0, given: 12000 }, koli: { cote: 1240, best: 1300, win: 4, loss: 1, dwin: 2, dloss: 3, fights: 10 },
        hdv: { open: 2, open_k: 15000, sold: 3, sold_k: 42000, bought: 1, bought_k: 900, orders: 0, trades: 1, last: [{ name: "Blé", qty: 100, price: 900, at: new Date().toISOString(), sold: false }] },
        boss: { wb_n: 3, wb_pts: 125000, gb_n: 0, gb_pts: 0 }, gifts: [{ code: "SABLIER", at: new Date().toISOString() }], ideas: [], chat: { pub: 12, pub7: 4, priv: 2 }, mod: { reports: 1, reported: 0, log: [{ at: new Date().toISOString(), txt: "Kralamour rendu muet 1 h" }] } }, error: null };
      if (name === "adm_ideas") return { data: (d.ideas || []).slice().reverse(), error: null };
      if (name === "adm_pin") { log(); d.views = d.views || {}; d.views.chat_settings = [{ id: 1, pin_body: a.p_body, pin_chs: a.p_chs, pin_at: ts() }]; put(d); return { data: null, error: null }; } // 0.1.50.2
      if (name.startsWith("adm_")) { log(); return { data: null, error: null }; }
      if (name === "gift_mine") return d.giftMine ? { data: d.giftMine, error: null } : { data: null, error: { message: "pas encore" } }; // 1.0.6.2
      if (name === "delete_my_account") { delete d.saves[u.id]; d.profiles = d.profiles.filter((p) => p.id !== u.id); d.session = null; put(d); return { data: null, error: null }; }
    },
  }) };
};

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
    await page.click('[data-act="options"]'); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-loginscreen"]');
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
        lb_class: [{ user_id: "u9", pseudo: "Kralamour", cls: "iop", score: 320 }], lb_records: [{ user_id: "u9", pseudo: "Kralamour", main: "iop", did: "x", dname: "Château", k: 10, t: 72 }], lb_week: [], firsts: [{ kind: "lvl200", key: "", label: "Premier héros au niveau 200", pseudo: "Kralamour", user_id: "u9", at: "2026-10-12T10:00:00Z" }, { kind: "job200", key: "tailleur", label: "Premier Tailleur au niveau 200", pseudo: "Kralamour", user_id: "u9", at: "2026-10-12T11:00:00Z" }],
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
    await page.click('#nav [data-nk="ladder"]');
    // 1.0.5 : l'onglet Course s'ouvre en premier : 10 places, puis les joueurs en course
    await page.waitForSelector("#lbList .rc-slots", { timeout: 10000 });
    if ((await page.$$("#lbList .rc-slot")).length !== 10) fail("course : il faut 10 places");
    await page.click('[data-act="lb-tab"][data-v="lvl"]');
    await page.waitForSelector(".podium .pod", { timeout: 10000 });
    if ((await page.$$(".lbt .lbr")).length < 2) fail("classement : lignes manquantes (dont la mienne)");
    if (!(await page.$(".pod.is-crea .xtag")) || !(await page.$(".pod .mtag"))) fail("classement : badges créateur et modérateur absents");
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/lb.png" });
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
    await page.evaluate(() => { const S = window.DX.S; const did = Object.keys(window.DATA.DUNGEONS)[0]; S.stasis = S.stasis || {}; S.stasis[did] = { max: 3, sel: 3, firsts: {}, best: { 3: 80 } }; window.DX.saveNow(); });
    await page.click("#onPill"); await page.waitForSelector(".bigrec", { timeout: 8000 });
    if (!/Stasis 3/.test(await page.textContent(".bigrec"))) fail("fiche de record incorrecte");
    await page.click('[data-act="lb-goto"]'); await page.waitForTimeout(300);
    m = await mock(); if (!(m.invoked || []).length) fail("record non envoyé au serveur");
    // 7c. chat : lecture, envoi, refus d'un lien, objet montré, menu d'un joueur, signalement, ignorer, privé
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
    await page.evaluate(() => window.__chatEmit({ id: 52, ch: "g", user_id: "u8", pseudo: "Tofuline", cls: "eni", lvl: 150, body: "Pendant que tu copies", kind: "msg", created_at: new Date().toISOString() })); await page.waitForTimeout(100);
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
    await page.click('.adm [data-act="adm-tab"][data-v="ann"]'); await page.waitForSelector("#admAnn", { timeout: 5000 });
    await page.fill("#admAnn", "Maintenance ce soir"); await page.click('[data-act="adm-announce"]'); await page.waitForTimeout(600);
    m = await mock(); const calls = (m.admCalls || []).map((x) => x[0]);
    if (!calls.includes("adm_mute") || !calls.includes("adm_announce")) fail("panel admin : actions non envoyées " + calls.join(","));
    if (!/Maintenance ce soir/.test(await page.textContent("#annbar"))) fail("panel admin : bandeau d'annonce absent");
    // 0.1.50.2 : le message épinglé se change dans l'onglet Annonces, et revient chez le joueur qui l'avait fermé
    await page.fill("#admPin", "Nouveau texte épinglé ! Venez sur le Discord."); await page.check("#admPinc"); await page.click('[data-act="adm-pin"]'); await page.waitForTimeout(600);
    m = await mock(); if (!(m.admCalls || []).some((x) => x[0] === "adm_pin" && x[1].p_chs === "g,c")) fail("panel admin : message épinglé non envoyé");
    await page.evaluate(() => { window.CHAT.state.tab = "c"; window.CHAT.repaint(); });
    if (!(await page.$("#chat .ch-pin")) || !/Nouveau texte épinglé/.test(await page.textContent("#chat .ch-pin"))) fail("chat : nouveau message épinglé absent après le changement");
    // 1.0.5.2 : codes cadeaux, la liste de choix reste ouverte quand le panel se redessine
    await page.click('.adm [data-act="adm-tab"][data-v="codes"]'); await page.waitForSelector("#gcCode", { timeout: 5000 });
    await page.click('[data-act="gc-add"]'); await page.waitForSelector("#gcN1"); await page.click("#gcN1"); await page.keyboard.type("coffr"); await page.waitForTimeout(300);
    await page.evaluate(() => window.CHAT.repaintAdmin()); await page.waitForTimeout(200);
    if (!(await page.evaluate(() => document.activeElement.id === "gcN1" && document.activeElement.value === "coffr" && document.querySelectorAll(".gc-sug:not([hidden]) .gc-opt").length > 0))) fail("codes cadeaux : la liste de choix se referme au redessin");
    await page.click(".gc-sug .gc-opt"); await page.waitForTimeout(300);
    if (!/^Coffre/.test(await page.inputValue("#gcN1")) || !/Coffre/.test(await page.textContent(".gc-card"))) fail("codes cadeaux : choix dans la liste non pris");
    await page.click('.adm [data-act="adm-tab"][data-v="hdv"]'); await page.waitForSelector('.adm [data-act="mk-admdel"]', { timeout: 5000 });
    // 0.1.52.1 : fiches joueurs (réservées à l'admin), avec la partie lue par le jeu
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // 1.0.12.8 : chat ouvert à 1280 px, le menu en icônes laisse la bulle « Découverte » sur la liste des joueurs
    await page.click('.adm [data-act="adm-tab"][data-v="fiches"]'); await page.waitForSelector('.adm [data-act="fj-sel"]', { timeout: 5000 });
    await page.click('.adm [data-act="fj-sel"]'); await page.waitForSelector(".adm .fj-hero", { timeout: 5000 });
    { const tx = await page.textContent(".adm .fj-main"); if (!/Les Tofus/.test(tx) || !/Quête principale/.test(tx) || !/Kolizéum/.test(tx)) fail("fiches joueurs : fiche incomplète"); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/fiche.png", fullPage: true });
    // 7d bis (0.1.36). boîte à idées : envoi depuis Communauté › Suggestions, puis lecture dans le panel admin
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#nav .sn-side [data-nk="sugg"]'); await page.waitForSelector("#idTitle", { timeout: 5000 });
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
    await page.click('#status [data-act="adm-open"]'); await page.waitForSelector(".adm .kpis", { timeout: 5000 });
    await page.click('.adm [data-act="adm-tab"][data-v="idees"]'); await page.waitForSelector('.adm [data-act="id-hide"]', { timeout: 5000 });
    if (!/Bouftou Royal/.test(await page.textContent(".adm"))) fail("idées : absente du panel admin");
    // 7d ter (1.0.23). builds partagés : liste, build de la semaine, filtres, recherche, fiche, j'aime, favori, appliquer, signaler, publier, mise à jour en un clic, panel admin
    await page.evaluate(() => { const S = window.DX.S; S.settings.snd = Object.assign({}, S.settings.snd, { asked: true }); document.querySelectorAll("#sndask").forEach((x) => x.remove()); }); // 1.0.22 : la bulle « Jouer en musique ? » ne cache pas les clics du test
    const myCls = await page.evaluate(() => { const D = window.DATA, E = window.ENGINE, S = window.DX.S;
      const pick = (sl, L) => Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === sl && D.ITEMS[k].lvl <= L && D.ITEMS[k].craft).sort((a, b) => D.ITEMS[b].lvl - D.ITEMS[a].lvl)[0];
      const code = (cls, lvl, st) => { const eq = {}; ["coiffe", "cape", "amulette", "ceinture", "bottes"].forEach((sl) => (eq[sl] = pick(sl, lvl))); eq.dofus1 = "dofus_cacao"; return E.BUILD_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, cls, lvl, n: "Héros", st, as: "", ac: 200, at: "vit", sp: [], eq })))); };
      const mk = (id, uid, pseudo, cls, lvl, el, bud, title, likers, views) => { const c = code(cls, lvl, { vit: 300, [el]: 200 }); const j = JSON.parse(decodeURIComponent(escape(atob(c.slice(7)))));
        return { id, user_id: uid, pseudo, hid: 1, cls, lvl, el, bud, tags: ["Donjon"], title, note: "Passer en Colère dès le 3e tour.", code: c, items: Object.values(j.eq), sex: "m", head: 0, likers, views, reports: [], hidden: false, removed: false, at: new Date().toISOString(), new: new Date().toISOString() }; };
      const mc = S.chars[0].cls; const other = mc === "eni" ? "cra" : "eni";
      const d = JSON.parse(localStorage.getItem("__mock")); d.builds = [mk(1, "u9", "Kralamour", mc, 200, "fo", "pre", "Build Terre increvable", ["u7", "u6", "u5"], 120), mk(2, "u8", "Tofuline", other, 120, "ine", "abo", "Build Feu soin", [], 4)];
      localStorage.setItem("__mock", JSON.stringify(d)); return { mc, other }; });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#nav [data-nk="builds"]'); await page.waitForSelector("#bdPage .bd-card", { timeout: 8000 });
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
    await page.setViewportSize({ width: 390, height: 844 }); await page.click('#nav [data-nk="builds"]').catch(async () => { await page.evaluate(() => { window.DX.ui.tab = "builds"; window.DX.render(); }); });
    await page.evaluate(() => { window.DX.ui.tab = "builds"; window.DX.ui.bdOpen = null; window.DX.render(); }); await page.selectOption("#bdSort", "week"); await page.waitForSelector("#bdPage .bd-card", { timeout: 5000 });
    { const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`builds : page trop large sur téléphone : ${w}px`); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/builds-mob.png", fullPage: true });
    await page.$eval('.bd-card[data-id="1"]', (e) => e.click()); await page.waitForSelector("#bdPage .bd-doll", { timeout: 5000 }); // le chat ouvert couvre la page au téléphone
    { const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) fail(`builds : fiche trop large sur téléphone : ${w}px`); }
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/build-fiche-mob.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 }); await page.evaluate(() => { window.DX.ui.bdOpen = null; window.DX.ui.tab = "admin"; window.DX.render(); });
    // 7e. hôtel de vente : achat d'un objet, il arrive dans le sac et les kamas baissent
    await page.click("#chat .ch-x"); await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#nav [data-nk="hdv"]');
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
    // 7f. guildes : invitation reçue, liste, formulaire de fondation
    await page.evaluate(() => { const w = document.querySelector("#wtip"); if (w) w.remove(); }); // bulle « Équiper un objet » après l'achat
    await page.click('#nav [data-nk="guild"]'); await page.waitForSelector('[data-act="g-inv"]', { timeout: 8000 });
    if (!(await page.$("#gName")) || !(await page.$('[data-act="g-join"]'))) fail("guildes : page incomplète");
    // la page se redessine pendant la frappe : le curseur doit rester à sa place (le nom s'écrivait à l'envers)
    await page.click("#gName"); await page.keyboard.type("Les Bouf", { delay: 120 }); await page.waitForTimeout(700); await page.keyboard.type("tous", { delay: 500 }); await page.waitForTimeout(700);
    const gn = await page.inputValue("#gName"); if (gn !== "Les Bouftous") fail("guildes : saisie du nom cassée par le rafraîchissement : " + JSON.stringify(gn));
    if (!(await page.evaluate(() => document.activeElement && document.activeElement.id === "gName"))) fail("guildes : le champ du nom perd le focus");
    await page.click('#nav [data-nk="world"]');
    // 8. mobile : la pastille tient dans la barre
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
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
    await page.click('[data-act="options"]'); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-renpseudo"]');
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
    // 9. suppression du compte
    await page.click('[data-act="options"]'); await page.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await page.click('.sheet [data-act="on-askdelete"]');
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
    await p2.click('[data-act="options"]'); await p2.click('.sheet [data-act="opttab"][data-v="sauvegarde"]');
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
    const solo = await p2.evaluate(async () => { const O = window.ONLINE; return { solo: O.solo(), rec: await O.submitRecord("x"), hdv: await O.rpc("hdv_buy", { p_id: 1 }), sync: await O.rpc("hdv_sync", { p_after: 0 }), list: (await O.rpc("guild_list")).err || null }; });
    if (!solo.solo || solo.rec.ok !== false || !solo.hdv.err || !solo.sync.err || solo.list) fail("parties : une partie solo peut agir sur le serveur " + JSON.stringify(solo));
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
    await p2.click('[data-act="options"]'); await p2.click('.sheet [data-act="opttab"][data-v="sauvegarde"]'); await p2.click('.sheet [data-act="sv-menu"]'); await p2.waitForSelector(".svm", { timeout: 10000 });
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
    if (process.env.SHOTS) await p3.screenshot({ path: process.env.SHOTS + "/menu-invite-mob.png", fullPage: true });
    await ctx3.close();
  } catch (e) { if (errors.length) console.error("Déjà en échec avant l'arrêt :\n" + errors.join("\n")); throw e; } // 1.0.23 : les échecs déjà notés ne sont plus perdus
  finally { await browser.close(); server.close(); }
  if (errors.length) { console.error("ÉCHEC :\n" + errors.join("\n")); process.exit(1); }
  console.log("Compte et sauvegarde en ligne : OK");
})();
