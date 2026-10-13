# Idlus

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://idlus.github.io/ (installable sur téléphone et PC)

**Discord :** https://discord.gg/9ApPgWjPUM

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
