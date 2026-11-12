-- ============================================================================
-- Idlus 3.0 — le Chantier du serveur (Marché › Chantier). Choix de Mathis (12/11/2026) : tout le serveur verse des kamas,
-- une fois l'objectif atteint : ×2 XP et ×2 butin pour tout le serveur pendant 48 h (hors Dofus et runes Ga, qui ne passent
-- pas par le multiplicateur de butin). Au plus un Chantier par semaine (semaine ISO, heure de Paris). L'objectif est calé
-- sur les kamas réels du serveur : 10 % des kamas des parties actives des 7 derniers jours, chaque partie comptée au plus
-- 5 fois la médiane (un seul compte très riche ne fait pas grimper l'objectif), au moins 1 million. Mathis peut le changer
-- (adm_chantier_goal). Un joueur verse au plus 40 % de l'objectif par semaine : il faut au moins 3 mécènes.
-- Les kamas sortent de la partie comme à l'hôtel de vente (hdv_save, hdv_kamas, hdv_op négative, vérifiés par le serveur).
-- Espace de saison : copié dans s1 par tools/saison_schema.js (chaque serveur a son Chantier). Monocompte : mono_chantier.sql.
-- Appliqué par le workflow « Serveur en ligne » ; relançable sans danger.
-- ============================================================================

create table if not exists public.chantier (
  wk text primary key,                 -- semaine ISO de Paris, « 2026-46 »
  goal bigint not null check (goal > 0),
  total bigint not null default 0,
  done_at timestamptz,
  ends_at timestamptz,                 -- fin du ×2 (done_at + 48 h)
  at timestamptz not null default now()
);
alter table public.chantier enable row level security; -- aucune lecture directe : seulement par les fonctions ci-dessous

create table if not exists public.chantier_dons (
  wk text not null references public.chantier (wk) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount bigint not null default 0 check (amount >= 0),
  at timestamptz not null default now(),
  primary key (wk, user_id)
);
alter table public.chantier_dons enable row level security;

create or replace function public.chantier_wk() returns text language sql stable
as $$ select to_char(now() at time zone 'Europe/Paris', 'IYYY-IW') $$;

-- Objectif de la semaine, lu dans les parties validées par le serveur (saves_ok.bilan.k = kamas).
create or replace function public.chantier_goal_calc() returns bigint language sql stable security definer set search_path = public
as $$
  with k as (select greatest(0, coalesce(case when (bilan->>'k') ~ '^\d{1,15}$' then (bilan->>'k')::numeric end, 0)) v
             from saves_ok where at > now() - interval '7 days'),
       c as (select coalesce(percentile_cont(0.5) within group (order by v), 0) * 5 p from k)
  select greatest(1000000, round(0.10 * coalesce((select sum(least(v, c.p)) from k, c), 0) / 10000) * 10000)::bigint
$$;
revoke all on function public.chantier_goal_calc() from public, anon, authenticated;

-- Le Chantier de la semaine, créé au premier appel.
create or replace function public.chantier_cur() returns public.chantier language plpgsql security definer set search_path = public
as $$
declare w text := chantier_wk(); r chantier;
begin
  select * into r from chantier where wk = w;
  if r.wk is null then
    insert into chantier (wk, goal) values (w, chantier_goal_calc()) on conflict (wk) do nothing;
    select * into r from chantier where wk = w;
  end if;
  return r;
end $$;
revoke all on function public.chantier_cur() from public, anon, authenticated;

-- État pour le jeu : la semaine en cours, le ×2 en cours (peut venir de la semaine d'avant), les 10 premiers mécènes.
create or replace function public.chantier_state() returns jsonb language plpgsql security definer set search_path = public
as $$
declare r chantier; b chantier; me uuid := auth.uid();
begin
  r := chantier_cur();
  select * into b from chantier where ends_at > now() order by ends_at desc limit 1;
  return jsonb_build_object('wk', r.wk, 'goal', r.goal, 'total', r.total, 'done', r.done_at, 'now', now(),
    'bonus', b.ends_at, -- fin du ×2 en cours, ou null
    'mine', coalesce((select amount from chantier_dons where wk = r.wk and user_id = me), 0),
    'cap', floor(r.goal * 0.4)::bigint,
    'n', (select count(*) from chantier_dons where wk = r.wk and amount > 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('p', coalesce(pseudo_of(d.user_id), '?'), 'k', d.amount) order by d.amount desc, d.at)
      from (select * from chantier_dons where wk = r.wk and amount > 0 order by amount desc, at limit 10) d), '[]'::jsonb));
end $$;
revoke all on function public.chantier_state() from public;
grant execute on function public.chantier_state() to anon, authenticated;

-- Verser des kamas (compte connecté, partie en ligne validée, pas en vérification). Renvoie l'état et les opérations à appliquer.
create or replace function public.chantier_give(p_amount bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; have numeric; r chantier; mine bigint; cap bigint; give bigint;
begin
  if me is null then return hdv_err('Connecte-toi à un compte (gratuit) pour participer au Chantier.'); end if;
  if p_amount is null or p_amount < 1000 then return hdv_err('Au moins 1 000 kamas.'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text)); -- même verrou que l'hôtel de vente : un don et un achat en même temps passent l'un après l'autre
  begin d := hdv_save(me); exception when others then return hdv_err(sqlerrm); end;
  r := chantier_cur();
  select * into r from chantier where wk = r.wk for update;
  if r.done_at is not null then return hdv_err('Le Chantier de la semaine est déjà fini : merci ! Le prochain ouvre lundi.'); end if;
  mine := coalesce((select amount from chantier_dons where wk = r.wk and user_id = me), 0);
  cap := floor(r.goal * 0.4)::bigint;
  give := least(p_amount, cap - mine, r.goal - r.total);
  if give < 1 then return hdv_err('Tu as déjà versé ta part de la semaine (40 % de l''objectif au plus).'); end if;
  have := hdv_kamas(me, d);
  if have < give then return hdv_err('Pas assez de kamas sur ta partie en ligne : ' || replace(to_char(floor(have), 'FM999G999G999G999'), ',', ' ') || ' (la partie part en ligne toutes les 30 s).'); end if;
  insert into chantier_dons (wk, user_id, amount) values (r.wk, me, give)
    on conflict (wk, user_id) do update set amount = chantier_dons.amount + excluded.amount, at = now();
  update chantier set total = total + give where wk = r.wk returning * into r;
  perform hdv_op(me, jsonb_build_object('k', -give, 'chantier', r.wk), 'Chantier du serveur : ' || replace(to_char(give, 'FM999G999G999G999'), ',', ' ') || ' kamas versés');
  if r.total >= r.goal then
    update chantier set done_at = now(), ends_at = now() + interval '48 hours' where wk = r.wk;
    insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', me, pseudo_of(me), 'ann',
      'Le Chantier du serveur ' || case when (current_schemas(false))[1] = 's1' then 'Saison 1' else 'Éternel' end || ' est fini : ×2 XP et ×2 butin pour tout le monde pendant 48 h ! Merci aux ' || (select count(*) from chantier_dons where wk = r.wk and amount > 0) || ' mécènes.',
      jsonb_build_object('t', 'admin', 'banner', false, 'chantier', r.wk));
  end if;
  return jsonb_build_object('ok', true, 'given', give, 'ops', hdv_ops_after(me, hdv_cursor(d)), 'state', chantier_state());
end $$;
revoke all on function public.chantier_give(bigint) from public;
grant execute on function public.chantier_give(bigint) to authenticated;

-- Panel : changer l'objectif de la semaine (Mathis seul). Ne peut pas finir le Chantier à lui seul : au moins 1 kama de plus que versé.
create or replace function public.adm_chantier_goal(p_goal bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare r chantier;
begin
  perform adm_need(true);
  if p_goal is null or p_goal < 100000 then return hdv_err('Au moins 100 000 kamas.'); end if;
  r := chantier_cur();
  if r.done_at is not null then return hdv_err('Le Chantier de la semaine est déjà fini.'); end if;
  update chantier set goal = greatest(p_goal, total + 1) where wk = r.wk;
  perform alog(format('objectif du Chantier : %s kamas', p_goal));
  return chantier_state();
end $$;
revoke all on function public.adm_chantier_goal(bigint) from public;
grant execute on function public.adm_chantier_goal(bigint) to authenticated;
