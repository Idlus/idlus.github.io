# 2.2.14.3 (Mathis 08/11, « le 1 et 2 ») : arrête les services de Supabase que le jeu n'utilise pas, ou les remet en route.
#   Studio (tableau de bord, non exposé sur internet), pg-meta (utilisé seulement par Studio), Storage (0 octet stocké) et imgproxy (pour Storage).
#   « docker compose stop » : ils restent arrêtés après un redémarrage de la machine ; « installer » ou « rallumer-services » les relance.
# Lancé par : bash tools/serveur/vps_sql.sh commande "ACTION=arreter; $(cat tools/serveur/alleger.sh)"  (ou ACTION=rallumer)
set -euo pipefail
SV="studio meta storage imgproxy"
if [ "${ACTION:-}" = rallumer ]; then docker compose up -d $SV >/dev/null 2>&1; echo "Services remis en route : $SV"
elif [ "${ACTION:-}" = arreter ]; then docker compose stop $SV >/dev/null 2>&1; echo "Services arrêtés : $SV"
else echo "ACTION inconnue" >&2; exit 2; fi
sleep 5
docker compose ps -a --format '{{.Service}} {{.Status}}' | sort
D=$(cat /opt/idlus/domaine); K=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
for u in auth/v1/health rest/v1/ functions/v1/record; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X "$( [ "$u" = functions/v1/record ] && echo OPTIONS || echo GET )" "https://$D/$u" -H "apikey: $K" || echo 000)
  echo "jeu : /$u → $c"
done
free -m | awk 'NR==2 {print "mémoire utilisée : " $3 " Mo sur " $2}'
