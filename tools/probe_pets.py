#!/usr/bin/env python3
"""Sonde des familiers et montures DOFUS (préparation de l'étape « familiers et montures » de la 0.1).

Lit data/raw (voir import_dofusdb.py : items, item-types, effects, characteristics, pets, mounts, monsters)
et écrit dans tools/probe/familiers/ :
  - familiers.json : un objet par familier (nom, niveau, type, icône, effets, nourriture, monstres liés) ;
  - montures.json : les montures (dragodindes, muldos, volkornes) ;
  - exemples.json : un exemple brut de chaque endpoint, pour vérifier la structure ;
  - icons/<iconId>.png : les icônes des familiers et des montures.
Projet de fan non commercial. Merci à DofusDB (https://dofusdb.fr) — contenu © Ankama Games.
"""
import json, glob, os, re, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'tools', 'probe', 'familiers')
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
pets = load('pets')
mounts = load('mounts')
monsters = {m['id']: fr(m) for m in load('monsters')}
by_id = {it['id']: it for it in items}

json.dump({'item_type_names': sorted(set(itypes.values())),
           'pet': pets[:2], 'mount': mounts[:2],
           'pet_item': next((it for it in items if 'amilier' in itypes.get(it.get('typeId'), '')), None)},
          open(os.path.join(OUT, 'exemples.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


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


pet_by_item = {}
for p in pets:
    pet_by_item[p.get('id')] = p


def names(ids):
    return [fr(by_id[i]) for i in ids or [] if i in by_id]


PET_TYPES = {k for k, v in itypes.items() if re.search(r'familier|montilier|f[ée]e d.artifice|muldo|volkorne|dragodinde|monture', v, re.I)}
out_p, out_m = [], []
for it in items:
    if it.get('typeId') not in PET_TYPES:
        continue
    p = pet_by_item.get(it['id'], {})
    row = {'id': it['id'], 'nom': fr(it), 'type': itypes.get(it['typeId']), 'niveau': it.get('level'), 'icone': icon(it),
           'description': fr(it, 'description'), 'effets': [eff_txt(e) for e in it.get('possibleEffects') or it.get('effects') or []],
           'nourriture': names(p.get('foodItems')), 'types_nourriture': [itypes.get(t, t) for t in p.get('foodTypes') or []],
           'repas_heures': [p.get('minDurationBeforeMeal'), p.get('maxDurationBeforeMeal')],
           'pet': {k: v for k, v in p.items() if k not in ('foodItems', 'foodTypes')}}
    (out_m if re.search(r'muldo|volkorne|dragodinde|monture', row['type'] or '', re.I) else out_p).append(row)
for m in mounts:
    out_m.append({'id': m.get('id'), 'nom': fr(m), 'famille': m.get('familyId'), 'brut': {k: v for k, v in m.items() if k != 'name'}})

json.dump(out_p, open(os.path.join(OUT, 'familiers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(out_m, open(os.path.join(OUT, 'montures.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(out_p)} familiers, {len(out_m)} montures ; types retenus : {sorted(itypes[k] for k in PET_TYPES)}')
