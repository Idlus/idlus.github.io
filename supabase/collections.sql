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
create table if not exists public.dofus_sublimes (
  user_id uuid not null references auth.users (id) on delete cascade,
  dofus text not null check (dofus ~ '^[a-z]{2,20}$'),
  at timestamptz not null default now(),
  primary key (user_id, dofus)
);
alter table public.dofus_sublimes enable row level security;
drop policy if exists "lire les dofus sublimés" on public.dofus_sublimes;
create policy "lire les dofus sublimés" on public.dofus_sublimes for select to anon, authenticated using (true);
-- (aucune écriture directe : seul le déclencheur ci-dessous ajoute des lignes)

create or replace function public.dsub_from_save() returns trigger language plpgsql security definer set search_path = public
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
revoke all on function public.dsub_from_save() from public, anon, authenticated;
-- après saves_ladder (les déclencheurs passent par ordre alphabétique) : la ligne du classement est déjà à jour
drop trigger if exists saves_sublime on public.saves;
create trigger saves_sublime after insert or update on public.saves for each row execute function public.dsub_from_save();
