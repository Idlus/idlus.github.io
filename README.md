# Idlus

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://mathiss29.github.io/idlus/ (installable sur téléphone et PC)

**Discord :** https://discord.gg/9ApPgWjPUM

## 0.1.12 « Renaissance » (bêta)
- Au niveau 200, un héros peut renaître (Équipe › Renaissance) : il repart au niveau 1 en gardant apparence, titres, ornements, Dofus, familier, monture et parchemins ; l'équipement va dans le sac. Chaque renaissance donne +30 % d'XP au héros et un Éveil au choix (8 Éveils communs en 3 rangs, Éveil de classe aux renaissances V et X) ; 10 renaissances au plus. Médaillon, auras, titres, ornement « Ailes du Phénix » et 3 succès.
- Courbe d'XP : au-delà du niveau 100, l'XP demandée baisse progressivement (première montée 1 → 200 ≈ 250 h équipé au lieu de 1 400 h). Simulateur : `--renaissance N`.

## 0.1.11.2 « Aperçu des sorts » (bêta)
- **Ce que fera ton héros** (Sorts & stratégies) : sorts lancés aux 3 premiers tours, PA utilisés et dégâts, joués par le vrai moteur de combat (Chasse ou Boss).
- **Conseils** avec bouton (attaques jamais choisies, condition bloquante, PA perdus, élément hors profil) et **Ranger au mieux** (meilleur ordre des sorts de soutien, avec Annuler).

## 0.1.11.1 « Barre de sorts » (bêta)
- **Sorts & stratégies** refait : barre de sorts avec la condition sous chaque case, fiche du sort à côté (dégâts, conditions et cibles en boutons, variante en un clic), grimoire par paires sort / variante, glisser-déposer sur PC, stratégies en onglets.
- Correction : les variantes des niveaux 125 à 200 se débloquent à leur niveau (elles affichaient encore « au-delà du niveau 120 »).

## 0.1.11 « Idoles » (bêta)
- **36 idoles** en 9 familles, 4 par famille : chacune rend les combats plus durs et apporte un score ; **+0,5 % d'XP et de butin par point**, en plus de la stasis (jusqu'à +102,5 % en chasse, +30 % en donjon où le score compte jusqu'à 60).
- Jusqu'à 6 actives, une par famille ; doublon avec un modificateur de stasis ignoré ; 3 jeux d'idoles enregistrables.
- Fabriquées une fois chez le **Bricoleur** ; statuette teintée et animée selon le rang et la famille. Bouton « Idoles » en combat, en chasse, sur la fiche de donjon et la page Équipe. Six succès.
## 0.1.10.2 « Chasse itinérante » (bêta)
- **Chasse itinérante** : option sur l'écran de combat, l'équipe suit les étoiles de zone toute seule (en jeu et hors ligne), en échange de 15 % d'XP et de butin en moins.
- Correction : les étoiles gagnées par une zone sont bien comptées quand on y revient.

## 0.1.10.1 « Récoltes et panoplies » (bêta)
- **Protecteurs de ressources** : en récoltant, un gardien apparaît parfois (environ une récolte sur 60) ; le battre en chasse double cette récolte pendant 20 min (+10 ressources, +3 Éclats). Désactivable.
- **Codes cadeaux** : champ dans les Options, un code par partie (outil `tools/code_cadeau.js` pour les créer).
- **Carnet de panoplies** (Inventaire › Panoplies) : pièces possédées ou manquantes, où les obtenir, bonus par palier.
- **Compositions d'équipe** (page Équipe) : 3 équipes enregistrées, changement en un clic, suggestion dans la fiche de donjon.

## 0.1.10 « Sorts signature » (bêta)
- **Sorts signature** : 2 sorts par classe (38) ont une animation unique, liée à ce qu'ils font dans DOFUS (Colère de Iop, Attaque Mortelle, Sablier de Xélor, Tout ou Rien, Mot Interdit, Mascarade, Mégabombe, Cataclysme…). Les actions suivantes attendent la fin du sort ; uniquement avec les animations « Complètes ».
## 0.1.9.3 « Passif visible » (bêta)
- **Recruter un héros** : la description et le passif de la classe choisie s'affichent en entier (ils étaient écrasés sous la grille des classes).

## 0.1.9.2 « Exotique » (bêta)
- **Runes exotiques** : une Rune Ga ajoute +1 PA, +1 PM ou +1 Portée (nouvelle caractéristique : 20 % de chances par point qu'un sort à une cible touche un ennemi de plus) à un objet de niveau 150+ (Forgemage 100, 10-12 % de réussite, un échec ne casse que la rune, un seul exo par objet et un seul exo PA par héros). Sources : coffres de boss 150+ en stasis 7-8, archimonstres 150+, ou l'onglet Runes (runes Ra + Éclats + kamas). Un objet exo brisé rend ses runes ×2.
- **Forgemagie automatique** : un plan par objet (jets visés, runes, budget, plancher), une tentative toutes les 10 min (6 min au Forgemage 100) en jeu comme hors ligne, 2 plans en parallèle.
- **Code de diagnostic** : le bouton « Signaler un bug » copie la version, l'appareil, l'onglet, un résumé de la partie et les 5 dernières erreurs (bouton « Copier le diagnostic » dans les Options).

## 0.1.9.1 « Barre et page Équipe » (bêta)
- **Barre de navigation en 4 familles** (Accueil, Aventure, Équipe, Artisanat) avec leurs pages en dessous, cadre « Combat en cours » sur PC et gros bouton Combat au centre sur téléphone.
- **Page Équipe** : une carte par héros (activité, XP, monture, alertes qui se règlent d'un clic), plateau « Réorganiser » à glisser, « Tout équiper au mieux », héros principal choisi avec l'étoile.
## 0.1.9 « Montures » (bêta)
- **Montures** : 41 couleurs officielles de dragodindes (niveau 60), muldos (+1 PM, niveau 100) et volkornes (+1 PA, niveau 180), bonus DOFUS au niveau 100. Capture au filet dans trois zones sauvages (hors ligne aussi), croissance par une part de l'XP du héros, enclos du Havre-Sac pour l'élevage (naissances en 8 h, croisements connus, bicolores, objets d'élevage), carnet de l'éleveur et arbre généalogique.
## 0.1.8.2 « Forgemagie » (bêta)
- **Forgemagie revue** : puits (les pertes protègent les tentatives suivantes), onglet Runes (fusion, transmutation, nourrir le forgemage), métier de Forgemage niveau 1 à 100, objets Parfaits (+2 %). L'Emblème du Solitaire est retiré, les runes investies sont rendues.

## 0.1.8.1 « Étoiles de zone » (bêta)
- **Étoiles de zone** : une zone où personne ne chasse gagne une étoile toutes les 2 h (5 au plus), +10 % d'XP et de butin chacune ; elles fondent en chassant (une toutes les 30 min). Changer de zone rapporte plus.
## 0.1.8 « Familiers et montiliers » (bêta)
- **140 familiers et montiliers officiels** : un emplacement Familier sur la fiche du héros (dès le niveau 10, montiliers dès le niveau 60).
- Ils grandissent en mangeant les ressources du sac, un repas toutes les 30 minutes même hors ligne ; la nourriture préférée compte double et vous protégez les ressources de votre choix.
- Familiers de zone en chasse (1 chance sur 2 000), familiers rares de boss en stasis 7+, montiliers en stasis 6+ (garantis à la 60e victoire), montiliers légendaires +1 PA en stasis 8+.
- Stats tactiques : Tacle, Fuite, PM, Retrait et Esquive PA/PM, Invocation et Pods. Rôdeurs et Bondisseurs dans les donjons de niveau 150 à 200.

## 0.1.7 « Les 19 classes » (bêta)
- Pièges du Sram, ronces du Sadida, tourelle du Steamer qui tombe du ciel, fil de lumière de l'Osamodas : chaque classe a son passif visible.

## 0.1.6 « Passifs visibles » (bêta)
- **Chaque classe montre son passif en combat** : Colère du Iop, horloge du Xélor, roue de l'Ecaflip, glyphes du Féca, masques du Zobal, postures du Forgelance, ivresse du Pandawa, marques du Crâ et de l'Ouginak…

## 0.1.5 « Pionniers » (bêta)
- Récompense des testeurs : chaque partie de la version de test reçoit le titre « Pionnier d'Idlus » et l'ornement « Pousse du Pionnier ».
- Au lancement du multijoueur (1.0), les testeurs qui ont le rôle Pionnier sur le Discord les retrouveront.

## 0.1.4 « Encore plus posés » (bêta)
- Combats encore un peu ralentis : 780 ms par action. Récompenses par combat relevées d'autant, gains par heure inchangés.

## 0.1.3 « Combats plus posés » (bêta)
- Combats environ 25 % moins rapides (650 ms par action au lieu de 520) pour mieux voir les animations.
- Récompenses par combat relevées d'autant : XP, butin et kamas par heure inchangés, aussi hors ligne.

## 0.1.2 « Combat animé » (bêta)
- **Sorts qui voyagent** avec la patte de chaque classe (bond du Iop, flèches du Crâ, cartes de l'Ecaflip, portails de l'Eliotrope…).
- **Critiques, états visibles, chutes des monstres, boss qui préviennent** ; réglage Complètes / Sobres / Aucune.

## 0.1.1 « Mutateur éclair » (bêta)
- **Mutateur éclair** : toutes les 20 minutes, 3 donjons (10-79, 80-149, 150-200) avec un modificateur et +12 % d'XP et de butin.
- **Nouveaux modificateurs** : Champions, Boss rusé, Renforts.

## 0.1.0 « Niveau 200 » (bêta)
- **Nouvelle numérotation** : 0.x jusqu'au multijoueur (1.0).
- **Niveau 200** : 839 monstres, 1 707 objets, 51 nouveaux donjons de 120 à 200, nouvelles régions.
- **Carte** : tranches de niveaux, régions repliables, meilleure zone, progression par région.
- **Mécaniques** : rôles de monstres, 22 mécaniques de boss, 20 signatures avec succès et titre, cible prioritaire.
- **Clés de donjon** : panneau de recette clair avec un bouton vers chaque source.
- **Petit groupe** : bonus en donjon pour les équipes de 1 ou 2 héros.

## 3.4.0 « Havre-Sac »
- **8 pièces** (Accueil → Havre-Sac) : les améliorations gardent leur niveau ; atelier à construire, enclos à venir.
- **Meubles placés** : 43 meubles (28 trophées de boss, Comptoir, Almanax, Bricoleur, butins rares, succès), 14 places ; un meuble n'agit qu'une fois placé.
- **Trophées de boss** : première victoire en stasis 5, +1 % à +4 % selon le niveau du donjon.
- **Salle d'entraînement** : un héros hors de l'équipe gagne 25 % de l'XP moyenne de l'équipe (moins au-delà de 10 niveaux d'écart).
- **Atelier** : fabrication automatique toutes les 20 minutes, même hors ligne.
- Plafond des bonus : +175 % d'XP, +175 % de butin, +200 % de kamas.

## 3.3.0 « Combat vivant »
- **Placement de l'équipe** (onglet Héros) : première ligne ou arrière. Les monstres visent la première ligne 3 fois sur 4 ; placement automatique par défaut, modifiable à la main.
- **Monstres à mécanique spéciale** : les Rôdeurs visent l'arrière, les Bondisseurs ignorent les rangées.
- **Champions en chasse** : environ un combat sur 100 ; PV ×2, dégâts +20 % et un pouvoir (Enragé, Blindé, Vampirique, Véloce, Meneur, Traqueur) ; XP ×3, butin ×2, une ressource garantie. Succès à 10, 100, 500 et 1 000 Champions.
- **Décors** : un décor par donjon, salle du boss assombrie, météo en chasse ; option « Effets de décor ».

## 3.2.3 « Répartition au choix »
- Points de caractéristiques : mode Automatique ou Manuel pour chaque héros, avec des boutons −1/−10 pour reprendre des points et une pastille quand il en reste à placer.

## 3.2.2 « Confort »
- **Pourquoi j'ai perdu ?** : après une défaite, l'onglet Butin explique en une phrase ce qui a manqué (« cause : action »), avec les faits du combat et jusqu'à trois objets conseillés (dans le sac, à fabriquer, à looter). Les six derniers rapports restent consultables depuis « Derniers combats ».
- **Objectifs épinglés** : une bande sous la barre du haut suit jusqu'à 3 objectifs sur tous les écrans (quête principale d'office, avis de recherche, mission d'alignement, liste de courses, niveau d'un héros, succès).
- **Temps estimé** : au survol (ou au toucher) de la barre d'XP d'un héros, dans la liste de courses et sur les clés de donjon.
- **Notifications** : six évènements au choix dans les Options, avec une notification du navigateur quand l'onglet est en arrière-plan.

## 3.2.1 « Petit lot »
- Tenues : 3 équipements complets enregistrables par héros, remis en un clic (objets protégés de la vente et du brisage)
- Mutateur de la semaine : un donjon par semaine avec un modificateur imposé, +25 % d'XP et de butin, +50 % de poussière
- Entrée des boss (nom, stasis, mécaniques) et flash de seconde phase
- Moments de récompense : objet Rayonnant, palier de 10 niveaux, premier passage de stasis
- Codes de build à partager (sorts, caractéristiques, équipement), à lire et appliquer

## 3.1.2 « Nouvelle interface »
- Thème Émeraude (couleurs du logo DOFUS 3), thème Nuit violette en option ; nouveau logo (œuf émeraude)
- Écran de combat : arène adaptative en quinconce, bande des challenges, vue compacte, arène fixe et onglets sur mobile
- Icônes : menus en médaillons, objets officiels DOFUS (kamas, poussières, clés, coffres, challenges) à la place des émojis
- 3.1.1 : stasis plus exigeante (dégâts ×1,2 par niveau), fabrication des parchemins

## 3.2 « Héros en pied »
- Raretés d'objets (Commun, Peu commun, Rare, Épique, Légendaire) selon leur origine, visibles partout, avec filtre et tri dans l'Inventaire
- Fiche héros en pied : le personnage au centre de son équipement
- Cartes de héros allégées : héros en pied, liseré et ruban à la couleur du cadre

## 3.1 « Donjons et classes »
- Héros en pied (rendus d'apparence DOFUS), têtes et palettes au choix, coiffes et capes visibles (64 objets pour commencer)
- Stasis 1 à 10 dans chaque donjon : synchronisation, élites, modificateurs, seconde phase, temps limité, boss légendaire ; coffres, poussière de stasis, parchemins, records, ornement
- Nouveau menu des donjons, challenges mis en avant (encart, série, détail), nouveaux passifs de classe avec jauge
- Caractéristiques : paliers DOFUS, restat gratuite, auto-répartition avec palier, parchemins Petit/Grand (+100 max par caractéristique)

## 3.0.3 (application installable)
- PWA : icône, plein écran, jeu hors connexion (service worker), bouton « Installer » et guide iPhone
- Nouvelle adresse : https://mathiss29.github.io/idlus/
- Serveur Discord, bouton « Rejoindre » sur l'Accueil et « Signaler un bug » dans les Options

## 3.0.2 (équilibrage des classes)
- Classes rééquilibrées par leurs sorts et passifs (Iop, Pandawa, Sadida, Zobal, Eliotrope, Crâ) ; correctif de puissance limité à ×0,8–×1,2
- Bandeau « mise à jour appliquée » avec résumé, notes de mise à jour dans les options, alerte quand une nouvelle version est en ligne (`version.json`)

## 3.0.1 (correctifs)
- Toutes les clés de donjon sont fabricables (Squelettes, Pitons, Dragon Cochon, Goulet : ingrédients ajoutés aux monstres de la zone)
- Les 178 sorts de placement ou d'état ont un effet adapté au combat automatique (bonus, bouclier, soin, affaiblissement, PA…) qui évolue avec leur niveau
- Nouvelles sous-zones de transition : Bordure de Kaliptus (68-78), Orée de la Forêt Sombre (74-82), Pentes du Canyon (76-86)
- Variantes au-delà du niveau 120 repliées ; équilibrage des classes recalculé

## Nouveautés v3 « Builds et contenu »
- Vrais sorts de DOFUS 3 pour les 19 classes (jusqu'au niveau 120) avec leurs variantes (gratuites) ; 6 emplacements, 7 au niveau 50, 8 au niveau 100
- IA de combat revue : protections et invocations d'abord, puis l'attaque la plus rentable par PA ; règle de ciblage par sort
- Profil de build par héros (élément principal, sélection automatique des sorts) et simulateur de dégâts
- Nouvelles caractéristiques : dommages critiques, dommages élémentaires, résistances fixes, % dommages aux sorts
- Sorts des monstres, mécaniques de boss (Rage, Renforts, Carapace, Attaque dévastatrice) et invocations simplifiées
- Challenges (1 par combat, 2 en donjon) : +5 à +12 % d'XP et de butin, série jusqu'à +5 % ; option « 🎯 Respecter » pour l'IA
- Contenu jusqu'au niveau 120 : Cania étendue, Sidimote, Koalaks, Abraknyde sombre, Moon, Dragœufs, Otomaï, Minotoror, Pandala, début de Frigost, 17 nouveaux donjons
- Progression plus rapide de 40 à 60, plus lente après 100 ; butin réduit sur les monstres trop faibles
- « Suivre mon niveau » (changement de zone automatique) et rapport d'absence détaillé (objets à équiper, niveaux, archimonstres)
- Équilibrage des 19 classes par simulation (solo, équipes, donjons)

## Nouveautés v2.7 « Équilibrage »
- Progression accélérée jusqu'au niveau 60, objets et ressources plus rares (recyclage des doublons, coffre garanti sur les boss)
- Prospection d'équipe dégressive, Synergie (+2 % par classe différente), passifs de métier personnels
- Récolte : choix direct de la ressource, outils fabriqués (recettes multi-métiers + Éclats de trouvaille), filons rares
- 13 consommables (bonbons, Fiole de Résurrection, Potion de Savoir, Parchemin d'Avis, Cristal de Forgemagie, coffres) et barre de raccourcis
- Récompenses à thème pour la quête principale, Bureau des primes (jetons), Comptoir de la cité (insignes), série d'Almanax, meubles en attente du housing
- Sac réorganisé (catégories, grille, filtres, fiche sources/usages, liste de courses, vente en masse) et forgemagie filtrable avec favoris et historique

## Contenu (v2.6 « Krosmoz »)
- 4 zones : Incarnam, Astrub, Amakna et les Plaines de Cania — 38 sous-zones, monstres réels jusqu'au niveau ~70 et leurs archimonstres
- 11 donjons avec leurs vrais boss et leurs clés (dont Tofus, Squelettes, Scarafeuilles, Bworks, Kwakwa, Blops)
- 474 équipements réels, 72 panoplies (bonus affichés palier par palier), objets Rayonnants
- 19 classes avec passif ; carte de héros avec 10 cadres (un tous les 20 niveaux) + cadre Krosmoz au niveau 200, ornements et titres
- Combat automatique ou manuel (choix du sort et de la cible, retour en auto après 10 s), effets visuels par élément
- Quête principale, avis de recherche, alignement Bonta / Brâkmar (ordres, rangs, missions), Almanax quotidien, 57 succès
- Havre-Sac (améliorations permanentes en kamas), forgemagie (runes + kamas, exo-jets), brisage, Emblème du Solitaire
- Métiers : un héros = une activité (chasse ou récolte dans une sous-zone), outils, trouvailles, vraie barre d'XP
- Paliers de chasse, familles, trophées, consommables, progression hors ligne

## Structure
- `index.html`, `css/`, `js/` : le jeu (sans dépendance, hébergé sur GitHub Pages)
- `js/gamedata.js` : données générées depuis DofusDB (ne pas modifier à la main)
- `js/data.js` : règles du jeu (classes, sorts, Emblème…) · `js/engine.js` : moteur · `js/systems.js` : Havre-Sac, quêtes, alignement, forgemagie, succès · `js/ui.js` : interface
- `assets/` : images (monstres `m/`, objets `i/`, sorts `s/`, héros `h/`, stats `c/`, métiers `j/`)
- `tools/import_dofusdb.py` puis `tools/build_data.py` : import et génération des données

## Mentions
Projet de fan gratuit et non commercial, sans lien avec Ankama Games.
DOFUS, ses noms, images et contenus sont la propriété d'Ankama Games. Données : [DofusDB](https://dofusdb.fr).
