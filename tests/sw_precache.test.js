'use strict';
/* Proposition de test (audit 19/10/2026) : chaque fichier chargé par index.html est dans PRECACHE de sw.js, chaque fichier de
   PRECACHE existe, et sw.js n'utilise jamais index.html comme réponse à un script (repli limité aux navigations).
   Usage : node tests/sw_precache.test.js */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const PRECACHE = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const used = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1].split('?')[0]).filter((f) => !/^(https?:|#|data:|mailto:)/.test(f) && /\.(js|css)$/.test(f));

test('SW-P1 tout script/feuille de style de index.html est mis de côté pour le hors-ligne', () => {
  assert.deepEqual(used.filter((f) => !PRECACHE.includes(f)), []);
});
test('SW-P2 chaque fichier de PRECACHE existe (sinon cache.addAll échoue et la nouvelle version ne s\'installe pas)', () => {
  assert.deepEqual(PRECACHE.filter((f) => f !== './' && !fs.existsSync(path.join(ROOT, f))), []);
});
test('SW-P3 VERSION de sw.js = GAME_VERSION de js/ui.js', () => {
  const v = sw.match(/const VERSION = "([^"]+)"/)[1];
  const g = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8').match(/GAME_VERSION = "([^"]+)"/);
  assert.ok(g, 'GAME_VERSION introuvable'); assert.equal(v, g[1]);
});
test('SW-P4 le repli index.html est réservé aux navigations', () => {
  const fb = sw.slice(sw.indexOf('.catch('));
  assert.match(fb, /req\.mode === "navigate"/);
});
