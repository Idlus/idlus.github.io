-- ============================================================================
-- Idlus — classements (multijoueur, étape 3). Appliqué automatiquement par le
-- workflow « Serveur en ligne » (.github/workflows/supabase.yml) ; relançable sans danger.
-- Les classements se remplissent tout seuls à chaque envoi de partie (déclencheur sur saves).
-- Les records de donjon ne sont écrits que par la fonction serveur « record », qui rejoue
-- le combat avant de l'accepter.
-- ============================================================================

-- ---------- classement général (niveau, album, succès) ----------
create table if not exists public.ladder (
  user_id uuid primary key references auth.users (id) on delete cascade,
  main text,
  level int not null default 0,
  album int not null default 0,
  succes int not null default 0,
  playtime int not null default 0,
  heroes jsonb not null default '[]'::jsonb,
  flagged boolean not null default false,
  flag_reason text,
  updated_at timestamptz not null default now()
);
-- 0.1.17 : héros principal (niveau, titre) pour le chat, Dofus obtenus pour les annonces
alter table public.ladder add column if not exists main_lvl int not null default 1;
alter table public.ladder add column if not exists title text;
alter table public.ladder add column if not exists dofus jsonb not null default '[]'::jsonb;
-- 0.1.35 : niveaux donnés par les recrutements (un héros recruté arrive à la moitié du meilleur niveau : ce n'est pas de la triche)
alter table public.ladder add column if not exists rec int not null default 0;
-- 0.1.49 : points de succès (classement des points)
alter table public.ladder add column if not exists pts int not null default 0;
-- 1.0.5 : course de lancement en direct : étape de la quête principale et heure où elle a été atteinte
alter table public.ladder add column if not exists qstep int not null default 0;
alter table public.ladder add column if not exists qstep_at timestamptz;
alter table public.ladder enable row level security;
drop policy if exists "classement lisible" on public.ladder;
create policy "classement lisible" on public.ladder for select using (not flagged or user_id = auth.uid());

-- meilleur héros de chaque classe, pour le filtre par classe
create table if not exists public.ladder_class (
  user_id uuid not null references auth.users (id) on delete cascade,
  cls text not null,
  score int not null,
  primary key (user_id, cls)
);
alter table public.ladder_class enable row level security;
drop policy if exists "classes lisibles" on public.ladder_class;
create policy "classes lisibles" on public.ladder_class for select using (true);

-- ---------- records de donjon (vérifiés par le serveur) ----------
create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  did text not null,
  dname text,
  k int not null,
  t int not null,
  at timestamptz not null default now(),
  primary key (user_id, did)
);
alter table public.records enable row level security;
drop policy if exists "records lisibles" on public.records;
create policy "records lisibles" on public.records for select using (true);

create table if not exists public.records_week (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  did text not null,
  dname text,
  bracket int not null default 0,
  k int not null,
  t int not null,
  at timestamptz not null default now(),
  primary key (user_id, w, did)
);
alter table public.records_week enable row level security;
drop policy if exists "records semaine lisibles" on public.records_week;
create policy "records semaine lisibles" on public.records_week for select using (true);

-- ---------- les « Premiers » : gravés pour toujours ----------
create table if not exists public.firsts (
  kind text not null,
  key text not null default '',
  label text,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text,
  at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.firsts enable row level security;
drop policy if exists "premiers lisibles" on public.firsts;
create policy "premiers lisibles" on public.firsts for select using (true);

-- ---------- administrateurs (Mathis) ----------
create table if not exists public.admins (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.admins enable row level security;
-- le tout premier compte créé est celui de Mathis
insert into public.admins (user_id) select id from public.profiles order by created_at limit 1 on conflict do nothing;
-- s'il n'y a encore aucun compte, le premier pseudo créé devient administrateur
create or replace function public.first_admin() returns trigger language plpgsql security definer set search_path = public
as $$ begin if not exists (select 1 from public.admins) then insert into public.admins (user_id) values (new.id) on conflict do nothing; end if; return new; end $$;
drop trigger if exists profiles_first_admin on public.profiles;
create trigger profiles_first_admin after insert on public.profiles for each row execute function public.first_admin();

-- ---------- vues publiques (sans les joueurs « en vérification ») ----------
-- 0.1.26 : main_lvl (niveau du héros principal) ajouté en dernière colonne, pour le cadre du médaillon ; 0.1.49 : pts (points de succès) après
create or replace view public.lb_level as
  select l.user_id, p.pseudo, l.main, l.level, l.album, l.succes, l.heroes, l.main_lvl, l.pts
  from public.ladder l join public.profiles p on p.id = l.user_id where not l.flagged;
create or replace view public.lb_class as
  select c.user_id, p.pseudo, c.cls, c.score
  from public.ladder_class c join public.ladder l on l.user_id = c.user_id join public.profiles p on p.id = c.user_id where not l.flagged;
create or replace view public.lb_records as
  select r.user_id, p.pseudo, l.main, r.did, r.dname, r.k, r.t, r.at, l.main_lvl
  from public.records r join public.ladder l on l.user_id = r.user_id join public.profiles p on p.id = r.user_id where not l.flagged;
create or replace view public.lb_week as
  select r.user_id, p.pseudo, l.main, r.w, r.did, r.dname, r.bracket, r.k, r.t, r.at,
    rank() over (partition by r.w, r.did order by r.k desc, r.t asc, r.at asc) as r, l.main_lvl
  from public.records_week r join public.ladder l on l.user_id = r.user_id join public.profiles p on p.id = r.user_id where not l.flagged;
grant select on public.lb_level, public.lb_class, public.lb_records, public.lb_week to anon, authenticated;
-- 1.0.5 : course de lancement : les comptes classés par étape de la quête principale, puis par qui l'a atteinte en premier
create or replace view public.lb_race as
  select l.user_id, p.pseudo, l.main, l.main_lvl, l.qstep, l.qstep_at
  from public.ladder l join public.profiles p on p.id = l.user_id where not l.flagged and l.qstep > 0;
grant select on public.lb_race to anon, authenticated;

-- ---------- mise à jour du classement à chaque envoi de partie ----------
-- La partie envoie un résumé (meta) : niveau de l'équipe, album, succès, héros.
-- Un progrès impossible depuis l'envoi précédent met le joueur « en vérification » :
-- il disparaît des classements mais joue normalement ; Mathis décide (panneau de test).
create or replace function public.ladder_from_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := new.meta; o public.ladder%rowtype; rk int; lv int; al int; su int; pt int; rc int; ps int; qs int; secs numeric; reason text; bad boolean;
begin
  if m is null or m->>'level' is null then return new; end if;
  lv := coalesce((m->>'level')::int, 0); al := coalesce((m->>'album')::int, 0);
  su := coalesce((m->>'succes')::int, 0); pt := coalesce((m->>'playtime')::int, 0);
  rc := coalesce((m->>'rec')::int, 0); ps := least(greatest(coalesce((m->>'pts')::int, 0), 0), 50000);
  qs := least(greatest(coalesce((m->>'qstep')::int, 0), 0), 500);
  select * into o from public.ladder where user_id = new.user_id;
  if found then
    secs := greatest(60, extract(epoch from (now() - o.updated_at)));
    if lv - o.level - greatest(0, rc - o.rec) > 60 + secs / 60 then reason := format('+%s niveaux en %s min', lv - o.level, round(secs / 60));
    elsif al - o.album > 10 + secs / 300 then reason := format('+%s âmes en %s min', al - o.album, round(secs / 60));
    elsif pt + 120 < o.playtime then reason := 'temps de jeu en baisse';
    end if;
  elsif lv > 400 and pt < 3600 then reason := 'niveau trop élevé pour le temps de jeu';
  end if;
  if coalesce((m->>'panel')::boolean, false) then reason := 'panel de test utilisé dans cette partie'; end if;
  insert into public.ladder (user_id, main, level, album, succes, playtime, heroes, flagged, flag_reason, updated_at, main_lvl, title, dofus, rec, pts, qstep, qstep_at)
    values (new.user_id, m->>'main', lv, al, su, pt, coalesce(m->'heroes', '[]'::jsonb), reason is not null, reason, now(),
      coalesce((m->>'mainLvl')::int, 1), left(m->>'title', 40), coalesce(m->'dofus', '[]'::jsonb), rc, ps, qs, now())
    on conflict (user_id) do update set main = excluded.main, level = excluded.level, album = excluded.album, succes = excluded.succes,
      playtime = excluded.playtime, heroes = excluded.heroes, updated_at = now(), main_lvl = excluded.main_lvl, title = excluded.title, dofus = excluded.dofus, rec = excluded.rec, pts = excluded.pts,
      qstep = excluded.qstep, qstep_at = case when excluded.qstep > public.ladder.qstep or public.ladder.qstep_at is null then now() else public.ladder.qstep_at end,
      flagged = public.ladder.flagged or excluded.flagged, flag_reason = coalesce(public.ladder.flag_reason, excluded.flag_reason);
  select flagged into bad from public.ladder where user_id = new.user_id;
  delete from public.ladder_class where user_id = new.user_id;
  insert into public.ladder_class (user_id, cls, score)
    select new.user_id, x->>'cls', max(coalesce((x->>'lvl')::int, 0) + 200 * coalesce((x->>'ren')::int, 0))
    from jsonb_array_elements(coalesce(m->'heroes', '[]'::jsonb)) x where x->>'cls' is not null group by x->>'cls';
  if not bad and coalesce((m->>'lvl200')::boolean, false) then
    insert into public.firsts (kind, key, label, user_id, pseudo)
      select 'lvl200', '', 'Premier héros au niveau 200', new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
      on conflict do nothing;
  end if;
  -- 1.0 : course de lancement : les 10 premiers comptes à finir la quête principale après la sortie (13/10/2026, 16 h Paris)
  if not bad and coalesce((m->>'mainq')::boolean, false) and now() >= timestamptz '2026-10-13 14:00:00+00'
     and not exists (select 1 from public.firsts where kind = 'race10' and user_id = new.user_id) then
    select count(*) into rk from public.firsts where kind = 'race10';
    if rk < 10 then
      insert into public.firsts (kind, key, label, user_id, pseudo)
        select 'race10', (rk + 1)::text, format('Course de lancement de la 1.0 : n° %s sur 10', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists saves_ladder on public.saves;
create trigger saves_ladder after insert or update on public.saves for each row execute function public.ladder_from_save();

-- ---------- panneau de test : joueurs « en vérification » ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to authenticated;
create or replace function public.admin_flagged()
returns table (user_id uuid, pseudo text, reason text, level int, updated_at timestamptz)
language sql security definer set search_path = public
as $$ select l.user_id, p.pseudo, l.flag_reason, l.level, l.updated_at from public.ladder l join public.profiles p on p.id = l.user_id
      where l.flagged and public.is_admin() order by l.updated_at desc $$;
create or replace function public.admin_unflag(p_user uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  update public.ladder set flagged = false, flag_reason = null where user_id = p_user; end $$;
create or replace function public.admin_flag(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$ begin if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  update public.ladder set flagged = true, flag_reason = coalesce(p_reason, 'décision de Mathis') where user_id = p_user; end $$;
revoke all on function public.admin_flagged(), public.admin_unflag(uuid), public.admin_flag(uuid, text) from public, anon;
grant execute on function public.admin_flagged(), public.admin_unflag(uuid), public.admin_flag(uuid, text) to authenticated;
