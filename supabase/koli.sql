-- ============================================================================
-- KOLIZÉUM — Idlus (0.1.44). Arène 3 contre 3, saisons d'une semaine (lundi 00:00, heure de Paris).
-- Le combat est joué par la fonction serveur « record » ({ koli: ... }) avec la partie en ligne du joueur
-- (js/koli.js, E.koliSim) ; ici on garde la cote, l'équipe d'arène de chacun (elle défend), les combats
-- (rejouables : graine + équipes) et la fin de chaque semaine (rang, cote à mi-chemin de 1 000).
-- S'appuie sur classements.sql (ladder, profiles) et gboss.sql (gb_day, gb_week).
-- Relançable sans danger.
-- ============================================================================

-- ---------- la fiche de chaque joueur ----------
create table if not exists public.koli (
  user_id uuid primary key references auth.users (id) on delete cascade,
  w int not null,                                   -- semaine de la cote (E.koliWeek)
  cote int not null default 1000,
  best int not null default 1000,                   -- meilleure cote de la semaine
  n int not null default 0,                         -- combats classés de la semaine (5 pour la récompense)
  win int not null default 0, loss int not null default 0,
  dwin int not null default 0, dloss int not null default 0,
  team jsonb,                                       -- équipe d'arène (copie faite par le serveur) : elle défend
  lvl int not null default 1,                       -- niveau moyen de l'équipe d'arène
  heads jsonb not null default '[]'::jsonb,         -- classes, sexes, têtes, niveaux (ce que voient les autres)
  day date, nday int not null default 0,            -- combats classés du jour (garde-fou)
  promo int not null default 0,                     -- plus haut grade annoncé cette semaine (0 bronze … 4 diamant)
  at timestamptz not null default now()
);
create index if not exists koli_w on public.koli (w, cote desc);
alter table public.koli enable row level security;
drop policy if exists "koli : sa fiche" on public.koli;
create policy "koli : sa fiche" on public.koli for select using (auth.uid() = user_id);

-- ---------- semaines finies ----------
create table if not exists public.koli_weeks (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null, cote int not null, n int not null, rank int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, w)
);
alter table public.koli_weeks enable row level security;
drop policy if exists "koli : ses semaines" on public.koli_weeks;
create policy "koli : ses semaines" on public.koli_weeks for select using (auth.uid() = user_id);

-- ---------- combats (attaques et défenses), rejouables ----------
create table if not exists public.koli_fights (
  id bigint generated always as identity primary key,
  w int not null,
  at timestamptz not null default now(),
  att uuid not null references auth.users (id) on delete cascade,
  def uuid references auth.users (id) on delete cascade,   -- vide : un Fantôme
  ghost bigint,                                            -- graine du Fantôme
  att_name text, def_name text,
  att_team jsonb not null, def_team jsonb not null,
  seed bigint not null,
  win boolean not null,                                    -- l'attaquant gagne
  rounds int, d_att int not null default 0, d_def int not null default 0,
  att_cote int, def_cote int
);
create index if not exists koli_fights_att on public.koli_fights (att, id desc);
create index if not exists koli_fights_def on public.koli_fights (def, id desc);
alter table public.koli_fights enable row level security;
drop policy if exists "koli : ses combats" on public.koli_fights;
create policy "koli : ses combats" on public.koli_fights for select using (auth.uid() = att or auth.uid() = def);

-- ---------- outils ----------
-- cote ramenée à mi-chemin de 1 000 (E.koliSoft)
create or replace function public.koli_soft(c int) returns int language sql immutable as $$ select round(1000 + (c - 1000) / 2.0)::int $$;
-- rang final d'une semaine (au moins 5 combats) : fiches déjà closes + fiches restées sur cette semaine
create or replace function public.koli_rank(wk int, c int) returns int language sql stable security definer set search_path = public
as $$ select 1 + (select count(*) from koli_weeks where w = wk and n >= 5 and cote > c)::int + (select count(*) from koli where w = wk and n >= 5 and cote > c)::int $$;

-- La fiche d'un joueur pour la semaine wk : créée au besoin ; si sa semaine est finie, on la clôt
-- (rang, cote à mi-chemin). Appelée par la fonction serveur (rôle service) seulement.
create or replace function public.koli_row(p_user uuid, p_w int) returns public.koli language plpgsql security definer set search_path = public
as $$
declare k koli;
begin
  insert into koli (user_id, w) values (p_user, p_w) on conflict (user_id) do nothing;
  select * into k from koli where user_id = p_user for update;
  if k.w < p_w then
    if k.n > 0 then
      insert into koli_weeks (user_id, w, cote, n, rank) values (p_user, k.w, k.cote, k.n, case when k.n >= 5 then koli_rank(k.w, k.cote) else 0 end)
        on conflict (user_id, w) do nothing;
    end if;
    update koli set w = p_w, cote = koli_soft(k.cote), best = koli_soft(k.cote), n = 0, promo = 0 where user_id = p_user returning * into k;
  end if;
  return k;
end $$;
revoke all on function public.koli_row(uuid, int) from public, anon, authenticated;

-- L'équipe d'arène du joueur (copie faite par le serveur depuis sa partie en ligne).
create or replace function public.koli_team(p_user uuid, p_w int, p_team jsonb, p_lvl int, p_heads jsonb) returns public.koli language plpgsql security definer set search_path = public
as $$
declare k koli;
begin
  perform koli_row(p_user, p_w);
  update koli set team = p_team, lvl = greatest(1, p_lvl), heads = coalesce(p_heads, '[]'::jsonb), at = now() where user_id = p_user returning * into k;
  return k;
end $$;
revoke all on function public.koli_team(uuid, int, jsonb, int, jsonb) from public, anon, authenticated;

-- Trois adversaires réels autour de la cote (au hasard parmi les plus proches), actifs depuis 2 semaines,
-- pas soi-même, pas un joueur en vérification, pas plus de 3 fois le même par jour.
create or replace function public.koli_opps(p_user uuid, p_w int, p_cote int) returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select k.user_id id, p.pseudo name, case when k.w < p_w then koli_soft(k.cote) else k.cote end cote, k.lvl, k.heads, k.team
    from koli k join profiles p on p.id = k.user_id left join ladder l on l.user_id = k.user_id
    where k.user_id <> p_user and k.team is not null and jsonb_array_length(k.team) > 0 and k.w >= p_w - 2 and not coalesce(l.flagged, false)
      and (select count(*) from koli_fights f where f.att = p_user and f.def = k.user_id and f.at > now() - interval '1 day') < 3
    order by abs(case when k.w < p_w then koli_soft(k.cote) else k.cote end - p_cote) + random() * 120
    limit 3) x
$$;
revoke all on function public.koli_opps(uuid, int, int) from public, anon, authenticated;

-- Un combat classé fini : cotes des deux côtés, journal, garde-fou du jour, annonce des promotions (Or et plus).
create or replace function public.koli_done(p_user uuid, p_w int, p_def uuid, p_ghost bigint, p_att_name text, p_def_name text, p_att_team jsonb, p_def_team jsonb,
  p_seed bigint, p_win boolean, p_rounds int, p_d_att int, p_d_def int, p_def_cote int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare a koli; d koli; fid bigint; g int; ann boolean := false;
begin
  a := koli_row(p_user, p_w);
  if a.day is distinct from gb_day() then update koli set day = gb_day(), nday = 0 where user_id = p_user; a.nday := 0; end if;
  if a.nday >= 60 then return jsonb_build_object('err', 'Assez de combats pour aujourd''hui : reviens demain.'); end if;
  update koli set cote = greatest(0, cote + p_d_att), best = greatest(best, cote + p_d_att), n = n + 1, nday = nday + 1,
    win = win + (case when p_win then 1 else 0 end), loss = loss + (case when p_win then 0 else 1 end), at = now()
    where user_id = p_user returning * into a;
  if p_def is not null then
    d := koli_row(p_def, p_w);
    update koli set cote = greatest(0, cote + p_d_def), dwin = dwin + (case when p_win then 0 else 1 end), dloss = dloss + (case when p_win then 1 else 0 end)
      where user_id = p_def returning * into d;
  end if;
  insert into koli_fights (w, att, def, ghost, att_name, def_name, att_team, def_team, seed, win, rounds, d_att, d_def, att_cote, def_cote)
    values (p_w, p_user, p_def, p_ghost, p_att_name, p_def_name, p_att_team, p_def_team, p_seed, p_win, p_rounds, p_d_att, p_d_def, a.cote, coalesce(d.cote, p_def_cote))
    returning id into fid;
  -- grade atteint (mêmes seuils que E.KOLI_GRADES) : Or, Cristal et Diamant sont annoncés dans le salon PvP du chat (0.1.48.2), une fois par semaine
  g := case when a.cote >= 1700 then 4 when a.cote >= 1500 then 3 when a.cote >= 1300 then 2 when a.cote >= 1100 then 1 else 0 end;
  if g >= 2 and g > a.promo then
    update koli set promo = g where user_id = p_user;
    insert into chat_msgs (ch, user_id, pseudo, cls, lvl, kind, data)
      select 'v', p_user, pr.pseudo, l.main, l.main_lvl, 'ann', jsonb_build_object('t', 'koli', 'g', g, 'cote', a.cote)
      from profiles pr left join ladder l on l.user_id = pr.id where pr.id = p_user and not coalesce(l.flagged, false);
    ann := true;
  end if;
  return jsonb_build_object('id', fid, 'cote', a.cote, 'n', a.n, 'rank', case when a.n >= 1 then 1 + (select count(*) from koli where w = p_w and n >= 1 and cote > a.cote) else 0 end, 'ann', ann);
end $$;
revoke all on function public.koli_done(uuid, int, uuid, bigint, text, text, jsonb, jsonb, bigint, boolean, int, int, int, int) from public, anon, authenticated;

-- ---------- ce que le jeu lit ----------
-- Sa fiche (semaine close au besoin), son rang et ses semaines finies.
create or replace function public.koli_me(p_w int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare k koli; uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  k := koli_row(uid, p_w);
  return jsonb_build_object('cote', k.cote, 'best', k.best, 'n', k.n, 'w', k.w, 'win', k.win, 'loss', k.loss, 'dwin', k.dwin, 'dloss', k.dloss, 'team', k.heads,
    'rank', case when k.n >= 1 then 1 + (select count(*) from koli where w = p_w and n >= 1 and cote > k.cote) else 0 end,
    'players', (select count(*) from koli where w = p_w and n >= 1),
    'weeks', (select coalesce(jsonb_agg(x order by x.w), '[]'::jsonb) from (select w, cote, n, rank from koli_weeks where user_id = uid and w >= p_w - 4) x));
end $$;
grant execute on function public.koli_me(int) to authenticated;

-- Classement de la semaine (au moins un combat classé) : pseudo, cote, combats, équipe vue de loin.
create or replace view public.lb_koli as
  select k.user_id, p.pseudo, k.w, k.cote, k.n, k.win, k.loss, k.heads,
    rank() over (partition by k.w order by k.cote desc, k.at asc) as r
  from public.koli k join public.profiles p on p.id = k.user_id left join public.ladder l on l.user_id = k.user_id
  where k.n >= 1 and not coalesce(l.flagged, false);
grant select on public.lb_koli to anon, authenticated;
