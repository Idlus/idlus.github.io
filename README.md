# DofousXen

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://mathiss29.github.io/dofousxen/

## Contenu (v2)
- Incarnam et Astrub : 18 sous-zones, 79 monstres et leurs archimonstres, 5 donjons avec leurs vraies clés
- 313 équipements réels (drops et crafts), 38 panoplies, 179 ressources, taux de drop de DOFUS
- Objets Rayonnants (très rares, +10 à +50 % de stats), Emblème du Solitaire (niv. 1 à 1000), brisage et runes
- Stratégies de sorts par zone, historique et rendement par zone, bestiaire

## Structure
- `index.html`, `css/`, `js/` : le jeu (sans dépendance, hébergé sur GitHub Pages)
- `js/gamedata.js` : données générées depuis DofusDB (ne pas modifier à la main)
- `js/data.js` : règles du jeu (classes, sorts, Emblème…) · `js/engine.js` : moteur · `js/ui.js` : interface
- `assets/` : images (monstres `m/`, objets `i/`, sorts `s/`, héros `h/`)
- `tools/import_dofusdb.py` puis `tools/build_data.py` : import et génération des données

## Mentions
Projet de fan gratuit et non commercial, sans lien avec Ankama Games.
DOFUS, ses noms, images et contenus sont la propriété d'Ankama Games. Données : [DofusDB](https://dofusdb.fr).
