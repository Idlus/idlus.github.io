-- ============================================================================
-- BOSS DES MONDES — Idlus (0.1.49)
-- Tout le serveur frappe le même boss : une barre de PV commune (en points ; 1 point = 100 PV affichés).
-- Chaque joueur a 3 essais par jour (heure de Paris). L'essai est joué par la fonction serveur « record »
-- sur la partie en ligne (js/wboss.js, E.wbSim) ; ici on compte les essais, la barre, les récompenses,
-- les annonces du chat général et la rotation : quand la barre tombe à zéro, le boss suivant arrive aussitôt,
-- avec des PV ajustés pour qu'il tienne environ un jour.
-- Mêmes règles que js/wboss.js (E.WB_GRADES, E.WB_KILL, E.wbPhase, E.WB_ROT : 9 boss).
-- S'appuie sur hdv.sql (hdv_op), chat.sql (chat_msgs, pseudo_of), guildes.sql (g_err) et gboss.sql (gb_day).
-- ============================================================================

-- le boss en cours (une seule ligne)
create table if not exists public.wb_state (
  id int primary key default 1 check (id = 1),
  n int not null default 1,                 -- numéro du boss (1 = Gargandyas, puis la rotation de 9)
  hp bigint not null,                       -- PV du boss, en points
  dmg bigint not null default 0,            -- points déjà infligés
  started timestamptz not null default now(),
  bonus_until timestamptz                   -- +10 % d'XP pour tout le monde après une victoire
);
alter table public.wb_state enable row level security;
insert into public.wb_state (id, n, hp) values (1, 1, 10000) on conflict (id) do nothing;
-- 0.1.50.3 : les vrais essais font environ 90 points ; 20 000 auraient tenu près d'une semaine, 10 000 tiennent environ 2 jours (choix G4)
update public.wb_state set hp = 10000 where id = 1 and n = 1 and hp = 20000;

create table if not exists public.wb_hits (
  id bigint generated always as identity primary key,
  n int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  k int not null,                           -- numéro de l'essai sur ce boss (fixe le hasard)
  day date not null,
  points int not null, grade text not null, phase int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null default now(),
  unique (user_id, n, k)
);
create index if not exists wb_hits_n on public.wb_hits (n, user_id);
create index if not exists wb_hits_day on public.wb_hits (user_id, day);
alter table public.wb_hits enable row level security;

-- les boss tombés
create table if not exists public.wb_kills (
  n int primary key,
  hp bigint not null, started timestamptz not null, ended timestamptz not null default now(),
  last_user uuid, players int not null default 0, top jsonb not null default '[]'::jsonb
);
alter table public.wb_kills enable row level security;
alter table public.wb_kills add column if not exists posted timestamptz; -- annoncé sur Discord (workflow « Boss des mondes sur Discord »)

-- 0.1.56 « Boss des mondes rééquilibré » : chaque essai = moyenne de 3 combats, points selon niveau, équipement et nombre de héros
-- (environ 5 fois moins de points). Une seule fois : les essais du boss en cours partent dans wb_hits_old (classement remis à zéro
-- et essais du jour rendus), ses PV et dégâts sont divisés par 5 (il garde la même part de PV). Coffres et Fragments déjà gagnés
-- restent dans les sacs (donnés par hdv_op), et ceux qui avaient frappé comptent toujours pour la récompense de mort (choix 6A).
create table if not exists public.wb_hits_old (
  id bigint primary key, n int not null, user_id uuid not null references auth.users (id) on delete cascade,
  k int not null, day date not null, points int not null, grade text not null, phase int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null, archived_at timestamptz not null default now()
);
create index if not exists wb_hits_old_n on public.wb_hits_old (n, user_id);
alter table public.wb_hits_old enable row level security;
create table if not exists public.wb_resets (id text primary key, at timestamptz not null default now(), info jsonb);
alter table public.wb_resets enable row level security;
do $$ declare s record; moved int; begin
  if exists (select 1 from public.wb_resets where id = '0.1.56') then return; end if;
  select * into s from public.wb_state where id = 1;
  insert into public.wb_hits_old (id, n, user_id, k, day, points, grade, phase, lvl, rounds, alive, at)
    select id, n, user_id, k, day, points, grade, phase, lvl, rounds, alive, at from public.wb_hits where n = s.n;
  get diagnostics moved = row_count;
  delete from public.wb_hits where n = s.n;
  update public.wb_state set hp = greatest(1, round(hp / 5.0)), dmg = round(dmg / 5.0) where id = 1;
  insert into public.wb_resets (id, info) values ('0.1.56', jsonb_build_object('n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'hits', moved));
end $$;
-- 1.0.4.6 : un essai compte le total de ses 3 combats (avant : la moyenne). Une seule fois, le boss en cours (Kolosso) passe à la
-- même échelle : ses essais déjà faits, ses PV et ses dégâts sont multipliés par 3 (même part de PV, mêmes grades ; choix 2A de Mathis).
do $$ declare s record; moved int; begin
  if exists (select 1 from public.wb_resets where id = '1.0.4.6') then return; end if;
  select * into s from public.wb_state where id = 1;
  update public.wb_hits set points = points * 3 where n = s.n;
  get diagnostics moved = row_count;
  update public.wb_hits_old set points = points * 3 where n = s.n;
  update public.wb_state set hp = hp * 3, dmg = dmg * 3 where id = 1;
  insert into public.wb_resets (id, info) values ('1.0.4.6', jsonb_build_object('n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'hits', moved));
end $$;

-- ---------- outils internes ----------
create or replace function public.wb_grade(p int) returns text language sql immutable
as $$ select case when p >= 1500 then 'SSS' when p >= 1050 then 'SS' when p >= 600 then 'S' when p >= 300 then 'A' when p >= 150 then 'B' else 'C' end $$;
create or replace function public.wb_frag(g text) returns int language sql immutable
as $$ select case g when 'SSS' then 6 when 'SS' then 5 when 'S' then 4 when 'A' then 3 when 'B' then 2 else 1 end $$;
create or replace function public.wb_cons(g text) returns jsonb language sql immutable
as $$ select case g when 'SSS' then '{"coffre_obsidienne":1}' when 'SS' then '{"coffre_or":1}' when 'S' then '{"coffre_argent":2}'
  when 'A' then '{"coffre_argent":1}' when 'B' then '{"coffre_bois":2}' else '{"coffre_bois":1}' end::jsonb $$;
create or replace function public.wb_phase(d bigint, hp bigint) returns int language sql immutable
as $$ select case when hp <= 0 then 1 when d * 3 >= hp * 2 then 3 when d * 3 >= hp then 2 else 1 end $$;
-- nom du boss n (même ordre que E.WB_ROT dans js/wboss.js)
create or replace function public.wb_name(n int) returns text language sql immutable
as $$ select (array['Gargandyas', 'Kolosso', 'Korriandre', 'Comte Harebourg', 'Ougah', 'Roi Nidas', 'Ilyzaelle', 'Nileza', 'Vortex'])[((n - 1) % 9) + 1] $$;
create or replace function public.wb_top(p_n int, lim int default 10) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x.pts desc), '[]'::jsonb) from (
  select user_id u, pseudo_of(user_id) p, sum(points)::bigint pts, count(*) n, max(points) best from wb_hits where n = p_n group by user_id order by sum(points) desc limit lim) x $$;
create or replace function public.wb_ann(p_data jsonb, p_user uuid default null) returns void language sql security definer set search_path = public
as $$ insert into chat_msgs (ch, user_id, pseudo, kind, data) values ('g', p_user, case when p_user is null then null else pseudo_of(p_user) end, 'ann', p_data || jsonb_build_object('t', 'wb')) $$;

do $$ declare f text; begin
  foreach f in array array['wb_top(int, int)', 'wb_ann(jsonb, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- premier boss : son arrivée est annoncée une fois dans le chat général
do $$ begin
  if not exists (select 1 from chat_msgs where kind = 'ann' and data->>'t' = 'wb') then
    perform wb_ann(jsonb_build_object('ev', 'arr', 'n', 1, 'name', wb_name(1)));
  end if;
end $$;

-- ---------- lecture : le boss en cours (aussi pour les joueurs sans compte) ----------
create or replace function public.wb_info() returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare me uuid := auth.uid(); s wb_state; mine jsonb := null; k wb_kills;
begin
  select * into s from wb_state where id = 1;
  if me is not null then
    mine := jsonb_build_object(
      'today', (select count(*) from wb_hits where user_id = me and day = gb_day()),
      'pts', (select coalesce(sum(points), 0) from wb_hits where user_id = me and n = s.n),
      'best', (select max(points) from wb_hits where user_id = me and n = s.n),
      'rank', (select 1 + count(*) from (select sum(points) t from wb_hits where n = s.n group by user_id) x
               where x.t > (select coalesce(sum(points), 0) from wb_hits where user_id = me and n = s.n)));
  end if;
  select * into k from wb_kills order by n desc limit 1;
  return jsonb_build_object('n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'started', s.started, 'phase', wb_phase(s.dmg, s.hp), 'bonus', s.bonus_until, 'now', now(),
    'players', (select count(*) from (select user_id from wb_hits where n = s.n union select user_id from wb_hits_old where n = s.n) x), 'top', wb_top(s.n, 10), 'me', mine,
    'last', case when k.n is null then null else jsonb_build_object('n', k.n, 'name', wb_name(k.n), 'ended', k.ended, 'dur', extract(epoch from (k.ended - k.started))::int,
      'by', pseudo_of(k.last_user), 'top', k.top, 'players', k.players) end);
end $$;
revoke all on function public.wb_info() from public;
grant execute on function public.wb_info() to anon, authenticated;

-- ---------- appelées par la fonction serveur « record » (clé de service) ----------
-- Vérifie qu'il reste un essai aujourd'hui ; donne le boss, sa phase et le numéro de l'essai (hasard).
create or replace function public.wb_start(p_user uuid) returns jsonb language plpgsql security definer set search_path = public
as $$
declare s wb_state;
begin
  if not exists (select 1 from profiles where id = p_user) then return g_err('Crée ton compte pour frapper le boss.'); end if;
  if (select count(*) from wb_hits where user_id = p_user and day = gb_day()) >= 3 then return g_err('Plus d''essai aujourd''hui : reviens après minuit.'); end if;
  select * into s from wb_state where id = 1;
  return jsonb_build_object('ok', true, 'n', s.n, 'phase', wb_phase(s.dmg, s.hp), 'k', (select count(*) from wb_hits where user_id = p_user and n = s.n));
end $$;

-- Enregistre l'essai rejoué : coffre du grade et Fragments, barre commune, phases, mort et rotation.
create or replace function public.wb_done(p_user uuid, p_n int, p_k int, p_points int, p_phase int, p_lvl int, p_rounds int, p_alive int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare s wb_state; g text; pts int := greatest(0, p_points); before bigint; after bigint; ph0 int; ph1 int; killed boolean := false;
  t3 jsonb; r record; dur numeric; nhp bigint; nm text; pl int; i int;
begin
  perform pg_advisory_xact_lock(hashtext('wboss'));
  select * into s from wb_state where id = 1 for update;
  if s.n <> p_n then return g_err('Le boss vient de tomber ! Ton essai n''est pas compté : frappe le suivant.'); end if;
  if (select count(*) from wb_hits where user_id = p_user and day = gb_day()) >= 3 then return g_err('Plus d''essai aujourd''hui : reviens après minuit.'); end if;
  g := wb_grade(pts);
  begin
    insert into wb_hits (n, user_id, k, day, points, grade, phase, lvl, rounds, alive) values (p_n, p_user, p_k, gb_day(), pts, g, p_phase, p_lvl, p_rounds, p_alive);
  exception when unique_violation then return g_err('Essai déjà compté.'); end;
  perform hdv_op(p_user, jsonb_build_object('cons', wb_cons(g), 'res', jsonb_build_object('Fragment d''anomalie', wb_frag(g))),
    format('Boss des mondes : grade %s contre %s (%s PV), coffre et %s Fragments d''anomalie', g, wb_name(p_n), pts * 100, wb_frag(g)));
  before := s.dmg; after := least(s.hp, s.dmg + pts); nm := wb_name(p_n);
  ph0 := wb_phase(before, s.hp); ph1 := wb_phase(after, s.hp);
  update wb_state set dmg = after where id = 1;
  if after >= s.hp then
    killed := true;
    t3 := wb_top(p_n, 3);
    select count(*) into pl from (select user_id from wb_hits where n = p_n union select user_id from wb_hits_old where n = p_n) x;
    insert into wb_kills (n, hp, started, last_user, players, top) values (p_n, s.hp, s.started, p_user, pl, t3) on conflict (n) do nothing;
    -- tous ceux qui l'ont frappé : Coffre en or et 10 Fragments ; au premier passage de Gargandyas, le titre « Briseur de Titan »
    for r in select user_id from wb_hits where n = p_n union select user_id from wb_hits_old where n = p_n loop
      perform hdv_op(r.user_id, jsonb_build_object('cons', jsonb_build_object('coffre_or', 1), 'res', jsonb_build_object('Fragment d''anomalie', 10))
        || case when p_n = 1 then jsonb_build_object('title', 'Briseur de Titan') else '{}'::jsonb end,
        format('%s est tombé : Coffre en or et 10 Fragments d''anomalie%s', nm, case when p_n = 1 then ', titre « Briseur de Titan »' else '' end));
    end loop;
    -- l'ancien podium perd le titre « Fléau des mondes », le nouveau le reçoit avec un Coffre des Douze et 30 Fragments
    for r in select distinct (e->>'u')::uuid u from wb_kills k, jsonb_array_elements(k.top) e where k.n = p_n - 1 loop
      if not exists (select 1 from jsonb_array_elements(t3) e where (e->>'u')::uuid = r.u) then
        perform hdv_op(r.u, jsonb_build_object('untitle', 'Fléau des mondes'), 'Boss des mondes : le titre « Fléau des mondes » passe au nouveau podium.');
      end if;
    end loop;
    i := 0;
    for r in select (e->>'u')::uuid u from jsonb_array_elements(t3) e loop
      i := i + 1;
      perform hdv_op(r.u, jsonb_build_object('cons', jsonb_build_object('coffre_douze', 1), 'res', jsonb_build_object('Fragment d''anomalie', 30), 'title', 'Fléau des mondes'),
        format('%s est tombé : tu finis %s du classement ! Coffre des Douze, 30 Fragments d''anomalie et titre « Fléau des mondes »', nm, case i when 1 then '1er' else i || 'e' end));
    end loop;
    -- le suivant : PV ajustés pour tenir environ un jour (entre la moitié et le double)
    dur := greatest(600, extract(epoch from (now() - s.started)));
    nhp := greatest(1800, least(s.hp * 2, greatest(s.hp / 2, round(s.hp * 86400 / dur))));
    if p_n = 1 then nhp := greatest(1800, least(s.hp, round(s.hp * 86400 / dur))); end if; -- Gargandyas avait des PV pour 2 jours
    update wb_state set n = p_n + 1, hp = nhp, dmg = 0, started = now(), bonus_until = now() + interval '1 hour' where id = 1;
    perform wb_ann(jsonb_build_object('ev', 'dead', 'n', p_n, 'name', nm, 'dur', round(dur)::int, 'top', (select coalesce(jsonb_agg(e->>'p'), '[]'::jsonb) from jsonb_array_elements(t3) e), 'players', pl), p_user);
    perform wb_ann(jsonb_build_object('ev', 'arr', 'n', p_n + 1, 'name', wb_name(p_n + 1)));
  elsif ph1 > ph0 then
    perform wb_ann(jsonb_build_object('ev', 'ph', 'n', p_n, 'name', nm, 'ph', ph1));
  end if;
  return jsonb_build_object('ok', true, 'grade', g, 'frag', wb_frag(g), 'cons', wb_cons(g), 'dmg', after, 'before', before, 'hp', s.hp, 'killed', killed,
    'left', 3 - (select count(*) from wb_hits where user_id = p_user and day = gb_day()),
    'rank', (select 1 + count(*) from (select sum(points) t from wb_hits where n = p_n group by user_id) x where x.t > (select sum(points) from wb_hits where user_id = p_user and n = p_n)));
end $$;

do $$ declare f text; begin
  foreach f in array array['wb_start(uuid)', 'wb_done(uuid, int, int, int, int, int, int, int)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
