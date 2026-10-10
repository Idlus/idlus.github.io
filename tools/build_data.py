#!/usr/bin/env python3
"""DofousXen — construit les données du jeu à partir de l'import brut DofusDB.

Entrée  : data/raw/<endpoint>/page-*.json  (voir import_dofusdb.py)
Sortie  : build/js/gamedata.js, build/assets/{m,i,s,h}/*.png, build/report.txt

Les noms, niveaux, résistances, taux de drop, objets, recettes, panoplies et
clés de donjon sont ceux de DOFUS (via DofusDB). Les PV/dégâts des monstres
restent calculés par le moteur du jeu (équilibrage idle), à partir du niveau
réel et d'un multiplicateur tiré des PV réels.
Projet de fan non commercial — contenu © Ankama Games.
"""
import json, glob, os, sys, statistics, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'build')
UA = {'User-Agent': 'DofousXen-fan-idle-import (perso)'}
FETCH_IMAGES = '--no-images' not in sys.argv

def load(ep):
    out = []
    for f in sorted(glob.glob(os.path.join(RAW, ep, 'page-*.json'))):
        out += json.load(open(f, encoding='utf-8'))
    return out

report = []
def log(*a):
    s = ' '.join(str(x) for x in a); report.append(s); print(s)

# ------------------------------------------------------------------ config
# Sous-zones jouées, dans l'ordre de progression (id DofusDB -> id du jeu)
ZONES = [
    {'id': 'incarnam', 'name': 'Incarnam', 'desc': "L'île des âmes, flottant au-dessus d'Astrub.", 'theme': 'sky',
     'subs': [(444, 'inc_champs', 'meadow'), (450, 'inc_route', 'spirit'), (442, 'inc_lac', 'lake'), (445, 'inc_paturages', 'sky'),
              (443, 'inc_foret', 'forest'), (778, 'inc_mine', 'mine'), (449, 'inc_cimetiere', 'grave')]},
    {'id': 'astrub', 'name': 'Astrub', 'desc': 'La cité mercenaire et ses alentours.', 'theme': 'city', 'requires': {'boss': 'crypte_kardorim'},
     'subs': [(95, 'ast_cite', 'city'), (99, 'ast_souterrains', 'cave'), (173, 'ast_prairies', 'meadow'), (98, 'ast_champs', 'wheat'),
              (335, 'ast_calanques', 'beach'), (30, 'ast_tainela', 'meadow'), (97, 'ast_foret', 'forest'), (96, 'ast_carrieres', 'quarry'),
              (100, 'ast_egouts', 'sewer'), (102, 'ast_cimetiere', 'grave'), (843, 'ast_planque', 'cave')]},
]
HIDDEN = {'ast_planque': 'Baguette Rikiki'}
DUNGEONS = [  # (sous-zone DofusDB du donjon, id jeu, sous-zone d'accès)
    (447, 'crypte_kardorim', 'inc_cimetiere'),
    (306, 'grange_tournesol', 'ast_champs'),
    (336, 'chateau_ensable', 'ast_calanques'),
    (82, 'cour_bouftou_royal', 'ast_tainela'),
    (842, 'cache_kankreblath', 'ast_planque'),
]
EXCLUDE_NAMES = ("d'Halouine", 'Ballotin')
EXCLUDE_RACES = {32, 147, 250}  # avis de recherche, poutchs
ARCHI_RACE = 78

STAT = {125: ('vit', 1), 153: ('vit', -1), 124: ('sa', 1), 156: ('sa', -1), 118: ('fo', 1), 157: ('fo', -1),
        126: ('ine', 1), 155: ('ine', -1), 123: ('cha', 1), 152: ('cha', -1), 119: ('age', 1), 154: ('age', -1),
        138: ('pui', 1), 186: ('pui', -1), 112: ('do', 1), 145: ('do', -1), 115: ('cri', 1), 171: ('cri', -1),
        178: ('so', 1), 179: ('so', -1), 176: ('pp', 1), 177: ('pp', -1), 174: ('ini', 1), 175: ('ini', -1),
        111: ('pa', 1), 168: ('pa', -1), 210: ('rt', 1), 215: ('rt', -1), 213: ('rf', 1), 218: ('rf', -1),
        211: ('re', 1), 216: ('re', -1), 212: ('ra', 1), 217: ('ra', -1)}
SLOT_BY_TYPE = {1: 'amulette', 9: 'anneau', 10: 'ceinture', 11: 'bottes', 16: 'coiffe', 17: 'cape',
                2: 'arme', 3: 'arme', 4: 'arme', 5: 'arme', 6: 'arme', 7: 'arme', 8: 'arme', 19: 'arme', 271: 'arme'}
JOB = {11: 'forgeron', 13: 'sculpteur', 15: 'cordonnier', 16: 'bijoutier', 27: 'tailleur', 65: 'bricoleur'}
GATHER = {  # métier -> [(nom, niveau requis)]
    'paysan': [('Blé', 1), ('Orge', 20), ('Avoine', 40)],
    'bucheron': [('Bois de Frêne', 1), ('Bois de Châtaignier', 20), ('Bois de Noyer', 40)],
    'mineur': [('Fer', 1), ('Cuivre', 20), ('Bronze', 40)],
    'alchimiste': [('Ortie', 1), ('Sauge', 20), ('Trèfle à 5 feuilles', 40)],
    'pecheur': [('Greuvette', 1), ('Truite', 10), ('Crabe Sourimi', 20), ('Poisson-Chaton', 40)],
}
BREEDS = {'iop': 8, 'cra': 9, 'eni': 7}
MAX_CRAFT_LVL = 45

# ------------------------------------------------------------------ load
log('Chargement…')
subareas = {s['id']: s for s in load('subareas')}
monsters = {m['id']: m for m in load('monsters')}
items = {i['id']: i for i in load('items')}
recipes = {r['resultId']: r for r in load('recipes')}
isets = {s['id']: s for s in load('item-sets')}
dungeons_raw = load('dungeons')
breeds = {b['id']: b for b in load('breeds')}
item_by_name = {}
for i in sorted(items.values(), key=lambda x: x['id']):
    item_by_name.setdefault(i['name']['fr'], i)

def fr(o): return o['name']['fr'] if isinstance(o.get('name'), dict) else str(o.get('name'))

images = {'m': {}, 'i': {}, 's': {}, 'h': {}}  # dossier -> {fichier: url}

# ------------------------------------------------------------------ resources registry
RES = {}  # nom -> {id, icon, lvl, price, type}
def reg_res(it):
    n = fr(it)
    if n not in RES:
        RES[n] = {'id': it['id'], 'icon': it['iconId'], 'lvl': it.get('level', 1), 'price': max(1, int(it.get('price') or 1)), 'type': it['typeId']}
        images['i'][f"{it['iconId']}.png"] = it.get('img') or f"https://api.dofusdb.fr/img/items/{it['iconId']}.png"
    return n

# ------------------------------------------------------------------ monsters
def grade(m, k):
    g = m['grades']; return g[min(k, len(g) - 1)]

def res_of(m):
    g = grade(m, 4)
    r = {'t': g.get('reductionEarth', 0), 'f': g.get('reductionFire', 0), 'e': g.get('reductionWater', 0), 'a': g.get('reductionAir', 0)}
    return {k: v for k, v in r.items() if v}

def el_of(r):
    if not r: return 'n'
    k, v = max(r.items(), key=lambda kv: kv[1])
    return k if v > 0 else 'n'

def drop_ok(it):
    n = fr(it)
    if n.startswith('Âme capturée') or 'Fragment' in n: return False
    t = it['typeId']
    if t in SLOT_BY_TYPE: return True
    sup = None
    # ressources (super type 9) hors clés/runes/quêtes/temporis/événements
    return t not in (84, 78, 211, 233, 266, 241, 219, 312, 315, 334, 148, 153, 154, 125, 197, 309) and it.get('typeId') and (it.get('m_flags') is not None)

GAME_M = {}
EQUIP = {}  # item id -> objet du jeu (créé plus bas)
equip_ids = set()

def monster_entry(m, boss=False, archi_of=None):
    lo, hi = grade(m, 0)['level'], grade(m, 4)['level']
    if hi > lo + 12: hi = lo + 8  # Milimulou & co. (grades étendus)
    r = res_of(m)
    drops, eq = [], []
    for d in m.get('drops', []):
        it = items.get(d['objectId'])
        if not it or not drop_ok(it): continue
        pct = d.get('percentDropForGrade1', 0) or 0
        if pct <= 0: continue
        if it['typeId'] in SLOT_BY_TYPE:
            eq.append([it['id'], round(pct, 2)]); equip_ids.add(it['id'])
        else:
            drops.append([reg_res(it), round(pct, 2)])
    hpavg = statistics.mean(grade(m, k)['lifePoints'] for k in range(5))
    e = {'name': fr(m), 'dbid': m['id'], 'img': m['gfxId'], 'lvl': [lo, hi], 'el': el_of(r), 'res': r,
         'realHp': round(hpavg), 'drops': drops, 'eq': eq}
    if boss: e['boss'] = True
    if archi_of: e['archiOf'] = archi_of
    images['m'][f"{m['gfxId']}.png"] = m.get('img') or f"https://api.dofusdb.fr/img/monsters/{m['gfxId']}.png"
    return e

def mkey(m): return f"m{m['id']}"

zones_out = []
for z in ZONES:
    subs = []
    for sid, gid, deco in z['subs']:
        s = subareas[sid]
        mons, archis = [], []
        for mid in s['monsters']:
            m = monsters.get(mid)
            if not m or m.get('isQuestMonster') or m['race'] in EXCLUDE_RACES or any(x in fr(m) for x in EXCLUDE_NAMES):
                continue
            if m['race'] == ARCHI_RACE: continue
            if m.get('isBoss'): continue
            GAME_M[mkey(m)] = monster_entry(m)
            mons.append(mkey(m))
            a = monsters.get(m.get('correspondingMiniBossId') or 0)
            if a and a['race'] == ARCHI_RACE:
                GAME_M[mkey(a)] = monster_entry(a, archi_of=mkey(m)); archis.append(mkey(a))
                GAME_M[mkey(m)]['archi'] = mkey(a)
        lv = [min(GAME_M[k]['lvl'][0] for k in mons), max(GAME_M[k]['lvl'][1] for k in mons)]
        sub = {'id': gid, 'dbid': sid, 'name': fr(s), 'lvl': lv, 'deco': deco, 'monsters': mons}
        if gid in HIDDEN: sub['hidden'] = True; sub['requiresItem'] = HIDDEN[gid]
        subs.append(sub)
    # ordre par niveau min (stable)
    subs.sort(key=lambda x: (x['lvl'][0], x['lvl'][1]))
    zo = {k: v for k, v in z.items() if k != 'subs'}; zo['subs'] = subs
    zo['lvl'] = f"{min(s['lvl'][0] for s in subs)} – {max(s['lvl'][1] for s in subs)}"
    zones_out.append(zo)
    log(f"Zone {z['name']}: " + ', '.join(f"{s['name']}[{s['lvl'][0]}-{s['lvl'][1]}] {len(s['monsters'])}m" for s in subs))

# ------------------------------------------------------------------ dungeons
dg_out = {}
for dsub, gid, access in DUNGEONS:
    d = next(x for x in dungeons_raw if x.get('subarea') == dsub)
    boss = monsters[d['bosses'][0]]
    GAME_M[mkey(boss)] = monster_entry(boss, boss=True)
    pool = []
    for mid in d.get('monsters', []):
        m = monsters.get(mid)
        if not m or mid in d['bosses']: continue
        k = mkey(m)
        if k not in GAME_M: GAME_M[k] = monster_entry(m)
        pool.append(k)
    lvl = GAME_M[mkey(boss)]['lvl'][1]
    key = items[d['requiredObjects'][0]['id']]
    keyname = fr(key)
    RES.setdefault(keyname, {'id': key['id'], 'icon': key['iconId'], 'lvl': key['level'], 'price': max(1, key.get('price') or 1), 'type': 84})
    images['i'][f"{key['iconId']}.png"] = key.get('img') or f"https://api.dofusdb.fr/img/items/{key['iconId']}.png"
    nrooms = 3 if lvl <= 20 else 4
    base = min(GAME_M[k]['lvl'][0] for k in pool)
    rooms = []
    for r in range(nrooms):
        rooms.append({'mobs': pool, 'lvl': round(base + (lvl - base) * (r + 1) / (nrooms + 1)), 'size': [2 + (r >= 1), 3 + r + (lvl > 25)]})
    dg_out[gid] = {'name': fr(d), 'dbid': d['id'], 'boss': mkey(boss), 'key': keyname, 'keyDrop': 1, 'lvl': lvl, 'rooms': rooms,
                   'bossMobs': pool[:3], 'access': access}
    for z in zones_out:
        for s in z['subs']:
            if s['id'] == access: s['dungeon'] = gid
    log(f"Donjon {fr(d)}: boss {fr(boss)} niv {lvl}, clé {keyname}, salles {len(rooms)}")

# ------------------------------------------------------------------ gather
gather_out = {}
for job, lst in GATHER.items():
    arr = []
    for name, lv in lst:
        it = item_by_name.get(name)
        if not it: log('!! ressource de récolte introuvable', name); continue
        reg_res(it); arr.append([name, lv])
    gather_out[job] = arr

# ------------------------------------------------------------------ availability & crafts
available = set(RES.keys())
for k, m in GAME_M.items():
    for n, _ in m['drops']: available.add(n)

def stats_of(effects):
    st = {}
    for e in effects or []:
        sid = e.get('effectId') or e.get('actionId')
        if sid not in STAT: continue
        key, sign = STAT[sid]
        a, b = e.get('diceNum', 0) or 0, e.get('diceSide', 0) or 0
        lo, hi = (a, b) if b else (a, a)
        if lo > hi: lo, hi = hi, lo
        lo, hi = lo * sign, hi * sign
        if sign < 0: lo, hi = hi, lo
        if key in st: st[key] = [st[key][0] + lo, st[key][1] + hi]
        else: st[key] = [lo, hi]
    return st

def ing_list(r):
    return [[fr(items[i]), q] for i, q in zip(r['ingredientIds'], r['quantities']) if i in items]

# équipements craftables avec les ressources disponibles
craftable = set()
for rid, r in recipes.items():
    it = items.get(rid)
    if not it or it['typeId'] not in SLOT_BY_TYPE or it.get('level', 999) > MAX_CRAFT_LVL: continue
    if r.get('jobId') not in JOB: continue
    ings = ing_list(r)
    if ings and all(n in available for n, _ in ings):
        craftable.add(rid)
log(f"Équipements : {len(equip_ids)} lâchés par les monstres, {len(craftable)} craftables avec les ressources du jeu")

# ingrédients manquants les plus fréquents (pour info)
miss = {}
for rid, r in recipes.items():
    it = items.get(rid)
    if not it or it['typeId'] not in SLOT_BY_TYPE or it.get('level', 999) > MAX_CRAFT_LVL or r.get('jobId') not in JOB: continue
    ings = ing_list(r)
    m = [n for n, _ in ings if n not in available]
    if len(m) == 1: miss[m[0]] = miss.get(m[0], 0) + 1
log('Ingrédients qui débloqueraient le plus de crafts :', sorted(miss.items(), key=lambda x: -x[1])[:15])

ITEMS = {}
SETS = {}
for iid in sorted(equip_ids | craftable):
    it = items[iid]
    st = stats_of(it.get('possibleEffects'))
    if not st: continue
    o = {'name': fr(it), 'dbid': iid, 'icon': it['iconId'], 'slot': SLOT_BY_TYPE[it['typeId']], 'lvl': max(1, it.get('level', 1)), 'stats': st}
    if it.get('itemSetId', -1) > 0:
        o['set'] = f"s{it['itemSetId']}"
    if iid in craftable:
        r = recipes[iid]; o['craft'] = {'job': JOB[r['jobId']], 'ing': ing_list(r)}
    ITEMS[f"i{iid}"] = o
    images['i'][f"{it['iconId']}.png"] = it.get('img') or f"https://api.dofusdb.fr/img/items/{it['iconId']}.png"

for o in ITEMS.values():
    sid = o.get('set')
    if not sid or sid in SETS: continue
    s = isets.get(int(sid[1:]))
    if not s: o.pop('set'); continue
    bonus = {}
    for n, effs in enumerate(s.get('effects') or []):
        b = {}
        for e in effs or []:
            if e.get('effectId') in STAT:
                k, sign = STAT[e['effectId']]; b[k] = b.get(k, 0) + sign * (e.get('from') or 0)
        if b: bonus[n + 1] = b  # effects[0] = 1 objet porté
    SETS[sid] = {'name': fr(s), 'bonus': bonus}
log(f"Objets retenus : {len(ITEMS)} ; panoplies : {len(SETS)}")

# drops d'équipement -> clés d'objets du jeu
for m in GAME_M.values():
    m['items'] = [[f"i{i}", p] for i, p in m.pop('eq') if f"i{i}" in ITEMS]

# ------------------------------------------------------------------ special crafts (clés + Baguette Rikiki)
SPECIAL = {}
for gid, d in dg_out.items():
    key = item_by_name[d['key']]
    r = recipes.get(key['id'])
    if r:
        ings = ing_list(r)
        for n, _ in ings:
            if n not in RES and n in item_by_name: reg_res(item_by_name[n])
        missing = [n for n, _ in ings if n not in available]
        SPECIAL[d['key']] = {'job': 'bricoleur', 'lvl': 1 if d['lvl'] <= 15 else 10, 'ing': ings}
        if missing: log(f"!! Clé {d['key']} : ingrédients sans source dans le jeu : {missing}")
bag = item_by_name.get('Baguette Rikiki')
if bag:
    r = recipes.get(bag['id'])
    ings = ing_list(r) if r else [['Étoffe du Sanglier', 1], ['Poils Darits', 1], ['Cervelle de Bouftou Noir', 1], ['Pétale Magique du Tournesol Affamé', 1]]
    reg_res(bag)
    SPECIAL['Baguette Rikiki'] = {'job': 'bricoleur', 'lvl': 15, 'ing': ings, 'unique': True}
    log('Baguette Rikiki :', ings, '| manquants :', [n for n, _ in ings if n not in available])

# ------------------------------------------------------------------ hp multiplier (relatif au niveau)
pairs = [(statistics.mean(m['lvl']), m['realHp']) for m in GAME_M.values() if not m.get('boss') and not m.get('archiOf')]
def expected(l):
    near = sorted(pairs, key=lambda p: abs(p[0] - l))[:12]
    return statistics.median(p[1] for p in near)
for m in GAME_M.values():
    if m.get('boss'):
        m['hp'] = 5; m['dmg'] = 1.25
    else:
        ratio = m['realHp'] / max(1, expected(statistics.mean(m['lvl'])))
        m['hp'] = round(min(1.4, max(0.75, ratio)), 2)

# ------------------------------------------------------------------ spells & heads
SPELL_IMG = {}
def get_json(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
        return json.loads(r.read())
if FETCH_IMAGES:
    for cls, bid in BREEDS.items():
        ids = breeds[bid]['breedSpellsId']
        for i in range(0, len(ids), 40):
            q = '&'.join(f'id[$in][]={x}' for x in ids[i:i + 40])
            for sp in get_json(f'https://api.dofusdb.fr/spells?{q}&$limit=50&lang=fr')['data']:
                ic = sp.get('iconId')
                SPELL_IMG[sp['name']['fr']] = ic
                images['s'][f"{ic}.png"] = sp.get('img') or f"https://api.dofusdb.fr/img/spells/sort_{ic}.png"
    log(f"Sorts de classe : {len(SPELL_IMG)} icônes")
HEADS = {}
for cls, bid in BREEDS.items():
    b = breeds[bid]
    for g, url in (b.get('heads') or {}).items():
        fn = f"{cls}_{g[0]}.png"; images['h'][fn] = url
    HEADS[cls] = {'m': f"{cls}_m.png", 'f': f"{cls}_f.png"}
    images['h'][f"{cls}_logo.png"] = b.get('imgTransparent')

# ------------------------------------------------------------------ write
os.makedirs(os.path.join(OUT, 'js'), exist_ok=True)
GD = {'MONSTERS': GAME_M, 'ZONES': zones_out, 'DUNGEONS': dg_out, 'ITEMS': ITEMS, 'SETS': SETS, 'SPECIAL_CRAFTS': SPECIAL,
      'GATHER_JOBS': gather_out, 'RES': RES, 'SPELL_IMG': SPELL_IMG, 'HEADS': HEADS,
      'META': {'source': 'DofusDB (https://dofusdb.fr) — contenu © Ankama Games', 'built': time.strftime('%Y-%m-%d')}}
js = ('/* Généré par tools/build_data.py — ne pas modifier à la main. Données DOFUS via DofusDB, © Ankama Games. */\n'
      '(function (root) {\n  const GAMEDATA = ' + json.dumps(GD, ensure_ascii=False, separators=(',', ':')) + ';\n'
      '  root.GAMEDATA = GAMEDATA;\n  if (typeof module !== "undefined" && module.exports) module.exports = GAMEDATA;\n'
      '})(typeof window !== "undefined" ? window : globalThis);\n')
open(os.path.join(OUT, 'js', 'gamedata.js'), 'w', encoding='utf-8').write(js)
log(f"gamedata.js : {len(js)//1024} Ko, {len(GAME_M)} monstres, {len(RES)} ressources, {len(ITEMS)} objets")

if FETCH_IMAGES:
    jobs = []
    for d, files in images.items():
        os.makedirs(os.path.join(OUT, 'assets', d), exist_ok=True)
        for fn, url in files.items():
            if url: jobs.append((os.path.join(OUT, 'assets', d, fn), url))
    def dl(j):
        p, u = j
        if os.path.exists(p): return 0
        for t in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
                    open(p, 'wb').write(r.read()); return 1
            except Exception:
                time.sleep(1 + t)
        log('!! image', u); return 0
    with ThreadPoolExecutor(6) as ex:
        n = sum(ex.map(dl, jobs))
    log(f"Images : {n} nouvelles / {len(jobs)} au total")
open(os.path.join(OUT, 'report.txt'), 'w', encoding='utf-8').write('\n'.join(report))
