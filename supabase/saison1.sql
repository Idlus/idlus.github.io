-- FICHIER FABRIQUÉ par tools/saison_schema.js : ne pas modifier à la main (relancer le script).
-- Espace de la Saison 1 : schéma s1, recréé à côté de public. Les comptes (profils, pseudos, admins, chat) restent dans public.
-- Relançable sans danger, comme les autres fichiers. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.
create schema if not exists s1;
-- mêmes droits par défaut que public sur Supabase (tools/serveur/restaurer.sh) : les règles RLS et les « revoke » des fichiers font le reste
grant usage on schema s1 to postgres, anon, authenticated, service_role;
grant all on schema s1 to postgres, service_role;
alter default privileges in schema s1 grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema s1 grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema s1 grant all on sequences to postgres, anon, authenticated, service_role;
-- À L'INSTALLATION : ajouter s1 à PGRST_DB_SCHEMAS (API du serveur), puis recharger l'API.

-- ======================== supabase/schema.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — base de données en ligne (Supabase), étape 2 du multijoueur :
-- comptes (pseudo) et sauvegarde en ligne.
-- À coller une fois dans Supabase : SQL Editor > New query > Run.
-- Le texte peut être relancé sans danger (il ne recrée que ce qui manque).
-- Règle d'or : chaque joueur ne peut lire et écrire QUE sa propre partie.
-- ============================================================================

-- ---------- profils : un pseudo unique par compte ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null check (pseudo ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,16}$'),
  created_at timestamptz not null default now()
);
-- 0.1.17 : compte suspendu par Mathis (panel admin) : la partie n'est plus envoyée en ligne
alter table public.profiles add column if not exists suspended_at timestamptz;
-- 2.1.18 : suspension temporaire (null = définitive) ; levée toute seule à la première vérification après la date
alter table public.profiles add column if not exists suspended_until timestamptz;
-- Lève les suspensions arrivées à leur fin (le compte revient aussi dans les classements)
create or replace function public.susp_lift() returns void language plpgsql security definer set search_path = s1, public
as $$ declare ids uuid[]; begin
  with x as (update profiles set suspended_at = null, suspended_until = null where suspended_at is not null and suspended_until <= now() returning id)
  select array_agg(id) into ids from x;
  if ids is not null then update ladder set flagged = false, flag_reason = null where user_id = any(ids) and flag_reason = 'compte suspendu'; end if;
end $$;
-- Le compte u est-il suspendu en ce moment ? (lève la suspension si elle est finie)
create or replace function public.susp(u uuid) returns boolean language plpgsql security definer set search_path = s1, public
as $$ declare t timestamptz; f timestamptz; begin
  select suspended_at, suspended_until into t, f from profiles where id = u;
  if t is null then return false; end if;
  if f is not null and f <= now() then perform public.susp_lift(); return false; end if;
  return true;
end $$;
revoke all on function public.susp_lift() from public, anon, authenticated;
revoke all on function public.susp(uuid) from public, anon;
grant execute on function public.susp(uuid) to authenticated;
create unique index if not exists profiles_pseudo_unique on public.profiles (lower(pseudo));
alter table public.profiles enable row level security;

-- Les pseudos sont publics (classements, chat, guildes plus tard).
drop policy if exists "pseudos lisibles par tous" on public.profiles;
create policy "pseudos lisibles par tous" on public.profiles for select using (true);
-- On crée son propre profil, une seule fois (pas de changement de pseudo pour l'instant).
drop policy if exists "créer son profil" on public.profiles;
create policy "créer son profil" on public.profiles for insert to authenticated with check (id = auth.uid());

-- ---------- sauvegardes : une partie par compte ----------
create table if not exists s1.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data text not null check (length(data) < 3000000),
  meta jsonb not null default '{}'::jsonb,
  game_version text,
  device text,
  updated_at timestamptz not null default now()
);
alter table s1.saves enable row level security;

drop policy if exists "lire sa partie" on s1.saves;
create policy "lire sa partie" on s1.saves for select to authenticated using (user_id = auth.uid());
-- 21/10/2026 (faille de sauvegarde) : plus aucune écriture directe depuis le jeu (insert, update, upsert, delete du client).
-- La partie ne s'écrit que par push_save (security definer) : suspension, remise imposée (meta.remise) et protection
-- contre l'écrasement (p_expected) ne peuvent plus être contournées. L'effacement passe par delete_my_account (cascade).
drop policy if exists "créer sa partie" on s1.saves;
drop policy if exists "modifier sa partie" on s1.saves;
drop policy if exists "effacer sa partie" on s1.saves;
revoke insert, update, delete, truncate, references, trigger on s1.saves from anon, authenticated;

-- ---------- envoi de la partie ----------
-- p_expected = date de la version en ligne que l'appareil connaît.
-- Si la partie en ligne a changé entre-temps (autre appareil), rien n'est écrit et la
-- fonction renvoie null : le jeu demande alors au joueur quelle version garder.
-- p_force = vrai quand le joueur a choisi de garder la version de cet appareil.
create or replace function s1.push_save(p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = s1, public
as $$
declare r timestamptz;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if public.susp(auth.uid()) then raise exception 'compte suspendu'; end if;
  -- Remise imposée : partie remise à une copie par Mathis (adm_save_restore, meta.remise) : pas d'envoi forcé par-dessus,
  -- l'appareil doit d'abord reprendre la version en ligne (son envoi suivant, normal, efface la marque)
  if p_force and exists (select 1 from saves where user_id = auth.uid() and meta ? 'remise') then p_force := false; end if;
  if p_force then
    insert into saves (user_id, data, meta, game_version, device, updated_at)
      values (auth.uid(), p_data, coalesce(p_meta, '{}'::jsonb), p_version, p_device, clock_timestamp())
      on conflict (user_id) do update set data = excluded.data, meta = excluded.meta, game_version = excluded.game_version, device = excluded.device, updated_at = excluded.updated_at
      returning updated_at into r;
  elsif p_expected is null then
    insert into saves (user_id, data, meta, game_version, device, updated_at)
      values (auth.uid(), p_data, coalesce(p_meta, '{}'::jsonb), p_version, p_device, clock_timestamp())
      on conflict (user_id) do nothing
      returning updated_at into r;
  else
    update saves set data = p_data, meta = coalesce(p_meta, '{}'::jsonb), game_version = p_version, device = p_device, updated_at = clock_timestamp()
      where user_id = auth.uid() and updated_at = p_expected::timestamptz
      returning updated_at into r;
  end if;
  return to_char(r at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
end $$;
revoke all on function s1.push_save(text, jsonb, text, text, text, boolean) from public, anon;
grant execute on function s1.push_save(text, jsonb, text, text, text, boolean) to authenticated;

-- Date de la version en ligne, dans le même format que push_save (pour comparer exactement).
create or replace function s1.save_info()
returns table (updated_at text, meta jsonb, device text, game_version text)
language sql
security invoker
set search_path = s1, public
as $$
  select to_char(s.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), s.meta, s.device, s.game_version
  from saves s where s.user_id = auth.uid();
$$;
revoke all on function s1.save_info() from public, anon;
grant execute on function s1.save_info() to authenticated;

-- ---------- supprimer son compte ----------
-- Efface le compte, son pseudo et sa partie en ligne (la partie sur l'appareil reste).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = s1, public
as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- 2.1.4 « Bouclier du serveur » (choix 1A 2A 3A 4A de Mathis) : la dernière partie validée ----------
-- Le jeu continue d'envoyer sa partie dans saves (toutes les 30 s). La fonction serveur « record » ({ verif: 1 }) la relit,
-- calcule elle-même le résumé des classements et vérifie la partie (objets possibles, points de caractéristiques, gains
-- depuis la partie validée d'avant comparés au temps réel). Si tout va bien, elle est copiée ici. Les classements
-- (déclencheurs sur saves_ok), l'hôtel de vente (hdv_save) et les combats rejoués partent de cette copie.
-- Personne ne lit ni n'écrit cette table depuis le jeu (aucune règle) : seuls le serveur et les fonctions ci-dessous.
create table if not exists s1.saves_ok (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data text not null,
  meta jsonb not null default '{}'::jsonb,   -- résumé calculé par le serveur (VERIFY.fullSummary)
  bilan jsonb,                               -- kamas, ressources, Maîtrise, niveaux, Dofus, opération HdV (VERIFY.bilan)
  res real,                                  -- réserve d'heures de jeu (VERIFY.check)
  src_at timestamptz,                        -- date de la partie de saves qui a été validée
  at timestamptz not null default now(),
  accept boolean not null default false      -- « C'est bon » de Mathis : la prochaine partie envoyée est acceptée telle quelle
);
alter table s1.saves_ok enable row level security;
-- Au premier passage, les parties déjà en ligne deviennent les parties validées de départ (rien n'est remis à zéro).
-- La date est reculée d'une heure pour que la première vérification se fasse tout de suite.
insert into s1.saves_ok (user_id, data, meta, src_at, at)
  select user_id, data, '{}'::jsonb, updated_at, now() - interval '1 hour' from s1.saves on conflict (user_id) do nothing;

-- 4A : une copie de la partie validée par jour (heure de Paris), 7 jours, pour remettre un joueur en arrière.
create table if not exists s1.saves_jour (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  data text not null,
  lvl int, kamas bigint,
  at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table s1.saves_jour enable row level security;

-- Ce que le bouclier a refusé (raison en clair), lu par le panel Xener.
create table if not exists s1.bouclier_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  why text not null,
  at timestamptz not null default now()
);
create index if not exists bouclier_log_user on s1.bouclier_log (user_id, at desc);
alter table s1.bouclier_log enable row level security;

reset search_path;

-- ======================== supabase/classements.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — classements (multijoueur, étape 3). Appliqué automatiquement par le
-- workflow « Serveur en ligne » (.github/workflows/supabase.yml) ; relançable sans danger.
-- Les classements se remplissent tout seuls à chaque envoi de partie (déclencheur sur saves).
-- Les records de donjon ne sont écrits que par la fonction serveur « record », qui rejoue
-- le combat avant de l'accepter.
-- ============================================================================

-- ---------- classement général (niveau, album, succès) ----------
create table if not exists s1.ladder (
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
alter table s1.ladder add column if not exists main_lvl int not null default 1;
alter table s1.ladder add column if not exists title text;
alter table s1.ladder add column if not exists dofus jsonb not null default '[]'::jsonb;
-- 0.1.35 : niveaux donnés par les recrutements (un héros recruté arrive à la moitié du meilleur niveau : ce n'est pas de la triche)
alter table s1.ladder add column if not exists rec int not null default 0;
-- 0.1.49 : points de succès (classement des points)
alter table s1.ladder add column if not exists pts int not null default 0;
-- 1.0.5 : course de lancement en direct : étape de la quête principale et heure où elle a été atteinte
alter table s1.ladder add column if not exists qstep int not null default 0;
alter table s1.ladder add column if not exists qstep_at timestamptz;
-- 1.0.8 : classement des métiers : {"tailleur": [niveau, xp], …, "tous": [somme des niveaux, somme des xp]}
alter table s1.ladder add column if not exists jobs jsonb not null default '{}'::jsonb;
-- 1.0.9 : métiers de récolte et de forgemagie, classement de la semaine. jobs : [niveau, xp du niveau, xp totale, xp gagnée
-- pendant la semaine jobs_w] ; jobs_base : xp totale de chaque métier au début de la semaine ; jobs_prev : xp gagnée la semaine jobs_pw
alter table s1.ladder add column if not exists jobs_w int not null default 0;
alter table s1.ladder add column if not exists jobs_base jsonb not null default '{}'::jsonb;
alter table s1.ladder add column if not exists jobs_prev jsonb not null default '{}'::jsonb;
alter table s1.ladder add column if not exists jobs_pw int not null default 0;
-- 2.1.12 : points de Maîtrise comptés dans level (un point = un niveau) ; au premier envoi qui les compte, ils ne passent pas pour une montée suspecte
alter table s1.ladder add column if not exists mtl int not null default 0;
-- 1.0.19 « Métiers comme dans DOFUS » : 1 quand la partie envoyée a ses métiers d'objets au niveau des objets (niveaux convertis)
alter table s1.ladder add column if not exists jobs_cobj int not null default 0;
-- 1.0.32.11 « Vérifié par Mathis » : un joueur que Mathis remet dans les classements n'est plus remis « en vérification »
-- automatiquement (avant, une partie qui avait servi au panel de test y retombait à chaque envoi) ; seul Mathis peut l'y remettre
alter table s1.ladder add column if not exists verified boolean not null default false;
-- 1.0.32.13 « Mathis décide » : la vérification automatique ne retire plus personne des classements ; elle signale seulement le
-- compte à Mathis (suspect + flag_reason, onglet « En vérification » du panel Xener). Seul Mathis retire un joueur (flagged).
-- Exception : sa propre partie retouchée par le panel de test (mode « Comme un joueur ») reste hors des classements.
alter table s1.ladder add column if not exists suspect boolean not null default false;
-- 1.0.19 : pour les classements, un compte pas encore revenu depuis la mise à jour montre ses métiers d'objets au niveau converti
-- (3 × niveau + 2, au plus 200, même part de la barre d'XP, comme la conversion du jeu) ; rien n'est modifié en base, le jeu
-- convertit la partie au prochain chargement. L'XP totale suit la courbe du jeu (30 × niveau^1,55 par niveau), le gain de la semaine reste.
create or replace function s1.jobs_shown(j jsonb, c int) returns jsonb language plpgsql immutable set search_path = s1, public as $$
declare k text; v jsonb; l0 int; x0 bigint; l1 int; x1 bigint; cum bigint; sl bigint := 0; sx bigint := 0; st bigint := 0; sg bigint := 0; have boolean := false;
begin
  if coalesce(c, 0) >= 1 or j is null or j = '{}'::jsonb then return j; end if;
  foreach k in array array['tailleur','bijoutier','cordonnier','forgeron','sculpteur','faconneur'] loop
    v := j->k;
    if jsonb_typeof(v) = 'array' then
      l0 := least(greatest(coalesce((v->>0)::int, 1), 1), 200); x0 := greatest(coalesce((v->>1)::bigint, 0), 0);
      if l0 < 200 and (l0 > 1 or x0 > 0) then
        l1 := least(200, 3 * l0 + 2);
        x1 := case when l1 >= 200 then 0 else floor(least(1.0, x0::numeric / floor(30 * power(l0, 1.55))::numeric) * floor(30 * power(l1, 1.55)))::bigint end;
        select coalesce(sum(floor(30 * power(i, 1.55))), 0)::bigint into cum from generate_series(1, l1 - 1) i;
        j := j || jsonb_build_object(k, jsonb_build_array(l1, x1, cum + x1) || case when jsonb_array_length(v) >= 4 then jsonb_build_array(v->3) else '[]'::jsonb end);
      end if;
    end if;
  end loop;
  foreach k in array array['tailleur','bijoutier','cordonnier','forgeron','sculpteur','faconneur','bricoleur'] loop -- somme « tous » refaite
    v := j->k;
    if jsonb_typeof(v) = 'array' then
      have := true; sl := sl + coalesce((v->>0)::bigint, 0); sx := sx + coalesce((v->>1)::bigint, 0); st := st + coalesce((v->>2)::bigint, 0); sg := sg + coalesce((v->>3)::bigint, 0);
    end if;
  end loop;
  if have and jsonb_typeof(j->'tous') = 'array' then j := j || jsonb_build_object('tous', jsonb_build_array(sl, sx, st, sg)); end if;
  return j;
end $$;
alter table s1.ladder enable row level security;
drop policy if exists "classement lisible" on s1.ladder;
create policy "classement lisible" on s1.ladder for select using (not flagged or user_id = auth.uid());

-- meilleur héros de chaque classe, pour le filtre par classe
create table if not exists s1.ladder_class (
  user_id uuid not null references auth.users (id) on delete cascade,
  cls text not null,
  score int not null,
  primary key (user_id, cls)
);
alter table s1.ladder_class enable row level security;
drop policy if exists "classes lisibles" on s1.ladder_class;
create policy "classes lisibles" on s1.ladder_class for select using (true);

-- ---------- records de donjon (vérifiés par le serveur) ----------
create table if not exists s1.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  did text not null,
  dname text,
  k int not null,
  t int not null,
  at timestamptz not null default now(),
  primary key (user_id, did)
);
alter table s1.records enable row level security;
drop policy if exists "records lisibles" on s1.records;
create policy "records lisibles" on s1.records for select using (true);

create table if not exists s1.records_week (
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
alter table s1.records_week enable row level security;
drop policy if exists "records semaine lisibles" on s1.records_week;
create policy "records semaine lisibles" on s1.records_week for select using (true);
-- 1.0.30 (choix 23B) : équipe du record (classes des héros du combat rejoué par la fonction « record »), montrée dans la fiche
-- du donjon et dans Classements › Donjons. Les records d'avant gardent une équipe vide : rien n'est modifié.
alter table s1.records add column if not exists team jsonb not null default '[]'::jsonb;
alter table s1.records_week add column if not exists team jsonb not null default '[]'::jsonb;

-- ---------- les « Premiers » : gravés pour toujours ----------
create table if not exists s1.firsts (
  kind text not null,
  key text not null default '',
  label text,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text,
  at timestamptz not null default now(),
  primary key (kind, key)
);
alter table s1.firsts enable row level security;
drop policy if exists "premiers lisibles" on s1.firsts;
create policy "premiers lisibles" on s1.firsts for select using (true);

-- ---------- administrateurs (Mathis) ----------
create table if not exists public.admins (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.admins enable row level security;
-- le tout premier compte créé est celui de Mathis
insert into public.admins (user_id) select id from public.profiles order by created_at limit 1 on conflict do nothing;
-- s'il n'y a encore aucun compte, le premier pseudo créé devient administrateur
create or replace function s1.first_admin() returns trigger language plpgsql security definer set search_path = s1, public
as $$ begin if not exists (select 1 from public.admins) then insert into public.admins (user_id) values (new.id) on conflict do nothing; end if; return new; end $$;
drop trigger if exists profiles_first_admin on public.profiles;
create trigger profiles_first_admin after insert on public.profiles for each row execute function s1.first_admin();

-- ---------- vues publiques (sans les joueurs « en vérification ») ----------
-- 0.1.26 : main_lvl (niveau du héros principal) ajouté en dernière colonne, pour le cadre du médaillon ; 0.1.49 : pts (points de succès) après
-- 1.0.30 : team (équipe du record) en dernière colonne de lb_records et lb_week
create or replace view s1.lb_level as
  select l.user_id, p.pseudo, l.main, l.level, l.album, l.succes, l.heroes, l.main_lvl, l.pts
  from s1.ladder l join public.profiles p on p.id = l.user_id where not l.flagged;
create or replace view s1.lb_class as
  select c.user_id, p.pseudo, c.cls, c.score
  from s1.ladder_class c join s1.ladder l on l.user_id = c.user_id join public.profiles p on p.id = c.user_id where not l.flagged;
create or replace view s1.lb_records as
  select r.user_id, p.pseudo, l.main, r.did, r.dname, r.k, r.t, r.at, l.main_lvl, r.team
  from s1.records r join s1.ladder l on l.user_id = r.user_id join public.profiles p on p.id = r.user_id where not l.flagged;
create or replace view s1.lb_week as
  select r.user_id, p.pseudo, l.main, r.w, r.did, r.dname, r.bracket, r.k, r.t, r.at,
    rank() over (partition by r.w, r.did order by r.k desc, r.t asc, r.at asc) as r, l.main_lvl, r.team
  from s1.records_week r join s1.ladder l on l.user_id = r.user_id join public.profiles p on p.id = r.user_id where not l.flagged;
grant select on s1.lb_level, s1.lb_class, s1.lb_records, s1.lb_week to anon, authenticated;
-- 1.0.5 : course de lancement : les comptes classés par étape de la quête principale, puis par qui l'a atteinte en premier
create or replace view s1.lb_race as
  select l.user_id, p.pseudo, l.main, l.main_lvl, l.qstep, l.qstep_at
  from s1.ladder l join public.profiles p on p.id = l.user_id where not l.flagged and l.qstep > 0;
grant select on s1.lb_race to anon, authenticated;
-- 1.0.8 : classement des métiers : une ligne par compte et par métier (et « tous »), sans les joueurs en vérification
-- 1.0.9 : + total (xp totale depuis le niveau 1, pour « Encore … XP pour dépasser … ») ; 1.0.19 : métiers montrés convertis (jobs_shown)
-- 1.0.25 : + ren (renaissances du métier, ou leur somme pour « tous ») : le jeu classe par renaissance, puis niveau, puis XP
create or replace view s1.lb_jobs as
  select l.user_id, p.pseudo, l.main, l.main_lvl, j.key as job, (j.value->>0)::int as lvl, (j.value->>1)::bigint as xp, c.jj as alljobs, coalesce((j.value->>2)::bigint, 0) as total,
    coalesce((j.value->>4)::int, 0) as ren
  from s1.ladder l join public.profiles p on p.id = l.user_id cross join lateral (select s1.jobs_shown(l.jobs, l.jobs_cobj) as jj) c cross join lateral jsonb_each(c.jj) j
  where not l.flagged and jsonb_typeof(j.value) = 'array';
grant select on s1.lb_jobs to anon, authenticated;
-- 1.0.9 : classement de la semaine (semaine w = celle des donjons de la semaine, du lundi au dimanche, en UTC) : xp gagnée
-- par compte et par métier, cette semaine (jobs) et la précédente (jobs_prev) ; r = place dans la semaine
create or replace view s1.lb_jobs_week as
  select x.*, rank() over (partition by x.w, x.job order by x.gain desc) as r from (
    select l.user_id, p.pseudo, l.main, l.main_lvl, l.jobs_w as w, j.key as job, coalesce((j.value->>3)::bigint, 0) as gain, (j.value->>0)::int as lvl
    from s1.ladder l join public.profiles p on p.id = l.user_id cross join lateral jsonb_each(s1.jobs_shown(l.jobs, l.jobs_cobj)) j
    where not l.flagged and l.jobs_w > 0 and jsonb_typeof(j.value) = 'array'
    union all
    select l.user_id, p.pseudo, l.main, l.main_lvl, l.jobs_pw as w, j.key as job, coalesce((j.value #>> '{}')::bigint, 0) as gain, null::int as lvl
    from s1.ladder l join public.profiles p on p.id = l.user_id cross join lateral jsonb_each(l.jobs_prev) j
    where not l.flagged and l.jobs_pw > 0 and jsonb_typeof(j.value) = 'number'
  ) x where x.gain > 0;
grant select on s1.lb_jobs_week to anon, authenticated;

-- ---------- mise à jour du classement à chaque envoi de partie ----------
-- La partie envoie un résumé (meta) : niveau de l'équipe, album, succès, héros.
-- Un progrès impossible depuis l'envoi précédent met le joueur « en vérification » :
-- 1.0.32.13 : il reste classé et joue normalement, le compte est seulement signalé à Mathis, qui décide (panel Xener).
create or replace function s1.ladder_from_save()
returns trigger
language plpgsql
security definer
set search_path = s1, public
as $$
declare
  m jsonb := new.meta; o s1.ladder%rowtype; rk int; lv int; al int; su int; pt int; rc int; ps int; qs int; secs numeric; reason text; bad boolean;
  jb jsonb := '{}'::jsonb; jn text; jl int; jr int; jx bigint; jtt bigint; jg text; jsum jsonb := '{}'::jsonb; wnow int; jbase jsonb; jprev jsonb := '{}'::jsonb; jpw int := 0; bt bigint; jgain bigint; jv jsonb; hadrow boolean;
  cobj int; mtv int; conv boolean := false; stale boolean := false; hide boolean := false;
  jnames constant jsonb := '{"tailleur":"Tailleur","bijoutier":"Bijoutier","cordonnier":"Cordonnier","forgeron":"Forgeron","sculpteur":"Sculpteur","faconneur":"Façonneur","bricoleur":"Bricoleur"}';
  -- 1.0.9 : tous les métiers classés et leur groupe (le total du groupe : tous, tous_recolte, tous_fm)
  jgroup constant jsonb := '{"tailleur":"tous","bijoutier":"tous","cordonnier":"tous","forgeron":"tous","sculpteur":"tous","faconneur":"tous","bricoleur":"tous",
    "paysan":"tous_recolte","bucheron":"tous_recolte","mineur":"tous_recolte","alchimiste":"tous_recolte","pecheur":"tous_recolte",
    "costumage":"tous_fm","joaillomage":"tous_fm","cordomage":"tous_fm","forgemage":"tous_fm","sculptemage":"tous_fm","facomage":"tous_fm"}';
begin
  if m is null or m->>'level' is null then return new; end if;
  lv := coalesce((m->>'level')::int, 0); al := coalesce((m->>'album')::int, 0);
  su := coalesce((m->>'succes')::int, 0); pt := coalesce((m->>'playtime')::int, 0);
  rc := coalesce((m->>'rec')::int, 0); ps := least(greatest(coalesce((m->>'pts')::int, 0), 0), 50000);
  qs := least(greatest(coalesce((m->>'qstep')::int, 0), 0), 500);
  mtv := least(greatest(coalesce((m->>'mtl')::int, 0), 0), lv);
  select * into o from s1.ladder where user_id = new.user_id;
  hadrow := found; -- (found change à chaque requête : on garde ici si le compte était déjà classé)
  -- 1.0.19 « Métiers comme dans DOFUS » : conv = premier envoi d'une partie aux métiers convertis (le saut de niveau ne compte ni dans
  -- la semaine, ni pour la vérification de vitesse, ni pour les « Premiers ») ; stale = partie pas encore convertie (vieil onglet)
  -- envoyée après : elle ne touche plus aux métiers
  cobj := case when coalesce((m->>'cobj')::int, 0) >= 1 then 1 else 0 end;
  conv := hadrow and cobj = 1 and o.jobs_cobj = 0;
  stale := hadrow and cobj = 0 and o.jobs_cobj = 1;
  -- 1.0.8 : métiers (seulement ceux qui sont connus, niveau 1 à 200) ; 1.0.9 : xp totale et xp gagnée dans la semaine
  wnow := floor((extract(epoch from now()) / 86400 + 3) / 7)::int; -- même semaine que les donjons de la semaine
  if hadrow and o.jobs_w = wnow then jbase := o.jobs_base; jprev := o.jobs_prev; jpw := o.jobs_pw;
  else -- nouvelle semaine : on part des derniers totaux connus, et la semaine passée est gardée pour le titre
    jbase := '{}'::jsonb;
    if hadrow then
      select coalesce(jsonb_object_agg(key, (value->>2)::bigint), '{}'::jsonb) into jbase from jsonb_each(o.jobs) where jsonb_typeof(value) = 'array' and value->>2 is not null and jgroup ? key;
      if o.jobs_w > 0 then
        select coalesce(jsonb_object_agg(key, (value->>3)::bigint), '{}'::jsonb) into jprev from jsonb_each(o.jobs) where jsonb_typeof(value) = 'array' and coalesce((value->>3)::bigint, 0) > 0;
        jpw := o.jobs_w;
      end if;
    end if;
  end if;
  if jsonb_typeof(m->'jobs') = 'object' and not stale then
    for jn in select jsonb_object_keys(jgroup) loop
      jv := m->'jobs'->jn;
      if jsonb_typeof(jv) = 'array' then
        jl := least(greatest(coalesce((jv->>0)::int, 1), 1), 200);
        jx := least(greatest(coalesce((jv->>1)::bigint, 0), 0), 2000000000);
        -- 1.0.25 « Renaissance des métiers » : 4e valeur envoyée = nombre de renaissances (0 à 10), gardé en 5e ; l'XP totale compte toutes les vies
        jr := case when jsonb_array_length(jv) >= 4 and jsonb_typeof(jv->3) = 'number' then least(greatest(floor((jv->>3)::numeric)::int, 0), 10) else 0 end;
        if jsonb_array_length(jv) >= 3 then
          jtt := least(greatest(coalesce((jv->>2)::bigint, 0), 0), 1000000000000);
          bt := coalesce((jbase->>jn)::bigint, jtt); -- métier vu pour la première fois cette semaine : il part de là
          if conv and jgroup->>jn = 'tous' and jn <> 'bricoleur' then -- 1.0.19 : la conversion garde le gain de la semaine tel quel
            bt := jtt - case when o.jobs_w = wnow then coalesce((o.jobs->jn->>3)::bigint, 0) else 0 end;
          end if;
          jbase := jbase || jsonb_build_object(jn, bt);
          jgain := greatest(0, jtt - bt); -- une partie revenue en arrière ne gagne rien (et la base ne baisse pas)
          jb := jb || jsonb_build_object(jn, jsonb_build_array(jl, jx, jtt, jgain) || case when jr > 0 then jsonb_build_array(jr) else '[]'::jsonb end);
        else -- partie encore en 1.0.8 (sans xp totale) : niveau seulement, la semaine reprendra au prochain envoi
          jtt := 0; jgain := 0;
          jb := jb || jsonb_build_object(jn, jsonb_build_array(jl, jx));
        end if;
        jg := jgroup->>jn;
        jsum := jsum || jsonb_build_object(jg, jsonb_build_array(
          coalesce((jsum->jg->>0)::bigint, 0) + jl, coalesce((jsum->jg->>1)::bigint, 0) + jx, coalesce((jsum->jg->>2)::bigint, 0) + jtt, coalesce((jsum->jg->>3)::bigint, 0) + jgain,
          coalesce((jsum->jg->>4)::bigint, 0) + jr));
      end if;
    end loop;
    jb := jb || jsum;
  end if;
  if hadrow then
    secs := greatest(60, extract(epoch from (now() - o.updated_at)));
    -- 1.0.25.9 « Vérification plus juste » : 120 niveaux + 15 par minute (avant 60 + 1 par minute : des recrues montées au Sablier
    -- pendant une coupure de connexion de 2 min dépassaient la limite ; une partie retouchée saute toujours de centaines de niveaux)
    if lv - o.level - greatest(0, rc - o.rec) - (o.mtl = 0)::int * mtv > 120 + secs / 4 then reason := format('+%s niveaux en %s min', lv - o.level, round(secs / 60));
    elsif al - o.album > 10 + secs / 300 then reason := format('+%s âmes en %s min', al - o.album, round(secs / 60));
    elsif pt + 120 < o.playtime then reason := 'temps de jeu en baisse';
    end if;
    -- 1.0.8 : un métier qui gagne plus de 60 niveaux en moins de 10 minutes (seulement si le serveur connaissait déjà les métiers)
    -- (1.0.9 : seulement l'artisanat ; la récolte et la forgemagie montent bien moins vite et ne gagnent pas de « Premier »)
    -- (1.0.12.1 « Artisanat haut niveau » : environ 10 fabrications par niveau, une réserve de ressources peut faire 60 niveaux d'un coup : seuil à 120)
    -- (1.0.19 « Métiers comme dans DOFUS » : environ 3 fabrications par niveau pour les métiers d'objets : seuil à 150 ; rien pour l'envoi de la conversion)
    if reason is null and secs < 600 and o.jobs <> '{}'::jsonb and not conv then
      select format('%s : +%s niveaux en %s min', jnames->>k, (jb->k->>0)::int - (o.jobs->k->>0)::int, round(secs / 60)) into reason
      from jsonb_object_keys(jnames) k
      where jsonb_typeof(jb->k) = 'array' and jsonb_typeof(o.jobs->k) = 'array' and (jb->k->>0)::int - (o.jobs->k->>0)::int > 150
        and coalesce((jb->k->>4)::int, 0) = 0 limit 1; -- 1.0.25 : un métier qui a renu remonte bien plus vite (+30 % d'XP par renaissance)
    end if;
  elsif lv > 400 and pt < 3600 then reason := 'niveau trop élevé pour le temps de jeu';
  end if;
  if coalesce((m->>'panel')::boolean, false) then reason := 'panel de test utilisé dans cette partie'; end if;
  if hadrow and o.verified then reason := null; end if; -- 1.0.32.11 : vérifié par Mathis, il reste dans les classements
  hide := reason is not null and coalesce((m->>'panel')::boolean, false) and exists (select 1 from public.admins a where a.user_id = new.user_id); -- 1.0.32.13
  insert into s1.ladder (user_id, main, level, album, succes, playtime, heroes, flagged, suspect, flag_reason, updated_at, main_lvl, title, dofus, rec, pts, qstep, qstep_at, jobs, jobs_w, jobs_base, jobs_prev, jobs_pw, jobs_cobj, mtl)
    values (new.user_id, m->>'main', lv, al, su, pt, coalesce(m->'heroes', '[]'::jsonb), hide, reason is not null and not hide, reason, now(),
      coalesce((m->>'mainLvl')::int, 1), left(m->>'title', 40), coalesce(m->'dofus', '[]'::jsonb), rc, ps, qs, now(), jb,
      case when jb = '{}'::jsonb then 0 else wnow end, case when jb = '{}'::jsonb then '{}'::jsonb else jbase end, jprev, jpw, cobj, mtv)
    on conflict (user_id) do update set main = excluded.main, level = excluded.level, album = excluded.album, succes = excluded.succes,
      playtime = excluded.playtime, heroes = excluded.heroes, updated_at = now(), main_lvl = excluded.main_lvl, title = excluded.title, dofus = excluded.dofus, rec = excluded.rec, pts = excluded.pts, mtl = excluded.mtl,
      jobs = case when excluded.jobs = '{}'::jsonb then s1.ladder.jobs else excluded.jobs end,
      jobs_w = case when excluded.jobs = '{}'::jsonb then s1.ladder.jobs_w else excluded.jobs_w end,
      jobs_base = case when excluded.jobs = '{}'::jsonb then s1.ladder.jobs_base else excluded.jobs_base end,
      jobs_prev = case when excluded.jobs = '{}'::jsonb then s1.ladder.jobs_prev else excluded.jobs_prev end,
      jobs_pw = case when excluded.jobs = '{}'::jsonb then s1.ladder.jobs_pw else excluded.jobs_pw end,
      jobs_cobj = greatest(s1.ladder.jobs_cobj, excluded.jobs_cobj),
      qstep = excluded.qstep, qstep_at = case when excluded.qstep > s1.ladder.qstep or s1.ladder.qstep_at is null then now() else s1.ladder.qstep_at end,
      flagged = s1.ladder.flagged or excluded.flagged, suspect = s1.ladder.suspect or excluded.suspect, flag_reason = coalesce(s1.ladder.flag_reason, excluded.flag_reason);
  select flagged or suspect into bad from s1.ladder where user_id = new.user_id; -- 1.0.32.13 : pas de « Premier » tant que Mathis n'a pas regardé
  delete from s1.ladder_class where user_id = new.user_id;
  insert into s1.ladder_class (user_id, cls, score)
    select new.user_id, x->>'cls', max(coalesce((x->>'lvl')::int, 0) + 200 * coalesce((x->>'ren')::int, 0) + least(greatest(coalesce((x->>'mt')::int, 0), 0), 100000)) -- 2.1.12 : + Maîtrise
    from jsonb_array_elements(coalesce(m->'heroes', '[]'::jsonb)) x where x->>'cls' is not null group by x->>'cls';
  if not bad and coalesce((m->>'lvl200')::boolean, false) then
    insert into s1.firsts (kind, key, label, user_id, pseudo)
      select 'lvl200', '', 'Premier héros au niveau 200', new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
      on conflict do nothing;
  end if;
  -- 1.0.8 : le premier compte au niveau 200 de chaque métier d'artisanat (titre « Grand … » dans le jeu).
  -- 1.0.9 : seulement en y arrivant : le serveur doit avoir vu ce métier sous le niveau 200 (pas de « Premier » pour un compte
  -- déjà au niveau 200 avant la 1.0.8, ni pour la récolte et la forgemagie) ; 1.0.19 : ni par la conversion des niveaux (conv)
  if not bad and hadrow and not conv then
    insert into s1.firsts (kind, key, label, user_id, pseudo)
      select 'job200', k, format('Premier %s au niveau 200', jnames->>k), new.user_id, p.pseudo
      from jsonb_object_keys(jnames) k cross join public.profiles p
      where p.id = new.user_id and jsonb_typeof(jb->k) = 'array' and (jb->k->>0)::int >= 200 and coalesce((jb->k->>4)::int, 0) = 0
        and jsonb_typeof(o.jobs->k) = 'array' and (o.jobs->k->>0)::int < 200 and coalesce((o.jobs->k->>4)::int, 0) = 0 -- 1.0.25 : pas en remontant après une renaissance
      on conflict do nothing;
    -- 1.0.9 : Grand Maître artisan : le premier compte avec les 7 métiers d'artisanat au niveau 200 (en y arrivant)
    if (select count(*) from jsonb_object_keys(jnames) k where jsonb_typeof(jb->k) = 'array' and (jb->k->>0)::int >= 200) = 7
       and (select count(*) from jsonb_object_keys(jnames) k where jsonb_typeof(o.jobs->k) = 'array' and (o.jobs->k->>0)::int >= 200) < 7
       and (select count(*) from jsonb_object_keys(jnames) k where jsonb_typeof(o.jobs->k) = 'array') = 7 then
      insert into s1.firsts (kind, key, label, user_id, pseudo)
        select 'job200all', '', 'Premier Grand Maître artisan : les 7 métiers d''artisanat au niveau 200', new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  -- 1.0 : course de lancement : les 10 premiers comptes à finir la quête principale après la sortie (13/10/2026, 16 h Paris)
  if not bad and coalesce((m->>'mainq')::boolean, false) and now() >= timestamptz '2026-10-13 14:00:00+00'
     and not exists (select 1 from s1.firsts where kind = 'race10' and user_id = new.user_id) then
    select count(*) into rk from s1.firsts where kind = 'race10';
    if rk < 10 then
      insert into s1.firsts (kind, key, label, user_id, pseudo)
        select 'race10', (rk + 1)::text, format('Course de lancement de la 1.0 : n° %s sur 10', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  -- 1.1 : les 10 premiers comptes à réunir les 4 Dofus de la 1.1 (Alliances, Trool, Onirique, Idlus) gagnent l'ornement « Gardien de la 1.1 »
  if not bad and jsonb_typeof(m->'dofus') = 'array' and (m->'dofus') ?& array['alliances', 'trool', 'onirique', 'idlus']
     and not exists (select 1 from s1.firsts where kind = 'gardien11' and user_id = new.user_id) then
    select count(*) into rk from s1.firsts where kind = 'gardien11';
    if rk < 10 then
      insert into s1.firsts (kind, key, label, user_id, pseudo)
        select 'gardien11', (rk + 1)::text, format('Gardiens de la 1.1 : n° %s sur 10 à réunir les 4 Dofus', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  -- 1.1 : course de lancement de la 1.1 : les 10 premiers comptes à l'étage 100 de L'Ascension en Difficile (titre « Légende de la 1.1 »)
  if not bad and coalesce((m->>'ascd100')::boolean, false)
     and not exists (select 1 from s1.firsts where kind = 'race11' and user_id = new.user_id) then
    select count(*) into rk from s1.firsts where kind = 'race11';
    if rk < 10 then
      insert into s1.firsts (kind, key, label, user_id, pseudo)
        select 'race11', (rk + 1)::text, format('Course de lancement de la 1.1 (L''Ascension) : n° %s sur 10', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists saves_ladder on s1.saves;
drop trigger if exists saves_ladder on s1.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_ladder after insert or update on s1.saves_ok for each row execute function s1.ladder_from_save();

-- ---------- panneau de test : joueurs « en vérification » ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = s1, public
  as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to authenticated;
create or replace function s1.admin_flagged()
returns table (user_id uuid, pseudo text, reason text, level int, updated_at timestamptz)
language sql security definer set search_path = s1, public
as $$ select l.user_id, p.pseudo, l.flag_reason, l.level, l.updated_at from s1.ladder l join public.profiles p on p.id = l.user_id
      where (l.flagged or l.suspect) and public.is_admin() order by l.updated_at desc $$;
create or replace function s1.admin_unflag(p_user uuid)
returns void language plpgsql security definer set search_path = s1, public
as $$ begin if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  update s1.ladder set flagged = false, suspect = false, flag_reason = null, verified = true where user_id = p_user;
  update s1.saves_ok set accept = true where user_id = p_user; end $$; -- 2.1.4 : la partie que le bouclier retenait est acceptée à son prochain envoi
create or replace function s1.admin_flag(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = s1, public
as $$ begin if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  update s1.ladder set flagged = true, suspect = false, flag_reason = coalesce(p_reason, 'décision de Mathis'), verified = false where user_id = p_user; end $$;
revoke all on function s1.admin_flagged(), s1.admin_unflag(uuid), s1.admin_flag(uuid, text) from public, anon;
grant execute on function s1.admin_flagged(), s1.admin_unflag(uuid), s1.admin_flag(uuid, text) to authenticated;

-- ---------- 2.1.4 « Bouclier du serveur » : ce que le panel Xener montre et permet (choix 2A 3A 4A) ----------
-- bouclier_signal : appelé par la fonction serveur « record » quand une partie envoyée est refusée. Le compte devient
-- « suspect » (il reste classé sur sa dernière partie validée, ses échanges sont en pause) ; seul Mathis décide ensuite.
create or replace function s1.bouclier_signal(p_user uuid, p_why text) returns void language plpgsql security definer set search_path = s1, public
as $$ begin
  insert into s1.ladder (user_id, suspect, flag_reason) values (p_user, true, 'Bouclier : ' || left(p_why, 200))
    on conflict (user_id) do update set suspect = true, flag_reason = case when s1.ladder.flag_reason like 'Bouclier : %' or s1.ladder.flag_reason is null then excluded.flag_reason else s1.ladder.flag_reason end
    where not s1.ladder.flagged;
end $$;
revoke all on function s1.bouclier_signal(uuid, text) from public, anon, authenticated;
grant execute on function s1.bouclier_signal(uuid, text) to service_role;
-- Fiche d'un compte pour le panel : raisons du bouclier, copies des 7 derniers jours, ventes et échanges de la semaine.
create or replace function s1.adm_bouclier(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$ begin
  if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  return jsonb_build_object(
    'log', (select coalesce(jsonb_agg(jsonb_build_object('why', why, 'at', at) order by at desc), '[]'::jsonb) from (select why, at from bouclier_log where user_id = p_user order by at desc limit 10) x),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'lvl', lvl, 'kamas', kamas, 'at', at) order by day desc), '[]'::jsonb) from saves_jour where user_id = p_user),
    'held', (select s.updated_at is distinct from o.src_at from saves s left join saves_ok o on o.user_id = s.user_id where s.user_id = p_user),
    'okAt', (select src_at from saves_ok where user_id = p_user),
    'sold', (select coalesce(jsonb_agg(jsonb_build_object('to', pseudo, 'n', n, 'k', k)), '[]'::jsonb) from (
      select coalesce(p.pseudo, '?') pseudo, count(*) n, sum(x.price) k from hdv_sales x left join profiles p on p.id = x.buyer
      where x.seller = p_user and x.at > now() - interval '7 days' group by p.pseudo order by sum(x.price) desc limit 10) y),
    'trades', (select count(*) from trades where (a = p_user or b = p_user) and status = 'done' and created_at > now() - interval '7 days'));
end $$;
-- Remettre la partie d'un joueur à la copie d'un jour : sa partie en ligne et sa partie validée reprennent cette copie
-- (son appareil lui demandera quelle version garder ; s'il garde l'autre, le bouclier la retiendra de nouveau).
create or replace function s1.adm_save_restore(p_user uuid, p_day date) returns text language plpgsql security definer set search_path = s1, public
as $$ declare d text; t timestamptz;
begin
  if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  select data into d from saves_jour where user_id = p_user and day = p_day;
  if d is null then return 'Pas de copie ce jour-là.'; end if;
  update saves set data = d, meta = meta || jsonb_build_object('remise', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')), updated_at = clock_timestamp() where user_id = p_user returning updated_at into t; -- remise imposée (push_save)
  update saves_ok set data = d, src_at = t, bilan = null, accept = false, at = now() where user_id = p_user;
  perform public.alog(format('Bouclier : partie de %s remise au %s', (select pseudo from profiles where id = p_user), to_char(p_day, 'DD/MM')));
  return null;
end $$;
revoke all on function s1.adm_bouclier(uuid), s1.adm_save_restore(uuid, date) from public, anon;
grant execute on function s1.adm_bouclier(uuid), s1.adm_save_restore(uuid, date) to authenticated;

-- ---------- 1.0.30 (choix 37A) : GIGA annonce d'un Dofus ----------
-- Un Dofus tombé sur un boss s'annonce en plein écran chez tous les joueurs connectés, puis dans le chat Général.
-- La fonction « record » ({ dofus: { uid, did, k } }) vérifie la partie en ligne (le Dofus y est, la stasis est terminée,
-- l'équipe la refait, compte pas « en vérification ») puis écrit ici et dans chat_msgs (kind 'ann', data.t 'giga').
-- Une ligne par exemplaire (uid de l'objet) : jamais deux annonces pour le même Dofus. Invisible pour les joueurs.
create table if not exists s1.dofus_ann (
  user_id uuid not null references auth.users (id) on delete cascade,
  uid bigint not null,
  dofus text not null,
  did text,
  k int,
  at timestamptz not null default now(),
  primary key (user_id, uid)
);
alter table s1.dofus_ann enable row level security; -- aucune règle : seule la fonction serveur (service_role) y touche
create index if not exists dofus_ann_at on s1.dofus_ann (user_id, at desc);

-- ---------- opérations ponctuelles (jouées une seule fois, même si ce fichier est réappliqué) ----------
create table if not exists s1.ops_done (id text primary key, at timestamptz not null default now());
alter table s1.ops_done enable row level security; -- aucune règle : invisible pour les joueurs
-- 1.0.12.1 : « remets à zéro la semaine des métiers » (Mathis, 13/10/2026 23:47 Paris, après le nerf des recettes 1.0.9.2) :
-- la semaine en cours repart de 0 XP pour tout le monde (le point de départ de la semaine devient l'XP totale actuelle).
-- Les niveaux, l'XP totale et la semaine passée ne changent pas.
do $$
declare wnow int := floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
begin
  if not exists (select 1 from s1.ops_done where id = 'raz-semaine-metiers-2026-10-13') then
    update s1.ladder l set
      jobs_base = coalesce((select jsonb_object_agg(j.key, (j.value->>2)::bigint) from jsonb_each(l.jobs) j
        where jsonb_typeof(j.value) = 'array' and j.value->>2 is not null and j.key not like 'tous%'), '{}'::jsonb),
      jobs = coalesce((select jsonb_object_agg(j.key, case when jsonb_typeof(j.value) = 'array' and jsonb_array_length(j.value) >= 4
        then jsonb_set(j.value, '{3}', '0'::jsonb) else j.value end) from jsonb_each(l.jobs) j), '{}'::jsonb)
    where l.jobs_w = wnow;
    insert into s1.ops_done (id) values ('raz-semaine-metiers-2026-10-13');
  end if;
end $$;
-- 1.2.8.x « Nouveau départ des stasis » (Mathis, 15/10/2026, avec les sorts uniques des boss) : les classements des stasis de donjon
-- repartent de zéro pour tout le monde. Avant d'effacer, une copie est gardée dans records_s1 (tous les records) et
-- records_week_s1 (la semaine en cours), invisibles pour les joueurs. Les stasis débloquées, l'équipement, les semaines passées
-- (titre « Maître de la semaine ») et les Premiers gravés ne changent pas. La saison 2 ne compte que les stasis terminées
-- depuis la mise à jour (E.stasisSaison dans js/engine.js, lu par la fonction serveur « record »).
create table if not exists s1.records_s1 (like s1.records including all);
create table if not exists s1.records_week_s1 (like s1.records_week including all);
alter table s1.records_s1 enable row level security; -- aucune règle : archive invisible pour les joueurs
alter table s1.records_week_s1 enable row level security;
do $$
declare wnow int := floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
begin
  if not exists (select 1 from s1.ops_done where id = 'raz-stasis-sorts-des-boss-2026-10-15') then
    insert into s1.records_s1 select * from s1.records on conflict do nothing;
    insert into s1.records_week_s1 select * from s1.records_week where w = wnow on conflict do nothing;
    delete from s1.records;
    delete from s1.records_week where w = wnow;
    insert into s1.ops_done (id) values ('raz-stasis-sorts-des-boss-2026-10-15');
  end if;
end $$;
-- 2.1.38 « Boss ultimes » (Mathis, 22/10/2026 : « reset les classement stasis ») : les stasis 11 à 15 deviennent bien plus dures,
-- les classements des stasis de donjon repartent de zéro (saison 3, E.STASIS_SAISON). Copie gardée dans records_s2 et
-- records_week_s2 (semaine en cours), invisibles pour les joueurs. Stasis débloquées, semaines passées et Premiers gravés gardés.
create table if not exists s1.records_s2 (like s1.records including all);
create table if not exists s1.records_week_s2 (like s1.records_week including all);
alter table s1.records_s2 enable row level security;
alter table s1.records_week_s2 enable row level security;
do $$
declare wnow int := floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
begin
  if not exists (select 1 from s1.ops_done where id = 'raz-stasis-boss-ultimes-2026-10-22') then
    insert into s1.records_s2 select * from s1.records on conflict do nothing;
    insert into s1.records_week_s2 select * from s1.records_week where w = wnow on conflict do nothing;
    delete from s1.records;
    delete from s1.records_week where w = wnow;
    insert into s1.ops_done (id) values ('raz-stasis-boss-ultimes-2026-10-22');
  end if;
end $$;
-- Premiers depuis les sorts des boss : pour chaque donjon, la stasis la plus haute déjà prise (firsts kind « sb », key « donjon:stasis »)
create or replace view s1.lb_first_sb as
  select distinct on (split_part(f.key, ':', 1)) split_part(f.key, ':', 1) as did, split_part(f.key, ':', 2)::int as k, f.pseudo, f.user_id, f.at
  from s1.firsts f where f.kind = 'sb' order by split_part(f.key, ':', 1), split_part(f.key, ':', 2)::int desc;
grant select on s1.lb_first_sb to anon, authenticated;
-- 2.0.4 « Classement sans les vies » (Mathis, 16/10/2026, choix 2A) : la Renaissance est devenue la Maîtrise en 2.0 et le jeu ramène
-- chaque héros rené au niveau 200. Les comptes pas encore reconnectés depuis gardaient niveau + 200 × vies (jusqu'à 2 200 par héros)
-- et restaient devant tout le monde. Une seule fois : leurs héros renés passent à 200 (ren 0), le niveau du compte (8 meilleurs héros)
-- et le score de classe sont plafonnés de la même façon. Rien ne change dans les parties ; les autres comptes ne bougent pas.
do $$
begin
  if not exists (select 1 from s1.ops_done where id = 'classement-sans-vies-2026-10-16') then
    update s1.ladder l set
      heroes = (select coalesce(jsonb_agg(case when coalesce((x->>'ren')::int, 0) > 0 then x || jsonb_build_object('lvl', 200, 'ren', 0) else x end), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(l.heroes) = 'array' then l.heroes else '[]'::jsonb end) x),
      level = (select coalesce(sum(v), 0) from (select case when coalesce((x->>'ren')::int, 0) > 0 then 200 else coalesce((x->>'lvl')::int, 0) end as v
        from jsonb_array_elements(case when jsonb_typeof(l.heroes) = 'array' then l.heroes else '[]'::jsonb end) x order by 1 desc limit 8) t)
    where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(l.heroes) = 'array' then l.heroes else '[]'::jsonb end) x where coalesce((x->>'ren')::int, 0) > 0);
    update s1.ladder_class set score = 200 where score > 200;
    insert into s1.ops_done (id) values ('classement-sans-vies-2026-10-16');
  end if;
end $$;

reset search_path;

-- ======================== supabase/hdv_data.sql ========================
set search_path = s1, public;
-- Généré par tools/build_hdv.js — ne pas modifier à la main.
-- Objets et ressources impossibles à vendre ou à échanger (Dofus, trophées, meubles, idoles).
create table if not exists s1.hdv_block (key text primary key);
alter table s1.hdv_block enable row level security;
drop policy if exists "liste lisible" on s1.hdv_block;
create policy "liste lisible" on s1.hdv_block for select using (true);
delete from s1.hdv_block;
insert into s1.hdv_block (key) values
('trophee_inc_route'),
('trophee_inc_champs'),
('trophee_inc_lac'),
('trophee_inc_paturages'),
('trophee_inc_foret'),
('trophee_inc_mine'),
('trophee_inc_cimetiere'),
('trophee_ast_cite'),
('trophee_ast_souterrains'),
('trophee_ast_prairies'),
('trophee_ast_champs'),
('trophee_ast_calanques'),
('trophee_ast_tainela'),
('trophee_ast_foret'),
('trophee_ast_carrieres'),
('trophee_ast_egouts'),
('trophee_ast_cimetiere'),
('trophee_ast_planque'),
('trophee_ama_campagne'),
('trophee_ama_foret'),
('trophee_ama_bouftous'),
('trophee_ama_boos'),
('trophee_ama_cimetiere'),
('trophee_ama_ingalsse'),
('trophee_ama_gobelins'),
('trophee_ama_bworks'),
('trophee_ama_scarafeuilles'),
('trophee_ama_foret_malefique'),
('trophee_ama_craqueleurs'),
('trophee_ama_cloaque'),
('trophee_ama_gelees'),
('trophee_ama_pitons'),
('trophee_ama_dark_vlad'),
('trophee_can_baie'),
('trophee_can_porkass'),
('trophee_can_champs'),
('trophee_can_lac'),
('trophee_can_massif'),
('trophee_can_plaines'),
('trophee_can_pics'),
('trophee_can_penates'),
('trophee_can_bibliotheque'),
('trophee_can_cirque'),
('trophee_can_landes'),
('trophee_can_dents'),
('trophee_can_kanigs'),
('trophee_wab_cawotte'),
('trophee_wab_couronne'),
('trophee_wab_tombeaux'),
('trophee_wab_waldo'),
('trophee_wab_labos'),
('trophee_sid_desolation'),
('trophee_sid_roulottes'),
('trophee_sid_hurlements'),
('trophee_sid_gisgoul'),
('trophee_sid_fungus'),
('trophee_sid_domaine_fungus'),
('trophee_koa_kaliptus'),
('trophee_koa_lacs'),
('trophee_koa_bordure'),
('trophee_koa_canyon'),
('trophee_koa_pentes'),
('trophee_koa_morhkitu'),
('trophee_koa_cimetiere'),
('trophee_abr_oree'),
('trophee_abr_sombre'),
('trophee_moon_crane'),
('trophee_moon_jungle'),
('trophee_dra_village'),
('trophee_dra_souterrains'),
('trophee_dra_sanctuaire'),
('trophee_oto_tourbiere'),
('trophee_oto_tourbiere2'),
('trophee_oto_plaines'),
('trophee_oto_zoths'),
('trophee_oto_canopee'),
('trophee_oto_jungle'),
('trophee_oto_hakam'),
('trophee_oto_feuillage'),
('trophee_mino_ile'),
('trophee_mino_labyrinthe'),
('trophee_pan_plantala'),
('trophee_pan_akwadala'),
('trophee_pan_terrdala'),
('trophee_pan_feudala'),
('trophee_pan_aerdala'),
('trophee_fri_port'),
('trophee_fri_bourgade'),
('trophee_fri_champs'),
('trophee_fri_pins'),
('trophee_fri_lac'),
('trophee_fri_berceau'),
('trophee_fri_larmes'),
('trophee_fri_village'),
('trophee_fri_crevasse'),
('trophee_fri_petrifiee'),
('trophee_fri_crocs'),
('trophee_fri_torrideau'),
('trophee_fri_ruche'),
('trophee_sah_cacterre'),
('trophee_sah_gorge'),
('trophee_sah_cite'),
('trophee_sah_pyramide'),
('trophee_pwak_jardins'),
('trophee_sram_ruelles'),
('trophee_enu_carriere'),
('trophee_eca_lande'),
('trophee_xel_present'),
('trophee_osa_toorbz'),
('trophee_sram_catacombres'),
('trophee_enu_retraite'),
('trophee_sram_hauts'),
('trophee_xel_lendemains'),
('trophee_eca_temple'),
('trophee_grobe_cimetiere'),
('trophee_grobe_mont'),
('trophee_sak_plaine'),
('trophee_sak_foret'),
('trophee_val_ereboria'),
('trophee_nimotopia'),
('trophee_obs_dimension'),
('trophee_har_jardins'),
('trophee_har_remparts'),
('trophee_har_tannerie'),
('trophee_har_bastion'),
('trophee_har_clepsydre'),
('trophee_har_caserne'),
('trophee_suf_embruns'),
('dofus_cacao'),
('dofus_cawotte'),
('dofus_dokoko'),
('dofus_kaliptus'),
('dofus_emeraude'),
('dofus_dolmanax'),
('dofus_pourpre'),
('dofus_dotruche'),
('dofus_domakuro'),
('dofus_turquoise'),
('dofus_ocre'),
('dofus_vulbis'),
('dofus_ivoire'),
('dofus_ebene'),
('dofus_glaces'),
('dofus_sylvestre'),
('dofus_argente'),
('dofus_cauchemar'),
('Baguette Rikiki'),
('Coffre en frêne'),
('Arrosoir de Cania'),
('Étagère de grimoires'),
('Lit à baldaquin'),
('Coffre en merisier'),
('Mangeoire'),
('Abreuvoir'),
('Idole Hebdo'),
('Idole Payo'),
('Idole Muta'),
('Idole Walet'),
('Idole Dynamo'),
('Idole Brouce'),
('Idole Kaminara'),
('Idole Hurzz'),
('Idole Tynril'),
('Idole Gakri'),
('Idole Kori'),
('Idole Djim'),
('Idole Farle'),
('Idole Serpi'),
('Idole Nahuss'),
('Idole Sakai'),
('Idole Nocturne'),
('Idole Minor'),
('Idole Major'),
('Idole Kyoub'),
('Idole Dokoko'),
('Idole Nehik'),
('Idole Pluvior'),
('Idole Jiva'),
('Idole Bihilete'),
('Idole Abdinde'),
('Idole Chokwa'),
('Idole Ougah'),
('Idole Croum'),
('Idole Gilimin'),
('Idole Garu'),
('Idole Dinam'),
('Idole Hadibel'),
('Idole Yushe'),
('Idole Jewai'),
('Idole Tigel');

reset search_path;

-- ======================== supabase/hdv.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — hôtel de vente et échanges entre joueurs (multijoueur, étape 4).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger.
--
-- Principe : la partie reste sur l'appareil et part en ligne toutes les 30 s (saves.data).
-- Chaque mouvement de l'hôtel de vente est une « opération » (hdv_ops) que le jeu applique
-- à la partie, dans l'ordre, puis note le numéro de la dernière appliquée (S.hdv.op).
-- Pour vérifier qu'un joueur possède bien ce qu'il vend ou les kamas qu'il dépense, le
-- serveur part de sa dernière partie en ligne et y ajoute les opérations qu'elle ne
-- contient pas encore. Un objet mis en vente est copié depuis la partie en ligne (le jeu
-- ne peut pas inventer ses caractéristiques) et quitte la partie du vendeur.
-- Le jeu ne touche jamais les tables : tout passe par les fonctions ci-dessous.
-- ============================================================================

create table if not exists s1.hdv_listings (
  id bigint generated always as identity primary key,
  seller uuid not null references auth.users (id) on delete cascade,
  cat text not null check (cat in ('eq', 'res', 'rune', 'cons')),
  key text not null,              -- modèle d'objet (eq) ou nom de la ressource / rune / consommable
  name text not null,
  lvl int not null default 0,
  slot text,
  qty int not null default 1,     -- taille du lot (1, 10 ou 100 ; 1 pour un équipement)
  price bigint not null,          -- prix du lot
  item jsonb,                     -- l'objet exact (jet, forgemagie, Rayonnant) pour un équipement
  status text not null default 'open' check (status in ('open', 'sold', 'gone')),
  buyer uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  closed_at timestamptz
);
-- 2.1.30 « Marché des bêtes » : montures (mt) et familiers (pet) ; item = la bête exacte (niveau, étoiles, capacité…)
alter table s1.hdv_listings drop constraint if exists hdv_listings_cat_check;
-- 2.2.11 « Bourse aux cartes » : cartes de collection (card, clé = id de la carte, « * » au bout pour la brillante, lots de 1)
alter table s1.hdv_listings add constraint hdv_listings_cat_check check (cat in ('eq', 'res', 'rune', 'cons', 'mt', 'pet', 'card'));
create index if not exists hdv_open_key on s1.hdv_listings (key, price) where status = 'open';
create index if not exists hdv_open_cat on s1.hdv_listings (cat, lvl) where status = 'open';
create index if not exists hdv_seller on s1.hdv_listings (seller, status);
create index if not exists hdv_expire on s1.hdv_listings (expires_at) where status = 'open';
alter table s1.hdv_listings enable row level security;

create table if not exists s1.hdv_ops (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,         -- { k: kamas, res|runes|cons: {nom: quantité}, rm: [uid], add: [objet], rmM|rmP: [uid], addM|addP: [bête] }
  txt text,
  at timestamptz not null default now()
);
create index if not exists hdv_ops_user on s1.hdv_ops (user_id, id);
alter table s1.hdv_ops enable row level security;

create table if not exists s1.hdv_sales (
  id bigint generated always as identity primary key,
  key text not null, cat text not null, name text, qty int not null, price bigint not null,
  seller uuid, buyer uuid,
  at timestamptz not null default now()
);
create index if not exists hdv_sales_key on s1.hdv_sales (key, at);
alter table s1.hdv_sales enable row level security;

create table if not exists s1.trades (
  id bigint generated always as identity primary key,
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  offer_a jsonb not null default '{}'::jsonb,
  offer_b jsonb not null default '{}'::jsonb,
  ok_a boolean not null default false,
  ok_b boolean not null default false,
  ver int not null default 0,
  status text not null default 'open' check (status in ('open', 'done', 'cancel')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trades_a on s1.trades (a, status);
create index if not exists trades_b on s1.trades (b, status);
alter table s1.trades enable row level security;

-- ---------- outils internes ----------
create or replace function s1.hdv_err(t text) returns jsonb language sql immutable as $$ select jsonb_build_object('err', t) $$;

-- Idlus 3.0 (2B de Mathis, 12/11/2026 : « on enlève définitivement l'hdv ») : l'Hôtel de vente ferme. supabase/hdv_fermeture.sql
-- pose le drapeau, rend les annonces ouvertes à leurs vendeurs et les kamas des offres d'achat ; ensuite plus de mise en vente,
-- d'achat, de nouveau prix ni d'offre d'achat. Les échanges entre joueurs (trade_*) et le Cours des ressources restent.
create table if not exists s1.hdv_ferme (id int primary key default 1 check (id = 1), at timestamptz not null default now());
alter table s1.hdv_ferme enable row level security;
create or replace function s1.hdv_closed() returns boolean language sql stable security definer set search_path = s1, public as $$ select exists (select 1 from hdv_ferme) $$;

-- Partie en ligne d'un joueur autorisé à échanger, sinon une erreur lisible.
create or replace function s1.hdv_save(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$
declare d jsonb;
begin
  if p_user is null then raise exception 'Connecte-toi pour utiliser l''hôtel de vente.'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'Choisis d''abord ton pseudo.'; end if;
  if public.susp(p_user) then raise exception 'Compte suspendu.'; end if;
  -- 2.1.4 « Bouclier du serveur » (choix 3A) : un compte suspect a aussi ses échanges en pause, et l'hôtel de vente part de la
  -- dernière partie validée par le serveur (saves_ok, schema.sql), plus de la partie envoyée telle quelle
  if exists (select 1 from ladder where user_id = p_user and (flagged or suspect)) then raise exception 'Ta partie est en vérification : les échanges sont bloqués en attendant.'; end if;
  select data::jsonb into d from saves_ok where user_id = p_user;
  if d is null then raise exception 'Ta partie n''est pas encore en ligne : attends quelques secondes.'; end if;
  if coalesce((d->>'panelUsed')::boolean, false) then raise exception 'Partie retouchée par le panel de test : tu peux regarder, mais pas vendre ni acheter.'; end if;
  return d;
end $$;

create or replace function s1.hdv_cursor(d jsonb) returns bigint language sql immutable as $$ select coalesce((d->'hdv'->>'op')::bigint, 0) $$;

-- Kamas réels : partie en ligne + opérations pas encore dedans.
create or replace function s1.hdv_kamas(p_user uuid, d jsonb) returns numeric language sql stable security definer set search_path = s1, public
as $$ select coalesce((d->>'kamas')::numeric, 0) + coalesce((select sum((o.payload->>'k')::numeric) from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d)), 0) $$;

-- Quantité réelle d'une ressource ('res'), rune ('runes') ou consommable ('cons').
create or replace function s1.hdv_qty(p_user uuid, d jsonb, b text, k text) returns numeric language sql stable security definer set search_path = s1, public
as $$ select coalesce((d->b->>k)::numeric, 0) + coalesce((select sum((o.payload->b->>k)::numeric) from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d)), 0) $$;

create or replace function s1.hdv_bucket(c text) returns text language sql immutable as $$ select case c when 'res' then 'res' when 'rune' then 'runes' when 'cons' then 'cons' when 'card' then 'cards' end $$;

-- Objet échangeable ? Renvoie l'objet (sans uid) ou lève une erreur.
create or replace function s1.hdv_item(p_user uuid, d jsonb, p_uid bigint) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$
declare it jsonb;
begin
  it := d->'items'->(p_uid::text);
  if it is null then raise exception 'Objet introuvable dans ta partie en ligne : attends quelques secondes et réessaie.'; end if;
  if exists (select 1 from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d) and o.payload->'rm' @> to_jsonb(array[p_uid])) then raise exception 'Cet objet n''est plus dans ton sac.'; end if;
  if coalesce((it->>'locked')::boolean, false) then raise exception 'Objet verrouillé : déverrouille-le d''abord.'; end if;
  if exists (select 1 from hdv_block where key = it->>'tpl') then raise exception 'Les Dofus et les trophées ne s''échangent pas.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c, jsonb_each_text(coalesce(c->'equip', '{}'::jsonb)) e where e.value = p_uid::text) then raise exception 'Objet équipé : retire-le d''abord.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c, jsonb_array_elements(coalesce(c->'gear', '[]'::jsonb)) g, jsonb_each_text(coalesce(g->'eq', '{}'::jsonb)) e where e.value = p_uid::text) then raise exception 'Objet utilisé dans un équipement enregistré : retire-le d''abord.'; end if;
  return it - 'uid';
end $$;

-- Nombre positif lu dans un texte, sinon null (sans erreur de conversion).
create or replace function s1.hdv_num(t text) returns numeric language sql immutable as $$ select case when t ~ '^\d{1,12}(\.\d{1,12})?$' then t::numeric end $$;

-- 2.2.11 « Bourse aux cartes » (Mathis 2A 4A) : doubles d'une carte qu'on peut céder (le dernier exemplaire reste dans l'album),
-- lus dans la partie de saison validée (s1c.cards.o, ou .b pour la brillante « id* ») plus les opérations pas encore dedans.
create or replace function s1.hdv_card_qty(p_user uuid, d jsonb, k text) returns numeric language sql stable security definer set search_path = s1, public
as $$ select greatest(0, coalesce(hdv_num(case when k like '%*' then d->'s1c'->'cards'->'b'->>left(k, -1) else d->'s1c'->'cards'->'o'->>k end), 0)
  + coalesce((select sum((o.payload->'cards'->>k)::numeric) from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d)), 0) - 1) $$;
-- Les cartes s'échangent depuis la partie de saison, après 7 boosters ouverts (4A : pas de compte « réserve » créé la veille). Null si permis.
create or replace function s1.hdv_card_lock(d jsonb) returns text language sql immutable
as $$ select case when d->'s1c'->'cards' is null then 'Les cartes s''échangent depuis la partie de saison.'
  when coalesce(hdv_num(d->'s1c'->'cards'->>'nb'), 0) < 7 then 'Les cartes s''échangent après 7 boosters ouverts dans la partie (ou la sauvegarde en ligne n''est pas encore à jour).' end $$;

-- 2.1.30 : monture ou familier échangeable ? Renvoie la bête (sans uid) ou lève une erreur.
-- Une bête déjà sortie de la partie (vendue, échangée) ne repart jamais, même si une vieille partie la contient encore.
create or replace function s1.hdv_beast(p_user uuid, d jsonb, p_cat text, p_uid bigint) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$
declare b jsonb; u text := p_uid::text;
begin
  b := case p_cat when 'mt' then d->'mounts'->u when 'pet' then d->'pets'->u end;
  if b is null or jsonb_typeof(b) <> 'object' then raise exception '% introuvable dans ta partie en ligne : attends quelques secondes et réessaie.', case p_cat when 'mt' then 'Monture' else 'Familier' end; end if;
  if exists (select 1 from hdv_ops o where o.user_id = p_user and o.payload->(case p_cat when 'mt' then 'rmM' else 'rmP' end) @> to_jsonb(array[p_uid])) then raise exception 'Cette bête n''est plus à toi.'; end if;
  if p_cat = 'mt' then
    if exists (select 1 from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c where c->>'mount' = u) then raise exception 'Monture montée : descends d''abord.'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(d->'enclos'->'pairs', '[]'::jsonb)) x where x->>'a' = u or x->>'b' = u) then raise exception 'Monture à l''enclos : annule d''abord le couple.'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(d->'elev'->'bal', '[]'::jsonb)) x where x->>'uid' = u) then raise exception 'Monture en balade : attends son retour.'; end if;
    if coalesce(b->>'sp', '') not in ('dd', 'mu', 'vk') or coalesce(b->>'c', '') = '' or coalesce(hdv_num(coalesce(b->>'lvl', '1')), 999) > 100
      or coalesce(hdv_num(coalesce(b->>'st', '1')), 99) > 7 then raise exception 'Monture illisible : elle ne peut pas être vendue.'; end if;
    return b - 'uid' - 'nm' - 'res' - 'got';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c where c->>'pet' = u) then raise exception 'Familier porté : retire-le d''abord.'; end if;
  if b->>'id' = 'chacha_dore' then raise exception 'Le Chacha Doré ne s''échange pas.'; end if;
  if coalesce(b->>'id', '') = '' or coalesce(hdv_num(coalesce(b->>'st', '0')), 99) > 5 or coalesce(hdv_num(coalesce(b->>'g', '1')), 999) > 100 then raise exception 'Familier illisible : il ne peut pas être vendu.'; end if;
  return b - 'uid' - 'got' - 'skin';
end $$;
-- 04/11 (fil « Fermer les failles de triche ») : outil interne des échanges, plus appelable depuis le jeu ou sans compte
revoke all on function s1.hdv_beast(uuid, jsonb, text, bigint) from public, anon, authenticated;

create or replace function s1.hdv_op(p_user uuid, p jsonb, t text) returns void language sql security definer set search_path = s1, public
as $$ insert into hdv_ops (user_id, payload, txt) values (p_user, p, t) $$;

create or replace function s1.hdv_ops_after(p_user uuid, p_after bigint) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(jsonb_build_object('id', id, 'p', payload, 't', txt) order by id), '[]'::jsonb) from (select * from hdv_ops where user_id = p_user and id > coalesce(p_after, 0) order by id limit 300) o $$;

create or replace function s1.hdv_back(L hdv_listings) returns jsonb language sql immutable
as $$ select case when L.cat = 'eq' then jsonb_build_object('add', jsonb_build_array(L.item)) when L.cat = 'mt' then jsonb_build_object('addM', jsonb_build_array(L.item))
  when L.cat = 'pet' then jsonb_build_object('addP', jsonb_build_array(L.item)) else jsonb_build_object(hdv_bucket(L.cat), jsonb_build_object(L.key, L.qty)) end $$;
-- 2.1.30 : ce que reçoit l'acheteur ; une bête achetée est marquée b (5B : elle ne compte ni au carnet de l'éleveur ni à l'album)
create or replace function s1.hdv_buyer(L hdv_listings) returns jsonb language sql immutable
as $$ select case when L.cat in ('mt', 'pet') then jsonb_build_object(case L.cat when 'mt' then 'addM' else 'addP' end, jsonb_build_array(L.item || '{"b": 1}'::jsonb)) else hdv_back(L) end $$;

-- Annonces expirées : l'objet revient au vendeur.
create or replace function s1.hdv_expire() returns void language plpgsql security definer set search_path = s1, public
as $$
declare L hdv_listings;
begin
  for L in update hdv_listings set status = 'gone', closed_at = now() where id in (select id from hdv_listings where status = 'open' and expires_at < now() limit 200) returning * loop
    perform hdv_op(L.seller, hdv_back(L), 'Annonce expirée, revenue dans ton sac : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  end loop;
end $$;

create or replace function s1.hdv_tax(p bigint) returns bigint language sql immutable as $$ select greatest(1, ceil(p * 0.02))::bigint $$;

-- ---------- fonctions appelées par le jeu ----------
create or replace function s1.hdv_sync(p_after bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$ begin
  if auth.uid() is null then return hdv_err('non connecté'); end if;
  perform hdv_expire();
  perform hdv_order_expire();
  return jsonb_build_object('ops', hdv_ops_after(auth.uid(), p_after));
end $$;

create or replace function s1.hdv_list(p_after bigint, p_cat text, p_key text, p_uid bigint, p_lot int, p_n int, p_price bigint, p_name text, p_lvl int, p_slot text)
returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; it jsonb; b text; tax bigint; n int := greatest(1, coalesce(p_n, 1)); tpl text;
begin
  if hdv_closed() then return hdv_err('L''Hôtel de vente a fermé avec Idlus 3.0 : tes annonces et tes kamas t''ont été rendus.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if p_price is null or p_price < 1 or p_price > 2000000000 then return hdv_err('Prix invalide.'); end if;
  if n > 20 then return hdv_err('20 lots au maximum d''un coup.'); end if;
  if (select count(*) from hdv_listings where seller = me and status = 'open') + n > 20 then return hdv_err('Plus de place : 20 ventes à la fois au maximum.'); end if;
  tax := hdv_tax(p_price);
  if hdv_kamas(me, d) < tax * n then return hdv_err('Pas assez de kamas pour la taxe de mise en vente.'); end if;
  if p_cat = 'eq' then
    begin it := hdv_item(me, d, p_uid); exception when raise_exception then return hdv_err(sqlerrm); end;
    tpl := it->>'tpl';
    insert into hdv_listings (seller, cat, key, name, lvl, slot, qty, price, item) values (me, 'eq', tpl, left(coalesce(p_name, tpl), 80), coalesce(p_lvl, 0), left(p_slot, 20), 1, p_price, it);
    perform hdv_op(me, jsonb_build_object('k', -tax, 'rm', jsonb_build_array(p_uid)), 'Mis en vente : ' || coalesce(p_name, tpl));
  elsif p_cat in ('res', 'rune', 'cons') then
    b := hdv_bucket(p_cat);
    if p_lot not in (1, 10, 100) then return hdv_err('Lots de 1, 10 ou 100.'); end if;
    if p_key is null or exists (select 1 from hdv_block where key = p_key) then return hdv_err('Cette ressource ne s''échange pas.'); end if;
    if hdv_qty(me, d, b, p_key) < p_lot * n then return hdv_err('Tu n''en as pas assez (ou la sauvegarde en ligne n''est pas encore à jour).'); end if;
    insert into hdv_listings (seller, cat, key, name, lvl, slot, qty, price) select me, p_cat, p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), p_lot, p_price from generate_series(1, n);
    perform hdv_op(me, jsonb_build_object('k', -tax * n, b, jsonb_build_object(p_key, -p_lot * n)), 'Mis en vente : ' || n || ' × ' || p_key || ' ×' || p_lot);
  elsif p_cat = 'card' then -- 2.2.11 « Bourse aux cartes »
    if p_key is null or p_key !~ '^[a-z0-9_]{1,48}[*]?$' then return hdv_err('Carte inconnue.'); end if;
    if hdv_card_lock(d) is not null then return hdv_err(hdv_card_lock(d)); end if;
    if hdv_card_qty(me, d, p_key) < n then return hdv_err('Pas assez de doubles de cette carte : le dernier exemplaire reste dans l''album (ou la sauvegarde en ligne n''est pas encore à jour).'); end if;
    insert into hdv_listings (seller, cat, key, name, lvl, slot, qty, price) select me, 'card', p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), 1, p_price from generate_series(1, n);
    perform hdv_op(me, jsonb_build_object('k', -tax * n, 'cards', jsonb_build_object(p_key, -n)), 'Mis en vente : ' || case when n > 1 then n || ' × ' else '' end || coalesce(p_name, p_key));
  elsif p_cat in ('mt', 'pet') then
    begin it := hdv_beast(me, d, p_cat, p_uid); exception when raise_exception then return hdv_err(sqlerrm); end;
    tpl := case p_cat when 'mt' then (it->>'sp') || ':' || (it->>'c') else it->>'id' end;
    insert into hdv_listings (seller, cat, key, name, lvl, slot, qty, price, item) values (me, p_cat, tpl, left(coalesce(p_name, tpl), 80),
      round(coalesce((it->>(case p_cat when 'mt' then 'lvl' else 'g' end))::numeric, 1))::int, case p_cat when 'mt' then it->>'sp' else left(p_slot, 20) end, 1, p_price, it);
    perform hdv_op(me, jsonb_build_object('k', -tax, case p_cat when 'mt' then 'rmM' else 'rmP' end, jsonb_build_array(p_uid)), 'Mis en vente : ' || coalesce(p_name, tpl));
  else return hdv_err('Catégorie inconnue.');
  end if;
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function s1.hdv_buy(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; L hdv_listings; who text;
begin
  if hdv_closed() then return hdv_err('L''Hôtel de vente a fermé avec Idlus 3.0 : tes annonces et tes kamas t''ont été rendus.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into L from hdv_listings where id = p_id for update;
  if L.id is null or L.status <> 'open' or L.expires_at < now() then return hdv_err('Trop tard : quelqu''un l''a déjà acheté ou l''annonce est terminée.'); end if;
  if L.seller = me then return hdv_err('C''est ta propre annonce.'); end if;
  if hdv_kamas(me, d) < L.price then return hdv_err('Pas assez de kamas.'); end if;
  update hdv_listings set status = 'sold', buyer = me, closed_at = now() where id = L.id;
  who := coalesce(pseudo_of(me), 'un joueur');
  perform hdv_op(me, hdv_buyer(L) || jsonb_build_object('k', -L.price), 'Acheté : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  perform hdv_op(L.seller, jsonb_build_object('k', L.price, 'sold', L.id), 'Vendu à ' || who || ' : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  insert into hdv_sales (key, cat, name, qty, price, seller, buyer) values (L.key, L.cat, L.name, L.qty, L.price, L.seller, me);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function s1.hdv_cancel(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); L hdv_listings;
begin
  if me is null then return hdv_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  update hdv_listings set status = 'gone', closed_at = now() where id = p_id and seller = me and status = 'open' returning * into L;
  if L.id is null then return hdv_err('Annonce introuvable ou déjà vendue.'); end if;
  perform hdv_op(me, hdv_back(L), 'Retiré de la vente : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function s1.hdv_reprice(p_after bigint, p_id bigint, p_price bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; L hdv_listings; tax bigint;
begin
  if hdv_closed() then return hdv_err('L''Hôtel de vente a fermé avec Idlus 3.0 : tes annonces et tes kamas t''ont été rendus.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if p_price is null or p_price < 1 or p_price > 2000000000 then return hdv_err('Prix invalide.'); end if;
  select * into L from hdv_listings where id = p_id and seller = me and status = 'open' for update;
  if L.id is null then return hdv_err('Annonce introuvable ou déjà vendue.'); end if;
  tax := hdv_tax(p_price);
  if hdv_kamas(me, d) < tax then return hdv_err('Pas assez de kamas pour la taxe.'); end if;
  update hdv_listings set price = p_price where id = L.id;
  perform hdv_op(me, jsonb_build_object('k', -tax), 'Nouveau prix : ' || L.name);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Recherche : une ligne par objet ou ressource, avec le prix le plus bas à l'unité.
create or replace function s1.hdv_search(p_cat text, p_q text, p_slot text, p_lmin int, p_lmax int) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('key', key, 'cat', min(cat), 'name', min(name), 'lvl', max(lvl), 'slot', min(slot), 'n', count(*), 'qty', sum(qty), 'unit', min(price::numeric / qty)) r
    from hdv_listings
    where status = 'open' and expires_at > now() and (p_cat is null or cat = p_cat)
      and (p_q is null or p_q = '' or name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
      and (p_slot is null or p_slot = '' or slot = p_slot) and lvl between coalesce(p_lmin, 0) and coalesce(p_lmax, 1000)
    group by key limit 80) x
$$;

create or replace function s1.hdv_offers(p_key text) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'qty', qty, 'price', price, 'item', item, 'mine', seller = auth.uid(), 'exp', expires_at) order by price::numeric / qty, id), '[]'::jsonb)
  from (select * from hdv_listings where key = p_key and status = 'open' and expires_at > now() order by price::numeric / qty, id limit 60) x
$$;

-- Prix moyen à l'unité, jour par jour sur 14 jours, et ventes de la semaine.
create or replace function s1.hdv_stats(p_key text) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'u', u) order by d) from (select date_trunc('day', at)::date d, round(sum(price)::numeric / sum(qty), 1) u from hdv_sales where key = p_key and at > now() - interval '14 days' group by 1) s), '[]'::jsonb),
    'week', (select coalesce(sum(qty), 0) from hdv_sales where key = p_key and at > now() - interval '7 days'),
    'avg', (select round(sum(price)::numeric / nullif(sum(qty), 0), 1) from hdv_sales where key = p_key and at > now() - interval '14 days'),
    'last', (select coalesce(jsonb_agg(jsonb_build_object('q', qty, 'p', price) order by at desc), '[]'::jsonb) from (select * from hdv_sales where key = p_key order by at desc limit 10) l))
$$;

create or replace function s1.hdv_mine() returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select jsonb_build_object(
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'qty', qty, 'price', price, 'item', item, 'exp', expires_at) order by expires_at) from hdv_listings where seller = auth.uid() and status = 'open'), '[]'::jsonb),
    'sold', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'qty', qty, 'price', price, 'item', item, 'at', closed_at, 'buyer', pseudo_of(buyer)) order by closed_at desc) from (select * from hdv_listings where seller = auth.uid() and status = 'sold' and closed_at > now() - interval '7 days' order by closed_at desc limit 40) s), '[]'::jsonb))
$$;

-- ---------- échanges directs ----------
-- Offre : { k: kamas, items: [uid], mounts: [uid], pets: [uid], res: {nom: n}, runes: {clé: n}, cons: {clé: n} }
-- Renvoie ce que l'autre reçoit : { items: [objet], mounts: [monture], pets: [familier] } (2.1.30 : les bêtes reçues sont marquées b)
create or replace function s1.trade_check(p_user uuid, d jsonb, o jsonb) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$
declare out_items jsonb := '[]'::jsonb; out_m jsonb := '[]'::jsonb; out_p jsonb := '[]'::jsonb; u jsonb; b text; e record;
begin
  if coalesce((o->>'k')::numeric, 0) < 0 then raise exception 'Montant invalide.'; end if;
  if hdv_kamas(p_user, d) < coalesce((o->>'k')::numeric, 0) then raise exception 'Pas assez de kamas.'; end if;
  for u in select * from jsonb_array_elements(coalesce(o->'items', '[]'::jsonb)) loop
    out_items := out_items || jsonb_build_array(hdv_item(p_user, d, (u #>> '{}')::bigint));
  end loop;
  for u in select * from jsonb_array_elements(coalesce(o->'mounts', '[]'::jsonb)) loop
    out_m := out_m || jsonb_build_array(hdv_beast(p_user, d, 'mt', (u #>> '{}')::bigint) || '{"b": 1}'::jsonb);
  end loop;
  for u in select * from jsonb_array_elements(coalesce(o->'pets', '[]'::jsonb)) loop
    out_p := out_p || jsonb_build_array(hdv_beast(p_user, d, 'pet', (u #>> '{}')::bigint) || '{"b": 1}'::jsonb);
  end loop;
  foreach b in array array['res', 'runes', 'cons'] loop
    for e in select * from jsonb_each_text(coalesce(o->b, '{}'::jsonb)) loop
      if e.value::numeric <= 0 then raise exception 'Quantité invalide.'; end if;
      if exists (select 1 from hdv_block where key = e.key) then raise exception '% ne s''échange pas.', e.key; end if;
      if hdv_qty(p_user, d, b, e.key) < e.value::numeric then raise exception 'Pas assez de % (ou la sauvegarde en ligne n''est pas encore à jour).', e.key; end if;
    end loop;
  end loop;
  -- 2.2.11 « Bourse aux cartes » : doubles seulement, après 7 boosters ouverts
  for e in select * from jsonb_each_text(coalesce(o->'cards', '{}'::jsonb)) loop
    if e.key !~ '^[a-z0-9_]{1,48}[*]?$' or e.value !~ '^[1-9][0-9]{0,3}$' then raise exception 'Carte invalide.'; end if;
    if hdv_card_lock(d) is not null then raise exception '%', hdv_card_lock(d); end if;
    if hdv_card_qty(p_user, d, e.key) < e.value::numeric then raise exception 'Pas assez de doubles de cette carte : le dernier exemplaire reste dans l''album (ou la sauvegarde en ligne n''est pas encore à jour).'; end if;
  end loop;
  return jsonb_build_object('items', out_items, 'mounts', out_m, 'pets', out_p);
end $$;

create or replace function s1.trade_neg(o jsonb) returns jsonb language sql immutable
as $$ select jsonb_strip_nulls(jsonb_build_object('k', -coalesce((o->>'k')::numeric, 0), 'rm', o->'items', 'rmM', o->'mounts', 'rmP', o->'pets',
  'res', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'res', '{}'::jsonb))),
  'runes', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'runes', '{}'::jsonb))),
  'cons', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'cons', '{}'::jsonb))),
  'cards', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'cards', '{}'::jsonb))))) $$;

-- Additionne deux opérations (ce qu'on donne et ce qu'on reçoit) en une seule.
create or replace function s1.trade_sum(x jsonb, y jsonb) returns jsonb language sql immutable
as $$ select jsonb_strip_nulls(jsonb_build_object(
  'k', coalesce((x->>'k')::numeric, 0) + coalesce((y->>'k')::numeric, 0),
  'rm', case when jsonb_array_length(coalesce(x->'rm', '[]')) + jsonb_array_length(coalesce(y->'rm', '[]')) > 0 then coalesce(x->'rm', '[]') || coalesce(y->'rm', '[]') end,
  'add', case when jsonb_array_length(coalesce(x->'add', '[]')) + jsonb_array_length(coalesce(y->'add', '[]')) > 0 then coalesce(x->'add', '[]') || coalesce(y->'add', '[]') end,
  'rmM', case when jsonb_array_length(coalesce(x->'rmM', '[]')) + jsonb_array_length(coalesce(y->'rmM', '[]')) > 0 then coalesce(x->'rmM', '[]') || coalesce(y->'rmM', '[]') end,
  'rmP', case when jsonb_array_length(coalesce(x->'rmP', '[]')) + jsonb_array_length(coalesce(y->'rmP', '[]')) > 0 then coalesce(x->'rmP', '[]') || coalesce(y->'rmP', '[]') end,
  'addM', case when jsonb_array_length(coalesce(x->'addM', '[]')) + jsonb_array_length(coalesce(y->'addM', '[]')) > 0 then coalesce(x->'addM', '[]') || coalesce(y->'addM', '[]') end,
  'addP', case when jsonb_array_length(coalesce(x->'addP', '[]')) + jsonb_array_length(coalesce(y->'addP', '[]')) > 0 then coalesce(x->'addP', '[]') || coalesce(y->'addP', '[]') end,
  'res', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'res', '{}')) union all select * from jsonb_each_text(coalesce(y->'res', '{}'))) a group by key) b),
  'runes', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'runes', '{}')) union all select * from jsonb_each_text(coalesce(y->'runes', '{}'))) a group by key) b),
  'cons', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'cons', '{}')) union all select * from jsonb_each_text(coalesce(y->'cons', '{}'))) a group by key) b),
  'cards', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'cards', '{}')) union all select * from jsonb_each_text(coalesce(y->'cards', '{}'))) a group by key) b))) $$;

create or replace function s1.trade_start(p_pseudo text) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); v_other uuid; id_ bigint;
begin
  begin perform hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  select id into v_other from profiles where lower(pseudo) = lower(p_pseudo);
  if v_other is null then return hdv_err('Joueur introuvable.'); end if;
  if v_other = me then return hdv_err('Tu ne peux pas échanger avec toi-même.'); end if;
  if exists (select 1 from ignores where ignores.user_id = v_other and ignores.other = me) then return hdv_err('Ce joueur ne reçoit pas tes demandes.'); end if;
  update trades set status = 'cancel', note = 'annulé', updated_at = now() where status = 'open' and (a = me or b = me);
  insert into trades (a, b) values (me, v_other) returning id into id_;
  return jsonb_build_object('ok', true, 'id', id_);
end $$;

-- L'échange en cours (ou celui qui vient de se terminer, pour afficher le résultat).
create or replace function s1.trade_state() returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce((select jsonb_build_object('id', t.id, 'me', case when t.a = auth.uid() then 'a' else 'b' end, 'pa', pseudo_of(t.a), 'pb', pseudo_of(t.b),
      'oa', t.offer_a, 'ob', t.offer_b, 'ka', t.ok_a, 'kb', t.ok_b, 'ver', t.ver, 'st', t.status, 'note', t.note,
      'ia', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'it', (s.data::jsonb)->'items'->(u #>> '{}'))), '[]'::jsonb) from saves_ok s, jsonb_array_elements(t.offer_a->'items') u where s.user_id = t.a),
      'ib', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'it', (s.data::jsonb)->'items'->(u #>> '{}'))), '[]'::jsonb) from saves_ok s, jsonb_array_elements(t.offer_b->'items') u where s.user_id = t.b),
      -- 2.1.30 : montures (ma, mb) et familiers (fa, fb) posés dans l'échange
      'ma', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'm', (s.data::jsonb)->'mounts'->(u #>> '{}'))), '[]'::jsonb) from saves_ok s, jsonb_array_elements(coalesce(t.offer_a->'mounts', '[]')) u where s.user_id = t.a),
      'mb', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'm', (s.data::jsonb)->'mounts'->(u #>> '{}'))), '[]'::jsonb) from saves_ok s, jsonb_array_elements(coalesce(t.offer_b->'mounts', '[]')) u where s.user_id = t.b),
      'fa', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'p', (s.data::jsonb)->'pets'->(u #>> '{}'))), '[]'::jsonb) from saves_ok s, jsonb_array_elements(coalesce(t.offer_a->'pets', '[]')) u where s.user_id = t.a),
      'fb', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'p', (s.data::jsonb)->'pets'->(u #>> '{}'))), '[]'::jsonb) from saves_ok s, jsonb_array_elements(coalesce(t.offer_b->'pets', '[]')) u where s.user_id = t.b))
    from trades t where (t.a = auth.uid() or t.b = auth.uid()) and (t.status = 'open' and t.updated_at > now() - interval '15 minutes' or t.updated_at > now() - interval '20 seconds')
    order by t.id desc limit 1), 'null'::jsonb)
$$;

-- Liste de numéros sans doublon (null si vide).
create or replace function s1.hdv_uniq(a jsonb) returns jsonb language sql immutable
as $$ select case when jsonb_typeof(a) = 'array' and jsonb_array_length(a) > 0 then (select jsonb_agg(distinct (v #>> '{}')::bigint) from jsonb_array_elements(a) v where (v #>> '{}') ~ '^\d{1,15}$') end $$;

create or replace function s1.trade_offer(p_id bigint, p_offer jsonb) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); t trades; o jsonb;
begin
  select * into t from trades where id = p_id and status = 'open' and (a = me or b = me) for update;
  if t.id is null then return hdv_err('Échange terminé.'); end if;
  -- 2.1.30 : montures et familiers ; chaque numéro une seule fois (un objet posé deux fois aurait été reçu en double)
  o := jsonb_strip_nulls(jsonb_build_object('k', greatest(0, coalesce((p_offer->>'k')::bigint, 0)), 'items', hdv_uniq(p_offer->'items'), 'mounts', hdv_uniq(p_offer->'mounts'), 'pets', hdv_uniq(p_offer->'pets'),
    'res', p_offer->'res', 'runes', p_offer->'runes', 'cons', p_offer->'cons', 'cards', p_offer->'cards'));
  if jsonb_array_length(coalesce(o->'items', '[]')) + jsonb_array_length(coalesce(o->'mounts', '[]')) + jsonb_array_length(coalesce(o->'pets', '[]')) > 12 then return hdv_err('12 objets et bêtes au maximum.'); end if;
  if t.a = me then update trades set offer_a = o, ok_a = false, ok_b = false, ver = ver + 1, updated_at = now() where id = t.id;
  else update trades set offer_b = o, ok_a = false, ok_b = false, ver = ver + 1, updated_at = now() where id = t.id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function s1.trade_ok(p_id bigint, p_ver int, p_after bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); t trades; da jsonb; db jsonb; ia jsonb; ib jsonb;
begin
  select * into t from trades where id = p_id and status = 'open' and (a = me or b = me) for update;
  if t.id is null then return hdv_err('Échange terminé.'); end if;
  if t.ver <> p_ver then return hdv_err('L''offre vient de changer : vérifie-la avant de valider.'); end if;
  if t.a = me then update trades set ok_a = true, updated_at = now() where id = t.id returning * into t;
  else update trades set ok_b = true, updated_at = now() where id = t.id returning * into t; end if;
  if not (t.ok_a and t.ok_b) then return jsonb_build_object('ok', true, 'wait', true); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || least(t.a::text, t.b::text)));
  perform pg_advisory_xact_lock(hashtext('hdv' || greatest(t.a::text, t.b::text)));
  if exists (select 1 from hdv_ops o where o.user_id in (t.a, t.b) and o.txt like 'Échange avec %' and o.at > now() - interval '1 minute') then
    update trades set ok_a = false, ok_b = false where id = t.id; return hdv_err('Un échange par minute au maximum : réessaie dans un instant.'); end if;
  begin
    da := hdv_save(t.a); db := hdv_save(t.b);
    ia := trade_check(t.a, da, t.offer_a); ib := trade_check(t.b, db, t.offer_b);
  exception when raise_exception then
    update trades set ok_a = false, ok_b = false where id = t.id;
    return hdv_err(sqlerrm);
  end;
  perform hdv_op(t.a, trade_sum(trade_neg(t.offer_a), jsonb_strip_nulls(jsonb_build_object('k', coalesce((t.offer_b->>'k')::numeric, 0), 'add', case when jsonb_array_length(ib->'items') > 0 then ib->'items' end,
    'addM', case when jsonb_array_length(ib->'mounts') > 0 then ib->'mounts' end, 'addP', case when jsonb_array_length(ib->'pets') > 0 then ib->'pets' end, 'res', t.offer_b->'res', 'runes', t.offer_b->'runes', 'cons', t.offer_b->'cons', 'cards', t.offer_b->'cards'))), 'Échange avec ' || pseudo_of(t.b));
  perform hdv_op(t.b, trade_sum(trade_neg(t.offer_b), jsonb_strip_nulls(jsonb_build_object('k', coalesce((t.offer_a->>'k')::numeric, 0), 'add', case when jsonb_array_length(ia->'items') > 0 then ia->'items' end,
    'addM', case when jsonb_array_length(ia->'mounts') > 0 then ia->'mounts' end, 'addP', case when jsonb_array_length(ia->'pets') > 0 then ia->'pets' end, 'res', t.offer_a->'res', 'runes', t.offer_a->'runes', 'cons', t.offer_a->'cons', 'cards', t.offer_a->'cards'))), 'Échange avec ' || pseudo_of(t.a));
  update trades set status = 'done', note = 'fait', updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'done', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function s1.trade_cancel(p_id bigint) returns void language sql security definer set search_path = s1, public
as $$ update trades set status = 'cancel', note = 'annulé par ' || pseudo_of(auth.uid()), updated_at = now() where id = p_id and status = 'open' and (a = auth.uid() or b = auth.uid()) $$;

-- ---------- offres d'achat (0.1.33) ----------
-- Un joueur annonce « j'achète N × ressource à P kamas l'unité ». Les kamas (avec la taxe de 2 %)
-- sont mis de côté tout de suite ; n'importe qui peut lui vendre tout ou une partie, il est payé
-- aussitôt et l'acheteur reçoit la marchandise par une opération, même hors ligne. À la fin
-- (retrait, durée écoulée ou offre complète), ce qui n'a pas servi lui revient, taxe comprise :
-- la taxe ne porte que sur ce qu'il a vraiment reçu.
create table if not exists s1.hdv_orders (
  id bigint generated always as identity primary key,
  buyer uuid not null references auth.users (id) on delete cascade,
  cat text not null check (cat in ('res', 'rune', 'cons')),
  key text not null,
  name text not null,
  lvl int not null default 0,
  slot text,
  qty int not null,               -- quantité voulue
  filled int not null default 0,  -- quantité déjà reçue
  price bigint not null,          -- prix à l'unité
  held bigint not null,           -- kamas mis de côté à la création (taxe comprise)
  status text not null default 'open' check (status in ('open', 'done', 'gone')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz
);
create index if not exists hdv_orders_key on s1.hdv_orders (key, price desc) where status = 'open';
create index if not exists hdv_orders_buyer on s1.hdv_orders (buyer, status);
create index if not exists hdv_orders_exp on s1.hdv_orders (expires_at) where status = 'open';
alter table s1.hdv_orders enable row level security;

-- Taxe sur un montant réellement payé (rien si rien n'a été reçu).
create or replace function s1.hdv_otax(p numeric) returns bigint language sql immutable as $$ select case when p <= 0 then 0 else ceil(p * 0.02) end::bigint $$;

-- Ferme une offre et rend à l'acheteur ce qui n'a pas servi.
create or replace function s1.hdv_order_close(O hdv_orders, st text, why text) returns void language plpgsql security definer set search_path = s1, public
as $$
declare back bigint;
begin
  update hdv_orders set status = st, closed_at = now() where id = O.id;
  back := O.held - O.filled * O.price - hdv_otax(O.filled * O.price);
  if back > 0 then perform hdv_op(O.buyer, jsonb_build_object('k', back), why || ' : ' || O.name || ' (' || O.filled || ' / ' || O.qty || ' reçus), kamas restants rendus'); end if;
end $$;

create or replace function s1.hdv_order_expire() returns void language plpgsql security definer set search_path = s1, public
as $$
declare O hdv_orders;
begin
  for O in select * from hdv_orders where status = 'open' and expires_at < now() limit 200 for update skip locked loop
    perform hdv_order_close(O, 'gone', 'Offre d''achat terminée');
  end loop;
end $$;

create or replace function s1.hdv_order_new(p_after bigint, p_cat text, p_key text, p_qty int, p_price bigint, p_days int, p_name text, p_lvl int, p_slot text)
returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; tot numeric; held bigint;
begin
  if hdv_closed() then return hdv_err('L''Hôtel de vente a fermé avec Idlus 3.0 : tes annonces et tes kamas t''ont été rendus.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  perform hdv_order_expire();
  if p_cat not in ('res', 'rune', 'cons') then return hdv_err('Les offres d''achat portent sur les ressources, clefs, runes et consommables.'); end if;
  if p_key is null or p_key = '' or exists (select 1 from hdv_block where key = p_key) then return hdv_err('Cette ressource ne s''échange pas.'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then return hdv_err('Quantité invalide (1 à 100 000).'); end if;
  if p_price is null or p_price < 1 then return hdv_err('Prix invalide.'); end if;
  if p_days not in (3, 7, 14) then return hdv_err('Durée de 3, 7 ou 14 jours.'); end if;
  tot := p_qty::numeric * p_price;
  if tot > 2000000000 then return hdv_err('Offre trop grosse (2 milliards de kamas au maximum).'); end if;
  if (select count(*) from hdv_orders where buyer = me and status = 'open') >= 10 then return hdv_err('10 offres d''achat à la fois au maximum.'); end if;
  if exists (select 1 from hdv_orders where buyer = me and status = 'open' and key = p_key) then return hdv_err('Tu as déjà une offre pour cette ressource : retire-la d''abord.'); end if;
  held := tot + hdv_otax(tot);
  if hdv_kamas(me, d) < held then return hdv_err('Pas assez de kamas : il faut mettre de côté ' || held || ' kamas.'); end if;
  insert into hdv_orders (buyer, cat, key, name, lvl, slot, qty, price, held, expires_at)
    values (me, p_cat, p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), p_qty, p_price, held, now() + make_interval(days => p_days));
  perform hdv_op(me, jsonb_build_object('k', -held), 'Offre d''achat : ' || p_qty || ' × ' || coalesce(p_name, p_key) || ' à ' || p_price || ' l''unité (kamas mis de côté)');
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function s1.hdv_order_cancel(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); O hdv_orders;
begin
  if me is null then return hdv_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into O from hdv_orders where id = p_id and buyer = me and status = 'open' for update;
  if O.id is null then return hdv_err('Offre introuvable ou déjà terminée.'); end if;
  perform hdv_order_close(O, 'gone', 'Offre d''achat retirée');
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Vendre à une offre : tout ou une partie.
create or replace function s1.hdv_order_fill(p_after bigint, p_id bigint, p_qty int) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; O hdv_orders; b text; n int; pay bigint; who text;
begin
  if hdv_closed() then return hdv_err('L''Hôtel de vente a fermé avec Idlus 3.0 : tes annonces et tes kamas t''ont été rendus.'); end if;
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into O from hdv_orders where id = p_id for update;
  if O.id is null or O.status <> 'open' or O.expires_at < now() then return hdv_err('Trop tard : cette offre est terminée.'); end if;
  if O.buyer = me then return hdv_err('C''est ta propre offre.'); end if;
  n := least(coalesce(p_qty, 0), O.qty - O.filled);
  if n < 1 then return hdv_err('Quantité invalide.'); end if;
  b := hdv_bucket(O.cat);
  if hdv_qty(me, d, b, O.key) < n then return hdv_err('Tu n''en as pas assez (ou la sauvegarde en ligne n''est pas encore à jour).'); end if;
  pay := n * O.price;
  who := coalesce(pseudo_of(me), 'un joueur');
  update hdv_orders set filled = filled + n where id = O.id returning * into O;
  perform hdv_op(me, jsonb_build_object('k', pay, b, jsonb_build_object(O.key, -n)), 'Vendu à une offre d''achat : ' || n || ' × ' || O.name);
  perform hdv_op(O.buyer, jsonb_build_object(b, jsonb_build_object(O.key, n), 'got', O.id), 'Offre d''achat : ' || who || ' t''a vendu ' || n || ' × ' || O.name || ' (' || O.filled || ' / ' || O.qty || ')');
  insert into hdv_sales (key, cat, name, qty, price, seller, buyer) values (O.key, O.cat, O.name, n, pay, me, O.buyer);
  if O.filled >= O.qty then perform hdv_order_close(O, 'done', 'Offre d''achat complète'); end if;
  return jsonb_build_object('ok', true, 'n', n, 'k', pay, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Offres ouvertes : pour une ressource (p_key), ou toutes avec une recherche (p_q). Meilleur prix d'abord.
-- On ne montre jamais l'acheteur, seulement le prix, ce qui reste à acheter et le temps restant.
create or replace function s1.hdv_orders_list(p_key text, p_q text, p_cat text) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'lvl', lvl, 'left', qty - filled, 'qty', qty, 'price', price, 'exp', expires_at, 'mine', buyer = auth.uid()) order by price desc, id), '[]'::jsonb)
  from (select * from hdv_orders where status = 'open' and expires_at > now()
    and (p_key is null or p_key = '' or key = p_key) and (p_cat is null or p_cat = '' or cat = p_cat)
    and (p_q is null or p_q = '' or name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
    order by price desc, id limit 120) x
$$;

create or replace function s1.hdv_orders_mine() returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'qty', qty, 'filled', filled, 'price', price, 'held', held, 'st', status, 'exp', expires_at, 'at', closed_at) order by status <> 'open', coalesce(closed_at, created_at) desc), '[]'::jsonb)
  from (select * from hdv_orders where buyer = auth.uid() and (status = 'open' or closed_at > now() - interval '7 days') order by id desc limit 40) x
$$;

-- ---------- panel admin ----------
create or replace function s1.adm_hdv() returns jsonb language plpgsql security definer set search_path = s1, public
as $$ begin
  perform public.adm_need(false);
  return jsonb_build_object(
    'open', (select count(*) from hdv_listings where status = 'open'),
    'sellers', (select count(distinct seller) from hdv_listings where status = 'open'),
    'sales7', (select count(*) from hdv_sales where at > now() - interval '7 days'),
    'vol7', (select coalesce(sum(price), 0) from hdv_sales where at > now() - interval '7 days'),
    'trades7', (select count(*) from trades where status = 'done' and updated_at > now() - interval '7 days'),
    'orders', (select count(*) from hdv_orders where status = 'open'),
    'last', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'name', name, 'qty', qty, 'price', price, 's', pseudo_of(seller), 'b', pseudo_of(buyer)) order by at desc) from (select * from hdv_sales order by at desc limit 30) x), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'qty', qty, 'price', price, 's', pseudo_of(seller)) order by price desc) from (select * from hdv_listings where status = 'open' order by price desc limit 15) x), '[]'::jsonb));
end $$;

create or replace function s1.adm_hdv_remove(p_id bigint) returns void language plpgsql security definer set search_path = s1, public
as $$
declare L hdv_listings;
begin
  perform public.adm_need(false);
  update hdv_listings set status = 'gone', closed_at = now() where id = p_id and status = 'open' returning * into L;
  if L.id is null then return; end if;
  perform hdv_op(L.seller, hdv_back(L), 'Annonce retirée par la modération : ' || L.name);
  perform alog('HdV : annonce retirée (' || L.name || ', ' || coalesce(pseudo_of(L.seller), '?') || ')');
end $$;

-- ---------- 1.0.16 : Hôtel de vente façon DOFUS 3 (lecture seule, rien n'est envoyé en continu) ----------
create index if not exists hdv_sales_buyer on s1.hdv_sales (buyer, at);
create or replace function s1.hdv_fold(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'àâäáãéèêëíìîïóòôöõúùûüçñœæ', 'aaaaaeeeeiiiiooooouuuucnoa')
$$;
-- Liste du tableau : prix des lots ×1 / ×10 / ×100, prix le plus bas à l'unité et prix moyen des 14 derniers jours.
-- p_keys : les favoris du joueur (sinon null). La recherche ignore les accents.
create or replace function s1.hdv_market(p_cat text, p_q text, p_slot text, p_keys text[]) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select jsonb_build_object('key', l.key, 'cat', min(l.cat), 'name', min(l.name), 'lvl', max(l.lvl), 'slot', min(l.slot), 'n', count(*), 'qty', sum(l.qty),
      'unit', round(min(l.price::numeric / l.qty), 2),
      'p1', min(l.price) filter (where l.qty = 1), 'p10', min(l.price) filter (where l.qty = 10), 'p100', min(l.price) filter (where l.qty = 100),
      'avg', (select round(sum(s.price)::numeric / nullif(sum(s.qty), 0), 1) from hdv_sales s where s.key = l.key and s.at > now() - interval '14 days')) r
    from hdv_listings l
    where l.status = 'open' and l.expires_at > now()
      and (p_keys is null or l.key = any(p_keys))
      and (p_cat is null or p_cat = '' or l.cat = p_cat)
      and (p_slot is null or p_slot = '' or l.slot = p_slot)
      and (p_q is null or p_q = '' or hdv_fold(l.name) like '%' || hdv_fold(replace(replace(p_q, '%', ''), '_', '')) || '%')
    group by l.key limit 400) x
$$;
-- Courbe des prix : prix moyen à l'unité et quantité vendue, jour par jour (30 jours au plus), et prix moyen des 14 derniers jours.
create or replace function s1.hdv_history(p_key text, p_days int) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'u', u, 'q', q) order by d) from (select date_trunc('day', at)::date d, round(sum(price)::numeric / sum(qty), 1) u, sum(qty) q
      from hdv_sales where key = p_key and at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 30)) group by 1) s), '[]'::jsonb),
    'avg', (select round(sum(price)::numeric / nullif(sum(qty), 0), 1) from hdv_sales where key = p_key and at > now() - interval '14 days'),
    'week', (select coalesce(sum(qty), 0) from hdv_sales where key = p_key and at > now() - interval '7 days'))
$$;
-- Mes achats des 7 derniers jours (annonces achetées et offres d'achat remplies).
create or replace function s1.hdv_bought() returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('cat', cat, 'key', key, 'name', name, 'qty', qty, 'price', price, 'at', at, 'seller', pseudo_of(seller)) order by at desc), '[]'::jsonb)
  from (select * from hdv_sales where buyer = auth.uid() and at > now() - interval '7 days' order by at desc limit 40) b
$$;

-- ---------- droits ----------
do $$
declare f text;
begin
  foreach f in array array['hdv_err(text)', 'hdv_save(uuid)', 'hdv_cursor(jsonb)', 'hdv_kamas(uuid, jsonb)', 'hdv_qty(uuid, jsonb, text, text)', 'hdv_bucket(text)', 'hdv_card_qty(uuid, jsonb, text)', 'hdv_card_lock(jsonb)', 'hdv_item(uuid, jsonb, bigint)',
    'hdv_op(uuid, jsonb, text)', 'hdv_ops_after(uuid, bigint)', 'hdv_back(hdv_listings)', 'hdv_expire()', 'hdv_tax(bigint)', 'trade_check(uuid, jsonb, jsonb)', 'trade_neg(jsonb)', 'trade_sum(jsonb, jsonb)',
    'hdv_otax(numeric)', 'hdv_order_close(hdv_orders, text, text)', 'hdv_order_expire()', 'hdv_fold(text)'] loop
    execute 'revoke all on function s1.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['hdv_sync(bigint)', 'hdv_list(bigint, text, text, bigint, int, int, bigint, text, int, text)', 'hdv_buy(bigint, bigint)', 'hdv_cancel(bigint, bigint)', 'hdv_reprice(bigint, bigint, bigint)',
    'hdv_mine()', 'trade_start(text)', 'trade_state()', 'trade_offer(bigint, jsonb)', 'trade_ok(bigint, int, bigint)', 'trade_cancel(bigint)', 'adm_hdv()', 'adm_hdv_remove(bigint)',
    'hdv_order_new(bigint, text, text, int, bigint, int, text, int, text)', 'hdv_order_cancel(bigint, bigint)', 'hdv_order_fill(bigint, bigint, int)', 'hdv_orders_mine()', 'hdv_bought()'] loop
    execute 'revoke all on function s1.' || f || ' from public, anon';
    execute 'grant execute on function s1.' || f || ' to authenticated';
  end loop;
  foreach f in array array['hdv_search(text, text, text, int, int)', 'hdv_offers(text)', 'hdv_stats(text)', 'hdv_orders_list(text, text, text)', 'hdv_market(text, text, text, text[])', 'hdv_history(text, int)'] loop
    execute 'grant execute on function s1.' || f || ' to anon, authenticated';
  end loop;
end $$;

-- ---------- 1.0.30 « Forge » : prix moyens des 7 derniers jours pour l'atelier de brisage ----------
-- { clé: prix moyen à l'unité } pour des runes et des objets (400 clés au plus). Seules les clés vendues ces 7 derniers jours
-- sont renvoyées : sans vente, le jeu n'affiche aucun prix. Lecture seule.
create or replace function s1.hdv_prix7(p_keys text[]) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_object_agg(key, u), '{}'::jsonb)
  from (select s.key, round(sum(s.price)::numeric / nullif(sum(s.qty), 0), 1) u
    from hdv_sales s
    where s.key = any ((coalesce(p_keys, '{}'::text[]))[1:400]) and s.cat in ('eq', 'rune') and s.at > now() - interval '7 days'
    group by s.key) x
  where u is not null
$$;
revoke all on function s1.hdv_prix7(text[]) from public;
grant execute on function s1.hdv_prix7(text[]) to anon, authenticated;

reset search_path;

-- ======================== supabase/guildes.sql ========================
set search_path = s1, public;
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

create table if not exists s1.guilds (
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
create unique index if not exists guilds_name on s1.guilds (lower(name));
alter table s1.guilds enable row level security;

-- rang : 0 Meneur, 1 Bras droit, 2 Membre, 3 Recrue
create table if not exists s1.guild_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  rank smallint not null default 3 check (rank between 0 and 3),
  share smallint not null default 0 check (share between 0 and 90),
  given bigint not null default 0,
  week bigint not null default 0,          -- XP donnée cette semaine
  week_of date not null default (date_trunc('week', now()))::date,
  last_give timestamptz,
  joined_at timestamptz not null default now()
);
create index if not exists guild_members_g on s1.guild_members (guild_id);
-- 1.0.12.6 : le Meneur ou un Bras droit peut régler la part d'XP d'un membre de rang plus bas (pseudo gardé ici ; vide = réglée par le joueur).
alter table s1.guild_members add column if not exists share_by text;
alter table s1.guild_members enable row level security;

-- demandes (un joueur demande à entrer) et invitations (la guilde invite un joueur)
create table if not exists s1.guild_requests (
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ask', 'invite')),
  by_user uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
alter table s1.guild_requests enable row level security;

create table if not exists s1.guild_msgs (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text, cls text, lvl int, title text,
  body text not null default '',
  item jsonb,
  kind text not null default 'msg',  -- 'msg' ou 'sys' (arrivée, départ, niveau de guilde)
  created_at timestamptz not null default now()
);
create index if not exists guild_msgs_g on s1.guild_msgs (guild_id, id desc);
alter table s1.guild_msgs enable row level security;

create table if not exists s1.guild_log (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  at timestamptz not null default now(),
  txt text not null
);
create index if not exists guild_log_g on s1.guild_log (guild_id, id desc);
alter table s1.guild_log enable row level security;

-- ---------- 1.0.30 : coffre, places, améliorations, protection ----------
alter table s1.guilds add column if not exists chest bigint not null default 0;         -- coffre de guilde (kamas)
alter table s1.guilds add column if not exists seats int not null default 5;            -- places de membres (5 à 15)
alter table s1.guilds add column if not exists ups jsonb not null default '{}'::jsonb;  -- rangs (poche, prospection, sagesse, robustesse : 0 à 10) et améliorations uniques (1)
alter table s1.guilds add column if not exists shield_until timestamptz;                -- nouvelle guilde : Percepteurs protégés 2 h
alter table s1.guilds add column if not exists pvp_win int not null default 0;          -- attaques entre guildes gagnées (attaque ou défense)
alter table s1.guilds add column if not exists pvp_loss int not null default 0;
-- part de ses ventes directes que chaque membre donne au coffre (0 à 20 %, choisie par le membre)
alter table s1.guild_members add column if not exists sale smallint not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'guild_members_sale_chk') then
    alter table s1.guild_members add constraint guild_members_sale_chk check (sale between 0 and 20);
  end if;
end $$;
-- mouvements du coffre (les parts des ventes d'un même membre sont regroupées par heure)
create table if not exists s1.guild_chest_log (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  at timestamptz not null default now(),
  k bigint not null,
  txt text not null,
  src text,                 -- regroupement (« vente:<joueur> »)
  n int not null default 1
);
create index if not exists guild_chest_log_g on s1.guild_chest_log (guild_id, id desc);
alter table s1.guild_chest_log enable row level security;

-- ---------- outils internes ----------
create or replace function s1.g_err(t text) returns jsonb language sql immutable as $$ select jsonb_build_object('err', t) $$;
-- XP pour passer du niveau l au niveau l+1, et niveau atteint avec une XP totale (niveau 100 au plus)
create or replace function s1.g_need(l int) returns bigint language sql immutable as $$ select (450000::bigint * l * l) $$;
create or replace function s1.g_base(l int) returns bigint language sql immutable as $$ select (450000::numeric * (l - 1) * l * (2 * l - 1) / 6)::bigint $$;
create or replace function s1.g_lvl(x bigint) returns int language plpgsql immutable as $$
declare l int := 1;
begin
  while l < 100 and g_base(l + 1) <= x loop l := l + 1; end loop;
  return l;
end $$;
create or replace function s1.g_rname(r int) returns text language sql immutable as $$ select case r when 0 then 'Meneur' when 1 then 'Bras droit' when 2 then 'Membre' else 'Recrue' end $$;
create or replace function s1.g_log(g bigint, t text, chat boolean default true) returns void language plpgsql security definer set search_path = s1, public
as $$ begin
  insert into guild_log (guild_id, txt) values (g, t);
  if chat then insert into guild_msgs (guild_id, kind, body) values (g, 'sys', t); end if;
  delete from guild_log where guild_id = g and id < (select min(id) from (select id from guild_log where guild_id = g order by id desc limit 60) x);
end $$;
create or replace function s1.g_me(u uuid) returns guild_members language sql stable security definer set search_path = s1, public
as $$ select * from guild_members where user_id = u $$;
create or replace function s1.g_count(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select count(*)::int from guild_members where guild_id = g $$;
create or replace function s1.g_name_ok(n text) returns text language plpgsql immutable as $$
declare x text;
begin
  if n is null or length(n) < 3 or length(n) > 24 then return 'Le nom fait de 3 à 24 caractères.'; end if;
  if n !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ''-]*$' then return 'Lettres, chiffres, espaces, apostrophes et tirets seulement.'; end if;
  x := translate(lower(n), 'àâäéèêëîïôöùûüç013456@$', 'aaaeeeeiioouuucoieasgas');
  if x ~ '(merde|pute|putain|connard|connasse|salope|encul|batard|nique|fuck|bitch|nigg|negre|nazi|hitler|bougnoul|youpin|pedale|tapette|admin|moderat|ankama)' then return 'Ce nom n''est pas autorisé.'; end if;
  return null;
end $$;
create or replace function s1.g_join(u uuid, g bigint, how text) returns void language plpgsql security definer set search_path = s1, public
as $$ begin
  insert into guild_members (user_id, guild_id, rank) values (u, g, 3);
  delete from guild_requests where user_id = u;
  perform g_log(g, pseudo_of(u) || ' rejoint la guilde' || coalesce(' (' || how || ')', '') || '.');
end $$;
-- Le Meneur s'en va : la place passe au rang le plus haut, puis au plus ancien.
create or replace function s1.g_heir(g bigint) returns void language plpgsql security definer set search_path = s1, public
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
create or replace function s1.g_week(u uuid) returns void language sql security definer set search_path = s1, public
as $$ update guild_members set week = 0, week_of = (date_trunc('week', now()))::date where user_id = u and week_of < (date_trunc('week', now()))::date $$;

-- ---------- 1.0.30 : outils du coffre et des améliorations ----------
-- 1234567 → « 1 234 567 »
create or replace function s1.g_fmt(n bigint) returns text language sql immutable
as $$ select case when n < 0 then '-' else '' end || regexp_replace(abs(n)::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') $$;
create or replace function s1.g_seats(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select coalesce((select seats from guilds where id = g), 5) $$;
-- prix de la n-ième place (E.guildSeatPrice) : 6e 250 000, 10e 6 250 000, 15e 25 000 000
create or replace function s1.g_seat_price(n int) returns bigint language sql immutable as $$ select 250000::bigint * greatest(0, n - 5) * greatest(0, n - 5) $$;
-- les améliorations (E.GUILD_RANKS et E.GUILD_UQ dans js/gboss.js) : max 10 = à rangs (100 000 × rang²), max 1 = unique
create or replace function s1.g_upinfo(k text) returns jsonb language sql immutable
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
create or replace function s1.g_up(g bigint, k text) returns int language sql stable security definer set search_path = s1, public
as $$ select coalesce((select (ups->>k)::int from guilds where id = g), 0) $$;
-- Mouvement du coffre : k > 0 entre, k < 0 sort (le coffre ne descend jamais sous 0). Renvoie le nouveau contenu.
create or replace function s1.g_chest(g bigint, p_k bigint, t text, src text default null) returns bigint language plpgsql security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture ----------
-- Liste des guildes (visible sans compte).
-- 1.0.30 : places, protection des nouvelles guildes, bilan des attaques et Percepteurs posés (plpgsql : guild_percos est dans gboss.sql).
create or replace function s1.guild_list(p_q text default '') returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$ begin
  return (select coalesce(jsonb_agg(x order by x.lvl desc, x.n desc, x.name), '[]'::jsonb) from (
    select g.id, g.name, g.ic, g.col, g.lvl, g.open, g.motd, (select count(*) from guild_members m where m.guild_id = g.id) n, g.seats cap,
      (select pseudo_of(m.user_id) from guild_members m where m.guild_id = g.id and m.rank = 0 limit 1) chef,
      case when g.shield_until > now() then g.shield_until end shield, g.pvp_win w, g.pvp_loss l,
      (select count(*) from guild_percos p where p.guild_id = g.id) percos
    from guilds g where coalesce(p_q, '') = '' or g.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%'
    order by g.lvl desc limit 60) x);
end $$;
grant execute on function s1.guild_list(text) to anon, authenticated;

-- 2.1.38.3 (idée de Gagou) : la guilde d'un joueur sur sa fiche (Classements, chat). Nom, emblème, niveau et rang : déjà publics
-- dans la fiche de la guilde (guild_view). Rien pour un compte sans guilde. Classique seulement (pas de guildes en Monocompte).
create or replace function s1.guild_of(p_user uuid) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select jsonb_build_object('id', g.id, 'name', g.name, 'ic', g.ic, 'col', g.col, 'lvl', g.lvl, 'rank', g_rname(m.rank))
  from guild_members m join guilds g on g.id = m.guild_id where m.user_id = p_user $$;
grant execute on function s1.guild_of(uuid) to anon, authenticated;

-- Ma guilde (ou mes invitations si je n'en ai pas).
create or replace function s1.guild_me() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_create(p_after bigint, p_name text, p_ic text, p_col text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_join(p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_invite(p_pseudo text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_answer(p_gid bigint, p_user uuid, p_yes boolean) returns jsonb language plpgsql security definer set search_path = s1, public
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

create or replace function s1.guild_leave() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_rank(p_user uuid, p_rank int) returns jsonb language plpgsql security definer set search_path = s1, public
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

create or replace function s1.guild_kick(p_user uuid) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_set(p_motd text, p_open boolean, p_ic text default null, p_col text default null) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_share(p_user uuid, p_share int) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_deposit(p_after bigint, p_k bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_sale_pct(p_pct int) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); m guild_members; v int := greatest(0, least(20, coalesce(p_pct, 0)));
begin
  m := g_me(me); if m.user_id is null then return g_err('Tu n''es pas dans une guilde.'); end if;
  update guild_members set sale = v where user_id = me;
  return jsonb_build_object('ok', true, 'sale', v);
end $$;

-- Interface pour la vente directe (gm-economie) : verse au coffre la part choisie par le membre sur une vente
-- de p_kamas kamas et renvoie le montant pris (0 sans guilde ou à 0 %). À appeler dans la même transaction que la vente.
create or replace function s1.guild_sale_share(p_user uuid, p_kamas bigint) returns bigint language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_has_upgrade(p_user uuid, p_key text) returns boolean language sql stable security definer set search_path = s1, public
as $$ select coalesce((select coalesce((g.ups->>p_key)::int, 0) > 0 from guild_members m join guilds g on g.id = m.guild_id where m.user_id = p_user), false) $$;
revoke all on function s1.guild_sale_share(uuid, bigint) from public, anon, authenticated;
revoke all on function s1.guild_has_upgrade(uuid, text) from public, anon, authenticated;

-- ---------- 1.0.30 : places et améliorations, payées avec le coffre (choix 1A, 4A et 18A) ----------
-- p_k : 'place', un rang ('poche', 'prospection', 'sagesse', 'robustesse') ou une amélioration unique. Meneur ou Bras droit.
create or replace function s1.guild_buy(p_k text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_view(p_id bigint) returns jsonb language plpgsql stable security definer set search_path = s1, public
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
create or replace function s1.guild_give(p_xp bigint, p_share int) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_say(p_body text, p_item jsonb default null) returns text language plpgsql security definer set search_path = s1, public
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

create or replace function s1.guild_chat(p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon', f);
    execute format('grant execute on function s1.%s to authenticated', f);
  end loop;
end $$;

-- ---------- panel admin (onglet « Guildes ») ----------
create or replace function s1.adm_guilds(p_q text default '') returns jsonb language plpgsql security definer set search_path = s1, public
as $$ begin
  perform adm_need(false);
  return (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
    select g.id, g.name, g.ic, g.col, g.lvl, g.motd, g.created_at, (select count(*) from guild_members m where m.guild_id = g.id) n, g.seats cap, g.chest, -- 1.0.30
      (select pseudo_of(m.user_id) from guild_members m where m.guild_id = g.id and m.rank = 0 limit 1) chef,
      (select coalesce(jsonb_agg(jsonb_build_object('p', pseudo_of(m.user_id), 'rank', m.rank) order by m.rank, m.joined_at), '[]'::jsonb) from guild_members m where m.guild_id = g.id) members,
      (select count(*) from guild_msgs gm where gm.guild_id = g.id and gm.created_at > now() - interval '24 hours' and gm.kind = 'msg') msgs
    from guilds g where coalesce(p_q, '') = '' or g.name ilike '%' || p_q || '%' order by g.id desc limit 100) x);
end $$;
create or replace function s1.adm_guild(p_id bigint, p_act text, p_name text default null) returns jsonb language plpgsql security definer set search_path = s1, public
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
revoke all on function s1.adm_guilds(text) from public, anon;
revoke all on function s1.adm_guild(bigint, text, text) from public, anon;
grant execute on function s1.adm_guilds(text) to authenticated;
grant execute on function s1.adm_guild(bigint, text, text) to authenticated;

-- ---------- 1.0.9 : classement des métiers par guilde (vues sur s1.lb_jobs et s1.lb_jobs_week de classements.sql) ----------
-- chaque guilde additionne les métiers de ses membres classés
-- 1.0.25 « Renaissance des métiers » : chaque renaissance d'un métier compte comme 200 niveaux
create or replace view s1.lb_jobs_guild as
  select g.id as guild_id, g.name, g.ic, g.col, j.job, count(*)::int as members, sum(j.lvl + 200 * j.ren)::bigint as lvl, sum(j.total)::bigint as total,
    (array_agg(j.pseudo order by j.ren desc, j.lvl desc, j.total desc))[1] as best
  from s1.lb_jobs j join s1.guild_members gm on gm.user_id = j.user_id join s1.guilds g on g.id = gm.guild_id
  group by g.id, g.name, g.ic, g.col, j.job;
grant select on s1.lb_jobs_guild to anon, authenticated;
create or replace view s1.lb_jobs_guild_week as
  select g.id as guild_id, g.name, g.ic, g.col, j.w, j.job, count(*)::int as members, sum(j.gain)::bigint as gain,
    (array_agg(j.pseudo order by j.gain desc))[1] as best
  from s1.lb_jobs_week j join s1.guild_members gm on gm.user_id = j.user_id join s1.guilds g on g.id = gm.guild_id
  group by g.id, g.name, g.ic, g.col, j.w, j.job;
grant select on s1.lb_jobs_guild_week to anon, authenticated;

reset search_path;

-- ======================== supabase/defi.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — défi du jour (lot « Se montrer »). Appliqué automatiquement par le workflow
-- « Serveur en ligne » après classements.sql (il s'appuie sur ladder et profiles) ; relançable sans danger.
-- ============================================================================
-- ---------- scores du jour ----------
-- Un score par joueur, par jour (heure de Paris) et par palier. Écrit seulement par la fonction serveur « record »,
-- qui rejoue le défi avec la partie en ligne du joueur (le même hasard pour tous).
create table if not exists s1.defi (
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
alter table s1.defi enable row level security;
drop policy if exists "défi lisible" on s1.defi;
create policy "défi lisible" on s1.defi for select using (true);
-- 1.1 : refonte du défi. Score en points (règles tenues, tours, PV), validations comptées (3 par palier et par jour),
-- classement de la semaine (lundi-dimanche, somme des meilleurs scores du jour).
alter table s1.defi add column if not exists score int not null default 0;
alter table s1.defi add column if not exists sends int not null default 0;
alter table s1.defi add column if not exists rules jsonb not null default '{}'::jsonb;
drop view if exists s1.lb_defi;
create view s1.lb_defi as
  select d.user_id, p.pseudo, l.main, d.day, d.tier, d.turns, d.hp, d.team, d.at,
    rank() over (partition by d.day, d.tier order by d.score desc, d.turns asc, d.hp desc, d.at asc) as r, l.main_lvl, d.score, d.rules
  from s1.defi d join s1.ladder l on l.user_id = d.user_id join public.profiles p on p.id = d.user_id where not l.flagged;
grant select on s1.lb_defi to anon, authenticated;
-- semaine : jour 0 = jeudi 1er janvier 1970, d'où (day + 3) / 7 pour des semaines du lundi au dimanche
drop view if exists s1.lb_defi_week_g; -- 1.1 : elle s'appuie sur lb_defi_week (recréée plus bas)
drop view if exists s1.lb_defi_week;
create view s1.lb_defi_week as
  select w.user_id, p.pseudo, l.main, l.main_lvl, w.week, w.tier, w.score, w.days,
    rank() over (partition by w.week, w.tier order by w.score desc, w.days desc) as r
  from (select user_id, (day + 3) / 7 as week, tier, sum(score)::int as score, count(*)::int as days from s1.defi where score > 0 group by user_id, (day + 3) / 7, tier) w
  join s1.ladder l on l.user_id = w.user_id join public.profiles p on p.id = w.user_id where not l.flagged;
grant select on s1.lb_defi_week to anon, authenticated;
-- ---------- 1.1, série 3 : guildes, saison du mois, partage dans le chat ----------
-- jour de Paris (même calcul que E.defiDay)
create or replace function s1.defi_today() returns int language sql stable as $$ select ((now() at time zone 'Europe/Paris')::date - date '1970-01-01')::int $$;
-- semaine de chaque joueur, avec sa guilde (onglet « Ma guilde »)
drop view if exists s1.lb_defi_week_g;
create view s1.lb_defi_week_g as
  select w.*, gm.guild_id from s1.lb_defi_week w join s1.guild_members gm on gm.user_id = w.user_id;
grant select on s1.lb_defi_week_g to anon, authenticated;
-- guildes : somme des 5 meilleurs scores de la semaine de leurs membres, par palier (E.DEFI_GUILD_TOP)
drop view if exists s1.lb_defi_guild_week;
create view s1.lb_defi_guild_week as
  with w as (select d.user_id, (d.day + 3) / 7 as week, d.tier, sum(d.score)::int as score
             from s1.defi d join s1.ladder l on l.user_id = d.user_id where d.score > 0 and not l.flagged group by d.user_id, (d.day + 3) / 7, d.tier),
       m as (select gm.guild_id, w.week, w.tier, w.score, row_number() over (partition by gm.guild_id, w.week, w.tier order by w.score desc) as k
             from w join s1.guild_members gm on gm.user_id = w.user_id)
  select g.id as guild_id, g.name, g.ic, g.col, g.lvl, m.week, m.tier, (sum(m.score) filter (where m.k <= 5))::int as score, count(*)::int as members,
    rank() over (partition by m.week, m.tier order by sum(m.score) filter (where m.k <= 5) desc, count(*) desc) as r
  from m join s1.guilds g on g.id = m.guild_id group by g.id, g.name, g.ic, g.col, g.lvl, m.week, m.tier;
grant select on s1.lb_defi_guild_week to anon, authenticated;
-- le lundi, la 1re guilde de chaque palier de la semaine passée gagne de l'XP de guilde (E.DEFI_GUILD_XP), une seule fois.
-- Appelée par le jeu à l'ouverture du classement des guildes : rien à programmer côté serveur.
create table if not exists s1.defi_guild_prize (
  week int not null, tier text not null, guild_id bigint references s1.guilds (id) on delete set null, xp bigint not null default 0, score int not null default 0,
  at timestamptz not null default now(), primary key (week, tier)
);
alter table s1.defi_guild_prize enable row level security;
drop policy if exists "prix du défi lisibles" on s1.defi_guild_prize;
create policy "prix du défi lisibles" on s1.defi_guild_prize for select using (true);
create or replace function s1.defi_guild_prize() returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare w int := (defi_today() + 3) / 7 - 1; x bigint := 5000000; t record; g guilds; nl int; done jsonb := '[]'::jsonb;
begin
  -- la ligne « * » marque une semaine déjà distribuée : les appels suivants ne lisent qu'elle
  if exists (select 1 from defi_guild_prize where week = w and tier = '*') then return done; end if;
  perform pg_advisory_xact_lock(hashtext('defi_guild_prize'));
  if exists (select 1 from defi_guild_prize where week = w and tier = '*') then return done; end if;
  for t in select distinct on (tier) tier, guild_id, name, score from lb_defi_guild_week where week = w and r = 1 order by tier, guild_id loop
    insert into defi_guild_prize (week, tier, guild_id, xp, score) values (w, t.tier, t.guild_id, x, t.score) on conflict do nothing;
    if found then
      update guilds set xp = xp + x where id = t.guild_id returning * into g;
      nl := g_lvl(g.xp);
      if nl > g.lvl then update guilds set lvl = nl where id = g.id; perform g_log(g.id, 'La guilde passe au niveau ' || nl || ' !'); end if;
      perform g_log(g.id, 'Défi du jour : la guilde finit 1re de la semaine (' || replace(to_char(t.score, 'FM999G999G999'), ',', ' ') || ' points) et gagne ' || replace(to_char(x, 'FM999G999G999'), ',', ' ') || ' XP de guilde !');
      done := done || jsonb_build_object('tier', t.tier, 'name', t.name);
    end if;
  end loop;
  insert into defi_guild_prize (week, tier) values (w, '*') on conflict do nothing;
  return done;
end $$;
revoke all on function s1.defi_guild_prize() from public, anon;
grant execute on function s1.defi_guild_prize() to authenticated;
-- saison : total du mois par palier (mois = année × 12 + mois - 1, comme E.defiMonth)
drop view if exists s1.lb_defi_month;
create view s1.lb_defi_month as
  select s.user_id, p.pseudo, l.main, l.main_lvl, s.month, s.tier, s.score, s.days,
    rank() over (partition by s.month, s.tier order by s.score desc, s.days desc) as r
  from (select user_id, (extract(year from date '1970-01-01' + day) * 12 + extract(month from date '1970-01-01' + day) - 1)::int as month, tier,
          sum(score)::int as score, count(*)::int as days from s1.defi where score > 0 group by 1, 2, 3) s
  join s1.ladder l on l.user_id = s.user_id join public.profiles p on p.id = s.user_id where not l.flagged;
grant select on s1.lb_defi_month to anon, authenticated;
-- « Montrer dans le chat » : seulement un score validé par le serveur, une fois par jour et par palier (annonce dans le Général)
alter table s1.defi add column if not exists shared boolean not null default false;
create or replace function s1.defi_share(p_tier text) returns text language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d defi; mu timestamptz; bn boolean;
begin
  if me is null then return 'Connecte-toi pour montrer ton score.'; end if;
  select * into d from defi where user_id = me and day = defi_today() and tier = p_tier;
  if d.user_id is null or d.score <= 0 then return 'Valide d''abord ton score.'; end if;
  if d.shared then return 'Ton score du jour est déjà dans le chat.'; end if;
  select mute_until, banned into mu, bn from chat_sanctions where user_id = me;
  if coalesce(bn, false) or (mu is not null and mu > now()) then return 'Tu ne peux pas écrire dans le chat pour l''instant.'; end if;
  update defi set shared = true where user_id = me and day = d.day and tier = p_tier;
  perform chat_ann(me, jsonb_build_object('t', 'defi', 'tier', d.tier, 'did', d.did, 'score', d.score, 'turns', d.turns, 'rules', d.rules, 'team', d.team, 'day', d.day));
  return null;
end $$;
revoke all on function s1.defi_share(text) from public, anon;
grant execute on function s1.defi_share(text) to authenticated;
-- ---------- 1.1, série 4 : vote de la règle du Grand défi ----------
-- Du lundi au samedi, un vote par compte et par semaine (modifiable). Les 3 règles proposées et le choix de la gagnante
-- (le plus de votes parmi elles, égalité : la 1re proposée) sont calculés par le jeu et la fonction record (E.defiVoteOpts / E.defiVoteWin).
create table if not exists s1.defi_vote (
  week int not null, user_id uuid not null references auth.users (id) on delete cascade, rule text not null,
  at timestamptz not null default now(), primary key (week, user_id)
);
alter table s1.defi_vote enable row level security;
drop view if exists s1.defi_vote_count;
create view s1.defi_vote_count as
  select v.week, v.rule, count(*)::int as n from s1.defi_vote v join s1.ladder l on l.user_id = v.user_id where not l.flagged group by v.week, v.rule;
grant select on s1.defi_vote_count to anon, authenticated;
create or replace function s1.defi_vote(p_week int, p_rule text) returns text language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d int := defi_today();
begin
  if me is null then return 'Connecte-toi pour voter.'; end if;
  if p_week is distinct from (d + 3) / 7 then return 'Ce vote est terminé.'; end if;
  if (d + 4) % 7 = 0 then return 'Le vote est fermé le dimanche : il rouvre lundi.'; end if;
  if p_rule not in ('survivant', 'versatile', 'econome', 'focus', 'elitiste', 'incurable', 'elementaire', 'barbare', 'rapide') then return 'Règle inconnue.'; end if;
  if not exists (select 1 from ladder where user_id = me and not flagged) then return 'Joue en ligne (partie 1) pour voter.'; end if;
  insert into defi_vote (week, user_id, rule) values (p_week, me, p_rule) on conflict (week, user_id) do update set rule = excluded.rule, at = now();
  return null;
end $$;
revoke all on function s1.defi_vote(int, text) from public, anon;
grant execute on function s1.defi_vote(int, text) to authenticated;

reset search_path;

-- ======================== supabase/carnet.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — carnet de bord (lot « Suivi »). Appliqué automatiquement par le workflow
-- « Serveur en ligne » après classements.sql (il s'appuie sur is_admin) ; relançable sans danger.
-- Un résumé par joueur et par semaine (niveau, XP et kamas par heure, bilan, meilleures zones),
-- envoyé à la demande du joueur pour aider à l'équilibrage. Lisible seulement par Mathis (is_admin),
-- sans pseudo dans la réponse.
-- ============================================================================
create table if not exists s1.carnets (
  user_id uuid not null references auth.users (id) on delete cascade,
  week int not null,
  data jsonb not null,
  at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table s1.carnets enable row level security; -- aucune règle : on passe seulement par les fonctions ci-dessous

create or replace function s1.carnet_send(p_week int, p_data jsonb) returns void
  language plpgsql security definer set search_path = s1, public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 4000 then raise exception 'Carnet invalide.'; end if;
  if abs(p_week - floor(extract(epoch from now()) / 604800)::int) > 1 then raise exception 'Semaine invalide.'; end if;
  insert into carnets (user_id, week, data) values (auth.uid(), p_week, p_data)
    on conflict (user_id, week) do update set data = excluded.data, at = now();
end $$;
revoke all on function s1.carnet_send(int, jsonb) from public, anon;
grant execute on function s1.carnet_send(int, jsonb) to authenticated;

create or replace function s1.carnet_admin(p_weeks int default 4) returns table (week int, data jsonb, at timestamptz)
  language plpgsql stable security definer set search_path = s1, public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à Mathis.'; end if;
  return query select c.week, c.data, c.at from carnets c
    where c.week >= floor(extract(epoch from now()) / 604800)::int - greatest(1, least(coalesce(p_weeks, 4), 52))
    order by c.at desc limit 1000;
end $$;
revoke all on function s1.carnet_admin(int) from public, anon;
grant execute on function s1.carnet_admin(int) to authenticated;

reset search_path;

-- ======================== supabase/percos_data.sql ========================
set search_path = s1, public;
-- Généré par tools/build_percos.js — ne pas modifier à la main.
-- Zones et donjons où un Percepteur peut se poser, et contenu d'une poche pleine (12 h).
create table if not exists s1.perco_zones (sid text primary key, name text not null, lvl int not null, cap jsonb not null);
alter table s1.perco_zones add column if not exists kind text not null default 'zone'; -- 1.0.30 : 'zone' ou 'dj' (donjon)
alter table s1.perco_zones enable row level security;
insert into s1.perco_zones (sid, name, lvl, cap, kind) values
('inc_route', 'Route des âmes', 3, '{"k":5000,"res":{"Cendres Éternelles":177,"Feu Intérieur":177,"Viande Intangible":177},"eq":[{"tpl":"i188","s":{"sa":[7,10]}}]}'::jsonb, 'zone'),
('inc_champs', 'Champs', 4, '{"k":6667,"res":{"Poudre de Perlinpainpain":177,"Viande Intangible":177,"Blé":150,"Pétale Diaphane":133,"Plume Chimérique":44,"Œuf Chimérique":44},"eq":[{"tpl":"i8538","s":{"vit":[7,10],"cha":[4,6]}},{"tpl":"i12756","s":{"sa":[4,5],"pui":[7,10]}},{"tpl":"i864","s":{"cha":[7,10],"de":[1,1]}},{"tpl":"i9974","s":{"vit":[5,7]}}]}'::jsonb, 'zone'),
('inc_lac', 'Lac', 5, '{"k":8333,"res":{"Eau Potable":176,"Peau de Gloot":176,"Viande Intangible":176,"Goujon":150},"eq":[{"tpl":"i837","s":{"fo":[7,10],"dt":[1,1]}},{"tpl":"i850","s":{"age":[3,5]}},{"tpl":"i17508","s":{"vit":[6,10],"cha":[6,10],"de":[2,3]}},{"tpl":"i949","s":{"vit":[11,15]}}]}'::jsonb, 'zone'),
('inc_paturages', 'Pâturages', 6, '{"k":10000,"res":{"Bave de Bouftou":176,"Laine Céleste":176,"Viande Intangible":176,"Ortie":150},"eq":[{"tpl":"i8533","s":{"age":[4,6],"sa":[3,4]}},{"tpl":"i2587","s":{"vit":[7,10]}},{"tpl":"i263","s":{"age":[9,12],"da":[1,1]}},{"tpl":"i14601","s":{"vit":[11,15],"cha":[11,15]}}]}'::jsonb, 'zone'),
('inc_foret', 'Forêt', 7, '{"k":11667,"res":{"Cendres Éternelles":174,"Queue de Chapardam":174,"Viande Intangible":174,"Bois de Frêne":150},"eq":[{"tpl":"i851","s":{"vit":[7,10]}},{"tpl":"i134","s":{"ine":[3,5]}},{"tpl":"i19622","s":{"pui":[3,4]}},{"tpl":"i697","s":{"fo":[7,10]}}]}'::jsonb, 'zone'),
('inc_mine', 'Mine', 7, '{"k":11667,"res":{"Fer":300,"Cendres Éternelles":174,"Viande Intangible":174,"Volve d''Aminite":174,"Poudre d''Aminite":144},"eq":[{"tpl":"i280","s":{"vit":[7,10],"cha":[7,10]}},{"tpl":"i12421","s":{"fo":[-15,-15],"ine":[-15,-15],"cha":[-15,-15],"age":[-15,-15]}},{"tpl":"i1503","s":{"ine":[5,7],"cri":[2,2]}},{"tpl":"i325","s":{"age":[5,7],"da":[2,2]}}]}'::jsonb, 'zone'),
('inc_cimetiere', 'Cimetière', 8, '{"k":13333,"res":{"Os de Chafer":174,"Relique d''Incarnam":174,"Viande Intangible":174},"eq":[{"tpl":"i12753","s":{"vit":[11,15],"do":[1,2]}},{"tpl":"i16505","s":{"cri":[-5,-5]}},{"tpl":"i14798","s":{"cri":[2,2]}},{"tpl":"i121","s":{"age":[7,10]}}]}'::jsonb, 'zone'),
('ast_cite', 'Cité d''Astrub', 13, '{"k":21667,"res":{"Oueille":300,"Pollenectar":300,"Échantillon de viande contaminée":300,"Viande Hachée":171,"Plume de Piou Bleu":29,"Plume de Piou Jaune":29,"Plume de Piou Rose":29,"Plume de Piou Rouge":29},"eq":[{"tpl":"i8235","s":{"vit":[21,30],"so":[4,5]}},{"tpl":"i8239","s":{"sa":[7,10],"ini":[31,50]}},{"tpl":"i773","s":{"vit":[16,20],"age":[11,15]}},{"tpl":"i8238","s":{"sa":[7,10],"de":[1,1]}}]}'::jsonb, 'zone'),
('ast_souterrains', 'Souterrains d''Astrub', 13, '{"k":21667,"res":{"Viande Hachée":171,"Bec du Tofu":43,"Intestin d''Araknosé":43,"Poils d''Arakne Malade":43,"Œil d''Arakmuté":43,"Peau Égrotante":28,"Sachet de Poudre Temporelle":2,"Sachet de Haricots":1},"eq":[{"tpl":"i1366","s":{"vit":[11,15],"fo":[5,7],"ine":[5,7]}},{"tpl":"i6925","s":{"vit":[7,10],"cri":[2,2],"dn":[1,1],"dt":[1,1],"df":[1,1],"de":[1,1],"da":[1,1]}},{"tpl":"i8111","s":{"vit":[21,30],"ine":[11,15],"age":[11,15]}},{"tpl":"i8114","s":{"vit":[31,40],"sa":[11,15]}}]}'::jsonb, 'zone'),
('ast_prairies', 'Prairies d''Astrub', 18, '{"k":30000,"res":{"Morceau de larve":300,"Oueille":300,"Pollenectar":300,"Viande Faisandée":124,"Grappe d''Œufs de larve":75,"Œil de Larve bleue":75,"Peau de Larve Bleue":41,"Peau de Larve Jaune":41},"eq":[{"tpl":"i6961","s":{"vit":[16,20],"cri":[2,2]}},{"tpl":"i165","s":{"ine":[9,12],"df":[1,1]}},{"tpl":"i734","s":{"fo":[16,20]}},{"tpl":"i355","s":{"fo":[11,15],"cha":[11,15]}}]}'::jsonb, 'zone'),
('ast_champs', 'Champs d''Astrub', 18, '{"k":30000,"res":{"Oueille":300,"Pollenectar":300,"Viande Faisandée":165,"Poire d''Épouvanteur":75,"Poire de Pissenlit":75,"Poire de Rose":75,"Poire de Tournesol":75,"Fleur de Pissenlit Diabolique":41},"eq":[{"tpl":"i6924","s":{"vit":[16,20],"pui":[7,10]}},{"tpl":"i775","s":{"vit":[26,30],"cri":[3,3]}},{"tpl":"i357","s":{"vit":[21,25],"age":[7,10],"da":[1,1]}},{"tpl":"i327","s":{"fo":[16,20]}}]}'::jsonb, 'zone'),
('ast_calanques', 'Calanques d''Astrub', 18, '{"k":30000,"res":{"Oueille":300,"Pollenectar":300,"Viande Faisandée":165,"Conque Marine":41,"Crème à bronzer":41,"Nageoire de Compétition":41,"Serviette de Plage":41,"Écaille poisseuse":28},"eq":[{"tpl":"i8255","s":{"vit":[7,10],"cha":[16,20],"cri":[2,2]}},{"tpl":"i8256","s":{"vit":[21,25],"age":[16,20]}},{"tpl":"i8259","s":{"vit":[11,15],"cha":[11,15],"de":[2,3]}},{"tpl":"i8253","s":{"vit":[16,20],"cha":[16,20],"cri":[2,2]}}]}'::jsonb, 'zone'),
('ast_tainela', 'Tainéla', 26, '{"k":43333,"res":{"Oueille":300,"Pollenectar":300,"Viande Frelatée":159,"Corne de Boufton":40,"Laine de Boufton Noir":40,"Laine de Bouftou":40,"Laine du Chef de Guerre Bouftou":40,"Sang de Bouftou":26},"eq":[{"tpl":"i2411","s":{"fo":[16,20],"ine":[16,20]}},{"tpl":"i2416","s":{"vit":[16,20]}},{"tpl":"i2419","s":{"vit":[21,30],"ini":[71,100]}},{"tpl":"i2428","s":{"fo":[11,15],"ine":[11,15]}}]}'::jsonb, 'zone'),
('ast_foret', 'Forêt d''Astrub', 26, '{"k":43333,"res":{"Oueille":300,"Pollenectar":300,"Viande Frelatée":119,"Viande Salée":45,"Défense du Sanglier":40,"Noisette":40,"Pic de Prespic":40,"Poils du Milimulou":40},"eq":[{"tpl":"i6722","s":{"vit":[16,20],"df":[2,2],"ini":[71,100]}},{"tpl":"i6926","s":{"vit":[21,30],"sa":[11,15],"df":[2,3]}},{"tpl":"i6724","s":{"vit":[26,30],"ine":[16,20],"so":[2,2]}},{"tpl":"i2710","s":{"age":[11,20],"cri":[3,5],"ini":[41,65]}}]}'::jsonb, 'zone'),
('ast_carrieres', 'Carrière d''Astrub', 26, '{"k":43333,"res":{"Oueille":300,"Pollenectar":300,"Viande Frelatée":159,"Casque de Martoa":40,"Gant de Sherpoa":40,"Oreille de Douzdoa":40,"Œil de Pikdoa":40,"Pierre de Granit":27},"eq":[{"tpl":"i2641","s":{"age":[41,50]}},{"tpl":"i704","s":{"vit":[41,50],"age":[41,50]}},{"tpl":"i18640","s":{"age":[16,25],"cri":[1,2]}},{"tpl":"i10964","s":{"ine":[16,20],"age":[16,20],"cri":[2,3]}}]}'::jsonb, 'zone'),
('ast_egouts', 'Égouts d''Astrub', 26, '{"k":43333,"res":{"Viande Frelatée":119,"Crottes de Milirat":75,"Crocs de Rats":40,"Cuir de Scélérat Strubien":40,"Gland":40,"Laine de Ramane Strubien":40,"Viande Hachée":40,"Crinière de Scélérat Strubien":7},"eq":[{"tpl":"i696","s":{"pui":[16,20],"cri":[2,2]}},{"tpl":"i484","s":{"vit":[21,25],"fo":[21,30],"cri":[2,3]}},{"tpl":"i9412","s":{"age":[11,20],"cri":[3,5],"ini":[41,65]}},{"tpl":"i781","s":{"ine":[21,35]}}]}'::jsonb, 'zone'),
('ast_cimetiere', 'Cimetière d''Astrub', 36, '{"k":60000,"res":{"Oueille":300,"Pollenectar":300,"Viande Minérale":153,"Ceinture de Gargrouille":75,"Cuir de Gargrouille":38,"Cuir de Ouassingue":38,"Dent de Garglyphe":38,"Estomac de Ouassingue":38},"eq":[{"tpl":"i7107","s":{"vit":[21,30],"ine":[21,25],"age":[16,20],"so":[4,5]}},{"tpl":"i10627","s":{"fo":[11,15],"sa":[6,10]}},{"tpl":"i10171","s":{"age":[21,30],"do":[2,3]}},{"tpl":"i12887","s":{"age":[16,20]}}]}'::jsonb, 'zone'),
('ast_planque', 'Planque des Vilinsekts', 36, '{"k":60000,"res":{"Caissette de Babioles":300,"Antennes de Vilinsekt":153,"Viande Minérale":153,"Rondelle de Bois":25,"Kamiam":18,"Sachet de Cerises":3}}'::jsonb, 'zone'),
('ama_campagne', 'Campagne d''Amakna', 18, '{"k":30000,"res":{"Oueille":300,"Pollenectar":300,"Viande Faisandée":165,"Ailes de Moskito":41,"Graine de Pavot":41,"Patte d''Arakne":41,"Épine du Champ Champ":41,"Bois Vermoulu":7},"eq":[{"tpl":"i6913","s":{"age":[7,10],"cri":[2,2]}},{"tpl":"i6911","s":{"vit":[11,15]}},{"tpl":"i6912","s":{"vit":[16,20],"age":[7,10]}},{"tpl":"i6919","s":{"vit":[16,20]}}]}'::jsonb, 'zone'),
('ama_foret', 'Forêt d''Amakna', 28, '{"k":46667,"res":{"Oueille":300,"Pollenectar":300,"Viande Faisandée":81,"Viande Frelatée":78,"Viande Salée":45,"Épine du Champ Champ":41,"Défense du Sanglier":40,"Pic de Prespic":40},"eq":[{"tpl":"i6919","s":{"vit":[16,20]}},{"tpl":"i6922","s":{"vit":[21,30]}},{"tpl":"i6920","s":{"vit":[16,20]}},{"tpl":"i6722","s":{"vit":[16,20],"df":[2,2],"ini":[71,100]}}]}'::jsonb, 'zone'),
('ama_cryptes_entree', 'Entrée des Cryptes', 21, '{"k":35000,"res":{"Cobaye Noeul":150,"Pollenectar":150,"Viande Faisandée":81,"Poils de souris":15,"Noeul Mort":14,"Sachet de Poudre de Perlinpainpain":3}}'::jsonb, 'zone'),
('ama_bouftous', 'Coin des Bouftous', 26, '{"k":43333,"res":{"Oueille":300,"Pollenectar":300,"Viande Frelatée":159,"Corne de Boufton":40,"Laine de Boufton Noir":40,"Laine de Bouftou":40,"Laine du Chef de Guerre Bouftou":40,"Sang de Bouftou":26},"eq":[{"tpl":"i2411","s":{"fo":[16,20],"ine":[16,20]}},{"tpl":"i2416","s":{"vit":[16,20]}},{"tpl":"i2419","s":{"vit":[21,30],"ini":[71,100]}},{"tpl":"i2428","s":{"fo":[11,15],"ine":[11,15]}}]}'::jsonb, 'zone'),
('ama_boos', 'Coin des Boos', 26, '{"k":43333,"res":{"Oueille":300,"Pollenectar":300,"Viande Frelatée":159,"Boue du Boo":40,"Corne de Boufton":40,"Laine de Boufton Noir":40,"Laine de Bouftou":40,"Sang de Bouftou":20},"eq":[{"tpl":"i2411","s":{"fo":[16,20],"ine":[16,20]}},{"tpl":"i2416","s":{"vit":[16,20]}},{"tpl":"i2419","s":{"vit":[21,30],"ini":[71,100]}},{"tpl":"i2640","s":{"vit":[21,30],"age":[21,30],"so":[4,5]}}]}'::jsonb, 'zone'),
('ama_citwouilles', 'Champ de citwouilles', 29, '{"k":48333,"res":{"Graines de Citwouille Maudites":300,"Viande Minérale":147,"Sachet de Poudre de Perlinpainpain":3}}'::jsonb, 'zone'),
('ama_cimetiere', 'Cimetière', 34, '{"k":56667,"res":{"Pollenectar":300,"Viande Minérale":152,"Dent de Chafer":150,"Échantillon de Créature Contaminée":50,"Aile du Tofu Maléfique":26,"Os Invisible du Chafer Invisible":26,"Os de Chafer":26,"Œil de Kwoan":26},"eq":[{"tpl":"i8162","s":{"vit":[1,5],"ini":[1,10]}},{"tpl":"i12023","s":{"vit":[21,30],"cha":[16,25],"sa":[7,10]}},{"tpl":"i759","s":{"vit":[31,40],"rn":[2,2],"rt":[2,2],"rf":[2,2],"re":[2,2],"ra":[2,2]}},{"tpl":"i339","s":{"vit":[31,40],"ine":[-30,-30],"cha":[21,30],"cri":[2,3]}}]}'::jsonb, 'zone'),
('ama_ingalsse', 'Champ des Ingalsse', 36, '{"k":60000,"res":{"Oueille":300,"Pollenectar":300,"Viande Minérale":122,"Phéromone de Tofu":60,"Dent de Tofu Mutant":31,"Patte de Tofukaz":31,"Plume de Tofu":31,"Viande Faisandée":31},"eq":[{"tpl":"i708","s":{"cha":[31,40],"cri":[2,2]}},{"tpl":"i9575","s":{"vit":[41,50],"sa":[16,20],"do":[4,5],"dcri":[7,10]}},{"tpl":"i16240","s":{"vit":[11,15],"fo":[11,15],"sa":[11,15],"pui":[11,15]}},{"tpl":"i1482","s":{"fo":[41,60],"age":[-60,-60],"sa":[16,20],"do":[2,2]}}]}'::jsonb, 'zone'),
('ama_gobelins', 'Campement des Gobelins', 36, '{"k":60000,"res":{"Oueille":300,"Pollenectar":300,"Viande Minérale":153,"Bonnet de Gobaliste":38,"Longue-vue de Gob-Trotteur":38,"Pic de Lance de Gobet":38,"Tambour de Gobaladée":38,"Canine de Gobelin":25},"eq":[{"tpl":"i10632","s":{"vit":[21,30],"age":[16,25],"do":[2,3]}}]}'::jsonb, 'zone'),
('ama_bworks', 'Campement des Bworks', 42, '{"k":70000,"res":{"Oueille":250,"Pollenectar":250,"Bière bwork":72,"Viande Tendre":72,"Viande Minérale":51,"Capsule Explosive":48,"Noix de Pécan":48,"Gâtrool Industriel":30},"eq":[{"tpl":"i1436","s":{"vit":[-50,-50],"cha":[31,40],"age":[21,30],"sa":[16,20]}},{"tpl":"i1639","s":{"vit":[31,40],"fo":[-20,-20],"age":[21,30],"sa":[11,15],"rn":[2,3],"ra":[2,3]}},{"tpl":"i3203","s":{"sa":[7,10],"cri":[2,3],"ini":[51,100]}},{"tpl":"i1132","s":{"vit":[61,90],"ine":[-90,-90],"sa":[16,20],"pa":[1,1]}}]}'::jsonb, 'zone'),
('ama_cryptes', 'Cryptes du cimetière', 42, '{"k":70000,"res":{"Pollenectar":250,"Dent de Chafer":125,"Viande Minérale":76,"Viande Tendre":60,"Cervelle de vampire":50,"Sang de Vampire":38,"Aile du Tofu Maléfique":37,"Canine Vampiresque":37},"eq":[{"tpl":"i8162","s":{"vit":[1,5],"ini":[1,10]}},{"tpl":"i13298","s":{"sa":[16,20],"da":[2,3]}},{"tpl":"i2094","s":{"vit":[21,30],"rn":[2,2],"rt":[2,2],"rf":[2,2],"re":[2,2],"ra":[2,2]}},{"tpl":"i12023","s":{"vit":[21,30],"cha":[16,25],"sa":[7,10]}}]}'::jsonb, 'zone'),
('ama_scarafeuilles', 'Plaine des Scarafeuilles', 38, '{"k":63333,"res":{"Oueille":300,"Pollenectar":300,"Viande Minérale":150,"Œufs de Scarafeuille":150,"Ailes de Scarafeuille Blanc":38,"Ailes de Scarafeuille Bleu":38,"Ailes de Scarafeuille Rouge":38,"Ailes de Scarafeuille Vert":38},"eq":[{"tpl":"i1075","s":{"vit":[21,30],"fo":[21,30],"cha":[16,20],"do":[2,3]}},{"tpl":"i777","s":{"cha":[11,15]}},{"tpl":"i7246","s":{"vit":[21,30],"cha":[7,10],"ini":[101,150],"re":[2,2]}},{"tpl":"i9193","s":{"fo":[1,20],"pui":[1,10],"cri":[1,3],"ini":[1,50],"rt":[1,5]}}]}'::jsonb, 'zone'),
('ama_foret_malefique', 'Bord de la forêt maléfique', 39, '{"k":65000,"res":{"Oueille":300,"Pollenectar":300,"Viande Minérale":150,"Lamelle de Champa Bleu":38,"Lamelle de Champa Marron":38,"Lamelle de Champa Rouge":38,"Lamelle de Champa Vert":38,"Champignon Luidegît":25},"eq":[{"tpl":"i640","s":{"age":[31,40],"pui":[16,20]}},{"tpl":"i10643","s":{"vit":[16,25],"cha":[16,25],"cri":[1,2],"ini":[51,100]}},{"tpl":"i10976","s":{"fo":[16,20],"sa":[6,10],"dt":[2,3]}},{"tpl":"i6993","s":{"vit":[41,60],"pui":[11,15],"cri":[4,5],"so":[7,10]}}]}'::jsonb, 'zone'),
('ama_bandits', 'Territoire des Bandits', 43, '{"k":71667,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":145,"Bougie Rouge":75,"Contrat entre Vil Smisse et Yse Vewybad":75,"Âme de Boulanger Sombre":75,"Âme de Forgeron Sombre":75,"Âme de Mineur Sombre":75},"eq":[{"tpl":"i10851","s":{"vit":[41,50],"cha":[21,30]}},{"tpl":"i10850","s":{"vit":[41,50],"fo":[26,35],"pui":[11,15]}},{"tpl":"i13139","s":{"vit":[16,20],"cri":[2,2],"da":[2,3]}},{"tpl":"i13137","s":{"vit":[41,60],"pui":[21,25],"cri":[2,2],"df":[5,5]}}]}'::jsonb, 'zone'),
('ama_craqueleurs', 'Montagne des Craqueleurs', 46, '{"k":76667,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":144,"Griffes de Kwak":64,"Cuir du Cochon de Lait":16,"Plume du Kwak de Flamme":16,"Plume du Kwak de Glace":16,"Plume du Kwak de Terre":16},"eq":[{"tpl":"i6750","s":{"vit":[21,30],"cha":[21,30],"cri":[2,3],"re":[2,3]}},{"tpl":"i1035","s":{"cha":[26,35],"age":[31,40],"cri":[2,3],"de":[2,3],"da":[2,3]}},{"tpl":"i6513","s":{"vit":[21,30],"age":[21,30],"pui":[7,10]}},{"tpl":"i6732","s":{"cha":[16,20],"re":[4,5]}}]}'::jsonb, 'zone'),
('ama_rivage_sufokien', 'Rivage sufokien', 46, '{"k":76667,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":144,"Gros Boulet":75,"Moumoule":75,"Moumoules frites":36,"Paupière d''Étoile":36,"Pince de Crabe":36},"eq":[{"tpl":"i2592","s":{"vit":[21,30],"ine":[21,30],"sa":[11,15]}}]}'::jsonb, 'zone'),
('ama_passage_brakmar', 'Passage vers Brâkmar', 46, '{"k":76667,"res":{"Oueille":200,"Pollenectar":200,"Bougie Rouge":100,"Âme de Forgeron Sombre":100,"Âme de Mineur Sombre":100,"Viande Tendre":96,"Bourse Suspecte":48,"Chaînes Brisées":48},"eq":[{"tpl":"i11395","s":{"vit":[31,40],"fo":[16,25],"age":[16,25],"cri":[2,3],"do":[3,4]}},{"tpl":"i10854","s":{"fo":[16,20],"sa":[16,20],"do":[1,2],"dt":[2,3],"ini":[51,100]}},{"tpl":"i10850","s":{"vit":[41,50],"fo":[26,35],"pui":[11,15]}},{"tpl":"i13139","s":{"vit":[16,20],"cri":[2,2],"da":[2,3]}}]}'::jsonb, 'zone'),
('ama_marecages', 'Marécages d''Amakna', 56, '{"k":93333,"res":{"Oueille":200,"Pollenectar":200,"Viande Avariée":85,"Dent de Crocodaille":48,"Viande Tendre":48,"Main de Boo":43,"Écaille de Chef Crocodaille":42,"Os de Crocodaille":15},"eq":[{"tpl":"i1719","s":{"vit":[21,30],"ine":[31,40],"rf":[4,5]}}]}'::jsonb, 'zone'),
('ama_cloaque', 'Cloaque d''Amakna', 56, '{"k":93333,"res":{"Viande Ladre":138,"Oreille de Guerrier Mental":35,"Peau de Ramane d''Égoutant":35,"Poil de Rat d''Égoutant":35,"Queue de Rat d''Hyoactif":35,"Peau de Rat":23,"Page déchirée":19,"Deuxième clef du Donjon de Sphincter":15},"eq":[{"tpl":"i2373","s":{"vit":[61,80],"ine":[-20,-20],"age":[41,50],"sa":[21,30],"ra":[4,5]}},{"tpl":"i234","s":{"vit":[11,20],"ine":[36,45],"sa":[36,45]}},{"tpl":"i10846","s":{"vit":[41,50],"pui":[21,30],"ini":[201,250]}},{"tpl":"i8867","s":{"vit":[41,60],"cha":[21,30],"age":[31,40],"so":[2,3]}}]}'::jsonb, 'zone'),
('ama_gelees', 'Péninsule des gelées', 58, '{"k":96667,"res":{"Jus Concentré de Gelée":300,"Oueille":300,"Pollenectar":300,"Viande Ladre":137,"Confiture Bleue":100,"Confiture Fraise":100,"Confiture Menthe":100,"Eau Potable":46},"eq":[{"tpl":"i2447","s":{"vit":[41,50],"ine":[21,30],"sa":[21,30],"so":[4,6],"pp":[16,20]}},{"tpl":"i2471","s":{"vit":[41,60],"ine":[41,50],"cri":[4,5]}},{"tpl":"i2470","s":{"pp":[1,15]}}]}'::jsonb, 'zone'),
('ama_pitons', 'Pitons Rocheux des Craqueleurs', 65, '{"k":108333,"res":{"Oueille":250,"Pollenectar":250,"Viande Avariée":108,"Cobaye Craqueleur":50,"Caillou Craquelé de Cania":38,"Charbon":22,"Fragment de Pierre Pointue":22,"Pierre du Craqueleur":22},"eq":[{"tpl":"i14311","s":{"vit":[31,50],"age":[21,30],"cri":[2,3],"da":[3,4]}},{"tpl":"i2595","s":{"vit":[31,40],"fo":[31,40],"sa":[16,20],"ini":[151,200]}},{"tpl":"i910","s":{"vit":[31,40],"age":[31,40],"sa":[21,30],"cri":[3,4],"do":[2,3]}},{"tpl":"i6930","s":{"vit":[41,60],"fo":[21,30],"cha":[21,30],"sa":[16,20],"pp":[7,10],"re":[3,5]}}]}'::jsonb, 'zone'),
('ama_porcos', 'Territoire des Porcos', 89, '{"k":148333,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":113,"Cuir de Porsalu":57,"Peau de Cochon de Farle":54,"Saucisson de Farle":38,"Ivoire":19,"Sachet de Poivre":3}}'::jsonb, 'zone'),
('ama_dark_vlad', 'Dédale du Dark Vlad', 145, '{"k":241667,"res":{"Baie maléfique":240,"Oueille":240,"Pollenectar":240,"Viande de Brousse":58,"Miroir de Dopeul":38,"Bolas de Maltrio":14,"Pic de Malépik":14,"Porte-bonheur de Malalfa":14},"eq":[{"tpl":"i26309","s":{"vit":[201,250],"sa":[16,25],"so":[16,20],"rf":[5,7],"ra":[5,7]}},{"tpl":"i26308","s":{"vit":[151,200],"sa":[21,30],"so":[7,10],"rn":[5,7]}},{"tpl":"i26310","s":{"vit":[201,250],"sa":[31,40],"so":[21,30],"ini":[251,400],"rt":[5,7],"re":[5,7]}}]}'::jsonb, 'zone'),
('can_rives_lac', 'Rives du Lac de Cania', 26, '{"k":43333,"res":{"Oueille":300,"Pollenectar":300,"Viande Frelatée":162,"Bout de Blop Coco":41,"Bout de Blop Griotte":41,"Bout de Blop Indigo":41,"Bout de Blop Reinette":41,"Blop mort":27}}'::jsonb, 'zone'),
('can_baie', 'Baie de Cania', 41, '{"k":68333,"res":{"Oueille":300,"Pollenectar":300,"Testicules de Dopeul":300,"Miroir de Dopeul":147,"Viande Minérale":147,"Pierre de Dopeul":7,"Sachet de Haricots":3}}'::jsonb, 'zone'),
('can_dopeuls', 'Village des Dopeuls', 41, '{"k":68333,"res":{"Oueille":300,"Pollenectar":300,"Testicules de Dopeul":300,"Viande Minérale":147,"Miroir de Dopeul":80,"Papier Charbon":67,"Pierre de Dopeul":7,"Sachet de Haricots":3}}'::jsonb, 'zone'),
('can_routes', 'Routes Rocailleuses', 57, '{"k":95000,"res":{"Oueille":208,"Pollenectar":208,"Viande Avariée":69,"Bougie Rouge":46,"Viande Ladre":32,"Boîte à Serpentin":23,"Kanigrou Peureux":23,"Âme de Mineur Sombre":23},"eq":[{"tpl":"i6934","s":{"fo":[11,15],"cha":[11,15],"pa":[1,1],"rt":[1,2]}},{"tpl":"i13139","s":{"vit":[16,20],"cri":[2,2],"da":[2,3]}},{"tpl":"i1363","s":{"vit":[41,60],"fo":[21,30],"cha":[-30,-30],"sa":[16,20],"pui":[7,10]}},{"tpl":"i2498","s":{"vit":[41,60],"ine":[-40,-40],"cha":[-40,-40]}}]}'::jsonb, 'zone'),
('can_porkass', 'Plaine des Porkass', 45, '{"k":75000,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":181,"Groin de Sanglier des Plaines":37,"Cuir de Porkass":36,"Cuir du Cochon de Lait":36,"Trident Cassé":36,"Côtes de Porkass":6},"eq":[{"tpl":"i733","s":{"vit":[21,30],"fo":[11,20],"ine":[11,20],"cha":[11,30],"age":[11,20],"pp":[2,5]}},{"tpl":"i12671","s":{"vit":[31,40],"fo":[21,30],"sa":[11,15],"dt":[7,10],"rt":[3,4]}},{"tpl":"i10848","s":{"vit":[-30,-30],"ine":[-15,-15],"age":[-15,-15],"dt":[3,4]}},{"tpl":"i13582","s":{"vit":[21,30],"cri":[3,4],"do":[3,3],"ini":[151,200],"dcri":[5,7]}}]}'::jsonb, 'zone'),
('can_champs', 'Champs de Cania', 58, '{"k":96667,"res":{"Oueille":300,"Pollenectar":300,"Viande Ladre":137,"Boîte à Serpentin":75,"Grande peau de larve champêtre":75,"Aile de Bourdard":35,"Peau de serpentin":35,"Dent de Larve Champêtre":34},"eq":[{"tpl":"i2485","s":{"vit":[41,50],"age":[31,40],"da":[2,2],"pp":[7,10]}},{"tpl":"i2498","s":{"vit":[41,60],"ine":[-40,-40],"cha":[-40,-40]}},{"tpl":"i2489","s":{"vit":[21,30],"pui":[21,30],"cri":[2,3],"do":[5,7]}},{"tpl":"i6953","s":{"vit":[21,25],"age":[16,20],"rt":[2,2]}}]}'::jsonb, 'zone'),
('can_lac', 'Lac de Cania', 56, '{"k":93333,"res":{"Oueille":300,"Pollenectar":300,"Viande Ladre":138,"Bout de Blop Coco":35,"Bout de Blop Griotte":35,"Bout de Blop Indigo":35,"Bout de Blop Reinette":35,"Blop mort":23},"eq":[{"tpl":"i9123","s":{"fo":[16,20]}},{"tpl":"i9122","s":{"ine":[16,20]}},{"tpl":"i9150","s":{"vit":[41,50],"fo":[26,35],"sa":[11,15],"cri":[4,5]}},{"tpl":"i9124","s":{"age":[16,20]}}]}'::jsonb, 'zone'),
('can_massif', 'Massif de Cania', 59, '{"k":98333,"res":{"Pollenectar":300,"Viande Ladre":137,"Boulon en bon état":90,"Chaîne de Robot Fléau":35,"Coque Endommagée":35,"Charnière Cassée":34,"Griffe de Robionicle":34,"Bidule inutile":6},"eq":[{"tpl":"i6470","s":{"vit":[16,20],"cha":[16,20]}},{"tpl":"i1651","s":{"fo":[46,65],"ine":[-65,-65],"cha":[16,20],"age":[26,35],"do":[4,5],"ini":[251,300]}},{"tpl":"i9158","s":{"vit":[21,35],"ine":[11,15],"pui":[11,15],"pp":[1,5],"ini":[101,150]}},{"tpl":"i2638","s":{"vit":[41,60],"fo":[21,30],"age":[21,30],"do":[2,3],"ini":[251,300]}}]}'::jsonb, 'zone'),
('can_plaines', 'Plaines Rocheuses', 65, '{"k":108333,"res":{"Oueille":300,"Pollenectar":300,"Viande Avariée":130,"Caillou Craquelé de Cania":75,"Charbon":33,"Fragment de Pierre Pointue":32,"Œil de Craquelope":32,"Fragment de Pierre Polie":11},"eq":[{"tpl":"i6934","s":{"fo":[11,15],"cha":[11,15],"pa":[1,1],"rt":[1,2]}},{"tpl":"i910","s":{"vit":[31,40],"age":[31,40],"sa":[21,30],"cri":[3,4],"do":[2,3]}},{"tpl":"i18664","s":{"vit":[51,70],"fo":[16,25],"cha":[16,25],"xn":[3,6],"xt":[3,6],"xf":[3,6],"xe":[3,6],"xa":[3,6]}},{"tpl":"i6933","s":{"vit":[21,30],"fo":[7,10],"cha":[7,10],"rt":[2,3]}}]}'::jsonb, 'zone'),
('can_pics', 'Pics de Cania', 86, '{"k":143333,"res":{"Oueille":300,"Pollenectar":300,"Viande Rassie":117,"Botte trouée de Mégabwork":29,"Oreille de Médibwork":29,"Peau de Krambwork":29,"Tissu Pourpre":29,"Cuir Violet de Mégabwork":5},"eq":[{"tpl":"i6775","s":{"vit":[31,40],"age":[26,35],"sa":[16,20],"re":[2,3],"ra":[2,3]}},{"tpl":"i7012","s":{"vit":[51,70],"ine":[31,40],"pa":[1,1],"pp":[11,15]}},{"tpl":"i8298","s":{"vit":[21,30],"cha":[21,30],"sa":[7,10],"pa":[1,1],"pp":[4,5]}},{"tpl":"i8304","s":{"vit":[61,80],"sa":[21,30],"do":[2,3],"pp":[7,10],"ra":[4,5]}}]}'::jsonb, 'zone'),
('can_penates', 'Pénates du Corbac', 106, '{"k":176667,"res":{"Oueille":300,"Pollenectar":300,"Pierre de Topaze":102,"Viande Séchée":102,"Patte de Corbac":26,"Plume de Buveur":26,"Plume de Corbac Apprivoisé":26,"Poil de Renarbo":26},"eq":[{"tpl":"i18673","s":{"vit":[86,110],"fo":[31,40],"ine":[31,40],"sa":[16,20],"so":[7,10],"rt":[3,5],"rf":[3,5]}},{"tpl":"i7155","s":{"vit":[151,200],"sa":[21,40]}},{"tpl":"i6449","s":{"vit":[101,150],"ine":[31,40],"age":[31,40],"sa":[16,20],"cri":[2,3],"ra":[4,7]}},{"tpl":"i2544","s":{"vit":[101,150],"ine":[41,50],"age":[41,50],"sa":[16,20],"cri":[1,2],"df":[4,6],"da":[4,6],"rn":[2,3],"ra":[2,3]}}]}'::jsonb, 'zone'),
('can_bibliotheque', 'Bibliothèque du Maître Corbac', 106, '{"k":176667,"res":{"Oueille":214,"Pollenectar":214,"Pierre de Topaze":102,"Viande Séchée":102,"Plume de Buveur":29,"Plume de Corbac Apprivoisé":29,"Poil de Renarbo":29,"Patte de Corbac":15},"eq":[{"tpl":"i18673","s":{"vit":[86,110],"fo":[31,40],"ine":[31,40],"sa":[16,20],"so":[7,10],"rt":[3,5],"rf":[3,5]}},{"tpl":"i7155","s":{"vit":[151,200],"sa":[21,40]}},{"tpl":"i6449","s":{"vit":[101,150],"ine":[31,40],"age":[31,40],"sa":[16,20],"cri":[2,3],"ra":[4,7]}},{"tpl":"i2544","s":{"vit":[101,150],"ine":[41,50],"age":[41,50],"sa":[16,20],"cri":[1,2],"df":[4,6],"da":[4,6],"rn":[2,3],"ra":[2,3]}}]}'::jsonb, 'zone'),
('can_cirque', 'Cirque de Cania', 116, '{"k":193333,"res":{"Cuisse de truche":300,"Morceau de Truche":300,"Oueille":300,"Pollenectar":300,"Viande Persillée":89,"Truchmuche":75,"Duvet de Truchon":23,"Plume de Truchideur":23}}'::jsonb, 'zone'),
('can_litneg', 'Bois de Litneg', 116, '{"k":193333,"res":{"Oueille":240,"Pollenectar":240,"Viande Saignante":93,"Dent de Chafer":60,"Os de Trooll":60,"Casque Cassé du Chafer":19,"Colonne Vertébrale":19,"Crinière de Troollaraj":19},"eq":[{"tpl":"i7219","s":{"fo":[21,25],"ine":[21,25],"cha":[21,25],"age":[21,25],"sa":[16,20]}},{"tpl":"i13022","s":{"vit":[26,35],"fo":[26,35],"sa":[11,15],"cri":[1,2],"ini":[101,150]}},{"tpl":"i3357","s":{"fo":[21,25],"ine":[21,25],"pui":[11,15],"dn":[2,3],"ini":[201,300]}},{"tpl":"i6450","s":{"vit":[71,100],"sa":[31,50],"do":[6,8],"pp":[9,13],"rt":[4,5],"rf":[4,5],"re":[4,5],"xf":[6,10],"xe":[6,10],"xa":[6,10]}}]}'::jsonb, 'zone'),
('can_landes', 'Landes de Cania', 143, '{"k":238333,"res":{"Oueille":300,"Pollenectar":300,"Musc de gliglitch":60,"Pierre d''Aigue-Marine":59,"Viande de Brousse":59,"Fragment de Pierre Pointue":17,"Viande Avariée":17,"Cuir de Gliglibido":15},"eq":[{"tpl":"i8091","s":{"vit":[101,150],"fo":[21,35],"ine":[21,35],"age":[21,35],"sa":[16,25],"do":[3,5],"pp":[11,15]}},{"tpl":"i8096","s":{"vit":[101,150],"cha":[21,40],"sa":[26,40],"pui":[16,25],"do":[6,10],"rn":[5,7],"rt":[5,7]}},{"tpl":"i7158","s":{"vit":[251,300],"age":[31,50],"sa":[26,40],"cri":[4,6],"do":[4,6]}},{"tpl":"i7056","s":{"vit":[201,300],"sa":[31,40],"pp":[16,30],"rf":[6,8],"ra":[6,8],"xf":[11,15],"xa":[11,15]}}]}'::jsonb, 'zone'),
('can_dents', 'Dents de Pierre', 155, '{"k":258333,"res":{"Oueille":300,"Poils pubiens de Kanig":300,"Pollenectar":300,"Viande Fraîche":66,"Chaîne de Panthègros":13,"Cheveux d''Alhyène":13,"Crinière d''Orfélin":13,"Griffe de Félygiène":13},"eq":[{"tpl":"i18688","s":{"vit":[111,160],"pui":[21,30],"cri":[4,5],"rf":[4,6],"re":[4,6]}},{"tpl":"i8839","s":{"vit":[-150,-101],"fo":[61,80],"sa":[31,50],"pui":[11,15],"cri":[4,5],"do":[11,15],"pp":[11,20],"ini":[301,500],"rt":[9,14],"xt":[9,14]}},{"tpl":"i15063","s":{"vit":[151,200],"age":[41,60],"sa":[21,30],"pui":[11,15],"cri":[3,4],"da":[5,7],"rf":[4,5],"re":[5,7],"xe":[9,12]}},{"tpl":"i15059","s":{"vit":[151,200],"cha":[41,60],"sa":[21,30],"cri":[2,2],"de":[7,10],"ra":[4,5]}}]}'::jsonb, 'zone'),
('can_kanigs', 'Village des Kanigs', 155, '{"k":258333,"res":{"Oueille":300,"Poils pubiens de Kanig":300,"Pollenectar":300,"Viande Fraîche":66,"Chaîne de Panthègros":13,"Cheveux d''Alhyène":13,"Crinière d''Orfélin":13,"Griffe de Félygiène":13},"eq":[{"tpl":"i18688","s":{"vit":[111,160],"pui":[21,30],"cri":[4,5],"rf":[4,6],"re":[4,6]}},{"tpl":"i8839","s":{"vit":[-150,-101],"fo":[61,80],"sa":[31,50],"pui":[11,15],"cri":[4,5],"do":[11,15],"pp":[11,20],"ini":[301,500],"rt":[9,14],"xt":[9,14]}},{"tpl":"i15063","s":{"vit":[151,200],"age":[41,60],"sa":[21,30],"pui":[11,15],"cri":[3,4],"da":[5,7],"rf":[4,5],"re":[5,7],"xe":[9,12]}},{"tpl":"i15059","s":{"vit":[151,200],"cha":[41,60],"sa":[21,30],"cri":[2,2],"de":[7,10],"ra":[4,5]}}]}'::jsonb, 'zone'),
('wab_cawotte', 'Île de la Cawotte', 47, '{"k":78333,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":87,"Black Wabbit écrasé":60,"Viande Ladre":57,"Bandeau du Black Tiwabbit":29,"Branche de Tiwabbit Kiafin":29,"Moustaches de Tiwabbit":29},"eq":[{"tpl":"i10847","s":{"vit":[-30,-30],"fo":[-15,-15],"cha":[-15,-15],"df":[3,4]}},{"tpl":"i181","s":{"vit":[46,55],"fo":[-10,-10],"ine":[-10,-10],"cha":[-10,-10],"age":[31,40]}},{"tpl":"i3204","s":{"ine":[16,30],"ini":[101,150],"rf":[3,5],"xf":[3,5],"xe":[3,5],"xa":[3,5]}},{"tpl":"i348","s":{"fo":[-20,-20],"cha":[16,20],"pp":[4,5]}}]}'::jsonb, 'zone'),
('wab_couronne', 'Îlot de la Couronne', 52, '{"k":86667,"res":{"Oueille":240,"Pollenectar":240,"Viande Ladre":112,"Black Wabbit écrasé":60,"Sang de Wabbit GM":60,"Patte de Wabbit":29,"Patte de Black Wabbit":28,"Poils de Barbe du Grand Pa Wabbit":28},"eq":[{"tpl":"i181","s":{"vit":[46,55],"fo":[-10,-10],"ine":[-10,-10],"cha":[-10,-10],"age":[31,40]}},{"tpl":"i3204","s":{"ine":[16,30],"ini":[101,150],"rf":[3,5],"xf":[3,5],"xe":[3,5],"xa":[3,5]}},{"tpl":"i348","s":{"fo":[-20,-20],"cha":[16,20],"pp":[4,5]}},{"tpl":"i9549","s":{"cha":[16,25],"age":[16,25],"sa":[11,20],"cri":[4,5]}}]}'::jsonb, 'zone'),
('wab_tombeaux', 'Îlot des Tombeaux', 53, '{"k":88333,"res":{"Pollenectar":300,"Viande Ladre":140,"Os de Wabbit Squelette":71,"Bandeau de Black Wabbit Squelette":69,"Carte en bois : Ciseaux":26,"Carte en bois : Feuille":26,"Carte en bois : Pierre":26,"Dent de Wabbit":23}}'::jsonb, 'zone'),
('wab_waldo', 'Îlot de Waldo', 56, '{"k":93333,"res":{"Oueille":300,"Pollenectar":300,"Viande Ladre":138,"Poils de Barbe du Grand Pa Wabbit":69,"Estomac de Wo Wabbit":68,"Carte en bois : Ciseaux":28,"Carte en bois : Feuille":28,"Carte en bois : Pierre":28},"eq":[{"tpl":"i11374","s":{"cha":[21,30],"sa":[11,15],"cri":[3,4],"de":[4,5],"pp":[11,15],"ini":[101,150]}},{"tpl":"i17504","s":{"vit":[31,50],"do":[3,4],"re":[2,3],"ra":[2,3]}},{"tpl":"i6500","s":{"vit":[41,60],"ine":[21,30],"sa":[11,20],"df":[4,5]}},{"tpl":"i6499","s":{"fo":[16,20],"cha":[16,20],"age":[16,20],"ini":[51,100]}}]}'::jsonb, 'zone'),
('wab_labos', 'Laboratoires abandonnés', 116, '{"k":193333,"res":{"Viande Saignante":93,"Dents de Wabbit Vampire":19,"Feuille de Cawotman":19,"Oreilles de Wabbit Fluo":19,"Sang de Wabbit Garou":19,"Œil de Wabbit Céphale":19,"Cawotte Transgénique":16,"Koukawa":4},"eq":[{"tpl":"i6535","s":{"vit":[41,80],"cha":[31,50],"sa":[21,30],"pui":[11,15],"do":[6,10],"pp":[11,15]}},{"tpl":"i14501","s":{"vit":[101,150],"fo":[31,40],"sa":[21,30],"dn":[5,7],"dt":[5,7],"rf":[7,10],"xe":[9,12],"dcri":[7,10]}},{"tpl":"i14500","s":{"vit":[81,120],"fo":[41,60],"dn":[6,8],"dt":[6,8],"rf":[4,6],"xe":[4,6],"dcri":[9,12]}},{"tpl":"i14499","s":{"vit":[101,150],"cha":[21,30],"age":[21,30],"sa":[21,30],"re":[7,10],"xa":[5,7]}}]}'::jsonb, 'zone'),
('sid_desolation', 'Désolation de Sidimote', 66, '{"k":110000,"res":{"Oueille":300,"Pollenectar":300,"Viande Avariée":129,"Venin de scorbute":75,"Graine de Scorbute":32,"Moustache de Kolérat":32,"Papatte de Croc Gland":32,"Plume de Crowneille":32},"eq":[{"tpl":"i7341","s":{"vit":[31,50],"rt":[4,5],"xe":[4,6],"xa":[4,6]}},{"tpl":"i7241","s":{"vit":[41,60],"age":[31,40],"sa":[16,20],"rf":[4,5],"ra":[4,5]}},{"tpl":"i15998","s":{"ine":[21,30],"cha":[21,30],"sa":[7,10],"df":[2,3],"de":[2,3]}},{"tpl":"i4242","s":{"fo":[31,40],"ine":[31,40],"cha":[31,40],"age":[31,40],"pui":[4,5],"do":[2,3]}}]}'::jsonb, 'zone'),
('sid_roulottes', 'Route des Roulottes', 86, '{"k":143333,"res":{"Document des Magik Riktus signé":300,"Oueille":300,"Pollenectar":300,"Viande Rassie":117,"Bombe de Graboule":29,"Bourgeon de Pirolienne":29,"Couteau de Roukouto":29,"Roue de Tivelo":29},"eq":[{"tpl":"i18662","s":{"vit":[81,100],"ine":[31,40],"sa":[11,15],"cri":[3,4],"so":[7,10],"rf":[7,10]}},{"tpl":"i33579","s":{"vit":[31,40],"sa":[11,15],"cri":[4,6],"rn":[3,4],"dcri":[11,15]}},{"tpl":"i7257","s":{"vit":[56,75],"ine":[41,50],"cri":[3,4],"rt":[4,5],"rf":[4,5]}},{"tpl":"i2639","s":{"vit":[71,100],"fo":[41,50],"age":[41,50],"cri":[4,5],"do":[4,5],"pp":[4,5],"ini":[351,400]}}]}'::jsonb, 'zone'),
('sid_hurlements', 'Hauts des Hurlements', 96, '{"k":160000,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":108,"Canine de Mergranlou":27,"Poils de Mulounoké":27,"Queue du Mulou":27,"Œil de Cocholou":27,"Bave infectée":18},"eq":[{"tpl":"i14277","s":{"age":[31,40],"sa":[21,30],"cri":[2,3],"rf":[4,6],"ra":[4,6],"dcri":[7,10]}},{"tpl":"i18689","s":{"vit":[71,90],"fo":[21,30],"age":[21,30],"rn":[5,7]}},{"tpl":"i14585","s":{"vit":[81,120],"age":[31,40],"sa":[16,20],"cri":[3,4],"da":[4,6],"rt":[4,6],"re":[4,6]}},{"tpl":"i33584","s":{"vit":[101,120],"fo":[21,30],"ine":[21,30],"sa":[21,30],"cri":[1,2],"pp":[11,15],"rf":[3,5],"dcri":[9,12]}}]}'::jsonb, 'zone'),
('sid_gisgoul', 'Gisgoul', 176, '{"k":293333,"res":{"Oueille":300,"Pollenectar":300,"Viande Gâtée":51,"Artefact élémental d''Air":22,"Artefact élémental d''Eau":22,"Artefact élémental de Terre":22,"Artefact élémental du Feu":22,"Bandeau troué d''Air":10},"eq":[{"tpl":"i7189","s":{"vit":[201,250],"ine":[31,50],"sa":[21,35],"do":[6,10],"rn":[5,7],"rt":[5,7],"re":[5,7],"ra":[5,7]}},{"tpl":"i18695","s":{"vit":[141,190],"ine":[51,60],"sa":[21,30],"so":[16,20]}},{"tpl":"i33602","s":{"vit":[251,300],"fo":[41,60],"ine":[41,60],"sa":[21,30],"cri":[2,3],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"pp":[7,10],"rt":[3,5],"rf":[3,5],"re":[3,5]}},{"tpl":"i8932","s":{"vit":[151,200],"fo":[31,50],"age":[21,30],"sa":[26,40],"cri":[2,3],"do":[5,7],"pp":[11,15],"ini":[301,500],"rn":[6,10],"xn":[6,10]}}]}'::jsonb, 'zone'),
('sid_fungus', 'Caverne des Fungus', 176, '{"k":293333,"res":{"Oueille":300,"Pollenectar":300,"Restes de Fungus":300,"Roupie de Champ à Gnons":75,"Thalle de Champmane":75,"Viande Gâtée":51,"Échantillon de Fungus":23,"Bave de Champ à Gnons":13},"eq":[{"tpl":"i9134","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"sa":[31,40],"cri":[3,4],"do":[5,7],"pp":[11,20],"ini":[301,400]}},{"tpl":"i9139","s":{"vit":[201,250],"cha":[31,50],"sa":[31,40],"pui":[6,10],"do":[5,7],"pp":[21,30],"ini":[401,700],"rn":[6,10]}},{"tpl":"i9140","s":{"vit":[251,300],"fo":[51,70],"sa":[31,50],"do":[6,10],"pp":[6,10],"rt":[6,10],"xf":[6,10],"xa":[6,10]}},{"tpl":"i9138","s":{"vit":[201,250],"cha":[41,60],"sa":[21,30],"cri":[3,4],"do":[6,10],"pp":[11,20],"xt":[6,10]}}]}'::jsonb, 'zone'),
('sid_domaine_fungus', 'Domaine des Fungus', 176, '{"k":293333,"res":{"Oueille":300,"Pollenectar":300,"Restes de Fungus":150,"Roupie de Champ à Gnons":75,"Thalle de Champmane":75,"Viande Gâtée":51,"Échantillon de Fungus":45,"Bave de Champ à Gnons":13},"eq":[{"tpl":"i9134","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"sa":[31,40],"cri":[3,4],"do":[5,7],"pp":[11,20],"ini":[301,400]}},{"tpl":"i9139","s":{"vit":[201,250],"cha":[31,50],"sa":[31,40],"pui":[6,10],"do":[5,7],"pp":[21,30],"ini":[401,700],"rn":[6,10]}},{"tpl":"i9140","s":{"vit":[251,300],"fo":[51,70],"sa":[31,50],"do":[6,10],"pp":[6,10],"rt":[6,10],"xf":[6,10],"xa":[6,10]}},{"tpl":"i9138","s":{"vit":[201,250],"cha":[41,60],"sa":[21,30],"cri":[3,4],"do":[6,10],"pp":[11,20],"xt":[6,10]}}]}'::jsonb, 'zone'),
('sid_desacrees', 'Terres Désacrées', 200, '{"k":333333,"res":{"Oueille":300,"Pollenectar":300,"Viande Goûtue":36,"Sacrifice de Goules":11,"Aile de Kérigoule":9,"Nez de Pipisteuse":9,"Poils de Goultime":9,"Œil de Gouligane":9},"eq":[{"tpl":"i19093","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[3,4],"df":[11,15],"de":[11,15],"so":[9,12],"pp":[11,15],"ra":[7,10]}},{"tpl":"i19096","s":{"vit":[301,350],"fo":[31,50],"ine":[31,50],"age":[31,50],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"df":[11,15],"da":[11,15],"re":[7,10]}},{"tpl":"i19076","s":{"vit":[401,500],"cri":[7,10],"pp":[16,20],"rn":[5,7],"rt":[5,7],"rf":[5,7],"re":[5,7],"ra":[5,7]}},{"tpl":"i19078","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"cha":[31,40],"sa":[21,30],"dn":[5,7],"dt":[5,7],"df":[5,7],"de":[5,7],"rt":[7,10]}}]}'::jsonb, 'zone'),
('sid_magmatiques', 'Marches Magmatiques', 200, '{"k":333333,"res":{"Cœur de Calciné":300,"Essence brûlante de calciné":300,"Pierre Ardente de Calciné":300,"Pollenectar":300,"Âme de Calciné":300,"Viande Goûtue":36,"Grenade de Moribombe":9,"Langue de Hacharné":9},"eq":[{"tpl":"i20465","s":{"vit":[301,350],"ine":[61,80],"cha":[61,80],"sa":[31,40],"cri":[-10,-10],"df":[11,15],"de":[11,15],"re":[7,10],"ra":[7,10]}},{"tpl":"i19592","s":{"vit":[301,350],"fo":[41,60],"ine":[41,60],"sa":[31,40],"cri":[3,4],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[9,12],"re":[5,7],"ra":[5,7]}},{"tpl":"i19589","s":{"vit":[351,400],"ine":[51,70],"sa":[31,50],"cri":[-10,-10],"df":[11,15],"so":[7,10],"pp":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i19585","s":{"vit":[301,350],"ine":[61,80],"sa":[31,40],"cri":[-10,-10],"df":[11,15],"so":[9,12],"pp":[11,15],"rt":[7,10],"ra":[7,10]}}]}'::jsonb, 'zone'),
('koa_kaliptus', 'Forêt de Kaliptus', 74, '{"k":123333,"res":{"Oueille":300,"Pollenectar":300,"Oreilles de Koalak Immature":75,"Viande Sanguinolente":65,"Viande Exsudative":60,"Peau de Koalak Immature":32,"Pierre Médicinale":32,"Étoffe de Dok Alako":32},"eq":[{"tpl":"i7340","s":{"vit":[81,100],"so":[5,7],"rf":[4,5],"ra":[4,5]}},{"tpl":"i8006","s":{"so":[1,2],"rn":[4,5]}},{"tpl":"i8004","s":{"vit":[21,30],"rf":[4,5]}},{"tpl":"i7244","s":{"vit":[21,30],"ine":[21,30],"cri":[2,3]}}]}'::jsonb, 'zone'),
('koa_lacs', 'Lacs enchantés', 74, '{"k":123333,"res":{"Oueille":300,"Pollenectar":300,"Oreilles de Koalak Immature":75,"Viande Sanguinolente":65,"Viande Exsudative":59,"Peau de Koalak Immature":32,"Pierre Médicinale":32,"Étoffe de Dok Alako":32},"eq":[{"tpl":"i7340","s":{"vit":[81,100],"so":[5,7],"rf":[4,5],"ra":[4,5]}},{"tpl":"i8006","s":{"so":[1,2],"rn":[4,5]}},{"tpl":"i8004","s":{"vit":[21,30],"rf":[4,5]}},{"tpl":"i7244","s":{"vit":[21,30],"ine":[21,30],"cri":[2,3]}}]}'::jsonb, 'zone'),
('koa_bordure', 'Bordure de Kaliptus', 73, '{"k":121667,"res":{"Oueille":300,"Pollenectar":300,"Oreilles de Koalak Immature":100,"Viande Sanguinolente":86,"Peau de Koalak Immature":43,"Pierre Médicinale":42,"Étoffe de Dok Alako":42,"Viande Exsudative":41},"eq":[{"tpl":"i7340","s":{"vit":[81,100],"so":[5,7],"rf":[4,5],"ra":[4,5]}},{"tpl":"i8006","s":{"so":[1,2],"rn":[4,5]}},{"tpl":"i8004","s":{"vit":[21,30],"rf":[4,5]}},{"tpl":"i7244","s":{"vit":[21,30],"ine":[21,30],"cri":[2,3]}}]}'::jsonb, 'zone'),
('koa_canyon', 'Canyon sauvage', 84, '{"k":140000,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":102,"Fleur de Kaliptus":20,"Pierre Médicinale":16,"Viande Sanguinolente":16,"Étoffe de Dok Alako":16,"Boomerang du Warko Marron":15},"eq":[{"tpl":"i7340","s":{"vit":[81,100],"so":[5,7],"rf":[4,5],"ra":[4,5]}},{"tpl":"i7118","s":{"vit":[41,60],"cha":[21,30],"age":[21,30],"do":[2,3],"pp":[7,10],"rf":[2,2],"ra":[2,2]}},{"tpl":"i7029","s":{"vit":[61,80],"age":[41,60],"so":[11,15],"pp":[11,15],"re":[4,5]}},{"tpl":"i8006","s":{"so":[1,2],"rn":[4,5]}}]}'::jsonb, 'zone'),
('koa_pentes', 'Pentes du Canyon', 81, '{"k":135000,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":119,"Boomerang du Warko Marron":30,"Poils de Koalak Coco":29,"Poils de Koalak Forestier":29,"Poils de Koalak Indigo":29,"Fleur de Kaliptus":20},"eq":[{"tpl":"i8006","s":{"so":[1,2],"rn":[4,5]}},{"tpl":"i8004","s":{"vit":[21,30],"rf":[4,5]}},{"tpl":"i33573","s":{"vit":[41,60],"fo":[21,30],"ine":[21,30],"cha":[21,30],"sa":[16,20],"pp":[7,10],"ini":[151,200],"re":[3,4]}},{"tpl":"i33571","s":{"vit":[41,60],"fo":[16,20],"ine":[16,20],"cha":[16,20],"sa":[7,10],"rt":[3,4]}}]}'::jsonb, 'zone'),
('koa_antre_koulosse', 'Antre du Koulosse', 92, '{"k":153333,"res":{"Laine du Boufcoul":108,"Viande Exsudative":108,"Corne du Boufcoul":54,"Cervelle de Bouftou des Cavernes":3,"Sachet d''Aubergines":3},"eq":[{"tpl":"i7881","s":{"vit":[41,50],"fo":[16,20],"ine":[16,20],"age":[16,20],"sa":[4,7],"so":[4,6],"ini":[-50,-50],"rt":[2,3],"rf":[2,3]}},{"tpl":"i7885","s":{"vit":[51,60],"fo":[21,30],"ine":[21,30],"age":[21,30],"sa":[9,12],"dt":[2,3],"df":[2,3],"da":[2,3],"ini":[-50,-50],"ra":[2,3]}},{"tpl":"i7880","s":{"vit":[41,50],"fo":[16,25],"ine":[16,25],"age":[16,25],"sa":[7,10],"pa":[1,1],"dt":[1,2],"df":[1,2],"da":[1,2],"so":[4,6],"ini":[-50,-50]}}]}'::jsonb, 'zone'),
('koa_morhkitu', 'Vallée de la Morh''Kitu', 111, '{"k":185000,"res":{"Oueille":300,"Pollenectar":300,"Viande Saignante":97,"Houpette de Koalak Sanguin":20,"Poils de Guerrier Koalak":20,"Couche usagée de Warko Violet":19,"Crâne d''Aventurier":19,"Foulard de Koalak Farouche":19},"eq":[{"tpl":"i7188","s":{"vit":[101,150],"ine":[26,40],"age":[26,40],"do":[4,5],"so":[4,5]}},{"tpl":"i6516","s":{"vit":[41,80],"age":[31,50],"sa":[21,30],"pui":[11,15],"pp":[6,10]}},{"tpl":"i6523","s":{"vit":[41,80],"fo":[16,30],"sa":[21,35],"do":[6,10],"ini":[151,250]}},{"tpl":"i15013","s":{"vit":[251,300],"sa":[21,30],"so":[9,12],"pp":[11,15],"rt":[5,7]}}]}'::jsonb, 'zone'),
('koa_cimetiere', 'Cimetière primitif', 111, '{"k":185000,"res":{"Oueille":300,"Pollenectar":300,"Viande Saignante":121,"Tibia de Koalak Fossoyeur":25,"Cubitus de Momie Koalak":24,"Peau de Chevaucheur Koalak":24,"Peau de Maître Koalak":23,"Fleur de Kaliptus":16},"eq":[{"tpl":"i18683","s":{"vit":[86,110],"cha":[41,50],"sa":[16,20],"rf":[3,4],"re":[3,4],"ra":[3,4]}},{"tpl":"i6522","s":{"vit":[41,80],"fo":[31,50],"ine":[31,50],"do":[6,10],"pp":[11,15]}}]}'::jsonb, 'zone'),
('alb_futaie', 'Futaie enneigée', 46, '{"k":76667,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":144,"Corne de Buffalourd":36,"Fourrure de Timongouste":36,"Griffe de Grolours":36,"Plume de Thomondor":36,"Pom de Pin":24},"eq":[{"tpl":"i27534","s":{"vit":[21,40],"ine":[31,40],"age":[31,40],"sa":[6,10],"so":[4,7]}},{"tpl":"i27533","s":{"vit":[31,40],"fo":[21,30],"cha":[21,30],"sa":[6,10],"dn":[2,3],"dt":[2,3],"de":[2,3]}},{"tpl":"i27531","s":{"vit":[21,40],"fo":[11,20],"cha":[11,20],"pa":[1,1]}},{"tpl":"i27532","s":{"vit":[21,30],"fo":[31,50],"cha":[31,50]}}]}'::jsonb, 'zone'),
('abr_oree_abrak', 'Orée de la forêt des Abraknydes', 42, '{"k":70000,"res":{"Oueille":180,"Pollenectar":180,"Viande Minérale":146,"Patte d''Arakne Majeure":59,"Bois de Tronknyde":29,"Poil d''Abrakne":29,"Racine d''Abraknyde":29,"Ambre":10},"eq":[{"tpl":"i469","s":{"vit":[21,30],"fo":[21,30],"cha":[-20,-20],"age":[-20,-20],"sa":[16,20],"cri":[2,3]}},{"tpl":"i2420","s":{"vit":[21,30],"cri":[2,3],"do":[2,3]}},{"tpl":"i2426","s":{"fo":[26,30]}},{"tpl":"i1363","s":{"vit":[41,60],"fo":[21,30],"cha":[-30,-30],"sa":[16,20],"pui":[7,10]}}]}'::jsonb, 'zone'),
('abr_sombre', 'Forêt Sombre', 80, '{"k":133333,"res":{"Oueille":225,"Pollenectar":225,"Viande Rassie":88,"Ambre d''Abraknyde Sombre":80,"Pierre de Diamant":36,"Puissant Parchemin de Vitalité":36,"Racine d''Abraknyde Vénérable":30,"Pierre d''Émeraude":29},"eq":[{"tpl":"i33568","s":{"vit":[51,90],"fo":[41,50],"sa":[16,20],"rf":[3,4]}},{"tpl":"i33569","s":{"vit":[51,90],"sa":[16,25],"dn":[7,10],"dt":[7,10],"pp":[7,10],"rn":[3,4]}},{"tpl":"i6454","s":{"fo":[21,35],"ine":[21,35],"age":[21,35],"do":[4,5]}},{"tpl":"i1695","s":{"ine":[21,30],"do":[2,3],"rf":[2,2],"re":[2,2],"ra":[2,2]}}]}'::jsonb, 'zone'),
('abr_oree', 'Orée de la Forêt Sombre', 78, '{"k":130000,"res":{"Oueille":300,"Pollenectar":300,"Viande Rassie":119,"Racine d''Abraknyde Vénérable":60,"Racine d''Abraknyde Sombre":59,"Ambre d''Abraknyde Sombre":10,"Écorce d''Abraknyde Vénérable":10,"Sachet de Résine":3},"eq":[{"tpl":"i33568","s":{"vit":[51,90],"fo":[41,50],"sa":[16,20],"rf":[3,4]}},{"tpl":"i33569","s":{"vit":[51,90],"sa":[16,25],"dn":[7,10],"dt":[7,10],"pp":[7,10],"rn":[3,4]}},{"tpl":"i6454","s":{"fo":[21,35],"ine":[21,35],"age":[21,35],"do":[4,5]}},{"tpl":"i1695","s":{"ine":[21,30],"do":[2,3],"rf":[2,2],"re":[2,2],"ra":[2,2]}}]}'::jsonb, 'zone'),
('abr_arakhai', 'Bois des Arak-haï', 91, '{"k":151667,"res":{"Oueille":300,"Pollenectar":300,"Viande Rassie":94,"Dent de Gargantûl":23,"Fil de Néfileuse":23,"Laine de Dardalaine":23,"Œil de Saltik":23,"Queue du Mulou":22},"eq":[{"tpl":"i16176","s":{"vit":[41,60],"fo":[21,30],"age":[21,30],"pa":[1,1],"dt":[2,2],"da":[2,2],"ra":[2,3]}},{"tpl":"i16177","s":{"vit":[61,80],"fo":[21,30],"age":[21,30],"sa":[16,20],"cri":[2,3],"dt":[4,5],"da":[4,5],"pp":[11,15],"re":[4,5]}},{"tpl":"i16178","s":{"vit":[61,80],"fo":[21,30],"age":[21,30],"sa":[21,25],"dt":[4,5],"da":[4,5],"re":[2,3]}}]}'::jsonb, 'zone'),
('moon_tortue', 'Plage de la Tortue', 46, '{"k":76667,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":144,"Cervelle de tortue":75,"Huile de foie de tortue":75,"Kokopaille":72,"Pulpe macérée de Nodkoko":19,"Carapace Bleue":18},"eq":[{"tpl":"i705","s":{"fo":[21,60],"do":[3,5]}},{"tpl":"i478","s":{"vit":[36,45],"fo":[-40,-40],"ine":[31,40],"cha":[31,40],"sa":[16,20]}}]}'::jsonb, 'zone'),
('moon_masques', 'Forêt des Masques', 56, '{"k":93333,"res":{"Oueille":300,"Pollenectar":300,"Viande Ladre":138,"Corde en liane":36,"Poupée Vaudou Ark":35,"Poupée Vaudou Eth":35,"Poupée Vaudou Jav":35,"Poupée Vaudou Sarbak":35},"eq":[{"tpl":"i10635","s":{"cha":[16,25],"do":[1,2]}},{"tpl":"i10636","s":{"cha":[16,25],"sa":[6,10],"cri":[2,3]}}]}'::jsonb, 'zone'),
('moon_crane', 'Chemin du Crâne', 86, '{"k":143333,"res":{"Pollenectar":300,"Viande Rassie":117,"Crâne de pirate":36,"Bandeau de Nakunbra":29,"Boulet de Canondorf":29,"Caleçon Mignon du Pirate":29,"Canif Rouillé":29,"Mâchoire de pirate":27},"eq":[{"tpl":"i7194","s":{"vit":[81,120],"ine":[41,50],"age":[41,50],"dn":[5,7],"df":[5,7],"ini":[201,250],"rn":[2,3],"rf":[2,3]}},{"tpl":"i7002","s":{"vit":[71,90],"sa":[21,25],"do":[4,5],"so":[11,15],"pp":[11,15],"rn":[3,4],"rf":[3,4]}},{"tpl":"i6460","s":{"vit":[41,60],"cha":[41,50],"sa":[16,20],"pui":[16,20],"do":[5,7],"pp":[11,15],"re":[4,5]}},{"tpl":"i2614","s":{"vit":[81,120],"fo":[41,60],"do":[4,5],"ini":[-500,-500]}}]}'::jsonb, 'zone'),
('moon_jungle', 'Jungle Interdite', 96, '{"k":160000,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":108,"Boules de Trukikol":75,"Couronne de Fourbasse":75,"Engrais de Moon":68,"Feuille de Fourbasse":27,"Fleur de Gloutovore":27},"eq":[{"tpl":"i6745","s":{"vit":[91,120],"fo":[26,35],"cha":[36,45],"sa":[21,30],"cri":[3,4],"dn":[4,6],"dt":[4,6],"de":[4,6],"ra":[5,7]}},{"tpl":"i33591","s":{"vit":[101,120],"sa":[16,20],"pui":[16,20],"pp":[7,10]}},{"tpl":"i6763","s":{"vit":[91,120],"ine":[26,35],"age":[36,45],"sa":[21,30],"df":[4,6],"da":[4,6],"rt":[5,7]}},{"tpl":"i33589","s":{"vit":[101,120],"sa":[21,30],"pui":[21,30],"do":[4,6],"pp":[7,10]}}]}'::jsonb, 'zone'),
('dra_presquile', 'Presqu''île des Dragoeufs', 66, '{"k":110000,"res":{"Oueille":300,"Pollenectar":300,"Viande Avariée":129,"Coquille de Dragoeuf Ardoise":32,"Coquille de Dragoeuf Argile":32,"Coquille de Dragoeuf Calcaire":32,"Coquille de Dragoeuf Charbon":32,"Pierre d''Émeraude":5},"eq":[{"tpl":"i33566","s":{"vit":[31,50],"pui":[16,20],"cri":[3,4]}},{"tpl":"i33565","s":{"vit":[41,60],"sa":[11,15],"pui":[16,25],"cri":[4,6]}},{"tpl":"i6474","s":{"vit":[26,35],"ine":[31,40],"sa":[6,10],"df":[2,3],"ini":[101,150],"rt":[2,3]}},{"tpl":"i6472","s":{"vit":[16,25],"age":[11,20],"sa":[6,15],"cri":[2,3],"da":[5,7],"ini":[101,150],"rf":[2,3]}}]}'::jsonb, 'zone'),
('dra_village', 'Village des Dragoeufs', 96, '{"k":160000,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":108,"Écaille de Dragoss Ardoise":27,"Écaille de Dragoss Argile":27,"Écaille de Dragoss Calcaire":27,"Écaille de Dragoss Charbon":27,"Deuxième partie de la clef du labyrinthe du Dragon Cochon":12}}'::jsonb, 'zone'),
('dra_souterrains', 'Souterrains des Dragoeufs', 96, '{"k":160000,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":108,"Écaille de Dragoss Ardoise":27,"Écaille de Dragoss Argile":27,"Écaille de Dragoss Calcaire":27,"Écaille de Dragoss Charbon":27,"Deuxième partie de la clef du labyrinthe du Dragon Cochon":12}}'::jsonb, 'zone'),
('dra_sanctuaire', 'Sanctuaire des Dragoeufs', 116, '{"k":193333,"res":{"Viande Saignante":93,"Écaille de Draguaindrop":75,"Corne de Dragacé":23,"Peau de Dragnarok":23,"Peau de Draguaindrop":23,"Peau de Dragueuse":23,"Croc de Dragoeuf Protecteur":16,"Aile de Draguaindrop":4},"eq":[{"tpl":"i8103","s":{"vit":[71,90],"fo":[21,35],"ine":[21,35],"cha":[21,35],"age":[21,35],"sa":[21,40],"pui":[11,20],"do":[5,7]}},{"tpl":"i3650","s":{"fo":[21,40],"age":[21,40],"do":[6,10],"pp":[11,15],"rf":[6,10],"ra":[6,10]}},{"tpl":"i8295","s":{"vit":[151,200],"fo":[31,40],"sa":[11,20],"pui":[6,10],"cri":[4,5],"dt":[4,6],"pp":[11,15],"re":[3,4],"xf":[4,5]}},{"tpl":"i8293","s":{"vit":[91,130],"ine":[26,40],"cha":[26,40],"sa":[11,15],"pui":[11,15],"cri":[3,4],"df":[2,3],"de":[2,3],"ini":[101,200],"rn":[4,6]}}]}'::jsonb, 'zone'),
('oto_naufrages', 'Île des naufragés', 30, '{"k":50000,"res":{"Kokopaille":119,"Coffret maudit du Flib":75,"Bananagrume":3}}'::jsonb, 'zone'),
('oto_corail', 'Plage de Corail', 43, '{"k":71667,"res":{"Oueille":300,"Pollenectar":300,"Viande Tendre":145,"Bulbe Kouraçao":16,"Bulbe Malibout":16,"Bulbe Morito":16,"Bulbe Passaoh":16,"Coccyx du Corailleur":16},"eq":[{"tpl":"i2386","s":{"cri":[3,10],"do":[3,5],"ini":[51,100]}},{"tpl":"i6463","s":{"vit":[21,30],"cha":[21,25],"pui":[4,5],"ra":[2,3]}},{"tpl":"i8872","s":{"age":[16,20],"ini":[101,150]}},{"tpl":"i1372","s":{"vit":[36,45],"ine":[-50,-50]}}]}'::jsonb, 'zone'),
('oto_arche', 'Arche d''Otomaï', 63, '{"k":105000,"res":{"Viande Avariée":131,"Chicot du Flib":44,"Foulard du Sparo":44,"Maillot de corps de Barbroussa":43,"Poudre explosive":22,"Barbe inexistante du Barbroussa":7,"Humérus du Sparo":7,"Touffe rousse du Flib":7}}'::jsonb, 'zone'),
('oto_tourbiere', 'Tourbière sans fond', 102, '{"k":170000,"res":{"Oueille":300,"Pollenectar":300,"Viande Séchée":103,"Bave de Ouassingue":35,"Dent de Bourbassingue":35,"Vieille Ventouse de Kralamoure":33,"Étoffe de Ouassingue":17,"Faux menton du Bourbassingue":6},"eq":[{"tpl":"i8845","s":{"vit":[81,130],"fo":[31,40],"cha":[31,40],"sa":[16,20],"dn":[3,4],"dt":[3,4],"de":[3,4],"so":[4,6],"pp":[4,7],"rt":[2,3],"re":[2,3]}},{"tpl":"i8874","s":{"vit":[91,110],"fo":[26,35],"cha":[26,35],"sa":[16,20],"pa":[1,1],"so":[4,6],"pp":[3,5],"rt":[2,3]}},{"tpl":"i8819","s":{"vit":[81,120],"fo":[31,40],"cha":[31,40],"sa":[11,15],"dn":[2,3],"dt":[2,3],"de":[2,3],"so":[4,6],"ini":[-200,-200],"rt":[2,3],"re":[2,3]}}]}'::jsonb, 'zone'),
('oto_tourbiere2', 'Tourbière nauséabonde', 102, '{"k":170000,"res":{"Oueille":300,"Pollenectar":300,"Viande Séchée":103,"Bave de Ouassingue":35,"Dent de Bourbassingue":35,"Vieille Ventouse de Kralamoure":33,"Étoffe de Ouassingue":17,"Faux menton du Bourbassingue":6},"eq":[{"tpl":"i8845","s":{"vit":[81,130],"fo":[31,40],"cha":[31,40],"sa":[16,20],"dn":[3,4],"dt":[3,4],"de":[3,4],"so":[4,6],"pp":[4,7],"rt":[2,3],"re":[2,3]}},{"tpl":"i8874","s":{"vit":[91,110],"fo":[26,35],"cha":[26,35],"sa":[16,20],"pa":[1,1],"so":[4,6],"pp":[3,5],"rt":[2,3]}},{"tpl":"i8819","s":{"vit":[81,120],"fo":[31,40],"cha":[31,40],"sa":[11,15],"dn":[2,3],"dt":[2,3],"de":[2,3],"so":[4,6],"ini":[-200,-200],"rt":[2,3],"re":[2,3]}}]}'::jsonb, 'zone'),
('oto_plaines', 'Plaines herbeuses', 102, '{"k":170000,"res":{"Oueille":300,"Pollenectar":300,"Viande Séchée":104,"Sang du Kido":50,"Fluide de Kilibriss":25,"Moustache du Mufafah":18,"Plume de fesse du Kido":18,"Aile du Bitouf des Plaines":17},"eq":[{"tpl":"i8879","s":{"vit":[41,60],"fo":[11,15],"ine":[11,15],"cha":[11,15],"age":[11,15],"pui":[11,15],"do":[4,5],"ini":[151,200],"rn":[-5,-5],"rt":[-5,-5],"rf":[-5,-5],"re":[-5,-5],"ra":[-5,-5]}},{"tpl":"i2384","s":{"vit":[51,70],"ine":[36,45],"sa":[21,30],"rf":[4,5]}},{"tpl":"i8618","s":{"vit":[31,40],"cha":[41,50],"age":[21,30],"sa":[21,25],"do":[4,5],"pp":[7,10],"ini":[151,200]}},{"tpl":"i2615","s":{"fo":[21,30],"ine":[21,30],"cha":[21,30],"age":[21,30],"sa":[16,20],"pui":[21,30],"do":[5,7],"dcri":[4,6]}}]}'::jsonb, 'zone'),
('oto_zoths', 'Village des Zoths', 126, '{"k":210000,"res":{"Oueille":300,"Pollenectar":300,"Viande Persillée":86,"Enfumoir Zoth":18,"Boulier Zoth":17,"Jouet de Gamine Zoth":17,"Pierre Précieuse Zoth":17,"Calumet Zoth":16},"eq":[{"tpl":"i7153","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"sa":[21,40],"pp":[11,15]}},{"tpl":"i8092","s":{"vit":[201,250],"fo":[31,50],"age":[16,30],"pui":[6,10],"do":[6,10],"xn":[6,10],"xa":[6,10]}},{"tpl":"i7162","s":{"cha":[21,40],"age":[21,40],"do":[4,6]}},{"tpl":"i18674","s":{"vit":[101,130],"fo":[26,35],"ine":[26,35],"age":[26,35],"sa":[16,20],"cri":[4,5],"xe":[21,30]}}]}'::jsonb, 'zone'),
('oto_canopee', 'Village de la Canopée', 126, '{"k":210000,"res":{"Oueille":300,"Pollenectar":300,"Viande Persillée":86,"Enfumoir Zoth":18,"Boulier Zoth":17,"Jouet de Gamine Zoth":17,"Pierre Précieuse Zoth":17,"Calumet Zoth":16},"eq":[{"tpl":"i7153","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"sa":[21,40],"pp":[11,15]}},{"tpl":"i8092","s":{"vit":[201,250],"fo":[31,50],"age":[16,30],"pui":[6,10],"do":[6,10],"xn":[6,10],"xa":[6,10]}},{"tpl":"i7162","s":{"cha":[21,40],"age":[21,40],"do":[4,6]}},{"tpl":"i18674","s":{"vit":[101,130],"fo":[26,35],"ine":[26,35],"age":[26,35],"sa":[16,20],"cri":[4,5],"xe":[21,30]}}]}'::jsonb, 'zone'),
('oto_jungle', 'Jungle obscure', 134, '{"k":223333,"res":{"Oueille":300,"Pollenectar":300,"Viande Macérée":80,"Belladone de Brouture":43,"Bractée de Chiendent":12,"Calice de Fécorce":12,"Carpelle de Brouture":12,"Sépale de Nerbe":12},"eq":[{"tpl":"i6461","s":{"vit":[41,70],"cha":[31,50],"age":[31,50],"pa":[1,1],"do":[6,10],"pp":[11,15],"rf":[3,5],"re":[3,5]}},{"tpl":"i8836","s":{"vit":[101,150],"ine":[26,45],"age":[26,45],"cri":[3,4],"so":[4,6],"rf":[6,10],"ra":[6,10]}},{"tpl":"i7003","s":{"vit":[101,150],"ine":[11,30],"sa":[31,40],"pa":[1,1],"so":[6,10],"re":[5,7],"ra":[5,7],"xt":[9,13],"xf":[9,13]}},{"tpl":"i8850","s":{"vit":[251,300],"age":[41,60],"sa":[41,60],"do":[6,10],"pp":[11,20]}}]}'::jsonb, 'zone'),
('oto_hakam', 'Tronc de l''arbre Hakam', 151, '{"k":251667,"res":{"Oueille":300,"Pollenectar":300,"Viande Fraîche":65,"Rembourrage de Meupette":14,"Bave du Kaskargo":13,"Cloaque du Poolay":13,"Croupion du Bitouf aérien":13,"Souche de l''Abrakleur clair":13},"eq":[{"tpl":"i8824","s":{"vit":[151,200],"fo":[31,50],"sa":[26,40],"do":[3,4],"rn":[6,10],"rf":[6,10],"ra":[6,10],"xt":[6,10],"xe":[6,10]}},{"tpl":"i8704","s":{"ine":[41,60],"age":[41,60],"sa":[31,50],"do":[6,10],"pp":[11,15],"rf":[8,12],"ra":[8,12],"xf":[8,12],"xa":[8,12]}},{"tpl":"i8868","s":{"vit":[101,150],"fo":[26,40],"ine":[26,40],"sa":[21,30],"pp":[6,10],"rt":[6,10],"rf":[6,10]}},{"tpl":"i8924","s":{"vit":[151,200],"age":[31,40],"sa":[31,40],"cri":[4,5],"do":[6,10],"pp":[11,20],"xf":[6,10],"xa":[6,10]}}]}'::jsonb, 'zone'),
('oto_feuillage', 'Feuillage de l''arbre Hakam', 151, '{"k":251667,"res":{"Oueille":300,"Pollenectar":300,"Viande Fraîche":65,"Cloaque du Poolay":22,"Croupion du Bitouf aérien":22,"Bave du Kaskargo":21,"Armée de Tiques de Poolay":12,"Coco du Bitouf aérien":4},"eq":[{"tpl":"i8824","s":{"vit":[151,200],"fo":[31,50],"sa":[26,40],"do":[3,4],"rn":[6,10],"rf":[6,10],"ra":[6,10],"xt":[6,10],"xe":[6,10]}},{"tpl":"i8704","s":{"ine":[41,60],"age":[41,60],"sa":[31,50],"do":[6,10],"pp":[11,15],"rf":[8,12],"ra":[8,12],"xf":[8,12],"xa":[8,12]}},{"tpl":"i8868","s":{"vit":[101,150],"fo":[26,40],"ine":[26,40],"sa":[21,30],"pp":[6,10],"rt":[6,10],"rf":[6,10]}},{"tpl":"i8924","s":{"vit":[151,200],"age":[31,40],"sa":[31,40],"cri":[4,5],"do":[6,10],"pp":[11,20],"xf":[6,10],"xa":[6,10]}}]}'::jsonb, 'zone'),
('oto_tourbiere_fond', 'Fond de la Tourbière', 185, '{"k":308333,"res":{"Oueille":300,"Pollenectar":300,"Viande Noire":36,"Étoffe du Roissingue":36,"Culotte à l''envers du Roissingue":6,"Étoffe de Ouassingue":6,"Tonneau de Jus Goûtu":3}}'::jsonb, 'zone'),
('mino_ile', 'Île du Minotoror', 115, '{"k":191667,"res":{"Oueille":300,"Pollenectar":300,"Viande Saignante":98,"Peau de Kraméléhon":48,"Peau de Mandrine":26,"Peau de Minoskito":26,"Plume du Serpiplume":23,"Peau de Minos":16},"eq":[{"tpl":"i6485","s":{"cha":[21,40],"age":[21,40],"sa":[21,40],"do":[5,8],"pp":[11,15]}},{"tpl":"i6510","s":{"vit":[31,60],"cha":[31,50],"sa":[21,35],"pp":[6,10],"rf":[3,5],"re":[3,5],"xf":[4,8],"xe":[4,8],"xa":[4,8]}}]}'::jsonb, 'zone'),
('mino_labyrinthe', 'Labyrinthe du Minotoror', 118, '{"k":196667,"res":{"Viande Saignante":92,"Mominotor":60,"Oueille":60,"Pollenectar":60,"Relique du Déminoboule":60,"Relique du Mominotor":60,"Bandelette du Mominotor":19,"Carapace de Scaratos":19},"eq":[{"tpl":"i7193","s":{"vit":[151,200],"ine":[31,50],"age":[21,40],"pui":[16,20],"pp":[11,15],"rf":[4,6],"ra":[4,6]}},{"tpl":"i7163","s":{"vit":[151,200],"age":[26,45],"cri":[5,6],"do":[6,7],"rn":[4,5]}},{"tpl":"i6510","s":{"vit":[31,60],"cha":[31,50],"sa":[21,35],"pp":[6,10],"rf":[3,5],"re":[3,5],"xf":[4,8],"xe":[4,8],"xa":[4,8]}}]}'::jsonb, 'zone'),
('pan_plantala', 'Plantala', 106, '{"k":176667,"res":{"Oueille":300,"Pollenectar":300,"Racine sauvage":126,"Viande Séchée":102,"Mildiou de Pandala":29,"Langue de Grenufar":26,"Pistil de Floristile":26,"Tige de Bambouto":26},"eq":[{"tpl":"i7172","s":{"vit":[101,130],"ine":[21,35],"sa":[21,35]}},{"tpl":"i7215","s":{"vit":[101,150],"cha":[31,40],"sa":[21,35],"pp":[11,15],"rt":[4,5],"rf":[4,5],"re":[4,5],"ra":[4,5]}},{"tpl":"i23260","s":{"vit":[51,100],"fo":[21,30],"ine":[21,30],"cha":[21,30],"age":[21,30],"cri":[4,5],"dn":[2,3],"dt":[2,3],"df":[2,3],"de":[2,3],"da":[2,3],"xn":[4,5],"xt":[4,5],"xf":[4,5],"xe":[4,5],"xa":[4,5]}},{"tpl":"i23258","s":{"vit":[86,110],"sa":[16,20],"pui":[21,30],"cri":[4,5],"xn":[4,5],"xt":[4,5],"xf":[4,5],"xe":[4,5],"xa":[4,5]}}]}'::jsonb, 'zone'),
('pan_akwadala', 'Akwadala', 126, '{"k":210000,"res":{"Oueille":300,"Pollenectar":300,"Viande Persillée":87,"Akaslip d''Akakwa":22,"Concombre":22,"Salopette Kwapa":22,"Sarbacane en Bambou":22,"Artefact Pandawushu Eau":15}}'::jsonb, 'zone'),
('pan_terrdala', 'Terrdala', 126, '{"k":210000,"res":{"Oueille":300,"Pollenectar":300,"Viande Persillée":87,"Viscères de Tanuki":36,"Baguette de Tétonuki":22,"Lunettes de Parashukouï":22,"Poing rocheux d''Ishigro Pake":22,"Poterie cassée de Lolojiki":22}}'::jsonb, 'zone'),
('pan_feudala', 'Feudala', 136, '{"k":226667,"res":{"Oueille":300,"Pollenectar":300,"Viande Macérée":81,"Totem Firefoux":75,"Énigme du festival des lanternes":36,"Peau de Crachefoux":20,"Peau de Rouquette":20,"Poils de Boumbardier":20},"eq":[{"tpl":"i8095","s":{"vit":[201,250],"ine":[31,50],"age":[16,30],"do":[6,10],"ini":[201,400],"xn":[6,10]}}]}'::jsonb, 'zone'),
('pan_aerdala', 'Aerdala', 136, '{"k":226667,"res":{"Oueille":300,"Pollenectar":300,"Viande Macérée":81,"Bracelet de Ino-Naru":20,"Lame brisée de Lichangoro":20,"Tête de lance de Fangshu":20,"Étoffe de Kurookin":20,"Encens Kozaru":18},"eq":[{"tpl":"i7164","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"age":[31,50],"sa":[21,40],"do":[6,10],"ra":[6,10]}},{"tpl":"i23268","s":{"vit":[201,250],"age":[51,70],"sa":[21,30],"cri":[3,4],"da":[4,6],"pp":[11,15],"rn":[3,4]}},{"tpl":"i23262","s":{"vit":[151,200],"age":[41,60],"sa":[21,30],"da":[4,7],"so":[6,10],"pp":[11,15],"rn":[4,6],"xa":[7,10],"dcri":[4,6]}},{"tpl":"i23266","s":{"vit":[101,150],"age":[41,50],"sa":[16,25],"pa":[1,1],"so":[4,6],"pp":[9,12],"rn":[3,4],"xa":[7,10],"dcri":[5,8]}}]}'::jsonb, 'zone'),
('fri_port', 'Port de givre', 86, '{"k":143333,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":113,"Le rube":36,"Pince de Crabe Hijacob":29,"Plume de Gélikan":29,"Poil de Chachachovage":28,"Étoffe de Rat Bougri":27},"eq":[{"tpl":"i7255","s":{"vit":[71,100],"fo":[41,60],"pui":[16,20],"cri":[3,4],"rn":[4,5]}}]}'::jsonb, 'zone'),
('fri_bourgade', 'La Bourgade', 86, '{"k":143333,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":113,"Le rube":36,"Pince de Crabe Hijacob":29,"Plume de Gélikan":29,"Poil de Chachachovage":28,"Étoffe de Rat Bougri":27},"eq":[{"tpl":"i7255","s":{"vit":[71,100],"fo":[41,60],"pui":[16,20],"cri":[3,4],"rn":[4,5]}}]}'::jsonb, 'zone'),
('fri_champs', 'Champs de glace', 116, '{"k":193333,"res":{"Dent de sagesse de Boufmouth":300,"Graine de Pois":300,"Oueille":300,"Pollenectar":300,"Yucca Lélé":300,"Viande Saignante":98,"Viande fraîche":72,"Tiques de Boufmouth":40},"eq":[{"tpl":"i6984","s":{"vit":[71,100],"age":[31,50],"sa":[26,40],"cri":[2,3],"pp":[6,10]}},{"tpl":"i7198","s":{"vit":[101,150],"fo":[31,50],"age":[31,50],"sa":[21,35],"cri":[5,7]}},{"tpl":"i2400","s":{"vit":[31,50],"sa":[16,30],"do":[6,10],"pp":[6,10],"rn":[3,5],"xf":[11,15],"xe":[11,15],"xa":[11,15]}},{"tpl":"i14274","s":{"vit":[101,150],"cha":[31,50],"sa":[21,30],"cri":[4,5],"de":[9,12],"ini":[401,500],"rt":[5,7],"rf":[5,7],"xa":[7,10],"dcri":[7,10]}}]}'::jsonb, 'zone'),
('fri_pins', 'Forêt des pins perdus', 136, '{"k":226667,"res":{"Graine Ola":300,"Oueille":300,"Pollenectar":300,"Rose Nelson":300,"Viscères congelés":300,"Viande Persillée":86,"Viande fraîche":72,"Graisse de Fricochère":60},"eq":[{"tpl":"i11599","s":{"vit":[151,200],"fo":[31,45],"ine":[21,30],"sa":[21,30],"dn":[4,5],"dt":[4,5],"df":[5,7],"so":[5,7],"rt":[4,5],"rf":[4,5],"xt":[4,5],"xf":[4,5]}},{"tpl":"i11686","s":{"vit":[151,200],"cha":[31,45],"sa":[31,40],"pui":[11,15],"dn":[7,10],"de":[7,10],"pp":[16,20],"rf":[5,7],"ra":[5,7],"xe":[7,10]}},{"tpl":"i14003","s":{"vit":[101,150],"cha":[31,50],"sa":[16,25],"de":[8,12],"pp":[11,15],"ini":[251,350],"re":[7,10],"rf":[-10,-7],"xe":[11,15]}},{"tpl":"i14005","s":{"vit":[101,150],"age":[31,50],"sa":[16,25],"da":[8,12],"pp":[11,15],"ini":[251,350],"ra":[7,10],"rt":[-10,-7],"xa":[11,15]}}]}'::jsonb, 'zone'),
('fri_lac', 'Lac gelé', 136, '{"k":226667,"res":{"Graine de Lentille":300,"Graisse de mansot":300,"Oueille":300,"Pied de Mansot":300,"Pollenectar":300,"Rhubarbe à papa":300,"Peau déchiquetée de Mansot":180,"Viande Macérée":86},"eq":[{"tpl":"i12090","s":{"vit":[101,140],"fo":[31,40],"sa":[16,25],"cri":[2,3],"dn":[4,5],"dt":[4,5],"da":[7,10],"pp":[7,10],"re":[4,5],"xn":[7,10]}},{"tpl":"i11634","s":{"vit":[101,150],"ine":[31,40],"cha":[31,40],"sa":[21,30],"df":[7,10],"de":[5,7],"so":[4,5],"pp":[11,15],"rt":[5,7],"ra":[5,7]}},{"tpl":"i14637","s":{"vit":[151,200],"cha":[31,40],"age":[21,30],"sa":[21,30],"de":[4,5],"da":[5,7],"pp":[11,15],"rt":[5,7],"rf":[5,7]}},{"tpl":"i14640","s":{"vit":[101,150],"cha":[31,40],"age":[31,40],"sa":[16,25],"cri":[3,4],"de":[5,7],"da":[5,7],"rt":[7,10],"xf":[11,15]}}]}'::jsonb, 'zone'),
('fri_berceau', 'Berceau d''Alma', 146, '{"k":243333,"res":{"Crâne éthéré":300,"Grain de Sel":300,"Pollenectar":300,"Saule en si":300,"Viande de Brousse":71,"Écho du Passé":36,"Coquille de Fantimonier":12,"Mât de Fantômat":12},"eq":[{"tpl":"i11626","s":{"vit":[151,200],"age":[31,50],"sa":[31,40],"cri":[4,5],"dn":[7,10],"da":[7,10],"pp":[11,15],"ini":[301,400],"ra":[5,7],"xt":[5,7],"xe":[5,7]}},{"tpl":"i11600","s":{"vit":[151,200],"fo":[21,35],"cha":[21,35],"age":[21,35],"sa":[21,35],"pui":[11,15],"cri":[3,4],"dn":[7,10],"dt":[7,10],"de":[7,10],"da":[5,7],"pp":[11,20],"ra":[5,7],"xn":[5,7]}},{"tpl":"i11635","s":{"vit":[151,200],"ine":[31,50],"age":[31,50],"sa":[31,40],"df":[5,7],"da":[7,10],"so":[5,7],"pp":[11,15],"ini":[151,250],"ra":[5,7]}},{"tpl":"i11601","s":{"vit":[151,200],"sa":[31,40],"xn":[11,15],"xt":[11,15],"xf":[11,15],"xe":[11,15],"xa":[11,15]}}]}'::jsonb, 'zone'),
('fri_larmes', 'Larmes d''Ouronigride', 156, '{"k":260000,"res":{"Ellébore d''Hel":300,"Graine Hade":300,"Graine de Basalte":300,"Larme au Rikain":300,"Larme magmatique":300,"Oueille":300,"Pollenectar":300,"Rose à lys Cullen":300},"eq":[{"tpl":"i11619","s":{"vit":[201,250],"age":[31,50],"sa":[31,40],"cri":[3,4],"da":[7,10],"pp":[11,20],"ini":[201,300],"rt":[5,7],"re":[5,7],"xa":[7,10]}},{"tpl":"i32215","s":{"vit":[131,180],"fo":[31,40],"ine":[31,40],"cha":[31,40],"sa":[16,25],"cri":[4,6],"pp":[11,15],"rt":[3,4],"re":[3,4]}},{"tpl":"i11623","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"sa":[21,30],"dn":[6,9],"dt":[6,9],"de":[6,9],"ra":[5,7],"xn":[7,10],"xe":[7,10]}},{"tpl":"i11632","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"sa":[31,40],"df":[7,10],"de":[7,10],"so":[7,10],"ini":[101,200],"rt":[5,7],"ra":[5,7],"xn":[7,10]}}]}'::jsonb, 'zone'),
('fri_village', 'Village enseveli', 166, '{"k":276667,"res":{"Dentier de Givrefoux":300,"Givranchy":300,"Grain de Malice":300,"Lys Ander":300,"Oueille":300,"Pollenectar":300,"Viande Maigre":57,"Le rube":36},"eq":[{"tpl":"i11732","s":{"vit":[201,250],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[-4,-3],"de":[7,10],"da":[7,10],"pp":[16,25],"rf":[5,7]}},{"tpl":"i12057","s":{"vit":[251,300],"ine":[41,60],"sa":[31,50],"df":[7,10],"de":[7,10],"da":[7,10],"so":[7,10],"pp":[11,20],"rt":[7,10],"xa":[7,10]}},{"tpl":"i11745","s":{"vit":[151,200],"fo":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"dn":[7,10],"dt":[7,10],"da":[7,10],"pp":[11,20],"ini":[301,400],"rf":[7,10],"xa":[7,10]}},{"tpl":"i11739","s":{"vit":[201,250],"fo":[31,45],"age":[31,45],"sa":[26,35],"pui":[11,15],"cri":[1,2],"dn":[4,6],"dt":[8,12],"da":[8,12],"pp":[11,20],"xf":[7,10],"xa":[7,10]}}]}'::jsonb, 'zone'),
('fri_crevasse', 'Crevasse Perge', 166, '{"k":276667,"res":{"Dentier de Givrefoux":300,"Givranchy":300,"Grain de Malice":300,"Lys Ander":300,"Oueille":300,"Pollenectar":300,"Viande Maigre":57,"Le rube":36},"eq":[{"tpl":"i11732","s":{"vit":[201,250],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[-4,-3],"de":[7,10],"da":[7,10],"pp":[16,25],"rf":[5,7]}},{"tpl":"i12057","s":{"vit":[251,300],"ine":[41,60],"sa":[31,50],"df":[7,10],"de":[7,10],"da":[7,10],"so":[7,10],"pp":[11,20],"rt":[7,10],"xa":[7,10]}},{"tpl":"i11745","s":{"vit":[151,200],"fo":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"dn":[7,10],"dt":[7,10],"da":[7,10],"pp":[11,20],"ini":[301,400],"rf":[7,10],"xa":[7,10]}},{"tpl":"i11739","s":{"vit":[201,250],"fo":[31,45],"age":[31,45],"sa":[26,35],"pui":[11,15],"cri":[1,2],"dn":[4,6],"dt":[8,12],"da":[8,12],"pp":[11,20],"xf":[7,10],"xa":[7,10]}}]}'::jsonb, 'zone'),
('fri_petrifiee', 'Forêt pétrifiée', 176, '{"k":293333,"res":{"Graine de Ricin":300,"Lichen pétrifié":300,"Ortyde":300,"Oueille":300,"Pollenectar":300,"Cœur de Dramanite":75,"Sève de Mycos":75,"Viande Gâtée":51},"eq":[{"tpl":"i15502","s":{"vit":[201,250],"ine":[41,60],"sa":[31,40],"df":[11,15],"pp":[11,15],"re":[7,10],"ra":[7,10]}},{"tpl":"i11947","s":{"vit":[251,300],"ine":[41,60],"age":[31,40],"sa":[31,45],"df":[8,12],"da":[6,8],"pp":[16,25],"rf":[5,7],"xt":[5,7],"xe":[5,7]}},{"tpl":"i15503","s":{"vit":[151,200],"ine":[31,50],"sa":[31,40],"cri":[2,3],"df":[11,15],"pp":[11,15],"rn":[7,10],"rf":[7,10]}},{"tpl":"i15504","s":{"vit":[201,250],"ine":[31,50],"sa":[31,40],"cri":[4,5],"df":[11,15],"so":[9,12],"dcri":[11,15]}}]}'::jsonb, 'zone'),
('fri_crocs', 'Crocs de verre', 186, '{"k":310000,"res":{"Graine de Comique":300,"Muguet Ridon":300,"Objet bizarre":300,"Oueille":300,"Pollenectar":300,"Cervelle de Fleuro":60,"Corne de Blérice":60,"Cuir de Wolvero":60},"eq":[{"tpl":"i13636","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[21,30],"pa":[1,1],"dn":[16,25],"dt":[16,25],"da":[16,25],"pp":[11,15],"xe":[11,15],"dcri":[-30,-21]}},{"tpl":"i13659","s":{"vit":[251,300],"fo":[41,60],"sa":[31,40],"pa":[1,1],"dn":[8,12],"dt":[8,12],"pp":[7,10],"re":[6,8],"ra":[6,8],"xt":[8,12]}},{"tpl":"i11740","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"age":[31,40],"sa":[31,40],"dn":[7,10],"dt":[7,10],"de":[7,10],"da":[7,10],"pp":[21,30],"xn":[7,10],"xf":[7,10],"xa":[7,10]}},{"tpl":"i13645","s":{"vit":[301,350],"cha":[61,80],"age":[61,80],"sa":[21,30],"cri":[2,3],"de":[8,12],"da":[8,12],"ini":[-400,-301],"rn":[5,7],"re":[5,7],"ra":[5,7]}}]}'::jsonb, 'zone'),
('fri_torrideau', 'Mont Torrideau', 186, '{"k":310000,"res":{"Cuillère":300,"Graine Pops":300,"Oueille":300,"Pollenectar":300,"Pétunia Fron":300,"Miel de Boulglours":100,"Viande Noire":45,"Le rube":36},"eq":[{"tpl":"i11756","s":{"vit":[251,350],"cha":[31,40],"age":[31,40],"sa":[31,40],"cri":[4,5],"dn":[7,10],"de":[7,10],"da":[7,10],"pp":[16,25],"xn":[7,10],"xa":[7,10]}},{"tpl":"i17119","s":{"vit":[251,300],"fo":[41,50],"ine":[41,50],"sa":[31,40],"cri":[4,5],"dn":[8,12],"dt":[8,12],"df":[8,12],"ini":[301,400],"re":[5,7]}},{"tpl":"i17120","s":{"vit":[201,250],"fo":[41,50],"ine":[41,50],"sa":[26,35],"pui":[11,15],"cri":[3,4],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"rf":[7,10]}},{"tpl":"i11728","s":{"vit":[251,350],"ine":[31,50],"age":[31,50],"sa":[31,50],"pui":[16,25],"cri":[3,4],"df":[8,12],"da":[8,12],"so":[4,6],"pp":[7,10],"rt":[7,10],"xn":[7,10]}}]}'::jsonb, 'zone'),
('fri_ruche', 'Ruche des Gloursons', 186, '{"k":310000,"res":{"Cuillère":300,"Graine Pops":300,"Oueille":300,"Pollenectar":300,"Pétunia Fron":300,"Miel de Boulglours":60,"Viande Noire":45,"Le rube":36},"eq":[{"tpl":"i11756","s":{"vit":[251,350],"cha":[31,40],"age":[31,40],"sa":[31,40],"cri":[4,5],"dn":[7,10],"de":[7,10],"da":[7,10],"pp":[16,25],"xn":[7,10],"xa":[7,10]}},{"tpl":"i17119","s":{"vit":[251,300],"fo":[41,50],"ine":[41,50],"sa":[31,40],"cri":[4,5],"dn":[8,12],"dt":[8,12],"df":[8,12],"ini":[301,400],"re":[5,7]}},{"tpl":"i17120","s":{"vit":[201,250],"fo":[41,50],"ine":[41,50],"sa":[26,35],"pui":[11,15],"cri":[3,4],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"rf":[7,10]}},{"tpl":"i11728","s":{"vit":[251,350],"ine":[31,50],"age":[31,50],"sa":[31,50],"pui":[16,25],"cri":[3,4],"df":[8,12],"da":[8,12],"so":[4,6],"pp":[7,10],"rt":[7,10],"xn":[7,10]}}]}'::jsonb, 'zone'),
('fri_salbatroces', 'Roc des Salbatroces', 200, '{"k":333333,"res":{"Oueille":300,"Pollenectar":300,"Kroboplasme de Bacterrib":75,"Kroboplasme de Tabacille":75,"Kroboplasme de Verminocule":75,"Kroboplasme de Virustine":75,"Le rube":36,"Viande Goûtue":36},"eq":[{"tpl":"i15698","s":{"vit":[251,300],"sa":[31,40],"cri":[3,4],"rt":[5,7],"ra":[5,7]}},{"tpl":"i15693","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,40],"pa":[1,1],"df":[9,12],"de":[9,12],"ra":[7,10],"dcri":[11,15]}},{"tpl":"i15699","s":{"vit":[301,350],"sa":[31,40],"pui":[31,50],"cri":[3,4],"pa":[1,1],"pp":[11,15],"rn":[7,10],"re":[7,10],"dcri":[16,20]}},{"tpl":"i15694","s":{"vit":[351,400],"cha":[41,50],"sa":[31,40],"pui":[11,15],"cri":[3,4],"pa":[1,1],"de":[11,15],"pp":[11,15],"rn":[5,7],"rf":[5,7]}}]}'::jsonb, 'zone'),
('fri_epaves', 'Épaves Silencieuses', 200, '{"k":333333,"res":{"Parasite de Crânonier":75,"Parasite de Funespadon":75,"Parasite de Macrab":75,"Parasite de Tournoyé":75,"Mycose Infectieuse":36,"Viande Goûtue":36,"Éclat d''océan":36,"Aquarakne de Crânonier":9},"eq":[{"tpl":"i20391","s":{"vit":[351,400],"ine":[51,70],"cha":[51,70],"sa":[21,30],"df":[16,20],"de":[16,20],"pp":[11,15],"rn":[5,7],"rt":[5,7]}},{"tpl":"i19604","s":{"vit":[301,400],"fo":[61,80],"cha":[61,80],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"de":[11,15],"rf":[7,10],"re":[7,10]}},{"tpl":"i19599","s":{"vit":[301,350],"age":[61,80],"sa":[31,40],"cri":[3,4],"da":[11,15],"pp":[11,15],"rt":[7,10],"re":[7,10],"dcri":[9,12]}},{"tpl":"i19608","s":{"vit":[201,250],"sa":[31,40],"pui":[31,40],"rf":[5,7],"re":[5,7]}}]}'::jsonb, 'zone'),
('fri_martegel', 'Royaume des Martegel', 200, '{"k":333333,"res":{"Viande Goûtue":36,"Dent de Vatenbière":9,"Fronde de Boufbos":9,"Jambière de Kasrok":9,"Poils de barbe de Barbélier":9,"Chope de Bière":6},"eq":[{"tpl":"i8098","s":{"vit":[401,450],"cha":[61,80],"sa":[31,40],"de":[11,15],"pp":[16,25],"rt":[5,10],"rf":[4,7]}},{"tpl":"i19978","s":{"vit":[301,400],"fo":[51,70],"cha":[51,70],"sa":[31,40],"dn":[7,10],"dt":[7,10],"de":[7,10],"pp":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i19982","s":{"vit":[301,400],"age":[81,100],"sa":[31,50],"cri":[4,5],"da":[16,20],"pp":[11,15],"ra":[7,10]}},{"tpl":"i19986","s":{"vit":[301,350],"sa":[31,40],"pui":[51,70],"cri":[4,5],"dn":[11,15],"dt":[11,15],"df":[11,15],"de":[11,15],"da":[11,15],"rn":[4,5]}}]}'::jsonb, 'zone'),
('sah_ossements', 'Dunes des ossements', 76, '{"k":126667,"res":{"Oueille":300,"Pollenectar":300,"Viande Sanguinolente":121,"Œil de Léolhyène":31,"Queue de Fennex":30,"Queue de Scordion Bleu":30,"Écailles d''Ouroboulos":30,"Sable Fin":20},"eq":[{"tpl":"i7243","s":{"vit":[31,40],"fo":[21,30],"rf":[2,3],"ra":[2,3]}},{"tpl":"i7184","s":{"vit":[151,200],"sa":[16,20],"pui":[21,30],"do":[4,5]}},{"tpl":"i8615","s":{"vit":[81,120],"ine":[51,70],"sa":[21,30],"so":[11,15]}},{"tpl":"i18426","s":{"vit":[51,70],"age":[41,60],"sa":[11,15],"rt":[2,3]}}]}'::jsonb, 'zone'),
('sah_cacterre', 'Territoire Cacterre', 126, '{"k":210000,"res":{"Oueille":300,"Pollenectar":300,"Viande Persillée":87,"Fleur de Cactiflore":22,"Moustaches de Cactoblongo":22,"Parchemin de Cactana":22,"String de Pampactus":22,"Jus de Cacterre":15},"eq":[{"tpl":"i18437","s":{"vit":[81,120],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[4,5],"df":[7,10],"de":[7,10],"rf":[7,10]}},{"tpl":"i18431","s":{"vit":[101,150],"fo":[31,50],"age":[31,50],"sa":[21,30],"dn":[5,7],"dt":[5,7],"da":[5,7],"pp":[11,15],"re":[7,10],"dcri":[11,15]}}]}'::jsonb, 'zone'),
('sah_gorge', 'Gorge des Vents Hurlants', 166, '{"k":276667,"res":{"Entrailles de Ver des sables":300,"Oueille":300,"Pollenectar":300,"Reste de masticroc":75,"Reste de morsquale":75,"Viande Maigre":57,"Dent de Cycloporth":14,"Langue de Morsquale":14},"eq":[{"tpl":"i6988","s":{"vit":[301,400],"cha":[41,60],"sa":[41,50]}},{"tpl":"i18585","s":{"vit":[151,200],"cha":[31,40],"age":[31,40],"sa":[21,30],"cri":[2,3],"de":[5,7],"da":[5,7],"so":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i18588","s":{"vit":[151,200],"fo":[41,60],"sa":[31,40],"cri":[2,2],"dn":[5,7],"dt":[5,7],"pp":[11,15],"re":[5,7],"ra":[5,7]}},{"tpl":"i18584","s":{"vit":[251,300],"cha":[51,70],"age":[51,70],"sa":[16,25],"cri":[3,4],"de":[7,10],"da":[7,10],"pp":[11,15],"rf":[7,10]}}]}'::jsonb, 'zone'),
('sah_cite', 'Cité Oubliée', 166, '{"k":276667,"res":{"Entrailles de Ver des sables":300,"Oueille":300,"Pollenectar":300,"Reste de masticroc":75,"Reste de morsquale":75,"Viande Maigre":57,"Dent de Cycloporth":14,"Langue de Morsquale":14},"eq":[{"tpl":"i6988","s":{"vit":[301,400],"cha":[41,60],"sa":[41,50]}},{"tpl":"i18585","s":{"vit":[151,200],"cha":[31,40],"age":[31,40],"sa":[21,30],"cri":[2,3],"de":[5,7],"da":[5,7],"so":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i18588","s":{"vit":[151,200],"fo":[41,60],"sa":[31,40],"cri":[2,2],"dn":[5,7],"dt":[5,7],"pp":[11,15],"re":[5,7],"ra":[5,7]}},{"tpl":"i18584","s":{"vit":[251,300],"cha":[51,70],"age":[51,70],"sa":[16,25],"cri":[3,4],"de":[7,10],"da":[7,10],"pp":[11,15],"rf":[7,10]}}]}'::jsonb, 'zone'),
('sah_pyramide', 'Pyramide Maudite', 200, '{"k":333333,"res":{"Bandelettes Maudites":300,"Bandelette de Bandleth":75,"Bandelette de momie en embuscade":75,"Viande Goûtue":36,"Fragment de Chakanoubis":15,"Sacrifice de Maudits":11,"Dent de Bandleth":9,"Grenat de Momistik":9},"eq":[{"tpl":"i18595","s":{"vit":[251,300],"fo":[31,40],"ine":[31,40],"sa":[21,30],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[7,10],"pp":[11,15],"rn":[5,7],"rf":[5,7]}},{"tpl":"i18601","s":{"vit":[301,350],"ine":[51,70],"cha":[51,70],"sa":[31,40],"cri":[-10,-10],"df":[16,20],"de":[16,20],"so":[11,15],"pp":[11,15],"ra":[7,10]}},{"tpl":"i18439","s":{"vit":[301,350],"fo":[41,50],"ine":[41,50],"cha":[41,50],"age":[41,50],"sa":[21,30],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10]}},{"tpl":"i18597","s":{"vit":[401,500],"fo":[61,80],"sa":[21,30],"cri":[3,4],"dn":[16,20],"dt":[16,20],"pp":[11,15],"rf":[7,10],"ra":[7,10],"dcri":[-30,-30]}}]}'::jsonb, 'zone'),
('pwak_carriere', 'Carrière Chocolatée', 56, '{"k":93333,"res":{"Preuve de fiabilité":300,"Viande Ladre":138,"Œuf suwpwise":72,"Dent de Waddict":35,"Emballage Suspect":35,"Tendon de Waccro":35,"Œil Bionique":35,"Pompon Brunâtre":23},"eq":[{"tpl":"i20848","s":{"vit":[26,30],"fo":[16,20],"age":[16,20],"sa":[29,45],"pui":[13,20],"ini":[76,100]}}]}'::jsonb, 'zone'),
('pwak_jardins', 'Jardins à la Crème', 126, '{"k":210000,"res":{"Preuve de fiabilité":300,"Viande Persillée":87,"Bec de Kwakao":22,"Enrobage de Chocoskargo":22,"Estomac de Mansocolat":22,"Pelage chocolaté":22,"Image de collection":21,"Pépite croquée":15}}'::jsonb, 'zone'),
('pwak_chocomanciens', 'Laboratoires des Chocomanciens', 200, '{"k":333333,"res":{"Preuve de fiabilité":300,"Viande Goûtue":36,"Image de collection":21,"Chaudron de Températurge":9,"Mèche de Pralicienne":9,"Peau de Torréfactueur":9,"Toque de Cabosseur":9,"Éclat Kao brisé":6},"eq":[{"tpl":"i20924","s":{"vit":[351,400],"cha":[31,50],"age":[31,50],"sa":[21,30],"pa":[1,1],"de":[7,10],"da":[7,10],"pp":[7,10],"rn":[7,10],"ra":[4,7]}},{"tpl":"i20956","s":{"vit":[351,400],"cha":[41,60],"age":[41,60],"sa":[21,25],"de":[9,12],"da":[9,12],"ini":[201,300],"rt":[4,7],"rf":[4,7],"dcri":[-20,-20]}},{"tpl":"i20926","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"cha":[31,40],"age":[31,40],"sa":[31,40],"rn":[7,10],"rt":[7,10]}},{"tpl":"i20925","s":{"vit":[401,450],"fo":[31,50],"ine":[31,50],"sa":[21,30],"dt":[7,10],"df":[7,10],"pp":[7,10],"rn":[4,7],"re":[4,7],"ra":[4,7]}}]}'::jsonb, 'zone'),
('enu_creuset', 'Creuset des Fortunés', 96, '{"k":160000,"res":{"Viande Exsudative":108,"Antenne de Trésantène":27,"Corde de Boursoin":27,"Corne de Berserkoffre":27,"Langue de Mimikado":27,"Pièce de Koffrefor":15,"Sachet de Cerises":3,"Kamatrix":2},"eq":[{"tpl":"i15210","s":{"vit":[71,100],"fo":[21,30],"cha":[21,30],"sa":[7,10],"dn":[2,2],"dt":[2,2],"de":[2,2]}}]}'::jsonb, 'zone'),
('eca_pierres', 'Pierres de l''élévation', 106, '{"k":176667,"res":{"Viande Séchée":102,"Palpe de Pikbul":26,"Patte de Pupuce":26,"Peau de Gériatique":26,"Œil de Morcac":26,"Larve pétrifiée d''Ecaflipuce":15,"Tonneau de Jus Goûtu":3,"Biscuit de chance":2},"eq":[{"tpl":"i17598","s":{"vit":[151,200],"ine":[31,50],"age":[21,30],"sa":[16,25],"df":[5,7],"da":[5,7],"xn":[5,7],"xt":[5,7],"xe":[5,7]}}]}'::jsonb, 'zone'),
('sram_ruelles', 'Ruelles des Eaux-Suaires', 126, '{"k":210000,"res":{"Viande Persillée":87,"Bandelette de Tromblion":22,"Foulard de Milimaître":22,"Os de Sramouraï":22,"Sacoche de Kartouche":22,"Insigne de Malveilleur":15,"Crochet rouillé":4,"Tête de mort":4},"eq":[{"tpl":"i16004","s":{"vit":[101,150],"sa":[16,25],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"ini":[101,200]}},{"tpl":"i15999","s":{"vit":[151,200],"sa":[21,30],"cri":[4,5],"dn":[11,15],"dt":[11,15],"df":[11,15],"de":[11,15],"da":[11,15]}}]}'::jsonb, 'zone'),
('enu_carriere', 'Carrière Aurifère', 146, '{"k":243333,"res":{"Pépite aurifère":300,"Viande de Brousse":72,"Corne de Père Phorreur":18,"Griffe de Phorrêveur":18,"Peau de Métaphorreur":18,"Œil de Phozami":18,"Dent de Phorreur":15,"Kamatrix":6},"eq":[{"tpl":"i8937","s":{"vit":[151,200],"fo":[31,50],"ine":[31,50],"cha":[26,40],"so":[5,7],"pp":[11,20],"ini":[201,300],"rt":[5,7],"rf":[5,7]}},{"tpl":"i15201","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[3,4],"df":[7,10],"de":[7,10],"ra":[5,7],"xt":[7,10]}},{"tpl":"i15203","s":{"vit":[151,200],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[3,4],"pa":[1,1],"df":[7,10],"de":[7,10],"pp":[16,20],"rf":[5,7]}},{"tpl":"i15202","s":{"vit":[201,250],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[3,4],"df":[7,10],"de":[7,10],"rt":[7,10]}}]}'::jsonb, 'zone'),
('eca_lande', 'Lande Poilue', 156, '{"k":260000,"res":{"Patte de Matougarou":90,"Œil de Chakichan":75,"Œil de Chargus":75,"Œil de Chasquatch":75,"Viande Fraîche":66,"Cobaye Matougarou":36,"Collier de Chakichan":17,"Oreille de Chargus":17},"eq":[{"tpl":"i8841","s":{"vit":[-150,-101],"age":[61,80],"sa":[31,50],"pui":[11,15],"cri":[4,5],"do":[11,15],"pp":[11,20],"ini":[301,500],"ra":[9,14],"xa":[9,14]}},{"tpl":"i17591","s":{"vit":[201,250],"fo":[41,60],"cha":[41,60],"sa":[31,40],"cri":[4,5],"dn":[7,10],"dt":[7,10],"de":[7,10],"rf":[5,7],"dcri":[9,12]}},{"tpl":"i17590","s":{"vit":[201,250],"fo":[41,60],"cha":[41,60],"sa":[26,35],"dn":[7,10],"dt":[7,10],"de":[7,10],"ini":[401,500],"ra":[7,10],"dcri":[9,12]}},{"tpl":"i17592","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"sa":[16,25],"dn":[7,10],"dt":[7,10],"de":[7,10],"dcri":[7,10]}}]}'::jsonb, 'zone'),
('xel_present', 'Jour présent', 166, '{"k":276667,"res":{"Eau  Putride":300,"Eau putride de Hordémon":300,"Pièce technomagique endommagée":150,"Âme de Seith":75,"Âme de Trantroâ":75,"Âme de Trezz":75,"Âme de Vindeux":75,"Viande Maigre":57}}'::jsonb, 'zone'),
('osa_toorbz', 'Toorbz Boorzzbz', 166, '{"k":276667,"res":{"Balebz":75,"Kamikabz":75,"Quadrabz":75,"Toubibz":75,"Viande Maigre":57,"Lait nourricier":36,"Lymphe régénérante":36,"Sang brûlant":36},"eq":[{"tpl":"i31792","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"age":[31,40],"sa":[21,30],"do":[4,6],"so":[5,8],"pp":[11,15],"rt":[3,4],"re":[3,4],"ra":[3,4]}},{"tpl":"i31791","s":{"vit":[151,200],"ine":[31,40],"cha":[31,40],"age":[31,40],"sa":[21,30],"cri":[1,2],"do":[4,6],"ini":[201,300],"rf":[3,4],"re":[3,4],"ra":[3,4]}},{"tpl":"i31793","s":{"vit":[151,200],"fo":[31,40],"ine":[31,40],"sa":[21,30],"do":[4,6],"so":[5,8],"pp":[7,10],"rt":[3,4],"rf":[3,4]}}]}'::jsonb, 'zone'),
('sram_catacombres', 'Catacombres', 176, '{"k":293333,"res":{"Échantillon d''Éperfide saine":75,"Échantillon de Lucrane sain":75,"Échantillon de Puceronde saine":75,"Échantillon de Scoliopode sain":75,"Jus Toxique de Nécrotique":72,"Viande Gâtée":51,"Chitine de Nécrotique":15,"Aile de Puceronde":13},"eq":[{"tpl":"i15501","s":{"vit":[201,250],"fo":[31,40],"age":[31,40],"sa":[31,50],"cri":[3,4],"dn":[11,15],"dt":[11,15],"da":[11,15],"rf":[7,10]}},{"tpl":"i15500","s":{"vit":[201,250],"fo":[31,40],"age":[31,40],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"da":[11,15]}},{"tpl":"i15499","s":{"vit":[201,250],"fo":[31,40],"age":[31,40],"sa":[31,40],"pa":[1,1],"dn":[11,15],"dt":[11,15],"da":[11,15],"pp":[11,15],"re":[7,10]}}]}'::jsonb, 'zone'),
('enu_retraite', 'Retraite des Éternels', 200, '{"k":333333,"res":{"Échantillon de Sang d''Enutrofor":72,"Viande Goûtue":36,"Poils de Barbe d''Enutrofor":15,"Corne de Kamasterisk":9,"Dent de Lévitrof":9,"Kamatrix":9,"Morceau de clef de Paspartou":9,"Sourcil de Barbétoal":9},"eq":[{"tpl":"i18670","s":{"vit":[201,250],"fo":[41,50],"ine":[41,50],"cha":[41,50],"age":[41,50],"cri":[4,5],"rn":[2,3],"rt":[2,3],"rf":[2,3],"re":[2,3],"ra":[2,3],"dcri":[4,5]}},{"tpl":"i15195","s":{"vit":[351,400],"fo":[51,70],"age":[51,70],"sa":[31,40],"pa":[1,1],"dn":[9,12],"dt":[9,12],"da":[9,12],"re":[7,10]}},{"tpl":"i15217","s":{"vit":[301,350],"ine":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"df":[11,15],"da":[11,15],"pp":[11,15],"rt":[7,10],"xa":[11,15]}},{"tpl":"i15186","s":{"vit":[301,350],"ine":[31,50],"sa":[31,40],"cri":[4,5],"df":[11,15],"so":[11,15],"rn":[7,10],"rt":[7,10]}}]}'::jsonb, 'zone'),
('sram_hauts', 'Hauts Ténébreux', 200, '{"k":333333,"res":{"Bourse de la Cour Sombre":300,"Viande Goûtue":36,"Crâne de centoror volé":15,"Étoffe de la Cour Sombre":15,"Chouchou de Doublure":9,"Mèche de bombe de Terristocrate":9,"Piège désamorcé de Mâchassin":9,"Tête de mort":9},"eq":[{"tpl":"i15438","s":{"vit":[251,300],"ine":[41,60],"cha":[41,60],"age":[41,60],"sa":[31,50],"cri":[2,3],"df":[9,12],"de":[9,12],"da":[9,12],"rt":[7,10]}},{"tpl":"i15429","s":{"vit":[301,350],"fo":[41,60],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"pp":[11,15],"ini":[301,600],"rf":[7,10]}},{"tpl":"i15493","s":{"vit":[351,400],"fo":[51,70],"cha":[51,70],"sa":[31,40],"dn":[16,20],"dt":[16,20],"de":[16,20],"rf":[7,10]}},{"tpl":"i30857","s":{"vit":[301,350],"ine":[51,70],"age":[51,70],"sa":[31,40],"df":[11,15],"da":[11,15],"pp":[11,15],"ini":[301,400],"rf":[5,7],"ra":[5,7]}}]}'::jsonb, 'zone'),
('xel_lendemains', 'Lendemains incertains', 200, '{"k":333333,"res":{"Viande Goûtue":36,"Boucle des Égarés":15,"Corne de Méjaire":9,"Griffe de Buboxor":9,"Sablier miniature":9,"Serre d''Ikargn":9,"Œil de Harpille":9,"Sachet de Poudre Temporelle":3},"eq":[{"tpl":"i15751","s":{"vit":[351,400],"ine":[31,50],"cha":[31,50],"sa":[31,40],"df":[16,20],"de":[16,20],"rn":[5,7],"rt":[5,7]}},{"tpl":"i15742","s":{"vit":[251,300],"fo":[51,70],"age":[51,70],"sa":[31,40],"cri":[4,5],"dn":[11,15],"dt":[11,15],"da":[11,15],"pp":[11,15],"ra":[7,10]}},{"tpl":"i15746","s":{"vit":[351,400],"sa":[31,40],"cri":[4,5],"pa":[1,1],"ra":[7,10]}},{"tpl":"i15779","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[31,40],"cri":[-5,-5],"dn":[16,20],"dt":[16,20],"de":[16,20],"pp":[11,15],"rf":[7,10]}}]}'::jsonb, 'zone'),
('eca_temple', 'Temple de Kerubim', 200, '{"k":333333,"res":{"Viscères du Grand Jeu":300,"Carte Rongée":225,"Herbe à chacha divine":36,"Viande Goûtue":36,"Carte du Grand Jeu":15,"Biscuit de chance":9,"Gilet du Valet":9,"Pique du Soldat":9},"eq":[{"tpl":"i17585","s":{"vit":[301,350],"ine":[31,50],"cha":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"rn":[5,7],"re":[5,7],"dcri":[7,10]}},{"tpl":"i17583","s":{"vit":[351,400],"age":[61,80],"sa":[31,50],"cri":[-5,-5],"da":[16,20],"pp":[11,15],"rn":[7,10],"re":[7,10]}},{"tpl":"i17573","s":{"vit":[301,350],"fo":[61,80],"ine":[61,80],"sa":[31,50],"cri":[4,5],"dn":[9,12],"dt":[9,12],"df":[9,12],"pp":[11,15],"ra":[7,10]}},{"tpl":"i17582","s":{"vit":[251,300],"age":[41,60],"sa":[31,40],"da":[11,15],"pp":[11,15],"rt":[7,10]}}]}'::jsonb, 'zone'),
('osa_reserve', 'Réserve Touffue', 200, '{"k":333333,"res":{"Lait nourricier":36,"Lymphe régénérante":36,"Sang brûlant":36,"Viande Goûtue":36,"Dent de zarbivore":15,"Sachet de Feuilles de salace":9,"Squame du Graogarm":9,"Groin de Brutapir":7},"eq":[{"tpl":"i31766","s":{"vit":[301,350],"fo":[31,50],"ine":[31,50],"cha":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"do":[7,10],"rt":[3,4],"rf":[3,4]}},{"tpl":"i31764","s":{"vit":[251,300],"fo":[31,40],"ine":[31,40],"cha":[31,40],"age":[31,40],"sa":[31,40],"cri":[2,3],"do":[7,10],"rn":[3,4],"rt":[3,4],"rf":[3,4]}},{"tpl":"i31860","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[-30,-30],"cri":[5,8],"dn":[11,15],"dt":[11,15],"de":[11,15],"so":[-25,-25],"pp":[21,30],"ini":[-300,-300],"rt":[4,7],"re":[9,12]}},{"tpl":"i31785","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[2,3],"dn":[11,15],"dt":[11,15],"de":[11,15],"da":[11,15],"pp":[11,15],"rt":[5,7],"re":[5,7],"ra":[5,7]}}]}'::jsonb, 'zone'),
('osa_rhoarim', 'Village Rhoarim', 200, '{"k":333333,"res":{"Lait nourricier":36,"Lymphe régénérante":36,"Sang brûlant":36,"Viande Goûtue":36,"Shampoing Rhoarim":15,"Bandeau d''Ébourifauve":12,"Daguosseuse de Domptueuse":12,"Os Divinatoire de Voracle":12},"eq":[{"tpl":"i31761","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[4,6],"pa":[1,1],"dt":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"ini":[201,300],"rf":[11,15],"dcri":[11,15]}},{"tpl":"i31763","s":{"vit":[351,400],"fo":[41,60],"age":[41,60],"sa":[31,40],"cri":[2,3],"dt":[7,10],"da":[7,10],"pp":[16,20],"ini":[201,300],"rn":[4,7],"rf":[4,7],"re":[4,7],"dcri":[11,15]}},{"tpl":"i31760","s":{"vit":[351,400],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[2,3],"df":[7,10],"de":[7,10],"pp":[16,20],"ini":[201,300],"rn":[4,7],"rt":[4,7],"ra":[4,7],"dcri":[11,15]}},{"tpl":"i31790","s":{"vit":[351,400],"age":[61,80],"sa":[31,40],"cri":[3,5],"da":[16,20],"so":[11,15],"pp":[11,15],"ini":[401,500],"rt":[7,10],"ra":[7,10]}}]}'::jsonb, 'zone'),
('asse_kartonpath', 'Île de Kartonpath', 95, '{"k":158333,"res":{"Oueille":300,"Pollenectar":300,"Viande Exsudative":110,"Patte de Bouledogre":28,"Plume de Gobvious":28,"Dent de Molette":27,"Oreille de Rhinoféroce":27,"Corne de Rhinoféroce":5},"eq":[{"tpl":"i14581","s":{"vit":[81,120],"pui":[21,30],"cri":[3,4],"dt":[4,6],"df":[4,6],"de":[4,6],"da":[4,6]}},{"tpl":"i14582","s":{"vit":[71,100],"cha":[31,40],"sa":[16,20],"cri":[2,3],"de":[2,3],"pp":[11,15],"ra":[4,5]}},{"tpl":"i14579","s":{"vit":[101,150],"cha":[31,40],"age":[31,40],"cri":[3,4],"rt":[4,6],"rf":[4,6]}},{"tpl":"i14583","s":{"cha":[51,70],"sa":[16,20],"de":[5,7],"rt":[5,7],"rf":[5,7]}}]}'::jsonb, 'zone'),
('bon_rives', 'Rives iridescentes', 22, '{"k":36667,"res":{"Oueille":300,"Pollenectar":300,"Viande Faisandée":164,"Poire de Pissenlit":75,"Poire de Rose":75,"Poire de Tournesol":75,"Fleur de Pissenlit Diabolique":41,"Pétale de Rose Démoniaque":41},"eq":[{"tpl":"i6924","s":{"vit":[16,20],"pui":[7,10]}},{"tpl":"i775","s":{"vit":[26,30],"cri":[3,3]}},{"tpl":"i357","s":{"vit":[21,25],"age":[7,10],"da":[1,1]}},{"tpl":"i1350","s":{"vit":[16,20],"cha":[11,15]}}]}'::jsonb, 'zone'),
('bon_cimetiere_heros', 'Cimetière des Héros', 46, '{"k":76667,"res":{"Dent de Chafer":300,"Pollenectar":300,"Viande Tendre":144,"Casque de Chafer d''Élite":75,"Flèche du Chafer Archer":36,"Miséricorde du Chafer d''Élite":36,"Mâchoire du Chafer Draugr":36,"Slip en cuir du Chafer Lancier":36},"eq":[{"tpl":"i2094","s":{"vit":[21,30],"rn":[2,2],"rt":[2,2],"rf":[2,2],"re":[2,2],"ra":[2,2]}},{"tpl":"i1427","s":{"vit":[41,60],"cha":[41,50],"age":[-40,-40],"cri":[4,5],"de":[2,3],"pp":[4,5],"dcri":[5,7]}},{"tpl":"i13891","s":{"age":[21,25],"sa":[7,10],"cri":[3,4],"da":[4,5]}},{"tpl":"i10853","s":{"ine":[11,15],"cha":[21,30],"df":[4,5]}}]}'::jsonb, 'zone'),
('bra_bordure', 'Bordure de Brâkmar', 46, '{"k":76667,"res":{"Pollenectar":300,"Viande Tendre":144,"Flamme Spectrale":36,"Relique Familiale":36,"Sueur Froide de Fantôme":36,"Vieille Partition":36,"Linceul":6,"Makroute Déchiqueté":6},"eq":[{"tpl":"i12502","s":{"vit":[31,40],"ine":[16,25],"sa":[11,15],"so":[4,5]}}]}'::jsonb, 'zone'),
('bon_canaux', 'Canaux méphitiques', 107, '{"k":178333,"res":{"Viande Séchée":82,"Collier de Chak Rat":20,"Lance de Chika Rat":20,"Lance-Pierre de Scélée Rate":20,"Ouvrage magique d''Aloevée Rate":20,"Morceau d''emmental":14,"Poil de Rat Bontarien":14,"Patte de la Gardienne des Égouts":13},"eq":[{"tpl":"i25753","s":{"vit":[51,100],"cha":[21,30],"sa":[11,20],"pui":[7,10],"de":[3,5],"ini":[151,200]}}]}'::jsonb, 'zone'),
('bra_entrailles', 'Entrailles de Brâkmar', 107, '{"k":178333,"res":{"Touffe de rat de Brâkmar":240,"Viande Séchée":82,"Crâne magique de Rate Atinée":20,"Oreille de Rat Plapla":20,"Tuyau Rouillé de Rate Iboisée":20,"Vieux Bouquin de Rat Li":20,"Poil de Rat Brâkmarien":14,"Patte de la Gardienne des Égouts":13},"eq":[{"tpl":"i25752","s":{"vit":[51,100],"age":[21,30],"sa":[11,20],"pui":[7,10],"cri":[3,5],"da":[3,5],"ini":[151,200]}}]}'::jsonb, 'zone'),
('grobe_cimetiere', 'Cimetière de Grobe', 156, '{"k":260000,"res":{"Pollenectar":300,"Viande Fraîche":66,"Croissant de Tsukinochi":17,"Fleur d''Onabu-Geisha":17,"Os de Jiangshi-Nobi":17,"Plastron de Tambouraï":17,"Étoffe de Samouraï fantôme":11,"Ectoplasme de Jiangshi-Nobi":5},"eq":[{"tpl":"i23620","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"cha":[16,20],"sa":[26,35],"cri":[-10,-10],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[4,5],"pp":[21,25],"re":[4,6]}},{"tpl":"i23621","s":{"vit":[111,160],"fo":[26,35],"ine":[26,35],"cha":[26,35],"sa":[16,25],"rn":[3,4],"rt":[3,4],"rf":[3,4],"re":[3,4]}},{"tpl":"i23626","s":{"vit":[151,200],"fo":[41,50],"ine":[41,50],"age":[41,50],"sa":[16,20],"cri":[2,3],"pa":[1,1],"dn":[5,7],"dt":[5,7],"df":[5,7],"da":[5,7],"ini":[-200,-200],"rf":[4,5],"dcri":[7,10]}},{"tpl":"i23618","s":{"vit":[151,200],"fo":[41,60],"ine":[31,40],"cha":[41,60],"sa":[21,30],"cri":[-10,-10],"dn":[7,10],"dt":[7,10],"df":[4,5],"de":[7,10],"pp":[16,20],"rf":[4,5]}}]}'::jsonb, 'zone'),
('grobe_mont', 'Mont des Tombeaux', 166, '{"k":276667,"res":{"Essence Spirituelle":300,"Pollenectar":300,"Testicules de Tsume-bozu":75,"Viande Maigre":57,"Kaokurimono":14,"Kapokaza":14,"Lanterne usée":14,"Œil de Madura":14},"eq":[{"tpl":"i23623","s":{"vit":[201,250],"ine":[41,50],"sa":[21,30],"cri":[3,4],"df":[7,10],"so":[4,5],"ini":[201,300],"ra":[5,7],"xf":[7,10],"xa":[7,10]}},{"tpl":"i23625","s":{"vit":[251,300],"fo":[41,60],"ine":[41,60],"sa":[21,30],"cri":[2,3],"dn":[7,10],"dt":[7,10],"df":[7,10],"pp":[16,20],"re":[5,7]}},{"tpl":"i23628","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"age":[31,40],"sa":[21,30],"cri":[1,2],"dn":[6,9],"dt":[6,9],"df":[6,9],"da":[6,9],"ini":[-300,-300],"rt":[4,5],"dcri":[4,5]}},{"tpl":"i30692","s":{"vit":[111,160],"ine":[41,50],"sa":[21,25],"xn":[7,10],"xt":[7,10],"xf":[7,10],"xe":[7,10],"xa":[7,10]}}]}'::jsonb, 'zone'),
('sak_plaine', 'Plaine de Sakaï', 186, '{"k":310000,"res":{"Oueille":300,"Pollenectar":300,"Perkü":60,"Viande Noire":42,"Oreille de Gobosteur":9,"Peau d''Ouilleur":8,"Péroné du Marôdeur":8,"Œil de Sapeur":8},"eq":[{"tpl":"i13122","s":{"vit":[301,350],"cha":[61,80],"sa":[31,40],"cri":[4,6],"de":[14,18],"pp":[21,30]}},{"tpl":"i11469","s":{"vit":[201,250],"sa":[36,50],"cri":[4,5],"do":[9,12],"pp":[11,20],"ini":[201,300],"rt":[7,10],"xn":[7,10],"xf":[7,10],"xe":[7,10]}},{"tpl":"i11514","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[31,50],"do":[5,7],"pp":[21,30],"ini":[301,400],"rf":[6,10],"xn":[6,10]}},{"tpl":"i13121","s":{"vit":[301,350],"cha":[51,75],"sa":[31,50],"cri":[2,3],"pa":[1,1],"de":[14,18],"ini":[401,500],"xa":[16,20]}}]}'::jsonb, 'zone'),
('sak_foret', 'Forêt enneigée', 186, '{"k":310000,"res":{"Oueille":300,"Pollenectar":300,"Perkü":60,"Viande Noire":42,"Oreille de Gobosteur":9,"Peau d''Ouilleur":8,"Péroné du Marôdeur":8,"Œil de Sapeur":8},"eq":[{"tpl":"i13122","s":{"vit":[301,350],"cha":[61,80],"sa":[31,40],"cri":[4,6],"de":[14,18],"pp":[21,30]}},{"tpl":"i11469","s":{"vit":[201,250],"sa":[36,50],"cri":[4,5],"do":[9,12],"pp":[11,20],"ini":[201,300],"rt":[7,10],"xn":[7,10],"xf":[7,10],"xe":[7,10]}},{"tpl":"i11514","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[31,50],"do":[5,7],"pp":[21,30],"ini":[301,400],"rf":[6,10],"xn":[6,10]}},{"tpl":"i13121","s":{"vit":[301,350],"cha":[51,75],"sa":[31,50],"cri":[2,3],"pa":[1,1],"de":[14,18],"ini":[401,500],"xa":[16,20]}}]}'::jsonb, 'zone'),
('val_ereboria', 'Galeries d''Ereboria', 186, '{"k":310000,"res":{"Déguisement Blindur":75,"Déguisement Boufronde":75,"Déguisement Marthos":75,"Déguisement Serpyn":75,"Viande Noire":45,"Armure de Blindur":11,"Bave de Marthos":11,"Fronde de Boufronde":11},"eq":[{"tpl":"i27542","s":{"vit":[301,350],"cha":[61,80],"sa":[21,30],"cri":[3,5],"de":[9,12],"pp":[16,20],"re":[5,7],"ra":[5,7],"dcri":[7,10]}},{"tpl":"i27526","s":{"vit":[201,250],"fo":[21,30],"ine":[31,40],"age":[41,50],"sa":[16,20],"dn":[4,6],"dt":[4,6],"df":[5,8],"da":[7,10],"so":[7,10],"pp":[7,10],"ini":[-200,-200],"rt":[3,5],"rf":[3,5]}},{"tpl":"i27541","s":{"vit":[251,300],"cha":[51,70],"sa":[31,40],"cri":[3,5],"de":[9,12],"pp":[7,10],"ini":[301,400],"re":[6,8],"ra":[6,8],"dcri":[6,8]}},{"tpl":"i27540","s":{"vit":[251,300],"cha":[41,60],"sa":[31,40],"pui":[21,40],"cri":[4,6],"dt":[9,12],"de":[9,12],"rn":[5,7],"rt":[5,7]}}]}'::jsonb, 'zone'),
('val_ephedrya', 'Ephedrya', 200, '{"k":333333,"res":{"Oueille":300,"Pollenectar":300,"Viande Goûtue":36,"Liane de Soldalia":9,"Mousse de Caméliache":9,"Poing de Coquelicogne":9,"Serpe perdue":9,"Épine d''Armuguet":9},"eq":[{"tpl":"i30860","s":{"vit":[351,400],"fo":[51,70],"sa":[41,50],"cri":[3,5],"dn":[11,15],"dt":[11,15],"so":[16,20],"rn":[5,7],"rt":[3,5],"ra":[3,5]}},{"tpl":"i27545","s":{"vit":[451,500],"sa":[41,50],"pui":[61,80],"cri":[-10,-10],"dn":[-200,-200],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"re":[5,7],"ra":[5,7]}},{"tpl":"i27548","s":{"vit":[201,250],"sa":[36,45],"pui":[21,30],"re":[3,5],"ra":[3,5]}},{"tpl":"i27547","s":{"vit":[251,300],"sa":[21,30],"pui":[41,60],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"ini":[401,500],"rn":[7,10]}}]}'::jsonb, 'zone'),
('nimotopia', 'Nimotopia', 186, '{"k":310000,"res":{"Fléchette Tranquillisante":300,"Oueille":300,"Pollenectar":300,"Sac de Plumes":75,"Viande Noire":45,"Contrat de Travail":18,"Déguisement de Crâmbo":18,"Bave de Brokouillon":11},"eq":[{"tpl":"i18702","s":{"vit":[151,200],"xn":[21,30],"xt":[21,30],"xf":[21,30],"xe":[21,30],"xa":[21,30]}},{"tpl":"i33605","s":{"vit":[201,250],"cha":[41,50],"age":[41,50],"sa":[31,40],"de":[5,8],"da":[5,8],"pp":[11,15],"rt":[7,10]}},{"tpl":"i33606","s":{"vit":[251,300],"cha":[51,70],"age":[51,70],"sa":[31,40],"de":[7,10],"da":[7,10],"pp":[11,15],"re":[7,10],"ra":[7,10]}},{"tpl":"i18779","s":{"vit":[251,300],"cha":[31,50],"age":[31,50],"sa":[31,40],"cri":[4,5],"pa":[1,1],"de":[7,10],"da":[7,10],"pp":[11,15],"rt":[4,5],"rf":[7,10]}}]}'::jsonb, 'zone'),
('obs_dimension', 'Dimension Obscure', 186, '{"k":310000,"res":{"Masque de Brutopak":75,"Masque de Caznoar":75,"Masque de Noctulule":75,"Masque de Panterreur":75,"Panterreur":75,"Viande Noire":39,"Éclat Obscur":18,"Masque de la Vengeance":10},"eq":[{"tpl":"i14930","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[4,5],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"pp":[11,15],"ra":[7,10]}},{"tpl":"i13123","s":{"vit":[351,400],"age":[71,100],"sa":[31,40],"da":[16,20],"pp":[11,15],"ra":[7,10]}},{"tpl":"i13125","s":{"vit":[251,300],"age":[61,80],"sa":[31,40],"cri":[4,6],"da":[14,18],"pp":[11,15],"ini":[201,300],"xn":[11,15],"xe":[11,15]}},{"tpl":"i14931","s":{"vit":[251,300],"fo":[31,40],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[2,3],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"rt":[5,7],"rf":[5,7]}}]}'::jsonb, 'zone'),
('har_jardins', 'Jardins d''Hiver', 200, '{"k":333333,"res":{"Cendres élémentaires":300,"Pollenectar":300,"Résidu d''alchillusion":300,"Viande Goûtue":36,"Bave de Nessil":9,"Bractée de Drosérâle":9,"Canine de Krakal":9,"Plume de Dodox":9},"eq":[{"tpl":"i14067","s":{"vit":[151,200],"sa":[31,50],"dn":[4,5],"dt":[4,5],"df":[4,5],"de":[4,5],"da":[4,5]}},{"tpl":"i14088","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[4,6],"df":[11,15],"de":[11,15],"pp":[7,10],"ini":[201,300],"xt":[11,15],"xe":[11,15]}},{"tpl":"i14089","s":{"vit":[251,300],"ine":[31,40],"cha":[31,40],"sa":[21,30],"df":[8,12],"de":[8,12],"so":[7,10],"dcri":[7,10]}},{"tpl":"i14055","s":{"vit":[251,300],"fo":[51,75],"sa":[31,40],"cri":[-8,-6],"dn":[7,10],"dt":[7,10],"pp":[16,20],"ini":[301,400],"rt":[7,10],"ra":[7,10],"dcri":[7,10]}}]}'::jsonb, 'zone'),
('har_remparts', 'Remparts à vent', 200, '{"k":333333,"res":{"Morceau de Brikoléreux":300,"Planche renforcée":300,"Pollenectar":300,"Viande Goûtue":36,"Astragale de Mécanofoux":9,"Bec de Mansordide":9,"Canine de Kanimate":9,"Valve Étanche de Mansordide":9},"eq":[{"tpl":"i14074","s":{"vit":[301,350],"ine":[21,30],"cha":[21,30],"age":[21,30],"sa":[41,60],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i13894","s":{"vit":[301,350],"ine":[41,60],"age":[31,40],"sa":[31,40],"cri":[3,4],"df":[8,12],"da":[14,18],"pp":[7,10],"rt":[5,7],"rf":[5,7],"xa":[7,10]}},{"tpl":"i14132","s":{"vit":[351,400],"fo":[31,50],"ine":[31,50],"age":[31,50],"sa":[31,40],"dt":[11,15],"df":[11,15],"da":[11,15],"re":[7,10]}},{"tpl":"i14171","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"sa":[21,30],"dt":[10,14],"df":[10,14],"so":[11,15],"pp":[11,15]}}]}'::jsonb, 'zone'),
('har_tannerie', 'Tannerie Écarlate', 200, '{"k":333333,"res":{"Cuir épais":300,"Pollenectar":300,"Viande Goûtue":36,"Crâne de centoror gelé":15,"Cuir Huileux de Grodruche":9,"Cuir d''Empaillé":9,"Cuir de Cuirboule":9,"Cuir de Grodruche":9},"eq":[{"tpl":"i14156","s":{"vit":[251,300],"cha":[61,80],"sa":[31,40],"cri":[4,5],"de":[9,13],"pp":[11,15],"ini":[-400,-301],"rt":[6,8],"ra":[6,8],"xn":[16,20]}},{"tpl":"i13896","s":{"vit":[201,250],"fo":[41,60],"age":[41,60],"cri":[4,5],"dn":[14,18],"dt":[14,18],"da":[14,18],"pp":[11,15],"ini":[-400,-301],"rn":[7,10],"ra":[7,10]}},{"tpl":"i14167","s":{"vit":[251,300],"ine":[31,40],"cha":[41,60],"sa":[31,40],"df":[7,10],"de":[11,15],"so":[4,5],"pp":[16,20],"ra":[7,10],"xf":[11,15]}},{"tpl":"i14053","s":{"vit":[351,400],"fo":[21,30],"age":[41,60],"sa":[31,40],"cri":[4,5],"dn":[6,8],"dt":[6,8],"da":[12,16],"pp":[7,10],"rf":[6,8],"re":[6,8]}}]}'::jsonb, 'zone'),
('har_bastion', 'Bastion des froides légions', 200, '{"k":333333,"res":{"Essence glaciale d''armutin":300,"Frosplasme":300,"Pollenectar":300,"Métal maudit":90,"Viande Goûtue":36,"Sacrifice d''Armutins":11,"Casque de Stalak":9,"Incisive de Stalak":9},"eq":[{"tpl":"i13630","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"sa":[31,50],"cri":[2,3],"dn":[11,15],"dt":[11,15],"df":[11,15],"pp":[16,20],"rt":[6,8],"xn":[6,8],"xe":[6,8]}},{"tpl":"i33608","s":{"vit":[451,500],"ine":[31,40],"sa":[41,50],"pui":[41,50],"pa":[1,1],"rt":[9,12],"ra":[9,12]}},{"tpl":"i13631","s":{"vit":[201,250],"fo":[41,60],"ine":[41,60],"sa":[31,50],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[4,6],"pp":[16,20],"rf":[5,7],"ra":[5,7]}},{"tpl":"i13629","s":{"vit":[151,200],"fo":[31,40],"ine":[31,40],"sa":[31,40],"dn":[11,15],"dt":[11,15],"df":[11,15],"xn":[8,12],"xt":[8,12],"xf":[8,12]}}]}'::jsonb, 'zone'),
('har_clepsydre', 'Tour de la Clepsydre', 200, '{"k":333333,"res":{"Mécanisme cassé":300,"Rouage en Or":36,"Viande Goûtue":36,"Aile de Nocturlabe":9,"Aile de Sinistrofu":9,"Plume de Granduk":9,"Œil de Cycloïde":9,"Lettre de noblesse":4},"eq":[{"tpl":"i14161","s":{"vit":[351,400],"fo":[41,60],"cha":[41,60],"sa":[31,50],"cri":[4,5],"dn":[12,16],"dt":[12,16],"de":[12,16],"ini":[301,400],"rn":[7,10],"xf":[16,20]}},{"tpl":"i14133","s":{"vit":[351,400],"fo":[41,60],"cha":[41,60],"sa":[21,30],"dn":[12,16],"dt":[12,16],"de":[12,16],"rf":[7,10],"xn":[16,20],"xa":[11,15]}},{"tpl":"i14097","s":{"vit":[301,350],"fo":[71,100],"sa":[31,40],"cri":[-7,-5],"pa":[1,1],"dt":[11,15],"pp":[16,20],"ra":[7,10],"xe":[16,20],"dcri":[11,15]}},{"tpl":"i18697","s":{"vit":[201,250],"sa":[31,40],"rn":[11,15]}}]}'::jsonb, 'zone'),
('har_caserne', 'Caserne du Jour sans fin', 200, '{"k":333333,"res":{"Cendres de Brûlâme":300,"Douleur de Brûlâme":300,"Pollenectar":300,"Viande Goûtue":36,"Fragment d''Ectorche":15,"Sacrifice de Brûlâmes":11,"Pince de Crâme":9,"Restes d''Esprigné":9},"eq":[{"tpl":"i19252","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,50],"cri":[3,4],"df":[11,15],"de":[11,15],"so":[9,12],"ra":[7,10]}},{"tpl":"i19241","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[31,40],"cri":[4,5],"pa":[1,1],"dn":[9,12],"dt":[9,12],"da":[9,12],"pp":[11,15],"rf":[7,10]}},{"tpl":"i19243","s":{"vit":[301,350],"fo":[31,50],"age":[31,50],"sa":[21,30],"cri":[3,4],"dn":[9,12],"dt":[9,12],"da":[9,12],"rn":[5,7],"rf":[5,7],"re":[5,7]}},{"tpl":"i19250","s":{"vit":[351,400],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[2,2],"df":[11,15],"de":[11,15],"pp":[11,15],"rn":[7,10],"rt":[7,10],"dcri":[9,12]}}]}'::jsonb, 'zone'),
('suf_embruns', 'Salles des Embruns', 200, '{"k":333333,"res":{"Métal abyssal":75,"Pile Steamer":36,"Viande Goûtue":36,"Boîte à Outils des Mercemers":24,"Barbe du Cyclophandre":12,"Cuir d''Eskoglyphe":12,"Pic de Pikoleur":12,"Sachet de Sel":3},"eq":[{"tpl":"i14882","s":{"vit":[201,250],"fo":[21,30],"cha":[21,30],"sa":[16,25],"pui":[11,15],"cri":[4,5],"dn":[9,12],"dt":[9,12],"de":[9,12],"rf":[5,7],"ra":[5,7]}},{"tpl":"i14885","s":{"vit":[301,350],"ine":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"df":[9,12],"da":[9,12],"so":[7,10],"rn":[7,10],"ra":[7,10],"dcri":[-15,-11]}},{"tpl":"i14886","s":{"vit":[301,350],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"de":[7,10],"da":[7,10],"pp":[11,15],"ini":[301,500],"rn":[5,7],"rt":[5,7],"rf":[5,7],"xf":[11,15]}},{"tpl":"i14884","s":{"vit":[201,250],"ine":[31,40],"age":[31,40],"sa":[31,40],"pa":[1,1],"df":[9,12],"da":[9,12],"so":[9,12],"pp":[16,25],"rf":[7,10],"xn":[11,15],"dcri":[-20,-16]}}]}'::jsonb, 'zone'),
('suf_vestiges', 'Vestiges engloutis', 200, '{"k":333333,"res":{"Chair aquatique":300,"Sable de Wakfu":75,"Greuvette centenaire":58,"Viande Goûtue":36,"Bave de Mol Usk":7,"Dent de Tilamproie":7,"Pince de Crabe Yoloniste":7,"Queue de Mantaze":7},"eq":[{"tpl":"i18001","s":{"vit":[301,400],"ine":[81,100],"sa":[31,50],"cri":[3,4],"pa":[1,1],"df":[11,15],"so":[7,10],"rt":[7,10]}},{"tpl":"i18011","s":{"vit":[301,350],"ine":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"df":[9,12],"da":[9,12],"rt":[5,7],"re":[7,10]}},{"tpl":"i18018","s":{"vit":[301,400],"fo":[61,80],"sa":[31,40],"cri":[3,4],"dn":[16,20],"dt":[16,20],"ra":[7,10]}},{"tpl":"i18024","s":{"vit":[351,400],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[4,5],"df":[9,12],"de":[9,12],"so":[9,12],"re":[7,10],"dcri":[11,15]}}]}'::jsonb, 'zone'),
('suf_rlyugluglu', 'Abîme de R''lyugluglu', 200, '{"k":333333,"res":{"Page indéchiffrable":300,"Tentacule Agité":300,"Viande Goûtue":36,"P''Koutoulou Ch''ton":18,"P''Koutoulou Glaakiph":18,"P''Koutoulou Zothoth":18,"Crâne de centoror mouillé":15,"Flûte de Klûtiste":7},"eq":[{"tpl":"i18015","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[31,40],"cri":[4,6],"dn":[9,12],"dt":[9,12],"de":[9,12],"pp":[11,15],"rf":[7,10]}},{"tpl":"i18003","s":{"vit":[401,500],"ine":[81,100],"sa":[41,60],"df":[14,18],"so":[11,15],"pp":[11,15],"rn":[5,7],"ra":[5,7]}},{"tpl":"i18000","s":{"vit":[301,350],"fo":[51,70],"sa":[21,30],"cri":[2,2],"pa":[1,1],"dn":[9,12],"dt":[9,12],"rf":[7,10],"ra":[7,10]}},{"tpl":"i18028","s":{"vit":[301,350],"dn":[16,20],"dt":[16,20],"df":[16,20],"de":[16,20],"da":[16,20],"rf":[5,7],"ra":[5,7]}}]}'::jsonb, 'zone'),
('suf_trithons', 'Tréfonds des Trithons', 200, '{"k":333333,"res":{"Cerveau de Trithon":300,"Cuisse de Trithon":300,"Herbe Aquatique":240,"Viande Goûtue":36,"Encre de Poulpée":7,"Lanterne de Tourthon":7,"Moustache de Rilur":7,"Trident de Tryde":7},"eq":[{"tpl":"i18019","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"dn":[9,12],"dt":[9,12],"da":[9,12],"rf":[7,10],"ra":[7,10]}},{"tpl":"i18017","s":{"vit":[301,400],"cha":[61,80],"sa":[31,50],"cri":[4,6],"de":[16,20],"rn":[5,7],"rf":[5,7]}},{"tpl":"i18021","s":{"vit":[301,350],"fo":[51,70],"age":[51,70],"sa":[31,40],"cri":[3,4],"dn":[9,12],"dt":[9,12],"da":[9,12],"rf":[7,10]}},{"tpl":"i18031","s":{"vit":[301,400],"sa":[31,40],"cri":[3,4],"pp":[11,15],"ini":[601,800],"rf":[7,10],"dcri":[21,25]}}]}'::jsonb, 'zone'),
('cav_corrompu', 'Royaume Corrompu', 200, '{"k":333333,"res":{"Oueille":300,"Sève Putride":36,"Viande Goûtue":36,"Patte de Nheur''Gueule":9,"Peau pourrie de Dolid":9,"Pétale de Gangredogue":9,"Tentacule de Tentaclaque":9,"Germes corrompus":6},"eq":[{"tpl":"i22213","s":{"vit":[351,400],"fo":[51,70],"cha":[51,70],"sa":[31,40],"cri":[2,3],"dn":[11,15],"dt":[11,15],"de":[11,15],"ini":[-200,-200],"rf":[7,10]}}]}'::jsonb, 'zone'),
('cav_servitude', 'Galère de Servitude', 200, '{"k":333333,"res":{"Oueille":300,"Viande Goûtue":36,"Morceau de chaîne asservissante":23,"Clé des entraves":18,"Baguette Rythmique":9,"Bois de pagaie usée":9,"Boulet lesté":9,"Manche de Fouet":9},"eq":[{"tpl":"i22214","s":{"vit":[401,500],"sa":[31,40],"pa":[2,2],"ini":[701,1000],"rn":[2,3],"rt":[2,3],"rf":[2,3],"re":[2,3],"ra":[2,3]}}]}'::jsonb, 'zone'),
('cav_misere', 'Désert de Misère', 200, '{"k":333333,"res":{"Oueille":300,"Besace de nourriture":75,"Viande Goûtue":36,"Capuche de Skentu":9,"Côtes de Désosseur":9,"Langue de Krèvladal":9,"Œil de Dawaj":9,"Terre Stérile":6},"eq":[{"tpl":"i18696","s":{"vit":[201,250],"sa":[31,40],"pui":[41,50],"rt":[7,10],"re":[4,7]}},{"tpl":"i22215","s":{"vit":[351,400],"fo":[61,80],"sa":[21,30],"cri":[4,5],"dn":[11,15],"dt":[11,15],"rt":[9,12],"ra":[2,3]}}]}'::jsonb, 'zone'),
('cav_guerre', 'Blessures de Guerre', 200, '{"k":333333,"res":{"Oueille":300,"Viande Goûtue":36,"Canine tranchante":9,"Linothorax":9,"Sang coagulé":9,"Étoffe sanglante":9,"Lame tranchante":6,"Tonneau de Sang de Scorbute":3},"eq":[{"tpl":"i30943","s":{"vit":[251,300],"ine":[36,66],"sa":[21,30],"cri":[2,3],"df":[9,12],"rt":[3,6],"rf":[3,6]}},{"tpl":"i30861","s":{"vit":[301,350],"ine":[66,99],"sa":[21,30],"cri":[3,6],"df":[9,12],"rn":[5,9],"rf":[9,12],"re":[-3,-3],"xe":[-11,-11]}}]}'::jsonb, 'zone'),
('wuk_encre', 'Royaume d''encre', 200, '{"k":333333,"res":{"Troisième morceau de parchemin oublié":36,"Viande Goûtue":36,"Papier comestible":18,"Mots pliés":12,"Carapace circonflexe d''Imorok":9,"Cédille d''Imetsu":9,"Guillemets d''Imiyama":9,"Poing-virgule d''Imushin":9},"eq":[{"tpl":"i24022","s":{"vit":[251,300],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[3,5],"pa":[1,1],"df":[9,12],"de":[9,12],"rt":[7,10],"ra":[7,10]}},{"tpl":"i24023","s":{"vit":[351,400],"ine":[51,70],"cha":[51,70],"sa":[21,30],"cri":[3,4],"df":[9,12],"de":[9,12],"rt":[7,10],"ra":[7,10]}},{"tpl":"i24024","s":{"vit":[401,500],"ine":[61,80],"cha":[61,80],"sa":[31,50],"cri":[2,3],"df":[11,15],"de":[11,15],"rt":[3,5],"ra":[3,5]}},{"tpl":"i30683","s":{"vit":[201,250],"ine":[51,70],"cha":[51,70],"sa":[31,40],"cri":[2,3],"rf":[6,8],"re":[6,8],"rt":[-3,-3],"ra":[-3,-3]}}]}'::jsonb, 'zone'),
('wuk_papier', 'Royaume de papier', 200, '{"k":333333,"res":{"Deuxième morceau de parchemin oublié":36,"Goutte d''encre indélébile":36,"Viande Goûtue":36,"Encre comestible":18,"Mots noircis":12,"Carapace circonflexe de Rokoram":9,"Cédille de Tsunam":9,"Guillemets de Mabram":9},"eq":[{"tpl":"i24037","s":{"vit":[401,450],"ine":[51,75],"sa":[31,40],"df":[15,18],"ini":[201,300],"rf":[5,7],"ra":[5,7]}},{"tpl":"i30682","s":{"vit":[201,250],"fo":[51,70],"age":[51,70],"sa":[31,40],"cri":[-3,-3],"rt":[6,8],"ra":[6,8],"rf":[-3,-3],"re":[-3,-3]}},{"tpl":"i24028","s":{"vit":[401,500],"fo":[61,80],"age":[61,80],"sa":[31,50],"cri":[-3,-3],"dt":[11,15],"da":[11,15],"rf":[3,5],"re":[3,5]}},{"tpl":"i24027","s":{"vit":[351,400],"fo":[51,70],"age":[51,70],"sa":[21,30],"cri":[-4,-4],"dt":[9,12],"da":[9,12],"rf":[7,10],"re":[7,10]}}]}'::jsonb, 'zone'),
('pos_port', 'Port des Ravageurs', 200, '{"k":333333,"res":{"Oueille":300,"Pollenectar":300,"Âme de Possédé":300,"Signe des Possédés":45,"Viande Goûtue":36,"Sang de Possédé":18,"Diadème de Belilith":9,"Groin de Porkzebuth":9},"eq":[{"tpl":"i30862","s":{"vit":[351,400],"ine":[36,66],"sa":[21,30],"cri":[3,6],"df":[13,18],"rf":[9,12],"ra":[5,9],"re":[-3,-3],"xe":[-11,-11]}},{"tpl":"i25216","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[31,40],"pui":[11,15],"cri":[3,4],"dn":[11,15],"dt":[11,15],"da":[11,15],"rt":[11,15]}},{"tpl":"i30863","s":{"vit":[351,400],"ine":[36,66],"sa":[21,30],"cri":[2,3],"pa":[1,1],"df":[13,18],"rt":[5,9],"rf":[5,9],"re":[-3,-3],"xe":[-11,-11]}},{"tpl":"i25218","s":{"vit":[201,250],"fo":[41,60],"sa":[16,20],"dn":[6,8],"dt":[6,8],"ini":[201,300],"rt":[5,7]}}]}'::jsonb, 'zone'),
('pos_cauchemar', 'Cauchemar des Ravageurs', 200, '{"k":333333,"res":{"Toile du cauchemar":300,"Viande Goûtue":36,"Sang de démon":11,"Corne de Typhomet":9,"Jouet brigandin":9,"Langue de Diabélial":9,"Mâchoire de Brutasmodan":9,"Tentacule de Démoloch":9},"eq":[{"tpl":"i30858","s":{"vit":[201,250],"fo":[61,80],"sa":[31,40],"so":[11,15],"rt":[7,10],"ra":[3,5]}},{"tpl":"i26011","s":{"vit":[301,350],"ine":[31,40],"cha":[31,40],"sa":[26,35],"pui":[16,20],"df":[14,18],"de":[14,18],"so":[9,12],"ini":[201,300],"re":[7,10],"dcri":[-15,-15]}},{"tpl":"i26009","s":{"vit":[301,350],"cha":[41,60],"sa":[21,30],"pui":[21,30],"cri":[4,5],"de":[11,15],"so":[11,15],"rn":[5,7],"re":[5,7],"dcri":[9,12]}},{"tpl":"i26019","s":{"vit":[301,350],"fo":[26,35],"ine":[26,35],"cha":[51,70],"age":[51,70],"sa":[21,30],"pa":[1,1],"dt":[4,6],"df":[4,6],"de":[9,12],"da":[9,12],"rt":[6,8],"rf":[6,8],"re":[-4,-4],"ra":[-4,-4]}}]}'::jsonb, 'zone'),
('eca_crocuzko', 'Crocuzko', 200, '{"k":333333,"res":{"Viande d''Alashasss":75,"Viande de Caïguille":75,"Viande de Cronnibal":75,"Viande de Voapah":75,"Pierre de lune inaltérée":72,"Parchemin mordillé":36,"Viande Goûtue":36,"Bandeau de Voapah":9},"eq":[{"tpl":"i21225","s":{"vit":[201,250],"pui":[41,50],"cri":[4,7],"ini":[601,800],"re":[11,15]}},{"tpl":"i21227","s":{"vit":[251,300],"sa":[21,40],"pui":[51,70],"pa":[1,1],"dn":[16,20],"da":[16,20],"pp":[16,20],"ini":[201,250]}},{"tpl":"i21228","s":{"vit":[201,250],"sa":[21,30],"pui":[31,50],"dt":[11,15],"pp":[11,15],"ini":[101,150]}},{"tpl":"i21224","s":{"vit":[301,350],"ine":[61,80],"sa":[21,30],"cri":[3,4],"df":[16,20],"rt":[8,12],"re":[8,12]}}]}'::jsonb, 'zone'),
('vul_etraktopel', 'Forêt d''Etraktopel', 24, '{"k":40000,"res":{"Langue Juvénile":300,"Oueille":300,"Viande Frelatée":153,"Sang Boueux":60,"Sang Humide":60,"Sang Incandescent":60,"Sang Insipide":60,"Sang Sec":60}}'::jsonb, 'zone'),
('vul_pillar', 'Cratère Pillar', 24, '{"k":40000,"res":{"Langue Juvénile":250,"Oueille":250,"Viande Frelatée":128,"Kœur Juvénile":50,"Sang Boueux":50,"Sang Humide":50,"Sang Incandescent":50,"Sang Insipide":50}}'::jsonb, 'zone'),
('vul_espartiate', 'Forêt d''Espartiate', 54, '{"k":90000,"res":{"Langue Novice":300,"Oueille":300,"Viande Avariée":117,"Sang Boueux":60,"Sang Humide":60,"Sang Incandescent":60,"Sang Insipide":60,"Sang Sec":60}}'::jsonb, 'zone'),
('vul_mopyle', 'Cratère Mopyle', 63, '{"k":105000,"res":{"Langue Novice":250,"Oueille":250,"Viande Avariée":98,"Kœur Novice":50,"Sang Boueux":50,"Sang Humide":50,"Sang Incandescent":50,"Sang Insipide":50}}'::jsonb, 'zone'),
('vul_strates', 'Forêt des Strates Igraphies', 104, '{"k":173333,"res":{"Langue Mature":300,"Oueille":300,"Viande Saignante":81,"Sérum de Krokille":75,"Sang Boueux":60,"Sang Humide":60,"Sang Incandescent":60,"Sang Insipide":60}}'::jsonb, 'zone'),
('vul_nehr', 'Cratère Nehr', 113, '{"k":188333,"res":{"Langue Mature":250,"Oueille":250,"Viande Saignante":68,"Sérum de Krokille":63,"Kœur Mature":50,"Sang Boueux":50,"Sang Humide":50,"Sang Incandescent":50}}'::jsonb, 'zone'),
('vul_ponefarr', 'Forêt de Ponefarr', 155, '{"k":258333,"res":{"Oueille":300,"Langue Vénérable":250,"Sérum de Krokille":63,"Sang Boueux":50,"Sang Humide":50,"Sang Incandescent":50,"Sang Insipide":50,"Sang Sec":50}}'::jsonb, 'zone'),
('vul_monseleya', 'Cratère Monseleya', 163, '{"k":271667,"res":{"Langue Vénérable":250,"Oueille":250,"Sérum de Krokille":63,"Kœur Vénérable":50,"Sang Boueux":50,"Sang Humide":50,"Sang Incandescent":50,"Sang Insipide":50}}'::jsonb, 'zone'),
('akademie_gobs', 'Akadémie des Gobs', 50, '{"k":125000,"res":{"Oueille":450,"Pollenectar":450,"Viande Minérale":230,"Bonnet de Gobaliste":46,"Longue-vue de Gob-Trotteur":46,"Os rongé de Gobichon":46,"Pic de Lance de Gobet":46,"Tambour de Gobaladée":46},"eq":[{"tpl":"i1436","s":{"vit":[-50,-50],"cha":[31,40],"age":[21,30],"sa":[16,20]}},{"tpl":"i1132","s":{"vit":[61,90],"ine":[-90,-90],"sa":[16,20],"pa":[1,1]}},{"tpl":"i9655","s":{"vit":[31,40],"cha":[21,30],"sa":[11,15],"do":[4,6]}},{"tpl":"i1360","s":{"vit":[-60,-60],"ine":[31,40],"cha":[21,30],"df":[2,3],"de":[5,7],"so":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('antichambre_gloursons', 'Antichambre des Gloursons', 190, '{"k":475000,"res":{"Cuillère":450,"Graine Pops":450,"Oueille":450,"Pollenectar":450,"Pétunia Fron":450,"Miel de Boulglours":75,"Viande Noire":68,"Le rube":54},"eq":[{"tpl":"i12969","s":{"vit":[301,400],"sa":[31,50],"cri":[3,4],"ini":[301,400]}},{"tpl":"i32230","s":{"vit":[251,300],"fo":[41,50],"ine":[41,50],"cha":[41,50],"sa":[21,30],"cri":[2,3],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"pp":[7,10],"rt":[1,2],"rf":[3,5],"re":[5,8]}},{"tpl":"i11737","s":{"vit":[301,400],"sa":[31,50],"cri":[3,4],"ini":[301,400]}},{"tpl":"i11756","s":{"vit":[251,350],"cha":[31,40],"age":[31,40],"sa":[31,40],"cri":[4,5],"dn":[7,10],"de":[7,10],"da":[7,10],"pp":[16,25],"xn":[7,10],"xa":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('antre_blop_multicolore', 'Antre du Blop Multicolore Royal', 120, '{"k":300000,"res":{"Oueille":450,"Pollenectar":450,"Viande Ladre":207,"Fleur de Blopignon":104,"Racine de Tronkoblop":104,"Blop mort":34,"Sachet de Graisse Gélatineuse":5},"dj":1}'::jsonb, 'dj'),
('antre_crocabulia', 'Antre de Crocabulia', 120, '{"k":300000,"res":{"Viande Saignante":140,"Écaille de Draguaindrop":90,"Corne de Dragacé":28,"Corne de Dragmatique":28,"Peau de Dragnarok":28,"Peau de Draguaindrop":28,"Peau de Dragueuse":28,"Croc de Dragoeuf Protecteur":24},"eq":[{"tpl":"i8103","s":{"vit":[71,90],"fo":[21,35],"ine":[21,35],"cha":[21,35],"age":[21,35],"sa":[21,40],"pui":[11,20],"do":[5,7]}},{"tpl":"i3650","s":{"fo":[21,40],"age":[21,40],"do":[6,10],"pp":[11,15],"rf":[6,10],"ra":[6,10]}},{"tpl":"i8295","s":{"vit":[151,200],"fo":[31,40],"sa":[11,20],"pui":[6,10],"cri":[4,5],"dt":[4,6],"pp":[11,15],"re":[3,4],"xf":[4,5]}},{"tpl":"i8293","s":{"vit":[91,130],"ine":[26,40],"cha":[26,40],"sa":[11,15],"pui":[11,15],"cri":[3,4],"df":[2,3],"de":[2,3],"ini":[101,200],"rn":[4,6]}}],"dj":1}'::jsonb, 'dj'),
('antre_dragon_cochon', 'Antre du Dragon Cochon', 100, '{"k":250000,"res":{"Oueille":180,"Pollenectar":180,"Viande Exsudative":164,"Cuir de Porsalu":34,"Fragment du Gorgouille":32,"Peau de Cochon de Farle":32,"Peau de Don Dorgan":32,"Peau de Don Duss Ang":32},"dj":1}'::jsonb, 'dj'),
('antre_korriandre', 'Antre du Korriandre', 180, '{"k":450000,"res":{"Graine de Ricin":450,"Lichen pétrifié":450,"Ortyde":450,"Oueille":450,"Pollenectar":450,"Sève de Mycos":113,"Cœur de Dramanite":90,"Viande Gâtée":77},"eq":[{"tpl":"i11746","s":{"vit":[201,250],"age":[21,30],"sa":[31,50],"pui":[21,30],"cri":[3,4],"dn":[7,10],"dt":[7,10],"da":[8,12],"pp":[16,25],"rf":[5,7],"re":[5,7]}},{"tpl":"i15502","s":{"vit":[201,250],"ine":[41,60],"sa":[31,40],"df":[11,15],"pp":[11,15],"re":[7,10],"ra":[7,10]}},{"tpl":"i11758","s":{"vit":[251,300],"ine":[31,50],"age":[31,50],"sa":[31,50],"dn":[7,10],"df":[8,12],"da":[7,10],"so":[7,10],"xt":[7,10],"xe":[7,10]}},{"tpl":"i11749","s":{"vit":[201,250],"age":[41,60],"sa":[31,40],"cri":[2,3],"dn":[8,12],"da":[8,12],"pp":[16,25],"ini":[201,300],"rn":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('antre_reine_nyee', 'Antre de la Reine Nyée', 90, '{"k":225000,"res":{"Oueille":450,"Pollenectar":450,"Viande Rassie":176,"Chélicères d''Arapex":34,"Dent de Gargantûl":34,"Fil de Néfileuse":34,"Laine de Dardalaine":34,"Œil de Saltik":34},"eq":[{"tpl":"i16176","s":{"vit":[41,60],"fo":[21,30],"age":[21,30],"pa":[1,1],"dt":[2,2],"da":[2,2],"ra":[2,3]}},{"tpl":"i16177","s":{"vit":[61,80],"fo":[21,30],"age":[21,30],"sa":[16,20],"cri":[2,3],"dt":[4,5],"da":[4,5],"pp":[11,15],"re":[4,5]}},{"tpl":"i16178","s":{"vit":[61,80],"fo":[21,30],"age":[21,30],"sa":[21,25],"dt":[4,5],"da":[4,5],"re":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('aquadome_merkator', 'Aquadôme de Merkator', 200, '{"k":500000,"res":{"Métal abyssal":113,"Spécimen de Krabouilleur":90,"Pile Steamer":54,"Viande Goûtue":54,"Boîte à Outils des Mercemers":22,"Barbe du Cyclophandre":11,"Carapace de Krabouilleur":11,"Cuir d''Eskoglyphe":11},"eq":[{"tpl":"i14882","s":{"vit":[201,250],"fo":[21,30],"cha":[21,30],"sa":[16,25],"pui":[11,15],"cri":[4,5],"dn":[9,12],"dt":[9,12],"de":[9,12],"rf":[5,7],"ra":[5,7]}},{"tpl":"i14885","s":{"vit":[301,350],"ine":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"df":[9,12],"da":[9,12],"so":[7,10],"rn":[7,10],"ra":[7,10],"dcri":[-15,-11]}},{"tpl":"i14886","s":{"vit":[301,350],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"de":[7,10],"da":[7,10],"pp":[11,15],"ini":[301,500],"rn":[5,7],"rt":[5,7],"rf":[5,7],"xf":[11,15]}},{"tpl":"i14884","s":{"vit":[201,250],"ine":[31,40],"age":[31,40],"sa":[31,40],"pa":[1,1],"df":[9,12],"da":[9,12],"so":[9,12],"pp":[16,25],"rf":[7,10],"xn":[11,15],"dcri":[-20,-16]}}],"dj":1}'::jsonb, 'dj'),
('arbre_moon', 'Arbre de Moon', 100, '{"k":250000,"res":{"Oueille":450,"Pollenectar":450,"Viande Exsudative":162,"Boules de Trukikol":90,"Couronne de Fourbasse":90,"Engrais de Moon":81,"Feuille de Fourbasse":32,"Fleur de Gloutovore":32},"eq":[{"tpl":"i6745","s":{"vit":[91,120],"fo":[26,35],"cha":[36,45],"sa":[21,30],"cri":[3,4],"dn":[4,6],"dt":[4,6],"de":[4,6],"ra":[5,7]}},{"tpl":"i33591","s":{"vit":[101,120],"sa":[16,20],"pui":[16,20],"pp":[7,10]}},{"tpl":"i6763","s":{"vit":[91,120],"ine":[26,35],"age":[36,45],"sa":[21,30],"df":[4,6],"da":[4,6],"rt":[5,7]}},{"tpl":"i33589","s":{"vit":[101,120],"sa":[21,30],"pui":[21,30],"do":[4,6],"pp":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('arbre_mort', 'Arbre de Mort', 200, '{"k":500000,"res":{"Oueille":450,"Viande Goûtue":54,"Sève Putride":43,"Langue de Pistilangue":11,"Patte de Nheur''Gueule":11,"Peau pourrie de Dolid":11,"Pétale de Gangredogue":11,"Tentacule de Tentaclaque":11},"eq":[{"tpl":"i22213","s":{"vit":[351,400],"fo":[51,70],"cha":[51,70],"sa":[31,40],"cri":[2,3],"dn":[11,15],"dt":[11,15],"de":[11,15],"ini":[-200,-200],"rf":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('atelier_tanukoui', 'Atelier du Tanukouï San', 130, '{"k":325000,"res":{"Oueille":450,"Pollenectar":450,"Viande Persillée":131,"Viscères de Tanuki":54,"Baguette de Tétonuki":26,"Lunettes de Parashukouï":26,"Masque de Shinibaru":26,"Poing rocheux d''Ishigro Pake":26},"dj":1}'::jsonb, 'dj'),
('aurore_pourpre', 'Bataille de l''Aurore Pourpre', 200, '{"k":500000,"res":{"Toile du cauchemar":360,"Viande Goûtue":54,"Sang de démon":16,"Corne de Typhomet":11,"Jouet brigandin":11,"Langue de Diabélial":11,"Mâchoire de Brutasmodan":11,"Tentacule de Démoloch":11},"eq":[{"tpl":"i30858","s":{"vit":[201,250],"fo":[61,80],"sa":[31,40],"so":[11,15],"rt":[7,10],"ra":[3,5]}},{"tpl":"i26011","s":{"vit":[301,350],"ine":[31,40],"cha":[31,40],"sa":[26,35],"pui":[16,20],"df":[14,18],"de":[14,18],"so":[9,12],"ini":[201,300],"re":[7,10],"dcri":[-15,-15]}},{"tpl":"i26009","s":{"vit":[301,350],"cha":[41,60],"sa":[21,30],"pui":[21,30],"cri":[4,5],"de":[11,15],"so":[11,15],"rn":[5,7],"re":[5,7],"dcri":[9,12]}},{"tpl":"i26019","s":{"vit":[301,350],"fo":[26,35],"ine":[26,35],"cha":[51,70],"age":[51,70],"sa":[21,30],"pa":[1,1],"dt":[4,6],"df":[4,6],"de":[9,12],"da":[9,12],"rt":[6,8],"rf":[6,8],"re":[-4,-4],"ra":[-4,-4]}}],"dj":1}'::jsonb, 'dj'),
('autel_dechireuse', 'Autel de la Déchireuse', 200, '{"k":500000,"res":{"Lait nourricier":54,"Lymphe régénérante":54,"Sang brûlant":54,"Viande Goûtue":54,"Shampoing Rhoarim":23,"Bandeau d''Ébourifauve":18,"Daguosseuse de Domptueuse":18,"Os Divinatoire de Voracle":18},"eq":[{"tpl":"i31761","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[4,6],"pa":[1,1],"dt":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"ini":[201,300],"rf":[11,15],"dcri":[11,15]}},{"tpl":"i31763","s":{"vit":[351,400],"fo":[41,60],"age":[41,60],"sa":[31,40],"cri":[2,3],"dt":[7,10],"da":[7,10],"pp":[16,20],"ini":[201,300],"rn":[4,7],"rf":[4,7],"re":[4,7],"dcri":[11,15]}},{"tpl":"i31760","s":{"vit":[351,400],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[2,3],"df":[7,10],"de":[7,10],"pp":[16,20],"ini":[201,300],"rn":[4,7],"rt":[4,7],"ra":[4,7],"dcri":[11,15]}},{"tpl":"i31790","s":{"vit":[351,400],"age":[61,80],"sa":[31,40],"cri":[3,5],"da":[16,20],"so":[11,15],"pp":[11,15],"ini":[401,500],"rt":[7,10],"ra":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('bambusaie_damadrya', 'Bambusaie de Damadrya', 110, '{"k":275000,"res":{"Oueille":450,"Pollenectar":450,"Racine sauvage":189,"Viande Séchée":153,"Mildiou de Pandala":35,"Langue de Grenufar":31,"Pistil de Floristile":31,"Pollen de Bulbiflore":31},"eq":[{"tpl":"i7172","s":{"vit":[101,130],"ine":[21,35],"sa":[21,35]}},{"tpl":"i7215","s":{"vit":[101,150],"cha":[31,40],"sa":[21,35],"pp":[11,15],"rt":[4,5],"rf":[4,5],"re":[4,5],"ra":[4,5]}},{"tpl":"i6998","s":{"vit":[61,100],"ine":[21,35],"so":[4,6],"pp":[11,15],"rt":[6,10],"rf":[6,10],"xt":[8,12],"xf":[8,12]}},{"tpl":"i23260","s":{"vit":[51,100],"fo":[21,30],"ine":[21,30],"cha":[21,30],"age":[21,30],"cri":[4,5],"dn":[2,3],"dt":[2,3],"df":[2,3],"de":[2,3],"da":[2,3],"xn":[4,5],"xt":[4,5],"xf":[4,5],"xe":[4,5],"xa":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('bastion_marteaux', 'Bastion des Marteaux-Aigris', 190, '{"k":475000,"res":{"Déguisement Blindur":90,"Déguisement Boufronde":90,"Déguisement Marthos":90,"Déguisement Serpyn":90,"Viande Noire":68,"Armure de Blindur":14,"Bave de Marthos":14,"Fronde de Boufronde":14},"eq":[{"tpl":"i27542","s":{"vit":[301,350],"cha":[61,80],"sa":[21,30],"cri":[3,5],"de":[9,12],"pp":[16,20],"re":[5,7],"ra":[5,7],"dcri":[7,10]}},{"tpl":"i27526","s":{"vit":[201,250],"fo":[21,30],"ine":[31,40],"age":[41,50],"sa":[16,20],"dn":[4,6],"dt":[4,6],"df":[5,8],"da":[7,10],"so":[7,10],"pp":[7,10],"ini":[-200,-200],"rt":[3,5],"rf":[3,5]}},{"tpl":"i27525","s":{"vit":[301,350],"fo":[41,60],"ine":[51,70],"age":[41,50],"sa":[21,30],"dn":[7,10],"dt":[7,10],"df":[9,12],"da":[5,8],"so":[11,14],"pp":[11,15],"ini":[-300,-300],"rf":[4,7],"ra":[4,7]}},{"tpl":"i27541","s":{"vit":[251,300],"cha":[51,70],"sa":[31,40],"cri":[3,5],"de":[9,12],"pp":[7,10],"ini":[301,400],"re":[6,8],"ra":[6,8],"dcri":[6,8]}}],"dj":1}'::jsonb, 'dj'),
('bateau_chouque', 'Bateau du Chouque', 90, '{"k":225000,"res":{"Pollenectar":450,"Viande Rassie":176,"Crâne de pirate":54,"Mâchoire de pirate":43,"Bandeau de Nakunbra":35,"Boulet de Canondorf":35,"Caleçon Mignon du Pirate":35,"Canif Rouillé":35},"eq":[{"tpl":"i7211","s":{"vit":[91,130],"ine":[41,60],"sa":[36,45],"pui":[16,20],"do":[5,7]}},{"tpl":"i7194","s":{"vit":[81,120],"ine":[41,50],"age":[41,50],"dn":[5,7],"df":[5,7],"ini":[201,250],"rn":[2,3],"rf":[2,3]}},{"tpl":"i7002","s":{"vit":[71,90],"sa":[21,25],"do":[4,5],"so":[11,15],"pp":[11,15],"rn":[3,4],"rf":[3,4]}},{"tpl":"i6460","s":{"vit":[41,60],"cha":[41,50],"sa":[16,20],"pui":[16,20],"do":[5,7],"pp":[11,15],"re":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('belvedere_ilyzaelle', 'Belvédère d''Ilyzaelle', 200, '{"k":500000,"res":{"Cendres de Brûlâme":450,"Douleur de Brûlâme":450,"Pollenectar":450,"Viande Goûtue":54,"Fragment d''Ectorche":18,"Sacrifice de Brûlâmes":16,"Cendres de Chause":11,"Pince de Crâme":11},"eq":[{"tpl":"i19252","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,50],"cri":[3,4],"df":[11,15],"de":[11,15],"so":[9,12],"ra":[7,10]}},{"tpl":"i19241","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[31,40],"cri":[4,5],"pa":[1,1],"dn":[9,12],"dt":[9,12],"da":[9,12],"pp":[11,15],"rf":[7,10]}},{"tpl":"i19243","s":{"vit":[301,350],"fo":[31,50],"age":[31,50],"sa":[21,30],"cri":[3,4],"dn":[9,12],"dt":[9,12],"da":[9,12],"rn":[5,7],"rf":[5,7],"re":[5,7]}},{"tpl":"i19250","s":{"vit":[351,400],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[2,2],"df":[11,15],"de":[11,15],"pp":[11,15],"rn":[7,10],"rt":[7,10],"dcri":[9,12]}}],"dj":1}'::jsonb, 'dj'),
('biblio_corbac', 'Bibliothèque du Maître Corbac', 110, '{"k":275000,"res":{"Pierre de Topaze":153,"Viande Séchée":153,"Oueille":64,"Pollenectar":64,"Plume de Buveur":44,"Plume de Corbac Apprivoisé":44,"Patte de Corbac":22,"Poil de Capsaaloocke":22},"eq":[{"tpl":"i6449","s":{"vit":[101,150],"ine":[31,40],"age":[31,40],"sa":[16,20],"cri":[2,3],"ra":[4,7]}},{"tpl":"i2544","s":{"vit":[101,150],"ine":[41,50],"age":[41,50],"sa":[16,20],"cri":[1,2],"df":[4,6],"da":[4,6],"rn":[2,3],"ra":[2,3]}},{"tpl":"i2545","s":{"vit":[81,120],"ine":[31,40],"age":[31,40],"sa":[11,15],"df":[4,6],"da":[4,6]}}],"dj":1}'::jsonb, 'dj'),
('boyau_pere_ver', 'Boyau du Père Ver', 170, '{"k":425000,"res":{"Oueille":450,"Pollenectar":450,"Entrailles de Ver des sables":360,"Reste de masticroc":90,"Reste de morsquale":90,"Viande Maigre":86,"Dent de Cycloporth":17,"Langue de Morsquale":17},"eq":[{"tpl":"i6988","s":{"vit":[301,400],"cha":[41,60],"sa":[41,50]}},{"tpl":"i18585","s":{"vit":[151,200],"cha":[31,40],"age":[31,40],"sa":[21,30],"cri":[2,3],"de":[5,7],"da":[5,7],"so":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i18588","s":{"vit":[151,200],"fo":[41,60],"sa":[31,40],"cri":[2,2],"dn":[5,7],"dt":[5,7],"pp":[11,15],"re":[5,7],"ra":[5,7]}},{"tpl":"i18584","s":{"vit":[251,300],"cha":[51,70],"age":[51,70],"sa":[16,25],"cri":[3,4],"de":[7,10],"da":[7,10],"pp":[11,15],"rf":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('brasserie_dazak', 'Brasserie du roi Dazak', 200, '{"k":500000,"res":{"Viande Goûtue":54,"Armure de Tanklume":11,"Dent de Vatenbière":11,"Fronde de Boufbos":11,"Jambière de Kasrok":11,"Poils de barbe de Barbélier":11,"Chope de Bière":9},"eq":[{"tpl":"i8098","s":{"vit":[401,450],"cha":[61,80],"sa":[31,40],"de":[11,15],"pp":[16,25],"rt":[5,10],"rf":[4,7]}},{"tpl":"i19978","s":{"vit":[301,400],"fo":[51,70],"cha":[51,70],"sa":[31,40],"dn":[7,10],"dt":[7,10],"de":[7,10],"pp":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i19982","s":{"vit":[301,400],"age":[81,100],"sa":[31,50],"cri":[4,5],"da":[16,20],"pp":[11,15],"ra":[7,10]}},{"tpl":"i19986","s":{"vit":[301,350],"sa":[31,40],"pui":[51,70],"cri":[4,5],"dn":[11,15],"dt":[11,15],"df":[11,15],"de":[11,15],"da":[11,15],"rn":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('breuil_venerable', 'Breuil du Vénérable', 200, '{"k":500000,"res":{"Lait nourricier":54,"Lymphe régénérante":54,"Sang brûlant":54,"Viande Goûtue":54,"Dent de zarbivore":23,"Sachet de Feuilles de salace":14,"Squame du Graogarm":14,"Groin de Brutapir":11},"eq":[{"tpl":"i31766","s":{"vit":[301,350],"fo":[31,50],"ine":[31,50],"cha":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"do":[7,10],"rt":[3,4],"rf":[3,4]}},{"tpl":"i31764","s":{"vit":[251,300],"fo":[31,40],"ine":[31,40],"cha":[31,40],"age":[31,40],"sa":[31,40],"cri":[2,3],"do":[7,10],"rn":[3,4],"rt":[3,4],"rf":[3,4]}},{"tpl":"i31860","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[-30,-30],"cri":[5,8],"dn":[11,15],"dt":[11,15],"de":[11,15],"so":[-25,-25],"pp":[21,30],"ini":[-300,-300],"rt":[4,7],"re":[9,12]}},{"tpl":"i31785","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[2,3],"dn":[11,15],"dt":[11,15],"de":[11,15],"da":[11,15],"pp":[11,15],"rt":[5,7],"re":[5,7],"ra":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('cache_kankreblath', 'Cache de Kankreblath', 40, '{"k":100000,"res":{"Caissette de Babioles":450,"Antennes de Vilinsekt":230,"Viande Minérale":230,"Rondelle de Bois":38,"Kamiam":27,"Sachet de Cerises":5},"dj":1}'::jsonb, 'dj'),
('cale_arche_otomai', 'Cale de l''Arche d''Otomaï', 70, '{"k":175000,"res":{"Viande Avariée":197,"Chicot du Flib":66,"Foulard du Sparo":66,"Maillot de corps de Barbroussa":65,"Poudre explosive":33,"Barbe inexistante du Barbroussa":11,"Humérus du Sparo":11,"Touffe rousse du Flib":11},"eq":[{"tpl":"i8612","s":{"vit":[31,40],"age":[31,40],"sa":[11,15],"cri":[2,2]}}],"dj":1}'::jsonb, 'dj'),
('camp_razof', 'Camp du Comte Razof', 190, '{"k":475000,"res":{"Oueille":450,"Pollenectar":450,"Fléchette Tranquillisante":360,"Sac de Plumes":90,"Viande Noire":68,"Contrat de Travail":22,"Déguisement de Crâmbo":22,"Bave de Brokouillon":14},"eq":[{"tpl":"i18702","s":{"vit":[151,200],"xn":[21,30],"xt":[21,30],"xf":[21,30],"xe":[21,30],"xa":[21,30]}},{"tpl":"i13634","s":{"vit":[301,350],"fo":[31,50],"cha":[31,50],"sa":[31,50],"cri":[2,3],"dn":[8,12],"dt":[8,12],"de":[8,12],"ini":[301,400],"rf":[7,10]}},{"tpl":"i33605","s":{"vit":[201,250],"cha":[41,50],"age":[41,50],"sa":[31,40],"de":[5,8],"da":[5,8],"pp":[11,15],"rt":[7,10]}},{"tpl":"i33606","s":{"vit":[251,300],"cha":[51,70],"age":[51,70],"sa":[31,40],"de":[7,10],"da":[7,10],"pp":[11,15],"re":[7,10],"ra":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('canopee_kimbo', 'Canopée du Kimbo', 160, '{"k":400000,"res":{"Oueille":450,"Pollenectar":450,"Viande Fraîche":98,"Rembourrage de Meupette":21,"Cloaque du Poolay":20,"Croupion du Bitouf aérien":20,"Bave du Kaskargo":19,"Souche de l''Abrakleur clair":19},"eq":[{"tpl":"i8824","s":{"vit":[151,200],"fo":[31,50],"sa":[26,40],"do":[3,4],"rn":[6,10],"rf":[6,10],"ra":[6,10],"xt":[6,10],"xe":[6,10]}},{"tpl":"i8704","s":{"ine":[41,60],"age":[41,60],"sa":[31,50],"do":[6,10],"pp":[11,15],"rf":[8,12],"ra":[8,12],"xf":[8,12],"xa":[8,12]}},{"tpl":"i8868","s":{"vit":[101,150],"fo":[26,40],"ine":[26,40],"sa":[21,30],"pp":[6,10],"rt":[6,10],"rf":[6,10]}},{"tpl":"i8924","s":{"vit":[151,200],"age":[31,40],"sa":[31,40],"cri":[4,5],"do":[6,10],"pp":[11,20],"xf":[6,10],"xa":[6,10]}}],"dj":1}'::jsonb, 'dj'),
('cave_toxoliath', 'Cave du Toxoliath', 180, '{"k":450000,"res":{"Échantillon d''Éperfide saine":90,"Échantillon de Lucrane sain":90,"Échantillon de Puceronde saine":90,"Échantillon de Scoliopode sain":90,"Jus Toxique de Nécrotique":86,"Viande Gâtée":77,"Chitine de Nécrotique":18,"Aile de Puceronde":15},"eq":[{"tpl":"i15501","s":{"vit":[201,250],"fo":[31,40],"age":[31,40],"sa":[31,50],"cri":[3,4],"dn":[11,15],"dt":[11,15],"da":[11,15],"rf":[7,10]}},{"tpl":"i15500","s":{"vit":[201,250],"fo":[31,40],"age":[31,40],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"da":[11,15]}},{"tpl":"i15499","s":{"vit":[201,250],"fo":[31,40],"age":[31,40],"sa":[31,40],"pa":[1,1],"dn":[11,15],"dt":[11,15],"da":[11,15],"pp":[11,15],"re":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('caverne_el_piko', 'Caverne d''El Piko', 130, '{"k":325000,"res":{"Oueille":450,"Pollenectar":450,"Viande Persillée":131,"Fleur de Cactiflore":26,"Maraca de Lévito":26,"Moustaches de Cactoblongo":26,"Parchemin de Cactana":26,"String de Pampactus":26},"eq":[{"tpl":"i18437","s":{"vit":[81,120],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[4,5],"df":[7,10],"de":[7,10],"rf":[7,10]}},{"tpl":"i18431","s":{"vit":[101,150],"fo":[31,50],"age":[31,50],"sa":[21,30],"dn":[5,7],"dt":[5,7],"da":[5,7],"pp":[11,15],"re":[7,10],"dcri":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('caverne_koulosse', 'Caverne du Koulosse', 100, '{"k":250000,"res":{"Oueille":409,"Pollenectar":409,"Viande Exsudative":142,"Oreilles de Koalak Immature":41,"Viande Sanguinolente":35,"Fleur de Kaliptus":27,"Peau de Koalak Immature":18,"Pierre Médicinale":17},"eq":[{"tpl":"i7340","s":{"vit":[81,100],"so":[5,7],"rf":[4,5],"ra":[4,5]}},{"tpl":"i7118","s":{"vit":[41,60],"cha":[21,30],"age":[21,30],"do":[2,3],"pp":[7,10],"rf":[2,2],"ra":[2,2]}},{"tpl":"i7029","s":{"vit":[61,80],"age":[41,60],"so":[11,15],"pp":[11,15],"re":[4,5]}},{"tpl":"i8006","s":{"so":[1,2],"rn":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('cavernes_kolosso', 'Cavernes du Kolosso', 190, '{"k":475000,"res":{"Graine de Comique":450,"Muguet Ridon":450,"Objet bizarre":450,"Oueille":450,"Pollenectar":450,"Cervelle de Fleuro":75,"Corne de Blérice":75,"Cuir de Wolvero":75},"eq":[{"tpl":"i13636","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[21,30],"pa":[1,1],"dn":[16,25],"dt":[16,25],"da":[16,25],"pp":[11,15],"xe":[11,15],"dcri":[-30,-21]}},{"tpl":"i13644","s":{"vit":[251,300],"cha":[61,80],"age":[61,80],"sa":[31,40],"cri":[4,6],"de":[11,15],"da":[11,15],"pp":[11,15],"ini":[-400,-301],"xf":[11,15]}},{"tpl":"i13659","s":{"vit":[251,300],"fo":[41,60],"sa":[31,40],"pa":[1,1],"dn":[8,12],"dt":[8,12],"pp":[7,10],"re":[6,8],"ra":[6,8],"xt":[8,12]}},{"tpl":"i13115","s":{"vit":[251,300],"fo":[51,70],"sa":[21,30],"dn":[11,15],"dt":[11,15],"rf":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('chambre_malefices', 'Chambre des maléfices', 200, '{"k":500000,"res":{"Oueille":450,"Pollenectar":450,"Viande Goûtue":54,"Casque de Statulipe":11,"Liane de Soldalia":11,"Mousse de Caméliache":11,"Poing de Coquelicogne":11,"Serpe perdue":11},"eq":[{"tpl":"i30860","s":{"vit":[351,400],"fo":[51,70],"sa":[41,50],"cri":[3,5],"dn":[11,15],"dt":[11,15],"so":[16,20],"rn":[5,7],"rt":[3,5],"ra":[3,5]}},{"tpl":"i27545","s":{"vit":[451,500],"sa":[41,50],"pui":[61,80],"cri":[-10,-10],"dn":[-200,-200],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"re":[5,7],"ra":[5,7]}},{"tpl":"i27548","s":{"vit":[201,250],"sa":[36,45],"pui":[21,30],"re":[3,5],"ra":[3,5]}},{"tpl":"i27547","s":{"vit":[251,300],"sa":[21,30],"pui":[41,60],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"ini":[401,500],"rn":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('chambre_tal_kasha', 'Chambre de Tal Kasha', 200, '{"k":500000,"res":{"Bandelettes Maudites":360,"Bandelette de Bandleth":90,"Bandelette de momie en embuscade":90,"Viande Goûtue":54,"Fragment de Chakanoubis":18,"Sacrifice de Maudits":16,"Dent de Bandleth":11,"Grenat de Momistik":11},"eq":[{"tpl":"i18595","s":{"vit":[251,300],"fo":[31,40],"ine":[31,40],"sa":[21,30],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[7,10],"pp":[11,15],"rn":[5,7],"rf":[5,7]}},{"tpl":"i18601","s":{"vit":[301,350],"ine":[51,70],"cha":[51,70],"sa":[31,40],"cri":[-10,-10],"df":[16,20],"de":[16,20],"so":[11,15],"pp":[11,15],"ra":[7,10]}},{"tpl":"i18439","s":{"vit":[301,350],"fo":[41,50],"ine":[41,50],"cha":[41,50],"age":[41,50],"sa":[21,30],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10]}},{"tpl":"i18597","s":{"vit":[401,500],"fo":[61,80],"sa":[21,30],"cri":[3,4],"dn":[16,20],"dt":[16,20],"pp":[11,15],"rf":[7,10],"ra":[7,10],"dcri":[-30,-30]}}],"dj":1}'::jsonb, 'dj'),
('chapiteau_riktus', 'Chapiteau des Magik Riktus', 90, '{"k":225000,"res":{"Oueille":450,"Pollenectar":450,"Document des Magik Riktus signé":360,"Viande Rassie":176,"Poussière magik":90,"Bandelettes":35,"Bombe de Graboule":35,"Bourgeon de Pirolienne":35},"eq":[{"tpl":"i18662","s":{"vit":[81,100],"ine":[31,40],"sa":[11,15],"cri":[3,4],"so":[7,10],"rf":[7,10]}},{"tpl":"i33579","s":{"vit":[31,40],"sa":[11,15],"cri":[4,6],"rn":[3,4],"dcri":[11,15]}},{"tpl":"i7257","s":{"vit":[56,75],"ine":[41,50],"cri":[3,4],"rt":[4,5],"rf":[4,5]}},{"tpl":"i2639","s":{"vit":[71,100],"fo":[41,50],"age":[41,50],"cri":[4,5],"do":[4,5],"pp":[4,5],"ini":[351,400]}}],"dj":1}'::jsonb, 'dj'),
('chateau_ensable', 'Château Ensablé', 20, '{"k":50000,"res":{"Oueille":450,"Pollenectar":450,"Viande Faisandée":248,"Conque Marine":50,"Crème à bronzer":50,"Fluide Glacial":50,"Nageoire de Compétition":50,"Serviette de Plage":50},"eq":[{"tpl":"i8255","s":{"vit":[7,10],"cha":[16,20],"cri":[2,2]}},{"tpl":"i8256","s":{"vit":[21,25],"age":[16,20]}},{"tpl":"i8259","s":{"vit":[11,15],"cha":[11,15],"de":[2,3]}},{"tpl":"i8253","s":{"vit":[16,20],"cha":[16,20],"cri":[2,2]}}],"dj":1}'::jsonb, 'dj'),
('chateau_wa_wabbit', 'Château du Wa Wabbit', 60, '{"k":150000,"res":{"Oueille":450,"Pollenectar":450,"Viande Ladre":120,"Viande Tendre":93,"Black Wabbit écrasé":64,"Carte en bois : Ciseaux":37,"Carte en bois : Feuille":37,"Carte en bois : Pierre":37},"eq":[{"tpl":"i10847","s":{"vit":[-30,-30],"fo":[-15,-15],"cha":[-15,-15],"df":[3,4]}},{"tpl":"i181","s":{"vit":[46,55],"fo":[-10,-10],"ine":[-10,-10],"cha":[-10,-10],"age":[31,40]}},{"tpl":"i3204","s":{"ine":[16,30],"ini":[101,150],"rf":[3,5],"xf":[3,5],"xe":[3,5],"xa":[3,5]}},{"tpl":"i348","s":{"fo":[-20,-20],"cha":[16,20],"pp":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('cimetiere_mastodontes', 'Cimetière des Mastodontes', 80, '{"k":200000,"res":{"Oueille":450,"Pollenectar":450,"Viande Sanguinolente":181,"Œil de Léolhyène":37,"Boule de Boulépique":36,"Queue de Fennex":36,"Queue de Scordion Bleu":36,"Écailles d''Ouroboulos":36},"eq":[{"tpl":"i7243","s":{"vit":[31,40],"fo":[21,30],"rf":[2,3],"ra":[2,3]}},{"tpl":"i7184","s":{"vit":[151,200],"sa":[16,20],"pui":[21,30],"do":[4,5]}},{"tpl":"i8615","s":{"vit":[81,120],"ine":[51,70],"sa":[21,30],"so":[11,15]}},{"tpl":"i18426","s":{"vit":[51,70],"age":[41,60],"sa":[11,15],"rt":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('clairiere_chene_mou', 'Clairière du Chêne Mou', 140, '{"k":350000,"res":{"Oueille":450,"Pollenectar":450,"Viande Macérée":122,"Bourgeon d''Abraknyde Sombre Irascible":25,"Doigt de Branche Invocatrice":24,"Feuille de Branche Soignante":24,"Masque Cassé d''Araknotron Irascible":24,"Patte d''Abrakne Irascible":24},"dj":1}'::jsonb, 'dj'),
('clos_blops', 'Clos des Blops', 60, '{"k":150000,"res":{"Oueille":450,"Pollenectar":450,"Viande Ladre":207,"Blop mort":34,"Bout de Blop Coco":30,"Bout de Blop Griotte":30,"Bout de Blop Indigo":30,"Bout de Blop Reinette":30},"eq":[{"tpl":"i9123","s":{"fo":[16,20]}},{"tpl":"i9122","s":{"ine":[16,20]}},{"tpl":"i9150","s":{"vit":[41,50],"fo":[26,35],"sa":[11,15],"cri":[4,5]}},{"tpl":"i9124","s":{"age":[16,20]}}],"dj":1}'::jsonb, 'dj'),
('cour_bouftou_royal', 'Cour du Bouftou Royal', 30, '{"k":75000,"res":{"Oueille":450,"Pollenectar":450,"Viande Frelatée":239,"Corne de Boufton":48,"Cuir de Bouftou Noir":48,"Laine de Boufton Noir":48,"Laine de Bouftou":48,"Laine du Chef de Guerre Bouftou":48},"eq":[{"tpl":"i2411","s":{"fo":[16,20],"ine":[16,20]}},{"tpl":"i2416","s":{"vit":[16,20]}},{"tpl":"i2419","s":{"vit":[21,30],"ini":[71,100]}},{"tpl":"i2428","s":{"fo":[11,15],"ine":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('croquanterie', 'Croquanterie', 130, '{"k":325000,"res":{"Preuve de fiabilité":450,"Viande Persillée":131,"Image de collection":32,"Bec de Kwakao":26,"Enrobage de Chocoskargo":26,"Estomac de Mansocolat":26,"Oreille de Kakoalak":26,"Pelage chocolaté":26},"dj":1}'::jsonb, 'dj'),
('crypte_kardorim', 'Crypte de Kardorim', 10, '{"k":25000,"res":{"Os de Chafer":261,"Relique d''Incarnam":261,"Viande Intangible":261},"eq":[{"tpl":"i12753","s":{"vit":[11,15],"do":[1,2]}},{"tpl":"i16505","s":{"cri":[-5,-5]}},{"tpl":"i14798","s":{"cri":[2,2]}},{"tpl":"i121","s":{"age":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('defi_chaloeil', 'Défi du Chalœil', 200, '{"k":500000,"res":{"Viscères du Grand Jeu":450,"Carte Rongée":360,"Viande Goûtue":54,"Herbe à chacha divine":43,"Carte du Grand Jeu":18,"Biscuit de chance":14,"Ceinture de la Dame":11,"Gilet du Valet":11},"eq":[{"tpl":"i17585","s":{"vit":[301,350],"ine":[31,50],"cha":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"rn":[5,7],"re":[5,7],"dcri":[7,10]}},{"tpl":"i17583","s":{"vit":[351,400],"age":[61,80],"sa":[31,50],"cri":[-5,-5],"da":[16,20],"pp":[11,15],"rn":[7,10],"re":[7,10]}},{"tpl":"i17573","s":{"vit":[301,350],"fo":[61,80],"ine":[61,80],"sa":[31,50],"cri":[4,5],"dn":[9,12],"dt":[9,12],"df":[9,12],"pp":[11,15],"ra":[7,10]}},{"tpl":"i17582","s":{"vit":[251,300],"age":[41,60],"sa":[31,40],"da":[11,15],"pp":[11,15],"rt":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('demeure_esprits', 'Demeure des Esprits', 170, '{"k":425000,"res":{"Pollenectar":450,"Essence Spirituelle":360,"Testicules de Tsume-bozu":90,"Viande Maigre":86,"Kaokurimono":17,"Kapokaza":17,"Lanterne usée":17,"Masque brisé":17},"eq":[{"tpl":"i23623","s":{"vit":[201,250],"ine":[41,50],"sa":[21,30],"cri":[3,4],"df":[7,10],"so":[4,5],"ini":[201,300],"ra":[5,7],"xf":[7,10],"xa":[7,10]}},{"tpl":"i23625","s":{"vit":[251,300],"fo":[41,60],"ine":[41,60],"sa":[21,30],"cri":[2,3],"dn":[7,10],"dt":[7,10],"df":[7,10],"pp":[16,20],"re":[5,7]}},{"tpl":"i23628","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"age":[31,40],"sa":[21,30],"cri":[1,2],"dn":[6,9],"dt":[6,9],"df":[6,9],"da":[6,9],"ini":[-300,-300],"rt":[4,5],"dcri":[4,5]}},{"tpl":"i30692","s":{"vit":[111,160],"ine":[41,50],"sa":[21,25],"xn":[7,10],"xt":[7,10],"xf":[7,10],"xe":[7,10],"xa":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('dojo_vent', 'Dojo du Vent', 140, '{"k":350000,"res":{"Oueille":450,"Pollenectar":450,"Viande Macérée":122,"Bracelet de Ino-Naru":24,"Lame brisée de Lichangoro":24,"Ruban d''Uchiwang":24,"Tête de lance de Fangshu":24,"Étoffe de Kurookin":24},"eq":[{"tpl":"i7164","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"age":[31,50],"sa":[21,40],"do":[6,10],"ra":[6,10]}},{"tpl":"i23268","s":{"vit":[201,250],"age":[51,70],"sa":[21,30],"cri":[3,4],"da":[4,6],"pp":[11,15],"rn":[3,4]}},{"tpl":"i23262","s":{"vit":[151,200],"age":[41,60],"sa":[21,30],"da":[4,7],"so":[6,10],"pp":[11,15],"rn":[4,6],"xa":[7,10],"dcri":[4,6]}},{"tpl":"i23266","s":{"vit":[101,150],"age":[41,50],"sa":[16,25],"pa":[1,1],"so":[4,6],"pp":[9,12],"rn":[3,4],"xa":[7,10],"dcri":[5,8]}}],"dj":1}'::jsonb, 'dj'),
('domaine_ancestral', 'Domaine Ancestral', 90, '{"k":225000,"res":{"Oueille":450,"Pollenectar":450,"Viande Rassie":176,"Racine d''Abraknyde Vénérable":45,"Masque Brisé d''Araknotron":44,"Racine d''Abraknyde Sombre":44,"Pierre d''Émeraude":43,"Écorce d''Abrakne Sombre":43},"eq":[{"tpl":"i33568","s":{"vit":[51,90],"fo":[41,50],"sa":[16,20],"rf":[3,4]}},{"tpl":"i7207","s":{"vit":[71,90],"fo":[41,60],"sa":[21,25],"pui":[16,20],"cri":[4,6]}},{"tpl":"i33569","s":{"vit":[51,90],"sa":[16,25],"dn":[7,10],"dt":[7,10],"pp":[7,10],"rn":[3,4]}},{"tpl":"i6454","s":{"fo":[21,35],"ine":[21,35],"age":[21,35],"do":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('donjon_bworks', 'Donjon des Bworks', 50, '{"k":125000,"res":{"Oueille":450,"Pollenectar":450,"Bière bwork":216,"Viande Tendre":216,"Capsule Explosive":144,"Noix de Pécan":143,"Ficelle en Lin":74,"Noix de Cajou":74},"eq":[{"tpl":"i7209","s":{"fo":[21,30],"age":[21,30],"do":[3,4]}},{"tpl":"i1639","s":{"vit":[31,40],"fo":[-20,-20],"age":[21,30],"sa":[11,15],"rn":[2,3],"ra":[2,3]}},{"tpl":"i3203","s":{"sa":[7,10],"cri":[2,3],"ini":[51,100]}},{"tpl":"i1668","s":{"vit":[41,60],"cha":[-50,-50],"age":[-50,-50],"pui":[7,10],"rn":[2,2],"rt":[2,2],"rf":[2,2],"re":[2,2],"ra":[2,2]}}],"dj":1}'::jsonb, 'dj'),
('donjon_forgerons', 'Donjon des Forgerons', 50, '{"k":125000,"res":{"Oueille":450,"Pollenectar":450,"Viande Tendre":217,"Bougie Rouge":113,"Contrat entre Vil Smisse et Yse Vewybad":113,"Âme de Boulanger Sombre":113,"Âme de Forgeron Sombre":113,"Âme de Mineur Sombre":113},"eq":[{"tpl":"i13138","s":{"pui":[11,15],"pa":[1,1],"de":[4,5]}},{"tpl":"i11395","s":{"vit":[31,40],"fo":[16,25],"age":[16,25],"cri":[2,3],"do":[3,4]}},{"tpl":"i10854","s":{"fo":[16,20],"sa":[16,20],"do":[1,2],"dt":[2,3],"ini":[51,100]}},{"tpl":"i10851","s":{"vit":[41,50],"cha":[21,30]}}],"dj":1}'::jsonb, 'dj'),
('donjon_harebourg', 'Donjon du Comte Harebourg', 200, '{"k":500000,"res":{"Mécanisme cassé":360,"Rouage en Or":54,"Viande Goûtue":54,"Aile de Nocturlabe":11,"Aile de Sinistrofu":11,"Griffe de Strigide":11,"Plume de Granduk":11,"Œil de Cycloïde":11},"eq":[{"tpl":"i14161","s":{"vit":[351,400],"fo":[41,60],"cha":[41,60],"sa":[31,50],"cri":[4,5],"dn":[12,16],"dt":[12,16],"de":[12,16],"ini":[301,400],"rn":[7,10],"xf":[16,20]}},{"tpl":"i14133","s":{"vit":[351,400],"fo":[41,60],"cha":[41,60],"sa":[21,30],"dn":[12,16],"dt":[12,16],"de":[12,16],"rf":[7,10],"xn":[16,20],"xa":[11,15]}},{"tpl":"i14097","s":{"vit":[301,350],"fo":[71,100],"sa":[31,40],"cri":[-7,-5],"pa":[1,1],"dt":[11,15],"pp":[16,20],"ra":[7,10],"xe":[16,20],"dcri":[11,15]}},{"tpl":"i18697","s":{"vit":[201,250],"sa":[31,40],"rn":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('donjon_larves', 'Donjon des Larves', 50, '{"k":125000,"res":{"Viande Tendre":215,"Dent de Larve Rubis":54,"Dent de Larve Saphir":54,"Dent de Larve Émeraude":54,"Dent de Larve Dorée":53,"Cervelle de larve":20,"Peau de Larve Dorée":9,"Peau de Larve Rubis":9},"dj":1}'::jsonb, 'dj'),
('donjon_scarafeuilles', 'Donjon des Scarafeuilles', 40, '{"k":100000,"res":{"Oueille":375,"Pollenectar":375,"Viande Minérale":227,"Œufs de Scarafeuille":150,"Ailes de Scarafeuille Blanc":38,"Ailes de Scarafeuille Bleu":38,"Ailes de Scarafeuille Rouge":38,"Ailes de Scarafeuille Vert":38},"eq":[{"tpl":"i1075","s":{"vit":[21,30],"fo":[21,30],"cha":[16,20],"do":[2,3]}},{"tpl":"i1667","s":{"vit":[21,30],"ine":[21,30],"age":[-30,-21],"pui":[6,10],"xf":[3,5],"xe":[3,5],"xa":[3,5]}},{"tpl":"i777","s":{"cha":[11,15]}},{"tpl":"i7246","s":{"vit":[21,30],"cha":[7,10],"ini":[101,150],"re":[2,2]}}],"dj":1}'::jsonb, 'dj'),
('donjon_squelettes', 'Donjon des Squelettes', 40, '{"k":100000,"res":{"Pollenectar":450,"Dent de Chafer":360,"Viande Minérale":227,"Os de Chafer":91,"Os Invisible du Chafer Invisible":46,"Côtes du Rib":45,"Os Surprise du Chafer Fantassin":45,"Colonne Vertébrale":38},"eq":[{"tpl":"i12023","s":{"vit":[21,30],"cha":[16,25],"sa":[7,10]}},{"tpl":"i759","s":{"vit":[31,40],"rn":[2,2],"rt":[2,2],"rf":[2,2],"re":[2,2],"ra":[2,2]}},{"tpl":"i339","s":{"vit":[31,40],"ine":[-30,-30],"cha":[21,30],"cri":[2,3]}},{"tpl":"i9928","s":{"sa":[11,15],"pui":[11,15],"do":[2,3],"so":[1,1]}}],"dj":1}'::jsonb, 'dj'),
('donjon_tofus', 'Donjon des Tofus', 40, '{"k":100000,"res":{"Oueille":300,"Pollenectar":300,"Viande Minérale":128,"Phéromone de Tofu":50,"Dent de Tofu Mutant":26,"Patte de Tofukaz":26,"Plume Graisseuse du Tofu Ventripotent":26,"Plume de Tofu":26},"eq":[{"tpl":"i127","s":{"cha":[16,20],"pp":[2,3]}},{"tpl":"i708","s":{"cha":[31,40],"cri":[2,2]}},{"tpl":"i9575","s":{"vit":[41,50],"sa":[16,20],"do":[4,5],"dcri":[7,10]}},{"tpl":"i16240","s":{"vit":[11,15],"fo":[11,15],"sa":[11,15],"pui":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('epave_grolandais', 'Épave du Grolandais violent', 150, '{"k":375000,"res":{"Crâne éthéré":450,"Grain de Sel":450,"Pollenectar":450,"Saule en si":450,"Viande de Brousse":106,"Écho du Passé":54,"Coquille de Fantimonier":18,"Mât de Fantômat":18},"eq":[{"tpl":"i11626","s":{"vit":[151,200],"age":[31,50],"sa":[31,40],"cri":[4,5],"dn":[7,10],"da":[7,10],"pp":[11,15],"ini":[301,400],"ra":[5,7],"xt":[5,7],"xe":[5,7]}},{"tpl":"i11600","s":{"vit":[151,200],"fo":[21,35],"cha":[21,35],"age":[21,35],"sa":[21,35],"pui":[11,15],"cri":[3,4],"dn":[7,10],"dt":[7,10],"de":[7,10],"da":[5,7],"pp":[11,20],"ra":[5,7],"xn":[5,7]}},{"tpl":"i11635","s":{"vit":[151,200],"ine":[31,50],"age":[31,50],"sa":[31,40],"df":[5,7],"da":[7,10],"so":[5,7],"pp":[11,15],"ini":[151,250],"ra":[5,7]}},{"tpl":"i11601","s":{"vit":[151,200],"sa":[31,40],"xn":[11,15],"xt":[11,15],"xf":[11,15],"xe":[11,15],"xa":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('epreuve_draegnerys', 'Épreuve de Draegnerys', 70, '{"k":175000,"res":{"Pollenectar":450,"Oueille":360,"Viande Avariée":194,"Coquille de Dragoeuf Ardoise":39,"Coquille de Dragoeuf Argile":39,"Coquille de Dragoeuf Calcaire":39,"Coquille de Dragoeuf Charbon":39,"Peau de Dragoeuf Albâtre":39},"eq":[{"tpl":"i33566","s":{"vit":[31,50],"pui":[16,20],"cri":[3,4]}},{"tpl":"i33565","s":{"vit":[41,60],"sa":[11,15],"pui":[16,25],"cri":[4,6]}},{"tpl":"i33567","s":{"vit":[51,80],"sa":[16,25],"pui":[21,30],"cri":[5,7],"pp":[7,10]}},{"tpl":"i6474","s":{"vit":[26,35],"ine":[31,40],"sa":[6,10],"df":[2,3],"ini":[101,150],"rt":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('excavation_mansot', 'Excavation du Mansot Royal', 140, '{"k":350000,"res":{"Graine de Lentille":450,"Graisse de mansot":450,"Oueille":450,"Pied de Mansot":450,"Pollenectar":450,"Rhubarbe à papa":450,"Peau déchiquetée de Mansot":270,"Viande Macérée":129},"eq":[{"tpl":"i12090","s":{"vit":[101,140],"fo":[31,40],"sa":[16,25],"cri":[2,3],"dn":[4,5],"dt":[4,5],"da":[7,10],"pp":[7,10],"re":[4,5],"xn":[7,10]}},{"tpl":"i11634","s":{"vit":[101,150],"ine":[31,40],"cha":[31,40],"sa":[21,30],"df":[7,10],"de":[5,7],"so":[4,5],"pp":[11,15],"rt":[5,7],"ra":[5,7]}},{"tpl":"i14637","s":{"vit":[151,200],"cha":[31,40],"age":[21,30],"sa":[21,30],"de":[4,5],"da":[5,7],"pp":[11,15],"rt":[5,7],"rf":[5,7]}},{"tpl":"i14640","s":{"vit":[101,150],"cha":[31,40],"age":[31,40],"sa":[16,25],"cri":[3,4],"de":[5,7],"da":[5,7],"rt":[7,10],"xf":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('fabrique_foux', 'Fabrique de foux d''artifice', 140, '{"k":350000,"res":{"Oueille":450,"Pollenectar":450,"Viande Macérée":122,"Totem Firefoux":113,"Énigme du festival des lanternes":43,"Poudre de foux d''artifice":27,"Peau de Crachefoux":24,"Peau de Rouquette":24},"eq":[{"tpl":"i8095","s":{"vit":[201,250],"ine":[31,50],"age":[16,30],"do":[6,10],"ini":[201,400],"xn":[6,10]}}],"dj":1}'::jsonb, 'dj'),
('fabrique_mallefisk', 'Fabrique de Malléfisk', 100, '{"k":250000,"res":{"Viande Exsudative":162,"Antenne de Trésantène":32,"Corde de Boursoin":32,"Corne de Berserkoffre":32,"Langue de Mimikado":32,"Moustache précieuse":32,"Pièce de Koffrefor":18,"Sachet de Cerises":5},"eq":[{"tpl":"i15210","s":{"vit":[71,100],"fo":[21,30],"cha":[21,30],"sa":[7,10],"dn":[2,2],"dt":[2,2],"de":[2,2]}}],"dj":1}'::jsonb, 'dj'),
('fers_tyrannie', 'Fers de la Tyrannie', 200, '{"k":500000,"res":{"Oueille":450,"Viande Goûtue":54,"Clé des entraves":32,"Morceau de chaîne asservissante":27,"Baguette Rythmique":11,"Bois de pagaie usée":11,"Boulet lesté":11,"Capuche d''Armécréante":11},"eq":[{"tpl":"i22214","s":{"vit":[401,500],"sa":[31,40],"pa":[2,2],"ini":[701,1000],"rn":[2,3],"rt":[2,3],"rf":[2,3],"re":[2,3],"ra":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('fonderie_waddicts', 'Fonderie des Waddicts', 60, '{"k":150000,"res":{"Preuve de fiabilité":450,"Viande Ladre":207,"Œuf suwpwise":108,"Dent de Waddict":41,"Emballage Suspect":41,"Patte de Twakeuf":41,"Tendon de Waccro":41,"Œil Bionique":41},"eq":[{"tpl":"i20848","s":{"vit":[26,30],"fo":[16,20],"age":[16,20],"sa":[29,45],"pui":[13,20],"ini":[76,100]}}],"dj":1}'::jsonb, 'dj'),
('forgefroide_frizz', 'Forgefroide de Missiz Frizz', 200, '{"k":500000,"res":{"Essence glaciale d''armutin":450,"Pollenectar":450,"Frosplasme":360,"Métal maudit":135,"Métal Éternel":90,"Viande Goûtue":54,"Sacrifice d''Armutins":16,"Casque de Stalak":11},"eq":[{"tpl":"i13630","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"sa":[31,50],"cri":[2,3],"dn":[11,15],"dt":[11,15],"df":[11,15],"pp":[16,20],"rt":[6,8],"xn":[6,8],"xe":[6,8]}},{"tpl":"i33608","s":{"vit":[451,500],"ine":[31,40],"sa":[41,50],"pui":[41,50],"pa":[1,1],"rt":[9,12],"ra":[9,12]}},{"tpl":"i13631","s":{"vit":[201,250],"fo":[41,60],"ine":[41,60],"sa":[31,50],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[4,6],"pp":[16,20],"rf":[5,7],"ra":[5,7]}},{"tpl":"i13629","s":{"vit":[151,200],"fo":[31,40],"ine":[31,40],"sa":[31,40],"dn":[11,15],"dt":[11,15],"df":[11,15],"xn":[8,12],"xt":[8,12],"xf":[8,12]}}],"dj":1}'::jsonb, 'dj'),
('galerie_phossile', 'Galerie du Phossile', 150, '{"k":375000,"res":{"Pépite aurifère":450,"Viande de Brousse":108,"Corne de Père Phorreur":22,"Griffe de Phorrêveur":22,"Peau de Métaphorreur":22,"Queue de Mère Veilleuse":22,"Œil de Phozami":22,"Dent de Phorreur":18},"eq":[{"tpl":"i8937","s":{"vit":[151,200],"fo":[31,50],"ine":[31,50],"cha":[26,40],"so":[5,7],"pp":[11,20],"ini":[201,300],"rt":[5,7],"rf":[5,7]}},{"tpl":"i15201","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[3,4],"df":[7,10],"de":[7,10],"ra":[5,7],"xt":[7,10]}},{"tpl":"i15203","s":{"vit":[151,200],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[3,4],"pa":[1,1],"df":[7,10],"de":[7,10],"pp":[16,20],"rf":[5,7]}},{"tpl":"i15202","s":{"vit":[201,250],"ine":[31,40],"cha":[31,40],"sa":[21,30],"cri":[3,4],"df":[7,10],"de":[7,10],"rt":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('garde_manger_rat_blanc', 'Garde-manger du Rat Blanc', 110, '{"k":275000,"res":{"Viande Séchée":153,"Collier de Chak Rat":31,"Lance de Chika Rat":31,"Lance-Pierre de Scélée Rate":31,"Ouvrage magique d''Aloevée Rate":31,"Short de Capoei Rat":31,"Poil de Rat Bontarien":25,"Morceau d''emmental":22},"eq":[{"tpl":"i25753","s":{"vit":[51,100],"cha":[21,30],"sa":[11,20],"pui":[7,10],"de":[3,5],"ini":[151,200]}}],"dj":1}'::jsonb, 'dj'),
('gelaxieme_dimension', 'Gelaxième Dimension', 60, '{"k":150000,"res":{"Jus Concentré de Gelée":450,"Oueille":338,"Pollenectar":338,"Viande Ladre":205,"Confiture Bleue":113,"Confiture Fraise":113,"Confiture Menthe":113,"Eau Potable":52},"eq":[{"tpl":"i2447","s":{"vit":[41,50],"ine":[21,30],"sa":[21,30],"so":[4,6],"pp":[16,20]}},{"tpl":"i2471","s":{"vit":[41,60],"ine":[41,50],"cri":[4,5]}},{"tpl":"i8611","s":{"vit":[41,50],"ine":[26,35],"cha":[26,35],"sa":[16,20],"cri":[2,3],"so":[4,5],"dcri":[7,10]}},{"tpl":"i2470","s":{"pp":[1,15]}}],"dj":1}'::jsonb, 'dj'),
('goulet_rasboul', 'Goulet du Rasboul', 110, '{"k":275000,"res":{"Oueille":450,"Pollenectar":450,"Viande Séchée":155,"Sang du Kido":75,"Fluide de Kilibriss":38,"Aile du Bitouf des Plaines":26,"Duvet du Kilibriss":26,"Moustache du Mufafah":26},"eq":[{"tpl":"i8879","s":{"vit":[41,60],"fo":[11,15],"ine":[11,15],"cha":[11,15],"age":[11,15],"pui":[11,15],"do":[4,5],"ini":[151,200],"rn":[-5,-5],"rt":[-5,-5],"rf":[-5,-5],"re":[-5,-5],"ra":[-5,-5]}},{"tpl":"i2384","s":{"vit":[51,70],"ine":[36,45],"sa":[21,30],"rf":[4,5]}},{"tpl":"i8618","s":{"vit":[31,40],"cha":[41,50],"age":[21,30],"sa":[21,25],"do":[4,5],"pp":[7,10],"ini":[151,200]}},{"tpl":"i2615","s":{"fo":[21,30],"ine":[21,30],"cha":[21,30],"age":[21,30],"sa":[16,20],"pui":[21,30],"do":[5,7],"dcri":[4,6]}}],"dj":1}'::jsonb, 'dj'),
('grange_tournesol', 'Grange du Tournesol Affamé', 20, '{"k":50000,"res":{"Oueille":450,"Pollenectar":450,"Viande Faisandée":248,"Poire d''Épouvanteur":90,"Poire de Pissenlit":90,"Poire de Rose":90,"Poire de Tournesol":90,"Fleur de Pissenlit Diabolique":50},"eq":[{"tpl":"i6924","s":{"vit":[16,20],"pui":[7,10]}},{"tpl":"i775","s":{"vit":[26,30],"cri":[3,3]}},{"tpl":"i357","s":{"vit":[21,25],"age":[7,10],"da":[1,1]}},{"tpl":"i327","s":{"fo":[16,20]}}],"dj":1}'::jsonb, 'dj'),
('grotte_bworker', 'Grotte du Bworker', 180, '{"k":450000,"res":{"Oueille":450,"Pollenectar":450,"Viande Gâtée":77,"Artefact élémental d''Air":27,"Artefact élémental d''Eau":27,"Artefact élémental de Terre":27,"Artefact élémental du Feu":27,"Bandeau troué d''Air":13},"eq":[{"tpl":"i7189","s":{"vit":[201,250],"ine":[31,50],"sa":[21,35],"do":[6,10],"rn":[5,7],"rt":[5,7],"re":[5,7],"ra":[5,7]}},{"tpl":"i18695","s":{"vit":[141,190],"ine":[51,60],"sa":[21,30],"so":[16,20]}},{"tpl":"i33602","s":{"vit":[251,300],"fo":[41,60],"ine":[41,60],"sa":[21,30],"cri":[2,3],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"pp":[7,10],"rt":[3,5],"rf":[3,5],"re":[3,5]}},{"tpl":"i8932","s":{"vit":[151,200],"fo":[31,50],"age":[21,30],"sa":[26,40],"cri":[2,3],"do":[5,7],"pp":[11,15],"ini":[301,500],"rn":[6,10],"xn":[6,10]}}],"dj":1}'::jsonb, 'dj'),
('grotte_hesque', 'Grotte Hesque', 50, '{"k":125000,"res":{"Oueille":450,"Pollenectar":450,"Viande Tendre":218,"Bulbe Kouraçao":24,"Bulbe Malibout":24,"Bulbe Morito":24,"Bulbe Passaoh":24,"Coccyx du Corailleur":24},"eq":[{"tpl":"i2386","s":{"cri":[3,10],"do":[3,5],"ini":[51,100]}},{"tpl":"i6992","s":{"vit":[36,45],"fo":[16,20],"ine":[16,20],"cha":[16,20],"age":[16,20],"sa":[21,25],"so":[7,10]}},{"tpl":"i1499","s":{"cha":[31,40],"pp":[11,15]}},{"tpl":"i17214","s":{"vit":[41,50],"cha":[31,40],"pui":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('grotte_kanigroula', 'Grotte de Kanigroula', 160, '{"k":400000,"res":{"Oueille":450,"Pollenectar":450,"Poils pubiens de Kanig":360,"Viande Fraîche":99,"Chaîne de Panthègros":20,"Crinière d''Orfélin":20,"Griffe de Félygiène":20,"Oreille de Kaniblou":20},"eq":[{"tpl":"i18688","s":{"vit":[111,160],"pui":[21,30],"cri":[4,5],"rf":[4,6],"re":[4,6]}},{"tpl":"i8839","s":{"vit":[-150,-101],"fo":[61,80],"sa":[31,50],"pui":[11,15],"cri":[4,5],"do":[11,15],"pp":[11,20],"ini":[301,500],"rt":[9,14],"xt":[9,14]}},{"tpl":"i8094","s":{"vit":[201,300],"fo":[31,50],"do":[6,10],"pp":[11,20]}},{"tpl":"i15063","s":{"vit":[151,200],"age":[41,60],"sa":[21,30],"pui":[11,15],"cri":[3,4],"da":[5,7],"rf":[4,5],"re":[5,7],"xe":[9,12]}}],"dj":1}'::jsonb, 'dj'),
('horologium_xlii', 'Horologium de XLII', 170, '{"k":425000,"res":{"Eau  Putride":450,"Eau putride de Hordémon":450,"Pièce technomagique endommagée":180,"Âme de Seith":90,"Âme de Trantroâ":90,"Âme de Trezz":90,"Âme de Vindeux":90,"Viande Maigre":86},"dj":1}'::jsonb, 'dj'),
('hypogee_obsidiantre', 'Hypogée de l''Obsidiantre', 160, '{"k":400000,"res":{"Ellébore d''Hel":450,"Graine de Basalte":450,"Larme magmatique":450,"Oueille":450,"Pollenectar":450,"Graine Hade":270,"Larme au Rikain":270,"Rose à lys Cullen":270},"eq":[{"tpl":"i11619","s":{"vit":[201,250],"age":[31,50],"sa":[31,40],"cri":[3,4],"da":[7,10],"pp":[11,20],"ini":[201,300],"rt":[5,7],"re":[5,7],"xa":[7,10]}},{"tpl":"i32215","s":{"vit":[131,180],"fo":[31,40],"ine":[31,40],"cha":[31,40],"sa":[16,25],"cri":[4,6],"pp":[11,15],"rt":[3,4],"re":[3,4]}},{"tpl":"i11623","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"sa":[21,30],"dn":[6,9],"dt":[6,9],"de":[6,9],"ra":[5,7],"xn":[7,10],"xe":[7,10]}},{"tpl":"i11632","s":{"vit":[151,200],"ine":[31,50],"cha":[31,50],"sa":[31,40],"df":[7,10],"de":[7,10],"so":[7,10],"ini":[101,200],"rt":[5,7],"ra":[5,7],"xn":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('labo_brumen', 'Laboratoire de Brumen Tinctorias', 70, '{"k":175000,"res":{"Oueille":450,"Pollenectar":450,"Viande Avariée":194,"Cobaye Macien":90,"Venin de scorbute":90,"Babines de Macien":39,"Graine de Scorbute":39,"Moustache de Kolérat":39},"eq":[{"tpl":"i7341","s":{"vit":[31,50],"rt":[4,5],"xe":[4,6],"xa":[4,6]}},{"tpl":"i7241","s":{"vit":[41,60],"age":[31,40],"sa":[16,20],"rf":[4,5],"ra":[4,5]}},{"tpl":"i15998","s":{"ine":[21,30],"cha":[21,30],"sa":[7,10],"df":[2,3],"de":[2,3]}},{"tpl":"i4242","s":{"fo":[31,40],"ine":[31,40],"cha":[31,40],"age":[31,40],"pui":[4,5],"do":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('labo_nileza', 'Laboratoire de Nileza', 200, '{"k":500000,"res":{"Pollenectar":450,"Résidu d''alchillusion":450,"Cendres élémentaires":360,"Viande Goûtue":54,"Bave de Nessil":11,"Bractée de Drosérâle":11,"Canine de Krakal":11,"Patte de Termystique":11},"eq":[{"tpl":"i14067","s":{"vit":[151,200],"sa":[31,50],"dn":[4,5],"dt":[4,5],"df":[4,5],"de":[4,5],"da":[4,5]}},{"tpl":"i14088","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[4,6],"df":[11,15],"de":[11,15],"pp":[7,10],"ini":[201,300],"xt":[11,15],"xe":[11,15]}},{"tpl":"i14089","s":{"vit":[251,300],"ine":[31,40],"cha":[31,40],"sa":[21,30],"df":[8,12],"de":[8,12],"so":[7,10],"dcri":[7,10]}},{"tpl":"i14055","s":{"vit":[251,300],"fo":[51,75],"sa":[31,40],"cri":[-8,-6],"dn":[7,10],"dt":[7,10],"pp":[16,20],"ini":[301,400],"rt":[7,10],"ra":[7,10],"dcri":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('labo_tynril', 'Laboratoire du Tynril', 140, '{"k":350000,"res":{"Oueille":450,"Pollenectar":450,"Viande Macérée":120,"Belladone de Brouture":64,"Amygdales du Bitouf Sombre":17,"Bractée de Chiendent":17,"Calice de Fécorce":17,"Carpelle de Brouture":17},"eq":[{"tpl":"i6461","s":{"vit":[41,70],"cha":[31,50],"age":[31,50],"pa":[1,1],"do":[6,10],"pp":[11,15],"rf":[3,5],"re":[3,5]}},{"tpl":"i8836","s":{"vit":[101,150],"ine":[26,45],"age":[26,45],"cri":[3,4],"so":[4,6],"rf":[6,10],"ra":[6,10]}},{"tpl":"i7003","s":{"vit":[101,150],"ine":[11,30],"sa":[31,40],"pa":[1,1],"so":[6,10],"re":[5,7],"ra":[5,7],"xt":[9,13],"xf":[9,13]}},{"tpl":"i8850","s":{"vit":[251,300],"age":[41,60],"sa":[41,60],"do":[6,10],"pp":[11,20]}}],"dj":1}'::jsonb, 'dj'),
('labyrinthe_minotoror', 'Centre du Labyrinthe du Minotoror', 120, '{"k":300000,"res":{"Viande Saignante":116,"Mominotor":75,"Oueille":75,"Pollenectar":75,"Relique du Déminoboule":75,"Relique du Mominotor":75,"Carapace de Scaratos":24,"Bandelette du Mominotor":23},"eq":[{"tpl":"i7193","s":{"vit":[151,200],"ine":[31,50],"age":[21,40],"pui":[16,20],"pp":[11,15],"rf":[4,6],"ra":[4,6]}},{"tpl":"i7163","s":{"vit":[151,200],"age":[26,45],"cri":[5,6],"do":[6,7],"rn":[4,5]}},{"tpl":"i7199","s":{"vit":[151,200],"fo":[31,50],"age":[31,50],"ini":[300,300],"rn":[5,7],"rf":[5,7],"re":[5,7]}},{"tpl":"i6510","s":{"vit":[31,60],"cha":[31,50],"sa":[21,35],"pp":[6,10],"rf":[3,5],"re":[3,5],"xf":[4,8],"xe":[4,8],"xa":[4,8]}}],"dj":1}'::jsonb, 'dj'),
('maison_fantome', 'Maison Fantôme', 40, '{"k":100000,"res":{"Pollenectar":450,"Viande Minérale":230,"Ceinture de Gargrouille":90,"Cervelle de vampire":90,"Oueille":90,"Sang visqueux du Vampire":90,"Échantillon de Créature Contaminée":90,"Aile du Tofu Maléfique":46},"eq":[{"tpl":"i8162","s":{"vit":[1,5],"ini":[1,10]}},{"tpl":"i7107","s":{"vit":[21,30],"ine":[21,25],"age":[16,20],"so":[4,5]}},{"tpl":"i10171","s":{"age":[21,30],"do":[2,3]}},{"tpl":"i10155","s":{"vit":[21,30],"age":[21,30],"do":[3,4],"ini":[101,150]}}],"dj":1}'::jsonb, 'dj'),
('manoir_katrepat', 'Manoir des Katrepat', 200, '{"k":500000,"res":{"Oueille":450,"Pollenectar":450,"Viande Goûtue":54,"Sacrifice de Goules":16,"Aile de Kérigoule":11,"Nez de Pipisteuse":11,"Ongle de Goulafre":11,"Poils de Goultime":11},"eq":[{"tpl":"i19093","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[3,4],"df":[11,15],"de":[11,15],"so":[9,12],"pp":[11,15],"ra":[7,10]}},{"tpl":"i19096","s":{"vit":[301,350],"fo":[31,50],"ine":[31,50],"age":[31,50],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"df":[11,15],"da":[11,15],"re":[7,10]}},{"tpl":"i19076","s":{"vit":[401,500],"cri":[7,10],"pp":[16,20],"rn":[5,7],"rt":[5,7],"rf":[5,7],"re":[5,7],"ra":[5,7]}},{"tpl":"i19078","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"cha":[31,40],"sa":[21,30],"dn":[5,7],"dt":[5,7],"df":[5,7],"de":[5,7],"rt":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('megalithe_fraktale', 'Mégalithe de Fraktale', 120, '{"k":300000,"res":{"Viande Saignante":140,"Pixel d''Éklatleth":28,"Pixel de Brikablak":28,"Pixel de Farfacette":28,"Pixel de Gromorso":28,"Pixel de Segmantid":28,"Sablier miniature":5,"Sachet de Poudre Temporelle":5},"dj":1}'::jsonb, 'dj'),
('memoire_orukam', 'Mémoire d''Orukam', 200, '{"k":500000,"res":{"Viande Goûtue":54,"Troisième morceau de parchemin oublié":43,"Papier comestible":27,"Kianzhi de la Lance du Wukang":14,"Mots pliés":14,"Apostrophe d''Imafugo":11,"Carapace circonflexe d''Imorok":11,"Cédille d''Imetsu":11},"eq":[{"tpl":"i24022","s":{"vit":[251,300],"ine":[41,60],"cha":[41,60],"sa":[31,40],"cri":[3,5],"pa":[1,1],"df":[9,12],"de":[9,12],"rt":[7,10],"ra":[7,10]}},{"tpl":"i24023","s":{"vit":[351,400],"ine":[51,70],"cha":[51,70],"sa":[21,30],"cri":[3,4],"df":[9,12],"de":[9,12],"rt":[7,10],"ra":[7,10]}},{"tpl":"i24024","s":{"vit":[401,500],"ine":[61,80],"cha":[61,80],"sa":[31,50],"cri":[2,3],"df":[11,15],"de":[11,15],"rt":[3,5],"ra":[3,5]}},{"tpl":"i30683","s":{"vit":[201,250],"ine":[51,70],"cha":[51,70],"sa":[31,40],"cri":[2,3],"rf":[6,8],"re":[6,8],"rt":[-3,-3],"ra":[-3,-3]}}],"dj":1}'::jsonb, 'dj'),
('miausolee_pounicheur', 'Miausolée du Pounicheur', 110, '{"k":275000,"res":{"Viande Séchée":153,"Palpe de Pikbul":31,"Patte de Pupuce":31,"Peau de Gériatique":31,"Épine de Grath":31,"Œil de Morcac":31,"Larve pétrifiée d''Ecaflipuce":18,"Tonneau de Jus Goûtu":5},"eq":[{"tpl":"i17598","s":{"vit":[151,200],"ine":[31,50],"age":[21,30],"sa":[16,25],"df":[5,7],"da":[5,7],"xn":[5,7],"xt":[5,7],"xe":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('mine_sakai', 'Donjon de la mine de Sakaï', 190, '{"k":475000,"res":{"Oueille":450,"Pollenectar":450,"Perkü":75,"Viande Noire":62,"Oreille de Gobosteur":11,"Peau d''Ouilleur":11,"Péroné du Marôdeur":11,"Œil de Sapeur":11},"eq":[{"tpl":"i13122","s":{"vit":[301,350],"cha":[61,80],"sa":[31,40],"cri":[4,6],"de":[14,18],"pp":[21,30]}},{"tpl":"i11473","s":{"vit":[301,350],"ine":[46,60],"age":[46,60],"sa":[36,50],"do":[7,10],"pp":[6,10],"xn":[10,15],"xt":[10,15],"xa":[10,15]}},{"tpl":"i13641","s":{"vit":[101,150],"ine":[41,60],"age":[41,60],"sa":[31,50],"cri":[5,7],"df":[7,10],"da":[7,10],"so":[6,8],"pp":[7,10],"ini":[401,500],"rt":[6,8],"ra":[6,8],"xe":[8,12],"dcri":[11,15]}},{"tpl":"i11469","s":{"vit":[201,250],"sa":[36,50],"cri":[4,5],"do":[9,12],"pp":[11,20],"ini":[201,300],"rt":[7,10],"xn":[7,10],"xf":[7,10],"xe":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('nid_kwakwa', 'Nid du Kwakwa', 50, '{"k":125000,"res":{"Oueille":450,"Pollenectar":450,"Viande Tendre":216,"Griffes de Kwak":72,"Bec du Kwak de Flamme":18,"Bec du Kwak de Glace":18,"Bec du Kwak de Terre":18,"Bec du Kwak de Vent":18},"eq":[{"tpl":"i6750","s":{"vit":[21,30],"cha":[21,30],"cri":[2,3],"re":[2,3]}},{"tpl":"i1035","s":{"cha":[26,35],"age":[31,40],"cri":[2,3],"de":[2,3],"da":[2,3]}},{"tpl":"i6513","s":{"vit":[21,30],"age":[21,30],"pui":[7,10]}},{"tpl":"i6732","s":{"cha":[16,20],"re":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('oeil_vortex', 'Œil de Vortex', 200, '{"k":500000,"res":{"Viande Goûtue":54,"Boucle des Égarés":18,"Sablier miniature":14,"Corne de Méjaire":11,"Griffe de Buboxor":11,"Plume de Brabuzar":11,"Serre d''Ikargn":11,"Œil de Harpille":11},"eq":[{"tpl":"i15751","s":{"vit":[351,400],"ine":[31,50],"cha":[31,50],"sa":[31,40],"df":[16,20],"de":[16,20],"rn":[5,7],"rt":[5,7]}},{"tpl":"i15742","s":{"vit":[251,300],"fo":[51,70],"age":[51,70],"sa":[31,40],"cri":[4,5],"dn":[11,15],"dt":[11,15],"da":[11,15],"pp":[11,15],"ra":[7,10]}},{"tpl":"i15746","s":{"vit":[351,400],"sa":[31,40],"cri":[4,5],"pa":[1,1],"ra":[7,10]}},{"tpl":"i15779","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[31,40],"cri":[-5,-5],"dn":[16,20],"dt":[16,20],"de":[16,20],"pp":[11,15],"rf":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('palais_dantinea', 'Palais de Dantinéa', 200, '{"k":500000,"res":{"Cerveau de Trithon":450,"Cuisse de Trithon":450,"Herbe Aquatique":360,"Viande Goûtue":54,"Encre de Poulpée":11,"Lanterne de Tourthon":11,"Moustache de Rilur":11,"Trident de Tryde":11},"eq":[{"tpl":"i18019","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"dn":[9,12],"dt":[9,12],"da":[9,12],"rf":[7,10],"ra":[7,10]}},{"tpl":"i18017","s":{"vit":[301,400],"cha":[61,80],"sa":[31,50],"cri":[4,6],"de":[16,20],"rn":[5,7],"rf":[5,7]}},{"tpl":"i18021","s":{"vit":[301,350],"fo":[51,70],"age":[51,70],"sa":[31,40],"cri":[3,4],"dn":[9,12],"dt":[9,12],"da":[9,12],"rf":[7,10]}},{"tpl":"i18031","s":{"vit":[301,400],"sa":[31,40],"cri":[3,4],"pp":[11,15],"ini":[601,800],"rf":[7,10],"dcri":[21,25]}}],"dj":1}'::jsonb, 'dj'),
('palais_nidas', 'Palais du roi Nidas', 200, '{"k":500000,"res":{"Échantillon de Sang d''Enutrofor":86,"Viande Goûtue":54,"Poils de Barbe d''Enutrofor":18,"Kamatrix":14,"Boule en or de Piloztère":11,"Corne de Kamasterisk":11,"Dent de Lévitrof":11,"Morceau de clef de Paspartou":11},"eq":[{"tpl":"i18670","s":{"vit":[201,250],"fo":[41,50],"ine":[41,50],"cha":[41,50],"age":[41,50],"cri":[4,5],"rn":[2,3],"rt":[2,3],"rf":[2,3],"re":[2,3],"ra":[2,3],"dcri":[4,5]}},{"tpl":"i15195","s":{"vit":[351,400],"fo":[51,70],"age":[51,70],"sa":[31,40],"pa":[1,1],"dn":[9,12],"dt":[9,12],"da":[9,12],"re":[7,10]}},{"tpl":"i15217","s":{"vit":[301,350],"ine":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"df":[11,15],"da":[11,15],"pp":[11,15],"rt":[7,10],"xa":[11,15]}},{"tpl":"i15186","s":{"vit":[301,350],"ine":[31,50],"sa":[31,40],"cri":[4,5],"df":[11,15],"so":[11,15],"rn":[7,10],"rt":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('pitons_craqueleur', 'Pitons Rocheux des Craqueleurs', 70, '{"k":175000,"res":{"Oueille":375,"Pollenectar":375,"Viande Avariée":162,"Cobaye Craqueleur":75,"Caillou Craquelé de Cania":56,"Charbon":33,"Fragment de Pierre Pointue":32,"Pierre du Craqueleur":32},"eq":[{"tpl":"i14311","s":{"vit":[31,50],"age":[21,30],"cri":[2,3],"da":[3,4]}},{"tpl":"i6445","s":{"vit":[51,70],"cha":[41,60],"pui":[11,15],"cri":[3,4],"do":[2,3],"rf":[4,5]}},{"tpl":"i2595","s":{"vit":[31,40],"fo":[31,40],"sa":[16,20],"ini":[151,200]}},{"tpl":"i910","s":{"vit":[31,40],"age":[31,40],"sa":[21,30],"cri":[3,4],"do":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('plateau_ush', 'Plateau de Ush', 160, '{"k":400000,"res":{"Patte de Matougarou":113,"Viande Fraîche":83,"Œil de Chakichan":75,"Œil de Chargus":75,"Œil de Chasquatch":75,"Cobaye Matougarou":45,"Collier de Chakichan":17,"Dent de Chakaroze":17},"eq":[{"tpl":"i8841","s":{"vit":[-150,-101],"age":[61,80],"sa":[31,50],"pui":[11,15],"cri":[4,5],"do":[11,15],"pp":[11,20],"ini":[301,500],"ra":[9,14],"xa":[9,14]}},{"tpl":"i17591","s":{"vit":[201,250],"fo":[41,60],"cha":[41,60],"sa":[31,40],"cri":[4,5],"dn":[7,10],"dt":[7,10],"de":[7,10],"rf":[5,7],"dcri":[9,12]}},{"tpl":"i17590","s":{"vit":[201,250],"fo":[41,60],"cha":[41,60],"sa":[26,35],"dn":[7,10],"dt":[7,10],"de":[7,10],"ini":[401,500],"ra":[7,10],"dcri":[9,12]}},{"tpl":"i17592","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"sa":[16,25],"dn":[7,10],"dt":[7,10],"de":[7,10],"dcri":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('poste_supervizoeuf', 'Poste de contrôle du Supervizœuf', 170, '{"k":425000,"res":{"Balebz":113,"Kamikabz":113,"Quadrabz":113,"Toubibz":113,"Viande Maigre":86,"Lait nourricier":54,"Lymphe régénérante":54,"Sang brûlant":54},"eq":[{"tpl":"i31792","s":{"vit":[151,200],"fo":[31,40],"cha":[31,40],"age":[31,40],"sa":[21,30],"do":[4,6],"so":[5,8],"pp":[11,15],"rt":[3,4],"re":[3,4],"ra":[3,4]}},{"tpl":"i31791","s":{"vit":[151,200],"ine":[31,40],"cha":[31,40],"age":[31,40],"sa":[21,30],"cri":[1,2],"do":[4,6],"ini":[201,300],"rf":[3,4],"re":[3,4],"ra":[3,4]}},{"tpl":"i31793","s":{"vit":[151,200],"fo":[31,40],"ine":[31,40],"sa":[21,30],"do":[4,6],"so":[5,8],"pp":[7,10],"rt":[3,4],"rf":[3,4]}}],"dj":1}'::jsonb, 'dj'),
('pyramide_ombre', 'Pyramide d''Ombre', 190, '{"k":475000,"res":{"Masque de Brutopak":90,"Masque de Caznoar":90,"Masque de Noctulule":90,"Masque de Panterreur":90,"Panterreur":90,"Viande Noire":59,"Éclat Obscur":27,"Masque de la Vengeance":12},"eq":[{"tpl":"i30060","s":{"vit":[151,200],"age":[51,70],"sa":[21,30],"cri":[4,5],"pp":[11,15],"rn":[5,7],"ra":[5,7]}},{"tpl":"i14929","s":{"vit":[301,350],"fo":[31,50],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[4,6],"pa":[1,1],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10]}},{"tpl":"i14930","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[4,5],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"pp":[11,15],"ra":[7,10]}},{"tpl":"i13123","s":{"vit":[351,400],"age":[71,100],"sa":[31,40],"da":[16,20],"pp":[11,15],"ra":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('refuge_sylvestre', 'Refuge sylvestre', 50, '{"k":125000,"res":{"Oueille":450,"Pollenectar":450,"Viande Tendre":216,"Corne de Buffalourd":43,"Croc de Trankilou":43,"Fourrure de Timongouste":43,"Griffe de Grolours":43,"Plume de Thomondor":43},"eq":[{"tpl":"i27534","s":{"vit":[21,40],"ine":[31,40],"age":[31,40],"sa":[6,10],"so":[4,7]}},{"tpl":"i27533","s":{"vit":[31,40],"fo":[21,30],"cha":[21,30],"sa":[6,10],"dn":[2,3],"dt":[2,3],"de":[2,3]}},{"tpl":"i27531","s":{"vit":[21,40],"fo":[11,20],"cha":[11,20],"pa":[1,1]}},{"tpl":"i27532","s":{"vit":[21,30],"fo":[31,50],"cha":[31,50]}}],"dj":1}'::jsonb, 'dj'),
('repaire_kharnozor', 'Repaire du Kharnozor', 100, '{"k":250000,"res":{"Oueille":450,"Pollenectar":450,"Viande Exsudative":162,"Coquille de Dragoss Protéiforme":32,"Écaille de Dragoss Ardoise":32,"Écaille de Dragoss Argile":32,"Écaille de Dragoss Calcaire":32,"Écaille de Dragoss Charbon":32},"dj":1}'::jsonb, 'dj'),
('repaire_skeunk', 'Repaire de Skeunk', 120, '{"k":300000,"res":{"Oueille":225,"Pollenectar":225,"Viande Saignante":130,"Broche Diamant":38,"Broche Rubis":38,"Broche Saphir":38,"Broche Émeraude":38,"Poils de Koalak Reinette":15},"eq":[{"tpl":"i7188","s":{"vit":[101,150],"ine":[26,40],"age":[26,40],"do":[4,5],"so":[4,5]}},{"tpl":"i8104","s":{"vit":[51,100],"ine":[21,35],"do":[4,6],"pp":[6,15],"ini":[101,200],"rt":[5,8],"re":[5,8]}},{"tpl":"i6516","s":{"vit":[41,80],"age":[31,50],"sa":[21,30],"pui":[11,15],"pp":[6,10]}},{"tpl":"i6523","s":{"vit":[41,80],"fo":[16,30],"sa":[21,35],"do":[6,10],"ini":[151,250]}}],"dj":1}'::jsonb, 'dj'),
('repaire_sphincter', 'Repaire de Sphincter Cell', 150, '{"k":375000,"res":{"Pierre d''Agathe":114,"Viande de Brousse":114,"Œil de Rat du Gang":57,"Queue de Rat du Gang":55,"Pilule du Gang":19,"Koukawa":7,"Sachet de Cendres Éternelles":5},"dj":1}'::jsonb, 'dj'),
('ring_ekarlatte', 'Ring du Capitaine Ekarlatte', 130, '{"k":325000,"res":{"Viande Persillée":131,"Bandelette de Tromblion":26,"Foulard de Milimaître":26,"Os de Sramouraï":26,"Sacoche de Kartouche":26,"Slip d''Elsoummo":26,"Insigne de Malveilleur":18,"Crochet rouillé":5},"eq":[{"tpl":"i16004","s":{"vit":[101,150],"sa":[16,25],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[7,10],"da":[7,10],"ini":[101,200]}},{"tpl":"i15999","s":{"vit":[151,200],"sa":[21,30],"cri":[4,5],"dn":[11,15],"dt":[11,15],"df":[11,15],"de":[11,15],"da":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('rituel_kabahal', 'Rituel de Kabahal', 200, '{"k":500000,"res":{"Oueille":450,"Pollenectar":450,"Âme de Possédé":450,"Signe des Possédés":68,"Viande Goûtue":54,"Sang de Possédé":22,"Aile d''Eninferno":11,"Diadème de Belilith":11},"eq":[{"tpl":"i30862","s":{"vit":[351,400],"ine":[36,66],"sa":[21,30],"cri":[3,6],"df":[13,18],"rf":[9,12],"ra":[5,9],"re":[-3,-3],"xe":[-11,-11]}},{"tpl":"i25216","s":{"vit":[301,350],"fo":[41,60],"age":[41,60],"sa":[31,40],"pui":[11,15],"cri":[3,4],"dn":[11,15],"dt":[11,15],"da":[11,15],"rt":[11,15]}},{"tpl":"i30863","s":{"vit":[351,400],"ine":[36,66],"sa":[21,30],"cri":[2,3],"pa":[1,1],"df":[13,18],"rt":[5,9],"rf":[5,9],"re":[-3,-3],"xe":[-11,-11]}},{"tpl":"i25218","s":{"vit":[201,250],"fo":[41,60],"sa":[16,20],"dn":[6,8],"dt":[6,8],"ini":[201,300],"rt":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('salle_minotot', 'Salle du Minotot', 160, '{"k":400000,"res":{"Viande Saignante":116,"Mominotor":75,"Oueille":75,"Pollenectar":75,"Relique du Déminoboule":75,"Relique du Mominotor":75,"Carapace de Scaratos":24,"Bandelette du Mominotor":23},"eq":[{"tpl":"i7193","s":{"vit":[151,200],"ine":[31,50],"age":[21,40],"pui":[16,20],"pp":[11,15],"rf":[4,6],"ra":[4,6]}},{"tpl":"i7163","s":{"vit":[151,200],"age":[26,45],"cri":[5,6],"do":[6,7],"rn":[4,5]}},{"tpl":"i7199","s":{"vit":[151,200],"fo":[31,50],"age":[31,50],"ini":[300,300],"rn":[5,7],"rf":[5,7],"re":[5,7]}},{"tpl":"i6510","s":{"vit":[31,60],"cha":[31,50],"sa":[21,35],"pp":[6,10],"rf":[3,5],"re":[3,5],"xf":[4,8],"xe":[4,8],"xa":[4,8]}}],"dj":1}'::jsonb, 'dj'),
('salons_klime', 'Salons privés de Klime', 200, '{"k":500000,"res":{"Pollenectar":450,"Cuir épais":360,"Viande Goûtue":54,"Crâne de centoror gelé":23,"Cuir Huileux de Grodruche":11,"Cuir d''Empaillé":11,"Cuir de Cuirboule":11,"Cuir de Grodruche":11},"eq":[{"tpl":"i14156","s":{"vit":[251,300],"cha":[61,80],"sa":[31,40],"cri":[4,5],"de":[9,13],"pp":[11,15],"ini":[-400,-301],"rt":[6,8],"ra":[6,8],"xn":[16,20]}},{"tpl":"i13896","s":{"vit":[201,250],"fo":[41,60],"age":[41,60],"cri":[4,5],"dn":[14,18],"dt":[14,18],"da":[14,18],"pp":[11,15],"ini":[-400,-301],"rn":[7,10],"ra":[7,10]}},{"tpl":"i14167","s":{"vit":[251,300],"ine":[31,40],"cha":[41,60],"sa":[31,40],"df":[7,10],"de":[11,15],"so":[4,5],"pp":[16,20],"ra":[7,10],"xf":[11,15]}},{"tpl":"i14053","s":{"vit":[351,400],"fo":[21,30],"age":[41,60],"sa":[31,40],"cri":[4,5],"dn":[6,8],"dt":[6,8],"da":[12,16],"pp":[7,10],"rf":[6,8],"re":[6,8]}}],"dj":1}'::jsonb, 'dj'),
('sanctuaire_torkelonia', 'Sanctuaire de Torkélonia', 200, '{"k":500000,"res":{"Pierre de lune inaltérée":108,"Viande d''Alashasss":90,"Viande de Caïguille":90,"Viande de Cronnibal":90,"Viande de Voapah":90,"Parchemin mordillé":54,"Viande Goûtue":54,"Bandeau de Voapah":11},"eq":[{"tpl":"i21225","s":{"vit":[201,250],"pui":[41,50],"cri":[4,7],"ini":[601,800],"re":[11,15]}},{"tpl":"i21227","s":{"vit":[251,300],"sa":[21,40],"pui":[51,70],"pa":[1,1],"dn":[16,20],"da":[16,20],"pp":[16,20],"ini":[201,250]}},{"tpl":"i21228","s":{"vit":[201,250],"sa":[21,30],"pui":[31,50],"dt":[11,15],"pp":[11,15],"ini":[101,150]}},{"tpl":"i21224","s":{"vit":[301,350],"ine":[61,80],"sa":[21,30],"cri":[3,4],"df":[16,20],"rt":[8,12],"re":[8,12]}}],"dj":1}'::jsonb, 'dj'),
('sentence_balance', 'Sentence de la Balance', 200, '{"k":500000,"res":{"Oueille":450,"Besace de nourriture":90,"Viande Goûtue":54,"Capuche de Skentu":11,"Côtes de Désosseur":11,"Langue de Krèvladal":11,"Épaulière de Ferrailleur":11,"Œil de Dawaj":11},"eq":[{"tpl":"i18696","s":{"vit":[201,250],"sa":[31,40],"pui":[41,50],"rt":[7,10],"re":[4,7]}},{"tpl":"i22215","s":{"vit":[351,400],"fo":[61,80],"sa":[21,30],"cri":[4,5],"dn":[11,15],"dt":[11,15],"rt":[9,12],"ra":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('serre_royalmouth', 'Serre du Royalmouth', 120, '{"k":300000,"res":{"Dent de sagesse de Boufmouth":450,"Graine de Pois":450,"Oueille":450,"Pollenectar":450,"Yucca Lélé":450,"Viande Saignante":146,"Viande fraîche":108,"Tiques de Boufmouth":60},"eq":[{"tpl":"i6984","s":{"vit":[71,100],"age":[31,50],"sa":[26,40],"cri":[2,3],"pp":[6,10]}},{"tpl":"i7198","s":{"vit":[101,150],"fo":[31,50],"age":[31,50],"sa":[21,35],"cri":[5,7]}},{"tpl":"i2400","s":{"vit":[31,50],"sa":[16,30],"do":[6,10],"pp":[6,10],"rn":[3,5],"xf":[11,15],"xe":[11,15],"xa":[11,15]}},{"tpl":"i14274","s":{"vit":[101,150],"cha":[31,50],"sa":[21,30],"cri":[4,5],"de":[9,12],"ini":[401,500],"rt":[5,7],"rf":[5,7],"xa":[7,10],"dcri":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('sousouriciere_rat_noir', 'Sousouricière du Rat Noir', 110, '{"k":275000,"res":{"Touffe de rat de Brâkmar":360,"Viande Séchée":153,"Crâne magique de Rate Atinée":31,"Oreille de Rat Plapla":31,"Pustule de Rat Sio":31,"Tuyau Rouillé de Rate Iboisée":31,"Vieux Bouquin de Rat Li":31,"Poil de Rat Brâkmarien":25},"eq":[{"tpl":"i25752","s":{"vit":[51,100],"age":[21,30],"sa":[11,20],"pui":[7,10],"cri":[3,5],"da":[3,5],"ini":[151,200]}}],"dj":1}'::jsonb, 'dj'),
('souvenir_imagiro', 'Souvenir d''Imagiro', 200, '{"k":500000,"res":{"Goutte d''encre indélébile":54,"Viande Goûtue":54,"Deuxième morceau de parchemin oublié":43,"Encre comestible":27,"Kianzhi de la Lance du Wukin":14,"Mots noircis":14,"Apostrophe de Fugokam":11,"Carapace circonflexe de Rokoram":11},"eq":[{"tpl":"i24037","s":{"vit":[401,450],"ine":[51,75],"sa":[31,40],"df":[15,18],"ini":[201,300],"rf":[5,7],"ra":[5,7]}},{"tpl":"i30682","s":{"vit":[201,250],"fo":[51,70],"age":[51,70],"sa":[31,40],"cri":[-3,-3],"rt":[6,8],"ra":[6,8],"rf":[-3,-3],"re":[-3,-3]}},{"tpl":"i24028","s":{"vit":[401,500],"fo":[61,80],"age":[61,80],"sa":[31,50],"cri":[-3,-3],"dt":[11,15],"da":[11,15],"rf":[3,5],"re":[3,5]}},{"tpl":"i24027","s":{"vit":[351,400],"fo":[51,70],"age":[51,70],"sa":[21,30],"cri":[-4,-4],"dt":[9,12],"da":[9,12],"rf":[7,10],"re":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('taniere_givrefoux', 'Tanière Givrefoux', 170, '{"k":425000,"res":{"Grain de Malice":450,"Lys Ander":450,"Oueille":450,"Pollenectar":450,"Dentier de Givrefoux":360,"Givranchy":360,"Viande Maigre":86,"Le rube":54},"eq":[{"tpl":"i11757","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"sa":[31,40],"cri":[4,5],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[5,7],"pp":[7,10],"rn":[7,10]}},{"tpl":"i11732","s":{"vit":[201,250],"cha":[41,60],"age":[41,60],"sa":[31,40],"cri":[-4,-3],"de":[7,10],"da":[7,10],"pp":[16,25],"rf":[5,7]}},{"tpl":"i12057","s":{"vit":[251,300],"ine":[41,60],"sa":[31,50],"df":[7,10],"de":[7,10],"da":[7,10],"so":[7,10],"pp":[11,20],"rt":[7,10],"xa":[7,10]}},{"tpl":"i11745","s":{"vit":[151,200],"fo":[31,50],"age":[31,50],"sa":[31,40],"cri":[2,3],"dn":[7,10],"dt":[7,10],"da":[7,10],"pp":[11,20],"ini":[301,400],"rf":[7,10],"xa":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('taniere_meulou', 'Tanière du Meulou', 100, '{"k":250000,"res":{"Oueille":450,"Pollenectar":450,"Viande Exsudative":135,"Papatte de Croc Gland":32,"Viande Avariée":32,"Canine de Mergranlou":27,"Griffe de Muloubard":27,"Poils de Mulounoké":27},"eq":[{"tpl":"i1128","s":{"vit":[41,60],"fo":[41,50],"cha":[-50,-50],"age":[41,50],"cri":[4,5],"do":[4,5]}},{"tpl":"i14277","s":{"age":[31,40],"sa":[21,30],"cri":[2,3],"rf":[4,6],"ra":[4,6],"dcri":[7,10]}},{"tpl":"i15997","s":{"ine":[31,40],"sa":[16,25],"df":[4,5],"so":[4,5]}},{"tpl":"i18689","s":{"vit":[71,90],"fo":[21,30],"age":[21,30],"rn":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('tempete_eliocalypse', 'Tempête de l''Eliocalypse', 200, '{"k":500000,"res":{"Oueille":450,"Viande Goûtue":54,"Capuche d''Armécréante":14,"Clé des entraves":14,"Fragment d''armure":14,"Langue de Pistilangue":14,"Épaulière de Ferrailleur":14,"Collier d''esclave":2},"dj":1}'::jsonb, 'dj'),
('temple_kao', 'Temple du dieu Kao', 200, '{"k":500000,"res":{"Preuve de fiabilité":450,"Viande Goûtue":54,"Image de collection":32,"Chaudron de Températurge":11,"Diadème de Chocoligarque":11,"Mèche de Pralicienne":11,"Peau de Torréfactueur":11,"Toque de Cabosseur":11},"eq":[{"tpl":"i20924","s":{"vit":[351,400],"cha":[31,50],"age":[31,50],"sa":[21,30],"pa":[1,1],"de":[7,10],"da":[7,10],"pp":[7,10],"rn":[7,10],"ra":[4,7]}},{"tpl":"i20956","s":{"vit":[351,400],"cha":[41,60],"age":[41,60],"sa":[21,25],"de":[9,12],"da":[9,12],"ini":[201,300],"rt":[4,7],"rf":[4,7],"dcri":[-20,-20]}},{"tpl":"i20926","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"cha":[31,40],"age":[31,40],"sa":[31,40],"rn":[7,10],"rt":[7,10]}},{"tpl":"i20925","s":{"vit":[401,450],"fo":[31,50],"ine":[31,50],"sa":[21,30],"dt":[7,10],"df":[7,10],"pp":[7,10],"rn":[4,7],"re":[4,7],"ra":[4,7]}}],"dj":1}'::jsonb, 'dj'),
('temple_koutoulou', 'Temple de Koutoulou', 200, '{"k":500000,"res":{"Page indéchiffrable":450,"Tentacule Agité":450,"Viande Goûtue":54,"P''Koutoulou Ch''ton":27,"P''Koutoulou Glaakiph":27,"P''Koutoulou Zothoth":27,"Crâne de centoror mouillé":23,"Flûte de Klûtiste":11},"eq":[{"tpl":"i18015","s":{"vit":[301,350],"fo":[41,60],"cha":[41,60],"sa":[31,40],"cri":[4,6],"dn":[9,12],"dt":[9,12],"de":[9,12],"pp":[11,15],"rf":[7,10]}},{"tpl":"i18003","s":{"vit":[401,500],"ine":[81,100],"sa":[41,60],"df":[14,18],"so":[11,15],"pp":[11,15],"rn":[5,7],"ra":[5,7]}},{"tpl":"i18000","s":{"vit":[301,350],"fo":[51,70],"sa":[21,30],"cri":[2,2],"pa":[1,1],"dn":[9,12],"dt":[9,12],"rf":[7,10],"ra":[7,10]}},{"tpl":"i18028","s":{"vit":[301,350],"dn":[16,20],"dt":[16,20],"df":[16,20],"de":[16,20],"da":[16,20],"rf":[5,7],"ra":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('temple_ougah', 'Temple du Grand Ougah', 180, '{"k":450000,"res":{"Oueille":394,"Pollenectar":394,"Restes de Fungus":225,"Viande Gâtée":57,"Roupie de Champ à Gnons":56,"Thalle de Champmane":56,"Échantillon de Fungus":34,"Viande Faisandée":31},"eq":[{"tpl":"i6919","s":{"vit":[16,20]}},{"tpl":"i6922","s":{"vit":[21,30]}},{"tpl":"i6920","s":{"vit":[16,20]}},{"tpl":"i6921","s":{"vit":[21,30]}}],"dj":1}'::jsonb, 'dj'),
('terrier_wa_wabbit', 'Terrier du Wa Wabbit', 80, '{"k":200000,"res":{"Viande Sanguinolente":185,"Carte en bois : Ciseaux":58,"Carte en bois : Feuille":58,"Carte en bois : Pierre":58,"Bâton de Blanc Pa Wabbit":37,"Casque de Wobot":37,"Estomac de Black Wo Wabbit":37,"Lunettes de Tiwobot":37},"dj":1}'::jsonb, 'dj'),
('tertre_long_sommeil', 'Tertre du long sommeil', 150, '{"k":375000,"res":{"Oueille":450,"Pollenectar":450,"Baie maléfique":360,"Viande de Brousse":108,"Bolas de Maltrio":22,"Corne de Malbois":22,"Pic de Malépik":22,"Porte-bonheur de Malalfa":22},"eq":[{"tpl":"i26309","s":{"vit":[201,250],"sa":[16,25],"so":[16,20],"rf":[5,7],"ra":[5,7]}},{"tpl":"i8842","s":{"vit":[-150,-101],"ine":[61,80],"sa":[31,50],"pui":[11,15],"cri":[4,5],"do":[11,15],"pp":[11,20],"ini":[301,500],"rf":[9,14],"xf":[9,14]}},{"tpl":"i26308","s":{"vit":[151,200],"sa":[21,30],"so":[7,10],"rn":[5,7]}},{"tpl":"i26310","s":{"vit":[201,250],"sa":[31,40],"so":[21,30],"ini":[251,400],"rt":[5,7],"re":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('theatre_dramak', 'Théâtre de Dramak', 100, '{"k":250000,"res":{"Oueille":450,"Pollenectar":450,"Viande Exsudative":164,"Patte de Bouledogre":33,"Plume de Gobvious":33,"Dent de Molette":32,"Oreille de Rhinoféroce":32,"Oreille de Bouledogre":6},"eq":[{"tpl":"i14581","s":{"vit":[81,120],"pui":[21,30],"cri":[3,4],"dt":[4,6],"df":[4,6],"de":[4,6],"da":[4,6]}},{"tpl":"i14582","s":{"vit":[71,100],"cha":[31,40],"sa":[16,20],"cri":[2,3],"de":[2,3],"pp":[11,15],"ra":[4,5]}},{"tpl":"i14579","s":{"vit":[101,150],"cha":[31,40],"age":[31,40],"cri":[3,4],"rt":[4,6],"rf":[4,6]}},{"tpl":"i33588","s":{"vit":[101,130],"cha":[41,50],"sa":[16,20],"cri":[3,4],"de":[5,8],"so":[3,4],"re":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('tofulailler_royal', 'Tofulailler Royal', 120, '{"k":300000,"res":{"Oueille":281,"Pollenectar":281,"Viande Saignante":89,"Phéromone de Tofu":56,"Plume de Tofu":29,"Viande Faisandée":29,"Bec de Vilain Petit Tofu":19,"Plumeau de Tofuzmo":18},"eq":[{"tpl":"i708","s":{"cha":[31,40],"cri":[2,2]}},{"tpl":"i953","s":{"age":[31,60],"sa":[-30,-30],"pa":[-1,-1]}},{"tpl":"i1665","s":{"vit":[31,40],"ine":[21,30],"sa":[21,25],"pui":[16,20],"so":[4,5]}},{"tpl":"i7121","s":{"vit":[21,30],"pui":[11,15],"ini":[101,150],"re":[2,2],"ra":[2,2]}}],"dj":1}'::jsonb, 'dj'),
('tombe_tofugawa', 'Tombe du Shogun Tofugawa', 160, '{"k":400000,"res":{"Pollenectar":450,"Viande Fraîche":99,"Croissant de Tsukinochi":20,"Fleur d''Onabu-Geisha":20,"Os de Jiangshi-Nobi":20,"Plastron de Tambouraï":20,"Épaulière de Kabushido":20,"Étoffe de Samouraï fantôme":16},"eq":[{"tpl":"i23620","s":{"vit":[201,250],"fo":[31,40],"ine":[31,40],"cha":[16,20],"sa":[26,35],"cri":[-10,-10],"dn":[7,10],"dt":[7,10],"df":[7,10],"de":[4,5],"pp":[21,25],"re":[4,6]}},{"tpl":"i23621","s":{"vit":[111,160],"fo":[26,35],"ine":[26,35],"cha":[26,35],"sa":[16,25],"rn":[3,4],"rt":[3,4],"rf":[3,4],"re":[3,4]}},{"tpl":"i23626","s":{"vit":[151,200],"fo":[41,50],"ine":[41,50],"age":[41,50],"sa":[16,20],"cri":[2,3],"pa":[1,1],"dn":[5,7],"dt":[5,7],"df":[5,7],"da":[5,7],"ini":[-200,-200],"rf":[4,5],"dcri":[7,10]}},{"tpl":"i23618","s":{"vit":[151,200],"fo":[41,60],"ine":[31,40],"cha":[41,60],"sa":[21,30],"cri":[-10,-10],"dn":[7,10],"dt":[7,10],"df":[4,5],"de":[7,10],"pp":[16,20],"rf":[4,5]}}],"dj":1}'::jsonb, 'dj'),
('tour_bethel', 'Tour de Bethel', 200, '{"k":500000,"res":{"Parasite de Crânonier":90,"Parasite de Funespadon":90,"Parasite de Macrab":90,"Parasite de Tournoyé":90,"Viande Goûtue":54,"Éclat d''océan":54,"Mycose Infectieuse":43,"Aquarakne de Crânonier":11},"eq":[{"tpl":"i20391","s":{"vit":[351,400],"ine":[51,70],"cha":[51,70],"sa":[21,30],"df":[16,20],"de":[16,20],"pp":[11,15],"rn":[5,7],"rt":[5,7]}},{"tpl":"i19604","s":{"vit":[301,400],"fo":[61,80],"cha":[61,80],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"de":[11,15],"rf":[7,10],"re":[7,10]}},{"tpl":"i19599","s":{"vit":[301,350],"age":[61,80],"sa":[31,40],"cri":[3,4],"da":[11,15],"pp":[11,15],"rt":[7,10],"re":[7,10],"dcri":[9,12]}},{"tpl":"i19608","s":{"vit":[201,250],"sa":[31,40],"pui":[31,40],"rf":[5,7],"re":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('tour_solar', 'Tour de Solar', 200, '{"k":500000,"res":{"Essence brûlante de calciné":450,"Pollenectar":450,"Cœur de Calciné":360,"Pierre Ardente de Calciné":360,"Âme de Calciné":360,"Viande Goûtue":54,"Dent de Klémort":11,"Grenade de Moribombe":11},"eq":[{"tpl":"i20465","s":{"vit":[301,350],"ine":[61,80],"cha":[61,80],"sa":[31,40],"cri":[-10,-10],"df":[11,15],"de":[11,15],"re":[7,10],"ra":[7,10]}},{"tpl":"i19592","s":{"vit":[301,350],"fo":[41,60],"ine":[41,60],"sa":[31,40],"cri":[3,4],"dn":[7,10],"dt":[7,10],"df":[7,10],"so":[9,12],"re":[5,7],"ra":[5,7]}},{"tpl":"i19589","s":{"vit":[351,400],"ine":[51,70],"sa":[31,50],"cri":[-10,-10],"df":[11,15],"so":[7,10],"pp":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i19585","s":{"vit":[301,350],"ine":[61,80],"sa":[31,40],"cri":[-10,-10],"df":[11,15],"so":[9,12],"pp":[11,15],"rt":[7,10],"ra":[7,10]}}],"dj":1}'::jsonb, 'dj'),
('transporteur_sylargh', 'Transporteur de Sylargh', 200, '{"k":500000,"res":{"Morceau de Brikoléreux":450,"Pollenectar":450,"Planche renforcée":360,"Viande Goûtue":54,"Astragale de Mécanofoux":11,"Bec de Mansordide":11,"Canine de Kanimate":11,"Maxillaire de Brikoglours":11},"eq":[{"tpl":"i14074","s":{"vit":[301,350],"ine":[21,30],"cha":[21,30],"age":[21,30],"sa":[41,60],"df":[7,10],"de":[7,10],"da":[7,10],"pp":[11,15],"rn":[7,10],"rt":[7,10]}},{"tpl":"i13894","s":{"vit":[301,350],"ine":[41,60],"age":[31,40],"sa":[31,40],"cri":[3,4],"df":[8,12],"da":[14,18],"pp":[7,10],"rt":[5,7],"rf":[5,7],"xa":[7,10]}},{"tpl":"i14132","s":{"vit":[351,400],"fo":[31,50],"ine":[31,50],"age":[31,50],"sa":[31,40],"dt":[11,15],"df":[11,15],"da":[11,15],"re":[7,10]}},{"tpl":"i14171","s":{"vit":[251,300],"fo":[31,50],"ine":[31,50],"sa":[21,30],"dt":[10,14],"df":[10,14],"so":[11,15],"pp":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('trone_cour_sombre', 'Trône de la Cour Sombre', 200, '{"k":500000,"res":{"Bourse de la Cour Sombre":360,"Viande Goûtue":54,"Crâne de centoror volé":23,"Étoffe de la Cour Sombre":18,"Tête de mort":14,"Chouchou de Doublure":11,"Crâne magique de Magouille":11,"Mèche de bombe de Terristocrate":11},"eq":[{"tpl":"i15438","s":{"vit":[251,300],"ine":[41,60],"cha":[41,60],"age":[41,60],"sa":[31,50],"cri":[2,3],"df":[9,12],"de":[9,12],"da":[9,12],"rt":[7,10]}},{"tpl":"i15429","s":{"vit":[301,350],"fo":[41,60],"sa":[31,40],"cri":[3,4],"dn":[11,15],"dt":[11,15],"pp":[11,15],"ini":[301,600],"rf":[7,10]}},{"tpl":"i15493","s":{"vit":[351,400],"fo":[51,70],"cha":[51,70],"sa":[31,40],"dn":[16,20],"dt":[16,20],"de":[16,20],"rf":[7,10]}},{"tpl":"i30857","s":{"vit":[301,350],"ine":[51,70],"age":[51,70],"sa":[31,40],"df":[11,15],"da":[11,15],"pp":[11,15],"ini":[301,400],"rf":[5,7],"ra":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('trone_sang', 'Trône de Sang', 200, '{"k":500000,"res":{"Oueille":450,"Viande Goûtue":54,"Canine tranchante":11,"Fragment d''armure":11,"Linothorax":11,"Sang coagulé":11,"Étoffe sanglante":11,"Lame tranchante":9},"eq":[{"tpl":"i30943","s":{"vit":[251,300],"ine":[36,66],"sa":[21,30],"cri":[2,3],"df":[9,12],"rt":[3,6],"rf":[3,6]}},{"tpl":"i30861","s":{"vit":[301,350],"ine":[66,99],"sa":[21,30],"cri":[3,6],"df":[9,12],"rn":[5,9],"rf":[9,12],"re":[-3,-3],"xe":[-11,-11]}}],"dj":1}'::jsonb, 'dj'),
('vaisseau_meno', 'Vaisseau du Capitaine Meno', 200, '{"k":500000,"res":{"Chair aquatique":450,"Sable de Wakfu":113,"Greuvette centenaire":86,"Viande Goûtue":54,"Bave de Mol Usk":11,"Dent de Tilamproie":11,"Pince de Crabe Yoloniste":11,"Queue de Mantaze":11},"eq":[{"tpl":"i18001","s":{"vit":[301,400],"ine":[81,100],"sa":[31,50],"cri":[3,4],"pa":[1,1],"df":[11,15],"so":[7,10],"rt":[7,10]}},{"tpl":"i18011","s":{"vit":[301,350],"ine":[41,60],"age":[41,60],"sa":[31,40],"cri":[3,4],"df":[9,12],"da":[9,12],"rt":[5,7],"re":[7,10]}},{"tpl":"i18018","s":{"vit":[301,400],"fo":[61,80],"sa":[31,40],"cri":[3,4],"dn":[16,20],"dt":[16,20],"ra":[7,10]}},{"tpl":"i18024","s":{"vit":[351,400],"ine":[31,50],"cha":[31,50],"sa":[31,40],"cri":[4,5],"df":[9,12],"de":[9,12],"so":[9,12],"re":[7,10],"dcri":[11,15]}}],"dj":1}'::jsonb, 'dj'),
('vallee_dame_eaux', 'Vallée de la Dame des eaux', 130, '{"k":325000,"res":{"Oueille":450,"Pollenectar":450,"Viande Persillée":131,"Akaslip d''Akakwa":26,"Concombre":26,"Katana de Kwamouraï":26,"Salopette Kwapa":26,"Sarbacane en Bambou":26},"dj":1}'::jsonb, 'dj'),
('ventre_baleine', 'Ventre de la Baleine', 200, '{"k":500000,"res":{"Oueille":450,"Pollenectar":450,"Kroboplasme de Bacterrib":90,"Kroboplasme de Tabacille":90,"Kroboplasme de Verminocule":90,"Kroboplasme de Virustine":90,"Le rube":54,"Viande Goûtue":54},"eq":[{"tpl":"i15698","s":{"vit":[251,300],"sa":[31,40],"cri":[3,4],"rt":[5,7],"ra":[5,7]}},{"tpl":"i15693","s":{"vit":[301,350],"ine":[41,60],"cha":[41,60],"sa":[31,40],"pa":[1,1],"df":[9,12],"de":[9,12],"ra":[7,10],"dcri":[11,15]}},{"tpl":"i15699","s":{"vit":[301,350],"sa":[31,40],"pui":[31,50],"cri":[3,4],"pa":[1,1],"pp":[11,15],"rn":[7,10],"re":[7,10],"dcri":[16,20]}},{"tpl":"i15694","s":{"vit":[351,400],"cha":[41,50],"sa":[31,40],"pui":[11,15],"cri":[3,4],"pa":[1,1],"de":[11,15],"pp":[11,15],"rn":[5,7],"rf":[5,7]}}],"dj":1}'::jsonb, 'dj'),
('village_kanniboul', 'Village Kanniboul', 60, '{"k":150000,"res":{"Oueille":450,"Pollenectar":450,"Viande Ladre":207,"Corde en liane":54,"Poupée Vaudou Ark":41,"Poupée Vaudou Eth":41,"Poupée Vaudou Jav":41,"Poupée Vaudou Sarbak":41},"eq":[{"tpl":"i10635","s":{"cha":[16,25],"do":[1,2]}},{"tpl":"i10636","s":{"cha":[16,25],"sa":[6,10],"cri":[2,3]}}],"dj":1}'::jsonb, 'dj'),
('voliere_haute_truche', 'Volière de la Haute Truche', 130, '{"k":325000,"res":{"Morceau de Truche":450,"Oueille":450,"Pollenectar":450,"Cuisse de truche":360,"Viande Persillée":133,"Truchmuche":90,"Duvet de Truchon":27,"Plume de Truchideur":27},"eq":[{"tpl":"i7159","s":{"vit":[201,250],"cha":[31,50],"age":[31,50],"sa":[16,25],"rn":[5,7],"xn":[5,7]}},{"tpl":"i15357","s":{"vit":[101,150],"ine":[31,40],"sa":[16,25],"df":[5,7],"ini":[401,600],"rn":[7,10],"xe":[9,12]}},{"tpl":"i15359","s":{"vit":[101,150],"age":[31,50],"sa":[21,30],"cri":[3,4],"da":[5,7],"pp":[11,15],"rf":[7,10]}}],"dj":1}'::jsonb, 'dj')
on conflict (sid) do update set name = excluded.name, lvl = excluded.lvl, cap = excluded.cap, kind = excluded.kind;

reset search_path;

-- ======================== supabase/gboss.sql ========================
set search_path = s1, public;
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

create table if not exists s1.gboss_hits (
  id bigint generated always as identity primary key,
  w int not null,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  n int not null,                 -- numéro de l'essai dans la semaine (fixe le hasard)
  day date not null,              -- jour de Paris
  points int not null, raw int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null default now(),
  unique (user_id, w, n)
);
create index if not exists gboss_hits_g on s1.gboss_hits (w, guild_id);
alter table s1.gboss_hits enable row level security;

-- coffres ouverts et titres reçus (1.0.30 : 1001 à 1004 = coffres des phases 1 à 4, 1100 = première guilde
-- à finir le boss, 1200 = Conquérant, 1300 = Ombre de la nuit (Chasse aux Percepteurs) ; 0 = 3 meilleures guildes ; 25 à 100 = anciens paliers)
create table if not exists s1.gboss_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null, step int not null,
  at timestamptz not null default now(),
  primary key (user_id, w, step)
);
alter table s1.gboss_claims enable row level security;

-- 1.0.30 : réserve d'essais du boss (t essais au moment at, +1 toutes les 25 min, 6 au plus)
create table if not exists s1.gboss_charge (
  user_id uuid primary key references auth.users (id) on delete cascade,
  t real not null default 6,
  at timestamptz not null default now()
);
alter table s1.gboss_charge enable row level security;
-- 1.0.30 : vie du boss de chaque guilde, figée à la première frappe de la semaine
create table if not exists s1.gboss_goal (
  w int not null, guild_id bigint not null references s1.guilds (id) on delete cascade, goal int not null,
  primary key (w, guild_id)
);
alter table s1.gboss_goal enable row level security;
-- 1.0.33 : ressource du boss (coffres des phases 1 à 4) et équipements de son donjon (Coffre du trophée), envoyés par la fonction « record »
alter table s1.gboss_goal add column if not exists res text;
alter table s1.gboss_goal add column if not exists eq jsonb;
-- 1.0.30 : phases tombées
create table if not exists s1.gboss_phase (
  w int not null, guild_id bigint not null references s1.guilds (id) on delete cascade, phase int not null,
  at timestamptz not null default now(),
  primary key (w, guild_id, phase)
);
alter table s1.gboss_phase enable row level security;
-- 1.0.30 : trophées (boss de la semaine fini) ; first = première guilde du serveur à le finir
create table if not exists s1.guild_trophies (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  w int not null, first boolean not null default false,
  at timestamptz not null default now(),
  unique (guild_id, w)
);
alter table s1.guild_trophies enable row level security;

create table if not exists s1.guild_percos (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
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
alter table s1.guild_percos add column if not exists shield_until timestamptz; -- 1.0.30 : bouclier de 6 h après une attaque
alter table s1.guild_percos enable row level security;
-- 1.0.30 (choix 8A) : un seul Percepteur par zone sur tout le serveur. L'index n'est posé que si les données le
-- permettent (sinon tools/serveur/guildes_reset.sql le pose après la remise à zéro) ; perco_place vérifie aussi.
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname = 's1' and indexname = 'guild_percos_sid')
     and not exists (select 1 from s1.guild_percos group by sid having count(*) > 1) then
    create unique index guild_percos_sid on s1.guild_percos (sid);
  end if;
end $$;

-- 1.0.30 : Percepteurs assommés (la place ne sert pas pendant 12 h) et zones gardées par la guilde gagnante (1 h)
create table if not exists s1.perco_ko (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  sid text not null, until timestamptz not null
);
create index if not exists perco_ko_g on s1.perco_ko (guild_id, until);
alter table s1.perco_ko enable row level security;
create table if not exists s1.perco_hold (
  sid text primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  until timestamptz not null
);
alter table s1.perco_hold enable row level security;

-- 1.0.30 : attaques entre guildes. status : open (les défenseurs ont jusqu'à ends), fight (le Percepteur se défend),
-- repelled (un défenseur a gagné), won (l'attaquant a pillé), lost (le Percepteur a gagné).
create table if not exists s1.perco_raids (
  id bigint generated always as identity primary key,
  perco_id bigint not null,
  sid text not null,
  def_guild bigint not null references s1.guilds (id) on delete cascade,
  att_guild bigint not null references s1.guilds (id) on delete cascade,
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
create index if not exists perco_raids_def on s1.perco_raids (def_guild, id desc);
create index if not exists perco_raids_att on s1.perco_raids (att_guild, id desc);
create index if not exists perco_raids_user on s1.perco_raids (att_user, at desc);
create index if not exists perco_raids_perco on s1.perco_raids (perco_id, status);
alter table s1.perco_raids enable row level security;
-- « Chasse aux Percepteurs » (choix 6A à 10A de Mathis) :
-- vétérans (une étoile par attaque de guilde repoussée, 5 au plus, perdues au pillage), revanche (attaque gratuite,
-- butin +25 %), Nuit des Percepteurs (samedi 20 h-23 h, Paris : butin ×1,5), primes payées par le coffre.
alter table s1.guild_percos add column if not exists stars int not null default 0;
alter table s1.perco_raids add column if not exists free boolean not null default false;  -- revanche : ne compte pas dans les attaques du jour
alter table s1.perco_raids add column if not exists bonus real not null default 1;         -- butin ×1,25 (revanche), ×1,5 (nuit)
alter table s1.perco_raids add column if not exists night boolean not null default false; -- lancée pendant la Nuit des Percepteurs
-- revanche : la guilde guild_id a été pillée par target ; chaque membre peut l'attaquer une fois jusqu'à until
create table if not exists s1.perco_revenge (
  id bigint generated always as identity primary key,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  target bigint not null references s1.guilds (id) on delete cascade,
  sid text not null,
  at timestamptz not null default now(),
  until timestamptz not null
);
create index if not exists perco_revenge_g on s1.perco_revenge (guild_id, until);
alter table s1.perco_revenge enable row level security;
-- primes (avis de recherche) : k kamas pris au coffre de by_guild, versés à celui qui pille le Percepteur avant until
create table if not exists s1.perco_bounty (
  id bigint generated always as identity primary key,
  perco_id bigint not null,
  sid text not null,
  def_guild bigint references s1.guilds (id) on delete cascade,
  by_guild bigint not null references s1.guilds (id) on delete cascade,
  by_user uuid references auth.users (id) on delete set null,
  k bigint not null,
  at timestamptz not null default now(),
  until timestamptz not null,
  done text check (done in ('paid', 'back'))
);
create index if not exists perco_bounty_p on s1.perco_bounty (perco_id) where done is null;
alter table s1.perco_bounty enable row level security;
-- 1.0.30 : Guerre des Percepteurs, classement de la semaine (3 points par attaque gagnée, 1 par attaque repoussée)
create table if not exists s1.perco_war (
  w int not null, guild_id bigint not null references s1.guilds (id) on delete cascade,
  pts int not null default 0, win int not null default 0, loss int not null default 0, def int not null default 0,
  primary key (w, guild_id)
);
alter table s1.perco_war enable row level security;

-- ---------- outils internes ----------
create or replace function s1.gb_day() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;
-- même semaine que E.gbossWeek (js/gboss.js) : jours depuis le 1er janvier 1970 (un jeudi), ramenés au lundi
create or replace function s1.gb_week() returns int language sql stable as $$ select ((gb_day() - date '1970-01-01') + 3) / 7 $$;
-- 1.0.33 : membres actifs (E.GBOSS_ACTIVE_DAYS) : partie en ligne envoyée, ou arrivée dans la guilde, depuis moins de 14 jours
create or replace function s1.gb_active(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select count(*)::int from guild_members m left join saves s on s.user_id = m.user_id
  where m.guild_id = g and (m.joined_at > now() - interval '14 days' or s.updated_at > now() - interval '14 days') $$;
-- vie du boss (E.gbossGoal) : 1.0.33 : 15 000 par membre actif (1.0.30 : 25 000 par membre), au moins 3 comptés, figée à la première frappe de la semaine
create or replace function s1.gb_goalw(g bigint, wk int) returns int language sql stable security definer set search_path = s1, public
as $$ select coalesce((select goal from gboss_goal where w = wk and guild_id = g), 15000 * greatest(3, gb_active(g))) $$;
create or replace function s1.gb_goal(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select gb_goalw(g, gb_week()) $$;
-- phases tombées pour pts points (seuils cumulés 8, 22, 42, 68 et 100 % : E.gbossThr) ;
-- 1.0.33 : puis une phase Ultime tous les 10 % de la vie (E.gbossPhase)
create or replace function s1.gb_nph(pts bigint, goal int) returns int language sql immutable
as $$ select case when pts >= goal then 5 + floor((pts - goal)::numeric / greatest(1, floor(goal::numeric * 10 / 100)))::int
  else (select count(*)::int from unnest(array[8, 22, 42, 68, 100]) c where pts >= floor(goal::numeric * c / 100)) end $$;
-- kamas versés au coffre quand la phase tombe (E.GBOSS_PHASE_K)
create or replace function s1.gb_phase_k(p int) returns bigint language sql immutable
as $$ select (array[300000, 600000, 900000, 1200000, 1500000]::bigint[])[greatest(1, least(5, p))] $$;
-- minutes pour un essai (1.0.33 : 120, Cor de ralliement : 100 ; avant 25 et 20)
create or replace function s1.gb_every(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select case when g_up(g, 'cor') > 0 then 100 else 120 end $$;
-- essais en réserve (E.gbossTok) ; une première fois : réserve pleine (1.0.33 : 12 au plus, 24 h)
create or replace function s1.gb_tok(u uuid, g bigint) returns real language sql stable security definer set search_path = s1, public
as $$ select least(12, coalesce(c.t, 12) + extract(epoch from (now() - coalesce(c.at, now()))) / (gb_every(g) * 60.0))::real
  from (select 1) x left join gboss_charge c on c.user_id = u $$;
create or replace function s1.gb_pts(g bigint, wk int) returns bigint language sql stable security definer set search_path = s1, public
as $$ select coalesce(sum(points), 0)::bigint from gboss_hits where guild_id = g and w = wk $$;
-- même coffre que E.gbossChest (step 25, 50, 75, 100 = phases 1 à 4) ; 1.0.33 : kamas ×4, n = ressources du boss (5 × la phase)
create or replace function s1.gb_chest(step int, lvl int) returns jsonb language sql immutable
as $$ select jsonb_build_object('k', round((1000 + lvl * 250) * (step / 25) * 4), 'res', jsonb_build_object('Poussière de stasis', 15 * (step / 25)), 'n', 5 * (step / 25)) $$;
-- course entre guildes d'une semaine : phases tombées, puis points
create or replace function s1.gb_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(x order by x.ph desc, x.pts desc), '[]'::jsonb) from (
  select g.id, g.name, g.ic, g.col, g.lvl, sum(h.points)::bigint pts, count(distinct h.user_id) who,
    (select count(*) from gboss_phase p where p.w = wk and p.guild_id = g.id)::int ph
  from gboss_hits h join guilds g on g.id = h.guild_id where h.w = wk group by g.id order by ph desc, pts desc limit lim) x $$;
-- XP de guilde gagnée hors combats (Percepteurs, boss)
create or replace function s1.g_addxp(g bigint, x bigint) returns void language plpgsql security definer set search_path = s1, public
as $$
declare gg guilds; nl int;
begin
  if x <= 0 then return; end if;
  update guilds set xp = xp + x where id = g returning * into gg;
  nl := g_lvl(gg.xp);
  if nl > gg.lvl then update guilds set lvl = nl where id = g; perform g_log(g, 'La guilde passe au niveau ' || nl || ' !'); end if;
end $$;

-- 1.0.30 : poche pleine en 12 h (10 h avec le Percepteur doré)
create or replace function s1.pc_fillsec(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select case when g_up(g, 'percodore') > 0 then 36000 else 43200 end $$;
-- poche actuelle d'un Percepteur (1 = pleine ; une défense réussie contre les monstres peut la faire dépasser)
create or replace function s1.pc_fill(p guild_percos) returns real language sql stable
as $$ select case when p.pk >= 1 then p.pk else least(1, p.pk + extract(epoch from (now() - p.pk_at)) / pc_fillsec(p.guild_id))::real end $$;
create or replace function s1.pc_name(s text) returns text language sql stable security definer set search_path = s1, public
as $$ select coalesce((select name from perco_zones where sid = s), s) $$;
create or replace function s1.pc_kind(s text) returns text language sql stable security definer set search_path = s1, public
as $$ select coalesce((select kind from perco_zones where sid = s), 'zone') $$;
-- prochaine attaque de monstres : environ une fois par jour (deux fois plus souvent en donjon)
create or replace function s1.pc_next(s text) returns timestamptz language sql volatile security definer set search_path = s1, public
as $$ select now() + case when pc_kind(s) = 'dj' then interval '9 hours' + random() * interval '6 hours' else interval '18 hours' + random() * interval '12 hours' end $$;
-- 1.0.30 : ce que donne une poche remplie à f (même calcul que E.percoGain) : Poche +10 % par rang,
-- Prospection +10 % par rang sur les ressources rares (moins de 50 dans une poche pleine)
create or replace function s1.pc_gain(cap jsonb, fr double precision, ups jsonb) returns jsonb language plpgsql immutable
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
create or replace function s1.pc_item(cap jsonb) returns jsonb language plpgsql volatile
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
create or replace function s1.pc_slots(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select least(5, 1 + (select lvl from guilds where id = g) / 5) + case when g_up(g, 'qg') > 0 then 1 else 0 end $$;
create or replace function s1.pc_used(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select ((select count(*) from guild_percos where guild_id = g) + (select count(*) from perco_ko where guild_id = g and until > now()))::int $$;
-- une attaque entre guildes est en cours sur ce Percepteur
create or replace function s1.pc_raided(pid bigint) returns boolean language sql stable security definer set search_path = s1, public
as $$ select exists (select 1 from perco_raids where perco_id = pid and status in ('open', 'fight')) $$;
-- Attaques de monstres : une nouvelle commence quand l'heure est passée ET qu'un membre regarde la guilde
-- (personne n'est pillé sans avoir pu le voir) ; sans victoire en 2 h, la moitié de la poche est perdue
-- (1.0.30 : 3 % de moins par rang de Robustesse). Pas d'attaque de monstres pendant une attaque de guilde.
create or replace function s1.pc_tick(g bigint) returns void language plpgsql security definer set search_path = s1, public
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
create or replace function s1.pw_add(g bigint, p_pts int, p_win int, p_loss int, p_def int) returns void language sql security definer set search_path = s1, public
as $$ insert into perco_war (w, guild_id, pts, win, loss, def) values (gb_week(), g, p_pts, p_win, p_loss, p_def)
  on conflict (w, guild_id) do update set pts = perco_war.pts + excluded.pts, win = perco_war.win + excluded.win, loss = perco_war.loss + excluded.loss, def = perco_war.def + excluded.def $$;
create or replace function s1.pw_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(x order by x.pts desc, x.win desc, x.id), '[]'::jsonb) from (
  select g.id, g.name, g.ic, g.col, g.lvl, w.pts, w.win, w.loss, w.def from perco_war w join guilds g on g.id = w.guild_id
  where w.w = wk and w.pts > 0 order by w.pts desc, w.win desc, g.id limit lim) x $$;
-- attaques par jour : 3 (4 avec la Bannière de guerre)
-- Chasse aux Percepteurs (10A) : Nuit des Percepteurs, chaque samedi de 20 h à 23 h (heure de Paris) : butin ×1,5, boucliers des
-- Percepteurs réduits de moitié, une attaque de plus pour chacun ; titre « Ombre de la nuit » (gb_claim_do).
create or replace function s1.gb_nuit() returns boolean language sql stable
as $$ select extract(isodow from (now() at time zone 'Europe/Paris')) = 6 and extract(hour from (now() at time zone 'Europe/Paris')) between 20 and 22 $$;
-- fin du bouclier d'un Percepteur (moitié moins long la nuit)
create or replace function s1.pc_shield(p guild_percos) returns timestamptz language sql stable
as $$ select case when p.shield_until is null then null when gb_nuit() then p.shield_until - interval '3 hours' else p.shield_until end $$;
-- attaques par jour : 3 (4 avec la Bannière de guerre), +1 pendant la Nuit des Percepteurs
create or replace function s1.rd_max(g bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select case when g_up(g, 'banniere') > 0 then 4 else 3 end + case when gb_nuit() then 1 else 0 end $$;
-- Chasse aux Percepteurs : les revanches (free) ne comptent pas
create or replace function s1.rd_today(u uuid) returns int language sql stable security definer set search_path = s1, public
as $$ select count(*)::int from perco_raids where att_user = u and not free and at > now() - interval '30 hours' and (at at time zone 'Europe/Paris')::date = gb_day() $$;
-- Chasse aux Percepteurs (6A) : revanche encore possible pour ce joueur contre la guilde dg (la plus récente, pas encore utilisée)
create or replace function s1.rd_revenge(u uuid, g bigint, dg bigint) returns perco_revenge language sql stable security definer set search_path = s1, public
as $$ select v.* from perco_revenge v where v.guild_id = g and v.target = dg and v.until > now()
  and not exists (select 1 from perco_raids r where r.att_user = u and r.free and r.def_guild = dg and r.at >= v.at) order by v.until desc limit 1 $$;
-- Chasse aux Percepteurs (7A) : primes finies (3 jours passés, ou Percepteur parti sans pillage) : retour au coffre
create or replace function s1.pb_expire() returns void language plpgsql security definer set search_path = s1, public
as $$
declare b perco_bounty;
begin
  for b in select * from perco_bounty x where x.done is null and (x.until < now() or not exists (select 1 from guild_percos p where p.id = x.perco_id)) for update skip locked loop
    update perco_bounty set done = 'back' where id = b.id;
    perform g_chest(b.by_guild, b.k, format('Prime sur le Percepteur de %s : personne ne l''a pillé, elle revient au coffre', pc_name(b.sid)));
  end loop;
end $$;
-- une attaque vue par les deux guildes
create or replace function s1.rd_json(r perco_raids, me uuid) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select jsonb_build_object('id', r.id, 'pid', r.perco_id, 'sid', r.sid, 'zone', pc_name(r.sid), 'st', r.status, 'at', r.at, 'ends', r.ends, 'res', r.res,
  'by', pseudo_of(r.att_user), 'me', r.att_user = me, 'heads', r.att_heads, 'lvl', r.att_lvl,
  'ag', (select jsonb_build_object('id', id, 'name', name, 'ic', ic, 'col', col, 'lvl', lvl) from guilds where id = r.att_guild),
  'dg', (select jsonb_build_object('id', id, 'name', name, 'ic', ic, 'col', col, 'lvl', lvl) from guilds where id = r.def_guild),
  'tries', (select coalesce(jsonb_agg(jsonb_build_object('p', t->>'p', 'win', (t->>'win')::boolean, 'at', t->>'at', 'heads', t->'heads')), '[]'::jsonb) from jsonb_array_elements(r.tries) t),
  'tried', exists (select 1 from jsonb_array_elements(r.tries) t where t->>'u' = me::text)) $$;

-- Coffres et titres du boss et de la Guerre des Percepteurs (semaine en cours et semaine passée).
-- dry : seulement compter (pour afficher « à ouvrir »). Renvoie { n, k, dust, titles }.
create or replace function s1.gb_claim_do(me uuid, dry boolean) returns jsonb language plpgsql security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture : boss, Percepteurs et attaques de ma guilde ----------
create or replace function s1.guild_extra() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.gboss_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.perco_place(p_after bigint, p_sid text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.perco_collect(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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

create or replace function s1.perco_remove(p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.perco_map() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.guild_bounty(p_perco bigint, p_k bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon', f);
    execute format('grant execute on function s1.%s to authenticated', f);
  end loop;
end $$;

-- ---------- appelées par la fonction serveur « record » (clé de service) ----------
-- Boss : vérifie la réserve d'essais et donne le numéro de l'essai dans la semaine et la phase en cours.
create or replace function s1.gb_start(p_user uuid, p_w int) returns jsonb language plpgsql security definer set search_path = s1, public
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
drop function if exists s1.gb_done(uuid, int, int, int, int, int, int, int);
create or replace function s1.gb_done(p_user uuid, p_w int, p_n int, p_points int, p_raw int, p_lvl int, p_rounds int, p_alive int, p_res text default null, p_eq jsonb default null) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.pc_start(p_user uuid, p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.pc_done(p_user uuid, p_id bigint, p_aid bigint, p_win boolean) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.rd_open(p_user uuid, p_perco bigint, p_team jsonb, p_heads jsonb, p_lvl int) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare m guild_members := g_me(p_user); p guild_percos; dg guilds; ag guilds; ends timestamptz; rid bigint; z text; sh timestamptz; rv perco_revenge; fr boolean := false; nt boolean := gb_nuit(); bn real := 1;
begin
  if m.user_id is null then return g_err('Rejoins une guilde pour attaquer un Percepteur.'); end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) < 1 then return g_err('Choisis ton équipe d''arène (Kolizéum).'); end if;
  perform pg_advisory_xact_lock(hashtext('raid:' || p_perco));
  select * into p from guild_percos where id = p_perco for update; if not found then return g_err('Ce Percepteur n''est plus là.'); end if;
  if p.guild_id = m.guild_id then return g_err('C''est un Percepteur de ta guilde.'); end if;
  if to_regprocedure('s1.al_allied(bigint, bigint)') is not null then -- Alliances (9A) : les alliés ne s'attaquent pas (supabase/alliances.sql)
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
create or replace function s1.rd_def_start(p_user uuid, p_raid bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare m guild_members := g_me(p_user); r perco_raids;
begin
  select * into r from perco_raids where id = p_raid; if not found then return g_err('Cette attaque n''existe plus.'); end if;
  if m.user_id is null then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  if m.guild_id <> r.def_guild then -- Alliances (9A) : les guildes alliées défendent aussi (supabase/alliances.sql)
    if to_regprocedure('s1.al_allied(bigint, bigint)') is null then return g_err('Seuls les membres de la guilde attaquée défendent.'); end if;
    if not al_allied(m.guild_id, r.def_guild) then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  end if;
  if r.status <> 'open' or now() >= r.ends then return g_err('L''attaque est finie.'); end if;
  if exists (select 1 from jsonb_array_elements(r.tries) t where t->>'u' = p_user::text) then return g_err('Tu as déjà défendu pendant cette attaque.'); end if;
  return jsonb_build_object('ok', true, 'att', r.att_team, 'by', pseudo_of(r.att_user));
end $$;
create or replace function s1.rd_def_done(p_user uuid, p_raid bigint, p_win boolean, p_heads jsonb, p_rounds int) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare m guild_members := g_me(p_user); r perco_raids; z text;
begin
  perform pg_advisory_xact_lock(hashtext('raid:' || (select perco_id from perco_raids where id = p_raid)));
  select * into r from perco_raids where id = p_raid for update; if not found then return g_err('Cette attaque n''existe plus.'); end if;
  if m.user_id is null then return g_err('Seuls les membres de la guilde attaquée (et de son alliance) défendent.'); end if;
  if m.guild_id <> r.def_guild then -- Alliances (9A) : les guildes alliées défendent aussi (supabase/alliances.sql)
    if to_regprocedure('s1.al_allied(bigint, bigint)') is null then return g_err('Seuls les membres de la guilde attaquée défendent.'); end if;
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
create or replace function s1.rd_end_start(p_user uuid, p_raid bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
  if to_regprocedure('s1.al_prism_cover(bigint, text)') is not null then al := al_prism_cover(r.def_guild, r.sid); end if; -- Alliances (6A)
  return jsonb_build_object('ok', true, 'att', r.att_team, 'lvl', greatest(zl, r.att_lvl), 'rob', g_up(r.def_guild, 'robustesse'),
    'stars', (select stars from guild_percos where id = r.perco_id), -- Chasse aux Percepteurs (8A) : +2 % par étoile (E.percoGuards)
    'ally', al); -- Alliances (6A) : +20 % de PV dans une région du prisme de son alliance (E.allyPercoBoost)
end $$;
-- Résultat du combat contre le Percepteur et ses gardes : pillage (50 %, 25 % contre un Coffre-fort, ÷ 2 si la guilde
-- visée a 10 niveaux de moins), Percepteur renvoyé (sa guilde garde le reste de la poche), place assommée 12 h,
-- zone gardée 1 h pour la guilde gagnante, points de classement. Sinon : bouclier de 6 h.
create or replace function s1.rd_end_done(p_raid bigint, p_win boolean, p_rounds int) returns jsonb language plpgsql security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
    execute format('grant execute on function s1.%s to service_role', f);
  end loop;
end $$;

-- 1.0.33 : une seule fois, la vie du boss de la semaine en cours passe au nouveau calcul (15 000 par membre actif) :
-- les guildes qui avaient déjà frappé gardent leurs points ; les phases atteintes sont notées au prochain essai.
create table if not exists s1.gboss_resets (v text primary key, at timestamptz not null default now());
alter table s1.gboss_resets enable row level security;
do $$ begin
  if not exists (select 1 from gboss_resets where v = '1.0.33') then
    update gboss_goal set goal = 15000 * greatest(3, gb_active(guild_id)) where w = gb_week();
    insert into gboss_resets (v) values ('1.0.33');
  end if;
end $$;

reset search_path;

-- ======================== supabase/builds.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — builds partagés (1.0.23). Appliqué automatiquement par le workflow « Serveur en ligne »
-- après chat.sql (il s'appuie sur adm_need, alog, profiles, chat_sanctions) ; relançable sans danger.
-- Page Communauté › Builds : un joueur connecté avec Discord publie le build d'un de ses héros (30 au plus, 10 avant 1.0.25.2)
-- depuis la fenêtre « Partager le build » ; tout le monde, même sans compte, regarde, filtre et copie.
-- ❤ J'aime (un par compte, pas sur ses propres builds), vues (une par joueur et par build),
-- « Signaler » (caché dès 3 signalements, jusqu'à la décision de l'équipe dans le panel admin).
-- Le build lui-même est le code « IDLUS1-… » du jeu (js/engine.js, E.buildCode) : classe, niveau et objets
-- sont relus dans le code par le serveur, rien n'est cru sur parole. Personne ne lit les tables directement.
-- ============================================================================

create table if not exists s1.builds (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  pseudo text not null,
  hid int,
  cls text not null,
  lvl int not null check (lvl between 1 and 200),
  el text not null check (el in ('fo', 'ine', 'cha', 'age', 'multi')),
  bud text not null check (bud in ('abo', 'moy', 'pre')),
  tags text[] not null default '{}',
  title text not null check (length(title) between 4 and 60),
  note text not null default '' check (length(note) <= 300),
  code text not null check (length(code) <= 4000),
  items text[] not null default '{}',
  sex text not null default 'm' check (sex in ('m', 'f')),
  head int not null default 0,
  likes int not null default 0,
  views int not null default 0,
  reports int not null default 0,
  hidden boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists builds_user on s1.builds (user_id);
create index if not exists builds_cls_lvl on s1.builds (cls, lvl) where not hidden and not removed;
alter table s1.builds enable row level security; -- aucune règle : tout passe par les fonctions ci-dessous

create table if not exists s1.build_likes (
  build_id bigint not null references s1.builds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
create index if not exists build_likes_at on s1.build_likes (created_at);
alter table s1.build_likes enable row level security;

create table if not exists s1.build_views (
  build_id bigint not null references s1.builds (id) on delete cascade,
  who text not null,
  primary key (build_id, who)
);
alter table s1.build_views enable row level security;

create table if not exists s1.build_reports (
  build_id bigint not null references s1.builds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
alter table s1.build_reports enable row level security;

-- ---------- un build tel que la page le montre ----------
create or replace function s1.build_row(b s1.builds, wk bigint) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select jsonb_build_object('id', b.id, 'by', coalesce((select pseudo from profiles where id = b.user_id), b.pseudo), 'cls', b.cls, 'lvl', b.lvl,
    'el', b.el, 'bud', b.bud, 'tags', to_jsonb(b.tags), 'title', b.title, 'note', b.note, 'code', b.code, 'sex', b.sex, 'head', b.head,
    'likes', b.likes, 'wk', coalesce(wk, 0), 'views', b.views, 'at', b.updated_at, 'new', b.created_at,
    'liked', exists (select 1 from build_likes l where l.build_id = b.id and l.user_id = auth.uid()),
    'mine', coalesce(b.user_id = auth.uid(), false), 'hidden', case when b.user_id = auth.uid() then b.hidden else false end)
$$;
revoke all on function s1.build_row(s1.builds, bigint) from public, anon, authenticated;

-- ---------- la liste (tout le monde, avec ou sans compte) ----------
-- p_br : tranche de niveau ('1-50', '51-100', '101-150', '151-199', '200') ; p_sort : 'week' (plus aimés cette semaine),
-- 'new', 'top' (de tous les temps), 'views', 'fav' (les numéros de p_ids, favoris gardés dans la partie), 'mine'.
-- p_q cherche dans le titre ; p_items (objets dont le nom correspond, trouvés par le jeu) dans l'équipement.
-- Renvoie 24 builds à partir de p_off, le nombre total et, sur la première page, le build de la semaine.
create or replace function s1.builds_list(p_cls text default null, p_br text default null, p_el text default null, p_bud text default null,
  p_q text default null, p_items text[] default null, p_sort text default 'week', p_off int default 0, p_ids bigint[] default null)
returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$ declare
  lo int := 1; hi int := 200; q text := nullif(btrim(replace(replace(coalesce(p_q, ''), '%', ''), '_', '')), '');
  s text := coalesce(p_sort, 'week'); off int := greatest(0, least(coalesce(p_off, 0), 2000)); res jsonb; wb jsonb;
begin
  if p_br ~ '^\d+-\d+$' then lo := split_part(p_br, '-', 1)::int; hi := split_part(p_br, '-', 2)::int;
  elsif p_br ~ '^\d+$' then lo := p_br::int; hi := p_br::int; end if;
  with f as (
    select b, (select count(*) from build_likes l where l.build_id = b.id and l.created_at > now() - interval '7 days') wk
    from builds b
    where not b.removed
      and (case when s = 'mine' then b.user_id = auth.uid() else not b.hidden end)
      and (s <> 'fav' or b.id = any(coalesce(p_ids, '{}')))
      and (coalesce(p_cls, '') = '' or b.cls = p_cls)
      and b.lvl between lo and hi
      and (coalesce(p_el, '') = '' or b.el = p_el)
      and (coalesce(p_bud, '') = '' or b.bud = p_bud)
      and (q is null or b.title ilike '%' || q || '%' or (p_items is not null and b.items && p_items))
  )
  select jsonb_build_object('n', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(build_row(x.b, x.wk) order by x.o) from (
      select f.b, f.wk, row_number() over (order by
        case when s = 'week' then f.wk end desc nulls last,
        case when s in ('week', 'top') then (f.b).likes end desc nulls last,
        case when s = 'views' then (f.b).views end desc nulls last,
        (f.b).updated_at desc) o
      from f order by o limit (case when s = 'mine' then 30 else 24 end) offset off) x), '[]'::jsonb)) into res; -- « Mes builds » : les 30 d'un coup
  if off = 0 and s <> 'mine' and s <> 'fav' then
    select build_row(b, w.wk) into wb from builds b join (
      select build_id, count(*) wk from build_likes where created_at > now() - interval '7 days' group by build_id) w on w.build_id = b.id
    where not b.hidden and not b.removed and w.wk >= 3 order by w.wk desc, b.likes desc, b.id limit 1;
    res := res || jsonb_build_object('week', wb);
  end if;
  return res;
end $$;
revoke all on function s1.builds_list(text, text, text, text, text, text[], text, int, bigint[]) from public;
grant execute on function s1.builds_list(text, text, text, text, text, text[], text, int, bigint[]) to anon, authenticated;

-- ---------- mes builds (titre « Théorycrafteur », mise à jour en un clic) ----------
create or replace function s1.builds_me() returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'hid', hid, 'title', title, 'cls', cls, 'lvl', lvl, 'likes', likes, 'views', views,
    'hidden', hidden, 'el', el, 'tags', to_jsonb(tags), 'note', note, 'code', code, 'at', updated_at) order by updated_at desc), '[]'::jsonb)
  from builds where user_id = auth.uid() and not removed
$$;
revoke all on function s1.builds_me() from public, anon;
grant execute on function s1.builds_me() to authenticated;

-- ---------- publier ou mettre à jour un build ----------
-- p_id : le build à mettre à jour (le sien), ou null pour un nouveau. Renvoie {id} ou {err : message pour le joueur}.
-- Mise à jour en un clic (menu du héros) : p_title nul garde le titre, le conseil, les usages et l'élément déjà publiés.
create or replace function s1.build_publish(p_id bigint, p_hid int, p_el text, p_bud text, p_tags text[], p_title text, p_note text, p_code text,
  p_sex text default 'm', p_head int default 0)
returns jsonb language plpgsql security definer set search_path = s1, public
as $$ declare
  u uuid := auth.uid(); pr record; sa record; j jsonb; cl text; lv int; its text[];
  t text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  n text := btrim(coalesce(p_note, ''));
  c text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  tg text[] := array(select x from (select distinct on (x) x, o from unnest(coalesce(p_tags, '{}')) with ordinality u(x, o)
    where x in ('Donjon', 'Kolizéum', 'Farm', 'Songe', 'Débutant') order by x, o) y order by o);
  nid bigint;
begin
  if u is null then return jsonb_build_object('err', 'Connecte-toi avec Discord pour publier un build.'); end if;
  if p_id is not null and p_title is null then
    select title, note, tags, el into t, n, tg, p_el from builds where id = p_id and user_id = u and not removed;
    if not found then return jsonb_build_object('err', 'Ce build n''existe plus : publie-le à nouveau.', 'gone', true); end if;
  end if;
  select pseudo, suspended_at into pr from profiles where id = u;
  if not found then return jsonb_build_object('err', 'Choisis d''abord ton pseudo.'); end if;
  if public.susp(u) then return jsonb_build_object('err', 'Ton compte est suspendu.'); end if;
  select * into sa from chat_sanctions where user_id = u;
  if found and (sa.banned or sa.mute_until > now()) then return jsonb_build_object('err', 'Tu ne peux pas publier de build pour le moment.'); end if;
  if length(t) < 4 then return jsonb_build_object('err', 'Donne un titre à ton build (4 caractères au moins).'); end if;
  if length(t) > 60 then return jsonb_build_object('err', 'Le titre fait 60 caractères au maximum.'); end if;
  if length(n) > 300 then return jsonb_build_object('err', 'Le conseil fait 300 caractères au maximum.'); end if;
  if (t || ' ' || n) ~* '(https?://|www\.|discord\.(gg|com)|[a-z0-9-]+\.(com|fr|net|org|gg|io|be|ch|xyz|ru|ly|me|tv)(/|\s|$))' then
    return jsonb_build_object('err', 'Les liens ne sont pas autorisés dans un build.'); end if;
  if coalesce(p_el, '') not in ('fo', 'ine', 'cha', 'age', 'multi') then return jsonb_build_object('err', 'Choisis l''élément du build.'); end if;
  if coalesce(p_bud, '') not in ('abo', 'moy', 'pre') then return jsonb_build_object('err', 'Budget inconnu.'); end if;
  if array_length(tg, 1) > 3 then return jsonb_build_object('err', 'Trois usages au plus.'); end if;
  if length(c) > 4000 or left(c, 7) <> 'IDLUS1-' then return jsonb_build_object('err', 'Ce build ne peut pas être lu.'); end if;
  begin
    j := convert_from(decode(substr(c, 8), 'base64'), 'UTF8')::jsonb;
    cl := j ->> 'cls'; lv := (j ->> 'lvl')::int;
    its := array(select v from jsonb_each_text(coalesce(j -> 'eq', '{}'::jsonb)) e(k, v) where v ~ '^[a-z0-9_]{1,40}$');
  exception when others then return jsonb_build_object('err', 'Ce build ne peut pas être lu.');
  end;
  if cl is null or cl !~ '^[a-z]{2,10}$' or lv is null or lv not between 1 and 200 then return jsonb_build_object('err', 'Ce build ne peut pas être lu.'); end if;
  if coalesce(array_length(its, 1), 0) < 3 then return jsonb_build_object('err', 'Équipe au moins 3 objets sur ce héros avant de publier son build.'); end if;
  if exists (select 1 from builds where user_id = u and updated_at > now() - interval '15 seconds') then
    return jsonb_build_object('err', 'Attends quelques secondes avant de republier.'); end if;
  if p_id is not null then
    update builds set hid = p_hid, cls = cl, lvl = lv, el = p_el, bud = p_bud, tags = tg, title = t, note = n, code = c, items = its,
      sex = case when p_sex = 'f' then 'f' else 'm' end, head = greatest(0, least(coalesce(p_head, 0), 20)), pseudo = pr.pseudo, updated_at = now()
    where id = p_id and user_id = u and not removed returning id into nid;
    if nid is null then return jsonb_build_object('err', 'Ce build n''existe plus : publie-le à nouveau.', 'gone', true); end if;
    return jsonb_build_object('id', nid, 'upd', true);
  end if;
  if (select count(*) from builds where user_id = u and not removed) >= 30 then -- 1.0.25.2 : 30 builds par compte (10 avant)
    return jsonb_build_object('err', 'Tu as déjà 30 builds publiés : supprimes-en un dans « Mes builds » ou mets-en un à jour.'); end if;
  insert into builds (user_id, pseudo, hid, cls, lvl, el, bud, tags, title, note, code, items, sex, head)
    values (u, pr.pseudo, p_hid, cl, lv, p_el, p_bud, tg, t, n, c, its, case when p_sex = 'f' then 'f' else 'm' end, greatest(0, least(coalesce(p_head, 0), 20)))
    returning id into nid;
  return jsonb_build_object('id', nid);
end $$;
revoke all on function s1.build_publish(bigint, int, text, text, text[], text, text, text, text, int) from public, anon;
grant execute on function s1.build_publish(bigint, int, text, text, text[], text, text, text, text, int) to authenticated;

-- ---------- supprimer un de ses builds ----------
create or replace function s1.build_delete(p_id bigint) returns text language plpgsql security definer set search_path = s1, public
as $$ begin
  if auth.uid() is null then return 'non connecté'; end if;
  delete from builds where id = p_id and user_id = auth.uid();
  return null;
end $$;
revoke all on function s1.build_delete(bigint) from public, anon;
grant execute on function s1.build_delete(bigint) to authenticated;

-- ---------- ❤ J'aime (un par compte, on peut le retirer) ----------
create or replace function s1.build_like(p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$ declare u uuid := auth.uid(); b record; on_ boolean;
begin
  if u is null then return jsonb_build_object('err', 'Connecte-toi avec Discord pour aimer un build.'); end if;
  select id, user_id, likes into b from builds where id = p_id and not removed and not hidden;
  if not found then return jsonb_build_object('err', 'Ce build n''est plus disponible.'); end if;
  if b.user_id = u then return jsonb_build_object('err', 'Tu ne peux pas aimer ton propre build.'); end if;
  if exists (select 1 from build_likes where build_id = p_id and user_id = u) then
    delete from build_likes where build_id = p_id and user_id = u; on_ := false;
    update builds set likes = greatest(0, likes - 1) where id = p_id returning likes into b.likes;
  else
    insert into build_likes (build_id, user_id) values (p_id, u); on_ := true;
    update builds set likes = likes + 1 where id = p_id returning likes into b.likes;
  end if;
  return jsonb_build_object('liked', on_, 'likes', b.likes);
end $$;
revoke all on function s1.build_like(bigint) from public, anon;
grant execute on function s1.build_like(bigint) to authenticated;

-- ---------- une vue (une seule par joueur et par build ; p_guest : identifiant de la partie sans compte) ----------
create or replace function s1.build_view(p_id bigint, p_guest text default null) returns boolean language plpgsql security definer set search_path = s1, public
as $$ declare w text := coalesce(auth.uid()::text, case when length(btrim(coalesce(p_guest, ''))) between 8 and 64 then 'g:' || btrim(p_guest) end); n int;
begin
  if w is null then return false; end if;
  insert into build_views (build_id, who) select p_id, w where exists (select 1 from builds where id = p_id and not removed) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update builds set views = views + 1 where id = p_id; end if;
  return n > 0;
end $$;
revoke all on function s1.build_view(bigint, text) from public;
grant execute on function s1.build_view(bigint, text) to anon, authenticated;

-- ---------- signaler (compte nécessaire ; caché dès 3 signalements) ----------
create or replace function s1.build_report(p_id bigint, p_reason text default null) returns text language plpgsql security definer set search_path = s1, public
as $$ declare u uuid := auth.uid(); b record; n int;
begin
  if u is null then return 'Connecte-toi avec Discord pour signaler un build.'; end if;
  select id, user_id into b from builds where id = p_id and not removed;
  if not found then return 'Ce build n''est plus disponible.'; end if;
  if b.user_id = u then return 'C''est ton build : tu peux le supprimer dans « Mes builds ».'; end if;
  insert into build_reports (build_id, user_id, reason) values (p_id, u, left(btrim(coalesce(p_reason, '')), 80)) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 'Tu as déjà signalé ce build.'; end if;
  update builds set reports = reports + 1, hidden = hidden or reports + 1 >= 3 where id = p_id;
  return null;
end $$;
revoke all on function s1.build_report(bigint, text) from public, anon;
grant execute on function s1.build_report(bigint, text) to authenticated;

-- ---------- panel admin (onglet « Builds ») ----------
-- Les builds signalés, cachés ou supprimés d'abord, puis les derniers publiés.
create or replace function s1.adm_builds() returns jsonb language plpgsql security definer set search_path = s1, public
as $$ begin
  perform public.adm_need(false);
  return (select coalesce(jsonb_agg(x order by x.k desc, x.at desc), '[]'::jsonb) from (
    select b.id, coalesce(p.pseudo, b.pseudo) as pseudo, b.cls, b.lvl, b.title, b.note, b.likes, b.views, b.reports, b.hidden, b.removed, b.updated_at as at,
      (b.reports > 0 or b.hidden or b.removed) as k,
      (select string_agg(nullif(r.reason, ''), ' · ') from build_reports r where r.build_id = b.id) as reasons
    from builds b left join profiles p on p.id = b.user_id
    order by (b.reports > 0 or b.hidden or b.removed) desc, b.updated_at desc limit 200) x);
end $$;

-- p_act : 'ok' (remis en ligne, signalements effacés), 'hide' (caché), 'del' (supprimé, récupérable), 'restore' (rétabli).
create or replace function s1.adm_build_set(p_id bigint, p_act text) returns void language plpgsql security definer set search_path = s1, public
as $$ declare t text;
begin
  perform public.adm_need(false);
  select title into t from builds where id = p_id;
  if not found then raise exception 'build introuvable'; end if;
  if p_act = 'ok' then
    delete from build_reports where build_id = p_id;
    update builds set hidden = false, reports = 0 where id = p_id;
  elsif p_act = 'hide' then update builds set hidden = true where id = p_id;
  elsif p_act = 'del' then update builds set removed = true where id = p_id;
  elsif p_act = 'restore' then update builds set removed = false, hidden = false where id = p_id;
  else raise exception 'action inconnue'; end if;
  perform public.alog(format('build n°%s « %s » : %s', p_id, t,
    case p_act when 'ok' then 'remis en ligne' when 'hide' then 'caché' when 'del' then 'supprimé' else 'rétabli' end));
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_builds()', 'adm_build_set(bigint, text)'] loop
    execute format('revoke all on function s1.%s from public, anon', f);
    execute format('grant execute on function s1.%s to authenticated', f);
  end loop;
end $$;

reset search_path;

-- ======================== supabase/brisage.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — coefficient de brisage commun à tous les joueurs en ligne (0.1.43, comme sur un serveur DOFUS).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger.
-- Chaque brisage d'un modèle d'objet baisse son coefficient de 3 % (minimum 10 %) ; il remonte de 1 % toutes les 6 minutes.
-- 1.0.30 « Forge » (choix 43A de Mathis) : de 10 % à 200 %. Sous 100 %, +1 % toutes les 6 minutes comme avant ; au-dessus,
-- +1 % par heure jusqu'à 200 % tant que personne ne brise ce modèle. Un modèle jamais brisé suit le coefficient de départ :
-- 100 % à l'installation de ce fichier (brisage_base), puis +1 % par heure jusqu'à 200 %.
-- L'installation ne supprime ni ne modifie aucune ligne existante ; brisage_list et brisage_hit gardent leur forme pour les
-- versions du jeu d'avant la 1.0.30 (modèles sous 100 %), brisage_sync et brisage_hit_sync servent la 1.0.30.
-- Le jeu ne touche jamais les tables : il lit la liste et envoie ses brisages par les fonctions ci-dessous.
-- ============================================================================
create table if not exists s1.brisage_coef (
  tpl text primary key,
  v real not null default 100,
  t timestamptz not null default now()
);
alter table s1.brisage_coef enable row level security;
create table if not exists s1.brisage_hits (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  n int not null default 0
);
create index if not exists brisage_hits_user on s1.brisage_hits (user_id, at);
alter table s1.brisage_hits enable row level security;

-- 1.0.30 : départ des coefficients au-dessus de 100 % (une seule ligne, posée à la première installation)
create table if not exists s1.brisage_base (
  id int primary key default 1 check (id = 1),
  t timestamptz not null default now()
);
alter table s1.brisage_base enable row level security;
insert into s1.brisage_base (id) values (1) on conflict (id) do nothing;
create index if not exists brisage_coef_t on s1.brisage_coef (t);

-- 1.0.30 : coefficient actuel d'une ligne enregistrée à p_v % à l'heure p_t (même calcul que E.coefAt dans js/engine.js)
create or replace function s1.brisage_cur(p_v real, p_t timestamptz) returns int
language sql stable set search_path = s1, public as $$
  select (case
    when v < 100 and m < (100 - v) * 6 then floor(v + m / 6)
    when v < 100 then least(200, 100 + floor((m - (100 - v) * 6) / 60))
    else least(200, floor(v + m / 60)) end)::int
  from (select p_v::float8 as v, greatest(0, extract(epoch from now() - p_t)::float8 / 60) as m) x;
$$;

-- 1.0.30 : coefficient d'un modèle jamais brisé (100 % à l'installation, +1 % par heure jusqu'à 200 %)
create or replace function s1.brisage_def() returns int
language sql stable set search_path = s1, public as $$
  select coalesce((select s1.brisage_cur(100, b.t) from s1.brisage_base b where b.id = 1), 100);
$$;

-- Les modèles dont le coefficient est sous 100 % : { "modèle": coefficient } (versions d'avant la 1.0.30)
create or replace function s1.brisage_list() returns jsonb
language sql stable security definer set search_path = s1, public as $$
  select coalesce(jsonb_object_agg(tpl, cur), '{}'::jsonb)
  from (select c.tpl, least(b.d, s1.brisage_cur(c.v, c.t)) as cur from s1.brisage_coef c, (select s1.brisage_def() as d) b) x
  where cur < 100;
$$;

-- 1.0.30 : (interne) enregistre des brisages, au plus 300 par appel et 1 500 par tranche de 10 minutes et par joueur.
-- Renvoie null, ou le message d'erreur. Chaque brisage : coefficient actuel − 3 %, au moins 10 %.
create or replace function s1.brisage_apply(p_tpls text[]) returns text
language plpgsql security definer set search_path = s1, public as $$
declare
  u uuid := auth.uid(); n int; recent int; x text; d int;
begin
  if u is null then return 'Connexion requise.'; end if;
  n := coalesce(array_length(p_tpls, 1), 0);
  if n = 0 then return null; end if;
  if n > 300 then p_tpls := p_tpls[1:300]; n := 300; end if;
  select coalesce(sum(h.n), 0) into recent from s1.brisage_hits h where h.user_id = u and h.at > now() - interval '10 minutes';
  if recent + n > 1500 then return 'Trop de brisages d''un coup : réessaie dans quelques minutes.'; end if;
  insert into s1.brisage_hits (user_id, n) values (u, n);
  delete from s1.brisage_hits where at < now() - interval '1 hour';
  d := s1.brisage_def();
  foreach x in array p_tpls loop
    insert into s1.brisage_coef as c (tpl, v, t) values (left(x, 40), greatest(10, d - 3), now())
    on conflict (tpl) do update set v = greatest(10, least(d, s1.brisage_cur(c.v, c.t)) - 3), t = now();
  end loop;
  return null;
end;
$$;

-- Envoie des brisages et renvoie la liste à jour (versions d'avant la 1.0.30)
create or replace function s1.brisage_hit(p_tpls text[]) returns jsonb
language plpgsql security definer set search_path = s1, public as $$
declare e text;
begin
  e := s1.brisage_apply(p_tpls);
  if e is not null then return jsonb_build_object('err', e); end if;
  return s1.brisage_list();
end;
$$;

-- 1.0.30 : { now, t0 (heure du serveur et départ des coefficients, en millisecondes), since (à renvoyer au prochain appel),
-- rows: { modèle: [coefficient enregistré, heure en millisecondes] } }. Sans p_since : tous les modèles sous le coefficient
-- de départ ; avec : seulement ceux brisés depuis (le jeu garde les autres et calcule leur remontée lui-même).
create or replace function s1.brisage_sync(p_since timestamptz default null) returns jsonb
language sql stable security definer set search_path = s1, public as $$
  select jsonb_build_object(
    'now', floor(extract(epoch from now()) * 1000)::bigint,
    't0', (select floor(extract(epoch from b.t) * 1000)::bigint from s1.brisage_base b where b.id = 1),
    'since', now() - interval '1 minute',
    'rows', coalesce((select jsonb_object_agg(c.tpl, jsonb_build_array(c.v, floor(extract(epoch from c.t) * 1000)::bigint))
      from s1.brisage_coef c, (select s1.brisage_def() as d) b
      where case when p_since is null then least(b.d, s1.brisage_cur(c.v, c.t)) < b.d else c.t > p_since end), '{}'::jsonb));
$$;

-- 1.0.30 : envoie des brisages puis renvoie ce qui a changé, comme brisage_sync
create or replace function s1.brisage_hit_sync(p_tpls text[], p_since timestamptz default null) returns jsonb
language plpgsql security definer set search_path = s1, public as $$
declare e text;
begin
  e := s1.brisage_apply(p_tpls);
  if e is not null then return jsonb_build_object('err', e); end if;
  return s1.brisage_sync(p_since);
end;
$$;

revoke all on function s1.brisage_list() from public;
revoke all on function s1.brisage_hit(text[]) from public;
grant execute on function s1.brisage_list() to anon, authenticated;
grant execute on function s1.brisage_hit(text[]) to authenticated;
-- 1.0.30
revoke all on function s1.brisage_cur(real, timestamptz) from public, anon, authenticated;
revoke all on function s1.brisage_def() from public, anon, authenticated;
revoke all on function s1.brisage_apply(text[]) from public, anon, authenticated;
revoke all on function s1.brisage_sync(timestamptz) from public;
revoke all on function s1.brisage_hit_sync(text[], timestamptz) from public;
grant execute on function s1.brisage_sync(timestamptz) to anon, authenticated;
grant execute on function s1.brisage_hit_sync(text[], timestamptz) to authenticated;

reset search_path;

-- ======================== supabase/koli.sql ========================
set search_path = s1, public;
-- ============================================================================
-- KOLIZÉUM — Idlus (0.1.44). Arène 3 contre 3, saisons d'une semaine (lundi 00:00, heure de Paris).
-- Le combat est joué par la fonction serveur « record » ({ koli: ... }) avec la partie en ligne du joueur
-- (js/koli.js, E.koliSim) ; ici on garde la cote, l'équipe d'arène de chacun (elle défend), les combats
-- (rejouables : graine + équipes) et la fin de chaque semaine (rang, cote à mi-chemin de 1 000).
-- S'appuie sur classements.sql (ladder, profiles) et gboss.sql (gb_day, gb_week).
-- Relançable sans danger.
-- ============================================================================

-- ---------- la fiche de chaque joueur ----------
create table if not exists s1.koli (
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
create index if not exists koli_w on s1.koli (w, cote desc);
alter table s1.koli enable row level security;
drop policy if exists "koli : sa fiche" on s1.koli;
create policy "koli : sa fiche" on s1.koli for select using (auth.uid() = user_id);

-- ---------- semaines finies ----------
create table if not exists s1.koli_weeks (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null, cote int not null, n int not null, rank int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, w)
);
alter table s1.koli_weeks enable row level security;
drop policy if exists "koli : ses semaines" on s1.koli_weeks;
create policy "koli : ses semaines" on s1.koli_weeks for select using (auth.uid() = user_id);

-- ---------- combats (attaques et défenses), rejouables ----------
create table if not exists s1.koli_fights (
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
create index if not exists koli_fights_att on s1.koli_fights (att, id desc);
create index if not exists koli_fights_def on s1.koli_fights (def, id desc);
alter table s1.koli_fights enable row level security;
drop policy if exists "koli : ses combats" on s1.koli_fights;
create policy "koli : ses combats" on s1.koli_fights for select using (auth.uid() = att or auth.uid() = def);

-- ---------- outils ----------
-- cote ramenée à mi-chemin de 1 000 (E.koliSoft)
create or replace function s1.koli_soft(c int) returns int language sql immutable as $$ select round(1000 + (c - 1000) / 2.0)::int $$;
-- rang final d'une semaine (au moins 5 combats) : fiches déjà closes + fiches restées sur cette semaine
create or replace function s1.koli_rank(wk int, c int) returns int language sql stable security definer set search_path = s1, public
as $$ select 1 + (select count(*) from koli_weeks where w = wk and n >= 5 and cote > c)::int + (select count(*) from koli where w = wk and n >= 5 and cote > c)::int $$;

-- La fiche d'un joueur pour la semaine wk : créée au besoin ; si sa semaine est finie, on la clôt
-- (rang, cote à mi-chemin). Appelée par la fonction serveur (rôle service) seulement.
create or replace function s1.koli_row(p_user uuid, p_w int) returns s1.koli language plpgsql security definer set search_path = s1, public
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
revoke all on function s1.koli_row(uuid, int) from public, anon, authenticated;

-- L'équipe d'arène du joueur (copie faite par le serveur depuis sa partie en ligne).
create or replace function s1.koli_team(p_user uuid, p_w int, p_team jsonb, p_lvl int, p_heads jsonb) returns s1.koli language plpgsql security definer set search_path = s1, public
as $$
declare k koli;
begin
  perform koli_row(p_user, p_w);
  update koli set team = p_team, lvl = greatest(1, p_lvl), heads = coalesce(p_heads, '[]'::jsonb), at = now() where user_id = p_user returning * into k;
  return k;
end $$;
revoke all on function s1.koli_team(uuid, int, jsonb, int, jsonb) from public, anon, authenticated;

-- Trois adversaires réels autour de la cote (au hasard parmi les plus proches), actifs depuis 2 semaines,
-- pas soi-même, pas un joueur en vérification, pas plus de 3 fois le même par jour.
create or replace function s1.koli_opps(p_user uuid, p_w int, p_cote int) returns jsonb language sql volatile security definer set search_path = s1, public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select k.user_id id, p.pseudo name, case when k.w < p_w then koli_soft(k.cote) else k.cote end cote, k.lvl, k.heads, k.team
    from koli k join profiles p on p.id = k.user_id left join ladder l on l.user_id = k.user_id
    where k.user_id <> p_user and k.team is not null and jsonb_array_length(k.team) > 0 and k.w >= p_w - 2 and not coalesce(l.flagged, false)
      and (select count(*) from koli_fights f where f.att = p_user and f.def = k.user_id and f.at > now() - interval '1 day') < 3
    order by abs(case when k.w < p_w then koli_soft(k.cote) else k.cote end - p_cote) + random() * 120
    limit 3) x
$$;
revoke all on function s1.koli_opps(uuid, int, int) from public, anon, authenticated;

-- Un combat classé fini : cotes des deux côtés, journal, garde-fou du jour, annonce des promotions (Or et plus).
create or replace function s1.koli_done(p_user uuid, p_w int, p_def uuid, p_ghost bigint, p_att_name text, p_def_name text, p_att_team jsonb, p_def_team jsonb,
  p_seed bigint, p_win boolean, p_rounds int, p_d_att int, p_d_def int, p_def_cote int) returns jsonb language plpgsql security definer set search_path = s1, public
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
      select case current_schema() when 's1' then 'sv' else 'v' end, p_user, pr.pseudo, l.main, l.main_lvl, 'ann', jsonb_build_object('t', 'koli', 'g', g, 'cote', a.cote) -- 04/11 : PvP de chaque serveur (Saison 1 : 'sv')
      from profiles pr left join ladder l on l.user_id = pr.id where pr.id = p_user and not coalesce(l.flagged, false);
    ann := true;
  end if;
  return jsonb_build_object('id', fid, 'cote', a.cote, 'n', a.n, 'rank', case when a.n >= 1 then 1 + (select count(*) from koli where w = p_w and n >= 1 and cote > a.cote) else 0 end, 'ann', ann);
end $$;
revoke all on function s1.koli_done(uuid, int, uuid, bigint, text, text, jsonb, jsonb, bigint, boolean, int, int, int, int) from public, anon, authenticated;

-- ---------- ce que le jeu lit ----------
-- Sa fiche (semaine close au besoin), son rang et ses semaines finies.
create or replace function s1.koli_me(p_w int) returns jsonb language plpgsql security definer set search_path = s1, public
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
grant execute on function s1.koli_me(int) to authenticated;

-- Classement de la semaine (au moins un combat classé) : pseudo, cote, combats, équipe vue de loin.
create or replace view s1.lb_koli as
  select k.user_id, p.pseudo, k.w, k.cote, k.n, k.win, k.loss, k.heads,
    rank() over (partition by k.w order by k.cote desc, k.at asc) as r
  from s1.koli k join public.profiles p on p.id = k.user_id left join s1.ladder l on l.user_id = k.user_id
  where k.n >= 1 and not coalesce(l.flagged, false);
grant select on s1.lb_koli to anon, authenticated;

reset search_path;

-- ======================== supabase/wboss.sql ========================
set search_path = s1, public;
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
create table if not exists s1.wb_state (
  id int primary key default 1 check (id = 1),
  n int not null default 1,                 -- numéro du boss (1 = Gargandyas, puis la rotation de 9)
  hp bigint not null,                       -- PV du boss, en points
  dmg bigint not null default 0,            -- points déjà infligés
  started timestamptz not null default now(),
  bonus_until timestamptz                   -- +10 % d'XP pour tout le monde après une victoire
);
alter table s1.wb_state enable row level security;
insert into s1.wb_state (id, n, hp) values (1, 1, 10000) on conflict (id) do nothing;
-- 0.1.50.3 : les vrais essais font environ 90 points ; 20 000 auraient tenu près d'une semaine, 10 000 tiennent environ 2 jours (choix G4)
update s1.wb_state set hp = 10000 where id = 1 and n = 1 and hp = 20000;

create table if not exists s1.wb_hits (
  id bigint generated always as identity primary key,
  n int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  k int not null,                           -- numéro de l'essai sur ce boss (fixe le hasard)
  day date not null,
  points int not null, grade text not null, phase int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null default now(),
  unique (user_id, n, k)
);
create index if not exists wb_hits_n on s1.wb_hits (n, user_id);
create index if not exists wb_hits_day on s1.wb_hits (user_id, day);
alter table s1.wb_hits enable row level security;

-- les boss tombés
create table if not exists s1.wb_kills (
  n int primary key,
  hp bigint not null, started timestamptz not null, ended timestamptz not null default now(),
  last_user uuid, players int not null default 0, top jsonb not null default '[]'::jsonb
);
alter table s1.wb_kills enable row level security;
alter table s1.wb_kills add column if not exists posted timestamptz; -- annoncé sur Discord (workflow « Boss des mondes sur Discord »)

-- 0.1.56 « Boss des mondes rééquilibré » : chaque essai = moyenne de 3 combats, points selon niveau, équipement et nombre de héros
-- (environ 5 fois moins de points). Une seule fois : les essais du boss en cours partent dans wb_hits_old (classement remis à zéro
-- et essais du jour rendus), ses PV et dégâts sont divisés par 5 (il garde la même part de PV). Coffres et Fragments déjà gagnés
-- restent dans les sacs (donnés par hdv_op), et ceux qui avaient frappé comptent toujours pour la récompense de mort (choix 6A).
create table if not exists s1.wb_hits_old (
  id bigint primary key, n int not null, user_id uuid not null references auth.users (id) on delete cascade,
  k int not null, day date not null, points int not null, grade text not null, phase int not null, lvl int not null, rounds int, alive int,
  at timestamptz not null, archived_at timestamptz not null default now()
);
create index if not exists wb_hits_old_n on s1.wb_hits_old (n, user_id);
alter table s1.wb_hits_old enable row level security;
create table if not exists s1.wb_resets (id text primary key, at timestamptz not null default now(), info jsonb);
alter table s1.wb_resets enable row level security;
do $$ declare s record; moved int; begin
  if exists (select 1 from s1.wb_resets where id = '0.1.56') then return; end if;
  select * into s from s1.wb_state where id = 1;
  insert into s1.wb_hits_old (id, n, user_id, k, day, points, grade, phase, lvl, rounds, alive, at)
    select id, n, user_id, k, day, points, grade, phase, lvl, rounds, alive, at from s1.wb_hits where n = s.n;
  get diagnostics moved = row_count;
  delete from s1.wb_hits where n = s.n;
  update s1.wb_state set hp = greatest(1, round(hp / 5.0)), dmg = round(dmg / 5.0) where id = 1;
  insert into s1.wb_resets (id, info) values ('0.1.56', jsonb_build_object('n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'hits', moved));
end $$;
-- 1.0.4.6 : un essai compte le total de ses 3 combats (avant : la moyenne). Une seule fois, le boss en cours (Kolosso) passe à la
-- même échelle : ses essais déjà faits, ses PV et ses dégâts sont multipliés par 3 (même part de PV, mêmes grades ; choix 2A de Mathis).
do $$ declare s record; moved int; begin
  if exists (select 1 from s1.wb_resets where id = '1.0.4.6') then return; end if;
  select * into s from s1.wb_state where id = 1;
  update s1.wb_hits set points = points * 3 where n = s.n;
  get diagnostics moved = row_count;
  update s1.wb_hits_old set points = points * 3 where n = s.n;
  update s1.wb_state set hp = hp * 3, dmg = dmg * 3 where id = 1;
  insert into s1.wb_resets (id, info) values ('1.0.4.6', jsonb_build_object('n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'hits', moved));
end $$;

-- 2.1.43.4 « Ougah débloqué » (Mathis 03/11 : « Débloque Ougah sur l'Éternel ») : Ougah (n° 14) avait des PV gonflés par les essais
-- bogués sur Harebourg et ne tombait plus. Une seule fois, ses PV restants sont ramenés à environ 3 jours de dégâts du serveur
-- (27 000 points) ; les essais déjà faits, leurs coffres et le classement restent.
do $$ declare s record; begin
  if exists (select 1 from s1.wb_resets where id = '2.1.43.4') then return; end if;
  select * into s from s1.wb_state where id = 1;
  if s.n is distinct from 14 then return; end if;
  update s1.wb_state set hp = least(hp, dmg + 27000) where id = 1;
  insert into s1.wb_resets (id, info) values ('2.1.43.4', jsonb_build_object('n', s.n, 'hp', s.hp, 'dmg', s.dmg, 'new_hp', least(s.hp, s.dmg + 27000)));
end $$;

-- ---------- outils internes ----------
create or replace function s1.wb_grade(p int) returns text language sql immutable
as $$ select case when p >= 1500 then 'SSS' when p >= 1050 then 'SS' when p >= 600 then 'S' when p >= 300 then 'A' when p >= 150 then 'B' else 'C' end $$;
create or replace function s1.wb_frag(g text) returns int language sql immutable
as $$ select case g when 'SSS' then 6 when 'SS' then 5 when 'S' then 4 when 'A' then 3 when 'B' then 2 else 1 end $$;
create or replace function s1.wb_cons(g text) returns jsonb language sql immutable
as $$ select case g when 'SSS' then '{"coffre_obsidienne":1}' when 'SS' then '{"coffre_or":1}' when 'S' then '{"coffre_argent":2}'
  when 'A' then '{"coffre_argent":1}' when 'B' then '{"coffre_bois":2}' else '{"coffre_bois":1}' end::jsonb $$;
create or replace function s1.wb_phase(d bigint, hp bigint) returns int language sql immutable
as $$ select case when hp <= 0 then 1 when d * 3 >= hp * 2 then 3 when d * 3 >= hp then 2 else 1 end $$;
-- nom du boss n (même ordre que E.WB_ROT dans js/wboss.js)
create or replace function s1.wb_name(n int) returns text language sql immutable
as $$ select (array['Gargandyas', 'Kolosso', 'Korriandre', 'Comte Harebourg', 'Ougah', 'Roi Nidas', 'Ilyzaelle', 'Nileza', 'Vortex'])[((n - 1) % 9) + 1] $$;
create or replace function s1.wb_top(p_n int, lim int default 10) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(x order by x.pts desc), '[]'::jsonb) from (
  select user_id u, pseudo_of(user_id) p, sum(points)::bigint pts, count(*) n, max(points) best from wb_hits where n = p_n group by user_id order by sum(points) desc limit lim) x $$;
create or replace function s1.wb_ann(p_data jsonb, p_user uuid default null) returns void language sql security definer set search_path = s1, public
as $$ insert into chat_msgs (ch, user_id, pseudo, kind, data) values ('g', p_user, case when p_user is null then null else pseudo_of(p_user) end, 'ann', p_data || jsonb_build_object('t', 'wb')) $$;

do $$ declare f text; begin
  foreach f in array array['wb_top(int, int)', 'wb_ann(jsonb, uuid)'] loop
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- premier boss : son arrivée est annoncée une fois dans le chat général
do $$ begin
  if not exists (select 1 from chat_msgs where kind = 'ann' and data->>'t' = 'wb') then
    perform wb_ann(jsonb_build_object('ev', 'arr', 'n', 1, 'name', wb_name(1)));
  end if;
end $$;

-- ---------- lecture : le boss en cours (aussi pour les joueurs sans compte) ----------
create or replace function s1.wb_info() returns jsonb language plpgsql stable security definer set search_path = s1, public
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
revoke all on function s1.wb_info() from public;
grant execute on function s1.wb_info() to anon, authenticated;

-- ---------- appelées par la fonction serveur « record » (clé de service) ----------
-- Vérifie qu'il reste un essai aujourd'hui ; donne le boss, sa phase et le numéro de l'essai (hasard).
create or replace function s1.wb_start(p_user uuid) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare s wb_state;
begin
  if not exists (select 1 from profiles where id = p_user) then return g_err('Crée ton compte pour frapper le boss.'); end if;
  if (select count(*) from wb_hits where user_id = p_user and day = gb_day()) >= 3 then return g_err('Plus d''essai aujourd''hui : reviens après minuit.'); end if;
  select * into s from wb_state where id = 1;
  return jsonb_build_object('ok', true, 'n', s.n, 'phase', wb_phase(s.dmg, s.hp), 'k', (select count(*) from wb_hits where user_id = p_user and n = s.n));
end $$;

-- Enregistre l'essai rejoué : coffre du grade et Fragments, barre commune, phases, mort et rotation. Un essai compte au plus 6 000 points (2.1.43.4).
create or replace function s1.wb_done(p_user uuid, p_n int, p_k int, p_points int, p_phase int, p_lvl int, p_rounds int, p_alive int) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare s wb_state; g text; pts int := least(6000, greatest(0, p_points)); before bigint; after bigint; ph0 int; ph1 int; killed boolean := false;
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
    -- après Ougah débloqué : PV du suivant d'après les dégâts réels des 3 derniers jours (la durée de 11 jours fausserait la règle)
    if p_n = 14 then nhp := greatest(1800, (select round(coalesce(sum(points), 0) / 3.0) from wb_hits where n = p_n and at > now() - interval '3 days')); end if;
    if p_n = 1 then nhp := greatest(1800, least(s.hp, round(s.hp * 86400 / dur))); end if; -- Gargandyas avait des PV pour 2 jours
    update wb_state set n = p_n + 1, hp = nhp, dmg = 0, started = now(), bonus_until = now() + interval '1 hour' where id = 1;
    perform wb_ann(jsonb_build_object('ev', 'dead', 'n', p_n, 'name', nm, 'dur', round(dur)::int, 'top', (select coalesce(jsonb_agg(e->>'p'), '[]'::jsonb) from jsonb_array_elements(t3) e), 'players', pl), p_user);
    perform wb_ann(jsonb_build_object('ev', 'arr', 'n', p_n + 1, 'name', wb_name(p_n + 1)));
  elsif ph1 > ph0 then
    perform wb_ann(jsonb_build_object('ev', 'ph', 'n', p_n, 'name', nm, 'ph', ph1));
  end if;
  return jsonb_build_object('ok', true, 'grade', g, 'frag', wb_frag(g), 'cons', wb_cons(g), 'dmg', after, 'before', before, 'hp', s.hp, 'killed', killed, 'points', pts,
    'left', 3 - (select count(*) from wb_hits where user_id = p_user and day = gb_day()),
    'rank', (select 1 + count(*) from (select sum(points) t from wb_hits where n = p_n group by user_id) x where x.t > (select sum(points) from wb_hits where user_id = p_user and n = p_n)));
end $$;

do $$ declare f text; begin
  foreach f in array array['wb_start(uuid)', 'wb_done(uuid, int, int, int, int, int, int, int)'] loop
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
    execute format('grant execute on function s1.%s to service_role', f);
  end loop;
end $$;

reset search_path;

-- ======================== supabase/fiches.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — fiches détaillées des joueurs (0.1.52.1), panel admin › « Fiches joueurs ».
-- Réservé à Mathis (adm_need(true)) : ni les modérateurs ni les joueurs ne peuvent les lire.
-- Ne crée aucune table et ne modifie aucune donnée : deux fonctions de lecture seulement.
-- Le texte peut être relancé sans danger.
-- ============================================================================

-- Tous les comptes, avec de quoi trier (dernier envoi, niveau, création, temps de jeu).
create or replace function s1.adm_roster(p_q text, p_sort text) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$ begin
  perform public.adm_need(true);
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p.id, p.pseudo, p.created_at, p.suspended_at, l.main cls, coalesce(l.level, 0) level, coalesce(l.main_lvl, 1) main_lvl, coalesce(l.playtime, 0) playtime,
      coalesce(l.flagged, false) flagged, s.updated_at last_save, s.game_version, s.device, u.last_sign_in_at last_login,
      g.name guild, k.cote, cs.mute_until, coalesce(cs.banned, false) banned,
      exists (select 1 from mods m where m.user_id = p.id) is_mod, exists (select 1 from admins a where a.user_id = p.id) is_admin
    from profiles p left join auth.users u on u.id = p.id left join ladder l on l.user_id = p.id left join saves s on s.user_id = p.id
      left join guild_members gm on gm.user_id = p.id left join guilds g on g.id = gm.guild_id left join koli k on k.user_id = p.id
      left join chat_sanctions cs on cs.user_id = p.id
    where p_q is null or p_q = '' or p.pseudo ilike '%' || replace(replace(p_q, '%', ''), '_', '\_') || '%'
    order by
      case when p_sort = 'niveau' then coalesce(l.level, 0) end desc nulls last,
      case when p_sort = 'temps' then coalesce(l.playtime, 0) end desc nulls last,
      case when p_sort = 'creation' then p.created_at end desc nulls last,
      s.updated_at desc nulls last, p.created_at desc
    limit 500) x);
end $$;

-- La fiche d'un joueur : compte, partie en ligne (texte complet, lu par le jeu pour la détailler),
-- guilde, Kolizéum, Hôtel de vente, échanges, boss, codes cadeaux, idées, chat et modération.
-- Pas d'adresse e-mail ni de messages privés.
create or replace function s1.adm_player(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$ declare ps text := public.pseudo_of(p_user); begin
  perform public.adm_need(true);
  if ps is null then return null; end if;
  return jsonb_build_object(
    'id', p_user, 'pseudo', ps,
    'acc', (select jsonb_build_object('created_at', p.created_at, 'suspended_at', p.suspended_at, 'last_login', u.last_sign_in_at,
        'providers', coalesce(u.raw_app_meta_data -> 'providers', jsonb_build_array(u.raw_app_meta_data ->> 'provider')),
        'discord', coalesce(u.raw_user_meta_data -> 'custom_claims' ->> 'global_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
        'is_mod', exists (select 1 from mods m where m.user_id = p_user), 'is_admin', exists (select 1 from admins a where a.user_id = p_user))
      from profiles p left join auth.users u on u.id = p.id where p.id = p_user),
    'save', (select jsonb_build_object('data', s.data, 'meta', s.meta, 'version', s.game_version, 'device', s.device, 'at', s.updated_at, 'size', length(s.data)) from saves s where s.user_id = p_user),
    'ladder', (select to_jsonb(l) - 'user_id' - 'heroes' from ladder l where l.user_id = p_user),
    'guild', (select jsonb_build_object('name', g.name, 'lvl', g.lvl, 'rank', gm.rank, 'given', gm.given, 'week', gm.week, 'joined_at', gm.joined_at, 'last_give', gm.last_give,
        'members', (select count(*) from guild_members x where x.guild_id = g.id))
      from guild_members gm join guilds g on g.id = gm.guild_id where gm.user_id = p_user),
    'koli', (select jsonb_build_object('cote', k.cote, 'best', k.best, 'n', k.n, 'win', k.win, 'loss', k.loss, 'dwin', k.dwin, 'dloss', k.dloss, 'lvl', k.lvl, 'w', k.w, 'at', k.at,
        'fights', (select count(*) from koli_fights f where f.att = p_user or f.def = p_user),
        'weeks', (select coalesce(jsonb_agg(jsonb_build_object('w', x.w, 'cote', x.cote, 'rank', x.rank) order by x.w desc), '[]'::jsonb) from (select * from koli_weeks kw where kw.user_id = p_user order by kw.w desc limit 4) x))
      from koli k where k.user_id = p_user),
    'hdv', jsonb_build_object(
      'open', (select count(*) from hdv_listings where seller = p_user and status = 'open'),
      'open_k', (select coalesce(sum(price), 0) from hdv_listings where seller = p_user and status = 'open'),
      'sold', (select count(*) from hdv_sales where seller = p_user), 'sold_k', (select coalesce(sum(price), 0) from hdv_sales where seller = p_user),
      'bought', (select count(*) from hdv_sales where buyer = p_user), 'bought_k', (select coalesce(sum(price), 0) from hdv_sales where buyer = p_user),
      'orders', (select count(*) from hdv_orders where buyer = p_user and status = 'open'),
      'trades', (select count(*) from trades where (a = p_user or b = p_user) and status = 'done'),
      'last', (select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) from (select name, qty, price, at, (seller = p_user) sold from hdv_sales where seller = p_user or buyer = p_user order by at desc limit 8) x)),
    'boss', jsonb_build_object(
      'wb_n', (select count(*) from wb_hits where user_id = p_user), 'wb_pts', (select coalesce(sum(points), 0) from wb_hits where user_id = p_user),
      'wb_last', (select max(at) from wb_hits where user_id = p_user),
      'gb_n', (select count(*) from gboss_hits where user_id = p_user), 'gb_pts', (select coalesce(sum(points), 0) from gboss_hits where user_id = p_user)),
    'gifts', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'at', at) order by at desc), '[]'::jsonb) from gift_uses where user_id = p_user),
    'ideas', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'tag', tag, 'at', created_at) order by created_at desc), '[]'::jsonb) from ideas where user_id = p_user),
    'chat', jsonb_build_object(
      'pub', (select count(*) from chat_msgs where user_id = p_user and kind = 'msg' and ch in ('g', 'c', 'v')),
      'pub7', (select count(*) from chat_msgs where user_id = p_user and kind = 'msg' and ch in ('g', 'c', 'v') and created_at > now() - interval '7 days'),
      'priv', (select count(*) from chat_msgs where user_id = p_user and kind = 'msg' and ch = 'p'),
      'last', (select max(created_at) from chat_msgs where user_id = p_user and kind = 'msg')),
    'mod', jsonb_build_object(
      'reports', (select count(distinct reporter) from reports where target = p_user), 'reports_open', (select count(*) from reports where target = p_user and open),
      'reported', (select count(*) from reports where reporter = p_user),
      'mute_until', (select mute_until from chat_sanctions where user_id = p_user), 'banned', (select coalesce(banned, false) from chat_sanctions where user_id = p_user),
      'log', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'txt', txt) order by at desc), '[]'::jsonb) from (select at, txt from admin_log where txt ilike '%' || ps || '%' order by at desc limit 10) x))
  );
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_roster(text, text)', 'adm_player(uuid)'] loop
    execute format('revoke all on function s1.%s from public, anon', f);
    execute format('grant execute on function s1.%s to authenticated', f);
  end loop;
end $$;

reset search_path;

-- ======================== supabase/collections.sql ========================
set search_path = s1, public;
-- ============================================================================
-- 1.0.30 : COLLECTIONS. Potentiel des Dofus (js/dofusp.js, js/collui.js).
-- Un Dofus Sublimé (Potentiel X) est annoncé à tout le serveur dans le chat, une seule fois par compte et par Dofus.
-- Le jeu envoie la liste des Dofus Sublimés dans le résumé de la partie (saves.meta->'dsub', ajouté à VERIFY.summary
-- par js/collui.js). Comme l'annonce « obtient le Dofus » (ladder_ann, supabase/chat.sql) : seulement pour une partie
-- classée (ligne dans ladder), jamais pour un compte signalé (chat_ann le vérifie), et seulement pour un Dofus que la
-- partie possède (meta->'dofus'). Rien ne rapporte de kamas ni d'objet ici.
-- Relançable : create ... if not exists, create or replace, drop trigger if exists. Aucune donnée de joueur n'est
-- modifiée ni supprimée.
-- ============================================================================
create table if not exists s1.dofus_sublimes (
  user_id uuid not null references auth.users (id) on delete cascade,
  dofus text not null check (dofus ~ '^[a-z]{2,20}$'),
  at timestamptz not null default now(),
  primary key (user_id, dofus)
);
alter table s1.dofus_sublimes enable row level security;
drop policy if exists "lire les dofus sublimés" on s1.dofus_sublimes;
create policy "lire les dofus sublimés" on s1.dofus_sublimes for select to anon, authenticated using (true);
-- (aucune écriture directe : seul le déclencheur ci-dessous ajoute des lignes)

create or replace function s1.dsub_from_save() returns trigger language plpgsql security definer set search_path = s1, public
as $$ declare d text; bad boolean; begin
  if new.meta is null or jsonb_typeof(new.meta->'dsub') is distinct from 'array' then return new; end if;
  select flagged into bad from ladder where user_id = new.user_id;
  if not found or bad then return new; end if;
  for d in select distinct x from jsonb_array_elements_text(new.meta->'dsub') x
           where x ~ '^[a-z]{2,20}$' and jsonb_typeof(new.meta->'dofus') = 'array' and (new.meta->'dofus') ? x limit 20 loop
    insert into dofus_sublimes (user_id, dofus) values (new.user_id, d) on conflict do nothing;
    if found then perform chat_ann(new.user_id, jsonb_build_object('t', 'dsub', 'id', d)); end if;
  end loop;
  return new;
end $$;
revoke all on function s1.dsub_from_save() from public, anon, authenticated;
-- après saves_ladder (les déclencheurs passent par ordre alphabétique) : la ligne du classement est déjà à jour
drop trigger if exists saves_sublime on s1.saves;
drop trigger if exists saves_sublime on s1.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_sublime after insert or update on s1.saves_ok for each row execute function s1.dsub_from_save();

reset search_path;

-- ======================== supabase/alignement.sql ========================
set search_path = s1, public;
-- ============================================================================
-- ALIGNEMENT — Idlus (1.0.30, choix 34A) : le camp du compte et la guerre des cités.
-- Le jeu envoie son camp dans le résumé de la partie (saves.meta->'align' : s camp, o ordre, l niveau
-- d'alignement, w semaine, p points de guerre de la semaine, ps camp demandé, c chapitres finis ; js/alignement.js).
-- Le serveur tient le camp du compte (align_camp) : un changement de camp n'est accepté que 7 jours après
-- que le serveur l'a vu demandé, et ramène au rang 1. Les points de guerre sont plafonnés (600 par semaine,
-- 150 de l'heure depuis l'envoi précédent) et comptent pour le camp que tient le serveur.
-- Le camp s'affiche dans le chat, les profils et les classements (vue lb_align, lisible sans compte).
-- Le camp gagnant d'une semaine a +5 % d'XP et de butin la semaine suivante (align_war_state, appliqué par le jeu).
-- S'appuie sur classements.sql (ladder, saves) et schema.sql (profiles). Relançable sans danger :
-- ne supprime ni ne modifie aucune donnée de joueur (seulement les deux tables d'ici, remplies par le déclencheur).
-- ============================================================================

create table if not exists s1.align_camp (
  user_id uuid primary key references auth.users (id) on delete cascade,
  side text not null check (side in ('bonta', 'brakmar')),
  ord text not null default 'coeur',
  lvl int not null default 0,
  chap int not null default 0,              -- chapitres de quêtes finis
  since timestamptz not null default now(),
  pend_side text,                           -- camp demandé (changement en attente)
  pend_at timestamptz,                      -- date à partir de laquelle le changement est accepté
  updated_at timestamptz not null default now()
);
alter table s1.align_camp enable row level security; -- lecture par la vue lb_align et align_me seulement

create table if not exists s1.align_war (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,                           -- semaine (lundi, UTC : comme E.weekIdx)
  side text not null,
  pts int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, w, side)
);
create index if not exists align_war_w on s1.align_war (w, side);
alter table s1.align_war enable row level security;

create or replace function s1.align_wk() returns int language sql stable
as $$ select floor((extract(epoch from now()) / 86400 + 3) / 7)::int $$;

-- ---------- déclencheur : le camp et les points de guerre à chaque envoi de partie ----------
create or replace function s1.align_from_save() returns trigger language plpgsql security definer set search_path = s1, public
as $$
declare a jsonb := new.meta->'align'; s text; o text; lv int; ps text; ch int; c s1.align_camp%rowtype; vw int; vp int; old_p int; prev timestamptz; lim int;
begin
  if a is null or jsonb_typeof(a) <> 'object' then return new; end if;
  if coalesce((new.meta->>'panel')::boolean, false) then return new; end if; -- partie de test
  s := a->>'s'; if s is null or s not in ('bonta', 'brakmar') then return new; end if;
  o := coalesce(a->>'o', 'coeur'); if o not in ('coeur', 'esprit', 'oeil') then o := 'coeur'; end if;
  lv := least(100, greatest(0, coalesce((a->>'l')::int, 0)));
  ch := least(5, greatest(0, coalesce((a->>'c')::int, 0)));
  ps := a->>'ps'; if ps is not null and ps not in ('bonta', 'brakmar') then ps := null; end if;
  select * into c from s1.align_camp where user_id = new.user_id;
  if not found then
    insert into s1.align_camp (user_id, side, ord, lvl, chap) values (new.user_id, s, o, lv, ch);
    select * into c from s1.align_camp where user_id = new.user_id;
  elsif s = c.side then
    -- même camp : ordre, niveau, chapitres ; un changement demandé démarre l'attente (une seule fois), une annulation l'efface
    update s1.align_camp set ord = o, lvl = lv, chap = greatest(chap, ch), updated_at = now(),
      pend_side = case when ps is null or ps = c.side then null else ps end,
      pend_at = case when ps is null or ps = c.side then null when c.pend_side = ps then c.pend_at else now() + interval '7 days' end
      where user_id = new.user_id;
  elsif c.pend_side = s and c.pend_at <= now() then
    -- l'attente de 7 jours est finie : le serveur accepte le nouveau camp (rang 1 au plus)
    update s1.align_camp set side = s, ord = o, lvl = least(lv, 20), chap = ch, since = now(), pend_side = null, pend_at = null, updated_at = now()
      where user_id = new.user_id;
  else
    return new; -- autre camp sans attente finie : le serveur garde le sien et ne compte pas les points
  end if;
  -- points de guerre de la semaine : plafonnés, et pas plus vite que 150 de l'heure depuis l'envoi précédent
  vw := coalesce((a->>'w')::int, -1); vp := least(600, greatest(0, coalesce((a->>'p')::int, 0)));
  if vw <> align_wk() or vp <= 0 then return new; end if;
  select x.pts, x.at into old_p, prev from s1.align_war x where x.user_id = new.user_id and x.w = vw and x.side = s;
  if not found then old_p := 0; prev := now() - interval '1 hour'; end if;
  lim := old_p + 60 + floor(extract(epoch from now() - prev) / 3600 * 150)::int;
  vp := least(vp, lim);
  if vp > old_p then
    insert into s1.align_war (user_id, w, side, pts, at) values (new.user_id, vw, s, vp, now())
      on conflict (user_id, w, side) do update set pts = excluded.pts, at = excluded.at;
  end if;
  return new;
exception when others then return new; -- le camp ne doit jamais empêcher d'enregistrer une partie
end $$;
drop trigger if exists saves_align on s1.saves;
drop trigger if exists saves_align on s1.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_align after insert or update on s1.saves_ok for each row execute function s1.align_from_save();

-- ---------- vues et appels ----------
-- qui est de quel camp (sans les comptes « en vérification »)
create or replace view s1.lb_align as
  select c.user_id, p.pseudo, c.side, c.ord, c.lvl, c.chap, l.main, l.main_lvl
  from s1.align_camp c join public.profiles p on p.id = c.user_id left join s1.ladder l on l.user_id = c.user_id
  where not coalesce(l.flagged, false);
grant select on s1.lb_align to anon, authenticated;

-- mon camp vu par le serveur (attente d'un changement comprise)
create or replace function s1.align_me() returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce((select jsonb_build_object('side', side, 'ord', ord, 'lvl', lvl, 'chap', chap, 'since', since, 'pend_side', pend_side, 'pend_at', pend_at)
  from s1.align_camp where user_id = auth.uid()), '{}'::jsonb) $$;
revoke all on function s1.align_me() from public, anon;
grant execute on function s1.align_me() to authenticated;

-- la guerre de la semaine p_w (points et joueurs de chaque camp) et le gagnant de la semaine d'avant
create or replace function s1.align_war_state(p_w int) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  with t as (
    select x.w, x.side, sum(x.pts)::bigint as pts, count(*) as n from s1.align_war x left join s1.ladder l on l.user_id = x.user_id
    where x.w in (p_w, p_w - 1) and x.pts > 0 and not coalesce(l.flagged, false) group by x.w, x.side)
  select jsonb_build_object('w', p_w,
    'b', coalesce((select pts from t where w = p_w and side = 'bonta'), 0), 'k', coalesce((select pts from t where w = p_w and side = 'brakmar'), 0),
    'nb', coalesce((select n from t where w = p_w and side = 'bonta'), 0), 'nk', coalesce((select n from t where w = p_w and side = 'brakmar'), 0),
    'cb', (select count(*) from s1.lb_align where side = 'bonta'), 'ck', (select count(*) from s1.lb_align where side = 'brakmar'),
    'prev', jsonb_build_object('w', p_w - 1, 'b', coalesce((select pts from t where w = p_w - 1 and side = 'bonta'), 0), 'k', coalesce((select pts from t where w = p_w - 1 and side = 'brakmar'), 0),
      'win', case when coalesce((select pts from t where w = p_w - 1 and side = 'bonta'), 0) > coalesce((select pts from t where w = p_w - 1 and side = 'brakmar'), 0) then 'bonta'
                  when coalesce((select pts from t where w = p_w - 1 and side = 'brakmar'), 0) > coalesce((select pts from t where w = p_w - 1 and side = 'bonta'), 0) then 'brakmar' end))
$$;
revoke all on function s1.align_war_state(int) from public;
grant execute on function s1.align_war_state(int) to anon, authenticated;

reset search_path;

-- ======================== supabase/alignement2.sql ========================
set search_path = s1, public;
-- ============================================================================
-- ALIGNEMENT 2 — refonte des alignements (choix de Mathis : 1A conflit réel, 2A régions de la carte, 3A honneur et 20 rangs).
-- Le jeu envoie dans le résumé de la partie (saves.meta->'align', js/honneur.js) : h honneur, r rang (0 à 20),
-- rg points de guerre de la semaine par région, f région de front. Le camp et l'attente de changement restent tenus
-- par alignement.sql (align_camp) : ce fichier s'appuie dessus et le remplace pour la guerre (régions au lieu de la semaine).
-- - align_hon : honneur et rang du compte (plafonné : +600 de l'heure depuis l'envoi précédent, jamais plus de 20 rangs).
-- - align_reg_pts : points de guerre par compte, semaine, région et camp (plafond : 600 par semaine au total, comme avant).
-- - align_region : qui tient chaque région. Une région change de camp quand un camp fait 70 % des points de la semaine
--   (200 points au moins) ; sinon elle garde son camp. Calculé par align_regions(), lisible sans compte.
-- - lb_hon : classement d'honneur (sans les comptes « en vérification ») ; le jeu y lit le rang affiché (0 à 20, choix 2A).
-- - align_regions_cache : l'état des régions calculé au plus une fois toutes les 3 minutes (choix 3A), recalculé aussitôt
--   si une région change de camp hors de ce calcul ou à la nouvelle semaine.
-- Transition v13 → v14 : un envoi sans honneur (ancien jeu, ou serveur sans js/honneur.js) ne touche pas à l'honneur ;
-- après un changement de camp, l'honneur retenu ne dépasse pas celui déjà tenu + 100.
-- Relançable sans danger : ne supprime ni ne modifie aucune donnée de joueur hors de ces tables.
-- ============================================================================

create table if not exists s1.align_hon (
  user_id uuid primary key references auth.users (id) on delete cascade,
  side text not null check (side in ('bonta', 'brakmar')),
  hon int not null default 0,
  rank int not null default 0,
  front text,
  at timestamptz not null default now()
);
alter table s1.align_hon enable row level security;

create table if not exists s1.align_reg_pts (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  region text not null,
  side text not null check (side in ('bonta', 'brakmar')),
  pts int not null default 0,
  primary key (user_id, w, region, side)
);
create index if not exists align_reg_pts_w on s1.align_reg_pts (w, region, side);
alter table s1.align_reg_pts enable row level security;

create table if not exists s1.align_region (
  region text primary key,
  holder text check (holder in ('bonta', 'brakmar')),
  since timestamptz not null default now()
);
alter table s1.align_region enable row level security;

create or replace function s1.align_regions_list() returns text[] language sql immutable
as $$ select array['astrub','amakna','cania','wabbit','sidimote','koalaks','albuera','abrak','moon','dragoeufs','otomai','minotoror','pandala',
  'frigost','saharach','asse','grobe','sakai','valonia','nimotopia','possedes','vulkania'] $$;

-- rang d'un total d'honneur (comme E.honRankOf : 300 pour le rang 1, puis +15 % par rang, arrondi à 10)
create or replace function s1.align_rank_of(h int) returns int language plpgsql immutable
as $$ declare r int := 0; c int := 0; begin
  while r < 20 loop c := c + (round(300 * power(1.15, r) / 10) * 10)::int; exit when h < c; r := r + 1; end loop; return r; end $$;

-- ---------- déclencheur : honneur et points par région à chaque envoi de partie ----------
create or replace function s1.align2_from_save() returns trigger language plpgsql security definer set search_path = s1, public
as $$
declare a jsonb := new.meta->'align'; c s1.align_camp%rowtype; o s1.align_hon%rowtype; h int; lim int; rk int; vw int; k text; v int; tot int; old int; js jsonb;
begin
  if a is null or jsonb_typeof(a) <> 'object' then return new; end if;
  if coalesce((new.meta->>'panel')::boolean, false) then return new; end if;
  select * into c from s1.align_camp where user_id = new.user_id; -- rempli juste avant par align_from_save
  if not found or c.side is distinct from a->>'s' then return new; end if;
  -- honneur : seulement si l'envoi en porte un, entier (un ancien jeu v13 ou un serveur sans js/honneur.js n'envoie pas « h » :
  -- rien n'est écrit, sinon l'honneur repartirait de 0 et le vrai serait plafonné ensuite)
  if jsonb_typeof(a->'h') = 'number' and (a->>'h') ~ '^-?[0-9]{1,9}(\.0+)?$' then
    h := greatest(0, least(40000, (a->>'h')::numeric::int));
    select * into o from s1.align_hon where user_id = new.user_id;
    if found and o.side = c.side then
      lim := o.hon + 100 + floor(extract(epoch from now() - o.at) / 3600 * 600)::int; h := least(h, lim); -- +600 de l'heure au plus
    elsif found then
      h := least(h, o.hon + 100); -- changement de camp accepté : jamais plus que l'honneur déjà tenu + 100 (le jeu redescend au rang 2)
    else
      h := least(h, 6100); -- premier envoi : au plus le rang 10 (ancien niveau 100)
    end if;
    rk := align_rank_of(h); -- le rang suit l'honneur retenu par le serveur, pas celui envoyé
    insert into s1.align_hon (user_id, side, hon, rank, front, at) values (new.user_id, c.side, h, rk, left(a->>'f', 20), now())
      on conflict (user_id) do update set side = excluded.side, hon = excluded.hon, rank = excluded.rank, front = excluded.front, at = now();
  end if;
  -- points de guerre par région, semaine en cours seulement, 600 au total par semaine
  vw := coalesce((a->>'w')::int, -1);
  if vw <> align_wk() or jsonb_typeof(a->'rg') <> 'object' then return new; end if;
  select coalesce(sum(pts), 0) into tot from s1.align_reg_pts where user_id = new.user_id and w = vw;
  for k, js in select key, value from jsonb_each(a->'rg') loop
    if jsonb_typeof(js) <> 'number' then continue; end if; -- valeur illisible : ignorée, sans perdre les autres régions
    v := least(600, greatest(0, floor(js::text::numeric)::int));
    if not (k = any (align_regions_list())) then continue; end if;
    old := null;
    select pts into old from s1.align_reg_pts where user_id = new.user_id and w = vw and region = k and side = c.side;
    old := coalesce(old, 0);
    v := least(v, old + greatest(0, 600 - tot));
    if v > old then
      insert into s1.align_reg_pts (user_id, w, region, side, pts) values (new.user_id, vw, k, c.side, v)
        on conflict (user_id, w, region, side) do update set pts = excluded.pts;
      tot := tot + (v - old);
    end if;
  end loop;
  return new;
exception when others then return new; -- l'alignement ne doit jamais empêcher d'enregistrer une partie
end $$;
drop trigger if exists saves_align2 on s1.saves_ok;
-- le nom trie après saves_align : le camp est à jour avant ce déclencheur
create trigger saves_align2 after insert or update on s1.saves_ok for each row execute function s1.align2_from_save();

-- ---------- état des régions : jauge de la semaine, camp qui les tient (mis à jour à la lecture) ----------
-- 3A : le résultat est gardé 3 minutes (align_regions_cache) ; un seul calcul à la fois (verrou), les autres lisent le résultat.
-- Toute écriture dans align_region hors du calcul (panel, correction à la main) efface le cache ; la semaine suivante aussi.
create table if not exists s1.align_regions_cache (
  id int primary key default 1 check (id = 1),
  w int not null,
  data jsonb not null,
  at timestamptz not null default now()
);
alter table s1.align_regions_cache enable row level security;
create or replace function s1.align_regions_ttl() returns interval language sql immutable as $$ select interval '3 minutes' $$;
create or replace function s1.align_region_touch() returns trigger language plpgsql security definer set search_path = s1, public
as $$ begin
  if coalesce(current_setting('idlus.align_calc', true), '') <> '1' then delete from s1.align_regions_cache; end if;
  return null;
end $$;
drop trigger if exists align_region_touch on s1.align_region;
create trigger align_region_touch after insert or update or delete on s1.align_region for each statement execute function s1.align_region_touch();

create or replace function s1.align_regions() returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare cw int := align_wk(); x s1.align_regions_cache%rowtype; res jsonb;
begin
  select * into x from s1.align_regions_cache where id = 1;
  if found and x.w = cw and x.at > now() - align_regions_ttl() then return x.data; end if;
  perform pg_advisory_xact_lock(hashtext('idlus.align_regions'));
  select * into x from s1.align_regions_cache where id = 1; -- un autre appel vient peut-être de le calculer
  if found and x.w = cw and x.at > now() - align_regions_ttl() then return x.data; end if;
  perform set_config('idlus.align_calc', '1', true);
  res := align_regions_calc();
  perform set_config('idlus.align_calc', '', true);
  insert into s1.align_regions_cache (id, w, data, at) values (1, cw, res, now())
    on conflict (id) do update set w = excluded.w, data = excluded.data, at = excluded.at;
  return res;
end $$;
revoke all on function s1.align_regions() from public;
grant execute on function s1.align_regions() to anon, authenticated;

-- le calcul lui-même (sans cache)
create or replace function s1.align_regions_calc() returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare cw int := align_wk(); r text; b bigint; k bigint; hd text; out jsonb := '{}'::jsonb;
begin
  foreach r in array align_regions_list() loop
    select coalesce(sum(x.pts) filter (where x.side = 'bonta'), 0), coalesce(sum(x.pts) filter (where x.side = 'brakmar'), 0) into b, k
      from s1.align_reg_pts x left join s1.ladder l on l.user_id = x.user_id
      where x.w = cw and x.region = r and not coalesce(l.flagged, false);
    insert into s1.align_region (region) values (r) on conflict do nothing;
    select holder into hd from s1.align_region where region = r;
    if b + k >= 200 and b * 100 >= (b + k) * 70 and hd is distinct from 'bonta' then
      update s1.align_region set holder = 'bonta', since = now() where region = r; hd := 'bonta';
    elsif b + k >= 200 and k * 100 >= (b + k) * 70 and hd is distinct from 'brakmar' then
      update s1.align_region set holder = 'brakmar', since = now() where region = r; hd := 'brakmar';
    end if;
    out := out || jsonb_build_object(r, jsonb_build_object('b', b, 'k', k, 'h', hd, 'since', (select since from s1.align_region where region = r)));
  end loop;
  return jsonb_build_object('w', cw, 'regs', out,
    'cb', (select count(*) from s1.lb_align where side = 'bonta'), 'ck', (select count(*) from s1.lb_align where side = 'brakmar'));
end $$;
revoke all on function s1.align_regions_calc() from public, anon, authenticated;

-- ---------- classement d'honneur ----------
create or replace view s1.lb_hon as
  select h.user_id, p.pseudo, h.side, c.ord, h.hon, h.rank, l.main, l.main_lvl
  from s1.align_hon h join public.profiles p on p.id = h.user_id join s1.align_camp c on c.user_id = h.user_id and c.side = h.side
  left join s1.ladder l on l.user_id = h.user_id
  where not coalesce(l.flagged, false);
grant select on s1.lb_hon to anon, authenticated;

reset search_path;

-- ======================== supabase/songe.sql ========================
set search_path = s1, public;
-- ============================================================================
-- SONGE INFINI — Idlus (1.0.30) : classement de la semaine et lots du top 10.
-- Le record d'un joueur n'est écrit que par la fonction serveur « record » ({ songe: 1 }) : elle relit la
-- partie en ligne, rejoue deux songes de l'intensité annoncée (js/songe.js, E.sgReplay) et garde au plus un
-- quart de vagues de plus que son meilleur rejeu. Classement : intensité validée, puis vagues, puis le premier arrivé.
-- Lots (songe_claim, à partir du lundi) : top 3 = titre « Maître des Songes » (pour une semaine) et 2 000 Bribes,
-- 4e à 10e = 1 000 Bribes. Envoyés par hdv_op ({ bribes, title, untitle }) comme les coffres du boss de guilde.
-- S'appuie sur classements.sql (ladder), hdv.sql (hdv_op, hdv_ops_after) et guildes.sql (g_err).
-- Relançable sans danger : ne supprime ni ne modifie aucune donnée de joueur.
-- ============================================================================

-- meilleur songe vérifié de chaque joueur, par semaine (semaines du lundi, UTC : comme E.weekIdx)
create table if not exists s1.songe_week (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  ii int not null,                          -- intensité validée (0 = Rêve … 7 = Cauchemar 3)
  waves int not null,                       -- vagues tenues à la Fin du rêve (comptées par le serveur)
  at timestamptz not null default now(),
  primary key (user_id, w)
);
create index if not exists songe_week_w on s1.songe_week (w, ii desc, waves desc);
alter table s1.songe_week enable row level security;
drop policy if exists "songe lisible" on s1.songe_week;
create policy "songe lisible" on s1.songe_week for select using (true);

-- classement public de la semaine (sans les comptes « en vérification »)
create or replace view s1.lb_songe as
  select s.user_id, p.pseudo, l.main, l.main_lvl, s.w, s.ii, s.waves, s.at,
    rank() over (partition by s.w order by s.ii desc, s.waves desc, s.at asc) as r
  from s1.songe_week s join public.profiles p on p.id = s.user_id left join s1.ladder l on l.user_id = s.user_id
  where not coalesce(l.flagged, false);
grant select on s1.lb_songe to anon, authenticated;

-- lots déjà donnés : une ligne par joueur et par semaine passée (kind : top3, top10 ou rien)
create table if not exists s1.songe_lots (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  kind text not null,
  untitled boolean not null default false,  -- le titre de la semaine d'avant a été repris
  at timestamptz not null default now(),
  primary key (user_id, w)
);
alter table s1.songe_lots enable row level security;

create or replace function s1.songe_wk() returns int language sql stable
as $$ select floor((extract(epoch from now()) / 86400 + 3) / 7)::int $$;

-- les lots des semaines passées (jusqu'à 4 semaines en arrière) ; le titre passe au nouveau podium
create or replace function s1.songe_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); wk int := songe_wk(); x int; rk int; br int := 0; top boolean := false; got jsonb := '[]'::jsonb; last_top int; last_un int;
begin
  if me is null then return g_err('non connecté'); end if;
  -- 04/11 (fil « Fermer les failles de triche ») : compte signalé par le Bouclier ou retiré : les lots attendent la décision de Mathis
  -- (rien n'est noté, ils restent à prendre après son « C'est bon », dans les 4 semaines)
  if exists (select 1 from ladder where user_id = me and (flagged or suspect)) then return g_err('Ta partie est en vérification : tes lots du Songe attendent.'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  for x in wk - 4 .. wk - 1 loop
    if exists (select 1 from songe_lots where user_id = me and w = x) then continue; end if;
    select r into rk from lb_songe where w = x and user_id = me;
    if rk is null and x < wk - 1 then continue; end if; -- semaine sans songe : rien à noter (sauf la dernière, pour le titre)
    insert into songe_lots (user_id, w, kind) values (me, x, case when rk <= 3 then 'top3' when rk <= 10 then 'top10' else 'rien' end) on conflict do nothing;
    if rk <= 3 then br := br + 2000; top := true; got := got || jsonb_build_object('w', x, 'r', rk);
    elsif rk <= 10 then br := br + 1000; got := got || jsonb_build_object('w', x, 'r', rk); end if;
  end loop;
  if br > 0 then
    perform hdv_op(me, case when top then jsonb_build_object('bribes', br, 'title', 'Maître des Songes') else jsonb_build_object('bribes', br) end,
      format('Classement du Songe infini : %s Bribes de rêve%s', br, case when top then ' et le titre « Maître des Songes »' else '' end));
  end if;
  -- titre de la semaine : repris si la dernière semaine n'est pas dans le top 3
  select max(w) into last_top from songe_lots where user_id = me and kind = 'top3';
  select max(w) into last_un from songe_lots where user_id = me and untitled;
  if last_top is not null and last_top < wk - 1 and (last_un is null or last_un < last_top)
     and exists (select 1 from songe_lots where user_id = me and w = wk - 1 and kind <> 'top3') then
    update songe_lots set untitled = true where user_id = me and w = wk - 1;
    perform hdv_op(me, jsonb_build_object('untitle', 'Maître des Songes'), 'Songe infini : le titre « Maître des Songes » passe au podium de la semaine.');
  end if;
  return jsonb_build_object('ok', jsonb_array_length(got), 'bribes', br, 'top', top, 'got', got, 'ops', hdv_ops_after(me, p_after));
end $$;
revoke all on function s1.songe_claim(bigint) from public, anon;
grant execute on function s1.songe_claim(bigint) to authenticated;

reset search_path;

-- ======================== supabase/vente_data.sql ========================
set search_path = s1, public;
-- Généré par tools/build_vente.js : ne pas modifier à la main.
-- 1.0.30 vente directe (supabase/vente.sql) : prix de base de chaque ressource vendable au jeu, en kamas (E.resPrice du jeu).
-- Relançable : ajoute ou met à jour les prix, ne supprime rien.
create table if not exists s1.vente_base (key text primary key, base int not null);
alter table s1.vente_base enable row level security;
insert into s1.vente_base (key, base) values
('Abragland', 37),
('Aile Atrophiée de Tofu Dodu', 86),
('Aile d''Eninferno', 142),
('Aile de Bourdard', 43),
('Aile de Draguaindrop', 86),
('Aile de Gloursaya', 135),
('Aile de Gruche', 87),
('Aile de Kérigoule', 142),
('Aile de Larve de Koutoulou', 142),
('Aile de Mansobèse', 100),
('Aile de Nocturlabe', 142),
('Aile de Puceronde', 128),
('Aile de Sinistrofu', 142),
('Aile de Vortex', 142),
('Aile du Bitouf des Plaines', 78),
('Aile du Tofu Maléfique', 30),
('Ailes de Moskito', 16),
('Ailes de Scarafeuille Blanc', 31),
('Ailes de Scarafeuille Bleu', 31),
('Ailes de Scarafeuille Rouge', 31),
('Ailes de Scarafeuille Vert', 31),
('Ailes du Scarabosse Doré', 30),
('Ailes du Scarafeuille Noir', 33),
('Ailes intactes de Scarafeuille Blanc', 31),
('Ailes intactes de Scarafeuille Bleu', 31),
('Ailes intactes de Scarafeuille Rouge', 31),
('Ailes intactes de Scarafeuille Vert', 31),
('Akaslip d''Akakwa', 93),
('Alliance de Damar', 100),
('Ambre', 29),
('Ambre d''Abraknyde', 29),
('Ambre d''Abraknyde Sombre', 54),
('Ambre d''Abraknyde Sombre Irascible', 97),
('Ambre du Chêne Mou', 100),
('Ambre du Tynril', 100),
('Amulette de Lear', 72),
('Amygdales du Bitouf Sombre', 101),
('Anguille', 37),
('Antenne de Bacterrib', 142),
('Antenne de Gloursaya', 135),
('Antenne de Trésantène', 72),
('Antennes de Vilinsekt', 30),
('Antidote du Rat Noir', 79),
('Apostrophe d''Imafugo', 142),
('Apostrophe de Fugokam', 142),
('Appendice Démoniaque', 142),
('Aquarakne de Crânonier', 142),
('Arakne Irascible Écrasée', 99),
('Arakne Majeure Morte', 36),
('Arakne Écrabouillée', 64),
('Argent', 44),
('Armure de Blindur', 135),
('Armure de Tanklume', 142),
('Armée de Tiques de Poolay', 107),
('Artefact Pandawushu Bois', 79),
('Artefact Pandawushu Eau', 93),
('Artefact Pandawushu Feu', 100),
('Artefact Pandawushu Roc', 93),
('Artefact Pandawushu Vent', 100),
('Artefact de Fumrirolle', 114),
('Artefact élémental d''Air', 128),
('Artefact élémental d''Eau', 128),
('Artefact élémental de Terre', 128),
('Artefact élémental du Feu', 128),
('Arête géante du Shamansot', 100),
('Astragale de Mécanofoux', 142),
('Atomystique intrigant', 114),
('Avis d''expulsion', 38),
('Avoine', 16),
('Avoine Magique', 65),
('Baballe', 51),
('Babines de Macien', 51),
('Bague Enchantée du Meulou', 72),
('Baguette Rythmique', 142),
('Baguette de Tétonuki', 93),
('Baguette de la Weine Dussud', 23),
('Baie maléfique', 107),
('Balebz', 121),
('Bananagrume', 22),
('Bandana Troué', 107),
('Bandeau d''Ébourifauve', 142),
('Bandeau de Black Wabbit Squelette', 43),
('Bandeau de Nakunbra', 65),
('Bandeau de Voapah', 142),
('Bandeau du Black Tiwabbit', 37),
('Bandeau troué d''Air', 128),
('Bandeau troué d''Eau', 128),
('Bandeau troué de Feu', 128),
('Bandeau troué de Terre', 128),
('Bandelette de Bandleth', 142),
('Bandelette de Tromblion', 93),
('Bandelette de momie en embuscade', 142),
('Bandelette du Comte Harebourg', 142),
('Bandelette du Guerrier Koalak', 80),
('Bandelette du Mominotor', 86),
('Bandelettes', 65),
('Bandelettes Maudites', 142),
('Bar Rikain', 58),
('Barbe de Merkator', 142),
('Barbe de Seith', 121),
('Barbe du Chouque', 65),
('Barbe du Cyclophandre', 142),
('Barbe du Wa Wobot', 58),
('Barbe inexistante du Barbroussa', 51),
('Barre Rabmarac au Nougat', 9),
('Bauxite', 51),
('Bave de Bouftou', 7),
('Bave de Brokouillon', 135),
('Bave de Champ à Gnons', 128),
('Bave de Kaniglou', 100),
('Bave de Marthos', 135),
('Bave de Mol Usk', 142),
('Bave de Nessil', 142),
('Bave de Ouassingue', 75),
('Bave de Rose Démoniaque', 16),
('Bave du Kaskargo', 114),
('Bave infectée', 72),
('Bec de Dodox', 142),
('Bec de Granduk', 142),
('Bec de Gélikan', 65),
('Bec de Kwakao', 93),
('Bec de Mansordide', 142),
('Bec de Strigide', 142),
('Bec de Truchon', 85),
('Bec de Vilain Petit Tofu', 83),
('Bec du Kido', 77),
('Bec du Kwak de Flamme', 37),
('Bec du Kwak de Glace', 37),
('Bec du Kwak de Terre', 37),
('Bec du Kwak de Vent', 37),
('Bec du Kwakwa', 37),
('Bec du Timansot', 100),
('Bec du Tofu', 13),
('Belladone', 58),
('Belladone de Brouture', 99),
('Besace de nourriture', 142),
('Bidoche Avariée', 51),
('Bidoche Exsudative', 72),
('Bidoche Faisandée', 16),
('Bidoche Fraîche', 114),
('Bidoche Frelatée', 23),
('Bidoche Goûtue', 142),
('Bidoche Gâtée', 128),
('Bidoche Intangible', 9),
('Bidoche Ladre', 44),
('Bidoche Macérée', 100),
('Bidoche Maigre', 121),
('Bidoche Minérale', 30),
('Bidoche Noire', 135),
('Bidoche Persillée', 93),
('Bidoche Rassie', 65),
('Bidoche Saignante', 86),
('Bidoche Sanguinolente', 58),
('Bidoche Séchée', 79),
('Bidoche Tendre', 37),
('Bidoche de Brousse', 107),
('Bidule inutile', 48),
('Bijoux de famille de Gérard', 100),
('Biscuit de chance', 79),
('Bière bwork', 36),
('Black Wabbit écrasé', 40),
('Blop mort', 22),
('Blugely', 45),
('Blé', 3),
('Bois Vermoulu', 16),
('Bois d''Aquajou', 72),
('Bois d''If', 37),
('Bois d''Oliviolet', 34),
('Bois d''Orme', 65),
('Bois d''Ébène', 51),
('Bois d''Érable', 30),
('Bois de Bambou', 41),
('Bois de Bambou Sacré', 69),
('Bois de Bambou Sombre', 61),
('Bois de Bombu', 27),
('Bois de Charme', 58),
('Bois de Châtaignier', 9),
('Bois de Chêne', 23),
('Bois de Frêne', 3),
('Bois de Kaliptus', 55),
('Bois de Merisier', 44),
('Bois de Noisetier', 48),
('Bois de Noyer', 16),
('Bois de Pin', 34),
('Bois de Tremble', 72),
('Bois de Tronknyde', 34),
('Bois de pagaie usée', 142),
('Bolas de Maltrio', 107),
('Bombe de Graboule', 65),
('Bonnet de Gobaliste', 30),
('Bonnet de Guerre', 142),
('Boomerang Abîmé de Diamantine', 50),
('Boomerang du Dok Alako', 57),
('Boomerang du Koalak Sanguin', 82),
('Boomerang du Maître Koalak', 86),
('Boomerang du Warko Marron', 59),
('Boostoplasme', 30),
('Botte trouée de Mégabwork', 65),
('Boucle d''Orfélin', 113),
('Boucle des Égarés', 142),
('Bouclier Chouquant', 65),
('Bouclier Cochon', 72),
('Bouclier Cochon Krollector', 72),
('Bouclier Exotique', 72),
('Bouclier Kiafin', 44),
('Bouclier Kiafin Krollector', 44),
('Bouclier de Crocabulia', 86),
('Bouclier de Dramak', 72),
('Bouclier de Kankreblath', 30),
('Bouclier de Merkator', 142),
('Bouclier de Nelween', 51),
('Bouclier de Tal Kasha', 142),
('Bouclier de Ush', 114),
('Bouclier de l''Obsidiantre', 114),
('Bouclier de la Congère', 142),
('Bouclier de la Reine des Voleurs', 142),
('Bouclier des Rats', 107),
('Bouclier des Rats Krollector', 107),
('Bouclier du Blop Multicolore Royal', 86),
('Bouclier du Bouftou Royal', 23),
('Bouclier du Chaloeil', 142),
('Bouclier du Chêne Mou', 100),
('Bouclier du Chêne Mou Krollector', 100),
('Bouclier du Comte Harebourg', 142),
('Bouclier du Croqueleur', 93),
('Bouclier du Kimbo', 114),
('Bouclier du Korriandre', 128),
('Bouclier du Mantiscore', 58),
('Bouclier du Péki Péki', 114),
('Bouclier du Tofu Royal', 86),
('Bouclier givré du Comte Harebourg', 142),
('Bouclier végétal de Damadrya', 79),
('Boucliew de la Weine Dussud', 23),
('Boucliew du Wa Dunow', 23),
('Boucliexplosif de Founoroshi', 100),
('Bouclinyée', 65),
('Boue Juvénile', 22),
('Boue Mature', 78),
('Boue Novice', 43),
('Boue Vénérable', 113),
('Boue du Boo', 22),
('Bougie Rouge', 37),
('Bougie de plein jour', 36),
('Bougie du Mineur Sombre', 37),
('Bouh-clier', 30),
('Boule de Boulépique', 58),
('Boule de Panthègros', 113),
('Boule en or de Piloztère', 142),
('Boule polie', 76),
('Boules de Kanniboul', 44),
('Boules de Trukikol', 72),
('Boulet de Canondorf', 65),
('Boulet lesté', 142),
('Boulier Zoth', 97),
('Boulon Wabbit', 58),
('Boulon de Cybwork', 128),
('Boulon en bon état', 44),
('Bouloute d''Halouine', 9),
('Bourgeon d''Abraknyde Ancestral', 65),
('Bourgeon d''Abraknyde Sombre Irascible', 97),
('Bourgeon de Fourbasse', 72),
('Bourgeon de Pirolienne', 65),
('Bourgeon explosif de Damadrya', 79),
('Bourse Suspecte', 37),
('Bourse de la Cour Sombre', 142),
('Boursouflure de Protozorreur', 142),
('Bout d''Armure de Macrab', 142),
('Bout de Blop Coco', 22),
('Bout de Blop Griotte', 22),
('Bout de Blop Indigo', 22),
('Bout de Blop Multicolore Royal', 86),
('Bout de Blop Reinette', 22),
('Bouteille de Bouchonnois', 135),
('Bouteille de Cocalane', 142),
('Bouée de Fantomalamère', 107),
('Boîte de Vétauran', 54),
('Boîte à Outils des Mercemers', 142),
('Boîte à Serpentin', 44),
('Bracelet de Force de Trooll', 86),
('Bracelet de Ino-Naru', 100),
('Bractée de Chiendent', 98),
('Bractée de Drosérâle', 142),
('Braguette de Nileza', 142),
('Braguette du Maître Zoth', 99),
('Braise de Tofutoflamme', 86),
('Braises bleutées', 121),
('Branche de Tiwabbit Kiafin', 36),
('Branche du Chêne Mou', 100),
('Broche Diamant', 50),
('Broche Rubis', 50),
('Broche Saphir', 50),
('Broche en nacre', 114),
('Broche Émeraude', 50),
('Brochet', 30),
('Broderie d''Eskoglyphe', 142),
('Broderie de Malléfisk', 72),
('Broderie de Nileza', 142),
('Broderie de la Prêtresse de Kao', 142),
('Broderie de la Reine des Voleurs', 142),
('Bronze', 16),
('Brûlâme encapsulé', 142),
('Bulbe Kouraçao', 36),
('Bulbe Malibout', 36),
('Bulbe Morito', 36),
('Bulbe Passaoh', 36),
('Bulbe de Grenufar', 79),
('Bwak Squelettique', 65),
('Bworklier', 128),
('Bworklier Krollector', 128),
('Bâton de Blanc Pa Wabbit', 58),
('Bâton du Kilibriss', 79),
('Cachet du bizut', 23),
('Cagoule du Kanniboul Ebil', 44),
('Caillou Craquelé de Cania', 49),
('Caisse de cadeaux', 16),
('Caissette de Babioles', 30),
('Calcanéus de Meliglours', 135),
('Caleçon Blanc', 128),
('Caleçon Bleu', 128),
('Caleçon Brun', 128),
('Caleçon Mignon du Pirate', 65),
('Caleçon Rouge', 128),
('Caleçon de Cybwork', 128),
('Calice de Fécorce', 100),
('Calumet Zoth', 99),
('Canif Rouillé', 65),
('Canine Vampiresque', 36),
('Canine de Cronnibal', 142),
('Canine de Félygiène', 113),
('Canine de Gobelin', 30),
('Canine de Kanimate', 142),
('Canine de Krakal', 142),
('Canine de Mergranlou', 72),
('Canine tranchante', 142),
('Cape de la Weine Dussud', 23),
('Cape du Wa Dunow', 23),
('Capsule Explosive', 37),
('Capuche d''Armécréante', 142),
('Capuche de Skentu', 142),
('Carapace Bleue', 37),
('Carapace Jaune', 37),
('Carapace Rouge', 37),
('Carapace Verte', 37),
('Carapace circonflexe d''Imorok', 142),
('Carapace circonflexe de Rokoram', 142),
('Carapace de Krabouilleur', 142),
('Carapace de Kwapa immaculée', 93),
('Carapace de Scaratos', 85),
('Carapace de Supervizœuf', 121),
('Carapace de Termystique', 142),
('Carapace de Ver des Sables', 121),
('Carapace du Mantiscore', 58),
('Carapace vide de Crabe', 37),
('Carcasse de gliglitch intacte', 107),
('Carniflore', 44),
('Carpe d''Iem', 23),
('Carpelle de Brouture', 99),
('Carte Rongée', 142),
('Carte au trésor des Boulangers Sombres', 35),
('Carte au trésor des Mineurs Sombres', 37),
('Carte du Grand Jeu', 142),
('Carte en bois : Ciseaux', 36),
('Carte en bois : Feuille', 36),
('Carte en bois : Pierre', 36),
('Cartilage de Quadrabz', 121),
('Casque Cassé du Chafer', 31),
('Casque cassé de Bwork', 37),
('Casque de Chafer d''Élite', 37),
('Casque de Martoa', 23),
('Casque de Stalak', 142),
('Casque de Statulipe', 142),
('Casque de Wobot', 58),
('Casque du Chafer Primitif', 31),
('Cawotte', 36),
('Cawotte Maudite', 44),
('Cawotte Transgénique', 86),
('Ceinture de Gargrouille', 30),
('Ceinture de la Dame', 142),
('Cendrepierre', 65),
('Cendres Juvéniles', 22),
('Cendres Matures', 78),
('Cendres Novices', 43),
('Cendres Vénérables', 113),
('Cendres de Brûlâme', 142),
('Cendres de Chause', 142),
('Cendres de Tofutoflamme', 86),
('Cendres Éternelles', 6),
('Cendres élémentaires', 142),
('Cerveau de Trithon', 142),
('Cervelle de Bouftou des Cavernes', 66),
('Cervelle de Fleuro', 135),
('Cervelle de Peunch', 142),
('Cervelle de Solar', 142),
('Cervelle de Verglasseur', 142),
('Cervelle de larve', 16),
('Cervelle de tortue', 37),
('Cervelle de vampire', 30),
('Chair aquatique', 142),
('Chair de Zombruth', 142),
('Champignon', 51),
('Champignon Luidegît', 32),
('Champignon psychotrope', 128),
('Champo Banal', 51),
('Chanvre', 51),
('Charbon', 49),
('Charnière Cassée', 48),
('Chaudron de Températurge', 142),
('Chaussette du Cyclophandre', 142),
('Chaussette du Kimbo', 114),
('Chaussette trouée de Dramak', 72),
('Chauve-souris', 30),
('Chaîne de Panthègros', 113),
('Chaîne de Robot Fléau', 45),
('Chaînes Brisées', 37),
('Cheveux d''Alhyène', 114),
('Cheveux de Draegnerys', 51),
('Cheveux de Tal Kasha', 142),
('Chicot du Flib', 50),
('Chitine de Nécrotique', 128),
('Chope de Bière', 142),
('Chouchou de Doublure', 142),
('Chélicères d''Arapex', 65),
('Citron', 45),
('Clakoss', 79),
('Clavicule de Boufmouth', 86),
('Clefs de Mulic Bere', 107),
('Cloaque du Poolay', 107),
('Cloche de Barbéryl Clochecuivre', 135),
('Clé des entraves', 142),
('Cobaye Craqueleur', 51),
('Cobaye Macien', 51),
('Cobaye Matougarou', 114),
('Cobaye Noeul', 19),
('Coccyx du Corailleur', 37),
('Cocktail Moritov', 36),
('Coco du Bitouf Sombre', 101),
('Coco du Bitouf aérien', 108),
('Coco du Bitouf des Plaines', 78),
('Cocon de Ver à Soie', 30),
('Coffre de Draguisla Bonita', 114),
('Coffre familial', 107),
('Coffret maudit du Flib', 22),
('Coffret verrouillé', 142),
('Coiffe déchiquetée de Drakoalak', 71),
('Collier Cassé de Macien', 51),
('Collier d''esclave', 142),
('Collier de Chak Rat', 79),
('Collier de Chakichan', 114),
('Collier suspect', 51),
('Colonne Vertébrale', 28),
('Concombre', 93),
('Condyle de Fuji Givrefoux', 135),
('Confiture Bleue', 45),
('Confiture Fraise', 45),
('Confiture Menthe', 45),
('Conque Marine', 16),
('Contrat de Travail', 135),
('Contrat entre Vil Smisse et Yse Vewybad', 36),
('Coque Endommagée', 44),
('Coquetel éacha', 114),
('Coquetel écharjabl', 114),
('Coquetel éthon', 114),
('Coquetel étubbiz', 114),
('Coquille d''âme corrompue', 142),
('Coquille de Dragoeuf Ardoise', 51),
('Coquille de Dragoeuf Argile', 51),
('Coquille de Dragoeuf Calcaire', 51),
('Coquille de Dragoeuf Charbon', 51),
('Coquille de Dragoss Ardoise', 72),
('Coquille de Dragoss Argile', 72),
('Coquille de Dragoss Charbon', 72),
('Coquille de Dragoss Protéiforme', 72),
('Coquille de Fantimonier', 107),
('Coquille de Harpirate', 107),
('Coquille de Krokille', 78),
('Coquille de Submergé', 142),
('Coquille de Virustine', 142),
('Coquille du Kaskargo', 114),
('Corail Kouraçao', 36),
('Corail Magistral', 37),
('Corail Malibout', 36),
('Corail Morito', 36),
('Corail Passaoh', 36),
('Corail usé', 37),
('Corbac Mort', 79),
('Corbac suiveur', 51),
('Corde de Boursoin', 72),
('Corde du Fancrôme', 107),
('Corde en liane', 44),
('Corne Brûlée du Minotoror', 86),
('Corne brisée de Crocabulia', 86),
('Corne d''Amphibouc', 142),
('Corne d''Ombre', 135),
('Corne de Berserkoffre', 72),
('Corne de Blérice', 135),
('Corne de Boufmouth de guerre', 86),
('Corne de Boufton', 23),
('Corne de Buffalourd', 37),
('Corne de Corruption', 142),
('Corne de Dragacé', 86),
('Corne de Dragmatique', 86),
('Corne de Dragoss Calcaire', 72),
('Corne de Dragoss Protéiforme', 72),
('Corne de Déminoboule', 86),
('Corne de Gamino', 92),
('Corne de Gliglibido', 106),
('Corne de Gyrafor', 142),
('Corne de Kamasterisk', 142),
('Corne de Lapilope', 142),
('Corne de Malbois', 107),
('Corne de Mominotor', 86),
('Corne de Méjaire', 142),
('Corne de Père Phorreur', 107),
('Corne de Rhinoféroce', 72),
('Corne de Scaratos', 85),
('Corne de Typhomet', 142),
('Corne de XLII', 121),
('Corne du Boufcoul', 72),
('Corne du Vénérable Endormi', 142),
('Cornes d''Osavora', 142),
('Cornée de Kami Givrefoux', 121),
('Coton Ancestral', 16),
('Couche usagée de Warko Violet', 85),
('Couronne de Fourbasse', 72),
('Courroie en cuir', 44),
('Couteau de Roukouto', 65),
('Couwonne de la Weine Dussud', 23),
('Couwonne du Wa Dunow', 23),
('Crabe Sourimi', 13),
('Craqueloroche', 51),
('Crinière d''Orfélin', 113),
('Crinière de Krakal', 142),
('Crinière de Rat Blanc', 79),
('Crinière de Rat Noir', 79),
('Crinière de Scélérat Strubien', 23),
('Crinière de Troollaraj', 86),
('Crinière du Vénérable Endormi', 142),
('Crinière fleurie', 76),
('Cristal liquide', 72),
('Cristal pliable', 72),
('Croc de Dragoeuf Protecteur', 86),
('Croc de Krokille', 113),
('Croc de Trankilou', 37),
('Croc infecté', 72),
('Crochet rouillé', 93),
('Crocs de Rats', 23),
('Croissant de Tsukinochi', 114),
('Crottes de Milirat', 23),
('Croupion de Tofuzmo', 85),
('Croupion de Truchmuche', 87),
('Croupion du Bitouf aérien', 108),
('Crystal de résonance', 135),
('Crâne d''Aventurier', 86),
('Crâne de Chafer', 30),
('Crâne de Chef Crocodaille', 50),
('Crâne de Kamikabz', 121),
('Crâne de Kardorim', 9),
('Crâne de Wabbit Squelette', 41),
('Crâne de Yokaï Givrefoux', 121),
('Crâne de centoror gelé', 142),
('Crâne de centoror mouillé', 142),
('Crâne de centoror volé', 142),
('Crâne de pirate', 65),
('Crâne enfoncé', 114),
('Crâne magique de Magouille', 142),
('Crâne magique de Rate Atinée', 79),
('Crâne éthéré', 107),
('Crème vieillissante', 36),
('Crème à bronzer', 16),
('Cubitus de Momie Koalak', 85),
('Cuillère', 135),
('Cuir Huileux de Grodruche', 142),
('Cuir Violet de Mégabwork', 65),
('Cuir d''Empaillé', 142),
('Cuir d''Eskoglyphe', 142),
('Cuir de Boostache Prépubère', 30),
('Cuir de Bouftonmouth', 86),
('Cuir de Bouftou Noir', 23),
('Cuir de Bouftou Royal', 23),
('Cuir de Capsaaloocke', 79),
('Cuir de Cuirboule', 142),
('Cuir de Déminoboule', 86),
('Cuir de Fuji Givrefoux', 135),
('Cuir de Gargrouille', 30),
('Cuir de Gliglibido', 106),
('Cuir de Glouragan', 135),
('Cuir de Grodruche', 142),
('Cuir de Maho Givrefoux', 121),
('Cuir de Ouassingue', 30),
('Cuir de Peunch', 142),
('Cuir de Porkass', 37),
('Cuir de Porsalu', 66),
('Cuir de Scélérat Strubien', 23),
('Cuir de Tengu Givrefoux', 121),
('Cuir de Wolvero', 135),
('Cuir du Cochon de Lait', 37),
('Cuir du Sanglacier', 100),
('Cuir épais', 142),
('Cuisse de Trithon', 142),
('Cuisse de truche', 85),
('Cuivre', 9),
('Culotte de Harrogant', 142),
('Culotte de Missiz Frizz', 142),
('Culotte à l''envers du Roissingue', 134),
('Cédille d''Imetsu', 142),
('Cédille de Tsunam', 142),
('Côtes de Désosseur', 142),
('Côtes de Porkass', 37),
('Côtes du Rib', 31),
('Cœur d''Empaillé', 142),
('Cœur de Blérice', 135),
('Cœur de Boue du Boo', 22),
('Cœur de Brandon', 79),
('Cœur de Buveur', 79),
('Cœur de Calciné', 142),
('Cœur de Crapeur', 114),
('Cœur de Craqueleur', 51),
('Cœur de Dramanite', 128),
('Cœur de Merkator', 142),
('Cœur de pierre poli', 78),
('Cœur du Capitaine Ekarlatte', 93),
('Cœur du Croqueleur', 93),
('Cœur du Mantiscore', 58),
('Daguosseuse de Domptueuse', 142),
('Dard de Morfrelon', 128),
('Dent de Bandleth', 142),
('Dent de Bourbassingue', 77),
('Dent de Chafer', 28),
('Dent de Chakaroze', 114),
('Dent de Crocodaille', 37),
('Dent de Cuirboule', 142),
('Dent de Cycloporth', 121),
('Dent de Fantômat', 107),
('Dent de Gargantûl', 65),
('Dent de Garglyphe', 30),
('Dent de Klémort', 142),
('Dent de Kwoan', 30),
('Dent de Larve Champêtre', 47),
('Dent de Larve Dorée', 37),
('Dent de Larve Rubis', 37),
('Dent de Larve Saphir', 37),
('Dent de Larve Émeraude', 37),
('Dent de Lévitrof', 142),
('Dent de Molette', 71),
('Dent de Phorreur', 107),
('Dent de Shin Larve', 37),
('Dent de Smilomouth', 100),
('Dent de Tilamproie', 142),
('Dent de Tofu Mutant', 30),
('Dent de Trezz', 121),
('Dent de Vatenbière', 142),
('Dent de Wabbit', 36),
('Dent de Waddict', 44),
('Dent de sagesse de Boufmouth', 86),
('Dent de zarbivore', 142),
('Dent du Kharnozor', 72),
('Dent en Or de Craqueleur', 51),
('Dent en Or du Craqueleur Légendaire', 51),
('Dentier de Dantinéa', 142),
('Dentier de Givrefoux', 121),
('Dentier du Chafer d''Élite', 37),
('Dents de Mulou', 72),
('Dents de Wabbit Vampire', 86),
('Destin brisé de Harebourg', 142),
('Destin brisé de Vortex', 142),
('Deuxième clef du Donjon de Sphincter', 44),
('Deuxième morceau de parchemin oublié', 142),
('Deuxième partie de la clef du labyrinthe du Dragon Cochon', 72),
('Diacritique de la Reine Amirukam', 142),
('Diacritique du Roi Imagami', 142),
('Diadème de Belilith', 142),
('Diadème de Chocoligarque', 142),
('Diamant Dimensionnel', 72),
('Diplôme de Rempart de Frigost', 142),
('Document des Magik Riktus signé', 65),
('Documents volés', 51),
('Doigt de Branche Invocatrice', 100),
('Dolomite', 65),
('Dorade Grise', 41),
('Douleur de Brûlâme', 142),
('Duvet de Bourdard', 43),
('Duvet de Mamansot', 100),
('Duvet de Nelween', 51),
('Duvet de Tofoune', 30),
('Duvet de Truchon', 85),
('Duvet du Kilibriss', 79),
('Duvet du Maître Corbac', 79),
('Dé du Chalœil', 142),
('Dédicace de Skeunk pour Émeraude', 50),
('Défaite de Tanuki Femelle', 93),
('Défaite de Tanuki Mâle', 93),
('Défense de Brutapir', 142),
('Défense de Gliglicérin', 104),
('Défense du Phossile', 107),
('Défense du Sanglacier', 100),
('Défense du Sanglier', 23),
('Déguisement Blindur', 135),
('Déguisement Boufronde', 135),
('Déguisement Marthos', 135),
('Déguisement Serpyn', 135),
('Déguisement de Crâmbo', 135),
('Eau  Putride', 121),
('Eau Potable', 6),
('Eau calme', 65),
('Eau de Kwapa', 93),
('Eau putride de Hordémon', 121),
('Echantillon de Sang du Royalmouth', 86),
('Echantillon de sang de Boufmouth', 86),
('Eclat temporel', 135),
('Ectoplasme de Jiangshi-Nobi', 114),
('Ectoplasme de Onabu-Geisha', 114),
('Ectoplasme de Tambouraï', 114),
('Ectoplasme de Tsukinochi', 114),
('Edelweiss', 37),
('Ellébore d''Hel', 114),
('Emballage Suspect', 44),
('Encens Kozaru', 100),
('Encre comestible', 142),
('Encre de Poulpée', 142),
('Enfumoir Zoth', 90),
('Engrais', 16),
('Engrais de Moon', 72),
('Enrobage de Chocoskargo', 93),
('Entrailles de Ver des sables', 121),
('Espadon', 69),
('Essence Spirituelle', 121),
('Essence brûlante de calciné', 142),
('Essence glaciale d''armutin', 142),
('Essence wushu de l''eau', 93),
('Essence wushu du bois', 79),
('Essence wushu du feu', 100),
('Essence wushu du roc', 93),
('Essence wushu du vent', 100),
('Estomac de Black Wo Wabbit', 58),
('Estomac de Gliglidoudur', 104),
('Estomac de Mansocolat', 93),
('Estomac de Ouassingue', 30),
('Estomac de Tofu Ventripotent', 30),
('Estomac de Tofukaz', 30),
('Estomac de Wo Wabbit', 44),
('Ethmoïde de Stalak', 142),
('Ethmoïde du Minotot', 114),
('Faux Visage de Choudini', 65),
('Faux menton du Bourbassingue', 77),
('Faux usée du Paysan', 16),
('Fer', 3),
('Feu Intérieur', 6),
('Feu dévoreur', 142),
('Feuille de Blop Multicolore Royal', 86),
('Feuille de Blop Royal', 44),
('Feuille de Branche Soignante', 100),
('Feuille de Cawotman', 86),
('Feuille de Damadrya', 79),
('Feuille de Fourbasse', 72),
('Feuille de Rose Obscure', 21),
('Feuille de Tikoko', 37),
('Feuille de Tournesol Sauvage', 16),
('Fibre criminelle', 51),
('Fibre de Chanvre', 128),
('Ficelle en Lin', 36),
('Fil de Néfileuse', 65),
('Fil de Soie', 16),
('Fiole de fumée de Nelween', 51),
('Flamme Spectrale', 37),
('Flamme de Kinichinti', 142),
('Flaque Juvénile', 22),
('Flaque Mature', 78),
('Flaque Novice', 43),
('Flaque Vénérable', 113),
('Fleur d''Onabu-Geisha', 114),
('Fleur de Blop Coco Royal', 44),
('Fleur de Blop Griotte Royal', 44),
('Fleur de Blop Indigo Royal', 44),
('Fleur de Blop Multicolore Royal', 86),
('Fleur de Blop Reinette Royal', 44),
('Fleur de Blopignon', 44),
('Fleur de Cactiflore', 93),
('Fleur de Gloutoblop', 44),
('Fleur de Gloutovore', 72),
('Fleur de Kaliptus', 50),
('Fleur de Korriandre', 128),
('Fleur de Pissenlit Diabolique', 16),
('Fleur des protecteurs', 142),
('Fluide Glacial', 16),
('Fluide de Kilibriss', 79),
('Flèche de Crâmbo', 135),
('Flèche du Chafer Archer', 37),
('Fléau de Robot Fléau', 45),
('Fléchette Tranquillisante', 135),
('Flûte de Klûtiste', 142),
('Foulard de Koalak Farouche', 83),
('Foulard de Milimaître', 93),
('Foulard du Sparo', 50),
('Fourrure de Timongouste', 37),
('Fourrure intacte de Givrefoux', 121),
('Fragment d''Ectorche', 142),
('Fragment d''Os', 37),
('Fragment d''Ougalurette', 128),
('Fragment d''armure', 142),
('Fragment d''Épée Reptilienne', 51),
('Fragment de Chakanoubis', 142),
('Fragment de Pierre Pointue', 51),
('Fragment de Pierre Polie', 49),
('Fragment de cerveau poli', 76),
('Fragment de pépite de Sakaï', 135),
('Fragment du Gorgouille', 72),
('Fraise', 45),
('Fraktaklier', 86),
('Frange d''Ébourifauve', 142),
('Frimousse d''Alhyène', 114),
('Fronde de Boufbos', 142),
('Fronde de Boufronde', 135),
('Front osseux de Gropotam', 142),
('Frosplasme', 142),
('Frostiz', 72),
('Fumée Juvénile', 22),
('Fumée Mature', 78),
('Fumée Novice', 43),
('Fumée Vénérable', 113),
('Furoncle de la Mama Bwork', 128),
('Fuyutora', 79),
('Fève Woyale', 23),
('Fémur de Koalak Farouche', 83),
('Fémur de Sphincter Cell', 107),
('Fémur du Chafer Archer', 37),
('Fémur du Chafer Rōnin', 30),
('Galet Lunaire', 72),
('Galet Solaire', 107),
('Galet brasillant', 139),
('Galet cramoisi', 37),
('Galet rayonnant', 107),
('Galet rutilant', 72),
('Gant de Sherpoa', 23),
('Gelée Bleuet', 44),
('Gelée Bleuet Royale', 44),
('Gelée Citron', 44),
('Gelée Citron Royale', 44),
('Gelée Fraise Royale', 44),
('Gelée Menthe Royale', 44),
('Gelée à la Fraise', 44),
('Gelée à la Menthe', 44),
('Germes corrompus', 142),
('Gigantesque Boîte de Cœur', 114),
('Gilet du Valet', 142),
('Ginseng', 51),
('Givranchy', 121),
('Gland', 23),
('Gland de l''Écumouth', 100),
('Glande d''Arak-haï', 65),
('Glande du Pounicheur', 79),
('Glandes de Truchtine', 85),
('Globe Mystique', 128),
('Globule de Nyée', 65),
('Glourclier', 135),
('Glouto Rhum', 72),
('Gomme à mâcher', 100),
('Goujon', 3),
('Goulifié', 38),
('Goulobule rouge', 142),
('Goutte d''encre indélébile', 142),
('Grain de Malice', 121),
('Grain de Sel', 107),
('Graine Hade', 114),
('Graine Ola', 100),
('Graine Pops', 135),
('Graine de Basalte', 114),
('Graine de Comique', 135),
('Graine de Gangredogue', 142),
('Graine de Lentille', 100),
('Graine de Pandouille', 44),
('Graine de Pavot', 16),
('Graine de Pois', 86),
('Graine de Ricin', 128),
('Graine de Scorbute', 51),
('Graine de Sésame', 13),
('Graine de Tournesol', 16),
('Graine de l''Abrakleur sombre', 102),
('Graine de la Discorde', 35),
('Graines de Citwouille Maudites', 25),
('Graisse de Fricochère', 100),
('Graisse de Mansobèse', 100),
('Graisse de mansot', 100),
('Graisse mammaire de Kanig', 114),
('Grande peau de larve champêtre', 47),
('Grappe d''Œufs de larve', 16),
('Gratrooll', 86),
('Gratrooll Industriel', 38),
('Grelot', 45),
('Grelot d''Hersa', 79),
('Grenade de Moribombe', 142),
('Grenat de Momistik', 142),
('Greuvette', 6),
('Greuvette centenaire', 142),
('Griffe de Blérauve', 135),
('Griffe de Buboxor', 142),
('Griffe de Dragoeuf Albâtre', 51),
('Griffe de Félygiène', 113),
('Griffe de Grolours', 37),
('Griffe de Kanimate', 142),
('Griffe de Kolosso', 135),
('Griffe de Matougarou', 114),
('Griffe de Muloubard', 72),
('Griffe de Phorrêveur', 107),
('Griffe de Robionicle', 46),
('Griffe de Strigide', 142),
('Griffe de la Déchireuse', 142),
('Griffes de Kwak', 37),
('Griffes de Smilomouth', 100),
('Groin de Brutapir', 142),
('Groin de Dragon Cochon', 72),
('Groin de Porkzebuth', 142),
('Groin de Sanglier des Plaines', 36),
('Gros Boulet', 37),
('Grosse Boîte de Cœur', 51),
('Grosse caisse de cadeaux', 16),
('Guide du Maître Corbac', 79),
('Guillemets d''Imiyama', 142),
('Guillemets de Mabram', 142),
('Gâtrool', 86),
('Gâtrool Industriel', 38),
('Hamatum de Glourséleste', 135),
('Haïku du dragon : Création', 142),
('Haïku du dragon : Destruction', 142),
('Haïku du dragon : Passion', 142),
('Haïku du dragon : Résolution', 142),
('Herbe Aquatique', 142),
('Herbe Folle', 16),
('Herbe à chacha divine', 142),
('Houblon', 23),
('Houpette de Koalak Sanguin', 82),
('Houpette de Vilain Petit Tofu', 83),
('Huile Antigel de Sylargh', 142),
('Huile de Blop Royal', 44),
('Huile de Fantimonier', 107),
('Huile de Mamansot', 100),
('Huile de Pikoleur', 142),
('Huile de foie de tortue', 37),
('Huile immiscible et indicible', 142),
('Humérus du Sparo', 50),
('Image de collection', 44),
('Incisive de Glourmand', 135),
('Incisive de Kami Givrefoux', 121),
('Incisive de Stalak', 142),
('Incisive de Sylargh', 142),
('Incus de Verglasseur', 142),
('Insigne de Malveilleur', 93),
('Intestin d''Araknosé', 13),
('Iris de Boulglours', 135),
('Ivoire', 37),
('Jambière de Kasrok', 142),
('Jaune d''Œuf de Krokille', 22),
('Jeton du Bworker', 128),
('Jeton prismatique du Bworker', 128),
('Jouet brigandin', 142),
('Jouet de Gamine Zoth', 92),
('Journal Intime d''Émeraude', 50),
('Joyau de la couronne du roi Nidas', 142),
('Jus Concentré de Gelée', 45),
('Jus Toxique de Nécrotique', 128),
('Jus de Cacterre', 93),
('Jus de Ouassingue', 75),
('Jus de Toubibz', 121),
('Kamatrix', 72),
('Kamiam', 30),
('Kamikabz', 121),
('Kaniglou apprivoisé', 100),
('Kanigrou Peureux', 51),
('Kaokurimono', 121),
('Kapokaza', 121),
('Katana de Kwamouraï', 93),
('Kharnoclier', 72),
('Kianzhi de la Lance du Wukang', 142),
('Kianzhi de la Lance du Wukin', 142),
('Kinryu', 51),
('Kobalte', 23),
('Koinkoin de bain de Nagate', 93),
('Kokopaille', 22),
('Kole', 72),
('Kolérat Mort', 51),
('Koukawa', 36),
('Kouloclier', 72),
('Kouloclier Krollector', 72),
('Kralamoure', 34),
('Kristalite', 90),
('Kroboplasme de Bacterrib', 142),
('Kroboplasme de Tabacille', 142),
('Kroboplasme de Verminocule', 142),
('Kroboplasme de Virustine', 142),
('Krosmorbe Orange', 121),
('Krosmorbe Pourpre', 121),
('Krosmorbe Vert', 121),
('Kœur Juvénile', 20),
('Kœur Mature', 90),
('Kœur Novice', 55),
('Kœur Vénérable', 124),
('La Zinuzide', 86),
('La cambriole pour les Nuls', 37),
('Lagon-dinde', 9),
('Lailait de Mamansot', 100),
('Laine Céleste', 7),
('Laine de Boufmouth', 86),
('Laine de Boufmouth légendaire', 86),
('Laine de Boufton Noir', 23),
('Laine de Bouftou', 23),
('Laine de Bouftou Royal', 23),
('Laine de Dardalaine', 65),
('Laine de Glouragan', 135),
('Laine de Maho Givrefoux', 121),
('Laine de Ramane Strubien', 23),
('Laine de Sylargh', 142),
('Laine de Tengu Givrefoux', 121),
('Laine de Yokaï Givrefoux', 121),
('Laine du Boufcoul', 72),
('Laine du Chef de Guerre Bouftou', 23),
('Laine du Royalmouth', 86),
('Laine du Trooll Furieux', 86),
('Lait de Cochon de Lait', 37),
('Lait de Tortue', 37),
('Lait nourricier', 121),
('Lame brisée de Lichangoro', 100),
('Lame tranchante', 142),
('Lamelle de Champa Bleu', 32),
('Lamelle de Champa Marron', 32),
('Lamelle de Champa Rouge', 32),
('Lamelle de Champa Vert', 32),
('Lamelle de Champbis', 128),
('Lamelle de Dramanite', 128),
('Lamelle de Mérulette', 128),
('Lampe de Gyrafor', 142),
('Lance de Chika Rat', 79),
('Lance-Pierre de Scélée Rate', 79),
('Langue Hiyeu', 100),
('Langue Juvénile', 22),
('Langue Mature', 78),
('Langue Novice', 43),
('Langue Vénérable', 113),
('Langue d''Amphibouc', 142),
('Langue d''Épouvanteur', 16),
('Langue d''Étoile', 37),
('Langue de Champodonte', 128),
('Langue de Craquelope', 51),
('Langue de Diabélial', 142),
('Langue de Gargrouille', 30),
('Langue de Grenufar', 79),
('Langue de Hacharné', 142),
('Langue de Kashkaille', 142),
('Langue de Kraméléhon', 85),
('Langue de Krèvladal', 142),
('Langue de Mimikado', 72),
('Langue de Morsquale', 121),
('Langue de Pistilangue', 142),
('Langue de Tiwabbit Kiafin', 36),
('Langue de Truchmuche', 87),
('Lanière en cuir de Gliglitch', 107),
('Lanterne de Tourthon', 142),
('Lanterne usée', 121),
('Larme au Rikain', 114),
('Larme de Givrefoux', 121),
('Larme de Missiz Frizz', 142),
('Larme magmatique', 114),
('Larve pétrifiée d''Ecaflipuce', 79),
('Le rube', 65),
('Lettre de noblesse', 142),
('Liane de Soldalia', 142),
('Lichen pétrifié', 128),
('Lin', 30),
('Linceul', 37),
('Linothorax', 142),
('Livre brillant', 36),
('Livre des Taures', 79),
('Livre du Bwork Mage', 37),
('Livre scellé', 121),
('Long poil de Kaniglou', 100),
('Longue-vue de Gob-Trotteur', 30),
('Lotte', 51),
('Lunettes de Parashukouï', 93),
('Lunettes de Tiwobot', 58),
('Lunotor', 79),
('Lymphe régénérante', 121),
('Lys Ander', 121),
('Maillot de corps de Barbroussa', 51),
('Main de Boo', 51),
('Makroute Déchiqueté', 37),
('Malleus de Karkanik', 142),
('Malléole de Yomi Givrefoux', 121),
('Malt', 44),
('Mamansot', 100),
('Manche de Fouet', 142),
('Mandibule d''Abrakne Irascible', 100),
('Mandragore', 65),
('Manganèse', 30),
('Mansoclier Royal', 100),
('Manubrium de Wolvero', 135),
('Manuel Scolaire', 135),
('Manuel du Directeur Grunob', 37),
('Manuel du Tailleur pour les Nuls', 37),
('Maraca de Lévito', 93),
('Marcassin Orphelin', 36),
('Masque Brisé d''Araknotron', 64),
('Masque Cassé d''Araknotron Irascible', 99),
('Masque bleu', 44),
('Masque brisé', 121),
('Masque cauchemardesque de l''Éternel Conflit', 142),
('Masque de Brutopak', 135),
('Masque de Caznoar', 135),
('Masque de Noctulule', 135),
('Masque de Panterreur', 135),
('Masque de Shinibaru', 93),
('Masque de la Vengeance', 135),
('Masque de la Violence', 135),
('Masque de la Vivacité', 135),
('Masque du Vice', 135),
('Masque du Vide', 135),
('Masque jaune', 44),
('Masque rouge', 44),
('Masque vert', 44),
('Mawabouclier', 44),
('Maxillaire de Brikoglours', 142),
('Maïs', 58),
('Menthe Sauvage', 23),
('Miel de Boulglours', 135),
('Mildiou de Pandala', 79),
('Millet', 65),
('Minerai Étrange', 46),
('Minoclier', 86),
('Minowang', 9),
('Minuscule Boîte de Cœur', 16),
('Miroir de Dopeul', 35),
('Mise en plis de Voracle', 142),
('Miséricorde du Chafer d''Élite', 37),
('Miteters', 114),
('Mojo de Mergranlou', 72),
('Molaire de Blérice', 135),
('Molaire de Nessil', 142),
('Molaire de Ventrublion', 142),
('Mominotor', 86),
('Morceau d''emmental', 79),
('Morceau de Brikoléreux', 142),
('Morceau de Futur', 114),
('Morceau de Truche', 85),
('Morceau de caleçon de Gourlo', 51),
('Morceau de chaîne asservissante', 142),
('Morceau de clef Coco', 44),
('Morceau de clef Griotte', 44),
('Morceau de clef Indigo', 44),
('Morceau de clef Reinette', 44),
('Morceau de clef de Paspartou', 142),
('Morceau de clef du Matin Pewlant', 44),
('Morceau de clef du Midi Wayonnant', 44),
('Morceau de clef du Soiw Woulant', 44),
('Morceau de larve', 16),
('Morpion de Truchideur', 86),
('Morue', 61),
('Mots noircis', 142),
('Mots pliés', 142),
('Mouchoir de la Gamine Zoth', 92),
('Moumoule', 37),
('Moumoules frites', 37),
('Moumoute du Royalmouth', 86),
('Mousse de Caméliache', 142),
('Moustache de Boostache', 30),
('Moustache de Frimar', 142),
('Moustache de Klime', 142),
('Moustache de Kolérat', 51),
('Moustache de Rilur', 142),
('Moustache de Ush', 114),
('Moustache du Mufafah', 76),
('Moustache du Shogun Tofugawa', 114),
('Moustache précieuse', 72),
('Moustaches de Cactoblongo', 93),
('Moustaches de Tiwabbit', 36),
('Muguet Ridon', 135),
('Muldo d''eau', 9),
('Muqueuse de Moumoule', 37),
('Musc de gliglitch', 107),
('Museau de Blérauve', 135),
('Museau de Croleur', 135),
('Mycose Infectieuse', 142),
('Mâchoire de Brutasmodan', 142),
('Mâchoire de Gropotam', 142),
('Mâchoire de Rib', 31),
('Mâchoire de pirate', 65),
('Mâchoire du Chafer Draugr', 37),
('Mât de Fantômat', 107),
('Mèche Rebelle d''Hell Mina', 107),
('Mèche de Pralicienne', 142),
('Mèche de Serpyn', 135),
('Mèche de bombe de Terristocrate', 142),
('Mécanisme cassé', 142),
('Méga Pierre du Craqueleur', 51),
('Méga Pierre du Craqueleur Légendaire', 51),
('Métal abyssal', 142),
('Métal maudit', 142),
('Métal Éternel', 142),
('Nacre brute', 36),
('Nageoire de Compétition', 16),
('Nectar céleste', 135),
('Nectar de l''Orient', 79),
('Nez de Pipisteuse', 142),
('Nileclier', 142),
('Noeul Mort', 19),
('Noisette', 23),
('Noix de Cajou', 36),
('Noix de Grokoko Traumatisée', 37),
('Noix de Kokoko', 37),
('Noix de Pécan', 37),
('Noyau de Protozorreur', 142),
('Noyau de Protozorreur boursoufflé', 142),
('Nœud de Marin', 65),
('Nœud de l''Abrakleur clair', 114),
('Objet bizarre', 135),
('Obsidienne', 72),
('Omoplate de Blérom', 135),
('Ongle de Goulafre', 142),
('Ongle de Kanigrou', 51),
('Ongle du Bworker', 128),
('Or', 58),
('Orchidée Freyesque', 30),
('Oreille d''Apériglours', 135),
('Oreille de Blérice', 135),
('Oreille de Bouftonmouth', 86),
('Oreille de Bouledogre', 70),
('Oreille de Chargus', 114),
('Oreille de Croleur', 135),
('Oreille de Douzdoa', 23),
('Oreille de Fistulor', 128),
('Oreille de Fleuro', 135),
('Oreille de Foufayteur', 52),
('Oreille de Gobosteur', 135),
('Oreille de Griffotep', 142),
('Oreille de Guerrier Mental', 44),
('Oreille de Kakoalak', 93),
('Oreille de Kaniblou', 113),
('Oreille de Kaniglou', 100),
('Oreille de Lapilope', 142),
('Oreille de Mécanofoux', 142),
('Oreille de Médibwork', 65),
('Oreille de Rat Plapla', 79),
('Oreille de Rhinoféroce', 72),
('Oreille de Soryo Givrefoux', 121),
('Oreille du Fu Mansot', 100),
('Oreille du Grand Pa Wabbit', 44),
('Oreille percée du Fricochère', 100),
('Oreilles de Koalak Immature', 50),
('Oreilles de Wabbit Fluo', 86),
('Oreilles du Tiwabbit', 36),
('Orge', 9),
('Ortie', 3),
('Ortyde', 128),
('Os Divinatoire de Voracle', 142),
('Os Invisible du Chafer Invisible', 28),
('Os Surprise du Chafer Fantassin', 31),
('Os de Chafer', 8),
('Os de Crocodaille', 37),
('Os de Jiangshi-Nobi', 114),
('Os de Mama Koalak', 71),
('Os de Nemroz', 135),
('Os de Pékeualak', 64),
('Os de Sramouraï', 93),
('Os de Trooll', 38),
('Os de Wabbit Squelette', 41),
('Os de fer', 72),
('Os du Maître Corbac', 79),
('Os magique de Mama Koalak', 71),
('Os rongé de Gobichon', 30),
('Osacoche d''Osavora', 121),
('Osier Enchanté', 65),
('Osier Sombre', 37),
('Osselet de Black Wabbit Squelette', 43),
('Oueille', 13),
('Ougahstrique', 128),
('Ours Déchiqueté', 37),
('Ouvrage magique d''Aloevée Rate', 79),
('P''Koutoulou Ch''ton', 142),
('P''Koutoulou Glaakiph', 142),
('P''Koutoulou Zothoth', 142),
('Page déchirée', 44),
('Page indéchiffrable', 142),
('Pagne d''Alashasss', 142),
('Pagne de Trantroa', 121),
('Paille Vampiresque', 36),
('Pain Sombre', 35),
('Paire de boules de Haute Truche', 93),
('Palpe de Pikbul', 79),
('Panterreur', 135),
('Papatte de Croc Gland', 51),
('Papier Charbon', 35),
('Papier comestible', 142),
('Parangon de puissance', 142),
('Parasite Aquatique', 142),
('Parasite de Crânonier', 142),
('Parasite de Funespadon', 142),
('Parasite de Macrab', 142),
('Parasite de Tournoyé', 142),
('Parchemin d''Invocation de l''Arakne', 80),
('Parchemin de Cactana', 93),
('Parchemin mordillé', 142),
('Patelle', 72),
('Patte d''Abrakne Irascible', 100),
('Patte d''Arakne', 16),
('Patte d''Arakne Magique', 16),
('Patte d''Arakne Majeure', 36),
('Patte d''Arakne des Égouts', 23),
('Patte de Black Wabbit', 40),
('Patte de Bouledogre', 70),
('Patte de Corbac', 79),
('Patte de Gruche', 87),
('Patte de Kabombz', 121),
('Patte de Kankreblath', 30),
('Patte de Korriandre', 128),
('Patte de Li-Fo', 142),
('Patte de Masticroc', 121),
('Patte de Matougarou', 114),
('Patte de Nheur''Gueule', 142),
('Patte de Pupuce', 79),
('Patte de Rat Bougri', 65),
('Patte de Scoliopode', 128),
('Patte de Soryo Givrefoux', 121),
('Patte de Tabacille', 142),
('Patte de Termystique', 142),
('Patte de Tofu Dodu', 86),
('Patte de Tofukaz', 30),
('Patte de Twakeuf', 44),
('Patte de Wabbit', 38),
('Patte de la Gardienne des Égouts', 80),
('Patte de la Reine Nyée', 65),
('Paupière Dorée de Rykaon', 142),
('Paupière d''Étoile', 37),
('Pavillon noir', 65),
('Peau d''Ouilleur', 135),
('Peau de Bworkette', 37),
('Peau de Chevaucheur Koalak', 82),
('Peau de Cochon de Farle', 71),
('Peau de Crachefoux', 100),
('Peau de Crocabulia', 86),
('Peau de Don Dorgan', 72),
('Peau de Don Duss Ang', 72),
('Peau de Dragnarok', 86),
('Peau de Dragoeuf Albâtre', 51),
('Peau de Draguaindrop', 86),
('Peau de Dragueuse', 86),
('Peau de Drakoalak', 71),
('Peau de Gloot', 6),
('Peau de Gériatique', 79),
('Peau de Kanihilan', 114),
('Peau de Koalak Immature', 50),
('Peau de Krambwork', 65),
('Peau de Kraméléhon', 85),
('Peau de Larve Bleue', 16),
('Peau de Larve Champêtre', 47),
('Peau de Larve Dorée', 37),
('Peau de Larve Jaune', 16),
('Peau de Larve Orange', 16),
('Peau de Larve Rubis', 37),
('Peau de Larve Saphir', 37),
('Peau de Larve Verte', 16),
('Peau de Larve Émeraude', 37),
('Peau de Mandrine', 78),
('Peau de Mansobèse', 100),
('Peau de Maître Koalak', 86),
('Peau de Minos', 78),
('Peau de Minoskito', 79),
('Peau de Mob l''Éponge', 16),
('Peau de Moon', 72),
('Peau de Métaphorreur', 107),
('Peau de Pataugerme', 142),
('Peau de Piralak', 64),
('Peau de Ramane d''Égoutant', 44),
('Peau de Rat', 44),
('Peau de Raul Mops', 37),
('Peau de Roukouto', 65),
('Peau de Rouquette', 100),
('Peau de Shin Larve', 37),
('Peau de Skeunk', 86),
('Peau de Tivelo', 65),
('Peau de Torréfactueur', 142),
('Peau de Trithon', 142),
('Peau de Trémorse', 121),
('Peau de Vindeux', 121),
('Peau de serpentin', 44),
('Peau de zarbivore', 142),
('Peau du Bworker', 128),
('Peau déchiquetée de Mansot', 100),
('Peau parfaite de Koalak Immature', 50),
('Peau pourrie de Dolid', 142),
('Peau Égrotante', 13),
('Peigne de Rhoarim', 142),
('Pelage aérodynamique', 100),
('Pelage chocolaté', 93),
('Pelage de la Déchireuse', 142),
('Pense-bête de Rubise', 50),
('Perce-Neige', 72),
('Perche', 44),
('Perkü', 135),
('Perle d''Âme', 37),
('Petite Boîte de Cœur', 30),
('Petite caisse de cadeaux', 16),
('Phéromone de Tofu', 30),
('Pic d''Anerice', 142),
('Pic de Lance de Gobet', 30),
('Pic de Malépik', 107),
('Pic de Pikoleur', 142),
('Pic de Pikténia', 121),
('Pic de Prespic', 23),
('Pic de Ravageur', 142),
('Pic du Nocturlabe', 142),
('Pichon d''encre', 72),
('Picot d''El Piko', 93),
('Pied de Mansot', 100),
('Pierre Angulaire', 142),
('Pierre Ardente de Calciné', 142),
('Pierre Médicinale', 57),
('Pierre Précieuse Zoth', 94),
('Pierre d''Agathe', 101),
('Pierre d''Aigue-Marine', 104),
('Pierre d''Atomystique', 114),
('Pierre d''Autre Temps', 135),
('Pierre d''Émeraude', 22),
('Pierre de Cristal', 22),
('Pierre de Crystaloboule', 51),
('Pierre de Diamant', 37),
('Pierre de Dopeul', 35),
('Pierre de Fumrirolle', 114),
('Pierre de Granit', 23),
('Pierre de Mofette', 114),
('Pierre de Rubis', 22),
('Pierre de Saphir', 22),
('Pierre de Serpiplume', 92),
('Pierre de Topaze', 22),
('Pierre de lune inaltérée', 142),
('Pierre du Courtilieur', 135),
('Pierre du Craqueleur', 51),
('Pierre du Craqueleur Légendaire', 51),
('Pierre du Koulosse', 72),
('Pile Steamer', 142),
('Pilule du Gang', 101),
('Pince de Crabe', 37),
('Pince de Crabe Hijacob', 65),
('Pince de Crabe Yoloniste', 142),
('Pince de Crustorail', 36),
('Pince de Crâme', 142),
('Pince de Krabouilleur', 142),
('Pince de Lucrane', 128),
('Pince du Fancrôme', 107),
('Pique du Soldat', 142),
('Piques à cheveux de Shihan', 100),
('Pistil de Floristile', 79),
('Pistil du Tynril', 100),
('Pixel d''Éklatleth', 86),
('Pixel de Brikablak', 86),
('Pixel de Farfacette', 86),
('Pixel de Fraktale', 86),
('Pixel de Gromorso', 86),
('Pixel de Segmantid', 86),
('Pièce de Koffrefor', 72),
('Pièce du Puzzle de la Griffe', 36),
('Pièce du Trésor du Badoul', 36),
('Pièce technomagique endommagée', 121),
('Piège désamorcé de Mâchassin', 142),
('Place de Concert de Diamantine', 50),
('Plan d''Invasion du village Enseveli', 142),
('Planche renforcée', 142),
('Plastron de Tambouraï', 114),
('Plume Chimérique', 6),
('Plume Graisseuse du Tofu Ventripotent', 30),
('Plume Pointue de Renarbo', 79),
('Plume Vibrante de mansot', 100),
('Plume Vibrante du Tofu Royal', 86),
('Plume d''Ilyzaelle', 142),
('Plume de Batofu', 30),
('Plume de Brabuzar', 142),
('Plume de Buveur', 79),
('Plume de Corbac Apprivoisé', 79),
('Plume de Crowneille', 51),
('Plume de Cycloïde', 142),
('Plume de Dodox', 142),
('Plume de Domoizelle', 72),
('Plume de Dostrogo', 72),
('Plume de Gobvious', 71),
('Plume de Granduk', 142),
('Plume de Gélikan', 65),
('Plume de Misère', 142),
('Plume de Piou Bleu', 13),
('Plume de Piou Jaune', 13),
('Plume de Piou Rose', 13),
('Plume de Piou Rouge', 13),
('Plume de Piou Vert', 13),
('Plume de Piou Violet', 13),
('Plume de Thomondor', 37),
('Plume de Tofu', 30),
('Plume de Tofu Maléfique', 30),
('Plume de Tofu Royal', 86),
('Plume de Tofubine', 86),
('Plume de Truchideur', 86),
('Plume de fesse du Kido', 77),
('Plume du Cavalier', 142),
('Plume du Kwak de Flamme', 37),
('Plume du Kwak de Glace', 37),
('Plume du Kwak de Terre', 37),
('Plume du Kwak de Vent', 37),
('Plume du Kwakwa', 37),
('Plume du Mansot Royal', 100),
('Plume du Rasboul Majeur', 79),
('Plume du Serpiplume', 92),
('Plume du Timansot', 100),
('Plumeau de Tofuzmo', 85),
('Poignée du Gorgouille', 72),
('Poil d''Abrakne', 37),
('Poil d''aisselle de Missiz Frizz', 142),
('Poil de Ben le Ripate', 107),
('Poil de Blérauve', 135),
('Poil de Blérom', 135),
('Poil de Bworkette', 37),
('Poil de Capsaaloocke', 79),
('Poil de Chachachovage', 65),
('Poil de Chacrebleu', 114),
('Poil de Dragon Cochon', 72),
('Poil de Gamino', 92),
('Poil de Gliglitch', 107),
('Poil de Meno', 142),
('Poil de Nez du Roi Nidas', 142),
('Poil de Rat Bontarien', 79),
('Poil de Rat Brâkmarien', 79),
('Poil de Rat d''Égoutant', 44),
('Poil de Renarbo', 79),
('Poil de Skeunk', 86),
('Poil de Troolléolé', 86),
('Poil de Vétauran', 54),
('Poil de Wobot Kiafin', 58),
('Poil de barbe du Shamansot', 100),
('Poil de nez bleu du Roi Nidas', 142),
('Poil du Wa Wabbit', 44),
('Poils d''Arakne Malade', 13),
('Poils d''Hordémon', 121),
('Poils de Barbe d''Enutrofor', 142),
('Poils de Barbe du Bwork Mage', 37),
('Poils de Barbe du Grand Pa Wabbit', 44),
('Poils de Barbe du Warko Violet', 85),
('Poils de Barbe urticants du Warko Marron', 59),
('Poils de Black Tiwabbit', 37),
('Poils de Boulglours', 135),
('Poils de Boumbardier', 100),
('Poils de Darit', 23),
('Poils de Founamboul', 100),
('Poils de Goultime', 142),
('Poils de Guerrier Koalak', 80),
('Poils de Kanigroula', 114),
('Poils de Koalak Coco', 64),
('Poils de Koalak Forestier', 64),
('Poils de Koalak Griotte', 64),
('Poils de Koalak Indigo', 64),
('Poils de Koalak Reinette', 64),
('Poils de Mulounoké', 72),
('Poils de Pétartifoux', 100),
('Poils de Sanglacier', 100),
('Poils de Smilomouth', 100),
('Poils de Wo Wabbit', 44),
('Poils de barbe de Barbélier', 142),
('Poils de barbe de Marteau-Aigri', 135),
('Poils de souris', 16),
('Poils du Comte Razof', 135),
('Poils du Milimulou', 23),
('Poils du Minotoror', 86),
('Poils irritants de Koalak Forestier', 64),
('Poils magiques de Tanuki', 93),
('Poils pubiens de Kanig', 113),
('Poing de Coquelicogne', 142),
('Poing rocheux d''Ishigro Pake', 93),
('Poing-virgule d''Imushin', 142),
('Poing-virgule de Shinlam', 142),
('Pointe de Lance de Tournoyé', 142),
('Poire d''Épouvanteur', 16),
('Poire de Pissenlit', 16),
('Poire de Rose', 16),
('Poire de Tournesol', 16),
('Poison Zoth', 90),
('Poisskaille', 72),
('Poisskaille royal', 100),
('Poisson Pané', 20),
('Poisson-Chaton', 16),
('Pollen de Bulbiflore', 79),
('Pollenectar', 13),
('Pom de Pin', 37),
('Pompon Brunâtre', 44),
('Porte-bonheur de Malalfa', 107),
('Porçailé', 72),
('Poterie cassée de Lolojiki', 93),
('Potion de soif intense', 36),
('Poudre Juvénile', 22),
('Poudre Mature', 78),
('Poudre Novice', 43),
('Poudre Vénérable', 113),
('Poudre d''Aminite', 8),
('Poudre d''étoile de mer d''Asse', 37),
('Poudre de Perlinpainpain', 6),
('Poudre de foux d''artifice', 100),
('Poudre explosive', 50),
('Poudre glaciale', 135),
('Poupée Vaudou Ark', 44),
('Poupée Vaudou Eth', 44),
('Poupée Vaudou Jav', 44),
('Poupée Vaudou Sarbak', 44),
('Poupée Vaudou Tam', 44),
('Poupée de Caïguille', 142),
('Pousse de Malzerb', 107),
('Poussière de stasis', 3),
('Poussière magik', 65),
('Première clef du Donjon de Sphincter', 44),
('Première partie de la clef du labyrinthe du Dragon Cochon', 72),
('Preuve de fiabilité', 44),
('Protection de Funespadon', 142),
('Prothèse de Ben le Ripate', 107),
('Prélèvement de Blérauve', 135),
('Prélèvement de Blérice', 135),
('Prélèvement de Blérom', 135),
('Prélèvement de Croleur', 135),
('Prélèvement de Fleuro', 135),
('Prélèvement de Kolosso', 135),
('Prélèvement de Wolvero', 135),
('Prélèvement de chef de guerre bouftou', 23),
('Prélèvement du Mantiscore', 58),
('Puissant Parchemin de Vitalité', 54),
('Pulpe macérée de Nodkoko', 37),
('Pustule de Rat Sio', 79),
('Pwâkape', 44),
('Pwâklier', 44),
('Pwâkoiffe', 44),
('Pédoncule de Fongeur', 128),
('Pédoncule de Mérulette', 128),
('Pédoncule de Mérulor', 142),
('Pépite aurifère', 107),
('Pépite croquée', 93),
('Péroné du Marôdeur', 135),
('Pétale Diaphane', 6),
('Pétale Kouraçao', 36),
('Pétale Magique du Tournesol Affamé', 16),
('Pétale Malibout', 36),
('Pétale Morito', 36),
('Pétale Passaoh', 36),
('Pétale d''encre', 142),
('Pétale de Gangredogue', 142),
('Pétale de Malter', 107),
('Pétale de Papier', 142),
('Pétale de Rose Démoniaque', 16),
('Pétale de Rose Obscure', 21),
('Pétale de Tournesol Sauvage', 16),
('Pétunia Fron', 135),
('Quadrabz', 121),
('Queue Magique de Founoroshi', 100),
('Queue d''Écumouth', 100),
('Queue de Bethel Akarna', 142),
('Queue de Black Wabbit', 40),
('Queue de Blérom', 135),
('Queue de Boostache Prépubère', 30),
('Queue de Brikoglours', 142),
('Queue de Chapardam', 8),
('Queue de Chasquatch', 114),
('Queue de Chevrotine', 135),
('Queue de Fantomalamère', 107),
('Queue de Fennex', 58),
('Queue de Glourséleste', 135),
('Queue de Kanigroula', 114),
('Queue de Mantaze', 142),
('Queue de Meliglours', 135),
('Queue de Mère Veilleuse', 107),
('Queue de Rat d''Hyoactif', 44),
('Queue de Rat du Gang', 101),
('Queue de Sanglier des Plaines', 36),
('Queue de Scordion Bleu', 58),
('Queue de Sinistrofu', 142),
('Queue de Wolvero', 135),
('Queue de Yomi Givrefoux', 121),
('Queue du Boufmouth légendaire', 86),
('Queue du Fu Mansot', 100),
('Queue du Mulou', 72),
('Queue du Royalmouth', 86),
('Queue emplumée du Rasboul Majeur', 79),
('Quisnoa', 72),
('Racine d''Abraknyde', 29),
('Racine d''Abraknyde Ancestral', 65),
('Racine d''Abraknyde Sombre', 65),
('Racine d''Abraknyde Vénérable', 62),
('Racine d''Abrazif', 128),
('Racine de Tronkoblop', 44),
('Racine du Chêne Mou', 100),
('Racine sauvage', 79),
('Raie Bleue', 48),
('Ratalda', 79),
('Relique Familiale', 37),
('Relique d''Incarnam', 8),
('Relique de Blérauve', 135),
('Relique de Blérice', 135),
('Relique de Blérom', 135),
('Relique de Fleuro', 135),
('Relique du Déminoboule', 86),
('Relique du Mominotor', 86),
('Rembourrage de Meupette', 111),
('Requin Marteau-Faucille', 55),
('Reste de masticroc', 121),
('Reste de morsquale', 121),
('Restes d''Esprigné', 142),
('Restes de Fungus', 128),
('Rhubarbe à papa', 100),
('Rhum de Qualité', 65),
('Riz', 37),
('Rondelle de Bois', 30),
('Rondelles de Milirat Strubien', 23),
('Rose Nelson', 100),
('Rose à Lysa', 114),
('Rose à lys Cullen', 114),
('Rotule du Disciple Zoth', 90),
('Rouage en Or', 142),
('Roue de Tivelo', 65),
('Rouge à lèvres de Belladone', 142),
('Rougely', 45),
('Roupie de Champ à Gnons', 128),
('Royalmouclier', 86),
('Ruban d''Uchiwang', 100),
('Résidu d''alchillusion', 142),
('Résidu de Solfataré', 114),
('Sable Fin', 58),
('Sable de Wakfu', 142),
('Sablier miniature', 86),
('Sabot de Gliglicérin', 104),
('Sabot du Minotot', 114),
('Sac de Plumes', 135),
('Sac à Patates Clair', 36),
('Sac à Patates Sombre', 36),
('Sachet d''Aubergines', 23),
('Sachet d''Oignons', 16),
('Sachet d''Épices', 23),
('Sachet d''épice de mauvais goût', 36),
('Sachet de Cendres Éternelles', 23),
('Sachet de Cerises', 30),
('Sachet de Citrons', 13),
('Sachet de Feuilles de salace', 23),
('Sachet de Graisse Gélatineuse', 22),
('Sachet de Haricots', 13),
('Sachet de Poivre', 23),
('Sachet de Poudre Temporelle', 13),
('Sachet de Poudre de Perlinpainpain', 16),
('Sachet de Résine', 16),
('Sachet de Sel', 36),
('Sacoche de Kartouche', 93),
('Sacrifice d''Armutins', 142),
('Sacrifice de Brûlâmes', 142),
('Sacrifice de Goules', 142),
('Sacrifice de Maudits', 142),
('Sacrum magistral', 37),
('Salikrone', 72),
('Salopette Kwapa', 93),
('Sang Boueux', 22),
('Sang Glacé de Klime', 142),
('Sang Humide', 22),
('Sang Incandescent', 22),
('Sang Insipide', 22),
('Sang Sec', 22),
('Sang brûlant', 121),
('Sang coagulé', 142),
('Sang de Boufmouth de guerre parasité', 86),
('Sang de Boufmouth légendaire parasité', 86),
('Sang de Boufmouth parasité', 86),
('Sang de Bouftonmouth parasité', 86),
('Sang de Bouftou', 23),
('Sang de Calciné', 142),
('Sang de Harpo', 142),
('Sang de Karkanik', 142),
('Sang de Possédé', 142),
('Sang de Vampire', 30),
('Sang de Ventrublion', 142),
('Sang de Viandargh', 135),
('Sang de Wabbit GM', 44),
('Sang de Wabbit Garou', 86),
('Sang de Wolvero', 135),
('Sang de démon', 142),
('Sang du Kido', 77),
('Sang du Toxoliath', 128),
('Sang vicié du Toxoliath', 128),
('Sang visqueux du Vampire', 30),
('Sarbacane en Bambou', 93),
('Sardine Brillante', 27),
('Saucisson de Farle', 71),
('Sauge', 9),
('Saule en si', 107),
('Scalp de Bizarbwork', 65),
('Scalp de Bwariok', 142),
('Scalp de Bwork Archer', 36),
('Scalp de Klime', 142),
('Scalp de Milimulou', 23),
('Scalp de Mulounoké', 72),
('Scalp du Meulou', 72),
('Scapula de Ben le Ripate', 107),
('Scapula du Comte Harebourg', 142),
('Scarabée Chrysonéfritin', 142),
('Sceau Royal Contrefait', 36),
('Sceau du Roi Joueur', 142),
('Sceptre brisé de Kabahal', 142),
('Scorie d''Obsidiantre', 114),
('Seigle', 37),
('Sel de Baleine', 142),
('Serpe perdue', 142),
('Serpor', 79),
('Serre d''Ikargn', 142),
('Serrure du Coffre des Forgerons', 37),
('Serviette de Plage', 16),
('Serviette égarée', 142),
('Shampoing Rhoarim', 142),
('Shampooing au Kaliptus de Saphira', 50),
('Short de Capoei Rat', 79),
('Signe des Possédés', 142),
('Silex', 51),
('Silicate', 37),
('Skeunklier', 86),
('Skorille Incandescente', 22),
('Slip d''Elsoummo', 93),
('Slip de Bwork Archer', 36),
('Slip de Troollaraj', 86),
('Slip en Cuir Moulant du Garglyphe', 30),
('Slip en cuir de Cochon de Lait', 37),
('Slip en cuir de Porkass', 37),
('Slip en cuir du Chafer Lancier', 37),
('Slip feuillu de Supervizœuf', 121),
('Slip troué de Dramak', 72),
('Soie Baveuse', 65),
('Souche de l''Abrakleur clair', 114),
('Sourcil de Barbétoal', 142),
('Sourcil de Moskito', 16),
('Sourcils de Tronknyde', 34),
('Souris verte', 45),
('Spalière de Krâradia', 142),
('Sphénoïde du Kimbo', 114),
('Spores soporifiques', 79),
('Sporme du Champ Champ', 16),
('Spécimen de Krabouilleur', 142),
('Squame du Graogarm', 121),
('Stapes de Frimar', 142),
('Sternum de Chachachovage', 65),
('Sternum de Mansordide', 142),
('String de Pampactus', 93),
('String en Cuir de la Mama Bwork', 128),
('String en poils de nez', 142),
('Suc digestif', 121),
('Sueur Froide de Fantôme', 37),
('Symbole de Xélomorphe', 121),
('Symbole des Obscuranti', 135),
('Sève Putride', 142),
('Sève de Mycos', 100),
('Sépale de Drosérâle', 142),
('Sépale de Nerbe', 99),
('Sérum de Krokille', 78),
('Talon d''achille de l''Abrakleur sombre', 102),
('Tambour de Gobaladée', 30),
('Tanche', 65),
('Tanuklier', 93),
('Targe Aqueuse de Nagate', 93),
('Tatouage de Mauvais Garçon', 37),
('Temps fracassé', 86),
('Tendon de Waccro', 44),
('Tenguclier', 121),
('Tentacule Agité', 142),
('Tentacule de Démoloch', 142),
('Tentacule de Grofond', 142),
('Tentacule de N''Yalg', 142),
('Tentacule de Tentaclaque', 142),
('Terre Stérile', 142),
('Testicules Magiques de Muloubard', 72),
('Testicules Magiques du Meulou', 72),
('Testicules de Cocholou', 72),
('Testicules de Dopeul', 35),
('Testicules de Tsume-bozu', 121),
('Testicules du Tanukouï San', 93),
('Thalle de Champmane', 128),
('Tibia de Koalak Fossoyeur', 80),
('Tibia du Guerrier Zoth', 94),
('Ticentor', 79),
('Tige de Bambouto', 79),
('Tignasse de Kanihilan', 114),
('Tiques de Boufmouth', 86),
('Tissu Invisible', 28),
('Tissu Pourpre', 65),
('Tissu Sombre', 30),
('Tissu de Graboule', 65),
('Toile d''Abrakne Sombre', 65),
('Toile du cauchemar', 142),
('Toison de la Déchireuse', 142),
('Tonneau d''Eau Potable', 16),
('Tonneau d''Huile à Frire', 36),
('Tonneau de Jus Goûtu', 16),
('Tonneau de Sang de Scorbute', 35),
('Toque de Cabosseur', 142),
('Torvil', 142),
('Totem Firefoux', 100),
('Totem de la colère', 142),
('Totem de la joie', 142),
('Totem de la peur', 142),
('Totem de la surprise', 142),
('Totem de la tristesse', 142),
('Totem du dégoût', 142),
('Toubibz', 121),
('Touffe de Cheveux Blancs', 37),
('Touffe de Kabombz', 121),
('Touffe de Poils de Rubise', 50),
('Touffe de cheveux de Soissanth', 121),
('Touffe de rat de Brâkmar', 79),
('Touffe rousse du Flib', 50),
('Tourbe séchée de Tourbassingue', 80),
('Tourclier', 16),
('Tranche Magique de Krambwork', 65),
('Tranche de Nodkoko', 37),
('Tresse de Domptueuse', 142),
('Tresse du Koulosse', 72),
('Tresse du Poolay', 107),
('Trident Cassé', 37),
('Trident de Tryde', 142),
('Troisième morceau de parchemin oublié', 142),
('Trompe de la Tromperelle', 128),
('Tronc de Kokoko', 37),
('Truchlier', 93),
('Truchmuche', 87),
('Truite', 9),
('Trukikol Mort', 72),
('Trèfle à 5 feuilles', 16),
('Tuf de Mofette', 114),
('Tulipe en papier', 72),
('Tutuyutu', 44),
('Tuyau Rouillé de Rate Iboisée', 79),
('Téphra d''Atomystique', 114),
('Tête de lance de Fangshu', 100),
('Tête de mort', 93),
('Ulna de Solfataré', 114),
('Valve Étanche de Mansordide', 142),
('Venin d''Éperfide', 128),
('Venin de Serpentin', 44),
('Venin de scorbute', 51),
('Ver d''Air', 37),
('Ver d''Eau', 37),
('Ver de Feu', 37),
('Ver de Terre', 37),
('Verrou de Servitude', 142),
('Vertgely', 45),
('Vertèbre d''Obsidiantre', 114),
('Vertèbre de Trépavois', 142),
('Viande Avariée', 43),
('Viande Exsudative', 59),
('Viande Faisandée', 16),
('Viande Fraîche', 107),
('Viande Frelatée', 22),
('Viande Goûtue', 142),
('Viande Gâtée', 128),
('Viande Hachée', 13),
('Viande Intangible', 6),
('Viande Ladre', 36),
('Viande Macérée', 97),
('Viande Maigre', 113),
('Viande Minérale', 23),
('Viande Noire', 134),
('Viande Persillée', 85),
('Viande Rassie', 62),
('Viande Saignante', 50),
('Viande Salée', 23),
('Viande Sanguinolente', 44),
('Viande Séchée', 75),
('Viande Tendre', 35),
('Viande d''Alashasss', 142),
('Viande d''aventurier', 100),
('Viande de Brousse', 80),
('Viande de Caïguille', 142),
('Viande de Cronnibal', 142),
('Viande de Voapah', 142),
('Viande fraîche', 86),
('Vieille Partition', 37),
('Vieille Ventouse de Kralamoure', 80),
('Vieille peluche Féca', 86),
('Vieux Bouquin de Rat Li', 79),
('Vieux magazine', 142),
('Viscères congelés', 100),
('Viscères de Balebz', 121),
('Viscères de Scarafeuille', 30),
('Viscères de Scorbute', 51),
('Viscères de Tanuki', 93),
('Viscères du Grand Jeu', 142),
('Viscères du Scarabosse Doré', 30),
('Volonté de Corruption', 142),
('Volonté de Guerre', 142),
('Volonté de Misère', 142),
('Volonté de Servitude', 142),
('Volve d''Aminite', 8),
('Volve de Fistulor', 128),
('Volve de Fongeur', 128),
('Volve de Mérulor', 142),
('Vomer d''Apériglours', 135),
('Vortexlier', 142),
('Yokayu', 121),
('Yucca Lélé', 86),
('Zœuf de Balebz', 121),
('Zœuf de Kamikabz', 121),
('Zœuf de Quadrabz', 121),
('Zœuf de Toubibz', 121),
('Âme de Boulanger Sombre', 35),
('Âme de Calciné', 142),
('Âme de Forgeron Sombre', 37),
('Âme de Mineur Sombre', 37),
('Âme de Possédé', 142),
('Âme de Seith', 121),
('Âme de Trantroâ', 121),
('Âme de Trezz', 121),
('Âme de Vindeux', 121),
('Âmes capturées : Blop Multicolore Royal & Blops Royaux', 86),
('Âmes capturées : Comte Harebourg & Klime', 142),
('Âmes capturées : Comte Harebourg & Missiz Frizz', 142),
('Âmes capturées : Comte Harebourg & Nileza', 142),
('Âmes capturées : Comte Harebourg & Sylargh', 142),
('Âmes capturées : Fuji Givrefoux Nourricière & Tengu Givrefoux', 135),
('Âmes capturées : Gelées Royales', 44),
('Âmes capturées : Minotot & Minotoror', 114),
('Âmes capturées : Sphincter Cell, Rat Blanc & Rat Noir', 107),
('Âmes capturées : Tynrils', 100),
('Écaille de Chef Crocodaille', 50),
('Écaille de Crocodaille', 37),
('Écaille de Dragoss Ardoise', 72),
('Écaille de Dragoss Argile', 72),
('Écaille de Dragoss Calcaire', 72),
('Écaille de Dragoss Charbon', 72),
('Écaille de Draguaindrop', 86),
('Écaille de Gambaf', 142),
('Écaille de Harpirate', 107),
('Écaille de Torkélonia', 142),
('Écaille poisseuse', 16),
('Écailles d''Ouroboulos', 58),
('Échantillon d''Éperfide saine', 128),
('Échantillon de Créature Contaminée', 30),
('Échantillon de Fungus', 128),
('Échantillon de Lucrane sain', 128),
('Échantillon de Puceronde saine', 128),
('Échantillon de Sang d''Enutrofor', 142),
('Échantillon de Scoliopode sain', 128),
('Échantillon de viande contaminée', 13),
('Échantillon frais de Mojo du Meulou', 72),
('Écharpe de Hanshi', 100),
('Échasse de Molette', 71),
('Écho du Passé', 107),
('Éclat Kao brisé', 142),
('Éclat Obscur', 135),
('Éclat d''océan', 142),
('Éclat de trouvaille', 23),
('Éclat du Mawabouaino', 44),
('Écorce d''Abrakne Sombre', 65),
('Écorce d''Abraknyde Vénérable', 62),
('Écorce d''Abrazif', 128),
('Écorce de Brouture', 99),
('Écorce de Champaknyde', 128),
('Écorce de Chiendent', 98),
('Écorce de Floribonde', 101),
('Écorce de Fécorce', 100),
('Écorce de Liroye Merline', 65),
('Écorce de Nerbe', 99),
('Écume de mer', 72),
('Écumouth Collant', 100),
('Écusson du Sergent Zoth', 97),
('Éklat Juvénile', 20),
('Éklat Mature', 90),
('Éklat Novice', 55),
('Éklat Vénérable', 124),
('Éklat de Krokage la Vorace', 113),
('Éklat de Krokblanche l''Immaculée', 43),
('Éklat de Krokcinelle la Tâchetée', 22),
('Éklat de Krokenjambe la Tombeuse', 43),
('Éklat de Krokette la Croustillante', 22),
('Éklat de Krokikrisp la Céréalière', 22),
('Éklat de Krokillage la Marine', 22),
('Éklat de Krokillagée la Sage', 113),
('Éklat de Krokine l''Allumeuse', 78),
('Éklat de Krokis l''Esquissée', 22),
('Éklat de Kroknemboure la Mousseuse', 78),
('Éklat de Krokobure la Maudite', 113),
('Éklat de Krokotte la Minutée', 43),
('Éklat de Krokpit la Pilotée', 78),
('Éklat de Krokrane la Distordue', 113),
('Éklat de Krokrodaille la Mordante', 78),
('Éklat de Kroktail la Désaltérante', 43),
('Éklat de Krokue la Trompée', 78),
('Éklat de Krokuite la Calcinée', 113),
('Éklat de Krokée l''Entamée', 43),
('Élastique de Gobvious', 71),
('Élastique de barbe de Sanglirok', 135),
('Énigme du festival des lanternes', 100),
('Énorme Boîte de Cœur', 79),
('Épaule de Maléphisto', 142),
('Épaulière de Bourôliste', 142),
('Épaulière de Bwork', 37),
('Épaulière de Dazak Martegel', 142),
('Épaulière de Ferrailleur', 142),
('Épaulière de Kabushido', 114),
('Épaulière de Troolligark', 86),
('Épine d''Armuguet', 142),
('Épine d''Ougah', 128),
('Épine de Bulbuisson', 79),
('Épine de Diondin', 142),
('Épine de Grath', 79),
('Épine du Champ Champ', 16),
('Épingle à Cheveux de Saphira', 50),
('Épée du Wa Dunow', 23),
('Étain', 37),
('Étamine de Floribonde', 101),
('Étoffe Magique de Moon', 72),
('Étoffe Zoth', 90),
('Étoffe d''Écurouille', 23),
('Étoffe de Choudini', 65),
('Étoffe de Croleur', 135),
('Étoffe de Dok Alako', 57),
('Étoffe de Draegnerys', 51),
('Étoffe de Firefoux', 100),
('Étoffe de Foufayteur', 52),
('Étoffe de Gliglidoudur', 104),
('Étoffe de Glourmand', 135),
('Étoffe de Gourlo le Terrible', 51),
('Étoffe de Grodruche', 142),
('Étoffe de Kaniblou', 113),
('Étoffe de Kaniglou', 100),
('Étoffe de Kolosso', 135),
('Étoffe de Kurookin', 100),
('Étoffe de Meupette', 111),
('Étoffe de Ouassingue', 75),
('Étoffe de Rat Bougri', 65),
('Étoffe de Samouraï fantôme', 114),
('Étoffe de Sphincter Cell', 107),
('Étoffe de Vigie Pirate', 107),
('Étoffe de la Cour Sombre', 142),
('Étoffe du Fauchalak', 86),
('Étoffe du Mulou', 72),
('Étoffe du Roissingue', 134),
('Étoffe du Sanglier', 23),
('Étoffe du Wa Wabbit', 44),
('Étoffe du Wabbit', 38),
('Étoffe sanglante', 142),
('Étoile d''Or d''El Piko', 93),
('Œil Bionique', 44),
('Œil d''Abrakne', 37),
('Œil d''Arakmuté', 13),
('Œil de Boufmouth de guerre', 86),
('Œil de Branche Invocatrice', 100),
('Œil de Branche Soignante', 100),
('Œil de Chakichan', 114),
('Œil de Champmane', 128),
('Œil de Chargus', 114),
('Œil de Chasquatch', 114),
('Œil de Cocholou', 72),
('Œil de Crabe Hijacob', 65),
('Œil de Craquelope', 51),
('Œil de Crocodaille albinos', 142),
('Œil de Crowneille', 51),
('Œil de Cycloïde', 142),
('Œil de Dawaj', 142),
('Œil de Dramanite', 128),
('Œil de Feutôme', 142),
('Œil de Fleuro', 135),
('Œil de Gouligane', 142),
('Œil de Halbardent', 142),
('Œil de Harpille', 142),
('Œil de Harpo', 142),
('Œil de Harrogant', 142),
('Œil de Kanigrou', 51),
('Œil de Korriandre', 128),
('Œil de Krokille', 43),
('Œil de Kwoan', 30),
('Œil de Larve bleue', 16),
('Œil de Léolhyène', 58),
('Œil de Madura', 121),
('Œil de Morcac', 79),
('Œil de Phozami', 107),
('Œil de Pikdoa', 23),
('Œil de Ramane Strubien', 23),
('Œil de Rat du Gang', 101),
('Œil de Raul Mops', 37),
('Œil de Saltik', 65),
('Œil de Sapeur', 135),
('Œil de Shokkoth', 142),
('Œil de Tofu Noir', 30),
('Œil de Truchtine', 85),
('Œil de Verminocule', 142),
('Œil de Vigie Pirate', 107),
('Œil de Wabbit Céphale', 86),
('Œil du Kharnozor', 72),
('Œil du Père Ver', 121),
('Œil torve de Fricochère', 100),
('Œuf Chimérique', 6),
('Œuf Fécondé de Haute Truche', 93),
('Œuf Pourri', 30),
('Œuf Végétal', 79),
('Œuf d''Arak-haï', 65),
('Œuf de Crapeur', 114),
('Œuf de Dragoeuf Ardoise', 51),
('Œuf de Dragoeuf Argile', 51),
('Œuf de Dragoeuf Calcaire', 51),
('Œuf de Dragoeuf Charbon', 51),
('Œuf de Gobus', 135),
('Œuf de Haute Truche', 93),
('Œuf de Larve Dorée', 16),
('Œuf de Monarque', 86),
('Œuf de Tofu', 30),
('Œuf de Tofubine', 86),
('Œuf de larve', 135),
('Œuf du Mansot Royal', 100),
('Œuf noir', 65),
('Œuf suwpwise', 44),
('Œufs de Scarafeuille', 31)
on conflict (key) do update set base = excluded.base where s1.vente_base.base is distinct from excluded.base;

reset search_path;

-- ======================== supabase/vente.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus 1.0.30 « L'économie » : vente directe des ressources au jeu (choix 13 à 17).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger : ne supprime ni ne modifie
-- aucune donnée de joueur (seul l'historique des prix de plus de 4 jours est effacé au fil des ventes).
--
-- Prix d'une unité = prix de base (vente_base, écrit par supabase/vente_data.sql) × coef de la ressource.
-- Le coef est commun à tout le serveur, de ×0,1 (plancher) à ×3 (plafond) :
--   - chaque vente le fait baisser de quantité / 2 000 (vendre 2 000 unités : −1) ; un gros lot est payé unité par
--     unité au coef du moment (aire sous le coef) : il baisse pendant la vente ;
--   - sans vente, il remonte tout seul vers ×3 : la moitié de l'écart en 6 h.
-- Équilibre pour r unités vendues par heure : coef = 3 − r / 231. Même calcul dans le jeu (E.VENTE, js/vente.js ;
-- tests/vente.test.js le vérifie).
-- Une vente passe comme celles de l'Hôtel de vente (supabase/hdv.sql) : le serveur vérifie la ressource dans la
-- partie en ligne (hdv_save, hdv_qty) puis écrit une opération (hdv_op : kamas +, ressource −) que le jeu applique
-- et dont il garde le numéro (S.hdv.op, paramètre p_after).
-- Guilde (branche des guildes) : si s1.guild_sale_share(uuid, bigint) existe, elle verse la part de la guilde au
-- coffre et renvoie le montant pris ; si s1.guild_has_upgrade(uuid, text) dit vrai pour 'comptoir', +5 % au prix.
-- Sans ces fonctions, la vente marche pareil, sans part ni bonus.
-- Le jeu ne touche jamais les tables : tout passe par vente_sell, vente_cours et vente_courbe.
-- ============================================================================
create table if not exists s1.vente_base (key text primary key, base int not null);
alter table s1.vente_base enable row level security;

create table if not exists s1.vente_cours (
  key text primary key,
  c real not null default 3,               -- coef à l'instant t
  v real not null default 0,               -- volume vendu récemment, à l'instant t (s'efface de moitié en 6 h)
  t timestamptz not null default now()
);
alter table s1.vente_cours enable row level security;

-- Une ligne par ressource et par heure : quantité vendue, coef juste après la dernière vente de l'heure (courbe 48 h)
create table if not exists s1.vente_hist (
  key text not null,
  h timestamptz not null,                  -- début de l'heure
  q bigint not null default 0,
  c real not null,
  t timestamptz not null,                  -- moment de la dernière vente de l'heure
  primary key (key, h)
);
create index if not exists vente_hist_h on s1.vente_hist (h);
alter table s1.vente_hist enable row level security;

create table if not exists s1.vente_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  t timestamptz not null default now(),    -- début de la tranche de 10 minutes
  n int not null default 0                 -- ventes dans la tranche (60 au plus)
);
alter table s1.vente_quota enable row level security;

-- Coef et volume maintenant, depuis leur valeur à l'instant t (21 600 s = 6 h : la moitié de l'écart).
create or replace function s1.vente_c(c real, t timestamptz) returns double precision language sql stable as $$
  select least(3, greatest(0.1, 3 - (3 - c) * power(2::double precision, -greatest(0, extract(epoch from now() - t))::double precision / 21600)))
$$;
create or replace function s1.vente_v(v real, t timestamptz) returns double precision language sql stable as $$
  select greatest(0, v * power(2::double precision, -greatest(0, extract(epoch from now() - t))::double precision / 21600))
$$;

-- Comptoir de guilde : +5 % (seulement si la fonction des guildes existe)
create or replace function s1.vente_up(p_user uuid) returns boolean language plpgsql stable security definer set search_path = s1, public
as $$
declare up boolean := false;
begin
  if p_user is null or to_regprocedure('s1.guild_has_upgrade(uuid,text)') is null then return false; end if;
  begin execute 'select coalesce(s1.guild_has_upgrade($1, $2), false)' into up using p_user, 'comptoir';
  exception when others then up := false;
  end;
  return coalesce(up, false);
end $$;

-- ---------- fonctions appelées par le jeu ----------
-- Vendre des ressources : p_lots = { "ressource": quantité, … } (40 ressources au plus). Le serveur vend ce que la
-- partie en ligne contient vraiment (au plus la quantité demandée). Renvoie { ok, sold: { ressource: quantité },
-- k (kamas reçus), share (part du coffre de guilde), up (Comptoir de guilde), c: { ressource: [coef, volume] }, ops }.
create or replace function s1.vente_sell(p_after bigint, p_lots jsonb) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; e record; b int; q bigint; have numeric; r vente_cours; cnt int; up boolean;
  c0 double precision; v0 double precision; c1 double precision; q1 double precision; units double precision;
  k bigint; ktot bigint := 0; share bigint := 0; nq bigint := 0; nk int := 0; one text;
  sold jsonb := '{}'::jsonb; res jsonb := '{}'::jsonb; cs jsonb := '{}'::jsonb; fn regprocedure; txt text;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(replace(sqlerrm, 'l''hôtel de vente', 'la vente directe')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if p_lots is null or jsonb_typeof(p_lots) <> 'object' then return hdv_err('Vente invalide.'); end if;
  if (select count(*) from jsonb_object_keys(p_lots)) > 40 then return hdv_err('40 ressources au plus d''un coup.'); end if;
  -- 60 ventes par tranche de 10 minutes au plus
  insert into vente_quota as x (user_id, t, n) values (me, now(), 1)
    on conflict (user_id) do update set t = case when x.t < now() - interval '10 minutes' then now() else x.t end,
      n = case when x.t < now() - interval '10 minutes' then 1 else x.n + 1 end
    returning x.n into cnt;
  if cnt > 60 then return hdv_err('Trop de ventes d''un coup : réessaie dans quelques minutes.'); end if;
  up := vente_up(me);
  -- dans l'ordre des noms : deux vendeurs verrouillent les lignes dans le même ordre (pas d'interblocage)
  for e in select j.key, j.value from jsonb_each(p_lots) j order by j.key loop
    q := case when jsonb_typeof(e.value) = 'number' then least(10000000, greatest(0, floor((e.value)::text::numeric)))::bigint else 0 end;
    if q < 1 then continue; end if;
    select base into b from vente_base where key = e.key;
    if b is null or b < 1 then continue; end if;
    have := hdv_qty(me, d, 'res', e.key);
    q := least(q, floor(have)::bigint);
    if q < 1 then continue; end if;
    insert into vente_cours (key) values (e.key) on conflict (key) do nothing;
    select * into r from vente_cours where key = e.key for update;
    c0 := vente_c(r.c, r.t); v0 := vente_v(r.v, r.t);
    c1 := c0 - q / 2000.0;
    if c1 >= 0.1 then units := q * (c0 + c1) / 2;                                   -- le coef baisse en ligne droite pendant la vente
    else q1 := (c0 - 0.1) * 2000; units := q1 * (c0 + 0.1) / 2 + (q - q1) * 0.1; c1 := 0.1; -- le plancher est atteint en route
    end if;
    k := floor(b * units * (case when up then 1.05 else 1 end) + 1e-9);
    update vente_cours set c = c1, v = v0 + q, t = now() where key = e.key;
    insert into vente_hist as hh (key, h, q, c, t) values (e.key, date_trunc('hour', now()), q, c1, now())
      on conflict (key, h) do update set q = hh.q + excluded.q, c = excluded.c, t = excluded.t;
    ktot := ktot + k; nq := nq + q; nk := nk + 1; one := e.key;
    res := res || jsonb_build_object(e.key, -q); sold := sold || jsonb_build_object(e.key, q);
    cs := cs || jsonb_build_object(e.key, jsonb_build_array(round(c1::numeric, 4), round((v0 + q)::numeric, 1)));
  end loop;
  if nk = 0 then return hdv_err('Rien à vendre : ta partie en ligne n''a pas ces ressources (attends quelques secondes et réessaie).'); end if;
  -- part de la guilde (fonction de la branche des guildes : elle verse au coffre et renvoie le montant pris)
  fn := to_regprocedure('s1.guild_sale_share(uuid,bigint)');
  if ktot > 0 and fn is not null and pg_get_function_result(fn) in ('bigint', 'integer', 'numeric', 'smallint') then
    begin execute 'select coalesce(s1.guild_sale_share($1, $2), 0)::bigint' into share using me, ktot;
    exception when others then share := 0; -- coffre indisponible : tout revient au vendeur
    end;
    share := least(greatest(coalesce(share, 0), 0), ktot);
  end if;
  txt := 'Vente directe : ' || case when nk = 1 then nq || ' × ' || one else nk || ' ressources (' || nq || ' unités)' end
    || ' pour ' || (ktot - share) || ' kamas' || case when share > 0 then ' (+' || share || ' pour le coffre de ta guilde)' else '' end;
  perform hdv_op(me, jsonb_build_object('k', ktot - share, 'res', res, 'vd', 1), txt);
  -- de temps en temps : l'historique de plus de 4 jours et les vieux compteurs s'effacent
  if random() < 0.02 then
    delete from vente_hist where h < now() - interval '4 days';
    delete from vente_quota where t < now() - interval '1 day';
  end if;
  return jsonb_build_object('ok', true, 'sold', sold, 'k', ktot - share, 'share', share, 'up', up, 'c', cs, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Tous les coefs : { c: { ressource: [coef, volume récent, vendues en 24 h] }, up, t (heure du serveur en ms) }.
-- Les ressources absentes sont au plafond ×3, sans vente récente. Le jeu la relit toutes les 15 minutes au plus,
-- et calcule la remontée entre deux lectures (E.venteNow).
create or replace function s1.vente_cours() returns jsonb language plpgsql stable security definer set search_path = s1, public
as $$
begin
  return jsonb_build_object(
    'c', coalesce((select jsonb_object_agg(x.key, jsonb_build_array(round(x.cc::numeric, 3), round(x.vv::numeric, 1), coalesce(s.q, 0)))
      from (select key, vente_c(c, t) cc, vente_v(v, t) vv from vente_cours) x
      left join (select key, sum(q) q from vente_hist where h > now() - interval '24 hours' group by key) s on s.key = x.key
      where x.cc < 2.995 or x.vv >= 1 or coalesce(s.q, 0) > 0), '{}'::jsonb),
    'up', vente_up(auth.uid()),
    't', floor(extract(epoch from now()) * 1000));
end $$;

-- Courbe d'une ressource : { pts: [[t (ms), coef, quantité], …] (une ligne par heure, 4 jours au plus), c: [coef, volume], base, t }
create or replace function s1.vente_courbe(p_key text) returns jsonb language sql stable security definer set search_path = s1, public
as $$
  select jsonb_build_object(
    'pts', coalesce((select jsonb_agg(jsonb_build_array(floor(extract(epoch from t) * 1000), round(c::numeric, 3), q) order by h)
      from vente_hist where key = p_key and h > now() - interval '4 days'), '[]'::jsonb),
    'c', coalesce((select jsonb_build_array(round(vente_c(c, t)::numeric, 3), round(vente_v(v, t)::numeric, 1)) from vente_cours where key = p_key), jsonb_build_array(3, 0)),
    'base', (select base from vente_base where key = p_key),
    't', floor(extract(epoch from now()) * 1000))
$$;

-- ---------- droits ----------
do $$
declare f text;
begin
  foreach f in array array['vente_c(real, timestamptz)', 'vente_v(real, timestamptz)', 'vente_up(uuid)'] loop
    execute 'revoke all on function s1.' || f || ' from public, anon, authenticated';
  end loop;
  execute 'revoke all on function s1.vente_sell(bigint, jsonb) from public, anon';
  execute 'grant execute on function s1.vente_sell(bigint, jsonb) to authenticated';
  foreach f in array array['vente_cours()', 'vente_courbe(text)'] loop
    execute 'revoke all on function s1.' || f || ' from public';
    execute 'grant execute on function s1.' || f || ' to anon, authenticated';
  end loop;
end $$;

reset search_path;

-- ======================== supabase/foire.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus 1.0.30 « L'économie » : Jackpot du serveur de la Foire du Trool (choix 28C).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger : ne supprime ni ne modifie
-- aucune donnée de joueur.
--
-- Un ticket coûte 10 000 kamas : 9 000 vont au pot de l'heure, 1 000 sortent du jeu. Tickets illimités depuis la 1.0.32.6
-- (Mathis, 14/10/2026 : « ticket illimité pour le jackpot ») ; avant, 100 tickets par jour (heure de
-- Paris) et par joueur au plus. À la fin de chaque heure, un gagnant est tiré au sort parmi les tickets de l'heure
-- (chaque ticket est une chance) et reçoit tout le pot.
-- Pas de tâche planifiée : le tirage d'une heure finie se fait au premier appel qui suit (foire_jackpot, que le jeu
-- appelle quand la page est ouverte ou quand le joueur a des tickets d'une heure finie, ou foire_jackpot_buy).
-- Les kamas passent comme ceux de l'Hôtel de vente (supabase/hdv.sql) : le serveur vérifie les kamas dans la partie en
-- ligne (hdv_save, hdv_kamas) et écrit des opérations (hdv_op) : −10 000 par ticket à l'achat, + le pot au gagnant.
-- Les Caisses du Trool, elles, se jouent dans la partie (js/foire.js) : elles ne passent pas par le serveur.
-- ============================================================================
create table if not exists s1.foire_tickets (
  hour timestamptz not null,               -- début de l'heure du tirage
  user_id uuid not null references auth.users (id) on delete cascade,
  n int not null default 0,                -- tickets de ce joueur pour cette heure
  day date not null,                       -- jour (heure de Paris) de l'achat, pour la limite de 100 par jour
  primary key (hour, user_id)
);
create index if not exists foire_tickets_user on s1.foire_tickets (user_id, day);
alter table s1.foire_tickets enable row level security;

create table if not exists s1.foire_draws (
  hour timestamptz primary key,
  pot bigint not null default 0,
  tickets int not null default 0,
  players int not null default 0,
  winner uuid,
  pseudo text,
  at timestamptz not null default now()
);
alter table s1.foire_draws enable row level security;

-- Tire au sort les heures finies qui n'ont pas encore de gagnant (verrou exclusif : un seul tirage à la fois ;
-- les achats prennent le même verrou en partage, un tirage attend donc les achats en cours).
create or replace function s1.foire_resolve() returns void language plpgsql security definer set search_path = s1, public
as $$
declare H timestamptz; tot bigint; pl int; w uuid; ps text; done int;
begin
  if not exists (select 1 from foire_tickets t where t.hour < date_trunc('hour', clock_timestamp())
      and not exists (select 1 from foire_draws d where d.hour = t.hour)) then return; end if;
  perform pg_advisory_xact_lock(hashtext('foire_draw'));
  for H in select distinct t.hour from foire_tickets t where t.hour < date_trunc('hour', clock_timestamp())
      and not exists (select 1 from foire_draws d where d.hour = t.hour) order by 1 limit 48 loop
    select coalesce(sum(n), 0), count(*) filter (where n > 0) into tot, pl from foire_tickets where hour = H;
    w := null; ps := null;
    if tot > 0 then
      -- tirage pondéré : chaque ticket est une chance (course d'exponentielles)
      select user_id into w from foire_tickets where hour = H and n > 0 order by -ln(1 - random()) / n limit 1;
      select pseudo into ps from profiles where id = w;
    end if;
    insert into foire_draws (hour, pot, tickets, players, winner, pseudo) values (H, tot * 9000, tot, pl, w, ps) on conflict (hour) do nothing;
    get diagnostics done = row_count;
    if done = 1 and w is not null then
      perform hdv_op(w, jsonb_build_object('k', tot * 9000, 'jack', 1),
        'Jackpot du Trool : tu remportes le pot de ' || replace(to_char(tot * 9000, 'FM999,999,999,999'), ',', ' ') || ' kamas (' || tot || ' tickets) !');
      -- 1.0.30.6 « Grande annonce du Jackpot » : tout le serveur voit le gagnant en plein écran (js/giga.js), puis la ligne
      -- reste dans le chat Général. Seulement pour un tirage récent (pas pour une vieille heure tirée en retard).
      if H >= date_trunc('hour', clock_timestamp()) - interval '2 hours' then
        insert into chat_msgs (ch, user_id, pseudo, kind, data) values ('g', w, ps, 'ann',
          jsonb_build_object('t', 'jack', 'k', tot * 9000, 'n', tot, 'pl', pl, 'h', floor(extract(epoch from H) * 1000),
          'srv', case current_schema() when 's1' then 's' else 'e' end)); -- 2.2.4.11 (ticket #173) : plein écran seulement sur le serveur du tirage
      end if;
    end if;
  end loop;
end $$;

-- État du Jackpot : { hour, end (ms), pot, tickets, players, mine (mes tickets de l'heure), day (mes tickets du jour),
-- max, last: [{ p, k, n, h }] (derniers gagnants), wait: [heures finies où j'ai des tickets pas encore tirées] }
create or replace function s1.foire_state(p_user uuid) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare H timestamptz := date_trunc('hour', clock_timestamp()); dd date := (clock_timestamp() at time zone 'Europe/Paris')::date;
begin
  return jsonb_build_object(
    'hour', floor(extract(epoch from H) * 1000), 'end', floor(extract(epoch from H + interval '1 hour') * 1000),
    'now', floor(extract(epoch from clock_timestamp()) * 1000),
    'pot', coalesce((select sum(n) from foire_tickets where hour = H), 0) * 9000,
    'tickets', coalesce((select sum(n) from foire_tickets where hour = H), 0),
    'players', (select count(*) from foire_tickets where hour = H and n > 0),
    'mine', coalesce((select n from foire_tickets where hour = H and user_id = p_user), 0),
    'day', coalesce((select sum(n) from foire_tickets where user_id = p_user and day = dd), 0),
    'max', 0, -- 0 : pas de limite (1.0.32.6)
    'last', coalesce((select jsonb_agg(jsonb_build_object('p', coalesce(pseudo, '?'), 'k', pot, 'n', tickets, 'h', floor(extract(epoch from hour) * 1000), 'me', winner = p_user) order by hour desc)
      from (select * from foire_draws where winner is not null order by hour desc limit 6) x), '[]'::jsonb));
end $$;

-- ---------- fonctions appelées par le jeu ----------
-- Lire le Jackpot (tire au sort les heures finies au passage). Sans compte : le pot et les derniers gagnants.
create or replace function s1.foire_jackpot() returns jsonb language plpgsql security definer set search_path = s1, public
as $$
begin
  perform foire_resolve();
  return foire_state(auth.uid());
end $$;

-- Acheter p_n tickets (1 à 100 d'un coup, sans limite par jour depuis la 1.0.32.6) pour le tirage de l'heure.
create or replace function s1.foire_jackpot_buy(p_after bigint, p_n int) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; n int := coalesce(p_n, 0); H timestamptz; dd date;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(replace(sqlerrm, 'l''hôtel de vente', 'le Jackpot')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if n < 1 or n > 100 then return hdv_err('De 1 à 100 tickets d''un coup.'); end if;
  perform foire_resolve();
  perform pg_advisory_xact_lock_shared(hashtext('foire_draw'));
  H := date_trunc('hour', clock_timestamp()); dd := (clock_timestamp() at time zone 'Europe/Paris')::date;
  if hdv_kamas(me, d) < n * 10000 then return hdv_err('Pas assez de kamas (ou ta partie en ligne n''est pas encore à jour : attends quelques secondes).'); end if;
  insert into foire_tickets as x (hour, user_id, n, day) values (H, me, n, dd)
    on conflict (hour, user_id) do update set n = x.n + excluded.n;
  perform hdv_op(me, jsonb_build_object('k', -n * 10000, 'jt', n),
    'Jackpot du Trool : ' || n || ' ticket' || case when n > 1 then 's' else '' end || ' pour ' || replace(to_char(n * 10000, 'FM999,999,999'), ',', ' ') || ' kamas');
  return foire_state(me) || jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- ---------- droits ----------
do $$
begin
  execute 'revoke all on function s1.foire_resolve() from public, anon, authenticated';
  execute 'revoke all on function s1.foire_state(uuid) from public, anon, authenticated';
  execute 'revoke all on function s1.foire_jackpot() from public';
  execute 'grant execute on function s1.foire_jackpot() to anon, authenticated';
  execute 'revoke all on function s1.foire_jackpot_buy(bigint, int) from public, anon';
  execute 'grant execute on function s1.foire_jackpot_buy(bigint, int) to authenticated';
end $$;

reset search_path;

-- ======================== supabase/chromatiques.sql ========================
set search_path = s1, public;
-- ============================================================================
-- 1.0.33 : CHROMATIQUES (js/chroma.js, js/chromaui.js).
-- Le jeu envoie dans le résumé de la partie (saves.meta, VERIFY.summary) : chroma (nombre d'espèces de l'album),
-- chromaVit (vitrine : [[monstre, prismatique 0/1]] ×3 au plus) et chromaNew (les 3 dernières nouveautés de l'album).
-- Classement « Chromatiques » (vue lb_chroma) et vitrine de la fiche joueur : sans aucun envoi en plus (14A).
-- Hauts faits : « X trouve un Y chromatique ! », une seule fois par compte et par espèce (et une fois de plus quand
-- l'espèce devient prismatique). Comme les Dofus Sublimés (collections.sql) : seulement pour une partie classée,
-- jamais pour un compte signalé (chat_ann le vérifie). Rien ne rapporte de kamas ni d'objet ici.
-- Relançable : create ... if not exists, create or replace, drop trigger if exists. Aucune donnée de joueur n'est
-- modifiée ni supprimée.
-- ============================================================================
create table if not exists s1.chroma_board (
  user_id uuid primary key references auth.users (id) on delete cascade,
  n int not null default 0,
  vit jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table s1.chroma_board enable row level security; -- lu par la vue lb_chroma seulement
create table if not exists s1.chroma_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  k text not null check (k ~ '^m[0-9]{1,6}$'),
  p boolean not null default false,
  at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table s1.chroma_seen enable row level security; -- aucune règle : seule la fonction ci-dessous y touche

create or replace function s1.chroma_from_save() returns trigger language plpgsql security definer set search_path = s1, public
as $$ declare bad boolean; vn int; vv jsonb; x jsonb; vk text; pr boolean; o boolean; begin
  if new.meta is null or jsonb_typeof(new.meta->'chroma') is distinct from 'number' then return new; end if;
  select flagged into bad from ladder where user_id = new.user_id;
  if not found or bad then return new; end if;
  vn := least(greatest(coalesce((new.meta->>'chroma')::int, 0), 0), 2000);
  select coalesce(jsonb_agg(jsonb_build_array(e->>0, case when (e->>1) = '1' then 1 else 0 end)), '[]'::jsonb) into vv
    from (select e from jsonb_array_elements(case when jsonb_typeof(new.meta->'chromaVit') = 'array' then new.meta->'chromaVit' else '[]'::jsonb end) e
          where jsonb_typeof(e) = 'array' and (e->>0) ~ '^m[0-9]{1,6}$' limit 3) s;
  insert into chroma_board (user_id, n, vit, updated_at) values (new.user_id, vn, vv, now())
    on conflict (user_id) do update set n = excluded.n, vit = excluded.vit, updated_at = now();
  if jsonb_typeof(new.meta->'chromaNew') = 'array' then
    for x in select e from jsonb_array_elements(new.meta->'chromaNew') e where jsonb_typeof(e) = 'array' limit 3 loop
      vk := x->>0; pr := (x->>1) = '1';
      if vk is null or vk !~ '^m[0-9]{1,6}$' then continue; end if;
      select p into o from chroma_seen where user_id = new.user_id and chroma_seen.k = vk;
      if not found then
        insert into chroma_seen (user_id, k, p) values (new.user_id, vk, pr);
        perform chat_ann(new.user_id, jsonb_build_object('t', 'chroma', 'k', vk, 'p', case when pr then 1 else 0 end));
      elsif pr and not o then
        update chroma_seen set p = true, at = now() where user_id = new.user_id and chroma_seen.k = vk;
        perform chat_ann(new.user_id, jsonb_build_object('t', 'chroma', 'k', vk, 'p', 1));
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function s1.chroma_from_save() from public, anon, authenticated;
-- après saves_ladder (les déclencheurs passent par ordre alphabétique : saves_chroma < saves_ladder ne marche pas),
-- d'où le nom saves_zchroma : la ligne du classement (flagged) est déjà à jour
drop trigger if exists saves_zchroma on s1.saves;
drop trigger if exists saves_zchroma on s1.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_zchroma after insert or update on s1.saves_ok for each row execute function s1.chroma_from_save();

create or replace view s1.lb_chroma as
  select c.user_id, p.pseudo, l.main, l.main_lvl, c.n, c.vit
  from s1.chroma_board c join s1.ladder l on l.user_id = c.user_id join public.profiles p on p.id = c.user_id where not l.flagged;
grant select on s1.lb_chroma to anon, authenticated;

reset search_path;

-- ======================== supabase/alliances_data.sql ========================
set search_path = s1, public;
-- Généré par tools/build_alliances.js — ne pas modifier à la main.
-- Régions de la carte (un prisme par région) et région de chaque zone ou donjon (domination des régions).
create table if not exists s1.prism_regions (zone text primary key, name text not null, lo int not null, hi int not null);
alter table s1.prism_regions enable row level security;
create table if not exists s1.prism_sids (sid text primary key, zone text not null);
alter table s1.prism_sids enable row level security;
insert into s1.prism_regions (zone, name, lo, hi) values
('incarnam', 'Incarnam', 1, 11),
('astrub', 'Astrub', 11, 40),
('amakna', 'Amakna', 16, 150),
('cania', 'Plaines de Cania', 24, 160),
('wabbit', 'Île des Wabbits', 40, 120),
('sidimote', 'Landes de Sidimote', 62, 200),
('koalaks', 'Montagne des Koalaks', 60, 120),
('albuera', 'Albuera', 42, 50),
('abrak', 'Forêt des Abraknydes', 33, 100),
('moon', 'Île de Moon', 42, 100),
('dragoeufs', 'Terres des Dragoeufs', 62, 120),
('otomai', 'Île d''Otomaï', 20, 189),
('minotoror', 'Île du Minotoror', 102, 128),
('pandala', 'Île de Pandala', 102, 140),
('frigost', 'Île de Frigost', 82, 200),
('saharach', 'Saharach', 72, 200),
('pwak', 'Île de Pwâk', 52, 200),
('divines', 'Dimensions divines', 92, 200),
('asse', 'Îlots de la mer d''Asse', 89, 100),
('bontabrak', 'Bonta et Brâkmar', 16, 112),
('grobe', 'Île de Grobe', 152, 170),
('sakai', 'Île de Sakaï', 182, 190),
('valonia', 'Archipel de Valonia', 182, 200),
('nimotopia', 'Nimotopia', 182, 190),
('obscure', 'Dimension Obscure', 182, 190),
('harebourg', 'Frigost : Harebourg', 200, 200),
('sufokia', 'Baie de Sufokia', 200, 200),
('cavaliers', 'Dimensions des Cavaliers', 200, 200),
('wukin', 'Wukin et Wukang', 200, 200),
('possedes', 'Atoll des Possédés', 200, 200),
('ecailles', 'Archipel des Écailles', 200, 200),
('vulkania', 'Archipel de Vulkania', 20, 175)
on conflict (zone) do update set name = excluded.name, lo = excluded.lo, hi = excluded.hi;
insert into s1.prism_sids (sid, zone) values
('abr_arakhai', 'abrak'),
('abr_oree', 'abrak'),
('abr_oree_abrak', 'abrak'),
('abr_sombre', 'abrak'),
('akademie_gobs', 'amakna'),
('alb_futaie', 'albuera'),
('ama_bandits', 'amakna'),
('ama_boos', 'amakna'),
('ama_bouftous', 'amakna'),
('ama_bworks', 'amakna'),
('ama_campagne', 'amakna'),
('ama_cimetiere', 'amakna'),
('ama_citwouilles', 'amakna'),
('ama_cloaque', 'amakna'),
('ama_craqueleurs', 'amakna'),
('ama_cryptes', 'amakna'),
('ama_cryptes_entree', 'amakna'),
('ama_dark_vlad', 'amakna'),
('ama_foret', 'amakna'),
('ama_foret_malefique', 'amakna'),
('ama_gelees', 'amakna'),
('ama_gobelins', 'amakna'),
('ama_ingalsse', 'amakna'),
('ama_marecages', 'amakna'),
('ama_passage_brakmar', 'amakna'),
('ama_pitons', 'amakna'),
('ama_porcos', 'amakna'),
('ama_rivage_sufokien', 'amakna'),
('ama_scarafeuilles', 'amakna'),
('antichambre_gloursons', 'frigost'),
('antre_blop_multicolore', 'cania'),
('antre_crocabulia', 'dragoeufs'),
('antre_dragon_cochon', 'dragoeufs'),
('antre_korriandre', 'frigost'),
('antre_reine_nyee', 'abrak'),
('aquadome_merkator', 'sufokia'),
('arbre_moon', 'moon'),
('arbre_mort', 'cavaliers'),
('asse_kartonpath', 'asse'),
('ast_calanques', 'astrub'),
('ast_carrieres', 'astrub'),
('ast_champs', 'astrub'),
('ast_cimetiere', 'astrub'),
('ast_cite', 'astrub'),
('ast_egouts', 'astrub'),
('ast_foret', 'astrub'),
('ast_planque', 'astrub'),
('ast_prairies', 'astrub'),
('ast_souterrains', 'astrub'),
('ast_tainela', 'astrub'),
('atelier_tanukoui', 'pandala'),
('aurore_pourpre', 'possedes'),
('autel_dechireuse', 'divines'),
('bambusaie_damadrya', 'pandala'),
('bastion_marteaux', 'valonia'),
('bateau_chouque', 'moon'),
('belvedere_ilyzaelle', 'harebourg'),
('biblio_corbac', 'cania'),
('bon_canaux', 'bontabrak'),
('bon_cimetiere_heros', 'bontabrak'),
('bon_rives', 'bontabrak'),
('boyau_pere_ver', 'saharach'),
('bra_bordure', 'bontabrak'),
('bra_entrailles', 'bontabrak'),
('brasserie_dazak', 'frigost'),
('breuil_venerable', 'divines'),
('cache_kankreblath', 'astrub'),
('cale_arche_otomai', 'otomai'),
('camp_razof', 'nimotopia'),
('can_baie', 'cania'),
('can_bibliotheque', 'cania'),
('can_champs', 'cania'),
('can_cirque', 'cania'),
('can_dents', 'cania'),
('can_dopeuls', 'cania'),
('can_kanigs', 'cania'),
('can_lac', 'cania'),
('can_landes', 'cania'),
('can_litneg', 'cania'),
('can_massif', 'cania'),
('can_penates', 'cania'),
('can_pics', 'cania'),
('can_plaines', 'cania'),
('can_porkass', 'cania'),
('can_rives_lac', 'cania'),
('can_routes', 'cania'),
('canopee_kimbo', 'otomai'),
('cav_corrompu', 'cavaliers'),
('cav_guerre', 'cavaliers'),
('cav_misere', 'cavaliers'),
('cav_servitude', 'cavaliers'),
('cave_toxoliath', 'divines'),
('caverne_el_piko', 'saharach'),
('caverne_koulosse', 'koalaks'),
('cavernes_kolosso', 'frigost'),
('chambre_malefices', 'valonia'),
('chambre_tal_kasha', 'saharach'),
('chapiteau_riktus', 'sidimote'),
('chateau_ensable', 'astrub'),
('chateau_wa_wabbit', 'wabbit'),
('cimetiere_mastodontes', 'saharach'),
('clairiere_chene_mou', 'abrak'),
('clos_blops', 'cania'),
('cour_bouftou_royal', 'astrub'),
('croquanterie', 'pwak'),
('crypte_kardorim', 'incarnam'),
('defi_chaloeil', 'divines'),
('demeure_esprits', 'grobe'),
('dojo_vent', 'pandala'),
('domaine_ancestral', 'abrak'),
('donjon_bworks', 'amakna'),
('donjon_forgerons', 'amakna'),
('donjon_harebourg', 'harebourg'),
('donjon_larves', 'amakna'),
('donjon_scarafeuilles', 'amakna'),
('donjon_squelettes', 'amakna'),
('donjon_tofus', 'amakna'),
('dra_presquile', 'dragoeufs'),
('dra_sanctuaire', 'dragoeufs'),
('dra_souterrains', 'dragoeufs'),
('dra_village', 'dragoeufs'),
('eca_crocuzko', 'ecailles'),
('eca_lande', 'divines'),
('eca_pierres', 'divines'),
('eca_temple', 'divines'),
('enu_carriere', 'divines'),
('enu_creuset', 'divines'),
('enu_retraite', 'divines'),
('epave_grolandais', 'frigost'),
('epreuve_draegnerys', 'dragoeufs'),
('excavation_mansot', 'frigost'),
('fabrique_foux', 'pandala'),
('fabrique_mallefisk', 'divines'),
('fers_tyrannie', 'cavaliers'),
('fonderie_waddicts', 'pwak'),
('forgefroide_frizz', 'harebourg'),
('fri_berceau', 'frigost'),
('fri_bourgade', 'frigost'),
('fri_champs', 'frigost'),
('fri_crevasse', 'frigost'),
('fri_crocs', 'frigost'),
('fri_epaves', 'frigost'),
('fri_lac', 'frigost'),
('fri_larmes', 'frigost'),
('fri_martegel', 'frigost'),
('fri_petrifiee', 'frigost'),
('fri_pins', 'frigost'),
('fri_port', 'frigost'),
('fri_ruche', 'frigost'),
('fri_salbatroces', 'frigost'),
('fri_torrideau', 'frigost'),
('fri_village', 'frigost'),
('galerie_phossile', 'divines'),
('garde_manger_rat_blanc', 'bontabrak'),
('gelaxieme_dimension', 'amakna'),
('goulet_rasboul', 'otomai'),
('grange_tournesol', 'astrub'),
('grobe_cimetiere', 'grobe'),
('grobe_mont', 'grobe'),
('grotte_bworker', 'sidimote'),
('grotte_hesque', 'otomai'),
('grotte_kanigroula', 'cania'),
('har_bastion', 'harebourg'),
('har_caserne', 'harebourg'),
('har_clepsydre', 'harebourg'),
('har_jardins', 'harebourg'),
('har_remparts', 'harebourg'),
('har_tannerie', 'harebourg'),
('horologium_xlii', 'divines'),
('hypogee_obsidiantre', 'frigost'),
('inc_champs', 'incarnam'),
('inc_cimetiere', 'incarnam'),
('inc_foret', 'incarnam'),
('inc_lac', 'incarnam'),
('inc_mine', 'incarnam'),
('inc_paturages', 'incarnam'),
('inc_route', 'incarnam'),
('koa_antre_koulosse', 'koalaks'),
('koa_bordure', 'koalaks'),
('koa_canyon', 'koalaks'),
('koa_cimetiere', 'koalaks'),
('koa_kaliptus', 'koalaks'),
('koa_lacs', 'koalaks'),
('koa_morhkitu', 'koalaks'),
('koa_pentes', 'koalaks'),
('labo_brumen', 'sidimote'),
('labo_nileza', 'harebourg'),
('labo_tynril', 'otomai'),
('labyrinthe_minotoror', 'minotoror'),
('maison_fantome', 'amakna'),
('manoir_katrepat', 'sidimote'),
('megalithe_fraktale', 'divines'),
('memoire_orukam', 'wukin'),
('miausolee_pounicheur', 'divines'),
('mine_sakai', 'sakai'),
('mino_ile', 'minotoror'),
('mino_labyrinthe', 'minotoror'),
('moon_crane', 'moon'),
('moon_jungle', 'moon'),
('moon_masques', 'moon'),
('moon_tortue', 'moon'),
('nid_kwakwa', 'amakna'),
('nimotopia', 'nimotopia'),
('obs_dimension', 'obscure'),
('oeil_vortex', 'divines'),
('osa_reserve', 'divines'),
('osa_rhoarim', 'divines'),
('osa_toorbz', 'divines'),
('oto_arche', 'otomai'),
('oto_canopee', 'otomai'),
('oto_corail', 'otomai'),
('oto_feuillage', 'otomai'),
('oto_hakam', 'otomai'),
('oto_jungle', 'otomai'),
('oto_naufrages', 'otomai'),
('oto_plaines', 'otomai'),
('oto_tourbiere', 'otomai'),
('oto_tourbiere2', 'otomai'),
('oto_tourbiere_fond', 'otomai'),
('oto_zoths', 'otomai'),
('palais_dantinea', 'sufokia'),
('palais_nidas', 'divines'),
('pan_aerdala', 'pandala'),
('pan_akwadala', 'pandala'),
('pan_feudala', 'pandala'),
('pan_plantala', 'pandala'),
('pan_terrdala', 'pandala'),
('pitons_craqueleur', 'amakna'),
('plateau_ush', 'divines'),
('pos_cauchemar', 'possedes'),
('pos_port', 'possedes'),
('poste_supervizoeuf', 'divines'),
('pwak_carriere', 'pwak'),
('pwak_chocomanciens', 'pwak'),
('pwak_jardins', 'pwak'),
('pyramide_ombre', 'obscure'),
('refuge_sylvestre', 'albuera'),
('repaire_kharnozor', 'dragoeufs'),
('repaire_skeunk', 'koalaks'),
('repaire_sphincter', 'amakna'),
('ring_ekarlatte', 'divines'),
('rituel_kabahal', 'possedes'),
('sah_cacterre', 'saharach'),
('sah_cite', 'saharach'),
('sah_gorge', 'saharach'),
('sah_ossements', 'saharach'),
('sah_pyramide', 'saharach'),
('sak_foret', 'sakai'),
('sak_plaine', 'sakai'),
('salle_minotot', 'minotoror'),
('salons_klime', 'harebourg'),
('sanctuaire_torkelonia', 'ecailles'),
('sentence_balance', 'cavaliers'),
('serre_royalmouth', 'frigost'),
('sid_desacrees', 'sidimote'),
('sid_desolation', 'sidimote'),
('sid_domaine_fungus', 'sidimote'),
('sid_fungus', 'sidimote'),
('sid_gisgoul', 'sidimote'),
('sid_hurlements', 'sidimote'),
('sid_magmatiques', 'sidimote'),
('sid_roulottes', 'sidimote'),
('sousouriciere_rat_noir', 'bontabrak'),
('souvenir_imagiro', 'wukin'),
('sram_catacombres', 'divines'),
('sram_hauts', 'divines'),
('sram_ruelles', 'divines'),
('suf_embruns', 'sufokia'),
('suf_rlyugluglu', 'sufokia'),
('suf_trithons', 'sufokia'),
('suf_vestiges', 'sufokia'),
('taniere_givrefoux', 'frigost'),
('taniere_meulou', 'sidimote'),
('tempete_eliocalypse', 'cavaliers'),
('temple_kao', 'pwak'),
('temple_koutoulou', 'sufokia'),
('temple_ougah', 'sidimote'),
('terrier_wa_wabbit', 'wabbit'),
('tertre_long_sommeil', 'amakna'),
('theatre_dramak', 'asse'),
('tofulailler_royal', 'amakna'),
('tombe_tofugawa', 'grobe'),
('tour_bethel', 'frigost'),
('tour_solar', 'sidimote'),
('transporteur_sylargh', 'harebourg'),
('trone_cour_sombre', 'divines'),
('trone_sang', 'cavaliers'),
('vaisseau_meno', 'sufokia'),
('val_ephedrya', 'valonia'),
('val_ereboria', 'valonia'),
('vallee_dame_eaux', 'pandala'),
('ventre_baleine', 'frigost'),
('village_kanniboul', 'moon'),
('voliere_haute_truche', 'cania'),
('vul_espartiate', 'vulkania'),
('vul_etraktopel', 'vulkania'),
('vul_monseleya', 'vulkania'),
('vul_mopyle', 'vulkania'),
('vul_nehr', 'vulkania'),
('vul_pillar', 'vulkania'),
('vul_ponefarr', 'vulkania'),
('vul_strates', 'vulkania'),
('wab_cawotte', 'wabbit'),
('wab_couronne', 'wabbit'),
('wab_labos', 'wabbit'),
('wab_tombeaux', 'wabbit'),
('wab_waldo', 'wabbit'),
('wuk_encre', 'wukin'),
('wuk_papier', 'wukin'),
('xel_lendemains', 'divines'),
('xel_present', 'divines')
on conflict (sid) do update set zone = excluded.zone;

reset search_path;

-- ======================== supabase/alliances.sql ========================
set search_path = s1, public;
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

create table if not exists s1.alliances (
  id bigint generated always as identity primary key,
  name text not null,
  tag text not null default '',            -- sigle (2 à 4 lettres ou chiffres)
  ic text not null default 'dofus',
  col text not null default '#7cc7ff',
  founder bigint references s1.guilds (id) on delete set null,  -- la guilde qui dirige l'alliance
  created_at timestamptz not null default now()
);
create unique index if not exists alliances_name on s1.alliances (lower(name));
create unique index if not exists alliances_tag on s1.alliances (upper(tag)) where tag <> '';
alter table s1.alliances enable row level security;

create table if not exists s1.alliance_guilds (
  guild_id bigint primary key references s1.guilds (id) on delete cascade,
  alliance_id bigint not null references s1.alliances (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists alliance_guilds_a on s1.alliance_guilds (alliance_id);
alter table s1.alliance_guilds enable row level security;

-- ask : la guilde demande à entrer ; invite : l'alliance invite la guilde
create table if not exists s1.alliance_requests (
  alliance_id bigint not null references s1.alliances (id) on delete cascade,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  kind text not null check (kind in ('ask', 'invite')),
  by_user uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  primary key (alliance_id, guild_id)
);
alter table s1.alliance_requests enable row level security;

create table if not exists s1.prisms (
  zone text primary key,
  alliance_id bigint not null references s1.alliances (id) on delete cascade,
  guild_id bigint references s1.guilds (id) on delete set null,   -- la guilde qui l'a posé (ou pris)
  placed_by uuid references auth.users (id) on delete set null,
  placed_at timestamptz not null default now(),
  mods jsonb not null default '{}'::jsonb                              -- { rempart, sagesse, prospection, ralliement }
);
create index if not exists prisms_a on s1.prisms (alliance_id);
alter table s1.prisms enable row level security;

-- combats de la bataille (w = semaine, gb_week) ; extra : combat de Ralliement (au-delà des 10)
create table if not exists s1.prism_fights (
  id bigint generated always as identity primary key,
  w int not null, user_id uuid not null references auth.users (id) on delete cascade,
  n int not null, zone text not null,
  alliance_id bigint not null references s1.alliances (id) on delete cascade,
  guild_id bigint references s1.guilds (id) on delete set null,
  def boolean not null, win boolean not null, extra boolean not null default false, rounds int,
  at timestamptz not null default now(),
  unique (w, user_id, n)
);
create index if not exists prism_fights_wz on s1.prism_fights (w, zone);
create index if not exists prism_fights_wa on s1.prism_fights (w, alliance_id);
alter table s1.prism_fights enable row level security;

-- bataille déjà comptée (res : régions prises, perdues, libérées et classement final)
create table if not exists s1.al_resolved (
  w int primary key, at timestamptz not null default now(), res jsonb not null default '{}'::jsonb
);
alter table s1.al_resolved enable row level security;
create table if not exists s1.al_claims (
  user_id uuid not null references auth.users (id) on delete cascade, w int not null,
  at timestamptz not null default now(), primary key (user_id, w)
);
alter table s1.al_claims enable row level security;

create table if not exists s1.alliance_msgs (
  id bigint generated always as identity primary key,
  alliance_id bigint not null references s1.alliances (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text, cls text, lvl int, title text, gname text,
  body text not null default '',
  kind text not null default 'msg',  -- 'msg' ou 'sys' (arrivées, prismes, bataille)
  created_at timestamptz not null default now()
);
create index if not exists alliance_msgs_a on s1.alliance_msgs (alliance_id, id desc);
alter table s1.alliance_msgs enable row level security;

-- ---------- outils internes ----------
-- jour de la bataille (1 = lundi … 7 = dimanche) et heures : les mêmes que E.ALLY (js/alliance.js)
create or replace function s1.al_battle_day() returns int language sql stable as $$ select 6 $$;
create or replace function s1.al_battle_from() returns int language sql stable as $$ select 21 $$;
create or replace function s1.al_battle_to() returns int language sql stable as $$ select 22 $$;
-- début et fin de la bataille de la semaine wk (gb_week : semaines du lundi)
create or replace function s1.al_battle_start(wk int) returns timestamptz language sql stable
as $$ select ((date '1970-01-01' + wk * 7 - 3 + (al_battle_day() - 1)) + make_interval(hours => al_battle_from())) at time zone 'Europe/Paris' $$;
create or replace function s1.al_battle_end(wk int) returns timestamptz language sql stable
as $$ select ((date '1970-01-01' + wk * 7 - 3 + (al_battle_day() - 1)) + make_interval(hours => al_battle_to())) at time zone 'Europe/Paris' $$;
-- bataille en cours (grace : quelques secondes de plus pour finir un combat lancé juste avant la fin)
create or replace function s1.al_battle_on(grace interval default interval '0') returns boolean language sql stable
as $$ select now() >= al_battle_start(gb_week()) and now() < al_battle_end(gb_week()) + grace $$;
create or replace function s1.al_of(g bigint) returns bigint language sql stable security definer set search_path = s1, public
as $$ select alliance_id from alliance_guilds where guild_id = g $$;
create or replace function s1.al_count(a bigint) returns int language sql stable security definer set search_path = s1, public
as $$ select count(*)::int from alliance_guilds where alliance_id = a $$;
-- deux guildes de la même alliance (9A)
create or replace function s1.al_allied(a bigint, b bigint) returns boolean language sql stable security definer set search_path = s1, public
as $$ select a is not null and b is not null and a <> b and exists (select 1 from alliance_guilds x join alliance_guilds y on y.alliance_id = x.alliance_id where x.guild_id = a and y.guild_id = b) $$;
-- guilde qui domine une région (le plus de Percepteurs, sans égalité en tête) : comme E.huntDomination
create or replace function s1.al_dom(z text) returns bigint language sql stable security definer set search_path = s1, public
as $$ select case when count(*) = 1 or (array_agg(n order by n desc))[1] > (array_agg(n order by n desc))[2] then (array_agg(g order by n desc))[1] end
  from (select p.guild_id g, count(*) n from guild_percos p join prism_sids s on s.sid = p.sid where s.zone = z group by p.guild_id) x $$;
-- Percepteur d'une guilde dont l'alliance a un prisme dans sa région : +20 % de PV (6A, rejoué par record)
create or replace function s1.al_prism_cover(g bigint, p_sid text) returns boolean language sql stable security definer set search_path = s1, public
as $$ select exists (select 1 from prisms pr join prism_sids s on s.zone = pr.zone where s.sid = p_sid and pr.alliance_id = al_of(g)) $$;
-- prix d'une amélioration au rang suivant (E.ALLY_MODS) ; null : rang maximum ou inconnue
create or replace function s1.al_modk(k text, r int) returns bigint language sql immutable
as $$ select case k
  when 'rempart' then (array[500000, 1500000, 4000000]::bigint[])[r + 1]
  when 'sagesse' then (array[400000, 1200000, 3000000]::bigint[])[r + 1]
  when 'prospection' then (array[400000, 1200000, 3000000]::bigint[])[r + 1]
  when 'ralliement' then (array[1500000]::bigint[])[r + 1] end $$;
create or replace function s1.al_say_sys(a bigint, t text) returns void language sql security definer set search_path = s1, public
as $$ insert into alliance_msgs (alliance_id, kind, body) values (a, 'sys', t) $$;
-- message aux guildes de l'alliance (journal et chat de chaque guilde) et au salon de l'alliance
create or replace function s1.al_log(a bigint, t text) returns void language plpgsql security definer set search_path = s1, public
as $$ declare g bigint; begin
  perform al_say_sys(a, t);
  for g in select guild_id from alliance_guilds where alliance_id = a loop perform g_log(g, t, false); end loop;
end $$;
-- l'alliance a toujours une guilde fondatrice ; sans guilde, elle disparaît (et ses prismes avec elle)
create or replace function s1.al_fix(a bigint) returns void language plpgsql security definer set search_path = s1, public
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
create or replace function s1.al_top(wk int, lim int default 10) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(x order by x.regions desc, x.wins desc, x.id), '[]'::jsonb) from (
  select a.id, a.name, a.tag, a.ic, a.col, al_count(a.id) n,
    (select count(*) from prisms p where p.alliance_id = a.id)::int regions,
    (select count(*) from prism_fights f where f.alliance_id = a.id and f.w = wk and f.win)::int wins
  from alliances a order by regions desc, wins desc, a.id limit lim) x where x.regions > 0 or x.wins > 0 $$;
-- points de la bataille de la semaine wk par région : { zone: { alliance: points } }
create or replace function s1.al_scores(wk int) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_object_agg(zone, s), '{}'::jsonb) from (
  select zone, jsonb_object_agg(alliance_id::text, pts) s from (
    select zone, alliance_id, count(*)::int pts from prism_fights where w = wk and win group by zone, alliance_id) y group by zone) x $$;
-- Fin de bataille : chaque région où quelqu'un a gagné un combat change (ou pas) de main (E.allyOutcome).
-- Une seule fois par semaine, à la première lecture après 22 h ; idempotent.
create or replace function s1.al_resolve() returns void language plpgsql security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- lecture : tout ce que montre l'onglet Alliance et la carte ----------
create or replace function s1.ally_me() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_found(p_name text, p_tag text, p_ic text, p_col text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_invite(p_gid bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_ask(p_aid bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_answer(p_aid bigint, p_gid bigint, p_yes boolean) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_leave() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_kick(p_gid bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.prism_place(p_zone text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.prism_up(p_zone text, p_mod text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ps_start(p_user uuid, p_zone text) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ps_done(p_user uuid, p_w int, p_zone text, p_n int, p_def boolean, p_win boolean, p_rounds int) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_say(p_body text) returns text language plpgsql security definer set search_path = s1, public
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
create or replace function s1.ally_chat(p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon', f);
    execute format('grant execute on function s1.%s to authenticated', f);
  end loop;
  foreach f in array array['ps_start(uuid, text)', 'ps_done(uuid, int, text, int, boolean, boolean, int)'] loop
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
    execute format('grant execute on function s1.%s to service_role', f);
  end loop;
end $$;

reset search_path;

-- ======================== supabase/ascension.sql ========================
set search_path = s1, public;
-- ============================================================================
-- L'ASCENSION — Idlus (1.1) : les 5 classements (choix 20 A B C D F) et les lots du top 10.
-- Les scores viennent du résumé de la sauvegarde (meta.asc, js/verify.js), comme les niveaux du classement :
--   rapidite : étages 91 à 100 en Difficile, sans auto, le moins de tours de combat (rangé du plus petit au plus grand)
--   classe   : meilleur étage en Difficile avec une classe (k = la classe)
--   sursis   : meilleur étage en Difficile sans utiliser de Sursis
--   puriste  : meilleur étage en Difficile avec seulement des sorts de sa classe
--   audela   : meilleur étage de l'Au-delà de la semaine (m = numéro de semaine), jusqu'à la 3.0
--   breche   : Idlus 3.0 (1B de Mathis, 12/11/2026, « avec mon équipe ») : meilleur étage de la Brèche de la semaine (js/songe.js, meta.brk)
-- Mois : année × 12 + mois (UTC), comme E.ascMonth ; semaine : comme E.weekIdx.
-- Lots (asc_claim, le mois ou la semaine d'après) : top 10 de chaque classement = un titre, 3 Fioles de Volonté et 100 000 kamas
-- (Au-delà : titre « Maître de l'Au-delà », 2 Fioles). Envoyés par hdv_op comme les lots du Songe infini.
-- S'appuie sur classements.sql (ladder, profiles), hdv.sql (hdv_op, hdv_ops_after) et guildes.sql (g_err).
-- Relançable sans danger : ne supprime ni ne modifie aucune donnée de joueur.
-- ============================================================================

create table if not exists s1.asc_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  m int not null,                 -- mois (ou semaine pour l'Au-delà)
  cat text not null check (cat in ('rapidite', 'classe', 'sursis', 'puriste', 'audela')),
  k text not null default '',     -- la classe pour « classe »
  score int not null,
  at timestamptz not null default now(),
  primary key (user_id, m, cat, k)
);
alter table s1.asc_scores drop constraint if exists asc_scores_cat_check;
alter table s1.asc_scores add constraint asc_scores_cat_check check (cat in ('rapidite', 'classe', 'sursis', 'puriste', 'audela', 'breche'));
create index if not exists asc_scores_rank on s1.asc_scores (m, cat, k, score desc);
alter table s1.asc_scores enable row level security;
drop policy if exists "ascension lisible" on s1.asc_scores;
create policy "ascension lisible" on s1.asc_scores for select using (true);

create or replace function s1.asc_month() returns int language sql stable
as $$ select (extract(year from now() at time zone 'utc')::int * 12 + extract(month from now() at time zone 'utc')::int - 1) $$;
create or replace function s1.asc_week() returns int language sql stable
as $$ select floor((extract(epoch from now()) / 86400 + 3) / 7)::int $$;

-- les scores du résumé envoyé avec la sauvegarde (seulement pour le mois et la semaine en cours, et seulement s'ils montent)
create or replace function s1.asc_from_save() returns trigger language plpgsql security definer set search_path = s1, public
as $$
declare a jsonb := new.meta->'asc'; mo int := asc_month(); wk int := asc_week(); c text; v int;
  put constant text := 'insert into s1.asc_scores (user_id, m, cat, k, score) values ($1, $2, $3, $4, $5)
    on conflict (user_id, m, cat, k) do update set score = excluded.score, at = now()
    where (excluded.cat = ''rapidite'' and excluded.score < s1.asc_scores.score) or (excluded.cat <> ''rapidite'' and excluded.score > s1.asc_scores.score)';
begin
  if a is not null and jsonb_typeof(a) = 'object' and coalesce((a->>'m')::int, -1) = mo then
    for c, v in select key, least(greatest(coalesce((value#>>'{}')::int, 0), 0), 100) from jsonb_each(coalesce(a->'cls', '{}'::jsonb)) where key ~ '^[a-z]{2,8}$' loop
      if v > 0 then execute put using new.user_id, mo, 'classe', c, v; end if;
    end loop;
    v := least(greatest(coalesce((a->>'nos')::int, 0), 0), 100); if v > 0 then execute put using new.user_id, mo, 'sursis', '', v; end if;
    v := least(greatest(coalesce((a->>'pur')::int, 0), 0), 100); if v > 0 then execute put using new.user_id, mo, 'puriste', '', v; end if;
    v := coalesce((a->>'spd')::int, 0); if v >= 10 then execute put using new.user_id, mo, 'rapidite', '', least(v, 100000); end if; -- 10 étages : au moins 10 tours
  end if;
  if coalesce((a->>'w')::int, -1) = wk then
    v := least(greatest(coalesce((a->>'x')::int, 0), 0), 10000); if v > 100 then execute put using new.user_id, wk, 'audela', '', v; end if;
  end if;
  -- la Brèche (3.0) : son propre résumé, même sans Ascension
  if jsonb_typeof(new.meta->'brk') = 'object' and (new.meta->'brk'->>'w') ~ '^\d{1,9}$' and (new.meta->'brk'->>'d') ~ '^\d{1,6}$' and (new.meta->'brk'->>'w')::int = wk then
    v := least((new.meta->'brk'->>'d')::int, 100000); if v > 0 then execute put using new.user_id, wk, 'breche', '', v; end if;
  end if;
  return new;
end $$;
drop trigger if exists saves_ascension on s1.saves;
drop trigger if exists saves_ascension on s1.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_ascension after insert or update on s1.saves_ok for each row execute function s1.asc_from_save();

-- classement public (sans les comptes « en vérification ») ; rapidité : le moins de tours d'abord
create or replace view s1.lb_asc as
  select s.user_id, p.pseudo, l.main, s.m, s.cat, s.k, s.score, s.at,
    rank() over (partition by s.m, s.cat, s.k order by case when s.cat = 'rapidite' then s.score else -s.score end, s.at asc) as r
  from s1.asc_scores s join public.profiles p on p.id = s.user_id left join s1.ladder l on l.user_id = s.user_id
  where not coalesce(l.flagged, false) and not coalesce(l.suspect, false);
grant select on s1.lb_asc to anon, authenticated;

create table if not exists s1.asc_lots (
  user_id uuid not null references auth.users (id) on delete cascade,
  m int not null, cat text not null, k text not null default '',
  r int,
  at timestamptz not null default now(),
  primary key (user_id, m, cat, k)
);
alter table s1.asc_lots enable row level security;

-- les lots des mois (et semaines de l'Au-delà) passés où le joueur était dans le top 10
create or replace function s1.asc_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); mo int := asc_month(); wk int := asc_week(); x record; k bigint := 0; f int := 0; titles text[] := '{}'; got jsonb := '[]'::jsonb; t text;
begin
  if me is null then return g_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  for x in select b.m, b.cat, b.k, b.r from lb_asc b
           where b.user_id = me and b.r <= 10 and ((b.cat not in ('audela', 'breche') and b.m between mo - 3 and mo - 1) or (b.cat in ('audela', 'breche') and b.m between wk - 4 and wk - 1))
             and not exists (select 1 from asc_lots a where a.user_id = me and a.m = b.m and a.cat = b.cat and a.k = b.k) loop
    insert into asc_lots (user_id, m, cat, k, r) values (me, x.m, x.cat, x.k, x.r) on conflict do nothing;
    t := case x.cat when 'rapidite' then 'Éclair de l''Ascension' when 'classe' then 'Champion de classe de l''Ascension' when 'sursis' then 'Sans filet'
                    when 'puriste' then 'Puriste de l''Ascension' when 'breche' then 'Maître de la Brèche' else 'Maître de l''Au-delà' end;
    titles := array_append(titles, t);
    if x.cat in ('audela', 'breche') then f := f + 2; else f := f + 3; k := k + 100000; end if;
    got := got || jsonb_build_object('m', x.m, 'cat', x.cat, 'k', x.k, 'r', x.r);
  end loop;
  if jsonb_array_length(got) > 0 then
    foreach t in array (select array_agg(distinct u) from unnest(titles) u) loop
      perform hdv_op(me, jsonb_build_object('title', t), format('Classement de L''Ascension : titre « %s »', t));
    end loop;
    perform hdv_op(me, jsonb_build_object('k', k, 'cons', jsonb_build_object('fiole_volonte', f)),
      format('Classement de L''Ascension : %s Fioles de Volonté%s', f, case when k > 0 then format(' et %s kamas', k) else '' end));
  end if;
  return jsonb_build_object('ok', jsonb_array_length(got), 'fioles', f, 'kamas', k, 'got', got, 'ops', hdv_ops_after(me, p_after));
end $$;
revoke all on function s1.asc_claim(bigint) from public, anon;
grant execute on function s1.asc_claim(bigint) to authenticated;

reset search_path;

-- ======================== supabase/elevage.sql ========================
set search_path = s1, public;
-- ============================================================================
-- 1.1 : ÉLEVAGE (js/elevage.js, js/elevageui.js).
-- 1) Naissances exceptionnelles annoncées dans le chat Général (choix 10A) : le résumé de la partie porte la liste
--    « mrare » (clés « chr:dd:Ivoire », « st:dd:Ivoire:6 », « gen:dd:Prune »). Une seule annonce par compte et par
--    clé, seulement pour une partie classée et jamais pour un compte signalé (comme dsub, supabase/collections.sql).
-- 2) Classement Élevage (choix 12A) : le résumé porte « elev » = { c : couleurs trouvées, s : étoiles de l'écurie,
--    chr : chromatiques }. Bornes : 41 couleurs, 400 étoiles, 41 chromatiques.
-- Rien ne rapporte de kamas ni d'objet. Relançable : create ... if not exists, create or replace, drop trigger if exists.
-- Aucune donnée de joueur n'est modifiée ni supprimée. (Ajouté à la liste « tous » du workflow Serveur en ligne à la sortie de la 1.1.)
-- ============================================================================
create table if not exists s1.mount_births (
  user_id uuid not null references auth.users (id) on delete cascade,
  k text not null check (k ~ '^(chr|st|gen):(dd|mu|vk):[^:<>]{1,20}(:[1-7])?$'),
  at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table s1.mount_births enable row level security;
drop policy if exists "lire les naissances" on s1.mount_births;
create policy "lire les naissances" on s1.mount_births for select to anon, authenticated using (true);

create table if not exists s1.elevage_ladder (
  user_id uuid primary key references auth.users (id) on delete cascade,
  colours int not null default 0 check (colours between 0 and 41),
  stars int not null default 0 check (stars between 0 and 400),
  chroma int not null default 0 check (chroma between 0 and 41),
  updated_at timestamptz not null default now()
);
alter table s1.elevage_ladder enable row level security;
drop policy if exists "lire le classement élevage" on s1.elevage_ladder;
create policy "lire le classement élevage" on s1.elevage_ladder for select to anon, authenticated using (true);
-- (aucune écriture directe : seul le déclencheur ci-dessous écrit)

create or replace function s1.elevage_from_save() returns trigger language plpgsql security definer set search_path = s1, public
as $$ declare k text; bad boolean; e jsonb; n int := 0; begin
  if new.meta is null then return new; end if;
  select flagged into bad from ladder where user_id = new.user_id;
  if not found or bad then return new; end if;
  e := new.meta->'elev';
  if jsonb_typeof(e) = 'object' then
    insert into elevage_ladder (user_id, colours, stars, chroma, updated_at)
      values (new.user_id, least(41, greatest(0, coalesce((e->>'c')::int, 0))), least(400, greatest(0, coalesce((e->>'s')::int, 0))), least(41, greatest(0, coalesce((e->>'chr')::int, 0))), now())
      on conflict (user_id) do update set colours = excluded.colours, stars = excluded.stars, chroma = excluded.chroma, updated_at = now();
  end if;
  if jsonb_typeof(new.meta->'mrare') = 'array' then
    for k in select distinct x from jsonb_array_elements_text(new.meta->'mrare') x where x ~ '^(chr|st|gen):(dd|mu|vk):[^:<>]{1,20}(:[1-7])?$' limit 10 loop
      insert into mount_births (user_id, k) values (new.user_id, k) on conflict do nothing;
      if found and n < 3 then
        n := n + 1;
        perform chat_ann(new.user_id, jsonb_build_object('t', 'mrare', 'k', split_part(k, ':', 1), 'sp', split_part(k, ':', 2), 'c', split_part(k, ':', 3), 'st', nullif(split_part(k, ':', 4), '')));
      end if;
    end loop;
  end if;
  return new;
exception when others then return new; -- l'élevage ne doit jamais bloquer une sauvegarde
end $$;
revoke all on function s1.elevage_from_save() from public, anon, authenticated;
-- après saves_ladder (ordre alphabétique des déclencheurs) : la ligne du classement est déjà à jour
drop trigger if exists saves_suite_elevage on s1.saves;
drop trigger if exists saves_suite_elevage on s1.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_suite_elevage after insert or update on s1.saves_ok for each row execute function s1.elevage_from_save();

create or replace view s1.lb_elevage as
  select e.user_id, p.pseudo, l.main, l.main_lvl, e.colours, e.stars, e.chroma
  from s1.elevage_ladder e join s1.ladder l on l.user_id = e.user_id join public.profiles p on p.id = e.user_id where not l.flagged;
grant select on s1.lb_elevage to anon, authenticated;

reset search_path;

-- ======================== supabase/pluie.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus — Pluie de kamas (panel Xener › Annonces › « Pluie de kamas »). Choix de Mathis 15/10 : 1C 2A 3A 5A 6A.
-- Mathis met des kamas de SON compte dans une pluie de quelques minutes. Les joueurs connectés à un compte cliquent
-- « Je participe » ; à la fin, la pluie est partagée à parts égales entre eux. Rien n'est créé : les kamas sortent
-- de la partie de Xener (opération hdv_ops négative, vérifiée comme à l'hôtel de vente) et arrivent chez les
-- participants par la même voie que le paiement d'une vente. Le reste de la division (et toute la pluie si
-- personne ne participe ou si Mathis l'annule) revient à Xener.
-- Pas de tâche planifiée : la pluie finie est partagée par le premier appel de rain_state() qui suit sa fin
-- (verrou « skip locked », comme ann_tick). Appliqué par le workflow « Serveur en ligne » ; relançable sans danger.
-- ============================================================================

create table if not exists s1.kamas_rains (
  id bigint generated always as identity primary key,
  by_user uuid not null references auth.users (id) on delete cascade,
  total bigint not null check (total > 0),
  msg text not null default '',
  ends timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done', 'cancel')),
  n int not null default 0,          -- participants au moment du partage
  share bigint not null default 0,   -- part de chacun
  ann_id bigint,                     -- bandeau ouvert avec la pluie (effacé à la fin)
  at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists kamas_rains_open on s1.kamas_rains (ends) where status = 'open';
alter table s1.kamas_rains enable row level security; -- aucune lecture directe : seulement par les fonctions ci-dessous

create table if not exists s1.kamas_rain_joins (
  rain_id bigint not null references s1.kamas_rains (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (rain_id, user_id)
);
alter table s1.kamas_rain_joins enable row level security;

create or replace function s1.rain_fmt(n bigint) returns text language sql immutable
as $$ select replace(to_char(n, 'FM999G999G999G999'), ',', ' ') $$;

-- Partage les pluies finies (appelé par rain_state, donc par le jeu des joueurs connectés).
create or replace function s1.rain_close() returns void language plpgsql security definer set search_path = s1, public
as $$
declare r kamas_rains; cnt int; sh bigint; rest bigint; j record;
begin
  for r in select * from kamas_rains where status = 'open' and ends <= now() order by id for update skip locked loop
    select count(*) into cnt from kamas_rain_joins where rain_id = r.id;
    sh := case when cnt > 0 then r.total / cnt else 0 end;
    rest := r.total - sh * cnt;
    for j in select user_id from kamas_rain_joins where rain_id = r.id loop
      perform hdv_op(j.user_id, jsonb_build_object('k', sh, 'rain', r.id), 'Pluie de kamas : +' || rain_fmt(sh) || ' kamas offerts par ' || coalesce(pseudo_of(r.by_user), 'Xener'));
    end loop;
    if rest > 0 then
      perform hdv_op(r.by_user, jsonb_build_object('k', rest, 'rain', r.id), case when cnt = 0 then 'Pluie de kamas sans participant : ' || rain_fmt(rest) || ' kamas revenus' else 'Pluie de kamas : ' || rain_fmt(rest) || ' kamas non partagés revenus' end);
    end if;
    update kamas_rains set status = 'done', n = cnt, share = sh, closed_at = now() where id = r.id;
    if r.ann_id is not null then update announces set until = now() where id = r.ann_id and (until is null or until > now()); end if;
    if cnt > 0 then
      insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', r.by_user, pseudo_of(r.by_user), 'ann',
        'La pluie de kamas est finie : ' || cnt || case when cnt > 1 then ' joueurs reçoivent ' else ' joueur reçoit ' end || rain_fmt(sh) || ' kamas' || case when cnt > 1 then ' chacun.' else '.' end,
        jsonb_build_object('t', 'admin', 'banner', false, 'rain', r.id));
    end if;
  end loop;
end $$;
revoke all on function s1.rain_close() from public, anon, authenticated;

-- État pour le jeu : la pluie en cours, ou la dernière finie depuis moins de 15 minutes. Lisible par tous (invités compris).
create or replace function s1.rain_state() returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare r kamas_rains; me uuid := auth.uid(); cnt int;
begin
  if exists (select 1 from kamas_rains where status = 'open' and ends <= now()) then perform rain_close(); end if;
  select * into r from kamas_rains where status = 'open' or (status = 'done' and closed_at > now() - interval '15 minutes') order by (status = 'open') desc, id desc limit 1;
  if r.id is null then return null; end if;
  select count(*) into cnt from kamas_rain_joins where rain_id = r.id;
  return jsonb_build_object('id', r.id, 'st', r.status, 'total', r.total, 'msg', r.msg, 'by', pseudo_of(r.by_user), 'ends', r.ends, 'now', now(),
    'n', case when r.status = 'done' then r.n else cnt end, 'share', r.share,
    'in', me is not null and exists (select 1 from kamas_rain_joins where rain_id = r.id and user_id = me),
    'mine', me is not null and me = r.by_user);
end $$;
revoke all on function s1.rain_state() from public;
grant execute on function s1.rain_state() to anon, authenticated;

-- « Je participe » : un compte (2A), partie en ligne, pas en vérification. Une fois par pluie.
create or replace function s1.rain_join(p_id bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); r kamas_rains;
begin
  if me is null then return hdv_err('Connecte-toi à un compte (gratuit) pour participer à la pluie de kamas.'); end if;
  begin perform hdv_save(me); exception when others then return hdv_err(sqlerrm); end;
  select * into r from kamas_rains where id = p_id;
  if r.id is null or r.status <> 'open' or r.ends <= now() then return hdv_err('Cette pluie de kamas est déjà finie.'); end if;
  if r.by_user = me then return hdv_err('Ce sont tes kamas : tu ne peux pas participer à ta propre pluie.'); end if;
  insert into kamas_rain_joins (rain_id, user_id) values (r.id, me) on conflict do nothing;
  return rain_state();
end $$;
revoke all on function s1.rain_join(bigint) from public;
grant execute on function s1.rain_join(bigint) to authenticated;

-- Panel : lancer une pluie avec ses propres kamas (5A : seulement Xener). Une seule pluie à la fois.
-- p_min : durée en minutes (1 à 60). p_announce (6A) : bandeau pendant la pluie + message dans le chat Général.
create or replace function s1.adm_rain_open(p_total bigint, p_min int, p_msg text, p_announce boolean) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; have numeric; m text := left(btrim(coalesce(p_msg, '')), 140); id_ bigint; aid bigint; manual boolean; body text;
begin
  perform adm_need(true);
  if exists (select 1 from kamas_rains where status = 'open' and ends <= now()) then perform rain_close(); end if;
  if exists (select 1 from kamas_rains where status = 'open') then return hdv_err('Une pluie de kamas est déjà en cours.'); end if;
  if p_total is null or p_total < 1000 then return hdv_err('Au moins 1 000 kamas.'); end if;
  if p_min is null or p_min < 1 or p_min > 60 then return hdv_err('Durée : de 1 à 60 minutes.'); end if;
  begin d := hdv_save(me); exception when others then return hdv_err(sqlerrm); end;
  have := hdv_kamas(me, d);
  if have < p_total then return hdv_err('Pas assez de kamas sur ton compte en ligne : ' || rain_fmt(floor(have)::bigint) || ' (la partie part en ligne toutes les 30 s).'); end if;
  insert into kamas_rains (by_user, total, msg, ends) values (me, p_total, m, now() + make_interval(mins => p_min)) returning id into id_;
  perform hdv_op(me, jsonb_build_object('k', -p_total, 'rain', id_), 'Pluie de kamas lancée : ' || rain_fmt(p_total) || ' kamas mis en jeu');
  if p_announce then
    body := 'Pluie de kamas : ' || rain_fmt(p_total) || ' kamas à partager pendant ' || p_min || ' min ! Accueil › « Je participe ».' || case when m <> '' then ' ' || m else '' end;
    body := left(body, 300);
    manual := exists (select 1 from announces where banner and (until is null or until > now()) and srv is distinct from 'm'); -- un seul bandeau à la fois (2.1.36 : par serveur)
    if not manual then
      insert into announces (body, banner, until) values (body, true, now() + make_interval(mins => p_min)) returning id into aid;
      update kamas_rains set ann_id = aid where id = id_;
    end if;
    insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', me, pseudo_of(me), 'ann', body, jsonb_build_object('t', 'admin', 'banner', not manual, 'rain', id_));
  end if;
  perform alog(format('pluie de kamas lancée : %s kamas, %s min', p_total, p_min));
  return jsonb_build_object('ok', true, 'id', id_, 'ops', hdv_ops_after(me, hdv_cursor(d)));
end $$;
revoke all on function s1.adm_rain_open(bigint, int, text, boolean) from public;
grant execute on function s1.adm_rain_open(bigint, int, text, boolean) to authenticated;

-- Panel : arrêter la pluie tout de suite. p_share = true : partage maintenant entre les participants ; false : tout revient à Xener.
create or replace function s1.adm_rain_stop(p_id bigint, p_share boolean) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare r kamas_rains;
begin
  perform adm_need(true);
  select * into r from kamas_rains where id = p_id and status = 'open' for update;
  if r.id is null then return hdv_err('Pas de pluie en cours.'); end if;
  if p_share then
    update kamas_rains set ends = now() where id = r.id;
    perform rain_close();
  else
    perform hdv_op(r.by_user, jsonb_build_object('k', r.total, 'rain', r.id), 'Pluie de kamas annulée : ' || rain_fmt(r.total) || ' kamas revenus');
    update kamas_rains set status = 'cancel', closed_at = now() where id = r.id;
    if r.ann_id is not null then update announces set until = now() where id = r.ann_id; end if;
    perform alog('pluie de kamas annulée');
    return jsonb_build_object('ok', true);
  end if;
  perform alog('pluie de kamas arrêtée et partagée');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function s1.adm_rain_stop(bigint, boolean) from public;
grant execute on function s1.adm_rain_stop(bigint, boolean) to authenticated;

-- Panel : les dernières pluies.
create or replace function s1.adm_rains() returns jsonb language plpgsql security definer set search_path = s1, public
as $$ begin
  perform adm_need(true);
  return (select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (select id, total, msg, ends, status, n, share, at,
    (select count(*) from kamas_rain_joins j where j.rain_id = k.id) joined from kamas_rains k order by id desc limit 10) x);
end $$;
revoke all on function s1.adm_rains() from public;
grant execute on function s1.adm_rains() to authenticated;

reset search_path;

-- ======================== supabase/chantier.sql ========================
set search_path = s1, public;
-- ============================================================================
-- Idlus 3.0 — le Chantier du serveur (Marché › Chantier). Choix de Mathis (12/11/2026) : tout le serveur verse des kamas,
-- une fois l'objectif atteint : ×2 XP et ×2 butin pour tout le serveur pendant 48 h (hors Dofus et runes Ga, qui ne passent
-- pas par le multiplicateur de butin). Au plus un Chantier par semaine (semaine ISO, heure de Paris). L'objectif est calé
-- sur les kamas réels du serveur : 10 % des kamas des parties actives des 7 derniers jours, chaque partie comptée au plus
-- 5 fois la médiane (un seul compte très riche ne fait pas grimper l'objectif), au moins 1 million. Mathis peut le changer
-- (adm_chantier_goal). Un joueur verse au plus 40 % de l'objectif par semaine : il faut au moins 3 mécènes.
-- Les kamas sortent de la partie comme à l'hôtel de vente (hdv_save, hdv_kamas, hdv_op négative, vérifiés par le serveur).
-- Espace de saison : copié dans s1 par tools/saison_schema.js (chaque serveur a son Chantier). Monocompte : mono_chantier.sql.
-- Appliqué par le workflow « Serveur en ligne » ; relançable sans danger.
-- ============================================================================

create table if not exists s1.chantier (
  wk text primary key,                 -- semaine ISO de Paris, « 2026-46 »
  goal bigint not null check (goal > 0),
  total bigint not null default 0,
  done_at timestamptz,
  ends_at timestamptz,                 -- fin du ×2 (done_at + 48 h)
  at timestamptz not null default now()
);
alter table s1.chantier enable row level security; -- aucune lecture directe : seulement par les fonctions ci-dessous

create table if not exists s1.chantier_dons (
  wk text not null references s1.chantier (wk) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount bigint not null default 0 check (amount >= 0),
  at timestamptz not null default now(),
  primary key (wk, user_id)
);
alter table s1.chantier_dons enable row level security;

create or replace function s1.chantier_wk() returns text language sql stable
as $$ select to_char(now() at time zone 'Europe/Paris', 'IYYY-IW') $$;

-- Objectif de la semaine, lu dans les parties validées par le serveur (saves_ok.bilan.k = kamas).
create or replace function s1.chantier_goal_calc() returns bigint language sql stable security definer set search_path = s1, public
as $$
  with k as (select greatest(0, coalesce(case when (bilan->>'k') ~ '^\d{1,15}$' then (bilan->>'k')::numeric end, 0)) v
             from saves_ok where at > now() - interval '7 days'),
       c as (select coalesce(percentile_cont(0.5) within group (order by v), 0) * 5 p from k)
  select greatest(1000000, round(0.10 * coalesce((select sum(least(v, c.p)) from k, c), 0) / 10000) * 10000)::bigint
$$;
revoke all on function s1.chantier_goal_calc() from public, anon, authenticated;

-- Le Chantier de la semaine, créé au premier appel.
create or replace function s1.chantier_cur() returns s1.chantier language plpgsql security definer set search_path = s1, public
as $$
declare w text := chantier_wk(); r chantier;
begin
  select * into r from chantier where wk = w;
  if r.wk is null then
    insert into chantier (wk, goal) values (w, chantier_goal_calc()) on conflict (wk) do nothing;
    select * into r from chantier where wk = w;
  end if;
  return r;
end $$;
revoke all on function s1.chantier_cur() from public, anon, authenticated;

-- État pour le jeu : la semaine en cours, le ×2 en cours (peut venir de la semaine d'avant), les 10 premiers mécènes.
create or replace function s1.chantier_state() returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare r chantier; b chantier; me uuid := auth.uid();
begin
  r := chantier_cur();
  select * into b from chantier where ends_at > now() order by ends_at desc limit 1;
  return jsonb_build_object('wk', r.wk, 'goal', r.goal, 'total', r.total, 'done', r.done_at, 'now', now(),
    'bonus', b.ends_at, -- fin du ×2 en cours, ou null
    'mine', coalesce((select amount from chantier_dons where wk = r.wk and user_id = me), 0),
    'cap', floor(r.goal * 0.4)::bigint,
    'n', (select count(*) from chantier_dons where wk = r.wk and amount > 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('p', coalesce(pseudo_of(d.user_id), '?'), 'k', d.amount) order by d.amount desc, d.at)
      from (select * from chantier_dons where wk = r.wk and amount > 0 order by amount desc, at limit 10) d), '[]'::jsonb));
end $$;
revoke all on function s1.chantier_state() from public;
grant execute on function s1.chantier_state() to anon, authenticated;

-- Verser des kamas (compte connecté, partie en ligne validée, pas en vérification). Renvoie l'état et les opérations à appliquer.
create or replace function s1.chantier_give(p_amount bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare me uuid := auth.uid(); d jsonb; have numeric; r chantier; mine bigint; cap bigint; give bigint;
begin
  if me is null then return hdv_err('Connecte-toi à un compte (gratuit) pour participer au Chantier.'); end if;
  if p_amount is null or p_amount < 1000 then return hdv_err('Au moins 1 000 kamas.'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text)); -- même verrou que l'hôtel de vente : un don et un achat en même temps passent l'un après l'autre
  begin d := hdv_save(me); exception when others then return hdv_err(sqlerrm); end;
  r := chantier_cur();
  select * into r from chantier where wk = r.wk for update;
  if r.done_at is not null then return hdv_err('Le Chantier de la semaine est déjà fini : merci ! Le prochain ouvre lundi.'); end if;
  mine := coalesce((select amount from chantier_dons where wk = r.wk and user_id = me), 0);
  cap := floor(r.goal * 0.4)::bigint;
  give := least(p_amount, cap - mine, r.goal - r.total);
  if give < 1 then return hdv_err('Tu as déjà versé ta part de la semaine (40 % de l''objectif au plus).'); end if;
  have := hdv_kamas(me, d);
  if have < give then return hdv_err('Pas assez de kamas sur ta partie en ligne : ' || replace(to_char(floor(have), 'FM999G999G999G999'), ',', ' ') || ' (la partie part en ligne toutes les 30 s).'); end if;
  insert into chantier_dons (wk, user_id, amount) values (r.wk, me, give)
    on conflict (wk, user_id) do update set amount = chantier_dons.amount + excluded.amount, at = now();
  update chantier set total = total + give where wk = r.wk returning * into r;
  perform hdv_op(me, jsonb_build_object('k', -give, 'chantier', r.wk), 'Chantier du serveur : ' || replace(to_char(give, 'FM999G999G999G999'), ',', ' ') || ' kamas versés');
  if r.total >= r.goal then
    update chantier set done_at = now(), ends_at = now() + interval '48 hours' where wk = r.wk;
    insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', me, pseudo_of(me), 'ann',
      'Le Chantier du serveur ' || case when (current_schemas(false))[1] = 's1' then 'Saison 1' else 'Éternel' end || ' est fini : ×2 XP et ×2 butin pour tout le monde pendant 48 h ! Merci aux ' || (select count(*) from chantier_dons where wk = r.wk and amount > 0) || ' mécènes.',
      jsonb_build_object('t', 'admin', 'banner', false, 'chantier', r.wk));
  end if;
  return jsonb_build_object('ok', true, 'given', give, 'ops', hdv_ops_after(me, hdv_cursor(d)), 'state', chantier_state());
end $$;
revoke all on function s1.chantier_give(bigint) from public;
grant execute on function s1.chantier_give(bigint) to authenticated;

-- Panel : changer l'objectif de la semaine (Mathis seul). Ne peut pas finir le Chantier à lui seul : au moins 1 kama de plus que versé.
create or replace function s1.adm_chantier_goal(p_goal bigint) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare r chantier;
begin
  perform adm_need(true);
  if p_goal is null or p_goal < 100000 then return hdv_err('Au moins 100 000 kamas.'); end if;
  r := chantier_cur();
  if r.done_at is not null then return hdv_err('Le Chantier de la semaine est déjà fini.'); end if;
  update chantier set goal = greatest(p_goal, total + 1) where wk = r.wk;
  perform alog(format('objectif du Chantier : %s kamas', p_goal));
  return chantier_state();
end $$;
revoke all on function s1.adm_chantier_goal(bigint) from public;
grant execute on function s1.adm_chantier_goal(bigint) to authenticated;

reset search_path;

-- ======================== supabase/saison1_vitrine.sql ========================
set search_path = s1, public;
-- Saison 1, lot 4 : registre des Fragments du Temps et vitrine de saison, gardés par le serveur.
-- CE FICHIER NE S'INSTALLE QUE DANS L'ESPACE DE SAISON : tools/saison_schema.js l'ajoute à supabase/saison1.sql (public. → s1.)
-- et il n'est pas dans la liste « tous » de .github/workflows/supabase.yml (jamais dans le Classique).
-- Le jeu tient le même registre dans la partie (js/saisonc.js) ; le serveur vérifie les bornes des activités (par jour, par
-- semaine, 800 au plus), refuse un achat sans assez de Fragments et garde les cosmétiques achetés, liés au compte.
-- Relançable sans danger. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.

create table if not exists s1.s1_cfg (id int primary key default 1 check (id = 1), debut timestamptz);
insert into s1.s1_cfg (id) values (1) on conflict do nothing;
alter table s1.s1_cfg enable row level security;
drop policy if exists "s1 cfg lisible" on s1.s1_cfg;
create policy "s1 cfg lisible" on s1.s1_cfg for select using (true);
revoke insert, update, delete on s1.s1_cfg from anon, authenticated;

create table if not exists s1.frag_led (
  user_id uuid not null references auth.users (id) on delete cascade,
  src text not null check (length(src) between 3 and 80),
  n int not null check (n between -1000 and 8),
  at timestamptz not null default now(),
  primary key (user_id, src)
);
alter table s1.frag_led enable row level security;
drop policy if exists "fragments : les siens" on s1.frag_led;
create policy "fragments : les siens" on s1.frag_led for select using (user_id = auth.uid());
revoke insert, update, delete on s1.frag_led from anon, authenticated;

-- bornes des activités (mêmes valeurs que E.S1C.ACT dans js/saisonc.js)
create or replace function s1.frag_act_max(k text) returns int language sql immutable as $$
  select case k when 'dj' then 8 when 'arch' then 6 when 'job' then 4 when 'bounty' then 4 when 'mt' then 4 else 0 end $$;

-- p_rows : [{ src: 'act:<jour>:<activité>:<cumul>', n }] ; renvoie le solde du serveur
create or replace function s1.frag_post(p_rows jsonb)
returns int language plpgsql security definer set search_path = s1, public as $$
declare
  me uuid := auth.uid(); r jsonb; s text; n int; parts text[]; d int; k text; t0 timestamptz; week int; quota int; tot int; dsum int;
begin
  if me is null then raise exception 'connexion nécessaire'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then raise exception 'envoi illisible'; end if;
  select coalesce(debut, (select min(at) from frag_led where user_id = me), now()) into t0 from s1_cfg where id = 1;
  if now() >= t0 + interval '56 days' then return (select coalesce(sum(n), 0) from frag_led where user_id = me); end if;
  week := least(8, greatest(1, ceil(extract(epoch from now() - t0) / 604800.0)::int));
  quota := least(800, 100 * week);
  for r in select * from jsonb_array_elements(p_rows) loop
    s := r ->> 'src'; n := coalesce((r ->> 'n')::int, 0);
    parts := string_to_array(coalesce(s, ''), ':');
    if array_length(parts, 1) <> 4 or parts[1] <> 'act' or parts[2] !~ '^[0-9]{1,2}$' or n < 1 or n > 8 then continue; end if;
    d := parts[2]::int; k := parts[3];
    if frag_act_max(k) = 0 or d < 1 or d > 56 then continue; end if;
    select coalesce(sum(f.n), 0) into dsum from frag_led f where f.user_id = me and f.src like format('act:%s:%s:%%', d, k);
    if dsum + n > frag_act_max(k) then continue; end if; -- borne du jour de cette activité
    select coalesce(sum(f.n), 0) into tot from frag_led f where f.user_id = me and f.n > 0;
    if tot + n > quota then continue; end if; -- quota de la semaine (100 par semaine, 800 au plus)
    insert into frag_led (user_id, src, n) values (me, s, n) on conflict do nothing;
  end loop;
  return (select coalesce(sum(f.n), 0) from frag_led f where f.user_id = me);
end $$;

-- prix de la vitrine (mêmes valeurs que E.VIT dans js/vitrine.js)
create or replace function s1.vit_prix(p_id text) returns int language sql immutable as $$
  select case p_id when 'v_aiguilles' then 60 when 'v_tictac' then 60 when 'v_gardien' then 60
    when 'v_rouages' then 120 when 'v_coucou' then 120 when 'v_cadran' then 120 when 'v_voyageur' then 120 when 'v_village' then 120
    when 'v_horloge' then 200 when 'v_sablier' then 200 when 'v_rouagier' then 200 when 'v_cadre' then 200
    when 'v_fissure' then 160
    when 'v_st9' then 60 when 'v_st10' then 60 when 'v_st12' then 120 when 'v_st21' then 60 when 'v_st22' then 120 when 'v_st24' then 60 when 'v_st30' then 120 when 'v_st35' then 60 -- lot 5 : autocollants et meubles rares (js/saisonsoc.js)
    when 'v_mb6' then 60 when 'v_mb3' then 120 when 'v_mb5' then 120 when 'v_mb9' then 120 when 'v_mb4' then 200 when 'v_mb7' then 200 when 'v_mb12' then 160
    else 0 end $$;

create or replace function s1.vit_buy(p_id text)
returns text language plpgsql security definer set search_path = s1, public as $$
declare me uuid := auth.uid(); p int := vit_prix(p_id); bal int;
begin
  if me is null then return 'Connexion nécessaire.'; end if;
  if p = 0 then return 'Objet inconnu.'; end if;
  if exists (select 1 from frag_led where user_id = me and src = 'vit:' || p_id) then return null; end if; -- déjà acheté : rien à refaire
  perform pg_advisory_xact_lock(hashtext('vit:' || me::text));
  select coalesce(sum(n), 0) into bal from frag_led where user_id = me;
  if bal < p then return format('Il faut %s Fragments du Temps.', p); end if;
  insert into frag_led (user_id, src, n) values (me, 'vit:' || p_id, -p) on conflict do nothing;
  return null;
end $$;

-- cosmétiques de la vitrine du compte (lus aussi par la partie Éternel : ils sont liés au compte)
create or replace function s1.vit_mine()
returns jsonb language sql stable security definer set search_path = s1, public as $$
  select coalesce(jsonb_agg(substr(src, 5) order by at), '[]'::jsonb) from frag_led where user_id = auth.uid() and src like 'vit:%' $$;

revoke all on function s1.frag_post(jsonb) from public, anon;
revoke all on function s1.vit_buy(text) from public, anon;
revoke all on function s1.vit_mine() from public, anon;
grant execute on function s1.frag_post(jsonb) to authenticated;
grant execute on function s1.vit_buy(text) to authenticated;
grant execute on function s1.vit_mine() to authenticated;

reset search_path;

-- ======================== supabase/tournoi.sql ========================
set search_path = s1, public;
-- Saison 1, lot 8 : le Tournoi des guildes (js/tournoi.js). Classique (Éternel) et Classique · Saison 1 (copie dans s1 par
-- tools/saison_schema.js). Pas en Monocompte (pas de guildes).
-- Inscriptions du lundi au samedi midi (heure de Paris) : la fonction « record » copie l'équipe d'arène du joueur depuis sa
-- partie en ligne (tour_join, réservé au serveur). 5 inscrits par guilde au plus. Le tableau est joué par la fonction
-- « record » (E.tourInit / E.tourStep) et gardé dans tour_state ; tout le monde peut le lire (tour_view), sans les équipes.
-- NE S'INSTALLE PAS TOUT SEUL : Mathis installe la saison en une fois (phrase d'installation).

create table if not exists s1.tour_teams (
  w int not null,                                                   -- semaine (E.tourWeek, celle du Kolizéum)
  user_id uuid not null references auth.users (id) on delete cascade,
  guild_id bigint not null references s1.guilds (id) on delete cascade,
  pseudo text not null default '',
  team jsonb not null,                                              -- équipe d'arène copiée par le serveur
  lvl int not null default 1,
  heads jsonb not null default '[]'::jsonb,                         -- ce que voient les autres (classes, têtes, niveaux)
  at timestamptz not null default now(),
  primary key (w, user_id)
);
create index if not exists tour_teams_g on s1.tour_teams (w, guild_id, at);
alter table s1.tour_teams enable row level security;

create table if not exists s1.tour_state (
  w int primary key,
  data jsonb not null,                                              -- état du tableau (E.tourInit), équipes comprises
  done boolean not null default false,
  at timestamptz not null default now()
);
alter table s1.tour_state enable row level security;

-- semaine et phase, heure de Paris (mêmes règles que js/tournoi.js) ; tour_now : l'heure (remplacée dans les tests)
create or replace function s1.tour_now() returns timestamp language sql stable as $$ select now() at time zone 'Europe/Paris' $$;
create or replace function s1.tour_wk() returns int language sql stable set search_path = s1, public
as $$ select floor(((tour_now()::date - date '1970-01-01') + 3) / 7.0)::int $$;
create or replace function s1.tour_phase() returns text language sql stable set search_path = s1, public
as $$ select case
  when extract(isodow from tour_now()) = 7 and extract(hour from tour_now()) >= 20 then 'finale'
  when extract(isodow from tour_now()) = 7 then 'tours'
  when extract(isodow from tour_now()) = 6 and extract(hour from tour_now()) >= 12 then 'tours'
  else 'inscr' end $$;

-- inscription (serveur seulement) : membre d'une guilde, pendant les inscriptions, 5 par guilde ; une nouvelle inscription
-- remplace l'équipe gardée
create or replace function s1.tour_join(p_user uuid, p_w int, p_pseudo text, p_team jsonb, p_lvl int, p_heads jsonb) returns jsonb
language plpgsql security definer set search_path = s1, public
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
revoke all on function s1.tour_join(uuid, int, text, jsonb, int, jsonb) from public, anon, authenticated;
grant execute on function s1.tour_join(uuid, int, text, jsonb, int, jsonb) to service_role;

-- se retirer (le joueur) ou retirer un membre (Meneur ou Bras droit), pendant les inscriptions
create or replace function s1.tour_leave(p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = s1, public
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
revoke all on function s1.tour_leave(uuid) from public, anon;
grant execute on function s1.tour_leave(uuid) to authenticated;

-- les inscrits d'une semaine, par guilde, équipes comprises (serveur seulement : pour faire le tableau)
create or replace function s1.tour_entries(p_w int) returns jsonb
language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(x order by x->>'g'), '[]'::jsonb) from (
  select jsonb_build_object('g', t.guild_id, 'name', gu.name, 'ic', gu.ic, 'col', gu.col,
    'teams', jsonb_agg(jsonb_build_object('u', t.user_id, 'n', t.pseudo, 'lvl', t.lvl, 'team', t.team, 'heads', t.heads) order by t.at)) x
  from tour_teams t join guilds gu on gu.id = t.guild_id where t.w = p_w group by t.guild_id, gu.name, gu.ic, gu.col) s $$;
revoke all on function s1.tour_entries(int) from public, anon, authenticated;
grant execute on function s1.tour_entries(int) to service_role;

create or replace function s1.tour_save(p_w int, p_data jsonb, p_done boolean) returns void
language sql security definer set search_path = s1, public
as $$ insert into tour_state (w, data, done, at) values (p_w, p_data, p_done, now())
  on conflict (w) do update set data = excluded.data, done = excluded.done, at = now() where not tour_state.done $$;
revoke all on function s1.tour_save(int, jsonb, boolean) from public, anon, authenticated;
grant execute on function s1.tour_save(int, jsonb, boolean) to service_role;

-- ce que tout le monde voit : la phase, les inscrits (sans les équipes) et le tableau (sans les équipes)
create or replace function s1.tour_view(p_w int default null) returns jsonb
language sql stable security definer set search_path = s1, public
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
grant execute on function s1.tour_view(int) to anon, authenticated, service_role;

reset search_path;

-- ======================== supabase/wboss_s1.sql ========================
set search_path = s1, public;
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

alter table s1.wb_kills add column if not exists fled boolean not null default false;   -- semaine finie sans le tuer
alter table s1.wb_kills add column if not exists cap bigint;                              -- dégâts de toute la semaine (PV de la suivante)
alter table s1.wb_kills add column if not exists recap timestamptz;                       -- bilan du lundi posté sur Discord
create table if not exists s1.wb_pal (n int not null, user_id uuid not null references auth.users (id) on delete cascade, p int not null, at timestamptz not null default now(), primary key (n, user_id, p));
alter table s1.wb_pal enable row level security;
create table if not exists s1.wb_tiers (n int not null, user_id uuid not null references auth.users (id) on delete cascade, tier text not null, at timestamptz not null default now(), primary key (n, user_id, tier));
alter table s1.wb_tiers enable row level security;
create table if not exists s1.wb_flags (id bigint generated always as identity primary key, n int not null, user_id uuid not null, points int not null, at timestamptz not null default now());
alter table s1.wb_flags enable row level security;

-- ---------- règles ----------
create or replace function s1.wb_s1_rot(w int) returns text language sql immutable
as $$ select (array['garga', 'kralamoure', 'cire_momore', 'grozilla', 'chazino', 'garga', 'kralamoure', 'cire_momore'])[((greatest(1, w) - 1) % 8) + 1] $$;
create or replace function s1.wb_name(n int) returns text language sql immutable
as $$ select case wb_s1_rot(n) when 'garga' then 'Gargandyas' when 'kralamoure' then 'Kralamoure Géant' when 'cire_momore' then 'Cire Momore'
  when 'grozilla' then 'Grozilla et Grasmera' else 'Chazino' end $$;
-- semaine de saison en cours (1…8 ; 1 tant que la date d'ouverture n'est pas posée)
create or replace function s1.wb_week() returns int language sql stable security definer set search_path = s1, public
as $$ select greatest(1, least(8, coalesce(floor(extract(epoch from (now() - (select debut from s1_cfg where id = 1))) / 604800)::int + 1, 1))) $$;
create or replace function s1.wb_week_end(w int) returns timestamptz language sql stable security definer set search_path = s1, public
as $$ select coalesce((select debut from s1_cfg where id = 1), date_trunc('week', now())) + make_interval(days => 7 * w) $$;
create or replace function s1.wb_cap(p int) returns int language sql immutable as $$ select least(6000, greatest(0, p)) $$;
-- « Dernier soir » (Mathis 03/11) : le dernier soir de la semaine du boss (le dimanche quand la saison s'ouvre un lundi), de 20 h à 22 h
-- (Paris), si le boss a perdu 75 % de ses PV sans tomber, chacun reçoit
-- un 4e essai ce jour-là pour l'achever avant sa fuite. p_grace laisse 15 min de plus pour compter un essai commencé avant 22 h.
create or replace function s1.wb_last_night(p_grace boolean default false, p_at timestamptz default now()) returns boolean language sql stable security definer set search_path = s1, public
as $$ select exists (select 1 from wb_state s where s.id = 1 and s.dmg * 4 >= s.hp * 3 and s.dmg < s.hp
    and not exists (select 1 from wb_kills k where k.n = s.n and not k.fled)
    and (p_at at time zone 'Europe/Paris')::time >= time '20:00'
    and (p_at at time zone 'Europe/Paris')::time < case when p_grace then time '22:15' else time '22:00' end
    and wb_week_end(s.n) - p_at < interval '1 day' and wb_week_end(s.n) > p_at) $$;
create or replace function s1.wb_max(p_grace boolean default false) returns int language sql stable security definer set search_path = s1, public
as $$ select case when wb_last_night(p_grace) then 4 else 3 end $$;
-- podium du meilleur essai de la semaine
create or replace function s1.wb_best(p_n int, lim int default 10) returns jsonb language sql stable security definer set search_path = s1, public
as $$ select coalesce(jsonb_agg(x order by x.best desc), '[]'::jsonb) from (
  select user_id u, pseudo_of(user_id) p, max(points) best, count(*) n, sum(points)::bigint pts from wb_hits where n = p_n group by user_id order by max(points) desc limit lim) x $$;

-- Ferme la semaine passée (fuite ou mort déjà notée), donne le podium et ouvre le boss de la semaine. Appelée par wb_info, wb_start, wb_done.
create or replace function s1.wb_roll() returns void language plpgsql security definer set search_path = s1, public
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
create or replace function s1.wb_pal_give(p_n int, p_dmg bigint, p_hp bigint, p_only uuid default null) returns void language plpgsql security definer set search_path = s1, public
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
create or replace function s1.wb_info() returns jsonb language plpgsql security definer set search_path = s1, public
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
revoke all on function s1.wb_info() from public;
grant execute on function s1.wb_info() to anon, authenticated;

-- Bilan du lundi sur Discord (Mathis 03/11) : appelée par le workflow « Bilan du boss de la semaine » (clé de service, jamais le jeu).
-- Ferme la semaine passée si personne ne l'a encore fait, puis rend une seule fois le bilan de la semaine finie (chute ou fuite,
-- podium, paliers du serveur, paliers d'essais) et le boss qui arrive. Rend '[]' s'il n'y a rien de nouveau (saison pas ouverte).
create or replace function s1.wb_recap() returns jsonb language plpgsql security definer set search_path = s1, public
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
create or replace function s1.wb_start(p_user uuid) returns jsonb language plpgsql security definer set search_path = s1, public
as $$
declare s wb_state;
begin
  if not exists (select 1 from profiles where id = p_user) then return g_err('Crée ton compte pour frapper le boss.'); end if;
  perform wb_roll();
  if (select count(*) from wb_hits where user_id = p_user and day = gb_day()) >= wb_max() then return g_err('Plus d''essai aujourd''hui : reviens après minuit.'); end if;
  select * into s from wb_state where id = 1;
  return jsonb_build_object('ok', true, 's1', true, 'n', s.n, 'phase', wb_phase(s.dmg, s.hp), 'k', (select count(*) from wb_hits where user_id = p_user and n = s.n));
end $$;

create or replace function s1.wb_done(p_user uuid, p_n int, p_k int, p_points int, p_phase int, p_lvl int, p_rounds int, p_alive int) returns jsonb language plpgsql security definer set search_path = s1, public
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
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['wb_start(uuid)', 'wb_done(uuid, int, int, int, int, int, int, int)'] loop
    execute format('revoke all on function s1.%s from public, anon, authenticated', f);
    execute format('grant execute on function s1.%s to service_role', f);
  end loop;
end $$;
-- premier boss de la saison : Gargandyas, 20 000 points (E.WB_S1.hp0) tant que personne ne l'a frappé
update s1.wb_state set hp = 20000 where id = 1 and n = 1 and dmg = 0 and not exists (select 1 from s1.wb_hits);

reset search_path;

-- ======================== supabase/histoire_s1.sql ========================
set search_path = s1, public;
-- Saison 1, quêtes : objectif commun au serveur de la campagne de saison (js/histoire.js, E.CAMP).
-- CE FICHIER NE S'INSTALLE QUE DANS L'ESPACE DE SAISON : tools/saison_schema.js l'ajoute à supabase/saison1.sql (public. → s1.).
-- Chaque chapitre k (1 à 8) de la campagne s'ouvre la semaine k. Le serveur compte les joueurs qui le finissent pendant
-- sa semaine (un compte une seule fois) ; le jeu lit ces nombres et donne un Coffre en or quand l'objectif est atteint.
-- Le serveur ne donne rien lui-même : il ne fait que compter. Relançable sans danger. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.
-- Il a besoin de s1.s1_cfg (supabase/saison1_vitrine.sql, placé avant lui dans la liste EXTRA).

create table if not exists s1.camp_fin (
  user_id uuid not null references auth.users (id) on delete cascade,
  ch smallint not null check (ch between 1 and 8),
  at timestamptz not null default now(),
  primary key (user_id, ch)
);
alter table s1.camp_fin enable row level security;
drop policy if exists "campagne : les siens" on s1.camp_fin;
create policy "campagne : les siens" on s1.camp_fin for select using (user_id = auth.uid());
revoke insert, update, delete on s1.camp_fin from anon, authenticated;

-- semaine de la saison (1 à 8), 0 avant l'ouverture, 9 après la fin
create or replace function s1.camp_wk() returns int language sql stable security definer set search_path = s1, public as $$
  select case when c.debut is null or now() < c.debut then 0
    else least(9, floor(extract(epoch from now() - c.debut) / 604800.0)::int + 1) end
  from s1_cfg c where c.id = 1 $$;

-- le joueur a fini le chapitre p_ch : compté seulement pendant la semaine de ce chapitre ; renvoie le nombre du chapitre
create or replace function s1.camp_done(p_ch int)
returns int language plpgsql security definer set search_path = s1, public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'connexion nécessaire'; end if;
  if p_ch is null or p_ch < 1 or p_ch > 8 then raise exception 'chapitre inconnu'; end if;
  if p_ch = camp_wk() then insert into camp_fin (user_id, ch) values (me, p_ch) on conflict do nothing; end if;
  return (select count(*) from camp_fin where ch = p_ch);
end $$;

-- nombres de tous les chapitres : { "1": 12, "2": 3, ... } (lisible par tous, sans les comptes)
create or replace function s1.camp_count()
returns jsonb language sql stable security definer set search_path = s1, public as $$
  select coalesce(jsonb_object_agg(ch::text, n), '{}'::jsonb) from (select ch, count(*) n from camp_fin group by ch) x $$;

revoke all on function s1.camp_wk() from public;
revoke all on function s1.camp_done(int) from public, anon;
grant execute on function s1.camp_done(int) to authenticated;
grant execute on function s1.camp_count() to anon, authenticated;

reset search_path;

-- ======================== supabase/classements_s1.sql ========================
set search_path = s1, public;
-- Saison 1 : classement de la semaine de la Chevauchée des Cavaliers et classement de la manche des Expéditions de saison.
-- CE FICHIER NE S'INSTALLE QUE DANS L'ESPACE DE SAISON : tools/saison_schema.js l'ajoute à supabase/saison1.sql (public. → s1.).
-- Les chiffres viennent du résumé que le serveur calcule sur la partie validée (VERIFY.fullSummary, champ s1lb) : rien n'est
-- envoyé par le jeu lui-même. Un compte retiré des classements (ladder.flagged) n'apparaît pas.
-- Relançable sans danger. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.

create table if not exists s1.lb_s1 (
  user_id uuid primary key references auth.users (id) on delete cascade,
  w int not null default -1,      -- semaine de saison du meilleur essai de Chevauchée
  chev_n int not null default 0,  -- Cavaliers vaincus (0 à 4)
  chev_k int not null default 0,  -- stasis
  chev_t int not null default 0,  -- tours
  m int not null default -1,      -- manche des Expéditions
  exp int not null default 0,     -- somme des 3 meilleurs scores de la manche
  at timestamptz not null default now()
);
alter table s1.lb_s1 enable row level security;
revoke all on s1.lb_s1 from anon, authenticated;

create or replace function s1.lb_s1_from_save() returns trigger language plpgsql security definer set search_path = s1, public as $$
declare x jsonb := new.meta->'s1lb';
begin
  if x is null or jsonb_typeof(x) <> 'object' then return new; end if;
  insert into lb_s1 (user_id, w, chev_n, chev_k, chev_t, m, exp, at)
    values (new.user_id, coalesce((x->>'w')::int, -1), least(4, greatest(0, coalesce((x->>'n')::int, 0))), least(15, greatest(0, coalesce((x->>'k')::int, 0))),
      least(9999, greatest(0, coalesce((x->>'t')::int, 0))), coalesce((x->>'m')::int, -1), least(300000, greatest(0, coalesce((x->>'x')::int, 0))), now())
    on conflict (user_id) do update set w = excluded.w, chev_n = excluded.chev_n, chev_k = excluded.chev_k, chev_t = excluded.chev_t, m = excluded.m, exp = excluded.exp, at = now();
  return new;
end $$;
drop trigger if exists saves_lb_s1 on s1.saves_ok;
create trigger saves_lb_s1 after insert or update on s1.saves_ok for each row execute function s1.lb_s1_from_save();

-- p_w : semaine de saison (E.s1cWeek) ; 50 premiers : Cavaliers vaincus, puis stasis, puis le moins de tours
create or replace function s1.lb_chev(p_w int) returns table (rang bigint, user_id uuid, pseudo text, n int, k int, t int)
language sql stable security definer set search_path = s1, public as $$
  select row_number() over (order by l.chev_n desc, l.chev_k desc, l.chev_t asc, l.at asc), l.user_id, pseudo_of(l.user_id), l.chev_n, l.chev_k, l.chev_t
  from lb_s1 l where l.w = p_w and l.chev_n > 0 and not exists (select 1 from ladder d where d.user_id = l.user_id and d.flagged)
  order by l.chev_n desc, l.chev_k desc, l.chev_t asc, l.at asc limit 50 $$;
-- p_m : manche (E.s1cManche) ; 50 premiers à la somme des 3 meilleurs scores
create or replace function s1.lb_exps1(p_m int) returns table (rang bigint, user_id uuid, pseudo text, score int)
language sql stable security definer set search_path = s1, public as $$
  select row_number() over (order by l.exp desc, l.at asc), l.user_id, pseudo_of(l.user_id), l.exp
  from lb_s1 l where l.m = p_m and l.exp > 0 and not exists (select 1 from ladder d where d.user_id = l.user_id and d.flagged)
  order by l.exp desc, l.at asc limit 50 $$;
grant execute on function s1.lb_chev(int), s1.lb_exps1(int) to anon, authenticated;
revoke execute on function s1.lb_s1_from_save() from anon, authenticated, public;

reset search_path;

-- ======================== supabase/chat_s1.sql ========================
set search_path = s1, public;
-- 2.2.4.9 « Hauts faits par serveur » (Mathis, 04/11) : les hauts faits sont communs à tous les salons, chacun dit maintenant
-- de quel serveur il vient (data.srv : 'e' Éternel, 's' Saison 1). Version Saison 1 de public.chat_ann (supabase/chat.sql) :
-- les fonctions de la saison (search_path s1, public) la trouvent avant celle de public. Elle lit le classement de la SAISON
-- (compte signalé, classe et niveau du héros principal) et écrit dans le chat commun. Fichier propre à la saison (EXTRA de
-- tools/saison_schema.js), jamais installé dans le Classique.
create or replace function s1.chat_ann(p_user uuid, p_data jsonb) returns void language plpgsql security definer set search_path = s1, public
as $$ declare pr record; lad record; begin
  select pseudo into pr from public.profiles where id = p_user;
  select main, main_lvl, flagged into lad from s1.ladder where user_id = p_user;
  if lad.flagged then return; end if;
  if not public.chat_ann_premier('s', p_user, p_data) then return; end if; -- 05/11 : chaque haut fait une seule fois (supabase/chat.sql)
  insert into public.chat_msgs (ch, user_id, pseudo, cls, lvl, kind, data) values ('g', p_user, pr.pseudo, lad.main, lad.main_lvl, 'ann', p_data || jsonb_build_object('srv', 's'));
end $$;
revoke all on function s1.chat_ann(uuid, jsonb) from public, anon, authenticated;

reset search_path;
