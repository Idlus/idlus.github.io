#!/usr/bin/env python3
"""Sonde des idoles classiques (Dynamo, Hebdo, Ougah…), disparues de DOFUS 3.

Essaie d'autres sources que la base DOFUS 3 de DofusDB, dans cet ordre, et écrit dans tools/probe/idoles/touch/ :
  1. la base DOFUS Touch de DofusDB (Touch a gardé les idoles) : idoles.json + icons/<iconId>.png ;
  2. le serveur d'images d'Ankama (static.ankama.com) pour les icônes manquantes ;
  3. en dernier recours, la page « idoles » de l'ancienne encyclopédie officielle via archive.org : encyclopedie.html + encyclopedie.json.
rapport.txt résume ce que chaque source a donné.
Projet de fan non commercial. Merci à DofusDB (https://dofusdb.fr) — contenu © Ankama Games.
"""
import json, os, re, time, urllib.request, urllib.error, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'tools', 'probe', 'idoles', 'touch')
os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
UA = 'DofousXen-fan-idle-import (perso, import unique, lent)'
HOSTS = ['https://api.touch.dofusdb.fr', 'https://api.dofusdb.fr/touch', 'https://touch.dofusdb.fr/api']
ANKAMA = ['https://static.ankama.com/dofus/www/game/items/200/{ic}.png', 'https://static.ankama.com/dofus/www/game/items/52/{ic}.png']
report = []


def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); report.append(s)


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/octet-stream' if binary else 'application/json, text/html'})
            with urllib.request.urlopen(req, timeout=40) as r:
                b = r.read()
                return b if binary else json.loads(b.decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code in (404, 400):
                return None
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def fr(o, k='name'):
    n = o.get(k) if isinstance(o, dict) else None
    return n.get('fr', '') if isinstance(n, dict) else str(n or '')


def pages(host, ep, q=''):
    out, skip = [], 0
    while True:
        r = get(f'{host}/{ep}?$limit=50&$skip={skip}&lang=fr{q}')
        if not r or not r.get('data'):
            break
        out += r['data']; skip += len(r['data'])
        if skip >= r.get('total', 0) or len(r['data']) < 50:
            break
        time.sleep(0.1)
    return out


def eff_txt(e, effects):
    d = effects.get(e.get('effectId'), {})
    t = fr(d, 'description') or f"effet {e.get('effectId')}"
    lo, hi = e.get('from', e.get('diceNum', 0)) or 0, e.get('to', e.get('diceSide', 0)) or 0
    t = re.sub(r'#1\{~1~2 (à|to) \}#2', f'{lo} à {hi}' if hi and hi != lo else f'{lo}', t)
    t = t.replace('#1', str(lo)).replace('#2', str(hi)).replace('#3', '')
    return re.sub(r'\s+', ' ', re.sub(r'[{}~\d]*\{[^}]*\}', '', t)).strip()


def save_icon(host, ic):
    f = os.path.join(OUT, 'icons', f'{ic}.png')
    if os.path.exists(f):
        return 'déjà là'
    urls = ([f'{host}/img/items/{ic}.png'] if host else []) + [u.format(ic=ic) for u in ANKAMA]
    for u in urls:
        b = get(u, binary=True)
        if b and len(b) > 200:
            open(f, 'wb').write(b)
            return 'dofusdb' if host and u.startswith(host) else 'ankama'
    return None


# 1. DofusDB Touch
rows = []
for host in HOSTS:
    types = pages(host, 'item-types')
    if not types:
        log(f'{host} : pas de réponse'); continue
    idtypes = [t for t in types if 'idole' in fr(t).lower()]
    log(f'{host} : {len(types)} types, types idole : {[fr(t) for t in idtypes]}')
    if not idtypes:
        continue
    q = ''.join(f'&typeId[$in][]={t["id"]}' for t in idtypes)
    items = pages(host, 'items', q)
    log(f'{host} : {len(items)} idoles')
    if not items:
        continue
    effects = {e['id']: e for e in pages(host, 'effects')}
    src = {}
    for it in items:
        ic = it.get('iconId'); s = save_icon(host, ic) if ic else None
        src[s] = src.get(s, 0) + 1
        rows.append({'id': it['id'], 'nom': fr(it), 'type': next((fr(t) for t in idtypes if t['id'] == it.get('typeId')), ''), 'niveau': it.get('level'),
                     'icone': ic if s else None, 'source_icone': s, 'description': fr(it, 'description'),
                     'effets': [eff_txt(e, effects) for e in it.get('effects') or []], 'brut_effets': it.get('effects'),
                     'criterions': it.get('criterions'), 'recette': it.get('recipeIds')})
    log(f'icônes : {src}')
    break
rows.sort(key=lambda x: ((x['niveau'] or 0), x['nom']))
json.dump(rows, open(os.path.join(OUT, 'idoles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
log(f'{len(rows)} idoles écrites, {sum(1 for r in rows if r["icone"])} avec icône')

# 2. Archive.org : ancienne encyclopédie officielle (dernier recours, ou pour comparer)
try:
    av = get('https://archive.org/wayback/available?url=www.dofus.com/fr/mmorpg/encyclopedie/idoles&timestamp=20220101')
    snap = (((av or {}).get('archived_snapshots') or {}).get('closest') or {}).get('url')
    log('archive.org :', snap or 'aucun instantané')
    if snap:
        html = get(snap, binary=True)
        if html:
            html = html.decode('utf-8', 'replace')
            open(os.path.join(OUT, 'encyclopedie.html'), 'w', encoding='utf-8').write(html)
            found = re.findall(r'<img[^>]+src="([^"]*static\.ankama\.com[^"]*items[^"]*)"[^>]*alt="([^"]*)"', html)
            json.dump([{'nom': n, 'img': u} for u, n in found], open(os.path.join(OUT, 'encyclopedie.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            log(f'archive.org : {len(found)} images d\'objets trouvées dans la page')
            for u, n in found:
                m = re.search(r'/(\d+)\.png', u)
                if m and not os.path.exists(os.path.join(OUT, 'icons', f'{m.group(1)}.png')):
                    s = save_icon(None, m.group(1))
                    if not s:
                        b = get(u if u.startswith('http') else 'https:' + u, binary=True)
                        if b and len(b) > 200:
                            open(os.path.join(OUT, 'icons', f'{m.group(1)}.png'), 'wb').write(b); s = 'archive'
                    log(f'  {n} : {s or "icône introuvable"}')
except Exception as ex:
    log('archive.org : erreur', ex)

open(os.path.join(OUT, 'rapport.txt'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
