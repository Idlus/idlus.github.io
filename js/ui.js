/* ============================================================================
   INTERFACE — Idlus (v2)
   Rendu des pages (innerHTML) + combat animé (DOM à clés, mis à jour en place).
   ========================================================================== */
(function () {
"use strict";
const D = window.DATA, E = window.ENGINE;
const { STATS, STAT_ORDER, BASE_STATS, ELEMENTS, CLASSES, CLASS_ORDER, CONDITIONS, GATHER_JOBS, CRAFT_JOBS, SLOTS, MONSTERS, ZONES, DUNGEONS, ITEMS, SETS, SPECIAL_CRAFTS, RES, SPELL_IMG, RUNE_SIMPLE_ONLY, HUNT_TIERS, CONSUMABLES, STAT_HELP } = D;

let S = null;
const ui = {
  tab: "home", home: "apercu", world: "map", zoneView: null, hero: "equip", cid: null, slot: null, inv: "items", slotFilter: "all", met: "recolte", fg: "fm", qt: "main", az: null, azf: "all", fmSel: null, manualSpell: null,
  craftJob: "tailleur", craftOnly: false, craftSearch: "", focus: "", startCls: "iop", startSex: null, confirm: null, giveTo: null, combatCid: null, encZone: "incarnam",
};
/* La version de test (/beta/) a sa propre sauvegarde : elle ne touche jamais la partie du jeu public. */
const BETA = /\/beta\//.test(location.pathname);
const LS_KEY = BETA ? "dofousxen-save-beta" : "dofousxen-save";
/* ---------- Notes de mise à jour (bandeau « mise à jour appliquée ») ---------- */
const GAME_VERSION = "0.1.13.1";
const DISCORD = "https://discord.gg/9ApPgWjPUM", DISCORD_BUGS = "https://discord.gg/2xX6F9764Z"; // invitation qui ouvre directement le forum des bugs
const CHANGELOG = [
  { v: "0.1.13.1", name: "Dofus à leur place", items: [
    "Chaque Dofus tombe maintenant du boss qui lui correspond dans DOFUS : Cawotte dans la Grange du Tournesol Affamé (les champs), Dokoko à l'Arbre de Moon, Kaliptus chez le Koulosse (Koalaks), Émeraude chez Crocabulia, Turquoise (dragon de l'Eau) chez la Dame des Eaux, Domakuro chez le Maître Corbac, Dofus des Glaces chez Missiz Frizz, Argenté Scintillant chez la déesse Ilyzaelle",
    "Les quêtes de ces Dofus mènent à ces mêmes donjons ; la fiche de chaque donjon montre son Dofus",
  ] },
  { v: "0.1.13", name: "Archimonstres et Dofus", items: [
    "Album des archimonstres (bouton « Âmes » sur la carte du monde, dans les zones et sur la page Équipe) : les 205 archimonstres rangés par zone, jamais croisés, vaincus ou à l'âme capturée, avec leur sous-zone pour savoir où chasser",
    "Pierre d'âme : quand un archimonstre est vaincu, une pierre en sac capture son âme automatiquement (une par archimonstre). Recette chez le Bricoleur (niveau 25, 5 pierres), 1 à 3 pierres au premier passage de chaque stasis, 3 jetons au Bureau des primes",
    "Parfum de pistage (Bricoleur 40) : chances d'archimonstre ×2 pendant 2 h, cumulable avec le Bonbon Traqueur ; meuble « Autel des âmes » (Salle des trophées) : ×1,4 en permanence. La bande de combat affiche les pierres et le parfum",
    "Éternelle moisson, la quête du Dofus Ocre : six paliers par groupes de zones (Astrub, Amakna, Cania et Sidimote, Koalaks-Abraknydes-Moon, Dragoeufs-Otomaï-Minotoror, Pandala et Grobe) avec pierres, kamas, titre « Moissonneur », parfums, l'Autel des âmes et l'ornement « Âme violette », puis le Dofus Ocre (+1 PA) et le titre « Éternel Moissonneur »",
    "Les 18 Dofus de DOFUS avec leurs vrais bonus (Cacao +10 Tacle, Cawotte +60 Sagesse, Dokoko qui rend 3 % des PV à chaque tour, Kaliptus, Émeraude, Dolmanax, Pourpre, Dotruche, Domakuro, Turquoise, Ocre, Vulbis +1 PM, Ivoire, Ébène, des Glaces, Sylvestre +1 Portée, Argenté Scintillant, du Cauchemar) : chacun a sa quête dans Quêtes › Dofus (donjons à une stasis donnée, challenges, chasses, récoltes, âmes), validée toute seule en jouant",
    "Un Dofus peut aussi tomber en butin du boss de son donjon : 1 chance sur 1 000 dès la stasis 5 (Ocre : 1 sur 5 000 sur tout boss de niveau 160 et plus dès la stasis 8). Une fois obtenu, une copie pour un autre héros se fabrique chez le Bricoleur avec de la Poussière de stasis",
    "Rapport d'absence : âmes capturées et pierres restantes ; 7 succès Archimonstres (titres « Chasseur d'âmes », « Porteur de Dofus », « Gardien des Dofus ») ; panneau de test : pierres, toutes les âmes, les 18 Dofus",
  ] },
  { v: "0.1.12.4", name: "Sram et Crâ", items: [
    "Sram : ses pièges frappent dès qu'ils sont posés, avec des dégâts à la hauteur de son niveau (avant : un petit poison lent, qui le rendait bien plus faible que les autres classes à partir du niveau 140)",
    "Crâ : la Balise Tactique et la Balise de Survie restent des outils (vulnérabilité, puissance, soins) et ne frappent presque plus ; la Flèche Dévorante perd son énorme vol de vie et fait 30 % de dégâts en moins. Le Crâ était de loin la classe la plus forte à haut niveau" ] },
  { v: "0.1.12.3", name: "L'équipement compte", items: [
    "Les monstres sont plus forts à partir du niveau 30 : une équipe sans équipement perd presque tous ses combats de chasse, et en donjon elle échoue ou passe tout juste la stasis 1. Aux premiers niveaux, rien ne change",
    "En chasse, les groupes comptent au moins 4 monstres dès les zones de niveau 25 ; les combats durent plus longtemps, mais chaque monstre donne plus d'XP, de butin et de kamas : une équipe bien équipée gagne autant par heure qu'avant",
    "Paliers de donjon revus : bien équipé, une équipe vise la stasis 5 à 7 ; une équipe optimisée, la stasis 8 à 10" ] },
  { v: "0.1.12.2", name: "Nouvelle adresse", items: [
    "Le jeu a une nouvelle adresse plus simple : idlus.github.io (la bêta : idlus.github.io/beta)",
    "L'ancienne adresse renvoie automatiquement vers la nouvelle et ta partie te suit : elle est reprise si ce navigateur n'a encore aucune partie à la nouvelle adresse" ] },
  { v: "0.1.12.1", name: "Identité du Phénix", items: [
    "Un héros rené se reconnaît partout : cadre de feu animé autour de sa carte (à la place du cadre de niveau, dont l'étiquette reste en bas), flammes et braises derrière lui, nom en lettres de feu avec « ✦ III », couleur qui suit le palier (Braise, Flamme, Brasier, Phénix)",
    "En combat : un foyer de flammes sous ses pieds et son chiffre de renaissance sous son nom (vue scène et vue compacte)",
    "Page Équipe, choix du héros et plateau Réorganiser : nom doré et médaillon pour les héros renés" ] },
  { v: "0.1.12", name: "Renaissance", items: [
    "Renaissance : au niveau 200, un héros peut renaître à la Statue du Phénix (Équipe › Renaissance, ou le bouton sur sa fiche). Il repart au niveau 1 en gardant son apparence, ses titres et ornements, ses Dofus et trophées (toujours équipés), son familier, sa monture et ses parchemins ; son équipement est rangé dans le sac",
    "Chaque renaissance donne à ce héros +30 % d'XP (en plus du plafond commun) et un Éveil au choix parmi 8, chacun en 3 rangs : Fureur (dégâts), Robustesse (PV), Écorce (résistances), Lame affûtée (critiques), Main bienveillante (soins et boucliers), Premier sang (dégâts au tour 1), Œil du chercheur (prospection), Meneur (dégâts de toute l'équipe)",
    "Renaissances V et X : l'Éveil de classe, qui renforce le passif de la classe (la Colère du Iop éclate à 5 puis 4 charges, le Crâ garde son bonus un tour de plus, l'Horloge du Xélor sonne plus tôt…) ; 10 renaissances au plus par héros",
    "Récompenses visibles : médaillon du Phénix sur la carte du héros, aura Braise, Flamme, Brasier puis Phénix, titres « Né des cendres », « Flamme éternelle » et « Phénix d'Idlus », ornement « Ailes du Phénix » à la dixième ; trois succès",
    "Courbe d'XP : au-delà du niveau 100, l'XP demandée par niveau baisse progressivement (moitié vers 160, un tiers à 200) ; la première montée 1 → 200 prend environ 250 h pour une équipe équipée au lieu de 1 400 h (simulation). Les niveaux 1 à 100 ne changent pas ; les héros qui avaient déjà l'XP nécessaire montent à l'ouverture de la partie",
    "Simulateur : option --renaissance N pour tester des équipes à N renaissances" ] },
  { v: "0.1.11.2", name: "Aperçu des sorts", items: [
    "Sorts & stratégies : nouveau bloc « Ce que fera ton héros » qui montre les sorts lancés aux 3 premiers tours, les PA utilisés et les dégâts. Il est joué par le vrai moteur de combat (moyenne de 3 combats), en Chasse (ta zone ou une zone de ton niveau) ou contre un Boss de ton niveau",
    "Conseils automatiques avec un bouton pour régler : attaques jamais choisies (une autre fait plus de dégâts par PA), sort bloqué par sa condition, PA non utilisés avec le sort qui pourrait les remplir, sorts dont l'élément ne profite pas du profil (avec la variante du bon élément quand elle existe)",
    "Bilan sous l'aperçu : dégâts sur 3 tours et répartition des éléments des sorts d'attaque",
    "Bouton « Ranger au mieux » : le héros lance ses sorts de soutien dans l'ordre de la barre, le bouton essaie tous leurs ordres et garde celui qui fait le plus de dégâts, avec « Annuler »",
  ] },
  { v: "0.1.11.1", name: "Barre de sorts", items: [
    "Sorts & stratégies refait : les sorts équipés forment une barre de sorts comme en combat, avec leur coût en PA et leur condition écrite sous chaque case",
    "On touche un sort pour ouvrir sa fiche : description, dégâts estimés (avec la résistance de la cible), « Quand le lancer ? » et « Sur qui ? » en boutons, échange avec la variante en un clic, déplacement et retrait",
    "Grimoire par paires : chaque sort est affiché à côté de sa variante, filtres Tous / Dégâts / Soutien, niveau écrit sur les sorts verrouillés ; un clic l'ajoute à la barre (il remplace le sort sélectionné si la barre est pleine)",
    "Sur PC : on glisse un sort de la barre pour changer sa place, ou du grimoire vers une case ; la fiche complète s'affiche au survol",
    "Stratégies en onglets (fini les 4 lignes vides) avec « + Nouvelle stratégie », et le profil de build sur la même ligne",
    "Correction : les variantes des niveaux 125 à 200 n'indiquent plus « arrivera avec le contenu au-delà du niveau 120 », elles se débloquent à leur niveau",
  ] },
  { v: "0.1.11", name: "Idoles", items: [
    "Idoles : 36 statuettes en 9 familles (Vie, Dégâts, Protection, Nombre, Tempo, Rythme, Soins, Résistances, Critiques), 4 par famille. Chacune rend les combats plus durs (monstres plus résistants, plus nombreux, plus rapides, soins annulés…) et apporte un score",
    "Bonus : +0,5 % d'XP et de butin par point de score, en plus de la stasis et hors du plafond des bonus permanents (jusqu'à +102,5 % en chasse ; en donjon le score compte jusqu'à 60, soit +30 %)",
    "Jusqu'à 6 idoles actives, une seule par famille ; une idole en doublon avec un modificateur de stasis ne compte pas. Trois jeux d'idoles à enregistrer et recharger",
    "Fabrication une seule fois chez le Bricoleur (ressources de récolte du niveau de l'idole, Poussière de stasis dès le niveau 80, une ressource de boss dès 160) ; chaque idole révèle sa statuette avec un halo, des étincelles ou une lueur selon son rang, et un petit effet propre à sa famille",
    "Où les trouver : bouton « Idoles » sur l'écran de Combat, dans la zone de chasse, sur la fiche d'un donjon et sur la page Équipe ; le score et le bonus s'affichent dans la barre du combat et dans le butin",
    "L'IA respecte les idoles : avec Ougah, les héros ne lancent plus de soins inutiles",
    "Six succès (première idole, 12, les 36 avec le titre « l'Idolâtre », 6 actives en victoire, score 100 « le Téméraire », score 200 « Maître des idoles »)",
    "Simulateur : option --idoles hebdo,dynamo ou --idoles max",
  ] },
  { v: "0.1.10.2", name: "Chasse itinérante", items: [
    "Chasse itinérante : une case « Itinérante » à côté de « Suivre mon niveau » sur l'écran de combat. Après une victoire, l'équipe part vers une zone de son niveau (sans perte d'XP) qui a au moins 2 étoiles de plus que la zone actuelle, au plus une fois toutes les 10 minutes, en jeu comme hors ligne",
    "En échange, l'XP et le butin baissent de 15 % tant que la case est cochée. Elle rapporte surtout quand le jeu tourne longtemps ; si tu changes de zone toi-même, garde-la décochée",
    "Le résumé d'absence liste les zones visitées, et l'infobulle de la case montre les 10 dernières",
    "Correction : en changeant de zone, les étoiles gagnées par la nouvelle zone depuis votre dernier passage n'étaient pas toujours comptées" ] },
  { v: "0.1.10.1", name: "Récoltes et panoplies", items: [
    "Protecteurs de ressources : en récoltant, un gardien de la ressource apparaît parfois (environ une récolte sur 60, jamais plus d'un à la fois). Il attend 15 minutes : « Combattre » le place dans le prochain combat de chasse, avec quelques monstres de la zone. Victoire : cette ressource rapporte ×2 pendant 20 minutes, +10 de la ressource et +3 Éclats de trouvaille. Désactivable dans les Options",
    "Deux succès liés : « Gardien des récoltes » et « Fléau des protecteurs » (avec un titre)",
    "Codes cadeaux : un champ « Code cadeau » dans les Options pour recevoir des kamas, ressources, objets, titres ou ornements offerts sur le Discord. Chaque code ne sert qu'une fois par partie",
    "Carnet de panoplies (Inventaire › Panoplies) : toutes les panoplies, les pièces que vous avez ou non, où trouver chaque pièce manquante (recette, zone de chasse, donjon avec le taux), les bonus par palier, et un bouton pour mettre les pièces à fabriquer dans la liste de courses",
    "Compositions d'équipe (page Équipe) : enregistrez jusqu'à 3 équipes (héros, première ligne et arrière, cible prioritaire) et changez d'équipe en un clic. La fiche d'un donjon propose vos compositions et marque celle qui l'a déjà gagné" ] },
  { v: "0.1.10", name: "Sorts signature", items: [
    "Sorts signature : 2 sorts par classe (38 en tout) ont maintenant une animation unique, liée à ce qu'ils font dans DOFUS : la Colère de Iop qui saute hors de l'écran, l'Attaque Mortelle qui fige le temps et coupe la cible en deux, le Sablier de Xélor qui rembobine, la machine à sous de Tout ou Rien, le mot censuré du Mot Interdit, la Mascarade au projecteur, la Mégabombe et son champignon, le portail géant de Cataclysme…",
    "Pendant un sort signature, les actions suivantes du combat attendent la fin de l'animation (une seconde environ) ; rien ne change aux gains",
    "Ces animations ne jouent qu'avec les animations « Complètes » (Options) ; en « Sobres », les sorts gardent leur animation habituelle" ] },
  { v: "0.1.9.3", name: "Passif visible", items: [
    "Recruter un héros : la description et le passif de la classe choisie s'affichent en entier (ils étaient écrasés sous la grille des 19 classes) ; la fenêtre défile au lieu de rétrécir son contenu",
  ] },
  { v: "0.1.9.2", name: "Exotique", items: [
    "Runes exotiques : une Rune Ga ajoute +1 PA, +1 PM ou +1 Portée à un objet de niveau 150 ou plus qui n'a pas la caractéristique (un seul exo par objet, un seul exo PA porté par héros, pas sur les Dofus et trophées). Forgemage niveau 100 requis ; 10 % de réussite pour le PA, 12 % pour le PM et la Portée, sans aide du puits ni du métier ; un échec ne casse que la rune",
    "Portée, nouvelle caractéristique tactique : chaque point donne 20 % de chances qu'un sort à une cible touche un ennemi de plus",
    "Où trouver les runes Ga : coffres de boss des donjons de niveau 150+ en stasis 7 (1 sur 40, Ga PM ou Ga Po) et en stasis 8 (Ga PA, 1 sur 100), archimonstres de niveau 150+ (1 sur 25), ou l'onglet Runes (10 runes Ra d'une même caractéristique + 3 Éclats de trouvaille + 50 000 kamas pour une Ga PM ou Ga Po ; 25 runes Ra + 5 Éclats + 150 000 kamas pour une Ga PA)",
    "Brisage d'un objet exo : l'exo est perdu, mais l'objet rend ses runes ×2",
    "Forgemagie automatique : depuis l'établi, « Automatiser » lance un plan sur un objet (jets visés, runes autorisées, budget de kamas, plancher) ; une tentative toutes les 10 min (8 min au Forgemage 50, 6 min au 100), en jeu comme hors ligne, 2 plans en parallèle, sans héros à affecter. Le plan s'arrête tout seul quand les objectifs sont atteints, que les runes ou le budget manquent, ou que le plancher est touché ; le journal et le résumé d'absence racontent ce qui s'est passé",
    "Succès : « Exotique » (titre l'Exotique), « Un PA de plus », « Forgemagie automatique »",
    "Code de diagnostic pour les bugs : le bouton « Signaler un bug » copie aussi la version, l'appareil, l'onglet ouvert, un résumé de la partie (héros, zone, donjon) et les 5 dernières erreurs du jeu, à coller dans le forum Bugs du Discord ; bouton « Copier le diagnostic » dans les Options" ] },
  { v: "0.1.9.1", name: "Barre et page Équipe", items: [
    "Nouvelle barre de navigation en 4 familles : Accueil, Aventure, Équipe et Artisanat, avec leurs pages juste en dessous ; de la place pour les prochains onglets",
    "Sur PC, un cadre « Combat en cours » donne le donjon et la salle (ou la zone de chasse) depuis n'importe quelle page ; sur téléphone, Combat devient le gros bouton du centre",
    "Nouvelle page Équipe : une carte par héros avec son activité, son XP, sa monture et ce qui l'attend (points à répartir, meilleur équipement, familier affamé) ; chaque alerte est un bouton",
    "Bouton « Réorganiser » : un plateau pour glisser les héros entre la première ligne, l'arrière, la récolte, la salle d'entraînement et le repos (sur téléphone : toucher le héros, puis la zone)",
    "« Tout équiper au mieux » met le meilleur objet libre du sac dans chaque emplacement des héros de l'équipe",
    "Étoile ★ du héros principal : son symbole de classe devient l'icône de l'onglet Héros ; l'Accueil prend le logo d'Idlus et le Havre-Sac son sac" ] },
  { v: "0.1.9", name: "Montures", items: [
    "Montures : 41 couleurs officielles de dragodindes (dès le niveau 60), muldos (+1 PM, niveau 100) et volkornes (+1 PA, niveau 180), avec leurs bonus DOFUS au niveau 100",
    "Capture au filet : avec un filet dans le sac (2 000 kamas, ou Bricoleur niveau 40), chaque victoire aux Plaines Rocheuses, aux Plaines herbeuses d'Otomaï ou à la Plaine de Sakaï peut capturer une monture sauvage, hors ligne aussi",
    "La monture grandit avec une part de l'XP de son héros (réglable, 40 % par défaut ; toute l'XP d'un héros niveau 200) ; le PA et le PM n'arrivent qu'au niveau 100 de la monture",
    "Enclos du Havre-Sac (50 000 kamas, +10 places d'écurie) : deux montures de niveau 50 donnent un petit après 8 h, même hors ligne ; croisements connus (25 % de nouvelle couleur), bicolores (5 %) et 4 objets d'élevage",
    "Carnet de l'éleveur dans l'enclos (prochains croisements en un clic, collection par génération) et arbre généalogique ; un montilier prend toujours la place de la monture",
    "Case Monture sur la fiche du héros, onglet « Familier & monture », écurie de 10 places" ] },
  { v: "0.1.8.2", name: "Forgemagie", items: [
    "L'Emblème du Solitaire disparaît (il ne servait qu'en solo) : les runes investies sont rendues en runes simples, le titre « le Solitaire » et l'ornement « Aura du Solitaire » restent à ceux qui les avaient",
    "Puits de forgemagie : ce qu'un objet perd sur un échec remplit son puits ; tant qu'il couvre la rune tentée, +25 % de réussite et aucune perte",
    "Onglet Runes : 3 runes identiques se fusionnent en rune supérieure (et l'inverse), 5 runes d'une caractéristique se transmutent en 1 rune d'une autre contre des kamas, et les runes inutiles nourrissent le métier de Forgemage",
    "Métier de Forgemage (niveau 1 à 100) : chaque forgemagie donne de l'expérience ; +0,1 % de réussite et −0,5 % de kamas par niveau, échecs moins punitifs au niveau 30, un Cristal offert par jour au niveau 60, titre « Grand Forgemage » au niveau 100",
    "Objets Parfaits : un objet dont toutes les caractéristiques positives sont au jet maximum gagne +2 % sur chacune, un liseré doré et deux succès (titre « le Perfectionniste »)" ] },

  { v: "0.1.8.1", name: "Étoiles de zone", items: [
    "Étoiles de zone : une zone où personne ne chasse gagne une étoile toutes les 2 h (5 au plus) ; chaque étoile donne +10 % d'XP et de butin dans cette zone",
    "Les étoiles fondent pendant qu'on y chasse (une toutes les 30 min, hors ligne aussi) : changer de zone de temps en temps rapporte plus",
    "Les étoiles s'affichent sur la carte, dans la fiche de la zone et sur l'Accueil ; les parties existantes commencent avec 5 étoiles partout" ] },
  { v: "0.1.8", name: "Familiers et montiliers", items: [
    "140 familiers et montiliers officiels, avec leurs vraies icônes : un emplacement Familier sur la fiche du héros, dès le niveau 10",
    "Ils grandissent en mangeant les ressources du sac (un repas toutes les 30 min, même hors ligne) ; leur nourriture préférée compte double ; vous protégez les ressources de votre choix",
    "Chaque sous-zone de chasse cache son familier (rare) ; les boss en stasis 6 et plus gardent des familiers rares et 25 montiliers, dont 4 légendaires à +1 PA",
    "Nouvelles stats tactiques : Tacle, Fuite, PM, Retrait et Esquive PA/PM, Invocation et Pods. Des Rôdeurs et Bondisseurs arrivent dans les donjons de fin de jeu" ] },
  { v: "0.1.7", name: "Les 19 classes", items: [
    "Sram : des piques sortent du sol sous les monstres qu'il a empoisonnés",
    "Sadida : ses ronces se comptent sur la cible (×1 à ×3) et son Arbre ondule",
    "Steamer : sa tourelle tombe du ciel dans un nuage de vapeur ; Osamodas : un fil de lumière le relie à ses invocations" ] },
  { v: "0.1.6", name: "Passifs visibles", items: [
    "Chaque classe montre son passif en combat : flammes de Colère du Iop, horloge du Xélor, glyphes du Féca sous toute l'équipe, masques du Zobal, postures du Forgelance",
    "La roue de l'Ecaflip tourne au début du combat et s'arrête sur Pile, Face, Jackpot ou Perdu",
    "Le Pandawa titube puis s'endort, le Sacrieur rougit en souffrant, les runes de l'Huppermage s'allument",
    "Viseur rouge du Crâ et crocs de l'Ouginak sur leur cible ; mots de l'Eniripsa, portails de l'Eliotrope, trésors de l'Enutrof" ] },
  { v: "0.1.5", name: "Pionniers", items: [
    "Merci de tester ! Chaque partie de la version de test reçoit le titre « Pionnier d'Idlus » et l'ornement « Pousse du Pionnier » (Héros → Titre et Ornement)",
    "Récompense exclusive : au lancement du multijoueur, tout le monde repart de zéro, mais les testeurs qui ont le rôle Pionnier sur le Discord retrouveront ce titre et cet ornement" ] },
  { v: "0.1.4", name: "Encore plus posés", items: [
    "Les combats ralentissent encore un peu : une action toutes les 0,78 seconde (0,52 avant la 0.1.3)",
    "Les récompenses par combat suivent : gains par heure toujours inchangés" ] },
  { v: "0.1.3", name: "Combats plus posés", items: [
    "Les combats sont un peu moins rapides (environ 25 %) pour mieux profiter des animations",
    "Chaque combat rapporte un peu plus d'XP, de butin et de kamas : les gains par heure restent les mêmes, en jeu comme hors ligne" ] },
  { v: "0.1.2", name: "Combat animé", items: [
    "Les sorts partent du lanceur et volent jusqu'à leur cible, avec la patte de chaque classe : le Iop bondit, le Sram passe dans le dos, le Crâ tire des flèches, l'Ecaflip des cartes, l'Eliotrope ouvre des portails…",
    "Le nom du sort s'affiche au-dessus du lanceur ; les coups critiques ont leur gros chiffre doré",
    "Sorts de zone en onde, pluie de flèches du Crâ ; un cercle tourne sous celui qui joue",
    "États visibles : poison, malus, PA retirés, gel, lueur des boucliers",
    "Les monstres s'écrasent en lâchant des kamas, un héros à terre laisse une petite tombe",
    "Les boss préviennent avant leur attaque dévastatrice : bandeau et cercles rouges sous les héros visés",
    "Options : animations Complètes, Sobres ou Aucune" ] },
  { v: "0.1.1", name: "Mutateur éclair", items: [
    "Mutateur éclair : toutes les 20 minutes, 3 donjons (niveaux 10-79, 80-149 et 150-200, les mêmes pour tous) reçoivent un modificateur et donnent +12 % d'XP et de butin, +25 % de poussière",
    "Une course commencée garde le bonus jusqu'au bout ; l'onglet Donjons montre le temps restant et les 3 donjons suivants",
    "3 nouveaux modificateurs : Champions (un Champion par salle), Boss rusé (une mécanique de plus) et Renforts (deux serviteurs de plus avec le boss)",
    "Le mutateur de la semaine ne change pas" ] },
  { v: "0.1.0", name: "Niveau 200 (bêta)", items: [
    "Nouvelle numérotation : le jeu repart à 0.1 jusqu'au multijoueur, qui sera la 1.0",
    "Niveau 200 : 839 monstres, 1 707 objets, 51 nouveaux donjons de 120 à 200 et de nouvelles régions (Frigost, Saharach, Harebourg, Sakaï, Sufokia, Dimensions divines…)",
    "Carte plus lisible : filtre par tranche de niveaux, régions repliables, zones en lignes compactes, meilleure zone signalée, zones trop faibles grisées, progression par région",
    "Monstres à rôle (soigneur, kamikaze, chef, invocateur, poison, coriace…) et 22 mécaniques de boss, plus 20 signatures uniques avec leur succès et un titre",
    "Mécaniques cachées jusqu'à la première rencontre du boss, conseils avant le donjon et choix de la cible prioritaire de l'équipe",
    "Recette des clés de donjon : panneau clair avec la progression et un bouton vers la zone ou le métier pour chaque ingrédient",
    "Bonus « petit groupe » en donjon : +30 % de PV et −15 % de dégâts subis en solo, moitié moins en duo ; Mutisme et Condamnation adoucis en solo",
    "Monstres des niveaux 100 à 200 plus solides (jusqu'à ×1,4 PV et ×1,35 dégâts au niveau 200)" ] },
  { v: "3.4.0", name: "Havre-Sac", items: [
    "Le Havre-Sac devient 8 pièces (Accueil → Havre-Sac) : vos améliorations gardent leur niveau et sont rangées par pièce, l'atelier se construit pour 50 000 kamas et l'enclos ouvrira plus tard",
    "Meubles : un meuble agit une fois placé dans sa pièce, avec des places limitées (14 au total). 43 meubles : 28 trophées de boss, meubles du Comptoir, de l'Almanax, du Bricoleur (5 recettes), butins rares de 5 zones et 2 succès ; un catalogue montre comment obtenir chacun. Les meubles déjà gagnés sont placés d'office",
    "Trophées de boss : chaque boss donne son trophée à la première victoire en stasis 5 (les stasis 5 déjà passées le donnent tout de suite). Effet de +1 % à +4 % selon le niveau du donjon",
    "Salle d'entraînement : un héros hors de l'équipe gagne 25 % de l'XP moyenne de l'équipe, sans combattre, moins s'il a plus de 10 niveaux de retard",
    "Atelier : un héros affecté fabrique la recette choisie toutes les 20 minutes, même hors ligne, tant que les ressources suffisent",
    "Plafond des bonus relevé à +175 % d'XP, +175 % de butin et +200 % de kamas" ] },
  { v: "3.3.0", name: "Combat vivant", items: [
    "Placement de l'équipe (onglet Héros) : chaque héros est en première ligne ou à l'arrière. Les monstres visent la première ligne 3 fois sur 4 tant qu'elle tient debout. Placement automatique par défaut (les héros les plus solides devant), modifiable à la main",
    "Monstres à mécanique spéciale : les Rôdeurs (Bwork Archer, Chafers furtifs, Corbacs…) visent l'arrière, les Bondisseurs (Tofus, Moskitos, Kwaks de Vent) ignorent les rangées",
    "Monstres Champions en chasse : environ un combat sur 100, un monstre devient Champion (PV ×2, dégâts +20 %, un pouvoir parmi six). Récompense : XP ×3, butin ×2, une ressource garantie et deux fois plus de chances de Rayonnant. Quatre succès, jusqu'à 1 000 Champions",
    "Un décor pour chacun des 28 donjons, salle du boss plus sombre avec des torches, et météo en chasse (pluie, neige, lucioles, sable) ; option « Effets de décor » pour les appareils lents",
    "Pourquoi j'ai perdu ? signale un héros fragile tombé en première ligne, avec un bouton vers le placement ; la notification « Évènement rare » couvre aussi les Champions" ] },
  { v: "3.2.3", name: "Répartition au choix", items: [
    "Répartition des points : choisissez Automatique ou Manuelle pour chaque héros (onglet Caractéristiques). En manuel, des boutons −1 et −10 rendent les points sans frais, et une pastille rouge sur l'onglet signale les points qui restent à placer",
    "Passer en manuel garde les points déjà placés ; revenir en automatique retrouve la caractéristique choisie avant" ] },
  { v: "3.2.2", name: "Confort", items: [
    "Pourquoi j'ai perdu ? : après une défaite, l'onglet Butin explique en une phrase ce qui a manqué (« cause : action »), avec les faits du combat et jusqu'à trois objets conseillés (dans le sac, à fabriquer, à looter)",
    "Objectifs épinglés : une bande sous la barre du haut suit jusqu'à 3 objectifs partout dans le jeu (quête principale d'office, avis de recherche, mission d'alignement, liste de courses, niveau d'un héros, succès)",
    "Temps estimé : survolez (ou touchez) la barre d'XP d'un héros pour voir quand il passe le niveau suivant ; la liste de courses et les clés de donjon indiquent dans combien de temps tout sera réuni",
    "Notifications : six évènements au choix dans les Options, avec une notification du navigateur quand l'onglet est en arrière-plan (sac plein, défaite, objectif atteint, liste de courses prête, palier de niveau, Rayonnant ou archimonstre)" ] },
  { v: "3.2.1", name: "Petit lot", items: [
    "Tenues : enregistrez jusqu'à 3 équipements complets par héros (chasse, donjon, prospection…) et remettez-les en un clic ; leurs objets sont protégés de la vente et du brisage",
    "Mutateur de la semaine : chaque lundi, un donjon reçoit un modificateur imposé, en échange de +25 % d'XP et de butin et +50 % de poussière de stasis (Monde › Donjons)",
    "Entrée des boss : nom en grand, stasis et mécaniques au début du combat ; un flash marque la seconde phase",
    "Moments de récompense : grand encart pour un objet Rayonnant, chaque palier de 10 niveaux et chaque premier passage de stasis (désactivable dans les Options)",
    "Partager un build : un code à copier sur Discord avec les sorts, les caractéristiques et l'équipement d'un héros ; collez celui d'un autre joueur pour le consulter, l'appliquer à un héros de la même classe ou mettre ses objets fabricables dans la liste de courses" ] },
  { v: "3.2.0", name: "Héros en pied", items: [
    "Raretés d'objets : Commun, Peu commun, Rare, Épique et Légendaire, selon la façon d'obtenir l'objet (fabriqué, en panoplie, lâché par un monstre, par un boss de donjon, trophées)",
    "La couleur de rareté apparaît partout : sac, fiche héros, butin, infobulles et fiche d'objet ; filtre et tri par rareté dans l'Inventaire",
    "Fiche héros en pied : votre personnage au centre de son équipement, comme dans DOFUS",
    "Cartes de héros allégées : le héros en pied, un liseré et un ruban à la couleur du cadre",
    "Les objets Rayonnants gardent leur effet, par-dessus la rareté"
  ] },
  { v: "3.1.2", name: "Nouvelle interface", items: [
    "Nouveau thème « Émeraude » aux couleurs du logo DOFUS 3 (l'ancien thème « Nuit violette » reste disponible dans les Options)",
    "Nouveau logo idlus : l'œuf émeraude, aussi sur l'application installée",
    "Écran de combat refait : arène qui s'adapte au nombre de héros, personnages en quinconce, plus aucune tête coupée, nom et vie sous les pieds",
    "Bande des challenges au-dessus de l'arène, dernière action juste en dessous, halo sur le héros qui joue",
    "Vue « Compacte » (une carte par combattant), automatique sur téléphone à partir de 6 héros",
    "Sur téléphone : l'arène reste visible en haut quand on fait défiler, onglets Sorts / Journal / Butin",
    "Menus en médaillons et objets officiels de DOFUS à la place des émojis (kamas, poussières, clés, coffres, challenges…)",
    "Notifications regroupées (« 3 héros passent niveau 59 ») et nouveautés de mise à jour dans un petit bouton ✨",
    "Correctif : la tête du Forgelance ne flotte plus à côté de son corps" ] },
  { v: "3.1.1", name: "Stasis plus exigeante", items: [
    "Stasis rééquilibrée : les dégâts des monstres augmentent de 20 % par niveau (cumulatifs) ; sans équipement, la stasis 5 n'est plus faisable",
    "Paliers visés : sans stuff jusqu'à la stasis 4, avec un bon stuff stasis 6-7, la stasis 10 réservée aux équipes optimisées",
    "Récompenses revues à la hausse : +15 % d'XP et de butin par niveau de stasis (au lieu de +12 %)",
    "Stasis 9 : 15 tours par salle et 24 contre le boss (la difficulté vient désormais des monstres, pas du chrono)",
    "L'estimation de difficulté des donjons tient compte de l'équipement de l'équipe",
    "Fabrication des parchemins de caractéristiques avec la poussière de stasis, directement depuis l'onglet Caractéristiques" ] },
  { v: "3.1.0", name: "Donjons et classes", items: [
    "Héros en pied : de vrais personnages DOFUS en combat, avec 8 têtes et 6 palettes au choix (Héros › 🎨 Apparence), et 64 coiffes et capes visibles sur le héros",
    "Stasis : 10 niveaux de difficulté par donjon (synchronisation au niveau de l'équipe dès la stasis 4, élites, modificateurs, boss légendaire), avec coffres, poussière et parchemins",
    "Nouveau menu des donjons : fiche détaillée, état de la clé, butin, records, estimation de difficulté, favoris et bouton « Enchaîner »",
    "Challenges mis en avant : encart en direct dans l'arène, série 🔥 dans la barre du haut, détail des bonus en fin de combat",
    "Nouveaux passifs : Glyphes (Féca), Horloge (Xélor), Pelle (Enutrof), Roulette (Ecaflip), Ronces (Sadida), Ivresse (Pandawa), Postures (Forgelance), Distance (Crâ), Dressage (Osamodas), Tourelles (Steamer), avec une jauge sous chaque héros",
    "Caractéristiques : paliers officiels de DOFUS (au-delà de 100, il faut plus de points), réinitialisation gratuite, répartition auto avec palier, parchemins de caractéristiques (+100 max)" ] },
  { v: "3.0.3", name: "Application installable", items: [
    "idlus s'installe sur téléphone et PC comme une vraie application : icône, plein écran, lancement instantané",
    "Le jeu fonctionne hors connexion (les images sont gardées au fil de la partie)",
    "Bouton « Installer » dans les Options, avec un guide pour iPhone",
    "Le serveur Discord d'idlus est ouvert : bouton sur l'Accueil et « Signaler un bug » dans les Options",
    "Nouvelle adresse : mathiss29.github.io/idlus" ] },
  { v: "3.0.2", name: "Équilibrage des classes", items: [
    "Les 19 classes sont rééquilibrées par leurs sorts et passifs : les écarts de puissance entre classes sont bien plus faibles",
    "Iop : Colère à 6 charges (+40 %), Concentration 2 fois par tour, nouveau passif Vigueur (vol de vie 8 %)",
    "Zobal : masque choisi selon la situation (attaque +30 %, défense, soutien) ; Eliotrope : bouclier de portail et vol de vie",
    "Crâ : subit 15 % de dégâts en moins, Pas Chassé protège, Flèche Cinglante (niv. 12) et Dispersion (niv. 34) plus tôt",
    "Pandawa et Sadida : bonus de classe réduits (+20 % et +10 %)",
    "Ce bandeau vous résume chaque mise à jour, et le jeu vous prévient quand une nouvelle version est en ligne" ] },
  { v: "3.0.1", name: "Correctifs", items: [
    "Toutes les clés de donjon sont fabricables",
    "178 sorts de placement ou d'état ont un effet adapté au combat automatique",
    "Sous-zones de transition 68-86 (Kaliptus, Forêt Sombre, Canyon)",
    "Nouveau nom : idlus" ] },
  { v: "3.0", name: "Builds et contenu", items: [
    "Vrais sorts de DOFUS 3 et variantes, 6 à 8 emplacements",
    "Profil de build, simulateur de dégâts, nouvelles caractéristiques",
    "Challenges, mécaniques de boss, invocations",
    "Contenu jusqu'au niveau 120 et 17 nouveaux donjons" ] },
];
/* Numérotation : l'ancienne série 3.x, puis la nouvelle série 0.x (avant le multijoueur) et 1.0 (multijoueur), toujours plus récente que 3.x. */
const vNum = (v) => { const p = String(v).split(".").map((x) => parseInt(x, 10) || 0); const n = p.reduce((a, x, i) => a + x * Math.pow(1000, 2 - i), 0); return p[0] < 3 ? 1e10 + n : n; };

/* ---------- utilitaires ---------- */
const $ = (s) => document.querySelector(s);
/* 0.1.9.2 : les 5 dernières erreurs du jeu, gardées entre deux lancements, pour le code de diagnostic du bouton « Signaler un bug » */
const ERR_KEY = LS_KEY + "-errs";
const readErrs = () => { try { const a = JSON.parse(localStorage.getItem(ERR_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const logErr = (txt) => { try { const a = readErrs(); const last = a[a.length - 1]; if (last && last.txt === txt) { last.n = (last.n || 1) + 1; last.t = Date.now(); } else a.push({ t: Date.now(), txt: String(txt).slice(0, 300) }); while (a.length > 5) a.shift(); localStorage.setItem(ERR_KEY, JSON.stringify(a)); } catch (e) { /* stockage indisponible */ } };
window.addEventListener("error", (e) => logErr(`${e.message || "Erreur"}${e.filename ? ` (${e.filename.replace(/^.*\//, "")}:${e.lineno || "?"})` : ""}`));
window.addEventListener("unhandledrejection", (e) => logErr(`Promesse rejetée : ${e.reason && e.reason.message ? e.reason.message : e.reason}`));
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.floor(n).toLocaleString("fr-FR");
const pct = (a, b) => Math.max(0, Math.min(100, b ? (a / b) * 100 : 0));
const char = (id) => S.chars.find((c) => c.id === id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dur = (s) => { s = Math.round(s); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60); return hh ? `${hh} h ${mm} min` : mm ? `${mm} min` : `${s} s`; };
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "à l'instant" : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : `il y a ${Math.floor(s / 3600)} h`; };
const elVar = (el) => (el === "buff" ? "var(--buff)" : `var(--el-${el || "n"})`);
const eld = (el) => `<span class="eld" style="--c:${elVar(el)}" title="${ELEMENTS[el || "n"].name}">${ELEMENTS[el || "n"].name[0]}</span>`;
const fmtStatVal = (k, v) => (["cri", "rt", "rf", "re", "ra"].includes(k) ? `${fmt(v)} %` : fmt(v));
const statLine = (k, v) => `${v > 0 ? "+" : ""}${fmt(v)} ${STATS[k].name.replace("% ", "")}`;

/* images */
const imgM = (key) => (MONSTERS[key] ? `assets/m/${MONSTERS[key].img}.png` : "");
const imgI = (icon) => `assets/i/${icon}.png`;
const resImg = (name) => (RES[name] ? imgI(RES[name].icon) : "");
const itemImg = (tpl) => { const T = ITEMS[tpl]; if (!T) return ""; return T.mimg ? `assets/m/${T.mimg}.png` : imgI(T.icon); };
const spellImg = (name) => (SPELL_IMG[name] ? `assets/s/${SPELL_IMG[name]}.png` : "");
const headImg = (c) => `assets/h/${c.cls}_${c.sex || CLASSES[c.cls].sex}.png`;
const logoImg = (cls) => `assets/h/${cls}_logo.png`;
const symImg = (cls) => `assets/h/${cls}_sym.png`;
const im = (src, cls = "ico", alt = "") => (src ? `<img class="${cls}" src="${src}" alt="${h(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : "");
const headTag = (cls, sex, alt = "") => `<img src="assets/h/${cls}_${sex || CLASSES[cls].sex}.png" alt="${h(alt)}" loading="lazy" onerror="this.onerror=null;this.src='assets/h/${cls}_logo.png'">`;
/* ---------- icônes 3.1.2 : objets officiels + glyphes ---------- */
const IC = (n, c = "") => `<img class="uico ${c}" src="assets/ui/${n}.webp" alt="" loading="lazy">`;
const GL = {
  swap: '<path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.6"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8v12M9 5l1.5 3M15 5l-1.5 3M3 12h4M17 12h4M4 18l3-1.5M20 18l-3-1.5M4 6l3 2M20 6l-3 2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  up: '<path d="M12 20V5M5 11l7-7 7 7"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
  frame: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.5 19.7l1.2-6.1L3.2 9.4l6.1-.8z"/>',
  pin: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 14v7"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>' };
const GLF = { flame: '<path fill="#ffb347" stroke="#c2410c" stroke-width="1.2" d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.3 2.6-5.4.3 1.8 1.2 2.9 2.4 3.3-.6-3.3-.3-6.3.5-8.9z"/><path fill="#ffe08a" d="M12 21a2.6 2.6 0 0 1-2.6-2.6c0-1.8 1.6-2.6 2.1-4.2 1.2 1.2 3.1 2.2 3.1 4.2A2.6 2.6 0 0 1 12 21z"/>',
  sparkle: '<path fill="#e2f5ae" stroke="none" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/><path fill="#dcbb74" stroke="none" d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>' };
const G = (n, c = "") => GLF[n] ? `<svg class="uico ${c}" viewBox="0 0 24 24" aria-hidden="true">${GLF[n]}</svg>` : `<svg class="uico gl ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GL[n] || ""}</svg>`;
/* émojis des données (consommables, Havre-Sac, boutiques…) → icônes officielles */
const EMO = { "📜": "quetes", "🧪": "teinture", "📦": "coffre", "🍬": "bonbon", "🍭": "bonbon", "🪙": "kamas", "🎯": "bonbon", "👑": "couronne", "📘": "parchemin_or", "💎": "cristal", "🎁": "coffre", "💰": "bourse", "🗝": "cle", "✨": "poussiere", "⛏": "pioche", "📚": "parchemin_or", "🏺": "trophee", "🥊": "combat", "🌿": "pioche", "🎒": "sac", "🛏": "havre", "🎩": "couronne", "🎟": "carte", "🎖": "trophee", "🌾": "bonbon", "🪽": "ailes", "🪑": "havre" };
const emo = (e) => { const k = String(e || "").replace(/\ufe0f/g, ""); return EMO[k] ? IC(EMO[k]) : `<span class="uemo">${h(e || "")}</span>`; };
const med = (n, sz = "") => `<i class="med ${sz}"><img src="assets/ui/${n}.webp" alt=""></i>`;
const CATICO = {};
const catIco = (c) => { if (!(c.id in CATICO)) { const best = Object.entries(RES).filter(([, r]) => c.types.includes(r.type)).sort((a, b) => a[1].lvl - b[1].lvl)[0]; CATICO[c.id] = best ? `<img class="uico" src="${resImg(best[0])}" alt="" loading="lazy">` : ""; } return CATICO[c.id] || emo(c.icon); };
/* ---------- Apparence des héros (3.1) ---------- */
const LK = (typeof LOOKS !== "undefined" && LOOKS) || { CLASS_LOOKS: {}, ITEM_SKINS: {}, PALETTES: [] };
const lookLocal = (cls, sex, hi) => `assets/look/${cls}_${sex === "f" ? "f" : "m"}_${hi || 0}.webp`;
function lookUrl(c, opts = {}) {
  const L = LK.CLASS_LOOKS[c.cls]; if (!L) return null; const sx = c.sex === "f" ? "f" : "m"; const D2 = L[sx]; const hi = Math.max(0, Math.min(D2.heads.length - 1, c.head || 0));
  const skins = [D2.body, D2.heads[hi]];
  const worn = []; if (!opts.bare && c.equip) ["coiffe", "cape"].forEach((sl) => { const it = S && S.items[c.equip[sl]]; const sk = it && LK.ITEM_SKINS[it.tpl]; if (sk) { skins.push(sk); worn.push(+it.tpl.slice(1)); } });
  if (c.cls === "forge") return worn.length ? forgeLook(sx, worn) : lookLocal("forge", sx, 0); // Forgelance : rendu DofusDB (voir forgeLook)
  const pal = LK.PALETTES.find((p) => p.id === (opts.palette || c.palette)) || LK.PALETTES[0];
  const cols = D2.colors.slice(); if (pal && pal.c) pal.c.forEach((v, i) => (cols[i + 1] = v));
  if (skins.length === 2 && (!pal || !pal.c)) return lookLocal(c.cls, sx, hi);
  const look = `{1|${skins.join(",")}|${cols.map((v, i) => `${i + 1}=${v}`).join(",")}|140}`;
  let hex = ""; for (const ch of unescape(encodeURIComponent(look))) hex += ch.charCodeAt(0).toString(16).padStart(2, "0");
  return `https://static.ankama.com/dofus/renderer/look/${hex}/full/1/200_200-10.png`;
}
/* Forgelance : avec ses numéros d'apparence, le moteur de rendu dessine un casque et pose la tête à côté du corps.
   DofusDB sait le dessiner correctement (tête par défaut, couleurs d'origine) à partir d'un jeton qu'il fabrique pour la classe
   et les objets portés : on demande le jeton, puis l'image. Les coiffes et capes s'affichent ; ni choix de tête ni couleurs. */
const FORGE = { tok: {}, wait: {} };
function forgeLook(sx, items) {
  const key = sx + (items.length ? "-" + items.join("-") : ""), url = (t) => { let x = ""; for (const ch of t) x += ch.charCodeAt(0).toString(16).padStart(2, "0"); return `https://renderer.dofusdb.fr/kool/${x}/full/1/300_300.png`; };
  if (FORGE.tok[key]) return url(FORGE.tok[key]);
  if (!FORGE.wait[key]) FORGE.wait[key] = fetch(`https://api.dofusdb.fr/look?breedId=20&sexe=${sx}${items.map((i) => "&itemIds[]=" + i).join("")}`).then((r) => r.json()).then((t) => {
    if (typeof t !== "string") return; FORGE.tok[key] = t; document.querySelectorAll(`img[data-fk="${key}"]`).forEach((im) => (im.src = url(t)));
  }).catch(() => {}); // hors ligne : l'image locale reste
  return { src: lookLocal("forge", sx, 0), key };
}
const lookImg = (c, cls = "look", opts) => { const u = lookUrl(c, opts); if (!u) return ""; const fb = lookLocal(c.cls, c.sex, c.head || 0);
  if (typeof u === "object") return `<img class="${cls}" src="${u.src}" data-fk="${u.key}" alt="" loading="lazy">`; // Forgelance recomposé (image locale en attendant)
  return `<img class="${cls}" src="${u}" alt="" loading="lazy" onerror="if(this.src.indexOf('assets/look')<0){this.src='${fb}'}else{this.style.visibility='hidden'}">`; };
function lookSheet(c) {
  const L = LK.CLASS_LOOKS[c.cls]; if (!L) return;
  const sx = c.sex === "f" ? "f" : "m";
  openSheet(`<h2>Apparence de ${h(c.name)}</h2>
    <div class="lookprev">${lookImg(c, "lookbig")}</div>
    <div class="small"><b>Sexe</b> <span class="seg">${[["m", "Homme"], ["f", "Femme"]].map(([v, n]) => `<button data-act="looksex" data-v="${v}" aria-pressed="${sx === v}">${n}</button>`).join("")}</span></div>
    ${c.cls === "forge" ? "" : `<div class="small"><b>Tête</b><div class="headpick">${L[sx].heads.map((_, i) => `<button class="${(c.head || 0) === i ? "on" : ""}" data-act="lookhead" data-v="${i}">${`<img src="${lookLocal(c.cls, sx, i)}" alt="">`}</button>`).join("")}</div></div>`}
    ${c.cls === "forge" ? `<p class="xs muted">Le Forgelance s'affiche avec sa tête et ses couleurs d'origine ; ses coiffes et capes apparaissent.</p>` : ""}<div class="small" ${c.cls === "forge" ? 'style="display:none"' : ""}><b>Couleurs</b><div class="palpick">${LK.PALETTES.map((p) => { const cols = L[sx].colors.slice(); if (p.c) p.c.forEach((v, i) => (cols[i + 1] = v)); return `<button class="${(c.palette || "classique") === p.id ? "on" : ""}" data-act="lookpal" data-v="${p.id}"><span class="sw">${cols.slice(1, 5).map((v) => `<i style="background:#${v.toString(16).padStart(6, "0")}"></i>`).join("")}</span>${h(p.name)}</button>`; }).join("")}</div></div>
    <p class="xs muted">${Object.keys(LK.ITEM_SKINS).length} coiffes et capes apparaissent déjà sur les héros ; les autres arriveront au fil des mises à jour.</p>
    <div><button class="btn primary" data-act="closesheet">Terminé</button></div>`);
}
const head = (c, lg) => `<span class="head ${lg ? "lg" : ""}" style="--cc:${CLASSES[c.cls].color}">${headTag(c.cls, c.sex, c.name)}</span>`;
const sIco = (k) => (["vit", "sa", "fo", "ine", "cha", "age", "pui", "do", "cri", "so", "pp", "ini", "pa", "rt", "rf", "re", "ra"].includes(k) ? `<img class="sico" src="assets/c/${k}.png" alt="" loading="lazy">` : "");
const tipAttr = (k) => (STAT_HELP[k] ? ` data-tip="${h((STATS[k] ? STATS[k].name.replace("% ", "") : "Points de vie") + " — " + STAT_HELP[k])}"` : "");
const resChips = (res) => Object.entries(res || {}).filter(([, v]) => v).map(([k, v]) => `<span class="chip ${v < 0 ? "neg" : ""}" style="--c:var(--el-${k})" data-tip="Résistance ${ELEMENTS[k].name} : ${v} %">${v > 0 ? "+" : ""}${v}%</span>`).join("");

/* ---------- carte de héros (v2.6) ---------- */
const EL_ICON = { t: "fo", f: "ine", e: "cha", a: "age", n: "vit" };
function heroCard(c, size = "", opts = {}) {
  const st = E.charStats(S, c); const el = E.domEl(st); const fi = E.frameIdx(c.lvl); const C = CLASSES[c.cls];
  const rad = E.radiantWorn(S, c); const orn = c.orn && E.ornUnlocked(S, c.orn) ? c.orn : null;
  const need = E.xpNeed(c.lvl);
  const stats3 = size === "big" ? [["vit", st.hpMax], [buildMain(c), st[buildMain(c)]], ["pa", st.pa], ["pui", st.pui], ["cri", st.cri + "%"], ["pp", st.pp]] : [["vit", st.hpMax], [buildMain(c), st[buildMain(c)]], ["pa", st.pa]];
  let ornHtml = "", ornCls = "";
  if (orn === "ailes" && S.align) { const r = E.alignRankIdx(S); ornCls = `o-ailes side-${S.align.side}${c.wing ? " wing-" + c.wing : ""}`; const w = wingSVG(S.align.side); ornHtml = `<img class="orn badge" src="assets/i/${E.ALIGN[S.align.side].badge}.png" alt="">${w.replace('class="orn wing"', 'class="orn wing l"')}${w.replace('class="orn wing"', 'class="orn wing r"')}`; opts.ws = (0.7 + r * 0.12).toFixed(2); }
  else if (orn === "couronne") ornHtml = `<span class="orn crown">👑</span>`;
  else if (orn === "lauriers") ornHtml = `<span class="orn laurel l">🌿</span><span class="orn laurel r">🌿</span>`;
  else if (orn === "heros") ornHtml = `<span class="orn crown">🎖</span>`;
  else if (orn === "avis") ornHtml = `<span class="orn seal">📜</span>`;
  else if (orn === "almanax") ornHtml = `<span class="orn seal">📅</span>`;
  else if (orn === "pionnier") ornHtml = `<span class="orn crown sprout">🌱</span>`;
  else if (orn === "phenix") ornHtml = `<span class="orn phx l">🔥</span><span class="orn phx r">🔥</span>`;
  else if (orn === "ame") ornHtml = `<span class="orn seal">💜</span>`;
  if (orn && orn !== "ailes") ornCls = "o-" + orn;
  const aura = E.renAura(c); if (aura) ornCls += " ren-" + aura; // 0.1.12 : aura de la Renaissance
  const job = c.job ? `<span class="jobtag">${IC("pioche")} ${h(D.GATHER_JOBS[c.job.job].name)}</span>` : "";
  return `<button class="hcard ${size} f${fi} ${rad ? "radiant" : ""} ${ornCls}" style="--el:${elVar(el)};--cc:${C.color}${opts.ws ? ";--ws:" + opts.ws : ""}" data-act="${opts.act || "selchar"}" data-id="${c.id}" data-tip="${h(`${c.name} · ${C.name} niv. ${c.lvl} · cadre ${E.FRAMES[fi]} · élément ${ELEMENTS[el].name}${orn ? " · ornement " + E.ORN[orn].name(S) : ""}${c.ren ? ` · Renaissance ${E.roman(c.ren)}` : ""}`)}">
    ${ornHtml}<div class="in"><div class="art">${lookImg(c, "hlook")}<span class="lv">${c.lvl}</span>${c.ren ? `<span class="renm" title="Renaissance ${E.roman(c.ren)}">${E.roman(c.ren)}</span><span class="rembers"><i></i><i></i><i></i><i></i></span>` : ""}<span class="elb"><img src="assets/c/${EL_ICON[el]}.png" alt=""></span>${job}${rad ? `<span class="rb">✦ ${rad > 1 ? rad + " " : ""}Rayonnant${rad > 1 ? "s" : ""}</span>` : ""}</div>
    <div class="nm"><b class="${c.ren ? "rname" : ""}">${h(c.name)}</b>${c.ren ? `<span class="rstar">✦ ${E.roman(c.ren)}</span>` : ""}<span class="ttl">${c.title ? h(c.title) : ""}</span></div><div class="cl">${C.name}${E.isSolo(S) && c.inTeam && !c.job ? " · solo" : ""}${c.ren ? ` · Renaissance ${E.roman(c.ren)}` : ""}</div>
    <div class="xpb"><i style="width:${pct(c.xp, need)}%"></i></div>
    <div class="st3">${stats3.map(([k, v]) => `<span>${sIco(k)}${typeof v === "number" ? fmt(v) : v}</span>`).join("")}</div></div><span class="tier">${E.FRAMES[fi]}</span></button>`;
}
/* ailes d'alignement (dessin générique : plumes claires / membranes sombres) */
function wingSVG(side) {
  if (side === "bonta") {
    const F = [[38, 52], [16, 58], [-6, 54], [-28, 46], [-48, 36]];
    return `<svg class="orn wing" viewBox="0 0 64 100" aria-hidden="true"><defs><linearGradient id="wgb" x1="0" x2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset=".55" stop-color="#e8f2ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
      <g fill="url(#wgb)" stroke="#4f8fe0" stroke-width="1.2">${F.map(([a, l]) => `<ellipse cx="${60 - l / 2}" cy="20" rx="${l / 2}" ry="7.5" transform="rotate(${a} 60 20)"/>`).join("")}</g><circle cx="58" cy="20" r="6" fill="#ffe08a" stroke="#c9962e"/></svg>`;
  }
  return `<svg class="orn wing" viewBox="0 0 64 100" aria-hidden="true"><defs><linearGradient id="wgr" x1="0" x2="1"><stop offset="0" stop-color="#3a0a0a"/><stop offset=".6" stop-color="#b3261e"/><stop offset="1" stop-color="#ff7a4a"/></linearGradient></defs>
    <path d="M60 20 L4 2 Q14 28 6 44 Q18 40 20 60 Q30 52 36 72 Q42 56 58 56 Z" fill="url(#wgr)" stroke="#1a0505" stroke-width="1.5"/>
    <path d="M60 20 L10 10 M60 20 L14 42 M60 20 L26 58 M60 20 L40 66" stroke="#1a0505" stroke-width="1.3" opacity=".7"/><circle cx="58" cy="20" r="6" fill="#ff9a4a" stroke="#5a1010"/></svg>`;
}
function fsGauge() {
  const team = E.team(S); const fs = E.freeSpirit(S); const solo = team.length === 1;
  const syn = E.synergy(S);
  const sub = team.length ? `${team.length} héros${syn ? ` · Synergie +${syn} %` : ""}` : "aucun héros ne chasse";
  return `<div class="fsg ${solo ? "solo" : fs ? "" : "zero"}" style="--p:${fs}" data-tip="Esprit Libre : plus l'équipe est petite, plus le bonus est grand (XP, butin, PV, dégâts). 1 héros : +100 % · 2 : +80 % · 3 : +60 % · 4 : +40 % · 5 : +25 % · 6 : +15 % · 7 : +5 % · 8 : 0 %. Synergie : +2 % de dégâts et d'XP par classe différente dans l'équipe (à partir de 2 héros).">
    <span class="flame"><i></i></span><span class="txt"><b>Esprit Libre +${fs} %</b><br><span class="xs muted">${sub}</span><span class="pips5">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<i class="${n <= team.length ? "off" : ""}"></i>`).join("")}</span></span></div>`;
}
function questAlert() { return !!(S.almanax && S.almanax.day !== E.dayKey() && E.almanax(S).qty <= (S.res[E.almanax(S).res] || 0)); }
const jobImg = (j) => `assets/j/${j}.png`;
/* ---------- index des ressources : sources et usages ---------- */
let RIDX = null;
function resIndex() {
  if (RIDX) return RIDX; const src = {}, use = {};
  const add = (o, k, v) => (o[k] = o[k] || []).push(v);
  for (const k in MONSTERS) { const m = MONSTERS[k]; m.drops.forEach(([r, p]) => add(src, r, { m: k, p })); }
  for (const j in GATHER_JOBS) GATHER_JOBS[j].items.forEach(([r, l]) => add(src, r, { job: j, lvl: l }));
  for (const t in ITEMS) { const T = ITEMS[t]; if (T.craft) T.craft.ing.forEach(([r, q]) => add(use, r, { tpl: t, q })); }
  for (const n in SPECIAL_CRAFTS) SPECIAL_CRAFTS[n].ing.forEach(([r, q]) => add(use, r, { special: n, q }));
  for (const j in GATHER_JOBS) for (let L = 1; L <= E.TOOL_MAX; L++) E.toolRecipe(j, L).ing.forEach(([r, q]) => add(use, r, { tool: j, L, q }));
  for (const r in src) src[r].sort((a, b) => (b.p || 0) - (a.p || 0));
  return (RIDX = { src, use });
}
const subOfMon = (k) => Object.values(E.SUBS).find((s) => s.monsters.includes(k)) || (Object.entries(DUNGEONS).find(([, d]) => d.boss === k || d.rooms.some((r) => r.mobs.includes(k))) || [])[0];
function bestSource(r) {
  const L = resIndex().src[r] || []; const g = L.find((x) => x.job); if (g) return `${GATHER_JOBS[g.job].name} niv. ${g.lvl}`;
  const m = L.find((x) => x.m); if (!m) return r === E.RARE_COMPONENT ? "trouvailles de récolte, boss et coffres" : "source inconnue";
  const s = subOfMon(m.m); return `${MONSTERS[m.m].name}${s ? " (" + (typeof s === "string" ? DUNGEONS[s].name : s.name) + ")" : ""} · ${E.resRate(m.p).toFixed(1).replace(".", ",")} %`;
}
function shopIng(e) { return E.shopIng(S, e); }
function shopName(e) { return E.shopName(S, e); }
/* 3.2.2 : bouton « suivre » (bande d'objectifs) */
function pinBtn(p, label) { const on = E.pinned(S, p); return `<button class="btn sm pinbtn ${on ? "on" : ""}" data-act="pin" data-p="${h(JSON.stringify(p))}" data-tip="${on ? "Ne plus suivre dans la bande d'objectifs" : "Suivre dans la bande d'objectifs, en haut de l'écran"}">${G("pin")}${label ? " " + h(label) : ""}</button>`; }
/* temps estimé avant d'avoir tous les ingrédients (3.2.2) */
function etaLine(ing) { const e = E.needEta(S, ing); if (e.stuck) return `<span class="eta no">${h(e.stuck.res)} : pas dans l'activité en cours${e.stuck.where ? ` · zone : ${h(e.stuck.where)}` : ""}</span>`; if (!e.sec) return ""; return `<span class="eta">${h(E.etaTxt(e.sec))}</span>`; }
function shopListHtml() {
  return S.shop.map((e, i) => { const ing = shopIng(e); const miss = ing.filter(([r, q]) => (S.res[r] || 0) < q); const ok = !miss.length && ing.length;
    return `<div class="qcard ${ok ? "cur" : ""}"><span class="qnum">${ok ? "✓" : G("cart")}</span><div class="grow"><b>${h(shopName(e))}</b>${ok ? ` <span class="tag good">tout est réuni</span>` : ` ${etaLine(ing)}`}${ingHtml(ing)}
      ${miss.length ? `<div class="xs muted" style="margin-top:4px">${miss.map(([r]) => `${h(r)} : ${h(bestSource(r))}`).join("<br>")}</div>` : ""}</div>${ok ? "" : pinBtn({ k: "shop", sk: e.k, id: e.id })}<button class="btn sm" data-act="shopdel" data-i="${i}" title="Retirer">✕</button></div>`; }).join("");
}

const ICONS = {
  metiers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-3 3-6-6 3-3z"/><path d="M11 7L3 15l3 3 8-8"/><path d="M6 21c0-2 2-3 4-3"/></svg>',
  forge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9h12a4 4 0 0 1-4 4H9l-1 4h8v3H6v-3l1-4H6a2 2 0 0 1-2-2V9z"/><path d="M16 9l4-2"/><path d="M18 3l1 2M21 4l-2 1"/></svg>',
  quests: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2h11v2a3 3 0 0 0 3 3"/><path d="M7 3a3 3 0 0 0-3 3v1h3"/><path d="M10 8h5M10 12h5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/></svg>',
  combat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20 14 10M14 4l6 6-3 1-3-3-1-3zM5 15l4 4M3 21l2-2"/></svg>',
  heroes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.6.2 4.3 2 4.8 4.6"/></svg>',
  inv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  ateliers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 21l8-8M14 4l6 6-4 4-6-6 4-4z"/><path d="M4 9h5M6.5 6.5v5"/></svg>',
};
/* 0.1.9.1 : barre en 4 familles (Accueil, Aventure, Équipe, Artisanat), leurs pages juste en dessous.
   Une page : [onglet, nom, icône, sous-page d'Accueil]. L'icône Héros est le symbole de classe du héros principal. */
const NAV = [
  { id: "base", n: "Accueil", ic: "logo", pages: [["home", "Accueil", "logo", "apercu"], ["home", "Havre-Sac", "havre", "havre"]] },
  { id: "adv", n: "Aventure", ic: "monde", pages: [["world", "Monde", "monde"], ["combat", "Combat", "combat"], ["quests", "Quêtes", "quetes"]] },
  { id: "team", n: "Équipe", ic: "dofus", pages: [["team", "Équipe", "dofus"], ["heroes", "Héros", null], ["inv", "Inventaire", "sac"], ["ren", "Renaissance", "phenix"]] },
  { id: "craft", n: "Artisanat", ic: "metiers", pages: [["metiers", "Métiers", "metiers"], ["forge", "Forgemagie", "forge"]] },
];
const famOf = (tab) => NAV.find((F) => F.pages.some((p) => p[0] === tab)) || NAV[0];
const mainHero = () => (S ? S.chars.find((c) => c.id === S.mainHero) || E.team(S)[0] || S.chars[0] : null);
const heroMed = () => { const c = mainHero(); return c ? `<i class="med halo" style="--cc:${CLASSES[c.cls].color}"><img src="${symImg(c.cls)}" alt=""></i>` : med("dofus"); };

/* ---------- décors de scène (SVG déterministe) ---------- */
const DECOS = {
  meadow: { day: { sky: ["#9fd8ff", "#e8f7ff"], far: "#a9dc8c", near: "#7cc35b", d: "clouds" }, night: { sky: ["#1b2550", "#3d4f86"], far: "#2f5141", near: "#25432f", d: "clouds" } },
  sky:    { day: { sky: ["#b8e2ff", "#fdf3ff"], far: "#c9ecb4", near: "#9fd685", d: "clouds" }, night: { sky: ["#1d1f4f", "#4a3f7d"], far: "#384f4a", near: "#2b3f37", d: "clouds" } },
  spirit: { day: { sky: ["#ffc98f", "#fff0d6"], far: "#d9b48a", near: "#b98d5f", d: "flames" }, night: { sky: ["#2a1530", "#5a2a3a"], far: "#3d2a2a", near: "#2a1d1d", d: "flames" } },
  lake:   { day: { sky: ["#a8dcff", "#e6f7ff"], far: "#7fc6e8", near: "#6bb85a", d: "waves" }, night: { sky: ["#101d40", "#24406b"], far: "#1d4561", near: "#22402a", d: "waves" } },
  forest: { day: { sky: ["#bfe7c0", "#effbe6"], far: "#5f9f55", near: "#3f7f3a", d: "trees" }, night: { sky: ["#0f2218", "#22412c"], far: "#1d3a24", near: "#142a1a", d: "trees" } },
  mine:   { day: { sky: ["#7a5a3a", "#c49a6a"], far: "#5e4630", near: "#463322", d: "crystals" }, night: { sky: ["#1a120c", "#3a2618"], far: "#2a1e14", near: "#1d150e", d: "crystals" } },
  grave:  { day: { sky: ["#b892e0", "#f6d2c0"], far: "#7c6a90", near: "#5e4f70", d: "tombs" }, night: { sky: ["#0f0c22", "#2b1f48"], far: "#2a2240", near: "#1d1730", d: "tombs" } },
  city:   { day: { sky: ["#9fd2ff", "#fff1d6"], far: "#d8c2a0", near: "#a9c77a", d: "houses" }, night: { sky: ["#16203f", "#3e3a5e"], far: "#3a3328", near: "#26331f", d: "houses" } },
  cave:   { day: { sky: ["#4d4256", "#8a7a8f"], far: "#3e3446", near: "#2c2533", d: "crystals" }, night: { sky: ["#120e16", "#2a2230"], far: "#1e1824", near: "#14101a", d: "crystals" } },
  wheat:  { day: { sky: ["#ffd77a", "#fff4d2"], far: "#e9c45a", near: "#d4a33a", d: "wheat" }, night: { sky: ["#3a2650", "#6b4161"], far: "#5d4a2a", near: "#4a3a20", d: "wheat" } },
  beach:  { day: { sky: ["#8fe3ff", "#fff6d8"], far: "#4fc3d9", near: "#f2d896", d: "waves" }, night: { sky: ["#0f2040", "#2c4f74"], far: "#1d4d63", near: "#5c5238", d: "waves" } },
  quarry: { day: { sky: ["#ffd9a8", "#fff3e0"], far: "#c99a6b", near: "#a87a4f", d: "rocks" }, night: { sky: ["#2a1d30", "#4f3a45"], far: "#4a3a2e", near: "#352a21", d: "rocks" } },
  sewer:  { day: { sky: ["#5d6b55", "#93a283"], far: "#4a5643", near: "#3a4434", d: "pipes" }, night: { sky: ["#11160f", "#273022"], far: "#1f281b", near: "#161d13", d: "pipes" } },
  dungeon:{ day: { sky: ["#6e2420", "#c0592f"], far: "#4a2a24", near: "#33201c", d: "pillars" }, night: { sky: ["#1e0b0d", "#4a1715"], far: "#2a1513", near: "#1a0d0c", d: "pillars" } },
};
const isDark = () => true; // thème unique « Krosmoz doré »
/* 3.3.0 : un décor par donjon (palette + motif), même rendu de jour et de nuit */
const DGD = (sky, far, near, d) => { const v = { sky, far, near, d }; return { day: v, night: v }; };
Object.assign(DECOS, {
  dg_crypte:   DGD(["#1b1428", "#3e2f55"], "#2e2440", "#221a30", "tombs"),
  dg_grange:   DGD(["#2a2050", "#c98a4a"], "#8a6a30", "#6a4f22", "barn"),
  dg_sable:    DGD(["#2d5578", "#e8c690"], "#c9a768", "#a8874e", "castle"),
  dg_bouftou:  DGD(["#1f3a66", "#7fb0d8"], "#4f8a3c", "#3c6e2c", "fence"),
  dg_kankre:   DGD(["#1a1612", "#4a3a2a"], "#3a2e22", "#2a2018", "rocks"),
  dg_tofus:    DGD(["#30406e", "#e6c56a"], "#7aa84a", "#5a8a36", "feathers"),
  dg_squel:    DGD(["#1d1530", "#4a3466"], "#33264a", "#251b38", "tombs"),
  dg_scara:    DGD(["#1e3a1c", "#5e8a3a"], "#2f5a26", "#22441c", "leaves"),
  dg_bworks:   DGD(["#3a120c", "#a8442a"], "#5a2a1c", "#3e1c12", "rocks"),
  dg_kwakwa:   DGD(["#1c2e4a", "#7aa0c8"], "#4a5a6a", "#36424e", "crystals"),
  dg_blops:    DGD(["#1a2a3a", "#5a8a6a"], "#2f5a3a", "#22442c", "hedges"),
  dg_labo:     DGD(["#1a1f24", "#4a5a5e"], "#2e383c", "#20282c", "pipes"),
  dg_pitons:   DGD(["#6a3f2a", "#d99a62"], "#7a5238", "#5a3a26", "spikes"),
  dg_chouque:  DGD(["#1e3550", "#6a8fb0"], "#2f5f86", "#6b4a2a", "masts"),
  dg_riktus:   DGD(["#24143a", "#7a3a6a"], "#4a2a3a", "#3a1f2c", "tent"),
  dg_ancestral:DGD(["#14241a", "#3a5a3a"], "#1f3a26", "#162c1c", "trees"),
  dg_koulosse: DGD(["#141e2e", "#3a5a7a"], "#2a3a52", "#1e2a3c", "crystals"),
  dg_meulou:   DGD(["#1a2436", "#6a7a96"], "#3a4a5e", "#2a3646", "trees"),
  dg_moon:     DGD(["#10281e", "#3f7a4a"], "#24502e", "#1a3c22", "leaves"),
  dg_dragon:   DGD(["#2a0e0a", "#8a2a1a"], "#4a1c12", "#34130c", "flames"),
  dg_kharno:   DGD(["#160f1e", "#3a2a4a"], "#2a2036", "#1e1828", "pillars"),
  dg_corbac:   DGD(["#1a1410", "#4a3a2a"], "#3a2c20", "#2a2016", "books"),
  dg_rasboul:  DGD(["#0e1e2e", "#2a5a7a"], "#1e3a52", "#162c3e", "waves"),
  dg_bambou:   DGD(["#14281a", "#5a8a4a"], "#2f5a2a", "#22441e", "bamboo"),
  dg_mino:     DGD(["#1a1e2a", "#5a6a4a"], "#3a4a2a", "#2a361e", "hedges"),
  dg_croca:    DGD(["#101a2a", "#5a7aa0"], "#2a3e5a", "#1e2e44", "crystals"),
  dg_serre:    DGD(["#14262a", "#5a9a8a"], "#2f5a4a", "#22443a", "glass"),
  dg_skeunk:   DGD(["#1e0e1e", "#8a3a1a"], "#3a1e1e", "#2a1414", "tombs"),
});
const DG_DECO = { crypte_kardorim: "dg_crypte", grange_tournesol: "dg_grange", chateau_ensable: "dg_sable", cour_bouftou_royal: "dg_bouftou", cache_kankreblath: "dg_kankre", donjon_tofus: "dg_tofus", donjon_squelettes: "dg_squel", donjon_scarafeuilles: "dg_scara", donjon_bworks: "dg_bworks", nid_kwakwa: "dg_kwakwa", clos_blops: "dg_blops", labo_brumen: "dg_labo", pitons_craqueleur: "dg_pitons", bateau_chouque: "dg_chouque", chapiteau_riktus: "dg_riktus", domaine_ancestral: "dg_ancestral", caverne_koulosse: "dg_koulosse", taniere_meulou: "dg_meulou", arbre_moon: "dg_moon", antre_dragon_cochon: "dg_dragon", repaire_kharnozor: "dg_kharno", biblio_corbac: "dg_corbac", goulet_rasboul: "dg_rasboul", bambusaie_damadrya: "dg_bambou", labyrinthe_minotoror: "dg_mino", antre_crocabulia: "dg_croca", serre_royalmouth: "dg_serre", repaire_skeunk: "dg_skeunk" };
const dgDeco = (did) => DG_DECO[did] || "dungeon";
/* météo des zones de chasse : selon le décor, la neige pour les zones glacées */
const subWeather = (sid) => { const sb = E.SUBS[sid]; if (!sb) return ""; if (/givre|gel[ée]e|glace|neige|Frigost/i.test(sb.name)) return "snow";
  return { forest: "rain", meadow: "flies", wheat: "flies", sky: "flies", beach: "sand", grave: "mist", quarry: "dust", lake: "flies", city: "", cave: "", mine: "", sewer: "", spirit: "" }[sb.deco] || ""; };
const decoFx = () => S && S.settings.decofx !== false && !S.settings.reduced;
const seeded = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let svgId = 0;
function sceneSVG(deco, H, seed, o = {}) {
  const P = (DECOS[deco] || DECOS.meadow)[isDark() ? "night" : "day"]; const W = 600; const R = seeded(seed + deco);
  const r = (a, b) => a + R() * (b - a); const id = "g" + (svgId++);
  let back = "", front = "";
  const k = P.d, dark = isDark();
  if (k === "clouds") for (let i = 0; i < 5; i++) { const x = r(0, W - 60), y = r(8, H * 0.3), s = r(0.6, 1.2); back += `<g opacity="${dark ? 0.22 : 0.9}" fill="#fff" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="30" cy="16" rx="30" ry="12"/><ellipse cx="52" cy="10" rx="20" ry="11"/><ellipse cx="14" cy="10" rx="14" ry="9"/></g>`; }
  if (k === "wheat") for (let i = 0; i < 50; i++) { const x = r(0, W), y = H * 0.66 + r(-6, 10); front += `<path d="M${x} ${y + 40} q2 -22 0 -40" stroke="${P.near}" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="3.5" ry="8" fill="${dark ? "#8a6f3a" : "#f3d27a"}"/>`; }
  if (k === "tombs") for (let i = 0; i < 7; i++) { const x = r(10, W - 30), y = H * 0.62 + r(-8, 8), s = r(0.7, 1.1); front += `<g transform="translate(${x} ${y}) scale(${s})" fill="${P.far}"><path d="M0 40 V12 a14 14 0 0 1 28 0 V40Z"/><rect x="11" y="6" width="6" height="22" fill="${dark ? "#3c3156" : "#a896bd"}"/><rect x="6" y="12" width="16" height="5" fill="${dark ? "#3c3156" : "#a896bd"}"/></g>`; }
  if (k === "pillars") for (let i = 0; i < 5; i++) { const x = i * (W / 4.2) + r(-10, 10); back += `<rect x="${x}" y="24" width="34" height="${H}" fill="${P.far}"/><rect x="${x - 6}" y="18" width="46" height="12" fill="${P.near}"/><circle cx="${x + 17}" cy="74" r="7" fill="#ffb347" opacity=".9"/><circle cx="${x + 17}" cy="74" r="22" fill="#ffb347" opacity=".18"/>`; }
  if (k === "trees") for (let i = 0; i < 9; i++) { const x = r(-10, W), y = H * r(0.35, 0.55), s = r(0.7, 1.3); back += `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="10" width="8" height="40" fill="${dark ? "#2a1d12" : "#6b4a2a"}"/><circle cx="0" cy="0" r="22" fill="${P.far}"/><circle cx="-14" cy="10" r="15" fill="${P.far}"/><circle cx="14" cy="10" r="15" fill="${P.near}"/></g>`; }
  if (k === "waves") for (let i = 0; i < 4; i++) { const y = H * 0.6 + i * 9; let d = `M0 ${y}`; for (let x = 0; x <= W; x += 30) d += ` q15 ${i % 2 ? 5 : -5} 30 0`; back += `<path d="${d}" stroke="#fff" stroke-opacity="${dark ? 0.15 : 0.45}" stroke-width="2" fill="none"/>`; }
  if (k === "rocks") for (let i = 0; i < 8; i++) { const x = r(0, W), y = H * r(0.5, 0.7), s = r(0.6, 1.4); back += `<path transform="translate(${x} ${y}) scale(${s})" d="M-24 30 L-16 -6 L4 -18 L22 -2 L28 30Z" fill="${i % 2 ? P.far : P.near}" stroke="rgba(0,0,0,.15)"/>`; }
  if (k === "crystals") for (let i = 0; i < 9; i++) { const x = r(0, W), y = H * r(0.5, 0.75), s = r(0.5, 1.2), c = ["#9b7bff", "#5fd3ff", "#ff9bd8"][i % 3]; back += `<g transform="translate(${x} ${y}) scale(${s})"><circle r="26" fill="${c}" opacity=".15"/><path d="M0 -26 L9 0 L0 20 L-9 0Z" fill="${c}" opacity=".85"/></g>`; }
  if (k === "houses") for (let i = 0; i < 6; i++) { const x = i * (W / 5.5) + r(-10, 10), w = r(50, 80), hh = r(40, 70), y = H * 0.62 - hh; back += `<rect x="${x}" y="${y}" width="${w}" height="${hh + 20}" fill="${dark ? "#4a3e30" : "#efe0c4"}" stroke="rgba(0,0,0,.15)"/><path d="M${x - 6} ${y} L${x + w / 2} ${y - 26} L${x + w + 6} ${y}Z" fill="${dark ? "#5a2a20" : "#c4583a"}"/><rect x="${x + w / 2 - 7}" y="${y + hh - 8}" width="14" height="28" fill="${dark ? "#2a2117" : "#8a5d33"}"/>${dark ? `<rect x="${x + 8}" y="${y + 10}" width="10" height="10" fill="#ffd27a" opacity=".85"/>` : ""}`; }
  if (k === "flames") for (let i = 0; i < 8; i++) { const x = r(10, W - 10), y = H * r(0.2, 0.55), s = r(0.6, 1.2), c = ["#ffb347", "#ff6b5e", "#8fd0ff", "#ffe08a"][i % 4]; back += `<g transform="translate(${x} ${y}) scale(${s})"><circle r="20" fill="${c}" opacity=".18"/><path d="M0 -16 C8 -6 9 4 0 10 C-9 4 -8 -6 0 -16Z" fill="${c}" opacity=".9"/></g>`; }
  if (k === "pipes") for (let i = 0; i < 5; i++) { const x = r(0, W - 40), y = H * r(0.2, 0.5); back += `<rect x="${x}" y="${y}" width="${r(60, 140)}" height="14" rx="6" fill="${P.near}" stroke="rgba(0,0,0,.2)"/><circle cx="${x}" cy="${y + 7}" r="11" fill="${P.far}" stroke="rgba(0,0,0,.25)"/>`; }
 if (k === "fence") { for (let x = 10; x < W; x += 44) back += `<rect x="${x}" y="${H * 0.46}" width="7" height="${H * 0.2}" fill="#6b4524"/>`; back += `<rect x="0" y="${H * 0.5}" width="${W}" height="6" fill="#8a5d33"/><rect x="0" y="${H * 0.58}" width="${W}" height="6" fill="#8a5d33"/>`; for (let i = 0; i < 12; i++) front += `<g fill="#f3ecdc" opacity=".85" transform="translate(${r(0, W)} ${H * r(0.84, 0.97)})"><circle r="5"/><circle cx="6" cy="1" r="4"/><circle cx="-5" cy="2" r="4"/></g>`; }
  if (k === "barn") { const x = W * 0.62; back += `<rect x="${x}" y="${H * 0.28}" width="150" height="${H * 0.4}" fill="#7a2a1e" stroke="rgba(0,0,0,.3)"/><path d="M${x - 12} ${H * 0.3} L${x + 75} ${H * 0.12} L${x + 162} ${H * 0.3}Z" fill="#4a1a12"/><rect x="${x + 55}" y="${H * 0.44}" width="40" height="${H * 0.24}" fill="#3a140e"/>`; for (let i = 0; i < 6; i++) { const cx = r(20, W * 0.55), cy = H * r(0.2, 0.45); back += `<g transform="translate(${cx} ${cy})"><circle r="14" fill="#f2c230"/><circle r="6" fill="#5a3a12"/></g><rect x="${cx - 1.5}" y="${cy + 12}" width="3" height="${H * 0.6 - cy}" fill="#3f6b2a"/>`; } }
  if (k === "castle") for (let i = 0; i < 3; i++) { const x = 40 + i * 200 + r(-20, 20), w = 90, hh = H * r(0.25, 0.38), y = H * 0.56 - hh; back += `<rect x="${x}" y="${y}" width="${w}" height="${hh + 30}" fill="#d9b878" stroke="rgba(0,0,0,.18)"/>`; for (let j = 0; j < 5; j++) back += `<rect x="${x + j * 20}" y="${y - 12}" width="12" height="12" fill="#d9b878"/>`; back += `<rect x="${x + 38}" y="${y + hh - 20}" width="16" height="30" rx="8" fill="#6a4a22"/>`; }
  if (k === "feathers") for (let i = 0; i < 18; i++) { const x = r(0, W), y = H * r(0.15, 0.9); front += `<path transform="translate(${x} ${y}) rotate(${r(0, 360)})" d="M0 0 q6 -10 0 -20 q-6 10 0 20z" fill="#f6e08a" opacity=".55"/>`; }
  if (k === "leaves") for (let i = 0; i < 7; i++) { const x = r(0, W), y = H * r(0.38, 0.62), sc = r(1.2, 2.2); back += `<path transform="translate(${x} ${y}) scale(${sc}) rotate(${r(-35, 35)})" d="M0 0 C 18 -22 46 -18 56 0 C 46 18 18 22 0 0Z" fill="${i % 2 ? "#4c8f2e" : "#3a7524"}" stroke="#1c3a12" stroke-width="1.5"/>`; }
  if (k === "hedges") for (let i = 0; i < 6; i++) { const x = i * (W / 5) + r(-14, 14); back += `<rect x="${x}" y="${H * 0.34}" width="${r(70, 110)}" height="${H * 0.34}" rx="10" fill="${i % 2 ? P.far : P.near}" stroke="rgba(0,0,0,.25)"/>`; }
  if (k === "spikes") for (let i = 0; i < 6; i++) { const x = r(0, W), w = r(40, 80); back += `<path d="M${x - w} ${H * 0.7} L${x - w * 0.2} ${H * r(0.1, 0.3)} L${x + w * 0.2} ${H * r(0.1, 0.3)} L${x + w} ${H * 0.7}Z" fill="${i % 2 ? "#6a4228" : "#4e3020"}" stroke="rgba(0,0,0,.3)"/>`; }
  if (k === "masts") { back += `<path d="M0 ${H * 0.52} Q 150 ${H * 0.47} 300 ${H * 0.52} T 600 ${H * 0.52} V ${H * 0.66} H0Z" fill="#2f5f86"/>`; for (const x of [150, 430]) back += `<rect x="${x}" y="${H * 0.02}" width="9" height="${H * 0.66}" fill="#3a2410"/><rect x="${x - 50}" y="${H * 0.1}" width="110" height="5" fill="#3a2410"/><path d="M${x + 9} ${H * 0.12} q70 ${H * 0.15} 0 ${H * 0.34}z" fill="#e9dcbc"/>`; }
  if (k === "tent") { back += `<path d="M${W * 0.15} ${H * 0.66} L${W * 0.5} ${H * 0.05} L${W * 0.85} ${H * 0.66}Z" fill="#7a1e3a"/>`; for (let i = 0; i < 6; i++) back += `<path d="M${W * 0.5} ${H * 0.05} L${W * (0.15 + i * 0.14)} ${H * 0.66} L${W * (0.22 + i * 0.14)} ${H * 0.66}Z" fill="#e8d2a8" opacity=".85"/>`; for (let i = 0; i < 10; i++) back += `<circle cx="${r(0, W)}" cy="${H * r(0.05, 0.3)}" r="3" fill="${["#ffd84d", "#ff6b9a", "#6bd0ff"][i % 3]}"/>`; }
  if (k === "books") for (let i = 0; i < 4; i++) { const x = i * (W / 4) + 6, w = W / 4 - 12; back += `<rect x="${x}" y="${H * 0.08}" width="${w}" height="${H * 0.6}" fill="#3a2414" stroke="rgba(0,0,0,.4)"/>`; for (let sh = 0; sh < 4; sh++) { const y = H * (0.12 + sh * 0.14); let bx = x + 4; while (bx < x + w - 8) { const bw = r(5, 10); back += `<rect x="${bx}" y="${y}" width="${bw}" height="${H * 0.11}" fill="${["#7a2a1e", "#2a4a6a", "#4a6a2a", "#8a6a2a", "#5a2a5a"][Math.floor(r(0, 5))]}"/>`; bx += bw + 1; } } }
  if (k === "bamboo") for (let i = 0; i < 16; i++) { const x = r(0, W); back += `<rect x="${x}" y="0" width="${r(6, 12)}" height="${H * 0.7}" fill="${i % 2 ? "#6a9a3a" : "#4f7a2a"}"/>`; for (let j = 1; j < 5; j++) back += `<rect x="${x - 1}" y="${H * 0.14 * j}" width="14" height="3" fill="#2f4a1a"/>`; }
  if (k === "glass") { for (let x = 0; x <= W; x += 60) back += `<rect x="${x}" y="0" width="4" height="${H * 0.7}" fill="#9ad0c0" opacity=".5"/>`; for (let y = 0; y < H * 0.7; y += 40) back += `<rect x="0" y="${y}" width="${W}" height="3" fill="#9ad0c0" opacity=".4"/>`; for (let i = 0; i < 8; i++) back += `<circle cx="${r(0, W)}" cy="${H * r(0.4, 0.65)}" r="${r(14, 30)}" fill="${["#3f8a3a", "#6aa83a", "#2f6a4a"][i % 3]}"/>`; }
  const stars = dark && k !== "pillars" && k !== "mine" && k !== "cave" && k !== "sewer" ? Array.from({ length: 26 }, () => `<circle cx="${r(0, W)}" cy="${r(0, H * 0.45)}" r="${r(0.3, 1.6)}" fill="#fff" opacity="${r(0.2, 0.9)}"/>`).join("") : "";
  return `<svg class="bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${id})"/>${stars}${back}
    <path d="M0 ${H * 0.64} Q ${W * 0.25} ${H * 0.5} ${W * 0.5} ${H * 0.62} T ${W} ${H * 0.57} V ${H} H0Z" fill="${P.far}"/>
    ${k === "tombs" ? front : ""}
    <path d="M0 ${H * 0.8} Q ${W * 0.3} ${H * 0.7} ${W * 0.6} ${H * 0.8} T ${W} ${H * 0.76} V ${H} H0Z" fill="${P.near}"/>
    ${k === "wheat" ? front : ""}${["fence", "feathers"].includes(k) ? front : ""}${o.fx ? sceneFx(o.fx, W, H, r) : ""}${o.boss ? `<rect width="${W}" height="${H}" fill="#0a0504" opacity=".42"/>${[40, W - 40].map((x) => `<rect x="${x - 3}" y="${H * 0.36}" width="6" height="${H * 0.3}" fill="#3a2414"/><circle cx="${x}" cy="${H * 0.34}" r="7" fill="#ffb347">${o.anim ? `<animate attributeName="r" values="6;8;6" dur=".8s" repeatCount="indefinite"/>` : ""}</circle><circle cx="${x}" cy="${H * 0.34}" r="30" fill="#ffb347" opacity=".2"/>`).join("")}` : ""}
  </svg>`;
}
/* météo et premier plan (3.3.0) : animations SVG légères, coupées par l'option « Effets de décor » */
function sceneFx(fx, W, H, r) {
  let o = "";
  if (fx === "rain") for (let i = 0; i < 60; i++) { const x = r(0, W + 40), y = r(-H, H), d = r(0.6, 1.1); o += `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 14}" stroke="#bfe0ff" stroke-opacity=".5" stroke-width="1.3"><animateTransform attributeName="transform" type="translate" from="0 0" to="-20 ${H * 1.3}" dur="${d.toFixed(2)}s" begin="-${r(0, d).toFixed(2)}s" repeatCount="indefinite"/></line>`; }
  if (fx === "snow") for (let i = 0; i < 45; i++) { const x = r(0, W), d = r(4, 8); o += `<circle cx="${x}" cy="${r(-H, 0)}" r="${r(1, 2.6).toFixed(1)}" fill="#fff" opacity=".85"><animateTransform attributeName="transform" type="translate" values="0 0; 14 ${H * 0.7}; -6 ${H * 1.4}" dur="${d.toFixed(2)}s" begin="-${r(0, d).toFixed(2)}s" repeatCount="indefinite"/></circle>`; }
  if (fx === "flies") for (let i = 0; i < 16; i++) { const x = r(0, W), y = H * r(0.3, 0.8), d = r(2, 5); o += `<circle cx="${x}" cy="${y}" r="2.3" fill="#f6ff8a"><animate attributeName="opacity" values="0;1;0" dur="${d.toFixed(2)}s" begin="-${r(0, d).toFixed(2)}s" repeatCount="indefinite"/></circle>`; }
  if (fx === "sand" || fx === "dust") for (let i = 0; i < 24; i++) { const y = H * r(0.62, 0.97), d = r(1.6, 3.6); o += `<line x1="${r(0, W)}" y1="${y}" x2="${r(0, W) + 10}" y2="${y}" stroke="${fx === "sand" ? "#ffe6b0" : "#d9b48a"}" stroke-opacity=".55" stroke-width="1.4"><animateTransform attributeName="transform" type="translate" from="${-W} 0" to="${W} 0" dur="${d.toFixed(2)}s" begin="-${r(0, d).toFixed(2)}s" repeatCount="indefinite"/></line>`; }
  if (fx === "mist") o += `<rect x="0" y="${H * 0.5}" width="${W}" height="${H * 0.5}" fill="#b28cff" opacity=".12"><animate attributeName="opacity" values=".06;.18;.06" dur="6s" repeatCount="indefinite"/></rect>`;
  for (let i = 0; i < 22; i++) { const x = r(0, W); o += `<path d="M${x} ${H} q3 -20 -2 -32 M${x + 4} ${H} q4 -16 8 -25" stroke="rgba(8,20,10,.85)" stroke-width="3" fill="none"/>`; }
  return o;
}
const subDeco = (sid) => (E.SUBS[sid] ? E.SUBS[sid].deco : "meadow");

/* ---------- zones : informations dérivées ---------- */
function subResources(sub) {
  const map = new Map();
  sub.monsters.forEach((k) => MONSTERS[k].drops.forEach(([n, p]) => { const e = map.get(n) || { n, p: 0, from: 0 }; e.p = Math.max(e.p, p); e.from++; map.set(n, e); }));
  return [...map.values()].sort((a, b) => b.p - a.p);
}
function subItems(sub) {
  const map = new Map();
  sub.monsters.forEach((k) => MONSTERS[k].items.forEach(([t, p]) => { if (!ITEMS[t]) return; const e = map.get(t) || { t, p: 0 }; e.p = Math.max(e.p, p); map.set(t, e); }));
  return [...map.values()].sort((a, b) => ITEMS[a.t].lvl - ITEMS[b.t].lvl);
}

/* ---------- navigation & bandeau ---------- */
function renderNav() {
  if (!S) { $("#nav").innerHTML = ""; $("#subnav").innerHTML = ""; return; }
  const F = famOf(ui.tab); const fight = ui.tab === "combat";
  ui.famLast = ui.famLast || {}; if (!fight) ui.famLast[F.id] = [ui.tab, ui.home];
  const nAl = teamAlerts().length; const qd = questAlert();
  const dot = (on, n) => (n ? `<span class="navcnt">${n}</span>` : on ? '<span class="navdot"></span>' : "");
  const fam = (G) => { const l = ui.famLast[G.id] || [G.pages[0][0], G.pages[0][3]];
    return `<button data-tab="${l[0]}" ${l[0] === "home" ? `data-home="${l[1] || "apercu"}"` : ""} data-fam="${G.id}" ${G === F ? 'aria-current="page"' : ""}>${med(G.ic)}<span>${G.n}</span>${dot(G.id === "adv" && qd, G.id === "team" ? nAl : 0)}</button>`; };
  $("#nav").className = "main fams" + (fight ? " infight" : "");
  $("#nav").innerHTML = fam(NAV[0]) + fam(NAV[1]) + `<button class="navfight" data-tab="combat" ${fight ? 'aria-current="page"' : ""}>${med("combat")}<span>Combat</span></button>` + fam(NAV[2]) + fam(NAV[3]) + `<span id="navlive">${navLiveHtml()}</span>`;
  const cur = ui.tab === "home" ? (ui.home === "havre" ? "havre" : "apercu") : null;
  $("#subnav").innerHTML = F.pages.map(([tab, n, ic, hm]) => { const on = tab === ui.tab && (!hm || hm === cur);
    return `<button data-tab="${tab}" ${hm ? `data-home="${hm}"` : ""} ${on ? 'aria-current="page"' : ""}>${ic ? med(ic) : heroMed()}<span>${n}</span>${dot(tab === "quests" && qd, tab === "team" ? nAl : 0)}</button>`; }).join("");
}
/* cadre « Combat en cours » (PC) : donjon et salle, ou zone de chasse ; rafraîchi par la boucle */
function navLiveHtml() {
  if (!S || ui.tab === "combat" || !E.team(S).length) return "";
  const dg = S.dungeon && DUNGEONS[S.dungeon.id];
  if (!dg && !(S.hunting && S.sub)) return "";
  const where = dg ? dg.name : E.SUBS[S.sub].name;
  const sub = dg ? `salle ${Math.min(S.dungeon.room + 1, dg.rooms.length + 1)}/${dg.rooms.length + 1}${S.dungeon.stasis ? ` · stasis ${S.dungeon.stasis}` : ""}` : "chasse en cours";
  return `<button class="navlive" data-tab="combat" title="Voir le combat"><span class="pulse"></span><span class="tx"><b>Combat en cours</b><small>${h(where)} · ${sub}</small></span></button>`;
}
function updNavLive() { const el = $("#navlive"); if (!el) return; const v = navLiveHtml(); if (el.dataset.v !== v) { el.innerHTML = v; el.dataset.v = v; } }
function statusHtml() {
  if (!S) return "";
  const team = E.team(S);
  const where = S.dungeon ? DUNGEONS[S.dungeon.id].name : S.hunting && S.sub ? E.SUBS[S.sub].name : "Au repos";
  const kills = Object.values(S.bestiary).reduce((a, b) => a + b, 0);
  const xpb = E.boostPct(S, "xp");
  return `<button class="brand" data-tab="home"><img class="blogo" src="assets/ui/logo.webp" alt="">idlus</button>
    <span class="it"><span class="coin"></span><b class="num" id="stKamas">${fmt(S.kamas)}</b><span class="hide-sm">kamas</span></span>
    <span class="it"><span class="dot ${(S.hunting && E.team(S).length) || S.dungeon ? "" : "off"}"></span><b>${team.length}</b>/8 <span class="hide-sm">héros</span></span>
    <span class="it hide-sm">${IC("monde")} <span>${h(where)}</span></span>${(S.res[E.POUSSIERE] || 0) > 0 ? `<span class="it hide-sm" data-tip="Poussières de stasis">${IC("poussiere")}<b class="num">${fmt(S.res[E.POUSSIERE])}</b></span>` : ""}
    ${(S.chalStreak || 0) > 1 ? `<span class="it flame" data-tip="Série de combats où tous les challenges sont réussis : +0,5 % d'XP et de butin par combat (max +5 %). Elle retombe à zéro au premier échec.">${G("flame")} <b>×${S.chalStreak}</b> <span class="hide-sm">+${Math.min(E.CHAL_STREAK_MAX, (S.chalStreak - 1) * E.CHAL_STREAK_STEP)} %</span></span>` : ""}
    ${activeBoosts().length ? `<span class="it boostchip" data-tip="${h(activeBoosts().map((b) => `${b.name} : ${b.txt} (${dur(b.left)})`).join(" · "))}">${activeBoosts().map((b) => emo(b.icon)).join("")} <span id="stBoost">${dur(Math.min(...activeBoosts().map((b) => b.left)))}</span></span>` : ""}
    ${S.almanax && S.almanax.day === E.dayKey() ? `<span class="it boostchip hide-sm" data-tip="Bonus de l'Almanax jusqu'à minuit">${IC("almanax")} Almanax +${S.almanax.pct} %</span>` : ""}
    <span class="it hide-sm">${IC("combat")} <b class="num" id="stKills">${fmt(kills)}</b> tués</span>
    ${S.seenVersion !== GAME_VERSION ? `<button class="updpill" data-act="changelog" data-tip="Voir les nouveautés de la mise à jour">${G("sparkle")}<span class="hide-sm"> ${h(GAME_VERSION)} · nouveautés</span></button>` : ""}
    <button class="ic-btn" data-act="options" title="Options" aria-label="Options">${G("gear")}</button>`;
}
function renderStatus() { const el = $("#status"); el.innerHTML = statusHtml(); el.style.display = S ? "" : "none"; renderObjs(); requestAnimationFrame(() => document.documentElement.style.setProperty("--sth", Math.max(0, el.getBoundingClientRect().bottom) + "px")); }
/* ---------- 3.2.2 : bande d'objectifs épinglés ---------- */
const PIN_ICO = { quest: "quetes", bounty: "combat", align: "ailes", shop: null, lvl: null, ach: "trophee" };
function objsHtml() {
  if (!S) return ""; const pins = E.pins(S); if (!pins.length) return "";
  return pins.map((p) => { const i = E.pinInfo(S, p); if (!i) return ""; const key = E.pinKey(p); const done = p.done || i.done;
    const ico = PIN_ICO[i.k] ? IC(PIN_ICO[i.k]) : i.k === "shop" ? G("cart") : G("up");
    return `<span class="obj ${p.auto ? "auto" : ""} ${done ? "done" : ""}" data-act="pingo" data-key="${h(key)}" data-tip="${h(`${i.label} · ${done ? "objectif atteint" : i.txt}${p.auto ? " · la quête principale est toujours suivie" : ""}`)}">${ico}<span class="lbl">${h(i.label)}</span><span class="mini"><i style="width:${done ? 100 : pct(i.a, i.b)}%"></i></span><span class="pt num">${done ? "✓" : h(i.txt)}</span>${p.auto ? "" : `<span class="x" data-act="unpin" data-key="${h(key)}" title="Ne plus suivre">×</span>`}</span>`; }).join("") + `<span class="cnt">${pins.length}/${E.MAX_PINS}</span>`;
}
function renderObjs() { const el = $("#objs"); if (!el) return; const html = objsHtml(); if (el.dataset.k === html) return; el.dataset.k = html; el.innerHTML = html; el.style.display = html ? "" : "none"; }
const findPin = (key) => E.pins(S).find((p) => E.pinKey(p) === key);
/* un objectif atteint reste affiché en vert jusqu'au prochain changement d'écran */
function checkPins() {
  let changed = false;
  E.pins(S).forEach((p) => { if (p.auto) return; const i = E.pinInfo(S, p); if (i && i.done && !p.done) { p.done = Date.now(); changed = true; toast(`Objectif atteint : ${i.label}`, "rare"); notify("pin", "Objectif atteint", i.label); } });
  if (changed) renderObjs();
}
function clearDonePins() { if (!S || !S.pins) return; const n = S.pins.length; S.pins = S.pins.filter((p) => !(p.done && Date.now() - p.done > 1500)); if (S.pins.length !== n) dirty = true; }
let rszT = null; window.addEventListener("resize", () => { clearTimeout(rszT); rszT = setTimeout(() => { if (S && ui.tab === "combat" && ui.arena) { if (ui.arena.view !== combatView()) render(); else placeEnts(S.fight); } }, 150); });

/* ---------- écran de départ ---------- */
function classPick(sel, sexSel) {
  return `<div class="classgrid">${CLASS_ORDER.map((id) => { const c = CLASSES[id];
    return `<button class="clsbtn" style="--cc:${c.color}" data-act="startcls" data-cls="${id}" aria-pressed="${sel === id}" data-tip="${h(c.desc + " — Passif : " + c.passive.name + " : " + c.passive.desc)}">
      <span class="csym">${im(symImg(id), "", c.name)}</span><b>${c.name}</b></button>`; }).join("")}</div>`;
}
function classInfo(id, sex, hd) {
  const c = CLASSES[id];
  return `<div class="clsinfo" style="--cc:${c.color}"><span class="csym">${im(symImg(id), "", c.name)}</span>
    <div class="grow"><b style="font-size:17px">${c.name}</b><div class="small muted">${h(c.desc)}</div><div class="small" style="margin-top:4px"><span class="tag soft">Passif</span> <b>${h(c.passive.name)}</b> : ${h(c.passive.desc)}</div></div>
    ${im(lookLocal(id, sex || c.sex, hd || 0), "clook")}</div>`;
}
/* Choix de la tête dès la création du héros */
function headPick(id, sex) {
  const L = LK.CLASS_LOOKS[id]; const sx = sex === "f" ? "f" : "m"; if (!L || id === "forge" || L[sx].heads.length < 2) return "";
  const cur = Math.min(ui.startHead || 0, L[sx].heads.length - 1);
  return `<div class="stack" style="gap:4px"><span class="small muted">Tête</span><div class="headpick">${L[sx].heads.map((_, i) => `<button class="${cur === i ? "on" : ""}" data-act="starthead" data-v="${i}" aria-pressed="${cur === i}"><img src="${lookLocal(id, sx, i)}" alt="Tête ${i + 1}"></button>`).join("")}</div></div>`;
}
const startHeadOf = (id, sex) => { const L = LK.CLASS_LOOKS[id]; const n = L ? L[sex === "f" ? "f" : "m"].heads.length : 1; return id === "forge" ? 0 : Math.min(ui.startHead || 0, n - 1); };
const hasPublicSave = () => { try { return !!localStorage.getItem("dofousxen-save"); } catch (e) { return false; } };
function renderStart() {
  renderStatus(); renderNav();
  const sex = ui.startSex || CLASSES[ui.startCls].sex;
  $("#main").innerHTML = `
  <section class="start stack">
    <div class="logo">idlus</div>
    ${BETA && hasPublicSave() ? `<div class="panel"><div class="pad stack"><b>Version de test</b><span class="small muted">Votre partie du jeu public n'est pas modifiée ici. Vous pouvez en faire une copie pour tester les nouveautés avec vos héros.</span><div><button class="btn primary" data-act="frompublic">Copier ma partie du jeu public</button></div></div></div>` : ""}
    <p class="muted" style="text-align:center;margin:0">Un idle inspiré de DOFUS : vos héros combattent seuls, à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.</p>
    <div class="panel"><div class="pad stack">
      <h2>Choisissez votre premier héros</h2>
      ${classPick(ui.startCls, sex)}
      ${classInfo(ui.startCls, sex, startHeadOf(ui.startCls, sex))}
      <div class="row"><span class="small muted">Apparence</span><span class="seg">${[["m", "Masculin"], ["f", "Féminin"]].map(([v, n]) => `<button data-act="startsex" data-v="${v}" aria-pressed="${sex === v}">${n}</button>`).join("")}</span></div>
      ${headPick(ui.startCls, sex)}
      <label class="stack" style="gap:4px"><span class="small muted">Nom du héros</span><input type="text" id="startName" maxlength="20" value="${h(ui.startName || D.NAMES[Math.floor(Math.random() * D.NAMES.length)])}"></label>
      <div><button class="btn primary" data-act="startgame">Commencer l'aventure</button></div>
    </div></div>
    <details class="panel"><summary class="pad" style="cursor:pointer;font-weight:800">Reprendre une partie (importer une sauvegarde)</summary>
      <div class="pad stack" style="padding-top:0"><textarea id="imp" placeholder="Collez ici le texte de votre sauvegarde exportée"></textarea>
      <div class="row"><button class="btn sm" data-act="import">Importer</button><span id="impmsg" class="minus small"></span></div></div></details>
    ${readCopies().length ? `<details class="panel"${ui.confirm && ui.confirm.startsWith("restore") ? " open" : ""}><summary class="pad" style="cursor:pointer;font-weight:800">Restaurer une copie de secours</summary><div class="pad stack small" style="padding-top:0">${copiesHtml()}</div></details>` : ""}
  </section>`;
}
/* ---------- ACCUEIL ---------- */
const BOOST_INFO = { xp: ["🍬", "Bonbon Sagesse", "+10 % XP"], drop: ["🍭", "Bonbon Prospecteur", "+10 % butin"], kamas: ["🪙", "Bonbon Doré", "+15 % kamas"], gather: ["🌾", "Bonbon Récolteur", "+15 % récolte"], archi: ["🎯", "Bonbon Traqueur", "archis ×1,5"], royal: ["👑", "Bonbon Royal", "+10 % XP/butin/kamas"] };
function activeBoosts() { return Object.keys(BOOST_INFO).filter((k) => E.boostPct(S, k) > 0).map((k) => ({ k, icon: BOOST_INFO[k][0], name: BOOST_INFO[k][1], txt: BOOST_INFO[k][2], left: E.boostLeft(S, k) })); }
/* Barre de raccourcis des consommables (combat + accueil) */
function consBar(full) {
  const owned = Object.entries(S.cons || {}).filter(([id, n]) => n > 0 && CONSUMABLES[id] && (full || CONSUMABLES[id].kind !== "scroll"));
  const act = activeBoosts();
  const items = owned.map(([id, n]) => { const C = CONSUMABLES[id];
    return `<button class="cbtn ${C.auto ? "auto" : ""}" ${C.auto ? "" : `data-act="usecons" data-id="${id}"`} data-tip="${h(`${C.name} ×${n} — ${C.desc}${C.auto ? "" : " (cliquez pour utiliser)"}`)}"><span class="ci">${C.icon}</span><b class="num">${n}</b>${C.auto ? `<i>auto</i>` : ""}</button>`; }).join("");
  return `<div class="consbar">${act.map((b) => `<span class="cact" data-tip="${h(`${b.name} : ${b.txt}`)}">${emo(b.icon)} ${h(b.txt)} <b class="num" data-boostleft="${b.k}">${dur(b.left)}</b></span>`).join("")}${S.fmShield ? `<span class="cact" data-tip="La prochaine forgemagie ne peut rien faire baisser">${IC("cristal")} Cristal actif</span>` : ""}
    ${items || (full ? `<span class="xs muted">Aucun consommable. Quêtes, avis de recherche, coffres et boss en donnent.</span>` : "")}</div>`;
}
function consHtml() {
  return consBar(true) + `<div class="list" style="margin-top:8px">${Object.entries(S.cons || {}).filter(([id, n]) => n > 0 && CONSUMABLES[id]).map(([id, n]) => { const C = CONSUMABLES[id]; return `<div class="li"><span class="icobox candy">${C.icon}</span><span class="grow"><span class="name">${h(C.name)}</span> <span class="num muted">×${n}</span><br><span class="xs muted">${h(C.desc)}</span></span>${C.auto ? `<span class="tag soft">automatique</span>` : `<button class="btn sm primary" data-act="usecons" data-id="${id}">${C.kind === "chest" ? "Ouvrir" : "Utiliser"}</button>`}</div>`; }).join("")}</div>`;
}
function renderHome() {
  renderHomeInner();
  if (ui.home !== "havre") $("#main").insertAdjacentHTML("beforeend", `<section class="panel discordcard"><div class="pad row"><span class="dico">${G("chat")}</span><span class="grow"><b>Rejoignez la communauté idlus sur Discord</b><br><span class="small muted">Annonces des mises à jour, aide, builds, et vos idées pour la suite du jeu.</span></span><a class="btn primary" href="${DISCORD}" target="_blank" rel="noopener">Rejoindre</a></div></section>`);
}
function renderHomeInner() {
  const team = E.team(S); const main = mainHero();
  const deco = S.dungeon ? dgDeco(S.dungeon.id) : S.sub ? subDeco(S.sub) : "sky";
  const act = S.dungeon ? `En donjon : <b>${h(DUNGEONS[S.dungeon.id].name)}</b> · salle ${Math.min(S.dungeon.room + 1, DUNGEONS[S.dungeon.id].rooms.length + 1)}/${DUNGEONS[S.dungeon.id].rooms.length + 1}`
    : !team.length ? `Tous vos héros récoltent. Rappelez-en un dans Métiers pour chasser.` : S.hunting && S.sub ? `Chasse en cours : <b>${h(E.SUBS[S.sub].name)}</b> ${starsHtml(S.sub, true)}` : `Votre équipe se repose. Choisissez une zone pour partir chasser.`;
  const zkey = S.dungeon ? null : S.sub; const rate = zkey ? E.zoneRate(S, zkey) : null;
  const archis = Object.values(S.archis).reduce((a, b) => a + b, 0);
  const tabs = ""; // Aperçu / Havre-Sac : dans la barre de navigation depuis la 0.1.9.1
  if (ui.home === "havre") { $("#main").innerHTML = tabs + havreHtml(); return; }
  const q = E.questStep(S); const qp = E.questProgress(S); const A = E.almanax(S);
  $("#main").innerHTML = tabs + protBar() + `
  <section class="hero-banner">
    <div class="scene">${sceneSVG(deco, 220, "home" + (S.sub || ""))}<div class="troupe" style="justify-content:flex-end;padding-right:5%">${team.map((c) => `<span class="ent hero" style="width:clamp(54px,10vw,80px)"><span class="medal" style="--cc:${CLASSES[c.cls].color}">${headTag(c.cls, c.sex, c.name)}</span></span>`).join("")}</div></div>
    <div class="inner">
      <div class="card"><h1>Bonjour ${h(main.name)} !</h1><div class="small" style="margin-top:4px">${act}</div></div>
      <div class="row">${S.hunting || S.dungeon ? `<button class="btn primary" data-tab="combat">${IC("combat")} Voir le combat</button>${S.dungeon ? "" : `<button class="btn" data-act="stophunt">Rentrer</button>`}` : `<button class="btn primary" data-tab="world">${IC("monde")} Choisir une zone</button>`}</div>
    </div>
  </section>
  <section class="panel" style="margin-top:14px"><div class="phead"><h2>Vos héros</h2>${fsGauge()}</div><div class="cardrow" style="padding-left:14px">${S.chars.map((c) => heroCard(c, "sm")).join("")}</div></section>
  <section class="grid2" style="margin-top:14px">
    <div class="panel"><div class="phead"><h2>Quête</h2><button class="btn sm" data-tab="quests">Toutes les quêtes</button></div><div class="pad stack" style="gap:8px">
      ${q ? `<div><b>${h(q.title)}</b><div class="small muted">${h(q.txt)}</div><div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div></div>` : `<p class="note">Quête principale terminée. Bravo, Héros d'Amakna !</p>`}
      <div class="small">${IC("quetes")} Avis de recherche : ${(S.bounties || []).map((b) => `<span class="tag soft">${h(MONSTERS[b.key].name)} ${b.prog}/${b.n}</span>`).join(" ") || "aucun"}</div>
      <div class="small">${IC("almanax")} Almanax : ${A.done ? `<span class="tag good">offrande faite · ${h(A.bonus.name)}</span>` : `${A.qty} × ${h(A.res)} → ${h(A.bonus.name)} <button class="btn sm" data-act="goquest" data-v="almanax">Offrir</button>`}</div></div></div>
    <div class="panel"><div class="phead"><h2>Rendement${zkey ? " · " + h(E.SUBS[zkey].name) : ""}</h2></div><div class="pad">${rateHtml(rate)}</div></div>
  </section>
  <section class="kpis" style="margin:14px 0">
    <div class="kpi"><b class="num">${Math.max(...S.chars.map((c) => c.lvl))}</b><span>niveau max</span></div>
    <div class="kpi"><b class="num">${fmt(S.stats.wins)}</b><span>victoires</span></div>
    <div class="kpi"><b class="num" style="color:var(--archi)">${archis}</b><span>archimonstres vaincus</span></div>
    <div class="kpi"><b class="num" style="color:var(--gold)">${S.radiants || 0}</b><span>objets rayonnants</span></div>
    <div class="kpi"><b class="num">${Object.keys(S.ach || {}).length}/${E.ACH.length}</b><span>succès</span></div>
    <div class="kpi"><b class="num">${E.havreTotal(S)}</b><span>améliorations du Havre-Sac</span></div>
  </section>
  <section class="grid2">
    <div class="panel"><div class="phead"><h2>Consommables</h2></div><div class="pad">${consBar(true)}</div></div>
    <div class="panel"><div class="phead"><h2>Derniers combats</h2></div><div class="pad">${historyHtml(6)}</div></div>
  </section>
  ${S.shop.length ? `<section class="panel" style="margin-top:14px"><div class="phead"><h2>${G("cart")} Liste de courses</h2></div><div class="pad stack" style="gap:8px">${shopListHtml()}</div></section>` : ""}
  <section class="panel" style="margin-top:14px"><div class="phead"><h2>Journal</h2></div><div class="list journal">${S.journal.slice(0, 10).map((j) => `<div class="li k-${j.kind}"><span class="grow">${h(j.txt)}</span><span class="xs muted">${ago(j.t)}</span></div>`).join("") || `<div class="empty">Rien pour l'instant.</div>`}</div></section>`;
}
/* ---------- 4.0 : Havre-Sac en pièces ---------- */
const hvPips = (l, m) => `<div class="pipsbar">${Array.from({ length: Math.min(m, 50) }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</div>`;
const hvUp = (H) => { const l = E.havreLvl(S, H.id); const cost = E.havreCost(S, H.id); const max = l >= H.max;
  return `<div class="upl"><div class="row between"><span><b>${h(H.name)}</b> <span class="lvlpill">${l}/${H.max}</span></span><span class="plus small">+${fmt(l * H.per)}${h(H.unit.split(" (")[0])}</span></div>${hvPips(l, H.max)}
    <button class="btn sm ${!max && S.kamas >= cost ? "primary" : ""}" data-act="havre" data-id="${H.id}" ${max || S.kamas < cost ? "disabled" : ""}>${max ? "Maximum" : `Améliorer · ${fmt(cost)} k`}</button></div>`; };
const furnIco = (n) => IC(E.FURN[n] && E.FURN[n].trophy ? "trophee" : "havre");
const hvSlots = (R) => {
  const n = E.roomSlots(S, R.id); const P = E.placed(S, R.id); const next = R.nextSlot ? R.nextSlot(S) : 0;
  const owned = S.furniture.filter((f) => E.FURN[f] && E.FURN[f].room === R.id && !E.isPlaced(S, f)).length;
  return `<div class="fslots"><div class="xs muted">Meubles ${P.length}/${n}</div>${Array.from({ length: n }, (_, i) => P[i]
    ? `<div class="fslot full">${furnIco(P[i])}<span class="grow"><b>${h(P[i])}</b><i>${h(E.furnEffect(P[i]))}</i></span><button class="btn sm" data-act="funplace" data-v="${h(P[i])}">Retirer</button></div>`
    : `<button class="fslot empty" data-act="fpick" data-v="${R.id}" ${owned ? "" : "disabled"}>${owned ? `+ Placer un meuble (${owned} disponible${owned > 1 ? "s" : ""})` : "Aucun meuble à placer ici"}</button>`).join("")}
    ${next ? `<span class="fslot lock">${IC("cle")} Une place de plus au niveau ${next} de la pièce</span>` : ""}</div>`;
};
const roomSum = (R) => {
  const p = R.ups.map((id) => { const H = E.HAVRE.find((x) => x.id === id); return `+${fmt(E.havreLvl(S, id) * H.per)}${H.unit.split(" (")[0]}`; });
  if (R.slots) p.push(`meubles ${E.placed(S, R.id).length}/${E.roomSlots(S, R.id)}`);
  if (R.post === "train") { const t = E.trainee(S); p.push(t ? `${t.name} s'entraîne` : "personne à l'entraînement"); }
  if (R.post === "atelier") { const c = E.atelierHero(S); p.push(!S.atelier.built ? `à construire · ${fmt(E.ATELIER_COST)} k` : c ? `${c.name} fabrique` : "personne à l'atelier"); }
  if (R.post === "enclos") { const n = E.MOUNT_ORDER.reduce((a, sp) => a + Object.keys(S.mountSeen[sp] || {}).filter((c) => !E.isBico(c)).length, 0); const all = E.MOUNT_ORDER.reduce((a, sp) => a + Object.keys(E.MOUNTS[sp].cols).length, 0);
    p.unshift(!S.enclos.built ? `à construire · ${fmt(E.ENCLOS_COST)} k` : `${S.enclos.pairs.length ? `${S.enclos.pairs.length} couple${S.enclos.pairs.length > 1 ? "s" : ""} à l'enclos` : "enclos libre"} · ${n}/${all} couleurs`); }
  return p.join(" · ");
};
function roomBody(R) {
  if (R.soon) return `<p class="note">Bientôt.</p>`;
  let b = "";
  if (R.post === "enclos") b = enclosBody();
  if (R.post === "train") { const t = E.trainee(S);
    b = t ? `<div class="trainee">${head(t)}<div class="grow"><b>${h(t.name)}</b> <span class="xs muted">${CLASSES[t.cls].name} niv. ${t.lvl}</span><div class="xs">Gagne <b class="plus">${fmt(Math.round(E.trainShare(S, t) * 1000) / 10)} %</b> de l'XP moyenne de l'équipe, sans combattre${E.trainMult(S, t) < 1 ? ` <span class="muted">(malus : ${E.trainGap(S, t)} niveaux sous l'équipe)</span>` : ""}</div><div class="bar xp"><i style="width:${t.lvl >= E.MAX_LVL ? 100 : pct(t.xp, E.xpNeed(t.lvl))}%"></i></div></div><button class="btn sm" data-act="trainpick">Changer</button></div>`
      : `<div class="trainee"><div class="grow small">Un héros hors de l'équipe peut s'entraîner ici : il gagne <b class="plus">${Math.round(E.TRAIN_SHARE * 100)} %</b> de l'XP moyenne de l'équipe, sans combattre, moins s'il a plus de ${E.TRAIN_FREE_GAP} niveaux de retard.</div><button class="btn sm primary" data-act="trainpick">Choisir</button></div>`; }
  if (R.post === "atelier") { const A = S.atelier;
    if (!A.built) return `<p class="note">Un héros affecté à l'atelier fabrique une recette toutes les ${E.ATELIER_PERIOD_S / 60} min, même hors ligne, tant que les ressources suffisent. Il quitte l'équipe pendant ce temps.</p><button class="btn sm ${S.kamas >= E.ATELIER_COST ? "primary" : ""}" data-act="atbuild" ${S.kamas >= E.ATELIER_COST ? "" : "disabled"}>Construire · ${fmt(E.ATELIER_COST)} k</button>`;
    const c = E.atelierHero(S); const Rc = E.atelierRecipe(A.rec);
    b = c && Rc ? `<div class="trainee">${head(c)}<div class="grow"><b>${h(c.name)}</b> <span class="xs muted">fabrique</span> <b>${h(Rc.name)}</b><div class="xs ${A.stall ? "ko" : "muted"}">${A.stall ? `En pause : ${h(A.stall)}` : `Prochaine fabrication dans ${Math.max(1, Math.ceil((E.ATELIER_PERIOD_S - (A.prog || 0)) / 60))} min · ${fmt(A.made || 0)} fabriqué${(A.made || 0) > 1 ? "s" : ""}`}</div><div class="bar"><i style="width:${pct(A.prog || 0, E.ATELIER_PERIOD_S)}%"></i></div>${ingHtml(Rc.ing)}</div></div>
      <div class="row"><button class="btn sm" data-act="atpick">Changer</button><button class="btn sm" data-act="atstop">Rappeler ${h(c.name)}</button></div>`
      : `<p class="note">Choisissez un héros et une recette : l'atelier la fabrique toutes les ${E.ATELIER_PERIOD_S / 60} min, même hors ligne.</p><button class="btn sm primary" data-act="atpick">Affecter un héros</button>`;
  }
  return b + R.ups.map((id) => hvUp(E.HAVRE.find((x) => x.id === id))).join("") + (R.slots ? hvSlots(R) : "");
}
const restLabel = (c) => (E.trainee(S) === c ? "À l'entraînement (Havre-Sac)" : E.atelierHero(S) === c ? "À l'atelier (Havre-Sac)" : "Au repos (hors équipe)");
function havreHtml() {
  const placedN = E.ROOMS.reduce((s, R) => s + E.placed(S, R.id).length, 0), slotsN = E.ROOMS.reduce((s, R) => s + E.roomSlots(S, R.id), 0);
  const t = E.trainee(S);
  const free = S.furniture.filter((f) => E.FURN[f] && !E.isPlaced(S, f)).sort((a, b) => E.FURN[a].room.localeCompare(E.FURN[b].room));
  const left = Object.keys(E.FURN).filter((f) => E.FURN[f].trophy && !S.furniture.includes(f)).length;
  const room = (R) => { const open = ui.hvRoom === R.id;
    return `<article class="room ${open ? "open" : ""} ${R.soon || (R.post === "atelier" && !S.atelier.built) ? "locked" : ""} ${R.soon ? "soon" : ""}" style="--rc:${R.color}">
      <header data-act="hvroom" data-v="${R.id}"><span class="rico">${IC(R.icon)}</span><div class="grow"><h3>${h(R.name)}</h3><div class="xs muted">${h(R.desc)}</div><div class="xs plus msum">${h(roomSum(R))}</div></div>${R.soon ? `<span class="tag soft">Bientôt</span>` : ""}<span class="chev">▾</span></header>
      ${roomBody(R)}</article>`; };
  return `<section class="panel"><div class="phead"><h2>${IC("havre")} Havre-Sac</h2><span class="small"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b> kamas</span></div>
    <div class="pad stack"><div class="hvsum">
      <div><b class="num plus">+${fmt(E.bonus(S, "xp"))} %</b><span>expérience</span></div><div><b class="num plus">+${fmt(E.bonus(S, "drop"))} %</b><span>butin</span></div><div><b class="num plus">+${fmt(E.bonus(S, "kamas"))} %</b><span>kamas</span></div>
      <div><b class="num">${placedN} / ${slotsN}</b><span>meubles placés</span></div><div><b class="num">${t ? h(t.name) : "—"}</b><span>à l'entraînement</span></div></div>
    <p class="xs muted">Bonus totaux, plafonnés à +${E.BONUS_CAP.xp} % d'XP, +${E.BONUS_CAP.drop} % de butin et +${E.BONUS_CAP.kamas} % de kamas.</p>
    <div class="rooms">${E.ROOMS.map(room).join("")}</div></div></section>
    <section class="panel" style="margin-top:14px"><div class="phead"><h2>${IC("havre")} Meubles à placer</h2><span class="xs muted">un meuble agit seulement une fois placé</span></div><div class="pad stack"><div class="mlist">
      ${free.map((f) => { const F = E.FURN[f]; const full = E.placed(S, F.room).length >= E.roomSlots(S, F.room);
        return `<div class="mitem"><span class="rico">${furnIco(f)}</span><div class="grow"><b>${h(f)}</b><div class="xs muted">${h(E.furnEffect(f))} · ${h(E.room(F.room).name)}${full ? " (pleine)" : ""}</div></div><button class="btn sm ${full ? "" : "primary"}" data-act="fplace" data-v="${h(f)}" ${full ? "disabled" : ""}>Placer</button></div>`; }).join("")}
      ${free.length ? "" : `<p class="note">${S.furniture.some((f) => E.FURN[f]) ? "Tous vos meubles sont placés." : "Aucun meuble pour l'instant : les trophées de boss, le Comptoir de la cité, le Bricoleur, l'Almanax et les butins rares de certaines zones en donnent."}</p>`}
      <div class="mitem dim"><span class="rico">${IC("cle")}</span><div class="grow"><b>Trophées de boss à gagner : ${left}</b><div class="xs muted">Chaque boss de donjon donne son trophée à la première victoire en stasis ${E.TROPHY_STASIS}.</div></div><button class="btn sm" data-act="fcatalog">Catalogue</button></div>
    </div></div></section>`;
}
function furnPickSheet(room) {
  const R = E.room(room); const list = S.furniture.filter((f) => E.FURN[f] && E.FURN[f].room === room && !E.isPlaced(S, f));
  openSheet(`<h2>${IC(R.icon)} ${h(R.name)} : placer un meuble</h2><div class="list">${list.map((f) => `<div class="li"><span class="rico">${furnIco(f)}</span><span class="grow"><b>${h(f)}</b><br><span class="xs plus">${h(E.furnEffect(f))}</span></span><button class="btn sm primary" data-act="fplace" data-v="${h(f)}">Placer</button></div>`).join("") || `<div class="empty">Aucun meuble pour cette pièce.</div>`}</div><div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function furnCatalogSheet() {
  const rows = Object.keys(E.FURN).sort((a, b) => E.ROOMS.findIndex((r) => r.id === E.FURN[a].room) - E.ROOMS.findIndex((r) => r.id === E.FURN[b].room));
  openSheet(`<h2>${IC("havre")} Catalogue des meubles</h2><p class="small muted">${S.furniture.filter((f) => E.FURN[f]).length} / ${rows.length} obtenus.</p><div class="list">${rows.map((f) => { const F = E.FURN[f]; const got = S.furniture.includes(f);
    return `<div class="li ${got ? "" : "dim"}"><span class="rico">${furnIco(f)}</span><span class="grow"><b>${h(f)}</b> <span class="xs muted">${h(E.room(F.room).name)}</span><br><span class="xs plus">${h(E.furnEffect(f))}</span> <span class="xs muted">· ${h(F.src)}</span></span>${got ? `<span class="tag good">Obtenu</span>` : ""}</div>`; }).join("")}</div><div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function trainSheet() {
  const list = S.chars.filter((c) => !c.inTeam && !c.job && E.atelierHero(S) !== c); const t = E.trainee(S);
  openSheet(`<h2>${IC("combat")} Salle d'entraînement</h2><p class="small muted">Seul un héros hors de l'équipe, qui ne récolte pas et ne travaille pas à l'atelier, peut s'entraîner. Retirez un héros de l'équipe depuis sa fiche pour le rendre disponible.</p>
    <div class="list">${list.map((c) => `<div class="li">${head(c)}<span class="grow"><span class="name">${h(c.name)}</span> <span class="xs muted">${CLASSES[c.cls].name} niv. ${c.lvl}</span></span>${t === c ? `<span class="tag good">À l'entraînement</span>` : `<button class="btn sm primary" data-act="trainset" data-id="${c.id}">Entraîner</button>`}</div>`).join("") || `<div class="empty">Aucun héros disponible : tous sont dans l'équipe ou occupés.</div>`}</div>
    <div class="row">${t ? `<button class="btn" data-act="trainset" data-id="">Arrêter l'entraînement</button>` : ""}<button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function atelierSheet() {
  const a = ui.at; const A = S.atelier;
  const job = a.job; const J = S.crafts[job] || { lvl: 1 };
  let recs = job === "bricoleur"
    ? Object.entries(SPECIAL_CRAFTS).filter(([n, R]) => R.lvl <= J.lvl && !(R.furn && S.furniture.includes(n)) && !(R.idol && E.idolOwned(S, R.idol)) && !(R.dofus && !E.dofusOwned(S, R.dofus))).map(([n, R]) => ({ k: "special", id: n, name: n, lvl: R.lvl, ing: R.ing }))
    : Object.entries(ITEMS).filter(([id, T]) => T.craft && T.craft.job === job && E.craftReq(id) <= J.lvl).map(([id, T]) => ({ k: "tpl", id, name: T.name, lvl: T.lvl, ing: T.craft.ing }));
  recs.sort((x, y) => (E.canCraft(S, y) - E.canCraft(S, x)) || y.lvl - x.lvl); const total = recs.length; recs = recs.slice(0, 40);
  const heroes = S.chars.filter((c) => !c.job);
  openSheet(`<h2>${IC("forge")} Atelier</h2><p class="small muted">Le héros quitte l'équipe et fabrique la recette toutes les ${E.ATELIER_PERIOD_S / 60} min, même hors ligne. Les recettes dépendent du niveau de vos métiers.</p>
    <div class="stack" style="gap:8px">
      <div class="small"><b>Héros</b></div><div class="row">${heroes.map((c) => `<button class="btn sm ${a.cid === c.id ? "primary" : ""}" data-act="atcid" data-id="${c.id}">${h(c.name)} <span class="xs">niv. ${c.lvl}${c.inTeam ? " · équipe" : ""}</span></button>`).join("")}</div>
      <nav class="subtabs" style="margin:0">${Object.entries(CRAFT_JOBS).map(([id, c]) => `<button data-act="atjob" data-v="${id}" aria-pressed="${job === id}">${c.name} <span class="num xs">${(S.crafts[id] || {}).lvl || 1}</span></button>`).join("")}</nav>
      <div class="list">${recs.map((r) => `<div class="li"><span class="grow"><b>${h(r.name)}</b> <span class="xs muted">niv. ${r.lvl}</span>${ingHtml(r.ing)}</span><button class="btn sm ${a.rec && a.rec.id === r.id ? "primary" : ""}" data-act="atrec" data-k="${r.k}" data-v="${h(r.id)}">${a.rec && a.rec.id === r.id ? "Choisie" : "Choisir"}</button></div>`).join("") || `<div class="empty">Aucune recette à ce niveau de métier.</div>`}</div>
      ${total > recs.length ? `<p class="xs muted">${total - recs.length} autres recettes : les fabricables maintenant sont en premier.</p>` : ""}
    </div>
    <div class="row"><button class="btn primary" data-act="atgo" ${a.cid != null && a.rec ? "" : "disabled"}>Lancer</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
}
function rateHtml(rate) {
  if (!rate) return `<p class="note">Les statistiques apparaissent après quelques combats dans une zone : XP, kamas et ressources par heure, pour comparer les zones.</p>`;
  return `<div class="rates">
    <div class="rate"><b class="num">${fmt(rate.xpH)}</b><span>XP / heure</span></div>
    <div class="rate"><b class="num">${fmt(rate.kH)}</b><span>kamas / heure</span></div>
    <div class="rate"><b class="num">${fmt(rate.rH)}</b><span>ressources / h</span></div>
    <div class="rate"><b class="num">${Math.round(rate.winRate * 100)} %</b><span>victoires (${rate.fights} combats)</span></div></div>`;
}
function historyHtml(n) {
  const rows = S.history.slice(0, n);
  if (!rows.length) return `<p class="note">Aucun combat pour l'instant.</p>`;
  return `<div class="hist">${rows.map((r) => `<div class="hrow ${!r.w && (S.losses || []).some((x) => x.t === r.t) ? "clk" : ""}" ${!r.w && (S.losses || []).some((x) => x.t === r.t) ? `data-act="losssheet" data-t="${r.t}" data-tip="Pourquoi j'ai perdu ?"` : ""}><span class="${r.w ? "w" : "l"}">${r.w ? "Victoire" : "Défaite"}</span><span class="z">${h(r.label)} <span class="muted xs num">${r.d} s</span></span><span class="x xs muted">${r.w ? `+${fmt(r.xp)} XP · ${fmt(r.k)} k · ${r.r} res.${r.i ? ` · ${r.i} obj.` : ""}` : ""}</span></div>`).join("")}</div>`;
}

/* ---------- MONDE ---------- */
function renderWorld() {
  if (ui.zoneView) return renderZoneView(ui.zoneView);
  const tabs = [["map", "Carte"], ["dungeons", "Donjons"], ["enc", "Encyclopédie"]];
  let body = "";
  if (ui.world === "map") {
    const t = mapTier(); const bands = MAP_TIERS.map((b, i) => [i, b[0] + "–" + b[1]]).concat([[-1, "Tout"]]);
    body = `<div class="row between maptiers"><span class="small muted">Niveaux</span><span class="seg">${bands.map(([i, n]) => `<button data-act="maptier" data-v="${i}" aria-pressed="${t === i}">${n}</button>`).join("")}</span></div>`
      + (ZONES.map((z) => zonePanel(z, t, mapOpenZone(t) === z.id)).join("") || `<div class="empty">Aucune zone dans cette tranche.</div>`);
  }
  else if (ui.world === "dungeons") body = dungeonsHtml();
  else body = encyclopediaHtml();
  $("#main").innerHTML = `
<div class="pagehead"><h1>Le Monde des Douze</h1>${S.dungeon ? `<span class="tag warn">En donjon</span>` : ""}<span class="grow"></span>${archiBtn()}</div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="worldtab" data-v="${id}" aria-pressed="${ui.world === id}">${n}</button>`).join("")}</nav>
    <div class="stack">${body}</div>`;
}
function lockReason(sid) {
  const s = E.SUBS[sid]; const z = ZONES.find((x) => x.id === s.zone);
  if (!E.zoneUnlocked(S, z.id)) return `Battez ${MONSTERS[DUNGEONS[z.requires.boss].boss].name} (${DUNGEONS[z.requires.boss].name})`;
  if (s.requiresItem) return `Il faut : ${s.requiresItem} (Bricoleur)`;
  return "";
}
function topTeamLvl() { const t = E.team(S); return Math.max(...(t.length ? t : S.chars).map((c) => c.lvl)); }
function lvlHint(s) {
  const top = topTeamLvl();
  const cls = top < s.lvl[0] - 3 ? "minus" : top > s.lvl[1] + 4 ? "muted" : "plus";
  const pen = Math.round((1 - E.xpPenalty(top - s.lvl[1])) * 100);
  return `<span class="xs ${cls}" data-tip="Niveau conseillé selon les monstres de la zone. Votre meilleur héros est niveau ${top}.${pen ? ` Monstres trop faibles : expérience réduite de ${pen} %.` : ""}">Conseillé : niv. ${s.lvl[0]}–${Math.min(200, s.lvl[1])}</span>${pen ? ` <span class="xppen" data-tip="Votre meilleur héros (niv. ${top}) dépasse le niveau des monstres de plus de 4 : −10 % d'XP par niveau d'écart.">XP −${pen} %</span>` : ""}`;
}
function tierBadge(k) {
  const t = E.huntTier(S, k); const n = S.bestiary[k] || 0; const next = HUNT_TIERS[t + 1];
  return `<div class="tierline" data-tip="${h(HUNT_TIERS.map((x, i) => `${i <= t ? "✓" : "·"} ${x.name} (${x.n}) : ${x.desc}`).join(" | "))}">
    ${t >= 0 ? `<span class="tier t${t}">${HUNT_TIERS[t].name}</span>` : `<span class="tier">Aucun palier</span>`}
    ${next ? `<span class="bar"><i style="width:${pct(n, next.n)}%"></i></span><span class="xs muted num">${fmt(n)}/${fmt(next.n)}</span>` : `<span class="xs muted">max</span>`}</div>`;
}
/* 0.1.8.1 : étoiles de zone (+10 % d'XP et de butin chacune, montent sans chasse, fondent en chassant) */
function starsHtml(sid, long = false) {
  const n = E.zoneStars(S, sid); const k = Math.floor(n); const pctB = k * E.STAR_PCT;
  const next = k >= E.STAR_MAX ? "" : ` · prochaine dans ${dur((k + 1 - n) * E.STAR_GROW_S)}`;
  const here = S.hunting && S.sub === sid && !S.dungeon;
  const tip = `Étoiles de zone : +${E.STAR_PCT} % d'XP et de butin par étoile. Une zone où personne ne chasse gagne une étoile toutes les ${E.STAR_GROW_S / 3600} h (${E.STAR_MAX} au plus) ; elles fondent en chassant, une toutes les ${E.STAR_MELT_S / 60} min.${here ? "" : next}`;
  return `<span class="zstars ${k ? "" : "none"}" data-tip="${h(tip)}">${"★".repeat(k)}<i>${"★".repeat(E.STAR_MAX - k)}</i>${long ? `<b>+${pctB} %</b>` : ""}</span>`;
}
/* 0.1 : la carte se lit par tranche de niveaux (sous-zones classées par leur niveau minimum) */
const MAP_TIERS = [[1, 40], [41, 80], [81, 120], [121, 160], [161, 200]];
const tierOf = (lvl) => { const i = MAP_TIERS.findIndex((b) => lvl <= b[1]); return i < 0 ? MAP_TIERS.length - 1 : i; };
function mapTier() { if (ui.mapTier === undefined) ui.mapTier = tierOf(topTeamLvl()); return ui.mapTier; }
function zonePanel(z, tier = -1, open = false) {
  const subs = tier < 0 ? z.subs : z.subs.filter((s) => tierOf(s.lvl[0]) === tier);
  if (!subs.length) return "";
  const zu = E.zoneUnlocked(S, z.id);
  const nUn = subs.filter((s) => E.subUnlocked(S, s.id)).length;
  const lo = Math.min(...subs.map((s) => s.lvl[0])), hi = Math.min(200, Math.max(...subs.map((s) => s.lvl[1])));
  const hunting = subs.some((s) => S.hunting && S.sub === s.id && !S.dungeon);
  const best = bestSub(); const hasBest = subs.some((s) => s.id === best);
  const mons = [...new Set(subs.flatMap((s) => s.monsters))]; const traq = mons.filter((k) => E.huntTier(S, k) >= 1).length;
  const tro = subs.filter((s) => S.trophies && S.trophies[s.id]).length;
  const prog = `<span class="zf-prog" data-tip="${traq}/${mons.length} monstres Traqueur · ${tro}/${subs.length} trophée${subs.length > 1 ? "s" : ""}"><span class="bar"><i style="width:${pct(traq, mons.length)}%"></i></span>${IC("trophee")}<span class="xs num">${tro}/${subs.length}</span></span>`;
  const head = `<button class="zonefold" data-act="zonefold" data-id="${z.id}" aria-expanded="${open}"><span class="zf-name">${h(z.name)}</span>
    <span class="zf-meta">${hunting ? `<span class="tag good">Chasse en cours</span>` : hasBest ? `<span class="tag best">${G("star")} Zone conseillée</span>` : ""}${zu ? "" : `<span class="lockmsg">${G("lock")} ${h(lockReason(z.subs[0].id))}</span>`}<span class="xs muted">niv. ${lo === hi ? lo : lo + "–" + hi} · ${nUn}/${subs.length} zone${subs.length > 1 ? "s" : ""}</span>${zu ? prog : ""}</span><span class="chev">${open ? "▾" : "▸"}</span></button>`;
  if (!open) return `<section class="panel zonefoldp">${head}</section>`;
  return `<section class="panel zonefoldp open">${head}<div class="small muted zf-desc">${h(z.desc)}</div>
    <div class="subrows">${subs.map((s) => {
      const un = E.subUnlocked(S, s.id); const here = S.hunting && S.sub === s.id && !S.dungeon;
      if (s.hidden && !un) return `<div class="subrow locked"><span class="sr-mons">${G("lock")}</span><span class="sr-txt"><b>Lieu caché</b><span class="lockmsg">Un objet permettrait de rapetisser… (${h(s.requiresItem)}, Bricoleur)</span></span></div>`;
      const wins = S.progress.wins[s.id] || 0; const isBest = s.id === best; const weak = un && E.xpPenalty(topTeamLvl() - s.lvl[1]) <= 0.25;
      return `<button class="subrow ${un ? "" : "locked"} ${here ? "here" : ""} ${isBest ? "best" : ""} ${weak && !here ? "weak" : ""}" data-act="zoneview" data-id="${s.id}">
        <span class="sr-mons">${s.monsters.slice(0, 3).map((k) => im(imgM(k), "", MONSTERS[k].name)).join("")}</span>
        <span class="sr-txt"><span class="sr-name"><b>${h(s.name)}</b>${s.dungeon ? `<span data-tip="Donjon dans cette zone">${IC("cle")}</span>` : ""}${S.trophies && S.trophies[s.id] ? `<span data-tip="Trophée obtenu">${IC("trophee")}</span>` : ""}${isBest ? `<span class="tag best" data-tip="La zone qui rapporte le plus d'XP à votre équipe sans être trop dure">${G("star")}<span class="bt"> Meilleure zone</span></span>` : ""}</span>
          <span class="sr-sub">${lvlHint(s)}${un ? starsHtml(s.id) : ""}</span>
          ${here ? `<span class="tag good" style="align-self:flex-start">Chasse en cours</span>` : un ? `<span class="xs muted">${wins} victoire${wins > 1 ? "s" : ""}</span>` : `<span class="lockmsg">${G("lock")} ${h(lockReason(s.id))}</span>`}</span>
      </button>`; }).join("")}</div></section>`;
}
/* zone conseillée : la plus haute zone débloquée sans malus d'XP, à portée du niveau moyen de l'équipe, et pas trop dure si on y a déjà combattu */
function bestSub() {
  const t = E.team(S).length ? E.team(S) : S.chars; const avg = t.reduce((a, c) => a + c.lvl, 0) / t.length; const top = topTeamLvl();
  let best = null;
  ZONES.forEach((z) => z.subs.forEach((s) => {
    if (s.hidden || !E.subUnlocked(S, s.id) || s.lvl[0] > avg + 2 || E.xpPenalty(top - s.lvl[1]) < 1) return;
    const r = E.zoneRate(S, s.id); if (r && r.fights >= 5 && r.winRate < 0.75) return;
    if (!best || s.lvl[0] + s.lvl[1] > best.lvl[0] + best.lvl[1]) best = s;
  }));
  return best && best.id;
}
function mapOpenZone(t) {
  if (!ui.mapOpen) ui.mapOpen = {};
  const key = String(t);
  if (ui.mapOpen[key] !== undefined) return ui.mapOpen[key];
  const inTier = (s) => t < 0 || tierOf(s.lvl[0]) === t;
  const cur = S.hunting && !S.dungeon && E.SUBS[S.sub];
  let z = cur && inTier(cur) ? cur.zone : null;
  if (!z) { const top = topTeamLvl(); let best = null;
    ZONES.forEach((zz) => zz.subs.forEach((s) => { if (inTier(s) && E.subUnlocked(S, s.id) && s.lvl[0] <= top + 3 && (!best || s.lvl[0] > best[0].lvl[0])) best = [s, zz.id]; }));
    z = best ? best[1] : null; }
  return (ui.mapOpen[key] = z);
}
function renderZoneView(sid) {
  const s = E.SUBS[sid]; const z = ZONES.find((x) => x.id === s.zone); const un = E.subUnlocked(S, sid);
  const here = S.hunting && S.sub === sid && !S.dungeon;
  const res = subResources(s); const its = subItems(s); const rate = E.zoneRate(S, sid);
  const dg = s.dungeon ? DUNGEONS[s.dungeon] : null;
  const trophyDone = S.trophies && S.trophies[sid]; const traq = s.monsters.filter((k) => E.huntTier(S, k) >= 1).length;
  $("#main").innerHTML = `
  <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="zoneback">← Carte</button></div>
  <section class="panel">
    <div class="scene" style="height:210px">${sceneSVG(s.deco, 210, s.id)}<div class="crumb">${h(z.name)}<span class="title">${h(s.name)}</span>Niveau conseillé : ${s.lvl[0]} – ${s.lvl[1]}</div>
      <div class="troupe">${s.monsters.map((k) => im(imgM(k), "", MONSTERS[k].name)).join("")}</div></div>
    <div class="pad stack">
      <div class="row">${!un ? `<span class="tag soft">${G("lock")} ${h(lockReason(sid))}</span>` : here ? `<button class="btn" data-act="stophunt">Rentrer au repos</button><button class="btn primary" data-tab="combat">Voir le combat</button>` : `<button class="btn primary" data-act="hunt" data-id="${sid}" ${S.dungeon ? "disabled" : ""}>${IC("combat")} Partir chasser</button>`}${un ? idolBtn(null) + archiBtn() : ""}
        <span class="small muted">${E.team(S).length} héros · Esprit Libre +${E.freeSpirit(S)} % · ${lvlHint(s)}</span></div>
      ${un ? `<div class="row small"><span data-tip="Étoiles de zone">${starsHtml(sid, true)}</span><span class="muted">${here ? "Les étoiles fondent pendant la chasse (une toutes les 30 min)." : "Une étoile toutes les 2 h sans chasse, +10 % d'XP et de butin chacune."}</span></div>` : ""}
      ${rate ? `<div>${rateHtml(rate)}</div>` : ""}
      <div><div class="row between small"><span data-tip="Quand tous les monstres de la zone atteignent le palier Traqueur (250 tués), vous recevez le trophée de la zone, à équiper dans un emplacement Dofus/Trophée.">${IC("trophee")} Trophée ${h(s.name)}${trophyDone ? " : obtenu" : ""}</span><span class="num">${traq}/${s.monsters.length} monstres Traqueur</span></div><div class="bar"><i style="width:${pct(traq, s.monsters.length)}%"></i></div></div>
      <h3 class="sec">Monstres</h3>
      <div class="mons">${s.monsters.map((k) => monCard(k)).join("")}</div>
      <h3 class="sec">Ressources</h3>
      <div class="loot">${res.map((r) => `<div class="lcard">${im(resImg(r.n), "ico", r.n)}<div><div class="n">${h(r.n)}</div><div class="p"><span class="pct">${r.p} %</span> · ${r.from} monstre${r.from > 1 ? "s" : ""}${S.res[r.n] ? ` · <span class="num">${fmt(S.res[r.n])}</span> en stock` : ""}</div></div></div>`).join("") || `<div class="note">Aucune ressource.</div>`}</div>
      ${its.length ? `<h3 class="sec">Équipements à looter</h3><div class="loot">${its.map((e) => `<div class="lcard"><span class="icobox">${im(itemImg(e.t), "", ITEMS[e.t].name)}</span><div><div class="n">${h(ITEMS[e.t].name)}</div><div class="p">niv. ${ITEMS[e.t].lvl} · <span class="pct">${(e.p * E.ITEM_DROP_SCALE).toFixed(2).replace(".", ",")} %</span></div></div></div>`).join("")}</div>` : ""}
      ${dg ? `<h3 class="sec">Donjon${(s.dungeons || []).length > 1 ? "s" : ""}</h3>${(s.dungeons || [s.dungeon]).map(dungeonCard).join("")}` : ""}
    </div>
  </section>`;
}
function monCard(k, opts = {}) {
  const m = MONSTERS[k]; const kills = S.bestiary[k] || 0;
  const archiKey = m.archi; const archiMet = archiKey && S.archis[archiKey];
  return `<div class="mcard ${m.boss ? "boss" : ""} ${opts.unknown ? "unknown" : ""}">${im(imgM(k), "mimg", m.name)}
    <div style="min-width:0"><div class="n">${opts.unknown ? "???" : h(m.name)} ${m.boss ? `<span class="tag boss">Boss</span>` : ""}</div>
    <div class="l">niv. <span class="num">${m.lvl[0]}${m.lvl[1] !== m.lvl[0] ? "–" + m.lvl[1] : ""}</span> ${eld(m.el)} ${kills ? `· <span class="num">${fmt(kills)}</span> tués` : ""}</div>
    <div class="res" style="margin-top:3px">${resChips(m.res)}</div>
    ${(() => { const r = !opts.unknown && E.monRole(k, m.lvl[1]); return r ? `<div class="xs" style="margin-top:3px" data-tip="${h(E.MON_ROLES[r].desc)}"><span class="mrole inl">${h(E.MON_ROLES[r].name)}</span> ${h(E.MON_ROLES[r].desc)}</div>` : ""; })()}
    ${archiKey ? `<div class="xs" style="margin-top:3px;color:var(--archi)">Archi : ${archiMet ? h(MONSTERS[archiKey].name) + ` ×${S.archis[archiKey]}` : "???"}${E.hasSoul(S, archiKey) ? " · 💜 âme" : ""}</div>` : ""}</div></div>`;
}
/* ---------- Donjons (3.1) : cartes, stasis, filtres ---------- */
function dgStars(did) { const SI = (S.stasis || {})[did] || { max: 0 }; const k = S.progress.bossKills[did] ? 1 : 0; return `<span class="stars" title="Terminé · stasis 5 · stasis 10">${k ? "✓" : "·"}<b class="${SI.max >= 5 ? "on" : ""}">★</b><b class="${SI.max >= 10 ? "on" : ""}">★</b></span>`; }
function dgKeyState(did) { const dg = DUNGEONS[did]; const keys = S.res[dg.key] || 0; const R = SPECIAL_CRAFTS[dg.key];
  if (keys) return { k: "ok", txt: `${keys} clé${keys > 1 ? "s" : ""}` }; if (R && E.canCraft(S, R)) return { k: "craft", txt: "clé fabricable" }; return { k: "no", txt: "pas de clé" }; }
function dgDifficulty(did, k) {
  const team = E.team(S); if (!team.length) return { k: "risk", txt: "Aucun héros" };
  const L = team.reduce((a, c) => a + c.lvl, 0) / team.length; const dg = DUNGEONS[did];
  const SI = (S.stasis || {})[did] || { max: 0 };
  /* puissance d'équipement moyenne (stat principale + vitalité/3 apportées par le stuff et les parchemins) */
  const g = team.reduce((a, c) => { const st = E.charStats(S, c, { solo: false }); const m = CLASSES[c.cls].main;
    return a + Math.max(0, st[m] - (c.alloc[m] || 0)) + Math.max(0, st.vit - (c.alloc.vit || 0)) / 3; }, 0) / team.length / 2;
  const cap = 3.5 + g / (50 * (0.7 + L / 200)) + (team.length - 4) * 0.4;
  let sc = k - cap + (SI.max >= k ? -0.4 : 0) + (k < 4 ? Math.max(0, dg.lvl - L) / 8 : 0);
  return sc < -1 ? { k: "easy", txt: "Facile" } : sc < 0.3 ? { k: "mid", txt: "Équilibré" } : { k: "risk", txt: k >= 5 && g < 40 ? "Risqué · équipement requis" : "Risqué" };
}
/* Mutateur de la semaine (3.1.3) */
function weeklyLeft() { return dur((E.weekEnd() - Date.now()) / 1000).replace(/ \d+ min$/, ""); }
function weeklyBanner() {
  const W = E.weekly(S); if (!W) return "";
  const M = E.STASIS_MODS[W.mod]; const dg = DUNGEONS[W.did];
  return `<button class="weekly" data-act="dgopen" data-id="${W.did}">${im(imgM(dg.boss), "dgboss", MONSTERS[dg.boss].name)}<span class="grow"><span class="wk">${G("star")} Mutateur de la semaine</span><b>${h(dg.name)}</b> <span class="xs muted">niv. ${dg.lvl}</span><span class="xs">Modificateur <b>${h(M.name)}</b> : ${h(M.desc.charAt(0).toLowerCase() + M.desc.slice(1))}</span></span><span class="wrew"><b>+${Math.round((E.WEEKLY_REW - 1) * 100)} %</b><span>XP et butin</span><span class="xs muted">encore ${weeklyLeft()}</span></span></button>`;
}
/* Mutateur éclair (0.1) : 3 donjons toutes les 20 minutes */
function flashLeft() { const m = Math.max(1, Math.ceil((E.flashEnd() - Date.now()) / 60000)); return `${m} min`; }
function flashBanner() {
  const L = E.flash(S); if (!L.length) return "";
  const N = E.flash(S, E.flashEnd()); const rew = Math.round((E.FLASH_REW - 1) * 100);
  const row = (x) => { const dg = DUNGEONS[x.did]; const M = E.STASIS_MODS[x.mod]; const un = E.dungeonUnlocked(S, x.did); return `<button class="fl-row ${un ? "" : "locked"}" data-act="dgopen" data-id="${x.did}">${im(imgM(dg.boss), "fl-ico", MONSTERS[dg.boss].name)}<span class="fl-t"><b>${h(dg.name)}</b><span class="xs muted">${un ? "" : `${G("lock")} `}niv. ${dg.lvl} · ${x.tier}</span></span><span class="fl-mod" data-tip="${h(M.desc)}">${h(M.name)}</span></button>`; };
  return `<div class="flash"><div class="fl-head"><span class="wk">${G("bolt")} Mutateur éclair</span><span class="xs"><b class="fl-rew">+${rew} %</b> XP et butin · change dans <b>${flashLeft()}</b></span></div>
    <div class="fl-list">${L.map(row).join("")}</div>
    ${N.length ? `<div class="xs muted fl-next">Ensuite : ${N.map((x) => `${h(DUNGEONS[x.did].name)} (${h(E.STASIS_MODS[x.mod].name)})`).join(" · ")}</div>` : ""}</div>`;
}
function dungeonCard(did) {
  const dg = DUNGEONS[did]; const un = E.dungeonUnlocked(S, did); const ks = dgKeyState(did); const SI = (S.stasis || {})[did] || { max: 0, sel: 1 };
  const fav = (S.dgFav || []).includes(did); const d = dgDifficulty(did, SI.sel || 1);
  return `<div class="dgcard ${un ? "" : "locked"}" data-act="dgopen" data-id="${did}">
    <span class="fav ${fav ? "on" : ""}" data-act="dgfav" data-id="${did}" title="Favori">${fav ? "★" : "☆"}</span>
    ${(E.weekly(S) || {}).did === did ? `<span class="wkbadge" title="Mutateur de la semaine">${G("star")} Semaine</span>` : E.flashOf(S, did) ? `<span class="wkbadge fl" title="Mutateur éclair">${G("bolt")} Éclair</span>` : ""}
    ${im(imgM(dg.boss), "dgboss", MONSTERS[dg.boss].name)}
    <div class="dgtxt"><b>${h(dg.name)}</b><span class="xs muted">niv. ${dg.lvl} · ${h(ZONES.find((z) => z.id === E.SUBS[E.DUNGEON_SUB[did]].zone).name)}</span>
      <span class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${dgStars(did)}${SI.max ? `<span class="pill">Stasis ${SI.max}/10</span>` : ""}
        ${un ? `<span class="pill key ${ks.k}">${IC("cle")} ${ks.txt}</span><span class="pill diff ${d.k}">${d.txt}</span>` : `<span class="pill">${G("lock")} ${h(E.SUBS[E.DUNGEON_SUB[did]].name)}</span>`}</span></div></div>`;
}
function dungeonsHtml() {
  const all = Object.keys(DUNGEONS); const f = ui.dgFilter || "all";
  const list = all.filter((id) => f === "all" ? true : f === "open" ? E.dungeonUnlocked(S, id) : f === "key" ? dgKeyState(id).k !== "no" && E.dungeonUnlocked(S, id) : (S.dgFav || []).includes(id))
    .sort((a, b) => ui.dgSort === "zone" ? E.SUBS[E.DUNGEON_SUB[a]].zone.localeCompare(E.SUBS[E.DUNGEON_SUB[b]].zone) || DUNGEONS[a].lvl - DUNGEONS[b].lvl : DUNGEONS[a].lvl - DUNGEONS[b].lvl);
  const done = all.filter((d) => S.progress.bossKills[d]).length; const s5 = all.filter((d) => ((S.stasis || {})[d] || {}).max >= 5).length; const s10 = all.filter((d) => ((S.stasis || {})[d] || {}).max >= 10).length;
  return `<section class="panel"><div class="phead"><h2>Donjons</h2><span class="small muted">${done}/${all.length} terminés · ★ ${s5} en stasis 5 · ★★ ${s10} en stasis 10</span></div>
    <div class="pad stack" style="gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="seg">${[["all", "Tous"], ["open", "Accessibles"], ["key", "Clé disponible"], ["fav", "Favoris"]].map(([v, n]) => `<button data-act="dgfilter" data-v="${v}" aria-pressed="${f === v}">${n}</button>`).join("")}</span>
        <select class="small" data-act="dgsort"><option value="lvl" ${ui.dgSort !== "zone" ? "selected" : ""}>Par niveau</option><option value="zone" ${ui.dgSort === "zone" ? "selected" : ""}>Par zone</option></select></div>
      ${weeklyBanner()}
      ${flashBanner()}
      <p class="note xs">Chaque donjon a 10 niveaux de <b>stasis</b> : plus difficiles, mais plus d'XP et de butin, avec un coffre au premier passage de chaque niveau. Touchez un donjon pour le détail.</p>
      <div class="dggrid">${list.map(dungeonCard).join("") || `<div class="empty">Aucun donjon dans ce filtre.</div>`}</div></div></section>`;
}
function compSuggest(did) {
  const K = S.comps || []; if (!K.length) return ""; const cur = E.compMatch(S); const best = (S.compDg || {})[did];
  return `<div class="compsug"><b>Composition</b> ${K.map((k, i) => `<button class="btn sm ${i === cur ? "primary" : ""}" data-act="compuse" data-i="${i}" data-dg="${did}" ${i === cur || S.dungeon ? "disabled" : ""}>${i === cur ? "✓ " : ""}${h(k.name)}${i === best ? ` <span class="xs">${G("star")} gagnante ici</span>` : ""}</button>`).join("")}</div>`;
}
function dungeonSheet(did) {
  const dg = DUNGEONS[did]; const B = MONSTERS[dg.boss]; const un = E.dungeonUnlocked(S, did); const SI = E.stasisInfo(S, did);
  const k = clamp(ui.dgStasis || SI.sel || 1, 1, Math.min(10, SI.max + 1)); ui.dgStasis = k;
  const M = E.stasisMult(k); const stat = E.dungeonScrollStat(did); const d = dgDifficulty(did, k);
  const seen = E.bossSeen(S, did); const tips = E.bossTips(did);
  const mechs = E.bossMechs(did).map((m) => { const M = E.BOSS_MECHS[m]; return seen ? `<li>${M.sig ? `<span class="sigmk" data-tip="Mécanique unique de ce boss">${G("star")}</span> ` : ""}<b>${h(M.name)}</b> : ${h(M.desc)}</li>` : `<li><b>???</b> <span class="muted">${M.sig ? "mécanique unique, " : ""}à découvrir en affrontant le boss</span></li>`; }).join("");
  const sigA = E.BOSS_SIGS[did] ? E.ACH.find((a) => a.id === "sig_" + did) : null;
  const steps = E.STASIS_STEPS.filter(([n]) => n <= k && n > 1).map(([n, t]) => `<li class="${n === k ? "cur" : ""}"><b>${n}</b> ${h(t)}</li>`).join("");
  const keys = S.res[dg.key] || 0; const R = SPECIAL_CRAFTS[dg.key];
  const loot = (B.items || []).filter(([t]) => ITEMS[t]).slice(0, 12).map(([t, r]) => { const own = Object.values(S.items).some((x) => x.tpl === t); return `<span class="lootico ${own ? "own" : ""}" data-tip="${h(ITEMS[t].name)} · niv. ${ITEMS[t].lvl}${own ? " · déjà obtenu" : ""}">${im(itemImg(t), "", ITEMS[t].name)}</span>`; }).join("");
  const best = Object.entries(SI.best || {}).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([n, t]) => `stasis ${n} : ${dur(t)}`).join(" · ");
  const W = E.weekly(S); const wk = W && W.did === did ? E.STASIS_MODS[W.mod] : null;
  const FL = wk ? null : E.flashOf(S, did); const fl = FL ? E.STASIS_MODS[FL.mod] : null;
  const chainMax = Math.max(1, keys); const chainOpts = [1, 3, 5, 10].filter((x) => x === 1 || x <= chainMax);
  openSheet(`<div class="dghead">${im(imgM(dg.boss), "dgboss lg", B.name)}<div><h2 style="margin:0">${h(dg.name)}</h2><div class="small muted">Boss ${h(B.name)} · niv. ${dg.lvl} · ${dg.rooms.length + 1} salles · vaincu ${S.progress.bossKills[did] || 0} fois</div><div style="margin-top:4px">${dgStars(did)}</div></div></div>
    <div class="stack small" style="gap:10px">
      ${(() => { const sm = E.SMALL_TEAM[E.team(S).length]; return sm ? `<div class="smallbox">${G("shield")} <span><b>Bonus petit groupe (${sm.name.toLowerCase()})</b> : ${sm.hp >= 30 ? "votre héros a" : "vos héros ont"} <b>+${sm.hp} % de PV</b> et ${sm.hp >= 30 ? "subit" : "subissent"} <b>${String(sm.dr).replace(".", ",")} % de dégâts en moins</b> dans ce donjon.${sm.hp >= 30 ? " Les mécaniques qui visent plusieurs héros sont adoucies." : ""}</span></div>` : ""; })()}
      ${compSuggest(did)}
      ${wk ? `<div class="wkbox">${G("star")} <span><b>Mutateur de la semaine : ${h(wk.name)}</b> (${h(wk.desc.charAt(0).toLowerCase() + wk.desc.slice(1).replace(/\.$/, ""))}). Actif à toutes les stasis${k >= 6 ? ", il remplace un des modificateurs tirés au hasard" : ""}. En échange : <b>+${Math.round((E.WEEKLY_REW - 1) * 100)} % d'XP et de butin</b> et <b>+${Math.round((E.WEEKLY_DUST - 1) * 100)} % de poussière</b>, jusqu'à lundi (encore ${weeklyLeft()}).</span></div>` : ""}
      ${fl ? `<div class="wkbox fl">${G("bolt")} <span><b>Mutateur éclair : ${h(fl.name)}</b> (${h(fl.desc.charAt(0).toLowerCase() + fl.desc.slice(1).replace(/\.$/, ""))}). En échange : <b>+${Math.round((E.FLASH_REW - 1) * 100)} % d'XP et de butin</b> et <b>+${Math.round((E.FLASH_DUST - 1) * 100)} % de poussière</b>. Change dans ${flashLeft()} ; une course commencée garde le bonus jusqu'au bout.</span></div>` : ""}
      <div><b>Mécaniques du boss</b><ul class="dglist">${mechs}${k >= 3 ? "<li><i>+ une mécanique supplémentaire (stasis 3+)</i></li>" : ""}${FL && FL.mod === "ruse" ? "<li><i>+ une mécanique supplémentaire (mutateur éclair)</i></li>" : ""}</ul>
        <div class="row tips" style="gap:6px;flex-wrap:wrap;margin-top:4px"><span class="xs muted">Conseillé :</span>${tips.map((t) => `<span class="pill">${h(t)}</span>`).join("")}</div>
        ${sigA ? `<div class="xs muted" style="margin-top:4px">${IC("trophee")} Succès ${seen ? `« ${h(sigA.name)} »` : "caché"} : ${h(sigA.desc.charAt(0).toLowerCase() + sigA.desc.slice(1))} ${seen ? `Titre « ${h(sigA.title)} »` : "Un titre en récompense"}${S.ach[sigA.id] ? " · obtenu" : ""}.</div>` : ""}</div>
      ${(() => { const dfid = E.dofusOfDungeon(did); if (!dfid) return ""; const Df = E.DOFUS[dfid]; return `<div class="xs" style="margin:4px 0;color:var(--archi);display:flex;align-items:center;gap:6px">${im(dofusImg(dfid), "dfico", Df.name)}<span>${h(Df.name)} (${h(E.dofusBonusTxt(dfid))}) : quête dans Quêtes › Dofus, ou 1 chance sur ${Math.round(1 / E.DOFUS_DROP)} en butin dès la stasis ${E.DOFUS_DROP_STASIS}${E.dofusOwned(S, dfid) ? " · obtenu" : ""}</span></div>`; })()}
      <div><b>Stasis</b> <span class="xs muted">(meilleure : ${SI.max || "aucune"})</span>
        <div class="stasisrow">${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button class="sbtn ${n === k ? "on" : ""} ${n <= SI.max ? "done" : ""}" data-act="dgstasis" data-v="${n}" ${n > SI.max + 1 ? "disabled" : ""}>${n}</button>`).join("")}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0"><span class="pill">PV monstres +${Math.round((M.hp - 1) * 100)} %</span><span class="pill">Dégâts +${Math.round((M.dmg - 1) * 100)} %</span><span class="pill good">XP et butin +${Math.round((M.rew * (wk ? E.WEEKLY_REW : 1) * (fl ? E.FLASH_REW : 1) - 1) * 100)} %</span><span class="pill diff ${d.k}">${d.txt}</span></div>
        ${(() => { const fake = { mods: [], stasis: k }; const ids = E.idolsFor(S, fake); const sc = E.idolScore(S, fake, ids); return `<div class="row small" style="gap:6px;flex-wrap:wrap;margin:0 0 6px">${idolBtn(fake)}<span class="xs muted">${ids.length ? `En plus de la stasis : +${pctTxt(E.idolBonus(S, fake, ids))} % d'XP et de butin${sc > E.IDOL_DG_CAP ? ` (score compté jusqu'à ${E.IDOL_DG_CAP} en donjon)` : ""}${k >= 6 ? " · une idole en doublon avec un modificateur tiré ne compte pas" : ""}.` : "Aucune idole active : les idoles rendent le donjon plus dur contre plus d'XP et de butin."}</span></div>`; })()}
        ${steps ? `<ul class="dglist steps">${steps}</ul>` : `<p class="xs muted">Stasis 1 : le donjon normal${wk ? ", avec le mutateur de la semaine" : ""}.</p>`}
        ${k >= 6 ? `<p class="xs muted">Les modificateurs sont tirés au hasard à l'entrée : ${Object.values(E.STASIS_MODS).map((m) => `<b>${h(m.name)}</b> (${h(m.desc.toLowerCase())})`).join(", ")}.</p>` : ""}</div>
      <div><b>Récompenses</b><ul class="dglist">
        <li>${SI.firsts[k] ? "✓ Coffre de premier passage déjà obtenu" : `${IC("coffre")} Premier passage : ${k >= 8 ? "Coffre en or" : k >= 4 ? "Coffre en argent" : "Coffre en bois"} et ${k >= 8 ? 3 : k >= 4 ? 2 : 1} Pierre${k >= 4 ? "s" : ""} d'âme`}</li>
        <li>${IC("poussiere")} ${Math.round((k * 2 + (k >= 4 ? 4 : 0)) * (wk ? E.WEEKLY_DUST : 1) * (fl ? E.FLASH_DUST : 1))} Poussières de stasis à chaque victoire</li>
        <li>${IC("quetes")} Parchemins de <b>${h(STATS[stat].name)}</b> : Grand parchemin au premier passage en stasis 10 (un par héros), Petit parchemin rare sur le boss dès la stasis 6</li></ul>
        ${loot ? `<div class="xs muted" style="margin:4px 0">Butin du boss (en couleur : déjà obtenu)</div><div class="row" style="gap:4px;flex-wrap:wrap">${loot}</div>` : ""}</div>
      ${best ? `<div class="xs muted">Records : ${best}</div>` : ""}
      ${keyPanel(did)}
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${un ? `<label class="small row" style="gap:6px">Enchaîner <select data-act="dgchain">${chainOpts.map((x) => `<option value="${x}" ${(ui.dgChain || 1) === x ? "selected" : ""}>${x}×</option>`).join("")}</select></label>
      <button class="btn primary" data-act="enterdg" data-id="${did}" ${keys && !S.dungeon ? "" : "disabled"}>Entrer en stasis ${k}</button>` : `<span class="small muted">${G("lock")} Débloquez ${h(E.SUBS[E.DUNGEON_SUB[did]].name)} pour y accéder.</span>`}
      <button class="btn" data-act="closesheet">Fermer</button></div>`);
}
/* 0.1 : panneau de la clé du donjon (recette lisible, d'où vient chaque ingrédient) */
function keySource(r) {
  const L = resIndex().src[r] || []; const g = L.find((x) => x.job);
  if (g) return `<button class="btn xs" data-act="gathersheet" data-job="${g.job}">${IC("pioche")} ${h(GATHER_JOBS[g.job].name)} niv. ${g.lvl}</button>`;
  const m = L.find((x) => x.m && typeof subOfMon(x.m) !== "string" && subOfMon(x.m)) || L.find((x) => x.m); if (!m) return `<span class="xs muted">${r === E.RARE_COMPONENT ? "trouvailles, boss et coffres" : "source inconnue"}</span>`;
  const sb = subOfMon(m.m); const pct = E.resRate(m.p).toFixed(1).replace(".", ",");
  if (sb && typeof sb !== "string") return `<button class="btn xs" data-act="zoneview" data-id="${sb.id}" data-gotab="world" data-tip="${h(MONSTERS[m.m].name)} · ${pct} %">${IC("carte")} ${h(sb.name)}</button>`;
  return `<span class="xs muted">${h(MONSTERS[m.m].name)}${sb ? " · " + h(DUNGEONS[sb].name) : ""} · ${pct} %</span>`;
}
function keyPanel(did) {
  const dg = DUNGEONS[did]; const keys = S.res[dg.key] || 0; const R = SPECIAL_CRAFTS[dg.key];
  const sub = E.SUBS[E.DUNGEON_SUB[did]];
  const head = `<div class="kp-head">${im(resImg(dg.key), "kp-ico", dg.key)}<div class="kp-t"><b>${h(dg.key)}</b><span class="xs muted">${keys ? `<b class="num">${keys}</b> en stock · une clé par entrée` : "aucune clé en stock"}</span></div>`;
  if (!R) return `<div class="keypanel">${head}</div></div>`;
  const ing = R.ing.map(([r, q]) => ({ r, q, have: S.res[r] || 0 })).sort((a, b) => (a.have >= a.q) - (b.have >= b.q));
  const ok = ing.filter((x) => x.have >= x.q).length; const can = E.canCraft(S, R); const pinned = S.shop.some((e) => e.id === dg.key);
  const e = can ? null : E.needEta(S, R.ing);
  const eta = can ? `<span class="tag good">Prête à fabriquer</span>` : e.stuck ? `<span class="xs warn">Ta chasse actuelle ne donne pas tout : suis les boutons ci-dessous.</span>` : e.sec ? `<span class="xs muted">Prête ${h(E.etaTxt(e.sec))} en continuant ta chasse</span>` : "";
  return `<div class="keypanel">${head}
      <div class="kp-btns"><button class="btn sm ${can ? "primary" : ""}" data-act="dgcraftkey" data-id="${did}" ${can ? "" : "disabled"}>${IC("metiers")} Fabriquer</button><button class="btn sm" data-act="shoppin" data-k="special" data-id="${h(dg.key)}" data-tip="Suivre les ingrédients dans la liste de courses (Accueil)">${G("cart")}${pinned ? " ✓" : ""}</button></div></div>
    <div class="kp-prog"><div class="bar"><i style="width:${pct(ok, ing.length)}%"></i></div><span class="xs num">${ok}/${ing.length} ingrédients</span>${eta}</div>
    <div class="kp-list">${ing.filter((x) => x.have < x.q).map((x) => `<div class="kp-ing">${im(resImg(x.r), "kp-rico", x.r)}<span class="kp-n">${h(x.r)}</span><span class="kp-q num">${fmt(x.have)}/${x.q}</span><span class="kp-src">${keySource(x.r)}</span></div>`).join("")}</div>
    ${ok ? `<div class="kp-done"><span class="xs muted">Déjà réunis :</span>${ing.filter((x) => x.have >= x.q).map((x) => `<span class="kp-chip">${im(resImg(x.r), "", x.r)}${h(x.r)} ✓</span>`).join("")}</div>` : ""}
    ${sub && dg.keyDrop ? `<div class="xs muted">La clé tombe aussi parfois sur les monstres de <b>${h(sub.name)}</b>.</div>` : ""}
  </div>`;
}
function encyclopediaHtml() {
  const z = ZONES.find((x) => x.id === ui.encZone) || ZONES[0];
  const total = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].archiOf).length; const met = Object.keys(S.bestiary).filter((k) => MONSTERS[k] && !MONSTERS[k].archiOf).length;
  const subs = z.subs.map((s) => `<h3 class="sec">${h(s.name)} ${S.trophies && S.trophies[s.id] ? IC("trophee") : ""}</h3><div class="mons">${s.monsters.map((k) => encCard(k)).join("")}</div>`).join("");
  const dgs = Object.entries(DUNGEONS).filter(([id]) => E.SUBS[E.DUNGEON_SUB[id]]?.zone === z.id).map(([id, d]) => `<h3 class="sec">${h(d.name)}</h3><div class="mons">${encCard(d.boss)}</div>`).join("");
  const fams = Object.entries(E.RACE_MONS).map(([r, ks]) => { const done = S.families && S.families[r]; const n = ks.filter((k) => E.huntTier(S, k) >= 1).length;
    return `<div class="famrow ${done ? "done" : ""}"><b>${h(D.RACES[r] || r)}</b><span class="xs muted num">${n}/${ks.length} Traqueur</span>${done ? `<span class="tag good">+5 Vi</span>` : ""}</div>`; }).join("");
  return `<section class="panel"><div class="phead"><h2>Bestiaire</h2><span class="small muted num">${met}/${total} monstres rencontrés</span></div>
    <div class="pad"><div class="seg">${ZONES.map((x) => `<button data-act="enczone" data-v="${x.id}" aria-pressed="${x.id === z.id}">${h(x.name)}</button>`).join("")}</div>
    <p class="note" style="margin-top:8px">Paliers de chasse par monstre : ${HUNT_TIERS.map((t) => `<b>${t.name}</b> (${t.n}) ${t.desc.toLowerCase()}`).join(" · ")}.</p>${subs}${dgs}</div></section>
  <section class="panel"><div class="phead"><h2>Familles</h2><span class="xs muted">tous les monstres d'une famille au palier Traqueur : +5 Vitalité pour tous vos héros</span></div><div class="pad famgrid">${fams}</div></section>`;
}
function encCard(k) {
  const m = MONSTERS[k]; const kills = S.bestiary[k] || 0; const seen = S.seenDrops[k] || {}; const a = m.archi; const t = E.huntTier(S, k);
  const reveal = t >= 0;
  const drops = m.drops.map(([n, p]) => seen[n] || reveal ? `<span class="dropico" data-tip="${h(n)} · ${p} %">${im(resImg(n), "ico sm", n)}${reveal ? `<span class="xs">${p}%</span>` : ""}</span>` : `<span class="icobox" style="width:26px;height:26px;font-size:12px;color:var(--muted)" data-tip="Butin inconnu : obtenez-le une fois ou atteignez le palier Connaisseur">?</span>`).join("");
  return `<div class="mcard ${kills ? "" : "unknown"}" style="align-items:flex-start">${im(imgM(k), "mimg", m.name)}
    <div style="min-width:0;flex:1" class="stack"><div><div class="n">${kills ? h(m.name) : "???"}</div><div class="l">niv. ${m.lvl[0]}–${m.lvl[1]}${m.race !== undefined && D.RACES[m.race] ? ` · ${h(D.RACES[m.race])}` : ""}</div></div>
    ${m.boss ? `<div class="xs muted num">${fmt(kills)} vaincu${kills > 1 ? "s" : ""}</div>` : tierBadge(k)}
    <div class="row" style="gap:4px">${drops}</div>
    ${a ? `<div class="xs" style="color:var(--archi)">Archimonstre : ${S.archis[a] ? h(MONSTERS[a].name) + ` (×${S.archis[a]})` : "non rencontré"}${E.hasSoul(S, a) ? " · 💜 âme capturée" : ""}</div>` : ""}</div></div>`;
}
/* ---------- COMBAT ---------- */
function renderCombat() {
  const team = E.team(S); const fs = E.freeSpirit(S);
  const dg = S.dungeon ? DUNGEONS[S.dungeon.id] : null; const sub = S.sub ? E.SUBS[S.sub] : null;
  if (!ui.combatCid || !team.find((c) => c.id === ui.combatCid)) ui.combatCid = team[0] && team[0].id;
  const title = dg ? dg.name : S.fight && S.fight.prot && !S.fight.over ? S.fight.label : S.hunting && sub ? sub.name : "Aucun combat";
  $("#main").innerHTML = `
  <div class="pagehead combathead"><div><div class="small muted">${dg ? `Donjon · salle ${Math.min(S.dungeon.room + 1, dg.rooms.length + 1)} sur ${dg.rooms.length + 1}` : sub && S.hunting ? `${h(ZONES.find((z) => z.id === sub.zone).name)} · niv. ${sub.lvl[0]}–${sub.lvl[1]}` : "Votre équipe se repose"}</div><h1>${h(title)}</h1></div>
    <div class="row">${fsGauge()}<span class="seg mantoggle" data-tip="Mode manuel : à chaque tour d'un héros, choisissez le sort puis la cible. Sans action pendant ${E.MANUAL_TIMEOUT} s, ou si vous quittez cet écran, le combat repasse en automatique. Aucun bonus : c'est pour le plaisir !">${[[false, "Auto"], [true, "Manuel"]].map(([v, n]) => `<button data-act="manual" data-v="${v ? 1 : 0}" aria-pressed="${!!S.settings.manual === v}">${n}</button>`).join("")}</span>
      <label class="azchip" data-tip="Qui l'équipe frappe en premier (sorts réglés sur « le plus faible »). Les bombes et les totems passent toujours avant."><select data-act="focusset" class="small">${[["auto", "Cible : dangereux d'abord"], ["low", "Cible : le plus faible"], ["boss", "Cible : le boss"]].map(([v, n]) => `<option value="${v}" ${(S.settings.focus || "auto") === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      ${!dg && S.hunting ? `<label class="azchip" data-tip="Change de sous-zone automatiquement selon le niveau de l'équipe : monte quand tout se passe bien, redescend après plusieurs défaites."><input type="checkbox" data-act="autozone" ${S.settings.autoZone ? "checked" : ""}> Suivre mon niveau</label>` : ""}
      ${!dg && S.hunting ? `<label class="azchip" data-tip="Chasse itinérante : après une victoire, l'équipe part vers une zone de son niveau qui a au moins 2 étoiles de plus (une fois toutes les 10 min au plus, hors ligne aussi). En échange, XP et butin −${Math.round(E.ROAM_MALUS * 100)} % tant qu'elle est cochée.${(S.roamLog || []).length ? " Dernières zones : " + S.roamLog.map((z) => (E.SUBS[z] || {}).name).filter(Boolean).join(" ← ") : ""}"><input type="checkbox" data-act="roam" ${S.settings.roam ? "checked" : ""}> Itinérante <span class="xs muted">−${Math.round(E.ROAM_MALUS * 100)} %</span></label>` : ""}
      ${idolBtn(S.dungeon)}${dg ? `<button class="btn sm danger" data-act="leavedg">Quitter le donjon</button>` : S.hunting ? `<button class="btn sm" data-act="stophunt">Rentrer</button>` : ""}</div></div>
  <section class="grid2 combatgrid" data-ctab="${ui.ctab || "sorts"}">
    <div class="panel combatpanel">
      <div class="arenasticky">
        <div class="cstrip"><div class="chalov" id="chalov"></div><span class="cstreak" id="cstreak"></span><span class="seg viewtog" data-tip="Scène : les personnages en pied. Compacte : une carte par combattant, plus lisible avec beaucoup de héros.">${[["scene", "Scène"], ["compact", "Compacte"]].map(([v, n]) => `<button data-act="cview" data-v="${v}" aria-pressed="${combatView() === v}">${n}</button>`).join("")}</span><span class="ctour" id="ctour"></span></div>
        <div class="arenawrap"><div class="arena" id="arena"></div></div>
        <div class="ftick" id="turn"></div>
      </div>
      <div class="chalbar" id="chalbar"></div>
      <div id="await"></div>
      <div class="ctabs">${[["sorts", "Sorts"], ["journal", "Journal"], ["butin", "Butin"]].map(([v, n]) => `<button data-act="ctab" data-v="${v}" aria-pressed="${(ui.ctab || "sorts") === v}">${n}</button>`).join("")}</div>
      <div class="csec-sorts">
        <div class="pad" style="padding-bottom:0" id="cbar">${consBar(false)}</div>
        <div class="herotabs">${team.map((c) => `<button data-act="combatcid" data-id="${c.id}" aria-pressed="${ui.combatCid === c.id}">${head(c)}${h(c.name)}</button>`).join("")}</div>
        <div class="pabar">PA <span class="pips" id="pips"></span><span style="margin-left:auto">Stratégie : <b id="stratName" style="color:var(--ink)">—</b> <button class="btn sm" data-act="gospells">Modifier</button></span></div>
        <div class="spells" id="spells"></div><div class="spnames" id="spnames"></div>
      </div>
      <div class="csec-journal"><div class="log" id="flog"></div></div>
    </div>
    <div class="stack csec-butin">
      <div class="panel"><div class="phead"><h2>Butin</h2><span class="small muted" id="fres"></span></div><div class="pad" id="floot"></div></div>
      <div class="panel"><div class="phead"><h2>Derniers combats</h2></div><div class="pad" id="fhist">${historyHtml(6)}</div></div>
    </div>
  </section>
`;
  ui.arena = null; updateCombat(true);
}
function spellTip(sp, lvl) { const g = E.spellGrade(sp, lvl || 200); return `${sp.name} · ${g.pa} PA${g.cd ? ` · relance ${g.cd} tour${g.cd > 1 ? "s" : ""}` : ""}${g.casts ? ` · ${g.casts} lancer${g.casts > 1 ? "s" : ""}/tour` : ""} — ${spellDesc(sp, lvl).replace(/<[^>]+>/g, "").trim()}`; }
const spEl = (sp) => (sp.el && sp.el !== "best" ? sp.el : sp.el === "best" ? "n" : "buff");
function spellBarFor(c, ent, F) {
  const N = E.spellSlots(c); const slots = c.spells.slice(0, N);
  const A = F && F.await && ent && F.ents[F.await.ei] === ent ? F.await : null;
  const lastCast = {};
  if (F && ent) { const idx = F.ents.indexOf(ent); F.fx.forEach((f) => { if (f.k === "cast" && f.s === idx) lastCast[f.sp] = f.seq; }); }
  const html = Array.from({ length: N }, (_, i) => {
    const x = slots[i]; if (!x) return `<div class="sp empty"></div>`;
    const sp = E.spellDef(c.cls, x.id); if (!sp) return `<div class="sp empty"></div>`; const g = E.spellGrade(sp, c.lvl); const cd = ent && ent.cd ? (ent.cd[sp.id] || 0) : 0;
    const cast = F && lastCast[sp.id] !== undefined && F.seq - lastCast[sp.id] <= 1;
    const can = A ? E.manualCanCast(S, sp) : false;
    return `<div class="sp ${cast ? "cast" : ""} ${A ? (can ? "can" : "no") : ""} ${A && ui.manualSpell === sp.id ? "sel" : ""}" style="--c:${elVar(spEl(sp))}" data-tip="${h(spellTip(sp, c.lvl))}" ${A && can ? `data-act="mspell" data-id="${sp.id}"` : ""}>${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : `<span class="glyph">✦</span>`}<span class="pa">${g.pa}</span>${cd > 1 ? `<span class="cd">${cd - 1}</span>` : ""}</div>`;
  }).join("");
  return { html, names: Array.from({ length: N }, (_, i) => `<div>${slots[i] && E.spellDef(c.cls, slots[i].id) ? h(E.spellDef(c.cls, slots[i].id).name) : ""}</div>`).join("") };
}
/* vue de combat : scène (personnages en pied) ou compacte (cartes) */
function combatView() { const v = S.settings.cview; if (v === "scene" || v === "compact") return v; return window.innerWidth < 640 && E.team(S).length >= 6 ? "compact" : "scene"; }
/* formation en quinconce : rangée avant (basse) puis rangées arrière décalées d'un demi-pas */
function arenaLayout(F) {
  const mob = window.innerWidth < 640;
  const sides = { c: [], m: [] }, sums = []; F.ents.forEach((e, i) => (e.summon ? sums : sides[e.side === "c" ? "c" : "m"]).push(i));
  sides.c.sort((a, b) => (F.ents[a].row === "b") - (F.ents[b].row === "b")); // 3.3.0 : la première ligne devant
  const rowsOf = (n) => (n <= 1 ? 1 : n <= 6 ? 2 : 3);
  const rows = Math.max(rowsOf(sides.c.length), rowsOf(sides.m.length));
  const perRow = Math.max(1, ...["c", "m"].map((k) => Math.ceil(sides[k].length / Math.max(1, rowsOf(sides[k].length)))));
  const h = mob ? (rows <= 2 ? (perRow >= 3 ? 92 : 104) : 76) : (rows <= 2 ? (perRow >= 4 ? 128 : 148) : 112);
  const plate = mob ? 30 : 36, lift = rows <= 2 ? (mob ? 0.7 : 0.76) : 0.55;
  const step = mob ? Math.min(21, 41 / perRow) : Math.min(14, 41 / perRow), x0 = mob ? 40 : 43;
  const AW = (ui.arena && ui.arena.el && ui.arena.el.clientWidth) || (mob ? 360 : 700);
  const w = Math.max(56, Math.min(mob ? 82 : 110, Math.round((step / 100) * AW * 1.05)));
  const pos = [];
  ["c", "m"].forEach((k) => { const L = sides[k], R = rowsOf(L.length);
    L.forEach((ei, n) => { const r = n % R, jx = Math.floor(n / R); const x = x0 - jx * step - r * step / 2;
      pos[ei] = { x: k === "c" ? x : 100 - x, y: 8 + r * (plate + h * lift), z: 30 - r * 10 - jx }; }); });
  /* invocations : petites, devant l'équipe, au centre de l'arène */
  sums.forEach((ei, k) => { pos[ei] = { x: (mob ? 47 : 48) - (k % 3) * (mob ? 7 : 5), y: 8 + Math.floor(k / 3) * (plate + h * 0.3) + (k % 2) * 10, z: 40 - k }; });
  const H = Math.max(mob ? 250 : 300, Math.round(8 + (rows - 1) * (plate + h * lift) + plate + h + (mob ? 34 : 40)));
  return { h, plate, w, pos, H };
}
/* l'arène reste visible en haut (mobile) seulement si elle laisse de la place au reste */
function stickyCheck() { const st = document.querySelector(".arenasticky"); if (!st) return; st.classList.toggle("stick", st.offsetHeight < window.innerHeight * 0.58); }
function placeEnts(F) {
  const A = ui.arena; if (!A || A.view !== "scene" || !F) return;
  const L = arenaLayout(F); A.el.style.height = L.H + "px";
  A.el.style.setProperty("--h", L.h + "px"); A.el.style.setProperty("--plate", L.plate + "px"); A.el.style.setProperty("--w", L.w + "px");
  F.ents.forEach((e, i) => { const n = A.nodes[i], p = L.pos[i]; if (!n || !p) return; n.style.left = p.x + "%"; n.style.bottom = p.y + "px"; n.style.zIndex = p.z; });
  stickyCheck();
}
/* 3.3.0 : infobulles et classes de rangée, Champion et rôle */
const rowCls = (e) => (e.side === "c" && !e.summon ? (e.row === "b" ? "back" : "front") : "");
function entTip(e) {
  if (e.side === "c") return e.name + (e.row === "f" ? " · première ligne" : e.row === "b" ? " · arrière" : "");
  let t = `${e.name}${e.lvl ? " niv. " + e.lvl : ""}`;
  if (e.champ) { const P = E.CHAMP_POWERS[e.champ]; t += ` — Champion · ${P.name} : PV ×2, dégâts +20 %. ${P.desc} Récompense : XP ×3, butin ×2, une ressource garantie.`; }
  if (e.role) t += ` — ${E.MON_ROLES[e.role].name} : ${E.MON_ROLES[e.role].desc}`;
  return t;
}
function buildArena(F) {
  const arena = $("#arena"); if (!arena) return;
  const deco = F && F.dungeon ? dgDeco(F.dungeonId) : subDeco(F ? F.sub : S.sub);
  const view = combatView();
  const so = { fx: decoFx() && !(F && F.dungeon) ? subWeather(F ? F.sub : S.sub) : "", boss: !!(F && F.bossIdx !== undefined), anim: decoFx() };
  ui.arena = { el: arena, fid: F ? F.id : null, nodes: [], lastSeq: 0, lastLog: -1, over: false, theme: isDark(), view };
  arena.className = "arena " + (view === "compact" ? "cmpmode" : "v2"); arena.style.height = "";
  if (!F) {
    arena.innerHTML = sceneSVG(S.sub ? deco : "sky", 270, "arena" + (S.sub || ""), { fx: so.fx }) + `<div class="idle"><div>${S.hunting || S.dungeon ? "Recherche d'un groupe de monstres…" : `Votre équipe se repose.<br><button class="btn primary sm" data-tab="world" style="margin-top:8px">Choisir une zone</button>`}</div></div>`;
    return;
  }
  const pasDiv = `<div class="pas"></div>`;
  const entHtml = view === "compact" ? ([e, i]) => {
    const c = e.side === "c" && !e.summon ? char(e.cid) || { cls: e.cls, sex: "m", name: e.name } : null;
    const pic = c ? `<span class="cico hd" style="--cc:${CLASSES[e.cls].color}">${im(headImg(c), "", e.name)}</span>` : e.img ? `<span class="cico">${im(`assets/m/${e.img}.png`, "", e.name)}</span>` : `<span class="cico">✦</span>`;
    const rn = c && c.ren ? `<span class="renk">✦ ${E.roman(c.ren)}</span>` : "";
    return `<div class="ent card ${e.side === "c" ? "hero" : "m"} ${e.summon ? "summon" : ""} ${e.archi ? "archi" : ""} ${e.boss ? "boss" : ""} ${e.champ ? "champ" : ""} ${rowCls(e)} ${c && c.ren ? "ren" : ""}" data-i="${i}" data-act="mtarget" data-tip="${h(entTip(e))}">${pic}<div class="t"><div class="who">${h(e.name)}${rn}</div><div class="hpb"><i></i><b></b></div><div class="row2"><span class="hpn"></span>${c ? pasDiv : ""}</div></div></div>`;
  } : ([e, i]) => {
    if (e.summon) return `<div class="ent hero summon" data-i="${i}" data-act="mtarget" data-tip="${h(e.name)} (invocation)"><div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div>${e.img ? im(`assets/m/${e.img}.png`, "sprite", e.name) : `<span class="medal">✦</span>`}</div>`;
    if (e.side === "c") { const c = char(e.cid) || { cls: e.cls, sex: "m", name: e.name };
      const cst = c.id ? E.charStats(S, c) : null; const rad = c.id ? E.radiantWorn(S, c) : 0;
      return `<div class="ent hero ${rad ? "radiant" : ""} ${rowCls(e)} ${c.ren ? "ren" : ""}" data-i="${i}" data-act="mtarget" style="--el:${cst ? elVar(E.domEl(cst)) : "transparent"}"${e.row === "f" ? ` data-tip="${h(e.name)} · première ligne"` : ""}><div class="who">${e.row === "f" ? `<span class="rowmk">${G("shield")}</span>` : ""}${h(e.name)}${c.ren ? `<span class="renk">✦ ${E.roman(c.ren)}</span>` : ""}</div><div class="hpb"><i></i><b></b></div>${pasDiv}${c.ren ? `<span class="fire"></span>` : ""}${c.id && LK.CLASS_LOOKS[e.cls] ? `<div class="lookwrap">${lookImg(c, "look")}</div>` : `<div class="medal" style="--cc:${CLASSES[e.cls].color}">${im(headImg(c), "", e.name)}</div>`}</div>`; }
    return `<div class="ent m ${e.archi ? "archi" : ""} ${e.boss ? "boss" : ""} ${e.champ ? "champ" : ""}" data-i="${i}" data-act="mtarget" data-tip="${h(entTip(e))}">${e.champ ? `<span class="crown">${G("crown")}</span>` : ""}<div class="who">${h(e.name)}</div><div class="hpb"><i></i><b></b></div>${e.role ? `<span class="mrole">${h(E.MON_ROLES[e.role].name)}</span>` : ""}${im(`assets/m/${e.img}.png`, "sprite", e.name)}</div>`;
  };
  const list = (k) => F.ents.map((e, i) => [e, i]).filter(([e]) => (e.side === "c") === (k === "c")).map(entHtml).join("");
  arena.innerHTML = view === "compact"
    ? `<div class="cmp"><div class="col c">${list("c")}</div><div class="col m">${list("m")}</div></div><div class="result" id="fresult"></div>`
    : sceneSVG(deco, 270, F.dungeon ? "dg" + F.label : "arena" + F.sub, so) + `<div class="fxg"></div><div class="ents">${F.ents.map((e, i) => entHtml([e, i])).join("")}</div><div class="fxl"></div><div class="result" id="fresult"></div>`;
  arena.querySelectorAll(".ent").forEach((n) => (ui.arena.nodes[+n.dataset.i] = n));
  ui.arena.fxl = arena.querySelector(".fxl"); ui.arena.fxg = arena.querySelector(".fxg"); if (view !== "compact") ui.arena.nodes.forEach((n, i) => axDecor(n, F.ents[i]));
  ui.arena.entHtml = entHtml; ui.arena.nEnts = F.ents.length;
  const t = $("#turn"); if (t) t.textContent = F.label;
  placeEnts(F); stickyCheck();
  if (F.bossIdx !== undefined && F.round === 1 && !F.over && ui.bossIntro !== F.id) bossIntro(F);
}
/* bandeau des challenges et mécaniques de boss */
const CHAL_ICON = (id) => IC("chal_" + (["survivant", "versatile", "econome", "focus", "elitiste", "ordonne", "incurable", "elementaire", "rapide", "chacun", "barbare"].includes(id) ? id : "focus"), "mono");
function chalOverlayHtml(F) {
  if (!F || !(F.chals || []).length) return "";
  return F.chals.map((c) => { const C = E.CHALLENGES[c.id]; const state = !c.ok ? "ko" : F.over && F.result === "win" ? "ok" : "run";
    const sub = c.id === "rapide" ? `<div class="prog"><i style="width:${Math.min(100, (F.round / c.turns) * 100)}%"></i></div>` : `<div class="d">${h(c.id === "elitiste" && F.ents[c.target] ? "Cible : " + F.ents[c.target].name : C.desc)}</div>`;
    return `<div class="chx ${state}" data-tip="${h(C.desc + (c.why ? " — échoué : " + c.why : ""))}"><div class="ic">${state === "ok" ? "✓" : state === "ko" ? "✕" : CHAL_ICON(c.id)}</div><div class="tx"><div class="t">${h(C.name)}${c.id === "rapide" ? ` · tour ${Math.min(F.round, c.turns)}/${c.turns}` : ""}</div>${state === "ko" && c.why ? `<div class="d">${h(c.why)}</div>` : sub}</div><div class="bon">+${c.bonus} %</div></div>`; }).join("");
}
/* ===================== 0.1.10 : idoles ===================== */
const idolImg = (id) => `assets/id/${E.IDOLS[id].fam}.webp`;
const idolPic = (id, cls = "") => { const I = E.IDOLS[id]; const F = E.IDOL_FAMS[I.fam]; return `<span class="ipic r${I.rank} f-${I.fam} ${cls}" style="--c:${F.color}"><i class="fx"></i>${im(idolImg(id), "", I.name)}</span>`; };
const idolFamTag = (fam) => `<span class="ifam" style="--c:${E.IDOL_FAMS[fam].color}">${h(E.IDOL_FAMS[fam].name)}</span>`;
const idolIco = () => `<img class="uico" src="assets/id/pro.webp" alt="">`;
const pctTxt = (x) => String(x).replace(".", ",");
/* bouton « Idoles » (combat, chasse, donjon, Équipe) : score et bonus des idoles actives */
function idolBtn(dg, cls = "btn sm") {
  const ids = E.idolsFor(S, dg); const n = ids.length; const sc = E.idolScore(S, dg, ids); const b = n ? E.idolBonus(S, dg, ids) : 0;
  return `<button class="${cls} idolbtn ${n ? "on" : ""}" data-act="idols" data-tip="Idoles : des statuettes qui rendent les combats plus durs contre plus d'XP et de butin (+${pctTxt(E.IDOL_PCT)} % par point de score). ${n ? `${n} active${n > 1 ? "s" : ""}, score ${sc}.` : "Aucune idole active."}">${n ? ids.slice(0, 3).map((id) => im(idolImg(id), "iico", E.IDOLS[id].name)).join("") : idolIco()} Idoles${n ? ` · <b class="num">${sc}</b> · +${pctTxt(b)} %` : ""}</button>`;
}
function idolSheet() {
  const A = S.idols.active; const dg = S.dungeon; const ids = E.idolsFor(S, dg); const score = E.idolScore(S, dg, ids); const bonus = E.idolBonus(S, dg, ids);
  const risk = E.idolRisk(S, null, dg); const own = E.idolCount(S); const J = S.crafts.bricoleur || { lvl: 1 };
  const slots = A.map((id) => { const I = E.IDOLS[id]; const off = !ids.includes(id);
    return `<div class="islot ${off ? "off" : ""}" data-tip="${h(I.desc)}${off ? " · Ne compte pas dans ce donjon : elle fait doublon avec un modificateur de stasis." : ""}">${idolPic(id)}<span class="n">${h(I.name)}</span><b class="num">${off ? "—" : I.score}</b><button class="btn sm ghost" data-act="idoltog" data-id="${id}">Retirer</button></div>`; }).join("")
    + Array.from({ length: E.IDOL_MAX - A.length }, () => `<div class="islot empty"><span>Libre</span></div>`).join("");
  const presets = [0, 1, 2].map((i) => { const P = S.idols.presets[i]; const full = P && P.ids.length;
    return `<span class="ipreset"><button class="btn sm" data-act="idolpload" data-i="${i}" ${full ? "" : "disabled"} data-tip="${full ? h(P.ids.map((x) => E.IDOLS[x] ? E.IDOLS[x].name : x).join(", ")) : "Jeu vide : activez des idoles puis enregistrez-les ici"}">${full ? h(P.name) : `Jeu ${i + 1}`}</button><button class="btn sm ghost" data-act="idolpsave" data-i="${i}" ${A.length ? "" : "disabled"} data-tip="Enregistrer les idoles actives dans ce jeu">Enregistrer</button></span>`; }).join("");
  const fams = Object.keys(E.IDOL_FAMS).map((f) => {
    const cur = A.find((x) => E.IDOLS[x].fam === f);
    const cards = E.idolsOf(f).map((id) => { const I = E.IDOLS[id]; const on = A.includes(id); const got = E.idolOwned(S, id); const name = E.idolCraftName(id); const R = SPECIAL_CRAFTS[name]; const can = !got && J.lvl >= I.lvl; const ok = can && E.canCraft(S, R);
      const state = on ? "Active" : got ? "Dans la collection" : can ? `Fabricable · Bricoleur niveau ${I.lvl}` : `Bricoleur niveau ${I.lvl} requis (vous : ${J.lvl})`;
      const btn = on ? `<button class="btn sm ghost" data-act="idoltog" data-id="${id}">Retirer</button>` : got ? `<button class="btn sm primary" data-act="idoltog" data-id="${id}">Activer</button>` : can ? `<button class="btn sm ${ok ? "primary" : ""}" data-act="idolcraft" data-id="${id}" ${ok ? "" : "disabled"}>${IC("metiers")} Fabriquer</button>` : `<span class="tag soft">${G("lock")} Bricoleur ${I.lvl}</span>`;
      const ing = can ? `<div class="ing xs">${R.ing.map(([r, q]) => `<span class="${(S.res[r] || 0) >= q ? "ok" : "ko"}" title="${h(r)}">${im(resImg(r), "", r)}${h(r)} <b class="num">${fmt(S.res[r] || 0)}/${q}</b></span>`).join("")}</div>` : "";
      return `<div class="idol ${on ? "on" : got ? "own" : can ? "craft" : "lock"}">${idolPic(id)}<div class="t"><div class="nm">${h(I.name)} <b class="sc num">${I.score}</b></div><p>${h(I.desc)}</p><span class="xs muted">${state}${!on && (got || can) && cur ? ` · <span class="warn">remplace ${h(E.IDOLS[cur].name)}</span>` : ""}</span>${ing}</div>${btn}</div>`; }).join("");
    return `<div class="ifamrow"><div class="ifh">${idolFamTag(f)}<span class="xs muted">une seule active à la fois</span></div><div class="ifgrid">${cards}</div></div>`;
  }).join("");
  openSheet(`<h2>${idolIco()} Idoles</h2>
    <p class="small muted">Jusqu'à ${E.IDOL_MAX} idoles actives, une par famille. Chaque idole rend les combats plus durs et ajoute son score : <b>+${pctTxt(E.IDOL_PCT)} % d'XP et de butin par point</b>, en plus de la stasis (jusqu'à +${pctTxt(E.IDOL_MAXSCORE * E.IDOL_PCT)} % en chasse ; en donjon le score compte jusqu'à ${E.IDOL_DG_CAP}, soit +${E.IDOL_DG_CAP * E.IDOL_PCT} %). Une idole qui fait doublon avec un modificateur de stasis ne compte pas. Elles se fabriquent une seule fois chez le Bricoleur et s'appliquent au prochain combat.</p>
    <div class="islots">${slots}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill">Score <b class="num">${score}</b>${dg && score > E.IDOL_DG_CAP ? ` <span class="muted">(${E.IDOL_DG_CAP} comptés en donjon)</span>` : ""}</span><span class="pill good">XP et butin +${pctTxt(bonus)} %</span>${A.length ? `<span class="pill diff ${risk.k}">${risk.txt}</span><button class="btn sm ghost" data-act="idolclear">Tout retirer</button>` : ""}</div>
    <div class="row small" style="gap:6px;flex-wrap:wrap"><span class="muted">Jeux d'idoles :</span>${presets}</div>
    <div class="xs muted">${own} / ${E.IDOL_ORDER.length} idoles dans la collection${S.cnt && S.cnt.idolBest ? ` · meilleur score en victoire : ${S.cnt.idolBest}` : ""}</div>
    <div class="stack" style="gap:10px">${fams}</div>
    <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
/* ---------- 0.1.13 : album des archimonstres et Dofus ---------- */
const dofusImg = (id) => imgI(E.DOFUS[id].icon);
const archiZoneName = (z) => E.zoneName(z);
function archiBtn(cls = "btn sm") {
  const n = E.soulCount(S); const st = E.stones(S);
  return `<button class="${cls} archibtn ${n ? "on" : ""}" data-act="archis" data-tip="Album des archimonstres : ${n} âme${n > 1 ? "s" : ""} capturée${n > 1 ? "s" : ""} sur ${E.ARCHI_TOTAL}. ${st ? `${st} Pierre${st > 1 ? "s" : ""} d'âme en sac.` : "Aucune Pierre d'âme : fabriquez-en chez le Bricoleur (niveau 25)."}">${IC("dofus")} Âmes <b class="num">${n}</b> / ${E.ARCHI_TOTAL}</button>`;
}
function archiPill(F) {
  const st = E.stones(S); const b = S.boosts && S.boosts.piste; const left = b && b.until > Date.now() ? Math.round((b.until - Date.now()) / 1000) : 0;
  const here = F && F.ents.some((e) => e.side === "m" && e.archi && e.alive);
  const odds = Math.round(1 / E.archiOdds(S));
  return `<span class="pill archipill ${here ? "good" : ""}" data-act="archis" data-tip="Chance d'archimonstre : 1 sur ${odds} par monstre${left ? ` (Parfum de pistage encore ${dur(left)})` : ""}. ${st ? `${st} Pierre${st > 1 ? "s" : ""} d'âme pour capturer les âmes.` : "Sans Pierre d'âme, l'âme d'un archimonstre vaincu s'échappe."}">${here ? "Archimonstre ! " : ""}🔮 ${st} pierre${st > 1 ? "s" : ""}${left ? ` · 🧴 ${dur(left)}` : ""}</span>`;
}
function archiSheet() {
  const zones = E.ARCHI_ZONES; if (!ui.az || !zones.includes(ui.az)) ui.az = zones.find((z) => E.soulCount(S, z) < E.archisOf(z).length) || zones[0];
  const f = ui.azf || "all"; const st = E.stones(S); const b = S.boosts && S.boosts.piste; const left = b && b.until > Date.now() ? Math.round((b.until - Date.now()) / 1000) : 0;
  const tot = E.soulCount(S); const tier = E.ocreTier(S); const odds = Math.round(1 / E.archiOdds(S));
  const tabs = zones.map((z) => { const L = E.archisOf(z); const d = E.soulCount(S, z);
    return `<button class="ztab ${z === ui.az ? "on" : ""} ${d === L.length ? "done" : ""}" data-act="aztab" data-v="${z}"><b>${h(archiZoneName(z))}</b><span class="num">${d} / ${L.length}</span><span class="bar"><i style="width:${pct(d, L.length)}%"></i></span></button>`; }).join("");
  const L = E.archisOf(ui.az).filter((a) => f === "all" || (f === "todo" && !E.hasSoul(S, a.k)) || (f === "soul" && E.hasSoul(S, a.k)));
  const cards = L.map((a) => { const soul = E.hasSoul(S, a.k); const n = S.archis[a.k] || 0; const stt = soul ? "soul" : n ? "seen" : "unk";
    return `<div class="acard ${stt}">${im(imgM(a.k), "apic", a.name)}<div class="t"><b>${h(a.name)}</b><span class="w">niv. ${a.lvl[0]}–${a.lvl[1]} · ${h(E.SUBS[a.sub].name)}</span><span class="w">archimonstre de ${h(a.base)}</span><div class="st">${soul ? `<span class="s">💜 Âme capturée</span>` : n ? `<span class="k">vaincu ×${n}</span><span>pas de pierre</span>` : "<span>Jamais croisé</span>"}${soul && n > 1 ? `<span class="k">vaincu ×${n}</span>` : ""}</div></div></div>`; }).join("") || `<div class="empty">Rien à afficher avec ce filtre.</div>`;
  const ocre = E.OCRE_TIERS.map((T, i) => { const [d, all] = E.ocreProgress(S, i); const cls = i < tier ? "ok" : d ? "cur" : "";
    return `<div class="otier ${cls}"><b>Palier ${i + 1} · ${h(T.name)}</b><span class="bar"><i style="width:${pct(d, all)}%"></i></span><span class="num xs">${d} / ${all}</span><span class="r xs">${i < tier ? "✓ " : ""}${h(T.txt)}</span></div>`; }).join("");
  openSheet(`<div class="row between"><h2>${IC("dofus")} Album des archimonstres</h2><button class="btn sm ghost" data-act="closesheet">Fermer</button></div>
    <p class="small">Un archimonstre vaincu laisse son âme dans l'album si vous avez une <b>Pierre d'âme</b> en sac (automatique, une pierre par archimonstre). Les pierres se fabriquent chez le Bricoleur (niveau 25, 5 par recette), tombent au premier passage de chaque stasis, se vendent au Bureau des primes et récompensent les paliers d'<b>Éternelle moisson</b>.</p>
    <div class="row small" style="gap:8px;flex-wrap:wrap"><span class="pill">🔮 ${st} Pierre${st > 1 ? "s" : ""} d'âme</span><span class="pill">💜 ${tot} / ${E.ARCHI_TOTAL} âmes</span><span class="pill" data-tip="Chances de base 1 sur ${Math.round(1 / E.ARCHI_CHANCE)} par monstre. Ecaflip ×1,5, Bonbon Traqueur ×1,5, Parfum de pistage ×2 (Bricoleur 40, 2 h), meuble « Autel des âmes » ×1,4, palier Fléau ×2 sur le monstre.">🎯 1 chance sur ${odds}${left ? ` · 🧴 parfum ${dur(left)}` : ""}</span></div>
    <div class="ztabs">${tabs}</div>
    <div class="row between small" style="margin:8px 0 4px"><b>${h(archiZoneName(ui.az))} · ${E.soulCount(S, ui.az)} / ${E.archisOf(ui.az).length} âmes</b><span class="seg">${[["all", "Tous"], ["todo", "À capturer"], ["soul", "Capturées"]].map(([v, n]) => `<button data-act="azf" data-v="${v}" aria-pressed="${f === v}">${n}</button>`).join("")}</span></div>
    <div class="agrid">${cards}</div>
    <h3 class="sec" style="margin-top:12px">Éternelle moisson · quête du Dofus Ocre</h3>
    <p class="xs muted">Capturez l'âme de tous les archimonstres, palier par palier. Chaque palier accompli donne sa récompense aussitôt ; le dernier offre le Dofus Ocre (+1 PA).</p>
    <div class="stack" style="gap:6px">${ocre}</div>`);
}
function dofusHtml() {
  const own = E.dofusCount(S); const tier = E.ocreTier(S);
  const cards = E.DOFUS_ORDER.slice().sort((a, b) => E.DOFUS[a].lvl - E.DOFUS[b].lvl || (E.DOFUS[a].name < E.DOFUS[b].name ? -1 : 1)).map((id) => {
    const Df = E.DOFUS[id]; const Q = E.dofusQuest(S, id); const owned = E.dofusOwned(S, id); const by = E.dofusWornBy(S, id);
    const stt = Q.done || owned ? "got" : Q.step > 0 || E.dofusStepProgress(S, id, 0)[0] > 0 || (id === "ocre" && E.soulCount(S) > 0) ? "run" : "lock";
    const state = Q.done ? `Quête terminée${by ? ` · porté par ${h(by.name)}` : owned ? " · dans le sac" : ""}` : owned ? `Obtenu en butin${by ? ` · porté par ${h(by.name)}` : ""} · quête en cours` : stt === "run" ? "Quête en cours" : "Quête à commencer";
    const steps = id === "ocre" ? E.OCRE_TIERS.map((T, i) => { const [d, all] = E.ocreProgress(S, i); return `<li class="${i < tier ? "ok" : d ? "cur" : "todo"}">Palier ${i + 1} · ${h(T.name)} <span class="num muted">${d} / ${all}</span></li>`; }).join("")
      : Df.steps.map((st, i) => { const [a, bb] = E.dofusStepProgress(S, id, i); const cls = Q.done || i < Q.step ? "ok" : i === Q.step ? "cur" : "todo";
        return `<li class="${cls}">${h(E.dofusStepTxt(st))}${cls === "cur" && bb > 1 ? ` <span class="num muted">${fmt(a)} / ${fmt(bb)}</span>` : ""}${cls === "cur" && st.dg && DUNGEONS[st.dg] ? ` <button class="btn xs" data-act="dgopen" data-id="${st.dg}">Voir le donjon</button>` : ""}</li>`; }).join("");
    const drop = Df.dg ? `Butin du boss ${h(MONSTERS[DUNGEONS[Df.dg].boss].name)} : 1 chance sur ${Math.round(1 / E.DOFUS_DROP)} dès la stasis ${E.DOFUS_DROP_STASIS}` : `Butin de tout boss de niveau 160 ou plus : 1 chance sur ${Math.round(1 / E.OCRE_DROP)} dès la stasis 8`;
    return `<div class="dcard ${stt}"><div class="pic">${im(dofusImg(id), "dpic", Df.name)}</div><div class="t"><div class="nm"><b>${h(Df.name)}</b><small>niv. ${Df.lvl}</small>${owned ? `<span class="tag good">✓</span>` : ""}</div><div class="bon">${h(E.dofusBonusTxt(id))}</div><span class="src">${state}</span><ol>${steps}</ol><span class="xs muted">${drop}${owned ? ` · copie pour un autre héros chez le Bricoleur (${Math.round(Df.lvl * 1.5)} Poussière de stasis)` : ""}</span></div></div>`; }).join("");
  return `<p class="note">Chaque Dofus a sa quête : les étapes se valident toutes seules en jouant (les donjons déjà vaincus à la stasis demandée comptent). Un Dofus peut aussi tomber, très rarement, en butin du boss de son donjon. Une fois obtenu, une copie pour un autre héros se fabrique chez le Bricoleur avec de la Poussière de stasis. Un héros ne porte qu'un exemplaire de chaque Dofus, dans ses 6 emplacements Dofus/Trophée.</p>
    <section class="panel"><div class="phead"><h2>${IC("dofus")} Les 18 Dofus</h2><span class="small muted num">${own}/18</span>${archiBtn()}</div><div class="pad dgrid">${cards}</div></section>`;
}
function chalBarHtml(F) {
  const tog = `<label class="chaltog" data-tip="Si coché, l'IA évite les actions qui feraient échouer les challenges (un héros peut être exclu dans ses sorts)."><input type="checkbox" data-act="chalai" ${S.settings.chalAI ? "checked" : ""}> ${G("target")} Respecter les challenges</label>`;
  if (!F) return "";
  const boss = F.ents.find((e) => e.boss && e.mech); const mech = boss ? `<span class="mech" data-tip="${h(boss.mech.map((m) => E.BOSS_MECHS[m].name + " : " + E.BOSS_MECHS[m].desc).join(" · "))}">${G("warn")} ${boss.mech.map((m) => h(E.BOSS_MECHS[m].name)).join(", ")}</span>` : "";
  const st = F.stasis > 1 || F.weekly || F.flash ? `<span class="pill">${F.stasis > 1 ? `Stasis ${F.stasis}` : "Stasis 1"}${S.dungeon && (S.dungeon.mods || []).length ? " · " + S.dungeon.mods.map((m) => h(E.STASIS_MODS[m].name)).join(", ") : ""}</span>${F.weekly ? `<span class="pill good" data-tip="Mutateur de la semaine : +${Math.round((E.WEEKLY_REW - 1) * 100)} % d'XP et de butin">${G("star")} Semaine +${Math.round((E.WEEKLY_REW - 1) * 100)} %</span>` : ""}${F.flash ? `<span class="pill good" data-tip="Mutateur éclair : +${Math.round((E.FLASH_REW - 1) * 100)} % d'XP et de butin jusqu'à la fin de la course">${G("bolt")} Éclair +${Math.round((E.FLASH_REW - 1) * 100)} %</span>` : ""}` : "";
  const idol = F.idol ? `<span class="pill good idolpill" data-tip="${h(F.idol.ids.map((id) => E.IDOLS[id].name + " : " + E.IDOLS[id].desc).join(" · "))}">${F.idol.ids.map((id) => im(idolImg(id), "iico", E.IDOLS[id].name)).join("")} Idoles ${F.idolScore} · +${pctTxt(F.idolBonus)} %</span>` : "";
  return `${st}${idol}${archiPill(F)}${mech}<span style="margin-left:auto"></span>${tog}`;
}
function floatAt(node, txt, color, small, cls) {
  const s = document.createElement("span"); s.className = "float" + (small ? " small" : "") + (cls ? " " + cls : ""); s.style.setProperty("--c", color);
  if (cls === "crit") s.innerHTML = `${h(txt)}<small>Critique !</small>`; else s.textContent = txt;
  node.appendChild(s); setTimeout(() => s.remove(), 1150);
}
function burst(node, el) {
  if (S.settings.reduced) return;
  const b = document.createElement("span"); b.className = "fxb " + el;
  const n = el === "t" ? 9 : 8;
  for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n + Math.random() * 0.6; const r = 26 + Math.random() * 22; const p = document.createElement("i");
    p.style.setProperty("--dx", Math.cos(a) * r + "px"); p.style.setProperty("--dy", (Math.sin(a) * r - (el === "f" ? 18 : 0)) + "px"); p.style.setProperty("--rot", Math.round(Math.random() * 360) + "deg"); p.style.animationDelay = Math.random() * 0.08 + "s"; b.appendChild(p); }
  const ring = document.createElement("span"); ring.className = "ring"; ring.style.setProperty("--c", el === "h" ? "#7ee06a" : elVar(el));
  node.appendChild(b); node.appendChild(ring); setTimeout(() => { b.remove(); ring.remove(); }, 800);
}
function pulse(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
/* ===================== Combat animé : sorts qui voyagent, patte de chaque classe, états visibles ===================== */
const animLvl = () => (S && S.settings.anim) || (S && S.settings.reduced ? "sober" : "full");
const axOn = () => animLvl() !== "none";
const axFull = () => animLvl() === "full";
const axSpd = () => Math.min(1, Math.max(0.25, 1 / (BETA ? testSpeed : 1)));
const axRnd = (a, b) => a + Math.random() * (b - a);
const axBody = (n) => (n && n.querySelector(".lookwrap,.medal,img.sprite")) || n;
function axPt(A, n, k = 0.5) { const a = A.el.getBoundingClientRect(), r = axBody(n).getBoundingClientRect(); return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height * k }; }
function axFoot(A, n) { const a = A.el.getBoundingClientRect(), r = axBody(n).getBoundingClientRect(); return { x: r.left - a.left + r.width / 2, y: r.bottom - a.top }; }
function axMk(A, cls, x, y, vars) { const d = document.createElement("div"); d.className = "axp " + cls; d.style.left = x + "px"; d.style.top = y + "px"; if (vars) for (const k in vars) d.style.setProperty(k, vars[k]); A.fxl.appendChild(d); return d; }
const axLater = (el, ms) => setTimeout(() => el.remove(), ms);
const AX_EL = { f: "#ff7a3c", e: "#4fa8ff", t: "#c08a3e", a: "#57d06a", n: "#cfcfcf", h: "#8fe36a" };
const axC = (el) => AX_EL[el] || AX_EL.n;
/* projectile : forme selon la classe (flèche, carte, bouteille…) ou l'élément */
function axProj(A, a, b, el, shape, dur, html) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const ARC = { arrow: -22, bottle: -60, bomb: -60, card: -14, word: -26, lance: -24, needle: -10, torpedo: -6, coin: -40, bub: -30 };
  const arc = shape in ARC ? ARC[shape] : el === "t" ? -60 : el === "a" ? -10 : -20;
  const along = ["arrow", "needle", "torpedo", "lance"].includes(shape) || (!shape && el === "e"), spin = ["card", "bottle", "bomb", "coin"].includes(shape);
  const p = axMk(A, "proj " + (shape || "o" + el), a.x, a.y, { "--c": axC(el) }); if (html) p.textContent = html;
  const kf = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, y = dy * t + arc * 4 * t * (1 - t), sl = (Math.atan2(dy + arc * 4 * (1 - 2 * t), dx) * 180) / Math.PI;
    kf.push({ transform: `translate(-50%,-50%) translate(${dx * t}px,${y}px) rotate(${along ? sl : spin ? t * 720 : !shape && el === "t" ? t * 540 : !shape && el === "a" ? t * 900 : 0}deg)` }); }
  p.animate(kf, { duration: dur, easing: "cubic-bezier(.45,.05,.75,.95)", fill: "forwards" }); axLater(p, dur + 20);
  if (axFull()) { let k = 0; const tr = setInterval(() => { if (++k > dur / 30 || !p.isConnected) return clearInterval(tr); const ar = A.el.getBoundingClientRect(), r = p.getBoundingClientRect();
    const s = axMk(A, "trail", r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2, { "--c": axC(el) }); axLater(s, 360); }, 30); }
}
function axMove(n, kf, dur) { const b = axBody(n); if (!b || !b.animate) return; const z = n.style.zIndex; n.style.zIndex = 60; b.animate(kf, { duration: dur, easing: "ease-in-out" }); setTimeout(() => (n.style.zIndex = z), dur); }
function axDust(A, x, y, n = 4, dir = 0) { if (!axFull()) return; for (let i = 0; i < n; i++) { const d = axMk(A, "dust", x + (i - n / 2) * 8, y - 4); d.animate([{ opacity: 0.75, transform: "translate(-50%,-50%)" }, { opacity: 0, transform: `translate(calc(-50% + ${(i - n / 2) * 8 - dir * 16}px),-150%) scale(1.7)` }], { duration: 520 }); axLater(d, 560); } }
function axPuff(A, x, y, c, n = 6) { for (let i = 0; i < n; i++) { const s = axMk(A, "smoke", x + axRnd(-16, 16), y + axRnd(-22, 14)); s.style.background = `radial-gradient(circle,${c},transparent 70%)`;
  s.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0.95 }, { transform: `translate(calc(-50% + ${axRnd(-20, 20)}px),calc(-50% - ${axRnd(8, 26)}px)) scale(1.6)`, opacity: 0 }], { duration: 520 }); axLater(s, 560); } }
function axBeam(A, a, b, bg, dur, h = 8) { const dx = b.x - a.x, dy = b.y - a.y, ang = Math.atan2(dy, dx); const d = document.createElement("div"); d.className = "axbeam";
  Object.assign(d.style, { left: a.x + "px", top: a.y - h / 2 + "px", width: Math.hypot(dx, dy) + "px", height: h + "px", background: bg }); A.fxl.appendChild(d);
  d.animate([{ transform: `rotate(${ang}rad) scaleX(0)` }, { transform: `rotate(${ang}rad) scaleX(1)`, offset: 0.35 }, { transform: `rotate(${ang}rad) scaleX(1) scaleY(.2)`, opacity: 0 }], { duration: dur, fill: "forwards" }); axLater(d, dur + 20); }
function axGround(A, n, svg, w, dur) { const f = axFoot(A, n); const g = axMk(A, "ground", f.x, f.y); g.style.width = w + "px"; g.innerHTML = svg;
  g.animate([{ transform: "translate(-50%,-100%) scaleY(0)" }, { transform: "translate(-50%,-100%) scaleY(1.12)", offset: 0.3 }, { transform: "translate(-50%,-100%) scaleY(1)", offset: 0.4 }, { transform: "translate(-50%,-100%) scaleY(1)", opacity: 1, offset: 0.8 }, { transform: "translate(-50%,-100%) scaleY(0)", opacity: 0 }], { duration: dur, fill: "forwards" }); axLater(g, dur + 20); }
function axClaws(A, n, c, k = 3) { const b = axPt(A, n); for (let i = 0; i < k; i++) { const cl = axMk(A, "claw", b.x - 14 + i * 14, b.y, { "--c": c });
  cl.animate([{ transform: "translate(-50%,-50%) rotate(28deg) scaleY(0)", opacity: 1 }, { transform: "translate(-50%,-50%) rotate(28deg) scaleY(1)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%) rotate(28deg) scaleY(1)", opacity: 0 }], { duration: 420, delay: i * 50, fill: "both" }); axLater(cl, 560); } }
const AX_SV = {
  shovel: '<svg viewBox="0 0 40 90"><rect x="17" y="0" width="6" height="52" rx="2" fill="#7a4a1f"/><path d="M8 50h24v18c0 12-12 20-12 20S8 80 8 68z" fill="#c9cdd2" stroke="#7d8287" stroke-width="2"/></svg>',
  bramble: '<svg viewBox="0 0 70 100"><path d="M20 100C10 70 40 60 25 30S45 5 40 0" stroke="#3f7a22" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M50 100C62 72 30 62 46 35S28 10 34 4" stroke="#57a02f" stroke-width="6" fill="none" stroke-linecap="round"/><g fill="#a8e070"><path d="M26 70l-9-4 8-3z"/><path d="M33 45l9-5-3 8z"/><path d="M48 60l9 3-8 4z"/></g></svg>',
  fang: '<svg viewBox="0 0 60 60"><path d="M8 14q22 14 44 0l-6 12-5-6-5 10-4-10-4 10-5-10-5 6z" fill="#fff" stroke="#8a6a3a" stroke-width="2"/><path d="M8 46q22-14 44 0l-6-12-5 6-5-10-4 10-4-10-5 10-5-6z" fill="#fff" stroke="#8a6a3a" stroke-width="2"/></svg>',
};
const AX_WORDS = ["!#@", "Na !", "Bouh !", "Ha !", "Pff !"];
/* la patte de chaque classe pour une attaque à cible unique ; renvoie le délai avant l'impact (ms) */
function axSingle(A, src, sn, tn, el, def, sp) {
  const a = axPt(A, sn, 0.45), b = axPt(A, tn, 0.5), dir = b.x > a.x ? 1 : -1, dx = b.x - a.x - dir * 40, dy = b.y - a.y;
  const P = 260 * sp, name = def ? def.name : "";
  if (src.side === "m") { // monstre : il fonce sur sa cible
    axMove(sn, [{ transform: "none" }, { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(1.05)`, offset: 0.45 }, { transform: "none" }], 420 * sp); return 190 * sp; }
  switch (src.summon ? "" : src.cls) {
    case "iop": axMove(sn, [{ transform: "none" }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 70}px) rotate(${-dir * 8}deg)`, offset: 0.3 }, { transform: `translate(${dx}px,${dy}px) scaleY(.92)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.62 }, { transform: "none" }], 520 * sp);
      setTimeout(() => { const f = axFoot(A, tn); axDust(A, f.x - dir * 26, f.y, 6); if (axFull()) pulse(A.el, "shake"); }, 260 * sp); return 260 * sp;
    case "sacri": case "ougi": case "forge": case "panda":
      if (src.cls === "panda" && !/Paume|Gueule/.test(name)) { axProj(A, a, b, el, "bottle", P); return P; }
      if (src.cls === "forge" && !/Estoc|Fente|Talon|Parade|Charge/.test(name)) { axProj(A, a, b, el, "lance", P); setTimeout(() => axProj(A, b, a, el, "lance", P), P + 40); return P; }
      axDust(A, axFoot(A, sn).x, axFoot(A, sn).y, 3, dir);
      axMove(sn, [{ transform: "none" }, { transform: `translateX(${-dir * 8}px)`, offset: 0.12 }, { transform: `translate(${dx}px,${dy}px) scale(1.05)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.58 }, { transform: "none" }], 460 * sp);
      if (src.cls === "ougi") setTimeout(() => { const f = axMk(A, "fang", b.x, b.y); f.innerHTML = AX_SV.fang; f.animate([{ transform: "translate(-50%,-50%) scaleY(1.7)", opacity: 0 }, { transform: "translate(-50%,-50%) scaleY(.6)", opacity: 1, offset: 0.5 }, { transform: "translate(-50%,-50%) scaleY(.6)", opacity: 0 }], { duration: 380, fill: "forwards" }); axLater(f, 400); }, 190 * sp);
      return 210 * sp;
    case "sram": { const body = axBody(sn), c = "rgba(140,90,214,.85)", ox = b.x - a.x + dir * 44, oy = b.y - a.y;
      axPuff(A, a.x, a.y, c); body.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "none", offset: 0.15 }, { opacity: 0, transform: `translate(${ox}px,${oy}px) scaleX(-1)`, offset: 0.25 }, { opacity: 1, transform: `translate(${ox}px,${oy}px) scaleX(-1)`, offset: 0.35 }, { opacity: 1, transform: `translate(${ox - dir * 20}px,${oy}px) scaleX(-1)`, offset: 0.5 }, { opacity: 1, transform: `translate(${ox}px,${oy}px) scaleX(-1)`, offset: 0.75 }, { opacity: 0, transform: `translate(${ox}px,${oy}px) scaleX(-1)`, offset: 0.85 }, { opacity: 1, transform: "none" }], { duration: 640 * sp });
      setTimeout(() => axPuff(A, b.x + dir * 44, b.y, c), 150 * sp); setTimeout(() => axPuff(A, b.x + dir * 44, b.y, c), 540 * sp); return 300 * sp; }
    case "zobal": axMove(sn, [{ transform: "none" }, { transform: `translate(${dx}px,${dy}px) rotateY(540deg)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) rotateY(720deg)`, offset: 0.62 }, { transform: "rotateY(1080deg)" }], 560 * sp); return 280 * sp;
    case "cra": axProj(A, a, b, el, "arrow", P * 0.85); return P * 0.85;
    case "eca": for (let i = 0; i < 3; i++) setTimeout(() => axProj(A, a, { x: b.x, y: b.y + (i - 1) * 12 }, el, "card", P * 0.85), i * 50 * sp); return P * 0.85 + 100 * sp;
    case "enu": if (/Pelle|Éboulement|Remblai|Tourbière/.test(name)) { axGround(A, tn, AX_SV.shovel, 34, 640 * sp); return 160 * sp; }
      for (let i = 0; i < 3; i++) setTimeout(() => axProj(A, a, { x: b.x + axRnd(-8, 8), y: b.y + axRnd(-8, 8) }, el, "coin", P), i * 45 * sp); return P + 90 * sp;
    case "xelor": axProj(A, a, b, el, "needle", P * 0.8); setTimeout(() => { const s = axBody(tn); if (s && axFull()) s.animate([{ filter: "grayscale(0)" }, { filter: "grayscale(1) brightness(1.15) sepia(.3) hue-rotate(160deg)" }, { filter: "grayscale(0)" }], { duration: 600 }); }, P * 0.8); return P * 0.8;
    case "steam": axPuff(A, a.x + dir * 16, a.y, "rgba(230,240,245,.8)", 3); axProj(A, a, b, el, "torpedo", P); return P;
    case "eni": for (let i = 0; i < 2; i++) setTimeout(() => axProj(A, a, b, el, "word", P, AX_WORDS[(Math.random() * AX_WORDS.length) | 0]), i * 80 * sp); return P + 80 * sp;
    case "feca": axProj(A, a, b, el, "bub", P * 1.15); return P * 1.15;
    case "osa": setTimeout(() => axClaws(A, tn, "#c8a0ff"), 80 * sp); return 180 * sp;
    case "sadi": axGround(A, tn, AX_SV.bramble, 52, 700 * sp); return 180 * sp;
    case "elio": { const p1 = { x: a.x + dir * 34, y: a.y }, p2 = { x: b.x - dir * 40, y: b.y };
      [p1, p2].forEach((p) => { const g = axMk(A, "portal", p.x, p.y); g.animate([{ transform: "translate(-50%,-50%) scaleY(0)" }, { transform: "translate(-50%,-50%) scaleY(1)", offset: 0.2 }, { transform: "translate(-50%,-50%) scaleY(1)", offset: 0.8 }, { transform: "translate(-50%,-50%) scaleY(0)" }], { duration: 700 * sp, fill: "forwards" }); axLater(g, 720 * sp); });
      setTimeout(() => axBeam(A, a, p1, "linear-gradient(90deg,#fff,#6ff0e6)", 300 * sp), 90 * sp); setTimeout(() => axBeam(A, p2, b, "linear-gradient(90deg,#6ff0e6,#fff)", 300 * sp), 210 * sp); return 290 * sp; }
    case "hupper": { const top = { x: b.x, y: b.y - 70 }; const r = axMk(A, "rune", top.x, top.y, { "--c": axC(el) }); axLater(r, 520 * sp);
      setTimeout(() => axProj(A, top, b, el, "spear", 150 * sp), 150 * sp); return 300 * sp; }
    case "roub": { if (/Tromblon|Espingole|Mitraille|Plombage|Recel|Oblitération/.test(name)) { const f = axMk(A, "flashw sm", a.x + dir * 24, a.y); axLater(f, 200); axProj(A, a, b, "n", null, P * 0.6); return P * 0.6; }
      axProj(A, a, b, el, "bomb", P); setTimeout(() => { const f = axMk(A, "flashw", b.x, b.y); axLater(f, 260); }, P); return P; }
    default: axProj(A, a, b, el, null, P); return P;
  }
}
/* sorts de zone : une onde traverse les cibles (volée de flèches pour le Crâ) ; renvoie le délai par cible */
function axZone(A, src, sn, nodes, el, sp) {
  const a = axPt(A, sn), W = A.el.clientWidth, dir = nodes.length && axPt(A, nodes[0]).x > a.x ? 1 : -1, end = dir > 0 ? W + 30 : -30, dur = 420 * sp;
  if (src.side === "m" && src.boss) { // ruée d'un boss sur toute l'équipe
    const xs = nodes.map((n) => axPt(A, n).x), tx = (dir > 0 ? Math.max(...xs) : Math.min(...xs)) - a.x - dir * 20;
    axMove(sn, [{ transform: "none" }, { transform: `translate(${tx}px,-12px) scale(1.06)`, offset: 0.5 }, { transform: `translate(${tx}px,-12px)`, offset: 0.6 }, { transform: "none" }], 640 * sp);
    if (axFull()) setTimeout(() => pulse(A.el, "shake2"), 300 * sp);
    return (n) => 140 * sp + (Math.abs(axPt(A, n).x - a.x) / Math.max(1, Math.abs(tx))) * 200 * sp; }
  if (src.side === "c" && src.cls === "cra") {
    nodes.forEach((n, i) => { const b = axPt(A, n); for (let k = 0; k < 3; k++) setTimeout(() => axProj(A, { x: b.x - 60 + axRnd(-16, 16), y: -10 }, { x: b.x + axRnd(-12, 12), y: b.y }, el, "arrow", 220 * sp), (i * 40 + k * 60) * sp); });
    return () => 300 * sp; }
  pulse(sn, "act");
  const w = axMk(A, "wave", a.x, A.el.clientHeight * 0.6, { "--c": axC(el) }); w.style.height = A.el.clientHeight * 0.7 + "px"; if (dir < 0) w.style.transform = "translate(-50%,-50%) scaleX(-1)";
  w.animate([{ left: a.x + "px", opacity: 0 }, { opacity: 1, offset: 0.15 }, { left: end + "px", opacity: 0.3 }], { duration: dur, easing: "ease-in", fill: "forwards" }); axLater(w, dur + 20);
  return (n) => dur * Math.pow(Math.min(1, Math.abs(axPt(A, n).x - a.x) / Math.max(1, Math.abs(end - a.x))), 1.5);
}
function axSpellTag(A, n, name, el) {
  if (!axOn()) return; const a = A.el.getBoundingClientRect(), r = axBody(n).getBoundingClientRect();
  if (n._tag) n._tag.remove();
  const d = axMk(A, "spelltag", r.left - a.left + r.width / 2, r.top - a.top - 4, { "--c": axC(el) }); d.innerHTML = `<i></i>${h(name)}`; n._tag = d;
  const hw = d.offsetWidth / 2, W = A.el.clientWidth; d.style.left = Math.min(W - hw - 4, Math.max(hw + 4, r.left - a.left + r.width / 2)) + "px"; axLater(d, 1150);
}
function axMechBanner(A, txt, who) {
  if (!axOn()) return; const charge = /Charge/.test(txt) && /⚠/.test(txt);
  const d = document.createElement("div"); d.className = "axbanner" + (charge ? " warn" : "");
  d.innerHTML = `<div class="k">${h(who)}${charge ? " · au prochain tour" : ""}</div><div class="n">${h(charge ? "Attaque dévastatrice" : txt.replace(/^⚠\s*/, ""))}</div>`;
  A.fxl.appendChild(d); axLater(d, 2000);
}
/* effet d'un événement (impact, soin, bonus, invocation) */
function axEvent(F, A, f) {
  if (ui.arena !== A) return;
  const n = A.nodes[f.t];
  if (f.k === "hit") { if (!n) return; const e = F.ents[f.t];
    pulse(n, "hit");
    if (f.crit && axOn()) { floatAt(n, "−" + f.v, "#ffd84d", false, "crit"); if (axFull()) { const p = axPt(A, n); const fl = axMk(A, "flashw", p.x, p.y); axLater(fl, 220); const b = axBody(n); if (b && b.animate) b.animate([{ filter: "brightness(3)" }, { filter: "brightness(3)", offset: 0.6 }, { filter: "none" }], { duration: 160 }); pulse(A.el, "shake"); } }
    else if (f.s < 0 && axOn()) floatAt(n, "−" + f.v, "#b6ff9a", true);
    else floatAt(n, "-" + f.v, elVar(f.el));
    if (f.s < 0 && axOn()) { const p = axPt(A, n, 0.45); for (let i = 0; i < (axFull() ? 6 : 3); i++) { const s = axMk(A, "bubl", p.x + axRnd(-22, 22), p.y + axRnd(-14, 14)); s.style.animationDelay = i * 50 + "ms"; axLater(s, 1100); } }
    else burst(n, f.el || "n");
    if (e && (!e.alive || f.v > e.hpMax * 0.3) && (!axOn() || axFull())) pulse(A.el, "shake");
  } else if (f.k === "heal") { if (!n) return; floatAt(n, "+" + f.v, "#7ee06a");
    if (axOn()) { const p = axPt(A, n, 0.6); for (let i = 0; i < (axFull() ? 8 : 4); i++) { const s = axMk(A, "streak", p.x + axRnd(-24, 24), p.y + axRnd(-12, 12), { "--c": "#b6ff8a" }); s.style.animationDelay = i * 40 + "ms"; axLater(s, 1100); } const r = axMk(A, "ring", p.x, p.y, { "--c": "#8fe36a" }); axLater(r, 520); }
    else burst(n, "h");
  } else if (f.k === "buff") { if (!n || A.view === "compact") return; floatAt(n, f.txt, "var(--gold2)", true);
    const e = F.ents[f.t]; if (e && e.side === "m" && e.mech && !/^[+−-]|^Bouclier|^Esquive|^Invulnérable|^Condamné/.test(f.txt)) axMechBanner(A, f.txt, e.name);
  } else if (f.k === "phase") phaseFlash();
}
/* une action = un même numéro d'événement : lancer, voyage, puis impacts */
/* ===================== sorts signature : une mécanique unique pour 2 sorts par classe (38 sorts, maquette v4) ===================== */
const SG_T = 0.62; // rythme de la maquette resserré pour le pas du combat
/* copie de l'image d'une entité (ombre, moitié, image rémanente) placée au même endroit */
function sgClone(A, n, cls, vars) { const b = axBody(n), img = b.matches("img") ? b : b.querySelector("img.look,img.sprite,img"); const r = (img || b).getBoundingClientRect(), a = A.el.getBoundingClientRect();
  const d = axMk(A, "sg sclone " + cls, r.left - a.left + r.width / 2, r.top - a.top + r.height / 2, vars); d.style.width = r.width + "px"; d.style.height = r.height + "px"; if (img) d.innerHTML = `<img src="${img.getAttribute("src")}" alt="">`; return d; }
/* petite boîte à outils donnée à chaque animation : positions, éléments, attente, et surtout hit() qui déclenche les vrais dégâts du moteur au bon moment */
function sgCtx(F, A, src, sn, hits, rest, el) {
  const alive = (side) => F.ents.map((e, i) => (e.alive && e.side === side && !e.summon && A.nodes[i] ? A.nodes[i] : null)).filter(Boolean);
  const tg = [...new Set(hits.map((f) => f.t))].map((t) => A.nodes[t]).filter(Boolean);
  const bt = [...new Set(rest.filter((f) => f.k === "buff" || f.k === "heal").map((f) => f.t))].map((t) => A.nodes[t]).filter(Boolean);
  const done = new Set(); let restDone = false;
  const c = {
    A, F, me: sn, src, el, tg, foes: tg.length ? tg : alive("m"), allies: bt.length ? bt : alive("c"), fin: [], T: SG_T,
    wait: (ms) => new Promise((res, rej) => setTimeout(() => (ui.arena === A ? res() : rej("stop")), ms * SG_T)),
    later: (e, ms) => axLater(e, ms * SG_T),
    mk: (cls, x, y, v) => axMk(A, "sg " + cls, x, y, v),
    mkg: (cls, x, y, v) => { const d = axMk(A, "sg " + cls, x, y, v); if (A.fxg) A.fxg.appendChild(d); return d; },
    pt: (n, k) => axPt(A, n, k), foot: (n) => { const f = axFoot(A, n); return { x: f.x, y: f.y - 4 }; }, body: axBody,
    anim: (n, kf, o) => { const b = axBody(n); return b && b.animate ? b.animate(kf, typeof o === "number" ? { duration: o * SG_T } : Object.assign({}, o, { duration: o.duration * SG_T, delay: (o.delay || 0) * SG_T })) : null; },
    cancel: (n) => { const b = axBody(n); if (b && b.getAnimations) b.getAnimations().forEach((x) => x.cancel()); },
    clone: (n, cls, v) => sgClone(A, n, cls, v), W: () => A.el.clientWidth, H: () => A.el.clientHeight, rnd: axRnd, C: axC,
    dir: (n) => (c.pt(n).x >= c.pt(sn).x ? 1 : -1),
    dim: (on, deep) => { let d = A.fxl.querySelector(".sgdim"); if (!on) { if (d) d.remove(); return; } if (!d) d = axMk(A, "sg sgdim", 0, 0); d.classList.toggle("deep", !!deep); },
    cls: (k, on) => A.el.classList.toggle("sg-" + k, on),
    whiteout: (ms = 180) => { const w = axMk(A, "sg whiteout", 0, 0); w.animate([{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: ms * SG_T, fill: "forwards" }); axLater(w, ms * SG_T + 20); },
    ico: (x, y, id, cls = "") => { const d = axMk(A, "sg ico " + cls, x, y); d.innerHTML = `<img src="assets/s/${id}.png" alt="">`; return d; },
    puff: (x, y, col, n) => axPuff(A, x, y, col, n), num: (n, txt, col, small) => floatAt(n, txt, col, small),
    shake: (k) => { if (axFull()) pulse(A.el, k || "shake"); }, proj: (a, b, el2, shape, dur) => axProj(A, a, b, el2, shape, dur * SG_T),
    svg: (html, ms) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "sgsvg"); s.setAttribute("width", A.el.clientWidth); s.setAttribute("height", A.el.clientHeight); s.innerHTML = html; A.fxl.appendChild(s); axLater(s, ms * SG_T); return s; },
    who: (n) => n.querySelector(".who"),
    z: (n, on) => { if (on) { n.dataset.z = n.style.zIndex; n.style.zIndex = 60; } else n.style.zIndex = n.dataset.z || ""; },
    hit: (n) => { const t = A.nodes.indexOf(n); hits.forEach((f) => { if (f.t === t && !done.has(f)) { done.add(f); axEvent(F, A, f); } }); },
    hitAll: async (gap = 60) => { for (const n of c.foes) { c.hit(n); if (gap) await c.wait(gap); } },
    rest: () => { if (restDone) return; restDone = true; rest.forEach((f) => axEvent(F, A, f)); },
    flush: () => { hits.forEach((f) => { if (!done.has(f)) { done.add(f); axEvent(F, A, f); } }); c.rest(); },
    hold: (ms) => { A.sgHold = Date.now() + ms * SG_T; },
  };
  return c;
}
const SG = {
  /* Iop · Épée Céleste : le ciel se fend, une lame tombe en hélice et vibre dans le sol */
  s13122: async (c) => { c.hold(900); const t = c.foes[0], b = c.pt(t, 0.5); let pts = ""; for (let i = 0; i <= 8; i++) pts += `${b.x - 70 + i * 17.5},${16 + (i % 2 ? 9 : -9) + c.rnd(-3, 3)} `;
    const s = c.svg(`<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`, 900); s.style.transformOrigin = b.x + "px 0"; s.animate([{ opacity: 0, transform: "scaleX(0)" }, { opacity: 1, transform: "scaleX(1)", offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 900 * c.T });
    await c.wait(300); const bl = c.mk("blade", b.x, -60); bl.animate([{ top: "-60px", transform: "translate(-50%,-50%) rotate(0)" }, { top: b.y + 8 + "px", transform: "translate(-50%,-50%) rotate(720deg)" }], { duration: 420 * c.T, easing: "cubic-bezier(.5,0,1,.5)", fill: "forwards" });
    await c.wait(420); bl.animate([{ transform: "translate(-50%,-50%) rotate(720deg)" }, { transform: "translate(-54%,-50%) rotate(715deg)" }, { transform: "translate(-46%,-50%) rotate(725deg)" }, { transform: "translate(-50%,-50%) rotate(720deg)" }], { duration: 160 * c.T, iterations: 5 }); c.later(bl, 1300);
    c.shake("shake2"); c.hit(t); await c.wait(80); await c.hitAll(40); },
  /* Iop · Colère de Iop : l'arène s'assombrit, il saute hors de l'écran, une ombre grandit sous la cible, puis il retombe */
  s13124: async (c) => { c.hold(1500); const t = c.foes[0], me = c.me; c.dim(true); const au = document.createElement("div"); au.className = "sgaura"; c.body(me).appendChild(au); c.fin.push(() => { au.remove(); c.dim(false); c.z(me, false); c.cancel(me); });
    await c.wait(400); const a = c.pt(me), b = c.pt(t), dx = b.x - a.x, dy = b.y - a.y; c.z(me, true);
    c.anim(me, [{ transform: "none" }, { transform: "translateY(10px) scaleY(.85)", offset: 0.25 }, { transform: "translateY(-560px)" }], { duration: 400, easing: "cubic-bezier(.4,0,1,.6)", fill: "forwards" }); await c.wait(400);
    const f = c.foot(t); const sh = c.mkg("shadow", f.x, f.y - 2); sh.animate([{ transform: "translate(-50%,-50%) scale(.1)", opacity: 0.2 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.85 }], { duration: 700 * c.T, fill: "forwards" }); await c.wait(700); sh.remove();
    c.anim(me, [{ transform: `translate(${dx}px,${dy - 560}px)` }, { transform: `translate(${dx}px,${dy}px) scaleY(.8)` }], { duration: 170, easing: "cubic-bezier(.6,0,1,.4)", fill: "forwards" }); await c.wait(170);
    c.dim(false); c.whiteout(260); c.shake(); for (let i = 0; i < 3; i++) { const r = c.mkg("crater", f.x, f.y); r.style.animationDelay = i * 90 + "ms"; c.later(r, 1200); }
    c.hit(t); await c.wait(500); au.remove(); c.anim(me, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 360, fill: "forwards" }); await c.wait(380); c.cancel(me); c.z(me, false); },
  /* Crâ · Flèche Glacée : bloc de glace qui éclate en éclats */
  s32435: async (c) => { c.hold(800); const t = c.foes[0]; const a = c.pt(c.me, 0.45), b = c.pt(t, 0.5); c.proj(a, b, "e", "arrow", 220); await c.wait(220); const r = c.body(t).getBoundingClientRect(), p = c.pt(t, 0.5);
    const ice = c.mk("iceblock", p.x, p.y); ice.style.width = r.width * 1.1 + "px"; ice.style.height = r.height * 1.05 + "px"; ice.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: 220 * c.T, fill: "forwards" });
    c.body(t).style.filter = "saturate(.3) brightness(1.25) hue-rotate(160deg)"; c.fin.push(() => { c.body(t).style.filter = ""; ice.remove(); }); await c.wait(800); ice.remove(); c.body(t).style.filter = "";
    for (let i = 0; i < 10; i++) { const sd = c.mk("shard", p.x, p.y); const ang = c.rnd(0, Math.PI * 2), d = c.rnd(40, 110); sd.animate([{ transform: "translate(-50%,-50%) rotate(0)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px),calc(-50% + ${Math.sin(ang) * d + 40}px)) rotate(${c.rnd(-300, 300)}deg)`, opacity: 0 }], { duration: 650 * c.T, easing: "cubic-bezier(.2,.6,.6,1)" }); c.later(sd, 660); }
    c.hit(t); },
  /* Crâ · Flèche Explosive : la flèche reste plantée, la cible clignote de plus en plus vite, puis explose et projette les voisins */
  s32445: async (c) => { c.hold(1300); const t = c.foes[0], d1 = c.dir(t); const a = c.pt(c.me, 0.45), b = c.pt(t, 0.5); c.proj(a, b, "f", "arrow", 220); await c.wait(220); const p = c.pt(t, 0.5), f = c.foot(t);
    const st = c.mk("stuck", p.x - 10, p.y - 6); c.later(st, 1400); const bd = c.body(t); c.fin.push(() => (bd.style.filter = ""));
    for (const d of [300, 200, 140, 90, 60, 45]) { bd.style.filter = "brightness(1.6) sepia(1) saturate(6) hue-rotate(-20deg)"; await c.wait(d / 2); bd.style.filter = ""; await c.wait(d / 2); }
    const ex = c.mk("blastdisc", p.x, p.y); c.later(ex, 700); const sc = c.mkg("scorch", f.x, f.y - 2); sc.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.1 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0 }], { duration: 2600 * c.T, fill: "forwards" }); c.later(sc, 2600); c.shake();
    for (const k of c.foes) if (k !== t) c.anim(k, [{ transform: "none" }, { transform: `translateX(${d1 * 34}px) rotate(${d1 * 8}deg)`, offset: 0.3 }, { transform: "none" }], 700);
    c.hit(t); await c.hitAll(40); },
  /* Féca · Typhon : son glyphe s'allume, un cyclone balaie la ligne ennemie et soulève les monstres */
  s12976: async (c) => { c.hold(1400); const fo = c.foot(c.me); const g = c.ico(fo.x, fo.y - 2, 12138, "glyphico"); c.later(g, 1600); await c.wait(250);
    const a = c.pt(c.me, 0.6), d1 = c.dir(c.foes[0]), end = d1 > 0 ? c.W() + 60 : -60; const cy = c.mk("cyclone", a.x, a.y); cy.innerHTML = "<i></i><i></i><i></i><i></i>"; cy.animate([{ left: a.x + "px" }, { left: end + "px" }], { duration: 1100 * c.T, easing: "ease-in", fill: "forwards" }); c.later(cy, 1130);
    await Promise.all(c.foes.map(async (k) => { const t = Math.max(0, (c.pt(k).x - a.x) / (end - a.x)); await c.wait(1100 * Math.pow(t, 1.4)); c.anim(k, [{ transform: "none" }, { transform: "translateY(-70px) rotate(-14deg)", offset: 0.35 }, { transform: "translateY(-60px) rotate(12deg)", offset: 0.6 }, { transform: "translateY(0) scaleY(.85)", offset: 0.9 }, { transform: "none" }], 800); await c.wait(450); c.hit(k); })); },
  /* Féca · Bouclier Féca : un mur en nid d'abeille se construit autour de chaque allié protégé */
  s12982: async (c) => { c.hold(700); for (const k of c.allies) { const p = c.pt(k, 0.5), r = c.body(k).getBoundingClientRect(), R = r.width * 0.6;
      [[0, 0], [1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]].forEach(([u, v], i) => { const hx = c.mk("hex", p.x + u * R, p.y + v * R); hx.style.animationDelay = i * 50 + "ms"; c.later(hx, 1500); }); await c.wait(140); }
    c.rest(); },
  /* Osamodas · Cri de l'Ours : des arcs sonores partent de sa bouche, la cible se déforme, l'arène vibre */
  s31132: async (c) => { c.hold(800); const t = c.foes[0], a = c.pt(c.me, 0.3), b = c.pt(t, 0.5); c.cls("rumble", true); c.fin.push(() => c.cls("rumble", false)); c.anim(c.me, [{ transform: "none" }, { transform: "scale(1.12) translateY(-4px)" }, { transform: "none" }], 500);
    const d1 = c.dir(t); for (let i = 0; i < 5; i++) { const ar = c.mk("sarc", a.x + d1 * 20, a.y); if (d1 < 0) ar.style.transform = "translate(0,-50%) scaleX(-1)"; ar.animate([{ transform: `translate(0,-50%) scale(${d1 > 0 ? "" : "-"}.2,.2)`, opacity: 1 }, { transform: `translate(${b.x - a.x - d1 * 20}px,-50%) scale(${d1 > 0 ? "" : "-"}1.6,1.6)`, opacity: 0 }], { duration: 520 * c.T, easing: "ease-out" }); c.later(ar, 530); await c.wait(80); }
    for (const k of c.foes) c.anim(k, [{ transform: "none" }, { transform: "skewX(-18deg) scaleX(1.25)", offset: 0.3 }, { transform: "skewX(12deg) scaleX(.85)", offset: 0.6 }, { transform: "none" }], 600); await c.hitAll(60); c.cls("rumble", false); c.rest(); },
  /* Osamodas · Souffle Draconique : un cône de feu, le sol en flammes sous les ennemis, les monstres noircis */
  s31122: async (c) => { c.hold(900); const a = c.pt(c.me, 0.4), d1 = c.dir(c.foes[0]); const cn = c.mk("breath", d1 > 0 ? a.x : 0, a.y); cn.style.width = (d1 > 0 ? c.W() - a.x : a.x) + "px"; if (d1 < 0) cn.style.transform = "translate(0,-50%) scaleX(-1)";
    cn.animate([{ clipPath: "polygon(0 48%,0 48%,0 52%,0 52%)" }, { clipPath: "polygon(0 44%,100% 0,100% 100%,0 56%)", offset: 0.35 }, { clipPath: "polygon(0 44%,100% 0,100% 100%,0 56%)", opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 900 * c.T }); c.later(cn, 900);
    await c.wait(330); for (const k of c.foes) { const f = c.foot(k); for (let i = -2; i <= 2; i++) { const fl = c.mk("flame", f.x + i * 16, f.y); fl.style.animationDelay = c.rnd(0, 300) + "ms"; fl.style.height = c.rnd(26, 46) + "px"; c.later(fl, 1600); } c.body(k).style.filter = "brightness(.45) sepia(.6)"; }
    c.fin.push(() => c.foes.forEach((k) => (c.body(k).style.filter = ""))); await c.hitAll(90); await c.wait(600); c.foes.forEach((k) => (c.body(k).style.filter = "")); },
  /* Enutrof · Éboulement : le sol se fissure sous la cible, qui s'enfonce jusqu'au cou et ressort couverte de poussière */
  s13352: async (c) => { c.hold(1000); const t = c.foes[0], f = c.foot(t); for (let i = 0; i < 5; i++) { const cr = c.mkg("crack", f.x, f.y - 2); cr.style.setProperty("--r", (i * 72 + c.rnd(-20, 20)) + "deg"); cr.style.animationDelay = i * 50 + "ms"; c.later(cr, 2200); }
    await c.wait(400); const img = c.body(t); const clip = Math.max(0, t.getBoundingClientRect().bottom - img.getBoundingClientRect().bottom) + 2; t.style.clipPath = `inset(0 0 ${clip}px 0)`; c.fin.push(() => { t.style.clipPath = ""; c.cancel(t); });
    c.anim(t, [{ transform: "none" }, { transform: "translateY(62px)" }], { duration: 380, easing: "cubic-bezier(.6,0,1,.6)", fill: "forwards" }); c.puff(f.x, f.y - 6, "rgba(170,140,100,.85)", 9); c.shake("shake2");
    await c.wait(380); c.hit(t); await c.wait(400); c.anim(t, [{ transform: "translateY(62px)" }, { transform: "translateY(-6px)", offset: 0.8 }, { transform: "none" }], { duration: 500, fill: "forwards" }); c.puff(f.x, f.y - 16, "rgba(170,140,100,.7)", 6); await c.wait(520); c.cancel(t); t.style.clipPath = ""; },
  /* Enutrof · Coup de Grisou : les lumières s'éteignent, seule sa lanterne vacille, puis un flash blanc projette les monstres */
  s13368: async (c) => { c.hold(1300); c.dim(true, true); c.fin.push(() => c.dim(false)); const a = c.pt(c.me, 0.55), d1 = c.dir(c.foes[0]); const l = c.mk("lamp", a.x + d1 * 26, a.y + 6); c.later(l, 1700); for (let i = 0; i < 4; i++) { const w = c.mk("wisp", a.x + d1 * (80 + i * 70), a.y + c.rnd(-30, 30)); c.later(w, 1600); }
    await c.wait(1100); l.remove(); c.dim(false); c.whiteout(320); c.shake(); for (const k of c.foes) c.anim(k, [{ transform: "none" }, { transform: `translate(${d1 * 40}px,-30px) rotate(${d1 * 20}deg)`, offset: 0.35 }, { transform: `translate(${d1 * 30}px,0) rotate(0)`, offset: 0.7 }, { transform: "none" }], 900); await c.wait(100); await c.hitAll(40); },
  /* Sram · Arsenic : la cible verdit des pieds à la tête, des gouttes vertes coulent */
  s12907: async (c) => { c.hold(900); const t = c.foes[0]; const a = c.pt(c.me, 0.45), b = c.pt(t, 0.5); c.proj(a, b, "a", "bottle", 260); await c.wait(260); const bd = c.body(t), img = bd.matches("img") ? bd : bd.querySelector("img"); const r = (img || bd).getBoundingClientRect(), ar = c.A.el.getBoundingClientRect();
    const g = c.mk("greenfill", r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2); g.style.width = r.width + "px"; g.style.height = r.height + "px"; if (img) g.style.setProperty("--m", `url("${img.getAttribute("src")}")`); g.animate([{ backgroundPosition: "0 100%" }, { backgroundPosition: "0 0%" }], { duration: 800 * c.T, fill: "forwards", easing: "ease-in" }); c.later(g, 1700);
    for (let i = 0; i < 5; i++) { const d = c.mk("drip", r.left - ar.left + c.rnd(6, r.width - 6), r.top - ar.top + r.height * 0.9); d.style.animationDelay = 250 + i * 140 + "ms"; c.later(d, 1700); }
    await c.wait(450); c.hit(t); },
  /* Sram · Attaque Mortelle : le temps s'arrête, le Sram apparaît derrière la cible, un trait fin, puis elle se coupe en deux */
  s12917: async (c) => { c.hold(1500); const t = c.foes[0], me = c.me, bd = c.body(me), tb = c.body(t); c.cls("stopped", true); c.fin.push(() => { c.cls("stopped", false); tb.style.opacity = ""; c.cancel(me); bd.style.opacity = ""; }); await c.wait(300);
    const a = c.pt(me, 0.45), b = c.pt(t, 0.5), d1 = c.dir(t), ox = b.x - a.x + d1 * 44, oy = b.y - a.y, col = "rgba(140,90,214,.85)"; c.puff(a.x, a.y, col);
    bd.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "none", offset: 0.3 }, { opacity: 0, transform: `translate(${ox}px,${oy}px) scaleX(-1)`, offset: 0.5 }, { opacity: 1, transform: `translate(${ox}px,${oy}px) scaleX(-1)` }], { duration: 300 * c.T, fill: "forwards" }); await c.wait(300); c.puff(b.x + d1 * 44, b.y, col);
    const cut = c.mk("cutline", b.x, b.y); cut.animate([{ transform: "translate(-50%,-50%) rotate(-28deg) scaleX(0)" }, { transform: "translate(-50%,-50%) rotate(-28deg) scaleX(1)" }], { duration: 90 * c.T, fill: "forwards" }); await c.wait(500);
    const L = c.clone(t, "half l"), R = c.clone(t, "half r"); tb.style.opacity = 0; cut.remove(); L.animate([{ transform: "translate(-50%,-50%)" }, { transform: "translate(calc(-50% - 16px),calc(-50% + 10px)) rotate(-7deg)" }], { duration: 400 * c.T, fill: "forwards" }); R.animate([{ transform: "translate(-50%,-50%)" }, { transform: "translate(calc(-50% + 16px),calc(-50% - 6px)) rotate(6deg)" }], { duration: 400 * c.T, fill: "forwards" });
    c.cls("stopped", false); c.hit(t); await c.wait(450); L.remove(); R.remove(); tb.style.opacity = "";
    bd.animate([{ opacity: 1, transform: `translate(${ox}px,${oy}px) scaleX(-1)` }, { opacity: 0, transform: `translate(${ox}px,${oy}px) scaleX(-1)`, offset: 0.4 }, { opacity: 0, transform: "none", offset: 0.6 }, { opacity: 1, transform: "none" }], { duration: 300 * c.T, fill: "forwards" }); c.puff(b.x + d1 * 44, b.y, col); await c.wait(300); c.cancel(me); },
  /* Xélor · Rayon Obscur : une bande de lumière négative balaie la ligne ennemie et inverse les couleurs */
  s13253: async (c) => { c.hold(900); const a = c.pt(c.me, 0.45), d1 = c.dir(c.foes[0]), end = d1 > 0 ? c.W() + 20 : -20; const band = c.mk("darkband", a.x, a.y); band.style.width = Math.abs(end - a.x) + "px"; if (d1 < 0) band.style.transformOrigin = "0 50%";
    band.animate([{ transform: `translate(0,-50%) scaleX(0)` }, { transform: `translate(0,-50%) scaleX(${d1})`, offset: 0.4 }, { transform: `translate(0,-50%) scaleX(${d1})`, opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1000 * c.T, fill: "forwards" }); c.later(band, 1020);
    c.fin.push(() => c.foes.forEach((k) => { c.body(k).style.filter = ""; const w = c.who(k); if (w) w.style.filter = ""; }));
    await Promise.all(c.foes.map(async (k) => { const t = Math.abs((c.pt(k).x - a.x) / (end - a.x)); await c.wait(400 * t); c.body(k).style.filter = "invert(1) hue-rotate(180deg)"; const w = c.who(k); if (w) w.style.filter = "invert(1)"; c.hit(k); await c.wait(550); c.body(k).style.filter = ""; if (w) w.style.filter = ""; })); },
  /* Xélor · Sablier de Xélor : le temps rembobine, image sépia et grain de vieux film, puis tout repart d'un coup */
  s13261: async (c) => { c.hold(1300); c.cls("rewind", true); c.fin.push(() => c.cls("rewind", false)); const gr = c.mk("grain", 0, 0); c.later(gr, 1300); const rw = c.mk("rwsym", c.W() - 40, 26); rw.textContent = "◀◀"; c.later(rw, 1300);
    for (const k of c.foes) c.anim(k, [{ transform: "none" }, { transform: "translateX(18px) rotate(-6deg)" }, { transform: "translateX(-10px)" }, { transform: "translateX(26px) rotate(5deg)" }, { transform: "translateX(4px)" }, { transform: "translateX(30px) rotate(-4deg)" }, { transform: "none" }], { duration: 1100, easing: "steps(6, end)" });
    await c.wait(1150); c.cls("rewind", false); c.whiteout(120); await c.hitAll(50); },
  /* Ecaflip · Pile ou Face : la pièce monte très haut, rebondit trois fois, puis pluie de kamas */
  s12841: async (c) => { c.hold(1500); const t = c.foes[0], a = c.pt(c.me, 0.3), f = c.foot(t); const cn = c.ico(a.x, a.y, 13378, "icoin"); const dx = f.x - a.x; c.fin.push(() => cn.remove());
    cn.animate([{ transform: "translate(-50%,-50%) rotateY(0)", top: a.y + "px", left: a.x + "px" }, { transform: "translate(-50%,-50%) rotateY(1080deg)", top: "-40px", left: a.x + dx * 0.45 + "px", offset: 0.45 }, { transform: "translate(-50%,-50%) rotateY(2160deg)", top: f.y - 14 + "px", left: f.x + "px" }], { duration: 800 * c.T, easing: "linear", fill: "forwards" }); await c.wait(800);
    for (const hgt of [60, 34, 14]) { const tc = c.mk("tic", f.x + 24, f.y - 30); tc.textContent = "tic"; c.later(tc, 500); cn.animate([{ top: f.y - 14 + "px" }, { top: f.y - 14 - hgt + "px", offset: 0.5 }, { top: f.y - 14 + "px" }], { duration: 240 * c.T, fill: "forwards" }); await c.wait(250); }
    pulse(cn, "sgpop"); c.num(t, "Pile !", "#ffd84d", true); for (let i = 0; i < 12; i++) { const k = c.mk("kama", f.x + c.rnd(-40, 40), -10); k.style.animationDelay = i * 40 + "ms"; k.style.setProperty("--fy", f.y - c.rnd(0, 18) + "px"); c.later(k, 1200); }
    await c.wait(260); c.hit(t); await c.wait(400); cn.remove(); },
  /* Ecaflip · Tout ou Rien : une machine à sous au-dessus de l'arène, trois rouleaux s'arrêtent sur 7-7-7 */
  s12858: async (c) => { c.hold(1500); const sl = c.mk("slot", c.W() / 2, 44); sl.innerHTML = "<b>7</b><b>7</b><b>7</b>"; const reels = sl.querySelectorAll("b"); const iv = []; reels.forEach((r, i) => { iv[i] = setInterval(() => (r.textContent = "0123456789"[Math.floor(Math.random() * 10)]), 60); });
    c.fin.push(() => { iv.forEach(clearInterval); sl.remove(); }); for (let i = 0; i < 3; i++) { await c.wait(380 + i * 260); clearInterval(iv[i]); reels[i].textContent = "7"; pulse(reels[i], "sgpop"); }
    await c.wait(200); sl.classList.add("win"); c.num(c.foes[0], "777 !", "#ffd84d", true); c.whiteout(140); c.shake("shake2"); await c.hitAll(80); await c.wait(300); sl.remove(); },
  /* Eniripsa · Mot Vampirique : les lettres volent vers la cible, la mordent, puis reviennent en rouge */
  s25870: async (c) => { c.hold(1200); const t = c.foes[0], a = c.pt(c.me, 0.3), b = c.pt(t, 0.5); const L = []; "VAMPIRE".split("").forEach((ch, i) => { const l = c.mk("letter", a.x - 30 + i * 10, a.y - 10); l.textContent = ch; L.push(l); l.animate([{ left: a.x - 30 + i * 10 + "px", top: a.y - 10 + "px" }, { left: b.x - 24 + i * 8 + "px", top: b.y - 40 + "px", offset: 0.6 }, { left: b.x - 24 + i * 8 + "px", top: b.y + "px", transform: "translate(-50%,-50%) scale(1.5)" }], { duration: 550 * c.T, delay: i * 70 * c.T, fill: "forwards", easing: "ease-in" }); });
    c.fin.push(() => L.forEach((l) => l.remove())); await c.wait(550 + 7 * 70); c.hit(t); L.forEach((l, i) => { l.classList.add("red"); l.animate([{ left: b.x - 24 + i * 8 + "px", top: b.y + "px", opacity: 1 }, { left: a.x + "px", top: a.y - 40 + "px", opacity: 1, offset: 0.7 }, { left: a.x + "px", top: a.y + "px", opacity: 0 }], { duration: 600 * c.T, delay: i * 50 * c.T, fill: "forwards" }); c.later(l, 1000 + i * 50); });
    await c.wait(900); c.rest(); },
  /* Eniripsa · Mot Interdit : un mot censuré tremble puis s'écrase sur la cible, dont le nom reste censuré */
  s25873: async (c) => { c.hold(1100); const t = c.foes[0], a = c.pt(c.me, 0.1), b = c.pt(t, 0.4); const cs = c.mk("censor", a.x, a.y - 10); cs.textContent = "■■■■"; cs.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: 200 * c.T, fill: "forwards" }); await c.wait(200); cs.classList.add("tremble"); await c.wait(500);
    cs.classList.remove("tremble"); cs.animate([{ left: a.x + "px", top: a.y - 10 + "px", transform: "translate(-50%,-50%) scale(1)" }, { left: b.x + "px", top: b.y + "px", transform: "translate(-50%,-50%) scale(1.6)" }], { duration: 220 * c.T, easing: "ease-in", fill: "forwards" }); await c.wait(220); c.whiteout(100);
    const who = c.who(t), old = who ? who.textContent : ""; if (who) who.textContent = "■■■■ ■■■■"; c.fin.push(() => { if (who && who.textContent === "■■■■ ■■■■") who.textContent = old; cs.remove(); }); c.later(cs, 300); c.hit(t); c.rest(); await c.wait(1600); if (who) who.textContent = old; },
  /* Sadida · Herbes Folles : le sol verdit en vague, puis l'herbe attrape les ennemis */
  s13518: async (c) => { c.hold(1000); const a = c.pt(c.me), d1 = c.dir(c.foes[0]); const fl = c.mkg("floorgreen", 0, 0, { top: "62%" }); fl.animate([{ clipPath: d1 > 0 ? `inset(0 ${c.W() - a.x}px 0 0)` : `inset(0 0 0 ${a.x}px)` }, { clipPath: "inset(0 0 0 0)" }], { duration: 700 * c.T, fill: "forwards", easing: "ease-out" }); c.later(fl, 2000);
    await Promise.all(c.foes.map(async (k) => { const t = Math.abs((c.pt(k).x - a.x) / (d1 > 0 ? c.W() - a.x : a.x)); await c.wait(700 * t); const f = c.foot(k); for (let i = -1; i <= 1; i++) { const g = c.mk("blade2", f.x + i * 18, f.y + 2); g.style.animationDelay = i * 60 + 60 + "ms"; c.later(g, 1400); } c.anim(k, [{ transform: "none" }, { transform: "rotate(-7deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(-5deg)" }, { transform: "none" }], 600); c.hit(k); })); c.rest(); },
  /* Sadida · Forêt Hantée : le ciel s'assombrit, l'ombre de chaque monstre se détache et l'attaque */
  s13524: async (c) => { c.hold(1300); c.dim(true); c.fin.push(() => c.dim(false)); await c.wait(250);
    await Promise.all(c.foes.map(async (k, i) => { await c.wait(i * 150); const sh = c.clone(k, "shadowc"); sh.innerHTML += "<i></i><i></i>"; sh.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 0 }, { transform: "translate(-50%,calc(-50% - 70px)) scale(1.25)", opacity: 0.95, offset: 0.55 }, { transform: "translate(-50%,calc(-50% - 60px)) scale(1.3)", opacity: 1, offset: 0.75 }, { transform: "translate(-50%,-40%) scale(.9)", opacity: 0 }], { duration: 1000 * c.T, fill: "forwards" }); c.later(sh, 1020); await c.wait(820); c.hit(k); })); c.dim(false); },
  /* Sacrieur · Hémorragie : ses tatouages s'allument, des gouttes de sang quittent la cible en spirale vers lui */
  s12748: async (c) => { c.hold(700); const t = c.foes[0], bd = c.body(c.me); bd.style.filter = "drop-shadow(0 0 8px #ff2a2a) contrast(1.15)"; c.fin.push(() => (bd.style.filter = "")); await c.wait(120); c.hit(t); const a = c.pt(t, 0.5), b = c.pt(c.me, 0.45);
    for (let i = 0; i < 9; i++) { const m = c.mk("blood", a.x, a.y); const s = i % 2 ? 1 : -1; m.animate([{ left: a.x + "px", top: a.y + "px" }, { left: a.x + (b.x - a.x) * 0.3 + "px", top: a.y + s * 50 + "px", offset: 0.33 }, { left: a.x + (b.x - a.x) * 0.66 + "px", top: a.y - s * 40 + "px", offset: 0.66 }, { left: b.x + "px", top: b.y + "px" }], { duration: 750 * c.T, delay: i * 60 * c.T, fill: "forwards" }); c.later(m, 850 + i * 60); }
    await c.wait(800); c.rest(); await c.wait(300); bd.style.filter = ""; },
  /* Sacrieur · Déchaînement : traînée rouge qui zigzague entre les ennemis avec des images rémanentes et une entaille à chaque passage */
  s12755: async (c) => { c.hold(1100); const me = c.me, bd = c.body(me), a = c.pt(me); c.z(me, true); bd.style.filter = "blur(1.5px) sepia(1) saturate(8) hue-rotate(-30deg)"; c.fin.push(() => { bd.style.transform = ""; bd.style.filter = ""; c.cancel(me); c.z(me, false); });
    for (const k of c.foes) { const b = c.pt(k), d1 = c.dir(k); const gh = c.clone(me, "after"); c.later(gh, 450);
      c.anim(me, [{ transform: bd.style.transform || "none" }, { transform: `translate(${b.x - a.x - d1 * 30}px,${b.y - a.y}px)` }], { duration: 150, easing: "ease-in", fill: "forwards" }); await c.wait(150); bd.style.transform = `translate(${b.x - a.x - d1 * 30}px,${b.y - a.y}px)`; c.cancel(me);
      const sl = c.mk("slashr", b.x, b.y); sl.style.setProperty("--r", c.rnd(-50, 50) + "deg"); c.later(sl, 600); c.hit(k); await c.wait(130); }
    c.anim(me, [{ transform: bd.style.transform }, { transform: "none" }], { duration: 220, fill: "forwards" }); await c.wait(230); bd.style.transform = ""; c.cancel(me); bd.style.filter = ""; c.z(me, false); },
  /* Pandawa · Paume Explosive : coup au ralenti, l'arène ondule, la cible s'écrase puis glisse */
  s12781: async (c) => { c.hold(1500); const t = c.foes[0], me = c.me, a = c.pt(me, 0.45), b = c.pt(t, 0.5), d1 = c.dir(t), dx = b.x - a.x - d1 * 40, dy = b.y - a.y; c.z(me, true); c.fin.push(() => { c.z(me, false); c.cancel(me); });
    c.anim(me, [{ transform: "none" }, { transform: `translateX(${-d1 * 8}px)`, offset: 0.12 }, { transform: `translate(${dx}px,${dy}px) scale(1.05)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.58 }, { transform: "none" }], { duration: 1500, easing: "cubic-bezier(.2,.8,.3,1)" }); await c.wait(650);
    const p = c.pt(t, 0.5); for (let i = 0; i < 3; i++) { const r = c.mk("ripple", p.x, p.y); r.style.animationDelay = i * 160 + "ms"; r.style.animationDuration = "1200ms"; c.later(r, 2000); }
    c.anim(t, [{ transform: "none" }, { transform: "scale(1.3,.55)", offset: 0.25 }, { transform: `translateX(${d1 * 46}px) scale(.9,1.1)`, offset: 0.6 }, { transform: `translateX(${d1 * 40}px)` }, { transform: "none" }], 1100); await c.wait(300); c.hit(t); await c.hitAll(60); await c.wait(500); c.z(me, false); },
  /* Pandawa · Flasque Explosive : la flasque arrose tout le monde, les monstres titubent avec des bulles et un « hips ! » */
  s12796: async (c) => { c.hold(1500); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.5); c.proj(a, b, "f", "bottle", 300); await c.wait(300); const p = c.pt(t, 0.4); for (let i = 0; i < 16; i++) { const d = c.mk("splash", p.x, p.y); const ang = c.rnd(-Math.PI, 0), r = c.rnd(50, 190); d.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * r}px),calc(-50% + ${Math.sin(ang) * r * 0.5 + 60}px))`, opacity: 0.2 }], { duration: 600 * c.T, easing: "cubic-bezier(.2,.6,.8,1)" }); c.later(d, 620); }
    await c.wait(250); for (const k of c.foes) { c.anim(k, [{ transform: "rotate(0)" }, { transform: "rotate(-9deg) translateX(-6px)" }, { transform: "rotate(8deg) translateX(6px)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(0)" }], 1000); const hp = c.pt(k, 0.1); const h2 = c.mk("hips", hp.x + 16, hp.y); h2.textContent = "hips !"; c.later(h2, 900); for (let i = 0; i < 4; i++) { const bb = c.mk("bub2", c.pt(k).x + c.rnd(-14, 14), c.pt(k).y); bb.style.animationDelay = i * 140 + "ms"; c.later(bb, 1100); } }
    await c.wait(900); await c.hitAll(60); },
  /* Roublard · Mousquet : zoom sur le Roublard, un viseur sur la cible, bang, balle au ralenti, la cible tourne sur elle-même */
  s13473: async (c) => { c.hold(1500); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.45), d1 = c.dir(t); c.A.el.style.setProperty("--zx", a.x + "px"); c.A.el.style.setProperty("--zy", a.y + "px"); c.cls("zoomb", true); c.fin.push(() => c.cls("zoomb", false)); await c.wait(420);
    const rt = c.mk("reticle", b.x, b.y); c.later(rt, 1300); await c.wait(500); c.cls("zoomb", false); const fl = c.mk("muzzle", a.x + d1 * 30, a.y); c.later(fl, 300); c.puff(a.x + d1 * 34, a.y, "rgba(200,200,200,.8)", 5);
    const bu = c.mk("bullet", a.x + d1 * 30, a.y); if (d1 < 0) bu.style.transform = "translate(-50%,-50%) scaleX(-1)"; bu.animate([{ left: a.x + d1 * 30 + "px" }, { left: b.x + "px" }], { duration: 600 * c.T, easing: "linear", fill: "forwards" }); c.later(bu, 610); await c.wait(600); rt.remove();
    c.anim(t, [{ transform: "rotateY(0)" }, { transform: "rotateY(360deg)" }], 500); c.hit(t); await c.hitAll(50); },
  /* Roublard · Mégabombe : la bombe tombe, l'écran pulse à chaque chiffre, écran blanc, champignon de fumée */
  s13490: async (c) => { c.hold(1500); const cx = c.foes.reduce((s, k) => s + c.pt(k).x, 0) / c.foes.length, cy = c.foes.reduce((s, k) => s + c.pt(k, 0.6).y, 0) / c.foes.length; const bm = c.ico(cx, -60, 12498, "big"); c.fin.push(() => { bm.remove(); c.cls("beat", false); }); bm.animate([{ top: "-60px" }, { top: cy + "px" }], { duration: 450 * c.T, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" }); await c.wait(470);
    for (const n of ["3", "2", "1"]) { c.num(c.foes[0], n, "#ffd84d"); pulse(bm, "sgpop"); c.cls("beat", false); pulse(c.A.el, "sg-beat"); await c.wait(400); } bm.remove(); c.whiteout(260); c.shake();
    const st = c.mk("mstem", cx, cy + 20); c.later(st, 1800); for (let i = 0; i < 7; i++) { const cp = c.mk("mcap", cx + (i - 3) * 26, cy - 70 + Math.abs(i - 3) * 8); cp.style.animationDelay = 150 + Math.abs(i - 3) * 50 + "ms"; c.later(cp, 1800); }
    await c.hitAll(40); c.rest(); },
  /* Zobal · Inferno : il danse autour des ennemis, chaque pas laisse une empreinte de feu, le cercle s'embrase */
  s13423: async (c) => { c.hold(1500); const me = c.me, bd = c.body(me), a = c.pt(me); const cx = c.foes.reduce((s, k) => s + c.pt(k).x, 0) / c.foes.length, cy = c.foes.reduce((s, k) => s + c.pt(k).y, 0) / c.foes.length + 20, R = Math.min(95, c.W() * 0.14); c.z(me, true); c.fin.push(() => { bd.style.transform = ""; c.cancel(me); c.z(me, false); }); const steps = 8;
    for (let i = 0; i <= steps; i++) { const ang = Math.PI + (i / steps) * Math.PI * 2; const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R * 0.45; c.anim(me, [{ transform: bd.style.transform || "none" }, { transform: `translate(${x - a.x}px,${y - a.y}px) rotate(${i % 2 ? -12 : 12}deg)` }], { duration: 140, fill: "forwards" }); await c.wait(140); bd.style.transform = `translate(${x - a.x}px,${y - a.y}px)`; c.cancel(me); if (i < steps) { const fp = c.mkg("footfire", x, y + 40); c.later(fp, 2000); } }
    const ring = c.mkg("firering", cx, cy + 40); c.later(ring, 1200); c.hit(c.foes[0]); await c.hitAll(80); c.anim(me, [{ transform: bd.style.transform }, { transform: "none" }], { duration: 280, fill: "forwards" }); await c.wait(290); bd.style.transform = ""; c.cancel(me); c.z(me, false); c.rest(); },
  /* Zobal · Mascarade : noir de théâtre, projecteur sur la cible, ses trois masques entrent en scène, puis le rideau tombe */
  s13404: async (c) => { c.hold(1500); const t = c.foes[0], b = c.pt(t, 0.5); c.dim(true, true); c.fin.push(() => c.dim(false)); const sp = c.mk("spot", b.x, 0); sp.style.height = b.y + 60 + "px"; c.later(sp, 3000); const sf = c.mk("spotfloor", b.x, c.foot(t).y); c.later(sf, 3000); await c.wait(350);
    const M = [[12404, "#d23b3b", -1], [12401, "#2f6fc0", 1], [12428, "#3fa34d", -1]]; let first = true; for (const [id, col, s] of M) { const m = c.ico(b.x + s * 180, b.y - 20, id, "sm"); m.style.setProperty("--c", col); m.animate([{ left: b.x + s * 180 + "px", opacity: 0 }, { left: b.x + s * 40 + "px", opacity: 1 }], { duration: 300 * c.T, fill: "forwards", easing: "ease-out" }); await c.wait(300); const fl = c.mk("colorflash", b.x, b.y, { "--c": col }); c.later(fl, 400); if (first) { c.hit(t); first = false; } else pulse(t, "hit"); await c.wait(180); m.remove(); }
    const cl = c.mk("curtain l", 0, 0), cr = c.mk("curtain r", 0, 0); cl.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }, { transform: "translateX(0)", offset: 0.6 }, { transform: "translateX(-100%)" }], { duration: 1100 * c.T, fill: "forwards" }); cr.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }, { transform: "translateX(0)", offset: 0.6 }, { transform: "translateX(100%)" }], { duration: 1100 * c.T, fill: "forwards" }); c.later(cl, 1120); c.later(cr, 1120); await c.wait(550); c.dim(false); sp.remove(); sf.remove(); },
  /* Steamer · Marée : l'eau monte jusqu'à mi-hauteur, les monstres flottent, puis la marée se retire en les entraînant */
  s13820: async (c) => { c.hold(1500); const d1 = c.dir(c.foes[0]); const w = c.mk("water", 0, 0, { top: "auto" }); c.fin.push(() => w.remove()); w.animate([{ height: "0px" }, { height: c.H() * 0.55 + "px" }], { duration: 800 * c.T, fill: "forwards", easing: "ease-out" }); await c.wait(450);
    for (const k of c.foes) c.anim(k, [{ transform: "none" }, { transform: "translateY(-26px) rotate(-6deg)", offset: 0.25 }, { transform: "translateY(-14px) rotate(6deg)", offset: 0.5 }, { transform: "translateY(-28px) rotate(-5deg)", offset: 0.75 }, { transform: "translateY(-20px)" }], { duration: 1100, fill: "forwards" });
    await c.wait(1100); w.animate([{ height: c.H() * 0.55 + "px" }, { height: "0px" }], { duration: 600 * c.T, fill: "forwards", easing: "ease-in" }); for (const k of c.foes) { c.cancel(k); c.anim(k, [{ transform: "translateY(-20px)" }, { transform: `translate(${d1 * 48}px,0) rotate(${d1 * 10}deg)`, offset: 0.6 }, { transform: "none" }], 800); }
    await c.wait(350); await c.hitAll(60); c.later(w, 400); },
  /* Steamer · Court-circuit : l'éclair saute de monstre en monstre, chacun clignote en négatif comme une radiographie */
  s13872: async (c) => { c.hold(900); let prev = c.pt(c.me, 0.4); c.fin.push(() => c.foes.forEach((k) => (c.body(k).style.animation = ""))); for (const k of c.foes) { const b = c.pt(k, 0.45); const pts = [prev]; for (let i = 1; i < 6; i++) pts.push({ x: prev.x + (b.x - prev.x) * i / 6 + c.rnd(-10, 10), y: prev.y + (b.y - prev.y) * i / 6 + c.rnd(-14, 14) }); pts.push(b);
      const pl = pts.map((p) => p.x + "," + p.y).join(" "); const s = c.svg(`<polyline points="${pl}" fill="none" stroke="#9fe8ff" stroke-width="5" stroke-linejoin="round" opacity=".55"/><polyline points="${pl}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, 400); s.animate([{ opacity: 1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 380 * c.T });
      c.body(k).style.animation = "sgxray .12s steps(2) 4"; c.hit(k); prev = b; await c.wait(130); c.body(k).style.animation = ""; } c.rest(); },
  /* Eliotrope · Rayon de Wakfu : un trait de wakfu fait trois allers-retours entre deux portails, de plus en plus vite */
  s14579: async (c) => { c.hold(1400); const t = c.foes[0], a = c.pt(c.me, 0.45), b = c.pt(t, 0.45), d1 = c.dir(t); const p1 = c.mk("portalfx", a.x + d1 * 34, a.y), p2 = c.mk("portalfx", b.x - d1 * 40, b.y); c.later(p1, 1700); c.later(p2, 1700); await c.wait(200);
    for (const d of [300, 200, 130]) { const dash = c.mk("wdash", a.x + d1 * 34, a.y); dash.animate([{ left: a.x + d1 * 34 + "px", top: a.y + "px" }, { left: b.x - d1 * 40 + "px", top: b.y + "px" }], { duration: d * c.T, easing: "linear", fill: "forwards" }); await c.wait(d); dash.remove(); pulse(p2, "sgpop"); pulse(t, "hit"); const back = c.mk("wdash", b.x - d1 * 40, b.y); back.animate([{ left: b.x - d1 * 40 + "px", top: b.y + "px" }, { left: a.x + d1 * 34 + "px", top: a.y + "px" }], { duration: d * c.T, easing: "linear", fill: "forwards" }); await c.wait(d); back.remove(); pulse(p1, "sgpop"); }
    c.hit(t); await c.hitAll(50); c.rest(); },
  /* Eliotrope · Cataclysme : un portail géant s'ouvre dans le ciel et aspire les monstres vers le haut, puis les lâche */
  s14619: async (c) => { c.hold(1500); const cx = c.foes.reduce((s, k) => s + c.pt(k).x, 0) / c.foes.length; const g = c.mk("bigportal", cx, 26); g.animate([{ transform: "translate(-50%,-50%) scaleX(0)" }, { transform: "translate(-50%,-50%) scaleX(1)" }], { duration: 300 * c.T, fill: "forwards" }); c.later(g, 2100); await c.wait(330); c.fin.push(() => c.foes.forEach((k) => c.z(k, false)));
    for (const k of c.foes) { const b = c.pt(k); c.anim(k, [{ transform: "none" }, { transform: "scaleY(1.5) translateY(-20px)", offset: 0.3 }, { transform: `translate(${(cx - b.x) * 0.5}px,-150px) scaleY(1.7) scaleX(.7)`, offset: 0.75 }, { transform: `translate(${(cx - b.x) * 0.5}px,-150px) scaleY(1.7) scaleX(.7)`, offset: 0.85 }, { transform: "translateY(0) scaleY(.75) scaleX(1.2)", offset: 0.95 }, { transform: "none" }], { duration: 1400, easing: "ease-in-out" }); c.z(k, true); }
    await c.wait(1350); c.shake("shake2"); await c.hitAll(40); c.foes.forEach((k) => c.z(k, false)); c.rest(); },
  /* Huppermage · Météore : une boule de feu entre par le coin du ciel, grossit en diagonale avec sa traînée, et laisse un cratère rougeoyant */
  s13675: async (c) => { c.hold(1300); const t = c.foes[0], b = c.pt(t, 0.55), d1 = c.dir(t), x0 = d1 > 0 ? 20 : c.W() - 20; c.cls("rumble", true); c.fin.push(() => c.cls("rumble", false)); const m = c.mk("meteor", x0, 10); m.animate([{ left: x0 + "px", top: "10px", transform: "translate(-50%,-50%) scale(.15)" }, { left: b.x + "px", top: b.y + "px", transform: "translate(-50%,-50%) scale(1)" }], { duration: 900 * c.T, easing: "cubic-bezier(.5,0,.9,.4)", fill: "forwards" });
    let k = 0; const tr = setInterval(() => { if (++k > 30 || !m.isConnected) return clearInterval(tr); const r = m.getBoundingClientRect(), ar = c.A.el.getBoundingClientRect(); const tl = c.mk("tail", r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2); if (d1 < 0) tl.style.transform = "translate(100%,-50%) rotate(-28deg)"; tl.style.width = 10 + k + "px"; c.later(tl, 500); }, 33);
    await c.wait(900); m.remove(); clearInterval(tr); c.cls("rumble", false); c.whiteout(120); c.shake(); const f = c.foot(t); const cr = c.mkg("craterglow", f.x, f.y); cr.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 2400 * c.T, fill: "forwards" }); c.later(cr, 2400); c.puff(b.x, b.y, "rgba(255,140,60,.8)", 10); c.hit(t); },
  /* Huppermage · Ouragan : les quatre éléments tournent autour de lui, fusionnent en blanc, l'arène tangue sous l'ouragan */
  s13714: async (c) => { c.hold(1500); const a = c.pt(c.me, 0.5); const orbs = ["f", "e", "t", "a"].map((el, i) => c.mk("elorb", a.x, a.y, { "--c": c.C(el), "--a": i * 90 + "deg" })); c.fin.push(() => { orbs.forEach((o) => o.remove()); c.cls("tilt", false); }); await c.wait(800);
    orbs.forEach((o) => { o.style.animation = "none"; o.animate([{ transform: "translate(-50%,-50%) rotate(var(--a)) translateX(46px)" }, { transform: "translate(-50%,-50%) translateX(0)", background: "#fff" }], { duration: 300 * c.T, fill: "forwards" }); c.later(o, 320); }); await c.wait(320); const wo = c.mk("whiteorb", a.x, a.y); c.later(wo, 500);
    c.cls("tilt", true); const cx = c.foes.reduce((s, k) => s + c.pt(k).x, 0) / c.foes.length, cy = c.pt(c.foes[0]).y; const tor = c.mk("bigtornado", cx, cy); c.later(tor, 1400); for (const k of c.foes) c.anim(k, [{ transform: "none" }, { transform: `translate(${c.rnd(-30, 30)}px,-40px) rotate(${c.rnd(-40, 40)}deg)`, offset: 0.3 }, { transform: `translate(${c.rnd(-30, 30)}px,-30px) rotate(${c.rnd(-40, 40)}deg)`, offset: 0.6 }, { transform: "none" }], 1200);
    await c.wait(450); await c.hitAll(90); await c.wait(400); c.cls("tilt", false); c.rest(); },
  /* Ouginak · Amarok : silhouette de loup aux yeux brillants, bond, mâchoires, la cible est traînée vers lui */
  s13802: async (c) => { c.hold(1300); const t = c.foes[0], me = c.me, bd = c.body(me); bd.style.filter = "brightness(0) drop-shadow(0 0 6px #c08a3e)"; const eyes = document.createElement("div"); eyes.className = "sgeyes"; eyes.innerHTML = "<i></i><i></i>"; bd.appendChild(eyes); c.fin.push(() => { bd.style.filter = ""; eyes.remove(); c.cancel(me); c.z(me, false); c.cancel(t); }); await c.wait(400);
    const a = c.pt(me), b = c.pt(t), d1 = c.dir(t); c.z(me, true); c.anim(me, [{ transform: "none" }, { transform: `translate(${(b.x - a.x) * 0.5}px,${b.y - a.y - 80}px)`, offset: 0.5 }, { transform: `translate(${b.x - a.x - d1 * 40}px,${b.y - a.y}px)` }], { duration: 400, easing: "ease-in", fill: "forwards" }); await c.wait(400);
    const jt = c.mk("jaw t", b.x, b.y - 30), jb = c.mk("jaw b", b.x, b.y + 30); jt.animate([{ top: b.y - 40 + "px" }, { top: b.y - 6 + "px" }], { duration: 120 * c.T, fill: "forwards" }); jb.animate([{ top: b.y + 40 + "px" }, { top: b.y + 6 + "px" }], { duration: 120 * c.T, fill: "forwards" }); c.later(jt, 500); c.later(jb, 500); await c.wait(130);
    c.anim(t, [{ transform: "none" }, { transform: `translateX(${-d1 * 50}px) rotate(${-d1 * 10}deg)` }, { transform: `translateX(${-d1 * 30}px)` }], { duration: 500, fill: "forwards" }); c.anim(me, [{ transform: `translate(${b.x - a.x - d1 * 40}px,${b.y - a.y}px)` }, { transform: `translate(${b.x - a.x - d1 * 80}px,${b.y - a.y}px)` }], { duration: 500, fill: "forwards" }); c.hit(t); await c.hitAll(40); await c.wait(400);
    c.cancel(t); c.anim(me, [{ transform: `translate(${b.x - a.x - d1 * 80}px,${b.y - a.y}px)` }, { transform: "none" }], { duration: 280, fill: "forwards" }); await c.wait(290); c.cancel(me); bd.style.filter = ""; eyes.remove(); c.z(me, false); },
  /* Ouginak · Cerbère : des laisses de lumière vers les monstres, il tire d'un coup sec, tous sont ramenés et mordus */
  s13758: async (c) => { c.hold(1000); const a = c.pt(c.me, 0.45), d1 = c.dir(c.foes[0]); const Ls = c.foes.map((k) => { const b = c.pt(k, 0.5), dx = b.x - a.x, dy = b.y - a.y; const l = c.mk("leash", a.x, a.y); l.style.width = Math.hypot(dx, dy) + "px"; l.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`; l.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 280 * c.T, fill: "forwards" }); return [k, l]; }); c.fin.push(() => Ls.forEach(([k, l]) => { l.remove(); c.cancel(k); })); await c.wait(400);
    c.anim(c.me, [{ transform: "none" }, { transform: `translateX(${-d1 * 18}px) rotate(${-d1 * 8}deg)` }, { transform: "none" }], 300); Ls.forEach(([k, l]) => { l.classList.add("taut"); c.anim(k, [{ transform: "none" }, { transform: `translateX(${-d1 * 60}px) rotate(${-d1 * 12}deg)`, offset: 0.5 }, { transform: `translateX(${-d1 * 50}px)` }], { duration: 380, fill: "forwards" }); }); await c.wait(400);
    Ls.forEach(([k]) => { const b = c.pt(k); const bite = c.mk("bitemark", b.x, b.y); c.later(bite, 500); }); await c.hitAll(0); c.rest(); await c.wait(400); Ls.forEach(([k, l]) => { l.remove(); c.cancel(k); c.anim(k, [{ transform: `translateX(${-d1 * 50}px)` }, { transform: "none" }], 350); }); await c.wait(360); },
  /* Forgelance · Charge Héroïque : il charge avec une bannière flottante, la cible est lancée en l'air et retombe */
  s23824: async (c) => { c.hold(1100); const t = c.foes[0], me = c.me, a = c.pt(me, 0.35), b = c.pt(t, 0.5), d1 = c.dir(t); const bn = c.mk("banner", a.x - d1 * 10, a.y); if (d1 < 0) bn.style.transformOrigin = "100% 50%"; bn.animate([{ left: a.x - d1 * 10 + "px", width: "0px" }, { left: (d1 > 0 ? b.x - 50 : b.x - 70) + "px", width: "120px" }], { duration: 380 * c.T, fill: "forwards" }); c.later(bn, 1100);
    const dx = b.x - a.x - d1 * 40, dy = b.y - a.y; c.z(me, true); c.fin.push(() => { c.z(me, false); c.cancel(me); }); c.anim(me, [{ transform: "none" }, { transform: `translateX(${-d1 * 8}px)`, offset: 0.12 }, { transform: `translate(${dx}px,${dy}px) scale(1.05)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px)`, offset: 0.58 }, { transform: "none" }], 700); await c.wait(320);
    c.anim(t, [{ transform: "none" }, { transform: "translateY(-140px) rotate(180deg)", offset: 0.5 }, { transform: "translateY(-120px) rotate(360deg)", offset: 0.6 }, { transform: "translateY(0) scaleY(.75)", offset: 0.95 }, { transform: "none" }], 900); await c.wait(380); c.hit(t); await c.wait(400); c.z(me, false); },
  /* Forgelance · Pluie d'Airain : il lance sa lance au ciel, elle retombe en pluie de lances plantées dans le sol */
  s24219: async (c) => { c.hold(1200); const a = c.pt(c.me, 0.4); const up = c.mk("lanceup", a.x + 10, a.y); up.animate([{ top: a.y + "px", opacity: 1 }, { top: "-40px", opacity: 0.6 }], { duration: 350 * c.T, easing: "ease-out", fill: "forwards" }); c.later(up, 380); c.anim(c.me, [{ transform: "none" }, { transform: "scaleY(1.08) translateY(-6px)" }, { transform: "none" }], 400); await c.wait(420);
    const xs = []; c.foes.forEach((k) => { const f = c.foot(k); for (let i = 0; i < 4; i++) xs.push([f.x + c.rnd(-34, 34), f.y - 2]); });
    xs.forEach(([x, y], i) => { const s = c.mk("lancefall", x, -30); s.animate([{ top: "-30px" }, { top: y - 26 + "px" }], { duration: 240 * c.T, delay: i * 40 * c.T, easing: "cubic-bezier(.6,0,1,.5)", fill: "forwards" }); c.later(s, 1500 + i * 40); });
    await c.wait(600); c.shake("shake2"); await c.hitAll(60); },
};
/* lance l'animation signature d'un sort ; renvoie faux si le sort n'en a pas (ou si les animations ne sont pas « complètes ») */
function sgPlay(F, A, def, src, sn, hits, rest, el) {
  const fn = def && axFull() && SG[def.id]; if (!fn || !sn) return false;
  const c = sgCtx(F, A, src, sn, hits, rest, el); if (!c.foes.length) return false;
  fn(c).catch(() => {}).finally(() => { c.flush(); c.fin.forEach((f) => { try { f(); } catch (e) { /* le nœud a pu disparaître */ } }); });
  return true;
}
function axGroup(F, A, g) {
  if (ui.arena !== A) return;
  const cast = g.find((f) => f.k === "cast"), sp = axSpd();
  if (!cast) return g.forEach((f) => axEvent(F, A, f));
  const s = cast.s, src = F.ents[s], sn = A.nodes[s];
  const hits = g.filter((f) => f.k === "hit" && f.s === s && f.t !== s), rest = g.filter((f) => f !== cast && !hits.includes(f));
  const def = src && src.side === "c" && cast.sp && src.cls && !src.summon ? E.spellDef(src.cls, cast.sp) : null;
  const el = hits.length ? hits[0].el || "n" : g.some((f) => f.k === "heal") ? "h" : "n";
  if (def && sn) axSpellTag(A, sn, def.name, el);
  if (src && src.side === "c" && !src.summon && sgPlay(F, A, def, src, sn, hits, rest, el)) return; // sort signature : animation unique
  const tg = [...new Set(hits.map((f) => f.t))].filter((t) => A.nodes[t]);
  let when = () => 0;
  if (sn && src && tg.length === 1) { const d = axSingle(A, src, sn, A.nodes[tg[0]], el, def, sp); when = () => d; }
  else if (sn && src && tg.length > 1) { const fn = axZone(A, src, sn, tg.map((t) => A.nodes[t]), el, sp); when = (f) => fn(A.nodes[f.t]); }
  else if (sn) pulse(sn, "act");
  const late = tg.length ? when({ t: tg[0] }) : 0;
  hits.forEach((f) => setTimeout(() => axEvent(F, A, f), when(f)));
  rest.forEach((f) => setTimeout(() => axEvent(F, A, f), f.k === "hit" ? late : Math.min(late, 200 * sp)));
}
/* chute d'un monstre (fumée, kamas) ; tombe d'un héros */
function axDeath(A, n, e) {
  if (!axOn()) return n.classList.add("dead");
  const sp = axSpd();
  setTimeout(() => { if (!n.isConnected || n.dataset.ko !== "1") return;
    const b = axBody(n), p = axPt(A, n, 0.7);
    if (e.side === "m") {
      if (b && b.animate) b.animate([{ transform: "none" }, { transform: "scale(1.12,.72) translateY(12%)", offset: 0.3 }, { transform: "scale(.6,.2) translateY(60%)", opacity: 0 }], { duration: 420, easing: "ease-in", fill: "forwards" });
      axPuff(A, p.x, p.y, "rgba(210,210,200,.75)", axFull() ? 7 : 4);
      if (axFull()) for (let i = 0; i < 4; i++) { const c = axMk(A, "coin", p.x, p.y), dx = axRnd(-40, 40);
        c.animate([{ transform: "translate(-50%,-50%)" }, { transform: `translate(calc(-50% + ${dx * 0.6}px),calc(-50% - ${axRnd(30, 55)}px))`, offset: 0.45 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + 16px))`, opacity: 1, offset: 0.85 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + 16px))`, opacity: 0 }], { duration: 800, delay: i * 40, easing: "ease-out" }); axLater(c, 900); }
      setTimeout(() => { if (n.dataset.ko === "1") { n.classList.add("dead"); if (b && b.getAnimations) b.getAnimations().forEach((x) => x.cancel()); } }, 430);
    } else { n.classList.add("dead"); if (!n.querySelector(".tomb")) { const t = document.createElement("span"); t.className = "tomb"; (n.querySelector(".lookwrap,.medal") || n).appendChild(t); } const f = axFoot(A, n); axDust(A, f.x, f.y, 5); }
  }, 300 * sp);
}
/* états visibles : pastilles sous la barre de vie, bulle de bouclier, gel, or */
const AX_ICO = {
  poison: '<svg viewBox="0 0 10 10"><path d="M5 1C5 1 2 4.6 2 6.4a3 3 0 0 0 6 0C8 4.6 5 1 5 1z" fill="#9bf06a"/></svg>',
  boost: '<svg viewBox="0 0 10 10"><path d="M5 1l3 4H6v4H4V5H2z" fill="#ffd84d"/></svg>',
  weak: '<svg viewBox="0 0 10 10"><path d="M5 9L2 5h2V1h2v4h2z" fill="#c77dff"/></svg>',
  vuln: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.4" fill="none" stroke="#ff6b6b" stroke-width="1.4"/><circle cx="5" cy="5" r="1.2" fill="#ff6b6b"/></svg>',
  pa: '<svg viewBox="0 0 10 10"><path d="M2 1h6v1L5.6 5 8 8v1H2V8l2.4-3L2 2z" fill="#4fa8ff"/></svg>',
  stun: '<svg viewBox="0 0 10 10"><path d="M5 0v10M0 5h10M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="#bfe8ff" stroke-width="1.3"/></svg>',
  mute: '<svg viewBox="0 0 10 10"><path d="M2 4h2l3-2v6L4 6H2z" fill="#ddd"/><path d="M1 1l8 8" stroke="#ff6b6b" stroke-width="1.4"/></svg>',
  root: '<svg viewBox="0 0 10 10"><path d="M5 0v5M5 5L2 9M5 5l3 4M5 6v4" stroke="#a8e070" stroke-width="1.4" fill="none"/></svg>',
  warn: '<svg viewBox="0 0 10 10"><path d="M5 1l4 8H1z" fill="#ff6b6b"/></svg>',
};
function axStates(F, e, i) {
  const ch = [], add = (k, txt, c, tip) => ch.push(`<span class="st" style="--c:${c}" title="${h(tip)}">${AX_ICO[k]}${txt}</span>`);
  if ((e.dots || []).length) add("poison", Math.max(...e.dots.map((d) => d.turns)), "#9bf06a", "Poison");
  const db = (e.debuffs || []).filter((b) => b.turns >= 0 && b.turns < 99);
  if (db.some((d) => d.weak)) add("weak", "", "#c77dff", "Affaibli");
  if (db.some((d) => d.vuln) || e.mark > 0) add("vuln", "", "#ff6b6b", e.mark > 0 ? "Marqué par le Crâ" : "Vulnérable");
  if (e.paLoss > 0) add("pa", "−" + e.paLoss, "#4fa8ff", "PA retirés");
  if (e.stun > 0) add("stun", "", "#bfe8ff", "Passe son tour");
  if (e.silence > 0) add("mute", "", "#ddd", "Muet");
  if (e.rooted > 0) add("root", "", "#a8e070", "Enraciné : ne peut plus soigner");
  if (e.charging) add("warn", "", "#ff6b6b", "Prépare une attaque dévastatrice");
  if (F.ents.some((m) => m.alive && m.doom && m.doom.i === i)) add("warn", "", "#ff6b6b", "Condamné");
  return ch.slice(0, 4).join("");
}
function axDecor(n, e) { if (!n || n.querySelector(".sts")) return; n.insertAdjacentHTML("beforeend", `<div class="sts"></div><span class="sc"></span>${e.side === "c" ? '<span class="dz"></span><span class="gly"></span>' : '<span class="vis"></span><span class="prey"></span><span class="trap"></span><span class="brm"></span>'}`);
  const lw = e.side === "c" && !e.summon && n.querySelector(".lookwrap"); if (lw) lw.insertAdjacentHTML("beforeend", `<div class="psv"></div>`); }
function axUpdateEnt(F, A, e, i, n) {
  if (A.view !== "scene") return n.classList.toggle("dead", !e.alive);
  if (!e.alive && n.dataset.ko !== "1") { n.dataset.ko = "1"; axDeath(A, n, e); }
  else if (e.alive && n.dataset.ko === "1") { n.dataset.ko = ""; n.classList.remove("dead"); const t = n.querySelector(".tomb"); if (t) t.remove(); const b = axBody(n); if (b && b.getAnimations) b.getAnimations().forEach((x) => x.cancel()); }
  const on = axOn() && e.alive;
  const st = n.querySelector(".sts"); if (st) { const k = on ? axStates(F, e, i) : ""; if (st.dataset.k !== k) { st.innerHTML = k; st.dataset.k = k; } }
  n.classList.toggle("shielded", on && e.shield > 0);
  n.classList.toggle("frozen", on && e.stun > 0);
  n.classList.toggle("golden", on && e.gold > 0);
  n.classList.toggle("dzon", on && e.side === "c" && F.ents.some((m) => m.alive && m.charging));
  axPassive(F, A, e, i, n);
}
function axVictory(F, A) {
  if (A.view !== "scene" || !axOn() || F.result !== "win") return;
  A.nodes.forEach((n, i) => { const e = F.ents[i]; if (!n || !e || e.side !== "c" || !e.alive) return; const b = axBody(n); if (b && b.animate) b.animate([{ transform: "none" }, { transform: "translateY(-18px)", offset: 0.25 }, { transform: "none", offset: 0.5 }, { transform: "translateY(-10px)", offset: 0.75 }, { transform: "none" }], { duration: 800, delay: 250 + i * 90, easing: "ease-out" }); });
}
/* passifs de classe visibles (lot 2) : jauges, horloge, masques, runes, postures, glyphes, roulette… */
const AX_RUNE = { f: "#ff7a3c", e: "#4fa8ff", t: "#c08a3e", a: "#57d06a" };
const axPips = (n, v, c, round) => `<span class="pvg${round ? " round" : ""}" style="--c:${c}">${Array.from({ length: n }, (_, k) => `<i class="${k < v ? "on" : ""}"></i>`).join("")}</span>`;
function axPassive(F, A, e, i, n) {
  const on = axOn() && e.alive;
  if (e.side !== "c") { // marques posées sur les monstres (viseur du Crâ, crocs de l'Ouginak)
    n.classList.toggle("crm", on && e.mark > 0);
    const og = on ? F.ents.find((h) => h.alive && h.cls === "ougi" && h.lastTgt === e && (h.ougi || 0) > 0) : null;
    n.classList.toggle("prm", !!og); if (og) n.style.setProperty("--prey", 0.7 + og.ougi * 0.12);
    // pièges du Sram et ronces du Sadida (poisons posés par eux)
    const by = (d) => (F.ents.find((h) => h.side === "c" && !h.summon && h.name === d.src) || {}).cls, ds = on ? e.dots || [] : [];
    n.classList.toggle("trp", ds.some((d) => by(d) === "sram"));
    const nb = ds.filter((d) => by(d) === "sadi").length, bm = n.querySelector(".brm"), bk = nb ? "×" + nb : "";
    if (bm && bm.textContent !== bk) { bm.textContent = bk; n.dataset.brm = nb || ""; if (nb) pulse(bm, "bpop"); }
    return;
  }
  if (e.summon) { // Arbre du Sadida, tourelle du Steamer, fil de l'Osamodas
    const k = on ? (e.tree ? "tree" : e.turret ? "turret" : "") : "";
    if (n.dataset.pv !== k) { n.dataset.pv = k; if (k === "turret" && axFull() && !n._drop) { n._drop = 1; const p = axFoot(A, n); setTimeout(() => axPuff(A, p.x, p.y - 10, "rgba(220,230,240,.85)", 7), 380); } }
    return;
  }
  if (e.cls === "osa") axTether(F, A, e, i, n, on);
  const box = n.querySelector(".psv"); if (!box) return;
  const pv = n._pv || (n._pv = {}); let k = "", cls = "";
  if (on) switch (e.cls) {
    case "iop": { const s = e.stack || 0; k = axPips(6, s, "#ff6a2a"); if (s >= 6) cls = "burn";
      if (pv.v >= 6 && s < 6 && axFull()) { const p = axPt(A, n, 0.45); axPuff(A, p.x, p.y, "rgba(255,120,40,.85)", 8); axMk(A, "ring", p.x, p.y, { "--c": "#ff6a2a" }); }
      pv.v = s; break; }
    case "xelor": { const c = e.clock || 0;
      k = `<svg class="clk" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#1a2440" stroke="#f1cf6e" stroke-width="3"/>${Array.from({ length: 12 }, (_, j) => `<circle cx="${20 + 13 * Math.sin(j * Math.PI / 6)}" cy="${20 - 13 * Math.cos(j * Math.PI / 6)}" r="${j < c ? 1.9 : 1.2}" fill="${j < c ? "#9fd6ff" : "#5d6b8a"}"/>`).join("")}<line x1="20" y1="20" x2="20" y2="8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" transform="rotate(${c * 30} 20 20)"/><circle cx="20" cy="20" r="2.4" fill="#f1cf6e"/></svg>`;
      if (pv.v >= 10 && c < pv.v) { A.nodes.forEach((m, j) => { const h2 = F.ents[j]; if (!m || !h2 || h2.side !== "c" || !h2.alive || h2.summon) return; const p = axPt(A, m, 0.5); if (axFull()) axMk(A, "ring", p.x, p.y, { "--c": "#4fa8ff" }); floatAt(m, "+1 PA", "#9fd6ff", true); }); }
      pv.v = c; break; }
    case "panda": k = e.cuve ? `<span class="zzz">Zzz</span>` : axPips(5, e.ivresse || 0, "#f1cf6e", true); cls = e.cuve ? "sleep" : e.ivresse > 0 ? "sway" : ""; n.style.setProperty("--sw", (e.ivresse || 0) * 1.6 + "deg"); break;
    case "ougi": k = axPips(5, e.ougi || 0, "#e0382b"); break;
    case "hupper": { const els = e.els || [];
      k = `<span class="hrn">${["f", "e", "t", "a"].map((x, j) => `<i class="${els.includes(x) ? "on" : ""}" style="--c:${AX_RUNE[x]};--a:${j * 90}deg"></i>`).join("")}</span>`;
      if (pv.v >= 4 && els.length < pv.v && axFull()) { const p = axPt(A, n, 0.5); ["#ff7a3c", "#4fa8ff", "#c08a3e", "#57d06a"].forEach((c, j) => setTimeout(() => axMk(A, "ring", p.x, p.y, { "--c": c }), j * 90)); }
      pv.v = els.length; break; }
    case "sacri": cls = "suf"; n.style.setProperty("--suf", Math.min(1, (e.suffer || 0) / 15).toFixed(2)); break;
    case "feca": if (F.glyph) A.el.dataset.glyph = F.glyph; if (F.glyph !== pv.g) { pv.g = F.glyph; A.el.querySelectorAll(".gly").forEach((g) => pulse(g, "gpop")); } break;
    case "forge": cls = e.posture || ""; if (e.posture === "rempart") k = `<span class="rmp"></span>`; break;
    case "zobal": if (e.mask) k = `<span class="msk ${e.mask}">${e.mask === "atk" ? "Psycho" : e.mask === "def" ? "Pleutre" : "Hyst."}</span>`; break;
    case "eni": if (e.eniDmg) k = `<span class="pvc" style="--c:#ff7ad0">♥ +15 % attaque</span>`; else if (e.eniHeal) k = `<span class="pvc" style="--c:#8fe36a">♥ +15 % soin</span>`; break;
    case "elio": if (e.portal) { cls = "portal"; k = `<span class="ptl l"></span><span class="ptl r"></span>`; } break;
    case "roub": if (F.ents.filter((m) => m.side === "m" && m.alive).length >= 4) k = `<span class="pvc" style="--c:#ffb347">Artificier +15 %</span>`; break;
    case "eca": if (F.roulette) k = `<span class="pvc" style="--c:${F.roulette === "jackpot" ? "#ffd84d" : F.roulette === "perdu" ? "#9a9a9a" : F.roulette === "pile" ? "#3fa34d" : "#2f86d6"}">${F.roulette === "pile" ? "Pile" : F.roulette === "face" ? "Face" : F.roulette === "jackpot" ? "Jackpot !" : "Perdu"}</span>`;
      if (F.roulette && !A.rlt) { A.rlt = true; if (axFull() && (F.round || 1) <= 1) axWheel(A, F.roulette); } break;
    case "enu": { const t = F.treasure || 0; if (t > (A.tre || 0) && axFull()) { const p = axPt(A, n, 0.2); const b = axMk(A, "bag", p.x, p.y - 30); b.animate([{ transform: "translate(-50%,-50%) translateY(20px) scale(.4)", opacity: 0 }, { transform: "translate(-50%,-50%) translateY(-14px) scale(1.1)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%)", opacity: 1, offset: 0.7 }, { transform: "translate(-50%,-50%) translateY(-10px)", opacity: 0 }], { duration: 1100 }); axLater(b, 1150); floatAt(n, "Trésor !", "#ffd84d", true); }
      A.tre = t; break; }
  }
  if (box.dataset.k !== k) { box.innerHTML = k; box.dataset.k = k; }
  if (n.dataset.pv !== cls) n.dataset.pv = cls;
}
/* fil de lumière entre l'Osamodas et ses invocations */
function axTether(F, A, e, i, n, on) {
  const T = A.teth || (A.teth = {}); const keep = new Set();
  if (on) F.ents.forEach((s, j) => { if (!s.summon || s.owner !== i || !s.alive || !A.nodes[j]) return; keep.add(j);
    const a = axPt(A, n, 0.55), b = axPt(A, A.nodes[j], 0.6), dx = b.x - a.x, dy = b.y - a.y;
    let l = T[j]; if (!l) { l = T[j] = document.createElement("div"); l.className = "axteth"; A.fxl.appendChild(l); }
    Object.assign(l.style, { left: a.x + "px", top: a.y + "px", width: Math.hypot(dx, dy) + "px", transform: `rotate(${Math.atan2(dy, dx)}rad)` }); });
  for (const j in T) if (!keep.has(+j)) { T[j].remove(); delete T[j]; }
}
/* roue de l'Ecaflip au début du combat */
function axWheel(A, res) {
  const MID = { pile: 72, face: 216, jackpot: 306, perdu: 342 }, LBL = { pile: "Pile ! +20 % de dégâts", face: "Face ! +15 % de soins", jackpot: "Jackpot ! Butin ×2", perdu: "Perdu… −5 % de dégâts" };
  const w = document.createElement("div"); w.className = "axwheel"; w.innerHTML = `<i class="ptr"></i><div class="disc"><b style="--a:72deg">Pile</b><b style="--a:216deg">Face</b><b style="--a:306deg">★</b><b style="--a:342deg">✕</b></div>`;
  A.fxl.appendChild(w); const d = w.querySelector(".disc");
  d.animate([{ transform: "rotate(0)" }, { transform: `rotate(${1440 - MID[res]}deg)` }], { duration: 1600, easing: "cubic-bezier(.15,.6,.25,1)", fill: "forwards" });
  setTimeout(() => { const t = document.createElement("div"); t.className = "axwres" + (res === "jackpot" ? " jp" : res === "perdu" ? " ko" : ""); t.textContent = LBL[res]; w.appendChild(t); }, 1650);
  w.animate([{ opacity: 0, transform: "translateX(-50%) scale(.6)" }, { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.08 }, { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.9 }, { opacity: 0, transform: "translateX(-50%) scale(1)" }], { duration: 3000, fill: "forwards" }); axLater(w, 3050);
}
function updateCombat(force) {
  const F = S.fight; const arena = $("#arena"); if (!arena) return;
  if (!ui.arena || ui.arena.el !== arena || ui.arena.fid !== (F ? F.id : null) || ui.arena.theme !== isDark() || ui.arena.view !== combatView()) buildArena(F);
  const A = ui.arena;
  if (F && A.nEnts !== undefined && F.ents.length > A.nEnts) {
    for (let i = A.nEnts; i < F.ents.length; i++) { const e = F.ents[i]; const box = A.el.querySelector(A.view === "compact" ? (e.side === "c" ? ".col.c" : ".col.m") : ".ents"); if (!box) continue;
      box.insertAdjacentHTML("beforeend", A.entHtml([e, i])); A.nodes[i] = box.lastElementChild;
      if (A.view === "scene") { const nn = A.nodes[i]; axDecor(nn, e); if (axOn()) { nn.classList.add("spawn"); setTimeout(() => nn.classList.remove("spawn"), 650); } } }
    A.nEnts = F.ents.length; placeEnts(F);
  }
  const ct = $("#ctour"); if (ct) ct.textContent = F ? `Tour ${F.round}` : "";
  const cs = $("#cstreak"); if (cs) { const k = (S.chalStreak || 0) > 1 ? `${G("flame")} ×${S.chalStreak}` : ""; if (cs.dataset.k !== k) { cs.innerHTML = k; cs.dataset.k = k; } }
  const cb = $("#chalbar"); if (cb) { const ch = chalBarHtml(F); if (cb.dataset.k !== ch) { cb.innerHTML = ch; cb.dataset.k = ch; } }
  const co = $("#chalov"); if (co) { const ch = chalOverlayHtml(F); if (co.dataset.k !== ch) { co.innerHTML = ch; co.dataset.k = ch; const ar = $("#arena"); if (ar) ar.classList.toggle("haschal", !!ch); } }
  if (F) {
    A.el.classList.toggle("axon", A.view === "scene" && axOn());
    F.ents.forEach((e, i) => {
      const n = A.nodes[i]; if (!n) return;
      n.querySelector(".hpb i").style.width = pct(e.hp, e.hpMax) + "%";
      n.querySelector(".hpb b").style.transform = `scaleX(${Math.min(1, (e.shield || 0) / e.hpMax)})`;
      axUpdateEnt(F, A, e, i, n);
      const hn = n.querySelector(".hpn"); if (hn) hn.textContent = `${fmt(Math.max(0, Math.round(e.hp)))} / ${fmt(e.hpMax)}`;
      if (e.side === "c" && !e.summon) { const pn = n.querySelector(".pas"); if (pn) { const P = E.passiveInfo(e, F); const html = P ? `${h(P.n)}${P.m ? ` <span class="pg">${Array.from({ length: Math.min(P.m, 12) }, (_, k) => `<i class="${k < Math.round(P.v * Math.min(P.m, 12) / P.m) ? "on" : ""}"></i>`).join("")}</span>` : ""}` : ""; if (pn.dataset.k !== html) { pn.innerHTML = html; pn.dataset.k = html; } } }
    });
    // mode manuel : héros à qui c'est le tour, cibles possibles
    const AW = F.await && !F.over ? F.await : null; const aw = $("#await");
    if (AW) {
      const me = F.ents[AW.ei]; if (me && ui.combatCid !== me.cid) { ui.combatCid = me.cid; document.querySelectorAll(".herotabs button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.id === me.cid)); }
      const spd = ui.manualSpell ? E.spellDef(me.cls, ui.manualSpell) : null;
      const spk = spd ? E.spellKind(E.spellGrade(spd, me.lvl)) : null;
      const wantAlly = spk === "heal"; const wantFoe = ["dmg", "drain", "dot", "aoe"].includes(spk);
      F.ents.forEach((e, i) => { const n = A.nodes[i]; if (!n) return; n.classList.toggle("targetable", !!(e.alive && ((wantFoe && e.side === "m") || (wantAlly && e.side === "c")))); n.classList.toggle("turnnow", i === AW.ei); });
      const left = Math.max(0, Math.ceil(E.MANUAL_TIMEOUT - (F.dur - AW.t)));
      const html = `<div class="awaitbar">${G("target")} À vous : <b>${h(me.name)}</b> · ${AW.pa} PA · ${spd ? (wantFoe || wantAlly ? `choisissez ${wantAlly ? "un allié" : "un ennemi"} pour ${h(spd.name)}` : "") : "choisissez un sort"} <button class="btn sm" data-act="mend">Fin du tour</button><span class="cnt">auto dans ${left} s</span></div>`;
      if (aw && aw.dataset.k !== html) { aw.innerHTML = html; aw.dataset.k = html; }
    } else {
      if (aw && aw.innerHTML) { aw.innerHTML = ""; aw.dataset.k = ""; }
      if (ui.manualSpell) ui.manualSpell = null;
      A.nodes.forEach((n) => n && n.classList.remove("targetable", "turnnow"));
    }
    const curI = F.order && F.oi > 0 ? F.order[F.oi - 1] : -1; A.nodes.forEach((n, i) => n && n.classList.toggle("cur", i === curI && !F.over));
    const fresh = F.fx.filter((f) => f.seq > A.lastSeq);
    if (fresh.length) {
      A.lastSeq = Math.max(...fresh.map((f) => f.seq));
      if (A.view === "scene" && axOn() && A.fxl && fresh.length <= 40 && document.visibilityState === "visible") {
        const gm = new Map(); fresh.forEach((f) => { if (!gm.has(f.seq)) gm.set(f.seq, []); gm.get(f.seq).push(f); });
        const gs = [...gm.values()], gap = Math.min(240, 480 / gs.length) * axSpd();
        const run = (g) => { const b = Math.max(0, (A.sgHold || 0) - Date.now()); if (b) setTimeout(() => run(g), b); else axGroup(F, A, g); }; // un sort signature en cours retient les actions suivantes
        gs.forEach((g, k) => (k ? setTimeout(() => run(g), k * gap) : run(g)));
      } else fresh.forEach((f) => {
        if (f.k === "cast") pulse(A.nodes[f.s], "act");
        else if (f.k === "hit") { const n = A.nodes[f.t]; if (n) { pulse(n, "hit"); floatAt(n, "-" + f.v, elVar(f.el)); burst(n, f.el || "n"); const e = F.ents[f.t]; if (e && (!e.alive || f.v > e.hpMax * 0.3)) pulse(A.el, "shake"); } }
        else if (f.k === "heal") { const n = A.nodes[f.t]; if (n) { floatAt(n, "+" + f.v, "#7ee06a"); burst(n, "h"); } }
        else if (f.k === "buff") { const n = A.nodes[f.t]; if (n && A.view !== "compact") floatAt(n, f.txt, "var(--gold2)", true); }
        else if (f.k === "phase") phaseFlash();
      });
    }
    if (F.log.length !== A.lastLog || force) {
      A.lastLog = F.log.length;
      $("#flog").innerHTML = F.log.slice(-7).reverse().map((l) => `<div class="${l.cls}">${h(l.txt)}</div>`).join("");
      const last = F.log[F.log.length - 1]; const t = $("#turn"); if (t) t.textContent = last ? last.txt : F.label;
    }
    if (F.over && !A.over) {
      A.over = true; axVictory(F, A); $("#fresult").innerHTML = `<span class="${F.result === "win" ? "" : "lose"}">${F.result === "win" ? "Victoire !" : "Défaite…"}</span>`;
      lootHtml(F); const fh = $("#fhist"); if (fh) fh.innerHTML = historyHtml(6);
    } else if (!F.over && force) { $("#floot").innerHTML = `<p class="note">Le butin apparaîtra à la fin du combat.</p>`; $("#fres").textContent = `Tour ${F.round}`; }
  } else if (force) { $("#flog").innerHTML = ""; $("#floot").innerHTML = `<p class="note">Aucun combat en cours.</p>`; }
  // barre de sorts du héros sélectionné
  const c = ui.combatCid ? char(ui.combatCid) : null;
  if (c) {
    const ent = F ? F.ents.find((e) => e.side === "c" && e.cid === c.id) : null;
    const bar = spellBarFor(c, ent, F); const sp = $("#spells");
    if (sp && sp.dataset.k !== bar.html) { sp.innerHTML = bar.html; sp.dataset.k = bar.html; $("#spnames").innerHTML = bar.names; const n = E.spellSlots(c); sp.style.gridTemplateColumns = $("#spnames").style.gridTemplateColumns = `repeat(${n},1fr)`; }
    const st = ent ? ent.st : E.charStats(S, c);
    let used = 0;
    if (F && ent) { const idx = F.ents.indexOf(ent); const casts = F.fx.filter((f) => f.k === "cast" && f.s === idx); const lastSeq = casts.length ? casts[casts.length - 1].seq : -1; casts.filter((f) => f.seq === lastSeq).forEach((f) => { const d = E.spellDef(c.cls, f.sp); if (d) used += E.spellGrade(d, c.lvl).pa; }); }
    const pips = $("#pips"); const ph = Array.from({ length: st.pa }, (_, i) => `<i class="${i < st.pa - used ? "" : "off"}"></i>`).join("");
    if (pips && pips.dataset.k !== ph) { pips.innerHTML = ph; pips.dataset.k = ph; }
    const sn = $("#stratName"); if (sn) sn.textContent = c.activePreset !== undefined && c.activePreset !== null && c.presets[c.activePreset] ? c.presets[c.activePreset].name : c.spellsManual ? "personnalisée" : "automatique";
  }
}
/* ---------- 3.2.2 : « Pourquoi j'ai perdu ? » ---------- */
function lossHtml(R) {
  const c = R.cid ? char(R.cid) : null; const stat = R.stat && STATS[R.stat];
  const gear = (R.gear || []).filter((g) => ITEMS[g.tpl] && (g.k !== "bag" || S.items[g.uid]));
  const GK = { bag: ["dans ton sac", "Équiper", (g) => `data-act="lossequip" data-uid="${g.uid}" data-id="${R.cid}"`], craft: ["à fabriquer", "Liste de courses", (g) => `data-act="shoppin" data-k="tpl" data-id="${g.tpl}"`], loot: ["à looter", "Voir", (g) => { const s = subOfMon(g.m); return typeof s === "string" ? `data-act="dgopen" data-id="${s}"` : s ? `data-act="zoneview" data-id="${s.id}" data-gotab="world"` : ""; }] };
  return `<div class="loss"><div class="ttl">${G("warn")} Défaite au tour ${R.round}</div><div class="advice">${h(R.txt)}</div>
    <div class="facts">${R.facts.map((f) => `<span class="pill ${f.k === "killer" ? "bad" : f.k === "streak" ? "gold" : ""}">${h(f.txt)}</span>`).join("")}</div>
    ${gear.length && c ? `<div class="sec">Équipement conseillé pour ${h(c.name)}${stat ? ` (${h(stat.name.replace("% ", ""))})` : ""}</div><div class="sugg">${gear.map((g) => { const T = ITEMS[g.tpl]; const [tag, btn, attrs] = GK[g.k]; const it = g.k === "bag" ? S.items[g.uid] : null; const miss = g.k === "craft" ? g.miss : null; const eta = miss && miss.length ? E.needEtaTxt(S, T.craft.ing) : null;
      return `<div class="sl">${it ? itemIcon(it) : `<span class="icobox ${rarCls(g.tpl)}">${im(itemImg(g.tpl), "", T.name)}</span>`}<div class="t"><b>${h(T.name)}</b> <span class="tag soft">${tag}</span><small>${stat ? `+${fmt(g.v)} ${h(stat.name.replace("% ", ""))}` : ""} · niv. ${T.lvl}${miss ? miss.length ? ` · manque ${miss.map(([r, q]) => `${q} ${h(r)}`).join(", ")}${eta ? ` (${h(eta)})` : ""}` : " · tout est réuni" : ""}${g.k === "loot" ? ` · ${h(MONSTERS[g.m].name)} · ${g.p} %` : ""}</small></div>${g.k === "craft" && S.shop.some((e) => e.id === g.tpl) ? `<span class="tag good">dans la liste</span>` : `<button class="btn sm" ${attrs(g)}>${btn}</button>`}</div>`; }).join("")}</div>` : ""}
 <div class="row">${R.place ? `<button class="btn sm primary" data-act="lossplace">Ouvrir le placement</button>` : ""}${c ? `<button class="btn sm" data-act="lossgo" data-id="${c.id}" data-v="${R.cause === "heal" || R.cause === "target" ? "spells" : R.cause === "dmg" && !gear.length ? "stats" : "equip"}">Ouvrir la fiche de ${h(c.name)}</button>` : ""}<button class="btn sm" data-act="worldtab" data-v="${R.did ? "dungeons" : "map"}" data-gotab="world">${R.did ? "Changer de donjon" : "Changer de zone"}</button></div></div>`;
}
function lossSheet(t) { const R = (S.losses || []).find((x) => x.t === +t); if (!R) return; openSheet(`<h2>${h(R.label)}</h2><div class="small">${lossHtml(R)}</div><div><button class="btn" data-act="closesheet">Fermer</button></div>`); }
function lootHtml(F) {
  const el = $("#floot"); if (!el) return;
  if (F.result !== "win" || !F.rewards) { el.innerHTML = F.loss ? lossHtml(F.loss) : `<p class="note">Défaite. L'équipe se relève et repart.</p>`; $("#fres").textContent = "Défaite"; return; }
  const r = F.rewards; const res = Object.entries(r.res);
  $("#fres").textContent = "Victoire";
  el.innerHTML = `<div class="stack" style="gap:8px">
    <div class="small">${Object.entries(r.xp).map(([cid, x]) => `${h(char(+cid)?.name || "")} <b class="num">+${fmt(x)} XP</b>`).join(" · ")} · <span class="coin"></span> <b class="num">+${fmt(r.kamas)}</b></div>
    ${res.length ? `<div class="loot">${res.map(([n, q]) => `<div class="lcard">${im(resImg(n), "ico sm", n)}<div class="n">${h(n)} <span class="muted num">×${q}</span></div></div>`).join("")}</div>` : `<p class="note">Aucune ressource.</p>`}
    ${(F.chals || []).length ? `<div class="chalres"><div class="h">${G("target")} Challenges</div>${F.chals.map((c) => `<div class="r ${c.ok ? "" : "ko"}"><span>${c.ok ? "✓" : "✕"} ${h(E.CHALLENGES[c.id].name)}</span><span>+${c.bonus} %</span></div>`).join("")}${S.chalStreak > 1 ? `<div class="r"><span>${G("flame")} Série ×${S.chalStreak}</span><span>+${Math.min(E.CHAL_STREAK_MAX, (S.chalStreak - 1) * E.CHAL_STREAK_STEP)} %</span></div>` : ""}<div class="r tot"><span>Bonus XP et butin</span><span>+${r.chal || 0} %</span></div></div>` : ""}
    ${r.idol ? `<div class="chalres idolres"><div class="h">${idolIco()} Idoles · score ${r.idol.score}</div><div class="row xs" style="gap:4px;flex-wrap:wrap">${r.idol.ids.map((id) => E.IDOLS[id] ? `<span class="pill">${im(idolImg(id), "iico", E.IDOLS[id].name)} ${h(E.IDOLS[id].name)} <b class="num">${E.IDOLS[id].score}</b></span>` : "").join("")}</div><div class="r tot"><span>Bonus XP et butin</span><span>+${pctTxt(r.idol.pct)} %</span></div></div>` : ""}
    ${r.champ ? `<div class="champwin"><div class="ttl">${G("crown")} Champion vaincu : ${h(r.champ.name)} (${h(E.CHAMP_POWERS[r.champ.power].name)})</div><div class="row xs"><span class="pill gold">XP ×3</span><span class="pill gold">Butin ×2</span>${r.champ.res ? `<span class="pill good">Ressource garantie : ${h(r.champ.res[0])} ×${r.champ.res[1]}</span>` : ""}<span class="pill gold">Chance de Rayonnant ×2</span></div><div class="xs muted">Champions vaincus : ${fmt(S.champs || 0)}${(() => { const n = [10, 100, 500, 1000].find((x) => x > (S.champs || 0)); return n ? ` · prochain succès à ${fmt(n)}` : ""; })()}</div></div>` : ""}
    ${r.stasis ? `<p class="small" style="color:var(--gold2);font-weight:700">⏳ Stasis ${r.stasis.k} : ${h(r.stasis.out.join(", "))}</p>` : ""}
    ${r.lootPen ? `<p class="note xs">Monstres bien plus faibles que votre meilleur héros : butin réduit (×${Math.round(r.lootPen * 100) / 100}).</p>` : ""}
    ${r.auto ? `<p class="note">${r.auto} objet${r.auto > 1 ? "s" : ""} traité${r.auto > 1 ? "s" : ""} par les règles automatiques.</p>` : ""}
    ${r.cons ? `<p class="small" style="color:var(--archi);font-weight:800">${IC("bonbon")} Bonbon Sagesse obtenu !</p>` : ""}
    ${r.items.length ? `<div class="list">${r.items.filter((u) => S.items[u]).map((u) => `<div class="li ${S.items[u].radiant ? "radiant" : ""}">${itemIcon(S.items[u])}<span class="grow">${itemName(S.items[u])}</span></div>`).join("")}</div>` : ""}</div>`;
}

/* ---------- objets ---------- */
const rar = (tpl) => E.RARITY[E.rarityOf(tpl)];
const rarCls = (tpl) => `rr r-${E.rarityOf(tpl)}`;
const rarTag = (tpl) => { const r = rar(tpl); return `<span class="rtag ${rarCls(tpl)}">${r.name}</span>`; };
(() => { const st = document.createElement("style"); st.textContent = E.RARITIES.map((r) => `.r-${r.id}{--rc:${r.color}}`).join(""); document.head.appendChild(st); })();
const itemIcon = (it) => `<span class="icobox ${rarCls(it.tpl)} ${it.radiant ? "radiant" : ""}">${im(itemImg(it.tpl), "", ITEMS[it.tpl].name)}</span>`;
function itemName(it) { return `<span class="iname ${rarCls(it.tpl)} ${it.radiant ? "radiant" : ""}">${h(ITEMS[it.tpl].name)}</span>${it.exo ? ` <span class="tag exo" title="Forgemagie exotique : +1 ${STATS[it.exo].name}">Exo ${STATS[it.exo].short}</span>` : ""}${E.isPerfect(it) ? ` <span class="tag perfect" title="Parfait : toutes les caractéristiques au jet maximum, +${E.PERFECT_PCT} %">★ Parfait</span>` : ""}${it.radiant ? ` <span class="tag" style="background:linear-gradient(90deg,#ffb347,#ff5fbf,#8a7dff);color:#fff">✦ +${it.radiant} %</span>` : ""}${it.locked ? ` <span title="Protégé">${G("lock")}</span>` : ""}`; }
function itemStatsHtml(it) {
  const T = ITEMS[it.tpl];
  return (T.desc ? `<span class="statl">${G("sparkle")}<span>${h(T.desc)}</span></span>` : "") + Object.keys(T.stats).map((k) => { const [a, b] = T.stats[k]; const v = it.stats[k]; const base = it.roll ? it.roll[k] : v;
    return `<span class="statl"${tipAttr(k)}>${sIco(k)}<span${base === b && a !== b ? ' style="color:var(--gold);font-weight:800"' : ""}>${statLine(k, v)}</span>${it.radiant && v !== base ? `<span class="bonus">(+${v - base})</span>` : ""} <span class="muted xs">${a === b ? "" : `(${a} à ${b})`}</span></span>`; }).join("") + (it.exo ? `<span class="statl"${tipAttr(it.exo)}>${sIco(it.exo)}<span class="bonus">+1 ${STATS[it.exo].name}</span> <span class="muted xs">(exo)</span></span>` : "");
}
function tplStatsHtml(T) { return (T.desc ? `<span class="statl">${G("sparkle")}${h(T.desc)}</span>` : "") + Object.entries(T.stats).map(([k, [a, b]]) => `<span class="statl"${tipAttr(k)}>${sIco(k)}${a === b ? a : a + " à " + b} ${STATS[k].name.replace("% ", "")}</span>`).join(""); }
function deltaHtml(c, slot, uid) {
  const cur = E.charStats(S, c); const saved = Object.assign({}, c.equip); let nw;
  if (uid) {
    const other = E.equippedBy(S, uid); const otherSaved = other && other !== c ? Object.assign({}, other.equip) : null;
    if (otherSaved) for (const k in other.equip) if (other.equip[k] === uid) delete other.equip[k];
    for (const k in c.equip) if (c.equip[k] === uid) delete c.equip[k];
    c.equip[slot] = uid; nw = E.charStats(S, c);
    if (otherSaved) other.equip = otherSaved;
  } else { delete c.equip[slot]; nw = E.charStats(S, c); }
  c.equip = saved;
  const keys = STAT_ORDER.concat(["hpMax"]).filter((k) => k !== "ini" && (nw[k] || 0) !== (cur[k] || 0));
  if (!keys.length) return `<span class="muted xs">Aucun changement</span>`;
  return keys.map((k) => { const d = Math.round(nw[k] - cur[k]); const n = k === "hpMax" ? "PV" : STATS[k].short; return `<span class="${d > 0 ? "plus" : "minus"} xs num">${d > 0 ? "+" : ""}${d} ${n}</span>`; }).join(" ");
}

/* ---------- HÉROS ---------- */
/* 3.2.2 : temps estimé avant le niveau suivant, au survol de la barre d'XP */
const lvlGoal = (c) => Math.min(E.MAX_LVL, (Math.floor(c.lvl / 10) + 1) * 10);
function xpTipTxt(c) {
  if (c.lvl >= E.MAX_LVL) return "Niveau maximum.";
  if (c.job) return "En récolte : pas d'XP de combat pour l'instant.";
  if (!c.inTeam) return "Hors équipe : pas d'XP pour l'instant.";
  if (!S.hunting && !S.dungeon) return "À l'arrêt : lancez une chasse pour gagner de l'XP.";
  const xpH = E.heroXpH(S, c); if (!xpH) return "Estimation disponible après quelques combats dans cette zone.";
  const eta = E.lvlEta(S, c, c.lvl + 1); const g = lvlGoal(c); const eg = g > c.lvl + 1 ? E.lvlEta(S, c, g) : null;
  return `Niveau ${c.lvl + 1} dans ${E.etaTxt(eta)}${eg !== null ? ` · niveau ${g} dans ${E.etaTxt(eg)}` : ""} · ≈ ${fmt(xpH)} XP/h ici. L'estimation suit le rythme réel et bouge si vous changez de zone.`;
}
/* ---------- 0.1.9.1 : page Équipe (tableau de bord des héros + plateau « Réorganiser ») ---------- */
let alertCache = { t: 0, v: [] };
/* ce qui attend chaque héros : points à répartir (répartition manuelle), meilleur objet libre, familier affamé */
function teamAlerts(force) {
  if (!S) return [];
  if (!force && Date.now() - alertCache.t < 2000) return alertCache.v;
  const v = [];
  S.chars.forEach((c) => {
    if (!c.autoStat && c.pts > 0) v.push({ c, k: "pts", t: `${c.pts} point${c.pts > 1 ? "s" : ""} à répartir` });
    if (c.inTeam && !c.job && EQ_SLOTS.some((s) => slotUpgrade(c, s))) v.push({ c, k: "gear", t: "Meilleur équipement dispo" });
    const P = E.petOf && E.petOf(S, c); if (P && P.hungry) v.push({ c, k: "pet", t: "Familier affamé" });
  });
  alertCache = { t: Date.now(), v }; return v;
}
const teamZone = (c) => (c.job ? "job" : E.trainee(S) === c ? "train" : E.atelierHero(S) === c ? "atelier" : !c.inTeam ? "rest" : E.frontSet(S).has(c.id) ? "f" : "b");
const TZ = { f: ["Première ligne", "reçoit 3 coups sur 4"], b: ["Arrière", "exposé si la première ligne tombe"], job: ["Récolte", "hors de l'équipe"], train: ["Salle d'entraînement", `${Math.round(E.TRAIN_SHARE * 100)} % de l'XP de l'équipe`], rest: ["Repos", "hors de l'équipe"] };
function actPill(c) {
  const z = teamZone(c);
  if (z === "job") return `<span class="tpill job">${IC("pioche")} Récolte · ${h(c.job.res)}</span>`;
  if (z === "train") return `<span class="tpill train">${IC("havre")} Salle d'entraînement</span>`;
  if (z === "atelier") return `<span class="tpill train">${IC("metiers")} À l'atelier</span>`;
  if (z === "rest") return `<span class="tpill rest">Au repos</span>`;
  return `<span class="tpill hunt">${IC("combat")} ${S.dungeon ? "Donjon" : "Chasse"} · ${z === "f" ? "première ligne" : "arrière"}</span>`;
}
function teamCard(c, al) {
  const C = CLASSES[c.cls]; const need = E.xpNeed(c.lvl); const M = E.mountOf && E.mountOf(S, c); const z = teamZone(c);
  const mt = M ? `<span class="tmount">${im(mountImg(M.sp, M.c), "tmimg")}<span>${h(E.mountName(M))} · ${M.lvl}</span>${M.lvl < E.MOUNT_MAX ? `<span class="xpb"><i style="width:${pct(M.xp, E.mountXpNeed(M.sp, M.lvl))}%"></i></span>` : ""}</span>` : `<span class="tmount muted">Pas de monture</span>`;
  const inT = c.inTeam && !c.job;
  return `<div class="tcard ${inT ? "" : "out"}" style="--cc:${C.color}">
    <button class="tart" data-act="teamgo" data-id="${c.id}" data-v="equip" title="Ouvrir la fiche de ${h(c.name)}">${lookImg(c, "tlook")}</button>
    <div class="tmain">
      <div class="thead"><button class="tstar ${mainHero() === c ? "on" : ""}" data-act="setmain" data-id="${c.id}" title="Héros principal" aria-label="Faire de ${h(c.name)} le héros principal">★</button><span class="tnm"><b class="${c.ren ? "rname" : ""}">${h(c.name)}${c.ren ? ` <span class="renm inline">${E.roman(c.ren)}</span>` : ""}</b><span class="xs muted">${C.name}${c.ren ? ` · Renaissance ${E.roman(c.ren)}` : ""}</span></span><span class="tlv">${c.lvl}</span></div>
      <div class="xpb"><i style="width:${pct(c.xp, need)}%"></i></div>
      <div class="tal">${actPill(c)}${al.map((a) => `<button class="talert" data-act="teamfix" data-id="${c.id}" data-v="${a.k}">● ${h(a.t)}</button>`).join("")}${al.length ? "" : `<span class="talert ok">Rien à faire</span>`}</div>
      ${mt}
    </div>
    <div class="tact">${z === "atelier" ? `<button class="btn sm" data-act="teamgo" data-id="${c.id}" data-v="havre">Voir l'atelier</button>` : `<button class="btn sm" data-act="teammove" data-id="${c.id}" data-v="${inT ? "rest" : "b"}">${inT ? "Retirer de l'équipe" : "Mettre en équipe"}</button>`}<button class="btn sm" data-act="teamgo" data-id="${c.id}" data-v="equip">Fiche</button></div>
  </div>`;
}
function teamBoardHtml() {
  const zone = (z) => { const list = S.chars.filter((c) => (z === "rest" ? ["rest", "atelier"].includes(teamZone(c)) : teamZone(c) === z));
    const n = z === "f" ? `${list.length} / ${E.frontMax(E.team(S).length)}` : z === "b" ? `${list.length}` : z === "train" ? `${list.length} / 1` : `${list.length}`;
    const sel = ui.teamSel != null ? char(ui.teamSel) : null; const tgt = sel && teamZone(sel) !== z;
    return `<div class="tzone ${tgt ? "target" : ""}" data-act="teamdrop" data-v="${z}" data-zone="${z}"><div class="tzt"><b>${TZ[z][0]}</b><span class="xs muted">${TZ[z][1]} · ${n}</span></div><div class="tslots">${list.map((c) => { const at = teamZone(c) === "atelier";
      return `<button class="ttok ${ui.teamSel === c.id ? "sel" : ""}" ${at ? `disabled title="Travaille à l'atelier du Havre-Sac"` : `draggable="true" data-act="teamsel" data-id="${c.id}" data-tok="${c.id}"`}>${head(c)}<span><b class="${c.ren ? "rname" : ""}">${h(c.name)}${c.ren ? ` <span class="renm inline sm">${E.roman(c.ren)}</span>` : ""} <span class="tlv">${c.lvl}</span></b><span class="xs muted">${h(CLASSES[c.cls].name)}${at ? " · atelier" : ""}</span></span></button>`; }).join("") || `<span class="tempty">${canHover ? "Glissez un héros ici" : "vide"}</span>`}</div></div>`; };
  return `<div class="tboard"><p class="note xs" style="margin:0">${canHover ? "Glissez un héros d'une zone à l'autre, ou cliquez sur lui puis sur une zone." : "Touchez un héros, puis la zone où l'envoyer."}${ui.teamSel != null && char(ui.teamSel) ? ` <b>${h(char(ui.teamSel).name)}</b> est choisi.` : ""} Pour la récolte, le jeu vous demande la ressource.</p>
    <div class="tcols"><div class="tcol">${zone("f")}${zone("b")}</div><div class="tcol">${zone("job")}${zone("train")}${zone("rest")}</div></div></div>`;
}
/* envoie un héros dans une zone du plateau ; renvoie un message d'erreur ou null */
function teamMove(cid, z) {
  const c = char(cid); if (!c) return "Héros introuvable.";
  const from = teamZone(c); if (from === z) return null;
  if (from === "atelier") return `${c.name} travaille à l'atelier : rappelez-le depuis le Havre-Sac.`;
  if (S.dungeon && (["f", "b"].includes(from) !== ["f", "b"].includes(z))) return "Impossible de changer l'équipe en donjon.";
  if (z === "job") { ui.gs = { cid: c.id, job: c.job ? c.job.job : null }; gatherSheet(); return null; }
  if (["f", "b"].includes(z)) {
    if (!["f", "b"].includes(from)) {
      if (E.team(S).length >= 8) return "8 héros au plus dans l'équipe.";
      if (from === "train") E.setTraining(S, null);
      if (from === "job") { const r = E.setJob(S, c.id, null); if (r) return r; }
      if (!c.inTeam) { const r = E.toggleTeam(S, c.id); if (r) return r; }
      const r = E.setRow(S, c.id, z); return r && z === "f" ? null : r;
    }
    return E.setRow(S, c.id, z);
  }
  /* repos ou salle d'entraînement : le héros quitte l'équipe ou la récolte */
  if (["f", "b"].includes(from)) { if (from === "f" && E.frontSet(S).size <= 1 && E.team(S).length > 1) return "Il faut au moins un héros en première ligne."; const r = E.toggleTeam(S, c.id); if (r) return r; }
  if (from === "job") { const r = E.setJob(S, c.id, null); if (r) return r; if (c.inTeam) { const r2 = E.toggleTeam(S, c.id); if (r2) return r2; } }
  if (from === "train" && z === "rest") return E.setTraining(S, null);
  if (z === "train") return E.setTraining(S, c.id);
  return null;
}
/* 0.1.10.1 : compositions d'équipe enregistrées (jusqu'à 3) */
const FOCUS_N = { auto: "dangereux d'abord", low: "le plus faible", boss: "le boss" };
function compsHtml() {
  const K = S.comps || []; const cur = E.compMatch(S);
  const cards = K.map((k, i) => { const hs = k.ids.map((id) => char(id)).filter(Boolean); const on = i === cur;
    const f = hs.filter((c) => k.rows[c.id] === "f").length;
    return `<div class="compcard ${on ? "on" : ""}"><div class="row" style="gap:6px"><input class="compname" data-act="compname" data-i="${i}" value="${h(k.name)}" maxlength="24" aria-label="Nom de la composition">${on ? `<span class="tag good">active</span>` : ""}</div>
      <div class="row comph">${hs.map((c) => head(c)).join("")}</div>
      <div class="xs muted">${hs.length} héros · ${k.auto ? "placement automatique" : `${f} devant, ${hs.length - f} derrière`} · cible : ${FOCUS_N[k.focus] || FOCUS_N.auto}</div>
      <div class="row" style="gap:6px"><button class="btn sm ${on ? "" : "primary"}" data-act="compuse" data-i="${i}" ${on || S.dungeon ? "disabled" : ""}>Utiliser</button><button class="btn sm" data-act="compsave" data-i="${i}" data-tip="Remplacer par l'équipe actuelle (héros, rangées et cible)">Mettre à jour</button><button class="btn sm" data-act="compdel" data-i="${i}" title="Supprimer">✕</button></div></div>`; }).join("");
  const add = K.length < E.COMP_MAX ? `<button class="compcard add" data-act="compsave" data-i="-1">+ Enregistrer l'équipe actuelle<span class="xs muted">héros, rangées et cible prioritaire</span></button>` : "";
  return `<section class="comps"><div class="row between"><h3 class="sec" style="margin:0">Compositions</h3><span class="xs muted">${K.length}/${E.COMP_MAX} · un clic pour changer d'équipe</span></div><div class="compgrid">${cards}${add}</div></section>`;
}
function renderTeam() {
  const al = teamAlerts(true); const team = E.team(S); const board = !!ui.teamBoard;
  const by = (z) => S.chars.filter((c) => teamZone(c) === z).length; const fs = E.frontSet(S);
  const gearN = al.filter((a) => a.k === "gear").length;
  $("#main").innerHTML = `<div class="pagehead"><h1>Équipe</h1><span class="small muted">${team.length} / 8 dans l'équipe</span><span class="grow"></span>
    ${board ? "" : gearN ? `<button class="btn sm" data-act="teamequipall">Tout équiper au mieux (${gearN})</button>` : ""}
    <button class="btn sm reorg ${board ? "primary" : ""}" data-act="teamboard">${board ? "✓ Terminé" : `${G("swap")} Réorganiser`}</button></div>
  <section class="tsum"><div class="k"><b class="num">${team.length} / 8</b><span>en équipe</span></div><div class="k"><b class="num">${team.length ? Math.round(team.reduce((a, c) => a + c.lvl, 0) / team.length) : "–"}</b><span>niveau moyen</span></div>
    <div class="k"><b class="num">${team.filter((c) => fs.has(c.id)).length} · ${team.filter((c) => !fs.has(c.id)).length}</b><span>devant · derrière</span></div><div class="k"><b class="num">${by("job")}</b><span>en récolte</span></div><div class="k"><b class="num">${by("train")}</b><span>à l'entraînement</span></div>
    <div class="k"><b class="num">${S.idols.active.length} / ${E.IDOL_MAX}</b><span>idoles actives</span></div>${idolBtn(null)}
<div class="k"><b class="num">${E.soulCount(S)} / ${E.ARCHI_TOTAL}</b><span>âmes capturées</span></div>${archiBtn()}
    ${S.chars.length < 8 ? `<span class="grow"></span><button class="btn sm" data-act="recruitsheet">+ Recruter</button>` : ""}</section>
  ${board ? "" : compsHtml()}
  ${board ? teamBoardHtml() : `<section class="tgrid">${S.chars.map((c) => teamCard(c, al.filter((a) => a.c === c))).join("")}</section>`}`;
}
function renderHeroes() {
  if (!ui.cid || !char(ui.cid)) ui.cid = S.chars[0].id;
  const c = char(ui.cid); const st = E.charStats(S, c); const need = E.xpNeed(c.lvl); const nextCost = E.recruitCost(S.chars.length + 1); const C = CLASSES[c.cls];
  $("#main").innerHTML = `
  <div class="pagehead"><h1>Héros</h1><span class="small muted">${E.team(S).length} dans l'équipe · Esprit Libre +${E.freeSpirit(S)} %</span></div>
  <section class="chips">${S.chars.map((x) => `<button class="${x.inTeam ? "" : "out"}" data-act="selchar" data-id="${x.id}" aria-pressed="${x.id === c.id}">${head(x)}<span class="${x.ren ? "rname" : ""}">${h(x.name)}${x.ren ? ` <span class="renm inline sm">${E.roman(x.ren)}</span>` : ""} <span class="muted xs num">niv. ${x.lvl}</span></span></button>`).join("")}
    ${S.chars.length < 8 ? `<button data-act="recruitsheet"><span class="head" style="--cc:var(--panel3)">+</span><span>Recruter <span class="muted xs num">${nextCost ? fmt(nextCost) + " k" : "gratuit"}</span></span></button>` : ""}</section>
  ${placementHtml()}
  <section class="panel" style="margin-bottom:12px"><div class="pad row" style="gap:18px;align-items:flex-start">
    <div style="padding:14px 0 10px">${heroCard(c, "big", { act: "noop" })}</div>
    <div class="grow stack" style="min-width:240px">
      <div><h2 style="font-size:24px">${h(c.name)}</h2><div class="small muted">${C.name} · niveau ${c.lvl} · cadre ${E.FRAMES[E.frameIdx(c.lvl)]}${c.lvl < 200 ? ` (prochain au niveau ${Math.min(200, (Math.floor(c.lvl / 20) + 1) * 20)})` : ""}${c.ren ? ` · <b>Renaissance ${E.roman(c.ren)}</b>` : ""}</div></div>
      ${c.lvl >= E.MAX_LVL && (c.ren || 0) < E.REN_MAX ? `<div class="row small"><button class="btn sm ren" data-act="rensheet" data-id="${c.id}">${IC("phenix")} Renaître</button><span class="muted">Repartir au niveau 1 avec un Éveil et +${Math.round(E.REN_XP * 100)} % d'XP</span></div>` : ""}
      ${c.ren ? `<div class="small renev"><span class="tag ren">Éveils</span> ${E.eveilList(c).map(([id, r]) => `<span class="evpill" data-tip="${h(E.eveilDesc(c, id))}">${h(id === "classe" ? "Éveil de classe" : E.EVEILS[id].name)} ${E.roman(r)}</span>`).join(" ")} <span class="muted">· +${Math.round(E.REN_XP * 100 * c.ren)} % d'XP</span></div>` : ""}
      <div><div class="row between small"><span class="muted">Expérience</span><span class="num muted">${c.lvl >= E.MAX_LVL ? "Niveau maximum" : `${fmt(c.xp)} / ${fmt(need)}`}</span></div><div class="xpwrap" data-act="xptip" data-tip="${h(xpTipTxt(c))}"><div class="bar xp"><i style="width:${pct(c.xp, need)}%"></i></div></div>${ui.xpTip === c.id ? `<div class="xs muted xptip">${h(xpTipTxt(c))}</div>` : ""}</div>
      <div class="small" data-tip="${h(C.passive.desc)}"><span class="tag soft">Passif</span> <b>${h(C.passive.name)}</b> : ${h(C.passive.desc)}${(() => { const tm = E.team(S); const first = tm.find((x) => x.cls === c.cls); return c.inTeam && !c.job && first && first.id !== c.id ? ` <span class="tag warn">déjà actif via ${h(first.name)}</span>` : ""; })()}</div>
      <div class="row small"><span class="muted">Activité :</span>${c.job ? `<span class="tag good">${IC("pioche")} ${h(D.GATHER_JOBS[c.job.job].name)} · ${h(c.job.res)}</span><button class="btn sm" data-act="unjob" data-id="${c.id}">Rappeler pour chasser</button>` : `<span class="tag soft">${c.inTeam ? "Chasse (dans l'équipe)" : restLabel(c)}</span><button class="btn sm" data-act="toggleteam" data-id="${c.id}">${c.inTeam ? "Retirer de l'équipe" : "Ajouter à l'équipe"}</button><button class="btn sm" data-act="gathersheet" data-cid="${c.id}">${IC("pioche")} Envoyer récolter</button>`}<button class="btn sm" data-act="looksheet" data-id="${c.id}">${IC("teinture")} Apparence</button><button class="btn sm" data-act="buildsheet" data-id="${c.id}">${G("share")} Partager le build</button>${c.lvl < E.MAX_LVL ? pinBtn({ k: "lvl", cid: c.id, n: lvlGoal(c) }, `Suivre le niveau ${lvlGoal(c)}`) : ""}</div>
      <div class="row small"><label class="row">Titre <select data-act="settitle" data-id="${c.id}"><option value="">Aucun</option>${E.titles(S).map((t) => `<option ${c.title === t ? "selected" : ""}>${h(t)}</option>`).join("")}</select></label>
        ${c.orn === "ailes" && ["or", "argent", "sombre"].some((w) => S.unlocks["wing_" + w]) ? `<label class="row">Ailes <select data-act="setwing" data-id="${c.id}"><option value="">Classiques</option>${["or", "argent", "sombre"].filter((w) => S.unlocks["wing_" + w]).map((w) => `<option value="${w}" ${c.wing === w ? "selected" : ""}>${{ or: "Dorées", argent: "Argentées", sombre: "Sombres" }[w]}</option>`).join("")}</select></label>` : ""}
        <label class="row">Ornement <select data-act="setorn" data-id="${c.id}"><option value="">Aucun</option>${Object.keys(E.ORN).map((o) => `<option value="${o}" ${c.orn === o ? "selected" : ""} ${E.ornUnlocked(S, o) ? "" : "disabled"}>${h(E.ORN[o].name(S))}${E.ornUnlocked(S, o) ? "" : " 🔒"}</option>`).join("")}</select></label></div>
      ${E.titles(S).length ? "" : `<p class="note xs" style="margin:0">Les titres et ornements se débloquent avec les succès (onglet Quêtes).</p>`}
    </div>
  </div></section>
  <nav class="subtabs">${[["equip", "Équipement"], ["pet", "Familier & monture"], ["stats", "Caractéristiques"], ["spells", "Sorts & stratégies"]].map(([id, n]) => `<button data-act="herotab" data-v="${id}" aria-pressed="${ui.hero === id}">${n}${id === "stats" && !c.autoStat && c.pts > 0 ? ` <span class="ptsbadge" title="Points à répartir">${c.pts}</span>` : ""}</button>`).join("")}</nav>
  <section>${ui.hero === "stats" ? charStatsView(c, st) : ui.hero === "equip" ? charEquipView(c, st) : ui.hero === "pet" ? charPetView(c, st) : charSpellsView(c)}</section>`;
}
/* 3.3.0 : placement de l'équipe (première ligne / arrière) */
function placementHtml() {
  const team = E.team(S); if (team.length < 2) return "";
  const fs = E.frontSet(S); const max = E.frontMax(team.length); const auto = E.isAutoPlace(S);
  const card = (c, f) => { const st = E.charStats(S, c);
    return `<div class="pcard">${head(c)}<div class="tx"><b>${h(c.name)} <span class="muted xs">${h(CLASSES[c.cls].name)} niv. ${c.lvl}</span></b><span class="xs muted num">${fmt(st.hpMax)} PV · Rés. moy. ${Math.round(E.avgRes(st))} %</span></div><button class="btn sm" data-act="setrow" data-id="${c.id}" data-v="${f ? "b" : "f"}">${f ? "↓ Arrière" : "↑ Première ligne"}</button></div>`; };
  const L = (f) => team.filter((c) => fs.has(c.id) === f).map((c) => card(c, f)).join("");
  return `<section class="panel placement${ui.placeFlash ? " flash" : ""}" id="placement" style="margin-bottom:12px"><div class="pad stack" style="gap:10px">
    <div class="row between"><h3 style="margin:0">Placement de l'équipe</h3><span class="xs muted">Première ligne : 1 à ${max} héros sur ${team.length}</span></div>
    <div class="row between"><label class="row small"><input type="checkbox" data-act="placeauto" ${auto ? "checked" : ""}> <b>Placement automatique</b></label>${auto ? "" : `<button class="btn sm" data-act="placeautob">Revenir au placement automatique</button>`}</div>
    <div class="plines"><div class="pline front"><div class="lt">${G("shield")} Première ligne <span class="xs muted">reçoit 3 coups sur 4</span></div>${L(true)}</div>
      <div class="pline"><div class="lt">Arrière <span class="xs muted">exposé si la première ligne tombe</span></div>${L(false)}</div></div>
    <p class="note xs" style="margin:0">En automatique, le jeu place devant les héros qui encaissent le mieux (PV et résistances). Les Rôdeurs visent l'arrière et les Bondisseurs ignorent les rangées.</p>
  </div></section>`;
}
function statCell(k, v) { return `<div class="s"${tipAttr(k)}><span>${sIco(k)}${k === "hpMax" ? "Points de vie" : STATS[k].name.replace("% ", "")}</span><b>${k === "hpMax" ? fmt(v) : fmtStatVal(k, v)}</b></div>`; }
const DOLL_L = ["coiffe", "amulette", "anneau1", "anneau2"], DOLL_R = ["cape", "ceinture", "bottes", "bouclier"];
const SCORE_W = { vit: 0.25, sa: 0.6, fo: 1, ine: 1, cha: 1, age: 1, pui: 1.2, do: 5, cri: 4, so: 3, pp: 0.6, ini: 0.05, pa: 60, rt: 3, rf: 3, re: 3, ra: 3, rn: 3, dcri: 2.5, dsort: 7, dt: 4, df: 4, de: 4, da: 4, dn: 1, xt: 2, xf: 2, xe: 2, xa: 2, xn: 2 };
const buildMain = (c) => (["fo", "ine", "cha", "age"].includes(c.autoStat) ? c.autoStat : CLASSES[c.cls].main);
function itemScore(c, it) { if (!it) return 0; const main = buildMain(c); const mdmg = ELEMENTS[STATS[main].el].dmg; let sc = 0;
  for (const k in it.stats) sc += it.stats[k] * (SCORE_W[k] || 1) * (["fo", "ine", "cha", "age"].includes(k) ? (k === main ? 1.4 : 0.5) : ["dt", "df", "de", "da"].includes(k) ? (k === mdmg ? 1 : 0.2) : 1);
  if (c.autoStat === "vit") sc += (it.stats.vit || 0) * 0.5; return sc; }
/* meilleur objet libre (porté par personne) pour un emplacement, s'il fait nettement mieux que l'actuel */
function bestFor(c, s) {
  const want = s.startsWith("anneau") ? "anneau" : s.startsWith("dofus") ? "dofus" : s;
  const cur = S.items[c.equip[s]]; const curSc = itemScore(c, cur); let best = 0, uid = null;
  for (const it of Object.values(S.items)) { const T = ITEMS[it.tpl]; if (T.slot !== want || T.lvl > c.lvl || E.equippedBy(S, it.uid)) continue; if ((want === "anneau" || want === "dofus") && Object.entries(c.equip).some(([sl, u]) => sl !== s && S.items[u] && S.items[u].tpl === it.tpl)) continue; const sc = itemScore(c, it); if (sc > curSc * 1.05 + 1 && sc > best) { best = sc; uid = it.uid; } }
  return uid;
}
const slotUpgrade = (c, s) => !!bestFor(c, s);
const EQ_SLOTS = ["arme", "coiffe", "cape", "amulette", "anneau1", "anneau2", "ceinture", "bottes", "bouclier", ...D.DOFUS_SLOTS];
function equipBest(c) { let n = 0; for (const s of EQ_SLOTS) { const u = bestFor(c, s); if (u && !E.equip(S, c.id, u, s)) n++; } return n; }
function dollSlot(c, s) {
  const it = S.items[c.equip[s]]; const T = it && ITEMS[it.tpl];
  const hl = ui.hlSlot && (ui.hlSlot === s || (ui.hlSlot === "anneau" && s.startsWith("anneau")) || (ui.hlSlot === "dofus" && s.startsWith("dofus")));
  return `<button class="dslot ${it ? "filled " + rarCls(it.tpl) : ""} ${it && it.radiant ? "radiant" : ""} ${ui.slot === s ? "on" : ""} ${hl ? "hl" : !it || ui.slot !== s ? (slotUpgrade(c, s) ? "up" : "") : ""}" data-act="slot" data-slot="${s}" ${it ? `data-tipitem="${it.uid}"` : `data-tip="${h(SLOTS[s])} : vide"`}>
    ${it ? im(itemImg(it.tpl), "", T.name) : `<span class="dlabel">${h(SLOTS[s].split(" ")[0])}</span>`}</button>`;
}
/* Panoplie : paliers de bonus, ceux actifs en vert */
function setBlock(setId, worn) {
  const Z = SETS[setId]; if (!Z) return "";
  const tiers = Object.entries(Z.bonus).sort((a, b) => +a[0] - +b[0]);
  return `<div class="setbox"><b>${h(Z.name)}</b> <span class="muted">${worn !== undefined ? `${worn}/${Z.size || "?"} portée${worn > 1 ? "s" : ""}` : `${Z.size || "?"} pièces`}</span>
    ${tiers.map(([n, b]) => `<div class="st ${worn !== undefined && worn >= +n ? "on" : ""}"><b>${n} pièces</b><span>${Object.entries(b).map(([k, v]) => statLine(k, v)).join(", ")}</span></div>`).join("") || `<div class="muted">Aucun bonus.</div>`}</div>`;
}
function charStatsView(c, st) {
  const sc = c.scrolls || {};
  const costTxt = (k) => { const cur = c.alloc[k]; const cost = E.pointCost(k, cur); return k === "sa" ? "3 points = 1" : k === "vit" ? "1 point = 1" : `${cost} point${cost > 1 ? "s" : ""} = 1${cur >= 100 ? ` (palier ${Math.floor(cur / 100) * 100})` : ""}`; };
  const scrollsOwned = (k) => (S.cons["parch_" + k + "_p"] || 0) + (S.cons["parch_" + k + "_g"] || 0);
  const dust = S.res[E.POUSSIERE] || 0; const manual = !c.autoStat;
  return `<div class="grid2">
    <div class="panel"><div class="phead"><h2>Points à répartir</h2><b class="num ptsleft ${manual && c.pts ? "on" : ""}" style="font-size:20px">${c.pts}</b></div>
      <div class="pad stack" style="padding-bottom:6px">
        <div class="row small"><span class="muted">Répartition :</span><span class="seg">${[[1, "Automatique"], [0, "Manuelle"]].map(([v, n]) => `<button data-act="allocmode" data-id="${c.id}" data-v="${v}" aria-pressed="${!manual === !!v}">${n}</button>`).join("")}</span></div>
        ${manual ? `<p class="note xs" style="margin:0">Mode manuel : les 5 points gagnés à chaque niveau vous attendent ici. Les boutons − rendent les points, sans frais.</p>`
          : `<label class="row small"><span class="muted">Caractéristique :</span>
          <select data-act="autostat" data-id="${c.id}">${BASE_STATS.map((k) => `<option value="${k}" ${c.autoStat === k ? "selected" : ""}>${STATS[k].name}</option>`).join("")}</select></label>`}
        ${c.autoStat && E.ELEM_STATS.includes(c.autoStat) ? `<label class="row small"><span class="muted">jusqu'à</span><select data-act="autocap" data-id="${c.id}">${E.AUTO_CAPS.map((v) => `<option value="${v}" ${(c.autoCap || 200) === v ? "selected" : ""}>${v >= 9999 ? "sans limite" : v}</option>`).join("")}</select><span class="muted">puis</span>
          <select data-act="autothen" data-id="${c.id}">${["vit", "sa", ...E.ELEM_STATS.filter((k) => k !== c.autoStat)].map((k) => `<option value="${k}" ${(c.autoThen || "vit") === k ? "selected" : ""}>${STATS[k].name}</option>`).join("")}</select></label>` : ""}
      </div>
      <div class="list">${BASE_STATS.map((k) => `<div class="li"${tipAttr(k)}>${sIco(k)}<span class="grow"><span class="name">${STATS[k].name}</span> <span class="muted xs">${costTxt(k)}</span>
          <div class="scrollbar" title="Parchemins"><i style="width:${(sc[k] || 0)}%"></i></div><span class="xs muted">${IC("quetes")} ${sc[k] || 0}/${E.SCROLL_MAX}${scrollsOwned(k) ? ` · <a href="#" data-act="usescroll" data-k="${k}">${scrollsOwned(k)} à utiliser</a>` : ""}${dust && E.scrollRoom(c, k) > 0 ? (() => { const cc = E.scrollCraftCost(S, k); return ` · <a href="#" data-act="craftscroll" data-k="${k}" title="Fabriquer un Petit parchemin (+1) avec de la poussière de stasis">Fabriquer (${cc.dust} ✨ · ${fmt(cc.kamas)} k)</a>`; })() : ""}</span></span>
          <span class="num" style="min-width:58px;text-align:right">${fmt(c.alloc[k])}${sc[k] ? `<span class="xs" style="color:var(--gold2)"> +${sc[k]}</span>` : ""}</span>
          <span class="allocbtns">${manual ? `<button class="btn sm" data-act="dealloc" data-k="${k}" data-n="10" ${c.alloc[k] ? "" : "disabled"} aria-label="Retirer 10 en ${STATS[k].name}">−10</button><button class="btn sm" data-act="dealloc" data-k="${k}" data-n="1" ${c.alloc[k] ? "" : "disabled"} aria-label="Retirer 1 en ${STATS[k].name}">−1</button>` : ""}<button class="btn sm" data-act="alloc" data-k="${k}" data-n="1" ${c.pts < E.pointCost(k, c.alloc[k]) ? "disabled" : ""} aria-label="Ajouter 1 en ${STATS[k].name}">+1</button><button class="btn sm" data-act="alloc" data-k="${k}" data-n="10" ${c.pts < E.pointCost(k, c.alloc[k]) ? "disabled" : ""} aria-label="Ajouter 10 en ${STATS[k].name}">+10</button></span></div>`).join("")}</div>
      <div class="pad stack" style="padding-top:6px">
        <p class="note xs">Au-delà de 100 dans une caractéristique d'élément, il faut 2 points pour gagner 1, puis 3 au-delà de 200 et 4 au-delà de 300. La Vitalité reste à 1 pour 1. Les parchemins s'ajoutent hors paliers.</p>
        <div><button class="btn sm" data-act="resetpts" data-id="${c.id}">Réinitialiser les points (gratuit)</button></div></div></div>
    <div class="panel"><div class="phead"><h2>Statistiques totales</h2><span class="xs muted">survolez ou touchez une stat pour son effet</span></div><div class="pad stack">
      <div class="statgrid num">${statCell("hpMax", st.hpMax)}${STAT_ORDER.map((k) => statCell(k, st[k])).join("")}${D.TACT_ORDER.filter((k) => st[k]).map((k) => statCell(k, k === "pm" ? 3 + st[k] : st[k])).join("")}</div>
      <p class="note">${Object.keys(S.families || {}).length ? `Familles complétées : +${E.familyBonusVit(S)} PV.` : ""}</p></div></div></div>`;
}
/* ---------- 0.1.8 : familiers et montiliers ---------- */
const petImg = (id) => (E.PETS[id] ? `assets/p/${E.PETS[id].icon}.webp` : "");
const PCT_K = ["cri", "rt", "rf", "re", "ra", "rn"];
const petStatTxt = (k, v) => (k === "pm" ? `+${v} PM` : `+${fmt(v)}${PCT_K.includes(k) ? " %" : ""} ${STATS[k].name.replace("% ", "")}`);
const petBonus = (stats) => Object.entries(stats).filter(([, v]) => v).map(([k, v]) => petStatTxt(k, v)).join(" · ");
const petKind = (p) => (p.kind === "monti" ? `Montilier ${E.PET_FAMS[p.fam].toLowerCase().replace(/s$/, "")}` : p.kind === "boss" ? "Familier rare de boss" : "Familier de zone");
function petSlot(c) {
  const P = E.petOf(S, c); const p = P && E.PETS[P.id];
  return `<button class="dslot pet ${P ? "filled" : ""} ${p && p.kind === "monti" ? "monti" : ""}" data-act="herotab" data-v="pet" data-tip="${P ? h(`${p.name} · ${petKind(p)} · croissance ${P.g} %`) : c.lvl < E.PET_LVL ? `Familier : dès le niveau ${E.PET_LVL}` : "Familier : vide"}">
    ${P ? im(petImg(P.id), "", p.name) : `<span class="dlabel">Familier</span>`}${P && P.g < 100 ? `<i class="pgrow" style="width:${P.g}%"></i>` : ""}</button>`;
}
function petCard(P, c, opts = {}) {
  const p = E.PETS[P.id]; const cur = E.petStatsAt(P.id, P.g); const owner = E.petOwner(S, P.uid); const lvlOk = c.lvl >= E.petReqLvl(P.id);
  const eta = P.g < 100 ? E.petEta(S, P) : 0;
  return `<div class="petcard ${p.kind} ${p.fam ? "f-" + p.fam : ""} ${opts.big ? "big" : ""}">
    <span class="peticon">${im(petImg(P.id), "", p.name)}</span>
    <div class="grow stack" style="gap:3px;min-width:0">
      <div><b>${h(p.name)}</b> <span class="xs muted">${petKind(p)}${owner && owner.id !== c.id ? ` · porté par ${h(owner.name)}` : ""}</span></div>
      <div class="pbar"><i style="width:${P.g}%"></i><span>${P.g < 100 ? `Croissance ${P.g} %` : "Adulte : bonus au maximum"}</span></div>
      <div class="small"><span class="muted">Maintenant :</span> <b class="pbon">${petBonus(cur) || "—"}</b></div>
      ${P.g < 100 ? `<div class="xs muted">Au maximum : ${petBonus(p.stats)}</div>` : ""}
      ${opts.big ? `<div class="xs muted">${p.food ? `Nourriture préférée : <b>${h(p.food)}</b> (compte double) · ` : ""}${P.g < 100 ? (P.hungry ? `<span class="warnt">a faim : rien à manger dans le sac</span>` : `adulte dans ${E.etaTxt(Math.round(eta / 1000))} environ`) + (P.last ? ` · dernier repas : ${h(P.last)}` : "") : "ne mange plus"}</div>` : ""}
    </div>
    ${opts.act ? (c.pet === P.uid ? `<button class="btn sm" data-act="petoff">Retirer</button>` : `<button class="btn sm primary" data-act="peton" data-uid="${P.uid}" ${lvlOk ? "" : "disabled"}>${lvlOk ? (p.kind === "monti" ? "Monter" : "Équiper") : "Niv. " + E.petReqLvl(P.id)}</button>`) : ""}
  </div>`;
}
function charPetView(c) {
  const P = E.petOf(S, c); const mine = Object.values(S.pets).sort((a, b) => (E.PETS[b.id].kind === "monti") - (E.PETS[a.id].kind === "monti") || b.g - a.g);
  const others = mine.filter((x) => x.uid !== (P && P.uid));
  const coll = ui.petColl || "zone"; const list = Object.entries(E.PETS).filter(([, p]) => (coll === "monti" ? p.kind === "monti" : coll === "boss" ? p.kind === "boss" : p.kind === "zone")).sort((a, b) => a[1].lvl - b[1].lvl);
  const nOwn = (k) => Object.entries(E.PETS).filter(([id, p]) => p.kind === k && E.petOwned(S, id)).length; const nAll = (k) => Object.values(E.PETS).filter((p) => p.kind === k).length;
  const keep = Object.keys(S.petKeep).filter((r) => S.petKeep[r]);
  const topRes = Object.entries(S.res).filter(([r]) => !E.isKey(r) && r !== E.POUSSIERE && D.RES[r]).sort((a, b) => b[1] - a[1]).slice(0, 40);
  return `<div class="stack">
    <div class="panel"><div class="phead"><h2>${P && E.isMonti(P.id) ? "Montilier" : "Familier"} de ${h(c.name)}</h2>${P ? `<button class="btn sm" data-act="petoff">Retirer</button>` : ""}</div><div class="pad stack">
      ${P ? petCard(P, c, { big: true }) + (E.isMonti(P.id) ? `<p class="note xs" style="margin:0">Un montilier prend à la fois la place du familier et celle de la monture.</p>` : "") : `<div class="empty">${c.lvl < E.PET_LVL ? `Un familier se porte dès le niveau ${E.PET_LVL}.` : mine.length ? "Aucun familier porté : choisissez-en un ci-dessous." : "Aucun familier pour l'instant. Chaque sous-zone de chasse cache le sien (rare), et les boss en stasis 6 et plus gardent des familiers rares et des montiliers."}</div>`}
    </div></div>
    ${mountPanel(c)}
    ${others.length ? `<div class="panel"><div class="phead"><h2>Vos familiers</h2><span class="xs muted">${mine.length} au total</span></div><div class="list">${others.map((x) => `<div class="li">${petCard(x, c, { act: true })}</div>`).join("")}</div></div>` : ""}
    <div class="panel"><div class="phead"><h2>Repas</h2><span class="xs muted">un repas toutes les 30 min, même hors ligne</span></div><div class="pad stack">
      <p class="note xs" style="margin:0">Chaque familier porté mange ${E.PET_MEAL_N} ressources par repas : sa nourriture préférée si vous en avez (+2 % de croissance), sinon la ressource la plus abondante du sac (+1 %). Il ne touche jamais aux clés, à la poussière de stasis ni aux ressources protégées. S'il n'a rien à manger, il attend, sans pénalité.</p>
      <div class="xs muted">Ressources protégées (touchez pour protéger ou libérer) :</div>
      <div class="row" style="gap:4px;flex-wrap:wrap">${topRes.map(([r, n]) => `<button class="pill keep ${S.petKeep[r] ? "on" : ""}" data-act="petkeep" data-r="${h(r)}" aria-pressed="${!!S.petKeep[r]}">${S.petKeep[r] ? "🔒 " : ""}${h(r)} <span class="muted num">${fmt(n)}</span></button>`).join("") || `<span class="muted xs">Sac vide.</span>`}
        ${keep.filter((r) => !topRes.some(([x]) => x === r)).map((r) => `<button class="pill keep on" data-act="petkeep" data-r="${h(r)}" aria-pressed="true">🔒 ${h(r)}</button>`).join("")}</div>
    </div></div>
    <div class="panel"><div class="phead"><h2>Collection</h2><span class="seg">${[["zone", "Zones"], ["boss", "Boss"], ["monti", "Montiliers"]].map(([v, n]) => `<button data-act="petcoll" data-v="${v}" aria-pressed="${coll === v}">${n} ${nOwn(v)}/${nAll(v)}</button>`).join("")}</span></div>
      <div class="pad"><div class="petgrid">${(ui.petAll ? list : list.filter(([id]) => E.petOwned(S, id)).concat(list.filter(([id]) => !E.petOwned(S, id))).slice(0, 18)).map(([id, p]) => { const own = E.petOwned(S, id);
        return `<div class="pettile ${own ? "own" : ""} ${p.fam ? "f-" + p.fam : ""}" data-tip="${h(`${p.name} · ${petKind(p)} · au maximum : ${petBonus(p.stats)} · ${E.petWhere(id)}${p.food ? " · aime : " + p.food : ""}`)}">${im(petImg(id), "", p.name)}<b>${h(p.name)}</b><span>${h(petBonus(p.stats))}</span><span class="where">${h(E.petWhere(id))}</span></div>`; }).join("")}</div>
      ${!ui.petAll && list.length > 18 ? `<div style="text-align:center;margin-top:8px"><button class="btn sm" data-act="petall">Voir les ${list.length - 18} autres</button></div>` : ""}
      <p class="note xs">${coll === "zone" ? "Chaque sous-zone de chasse a son familier : 1 chance sur 2 000 par victoire, même hors ligne." : coll === "boss" ? "Les familiers rares tombent sur leur boss à partir de la stasis 7 (1 chance sur 25)." : "Les montiliers tombent sur leur boss à partir de la stasis 6 : 1 chance sur 25, et forcément au plus tard à la 60e victoire. Les légendaires (+1 PA) : stasis 8 et plus, 1 chance sur 250, un peu plus à chaque échec. Dès le niveau 60."} Un double nourrit celui que vous avez déjà (+${E.PET_DUP_G} %).</p></div></div>
  </div>`;
}
/* ---------- 0.1.9 : montures (dragodindes, muldos, volkornes) ---------- */
const mountImg = (sp, c) => `assets/mt/${E.mountIcon(sp, c)}.webp`;
const mountSpName = (sp) => E.MOUNTS[sp].name + (sp === "dd" ? "s" : "s");
const mountStatTxt = (stats) => petBonus(stats);
const mountBar = (M) => `<div class="pbar"><i style="width:${M.lvl >= E.MOUNT_MAX ? 100 : pct(M.xp, E.mountXpNeed(M.sp, M.lvl))}%"></i><span>${M.lvl >= E.MOUNT_MAX ? `Niveau ${E.MOUNT_MAX} : bonus au maximum` : `Niveau ${M.lvl} · ${pct(M.xp, E.mountXpNeed(M.sp, M.lvl))} %`}</span></div>`;
function mountSlot(c) {
  const M = E.mountOf(S, c); const blocked = E.mountBlocked(S, c);
  const tip = blocked ? "Monture : la place est prise par le montilier" : M ? `${E.mountName(M)} · niveau ${M.lvl}` : c.lvl < E.MOUNT_LVL ? `Monture : dès le niveau ${E.MOUNT_LVL}` : "Monture : vide";
  return `<button class="dslot pet mount ${M ? "filled" : ""} ${blocked ? "blocked" : ""}" data-act="herotab" data-v="pet" data-tip="${h(tip)}">
    ${M ? im(mountImg(M.sp, M.c), "", E.mountName(M)) : `<span class="dlabel">Monture</span>`}${M && M.lvl < E.MOUNT_MAX ? `<i class="pgrow" style="width:${M.lvl}%"></i>` : ""}</button>`;
}
function mountCard(M, c, opts = {}) {
  const cur = E.mountStatsAt(M); const mx = E.mountStatsMax(M.sp, M.c); const owner = E.mountOwner(S, M.uid); const ok = c.lvl >= E.mountReq(M);
  const why = E.breedWhy(S, M);
  return `<div class="petcard mountcard ${opts.big ? "big" : ""}">
    <span class="peticon">${im(mountImg(M.sp, M.c), "", E.mountName(M))}</span>
    <div class="grow stack" style="gap:3px;min-width:0">
      <div><b>${h(E.mountName(M))}</b> <span class="xs muted">génération ${E.gen(M.sp, M.c)}${E.isBico(M.c) ? " · bicolore" : ""}${owner && owner.id !== c.id ? ` · montée par ${h(owner.name)}` : ""}</span></div>
      ${mountBar(M)}
      <div class="small"><span class="muted">Maintenant :</span> <b class="pbon">${mountStatTxt(cur) || "—"}</b></div>
      ${M.lvl < E.MOUNT_MAX ? `<div class="xs muted">Au niveau ${E.MOUNT_MAX} : ${mountStatTxt(mx)}</div>` : ""}
      ${opts.big ? `<div class="xs muted">Petits : ${M.kids}/${E.kidsCap(S)}${why ? ` · élevage : ${why}` : " · peut aller à l'enclos"}</div>` : ""}
    </div>
    ${opts.act ? (c.mount === M.uid ? `<button class="btn sm" data-act="mountoff">Descendre</button>` : `<button class="btn sm primary" data-act="mounton" data-uid="${M.uid}" ${ok ? "" : "disabled"}>${ok ? "Monter" : "Niv. " + E.mountReq(M)}</button>`) : ""}
  </div>`;
}
function mountPanel(c) {
  const M = E.mountOf(S, c); const blocked = E.mountBlocked(S, c); const share = E.mountShare(S, c);
  const mine = Object.values(S.mounts).sort((a, b) => E.MOUNT_ORDER.indexOf(a.sp) - E.MOUNT_ORDER.indexOf(b.sp) || b.lvl - a.lvl);
  const others = mine.filter((x) => x.uid !== (M && M.uid));
  const nets = S.cons.filet || 0; const hunting = S.hunting && S.sub;
  const zones = E.MOUNT_ORDER.map((sp) => { const Z = E.MOUNT_SP[sp]; const s = E.SUBS[Z.sub]; const here = hunting === Z.sub;
    return `<div class="li ${here ? "" : ""}"><span class="icobox">${im(mountImg(sp, Z.wild[0]), "", E.MOUNTS[sp].name)}</span><span class="grow"><b>${mountSpName(sp)} sauvages</b> <span class="xs muted">héros niveau ${Z.req}</span><br><span class="xs muted">${h(s.name)} (niv. ${s.lvl[0]}-${s.lvl[1]}) · couleurs : ${Z.wild.join(", ")}</span></span>${here ? `<span class="tag good">en chasse ici</span>` : ""}</div>`; }).join("");
  return `<div class="panel"><div class="phead"><h2>Monture de ${h(c.name)}</h2>${M && !blocked ? `<button class="btn sm" data-act="mountoff">Descendre</button>` : ""}</div><div class="pad stack">
    ${blocked ? `<div class="empty">Le montilier prend la place de la monture. Retirez-le pour monter une dragodinde, un muldo ou un volkorne.</div>`
      : M ? mountCard(M, c, { big: true }) + (M.lvl < E.MOUNT_MAX ? `<div class="mtshare"><span class="small"><b>Part d'XP donnée à la monture</b></span>${c.lvl >= E.MAX_LVL ? `<span class="tag good">toute l'XP (héros au niveau maximum)</span>` : `<span class="seg">${E.MOUNT_SHARES.map((v) => `<button data-act="mountshare" data-v="${v}" aria-pressed="${share === v}">${v} %</button>`).join("")}</span>`}
          <p class="note xs" style="margin:0">${share ? `${h(c.name)} garde ${100 - share} % de son XP et sa monture reçoit le reste` : "La monture ne gagne pas d'XP pour l'instant"} · niveau ${M.lvl + 1} dans ${fmt(E.mountXpNeed(M.sp, M.lvl) - M.xp)} XP. Quand elle atteint le niveau ${E.MOUNT_MAX}, la part repasse toute seule à 0 %.</p></div>` : "")
      : `<div class="empty">${c.lvl < E.MOUNT_LVL ? `Une monture se monte dès le niveau ${E.MOUNT_LVL}.` : mine.length ? "Aucune monture montée : choisissez-en une ci-dessous." : "Aucune monture pour l'instant : chassez dans une zone sauvage avec un filet de capture dans le sac."}</div>`}
  </div></div>
  ${others.length ? `<div class="panel"><div class="phead"><h2>Écurie</h2><span class="xs muted">${E.stableN(S)} / ${E.stableCap(S)} places${S.enclos.built ? "" : " · +10 avec l'enclos"}</span></div><div class="list">${others.map((x) => `<div class="li">${mountCard(x, c, { act: true })}</div>`).join("")}</div></div>` : ""}
  <div class="panel"><div class="phead"><h2>Capture</h2><span class="row small">${emo("🪢")} <b class="num">${nets}</b> filet${nets > 1 ? "s" : ""}<button class="btn sm ${S.kamas >= E.NET_COST ? "primary" : ""}" data-act="buynet" ${S.kamas >= E.NET_COST ? "" : "disabled"}>Acheter 1 · ${fmt(E.NET_COST)} k</button></span></div>
    <div class="list">${zones}</div>
    <div class="pad"><p class="note xs" style="margin:0">Avec un filet dans le sac, chaque victoire dans une zone sauvage peut capturer une monture de niveau 1 (dragodindes : environ une toutes les 30 min de chasse, muldos : une par heure, volkornes : une toutes les 3 h), en ligne comme hors ligne. Le filet n'est utilisé que si la capture réussit. Le Bricoleur en fabrique dès le niveau 40. Les autres couleurs naissent à l'enclos du Havre-Sac.</p></div></div>`;
}
/* ---------- enclos : carnet de l'éleveur (C) et arbre (A) ---------- */
const mtSp = () => (E.MOUNTS[ui.mtSp] ? ui.mtSp : "dd");
const mtTabs = (act) => `<span class="seg">${E.MOUNT_ORDER.map((sp) => { const n = Object.keys(S.mountSeen[sp] || {}).filter((c) => !E.isBico(c)).length; return `<button data-act="${act}" data-v="${sp}" aria-pressed="${mtSp() === sp}">${mountSpName(sp)} <span class="num xs">${n}/${Object.keys(E.MOUNTS[sp].cols).length}</span></button>`; }).join("")}</span>`;
const seenCol = (sp, c) => !!(S.mountSeen[sp] && S.mountSeen[sp][c]);
const mtChip = (sp, c) => { const own = seenCol(sp, c); const n = Object.values(S.mounts).filter((M) => M.sp === sp && M.c === c).length;
  return `<span class="mtchip ${own ? "own" : ""}" data-tip="${h(own ? `${E.MOUNTS[sp].name} ${E.colourName(sp, c)} · au niveau 100 : ${mountStatTxt(E.mountStatsMax(sp, c))}${E.MOUNTS[sp].cols[c] && E.MOUNTS[sp].cols[c].p ? ` · ${E.MOUNTS[sp].cols[c].p.join(" + ")}` : " · capture"}` : "Couleur jamais obtenue")}">${im(mountImg(sp, c), "", own ? c : "?")}${n > 1 ? `<em>×${n}</em>` : ""}</span>`; };
function enclosBody() {
  if (!S.enclos.built) return `<p class="note">L'enclos ouvre l'élevage : deux montures de la même espèce, niveau ${E.BREED_LVL} au moins, donnent un petit après ${E.BIRTH_MS / 3600e3} h, même hors ligne. Il ajoute aussi ${E.STABLE_ENCLOS} places à l'écurie.</p><button class="btn sm ${S.kamas >= E.ENCLOS_COST ? "primary" : ""}" data-act="enclosbuild" ${S.kamas >= E.ENCLOS_COST ? "" : "disabled"}>Construire · ${fmt(E.ENCLOS_COST)} k</button>`;
  const sp = mtSp(); const Sp = E.MOUNTS[sp]; const next = E.nextCrosses(S, sp);
  const pairs = S.enclos.pairs.map((p, i) => { const A = S.mounts[p.a], B = S.mounts[p.b]; if (!A || !B) return "";
    return `<div class="breed"><div class="bpair">${im(mountImg(A.sp, A.c), "", "")}<b>+</b>${im(mountImg(B.sp, B.c), "", "")}</div><div class="grow"><b>${h(E.colourName(A.sp, A.c))} + ${h(E.colourName(B.sp, B.c))}</b> <span class="xs muted">${h(E.MOUNTS[A.sp].name)}s</span>
      <div class="xs">${E.breedOdds(S, A, B).map(([c, pc, neu]) => `${neu ? `<b class="neu">${seenCol(A.sp, c) ? h(E.colourName(A.sp, c)) : "nouvelle couleur"}</b>` : h(E.colourName(A.sp, c))} ${pc} %`).join(" · ")}</div>
      <div class="xs ${p.wait ? "ko" : "muted"}">${p.wait ? "Le petit attend : l'écurie est pleine" : `Naissance dans ${E.etaTxt(Math.ceil(p.t / 1000))} · continue hors ligne`}</div><div class="bar"><i style="width:${100 - pct(p.t, E.birthMs(S))}%"></i></div></div><button class="btn sm" data-act="breedstop" data-i="${i}">Annuler</button></div>`; }).join("");
  const gens = {}; for (const c in Sp.cols) (gens[Sp.cols[c].g] = gens[Sp.cols[c].g] || []).push(c);
  const bicos = Object.keys(S.mountSeen[sp] || {}).filter(E.isBico);
  return `<div class="stack carnet">
    <div class="row between"><h3 class="sec" style="margin:0">Carnet de l'éleveur</h3>${mtTabs("mtsp")}</div>
    ${pairs ? `<div class="stack" style="gap:6px">${pairs}</div>` : `<p class="note xs" style="margin:0">Enclos libre (${E.pairCap(S)} couple${E.pairCap(S) > 1 ? "s" : ""} à la fois).</p>`}
    <div class="xs plus" style="font-weight:800;text-transform:uppercase;letter-spacing:.5px">Prochains croisements</div>
    ${next.length ? next.map((x) => `<div class="nx"><span class="bpair">${im(mountImg(sp, x.p[0]), "", x.p[0])}<b>+</b>${im(mountImg(sp, x.p[1]), "", x.p[1])}</span><span class="grow"><b>${h(x.p[0])} + ${h(x.p[1])}</b><br><span class="xs neu">${E.ODDS.known[0]} % : nouvelle couleur de génération ${Sp.cols[x.c].g}</span>${x.ok ? "" : `<br><span class="xs muted">${!x.a ? `${x.p[0]} : ${E.mountsBySp(S, sp).filter((M) => E.mainColour(M.c) === x.p[0]).map((M) => E.breedWhy(S, M)).filter(Boolean)[0] || "indisponible"}` : !x.b ? `${x.p[1]} : ${E.mountsBySp(S, sp).filter((M) => E.mainColour(M.c) === x.p[1]).map((M) => E.breedWhy(S, M)).filter(Boolean)[0] || "indisponible"}` : "enclos occupé"}</span>`}</span><button class="btn sm ${x.ok ? "primary" : ""}" data-act="breed" data-a="${x.a ? x.a.uid : ""}" data-b="${x.b ? x.b.uid : ""}" ${x.ok ? "" : "disabled"}>Lancer à l'enclos</button></div>`).join("")
      : `<p class="note xs" style="margin:0">${Object.keys(S.mountSeen[sp] || {}).length ? "Aucune nouvelle couleur à portée : capture d'autres couleurs, fais grandir tes montures (niveau 50) ou croise deux montures au choix." : `Capture d'abord un${sp === "dd" ? "e" : ""} ${Sp.name.toLowerCase()} sauvage (filet de capture, zone sauvage).`}</p>`}
    <div class="row"><button class="btn sm" data-act="breedpick">Croiser deux montures au choix</button><button class="btn sm" data-act="mtree">Voir l'arbre</button></div>
    <div class="gens">${Object.keys(gens).sort().map((g) => { const L = gens[g]; const n = L.filter((c) => seenCol(sp, c)).length;
      return `<div class="gen"><div class="gl"><b>Génération ${g}</b><span class="xs muted">${n} / ${L.length} couleurs${g == 1 ? " · capture" : ""}</span><div class="bar"><i style="width:${pct(n, L.length)}%"></i></div></div><div class="chips">${L.map((c) => mtChip(sp, c)).join("")}</div></div>`; }).join("")}
      ${bicos.length ? `<div class="gen"><div class="gl"><b>Bicolores</b><span class="xs muted">${bicos.length} obtenu${bicos.length > 1 ? "s" : ""}</span></div><div class="chips">${bicos.map((c) => mtChip(sp, c)).join("")}</div></div>` : ""}</div>
    <p class="note xs" style="margin:0">Croisement connu : ${E.ODDS.known[0]} % la nouvelle couleur, ${E.ODDS.known[1]} % chaque parent, ${E.ODDS.known[3]} % un bicolore. Autre couple : ${E.ODDS.free[1]} % chaque parent, ${E.ODDS.free[3]} % un bicolore. Un bicolore transmet sa première couleur. Chaque monture a ${E.kidsCap(S)} petits au plus, puis se repose (elle reste montable).</p>
  </div>`;
}
function breedPickSheet() {
  const sp = ui.breedA ? S.mounts[ui.breedA].sp : null;
  const list = Object.values(S.mounts).filter((M) => (!sp || M.sp === sp) && M.uid !== ui.breedA).sort((a, b) => E.MOUNT_ORDER.indexOf(a.sp) - E.MOUNT_ORDER.indexOf(b.sp) || b.lvl - a.lvl);
  const A = ui.breedA ? S.mounts[ui.breedA] : null;
  openSheet(`<h2>${IC("ailes")} Croiser deux montures</h2><p class="small muted">${A ? `Première monture : <b>${h(E.mountName(A))}</b>. Choisissez la seconde (même espèce).` : "Choisissez la première monture. Il faut le niveau " + E.BREED_LVL + " et des petits restants."}</p>
    <div class="list">${list.map((M) => { const why = E.breedWhy(S, M); const odds = A ? E.breedOdds(S, A, M) : null;
      return `<div class="li"><span class="icobox">${im(mountImg(M.sp, M.c), "", "")}</span><span class="grow"><b>${h(E.mountName(M))}</b> <span class="xs muted">niv. ${M.lvl} · petits ${M.kids}/${E.kidsCap(S)}</span>${odds ? `<br><span class="xs">${odds.map(([c, pc, neu]) => `${neu && !seenCol(M.sp, c) ? `<b class="neu">nouvelle couleur</b>` : h(E.colourName(M.sp, c))} ${pc} %`).join(" · ")}</span>` : ""}${why ? `<br><span class="xs ko">${why}</span>` : ""}</span>
        <button class="btn sm primary" data-act="${A ? "breed" : "breedsel"}" ${A ? `data-a="${A.uid}" data-b="${M.uid}"` : `data-uid="${M.uid}"`} ${why ? "disabled" : ""}>${A ? "Lancer" : "Choisir"}</button></div>`; }).join("") || `<div class="empty">Aucune monture${sp ? " de cette espèce" : ""}.</div>`}</div>
    <div class="row">${A ? `<button class="btn" data-act="breedpick" data-reset="1">Changer la première</button>` : ""}<button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function mountTreeSheet() {
  const sp = mtSp(); const Sp = E.MOUNTS[sp]; const gens = {}; for (const c in Sp.cols) (gens[Sp.cols[c].g] = gens[Sp.cols[c].g] || []).push(c);
  const any = (col) => Object.values(S.mounts).some((M) => M.sp === sp && E.mainColour(M.c) === col);
  const hint = (c) => { const p = Sp.cols[c].p; return !seenCol(sp, c) && p && any(p[0]) && any(p[1]); };
  openSheet(`<h2>${IC("ailes")} Arbre des ${mountSpName(sp).toLowerCase()}</h2><div class="row between">${mtTabs("mtreesp")}<span class="xs muted">en violet : à portée avec ce que vous avez</span></div>
    <div class="treebox"><div class="mtree" data-sp="${sp}"><svg></svg>${Object.keys(gens).sort().map((g) => `<div class="col"><h5>Gén. ${g}</h5>${gens[g].map((c) => { const k = seenCol(sp, c), ht = hint(c); const p = Sp.cols[c].p;
      return `<div class="node ${k ? "own" : ""} ${ht ? "hint" : ""}" data-c="${h(c)}">${im(mountImg(sp, c), "", "")}<b>${k ? h(c) : "???"}</b><span>${k ? h(mountStatTxt(Sp.cols[c].s)) : p ? (ht ? h(p.join(" + ")) : "? + ?") : "capture"}</span></div>`; }).join("")}</div>`).join("")}</div></div>
    <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
  requestAnimationFrame(drawTree);
}
function drawTree() {
  const tree = $(".mtree"); if (!tree) return; const sp = tree.dataset.sp; const Sp = E.MOUNTS[sp]; const svg = tree.querySelector("svg"); const tb = tree.getBoundingClientRect();
  const pos = (c) => { const el = tree.querySelector(`.node[data-c="${CSS.escape(c)}"]`); if (!el) return null; const e = el.getBoundingClientRect(); return { l: e.left - tb.left + tree.scrollLeft, r: e.right - tb.left + tree.scrollLeft, y: e.top - tb.top + e.height / 2 }; };
  let p = "";
  for (const c in Sp.cols) { const par = Sp.cols[c].p; if (!par) continue; const to = pos(c); if (!to) continue; const k = seenCol(sp, c); const el = tree.querySelector(`.node[data-c="${CSS.escape(c)}"]`); const ht = el && el.classList.contains("hint");
    for (const x of par) { const f = pos(x); if (!f) continue; const mx = (f.r + to.l) / 2; p += `<path class="${k ? "lit" : ht ? "hint" : ""}" d="M${f.r},${f.y} C${mx},${f.y} ${mx},${to.y} ${to.l},${to.y}"/>`; } }
  svg.setAttribute("width", tree.scrollWidth); svg.setAttribute("height", tree.scrollHeight); svg.innerHTML = p;
}
function charEquipView(c, st) {
  const counts = E.setCounts(S, c);
  const sets = Object.entries(counts).filter(([id]) => SETS[id]).map(([id, n]) => setBlock(id, n)).join("");
  let pick = "";
  if (ui.slot) {
    const want = ui.slot.startsWith("anneau") ? "anneau" : ui.slot.startsWith("dofus") ? "dofus" : ui.slot;
    const cands = Object.values(S.items).filter((it) => ITEMS[it.tpl].slot === want && c.equip[ui.slot] !== it.uid).sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl || E.itemQuality(b) - E.itemQuality(a));
    pick = `<div class="panel"><div class="phead"><h2>${SLOTS[ui.slot]} : choisir</h2><span class="row">${c.equip[ui.slot] ? `<button class="btn sm" data-act="fmgo" data-uid="${c.equip[ui.slot]}">${IC("forge")} Forgemager</button><button class="btn sm" data-act="unequip" data-slot="${ui.slot}">Retirer</button>` : ""}<button class="btn sm" data-act="slot" data-slot="">Fermer</button></span></div>
      <div class="list">${cands.slice(0, 40).map((it) => { const T = ITEMS[it.tpl]; const by = E.equippedBy(S, it.uid);
        return `<div class="li ${it.radiant ? "radiant" : ""}">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="muted xs">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${by ? ` · porté par ${h(by.name)}` : ""}</span><br>${deltaHtml(c, ui.slot, it.uid)}</span>
          <button class="btn sm primary" data-act="equip" data-uid="${it.uid}" ${T.lvl > c.lvl ? "disabled" : ""}>${T.lvl > c.lvl ? "Niv. " + T.lvl : "Équiper"}</button></div>`; }).join("") || `<div class="empty">${want === "dofus" ? "Aucun trophée. Complétez les paliers de chasse d'une sous-zone pour en obtenir." : "Aucun objet de ce type. Fabriquez-en dans les Ateliers ou trouvez-en sur les monstres."}</div>`}</div></div>`;
  }
  const mainK = buildMain(c);
  return `<div class="stack">
    <div class="panel"><div class="pad">
      <div class="doll">
        <div class="dcol">${DOLL_L.map((s) => dollSlot(c, s)).join("")}</div>
        <div class="dcenter" style="--cc:${CLASSES[c.cls].color}"><div class="dfig">${lookImg(c, "dlook")}<span class="dlv">Niveau ${c.lvl}</span></div>
          <b>${h(c.name)}</b><span class="xs muted">${CLASSES[c.cls].name} niv. ${c.lvl}</span>
          <div class="dstats">${["hpMax", "pa", mainK, "pui", "pp", "sa"].map((k) => `<span${tipAttr(k)}>${sIco(k) || "❤"}<b class="num">${k === "hpMax" ? fmt(st.hpMax) : fmtStatVal(k, st[k])}</b></span>`).join("")}</div></div>
        <div class="dcol">${DOLL_R.map((s) => dollSlot(c, s)).join("")}</div>
        <div class="drow">${dollSlot(c, "arme")}${petSlot(c)}${mountSlot(c)}<span class="dsep"></span>${D.DOFUS_SLOTS.map((s) => dollSlot(c, s)).join("")}</div>
      </div></div></div>
    ${pick}
    ${gearHtml(c)}
    ${sets ? `<div class="panel"><div class="phead"><h2>Panoplies actives</h2></div><div class="pad">${sets}</div></div>` : ""}
    <p class="note xs">▲ en vert : un objet plus intéressant est disponible dans le sac pour cet emplacement.</p></div>`;
}
/* Codes de build (3.1.3) : à coller sur Discord, lisibles par un autre joueur */
function buildPreview(b, c) {
  const C = CLASSES[b.cls];
  const stats = BASE_STATS.filter((k) => b.st[k] > 0).sort((x, y) => b.st[y] - b.st[x]).map((k) => `<span class="pill">${sIco(k)} ${fmt(b.st[k])} ${h(STATS[k].name)}</span>`).join("");
  const sps = b.sp.map((x) => { const d = E.spellDef(b.cls, x.id); return `<span class="bsp" data-tip="${h(spellTip(d, b.lvl))}">${spIcon(d)}<span class="xs">${h(d.name)}</span>${d.lvl > (c ? c.lvl : 999) ? `<span class="xs muted">niv. ${d.lvl}</span>` : ""}</span>`; }).join("");
  const eqs = Object.entries(b.eq).map(([sl, t]) => { const T = ITEMS[t]; const own = Object.values(S.items).some((x) => x.tpl === t); return `<span class="lootico ${own ? "own" : ""}" data-tip="${h(T.name)} · niv. ${T.lvl}${own ? " · vous en avez un" : T.craft ? " · fabricable" : ""}">${im(itemImg(t), "", T.name)}</span>`; }).join("");
  const craftable = Object.values(b.eq).filter((t) => ITEMS[t].craft && !S.shop.some((e) => e.id === t));
  const same = c && c.cls === b.cls;
  return `<div class="buildprev stack" style="gap:8px"><div class="row" style="gap:10px">${headTag(b.cls, C.sex)}<div><b>${h(b.name || "Build")}</b> <span class="muted small">${h(C.name)} niv. ${b.lvl}</span><div class="xs muted">${b.as ? `Répartition automatique : ${h(STATS[b.as].name)}${E.ELEM_STATS.includes(b.as) ? ` jusqu'à ${b.ac >= 9999 ? "sans limite" : b.ac}, puis ${h(STATS[b.at].name)}` : ""}` : "Répartition manuelle"}</div></div></div>
    ${stats ? `<div class="row" style="gap:4px;flex-wrap:wrap">${stats}</div>` : ""}
    <div><div class="xs muted">Sorts</div><div class="bsps">${sps || `<span class="muted xs">Aucun</span>`}</div></div>
    ${eqs ? `<div><div class="xs muted">Équipement (en couleur : vous en avez un)</div><div class="row" style="gap:4px;flex-wrap:wrap">${eqs}</div></div>` : ""}
    <div class="row" style="gap:6px;flex-wrap:wrap">${same ? `<button class="btn sm primary" data-act="buildapply">Appliquer à ${h(c.name)}</button>` : `<span class="small muted">Pour l'appliquer, choisissez un ${h(C.name)} dans vos héros.</span>`}
      ${craftable.length ? `<button class="btn sm" data-act="buildshop">${G("cart")} Ajouter ${craftable.length} objet${craftable.length > 1 ? "s" : ""} fabricable${craftable.length > 1 ? "s" : ""} à la liste de courses</button>` : ""}</div>
    ${same ? `<p class="note xs" style="margin:0">Appliquer remplace les sorts et la répartition des caractéristiques de ${h(c.name)}. L'équipement n'est pas copié.</p>` : ""}</div>`;
}
function buildSheet(cid) {
  const c = char(cid) || char(ui.cid); ui.buildCid = c.id;
  const code = E.buildCode(S, c);
  openSheet(`<h2>Partager un build</h2>
    <div class="stack small" style="gap:12px">
      <div><b>Le build de ${h(c.name)}</b> <span class="muted">(sorts, caractéristiques et équipement)</span>
        <textarea id="buildOut" readonly rows="3">${h(code)}</textarea>
        <div class="row" style="gap:6px"><button class="btn sm primary" data-act="buildcopy">Copier le code</button><span class="xs muted">À coller sur Discord ou à envoyer à un ami.</span></div></div>
      <div><b>Lire un build</b> <span class="muted">(collez le code d'un autre joueur)</span>
        <textarea id="buildIn" rows="3" placeholder="${E.BUILD_PREFIX}…">${h(ui.buildIn || "")}</textarea>
        <div class="row" style="gap:6px"><button class="btn sm" data-act="buildread">Lire</button><span id="buildMsg" class="minus small"></span></div></div>
      ${ui.buildRead ? buildPreview(ui.buildRead, c) : ""}
    </div>
    <div class="row"><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
/* Tenues : équipement complet enregistré, remis en un clic */
function gearOn(c, g) { const a = Object.entries(g.eq), b = Object.entries(c.equip); return a.length === b.length && a.every(([sl, u]) => c.equip[sl] === u); }
function gearHtml(c) {
  const rows = Array.from({ length: E.MAX_GEAR }, (_, i) => {
    const g = (c.gear || [])[i];
    if (!g) return `<div class="preset"><span class="grow small muted">Emplacement ${i + 1} vide</span><button class="btn sm" data-act="gsave" data-i="${i}">Enregistrer l'équipement actuel</button></div>`;
    const on = gearOn(c, g); const miss = E.gearMissing(S, c, g);
    return `<div class="preset ${on ? "on" : ""}" style="flex-wrap:wrap"><span class="grow"><b>${h(g.name)}</b> <span class="xs muted">${Object.keys(g.eq).length} objet${Object.keys(g.eq).length > 1 ? "s" : ""}${miss ? ` · <span class="minus">${miss} introuvable${miss > 1 ? "s" : ""}</span>` : ""}</span>
      <span class="row" style="gap:3px;margin-top:4px">${Object.values(g.eq).map((u) => S.items[u] ? `<img src="${itemImg(S.items[u].tpl)}" alt="" data-tipitem="${u}" style="width:24px;height:24px;border-radius:5px;background:var(--panel3)">` : "").join("")}</span></span>
      <span class="row" style="gap:4px"><button class="btn sm ${on ? "" : "primary"}" data-act="gload" data-i="${i}" ${on ? "disabled" : ""}>${on ? "Portée" : "Mettre"}</button><button class="btn sm" data-act="gsave" data-i="${i}" title="Remplacer par l'équipement actuel">Écraser</button><button class="btn sm" data-act="gren" data-i="${i}" title="Renommer">${G("edit")}</button><button class="btn sm" data-act="gdel" data-i="${i}" title="Supprimer">✕</button></span></div>`;
  }).join("");
  return `<div class="panel"><div class="phead"><h2>Tenues</h2><span class="xs muted">changer tout l'équipement en un clic</span></div><div class="pad stack" style="gap:6px">${rows}
    <p class="note xs" style="margin:0">Les objets d'une tenue sont protégés : ils ne sont ni vendus ni brisés, même par les règles automatiques. S'ils sont portés par un autre héros, ils changent de main.</p></div></div>`;
}
const EL_NAME = (el) => (el === "best" ? "meilleur élément" : ELEMENTS[el || "n"].name.toLowerCase());
const tgtTxt = (n) => (n >= 9 ? "tous les ennemis" : n > 1 ? `${n} cibles` : "");
function fxLine(f) {
  const v = `${f.min}${f.max !== f.min ? "–" + f.max : ""}`; const el = f.el ? (f.el === "best" ? `<span class="eld" style="--c:var(--gold2)" title="Meilleur élément">★</span>` : eld(f.el)) : "";
  switch (f.k) {
    case "dmg": return `${el} ${v} ${EL_NAME(f.el)}${f.n > 1 ? ` (${tgtTxt(f.n)})` : ""}`;
    case "drain": return `${el} ${v} ${EL_NAME(f.el)}, vole la moitié en PV${f.n > 1 ? ` (${tgtTxt(f.n)})` : ""}`;
    case "dot": return `${el} poison ${v}/tour pendant ${f.t || 2} tours${f.n > 1 ? ` (${tgtTxt(f.n)})` : ""}`;
    case "heal": return `soigne ${v}${f.self ? " (lanceur)" : f.n > 1 ? " (équipe)" : ""}`;
    case "healpct": return `soigne ${f.v} % des PV`;
    case "shield": return `bouclier ${f.pct} % des PV${f.all ? " (équipe)" : ""}, ${f.t || 1} t.`;
    case "buff": return `+${f.v} ${(STATS[f.st] || {}).short || f.st}${f.all ? " (équipe)" : ""}${f.st !== "pa" ? `, ${f.t || 1} t.` : ""}`;
    case "apdrain": return `−${f.v} PA à la cible`;
    case "weaken": return `la cible frappe ${f.v} % moins fort`;
    case "vuln": return `la cible subit +${f.v} % de dégâts, ${f.t || 1} t.`;
    case "summon": { const m = (D.SUMMONS || {})[String(f.mid)]; return `invoque ${m ? h(m.name) : "une créature"}`; }
    case "leech": return `vol de vie ${f.v} %`;
  }
  return "";
}
function spellDesc(sp, lvl) { const g = E.spellGrade(sp, lvl || 200); return g.fx.map(fxLine).filter(Boolean).join(" · ") + (g.fx.some((f) => f.fb) ? ` <span class="muted">(effet simplifié)</span>` : g.fx.some((f) => f.adapt) ? ` <span class="muted" title="Effet de placement ou d'état du jeu original, adapté au combat automatique">(adapté)</span>` : ""); }
const spIcon = (sp) => `<span class="spicon" style="--c:${elVar(spEl(sp))}">${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : "✦"}</span>`;
function zoneOptions() {
  const opts = [];
  ZONES.forEach((z) => z.subs.forEach((s) => { if (E.subUnlocked(S, s.id)) opts.push([s.id, `${z.name} · ${s.name}`]); }));
  Object.entries(DUNGEONS).forEach(([id, d]) => { if (E.dungeonUnlocked(S, id)) opts.push(["dg:" + id, `Donjon · ${d.name}`]); });
  return opts;
}
/* ---------- Sorts : barre de sorts, fiche du sort et grimoire par paires (0.1.11.1) ---------- */
const COND_SHORT = { always: "", first_turn: "1er tour", ally_low: "Allié bas", self_low: "PV < 50 %", enemy_many: "3+ ennemis", enemy_one: "1 ennemi", boss: "Boss", no_summon: "Sans invoc.", ally_shield: "Sans bouclier" };
const KIND_NAME = { dmg: "Dégâts", aoe: "Dégâts de zone", drain: "Vol de vie", dot: "Poison", heal: "Soin", shield: "Bouclier", buff: "Bonus", summon: "Invocation" };
const spKindOf = (c, sp) => E.spellKind(E.spellGrade(sp, c.lvl));
const spMeta = (c, sp) => { const g = E.spellGrade(sp, Math.max(c.lvl, sp.lvl)); return `${g.pa} PA${g.cd ? ` · relance ${g.cd} t.` : ""}${g.casts ? ` · ${g.casts}×/tour` : ""}`; };
const spTip = (c, sp) => `${sp.name} · ${spMeta(c, sp)}${sp.lvl > c.lvl ? ` · niveau ${sp.lvl}` : ""} — ${spellDesc(sp, Math.max(c.lvl, sp.lvl)).replace(/<[^>]+>/g, "")}`;
/* place un sort dans la barre : remplace sa variante si elle y est ; sinon l'ajoute, ou remplace la case « at » si la barre est pleine (ou si replace) */
function spPlace(c, id, at, replace) {
  const sp = E.spellDef(c.cls, id); if (!sp || sp.lvl > c.lvl) return `${sp ? sp.name : "Ce sort"} se débloque au niveau ${sp ? sp.lvl : "?"}.`;
  const N = E.spellSlots(c); const pi = c.spells.findIndex((x) => E.spellDef(c.cls, x.id).pair === sp.pair);
  let idx;
  if (pi >= 0) { if (c.spells[pi].id === id) idx = pi; else { E.equipSpell(S, c, id); idx = pi; } }
  else if (c.spells.length < N && !(replace && at < c.spells.length)) { E.equipSpell(S, c, id); idx = c.spells.length - 1; }
  else { const k = at !== undefined && at < c.spells.length ? at : c.spells.length - 1; c.spells.splice(k, 1); E.equipSpell(S, c, id); c.spells.splice(k, 0, c.spells.pop()); idx = k; }
  if (at !== undefined && replace === "move" && idx !== at) { const [m] = c.spells.splice(idx, 1); c.spells.splice(Math.min(at, c.spells.length), 0, m); idx = Math.min(at, c.spells.length - 1); }
  c.spellsManual = true; c.activePreset = null; ui.spSel = idx; return null;
}
function spMove(c, from, to) { if (from === to || from < 0 || from >= c.spells.length) return; const [m] = c.spells.splice(from, 1); to = Math.min(to, c.spells.length); c.spells.splice(to, 0, m); ui.spSel = to; c.spellsManual = true; c.activePreset = null; }
function spDetailHtml(c) {
  const eq = c.spells; const i = Math.min(ui.spSel || 0, Math.max(0, eq.length - 1)); const x = eq[i];
  if (!x) return `<div class="spdet"><h2>Aucun sort équipé</h2><p class="small muted">Ce héros ne fera rien en combat. Touche un sort du grimoire pour le placer dans la barre.</p></div>`;
  const sp = E.spellDef(c.cls, x.id); if (!sp) return "";
  const k = spKindOf(c, sp); const res = ui.simRes || 0; const st = E.charStats(S, c);
  const other = CLASSES[c.cls].spells.find((s) => s.pair === sp.pair && s.id !== sp.id);
  let est = "";
  if (["dmg", "aoe", "drain", "dot", "heal"].includes(k)) {
    const r = E.spellEstimate(S, c, sp, res);
    est = `<div class="spest"><div class="row" style="justify-content:space-between;gap:6px"><b>${k === "heal" ? `Soigne ≈ ${fmt(r.heal)}` : `${fmt(r.min)}–${fmt(r.max)} dégâts`}</b>
      <select class="small" data-act="simres" aria-label="Résistance de la cible">${[0, 10, 20, 30, 40].map((v) => `<option value="${v}" ${res === v ? "selected" : ""}>Cible ${v} % rés.</option>`).join("")}</select></div>
      ${k === "heal" ? "" : `<div class="xs muted">moyenne ${fmt(r.avg)} avec ${Math.min(60, 5 + st.cri)} % de critiques · ≈ ${fmt(r.turn)} par tour (${r.casts}×${r.tgts > 1 ? `, ${r.tgts >= 9 ? "zone" : r.tgts + " cibles"}` : ""})</div>`}</div>`;
  }
  const varHtml = other ? `<div class="splab">${sp.variant ? "Sort de base" : "Variante"}</div>${other.lvl <= c.lvl
    ? `<button class="spvar" data-act="spg" data-id="${other.id}">${spIcon(other)}<span class="grow"><b class="small">${h(other.name)}</b><br><span class="xs muted">${spMeta(c, other)}</span></span><span class="btn sm">⇄ Échanger</span></button>`
    : `<div class="spvar off">${spIcon(other)}<span class="grow"><b class="small">${h(other.name)}</b><br><span class="xs muted">se débloque au niveau ${other.lvl}</span></span>🔒</div>`}` : "";
  return `<div class="spdet">
    <div class="row" style="gap:10px;flex-wrap:nowrap">${spIcon(sp)}<div class="grow" style="min-width:0"><h2>${h(sp.name)}</h2><div class="xs muted">${KIND_NAME[k] || ""} · ${spMeta(c, sp)}</div></div></div>
    <div class="small">${spellDesc(sp, c.lvl)}</div>${est}
    <div class="splab">Quand le lancer ?</div><div class="spchips">${Object.entries(CONDITIONS).map(([v, n]) => `<button class="spc ${x.cond === v ? "on" : ""}" data-act="spcondc" data-k="${v}">${n}</button>`).join("")}</div>
    ${["summon", "buff", "shield"].includes(k) ? "" : `<div class="splab">Sur qui ?</div><div class="spchips">${Object.entries(D.TARGETS).map(([v, n]) => `<button class="spc ${(x.tgt || "low") === v ? "on" : ""}" data-act="sptgtc" data-k="${v}">${n}</button>`).join("")}</div>`}
    ${varHtml}
    <div class="row" style="gap:6px"><button class="btn sm" data-act="spup" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Avancer">◀</button><button class="btn sm" data-act="spdown" data-i="${i}" ${i === eq.length - 1 ? "disabled" : ""} aria-label="Reculer">▶</button><span class="grow xs muted">case ${i + 1} sur ${E.spellSlots(c)}</span><button class="btn sm" data-act="sprem" data-i="${i}">Retirer</button></div>
  </div>`;
}
/* 0.1.11.2 : aperçu des 3 premiers tours (vrai moteur), conseils et « Ranger au mieux » */
const ATK_KINDS = ["dmg", "aoe", "drain", "dot"];
const spPrevCache = { key: null, data: null };
function spPreviewOf(c) {
  const mode = ui.spPrevMode || "hunt";
  const key = JSON.stringify([c.id, c.lvl, c.spells, c.equip, c.pet, c.mount, c.stats, mode, S.sub, S.hunting, S.chars.map((x) => [x.id, x.inTeam, x.lvl, x.job])]);
  if (spPrevCache.key !== key) { let d = null; try { d = E.spellPreview(S, c.id, mode); } catch (e) { console.warn("aperçu des sorts", e); } spPrevCache.key = key; spPrevCache.data = d; }
  return spPrevCache.data;
}
function spTips(c, P) {
  const tips = []; if (!P) return tips;
  const eq = c.spells; const N = E.spellSlots(c); const defs = eq.map((x) => E.spellDef(c.cls, x.id));
  const kinds = defs.map((sp) => (sp ? spKindOf(c, sp) : ""));
  const used = new Set(defs.filter(Boolean).map((sp) => sp.pair));
  const cnt = {}; P.rounds.forEach((r) => r.casts.forEach((id) => (cnt[id] = (cnt[id] || 0) + 1)));
  const top = defs.filter((sp, i) => sp && ATK_KINDS.includes(kinds[i])).sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0))[0];
  // 1) attaques jamais choisies
  const idle = eq.map((x, i) => i).filter((i) => defs[i] && ATK_KINDS.includes(kinds[i]) && !P.casted.has(eq[i].id) && (eq[i].cond || "always") === "always");
  if (idle.length && top && P.casted.has(top.id)) tips.push({ ico: defs[idle[0]], txt: `${idle.map((i) => `<b>${h(defs[i].name)}</b>`).join(", ")} ${idle.length > 1 ? "ne sont" : "n'est"} jamais choisi${idle.length > 1 ? "s" : ""} : ${h(top.name)} fait plus de dégâts par PA. Échange ${idle.length > 1 ? "l'un d'eux" : "ce sort"} contre un sort plus utile.`, btn: "Voir", act: `data-act="spsel" data-i="${idle[0]}"` });
  // 2) sorts bloqués par leur condition
  const SAFE = ["self_low", "ally_low", "ally_shield", "no_summon", "always"];
  eq.forEach((x, i) => { if (!defs[i] || P.casted.has(x.id) || SAFE.includes(x.cond || "always")) return; if (x.cond === "boss" && P.mode !== "boss") return;
    tips.push({ ico: defs[i], txt: `<b>${h(defs[i].name)}</b> ne s'est pas lancé : sa condition est « ${h(CONDITIONS[x.cond] || x.cond)} ».`, btn: "Régler", act: `data-act="spsel" data-i="${i}"` }); });
  // 3) PA perdus
  const known = E.knownSpells(c);
  for (const r of P.rounds) {
    if (r.r > P.endRound || (P.end && r.r === P.endRound)) break;
    const left = P.paMax - r.pa; if (left < 2) continue;
    const cand = known.filter((sp) => !used.has(sp.pair) && ATK_KINDS.includes(spKindOf(c, sp)) && E.spellGrade(sp, c.lvl).pa <= left)
      .map((sp) => ({ sp, v: E.spellEstimate(S, c, sp, 0).avg / Math.max(1, E.spellGrade(sp, c.lvl).pa) })).sort((a, b) => b.v - a.v)[0];
    if (!cand) continue;
    const g = E.spellGrade(cand.sp, c.lvl);
    if (eq.length < N) tips.push({ ico: cand.sp, txt: `Tour ${r.r} : <b>${left} PA non utilisés</b>. ${h(cand.sp.name)} (${g.pa} PA) pourrait les utiliser.`, btn: "Ajouter", act: `data-act="spg" data-id="${cand.sp.id}"` });
    else if (idle.length) tips.push({ ico: cand.sp, txt: `Tour ${r.r} : <b>${left} PA non utilisés</b>. ${h(cand.sp.name)} (${g.pa} PA) pourrait remplacer ${h(defs[idle[0]].name)}, jamais choisi.`, btn: "Remplacer", act: `data-act="spput" data-id="${cand.sp.id}" data-i="${idle[0]}"` });
    else tips.push({ ico: cand.sp, txt: `Tour ${r.r} : <b>${left} PA non utilisés</b>. Un sort à ${g.pa} PA comme ${h(cand.sp.name)} pourrait les remplir.` });
    break;
  }
  // 4) éléments qui ne profitent pas du profil
  const pel = c.autoStat && STATS[c.autoStat] && STATS[c.autoStat].el;
  if (pel && pel !== "n") {
    const off = eq.map((x, i) => i).filter((i) => defs[i] && ATK_KINDS.includes(kinds[i]) && defs[i].el && defs[i].el !== "best" && defs[i].el !== pel && defs[i].el !== "n");
    if (off.length) {
      const sw = off.map((i) => ({ i, o: CLASSES[c.cls].spells.find((s) => s.pair === defs[i].pair && s.id !== defs[i].id && s.lvl <= c.lvl && (s.el === pel || s.el === "best")) })).find((x) => x.o);
      tips.push({ ico: sw ? sw.o : defs[off[0]], txt: `${off.length} sort${off.length > 1 ? "s" : ""} ${[...new Set(off.map((i) => ELEMENTS[defs[i].el].name))].join(" / ")} ne profite${off.length > 1 ? "nt" : ""} pas de ton profil ${h(STATS[c.autoStat].name)}.${sw ? ` La variante de ${h(defs[sw.i].name)}, ${h(sw.o.name)}, est ${h(ELEMENTS[sw.o.el === "best" ? pel : sw.o.el].name)}.` : ""}`, btn: sw ? "Échanger" : "Voir", act: sw ? `data-act="spg" data-id="${sw.o.id}"` : `data-act="spsel" data-i="${off[0]}"` });
    }
  }
  return tips.slice(0, 4);
}
function spPreviewHtml(c) {
  const P = spPreviewOf(c); const mode = ui.spPrevMode || "hunt";
  const head = `<div class="phead"><h2>Ce que fera ton héros</h2><span class="spchips">${[["hunt", "Chasse"], ["boss", "Boss"]].map(([k, n]) => `<button class="spc ${mode === k ? "on" : ""}" data-act="spprev" data-k="${k}">${n}</button>`).join("")}</span></div>`;
  if (!P) return `${head}<div class="pad"><p class="small muted">Aperçu indisponible pour ce héros.</p></div>`;
  const team = E.team(S); const withTeam = c.inTeam && !c.job && team.length > 1;
  const rows = P.rounds.filter((r) => r.r <= P.endRound).map((r) => `<div class="sptn"><span class="tn">Tour ${r.r}</span><div class="casts">${r.casts.map((id) => { const sp = E.spellDef(c.cls, id); return sp ? `<span class="spcast" data-tip="${h(sp.name)}">${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : "✦"}<span>${h(sp.name)}</span></span>` : ""; }).join("") || `<span class="small muted">rien à lancer</span>`}
    <span class="pips" data-tip="${r.pa}/${P.paMax} PA utilisés">${Array.from({ length: Math.min(P.paMax, 14) }, (_, i) => `<i class="${i < r.pa ? "" : "off"}"></i>`).join("")}</span></div><span class="tot">${r.dmg ? `≈ ${fmt(r.dmg)}` : ""}</span></div>`).join("");
  const cnt = {}; c.spells.forEach((x) => { const sp = E.spellDef(c.cls, x.id); if (sp && ATK_KINDS.includes(spKindOf(c, sp))) { const el = sp.el && sp.el !== "best" ? sp.el : "n"; cnt[el] = (cnt[el] || 0) + 1; } });
  const nAtk = Object.values(cnt).reduce((a, b) => a + b, 0) || 1;
  const tips = spTips(c, P);
  return `${head}<div class="pad stack" style="gap:8px">
    <p class="xs muted">Contre ${h(P.label)} (${P.mons} monstre${P.mons > 1 ? "s" : ""})${withTeam ? ", avec ton équipe" : ", seul"} · ${P.paMax} PA par tour · joué par le vrai moteur de combat, dégâts moyens sur 3 combats.</p>
    <div class="spturns">${rows}</div>
    ${P.end ? `<p class="xs ${P.end === "win" ? "" : "muted"}">${P.end === "win" ? `Combat gagné au tour ${P.endRound}.` : `Combat perdu au tour ${P.endRound}.`}</p>` : ""}
    <div class="spsum"><span>≈ <b>${fmt(P.total)}</b> dégâts sur ${P.endRound} tour${P.endRound > 1 ? "s" : ""}</span><span class="elbar" data-tip="Éléments des sorts d'attaque équipés">${Object.entries(cnt).map(([e, n]) => `<i style="width:${(n / nAtk) * 100}%;background:var(--el-${e})"></i>`).join("")}</span><span class="xs muted">${Object.entries(cnt).map(([e, n]) => `${ELEMENTS[e].name} ${n}`).join(" · ")}</span></div>
    <div class="splab">Conseils</div>
    <div class="sptips">${tips.length ? tips.map((t) => `<div class="sptip">${t.ico && spellImg(t.ico.name) ? `<img src="${spellImg(t.ico.name)}" alt="">` : ""}<span class="grow small">${t.txt}</span>${t.btn ? `<button class="btn sm" ${t.act}>${t.btn}</button>` : ""}</div>`).join("") : `<div class="sptip ok"><span class="grow small">Rien à signaler : tous les sorts servent et les PA sont bien utilisés.</span></div>`}</div>
  </div>`;
}
/* « Ranger au mieux » : l'IA lance les sorts de soutien dans l'ordre de la barre, puis la meilleure attaque par PA ;
   on essaie donc tous les ordres des sorts de soutien (5 au plus) et on garde celui qui fait le plus de dégâts dans l'aperçu */
function spOptimize(c) {
  const mode = ui.spPrevMode || "hunt"; const eq = c.spells.map((x) => ({ ...x }));
  const isSup = (x) => { const sp = E.spellDef(c.cls, x.id); return sp && !ATK_KINDS.includes(spKindOf(c, sp)); };
  const sup = eq.filter(isSup).slice(0, 5); const rest = eq.filter((x) => !sup.includes(x));
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p))));
  const score = (order) => { const P = E.spellPreview(S, c.id, mode, order, 2); return P ? P.total : 0; };
  const cur = score(c.spells); let best = null, bestV = cur;
  perms(sup).forEach((p) => { const order = p.concat(rest); const v = score(order); if (v > bestV * 1.01) { bestV = v; best = order; } });
  return { best, gain: cur > 0 ? Math.round(((bestV - cur) / cur) * 100) : 0 };
}
function charSpellsView(c) {
  const eq = c.spells; const N = E.spellSlots(c);
  if ((ui.spSel || 0) >= Math.max(eq.length, 1) && (ui.spSel || 0) >= N) ui.spSel = 0;
  const sel = ui.spSel || 0;
  const zopts = zoneOptions(); const zname = (k) => (zopts.find((o) => o[0] === k) || [k, k])[1];
  // stratégies en onglets
  const ap = c.activePreset; const p = ap !== null && ap !== undefined ? c.presets[ap] : null;
  const free = c.presets.findIndex((x, i) => !x && i < E.MAX_PRESETS); const freeIdx = free >= 0 ? free : c.presets.length < E.MAX_PRESETS ? c.presets.length : -1;
  const zones = p ? Object.entries(c.zonePreset || {}).filter(([, v]) => v === ap).map(([k]) => k) : [];
  const strat = `<div class="row" style="gap:6px">${Array.from({ length: E.MAX_PRESETS }, (_, i) => c.presets[i] ? `<button class="spc big ${ap === i ? "on" : ""}" data-act="pload" data-i="${i}">${h(c.presets[i].name)}</button>` : "").join("")}
      ${freeIdx >= 0 ? `<button class="spc big" data-act="psave" data-i="${freeIdx}" title="Enregistre les sorts actuels comme nouvelle stratégie">+ Nouvelle stratégie</button>` : ""}
      ${!p && c.presets.some(Boolean) ? `<span class="xs muted">sorts modifiés : aucune stratégie active</span>` : ""}</div>
    ${p ? `<div class="row" style="gap:6px"><span class="xs muted">« ${h(p.name)} » :</span><button class="btn sm" data-act="psave" data-i="${ap}">Écraser avec les sorts actuels</button><button class="btn sm" data-act="pdel" data-i="${ap}">Supprimer</button>
      <select class="small" data-act="pzone" data-i="${ap}" aria-label="Activer automatiquement dans une zone"><option value="">Charger auto. dans…</option>${zopts.map(([v, n]) => `<option value="${h(v)}">${h(n)}</option>`).join("")}</select>
      ${zones.map((z) => `<span class="tag soft">${h(zname(z))} <span data-act="pzonedel" data-z="${h(z)}" style="cursor:pointer" aria-label="Retirer">✕</span></span>`).join("")}</div>` : ""}`;
  const rec = CLASSES[c.cls].elRec;
  const setup = `<div class="row" style="gap:6px 16px">
    <label class="row small" style="gap:6px" data-tip="Les points de caractéristiques vont dans cet élément ; la sélection automatique des sorts et les flèches d'équipement le privilégient."><span class="muted">Profil :</span><select data-act="autostat" data-id="${c.id}">${["fo", "ine", "cha", "age"].map((k) => `<option value="${k}" ${c.autoStat === k ? "selected" : ""}>${STATS[k].name} (${ELEMENTS[STATS[k].el].name})${k === rec ? " ★ conseillé" : ""}</option>`).join("")}<option value="vit" ${c.autoStat === "vit" ? "selected" : ""}>Vitalité (tank)</option><option value="" ${!c.autoStat ? "selected" : ""}>Manuel</option></select></label>
    <label class="row small" style="gap:6px"><input type="checkbox" data-act="spauto" ${c.spellsManual ? "" : "checked"}> Sorts automatiques à chaque niveau</label>
    <label class="row small" style="gap:6px"><input type="checkbox" data-act="chaloff" ${c.chalOff ? "checked" : ""}> Ignorer les challenges</label></div>`;
  // barre
  const slots = Array.from({ length: 8 }, (_, i) => {
    if (i >= N) return `<div class="spslotw"><div class="spslot lock" data-tip="Case débloquée au niveau ${i === 6 ? 50 : 100}">🔒</div><span class="spcl">niv. ${i === 6 ? 50 : 100}</span></div>`;
    const x = eq[i]; const sp = x && E.spellDef(c.cls, x.id);
    if (!sp) return `<div class="spslotw"><button class="spslot empty ${sel === i ? "sel" : ""}" data-act="spsel" data-i="${i}" data-spslot="${i}" aria-label="Case ${i + 1} vide">+</button><span class="spcl"></span></div>`;
    const g = E.spellGrade(sp, c.lvl);
    return `<div class="spslotw"><button class="spslot ${sel === i ? "sel" : ""}" style="--c:${elVar(spEl(sp))}" data-act="spsel" data-i="${i}" data-spslot="${i}" data-spdrag="s${i}" draggable="true" data-tip="${h(spTip(c, sp))}" aria-label="${h(sp.name)}"><span class="n">${i + 1}</span>${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : "✦"}<span class="pa">${g.pa}</span></button><span class="spcl ${COND_SHORT[x.cond] ? "on" : ""}">${COND_SHORT[x.cond] !== undefined ? COND_SHORT[x.cond] : h(CONDITIONS[x.cond] || "")}</span></div>`;
  }).join("");
  // grimoire par paires
  const F = ui.spFilt || "all"; const eqIds = new Set(eq.map((x) => x.id));
  const pairs = {}; CLASSES[c.cls].spells.forEach((sp) => { (pairs[sp.pair] = pairs[sp.pair] || [])[sp.variant ? 1 : 0] = sp; });
  const isAtk = (sp) => ["dmg", "aoe", "drain", "dot"].includes(spKindOf(c, sp));
  const one = (sp, has) => { const ok = sp.lvl <= c.lvl;
    return `<button class="gsp ${eqIds.has(sp.id) ? "on" : has ? "off" : ""} ${ok ? "" : "lock"}" style="--c:${elVar(spEl(sp))}" data-act="spg" data-id="${sp.id}" ${ok ? `data-spdrag="g${sp.id}" draggable="true"` : ""} data-tip="${h(spTip(c, sp))}" aria-label="${h(sp.name)}">${spellImg(sp.name) ? `<img src="${spellImg(sp.name)}" alt="">` : "✦"}${ok ? "" : `<span class="lv">niv. ${sp.lvl}</span>`}</button>`; };
  const grim = Object.values(pairs).filter((pr) => pr[0] || pr[1]).sort((a, b) => (a[0] || a[1]).lvl - (b[0] || b[1]).lvl)
    .filter((pr) => F === "all" || pr.some((sp) => sp && (F === "atk" ? isAtk(sp) : !isAtk(sp))))
    .map((pr) => { const list = pr.filter(Boolean); const has = list.some((sp) => eqIds.has(sp.id));
      return `<div class="sppt ${has ? "has" : ""}"><div class="two">${list.map((sp) => one(sp, has)).join(`<span class="or">ou</span>`)}</div><div class="nm">${list.map((sp) => h(sp.name)).join(" / ")}</div></div>`; }).join("");
  return `<div class="stack spells2">
  <div class="panel"><div class="phead"><h2>Stratégies</h2><span class="xs muted">${h(CLASSES[c.cls].signature || "")}</span></div><div class="pad stack" style="gap:8px">${strat}${setup}</div></div>
  <div class="spgrid">
    <div class="panel spbarp"><div class="phead"><h2>Barre de sorts</h2><span class="muted xs">${eq.length}/${N}${N < 8 ? ` · ${N === 6 ? "7e au niv. 50" : "8e au niv. 100"}` : ""}</span><span class="grow"></span>${ui.spUndo && ui.spUndo.cid === c.id ? `<button class="btn sm" data-act="spundo">↶ Annuler</button>` : ""}<button class="btn sm" data-act="spopt" data-tip="Essaie tous les ordres des sorts de soutien et garde celui qui fait le plus de dégâts dans l'aperçu">✨ Ranger au mieux</button></div>
      <div class="pad stack" style="gap:8px"><div class="spbar">${slots}</div>
      <p class="xs muted">En combat, le héros lance d'abord ses invocations, protections et soins (de gauche à droite, si leur condition est remplie), puis l'attaque qui fait le plus de dégâts par PA.${canHover ? " Glisse un sort pour changer sa place." : ""}</p></div></div>
    <div class="panel spdetp"><div class="pad">${spDetailHtml(c)}</div></div>
    <div class="panel spprevp">${spPreviewHtml(c)}</div>
    <div class="panel spgrimp"><div class="phead"><h2>Grimoire</h2><span class="spchips">${[["all", "Tous"], ["atk", "Dégâts"], ["sup", "Soutien"]].map(([k, n]) => `<button class="spc ${F === k ? "on" : ""}" data-act="spfilt" data-k="${k}">${n}</button>`).join("")}</span></div>
      <div class="pad stack" style="gap:8px"><div class="sppairs">${grim}</div>
      <p class="xs muted">${canHover ? "Glisse un sort sur une case de la barre, ou clique dessus pour l'ajouter. Survole un sort pour lire sa fiche." : "Touche un sort pour l'ajouter à la barre ; si elle est pleine, il remplace le sort sélectionné."} Un seul sort par paire : la variante remplace le sort de base.</p></div></div>
  </div></div>`;
}

/* ---------- INVENTAIRE ---------- */

function invGroups() {
  const q = (ui.invSearch || "").trim().toLowerCase(); const filt = ui.slotFilter;
  const groups = new Map();
  Object.values(S.items).forEach((it) => {
    const T = ITEMS[it.tpl];
    if (filt === "radiant" ? !it.radiant : filt && filt.startsWith("r:") ? E.rarityOf(it.tpl) !== filt.slice(2) : filt !== "all" && T.slot !== filt) return;
    if (q && !T.name.toLowerCase().includes(q)) return;
    const g = groups.get(it.tpl) || { tpl: it.tpl, items: [] }; g.items.push(it); groups.set(it.tpl, g);
  });
  const arr = [...groups.values()];
  arr.forEach((g) => { g.best = Math.max(...g.items.map((x) => E.itemQuality(x))); g.rad = g.items.some((x) => x.radiant); g.lock = g.items.some((x) => x.locked); g.eq = g.items.some((x) => E.equippedBy(S, x.uid)); });
  const sort = ui.invSort || "lvl";
  arr.sort((a, b) => (b.rad - a.rad) || (sort === "lvl" ? ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl : sort === "rar" ? rar(b.tpl).rank - rar(a.tpl).rank || ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl : sort === "jet" ? b.best - a.best : sort === "count" ? b.items.length - a.items.length : ITEMS[a.tpl].name.localeCompare(ITEMS[b.tpl].name, "fr")));
  return arr;
}
function invDetail(tpl) {
  const T = ITEMS[tpl]; if (!T) return "";
  const copies = Object.values(S.items).filter((x) => x.tpl === tpl).sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || E.itemQuality(b) - E.itemQuality(a));
  if (!copies.length) return "";
  return `<div class="panel invdetail"><div class="phead"><div class="row">${itemIcon(copies[0])}<div><h2 class="iname ${rarCls(tpl)}">${h(T.name)}</h2><div class="xs muted">${rarTag(tpl)} niv. ${T.lvl} · ${SLOTS[T.slot === "anneau" ? "anneau1" : T.slot === "dofus" ? "dofus1" : T.slot]}${T.set && SETS[T.set] ? ` · ${h(SETS[T.set].name)}` : ""}</div></div></div><button class="btn sm" data-act="invsel" data-tpl="">✕</button></div>
    <div class="pad xs">${tplStatsHtml(T)}${T.set ? setBlock(T.set, ui.cid && char(ui.cid) ? E.setCounts(S, char(ui.cid))[T.set] || 0 : undefined) : ""}
      ${ui.cid && char(ui.cid) && T.lvl <= char(ui.cid).lvl ? `<div class="row" style="margin-top:6px">${miniDoll(char(ui.cid), T.slot)}</div>` : ""}</div>
    <div class="list">${copies.map((it) => { const by = E.equippedBy(S, it.uid);
      return `<div class="li ${it.radiant ? "radiant" : ""}" style="align-items:flex-start"><span class="grow"><b class="num">Jet ${Math.round(E.itemQuality(it) * 100)} %</b>${it.radiant ? ` <span class="tag" style="background:linear-gradient(90deg,#ffb347,#ff5fbf,#8a7dff);color:#fff">✦ +${it.radiant} %</span>` : ""}${by ? ` <span class="tag good">${h(by.name)}</span>` : ""}<br><span class="small">${itemStatsHtml(it)}</span></span>
        <span class="row" style="gap:4px;justify-content:flex-end;max-width:170px"><button class="btn sm" data-act="givesheet" data-uid="${it.uid}">Équiper</button><button class="btn sm" data-act="fmgo" data-uid="${it.uid}" title="Forgemagie">${IC("forge")}</button>
          <button class="btn sm" data-act="lock" data-uid="${it.uid}" title="${it.locked ? "Retirer le cadenas" : "Protéger de la vente et du brisage"}">${it.locked ? G("lock") : G("unlock")}</button>
          ${by || it.locked ? "" : `<button class="btn sm" data-act="sellitem" data-uid="${it.uid}">Vendre</button><button class="btn sm" data-act="break" data-uid="${it.uid}">Briser</button>`}</span></div>`; }).join("")}</div></div>`;
}
/* mini-silhouette : emplacement de l'objet sélectionné en surbrillance */
function miniDoll(c, slot) {
  const want = slot === "anneau" ? ["anneau1", "anneau2"] : slot === "dofus" ? D.DOFUS_SLOTS : [slot];
  const all = ["coiffe", "amulette", "anneau1", "anneau2", "cape", "ceinture", "bottes", "bouclier", "arme"];
  return `<span class="xs muted">Pour ${h(c.name)} :</span><span class="row" style="gap:3px">${all.concat(slot === "dofus" ? D.DOFUS_SLOTS : []).map((s) => { const it = S.items[c.equip[s]]; const on = want.includes(s);
    return `<span class="dslot ${on ? "hl" : ""} ${it ? "filled" : ""}" style="width:30px;height:30px;border-radius:8px;cursor:default" data-tip="${h(SLOTS[s])}${it ? " : " + h(ITEMS[it.tpl].name) : " : vide"}">${it ? `<img src="${itemImg(it.tpl)}" style="width:24px;height:24px" alt="">` : ""}</span>`; }).join("")}</span>`;
}
/* ---------- Sac : ressources (v2.7) ---------- */
function resRarity(n) { const L = (resIndex().src[n] || []).filter((x) => x.m); if (!L.length) return n === E.RARE_COMPONENT ? "epique" : ""; const best = Math.max(...L.map((x) => (MONSTERS[x.m].boss || MONSTERS[x.m].archiOf ? 0 : x.p))); return best === 0 ? "epique" : best < 1 ? "epique" : best < 5 ? "rare" : ""; }
const RAR = { rare: ["Rare", "#5fbfff"], epique: ["Épique", "#c77dff"] };
function usefulNow() {
  const set = new Set(); const A = E.almanax(S); if (!A.done) set.add(A.res);
  for (const j in GATHER_JOBS) if (E.toolLvl(S, j) < E.TOOL_MAX) E.toolCost(S, j).ing.forEach(([r]) => set.add(r));
  S.shop.forEach((e) => shopIng(e).forEach(([r]) => set.add(r)));
  Object.entries(DUNGEONS).forEach(([id, d]) => { if (E.dungeonUnlocked(S, id) && SPECIAL_CRAFTS[d.key]) SPECIAL_CRAFTS[d.key].ing.forEach(([r]) => set.add(r)); });
  return set;
}
function resTabHtml() {
  const IX = resIndex(); const cats = D.RES_CATS; const all = Object.entries(S.res).filter(([, q]) => q > 0);
  if (!ui.newResDone) { ui.newRes = new Set(all.map(([n]) => n).filter((n) => !S.resSeen[n])); all.forEach(([n]) => (S.resSeen[n] = 1)); ui.newResDone = true; }
  const cnt = {}; all.forEach(([n]) => { const c = D.RES_CAT_OF(n); cnt[c] = (cnt[c] || 0) + 1; });
  const cat = ui.resCat || "all"; const q = (ui.resQ || "").trim().toLowerCase(); const f = ui.resF || "all"; const now = f === "now" ? usefulNow() : null;
  let list = all.filter(([n]) => (cat === "all" || D.RES_CAT_OF(n) === cat) && (!q || n.toLowerCase().includes(q)));
  if (f === "recipe") list = list.filter(([n]) => IX.use[n]);
  if (f === "now") list = list.filter(([n]) => now.has(n));
  if (f === "unused") list = list.filter(([n]) => !IX.use[n] && !E.isKey(n) && n !== E.RARE_COMPONENT);
  if (f === "new") list = list.filter(([n]) => ui.newRes.has(n));
  if (f === "fav") list = list.filter(([n]) => S.resFav[n]);
  const so = ui.resSort || "name"; const lv = (n) => (RES[n] && RES[n].lvl) || 0;
  list.sort((a, b) => (S.resFav[b[0]] ? 1 : 0) - (S.resFav[a[0]] ? 1 : 0) || (so === "qty" ? b[1] - a[1] : so === "lvl" ? lv(b[0]) - lv(a[0]) : so === "value" ? E.resPrice(b[0]) * b[1] - E.resPrice(a[0]) * a[1] : so === "recent" ? (S.resT[b[0]] || 0) - (S.resT[a[0]] || 0) : a[0].localeCompare(b[0], "fr")));
  const unused = all.filter(([n]) => !IX.use[n] && !E.isKey(n) && n !== E.RARE_COMPONENT && !S.resFav[n] && E.resPrice(n));
  const unusedVal = unused.reduce((a, [n, qq]) => a + E.resPrice(n) * qq, 0);
  const picked = ui.resPicked || new Set(); const pickVal = [...picked].reduce((a, n) => a + E.resPrice(n) * (S.res[n] || 0), 0);
  const detail = ui.resSel && S.res[ui.resSel] ? resDetail(ui.resSel) : "";
  const tile = ([n, qq]) => { const r = resRarity(n); const sel = picked.has(n);
    return ui.resView === "list"
      ? `<div class="li ${ui.resSel === n ? "selrow" : ""}">${ui.resPick ? `<input type="checkbox" data-act="respick" data-n="${h(n)}" ${sel ? "checked" : ""}>` : ""}${im(resImg(n), "ico", n)}<span class="grow"><span class="name">${S.resFav[n] ? "★ " : ""}${h(n)}</span> ${r ? `<span class="tag" style="background:${RAR[r][1]};color:#0e0b14">${RAR[r][0]}</span>` : ""}${ui.newRes.has(n) ? ` <span class="tag good">Nouveau</span>` : ""}<br><span class="xs muted">${h(cats.find((c) => c.id === D.RES_CAT_OF(n)).name)} · ${fmt(E.resPrice(n))} k l'unité</span></span><span class="num">${fmt(qq)}</span><button class="btn sm" data-act="ressel" data-n="${h(n)}">Détails</button></div>`
      : `<button class="itile rtile ${r} ${ui.resSel === n ? "on" : ""} ${sel ? "picked" : ""}" data-act="${ui.resPick ? "respick" : "ressel"}" data-n="${h(n)}" data-tip="${h(`${n} ×${fmt(qq)} · ${fmt(E.resPrice(n))} k l'unité${r ? " · " + RAR[r][0] : ""}`)}">${im(resImg(n), "", n)}<span class="icount">${qq >= 1000 ? Math.floor(qq / 1000) + "k" : qq}</span>${S.resFav[n] ? `<span class="ilock">★</span>` : ""}${ui.newRes.has(n) ? `<span class="inew">●</span>` : ""}</button>`; };
  return `<div class="row resbar">
      <div class="catchips"><button data-act="rescat" data-v="all" aria-pressed="${cat === "all"}">Tout <b>${all.length}</b></button>${cats.filter((c) => cnt[c.id]).map((c) => `<button data-act="rescat" data-v="${c.id}" aria-pressed="${cat === c.id}">${catIco(c)} ${h(c.name)} <b>${cnt[c.id]}</b></button>`).join("")}</div></div>
    <div class="row invbar"><input type="text" id="resSearch" data-act="ressearch" placeholder="Rechercher une ressource…" value="${h(ui.resQ || "")}">
      <select data-act="resf">${[["all", "Toutes"], ["recipe", "Utiles pour une recette"], ["now", "Utiles maintenant"], ["unused", "Inutilisées"], ["new", "Nouvelles"], ["fav", "Favorites"]].map(([v, n]) => `<option value="${v}" ${f === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-act="ressort">${[["name", "Nom"], ["qty", "Quantité"], ["lvl", "Niveau"], ["value", "Valeur totale"], ["recent", "Récentes"]].map(([v, n]) => `<option value="${v}" ${so === v ? "selected" : ""}>Tri : ${n}</option>`).join("")}</select>
      <span class="seg">${[["grid", "▦"], ["list", "☰"]].map(([v, n]) => `<button data-act="resview" data-v="${v}" aria-pressed="${(ui.resView || "grid") === v}" title="${v === "grid" ? "Grille" : "Liste"}">${n}</button>`).join("")}</span>
      <button class="btn sm ${ui.resPick ? "primary" : ""}" data-act="respickmode">${ui.resPick ? "Fin de la sélection" : "Sélection multiple"}</button></div>
    ${ui.resPick ? `<div class="awaitbar" style="margin:0">${picked.size} ressource${picked.size > 1 ? "s" : ""} sélectionnée${picked.size > 1 ? "s" : ""} <button class="btn sm danger" data-act="sellpicked" ${picked.size ? "" : "disabled"}>Vendre la sélection · ${fmt(pickVal)} k</button></div>` : ""}
    <div class="row small">${unused.length ? (ui.confirm === "sellunused" ? `<span>Vendre ${unused.length} ressources inutilisées (hors favorites) pour ${fmt(unusedVal)} kamas ?</span><button class="btn sm danger" data-act="sellunused">Confirmer</button><button class="btn sm" data-act="cancel">Annuler</button>` : `<button class="btn sm" data-act="asksellunused">Vendre les ressources inutilisées · ${fmt(unusedVal)} k</button>`) : ""}<span class="xs muted">Les ressources sont partagées entre tous vos héros.</span></div>
    <div class="invlayout ${detail ? "withdetail" : ""}">${detail}
      ${ui.resView === "list" ? `<section class="panel"><div class="list">${list.map(tile).join("") || `<div class="empty">Aucune ressource.</div>`}</div></section>` : `<div class="invgrid">${list.map(tile).join("") || `<div class="empty" style="grid-column:1/-1">Aucune ressource.</div>`}</div>`}</div>`;
}
function resDetail(n) {
  const IX = resIndex(); const qq = S.res[n] || 0; const r = resRarity(n); const src = IX.src[n] || []; const use = IX.use[n] || [];
  const A = E.almanax(S);
  const srcHtml = src.slice(0, 8).map((x) => x.job ? `<div class="li">${im(jobImg(x.job), "joblogo sm", GATHER_JOBS[x.job].name)}<span class="grow">${GATHER_JOBS[x.job].name} niv. ${x.lvl}</span><button class="btn sm" data-act="gathersheet" data-job="${x.job}">${IC("pioche")} Récolter</button></div>`
    : (() => { const sb = subOfMon(x.m); const isSub = sb && typeof sb !== "string"; return `<div class="li">${im(imgM(x.m), "ico", MONSTERS[x.m].name)}<span class="grow">${S.bestiary[x.m] ? h(MONSTERS[x.m].name) : "???"} <span class="xs muted">${sb ? h(isSub ? sb.name : DUNGEONS[sb].name) : ""}</span></span><span class="pct">${E.resRate(x.p).toFixed(1).replace(".", ",")} %</span>${isSub ? `<button class="btn sm" data-act="zoneview" data-id="${sb.id}" data-gotab="world">Y aller</button>` : ""}</div>`; })()).join("");
  const useHtml = use.slice(0, 10).map((u) => u.tpl ? `<div class="li"><span class="icobox">${im(itemImg(u.tpl), "", ITEMS[u.tpl].name)}</span><span class="grow">${h(ITEMS[u.tpl].name)} <span class="xs muted">niv. ${ITEMS[u.tpl].lvl} · ${u.q} requis</span></span>${E.canCraft(S, ITEMS[u.tpl].craft) ? `<span class="tag good">fabricable</span>` : ""}</div>`
    : u.special ? `<div class="li"><span class="grow">${IC("cle")} ${h(u.special)} <span class="xs muted">${u.q} requis</span></span></div>` : `<div class="li"><span class="grow">${IC("metiers")} ${h(E.TOOL_NAMES[u.tool])} ${u.L} <span class="xs muted">(${GATHER_JOBS[u.tool].name}) · ${u.q} requis</span></span></div>`).join("");
  return `<div class="panel invdetail"><div class="phead"><div class="row">${im(resImg(n), "ico lg", n)}<div><h2>${h(n)}</h2><div class="xs muted">${h(D.RES_CATS.find((c) => c.id === D.RES_CAT_OF(n)).name)} · ${fmt(qq)} en stock · ${fmt(E.resPrice(n))} k l'unité ${r ? `· <b style="color:${RAR[r][1]}">${RAR[r][0]}</b>` : ""}</div></div></div><button class="btn sm" data-act="ressel" data-n="">✕</button></div>
    <div class="pad stack" style="gap:8px">
      <div class="row">${E.resPrice(n) ? `<button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="1">Vendre 1</button><button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="10">Vendre 10</button><button class="btn sm" data-act="sellres" data-n="${h(n)}" data-q="${qq}">Tout · ${fmt(E.resPrice(n) * qq)} k</button>` : ""}<button class="btn sm" data-act="resfav" data-n="${h(n)}">${S.resFav[n] ? "★ Favori" : "☆ Épingler"}</button></div>
      ${E.resPrice(n) ? `<label class="row small">Garder au maximum <input type="number" min="0" step="10" data-act="rescap" data-n="${h(n)}" value="${S.resCap[n] !== undefined ? S.resCap[n] : ""}" placeholder="∞" style="width:90px"> <span class="xs muted">le surplus est vendu automatiquement</span></label>` : ""}
      ${A.res === n && !A.done ? `<div class="tag good">${IC("almanax")} Offrande de l'Almanax du jour (${A.qty})</div>` : ""}
      <h3 class="sec">D'où elle vient</h3><div class="list">${srcHtml || `<div class="empty">${n === E.RARE_COMPONENT ? "Trouvailles de récolte, coffres et boss." : "Source inconnue."}</div>`}</div>
      <h3 class="sec">À quoi elle sert</h3><div class="list">${useHtml || `<div class="empty">N'entre dans aucune recette du jeu : vous pouvez la vendre.</div>`}${use.length > 10 ? `<div class="empty">… et ${use.length - 10} autres recettes.</div>` : ""}</div>
    </div></div>`;
}
function autoRulesHtml() {
  const A = S.settings.auto;
  return `<details class="panel" ${ui.autoOpen ? "open" : ""}><summary class="pad" style="cursor:pointer;font-weight:800" data-act="autotoggle">${G("gear")} Règles automatiques ${A.action !== "none" ? `<span class="tag good">${A.action === "sell" ? "Vente" : "Brisage"} si jet &lt; ${A.q} %</span>` : `<span class="tag soft">désactivées</span>`}</summary>
    <div class="pad stack" style="padding-top:0;gap:8px">
      <p class="note">S'applique aux objets lâchés par les monstres. Les objets Rayonnants, protégés par cadenas et équipés ne sont jamais touchés.</p>
      <div class="row"><label class="row small">Action <select data-act="autoaction"><option value="none" ${A.action === "none" ? "selected" : ""}>Aucune</option><option value="sell" ${A.action === "sell" ? "selected" : ""}>Vendre</option><option value="break" ${A.action === "break" ? "selected" : ""}>Briser (runes)</option></select></label>
        <label class="row small">si le jet est inférieur à <input type="number" min="0" max="100" step="5" data-act="autoq" value="${A.q}" style="width:70px"> %</label>
        <label class="row small"><input type="checkbox" data-act="autosets" ${A.keepSets ? "checked" : ""}> garder les objets de panoplie</label></div>
      <label class="row small">Doublons <select data-act="autorecycle"><option value="" ${!A.recycle ? "selected" : ""}>garder</option><option value="sell" ${A.recycle === "sell" ? "selected" : ""}>vendre si j'ai déjà mieux ou égal</option><option value="break" ${A.recycle === "break" ? "selected" : ""}>briser si j'ai déjà mieux ou égal</option></select></label>
      <div><button class="btn sm" data-act="autonow">Appliquer maintenant aux objets du sac</button></div></div></details>`;
}
function renderInventory() {
  const items = Object.values(S.items);
  const res = Object.entries(S.res).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const runes = Object.entries(S.runes).sort((a, b) => E.runeInfo(b[0]).weight - E.runeInfo(a[0]).weight);
  let body = "";
  if (ui.inv === "items") {
    const groups = invGroups();
    const detail = ui.invSel && S && Object.values(S.items).some((x) => x.tpl === ui.invSel) ? invDetail(ui.invSel) : "";
    body = `${autoRulesHtml()}
      <div class="row invbar"><input type="text" id="invSearch" data-act="invsearch" placeholder="Rechercher…" value="${h(ui.invSearch || "")}">
        <select data-act="slotfilter" aria-label="Filtrer">${[["all", "Tous"], ["radiant", "✦ Rayonnants"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"], ["bouclier", "Boucliers"], ["dofus", "Trophées"], ...E.RARITIES.map((r) => ["r:" + r.id, "Rareté : " + r.name])].map(([v, n]) => `<option value="${v}" ${ui.slotFilter === v ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select data-act="invsort" aria-label="Trier">${[["lvl", "Niveau"], ["rar", "Rareté"], ["jet", "Meilleur jet"], ["count", "Quantité"], ["name", "Nom"]].map(([v, n]) => `<option value="${v}" ${(ui.invSort || "lvl") === v ? "selected" : ""}>Tri : ${n}</option>`).join("")}</select>
        <span class="muted small num">${items.length}/${E.itemCap(S)} objets · ${groups.length} types</span></div>
      <div class="invlayout ${detail ? "withdetail" : ""}">
        ${detail}
        <div class="invgrid">${groups.map((g) => { const T = ITEMS[g.tpl]; const best = g.items.slice().sort((a, b) => (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0) || E.itemQuality(b) - E.itemQuality(a))[0];
          return `<button class="itile ${rarCls(g.tpl)} ${g.rad ? "radiant" : ""} ${ui.invSel === g.tpl ? "on" : ""}" data-act="invsel" data-tpl="${g.tpl}" data-tipitem="${best.uid}">
            ${im(itemImg(g.tpl), "", T.name)}<span class="ilvl">${T.lvl}</span>${g.items.length > 1 ? `<span class="icount">×${g.items.length}</span>` : ""}${g.lock ? `<span class="ilock">${G("lock")}</span>` : ""}${g.eq ? `<span class="ieq"></span>` : ""}</button>`; }).join("") || `<div class="empty" style="grid-column:1/-1">Aucun objet. Les monstres en lâchent parfois, et les Ateliers permettent d'en fabriquer.</div>`}</div>
      </div>`;
  } else if (ui.inv === "res") {
    body = resTabHtml();
  } else if (ui.inv === "cons") {
    body = `<section class="panel"><div class="pad">${consHtml()}</div></section>`;
  } else if (ui.inv === "sets") {
    body = setsBookHtml();
  } else {
    body = `<section class="panel"><div class="list">${runes.map(([k, q]) => { const i = E.runeInfo(k); return `<div class="li">${sIco(i.stat)}<span class="grow"><span class="name">${E.runeName(k)}</span> <span class="muted xs">+${i.pts} ${STATS[i.stat].name} · poids ${i.weight}</span></span><span class="num">${fmt(q)}</span></div>`; }).join("") || `<div class="empty">Aucune rune. Brisez des objets dans les Ateliers pour en obtenir.</div>`}</div></section>`;
  }
  const nc = Object.values(S.cons || {}).reduce((a, b) => a + b, 0);
  $("#main").innerHTML = `<div class="pagehead"><h1>Inventaire</h1><span class="small muted"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b> kamas</span></div>
    <nav class="subtabs">${[["items", "Équipements"], ["res", "Ressources"], ["cons", `Consommables${nc ? ` (${nc})` : ""}`], ["sets", "Panoplies"], ["runes", "Runes"]].map(([id, n]) => `<button data-act="invtab" data-v="${id}" aria-pressed="${ui.inv === id}">${n}</button>`).join("")}</nav>
    <div class="stack">${body}</div>`;
}
/* 0.1.10.1 : carnet de panoplies */
function srcTxt(x) {
  if (x.k === "craft") return `${G("metiers")} Recette ${h(CRAFT_JOBS[x.job].name)} niv. ${x.lvl}`;
  const M = MONSTERS[x.mon]; const where = [...x.subs.map((sid) => E.SUBS[sid].name), ...x.dgs.map((d) => DUNGEONS[d].name)].slice(0, 2);
  return `${x.k === "boss" ? "Boss" : "Butin"} : ${h(M.name)} (${x.p} %)${where.length ? ` · ${h(where.join(", "))}` : ""}`;
}
function setsBookHtml() {
  const F = ui.setF || (ui.setF = { mode: "known", q: "", cid: null });
  const c = (F.cid && char(F.cid)) || mainHero(); const owned = E.ownedTpls(S); const main = CLASSES[c.cls].main;
  const worn = E.setCounts(S, c);
  let sets = Object.keys(SETS).filter((id) => E.setPieces(id).length);
  if (F.mode === "known") sets = sets.filter((id) => E.setKnown(S, id, owned));
  if (F.mode === "hero") sets = sets.filter((id) => { const L = E.setLvl(id); if (L > c.lvl || L < c.lvl - 40) return false;
    const ks = new Set(E.setPieces(id).flatMap((t) => Object.keys(ITEMS[t].stats))); return ks.has(main) || !["fo", "ine", "cha", "age"].some((k) => ks.has(k)); });
  if (F.q) { const q = F.q.toLowerCase(); sets = sets.filter((id) => SETS[id].name.toLowerCase().includes(q) || E.setPieces(id).some((t) => ITEMS[t].name.toLowerCase().includes(q))); }
  const have = (id) => E.setPieces(id).filter((t) => owned[t]).length;
  sets.sort((a, b) => (worn[b] || 0) - (worn[a] || 0) || have(b) / E.setPieces(b).length - have(a) / E.setPieces(a).length || E.setLvl(b) - E.setLvl(a));
  const total = sets.length; sets = sets.slice(0, 30);
  const card = (id) => { const P = E.setPieces(id); const n = have(id); const miss = P.filter((t) => !owned[t]); const craftMiss = miss.filter((t) => ITEMS[t].craft);
    const tiers = Object.entries(SETS[id].bonus).sort((a, b) => +a[0] - +b[0]);
    return `<section class="panel"><div class="phead"><div><h2>${h(SETS[id].name)}</h2><span class="xs muted">niv. ${E.setLvl(id)} · ${n} / ${P.length} pièces dans le sac${worn[id] ? ` · ${worn[id]} portée${worn[id] > 1 ? "s" : ""} par ${h(c.name)}` : ""}</span></div>
      ${craftMiss.length ? `<button class="btn sm" data-act="setshop" data-id="${id}" data-tip="Ajoute les ${craftMiss.length} pièce${craftMiss.length > 1 ? "s" : ""} fabricable${craftMiss.length > 1 ? "s" : ""} qui manquent à la liste de courses">${G("cart")} Pièces manquantes</button>` : ""}</div>
      <div class="list">${P.map((t) => { const T = ITEMS[t]; const ok = !!owned[t]; const src = ok ? [] : E.itemSources(t).slice(0, 2);
        return `<div class="li" style="align-items:flex-start;${ok ? "" : "opacity:.92"}"><span class="icobox ${rarCls(t)}" style="${ok ? "" : "filter:grayscale(.7)"}">${im(itemImg(t), "", T.name)}</span><span class="grow"><b class="iname ${rarCls(t)}">${h(T.name)}</b> <span class="xs muted">niv. ${T.lvl} · ${h(SLOTS[T.slot === "anneau" ? "anneau1" : T.slot === "dofus" ? "dofus1" : T.slot] || T.slot)}</span>
          <div class="xs ${ok ? "plus" : "muted"}">${ok ? `✓ dans le sac${owned[t] > 1 ? ` (×${owned[t]})` : ""}` : src.map(srcTxt).join("<br>") || "Source inconnue"}</div></span>
          ${!ok && T.craft ? `<button class="btn sm" data-act="shoppin" data-k="tpl" data-id="${t}" data-tip="Ajouter à la liste de courses">${G("cart")}${S.shop.some((e) => e.id === t) ? " ✓" : ""}</button>` : ""}</div>`; }).join("")}</div>
      <div class="pad xs">${tiers.map(([k, b]) => `<div class="${(worn[id] || 0) >= +k ? "plus" : ""}"><b>${k} pièces</b> : ${Object.entries(b).map(([sk, v]) => statLine(sk, v)).join(", ")}</div>`).join("") || `<span class="muted">Aucun bonus de panoplie.</span>`}</div></section>`; };
  return `<p class="note">Chaque panoplie avec ses pièces : celles que vous avez, celles qui manquent et où les obtenir. Les pièces fabricables peuvent aller dans la liste de courses de l'Accueil.</p>
    <div class="row invbar"><input type="text" id="setSearch" data-act="setsearch" placeholder="Rechercher une panoplie ou une pièce…" value="${h(F.q)}">
      <select data-act="setmode" aria-label="Filtre">${[["known", "Panoplies connues"], ["hero", "Adaptées au héros"], ["all", "Toutes"]].map(([v, n]) => `<option value="${v}" ${F.mode === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-act="setcid" aria-label="Héros">${S.chars.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${h(x.name)} (${h(CLASSES[x.cls].name)} ${x.lvl})</option>`).join("")}</select>
      <span class="muted small num">${total} panoplie${total > 1 ? "s" : ""}${total > 30 ? " · 30 premières" : ""}</span></div>
    <div class="stack">${sets.map(card).join("") || `<div class="empty">Aucune panoplie ici. Essayez le filtre « Toutes ».</div>`}</div>`;
}
/* ---------- infobulles ---------- */
function tipItemHtml(uid) {
  const it = S.items[uid]; if (!it) return "";
  const T = ITEMS[it.tpl]; const c = ui.cid ? char(ui.cid) : S.chars[0];
  let cmp = "";
  if (c && T.lvl <= c.lvl && !E.equippedBy(S, uid)) { const slot = E.slotFor(c, it); cmp = `<div class="tipcmp">Pour ${h(c.name)} : ${deltaHtml(c, slot, uid)}</div>`; }
  const worn = T.set && c ? E.setCounts(S, c)[T.set] || 0 : undefined;
  return `<b class="iname ${rarCls(it.tpl)}">${h(T.name)}</b> ${rarTag(it.tpl)} <span class="muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${it.fm ? ` · forgemagé ×${it.fm}` : ""}</span>${it.radiant ? ` <b style="color:var(--gold)">✦ +${it.radiant} %</b>` : ""}<div class="tipstats">${itemStatsHtml(it)}</div>${T.set ? setBlock(T.set, worn) : ""}${cmp}`;
}
let tipEl = null;
function showTip(target) {
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tooltip"; document.body.appendChild(tipEl); }
  const html = target.dataset.tipitem ? tipItemHtml(+target.dataset.tipitem) : h(target.dataset.tip);
  if (!html) return hideTip();
  tipEl.innerHTML = html; tipEl.style.display = "block";
  const r = target.getBoundingClientRect(); const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2; x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  let y = r.top - hh - 8; if (y < 8) y = r.bottom + 8;
  tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
}
function hideTip() { if (tipEl) tipEl.style.display = "none"; }
const canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
document.addEventListener("mouseover", (ev) => { if (!canHover || !S) return; const t = ev.target.closest("[data-tip],[data-tipitem]"); if (t) showTip(t); else hideTip(); });
document.addEventListener("scroll", hideTip, true);

/* ---------- ATELIERS ---------- */
function ingHtml(ing, mult = 1) {
  return `<div class="ing">${ing.map(([r, q]) => { const have = S.res[r] || 0; return `<span class="${have >= q * mult ? "ok" : "ko"}" title="${h(r)}">${im(resImg(r), "", r)}${h(r)} <b class="num">${fmt(have)}/${q * mult}</b></span>`; }).join("")}</div>`;
}
function craftHtml() {
  let body = "";
    const job = ui.craftJob; const J = S.crafts[job] || { lvl: 1, xp: 0 }; const q = ui.craftSearch.trim().toLowerCase();
    let recipes = job === "bricoleur"
      ? Object.entries(SPECIAL_CRAFTS).filter(([, R]) => !(R.idol && E.idolOwned(S, R.idol))).map(([n, R]) => ({ special: n, name: n, lvl: R.lvl, ing: R.ing, req: R.lvl }))
      : Object.entries(ITEMS).filter(([, T]) => T.craft && T.craft.job === job).map(([id, T]) => ({ tpl: id, name: T.name, lvl: T.lvl, ing: T.craft.ing, req: E.craftReq(id), T })).sort((a, b) => a.lvl - b.lvl);
    if (q) recipes = recipes.filter((r) => r.name.toLowerCase().includes(q));
    if (ui.craftOnly) recipes = recipes.filter((r) => E.canCraft(S, { ing: r.ing }) && J.lvl >= r.req);
    const total = recipes.length; recipes = recipes.slice(0, 80);
    body = `<nav class="subtabs" style="margin:0">${Object.entries(CRAFT_JOBS).map(([id, c]) => `<button data-act="craftjob" data-v="${id}" aria-pressed="${job === id}">${c.name} <span class="num xs">${(S.crafts[id] || {}).lvl || 1}</span></button>`).join("")}</nav>
      <div class="row"><div class="bar xp" style="width:200px"><i style="width:${pct(J.xp, E.jobXpNeed(J.lvl))}%"></i></div><input type="text" id="craftSearch" data-act="craftsearch" placeholder="Rechercher…" value="${h(ui.craftSearch)}" style="max-width:200px">
        <label class="row small"><input type="checkbox" data-act="craftonly" ${ui.craftOnly ? "checked" : ""}> Fabricables maintenant</label><span class="xs muted">${total} recette${total > 1 ? "s" : ""}</span></div>
      <section class="panel"><div class="list">${recipes.map((r) => { const ok = E.canCraft(S, { ing: r.ing }) && J.lvl >= r.req;
        const stats = r.T ? Object.entries(r.T.stats).map(([k, [a, b]]) => `${a === b ? a : a + " à " + b} ${STATS[k].short}`).join(", ") : (E.isKey(r.special) ? "Clé de donjon" : "Objet spécial");
        return `<div class="li" style="align-items:flex-start">${r.tpl ? `<span class="icobox">${im(itemImg(r.tpl), "", r.name)}</span>` : `<span class="icobox">${im(resImg(r.special), "", r.name)}</span>`}<span class="grow"><span class="name">${h(r.name)}</span> <span class="muted xs">${r.T ? `niv. ${r.lvl} · ` : ""}${stats}${r.T && r.T.set && SETS[r.T.set] ? ` · ${h(SETS[r.T.set].name)}` : ""}</span>${ingHtml(r.ing)}${J.lvl < r.req ? `<span class="xs minus">${CRAFT_JOBS[job].name} niveau ${r.req} requis</span>` : ""}</span>
          <span class="row" style="gap:4px"><button class="btn sm" data-act="shoppin" data-k="${r.tpl ? "tpl" : "special"}" data-id="${h(r.tpl || r.special)}" title="Ajouter à la liste de courses">${S.shop.some((e) => e.id === (r.tpl || r.special)) ? G("cart") + " ✓" : G("cart")}</button><button class="btn sm ${ok ? "primary" : ""}" data-act="craft" ${r.tpl ? `data-tpl="${r.tpl}"` : `data-special="${h(r.special)}"`} ${ok ? "" : "disabled"}>Fabriquer</button></span></div>`; }).join("") || `<div class="empty">Aucune recette.</div>`}${total > 80 ? `<div class="empty">… ${total - 80} autres recettes : affinez la recherche.</div>` : ""}</div></section>`;
  return body;
}
function brisageHtml() {
  let body = "";
    const items = Object.values(S.items).filter((it) => !E.equippedBy(S, it.uid)).sort((a, b) => ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl);
    const focusOpts = `<option value="">Aucun focus</option>${STAT_ORDER.filter((k) => k !== "pa").map((k) => `<option value="${k}" ${ui.focus === k ? "selected" : ""}>Focus ${STATS[k].name}</option>`).join("")}`;
    const breakable = items.filter((it) => !it.radiant);
    body = `<p class="note">Briser un objet le détruit et donne des runes selon ses statistiques et son niveau (×1,5 pour un objet Rayonnant). Le coefficient baisse de 3 % à chaque brisage d'un même objet et remonte de 1 % toutes les ${E.COEF_REGEN_MIN} minutes.</p>
      <div class="row"><select data-act="focus" aria-label="Focus">${focusOpts}</select>
        ${breakable.length ? (ui.confirm === "breakall" ? `<span class="small">Briser les ${breakable.length} objets non équipés (hors Rayonnants) ?</span><button class="btn sm danger" data-act="breakall">Confirmer</button><button class="btn sm" data-act="cancel">Annuler</button>` : `<button class="btn sm" data-act="askbreakall">Tout briser (hors Rayonnants)</button>`) : ""}</div>
      <section class="panel"><div class="list">${items.map((it) => { const p = E.breakPreview(S, it.uid, ui.focus || null);
        const est = Object.entries(p.weights).map(([k, w]) => `${STATS[k].short} ≈ ${(w / (STATS[k].w * STATS[k].pts)).toFixed(1)}`).join(", ");
        return `<div class="li ${it.radiant ? "radiant" : ""}">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="muted xs">niv. ${ITEMS[it.tpl].lvl} · coefficient <span class="${p.coef < 60 ? "minus" : ""}">${p.coef} %</span></span><br><span class="xs muted">Runes simples estimées : ${est || "aucune"}</span></span>
          <button class="btn sm" data-act="break" data-uid="${it.uid}">Briser</button></div>`; }).join("") || `<div class="empty">Aucun objet à briser. Les objets équipés sont protégés.</div>`}</div></section>`;
  return body;
}
function toolHtml(id) {
  const tl = E.toolLvl(S, id); if (tl >= E.TOOL_MAX) return `<div class="row small">${IC("metiers")} <b>${h(E.TOOL_NAMES[id])} ${tl}</b> <span class="tag good">niveau max</span> <span class="xs muted">(+${tl * 8} % de vitesse)</span></div>`;
  const R = E.toolCost(S, id); const lvOk = S.jobs[id].lvl >= R.lvl; const ok = lvOk && S.kamas >= R.kamas && R.ing.every(([r, q]) => (S.res[r] || 0) >= q);
  const pinned = S.shop.some((e) => e.k === "tool" && e.id === id);
  return `<div class="toolbox"><div class="row between small"><span>${IC("metiers")} Outil actuel : <b>${tl ? h(E.TOOL_NAMES[id]) + " " + tl : "aucun"}</b> <span class="xs muted">(+${tl * 8} % de vitesse)</span></span><span class="xs muted">prochain : <b>${h(R.name)}</b></span></div>
    ${ingHtml(R.ing)}<div class="row small" style="margin-top:4px"><span class="${lvOk ? "plus" : "minus"} xs">${GATHER_JOBS[id].name} niv. ${R.lvl} requis</span><span class="xs"><span class="coin"></span> ${fmt(R.kamas)}</span>
    <button class="btn sm ${ok ? "primary" : ""}" data-act="tool" data-job="${id}" ${ok ? "" : "disabled"}>Fabriquer</button><button class="btn sm" data-act="shoppin" data-k="tool" data-id="${id}" title="Liste de courses">${pinned ? G("cart") + " ✓" : G("cart")}</button></div></div>`;
}
/* 0.1.10.1 : protecteur de ressources (bandeau Métiers, Accueil et combat) */
function protBar() {
  const P = E.protActive(S); const B = S.protBoost && S.protBoost.until > Date.now() ? S.protBoost : null;
  let out = "";
  if (P) { const err = P.fighting ? null : E.protCanFight(S); const M = MONSTERS[P.mon];
    out += `<div class="awaitbar" style="margin:0">${im(imgM(P.mon), "ico sm", M.name)} <span class="grow"><b>${h(E.PROT_TITLE[P.job])}</b> : ${h(M.name)} garde le ${h(P.res)}. ${P.fighting ? "Combat en cours." : P.go ? "L'équipe l'affrontera au prochain combat." : `Encore ${dur((P.until - Date.now()) / 1000)}.`}</span>${P.fighting || P.go ? "" : `<button class="btn sm primary" data-act="protgo" ${err ? `disabled data-tip="${h(err)}"` : ""}>Combattre</button>`}</div>`; }
  if (B) out += `<div class="awaitbar" style="margin:0">${G("sparkle")} Protecteur vaincu : récolte de <b>${h(B.res)}</b> ×2 encore ${dur((B.until - Date.now()) / 1000)}</div>`;
  return out;
}
function recolteHtml() {
  const workers = S.chars.filter((c) => c.job);
  const fil = S.filon && S.filon.until > Date.now() ? S.filon : null;
  const jobs = Object.entries(GATHER_JOBS).map(([id, J]) => { const s = S.jobs[id]; const ws = workers.filter((c) => c.job.job === id);
    const nextRes = J.items.find(([, l]) => l > s.lvl);
    return `<div class="panel"><div class="phead"><div class="row">${im(jobImg(id), "joblogo", J.name)}<div><h2>${J.name}</h2><span class="xs muted">${ws.length ? ws.map((c) => h(c.name)).join(", ") + " récolte" + (ws.length > 1 ? "nt" : "") : "personne ne récolte"}</span></div></div><span class="lvlpill">niv. ${s.lvl}</span></div>
      <div class="pad stack" style="gap:8px">
        <div><div class="row between xs muted"><span>Expérience</span><span class="num">${fmt(s.xp)} / ${fmt(E.jobXpNeed(s.lvl))}</span></div><div class="bar xp"><i style="width:${pct(s.xp, E.jobXpNeed(s.lvl))}%"></i></div></div>
        ${ws.map((c) => `<div class="row small">${head(c)}<span class="grow">${im(resImg(c.job.res), "ico sm", c.job.res)} ${h(c.job.res)} <span class="xs muted">· ${E.gatherPeriod(S, c).toFixed(1)} s</span>${E.filonOn(S, c.job.res) ? ` <span class="tag good">filon ×2</span>` : ""}</span><button class="btn sm" data-act="gathersheet" data-cid="${c.id}">Changer</button></div><div class="bar green" data-wprog="${c.id}"><i style="width:${pct(c.job.prog, E.gatherPeriod(S, c))}%"></i></div>`).join("")}
        <button class="btn sm" data-act="gathersheet" data-job="${id}" style="align-self:flex-start">${IC("pioche")} Envoyer un héros</button>
        ${toolHtml(id)}
        <div class="xs muted">Ressources : ${J.items.map(([r, l]) => `<span style="${l > s.lvl ? "opacity:.5" : ""}">${h(r)} (${l})</span>`).join(" · ")}${nextRes ? ` — prochaine : ${h(nextRes[0])} au niveau ${nextRes[1]}` : ""}</div>
      </div></div>`; }).join("");
  return `<p class="note">Un héros fait une seule activité : chasser avec l'équipe ou récolter la ressource de son choix. 1 % de chances de trouvaille (×5, parfois un ${h(E.RARE_COMPONENT)}). De temps en temps, un filon rare double le rendement d'une ressource pendant 10 minutes, et un protecteur de ressources peut surgir : battez-le avec l'équipe pour doubler la récolte 20 minutes.</p>
    ${protBar()}
    ${fil ? `<div class="awaitbar" style="margin:0">${G("sparkle")} Filon de <b>${h(fil.res)}</b> : rendement ×2 encore ${dur((fil.until - Date.now()) / 1000)}</div>` : ""}
    <section class="panel"><div class="phead"><h2>Vos héros</h2></div><div class="list">${S.chars.map((c) => `<div class="li">${head(c)}<span class="grow"><span class="name">${h(c.name)}</span> <span class="xs muted">niv. ${c.lvl}</span><br><span class="xs">${c.job ? `${IC("pioche")} ${h(GATHER_JOBS[c.job.job].name)} : ${h(c.job.res)}` : c.inTeam ? IC("combat") + " Chasse avec l'équipe" : restLabel(c)}</span></span>
      ${c.job ? `<button class="btn sm" data-act="gathersheet" data-cid="${c.id}">Changer</button><button class="btn sm" data-act="unjob" data-id="${c.id}">Rappeler</button>` : `<button class="btn sm primary" data-act="gathersheet" data-cid="${c.id}">${IC("pioche")} Récolter</button>`}</div>`).join("")}</div></section>
    <div class="grid2">${jobs}</div>`;
}
function renderMetiers() {
  const tabs = [["recolte", "Récolte"], ["craft", "Artisanat"]];
  $("#main").innerHTML = `<div class="pagehead"><h1>Métiers</h1></div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="mettab" data-v="${id}" aria-pressed="${ui.met === id}">${n}</button>`).join("")}</nav>
    <section class="stack">${ui.met === "craft" ? craftHtml() : recolteHtml()}</section>`;
}
function fmHtml() {
  const F = ui.fmF || (ui.fmF = { q: "", slot: "all", sort: "lvl", cid: "", eq: false, runes: false, fav: false });
  const runeStats = new Set(Object.keys(S.runes).filter((k) => S.runes[k] > 0).map((k) => k.split(":")[1]));
  let items = Object.values(S.items).filter((x) => { const T = ITEMS[x.tpl]; const by = E.equippedBy(S, x.uid);
    if (F.q && !T.name.toLowerCase().includes(F.q.toLowerCase())) return false;
    if (F.slot !== "all" && T.slot !== F.slot) return false;
    if (F.cid && (!by || by.id !== +F.cid)) return false;
    if (F.eq && !by) return false; if (F.fav && !x.fav) return false;
    if (F.runes && !Object.keys(T.stats).some((k) => runeStats.has(k) && T.stats[k][1] > 0)) return false;
    return !T.trophy; });
  items.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (F.sort === "jet" ? E.itemQuality(b) - E.itemQuality(a) : F.sort === "fm" ? (b.fm || 0) - (a.fm || 0) : ITEMS[b.tpl].lvl - ITEMS[a.tpl].lvl || (b.radiant ? 1 : 0) - (a.radiant ? 1 : 0)));
  const total = items.length; items = items.slice(0, 120);
  if (!ui.fmSel || !S.items[ui.fmSel]) ui.fmSel = null;
  const it = ui.fmSel ? S.items[ui.fmSel] : null;
  let detail = `<div class="empty">Choisissez un objet à forgemager.</div>`;
  if (it) {
    const T = ITEMS[it.tpl];
    detail = `<div class="row">${itemIcon(it)}<div><b>${itemName(it)}</b><div class="xs muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %${it.fm ? ` · ${it.fm} forgemagie${it.fm > 1 ? "s" : ""}` : ""}</div></div></div>
      <div class="row small"><span data-tip="Puits : ce que l'objet perd sur un échec s'y accumule (en poids de caractéristiques). Tant que le puits couvre la rune tentée, +${Math.round(E.WELL_BONUS * 100)} % de réussite et aucune perte en cas d'échec ; une réussite le vide d'autant.">${IC("forge")} Puits : <b class="num ${it.well ? "plus" : ""}">${Math.round(it.well || 0)}</b></span>${E.isPerfect(it) ? `<span class="tag perfect" data-tip="Toutes les caractéristiques positives sont au jet maximum : +${E.PERFECT_PCT} % sur chacune (au moins +1).">★ Parfait</span>` : `<span class="xs muted">Parfait quand chaque caractéristique positive atteint son jet maximum.</span>`}</div>
      ${Object.keys(T.stats).map((k) => { const [mn, mx] = T.stats[k]; const cur = it.stats[k] || 0; const runes = Object.entries(S.runes).filter(([rk, q]) => q > 0 && rk.split(":")[1] === k);
        const cap = mx > 0 ? mx + Math.max(1, Math.ceil(mx * 0.25)) : mx;
        return `<div class="fmline"><div><span class="statl">${sIco(k)}<b class="${cur > mx ? "bonus" : ""}">${statLine(k, cur)}</b></span> <span class="xs muted">jet ${mn} à ${mx}${mx > 0 ? ` · exo jusqu'à ${cap}` : ""}</span>
          <div class="runes">${mx <= 0 ? `<span class="xs muted">Caractéristique négative</span>` : runes.map(([rk, q]) => { const f = E.fmInfo(S, it.uid, rk); return f.ok ? `<button class="btn sm" data-act="fm" data-k="${rk}" data-tip="${h(`${E.runeName(rk)} : +${f.add} → ${f.nv}${f.over ? " (au-delà du jet max)" : ""} · ${Math.round(f.chance * 100)} % de réussite${f.wellOk ? " (puits : +" + Math.round(E.WELL_BONUS * 100) + " %, aucune perte)" : ""} · ${f.kamas} kamas. Échec : la rune est perdue et parfois une autre caractéristique baisse.`)}">${E.runeName(rk)} ×${q} · <b>${Math.round(f.chance * 100)} %</b> · ${fmt(f.kamas)} k</button>` : `<span class="xs muted" data-tip="${h(f.why)}">${E.runeName(rk)} ×${q} : ${h(f.why)}</span>`; }).join("") || `<span class="xs muted">Aucune rune de ${h(STATS[k].name)} — brisez des objets qui en ont.</span>`}</div></div></div>`; }).join("")}
      ${exoBlockHtml(it)}
      ${planBlockHtml(it)}
      ${it.fmLog && it.fmLog.length ? `<h3 class="sec">Historique</h3><div class="list">${it.fmLog.map((l) => `<div class="li xs"><span class="${l.ok ? "plus" : "minus"}">${l.ok ? "✓" : "✗"}</span><span class="grow">${h(l.txt)}</span><span class="muted">${ago(l.t)}</span></div>`).join("")}</div>` : ""}`;
  }
  return `<p class="note">La forgemagie améliore les jets d'un objet avec des runes (obtenues au brisage) et des kamas. En dessous du jet maximum, la réussite est élevée ; au-delà (« exo »), c'est risqué. Un échec détruit la rune et peut faire baisser une autre caractéristique, mais ce qui est perdu remplit le puits de l'objet et protège les tentatives suivantes.</p>
    ${fmJobCard()}
    ${fmPlansHtml()}
    <div class="row invbar"><input type="text" id="fmSearch" data-act="fmsearch" placeholder="Rechercher un objet…" value="${h(F.q)}">
      <select data-act="fmslot">${[["all", "Tous"], ["coiffe", "Coiffes"], ["cape", "Capes"], ["amulette", "Amulettes"], ["anneau", "Anneaux"], ["ceinture", "Ceintures"], ["bottes", "Bottes"], ["arme", "Armes"], ["bouclier", "Boucliers"]].map(([v, n]) => `<option value="${v}" ${F.slot === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-act="fmcid"><option value="">Tous les héros</option>${S.chars.map((c) => `<option value="${c.id}" ${+F.cid === c.id ? "selected" : ""}>Porté par ${h(c.name)}</option>`).join("")}</select>
      <select data-act="fmsort">${[["lvl", "Niveau"], ["jet", "Jet"], ["fm", "Forgemagies"]].map(([v, n]) => `<option value="${v}" ${F.sort === v ? "selected" : ""}>Tri : ${n}</option>`).join("")}</select></div>
    <div class="row small">${[["eq", "Équipés seulement"], ["runes", "Runes disponibles"], ["fav", "★ Favoris"]].map(([k, n]) => `<button class="btn sm ${F[k] ? "primary" : ""}" data-act="fmtoggle" data-k="${k}">${n}</button>`).join("")}<span class="xs muted">${total} objet${total > 1 ? "s" : ""}</span></div>
    <div class="grid2"><section class="panel"><div class="phead"><h2>Objets</h2><span class="xs muted">${total > 120 ? "120 premiers" : total}</span></div><div class="list" style="max-height:560px;overflow:auto">${items.map((x) => `<div class="li ${x.radiant ? "radiant" : ""}" style="${ui.fmSel === x.uid ? "box-shadow:inset 0 0 0 2px var(--gold)" : ""}"><button class="btn sm" data-act="fmfav" data-uid="${x.uid}" title="Favori">${x.fav ? "★" : "☆"}</button>${itemIcon(x)}<span class="grow">${itemName(x)} <span class="xs muted">niv. ${ITEMS[x.tpl].lvl} · jet ${Math.round(E.itemQuality(x) * 100)} %${x.fm ? ` · ${IC("forge")} ${x.fm}` : ""}${E.equippedBy(S, x.uid) ? " · porté par " + h(E.equippedBy(S, x.uid).name) : ""}</span></span><button class="btn sm ${ui.fmSel === x.uid ? "primary" : ""}" data-act="fmsel" data-uid="${x.uid}">Choisir</button></div>`).join("") || `<div class="empty">Aucun objet ne correspond.</div>`}</div></section>
    <section class="panel"><div class="phead"><h2>Établi du forgemage</h2><span class="small"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b></span></div><div class="pad stack" style="gap:8px">${detail}</div></section></div>`;
}
function renderForge() {
  const tabs = [["fm", "Forgemagie"], ["brisage", "Brisage"], ["runes", "Runes"]];
  $("#main").innerHTML = `<div class="pagehead"><h1>Forgemagie</h1></div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="fgtab" data-v="${id}" aria-pressed="${ui.fg === id}">${n}</button>`).join("")}</nav>
    <section class="stack">${ui.fg === "brisage" ? brisageHtml() : ui.fg === "runes" ? runesView() : fmHtml()}</section>`;
}
/* ---------- QUÊTES ---------- */
function mainQuestHtml() {
  const cur = S.quest.step; const qp = E.questProgress(S);
  return `<section class="panel"><div class="phead"><h2>Quête principale</h2><span class="small muted num">${Math.min(cur, E.MAIN_QUEST.length)}/${E.MAIN_QUEST.length}</span></div><div class="pad stack" style="gap:8px">
    ${E.MAIN_QUEST.map((q, i) => `<div class="qcard ${i < cur ? "done" : i === cur ? "cur" : ""}" ${i > cur + 2 ? 'style="opacity:.35"' : ""}><span class="qnum">${i < cur ? "✓" : i + 1}</span><div class="grow"><b>${i > cur + 2 ? "???" : h(q.title)}</b><div class="small muted">${i > cur + 2 ? "Terminez les étapes précédentes." : h(q.txt)}</div>
      ${i === cur && qp ? `<div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(qp[0], qp[1])}%"></i></div><span class="num small">${fmt(qp[0])}/${fmt(qp[1])}</span></div>` : ""}
      ${i <= cur + 2 && E.questExtraText(i) ? `<div class="xs" style="margin-top:4px">${IC("coffre")} <span class="muted">${i < cur ? "Reçu" : "Récompense"} :</span> ${h(E.questExtraText(i))}</div>` : ""}</div>${i === cur ? `<span class="pinbtn auto" data-tip="La quête principale est toujours suivie dans la bande d'objectifs">${G("pin")} suivie</span>` : ""}${i === cur && q.sub ? `<button class="btn sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>`).join("")}</div></section>`;
}
function shopHtml(id) {
  const Sh = E.SHOPS[id]; const have = S.tokens[Sh.cur] || 0;
  return `<section class="panel"><div class="phead"><h2>${emo(Sh.icon)} ${h(Sh.name)}</h2><span class="small"><b class="num">${fmt(have)}</b> ${h(Sh.curName.toLowerCase())}</span></div>
    <div class="pad hvgrid">${Sh.items.map((it) => { const owned = E.shopOwned(S, it); const C = it.cons ? CONSUMABLES[it.cons] : null;
      return `<div class="hv"><div class="top"><span class="em">${C ? emo(C.icon) : it.wing ? IC("ailes") : it.furn ? IC("havre") : it.orn ? G("frame") : G("tag")}</span><div class="grow"><b>${h(E.shopItemName(S, it))}</b><div class="xs muted">${C ? h(C.desc) : it.wing ? "Couleur des ailes d'alignement (Héros → Ornement)" : it.furn ? `Meuble du Havre-Sac : ${E.furnEffect(it.furn)}` : it.orn ? "Ornement de carte de héros" : "Titre affiché sur la carte"}</div></div></div>
        <button class="btn sm ${!owned && have >= it.cost ? "primary" : ""}" data-act="buyshop" data-shop="${id}" data-id="${it.id}" ${owned || have < it.cost || (id === "cite" && !S.align) ? "disabled" : ""}>${owned ? "Obtenu" : `${Sh.icon} ${it.cost}`}</button></div>`; }).join("")}</div></section>`;
}
function bountiesHtml() {
  return `<p class="note">Trois avis de recherche adaptés à votre niveau. Ils se remplissent automatiquement en chassant (ou en battant le boss demandé) et rapportent kamas, expérience et points d'alignement. Un nouvel avis remplace aussitôt celui qui est rempli.</p>
    <div class="bgrid">${(S.bounties || []).map((b) => { const m = MONSTERS[b.key]; const where = b.dg ? DUNGEONS[b.dg].name : E.SUBS[b.sub] ? E.SUBS[b.sub].name : "";
      return `<div class="bounty"><span class="wanted">AVIS DE RECHERCHE</span>${im(imgM(b.key), "", m.name)}<b>${h(m.name)}</b><span class="xs">${b.dg ? "Boss · " : ""}${h(where)} · niv. ${m.lvl[0]}–${m.lvl[1]}</span>
        <div class="row" style="width:100%"><div class="bar grow"><i style="width:${pct(b.prog, b.n)}%"></i></div><span class="num small">${b.prog}/${b.n}</span></div>
        <span class="small">Prime : <span class="coin"></span> <b>${fmt(b.kamas)}</b> · XP${S.align ? ` · +${b.axp} alignement` : ""}</span>
        <div class="row">${pinBtn({ k: "bounty", id: b.id })}${b.sub ? `<button class="btn sm" data-act="zoneview" data-id="${b.sub}" data-gotab="world">Y aller</button>` : `<button class="btn sm" data-act="worldtab" data-v="dungeons" data-gotab="world">Donjons</button>`}<button class="btn sm" data-act="reroll" data-id="${b.id}" ${S.kamas < E.rerollCost(S) && !S.cons.parchemin_avis ? "disabled" : ""}>Changer · ${S.cons.parchemin_avis ? IC("quetes") + " gratuit" : fmt(E.rerollCost(S)) + " k"}</button></div></div>`; }).join("") || `<div class="empty">Aucun avis disponible.</div>`}</div>
    <p class="small muted">Avis remplis : <b>${fmt(S.cnt.bounty || 0)}</b> · chaque avis rapporte 1 jeton de chasseur (2 pour un boss) et parfois un coffre.${S.cons.parchemin_avis ? ` · ${S.cons.parchemin_avis} Parchemin${S.cons.parchemin_avis > 1 ? "s" : ""} d'Avis : changement gratuit.` : ""}</p>
    ${shopHtml("prime")}`;
}
function alignHtml() {
  const top = Math.max(...S.chars.map((c) => c.lvl));
  if (!S.align) {
    const can = top >= E.ALIGN_MIN_LVL;
    return `<section class="panel"><div class="phead"><h2>Alignement</h2>${can ? "" : `<span class="tag soft">${G("lock")} niveau ${E.ALIGN_MIN_LVL}</span>`}</div><div class="pad stack">
      <p class="small">Choisissez votre camp : Bonta, la cité blanche, ou Brâkmar, la cité sombre. Puis un ordre. Les missions d'alignement, les avis de recherche et les boss de donjon vous feront monter en rang : vos ailes grandissent et vos bonus augmentent.${can ? "" : ` Atteignez le niveau ${E.ALIGN_MIN_LVL} pour choisir (votre meilleur héros est niveau ${top}).`}</p>
      <div class="alignpick">${Object.entries(E.ALIGN).map(([sid, A]) => `<div class="alignside" style="--c:${A.color}"><img class="badge" src="assets/i/${A.badge}.png" alt=""><h2 style="text-align:center">${A.name}</h2>
        <div class="xs muted" style="text-align:center">Camp : +2 % de ${A.bonusName} par rang</div>
        ${Object.entries(A.orders).map(([oid, O]) => `<div class="row between"><span><b>${h(O.name)}</b><br><span class="xs muted">${h(E.ORDER_BONUS[oid].txt)}</span></span><button class="btn sm ${can ? "primary" : ""}" data-act="align" data-side="${sid}" data-order="${oid}" ${can ? "" : "disabled"}>Rejoindre</button></div>`).join("")}</div>`).join("")}</div></div></section>`;
  }
  const A = S.align; const side = E.ALIGN[A.side]; const O = side.orders[A.order]; const r = E.alignRankIdx(S); const q = S.alignQuest;
  return `<section class="panel"><div class="phead"><div class="row"><img src="assets/i/${side.badge}.png" alt="" style="width:48px;height:48px;object-fit:contain"><div><h2>${side.adj} · ${h(O.name)}</h2><div class="small muted">Rang : <b style="color:var(--gold2)">${h(E.alignRankName(S))}</b> · niveau d'alignement ${A.lvl}/100</div></div></div></div>
    <div class="pad stack" style="gap:10px">
      <div>${A.lvl < 100 ? `<div class="row between xs muted"><span>vers le niveau ${A.lvl + 1}</span><span class="num">${fmt(A.xp)} / ${fmt(E.alignNeed(A.lvl))}</span></div><div class="bar"><i style="width:${pct(A.xp, E.alignNeed(A.lvl))}%"></i></div>` : `<span class="tag good">Niveau maximum</span>`}</div>
      <div class="row small">${O.ranks.map((n, i) => `<span class="tag ${i < r ? "good" : "soft"}">${i + 1}. ${h(n)} (${(i + 1) * 20})</span>`).join("")}</div>
      <div class="small">Bonus actuels : <b class="plus">+${2 * r} % ${side.bonusName}</b> (camp) · <b class="plus">${h(E.ORDER_BONUS[A.order].txt.replace("par rang", ""))}× ${r}</b> (ordre)</div>
      ${q ? `<div class="qcard cur"><span class="qnum">${IC("combat")}</span><div class="grow"><b>${h(q.title)}</b><div class="small muted">${h(q.txt)}</div><div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:${pct(q.prog, q.n)}%"></i></div><span class="num small">${q.prog}/${q.n}</span></div><div class="xs muted">Récompense : ${fmt(q.axp)} points d'alignement, ${fmt(q.kamas)} kamas</div></div>${pinBtn({ k: "align" })}${q.sub ? `<button class="btn sm" data-act="zoneview" data-id="${q.sub}" data-gotab="world">Y aller</button>` : ""}</div>` : ""}
      <div class="row small"><span class="muted">Changer d'ordre :</span>${Object.entries(side.orders).filter(([oid]) => oid !== A.order).map(([oid, O2]) => `<button class="btn sm" data-act="align" data-side="${A.side}" data-order="${oid}">${h(O2.name)}</button>`).join("")}
        <span class="xs muted">Insignes : <b>${fmt(S.tokens.insignes || 0)}</b> (3 par mission, 5 pour un boss)</span>
        ${ui.confirm === "traitre" ? `<button class="btn sm danger" data-act="align" data-side="${A.side === "bonta" ? "brakmar" : "bonta"}" data-order="coeur">Confirmer : rejoindre ${A.side === "bonta" ? "Brâkmar" : "Bonta"} (tout l'alignement est perdu)</button>` : `<button class="btn sm" data-act="asktraitre">Changer de camp…</button>`}</div>
    </div></section>${shopHtml("cite")}`;
}
function almanaxHtml() {
  const A = E.almanax(S); const d = new Date(); const have = S.res[A.res] || 0;
  return `<section class="panel"><div class="phead"><h2>${IC("almanax")} Almanax</h2><span class="small muted">offrandes : ${S.cnt.almanax || 0}</span></div><div class="pad stack">
    <div class="almanax"><div class="cal"><b>${d.getDate()}</b><span>${d.toLocaleDateString("fr-FR", { month: "short" })}</span></div>
      <div class="grow stack" style="gap:6px"><div>Offrande du jour : ${im(resImg(A.res), "ico sm", A.res)} <b>${A.qty} × ${h(A.res)}</b> <span class="small muted">(vous en avez ${fmt(have)})</span></div>
        <div>Bonus du jour : <b class="plus">${h(A.bonus.name)}</b> jusqu'à minuit, et <span class="coin"></span> ${fmt(A.kamas)} kamas</div>
        <div>${A.done ? `<span class="tag good">Offrande faite aujourd'hui ✓</span>` : `<button class="btn primary" data-act="almanax" ${have >= A.qty ? "" : "disabled"}>Faire l'offrande</button>`}</div></div></div>
    <div><b>Série : ${S.almStreak.n || 0} jour${(S.almStreak.n || 0) > 1 ? "s" : ""}</b> <span class="xs muted">(un jour manqué fait redescendre d'un palier)</span>
      <div class="row" style="margin-top:6px">${E.ALM_TIERS.map((t) => { const R = E.ALM_TIERS_R[t]; const txt = R.lot ? "lot de ressources" : R.cons ? CONSUMABLES[R.cons].name : R.furn ? `meuble « ${R.furn} »` : `titre « ${R.title} » + ornement`; return `<span class="tag ${(S.almStreak.n || 0) >= t ? "good" : "soft"}">${t} j : ${h(txt)}</span>`; }).join("")}<span class="tag soft">puis tous les 30 j : Coffre en or</span></div></div>
    <p class="note">L'offrande change chaque jour et dépend de votre niveau. Les ressources viennent des monstres ; consultez l'encyclopédie pour savoir qui les lâche.</p></div></section>`;
}
function achHtml() {
  const cats = [...new Set(E.ACH.map((a) => a.cat))]; const n = Object.keys(S.ach).length;
  const ICO = { Progression: G("star"), Combat: IC("combat"), Donjons: IC("cle"), Chasse: IC("carte"), Objets: IC("dofus"), Métiers: IC("pioche"), Forgemagie: IC("forge"), Quêtes: IC("quetes"), Alignement: IC("ailes"), "Havre-Sac": IC("havre"), Idoles: `<img class="uico" src="assets/id/pro.webp" alt="">`, Archimonstres: IC("dofus") };
  return `<section class="panel"><div class="phead"><h2>Ornements</h2><span class="xs muted">à équiper dans Héros (contour de la carte)</span></div><div class="pad achgrid">${Object.entries(E.ORN).map(([id, O]) => `<div class="ach ${E.ornUnlocked(S, id) ? "ok" : ""}"><span class="ic">${E.ornUnlocked(S, id) ? G("sparkle") : G("lock")}</span><span><b>${h(O.name(S))}</b><br><span class="xs muted">${h(O.req)}</span></span></div>`).join("")}</div></section>
    <section class="panel"><div class="phead"><h2>Succès</h2><span class="small muted num">${n}/${E.ACH.length}</span></div><div class="pad stack">${cats.map((cat) => `<h3 class="sec">${ICO[cat] || "•"} ${h(cat)}</h3><div class="achgrid">${E.ACH.filter((a) => a.cat === cat).map((a) => { const pr = !S.ach[a.id] && E.achProgress(S, a.id); return `<div class="ach ${S.ach[a.id] ? "ok" : ""}"><span class="ic">${S.ach[a.id] ? IC("trophee") : "·"}</span><span class="grow"><b>${h(a.name)}</b>${pr ? ` <span class="xs num">${fmt(Math.min(pr[0], pr[1]))}/${fmt(pr[1])}</span>` : ""}<br><span class="xs muted">${h(a.desc)} · ${fmt(a.kamas)} k${a.title ? ` · titre « ${h(a.title)} »` : ""}</span></span>${pr ? pinBtn({ k: "ach", id: a.id }) : ""}</div>`; }).join("")}</div>`).join("")}</div></section>`;
}
function renderQuests() {
  const tabs = [["main", "Quête principale"], ["dofus", "Dofus"], ["bounty", "Avis de recherche"], ["align", "Alignement"], ["almanax", "Almanax"], ["ach", "Succès"]];
  const body = ui.qt === "bounty" ? bountiesHtml() : ui.qt === "dofus" ? dofusHtml() : ui.qt === "align" ? alignHtml() : ui.qt === "almanax" ? almanaxHtml() : ui.qt === "ach" ? achHtml() : mainQuestHtml();
  $("#main").innerHTML = `<div class="pagehead"><h1>Quêtes</h1></div>
    <nav class="subtabs">${tabs.map(([id, n]) => `<button data-act="qtab" data-v="${id}" aria-pressed="${ui.qt === id}">${n}</button>`).join("")}</nav>
    <section class="stack">${body}</section>`;
}
/* 0.1.8.2 : atelier de runes (fusion, transmutation, nourrir le forgemage) */
function runesView() {
  const runes = Object.entries(S.runes).filter(([, q]) => q > 0).sort((a, b) => STAT_ORDER.indexOf(E.runeInfo(a[0]).stat) - STAT_ORDER.indexOf(E.runeInfo(b[0]).stat) || E.runeInfo(a[0]).weight - E.runeInfo(b[0]).weight);
  const tr = ui.tr || (ui.tr = { from: "", to: "fo" });
  if (!S.runes[tr.from] || E.runeInfo(tr.from).exo) { const r0 = runes.find(([k]) => !E.runeInfo(k).exo); tr.from = r0 ? r0[0] : ""; }
  const fromTier = tr.from ? tr.from.split(":")[0] : "";
  const targets = E.transmuteTargets().filter((k) => !fromTier || !RUNE_SIMPLE_ONLY.includes(k));
  if (!targets.includes(tr.to)) tr.to = targets[0];
  const cost = E.transmuteCost(fromTier); const canTr = tr.from && (S.runes[tr.from] || 0) >= E.TRANSMUTE_N && S.kamas >= cost && tr.to !== tr.from.split(":")[1];
  return `<p class="note">Fusion : ${E.RUNE_FUSE_N} runes identiques donnent la rune supérieure (simple → Pa → Ra) et une rune se casse en ${E.RUNE_FUSE_N} runes inférieures, gratuitement. Transmutation : ${E.TRANSMUTE_N} runes d'une caractéristique donnent 1 rune d'une autre, contre des kamas. Les runes inutiles peuvent aussi nourrir le métier de Forgemage.</p>
    ${fmJobCard()}
    <section class="panel"><div class="phead"><h2>Transmutation</h2><span class="small"><span class="coin"></span> <b class="num">${fmt(S.kamas)}</b></span></div><div class="pad row small">
      <select data-act="trfrom">${runes.filter(([k]) => !E.runeInfo(k).exo).map(([k, q]) => `<option value="${k}" ${tr.from === k ? "selected" : ""}>${E.runeName(k)} ×${q}</option>`).join("") || `<option value="">Aucune rune</option>`}</select>
      <span>→</span><select data-act="trto">${targets.map((k) => `<option value="${k}" ${tr.to === k ? "selected" : ""}>${STATS[k].name}</option>`).join("")}</select>
      <button class="btn sm ${canTr ? "primary" : ""}" data-act="transmute" ${canTr ? "" : "disabled"}>${E.TRANSMUTE_N} → 1 · ${fmt(cost)} k</button></div></section>
    ${exoCraftHtml(runes)}
    <section class="panel"><div class="phead"><h2>Vos runes</h2><span class="muted xs">${runes.length} sorte${runes.length > 1 ? "s" : ""}</span></div>
      <div class="list">${runes.map(([k, q]) => { const i = E.runeInfo(k); const simpleOnly = RUNE_SIMPLE_ONLY.includes(i.stat);
        return `<div class="li"><span class="grow"><span class="name">${E.runeName(k)}</span> <span class="xs muted num">×${fmt(q)} · +${i.pts} ${STATS[i.stat].short}</span></span>
          ${!simpleOnly && i.tier !== "ra" && !i.exo ? `<button class="btn sm" data-act="fuse" data-k="${k}" data-dir="up" ${q >= E.RUNE_FUSE_N ? "" : "disabled"} data-tip="${E.RUNE_FUSE_N} ${E.runeName(k)} → 1 ${E.runeName(E.runeKey(i.tier === "" ? "pa" : "ra", i.stat))}">Fusionner ×${E.RUNE_FUSE_N}</button>` : ""}
          ${i.tier && !i.exo ? `<button class="btn sm" data-act="fuse" data-k="${k}" data-dir="down" data-tip="1 ${E.runeName(k)} → ${E.RUNE_FUSE_N} ${E.runeName(E.runeKey(i.tier === "ra" ? "pa" : "", i.stat))}">Casser</button>` : ""}
          ${i.exo ? `<span class="tag exo" data-tip="Rune exotique : +1 ${STATS[i.stat].name} sur un objet de niveau ${E.EXO_LVL} ou plus (établi du forgemage, Forgemage niveau ${E.EXO_FM_LVL})">Exotique</span>` : `<button class="btn sm" data-act="fmfeed" data-k="${k}" data-q="1" data-tip="Nourrir le Forgemage : +${i.weight * 3} XP par rune">${IC("forge")} ×1</button><button class="btn sm" data-act="fmfeed" data-k="${k}" data-q="${q}">Tout</button>`}</div>`; }).join("") || `<div class="empty">Aucune rune. Brisez des objets pour en obtenir.</div>`}</div></section>`;
}
/* 0.1.9.2 : runes exotiques et forgemagie automatique */
function exoBlockHtml(it) {
  const T = ITEMS[it.tpl];
  if (it.exo) return `<div class="fmline exo"><div><span class="statl">${sIco(it.exo)}<b class="bonus">+1 ${STATS[it.exo].name}</b></span> <span class="tag exo">Exo ${STATS[it.exo].short}</span> <span class="xs muted">un seul exo par objet · au brisage l'exo est perdu mais les runes sont doublées</span></div></div>`;
  if (T.slot === "dofus" || T.trophy) return "";
  if (T.lvl < E.EXO_LVL) return `<div class="xs muted">Exotique (+1 PA, +1 PM ou +1 Portée) : objets de niveau ${E.EXO_LVL} ou plus.</div>`;
  const J = E.fmJob(S);
  return `<div class="fmline exo"><div><span class="statl"><b>Exotique</b></span> <span class="xs muted">ajoute une caractéristique que l'objet n'a pas (un seul exo par objet). En cas d'échec, seule la rune est perdue : l'objet ne baisse pas et le puits ne joue pas.${J.lvl < E.EXO_FM_LVL ? ` <b>Forgemage niveau ${E.EXO_FM_LVL} requis</b> (vous : ${J.lvl}).` : ""}</span>
    <div class="runes">${E.EXO_STATS.map((k) => { const f = E.exoInfo(S, it.uid, k); const name = E.runeName(E.exoKey(k)); const pct = Math.round(f.chance * 100);
      return f.ok ? `<button class="btn sm" data-act="exo" data-k="${k}" data-tip="${h(`${name} : +1 ${STATS[k].name} · ${pct} % de réussite (ni le puits ni le métier n'aident) · ${fmt(f.kamas)} kamas. Échec : la rune est perdue, l'objet reste intact.`)}">${name} ×${f.have} · <b>${pct} %</b> · ${fmt(f.kamas)} k</button>`
        : `<span class="xs muted" data-tip="${h(f.why)}">${name} ×${f.have} · ${pct} % · ${fmt(f.kamas)} k : ${h(f.why)}</span>`; }).join("")}</div>
    <div class="xs muted">Exo PA : un héros n'en porte qu'un seul. Runes Ga : coffres de boss des donjons de niveau ${E.EXO_LVL}+ (stasis 7, Ga PA en stasis 8), archimonstres de niveau ${E.EXO_LVL}+, ou l'onglet Runes.</div></div></div>`;
}
const planGoalsTxt = (p) => { const it = S.items[p.uid]; return Object.keys(p.goals).map((k) => `${STATS[k].name} ${it ? it.stats[k] || 0 : "?"} / ${p.goals[k]}`).join(" · "); };
function planBlockHtml(it) {
  const p = E.fmPlanOf(S, it.uid);
  if (p) return `<div class="row small"><span class="tag good">Plan en cours</span><span class="xs muted grow">${h(planGoalsTxt(p))} · prochaine tentative dans ${dur(E.fmPlanEta(S, p))}</span><button class="btn sm danger" data-act="fmplanstop" data-uid="${it.uid}">Arrêter</button></div>`;
  if (ITEMS[it.tpl].trophy) return "";
  const can = E.fmPlanActive(S).length < E.FM_PLAN_MAX;
  return `<div class="row small"><button class="btn sm ${can ? "primary" : ""}" data-act="fmplan" data-uid="${it.uid}" ${can ? "" : "disabled"}>${IC("forge")} Automatiser</button><span class="xs muted">Une tentative toutes les ${Math.round(E.fmPlanPeriod(S) / 60)} min avec vos runes et vos kamas, en jeu comme hors ligne${can ? "" : ` · ${E.FM_PLAN_MAX} plans en parallèle au maximum`}.</span></div>`;
}
function fmPlansHtml() {
  const plans = E.fmPlans(S); if (!plans.length) return "";
  const act = E.fmPlanActive(S).length;
  return `<section class="panel"><div class="phead"><h2>Plans de forgemagie</h2><span class="xs muted num">${act} / ${E.FM_PLAN_MAX} en cours</span></div><div class="list">${plans.slice().reverse().map((p) => { const it = S.items[p.uid];
    return `<div class="li"><span class="grow"><b>${it ? itemName(it) : h(p.name)}</b> ${p.done ? `<span class="tag soft">Terminé</span>` : `<span class="tag good">En cours</span>`}<br><span class="xs muted">${p.done ? h(p.done) + " · " : ""}${h(planGoalsTxt(p))} · ${p.tries} tentative${p.tries > 1 ? "s" : ""}, ${p.ok} réussite${p.ok > 1 ? "s" : ""} · ${fmt(p.spent)} k${p.budget ? ` / ${fmt(p.budget)}` : ""}${p.done ? "" : ` · prochaine dans ${dur(E.fmPlanEta(S, p))}`}</span>${p.log.length ? `<div class="xs" style="margin-top:4px">${p.log.slice(0, 4).map((l) => `<div><span class="${l.ok ? "plus" : "minus"}">${l.ok ? "✓" : "✗"}</span> ${h(l.txt)} <span class="muted">${ago(l.t)}</span></div>`).join("")}</div>` : ""}</span>
      ${it ? `<button class="btn sm" data-act="fmsel" data-uid="${p.uid}">Voir</button>` : ""}${p.done ? `<button class="btn sm" data-act="fmplandrop" data-uid="${p.uid}">Retirer</button>` : `<button class="btn sm danger" data-act="fmplanstop" data-uid="${p.uid}">Arrêter</button>`}</div>`; }).join("")}</div></section>`;
}
function fmPlanSheet(uid) {
  const it = S.items[uid]; if (!it) return; const T = ITEMS[it.tpl];
  const stats = Object.keys(T.stats).filter((k) => T.stats[k][1] > 0);
  openSheet(`<h2>${IC("forge")} Automatiser la forgemagie</h2><div class="row">${itemIcon(it)}<div><b>${itemName(it)}</b><div class="xs muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %</div></div></div>
    <p class="small muted">Une tentative toutes les ${Math.round(E.fmPlanPeriod(S) / 60)} min, en jeu comme hors ligne, avec vos runes et vos kamas. Le plan s'arrête tout seul quand les objectifs sont atteints, que les runes ou le budget manquent, ou que le plancher est touché.</p>
    <div class="stack" style="gap:8px">
      <div class="small"><b>Objectifs</b> <span class="xs muted">jet visé ; au-delà du jet maximum c'est de l'exo-jet, risqué</span></div>
      ${stats.map((k) => { const [, mx] = T.stats[k]; const cap = mx + Math.max(1, Math.ceil(mx * 0.25)); const cur = it.stats[k] || 0;
        return `<label class="row small"><input type="checkbox" class="fmg" data-k="${k}" ${cur < mx ? "checked" : ""}> <span class="grow">${sIco(k)}${STATS[k].name} <span class="xs muted">${cur} actuellement · jet max ${mx} · exo jusqu'à ${cap}</span></span><input type="number" id="fmgv_${k}" min="${cur + 1}" max="${cap}" value="${Math.max(mx, cur + 1)}" style="width:84px"></label>`; }).join("")}
      <div class="small"><b>Runes</b></div><div class="row small" style="flex-wrap:wrap">${Object.entries(E.FM_PLAN_RUNES).map(([v, n], i) => `<label><input type="radio" name="fmr" value="${v}" ${i === 0 ? "checked" : ""}> ${n}</label>`).join("")}</div>
      <div class="row small"><b>Budget kamas</b><input type="number" id="fmbudget" min="0" step="1000" value="${Math.min(S.kamas, 100000)}" style="width:120px"><span class="xs muted">0 = sans limite</span></div>
      <div class="row small"><b>Plancher</b><select id="fmfloor">${Object.entries(E.FM_PLAN_FLOOR).map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></div>
    </div>
    <div class="row"><button class="btn primary" data-act="fmplango" data-uid="${uid}">Lancer le plan</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
}
function exoCraftHtml(runes) {
  const ras = runes.filter(([k]) => k.split(":")[0] === "ra");
  if (!ui.ga || !S.runes[ui.ga]) ui.ga = ras.length ? ras[0][0] : "";
  const ecl = S.res[E.RARE_COMPONENT] || 0;
  return `<section class="panel"><div class="phead"><h2>Runes exotiques</h2><span class="xs muted">${E.EXO_STATS.map((k) => `${E.runeName(E.exoKey(k))} ×${S.runes[E.exoKey(k)] || 0}`).join(" · ")}</span></div><div class="pad stack small" style="gap:6px">
    <div class="xs muted">Une rune Ga ajoute +1 PA, +1 PM ou +1 Portée à un objet de niveau ${E.EXO_LVL} ou plus (établi du forgemage, Forgemage niveau ${E.EXO_FM_LVL}). Ici, des runes Ra d'une même caractéristique, des ${E.RARE_COMPONENT} (vous en avez ${fmt(ecl)}) et des kamas en fabriquent une. Les coffres de boss des donjons de niveau ${E.EXO_LVL}+ (stasis 7, Ga PA en stasis 8) et les archimonstres de niveau ${E.EXO_LVL}+ en lâchent aussi.</div>
    <div class="row" style="flex-wrap:wrap"><select data-act="gafrom">${ras.map(([k, q]) => `<option value="${k}" ${ui.ga === k ? "selected" : ""}>${E.runeName(k)} ×${q}</option>`).join("") || `<option value="">Aucune rune Ra</option>`}</select>
    ${E.EXO_STATS.map((k) => { const f = E.exoCraftInfo(S, k, ui.ga); const C = E.EXO_CRAFT[k];
      return `<button class="btn sm ${f.ok ? "primary" : ""}" data-act="exocraft" data-k="${k}" ${f.ok ? "" : "disabled"} data-tip="${h(`${C.ra} runes Ra + ${C.eclat} ${E.RARE_COMPONENT} + ${fmt(C.kamas)} kamas → 1 ${E.runeName(E.exoKey(k))}${f.ok ? "" : " · " + f.why}`)}">${E.runeName(E.exoKey(k))} · ${C.ra} Ra + ${C.eclat} éclats + ${fmt(C.kamas)} k</button>`; }).join("")}</div></div></section>`;
}
/* 0.1.8.2 : carte du métier de Forgemage */
function fmJobCard() {
  const J = E.fmJob(S); const need = E.fmNeed(J.lvl); const max = J.lvl >= E.FM_MAX;
  const next = E.FM_PERKS.find(([l]) => l > J.lvl);
  return `<section class="panel"><div class="pad row" style="gap:14px;align-items:center">
    <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--gold2),var(--gold) 60%,#8a5d14);display:grid;place-items:center;border:3px solid var(--frame);flex:none;color:#2a1a08"><b class="num" style="font-size:22px;line-height:1">${J.lvl}</b></div>
    <div class="grow stack" style="gap:4px"><div class="row between"><h2>Forgemage niveau ${J.lvl}</h2><span class="xs muted">+${(J.lvl * 0.1).toFixed(1)} % de réussite · −${(J.lvl * 0.5).toFixed(1)} % de kamas</span></div>
      <div class="bar xp"><i style="width:${max ? 100 : pct(J.xp, need)}%"></i></div>
      <div class="xs muted num">${max ? "Niveau maximum" : `${fmt(J.xp)} / ${fmt(need)} XP · chaque forgemagie donne de l'expérience (le double en cas de réussite), les runes aussi (onglet Runes)`}</div>
      <div class="xs">${E.FM_PERKS.map(([l, t]) => `<span class="${J.lvl >= l ? "plus" : "muted"}" data-tip="${h(t)}">${J.lvl >= l ? "✓" : "·"} niv. ${l}</span>`).join(" · ")}${next ? ` <span class="muted">— prochain palier (${next[0]}) : ${h(next[1])}</span>` : ""}</div></div></div></section>`;
}

/* ---------- feuilles ---------- */
function openSheet(html) { $("#sheet").innerHTML = `<div class="sheet-bg" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; }
function closeSheet() { $("#sheet").innerHTML = ""; ui.giveTo = null; }
/* 0.1.12 : Renaissance */
function renSheet(cid) {
  const c = char(cid); if (!c) return; const err = E.canRenaissance(S, c); const n = (c.ren || 0) + 1; const choices = E.renChoices(c); const pick = ui.renPick && choices.some(([id]) => id === ui.renPick) ? ui.renPick : null;
  const keep = ["Nom, classe, sexe, tête et couleurs", "Succès, titres et ornements", "Dofus et trophées, toujours équipés", "Familier ou montilier, et monture", "Parchemins de caractéristiques", "Ses Éveils déjà choisis"];
  const reset = ["Niveau 1 et expérience", "Points de caractéristiques (répartis à nouveau en montant)", "Sorts : réappris avec les niveaux", "Équipement rangé dans le sac (rien n'est perdu)"];
  const ch = (id, r) => `<button class="evbtn ${pick === id ? "on" : ""} ${id === "classe" ? "cls" : ""}" data-act="renpick" data-id="${c.id}" data-v="${id}" aria-pressed="${pick === id}"><span class="n">${h(id === "classe" ? "Éveil de classe" : E.EVEILS[id].name)}<span class="rk">rang ${E.roman(r)} → ${E.roman(r + 1)}</span></span><span class="xs">${h(id === "classe" ? E.CLASS_EVEIL[c.cls] || "Renforce le passif de la classe" : E.EVEILS[id].desc(r + 1))}</span></button>`;
  openSheet(`<div class="renhead"><div class="renstage"><span class="renfl"></span>${lookImg(c, "renlook")}</div><div class="stack"><h2>${IC("phenix")} Statue du Phénix</h2><p class="small muted"><b>${h(c.name)}</b> · ${h(CLASSES[c.cls].name)} niveau ${c.lvl} · Renaissance ${E.roman(c.ren || 0)} → ${E.roman(n)} · gratuit</p>
    <div class="rencols"><div><div class="cap keep">Il garde</div><ul class="xs">${keep.map((t) => `<li>${t}</li>`).join("")}</ul></div><div><div class="cap reset">Il repart à zéro</div><ul class="xs">${reset.map((t) => `<li>${t}</li>`).join("")}</ul></div></div></div></div>
    ${err ? `<p class="note">${h(err)}</p>` : `<h3>Choisir l'Éveil de cette renaissance</h3>${E.isClassRen(n) ? `<p class="xs muted" style="margin:0">Renaissance ${E.roman(n)} : l'Éveil de classe renforce le passif ${h(CLASSES[c.cls].passive.name)}.</p>` : ""}<div class="evgrid">${choices.map(([id, r]) => ch(id, r)).join("")}</div>
    <div class="renconfirm"><span class="small">${pick ? `<b>${h(pick === "classe" ? "Éveil de classe" : E.EVEILS[pick].name)} ${E.roman(E.eveil(c, pick) + 1)}</b> · ${h(c.name)} repartira du niveau 1 avec +${Math.round(E.REN_XP * 100 * n)} % d'XP ; ses objets iront dans le sac.` : "Choisissez un Éveil pour continuer."}</span>
    <div class="row"><button class="btn primary ren" data-act="rengo" data-id="${c.id}" ${pick ? "" : "disabled"}>${IC("phenix")} Renaître</button><button class="btn" data-act="closesheet">Plus tard</button></div></div>`}`);
}
function renderRenaissance() {
  const rows = S.chars.map((c) => { const err = E.canRenaissance(S, c); const can = !err; const need = E.xpNeed(c.lvl); const full = (c.ren || 0) >= E.REN_MAX;
    return `<div class="renrow ${can ? "can" : ""}" style="--cc:${CLASSES[c.cls].color}"><button class="tart" data-act="teamgo" data-id="${c.id}" data-v="equip">${lookImg(c, "tlook")}</button>
      <div class="grow" style="min-width:0"><b>${h(c.name)}</b> ${c.ren ? `<span class="renm inline">${E.roman(c.ren)}</span>` : ""}<span class="xs muted"> ${h(CLASSES[c.cls].name)} · ${c.ren ? `Renaissance ${E.roman(c.ren)} · ${h(E.eveilSummary(c))} · +${Math.round(E.REN_XP * 100 * c.ren)} % d'XP` : "aucune renaissance"}</span>
        <div class="xpb"><i style="width:${c.lvl >= E.MAX_LVL ? 100 : pct(c.xp, need)}%"></i></div></div>
      ${full ? `<span class="tag ren">Phénix</span>` : can ? `<button class="btn sm primary ren" data-act="rensheet" data-id="${c.id}">${IC("phenix")} Renaître</button>` : `<span class="pill muted xs">${c.lvl >= E.MAX_LVL ? h(err) : `niv. ${c.lvl}`}</span>`}</div>`; }).join("");
  const tot = S.chars.reduce((a, c) => a + (c.ren || 0), 0);
  $("#main").innerHTML = `<div class="pagehead"><h1>Renaissance</h1><span class="small muted">${tot} renaissance${tot > 1 ? "s" : ""} en tout</span></div>
  <section class="panel" style="margin-bottom:12px"><div class="pad renintro"><div class="renstage small"><span class="renfl"></span>${IC("phenix", "renbig")}</div><div class="stack">
    <p class="small" style="margin:0">Au <b>niveau ${E.MAX_LVL}</b>, un héros peut renaître à la Statue du Phénix : il repart au niveau 1 en gardant son apparence, ses titres, ses Dofus, son familier et sa monture (l'équipement est rangé dans le sac). Chaque renaissance lui donne <b>+${Math.round(E.REN_XP * 100)} % d'XP</b> et un <b>Éveil</b> au choix ; aux renaissances V et X, l'Éveil de classe renforce son passif. ${E.REN_MAX} renaissances au plus : impossible de tout prendre, chaque héros se forge son caractère.</p>
    <p class="xs muted" style="margin:0">Récompenses : médaillon et aura (Braise dès la 1ʳᵉ, Flamme à la 4ᵉ, Brasier à la 7ᵉ, Phénix à la 10ᵉ), titres « Né des cendres » (I), « Flamme éternelle » (V) et « Phénix d'Idlus » (X), ornement « Ailes du Phénix » (X).</p></div></div></section>
  <section class="panel"><div class="phead"><h2>Vos héros</h2></div><div class="pad stack">${rows}</div></section>
  <section class="panel" style="margin-top:12px"><div class="phead"><h2>Les Éveils</h2><span class="xs muted">3 rangs chacun</span></div><div class="pad achgrid">${E.EVEIL_ORDER.map((id) => `<div class="ach ok"><span class="ic">${G("sparkle")}</span><span><b>${h(E.EVEILS[id].name)}</b><br><span class="xs muted">${h([1, 2, 3].map((r) => E.EVEILS[id].desc(r).replace(/^\+/, "+")).join(" · "))}</span></span></div>`).join("")}<div class="ach ok cls"><span class="ic">${IC("phenix")}</span><span><b>Éveil de classe</b><br><span class="xs muted">Renaissances V et X : renforce le passif de la classe, différent pour chacune des 19 classes</span></span></div></div></section>`;
}
function recruitSheet() {
  const cost = E.recruitCost(S.chars.length + 1); const top = Math.max(...S.chars.map((c) => c.lvl)); const sex = ui.startSex || CLASSES[ui.startCls].sex;
  openSheet(`<h2>Recruter un héros</h2>
    <p class="small muted">Coût : <b>${cost ? fmt(cost) + " kamas" : "gratuit"}</b> (vous avez ${fmt(S.kamas)}). La recrue arrive au niveau ${Math.max(1, Math.floor(top / 2))}. Plus l'équipe est grande, plus le bonus Esprit Libre diminue.</p>
    ${classPick(ui.startCls, sex)}${classInfo(ui.startCls, sex, startHeadOf(ui.startCls, sex))}
    <div class="row"><span class="small muted">Apparence</span><span class="seg">${[["m", "Masculin"], ["f", "Féminin"]].map(([v, n]) => `<button data-act="startsex" data-v="${v}" aria-pressed="${sex === v}">${n}</button>`).join("")}</span></div>
      ${headPick(ui.startCls, sex)}
    <label class="stack" style="gap:4px"><span class="small muted">Nom</span><input type="text" id="recName" maxlength="20" value="${h(ui.recName || D.NAMES[Math.floor(Math.random() * D.NAMES.length)])}"></label>
    <div class="row"><button class="btn primary" data-act="recruit" ${S.kamas < cost ? "disabled" : ""}>Recruter</button><button class="btn" data-act="closesheet">Annuler</button></div>`);
}
function giveSheet(uid) {
  const it = S.items[uid]; const T = ITEMS[it.tpl]; ui.giveTo = uid;
  openSheet(`<div class="row">${itemIcon(it)}<h2>${itemName(it)}</h2></div><p class="small muted">Niveau ${T.lvl} requis<br>${itemStatsHtml(it)}</p>
    <div class="list">${S.chars.map((c) => { const slot = E.slotFor(c, it);
      return `<div class="li">${head(c)}<span class="grow"><span class="name">${h(c.name)}</span> <span class="muted xs">niv. ${c.lvl}</span><br>${deltaHtml(c, slot, uid)}</span><button class="btn sm primary" data-act="giveto" data-id="${c.id}" ${T.lvl > c.lvl ? "disabled" : ""}>${T.lvl > c.lvl ? "Niv. trop bas" : "Équiper"}</button></div>`; }).join("")}</div>
    <div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function gatherSheet() {
  const g = ui.gs; const c = char(g.cid) || S.chars[0]; g.cid = c.id;
  if (!g.job) g.job = c.job ? c.job.job : "bucheron";
  const list = E.jobRes(g.job); const lv = S.jobs[g.job].lvl;
  if (!g.res || !list.find((x) => x[0] === g.res && x[1] <= lv)) g.res = (c.job && c.job.job === g.job ? c.job.res : null) || (list.filter((x) => x[1] <= lv).pop() || [])[0];
  const per = E.gatherTime(lv) / E.gatherSpeed(S, g.job, c);
  openSheet(`<h2>${IC("pioche")} Envoyer récolter</h2>
    <p class="small muted">Le héros quitte l'équipe de chasse pendant qu'il récolte. Les niveaux de métier sont communs à tous vos héros.</p>
    <div class="stack" style="gap:8px">
      <label class="row small"><span style="min-width:90px">Héros</span><select data-act="gs" data-k="cid">${S.chars.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${h(x.name)} (niv. ${x.lvl})${x.job ? " — récolte déjà" : ""}</option>`).join("")}</select></label>
      <div class="row small"><span style="min-width:90px">Métier</span>${Object.keys(GATHER_JOBS).map((j) => `<button class="jobpick ${j === g.job ? "on" : ""}" data-act="gsjob" data-v="${j}" data-tip="${h(GATHER_JOBS[j].name)} niv. ${S.jobs[j].lvl}">${im(jobImg(j), "joblogo sm", GATHER_JOBS[j].name)}</button>`).join("")}</div>
      <div class="respick">${list.map(([r, l]) => `<button class="${r === g.res ? "on" : ""}" data-act="gsres" data-v="${h(r)}" ${l > lv ? "disabled" : ""} data-tip="${h(r)} · niveau ${l}${l > lv ? " (verrouillé)" : ""} · en stock : ${fmt(S.res[r] || 0)}">${im(resImg(r), "ico", r)}<span class="xs">${h(r)}</span>${l > lv ? `<i class="xs">niv. ${l}</i>` : ""}</button>`).join("")}</div>
      ${g.res ? `<div class="small muted">≈ ${per.toFixed(1)} s par récolte${E.filonOn(S, g.res) ? " · <b class='plus'>filon actif ×2 !</b>" : ""}${c.cls === "sadi" && (g.job === "bucheron" || g.job === "alchimiste") ? " · passif Sadida" : ""}${c.cls === "steam" && g.job === "pecheur" ? " · passif Steamer" : ""}</div>` : ""}
    </div>
    <div class="row"><button class="btn primary" data-act="gsgo" ${g.res ? "" : "disabled"}>Envoyer</button>${c.job ? `<button class="btn" data-act="unjob" data-id="${c.id}">Rappeler pour chasser</button>` : ""}<button class="btn" data-act="closesheet">Annuler</button></div>`);
}
/* ---------- 3.2.2 : notifications ---------- */
const NOTIF_EV = [["bag", "Sac plein", "les nouveaux objets sont perdus"], ["loss", "Combat perdu", "avec le conseil « Pourquoi j'ai perdu ? »"], ["pin", "Objectif atteint", "un objectif de la bande du haut"], ["shop", "Liste de courses prête", "tout est réuni pour un objet ou une clé"], ["lvl", "Palier de niveau", "tous les 10 niveaux"], ["rare", "Évènement rare", "Champion, objet Rayonnant ou archimonstre"]];
const NOTIF_DEF = { bag: true, loss: true, pin: true, shop: true, lvl: true, rare: false };
const notifOn = (k) => { const n = S.settings.notif || {}; return n[k] === undefined ? NOTIF_DEF[k] : !!n[k]; };
const notifPerm = () => (typeof Notification === "undefined" ? "none" : Notification.permission);
function notifOptionsHtml() {
  const perm = notifPerm(); const on = !!S.settings.notifBrowser && perm === "granted";
  return `<div class="stack" style="gap:6px"><div><b>${G("bell")} Notifications</b><br><span class="muted">Un petit message dans le jeu, et une notification du navigateur quand l'onglet est en arrière-plan.</span></div>
    <div class="row"><span class="muted">Hors de l'onglet</span>${perm === "none" ? `<span class="tag soft">Non disponible sur ce navigateur</span>` : perm === "denied" ? `<span class="tag warn">Bloquées par le navigateur</span><span class="xs muted">autorisez-les dans les réglages du site</span>` : perm === "granted" ? `<span class="seg">${[[true, "Activées"], [false, "Coupées"]].map(([v, n]) => `<button data-act="setnotifb" data-v="${v ? 1 : 0}" aria-pressed="${on === v}">${n}</button>`).join("")}</span>` : `<button class="btn sm primary" data-act="notifask">Autoriser</button>`}</div>
    <div class="notifs">${NOTIF_EV.map(([k, n, d]) => `<label class="opt"><span><b>${h(n)}</b><br><span class="xs muted">${h(d)}</span></span><input type="checkbox" data-act="setnotif" data-k="${k}" ${notifOn(k) ? "checked" : ""}></label>`).join("")}</div>
    <p class="xs muted" style="margin:0">Fiable sur ordinateur. Sur téléphone, seulement tant que l'onglet reste ouvert (sur iPhone, uniquement si le jeu est installé sur l'écran d'accueil). Au plus une notification par minute.</p></div>`;
}
let notifLast = 0, notifHeld = [];
function notify(kind, title, body) {
  if (!S || !notifOn(kind)) return;
  if (!S.settings.notifBrowser || notifPerm() !== "granted" || document.visibilityState === "visible") return;
  const now = Date.now();
  if (now - notifLast < 60000) { notifHeld.push(title); clearTimeout(notify._to); notify._to = setTimeout(() => { const n = notifHeld.length; if (!n) return; const t = n === 1 ? notifHeld[0] : `${n} évènements pendant votre absence`; notifHeld = []; showNotif(t, n === 1 ? body : ""); }, 60000 - (now - notifLast) + 50); return; }
  notifLast = now; showNotif(title, body);
}
function showNotif(title, body) {
  if (document.visibilityState === "visible") return;
  const opts = { body: body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "idlus", renotify: false, silent: true };
  try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(`idlus · ${title}`, opts)).catch(() => { try { new Notification(`idlus · ${title}`, opts); } catch (e) {} }); else new Notification(`idlus · ${title}`, opts); } catch (e) {}
}
function optionsSheet() {
  openSheet(`<h2>Options</h2>
    <div class="stack small">
      <div class="row"><span class="muted">Thème</span><span class="seg">${[["emerald", "Émeraude"], ["violet", "Nuit violette"]].map(([v, n]) => `<button data-act="settheme" data-v="${v}" aria-pressed="${(S.settings.theme || "emerald") === v}">${n}</button>`).join("")}</span></div>
      <div class="row"><span class="muted">Animations de combat</span><span class="seg">${[["full", "Complètes"], ["sober", "Sobres"], ["none", "Aucune"]].map(([v, n]) => `<button data-act="setanim" data-v="${v}" aria-pressed="${animLvl() === v}">${n}</button>`).join("")}</span></div>
      <div class="row"><span class="muted">Écrans de récompense</span><span class="seg" data-tip="Grand encart pour un objet Rayonnant, un palier de 10 niveaux ou un premier passage de stasis.">${[[true, "Affichés"], [false, "Masqués"]].map(([v, n]) => `<button data-act="setcele" data-v="${v ? 1 : 0}" aria-pressed="${(S.settings.cele !== false) === v}">${n}</button>`).join("")}</span></div>
      <label class="row"><input type="checkbox" data-act="setdecofx" ${S.settings.decofx !== false ? "checked" : ""}> <span><b>Effets de décor</b> <span class="muted">(météo et premier plan dans l'arène ; à couper sur un appareil lent)</span></span></label>
      <label class="row"><input type="checkbox" data-act="setprot" ${!S.settings.protOff ? "checked" : ""}> <span><b>Protecteurs de ressources</b> <span class="muted">(un gardien apparaît parfois pendant la récolte ; le battre double la récolte 20 min)</span></span></label>
      <div class="stack" style="gap:6px"><div><b>Code cadeau</b> <span class="muted">(donné sur le Discord ; un code par partie)</span></div><div class="row"><input type="text" id="giftCode" placeholder="IDLUS-…" style="flex:1;min-width:0" autocomplete="off"><button class="btn sm primary" data-act="gift">Utiliser</button></div>${Object.keys(S.gifts || {}).length ? `<span class="xs muted">${Object.keys(S.gifts).length} code${Object.keys(S.gifts).length > 1 ? "s" : ""} déjà utilisé${Object.keys(S.gifts).length > 1 ? "s" : ""}</span>` : ""}</div>
      ${notifOptionsHtml()}
      <div><b>Sauvegarde</b><br><span class="muted">Automatique dans ce navigateur${lastSaveOk ? ` · dernière : ${new Date(lastSaveOk).toLocaleTimeString("fr-FR")}` : ""}. Pour changer d'appareil, exportez puis importez.</span></div>
      <div class="row"><button class="btn sm" data-act="savenow">Sauvegarder maintenant</button></div>
      <div class="stack" style="gap:6px"><div><b>Copies de secours</b> <span class="muted">(une toutes les 10 min de jeu, et une avant chaque mise à jour)</span></div>${copiesHtml()}</div>
      <div><b>Exporter</b><textarea id="exp" readonly>${h(btoa(unescape(encodeURIComponent(E.serialize(S)))))}</textarea><button class="btn sm" data-act="copyexp">Copier</button></div>
      <div><b>Importer</b> <span class="muted">(remplace la partie actuelle ; les sauvegardes v1 sont converties)</span><textarea id="imp" placeholder="Collez la sauvegarde ici"></textarea><button class="btn sm" data-act="import">Importer</button> <span id="impmsg" class="minus"></span></div>
      <div><b>Nouvelle partie</b><br>${ui.confirm === "reset" ? `<span class="minus">Toute la progression sera effacée.</span> <button class="btn sm danger" data-act="reset">Effacer et recommencer</button> <button class="btn sm" data-act="cancelreset">Annuler</button>` : `<button class="btn sm danger" data-act="askreset">Recommencer depuis le début</button>`}</div>
      <div class="row"><a class="btn sm" href="${DISCORD}" target="_blank" rel="noopener">${G("chat")} Discord</a><button class="btn sm" data-act="reportbug">${G("bug")} Signaler un bug</button><button class="btn sm" data-act="copydiag" data-tip="Copie la version, l'appareil, l'onglet ouvert, un résumé de la partie et les 5 dernières erreurs, à coller dans le forum Bugs">Copier le diagnostic</button></div>
      <div class="row"><button class="btn sm" data-act="changelog">Notes de mise à jour</button>${isStandalone() ? `<span class="tag good">Application installée</span>` : `<button class="btn sm primary" data-act="installgame">${G("phone")} Installer idlus</button>`}</div>
      <p class="note">Version ${GAME_VERSION} « ${h(CHANGELOG[0].name)} » · Données DOFUS via DofusDB (${h(D.META.built)}). Projet de fan non officiel, sans lien avec Ankama Games.</p>
    </div><div><button class="btn" data-act="closesheet">Fermer</button></div>`);
}
function offlineSheet(r) {
  const res = Object.entries(r.res).sort((a, b) => b[1] - a[1]);
  openSheet(`<h2>Pendant votre absence</h2>
    <p class="small">Absent ${dur(r.seconds)}. ${r.fights ? `Votre équipe a continué à ${Math.round(E.OFFLINE_RATE * 100 + E.bonus(S, "offrate"))} % de son efficacité : <b>${fmt(r.wins)}</b> combats gagnés, <span class="coin"></span> <b>+${fmt(r.kamas)}</b> kamas${r.items ? `, ${r.items} objet${r.items > 1 ? "s" : ""}` : ""}.` : "Votre équipe ne chassait pas ; seuls les héros en récolte ont travaillé."}</p>
    ${r.fights ? `<p class="xs muted">${fmt(r.fights)} combats tentés · ${Math.round((r.winRate || 0) * 100)} % de victoires (d'après vos derniers combats) · ~${r.fightLen || "?"} s par combat.</p>` : ""}
    ${r.lvls.length ? `<p class="small">${r.lvls.map(([n, a, b]) => `${G("up")} ${h(n)} : niveau ${a} → <b>${b}</b>`).join("<br>")}</p>` : ""}
    ${r.roamed && r.roamed.length ? `<p class="small">${G("star")} Chasse itinérante : ${r.roamed.map(h).join(" → ")}</p>` : ""}
    ${r.fmPlans && r.fmPlans.length ? `<p class="small">${r.fmPlans.map((p) => `${IC("forge")} Plan ${h(p.name)} : ${p.tries} tentative${p.tries > 1 ? "s" : ""}, ${p.ok} réussite${p.ok > 1 ? "s" : ""}, ${h(p.txt)}, ${fmt(p.kamas)} kamas${p.done ? ` · <b>${h(p.done)}</b>` : ""}`).join("<br>")}</p>` : ""}
    ${r.archis && r.archis.length ? `<p class="small" style="color:var(--archi);font-weight:700">Archimonstres vaincus : ${r.archis.map((k) => h(MONSTERS[k] ? MONSTERS[k].name : k)).join(", ")}</p>` : ""}
    ${r.souls && r.souls.length ? `<p class="small" style="color:var(--archi)">💜 Âmes capturées : ${r.souls.map((k) => h(MONSTERS[k] ? MONSTERS[k].name : k)).join(", ")} · ${r.stones} Pierre${r.stones > 1 ? "s" : ""} d'âme restante${r.stones > 1 ? "s" : ""}</p>` : r.archis && r.archis.length && !r.stones ? `<p class="small muted">Aucune Pierre d'âme en sac : les âmes se sont échappées.</p>` : ""}
    ${(r.newItems || []).filter((u) => S.items[u]).length ? `<h3 class="sec">Objets obtenus</h3><div class="list small" style="max-height:220px;overflow:auto">${r.newItems.filter((u) => S.items[u]).map((u) => { const it = S.items[u]; const T = ITEMS[it.tpl];
        const best = E.team(S).filter((c) => T.lvl <= c.lvl).map((c) => { const sl = T.slot === "anneau" ? (c.equip.anneau1 ? "anneau2" : "anneau1") : T.slot === "dofus" ? null : T.slot; const cur = sl ? S.items[c.equip[sl]] : null; return { c, gain: itemScore(c, it) - itemScore(c, cur) }; }).sort((a, b) => b.gain - a.gain)[0];
        return `<div class="li">${itemIcon(it)}<span class="grow">${itemName(it)} <span class="xs muted">niv. ${T.lvl} · jet ${Math.round(E.itemQuality(it) * 100)} %</span>${best && best.gain > 1 ? `<br><span class="xs" style="color:var(--good)">▲ mieux pour ${h(best.c.name)}</span>` : ""}</span>${best && best.gain > 1 ? `<button class="btn sm" data-act="offequip" data-uid="${u}" data-id="${best.c.id}">Équiper</button>` : ""}</div>`; }).join("")}</div>` : ""}
    ${res.length ? `<h3 class="sec">Ressources</h3><div class="list small" style="max-height:240px;overflow:auto">${res.map(([n, q]) => `<div class="li">${im(resImg(n), "ico sm", n)}<span class="grow">${h(n)}</span><span class="num">+${fmt(q)}</span></div>`).join("")}</div>` : ""}
    <div><button class="btn primary" data-act="closesheet">Continuer</button></div>`);
}
function migrationSheet(list) {
  openSheet(`<h2>Votre partie a été mise à jour</h2><p class="small">Niveaux, kamas, objets, ressources, métiers sont conservés.</p>
    <ul class="small">${list.map((x) => `<li>${h(x)}</li>`).join("")}</ul>
    <p class="small muted">À découvrir : la stasis des donjons (Monde › Donjons), l'apparence de vos héros (Héros › Apparence), les nouveaux passifs et les parchemins de caractéristiques.</p>
    <div><button class="btn primary" data-act="closesheet">C'est parti</button></div>`);
}

/* ---------- rendu ---------- */
/* ---------- Application installable (PWA) ---------- */
let installEvt = null;
/* 0.1.9.2 : code de diagnostic collé avec le rapport de bug (version, appareil, onglet, résumé de la partie, dernières erreurs) */
function diagText() {
  const lines = [`--- Diagnostic idlus ${GAME_VERSION}${BETA ? " (bêta)" : ""} · ${new Date().toLocaleString("fr-FR")} ---`];
  lines.push(`Appareil : ${/android/i.test(navigator.userAgent) ? "Android" : isIOS() ? "iPhone/iPad" : "PC"}${isStandalone() ? " (application)" : " (navigateur)"} · écran ${window.innerWidth}×${window.innerHeight} · thème ${document.documentElement.dataset.theme || "?"}`);
  lines.push(`Navigateur : ${navigator.userAgent.slice(0, 120)}`);
  const pg = NAV.flatMap((F) => F.pages.map((x) => [x[0], `${F.n} › ${x[1]}`])).find(([id]) => id === ui.tab); const tabName = pg ? pg[1] : ui.tab;
  lines.push(`Onglet : ${tabName}${ui.tab === "home" ? " / " + ui.home : ui.tab === "world" ? " / " + ui.world : ui.tab === "heroes" ? " / " + ui.hero : ui.tab === "inv" ? " / " + ui.inv : ui.tab === "metiers" ? " / " + ui.met : ui.tab === "forge" ? " / " + ui.fg : ""}${$("#sheet") && $("#sheet").innerHTML ? " · fenêtre ouverte" : ""}`);
  if (S) {
    const sub = S.sub && E.SUBS[S.sub]; const dg = S.dungeon && DUNGEONS[S.dungeon.id];
    lines.push(`Partie : créée le ${new Date(S.created).toLocaleDateString("fr-FR")} · ${dur(S.stats.playtime || 0)} de jeu · ${fmt(S.stats.fights || 0)} combats · ${fmt(S.kamas)} kamas · ${E.itemCount(S)} objets · vitesse ×${S.settings.speed || 1}${S.manualLive ? " · combat manuel" : ""}`);
    lines.push(`Héros : ${S.chars.map((c) => `${c.name} (${CLASSES[c.cls] ? CLASSES[c.cls].name : c.cls} ${c.lvl}${c.inTeam ? ", équipe" : c.job ? ", métier" : ""})`).join(", ")}`);
    lines.push(`Zone : ${sub ? sub.name : "aucune"}${S.hunting ? " (chasse en cours)" : ""}${dg ? ` · Donjon : ${dg.name} stasis ${S.dungeon.stasis}, salle ${(S.dungeon.room || 0) + 1}` : ""}${S.fight ? ` · combat ${S.fight.over ? "terminé" : "en cours"} (tour ${S.fight.round || "?"})` : ""}`);
    lines.push(`Forgemage ${E.fmJob(S).lvl} · Havre-Sac ${S.havre && S.havre.built ? "construit" : "non"} · ${Object.keys(S.pets || {}).length} familiers · ${Object.keys(S.mounts || {}).length} montures · ${E.fmPlanActive(S).length} plans de forgemagie`);
  } else lines.push("Partie : aucune (écran de départ)");
  const errs = readErrs();
  lines.push(errs.length ? `Dernières erreurs :\n${errs.map((e) => `  ${new Date(e.t).toLocaleTimeString("fr-FR")} ${e.txt}${e.n > 1 ? ` (×${e.n})` : ""}`).join("\n")}` : "Dernières erreurs : aucune");
  return lines.join("\n");
}
const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; renderUpdBar(); });
window.addEventListener("appinstalled", () => { installEvt = null; if (S) { S.installed = true; dirty = true; } toast("idlus est installé ! Retrouvez-le sur votre écran d'accueil.", "rare"); renderUpdBar(); });
const canInstall = () => !isStandalone() && (installEvt || isIOS());
function installGame() {
  if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(() => { installEvt = null; renderUpdBar(); }); return; }
  openSheet(`<h2>${G("phone")} Installer idlus</h2>${isIOS() ? `<ol class="small" style="line-height:1.7;padding-left:20px">
      <li>Ouvrez cette page dans <b>Safari</b>.</li>
      <li>Touchez le bouton <b>Partager</b> <span style="font-size:18px">⎋</span> (le carré avec une flèche vers le haut).</li>
      <li>Choisissez <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li></ol>`
    : `<p class="small">Dans le menu de votre navigateur (⋮ ou ⋯), choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>`}
    <p class="xs muted">Votre partie est conservée : l'application utilise la même sauvegarde que le site.</p><div><button class="btn primary" data-act="closesheet">Compris</button></div>`);
}
function renderUpdBar() {
  const el = $("#updbar"); if (!el) return;
  let html = "";
  if (BETA) html += `<div class="updbar"><span>${G("sparkle")} <b>Version de test</b> : partie séparée du jeu public, des bugs sont possibles.</span><button class="btn sm" data-adm="open">${G("bug")} Panel de test</button><a class="btn sm" href="../">Jeu public</a></div>`;
  if (ui.newVersion) html += `<div class="updbar new"><span>${G("sparkle")} La version <b>${h(ui.newVersion)}</b> est en ligne.</span><button class="btn sm primary" data-act="reloadgame">Recharger</button><button class="btn sm" data-act="hidenewv" aria-label="Plus tard">Plus tard</button></div>`;
  if (S && canInstall() && (S.sessions || 0) >= 3 && !S.installHide && S.seenVersion === GAME_VERSION) html += `<div class="updbar new"><span>${G("phone")} Jouez plus facilement : installez <b>idlus</b> sur votre ${isIOS() || /android/i.test(navigator.userAgent) ? "téléphone" : "ordinateur"}.</span><button class="btn sm primary" data-act="installgame">Installer</button><button class="btn sm" data-act="installhide">Non merci</button></div>`;
  if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; }
}
function changelogSheet() {
  openSheet(`<h2>Notes de mise à jour</h2><div class="stack small">${CHANGELOG.map((c) => `<div><b>${h(c.v)} « ${h(c.name)} »</b><ul>${c.items.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>`).join("")}</div><div><button class="btn primary" data-act="closesheet">Fermer</button></div>`);
}
/* nouvelle version en ligne pendant que le jeu est ouvert */
function checkNewVersion() {
  try { fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j && j.v && vNum(j.v) > vNum(GAME_VERSION) && ui.newVersion !== j.v && ui.hiddenV !== j.v) { ui.newVersion = j.v; renderUpdBar(); }
  }).catch(() => {}); } catch (e) {}
}
function render() {
  if (!S) { renderUpdBar(); return renderStart(); }
  clearDonePins(); renderNav(); renderStatus(); renderUpdBar();
  if (ui.tab === "home") renderHome();
  else if (ui.tab === "world") renderWorld();
  else if (ui.tab === "combat") renderCombat();
  else if (ui.tab === "team") renderTeam();
  else if (ui.tab === "heroes") renderHeroes();
  else if (ui.tab === "inv") renderInventory();
  else if (ui.tab === "metiers") renderMetiers();
  else if (ui.tab === "forge") renderForge();
  else if (ui.tab === "quests") renderQuests();
  else if (ui.tab === "ren") renderRenaissance();
  else { ui.tab = "home"; renderHome(); }
}
/* Moments de récompense (3.1.3) : un grand encart à la fois, qui se ferme seul ou d'un clic */
const celeQ = []; let celeOn = null;
function celebrate(ev) {
  if (S.settings.cele === false) return;
  const last = celeQ[celeQ.length - 1];
  if (ev.t === "lvl" && last && last.t === "lvl" && last.lvl === ev.lvl) { last.cids.push(ev.cid); last.frame = last.frame || ev.frame; return; }
  if (celeQ.length >= 4) return;
  celeQ.push(ev.t === "lvl" ? Object.assign({ cids: [ev.cid] }, ev) : ev);
  if (!celeOn) { celeOn = "wait"; setTimeout(nextCele, 60); }
}
function celeHtml(ev) {
  if (ev.t === "radiant") { const T = ITEMS[ev.tpl];
    return `<div class="cele-art radiant"><span class="icobox radiant">${im(itemImg(ev.tpl), "", T.name)}</span></div><div class="cele-k">${G("sparkle")} Objet Rayonnant</div><div class="cele-t">${h(T.name)}</div><div class="cele-s">+${ev.pct} % sur ses caractéristiques · niveau ${T.lvl}</div>`; }
  if (ev.t === "exo") { const T = ITEMS[ev.tpl]; if (!T) return "";
    return `<div class="cele-art radiant"><span class="icobox">${im(itemImg(ev.tpl), "", T.name)}</span></div><div class="cele-k">${G("sparkle")} Forgemagie exotique</div><div class="cele-t">${h(T.name)}</div><div class="cele-s">+1 ${h(STATS[ev.stat].name)} · niveau ${T.lvl}</div>`; }
  if (ev.t === "lvl") { const cs = ev.cids.map(char).filter(Boolean); const c = cs[0]; if (!c) return "";
    return `<div class="cele-art lvl">${cs.slice(0, 4).map((x) => LK.CLASS_LOOKS[x.cls] ? `<span class="lookwrap">${lookImg(x, "look")}</span>` : `<span class="medal" style="--cc:${CLASSES[x.cls].color}">${headTag(x.cls, x.sex, x.name)}</span>`).join("")}</div><div class="cele-k">${G("up")} Niveau supérieur</div><div class="cele-t">Niveau ${ev.lvl}</div><div class="cele-s">${h(cs.map((x) => x.name).join(", "))}${ev.frame ? ` · nouveau cadre ${h(E.FRAMES[E.frameIdx(ev.lvl)])}` : ""}</div>`; }
  if (ev.t === "ren") { const c = char(ev.cid); if (!c) return "";
    return `<div class="cele-art lvl ren">${LK.CLASS_LOOKS[c.cls] ? `<span class="lookwrap">${lookImg(c, "look")}</span>` : `<span class="medal" style="--cc:${CLASSES[c.cls].color}">${headTag(c.cls, c.sex, c.name)}</span>`}</div><div class="cele-k">${IC("phenix")} Renaissance ${E.roman(ev.n)}</div><div class="cele-t">${h(c.name)} renaît</div><div class="cele-s">${h(ev.eveil)} ${E.roman(ev.rank)} · +${Math.round(E.REN_XP * 100 * ev.n)} % d'XP${ev.title ? ` · titre « ${h(ev.title)} »` : ""}</div>`; }
  if (ev.t === "pet") { const p = E.PETS[ev.id]; if (!p) return "";
    return `<div class="cele-art pet">${im(petImg(ev.id), "celepet", p.name)}</div><div class="cele-k">${G("star")} ${p.kind === "monti" ? (p.fam === "l" ? "Montilier légendaire" : "Nouveau montilier") : "Nouveau familier"}</div><div class="cele-t">${h(p.name)}</div><div class="cele-s">Au maximum : ${h(petBonus(p.stats))}</div>`; }
  if (ev.t === "idol") { const I = E.IDOLS[ev.id]; if (!I) return "";
    return `<div class="cele-art pet">${idolPic(ev.id, "big")}</div><div class="cele-k">${G("star")} Nouvelle idole · ${h(E.IDOL_FAMS[I.fam].name)}</div><div class="cele-t">${h(I.name)}</div><div class="cele-s">${h(I.desc)} Score ${I.score}.</div>`; }
  if (ev.t === "soul") { const A = E.ARCHIS[ev.key]; if (!A) return "";
    return `<div class="cele-art pet">${im(imgM(ev.key), "celepet soulpic", A.name)}</div><div class="cele-k">${IC("dofus")} Âme capturée · ${E.soulCount(S)} / ${E.ARCHI_TOTAL}</div><div class="cele-t">${h(A.name)}</div><div class="cele-s">Archimonstre de ${h(A.base)} · ${h(archiZoneName(A.zone))}</div>`; }
  if (ev.t === "dofus") { const Df = E.DOFUS[ev.id]; if (!Df) return "";
    return `<div class="cele-art pet">${im(dofusImg(ev.id), "celepet", Df.name)}</div><div class="cele-k">${IC("dofus")} ${ev.first ? "Nouveau Dofus" : "Copie de Dofus"}</div><div class="cele-t">${h(Df.name)}</div><div class="cele-s">${h(E.dofusBonusTxt(ev.id))} · à équiper dans un emplacement Dofus</div>`; }
  if (ev.t === "ocre") { const T = E.OCRE_TIERS[ev.tier - 1]; if (!T) return "";
    return `<div class="cele-art pet">${im(dofusImg("ocre"), "celepet", "Dofus Ocre")}</div><div class="cele-k">${IC("dofus")} Éternelle moisson · palier ${ev.tier} / ${E.OCRE_TIERS.length}</div><div class="cele-t">${h(T.name)}</div><div class="cele-s">${h(T.txt)}</div>`; }
  if (ev.t === "mount") { const M = S.mounts[ev.uid]; if (!M) return "";
    return `<div class="cele-art pet">${im(mountImg(M.sp, M.c), "celepet", E.mountName(M))}</div><div class="cele-k">${G("star")} ${ev.neu ? "Nouvelle couleur" : "Nouvelle monture"}</div><div class="cele-t">${h(E.mountName(M))}</div><div class="cele-s">Au niveau ${E.MOUNT_MAX} : ${h(mountStatTxt(E.mountStatsMax(M.sp, M.c)))}</div>`; }
  if (ev.t === "stasis") { const dg = DUNGEONS[ev.did]; const C = CONSUMABLES[ev.chest];
    return `<div class="cele-art stasis">${im(imgM(dg.boss), "dgboss", MONSTERS[dg.boss].name)}<span class="chest">${emo(C.icon)}</span></div><div class="cele-k">${G("star")} Premier passage</div><div class="cele-t">Stasis ${ev.k}${ev.k >= 10 ? " · Boss légendaire vaincu" : ""}</div><div class="cele-s">${h(dg.name)} · ${h(C.name)} obtenu${ev.k < 10 ? ` · stasis ${ev.k + 1} débloquée` : ""}</div>`; }
  return "";
}
function nextCele() {
  const box = $("#cele"); if (!box) return;
  const ev = celeQ.shift(); if (!ev) { celeOn = null; box.innerHTML = ""; return; }
  const html = celeHtml(ev); if (!html) { nextCele(); return; }
  celeOn = ev;
  box.innerHTML = `<div class="cele ${ev.t} ${S.settings.reduced ? "still" : ""}" data-act="celeclose" role="status">${!S.settings.reduced ? `<span class="cele-rays"></span>` : ""}${html}</div>`;
  clearTimeout(box._to); box._to = setTimeout(closeCele, ev.t === "lvl" ? 2800 : 3600);
}
function closeCele() { const box = $("#cele"); if (!box) return; const n = box.firstElementChild; if (n && !S.settings.reduced) { n.classList.add("out"); setTimeout(nextCele, 220); } else nextCele(); }
/* Entrée des boss (3.1.3) : nom en grand, stasis et mécaniques, au début du combat */
function bossIntro(F) {
  const b = F.ents[F.bossIdx]; const arena = $("#arena"); if (!b || !arena) return;
  ui.bossIntro = F.id;
  const d = document.createElement("div"); d.className = "bossintro" + (b.legend ? " legend" : "") + (S.settings.reduced ? " still" : "");
  d.innerHTML = `<div class="bi-k">${F.stasis > 1 ? `Stasis ${F.stasis} · ` : ""}${b.legend ? "Boss légendaire" : "Boss"}</div><div class="bi-n">${h(b.name)}</div><div class="bi-m">${(b.mech || []).map((m) => `<span>${G("warn")} ${h(E.BOSS_MECHS[m].name)}</span>`).join("")}</div>`;
  arena.appendChild(d); setTimeout(() => d.remove(), 2600);
}
function phaseFlash() {
  const arena = $("#arena"); if (!arena) return; pulse(arena, "flash");
  const d = document.createElement("div"); d.className = "bossintro phase" + (S.settings.reduced ? " still" : "");
  d.innerHTML = `<div class="bi-n">Seconde phase !</div><div class="bi-k">Le boss se régénère et appelle des renforts</div>`;
  arena.appendChild(d); setTimeout(() => d.remove(), 1900);
}
let lvlToast = null;
function toast(txt, kind) {
  const box = $("#toasts");
  /* montées de niveau regroupées : « 3 héros passent niveau 59 » */
  const lv = /^(.+) passe niveau (\d+) !$/.exec(txt || "");
  if (lv) {
    if (lvlToast && lvlToast.el.isConnected && Date.now() - lvlToast.t < 2500) {
      lvlToast.names.push(lv[1]); lvlToast.t = Date.now(); const n = lvlToast.names.length; const lvls = new Set(lvlToast.lvls.concat([lv[2]])); lvlToast.lvls = [...lvls];
      lvlToast.el.innerHTML = `${G("up")} ${n} héros passent ${lvls.size === 1 ? "niveau " + lv[2] : "de niveau"}<span class="tsub">${h(lvlToast.names.join(", "))}</span>`;
      clearTimeout(lvlToast.to); const el = lvlToast.el; lvlToast.to = setTimeout(() => el.remove(), 4000); return;
    }
    const d = document.createElement("div"); d.className = "toast up"; d.innerHTML = `${G("up")} ${h(txt)}`; box.prepend(d);
    lvlToast = { el: d, names: [lv[1]], lvls: [lv[2]], t: Date.now(), to: setTimeout(() => d.remove(), 4000) };
    while (box.children.length > 3) box.lastChild.remove(); return;
  }
  const d = document.createElement("div");
  d.className = "toast " + (kind === "rare" ? "rare" : kind === "radiant" ? "radiant" : ""); d.textContent = txt; box.prepend(d);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => d.remove(), kind === "rare" || kind === "radiant" ? 6500 : 3500);
}
const msg = (r) => { if (typeof r === "string") toast(r); };
function setTheme() { const t = S && S.settings.theme === "violet" ? "violet" : "emerald"; if (S) S.settings.theme = t; document.documentElement.dataset.theme = t === "violet" ? "dark" : "emerald"; const mc = document.querySelector('meta[name="theme-color"]'); if (mc) mc.content = t === "violet" ? "#0e0b14" : "#0d100b"; document.body.classList.toggle("reduced", !!(S && S.settings.reduced)); }

/* ---------- actions ---------- */
document.addEventListener("click", (ev) => {
  const tipT = ev.target.closest("[data-tip],[data-tipitem]");
  if (!canHover && tipT && !ev.target.closest("[data-tab],[data-act]")) { showTip(tipT); return; }
  hideTip();
  const t = ev.target.closest("[data-tab],[data-act]"); if (!t) return;
  if (t.dataset.gotab && S) { ui.tab = t.dataset.gotab; closeSheet(); }
  if (t.dataset.tab) { if (!S) return; ui.newResDone = false; ui.tab = t.dataset.tab; if (t.dataset.home) ui.home = t.dataset.home; ui.slot = null; ui.confirm = null; if (ui.tab === "world" && t.closest("#nav,#subnav")) ui.zoneView = null; closeSheet(); render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.act;
  if (a === "closesheet") { if (t.classList.contains("sheet-bg") && ev.target !== t) return; closeSheet(); if (S) render(); return; }
  if (t.tagName === "SELECT" || (t.tagName === "INPUT" && t.type !== "checkbox")) return;
  const d = t.dataset; const c = ui.cid && S ? char(ui.cid) : null;
  switch (a) {
    case "startcls": { const n = $("#startName") || $("#recName"); if (n) { if (S) ui.recName = n.value; else ui.startName = n.value; } ui.startCls = d.cls; ui.startSex = null; ui.startHead = 0; if (!S) renderStart(); else recruitSheet(); return; }
    case "startsex": { const n = $("#startName") || $("#recName"); if (n) { if (S) ui.recName = n.value; else ui.startName = n.value; } ui.startSex = d.v; ui.startHead = 0; if (!S) renderStart(); else recruitSheet(); return; }
    case "starthead": { const n = $("#startName") || $("#recName"); if (n) { if (S) ui.recName = n.value; else ui.startName = n.value; } ui.startHead = +d.v; if (!S) renderStart(); else recruitSheet(); return; }
    case "startgame": { const name = ($("#startName").value || "").trim() || "Aventurier"; S = E.newState(name.slice(0, 20), ui.startCls); S.seenVersion = GAME_VERSION; S.chars[0].sex = ui.startSex || CLASSES[ui.startCls].sex; S.chars[0].head = startHeadOf(ui.startCls, S.chars[0].sex); setTheme(document.documentElement.dataset.theme || "dark"); ui.cid = S.chars[0].id; ui.tab = "world"; dirty = true; saveNow(); render(); toast("Choisissez une zone pour partir chasser !"); return; }
    case "settheme": S.settings.theme = d.v; setTheme(); optionsSheet(); render(); return;
    case "setreduced": S.settings.reduced = d.v === "1"; setTheme(); optionsSheet(); render(); return;
    case "setanim": S.settings.anim = d.v; S.settings.reduced = d.v !== "full"; setTheme(); optionsSheet(); render(); return;
    case "setcele": S.settings.cele = d.v === "1"; dirty = true; optionsSheet(); return;
    case "pin": { const p = JSON.parse(d.p); const r = E.togglePin(S, p); if (r) { toast(r); return; } toast(E.pinned(S, p) ? "Objectif suivi dans la bande du haut." : "Objectif retiré de la bande."); renderObjs(); if ($("#sheet").innerHTML) { dirty = true; return; } break; }
    case "unpin": { const p = findPin(d.key); if (p) E.togglePin(S, p); renderObjs(); dirty = true; if (ui.tab === "quests" || ui.tab === "home" || ui.tab === "heroes") break; return; }
    case "pingo": { const p = findPin(d.key); const i = p && E.pinInfo(S, p); if (!i) return; const g = i.go; ui.tab = g.tab; if (g.qt) ui.qt = g.qt; if (g.cid) { ui.cid = g.cid; ui.hero = "equip"; } if (g.tab === "home") ui.home = "apercu"; closeSheet(); window.scrollTo(0, 0); break; }
    case "xptip": ui.xpTip = ui.xpTip === ui.cid ? null : ui.cid; renderHeroes(); return;
    case "notifask": { if (typeof Notification === "undefined") return; Notification.requestPermission().then((p) => { if (p === "granted") { S.settings.notifBrowser = true; toast("Notifications autorisées."); } dirty = true; optionsSheet(); }); return; }
    case "setnotifb": S.settings.notifBrowser = d.v === "1"; dirty = true; optionsSheet(); return;
    case "losssheet": lossSheet(d.t); return;
    case "lossequip": { const r = E.equip(S, +d.id, +d.uid); if (r) { toast(r); return; } toast(`Équipé sur ${char(+d.id).name}.`); break; }
    case "lossgo": ui.tab = "heroes"; ui.cid = +d.id; ui.hero = d.v || "equip"; closeSheet(); window.scrollTo(0, 0); break;
    case "hometab": ui.home = d.v; break;
    case "havre": { const r = E.buyHavre(S, d.id); if (r) { toast(r); return; } toast(`${E.HAVRE.find((x) => x.id === d.id).name} amélioré !`); break; }
    case "hvroom": ui.hvRoom = ui.hvRoom === d.v ? null : d.v; break;
    case "fpick": furnPickSheet(d.v); return;
    case "fcatalog": furnCatalogSheet(); return;
    case "fplace": { const r = E.placeFurn(S, d.v); if (r) { toast(r); return; } closeSheet(); toast(`${d.v} placé !`); break; }
    case "funplace": E.unplaceFurn(S, d.v); break;
    case "trainpick": trainSheet(); return;
    case "trainset": { const r = E.setTraining(S, d.id === "" ? null : +d.id); if (r) { toast(r); return; } closeSheet(); break; }
    case "atbuild": { const r = E.buildAtelier(S); if (r) { toast(r); return; } break; }
    case "atpick": { const A = S.atelier; const R0 = E.atelierRecipe(A.rec); ui.at = { cid: A.cid, rec: A.rec, job: R0 ? R0.job : "bricoleur" }; atelierSheet(); return; }
    case "atcid": ui.at.cid = +d.id; atelierSheet(); return;
    case "atjob": ui.at.job = d.v; atelierSheet(); return;
    case "atrec": ui.at.rec = { k: d.k, id: d.v }; atelierSheet(); return;
    case "atgo": { const r = E.setAtelier(S, ui.at.cid, ui.at.rec); if (r) { toast(r); return; } closeSheet(); break; }
    case "atstop": E.setAtelier(S, null); break;
    case "mettab": ui.met = d.v; ui.confirm = null; break;
    case "fgtab": ui.fg = d.v; ui.confirm = null; break;
    case "qtab": ui.qt = d.v; ui.confirm = null; break;
    case "goquest": ui.tab = "quests"; ui.qt = d.v; break;
    case "gathersheet": ui.gs = { cid: d.cid ? +d.cid : (ui.cid || S.chars[0].id), job: d.job || null }; gatherSheet(); return;
    case "gsjob": ui.gs.job = d.v; ui.gs.res = null; gatherSheet(); return;
    case "gsres": ui.gs.res = d.v; gatherSheet(); return;
    case "gsgo": { const g = ui.gs; const r = E.setJob(S, g.cid, g.job, g.res); if (r) { toast(r); return; } closeSheet(); toast(`${char(g.cid).name} part récolter.`); break; }
    case "unjob": { E.setJob(S, +d.id, null); closeSheet(); break; }
    case "tool": msg(E.upgradeTool(S, d.job)); break;
    case "setshop": { let n = 0; E.setPieces(d.id).filter((t) => ITEMS[t].craft && !Object.values(S.items).some((x) => x.tpl === t)).forEach((t) => { if (!S.shop.some((e) => e.k === "tpl" && e.id === t)) { S.shop.push({ k: "tpl", id: t }); n++; } }); toast(n ? `${n} pièce${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} à la liste de courses (Accueil).` : "Ces pièces sont déjà dans la liste de courses."); break; }
    case "shoppin": { const i = S.shop.findIndex((e) => e.k === d.k && e.id === d.id); if (i >= 0) { S.shop.splice(i, 1); toast("Retiré de la liste de courses."); } else { S.shop.push({ k: d.k, id: d.id }); toast("Ajouté à la liste de courses (Accueil)."); } break; }
    case "shopdel": S.shop.splice(+d.i, 1); break;
    case "rescat": ui.resCat = d.v; break;
    case "resview": ui.resView = d.v; break;
    case "ressel": ui.resSel = d.n || null; break;
    case "resfav": if (S.resFav[d.n]) delete S.resFav[d.n]; else S.resFav[d.n] = 1; break;
    case "respickmode": ui.resPick = !ui.resPick; ui.resPicked = new Set(); break;
    case "respick": { ui.resPicked = ui.resPicked || new Set(); if (ui.resPicked.has(d.n)) ui.resPicked.delete(d.n); else ui.resPicked.add(d.n); break; }
    case "sellpicked": { let k = 0; (ui.resPicked || new Set()).forEach((n) => (k += E.sellRes(S, n, S.res[n] || 0))); ui.resPicked = new Set(); ui.resPick = false; toast(`Vendu pour ${fmt(k)} kamas.`); break; }
    case "asksellunused": ui.confirm = "sellunused"; break;
    case "sellunused": { const IX = resIndex(); let k = 0; Object.keys(S.res).forEach((n) => { if (!IX.use[n] && !E.isKey(n) && n !== E.RARE_COMPONENT && !S.resFav[n]) k += E.sellRes(S, n, S.res[n]); }); ui.confirm = null; toast(`Ressources inutilisées vendues : ${fmt(k)} kamas.`); break; }
    case "fmfav": { const it = S.items[+d.uid]; if (it) it.fav = !it.fav; break; }
    case "fmtoggle": ui.fmF[d.k] = !ui.fmF[d.k]; break;
    case "fmsel": ui.fmSel = +d.uid; break;
    case "fmgo": ui.tab = "forge"; ui.fg = "fm"; ui.fmSel = +d.uid; window.scrollTo(0, 0); break;
    case "fm": { const r = E.forgemage(S, ui.fmSel, d.k); if (r.err) { toast(r.err); return; } toast(r.txt, r.ok ? "rare" : ""); break; }
    case "exo": { const r = E.exoForge(S, ui.fmSel, d.k); if (r.err) { toast(r.err); return; } toast(r.txt, r.ok ? "rare" : ""); break; }
    case "fmplan": fmPlanSheet(+d.uid); return;
    case "fmplango": { const goals = {}; document.querySelectorAll(".fmg:checked").forEach((x) => { const i = $("#fmgv_" + x.dataset.k); goals[x.dataset.k] = i ? +i.value : 0; });
      const rr = document.querySelector('input[name="fmr"]:checked'); const err = E.startFmPlan(S, +d.uid, { goals, runes: rr ? rr.value : "all", budget: +($("#fmbudget") || {}).value || 0, floor: ($("#fmfloor") || {}).value });
      if (err) { toast(err); return; } closeSheet(); toast("Plan de forgemagie lancé."); break; }
    case "fmplanstop": E.stopFmPlan(S, +d.uid); break;
    case "fmplandrop": E.stopFmPlan(S, +d.uid, true); break;
    case "exocraft": { const r = E.exoCraft(S, d.k, ui.ga); toast(r || `1 ${E.runeName(E.exoKey(d.k))} obtenue !`, r ? "" : "rare"); break; }
    case "reroll": msg(E.rerollBounty(S, +d.id)); break;
    case "buyshop": msg(E.buyShop(S, d.shop, d.id)); break;
    case "align": { const r = E.chooseAlign(S, d.side, d.order); ui.confirm = null; if (r) { toast(r); return; } break; }
    case "asktraitre": ui.confirm = "traitre"; break;
    case "almanax": { const r = E.almanaxOffer(S); if (r) { toast(r); return; } break; }
    case "manual": S.settings.manual = d.v === "1"; toast(S.settings.manual ? "Mode manuel : à chaque tour d'un héros, choisissez un sort puis une cible." : "Mode automatique."); break;
    case "mspell": { const F = S.fight; if (!F || !F.await) return; const me = F.ents[F.await.ei]; const sp = E.spellDef(me.cls, d.id);
      if (["dmg", "drain", "dot", "aoe", "heal"].includes(E.spellKind(E.spellGrade(sp, me.lvl)))) { ui.manualSpell = ui.manualSpell === sp.id ? null : sp.id; const bar = $("#spells"); if (bar) bar.dataset.k = ""; updateCombat(false); return; }
      const r = E.manualCast(S, sp.id, null); if (r) toast(r); ui.manualSpell = null; updateCombat(false); return; }
    case "mtarget": { const F = S.fight; if (!F || !F.await || !ui.manualSpell) return; const r = E.manualCast(S, ui.manualSpell, +t.dataset.i); if (r) { toast(r); return; } ui.manualSpell = null; const bar = $("#spells"); if (bar) bar.dataset.k = ""; updateCombat(false); return; }
    case "mend": E.manualEnd(S); ui.manualSpell = null; updateCombat(false); return;
    case "noop": return;
    case "installgame": installGame(); return;
    case "looksheet": ui.lookCid = +d.id; lookSheet(char(+d.id)); return;
    case "looksex": { const x = char(ui.lookCid); x.sex = d.v; dirty = true; lookSheet(x); render(); return; }
    case "lookhead": { const x = char(ui.lookCid); x.head = +d.v; dirty = true; lookSheet(x); render(); return; }
    case "lookpal": { const x = char(ui.lookCid); x.palette = d.v; dirty = true; lookSheet(x); render(); return; }
    case "reportbug": { const txt = `🐞 Bug — idlus ${GAME_VERSION}\nCe qui s'est passé :\nCe que j'attendais :\nÉtapes pour reproduire :\n\n${diagText()}`;
      const open = () => window.open(DISCORD_BUGS, "_blank", "noopener");
      try { navigator.clipboard.writeText(txt).then(() => { toast("Modèle de rapport copié : ouvrez un fil dans le forum Bugs et collez-le."); open(); }, open); } catch (e) { open(); } return; }
    case "gift": { const r = E.redeemGift(S, ($("#giftCode") || {}).value || ""); if (r.err) { toast(r.err); return; } dirty = true; saveNow(); closeSheet(); render(); return; } /* la note « rare » du moteur s'affiche déjà en bulle */
    case "protgo": { const r = E.protFight(S); if (r) { toast(r); return; } toast("L'équipe affrontera le protecteur au prochain combat."); break; }
    case "copydiag": { const txt = diagText(); try { navigator.clipboard.writeText(txt).then(() => toast("Diagnostic copié : collez-le dans votre rapport de bug."), () => { prompt("Copiez ce diagnostic :", txt); }); } catch (e) { prompt("Copiez ce diagnostic :", txt); } return; }
    case "installhide": S.installHide = true; dirty = true; renderUpdBar(); return;
    case "updseen": S.seenVersion = GAME_VERSION; dirty = true; renderUpdBar(); return;
    case "changelog": S.seenVersion = GAME_VERSION; dirty = true; renderUpdBar(); renderStatus(); changelogSheet(); return;
    case "reloadgame": saveNow(); location.reload(); return;
    case "hidenewv": ui.hiddenV = ui.newVersion; ui.newVersion = null; renderUpdBar(); return;
    case "offequip": { const r = E.equip(S, +d.id, +d.uid); if (r) { toast(r); return; } t.replaceWith(Object.assign(document.createElement("span"), { className: "tag good", textContent: "équipé" })); dirty = true; return; }
    case "usecons": { if (CONSUMABLES[d.id] && CONSUMABLES[d.id].kind === "scroll") { const C = CONSUMABLES[d.id];
        openSheet(`<h2>${IC("quetes")} ${h(C.name)}</h2><p class="small muted">${h(C.desc)} Choisissez le héros.</p><div class="list">${S.chars.map((x) => `<div class="li">${head(x)}<span class="grow"><b>${h(x.name)}</b> <span class="xs muted">${STATS[C.stat].name} par parchemins : ${(x.scrolls || {})[C.stat] || 0}/${E.SCROLL_MAX}</span></span><button class="btn sm primary" data-act="scrollto" data-id="${x.id}" data-sid="${d.id}" ${E.scrollRoom(x, C.stat) <= 0 ? "disabled" : ""}>Utiliser</button></div>`).join("")}</div><div><button class="btn" data-act="closesheet">Annuler</button></div>`); return; }
      if (d.id === "potion_savoir") { openSheet(`<h2>${IC("parchemin_or")} Potion de Savoir</h2><p class="small muted">Choisissez le métier qui reçoit l'expérience.</p><div class="list">${Object.entries(GATHER_JOBS).map(([j, J]) => `<div class="li">${im(jobImg(j), "joblogo sm", J.name)}<span class="grow"><b>${J.name}</b> <span class="xs muted">niv. ${S.jobs[j].lvl}</span></span><button class="btn sm primary" data-act="savoir" data-job="${j}">Choisir</button></div>`).join("")}</div><div><button class="btn" data-act="closesheet">Annuler</button></div>`); return; }
      const C = CONSUMABLES[d.id]; const r = E.useConsumable(S, d.id); if (r) { toast(r); return; } if (C.kind === "boost") toast(`${C.name} activé.`); break; }
    case "scrollto": { const r = E.useConsumable(S, d.sid, +d.id); closeSheet(); if (r) { toast(r); return; } toast(`${CONSUMABLES[d.sid].name} utilisé sur ${char(+d.id).name}.`); break; }
    case "savoir": { const r = E.useConsumable(S, "potion_savoir", d.job); closeSheet(); if (r) { toast(r); return; } break; }
    case "invsel": ui.invSel = d.tpl || null; break;
    case "lock": { const it = S.items[+d.uid]; if (it) it.locked = !it.locked; break; }
    case "autotoggle": ui.autoOpen = !t.parentElement.open; return;
    case "autonow": { let n = 0; Object.values(S.items).forEach((it) => { if (!E.equippedBy(S, it.uid) && E.applyAuto(S, it)) n++; }); toast(n ? `${n} objet${n > 1 ? "s" : ""} traité${n > 1 ? "s" : ""}.` : "Aucun objet concerné."); break; }
    case "leavedg": E.leaveDungeon(S); break;
    case "stophunt": msg(E.stopHunt(S)); break;
    case "hunt": { const r = E.startHunt(S, d.id); if (r) { toast(r); return; } ui.tab = "combat"; ui.zoneView = null; window.scrollTo(0, 0); break; }
    case "zoneview": ui.zoneView = d.id; window.scrollTo(0, 0); break;
    case "zoneback": ui.zoneView = null; break;
    case "worldtab": ui.world = d.v; break;
    case "maptier": ui.mapTier = +d.v; break;
    case "zonefold": { const t = String(mapTier()); mapOpenZone(+t); ui.mapOpen[t] = ui.mapOpen[t] === d.id ? null : d.id; break; }
    case "enczone": ui.encZone = d.v; break;
    case "enterdg": { const r = E.enterDungeon(S, d.id, ui.dgSel === d.id ? ui.dgStasis : undefined, ui.dgSel === d.id ? ui.dgChain || 1 : 1); if (r) { toast(r); return; } closeSheet(); ui.tab = "combat"; ui.zoneView = null; break; }
    case "dgopen": { if (ev.target.closest("[data-act=dgfav]")) return; ui.dgSel = d.id; ui.dgStasis = null; ui.dgChain = 1; dungeonSheet(d.id); return; }
    case "dgfav": { ev.stopPropagation(); S.dgFav = S.dgFav || []; const i = S.dgFav.indexOf(d.id); if (i >= 0) S.dgFav.splice(i, 1); else S.dgFav.push(d.id); break; }
    case "dgfilter": ui.dgFilter = d.v; break;
    case "dgstasis": ui.dgStasis = +d.v; dungeonSheet(ui.dgSel); return;
    case "dgcraftkey": { const r = E.craftSpecial(S, DUNGEONS[d.id].key); if (typeof r === "string") { toast(r); return; } toast("Clé fabriquée."); dirty = true; dungeonSheet(d.id); return; }
    case "combatcid": ui.combatCid = +d.id; break;
    case "cview": S.settings.cview = d.v; dirty = true; break;
    case "ctab": ui.ctab = d.v; { const g = document.querySelector(".combatgrid"); if (g) { g.dataset.ctab = d.v; g.querySelectorAll(".ctabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === d.v)); } } return;
    case "gospells": ui.tab = "heroes"; ui.hero = "spells"; ui.cid = ui.combatCid || ui.cid; break;
    case "options": ui.confirm = null; optionsSheet(); return;
    case "selchar": ui.cid = +d.id; ui.slot = null; break;
    case "setmain": S.mainHero = +d.id; dirty = true; toast(`${char(+d.id).name} devient le héros principal.`); break;
    case "teamgo": { if (d.v === "havre") { ui.tab = "home"; ui.home = "havre"; } else { ui.cid = +d.id; ui.tab = "heroes"; ui.hero = d.v; ui.slot = null; } closeSheet(); render(); window.scrollTo(0, 0); return; }
    case "teamfix": { const cc = char(+d.id); if (d.v === "gear") { const n = equipBest(cc); toast(n ? `${cc.name} : ${n} objet${n > 1 ? "s" : ""} équipé${n > 1 ? "s" : ""}.` : "Rien de mieux à équiper."); dirty = true; break; }
      ui.cid = cc.id; ui.tab = "heroes"; ui.hero = d.v === "pts" ? "stats" : "pet"; ui.slot = null; render(); window.scrollTo(0, 0); return; }
    case "teamequipall": { let n = 0; E.team(S).forEach((x) => (n += equipBest(x))); toast(n ? `${n} objet${n > 1 ? "s" : ""} équipé${n > 1 ? "s" : ""}.` : "Rien de mieux à équiper."); dirty = true; break; }
    case "teamboard": ui.teamBoard = !ui.teamBoard; ui.teamSel = null; break;
    case "teamsel": { const sel = ui.teamSel != null ? char(ui.teamSel) : null; const tc = char(+d.id);
      /* un héros est déjà choisi et on touche un héros d'une autre zone : on l'y envoie */
      if (sel && tc && sel !== tc && teamZone(sel) !== teamZone(tc)) { ui.teamSel = null; const z = teamZone(tc) === "atelier" ? "rest" : teamZone(tc); msg(teamMove(sel.id, z)); dirty = true; break; }
      ui.teamSel = ui.teamSel === +d.id ? null : +d.id; break; }
    case "teamdrop": { if (ui.teamSel == null) return; const id = ui.teamSel; ui.teamSel = null; msg(teamMove(id, d.v)); dirty = true; break; }
    case "teammove": msg(teamMove(+d.id, d.v)); dirty = true; break;
    case "compsave": { const i = +d.i; const r = E.saveComp(S, i, i >= 0 ? null : null); if (r) { toast(r); return; } toast(i >= 0 ? "Composition mise à jour." : "Équipe enregistrée."); dirty = true; break; }
    case "compdel": { E.delComp(S, +d.i); dirty = true; break; }
    case "compuse": { const r = E.applyComp(S, +d.i); if (r.err) { toast(r.err); return; } toast(`Composition « ${S.comps[+d.i].name} » en place.${r.moved.length ? ` ${r.moved.join(", ")} ${r.moved.length > 1 ? "reviennent" : "revient"} dans l'équipe.` : ""}`); dirty = true; if (d.dg) { dungeonSheet(d.dg); renderNav(); return; } break; }
    case "setrow": { const r = E.setRow(S, +d.id, d.v); if (r) { toast(r); return; } dirty = true; break; }
    case "placeautob": E.setPlaceAuto(S, true); dirty = true; break;
    case "lossplace": ui.tab = "heroes"; ui.placeFlash = true; closeSheet(); setTimeout(() => { const p = $("#placement"); if (p) p.scrollIntoView({ block: "center" }); ui.placeFlash = false; }, 60); break;
    case "herotab": ui.hero = d.v; ui.slot = null; break;
    case "peton": msg(E.equipPet(S, c.id, +d.uid)); dirty = true; break;
    case "petoff": E.equipPet(S, c.id, null); dirty = true; break;
    case "petkeep": S.petKeep[d.r] = !S.petKeep[d.r]; if (!S.petKeep[d.r]) delete S.petKeep[d.r]; dirty = true; break;
    case "petcoll": ui.petColl = d.v; ui.petAll = false; break;
    case "petall": ui.petAll = true; break;
    case "mounton": msg(E.equipMount(S, c.id, +d.uid)); dirty = true; break;
    case "mountoff": E.equipMount(S, c.id, null); dirty = true; break;
    case "mountshare": E.setMountShare(S, c.id, +d.v); dirty = true; break;
    case "buynet": { const r = E.buyNets(S, 1); if (r) { toast(r); return; } toast("Filet de capture acheté."); dirty = true; break; }
    case "enclosbuild": { const r = E.buildEnclos(S); if (r) { toast(r); return; } dirty = true; break; }
    case "mtsp": ui.mtSp = d.v; break;
    case "mtreesp": ui.mtSp = d.v; mountTreeSheet(); return;
    case "mtree": mountTreeSheet(); return;
    case "breedpick": ui.breedA = d.reset ? null : ui.breedA; breedPickSheet(); return;
    case "breedsel": ui.breedA = +d.uid; breedPickSheet(); return;
    case "breed": { const r = E.startBreed(S, +d.a, +d.b); if (r) { toast(r); return; } ui.breedA = null; closeSheet(); toast("Le couple est à l'enclos."); dirty = true; break; }
    case "breedstop": { const r = E.stopBreed(S, +d.i); if (r) { toast(r); return; } dirty = true; break; }
    case "toggleteam": msg(E.toggleTeam(S, +d.id)); break;
    case "alloc": E.allocate(S, c.id, d.k, +d.n); break;
    case "dealloc": E.deallocate(S, c.id, d.k, +d.n); break;
    case "allocmode": { const x = char(+d.id); E.setAllocMode(S, x, d.v === "1"); if (!x.spellsManual) E.refreshSpells(x, E.charStats(S, x)); break; }
    case "resetpts": E.resetPoints(S, +d.id); toast("Points réinitialisés" + (char(+d.id).autoStat ? " et redistribués." : ".")); break;
    case "craftscroll": { ev.preventDefault(); const r = E.craftScroll(S, d.k); if (r) { toast(r); return; } toast(`Petit parchemin de ${STATS[d.k].name} fabriqué : utilisez-le avec le lien « à utiliser ».`); break; }
    case "usescroll": { ev.preventDefault(); const k = d.k; const ids = ["parch_" + k + "_g", "parch_" + k + "_p"].filter((id) => S.cons[id] > 0); let n = 0, r = null;
      for (const id of ids) while (S.cons[id] > 0 && !(r = E.useConsumable(S, id, c.id))) n++;
      toast(n ? `${n} parchemin${n > 1 ? "s" : ""} utilisé${n > 1 ? "s" : ""} sur ${c.name}.` : r || "Rien à utiliser."); break; }
    case "slot": ui.slot = d.slot || null; break;
    case "equip": msg(E.equip(S, c.id, +d.uid, ui.slot)); ui.slot = null; break;
    case "unequip": E.unequip(S, c.id, d.slot); ui.slot = null; break;
    case "spup": case "spdown": { const i = +d.i, j = a === "spup" ? i - 1 : i + 1; if (j < 0 || j >= c.spells.length) return; [c.spells[i], c.spells[j]] = [c.spells[j], c.spells[i]]; ui.spSel = j; c.activePreset = null; c.spellsManual = true; break; }
    case "sprem": ui.spUndo = null; c.spells.splice(+d.i, 1); ui.spSel = Math.max(0, Math.min(+d.i, c.spells.length - 1)); c.activePreset = null; c.spellsManual = true; break;
    case "spsel": ui.spSel = +d.i; break;
    case "spprev": ui.spPrevMode = d.k; break;
    case "spput": { const r = spPlace(c, d.id, +d.i, true); if (r) { toast(r); return; } ui.spUndo = null; break; }
    case "spopt": { const old = c.spells.map((x) => ({ ...x })); const r = spOptimize(c);
      if (!r.best) { toast("La barre est déjà bien rangée pour ce combat."); return; }
      c.spells = r.best; c.spellsManual = true; c.activePreset = null; ui.spUndo = { cid: c.id, spells: old }; ui.spSel = 0; toast(`Barre rangée : +${r.gain} % de dégâts sur 3 tours.`); break; }
    case "spundo": if (ui.spUndo && ui.spUndo.cid === c.id) { c.spells = ui.spUndo.spells; c.activePreset = null; c.spellsManual = true; } ui.spUndo = null; break;
    case "spfilt": ui.spFilt = d.k; break;
    case "spcondc": case "sptgtc": { const x = c.spells[ui.spSel || 0]; if (!x) return; ui.spUndo = null; x[a === "spcondc" ? "cond" : "tgt"] = d.k; c.activePreset = null; c.spellsManual = true; break; }
    case "spg": { const i = c.spells.findIndex((x) => x.id === d.id); if (i >= 0) { ui.spSel = i; break; } ui.spUndo = null;
      const full = c.spells.length >= E.spellSlots(c); const sel = ui.spSel || 0; const old = full && c.spells[sel] ? E.spellDef(c.cls, c.spells[sel].id) : null;
      const r = spPlace(c, d.id, sel); if (r) { toast(r); return; }
      const sp = E.spellDef(c.cls, d.id); const was = c.spells.length && old && !c.spells.some((x) => x.id === old.id) ? old : null;
      toast(was ? `${sp.name} remplace ${was.name}.` : `${sp.name} est dans la barre.`); break; }
    case "spadd": { const r = E.equipSpell(S, c, d.id); if (r) { toast(r); return; } c.activePreset = null; break; }
    case "psave": { const old = c.presets[+d.i]; const name = old ? old.name : (prompt("Nom de la stratégie :", ["Farm", "Boss", "Solo", "Donjon"][+d.i] || "Stratégie") || "").trim(); if (!old && !name) return; E.savePreset(S, c.id, +d.i, name); toast("Stratégie enregistrée."); break; }
    case "pload": E.applyPreset(S, c.id, +d.i); toast(`Stratégie « ${c.presets[+d.i].name} » chargée.`); break;
    case "pdel": E.deletePreset(S, c.id, +d.i); break;
    case "buildsheet": ui.buildRead = null; ui.buildIn = ""; buildSheet(+d.id); return;
    case "buildcopy": { const ta = $("#buildOut"); try { navigator.clipboard.writeText(ta.value).then(() => toast("Code du build copié."), () => { ta.select(); toast("Sélectionnez puis copiez le texte."); }); } catch (e) { ta.select(); } return; }
    case "buildread": { ui.buildIn = $("#buildIn").value; const b = E.parseBuild(ui.buildIn); if (!b) { ui.buildRead = null; const m = $("#buildMsg"); if (m) m.textContent = "Ce texte n'est pas un code de build valide."; return; } ui.buildRead = b; buildSheet(ui.buildCid); return; }
    case "buildapply": { const b = ui.buildRead; const tc = char(ui.buildCid); if (!b || !tc) return; const r = E.applyBuild(S, tc.id, b); if (r) { toast(r); return; } dirty = true; toast(`Build appliqué à ${tc.name}.`); closeSheet(); ui.cid = tc.id; ui.hero = "spells"; break; }
    case "buildshop": { const b = ui.buildRead; if (!b) return; let n = 0; Object.values(b.eq).forEach((t) => { if (ITEMS[t].craft && !S.shop.some((e) => e.id === t)) { S.shop.push({ k: "tpl", id: t }); n++; } }); dirty = true; toast(`${n} objet${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} à la liste de courses (Accueil).`); buildSheet(ui.buildCid); return; }
    case "celeclose": clearTimeout($("#cele")._to); closeCele(); return;
    case "gsave": { const old = (c.gear || [])[+d.i]; const name = old ? old.name : (prompt("Nom de la tenue :", ["Chasse", "Donjon", "Prospection"][+d.i] || "Tenue") || "").trim(); if (!old && !name) return; E.saveGear(S, c.id, +d.i, name); toast("Tenue enregistrée."); break; }
    case "gload": { const r = E.applyGear(S, c.id, +d.i); if (r) toast(`Tenue « ${c.gear[+d.i].name} » portée.${r.missing ? ` ${r.missing} objet${r.missing > 1 ? "s" : ""} introuvable${r.missing > 1 ? "s" : ""} ou de niveau trop élevé.` : ""}`); break; }
    case "gren": { const g = (c.gear || [])[+d.i]; if (!g) return; const name = (prompt("Nouveau nom :", g.name) || "").trim(); if (!name) return; g.name = name.slice(0, 24); break; }
    case "gdel": E.deleteGear(S, c.id, +d.i); break;
    case "pzonedel": E.setZonePreset(S, c.id, d.z, null); break;
    case "recruitsheet": recruitSheet(); return;
    case "rensheet": ui.renPick = null; renSheet(+d.id); return;
    case "renpick": ui.renPick = d.v; renSheet(+d.id); return;
    case "rengo": { const err = E.renaissance(S, +d.id, ui.renPick); if (err) { msg(err); return; } ui.renPick = null; closeSheet(); dirty = true; break; }
    case "idols": idolSheet(); return;
    case "idoltog": { const r = E.toggleIdol(S, d.id); if (r) { toast(r); return; } dirty = true; idolSheet(); break; }
    case "idolclear": E.clearIdols(S); dirty = true; idolSheet(); break;
    case "idolpsave": E.savePreset(S, +d.i); dirty = true; toast(`Jeu ${+d.i + 1} enregistré : ${S.idols.active.map((x) => E.IDOLS[x].name).join(", ")}.`); idolSheet(); return;
    case "idolpload": { const r = E.loadPreset(S, +d.i); if (r) { toast(r); return; } dirty = true; idolSheet(); break; }
    case "archis": archiSheet(); return;
    case "aztab": ui.az = d.v; archiSheet(); return;
    case "azf": ui.azf = d.v; archiSheet(); return;
    case "idolcraft": { const r = E.craftSpecial(S, E.idolCraftName(d.id)); if (r) { toast(r); return; } dirty = true; idolSheet(); break; }
    case "recruit": { const r = E.recruit(S, ui.startCls, ($("#recName").value || "").trim().slice(0, 20)); if (r) { toast(r); return; } const nc = S.chars[S.chars.length - 1]; nc.sex = ui.startSex || CLASSES[ui.startCls].sex; nc.head = startHeadOf(ui.startCls, nc.sex); ui.startHead = 0; ui.recName = ""; closeSheet(); ui.cid = nc.id; break; }
    case "invtab": ui.inv = d.v; ui.newResDone = false; break;
    case "givesheet": giveSheet(+d.uid); return;
    case "giveto": { const r = E.equip(S, +d.id, ui.giveTo); if (r) { toast(r); return; } closeSheet(); toast("Objet équipé."); break; }
    case "sellitem": { const p = E.sellItem(S, +d.uid); if (p) toast(`Vendu pour ${fmt(p)} kamas.`); break; }
    case "sellres": { const p = E.sellRes(S, d.n, +d.q); if (p) toast(`Vendu pour ${fmt(p)} kamas.`); break; }
    case "craftjob": ui.craftJob = d.v; break;
    case "craftonly": ui.craftOnly = t.checked; break;
    case "craft": { const r = d.tpl ? E.craftItem(S, d.tpl) : E.craftSpecial(S, d.special);
      if (typeof r === "string") toast(r); else if (r && r.uid) { if (!r.radiant) toast(`Fabriqué : ${ITEMS[r.tpl].name} (jet ${Math.round(E.itemQuality(r) * 100)} %)`); } else toast(`Fabriqué : ${d.special}`); break; }
    case "break": { const r = E.breakItem(S, +d.uid, ui.focus || null); if (typeof r === "string") toast(r); else toast("Runes : " + (Object.entries(r).map(([k, q]) => `${E.runeName(k)} ×${q}`).join(", ") || "aucune")); break; }
    case "askbreakall": ui.confirm = "breakall"; break;
    case "cancel": ui.confirm = null; break;
    case "breakall": { let n = 0; Object.values(S.items).forEach((it) => { if (!E.equippedBy(S, it.uid) && !it.radiant && !it.locked && !E.inGear(S, it.uid)) { E.breakItem(S, it.uid, ui.focus || null); n++; } }); ui.confirm = null; toast(`${n} objets brisés.`); break; }
    case "fmfeed": { const r = E.feedForgemage(S, d.k, +d.q); if (r) toast(`+${fmt(r.xp)} XP de Forgemage`); break; }
    case "fuse": { const r = E.fuseRunes(S, d.k, d.dir); if (r) toast(r); break; }
    case "transmute": { const r = E.transmute(S, ui.tr.from, ui.tr.to); toast(r || `1 ${E.runeName(E.runeKey(ui.tr.from.split(":")[0], ui.tr.to))} obtenue`); break; }
    case "savenow": saveNow(true); return;
    case "copyexp": { const ta = $("#exp"); try { navigator.clipboard.writeText(ta.value).then(() => toast("Sauvegarde copiée."), () => { ta.select(); toast("Sélectionnez puis copiez le texte."); }); } catch (e) { ta.select(); } return; }
    case "import": { try { const txt = decodeURIComponent(escape(atob($("#imp").value.trim()))); const N = E.deserialize(txt); if (S) pushCopy(E.serialize(S), "avant", S); S = N; ui.cid = S.chars[0].id; setTheme(S.settings.theme || "dark"); dirty = true; saveNow(); closeSheet(); ui.tab = "home"; render(); toast("Sauvegarde importée."); if (S.migration) { migrationSheet(S.migration); S.migration = null; } } catch (e) { const m = $("#impmsg"); if (m) m.textContent = "Ce texte n'est pas une sauvegarde valide."; } return; }
    case "askreset": ui.confirm = "reset"; optionsSheet(); return;
    case "askrestore": ui.confirm = "restore" + d.i; if (S) optionsSheet(); else renderStart(); return;
    case "cancelrestore": ui.confirm = null; if (S) optionsSheet(); else renderStart(); return;
    case "restorecopy": restoreCopy(+d.i); return;
    case "frompublic": { try { const txt = localStorage.getItem("dofousxen-save"); S = E.deserialize(txt); ui.cid = S.chars[0].id; setTheme(S.settings.theme || "dark"); dirty = true; saveNow(); ui.tab = "home"; render(); toast("Partie du jeu public copiée dans la version de test."); } catch (e) { toast("Aucune partie du jeu public à copier."); } return; }
    case "cancelreset": ui.confirm = null; optionsSheet(); return;
    case "reset": if (S) pushCopy(E.serialize(S), "avant", S); S = null; ui.confirm = null; closeSheet(); try { localStorage.removeItem(LS_KEY); } catch (e) {} render(); return;
    default: return;
  }
  dirty = true; render();
});
document.addEventListener("change", (ev) => {
  const t = ev.target; const a = t.dataset.act; if (!a || !S) return;
  const c = ui.cid ? char(ui.cid) : null;
  if (a === "autostat") { const x = char(+t.dataset.id); if (!t.value) { E.setAllocMode(S, x, false); } else x.autoStat = t.value; E.autoAllocate(S, x); if (!x.spellsManual) E.refreshSpells(x, E.charStats(S, x)); }
  else if (a === "autocap") { const x = char(+t.dataset.id); x.autoCap = +t.value; E.autoAllocate(S, x); }
  else if (a === "autothen") { const x = char(+t.dataset.id); x.autoThen = t.value; E.autoAllocate(S, x); }
  else if (a === "spcond") { c.spells[+t.dataset.i].cond = t.value; c.activePreset = null; c.spellsManual = true; }
  else if (a === "sptgt") { c.spells[+t.dataset.i].tgt = t.value; c.activePreset = null; c.spellsManual = true; }
  else if (a === "spauto") { c.spellsManual = !t.checked; if (t.checked) { E.refreshSpells(c, E.charStats(S, c)); toast("Sorts réoptimisés."); } }
  else if (a === "chaloff") c.chalOff = t.checked;
  else if (a === "simres") ui.simRes = +t.value;
  else if (a === "chalai") { S.settings.chalAI = t.checked; toast(t.checked ? "L'IA respecte maintenant les challenges." : "L'IA ignore les challenges."); }
  else if (a === "placeauto") { E.setPlaceAuto(S, t.checked); dirty = true; render(); return; }
  else if (a === "compname") { const k = (S.comps || [])[+t.dataset.i]; if (k) k.name = (t.value.trim() || k.name).slice(0, 24); dirty = true; return; }
  else if (a === "setprot") { S.settings.protOff = !t.checked; dirty = true; return; }
  else if (a === "setdecofx") { S.settings.decofx = t.checked; dirty = true; ui.arena = null; return; }
  else if (a === "setnotif") { S.settings.notif = S.settings.notif || {}; S.settings.notif[t.dataset.k] = t.checked; dirty = true; return; }
  else if (a === "roam") { S.settings.roam = t.checked; toast(t.checked ? `Chasse itinérante : l'équipe suivra les étoiles de zone, avec ${Math.round(E.ROAM_MALUS * 100)} % d'XP et de butin en moins.` : "Chasse itinérante désactivée."); }
  else if (a === "autozone") { S.settings.autoZone = t.checked; toast(t.checked ? "Progression automatique : l'équipe change de zone selon son niveau." : "Progression automatique désactivée."); }
  else if (a === "slotfilter") ui.slotFilter = t.value;
  else if (a === "dgsort") ui.dgSort = t.value;
  else if (a === "focusset") { S.settings.focus = t.value; toast(t.value === "auto" ? "L'équipe vise d'abord les soigneurs, chefs, invocateurs et protecteurs." : t.value === "boss" ? "L'équipe vise d'abord le boss." : "L'équipe vise d'abord le monstre le plus faible."); }
  else if (a === "dgchain") { ui.dgChain = +t.value; return; }
  else if (a === "gs") { const k = t.dataset.k; ui.gs[k] = k === "cid" ? +t.value : t.value; gatherSheet(); return; }
  else if (a === "settitle") { E.setTitle(S, +t.dataset.id, t.value); }
  else if (a === "setorn") { msg(E.setOrn(S, +t.dataset.id, t.value)); }
  else if (a === "setwing") { E.setWing(S, +t.dataset.id, t.value); }
  else if (a === "focus") ui.focus = t.value;
  else if (a === "pzone") { if (!t.value) return; E.setZonePreset(S, c.id, t.value, +t.dataset.i); toast("Stratégie associée à la zone."); }
  else if (a === "craftonly") ui.craftOnly = t.checked;
  else if (a === "autoaction") { S.settings.auto.action = t.value; ui.autoOpen = true; }
  else if (a === "autoq") { S.settings.auto.q = Math.max(0, Math.min(100, +t.value || 0)); ui.autoOpen = true; }
  else if (a === "autosets") { S.settings.auto.keepSets = t.checked; ui.autoOpen = true; }
  else if (a === "autorecycle") { S.settings.auto.recycle = t.value || false; ui.autoOpen = true; }
  else if (a === "resf") ui.resF = t.value;
  else if (a === "ressort") ui.resSort = t.value;
  else if (a === "rescap") { const v = t.value === "" ? null : Math.max(0, +t.value || 0); if (v === null) delete S.resCap[t.dataset.n]; else S.resCap[t.dataset.n] = v; toast(v === null ? "Plus de limite." : `Surplus au-delà de ${v} vendu automatiquement.`); }
  else if (a === "fmslot") ui.fmF.slot = t.value;
  else if (a === "trfrom") ui.tr.from = t.value;
  else if (a === "gafrom") ui.ga = t.value;
  else if (a === "trto") ui.tr.to = t.value;
  else if (a === "fmsort") ui.fmF.sort = t.value;
  else if (a === "fmcid") ui.fmF.cid = t.value;
  else if (a === "invsort") ui.invSort = t.value;
  else if (a === "setmode") ui.setF.mode = t.value;
  else if (a === "setcid") ui.setF.cid = +t.value;
  else return;
  dirty = true; render();
});
document.addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.dataset.act === "ressearch") { ui.resQ = t.value; const pos = t.selectionStart; renderInventory(); const n = $("#resSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act === "fmsearch") { ui.fmF.q = t.value; const pos = t.selectionStart; renderForge(); const n = $("#fmSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act === "setsearch") { ui.setF.q = t.value; const pos = t.selectionStart; renderInventory(); const n = $("#setSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act === "invsearch") { ui.invSearch = t.value; const pos = t.selectionStart; renderInventory(); const n = $("#invSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.dataset.act !== "craftsearch") return;
  ui.craftSearch = t.value; const pos = t.selectionStart; renderMetiers(); const n = $("#craftSearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
});

/* ---------- sauvegarde ---------- */
let dirty = false, lastSaveOk = 0;
function saveNow(manual) {
  if (!S) return; S.savedAt = Date.now(); S.lastTick = Date.now();
  try { const txt = E.serialize(S); localStorage.setItem(LS_KEY, txt); lastSaveOk = Date.now(); dirty = false; if (Date.now() - lastCopy() > COPY_EVERY) pushCopy(txt, "auto", S); if (manual) toast("Partie sauvegardée."); }
  catch (e) { if (manual) toast("Impossible de sauvegarder dans ce navigateur."); }
}
/* Copies de secours, à côté de la sauvegarde : 3 copies tournantes (une toutes les 10 min de jeu),
   une avant chaque mise à jour du jeu et une avant chaque restauration. Si la sauvegarde est illisible, la plus récente prend le relais. */
const COPY_KEY = LS_KEY + "-copies", VER_KEY = LS_KEY + "-version", COPY_EVERY = 10 * 60 * 1000, COPY_MAX = { auto: 3, maj: 1, avant: 1 };
let restoredCopy = null;
function readCopies() { try { const a = JSON.parse(localStorage.getItem(COPY_KEY) || "[]"); return Array.isArray(a) ? a.filter((c) => c && typeof c.txt === "string") : []; } catch (e) { return []; } }
function writeCopies(a) {
  a.sort((x, y) => y.t - x.t);
  while (a.length) { try { localStorage.setItem(COPY_KEY, JSON.stringify(a)); return; } catch (e) { a.pop(); } } // place insuffisante : on lâche la plus ancienne
  try { localStorage.removeItem(COPY_KEY); } catch (e) {}
}
function pushCopy(txt, why, st, v) {
  if (!txt) return;
  const meta = st && st.chars ? { lvl: Math.max(...st.chars.map((c) => c.lvl || 1)), n: st.chars.length } : {};
  const a = readCopies(), same = a.filter((c) => c.why === why).sort((x, y) => y.t - x.t).slice(0, COPY_MAX[why] - 1);
  writeCopies([Object.assign({ t: Date.now(), why, v: v || GAME_VERSION, txt }, meta), ...same, ...a.filter((c) => c.why !== why)]);
}
const lastCopy = () => Math.max(0, ...readCopies().filter((c) => c.why === "auto").map((c) => c.t));
/* Déménagement de l'adresse du jeu : l'ancienne adresse renvoie ici avec la sauvegarde dans l'adresse (#transfert=…).
   On ne la reprend que si ce navigateur n'a encore aucune partie ici, puis on retire le texte de l'adresse. */
function takeTransfer() {
  const m = /^#transfert=(.+)$/.exec(location.hash || ""); if (!m) return;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  try {
    if (localStorage.getItem(LS_KEY)) return;
    const txt = decodeURIComponent(escape(atob(decodeURIComponent(m[1])))); E.deserialize(txt);
    localStorage.setItem(LS_KEY, txt); transferred = true;
  } catch (e) {}
}
let transferred = false;
function loadSave() {
  takeTransfer();
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); if (raw) return E.deserialize(raw); } catch (e) {}
  if (!raw) return null;
  for (const c of readCopies()) { try { const st = E.deserialize(c.txt); restoredCopy = c; return st; } catch (e) {} } // sauvegarde illisible : copie la plus récente
  return null;
}
/* Avant de lancer une nouvelle version du jeu, on garde la partie telle qu'elle était. */
function copyBeforeUpdate(st) {
  try {
    const prev = localStorage.getItem(VER_KEY);
    if (prev !== GAME_VERSION) { const raw = localStorage.getItem(LS_KEY); if (raw && !restoredCopy) pushCopy(raw, "maj", st, prev || "précédente"); localStorage.setItem(VER_KEY, GAME_VERSION); }
  } catch (e) {}
}
function restoreCopy(i) {
  const c = readCopies()[i]; if (!c) return;
  let N; try { N = E.deserialize(c.txt); } catch (e) { toast("Cette copie est illisible."); return; }
  if (S) pushCopy(E.serialize(S), "avant", S);
  S = N; ui.cid = S.chars[0].id; setTheme(S.settings.theme || "dark"); dirty = true; saveNow(); ui.confirm = null; closeSheet(); ui.tab = "home"; render();
  toast(`Copie du ${copyDate(c.t)} restaurée.`);
}
const copyDate = (t) => new Date(t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function copiesHtml() {
  const a = readCopies(); if (!a.length) return `<div class="muted">Aucune copie pour l'instant.</div>`;
  const why = { auto: "copie automatique", maj: "avant la mise à jour", avant: "avant le dernier remplacement de partie" };
  return a.map((c, i) => `<div class="row"><span>${h(copyDate(c.t))} · ${why[c.why] || "copie"}${c.why === "maj" && c.v ? ` (version ${h(c.v)})` : ""}${c.lvl ? ` · ${c.n} héros, niveau ${c.lvl} max` : ""}</span>${ui.confirm === "restore" + i ? `<span class="minus">La partie actuelle sera remplacée.</span> <button class="btn sm danger" data-act="restorecopy" data-i="${i}">Restaurer</button> <button class="btn sm" data-act="cancelrestore">Annuler</button>` : `<button class="btn sm" data-act="askrestore" data-i="${i}">Restaurer</button>`}</div>`).join("");
}

/* 0.1.9.1 : glisser-déposer du plateau « Réorganiser » de la page Équipe (souris) */
document.addEventListener("dragstart", (ev) => { const t = ev.target.closest && ev.target.closest("[data-tok]"); if (!t) return; ev.dataTransfer.setData("text/plain", t.dataset.tok); ev.dataTransfer.effectAllowed = "move"; });
document.addEventListener("dragover", (ev) => { const z = ev.target.closest && ev.target.closest("[data-zone]"); if (!z) return; ev.preventDefault(); document.querySelectorAll(".tzone.over").forEach((x) => x !== z && x.classList.remove("over")); z.classList.add("over"); });
document.addEventListener("dragleave", (ev) => { const z = ev.target.closest && ev.target.closest("[data-zone]"); if (z && !z.contains(ev.relatedTarget)) z.classList.remove("over"); });
/* barre de sorts : glisser un sort de la barre ou du grimoire sur une case */
document.addEventListener("dragstart", (ev) => { const t = ev.target.closest && ev.target.closest("[data-spdrag]"); if (!t) return; ev.dataTransfer.setData("text/plain", "sp:" + t.dataset.spdrag); ev.dataTransfer.effectAllowed = "move"; hideTip(); });
document.addEventListener("dragover", (ev) => { const z = ev.target.closest && ev.target.closest("[data-spslot]"); if (!z) return; ev.preventDefault(); document.querySelectorAll(".spslot.over").forEach((e) => e !== z && e.classList.remove("over")); z.classList.add("over"); });
document.addEventListener("dragleave", (ev) => { const z = ev.target.closest && ev.target.closest("[data-spslot]"); if (z && !z.contains(ev.relatedTarget)) z.classList.remove("over"); });
document.addEventListener("drop", (ev) => { const z = ev.target.closest && ev.target.closest("[data-spslot]"); if (!z || !S) return; const v = ev.dataTransfer.getData("text/plain"); if (!v.startsWith("sp:")) return; ev.preventDefault();
  const c = char(ui.cid); if (!c) return; const to = +z.dataset.spslot; const k = v.slice(3);
  ui.spUndo = null; if (k[0] === "s") spMove(c, +k.slice(1), to); else { const r = spPlace(c, k.slice(1), to, "move"); if (r) toast(r); }
  dirty = true; render(); });
document.addEventListener("drop", (ev) => { const z = ev.target.closest && ev.target.closest("[data-zone]"); if (!z || !S) return; ev.preventDefault(); const id = +ev.dataTransfer.getData("text/plain"); if (!id) return; ui.teamSel = null; msg(teamMove(id, z.dataset.zone)); dirty = true; render(); });

/* ---------- boucle ---------- */
let testSpeed = 1; // panel de test (béta uniquement) : accélération du temps
let last = performance.now(), sinceSave = 0, sinceView = 0, sinceRes = 0, lastRes = {};
const isEditing = () => { const a = document.activeElement; return a && (a.tagName === "SELECT" || a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
function loop() {
  const now = performance.now(); const dt = Math.min(now - last, 5000); last = now;
  if (S) {
    if (BETA && E.grantPioneer(S)) { dirty = true; toast("Merci de tester Idlus ! Titre « Pionnier d'Idlus » et ornement « Pousse du Pionnier » débloqués (onglet Héros).", "rare"); }
    S.manualLive = document.visibilityState === "visible" && ui.tab === "combat";
    E.tick(S, dt * (BETA ? testSpeed : 1)); S.lastTick = Date.now();
    sinceSave += dt; sinceView += dt;
    if (E.events.length) { E.events.splice(0).forEach((ev) => { if (ev.kind === "cele") { celebrate(ev); return; }
        if (ev.kind === "loss") { if (notifOn("loss")) { toast(ev.txt, "loss"); notify("loss", "Défaite", ev.txt); } return; }
        if (["rare", "up", "radiant"].includes(ev.kind) || (ev.kind === "loot" && /^Butin : Clef/.test(ev.txt))) toast(ev.txt, ev.kind);
        const lv = /^(.+) passe niveau (\d+) !$/.exec(ev.txt || ""); if (lv && +lv[2] % 10 === 0) notify("lvl", `${lv[1]} passe niveau ${lv[2]}`, "");
        else if (/^Sac plein/.test(ev.txt || "")) notify("bag", "Sac plein", "Les nouveaux objets sont perdus : faites de la place.");
        else if (ev.kind === "radiant" || /^(Archimonstre|Champion) vaincu|^Un Champion apparaît/.test(ev.txt || "")) notify("rare", ev.txt.replace(/\s*!$/, ""), ""); }); dirty = true; }
    const k = $("#stKamas"); if (k) k.textContent = fmt(S.kamas);
    const sb = $("#stBoost"); if (sb) { const ab = activeBoosts(); if (ab.length) sb.textContent = dur(Math.min(...ab.map((b) => b.left))); else renderStatus(); }
    const kl = $("#stKills"); if (kl) kl.textContent = fmt(Object.values(S.bestiary).reduce((a, b) => a + b, 0));
    if (ui.tab === "combat") updateCombat(false);
    else if (ui.tab === "metiers" && ui.met === "recolte") {
      document.querySelectorAll("[data-wprog]").forEach((b) => { const c = char(+b.dataset.wprog); if (c && c.job) b.firstElementChild.style.width = pct(c.job.prog, E.gatherPeriod(S, c)) + "%"; });
      if (sinceView > 4000 && !isEditing() && !$("#sheet").innerHTML) { sinceView = 0; renderMetiers(); }
    } else if (ui.tab === "home" && ui.home === "apercu" && sinceView > 3000 && !$("#sheet").innerHTML) { sinceView = 0; renderHome(); renderStatus(); }
    else if (ui.tab === "team" && !ui.teamBoard && sinceView > 4000 && !$("#sheet").innerHTML && !isEditing()) { sinceView = 0; renderTeam(); renderNav(); }
    else if (ui.tab === "quests" && ui.qt !== "ach" && sinceView > 3000 && !$("#sheet").innerHTML && !isEditing()) { sinceView = 0; renderQuests(); renderNav(); }
    if (sinceSave > 15000) { sinceSave = 0; saveNow(); }
    // ressources récemment obtenues + liste de courses prête
    sinceRes += dt;
    if (sinceRes > 2500) { sinceRes = 0; const now = Date.now(); updNavLive();
      for (const n in S.res) { if ((S.res[n] || 0) > (lastRes[n] || 0)) S.resT[n] = now; } lastRes = Object.assign({}, S.res);
      S.shop.forEach((e) => { const ing = shopIng(e); const ok = ing.length && ing.every(([r, q]) => (S.res[r] || 0) >= q); if (ok && !e.ok) { toast(`Tout est réuni pour : ${shopName(e)} !`, "rare"); notify("shop", "Liste de courses prête", `Tout est réuni pour : ${shopName(e)}`); } e.ok = !!ok; });
      checkPins(); if (!$("#sheet").innerHTML) renderObjs();
      const bl = document.querySelectorAll("[data-boostleft]"); bl.forEach((b) => (b.textContent = dur(E.boostLeft(S, b.dataset.boostleft))));
    }
  }
  setTimeout(loop, 120);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
  else if (S) { const gap = (Date.now() - (S.lastTick || Date.now())) / 1000; if (gap > 60) { const r = E.catchUp(S, gap); if (r && (r.wins || Object.keys(r.res).length || (r.fmPlans && r.fmPlans.length))) offlineSheet(r); } last = performance.now(); }
});
window.addEventListener("pagehide", () => saveNow());

function start() {
  S = loadSave();
  copyBeforeUpdate(S);
  if (restoredCopy) { saveNow(); setTimeout(() => toast(`Sauvegarde illisible : copie du ${copyDate(restoredCopy.t)} restaurée.`, "rare"), 600); }
  if (transferred) setTimeout(() => toast("Partie récupérée depuis l'ancienne adresse du jeu. Bienvenue sur la nouvelle !", "rare"), 600);
  if (S) {
    setTheme(S.settings.theme || "dark");
    ui.cid = S.chars[0].id;
    const gap = (Date.now() - (S.lastTick || Date.now())) / 1000;
    const r = gap > 60 ? E.catchUp(S, gap) : null;
    render();
    if (S.migration) { migrationSheet(S.migration); S.migration = null; }
    else if (r && (r.wins || Object.keys(r.res).length || (r.fmPlans && r.fmPlans.length))) offlineSheet(r);
    S.sessions = (S.sessions || 0) + 1; dirty = true;
  } else render();
  loop();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  setTimeout(checkNewVersion, 20000); setInterval(checkNewVersion, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkNewVersion(); });
}
window.DX = { get S() { return S; }, ui, render, E, diagText };
/* Panel de test (js/admin.js) : uniquement sur la version de test, jamais sur le jeu public. */
if (BETA) Object.defineProperties(window.DX, { S: { get: () => S, set: (v) => { S = v; } }, speed: { get: () => testSpeed, set: (v) => { testSpeed = v; } } });
if (BETA) Object.assign(window.DX, { LS_KEY, openSheet, closeSheet, toast, saveNow, renderStatus, offlineSheet, pushCopy, setTheme, h, fmt, G, markDirty: () => { dirty = true; } });
start();
})();
