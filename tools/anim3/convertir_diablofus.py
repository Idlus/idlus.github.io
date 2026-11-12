"""Animations DOFUS 3 (maquette « Visuels DOFUS 3 », choix 1A 2A 3A 4A 5A du 12/11/2026).
Convertit les planches déjà extraites pour Diablofus (atlas JSON du dépôt dofus-diablo + images sur
assets.diablofus.com) en bandes légères pour Idlus, direction « face » (_1), une bande WebP par animation.
  python3 tools/anim3/convertir_diablofus.py <dépôt dofus-diablo> <sortie> m <correspondance.json>   (monstres)
  python3 tools/anim3/convertir_diablofus.py <dépôt dofus-diablo> <sortie> h iop:iop_m,iop_f:iop_f,cra:cra_m,cra_f:cra_f
  python3 tools/anim3/convertir_diablofus.py <dépôt dofus-diablo> <sortie> fx <liste des gfx>
Sortie <sortie>/<m|h|fx>/<nom>-<anim>.webp (grille de c colonnes : WebP limité à 16 383 px)
et <sortie>/anim3_<m|h|fx>.json : {nom: {anim: [images, colonnes, largeur, hauteur, ox, oy, ips]}}.
(ox, oy) = position du pied (ou de l'origine de l'effet) dans la case, la même pour toutes les animations d'un nom."""
import json, os, sys, urllib.request
from PIL import Image
DD, OUT, KIND, ARG = sys.argv[1:5]
UA = {'User-Agent': 'Mozilla/5.0 (idlus-anim3)'}
os.makedirs(f'{OUT}/{KIND}', exist_ok=True); cache = f'{OUT}/.cache/'; os.makedirs(cache, exist_ok=True)
META = f'{OUT}/anim3_{KIND}.json'; meta = json.load(open(META)) if os.path.exists(META) else {}
def page(dossier, nom):
    p = cache + nom
    if not os.path.exists(p):
        with urllib.request.urlopen(urllib.request.Request(f'https://assets.diablofus.com/{dossier}/{nom}', headers=UA), timeout=90) as r: open(p, 'wb').write(r.read())
    return Image.open(p).convert('RGBA')
def frames(path):
    d = json.load(open(path)); fr = {}
    for t in (d['textures'] if 'textures' in d else [{'image': d['meta']['image'], 'frames': [dict(v, filename=k) for k, v in d['frames'].items()]}]):
        for f in t['frames']: f['_img'] = t['image']; fr[f['filename']] = f
    return fr
def seq(fr, a): return sorted([x for x in fr if x.rsplit('_', 1)[0] == a], key=lambda x: int(x.rsplit('_', 1)[1]))
def pack(nom, dossier, fr, choix, ref, ips, q=88):
    """choix = {clé: [noms d'images]} ; ref = point de référence (x, y) dans le repère sourceSize."""
    pages = {}; m = {}
    for k, L in choix.items():
        x0 = min(fr[i]['spriteSourceSize']['x'] for i in L); y0 = min(fr[i]['spriteSourceSize']['y'] for i in L)
        x1 = max(fr[i]['spriteSourceSize']['x'] + fr[i]['spriteSourceSize']['w'] for i in L); y1 = max(fr[i]['spriteSourceSize']['y'] + fr[i]['spriteSourceSize']['h'] for i in L)
        W, H = x1 - x0, y1 - y0; c = max(1, min(len(L), 16383 // W)); rows = -(-len(L) // c)
        im = Image.new('RGBA', (W * c, H * rows))
        for n, key in enumerate(L):
            f = fr[key]; r = f['frame']; s = f['spriteSourceSize']
            if f['_img'] not in pages: pages[f['_img']] = page(dossier, f['_img'])
            p = pages[f['_img']].crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
            if f.get('rotated'): p = p.rotate(90, expand=True)
            im.paste(p, ((n % c) * W + s['x'] - x0, (n // c) * H + s['y'] - y0))
        im.save(f'{OUT}/{KIND}/{nom}-{k}.webp', quality=q, method=6)
        m[k] = [len(L), c, W, H, round(ref[0] - x0, 1), round(ref[1] - y0, 1), ips]
    return m
def pied(fr, L):
    """Pied = bas-milieu de la partie opaque de la première image d'attente, dans le repère sourceSize."""
    f = fr[L[0]]; s = f['spriteSourceSize']; return (s['x'] + s['w'] / 2, s['y'] + s['h'])
def fin(nom, m): meta[nom] = m; json.dump(meta, open(META, 'w')); print(nom, {k: v[:4] for k, v in m.items()}, flush=True)
if KIND == 'm':
    corr = json.load(open(ARG))
    for nom in sorted({v['s'] for v in corr.values()}):
        if nom in meta: continue
        try:
            fr = frames(f'{DD}/public/assets/sprites/{nom}.json'); ch = {}
            for k, alts in {'idle': ['AnimStatique_1'], 'atk': ['AnimAttaque0_1', 'AnimAttaque1_1', 'AnimArme0_1'], 'hit': ['AnimHit_1'], 'die': ['AnimMort_1']}.items():
                for a in alts:
                    if seq(fr, a): ch[k] = seq(fr, a); break
            if 'idle' not in ch: print('sans attente', nom); continue
            fin(nom, pack(nom, 'sprites', fr, ch, pied(fr, ch['idle']), 30))
        except Exception as e: print('ERREUR', nom, e, flush=True)
elif KIND == 'h':
    for paire in ARG.split(','):
        src, nom = paire.split(':')
        fr = frames(f'{DD}/public/assets/sprites/{src}.json'); ch = {}
        for a in sorted({x.rsplit('_', 1)[0] for x in fr}):
            if a.endswith('_1') and (a.startswith('AnimAttaque') or a in ('AnimArme0_1', 'AnimHit_1', 'AnimMort_1', 'AnimStatiqueCombat0_1')):
                ch[a[4:-2].lower().replace('statiquecombat0', 'idle').replace('attaque', 'a').replace('arme0', 'arme')] = seq(fr, a)
        fin(nom, pack(nom, 'sprites', fr, ch, pied(fr, ch['idle']), 30))
elif KIND == 'fx':
    G = json.load(open(f'{DD}/src/data/spellfx.json'))['gfx']
    for g in open(ARG).read().split():
        if g in meta or g not in G: continue
        try:
            fr = frames(f'{DD}/public/assets/fx/fx_{g}.json'); A = G[g]['anims']; a = 'FX_0' if 'FX_0' in A else 'FX_1'
            L = seq(fr, a); ss = fr[L[0]]['sourceSize']; o = G[g]['origin']
            fin(g, pack(g, 'fx', fr, {'fx': L}, (o[0] * ss['w'], o[1] * ss['h']), G[g]['fps'], 85))
        except Exception as e: print('ERREUR', g, e, flush=True)
