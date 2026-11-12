"""Assemble js/anim3data.js (window.A3D) à partir des sorties de convertir_diablofus.py et sorts_diablofus.py.
Usage : python3 tools/anim3/donnees.py <dossier anim3> <correspondance.json> [base des images]
Seuls les monstres, héros et effets réellement convertis sont gardés : le reste garde son image actuelle."""
import json, os, sys
SRC, CORR = sys.argv[1], sys.argv[2]
BASE = sys.argv[3] if len(sys.argv) > 3 else 'https://assets.diablofus.com/idlus/'
lire = lambda n: json.load(open(os.path.join(SRC, n))) if os.path.exists(os.path.join(SRC, n)) else {}
h, m, fx, s = lire('anim3_h.json'), lire('anim3_m.json'), lire('anim3_fx.json'), lire('anim3_s.json')
mk = {k: v['s'] for k, v in json.load(open(CORR)).items() if v['s'] in m}
ok = lambda L: [g for g in (L or []) if str(g) in fx]
s2 = {}
for sid, v in s.items():
    e = {'a': v.get('a')}
    for k in ('t', 'tb', 'c', 'cb'):
        if ok(v.get(k)): e[k] = ok(v.get(k))
    if v.get('p') and str(v['p']) in fx: e['p'] = v['p']
    s2[sid] = e
import hashlib
v = hashlib.md5(json.dumps([h, m, fx], sort_keys=True).encode()).hexdigest()[:8]
d = {'base': BASE, 'v': v, 'h': h, 'm': m, 'fx': fx, 's': s2, 'mk': mk}
out = 'js/anim3data.js'
open(out, 'w').write('/* Généré par tools/anim3/donnees.py : ne pas modifier à la main. */\nwindow.A3D=' + json.dumps(d, separators=(',', ':'), ensure_ascii=False) + ';\n')
print(out, os.path.getsize(out), 'octets ·', len(h), 'héros ·', len(m), 'monstres ·', len(fx), 'effets ·', len(s2), 'sorts')
