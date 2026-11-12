-- ============================================================================
-- Idlus 3.0 — le Chantier du serveur, version Monocompte (Mathis 12/11/2026 : « Brèche, Chantier, Foire dispo en monocompte »).
-- Mêmes règles que supabase/chantier.sql (objectif de 10 % des kamas des parties actives, chaque partie comptée au plus
-- 5 fois la médiane, au moins 1 million ; 40 % de l'objectif au plus par joueur ; ×2 XP et butin pendant 48 h ; un par semaine),
-- mais pour la saison Monocompte ouverte, avec ses propres kamas (mono.base, mono.kamas, mono.op) et son propre chat.
-- Installé par le workflow « Serveur OVH », étape « chantier » (avec une sauvegarde) ; relançable sans danger.
-- ============================================================================

create table if not exists mono.chantier (
  saison int not null references mono.saisons (id),
  wk text not null,
  goal bigint not null check (goal > 0),
  total bigint not null default 0,
  done_at timestamptz,
  ends_at timestamptz,
  at timestamptz not null default now(),
  primary key (saison, wk)
);
alter table mono.chantier enable row level security;

create table if not exists mono.chantier_dons (
  saison int not null,
  wk text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount bigint not null default 0 check (amount >= 0),
  at timestamptz not null default now(),
  primary key (saison, wk, user_id),
  foreign key (saison, wk) references mono.chantier (saison, wk) on delete cascade
);
alter table mono.chantier_dons enable row level security;

create or replace function mono.chantier_goal_calc(p_s int) returns bigint language sql stable security definer set search_path = mono, public
as $$
  with k as (select greatest(0, coalesce(case when (bilan->>'k') ~ '^\d{1,15}$' then (bilan->>'k')::numeric end, 0)) v
             from mono.parties_ok where saison = p_s and at > now() - interval '7 days'),
       c as (select coalesce(percentile_cont(0.5) within group (order by v), 0) * 5 p from k)
  select greatest(1000000, round(0.10 * coalesce((select sum(least(v, c.p)) from k, c), 0) / 10000) * 10000)::bigint
$$;
revoke all on function mono.chantier_goal_calc(int) from public, anon, authenticated;

create or replace function mono.chantier_cur(p_s int) returns mono.chantier language plpgsql security definer set search_path = mono, public
as $$
declare w text := public.chantier_wk(); r mono.chantier;
begin
  select * into r from mono.chantier where saison = p_s and wk = w;
  if r.wk is null then
    insert into mono.chantier (saison, wk, goal) values (p_s, w, mono.chantier_goal_calc(p_s)) on conflict do nothing;
    select * into r from mono.chantier where saison = p_s and wk = w;
  end if;
  return r;
end $$;
revoke all on function mono.chantier_cur(int) from public, anon, authenticated;

create or replace function mono.chantier_etat(u uuid, p_s int) returns jsonb language plpgsql security definer set search_path = mono, public
as $$
declare r mono.chantier; b mono.chantier;
begin
  r := mono.chantier_cur(p_s);
  select * into b from mono.chantier where saison = p_s and ends_at > now() order by ends_at desc limit 1;
  return jsonb_build_object('wk', r.wk, 'goal', r.goal, 'total', r.total, 'done', r.done_at, 'now', now(), 'bonus', b.ends_at,
    'mine', coalesce((select amount from mono.chantier_dons where saison = p_s and wk = r.wk and user_id = u), 0),
    'cap', floor(r.goal * 0.4)::bigint,
    'n', (select count(*) from mono.chantier_dons where saison = p_s and wk = r.wk and amount > 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('p', coalesce(mono.pseudo(d.user_id), '?'), 'k', d.amount) order by d.amount desc, d.at)
      from (select * from mono.chantier_dons where saison = p_s and wk = r.wk and amount > 0 order by amount desc, at limit 10) d), '[]'::jsonb));
end $$;
revoke all on function mono.chantier_etat(uuid, int) from public, anon, authenticated;

create or replace function public.mono_chantier_state() returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); begin
  if s is null then return mono.err('Pas de saison Monocompte ouverte.'); end if;
  return mono.chantier_etat(auth.uid(), s);
end $$;
revoke all on function public.mono_chantier_state() from public;
grant execute on function public.mono_chantier_state() to anon, authenticated;

create or replace function public.mono_chantier_give(p_after bigint, p_amount bigint) returns jsonb language plpgsql security definer set search_path = mono, public
as $$
declare u uuid; s int := mono.saison_ouverte(); d jsonb; have numeric; r mono.chantier; mine bigint; cap bigint; give bigint;
begin
  begin u := mono.need(); exception when raise_exception then return mono.err(sqlerrm); end;
  if s is null or mono.monde(s) <> 's' then return mono.err('Pas de saison Monocompte ouverte.'); end if;
  if p_amount is null or p_amount < 1000 then return mono.err('Au moins 1 000 kamas.'); end if;
  perform mono.verrou(u);
  begin d := mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  r := mono.chantier_cur(s);
  select * into r from mono.chantier where saison = s and wk = r.wk for update;
  if r.done_at is not null then return mono.err('Le Chantier de la semaine est déjà fini : merci ! Le prochain ouvre lundi.'); end if;
  mine := coalesce((select amount from mono.chantier_dons where saison = s and wk = r.wk and user_id = u), 0);
  cap := floor(r.goal * 0.4)::bigint;
  give := least(p_amount, cap - mine, r.goal - r.total);
  if give < 1 then return mono.err('Tu as déjà versé ta part de la semaine (40 % de l''objectif au plus).'); end if;
  have := mono.kamas(u, s, d);
  if have < give then return mono.err('Pas assez de kamas sur ta partie validée par le serveur.'); end if;
  insert into mono.chantier_dons (saison, wk, user_id, amount) values (s, r.wk, u, give)
    on conflict (saison, wk, user_id) do update set amount = mono.chantier_dons.amount + excluded.amount, at = now();
  update mono.chantier set total = total + give where saison = s and wk = r.wk returning * into r;
  perform mono.op(u, s, jsonb_build_object('k', -give, 'chantier', r.wk), 'Chantier du serveur : ' || replace(to_char(give, 'FM999G999G999G999'), ',', ' ') || ' kamas versés');
  if r.total >= r.goal then
    update mono.chantier set done_at = now(), ends_at = now() + interval '48 hours' where saison = s and wk = r.wk;
  end if;
  return jsonb_build_object('ok', true, 'given', give, 'ops', mono.ops_after(u, s, p_after), 'state', mono.chantier_etat(u, s));
end $$;
revoke all on function public.mono_chantier_give(bigint, bigint) from public;
grant execute on function public.mono_chantier_give(bigint, bigint) to authenticated;
