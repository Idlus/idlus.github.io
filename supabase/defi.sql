-- ============================================================================
-- Idlus — défi du jour (lot « Se montrer »). Appliqué automatiquement par le workflow
-- « Serveur en ligne » après classements.sql (il s'appuie sur ladder et profiles) ; relançable sans danger.
-- ============================================================================
-- ---------- scores du jour ----------
-- Un score par joueur, par jour (heure de Paris) et par palier. Écrit seulement par la fonction serveur « record »,
-- qui rejoue le défi avec la partie en ligne du joueur (le même hasard pour tous).
create table if not exists public.defi (
  user_id uuid not null references auth.users (id) on delete cascade,
  day int not null,
  tier text not null,
  did text,
  turns int not null,
  hp int not null default 0,
  team jsonb not null default '[]'::jsonb,
  at timestamptz not null default now(),
  primary key (user_id, day, tier)
);
alter table public.defi enable row level security;
drop policy if exists "défi lisible" on public.defi;
create policy "défi lisible" on public.defi for select using (true);
-- 1.1 : refonte du défi. Score en points (règles tenues, tours, PV), validations comptées (3 par palier et par jour),
-- classement de la semaine (lundi-dimanche, somme des meilleurs scores du jour).
alter table public.defi add column if not exists score int not null default 0;
alter table public.defi add column if not exists sends int not null default 0;
alter table public.defi add column if not exists rules jsonb not null default '{}'::jsonb;
drop view if exists public.lb_defi;
create view public.lb_defi as
  select d.user_id, p.pseudo, l.main, d.day, d.tier, d.turns, d.hp, d.team, d.at,
    rank() over (partition by d.day, d.tier order by d.score desc, d.turns asc, d.hp desc, d.at asc) as r, l.main_lvl, d.score, d.rules
  from public.defi d join public.ladder l on l.user_id = d.user_id join public.profiles p on p.id = d.user_id where not l.flagged;
grant select on public.lb_defi to anon, authenticated;
-- semaine : jour 0 = jeudi 1er janvier 1970, d'où (day + 3) / 7 pour des semaines du lundi au dimanche
drop view if exists public.lb_defi_week_g; -- 1.1 : elle s'appuie sur lb_defi_week (recréée plus bas)
drop view if exists public.lb_defi_week;
create view public.lb_defi_week as
  select w.user_id, p.pseudo, l.main, l.main_lvl, w.week, w.tier, w.score, w.days,
    rank() over (partition by w.week, w.tier order by w.score desc, w.days desc) as r
  from (select user_id, (day + 3) / 7 as week, tier, sum(score)::int as score, count(*)::int as days from public.defi where score > 0 group by user_id, (day + 3) / 7, tier) w
  join public.ladder l on l.user_id = w.user_id join public.profiles p on p.id = w.user_id where not l.flagged;
grant select on public.lb_defi_week to anon, authenticated;
-- ---------- 1.1, série 3 : guildes, saison du mois, partage dans le chat ----------
-- jour de Paris (même calcul que E.defiDay)
create or replace function public.defi_today() returns int language sql stable as $$ select ((now() at time zone 'Europe/Paris')::date - date '1970-01-01')::int $$;
-- semaine de chaque joueur, avec sa guilde (onglet « Ma guilde »)
drop view if exists public.lb_defi_week_g;
create view public.lb_defi_week_g as
  select w.*, gm.guild_id from public.lb_defi_week w join public.guild_members gm on gm.user_id = w.user_id;
grant select on public.lb_defi_week_g to anon, authenticated;
-- guildes : somme des 5 meilleurs scores de la semaine de leurs membres, par palier (E.DEFI_GUILD_TOP)
drop view if exists public.lb_defi_guild_week;
create view public.lb_defi_guild_week as
  with w as (select d.user_id, (d.day + 3) / 7 as week, d.tier, sum(d.score)::int as score
             from public.defi d join public.ladder l on l.user_id = d.user_id where d.score > 0 and not l.flagged group by d.user_id, (d.day + 3) / 7, d.tier),
       m as (select gm.guild_id, w.week, w.tier, w.score, row_number() over (partition by gm.guild_id, w.week, w.tier order by w.score desc) as k
             from w join public.guild_members gm on gm.user_id = w.user_id)
  select g.id as guild_id, g.name, g.ic, g.col, g.lvl, m.week, m.tier, (sum(m.score) filter (where m.k <= 5))::int as score, count(*)::int as members,
    rank() over (partition by m.week, m.tier order by sum(m.score) filter (where m.k <= 5) desc, count(*) desc) as r
  from m join public.guilds g on g.id = m.guild_id group by g.id, g.name, g.ic, g.col, g.lvl, m.week, m.tier;
grant select on public.lb_defi_guild_week to anon, authenticated;
-- le lundi, la 1re guilde de chaque palier de la semaine passée gagne de l'XP de guilde (E.DEFI_GUILD_XP), une seule fois.
-- Appelée par le jeu à l'ouverture du classement des guildes : rien à programmer côté serveur.
create table if not exists public.defi_guild_prize (
  week int not null, tier text not null, guild_id bigint references public.guilds (id) on delete set null, xp bigint not null default 0, score int not null default 0,
  at timestamptz not null default now(), primary key (week, tier)
);
alter table public.defi_guild_prize enable row level security;
drop policy if exists "prix du défi lisibles" on public.defi_guild_prize;
create policy "prix du défi lisibles" on public.defi_guild_prize for select using (true);
create or replace function public.defi_guild_prize() returns jsonb language plpgsql security definer set search_path = public
as $$
declare w int := (defi_today() + 3) / 7 - 1; x bigint := 5000000; t record; g guilds; nl int; done jsonb := '[]'::jsonb;
begin
  -- la ligne « * » marque une semaine déjà distribuée : les appels suivants ne lisent qu'elle
  if exists (select 1 from defi_guild_prize where week = w and tier = '*') then return done; end if;
  perform pg_advisory_xact_lock(hashtext('defi_guild_prize'));
  if exists (select 1 from defi_guild_prize where week = w and tier = '*') then return done; end if;
  for t in select distinct on (tier) tier, guild_id, name, score from lb_defi_guild_week where week = w and r = 1 order by tier, guild_id loop
    insert into defi_guild_prize (week, tier, guild_id, xp, score) values (w, t.tier, t.guild_id, x, t.score) on conflict do nothing;
    if found then
      update guilds set xp = xp + x where id = t.guild_id returning * into g;
      nl := g_lvl(g.xp);
      if nl > g.lvl then update guilds set lvl = nl where id = g.id; perform g_log(g.id, 'La guilde passe au niveau ' || nl || ' !'); end if;
      perform g_log(g.id, 'Défi du jour : la guilde finit 1re de la semaine (' || replace(to_char(t.score, 'FM999G999G999'), ',', ' ') || ' points) et gagne ' || replace(to_char(x, 'FM999G999G999'), ',', ' ') || ' XP de guilde !');
      done := done || jsonb_build_object('tier', t.tier, 'name', t.name);
    end if;
  end loop;
  insert into defi_guild_prize (week, tier) values (w, '*') on conflict do nothing;
  return done;
end $$;
revoke all on function public.defi_guild_prize() from public, anon;
grant execute on function public.defi_guild_prize() to authenticated;
-- saison : total du mois par palier (mois = année × 12 + mois - 1, comme E.defiMonth)
drop view if exists public.lb_defi_month;
create view public.lb_defi_month as
  select s.user_id, p.pseudo, l.main, l.main_lvl, s.month, s.tier, s.score, s.days,
    rank() over (partition by s.month, s.tier order by s.score desc, s.days desc) as r
  from (select user_id, (extract(year from date '1970-01-01' + day) * 12 + extract(month from date '1970-01-01' + day) - 1)::int as month, tier,
          sum(score)::int as score, count(*)::int as days from public.defi where score > 0 group by 1, 2, 3) s
  join public.ladder l on l.user_id = s.user_id join public.profiles p on p.id = s.user_id where not l.flagged;
grant select on public.lb_defi_month to anon, authenticated;
-- « Montrer dans le chat » : seulement un score validé par le serveur, une fois par jour et par palier (annonce dans le Général)
alter table public.defi add column if not exists shared boolean not null default false;
create or replace function public.defi_share(p_tier text) returns text language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d defi; mu timestamptz; bn boolean;
begin
  if me is null then return 'Connecte-toi pour montrer ton score.'; end if;
  select * into d from defi where user_id = me and day = defi_today() and tier = p_tier;
  if d.user_id is null or d.score <= 0 then return 'Valide d''abord ton score.'; end if;
  if d.shared then return 'Ton score du jour est déjà dans le chat.'; end if;
  select mute_until, banned into mu, bn from chat_sanctions where user_id = me;
  if coalesce(bn, false) or (mu is not null and mu > now()) then return 'Tu ne peux pas écrire dans le chat pour l''instant.'; end if;
  update defi set shared = true where user_id = me and day = d.day and tier = p_tier;
  perform chat_ann(me, jsonb_build_object('t', 'defi', 'tier', d.tier, 'did', d.did, 'score', d.score, 'turns', d.turns, 'rules', d.rules, 'team', d.team, 'day', d.day));
  return null;
end $$;
revoke all on function public.defi_share(text) from public, anon;
grant execute on function public.defi_share(text) to authenticated;
-- ---------- 1.1, série 4 : vote de la règle du Grand défi ----------
-- Du lundi au samedi, un vote par compte et par semaine (modifiable). Les 3 règles proposées et le choix de la gagnante
-- (le plus de votes parmi elles, égalité : la 1re proposée) sont calculés par le jeu et la fonction record (E.defiVoteOpts / E.defiVoteWin).
create table if not exists public.defi_vote (
  week int not null, user_id uuid not null references auth.users (id) on delete cascade, rule text not null,
  at timestamptz not null default now(), primary key (week, user_id)
);
alter table public.defi_vote enable row level security;
drop view if exists public.defi_vote_count;
create view public.defi_vote_count as
  select v.week, v.rule, count(*)::int as n from public.defi_vote v join public.ladder l on l.user_id = v.user_id where not l.flagged group by v.week, v.rule;
grant select on public.defi_vote_count to anon, authenticated;
create or replace function public.defi_vote(p_week int, p_rule text) returns text language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d int := defi_today();
begin
  if me is null then return 'Connecte-toi pour voter.'; end if;
  if p_week is distinct from (d + 3) / 7 then return 'Ce vote est terminé.'; end if;
  if (d + 4) % 7 = 0 then return 'Le vote est fermé le dimanche : il rouvre lundi.'; end if;
  if p_rule not in ('survivant', 'versatile', 'econome', 'focus', 'elitiste', 'incurable', 'elementaire', 'barbare', 'rapide') then return 'Règle inconnue.'; end if;
  if not exists (select 1 from ladder where user_id = me and not flagged) then return 'Joue en ligne (partie 1) pour voter.'; end if;
  insert into defi_vote (week, user_id, rule) values (p_week, me, p_rule) on conflict (week, user_id) do update set rule = excluded.rule, at = now();
  return null;
end $$;
revoke all on function public.defi_vote(int, text) from public, anon;
grant execute on function public.defi_vote(int, text) to authenticated;
