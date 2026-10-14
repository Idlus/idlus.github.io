#!/bin/bash
# Requêtes SQL sur la base du serveur OVH, depuis GitHub Actions (remplace l'API « database/query » de Supabase).
# Variables : HOTE, UTIL, SSHPASS, SSHO (posées par l'action .github/actions/vps).
# Usage :
#   bash tools/serveur/vps_sql.sh json "<requête>"      → lignes du résultat en JSON (tableau, comme l'API de Supabase)
#   bash tools/serveur/vps_sql.sh lecture "<requête>"   → idem, la base refuse toute écriture de cette session
#   bash tools/serveur/vps_sql.sh fichier <fichier.sql> → exécute un fichier SQL (arrêt à la première erreur)
#   bash tools/serveur/vps_sql.sh commande "<cmd>"      → commande en root sur le serveur (dossier /opt/idlus/supabase)
set -euo pipefail
mode="${1:?mode manquant}"; arg="${2:?requête manquante}"
ICI="$(cd "$(dirname "$0")" && pwd)"
loc=$(mktemp -d); trap 'rm -rf "$loc"' EXIT
case "$mode" in
  json|lecture) printf 'with t as (\n%s\n) select coalesce(json_agg(t), '"'"'[]'"'"') from t;\n' "${arg%;}" > "$loc/q.sql" ;;
  fichier) cp "$arg" "$loc/q.sql" ;;
  commande) printf '%s\n' "$arg" > "$loc/q.sql" ;;
  *) echo "mode inconnu : $mode" >&2; exit 2 ;;
esac
cp "$ICI/sql_distant.sh" "$loc/"
dist=$(sshpass -e ssh $SSHO "$UTIL@$HOTE" 'mktemp -d /tmp/idlus-sql.XXXXXX')
sshpass -e scp -q $SSHO "$loc/q.sql" "$loc/sql_distant.sh" "$UTIL@$HOTE:$dist/"
if [ "$UTIL" = root ]; then
  sshpass -e ssh $SSHO "root@$HOTE" "bash $dist/sql_distant.sh $mode $dist/q.sql"
else
  # sudo lit le mot de passe sur la première ligne (jamais affiché)
  printf '%s\n' "$SSHPASS" | sshpass -e ssh $SSHO "$UTIL@$HOTE" "sudo -S -p '' bash $dist/sql_distant.sh $mode $dist/q.sql"
fi
