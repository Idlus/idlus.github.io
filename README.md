# Idlus

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://idlus.github.io/ (installable sur téléphone et PC)

**Discord :** https://discord.gg/9ApPgWjPUM

La version de test (`/beta/`) est fermée depuis le 14/10/2026 : l'adresse renvoie vers le jeu (un lien `?code=` suit) et son service worker se désinstalle. La partie de test se lance depuis le panel admin du jeu public.

## 2.1.34.3 « Classements justes »

- Ticket #143 (Akileuss) : 12 succès sont déclarés dans des fichiers que la fonction serveur ne charge pas (suivi.js, vie.js, ui.js, guide.js) ; VERIFY.ACH_EXTRA les compte avec leurs points dans le résumé (tests/succes_serveur.test.js garde la liste juste).
- Ticket #142 (lucy8) : E.poutchPreview copiait la partie avec le combat en cours (la Marque d'ébène y garde une entité : JSON circulaire) → copie par E.serialize ; E.dofpDeath crée dpS s'il manque (invocation portant les Dofus). Aucun changement de sauvegarde ni de SQL.

## 2.1.34.2 « Mission de donjon »

- Ticket #141 (Akileuss) : Défis › Alignement, la carte de mission n'avait « Y aller » que pour les missions de chasse (q.sub). Les missions « boss » (q.dg) ont maintenant le bouton dgopen vers la fiche du donjon, caché une fois la mission remplie. Aucun changement de sauvegarde ni de serveur.

## 2.1.34.1 « Classement des succès »

- Ticket #138 (Ley) : depuis le Bouclier (2.1.4), le résumé des classements est calculé par la fonction serveur « record », qui ne chargeait pas js/quetes.js : E.achPoints manquait, la colonne ladder.pts recevait 0 à chaque partie validée, et le nombre de succès comptait aussi les succès retirés. quetes.js est ajouté à tools/build_server.js (et aux chemins de supabase.yml) ; tests/bouclier_serveur.test.js vérifie les points. Aucun changement de sauvegarde ni de SQL ; le classement se corrige au prochain envoi de chaque partie.

## 2.1.34 « Grand écran »

- Choix 1B et 2A de la maquette PC (Mathis 21/10). Au moins 1600 px : colonne fixe #livecol (.lcol, liveColTick dans la boucle, arène via FORMUI.box) et chat ancré dessous (CHAT.dock) ; option S.settings.liveCol.
- Inventaire (au moins 1100 px avec souris) : panneau du héros (.ihp, invHeroHtml) à côté du sac, glisser-déposer vers une case ou une tête ; option S.settings.invHero. Aucun changement de sauvegarde ni de serveur.

## 2.1.33 « Interface plus pratique »

- Lot ergonomie (Mathis 21/10) : Donjons (encadré d'absence replié, S.settings.dghOpen), Équipe (Les 19 classes repliées par défaut, c19Shut !== false), Forgemagie au téléphone (métiers sur une ligne), page Combat sans combat (.cside.cidle).
- Menu : épinglés PC avec leur nom, lettre du raccourci au survol (navHotkey), menu du téléphone par famille (nsOpen, ui.nsFams).
- Téléphone : bulle du chat cachée au défilement (body.scrolldn), « Mieux pour… » dans #lootdock au-dessus de la barre du bas, flèche .tr-mv décalée.
- Inventaire PC : double-clic (détecté à la main, le premier clic redessine) et menu du clic droit (#ctxmenu, Briser en deux temps). Aucun changement de sauvegarde ni de serveur.

## 2.1.32.2 « Ocre terminé »

- Corrige le statut de la quête Ocre après les six paliers, y compris les anciennes parties, sans redonner de récompense (ticket #129, Akileuss). Tests moteur et interface PC/mobile.

## 2.1.32 « Ma rotation »

- Sorts : mode « Ma rotation » (c.atkMode = "rot", c.rot = [{ id, cond? }], 16 cases, "arme" = coup d'arme). charTurn lance la liste dans l'ordre et passe les sorts impossibles (recharge, PA, lancers max, condition, entrave) ; au bout de la liste le tour s'arrête. Rotation vide = Auto.
- « Mon ordre » (2.1.21) converti à la lecture de la sauvegarde (E.rotConvert : soutiens puis attaques en boucle jusqu'aux PA), stratégies et anciennes équipes du Kolizéum (am 1) comprises. koliSnap envoie am 2 + rot.
- Auto (planTurn) : bonus de Puissance/élément/Dommages cumulables comptés à chaque lancer et lancés en premier, Dommages des buffs dans l'estimation, coût d'ivresse du Pandawa. NO_CUMUL=1 pour comparer.
- Aperçu : sorts passés (fx « rskip ») barrés avec la raison ; « Tour 1 » ne contient plus le premier tour du round 2. Tests : tests/ordre.test.js.

## 2.1.31.5 « Quitter sans ouvrir le combat »

- Menu de gauche (PC, normal et réduit) : bouton à côté de « Combat en cours » pour rentrer de la chasse (E.stopHunt) ou quitter le donjon (E.leaveDungeon, deux clics en 5 s car la clé est perdue). Absent pendant le Songe infini.
- Aucun changement de sauvegarde ni de serveur.

## 2.1.31.4 « Succès de panoplies »

- Corrige les six succès de panoplies : pièces lues via E.setPieces, comme le carnet (signalement de SegFault). Possession actuelle conservée ; cache de cinq secondes inchangé.
- Tests : pièce manquante, doublons, équipement, six seuils, récompenses uniques, titre et compteur des objets différents. Aucun changement de sauvegarde ni de serveur.

## 2.1.31.3 « La tournée des temples »

- Quêtes › Temples : enchaînement des Dopeuls possédés et encore disponibles, progression i/N et arrêt après le combat courant. Les 19 classes restent accessibles selon les règles existantes.
- Arrêt sur défaite, erreur, interruption, changement de jour ou de contexte, et absence. Série conservée uniquement en mémoire ; aucun changement de format de sauvegarde, de récompenses, de serveur ou de base.
- Tests moteur et interface dédiés : parité avec les défis individuels, disponibilité, arrêts, erreurs, chargement, absence et affichage PC/mobile.

## 2.1.31.2 « Véloce fusionné à 70 % »

- Sceaux de champion (js/champions.js, sealDmg) : le bonus d'Éveil de Véloce est multiplié par E.SEAL_FUSE_PCT dans un Sceau fusionné (5★ : +14 % au premier tour au lieu de +20 %). Test dans tests/champions.test.js. Le serveur rejoue les combats avec champions.js : « Serveur en ligne » se relance.

## 2.1.31.1 « L'Alignement dans le menu »

- Menu : page « align » dans la famille Défis (NAV, NAV_DESC, étiquette « nouveau » jusqu'au 22/10) ; navGo l'ouvre sur Quêtes › Alignement et navKey la surligne. Aucun changement serveur.

## 2.1.31 « La refonte des alignements »

- Honneur et 20 rangs à la place du niveau d'alignement (`js/honneur.js`, migration `E.VERSION` 14 : niveau 100 = rang 10, bourse à 0), talents d'ordre, Arsenal (5 pièces de grade, rangs 6 à 10), guerre des régions, agressions, page dans `js/alignui.js`. Classement des camps par rang (vue `lb_hon`), ailes dans le chat.
- Serveur : `honneur.js` dans le Bouclier (`tools/build_server.js`). Base : `supabase/alignement2.sql` (honneur plafonné, +100 au plus après un changement de camp, envois sans honneur ignorés, état des régions en cache 3 minutes). Ordre de déploiement : fonction `record`, puis `alignement2.sql`, puis le jeu.
- Un vieil onglet resté en cache qui supprime une pièce de grade : elle est rendue au chargement suivant.

## 2.1.30.11 « Couture fine partout »

- La Couture fine est aussi affichée dans le choix d'un objet (étiquette de panoplie bleue) et dans le détail des bonus de l'Encyclopédie (`js/ui.js`, `js/collui.js`). Aucun changement de calcul.

## 2.1.30.10 « Couture fine plus claire »

- Description de la Couture fine réécrite (`js/collections.js`) ; palier débloqué par la Couture fine affiché en bleu dans Héros › Équipement, l'infobulle des objets et le détail d'une panoplie (`setBlock` dans `js/ui.js`). Une panoplie active seulement grâce à la Couture fine apparaît dans « Panoplies actives ». Aucun changement de calcul.

## 2.1.30.9 « Infobulle de Maîtrise »

- Corrige l’infobulle persistante à la souris dans `js/maitrise.js` (issue #132, PR #137). La sélection de l’étoile et l’aperçu tactile sur téléphone sont conservés. Correctif relu par Claude.

## 2.1.30.8 « Hauts faits sans doublons »

- Records de donjon (js/ui.js, recQueue/recSubmit) : les envois déjà faits sont gardés dans la partie (`S.recSent`, synchronisée) en plus du lien de l'appareil (`rec2`), fusionnés par recSent() (stasis la plus haute, puis meilleur temps). Avant, un autre appareil, au rec2 vide ou ancien, renvoyait toutes les stasis déjà classées ; chaque temps rejoué un peu meilleur ressortait en annonce dans les Hauts faits (bug n°27, Gagou). Aucun changement serveur.

## 2.1.30.7 « Coffres de l'Ascension »

- Coffres du mois visibles (signalé par Akileuss) : shopHtml (js/ascensionui.js) liste `Q.chest` par mode avec ✓ ; `E.ascChest` (js/ascension.js) compare la réserve avant et après `E.sabGift` et écrit les heures vraiment reçues (« réserve pleine »). Règle inchangée : un coffre par étage, par mode et par mois.

## 2.1.30.6 « Fenêtres qui restent en place »

- openSheet (js/ui.js) : quand la fenêtre redessinée est la même (même titre h2, sinon même premier bloc), la position de défilement de .sheet et de ses listes internes est remise après le rendu. Options : changer d'onglet repart du haut.

## 2.1.30.5 « Malus de panoplie »

- DofusDB écrit certains malus de panoplie en négatif sur un effet déjà négatif (171 « -% Critique » à -40) : build_data.py et build_caracs.js prenaient « signe × valeur » et en faisaient un bonus. Ils prennent maintenant « signe × |valeur| ». js/gamedata.js corrigé sur ces seules lignes (35 lignes, 14 panoplies : Aurore Pourpre, Krobes, Glourséleste, Ilyzaelle, Musha, Abraknyde, Blop ×4, Infernale, Fluviale, Contrebandière, Meurtrière) ; les objets n'étaient pas touchés (vérifié sur les 2 595 objets). Chances de critique bornées à 0 % (estimation de sorts, fiche du héros). Test dans tests/pieces.test.js. Le serveur (Bouclier) relit gamedata.js.

## 2.1.30.4 « Potentiel affiché »

- Potentiel des Dofus affiché (signalé par Ley) : `dofpRank`/`dofpPotTag` dans js/ui.js ; dofpBlock, dofpHeroPanel et dofpPickHtml passent le rang à `E.dofpTxt`, itemStatsHtml ajoute `E.dpotStatsOf` (seulement pour un objet du sac du joueur) ; les builds partagés gardent le rang 0. Le moteur (E.charStats, E.dofpVal en combat) comptait déjà le Potentiel.

## 2.1.30.3 « Retour sans attente »

- Audit technique (avec ChatGPT) : E.catchUp devient le générateur E.catchUpGen (les modules l'enveloppent avec yield*), E.catchUpAsync le déroule par tranches (fenêtre #offc avec barre, jeu en pause, rien sauvegardé avant la fin) ; mêmes tirages et mêmes gains (tests/absence.test.js). Collection de panoplies recalculée seulement quand l'Encyclopédie grandit (E.dexVer). sw.js : précache en cache: "reload", recherche hors ligne dans le cache de la version. online.js : envoi demandé pendant un autre relancé une fois (SYNC-04), partie fixée pendant l'envoi (SYNC-06). CI : test:online. Aucun changement SQL.

## 2.1.30.2 « Ailes dans le chat »

- Chat : ALIGNUI.wings entoure le portrait (cmed) des ailes du camp (wingSVG de ui.js, exporté dans DX.social ; aile droite retournée dans le SVG), taille par rang 1 à 5 (CAMP.r lu dans lb_align, son propre rang depuis la partie), rien au rang 0 ni sans camp. Battement en CSS (classe .fly seulement avec les animations complètes, coupé par prefers-reduced-motion). Aucun changement serveur.

## 2.1.30.1 « Carnet des kamas »

- Bilan des kamas du carnet (js/suivi.js) : combats du Songe marqués `x: 1` dans S.history (js/engine.js) et rangés dans « Songe infini », comme le reste du tic pendant un songe (validation). `E.carnetGain(S, k, cat)` range un gain là où il naît (marchand de secours, Kolizéum, coffres, Ascension, missions) sans double compte ; `E.carnetOp` classe les opérations du serveur (js/market.js) : vente directe, guilde, Foire, pluie, Ascension, sinon Hôtel de vente. Nouvelles cases du bilan, actions de l'Ascension enveloppées. Test tests/carnet.test.js. Pas de valeur inventée pour le passé.

## 2.1.30 « Marché des bêtes »

- Montures et familiers à l'hôtel de vente et en échange direct (choix de Mathis 1A 2A 3A 4A 5B 6A) : catégories `mt` (clé « espèce:couleur ») et `pet` dans supabase/hdv.sql, contrôle de la bête dans la partie validée (hdv_beast : ni montée, ni à l'enclos, ni en balade, ni portée, ni Chacha Doré ; une bête sortie par `rmM`/`rmP` ne revient jamais), livraison `addM`/`addP` marquée `b:1` (achetée : hors carnet, classement d'élevage et album), offres d'échange dédoublonnées (hdv_uniq). Client : js/market.js, E.mountIn/mountGone (js/elevage.js), E.petIn/petGone/petMine (js/pets.js). Bouclier : bilan mn/ms/pn et bornes V.BEAST_* (js/verify.js), dons gift.mt/ms/pt dans la fonction record. Tests : tests/betes.test.js, tests/online.test.js.

## 2.1.29.5 « Vendre plusieurs ressources »

- Inventaire › Ressources › « Vendre plusieurs » (js/venteui.js, VENTEUI.pickHtml) : sélection de ressources dans la grille ou la liste, quantité par ressource, total estimé, « Vendre la sélection » par la vente directe existante (vente_sell, lots de 40 ressources au plus par appel, aucune modification du serveur), résultat par ressource. Demandé par Mathis. Test : tests/online.test.js.

## 2.1.29.4 « Infobulle des runes »

- Établi de forgemagie : l'infobulle d'une rune s'affiche sous la rune (data-tippos="below" dans showTip, js/ui.js) et ne cache plus le jet actuel de la caractéristique. Demandé par Mathis.

## 2.1.29.3 « Recherche d'objet »

- Choix d'un objet (Équipe et héros › clic sur un emplacement) : champ de recherche (nom, panoplie sans le mot « Panoplie », caractéristique via statOfQ) ; seule la liste #eqPick se redessine pendant la frappe (morphTo, le champ garde le focus). Idée de SegFault, précisée par Mathis.
- Étiquette « Pano. … » cliquable (ui.psetOpen) : setDetailHtml (pièces portées / dans le sac / pas encore obtenues + setBlock) ; même détail dans la fiche d'un objet de l'inventaire.

## 2.1.29.2 « Brisage auto plus précis »

- Règles automatiques du sac (E.applyAuto, js/engine.js) : « jet < X % », « Bas niveau » et « Sous le niveau » se combinent en ET par défaut (signalé par Akileuss : jet < 80 % + sous le niveau 190 brisait des objets 200). Nouveau réglage S.settings.auto.mode (« et » par défaut, « ou » = chaque condition brise seule). Les réglages déjà enregistrés restent valides (sans mode = « et »). Tests : tests/sac.test.js.

## 2.1.29.1 « Envois plus rapides »

- Délai entre deux envois réduit : « Signaler un bug » 2 min → 30 s (supabase/bugs.sql, bug_send), « Proposer une idée » 10 min → 1 min (supabase/idees.sql, idea_send, et WAIT dans js/idees.js). Limites par jour inchangées (15 bugs, 10 idées ; 40 bugs/h et 30 idées/h pour l'ensemble des joueurs sans compte). Demandé par Mathis.

## 2.1.29 « Classes et donjons 200 »

- Retouches des classes faibles sans bonus en pourcentage (demande de Mathis) : E.PSV dans js/engine.js (sève du Sadida, butin de guerre de l'Enutrof, Transposition et Souffrance du Sacrieur, soin en trop de l'Eniripsa, glyphes du Féca, Hystérique du Zobal), anciennes valeurs E.PSV0 au Kolizéum ; clé de voûte Enutrof « Pelle Fantomatique » (js/maitrise_moteur.js). Les 34 donjons de niveau 200 ont une difficulté propre (E.DG_DIFF). Réglé par simulation (équipes de 8, cibles 0-1 / 5-7 / 8-10). Tests : tests/classes.test.js.

## 2.1.28.1 « Remise imposée »

- Quand Mathis remet la partie d'un joueur à une copie (panel, adm_save_restore), la partie en ligne porte la marque meta.remise : le jeu la reprend sans poser la question des deux versions (slotPlan → « take », onConflictLive → takeRemote) et push_save refuse l'envoi forcé tant que la marque est là ; l'envoi normal suivant l'efface. Test dans tests/online.test.js.

## 2.1.28 « Argenté et donjons »

- Lueur d'Ilyzaelle (Dofus Argenté Scintillant) une fois par équipe et par combat (js/dofusp.js, F.dpArg). Difficulté propre à 8 donjons (E.DG_DIFF dans js/engine.js, vie et dégâts des monstres), réglée par simulation (équipe de 8, bon équipement, stasis 7 visée). Choix 3 et 4A de Mathis ; les classes viendront par des retouches de sorts.

## 2.1.27.1 « Guide à jour »

- Guide (js/guide.js) relu chapitre par chapitre contre la 2.1.27 : ajout de la vérification des parties et des suspensions (Classements + FAQ), du vote du Grand défi, de la fiche du Sablier et du « ∞ », du retour aux Dofus, de la Maîtrise au classement par classe, des partitions et des codes à nombre limité. Demandé par Mathis.

## 2.1.27 « Maîtrise du temps »

- Refonte du Sablier (choix de Mathis 1A 2C 3A 4A 5A, puis Grain aux niveaux impairs, ×2 illimité au 15, ∞ et profil public) : 1 XP par minute de réserve utilisée, 50 niveaux (30 × n minutes du niveau n au suivant, environ 612 h), paliers (+1 h de réserve tous les 2 niveaux, malus de butin réduit aux niveaux 10/20/30/40, +30 min de recharge aux 15 et 35, Fioles de temps offertes chaque semaine dès le 25 et le 45, Grain de Xélor à chaque niveau impair, ×2 illimité dès le 15 sans XP), vitesse ×4 et titre « Maître du temps » au 50. Tout le monde commence au niveau 1.
- Bouclier : rythme de 2,25 h par heure réelle pour les comptes au niveau 15 (×2 illimité), réserve de 72 h (48 h avant) pour le ×4 et la réserve plus grande ; XP de Maîtrise du temps plafonnée depuis sa sortie (73 h + 30 h par jour).

## 2.1.26.4 « Exos et objets parfaits »

- Fiche du héros, équipement porté : pastille de l'exo (icône de la caractéristique, coin bas gauche, comme DofusBook) et, pour un objet Parfait (`E.isPerfect` : toutes les lignes au jet maximum), contour doré, reflet animé et étoile (coin bas droit, sauf sur un Dofus qui a déjà sa pastille de Potentiel). Demande de Mathis.

## 2.1.26.3 « Le bon dimanche »

- Grand défi du dimanche : le jeu lit la règle votée (defi_vote_count) avant de jouer ou de regarder le défi, aussi depuis l'Accueil. Sans elle, il jouait la 1re règle proposée alors que la fonction serveur « record » rejoue avec la règle votée : le score validé au classement différait du score affiché.

## 2.1.26.2 « La partition du Phénix »

- Partitions : l'air « Renaissance du Phénix » se trouve sur la page Maîtrise ; il était introuvable depuis la 2.0 (la page Renaissance n'existe plus), le succès Mélomane bloquait à 49/50.

## 2.1.26.1 « Crâ ajusté »

- Crâ −5 % de dégâts à partir du niveau 88 (E.CLASS_POW), demandé par Mathis ; Kolizéum inchangé.

## 2.1.26 « Le nouveau Sram »

- Sram refait (choix de Mathis) : pièges posés qui explosent au tour ennemi (3 au plus, ×2,6, réaction en chaîne), Invisibilité/Brume à −50 % de dégâts reçus et +40 % au premier coup, passif Assassin (+25 % sous 30 % de PV, +2 PA en achevant). Pastille des pièges en combat, pièges au Kolizéum, coefficient du Sram au Kolizéum réglé par simulation (js/sram.js).
- La classe à l'honneur : chaque semaine, une classe peu jouée gagne +10 % d'XP (Maîtrise comprise) et de butin (Sram d'abord).

## 2.1.25 « Bouclier sans faille »

- Vérification des parties : un compte vérifié garde une marge plus large sur les kamas, ressources et Dofus, mais la Maîtrise, les niveaux et le temps de jeu restent contrôlés ; le « C'est bon » de Mathis n'accepte plus une partie impossible ; plafond de Maîtrise par héros tiré du vrai coût des points.

## 2.1.24 « Carte zoomable »

- Carte du monde : zoom (molette, deux doigts, + / −), déplacement, étiquettes réduites au nom et qui ne se recouvrent plus, prismes et Percepteurs en repères sur les points.

## 2.1.23 « La carte du monde »

- Carte du Monde des Douze cliquable (DofusDB), Éveil des Sceaux et Comptoir des Éclats, une écurie par espèce de monture (60 places chacune).

## 2.1.22 « Le Sablier »

- Sablier de Xélor : butin −10 % en ×2 et −20 % en ×3 (ressources, équipements, clés, kamas ; ni l'XP ni les Dofus). Réserve 36 h, 48 h avec les heures gagnées.
- Plus d'heures : Horloge de Xélor (Havre-Sac), Défi du jour, Almanax, boss des mondes et de guilde, Horloger de Xélor (Fioles de temps vendables), Grain de Xélor très rare en donjon.

## 2.1.21 « Mon ordre »

- Sorts & stratégies : interrupteur Auto / « Mon ordre » (attaques une fois chacune dans l'ordre de la barre), comparaison avec l'Auto dans l'aperçu, Auto qui connaît le passif de l'Huppermage, les mécaniques des sorts et les bonus d'attaque.

## 2.1.20 « Idées des joueurs »

- Artisanat : la fiche d'une recette dit combien on possède déjà de l'objet fabriqué (ticket #124, Akileuss).
- Récolte : plusieurs héros d'un coup sur la même ressource (« Les N libres », ou choix des héros dans « Envoyer récolter ») (Opla).
- Donjons : les zones où tombe la clé sont des boutons sous sa recette (Hayabusa).
- Règles automatiques : « Sous le niveau N » brise les objets lâchés sous un niveau choisi (Hayabusa).
- Pastille « ← Retour aux Dofus » / « ← Retour aux quêtes » après un « Y aller » (Hayabusa).
- Champions : appel automatique du légendaire dès 3 pistes, pause de 30 min après une défaite (Sky).

## 2.1.19 « Suspensions temporaires »

- Panel Xener › Joueurs : suspension de 1, 3, 7 ou 30 jours (ou définitive), levée toute seule à la fin.

## 2.1.18 « Bouclier plus juste »

- Vérification des parties : gains de kamas, ressources et Dofus permis revus à la hausse (relevés des meilleurs joueurs), et un compte vérifié par Mathis ne repasse plus que le contrôle de l'impossible.

## 2.1.17.1 « Étoiles de monture »

- Montures : l'info « une étoile de plus possible » des chromatiques dit maintenant comment la monter (bouton « +1 étoile » de la fiche, Héros › Élevage › Écurie › Fiche, 2 000 Essence, une fois par jour). Le guide Élevage l'explique aussi. Les étoiles des montures se voient aussi quand on les croise (choix des deux montures), dans la Collection et sur l'emplacement Monture du héros (signalement de Hayabusa).

## 2.1.17 « Bouclier des étoiles »

- Le serveur vérifie aussi les points de Maîtrise des parties envoyées (plafond selon le temps écoulé depuis la Maîtrise lente).

## 2.1.16 « Tous les joyaux »

- Sertissage : toutes les sortes de joyaux possédées sont proposées (un bouton par sorte, ×N), au lieu des 6 premiers du sac.

## 2.1.15 « La Maîtrise lente »

Maîtrise lente : chaque point coûte plus que le précédent, et reset des Maîtrises pour tout le monde (joyaux rendus, titre « Pionnier des étoiles »).

## 2.1.14 « Bouclier du serveur »

Le serveur calcule lui-même le résumé des classements à partir de la partie (`VERIFY.fullSummary`) et la vérifie avant de la garder comme dernière partie validée (`saves_ok`), dont partent les classements, l'hôtel de vente et les combats rejoués. Panel Xener › En vérification › Détails. Codes à nombre limité réservés aux comptes. Tests : `tests/bouclier.test.js`, `tests/bouclier_serveur.test.js`.

## 2.1.13 « Challenges au choix »

Avec « Respecter les challenges », un bouton choisit les challenges suivis par l'IA. Les héros lâchent les challenges quand le combat tourne mal (Élitiste et Ordonné sous 80 % des PV de l'équipe, les autres sous 50 %, tous dès qu'un héros tombe), sauf dans le Défi du jour. Simulateur : `node tools/chal_sim.js`.

## 2.1.12 « La Maîtrise au classement »

Classement des niveaux : chaque point de Maîtrise compte un niveau, au total de l'équipe comme au classement par classe.

## 2.1.11 « Économie de batterie »

Options › Affichage : case « Économie de batterie » qui coupe animations, fond animé, effets de combat et chiffres de dégâts qui volent (environ 5 fois moins de travail pour l'appareil en combat, mesuré PC et téléphone).

## 2.1.10 « Où trouver l'offrande »

Almanax : « Où la trouver » sous l'offrande montre qui lâche la ressource (zone, chance) et « Y aller » lance la chasse.

## 2.1.9 « Équipement verrouillé »

Un emplacement d'équipement se verrouille (cadenas) : « Équiper au mieux » et « Tout équiper au mieux » n'y touchent plus.

## 2.1.8 « Copier le setup »

Fiche du héros › ⋯ Plus › « Copier le setup », puis « Coller » sur un autre héros : caractéristiques, sorts et stratégies, Maîtrise (même classe) et équipement pris dans le sac, jamais dupliqué.

## 2.1.7 « Raccourcis de l'Ascension »

L'Ascension sur PC : 1 à 9 lancent les sorts et prennent les choix des paliers, Entrée ou Espace finit le tour ou lance l'étage, Échap passe, ← → changent de cible.

## 2.1.6 « Tous les points d'un coup »

Maîtrise : un bouton place tous les points libres sur les meilleurs bonus, sans prendre de clé de voûte.

## 2.1.5 « Donjons finis masqués »

Donjons : filtre « Masquer stasis 15 » qui cache les donjons déjà finis en stasis 15 (choix gardé, nombre masqué indiqué).

## 2.1.4 « L'album épinglé »

L'Album des archimonstres s'épingle dans le menu, et l'album comme la fiche d'un monstre se mettent à jour tout seuls après chaque combat.

## 2.1.3 « Tout ouvrir »

Coffres : « Tout ouvrir » les ouvre tous d'un coup (un seul écran de butin), et le mode Auto ouvre chaque coffre gagné tout seul.

## 2.1.2 « L'arbre fluide »

L'arbre de Maîtrise ne rame plus : un seul dessin par image, ciel gardé en image pendant le survol, déplacement allégé.

## 2.1.1 « L'arbre qui aide »

Brouillon et placement automatique, objectif épinglé, recherche qui guide, image de l'arbre, arbres des meilleurs joueurs, branches complètes (aura et titre), joyaux dans les branches, récolte de l'Artisan relevée, son des étoiles, récap en phrases.

## 2.1 « Branches lointaines »

10 branches lointaines dans chaque ciel de Maîtrise, ouvertes par 5 Portes des étoiles (Kabahal, Roi Imagami, L'Éternel Conflit, Belladone, Déchireuse) ; soins de Maîtrise appliqués aussi aux boucliers ; arbre plus lisible.

## 2.0.10 « Derniers bugs de la Maîtrise »

Anciennes défenses du Kolizéum sans les Éveils ; arbre de Maîtrise sans observateur en double et relu après un changement de partie ; pas de Premier de donjon pour un compte en vérification.

## 2.0.9 « Clés de voûte reliées »

Maîtrise : dans les 19 ciels, les 3 clés de voûte de chaque domaine sont reliées par le dernier cercle (129 étoiles de passage ajoutées, les étoiles déjà prises ne changent pas).

## 2.0.8 « Maîtrise plafonnée »

Arbre de Maîtrise : en combat, un héros ne profite jamais de plus d'étoiles que de points de Maîtrise (E.mtClean). Rien ne change pour un arbre construit dans le jeu. Étape « wb-retrait » du workflow Serveur OVH prête pour retirer les essais du bug du Dom de Pin (choix 3B, avec la phrase de Mathis).

## 2.0.7 « Notables uniques »

Maîtrise : les 126 notables de chaque ciel ont leur propre nom et bonus (nouveaux : dégâts critiques, premier tour, sous la moitié des PV, bouclier de départ). Rendre des étoiles est gratuit jusqu'au 22/10 à 23 h. La fiche du héros montre sa Maîtrise et ses bonus.

## 2.0.6 « Boss des mondes réparé »

Boss des mondes et boss de guilde : le Dom de Pin et le Lance-Éclair de Menalt (coups en % des PV de la cible) comptent sur les PV normaux du boss et plus sur ses PV ×1 000 (un essai pouvait faire 10 millions de PV).

## 2.0.5 « Étoiles au bon endroit »

Arbre de Maîtrise : la souris vise la bonne étoile avec le zoom de l'interface, zones de clic plus grandes, un petit glissement n'annule plus le clic.

## 2.0.4 « Étoiles rendues »

Rendre des étoiles de l'arbre de Maîtrise coûte pareil partout (une étoile, un autre arbre enregistré, un code, Tout rendre) : gratuit jusqu'à 50 points placés, puis 20 000 kamas par point rendu. Titre souvenir de la Renaissance aussi pour les comptes dont le héros rené a été congédié. Classement de niveau sans les anciennes vies.

## 2.0.3 « Chasse aux bugs de la Maîtrise »

L'XP en trop au passage du niveau 200 va dans la Maîtrise ; codes d'arbre et sauvegardes abîmées vérifiés (étoiles reliées, Nébuleuse à 1 000 points) ; un joyau pour un seul héros ; « Tout rendre » confirmé et non annulable gratuitement ; titres du Bestiaire déjà mérités ; classement de la Maîtrise robuste ; compteurs de succès et textes du Guide sans la Renaissance.

## 2.0.2 « Chemins du ciel »

Maîtrise : le ciel de chaque classe est redessiné (mêmes étoiles et mêmes liens) pour que les chemins suivent les liens visibles, sans branches qui se croisent ni cercles qui se chevauchent.

## 2.0.1 « Étoiles expliquées »

Maîtrise : l'effet de chaque étoile et le gain du chemin s'affichent sur l'arbre (survol sur PC, premier toucher sur téléphone ; second toucher pour prendre).

## 2.0 « La Maîtrise »

Après le niveau 200, l'expérience remplit la Maîtrise : un point par niveau à placer dans la Constellation, un arbre de talents par classe (six domaines, étoiles clés, Nébuleuse cachée à 1 000 points). Maîtrise du Bestiaire (20 paliers par famille), joyaux de Maîtrise sur les boss de stasis 10+, classement de la Maîtrise, part d'expérience de la monture au choix (0 à 50 %). La Renaissance disparaît : 2 % de l'expérience des vies passées devient de la Maîtrise, 2 points par Éveil et par sort appris, titre « Le Phénix renaît de ses cendres ». Nouveau départ des classements de donjons (« Premiers », titre « Pionnier des boss »). Semaine de la Maîtrise : XP et butin x2 jusqu'au 22 octobre 23 h.

## 1.2.10.5 « Compteurs en direct »

Le nombre de monstres tués (fiche de zone, Encyclopédie) se met à jour pendant les combats, sans changer d'onglet.

## 1.2.10.4 « Placement en un clic »

Mathis (15/10/2026) : « comment on déplace un perso « arrière » devant ? » puis « c'est le plus ergonomique ? » → choix A. `rowBtn(c, cls)` (js/ui.js) : flèche `.tr-mv` à côté de chaque héros de l'équipe dans la liste (enveloppe `.trw`, visible au survol, toujours sur écran tactile) et bouton « Passer devant / derrière » sur la fiche, via `E.setRow`. `placementHtml` ne garde que la case « Placement automatique » (le cadre à boutons en double est retiré, `#placement` reste la cible de « Ouvrir le placement »). Chapitre Équipe du guide mis à jour.

## 1.2.10.3 « Idole Djim revue »

Mathis (15/10/2026, choix « Changer l'effet ») : l'idole Djim donnait un Champion à chaque combat, et chacun faisait monter les Sceaux. Le Champion de Djim porte `idolChamp` (js/engine.js) ; `E.champKill` (js/champions.js) l'ignore : ni Sceau, ni trophée de zone, ni piste. Difficulté et butin doublé gardés. Rien de retiré aux joueurs.

## 1.2.10.2 « Rayonnants sans PA en plus »

Le bonus d'un objet Rayonnant ne donne plus de PA, de Portée ni d'Invocation en plus (un objet à 1 PA restait arrondi à 2 PA). Les Rayonnants déjà obtenus reviennent à leur PA, Portée et Invocation normaux, le reste du bonus est gardé.

## 1.2.10.1 « Le chat entre de bonnes mains »

Modération du chat pour le compte admin Xener : supprimer un message, sanctions depuis le pseudo (muet 10 min à 7 jours, bannir), effacer les messages publics d'un joueur, vider un salon, fermer le chat (supabase/chat.sql : adm_msg_del, adm_msg_purge, adm_chat_clear, adm_chat_close ; suppression en direct par le temps réel DELETE).

## 1.2.10 « Le Poutch »

Mathis (15/10/2026) : « le simuler vs un poutch qui a 100k hp, qu'il ait le temps de dérouler toute la séquence, pour valider ce qu'on a mis comme instruction » ; « uniquement un poutch comme dans dofus » ; choix 1A (8 tours) 2A et B (seul ou avec l'équipe). `E.poutchPreview` (js/engine.js) remplace `E.spellPreview` : copie de la partie, un seul monstre devenu Poutch (100 000 PV, ne frappe pas, sans résistances), PV des héros remis au maximum à chaque pas, 8 tours, aléatoire fixe restauré ensuite. `spPreviewHtml` (js/ui.js) : boutons Seul / Avec l'équipe, sorts avec dégâts et mécaniques, PA par tour, lancers sur 8 tours ; « Ranger au mieux » note les ordres sur le Poutch. Mesure qui a motivé le changement (19 classes, niveaux 60/120/200, 2 052 combats) : un vrai combat dure ≈ 6,3 tours, 40 % des dégâts tombaient après le tour 3.

## 1.2.9.4 « Poisons des monstres »

Choix de Mathis 1A 2A 3B après la relecture de la 1.2.8. `monsterTurn` (js/engine.js) appelle `E.midHit` aussi pour les sorts de poison (valeur d'un tick), les mécaniques des sorts « dot » et les uniques du Minotot et du Kabahal marchent. `minionKey` (js/identboss.js) : un boss invoque les `bossMobs` de son donjon, même hors donjon (Songe infini), jamais une copie de lui-même. js/identmon.js : « prépare son attaque signature… » sans nom. js/pluie.js : bouton désactivé à 00:00. Difficulté de la 1.2.8 gardée (3B). Simulation `--essais 2` avant / après : écarts dans le bruit.

## 1.2.9.3 « Le menu reste en place »

Le menu de gauche ne remonte plus tout seul en haut quand on le fait défiler pendant un combat.

## 1.2.9.2 « Nouvelle stratégie réparée »

Le bouton « + Nouvelle stratégie » (Héros › Sorts & stratégies) ne créait rien : js/idols.js redéfinissait `E.savePreset` / `E.loadPreset` pour les jeux d'idoles et écrasait la version des stratégies de sorts (js/engine.js). Les fonctions des idoles s'appellent maintenant `E.saveIdolPreset` / `E.loadIdolPreset`. Au chargement, `S.idols.presets` est ramené à 3 jeux (les anciens clics y rangeaient un jeu fantôme au numéro du héros).

## 1.2.9.1 « Reliques au bon tour »

Choix de Mathis après l'audit (1A 2A 3A 4A 5B 6A). `E.roundHook(F)` dans `E.step` (js/engine.js) juste après `newRound` : L'Ascension y branche `roundFx`, les effets du tour arrivent avant le premier à jouer. `E.relCommit` (js/reliques.js) : Fragments, Phénix, Glouton et PA du Talisman gagnés en combat sont gardés dans `W.rel` et appliqués au début de `E.ascApply`. Anneau du Change 20 → 7 %. `E.idHealIn(t, F)` : l'Érosion expire (`ero >= F.round`). `E.percoSim` vide `S.ch.pend`. `autoPickMs` retiré : en Auto le choix se fait seul, en Manuel la tour attend. Simulation 30 × 20 montées, Normal et Difficile : médianes inchangées (32 / 23 à la 1re montée).

## 1.2.9 « Pluie de kamas »

Xener lance depuis Panel › Annonces une pluie de kamas pris sur son propre compte (2 à 30 min, bandeau + chat Général). Les joueurs connectés à un compte cliquent « Je participe » (carte sur l'accueil, pastille ailleurs) ; à la fin, le serveur partage à parts égales et envoie les kamas par les opérations de l'hôtel de vente. Reste de la division, pluie sans participant ou annulée : retour à Xener (supabase/pluie.sql, js/pluie.js).

## 1.2.8 « Les sorts des monstres et des boss »

Chaque sort de monstre a sa mécanique (saignement, venin, gel, zone, charge, carapace, rage…), visible sur les cartes de monstres. Les boss préparent une attaque signature un tour sur trois (⚠) puis frappent toute l'équipe. Chacun des 131 boss a un sort unique (✦), expliqué dans « Sorts du boss » sur la fiche du donjon après le premier combat (js/identmon.js, js/identboss.js). Simulation : bon équipement 6,50 → 5,88 de stasis, équipe optimisée 7,75 → 6,96 (réglage plus dur choisi par Mathis).

## 1.2.7.2 « Chasse aux bugs du soir »

Audit après les mises à jour du 15/10 (1.2 à 1.2.7). Reliques (`js/reliques.js`) : `relAuto` compare à la relique portée, `pickMore` et `ini` lus sur toutes les reliques (`relAll`), `ignoreRes` sur l'élément du sort, la relance garde `pend.lg`, PM de la Couronne du Sommet au tour 1 seulement (`rl.pmX`). L'Ascension : auto des glyphes avec `relGlyphMax`, compteur des reliques de départ, bandeau de course masqué si `ui.raceInfo.left <= 0`. Menu (`js/ui.js`) : `renderNav` garde le focus de `#navq`, `navSearchHits` classe nom puis description, `navpin` sur la liste brute, `hotPages` sans `bug`/`admin` et avec `home`. Guide : liens « Voir aussi », icônes, `E.ALTAR.per`, thèmes, `scroll-margin-top`. `sw.js` : PRECACHE complété.

## 1.2.7.1 « Monstres immortels corrigés »

Quelques sorts recevaient la mécanique d'identité « cumul » sans ses réglages (`a`, `max`) quand elle était ajoutée pour départager deux sorts d'une même classe (`js/identite.js`, build) : `1 + undefined × n` donnait des dégâts NaN, et un monstre à PV NaN ne meurt jamais. Les mécaniques ajoutées reçoivent maintenant leurs réglages, `dealDamage` remplace un coup non fini par 1 (filet de sécurité), et les rapports de défaite enregistrés pendant le bug sont réécrits au chargement. Test dans `tests/fight.test.js`.

## 1.2.7 « La refonte des sons »

Sons de l'interface, du combat et des grands moments dans `js/sons.js` (window.SONS), joués avec les instruments de `js/musique.js` (`IdlusAudio._h`), aucun fichier. Un timbre par thème (`KIT`), réglage « Timbre » (`snd.sty`, « theme » par défaut). Table de mixage dans Options › Sons : `gvol`, `mvol`, `rvol` (fanfares et récompenses, `A.setFanVol`), `ivol` (interface, `snd.ui`), `cvol` (combat, `snd.cmode` scene / impacts / fin), `avol`. Reliques de l'Ascension : son selon la rareté (`relSnd` dans `js/ascensionui.js`). Les joueurs déjà installés voient une fois la bulle « Nouveaux sons » (`snd.nv13`). Volumes égalisés par `node tools/mesure_sons.js` (réécrit la table `LV`).

## 1.2.6.3 « Boss sans nom »

Les attaques spéciales des boss n'affichent plus leur nom dans le bandeau du combat, comme les sorts des héros depuis la 1.2.6.

## 1.2.6.2 « Jeu fluide »

Baisse d'images par seconde depuis la 1.2 corrigée : le fond de page animé est peint dans une petite toile au lieu de deux couches CSS géantes, et les effets d'ambiance tournent à 30 images/s (environ 20 → 40 images/s mesurées avec l'ambiance active).

## 1.2.6.1 « Nouveau logo »

Logo « i » à l'œuf : `assets/ui/logo.webp` (emblème sans fond, menu et médaillons), `assets/ui/logo-nom.svg` (nom dessiné des écrans de départ), `assets/ui/logo-embleme.svg` (fenêtre de bienvenue), `icons/favicon.svg`, icônes de l'appli et `icons/discord.png` régénérés ; reflet `.shine` toutes les 6 s. Sources et générateur : dossier `logo/` du projet.

## 1.2.6 « L'identité des sorts »

Chacun des 836 sorts a sa propre mécanique tirée de sa description DOFUS (cumul, retardement, piège, glyphe, bombe, portail, téléportation…) et son motif animé en combat. La fiche du sort l'explique dans un bloc « Identité du sort ». Les noms des sorts et des attaques de boss ne s'affichent plus pendant le combat. Puissance des équipes vérifiée par simulation (bon équipement 6,35 → 6,46 de stasis).

## 1.2.5.5 « Plusieurs familles ouvertes »

Menu principal et sommaire du guide : plusieurs familles ouvertes à la fois, état gardé sur l'appareil (`idlus-menu-familles`, `idlus-guide-familles` dans localStorage) ; la famille de la page affichée s'ouvre, rien ne se referme tout seul.

## 1.2.5.4 « Volonté et reliques dans les codes cadeaux »

Le panel Xener peut mettre de la Volonté de L'Ascension dans un code cadeau (type Monnaie › « Volonté (L'Ascension) », au-delà du maximum de 30) et des reliques pour le Reliquaire (type « Relique (Reliquaire) »). Les Fioles de Volonté restaient déjà possibles (type Consommable).

## 1.2.5.3 « Sommaire du guide »

Guide : familles de chapitres repliables (menu déroulant, `st.fam` dans `js/guide.js`), celle du chapitre affiché ouverte ; bouton « Sommaire par famille » sur téléphone.

## 1.2.5.2 « Bugs signalés »

Bugs signalés par les joueurs : bouton +1 ◆ des Sceaux toujours visible, 6e épinglé à la ligne, fiche complète d'un objet au survol dans la liste pour équiper.

## 1.2.5.1 « Course de L'Ascension »
Classements › Course montre la course de lancement de L'Ascension (10 places du titre « Légende de la 1.1 », joueurs classés par meilleur étage en Difficile du mois). La pastille du haut suit cette course ; les Légendes de la 1.0 restent dessous.

## 1.2.5 « Les reliques »

Mathis (15/10/2026) : « ça serait possible de drop des équipements uniques au mode de jeu ? », réponses 1A 2 (tous les 5 étages) 3B 4A 5A 6A puis « rajoute un pool de reliques encore et des effets inédits, et chaque item est animé selon la rareté ». `js/reliques.js` : les 240 reliques (`E.ASC_RELICS`, 40 par emplacement, 18 communes / 14 rares / 8 légendaires), le tirage (`E.relChoices`, rareté selon l'étage, pitié, Anneau du Destin), l'équipement (`E.relEquip`, une par emplacement), le marchand (`E.relShopOffers`, remises, cashback), le Reliquaire (`S.asc.reliquaire`, `E.REL_REWARDS`) et les effets en combat : `E.relSetup` (stats, invocations, âmes), `E.relRound` (PA du tour, soins, boucliers), le hook `E.legPre` du moteur (dégâts donnés et subis, esquive, renvoi, survie), `E.relDie` (tués), `E.relFrag` / `E.relWin` / `E.relLose` (fin d'étage). `js/ascension.js` branche tout cela (`R.relics`, `R.relDue`, `P.t === "relic"`, offres `i >= 100` du marchand, `E.ASC_RUN` pour `ascDef`). Équilibrage `tools/ascension_sim.js` (monHpLv 0,012, monDmgLv 0,006, relVit 40, relPui 80). Animations de rareté en `css/ascension.css` (transform et opacity seulement). Au-delà (Mathis « et pour la tour infinie ? ») : `R.relExtra` = `A.relStart` (6) reliques de départ après les 8 sorts, `P.start` sur le choix.

## 1.2.4.1 « Une idée ? »

La fenêtre « Signaler un bug » a maintenant deux onglets, Bug et Idée. Une idée envoyée depuis là part dans la Boîte à idées (forum Idées du Discord, votes 👍), jamais en ticket de bug.

## 1.2.4 « Le Guide »

Guide en jeu (`js/guide.js`, `css/guide.css`) : page Journal › Guide et bouton « ? » en haut de chaque page, 73 chapitres dont les chiffres sont lus dans ENGINE et DATA à l'ouverture (rien dans la boucle de 3 s). Parcours calculé sur la partie, calculateurs, glossaire, stratégie, fiches de classe, FAQ, favoris et chapitres lus (`S.guideLu`, `S.guideFav`, succès « Érudit d'Idlus »), lien `?guide=<chapitre>`, astuce du jour au Havre-Sac, boutons `GUIDE.q()` dans les pages.

## 1.2.3.1 « Cadeaux rendus »

Bugs signalés par les joueurs : le Jyfus revient aux comptes fondateurs qui l'avaient perdu, et l'XP de guilde au-dessus du plafond du serveur attend l'envoi suivant au lieu d'être perdue.

## 1.2.3 « Sablier de 24 h »

Réserve du Sablier de Xélor à 24 h (`E.SAB_MAX`, `js/engine.js`), les heures achetées ou offertes montent jusqu'à 36 h (`E.SAB_GIFT_MAX`). Recharge inchangée (3 h par jour).

## 1.2.2 « Sablier plus grand »

Réserve du Sablier de Xélor à 15 h (`E.SAB_MAX`, `js/engine.js`), recharge inchangée (3 h par jour). La fenêtre du Sablier liste les sources d'heures avec un bouton « Y aller » (`sabWhereHtml`, `sabGo` dans `js/ui.js`).

## 1.2.1 « Fond de page allégé »

Mathis (15/10/2026 18:44) : « le jeu est lent depuis la maj menu ». Cause mesurée avec Playwright (1280 px, Chromium) : le fond animé `mix` posait `filter:blur(22px)` sur `body::after`, une couche fixe de 150 % de l'écran animée en opacité et transform ; le flou était recalculé à chaque image et le jeu tombait à 20 images/s (18 sans l'ambiance, donc le canvas de `js/ambiance.js` n'y était pour rien : 60 images/s seul). Correctif : plus aucun `filter:blur` sur les couches `data-bgfx` (aur, rid, vag, neb, mix), les dégradés sont adoucis à la place ; 60 images/s PC et téléphone après. Scripts de mesure : scratchpad perf.js / perf2.js.

## 1.2 « Les menus »

Mathis (15/10/2026) : « Réorganiser tout les menus et fait moi des prototype cliquable », puis 28 réponses sur deux maquettes. `NAV` (js/ui.js) passe à six familles (`av df he ec co jo`) ; `NAV_MERGE` range Élevage, Cours des ressources et Succès en onglets de Familiers, HdV et Quêtes (`#subnav` : bandeau de famille + onglets + étoile d'épinglage, `S.settings.pins`) ; `renderNav` redessine la colonne (une famille ouverte `ui.navOpen`, recherche `ui.navQ` sur `NAV_DESC`, mode icônes `ui.navFly`), la barre du téléphone et la fenêtre Menu ; `NAV_NEW` pose l'étiquette « nouveau » jusqu'au 22/10. Options et Signaler un bug quittent la barre du haut. Thèmes : `THEMES`/`applySkin` posent `html[data-skin]` par-dessus Émeraude (blocs CSS en fin de style.css, palettes de la maquette) ; `js/ambiance.js` (`AMB.start/stop`) dessine l'effet du thème sur un canvas fixe, `html[data-bgfx="mix"]` anime le fond (CSS seul) ; les deux suivent `S.settings.ambiance`. Animations du menu en CSS (`.sn-ripple`, `.bpulse`, `#main.pgin`, `.sn-fight.on`), coupées par `body.reduced`/`.nomotion`. Maquettes : https://claude.ai/artifact/WChVczjZzGRTZ8Nmegqkoq et https://claude.ai/artifact/W6MKGmYu6E1zMdnc19fyLT ; scripts dans /mnt/project-files/menus/.

## 1.1.2.10 « Bugs signalés »

Premiers bugs envoyés par le bouton « Signaler un bug » (tickets 110, 112, 113). Ascension : la règle « Un seul élément » prend l'élément du premier sort élémentaire (`E.ascSetup`, `js/ascension.js`) ; les recrues et l'âme de boss ne comptent plus dans la limite d'invocations du héros (`ownSums` dans `js/engine.js`). Jyfus : une étape « cadeau » est terminée dès que le Dofus est possédé (`advance` de `js/archis.js`).

## 1.1.2.9 « Le Havre-Sac en scène »

Mathis (15/10/2026) : « Avoir une scène quand on est dans l'havre sac ». `assets/hs/{jardin,nuit,halouine}.webp` = trois cartes de la sous-zone DofusDB « Havres-Sacs » (id 851 ; cartes 162793486, 162793490, 162795540), même traitement que les zones. `DECORS.of({ home })` choisit selon le thème (data-theme, data-hal) ; `homeHtml` l'affiche quand aucune chasse ni donjon n'est en cours.

## 1.1.2.8 « La tour t'attend »

Mathis (15/10/2026) : « Ne pas rentrer directement dans le prochain combat pour l'ascension ». En manuel, la boucle de js/ascensionui.js ne lance plus `liveStart` toute seule : `readyHtml` affiche l'étage qui vient et le bouton `as-next` lance le combat. Le mode auto et la montée en arrière-plan (`E.ascTick`) ne changent pas.

## 1.1.2.7 « Taux des montures »

Demande de Mathis (15/10/2026) : « connaître le taux de drop des dragodindes, muldos et volkornes comme sur les loots de la zone ». Section « Montures sauvages » dans la fiche des trois zones de capture (`mountZoneBox` de `js/ui.js`) : chance par couleur et par victoire, au format des butins ; taux aussi dans Élevage › Capture, la fiche Monture des héros et la collection. `E.mountCatch` (`js/mounts.js`) donne le taux réel (`E.MOUNT_SP[sp].rate`, une chance par victoire avec un filet, sans bonus de butin) et l'estimation par heure d'après `S.zoneStats`.

## 1.1.2.6 « La zone à l'accueil »

Mathis (15/10/2026) : « Pouvoir voir les zones ici aussi » (capture du bandeau du Havre-Sac). `homeHtml` et `renderZoneView` (js/ui.js) ajoutent les couches de `DECORS.html` (carte, poussières, voile) derrière le bandeau d'accueil pendant une chasse ou un donjon, et sur la fiche de sous-zone.

## 1.1.2.5 « Bouton des Éclats »

Héros › Chasse : le bouton des Éclats de champion reste visible sur chaque Sceau, grisé (« 0 ◆ ») quand on n'a pas d'Éclat.

## 1.1.2.4 « Annonces en boucle »

Demande de Mathis (15/10/2026) : « créer un système d'annonce programmé en boucle par exemple toutes les 1H ». Panel Xener › Annonces › « Annonces en boucle » (`loopBox` de `js/chat.js`), serveur `supabase/annonces_boucle.sql` (table `announce_loops`, fonctions `adm_loop_save`, `adm_loop_on`, `adm_loop_del`, `adm_loops`). Pas de tâche planifiée : le jeu des joueurs connectés appelle `ann_tick()` quand une annonce est due (au plus toutes les 2 minutes) ; le premier appel publie le bandeau (`announces.loop_id`) et/ou le message du Général au nom de Xener, les passages manqués sont sautés. Si une annonce ponctuelle occupe le bandeau, la boucle passe seulement dans le chat.

## 1.1.2.3 « Sceaux mieux expliqués »

Héros › Chasse : un encadré explique comment monter un Sceau (chaque Champion vaincu en chasse fait monter le Sceau de son pouvoir) et à quoi servent les Éclats de champion (10 par Champion légendaire, un Éclat = un Champion vaincu pour le Sceau de son choix).

## 1.1.2.2 « Bouton bug à l'écran »

Demande de Mathis (15/10/2026) : « Mettre le bouton sur l'écran du joueur ». Bouton coccinelle `ic-bug` dans la barre du haut (`renderStatus` de `js/ui.js`), juste avant la recherche ; il ouvre la fenêtre de `js/bugs.js`.

## 1.1.2.1 « Dofus dans les codes cadeaux »

Le panel Xener peut mettre un Dofus dans un code cadeau (cas rares : compensation, concours). Un Dofus déjà possédé n'est pas redonné.

## 1.1.2 « Les décors »

Mathis (15/10/2026) : « Pour le mode manuel de l'ascension je veux que ce soit nous qui choisissions les sorts », « créer moi une vraie scène de combat pour le mode », « Non pas sur ce modèle » (pas La Scène), « Je veux des véritables décors animés, en lien avec DOFUS », « applique les nouvelles scènes sur les zones et donjon » ; réponses 1A à 8A sur le prototype, puis « Garder avec crédit » pour la licence DofusDB et « sans crédit pour les scènes ». Ascension manuelle : `E.ascManual`, `E.ascManualCast`, `E.ascManualEnd`, `E.ascCanCast` (js/ascension.js), le combat attend le joueur sans limite (`F.dur` n'avance pas dans `ascStep`) ; scène face à face `arenaHtml` / `playFx` (js/ascensionui.js, css/ascension.css : `.as-stage`, `.as-u`, projectiles `.as-orb`, chiffres `.as-num`). Décors : rendus de cartes DofusDB (`api.dofusdb.fr/img/maps/1/<id>.jpg`, filigrane coupé, 1100 px webp) — `assets/asc/<donjon>.webp` = dernière carte du donjon (121, 3,9 Mo), `assets/z/<sous-zone>.webp` = une carte extérieure de la sous-zone (`map-positions` avec `outdoor`, 187, 8,5 Mo ; 3 sous-zones sans carte propre prennent celle d'une voisine) ; `E.ascDecor` (salle du boss de la dizaine) et `js/decors.js` (`DECORS.of(F)` : donjon → salle du boss, sinon sous-zone ; Kolizéum, Boss des mondes et PvP gardent leur décor, 8A) branché dans `buildArena` (vue Scène seulement). Pas de crédit sur la scène (Mathis : « sans crédit pour les scènes ») : la mention ci-dessous et la ligne d'Options › À propos tiennent lieu d'attribution.

**Données issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0** (https://api.dofusdb.fr/ : usage non commercial, attribution, partage aux mêmes conditions). Idlus est un jeu de fan gratuit, sans publicité ni paiement.

## 1.1.1.4 « Tout dans les codes cadeaux »

Les codes cadeaux (panel Xener › Codes cadeaux) peuvent offrir presque tout ce qui se gagne : monnaies (Kolizetons, Doplons, jetons, insignes, Bribes, Éclats, Essence, Fragments, Écus, heures de donjon), familiers, montures, idoles, légendaires, runes, meubles, trophées de zone, objets d'élevage, ailes, palettes, aura, partitions, plusieurs titres et ornements, cadres de héros. Les âmes d'archimonstres restent hors des codes.

## 1.1.1.3 « Signaler un bug »

Demande de Mathis (15/10/2026) : « Créer un bouton report bug, pour te permettre d'automatiser les corrections de bug », plus « une liaison sur le serveur discord ». Fenêtre `js/bugs.js` (Communauté › Signaler un bug, Options › Aide, page Suggestions ; diagnostic de `diagText()` joint), table et fonctions `supabase/bugs.sql` (`bug_send` avec ou sans compte, `bug_mine`, `adm_bugs`, onglet admin « Bugs »). Le workflow « Bugs signalés » (`bugs-signales.yml`, toutes les 15 min) en fait un ticket GitHub `bug-joueur` sans pseudo (`tools/bugs_github.js`) et un fil dans le forum #bugs du Discord (`discord_bot.js bugs`), puis recopie l'état des tickets (fermé + « Corrigé dans la x » → le joueur et le fil Discord le voient). Une tâche planifiée de Claude reprend les tickets ouverts pour les corriger.

## 1.1.1.2 « Chances des stasis 11 à 15 »

Signalé par Mathis (15/10/2026) : « on voit pas le coef de drop des stasis + que 10 ». `dofLadder()` (`js/ui.js`) complète l'échelle des chances jusqu'à `E.STASIS_MAX` avec la valeur de la stasis 10 (les chances sont plafondées à la 10 depuis la 1.1) et met la stasis choisie en surbrillance.

## 1.1.1.1 « Chasse aux bugs de la 1.1 »

Demande de Mathis (15/10/2026) : « Vérifie tous les bugs possibles du jeu et corrige ». Balayage Playwright de toutes les pages et de leurs boutons (PC et téléphone, partie neuve et avancée, en ligne simulé) : aucune erreur. Relecture du code de la 1.1 : `enclosTick` avance par étapes (`js/elevage.js`), commandes du jour gardées dans `elev.ord.list`, `E.catchingUp` pendant `catchUp` (le Champion légendaire n'apparaît pas hors ligne), auto de L'Ascension (mercenaire, fin de montée au changement de mois via `ascEnd(S, "reset")`, fiole du Défi une fois par jour), fiche de donjon stasis 11+, `invTrash` sans Parfaits, `legFuse` garde le surplus, Échap ferme `#sheet`, copies restaurées par leur date.

## 1.1.1 « Fonder une alliance »
- Le nom et le sigle de l'alliance tapés ne s'effacent plus ; la page dit ce qui manque quand le bouton est grisé (niveau de guilde, kamas du coffre, Meneur seulement).
- Un refus du serveur affiche son vrai message.

## 1.1 « La 1.1 »

Grosse mise à jour validée par Mathis sur maquette (15/10/2026, 1A 2D 3A), assemblée depuis les branches de chaque fil : L'Ascension (`js/ascension.js`, `js/ascensionui.js`, `supabase/ascension.sql`, course `race11`), stasis 11 à 15 (`E.STASIS_MAX`, `E.STASIS_UP` dans `js/engine.js`, chances de Dofus plafonnées à la stasis 10), 4 nouveaux Dofus (`js/dofusp.js`, Premiers `gardien11`), menu Dofus (`js/dofusui.js`), Champions (`js/champions.js`, `js/champui.js`), élevage (`js/elevage.js`, `supabase/elevage.sql`), familiers et montiliers, Défi du jour, inventaire, boss de guilde (`supabase/gboss.sql`), Chasse aux Percepteurs (`js/chasse.js`), Alliances et prismes (`js/alliance.js`, `supabase/alliances.sql`) et raccourcis clavier (`HOTKEYS` dans `js/ui.js`). Simulation : stasis 1 à 10 inchangées, équipes au maximum ≈ 10,5 à Nileza. Le workflow « Serveur en ligne » applique les SQL modifiés et redéploie la fonction « record ».

## 1.0.36.1 « Compteurs complets en vert »

Demande de Mathis (15/10/2026) : « dans quêtes de région, quand on a 32/32 ce n'est pas en vert comme les autres ». `counter()` de `js/questui.js` met la classe `ok` sur les compteurs région, Dofus, succès et ornements quand ils sont complets.

## 1.0.36 « La Scène »

Choix de Mathis (15/10/2026) : vue Scène en plateau isométrique avec bandeau d'infos (1A 2A), nouvelles animations (1A-4A), sorts et boss animés (1A 2A 3A 4A + mise en scène de Gargandyas, puis 1A-6A sur la seconde maquette), publiés ensemble. La Formation reste la vue par défaut. Code : `arenaLayout`/`sceneHud`/`anStart` dans `js/ui.js`, sorts et boss des lots 1 et 2 dans `js/animsorts.js` (complète `SG` et `BXSP` via `window.DX.anim`). Le moteur ajoute `msp` (nom du sort de monstre) aux évènements de lancer, purement visuel.

## 1.0.35.1 « Textes de la Renaissance »

Demande de Mathis (15/10/2026) : « enleve Chaque renaissance lui donne +30 % d'XP ». Conseil d'accueil (`js/welcome.js`) et ancienne note 0.1.12 (`js/ui.js`) corrigés : plus de bonus d'XP depuis la 1.0.35.

## 1.0.35 « Mémoire des vies »

Demande de Mathis (15/10/2026) : « Nerf l'xp de la Renaissance et trouvé un véritable intérêt », choix 1A 2A 3A avec +50 %. `E.REN_XP = 0` (plus de bonus d'XP) et `E.heroXpNeed(c, l)` = `E.xpNeed(l) × (1 + 0,5 × ren)`, utilisé partout à la place de `E.xpNeed(c.lvl)`. Mémoire des vies (`js/renaissance.js`) : `E.memOffer` (3 sorts de 3 autres classes, sans invocation, gardés dans `c.memOffer`), action `memPick`, `c.mem` / `c.memPend` ; `E.spellDef` retrouve un sort d'une autre classe (`E.memDef`, paire `m:<id>`), limite `E.MEM_SLOTS` (1, 2 dès la V, 3 à la X) appliquée par `E.memFit`, `E.equipSpell`, `E.autoLoadout`. `E.VERSION` 10 : les héros déjà renés reçoivent `memPend = ren`. Écrans : `memSheet`, section du Grimoire, `spPlace`. Simulation : +2 % de dégâts en moyenne à la Ren I, +8 % à la X. Test : `tests/memoire.test.js`.

## 1.0.34.3 « Cours rééquilibré »

Demande de Mathis (15/10/2026) : « réequilibre le cours des ressources », choix 1A 2B 3A sur la maquette https://claude.ai/artifact/KzhF1woyfPJ3Zvsp8vbQ9r. `E.resPrice` prenait le niveau du monstre le plus fort qui donne la ressource : Pollenectar et Oueille (624 et 547 monstres, dès les Pious niveau 11-15, à 100 %) valaient 142 et rapportaient la moitié des 114 M de kamas de la vente directe en 13 h. Désormais `E.resPriceLvl` prend le monstre le plus faible (`E.PRICE_LVL = "min"`) ; `E.resLvl` (niveau affiché, tranches de la Foire) ne change pas. Rejouées sur les vraies ventes du serveur : 53 M au lieu de 114 M. `supabase/vente_data.sql` régénéré (`node tools/build_vente.js`, 183 prix). Le cours (VOL 2 000, ×0,1 à ×3) ne change pas (2B).

## 1.0.34.2 « Tout prendre »

Demande de Mathis (15/10/2026) : « Avoir un bouton "tout prendre" dans le trop plein pour tout récupérer si on ne veut pas briser ». `E.overTakeAll(S)` remet les objets du trop-plein (les plus récents d'abord) dans la limite de `E.itemCap`, renvoie `{ n, left }` ; bouton `overtakeall` dans `overHtml()`. Test : `tests/sac.test.js`.

## 1.0.34.1 « Quitter la guilde »

Demande de Mathis (15/10/2026) : « avoir une option pour quitter la guilde ». Le départ existait déjà (`guild_leave` dans `supabase/guildes.sql`, le Meneur est remplacé par `g_heir`, guilde dissoute si seul) mais le bouton était caché tout en bas de l'onglet Membres. Bouton « Quitter la guilde » ajouté dans le bandeau (`leaveBtns`, `leaveTxt` dans `js/guilds.js`), avec confirmation « Oui, quitter » / « Annuler » (`g-leave0`). Aucun changement côté serveur. Tests : `tests/online.test.js`.

## 1.0.34 « Les 19 classes »

Demande de Mathis (15/10/2026) : « J'aurai bien aimé pouvoir monter toutes les classes au lvl 200 mais on manque de slot, fait des propals », réponse « 1B 2B 3C 4A » sur la maquette. `E.HERO_MAX` 13 → 19, toutes classes ; places 14 à 19 au prix de `E.RECRUIT_HIGH` (2,5 / 3,5 / 5 / 7 / 10 / 15 M, la courbe ×2,2 aurait mené le 19e à 199 M). Collection `S.cls200` (`E.classesDone`, `E.classesN`) : une classe compte pour toujours dès qu'un héros de cette classe a atteint le niveau 200 (ou a renu). `E.classesMult` : +1 % d'XP et de kamas par classe, hors plafond, dans `giveRewards`. Succès `cls5`, `cls10`, `cls19` (titre « Maître des 19 classes »), ornement `classes19`. Tableau repliable en haut de la page Équipe et héros (`classesBoardHtml`, `S.settings.c19Shut`). Tests : `tests/core.test.js`.

## 1.0.33.1 « Sac de 3 000 places »

Demande de Mathis (15/10/2026) : « Enlever la limite de stockage dans les sacs ou propose moi d'autres idées », réponse « 1B 2A 3A » sur la maquette. `E.ITEM_CAP` 1 000 → 3 000, Grenier `per` 50 → 100 (max 5 000). Rangement compact dans le navigateur seulement (`E.packSave` / `E.unpackSave`, appelés par `js/save.js` quand le support est `SV.local`) : `items` devient `zItems` (uid, n° de modèle, valeurs, autres champs) avec la liste `zk` « modèle:caractéristiques » écrite dans la sauvegarde ; `SV.read()` (envoyé en ligne) et `E.serialize` gardent le format normal, `E.deserialize` lit les deux. Jauge `SV.usage()` dans Options › Sauvegarde. Règle automatique « Bas niveau » (`S.settings.auto.low`, `E.lowItem`). Tests : `tests/sac.test.js`.

## 1.0.33 « Chromatiques »
- Monstres chromatiques : 1 monstre sur 4 096, en chasse et en donjon (boss compris), a les couleurs inversées et un halo doré. Même force, mais butin et XP ×3 et 1 Éclat chromatique.
- La chaîne : rester dans la même zone fait monter la chance, jusqu'à ×3 après 500 victoires d'affilée. Elle repart à zéro quand on change de zone.
- Prismatiques : 1 chromatique sur 50 est arc-en-ciel (5 Éclats, titre « Prisme vivant » pour le premier).
- Album chromatique (Encyclopédie › Chromatiques) : paliers 5, 10, 25, 50 et 100 (titres, ornement, teinture, Charme ×1,5, cadre), trophée chromatique d'une sous-zone complète (+3 % de butin et d'XP), vitrine de 3, compteur de chasse, espèce recherchée ×2 (1 changement par jour).
- Atelier du prisme : teinture chromatique d'un héros, ornement et cadre « Prisme », aura chromatique en combat, payés en Éclats.
- Fiche de rencontre, célébration à la première trouvaille de chaque espèce, chromatiques trouvés pendant l'absence, onglet « Chromatiques » dans les Classements et annonce dans les Hauts faits.
- Les Dofus ne changent jamais.

## 1.0.32.13 « Mathis décide »

Demande de Mathis (15/10/2026) : « C'est à moi de décider si oui ou non il triche ». La vérification automatique (ladder_from_save) ne met plus `flagged` : elle met `suspect` + `flag_reason`, le joueur reste classé et apparaît dans l'onglet « En vérification » du panel Xener avec « C'est bon » (verified) ou « Retirer » (flagged). Pas de « Premier » tant qu'il est signalé. Exception : la partie de Mathis retouchée par le panel de test reste hors classement.

## 1.0.32.12 « Vérifié, il reste classé »

Un joueur vérifié et remis dans les classements par Mathis y reste : il n'est plus remis « en vérification » automatiquement (colonne `ladder.verified`, supabase/classements.sql et chat.sql). Badge « Vérifié » dans le panel Xener.

## 1.0.32.11 « Dofus retrouvé »

Retour de joueurs relayé par Mathis le 15/10/2026 : quêtes du Dofus Verdoyant et du Dofus du Cauchemar « Quête terminée » sans Dofus. Cause : E.bagFlush (js/engine.js) range au trop-plein les objets les plus récents quand le sac dépasse sa taille, donc le Dofus tout juste donné par la quête ; E.dofusOwned ne regarde que le sac, et le trop-plein plein brise le plus ancien en runes. Correction : bagFlush ne range jamais un Dofus, le trop-plein ne brise jamais un Dofus, E.breakItem refuse un Dofus ; E.dofusRepair (js/archis.js, à chaque E.deserialize) remet au sac les Dofus du trop-plein et redonne le Dofus d'une quête terminée qui n'est nulle part (un Dofus ne se vend pas à l'HdV), avec un message de migration. Test : tests/dofusp.test.js.

## 1.0.32.10 « Équiper en Sagesse »

Demande de Mathis le 15/10/2026 : « qu'on peut focus une stat en particulier avec l'auto équipement ? Pour les renaissances […] les stuffs sagesse ». js/ui.js : réglage par héros c.gearFocus (GEAR_FOCUS : sa, pp, vit, pui, do, cri, so, ini, res, pa, pm, tac, fui), choisi dans le menu « Privilégier » de l'onglet Équipement ; itemScore compte la caractéristique choisie 10 fois (GEAR_FOCUS_X = 9 en plus), donc gearPlan, la pastille verte, « Équiper au mieux » et « Tout équiper au mieux » la suivent ; planKey inclut c.gearFocus. Sans choix, rien ne change.

## 1.0.32.9 « Boss sur l'accueil de la guilde »

Demande de Mathis le 15/10/2026. js/guilds.js : la carte du boss (vie en 5 phases, essais en réserve, bouton « Affronter le boss ») devient bossCard(), affichée en haut de l'accueil de la guilde (version courte, bouton « Classement et récompenses ») et dans l'onglet Boss. La ligne du boss des « Activités de guilde » est retirée. Test tests/online.test.js.

## 1.0.32.8 « Sauvegarde à l'abri »

Signalement relayé par Mathis le 15/10/2026 (joueur JustEver : héros 200 revenus à 115, Dofus 14 → 8 après avoir fermé le navigateur). Une partie de 640 Ko plus ses 6 copies de secours approche la limite du navigateur (environ 5 millions de caractères) ; l'écriture de la partie échouait alors sans rien dire. js/save.js : SV.makeRoom libère de la place (copies de cette partie, puis des autres parties, puis parties de test du panel) et réessaie ; copies limitées à 3 millions de caractères (COPY_BUDGET) ; js/ui.js : message si une sauvegarde échoue ; SV.lastCopy ignore une copie datée dans le futur (horloge en avance de 21 h chez le joueur : plus aucune copie automatique ensuite). Test tests/sauvegarde.test.js.

## 1.0.32.7 « Dofus épinglés »

Demande de Mathis du 14/10/2026 : « tu penses pouvoir ajouter le fait de pin les quetes pour les dofus ? ». Nouvel objectif épinglé `{ k: "dof", id }` (E.pinInfo dans js/quetes.js : étape en cours, avancement, terminé) ; bouton « Suivre » sur la fiche du Dofus (js/questui.js) ; dans la bande d'objectifs, la pastille porte l'œuf du Dofus et le bouton « Y aller » de l'étape (dofusStepGo(st, cls) dans js/ui.js), et un clic ouvre la quête (pingo → QUI.pick).

## 1.0.32.6 « Jackpot sans limite »

Jackpot du Trool : la limite de 100 tickets par jour et par joueur est retirée (Mathis, 14/10/2026 : « ticket illimité pour le jackpot ») ; foire_jackpot_buy (supabase/foire.sql) ne vérifie plus que les kamas, et accepte 1 à 100 tickets d'un coup (bouton « 100 tickets · 1 M » dans js/foireui.js). foire_state renvoie max 0 (pas de limite).

## 1.0.32.5 « Y aller au donjon »

Demande de Mathis du 14/10/2026 : « quand il manque une ressource pour un craft et que c'est dans un donj il manque un bouton pour s'y rendre directement (comme pour une zone) ». Nouveaux `dgOfMon` (donjon ouvert d'abord, puis le plus proche du niveau de l'équipe), `dgLockTxt` (ce qui ouvre un donjon fermé) et `dgGoBtn` dans js/ui.js. « Y aller » vers la fiche du donjon dans la fiche ressource (resDetail, ouverte par « Où ? »), la liste de courses (resGo), le panneau des clés (keySource) et les commandes de ressources (gbCard).

## 1.0.32.4 « Airs des nouveaux menus »

Quatre airs à l'orchestre pour les menus arrivés avec la 1.0.30, qui jouaient encore l'air de la zone de chasse (demande de Mathis du 14/10/2026 : « Il reste quel menu sans musique ? » puis « Go », écoutés et validés sur maquette) : Comptoirs des marchands (air de boutique : clochette de la porte, pièces, caisse ; js/musique.js `comptoirs`), Valse de la Foire du Trool (orgue de barbarie, `foire`), Galop des montures (Familiers et montures, `montures`), Cotations des ressources (la bourse : cloche d'ouverture, téléscripteur, cours qui montent, chutent et remontent ; Cours des ressources, `cours`). MUS_PAGE, le juke-box et les ambiances de js/ui.js les connaissent ; volumes calés sur la médiane des autres airs. Le succès « Mélomane » passe de 46 à 50 airs de l'année (ceux qui l'ont déjà le gardent).

## 1.0.32.3 « Montée de stasis »

Demande de Mathis (14/10/2026, « enchaîner de 1 à 5 sans attendre la fin du donjon, retourner sur la page, choisir le niveau ») : l'encadré Enchaîner de la fiche de donjon propose « Monter jusqu'à la stasis N ». `E.enterDungeon(S, did, stasis, chain, climb)` garde `S.dungeon.climb` (stasis visée) et `k0` (départ) ; à chaque victoire contre le boss, la course suivante prend la stasis du dessus jusqu'à la stasis visée. Défaite, plus de clé ou fin : résumé dans le journal. Les boutons « Y aller » des étapes de quête de Dofus passent `data-k` pour régler la montée. Les chances de Dofus ne changent pas.

## 1.0.32.2 « Le vrai visage du Dopeul »

Le petit module de combat (menu PC et bande du téléphone, js/formation.js mfPic) montrait l'image d'un monstre de la zone pour un Dopeul de quête : le Dopeul est un monstre de la zone déguisé (js/vie.js) qui garde son e.img. Le module regarde maintenant e.dop avant e.img et affiche la tête de la classe du Dopeul, comme la vue Formation (signalé par Mathis le 14/10/2026). tests/formation.test.js le vérifie.

## 1.0.32.1 « Compositions et métiers »

Chaque composition d'équipe garde son placement métier (demande de Mathis du 14/10/2026 : « quand je switch entre mes teams ça sauvegarde aussi le placement métier ») : E.compOf enregistre `jobs` (héros → métier et ressource, E.compJobs), E.applyComp retient le placement actuel dans la composition qu'on quitte puis remet celui de la nouvelle (les héros sans métier prévu reviennent au repos ; entraînement, atelier ou expédition : héros laissé tel quel et cité dans le message). Une composition sans `jobs` (enregistrée avant) ne touche pas à la récolte. Test : tests/compmetiers.test.js.

## 1.0.32 « Relâcher une monture »

Demande de Mathis (14/10/2026, « ajouter un bouton « Relâcher » tout de suite, en petite mise à jour avant la 1.1 ») : le jeu n'avait aucun moyen de libérer une place à l'écurie, si bien qu'une écurie pleine bloquait les naissances de l'enclos (« Le petit attend ») et les captures au filet. `E.releaseMount` (js/mounts.js, action `releaseMount`) supprime la monture après confirmation, la fait descendre de son héros et refuse une monture à l'enclos. Boutons dans la fiche de couleur (js/collui.js, `co-mfree`) et dans l'écurie du héros (js/ui.js, `mountfree`). Test dans tests/fight.test.js.

## 1.0.31 « Sorts expliqués »

Demande de Mathis (14/10/2026, « Préparer une refonte des sorts pour qu'il soit plus compréhensible », réponses 1A 2A 3A 4A) : spSentence (js/ui.js) écrit chaque sort en une phrase avec spellEstimate, roleBadge donne son rôle ; grimNew remplace la grille d'icônes par une liste triée par dégâts par tour ; spDouble signale une attaque du même élément et du même type qui fait 25 % de plus par PA ; spCondHtml ne garde que les conditions utiles par rôle (COND_BY_ROLE) ; logLineNew illustre les sorts dans le journal. Aucune règle de combat ne change.

## 1.0.30.8 « Malus de niveau affiché »

Demande de Mathis (14/10/2026, « les joueurs doivent être au courant de ce malus ») : giveRewards renvoie out.pen[cid] = [malus, écart, niveau du monstre] et le résultat de combat affiche « −X % » à côté de l'XP, avec une note sous le butin.

## 1.0.30.7 « Vente directe plus claire »

Bouton « Vendre » des ressources (Mathis, 14/10/2026 : « quand je clique sur vendre ça ne fait rien ») : la vente passait bien sur le serveur, mais vendre tout le stock fermait la fiche (elle ne s'affiche que pour une ressource possédée), sans trace visible à part une notification. La fiche reste maintenant ouverte une minute avec le résultat (js/venteui.js `V.last`, `VENTEUI.kept`), le bouton affiche « Vente en cours… » et toute erreur donne un message.

## 1.0.30.6 « Grande annonce du Jackpot »

Chaque tirage du Jackpot du Trool s'annonce à tout le serveur (demande de Mathis du 14/10/2026 : « Faire une grosse annonce sur le jeu pour chaque jackpot ») : foire_resolve (supabase/foire.sql) écrit une annonce dans le chat Général (kind 'ann', data.t 'jack' : pot, tickets, joueurs, heure) pour un tirage de moins de 2 h, et js/giga.js l'affiche en plein écran 6 s chez tous les joueurs connectés, comme la GIGA annonce d'un Dofus (même file d'attente), puis la ligne dorée reste dans le Général. Le bandeau des annonces de l'admin n'est pas touché.

## 1.0.30.5 « Compteur du Jackpot »

Une pastille dans la ligne du haut (#jpbar, js/foireui.js paintChip) montre le pot du Jackpot du Trool et le temps avant le tirage sur toutes les pages, pour les joueurs connectés à un compte (choix de Mathis 1A 2A 3A 4A, 14/10/2026). Le pot est relu toutes les 5 minutes quand le jeu est à l'écran (foire_jackpot, environ 12 lectures par heure et par joueur), après chaque achat et juste après le tirage ; la pastille se cache sur la page Foire, défile quand le pot monte et brille en or les 5 dernières minutes.

## 1.0.30.4 « Renaissance affichée »

Le résultat de combat montre le bonus de Renaissance (×1,3 par renaissance) à côté de l'XP des héros qui ont renu (signalé par Mathis le 14/10/2026 : « le boost xp des renaissances marche pas »), et la Salle d'entraînement affiche enfin l'XP avec ce bonus (engine.js giveRewards : out.xp de l'élève compte E.renXpMult).

## 1.0.30.3 « Boss des mondes et Kolizéum réparés »

Signalé par Mathis (14/10/2026, « le boss des mondes et le koli est bug ») : la fonction serveur `record` ne démarrait plus depuis la 1.0.30 (`worker boot error: Expected '}', got '<eof>'`, une accolade fermante perdue à la fusion entre `dofusAnn` et `songe` dans `supabase/functions/record/index.ts`), donc toutes ses requêtes (Boss des mondes, Kolizéum, Défi, guildes, records, GIGA annonce, Songe) répondaient 500. Accolade remise ; `tests/serveur.test.js` (dans `npm test`) vérifie que le fichier se lit (équilibre des accolades, puis chargement avec les types retirés sous Node 22) ; la CI passe à Node 22. Combat en formation : invocations et sbires tombés masqués (`.ent.tk.summon.dead`). `lookUrl` ignore les objets sans numéro DofusDB (légendaires `leg_…`, avant : `itemIds[]=NaN`, erreur 500).

## 1.0.30.2 « Équiper au mieux complet »

Bug signalé par Mathis (14/10/2026, « j'ai fait équiper au mieux j'ai perdu 200 de stat »). Le score d'objet de js/ui.js (itemScore, utilisé par gearPlan, « Équiper au mieux », la pastille verte et le tri du choix d'objet) lit maintenant les caractéristiques réelles comme E.charStats (itemStats : Parfait, exo, Potentiel des Dofus) ; buildEls lit les points placés aussi en mode automatique (profil Multi-élément) ; bonus de Vitalité pour le profil Tank ; paliers de panoplie avec E.setCountFx (Couture fine) ; planKey suit le Potentiel (S.dofPot).

## 1.0.30.1 « Jets remis à niveau »

Soft reset des jets (choix 40A), activé avec les mots de Mathis (14/10/2026, « active le soft reset ») après le comptage en lecture seule (Actions › Serveur OVH › soft-reset-comptage : 55 comptes, 15 touchés, 138 objets dont 15 Parfaits, 802 runes, 138 Cristaux, 13,8 M kamas). `E.SOFT_RESET_ON = true` (js/forge.js) : au lancement, une fois par partie (`S.softReset`), ce que la forgemagie d'avant la 1.0.30 a ajouté au-dessus de 80 % de la fourchette est retiré, avec la compensation et le titre « Forgemage d'antan ».

## 1.0.30 « La grande mise à jour »

Réponses de Mathis du 14/10/2026 (questions 1 à 43 de la maquette « Refonte des guildes », « Et tu fait tout en 1 seule fois »), construites en une seule version :

- Guildes refaites (js/guilds.js, js/gboss.js, supabase/guildes.sql, gboss.sql, percos_data.sql) : coffre, 5 à 15 places, 4 améliorations à rangs et 8 uniques, Percepteurs en zone ou en donjon (un par zone), attaques avec l'équipe d'arène rejouées par le serveur (supabase/functions/record), Guerre des Percepteurs, boss de guilde en 5 phases. Remise à zéro de toutes les guildes, compensation et code GUILDES : tools/serveur/guildes_reset.sql, lancé à part (Serveur OVH › guildes-zero).
- Économie : vente directe et Cours des ressources (js/vente.js, supabase/vente.sql, vente_data.sql), Foire du Trool et Jackpot (js/foire.js, supabase/foire.sql), page Comptoirs (js/comptoirs.js).
- Combat : vue Formation et petit module de combat (js/formation.js), top 5 dans la fiche du donjon avec l'équipe du record (js/dgrank.js, supabase/classements.sql), GIGA annonce de Dofus (js/giga.js).
- Absence : Expéditions et heures de donjon (js/expeditions.js ; tools/idle_sim.js : une expédition ≤ 61 % d'une heure de chasse, 8 h de donjon hors ligne ≈ 2 h jouées).
- Forge (js/forge.js) : forgemagie dure au-dessus de 80 % de la fourchette (E.FM_HARD : succès critique ×0,25, échec +20 points, ≈ 350 runes pour un objet niv. 200 Parfait contre 80), atelier de brisage avec coefficient de 10 à 200 % (supabase/brisage.sql), fiche d'objet en deux colonnes. Soft reset des jets construit mais éteint (E.SOFT_RESET_ON), comptage en lecture seule par tools/soft_reset_compte.js.
- Caractéristiques : PM, Tacle, Fuite et Dommages de poussée sur les équipements (tools/build_caracs.js), menu des caractéristiques avec mode automatique à profils ou plan en 4 étapes (tests/carac.test.js).
- Collections (js/collections.js, supabase/collections.sql) : page Familiers et montures, collection de panoplies, Potentiel des Dofus 0 à X (+5 % par rang) et Dofus Sublimé ; Almanax du Kaliptus et des Veilleurs passé au Dolmanax.
- Communauté : alignement à camp unique avec quêtes et guerre des cités (js/alignement.js, supabase/alignement.sql), Songe infini classé (supabase/songe.sql), Panel Xener qui réunit l'admin et le test (js/panel.js).
- Musique et sons : fanfares, partitions et titre « Mélomane », Gramophone, sons de combat, ambiances (js/musique.js).

## 1.0.29.6 « Connexion sans boucle »

Rapport du serveur du 14/10/2026 : une seule session renouvelait son jeton environ 3 fois par seconde (12 326 renouvellements en une heure, `auth.audit_log_entries` et `auth.refresh_tokens` à 66 des 100 Mo de la base). Cause probable : l'heure de l'appareil en avance d'une heure ou plus, la bibliothèque croit alors le jeton toujours expiré. Garde-fou dans js/online.js : au-delà de 20 renouvellements (`TOKEN_REFRESHED`) en une minute, la session est fermée sur cet appareil (`signOut({ scope: "local" })`) et le joueur prévenu, avec l'avance estimée de son horloge. Test 8 quater dans tests/online.test.js.

## 1.0.29.5 « Dofus au boss »

Dans une quête de Dofus, une étape « vaincre le boss » après la première se valide en battant le boss pendant l'étape : le Dofus ne tombe plus avant la salle du boss.

## 1.0.29.4 « Offrandes comptées »

Retour de Mathis (14/10/2026, « les offrandes almanax déjà réalisées ne comptent pas pour les quêtes de Dofus »). Cause : l'étape `almanax` des quêtes de Dofus (js/archis.js) n'avançait que sur l'évènement d'offrande reçu pendant l'étape (`Q.prog`). Elle lit maintenant le compteur de la sauvegarde `S.cnt.almanax` (toutes les offrandes depuis la 0.1.39), comme les étapes d'âmes ou d'objets Parfaits ; les joueurs qui avaient déjà le compte voient l'étape validée au chargement (`E.refreshArchis`). Prérequis inchangés (Kaliptus 7, Veilleurs 5). Test 5 dans tests/almanax.test.js.

## 1.0.29.3 « Ceinture Séculaire »

La Ceinture Séculaire et trois autres équipements oubliés (Plumodales, Cape Reski, Bottes des Voyageurs) peuvent maintenant tomber, avec la même règle que les autres. Les autres chances ne changent pas.

## 1.0.29.2 « Clés en silence »

Demande de Mathis (14/10/2026, « ajoute un truc pour désactiver toutes les notifs de drop de clé »). Nouvelle case dans Options › Jeu (`S.settings.keyToastOff`, cochée par défaut = messages affichés) : décochée, la boucle d'évènements de js/ui.js n'affiche plus le toast « Butin : Clef… » ; la clé est toujours ajoutée et notée dans le journal.

## 1.0.29.1 « Le Gelano à 1 PA »

Retour de Mathis (14/10/2026, « le Gelano est considéré à 2 PA même s'il y a écrit qu'un seul »). Cause : `E.perfectStats` (js/engine.js) ajoute +2 % à chaque caractéristique d'un objet Parfait avec un minimum de +1 ; le Gelano n'a qu'un jet, 1 PA (fourchette 1-1), il est donc toujours Parfait et donnait 2 PA en combat (6 → 8 PA au total). Pareil pour tout objet Parfait avec PA, PM, Portée ou Invocation. Maintenant `E.PERFECT_SKIP` exclut ces quatre caractéristiques du bonus Parfait ; les autres gardent +2 %. Test dans tests/forgemagie.test.js.

## 1.0.29 « Un air pour chaque menu »

Demande de Mathis (fil « Musique et sons du jeu », 14/10/2026) : « rajoute des nouvelles musiques pour les menus qui n'en ont pas, avec un thème plus orienté DOFUS 3 ». js/musique.js : instruments d'orchestre (`strings` pupitre de cordes à quatre archets désaccordés, `strl` violons en mélodie, `vln`, `cb`, `harp`, `cel`, `clar`, `fhorn`) et percussions (`bdrum`, `swell`, `tri`, `sroll`), niveaux mesurés hors ligne ; 13 airs (`monde`, `cles`, `defi`, `heros`, `sac`, `phenix`, `quetes`, `succes`, `biblio`, `carnet`, `champions`, `strateges`, `idees`), chacun avec son tempo, sa mesure et son instrument principal, volume aligné sur les airs déjà en jeu (sonie pondérée), écart vérifié avec les 35 autres. js/ui.js : `MUS_PAGE` couvre tous les menus ; Monde joue `monde`, la vue d'une zone joue l'air de la zone, Donjons `cles`, Encyclopédie `biblio`, Quêtes `quetes` et Succès `succes`. L'accueil et la page Combat gardent l'air de la zone de chasse.

## 1.0.28.1 « Brisage sans gel »

Retour de Mathis (14/10/2026, « briser des items fait aussi un gros freeze »). Mesures (Chromium, partie de test : 950 objets dans le sac, 13 héros niveau 180) : avant 1.0.24.3, ouvrir le Brisage prenait 72 s et chaque objet brisé 73 à 82 s (plan d'équipement de tous les héros recalculé à chaque objet en moins, voir 1.0.24.3) ; en 1.0.27, 0,15 à 0,22 s par clic (toute la page Forgemagie redessinée). Maintenant `brisageParts()` (js/ui.js) donne les morceaux de la page et `brisagePatch()` ne remplace que ce qui a changé depuis le dernier dessin (`brLast`) : barre de sélection, compte d'objets, listes des filtres si une panoplie disparaît, et dans la liste les seules lignes modifiées (repérées par `data-k`). Clics `brtog`, `brall`, `brnone`, `brask`, `brone`, `cancel`, `break`, `brgo`. Cocher : 0,02-0,03 s ; briser un objet : 0,08-0,13 s mise en page comprise. Vérifié : après chaque suite de clics, la page est identique à un redessin complet (PC et téléphone). `grpItems` calcule une seule fois la clé d'un objet.

## 1.0.28 « Thème d'Halouine »

Demande de Mathis (« Créer un thème d'halloween », 14/10/2026), choix 1A 2A 3A 4C 5B sur maquette. Du 24 octobre au 3 novembre (même période que le Cadre d'Halouine, `E.halWin` dans js/systems.js), `applyHal()` (js/ui.js) pose `data-hal="on"` sur `<html>` : palette Citrouille par-dessus Émeraude ou Nuit violette, citrouille près du logo (en bas sur téléphone), chauves-souris dans la barre du haut, toiles d'araignée dans le coin des panneaux (SVG en data URI, css/style.css), braises (`#halfx`, hors de `#main`, positions fixes) seulement avec les animations complètes. Le thème arrive et part tout seul (vérifié chaque seconde). Options › Affichage › Ambiance d'Halouine (`S.settings.halouine`) pour le couper, ligne visible seulement pendant la période. Panel de test : « Thème d'Halouine : Forcé ». Le Bal d'Halouine de la 1.0.26 (5B) suit le thème (`musEvent` passe par `halOn()`) : même période, forçage compris, et couper l'ambiance coupe aussi cet air. `window.IDLUS_HALOUINE()` dit si le thème est affiché.

## 1.0.27 « Choix d'objet sans gel »

Retour de Mathis (14/10/2026, « tjrs des gros freeze quand je clique sur un slot d'items équipés »). Mesures (Chromium, partie de test : 950 objets dans le sac, 8 héros niveau 160 équipés) : un clic sur un emplacement prenait 0,23 à 0,36 s quand le sac venait de changer (le plan d'équipement du héros, `gearPlan`, était recalculé d'un bloc pour les flèches vertes et le « Meilleur choix »), puis toute la page Équipe était redessinée. Maintenant : `planView(c)` rend le dernier plan connu et demande le nouveau en priorité au calcul en coulisses (`planHot`, tranches de 12 ms) ; quand il arrive, seule la fiche (`#fiche`) se redessine. Les clics `slot`, `pmore` et `pgrp` ne redessinent que la fiche (`ficheOnly`). Score de l'équipement actuel calculé une fois par ouverture (`gainFor(..., base)`). Résultat : 0,08 à 0,10 s par clic, même liste, mêmes flèches et même « Meilleur choix » une fois le plan à jour. « Équiper au mieux » attend toujours le plan à jour (`gearPlan`).

## 1.0.26 « Une musique par zone »

Choix de Mathis 1A 2A 3A 4A 5A 6B 7A (fil « Musique et sons du jeu », 14/10/2026, maquette d'écoute des 35 airs). js/musique.js : 31 airs de plus écrits en notation courte (`song()`), un genre par air, 25 instruments de plus (niveau de chaque instrument mesuré hors ligne), réverbération et écho par air ; les 4 airs de la 1.0.22 sont inchangés. js/ui.js : `musPlace()` choisit l'air (page du Havre-Sac : événement, sinon nuit de 21 h à 7 h, sinon boîte à musique ; pages `MUS_PAGE` ; Songe actif ; donjon, salle du boss à part ; sinon zone de chasse `MUS_ZONE`, Bonta et Brâkmar selon la sous-zone `MUS_SUB`), fondu de 2 s d'un air à l'autre. 6B : les airs d'événement jouent seulement au Havre-Sac, jour et nuit. Juke-box (Options › Sons) : `S.settings.snd.juke` (« zone » ou « fixe ») et `fix` remplacent `tH`, `tD`, `tV` ; « Écouter » joue un air tant que la fenêtre est ouverte.

## 1.0.25.11 « Tenues verrouillées »

Demande de Mathis : enregistrer une tenue (Héros › Tenues) verrouille ses objets. `E.syncGearLocks` (js/engine.js) pose `locked` + `glock` sur chaque objet rangé dans une tenue et retire le cadenas des objets marqués `glock` qui ne sont plus dans aucune tenue (Écraser, ✕) ; un cadenas posé à la main reste. Appelé à l'enregistrement, à la suppression et au chargement (tenues déjà enregistrées). Le bouton cadenas refuse de retirer un verrou de tenue et le détail de l'inventaire affiche le nom de la tenue. La fusion de légendaires refuse une copie rangée dans une tenue. Test : tests/tenues.test.js.

## 1.0.25.10 « Récolte et Équipe sans saut »

Suite du choix de Mathis 3A (fil « Nettoyage du code », « Go ») : la boucle du jeu passe aussi la Récolte (`renderMetiers(soft)`, toutes les 4 s) et la liste de l'Équipe (`#teamtop` / `#tlist`, toutes les 4 s) en mise à jour ciblée `morphTo` au lieu de `innerHTML`. `renderMetiers(soft)` ne fait la mise à jour ciblée que si la page affichée est la même (`ui.plKey`), sinon redessin complet comme avant (`keepList`). Vérifié dans Chromium (PC 1280 et téléphone 390, annonce admin affichée) : même DOM qu'un redessin complet sur Récolte, Artisanat et Équipe après un changement d'état ; dans la vraie boucle les éléments restent les mêmes et le défilement est gardé. Les quatre pages que la boucle du jeu redessinait en entier (accueil, Quêtes, Récolte, Équipe) sont toutes passées en mise à jour ciblée.

## 1.0.25.9 « Vérification plus juste »

Choix de Mathis 1A 2A (fil « en vérif », 14/10/2026). Le serveur (`ladder_from_save`, supabase/classements.sql) met un joueur « en vérification » si son niveau d'équipe monte de plus de 60 niveaux + 1 par minute depuis l'envoi précédent. Simulation : un héros niveau 60 avec 7 recrues niveau 1 gagne ~77 niveaux en 2 min au Sablier ×3 (limite 62), ~84 en 5 min sans Sablier (limite 65) : une coupure de connexion pendant le jeu suffisait à le signaler. Nouvelle limite : 120 niveaux + 15 par minute (2 min : 150, 10 min : 270). Une partie retouchée (héros mis au niveau 200) saute de centaines de niveaux et reste repérée. Règles des métiers et du temps de jeu inchangées (2A).

## 1.0.25.8 « Jeu fluide avec une grosse banque »

Retour d'un joueur relayé par Mathis (14/10/2026, « je lag bcp sur tous les onglets … c ptet lié à ma banque »). Mesures (Chromium, partie de test : 2 376 ressources en banque, 900 objets dans le sac, coffre plein, 13 héros niveau 180, un objet toutes les 2 s) : avant 1.0.24.3, un gel de 58 s sur l'Accueil ; depuis, aucune tâche longue sur Accueil, Équipe, Défi, Kolizéum, Encyclopédie. Restait : textes du haut réécrits à chaque tour de boucle (120 ms) même inchangés, d'où une remise en page complète 8 fois par seconde (setTxt) ; estimation de la bourse du Défi (defiSim complet, ≈ 0,5 s) faite au repos par pas (defiEstimate) ; E.koliChanceAsync rend la main au milieu d'un combat (un combat = 30 à 50 ms d'un bloc) ; plan d'équipement en coulisses au plus toutes les 20 s par héros (PLAN_GAP).

## 1.0.25.7 « Pages qui ne sautent plus »

Choix de Mathis 3A (audit du code, fil « Nettoyage du code ») : la boucle du jeu (`loop`, js/ui.js) redessinait l'accueil (Havre-Sac, `ui.home` « apercu ») et les Quêtes en entier toutes les 3 s (`innerHTML`), ce qui remettait à zéro défilements, champs et listes ouvertes. Nouveau `morphTo(m, html)` (js/ui.js, exposé en `DX.morph`) : compare le nouveau HTML à la page et ne touche que les textes, attributs et éléments qui changent (même balise et même `id` à la même place = élément gardé ; `<details open>` ouvert à la main gardé ; champ ou liste déroulante qui a le focus intouchés ; champs libres sans `data-act` gardent leur saisie, comme `repaintKeep`). `renderHome(soft)` (le HTML vient maintenant de `homeHtml()`, ancien `renderHomeInner`) et `QUI.render(main, soft)` / `renderQuests(soft)` : `soft` seulement depuis la boucle ; un clic redessine toujours en entier. Vérifié dans Chromium (PC 1280 et téléphone 390) : sur 15 pages et sous-pages, morph donne exactement le même DOM qu'un redessin complet, et 420 passages d'une page à n'importe quelle autre aussi ; dans la vraie boucle, les éléments de l'accueil et des Quêtes restent les mêmes et le défilement est gardé. Restent à passer en mise à jour ciblée : Récolte et liste de l'Équipe (4 s).

## 1.0.25.6 « Panoplies de boss »

Chaque pièce d'une panoplie au nom d'un boss de donjon (Minotot, Blop Multicolore Royal, Strigide…) tombe sur ce boss, au lieu du donjon voisin qui donnait le plus d'ingrédients. 71 panoplies corrigées.

## 1.0.25.5 « Toutes les coiffes et capes »

Mathis (14/10/2026, « ça ne fonctionne pas pour tout. Revérifie chaque item »). Seules les 64 coiffes et capes d'ITEM_SKINS (js/looks.js) se dessinaient sur le héros. Vérification des 569 : l'API look de DofusDB (jeton par objet) connaît 542 objets ; chaque rendu comparé au héros nu (539 changent le dessin) ; les 64 apparences connues comparées au pixel près au rendu DofusDB : 57 justes, Piou Jaune et Vert inversés (cape 168/170, chapeau 283/284, corrigés), Ailes en bois, Coiffe du Koulosse et Casque de Boufbowl faux (retirés, dessinés par DofusDB). `lookUrl` (js/ui.js) dessine toute coiffe ou cape sans apparence connue par le jeton DofusDB (tête et couleurs d'origine de la classe), sauf `LOOKS.NO_LOOK` (30 : Coiffe et Cape Invisibles, Bandana de Mama Ayuto dessiné vide, 27 objets récents inconnus de DofusDB), marqués « Invisible » dans la garde-robe. Jetons DofusDB gardés 7 jours dans le navigateur (`idlus-looktok`). Liste complète : verif-coiffes-capes.csv dans les fichiers du projet.

## 1.0.25.4 « Code allégé »

Choix de Mathis 2A (audit du code, fil « Nettoyage du code »). Aucun changement pour les joueurs : 252 règles de style jamais utilisées retirées de `css/style.css` (511 → 490 Ko ; classes absentes du code, vérifiées une à une, dont l'ancienne Expédition `xp-*`, l'ancienne fiche `hr-*`/`fiche*`, `dfhome`) et 7 sélecteurs allégés ; vérification dans Chromium : mêmes styles calculés avec l'ancienne et la nouvelle feuille sur toutes les pages, PC 1280 et téléphone 390. `defiHomeCard`, `defiLeftTxt` et `logoImg` (jamais appelés) retirés de js/ui.js. builds.js, codes.js, fiches.js et idees.js réutilisent l'échappement `h` du jeu au lieu de leur copie. js/chat.js : plus de renvoi `?testeur=1` vers /beta/ (fermée). `test-serveur.html` (test du déménagement OVH) rangé dans `tools/serveur/`.

## 1.0.25.3 « Commandes renouvelées »

Les commandes d'artisans déjà livrées (parties d'avant la 1.0.24.1) sont remplacées à l'ouverture (refill dans js/vie.js), jusqu'à 10 par jour.

## 1.0.25.2 « Mes builds »

Mathis (14/10/2026, « avoir un onglet "mes builds" et augmente la limite à 30 builds par compte »). Page Communauté › Builds : onglets « Tous les builds » / « Mes builds n/30 » (`U().bdTab`, js/builds.js). « Mes builds » liste ses builds publiés sans filtre (builds_list p_sort 'mine', jusqu'à 30 d'un coup), avec un compteur, « Publier un build », et sur chaque carte le héros relié (« Mettre à jour depuis … » s'il a changé) et « Supprimer ». Le tri « Mes builds » du menu disparaît. Limite de publication 10 → 30 (supabase/builds.sql, build_publish). Test dans tests/online.test.js.

## 1.0.25.1 « XP/h en donjon »

Mathis (14/10/2026, « afficher l'xp/h quand on enchaîne les donjons, de la même façon que le farm d'une zone »). `S.dungeon.cs` cumule durée, combats, XP, kamas, ressources, objets, poussières de stasis et donjons finis sur l'enchaînement (passé à la course suivante dans `endFight`, js/engine.js) ; `E.dgChainRate` donne les taux par heure. Affiché dans l'encadré du Havre-Sac (tuiles XP/h, kamas/h, donjons/h, poussières/h), sous le titre de Combat et en haut de la fiche du donjon. Défi du jour exclu.

## 1.0.25 « Renaissance des métiers »

Un métier d'artisanat ou de forgemagie au niveau 200 peut renaître (10 fois au plus, 1 million de kamas × le numéro de la renaissance). Artisanat : +30 % d'XP par fabrication et un plancher de jet relevé de 10 % par renaissance, jets parfaits à la X. Forgemagie : +30 % d'XP par rune qui passe, +1 point de succès critique et −0,5 point d'échec critique par renaissance (pas sur les runes Ga). Titres « Artisan renaissant », « Main d'or », « Maître éternel », ornement « Enclume du Phénix », succès « Sept vies ». Les classements des métiers trient par renaissance puis niveau, et l'XP de la semaine compte toutes les vies (supabase/classements.sql, supabase/guildes.sql). Test tests/renmetiers.test.js.

## 1.0.24.5 « Recettes instantanées »

Mathis (14/10/2026, « dès que je swipe de recette ou que je modifie les qt de craft », PC Chrome). Sur PC, les actions recsel / recqty / recqtyd ne font plus render() de toute la page : recPanel() redessine seulement le panneau de la recette et la ligne sélectionnée (≈ 65 ms → 12 ms par clic sur la partie de test). Le téléphone gardait déjà la fiche seule.

## 1.0.24.4 « Places libres cliquables »

Une place vide de pièce (« + » de « Ma maison » et de la page Havre-Sac) se clique même sans meuble à placer : fenêtre avec les meubles de la pièce, leur bonus, où les trouver et un bouton pour y aller ; infobulle au survol sur PC. Publiée en 1.0.24.2 (32f124d), effacée par 4b069c1 (envoyé depuis une copie d'avant), rétablie telle quelle.

## 1.0.24.3 « Métiers sans lag »

Mathis (14/10/2026, « les métiers de craft me font lag de zinzin »). Cause : chaque nouvel objet dans le sac (fabrication, butin) invalidait le plan d'équipement de tous les héros (gearPlan, pastille « Meilleur équipement dispo » du menu Héros, recalculée à chaque affichage) ; avec ~950 objets et 8 héros, un seul affichage prenait 88 s dans Chromium. gearPlan calcule maintenant le score de chaque objet et de chaque palier de panoplie une fois par plan, évalue chaque essai par différence, n'essaie plus au-delà de 2 exemplaires identiques et saute les essais de panoplie sans pièce posée (plans identiques vérifiés sur la même partie) ; teamAlerts le fait au repos (requestIdleCallback, par panoplie essayée). Artisanat : recettes par métier rangées une fois (recipesRaw), place du sac comptée une fois, pastilles des métiers sans liste complète (recCanN), score porté mis en cache (curScore). Affichage d'un métier : ~100 → ~40 ms.

## 1.0.24.2 « Coiffes et capes visibles »

Mathis (14/10/2026, « les 37 coiffes et 27 capes ne sont pas visibles actuellement », carte « DofusDB partout »). Le moteur de rendu d'Ankama (static.ankama.com/dofus/renderer) répond 403 aux images demandées depuis idlus.github.io : les héros avec une coiffe, une cape ou des couleurs choisies retombaient sur l'image locale. `lookUrl` (js/ui.js) envoie la même description d'apparence à renderer.dofusdb.fr/look (tête, couleurs, coiffe, cape), qui l'accepte depuis le jeu et se met en cache longtemps ; cache des images renouvelé (media-v10) pour oublier les réponses 403 gardées.

## 1.0.24.1 « 10 commandes par jour »

Une commande d'artisan livrée est remplacée aussitôt, jusqu'à 10 livrées par jour (E.CMD_DAY_MAX, js/vie.js) ; primes à 3 (bois ou argent) et à 10 (Coffre en or). Retour de la boîte de la 1.0.23.1 effacée par la 1.0.24.

## 1.0.24 « Boutique du Kolizéum »

Mathis (14/10/2026, « réajuste le prix des galets dans le koli et rajoute de nouveaux produits dans la boutique », maquette puis « 1c, 2a mais avec des prix plus haut, 3 2h par jour, 4a, 5a, 6a mais beaucoup plus cher, 7b »). Simulation (tools/koli_kz_sim.js, adversaire Conseillé contre les Fantômes) : 2,3 à 2,8 Kolizetons par combat (1,7 à 2,1 en auto), soit ≈ 25 par jour avec les seuls tickets offerts, ≈ 65 pour un joueur régulier en auto, ≈ 100 pour un gros joueur. Galets ×10 (20 à 60 ; la reprise des Galets d'avant la 1.0.6 garde l'ancien prix, champ `paid`). Onglets Progression (Sablier 1 h à 60, 2 par jour ; Trousseau de clés à 40, clé d'un donjon débloqué au choix, 3 par semaine ; Potion de Savoir 60, Cristal de Forgemagie 40, Fiole 10, Pierre d'âme 6) et Havre-Sac (Statue du Gladiateur +2 % d'XP, Bourse du Kolizéum +2 % de kamas, 350). Titres « Briseur de cotes » 250 et « Maître de l'arène » 600, ornement « Écusson du Kolizéum » 450, Coffre en obsidienne 800. Limites par jour / semaine : `it.day`, `it.week`, `S.shopLim`, `E.shopWeekLeft` ; clés : `it.key`, `E.shopKeys`, 5e argument de `E.buyShop`.

## 1.0.23 « Builds partagés »

Mathis (14/10/2026, « un menu pour partager nos builds … un peu comme sur le site Huzounet », maquette puis réponses 1A à 17A). Page Communauté › Builds (js/builds.js) : cartes (héros dessiné par DofusDB avec coiffe, cape et bouclier du build, objets, Dofus, ❤, vues), filtres classe / tranche de niveau / élément / budget (calculé depuis le prix des ressources) / recherche d'objet, de Dofus ou de titre, tris semaine / nouveautés / meilleurs / vues / favoris / mes builds, bandeau « Build de la semaine ». Fiche : poupée, caractéristiques aux jets moyens (sans les bonus de compte), panoplies, passifs des Dofus, « Comparer avec mon héros », Appliquer / Liste de courses / Copier le code, Signaler. Publication depuis la fenêtre « Partager le build » (compte Discord, 10 builds, mise à jour en un clic quand le héros change, `c.bd` et `c.bdH` dans la sauvegarde). Serveur : supabase/builds.sql (tables builds, build_likes, build_views, build_reports ; RPC builds_list, builds_me, build_publish qui relit le code du build côté serveur, build_delete, build_like, build_view, build_report caché à 3 signalements, adm_builds et adm_build_set pour l'onglet Builds du panel admin). Titre « Théorycrafteur » à 25 ❤. Test dans tests/online.test.js.

## 1.0.22.2 « Un logo par meuble »

Chaque meuble de la maison a son propre logo (35 SVG dans assets/ui/meubles, style des coffres), visible dans la boutique, les tuiles de « Ma maison », les meubles à placer, les pièces et le catalogue. Les trophées de boss gardent le portrait du boss.

## 1.0.22.1 « Recherche dans l'Encyclopédie »

Une barre de recherche sous les onglets de l'Encyclopédie filtre l'onglet ouvert (monstres et butins, familles, boss et donjons, équipements de tous emplacements et niveaux, trophées de zone), sans accents ni majuscules, avec une croix pour vider et un message quand rien ne correspond.

## 1.0.22 « Musique et sons »

Musique composée pour Idlus (Taverne d'Astrub en chasse, Profondeurs du donjon, Boîte à musique au Havre-Sac), jouée par le navigateur (js/musique.js, Web Audio, aucun fichier). Bulle « Jouer en musique ? » une fois, pause quand l'onglet est caché, icône haut-parleur à côté des Options, sons « Bois et cristal » et clic sur les boutons importants, réglages dans Options › Sons.

## 1.0.21.3 « Logos des meubles »

Les lignes « Meubles » et « Trophées de boss » de « Ma maison » (et les tuiles, et la page Havre-Sac) ont de vraies icônes : commode en bois et coupe dorée, dans le style des coffres.

## 1.0.21.2 « Chat sans message perdu »
Le test du chat (tests/online.test.js, « mention mal surlignée ») échouait sur main : 1,5 s après l'envoi d'un message, js/chat.js relit le salon et remplaçait la liste, ce qui effaçait les messages reçus en direct pendant ce temps (en jeu aussi, jusqu'au rechargement suivant). `keepLive` garde les messages plus récents que la liste relue, à l'envoi, au rattrapage et au rechargement.

## 1.0.21.1 « Absence en donjon »

Hors ligne, un donjon ne continue pas : l'équipe chasse dans sa dernière zone de chasse. Le résumé « Pendant votre absence » le dit et nomme la zone.

## 1.0.21 « Havre-Sac en accueil »
L'accueil est le Havre-Sac : bandeau « Havre-Sac de <héros> » avec les bonus en pastilles, bloc « Ma maison » (une tuile par pièce, amélioration sur place, meubles placés, places libres) sous « Aujourd'hui », trois lignes (meubles à placer, trophées de boss, boutique) qui ouvrent la page détaillée ; onglet Accueil renommé Havre-Sac, plus d'entrée Artisanat › Havre-Sac. Choix de Mathis 1A 2B 3A.
## 1.0.20 « Trophées passifs »
Mathis (13-14/10/2026, propal « trophées de zone », réponses 1A 2A puis 1B 2A 3A 4A 5A ; idée présentée dans le forum #idées). Un trophée de sous-zone (S.trophies) ne s'équipe plus : `E.equip` le refuse, `checkHunt` ne crée plus d'objet et émet `trophy` (fenêtre « Nouveau trophée »), et au chargement les objets `trophee_*` portés ou en sac sont retirés (le trophée reste acquis). `E.trophyZoneMult` (js/engine.js) : +3 % d'XP, de butin et de kamas par trophée de la région chassée (hors donjon et Songe), hors plafond, appliqué avec `E.zoneRew` et au multiplicateur de butin. `E.trophyVitrine` : Vitalité et Sagesse des 6 meilleurs trophées ajoutées à tous les héros dans `E.charStats` (simulation : autant de PV qu'en portant les trophées, +583 Vitalité au niveau 70). Emplacements renommés « Dofus ». UI : onglet Trophées de l'Encyclopédie, bandeau de région et compteurs sur 250 sur la page de sous-zone, ligne dans « Mes bonus ». Test tests/trophees.test.js.

## 1.0.19.1 « Havre-Sac réparé »
Mathis (14/10/2026 : « le havre sac ne fonctionne pas chez certain joueurs »). Depuis 1.0.16, `E.bonusParts` (js/systems.js) renvoie une source `dofus` (Dokille pour le butin, Argenté pour les kamas) que le cadre « Mes bonus » (`BSRC`, js/ui.js) ne connaissait pas : la page plantait pour les joueurs dont un héros de l'équipe porte l'un de ces Dofus. Source ajoutée, et `bsrc()` donne un libellé neutre à toute source inconnue. Test dans tests/smoke.test.js.

## 1.0.19 « Métiers comme dans DOFUS »
Mathis (14/10/2026 : « je suis level 30 tailleur mais je peux craft des objets lvl 80 »), choix 1B puis 1A 2A 3A. `E.craftReq` (js/engine.js) = niveau de l'objet (0.1.14.4 à 1.0.16 : le tiers). Pour garder le même effort par objet, `E.craftStep(job)` vaut 3 pour les métiers d'objets (la meilleure recette ≈ 1/3 de niveau ; métier 200 en ~660 fabrications et ~64 000 ressources, contre 640 fabrications et ~71 000 ressources avant pour le métier 66 ; simulation /mnt/project-files/nerf-recettes/metier-niveau-objet/sim2.js) et 10 pour le Bricoleur (inchangé, ses recettes étaient déjà au niveau du métier). Baisse « trop facile » : `E.craftFall(job)`, 30/90 niveaux pour les objets (la même règle qu'avant comptée en niveaux d'objet), 10/30 pour le Bricoleur. Conversion des parties (`E.craftObjConvert`, appelée par `E.deserialize` quand `S.craftObj` manque ; les parties neuves ont `craftObj: 1`) : chaque métier d'objets passe à min(200, 3 × niveau + 2), soit exactement les mêmes recettes, avec la même part de la barre d'XP ; un métier jamais monté reste au niveau 1 ; fenêtre de migration pour le joueur. Serveur (supabase/classements.sql) : le résumé envoyé porte `cobj` ; colonne `ladder.jobs_cobj` ; le premier envoi converti ne compte pas dans la semaine (le gain de la semaine est gardé), n'est pas vérifié et ne donne pas de « Premier » ; un vieil onglet pas converti ne touche plus aux métiers ; vérification de vitesse portée à 150 niveaux en 10 min ; `public.jobs_shown` montre convertis, dans lb_jobs et lb_jobs_week, les comptes pas encore revenus (rien n'est modifié en base). Testé sur une base PostgreSQL locale. Fiches joueurs (admin) : métiers montrés convertis.

## 1.0.18 « Panoplies complètes »
Choix de Mathis après l'audit des panoplies (maquette https://claude.ai/artifact/1sVH8YWiJxz6dHmkoNrC5C, réponse 1A 2B 3A). `tools/build_data.py` n'avait gardé que les recettes à 2 ingrédients absents au plus et jamais les faux : 60 panoplies avaient un dernier bonus impossible. `tools/build_pieces.js` récupère sur DofusDB les 79 pièces manquantes de ces panoplies et les 5 autres faux de DOFUS à recette (13 faux en tout, Jugement de Thanatena exclu car légendaire du Songe), avec leur recette DOFUS sans les ingrédients absents d'Idlus (`craft.simpl` = nombre retiré), et écrit `js/pieces.js` ; `js/data.js` les ajoute aux objets. Les Bottes de Stroud (sans recette) tombent sur les monstres de la Ceinture de Stroud à la même chance. Ensuite `tools/build_armes.js` (dégâts des armes) et `tools/build_drops.js` (drop des équipements, 1.0.15) les prennent comme les autres ; pour cette version, seules les lignes des 84 nouveaux objets ont été ajoutées à `js/drops.js`, les chances des autres équipements ne bougent pas. Caractéristiques et bonus de panoplie inchangés (3A). `js/pieces.js` fait partie du paquet du serveur (`tools/build_server.js`). Test : `tests/pieces.test.js` ; `tests/songe.test.js` fait jusqu'à 3 essais du Rêve (le résultat dépendait du nombre de tirages de butin).

## 1.0.17.1 « Bon donjon »
Bug signalé par un joueur (relayé par Mathis) : dans la fiche d'un donjon ouverte depuis la recherche, choisir une stasis ou un nombre de donjons à enchaîner rouvrait le donjon vu juste avant. La fiche (`dungeonSheet`, js/ui.js) retient maintenant elle-même son donjon (`dgPick`), et les boutons de stasis et d'enchaînement portent l'identifiant du donjon. Test ajouté dans tests/smoke.test.js.

## 1.0.17 « Hôtel de vente façon DOFUS 3 »
Demande de Mathis (« améliore l'hdv pour qu'il soit comme sur dofus 3 », réponses 1A à 9A sur la maquette). `js/market.js` : onglet Acheter refait (arbre de catégories, tableau ×1 / ×10 / ×100 + prix moyen triable, ligne choisie ouverte en dessous, filtres niveau / caractéristique / panoplie / « À ma portée » calculés sur l'appareil), courbe 7 / 30 jours avec volumes, repères ±15 % autour du prix moyen, prix conseillé à la vente, « Acheter une quantité » (lots les moins chers combinés), favoris (`S.hdv.fav`), « Mes ventes et achats » (En vente / Vendus / Achats) avec pastille dans le menu (`MARKET.newSales`, journal local, rien de plus envoyé au serveur). Serveur (`supabase/hdv.sql`) : fonctions en lecture seule `hdv_market`, `hdv_history`, `hdv_bought` et `hdv_fold` (recherche sans accents), index `hdv_sales_buyer` ; `hdv_search` et `hdv_stats` gardées pour les anciennes versions du jeu.

## 1.0.16 « Passifs des Dofus »
Demande de Mathis (« un passif unique pour chaque Dofus », réponses 1A 2A 3A 4A 5A puis 1B 2A 3A sur la maquette). `js/dofusp.js` donne à chacun des 31 Dofus un passif (`E.DOFP_LIST` : nom, texte, valeur, famille, déclencheur, rôle conseillé) qui s'ajoute à ses caractéristiques. Branché dans `js/engine.js` (début de combat, coups donnés et reçus, soins, mort d'un allié, invocations, XP) et `js/systems.js` (kamas et butin d'équipe une seule fois, dans les plafonds). Éveil des Dragons : les 6 primordiaux sur un héros renforcent leurs passifs de 25 % (`E.DOFP_RESO`). Kolizéum à moitié (`E.DOFP_PVP`), passifs copiés dans l'instantané de défense. Journal de combat seul (ligne dorée pour les passifs marquants). Interface : encadré « Passif », panneau « Passifs des Dofus » sous le héros, nouveau choix du Dofus, filtre par famille dans Quêtes › Dofus. Aucun effet sur `E.dofusDrop`. Fonction serveur : `dofusp` ajouté à `tools/build_server.js`. Test : `tests/dofusp.test.js`.

## 1.0.15.1 « Reliquats remis à zéro »
Choix de Mathis après la 1.0.14.3 : au chargement, `E.deserialize` (js/engine.js) remet à 0 le reliquat (`it.well`) de tous les objets une seule fois (drapeau `S.wellReset`), caractéristiques inchangées.

## 1.0.15 « Tout se drope »
Demande de Mathis (« tous les stuffs droppables, un peu comme DOFUS 3 », réponses 1A, rareté ×15, 3A 4A 5A 6A 7C sur la maquette). `tools/build_drops.js` fait jouer au vrai moteur une heure de chasse dans chaque sous-zone et un passage de chaque donjon, puis écrit `js/drops.js` : chaque équipement fabricable tombe sur les monstres de la sous-zone qui donne ses principaux ingrédients (ou sur le boss quand ses ingrédients viennent surtout de lui), avec une chance par héros réglée pour que droper un objet précis prenne environ 15 fois le temps de chasse de ses ingrédients (bonus de butin de l'équipe comptés une seule fois). Les objets sans recette gardent leurs drops DofusDB. `js/engine.js` remplace les drops DofusDB par ces tables (gardés dans `m.dbItems` pour la rareté de l'HdV), `E.ITEM_DROP_SCALE` = 1, un tirage par héros, `E.bossDropMult` (×1 à ×3,25 selon la stasis) et l'annonce `dropit` pour un équipement jamais obtenu. Dofus, légendaires et trophées exclus. Test : `tests/drops.test.js`.

## 1.0.14.3 « Reliquat corrigé »
Forgemagie : une rune qui passe consomme le reliquat de l'objet (comme dans DOFUS) ; on ne peut plus remplir le reliquat à l'infini en faisant baisser puis remonter une caractéristique. Objets déjà forgemagés inchangés.

## 1.0.14.2 « Menu de la poussière »
Demande de Mathis (« un menu quand on clique sur la poussière », maquette https://claude.ai/artifact/BZJZ8paM4NVqbPKR4qkr9Z, réponse 1A 2A 3A 4A). La pastille de poussière de la barre du haut (`#dustchip`, js/ui.js `statusHtml`) devient un bouton visible aussi au téléphone ; elle ouvre `#dustpop` (`dustOpen`/`dustMenuHtml`), fenêtre accrochée sous la pastille sur PC et pleine largeur au téléphone, fermée par ✕, Échap ou un clic ailleurs, rafraîchie avec la barre du haut quand la poussière, les kamas ou les parchemins changent (`dustRefresh`). Dépenser : 6 boutons `craftscroll` (prix `E.scrollCraftCost`), Idoles (`idolSheet`), Pierre d'âme et Parfum de pistage (action `dustgo` vers la recette du Bricoleur). Gagner : donjons en stasis, coffres, Défi du jour, Kolizéum, Songe/guilde/chasses. Styles `.dm-*` en fin de css/style.css.

## 1.0.14.1 « Clés un peu plus rares »
Demande de Mathis (« baisser un peu le taux de drop des clés de donjon »). `E.KEY_DROP_SCALE = 0.7` (js/engine.js) multiplie la chance de clé des monstres de chasse (et le rythme affiché par `E.resRateH`). Simulation (bon équipement, sans Double gain, 4 h par zone, 4 sous-zones à donjon par niveau), clés par heure avant → après : niv. 50 : 29 → 21 (4 héros), 36 → 23 (8) ; niv. 100 : 43 → 30, 68 → 47 ; niv. 150 : 55 → 40, 97 → 66 ; niv. 200 : 57 → 41, 102 → 72. Clés de quêtes, commandes et récompenses inchangées.

## 1.0.14 « Cadres spéciaux »
Demande de Mathis (question 2B de la maquette des cadres). Le portrait rond `.head` porte `data-fr` (`E.heroFrame` dans js/systems.js : cadre spécial choisi, sinon feu si rené, sinon métal du niveau). `E.SFRAMES` liste 9 cadres spéciaux avec leur condition, `E.setFrame` / action `setFrame` enregistre le choix (`c.frame`). Choix dans la feuille Apparence (`frameHtml` dans js/ui.js). Le cadre du Kolizéum reste acquis après la remise à zéro de la semaine (`S.unlocks.frKoli`), celui d'Halouine se débloque en gagnant un combat du 24/10 au 3/11 (`S.unlocks.frHal`). Styles en fin de css/style.css.

## 1.0.13 « Interface plus nette »
Demande de Mathis (maquette https://claude.ai/artifact/VnzZRvd1troVA6gjeakeS9, réponse 1A 2A 3A 4A 5A 6A 7A). Barre du haut : libellés Options/Admin/« tués »/« en ligne » retirés au profit des icônes, zone en `.st-wt` raccourcie. Annonce : une ligne partout (`-webkit-line-clamp:1` sur `.atx`, « Lire la suite » géré par `annClip` de chat.js). Menu de gauche : rangées de 27 px. Menu du téléphone : 4 colonnes. Onglets `.subtabs` / `.catchips` au téléphone : une ligne défilante, position gardée par `tabsKeep` (ui.js, clé page + rang de la rangée, observateur sur #main). `deltaHtml` : verdict par `gainFor` + 4 gains / 4 pertes en colonnes (`.cmpbox`). Bulle `.chmin` sur PC : sans aperçu ni pastille d'événement.

## 1.0.12.9 « Forgemagie pour tous »
Demande de Mathis (« ne pas bloquer les métiers de forgemagie, enlever la condition des métiers de craft »). `E.fmLearned` (js/systems.js) renvoie toujours vrai : Costumage, Joaillomage, Cordomage, Forgemage, Sculptemage et Façomage sont ouverts dès le départ, sans le niveau 65 du métier d'artisanat lié. Textes de l'atelier et de l'étape « Briseur de runes » de la quête principale mis à jour ; niveaux et XP déjà gagnés inchangés.

## 1.0.12.8 « Grand nettoyage »
Demande de Mathis (« B » : tous les points restants de l'état des lieux du 13/10, /mnt/project-files/audit-bugs/). 46 points corrigés en 4 groupes, le 39 était déjà réglé (marge basse du bouton du chat) et le 29 l'était par la 1.0.10.3. Recherches : `E.searchNorm` / `txtHas` (sans accents, œ/æ) dans les succès, l'Encyclopédie, l'inventaire, les ressources, les panoplies, les recettes, la forgemagie et le brisage. Fiche d'objet et de ressource en fenêtre sous 861 px. Grimoire au doigt : fiche puis « Ajouter à la barre ». Panoplies actives = palier atteint, paliers impossibles signalés (60 panoplies, affichage seulement). Recherche de l'inventaire différée de 150 ms. Chat : brouillons gardés (panel admin, téléphone), bandeau d'annonce sur 2 lignes au téléphone, menu de pseudo au-dessus, compteur qui décompte ; de 1280 à 1599 px chat ouvert, le menu de gauche passe en icônes ; barre du haut sur une ligne connecté (requête de conteneur). `navBadges` : une seule pastille sur Héros. Kolizéum : réponse `ok` sans `opps` = erreur, plus de relance en boucle ; cadence affichée (4 s, 10 s en ligne) ; une colonne sous 1150 px et de 1100 à 1550 px chat ouvert. HdV et guilde : message de panne avec Réessayer, « Acheter » grisé sans kamas, écart plafonné à 99 %. `deNom` (élision « d'Auditeur »). Emblème Vulkania ajouté à `tools/gen_ornements.js`. Bulles de découverte : anneau redonné après chaque redessin, bulle dans le menu sur PC, « Relecture ». Harnais d'audit : écran « Choisis ta partie » et serveur OVH coupé.

## 1.0.12.7 « Recrues au niveau 1 »
Demande de Mathis (« quand on recrute un nouveau héros il soit forcément lvl 1 »). `E.recruit` (js/engine.js) crée la recrue au niveau 1 au lieu de la moitié du niveau du meilleur héros ; la fiche de recrutement l'annonce. `S.recLv` compte toujours le niveau donné (1), le contrôle du classement (supabase/classements.sql) ne change pas. Héros existants inchangés.

## 1.0.12.6 « Grades de guilde »
Demande de Mathis (retour de joueurs : « avoir le grade en guilde pour modifier l'XP des gens » et « avec le grade Membre on ne peut pas poser de perco »), choix 1A 2A. Nouvelle RPC `guild_share(p_user, p_share)` (supabase/guildes.sql) : le Meneur ou un Bras droit règle la part d'un membre de rang plus bas, nom gardé dans `guild_members.share_by` et affiché au joueur, qui peut toujours la changer. `guild_give` ne réécrit plus la part quand le jeu envoie `p_share` vide (envois réguliers) et le jeu reprend la part du serveur à chaque lecture de la guilde. `perco_place` (supabase/gboss.sql) accepte le rang Membre (Recrues refusées), retirer reste Meneur et Bras droits.

## 1.0.12.5 « Liste de courses plus pratique »
Demande de Mathis (« un total du contenu de sa liste de course, et un lien vers le métier quand la recette est faisable »). `shopTotalHtml` (js/ui.js) additionne les ingrédients de toutes les entrées de `S.shop` (dès 2 entrées), ressources manquantes en premier. Une entrée prête affiche « Fabriquer » (`shopgo`) : objet ou recette du Bricoleur → page Métiers › Artisanat, métier et recette sélectionnés (fiche ouverte sur téléphone) ; amélioration d'outil → Métiers › Récolte, outil déplié.

## 1.0.12.4 « Bricoleur après 120 »
Signalement de Mathis (14/10/2026 : « Jsuis 130, les recettes me rapportent plus d'xp sur bricoleur »). Cause : `E.craftTop` (js/engine.js, référence de la baisse « recette trop facile » de 1.0.9.2) comptait aussi les recettes uniques ; le Coffre en merisier (meuble unique, niveau 120) mettait la référence du Bricoleur à 120 au lieu de 100. Passé le métier 120, les recettes niveau 100 tombaient à la moitié de leur XP et tout le reste à 1 XP (au Bricoleur 130 : 0 recette à XP pleine, 160 à 1 XP ; maintenant 7 à XP pleine, environ 10 fabrications par niveau jusqu'au 200). `E.craftTop` ne compte plus que les recettes refaisables, comme `E.craftTopXp`. Les 6 autres métiers ne changent pas (référence 66 dans les deux cas). Le message « recette trop facile » de la fiche de recette donne la référence du métier quand ton niveau la dépasse, et `#recnext` est masqué pour les recettes à 1 XP (il affichait « dans 56 719 fabrications »). Test avec la vraie baisse de chaque recette dans tests/artisanat.test.js (l'ancien test l'esquivait).

## 1.0.12.3 « Compteur des joueurs en ligne »
Mathis : « il ne fonctionne pas le compteur de joueur en ligne » (« 1 en ligne » alors que 15 parties étaient envoyées dans le quart d'heure). Le Realtime du serveur OVH (v2.134) n'active la présence d'un canal que si le client l'annonce (`config.presence.enabled`) ou si le réglage du serveur l'impose ; le Supabase d'avant l'activait pour tous. `ON.chatLive` (js/online.js) envoie maintenant `enabled: true`. Vérifié sur le serveur avec deux clients de test : sans le réglage, le second ne voit que lui ; avec, les deux voient les 17 présents.

## 1.0.12.2 « Récolte qui monte jusqu'au bout »
Demande de Mathis : `E.gatherYield` (js/engine.js) reste linéaire jusqu'au niveau 150 (`E.YIELD.from`), puis la quantité par coup monte en ligne droite jusqu'à `E.YIELD.top` au niveau 200 (≈ 6 par coup de 30 s sans outil, au lieu de 4,7). L'XP de métier suit le même rendement (montée 150 → 200 un peu plus rapide). Test de croissance dans tests/recolte.test.js.

## 1.0.12.1 « Artisanat haut niveau »
Signalement de Mathis (14/10/2026 : « on xp rien sur les craft hl, 30 items par niveau »), choix 1A 2A. Cause : l'XP d'une fabrication plafonne à 612 (objet niveau 200) dès le métier 66 alors que `E.jobXpNeed` continue de grimper (33 fabrications par niveau au 66, 180 au 199 ; Bricoleur 100 puis 343). `E.craftBoost` (js/engine.js) multiplie l'XP pour que la recette la plus haute faisable (`E.craftTopXp`, recettes refaisables) vaille au moins 1/`E.CRAFT_STEP` (10) de niveau ; jamais moins qu'avant, rien au niveau 200 ; la baisse de `E.craftXpMult` (1.0.9.2) s'applique toujours. Les mentions « XP −x % » lisent maintenant `E.craftXpMult`. Fiche de recette : `#recnext` (fabrications restantes pour le niveau suivant). Simulation : /mnt/project-files/nerf-recettes/haut-niveau/ (ressources pour les 7 métiers au 200 : ~5 millions avant, ~550 000 après). Serveur : seuil du contrôle de vitesse des métiers d'artisanat porté de 60 à 120 niveaux en 10 min (supabase/classements.sql).

Semaine des métiers à zéro, demande de Mathis (13/10/2026 23:47 Paris, écrit en toutes lettres : « remets à zéro la semaine des métiers ») après le nerf des recettes 1.0.9.2 : un compte avait gagné 654 801 XP d'artisanat dans la semaine juste avant le nerf. Opération ponctuelle à la fin de supabase/classements.sql, protégée par la table `ops_done` (jouée une seule fois même si le fichier est réappliqué) : pour les comptes de la semaine en cours, `jobs_base` = XP totale actuelle de chaque métier et le 4e nombre de `jobs` (gain de la semaine) = 0. Niveaux, XP totale et semaine passée inchangés. Testé sur une base PostgreSQL locale. Côté jeu : `ui.outdated` (js/ui.js, `checkNewVersion`, toutes les 5 min) remplace « Fabriquer » par « Recharger pour fabriquer » quand une version plus récente est en ligne, même après « Plus tard », pour qu'un onglet resté ouvert ne garde pas l'ancienne XP des recettes.

## 1.0.12 « Nouveau serveur »
Demande de Mathis (« J'en ai marre de supabase »), choix 1B (Supabase auto-hébergé sur un VPS OVH), VPS-3, bascule le 14/10 à 10h. Le serveur en ligne passe de l'offre gratuite de Supabase à https://159-173-129-109.sslip.io (installé par le workflow « Serveur OVH », `tools/serveur/`). `SERVERS.public` (js/online.js) prend la nouvelle adresse et la clé anon publique. L'ancien serveur signait les connexions avec une clé qu'on ne peut pas exporter : chaque joueur se reconnecte une fois avec Discord (mêmes comptes, copiés). `ON.moved` (session de l'ancien serveur encore dans le localStorage) affiche un message à l'écran de choix. `slotPlan` (js/ui.js) : si la partie en ligne est plus ancienne que le dernier envoi connu de l'appareil (`link.base`), la partie d'ici est renvoyée (« own »). Les workflows qui lisaient la base par l'API de Supabase (Serveur en ligne, Rapport du serveur, Suggestions et Boss des mondes sur Discord) passent par SSH : `.github/actions/vps` et `tools/serveur/vps_sql.sh`.

## 1.0.11 « Choisis ta partie »
Demande de Mathis (« un menu de connexion comme à la Melvor Idle pour le choix des parties »), réponses 1A 2A 3A 4A 5A sur la maquette. Au lancement, `menuStart` (js/ui.js) montre trois parties : la 1 garde la clé `dofousxen-save` et la table `saves` (classements, course, Hôtel de vente, guilde, Kolizéum classé, boss des mondes : le serveur les vérifie avec elle), la 2 et la 3 (clés `dofousxen-save-2` et `-3`) se jouent en solo : `ON.solo()` (js/online.js) bloque les envois qui touchent à l'économie ou aux classements. Chaque carte montre la partie de l'appareil et, avec un compte, sa version en ligne ; quand les deux ont avancé, les deux sont proposées (même logique que l'ancien `onAfterLogin`). Case « Ouvrir directement ma dernière partie » (`idlus-parties` dans le localStorage). Sans serveur, les parties de l'appareil restent jouables. Les parties 2 et 3 en ligne attendent l'accord écrit de Mathis : `tools/emplacements.sql` (nouvelle table `save_slots`) à passer dans supabase/ et `slots: true` dans js/online.js.

## 1.0.10.6 « Jouer pendant une panne »
Pendant la panne Supabase du 13/10, un compte dont le jeton devait être renouvelé (plus d'une heure) tombait sur l'écran de connexion après F5 : `getSession` échouait, `ON.user` restait vide et le lien avait `skip: false`. `ON.ready` (js/online.js) pose `ON.stuck` quand la session est encore dans le localStorage ; `onBoot` (js/ui.js) lance alors la partie de l'appareil, état « hors ligne », avec un message. Une vraie déconnexion efface la session : l'écran de connexion reste affiché dans ce cas.

## 1.0.10.5 « Bouton du chat plus clair »
Demande de Mathis : pendant la panne du serveur, « Réessayer maintenant » semblait ne rien faire (chaque essai attend jusqu'à 12 s, les clics pendant l'attente étaient ignorés). `refresh` (js/chat.js) redessine le chat au début de l'essai et la ligne affiche « Nouvel essai en cours… » tant que `busy`.

## 1.0.10.4 « Songe pour tous »
Le dernier résultat d'une ancienne Expédition (`S.expLast` sans `ii`) faisait planter la page du Songe (`intName(undefined)` dans `puitsHtml`) : il est oublié au chargement (`E.sgConvert`, appelé à chaque chargement) et la page ignore un résultat sans intensité. Test 10 de `tests/songe.test.js`.

## 1.0.10.3 « Bugs corrigés »
Demande de Mathis : points 1 à 13 et 24 de l'état des lieux du 13/10 (/mnt/project-files/audit-bugs/). Renaissance : la Statue utilise `data-act="renaitre"` (le `case "rengo"` du renommage passait avant). Galets : `E.newState` pose `galRef` et la reprise de `E.deserialize` (js/koli.js) ne vise que les sauvegardes sans `galRef` dans le texte d'origine et créées avant la 1.0.6 (`created` < 13/10 16 h 45 UTC). `equipBlocked` (js/ui.js) écarte du plan d'équipement et de « Meilleur choix » un 2e légendaire ou un 2e exo PA/PM/PO. Kolizéum : `Q.picked` (choix du joueur) ; sans lui, l'équipe d'arène se complète à `K.size`. Zoom du texte : `--vz` posé par `applyDisplay`, hauteurs en vh des fenêtres, du chat et de la recherche divisées par le zoom. Challenges sur leur ligne (`.cstrip`), `stickyCheck` à chaque mise à jour du combat, taux `E.resRate` sur la fiche de zone, `scrollTo` à l'entrée en donjon, butin du 1er combat, carte du Songe (`SGUI.ui.mapT`), tuile Défi du jour (`near`), `IDEES.render` relit le formulaire.

## 1.0.10.2 « Sauvegarde sans fausse alerte »
Faux conflits de sauvegarde (« Deux versions de ta partie ») signalés par Mathis : quand le serveur était lent, `push_save` pouvait être enregistré sans que la réponse revienne (délai de 20 s), l'appareil gardait l'ancienne date (`base`) et l'envoi suivant était refusé. Chaque envoi porte un numéro `meta.pid` (et `meta.sa` = savedAt), les 10 derniers sont gardés dans le lien de l'appareil ; `ON.ownPush(info)` reconnaît la version en ligne comme notre propre envoi : nouvel essai avec la bonne date (`ON.push`), pas de question au lancement (`onAfterLogin`) ni en jeu (`onConflictLive`). Aucun changement côté serveur. L'écran de conflit compare l'avancement (`saveAdv` : niveaux cumulés, succès, album, héros) avant la date. Chat sans direct : `catchUp` (js/chat.js) ne lit que le salon affiché, chat ouvert et onglet visible, au plus une fois par minute, jusqu'à 5 min si ça échoue ; nouvel essai du premier chargement 10 s → 2 min.

## 1.0.10.1 « Chat malgré la panne »
Incident Supabase Realtime (présence instable, connexions qui n'aboutissent pas). Message « Chat momentanément indisponible, reconnexion automatique… » au bout de 6 s ; `ON.chatLost()` (js/online.js) vrai tant que le canal n'est pas revenu à SUBSCRIBED : messages rechargés toutes les 30 s (onglet visible) avec une ligne d'explication. L'envoi passe par `chat_send` (RPC), indépendant du temps réel.

## 1.0.10 « Dofus dès la stasis 1 »
Demande de Mathis (réponses 1B 2 3B 4A 5 6A sur la maquette, équilibrage simulé). js/archis.js : `E.DOFUS_ODDS` (1 chance sur … par héros, stasis 1 à 10 : 160 000, 80 000, 40 000, 20 000, 8 000, 7 200, 6 400, 5 600, 4 800, 4 000), `E.OCRE_ODDS` (×5, boss de niveau 200), `E.ocreMult(lvl)` = niveau/200, `E.ocreOdds(k, lvl)`. `E.dofusDrop` tire une fois par héros de l'équipe (`E.team`), sans aucun multiplicateur (choix de Mathis : aucun bonus ne touche les Dofus). `E.dofusDropInfo(id).lad` = les 10 chances, affichées par `dofLadder` (fenêtre du donjon `dgDofusBox`, fiche `dofusDropHtml`). Simulation (clefs chassées + donjon, 13 à 25 victoires de boss par heure) : en stasis 5, ≈ 74 h pour un Dofus à 8 héros, 150 h à 4, 590 h en solo ; en stasis 1, ≈ 1 000 h à 8 héros. L'ancien `E.DOFUS_DROP` (1/1 000 par victoire dès la stasis 5) et `E.OCRE_DROP` (1/5 000 dès la stasis 8 sur les boss 160+) sont retirés.

## 1.0.9.2 « Recettes trop faciles »
Demande de Mathis : nerfer les recettes bas niveau des métiers d'artisanat (choix 1B jusqu'à 1 XP, 2A, 3A). Simulation : l'XP d'une recette (12 + 3 × niveau) ne dépendait pas du niveau du métier, donc fabriquer en boucle une recette facile à 2-3 ressources (Casque niv. 20, Bottes de Chance niv. 7) montait un métier de 1 à 200 avec 4 à 27 fois moins de ressources qu'à son niveau. `E.craftXpMult` / `E.craftXpOf` (js/engine.js) : écart = min(niveau du métier, `E.craftTop(job)`) − niveau requis de la recette ; XP pleine jusqu'à 10 niveaux de métier d'écart (`E.CRAFT_FALL`), baisse linéaire jusqu'à 1 XP à 30. Clés et alliages compris. Affichage dans la liste et la fiche des recettes. Test : tests/artisanat.test.js.

## 1.0.9.1 « Chat qui se reconnecte »
Capture de Mathis : chat bloqué sur « Connexion au chat… » alors que « 15 en ligne » s'affichait. Le premier chargement des messages (`ON.chatLoad`, délai de 12 s) avait échoué pendant un pic de lenteur du serveur et `C.loaded` restait faux pour toujours (aucun nouvel essai). `refresh()` dans js/chat.js réessaie maintenant seul (5, 10, 20 puis 30 s), avec un bouton « Réessayer maintenant » ; une erreur du serveur compte comme « pas chargé » ; `ON.chatLive` reçoit un 3e rappel appelé quand le canal temps réel revient après une coupure (messages manqués rechargés, étalé sur 5 s).

## 1.0.9 « Métiers de la semaine »
Demande de Mathis (réponses 1A à 6A sur la maquette des améliorations du classement des métiers). La sauvegarde envoyée en ligne (meta, `VF.summary` dans js/verify.js) porte maintenant les métiers d'artisanat, de récolte et de forgemagie appris, avec l'XP totale depuis le niveau 1 : aucun envoi en plus. Le déclencheur `ladder_from_save` (supabase/classements.sql) garde l'XP totale de chaque métier au début de la semaine (`jobs_base`, semaine `jobs_w`, celle des donjons de la semaine) et la semaine passée (`jobs_prev`, `jobs_pw`) ; vues `lb_jobs` (+ `total`), `lb_jobs_week` (XP gagnée, place `r`), et `lb_jobs_guild` / `lb_jobs_guild_week` (supabase/guildes.sql). Sommes par groupe : `tous`, `tous_recolte`, `tous_fm`. Titre « Artisan de la semaine » (podium d'un métier la semaine passée, vérifié au lancement comme « Maître de la semaine »), « Grand Maître artisan » (Premiers, kind `job200all`). Un Premier au niveau 200 n'est gravé que si le serveur a vu le métier sous le niveau 200 (artisanat seulement). La vérification de vitesse (+60 niveaux en moins de 10 min) ne regarde que l'artisanat.

## 1.0.8.8 « Objets regroupés »
Demande de Mathis : les objets identiques sont regroupés sur une ligne (×N). `grpItems(L, byTpl, solo)` dans js/ui.js : même modèle et mêmes jets = même `itemKey` ; cadenas, tenue, exo, légendaire et Rayonnant restent à part (`itemSolo`). Choix d'équipement : une ligne par modèle, le meilleur exemplaire en tête, « N jets différents » déplie les variantes (`ui.pgrp`, gardé au redessin). Fiche d'objet du sac, Forgemagie, Brisage (la case coche tout le groupe, `data-uids`) et « Ton sac » de l'HdV regroupent les exemplaires identiques.

## 1.0.8.7 « Donjons par zone »
La liste des donjons est rangée par zone (groupes repliables), avec une barre de recherche (donjon, boss ou zone) et des filtres : niveau, accessibles ou fermés, stasis atteinte, clé en stock, Dofus à gagner, favoris. Filtres et groupes ouverts sont gardés.

## 1.0.8.6 « Coups de récolte longs »
Demande de Mathis (30 s partout, 2A 3A 4A 5A 6A) : un coup de récolte dure `E.HIT_S` (30 s à tous les niveaux) et vaut `E.hitScale` récoltes de l'ancien rythme (`E.basePeriod`), donc même production et même XP par heure qu'en 1.0.7.9. Trouvailles, filons et protecteur gardent leur fréquence par heure (`E.protSpawn(S, c, W, k)`). `E.gatherPartial` paie la part du coup quand le héros est rappelé. L'évènement `harvest` compte les ressources. Affichage : temps restant et « +N à la fin du coup ». Tests dans tests/recolte.test.js.

## 1.0.8.5 « Équipements sur téléphone »
Encyclopédie › Équipements sur téléphone : filtres de niveau qui passent à la ligne, compteurs du haut deux par deux.

## 1.0.8.4 « Recherche revérifiée »
Demande de Mathis : vérifier tous les bugs possibles de la recherche rapide. Chaque entrée de l'index (≈ 8 000) a été ouverte une à une : 318 monstres menaient « nulle part » (archimonstres, co-boss `coBoss` de donjon, boss des mondes). `monHome`/`dgHasMon` (js/ui.js) servent maintenant à `subOfMon` et à `encWhereHtml` ; un monstre connu ouvre `encMonSheet`. Pages Kolizéum, Boss des mondes, Métiers, Suggestions (+ Hôtel de vente et Guilde en ligne) ajoutées à `E.SEARCH_PAGES` (js/welcome.js). Historique dédoublonné par `E.searchNorm` + bouton Effacer, ↑ ↓ Entrée sur les dernières recherches, surlignage de tous les mots, hauteur réglée sur `visualViewport` (clavier du téléphone), z-index au-dessus de #cele. Contrôles ajoutés dans tests/smoke.test.js.

## 1.0.8.3 « Équipements de l'Encyclopédie »
Onglet Équipements (`encEqHtml`, filtres niveau / origine / obtenus, panoplie, fiche objet), collection des équipements déjà obtenus (`E.itemDex`, `S.itemDex`, comptée au premier passage depuis le sac, le surplus et la garde-robe), « Équipements qu'il lâche » sur la fiche du monstre, tuile « Équipements obtenus ». Test `tests/encyclopedie.test.js`.

## 1.0.8.2 « Panel de test sur le jeu public »
Demande de Mathis (13/10/2026 : « je veux avoir un panel de test utilisable sur le public. Uniquement pour moi »). Panel admin (js/chat.js) : « Panel de test » (rôle admin vérifié par le serveur) envoie la vraie partie en ligne puis pose `idlus-partie-test` ; js/online.js passe alors en monde « beta » (aucun serveur) et js/ui.js en mode test (`TESTMODE` : même sauvegarde que la bêta, pastille « Partie de test » avec « Revenir à ma partie »). js/admin.js (copie du panel de la bêta) est chargé sur le jeu public mais ne s'active que si `DX.testerOk` existe.

## 1.0.8.1 « Quantité au choix »
Artisanat : champ `#recqtyn` avec − / + (`recqtyd`) à côté de 1/10/Max, borné à 1…Max fabricable (Galet compris, 1 000 au plus comme `E.craftMany`). Valeur gardée dans `ui.recQty`, mise à jour en place à la frappe (`recQtyLive`), lue directement par « Fabriquer » (`recQtyOf`).

## 1.0.8 « Classement des métiers »
Demande de Mathis (réponses 1A à 7A sur la maquette). `VF.summary` (js/verify.js) ajoute `jobs` (niveau et XP des métiers d'artisanat) au résumé déjà envoyé avec la sauvegarde : aucun envoi en plus. `ladder_from_save` (supabase/classements.sql) ne garde que les 7 métiers connus (niveau 1 à 200) dans `ladder.jobs`, plus `tous` = somme des niveaux ; vue `lb_jobs` (une ligne par compte et par métier). Contrôle : un métier qui gagne plus de 60 niveaux entre deux envois à moins de 10 minutes d'écart met le compte en vérification (pas au premier envoi des métiers). Premier compte au niveau 200 d'un métier : `firsts` kind `job200`, annonce Hauts faits par `firsts_ann`, titre `E.jobFirstTitle` donné par `jobFirstCheck` (js/ui.js, une seule requête par métier, mémorisée dans `S.unlocks.jobFirst`). Onglet `job` des Classements (`jobLbHead`, `jobLbFetch`, `LB.job`), bouton `lb-jobgo` dans Métiers › Artisanat, métiers dans la fiche d'un joueur. Test dans tests/online.test.js.

## 1.0.7.12 « Encyclopédie pratique »
Fiche du monstre (`encMonSheet`), butins cliquables (`reswhere`), bouton ⚔ de chasse à côté des lieux ouverts (caché en donjon), retour « ← Encyclopédie » après « Y aller » (`ui.zoneFromEnc`, position gardée), familles dépliables (`ui.encFamOpen`), filtre « À ma portée ».

## 1.0.7.11 « Dernières recherches »
Bug signalé par Mathis : dans la recherche rapide, cliquer une ligne des « Dernières recherches » ne faisait rien. `searchOpen` (js/ui.js) se contentait de remettre le focus quand la fenêtre était déjà ouverte ; il remplit maintenant le champ et relance la recherche. Flèches, Entrée, → (aller chez le monstre), Échap et clic sur un résultat revérifiés sur PC et téléphone ; contrôle ajouté dans tests/smoke.test.js.

## 1.0.7.10 « Montée réglée »
`E.XP_SHARE` (js/engine.js) : part d'XP par héros selon la taille de l'équipe [—, 0,569, 0,477, 0,43, 0,396, 0,37, 0,347, 0,33, 0,315], réglée par simulation pour une montée 1 → 200 en 240 h solo, 150 h à 4, 120 h à 8 (bon équipement, sans bonus). Avant (1.0.6.1) : 0,8 × n^-0,1 (183 / 91 / 61 h). Vérification zone par zone : `E.ZONE_REW` multiplie l'XP et les kamas de 44 sous-zones de chasse (hors donjons et expéditions ; butin inchangé), et des `E.HUNT_EASE` en plus adoucissent les zones où une équipe de 4 perdait plus de 8 % des combats. Tableau : /mnt/project-files/equilibrage/zones-apres-reglage.md.

## 1.0.7.9 « Récolte rééquilibrée »
Demande de Mathis (choix 1C 2B 3A 4A) : `E.gatherYield(lvl)` (js/engine.js) garde 35 % des ressources au niveau 1 et 10 % au niveau 200 (`E.YIELD`), arrondi aléatoire ; l'XP de métier par coup est multipliée par le même rendement. Filons, trouvailles, protecteur et Almanax inchangés. Simulation : un récolteur niveau 200 tout équipé passe d'environ 27 000 à 2 700 ressources par heure. Tests dans tests/recolte.test.js.

## 1.0.7.8 « Récolte silencieuse »
Demande de Mathis : plus de toasts pour la récolte. Dans `gatherTick` (js/engine.js), filon, trouvaille et niveau de métier de récolte passent en `note(..., "info")` (journal seulement) ; le protecteur garde son avertissement.

## 1.0.7.7 « Chasses au trésor réparées »
Indice de donjon de la chasse légendaire : la clé est fournie tant que l'indice n'est pas résolu (`dgKey`, js/suivi.js). Hors ligne, `E.catchUp` suit les indices (trajet dans `r.tresor`). Chasse lancée en donjon : `move` reste vrai. Consigne « Retour à ta zone » ignorée pendant un trésor. Bandeau du Monde et limite du Comptoir des temples corrigés. Tests dans tests/suivi.test.js.

## 1.0.7.6 « Métiers revérifiés »
Revue des panneaux Métiers et Forgemagie (PC 1280 px et téléphone 390 px, partie avec métiers montés) : `keepList()` garde le défilement des listes `.plist` au redessin, `ui.recStick` garde la recette fabriquée affichée, `ui.toolOpen` garde le menu d'outil ouvert (événement `toggle`), barre de brisage collée en haut au téléphone (`--sth`), `brLock()` (cadenas/tenue) et confirmation pour un Rayonnant au brisage, coefficient de brisage dans la ligne de l'objet, retour à la liste de l'Établi à la même position, malus de forgemagie au-dessus de ses runes.

## 1.0.7.5 « Y aller depuis l'Encyclopédie »
Fiche de monstre de l'Encyclopédie : un bouton par sous-zone ou donjon où il vit, verrou affiché pour les lieux fermés.

## 1.0.7.4 « Kolizéum sans freeze »
Plaintes de freeze après la 1.0.7 : le calcul du « Conseillé » (20 combats d'essai par adversaire, 130 à 380 ms d'un bloc) passe par `E.koliChanceAsync`, qui rend la main au navigateur toutes les ~10 ms (même résultat). Mode auto en ligne : un combat toutes les `KOLI.autoGapOn` = 8 s et un seul envoi de la partie par série (avant : à chaque combat, toutes les 3 s), pour soulager le serveur (charge 2,6 sur 2 processeurs à 20 h 48). Pastille « Koli auto » sur une ligne comme les autres pastilles du haut.

## 1.0.7.3 « Panel de test depuis le jeu »
Panel admin du jeu public (js/chat.js) : bouton « Panel de test » pour le compte admin, qui ouvre beta/?panel=1 dans un nouvel onglet ; la bêta (beta/js/ui.js) lance alors directement la partie de test et ouvre le panel si le rôle admin est confirmé.

## 1.0.7.2 « Vœux de la Fontaine »
Fontaine onirique du Songe : un vœu acheté (`o.sold`, déjà sauvegardé) s'affiche en vert avec « ✓ Obtenu » (`.sg-of.sold`, `.sg-got`), compteur « N vœux pris » en haut de la fiche, petit éclat sur la carte achetée et message de confirmation ; cartes rangées en grille sur téléphone. Test 9 de `tests/songe.test.js`.

## 1.0.7.1 « Chemins des menus »
Les étapes de la quête principale donnent le bon chemin du menu (le Havre-Sac est dans Artisanat › Havre-Sac) et ont un bouton « Y aller » ; tous les chemins de menu des textes suivent les 5 groupes, vérifiés par un test.

## 1.0.7 « Kolizéum automatique »
Mode auto dans `js/koliui.js` (objet `AU`, boucle `aLoop` toutes les secondes, un combat toutes les 3 s via `aStep`) : adversaire au meilleur gain attendu (`aPick`, 20 combats d'essai), hors ligne `E.koliFight(S, i, true)`, en ligne `ON().koli` puis `E.koliOnline(S, R, true)` ; Kolizetons ×`K.autoKz` (0,75, fractions dans `Q.kzf`) ; arrêt après `K.autoStreak` défaites, au nombre choisi ou sans ticket ; réglages sauvés dans `S.koli.auto` ({ cnt, hunt }), interrupteur « Tickets de chasse » qui garde `K.autoReserve` tickets ; pastille `window.KZAUTO.chip()` dans `protChip`. Tickets de Koli en combat : `E.tkLoot` dans `giveRewards` (`E.TK_LOOT` : 0,25 % par héros, 10 % boss, archimonstre sûr, 40 par jour via `S.tkFound`), bonus de butin à moitié (`E.tkMult`).

## 1.0.6.3 « Codes cadeaux récupérés »
Les récompenses d'un code cadeau accepté mais perdu en route (code MERCI) sont redonnées toutes seules au chargement (`gift_mine` dans supabase/codes.sql).

## 1.0.6.2 « Où trouver les Dofus »
Chaque Dofus dit clairement comment et où l'obtenir (Mathis, 13/10/2026 : « Mieux savoir comment et où drop les Dofus »). Taux inchangés. js/archis.js : `E.dofusDropInfo(id)` (donjon, boss, chance, stasis minimale ; Ocre = boss niv. 160+, stasis 8), `E.ocreDungeons()`. js/ui.js : `dofusDropHtml`, `dofusQuestLineHtml`, `dofusStepGo` (bouton « Y aller » de l'étape en cours), `dgDofusBox` (fiche du donjon), icône du Dofus sur les cartes de donjon, actions `dofgo` / `dofalm`. js/questui.js : fiche en « ① Sa quête » / « ② Le butin du boss », `QUI.pick(id)` (recherche). Test : tests/quetes.test.js vérifie que chaque Dofus a des sources atteignables.

## 1.0.6.1 « Force du nombre »
Part d'XP par héros : `E.xpShare(n)` = 0,8 × n^-0,1 dans `giveRewards` (avant 2/(n+1) × Esprit Libre). `E.freeSpirit` renvoie 0 (Esprit Libre supprimé : XP, butin, PV, dégâts) ; `E.HUNT_SMALL` (chasse) et `E.SMALL_TEAM` (donjon) relevés et étendus à 4 héros pour garder les petites équipes équipées hors de danger. Jauge `fsGauge` = taille de l'équipe + Synergie. Simulation 1 → 200 (bon équipement, sans bonus) : solo 179 h, 2 héros 140 h, 4 héros 89 h, 8 héros 61 h ; stasis des donjons inchangées (`npm run sim`).

## 1.0.6 « Galets en bonus »
Galets du Kolizéum en bonus facultatif de fabrication (Mathis, 13/10/2026 : 1A 2A 3A puis 4A à 11A, bonus rééquilibrés sur sa demande). js/koli.js : `E.KOLI_GALETS` (lo/hi = niveaux des objets, `roll` = options de `E.rollItem` : `one`, `best2`, `floor`, `rad` ; `double` = chance d'un 2e objet), `E.galetsFor(tpl)`, `E.galetFx`, `E.koliGaletRefund` (Galets des sacs repris une fois au prix en Kolizetons, branché sur `E.deserialize`, drapeau `S.galRef`). js/engine.js : `E.craftItem(S, tpl, galet)` / `E.craftMany(..., galet)`. js/ui.js : encadré « Bonus facultatif » dans la fiche de recette (`galetBox`, `ui.recGalet`). Gains moyens simulés : +2 à +5 % de caractéristiques. Recettes toujours sans Galet obligatoire (`E.KOLI_GALET_RECIPES = false`).

## 1.0.5.3 « Accès au panel de test »
Version de test : le panel de test se rouvre pour le compte admin (rôle vérifié auprès du serveur avec la connexion du jeu public), et un lien « Accès testeur » passe par le jeu public pour reconnaître le compte puis revient sur la bêta.

## 1.0.5.2 « Codes cadeaux : choix qui restent ouverts »
Retour de Mathis (13/10/2026 : « les choix se referment souvent »). js/codes.js : la `<datalist>` du navigateur (refermée dès que la mise en page bougeait) est remplacée par une liste maison `.gc-sug` (recherche sans accents, débuts de nom d'abord, 40 résultats, flèches/Entrée/Échap, `mousedown` bloqué pour garder le focus, puis focus sur la quantité). Les actions du formulaire redessinent via `CHAT.repaintAdmin()` sans recharger le serveur. js/chat.js : `keepFocus()` remet le focus et le curseur sur le champ actif après chaque redessin du panel. css/style.css : `.gc-form` en conteneur, lignes repliées sous 440 px.

## 1.0.5.1 « Monstres oubliés et Vulkania »
Suite du répertoire du contenu (Mathis, 13/10/2026 : « 1A 2A 6A »). tools/build_data.py : zone `vulkania` (8 sous-zones DofusDB 763-770, `requires` Bouftou Royal), sous-zones `ama_cryptes_entree` (7), `can_rives_lac` (56), `oto_tourbiere_fond` (457) ; `EXTRA_SUB` force dans une sous-zone un monstre hors fenêtre de niveau (Trooll Apprivoisé, Vampire Dupyr, Coffre Sombre, Wabbit GM, Dopeul Dark Vlad, Méga Craqueleur des plaines, Gardienne des Égouts, Sousouris Grise) ; `DROP_FIX` donne 1 % aux objets du Chef Bwork dont DofusDB met le taux à 0 (sur les 4 Bworks des Pics de Cania). Fusion additive dans js/gamedata.js (clés nouvelles seulement). js/archis.js : Vulkania dans le palier 3 de l'Ocre (304 archimonstres, 15 zones ; tests/fight.test.js). `E.HUNT_EASE` réglé par simulation (`vul_nehr` 0,9, le reste au niveau des zones voisines). js/armes.js et js/koli.js regénérés (+5 armes).

## 1.0.5 « Course en direct »
Course de lancement en direct. js/verify.js : le résumé envoyé avec la partie contient `qstep` (étape de la quête principale). supabase/classements.sql : colonnes `ladder.qstep` / `qstep_at` (heure où l'étape a augmenté), vue `lb_race` (comptes non signalés, qstep > 0). js/ui.js : onglet `race` de Classements (`raceFetch`, `raceHtml` : 10 places venant de `firsts` kind race10, joueurs en course triés par qstep puis qstep_at), pastille `raceChip` (tchip `k-race`, rafraîchie toutes les 5 min par `raceInfoFetch`, `DX.raceRefresh`), action `race-open`. js/chat.js : annonce race10 = carte dorée dans le Général (plus dans Hauts faits) + notification pour tous.

## 1.0.4.7 « Pastilles du haut »
js/ui.js `tchip(o)` (exposé dans `DX.social.tchip`) : une seule forme de pastille pour la ligne `#topchips` (objectifs `objsHtml`, `renderUpdBar`, `protChip`, boss des mondes `paintBar` de js/wbossui.js). Classes `k-quest/pin/done/ev/bonus/boss/prot/sys` (couleur `--tc`), `.tc-s` = texte court montré à la place du titre sur téléphone, `.tc-x` = croix (aussi sur l'annonce admin de js/chat.js). PC : une ligne sans retour (défile si trop long) ; téléphone ≤ 640 px : pastille + chiffre clé.

## 1.0.4.6 « Boss des mondes : les 3 combats comptent »
js/wboss.js : `E.wbSim` renvoie le TOTAL des `E.WB_FIGHTS` combats (avant : la moyenne ; `raw` reste la moyenne pour tools/wboss_calib.js), `fights[].seed` ; grille `E.WB_GRADES` ×3 (150/300/600/1050/1500), même chose dans `wb_grade` (supabase/wboss.sql). Remise à l'échelle unique `wb_resets` '1.0.4.6' : points des essais du boss en cours (wb_hits et wb_hits_old), PV et dégâts ×3. PV minimum du boss suivant 1 800 points. js/wbossui.js : pendant « Revoir le combat », le compteur = autres combats + combat regardé, × `E.wbMult` (il l'oubliait) ; `LOCAL_HP` 900.

## 1.0.4.5 « Sorts sans dézoomer »
Sorts & stratégies (js/ui.js `charSpellsView`, css/style.css) : grille « bar det / grim det / prev det » (Grimoire sous la barre, aperçu en dessous) ; rappel `.spmini` « Ta barre » collé en haut du Grimoire (cases cliquables `spsel` et cibles de dépôt `data-spslot`, hauteur des onglets du héros mesurée dans `--spmt`) ; défilement auto pendant un glisser ; « Comment ton héros choisit ses sorts » replié par défaut (`ui.spHowOpen`). Avant, à 100 % de zoom, le Grimoire était ~1 150 px sous la barre : impossible de glisser un sort sans dézoomer.

## 1.0.4.4 « Fabriquer sac plein »
Artisanat (js/engine.js) : `E.craftRoom` = place du sac + place du trop-plein ; `craftItem` range l'objet fabriqué dans `S.over` si le sac est plein (avant : `craftCount` tombait à 0 et le bouton restait grisé sans raison). `craftMany` renvoie `over`. Recette : étiquette « sac plein » et message si sac et trop-plein sont pleins. Test : tests/artisanat.test.js.

## 1.0.4.3 « Galets retirés »
Galets du Kolizéum retirés pour l'instant (Mathis, 13/10/2026) : `E.KOLI_GALETS_ON = false` dans js/koli.js coupe l'ajout des Galets aux recettes (`E.KOLI_GALET_RECIPES`) et leur rayon dans la boutique (onglet caché par js/koliui.js). Les Galets restent des ressources (`D.RES`) : ceux déjà possédés restent dans le sac, revendables à l'HdV. Remettre le drapeau à `true` les fait revenir.

## 1.0.4.2 « Gelées à parts égales »
Boss jumeaux (js/engine.js, `dg.coBossEq` posé dans js/data.js pour gelaxieme_dimension et clos_blops) : les PV totaux du boss et de ses `coBoss` sont partagés à parts égales, × `E.COBOSS_EQ` (0,75, réglé par simulation : bon équipement stasis 5, optimisé 9, comme avant).

## 1.0.4.1 « Chat et écrans pliables »
Chat entre 641 et 859 px (menu en bas, ex. Fold déplié) : `.chmin` en bulle ronde au-dessus de la barre de menu (règles passées de `max-width:640px` à `859px`), `#chat` ouvert posé au-dessus de la barre. Options › Affichage › « Format d'affichage » (`S.settings.layout` : `phone`/`pc`, action `setlayout`) : `applyDisplay` réécrit la balise viewport (`width=480` ou `width=1180`) ; sans effet dans un navigateur d'ordinateur.

## 1.0.4 « Statistiques de combat »
Par héros et par combat : dégâts infligés (invocations et poisons compris, via `F.dotSrc`), soins donnés (`F.actor`), dégâts subis, ennemis achevés (`F.lastBy`). `E.fightStats(F)` dans js/engine.js, gardé dans `S.history[].s` et cumulé dans `S.fstat` (`E.addFightStats`, `E.resetFightStats`). Interface js/ui.js : `fstTable`, `fstPanel` (panneau « Statistiques » de l'écran de combat, onglet Stats au téléphone), `fstSheet` (clic sur « Derniers combats » ou « Stats » à l'accueil).

## 1.0.3.3 « Copier-coller dans le chat »
Chat (js/chat.js `paint`) : la zone d'écriture `.ch-foot` n'est plus recréée quand son contenu ne change pas (signature `footHtml("")` sans le compteur), seul le reste du chat est redessiné : le clavier du téléphone et la bulle « Coller » restent ouverts quand un message arrive. Un texte surligné dans le chat retient le redessin (`C.held`, relancé par `selectionchange`). Menu du pseudo : « Copier le message » (`ch-copy`, presse-papiers avec repli `execCommand`), icône `copy` dans `GL`. `.msg .tx` sélectionnable explicitement. Test dans tests/online.test.js.

## 1.0.3.2 « Petits bugs corrigés »
Rangée des pages de Quêtes au téléphone en grille (2 ou 3 colonnes, `.qj-chips` dans css/quetes.css) au lieu d'un défilement horizontal coupé ; la page Quêtes se redessinant toutes les 3 s, elle garde maintenant le défilement des rangées horizontales (chapitres) ; tranches de niveaux du Monde compactes au téléphone.

## 1.0.3.1 « Baguette Rikiki »
La Planque des Vilinsekts (`ast_planque`) demandait la Baguette Rikiki du Bricoleur (ressource `S.res`), mais l'arme Baguette Rikiki (`i15990`, Sculpteur, ajoutée avec les armes) ne l'ouvrait pas : `E.subUnlocked` accepte maintenant l'arme dans le sac ou équipée et garde l'accès dans `S.progress.hiddenOpen`.

## 1.0.3 « Butin par héros »
Un tirage de ressource par héros sur chaque monstre, chance partagée (Mathis, 13/10/2026, carte « Chance partagée ») : `E.lootRolls` dans js/engine.js, chance par tirage = min(100 %, chance × bonus / nombre de héros). Simulation (bonus ×2 + Double gain) : 3,5 → 6,7 ressources par monstre à 4 héros, 3,2 → 4,8 à 8, inchangé en solo et sans bonus.

## 1.0.2 « Encadré de chasse »
Accueil (js/ui.js `renderHomeInner`) : en chasse, carte `.ac-hunt` avec la zone en titre, tuiles `.ac-kt` (XP/h, kamas/h, ressources/h, victoires via `E.zoneRate`), ligne `.ac-lf` du dernier combat (`S.history[0]`), barre d'XP `.ac-x` sous chaque tête, boutons-icônes `.ac-ib` au téléphone (CSS en fin de style.css).

## 1.0.1 « Défis à toutes les tailles »
Dopeuls (js/vie.js), Protecteurs (js/systems.js `E.protGroup`) et gardiens du trésor (js/suivi.js) : force × `E.foeSize(n, niveau)` = `E.FOE_SIZE` par taille d'équipe (solo plus fort, duo et trio plus doux, compense `E.HUNT_SMALL`) × `E.FOE_LVL` par niveau (adouci vers 40 et 200 ; `E.FOE_LVL_SOLO` pour un héros seul). Réglé par simulation : bien équipé 80-100 % de victoires à toutes les tailles, sans équipement le plus souvent battu.

## 1.0 « Idlus 1.0 »
Sortie officielle (Mathis, 13/10/2026 : « 1B 2A 4A 5A et un cosmétique unique 6A 7A 8A »). Dofus : 13 nouveaux dans la liste `L` de js/archis.js (31 en tout), icônes DofusDB dans assets/i ; le Jyfus a l'étape `gift` (pas de butin, pas de quête : donné par `E.grantFounder`). Succès `dofus31`. Cadeau de lancement : `E.grantFounder` (systems.js) jusqu'à `E.LAUNCH_END` (20/10 23 h 59 Paris) : titre « Fondateur d'Idlus », ornement `fondateur`, Jyfus, Coffre des Douze ; écran `launchSheet()` (ui.js, classes `.launch10`). Course de lancement : `meta.mainq` (verify.js) ; `ladder_from_save` (supabase/classements.sql) grave les 10 premiers dans `firsts` (kind `race10`, key = rang) à partir du 13/10 16 h ; `raceCheck()` (ui.js) donne le titre « Légende de la 1.0 » et l'ornement unique `legende` (`E.grantLegend`). Ornements SVG : assets/ui/orn/orn_fondateur.svg, orn_legende.svg. Sous-zones : 15 sous-zones ajoutées dans `ZONES` de tools/build_data.py, fusion additive dans js/gamedata.js, `E.HUNT_EASE` réglé par simulation de chasse (`--chasse`) ; les 3 zones de montures sauvages sont écartées (doublon avec le filet de js/mounts.js). Quête principale (js/quetes.js) : l'étape `B("cimetiere_mastodontes", "Le Mantiscore")` du chapitre 1 (Saharach fermée jusqu'au Minotoror) devient `B("antre_reine_nyee", "La Reine Nyée")` ; tests/quetes.test.js vérifie que chaque étape est dans une zone déjà ouverte.

## 0.1.57.2 « Accueil réparé sur téléphone »
chat.js : `#annbar` (annonce admin) est inséré après `#topchips` et non plus dans la ligne de pastilles, où, rétréci par le flex sans retour à la ligne, il devenait très haut et poussait la page hors de l'écran. CSS : tout autre enfant direct de `.topchips` que `#objs` et `#updbar` est caché.

## 0.1.57.1 « Sorts plus clairs »
Aperçu des sorts (`E.spellPreview`, js/engine.js) : le coup d'arme (`"arme"`) compte ses PA via `he.wsp`, chaque tour garde `why` (cuve, ko, stun, gold, over, none, lu dans le journal du combat) et `dmg1` (dégâts du combat affiché). Interface (js/ui.js) : `spPreviewHtml` affiche l'arme et la raison des tours sautés, `spTips` ignore ces tours, barre en deux groupes `spBarGroups` (soutien numéroté / attaques sans ordre), aide `spHowHtml` ; styles `.spgrp`, `.spgl`, `.spwhy`, `.sphow`.

## 0.1.57 « Affichage plus clair »
Ligne de pastilles `#topchips` (index.html) qui contient `#objs` et `#updbar` (et `#wbbar`, créé par wbossui.js) ; `protChip()` (ui.js) y met le protecteur, l'Accueil n'a plus `protBar()` (Métiers le garde). `renderUpdBar()` est appelée à chaque `renderStatus()` et n'écrit que si le HTML change. Barre du haut sans logo ; téléphone : le sablier n'affiche que la vitesse choisie (`sabspd` fait tourner ×1→×2→×3). Notifications : une seule (la dernière), en haut sous la barre, sauf « En bas ». Combat : `combatSetHtml()` / `combatSetSheet()`, bouton « Réglages » sur téléphone. CSS en fin de style.css (bloc 0.1.57).

## 0.1.56 « Boss des mondes rééquilibré »
Boss des mondes (js/wboss.js) : un essai = moyenne de `E.WB_FIGHTS` (3) combats (total depuis 1.0.4.6) (`E.wbFight` = un combat, `E.wbSim` = l'essai, renvoie `fights` et `watchSeed` du combat revu). Points × `E.wbMult(niveau, nb de héros)` (courbe `E.WB_LVLPOW`, équipe de référence 8). Charge du boss ×`E.WB_CHARGE` (1,5). Grades 50/100/200/350/500 points. supabase/wboss.sql : remise à zéro unique (`wb_resets` '0.1.56') qui archive les essais du boss en cours dans `wb_hits_old` (essais du jour rendus) et divise PV et dégâts par 5 ; ceux de `wb_hits_old` comptent pour la récompense de mort.

## 0.1.55.1 « Sac sans l'équipé »
Inventaire › Équipements : les objets portés sont cachés (`invGroups`, `invDetail` dans js/ui.js, via `wornMap`) sauf si la case « Afficher l'équipé » est cochée (`S.settings.invShowEq`, sauvegardée) ; une pastille avec la tête du héros (`.ieq`) marque alors l'objet porté.

## 0.1.55 « Plafonds relevés »
Plafonds des bonus (js/systems.js) : Autel des Douze `E.ALTAR` (`S.havre.autel`, `E.buyAltar`, `E.altarCost`), plafond effectif `E.capOf(S, kind)` = `E.BONUS_CAP` + 5 par niveau d'Autel pour xp/drop/kamas (`E.capMax`). Détail par source `E.bonusParts`, total brut `E.bonusRaw`. Interface : cadre « Mes bonus » `bonusBox`/`bonusCard`/`altarHtml` (js/ui.js), styles `.bonbox`, `.bcard`, `.bbar`, `.altar`.

## 0.1.54 « Commandes du jour »
Commandes du jour (js/systems.js `E.gameBuys`, `E.gameBuyAll`) : 2 000 ressources par tranche de 20 niveaux jusqu'au meilleur héros, payées `E.GBUY.perLvl` × niveau du meilleur héros par unité. Interface : `gameBuysHtml` (js/ui.js). Havre-Sac : boutique de la maison (`FURN[n].shop`, `E.buyFurn`) et agrandissement des pièces (`S.hvGrow`, `E.growRoom`, `E.GROW`).

## 0.1.53.7 « Mentions dans le chat »
Chat (js/chat.js) : mentions `@pseudo` détectées côté client (`mentions()`, `pingsMe()` : 3 premières mentions, joueurs ignorés exclus), surlignées (`.mt`, `.msg.ment`) ; pastille `@` par salon (dernier message lu par salon dans la préférence `ms`) et sur le bouton du chat, toast hors du salon ; suggestions de pseudos en tapant « @ » (`#chAc`, auteurs récents puis joueurs connectés via `ONLINE.onlinePseudos()`), bouton « Le mentionner » dans le menu d'un joueur. Aucun changement serveur.

## 0.1.53.6 « Droit au monstre, en mieux »
Recherche rapide : `.wsrow` surlignée en entier, `.wsmon` en colonne fixe (PC) ou sous le résultat (téléphone), zone + verrou (`monWhere` renvoie `lvl` et `open`) ; flèche droite / Maj+Entrée (`searchMonKey`). Fiches : `monLineHtml()` commun à `resSheet` (avec lignes de récolte) et `itemSheet`.

## 0.1.53.5 « Droit au monstre »
Recherche rapide (js/ui.js) : `dropMons()` / `monWhere()` donnent les monstres qui lâchent une ressource ou un objet et leur zone visible (sinon leur donjon) ; bouton `.wsmon` (act `searchmon`) à côté du résultat, et liste « Monstres qui la lâchent » dans `resSheet`.

## 0.1.53.4 « XP de monture arrondie »
Montures (js/ui.js `mountBar`) : pourcentage d'XP arrondi à l'entier inférieur ; XP restante arrondie au-dessus. Calcul inchangé.

## 0.1.53.3 « Boss qui respirent »
Boss des mondes (js/wbossui.js, css) : portraits animés en CSS (`img.wb-an` + `wb-p1..3` selon la phase) sur la page, la rotation, les cartes du chat en cours, le haut du combat et le bandeau ; coupé par `pref.fx` et `prefers-reduced-motion`.

## 0.1.53.2 « Treizième héros »
`E.HERO_MAX` passe de 12 à 13 (équipe toujours limitée à `E.TEAM_MAX` = 8). Prix du 13e héros : `recruitCost(13)` = 1 752 955 kamas (courbe inchangée).

## 0.1.53.1 « Classement du boss clarifié »
Boss des mondes (js/wbossui.js) : classement avec le total (somme des essais) et le meilleur essai (`best`) sous le nom ; la lettre = grade du meilleur essai, expliqué au-dessus.

## 0.1.53 « Armes »
Mathis : « ajouter un véritable intérêt aux armes » (maquette, réponses 1A 2C 3A 4A 5A), puis « chaque carac son logo, de même pour les ressources » et deux retouches d'ergonomie. `tools/build_armes.js` récupère sur DofusDB les dégâts propres de chaque arme (type, PA, critique, portée, lancers, lignes 91-100 / 2822 / 2828 / 108, PA retirés) et écrit `js/armes.js` (chargé avant data.js, aussi dans `tools/build_server.js`). engine.js : `E.weaponSpellOf` fait de l'arme un sort `id:"arme"` (×`E.WEAPON.mult` 1,5, maîtrise +20 % via `E.CLASS_WEAPONS`), case en plus `E.WSLOT` dans `charTurn`, effets par type `E.WTYPES` (`weaponFx`, `wguard`, perce, grâce, précision), potions `E.weaponPotion` (`it.wel`, `it.welh` moitié) et `E.brewPotion` (Alchimiste 20 / 80, herbes + kamas), arme dans `koliSnap` (`wp`). ui.js : bloc arme de la fiche (`wpBlockHtml`), `wpPickTag` dans le choix de l'arme, case sous la barre de sorts, bloc « Élément de l'arme » à l'Établi (potions possédées, le reste sous `ui.wpPrep`), coup d'arme dans `itemScore`. Icônes : `assets/c` complété (DofusDB `tx_*`), `sIco` couvre toutes les caractéristiques (`SICO_OF` : dommages élémentaires et résistances fixes reprennent l'icône DOFUS), `statIc` et `resTag`. Simulation : bon équipement stasis 6,28 (6,34 avant), sans équipement inchangé, chasses 0-0,9 % de défaites, arme ≈ 15 % des lancers. tests/armes.test.js.
## 0.1.52.1 « Fiches joueurs »
Mathis : un menu du panel admin avec une fiche détaillée de chaque joueur. Serveur : supabase/fiches.sql (lecture seule, réservé à l'admin par `adm_need(true)`) : `adm_roster(recherche, tri)` liste tous les comptes (500 au plus), `adm_player(id)` renvoie le compte (connexion Discord ou e-mail, sans adresse), la partie en ligne complète, le classement, la guilde, le Kolizéum, l'Hôtel de vente, les échanges, les boss, les codes cadeaux, les idées, le chat (nombres seulement, pas de messages privés) et la modération. Jeu : js/fiches.js (onglet « Fiches joueurs » enregistré dans `ATABS` de js/chat.js, bouton « Fiche détaillée » dans l'onglet Joueurs) lit la partie avec `readSave` pour détailler héros, équipement, progression, inventaire, métiers et journal ; bouton « Télécharger sa partie » (fichier JSON). Mise en page par requêtes de conteneur (`.adm .fj`), pour rester lisible avec le chat ouvert.

## 0.1.52 « Songe plus clair »
Écrans du Songe infini repensés (js/songeui.js, classes `.sgx-*` en fin de css/style.css) : en-tête et onglets avec compteurs, Puits en rangée de logos et fiche d'intensité, « Ta prochaine salle » avant la carte (carte horizontale défilante sur téléphone, `.sgx-mapscroll`), barre compacte dans l'onglet Combat (`runHead`), collection de légendaires par niveau, Marché trié avec « il te manque N Bribes ». Emblèmes des 8 intensités en SVG, métal ciselé façon DOFUS 3 (lunes ciselées, `sgIcon(i)` en tête de songeui.js).

## 0.1.50.4 « Kamas de DOFUS 3 »
Mathis : icône des kamas comme celle de DOFUS 3. `assets/ui/kamas.webp` (128 px) redessinée : pièce d'or à 24 facettes et symbole des kamas (K à deux barres) en relief, même méthode que le Kolizeton (script de génération SVG puis rendu Chromium). `MEDIA` passe à `media-v9` dans sw.js pour que l'ancienne image ne reste pas en cache.

## 0.1.50.3 « Boss des mondes corrigé »
`E.chestItemPool` (systems.js) exclut les objets `leg` (Songe) et `wboss`. Gargandyas : `E.WB_HP0` 10 000 points et `wb_state.hp` ramené à 10 000 s'il valait 20 000 (supabase/wboss.sql) ; `wb_done` renvoie `before` (dégâts avant l'essai). js/wbossui.js : bandeau et effet cachés seulement pendant `ui.watch`, tuile d'Accueil redessinée au chargement. tests/wboss.test.js vérifie que index.html charge wboss.js et wbossui.js.

## 0.1.50.2 « Boîte à idées épinglée »
Mathis : message semi-permanent dans le chat pour les idées (maquette avec une capture par option, réponses « 1A 2A 3A 4A 5A 6A »). Serveur : colonnes `pin_body`, `pin_chs`, `pin_at` dans `chat_settings` (supabase/chat.sql), fonction `adm_pin(texte, salons)`. Jeu : `ON.chatPin()`, `pinHtml()` dans js/chat.js (carte `.ch-pin` au-dessus des messages, ampoule `idee.webp` à la place de l'emoji, bouton vers la page Suggestions, croix = caché jusqu'au lendemain ou jusqu'au prochain changement, `pref.pinHide`), rechargé toutes les 2 min. Panel admin, onglet Annonces : encadré « Message épinglé du chat » (texte 200 caractères, salons Général / Commerce / PvP, Retirer).

## 0.1.50.1 « Nouveaux noms »
Mathis : pouvoir changer le nom des héros et son pseudo (maquette, réponses « 1A crayon plus visible, 2B, 3A, 4A »). Héros : `E.renameChar(S, cid, nom)` (premier changement gratuit par héros, `c.renamed`, ensuite `E.RENAME_COST` = 50 000 kamas), filtre `E.nameBad` / `E.nameProblem` (liste `E.BAD_WORDS`, mots de 3 lettres seulement en mot entier) aussi au départ et dans `E.recruit`. Fiche : `renameHtml(c)` (bouton `.hb-ren`, champ `#renName`, Entrée / Échap). Pseudo : `pseudo_change(p_pseudo)` et `pseudo_info()` dans supabase/chat.sql (30 jours entre deux changements via `profiles.pseudo_at`, ancien pseudo gardé dans `pseudo_holds` 30 jours, vérifié aussi par `pseudo_guard`), `ON.changePseudo/pseudoInfo`, `pseudoChangeHtml()` dans Options › Sauvegarde.

## 0.1.50 « Quêtes, succès et chasses »
js/quetes.js (sans DOM) : chapitres 2 à 5 de la quête principale (`E.QUEST_CHAPTERS`, `E.MAIN_CH1` = 22 garde « Héros d'Amakna »), quêtes de région (`E.REGIONS`, `E.rqGive/rqClaim`, état `S.rq`, ornements `reg_<zone>`), quêtes de la semaine (`E.wkState`, `S.wk`), rang de chasseur et avis d'élite (`E.hunterRank`, `E.eliteState`, `S.belite`), ~315 succès (`prog`, `grp`, `secret`, `hint`), points et paliers (`E.achPoints`, `E.ACH_PALIERS`, `S.achPal`, ornements `pal1/pal2`). Avis : 3 monstres + 1 boss (`E.BOSS_SLOTS`) dans systems.js. Trésor en 3 tailles (`E.TRESOR_SIZES`, parchemin `{ l, k }`, `E.tresorLegClaim`) et nouveaux indices dans suivi.js. Interface : js/questui.js, css/quetes.css ; ornements générés par `node tools/gen_ornements.js` (assets/ui/orn). Classement des points : colonne `pts` de `ladder` (supabase/classements.sql).

## 0.1.49.2 « Roue des Options »
Mathis : rendre l'icône des Options plus reconnaissable (maquette à 3 versions, réponses « 1A 2A 3A »). Glyphe `gear` passé de `GL` (trait, qui ressemblait à un soleil) à `GLF` : roue dentée dorée pleine. Bouton de la barre du haut avec le libellé `.optlbl` (caché sous 600 px). `hOpt(s)` = `h(s)` avec la roue devant chaque « Options » : notes de mise à jour, bulles de découverte, Carnet des découvertes.

## 0.1.49 « Boss des mondes »
Boss commun à tout le serveur (comme le World Boss de Summoners War). js/wboss.js : règles et combat (Gargandyas `m8062`, Fragment d'anomalie, 4 objets, `E.WB_*`, `E.wbDef(n)` rotation de 9 boss, `E.wbWatch/wbWatchStep/wbResult/wbSim` avec hasard `E.wbSeed(n, uid, k)`, boutique `E.wbBuy`, bonus d'XP `E.wbXpUntil`). Force calibrée par `node tools/wboss_calib.js` (équipe équipée ≈ 300 points, grade S). js/wbossui.js : page, carte du chat (`WBUI.card`), effet d'arrivée, bandeau `#wbbar`, tuile d'accueil, option. Serveur : supabase/wboss.sql (`wb_state`, `wb_hits`, `wb_kills`, `wb_info()` public, `wb_start`/`wb_done` pour la fonction « record » `{ wboss: 1 }` qui rejoue l'essai) ; récompenses par `hdv_op` (nouveau champ `untitle` dans market.js) ; annonces `chat_msgs` kind `ann`, data `{ t: "wb", ev: "arr" | "ph" | "dead" }`. Version de test sans serveur : boss local de 1 200 points.

## 0.1.48.6 « Double gain prolongé »
Fin de l'événement repoussée au dimanche 18 octobre 23 h (Paris) : `E.EVENT.to` = 2026-10-18T21:00:00Z (engine.js).

## 0.1.48.5 « Sablier en cadeau »
Récompense de code cadeau `s` (heures de sablier, 24 au plus) : `E.sabGift` (engine.js, plafond `E.SAB_GIFT_MAX`), `E.giveGift`/`E.giftText` (systems.js), type « Heures de sablier » dans l'onglet Codes cadeaux (js/codes.js). `E.sab` ne recharge plus au-dessus de `E.SAB_MAX` mais ne coupe pas les heures offertes.

## 0.1.48.4 « Titre du songe »
Combat (renderCombat, ui.js) : le titre d'un combat du Songe infini lit `E.SG_INT[XP.ii].name` (et le règne dès Paradoxe 1) au lieu de l'ancien `XP.floor` de l'Expédition.

## 0.1.48.2 « Salons Commerce et PvP »
Chat : salons `c` (Commerce) et `v` (PvP) dans `chat_msgs.ch`. Serveur (supabase/chat.sql) : `chat_send` prend `p_ch` (l'ancienne version à 3 paramètres est supprimée), Commerce limité à un message toutes les 30 s, salons lisibles par tous ; supabase/koli.sql annonce les grades dans `v`. Jeu (js/chat.js) : `C.c` / `C.v`, pastilles comptées dans le chat réduit, barre `.ch-top` + `.ch-tabs`, ligne `.ch-strip` (événement + Discord).

## 0.1.48.1 « Multi-élément »
`buildEls(c)` (js/ui.js) : éléments joués (répartition auto élémentaire, sinon parts ≥ 20 % de `c.alloc`, sinon élément de la classe) ; `itemScore` pondère stat 0,1 + 1,3 × part et dommages 0,1 + 0,9 × part.

## 0.1.48 « Le Songe infini »
L'Expédition sans fin (js/expedition.js, js/expui.js) est remplacée par le Songe infini : js/songe.js (moteur, garde les noms `E.exp*` appelés par engine.js ; carte seedée `E.sgMap(w)`, 26 salles, `E.SG_INT` 8 intensités, `E.sgStasis`, Bribes `S.songe`, Marché `E.SG_SHOP`, conversion `E.sgConvert` dans `migrate`), js/songeui.js (`window.SGUI`, actions `sg-*`) et js/legendaires.js (38 objets `E.LEG_LIST`, stats 80-90 % du meilleur objet calculées au chargement `E.legBuild`, Éveil `lgc`, un par héros via `E.equip`, passifs branchés dans dealDamage/startOfTurn/soins/cooldowns et au Kolizéum). Visuel `.lx.cf` / `.lxn.cf` (style.css). Tests : tests/songe.test.js, tests/legendaires.test.js. Simulation : `npm run sim -- --songe`.

## 0.1.47.7 « Sablier économe »
`E.sabBusy` (engine.js) : `E.sabSpend` ne vide la réserve que si un combat, un donjon, l'expédition, une récolte, l'atelier ou un plan de forgemagie avance ; sinon vitesse ×1 et pastille `.sabpill.idle`.

## 0.1.47.6 « Notifications polies »
Notifications (`toast()` dans ui.js) : chat ouvert (`body.chat-open`), la pile `.toasts` passe à gauche du chat sur PC (`right:410px`) et en haut, une seule visible, au téléphone. Pendant la frappe dans `#chIn` (champ non vide), les notifications sont mises en file (3 au plus) et rendues dès que le champ est vide ou quitté. Réglage `S.settings.toastPos` (auto / top / bottom), classes `toast-top` / `toast-bot` posées par `applyDisplay()`.

## 0.1.47.5 « Panoplies d'abord »
`gearPlan(c)` (js/ui.js) : remplissage emplacement par emplacement puis essai de chaque panoplie du sac posée en entier avant de compléter ; mémorisé (`planMemo`). `bestFor`, `slotUpgrade`, `equipBest` et « Meilleur choix » suivent le plan.

## 0.1.47.4 « Curseur à sa place »
`repaintKeep(m, html)` dans ui.js (exposé en `DX.repaint`) : redessine une zone en gardant le focus et la sélection du champ actif, et la valeur des champs libres (sans `data-act`). Utilisé par `paint` et `render` de guilds.js et market.js ; avant, `paint` de la guilde refaisait `focus()` sans position (curseur au début, le nom s'écrivait à l'envers) et celui de l'HdV perdait le focus. Test dans tests/online.test.js.

## 0.1.47.3 « Bon élément »
`itemScore` (js/ui.js) : stats élémentaires et dommages d'un autre élément que celui du héros pondérés 0,1 (au lieu de 0,5 et 0,2) ; `buildMain` prend, sans répartition auto élémentaire, la stat élémentaire la plus investie (`c.alloc`), sinon celle de la classe.

## 0.1.47.2 « Équiper au mieux »
Bouton « Équiper au mieux (n) » pour un héros seul en haut de `charEquipView` (action `teamfix`/`gear` → `equipBest`), n = emplacements où `slotUpgrade` est vrai.

## 0.1.47.1 « Mutateur de l'heure »
Le mutateur de la semaine devient horaire (js/engine.js) : `E.hourIdx`/`E.hourEnd`, tirage pur `E.hourlyAt(S, n)` (mêmes règles : donjons proches du meilleur héros, `E.WEEKLY_MODS` sans « Véloces » ; par journées de 24 h, jamais le même donjon ni le même modificateur que l'heure d'avant), `E.weekly` garde son nom et met en cache `S.weekly = { h, did, mod }`, `E.nextHourly` pour « Ensuite ». `E.weekIdx`/`E.weekEnd` restent pour l'Expédition et les donjons de la semaine. Le post Discord du lundi (`discord_bot.js semaine`) est retiré du workflow.

## 0.1.47 « Galets du Kolizéum »
Les 6 Galets de DOFUS deviennent des ressources (`E.KOLI_GALETS` dans js/koli.js, icônes assets/i) vendues dans la boutique du Kolizéum et échangeables à l'HdV. Les recettes DOFUS des 358 objets du jeu qui en demandent les retrouvent au chargement (table `GALET_RECIPES` régénérée par `node tools/koli_galets.js` depuis DofusDB, à relancer après l'ajout d'objets ; drapeau `E.KOLI_GALET_RECIPES`). Boutique refaite (js/koliui.js `shop()`) : onglets par rayon (`sec`), grille, panneau d'achat collé en bas (quantité −/+/×5/×10/Max, `E.buyShop(S, shop, id, qty)` pour les articles `many`, articles `res`), badge « Pour ton équipe ». Source des ressources hors monstres via `E.RES_SOURCE`. Nouvelle pièce de Kolizeton (cache des images media-v8).

## 0.1.46.1 « Bon objet en tête »
Choix d'un objet (`charEquipView` dans js/ui.js) : tri par gain pour le héros avec `gainFor`/`gearScore` (somme d'`itemScore` + bonus de panoplie via `E.setBonus`) ; objet porté rappelé en haut, objets portés ailleurs (« Prendre ») et trop hauts repliés en bas (`ui.pmore`). `bestFor` (pastille verte, « Tout équiper au mieux ») utilise le même gain.

## 0.1.46 « Donjons de légende »
Lot 2 des donjons manquants : 22 donjons de niveau 200 (réponses de Mathis 1A à 8A, difficulté un peu relevée). tools/build_data.py : 21 sous-zones et 4 régions (cavaliers, wukin, possedes, ecailles) derrière le Kolosso, 22 entrées `DUNGEONS`, `CO_BOSS` += tempete_eliocalypse. Données ajoutées à js/gamedata.js sans modifier l'existant (245 objets, 61 panoplies, 124 monstres). js/data.js : `dg.needs` (la Tempête demande les boss des 4 Cavaliers, vérifié par `E.dungeonUnlocked`, texte `dgNeedTxt` dans ui.js), Fragment d'armure sur les 4 Cavaliers (35 %), `KEY_FIX` Dent de zarbivore et Shampoing Rhoarim. `E.DG_EASE` (1,1 à 1,55) réglé par simulation : bon équipement 6,1-7,3, optimisé 8,2-10. Trophées `TROPHY` (systems.js) et décors `DG_DECO` pour les 22. Zones de chasse : sans équipement 88-99 % de défaites, bon équipement 0-0,2 %.

## 0.1.44.2 « Offrande fixe »
Almanax : `E.almanax` tire l'offrande et la cible avec `S.almLvl = { day, lvl }`, le niveau du meilleur héros au premier passage du jour (seulement pour le jour en cours) ; récompenses (kamas, XP) au niveau actuel. Avant, chaque niveau gagné pouvait changer l'offrande demandée.

## 0.1.44.1 « Boss secondaires »
Suite de l'inventaire du contenu (contenu/inventaire-contenu-dofus.md). tools/build_data.py : `CO_BOSS` gagne le Laboratoire du Tynril, le Clos des Blops, le Dojo du Vent, la Tanière Givrefoux et les Cavernes du Kolosso (tous les boss DofusDB du donjon se battent ensemble) ; `POOL_FORCE` garde le Gorgouille (grades niveau 400) dans les salles de l'Antre du Dragon Cochon au niveau du boss ; `drop_ok` n'écarte plus que les « Fragment de carte » et « Fragment de mémoire » (et les types 173, 248). Données fusionnées dans js/gamedata.js sans toucher l'existant (10 monstres, 13 ressources, 55 équipements, 6 panoplies). js/engine.js : `dg.coBossHp` remplace `E.COBOSS_HP` par donjon ; js/data.js le règle (Tynril 0,2, Kolosso 0,15) d'après tools/simulate.js (bon équipement : stasis 5,2 et 5,0). `KEY_FIX` couvre 15 clés de plus et vise toutes les sous-zones d'accès (`sub.dungeons`) ; 5 récoltes niveau 200 ajoutées à `HARVEST.suf_embruns`.

## 0.1.44 « Kolizéum »
Kolizéum 3 contre 3 (réponses de Mathis : 1A à 12A, tickets de Koli, saisons d'une semaine, Kolizetons). Moteur (js/engine.js) : combat d'équipes de héros `E.koliSetup` (F.pvp ; les côtés sont échangés avant le tour d'un héros de l'équipe 1, `isHero`, glyphe Féca par équipe), érosion dès le tour 10, victoire aux PV au tour 20 (`E.KOLI`), puissance par classe et niveau `E.KOLI_POW` réglée par tools/koli_tune.js (tools/koli_sim.js pour vérifier). js/koli.js : état `S.koli` (équipe d'arène, cote Elo, tickets `ticket_koli` 10 par jour jusqu'à 30, journal), grades `E.KOLI_GRADES`, semaines `E.koliWeek` (comme gb_week), Fantômes `E.koliGhost`/`E.koliGhostOpp`, chance `E.koliChance` (20 combats d'essai), récompenses `E.koliReward`, boutique `E.SHOPS.koli`, ornements `koli` et `koli_ban`, en ligne `E.koliOnline`/`E.koliSync`. js/koliui.js : page Jouer › Kolizéum et écran de combat (`koliWatchStart` dans ui.js). Serveur : supabase/koli.sql (koli, koli_weeks, koli_fights, koli_row, koli_opps, koli_done, koli_me, lb_koli) et `{ koli }` dans la fonction « record » (adversaires, combat joué par le serveur). Emblèmes des grades : assets/ui/koli/. Test : tests/koli.test.js.

## 0.1.43 « Forgemagie de DOFUS »
Forgemagie fidèle à DOFUS (réponses 1A à 26A de Mathis). js/systems.js : six métiers `E.FM_JOBS` (appris au niveau `E.FM_LEARN` = 65 du métier d'artisanat lié ; `E.fmJobs` reprend l'ancien `S.fmJob` pour les six, `old` ouvre tout aux anciens forgemages), XP selon l'écart de niveau (`E.fmXpFor`), signature au niveau 200 (`E.signItem`). `E.forgemage` : trois issues (`E.fmOdds`, réglages `E.FM_ODDS`), reliquat `it.well` (effacé à l'HdV, js/market.js), over à `E.OVER_W` = 101 de poids, exo d'une caractéristique par le reliquat jusqu'à `E.EXO_STAT_W` = 20, plus de kamas ni de « Nourrir le Forgemage ». Exo PA/PM/Po/Invo sur tout objet (`E.EXO_STATS`, un seul PA/PM/Po porté par héros). Runes de transcendance (`ta:`, `E.TRANS`) dans les coffres de palier 20+ de l'Expédition. Coefficient de brisage commun en ligne : supabase/brisage.sql (`brisage_list`, `brisage_hit`), `E.netCoef`/`E.netCoefHits`, `brisageNet()` dans js/ui.js. Quête principale : l'étape 16 devient « Briseur de runes ». Simulation : tools/fm_sim.js (objets 100-200 : 104 à 111 % du poids au jet max après 250 runes d'over). Interface : `dayBar`, `recolteHtml`, `craftHtml`/`recDetail`, filtres `fltOf`/`filterBar` (retenus dans `S.settings`), `fmHtml`/`fmBench`, `brisageHtml`, `runesView`, `fmPlansHtml`. Test : tests/forgemagie.test.js.

## 0.1.42 « Accueil du jour »
Accueil refait (maquette validée par Mathis, réponses 1A à 12A) : `renderHomeInner` affiche un bandeau `.ac-ban` (zone + `diffTag`, rendement `E.zoneRate` en une ligne, têtes des héros `.ac-h` avec pastilles de `teamAlerts`, `fsGauge`), la ligne « Zone conseillée » (`bestSub`) quand l'équipe chasse ailleurs, les tuiles `homeTiles()` (défi, Almanax, avis, coffres, achats du jeu, sablier, prochain héros), `homeEvents()` (mutateur de la semaine + donjons éclair), la quête avec une ligne de chiffres et le panneau Journal / Derniers combats (`ui.hj`, `ui.hjAll`). Nouvelles actions : `homehero`, `hgo`, `hjtab`, `hjall`. La carte Discord devient une ligne `.dcline`. Les grandes cartes `heroCard`, les KPI et les Consommables quittent l'accueil. Test : `tests/smoke.test.js` vérifie les tuiles, les onglets, l'ouverture d'un coffre et la tête d'un héros.

## 0.1.41 « Donjons oubliés »
18 donjons classiques (niv. 40-110) absents de la liste `DUNGEONS` de tools/build_data.py, dont la Gelaxième Dimension (Gelano). Nouvelles sous-zones et régions (Albuera, Îlots de la mer d'Asse, Bonta et Brâkmar) dans `ZONES`. Les données ont été ajoutées à js/gamedata.js sans modifier l'existant (les recettes et PV des objets et monstres déjà présents ne bougent pas). `CO_BOSS` : les 4 Gelées Royales se battent ensemble (`dg.coBoss`, PV × `E.COBOSS_HP` = 0,4). `POOL_MIN` écarte les Larves Solitaires. Boss au grade aberrant (Maître des Pantins, niveau 400) ramené au niveau du donjon. `KEY_FIX` (js/data.js) : Blugely, Rougely, Vertgely, Pièce de Koffrefor, Larve pétrifiée d'Ecaflipuce ; recette de la Petite Larve Dorée. `HUNT_EASE` : Plage de Corail 0,9. Simulation : les 18 donjons dans les cibles (bon équipement stasis 5-7, optimisé 8-10).

## 0.1.40.2 « Équipe rangée » (bêta 0.1.40)
Page Équipe et héros refaite (maquette validée par Mathis, réponses 1A à 10A) : `renderTeam` affiche `teamTopHtml` (titre, compositions en puces, Idoles, Âmes, Partager), la liste `teamListHtml`/`teamRow` (groupes Première ligne, Arrière, Réserve, ligne dorée « Recruter un héros ») et la fiche `heroesHtml` (bannière `.hban` à la couleur de classe avec le symbole en filigrane, menu `ui.heroMore`, onglets `.htabs` collés). Au téléphone, `ui.tview` = "list" ou "hero". Les grandes cartes `teamCard` et la colonne de têtes `heroRail` (0.1.32.1) disparaissent ; ↑ ↓ suivent l'ordre de la liste. Le placement passe dans « Réorganiser » avec les compositions. Correctif : `.tag.soft` illisible en Émeraude.

## 0.1.40.1 « Annonces pour tous »
Bandeau d'annonce (js/chat.js) : `banner()` n'était appelé qu'au lancement et à l'arrivée d'une annonce dans le chat (temps réel). Il est maintenant relu toutes les 2 minutes : une annonce « bandeau seul » atteint les joueurs déjà connectés, et un bandeau expiré disparaît sans recharger.

## 0.1.39.2 « Idées à l'heure »
js/idees.js : le remerciement annonce la publication sur Discord « dans la demi-heure » (le workflow planifié toutes les 10 min n'est lancé par GitHub que toutes les 20 à 30 min environ).

## 0.1.39.1 « Almanax bien ouvert »
Le volet « Tous les bonus » de l'Almanax garde son état (`ui.almAll`, action `almall` sans rendu, comme `autotoggle`) : le rafraîchissement de la page le refermait.

## 0.1.39 « Les Mérydes de l'Almanax »
Almanax refait (systems.js) : calendrier de DOFUS `ALM_CAL` (366 jours, Méryde + type, généré par `tools/import_almanax.py` depuis DofusDB), 15 types `E.ALM_KINDS` (valeurs `v` équilibrées avec Mathis), cible `E.almTarget` (famille / zone / donjon tirés du jour et du niveau du meilleur héros), `E.almWhere` pour « Y aller ». Le bonus ne passe plus par `E.bonus` (plafond commun) : le moteur appelle `E.almMult(S, quoi, x)` (xp et kamas par monstre, butin, archi, chal, chal1, gather, filon, enclos) et `E.almChance` (eco, craft2, fm, brise), neutres sans offrande. `S.almanax = { day, kind, v, t, job }` ; un ancien `{ pct }` du jour ne donne plus de bonus. Offrande : + `E.almOfferXp(niveau)` XP par héros de l'équipe (`monsterXp × 750`, ≈ 15 min de chasse). Test : tests/almanax.test.js.

## 0.1.38 « Tout passe par l'HdV »
Fin de la vente au jeu : `E.sellItem` et `E.sellRes` supprimés (plus dans `E.ACTIONS`). Inventaire : « Vendre à l'HdV » (`MARKET.sellItem(uid)`, `MARKET.sellRes(key)`, visible seulement avec le serveur en ligne). Règles automatiques : `action`/`recycle` « sell » migrés en « break » à la lecture de la partie, défaut « break ». Marchand de secours `E.merchantRes` à `E.MERCHANT` = 30 % de `E.resPrice` pour `S.resCap` (systems.js) et la limite de banque (vie.js). Achats du jour : `E.gameBuys(S)` (3 ressources tirées du jour et de la tranche de niveau, prix `ceil(resPrice × 1,5)`, 100 chacune, `S.gbuy`), action `gameBuySell` (carnet : « Achats du jour »). HdV (market.js) : plancher 1 kama par unité, repères prix moyen / valeur de base, confirmation sous 50 % de la référence (`mk-lowok`), offres d'achat sous 50 % de la valeur de base rangées en bas avec « très bas ». Aucun changement SQL : le serveur n'imposait déjà que prix ≥ 1.

## 0.1.37.2 « Prix des héros »
`recruitPrice`, `canRecruit`, `recruitBtn` dans ui.js : prix sur le bouton « Recruter » (doré `.btn.kgold` si payable, sinon « il manque »), prix sous le « + » de la colonne des héros, pièce `.navcoin` sur « Équipe et héros », encadré `.rprice` dans la fenêtre de recrutement. Aucun changement de règle.

## 0.1.37.1 « Donjons à la chaîne »
Fiche de donjon : bloc `.chainbox` (1, 3, 5, 10, 20 sous le nombre de clés, « Toutes » = `ui.dgChain` -1, pas à pas − / +), retenu par donjon dans `S.dgChains`. `S.dungeon.tot` / `run` donnent « course n sur N » (en-tête du combat, menu « Combat en cours ») ; action `E.stopChain` (« Arrêter après celui-ci ») met `chain` à 1. Défaite ou clé manquante : arrêt comme avant.

## 0.1.37 « Sac agrandi »
`E.ITEM_CAP` 300 → 1 000, Grenier `per` 25 → 50. Coffre de trop-plein : `S.over` (objets complets avec `at`), taille `E.overCap(S)` = 200 + 10 × niveau de Grenier. `E.rollItem` marque le sac à vérifier ; `E.bagFlush(S)` (au début de `E.tick`, et à la fin de `E.catchUp` qui renvoie `over`) range les objets les plus récents non protégés au-delà de `E.itemCap`, puis brise les plus anciens du trop-plein en trop. Les règles automatiques passent avant (elles agissent au moment du butin). Actions `overTake`, `overBreak`, `overBreakAll`, `breakDupes` (`E.dupesList` : jamais portés, verrouillés, en tenue, Rayonnants, exo, parfaits, trophées). Les garde-fous « sac plein » des butins, coffres, quêtes, trophées et Expédition sont retirés (la fabrication refuse toujours un sac plein). Onglet `over` de l'Inventaire, bouton « Vendre à l'HdV » via `MARKET.sellItem(uid)`.

## 0.1.36.1 « Stats en combat »
Fiche › Caractéristiques : bloc « En combat » (`combatStats` dans ui.js) qui recalcule ce que `charEntity`, `applyFightBonuses` et `HUNT_SMALL`/`SMALL_TEAM` ajoutent en combat (PV, dégâts d'équipe, Fureur, dégâts reçus, critique réel, soins, XP, Prospection effective), résistances au-delà de 50 % signalées. Infobulles `STAT_HELP` alignées sur le moteur (critique ×1,25, Prospection dégressive, base PA et Initiative, Esprit Libre), « % » sur Rés. Neutre et Dommages aux sorts.

## 0.1.36 « Boîte à idées »
Page `sugg` (Communauté › Suggestions, toujours visible) et bouton dans Options › Aide : js/idees.js. Le jeu appelle `idea_send` (supabase/idees.sql, table `ideas`, avec ou sans compte : une idée / 10 min, 10 / jour, 30 / h pour les invités, pas de liens). Le workflow « Suggestions vers Discord » (toutes les 10 min) publie les idées en attente dans le forum #idées avec leur tag (`discord_bot.js suggestions`) et note l'adresse du fil. Panel admin : onglet « Suggestions » (`adm_ideas`, `adm_idea_hide`). Sans serveur, l'idée est copiée et le Discord s'ouvre.

## 0.1.35.3 « Chat refermable »
Chat : avec quatre onglets en `white-space:nowrap`, l'en-tête (`.ch-head`) dépassait les 380 px du chat sur PC et poussait `.ch-x` hors du cadre (`overflow:hidden`). En-tête compact, onglets qui rétrécissent au besoin, « en ligne » (`.ol`) qui se coupe en premier, `.ch-x` jamais réduit. Test : tests/online.test.js vérifie que le bouton reste dans le cadre sur PC et téléphone.

## 0.1.35 « Héros en réserve »
`E.HERO_MAX` = 12 héros, `E.TEAM_MAX` = 8 en équipe (`E.activeCount`). Un héros recruté ou rappelé de la récolte quand l'équipe est pleine passe au repos. `E.dismiss` congédie un héros (objets, familier et monture au sac, compositions, entraînement et atelier nettoyés) et rend `E.dismissRefund` = moitié de `recruitCost(nombre de héros)`. Classement « niveau » (`V.summary`) : 8 meilleurs héros. `S.recLv` (niveaux donnés par les recrutements) part dans `meta.rec` ; `ladder_from_save` (supabase/classements.sql, colonne `rec`) ne les compte pas comme un saut de niveaux suspect.

## 0.1.34.2 « Tout dans le sac »
Plus de conversion en kamas des objets 20 niveaux sous le meilleur héros (`E.LOW_ITEM_GAP` retiré de giveRewards) : ils passent par `E.applyAuto` puis le sac comme les autres.

## 0.1.34.1 « Butin entier »
`E.lootPenalty` renvoie toujours 1 : plus de baisse des ressources et objets sur les monstres faibles. `E.LOW_ITEM_GAP` (objets 20 niveaux sous le meilleur héros changés en kamas) inchangé.

## 0.1.34 « Zones à ta mesure »
Zone conseillée (`bestSub` dans ui.js) et « Suivre mon niveau » (`E.autoZoneTarget`) : milieu de la sous-zone (`E.subMid`) ≤ niveau moyen de l'équipe, sans malus d'XP, hors zones « Difficile ». `E.zoneDiff` : moyenne glissante des victoires (`zoneStats.ew`, ≈ 10 combats) et niveau moyen au dernier combat (`lv`), oubliée après 5 niveaux. Malus d'XP `E.XP_PEN` : libre jusqu'à 6 niveaux, −5 %/niveau, plancher 30 %. `E.HUNT_EASE` : PV et dégâts × par sous-zone (41 zones, calibré pour qu'une équipe de 4 aux objets 8 niveaux en dessous perde < 8 % au niveau du milieu de la zone), gains inchangés.

## 0.1.33.2 « Hauts faits à part »
Chat (js/chat.js) : onglet `h` « Hauts faits ». `isFeat(m)` = annonce automatique (`kind = 'ann'` sauf `data.t = 'admin'`) ; ces messages quittent le Général (liste, compteur non lu, aperçu du chat réduit) et ont leur compteur `unreadH`, qui ne s'ajoute pas à la pastille du chat réduit. Aucun changement serveur.

## 0.1.33.1 « Chat libre »
Chat : la liste de mots interdits de `chat_send` (supabase/chat.sql) est retirée. Restent le blocage des liens, le mode lent, l'anti-doublon, les signalements et les sanctions (muet, bannissement, suspension).

## 0.1.33 « Offres d'achat »
Hôtel de vente : table `hdv_orders` et RPC `hdv_order_new`, `hdv_order_fill`, `hdv_order_cancel`, `hdv_orders_list`, `hdv_orders_mine` (supabase/hdv.sql). Les kamas (prix × quantité + 2 %) sont retirés par une opération à la création ; chaque vente crée deux opérations (vendeur payé, acheteur livré avec `got`, qui affiche une notification). `hdv_order_close` rend `held − reçu × prix − taxe(reçu × prix)`. Expiration dans `hdv_sync`. Client : onglet `ord` de js/market.js (vues « On achète » et « Mes offres »), encadré `.mkobox` sur la fiche d'une ressource, proposition « Vendre directement » dans le formulaire de vente.

## 0.1.32.2 « Zones toujours visibles »
Encyclopédie : `.panel` a `overflow:hidden`, ce qui empêchait `position:sticky` de la colonne `.enczones`. Le panneau du Bestiaire (`.encpanel`) passe en `overflow:clip`, et la colonne se cale sous la barre du haut (`--sth`).

## 0.1.32.1 « Héros à portée de clic »
`heroRail(c)` (ui.js) : colonne `.hrail` dans `.fichewrap` à côté de `.fichemain` (fiche du héros), collée avec `position:sticky` sous la barre d'état ; au téléphone (< 860 px) elle devient une bande en haut de la fiche et remplace la rangée `.chips`. Pastilles : `hr-g` (meilleur objet, via `teamAlerts`), `hr-p` (points à répartir), `.out` (repos ou récolte). Flèches ↑ ↓ : `heroRailKey()` dans le gestionnaire `keydown`, seulement sur PC et quand la fiche occupe l'écran.

## 0.1.32 « Encyclopédie rangée »
`encyclopediaHtml()` (ui.js) : compteurs `.enckpis` (dont l'album des âmes, `data-act="archis"`), onglets `ui.enc.tab` (`best`, `fam`, `boss`) et lien vers Inventaire › Panoplies (`encsets`). Bestiaire : zones `.enczones` (menu `enczonesel` sur téléphone), zone par défaut = zone de chasse, recherche `encsearch` (nom de monstre ou butin connu, 60 résultats au plus), filtres `ui.enc.f`. Familles par zone (`encFamZone`) ou « presque finies ». Boss triés par niveau. `encCard` coupe les butins après 8 (`encmore`).

## 0.1.31.1 « Chat à sa place »
Chat : `paint()` (chat.js) lit la position de la liste avant de la redessiner (l'ancienne liste détachée renvoyait 0, d'où la remontée en haut à chaque rafraîchissement). En lisant plus haut, la position est gardée et `C.below` affiche le bouton « Nouveaux messages » (`ch-bottom`).

## 0.1.31 « Menus rangés »
Navigation en 5 groupes : `NAV` (ui.js, Communauté seulement en ligne), `navKey()` / `navGo(k)` traduisent l'état (`ui.tab`, `ui.world`, `ui.qt`) en clé de menu et inversement, `renderNav()` dessine la colonne PC (`.sn-side`, réduite par `S.settings.navMini`) et la barre téléphone (`.sn-mob`), `navMenuSheet()` les tuiles du bouton Menu. Donjons et Encyclopédie sont des pages seules de `renderWorld` ; `team` et `heroes` fusionnent (`#teamtop` rafraîchi seul, fiche `#fiche`) ; Succès et Ornements (`COL`, questui.js) quittent le journal. Bulle `NAV_NEWS` une fois (`S.navv`, `S.navNews`).

## 0.1.30.1 « Fabrication en série »
Artisanat : boutons « ×10 » et « Max ×N » à côté de « Fabriquer ». `E.craftCount` (engine.js) donne le nombre fabricable (ressources, niveau de métier, place dans le sac, 1 pour les recettes uniques) ; `E.craftMany` répète `craftItem` / `craftSpecial` (jets, XP et quêtes identiques à la fabrication une par une) et s'arrête à la première erreur.

## 0.1.30 « Coffres »
Cinq coffres du sac (`coffre_bois` … `coffre_obsidienne`, `coffre_douze`, data.js) ouverts par `E.openChest` (systems.js, table `E.CHEST_TIERS` : kamas = minutes de chasse × niveau du meilleur héros). Visuels SVG dans `assets/ui/coffres`, fenêtre d'ouverture `t: "chest"` (ui.js). Premier passage de stasis : `E.stasisChest(k)` (engine.js). Nouvelles sources : défi (série 7 et 30), record d'Expédition (`S.cnt.expChestRec`), trésor, Almanax 90 jours, Comptoir des temples.

## 0.1.29.5 « Dévotion débloquée »
Quête principale : `E.questProgress` (systems.js) compte l'étape `almanax` comme faite si `E.almanax(S).done` (offrande du jour faite avant l'étape) ; `checkQuest` dans `E.deserialize` débloque les sauvegardes coincées.

## 0.1.29.4 « Héros disponible »
« Envoyer un héros » d'un métier : `gatherPick(job)` (ui.js) choisit le héros par défaut : libre, puis au Havre-Sac, puis chasseur, puis récolteur d'un autre métier, et en dernier celui déjà sur ce métier (égalité : héros sélectionné).

## 0.1.29.3 « Protecteur à portée »
Protecteurs : `E.protWhy` (seuls bloquants : donjon, expédition, équipe vide) ; `E.protFight` rappelle les héros d'équipe qui récoltent et lance la chasse si besoin, mémorisé dans `protector.back` puis rendu par `E.protRestore` (via `S.protBack` dans `E.protExpire`) à la fin du combat ou au départ du protecteur. Bulle d'aide `protector` dans welcome.js.

## 0.1.29.1 « Badge du créateur »
Badge de l'équipe à côté du pseudo : `staff_list()` (supabase/chat.sql, lisible sans compte : créateur = `admins`, modérateurs = `mods`) chargé une fois par `staffLoad` (ui.js), puis `pname(pseudo, user_id)` / `staffCls` (exportés dans `DX.social`) dans le chat, les classements (podium, lignes, profil) et la guilde. Style `.xen` / `.xtag` / `.mtag` / `.is-crea`. Pseudos qui imitent l'équipe refusés : `pseudo_imite` + déclencheur `profiles_pseudo_guard` côté serveur, `ON.pseudoProblem` côté jeu.

## 0.1.29 « Sablier de Xélor »
Vitesse ×2 / ×3 limitée par une réserve : `E.sab`, `E.sabSpend`, `E.sabSet` (engine.js, `S.sablier` = réserve en secondes, recharge `E.SAB_RATE` en vrai temps jusqu'à `E.SAB_MAX`, débloqué à `E.SAB_UNLOCK_STEP` étapes de quête). La boucle (ui.js) appelle `E.tick(S, dt × vitesse, dt)` : le temps de jeu compté reste le vrai temps (contrôle des classements). Bouton `sabHtml` / fiche `sabSheet`, style `.sabpill`.

## 0.1.28.5 « Presque fabricable »
Ateliers : `ui.craftMiss` (-1 toutes, 0 fabricables, 1 à 3 = ressources différentes manquantes au plus) remplace `ui.craftOnly` ; `r.miss` calculé dans `craftHtml`, tri par manque puis niveau. (Bêta 0.1.29.2.)

## 0.1.28.4 « Double gain dans le chat »
Rappel de l'événement en cours en haut du chat (`eventHtml` dans js/chat.js, style `.ch-ev`), affiché tant que `E.eventOn()`.

## 0.1.28.3 « Double gain »
Événement XP et butin x2 pendant 48 h, du 12/10 21 h au 14/10 23 h (heure de Paris) : `E.EVENT`, `E.eventOn`, `E.evMult` dans engine.js, appliqués dans `giveRewards` (XP par héros et butin, donc aussi l'absence) et `resRateH`. Bandeau `.updbar.ev` pendant l'événement. Pour un prochain événement, changer `E.EVENT`.

## 0.1.28.1 « Idlus en ligne »
Le jeu public passe en ligne avec tout le contenu de la version de test 0.1.28.1 : comptes facultatifs (Discord ; l'e-mail attend un vrai service d'envoi), sauvegarde en ligne, classements, chat, Hôtel de vente et échanges, guildes, boss de guilde et Percepteurs, défi du jour, codes cadeaux, Expédition sans fin, carnet de bord, chasse au trésor, commandes d'artisans et temples, cadres de métal, journal de quêtes. Le public reprend le serveur Supabase de la bêta (`js/online.js` : un seul monde) ; la bêta n'a plus de serveur, et le workflow « Serveur en ligne » se déclenche désormais sur `main`. Le panel de test (`js/admin.js`) et la récompense Pionnier restent réservés à la bêta.

## 0.1.20.1 « Bouftous apprivoisés »
- Retour joueur : Bouftous à 700-1100 PV, équipe balayée en boucle. `E.MON_POW.hunt` passe de [[15,1,1],[30,4.5,4]] à [[20,1,1],[30,2.6,2.4],[40,4.5,4]] et `minGroup` (4 monstres au moins) ne s'applique plus qu'aux zones dont le niveau max atteint 33 (avant : 25). Même correctif que la bêta 0.1.23.1.
- Bonus « petit groupe » en chasse et soins seulement si un héros est blessé : même correctif que la bêta 0.1.24.3 (`E.HUNT_SMALL`, `E.huntMon`, `charTurn`).

## 0.1.20 « La grande mise à jour »
Le jeu public reçoit tout le contenu de la version de test : niveau 200 et 51 nouveaux donjons, mutateur éclair, combats animés, 19 classes, familiers, montiliers et montures, forgemagie exotique, idoles, Renaissance, archimonstres et Dofus, île des Wabbits, défi du jour, garde-robe, bulles de découverte et recherche rapide. La partie est gardée. Les comptes, classements, chat et hôtel de vente restent sur la version de test jusqu'au multijoueur ; le panel de test n'est pas publié.

## 3.4.4 « Nouvelle adresse »
- Le jeu s'ouvre maintenant sur **idlus.github.io** ; l'ancienne adresse y renvoie et la partie du navigateur suit le joueur.

## 3.4.3 « Passif visible »
- **Recruter un héros** : la description et le passif de la classe choisie s'affichent en entier (ils étaient écrasés sous la grille des classes).

## 3.4.2 « Symboles de classe »
- **Symboles de classe** sur l'écran de départ et au recrutement, avec le héros en pied dans le panneau de la classe.
- **Choix de la tête** dès la création du héros.
- **Forgelance** : apparence tirée de l'illustration officielle ; **Ouginak** : têtes défectueuses retirées.

## 3.4.1 « Discord »
- **Signaler un bug** ouvre directement le forum Bugs du Discord (modèle de rapport copié).
- **Serveur Discord** réorganisé : entraide, builds, captures, forums Bugs et Idées, version de test, mutateur de la semaine chaque lundi.

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

## Annonce en jeu sans le panel admin

Le workflow « Annonce en jeu » (`.github/workflows/annonce-en-jeu.yml`) publie une annonce comme le bouton « Publier » du panel admin (`adm_announce` de supabase/chat.sql, au nom du compte admin Xener) : bandeau en haut du jeu (24 h par défaut ; 1h, 7j ou permanent) et message dans le Général. Texte brut, une ligne, 200 caractères au plus, sinon le workflow échoue (`tools/annonce_en_jeu.js --verifier`). Lancement depuis l'onglet Actions, avec `node tools/annonce_en_jeu.js "<texte>"` (gh connecté) ou par l'API GitHub sur `main` ; l'entrée `essai` fait tout puis annule. À lancer après le push sur `main` d'une version, une fois `npm test` (et son garde-fou `tools/garde_fou.js`) passé.
