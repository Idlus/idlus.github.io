-- ============================================================================
-- Idlus 1.0.11 — parties 2 et 3 gardées en ligne (écran « Choisis ta partie »).
-- EN ATTENTE : ce fichier n'est PAS appliqué sur le serveur. Il le sera seulement quand Mathis aura écrit
-- l'opération en toutes lettres. Ce jour-là : le déplacer dans supabase/, l'ajouter à la liste « tous » de
-- .github/workflows/supabase.yml et passer « slots: true » pour le jeu public dans js/online.js.
--
-- Ce qu'il fait : une NOUVELLE table save_slots, à côté de saves. Rien n'est modifié dans les tables
-- existantes : la partie 1 reste dans saves (classements, course, Hôtel de vente, guilde, Kolizéum, boss),
-- les parties 2 et 3 (solo) vont dans save_slots et n'entrent dans aucun classement.
-- Chaque joueur ne peut lire et écrire QUE ses propres parties. Relançable sans danger.
-- ============================================================================

create table if not exists public.save_slots (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot in (2, 3)),
  data text not null check (length(data) < 3000000),
  meta jsonb not null default '{}'::jsonb,
  game_version text,
  device text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.save_slots enable row level security;

drop policy if exists "lire ses parties solo" on public.save_slots;
create policy "lire ses parties solo" on public.save_slots for select to authenticated using (user_id = auth.uid());
-- L'écriture passe uniquement par push_slot et delete_slot (même règle que push_save : jamais par-dessus une
-- version plus récente sans que le joueur l'ait choisi).

-- ---------- envoi d'une partie solo (même logique que push_save) ----------
create or replace function public.push_slot(p_slot int, p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare r timestamptz;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if p_slot not in (2, 3) then raise exception 'emplacement inconnu'; end if;
  if length(p_data) >= 3000000 then raise exception 'partie trop grande'; end if;
  if exists (select 1 from profiles where id = auth.uid() and suspended_at is not null) then raise exception 'compte suspendu'; end if;
  if p_force then
    insert into save_slots (user_id, slot, data, meta, game_version, device, updated_at)
      values (auth.uid(), p_slot, p_data, coalesce(p_meta, '{}'::jsonb), p_version, p_device, clock_timestamp())
      on conflict (user_id, slot) do update set data = excluded.data, meta = excluded.meta, game_version = excluded.game_version, device = excluded.device, updated_at = excluded.updated_at
      returning updated_at into r;
  elsif p_expected is null then
    insert into save_slots (user_id, slot, data, meta, game_version, device, updated_at)
      values (auth.uid(), p_slot, p_data, coalesce(p_meta, '{}'::jsonb), p_version, p_device, clock_timestamp())
      on conflict (user_id, slot) do nothing
      returning updated_at into r;
  else
    update save_slots set data = p_data, meta = coalesce(p_meta, '{}'::jsonb), game_version = p_version, device = p_device, updated_at = clock_timestamp()
      where user_id = auth.uid() and slot = p_slot and updated_at = p_expected::timestamptz
      returning updated_at into r;
  end if;
  return to_char(r at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
end $$;
revoke all on function public.push_slot(int, text, jsonb, text, text, text, boolean) from public, anon;
grant execute on function public.push_slot(int, text, jsonb, text, text, text, boolean) to authenticated;

-- Date de la version en ligne d'une partie solo, dans le même format que push_slot.
create or replace function public.slot_info(p_slot int)
returns table (updated_at text, meta jsonb, device text, game_version text)
language sql
security invoker
set search_path = public
as $$
  select to_char(s.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), s.meta, s.device, s.game_version
  from save_slots s where s.user_id = auth.uid() and s.slot = p_slot;
$$;
revoke all on function public.slot_info(int) from public, anon;
grant execute on function public.slot_info(int) to authenticated;

-- Effacer sa partie 2 ou 3 (bouton « Supprimer » de l'écran de choix).
create or replace function public.delete_slot(p_slot int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from save_slots where user_id = auth.uid() and slot = p_slot;
end $$;
revoke all on function public.delete_slot(int) from public, anon;
grant execute on function public.delete_slot(int) to authenticated;
