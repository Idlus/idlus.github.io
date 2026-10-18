#!/usr/bin/env python3
"""Idlus — la carte du Monde des Douze (2.1.x, idée de lucy8, choix 1A de Mathis).

Construit :
  - assets/carte/monde.webp : la carte du monde de DOFUS (DofusDB, monde 1, échelle 0.4, 16 × 13 tuiles de 250 px),
    réduite à 1600 × 1280 ;
  - js/carte.js : la place de chaque sous-zone sur cette carte (moyenne des cartes extérieures de la sous-zone,
    worldMap 1) et de chaque région (moyenne de ses sous-zones). Coordonnées de 0 à 1000 (largeur) et 0 à 800 (hauteur).

Les sous-zones d'un autre monde (Incarnam, Dimensions, sous-sols…) n'ont pas de place : la page les montre sous la carte.
Données issues de DofusDB (LPNC-IA 1.0, crédit dans le README et Options › À propos). Lancer : python3 tools/build_carte.py
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
    img = img.crop((0, 0, 4000, 3200)).resize((1600, 1280), Image.LANCZOS)
    os.makedirs(os.path.join(ROOT, 'assets', 'carte'), exist_ok=True)
    img.save(os.path.join(ROOT, 'assets', 'carte', 'monde.webp'), quality=72)

def zones():
    js = subprocess.check_output(['node', '-e', 'global.window=global;require("./js/gamedata.js");process.stdout.write(JSON.stringify(GAMEDATA.ZONES.map(z=>({id:z.id,subs:z.subs.map(s=>({id:s.id,db:s.dbid}))}))))'], cwd=ROOT)
    return json.loads(js)

def pos(db):
    d = json.loads(get(f'{API}/map-positions?subAreaId={db}&outdoor=true&worldMap=1&$limit=50&$select[]=posX&$select[]=posY'))['data']
    if not d:
        return None
    x = sum(m['posX'] for m in d) / len(d); y = sum(m['posY'] for m in d) / len(d)
    px = (W['ox'] + x * W['mw'] + W['mw'] / 2) / W['tw'] * 1000; py = (W['oy'] + y * W['mh'] + W['mh'] / 2) / W['th'] * 800
    return [round(px), round(py)]

def main():
    Z = zones()
    subs = [s for z in Z for s in z['subs']]
    with ThreadPoolExecutor(12) as ex:
        P = dict(zip([s['id'] for s in subs], ex.map(lambda s: pos(s['db']), subs)))
    S = {k: v for k, v in P.items() if v}
    R = {}
    for z in Z:
        L = [S[s['id']] for s in z['subs'] if s['id'] in S]
        if L:
            R[z['id']] = [round(sum(p[0] for p in L) / len(L)), round(sum(p[1] for p in L) / len(L))]
    out = ('/* La carte du Monde des Douze (2.1.x, choix 1A) : place des régions (z) et des sous-zones (s) sur assets/carte/monde.webp,\n'
           '   de 0 à 1000 en largeur et de 0 à 800 en hauteur. Généré par tools/build_carte.py (données DofusDB), ne pas modifier à la main. */\n'
           f'window.CARTE = {json.dumps({"z": R, "s": S}, separators=(",", ":"))};\n')
    open(os.path.join(ROOT, 'js', 'carte.js'), 'w', encoding='utf-8').write(out)
    tiles()
    print(f'{len(R)} régions, {len(S)} sous-zones placées sur {len(subs)}')

if __name__ == '__main__':
    main()
