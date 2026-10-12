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
    {'id': 'amakna', 'name': 'Amakna', 'desc': 'Le royaume du Roi Allister : campagnes, forêts, cimetière et montagne des Craqueleurs.', 'theme': 'meadow',
     'subs': [(485, 'ama_campagne', 'meadow', 14, 22), (4, 'ama_foret', 'forest', 14, 40), (5, 'ama_bouftous', 'meadow', 20, 32),
              (179, 'ama_boos', 'grave', 20, 32), (3, 'ama_ingalsse', 'wheat', 30, 42), (6, 'ama_cimetiere', 'grave', 24, 44),
              (276, 'ama_gobelins', 'quarry', 30, 42), (170, 'ama_scarafeuilles', 'meadow', 32, 44), (22, 'ama_foret_malefique', 'forest', 33, 45), (9, 'ama_dark_vlad', 'forest', 140, 152),
              (8, 'ama_bworks', 'quarry', 30, 52), (2, 'ama_craqueleurs', 'quarry', 40, 52), (181, 'ama_cloaque', 'sewer', 50, 62),
              (12, 'ama_gelees', 'beach', 52, 64), (243, 'ama_pitons', 'quarry', 57, 72)]},
    {'id': 'cania', 'name': 'Plaines de Cania', 'desc': 'Vastes plaines, lacs de Blops et robots du Massif.', 'theme': 'wheat',
     'subs': [(334, 'can_baie', 'beach', 33, 48), (178, 'can_porkass', 'meadow', 38, 52), (56, 'can_lac', 'lake', 50, 62),
              (68, 'can_champs', 'wheat', 49, 66), (54, 'can_massif', 'quarry', 50, 66), (70, 'can_plaines', 'quarry', 57, 72),
              (521, 'can_pics', 'quarry', 78, 86), (55, 'can_penates', 'grave', 98, 106), (1038, 'can_bibliotheque', 'city', 98, 112), (523, 'can_cirque', 'quarry', 106, 116),
              (518, 'can_landes', 'quarry', 135, 152), (519, 'can_dents', 'quarry', 148, 162), (809, 'can_kanigs', 'city', 148, 162)]},
    {'id': 'wabbit', 'name': 'Île des Wabbits', 'desc': "L'île du Wa Wabbit, de ses Wabbits et de ses champs de Cawottes.", 'theme': 'meadow', 'requires': {'boss': 'cour_bouftou_royal'},
     'subs': [(161, 'wab_cawotte', 'meadow'), (164, 'wab_couronne', 'meadow'), (163, 'wab_tombeaux', 'grave'), (162, 'wab_waldo', 'meadow'), (798, 'wab_labos', 'cave')]},
    {'id': 'sidimote', 'name': 'Landes de Sidimote', 'desc': 'Terres désolées, roulottes des Magik Riktus et repaire du Meulou.', 'theme': 'grave',
     'subs': [(57, 'sid_desolation', 'grave', 58, 66), (526, 'sid_roulottes', 'meadow', 78, 86), (522, 'sid_hurlements', 'grave', 88, 96),
              (71, 'sid_gisgoul', 'quarry', 170, 182), (495, 'sid_fungus', 'cave', 170, 182), (889, 'sid_domaine_fungus', 'forest', 170, 182)]},
    {'id': 'koalaks', 'name': 'Montagne des Koalaks', 'desc': 'Forêts de Kaliptus, lacs enchantés et canyon sauvage.', 'theme': 'forest',
     'subs': [(234, 'koa_kaliptus', 'forest', 56, 82), (231, 'koa_lacs', 'lake', 56, 82), (253, 'koa_canyon', 'quarry', 66, 92), (275, 'koa_morhkitu', 'forest', 98, 112), (230, 'koa_cimetiere', 'grave', 98, 112)]},
    {'id': 'abrak', 'name': 'Forêt des Abraknydes', 'desc': 'La sombre forêt des arbres vivants.', 'theme': 'forest',
     'subs': [(168, 'abr_sombre', 'forest', 70, 86)]},
    {'id': 'moon', 'name': 'Île de Moon', 'desc': 'Jungle et pirates de l\'île du terrible Moon.', 'theme': 'beach',
     'subs': [(167, 'moon_crane', 'beach', 78, 86), (165, 'moon_jungle', 'forest', 88, 96)]},
    {'id': 'dragoeufs', 'name': 'Terres des Dragoeufs', 'desc': 'Le village, les souterrains et le sanctuaire des Dragoeufs.', 'theme': 'quarry',
     'subs': [(315, 'dra_village', 'city', 88, 96), (316, 'dra_souterrains', 'cave', 88, 96), (314, 'dra_sanctuaire', 'mine', 108, 116)]},
    {'id': 'otomai', 'name': "Île d'Otomaï", 'desc': 'Plaines, tourbières et villages de l\'île du savant Otomaï.', 'theme': 'forest',
     'subs': [(454, 'oto_plaines', 'meadow', 90, 101), (457, 'oto_tourbiere', 'sewer', 89, 104), (471, 'oto_tourbiere2', 'sewer', 89, 104), (468, 'oto_zoths', 'city', 110, 128), (469, 'oto_canopee', 'forest', 110, 128),
              (455, 'oto_jungle', 'forest', 123, 145), (464, 'oto_hakam', 'forest', 140, 162), (472, 'oto_feuillage', 'forest', 140, 162)]},
    {'id': 'minotoror', 'name': 'Île du Minotoror', 'desc': 'L\'île et le labyrinthe du Minotoror.', 'theme': 'quarry',
     'subs': [(209, 'mino_ile', 'beach', 100, 122), (319, 'mino_labyrinthe', 'cave', 104, 122)]},
    {'id': 'pandala', 'name': 'Île de Pandala', 'desc': 'L\'île des Pandawas, divisée entre les éléments.', 'theme': 'meadow',
     'subs': [(942, 'pan_plantala', 'meadow', 98, 106), (941, 'pan_akwadala', 'lake', 118, 126), (944, 'pan_terrdala', 'quarry', 118, 126),
              (943, 'pan_feudala', 'quarry', 130, 142), (945, 'pan_aerdala', 'sky', 130, 142)]},
    {'id': 'frigost', 'name': 'Île de Frigost', 'desc': 'L\'île gelée : le port, la bourgade et les champs de glace.', 'theme': 'sky',
     'subs': [(600, 'fri_port', 'beach', 78, 86), (601, 'fri_bourgade', 'city', 78, 86), (602, 'fri_champs', 'sky', 108, 116),
              (604, 'fri_pins', 'forest', 130, 142), (615, 'fri_lac', 'lake', 130, 142), (609, 'fri_berceau', 'beach', 140, 152), (610, 'fri_larmes', 'mine', 150, 162),
              (603, 'fri_village', 'sky', 160, 172), (606, 'fri_crevasse', 'cave', 160, 172), (605, 'fri_petrifiee', 'forest', 170, 182),
              (608, 'fri_crocs', 'quarry', 180, 192), (611, 'fri_torrideau', 'sky', 180, 192), (753, 'fri_ruche', 'cave', 180, 192)]},
    {'id': 'saharach', 'name': 'Saharach', 'desc': 'Le désert brûlant des Cacterres, des Vers des sables et de la Pyramide Maudite.', 'theme': 'beach', 'requires': {'boss': 'labyrinthe_minotoror'},
     'subs': [(873, 'sah_cacterre', 'beach', 120, 132), (878, 'sah_gorge', 'quarry', 160, 172), (879, 'sah_cite', 'city', 160, 172), (881, 'sah_pyramide', 'grave', 198, 212)]},
    {'id': 'pwak', 'name': 'Île de Pwâk', 'desc': "L'île gourmande des Croquants et des Chocomanciens.", 'theme': 'meadow', 'requires': {'boss': 'labyrinthe_minotoror'},
     'subs': [(911, 'pwak_jardins', 'meadow', 120, 132)]},
    {'id': 'divines', 'name': 'Dimensions divines', 'desc': 'Srambad, Enutrosor, Écaflipus, Xélorium et Osavora : les mondes des dieux.', 'theme': 'spirit', 'requires': {'boss': 'labyrinthe_minotoror'},
     'subs': [(827, 'sram_ruelles', 'city', 120, 132), (821, 'enu_carriere', 'mine', 140, 152), (856, 'eca_lande', 'meadow', 150, 162), (837, 'xel_present', 'city', 160, 172),
              (1041, 'osa_toorbz', 'forest', 160, 172), (828, 'sram_catacombres', 'grave', 170, 182),
              (822, 'enu_retraite', 'mine', 198, 212), (829, 'sram_hauts', 'city', 198, 212), (838, 'xel_lendemains', 'spirit', 198, 212), (857, 'eca_temple', 'city', 198, 212)]},
    {'id': 'grobe', 'name': 'Île de Grobe', 'desc': "L'île des tombeaux, de l'Armée de brume et des Yokai.", 'theme': 'grave', 'requires': {'boss': 'labo_tynril'},
     'subs': [(952, 'grobe_cimetiere', 'grave', 150, 162), (955, 'grobe_mont', 'quarry', 160, 172)]},
    {'id': 'sakai', 'name': 'Île de Sakaï', 'desc': 'Plaine glacée et mine abandonnée des Gobelins de Sakaï.', 'theme': 'sky', 'requires': {'boss': 'antre_korriandre'},
     'subs': [(651, 'sak_plaine', 'sky', 180, 192), (652, 'sak_foret', 'forest', 180, 192)]},
    {'id': 'valonia', 'name': 'Archipel de Valonia', 'desc': "Les galeries d'Ereboria et le bastion des Marteaux-Aigris.", 'theme': 'quarry', 'requires': {'boss': 'antre_korriandre'},
     'subs': [(1027, 'val_ereboria', 'mine', 180, 192)]},
    {'id': 'nimotopia', 'name': 'Nimotopia', 'desc': 'Le territoire des Chassouilleurs du Comte Razof.', 'theme': 'meadow', 'requires': {'boss': 'antre_korriandre'},
     'subs': [(883, 'nimotopia', 'meadow', 180, 192)]},
    {'id': 'obscure', 'name': 'Dimension Obscure', 'desc': "Le royaume des Obscuranti et la Pyramide d'Ombre.", 'theme': 'spirit', 'requires': {'boss': 'antre_korriandre'},
     'subs': [(813, 'obs_dimension', 'spirit', 180, 192)]},
    {'id': 'harebourg', 'name': 'Frigost : Harebourg', 'desc': "Le domaine du Comte Harebourg et le Belvédère d'Ilyzaelle.", 'theme': 'sky', 'requires': {'boss': 'cavernes_kolosso'},
     'subs': [(785, 'har_jardins', 'meadow', 198, 212), (786, 'har_remparts', 'quarry', 198, 212), (787, 'har_tannerie', 'city', 198, 212),
              (788, 'har_bastion', 'quarry', 198, 212), (789, 'har_clepsydre', 'city', 198, 212), (892, 'har_caserne', 'sky', 198, 212)]},
    {'id': 'sufokia', 'name': 'Baie de Sufokia', 'desc': "La baie engloutie et l'Aquadôme de Merkator.", 'theme': 'beach', 'requires': {'boss': 'cavernes_kolosso'},
     'subs': [(804, 'suf_embruns', 'lake', 198, 212)]},
]
HIDDEN = {'ast_planque': 'Baguette Rikiki'}
DUNGEONS = [  # (sous-zone DofusDB du donjon, id jeu, sous-zone d'accès)
    (447, 'crypte_kardorim', 'inc_cimetiere'),
    (306, 'grange_tournesol', 'ast_champs'),
    (336, 'chateau_ensable', 'ast_calanques'),
    (82, 'cour_bouftou_royal', 'ast_tainela'),
    (537, 'chateau_wa_wabbit', 'wab_couronne'),
    (538, 'terrier_wa_wabbit', 'wab_waldo'),
    (842, 'cache_kankreblath', 'ast_planque'),
    (201, 'donjon_tofus', 'ama_ingalsse'),
    (516, 'donjon_squelettes', 'ama_cimetiere'),
    (297, 'donjon_scarafeuilles', 'ama_scarafeuilles'),
    (284, 'donjon_bworks', 'ama_bworks'),
    (755, 'nid_kwakwa', 'ama_craqueleurs'),
    (493, 'clos_blops', 'can_lac'),
    (756, 'labo_brumen', 'sid_desolation'),
    (243, 'pitons_craqueleur', 'ama_pitons'),
    (846, 'bateau_chouque', 'moon_crane'),
    (888, 'chapiteau_riktus', 'sid_roulottes'),
    (175, 'domaine_ancestral', 'abr_sombre'),
    (223, 'caverne_koulosse', 'koa_canyon'),
    (213, 'taniere_meulou', 'sid_hurlements'),
    (847, 'arbre_moon', 'moon_jungle'),
    (154, 'antre_dragon_cochon', 'dra_souterrains'),
    (919, 'repaire_kharnozor', 'dra_village'),
    (211, 'biblio_corbac', 'can_bibliotheque'),
    (470, 'goulet_rasboul', 'oto_plaines'),
    (946, 'bambusaie_damadrya', 'pan_plantala'),
    (210, 'labyrinthe_minotoror', 'mino_labyrinthe'),
    (325, 'antre_crocabulia', 'dra_sanctuaire'),
    (617, 'serre_royalmouth', 'fri_champs'),
    (254, 'repaire_skeunk', 'koa_cimetiere'),
    # 4.0 — niveau 200 (parcours complet)
    (780, 'tofulailler_royal', 'ama_ingalsse'),
    (796, 'antre_blop_multicolore', 'can_lac'),
    (839, 'megalithe_fraktale', 'xel_present'),
    (818, 'voliere_haute_truche', 'can_cirque'),
    (830, 'ring_ekarlatte', 'sram_ruelles'),
    (876, 'caverne_el_piko', 'sah_cacterre'),
    (914, 'croquanterie', 'pwak_jardins'),
    (947, 'vallee_dame_eaux', 'pan_akwadala'),
    (948, 'atelier_tanukoui', 'pan_terrdala'),
    (463, 'labo_tynril', 'oto_jungle'),
    (618, 'excavation_mansot', 'fri_lac'),
    (781, 'clairiere_chene_mou', 'abr_sombre'),
    (949, 'fabrique_foux', 'pan_feudala'),
    (950, 'dojo_vent', 'pan_aerdala'),
    (1016, 'tertre_long_sommeil', 'ama_dark_vlad'),
    (339, 'repaire_sphincter', 'ama_cloaque'),
    (619, 'epave_grolandais', 'fri_berceau'),
    (824, 'galerie_phossile', 'enu_carriere'),
    (210, 'salle_minotot', 'mino_labyrinthe', 'Minotot'),
    (459, 'canopee_kimbo', 'oto_hakam'),
    (620, 'hypogee_obsidiantre', 'fri_larmes'),
    (811, 'grotte_kanigroula', 'can_dents'),
    (853, 'plateau_ush', 'eca_lande'),
    (953, 'tombe_tofugawa', 'grobe_cimetiere'),
    (1044, 'poste_supervizoeuf', 'osa_toorbz'),
    (621, 'taniere_givrefoux', 'fri_village'),
    (840, 'horologium_xlii', 'xel_present'),
    (880, 'boyau_pere_ver', 'sah_gorge'),
    (954, 'demeure_esprits', 'grobe_mont'),
    (494, 'temple_ougah', 'sid_fungus'),
    (623, 'antre_korriandre', 'fri_petrifiee'),
    (831, 'cave_toxoliath', 'sram_catacombres'),
    (94, 'grotte_bworker', 'sid_gisgoul'),
    (1028, 'bastion_marteaux', 'val_ereboria'),
    (624, 'cavernes_kolosso', 'fri_crocs'),
    (653, 'mine_sakai', 'sak_plaine'),
    (752, 'antichambre_gloursons', 'fri_torrideau'),
    (814, 'pyramide_ombre', 'obs_dimension'),
    (884, 'camp_razof', 'nimotopia'),
    (790, 'labo_nileza', 'har_jardins'),
    (791, 'transporteur_sylargh', 'har_remparts'),
    (792, 'salons_klime', 'har_tannerie'),
    (793, 'forgefroide_frizz', 'har_bastion'),
    (794, 'donjon_harebourg', 'har_clepsydre'),
    (893, 'belvedere_ilyzaelle', 'har_caserne'),
    (807, 'aquadome_merkator', 'suf_embruns'),
    (825, 'palais_nidas', 'enu_retraite'),
    (832, 'trone_cour_sombre', 'sram_hauts'),
    (841, 'oeil_vortex', 'xel_lendemains'),
    (854, 'defi_chaloeil', 'eca_temple'),
    (882, 'chambre_tal_kasha', 'sah_pyramide'),
]
EXCLUDE_NAMES = ("d'Halouine", 'Ballotin')
EXCLUDE_RACES = {32, 147, 250}  # avis de recherche, poutchs
ARCHI_RACE = 78

STAT = {125: ('vit', 1), 153: ('vit', -1), 124: ('sa', 1), 156: ('sa', -1), 118: ('fo', 1), 157: ('fo', -1),
        126: ('ine', 1), 155: ('ine', -1), 123: ('cha', 1), 152: ('cha', -1), 119: ('age', 1), 154: ('age', -1),
        138: ('pui', 1), 186: ('pui', -1), 112: ('do', 1), 145: ('do', -1), 115: ('cri', 1), 171: ('cri', -1),
        178: ('so', 1), 179: ('so', -1), 176: ('pp', 1), 177: ('pp', -1), 174: ('ini', 1), 175: ('ini', -1),
        111: ('pa', 1), 168: ('pa', -1), 210: ('rt', 1), 215: ('rt', -1), 213: ('rf', 1), 218: ('rf', -1),
        211: ('re', 1), 216: ('re', -1), 212: ('ra', 1), 217: ('ra', -1), 214: ('rn', 1), 219: ('rn', -1),
        418: ('dcri', 1), 419: ('dcri', -1), 422: ('dt', 1), 423: ('dt', -1), 424: ('df', 1), 425: ('df', -1),
        426: ('de', 1), 427: ('de', -1), 428: ('da', 1), 429: ('da', -1), 430: ('dn', 1), 431: ('dn', -1),
        240: ('xt', 1), 245: ('xt', -1), 241: ('xe', 1), 246: ('xe', -1), 242: ('xa', 1), 247: ('xa', -1),
        243: ('xf', 1), 248: ('xf', -1), 244: ('xn', 1), 249: ('xn', -1), 2812: ('dsort', 1), 2813: ('dsort', -1)}
SLOT_BY_TYPE = {1: 'amulette', 9: 'anneau', 10: 'ceinture', 11: 'bottes', 16: 'coiffe', 17: 'cape',
                2: 'arme', 3: 'arme', 4: 'arme', 5: 'arme', 6: 'arme', 7: 'arme', 8: 'arme', 19: 'arme', 271: 'arme', 82: 'bouclier'}
JOB = {11: 'forgeron', 13: 'sculpteur', 15: 'cordonnier', 16: 'bijoutier', 27: 'tailleur', 60: 'faconneur', 65: 'bricoleur'}
GATHER = {  # métier -> [(nom, niveau requis)]
    'paysan': [('Blé', 1), ('Orge', 20), ('Avoine', 40)],
    'bucheron': [('Bois de Frêne', 1), ('Bois de Châtaignier', 20), ('Bois de Noyer', 40)],
    'mineur': [('Fer', 1), ('Cuivre', 20), ('Bronze', 40)],
    'alchimiste': [('Ortie', 1), ('Sauge', 20), ('Trèfle à 5 feuilles', 40)],
    'pecheur': [('Greuvette', 1), ('Truite', 10), ('Crabe Sourimi', 20), ('Poisson-Chaton', 40)],
}
BREEDS = {'feca': 1, 'osa': 2, 'enu': 3, 'sram': 4, 'xelor': 5, 'eca': 6, 'eni': 7, 'iop': 8, 'cra': 9, 'sadi': 10, 'sacri': 11, 'panda': 12, 'roub': 13, 'zobal': 14, 'steam': 15, 'elio': 16, 'hupper': 17, 'ougi': 18, 'forge': 20}
MAX_CRAFT_LVL = 200

# ------------------------------------------------------------------ load
log('Chargement…')
subareas = {s['id']: s for s in load('subareas')}
monsters = {m['id']: m for m in load('monsters')}
items = {i['id']: i for i in load('items')}
recipes = {r['resultId']: r for r in load('recipes')}
isets = {s['id']: s for s in load('item-sets')}
dungeons_raw = load('dungeons')
races = {r['id']: r['name']['fr'] for r in load('monster-races')}
breeds = {b['id']: b for b in load('breeds')}
item_by_name = {}
for i in sorted(items.values(), key=lambda x: x['id']):
    item_by_name.setdefault(i['name']['fr'], i)

def fr(o): return o['name']['fr'] if isinstance(o.get('name'), dict) else str(o.get('name'))

images = {'m': {}, 'i': {}, 's': {}, 'h': {}, 'c': {}, 'j': {}}  # dossier -> {fichier: url}

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
    e = {'name': fr(m), 'dbid': m['id'], 'img': m['gfxId'], 'lvl': [lo, hi], 'el': el_of(r), 'res': r, 'race': m['race'],
         'realHp': round(hpavg), 'drops': drops, 'eq': eq}
    if boss: e['boss'] = True
    if archi_of: e['archiOf'] = archi_of
    images['m'][f"{m['gfxId']}.png"] = m.get('img') or f"https://api.dofusdb.fr/img/monsters/{m['gfxId']}.png"
    return e

def mkey(m): return f"m{m['id']}"

zones_out = []
for z in ZONES:
    subs = []
    for tup in z['subs']:
        sid, gid, deco = tup[:3]
        win = tup[3:] if len(tup) > 3 else None
        s = subareas[sid]
        mons, archis = [], []
        for mid in s['monsters']:
            m = monsters.get(mid)
            if not m or m.get('isQuestMonster') or m['race'] in EXCLUDE_RACES or any(x in fr(m) for x in EXCLUDE_NAMES):
                continue
            if m['race'] == ARCHI_RACE: continue
            if m.get('isBoss'): continue
            if win and not (win[0] <= grade(m, 0)['level'] <= win[1]): continue
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
for tup in DUNGEONS:
    dsub, gid, access = tup[:3]; want = tup[3] if len(tup) > 3 else None
    d = next((x for x in dungeons_raw if x.get('subarea') == dsub and x.get('bosses') and (not want or want in fr(x))), None)
    if not d: log('!! donjon introuvable pour la sous-zone', dsub); continue
    boss = monsters[d['bosses'][0]]
    GAME_M[mkey(boss)] = monster_entry(boss, boss=True)
    pool = []
    for mid in d.get('monsters', []):
        m = monsters.get(mid)
        if not m or mid in d['bosses']: continue
        if grade(m, 0)['level'] > grade(boss, 4)['level'] + 4 or m['race'] == ARCHI_RACE or m.get('isBoss'): continue
        k = mkey(m)
        if k not in GAME_M: GAME_M[k] = monster_entry(m)
        pool.append(k)
    lvl = GAME_M[mkey(boss)]['lvl'][1]
    key = items[d['requiredObjects'][0]['id']]
    keyname = fr(key)
    RES.setdefault(keyname, {'id': key['id'], 'icon': key['iconId'], 'lvl': key['level'], 'price': max(1, key.get('price') or 1), 'type': 84})
    images['i'][f"{key['iconId']}.png"] = key.get('img') or f"https://api.dofusdb.fr/img/items/{key['iconId']}.png"
    nrooms = 3 if lvl <= 20 else 4 if lvl <= 45 else 5 if lvl <= 90 else 6
    if not pool: log('!! donjon sans monstres', fr(d)); continue
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

# ------------------------------------------------------------------ gather (métiers de récolte, depuis les compétences DofusDB)
GJOB = {28: 'paysan', 2: 'bucheron', 24: 'mineur', 26: 'alchimiste', 36: 'pecheur'}
skills = load('skills')
gather_out = {j: [] for j in GJOB.values()}
HARVEST = {}
sub_game = {}
for z in zones_out:
    for s_ in z['subs']: sub_game[s_['dbid']] = s_['id']
seen_res = set()
for sk in sorted(skills, key=lambda x: x.get('levelMin', 0)):
    j = GJOB.get(sk.get('parentJobId')); rid = sk.get('gatheredRessourceItem') or -1
    if not j or rid <= 0 or sk.get('levelMin', 1) > 200: continue
    it = items.get(rid)
    if not it: continue
    n = reg_res(it)
    if (j, n) not in seen_res:
        seen_res.add((j, n)); gather_out[j].append([n, sk.get('levelMin', 1)])
    for sub, cnt in it.get('resourcesBySubarea') or []:
        g = sub_game.get(sub)
        if g: HARVEST.setdefault(g, []).append([n, j, sk.get('levelMin', 1), cnt])
for g in HARVEST: HARVEST[g].sort(key=lambda x: (x[2], x[1]))
log('Récolte :', {j: len(v) for j, v in gather_out.items()}, '| sous-zones avec ressources :', len(HARVEST))
JOBS_ALL = {**GJOB, 11: 'forgeron', 13: 'sculpteur', 15: 'cordonnier', 16: 'bijoutier', 27: 'tailleur', 60: 'faconneur', 65: 'bricoleur'}
for jj in load('jobs'):
    if jj['id'] in JOBS_ALL and jj.get('img'):
        images['j'][f"{JOBS_ALL[jj['id']]}.png"] = jj['img'].replace('.jpg', '.png')
for bid_ in (24049, 24076):
    it = items.get(1920 if bid_ == 24049 else 2308)
    images['i'][f"{bid_}.png"] = f"https://api.dofusdb.fr/img/items/{bid_}.png"

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

# ressources intermédiaires (planches, substrats, alliages, préparations…) fabricables à partir de ressources disponibles
INTER_TYPES = {95, 183, 40, 179, 48, 60, 70, 71}
INTER = {}
for _ in range(5):
    for rid, r in recipes.items():
        it = items.get(rid)
        if not it or it.get('typeId') not in INTER_TYPES or it.get('level', 999) > MAX_CRAFT_LVL: continue
        n = fr(it)
        if n in INTER: continue
        ings = ing_list(r)
        if ings and all(x in available for x, _ in ings):
            INTER[n] = {'it': it, 'ing': ings}; available.add(n)
log(f"Ressources intermédiaires fabricables : {len(INTER)}")
# équipements craftables avec les ressources disponibles
craftable = set(); SIMPLIFIED = {}
for rid, r in recipes.items():
    it = items.get(rid)
    if not it or it['typeId'] not in SLOT_BY_TYPE or it.get('level', 999) > MAX_CRAFT_LVL: continue
    if r.get('jobId') not in JOB: continue
    ings = ing_list(r)
    if ings and all(n in available for n, _ in ings):
        craftable.add(rid)
    elif ings and it.get('level', 1) >= 50:
        # recette simplifiée : jusqu'à 2 ingrédients d'un contenu pas encore présent dans le jeu sont retirés
        miss = [n for n, _ in ings if n not in available]
        if len(miss) <= 2 and len(ings) - len(miss) >= 2:
            craftable.add(rid); SIMPLIFIED[rid] = miss
log(f"Équipements : {len(equip_ids)} lâchés par les monstres, {len(craftable)} craftables avec les ressources du jeu ({len(SIMPLIFIED)} recettes simplifiées)")

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
        r = recipes[iid]; ings = [x for x in ing_list(r) if x[0] not in SIMPLIFIED.get(iid, [])]
        o['craft'] = {'job': JOB[r['jobId']], 'ing': ings}
        if iid in SIMPLIFIED: o['craft']['simpl'] = len(SIMPLIFIED[iid])
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
used_inter = {n for o in ITEMS.values() if o.get('craft') for n, _ in o['craft']['ing'] if n in INTER}
for _ in range(3):
    for n in list(used_inter):
        for x, _q in INTER[n]['ing']:
            if x in INTER: used_inter.add(x)
for n in sorted(used_inter):
    I = INTER[n]; reg_res(I['it'])
    for x, _q in I['ing']:
        if x not in RES and x in item_by_name: reg_res(item_by_name[x])
    SPECIAL[n] = {'job': 'bricoleur', 'lvl': max(1, I['it'].get('level', 1) // 2), 'ing': I['ing'], 'inter': True}
log(f"Intermédiaires utilisés par les recettes : {len(used_inter)}")
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
CLASS_SPELLS_RAW = {}
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
                lv = (sp.get('spellLevels') or [None])[0]
                info = {'id': sp['id'], 'name': sp['name']['fr'], 'icon': ic, 'desc': (sp.get('description') or {}).get('fr', ''), 'order': ids.index(sp['id']), 'lv': lv}
                CLASS_SPELLS_RAW.setdefault(cls, []).append(info)
                images['s'][f"{ic}.png"] = sp.get('img') or f"https://api.dofusdb.fr/img/spells/sort_{ic}.png"
    allv = [x['lv'] for L in CLASS_SPELLS_RAW.values() for x in L if x.get('lv')]
    LV = {}
    for i in range(0, len(allv), 40):
        q = '&'.join(f'id[$in][]={x}' for x in allv[i:i + 40])
        for L in get_json(f'https://api.dofusdb.fr/spell-levels?{q}&$limit=50&lang=fr')['data']:
            LV[L['id']] = L
    for L in CLASS_SPELLS_RAW.values():
        for x in L:
            v = LV.get(x.pop('lv', None))
            if v: x.update({'pa': v.get('apCost'), 'cd': v.get('minCastInterval'), 'casts': v.get('maxCastPerTurn'), 'range': v.get('range')})
    log(f"Sorts de classe : {len(SPELL_IMG)} icônes, {len(LV)} niveaux")
HEADS = {}
for cls, bid in BREEDS.items():
    b = breeds[bid]
    for g, url in (b.get('heads') or {}).items():
        fn = f"{cls}_{g[0]}.png"; images['h'][fn] = url
    HEADS[cls] = {'m': f"{cls}_m.png", 'f': f"{cls}_f.png"}
    images['h'][f"{cls}_logo.png"] = b.get('imgTransparent')
    images['h'][f"{cls}_sym.png"] = b.get('img')
RACES = {str(m['race']): races.get(m['race'], '') for m in GAME_M.values()}
STAT_ICONS = {'vit': 'tx_vitality', 'sa': 'tx_wisdom', 'fo': 'tx_strength', 'ine': 'tx_intelligence', 'cha': 'tx_chance', 'age': 'tx_agility',
              'pui': 'tx_damagesPercent', 'do': 'tx_damage', 'cri': 'tx_crit', 'so': 'tx_heal', 'pp': 'tx_prospecting', 'ini': 'tx_initiative',
              'pa': 'tx_actionPoints', 'rt': 'tx_strengthRes', 'rf': 'tx_intelligenceRes', 're': 'tx_chanceRes', 'ra': 'tx_agilityRes', 'rn': 'tx_neutralRes', 'pm': 'tx_movementPoints'}
images['c'] = {f"{k}.png": f"https://dofusdb.fr/icons/characteristics/{v}.png" for k, v in STAT_ICONS.items()}

# ------------------------------------------------------------------ v3 : sorts (classes + monstres)
RAW3 = os.path.join(ROOT, 'data', 'raw3')
EL_DMG = {96: 'e', 97: 't', 98: 'a', 99: 'f', 100: 'n'}
EL_VOL = {91: 'e', 92: 't', 93: 'a', 94: 'f', 95: 'n'}
EL_PCT = {85: 'e', 86: 't', 87: 'a', 88: 'f', 89: 'n', 1068: 'e', 1070: 't', 1067: 'a', 1069: 'f', 1071: 'n', 275: 'e', 276: 't', 277: 'a', 278: 'f', 279: 'n'}
HEALS = {108: 'f', 2998: 'e', 3000: 't', 2999: 'a'}
BUFF_STAT = {138: 'pui', 112: 'do', 115: 'cri', 118: 'fo', 126: 'ine', 123: 'cha', 119: 'age', 178: 'so', 418: 'dcri'}
SUMMON = {181, 1011, 1008, 405}
def ntargets(z):
    if not z: return 1
    sh, p1 = z.get('shape', 80), z.get('param1', 0)
    if sh in (65, 97): return 9
    if sh == 80 or not p1: return 1
    return 2 if p1 == 1 else 3 if p1 == 2 else 9
def dice(e):
    a, b = e.get('diceNum') or 0, e.get('diceSide') or 0
    if not b: b = a
    if a > b: a, b = b, a
    return a, b
def convert_fx(effects, desc=''):
    fx = []
    for e in effects or []:
        aid = e.get('effectId'); a, b = dice(e); dur = e.get('duration') or 0; m = e.get('targetMask') or ''
        n = ntargets(e.get('zoneDescr')); selfish = ('C' in m and 'a' not in m and 'g' not in m)
        if aid in EL_DMG and b > 0:
            fx.append({'k': 'dot' if dur > 0 else 'dmg', 'el': EL_DMG[aid], 'min': a, 'max': b, 'n': n, **({'t': min(dur, 4)} if dur > 0 else {})})
        elif aid in EL_VOL and b > 0: fx.append({'k': 'drain', 'el': EL_VOL[aid], 'min': a, 'max': b, 'n': n})
        elif aid == 2822 and b > 0: fx.append({'k': 'dmg', 'el': 'best', 'min': a, 'max': b, 'n': n})
        elif aid in EL_PCT and b > 0: fx.append({'k': 'dmg', 'el': EL_PCT[aid], 'min': max(1, a), 'max': max(2, b), 'n': n, 'pct': 1})
        elif aid in HEALS and b > 0: fx.append({'k': 'heal', 'min': a, 'max': b, 'n': n if not selfish else 1, 'self': selfish})
        elif aid == 1109 and b > 0: fx.append({'k': 'healpct', 'v': b, 'n': n if not selfish else 1, 'self': selfish})
        elif aid in (1020, 1039) and b > 0: fx.append({'k': 'shield', 'pct': min(40, b if aid == 1039 else max(5, b // 10)), 'all': 'a' in m or 'g' in m or n > 1, 't': max(1, min(dur or 2, 3))})
        elif aid in BUFF_STAT and b > 0: fx.append({'k': 'buff', 'st': BUFF_STAT[aid], 'v': b, 't': max(1, min(dur or 2, 4)), 'all': ('a' in m or 'g' in m) and not selfish})
        elif aid in (1079, 101, 168) and b > 0 and 'A' in m: fx.append({'k': 'apdrain', 'v': min(3, b), 'n': n})
        elif aid in (1080, 169, 127) and b > 0 and 'A' in m: fx.append({'k': 'weaken', 'v': min(30, 8 * b), 't': max(1, min(dur or 1, 3)), 'n': n})
        elif aid == 1163 and 'A' in m: fx.append({'k': 'vuln', 'v': max(5, min(30, abs((a or b) - 100) or 10)), 't': max(1, min(dur or 2, 3)), 'n': n})
        elif aid == 776 and b > 0 and 'A' in m: fx.append({'k': 'vuln', 'v': min(15, b), 't': max(1, min(dur or 2, 3)), 'n': n})
        elif aid in SUMMON: fx.append({'k': 'summon', 'mid': e.get('diceNum') or e.get('value') or 0})
        elif aid == 111 and b > 0 and selfish: fx.append({'k': 'buff', 'st': 'pa', 'v': min(2, b), 't': 1, 'all': False})
        elif aid in (786, 2973): fx.append({'k': 'leech', 'v': b or a or 20})
    # fusionne les dégâts identiques (mêmes élément/cibles)
    out = []
    for f in fx:
        if out and f['k'] in ('dmg', 'drain') and out[-1]['k'] == f['k'] and out[-1]['el'] == f['el'] and out[-1]['n'] == f['n']:
            out[-1]['min'] += f['min']; out[-1]['max'] += f['max']; continue
        out.append(f)
    if not any(f['k'] in ('dmg', 'drain', 'dot', 'heal', 'healpct', 'shield', 'buff', 'summon') for f in out):
        d = desc.lower()
        el = next((v for k, v in (('terre', 't'), ('feu', 'f'), ('eau', 'e'), ('air', 'a'), ('neutre', 'n')) if 'dommages ' + k in d or 'dégâts ' + k in d), None)
        if el: out.append({'k': 'dot' if ('piège' in d or 'glyphe' in d or 'bombe' in d) else 'dmg', 'el': el, 'min': 8, 'max': 12, 'n': 3 if ('zone' in d or 'glyphe' in d) else 1, 'fb': 1, **({'t': 2} if ('piège' in d or 'glyphe' in d or 'bombe' in d) else {})})
        elif 'soign' in d or 'soin' in d: out.append({'k': 'heal', 'min': 8, 'max': 12, 'n': 1, 'fb': 1})
        elif 'invoque' in d: out.append({'k': 'summon', 'mid': 0})
        else: out.append({'k': 'buff', 'st': 'pui', 'v': 20, 't': 2, 'all': False, 'fb': 1})
    return out
CLASS_KITS = {}
CS_PATH = os.path.join(RAW3, 'class_spells.json')
if os.path.exists(CS_PATH):
    cs = json.load(open(CS_PATH, encoding='utf-8'))
else:  # pas d'import brut des sorts de classe (ex. GitHub Actions) : on garde les kits déjà dans le jeu
    log('class_spells.json absent : kits de classe et invocations repris de js/gamedata.js')
    _src = open(os.path.join(ROOT, 'js', 'gamedata.js'), encoding='utf-8').read()
    _old = json.loads(_src[_src.index('const GAMEDATA = ') + 17:_src.index(';\n  root.GAMEDATA')])
    cs = {'levels': [], 'spells': [], 'variants': []}
    for _k, _v in _old['SPELL_IMG'].items(): SPELL_IMG.setdefault(_k, _v)
CL = {l['id']: l for l in cs['levels']}; CS = {x['id']: x for x in cs['spells']}
def spell_out(sp):
    grades = []
    for lid in sp.get('spellLevels', []):
        L = CL.get(lid)
        if not L: continue
        grades.append({'lvl': max(1, L.get('minPlayerLevel') or 1), 'pa': L.get('apCost') or 3, 'cd': L.get('minCastInterval') or 0,
                       'casts': L.get('maxCastPerTurn') or 0, 'fx': convert_fx(L.get('effects'), (sp.get('description') or {}).get('fr', ''))})
    grades.sort(key=lambda g: g['lvl'])
    ic = sp.get('iconId'); images['s'][f"{ic}.png"] = sp.get('img') or f"https://api.dofusdb.fr/img/spells/sort_{ic}.png"
    SPELL_IMG[sp['name']['fr']] = ic
    return {'id': sp['id'], 'name': sp['name']['fr'], 'icon': ic, 'desc': (sp.get('description') or {}).get('fr', ''), 'grades': grades}
for cls, bid in BREEDS.items():
    pairs = []
    for v in sorted([v for v in cs['variants'] if v['breedId'] == bid], key=lambda v: v['id']):
        sps = [CS[i] for i in v['spellIds'] if i in CS]
        if len(sps) < 1: continue
        outs = [spell_out(x) for x in sps]
        outs.sort(key=lambda o: (o['grades'][0]['lvl'] if o['grades'] else 999))
        pairs.append(outs)
    pairs.sort(key=lambda p: p[0]['grades'][0]['lvl'] if p[0]['grades'] else 999)
    CLASS_KITS[cls] = pairs
if not cs['variants']: CLASS_KITS = _old['CLASS_KITS']
log('Kits de classe :', {c: len(p) for c, p in CLASS_KITS.items()})
SUMMONS = {}
for pairs in CLASS_KITS.values():
    for pr in pairs:
        for sp in pr:
            for g in sp['grades']:
                for f in g['fx']:
                    if f['k'] == 'summon' and f.get('mid') in monsters:
                        mm = monsters[f['mid']]; SUMMONS[str(f['mid'])] = {'name': fr(mm), 'img': mm['gfxId']}
                        images['m'][f"{mm['gfxId']}.png"] = mm.get('img') or f"https://api.dofusdb.fr/img/monsters/{mm['gfxId']}.png"
if not cs['variants']: SUMMONS = _old['SUMMONS']
log('Invocations :', len(SUMMONS))
# sorts de monstres
msp_path = os.path.join(RAW3, 'monster_spells.json')
mids = sorted({m['dbid'] for m in GAME_M.values()})
cache = json.load(open(msp_path, encoding='utf-8')) if os.path.exists(msp_path) else {'spells': [], 'levels': [], 'mids': []}
need = [i for i in mids if i not in set(cache.get('mids', []))]
if need and FETCH_IMAGES:
    want = {s for i in need for s in (monsters[i].get('spells') or [])}
    have = {x['id'] for x in cache['spells']}
    ids = sorted(want - have); new_sp = []
    for i in range(0, len(ids), 40):
        q = '&'.join(f'id[$in][]={x}' for x in ids[i:i + 40]); new_sp += get_json(f'https://api.dofusdb.fr/spells?{q}&$limit=50&lang=fr')['data']
    lids = sorted({l for x in new_sp for l in x.get('spellLevels', [])}); new_lv = []
    for i in range(0, len(lids), 40):
        q = '&'.join(f'id[$in][]={x}' for x in lids[i:i + 40]); new_lv += get_json(f'https://api.dofusdb.fr/spell-levels?{q}&$limit=50&lang=fr')['data']
    cache['spells'] += new_sp; cache['levels'] += new_lv; cache['mids'] = sorted(set(cache.get('mids', [])) | set(need))
    os.makedirs(RAW3, exist_ok=True)
    json.dump(cache, open(msp_path, 'w', encoding='utf-8'), ensure_ascii=False)
MS = {x['id']: x for x in cache['spells']}; ML = {l['id']: l for l in cache['levels']}
nsp = 0
for k, gm in GAME_M.items():
    m = monsters[gm['dbid']]; lst = []
    for idx, sid in enumerate(m.get('spells') or []):
        sp = MS.get(sid)
        if not sp or not sp.get('spellLevels'): continue
        try: g = int((m.get('spellGrades') or [])[idx].split(';')[-1].split(',')[0])
        except Exception: g = len(sp['spellLevels'])
        L = ML.get(sp['spellLevels'][min(len(sp['spellLevels']), max(1, g)) - 1])
        if not L: continue
        fx = [f for f in convert_fx(L.get('effects'), (sp.get('description') or {}).get('fr', '')) if not f.get('fb') and f['k'] != 'summon']
        if not fx: continue
        lst.append({'n': sp['name']['fr'], 'cd': min(4, L.get('minCastInterval') or 0), 'fx': fx})
    if lst: gm['sp'] = lst[:3]; nsp += 1
log(f"Monstres avec sorts : {nsp}/{len(GAME_M)}")

# ------------------------------------------------------------------ write
os.makedirs(os.path.join(OUT, 'js'), exist_ok=True)
GD = {'MONSTERS': GAME_M, 'ZONES': zones_out, 'DUNGEONS': dg_out, 'ITEMS': ITEMS, 'SETS': SETS, 'SPECIAL_CRAFTS': SPECIAL,
      'GATHER_JOBS': gather_out, 'HARVEST': HARVEST, 'CLASS_KITS': CLASS_KITS, 'SUMMONS': SUMMONS, 'RES': RES, 'SPELL_IMG': SPELL_IMG, 'HEADS': HEADS, 'RACES': RACES,
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
json.dump(CLASS_SPELLS_RAW, open(os.path.join(OUT, 'class_spells_raw.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
