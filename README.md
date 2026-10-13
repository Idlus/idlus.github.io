# Idlus

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://idlus.github.io/ (installable sur téléphone et PC)

**Discord :** https://discord.gg/9ApPgWjPUM

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
