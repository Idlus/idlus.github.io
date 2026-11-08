# Lecture seule : ce que consomme chaque service du serveur (processeur et mémoire), sans aucune donnée personnelle.
# Lancé par : bash tools/serveur/vps_sql.sh commande "$(cat tools/serveur/consommation.sh)"
echo "== Services : mémoire (instantané)"
docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}|{{.MemPerc}}' | sort -t'|' -k3 -nr
echo "== Services : processeur moyen sur 30 s (100 % = 1 cœur sur 6)"
for i in 1 2 3 4 5 6; do docker stats --no-stream --format '{{.Name}} {{.CPUPerc}}'; sleep 2; done \
  | awk '{gsub("%","",$2); s[$1]+=$2; n[$1]++} END {for (k in s) printf "%s %.1f %%\n", k, s[k]/n[k]}' | sort -k2 -nr
echo "== Processus de la machine (top 12 processeur)"
ps -eo pcpu,pmem,comm --sort=-pcpu | head -13
echo "== Base : requêtes les plus coûteuses (texte sans valeurs)"
docker exec supabase-db psql -U supabase_admin -d postgres -Atc "select count(*) from pg_extension where extname='pg_stat_statements'" 2>&1 | sed 's/^/pg_stat_statements installé : /'
docker exec supabase-db psql -U supabase_admin -d postgres -At -F ' | ' -c "select calls, round(total_exec_time/1000) as total_s, round(mean_exec_time::numeric,1) as moy_ms, left(regexp_replace(regexp_replace(regexp_replace(query, '''[^'']*''', '?', 'g'), '[0-9]{3,}', 'N', 'g'), '\s+', ' ', 'g'), 110) from pg_stat_statements order by total_exec_time desc limit 12" 2>&1 | head -14
echo "== Base : écritures par table depuis le dernier redémarrage"
docker exec supabase-db psql -U supabase_admin -d postgres -At -F ' | ' -c "select schemaname||'.'||relname, n_tup_ins, n_tup_upd, n_tup_del, seq_scan, n_dead_tup from pg_stat_user_tables order by n_tup_upd + n_tup_ins desc limit 10" 2>&1
docker exec supabase-db psql -U supabase_admin -d postgres -Atc "select 'base démarrée le ' || pg_postmaster_start_time()" 2>&1
