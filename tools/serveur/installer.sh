#!/bin/bash
# Installe le serveur en ligne d'Idlus (Supabase auto-hébergé) sur le VPS OVH (Ubuntu 24.04).
# Lancé en root par le workflow « Serveur OVH » (.github/workflows/serveur-ovh.yml), étape « installer ».
# Rejouable sans risque : ce qui est déjà en place est gardé (les clés générées au premier passage ne changent pas).
# Aucun secret ne sort du serveur : les mots de passe et clés privées restent dans /opt/idlus/supabase/.env.
# Usage : bash installer.sh <domaine>      (ex. api.idlus.fr, ou 51-75-1-2.sslip.io sans nom de domaine)
set -euo pipefail
DOMAINE="${1:?domaine manquant}"
ICI="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive
log() { echo "== $*"; }

log "Système : mises à jour et paquets"
apt-get update -q
apt-get -yq -o Dpkg::Options::=--force-confold upgrade
apt-get -yq install ufw fail2ban unattended-upgrades git jq openssl ca-certificates curl cron

log "Pare-feu : seuls SSH (22), HTTP (80) et HTTPS (443) sont ouverts"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null
# Mises à jour de sécurité automatiques du système
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades

mkdir -p /opt/idlus
cd /opt/idlus
if [ ! -f supabase/.env ]; then
  log "Supabase : installation officielle (dernière version auto-hébergée publiée)"
  curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/setup.sh -o setup.sh
  sh setup.sh -y -p supabase
else
  log "Supabase déjà installé : on garde les clés existantes"
fi
cd supabase

regle() { # regle CLE valeur : écrit (ou remplace) une ligne CLE=valeur dans .env
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*$|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
log "Réglages : adresse $DOMAINE, jeu https://idlus.github.io"
regle SUPABASE_PUBLIC_URL "https://$DOMAINE"
regle API_EXTERNAL_URL "https://$DOMAINE/auth/v1"
regle SITE_URL "https://idlus.github.io"
regle ADDITIONAL_REDIRECT_URLS "https://idlus.github.io/**,https://mathiss29.github.io/**,http://localhost:8080/**"
regle PROXY_DOMAIN "$DOMAINE"
regle CERTBOT_EMAIL "admin@$DOMAINE"
# Caddy (HTTPS automatique) + nos réglages
regle COMPOSE_FILE "docker-compose.yml:docker-compose.caddy.yml:docker-compose.idlus.yml"
# Les valeurs Discord sont remplies à l'étape du déménagement ; vides en attendant (connexion Discord inactive)
grep -q '^DISCORD_ENABLED=' .env || { echo "DISCORD_ENABLED=false"; echo "DISCORD_CLIENT_ID="; echo "DISCORD_SECRET="; } >> .env
# Connexion Discord : valeurs envoyées par le workflow (secrets GitHub DISCORD_CLIENT_ID / DISCORD_SECRET), fichier effacé aussitôt
if [ -f "$ICI/discord.env" ]; then
  . "$ICI/discord.env"; shred -u "$ICI/discord.env" 2>/dev/null || rm -f "$ICI/discord.env"
  if [ -n "${D_ID:-}" ] && [ -n "${D_SECRET:-}" ]; then
    regle DISCORD_ENABLED true; regle DISCORD_CLIENT_ID "$D_ID"; regle DISCORD_SECRET "$D_SECRET"
    log "Connexion Discord activée"
  fi
fi
cp "$ICI/docker-compose.idlus.yml" docker-compose.idlus.yml
cp "$ICI/Caddyfile" volumes/proxy/caddy/Caddyfile
# Clé publique (faite pour être dans le code du jeu) lisible sur https://<domaine>/cle-publique
mkdir -p volumes/proxy/caddy/public
grep '^ANON_KEY=' .env | cut -d= -f2- > volumes/proxy/caddy/public/cle.txt
chmod 600 .env

log "Démarrage (le premier passage télécharge les images, quelques minutes)"
docker compose pull -q
docker compose up -d --remove-orphans
docker compose restart caddy >/dev/null   # relit le Caddyfile s'il a changé

log "Sauvegarde de la base chaque nuit à 4 h (14 dernières gardées dans /opt/idlus/sauvegardes)"
install -m 700 "$ICI/sauvegarde.sh" /opt/idlus/sauvegarde.sh
mkdir -p /opt/idlus/sauvegardes && chmod 700 /opt/idlus/sauvegardes
echo "0 4 * * * root /opt/idlus/sauvegarde.sh >> /var/log/idlus-sauvegarde.log 2>&1" > /etc/cron.d/idlus-sauvegarde
timedatectl set-timezone Europe/Paris || true
echo "$DOMAINE" > /opt/idlus/domaine

log "Vérification (jusqu'à 3 minutes, le temps du certificat HTTPS)"
CLE_PUB=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
ok=""
for i in $(seq 1 36); do
  if curl -fsS -m 5 "https://$DOMAINE/auth/v1/health" -H "apikey: $CLE_PUB" >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
if [ -z "$ok" ]; then echo "Le serveur ne répond pas encore en HTTPS sur https://$DOMAINE (le domaine pointe-t-il vers ce serveur ?)" >&2; exit 1; fi
log "OK : https://$DOMAINE répond"
echo "Clé publique : https://$DOMAINE/cle-publique"
