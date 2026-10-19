'use strict';
/* Audit (19/10/2026) : fiabilité de l'envoi de la partie (js/online.js) avec un FAUX serveur en mémoire.
   Aucun réseau : la bibliothèque Supabase est remplacée par __IDLUS_SB. Lancer : node tests/sync.test.js */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const REPO = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(REPO, 'js/online.js'), 'utf8');

/* Serveur partagé : reproduit push_save / save_info de supabase/schema.sql (comparaison sur updated_at). */
function makeServer() {
  let n = 0; const stamp = () => '2026-10-19T12:00:00.' + String(++n).padStart(6, '0') + 'Z';
  return { saves: {}, calls: [], stamp, hooks: {} };
}
function makeClient(srv, uid) {
  const ls = new Map();
  const localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
  let authCb = null; const signOuts = [];
  const sb = {
    auth: {
      onAuthStateChange: (cb) => { authCb = cb; },
      getSession: async () => ({ data: { session: { user: { id: uid } } } }),
      stopAutoRefresh: async () => {}, signOut: async (o) => { signOuts.push(o); },
    },
    functions: { invoke: async () => ({ data: { ok: 1 } }) },
    rpc: (name, a) => {
      srv.calls.push([uid, name, a]);
      const s = srv.saves[uid];
      if (name === 'save_info') return Promise.resolve({ data: s ? [{ updated_at: s.updated_at, meta: s.meta }] : [], error: null });
      if (name === 'push_save') {
        const h = srv.hooks.push; if (h) { const r = h(uid, a); if (r) return r; }
        return Promise.resolve(serverPush(srv, uid, a));
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  const root = { localStorage, location: { pathname: '/', origin: 'http://x', hash: '', search: '' }, navigator: { userAgent: 'test' },
    __IDLUS_SB: { createClient: () => sb }, setTimeout, Promise, Date, Math, JSON, Object, String, Error };
  root.window = root;
  vm.runInNewContext(SRC, { window: root, globalThis: root, setTimeout, console });
  const ON = root.ONLINE;
  ON.init({ key: 'dofousxen-save', version: 'test' });
  ON.user = { id: uid };
  return { ON, ls, fire: (ev, s) => authCb(ev, s), signOuts };
}
function serverPush(srv, uid, a) {
  const s = srv.saves[uid];
  if (a.p_force || (a.p_expected == null && !s) || (a.p_expected != null && s && s.updated_at === a.p_expected)) {
    const at = srv.stamp(); srv.saves[uid] = { data: a.p_data, meta: a.p_meta, updated_at: at }; return { data: at, error: null };
  }
  return { data: null, error: null };
}

test('SYNC-01 erreur du serveur avant écriture : rien d\'écrit, lien (base) inchangé, état offline', async () => {
  const srv = makeServer(); const c = makeClient(srv, 'u1');
  assert.equal(await c.ON.push('v1', {}, 1), 'ok');
  const base = c.ON.link().base, savedAt = c.ON.link().savedAt;
  srv.hooks.push = () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
  assert.equal(await c.ON.push('v2', {}, 2), 'offline');
  assert.equal(srv.saves.u1.data, 'v1');
  assert.equal(c.ON.link().base, base); assert.equal(c.ON.link().savedAt, savedAt);
  assert.equal(c.ON.state, 'offline');
});

test('SYNC-02 écriture faite mais réponse perdue : l\'envoi suivant reconnaît son pid, pas de faux conflit', async () => {
  const srv = makeServer(); const c = makeClient(srv, 'u1');
  assert.equal(await c.ON.push('v1', {}, 1), 'ok');
  srv.hooks.push = (uid, a) => { serverPush(srv, uid, a); srv.hooks.push = null; return Promise.reject(new Error('délai dépassé')); };
  assert.equal(await c.ON.push('v2', {}, 2), 'offline');
  assert.equal(srv.saves.u1.data, 'v2'); // le serveur a bien écrit
  assert.equal(await c.ON.push('v3', {}, 3), 'ok');
  assert.equal(srv.saves.u1.data, 'v3');
  assert.equal(c.ON.state, 'ok');
});

test('SYNC-03 deux appareils, même base, écritures divergentes : un seul accepté, l\'autre conflict', async () => {
  const srv = makeServer(); const a = makeClient(srv, 'u1'); const b = makeClient(srv, 'u1');
  assert.equal(await a.ON.push('base', {}, 1), 'ok');
  b.ON.setLink({ uid: 'u1', base: a.ON.link().base }); // B a récupéré la même version
  assert.equal(await a.ON.push('A', {}, 2), 'ok');
  assert.equal(await b.ON.push('B', {}, 2), 'conflict');
  assert.equal(srv.saves.u1.data, 'A');
});

test('SYNC-04 envoi demandé pendant un autre : le dernier état part juste après, et l\'appelant attend cet envoi', async () => {
  const srv = makeServer(); const c = makeClient(srv, 'u1');
  assert.equal(await c.ON.push('v1', {}, 1), 'ok');
  let release; srv.hooks.push = (uid, a) => new Promise((r) => { release = () => r(serverPush(srv, uid, a)); });
  const p1 = c.ON.push('v2', {}, 2); const p2 = c.ON.push('v3', {}, 3); const p3 = c.ON.push('v4-plus-recent', {}, 4);
  assert.equal(p2, p3, 'une seule relance, quel que soit le nombre de demandes');
  srv.hooks.push = null; release();
  assert.equal(await p1, 'ok');
  assert.equal(await p2, 'ok'); assert.equal(srv.saves.u1.data, 'v4-plus-recent', 'le dernier état est en ligne quand l\'appelant reprend la main (vente HDV)');
  assert.equal(c.ON.link().savedAt, 4);
  assert.equal(srv.calls.filter((x) => x[1] === 'push_save').length, 3, 'v1, v2 puis v4 : v3 n\'est jamais envoyé pour rien');
  assert.deepEqual(srv.calls.filter((x) => x[1] === 'push_save').map((x) => x[2].p_data).join(), 'v1,v2,v4-plus-recent');
});

test('SYNC-04b envoi en conflit pendant une demande : pas de relance qui écraserait l\'autre appareil', async () => {
  const srv = makeServer(); const c = makeClient(srv, 'u1');
  assert.equal(await c.ON.push('v1', {}, 1), 'ok');
  srv.saves.u1 = { data: 'autre-appareil', meta: { pid: 'x' }, updated_at: srv.stamp() };
  let release; srv.hooks.push = (uid, a) => new Promise((r) => { release = () => r(serverPush(srv, uid, a)); });
  const p1 = c.ON.push('v2', {}, 2); const p2 = c.ON.push('v3', {}, 3);
  srv.hooks.push = null; release();
  assert.equal(await p1, 'conflict'); assert.equal(await p2, 'conflict');
  assert.equal(srv.saves.u1.data, 'autre-appareil');
});

test('SYNC-06 changement de partie pendant un envoi : chaque partie garde son propre lien', async () => {
  const srv = makeServer(); const c = makeClient(srv, 'u1');
  assert.equal(await c.ON.push('p1-v1', {}, 1), 'ok');
  let release; srv.hooks.push = (uid, a) => new Promise((r) => { release = () => r(serverPush(srv, uid, a)); });
  const p = c.ON.push('p1-v2', {}, 2);
  await new Promise((r) => setImmediate(r));
  c.ON.setSlot(2, 'dofousxen-save-2');
  srv.hooks.push = null; release(); assert.equal(await p, 'ok');
  const l1 = JSON.parse(c.ls.get('dofousxen-save-online')), l2 = JSON.parse(c.ls.get('dofousxen-save-2-online') || '{}');
  assert.equal(l1.base, srv.saves.u1.updated_at, 'la partie 1 connaît sa nouvelle version en ligne');
  assert.equal(l1.savedAt, 2);
  assert.equal(l2.base, undefined, 'la partie 2 n\'a rien reçu');
});

test('SYNC-07 horloge fausse : 21 renouvellements en 1 min coupent la connexion, la partie locale reste', async () => {
  const srv = makeServer(); const c = makeClient(srv, 'u1');
  c.ls.set('dofousxen-save', 'PARTIE');
  let msg = null; c.ON.onLoop = (t) => { msg = t; };
  const now = Math.floor(Date.now() / 1000), sess = { expires_in: 3600, expires_at: now - 3 * 3600 + 3600, user: { id: 'u1' } }; // horloge 3 h en avance
  for (let i = 0; i < 21; i++) c.fire('TOKEN_REFRESHED', sess);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(c.signOuts.length, 1); assert.equal(c.signOuts[0].scope, 'local');
  assert.equal(c.ON.state, 'anon'); assert.match(msg, /3 h d'avance/);
  assert.equal(c.ls.get('dofousxen-save'), 'PARTIE');
  assert.equal(await c.ON.push('x', {}, 1), 'offline', 'plus d\'envoi après la coupure');
});
