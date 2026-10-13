# Idlus

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://idlus.github.io/ (installable sur téléphone et PC)

**Discord :** https://discord.gg/9ApPgWjPUM

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
