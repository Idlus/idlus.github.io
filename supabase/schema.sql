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
create or replace function public.susp_lift() returns void language plpgsql security definer set search_path = public
as $$ declare ids uuid[]; begin
  with x as (update profiles set suspended_at = null, suspended_until = null where suspended_at is not null and suspended_until <= now() returning id)
  select array_agg(id) into ids from x;
  if ids is not null then update ladder set flagged = false, flag_reason = null where user_id = any(ids) and flag_reason = 'compte suspendu'; end if;
end $$;
-- Le compte u est-il suspendu en ce moment ? (lève la suspension si elle est finie)
create or replace function public.susp(u uuid) returns boolean language plpgsql security definer set search_path = public
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
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data text not null check (length(data) < 3000000),
  meta jsonb not null default '{}'::jsonb,
  game_version text,
  device text,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;

drop policy if exists "lire sa partie" on public.saves;
create policy "lire sa partie" on public.saves for select to authenticated using (user_id = auth.uid());
-- 21/10/2026 (faille de sauvegarde) : plus aucune écriture directe depuis le jeu (insert, update, upsert, delete du client).
-- La partie ne s'écrit que par push_save (security definer) : suspension, remise imposée (meta.remise) et protection
-- contre l'écrasement (p_expected) ne peuvent plus être contournées. L'effacement passe par delete_my_account (cascade).
drop policy if exists "créer sa partie" on public.saves;
drop policy if exists "modifier sa partie" on public.saves;
drop policy if exists "effacer sa partie" on public.saves;
revoke insert, update, delete on public.saves from anon, authenticated;

-- ---------- envoi de la partie ----------
-- p_expected = date de la version en ligne que l'appareil connaît.
-- Si la partie en ligne a changé entre-temps (autre appareil), rien n'est écrit et la
-- fonction renvoie null : le jeu demande alors au joueur quelle version garder.
-- p_force = vrai quand le joueur a choisi de garder la version de cet appareil.
create or replace function public.push_save(p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = public
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
revoke all on function public.push_save(text, jsonb, text, text, text, boolean) from public, anon;
grant execute on function public.push_save(text, jsonb, text, text, text, boolean) to authenticated;

-- Date de la version en ligne, dans le même format que push_save (pour comparer exactement).
create or replace function public.save_info()
returns table (updated_at text, meta jsonb, device text, game_version text)
language sql
security invoker
set search_path = public
as $$
  select to_char(s.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), s.meta, s.device, s.game_version
  from saves s where s.user_id = auth.uid();
$$;
revoke all on function public.save_info() from public, anon;
grant execute on function public.save_info() to authenticated;

-- ---------- supprimer son compte ----------
-- Efface le compte, son pseudo et sa partie en ligne (la partie sur l'appareil reste).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
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
create table if not exists public.saves_ok (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data text not null,
  meta jsonb not null default '{}'::jsonb,   -- résumé calculé par le serveur (VERIFY.fullSummary)
  bilan jsonb,                               -- kamas, ressources, Maîtrise, niveaux, Dofus, opération HdV (VERIFY.bilan)
  res real,                                  -- réserve d'heures de jeu (VERIFY.check)
  src_at timestamptz,                        -- date de la partie de saves qui a été validée
  at timestamptz not null default now(),
  accept boolean not null default false      -- « C'est bon » de Mathis : la prochaine partie envoyée est acceptée telle quelle
);
alter table public.saves_ok enable row level security;
-- Au premier passage, les parties déjà en ligne deviennent les parties validées de départ (rien n'est remis à zéro).
-- La date est reculée d'une heure pour que la première vérification se fasse tout de suite.
insert into public.saves_ok (user_id, data, meta, src_at, at)
  select user_id, data, '{}'::jsonb, updated_at, now() - interval '1 hour' from public.saves on conflict (user_id) do nothing;

-- 4A : une copie de la partie validée par jour (heure de Paris), 7 jours, pour remettre un joueur en arrière.
create table if not exists public.saves_jour (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  data text not null,
  lvl int, kamas bigint,
  at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.saves_jour enable row level security;

-- Ce que le bouclier a refusé (raison en clair), lu par le panel Xener.
create table if not exists public.bouclier_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  why text not null,
  at timestamptz not null default now()
);
create index if not exists bouclier_log_user on public.bouclier_log (user_id, at desc);
alter table public.bouclier_log enable row level security;
