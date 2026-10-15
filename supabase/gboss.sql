-- ============================================================================
-- BOSS DE GUILDE ET PERCEPTEURS — Idlus (multijoueur, étape 5, suite des guildes)
-- L'essai de boss, les défenses et les attaques sont joués par la fonction serveur « record » sur la partie
-- en ligne (js/gboss.js : E.gbossSim, E.percoSim ; js/koli.js : E.koliSim) ; ici on compte et on récompense.
-- 1.0.30 « Refonte des guildes » (choix 7A à 12A, 19A et 20A de Mathis) :
-- - Boss de la semaine en 5 phases : 25 000 points de vie par membre (au moins 3 comptés), vie figée à la
--   première frappe de la semaine. Un essai toutes les 25 min (20 avec le Cor de ralliement), 6 en réserve.
-- 1.0.33 « Boss de guilde rééquilibré » (choix 1A à 6A de Mathis) : un essai toutes les 2 h (1 h 40 avec le Cor), 12 en réserve ;
--   vie = 15 000 points par membre actif (partie en ligne ou arrivée depuis moins de 14 jours, au moins 3) ; après la phase 5,
--   phases Ultimes sans fin (10 % de la vie chacune, 30 Poussières par membre) ; coffres : kamas ×4 et ressources du boss,
--   Coffre du trophée (un équipement du donjon) en phase 5 ; coffres pour les membres qui ont fait au moins 3 essais.
--   Chaque phase tombée verse des kamas au coffre de guilde et ouvre un coffre pour chaque membre qui a frappé ;
--   la 5e donne le trophée du boss, et un titre aux membres de la première guilde du serveur qui le finit.
-- - Percepteurs : en zone finie ou en donjon fait en stasis 1 ou plus, un seul par zone sur tout le serveur,
--   kamas au coffre de guilde, ressources à celui qui récolte, rangs de la guilde (Poche, Prospection, Sagesse,
--   Robustesse). Les monstres attaquent toujours (deux fois plus souvent en donjon).
-- - Attaques entre guildes (« Guerre des Percepteurs ») : annoncées, 2 h pour défendre (3 h avec la Vigie) avec
--   son équipe d'arène, puis le Percepteur et ses gardes se défendent seuls. Classement de la semaine, titre « Conquérant ».
-- S'appuie sur guildes.sql (g_me, g_log, g_count, g_need, g_lvl, g_chest, g_fmt, g_up), hdv.sql (hdv_op, hdv_save,
-- hdv_kamas, hdv_ops_after), chat.sql (pseudo_of) et percos_data.sql (perco_zones). Relançable sans danger :
-- ne supprime ni ne modifie aucune donnée de joueur existante.
-- ============================================================================

create table if not exists public.gboss_hits (
  id bigint generated always as identity primary key,
  w int not null,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  n int not null,                 -- numéro de l'essai dans la semaine (fixe le hasard)
  day date not null,              -- jour de Paris
  points int not null, raw int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null default now(),
  unique (user_id, w, n)
);
create index if not exists gboss_hits_g on public.gboss_hits (w, guild_id);
alter table public.gboss_hits enable row level security;

-- coffres ouverts et titres reçus (1.0.30 : 1001 à 1004 = coffres des phases 1 à 4, 1100 = première guilde
-- à finir le boss, 1200 = Conquérant, 1300 = Ombre de la nuit (Chasse aux Percepteurs) ; 0 = 3 meilleures guildes ; 25 à 100 = anciens paliers)
create table if not exists public.gboss_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null, step int not null,
  at timestamptz not null default now(),
  primary key (user_id, w, step)
);
alter table public.gboss_claims enable row level security;

-- 1.0.30 : réserve d'essais du boss (t essais au moment at, +1 toutes les 25 min, 6 au plus)
create table if not exists public.gboss_charge (
  user_id uuid primary key references auth.users (id) on delete cascade,
  t real not null default 6,
  at timestamptz not null default now()
);
alter table public.gboss_charge enable row level security;
-- 1.0.30 : vie du boss de chaque guilde, figée à la première frappe de la semaine
create table if not exists public.gboss_goal (
  w int not null, guild_id bigint not null references public.guilds (id) on delete cascade, goal int not null,
  primary key (w, guild_id)
);
alter table public.gboss_goal enable row level security;
-- 1.0.33 : ressource du boss (coffres des phases 1 à 4) et équipements de son donjon (Coffre du trophée), envoyés par la fonction « record »
alter table public.gboss_goal add column if not exists res text;
alter table public.gboss_goal add column if not exists eq jsonb;
-- 1.0.30 : phases tombées
create table if not exists public.gboss_phase (
  w int not null, guild_id bigint not null references public.guilds (id) on delete cascade, phase int not null,
  at timestamptz not null default now(),
  primary key (w, guild_id, phase)
);
alter table public.gboss_phase enable row level security;
-- 1.0.30 : trophées (boss de la semaine fini) ; first = première guilde du serveur à le finir
create table if not exists public.guild_trophies (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  w int not null, first boolean not null default false,
  at timestamptz not null default now(),
  unique (guild_id, w)
);
alter table public.guild_trophies enable row level security;

create table if not exists public.guild_percos (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  sid text not null,
  by_user uuid references auth.users (id) on delete set null,
  placed_at timestamptz not null default now(),
  pk real not null default 0,                       -- poche (1 = pleine) au moment pk_at
  pk_at timestamptz not null default now(),
  next_atk timestamptz not null default now() + interval '18 hours' + random() * interval '12 hours',
  atk_at timestamptz,                               -- attaque de monstres en cours (2 h pour défendre)
  atk_n int not null default 0,                     -- défenseurs déjà battus
  atk_by uuid[] not null default '{}',              -- qui a déjà tenté pendant cette attaque
  wins int not null default 0, losses int not null default 0,
  unique (guild_id, sid)
);
alter table public.guild_percos add column if not exists shield_until timestamptz; -- 1.0.30 : bouclier de 6 h après une attaque
alter table public.guild_percos enable row level security;
-- 1.0.30 (choix 8A) : un seul Percepteur par zone sur tout le serveur. L'index n'est posé que si les données le
-- permettent (sinon tools/serveur/guildes_reset.sql le pose après la remise à zéro) ; perco_place vérifie aussi.
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'guild_percos_sid')
     and not exists (select 1 from public.guild_percos group by sid having count(*) > 1) then
    create unique index guild_percos_sid on public.guild_percos (sid);
  end if;
end $$;

-- 1.0.30 : Percepteurs assommés (la place ne sert pas pendant 12 h) et zones gardées par la guilde gagnante (1 h)
create table if not exists public.perco_ko (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  sid text not null, until timestamptz not null
);
create index if not exists perco_ko_g on public.perco_ko (guild_id, until);
alter table public.perco_ko enable row level security;
create table if not exists public.perco_hold (
  sid text primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  until timestamptz not null
);
alter table public.perco_hold enable row level security;

-- 1.0.30 : attaques entre guildes. status : open (les défenseurs ont jusqu'à ends), fight (le Percepteur se défend),
-- repelled (un défenseur a gagné), won (l'attaquant a pillé), lost (le Percepteur a gagné).
create table if not exists public.perco_raids (
  id bigint generated always as identity primary key,
  perco_id bigint not null,
  sid text not null,
  def_guild bigint not null references public.guilds (id) on delete cascade,
  att_guild bigint not null references public.guilds (id) on delete cascade,
  att_user uuid not null references auth.users (id) on delete cascade,
  att_team jsonb not null,                -- équipe d'arène de l'attaquant (copie faite par le serveur au lancement)
  att_heads jsonb not null default '[]'::jsonb,
  att_lvl int not null default 1,
  at timestamptz not null default now(),
  ends timestamptz not null,
  status text not null default 'open' check (status in ('open', 'fight', 'repelled', 'won', 'lost')),
  tries jsonb not null default '[]'::jsonb, -- défenses tentées : [{u, p, heads, win, at}]
  res jsonb,                              -- butin ou fin
  fight_at timestamptz, done_at timestamptz
);
create index if not exists perco_raids_def on public.perco_raids (def_guild, id desc);
create index if not exists perco_raids_att on public.perco_raids (att_guild, id desc);
create index if not exists perco_raids_user on public.perco_raids (att_user, at desc);
create index if not exists perco_raids_perco on public.perco_raids (perco_id, status);
alter table public.perco_raids enable row level security;
-- « Chasse aux Percepteurs » (choix 6A à 10A de Mathis) :
-- vétérans (une étoile par attaque de guilde repoussée, 5 au plus, perdues au pillage), revanche (attaque gratuite,
-- butin +25 %), Nuit des Percepteurs (samedi 20 h-23 h, Paris : butin ×1,5), primes payées par le coffre.
alter table public.guild_percos add column if not exists stars int not null default 0;
alter table public.perco_raids add column if not exists free boolean not null default false;  -- revanche : ne compte pas dans les attaques du jour
alter table public.perco_raids add column if not exists bonus real not null default 1;         -- butin ×1,25 (revanche), ×1,5 (nuit)
alter table public.perco_raids add column if not exists night boolean not null default false; -- lancée pendant la Nuit des Percepteurs
-- revanche : la guilde guild_id a été pillée par target ; chaque membre peut l'attaquer une fois jusqu'à until
create table if not exists public.perco_revenge (
  id bigint generated always as identity primary key,
  guild_id bigint not null references public.guilds (id) on delete cascade,
  target bigint not null references public.guilds (id) on delete cascade,
  sid text not null,
  at timestamptz not null default now(),
  until timestamptz not null
);
create index if not exists perco_revenge_g on public.perco_revenge (guild_id, until);
alter table public.perco_revenge enable row level security;
-- primes (avis de recherche) : k kamas pris au coffre de by_guild, versés à celui qui pille le Percepteur avant until
create table if not exists public.perco_bounty (
  id bigint generated always as identity primary key,
  perco_id bigint not null,
  sid text not null,
  def_guild bigint references public.guilds (id) on delete cascade,
  by_guild bigint not null references public.guilds (id) on delete cascade,
  by_user uuid references auth.users (id) on delete set null,
  k bigint not null,
  at timestamptz not null default now(),
  until timestamptz not null,
  done text check (done in ('paid', 'back'))
);
create index if not exists perco_bounty_p on public.perco_bounty (perco_id) where done is null;
alter table public.perco_bounty enable row level security;
-- 1.0.30 : Guerre des Percepteurs, classement de la semaine (3 points par attaque gagnée, 1 par attaque repoussée)
create table if not exists public.perco_war (
  w int not null, guild_id bigint not null references public.guilds (id) on delete cascade,
  pts int not null default 0, win int not null default 0, loss int not null default 0, def int not null default 0,
  primary key (w, guild_id)
);
alter table public.perco_war enable row level security;

-- ---------- outils internes ----------
create or replace function public.gb_day() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;
-- même semaine que E.gbossWeek (js/gboss.js) : jours depuis le 1er janvier 1970 (un jeudi), ramenés au lundi
create or replace function public.gb_week() returns int language sql stable as $$ select ((gb_day() - date '1970-01-01') + 3) / 7 $$;
-- 1.0.33 : membres actifs (E.GBOSS_ACTIVE_DAYS) : partie en ligne envoyée, ou arrivée dans la guilde, depuis moins de 14 jours
create or replace function public.gb_active(g bigint) returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from guild_members m left join saves s on s.user_id = m.user_id
  where m.guild_id = g and (m.joined_at > now() - interval '14 days' or s.updated_at > now() - interval '14 days') $$;
-- vie du boss (E.gbossGoal) : 1.0.33 : 15 000 par membre actif (1.0.30 : 25 000 par membre), au moins 3 comptés, figée à la première frappe de la semaine
create or replace function public.gb_goalw(g bigint, wk int) returns int language sql stable security definer set search_path = public
as $$ select coalesce((select goal from gboss_goal where w = wk and guild_id = g), 15000 * greatest(3, gb_active(g))) $$;
create or replace function public.gb_goal(g bigint) returns int language sql stable security definer set search_path = public
as $$ select gb_goalw(g, gb_week()) $$;
-- phases tombées pour pts points (seuils cumulés 8, 22, 42, 68 et 100 % : E.gbossThr) ;
-- 1.0.33 : puis une phase Ultime tous les 10 % de la vie (E.gbossPhase)
create or replace function public.gb_nph(pts bigint, goal int) returns int language sql immutable
as $$ select case when pts >= goal then 5 + floor((pts - goal)::numeric / greatest(1, floor(goal::numeric * 10 / 100)))::int
  else (select count(*)::int from unnest(array[8, 22, 42, 68, 100]) c where pts >= floor(goal::numeric * c / 100)) end $$;
-- kamas versés au coffre quand la phase tombe (E.GBOSS_PHASE_K)
create or replace function public.gb_phase_k(p int) returns bigint language sql immutable
as $$ select (array[300000, 600000, 900000, 1200000, 1500000]::bigint[])[greatest(1, least(5, p))] $$;
-- minutes pour un essai (1.0.33 : 120, Cor de ralliement : 100 ; avant 25 et 20)
create or replace function public.gb_every(g bigint) returns int language sql stable security definer set search_path = public
as $$ select case when g_up(g, 'cor') > 0 then 100 else 120 end $$;
-- essais en réserve (E.gbossTok) ; une première fois : réserve pleine (1.0.33 : 12 au plus, 24 h)
create or replace function public.gb_tok(u uuid, g bigint) returns real language sql stable security definer set search_path = public
as $$ select least(12, coalesce(c.t, 12) + extract(epoch from (now() - coalesce(c.at, now()))) / (gb_every(g) * 60.0))::real
  from (select 1) x left join gboss_charge c on c.user_id = u $$;
create or replace function public.gb_pts(g bigint, wk int) returns bigint language sql stable security definer set search_path = public
as $$ select coalesce(sum(points), 0)::bigint from gboss_hits where guild_id = g and w = wk $$;
-- même coffre que E.gbossChest (step 25, 50, 75, 100 = phases 1 à 4) ; 1.0.33 : kamas ×4, n = ressources du boss (5 × la phase)
create or replace function public.gb_chest(step int, lvl int) returns jsonb language sql immutable
as $$ select jsonb_build_object('k', round((1000 + lvl * 250) * (step / 25) * 4), 'res', jsonb_build_object('Poussière de stasis', 15 * (step / 25)), 'n', 5 * (step / 25)) $$;
-- course entre guildes d'une semaine : phases tombées, puis points
create or replace function public.gb_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x.ph desc, x.pts desc), '[]'::jsonb) from (
  select g.id, g.name, g.ic, g.col, g.lvl, sum(h.points)::bigint pts, count(distinct h.user_id) who,
    (select count(*) from gboss_phase p where p.w = wk and p.guild_id = g.id)::int ph
  from gboss_hits h join guilds g on g.id = h.guild_id where h.w = wk group by g.id order by ph desc, pts desc limit lim) x $$;
-- XP de guilde gagnée hors combats (Percepteurs, boss)
create or replace function public.g_addxp(g bigint, x bigint) returns void language plpgsql security definer set search_path = public
as $$
declare gg guilds; nl int;
begin
  if x <= 0 then return; end if;
  update guilds set xp = xp + x where id = g returning * into gg;
  nl := g_lvl(gg.xp);
  if nl > gg.lvl then update guilds set lvl = nl where id = g; perform g_log(g, 'La guilde passe au niveau ' || nl || ' !'); end if;
end $$;

-- 1.0.30 : poche pleine en 12 h (10 h avec le Percepteur doré)
create or replace function public.pc_fillsec(g bigint) returns int language sql stable security definer set search_path = public
as $$ select case when g_up(g, 'percodore') > 0 then 36000 else 43200 end $$;
-- poche actuelle d'un Percepteur (1 = pleine ; une défense réussie contre les monstres peut la faire dépasser)
create or replace function public.pc_fill(p guild_percos) returns real language sql stable
as $$ select case when p.pk >= 1 then p.pk else least(1, p.pk + extract(epoch from (now() - p.pk_at)) / pc_fillsec(p.guild_id))::real end $$;
create or replace function public.pc_name(s text) returns text language sql stable security definer set search_path = public
as $$ select coalesce((select name from perco_zones where sid = s), s) $$;
create or replace function public.pc_kind(s text) returns text language sql stable security definer set search_path = public
as $$ select coalesce((select kind from perco_zones where sid = s), 'zone') $$;
-- prochaine attaque de monstres : environ une fois par jour (deux fois plus souvent en donjon)
create or replace function public.pc_next(s text) returns timestamptz language sql volatile security definer set search_path = public
as $$ select now() + case when pc_kind(s) = 'dj' then interval '9 hours' + random() * interval '6 hours' else interval '18 hours' + random() * interval '12 hours' end $$;
-- 1.0.30 : ce que donne une poche remplie à f (même calcul que E.percoGain) : Poche +10 % par rang,
-- Prospection +10 % par rang sur les ressources rares (moins de 50 dans une poche pleine)
create or replace function public.pc_gain(cap jsonb, fr double precision, ups jsonb) returns jsonb language plpgsql immutable
as $$
declare f numeric := round(fr::numeric, 6); p numeric := 1 + 0.1 * coalesce((ups->>'poche')::int, 0); pr numeric := 1 + 0.1 * coalesce((ups->>'prospection')::int, 0); res jsonb := '{}'::jsonb; r record; q bigint;
begin
  for r in select key, value::numeric v from jsonb_each_text(coalesce(cap->'res', '{}'::jsonb)) loop
    q := floor(r.v * f * p * case when r.v < 50 then pr else 1 end);
    if q >= 1 then res := res || jsonb_build_object(r.key, q); end if;
  end loop;
  return jsonb_build_object('k', floor(coalesce((cap->>'k')::numeric, 0) * f * p)::bigint, 'res', res);
end $$;
-- 1.0.30 : Prospection rang 5 : un équipement de la zone (jet tiré ici, dans les fourchettes de percos_data.sql)
create or replace function public.pc_item(cap jsonb) returns jsonb language plpgsql volatile
as $$
declare e jsonb; st jsonb := '{}'::jsonb; r record; a int; b int;
begin
  if jsonb_typeof(cap->'eq') <> 'array' or jsonb_array_length(cap->'eq') = 0 then return null; end if;
  e := cap->'eq'->(floor(random() * jsonb_array_length(cap->'eq'))::int);
  for r in select key, value from jsonb_each(coalesce(e->'s', '{}'::jsonb)) loop
    a := (r.value->>0)::int; b := (r.value->>1)::int;
    st := st || jsonb_build_object(r.key, a + floor(random() * (greatest(a, b) - a + 1))::int);
  end loop;
  return jsonb_build_object('tpl', e->>'tpl', 'stats', st);
end $$;
-- emplacements (E.percoSlots) : 1 dès la fondation, +1 tous les 5 niveaux (5 au plus), +1 avec le Quartier général ;
-- un Percepteur assommé occupe sa place 12 h
create or replace function public.pc_slots(g bigint) returns int language sql stable security definer set search_path = public
as $$ select least(5, 1 + (select lvl from guilds where id = g) / 5) + case when g_up(g, 'qg') > 0 then 1 else 0 end $$;
create or replace function public.pc_used(g bigint) returns int language sql stable security definer set search_path = public
as $$ select ((select count(*) from guild_percos where guild_id = g) + (select count(*) from perco_ko where guild_id = g and until > now()))::int $$;
-- une attaque entre guildes est en cours sur ce Percepteur
create or replace function public.pc_raided(pid bigint) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from perco_raids where perco_id = pid and status in ('open', 'fight')) $$;
-- Attaques de monstres : une nouvelle commence quand l'heure est passée ET qu'un membre regarde la guilde
-- (personne n'est pillé sans avoir pu le voir) ; sans victoire en 2 h, la moitié de la poche est perdue
-- (1.0.30 : 3 % de moins par rang de Robustesse). Pas d'attaque de monstres pendant une attaque de guilde.
create or replace function public.pc_tick(g bigint) returns void language plpgsql security definer set search_path = public
as $$
declare p guild_percos; keep numeric := least(0.8, 0.5 + 0.03 * g_up(g, 'robustesse'));
begin
  for p in select * from guild_percos where guild_id = g for update loop
    if p.atk_at is not null and now() > p.atk_at + interval '2 hours' then
      update guild_percos set pk = pc_fill(p) * keep, pk_at = now(), atk_at = null, atk_n = 0, atk_by = '{}', losses = losses + 1,
        next_atk = pc_next(p.sid) where id = p.id;
      perform g_log(g, format('Le Percepteur de %s a été pillé par les monstres : %s %% de sa poche est perdue.', pc_name(p.sid), round((1 - keep) * 100)));
    elsif p.atk_at is null and now() >= p.next_atk and not pc_raided(p.id) then
      update guild_percos set atk_at = now(), atk_n = 0, atk_by = '{}' where id = p.id;
      perform g_log(g, '⚔ Le Percepteur de ' || pc_name(p.sid) || ' est attaqué par des monstres ! 2 h pour le défendre (Guilde › Percepteurs).');
    end if;
  end loop;
end $$;
-- Guerre des Percepteurs : points de la semaine
create or replace function public.pw_add(g bigint, p_pts int, p_win int, p_loss int, p_def int) returns void language sql security definer set search_path = public
as $$ insert into perco_war (w, guild_id, pts, win, loss, def) values (gb_week(), g, p_pts, p_win, p_loss, p_def)
  on conflict (w, guild_id) do update set pts = perco_war.pts + excluded.pts, win = perco_war.win + excluded.win, loss = perco_war.loss + excluded.loss, def = perco_war.def + excluded.def $$;
create or replace function public.pw_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(x order by x.pts desc, x.win desc, x.id), '[]'::jsonb) from (
  select g.id, g.name, g.ic, g.col, g.lvl, w.pts, w.win, w.loss, w.def from perco_war w join guilds g on g.id = w.guild_id
  where w.w = wk and w.pts > 0 order by w.pts desc, w.win desc, g.id limit lim) x $$;
-- attaques par jour : 3 (4 avec la Bannière de guerre)
-- Chasse aux Percepteurs (10A) : Nuit des Percepteurs, chaque samedi de 20 h à 23 h (heure de Paris) : butin ×1,5, boucliers des
-- Percepteurs réduits de moitié, une attaque de plus pour chacun ; titre « Ombre de la nuit » (gb_claim_do).
create or replace function public.gb_nuit() returns boolean language sql stable
as $$ select extract(isodow from (now() at time zone 'Europe/Paris')) = 6 and extract(hour from (now() at time zone 'Europe/Paris')) between 20 and 22 $$;
-- fin du bouclier d'un Percepteur (moitié moins long la nuit)
create or replace function public.pc_shield(p guild_percos) returns timestamptz language sql stable
as $$ select case when p.shield_until is null then null when gb_nuit() then p.shield_until - interval '3 hours' else p.shield_until end $$;
-- attaques par jour : 3 (4 avec la Bannière de guerre), +1 pendant la Nuit des Percepteurs
create or replace function public.rd_max(g bigint) returns int language sql stable security definer set search_path = public
as $$ select case when g_up(g, 'banniere') > 0 then 4 else 3 end + case when gb_nuit() then 1 else 0 end $$;
-- Chasse aux Percepteurs : les revanches (free) ne comptent pas
create or replace function public.rd_today(u uuid) returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from perco_raids where att_user = u and not free and at > now() - interval '30 hours' and (at at time zone 'Europe/Paris')::date = gb_day() $$;
-- Chasse aux Percepteurs (6A) : revanche encore possible pour ce joueur contre la guilde dg (la plus récente, pas encore utilisée)
create or replace function public.rd_revenge(u uuid, g bigint, dg bigint) returns perco_revenge language sql stable security definer set search_path = public
as $$ select v.* from perco_revenge v where v.guild_id = g and v.target = dg and v.until > now()
  and not exists (select 1 from perco_raids r where r.att_user = u and r.free and r.def_guild = dg and r.at >= v.at) order by v.until desc limit 1 $$;
-- Chasse aux Percepteurs (7A) : primes finies (3 jours passés, ou Percepteur parti sans pillage) : retour au coffre
create or replace function public.pb_expire() returns void language plpgsql security definer set search_path = public
as $$
declare b perco_bounty;
begin
  for b in select * from perco_bounty x where x.done is null and (x.until < now() or not exists (select 1 from guild_percos p where p.id = x.perco_id)) for update skip locked loop
    update perco_bounty set done = 'back' where id = b.id;
    perform g_chest(b.by_guild, b.k, format('Prime sur le Percepteur de %s : personne ne l''a pillé, elle revient au coffre', pc_name(b.sid)));
  end loop;
end $$;
-- une attaque vue par les deux guildes
create or replace function public.rd_json(r perco_raids, me uuid) returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('id', r.id, 'pid', r.perco_id, 'sid', r.sid, 'zone', pc_name(r.sid), 'st', r.status, 'at', r.at, 'ends', r.ends, 'res', r.res,
  'by', pseudo_of(r.att_user), 'me', r.att_user = me, 'heads', r.att_heads, 'lvl', r.att_lvl,
  'ag', (select jsonb_build_object('id', id, 'name', name, 'ic', ic, 'col', col, 'lvl', lvl) from guilds where id = r.att_guild),
  'dg', (select jsonb_build_object('id', id, 'name', name, 'ic', ic, 'col', col, 'lvl', lvl) from guilds where id = r.def_guild),
  'tries', (select coalesce(jsonb_agg(jsonb_build_object('p', t->>'p', 'win', (t->>'win')::boolean, 'at', t->>'at', 'heads', t->'heads')), '[]'::jsonb) from jsonb_array_elements(r.tries) t),
  'tried', exists (select 1 from jsonb_array_elements(r.tries) t where t->>'u' = me::text)) $$;

-- Coffres et titres du boss et de la Guerre des Percepteurs (semaine en cours et semaine passée).
-- dry : seulement compter (pour afficher « à ouvrir »). Renvoie { n, k, dust, titles }.
create or replace function public.gb_claim_do(me uuid, dry boolean) returns jsonb language plpgsql security definer set search_path = public
as $$
declare wk int := gb_week(); x int; gid bigint; lv int; p int; k numeric := 0; dust int := 0; n int := 0; titles text[] := '{}'; c jsonb; m guild_members := g_me(me); top jsonb; w0 date; n0 date; wn int;
  res jsonb := '{}'::jsonb; items jsonb := '[]'::jsonb; gg gboss_goal; it jsonb; tries int;
begin
  foreach x in array array[wk - 1, wk] loop
    gid := null;
    select guild_id, max(lvl), count(*) into gid, lv, tries from gboss_hits where user_id = me and w = x group by guild_id order by max(id) desc limit 1;
    if gid is null then continue; end if;
    select * into gg from gboss_goal where w = x and guild_id = gid;
    -- 1.0.33 (5A) : coffres pour les membres qui ont fait au moins 3 essais dans la semaine (ils restent à ouvrir tant que la semaine suivante dure)
    if tries >= 3 then
    for p in select phase from gboss_phase where w = x and guild_id = gid order by phase loop
      if not exists (select 1 from gboss_claims where user_id = me and w = x and step = 1000 + p) then
        if not dry then insert into gboss_claims (user_id, w, step) values (me, x, 1000 + p); end if;
        if p <= 4 then
          c := gb_chest(25 * p, lv); k := k + (c->>'k')::numeric; dust := dust + (c->'res'->>'Poussière de stasis')::int; n := n + 1;
          if gg.res is not null then res := jsonb_set(res, array[gg.res], to_jsonb(coalesce((res->>gg.res)::int, 0) + (c->>'n')::int)); end if;
        elsif p = 5 then
          n := n + 1; it := pc_item(jsonb_build_object('eq', coalesce(gg.eq, '[]'::jsonb))); if it is not null then items := items || jsonb_build_array(it); end if;
        else
          dust := dust + 30; n := n + 1;
        end if;
      end if;
    end loop;
    end if;
    if exists (select 1 from guild_trophies t where t.guild_id = gid and t.w = x and t.first)
       and not exists (select 1 from gboss_claims where user_id = me and w = x and step = 1100) then
      if not dry then insert into gboss_claims (user_id, w, step) values (me, x, 1100); end if;
      titles := titles || 'Avant-garde de guilde'::text;
    end if;
    if x = wk - 1 and not exists (select 1 from gboss_claims where user_id = me and w = x and step = 0)
       and exists (select 1 from jsonb_array_elements(gb_top(x, 3)) e where (e->>'id')::bigint = gid and (e->>'ph')::int > 0) then
      if not dry then insert into gboss_claims (user_id, w, step) values (me, x, 0); end if;
      titles := titles || 'Pourfendeur de boss'::text;
    end if;
  end loop;
  -- « Conquérant » : membres (déjà là la semaine passée) de la 1re guilde de la Guerre des Percepteurs de la semaine passée
  if m.user_id is not null and not exists (select 1 from gboss_claims where user_id = me and w = wk - 1 and step = 1200) then
    top := pw_top(wk - 1, 1); w0 := date '1970-01-01' + (wk * 7 - 3);
    if jsonb_array_length(top) > 0 and (top->0->>'id')::bigint = m.guild_id and (m.joined_at at time zone 'Europe/Paris')::date < w0 then
      if not dry then insert into gboss_claims (user_id, w, step) values (me, wk - 1, 1200); end if;
      titles := titles || 'Conquérant'::text;
    end if;
  end if;
  -- Chasse aux Percepteurs (10A) « Ombre de la nuit » : membres (déjà là ce soir-là) de la guilde qui a pillé le plus de Percepteurs
  -- pendant la dernière Nuit des Percepteurs ; donné à partir du dimanche 3 h (les dernières attaques sont finies)
  if m.user_id is not null then
    n0 := (now() at time zone 'Europe/Paris' - interval '27 hours')::date; n0 := n0 - ((extract(isodow from n0)::int + 1) % 7);
    wn := ((n0 - date '1970-01-01') + 3) / 7;
    if not exists (select 1 from gboss_claims where user_id = me and w = wn and step = 1300)
       and m.joined_at < ((n0 + time '20:00') at time zone 'Europe/Paris')
       and (select r.att_guild from perco_raids r where r.night and r.status = 'won' and (r.at at time zone 'Europe/Paris')::date = n0
            group by r.att_guild order by count(*) desc, max(r.done_at) limit 1) = m.guild_id then
      if not dry then insert into gboss_claims (user_id, w, step) values (me, wn, 1300); end if;
      titles := titles || 'Ombre de la nuit'::text;
    end if;
  end if;
  return jsonb_build_object('n', n, 'k', k, 'dust', dust, 'res', res, 'items', items, 'titles', to_jsonb(titles));
end $$;

do $$ declare f text; begin
  foreach f in array array['gb_goal(bigint)', 'gb_active(bigint)', 'gb_goalw(bigint, int)', 'gb_pts(bigint, int)', 'gb_top(int, int)', 'g_addxp(bigint, bigint)', 'pc_tick(bigint)', 'pc_name(text)',
    'gb_every(bigint)', 'gb_tok(uuid, bigint)', 'pc_fillsec(bigint)', 'pc_kind(text)', 'pc_next(text)', 'pc_slots(bigint)', 'pc_used(bigint)', 'pc_raided(bigint)', 'pc_item(jsonb)',
    'pw_add(bigint, int, int, int, int)', 'pw_top(int, int)', 'rd_max(bigint)', 'rd_today(uuid)', 'rd_revenge(uuid, bigint, bigint)', 'pb_expire()', 'rd_json(perco_raids, uuid)', 'gb_claim_do(uuid, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture : boss, Percepteurs et attaques de ma guilde ----------
create or replace function public.guild_extra() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; wk int := gb_week(); bp bigint; goal int; mylvl int; tok real; ev int; cl jsonb;
begin
  m := g_me(me); if m.user_id is null then return jsonb_build_object('none', true); end if;
  perform pc_tick(m.guild_id);
  delete from perco_ko where until < now() - interval '1 day';
  delete from perco_hold where until < now() - interval '1 day';
  delete from perco_revenge where until < now() - interval '1 day';
  select * into g from guilds where id = m.guild_id;
  bp := gb_pts(g.id, wk); goal := gb_goal(g.id); ev := gb_every(g.id); tok := gb_tok(me, g.id);
  select max(lvl) into mylvl from gboss_hits where user_id = me and w = wk;
  cl := gb_claim_do(me, true);
  return jsonb_build_object(
    'boss', jsonb_build_object('w', wk, 'pts', bp, 'goal', goal, 'lvl', mylvl,
      'done', (select count(*) from gboss_phase where w = wk and guild_id = g.id),
      'tok', tok, 'every', ev, 'next', case when tok >= 12 then 0 else ceil((1 - (tok - floor(tok))) * ev * 60) end,
      'mine', (select coalesce(sum(points), 0) from gboss_hits where user_id = me and w = wk),
      'tries', (select count(*) from gboss_hits where user_id = me and w = wk),
      'active', gb_active(g.id), 'members', g_count(g.id), 'res', (select res from gboss_goal where w = wk and guild_id = g.id),
      'today', (select count(*) from gboss_hits where user_id = me and day = gb_day()),
      'hitters', (select coalesce(jsonb_agg(x order by x.pts desc), '[]'::jsonb) from (
        select pseudo_of(user_id) p, sum(points)::bigint pts, count(*) n, max(points) best from gboss_hits where guild_id = g.id and w = wk group by user_id) x),
      'top', gb_top(wk, 10), 'last', gb_top(wk - 1, 3),
      'trophies', (select coalesce(jsonb_agg(jsonb_build_object('w', t.w, 'first', t.first, 'at', t.at) order by t.w desc), '[]'::jsonb) from guild_trophies t where t.guild_id = g.id),
      'claim', (cl->>'n')::int > 0 or jsonb_array_length(cl->'titles') > 0),
    'percos', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'sid', p.sid, 'name', z.name, 'zlvl', z.lvl, 'dj', z.kind = 'dj', 'cap', z.cap, 'fill', pc_fill(p),
        'by', pseudo_of(p.by_user), 'placed', p.placed_at, 'wins', p.wins, 'losses', p.losses, 'next', p.next_atk,
        'shield', case when pc_shield(p) > now() then pc_shield(p) end, 'raided', pc_raided(p.id), 'stars', p.stars,
        'atk', case when p.atk_at is null then null else jsonb_build_object('at', p.atk_at, 'ends', p.atk_at + interval '2 hours', 'n', p.atk_n,
          'by', (select coalesce(jsonb_agg(pseudo_of(u)), '[]'::jsonb) from unnest(p.atk_by) u), 'done', me = any(p.atk_by)) end) order by p.placed_at), '[]'::jsonb)
      from guild_percos p left join perco_zones z on z.sid = p.sid where p.guild_id = g.id),
    'slots', pc_slots(g.id), 'ko', (select coalesce(jsonb_agg(jsonb_build_object('sid', sid, 'name', pc_name(sid), 'until', until) order by until), '[]'::jsonb) from perco_ko where guild_id = g.id and until > now()),
    -- attaques entre guildes : contre nous, et par nous (en cours ou finies depuis moins de 24 h)
    'raids_in', (select coalesce(jsonb_agg(rd_json(r, me) order by r.id desc), '[]'::jsonb) from perco_raids r where r.def_guild = g.id and (r.status in ('open', 'fight') or r.done_at > now() - interval '24 hours')),
    'raids_out', (select coalesce(jsonb_agg(rd_json(r, me) order by r.id desc), '[]'::jsonb) from perco_raids r where r.att_guild = g.id and (r.status in ('open', 'fight') or r.done_at > now() - interval '24 hours')),
    'left', greatest(0, rd_max(g.id) - rd_today(me)), 'max', rd_max(g.id),
    'war', jsonb_build_object('me', (select jsonb_build_object('pts', w.pts, 'win', w.win, 'loss', w.loss, 'def', w.def) from perco_war w where w.w = wk and w.guild_id = g.id),
      'rank', (select count(*) + 1 from perco_war w2 where w2.w = wk and w2.pts > coalesce((select pts from perco_war w3 where w3.w = wk and w3.guild_id = g.id), 0)),
      'top', pw_top(wk, 10), 'last', pw_top(wk - 1, 1)),
    -- zones prises sur le serveur (8A) et zones gardées une heure après une attaque gagnée
    'taken', (select coalesce(jsonb_object_agg(p.sid, jsonb_build_object('pid', p.id, 'gid', p.guild_id, 'g', gg.name, 'lvl', gg.lvl, 'rob', coalesce((gg.ups->>'robustesse')::int, 0))), '{}'::jsonb)
      from guild_percos p join guilds gg on gg.id = p.guild_id where p.guild_id <> g.id),
    'holds', (select coalesce(jsonb_object_agg(h.sid, jsonb_build_object('gid', h.guild_id, 'g', gg.name, 'until', h.until)), '{}'::jsonb)
      from perco_hold h join guilds gg on gg.id = h.guild_id where h.until > now()),
    -- Chasse aux Percepteurs : revanches en cours (6A), Nuit des Percepteurs (10A)
    'revenge', (select coalesce(jsonb_agg(jsonb_build_object('gid', v.target, 'name', gg.name, 'ic', gg.ic, 'col', gg.col, 'zone', pc_name(v.sid), 'at', v.at, 'until', v.until,
        'used', exists (select 1 from perco_raids r where r.att_user = me and r.free and r.def_guild = v.target and r.at >= v.at)) order by v.until desc), '[]'::jsonb)
      from perco_revenge v join guilds gg on gg.id = v.target where v.guild_id = g.id and v.until > now()),
    'nuit', gb_nuit(),
    'glvl', g.lvl, 'rank', m.rank, 'ups', g.ups, 'now', now());
end $$;

-- ---------- boss : ouvrir les coffres (semaine en cours et semaine passée) et recevoir les titres ----------
create or replace function public.gboss_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); c jsonb; n int; k numeric; dust int; t text;
begin
  if me is null then return g_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  c := gb_claim_do(me, false); n := (c->>'n')::int; k := (c->>'k')::numeric; dust := (c->>'dust')::int;
  -- 1.0.33 : ressources du boss et équipement du Coffre du trophée dans la même ligne
  if n > 0 then perform hdv_op(me, jsonb_build_object('k', k, 'res', jsonb_build_object('Poussière de stasis', dust) || coalesce(c->'res', '{}'::jsonb))
      || case when jsonb_array_length(coalesce(c->'items', '[]'::jsonb)) > 0 then jsonb_build_object('add', c->'items') else '{}'::jsonb end,
    format('Boss de guilde : %s coffre%s ouvert%s (%s kamas, %s Poussières de stasis%s%s)', n, case when n > 1 then 's' else '' end, case when n > 1 then 's' else '' end, g_fmt(k::bigint), dust,
      (select coalesce(string_agg(format(', %s %s', value, key), ''), '') from jsonb_each_text(coalesce(c->'res', '{}'::jsonb))),
      case when jsonb_array_length(coalesce(c->'items', '[]'::jsonb)) > 0 then ', un équipement' else '' end)); end if;
  for t in select jsonb_array_elements_text(c->'titles') loop
    perform hdv_op(me, jsonb_build_object('title', t), case t
      when 'Conquérant' then 'Guerre des Percepteurs : ta guilde a gagné la semaine, titre « Conquérant » !'
      when 'Ombre de la nuit' then 'Nuit des Percepteurs : ta guilde a pillé le plus de Percepteurs, titre « Ombre de la nuit » !'
      when 'Avant-garde de guilde' then 'Boss de guilde : ta guilde est la première du serveur à le finir, titre « Avant-garde de guilde » !'
      else 'Boss de guilde : ta guilde finit dans les 3 meilleures de la semaine, titre « Pourfendeur de boss » !' end);
  end loop;
  return jsonb_build_object('ok', n, 'k', k, 'dust', dust, 'res', c->'res', 'items', c->'items', 'titles', c->'titles', 'ops', hdv_ops_after(me, p_after));
end $$;

-- ---------- Percepteurs ----------
-- 1.0.30 : zone finie ou donjon fait en stasis 1 ou plus ; un seul par zone sur tout le serveur ;
-- une zone gagnée par une attaque est gardée 1 h pour la guilde gagnante (et son Percepteur a 6 h de bouclier).
create or replace function public.perco_place(p_after bigint, p_sid text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; g guilds; d jsonb; z perco_zones; slots int; o record; hd perco_hold; sh timestamptz;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits posent les Percepteurs.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return g_err(replace(sqlerrm, 'vendre ni acheter', 'poser de Percepteur')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  perform pg_advisory_xact_lock(hashtext('perco:' || coalesce(p_sid, '')));
  select * into g from guilds where id = m.guild_id;
  select * into z from perco_zones where sid = p_sid; if not found then return g_err('Zone inconnue.'); end if;
  slots := pc_slots(g.id);
  if pc_used(g.id) >= slots then return g_err(format('Ta guilde a déjà %s Percepteur%s (un de plus tous les 5 niveaux de guilde, 5 au plus ; un Percepteur assommé garde sa place 12 h).', slots, case when slots > 1 then 's' else '' end)); end if;
  if z.kind = 'dj' then
    if coalesce((d->'stasis'->p_sid->>'max')::int, 0) < 1 then return g_err('Il faut avoir fait ce donjon au moins en stasis 1.'); end if;
  elsif coalesce(d->'trophies'->>p_sid, '') = '' then return g_err('Il faut avoir fini cette zone (tous ses monstres au palier Traqueur).'); end if;
  select p.id, p.guild_id, gg.name into o from guild_percos p join guilds gg on gg.id = p.guild_id where p.sid = p_sid limit 1;
  if o.id is not null then
    if o.guild_id = g.id then return g_err('Ta guilde a déjà un Percepteur ici.'); end if;
    return jsonb_build_object('err', format('Place prise par %s : une zone = un seul Percepteur sur tout le serveur. Bats son Percepteur pour prendre la place.', o.name), 'taken', jsonb_build_object('pid', o.id, 'gid', o.guild_id, 'g', o.name));
  end if;
  select * into hd from perco_hold where sid = p_sid and until > now();
  if found and hd.guild_id <> g.id then return g_err(format('Cette zone est gardée par %s encore %s min (ils viennent de la gagner).', (select name from guilds where id = hd.guild_id), ceil(extract(epoch from (hd.until - now())) / 60))); end if;
  if found then sh := now() + interval '6 hours'; delete from perco_hold where sid = p_sid; end if;
  if hdv_kamas(me, d) < 20000 then return g_err('Un Percepteur coûte 20 000 kamas.'); end if;
  insert into guild_percos (guild_id, sid, by_user, next_atk, shield_until) values (g.id, p_sid, me, pc_next(p_sid), sh);
  perform hdv_op(me, jsonb_build_object('k', -20000), 'Percepteur posé : ' || z.name);
  perform g_log(g.id, pseudo_of(me) || ' pose un Percepteur à ' || z.name || case when sh is not null then ' (6 h de bouclier).' else '.' end);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Récolter : kamas au coffre de guilde, ressources (et un équipement avec la Prospection rang 5) pour celui qui récolte,
-- XP de guilde (+20 % par rang de Sagesse) et, avec la Sagesse, de l'XP pour son équipe (txp, donné par le jeu : E.percoTeamXp).
create or replace function public.perco_collect(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; p guild_percos; z perco_zones; f real; gain jsonb; it jsonb; pay jsonb; k bigint; g guilds; gx bigint; sg int; txp numeric;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if not exists (select 1 from profiles where id = me) then return g_err('Crée ton compte pour récolter.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  perform pc_tick(m.guild_id);
  select * into p from guild_percos where id = p_id and guild_id = m.guild_id; if not found then return g_err('Ce Percepteur n''existe plus.'); end if;
  if p.atk_at is not null then return g_err('Il est attaqué : défends-le d''abord !'); end if;
  if pc_raided(p.id) then return g_err('Une guilde l''attaque : pas de récolte avant la fin de l''attaque.'); end if;
  f := pc_fill(p); if f < 0.05 then return g_err('La poche est presque vide : reviens plus tard.'); end if;
  select * into z from perco_zones where sid = p.sid;
  select * into g from guilds where id = m.guild_id;
  gain := pc_gain(z.cap, f, g.ups); k := (gain->>'k')::bigint;
  pay := jsonb_build_object('res', gain->'res');
  if coalesce((g.ups->>'prospection')::int, 0) >= 5 and f >= 1 then
    it := pc_item(z.cap); if it is not null then pay := pay || jsonb_build_object('add', jsonb_build_array(it)); end if;
  end if;
  update guild_percos set pk = 0, pk_at = now() where id = p.id;
  perform hdv_op(me, pay, format('Percepteur de %s récolté : ses ressources%s', z.name, case when it is not null then ' et un équipement' else '' end));
  perform g_chest(g.id, k, format('Percepteur de %s récolté par %s', z.name, pseudo_of(me)));
  sg := coalesce((g.ups->>'sagesse')::int, 0);
  gx := round(g_need(g.lvl) * 0.01 * least(f, 2) * (1 + 0.2 * sg));
  perform g_addxp(g.id, gx);
  txp := round(0.01 * sg * least(f, 1)::numeric, 4);
  perform g_log(g.id, format('%s récolte le Percepteur de %s (%s kamas au coffre, +%s XP de guilde).', pseudo_of(me), z.name, g_fmt(k), g_fmt(gx)), false);
  return jsonb_build_object('ok', true, 'k', k, 'res', gain->'res', 'item', it, 'gxp', gx, 'txp', txp, 'zl', z.lvl, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.perco_remove(p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; p guild_percos;
begin
  m := g_me(me); if m.user_id is null or m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits retirent les Percepteurs.'); end if;
  select * into p from guild_percos where id = p_id and guild_id = m.guild_id; if not found then return g_err('Ce Percepteur n''existe plus.'); end if;
  if p.atk_at is not null or pc_raided(p.id) then return g_err('On ne retire pas un Percepteur attaqué.'); end if;
  delete from guild_percos where id = p.id;
  perform g_log(m.guild_id, pseudo_of(me) || ' retire le Percepteur de ' || pc_name(p.sid) || '.');
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Chasse aux Percepteurs (choix 1C, 2C et 6A à 10A de Mathis) ----------
-- Tous les Percepteurs du serveur, pour l'onglet « Chasse aux Percepteurs » et la carte du Monde (emblèmes, domination
-- des régions calculée par le jeu). Le jeu le relit au plus une fois par minute. Rend aussi les primes finies.
create or replace function public.perco_map() returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members;
begin
  if me is null then return g_err('non connecté'); end if;
  m := g_me(me);
  perform pb_expire();
  return jsonb_build_object('now', now(), 'nuit', gb_nuit(), 'me', m.guild_id,
    'percos', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'sid', p.sid, 'gid', p.guild_id, 'zlvl', z.lvl, 'dj', z.kind = 'dj', 'fill', least(1, pc_fill(p)), 'stars', p.stars,
        'shield', case when pc_shield(p) > now() then pc_shield(p) end, 'monsters', p.atk_at is not null,
        'raid', (select gg.name from perco_raids r join guilds gg on gg.id = r.att_guild where r.perco_id = p.id and r.status in ('open', 'fight') order by r.id desc limit 1),
        'bounty', (select jsonb_agg(jsonb_build_object('k', b.k, 'gid', b.by_guild, 'by', bg.name, 'until', b.until) order by b.k desc)
          from perco_bounty b join guilds bg on bg.id = b.by_guild where b.perco_id = p.id and b.done is null)) order by p.id), '[]'::jsonb)
      from guild_percos p left join perco_zones z on z.sid = p.sid),
    'guilds', (select coalesce(jsonb_object_agg(g.id, jsonb_build_object('name', g.name, 'ic', g.ic, 'col', g.col, 'lvl', g.lvl, 'rob', coalesce((g.ups->>'robustesse')::int, 0),
        'young', case when g.shield_until > now() then g.shield_until end)), '{}'::jsonb)
      from guilds g where exists (select 1 from guild_percos p where p.guild_id = g.id)));
end $$;
-- Prime (7A) : le Meneur ou un Bras droit met une prime sur un Percepteur ennemi, payée par le coffre (50 000 à 2 000 000 kamas,
-- une par guilde et par Percepteur). Celui qui le pille la touche ; sans pillage en 3 jours, elle revient au coffre (pb_expire).
create or replace function public.guild_bounty(p_perco bigint, p_k bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); m guild_members; p guild_percos; g guilds; dg guilds; z text;
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  if m.rank > 1 then return g_err('Seuls le Meneur et les Bras droits mettent une prime (payée par le coffre).'); end if;
  if p_k is null or p_k < 50000 or p_k > 2000000 then return g_err('Une prime va de 50 000 à 2 000 000 kamas.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || m.guild_id));
  perform pg_advisory_xact_lock(hashtext('raid:' || p_perco));
  select * into p from guild_percos where id = p_perco; if not found then return g_err('Ce Percepteur n''est plus là.'); end if;
  if p.guild_id = m.guild_id then return g_err('C''est un Percepteur de ta guilde.'); end if;
  if exists (select 1 from perco_bounty where perco_id = p.id and by_guild = m.guild_id and done is null) then return g_err('Ta guilde a déjà une prime sur ce Percepteur.'); end if;
  select * into g from guilds where id = m.guild_id; select * into dg from guilds where id = p.guild_id;
  if g.chest < p_k then return g_err(format('Il n''y a que %s kamas dans le coffre.', g_fmt(g.chest))); end if;
  z := pc_name(p.sid);
  perform g_chest(g.id, -p_k, format('Prime sur le Percepteur de %s (%s) mise par %s', z, dg.name, pseudo_of(me)));
  insert into perco_bounty (perco_id, sid, def_guild, by_guild, by_user, k, until) values (p.id, p.sid, dg.id, g.id, me, p_k, now() + interval '3 days');
  perform g_log(g.id, format('💰 %s met une prime de %s kamas sur le Percepteur de %s (%s) : celui qui le pille dans les 3 jours la touche.', pseudo_of(me), g_fmt(p_k), z, dg.name));
  perform g_log(dg.id, format('💰 La guilde %s met une prime de %s kamas sur votre Percepteur de %s !', g.name, g_fmt(p_k), z));
  return jsonb_build_object('ok', true, 'chest', g.chest - p_k);
end $$;

do $$ declare f text; begin
  foreach f in array array['guild_extra()', 'gboss_claim(bigint)', 'perco_place(bigint, text)', 'perco_collect(bigint, bigint)', 'perco_remove(bigint)', 'perco_map()', 'guild_bounty(bigint, bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- appelées par la fonction serveur « record » (clé de service) ----------
-- Boss : vérifie la réserve d'essais et donne le numéro de l'essai dans la semaine et la phase en cours.
create or replace function public.gb_start(p_user uuid, p_w int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); tok real; done int;
begin
  if m.user_id is null then return g_err('Rejoins une guilde pour affronter le boss.'); end if;
  if p_w <> gb_week() then return g_err('Nouvelle semaine : réessaie.'); end if;
  tok := gb_tok(p_user, m.guild_id);
  if tok < 1 then return g_err(format('Prochain essai dans %s min.', ceil((1 - tok) * gb_every(m.guild_id)))); end if;
  -- 1.0.33 (3A) : après la phase 5, les phases Ultimes continuent jusqu'à lundi (phase d'après les points, comme E.gbossPhase)
  done := gb_nph(gb_pts(m.guild_id, p_w), gb_goalw(m.guild_id, p_w));
  return jsonb_build_object('ok', true, 'n', (select count(*) from gboss_hits where user_id = p_user and w = p_w), 'gid', m.guild_id, 'phase', done + 1);
end $$;
-- Boss : enregistre l'essai rejoué, retire un essai de la réserve ; phases tombées : kamas au coffre, XP de guilde, trophée.
-- 1.0.33 : p_res / p_eq = ressource du boss et équipements de son donjon (js/gboss.js E.gbossRes, E.gbossEq), gardés avec la vie ;
-- phases Ultimes (6 et plus) sans kamas ni XP ; chaque phase atteinte et pas encore notée est notée (la vie a pu baisser à la mise à jour).
drop function if exists public.gb_done(uuid, int, int, int, int, int, int, int);
create or replace function public.gb_done(p_user uuid, p_w int, p_n int, p_points int, p_raw int, p_lvl int, p_rounds int, p_alive int, p_res text default null, p_eq jsonb default null) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); before bigint; after bigint; goal int; tok real; d1 int; p int; g guilds; gx bigint; fst boolean;
begin
  if m.user_id is null then return g_err('Rejoins une guilde pour affronter le boss.'); end if;
  perform pg_advisory_xact_lock(hashtext('gboss' || m.guild_id));
  perform pg_advisory_xact_lock(hashtext('gbtok' || p_user::text));
  tok := gb_tok(p_user, m.guild_id);
  if tok < 1 then return g_err('Plus d''essai en réserve : patiente un peu.'); end if;
  insert into gboss_goal (w, guild_id, goal, res, eq) values (p_w, m.guild_id, 15000 * greatest(3, gb_active(m.guild_id)), p_res, p_eq)
    on conflict (w, guild_id) do update set res = coalesce(gboss_goal.res, excluded.res), eq = coalesce(gboss_goal.eq, excluded.eq);
  goal := gb_goalw(m.guild_id, p_w);
  before := gb_pts(m.guild_id, p_w);
  begin
    insert into gboss_hits (w, guild_id, user_id, n, day, points, raw, lvl, rounds, alive) values (p_w, m.guild_id, p_user, p_n, gb_day(), greatest(0, p_points), greatest(0, p_raw), p_lvl, p_rounds, p_alive);
  exception when unique_violation then return g_err('Essai déjà compté.'); end;
  insert into gboss_charge (user_id, t, at) values (p_user, tok - 1, now()) on conflict (user_id) do update set t = excluded.t, at = excluded.at;
  after := before + greatest(0, p_points);
  d1 := gb_nph(after, goal);
  perform g_log(m.guild_id, format('%s inflige %s points au boss de la semaine.', pseudo_of(p_user), p_points), false);
  select * into g from guilds where id = m.guild_id;
  for p in 1 .. d1 loop
    insert into gboss_phase (w, guild_id, phase) values (p_w, m.guild_id, p) on conflict do nothing;
    if not found then continue; end if;
    if p > 5 then
      perform g_log(m.guild_id, format('Boss de la semaine : phase Ultime %s tombée ! 30 Poussières de stasis pour chaque membre qui a fait 3 essais.', p - 5));
      continue;
    end if;
    perform g_chest(m.guild_id, gb_phase_k(p), format('Boss de la semaine : phase %s tombée', p));
    gx := round(g_need(g.lvl) * 0.02 * p);
    perform g_addxp(m.guild_id, gx);
    if p < 5 then
      perform g_log(m.guild_id, format('Boss de la semaine : phase %s tombée ! +%s kamas au coffre, +%s XP de guilde, et un coffre pour chaque membre qui a fait 3 essais.', p, g_fmt(gb_phase_k(p)), g_fmt(gx)));
    else
      perform pg_advisory_xact_lock(hashtext('gbfirst' || p_w));
      fst := not exists (select 1 from guild_trophies where w = p_w and first);
      insert into guild_trophies (guild_id, w, first) values (m.guild_id, p_w, fst) on conflict do nothing;
      perform g_log(m.guild_id, format('🏆 Boss de la semaine vaincu ! +%s kamas au coffre, +%s XP de guilde, son trophée et le Coffre du trophée. Il se relève : phases Ultimes jusqu''à lundi.%s', g_fmt(gb_phase_k(p)), g_fmt(gx),
        case when fst then ' Première guilde du serveur à le finir : titre « Avant-garde de guilde » pour ceux qui ont frappé !' else '' end));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'pts', after, 'goal', goal, 'done', d1, 'tok', tok - 1, 'every', gb_every(m.guild_id), 'n', p_n);
end $$;
-- Percepteur (monstres) : vérifie que l'attaque est en cours et que ce joueur n'a pas encore tenté.
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
    next_atk = pc_next(p.sid) where id = p.id;
  select * into g from guilds where id = m.guild_id;
  gx := round(g_need(g.lvl) * 0.02);
  perform g_addxp(g.id, gx);
  perform hdv_op(p_user, jsonb_build_object('k', 300 * z.lvl, 'res', jsonb_build_object('Poussière de stasis', 10)), format('Défense du Percepteur de %s : coffre de %s kamas et 10 Poussières de stasis', z.name, 300 * z.lvl));
  perform g_log(m.guild_id, format('🛡 %s défend le Percepteur de %s ! Poche +25 %%, +%s XP de guilde.', pseudo_of(p_user), z.name, gx));
  return jsonb_build_object('ok', true, 'win', true, 'gxp', gx);
end $$;

-- ---------- 1.0.30 : attaques entre guildes (choix 9B, 10A, 11A et 19A) ----------
-- Lancer : p_team = équipe d'arène de l'attaquant, copiée par le serveur depuis sa partie en ligne.
create or replace function public.rd_open(p_user uuid, p_perco bigint, p_team jsonb, p_heads jsonb, p_lvl int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); p guild_percos; dg guilds; ag guilds; ends timestamptz; rid bigint; z text; sh timestamptz; rv perco_revenge; fr boolean := false; nt boolean := gb_nuit(); bn real := 1;
begin
  if m.user_id is null then return g_err('Rejoins une guilde pour attaquer un Percepteur.'); end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) < 1 then return g_err('Choisis ton équipe d''arène (Kolizéum).'); end if;
  perform pg_advisory_xact_lock(hashtext('raid:' || p_perco));
  select * into p from guild_percos where id = p_perco for update; if not found then return g_err('Ce Percepteur n''est plus là.'); end if;
  if p.guild_id = m.guild_id then return g_err('C''est un Percepteur de ta guilde.'); end if;
  if to_regprocedure('public.al_allied(bigint, bigint)') is not null then -- Alliances (9A) : les alliés ne s'attaquent pas (supabase/alliances.sql)
    if al_allied(p.guild_id, m.guild_id) then return g_err('C''est un Percepteur d''une guilde de ton alliance.'); end if;
  end if;
  select * into dg from guilds where id = p.guild_id; select * into ag from guilds where id = m.guild_id;
  if dg.shield_until > now() then return g_err(format('Jeune guilde protégée encore %s min.', ceil(extract(epoch from (dg.shield_until - now())) / 60))); end if;
  sh := pc_shield(p); -- Chasse aux Percepteurs : moitié moins long pendant la Nuit des Percepteurs
  if sh > now() then return g_err(format('Ce Percepteur a un bouclier encore %s.', case when sh - now() >= interval '1 hour' then floor(extract(epoch from (sh - now())) / 3600) || ' h' else ceil(extract(epoch from (sh - now())) / 60) || ' min' end)); end if;
  if p.atk_at is not null then return g_err('Des monstres l''attaquent déjà : reviens plus tard.'); end if;
  if pc_raided(p.id) then return g_err('Une autre attaque est déjà en cours sur ce Percepteur.'); end if;
  perform pg_advisory_xact_lock(hashtext('raidu:' || p_user::text));
  -- Chasse aux Percepteurs (6A) : revanche contre la guilde qui nous a pillés, une par membre, hors attaques du jour, butin +25 %
  rv := rd_revenge(p_user, m.guild_id, dg.id); fr := rv.id is not null;
  if not fr and rd_today(p_user) >= rd_max(m.guild_id) then return g_err(format('Plus d''attaque aujourd''hui (%s par jour) : reviens demain.', rd_max(m.guild_id))); end if;
  bn := case when fr then 1.25 else 1 end * case when nt then 1.5 else 1 end;
  ends := now() + case when g_up(dg.id, 'vigie') > 0 then interval '3 hours' else interval '2 hours' end;
  insert into perco_raids (perco_id, sid, def_guild, att_guild, att_user, att_team, att_heads, att_lvl, ends, free, bonus, night)
    values (p.id, p.sid, dg.id, ag.id, p_user, p_team, coalesce(p_heads, '[]'::jsonb), greatest(1, coalesce(p_lvl, 1)), ends, fr, bn, nt) returning id into rid;
  z := pc_name(p.sid);
  perform g_log(dg.id, format('⚔ %s (%s) attaque le Percepteur de %s%s ! Vous avez %s h pour battre son équipe d''arène (Guilde › Percepteurs), sinon le Percepteur et ses gardes se défendront seuls.',
    pseudo_of(p_user), ag.name, z, case when fr then ' (revanche)' else '' end, case when g_up(dg.id, 'vigie') > 0 then 3 else 2 end));
  perform g_log(ag.id, format('⚔ %s attaque le Percepteur de %s (%s) à %s%s.', pseudo_of(p_user), dg.name, z, to_char(ends at time zone 'Europe/Paris', 'HH24"h"MI'),
    case when fr then ' : revanche, butin +25 %' else '' end || case when nt then ' (Nuit des Percepteurs : butin ×1,5)' else '' end), false);
  return jsonb_build_object('ok', true, 'id', rid, 'ends', ends, 'zone', z, 'g', dg.name, 'free', fr, 'bonus', bn, 'left', greatest(0, rd_max(m.guild_id) - rd_today(p_user)));
end $$;
-- Défendre : un membre de la guilde attaquée, une fois par attaque, avec son équipe d'arène.
create or replace function public.rd_def_start(p_user uuid, p_raid bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); r perco_raids;
begin
  select * into r from perco_raids where id = p_raid; if not found then return g_err('Cette attaque n''existe plus.'); end if;
  if m.user_id is null then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  if m.guild_id <> r.def_guild then -- Alliances (9A) : les guildes alliées défendent aussi (supabase/alliances.sql)
    if to_regprocedure('public.al_allied(bigint, bigint)') is null then return g_err('Seuls les membres de la guilde attaquée défendent.'); end if;
    if not al_allied(m.guild_id, r.def_guild) then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  end if;
  if r.status <> 'open' or now() >= r.ends then return g_err('L''attaque est finie.'); end if;
  if exists (select 1 from jsonb_array_elements(r.tries) t where t->>'u' = p_user::text) then return g_err('Tu as déjà défendu pendant cette attaque.'); end if;
  return jsonb_build_object('ok', true, 'att', r.att_team, 'by', pseudo_of(r.att_user));
end $$;
create or replace function public.rd_def_done(p_user uuid, p_raid bigint, p_win boolean, p_heads jsonb, p_rounds int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); r perco_raids; z text;
begin
  perform pg_advisory_xact_lock(hashtext('raid:' || (select perco_id from perco_raids where id = p_raid)));
  select * into r from perco_raids where id = p_raid for update; if not found then return g_err('Cette attaque n''existe plus.'); end if;
  if m.user_id is null then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  if m.guild_id <> r.def_guild then -- Alliances (9A) : les guildes alliées défendent aussi (supabase/alliances.sql)
    if to_regprocedure('public.al_allied(bigint, bigint)') is null then return g_err('Seuls les membres de la guilde attaquée défendent.'); end if;
    if not al_allied(m.guild_id, r.def_guild) then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  end if;
  if r.status <> 'open' or now() >= r.ends then return g_err('L''attaque est finie.'); end if;
  if exists (select 1 from jsonb_array_elements(r.tries) t where t->>'u' = p_user::text) then return g_err('Tu as déjà défendu pendant cette attaque.'); end if;
  update perco_raids set tries = tries || jsonb_build_array(jsonb_build_object('u', p_user, 'p', pseudo_of(p_user), 'heads', coalesce(p_heads, '[]'::jsonb), 'win', p_win, 'at', now(), 'rounds', p_rounds)) where id = r.id;
  z := pc_name(r.sid);
  if not p_win then
    perform g_log(r.def_guild, format('%s n''a pas battu l''équipe de %s (Percepteur de %s).', pseudo_of(p_user), pseudo_of(r.att_user), z), false);
    return jsonb_build_object('ok', true, 'win', false);
  end if;
  update perco_raids set status = 'repelled', done_at = now(), res = jsonb_build_object('by', pseudo_of(p_user)) where id = r.id;
  update guild_percos set shield_until = now() + interval '6 hours', stars = least(5, stars + 1) where id = r.perco_id; -- Chasse aux Percepteurs (8A) : une étoile
  update guilds set pvp_win = pvp_win + 1 where id = r.def_guild;
  update guilds set pvp_loss = pvp_loss + 1 where id = r.att_guild;
  -- Alliances (9A) : un allié qui repousse l'attaque gagne le point pour sa propre guilde
  perform pw_add(m.guild_id, 1, 0, 0, 1); perform pw_add(r.att_guild, 0, 0, 1, 0);
  if m.guild_id <> r.def_guild then
    perform g_log(r.def_guild, format('🛡 %s (%s, guilde alliée) repousse l''attaque de %s sur le Percepteur de %s ! Bouclier de 6 h et une étoile de vétéran.', pseudo_of(p_user), (select name from guilds where id = m.guild_id), pseudo_of(r.att_user), z));
    perform g_log(m.guild_id, format('🛡 %s défend le Percepteur de %s (%s, guilde alliée) contre %s : +1 point de Guerre des Percepteurs.', pseudo_of(p_user), z, (select name from guilds where id = r.def_guild), pseudo_of(r.att_user)));
  else
  perform g_log(r.def_guild, format('🛡 %s repousse l''attaque de %s sur le Percepteur de %s ! Bouclier de 6 h, une étoile de vétéran, +1 point de Guerre des Percepteurs.', pseudo_of(p_user), pseudo_of(r.att_user), z));
  end if;
  perform g_log(r.att_guild, format('L''attaque de %s sur le Percepteur de %s (%s) est repoussée par %s.', pseudo_of(r.att_user), z, (select name from guilds where id = r.def_guild), pseudo_of(p_user)), false);
  return jsonb_build_object('ok', true, 'win', true);
end $$;
-- Fin de l'attaque (personne n'a gagné en 2 h) : l'équipe de l'attaquant affronte le Percepteur et ses gardes.
-- Peut être lancée par l'attaquant ou un membre de l'une des deux guildes, une fois l'heure passée.
create or replace function public.rd_end_start(p_user uuid, p_raid bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare m guild_members := g_me(p_user); r perco_raids; zl int; al boolean := false;
begin
  select * into r from perco_raids where id = p_raid for update; if not found then return g_err('Cette attaque n''existe plus.'); end if;
  if r.att_user <> p_user and (m.user_id is null or m.guild_id not in (r.att_guild, r.def_guild)) then return g_err('Cette attaque ne te concerne pas.'); end if;
  if r.status = 'fight' and r.fight_at > now() - interval '2 minutes' then return g_err('Le combat du Percepteur est en cours.'); end if;
  if r.status not in ('open', 'fight') then return g_err('L''attaque est déjà finie.'); end if;
  if now() < r.ends then return g_err(format('Les défenseurs ont encore %s min.', ceil(extract(epoch from (r.ends - now())) / 60))); end if;
  if not exists (select 1 from guild_percos where id = r.perco_id) then
    update perco_raids set status = 'lost', done_at = now(), res = jsonb_build_object('gone', true) where id = r.id;
    return g_err('Le Percepteur n''est plus là.');
  end if;
  update perco_raids set status = 'fight', fight_at = now() where id = r.id;
  zl := coalesce((select lvl from perco_zones where sid = r.sid), 1);
  if to_regprocedure('public.al_prism_cover(bigint, text)') is not null then al := al_prism_cover(r.def_guild, r.sid); end if; -- Alliances (6A)
  return jsonb_build_object('ok', true, 'att', r.att_team, 'lvl', greatest(zl, r.att_lvl), 'rob', g_up(r.def_guild, 'robustesse'),
    'stars', (select stars from guild_percos where id = r.perco_id), -- Chasse aux Percepteurs (8A) : +2 % par étoile (E.percoGuards)
    'ally', al); -- Alliances (6A) : +20 % de PV dans une région du prisme de son alliance (E.allyPercoBoost)
end $$;
-- Résultat du combat contre le Percepteur et ses gardes : pillage (50 %, 25 % contre un Coffre-fort, ÷ 2 si la guilde
-- visée a 10 niveaux de moins), Percepteur renvoyé (sa guilde garde le reste de la poche), place assommée 12 h,
-- zone gardée 1 h pour la guilde gagnante, points de classement. Sinon : bouclier de 6 h.
create or replace function public.rd_end_done(p_raid bigint, p_win boolean, p_rounds int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare r perco_raids; p guild_percos; z perco_zones; dg guilds; ag guilds; f real; gain jsonb; part numeric; half boolean; fort boolean;
  lk bigint; rk bigint; lres jsonb := '{}'::jsonb; rres jsonb := '{}'::jsonb; e record; q bigint; lq bigint; out jsonb; b perco_bounty; bk bigint := 0;
begin
  select * into r from perco_raids where id = p_raid for update; if not found then return g_err('Cette attaque n''existe plus.'); end if;
  if r.status <> 'fight' then return g_err('L''attaque est déjà finie.'); end if;
  perform pg_advisory_xact_lock(hashtext('guild' || r.def_guild));
  select * into p from guild_percos where id = r.perco_id for update;
  select * into dg from guilds where id = r.def_guild; select * into ag from guilds where id = r.att_guild;
  if not found or p.id is null then update perco_raids set status = 'lost', done_at = now(), res = jsonb_build_object('gone', true) where id = r.id; return g_err('Le Percepteur n''est plus là.'); end if;
  select * into z from perco_zones where sid = p.sid;
  if not p_win then
    update perco_raids set status = 'lost', done_at = now(), res = jsonb_build_object('rounds', p_rounds) where id = r.id;
    update guild_percos set shield_until = now() + interval '6 hours', stars = least(5, stars + 1) where id = p.id;
    update guilds set pvp_win = pvp_win + 1 where id = dg.id; update guilds set pvp_loss = pvp_loss + 1 where id = ag.id;
    perform pw_add(dg.id, 1, 0, 0, 1); perform pw_add(ag.id, 0, 0, 1, 0);
    perform g_log(dg.id, format('🛡 Le Percepteur de %s et ses gardes repoussent seuls l''équipe de %s (%s) ! Bouclier de 6 h, une étoile de vétéran, +1 point de Guerre des Percepteurs.', z.name, pseudo_of(r.att_user), ag.name));
    perform g_log(ag.id, format('%s est battu par le Percepteur de %s (%s) et ses gardes.', pseudo_of(r.att_user), z.name, dg.name));
    return jsonb_build_object('ok', true, 'win', false);
  end if;
  f := pc_fill(p); gain := pc_gain(z.cap, f, dg.ups);
  fort := coalesce((dg.ups->>'coffrefort')::int, 0) > 0; half := dg.lvl <= ag.lvl - 10;
  part := case when fort then 0.25 else 0.5 end * case when half then 0.5 else 1 end;
  part := least(1, part * coalesce(r.bonus, 1)); -- Chasse aux Percepteurs : revanche ×1,25, Nuit des Percepteurs ×1,5
  lk := floor((gain->>'k')::numeric * part); rk := (gain->>'k')::bigint - lk;
  for e in select key, value::bigint v from jsonb_each_text(gain->'res') loop
    lq := floor(e.v * part); q := e.v - lq;
    if lq >= 1 then lres := lres || jsonb_build_object(e.key, lq); end if;
    if q >= 1 then rres := rres || jsonb_build_object(e.key, q); end if;
  end loop;
  -- Chasse aux Percepteurs (7A) : primes sur ce Percepteur, pour l'attaquant (celle de sa propre guilde revient à son coffre)
  for b in select * from perco_bounty where perco_id = p.id and done is null for update loop
    update perco_bounty set done = 'paid' where id = b.id;
    if b.by_guild = ag.id then perform g_chest(ag.id, b.k, format('Prime sur le Percepteur de %s (%s) : revient au coffre', z.name, dg.name));
    else bk := bk + b.k; perform hdv_op(r.att_user, jsonb_build_object('k', b.k), format('Prime sur le Percepteur de %s (%s) : %s kamas', z.name, dg.name, g_fmt(b.k)));
      perform g_log(b.by_guild, format('💰 %s (%s) pille le Percepteur de %s et touche votre prime de %s kamas.', pseudo_of(r.att_user), ag.name, z.name, g_fmt(b.k)), false); end if;
  end loop;
  out := jsonb_build_object('k', lk, 'res', lres, 'part', part, 'half', half, 'fort', fort, 'rounds', p_rounds, 'zone', z.name, 'bounty', bk, 'bonus', coalesce(r.bonus, 1), 'free', r.free, 'night', r.night, 'stars', p.stars);
  update perco_raids set status = 'won', done_at = now(), res = out where id = r.id;
  -- butin : kamas au coffre de la guilde de l'attaquant, ressources pour lui
  perform g_chest(ag.id, lk, format('Pillage du Percepteur de %s (%s) par %s', z.name, dg.name, pseudo_of(r.att_user)));
  if lres <> '{}'::jsonb then perform hdv_op(r.att_user, jsonb_build_object('res', lres), format('Pillage du Percepteur de %s (%s) : ressources', z.name, dg.name)); end if;
  -- le Percepteur battu rentre chez lui : sa guilde garde le reste de la poche (comme une récolte)
  perform g_chest(dg.id, rk, format('Reste de la poche du Percepteur de %s (pillé par %s)', z.name, ag.name));
  if rres <> '{}'::jsonb and p.by_user is not null then perform hdv_op(p.by_user, jsonb_build_object('res', rres), format('Percepteur de %s pillé : le reste de sa poche', z.name)); end if;
  delete from guild_percos where id = p.id;
  insert into perco_ko (guild_id, sid, until) values (dg.id, p.sid, now() + interval '12 hours');
  insert into perco_hold (sid, guild_id, until) values (p.sid, ag.id, now() + interval '1 hour') on conflict (sid) do update set guild_id = excluded.guild_id, until = excluded.until;
  -- Chasse aux Percepteurs (6A) : la guilde pillée a 6 h de revanche contre la guilde de l'attaquant
  insert into perco_revenge (guild_id, target, sid, until) values (dg.id, ag.id, p.sid, now() + interval '6 hours');
  update guilds set pvp_win = pvp_win + 1 where id = ag.id; update guilds set pvp_loss = pvp_loss + 1 where id = dg.id;
  perform pw_add(ag.id, 3, 1, 0, 0); perform pw_add(dg.id, 0, 0, 1, 0);
  perform g_log(ag.id, format('🏆 %s pille le Percepteur de %s (%s) : +%s kamas au coffre%s%s, +3 points de Guerre des Percepteurs. La zone est à vous pendant 1 h !',
    pseudo_of(r.att_user), z.name, dg.name, g_fmt(lk), case when half then ' (butin ÷ 2 : ils ont 10 niveaux de moins)' else '' end,
    case when bk > 0 then format(' et une prime de %s kamas', g_fmt(bk)) else '' end));
  perform g_log(dg.id, format('Le Percepteur de %s a été battu par %s (%s) : %s %% de sa poche pillée, il rentre chez lui (place assommée 12 h). Revanche : pendant 6 h, chaque membre peut attaquer une fois un Percepteur de la guilde %s, sans compter ses attaques du jour, avec +25 %% de butin.',
    z.name, pseudo_of(r.att_user), ag.name, round(part * 100), ag.name));
  return jsonb_build_object('ok', true, 'win', true, 'loot', out);
end $$;

do $$ declare f text; begin
  foreach f in array array['gb_start(uuid, int)', 'gb_done(uuid, int, int, int, int, int, int, int, text, jsonb)', 'pc_start(uuid, bigint)', 'pc_done(uuid, bigint, bigint, boolean)',
    'rd_open(uuid, bigint, jsonb, jsonb, int)', 'rd_def_start(uuid, bigint)', 'rd_def_done(uuid, bigint, boolean, jsonb, int)', 'rd_end_start(uuid, bigint)', 'rd_end_done(bigint, boolean, int)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- 1.0.33 : une seule fois, la vie du boss de la semaine en cours passe au nouveau calcul (15 000 par membre actif) :
-- les guildes qui avaient déjà frappé gardent leurs points ; les phases atteintes sont notées au prochain essai.
create table if not exists public.gboss_resets (v text primary key, at timestamptz not null default now());
alter table public.gboss_resets enable row level security;
do $$ begin
  if not exists (select 1 from gboss_resets where v = '1.0.33') then
    update gboss_goal set goal = 15000 * greatest(3, gb_active(guild_id)) where w = gb_week();
    insert into gboss_resets (v) values ('1.0.33');
  end if;
end $$;
