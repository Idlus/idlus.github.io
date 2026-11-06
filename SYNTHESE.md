# Idlus — synthèse du projet

Fichier de continuité (cadre de travail de Mathis, 22/10/2026). Court, mis à jour à chaque étape importante.
Les détails (historique, notes techniques) restent dans `README.md`, `CLAUDE.md` et les nouveautés du jeu.
Légende : **[fait]** vérifié dans le code ou les relevés du serveur, **[hyp.]** hypothèse à tester.

*Dernière mise à jour : 22/10/2026 (soir), version en ligne 2.1.39.1.*

## 1. Objectif

- Un jeu navigateur idle / autobattler inspiré de DOFUS, agréable, techniquement fiable, et à terme économiquement rentable.
- La rentabilité est un objectif à valider par des résultats, jamais une promesse.
- **Contrainte forte :** Ankama autorise les ressources de DOFUS 3 « tant qu'il n'y a pas d'achat intégré ». Tout l'univers visuel du jeu en dépend. Aujourd'hui, Idlus est un jeu de fan gratuit, sans rien de payant.

## 2. Stade du projet : premiers joueurs

- **[fait]** Jeu public en ligne depuis le 12/10, serveur auto-hébergé (Supabase sur un VPS OVH) depuis le 14/10.
- **[fait]** 110 comptes au 22/10 au soir. Le 22/10 : 63 joueurs actifs dans la journée, jusqu'à 42 sur une heure, environ 1 260 messages de chat, 6 nouveaux comptes. Les jours précédents : 51 à 63 actifs par jour, 1 à 11 nouveaux comptes par jour.
- **[fait]** Second serveur « Monocompte » (1 héros par saison, groupes) en bêta fermée depuis le 21/10.
- **[fait]** Communauté sur Discord, très impliquée (idées et tickets de bug cités dans les nouveautés).
- Le jeu n'est donc plus un prototype : la question n'est plus « la boucle donne-t-elle envie ? » pour les joueurs actuels, mais « les nouveaux restent-ils, et pourquoi partent-ils ? ».

## 3. La boucle principale tient-elle ?

- **Boucle :** les héros combattent seuls (chasse, donjons) → butin, kamas, XP → équipement, sorts, métiers → stasis plus hautes et classements → recommencer plus fort.
- **[fait]** Pour le noyau de joueurs, oui : environ 60 actifs par jour pour 110 comptes, présence la nuit et en journée, chat très actif, idées de joueurs livrées presque chaque jour.
- **[fait]** Mesure de rétention dans le rapport du serveur depuis le 22/10 (premier relevé, 21:11 UTC) :
  - 42 des 49 comptes créés il y a 2 à 8 jours sont revenus jouer un autre jour (86 %) ;
  - 29 des 59 comptes de 8 à 30 jours ont joué dans les 48 dernières heures (49 %) ;
  - 37 comptes partis (plus de 3 jours sans jouer) : niveau médian du héros principal 49, 2 h de jeu médianes ; 9 avant le niveau 20, 9 entre 20 et 59, 7 entre 60 et 119, 2 entre 120 et 199, 7 au niveau 200.
- **[hyp.]** Deux moments de départ ressortent : tôt (la moitié des partis avant le niveau 49 et 2 h de jeu, piste : prise en main) et en fin de jeu (7 au niveau 200, piste : manque d'objectifs). Chiffres encore petits, à suivre sur plusieurs jours.
- **[hyp.]** La masse de systèmes (voir §4) rend probablement la prise en main difficile, malgré le guide et l'accueil.

## 4. État actuel

**Contenu (fait).** Niveaux 1 à 200, toutes les classes, stasis 1 à 15 avec boss ultimes, Dofus et quêtes, Maîtrise, Ascension, Songe, Kolizéum asynchrone, Hôtel des ventes, guildes et boss de guilde, alliances, alignements, familiers, montures et élevage, forgemagie, métiers et récolte, Havre-Sac, Almanax, défi du jour, codes cadeaux, chat, classements, Monocompte (saisons, pass, Bureau, mercenaires).

**Technique (fait).**
- JavaScript sans build : 108 fichiers dans `js/` (environ 8,7 Mo avec les données), dont `js/ui.js` 1,7 Mo et `js/engine.js` 0,4 Mo.
- Serveur : 37 fichiers SQL dans `supabase/`, une fonction de contrôle des records, un « Bouclier » qui vérifie les sauvegardes (seule protection contre la triche, les sauvegardes étant modifiables côté joueur).
- 106 fichiers de test (`npm test`, plus de 10 minutes), garde-fou de publication, 19 automatisations GitHub (Discord, rapport horaire du serveur, bugs signalés, serveur).
- Sauvegarde du serveur chaque nuit à 04:00 (14 gardées) et avant chaque intervention.

**Rythme (fait).** 451 versions publiées depuis le 12/10, dont environ 25 le 22/10 (de 2.1.36 à 2.1.39.1). Chaque publication part sur Discord et souvent en annonce dans le jeu.

**Social (fait, 05/11, 2.2.10).** Toucher un pseudo, partout dans le jeu, ouvre la fiche du joueur (héros dessiné, titre, en ligne, camp, actions) ; le Monocompte a sa propre fiche (fonction `mono_fiche`, jamais le Classique). Idée de Panda, choix 1A 2A 3A 4A de Mathis.

**Coûts (à compléter).** VPS OVH VPS-3 (coût mensuel à noter ici), nom de domaine : aucun, services payants : aucun connu. Le temps de développement est le coût principal.

## 5. Décisions prises (les plus structurantes)

- Visuels DOFUS 3 uniquement (pas de dessins faits main), thème Émeraude par défaut, musique originale.
- Équilibrage vérifié par simulation (sans équipement jusqu'à la stasis 4, bon équipement 6-7, équipes optimisées 10). Préférer les changements de sorts et de mécaniques aux bonus en pourcentage par classe.
- Pas de version bêta séparée : tests (PC 1280 px, téléphone 390 px) puis publication directe sur `main`, note Discord et annonce en jeu sans redemander (22/10).
- Serveur, base de données, sauvegardes des joueurs, remises à zéro, posts X : les mots écrits de Mathis sont obligatoires.
- Seul Mathis décide qui triche ; le Bouclier est la seule protection des sauvegardes.
- Modération (2.2.2, 03/11) : Mathis nomme seul les modérateurs (Panel › Équipe en jeu, rôle à la main sur Discord). Un modo supprime un message public, avertit en privé, rend muet 24 h au plus, jamais sur Mathis ni un autre modo ; pas de bannissement, de suspension, ni d'accès aux sauvegardes ou aux kamas. Ses actions arrivent dans #modération. La triche reste du ressort de Mathis.
- Dofus : quête (1 par compte), butin de boss, codes ; aucun bonus sur leurs chances.
- Pas de jetons de challenge.
- Combat : la grille tactique est mise de côté pour la Saison 1 ; le combat idle est enrichi par les annonces du boss et les parades (2.1.42, 02/11). Mesure à suivre : le taux de parades.
- Répartition des rôles : ChatGPT conçoit, Claude analyse, réalise et vérifie, Mathis tranche.
- Rien de payant tant que Mathis n'a pas décidé autrement, et rien qui ressemble à un achat intégré (contrainte Ankama).

## 6. Hypothèses à tester

| Hypothèse | Comment la vérifier |
|---|---|
| Les nouveaux joueurs abandonnent tôt (prise en main trop lourde). | Rapport du serveur : « nouveaux revenus un autre jour », « partis par niveau ». Une amélioration de la prise en main devrait faire baisser les départs avant le niveau 50. |
| Le rythme de publication très élevé crée des régressions et fatigue les joueurs. | Nombre de tickets ouverts par version ; nombre de correctifs « .x » qui suivent une version ; avis sur Discord. |
| Le Monocompte attire des joueurs différents du Classique. | Comptes qui jouent seulement en Monocompte, rétention sur une saison. |
| Des dons sans contrepartie (Ko-fi, Tipeee) suffiraient à couvrir l'hébergement (mis de côté : revenus en attente). | D'abord l'accord écrit d'Ankama, puis un lien de dons discret et le montant reçu sur 1 mois face au coût du VPS. |
| Le jeu peut grandir hors du Discord actuel. | Comptes créés par semaine selon la source (lien Discord, X, bouche-à-oreille). |

## 7. Problèmes connus

- **Rentabilité et Ankama :** toute vente dans le jeu (boutique, abonnement, objets) peut faire perdre le droit d'utiliser les ressources DOFUS 3. Même les dons sont à faire confirmer par Ankama. L'accord ne dit pas clairement si l'extraction du client DOFUS 3 est couverte.
- **Tickets de bug :** 13 ouverts au 22/10 au soir après le tri (9 fermés : 8 déjà corrigés, 1 qui n'était pas un bug). Les fils commentaient « Corrigé dans la … » sans fermer le ticket. Le tri complet est dans `/mnt/project-files/synthese/tri-tickets-2210.md` (dossier du projet).
- **Complexité :** `js/ui.js` à 1,7 Mo, beaucoup de systèmes qui se croisent (Classique / Monocompte, HdV, Bouclier). Les fuites de kamas du Classique vers le Monocompte (22/10) en sont un exemple.
- **Audit du 05/11 (2.2.8.8) [fait] :** aucune grosse faille. Les joueurs ne peuvent écrire en base que par les fonctions du serveur (sauf pseudo et liste d'ignorés) ; HdV, vente et échanges bloqués si le compte est signalé ; 0 erreur sur toutes les pages (3 serveurs, PC et téléphone). Restent ouverts : #122 (verrouiller l'équipement), #128 (contenu), #154 et #156 (chat, non reproduits), #126 #127 #167 (comptes à voir par Mathis dans le panel). Le compteur de la campagne Monocompte est déclaré par le client (impact faible).
- **Flotte d'apprentis (2.2.9, 05/11) [fait] :** idée d'un joueur. En Monocompte, jusqu'à 5 apprentis récolteurs (un par métier) : rangs en kamas (50 à 70 %), talents par l'expérience (niveaux 3/6/9), déblocage niveau du héros + quête + kamas. Simulation : 5 métiers au 100 + 1 spécialité au 200 en 3,6 à 5 jours au lieu de 13. À vérifier : prix de l'HdV Monocompte des ressources et utilisation réelle des apprentis après une semaine.
- **Bombes du bon élément (2.2.9.4, 05/11) [fait] :** retour de Mathis. Sorts auto : le Roublard prend la bombe de son élément (avant toujours l'Explobombe). Les invocations frappent avec la caractéristique la plus forte du héros (avant : celle de la classe, donc ~0 pour un Osamodas Air ou un Roublard Terre). Rien ne change pour un héros joué dans l'élément de sa classe.
- **Absence comptée en trop (2.2.10.2, 06/11) [corrigé] :** signalé par le modérateur Likie (rechargement pendant l'envoi : « 40 h d'absence »). Une heure du jeu restée en retard (veille, serveur injoignable au réveil) passait pour une absence au rechargement, Sablier compris. L'absence comptée est maintenant la plus petite entre l'heure du serveur et celle de l'appareil. Relevé serveur du 06/11 : aucune partie envoyée avec une heure décalée sur 3 jours. À confirmer avec Likie (quelle partie, est-ce que ça se refait). Vu au passage : en Monocompte, beaucoup de parties refusées par le Bouclier pour « honneur au jour » (Likie, Sac, Nerisia, Takkar) depuis le 05/11 19 h : sans doute une limite trop basse, à vérifier.
- **Triche :** les sauvegardes sont modifiables côté joueur ; tout repose sur le Bouclier du serveur et sur les décisions de Mathis.
- **Dépendance à une seule personne :** Mathis valide tout, en plein temps ; risque de fatigue (il a demandé le 22/10 au soir moins de messages éparpillés).

## 8. Prochaines priorités

**03/11/2026 : Saison 1 ouverte à 23h10 sur les deux serveurs (2.2.0).** Le Classique a sa partie Saison 1 (schéma s1), le Monocompte sort de la bêta (héros de la bêta dans l'Éternel). Trois chats : Saison 1, Éternel, Monocompte. À suivre : inscriptions et parties de saison la première semaine, relevé d'équilibrage en fin de semaine 1, cartes Légendes et chat de guilde en Monocompte plus tard.

**04/11 : objectifs qui ne bougeaient pas (2.2.7.3, signalé par Mathis).** « Premiers outils » ne comptait que les spécialités (0 sans spécialité ou en Ironman) : il compte tous les métiers. Hauts faits de groupe et Duelliste comptés, familles débloquées, succès impossibles en Monocompte cachés. Limite : audit fait dans le code (compteurs lus et jamais écrits, événements jamais émis), pas encore sur les sauvegardes des joueurs.

**04/11 : renfort d'un ami payant (2.2.7.1, Mathis option A).** Le renfort était gratuit et souvent plus fort que le mercenaire à 25 000 kamas : plus personne n'avait de raison de payer le mercenaire. Il coûte maintenant le même prix par donjon, kamas détruits, rien pour l'ami. À suivre : nombre de renforts pris (compteur d'aides) avant / après. Idée en attente : prix du mercenaire selon le niveau (25 000 kamas = 30 min de chasse au niveau 20).

**04/11 : album de cartes refait (2.2.6, Mathis 1A 2A 3A 4A 5A 6A).** Bandeau de progression, sections par rareté, manquantes en gris avec ⚒ si fabricable, fiche complète qu'on feuillette, « Nouvelle » après un booster ; page téléphone 8 500 → 5 300 px. Mathis veut ensuite de vraies nouveautés pour l'album : maquette à suivre (aucune ne doit donner de puissance).

**04/11 : panel de l'équipe par serveur (2.2.4, Mathis 1A 2A 3A + idée 1).** Accueil « Ce qui t'attend », quatre cases (Éternel, Saison 1, Monocompte, Tous les serveurs) au même menu, une seule page « Annoncer » avec les serveurs cochés. Une annonce sur une partie seulement des serveurs (ex. Éternel + Saison 1) attend l'installation de `adm_announce_srv` (supabase/annonces_srv.sql) sur le serveur, avec l'accord écrit de Mathis. Idées gardées pour plus tard : fermer le chat serveur par serveur, journal des actions avec le serveur.

**03/11 : mode Ironman du Monocompte (2.2.1.1, Mathis 1C 2A 3A 4A).** Retour d'un joueur : 3 métiers 200 trop limitant pour jouer seul. Mode au choix : 12 métiers à 200 contre pas d'HdV, d'échange ni de renfort. À mesurer : combien de joueurs le prennent. Badge au classement et au salon : SQL prêt, pas installé.

1. **Stabiliser (accord de Mathis, 22/10) :** corriger les tickets graves du tri, regrouper les publications en lots plutôt qu'une version par petite modification.
2. **Suivre la rétention** quelques jours (rapport du serveur), puis agir là où les joueurs partent : prise en main avant le niveau 50, objectifs au niveau 200.
3. Ensuite : acquisition hors Discord.

**Revenus : en attente (décision de Mathis, 22/10).** Pas de piste de revenus pour l'instant, donc pas de demande à Ankama sur les dons pour le moment.

Chantiers en cours au 22/10 : refonte des menus publiée en 2.1.40 (5 familles, onglets réunis, barre du haut avec cloche et compte, visuel plus calme ; « Affichage détaillé » remet l'ancien), maquettes suivantes : déblocage progressif par chapitres et réduction des monnaies ; fin de l'observation du Bouclier Monocompte le 24/10 à 11:00 UTC ; extraction des animations DOFUS 3 sur le PC de Mathis arrêtée (programmes prêts, 8 animations par classe retenues, accord d'Ankama à confirmer pour un dépôt public).
