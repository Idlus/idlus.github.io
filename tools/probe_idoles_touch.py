#!/usr/bin/env python3
"""Sonde des idoles classiques (Dynamo, Hebdo, Ougah…), disparues de DOFUS 3.

Essaie plusieurs sources, dans cet ordre, et écrit dans tools/probe/idoles/touch/ :
  1. l'encyclopédie officielle de DOFUS Touch (dofus-touch.com), qui a gardé les idoles : liste + fiche de chaque idole,
     images sur static.ankama.com → idoles.json, icons/<iconId>.png, pages/*.html ;
  2. la base DOFUS Touch de DofusDB si elle répond ;
  3. archive.org (index CDX) pour l'ancienne encyclopédie dofus.com ;
  4. dofuspourlesnoobs.com (page des idoles).
Tout le HTML lu est conservé dans pages/ pour pouvoir le relire si l'extraction automatique rate. rapport.txt résume.
Projet de fan non commercial. Contenu © Ankama Games.
"""
import html as H, json, os, re, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'tools', 'probe', 'idoles', 'touch')
for d in ('icons', 'pages'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 (idlus-fan-probe)'
report = []


def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); report.append(s)


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9'})
            with urllib.request.urlopen(req, timeout=40) as r:
                b = r.read()
                return b if binary else b.decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            log(f'  HTTP {e.code} {url}')
            if e.code in (404, 400, 403, 410):
                return None
            time.sleep(2 * (i + 1))
        except Exception as ex:
            log(f'  erreur {url} : {ex}')
            time.sleep(2 * (i + 1))
    return None


def save_page(name, txt):
    open(os.path.join(OUT, 'pages', name), 'w', encoding='utf-8').write(txt)


def save_icon(ic, urls):
    f = os.path.join(OUT, 'icons', f'{ic}.png')
    if os.path.exists(f):
        return True
    for u in urls:
        b = get(u, binary=True)
        if b and len(b) > 200:
            open(f, 'wb').write(b); return True
    return False


def clean(t):
    return re.sub(r'\s+', ' ', H.unescape(re.sub(r'<[^>]+>', ' ', t))).strip()


rows = []

# 1. Encyclopédie DOFUS Touch
log('== dofus-touch.com ==')
links = {}
for page in range(1, 6):
    url = f'https://www.dofus-touch.com/fr/mmorpg/encyclopedie/idoles?page={page}'
    t = get(url)
    if not t:
        break
    save_page(f'touch_liste_{page}.html', t)
    found = re.findall(r'href="(/fr/mmorpg/encyclopedie/idoles/(\d+)-([^"]+))"', t)
    new = 0
    for href, iid, slug in found:
        if iid not in links:
            links[iid] = (href, slug); new += 1
    log(f'  page {page} : {len(found)} liens, {new} nouveaux')
    if not new:
        break
    time.sleep(0.5)
log(f'  {len(links)} idoles listées')
for iid, (href, slug) in sorted(links.items(), key=lambda x: int(x[0])):
    t = get('https://www.dofus-touch.com' + href)
    if not t:
        continue
    save_page(f'touch_{iid}.html', t)
    name = clean((re.search(r'<h1[^>]*class="ak-return-link"[^>]*>(.*?)</h1>', t, re.S) or re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S) or [None, slug])[1])
    lvl = re.search(r'Niveau\s*:?\s*(\d+)', t)
    imgs = re.findall(r'(https?://static\.ankama\.com/dofus/www/game/items/\d+/(\d+)\.png)', t)
    ic = imgs[0][1] if imgs else None
    if ic:
        save_icon(ic, [f'https://static.ankama.com/dofus/www/game/items/200/{ic}.png', imgs[0][0]])
    # effets : section « Effets » puis les lignes de liste
    eff = []
    m = re.search(r'Effets.*?<ul[^>]*>(.*?)</ul>', t, re.S)
    if m:
        eff = [clean(x) for x in re.findall(r'<li[^>]*>(.*?)</li>', m.group(1), re.S)]
    desc = re.search(r'Description.*?<div[^>]*class="ak-panel-content"[^>]*>(.*?)</div>', t, re.S)
    rec = []
    mr = re.search(r'Recette.*?<div[^>]*class="ak-panel-content"[^>]*>(.*?)</div>\s*</div>', t, re.S)
    if mr:
        rec = [clean(x) for x in re.findall(r'<div class="ak-title">(.*?)</div>', mr.group(1), re.S)]
    rows.append({'id': int(iid), 'nom': name, 'niveau': int(lvl.group(1)) if lvl else None, 'icone': ic, 'effets': eff,
                 'description': clean(desc.group(1)) if desc else '', 'recette': rec, 'source': 'dofus-touch.com'})
    time.sleep(0.4)
log(f'  {len(rows)} fiches lues, {sum(1 for r in rows if r["icone"] and os.path.exists(os.path.join(OUT, "icons", r["icone"] + ".png")))} icônes')

# 2. DofusDB Touch (si un jour l'adresse répond)
if not rows:
    log('== DofusDB Touch ==')
    for host in ['https://api.touch.dofusdb.fr', 'https://touch.api.dofusdb.fr']:
        t = get(f'{host}/item-types?$limit=5&lang=fr')
        log(f'  {host} : {"ok" if t else "pas de réponse"}')

# 3. archive.org (index CDX de l'ancienne encyclopédie)
if not rows:
    log('== archive.org ==')
    t = get('https://web.archive.org/cdx/search/cdx?url=dofus.com/fr/mmorpg/encyclopedie/idoles*&output=json&filter=statuscode:200&collapse=urlkey&limit=200')
    try:
        cdx = json.loads(t) if t else []
    except Exception:
        cdx = []
    log(f'  {max(0, len(cdx) - 1)} adresses archivées')
    json.dump(cdx, open(os.path.join(OUT, 'archive_cdx.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for r in cdx[1:60]:
        ts, orig = r[1], r[2]
        if not re.search(r'/idoles/\d+-', orig):
            continue
        t = get(f'https://web.archive.org/web/{ts}id_/{orig}')
        if not t:
            continue
        iid = re.search(r'/idoles/(\d+)-', orig).group(1)
        save_page(f'archive_{iid}.html', t)
        name = clean((re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S) or [None, orig])[1])
        imgs = re.findall(r'(https?://static\.ankama\.com/dofus/www/game/items/\d+/(\d+)\.png)', t)
        ic = imgs[0][1] if imgs else None
        ok = ic and save_icon(ic, [f'https://static.ankama.com/dofus/www/game/items/200/{ic}.png', f'https://web.archive.org/web/{ts}id_/{imgs[0][0]}'])
        rows.append({'id': int(iid), 'nom': name, 'icone': ic if ok else None, 'source': 'archive.org'})
        log(f'  {name} : icône {"ok" if ok else "manquante"}')
        time.sleep(0.5)

# 4. dofuspourlesnoobs
if not rows:
    log('== dofuspourlesnoobs.com ==')
    for u in ['https://www.dofuspourlesnoobs.com/idoles.html', 'https://www.dofuspourlesnoobs.com/les-idoles.html']:
        t = get(u)
        if t:
            save_page('dpln_idoles.html', t)
            log(f'  {u} : {len(t)} caractères, {len(re.findall(r"<img", t))} images')
            break

rows.sort(key=lambda x: (x.get('niveau') or 0, x['nom']))
json.dump(rows, open(os.path.join(OUT, 'idoles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
log(f'{len(rows)} idoles écrites, {len(os.listdir(os.path.join(OUT, "icons")))} icônes')
open(os.path.join(OUT, 'rapport.txt'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
