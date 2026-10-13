#!/bin/bash
# Copie la base de l'ancien serveur Supabase (lecture seule) dans des fichiers SQL, côté GitHub.
# Lancé par le workflow « Serveur OVH », étape « copier ». Rien n'est écrit sur l'ancienne base :
# on demande à Supabase un accès temporaire (le même mécanisme que « supabase db dump ») et toutes les requêtes
# passent en mode lecture seule (default_transaction_read_only : la base refuse toute écriture de cette session).
# Accord écrit de Mathis le 14/10/2026 (fil « Alternatives à Supabase »).
# Les fichiers contiennent des données de joueurs : jamais publiés, ils partent directement sur le VPS puis sont effacés.
# Usage : bash copier.sh <dossier>     (variables : SUPABASE_ACCESS_TOKEN, PROJECT_REF)
set -euo pipefail
OUT="${1:?dossier manquant}"
mkdir -p "$OUT"
API="https://api.supabase.com/v1/projects/$PROJECT_REF"
H=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")

echo "== Accès temporaire (sessions en lecture seule)"
# Le rôle « read_only » de Supabase ne peut pas lire les comptes ni les tables du jeu : on prend le rôle normal
role=$(curl -sS -m 60 -X POST "$API/cli/login-role" "${H[@]}" --data '{"read_only":false}')
R=$(echo "$role" | jq -r '.role // empty'); P=$(echo "$role" | jq -r '.password // empty')
[ -n "$R" ] && [ -n "$P" ] || { echo "Accès refusé : $(echo "$role" | head -c 300)" >&2; exit 1; }
echo "::add-mask::$P"
pool=$(curl -sS -m 60 "$API/config/database/pooler" "${H[@]}")
HOST=$(echo "$pool" | jq -r '[.[] | select(.database_type=="PRIMARY")][0].db_host // .[0].db_host // empty')
[ -n "$HOST" ] || { echo "Adresse du pooler introuvable : $(echo "$pool" | head -c 300)" >&2; exit 1; }
export PGHOST="$HOST" PGPORT=5432 PGUSER="$R.$PROJECT_REF" PGPASSWORD="$P" PGDATABASE=postgres PGCONNECT_TIMEOUT=30 PGOPTIONS="-c default_transaction_read_only=on"
# Le rôle met quelques secondes à être connu du pooler
for i in $(seq 1 12); do psql -Atqc "select 1" >/dev/null 2>&1 && break; sleep 5; done
psql -Atqc "select 'Postgres ' || current_setting('server_version')"
# Comme l'outil officiel (« SET SESSION ROLE postgres ») : le rôle temporaire agit en tant que postgres
q() { psql -Atq -c "set session role postgres" -c "$1"; }
echo "Comptes : $(q 'select count(*) from auth.users') ; parties : $(q 'select count(*) from public.saves')"

echo "== Copie (structure du jeu, puis données du jeu, puis comptes)"
pg_dump --role=postgres --schema-only --schema=public --no-owner -f "$OUT/1_structure.sql"
pg_dump --role=postgres --data-only --schema=public --no-owner -f "$OUT/2_donnees.sql"
pg_dump --role=postgres --data-only --no-owner -t auth.users -t auth.identities -f "$OUT/0_comptes.sql"
# Tables suivies en direct (chat…) : la liste est refaite à la main sur le nouveau serveur
q "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'" > "$OUT/direct.txt"
echo "Tables en direct : $(tr '\n' ' ' < "$OUT/direct.txt")"
ls -la "$OUT" | awk 'NR>1 {print $5, $9}'
