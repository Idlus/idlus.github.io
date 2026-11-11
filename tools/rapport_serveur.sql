-- Relevé temporaire (branche de travail, lecture seule) : fréquentation de chaque mode de jeu, comptages seulement, aucune donnée personnelle.
-- Demandé par Mathis le 11/11/2026 (« vérifie à chaque fois avant ») avant de retirer ou fusionner des modes dans la 3.0.
-- Joueurs actifs = partie envoyée dans les 7 derniers jours. Compteurs de partie = déjà utilisé au moins une fois.
with a as (
  select 'eternel' as srv, data::jsonb as d from public.saves where updated_at >= now() - interval '7 days'
  union all select 's1', data::jsonb from s1.saves where updated_at >= now() - interval '7 days'
  union all select 'mono', data::jsonb from mono.parties where updated_at >= now() - interval '7 days'
),
m as (
  select srv,
    case when jsonb_typeof(d #> '{cnt,ascRuns}') = 'number' then (d #>> '{cnt,ascRuns}')::numeric else 0 end as asc_runs,
    greatest(case when jsonb_typeof(d #> '{cnt,expRuns}') = 'number' then (d #>> '{cnt,expRuns}')::numeric else 0 end, case when jsonb_typeof(d #> '{songe,runs}') = 'number' then (d #>> '{songe,runs}')::numeric else 0 end) as songe_runs,
    case when jsonb_typeof(d #> '{foire,tot,n}') = 'number' then (d #>> '{foire,tot,n}')::numeric else 0 end as foire_n,
    case when jsonb_typeof(d #> '{cpt,seen}') = 'object' then (select count(*) from jsonb_object_keys(d #> '{cpt,seen}')) else 0 end as cpt_seen,
    case when jsonb_typeof(d #> '{cpt,off}') = 'object' then (select count(*) from jsonb_object_keys(d #> '{cpt,off}')) else 0 end as cpt_off,
    case when jsonb_typeof(d #> '{cnt,grav}') = 'number' then (d #>> '{cnt,grav}')::numeric else 0 end as grav,
    case when jsonb_typeof(d #> '{cnt,defiTries}') = 'number' then (d #>> '{cnt,defiTries}')::numeric else 0 end as defi,
    greatest(case when jsonb_typeof(d #> '{cnt,koliFights}') = 'number' then (d #>> '{cnt,koliFights}')::numeric else 0 end, case when jsonb_typeof(d #> '{koli,n}') = 'number' then (d #>> '{koli,n}')::numeric else 0 end) as koli,
    case when jsonb_typeof(d #> '{cnt,bounty}') = 'number' then (d #>> '{cnt,bounty}')::numeric else 0 end as chasse,
    case when jsonb_typeof(d #> '{cnt,idols}') = 'number' then (d #>> '{cnt,idols}')::numeric else 0 end as idoles,
    case when jsonb_typeof(d #> '{cnt,fm}') = 'number' then (d #>> '{cnt,fm}')::numeric else 0 end as forgemagie,
    case when jsonb_typeof(d #> '{cnt,craft}') = 'number' then (d #>> '{cnt,craft}')::numeric else 0 end as craft,
    greatest(case when jsonb_typeof(d #> '{elev,n}') = 'number' then (d #>> '{elev,n}')::numeric else 0 end, case when jsonb_typeof(d #> '{elev,n,births}') = 'number' then (d #>> '{elev,n,births}')::numeric else 0 end) as elev_n,
    case jsonb_typeof(d -> 'pets') when 'array' then jsonb_array_length(d -> 'pets') when 'object' then (select count(*) from jsonb_object_keys(d -> 'pets')) else 0 end as pets,
    case jsonb_typeof(d -> 'mounts') when 'array' then jsonb_array_length(d -> 'mounts') when 'object' then (select count(*) from jsonb_object_keys(d -> 'mounts')) else 0 end as mounts,
    case jsonb_typeof(d -> 'heroes') when 'array' then jsonb_array_length(d -> 'heroes') else 0 end as heros
  from a
),
par as (
  select srv, count(*) as actifs_7j,
    count(*) filter (where asc_runs > 0) as ascension, percentile_disc(0.5) within group (order by asc_runs) filter (where asc_runs > 0) as ascension_parties_med,
    count(*) filter (where songe_runs > 0) as songe, percentile_disc(0.5) within group (order by songe_runs) filter (where songe_runs > 0) as songe_parties_med,
    count(*) filter (where foire_n > 0) as foire, percentile_disc(0.5) within group (order by foire_n) filter (where foire_n > 0) as foire_caisses_med,
    count(*) filter (where cpt_seen > 0) as comptoirs_vus, count(*) filter (where cpt_off > 0) as comptoirs_off,
    count(*) filter (where grav > 0) as gravure, count(*) filter (where defi > 0) as defi, count(*) filter (where koli > 0) as koli,
    count(*) filter (where chasse > 0) as chasse, count(*) filter (where idoles > 0) as idoles, count(*) filter (where forgemagie > 0) as forgemagie,
    count(*) filter (where craft > 0) as artisanat, count(*) filter (where elev_n > 0) as elevage, percentile_disc(0.5) within group (order by elev_n) filter (where elev_n > 0) as elevage_naissances_med,
    count(*) filter (where pets > 0) as ont_familiers, percentile_disc(0.5) within group (order by pets) filter (where pets > 0) as familiers_med,
    count(*) filter (where mounts > 0) as ont_montures, percentile_disc(0.5) within group (order by mounts) filter (where mounts > 0) as montures_med,
    percentile_disc(0.5) within group (order by heros) as heros_med, max(heros) as heros_max, count(*) filter (where heros > 8) as plus_de_8_heros
  from m group by srv
)
select
  to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as heure_paris,
  (select jsonb_object_agg(srv, to_jsonb(par) - 'srv') from par) as modes_par_serveur,
  (select count(distinct user_id) from public.wb_hits where at >= now() - interval '7 days') as boss_des_mondes_eternel_7j,
  (select count(distinct user_id) from s1.wb_hits where at >= now() - interval '7 days') as boss_des_mondes_s1_7j,
  (select count(distinct att) from public.koli_fights where at >= now() - interval '7 days') as koli_eternel_7j,
  (select count(distinct att) from s1.koli_fights where at >= now() - interval '7 days') as koli_s1_7j,
  (select count(*) from public.koli_fights where at >= now() - interval '7 days') + (select count(*) from s1.koli_fights where at >= now() - interval '7 days') as koli_combats_7j,
  (select count(distinct user_id) from public.tour_teams where at >= now() - interval '14 days') + (select count(distinct user_id) from s1.tour_teams where at >= now() - interval '14 days') as tournoi_inscrits_14j,
  (select count(distinct user_id) from public.gboss_hits where at >= now() - interval '7 days') + (select count(distinct user_id) from s1.gboss_hits where at >= now() - interval '7 days') as boss_de_guilde_7j,
  (select count(*) from public.hdv_sales) as ventes_hdv_total;
