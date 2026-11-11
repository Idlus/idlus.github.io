-- Rapport du serveur (lecture seule) : uniquement des nombres et des tailles, aucune donnée personnelle.
-- Lancé par le workflow « Rapport du serveur » (.github/workflows/rapport-serveur.yml).
-- « Aujourd'hui » = depuis minuit, heure de Paris.
with jour as (select date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as debut),
-- Rétention (demande de Mathis, 22/10/2026) : par compte, seulement des dates et le niveau du héros principal (déjà public au classement).
-- Dernière activité = dernier envoi de partie, Classique (public.saves) ou Monocompte (mono.parties).
auj as (select (now() at time zone 'Europe/Paris')::date as d),
comptes as (
  select (u.created_at at time zone 'Europe/Paris')::date as j0,
    greatest(s.updated_at, m.der) as der,
    l.main_lvl, l.playtime
  from auth.users u
  left join public.saves s on s.user_id = u.id
  left join (select user_id, max(updated_at) as der from mono.parties group by 1) m on m.user_id = u.id
  left join public.ladder l on l.user_id = u.id
),
partis as (select c.* from comptes c, auj where c.j0 <= auj.d - 3 and (c.der is null or c.der < now() - interval '3 days'))
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
    order by taille desc limit 6) g) as plus_grosses_tables,
  -- Renouvellements de session de la dernière heure (comptages seulement, aucune donnée de joueur) :
  -- combien de jetons, sur combien de sessions, au plus par session, et tous les combien de secondes (médiane).
  (select count(*) from auth.refresh_tokens where created_at >= now() - interval '1 hour') as jetons_session_derniere_heure,
  (select count(distinct session_id) from auth.refresh_tokens where created_at >= now() - interval '1 hour') as sessions_renouvelees_derniere_heure,
  (select max(n) from (select count(*) as n from auth.refresh_tokens where created_at >= now() - interval '1 hour' group by session_id) s) as jetons_par_session_max,
  (select round(percentile_cont(0.5) within group (order by ecart))::int from (
    select extract(epoch from created_at - lag(created_at) over (partition by session_id order by created_at)) as ecart
    from auth.refresh_tokens where created_at >= now() - interval '1 hour') e where ecart is not null) as secondes_entre_renouvellements,
  (select count(*) from auth.refresh_tokens) as jetons_session_total,
  -- Journal des connexions de la dernière heure, par type d'évènement (le nom de l'évènement seulement)
  (select coalesce(string_agg(a || ' : ' || n, ', ' order by n desc), '') from (
    select coalesce(payload->>'action', '?') as a, count(*) as n from auth.audit_log_entries
    where created_at >= now() - interval '1 hour' group by 1) j) as journal_connexions_derniere_heure,
  (select count(*) from auth.audit_log_entries) as journal_connexions_total,
  -- Rétention des nouveaux comptes (comptages seulement) :
  -- créés il y a 2 à 8 jours et revenus jouer au moins un autre jour que celui de leur création ;
  (select count(*) filter (where (der at time zone 'Europe/Paris')::date > j0) || ' / ' || count(*)
     || coalesce(' (' || round(100.0 * count(*) filter (where (der at time zone 'Europe/Paris')::date > j0) / nullif(count(*), 0)) || ' %)', '')
   from comptes, auj where j0 between auj.d - 8 and auj.d - 2) as nouveaux_revenus_un_autre_jour,
  -- créés il y a 8 à 30 jours et encore là (une partie envoyée dans les 48 dernières heures).
  (select count(*) filter (where der >= now() - interval '48 hours') || ' / ' || count(*)
     || coalesce(' (' || round(100.0 * count(*) filter (where der >= now() - interval '48 hours') / nullif(count(*), 0)) || ' %)', '')
   from comptes, auj where j0 between auj.d - 30 and auj.d - 8) as comptes_8_30_jours_encore_actifs,
  -- Partis : comptes de plus de 3 jours sans partie envoyée depuis 3 jours (dont jamais aucune partie envoyée),
  -- niveau médian du héros principal et temps de jeu médian (heures) au départ, répartition par niveau.
  (select count(*) from partis) as comptes_partis,
  (select count(*) from partis where der is null) as partis_sans_aucune_partie,
  (select percentile_disc(0.5) within group (order by main_lvl) from partis where main_lvl is not null) as partis_niveau_median,
  (select round((percentile_disc(0.5) within group (order by playtime)) / 3600.0, 1) from partis where playtime is not null) as partis_heures_de_jeu_mediane,
  (select coalesce(string_agg(t || ' : ' || n, ', ' order by o), '') from (
    select case when main_lvl < 20 then 1 when main_lvl < 60 then 2 when main_lvl < 120 then 3 when main_lvl < 200 then 4 else 5 end as o,
      case when main_lvl < 20 then '1-19' when main_lvl < 60 then '20-59' when main_lvl < 120 then '60-119' when main_lvl < 200 then '120-199' else '200' end as t,
      count(*) as n
    from partis where main_lvl is not null group by 1, 2) b) as partis_par_niveau,
  to_char(now() at time zone 'UTC', 'HH24:MI:SS') as heure_serveur_utc;
