-- ============================================================================
-- ALLIANCES ET PRISMES — Idlus (multijoueur, pour la 1.1)
-- Choix de Mathis (règles et chiffres : js/alliance.js, E.ALLY) :
--  - une alliance réunit 3 guildes au plus ; on la fonde avec une Alliogemme (1 000 000 de kamas du coffre de guilde,
--    guilde niveau 10, le Meneur) ; la guilde fondatrice la dirige (son Meneur et ses Bras droits invitent, acceptent,
--    renvoient) ; les alliés ne peuvent pas s'attaquer et défendent les Percepteurs les uns des autres (gboss.sql) ;
--  - un prisme par région de la carte (prism_regions, alliances_data.sql) : posé par le Meneur ou un Bras droit d'une
--    guilde de l'alliance (1 000 000 de kamas de son coffre), dans une région libre que domine une guilde de l'alliance
--    (le plus de Percepteurs, sans égalité) ; il garde la région tant qu'il ne tombe pas ;
--  - bonus du prisme dans sa région (calculé par le jeu) et améliorations payées par le coffre (prism_up) ;
--  - grande bataille chaque semaine (al_battle_day, de 21 h à 22 h, heure de Paris), toutes les régions à la fois :
--    10 combats par joueur (+2 avec le Ralliement dans sa région), rejoués par la fonction record (ps_start, ps_done),
--    1 point par combat gagné ; la meilleure alliance prend ou garde la région, égalité : la région redevient libre ;
--    une région se prend avec 5 points au moins (al_resolve, lancé à la première lecture après la bataille) ;
--  - classement de la semaine (régions tenues, puis combats gagnés) ; le lundi, titre « Souverain des Douze » (et
--    l'ornement du jeu) pour les membres des guildes de l'alliance première ; salon « Alliance » dans le chat.
-- S'appuie sur guildes.sql (guilds, guild_members, g_*), gboss.sql (guild_percos, gb_week), hdv.sql (hdv_op),
-- chat.sql (pseudo_of, chat_sanctions) et alliances_data.sql (régions).
-- ============================================================================

create table if not exists public.alliances (
  id bigint generated always as identity primary key,
  name text not null,
  tag text not null default '',            -- sigle (2 à 4 lettres ou chiffres)
  ic text not null default 'dofus',
  col text not null default '#7cc7ff',
  founder bigint references public.guilds (id) on delete set null,  -- la guilde qui dirige l'alliance
  created_at timestamptz not null default now()
);
create unique index if not exists alliances_name on public.alliances (lower(name));
create unique index if not exists alliances_tag on public.alliances (upper(tag)) where tag <> '';
alter table public.alliances enable row level security;

create table if not exists public.alliance_guilds (
  guild_id bigint primary key references public.guilds (id) on delete cascade,
  alliance_id bigint not null references public.alliances (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists alliance_guilds_a on public.alliance_guilds (alliance_id);
alter table public.alliance_guilds enable row level security;

-- ask : la guilde demande à entrer ; invite : l'alliance invite la guilde
create table if not exists public.alliance_requests (
  alliance_id bigint not null references public.alliances (id) on delete cascade,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  kind text not null check (kind in ('ask', 'invite')),
  by_user uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  primary key (alliance_id, guild_id)
);
alter table public.alliance_requests enable row level security;

create table if not exists public.prisms (
  zone text primary key,
  alliance_id bigint not null references public.alliances (id) on delete cascade,
  guild_id bigint references public.guilds (id) on delete set null,   -- la guilde qui l'a posé (ou pris)
  placed_by uuid references auth.users (id) on delete set null,
  placed_at timestamptz not null default now(),
  mods jsonb not null default '{}'::jsonb                              -- { rempart, sagesse, prospection, ralliement }
);
create index if not exists prisms_a on public.prisms (alliance_id);
alter table public.prisms enable row level security;

-- combats de la bataille (w = semaine, gb_week) ; extra : combat de Ralliement (au-delà des 10)
create table if not exists public.prism_fights (
  id bigint generated always as identity primary key,
  w int not null, user_id uuid not null references auth.users (id) on delete cascade,
  n int not null, zone text not null,
  alliance_id bigint not null references public.alliances (id) on delete cascade,
  guild_id bigint references public.guilds (id) on delete set null,
  def boolean not null, win boolean not null, extra boolean not null default false, rounds int,
  at timestamptz not null default now(),
  unique (w, user_id, n)
);
create index if not exists prism_fights_wz on public.prism_fights (w, zone);
create index if not exists prism_fights_wa on public.prism_fights (w, alliance_id);
alter table public.prism_fights enable row level security;

-- bataille déjà comptée (res : régions prises, perdues, libérées et classement final)
create table if not exists public.al_resolved (
  w int primary key, at timestamptz not null default now(), res jsonb not null default '{}'::jsonb
);
alter table public.al_resolved enable row level security;
create table if not exists public.al_claims (
  user_id uuid not null references auth.users (id) on delete cascade, w int not null,
  at timestamptz not null default now(), primary key (user_id, w)
);
alter table public.al_claims enable row level security;

create table if not exists public.alliance_msgs (
  id bigint generated always as identity primary key,
  alliance_id bigint not null references public.alliances (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text, cls text, lvl int, title text, gname text,
  body text not null default '',
  kind text not null default 'msg',  -- 'msg' ou 'sys' (arrivées, prismes, bataille)
  created_at timestamptz not null default now()
);
create index if not exists alliance_msgs_a on public.alliance_msgs (alliance_id, id desc);
alter table public.alliance_msgs enable row level security;

-- ---------- outils internes ----------
-- jour de la bataille (1 = lundi … 7 = dimanche) et heures : les mêmes que E.ALLY (js/alliance.js)
create or replace function public.al_battle_day() returns int language sql stable as $$ select 7 $$;
create or replace function public.al_battle_from() returns int language sql stable as $$ select 21 $$;
create or replace function public.al_battle_to() returns int language sql stable as $$ select 22 $$;
-- début et fin de la bataille de la semaine wk (gb_week : semaines du lundi)
create or replace function public.al_battle_start(wk int) returns timestamptz language sql stable
as $$ select ((date '1970-01-01' + wk * 7 - 3 + (al_battle_day() - 1)) + make_interval(hours => al_battle_from())) at time zone 'Europe/Paris' $$;
create or replace function public.al_battle_end(wk int) returns timestamptz language sql stable
as $$ select ((date '1970-01-01' + wk * 7 - 3 + (al_battle_day() - 1)) + make_interval(hours => al_battle_to())) at time zone 'Europe/Paris' $$;
-- bataille en cours (grace : quelques secondes de plus pour finir un combat lancé juste avant la fin)
create or replace function public.al_battle_on(grace interval default interval '0') returns boolean language sql stable
as $$ select now() >= al_battle_start(gb_week()) and now() < al_battle_end(gb_week()) + grace $$;
create or replace function public.al_of(g bigint) returns bigint language sql stable security definer set search_path = public
as $$ select alliance_id from alliance_guilds where guild_id = g $$;
create or replace function public.al_count(a bigint) returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from alliance_guilds where alliance_id = a $$;
-- deux guildes de la même alliance (9A)
create or replace function public.al_allied(a bigint, b bigint) returns boolean language sql stable security definer set search_path = public
as $$ select a is not null and b is not null and a <> b and exists (select 1 from alliance_guilds x join alliance_guilds y on y.alliance_id = x.alliance_id where x.guild_id = a and y.guild_id = b) $$;
-- guilde qui domine une région (le plus de Percepteurs, sans égalité en tête) : comme E.huntDomination
create or replace function public.al_dom(z text) returns bigint language sql stable security definer set search_path = public
as $$ select case when count(*) = 1 or (array_agg(n order by n desc))[1] > (array_agg(n order by n desc))[2] then (array_agg(g order by n desc))[1] end
  from (select p.guild_id g, count(*) n from guild_percos p join prism_sids s on s.sid = p.sid where s.zone = z group by p.guild_id) x $$;
-- Percepteur d'une guilde dont l'alliance a un prisme dans sa région : +20 % de PV (6A, rejoué par record)
create or replace function public.al_prism_cover(g bigint, p_sid text) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from prisms pr join prism_sids s on s.zone = pr.zone where s.sid = p_sid and pr.alliance_id = al_of(g)) $$;
-- prix d'une amélioration au rang suivant (E.ALLY_MODS) ; null : rang maximum ou inconnue
create or replace function public.al_modk(k text, r int) returns bigint language sql immutable
as $$ select case k
  when 'rempart' then (array[500000, 1500000, 4000000]::bigint[])[r + 1]
  when 'sagesse' then (array[400000, 1200000, 3000000]::bigint[])[r + 1]
  when 'prospection' then (array[400000, 1200000, 3000000]::bigint[])[r + 1]
  when 'ralliement' then (array[1500000]::bigint[])[r + 1] end $$;
create or replace function public.al_say_sys(a bigint, t text) returns void language sql security definer set search_path = public
as $$ insert into alliance_msgs (alliance_id, kind, body) values (a, 'sys', t) $$;
-- message aux guildes de l'alliance (journal et chat de chaque guilde) et au salon de l'alliance
create or replace function public.al_log(a bigint, t text) returns void language plpgsql security definer set search_path = public
as $$ declare g bigint; begin
  perform al_say_sys(a, t);
  for g in select guild_id from alliance_guilds where alliance_id = a loop perform g_log(g, t, false); end loop;
end $$;
-- l'alliance a toujours une guilde fondatrice ; sans guilde, elle disparaît (et ses prismes avec elle)
create or replace function public.al_fix(a bigint) returns void language plpgsql security definer set search_path = public
as $$ declare f bigint; h bigint; begin
  if a is null then return; end if;
  if al_count(a) = 0 then delete from alliances where id = a; return; end if;
  select founder into f from alliances where id = a;
  if f is null or not exists (select 1 from alliance_guilds where alliance_id = a and guild_id = f) then
    select guild_id into h from alliance_guilds where alliance_id = a order by joined_at limit 1;
    update alliances set founder = h where id = a;
    perform al_log(a, format('%s dirige maintenant l''alliance.', (select name from guilds where id = h)));
  end if;
end $$;
-- classement d'une semaine : régions tenues (maintenant), puis combats gagnés cette semaine-là
create or replace function public.al_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x.regions desc, x.wins desc, x.id), '[]'::jsonb) from (
  select a.id, a.name, a.tag, a.ic, a.col, al_count(a.id) n,
    (select count(*) from prisms p where p.alliance_id = a.id)::int regions,
    (select count(*) from prism_fights f where f.alliance_id = a.id and f.w = wk and f.win)::int wins
  from alliances a order by regions desc, wins desc, a.id limit lim) x where x.regions > 0 or x.wins > 0 $$;
-- points de la bataille de la semaine wk par région : { zone: { alliance: points } }
create or replace function public.al_scores(wk int) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_object_agg(zone, s), '{}'::jsonb) from (
  select zone, jsonb_object_agg(alliance_id::text, pts) s from (
    select zone, alliance_id, count(*)::int pts from prism_fights where w = wk and win group by zone, alliance_id) y group by zone) x $$;
-- Fin de bataille : chaque région où quelqu'un a gagné un combat change (ou pas) de main (E.allyOutcome).
-- Une seule fois par semaine, à la première lecture après 22 h ; idempotent.
create or replace function public.al_resolve() returns void language plpgsql security definer set search_path = public
as $$
declare wk int; z record; e record; holder bigint; top bigint; topn int; second int; wn bigint; gg bigint; taken jsonb; lost jsonb; freed jsonb; res jsonb; rk jsonb;
begin
  for wk in select distinct f.w from prism_fights f where not exists (select 1 from al_resolved r where r.w = f.w) and now() >= al_battle_end(f.w) order by 1 loop
    perform pg_advisory_xact_lock(hashtext('alresolve'));
    if exists (select 1 from al_resolved where w = wk) then continue; end if;
    taken := '[]'::jsonb; lost := '[]'::jsonb; freed := '[]'::jsonb;
    for z in select distinct zone from prism_fights where w = wk and win loop
      select alliance_id into holder from prisms where zone = z.zone;
      top := null; topn := 0; second := 0;
      for e in select alliance_id a, count(*)::int n from prism_fights where w = wk and zone = z.zone and win group by alliance_id order by count(*) desc, alliance_id loop
        if top is null then top := e.a; topn := e.n; elsif second = 0 then second := e.n; end if;
      end loop;
      -- égalité en tête : la région redevient libre (14B) ; sinon il faut 5 points pour la prendre
      if topn = second then wn := null;
      elsif top = holder then wn := holder;
      elsif topn < 5 then wn := holder;
      else wn := top; end if;
      if wn is not distinct from holder then continue; end if;
      if wn is null then
        delete from prisms where zone = z.zone;
        freed := freed || jsonb_build_array(jsonb_build_object('zone', z.zone, 'from', holder));
        perform al_log(holder, format('⚖ Égalité dans la bataille pour %s : votre prisme tombe, la région redevient libre.', (select name from prism_regions where zone = z.zone)));
      else
        select guild_id into gg from prism_fights where w = wk and zone = z.zone and win and alliance_id = wn group by guild_id order by count(*) desc, guild_id limit 1;
        insert into prisms (zone, alliance_id, guild_id, placed_by, placed_at, mods) values (z.zone, wn, gg, null, now(), '{}'::jsonb)
          on conflict (zone) do update set alliance_id = excluded.alliance_id, guild_id = excluded.guild_id, placed_by = null, placed_at = now(), mods = '{}'::jsonb;
        taken := taken || jsonb_build_array(jsonb_build_object('zone', z.zone, 'to', wn, 'from', holder, 'pts', topn));
        perform al_log(wn, format('💎 Bataille des prismes : votre alliance prend %s avec %s points ! Un prisme y est posé (sans amélioration).', (select name from prism_regions where zone = z.zone), topn));
        if holder is not null then
          lost := lost || jsonb_build_array(jsonb_build_object('zone', z.zone, 'from', holder, 'to', wn));
          perform al_log(holder, format('Bataille des prismes : %s prend %s, votre prisme tombe.', (select name from alliances where id = wn), (select name from prism_regions where zone = z.zone)));
        end if;
      end if;
    end loop;
    rk := al_top(wk, 10);
    res := jsonb_build_object('taken', taken, 'lost', lost, 'freed', freed, 'top', rk,
      'first', case when jsonb_array_length(rk) > 0 then (rk->0->>'id')::bigint end,
      'guilds', case when jsonb_array_length(rk) > 0 then (select coalesce(jsonb_agg(guild_id), '[]'::jsonb) from alliance_guilds where alliance_id = (rk->0->>'id')::bigint) else '[]'::jsonb end);
    insert into al_resolved (w, res) values (wk, res);
    delete from prism_fights where w < wk - 8;
  end loop;
end $$;

do $$ declare f text; begin
  foreach f in array array['al_battle_day()', 'al_battle_from()', 'al_battle_to()', 'al_battle_start(int)', 'al_battle_end(int)', 'al_battle_on(interval)', 'al_of(bigint)', 'al_count(bigint)',
    'al_allied(bigint, bigint)', 'al_dom(text)', 'al_prism_cover(bigint, text)', 'al_modk(text, int)', 'al_say_sys(bigint, text)', 'al_log(bigint, text)', 'al_fix(bigint)',
    'al_top(int, int)', 'al_scores(int)', 'al_resolve()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture : tout ce que montre l'onglet Alliance et la carte ----------
create or replace function public.ally_me() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; a alliances; aid bigint; wk int := gb_week(); used int := 0; xtra jsonb; lr al_resolved;
begin
  if me is null then return g_err('non connecté'); end if;
  perform al_resolve();
  m := g_me(me);
  if m.user_id is not null then select * into g from guilds where id = m.guild_id; aid := al_of(g.id); end if;
  if aid is not null then perform al_fix(aid); aid := al_of(g.id); end if;
  if aid is not null then select * into a from alliances where id = aid; end if;
  used := (select count(*) from prism_fights where w = wk and user_id = me and not extra);
  xtra := (select coalesce(jsonb_object_agg(zone, n), '{}'::jsonb) from (select zone, count(*)::int n from prism_fights where w = wk and user_id = me and extra group by zone) x);
  select * into lr from al_resolved where w = wk - 1;
  return jsonb_build_object('now', now(), 'w', wk,
    'battle', jsonb_build_object('on', al_battle_on(), 'start', al_battle_start(wk), 'end', al_battle_end(wk), 'done', exists (select 1 from al_resolved where w = wk)),
    'gid', g.id, 'glvl', g.lvl, 'rank', m.rank, 'chest', g.chest,
    'al', case when aid is null then null else jsonb_build_object('id', a.id, 'name', a.name, 'tag', a.tag, 'ic', a.ic, 'col', a.col, 'founder', a.founder, 'created', a.created_at,
      'lead', a.founder = g.id and m.rank <= 1,
      'guilds', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'ic', x.ic, 'col', x.col, 'lvl', x.lvl, 'n', g_count(x.id), 'joined', ag.joined_at,
          'chef', (select pseudo_of(user_id) from guild_members where guild_id = x.id and rank = 0 limit 1),
          'percos', (select count(*) from guild_percos p where p.guild_id = x.id)) order by ag.joined_at), '[]'::jsonb)
        from alliance_guilds ag join guilds x on x.id = ag.guild_id where ag.alliance_id = a.id),
      'asks', case when a.founder = g.id and m.rank <= 1 then (select coalesce(jsonb_agg(jsonb_build_object('gid', x.id, 'name', x.name, 'ic', x.ic, 'col', x.col, 'lvl', x.lvl, 'n', g_count(x.id), 'at', r.at) order by r.at), '[]'::jsonb)
        from alliance_requests r join guilds x on x.id = r.guild_id where r.alliance_id = a.id and r.kind = 'ask') else '[]'::jsonb end,
      'invited', (select coalesce(jsonb_agg(jsonb_build_object('gid', x.id, 'name', x.name)), '[]'::jsonb) from alliance_requests r join guilds x on x.id = r.guild_id where r.alliance_id = a.id and r.kind = 'invite')) end,
    -- sans alliance : invitations reçues par la guilde, demandes envoyées, alliances existantes
    'invites', case when aid is null and g.id is not null then (select coalesce(jsonb_agg(jsonb_build_object('aid', x.id, 'name', x.name, 'tag', x.tag, 'ic', x.ic, 'col', x.col, 'n', al_count(x.id), 'by', pseudo_of(r.by_user)) order by r.at desc), '[]'::jsonb)
      from alliance_requests r join alliances x on x.id = r.alliance_id where r.guild_id = g.id and r.kind = 'invite') else '[]'::jsonb end,
    'asked', case when aid is null and g.id is not null then (select coalesce(jsonb_agg(r.alliance_id), '[]'::jsonb) from alliance_requests r where r.guild_id = g.id and r.kind = 'ask') else '[]'::jsonb end,
    'list', case when aid is null then (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'tag', x.tag, 'ic', x.ic, 'col', x.col, 'n', al_count(x.id),
        'regions', (select count(*) from prisms p where p.alliance_id = x.id),
        'guilds', (select coalesce(jsonb_agg(gg.name order by ag.joined_at), '[]'::jsonb) from alliance_guilds ag join guilds gg on gg.id = ag.guild_id where ag.alliance_id = x.id)) order by x.id), '[]'::jsonb)
      from alliances x) else null end,
    -- toutes les alliances qui ont un prisme (carte) et tous les prismes
    'alliances', (select coalesce(jsonb_object_agg(x.id, jsonb_build_object('name', x.name, 'tag', x.tag, 'ic', x.ic, 'col', x.col)), '{}'::jsonb) from alliances x
      where exists (select 1 from prisms p where p.alliance_id = x.id) or x.id = aid or exists (select 1 from prism_fights f where f.w = wk and f.alliance_id = x.id)),
    'prisms', (select coalesce(jsonb_agg(jsonb_build_object('zone', p.zone, 'aid', p.alliance_id, 'gid', p.guild_id, 'g', gg.name, 'by', pseudo_of(p.placed_by), 'at', p.placed_at, 'mods', p.mods) order by p.zone), '[]'::jsonb)
      from prisms p left join guilds gg on gg.id = p.guild_id),
    -- régions libres que domine une guilde de mon alliance (on peut y poser un prisme)
    'dom', case when aid is null then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('zone', r.zone, 'gid', d.g, 'g', gg.name) order by r.lo), '[]'::jsonb)
      from prism_regions r cross join lateral (select al_dom(r.zone) g) d join guilds gg on gg.id = d.g
      where not exists (select 1 from prisms p where p.zone = r.zone) and al_of(d.g) = aid) end,
    'score', al_scores(wk),
    'fights', jsonb_build_object('used', used, 'max', 10, 'extra', xtra),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('zone', zone, 'def', def, 'win', win, 'at', at) order by id desc), '[]'::jsonb) from (select * from prism_fights where w = wk and user_id = me order by id desc limit 12) f),
    'top', al_top(wk, 10),
    'last', case when lr.w is null then null else lr.res end,
    'claim', aid is not null and lr.w is not null and (lr.res->>'first')::bigint = aid and lr.res->'guilds' @> to_jsonb(g.id) and not exists (select 1 from al_claims c where c.user_id = me and c.w = lr.w),
    -- 9A : attaques en cours sur les Percepteurs des guildes alliées
    'help', case when aid is null then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'sid', r.sid, 'zone', pc_name(r.sid), 'ends', r.ends, 'by', pseudo_of(r.att_user),
        'dg', (select jsonb_build_object('id', id, 'name', name, 'ic', ic, 'col', col) from guilds where id = r.def_guild),
        'ag', (select jsonb_build_object('id', id, 'name', name, 'ic', ic, 'col', col) from guilds where id = r.att_guild),
        'tried', exists (select 1 from jsonb_array_elements(r.tries) t where t->>'u' = me::text), 'n', jsonb_array_length(r.tries)) order by r.ends), '[]'::jsonb)
      from perco_raids r join alliance_guilds ag on ag.guild_id = r.def_guild where ag.alliance_id = aid and r.def_guild <> g.id and r.status = 'open' and r.ends > now()) end);
end $$;

-- ---------- fonder, inviter, rejoindre, partir ----------
create or replace function public.ally_found(p_name text, p_tag text, p_ic text, p_col text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; e text; aid bigint; n text := btrim(coalesce(p_name, '')); tg text := upper(btrim(coalesce(p_tag, '')));
begin
  if me is null then return g_err('non connecté'); end if;
  m := g_me(me); if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  if m.rank <> 0 then return g_err('Seul le Meneur peut fonder une alliance.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  select * into g from guilds where id = m.guild_id;
  if al_of(g.id) is not null then return g_err('Ta guilde est déjà dans une alliance.'); end if;
  if g.lvl < 10 then return g_err('Il faut une guilde niveau 10 pour fonder une alliance.'); end if;
  e := g_name_ok(n); if e is not null then return g_err(e); end if;
  if exists (select 1 from alliances where lower(name) = lower(n)) then return g_err('Ce nom d''alliance est déjà pris.'); end if;
  if tg !~ '^[A-Z0-9]{2,4}$' then return g_err('Le sigle fait de 2 à 4 lettres ou chiffres.'); end if;
  if exists (select 1 from alliances where upper(tag) = tg) then return g_err('Ce sigle est déjà pris.'); end if;
  e := g_name_ok(tg || 'xx'); if e is not null and e not like 'Le nom fait%' then return g_err('Ce sigle n''est pas autorisé.'); end if;
  if g.chest < 1000000 then return g_err(format('Il faut 1 000 000 kamas dans le coffre de guilde (il y a %s).', g_fmt(g.chest))); end if;
  if coalesce(p_col, '') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_ic, '') !~ '^[a-z0-9_]{1,24}$' then return g_err('Emblème illisible.'); end if;
  perform g_chest(g.id, -1000000, format('Alliogemme : fondation de l''alliance %s par %s', n, pseudo_of(me)));
  insert into alliances (name, tag, ic, col, founder) values (n, tg, p_ic, p_col, g.id) returning id into aid;
  insert into alliance_guilds (guild_id, alliance_id) values (g.id, aid);
  delete from alliance_requests where guild_id = g.id;
  perform al_log(aid, format('🤝 %s fonde l''alliance %s avec la guilde %s.', pseudo_of(me), n, g.name));
  perform g_log(g.id, format('🤝 %s fonde l''alliance %s (Alliogemme : 1 000 000 kamas du coffre).', pseudo_of(me), n));
  return jsonb_build_object('ok', true, 'id', aid);
end $$;
-- inviter une guilde (la guilde fondatrice : Meneur ou Bras droit)
create or replace function public.ally_invite(p_gid bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); a alliances; t guilds;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  select * into a from alliances where id = al_of(m.guild_id);
  if a.id is null then return g_err('Ta guilde n''est pas dans une alliance.'); end if;
  if a.founder <> m.guild_id or m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits de la guilde qui dirige l''alliance invitent.'); end if;
  select * into t from guilds where id = p_gid; if t.id is null then return g_err('Cette guilde n''existe plus.'); end if;
  if al_of(t.id) is not null then return g_err('Cette guilde est déjà dans une alliance.'); end if;
  if al_count(a.id) >= 3 then return g_err('Une alliance réunit 3 guildes au plus.'); end if;
  if (select count(*) from alliance_requests where alliance_id = a.id and kind = 'invite') >= 5 then return g_err('5 invitations en attente au plus.'); end if;
  insert into alliance_requests (alliance_id, guild_id, kind, by_user) values (a.id, t.id, 'invite', me)
    on conflict (alliance_id, guild_id) do update set kind = 'invite', by_user = excluded.by_user, at = now();
  perform g_log(t.id, format('🤝 L''alliance %s invite votre guilde (le Meneur répond dans Communauté › Guilde › Alliance).', a.name));
  perform al_say_sys(a.id, format('%s invite la guilde %s.', pseudo_of(me), t.name));
  return jsonb_build_object('ok', true);
end $$;
-- demander à entrer (Meneur d'une guilde sans alliance)
create or replace function public.ally_ask(p_aid bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); a alliances;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  if m.rank <> 0 then return g_err('Seul le Meneur engage la guilde dans une alliance.'); end if;
  if al_of(m.guild_id) is not null then return g_err('Ta guilde est déjà dans une alliance.'); end if;
  select * into a from alliances where id = p_aid; if a.id is null then return g_err('Cette alliance n''existe plus.'); end if;
  if al_count(a.id) >= 3 then return g_err('Cette alliance a déjà 3 guildes.'); end if;
  if (select count(*) from alliance_requests where guild_id = m.guild_id and kind = 'ask') >= 3 then return g_err('3 demandes en attente au plus.'); end if;
  insert into alliance_requests (alliance_id, guild_id, kind, by_user) values (a.id, m.guild_id, 'ask', me) on conflict do nothing;
  perform al_say_sys(a.id, format('La guilde %s demande à rejoindre l''alliance.', (select name from guilds where id = m.guild_id)));
  return jsonb_build_object('ok', true);
end $$;
-- répondre : à une invitation (Meneur de la guilde invitée, p_gid = null) ou à une demande (guilde fondatrice, p_gid = la guilde)
create or replace function public.ally_answer(p_aid bigint, p_gid bigint, p_yes boolean) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); a alliances; r alliance_requests; gid bigint;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  perform pg_advisory_xact_lock(hashtext('ally' || p_aid));
  select * into a from alliances where id = p_aid; if a.id is null then return g_err('Cette alliance n''existe plus.'); end if;
  if p_gid is null then
    if m.rank <> 0 then return g_err('Seul le Meneur engage la guilde dans une alliance.'); end if;
    gid := m.guild_id; select * into r from alliance_requests where alliance_id = a.id and guild_id = gid and kind = 'invite';
  else
    if a.founder <> m.guild_id or m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits de la guilde qui dirige l''alliance répondent.'); end if;
    gid := p_gid; select * into r from alliance_requests where alliance_id = a.id and guild_id = gid and kind = 'ask';
  end if;
  if r.guild_id is null then return g_err('Cette demande n''existe plus.'); end if;
  delete from alliance_requests where alliance_id = a.id and guild_id = gid;
  if not p_yes then return jsonb_build_object('ok', true, 'no', true); end if;
  if al_of(gid) is not null then return g_err('Cette guilde est déjà dans une alliance.'); end if;
  if al_count(a.id) >= 3 then return g_err('L''alliance a déjà 3 guildes.'); end if;
  insert into alliance_guilds (guild_id, alliance_id) values (gid, a.id);
  delete from alliance_requests where guild_id = gid;
  perform al_log(a.id, format('🤝 La guilde %s rejoint l''alliance %s !', (select name from guilds where id = gid), a.name));
  return jsonb_build_object('ok', true);
end $$;
-- quitter (Meneur) : la guilde fondatrice qui part passe la main à la plus ancienne ; seule, l'alliance disparaît
create or replace function public.ally_leave() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); aid bigint; an text;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  if m.rank <> 0 then return g_err('Seul le Meneur peut faire quitter l''alliance à la guilde.'); end if;
  aid := al_of(m.guild_id); if aid is null then return g_err('Ta guilde n''est pas dans une alliance.'); end if;
  if al_battle_on() then return g_err('Pas pendant la bataille des prismes.'); end if;
  perform pg_advisory_xact_lock(hashtext('ally' || aid));
  select name into an from alliances where id = aid;
  delete from alliance_guilds where guild_id = m.guild_id;
  perform g_log(m.guild_id, format('%s fait quitter l''alliance %s à la guilde.', pseudo_of(me), an));
  if al_count(aid) = 0 then delete from alliances where id = aid; return jsonb_build_object('ok', 'gone'); end if;
  perform al_log(aid, format('La guilde %s quitte l''alliance.', (select name from guilds where id = m.guild_id)));
  perform al_fix(aid);
  return jsonb_build_object('ok', true);
end $$;
-- renvoyer une guilde (guilde fondatrice : Meneur)
create or replace function public.ally_kick(p_gid bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); a alliances;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  select * into a from alliances where id = al_of(m.guild_id);
  if a.id is null or a.founder <> m.guild_id or m.rank <> 0 then return g_err('Seul le Meneur de la guilde qui dirige l''alliance renvoie une guilde.'); end if;
  if p_gid = m.guild_id or al_of(p_gid) is distinct from a.id then return g_err('Cette guilde n''est pas dans ton alliance.'); end if;
  if al_battle_on() then return g_err('Pas pendant la bataille des prismes.'); end if;
  delete from alliance_guilds where guild_id = p_gid;
  perform g_log(p_gid, format('Votre guilde a été renvoyée de l''alliance %s.', a.name));
  perform al_log(a.id, format('La guilde %s a été renvoyée de l''alliance.', (select name from guilds where id = p_gid)));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- prismes ----------
create or replace function public.prism_place(p_zone text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); aid bigint; g guilds; d bigint; zn text;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  if m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits posent un prisme.'); end if;
  aid := al_of(m.guild_id); if aid is null then return g_err('Il faut une alliance pour poser un prisme.'); end if;
  if al_battle_on() then return g_err('Pas pendant la bataille des prismes : les régions se gagnent en combattant.'); end if;
  select name into zn from prism_regions where zone = p_zone; if zn is null then return g_err('Région inconnue.'); end if;
  perform pg_advisory_xact_lock(hashtext('prism:' || p_zone));
  if exists (select 1 from prisms where zone = p_zone) then return g_err('Il y a déjà un prisme dans cette région.'); end if;
  d := al_dom(p_zone);
  if d is null or al_of(d) is distinct from aid then return g_err(format('Une guilde de ton alliance doit dominer %s (le plus de Percepteurs de la région) pour y poser un prisme.', zn)); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  select * into g from guilds where id = m.guild_id;
  if g.chest < 1000000 then return g_err(format('Il faut 1 000 000 kamas dans le coffre de guilde (il y a %s).', g_fmt(g.chest))); end if;
  perform g_chest(g.id, -1000000, format('Prisme posé à %s par %s', zn, pseudo_of(me)));
  insert into prisms (zone, alliance_id, guild_id, placed_by) values (p_zone, aid, g.id, me);
  perform al_log(aid, format('💎 %s (%s) pose un prisme à %s : +5 %% de kamas, de butin et d''XP pour toute l''alliance dans la région.', pseudo_of(me), g.name, zn));
  return jsonb_build_object('ok', true, 'chest', g.chest - 1000000);
end $$;
create or replace function public.prism_up(p_zone text, p_mod text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); p prisms; g guilds; r int; k bigint; zn text;
begin
  if m.user_id is null then return g_err('Rejoins une guilde d''abord.'); end if;
  if m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits améliorent un prisme.'); end if;
  if al_battle_on() then return g_err('Pas pendant la bataille des prismes.'); end if;
  perform pg_advisory_xact_lock(hashtext('prism:' || p_zone));
  select * into p from prisms where zone = p_zone for update;
  if p.zone is null or p.alliance_id is distinct from al_of(m.guild_id) then return g_err('Ce prisme n''est pas à ton alliance.'); end if;
  r := coalesce((p.mods->>p_mod)::int, 0); k := al_modk(p_mod, r);
  if k is null then return g_err('Cette amélioration est déjà au maximum.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  select * into g from guilds where id = m.guild_id;
  if g.chest < k then return g_err(format('Il faut %s kamas dans le coffre de guilde (il y a %s).', g_fmt(k), g_fmt(g.chest))); end if;
  zn := (select name from prism_regions where zone = p_zone);
  perform g_chest(g.id, -k, format('Prisme de %s : %s rang %s', zn, initcap(p_mod), r + 1));
  update prisms set mods = mods || jsonb_build_object(p_mod, r + 1) where zone = p_zone;
  perform al_log(p.alliance_id, format('💎 %s (%s) améliore le prisme de %s : %s rang %s.', pseudo_of(me), g.name, zn, initcap(p_mod), r + 1));
  return jsonb_build_object('ok', true, 'rank', r + 1, 'chest', g.chest - k);
end $$;

-- ---------- bataille (appelé par la fonction record, qui rejoue le combat) ----------
-- Renvoie le rôle du joueur dans la région (def : son alliance y a le prisme), le Rempart du prisme visé et le numéro du combat.
create or replace function public.ps_start(p_user uuid, p_zone text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); aid bigint; p prisms; wk int := gb_week(); used int; ex int; df boolean; zlo int;
begin
  if m.user_id is null then return g_err('Rejoins une guilde et une alliance pour combattre.'); end if;
  aid := al_of(m.guild_id); if aid is null then return g_err('Il faut une alliance pour la bataille des prismes.'); end if;
  if not al_battle_on() then return g_err('La bataille des prismes n''a pas lieu maintenant.'); end if;
  select r.lo into zlo from prism_regions r where r.zone = p_zone; if zlo is null then return g_err('Région inconnue.'); end if;
  select * into p from prisms where zone = p_zone;
  df := p.alliance_id is not distinct from aid and p.zone is not null;
  used := (select count(*) from prism_fights where w = wk and user_id = p_user and not extra);
  ex := (select count(*) from prism_fights where w = wk and user_id = p_user and extra and zone = p_zone);
  if used >= 10 and not (df and coalesce((p.mods->>'ralliement')::int, 0) > 0 and ex < 2) then
    return g_err(case when df and coalesce((p.mods->>'ralliement')::int, 0) > 0 then 'Plus de combat pour cette bataille.' else 'Plus de combat pour cette bataille (10 par joueur).' end);
  end if;
  return jsonb_build_object('ok', true, 'w', wk, 'def', df, 'free', p.zone is null, 'rempart', coalesce((p.mods->>'rempart')::int, 0), 'lo', zlo, 'extra', used >= 10,
    'n', (select coalesce(max(n), 0) + 1 from prism_fights where w = wk and user_id = p_user));
end $$;
create or replace function public.ps_done(p_user uuid, p_w int, p_zone text, p_n int, p_def boolean, p_win boolean, p_rounds int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); aid bigint; p prisms; used int; ex int; df boolean; isx boolean := false; zn text;
begin
  if m.user_id is null then return g_err('Rejoins une guilde et une alliance pour combattre.'); end if;
  aid := al_of(m.guild_id); if aid is null then return g_err('Il faut une alliance pour la bataille des prismes.'); end if;
  if p_w <> gb_week() or not al_battle_on(interval '1 minute') then return g_err('La bataille des prismes est finie.'); end if;
  perform pg_advisory_xact_lock(hashtext('psu' || p_user::text));
  select * into p from prisms where zone = p_zone;
  df := p.alliance_id is not distinct from aid and p.zone is not null;
  if df is distinct from p_def then return g_err('La région a changé de main : réessaie.'); end if;
  used := (select count(*) from prism_fights where w = p_w and user_id = p_user and not extra);
  if used >= 10 then
    ex := (select count(*) from prism_fights where w = p_w and user_id = p_user and extra and zone = p_zone);
    if not (df and coalesce((p.mods->>'ralliement')::int, 0) > 0 and ex < 2) then return g_err('Plus de combat pour cette bataille.'); end if;
    isx := true;
  end if;
  begin
    insert into prism_fights (w, user_id, n, zone, alliance_id, guild_id, def, win, extra, rounds) values (p_w, p_user, p_n, p_zone, aid, m.guild_id, df, p_win, isx, p_rounds);
  exception when unique_violation then return g_err('Combat déjà compté.'); end;
  zn := (select name from prism_regions where zone = p_zone);
  if p_win then perform al_say_sys(aid, format('⚔ %s gagne un combat %s %s : +1 point.', pseudo_of(p_user), case when df then 'pour défendre' else 'pour prendre' end, zn)); end if;
  return jsonb_build_object('ok', true, 'used', used + case when isx then 0 else 1 end, 'extra', isx,
    'pts', (select coalesce(jsonb_object_agg(alliance_id::text, n), '{}'::jsonb) from (select alliance_id, count(*)::int n from prism_fights where w = p_w and zone = p_zone and win group by alliance_id) x));
end $$;

-- ---------- titre du lundi (10A) ----------
create or replace function public.ally_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members := g_me(auth.uid()); lr al_resolved;
begin
  if me is null then return g_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into lr from al_resolved where w = gb_week() - 1;
  if lr.w is null or m.user_id is null or not (lr.res->'guilds' @> to_jsonb(m.guild_id)) then return g_err('Rien à recevoir.'); end if;
  begin insert into al_claims (user_id, w) values (me, lr.w); exception when unique_violation then return g_err('Déjà reçu.'); end;
  perform hdv_op(me, jsonb_build_object('title', 'Souverain des Douze'), 'Bataille des prismes : ton alliance est première du classement, titre « Souverain des Douze » et ornement « Prisme des Douze » !');
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- ---------- salon « Alliance » du chat ----------
create or replace function public.ally_say(p_body text) returns text language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; aid bigint; sa record; lad record; b text := btrim(coalesce(p_body, '')); last timestamptz;
begin
  m := g_me(me); if m.user_id is null then return 'Tu n''es pas dans une guilde.'; end if;
  aid := al_of(m.guild_id); if aid is null then return 'Ta guilde n''est pas dans une alliance.'; end if;
  select * into sa from chat_sanctions where user_id = me;
  if found and sa.banned then return 'Tu ne peux plus écrire dans le chat.'; end if;
  if found and sa.mute_until > now() then return format('Tu es muet encore %s min.', ceil(extract(epoch from (sa.mute_until - now())) / 60)); end if;
  if b = '' then return 'Le message est vide.'; end if;
  if length(b) > 200 then return '200 caractères au maximum.'; end if;
  if b ~* '(https?://|www\.)' then return 'Les liens ne sont pas autorisés dans le chat.'; end if;
  select max(created_at) into last from alliance_msgs where user_id = me;
  if last > now() - interval '2 seconds' then return 'Doucement : un message toutes les 2 secondes.'; end if;
  select * into lad from ladder where user_id = me;
  insert into alliance_msgs (alliance_id, user_id, pseudo, cls, lvl, title, gname, body) values (aid, me, pseudo_of(me), lad.main, coalesce(lad.main_lvl, 1), lad.title, (select name from guilds where id = m.guild_id), b);
  delete from alliance_msgs where created_at < now() - interval '7 days';
  return null;
end $$;
create or replace function public.ally_chat(p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare m guild_members := g_me(auth.uid()); aid bigint;
begin
  if m.user_id is null then return '[]'::jsonb; end if;
  aid := al_of(m.guild_id); if aid is null then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ch', 'a', 'user_id', user_id, 'pseudo', pseudo, 'cls', cls, 'lvl', lvl, 'title', title, 'gname', gname, 'body', body, 'kind', kind, 'created_at', created_at) order by id), '[]'::jsonb)
    from (select * from alliance_msgs where alliance_id = aid and id > coalesce(p_after, 0) order by id desc limit 100) x);
end $$;

do $$ declare f text; begin
  foreach f in array array['ally_me()', 'ally_found(text, text, text, text)', 'ally_invite(bigint)', 'ally_ask(bigint)', 'ally_answer(bigint, bigint, boolean)', 'ally_leave()', 'ally_kick(bigint)',
    'prism_place(text)', 'prism_up(text, text)', 'ally_claim(bigint)', 'ally_say(text)', 'ally_chat(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['ps_start(uuid, text)', 'ps_done(uuid, int, text, int, boolean, boolean, int)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
