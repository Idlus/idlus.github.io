# idlus — notes pour Claude

Idle game de fan inspiré de DOFUS, par Mathis. Jeu : https://idlus.github.io/ (ancienne adresse mathiss29.github.io/idlus, redirigée) · dépôt : idlus/idlus.github.io.

## Fonctionnement
- SPA en JavaScript sans build : `index.html`, `css/style.css`, `js/gamedata.js`, `js/looks.js`, `js/data.js`, `js/engine.js` (combat, stasis, équilibrage), `js/systems.js`, `js/ui.js` (rendu, CHANGELOG, GAME_VERSION).
- Sauvegarde dans localStorage sous la clé `dofousxen-save` (ne pas renommer). Migrations via `E.VERSION` dans engine.js.
- PWA : `sw.js` (VERSION = version du jeu ; MEDIA = cache des images, à incrémenter si une image change de contenu sans changer de nom), `manifest.webmanifest`, `icons/`.
- Visuels : `assets/look` (héros en pied, rendus Ankama ; le Forgelance vient du rendu « kool » de DofusDB, voir `forgeLook` dans ui.js), `assets/ui` (icônes officielles), `assets/m`, `assets/s`, `assets/i`.
- Thèmes : `data-theme="emerald"` (défaut) et `"dark"` (Nuit violette).

## Publier une version
1. `GAME_VERSION` + entrée `CHANGELOG` dans `js/ui.js`, `version.json`, `?v=` dans `index.html`, `VERSION` dans `sw.js`, section du README.
2. `node tools/export_changelog.js` (met à jour `changelog.json`).
3. Tester PC (1280 px) et mobile (390 px) avec Playwright, sans erreur console.
4. Commit (message en français), push sur `main`, vérifier que `version.json` est en ligne.
5. Annonce Discord : `node tools/post_discord.js <version> --print` puis envoi au webhook (jamais dans le dépôt).
6. Récap en français à Mathis.

## Préférences de Mathis
- Échanges en français ; il valide les grosses mises à jour (souvent sur maquette) avant le développement.
- Équilibrage vérifié par simulation (stasis : sans équipement jusqu'à la stasis 4, bon équipement stasis 6-7, stasis 10 pour les équipes optimisées).
- Pas de jetons de challenge.
- Ne jamais committer de captures d'écran de test ni de secrets (webhook Discord).
