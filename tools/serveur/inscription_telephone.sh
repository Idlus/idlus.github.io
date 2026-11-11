# 11/11/2026 (fil « Vérifier la sécurité des données du jeu ») : coupe l'inscription par téléphone.
# Supabase l'active par défaut, avec confirmation automatique (sans SMS) : n'importe qui pouvait créer des comptes à la chaîne
# avec un faux numéro, sans passer par Discord. Le jeu n'utilise que Discord (0 compte par téléphone au 11/11).
# Seul le service de connexion (auth) redémarre, quelques secondes ; les joueurs connectés le restent.
# Lancé par : bash tools/serveur/vps_sql.sh commande "$(cat tools/serveur/inscription_telephone.sh)"
set -euo pipefail
regle() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*$|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
regle ENABLE_PHONE_SIGNUP false
regle ENABLE_PHONE_AUTOCONFIRM false
regle ENABLE_ANONYMOUS_USERS false
grep -E '^ENABLE_(PHONE_SIGNUP|PHONE_AUTOCONFIRM|ANONYMOUS_USERS|EMAIL_SIGNUP)=' .env
docker compose up -d auth >/dev/null 2>&1
sleep 8
D=$(cat /opt/idlus/domaine); K=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
curl -s -m 10 "https://$D/auth/v1/settings" -H "apikey: $K" | grep -oE '"(phone|discord|email|anonymous_users)":(true|false)|"phone_autoconfirm":(true|false)' | tr '\n' ' '; echo
echo "santé : $(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$D/auth/v1/health" -H "apikey: $K")"
