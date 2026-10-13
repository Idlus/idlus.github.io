# Idlus

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://idlus.github.io/ (installable sur téléphone et PC)

**Discord :** https://discord.gg/9ApPgWjPUM

## 0.1.35.3 « Chat refermable »
Chat : avec quatre onglets en `white-space:nowrap`, l'en-tête (`.ch-head`) dépassait les 380 px du chat sur PC et poussait `.ch-x` hors du cadre (`overflow:hidden`). En-tête compact, onglets qui rétrécissent au besoin, « en ligne » (`.ol`) qui se coupe en premier, `.ch-x` jamais réduit. Test : tests/online.test.js vérifie que le bouton reste dans le cadre sur PC et téléphone.

## 0.1.35.2 « Tout dans le sac » (public : 0.1.34.2)
Plus de conversion en kamas des objets 20 niveaux sous le meilleur héros (`E.LOW_ITEM_GAP` retiré de giveRewards) : ils passent par `E.applyAuto` puis le sac comme les autres.

## 0.1.35.1 « Butin entier » (public : 0.1.34.1)
`E.lootPenalty` renvoie toujours 1 : plus de baisse des ressources et objets sur les monstres faibles. `E.LOW_ITEM_GAP` (objets 20 niveaux sous le meilleur héros changés en kamas) inchangé.

## 0.1.35 « Héros en réserve »
`E.HERO_MAX` = 12 héros, `E.TEAM_MAX` = 8 en équipe (`E.activeCount`). Un héros recruté ou rappelé de la récolte quand l'équipe est pleine passe au repos. `E.dismiss` congédie un héros (objets, familier et monture au sac, compositions, entraînement et atelier nettoyés) et rend `E.dismissRefund` = moitié de `recruitCost(nombre de héros)`. Classement « niveau » (`V.summary`) : 8 meilleurs héros. `S.recLv` (niveaux donnés par les recrutements) part dans `meta.rec` ; `ladder_from_save` (supabase/classements.sql, colonne `rec`) ne les compte pas comme un saut de niveaux suspect.

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

## 0.1.29.2 « Presque fabricable »
Ateliers : `ui.craftMiss` (-1 toutes, 0 fabricables, 1 à 3 = ressources différentes manquantes au plus) remplace `ui.craftOnly` ; `r.miss` calculé dans `craftHtml`, tri par manque puis niveau.

## 0.1.29.1 « Badge du créateur »
Badge de l'équipe à côté du pseudo : `staff_list()` (supabase/chat.sql, lisible sans compte : créateur = `admins`, modérateurs = `mods`) chargé une fois par `staffLoad` (ui.js), puis `pname(pseudo, user_id)` / `staffCls` (exportés dans `DX.social`) dans le chat, les classements (podium, lignes, profil) et la guilde. Style `.xen` / `.xtag` / `.mtag` / `.is-crea`. Pseudos qui imitent l'équipe refusés : `pseudo_imite` + déclencheur `profiles_pseudo_guard` côté serveur, `ON.pseudoProblem` côté jeu.

## 0.1.29 « Sablier de Xélor »
Vitesse ×2 / ×3 limitée par une réserve : `E.sab`, `E.sabSpend`, `E.sabSet` (engine.js, `S.sablier` = réserve en secondes, recharge `E.SAB_RATE` en vrai temps jusqu'à `E.SAB_MAX`, débloqué à `E.SAB_UNLOCK_STEP` étapes de quête). La boucle (ui.js) appelle `E.tick(S, dt × vitesse, dt)` : le temps de jeu compté reste le vrai temps (contrôle des classements). Bouton `sabHtml` / fiche `sabSheet`, style `.sabpill`.

## 0.1.28.4 « Double gain dans le chat »
Rappel de l'événement en cours en haut du chat (`eventHtml` dans js/chat.js, style `.ch-ev`), affiché tant que `E.eventOn()`.

## 0.1.28.3 « Double gain »
Même événement que le jeu public 0.1.28.3 : XP et butin x2 du 12/10 21 h au 14/10 23 h (heure de Paris) via `E.EVENT`, `E.eventOn`, `E.evMult` (engine.js : `giveRewards`, `resRateH`) et le bandeau `.updbar.ev`. Pour un prochain événement, changer `E.EVENT`.

## 0.1.28.2 « Bêta hors ligne »
- Le multijoueur passe sur le jeu public (main, serveur Supabase actuel). `js/online.js` : un seul monde en ligne, le public ; /beta/ n'a plus de serveur. Le workflow « Serveur en ligne » quitte `beta` : le SQL et la fonction « record » ne se déploient plus qu'à une publication sur `main`.
- Menu d'entrée de la bêta (`betaGate` dans ui.js) : « Tester hors ligne » ou « Jouer en ligne » (lien vers le public), choix gardé pour la session.
- Panel de test : `testerOk` accepte aussi `localStorage["idlus-testeur"]`, posé par chat.js quand le compte admin est connecté sur le public du même navigateur.

## 0.1.28.1 « Défi au tableau » (bêta)
- Mathis (question 6 du fil Défi du jour) : `defiLine()` affichée dans le tableau du jour de Quêtes (js/questui.js) ; `defiTodo()` compte dans `QUI.todo` (pastille de Quêtes). Les deux sont exposées dans `window.DX.social`.

## 0.1.28 « Journal de quêtes » (bêta)
- Mathis : refonte du menu Quêtes (maquette validée « 1A 2A 3A 4A 5A 6A 7A 8A »). Rendu dans `js/questui.js` (`window.QUI` : `render`, `act` pour les actions `qj-*`, `todo` pour la pastille) et `css/quetes.css` (classes `.qj-*`). `ui.qt` vaut `jour` par défaut et en entrant dans Quêtes par la barre ; pages `jour`, `almanax`, `bounty`, `commandes`, `temples`, `main`, `dofus`, `align`, `ach`, `orn`, `shops`. Les pages Almanax, Avis, Commandes, Temples et Alignement restent rendues par ui.js (leur `<p class="note">` de tête passe derrière le « ? »). Les boutiques ne sont plus en bas des pages : `shopLink(id)` met un raccourci vers Quêtes › Comptoirs.

## 0.1.27.1 « Panel de test réservé » (bêta)
- Mathis : panel de test (`js/admin.js`) réservé à lui seul. `testerOk()` dans ui.js : vrai seulement si `window.CHAT.role === "admin"` (rôle lu par le serveur via `my_role`), ou en local (localhost) pour les essais. Sans ça, le bouton du bandeau bêta n'est pas affiché et `admin.js` ignore les clics `data-adm`. `renderStatus` redessine le bandeau bêta pour que le bouton apparaisse dès que le rôle est chargé.

## 0.1.27 « Cadres de métal » (bêta)
- Mathis : refonte des cadres (maquette https://claude.ai/artifact/1mSs8Gf91tPNWnwNek6sVU, choix « Métal orné » + portraits encadrés). `E.FRAMES` passe à 5 métaux × 2 rangs + Krosmoz (`E.frameIdx` inchangé, un rang tous les 20 niveaux) ; `E.FRAME_KEYS` / `E.frameKey(lvl)` donnent la clé `data-fr` (bois1 … eme2, krosmoz). CSS en fin de style.css (variables `--m1/--m2/--m3/--gem`, rivets en `::before`, coins en `::after`, ruban `.tier` sous la carte). `cmed(cls, lvl, ren)` encadre le médaillon (`data-fr`, « feu » si rené) ; les vues `lb_level`, `lb_records`, `lb_week`, `lb_defi` exposent `main_lvl` (lu seulement si le serveur l'a, `LB.ml`).

## 0.1.26.1 « Défi à portée de main » (bêta)
- Mathis : un vrai menu pour le Défi du jour et le lancer depuis l'Accueil (maquette validée, toutes options recommandées). Onglet `defi` dans `NAV` (famille Aventure) → `renderDefi` ; carte `defiHomeCard` sur l'Accueil ; `defiLine` remplace l'encart dans Donjons ; `defiTodo` pour la pastille ; `defiReward` estime les kamas du coffre par `E.defiSim` gardé dans `ui.dfEst` (même jour, même équipe) ; `defiLbFill` charge le top 5 du palier. CSS `.dfhome`, `.dfline`, `.df-goal`.

## 0.1.26 « Codes cadeaux » (bêta)
- Mathis (maquette validée « 1A 2A 3A 4A 5A ») : codes cadeaux gérés par le serveur. `supabase/codes.sql` : tables `gift_codes`, `gift_uses` (un compte ou une partie sans compte, `S.gid`), `gift_tries` (10 essais ratés / 10 min) ; `gift_redeem` (anon et comptes) renvoie la récompense ; `adm_gifts`, `adm_gift_create`, `adm_gift_set`, `adm_gift_users` réservés à Mathis. `js/codes.js` (`window.GIFTS`, bêta seulement) : `redeem` (les codes `IDLUS-…` passent toujours par `E.redeemGift`), onglet « Codes cadeaux » du panel admin (branché dans `chat.js`), bouton « Code pour le jeu public » (`E.makeGift`), lien `?code=` qui ouvre Options › Jeu avec le code rempli. `E.giveGift` partagé ; nouvelle récompense `i` (objets, 10 max par ligne).

## 0.1.25 « Options rangées » (bêta)
- Mathis : menu des réglages plus lisible (maquette validée « 1A 2A 3A 4A »). `optionsSheet` affiche 5 onglets (`OPT_TABS`, `ui.optTab` garde le dernier) ; aides `optSec` / `optLine` / `optChk` (classes `.optsec`, `.optline`, `.optchk` dans style.css ; ne pas réutiliser `.chk`, déjà pris). `pageGo("consignes")` ouvre l'onglet Jeu, `account` l'onglet Sauvegarde.

## 0.1.24.4 « Combat en vue » (bêta)
- Retour de Mathis : le combat de l'expédition doit se voir par défaut. `expStart` et une porte de combat basculent sur l'onglet Combat ; `EXPUI.combatHtml` affiche les portes de l'étage (ou le bouton du choix en attente) dans `renderCombat` entre deux combats, et le suivi de `expui.js` rafraîchit aussi l'onglet Combat quand l'étage change.

## 0.1.24.3 « Chasser à son rythme » (bêta)
- Mathis : en chasse, bien équipé, on ne doit presque jamais perdre, quel que soit le nombre de héros. Simulation avant : solo bien équipé 35-68 % de défaites, duo 8-21 %. Nouveau `E.HUNT_SMALL` (solo/duo/trio : PV en plus, `smallDr`, et `mon` = part du renfort `E.MON_POW` gardée par les monstres, aussi dans `E.powRew` donc les gains par monstre suivent ; jamais en donjon ni en expédition). IA : un sort de soin sans condition n'est plus lancé si aucun héros n'est sous 80 % de PV (`charTurn`). Après : 0-2,6 % de défaites bien équipé (solo, duo, trio, 4), sans équipement 23-87 % dès les zones 32-40 ; kamas/h solo < duo < 4 héros.

## 0.1.24.2 « Percepteurs à 5 % » (bêta)
- Demande de Mathis : `E.PERCO_RATE` passe de 3 à 5 % ; `E.percoCap` en dépend (kamas et ressources ×5/3), `supabase/percos_data.sql` régénéré par `node tools/build_percos.js`. Poche toujours pleine en 12 h.

## 0.1.24.1 « Artisans et temples » (bêta)
- Commandes d'artisans (3 par jour, livraisons partielles, rangs d'artisan, prime du jour), temples et Dopeuls (un par classe et par jour, Doplons, Comptoir des temples, titre à 10 temples ; force réglée par simulation : bien équipé ≈ 80 % de victoires, sans équipement défaite), sons synthétisés (coupés par défaut), consignes d'absence (itinérance hors ligne, retour à la zone, limite de banque, Almanax et commandes au retour). Code : `js/vie.js` ; test : `tests/vie.test.js`.

## 0.1.24 « L'Expédition sans fin » (bêta)
- Nouveau mode sans fin (Aventure › Expédition, niveau 10, sans clé) : étages adaptés au niveau de l'équipe à l'entrée, 2-3 portes par étage (Combat, Élite, Trésor, Autel, Repos, Marchand ; boss tous les 5, palier tous les 10), règne des Douze par tranche de 10 étages, 24 reliques en %, 10 bénédictions, 3 vies, coffre de palier à encaisser ou doubler, campement de 24 améliorations permanentes payées en Éclats d'expédition. Logique dans `js/expedition.js` (branchée dans `E.startFight`, `endFight`, `E.tick`, `dealDamage`), interface dans `js/expui.js`. Difficulté sur la courbe des stasis (`E.expStasis`, `E.EXP_CURVE`). Tests : `tests/expedition.test.js` ; simulation : `node tools/simulate.js --expedition`. Lot 2 à venir : classement et coffre de la semaine (rejoués par le serveur).

## 0.1.23.1 « Bouftous apprivoisés » (bêta)
- Retour joueur : Bouftous à 700-1100 PV, équipe balayée en boucle. Cause : `E.MON_POW.hunt` (0.1.12.3) montait de ×1 au niveau 15 à ×4,5 au niveau 30, et `minGroup` imposait 4 monstres dès les zones dont le niveau max atteint 25. Nouveau : `hunt` = [[20,1,1],[30,2.6,2.4],[40,4.5,4]] et `minGroup` dès un niveau max de 33. Simulation (`node tools/simulate.js --chasse N --zones id --profils aucun|debutant|bon`, nouvelles options `--zones` et profil `debutant`, kamas/h affichés) : voir le tableau dans le récapitulatif.

## 0.1.23 « Boss et Percepteurs » (bêta)
- Boss de la semaine (guildes, réponse 9A) : `js/gboss.js` (E.gboss, E.gbossSim : essai de 15 tours, boss au niveau de l'équipe, PV ×1000, points = dégâts / PV normaux × 100 × `E.GBOSS_POW`, table générée par `node tools/gboss_calib.js` pour viser ~300 points par essai bien équipé ; boss à mécanique bloquante écartés). Serveur : `supabase/gboss.sql` (essais 3/jour heure de Paris, jauge 2 500 points par membre, coffres 25/50/75/100 % par `hdv_op`, titre « Pourfendeur de boss » pour les 3 meilleures guildes) et branche `gboss` de la fonction `record`.
- Percepteurs version 2 « La guilde défend ensemble » : 1 au niveau 5 de guilde puis +1 tous les 5 niveaux (5 au plus), 20 000 kamas payés par le poseur, zone finie (trophée de sous-zone), 3 % (5 % depuis 0.1.24.2) de 12 h de chasse (`supabase/percos_data.sql`, généré par `node tools/build_percos.js`), attaque ~1/jour quand un membre regarde la guilde, 2 h pour défendre (E.percoSim rejoué par la branche `perco` de `record`), victoire +25 % de poche, XP de guilde et coffre, sinon la moitié de la poche perdue. Tests : `tests/gboss.test.js`.

## 0.1.22.1 « Challenges qui rapportent » (bêta)
- Retour joueur : respecter les challenges faisait perdre 7 à 20 % de gains par heure (IA ralentie, bonus de +5 à +12 %). Nouveaux bonus selon le coût mesuré par simulation (`E.CHALLENGES[id].diff` : 10 à 30 %), série +1 %/combat jusqu'à +10 % (`E.CHAL_STREAK_STEP/MAX`). IA : sorts de zone permis pour Focus et Chacun s'ils touchent la cible du héros, pour Élitiste/Ordonné sauf si un autre monstre passe sous 60 % de PV ; invocations ciblées selon les challenges du maître. Corrections : Chacun son monstre (jamais réussi), Rapide (tours selon le niveau des monstres), Élémentaire (un élément par héros, `F.cs.el` par héros).

## 0.1.22 « Carnet et trésor » (bêta)
- Lot Suivi : carnet de bord (Équipe › Carnet) avec courbes d'XP, kamas, combats et niveau sur 7 jours (par heure) et 30 jours (par jour), heures hors ligne et mises à jour marquées, bilan des kamas par source, meilleures zones, grands moments ; envoi d'un résumé hebdomadaire au serveur (`supabase/carnet.sql`, lisible par l'admin seulement) ou copie. Tout est dans `js/suivi.js` (enveloppe `E.tick`, `E.catchUp` et les actions de `E.ACTIONS` pour ranger les kamas), environ 6 à 10 Ko dans la sauvegarde.
- Chasse au trésor (Monde › Trésor) : parchemin du jour + parchemins trouvés en chasse (1/300), 3 à 5 indices (sous-zone + repère, 6 victoires sur place), gardien renforcé (même mécanique que les protecteurs), coffre ; l'itinérance attend la fin du trésor. Succès, titre « Chasseur de trésors », ornement « Boussole dorée ». Tests : `tests/suivi.test.js`.
## 0.1.21.1 « Annonces de records » (bêta)
- Chat : l'annonce d'un nouveau n°1 de donjon s'affichait vide (le temps du record, `t`, écrasait le type `t` dans `supabase/functions/record`). Le temps passe dans `sec` ; `js/chat.js` relit les anciennes annonces et ne montre jamais de barre vide.

## 0.1.21 « Guildes » (bêta)
- Multijoueur, étape 5 (première partie) : guildes (Guildalogemme 100 000 kamas + héros niveau 30, 30 membres, rangs Meneur / Bras droit / Membre / Recrue, entrée libre ou sur demande, invitations), XP de guilde donnée par les membres (0 à 90 % de l'XP des combats, `E.guildXpShare`), niveaux 1 à 100 et bonus (`E.guildBonus`, sous les plafonds), chat de guilde (onglet Guilde du chat, relevé toutes les 4 s), journal, onglet Guildes du panel admin. Code : `js/guilds.js`, `supabase/guildes.sql`. Boss de la semaine, Percepteurs (version « la guilde défend ensemble ») et coffre de guilde : partie suivante.

## 0.1.20 « Hôtel de vente » (bêta)
- Multijoueur, étape 4 : hôtel de vente entre joueurs (équipements avec leur jet exact, ressources et clefs par lots de 1/10/100, runes, consommables ; taxe de 2 % à la mise en vente, 20 annonces, 14 jours, prix minimum = revente au jeu) et échange direct entre deux joueurs. Nouvelle famille « Communauté » (Hôtel de vente, Classements). Le serveur garde les annonces et renvoie des « opérations » (kamas, objets, ressources) que le jeu applique dans l'ordre (`S.hdv.op`). Code : `js/market.js`, `supabase/hdv.sql`, `supabase/hdv_data.sql` (généré par `node tools/build_hdv.js` : Dofus, trophées, meubles et idoles interdits).

## 0.1.19.4 « Jouer sans compte » (bêta)
- Plus d'écran de connexion au premier lancement : on joue tout de suite sans compte (`onBoot` dans `js/ui.js` : l'écran de connexion ne vient que sur « Se connecter » ou après une erreur). L'écran de départ propose « Déjà un compte ? Se connecter ». La partie sans compte part sur le compte à l'inscription.

## 0.1.19.3 « Carte Discord » (bêta)
- Chat : le bandeau Discord devient une carte aux couleurs de Discord (logo, « Serveur Discord d'Idlus », bouton « Rejoindre »).

## 0.1.19.2 « Regarder le combat » (bêta)
- Défi du jour : bouton « Regarder le combat » qui rejoue le défi pas à pas sur l'écran de combat (`E.defiWatch` / `E.defiWatchStep` dans `js/defi.js`, même hasard que le score), vitesse ×1/×2/×4.

## 0.1.19.1 « Discord dans le chat » (bêta)
- Bandeau en haut du chat vers le serveur Discord (questions, bugs, idées).

## 0.1.19 « Se montrer » (bêta)
- Lot Se montrer : défi du jour (même donjon, stasis, modificateurs et hasard pour tous, tirés de la date ; trois paliers ; combat joué d'un coup par le moteur, rejoué par le serveur pour le classement ; coffre, série de 7 et 30 jours), carte d'équipe à partager (image dessinée par le navigateur), garde-robe des coiffes et capes (apparence montrée, sans effet). Code : `js/defi.js`, `supabase/defi.sql`, fonction serveur `record` (`{ defi: palier }`).

## 0.1.18 « Chat et panel admin » (bêta)
- Multijoueur : chat général et messages privés en temps réel (Supabase Realtime), objets montrés dans les messages, annonces automatiques (Premiers, numéros 1, niveau 200, Renaissance, Dofus), ignorer et signaler. Panel admin côté serveur (joueurs, sanctions, signalements, vérification, annonces en bandeau, modérateurs). Interface dans `js/chat.js`, règles et fonctions dans `supabase/chat.sql` (appliqué par le workflow « Serveur en ligne »).

## 0.1.17 « Bienvenue » (bêta)
- Lot Bienvenue : bulles de découverte (18, une seule fois chacune, question « Tu connais DOFUS ? » au départ, carnet dans les Options), recherche rapide (Ctrl+K, « / » ou la loupe : objets, monstres, donjons, zones, pages… avec fiche « où le trouver »), Options › Affichage (taille du texte, mouvements réduits, contraste renforcé). La rareté des objets est retirée de l'affichage. Logique dans `js/welcome.js`, test `tests/welcome.test.js`.

## 0.1.16 « Classements » (bêta)
- Multijoueur, étape 3 : onglet Classements (Niveau avec filtre par classe, Donjons de la semaine et depuis toujours, Album, Succès, Premiers), profils des joueurs. Les records de donjon sont rejoués par la fonction serveur `supabase/functions/record` (même moteur que le jeu, assemblé par `tools/build_server.js`) ; base dans `supabase/classements.sql`, appliquée avec la fonction par le workflow « Serveur en ligne ».

## 0.1.15 « Comptes en ligne » (bêta)
- Multijoueur, étape 2 : compte (Discord ou lien par e-mail, pseudo unique) et sauvegarde en ligne sur Supabase (`js/online.js`, base dans `supabase/schema.sql`), pastille de sauvegarde, choix entre deux versions de la partie, partie « Compte » dans les Options.

## 0.1.14.4 « Dernier réglage » (bêta)
- Métiers au tiers du niveau de l'objet, attaques trop faibles renforcées, Écaflip et Roublard réglés vers le niveau 50.

## 0.1.14.3 « Monstres et héros » (bêta)
- Familles de monstres (mode « Complètes ») : 29 familles attaquent chacune à leur façon au lieu de simplement foncer. Le Tofu vole en zigzag et picore trois fois dans une gerbe de plumes, le Bouftou gratte le sol puis donne un coup de boule qui repousse le héros, le Champa lâche un nuage de spores, le Craqueleur arrache un rocher et le lance en cloche, l'Arakne tisse une toile, la Larve glisse en laissant une traînée, le Piou pique du ciel, le Moskito pique en zigzag, le Prespic lance une volée de piquants, le Bwork abat sa massue, le Blop rebondit, le Chafer lance un os boomerang, l'Abraknyde fait pousser des racines, le Mulou mord, le Wabbit donne un coup de patte, la Crocodaille claque des mâchoires, les Dragoeufs soufflent le feu, le Scarafeuille lève un tourbillon de feuilles, le Kanigrou boxe, les Fantômes traversent le héros, le Koalak cogne avec un os, Sangliers et cochons chargent dans la boue, le Rat fait un croc-en-jambe, les pirates donnent des coups de sabre, les Pandas un coup de pied tournant, les Kitsous une ruée de feu, les plantes un nuage de pollen, les robots un coup de piston ; les autres monstres gardent leur attaque habituelle
- Héros en difficulté : sous 25 % de vie, le héros bat comme un cœur (teinte rouge), une vignette rouge pulse sur l'arène et une pastille « en danger » apparaît sous sa barre de vie
- Poses de victoire : à la fin d'un combat gagné, chaque classe a sa pose (le Iop bondit l'épée levée, le Crâ tire une flèche vers le ciel, l'Eniripsa tourne dans une gerbe de bulles, le Féca lève son bouclier, l'Enutrof fait pleuvoir des kamas, le Sram disparaît et réapparaît, le Xélor fait tourner une rune, l'Écaflip lance ses cartes, le Sadida fait voler des feuilles, le Sacrieur se frappe la poitrine, le Pandawa boit un coup, le Roublard jongle avec ses bombes, le Zobal fait tourner son masque, le Steamer lâche de la vapeur, l'Éliotrope passe par un portail, l'Huppermage fait tourner ses quatre runes, l'Ouginak hurle, le Forgelance plante sa lance)
- Les boss reconnus comme une famille (Bouftou Royal, Tofu Royal…) utilisent aussi l'attaque de leur famille quand ils ne lancent pas leur sort
## 0.1.14.2 « Île des Wabbits » (bêta)
- Nouvelle zone : l'Île des Wabbits (niveau 40 à 120) et ses deux donjons, le Château du Wa Wabbit et le Terrier du Wa Wabbit ; le Dofus Cawotte tombe du Wa Wabbit et sa quête se fait sur l'île.

## 0.1.14.1 « Héros plus malin » (bêta)
- En combat, le héros prépare tout son tour : zone face à un groupe, gros coup sur le boss, élément le moins résisté, coup de grâce.

## 0.1.14 « Boss mis en scène » (bêta)
- Mise en scène des boss (mode d'animation « Complètes ») : chacune des 22 mécaniques de boss a maintenant sa propre scène dans l'arène au lieu d'un simple bandeau : Rage (vapeur et veines), Carapace (plaques qui se referment en dôme), Attaque dévastatrice (le boss aspire l'air puis lâche une onde de choc), Point faible (cible qui se fissure au coup suivant, ×1,5 affiché), Séisme (pics de pierre sous la première ligne), Riposte (parade puis contre-coup pendant le tour du héros), Reflet (double miroir et éclat au coup reçu), Miasmes (brume qui traverse l'arène), Dévoreur (le serviteur est avalé), Brise-garde (les boucliers volent en éclats), Putréfaction, Change-peau (l'ancienne peau se détache, la nouvelle teinte reste), Condamnation (crâne à compte à rebours relié au boss, puis guillotine), Mutisme (lettres qui tombent, cadenas), Terreur (ombre géante), Frénésie, Totems (dôme doré), Âmes liées (fil d'âme et dégâts qui filent vers le serviteur), Immortel (le boss part en cendres et renaît), Compte à rebours (vignette rouge et chiffre dès le tour 15)
- Les 20 boss à signature ont leur scène : Distorsion du temps, Fournaise et givre, Tapis roulant, Grand banquet, Inventions (plan bleu et bombe), Marée, Sacrifice, Dédoublement, Regard pétrifiant, Aspiration, Toucher doré, Larcin, Charge du taureau, Quatre humeurs, À l'abordage, Glyphes pair et impair (glyphe permanent sous Kimbo, bleu ou rouge selon le tour, ×1,4 et ×0,7 affichés), Horloge (engrenages, pendule et compteur de tours), Racines, Glace éternelle, Appétit d'Ougah
- Sorts signature de boss : une attaque sur trois environ, dix boss emblématiques lancent leur sort à eux, purement visuel et sans changer les dégâts : Bouftou Royal (Boule de laine), Batofu (Nuée de Tofus), Blop Coco Royal (Rebond gluant), Craqueleur Légendaire (Avalanche), Le Chouque (Barriques), Moon (Tambour de Moon), Dragon Cochon (Ronds de fumée), Tofu Royal (Plongeon royal), Crocabulia (Battement d'ailes), Shogun Tofugawa (Trait d'encre)
- Entrée du boss : en arrivant dans sa salle, son portrait s'affiche en grand avec sa stasis, son niveau et ses mécaniques, il rugit, puis saute en place dans un nuage de poussière avant « Combat ! »
- Phases de boss : à 50 % de ses PV, bandeau « Phase 2 », le boss se fissure, s'assombrit et une aura rouge pulse derrière lui ; à 25 %, « Phase 3 », les fissures s'embrasent et il tremble sans arrêt (purement visuel)
- Mort du boss : écran qui blanchit, le boss bascule lourdement et s'efface dans une pluie de kamas et d'étincelles, « Vaincu ! » à son nom
- En mode « Sobres », les boss gardent leur simple bandeau comme avant ; les familles de monstres et les poses des héros arriveront dans un prochain lot
## 0.1.13.3 « Fondations du multijoueur » (bêta)
- Aucun changement en jeu : sauvegarde dans son propre module (prête à passer en ligne), heure et hasard du jeu réglables à un seul endroit, liste officielle des actions du joueur.


## 0.1.13.2 « Classes et donjons » (bêta)
- Tynril et Kankreblath adoucis ; classes plus proches les unes des autres (Xélor, Huppermage, Enutrof, Eniripsa, Éliotrope, Écaflip, Roublard, Ouginak).

## 0.1.13.1 « Dofus à leur place » (bêta)
- Chaque Dofus tombe du boss qui lui correspond dans DOFUS (Cawotte : Tournesol Affamé, Dokoko : Arbre de Moon, Kaliptus : Koulosse, Émeraude : Crocabulia, Turquoise : Dame des Eaux, Domakuro : Maître Corbac, Glaces : Missiz Frizz, Argenté Scintillant : Ilyzaelle) ; les quêtes suivent.

## 0.1.13 « Archimonstres et Dofus » (bêta)
- **Album des archimonstres** (bouton « Âmes ») : les 205 archimonstres par zone ; une **Pierre d'âme** en sac capture l'âme d'un archimonstre vaincu (Bricoleur 25, premier passage des stasis, Bureau des primes). **Parfum de pistage** (×2, 2 h) et meuble **Autel des âmes** (×1,4).
- **Éternelle moisson** : six paliers d'âmes par groupes de zones, récompenses à chaque palier, le **Dofus Ocre** (+1 PA) au bout.
- **Les 18 Dofus** avec leurs vrais bonus, chacun par une quête (Quêtes › Dofus) ou en butin très rare du boss de son donjon (1/1 000 dès la stasis 5) ; copies pour les autres héros chez le Bricoleur (Poussière de stasis). Succès et titres.

## 0.1.12.4 « Sram et Crâ » (bêta)
- Les pièges du Sram frappent dès qu'ils sont posés ; les balises du Crâ ne frappent presque plus et la Flèche Dévorante perd son vol de vie.

## 0.1.12.3 « L'équipement compte » (bêta)
- Monstres plus forts dès le niveau 30 : sans équipement, une équipe perd en chasse et échoue ou passe tout juste la stasis 1 en donjon ; XP et butin par monstre en proportion, gains par heure inchangés pour une équipe bien équipée.

## 0.1.12.2 « Nouvelle adresse » (bêta)
- Le jeu s'ouvre maintenant sur idlus.github.io ; l'ancienne adresse y renvoie et la partie du navigateur suit le joueur.

## 0.1.12.1 « Identité du Phénix » (bêta)
- Un héros rené se reconnaît partout : cadre de feu animé sur sa carte, flammes derrière lui, nom en lettres de feu, foyer sous ses pieds en combat, médaillon dans les listes.

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
