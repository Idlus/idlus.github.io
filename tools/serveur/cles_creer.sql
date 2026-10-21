-- Crée 20 clés bêta (lot « Bêta 1 ») au nom de l'administrateur. Demande écrite de Mathis du 21/10 : « 20 pour commencer ».
\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.admins order by user_id limit 1), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select user_id::text from public.admins order by user_id limit 1), true);
select public.mono_adm_cles_creer(20, 'Bêta 1');
commit;
