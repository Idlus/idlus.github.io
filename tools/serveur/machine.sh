# Côté serveur OVH : chiffres de la machine pour le « Rapport du serveur » (mêmes noms que l'ancien rapport Supabase).
# Lancé par : bash tools/serveur/vps_sql.sh commande "$(cat tools/serveur/machine.sh)"
cpu() { awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8, $5+$6}' /proc/stat; }
read -r t1 i1 < <(cpu); sleep 5; read -r t2 i2 < <(cpu)
read -r l1 _ l15 _ < /proc/loadavg
m() { awk -v k="$1" '$1 == k":" {print int($2/1024)}' /proc/meminfo; }
mt=$(m MemTotal); ma=$(m MemAvailable); st=$(m SwapTotal); sf=$(m SwapFree)
read -r dt du < <(df -BM --output=size,used / | tail -1 | tr -d M)
ok=$(docker ps --format '{{.Status}}' | grep -c 'Up'); mal=$(docker ps --format '{{.Names}} {{.Status}}' | grep -v 'healthy\|Up' | wc -l)
der=$(ls -1t /opt/idlus/sauvegardes 2>/dev/null | head -1)
jq -n --argjson mt "$mt" --argjson ma "$ma" --argjson st "$st" --argjson sf "$sf" --argjson dt "$dt" --argjson du "$du" \
  --argjson dT "$((t2 - t1))" --argjson dI "$((i2 - i1))" --arg l1 "$l1" --arg l15 "$l15" --argjson n "$(nproc)" \
  --argjson ok "$ok" --argjson mal "$mal" --arg der "${der:-aucune}" '{
  memoire_totale_mo: $mt, memoire_utilisee_mo: ($mt - $ma), memoire_utilisee_pourcentage: ((($mt - $ma) * 1000 / $mt | round) / 10),
  swap_total_mo: $st, swap_utilise_mo: ($st - $sf),
  processeurs: $n, processeur_utilise_pourcentage: (if $dT > 0 then ((($dT - $dI) * 1000 / $dT | round) / 10) else null end),
  charge_1_min: ($l1 | tonumber), charge_15_min: ($l15 | tonumber),
  disque_total_mo: $dt, disque_utilise_mo: $du, disque_utilise_pourcentage: (($du * 1000 / $dt | round) / 10),
  services_en_marche: $ok, services_en_difficulte: $mal, derniere_sauvegarde: $der }'
