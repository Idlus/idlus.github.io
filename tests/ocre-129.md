# Ticket #129 — Dofus Ocre

Base : `origin/main`, révision `2c945c2`. Branche : `codex/fix-129-ocre`.

Cause : `checkOcre` récompense le sixième palier, mais `advance` ignore les étapes `ocre`. L'indicateur `dofusQ.ocre.done` reste donc à zéro. La collection conserve la quête et affiche `ocreTier + 1`, soit 7 sur 6.

Correction : lors de la lecture de la quête, reconnaître les six paliers déjà récompensés, terminer son étape et renseigner sa date de fin si elle manque. Cette réparation fonctionne pour les parties existantes et les nouvelles. Elle ne donne aucun objet ni kamas. Posséder un Ocre obtenu en butin ne termine pas la moisson.

Reproduction : `node tests/ocre-ui.test.js` sur le code avant correction échoue avec « Dofus Ocre / Éternelle moisson · palier 7 sur 6 » dans `.du-todo`. Après correction, ce test passe en navigateur Chromium (Edge), en PC 2844×1412 et en émulation mobile tactile 390×844. Il utilise une partie synthétique, bloque les requêtes externes et les service workers, et vérifie la fiche terminée à 100 %, l'absence de palier 7/6 et la stabilité des récompenses.

`node tests/ocre.test.js` couvre également la récompense des six paliers, les anciennes parties avec ou sans entrée de quête, la relecture après sérialisation et le butin seul. Les deux tests sont intégrés aux commandes existantes `test:fight` et `test:smoke`.

Aucune sauvegarde réelle utilisée. Aucun déploiement, changement serveur ou base, annonce ni modification de main. La validation mobile est une émulation navigateur, pas un essai sur appareil physique.

Validation complémentaire : tests quêtes et collections, syntaxe des 197 fichiers JavaScript et garde-fou réussis. La suite `test:fight` rencontre un échec dans `vente.test.js:108` (égalité du fichier SQL des prix), reproduit avec `archis.js` d'origine ; aucun fichier SQL n'a été modifié pour cette correction.

Les 24 tests suivants ont aussi été exécutés : 22 réussissent ; `bouclier_serveur.test.js` échoue sur un import ESM de chemin Windows (`c:`) et `post_discord.test.js` sur l'assertion « déjà annoncée ». Ces deux tests ne chargent pas le code de quête modifié. La suite générale n'est donc pas entièrement verte dans cet environnement.
