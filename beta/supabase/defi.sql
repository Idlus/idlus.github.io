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
create or replace view public.lb_defi as
  select d.user_id, p.pseudo, l.main, d.day, d.tier, d.turns, d.hp, d.team, d.at,
    rank() over (partition by d.day, d.tier order by d.turns asc, d.hp desc, d.at asc) as r
  from public.defi d join public.ladder l on l.user_id = d.user_id join public.profiles p on p.id = d.user_id where not l.flagged;
grant select on public.lb_defi to anon, authenticated;
