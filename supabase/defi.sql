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
drop view if exists public.lb_defi_week;
create view public.lb_defi_week as
  select w.user_id, p.pseudo, l.main, l.main_lvl, w.week, w.tier, w.score, w.days,
    rank() over (partition by w.week, w.tier order by w.score desc, w.days desc) as r
  from (select user_id, (day + 3) / 7 as week, tier, sum(score)::int as score, count(*)::int as days from public.defi where score > 0 group by user_id, (day + 3) / 7, tier) w
  join public.ladder l on l.user_id = w.user_id join public.profiles p on p.id = w.user_id where not l.flagged;
grant select on public.lb_defi_week to anon, authenticated;
