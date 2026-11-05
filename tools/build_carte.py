#!/usr/bin/env python3
"""Idlus — la carte du Monde des Douze (2.1.x, idée de lucy8, choix 1A de Mathis).

Construit :
  - assets/carte/monde.webp : la carte du monde de DOFUS (DofusDB, monde 1, échelle 0.4, 16 × 13 tuiles de 250 px),
    réduite à 1600 × 1280, et assets/carte/monde-hd.webp (3200 × 2560) pour le zoom ;
  - js/carte.js : la place de chaque sous-zone sur cette carte (moyenne des cartes extérieures de la sous-zone,
    worldMap 1) et de chaque région (moyenne de ses sous-zones). Coordonnées de 0 à 1000 (largeur) et 0 à 800 (hauteur).

Les sous-zones d'un autre monde (Incarnam, Dimensions, sous-sols…) n'ont pas de place : la page les montre sous la carte.
Données issues de DofusDB (LPNC-IA 1.0, crédit dans le README et Options › À propos). Lancer : python3 tools/build_carte.py (positions) ou --images (images)
"""
import io, json, os, re, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
API = 'https://api.dofusdb.fr'
UA = {'User-Agent': 'Idlus-fan-idle (carte du monde)'}
# monde 1 (api.dofusdb.fr/worlds) : 10000 × 8000 px à l'échelle 1, une carte = 69,5 × 49,7 px
W = {'ox': 6480, 'oy': 4944, 'mw': 69.5, 'mh': 49.7, 'tw': 10000, 'th': 8000}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

def tiles():
    cols, rows, scale = 16, 13, '0.4'
    img = Image.new('RGB', (cols * 250, rows * 250))
    def one(n):
        return n, Image.open(io.BytesIO(get(f'{API}/img/worlds/1/{scale}/{n + 1}.jpg'))).convert('RGB')
    with ThreadPoolExecutor(12) as ex:
        for n, t in ex.map(one, range(cols * rows)):
            img.paste(t, ((n % cols) * 250, (n // cols) * 250))
    img = img.crop((0, 0, 4000, 3200))
    os.makedirs(os.path.join(ROOT, 'assets', 'carte'), exist_ok=True)
    img.resize((1600, 1280), Image.LANCZOS).save(os.path.join(ROOT, 'assets', 'carte', 'monde.webp'), quality=72)
    # 2.1.24 : la version nette, chargée seulement quand on zoome
    img.resize((3200, 2560), Image.LANCZOS).save(os.path.join(ROOT, 'assets', 'carte', 'monde-hd.webp'), quality=68)

def zones():
    js = subprocess.check_output(['node', '-e', 'global.window=global;require("./js/gamedata.js");process.stdout.write(JSON.stringify(GAMEDATA.ZONES.map(z=>({id:z.id,subs:z.subs.map(s=>({id:s.id,db:s.dbid}))}))))'], cwd=ROOT)
    return json.loads(js)

def maps(db):
    """Toutes les cartes extérieures de la sous-zone sur le monde 1 (DofusDB pagine par 50)."""
    out, skip = [], 0
    while True:
        d = json.loads(get(f'{API}/map-positions?subAreaId={db}&outdoor=true&worldMap=1&$limit=50&$skip={skip}&$select[]=posX&$select[]=posY'))
        out += [(m['posX'], m['posY']) for m in d['data']]; skip += 50
        if skip >= d['total'] or not d['data']:
            break
    # quelques sous-zones (Arche d'Otomaï, Pitons rocheux…) n'ont que des cartes posées en [0, 0] : pas de vraie place
    return [] if all(p == (0, 0) for p in out) else out

def medoid(L):
    """2.2.8.3 (#174) : la carte la plus centrale de la liste, et non la moyenne. Une sous-zone a souvent des cartes
    éloignées (entrées, bateaux, morceaux détachés) : la moyenne tombait alors dans la mer, loin de la zone."""
    return min(L, key=lambda p: sum(abs(p[0] - q[0]) + abs(p[1] - q[1]) for q in L))

def px(p):
    return [round((W['ox'] + p[0] * W['mw'] + W['mw'] / 2) / W['tw'] * 1000), round((W['oy'] + p[1] * W['mh'] + W['mh'] / 2) / W['th'] * 800)]

def main():
    Z = zones()
    dbs = sorted({s['db'] for z in Z for s in z['subs'] if s['db']})
    with ThreadPoolExecutor(12) as ex:
        M = dict(zip(dbs, ex.map(maps, dbs)))
    S, R, n = {}, {}, 0
    for z in Z:
        U = []
        for s in z['subs']:
            n += 1
            L = M.get(s['db']) or []
            if L:
                S[s['id']] = px(medoid(L)); U += L
        if U:  # la région : la carte la plus centrale de toutes ses cartes, donc toujours sur la terre ferme
            R[z['id']] = px(medoid(U))
    out = ('/* La carte du Monde des Douze (2.1.x, choix 1A) : place des régions (z) et des sous-zones (s) sur assets/carte/monde.webp,\n'
           '   de 0 à 1000 en largeur et de 0 à 800 en hauteur. Généré par tools/build_carte.py (données DofusDB), ne pas modifier à la main. */\n'
           f'window.CARTE = {json.dumps({"z": R, "s": S}, separators=(",", ":"))};\n')
    open(os.path.join(ROOT, 'js', 'carte.js'), 'w', encoding='utf-8').write(out)
    print(f'{len(R)} régions, {len(S)} sous-zones placées sur {n} (images : --images)')

if __name__ == '__main__':
    import sys
    tiles() if sys.argv[1:] == ['--images'] else main()
