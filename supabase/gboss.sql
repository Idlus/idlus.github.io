-- ============================================================================
-- BOSS DE GUILDE ET PERCEPTEURS — Idlus (multijoueur, étape 5, suite des guildes)
-- Boss de la semaine : chaque membre a 3 essais par jour (heure de Paris). L'essai est joué par la
-- fonction serveur « record » sur la partie en ligne (js/gboss.js, E.gbossSim) ; ici on compte les
-- essais, les points de la guilde, les coffres par palier (25/50/75/100 %) et le titre des 3 meilleures guildes.
-- Percepteurs (version 2 « La guilde défend ensemble ») : posés dans une zone finie, poche pleine en 12 h,
-- une attaque de monstres environ une fois par jour, 2 h pour défendre (combat rejoué par « record »).
-- S'appuie sur guildes.sql (g_me, g_log, g_count, g_need, g_lvl), hdv.sql (hdv_op, hdv_save, hdv_kamas,
-- hdv_ops_after), chat.sql (pseudo_of) et percos_data.sql (perco_zones).
-- ============================================================================

create table if not exists public.gboss_hits (
  id bigint generated always as identity primary key,
  w int not null,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  n int not null,                 -- numéro de l'essai dans la semaine (fixe le hasard)
  day date not null,              -- jour de Paris (3 essais par jour)
  points int not null, raw int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null default now(),
  unique (user_id, w, n)
);
create index if not exists gboss_hits_g on public.gboss_hits (w, guild_id);
alter table public.gboss_hits enable row level security;

-- coffres ouverts (step 25/50/75/100) et titre reçu (step 0)
create table if not exists public.gboss_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null, step int not null,
  at timestamptz not null default now(),
  primary key (user_id, w, step)
);
alter table public.gboss_claims enable row level security;

create table if not exists public.guild_percos (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  sid text not null,
  by_user uuid references auth.users (id) on delete set null,
  placed_at timestamptz not null default now(),
  pk real not null default 0,                       -- poche (1 = pleine) au moment pk_at
  pk_at timestamptz not null default now(),
  next_atk timestamptz not null default now() + interval '18 hours' + random() * interval '12 hours',
  atk_at timestamptz,                               -- attaque en cours (2 h pour défendre)
  atk_n int not null default 0,                     -- défenseurs déjà battus
  atk_by uuid[] not null default '{}',              -- qui a déjà tenté pendant cette attaque
  wins int not null default 0, losses int not null default 0,
  unique (guild_id, sid)
);
alter table public.guild_percos enable row level security;

-- ---------- outils internes ----------
create or replace function public.gb_day() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;
-- même semaine que E.gbossWeek (js/gboss.js) : jours depuis le 1er janvier 1970 (un jeudi), ramenés au lundi
create or replace function public.gb_week() returns int language sql stable as $$ select ((gb_day() - date '1970-01-01') + 3) / 7 $$;
create or replace function public.gb_goal(g bigint) returns int language sql stable security definer set search_path = public
as $$ select 2500 * greatest(5, g_count(g)) $$;
create or replace function public.gb_pts(g bigint, wk int) returns bigint language sql stable security definer set search_path = public
as $$ select coalesce(sum(points), 0)::bigint from gboss_hits where guild_id = g and w = wk $$;
-- même coffre que E.gbossChest
create or replace function public.gb_chest(step int, lvl int) returns jsonb language sql immutable
as $$ select jsonb_build_object('k', round((1000 + lvl * 250) * (step / 25)), 'res', jsonb_build_object('Poussière de stasis', 15 * (step / 25))) $$;
-- les 3 meilleures guildes d'une semaine
create or replace function public.gb_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x.pts desc), '[]'::jsonb) from (
  select g.id, g.name, g.ic, g.col, g.lvl, sum(h.points)::bigint pts, count(distinct h.user_id) who
  from gboss_hits h join guilds g on g.id = h.guild_id where h.w = wk group by g.id order by pts desc limit lim) x $$;
-- XP de guilde gagnée hors combats (Percepteurs)
create or replace function public.g_addxp(g bigint, x bigint) returns void language plpgsql security definer set search_path = public
as $$
declare gg guilds; nl int;
begin
  if x <= 0 then return; end if;
  update guilds set xp = xp + x where id = g returning * into gg;
  nl := g_lvl(gg.xp);
  if nl > gg.lvl then update guilds set lvl = nl where id = g; perform g_log(g, 'La guilde passe au niveau ' || nl || ' !'); end if;
end $$;

-- poche actuelle d'un Percepteur (1 = pleine ; une défense réussie peut la faire dépasser)
create or replace function public.pc_fill(p guild_percos) returns real language sql stable
as $$ select case when p.pk >= 1 then p.pk else least(1, p.pk + extract(epoch from (now() - p.pk_at)) / 43200)::real end $$;
create or replace function public.pc_name(s text) returns text language sql stable security definer set search_path = public
as $$ select coalesce((select name from perco_zones where sid = s), s) $$;
-- Attaques : une nouvelle commence quand l'heure est passée ET qu'un membre regarde la guilde
-- (personne n'est pillé sans avoir pu le voir) ; sans victoire en 2 h, la moitié de la poche est perdue.
create or replace function public.pc_tick(g bigint) returns void language plpgsql security definer set search_path = public
as $$
declare p guild_percos;
begin
  for p in select * from guild_percos where guild_id = g for update loop
    if p.atk_at is not null and now() > p.atk_at + interval '2 hours' then
      update guild_percos set pk = pc_fill(p) * 0.5, pk_at = now(), atk_at = null, atk_n = 0, atk_by = '{}', losses = losses + 1,
        next_atk = now() + interval '18 hours' + random() * interval '12 hours' where id = p.id;
      perform g_log(g, 'Le Percepteur de ' || pc_name(p.sid) || ' a été pillé : la moitié de sa poche est perdue.');
    elsif p.atk_at is null and now() >= p.next_atk then
      update guild_percos set atk_at = now(), atk_n = 0, atk_by = '{}' where id = p.id;
      perform g_log(g, '⚔ Le Percepteur de ' || pc_name(p.sid) || ' est attaqué ! 2 h pour le défendre (Guilde › Percepteurs).');
    end if;
  end loop;
end $$;

do $$ declare f text; begin
  foreach f in array array['gb_goal(bigint)', 'gb_pts(bigint, int)', 'gb_top(int, int)', 'g_addxp(bigint, bigint)', 'pc_tick(bigint)', 'pc_name(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture : boss et Percepteurs de ma guilde ----------
create or replace function public.guild_extra() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; wk int := gb_week(); pts bigint; goal int; gl int; mylvl int; steps jsonb := '[]'::jsonb; s int; t3 jsonb;
begin
  m := g_me(me); if m.user_id is null then return jsonb_build_object('none', true); end if;
  perform pc_tick(m.guild_id);
  select * into g from guilds where id = m.guild_id;
  pts := gb_pts(g.id, wk); goal := gb_goal(g.id);
  select max(lvl) into mylvl from gboss_hits where user_id = me and w = wk;
  foreach s in array array[25, 50, 75, 100] loop
    steps := steps || jsonb_build_object('step', s, 'reached', pts * 100 >= goal::bigint * s,
      'claimed', exists (select 1 from gboss_claims where user_id = me and w = wk and step = s));
  end loop;
  t3 := gb_top(wk - 1, 3);
  return jsonb_build_object(
    'boss', jsonb_build_object('w', wk, 'pts', pts, 'goal', goal, 'steps', steps, 'lvl', mylvl,
      'today', (select count(*) from gboss_hits where user_id = me and day = gb_day()),
      'mine', (select coalesce(sum(points), 0) from gboss_hits where user_id = me and w = wk),
      'hitters', (select coalesce(jsonb_agg(x order by x.pts desc), '[]'::jsonb) from (
        select pseudo_of(user_id) p, sum(points)::bigint pts, count(*) n, max(points) best from gboss_hits where guild_id = g.id and w = wk group by user_id) x),
      'top', gb_top(wk, 10), 'last', t3,
      'claim', exists (select 1 from gboss_hits h where h.user_id = me and h.w in (wk - 1, wk) and (
          exists (select 1 from unnest(array[25, 50, 75, 100]) st where gb_pts(h.guild_id, h.w) * 100 >= gb_goal(h.guild_id)::bigint * st
            and not exists (select 1 from gboss_claims c where c.user_id = me and c.w = h.w and c.step = st))
          or (h.w = wk - 1 and not exists (select 1 from gboss_claims c where c.user_id = me and c.w = h.w and c.step = 0)
            and exists (select 1 from jsonb_array_elements(t3) e where (e->>'id')::bigint = h.guild_id))))),
    'percos', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'sid', p.sid, 'name', z.name, 'zlvl', z.lvl, 'cap', z.cap, 'fill', pc_fill(p),
        'by', pseudo_of(p.by_user), 'placed', p.placed_at, 'wins', p.wins, 'losses', p.losses, 'next', p.next_atk,
        'atk', case when p.atk_at is null then null else jsonb_build_object('at', p.atk_at, 'ends', p.atk_at + interval '2 hours', 'n', p.atk_n,
          'by', (select coalesce(jsonb_agg(pseudo_of(u)), '[]'::jsonb) from unnest(p.atk_by) u), 'done', me = any(p.atk_by)) end) order by p.placed_at), '[]'::jsonb)
      from guild_percos p left join perco_zones z on z.sid = p.sid where p.guild_id = g.id),
    'glvl', g.lvl, 'rank', m.rank, 'now', now());
end $$;

-- ---------- boss : ouvrir les coffres (semaine en cours et semaine passée) et recevoir le titre ----------
create or replace function public.gboss_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); wk int := gb_week(); x int; gid bigint; lv int; st int; k numeric := 0; dust int := 0; n int := 0; t3 jsonb; c jsonb;
begin
  if me is null then return g_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  foreach x in array array[wk - 1, wk] loop
    select guild_id, max(lvl) into gid, lv from gboss_hits where user_id = me and w = x group by guild_id order by max(id) desc limit 1;
    if gid is null then continue; end if;
    foreach st in array array[25, 50, 75, 100] loop
      if gb_pts(gid, x) * 100 >= gb_goal(gid)::bigint * st and not exists (select 1 from gboss_claims where user_id = me and w = x and step = st) then
        insert into gboss_claims (user_id, w, step) values (me, x, st);
        c := gb_chest(st, lv); k := k + (c->>'k')::numeric; dust := dust + (c->'res'->>'Poussière de stasis')::int; n := n + 1;
      end if;
    end loop;
    if x = wk - 1 and not exists (select 1 from gboss_claims where user_id = me and w = x and step = 0) then
      t3 := gb_top(x, 3);
      if exists (select 1 from jsonb_array_elements(t3) e where (e->>'id')::bigint = gid) then
        insert into gboss_claims (user_id, w, step) values (me, x, 0);
        perform hdv_op(me, jsonb_build_object('title', 'Pourfendeur de boss'), 'Boss de guilde : ta guilde finit dans les 3 meilleures de la semaine, titre « Pourfendeur de boss » !');
      end if;
    end if;
  end loop;
  if n > 0 then perform hdv_op(me, jsonb_build_object('k', k, 'res', jsonb_build_object('Poussière de stasis', dust)), format('Boss de guilde : %s coffre%s ouvert%s (%s kamas, %s Poussières de stasis)', n, case when n > 1 then 's' else '' end, case when n > 1 then 's' else '' end, k, dust)); end if;
  return jsonb_build_object('ok', n, 'k', k, 'dust', dust, 'ops', hdv_ops_after(me, p_after));
end $$;

-- ---------- Percepteurs ----------
create or replace function public.perco_place(p_after bigint, p_sid text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; d jsonb; z perco_zones; slots int;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if m.rank > 2 then return g_err('Les Recrues ne posent pas de Percepteur : il faut être Membre, Bras droit ou Meneur.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return g_err(replace(sqlerrm, 'vendre ni acheter', 'poser de Percepteur')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  select * into g from guilds where id = m.guild_id;
  slots := least(5, g.lvl / 5);
  if slots < 1 then return g_err('Le premier Percepteur arrive au niveau 5 de guilde.'); end if;
  if (select count(*) from guild_percos where guild_id = g.id) >= slots then return g_err(format('Ta guilde a déjà %s Percepteur%s (un de plus tous les 5 niveaux de guilde).', slots, case when slots > 1 then 's' else '' end)); end if;
  select * into z from perco_zones where sid = p_sid; if not found then return g_err('Zone inconnue.'); end if;
  if coalesce(d->'trophies'->>p_sid, '') = '' then return g_err('Il faut avoir fini cette zone (tous ses monstres au palier Traqueur).'); end if;
  if exists (select 1 from guild_percos where guild_id = g.id and sid = p_sid) then return g_err('Ta guilde a déjà un Percepteur dans cette zone.'); end if;
  if hdv_kamas(me, d) < 20000 then return g_err('Un Percepteur coûte 20 000 kamas.'); end if;
  insert into guild_percos (guild_id, sid, by_user) values (g.id, p_sid, me);
  perform hdv_op(me, jsonb_build_object('k', -20000), 'Percepteur posé : ' || z.name);
  perform g_log(g.id, pseudo_of(me) || ' pose un Percepteur à ' || z.name || '.');
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.perco_collect(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; p guild_percos; z perco_zones; f real; res jsonb := '{}'::jsonb; r record; k bigint; g guilds; gx bigint;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if not exists (select 1 from profiles where id = me) then return g_err('Crée ton compte pour récolter.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  perform pc_tick(m.guild_id);
  select * into p from guild_percos where id = p_id and guild_id = m.guild_id; if not found then return g_err('Ce Percepteur n''existe plus.'); end if;
  if p.atk_at is not null then return g_err('Il est attaqué : défends-le d''abord !'); end if;
  f := pc_fill(p); if f < 0.05 then return g_err('La poche est presque vide : reviens plus tard.'); end if;
  select * into z from perco_zones where sid = p.sid;
  k := floor((z.cap->>'k')::numeric * f);
  for r in select key, value from jsonb_each_text(z.cap->'res') loop
    if floor(r.value::numeric * f) >= 1 then res := res || jsonb_build_object(r.key, floor(r.value::numeric * f)); end if;
  end loop;
  update guild_percos set pk = 0, pk_at = now() where id = p.id;
  perform hdv_op(me, jsonb_build_object('k', k, 'res', res), format('Percepteur de %s récolté : %s kamas et des ressources', z.name, k));
  select * into g from guilds where id = m.guild_id;
  gx := round(g_need(g.lvl) * 0.01 * least(f, 2));
  perform g_addxp(g.id, gx);
  perform g_log(g.id, format('%s récolte le Percepteur de %s (%s kamas, +%s XP de guilde).', pseudo_of(me), z.name, k, gx), false);
  return jsonb_build_object('ok', true, 'k', k, 'res', res, 'gxp', gx, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.perco_remove(p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; p guild_percos;
begin
  m := g_me(me); if m.user_id is null or m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits retirent les Percepteurs.'); end if;
  select * into p from guild_percos where id = p_id and guild_id = m.guild_id; if not found then return g_err('Ce Percepteur n''existe plus.'); end if;
  if p.atk_at is not null then return g_err('On ne retire pas un Percepteur attaqué.'); end if;
  delete from guild_percos where id = p.id;
  perform g_log(m.guild_id, pseudo_of(me) || ' retire le Percepteur de ' || pc_name(p.sid) || '.');
  return jsonb_build_object('ok', true);
end $$;

do $$ declare f text; begin
  foreach f in array array['guild_extra()', 'gboss_claim(bigint)', 'perco_place(bigint, text)', 'perco_collect(bigint, bigint)', 'perco_remove(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- appelées par la fonction serveur « record » (clé de service) ----------
-- Boss : vérifie l'essai et donne son numéro dans la semaine.
create or replace function public.gb_start(p_user uuid, p_w int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user);
begin
  if m.user_id is null then return g_err('Rejoins une guilde pour affronter le boss.'); end if;
  if p_w <> gb_week() then return g_err('Nouvelle semaine : réessaie.'); end if;
  if (select count(*) from gboss_hits where user_id = p_user and day = gb_day()) >= 3 then return g_err('Plus d''essai aujourd''hui : reviens demain.'); end if;
  return jsonb_build_object('ok', true, 'n', (select count(*) from gboss_hits where user_id = p_user and w = p_w), 'gid', m.guild_id);
end $$;
-- Boss : enregistre l'essai rejoué ; annonce les paliers franchis dans le chat de guilde.
create or replace function public.gb_done(p_user uuid, p_w int, p_n int, p_points int, p_raw int, p_lvl int, p_rounds int, p_alive int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); before bigint; after bigint; goal int; st int;
begin
  if m.user_id is null then return g_err('Rejoins une guilde pour affronter le boss.'); end if;
  perform pg_advisory_xact_lock(hashtext('gboss' || m.guild_id));
  if (select count(*) from gboss_hits where user_id = p_user and day = gb_day()) >= 3 then return g_err('Plus d''essai aujourd''hui : reviens demain.'); end if;
  before := gb_pts(m.guild_id, p_w); goal := gb_goal(m.guild_id);
  begin
    insert into gboss_hits (w, guild_id, user_id, n, day, points, raw, lvl, rounds, alive) values (p_w, m.guild_id, p_user, p_n, gb_day(), greatest(0, p_points), greatest(0, p_raw), p_lvl, p_rounds, p_alive);
  exception when unique_violation then return g_err('Essai déjà compté.'); end;
  after := before + greatest(0, p_points);
  perform g_log(m.guild_id, format('%s inflige %s points au boss de la semaine.', pseudo_of(p_user), p_points), false);
  foreach st in array array[25, 50, 75, 100] loop
    if before * 100 < goal::bigint * st and after * 100 >= goal::bigint * st then
      perform g_log(m.guild_id, format('Boss de la semaine : la guilde atteint %s %% ! Un coffre attend chaque membre qui a frappé.', st));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'pts', after, 'goal', goal, 'left', 3 - (select count(*) from gboss_hits where user_id = p_user and day = gb_day()));
end $$;
-- Percepteur : vérifie que l'attaque est en cours et que ce joueur n'a pas encore tenté.
create or replace function public.pc_start(p_user uuid, p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); p guild_percos;
begin
  if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  perform pc_tick(m.guild_id);
  select * into p from guild_percos where id = p_id and guild_id = m.guild_id; if not found then return g_err('Ce Percepteur n''existe plus.'); end if;
  if p.atk_at is null then return g_err('Ce Percepteur n''est plus attaqué.'); end if;
  if p_user = any(p.atk_by) then return g_err('Tu as déjà tenté ta défense pendant cette attaque.'); end if;
  return jsonb_build_object('ok', true, 'sid', p.sid, 'n', p.atk_n, 'aid', floor(extract(epoch from p.atk_at))::bigint);
end $$;
create or replace function public.pc_done(p_user uuid, p_id bigint, p_aid bigint, p_win boolean) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); p guild_percos; z perco_zones; g guilds; gx bigint;
begin
  if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  select * into p from guild_percos where id = p_id and guild_id = m.guild_id for update; if not found then return g_err('Ce Percepteur n''existe plus.'); end if;
  if p.atk_at is null or floor(extract(epoch from p.atk_at))::bigint <> p_aid then return g_err('L''attaque est déjà finie.'); end if;
  if p_user = any(p.atk_by) then return g_err('Tu as déjà tenté ta défense pendant cette attaque.'); end if;
  select * into z from perco_zones where sid = p.sid;
  if not p_win then
    update guild_percos set atk_n = atk_n + 1, atk_by = atk_by || p_user where id = p.id;
    perform g_log(m.guild_id, format('%s n''a pas pu repousser l''attaque sur le Percepteur de %s : les monstres se renforcent.', pseudo_of(p_user), z.name));
    return jsonb_build_object('ok', true, 'win', false);
  end if;
  update guild_percos set pk = least(2.5, pc_fill(p) * 1.25), pk_at = now(), atk_at = null, atk_n = 0, atk_by = '{}', wins = wins + 1,
    next_atk = now() + interval '18 hours' + random() * interval '12 hours' where id = p.id;
  select * into g from guilds where id = m.guild_id;
  gx := round(g_need(g.lvl) * 0.02);
  perform g_addxp(g.id, gx);
  perform hdv_op(p_user, jsonb_build_object('k', 300 * z.lvl, 'res', jsonb_build_object('Poussière de stasis', 10)), format('Défense du Percepteur de %s : coffre de %s kamas et 10 Poussières de stasis', z.name, 300 * z.lvl));
  perform g_log(m.guild_id, format('🛡 %s défend le Percepteur de %s ! Poche +25 %%, +%s XP de guilde.', pseudo_of(p_user), z.name, gx));
  return jsonb_build_object('ok', true, 'win', true, 'gxp', gx);
end $$;

do $$ declare f text; begin
  foreach f in array array['gb_start(uuid, int)', 'gb_done(uuid, int, int, int, int, int, int, int)', 'pc_start(uuid, bigint)', 'pc_done(uuid, bigint, bigint, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
