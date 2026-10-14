#!/bin/bash
# Côté serveur OVH (lancé en root par vps_sql.sh) : exécute un fichier SQL dans la base (conteneur supabase-db),
# avec le rôle qui possède les tables et fonctions du jeu, puis efface le dossier temporaire.
set -uo pipefail
mode="$1"; f="$2"
o=(-U supabase_admin -d postgres -X -v ON_ERROR_STOP=1); e=()
case "$mode" in
  lecture) e=(-e "PGOPTIONS=-c default_transaction_read_only=on"); o+=(-At) ;;
  json) o+=(-At) ;;
  fichier) o+=(-q) ;;
esac
if [ "$mode" = commande ]; then (cd /opt/idlus/supabase && bash "$f"); s=$?
else docker exec -i "${e[@]}" supabase-db psql "${o[@]}" < "$f"; s=$?; fi
rm -rf "$(dirname "$f")"
exit $s
