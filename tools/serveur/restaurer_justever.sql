-- ============================================================================
-- JustEver : partie en ligne et partie validée remises à sa copie du 17/10/2026 (demande écrite de Mathis, 18/10/2026 :
-- « remettre sa partie en ligne à sa copie propre du 17/10 »). Même effet que le bouton du panel
-- (adm_save_restore, supabase/classements.sql) ; son appareil lui demandera quelle version garder.
-- Lancé seulement par le workflow « Serveur OVH » : étape restaurer-justever-essai (affiche puis annule tout) ou
-- restaurer-justever (avec la phrase). Par défaut c'est un ESSAI. N'affiche que des dates et des tailles, jamais la partie.
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
begin;
select id as uid from public.profiles where lower(pseudo) = 'justever' \gset
\echo '== Avant'
select s.updated_at as partie_en_ligne, length(s.data) as taille, o.src_at as partie_validee, j.at as copie_du_17, length(j.data) as taille_copie
  from public.saves s left join public.saves_ok o on o.user_id = s.user_id left join public.saves_jour j on j.user_id = s.user_id and j.day = date '2026-10-17'
  where s.user_id = :'uid';
select count(*) = 1 as copie_ok from public.saves_jour where user_id = :'uid' and day = date '2026-10-17' \gset
\if :copie_ok
\else
  \echo 'Pas de copie du 17/10 : rien n''est changé.'
  rollback;
  \quit
\endif
with d as (select data from public.saves_jour where user_id = :'uid' and day = date '2026-10-17')
update public.saves s set data = d.data, meta = s.meta || jsonb_build_object('remise', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')), updated_at = clock_timestamp() from d where s.user_id = :'uid';
update public.saves_ok o set data = s.data, src_at = s.updated_at, bilan = null, accept = false, at = now() from public.saves s where o.user_id = :'uid' and s.user_id = :'uid';
select public.alog('Bouclier : partie de JustEver remise au 17/10 (demande de Mathis)');
\echo '== Après'
select s.updated_at as partie_en_ligne, length(s.data) as taille, o.src_at as partie_validee, length(o.data) as taille_validee,
  (s.data = j.data) as en_ligne_egale_copie, (o.data = j.data) as validee_egale_copie
  from public.saves s left join public.saves_ok o on o.user_id = s.user_id left join public.saves_jour j on j.user_id = s.user_id and j.day = date '2026-10-17'
  where s.user_id = :'uid';
select (:'CONFIRMATION' = 'REMETS JUSTEVER AU 17/10') as appliquer \gset
\if :appliquer
  commit;
  \echo 'APPLIQUÉ.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback).'
\endif
