"""Sorts : animation du lanceur + effets officiels (repris de Diablofus : classes.json, looks.ts, spellfx.json).
  python3 tools/anim3/sorts_diablofus.py <dépôt dofus-diablo> <sortie>
Écrit <sortie>/anim3_s.json : { "<id DOFUS du sort>": {"a": "AnimAttaqueNNN", "t": [gfx…], "tb": [gfx en fond…], "c": [...], "cb": [...], "p": gfx} }
et la liste des gfx à convertir (<sortie>/anim3_gfx.txt)."""
import json, re, sys
DD, OUT = sys.argv[1:3]
C = json.load(open(f'{DD}/src/data/classes.json')); FX = json.load(open(f'{DD}/src/data/spellfx.json'))
looks = open(f'{DD}/src/render/looks.ts', encoding='utf8').read()
anim = {}
for k, a in re.findall(r"^\s*([a-z_0-9]+): \{ anim: '(AnimAttaque\d+|AnimArme\d+)'", looks, re.M): anim.setdefault(k, a)
out, gfx = {}, set()
for cls, d in C.items():
    for k, s in (d.get('spells') or {}).items():
        if not s.get('dofusId'): continue
        f = FX['spells'].get(k, {}); e = {}
        if k in anim: e['a'] = anim[k]
        for side, key in (('target', 't'), ('caster', 'c')):
            for r in f.get(side, []):
                e.setdefault(key + ('b' if r.get('bg') else ''), []).append(r['gfx']); gfx.add(r['gfx'])
        if f.get('projectile'): e['p'] = f['projectile']['gfx']; gfx.add(e['p'])
        if e: e['cls'] = cls; out[str(s['dofusId'])] = e
json.dump(out, open(f'{OUT}/anim3_s.json', 'w'), ensure_ascii=False)
open(f'{OUT}/anim3_gfx.txt', 'w').write('\n'.join(map(str, sorted(gfx))))
print(len(out), 'sorts', len(gfx), 'effets', sorted({v['cls'] for v in out.values()}))
