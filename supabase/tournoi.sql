-- Saison 1, lot 8 : le Tournoi des guildes (js/tournoi.js). Classique (Éternel) et Classique · Saison 1 (copie dans s1 par
-- tools/saison_schema.js). Pas en Monocompte (pas de guildes).
-- Inscriptions du lundi au samedi midi (heure de Paris) : la fonction « record » copie l'équipe d'arène du joueur depuis sa
-- partie en ligne (tour_join, réservé au serveur). 5 inscrits par guilde au plus. Le tableau est joué par la fonction
-- « record » (E.tourInit / E.tourStep) et gardé dans tour_state ; tout le monde peut le lire (tour_view), sans les équipes.
-- NE S'INSTALLE PAS TOUT SEUL : Mathis installe la saison en une fois (phrase d'installation).

create table if not exists public.tour_teams (
  w int not null,                                                   -- semaine (E.tourWeek, celle du Kolizéum)
  user_id uuid not null references auth.users (id) on delete cascade,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  pseudo text not null default '',
  team jsonb not null,                                              -- équipe d'arène copiée par le serveur
  lvl int not null default 1,
  heads jsonb not null default '[]'::jsonb,                         -- ce que voient les autres (classes, têtes, niveaux)
  at timestamptz not null default now(),
  primary key (w, user_id)
);
create index if not exists tour_teams_g on public.tour_teams (w, guild_id, at);
alter table public.tour_teams enable row level security;

create table if not exists public.tour_state (
  w int primary key,
  data jsonb not null,                                              -- état du tableau (E.tourInit), équipes comprises
  done boolean not null default false,
  at timestamptz not null default now()
);
alter table public.tour_state enable row level security;

-- semaine et phase, heure de Paris (mêmes règles que js/tournoi.js) ; tour_now : l'heure (remplacée dans les tests)
create or replace function public.tour_now() returns timestamp language sql stable as $$ select now() at time zone 'Europe/Paris' $$;
create or replace function public.tour_wk() returns int language sql stable set search_path = public
as $$ select floor(((tour_now()::date - date '1970-01-01') + 3) / 7.0)::int $$;
create or replace function public.tour_phase() returns text language sql stable set search_path = public
as $$ select case
  when extract(isodow from tour_now()) = 7 and extract(hour from tour_now()) >= 20 then 'finale'
  when extract(isodow from tour_now()) = 7 then 'tours'
  when extract(isodow from tour_now()) = 6 and extract(hour from tour_now()) >= 12 then 'tours'
  else 'inscr' end $$;

-- inscription (serveur seulement) : membre d'une guilde, pendant les inscriptions, 5 par guilde ; une nouvelle inscription
-- remplace l'équipe gardée
create or replace function public.tour_join(p_user uuid, p_w int, p_pseudo text, p_team jsonb, p_lvl int, p_heads jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare g bigint; n int;
begin
  if p_w <> tour_wk() then return jsonb_build_object('err', 'Semaine du tournoi dépassée : recharge la page.'); end if;
  if tour_phase() <> 'inscr' then return jsonb_build_object('err', 'Les inscriptions sont fermées : elles rouvrent lundi.'); end if;
  select guild_id into g from guild_members where user_id = p_user;
  if g is null then return jsonb_build_object('err', 'Il faut être dans une guilde.'); end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) = 0 then return jsonb_build_object('err', 'Choisis ton équipe d''arène (Kolizéum) : c''est elle qui combat.'); end if;
  perform pg_advisory_xact_lock(hashtext('tour'), g::int);
  delete from tour_teams where w = p_w and user_id = p_user and guild_id <> g;   -- a changé de guilde
  if not exists (select 1 from tour_teams where w = p_w and user_id = p_user) then
    select count(*) into n from tour_teams where w = p_w and guild_id = g;
    if n >= 5 then return jsonb_build_object('err', 'Ta guilde a déjà ses 5 équipes cette semaine.'); end if;
  end if;
  insert into tour_teams (w, user_id, guild_id, pseudo, team, lvl, heads) values (p_w, p_user, g, left(coalesce(p_pseudo, ''), 24), p_team, greatest(1, least(200, coalesce(p_lvl, 1))), coalesce(p_heads, '[]'::jsonb))
    on conflict (w, user_id) do update set team = excluded.team, lvl = excluded.lvl, heads = excluded.heads, pseudo = excluded.pseudo;
  return jsonb_build_object('ok', true, 'g', g);
end $$;
revoke all on function public.tour_join(uuid, int, text, jsonb, int, jsonb) from public, anon, authenticated;
grant execute on function public.tour_join(uuid, int, text, jsonb, int, jsonb) to service_role;

-- se retirer (le joueur) ou retirer un membre (Meneur ou Bras droit), pendant les inscriptions
create or replace function public.tour_leave(p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); g bigint; rk int; tgt uuid := coalesce(p_user, auth.uid());
begin
  if me is null then return jsonb_build_object('err', 'non connecté'); end if;
  if tour_phase() <> 'inscr' then return jsonb_build_object('err', 'Les inscriptions sont fermées.'); end if;
  if tgt <> me then
    select guild_id, rank into g, rk from guild_members where user_id = me;
    if g is null or rk > 1 then return jsonb_build_object('err', 'Seuls le Meneur et les Bras droits retirent une équipe.'); end if;
    if not exists (select 1 from tour_teams where w = tour_wk() and user_id = tgt and guild_id = g) then return jsonb_build_object('err', 'Équipe introuvable.'); end if;
  end if;
  delete from tour_teams where w = tour_wk() and user_id = tgt;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.tour_leave(uuid) from public, anon;
grant execute on function public.tour_leave(uuid) to authenticated;

-- les inscrits d'une semaine, par guilde, équipes comprises (serveur seulement : pour faire le tableau)
create or replace function public.tour_entries(p_w int) returns jsonb
language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x->>'g'), '[]'::jsonb) from (
  select jsonb_build_object('g', t.guild_id, 'name', gu.name, 'ic', gu.ic, 'col', gu.col,
    'teams', jsonb_agg(jsonb_build_object('u', t.user_id, 'n', t.pseudo, 'lvl', t.lvl, 'team', t.team, 'heads', t.heads) order by t.at)) x
  from tour_teams t join guilds gu on gu.id = t.guild_id where t.w = p_w group by t.guild_id, gu.name, gu.ic, gu.col) s $$;
revoke all on function public.tour_entries(int) from public, anon, authenticated;
grant execute on function public.tour_entries(int) to service_role;

create or replace function public.tour_save(p_w int, p_data jsonb, p_done boolean) returns void
language sql security definer set search_path = public
as $$ insert into tour_state (w, data, done, at) values (p_w, p_data, p_done, now())
  on conflict (w) do update set data = excluded.data, done = excluded.done, at = now() where not tour_state.done $$;
revoke all on function public.tour_save(int, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.tour_save(int, jsonb, boolean) to service_role;

-- ce que tout le monde voit : la phase, les inscrits (sans les équipes) et le tableau (sans les équipes)
create or replace function public.tour_view(p_w int default null) returns jsonb
language sql stable security definer set search_path = public
as $$
  with wk as (select coalesce(p_w, tour_wk()) w),
  st as (select s.data, s.done from tour_state s, wk where s.w = wk.w),
  ins as (select coalesce(jsonb_agg(jsonb_build_object('g', t.guild_id, 'name', gu.name, 'ic', gu.ic, 'col', gu.col, 'u', t.user_id, 'n', t.pseudo, 'lvl', t.lvl, 'heads', t.heads) order by t.guild_id, t.at), '[]'::jsonb) j
    from tour_teams t join guilds gu on gu.id = t.guild_id, wk where t.w = wk.w)
  select jsonb_build_object('w', (select w from wk), 'now', tour_wk(), 'phase', tour_phase(), 'ins', (select j from ins),
    'state', (select case when data is null then null else jsonb_set(data, '{seeds}', coalesce((select jsonb_agg(jsonb_build_object('g', e->'g', 'name', e->'name', 'ic', e->'ic', 'col', e->'col', 'pow', e->'pow',
      'teams', (select coalesce(jsonb_agg(jsonb_build_object('u', x->'u', 'n', x->'n', 'lvl', x->'lvl', 'heads', x->'heads')), '[]'::jsonb) from jsonb_array_elements(e->'teams') x)))
      from jsonb_array_elements(data->'seeds') e), '[]'::jsonb)) end from st),
    'done', coalesce((select done from st), false))
$$;
grant execute on function public.tour_view(int) to anon, authenticated, service_role;
