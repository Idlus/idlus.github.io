# Diablofus passe à 2 cœurs (bloc « À installer » de serveur/LISEZMOI.md du dépôt Mathiss29/dofus-diablo, PR #396, 15/11/2026).
# Seul changement du service : FILS=2 et CPUQuota=200 %. Mémoire inchangée (2 Go). Lancé en root par l'étape « diablofus-2-coeurs ».
# Ne touche ni à Docker, ni à Caddy, ni à la base d'Idlus. Rejouable.
set -euo pipefail
s() { echo; echo "== $*"; }
# Fichier pris au commit relu (fusion de #396), empreinte vérifiée
URL=https://raw.githubusercontent.com/Mathiss29/dofus-diablo/617f27096d334056655f32f244ce637a2bbc6287/serveur/installation/diablofus.service
avant=$(docker ps -q | wc -l)
T=$(mktemp -d); cd "$T"
curl -fsSL -o diablofus.service "$URL"
echo "a7e132ca77710a19917185633bc10062f2025d6ec863a66f11142c0357426cd3  diablofus.service" | sha256sum -c -

s "Avant"
systemctl show diablofus -p ActiveState -p CPUQuotaPerSecUSec -p MemoryMax -p MemoryCurrent
diff /etc/systemd/system/diablofus.service diablofus.service || true

if cmp -s diablofus.service /etc/systemd/system/diablofus.service; then
  echo "service déjà à jour : rien à faire"
else
  s "Sauvegarde (fichier du service + données Diablofus, service arrêté pour une copie propre)"
  d=/root/sauvegardes/diablofus-$(date -u +%Y%m%d-%H%M%S); install -d -m 700 "$d"
  cp -a /etc/systemd/system/diablofus.service "$d/diablofus.service.avant"
  du -sh /home/diablofus/donnees
  install -m 644 diablofus.service /etc/systemd/system/diablofus.service && systemctl daemon-reload
  systemctl stop diablofus
  tar -czf "$d/donnees.tgz" -C /home/diablofus donnees || { systemctl start diablofus; exit 1; }
  systemctl start diablofus
  ls -lh "$d"
fi
cd /; rm -rf "$T"

s "Après"
for i in 1 2 3 4 5 6; do systemctl is-active -q diablofus && curl -fsS -m 5 http://127.0.0.1:3100/sante >/dev/null 2>&1 && break; sleep 3; done
systemctl is-active diablofus || { journalctl -u diablofus -n 40 --no-pager; exit 1; }
systemctl show diablofus -p CPUQuotaPerSecUSec -p MemoryMax -p MemoryHigh -p MemoryCurrent -p Environment | sed -E 's/(SECRET|TOKEN)=[^ ]*/\1=***/g'
echo "fils node : $(ps -L -o lwp= -p "$(systemctl show diablofus -p MainPID --value)" | wc -l) threads (dont 2 fils de parties)"
curl -fsS -m 5 http://127.0.0.1:3100/sante; echo
curl -fsS -m 10 https://api.diablofus.com/sante && echo || echo "api.diablofus.com ne répond pas"
journalctl -u diablofus -n 12 --no-pager | sed -E 's/(secret|token)[^ ]*/\1=***/Ig'

s "Idlus après"
echo "conteneurs en marche : avant $avant, après $(docker ps -q | wc -l)"; docker ps --format '{{.Names}} {{.Status}}' | grep -v healthy || true
free -m | sed -n 2p
