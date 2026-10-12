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
drop policy if exists "créer sa partie" on public.saves;
create policy "créer sa partie" on public.saves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "modifier sa partie" on public.saves;
create policy "modifier sa partie" on public.saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "effacer sa partie" on public.saves;
create policy "effacer sa partie" on public.saves for delete to authenticated using (user_id = auth.uid());

-- ---------- envoi de la partie ----------
-- p_expected = date de la version en ligne que l'appareil connaît.
-- Si la partie en ligne a changé entre-temps (autre appareil), rien n'est écrit et la
-- fonction renvoie null : le jeu demande alors au joueur quelle version garder.
-- p_force = vrai quand le joueur a choisi de garder la version de cet appareil.
create or replace function public.push_save(p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare r timestamptz;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if exists (select 1 from profiles where id = auth.uid() and suspended_at is not null) then raise exception 'compte suspendu'; end if;
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
