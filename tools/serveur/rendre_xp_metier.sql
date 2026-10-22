-- ============================================================================
-- 2.1.38.4 : rend à un joueur l'XP d'un métier de récolte perdue au niveau 200 entre la 2.1.35 et la 2.1.37.7 (ticket #146 :
-- l'XP restait bloquée à 110 589, 1 XP sous le palier). Demande écrite de Mathis du 22/10/2026 : « rends l'XP de paysan de Gagou ».
-- XP rendue = la plus haute XP du métier au niveau 200 dans les copies du serveur (copies du jour, partie validée, partie en ligne)
-- moins 110 589. Elle part par le registre de l'HdV (hdv_op, p.jx, js/market.js) : le jeu l'ajoute à la partie en cours, rien
-- d'autre ne change. Le point de départ de la semaine des métiers (ladder.jobs_base) monte d'autant : pas de faux gain de semaine.
-- Lancé seulement par le workflow « Serveur OVH » : étape rendre-xp-metier-essai (affiche puis annule tout) ou rendre-xp-metier.
-- Une seule fois par joueur et par métier (refusé si déjà envoyé). N'affiche que des chiffres de métier, jamais la partie.
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
\set PSEUDO ''
\set JOB 'paysan'
begin;
select count(*) = 1 as trouve from public.profiles where lower(pseudo) = lower(:'PSEUDO') \gset
\if :trouve
\else
  \echo 'Pseudo introuvable : rien n''est changé.'
  rollback;
  \quit
\endif
select id as uid, pseudo as qui from public.profiles where lower(pseudo) = lower(:'PSEUDO') \gset
select format('XP de %s rendue (ticket #146)', :'JOB') as marque \gset
select exists (select 1 from public.hdv_ops where user_id = :'uid' and txt like :'marque' || '%') as deja \gset
\if :deja
  \echo 'Déjà envoyé à ce joueur pour ce métier : rien n''est changé.'
  rollback;
  \quit
\endif
-- un jeu d'avant la 2.1.38.4 ne connaît pas p.jx : il passerait l'opération sans rendre l'XP. On attend que le joueur soit à jour.
select coalesce(game_version, '0'), coalesce(string_to_array(regexp_replace(game_version, '[^0-9.]', '', 'g'), '.')::int[] >= array[2, 1, 38, 4], false) as ajour
  from public.saves where user_id = :'uid' \gset
\echo '== Version du jeu du joueur :' :coalesce
select (:'CONFIRMATION' = 'RENDS L XP DE METIER') as pourdevrai \gset
\if :ajour
\elif :pourdevrai
  \echo 'Le joueur n''a pas encore la 2.1.38.4 : rien n''est changé (relancer plus tard).'
  rollback;
  \quit
\else
  \echo 'Attention : le joueur n''a pas encore la 2.1.38.4 (l''envoi pour de vrai attendra).'
\endif
\echo '== Copies du serveur (niveau et XP du métier)'
create temp table copies on commit drop as
  select 'jour ' || to_char(day, 'DD/MM') as copie, at, data from public.saves_jour where user_id = :'uid'
  union all select 'partie validée', src_at, data from public.saves_ok where user_id = :'uid'
  union all select 'partie en ligne', updated_at, data from public.saves where user_id = :'uid';
create temp table niv on commit drop as
  select copie, at, (data::jsonb #>> array['jobs', :'JOB', 'lvl'])::int as lvl, floor((data::jsonb #>> array['jobs', :'JOB', 'xp'])::numeric)::bigint as xp from copies;
select copie, to_char(at, 'DD/MM HH24:MI') as le, lvl, xp from niv order by at;
select coalesce(max(xp) filter (where lvl = 200), 0) - 110589 as n from niv \gset
\echo '== XP à rendre :' :n
select (:n > 0) as arendre \gset
\if :arendre
\else
  \echo 'Rien à rendre : rien n''est changé.'
  rollback;
  \quit
\endif
select public.hdv_op(:'uid'::uuid, jsonb_build_object('jx', jsonb_build_object(:'JOB', :n)), :'marque' || ' : ' || replace(to_char(:n, 'FM999,999,999,999'), ',', ' ') || ' XP');
update public.ladder set jobs_base = jsonb_set(jobs_base, array[:'JOB'], to_jsonb((jobs_base ->> :'JOB')::bigint + :n))
  where user_id = :'uid' and jobs_base ? :'JOB' and jobs_w = floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
-- message privé de Xener (le compte admin de Mathis), comme tools/compensation_fm.js
insert into public.chat_msgs (ch, user_id, to_id, pseudo, cls, lvl, title, body)
  select 'p', x.u, :'uid'::uuid, public.pseudo_of(x.u), l.main, coalesce(l.main_lvl, 1), l.title,
    format('Ton XP de %s bloquée au niveau 200 t''est rendue : %s XP. Recharge le jeu si elle n''apparaît pas. Merci pour le signalement !', :'JOB', replace(to_char(:n, 'FM999,999,999,999'), ',', ' '))
  from (select a.user_id u from public.admins a left join public.profiles p on p.id = a.user_id order by (p.pseudo = 'Xener') desc nulls last limit 1) x
  left join public.ladder l on l.user_id = x.u;
select public.alog(format('XP de %s rendue à %s : %s', :'JOB', :'qui', :n));
\echo '== Envoyé'
select id, payload, txt from public.hdv_ops where user_id = :'uid' and txt like :'marque' || '%';
select (:'CONFIRMATION' = 'RENDS L XP DE METIER') as appliquer \gset
\if :appliquer
  commit;
  \echo 'APPLIQUÉ.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback).'
\endif
