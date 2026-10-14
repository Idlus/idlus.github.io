-- Rapport du serveur (lecture seule) : uniquement des nombres et des tailles, aucune donnée personnelle.
-- Lancé par le workflow « Rapport du serveur » (.github/workflows/rapport-serveur.yml).
-- « Aujourd'hui » = depuis minuit, heure de Paris.
with jour as (select date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as debut)
select
  to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as heure_paris,
  (select count(*) from auth.users) as comptes,
  (select count(*) from auth.users, jour where created_at >= jour.debut) as comptes_crees_aujourdhui,
  (select count(*) from auth.users, jour where last_sign_in_at >= jour.debut) as connexions_aujourdhui,
  (select count(*) from public.profiles) as pseudos,
  (select count(*) from public.profiles where suspended_at is not null) as comptes_suspendus,
  (select count(*) from public.saves) as parties_en_ligne,
  (select count(*) from public.saves, jour where updated_at >= jour.debut) as joueurs_actifs_aujourdhui,
  (select count(*) from public.saves where updated_at >= now() - interval '1 hour') as joueurs_actifs_derniere_heure,
  (select count(*) from public.saves where updated_at >= now() - interval '7 days') as joueurs_actifs_7_jours,
  (select coalesce(string_agg(v || ' : ' || n, ', ' order by n desc), '') from (select coalesce(game_version, '?') as v, count(*) as n from public.saves group by 1) s) as versions_des_parties,
  (select count(*) from public.ladder) as joueurs_classes,
  (select count(*) from public.chat_msgs) as messages_chat,
  (select count(*) from public.chat_msgs, jour where created_at >= jour.debut) as messages_chat_aujourdhui,
  (select count(*) from public.guilds) as guildes,
  (select count(*) from public.guild_members) as membres_de_guilde,
  (select count(*) from public.hdv_listings) as objets_en_vente_hdv,
  (select count(*) from public.hdv_sales) as ventes_hdv,
  (select count(*) from public.gift_uses) as codes_cadeaux_utilises,
  (select count(*) from pg_stat_activity) as connexions_base,
  current_setting('max_connections')::int as connexions_max,
  (select round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 1) from pg_stat_database) as cache_memoire_pourcentage,
  pg_size_pretty(pg_database_size(current_database())) as taille_base,
  round(pg_database_size(current_database()) / 1048576.0, 1) as taille_base_mo,
  pg_size_pretty(coalesce((select sum(pg_total_relation_size('public.saves'))), 0)) as taille_sauvegardes,
  (select pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) from storage.objects) as taille_fichiers_stockes,
  -- Les 6 plus grosses tables (données + index), pour voir ce qui fait grossir la base : noms et tailles seulement.
  (select string_agg(nom || ' : ' || pg_size_pretty(taille), ', ' order by taille desc) from (
    select c.oid::regclass::text as nom, pg_total_relation_size(c.oid) as taille
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'm') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%'
    order by taille desc limit 6) g) as plus_grosses_tables;
