-- ============================================================================
-- REMISE À ZÉRO DES GUILDES — Idlus 1.0.30 « Refonte des guildes » (réponses 2, 21A et 33A de Mathis)
-- JAMAIS lancé par le jeu ni par la publication : c'est Mathis qui le lance, le soir de la sortie, APRÈS la
-- publication de la 1.0.30 (les fichiers supabase/*.sql de la 1.0.30 doivent déjà être appliqués) :
--   bash tools/serveur/vps_sql.sh fichier tools/serveur/guildes_reset.sql
-- Par défaut c'est un ESSAI : le script affiche ce qu'il ferait, puis annule tout (rollback).
-- Pour l'appliquer pour de vrai : sur la ligne \set CONFIRMATION plus bas, remplacer non par la phrase
-- JE DISSOUS TOUTES LES GUILDES (en toutes lettres), relancer, puis remettre non.
--
-- Ce qu'il fait, en une seule transaction :
--   1. Liste de compensation (choix 33A), envoyée aux comptes par le serveur (opérations de partie, comme l'HdV) :
--      - chaque membre d'une guilde : titre « Pionnier des guildes » et 50 000 kamas × niveau de son ancienne guilde ;
--      - chaque Meneur : 100 000 kamas (la Guildalogemme, qui coûte maintenant 25 000) ;
--      - celui qui a posé un Percepteur : la poche en cours, versée comme une récolte (kamas et ressources).
--   2. Dissout toutes les guildes : membres, demandes, chat, journal, coffre, Percepteurs, boss et attaques partent
--      avec elles. Les titres déjà gagnés restent (ils sont dans les parties).
--   3. Pose l'index « un seul Percepteur par zone sur tout le serveur » (choix 8A).
--   4. Crée le code cadeau GUILDES (choix 21A) : 300 000 kamas et 6 h de Sablier de Xélor, valable 7 jours,
--      une fois par compte, comptes seulement. Le jeu le propose aux joueurs sans guilde (Guilde › bandeau).
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
begin;
lock table public.guilds, public.guild_members, public.guild_percos in share row exclusive mode;

-- garde-fous : la 1.0.30 est en place, et la remise à zéro n'a pas déjà été faite
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'guilds' and column_name = 'chest')
     or not exists (select 1 from pg_proc where proname = 'pc_gain') then
    raise exception 'La 1.0.30 n''est pas encore appliquée au serveur (supabase/guildes.sql et gboss.sql) : publie la mise à jour d''abord.';
  end if;
  if exists (select 1 from public.gift_codes where code = 'GUILDES') then
    raise exception 'Le code GUILDES existe déjà : la remise à zéro a sans doute déjà été faite. Rien n''est changé.';
  end if;
end $$;

-- ---------- 0. ce qui va être fait ----------
\echo '== Guildes dissoutes'
select g.id, g.name, 'niveau ' || g.lvl as niveau, (select count(*) from public.guild_members m where m.guild_id = g.id) as membres,
  (select public.pseudo_of(m.user_id) from public.guild_members m where m.guild_id = g.id and m.rank = 0 limit 1) as meneur,
  (select count(*) from public.guild_percos p where p.guild_id = g.id) as percepteurs
from public.guilds g order by g.lvl desc, g.id;

create temp table reset_envois (user_id uuid not null, k bigint not null default 0, res jsonb, title text, txt text not null) on commit drop;
-- membres : titre et 50 000 kamas × niveau de l'ancienne guilde
insert into reset_envois (user_id, k, title, txt)
  select m.user_id, 50000::bigint * g.lvl, 'Pionnier des guildes',
    format('Refonte des guildes : titre « Pionnier des guildes » et %s kamas (50 000 × le niveau %s de %s)', public.g_fmt(50000::bigint * g.lvl), g.lvl, g.name)
  from public.guild_members m join public.guilds g on g.id = m.guild_id;
-- Meneurs : la Guildalogemme remboursée
insert into reset_envois (user_id, k, txt)
  select m.user_id, 100000, format('Refonte des guildes : ta Guildalogemme de %s est remboursée (100 000 kamas)', g.name)
  from public.guild_members m join public.guilds g on g.id = m.guild_id where m.rank = 0;
-- Percepteurs posés : la poche en cours à celui qui l'a posé (comme une récolte)
insert into reset_envois (user_id, k, res, txt)
  select p.by_user, (x.gain->>'k')::bigint, x.gain->'res',
    format('Refonte des guildes : la poche de ton Percepteur de %s (%s kamas et ses ressources)', z.name, public.g_fmt((x.gain->>'k')::bigint))
  from public.guild_percos p join public.perco_zones z on z.sid = p.sid
    cross join lateral (select public.pc_gain(z.cap, least(1, public.pc_fill(p)), '{}'::jsonb) as gain) x
  where p.by_user is not null and exists (select 1 from auth.users u where u.id = p.by_user)
    and ((x.gain->>'k')::bigint > 0 or x.gain->'res' <> '{}'::jsonb);

\echo '== Envois (un par ligne)'
select public.pseudo_of(e.user_id) as joueur, e.k as kamas, coalesce(e.title, '') as titre, e.txt from reset_envois e order by joueur, e.k desc;
\echo '== Totaux'
select count(distinct user_id) as comptes, coalesce(sum(k), 0) as kamas_envoyes, count(*) filter (where title is not null) as titres from reset_envois;

-- ---------- 1. compensation ----------
select count(*) as envois_faits from (select public.hdv_op(e.user_id, jsonb_strip_nulls(jsonb_build_object('k', nullif(e.k, 0), 'res', e.res, 'title', e.title)), e.txt) from reset_envois e) x;

-- ---------- 2. dissolution (tout ce qui dépend d'une guilde part avec elle) ----------
delete from public.guilds;

-- ---------- 3. un seul Percepteur par zone sur tout le serveur ----------
create unique index if not exists guild_percos_sid on public.guild_percos (sid);

-- ---------- 4. code cadeau GUILDES ----------
insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only, active)
values ('GUILDES', '{"k": 300000, "s": 6}'::jsonb, 'Refonte des guildes : de quoi refonder ta guilde, et 6 h de Sablier de Xélor !', null,
  (now() at time zone 'Europe/Paris')::date + 7, true, true);
\echo '== Code GUILDES'
select code, reward, ends, accounts_only from public.gift_codes where code = 'GUILDES';

-- ---------- appliquer ou annuler ----------
select (:'CONFIRMATION' = 'JE DISSOUS TOUTES LES GUILDES') as appliquer \gset
\if :appliquer
  commit;
  \echo 'FAIT : guildes dissoutes, compensations envoyées, code GUILDES créé.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback). Pour appliquer, écris la phrase sur la ligne CONFIRMATION en haut du fichier.'
\endif
