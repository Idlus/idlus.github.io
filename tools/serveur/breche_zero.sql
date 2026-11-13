-- 3.0.7 (Mathis, 13/11/2026 : « remet à zéro les records de brèche avec une excuse ») : classement de la Brèche faussé par le bug
-- de la 3.0.4 (petits bonus sans plafond, étage 3860). Copie de sécurité des lignes, puis suppression dans l'Éternel (public)
-- et la Saison 1 (s1). Les déclencheurs (ascension.sql, z = 1) n'acceptent plus que les records d'après la remise à zéro.
-- Sans la confirmation exacte, tout est annulé (essai).
\set ON_ERROR_STOP on
\set CONFIRMATION 'non'
begin;
create table if not exists public.asc_scores_breche_1311 as select 'public'::text as srv, * from public.asc_scores where false;
create table if not exists s1.asc_scores_breche_1311 as select 's1'::text as srv, * from s1.asc_scores where false;
insert into public.asc_scores_breche_1311 select 'public', * from public.asc_scores where cat = 'breche';
insert into s1.asc_scores_breche_1311 select 's1', * from s1.asc_scores where cat = 'breche';
select 'public' as srv, p.pseudo, a.m, a.score from public.asc_scores a left join public.profiles p on p.id = a.user_id where a.cat = 'breche' order by a.score desc limit 15;
select 's1' as srv, p.pseudo, a.m, a.score from s1.asc_scores a left join public.profiles p on p.id = a.user_id where a.cat = 'breche' order by a.score desc limit 15;
delete from public.asc_scores where cat = 'breche';
delete from s1.asc_scores where cat = 'breche';
select (select count(*) from public.asc_scores where cat = 'breche') as public_reste, (select count(*) from s1.asc_scores where cat = 'breche') as s1_reste,
  (select count(*) from public.asc_scores_breche_1311) as public_copie, (select count(*) from s1.asc_scores_breche_1311) as s1_copie;
select :'CONFIRMATION' = 'REMETS LA BRECHE A ZERO' as confirme \gset
\if :confirme
commit;
\echo 'BRÈCHE REMISE À ZÉRO.'
\else
rollback;
\echo 'ESSAI : rien n''a été changé.'
\endif
