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
create table if not exists public.chroma_board (
  user_id uuid primary key references auth.users (id) on delete cascade,
  n int not null default 0,
  vit jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.chroma_board enable row level security; -- lu par la vue lb_chroma seulement
create table if not exists public.chroma_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  k text not null check (k ~ '^m[0-9]{1,6}$'),
  p boolean not null default false,
  at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table public.chroma_seen enable row level security; -- aucune règle : seule la fonction ci-dessous y touche

create or replace function public.chroma_from_save() returns trigger language plpgsql security definer set search_path = public
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
revoke all on function public.chroma_from_save() from public, anon, authenticated;
-- après saves_ladder (les déclencheurs passent par ordre alphabétique : saves_chroma < saves_ladder ne marche pas),
-- d'où le nom saves_zchroma : la ligne du classement (flagged) est déjà à jour
drop trigger if exists saves_zchroma on public.saves;
drop trigger if exists saves_zchroma on public.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_zchroma after insert or update on public.saves_ok for each row execute function public.chroma_from_save();

create or replace view public.lb_chroma as
  select c.user_id, p.pseudo, l.main, l.main_lvl, c.n, c.vit
  from public.chroma_board c join public.ladder l on l.user_id = c.user_id join public.profiles p on p.id = c.user_id where not l.flagged;
grant select on public.lb_chroma to anon, authenticated;
