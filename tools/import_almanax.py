"""Calendrier de l'Almanax (0.1.39) : un Méryde et un type de bonus par jour, les mêmes que dans DOFUS.
Lit api.dofusdb.fr (un jour par date d'une année bissextile) et réécrit la ligne ALM_CAL de js/systems.js.
Usage : python3 tools/import_almanax.py"""
import json, re, urllib.request, datetime, concurrent.futures as cf, pathlib

GATHER = {"Bois abondant": "bucheron", "Minerai abondant": "mineur", "Récolte abondante": "paysan", "Pêche abondante": "pecheur", "Cueillette abondante": "alchimiste"}
FETES = ("01/01", "14/02", "31/10", "25/12")

def kind(d, cat, desc):
    desc = desc.lower()
    if d in FETES: return "fete"
    if cat in GATHER: return "gather:" + GATHER[cat]
    if cat.startswith("Challenge supp"): return "chal1"
    if cat.startswith("Challenges"): return "chal"
    if cat.startswith("Anomalies"): return "archi"
    if cat == "Apparition des ressources": return "filon"
    if cat in ("Économie d'ingrédients", "Objets de qualité", "La Grande Bouffe"): return "eco"
    if cat in ("Fabrication intensive", "Fabrique Féérique", "Expérience des métiers"): return "craft2"
    if cat == "Forgemagie améliorée": return "fm"
    if cat == "Concassage": return "brise"
    if cat.startswith("Montures") or cat in ("Efficacité des enclos", "Génération montante"): return "enclos"
    if cat in ("Fortune des Leprechauns", "Quêtes et kamas", "Vœu de pauvreté", "Kolizétons", "Bonta et Brâkmar", "Percepteurs avides"): return "kamas"
    if "donjon" in desc and ("expérience" in desc or "butin" in desc): return "dg"
    if cat.startswith("Points d'expérience et butin") or cat in ("Troollez manège", "Double butin"): return "dg"
    if cat in ("Butin", "Gibier abondant", "Coffre au trésor", "Cadeaux surprises", "Cadeaux Surprises", "Nature généreuse", "Gardiens de la nature", "Du miel dans les oreilles"): return "drop"
    return "xp"

def day(i):
    d = datetime.date(2028, 1, 1) + datetime.timedelta(days=i)
    a = json.load(urllib.request.urlopen(f"https://api.dofusdb.fr/almanax?date={d}", timeout=30))
    n = json.load(urllib.request.urlopen(f"https://api.dofusdb.fr/npcs/{a['npcId']}", timeout=30))
    m = re.match(r"\s*\S.*? est (?:le|la) Méryde ([^.!?,;:|]*)", re.sub(r"<[^>]+>", "", a["meriaDescription"]["fr"]))
    return "|".join([n["name"]["fr"], m.group(1).strip() if m else "", kind(d.strftime("%d/%m"), a["name"]["fr"], re.sub(r"<[^>]+>", "", a["desc"]["fr"]))])

with cf.ThreadPoolExecutor(12) as ex: days = list(ex.map(day, range(366)))
f = pathlib.Path(__file__).resolve().parent.parent / "js" / "systems.js"
src = f.read_text(encoding="utf-8")
line = '  const ALM_CAL = "' + ";".join(days).replace('"', "'") + '".split(";").map((x) => x.split("|"));'
src2 = re.sub(r'^  const ALM_CAL = .*$', lambda _: line, src, count=1, flags=re.M)
assert src2 != src or line in src, "ligne ALM_CAL introuvable dans js/systems.js"
f.write_text(src2, encoding="utf-8"); print(len(days), "jours")
