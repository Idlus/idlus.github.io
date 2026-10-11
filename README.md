# DofousXen

Idle / autobattler inspiré de DOFUS, jouable dans le navigateur (PC et mobile).
Vos héros combattent automatiquement : à vous d'optimiser leur équipement, leurs sorts et leurs stratégies.

**Jouer :** https://mathiss29.github.io/DofousXen/

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
