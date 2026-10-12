#!/usr/bin/env python3
"""Sonde des Dofus et trophées DOFUS (préparation de l'étape « archimonstres et Dofus » de la 0.1).

Lit data/raw (voir import_dofusdb.py : items, item-types, effects) et écrit dans tools/probe/dofus/ :
  - dofus.json : tout objet dont le type est « Dofus » ou « Trophée » (nom, niveau, type, icône, effets, description) ;
  - icons/<iconId>.png : les icônes trouvées.
Projet de fan non commercial. Merci à DofusDB (https://dofusdb.fr) — contenu © Ankama Games.
"""
import json, glob, os, re, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'tools', 'probe', 'dofus')
os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)


def load(ep):
    out = []
    for f in sorted(glob.glob(os.path.join(RAW, ep, 'page-*.json'))):
        out += json.load(open(f, encoding='utf-8'))
    return out


def fr(o, k='name'):
    n = o.get(k) if isinstance(o, dict) else None
    return n.get('fr', '') if isinstance(n, dict) else str(n or '')


items = load('items')
itypes = {t['id']: fr(t) for t in load('item-types')}
effects = {e['id']: e for e in load('effects')}


def eff_txt(e):
    d = effects.get(e.get('effectId'), {})
    t = fr(d, 'description') or f"effet {e.get('effectId')}"
    lo, hi = e.get('from', e.get('diceNum', 0)) or 0, e.get('to', e.get('diceSide', 0)) or 0
    t = re.sub(r'#1\{~1~2 (à|to) \}#2', f'{lo} à {hi}' if hi and hi != lo else f'{lo}', t)
    t = t.replace('#1', str(lo)).replace('#2', str(hi)).replace('#3', '')
    return re.sub(r'\s+', ' ', re.sub(r'[{}~\d]*\{[^}]*\}', '', t)).strip()


def icon(it):
    ic = it.get('iconId')
    if not ic:
        return None
    f = os.path.join(OUT, 'icons', f'{ic}.png')
    if not os.path.exists(f):
        url = it.get('img') or f'https://api.dofusdb.fr/img/items/{ic}.png'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'DofousXen-fan-idle-import'})
            with urllib.request.urlopen(req, timeout=30) as r:
                open(f, 'wb').write(r.read())
        except Exception as ex:
            print('icône manquante', ic, ex)
            return None
    return ic


rows = []
for it in items:
    t = itypes.get(it.get('typeId'), '')
    n = fr(it)
    if t.lower() not in ('dofus', 'trophée', 'prysmaradite') and not n.lower().startswith('dofus '):
        continue
    rows.append({'id': it['id'], 'nom': n, 'type': t, 'niveau': it.get('level'), 'icone': icon(it),
                 'description': fr(it, 'description'), 'effets': [eff_txt(e) for e in it.get('effects') or []],
                 'brut_effets': it.get('effects'), 'criterions': it.get('criterions')})
rows.sort(key=lambda x: (x['type'], (x['niveau'] or 0), x['nom']))
json.dump(rows, open(os.path.join(OUT, 'dofus.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(rows), 'objets Dofus/trophées', sum(1 for r in rows if r['icone']), 'icônes')
