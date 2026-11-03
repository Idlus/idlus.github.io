"""Boss des mondes, Saison 1 : objets DOFUS des géants vendus à la boutique d'anomalie (choix 9A de Mathis, 03/11/2026).
Lit DofusDB (objets absents d'Idlus) et écrit la table /*WB_S1_ITEMS*/ de js/wboss.js (mêmes caractéristiques que tools/build_data.py).
Usage : python3 tools/wboss_s1_items.py"""
import json, re, ssl, urllib.request, os, sys
sys.path.insert(0, os.path.dirname(__file__))
CA = '/root/.ccr/ca-bundle.crt'
ctx = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
src = open(os.path.join(os.path.dirname(__file__), 'build_data.py'), encoding='utf8').read()
ns = {}
exec(re.search(r"^STAT = \{.*?\n\s+128: .*?\}\n", src, re.S | re.M).group(0), ns)
exec(re.search(r"^SLOT_BY_TYPE = \{.*?\}\n", src, re.S | re.M).group(0), ns)
STAT, SLOT = ns['STAT'], ns['SLOT_BY_TYPE']
# boss -> objets (ids DofusDB) ; les boucliers, familiers et montures d'apparat sont des cosmétiques (Garde-robe)
BOSS = {
  'kralamoure': [8877, 9464, 8991, 13117, 13118, 13119, 30689],
  'cire_momore': [27510, 27511, 27512, 27513, 27514, 27515],
}
APPARAT = {'kralamoure': [18632], 'cire_momore': [27371], 'grozilla': [29114, 20136, 20052, 21147, 21148]}
get = lambda u: json.load(urllib.request.urlopen(u, context=ctx, timeout=30))
out = {'eq': {}, 'ap': {}}
for b, ids in BOSS.items():
  for i in ids:
    it = get(f'https://api.dofusdb.fr/items/{i}')
    st = {}
    for e in it.get('effects') or []:
      sid = e.get('effectId')
      if sid not in STAT: continue
      k, sign = STAT[sid]; a, c = e.get('from') or 0, e.get('to') or 0
      lo, hi = (a, c) if c else (a, a)
      lo, hi = sorted((lo * sign, hi * sign))
      st[k] = [st[k][0] + lo, st[k][1] + hi] if k in st else [lo, hi]
    o = {'b': b, 'name': it['name']['fr'], 'icon': it['iconId'], 'slot': SLOT.get(it['typeId'], '?'), 'lvl': it['level'], 'stats': st}
    if it.get('itemSetId'): o['set'] = f"s{it['itemSetId']}"
    out['eq'][f'i{i}'] = o
out['sets'] = {}
for sid in sorted({o['set'] for o in out['eq'].values() if o.get('set')}):
  st_ = get(f'https://api.dofusdb.fr/item-sets/{sid[1:]}')
  bonus = {}
  for n, effs in enumerate(st_.get('effects') or []):
    bb = {}
    for e in effs or []:
      if e.get('effectId') in STAT:
        k, sign = STAT[e['effectId']]; bb[k] = bb.get(k, 0) + sign * abs(e.get('from') or 0)
    if bb: bonus[str(n + 1)] = bb
  out['sets'][sid] = {'name': st_['name']['fr'], 'bonus': bonus, 'size': len(st_.get('items') or [])}
for b, ids in APPARAT.items():
  for i in ids:
    it = get(f'https://api.dofusdb.fr/items/{i}')
    out['ap'][f'i{i}'] = {'b': b, 'name': it['name']['fr'], 'icon': it['iconId'], 'kind': it['type']['name']['fr']}
f = os.path.join(os.path.dirname(__file__), '..', 'js', 'wboss.js')
s = open(f, encoding='utf8').read()
blk = '/*WB_S1_ITEMS*/' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '/*/WB_S1_ITEMS*/'
if '/*WB_S1_ITEMS*/' in s: s = re.sub(r'/\*WB_S1_ITEMS\*/.*?/\*/WB_S1_ITEMS\*/', lambda m: blk, s, flags=re.S)
else: print(blk[:2000]); sys.exit('table absente de js/wboss.js : ajoute /*WB_S1_ITEMS*/{}/*/WB_S1_ITEMS*/')
open(f, 'w', encoding='utf8').write(s)
for k, v in out['sets'].items(): print(k, v)
