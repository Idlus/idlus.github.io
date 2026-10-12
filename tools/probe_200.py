#!/usr/bin/env python3
"""Sonde du contenu DOFUS niveaux 110 à 200 (préparation de la mise à jour niveau 200).

Lit data/raw (voir import_dofusdb.py) et écrit tools/probe/rapport_200.md :
sous-zones, monstres, donjons et objets au-delà du contenu actuel du jeu.
"""
import json, glob, os, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'tools', 'probe')

def load(ep):
    out = []
    for f in sorted(glob.glob(os.path.join(RAW, ep, 'page-*.json'))):
        out += json.load(open(f, encoding='utf-8'))
    return out

def fr(o):
    n = o.get('name')
    return n.get('fr', '') if isinstance(n, dict) else str(n or '')

subareas = {s['id']: s for s in load('subareas')}
areas = {a['id']: a for a in load('areas')}
supers = {a['id']: a for a in load('super-areas')}
monsters = {m['id']: m for m in load('monsters')}
races = {r['id']: fr(r) for r in load('monster-races')}
dungeons = load('dungeons')
items = load('items')
itypes = {t['id']: fr(t) for t in load('item-types')}
sets = load('item-sets')

def lv(m, k=0):
    g = m.get('grades') or [{}]
    return g[min(k, len(g) - 1)].get('level', 0)

L = ['# Contenu DOFUS au-delà du niveau 105', '']
L.append('## Sous-zones (au moins 3 monstres non boss de niveau 105 ou plus)')
L.append('')
L.append('| id | Continent | Zone | Sous-zone | Niv. | Monstres | Familles | Exemples |')
L.append('| --- | --- | --- | --- | --- | --- | --- | --- |')
rows = []
for sid, s in subareas.items():
    ms = [monsters[i] for i in s.get('monsters', []) if i in monsters and not monsters[i].get('isBoss') and not monsters[i].get('isQuestMonster')]
    ms = [m for m in ms if lv(m) >= 105]
    if len(ms) < 3:
        continue
    a = areas.get(s.get('areaId'), {})
    sa = supers.get(a.get('superAreaId'), {})
    lo = min(lv(m) for m in ms); hi = max(lv(m, 4) for m in ms)
    rc = collections.Counter(races.get(m.get('race'), '?') for m in ms)
    rows.append((lo, f"| {sid} | {fr(sa)} | {fr(a)} | {fr(s)} | {lo}-{hi} | {len(ms)} | {', '.join(r for r, _ in rc.most_common(3))} | {', '.join(fr(m) for m in ms[:6])} |"))
L += [r for _, r in sorted(rows)]
L.append('')
L.append('## Donjons (boss niveau 100 ou plus)')
L.append('')
L.append('| sous-zone | Donjon | Boss | Niv. boss | Monstres | Clé |')
L.append('| --- | --- | --- | --- | --- | --- |')
dr = []
for d in dungeons:
    if not d.get('bosses'):
        continue
    b = monsters.get(d['bosses'][0])
    if not b or lv(b, 4) < 100:
        continue
    key = (d.get('requiredObjects') or [{}])[0].get('id')
    dr.append((lv(b, 4), f"| {d.get('subarea')} | {fr(d)} | {fr(b)} | {lv(b, 4)} | {len(d.get('monsters', []))} | {'oui' if key else 'non'} |"))
L += [r for _, r in sorted(dr)]
L.append('')
L.append('## Objets de niveau 126 à 200, par type')
L.append('')
eq = collections.Counter()
for i in items:
    if 125 < (i.get('level') or 0) <= 200:
        eq[itypes.get(i.get('typeId'), str(i.get('typeId')))] += 1
for t, n in eq.most_common(40):
    L.append(f'- {t} : {n}')
L.append('')
L.append(f"Panoplies de niveau 126 à 200 : {sum(1 for s in sets if 125 < (s.get('level') or 0) <= 200)}")
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'rapport_200.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('\n'.join(L[:80]))
