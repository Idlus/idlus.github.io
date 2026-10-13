#!/bin/bash
# Charge la copie de l'ancienne base dans le nouveau serveur (VPS), puis compare les nombres.
# Lancé en root par le workflow « Serveur OVH », étape « copier », après copier.sh.
# ATTENTION : vide d'abord les données du jeu et les comptes du NOUVEAU serveur (jamais l'ancien).
# Usage : bash restaurer.sh <dossier contenant 0_comptes.sql, 1_structure.sql, 2_donnees.sql>
set -euo pipefail
D="${1:?dossier manquant}"
psqlc() { docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0 -q "$@"; }

echo "== Sauvegarde du nouveau serveur avant chargement"
/opt/idlus/sauvegarde.sh || true

echo "== Remise à zéro du nouveau serveur (données du jeu et comptes)"
psqlc <<'SQL'
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
truncate auth.users cascade;
SQL

n_err=0
for f in 0_comptes.sql 1_structure.sql 2_donnees.sql; do
  echo "== Chargement $f"
  # session_replication_role = replica : pas de déclencheurs pendant le chargement (les données sont déjà calculées)
  err=$( { echo "set session_replication_role = replica;"; cat "$D/$f"; } | psqlc 2>&1 >/dev/null | grep -E "ERROR" || true)
  c=$(printf '%s' "$err" | grep -c ERROR || true)
  echo "erreurs : $c"; [ "$c" -gt 0 ] && printf '%s\n' "$err" | sed -E 's/(DETAIL|Key).*//' | sort | uniq -c | sort -rn | head -15
  n_err=$((n_err + c))
done
while read -r t; do [ -n "$t" ] && echo "alter publication supabase_realtime add table public.\"$t\";"; done < "$D/direct.txt" | psqlc
docker exec supabase-db psql -U supabase_admin -d postgres -qc "notify pgrst, 'reload schema';" >/dev/null

echo "== Nombres sur le nouveau serveur"
docker exec supabase-db psql -U supabase_admin -d postgres -Atc "select 'Comptes : ' || (select count(*) from auth.users) || ' ; identités Discord : ' || (select count(*) from auth.identities where provider='discord') || ' ; parties : ' || (select count(*) from public.saves) || ' ; tables du jeu : ' || (select count(*) from information_schema.tables where table_schema='public') || ' ; fonctions : ' || (select count(*) from pg_proc where pronamespace='public'::regnamespace)"
echo "Total erreurs : $n_err"
rm -rf "$D"
