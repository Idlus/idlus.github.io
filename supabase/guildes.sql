-- ============================================================================
-- GUILDES — Idlus (multijoueur, étape 5)
-- Créer une guilde (Guildalogemme), la rejoindre (libre ou sur demande),
-- rangs (Meneur, Bras droit, Membre, Recrue), places de membres,
-- XP de guilde donnée par les membres (part choisie de 0 à 90 %), niveaux et bonus,
-- chat de guilde, journal, modération dans le panel admin.
-- 1.0.30 « Refonte des guildes » (choix 1A, 3A, 4A, 5A, 6A et 18A de Mathis) : Guildalogemme à 25 000 kamas
-- et un héros niveau 20, nouvelles guildes protégées 2 h, 5 places au départ (achetées avec le coffre
-- jusqu'à 15 : 250 000 × (place − 5)²), coffre de guilde (kamas des Percepteurs, dépôts, part des ventes
-- directes de 0 à 20 % ; personne ne retire), 4 améliorations à 10 rangs (100 000 × rang²) et 8 améliorations
-- uniques, fiche complète des autres guildes. Les anciennes guildes sont dissoutes par tools/serveur/guildes_reset.sql
-- (lancé par Mathis, jamais par ce fichier).
-- S'appuie sur supabase/hdv.sql (opérations sur la partie : hdv_op, hdv_save, hdv_kamas)
-- et sur supabase/chat.sql (pseudo_of, adm_need, alog, chat_sanctions) ; gboss.sql (Percepteurs, boss,
-- Guerre des Percepteurs) et codes.sql (code GUILDES) sont lus au moment de l'appel.
-- ============================================================================

create table if not exists public.guilds (
  id bigint generated always as identity primary key,
  name text not null,
  ic text not null default 'dofus',      -- emblème : icône du jeu (assets/ui)
  col text not null default '#8cc63f',   -- emblème : couleur
  motd text not null default '',
  open boolean not null default true,    -- vrai : on entre directement ; faux : sur demande
  xp bigint not null default 0,
  lvl int not null default 1,
  created_at timestamptz not null default now()
);
create unique index if not exists guilds_name on public.guilds (lower(name));
alter table public.guilds enable row level security;

-- rang : 0 Meneur, 1 Bras droit, 2 Membre, 3 Recrue
create table if not exists public.guild_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  rank smallint not null default 3 check (rank between 0 and 3),
  share smallint not null default 0 check (share between 0 and 90),
  given bigint not null default 0,
  week bigint not null default 0,          -- XP donnée cette semaine
  week_of date not null default (date_trunc('week', now()))::date,
  last_give timestamptz,
  joined_at timestamptz not null default now()
);
create index if not exists guild_members_g on public.guild_members (guild_id);
-- 1.0.12.6 : le Meneur ou un Bras droit peut régler la part d'XP d'un membre de rang plus bas (pseudo gardé ici ; vide = réglée par le joueur).
alter table public.guild_members add column if not exists share_by text;
alter table public.guild_members enable row level security;

-- demandes (un joueur demande à entrer) et invitations (la guilde invite un joueur)
create table if not exists public.guild_requests (
  guild_id bigint not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ask', 'invite')),
  by_user uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
alter table public.guild_requests enable row level security;

create table if not exists public.guild_msgs (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text, cls text, lvl int, title text,
  body text not null default '',
  item jsonb,
  kind text not null default 'msg',  -- 'msg' ou 'sys' (arrivée, départ, niveau de guilde)
  created_at timestamptz not null default now()
);
create index if not exists guild_msgs_g on public.guild_msgs (guild_id, id desc);
alter table public.guild_msgs enable row level security;

create table if not exists public.guild_log (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  at timestamptz not null default now(),
  txt text not null
);
create index if not exists guild_log_g on public.guild_log (guild_id, id desc);
alter table public.guild_log enable row level security;

-- ---------- 1.0.30 : coffre, places, améliorations, protection ----------
alter table public.guilds add column if not exists chest bigint not null default 0;         -- coffre de guilde (kamas)
alter table public.guilds add column if not exists seats int not null default 5;            -- places de membres (5 à 15)
alter table public.guilds add column if not exists ups jsonb not null default '{}'::jsonb;  -- rangs (poche, prospection, sagesse, robustesse : 0 à 10) et améliorations uniques (1)
alter table public.guilds add column if not exists shield_until timestamptz;                -- nouvelle guilde : Percepteurs protégés 2 h
alter table public.guilds add column if not exists pvp_win int not null default 0;          -- attaques entre guildes gagnées (attaque ou défense)
alter table public.guilds add column if not exists pvp_loss int not null default 0;
-- part de ses ventes directes que chaque membre donne au coffre (0 à 20 %, choisie par le membre)
alter table public.guild_members add column if not exists sale smallint not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'guild_members_sale_chk') then
    alter table public.guild_members add constraint guild_members_sale_chk check (sale between 0 and 20);
  end if;
end $$;
-- mouvements du coffre (les parts des ventes d'un même membre sont regroupées par heure)
create table if not exists public.guild_chest_log (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  at timestamptz not null default now(),
  k bigint not null,
  txt text not null,
  src text,                 -- regroupement (« vente:<joueur> »)
  n int not null default 1
);
create index if not exists guild_chest_log_g on public.guild_chest_log (guild_id, id desc);
alter table public.guild_chest_log enable row level security;

-- ---------- outils internes ----------
create or replace function public.g_err(t text) returns jsonb language sql immutable as $$ select jsonb_build_object('err', t) $$;
-- XP pour passer du niveau l au niveau l+1, et niveau atteint avec une XP totale (niveau 100 au plus)
create or replace function public.g_need(l int) returns bigint language sql immutable as $$ select (450000::bigint * l * l) $$;
create or replace function public.g_base(l int) returns bigint language sql immutable as $$ select (450000::numeric * (l - 1) * l * (2 * l - 1) / 6)::bigint $$;
create or replace function public.g_lvl(x bigint) returns int language plpgsql immutable as $$
declare l int := 1;
begin
  while l < 100 and g_base(l + 1) <= x loop l := l + 1; end loop;
  return l;
end $$;
create or replace function public.g_rname(r int) returns text language sql immutable as $$ select case r when 0 then 'Meneur' when 1 then 'Bras droit' when 2 then 'Membre' else 'Recrue' end $$;
create or replace function public.g_log(g bigint, t text, chat boolean default true) returns void language plpgsql security definer set search_path = public
as $$ begin
  insert into guild_log (guild_id, txt) values (g, t);
  if chat then insert into guild_msgs (guild_id, kind, body) values (g, 'sys', t); end if;
  delete from guild_log where guild_id = g and id < (select min(id) from (select id from guild_log where guild_id = g order by id desc limit 60) x);
end $$;
create or replace function public.g_me(u uuid) returns guild_members language sql stable security definer set search_path = public
as $$ select * from guild_members where user_id = u $$;
create or replace function public.g_count(g bigint) returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from guild_members where guild_id = g $$;
create or replace function public.g_name_ok(n text) returns text language plpgsql immutable as $$
declare x text;
begin
  if n is null or length(n) < 3 or length(n) > 24 then return 'Le nom fait de 3 à 24 caractères.'; end if;
  if n !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ''-]*$' then return 'Lettres, chiffres, espaces, apostrophes et tirets seulement.'; end if;
  x := translate(lower(n), 'àâäéèêëîïôöùûüç013456@$', 'aaaeeeeiioouuucoieasgas');
  if x ~ '(merde|pute|putain|connard|connasse|salope|encul|batard|nique|fuck|bitch|nigg|negre|nazi|hitler|bougnoul|youpin|pedale|tapette|admin|moderat|ankama)' then return 'Ce nom n''est pas autorisé.'; end if;
  return null;
end $$;
create or replace function public.g_join(u uuid, g bigint, how text) returns void language plpgsql security definer set search_path = public
as $$ begin
  insert into guild_members (user_id, guild_id, rank) values (u, g, 3);
  delete from guild_requests where user_id = u;
  perform g_log(g, pseudo_of(u) || ' rejoint la guilde' || coalesce(' (' || how || ')', '') || '.');
end $$;
-- Le Meneur s'en va : la place passe au rang le plus haut, puis au plus ancien.
create or replace function public.g_heir(g bigint) returns void language plpgsql security definer set search_path = public
as $$
declare h uuid;
begin
  if exists (select 1 from guild_members where guild_id = g and rank = 0) then return; end if;
  select user_id into h from guild_members where guild_id = g order by rank, joined_at limit 1;
  if h is null then delete from guilds where id = g; return; end if;
  update guild_members set rank = 0 where user_id = h;
  perform g_log(g, pseudo_of(h) || ' devient Meneur.');
end $$;
-- Nouvelle semaine : remet à zéro l'XP donnée cette semaine.
create or replace function public.g_week(u uuid) returns void language sql security definer set search_path = public
as $$ update guild_members set week = 0, week_of = (date_trunc('week', now()))::date where user_id = u and week_of < (date_trunc('week', now()))::date $$;

-- ---------- 1.0.30 : outils du coffre et des améliorations ----------
-- 1234567 → « 1 234 567 »
create or replace function public.g_fmt(n bigint) returns text language sql immutable
as $$ select case when n < 0 then '-' else '' end || regexp_replace(abs(n)::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') $$;
create or replace function public.g_seats(g bigint) returns int language sql stable security definer set search_path = public
as $$ select coalesce((select seats from guilds where id = g), 5) $$;
-- prix de la n-ième place (E.guildSeatPrice) : 6e 250 000, 10e 6 250 000, 15e 25 000 000
create or replace function public.g_seat_price(n int) returns bigint language sql immutable as $$ select 250000::bigint * greatest(0, n - 5) * greatest(0, n - 5) $$;
-- les améliorations (E.GUILD_RANKS et E.GUILD_UQ dans js/gboss.js) : max 10 = à rangs (100 000 × rang²), max 1 = unique
create or replace function public.g_upinfo(k text) returns jsonb language sql immutable
as $$ select case k
  when 'poche' then '{"n":"Poche","max":10}' when 'prospection' then '{"n":"Prospection","max":10}'
  when 'sagesse' then '{"n":"Sagesse","max":10}' when 'robustesse' then '{"n":"Robustesse","max":10}'
  when 'espionnage' then '{"n":"Espionnage","max":1,"lvl":3,"cost":1000000}'
  when 'coffrefort' then '{"n":"Coffre-fort","max":1,"lvl":5,"cost":2000000}'
  when 'vigie' then '{"n":"Vigie","max":1,"lvl":8,"cost":3000000}'
  when 'banniere' then '{"n":"Bannière de guerre","max":1,"lvl":10,"cost":5000000}'
  when 'comptoir' then '{"n":"Comptoir de guilde","max":1,"lvl":12,"cost":6000000}'
  when 'qg' then '{"n":"Quartier général","max":1,"lvl":15,"cost":10000000}'
  when 'percodore' then '{"n":"Percepteur doré","max":1,"lvl":18,"cost":14000000}'
  when 'cor' then '{"n":"Cor de ralliement","max":1,"lvl":20,"cost":20000000}'
  end::jsonb $$;
-- rang d'une amélioration (0 si pas achetée)
create or replace function public.g_up(g bigint, k text) returns int language sql stable security definer set search_path = public
as $$ select coalesce((select (ups->>k)::int from guilds where id = g), 0) $$;
-- Mouvement du coffre : k > 0 entre, k < 0 sort (le coffre ne descend jamais sous 0). Renvoie le nouveau contenu.
create or replace function public.g_chest(g bigint, p_k bigint, t text, src text default null) returns bigint language plpgsql security definer set search_path = public
as $$
declare c bigint; lid bigint;
begin
  if coalesce(p_k, 0) = 0 then return (select chest from guilds where id = g); end if;
  update guilds set chest = greatest(0, chest + p_k) where id = g returning chest into c;
  if c is null then return null; end if;
  if src is not null then
    select id into lid from guild_chest_log where guild_id = g and guild_chest_log.src = g_chest.src and at > now() - interval '1 hour' order by id desc limit 1;
    if lid is not null then update guild_chest_log set k = k + p_k, n = n + 1, txt = t, at = now() where id = lid; return c; end if;
  end if;
  insert into guild_chest_log (guild_id, k, txt, src) values (g, p_k, t, src);
  delete from guild_chest_log where guild_id = g and id < (select min(id) from (select id from guild_chest_log where guild_id = g order by id desc limit 80) x);
  return c;
end $$;

do $$ declare f text; begin
  foreach f in array array['g_need(int)', 'g_base(int)', 'g_lvl(bigint)', 'g_rname(int)', 'g_log(bigint, text, boolean)', 'g_me(uuid)', 'g_count(bigint)', 'g_name_ok(text)', 'g_join(uuid, bigint, text)', 'g_heir(bigint)', 'g_week(uuid)', 'g_err(text)',
    'g_fmt(bigint)', 'g_seats(bigint)', 'g_seat_price(int)', 'g_upinfo(text)', 'g_up(bigint, text)', 'g_chest(bigint, bigint, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture ----------
-- Liste des guildes (visible sans compte).
-- 1.0.30 : places, protection des nouvelles guildes, bilan des attaques et Percepteurs posés (plpgsql : guild_percos est dans gboss.sql).
create or replace function public.guild_list(p_q text default '') returns jsonb language plpgsql stable security definer set search_path = public
as $$ begin
  return (select coalesce(jsonb_agg(x order by x.lvl desc, x.n desc, x.name), '[]'::jsonb) from (
    select g.id, g.name, g.ic, g.col, g.lvl, g.open, g.motd, (select count(*) from guild_members m where m.guild_id = g.id) n, g.seats cap,
      (select pseudo_of(m.user_id) from guild_members m where m.guild_id = g.id and m.rank = 0 limit 1) chef,
      case when g.shield_until > now() then g.shield_until end shield, g.pvp_win w, g.pvp_loss l,
      (select count(*) from guild_percos p where p.guild_id = g.id) percos
    from guilds g where coalesce(p_q, '') = '' or g.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%'
    order by g.lvl desc limit 60) x);
end $$;
grant execute on function public.guild_list(text) to anon, authenticated;

-- 2.1.38.3 (idée de Gagou) : la guilde d'un joueur sur sa fiche (Classements, chat). Nom, emblème, niveau et rang : déjà publics
-- dans la fiche de la guilde (guild_view). Rien pour un compte sans guilde. Classique seulement (pas de guildes en Monocompte).
create or replace function public.guild_of(p_user uuid) returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('id', g.id, 'name', g.name, 'ic', g.ic, 'col', g.col, 'lvl', g.lvl, 'rank', g_rname(m.rank))
  from guild_members m join guilds g on g.id = m.guild_id where m.user_id = p_user $$;
grant execute on function public.guild_of(uuid) to anon, authenticated;

-- Ma guilde (ou mes invitations si je n'en ai pas).
create or replace function public.guild_me() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; gift boolean := false;
begin
  if me is null then return g_err('non connecté'); end if;
  perform g_week(me);
  m := g_me(me);
  if m.user_id is null then
    -- 1.0.30 : code GUILDES (créé par tools/serveur/guildes_reset.sql) encore valable et pas utilisé par ce compte
    begin
      gift := exists (select 1 from gift_codes c where c.code = 'GUILDES' and c.active and (c.ends is null or (now() at time zone 'Europe/Paris')::date <= c.ends)
        and (c.max_uses is null or c.uses < c.max_uses)) and not exists (select 1 from gift_uses u where u.code = 'GUILDES' and u.user_id = me);
    exception when undefined_table then gift := false; end;
    return jsonb_build_object('g', null, 'gift', gift,
      'invites', (select coalesce(jsonb_agg(jsonb_build_object('gid', r.guild_id, 'name', g2.name, 'ic', g2.ic, 'col', g2.col, 'lvl', g2.lvl, 'n', g_count(g2.id), 'cap', g2.seats, 'by', pseudo_of(r.by_user)) order by r.at desc), '[]'::jsonb)
        from guild_requests r join guilds g2 on g2.id = r.guild_id where r.user_id = me and r.kind = 'invite'),
      'asks', (select coalesce(jsonb_agg(r.guild_id), '[]'::jsonb) from guild_requests r where r.user_id = me and r.kind = 'ask'));
  end if;
  select * into g from guilds where id = m.guild_id;
  return jsonb_build_object(
    'g', jsonb_build_object('id', g.id, 'name', g.name, 'ic', g.ic, 'col', g.col, 'motd', g.motd, 'open', g.open, 'lvl', g.lvl, 'xp', g.xp,
      'base', g_base(g.lvl), 'next', case when g.lvl >= 100 then null else g_base(g.lvl + 1) end, 'created', g.created_at,
      -- 1.0.30 : coffre, places, améliorations, protection, bilan des attaques
      'chest', g.chest, 'seats', g.seats, 'ups', g.ups, 'shield', case when g.shield_until > now() then g.shield_until end, 'pvp', jsonb_build_array(g.pvp_win, g.pvp_loss),
      'chest24', (select coalesce(sum(k), 0) from guild_chest_log where guild_id = g.id and k > 0 and at > now() - interval '24 hours')),
    'rank', m.rank, 'share', m.share, 'share_by', m.share_by, 'sale', m.sale,
    'chestlog', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'k', k, 't', txt, 'n', n) order by id desc), '[]'::jsonb) from (select * from guild_chest_log where guild_id = g.id order by id desc limit 25) c),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('u', x.user_id, 'p', pseudo_of(x.user_id), 'rank', x.rank, 'share', x.share, 'sby', x.share_by, 'given', x.given,
        'week', case when x.week_of < (date_trunc('week', now()))::date then 0 else x.week end, 'joined', x.joined_at,
        'cls', l.main, 'lvl', l.main_lvl, 'seen', s.updated_at) order by x.rank, x.given desc), '[]'::jsonb)
      from guild_members x left join ladder l on l.user_id = x.user_id left join saves s on s.user_id = x.user_id where x.guild_id = g.id),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 't', txt) order by id desc), '[]'::jsonb) from (select * from guild_log where guild_id = g.id order by id desc limit 30) y),
    'asks', case when m.rank <= 1 then (select coalesce(jsonb_agg(jsonb_build_object('u', r.user_id, 'p', pseudo_of(r.user_id), 'cls', l.main, 'lvl', l.main_lvl, 'at', r.at) order by r.at), '[]'::jsonb)
      from guild_requests r left join ladder l on l.user_id = r.user_id where r.guild_id = g.id and r.kind = 'ask') else '[]'::jsonb end,
    'invited', (select coalesce(jsonb_agg(pseudo_of(r.user_id)), '[]'::jsonb) from guild_requests r where r.guild_id = g.id and r.kind = 'invite'));
end $$;

-- ---------- créer, rejoindre, partir ----------
create or replace function public.guild_create(p_after bigint, p_name text, p_ic text, p_col text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; e text; best int; gid bigint; n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  begin d := hdv_save(me); exception when raise_exception then return g_err(replace(sqlerrm, 'vendre ni acheter', 'fonder de guilde')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if (g_me(me)).user_id is not null then return g_err('Tu es déjà dans une guilde.'); end if;
  e := g_name_ok(n); if e is not null then return g_err(e); end if;
  if exists (select 1 from guilds where lower(name) = lower(n)) then return g_err('Ce nom est déjà pris.'); end if;
  select coalesce(max(case when coalesce((c->>'ren')::int, 0) > 0 then 200 else coalesce((c->>'lvl')::int, 1) end), 1) into best from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c;
  -- 1.0.30 (choix 5A) : Guildalogemme à 25 000 kamas et un héros niveau 20 (avant : 100 000 et 30)
  if best < 20 then return g_err('Il faut un héros au niveau 20 pour fonder une guilde.'); end if;
  if hdv_kamas(me, d) < 25000 then return g_err('La Guildalogemme coûte 25 000 kamas.'); end if;
  if p_col !~ '^#[0-9a-fA-F]{6}$' or p_ic !~ '^[a-z_]{2,20}$' then return g_err('Emblème illisible.'); end if;
  insert into guilds (name, ic, col, shield_until) values (n, p_ic, p_col, now() + interval '2 hours') returning id into gid; -- 1.0.30 : protégée 2 h
  insert into guild_members (user_id, guild_id, rank) values (me, gid, 0);
  delete from guild_requests where user_id = me;
  perform hdv_op(me, jsonb_build_object('k', -25000), 'Guildalogemme : fondation de la guilde ' || n);
  perform g_log(gid, pseudo_of(me) || ' fonde la guilde ' || n || ' !');
  return jsonb_build_object('ok', gid, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Rejoindre : directement si la guilde est ouverte, sinon une demande.
create or replace function public.guild_join(p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); g guilds;
begin
  if me is null or not exists (select 1 from profiles where id = me) then return g_err('Crée ton compte pour rejoindre une guilde.'); end if;
  if (g_me(me)).user_id is not null then return g_err('Tu es déjà dans une guilde.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || p_id));
  select * into g from guilds where id = p_id; if not found then return g_err('Cette guilde n''existe plus.'); end if;
  if exists (select 1 from guild_requests where guild_id = p_id and user_id = me and kind = 'invite') then
    if g_count(p_id) >= g.seats then return g_err(format('La guilde est complète (%s places).', g.seats)); end if;
    perform g_join(me, p_id, 'invitation'); return jsonb_build_object('ok', 'in');
  end if;
  if g.open then
    if g_count(p_id) >= g.seats then return g_err(format('La guilde est complète (%s places).', g.seats)); end if;
    perform g_join(me, p_id, null); return jsonb_build_object('ok', 'in');
  end if;
  if (select count(*) from guild_requests where user_id = me and kind = 'ask') >= 5 then return g_err('5 demandes en attente au maximum.'); end if;
  insert into guild_requests (guild_id, user_id, kind) values (p_id, me, 'ask') on conflict do nothing;
  return jsonb_build_object('ok', 'ask');
end $$;

-- Inviter un joueur (Membre ou plus).
create or replace function public.guild_invite(p_pseudo text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; o uuid;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if m.rank > 2 then return g_err('Les recrues ne peuvent pas encore inviter.'); end if;
  select id into o from profiles where lower(pseudo) = lower(btrim(p_pseudo)); if o is null then return g_err('Joueur introuvable.'); end if;
  if (g_me(o)).user_id is not null then return g_err('Ce joueur est déjà dans une guilde.'); end if;
  if g_count(m.guild_id) >= g_seats(m.guild_id) then return g_err(format('La guilde est complète (%s places) : achetez une place avec le coffre.', g_seats(m.guild_id))); end if;
  insert into guild_requests (guild_id, user_id, kind, by_user) values (m.guild_id, o, 'invite', me)
    on conflict (guild_id, user_id) do update set kind = 'invite', by_user = me, at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Répondre : à une invitation (p_user vide = moi) ou, pour un Bras droit ou le Meneur, à une demande.
create or replace function public.guild_answer(p_gid bigint, p_user uuid, p_yes boolean) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members;
begin
  if me is null then return g_err('non connecté'); end if;
  if p_user is null then
    if not exists (select 1 from guild_requests where guild_id = p_gid and user_id = me and kind = 'invite') then return g_err('Invitation expirée.'); end if;
    if not p_yes then delete from guild_requests where guild_id = p_gid and user_id = me; return jsonb_build_object('ok', true); end if;
    return guild_join(p_gid);
  end if;
  m := g_me(me); if m.user_id is null or m.guild_id <> p_gid or m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits répondent aux demandes.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || p_gid));
  if not exists (select 1 from guild_requests where guild_id = p_gid and user_id = p_user and kind = 'ask') then return g_err('Demande expirée.'); end if;
  if not p_yes then delete from guild_requests where guild_id = p_gid and user_id = p_user; return jsonb_build_object('ok', true); end if;
  if (g_me(p_user)).user_id is not null then delete from guild_requests where user_id = p_user; return g_err('Ce joueur a rejoint une autre guilde.'); end if;
  if g_count(p_gid) >= g_seats(p_gid) then return g_err(format('La guilde est complète (%s places) : achetez une place avec le coffre.', g_seats(p_gid))); end if;
  perform g_join(p_user, p_gid, 'accepté par ' || pseudo_of(me));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.guild_leave() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  delete from guild_members where user_id = me;
  if g_count(m.guild_id) = 0 then delete from guilds where id = m.guild_id; return jsonb_build_object('ok', 'gone'); end if;
  perform g_log(m.guild_id, pseudo_of(me) || ' quitte la guilde.');
  perform g_heir(m.guild_id);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- gérer ----------
-- Changer le rang d'un membre. Le Meneur peut tout faire (donner sa place le fait passer Bras droit) ;
-- un Bras droit fait passer une Recrue Membre ou l'inverse.
create or replace function public.guild_rank(p_user uuid, p_rank int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; o guild_members;
begin
  m := g_me(me); o := g_me(p_user);
  if m.user_id is null or o.user_id is null or o.guild_id <> m.guild_id then return g_err('Ce joueur n''est pas dans ta guilde.'); end if;
  if p_user = me then return g_err('Tu ne peux pas changer ton propre rang.'); end if;
  if p_rank not between 0 and 3 then return g_err('Rang inconnu.'); end if;
  if m.rank = 0 then
    if p_rank = 0 then update guild_members set rank = 1 where user_id = me; end if;
  elsif m.rank = 1 then
    if o.rank < 2 or p_rank < 2 then return g_err('Un Bras droit ne gère que les Membres et les Recrues.'); end if;
  else return g_err('Seuls le Meneur et les Bras droits changent les rangs.'); end if;
  update guild_members set rank = p_rank where user_id = p_user;
  perform g_log(m.guild_id, pseudo_of(p_user) || ' devient ' || g_rname(p_rank) || '.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.guild_kick(p_user uuid) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; o guild_members;
begin
  m := g_me(me); o := g_me(p_user);
  if m.user_id is null or o.user_id is null or o.guild_id <> m.guild_id then return g_err('Ce joueur n''est pas dans ta guilde.'); end if;
  if m.rank > 1 or o.rank <= m.rank then return g_err('Tu ne peux renvoyer que quelqu''un de rang plus bas, et il faut être Bras droit ou Meneur.'); end if;
  delete from guild_members where user_id = p_user;
  perform g_log(m.guild_id, pseudo_of(p_user) || ' a été renvoyé par ' || pseudo_of(me) || '.');
  return jsonb_build_object('ok', true);
end $$;

-- Message du jour, entrée libre ou sur demande (Bras droit ou Meneur), emblème (Meneur).
create or replace function public.guild_set(p_motd text, p_open boolean, p_ic text default null, p_col text default null) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; t text := btrim(coalesce(p_motd, ''));
begin
  m := g_me(me); if m.user_id is null or m.rank > 1 then return g_err('Réservé au Meneur et aux Bras droits.'); end if;
  if length(t) > 200 then return g_err('200 caractères au maximum.'); end if;
  if t ~* '(https?://|www\.)' then return g_err('Pas de liens dans le message du jour.'); end if;
  update guilds set motd = t, open = coalesce(p_open, open) where id = m.guild_id;
  if m.rank = 0 and p_ic is not null and p_ic ~ '^[a-z_]{2,20}$' and p_col ~ '^#[0-9a-fA-F]{6}$' then update guilds set ic = p_ic, col = p_col where id = m.guild_id; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Régler la part d'XP d'un membre : Meneur ou Bras droit, sur quelqu'un de rang plus bas.
-- Le joueur la voit (« réglée par … ») et peut toujours la changer lui-même.
create or replace function public.guild_share(p_user uuid, p_share int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; o guild_members; v int := greatest(0, least(90, coalesce(p_share, 0)));
begin
  m := g_me(me); o := g_me(p_user);
  if m.user_id is null or o.user_id is null or o.guild_id <> m.guild_id then return g_err('Ce joueur n''est pas dans ta guilde.'); end if;
  if p_user = me then return g_err('Règle ta propre part dans l''onglet Accueil.'); end if;
  if m.rank > 1 or o.rank <= m.rank then return g_err('Seuls le Meneur et les Bras droits règlent la part d''un membre de rang plus bas.'); end if;
  if v = o.share then return jsonb_build_object('ok', true); end if;
  update guild_members set share = v, share_by = pseudo_of(me) where user_id = p_user;
  perform g_log(m.guild_id, pseudo_of(me) || ' règle la part d''XP de ' || pseudo_of(p_user) || ' à ' || v || ' %.');
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 1.0.30 : coffre de guilde (choix 3A) ----------
-- Déposer des kamas (n'importe quel membre). Personne ne retire : le coffre sert aux places et aux améliorations.
create or replace function public.guild_deposit(p_after bigint, p_k bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; d jsonb; c bigint;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if coalesce(p_k, 0) < 1000 then return g_err('1 000 kamas au moins.'); end if;
  if p_k > 1000000000 then return g_err('Un milliard de kamas au plus d''un coup.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return g_err(replace(sqlerrm, 'vendre ni acheter', 'déposer au coffre')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if hdv_kamas(me, d) < p_k then return g_err('Tu n''as pas autant de kamas.'); end if;
  perform hdv_op(me, jsonb_build_object('k', -p_k), format('Dépôt au coffre de guilde : %s kamas', g_fmt(p_k)));
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  c := g_chest(m.guild_id, p_k, 'Dépôt de ' || pseudo_of(me));
  return jsonb_build_object('ok', true, 'chest', c, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Ma part des ventes directes pour le coffre (0 à 20 %), réglée par chaque membre pour lui-même.
create or replace function public.guild_sale_pct(p_pct int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; v int := greatest(0, least(20, coalesce(p_pct, 0)));
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  update guild_members set sale = v where user_id = me;
  return jsonb_build_object('ok', true, 'sale', v);
end $$;

-- Interface pour la vente directe (gm-economie) : verse au coffre la part choisie par le membre sur une vente
-- de p_kamas kamas et renvoie le montant pris (0 sans guilde ou à 0 %). À appeler dans la même transaction que la vente.
create or replace function public.guild_sale_share(p_user uuid, p_kamas bigint) returns bigint language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); s bigint;
begin
  if m.user_id is null or coalesce(m.sale, 0) <= 0 or coalesce(p_kamas, 0) <= 0 then return 0; end if;
  s := floor(p_kamas * least(20, m.sale) / 100.0)::bigint;
  if s <= 0 then return 0; end if;
  perform g_chest(m.guild_id, s, format('Part des ventes directes (%s, %s %%)', pseudo_of(p_user), m.sale), 'vente:' || p_user::text);
  return s;
end $$;
-- Interface : la guilde du joueur a-t-elle cette amélioration ('comptoir' : +5 % en vente directe) ?
create or replace function public.guild_has_upgrade(p_user uuid, p_key text) returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select coalesce((g.ups->>p_key)::int, 0) > 0 from guild_members m join guilds g on g.id = m.guild_id where m.user_id = p_user), false) $$;
revoke all on function public.guild_sale_share(uuid, bigint) from public, anon, authenticated;
revoke all on function public.guild_has_upgrade(uuid, text) from public, anon, authenticated;

-- ---------- 1.0.30 : places et améliorations, payées avec le coffre (choix 1A, 4A et 18A) ----------
-- p_k : 'place', un rang ('poche', 'prospection', 'sagesse', 'robustesse') ou une amélioration unique. Meneur ou Bras droit.
create or replace function public.guild_buy(p_k text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; u jsonb; r int; price bigint; t text;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits dépensent le coffre.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  select * into g from guilds where id = m.guild_id for update;
  if p_k = 'place' then
    if g.seats >= 15 then return g_err('La guilde a déjà 15 places, le maximum.'); end if;
    price := g_seat_price(g.seats + 1);
    if g.chest < price then return g_err(format('Il manque %s kamas dans le coffre.', g_fmt(price - g.chest))); end if;
    update guilds set seats = seats + 1 where id = g.id;
    perform g_chest(g.id, -price, format('%se place achetée par %s', g.seats + 1, pseudo_of(me)));
    perform g_log(g.id, format('%s achète la %se place de la guilde (%s kamas du coffre).', pseudo_of(me), g.seats + 1, g_fmt(price)));
    return jsonb_build_object('ok', true, 'seats', g.seats + 1, 'chest', g.chest - price);
  end if;
  u := g_upinfo(p_k); if u is null then return g_err('Amélioration inconnue.'); end if;
  r := coalesce((g.ups->>p_k)::int, 0);
  if (u->>'max')::int = 1 then
    if r >= 1 then return g_err('Déjà achetée.'); end if;
    if g.lvl < (u->>'lvl')::int then return g_err(format('Il faut une guilde niveau %s.', u->>'lvl')); end if;
    price := (u->>'cost')::bigint;
    t := format('%s achetée par %s', u->>'n', pseudo_of(me));
  else
    if r >= 10 then return g_err('Rang maximum atteint.'); end if;
    price := 100000::bigint * (r + 1) * (r + 1);
    t := format('Rang %s de %s acheté par %s', r + 1, u->>'n', pseudo_of(me));
  end if;
  if g.chest < price then return g_err(format('Il manque %s kamas dans le coffre.', g_fmt(price - g.chest))); end if;
  update guilds set ups = ups || jsonb_build_object(p_k, r + 1) where id = g.id;
  perform g_chest(g.id, -price, t);
  perform g_log(g.id, format('%s (%s kamas du coffre).', t, g_fmt(price)));
  return jsonb_build_object('ok', true, 'ups', g.ups || jsonb_build_object(p_k, r + 1), 'chest', g.chest - price);
end $$;

-- ---------- 1.0.30 : fiche d'une autre guilde (choix 6A) ----------
-- Membres, niveau, bilan des combats, boss, Percepteurs (avec leur bouclier et l'attaque en cours).
-- Avec l'Espionnage : l'équipe d'arène de chaque membre et le contenu de chaque poche.
create or replace function public.guild_view(p_id bigint) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare me uuid := auth.uid(); g guilds; my guild_members; mg guilds; spy boolean := false; wk int := gb_week();
begin
  select * into g from guilds where id = p_id; if not found then return g_err('Cette guilde n''existe plus.'); end if;
  my := g_me(me);
  if my.user_id is not null then select * into mg from guilds where id = my.guild_id; spy := coalesce((mg.ups->>'espionnage')::int, 0) > 0 and mg.id <> g.id; end if;
  return jsonb_build_object('id', g.id, 'name', g.name, 'ic', g.ic, 'col', g.col, 'motd', g.motd, 'lvl', g.lvl, 'n', g_count(g.id), 'cap', g.seats, 'created', g.created_at,
    'chef', (select pseudo_of(x.user_id) from guild_members x where x.guild_id = g.id and x.rank = 0 limit 1),
    'shield', case when g.shield_until > now() then g.shield_until end, 'pvp', jsonb_build_array(g.pvp_win, g.pvp_loss),
    'war', (select jsonb_build_object('pts', w.pts, 'win', w.win, 'loss', w.loss) from perco_war w where w.w = wk and w.guild_id = g.id),
    'boss', (select count(*) from gboss_phase b where b.w = wk and b.guild_id = g.id),
    'trophies', (select count(*) from guild_trophies t where t.guild_id = g.id),
    'rob', coalesce((g.ups->>'robustesse')::int, 0), 'fort', case when spy then coalesce((g.ups->>'coffrefort')::int, 0) > 0 end,
    'spy', spy, 'mine', my.guild_id is not distinct from g.id, 'mylvl', mg.lvl,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('p', pseudo_of(x.user_id), 'rank', x.rank, 'cls', l.main, 'lvl', l.main_lvl,
        'team', case when spy then k.heads end) order by x.rank, x.joined_at), '[]'::jsonb)
      from guild_members x left join ladder l on l.user_id = x.user_id left join koli k on k.user_id = x.user_id where x.guild_id = g.id),
    'percos', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'sid', p.sid, 'name', z.name, 'zlvl', z.lvl, 'dj', z.kind = 'dj', 'fill', least(1, pc_fill(p)),
        'shield', case when pc_shield(p) > now() then pc_shield(p) end, 'monsters', p.atk_at is not null, 'stars', p.stars, -- Chasse aux Percepteurs : bouclier ÷ 2 la nuit, vétérans
        'raid', (select jsonb_build_object('id', r.id, 'ends', r.ends, 'by', pseudo_of(r.att_user), 'g', (select name from guilds where id = r.att_guild), 'st', r.status)
          from perco_raids r where r.perco_id = p.id and r.status in ('open', 'fight') order by r.id desc limit 1),
        'pocket', case when spy then pc_gain(z.cap, pc_fill(p), g.ups) end) order by p.placed_at), '[]'::jsonb)
      from guild_percos p join perco_zones z on z.sid = p.sid where p.guild_id = g.id));
end $$;

-- ---------- XP de guilde ----------
-- Le jeu retire la part choisie de l'XP des combats et l'envoie ici. Plafond : 60 millions d'XP
-- par heure écoulée depuis le dernier envoi (24 h au plus), pour limiter les parties trafiquées.
create or replace function public.guild_give(p_xp bigint, p_share int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; cap numeric; x bigint; g guilds; nl int;
begin
  m := g_me(me); if m.user_id is null then return jsonb_build_object('ok', false, 'none', true); end if;
  perform g_week(me);
  -- p_share vide : on garde la part enregistrée (elle a pu être réglée par le Meneur ou un Bras droit).
  if p_share is not null and p_share is distinct from m.share then
    update guild_members set share = greatest(0, least(90, p_share)), share_by = null where user_id = me;
  end if;
  if coalesce(p_xp, 0) <= 0 then return jsonb_build_object('ok', true, 'xp', 0); end if;
  cap := 60000000 * least(24, greatest(1.0 / 60, extract(epoch from (now() - coalesce(m.last_give, m.joined_at))) / 3600));
  x := least(p_xp, cap)::bigint;
  update guild_members set given = given + x, week = week + x, last_give = now() where user_id = me;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  update guilds set xp = xp + x where id = m.guild_id returning * into g;
  nl := g_lvl(g.xp);
  if nl > g.lvl then
    update guilds set lvl = nl where id = g.id;
    perform g_log(g.id, 'La guilde passe au niveau ' || nl || ' !');
  end if;
  return jsonb_build_object('ok', true, 'xp', x, 'lvl', greatest(nl, g.lvl));
end $$;

-- ---------- chat de guilde ----------
create or replace function public.guild_say(p_body text, p_item jsonb default null) returns text language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; sa record; lad record; b text := btrim(coalesce(p_body, '')); last timestamptz;
begin
  m := g_me(me); if m.user_id is null then return 'Tu n''es pas dans une guilde.'; end if;
  select * into sa from chat_sanctions where user_id = me;
  if found and sa.banned then return 'Tu ne peux plus écrire dans le chat.'; end if;
  if found and sa.mute_until > now() then return format('Tu es muet encore %s min.', ceil(extract(epoch from (sa.mute_until - now())) / 60)); end if;
  if b = '' and p_item is null then return 'Le message est vide.'; end if;
  if length(b) > 200 then return '200 caractères au maximum.'; end if;
  if p_item is not null and (length(p_item::text) > 1500 or jsonb_typeof(p_item->'tpl') <> 'string') then return 'Objet illisible.'; end if;
  if b ~* '(https?://|www\.)' then return 'Les liens ne sont pas autorisés dans le chat.'; end if;
  select max(created_at) into last from guild_msgs where user_id = me;
  if last > now() - interval '2 seconds' then return 'Doucement : un message toutes les 2 secondes.'; end if;
  select * into lad from ladder where user_id = me;
  insert into guild_msgs (guild_id, user_id, pseudo, cls, lvl, title, body, item) values (m.guild_id, me, pseudo_of(me), lad.main, coalesce(lad.main_lvl, 1), lad.title, b, p_item);
  delete from guild_msgs where created_at < now() - interval '7 days';
  return null;
end $$;

create or replace function public.guild_chat(p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare m guild_members := g_me(auth.uid());
begin
  if m.user_id is null then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ch', 'u', 'user_id', user_id, 'pseudo', pseudo, 'cls', cls, 'lvl', lvl, 'title', title, 'body', body, 'item', item, 'kind', kind, 'created_at', created_at) order by id), '[]'::jsonb)
    from (select * from guild_msgs where guild_id = m.guild_id and id > coalesce(p_after, 0) order by id desc limit 100) x);
end $$;

do $$ declare f text; begin
  foreach f in array array['guild_me()', 'guild_create(bigint, text, text, text)', 'guild_join(bigint)', 'guild_invite(text)', 'guild_answer(bigint, uuid, boolean)', 'guild_leave()',
    'guild_rank(uuid, int)', 'guild_kick(uuid)', 'guild_share(uuid, int)', 'guild_set(text, boolean, text, text)', 'guild_give(bigint, int)', 'guild_say(text, jsonb)', 'guild_chat(bigint)',
    'guild_deposit(bigint, bigint)', 'guild_sale_pct(int)', 'guild_buy(text)', 'guild_view(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- panel admin (onglet « Guildes ») ----------
create or replace function public.adm_guilds(p_q text default '') returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform adm_need(false);
  return (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
    select g.id, g.name, g.ic, g.col, g.lvl, g.motd, g.created_at, (select count(*) from guild_members m where m.guild_id = g.id) n, g.seats cap, g.chest, -- 1.0.30
      (select pseudo_of(m.user_id) from guild_members m where m.guild_id = g.id and m.rank = 0 limit 1) chef,
      (select coalesce(jsonb_agg(jsonb_build_object('p', pseudo_of(m.user_id), 'rank', m.rank) order by m.rank, m.joined_at), '[]'::jsonb) from guild_members m where m.guild_id = g.id) members,
      (select count(*) from guild_msgs gm where gm.guild_id = g.id and gm.created_at > now() - interval '24 hours' and gm.kind = 'msg') msgs
    from guilds g where coalesce(p_q, '') = '' or g.name ilike '%' || p_q || '%' order by g.id desc limit 100) x);
end $$;
create or replace function public.adm_guild(p_id bigint, p_act text, p_name text default null) returns jsonb language plpgsql security definer set search_path = public
as $$
declare g guilds; e text;
begin
  perform adm_need(false);
  select * into g from guilds where id = p_id; if not found then return g_err('Guilde introuvable.'); end if;
  if p_act = 'motd' then update guilds set motd = '' where id = p_id; perform alog(format('message du jour de la guilde %s effacé', g.name));
  elsif p_act = 'rename' then
    e := g_name_ok(btrim(p_name)); if e is not null then return g_err(e); end if;
    if exists (select 1 from guilds where lower(name) = lower(btrim(p_name)) and id <> p_id) then return g_err('Ce nom est déjà pris.'); end if;
    update guilds set name = btrim(p_name) where id = p_id; perform alog(format('guilde %s renommée en %s', g.name, btrim(p_name)));
    perform g_log(p_id, 'L''équipe d''Idlus a renommé la guilde en ' || btrim(p_name) || '.');
  elsif p_act = 'dissolve' then
    perform adm_need(true);
    delete from guilds where id = p_id; perform alog(format('guilde %s dissoute', g.name));
  else return g_err('Action inconnue.'); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.adm_guilds(text) from public, anon;
revoke all on function public.adm_guild(bigint, text, text) from public, anon;
grant execute on function public.adm_guilds(text) to authenticated;
grant execute on function public.adm_guild(bigint, text, text) to authenticated;

-- ---------- 1.0.9 : classement des métiers par guilde (vues sur public.lb_jobs et public.lb_jobs_week de classements.sql) ----------
-- chaque guilde additionne les métiers de ses membres classés
-- 1.0.25 « Renaissance des métiers » : chaque renaissance d'un métier compte comme 200 niveaux
create or replace view public.lb_jobs_guild as
  select g.id as guild_id, g.name, g.ic, g.col, j.job, count(*)::int as members, sum(j.lvl + 200 * j.ren)::bigint as lvl, sum(j.total)::bigint as total,
    (array_agg(j.pseudo order by j.ren desc, j.lvl desc, j.total desc))[1] as best
  from public.lb_jobs j join public.guild_members gm on gm.user_id = j.user_id join public.guilds g on g.id = gm.guild_id
  group by g.id, g.name, g.ic, g.col, j.job;
grant select on public.lb_jobs_guild to anon, authenticated;
create or replace view public.lb_jobs_guild_week as
  select g.id as guild_id, g.name, g.ic, g.col, j.w, j.job, count(*)::int as members, sum(j.gain)::bigint as gain,
    (array_agg(j.pseudo order by j.gain desc))[1] as best
  from public.lb_jobs_week j join public.guild_members gm on gm.user_id = j.user_id join public.guilds g on g.id = gm.guild_id
  group by g.id, g.name, g.ic, g.col, j.w, j.job;
grant select on public.lb_jobs_guild_week to anon, authenticated;
