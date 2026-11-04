#!/bin/bash
# Installe ou met à jour le relais Discord sur le serveur OVH (étape « relais-discord » du workflow Serveur OVH).
# Lancé dans GitHub Actions : envoie relais.sh, sortie_sql.js, discord_bot.js et discord_api.js dans /opt/idlus/relais,
# écrit le jeton du robot (secret DISCORD_BOT_TOKEN) dans /opt/idlus/relais/.env (root seul), pose la tâche toutes les 5 min,
# puis fait un premier passage. Aucune donnée de la base n'est modifiée par l'installation elle-même.
set -euo pipefail
[ -n "${DISCORD_BOT_TOKEN:-}" ] || { echo "Secret DISCORD_BOT_TOKEN manquant." >&2; exit 1; }
printf '%s' "$DISCORD_BOT_TOKEN" | grep -Eq '^[A-Za-z0-9._-]+$' || { echo "Jeton inattendu." >&2; exit 1; }
ICI="$(cd "$(dirname "$0")" && pwd)"; R="$ICI/../.."
b() { base64 -w0 "$1"; }
cmd=$(cat <<EOS
set -euo pipefail
D=/opt/idlus/relais; mkdir -p \$D/app; chmod 700 \$D
echo '$(b "$ICI/relais.sh")' | base64 -d > \$D/relais.sh; chmod 700 \$D/relais.sh
echo '$(b "$ICI/sortie_sql.js")' | base64 -d > \$D/app/sortie_sql.js
echo '$(b "$R/discord_bot.js")' | base64 -d > \$D/app/discord_bot.js
echo '$(b "$R/discord_api.js")' | base64 -d > \$D/app/discord_api.js
( umask 077; printf 'DISCORD_BOT_TOKEN=%s\n' '$DISCORD_BOT_TOKEN' > \$D/.env )
command -v flock >/dev/null || { echo "flock absent"; exit 1; }
docker pull -q node:20-alpine >/dev/null
echo '*/5 * * * * root /opt/idlus/relais/relais.sh >> /var/log/idlus-relais.log 2>&1' > /etc/cron.d/idlus-relais; chmod 644 /etc/cron.d/idlus-relais
echo "Relais installé : \$(ls \$D/app | tr '\n' ' ')"
echo "Premier passage :"; \$D/relais.sh
EOS
)
bash "$ICI/../vps_sql.sh" commande "$cmd"
