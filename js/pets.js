/* ============================================================================
   FAMILIERS ET MONTILIERS (0.1.8) — Idlus
   Un familier se porte dès le niveau 10 ; il grandit en mangeant les ressources du sac
   (un repas toutes les 30 min, même hors ligne ; sa nourriture préférée compte double ;
   aucune pénalité s'il a faim). Un montilier prend à la fois la place du familier et
   celle de la monture, dès le niveau 60.
   Obtention : familier de zone 1 chance sur 2 000 par victoire dans sa sous-zone ;
   familier rare de boss 1 sur 25 en stasis 7+ ; montilier 1 sur 25 en stasis 6+, garanti
   à la 60e victoire ; montilier légendaire (+1 PA) 1 sur 250 en stasis 8+, un peu plus
   à chaque échec. Un double nourrit le familier déjà possédé (+20 % de croissance).
   Noms et icônes : familiers officiels DOFUS (DofusDB) — contenu © Ankama Games.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const { RES, DUNGEONS } = D;
  const rnd = () => E.rnd();

  /* kind : zone (sous-zone sub), boss (donjon dg, stasis 7+), monti (montilier, famille e/t/c/l) */
  const PETS = {
    "chienchien": {"name":"Chienchien","icon":18006,"stats":{"sa":15},"kind":"zone","sub":"inc_route","lvl":1,"food":"Cendres Éternelles"},
    "gelutin": {"name":"Gelutin","icon":18055,"stats":{"vit":60},"kind":"zone","sub":"inc_champs","lvl":1,"food":"Blé"},
    "chacha": {"name":"Chacha","icon":18001,"stats":{"pui":15},"kind":"zone","sub":"inc_lac","lvl":2,"food":"Eau Potable"},
    "meuch": {"name":"Meuch","icon":18059,"stats":{"so":5},"kind":"zone","sub":"inc_paturages","lvl":3,"food":"Bave de Bouftou"},
    "tofoudre": {"name":"Tofoudre","icon":18060,"stats":{"age":30},"kind":"zone","sub":"inc_foret","lvl":4,"food":"Bois de Frêne"},
    "wabbit": {"name":"Wabbit","icon":18007,"stats":{"pui":15},"kind":"zone","sub":"inc_mine","lvl":5,"food":"Fer"},
    "pykur": {"name":"Pykur","icon":18061,"stats":{"pp":15},"kind":"zone","sub":"inc_cimetiere","lvl":5,"food":"Os de Chafer"},
    "bwak_de_feu": {"name":"Bwak de Feu","icon":18003,"stats":{"pui":15,"rf":2},"kind":"zone","sub":"ast_cite","lvl":11,"food":"Graine de Sésame"},
    "tifoux_tigre": {"name":"Tifoux Tigré","icon":18063,"stats":{"pp":15},"kind":"zone","sub":"ast_souterrains","lvl":11,"food":"Peau Égrotante"},
    "bwak_d_eau": {"name":"Bwak d'Eau","icon":18002,"stats":{"pui":15,"re":2},"kind":"zone","sub":"ast_champs","lvl":16,"food":"Viande Faisandée"},
    "bwak_d_air": {"name":"Bwak d'Air","icon":18004,"stats":{"pui":15,"ra":2},"kind":"zone","sub":"ama_campagne","lvl":16,"food":"Viande Faisandée"},
    "vilain_petit_corbac": {"name":"Vilain Petit Corbac","icon":18018,"stats":{"pp":15},"kind":"zone","sub":"ama_foret","lvl":16,"food":"Pollenectar"},
    "chauffe_souris_delavee": {"name":"Chauffe-souris Délavée","icon":18066,"stats":{"dcri":5},"kind":"zone","sub":"ast_prairies","lvl":16,"food":"Fil de Soie"},
    "gupin": {"name":"Gupin","icon":18067,"stats":{"vit":60,"rn":2},"kind":"zone","sub":"ast_calanques","lvl":16,"food":"Écaille poisseuse"},
    "bwak_de_terre": {"name":"Bwak de Terre","icon":18005,"stats":{"pui":25,"rt":2},"kind":"zone","sub":"ast_foret","lvl":22,"food":"Pollenectar"},
    "kouin_kouin": {"name":"Kouin-Kouin","icon":18008,"stats":{"pp":25,"ini":125},"kind":"zone","sub":"ama_bouftous","lvl":22,"food":"Sang de Bouftou"},
    "cromeugnon": {"name":"Cromeugnon","icon":18068,"stats":{"fo":50,"ine":25},"kind":"zone","sub":"ast_carrieres","lvl":22,"food":"Pierre de Granit"},
    "gwo_tofu_ventripotent": {"name":"Gwo Tofu Ventripotent","icon":18072,"stats":{"pui":25},"kind":"zone","sub":"ast_egouts","lvl":22,"food":"Viande Frelatée"},
    "bulbisou": {"name":"Bulbisou","icon":18074,"stats":{"fo":50,"dt":4},"kind":"zone","sub":"ama_boos","lvl":22,"food":"Viande Frelatée"},
    "nomoon": {"name":"Nomoon","icon":18011,"stats":{"pp":25},"kind":"zone","sub":"ama_cimetiere","lvl":25,"food":"Viande Minérale"},
    "chienchien_noir": {"name":"Chienchien Noir","icon":18010,"stats":{"vit":100},"kind":"zone","sub":"ama_gobelins","lvl":32,"food":"Canine de Gobelin"},
    "blerodoudou": {"name":"Blérodoudou","icon":18075,"stats":{"age":50,"da":4},"kind":"zone","sub":"ast_cimetiere","lvl":32,"food":"Viande Minérale"},
    "bisouglours": {"name":"Bisouglours","icon":18076,"stats":{"ine":50,"df":4},"kind":"zone","sub":"ama_ingalsse","lvl":32,"food":"Pollenectar"},
    "platypus": {"name":"Platypus","icon":18077,"stats":{"vit":100},"kind":"zone","sub":"ama_bworks","lvl":32,"food":"Pollenectar"},
    "serpete": {"name":"Serpète","icon":18079,"stats":{"pui":25,"xn":4},"kind":"zone","sub":"ama_scarafeuilles","lvl":34,"food":"Viscères de Scarafeuille"},
    "chacha_blanc": {"name":"Chacha Blanc","icon":18009,"stats":{"vit":100},"kind":"zone","sub":"ama_foret_malefique","lvl":35,"food":"Champignon Luidegît"},
    "tofum": {"name":"Tofüm","icon":18078,"stats":{"vit":100,"dcri":4},"kind":"zone","sub":"can_baie","lvl":35,"food":"Miroir de Dopeul"},
    "peki": {"name":"Péki","icon":18012,"stats":{"vit":100},"kind":"zone","sub":"can_porkass","lvl":40,"food":"Viande Tendre"},
    "sourisette": {"name":"Sourisette","icon":18082,"stats":{"ini":250},"kind":"zone","sub":"ama_craqueleurs","lvl":42,"food":"Viande Tendre"},
    "scarakiri": {"name":"Scarakiri","icon":18083,"stats":{"ine":70},"kind":"zone","sub":"can_champs","lvl":51,"food":"Viande Ladre"},
    "petit_chacha_blanc": {"name":"Petit Chacha Blanc","icon":18009,"stats":{"ini":350},"kind":"zone","sub":"ama_cloaque","lvl":52,"food":"Viande Ladre"},
    "rauleur": {"name":"Rauleur","icon":18084,"stats":{"pui":35},"kind":"zone","sub":"can_lac","lvl":52,"food":"Viande Ladre"},
    "ploup": {"name":"Ploup","icon":18086,"stats":{"so":12},"kind":"zone","sub":"can_massif","lvl":52,"food":"Viande Ladre"},
    "petit_chienchien_noir": {"name":"Petit Chienchien Noir","icon":18010,"stats":{"pui":35},"kind":"zone","sub":"ama_gelees","lvl":54,"food":"Jus Concentré de Gelée"},
    "kafarce": {"name":"Kafarce","icon":18090,"stats":{"cri":5},"kind":"zone","sub":"ama_pitons","lvl":59,"food":"Viande Avariée"},
    "kokulte": {"name":"Kokulte","icon":18091,"stats":{"cri":5,"dcri":6},"kind":"zone","sub":"can_plaines","lvl":59,"food":"Viande Avariée"},
    "fotome": {"name":"Fotome","icon":18013,"stats":{"vit":140},"kind":"zone","sub":"koa_kaliptus","lvl":60,"food":"Pollenectar"},
    "koalak_sanguin": {"name":"Koalak Sanguin","icon":18030,"stats":{"pui":35},"kind":"zone","sub":"koa_lacs","lvl":60,"food":"Pollenectar"},
    "toukancre": {"name":"Toukancre","icon":18092,"stats":{"pui":35,"xt":6},"kind":"zone","sub":"sid_desolation","lvl":62,"food":"Viande Avariée"},
    "croum": {"name":"Croum","icon":18015,"stats":{"pui":35,"rn":3},"kind":"zone","sub":"koa_bordure","lvl":68,"food":"Pollenectar"},
    "boskito": {"name":"Boskito","icon":18093,"stats":{"pui":35},"kind":"zone","sub":"koa_canyon","lvl":70,"food":"Pollenectar"},
    "minimino": {"name":"Minimino","icon":18021,"stats":{"pui":35},"kind":"zone","sub":"abr_oree","lvl":74,"food":"Viande Rassie"},
    "abra_kadabra": {"name":"Abra Kadabra","icon":18034,"stats":{"pui":35},"kind":"zone","sub":"abr_sombre","lvl":74,"food":"Viande Rassie"},
    "black_tiwabbit": {"name":"Black Tiwabbit","icon":18096,"stats":{"fo":70},"kind":"zone","sub":"koa_pentes","lvl":76,"food":"Viande Exsudative"},
    "chacha_tigre": {"name":"Chacha Tigré","icon":18041,"stats":{"pui":35},"kind":"zone","sub":"can_pics","lvl":82,"food":"Viande Rassie"},
    "ecureuil_chenapan": {"name":"Écureuil Chenapan","icon":18016,"stats":{"pui":35},"kind":"zone","sub":"fri_bourgade","lvl":82,"food":"Le rube"},
    "chacha_des_glaces": {"name":"Chacha des Glaces","icon":18062,"stats":{"cri":5},"kind":"zone","sub":"fri_port","lvl":82,"food":"Le rube"},
    "mekrabe": {"name":"Mékrabe","icon":18087,"stats":{"fo":70,"age":35},"kind":"zone","sub":"moon_crane","lvl":82,"food":"Crâne de pirate"},
    "snouffle": {"name":"Snouffle","icon":18098,"stats":{"pp":35},"kind":"zone","sub":"sid_roulottes","lvl":82,"food":"Viande Rassie"},
    "leopardo": {"name":"Léopardo","icon":18027,"stats":{"pui":45},"kind":"zone","sub":"dra_village","lvl":92,"food":"Viande Exsudative"},
    "bilby": {"name":"Bilby","icon":18043,"stats":{"so":15},"kind":"zone","sub":"oto_tourbiere2","lvl":92,"food":"Viande Séchée"},
    "crocodaille": {"name":"Crocodaille","icon":18047,"stats":{"pui":45,"xf":8},"kind":"zone","sub":"oto_tourbiere","lvl":92,"food":"Viande Séchée"},
    "homlett": {"name":"Homlett","icon":18099,"stats":{"vit":180},"kind":"zone","sub":"sid_hurlements","lvl":92,"food":"Viande Exsudative"},
    "eliome": {"name":"Eliôme","icon":18105,"stats":{"vit":180,"rf":3},"kind":"zone","sub":"moon_jungle","lvl":92,"food":"Viande Exsudative"},
    "bloalak": {"name":"Bloalak","icon":18107,"stats":{"pp":45},"kind":"zone","sub":"dra_souterrains","lvl":92,"food":"Viande Exsudative"},
    "krolimea": {"name":"Kroliméa","icon":18088,"stats":{"pui":45},"kind":"zone","sub":"oto_plaines","lvl":93,"food":"Viande Séchée"},
    "marcassin": {"name":"Marcassin","icon":18020,"stats":{"pui":45},"kind":"zone","sub":"koa_cimetiere","lvl":101,"food":"Viande Saignante"},
    "moumoute": {"name":"Moumoute","icon":18108,"stats":{"vit":180},"kind":"zone","sub":"koa_morhkitu","lvl":101,"food":"Viande Saignante"},
    "pioute_bleu": {"name":"Pioute bleu","icon":18019,"stats":{"cha":90,"dcri":8},"kind":"zone","sub":"mino_ile","lvl":102,"food":"Viande Saignante"},
    "bebe_pandawa": {"name":"Bébé Pandawa","icon":18042,"stats":{"fo":90,"cha":45},"kind":"zone","sub":"pan_plantala","lvl":102,"food":"Viande Séchée"},
    "bontique": {"name":"Bontique","icon":18109,"stats":{"vit":180},"kind":"zone","sub":"can_penates","lvl":102,"food":"Pierre de Topaze"},
    "brakarien": {"name":"Brâkarien","icon":18110,"stats":{"vit":180},"kind":"zone","sub":"can_bibliotheque","lvl":102,"food":"Pierre de Topaze"},
    "miniminotot": {"name":"Miniminotot","icon":18049,"stats":{"pui":45,"xe":8},"kind":"zone","sub":"mino_labyrinthe","lvl":108,"food":"Viande Saignante"},
    "pioute_jaune": {"name":"Pioute jaune","icon":18023,"stats":{"age":90,"dcri":8},"kind":"zone","sub":"can_cirque","lvl":110,"food":"Morceau de Truche"},
    "medugivre": {"name":"Médugivre","icon":18069,"stats":{"so":15},"kind":"zone","sub":"fri_champs","lvl":112,"food":"Dent de sagesse de Boufmouth"},
    "titard": {"name":"Titard","icon":18113,"stats":{"vit":180,"rt":3},"kind":"zone","sub":"dra_sanctuaire","lvl":112,"food":"Viande Saignante"},
    "pioute_rose": {"name":"Pioute rose","icon":18024,"stats":{"pui":45},"kind":"zone","sub":"oto_zoths","lvl":114,"food":"Viande Persillée"},
    "chaperlipopette": {"name":"Chaperlipopette","icon":18115,"stats":{"cri":6,"ini":225},"kind":"zone","sub":"oto_canopee","lvl":114,"food":"Viande Persillée"},
    "pioute_rouge": {"name":"Pioute rouge","icon":18025,"stats":{"ine":90,"dcri":8},"kind":"zone","sub":"pan_terrdala","lvl":122,"food":"Viscères de Tanuki"},
    "pioute_vert": {"name":"Pioute vert","icon":18026,"stats":{"fo":90,"dcri":8},"kind":"zone","sub":"sram_ruelles","lvl":122,"food":"Viande Persillée"},
    "glub": {"name":"Glub","icon":18118,"stats":{"pp":45},"kind":"zone","sub":"pan_akwadala","lvl":122,"food":"Viande Persillée"},
    "titcham": {"name":"Titcham","icon":18117,"stats":{"vit":180},"kind":"zone","sub":"sah_cacterre","lvl":122,"food":"Viande Persillée"},
    "dauge": {"name":"Dauge","icon":18120,"stats":{"vit":180,"re":3},"kind":"zone","sub":"pwak_jardins","lvl":122,"food":"Viande Persillée"},
    "la_chose": {"name":"La Chose","icon":18139,"stats":{"vit":180,"ra":3},"kind":"zone","sub":"oto_jungle","lvl":125,"food":"Viande Macérée"},
    "pioute_violet": {"name":"Pioute violet","icon":18022,"stats":{"pui":55},"kind":"zone","sub":"pan_aerdala","lvl":132,"food":"Viande Macérée"},
    "ecumouth": {"name":"Écumouth","icon":18070,"stats":{"cha":110},"kind":"zone","sub":"fri_pins","lvl":132,"food":"Viscères congelés"},
    "givrefoux": {"name":"Givrefoux","icon":18071,"stats":{"ini":550},"kind":"zone","sub":"fri_lac","lvl":132,"food":"Pied de Mansot"},
    "molosk": {"name":"Molosk","icon":18147,"stats":{"vit":220,"dcri":9},"kind":"zone","sub":"pan_feudala","lvl":132,"food":"Totem Firefoux"},
    "booftrool_blanc": {"name":"Booftrool blanc","icon":18308,"stats":{"pui":55,"cri":4},"kind":"zone","sub":"can_landes","lvl":137,"food":"Pierre d'Aigue-Marine"},
    "atouin": {"name":"Atouin","icon":18017,"stats":{"so":18},"kind":"zone","sub":"ama_dark_vlad","lvl":142,"food":"Viande de Brousse"},
    "mini_wa": {"name":"Mini Wa","icon":18028,"stats":{"cha":110,"age":55},"kind":"zone","sub":"fri_berceau","lvl":142,"food":"Crâne éthéré"},
    "willy_le_relou": {"name":"Willy le Relou","icon":18029,"stats":{"ine":110,"age":55},"kind":"zone","sub":"can_kanigs","lvl":150,"food":"Poils pubiens de Kanig"},
    "kanigloups": {"name":"Kanigloups","icon":18073,"stats":{"cha":110,"de":9},"kind":"zone","sub":"fri_larmes","lvl":152,"food":"Larme au Rikain"},
    "bouloute": {"name":"Bouloute","icon":18035,"stats":{"vit":220},"kind":"zone","sub":"fri_village","lvl":162,"food":"Givranchy"},
    "tifoux": {"name":"Tifoux","icon":18037,"stats":{"pp":55},"kind":"zone","sub":"xel_present","lvl":162,"food":"Eau  Putride"},
    "tofu_givre": {"name":"Tofu Givré","icon":18081,"stats":{"ini":550},"kind":"zone","sub":"fri_crevasse","lvl":162,"food":"Givranchy"},
    "walk": {"name":"Walk","icon":18038,"stats":{"ine":110,"cha":55},"kind":"zone","sub":"sid_gisgoul","lvl":172,"food":"Viande Gâtée"},
    "ross": {"name":"Ross","icon":18044,"stats":{"so":18},"kind":"zone","sub":"sram_catacombres","lvl":172,"food":"Jus Toxique de Nécrotique"},
    "bouloute_du_parrain": {"name":"Bouloute du Parrain","icon":18046,"stats":{"vit":220},"kind":"zone","sub":"sak_plaine","lvl":182,"food":"Viande Noire"},
    "chacha_angora": {"name":"Chacha Angora","icon":18050,"stats":{"pui":55,"dcri":9},"kind":"zone","sub":"nimotopia","lvl":182,"food":"Viande Noire"},
    "tiwabbit_kiafin": {"name":"Tiwabbit Kiafin","icon":18051,"stats":{"pui":55,"xa":9},"kind":"zone","sub":"sram_hauts","lvl":200,"food":"Viande Goûtue"},
    "dragoune_noire": {"name":"Dragoune Noire","icon":18048,"stats":{"pui":55},"kind":"zone","sub":"har_remparts","lvl":200,"food":"Planche renforcée"},
    "vampyrette": {"name":"Vampyrette","icon":18053,"stats":{"vit":220},"kind":"zone","sub":"har_caserne","lvl":200,"food":"Viande Goûtue"},
    "el_scarador": {"name":"El Scarador","icon":18036,"stats":{"pui":35,"rn":3},"kind":"boss","dg":"domaine_ancestral","lvl":90,"stasis":7},
    "feanor": {"name":"Fëanor","icon":18045,"stats":{"pui":45,"pa":1},"kind":"boss","dg":"repaire_skeunk","lvl":120,"stasis":7},
    "shushu_de_rushu": {"name":"Shushu de Rushu","icon":18052,"stats":{"ini":550},"kind":"boss","dg":"excavation_mansot","lvl":140,"stasis":7},
    "chienchien_tigre": {"name":"Chienchien Tigré","icon":18064,"stats":{"pa":1},"kind":"boss","dg":"plateau_ush","lvl":160,"stasis":7},
    "tanuk": {"name":"Tanuk","icon":18111,"stats":{"pa":1},"kind":"boss","dg":"bastion_marteaux","lvl":190,"stasis":7},
    "microsmoglob": {"name":"Microsmoglob","icon":18331,"stats":{"cri":7,"pa":1},"kind":"boss","dg":"aquadome_merkator","lvl":200,"stasis":7},
    "blokus": {"name":"Blokus","icon":18104,"stats":{"tac":15,"rpm":8},"kind":"zone","sub":"ast_tainela","lvl":22,"food":"Sang de Bouftou"},
    "drakopin": {"name":"Drakopin","icon":18106,"stats":{"tac":30,"rpa":15},"kind":"zone","sub":"fri_crocs","lvl":182,"food":"Objet bizarre"},
    "dragoune_rose": {"name":"Dragoune Rose","icon":18014,"stats":{"fui":30,"rpa":15},"kind":"zone","sub":"har_bastion","lvl":200,"food":"Frosplasme"},
    "kouin_kouin_noir": {"name":"Kouin-Kouin Noir","icon":18065,"stats":{"fui":30,"rpa":15},"kind":"zone","sub":"osa_toorbz","lvl":162,"food":"Viande Maigre"},
    "chachyene": {"name":"Chachyène","icon":18094,"stats":{"pm":1,"inv":1},"kind":"zone","sub":"xel_lendemains","lvl":200,"food":"Viande Goûtue"},
    "phortiche": {"name":"Phortiche","icon":18097,"stats":{"pm":1},"kind":"zone","sub":"grobe_cimetiere","lvl":152,"food":"Viande Fraîche"},
    "raknaille": {"name":"Raknaille","icon":18058,"stats":{"epa":30},"kind":"zone","sub":"obs_dimension","lvl":182,"food":"Viande Noire"},
    "meulourd": {"name":"Meulourd","icon":18085,"stats":{"epm":30},"kind":"zone","sub":"enu_carriere","lvl":142,"food":"Pépite aurifère"},
    "dragoune_doree": {"name":"Dragoune Dorée","icon":18057,"stats":{"epa":30},"kind":"zone","sub":"fri_ruche","lvl":182,"food":"Cuillère"},
    "minikrone": {"name":"Minikrone","icon":18114,"stats":{"inv":1,"epm":15},"kind":"zone","sub":"suf_embruns","lvl":200,"food":"Pile Steamer"},
    "zarbichon": {"name":"Zarbichon","icon":18330,"stats":{"inv":1},"kind":"zone","sub":"sid_fungus","lvl":172,"food":"Viande Gâtée"},
    "bworky": {"name":"Bworky","icon":18031,"stats":{"pod":300},"kind":"zone","sub":"har_jardins","lvl":200,"food":"Cendres élémentaires"},
    "chauffe_souris": {"name":"Chauffe-souris","icon":18054,"stats":{"pod":300},"kind":"zone","sub":"sah_gorge","lvl":162,"food":"Viande Maigre"},
    "bulbouture": {"name":"Bulbouture","icon":18089,"stats":{"pod":300},"kind":"zone","sub":"sah_pyramide","lvl":200,"food":"Viande Goûtue"},
    "fosfo": {"name":"Fosfo","icon":164020,"stats":{"pod":300},"kind":"zone","sub":"can_dents","lvl":150,"food":"Poils pubiens de Kanig"},
    "tirubim": {"name":"Tirubim","icon":18116,"stats":{"pod":300},"kind":"zone","sub":"sak_foret","lvl":182,"food":"Viande Noire"},
    "siroko": {"name":"Siroko","icon":121005,"stats":{"age":120},"kind":"monti","fam":"e","dg":"dojo_vent","lvl":60,"stasis":6},
    "dehluge": {"name":"Dehluge","icon":121006,"stats":{"cha":120},"kind":"monti","fam":"e","dg":"vallee_dame_eaux","lvl":60,"stasis":6},
    "kompost": {"name":"Kompost","icon":121007,"stats":{"fo":120},"kind":"monti","fam":"e","dg":"clairiere_chene_mou","lvl":60,"stasis":6},
    "brulih": {"name":"Brûlih","icon":121008,"stats":{"ine":120},"kind":"monti","fam":"e","dg":"fabrique_foux","lvl":60,"stasis":6},
    "koliphant_mamukil": {"name":"Koliphant Mamukil","icon":121134,"stats":{"fo":90,"cri":5},"kind":"monti","fam":"e","dg":"cavernes_kolosso","lvl":60,"stasis":6},
    "koliphant_de_lexandre": {"name":"Koliphant de Lexandre","icon":121133,"stats":{"ine":90,"cri":5},"kind":"monti","fam":"e","dg":"hypogee_obsidiantre","lvl":60,"stasis":6},
    "koliphant_de_tarkaj": {"name":"Koliphant de Tarkaj","icon":121131,"stats":{"age":90,"cri":5},"kind":"monti","fam":"e","dg":"pyramide_ombre","lvl":60,"stasis":6},
    "koliphant_zenusha": {"name":"Koliphant Zenusha","icon":121132,"stats":{"cha":90,"cri":5},"kind":"monti","fam":"e","dg":"aquadome_merkator","lvl":60,"stasis":6},
    "tortikoli": {"name":"Tortikoli","icon":121069,"stats":{"tac":40,"xn":6},"kind":"monti","fam":"t","dg":"galerie_phossile","lvl":60,"stasis":6},
    "zarfuyar": {"name":"Zarfuyar","icon":121137,"stats":{"fui":40,"rpm":30},"kind":"monti","fam":"t","dg":"plateau_ush","lvl":60,"stasis":6},
    "kobrapid": {"name":"Kobrapid","icon":121136,"stats":{"epm":40,"ini":400},"kind":"monti","fam":"t","dg":"cave_toxoliath","lvl":60,"stasis":6},
    "teh_niak": {"name":"Teh'Niak","icon":121070,"stats":{"inv":1,"dt":8,"df":8,"de":8,"da":8},"kind":"monti","fam":"t","dg":"demeure_esprits","lvl":60,"stasis":6},
    "gowelan": {"name":"Gowelan","icon":121135,"stats":{"pod":300},"kind":"monti","fam":"t","dg":"clos_blops","lvl":60,"stasis":6},
    "dragouf": {"name":"Dragouf","icon":121000,"stats":{"pui":40,"inv":1},"kind":"monti","fam":"c","dg":"antre_dragon_cochon","lvl":60,"stasis":6},
    "hurledent": {"name":"Hurledent","icon":121001,"stats":{"pp":60},"kind":"monti","fam":"c","dg":"taniere_meulou","lvl":60,"stasis":6},
    "kramkram": {"name":"Kramkram","icon":121002,"stats":{"pui":40,"rt":4,"rf":4,"re":4,"ra":4,"rn":4},"kind":"monti","fam":"c","dg":"domaine_ancestral","lvl":60,"stasis":6},
    "balafreux": {"name":"Balafreux","icon":121004,"stats":{"pm":1,"do":10},"kind":"monti","fam":"c","dg":"ring_ekarlatte","lvl":60,"stasis":6},
    "phorror": {"name":"Phorror","icon":121010,"stats":{"cri":5,"pm":1},"kind":"monti","fam":"c","dg":"repaire_sphincter","lvl":60,"stasis":6},
    "kougnard_albatre": {"name":"Kougnard Albâtre","icon":121019,"stats":{"pui":40,"dcri":10},"kind":"monti","fam":"c","dg":"taniere_givrefoux","lvl":60,"stasis":6},
    "bouftor": {"name":"Bouftor","icon":121021,"stats":{"xt":8,"xf":8,"xe":8,"xa":8,"xn":8},"kind":"monti","fam":"c","dg":"pitons_craqueleur","lvl":60,"stasis":6},
    "bouflux": {"name":"Bouflux","icon":121022,"stats":{"dcri":10,"do":10},"kind":"monti","fam":"c","dg":"chapiteau_riktus","lvl":60,"stasis":6},
    "sakochere": {"name":"Sakochère","icon":121003,"stats":{"pa":1,"dcri":10},"kind":"monti","fam":"l","dg":"bastion_marteaux","lvl":60,"stasis":8},
    "kwaltess": {"name":"Kwaltess","icon":121009,"stats":{"pa":1,"pui":30},"kind":"monti","fam":"l","dg":"trone_cour_sombre","lvl":60,"stasis":8},
    "kougnard": {"name":"Kougnard","icon":121014,"stats":{"pa":1,"ini":300},"kind":"monti","fam":"l","dg":"forgefroide_frizz","lvl":60,"stasis":8},
    "monture_du_venerable": {"name":"Monture du Vénérable","icon":121164,"stats":{"pa":1,"inv":1},"kind":"monti","fam":"l","dg":"chambre_tal_kasha","lvl":60,"stasis":8},
  };
  E.PETS = PETS;
  E.PET_FAMS = { e: "Élémentaires", t: "Tactiques", c: "Combat", l: "Légendaires" };
  E.PET_LVL = 10; E.MONTI_LVL = 60;
  E.PET_MEAL_MS = 30 * 60000; E.PET_MEAL_N = 5; E.PET_DUP_G = 20;
  E.PET_ZONE_RATE = 1 / 2000; E.PET_BOSS_RATE = 1 / 25; E.MONTI_RATE = 1 / 25; E.MONTI_PITY = 60;
  E.MONTI_LEG_RATE = 1 / 250; E.MONTI_LEG_STEP = 0.000004; // +0,0004 point de chance par échec (1 sur 125 après 1 000 échecs)
  E.petSubs = {}; E.petDgs = {};
  for (const id in PETS) { const p = PETS[id]; if (p.sub) E.petSubs[p.sub] = id; if (p.dg) (E.petDgs[p.dg] = E.petDgs[p.dg] || []).push(id); }

  const isMonti = (id) => !!PETS[id] && PETS[id].kind === "monti";
  E.isMonti = isMonti;
  E.petReqLvl = (id) => (isMonti(id) ? E.MONTI_LVL : E.PET_LVL);
  /* stats entières (PA, PM, Invocation) : seulement à 100 % de croissance ; les autres vont de 20 % à 100 % du maximum */
  const WHOLE = ["pa", "pm", "inv"];
  E.petStatsAt = (id, g) => {
    const p = PETS[id]; const o = {}; if (!p) return o;
    for (const k in p.stats) { const m = p.stats[k]; o[k] = WHOLE.includes(k) ? (g >= 100 ? m : 0) : Math.max(1, Math.round(m * (0.2 + 0.8 * Math.min(100, g) / 100))); }
    return o;
  };
  E.petOf = (S, c) => { const P = c && c.pet && S.pets && S.pets[c.pet]; return P && PETS[P.id] ? P : null; };
  E.petStats = (S, c) => { const P = E.petOf(S, c); return P && c.lvl >= E.petReqLvl(P.id) ? E.petStatsAt(P.id, P.g) : null; };
  E.petOwner = (S, uid) => S.chars.find((c) => c.pet === uid);
  E.petOwned = (S, id) => Object.values(S.pets).find((P) => P.id === id);

  E.equipPet = (S, cid, uid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (!uid) { delete c.pet; E.emit(S, "equip", {}); return null; }
    const P = S.pets[uid]; if (!P) return "Familier introuvable.";
    if (c.lvl < E.petReqLvl(P.id)) return `Niveau ${E.petReqLvl(P.id)} requis.`;
    const o = E.petOwner(S, uid); if (o) delete o.pet;
    c.pet = uid; E.emit(S, "equip", {}); return null;
  };

  /* gain d'un familier ; un double nourrit celui qu'on a déjà */
  E.givePet = (S, id, why) => {
    const p = PETS[id]; if (!p) return null;
    const have = E.petOwned(S, id);
    if (have) { have.g = Math.min(100, have.g + E.PET_DUP_G); E.note(S, `${p.name} en double : il nourrit le vôtre (+${E.PET_DUP_G} % de croissance).`, "rare"); return have; }
    const uid = S.petUid++; const P = S.pets[uid] = { uid, id, g: 0, t: 0, got: E.now() };
    E.note(S, `${isMonti(id) ? "Montilier" : "Familier"} obtenu : ${p.name}${why ? " (" + why + ")" : ""} !`, "rare");
    E.celebrate({ t: "pet", id });
    // porté d'office par le premier héros de l'équipe qui n'en a pas
    const free = E.team(S).concat(S.chars).find((c) => !c.pet && c.lvl >= E.petReqLvl(id)); if (free) free.pet = uid;
    return P;
  };

  /* chasse : petite chance d'obtenir le familier de la sous-zone */
  E.petHunt = (S, sid) => { const id = E.petSubs[sid]; return id && rnd() < E.PET_ZONE_RATE ? E.givePet(S, id, "trouvé en chasse") : null; };
  /* boss : familiers rares et montiliers */
  E.petBoss = (S, did, k, out) => {
    for (const id of E.petDgs[did] || []) {
      const p = PETS[id]; if (k < p.stasis) continue;
      const n = S.petLuck[id] || 0; let ok;
      if (p.kind === "boss") ok = rnd() < E.PET_BOSS_RATE;
      else if (p.fam === "l") ok = rnd() < E.MONTI_LEG_RATE + n * E.MONTI_LEG_STEP;
      else ok = n + 1 >= E.MONTI_PITY || rnd() < E.MONTI_RATE;
      if (ok) { S.petLuck[id] = 0; E.givePet(S, id, "coffre du boss"); if (out) out.push(p.name); }
      else S.petLuck[id] = n + 1;
    }
  };

  /* repas : la nourriture préférée si elle est là (+2), sinon la ressource la plus abondante non protégée (+1) */
  E.petEdible = (S, r) => !!RES[r] && !E.isKey(r) && r !== E.POUSSIERE && !S.petKeep[r];
  const eat = (S, r, n) => { S.res[r] -= n; if (S.res[r] <= 0) delete S.res[r]; };
  E.petMeal = (S, P) => {
    const p = PETS[P.id]; const N = E.PET_MEAL_N;
    if (p.food && (S.res[p.food] || 0) >= N && E.petEdible(S, p.food)) { eat(S, p.food, N); P.g = Math.min(100, P.g + 2); P.last = p.food; P.hungry = false; return 2; }
    let best = null, bn = N - 1; for (const r in S.res) if (S.res[r] > bn && E.petEdible(S, r)) { best = r; bn = S.res[r]; }
    if (!best) { P.hungry = true; return 0; }
    eat(S, best, N); P.g = Math.min(100, P.g + 1); P.last = best; P.hungry = false; return 1;
  };
  /* temps réel (ms), en jeu comme hors ligne ; seuls les familiers portés mangent */
  E.petTick = (S, ms) => {
    for (const c of S.chars) {
      const P = E.petOf(S, c); if (!P || P.g >= 100) continue;
      P.t = (P.t || 0) + ms; let guard = 0;
      while (P.t >= E.PET_MEAL_MS && guard++ < 500) {
        P.t -= E.PET_MEAL_MS;
        if (E.petMeal(S, P) && P.g >= 100) { P.t = 0; E.note(S, `${PETS[P.id].name} a fini de grandir : bonus au maximum !`, "up"); break; }
      }
    }
  };
  /* temps restant avant 100 % (en ms), si les repas suivent */
  E.petEta = (S, P) => {
    const left = 100 - P.g; if (left <= 0) return 0; const p = PETS[P.id];
    const fav = p.food && !S.petKeep[p.food] && (S.res[p.food] || 0) >= E.PET_MEAL_N * Math.ceil(left / 2);
    return Math.max(0, Math.ceil(left / (fav ? 2 : 1)) * E.PET_MEAL_MS - (P.t || 0));
  };
  /* Pods : plus de butin pendant l'absence (+5 % par 100 Pods dans l'équipe, 50 % au plus) */
  E.podBonus = (S) => Math.min(0.5, E.team(S).reduce((a, c) => a + ((E.petStats(S, c) || {}).pod || 0), 0) / 100 * 0.05);
  E.petWhere = (id) => {
    const p = PETS[id]; if (!p) return "";
    if (p.kind === "zone") { const s = E.SUBS[p.sub]; return s ? `Chasse : ${s.name} (niv. ${s.lvl[0]}-${s.lvl[1]})` : ""; }
    return `Boss : ${DUNGEONS[p.dg].name}, stasis ${p.stasis} et plus`;
  };

  root.PETS_READY = true;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
