#!/bin/bash
# Copie complète de la base d'Idlus, chaque nuit (cron), dans /opt/idlus/sauvegardes. Garde les 14 dernières.
# Ces fichiers sont sur le disque du serveur, donc aussi dans la sauvegarde automatique quotidienne d'OVH.
set -euo pipefail
cd /opt/idlus/sauvegardes
f="idlus-$(date +%Y-%m-%d-%H%M).sql.gz"
docker exec supabase-db pg_dumpall -U postgres --clean --if-exists | gzip > "$f.part"
mv "$f.part" "$f"
ls -1t idlus-*.sql.gz | tail -n +15 | xargs -r rm -f
echo "$(date '+%F %T') sauvegarde $f ($(du -h "$f" | cut -f1))"
