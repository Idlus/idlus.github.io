-- ============================================================================
-- BOSS DES MONDES — règles de la Saison 1 (refonte validée par Mathis le 03/11/2026)
-- Fichier PROPRE À LA SAISON : jamais installé dans le Classique / l'Éternel. tools/saison_schema.js l'ajoute à la fin de
-- supabase/saison1.sql (liste EXTRA) en remplaçant public. par s1. : il passe APRÈS la copie de wboss.sql et remplace
-- wb_info, wb_start et wb_done de l'espace s1. Mêmes règles que js/wboss.js (E.WB_S1, E.wbS1Def).
--  1A un boss par semaine de saison (s1_cfg.debut + 7 jours × n), qui s'enfuit à la fin de sa semaine ;
--     PV de la semaine suivante = 70 % des dégâts de la semaine passée (essais après sa mort compris), ±30 % au plus d'une semaine à l'autre
--  2A paliers du serveur à 25, 50, 75 et 100 % : tous ceux qui ont frappé ce boss (même plus tard dans la semaine) les reçoivent
--  3A paliers d'essais de la semaine (Bronze 3, Argent 9, Or 18) et podium du meilleur essai (titre « Fléau des mondes »)
--  4B Fragments d'anomalie à chaque essai selon le grade (comme le Classique)
--  plafond de 6 000 points par essai (au-dessus : compté 6 000, noté dans wb_flags pour Xener)
-- S'appuie sur wboss.sql (tables wb_*), saison1_vitrine.sql (s1_cfg), hdv.sql (hdv_op), chat.sql, gboss.sql (gb_day).
-- ============================================================================

alter table public.wb_kills add column if not exists fled boolean not null default false;   -- semaine finie sans le tuer
alter table public.wb_kills add column if not exists cap bigint;                              -- dégâts de toute la semaine (PV de la suivante)
alter table public.wb_kills add column if not exists recap timestamptz;                       -- bilan du lundi posté sur Discord
create table if not exists public.wb_pal (n int not null, user_id uuid not null references auth.users (id) on delete cascade, p int not null, at timestamptz not null default now(), primary key (n, user_id, p));
alter table public.wb_pal enable row level security;
create table if not exists public.wb_tiers (n int not null, user_id uuid not null references auth.users (id) on delete cascade, tier text not null, at timestamptz not null default now(), primary key (n, user_id, tier));
alter table public.wb_tiers enable row level security;
create table if not exists public.wb_flags (id bigint generated always as identity primary key, n int not null, user_id uuid not null, points int not null, at timestamptz not null default now());
alter table public.wb_flags enable row level security;

-- ---------- règles ----------
create or replace function public.wb_s1_rot(w int) returns text language sql immutable
as $$ select (array['garga', 'kralamoure', 'cire_momore', 'grozilla', 'chazino', 'garga', 'kralamoure', 'cire_momore'])[((greatest(1, w) - 1) % 8) + 1] $$;
create or replace function public.wb_name(n int) returns text language sql immutable
as $$ select case wb_s1_rot(n) when 'garga' then 'Gargandyas' when 'kralamoure' then 'Kralamoure Géant' when 'cire_momore' then 'Cire Momore'
  when 'grozilla' then 'Grozilla et Grasmera' else 'Chazino' end $$;
-- semaine de saison en cours (1…8 ; 1 tant que la date d'ouverture n'est pas posée)
create or replace function public.wb_week() returns int language sql stable security definer set search_path = public
as $$ select greatest(1, least(8, coalesce(floor(extract(epoch from (now() - (select debut from s1_cfg where id = 1))) / 604800)::int + 1, 1))) $$;
create or replace function public.wb_week_end(w int) returns timestamptz language sql stable security definer set search_path = public
as $$ select coalesce((select debut from s1_cfg where id = 1), date_trunc('week', now())) + make_interval(days => 7 * w) $$;
create or replace function public.wb_cap(p int) returns int language sql immutable as $$ select least(6000, greatest(0, p)) $$;
-- « Dernier soir » (Mathis 03/11) : le dernier soir de la semaine du boss (le dimanche quand la saison s'ouvre un lundi), de 20 h à 22 h
-- (Paris), si le boss a perdu 75 % de ses PV sans tomber, chacun reçoit
-- un 4e essai ce jour-là pour l'achever avant sa fuite. p_grace laisse 15 min de plus pour compter un essai commencé avant 22 h.
create or replace function public.wb_last_night(p_grace boolean default false, p_at timestamptz default now()) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from wb_state s where s.id = 1 and s.dmg * 4 >= s.hp * 3 and s.dmg < s.hp
    and not exists (select 1 from wb_kills k where k.n = s.n and not k.fled)
    and (p_at at time zone 'Europe/Paris')::time >= time '20:00'
    and (p_at at time zone 'Europe/Paris')::time < case when p_grace then time '22:15' else time '22:00' end
    and wb_week_end(s.n) - p_at < interval '1 day' and wb_week_end(s.n) > p_at) $$;
create or replace function public.wb_max(p_grace boolean default false) returns int language sql stable security definer set search_path = public
as $$ select case when wb_last_night(p_grace) then 4 else 3 end $$;
-- podium du meilleur essai de la semaine
create or replace function public.wb_best(p_n int, lim int default 10) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x.best desc), '[]'::jsonb) from (
  select user_id u, pseudo_of(user_id) p, max(points) best, count(*) n, sum(points)::bigint pts from wb_hits where n = p_n group by user_id order by max(points) desc limit lim) x $$;

-- Ferme la semaine passée (fuite ou mort déjà notée), donne le podium et ouvre le boss de la semaine. Appelée par wb_info, wb_start, wb_done.
create or replace function public.wb_roll() returns void language plpgsql security definer set search_path = public
as $$
declare s wb_state; w int := wb_week(); wcap bigint; prev bigint; nhp bigint; t3 jsonb; r record; pl int;
begin
  select * into s from wb_state where id = 1;
  if s.n >= w then return; end if;
  perform pg_advisory_xact_lock(hashtext('wboss'));
  select * into s from wb_state where id = 1 for update;
  if s.n >= w then return; end if;
  select coalesce(sum(points), 0) into wcap from wb_hits where n = s.n;
  select count(distinct user_id) into pl from wb_hits where n = s.n;
  t3 := wb_best(s.n, 3);
  if wcap > 0 then
    if not exists (select 1 from wb_kills where n = s.n) then
      insert into wb_kills (n, hp, started, last_user, players, top, fled, cap) values (s.n, s.hp, s.started, null, pl, t3, true, wcap);
      perform wb_ann(jsonb_build_object('ev', 'fled', 'n', s.n, 'name', wb_name(s.n), 'pct', round(100.0 * s.dmg / greatest(1, s.hp)), 'players', pl));
    else update wb_kills set cap = wcap, top = t3 where n = s.n; end if;
    -- podium du meilleur essai : titre « Fléau des mondes » (repris à l'ancien podium) et 30 Fragments
    for r in select distinct (e->>'u')::uuid u from wb_kills k, jsonb_array_elements(k.top) e where k.n < s.n and k.n = (select max(n) from wb_kills where n < s.n) loop
      if not exists (select 1 from jsonb_array_elements(t3) e where (e->>'u')::uuid = r.u) then
        perform hdv_op(r.u, jsonb_build_object('untitle', 'Fléau des mondes'), 'Boss des mondes : le titre « Fléau des mondes » passe au nouveau podium.');
      end if;
    end loop;
    for r in select (e->>'u')::uuid u, row_number() over () i from jsonb_array_elements(t3) e loop
      perform hdv_op(r.u, jsonb_build_object('res', jsonb_build_object('Fragment d''anomalie', 30), 'title', 'Fléau des mondes'),
        format('Boss des mondes : meilleur essai de la semaine contre %s, tu finis %s ! 30 Fragments d''anomalie et titre « Fléau des mondes »', wb_name(s.n), case r.i when 1 then '1er' else r.i || 'e' end));
    end loop;
  end if;
  select k.cap into prev from wb_kills k where k.n = s.n - 1;
  nhp := case when wcap <= 0 then s.hp else round(0.7 * wcap * least(1.3, greatest(0.7, case when coalesce(prev, 0) > 0 then wcap::numeric / prev else 1.2 end))) end;
  nhp := greatest(2000, nhp);
  update wb_state set n = w, hp = nhp, dmg = 0, started = now(), bonus_until = null where id = 1;
  perform wb_ann(jsonb_build_object('ev', 'arr', 'n', w, 'name', wb_name(w), 's1', true));
end $$;

-- paliers du serveur atteints (2A) : chacun reçoit ceux qui lui manquent (aussi en arrivant après le palier)
create or replace function public.wb_pal_give(p_n int, p_dmg bigint, p_hp bigint, p_only uuid default null) returns void language plpgsql security definer set search_path = public
as $$
declare p int; r record; c jsonb; f int; nm text := wb_name(p_n);
begin
  foreach p in array array[25, 50, 75, 100] loop
    exit when p_dmg * 100 < p_hp * p;
    c := case p when 25 then '{"coffre_argent":1}' when 50 then '{"coffre_or":1}' when 75 then '{"coffre_or":1}' else '{"coffre_douze":1}' end::jsonb;
    f := case p when 25 then 2 when 50 then 3 when 75 then 5 else 10 end;
    for r in insert into wb_pal (n, user_id, p) select p_n, h.user_id, p from (select distinct user_id from wb_hits where n = p_n and (p_only is null or user_id = p_only)) h
      on conflict do nothing returning user_id loop
      perform hdv_op(r.user_id, jsonb_build_object('cons', c, 'res', jsonb_build_object('Fragment d''anomalie', f)),
        format('Boss des mondes : le serveur a atteint %s %% contre %s, %s et %s Fragments d''anomalie', p, nm, case p when 25 then 'Coffre en argent' when 100 then 'Coffre des Douze' else 'Coffre en or' end, f));
    end loop;
  end loop;
end $$;

-- ---------- lecture ----------
create or replace function public.wb_info() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); s wb_state; mine jsonb := null; k wb_kills; mb int;
begin
  perform wb_roll();
  select * into s from wb_state where id = 1;
  if me is not null then
    select max(points) into mb from wb_hits where user_id = me and n = s.n;
    mine := jsonb_build_object(
      'today', (select count(*) from wb_hits where user_id = me and day = gb_day()),
      'max', wb_max(),
      'week', (select count(*) from wb_hits where user_id = me and n = s.n),
      'pts', (select coalesce(sum(points), 0) from wb_hits where user_id = me and n = s.n),
      'best', mb,
      'rank', case when mb is null then null else (select 1 + count(*) from (select max(points) b from wb_hits where n = s.n group by user_id) x where x.b > mb) end,
      'tiers', (select coalesce(jsonb_agg(tier), '[]'::jsonb) from wb_tiers where user_id = me and n = s.n));
  end if;
  select * into k from wb_kills where n < s.n order by n desc limit 1;
  return jsonb_build_object('s1', true, 'n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'started', s.started, 'ends', wb_week_end(s.n), 'phase', wb_phase(s.dmg, s.hp), 'bonus', s.bonus_until, 'now', now(),
    'killed', exists (select 1 from wb_kills where n = s.n and not fled), 'last_night', wb_last_night(), 'players', (select count(distinct user_id) from wb_hits where n = s.n),
    'top', wb_best(s.n, 10), 'me', mine,
    'last', case when k.n is null then null else jsonb_build_object('n', k.n, 'name', wb_name(k.n), 'fled', k.fled, 'ended', k.ended, 'top', k.top, 'players', k.players) end);
end $$;
revoke all on function public.wb_info() from public;
grant execute on function public.wb_info() to anon, authenticated;

-- Bilan du lundi sur Discord (Mathis 03/11) : appelée par le workflow « Bilan du boss de la semaine » (clé de service, jamais le jeu).
-- Ferme la semaine passée si personne ne l'a encore fait, puis rend une seule fois le bilan de la semaine finie (chute ou fuite,
-- podium, paliers du serveur, paliers d'essais) et le boss qui arrive. Rend '[]' s'il n'y a rien de nouveau (saison pas ouverte).
create or replace function public.wb_recap() returns jsonb language plpgsql security definer set search_path = public
as $$
declare s wb_state; k wb_kills; out jsonb;
begin
  if (select debut from s1_cfg where id = 1) is null or now() < (select debut from s1_cfg where id = 1) then return '[]'::jsonb; end if;
  perform wb_roll();
  select * into s from wb_state where id = 1;
  update wb_kills set recap = now() where n = s.n - 1 and recap is null returning * into k;
  if k.n is null then return '[]'::jsonb; end if;
  out := jsonb_build_object('n', k.n, 'name', wb_name(k.n), 'fled', k.fled, 'hp', k.hp, 'cap', k.cap, 'players', k.players, 'top', k.top,
    'dur', case when k.fled then null else round(extract(epoch from (k.ended - k.started)))::int end, 'by', case when k.last_user is null then null else pseudo_of(k.last_user) end,
    'pct', case when k.fled then least(99, round(100.0 * coalesce(k.cap, 0) / greatest(1, k.hp))) else 100 end,
    'pal', (select coalesce(max(p), 0) from wb_pal where wb_pal.n = k.n),
    'tiers', (select coalesce(jsonb_object_agg(tier, c), '{}'::jsonb) from (select tier, count(*) c from wb_tiers t where t.n = k.n group by tier) x),
    'next_n', s.n, 'next', wb_name(s.n), 'next_hp', s.hp);
  return jsonb_build_array(out);
end $$;

-- ---------- appelées par la fonction serveur « record » (clé de service) ----------
create or replace function public.wb_start(p_user uuid) returns jsonb language plpgsql security definer set search_path = public
as $$
declare s wb_state;
begin
  if not exists (select 1 from profiles where id = p_user) then return g_err('Crée ton compte pour frapper le boss.'); end if;
  perform wb_roll();
  if (select count(*) from wb_hits where user_id = p_user and day = gb_day()) >= wb_max() then return g_err('Plus d''essai aujourd''hui : reviens après minuit.'); end if;
  select * into s from wb_state where id = 1;
  return jsonb_build_object('ok', true, 's1', true, 'n', s.n, 'phase', wb_phase(s.dmg, s.hp), 'k', (select count(*) from wb_hits where user_id = p_user and n = s.n));
end $$;

create or replace function public.wb_done(p_user uuid, p_n int, p_k int, p_points int, p_phase int, p_lvl int, p_rounds int, p_alive int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare s wb_state; g text; pts int := wb_cap(p_points); before bigint; after bigint; ph0 int; ph1 int; killed boolean := false; was boolean; nm text; wk int; pl int; tr text;
begin
  perform wb_roll();
  perform pg_advisory_xact_lock(hashtext('wboss'));
  select * into s from wb_state where id = 1 for update;
  if s.n <> p_n then return g_err('Une nouvelle semaine vient de commencer : ton essai n''est pas compté, frappe le nouveau boss.'); end if;
  if (select count(*) from wb_hits where user_id = p_user and day = gb_day()) >= wb_max(true) then return g_err('Plus d''essai aujourd''hui : reviens après minuit.'); end if;
  if p_points > 6000 then insert into wb_flags (n, user_id, points) values (p_n, p_user, p_points); end if;
  g := wb_grade(pts); nm := wb_name(p_n);
  begin
    insert into wb_hits (n, user_id, k, day, points, grade, phase, lvl, rounds, alive) values (p_n, p_user, p_k, gb_day(), pts, g, p_phase, p_lvl, p_rounds, p_alive);
  exception when unique_violation then return g_err('Essai déjà compté.'); end;
  perform hdv_op(p_user, jsonb_build_object('cons', wb_cons(g), 'res', jsonb_build_object('Fragment d''anomalie', wb_frag(g))),
    format('Boss des mondes : grade %s contre %s (%s PV), coffre et %s Fragments d''anomalie', g, nm, pts * 100, wb_frag(g)));
  -- paliers d'essais de la semaine (3A)
  select count(*) into wk from wb_hits where user_id = p_user and n = p_n;
  tr := case wk when 3 then 'bronze' when 9 then 'argent' when 18 then 'or' end;
  if tr is not null then
    insert into wb_tiers (n, user_id, tier) values (p_n, p_user, tr) on conflict do nothing;
    if found then
      perform hdv_op(p_user, jsonb_build_object('cons', case tr when 'bronze' then '{"coffre_argent":1}' else '{"coffre_or":1}' end::jsonb)
        || case tr when 'bronze' then '{}'::jsonb else jsonb_build_object('res', jsonb_build_object('Fragment d''anomalie', case tr when 'argent' then 3 else 5 end)) end
        || case tr when 'or' then jsonb_build_object('title', 'Chasseur de ' || nm) else '{}'::jsonb end,
        format('Boss des mondes : palier %s de la semaine (%s essais contre %s)', case tr when 'bronze' then 'Bronze' when 'argent' then 'Argent' else 'Or' end, wk, nm));
    end if;
  end if;
  was := s.dmg >= s.hp;
  before := s.dmg; after := least(s.hp, s.dmg + pts); ph0 := wb_phase(before, s.hp); ph1 := wb_phase(after, s.hp);
  if not was then
    update wb_state set dmg = after where id = 1;
    if after >= s.hp then
      killed := true;
      select count(distinct user_id) into pl from wb_hits where n = p_n;
      insert into wb_kills (n, hp, started, last_user, players, top) values (p_n, s.hp, s.started, p_user, pl, wb_best(p_n, 3)) on conflict (n) do nothing;
      update wb_state set bonus_until = now() + interval '1 hour' where id = 1;
      perform wb_ann(jsonb_build_object('ev', 'dead', 'n', p_n, 'name', nm, 'dur', round(extract(epoch from (now() - s.started)))::int, 'players', pl, 's1', true), p_user);
    elsif ph1 > ph0 then
      perform wb_ann(jsonb_build_object('ev', 'ph', 'n', p_n, 'name', nm, 'ph', ph1));
    end if;
  end if;
  perform wb_pal_give(p_n, after, s.hp, case when after > before then null else p_user end); -- un nouveau palier : pour tous ; sinon, ceux que ce joueur n'a pas encore
  return jsonb_build_object('ok', true, 's1', true, 'grade', g, 'points', pts, 'frag', wb_frag(g), 'cons', wb_cons(g), 'dmg', after, 'before', before, 'hp', s.hp, 'killed', killed, 'week', wk, 'tier', tr,
    'left', wb_max(true) - (select count(*) from wb_hits where user_id = p_user and day = gb_day()),
    'rank', (select 1 + count(*) from (select max(points) b from wb_hits where n = p_n group by user_id) x where x.b > (select max(points) from wb_hits where user_id = p_user and n = p_n)));
end $$;

do $$ declare f text; begin
  foreach f in array array['wb_roll()', 'wb_pal_give(int, bigint, bigint, uuid)', 'wb_best(int, int)', 'wb_week()', 'wb_week_end(int)', 'wb_last_night(boolean, timestamptz)', 'wb_max(boolean)', 'wb_recap()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['wb_start(uuid)', 'wb_done(uuid, int, int, int, int, int, int, int)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
-- premier boss de la saison : Gargandyas, 20 000 points (E.WB_S1.hp0) tant que personne ne l'a frappé
update public.wb_state set hp = 20000 where id = 1 and n = 1 and dmg = 0 and not exists (select 1 from public.wb_hits);
