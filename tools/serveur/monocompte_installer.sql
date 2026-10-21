-- Lot 3 Monocompte (21/10/2026, ordre écrit de Mathis : « Installe le lot 3 Monocompte sur le serveur »).
-- Lancé par l'étape « monocompte-installer » de serveur-ovh.yml, APRÈS monocompte.sql, amis.sql, mono_social.sql, mono_bureau.sql.
-- Crée la saison de test (0, ouverte, horloge de test) et ajoute l'administrateur aux testeurs. Peut être relancé.
\set ON_ERROR_STOP on
begin;
-- Les fonctions mono_adm_* exigent un administrateur : on agit au nom du premier compte de public.admins.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.admins order by user_id limit 1), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select user_id::text from public.admins order by user_id limit 1), true);
select public.mono_adm_saison(0, 'Saison de test', coalesce((select debut from mono.saisons where id = 0), now()), true, 'ouverte');
select public.mono_adm_testeur(p.pseudo, true) from public.admins a join public.profiles p on p.id = a.user_id;
commit;
select id, nom, etat, test, debut from mono.saisons order by id;
select count(*) as testeurs from mono.testeurs;
select count(*) as tables_mono from information_schema.tables where table_schema = 'mono';
select count(*) as fonctions_publiques_mono from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'mono\_%' or p.proname like 'amis\_%' or p.proname = 'cosm_mine');
