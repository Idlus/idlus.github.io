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

**Coûts (à compléter).** VPS OVH VPS-3 (coût mensuel à noter ici), nom de domaine : aucun, services payants : aucun connu. Le temps de développement est le coût principal.

## 5. Décisions prises (les plus structurantes)

- Visuels DOFUS 3 uniquement (pas de dessins faits main), thème Émeraude par défaut, musique originale.
- Équilibrage vérifié par simulation (sans équipement jusqu'à la stasis 4, bon équipement 6-7, équipes optimisées 10). Préférer les changements de sorts et de mécaniques aux bonus en pourcentage par classe.
- Pas de version bêta séparée : tests (PC 1280 px, téléphone 390 px) puis publication directe sur `main`, note Discord et annonce en jeu sans redemander (22/10).
- Serveur, base de données, sauvegardes des joueurs, remises à zéro, posts X : les mots écrits de Mathis sont obligatoires.
- Seul Mathis décide qui triche ; le Bouclier est la seule protection des sauvegardes.
- Dofus : quête (1 par compte), butin de boss, codes ; aucun bonus sur leurs chances.
- Pas de jetons de challenge.
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
- **Triche :** les sauvegardes sont modifiables côté joueur ; tout repose sur le Bouclier du serveur et sur les décisions de Mathis.
- **Dépendance à une seule personne :** Mathis valide tout, en plein temps ; risque de fatigue (il a demandé le 22/10 au soir moins de messages éparpillés).

## 8. Prochaines priorités

1. **Stabiliser (accord de Mathis, 22/10) :** corriger les tickets graves du tri, regrouper les publications en lots plutôt qu'une version par petite modification.
2. **Suivre la rétention** quelques jours (rapport du serveur), puis agir là où les joueurs partent : prise en main avant le niveau 50, objectifs au niveau 200.
3. Ensuite : acquisition hors Discord.

**Revenus : en attente (décision de Mathis, 22/10).** Pas de piste de revenus pour l'instant, donc pas de demande à Ankama sur les dons pour le moment.

Chantiers en cours au 22/10 : refonte des menus publiée en 2.1.40 (5 familles, onglets réunis, barre du haut avec cloche et compte, visuel plus calme ; « Affichage détaillé » remet l'ancien), maquettes suivantes : déblocage progressif par chapitres et réduction des monnaies ; fin de l'observation du Bouclier Monocompte le 24/10 à 11:00 UTC ; extraction des animations DOFUS 3 sur le PC de Mathis arrêtée (programmes prêts, 8 animations par classe retenues, accord d'Ankama à confirmer pour un dépôt public).
