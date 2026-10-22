-- ============================================================================
-- Ticket #146 (suite) : rend à TOUS les joueurs l'XP des métiers de récolte perdue au niveau 200 entre la 2.1.35 et la 2.1.37.7
-- (l'XP au-delà du 200 était ramenée à 110 589). Métiers : paysan, bûcheron, mineur, alchimiste, pêcheur.
-- Pour chaque joueur et métier, on suit ses copies du serveur dans l'ordre (copies du jour, partie validée, partie en ligne) :
-- la première copie au niveau 200 dont l'XP est plus basse qu'une copie d'avant marque la perte ; XP rendue = la plus haute XP
-- d'avant cette copie moins 110 589. L'XP gagnée entre la dernière copie et le blocage ne se retrouve pas.
-- Envoi par le registre de l'HdV (p.jx, js/market.js, 2.1.38.4), point de départ de la semaine des métiers relevé d'autant,
-- un message privé de Xener par joueur. Déjà rendu (même marque que tools/serveur/rendre_xp_metier.sql) : sauté.
-- Joueur pas encore en 2.1.38.4 : sauté (relancer plus tard), car un jeu plus ancien ignorerait l'XP.
-- Lancé seulement par le workflow « Serveur OVH » : rendre-xp-tous-essai (affiche puis annule tout) ou rendre-xp-tous.
-- N'affiche que des pseudos et des chiffres de métier, jamais les parties.
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
begin;
create temp table copies on commit drop as
  select user_id, at, 'jour' as src, data::jsonb -> 'jobs' as j from public.saves_jour
  union all select user_id, src_at, 'validée', data::jsonb -> 'jobs' from public.saves_ok
  union all select user_id, updated_at, 'en ligne', data::jsonb -> 'jobs' from public.saves;
create temp table niv on commit drop as
  select c.user_id, c.at, c.src, k.key as job, (k.value ->> 'lvl')::int as lvl, floor((k.value ->> 'xp')::numeric)::bigint as xp
  from copies c cross join lateral jsonb_each(case when jsonb_typeof(c.j) = 'object' then c.j else '{}'::jsonb end) k
  where k.key in ('paysan', 'bucheron', 'mineur', 'alchimiste', 'pecheur') and jsonb_typeof(k.value) = 'object';
create temp table suite on commit drop as
  select *, max(xp) over (partition by user_id, job order by at, src rows between unbounded preceding and 1 preceding) as avant from niv;
create temp table perte on commit drop as
  select distinct on (user_id, job) user_id, job, avant - 110589 as n, at as le
  from suite where lvl = 200 and avant is not null and xp < avant and avant > 110589
  order by user_id, job, at;
-- déjà rendu, ou pas de partie récente au bon niveau de jeu
create temp table envoi on commit drop as
  select p.user_id, public.pseudo_of(p.user_id) as qui, p.job, p.n, p.le, s.game_version,
    coalesce(string_to_array(regexp_replace(coalesce(s.game_version, '0'), '[^0-9.]', '', 'g'), '.')::int[] >= array[2, 1, 38, 4], false) as ajour,
    exists (select 1 from public.hdv_ops o where o.user_id = p.user_id and o.txt like format('XP de %s rendue (ticket #146)%%', p.job)) as deja
  from perte p left join public.saves s on s.user_id = p.user_id where p.n > 0;
\echo '== Pertes trouvées (joueur, métier, XP à rendre, copie qui montre la perte, version du jeu, déjà rendu)'
select qui, job, n, to_char(le, 'DD/MM HH24:MI') as perte_vue, game_version, ajour, deja from envoi order by n desc;
select count(*) filter (where not deja and ajour) as a_envoyer, count(*) filter (where not deja and not ajour) as en_attente, coalesce(sum(n) filter (where not deja and ajour), 0) as xp_totale from envoi;
select public.hdv_op(e.user_id, jsonb_build_object('jx', jsonb_build_object(e.job, e.n)), format('XP de %s rendue (ticket #146) : %s XP', e.job, replace(to_char(e.n, 'FM999,999,999,999'), ',', ' ')))
  from envoi e where not e.deja and e.ajour;
update public.ladder l set jobs_base = jsonb_set(l.jobs_base, array[e.job], to_jsonb((l.jobs_base ->> e.job)::bigint + e.n))
  from envoi e where l.user_id = e.user_id and not e.deja and e.ajour and l.jobs_base ? e.job
  and l.jobs_w = floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
insert into public.chat_msgs (ch, user_id, to_id, pseudo, cls, lvl, title, body)
  select 'p', x.u, e.user_id, public.pseudo_of(x.u), l.main, coalesce(l.main_lvl, 1), l.title,
    left(format('Ton XP de métier bloquée au niveau 200 t''est rendue : %s. Recharge le jeu si elle n''apparaît pas.', string_agg(format('%s %s XP', case e.job when 'paysan' then 'Paysan' when 'bucheron' then 'Bûcheron' when 'mineur' then 'Mineur' when 'alchimiste' then 'Alchimiste' else 'Pêcheur' end, replace(to_char(e.n, 'FM999,999,999,999'), ',', ' ')), ', ')), 200)
  from envoi e cross join (select a.user_id u from public.admins a left join public.profiles p on p.id = a.user_id order by (p.pseudo = 'Xener') desc nulls last limit 1) x
  left join public.ladder l on l.user_id = x.u
  where not e.deja and e.ajour group by x.u, e.user_id, l.main, l.main_lvl, l.title;
select public.alog(format('XP de métier rendue à %s joueurs (ticket #146)', count(distinct user_id))) from envoi where not deja and ajour;
select (:'CONFIRMATION' = 'RENDS L XP DE TOUS') as appliquer \gset
\if :appliquer
  commit;
  \echo 'APPLIQUÉ.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback).'
\endif
