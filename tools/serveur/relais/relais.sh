#!/bin/bash
# Relais Discord sur le serveur OVH (04/11/2026, Mathis « vas-y ») : toutes les 5 minutes (cron /etc/cron.d/idlus-relais),
# publie dans #idées les idées envoyées depuis le jeu et ouvre dans #bugs le fil de chaque bug signalé.
# Les workflows GitHub « Suggestions vers Discord » et « Bugs signalés » restent en secours (ils ne prennent que ce qui attend
# depuis plus de 15 minutes) ; les tickets GitHub des bugs restent faits par « Bugs signalés ».
# Installé par l'étape « relais-discord » du workflow Serveur OVH dans /opt/idlus/relais (jeton du robot dans .env, root seul).
set -uo pipefail
D=/opt/idlus/relais; cd "$D" || exit 1
exec 9>"$D/.verrou"; flock -n 9 || exit 0 # un seul passage à la fois
set -a; . "$D/.env"; set +a
[ -n "${DISCORD_BOT_TOKEN:-}" ] || { echo "$(date -Is) jeton absent"; exit 1; }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT; chmod 755 "$W"
q() { docker exec -i supabase-db psql -U supabase_admin -d postgres -X -At -v ON_ERROR_STOP=1 -c "$1"; }
q "select coalesce(json_agg(t), '[]') from (select id, tag, title, body, pseudo, info, (user_id is null) as guest from public.ideas where relayed_at is null and not hidden order by id limit 10) t" > "$W/idees.json" || exit 1
q "select coalesce(json_agg(t), '[]') from (select id, pseudo, version, page, device, what, expected, issue, (user_id is null) as guest from public.bugs where discord is null and status in ('nouveau', 'transmis', 'en_cours', 'a_voir') and created_at > now() - interval '3 days' order by id limit 10) t" > "$W/bugs.json" || exit 1
[ "$(cat "$W/idees.json")" = "[]" ] && [ "$(cat "$W/bugs.json")" = "[]" ] && exit 0
docker run --rm --network host -e DISCORD_BOT_TOKEN -v "$D/app:/app:ro" -v "$W:/w" node:20-alpine sh -c \
  'cd /w; [ "$(cat idees.json)" = "[]" ] || DISCORD_SORTIE=/w/idees_ok.json node /app/discord_bot.js suggestions /w/idees.json;
   [ "$(cat bugs.json)" = "[]" ] || DISCORD_SORTIE=/w/bugs_ok.json node /app/discord_bot.js bugs /w/bugs.json;
   node /app/sortie_sql.js /w > /w/maj.sql'
s=$?
if [ -s "$W/maj.sql" ]; then docker exec -i supabase-db psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 < "$W/maj.sql" || s=1; fi
echo "$(date -Is) idées $(grep -c 'ideas' "$W/maj.sql" 2>/dev/null || echo 0), bugs $(grep -c 'bugs' "$W/maj.sql" 2>/dev/null || echo 0), code $s"
exit $s
