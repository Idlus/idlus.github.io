#!/usr/bin/env python3
"""DofousXen - import brut DofusDB (reprenable).

Télécharge toutes les pages des endpoints listés dans data/raw/<endpoint>/page-XXXXX.json.
Les pages déjà présentes sont sautées : on peut relancer le script autant de fois que nécessaire.
Usage : python3 tools/import_dofusdb.py [endpoint ...]
Projet de fan non commercial. Merci à DofusDB (https://dofusdb.fr) — contenu © Ankama Games.
"""
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

API = 'https://api.dofusdb.fr'
UA = 'DofousXen-fan-idle-import (perso, import unique, lent)'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'raw')
PAGE = 50
DELAY = 0.05
WORKERS = 4
DEFAULT = ['super-areas', 'areas', 'subareas', 'dungeons', 'monster-races', 'monster-super-races',
           'item-types', 'item-super-types', 'jobs', 'breeds', 'monsters', 'items', 'recipes', 'item-sets',
           'characteristics', 'effects', 'harvestables', 'skills']


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    raise RuntimeError('échec ' + url)


def dump(ep):
    d = os.path.join(ROOT, ep)
    os.makedirs(d, exist_ok=True)
    first = get(f'{API}/{ep}?$limit={PAGE}&$skip=0&$sort[id]=1&lang=fr')
    if first is None:
        print(f'{ep}: introuvable (404), ignoré', flush=True)
        return
    total = first.get('total', len(first.get('data', [])))
    limit = first.get('limit', PAGE) or PAGE
    pages = (total + limit - 1) // limit
    p0 = os.path.join(d, 'page-00000.json')
    if not os.path.exists(p0):
        json.dump(first['data'], open(p0, 'w', encoding='utf-8'), ensure_ascii=False)
    def one(p):
        f = os.path.join(d, f'page-{p:05d}.json')
        if os.path.exists(f):
            return
        res = get(f'{API}/{ep}?$limit={limit}&$skip={p * limit}&$sort[id]=1&lang=fr')
        json.dump(res['data'], open(f + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False)
        os.replace(f + '.tmp', f)
        time.sleep(DELAY)
    with ThreadPoolExecutor(WORKERS) as ex:
        list(ex.map(one, range(1, pages)))
    open(os.path.join(d, 'DONE'), 'w').write(str(total))
    print(f'{ep}: terminé ({total} entrées, {pages} pages)', flush=True)


if __name__ == '__main__':
    eps = sys.argv[1:] or DEFAULT
    for ep in eps:
        if os.path.exists(os.path.join(ROOT, ep, 'DONE')):
            print(f'{ep}: déjà fait', flush=True)
            continue
        try:
            dump(ep)
        except Exception as e:
            print(f'{ep}: ERREUR {e} (relancer pour reprendre)', flush=True)
    print('FIN', flush=True)
