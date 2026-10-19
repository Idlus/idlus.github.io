-- ============================================================================
-- Idlus — boîte à idées (0.1.36). Appliqué automatiquement par le workflow « Serveur en ligne »
-- après chat.sql (il s'appuie sur adm_need, alog, chat_sanctions) ; relançable sans danger.
-- Un joueur (avec ou sans compte) envoie une idée depuis Communauté › Suggestions ; le workflow
-- « Suggestions vers Discord » la publie ensuite dans le forum #idées (un fil par idée, avec son tag)
-- et note l'adresse du fil. Mathis les retrouve aussi dans son panel admin (onglet « Suggestions »).
-- Personne ne lit la table directement : tout passe par les fonctions ci-dessous.
-- ============================================================================

create table if not exists public.ideas (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  guest text,
  pseudo text not null,
  info text,
  tag text not null check (tag in ('Combat', 'Équipement', 'Contenu', 'Interface')),
  title text not null check (length(title) between 4 and 80),
  body text not null check (length(body) between 10 and 500),
  hidden boolean not null default false,
  relayed_at timestamptz,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists ideas_who on public.ideas (coalesce(user_id::text, 'g:' || guest), created_at desc);
create index if not exists ideas_wait on public.ideas (id) where relayed_at is null and not hidden;
alter table public.ideas enable row level security; -- aucune règle : personne ne lit la table directement

-- ---------- envoyer une idée (joueurs, avec ou sans compte) ----------
-- Renvoie null si l'idée est enregistrée, sinon le message d'erreur à montrer au joueur.
create or replace function public.idea_send(p_tag text, p_title text, p_body text, p_info text default null, p_guest text default null, p_name text default null)
returns text language plpgsql security definer set search_path = public
as $$ declare
  u uuid := auth.uid();
  g text := case when auth.uid() is null then left(btrim(coalesce(p_guest, '')), 64) end;
  t text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  b text := btrim(coalesce(p_body, ''));
  nm text; k text; pr record; sa record; inf text;
begin
  if u is null and (g is null or length(g) < 8) then return 'Impossible d''envoyer l''idée pour le moment.'; end if;
  if p_tag is null or p_tag not in ('Combat', 'Équipement', 'Contenu', 'Interface') then return 'Choisis ce que ça concerne.'; end if;
  if length(t) < 4 then return 'Donne un titre à ton idée (4 caractères au moins).'; end if;
  if length(t) > 80 then return 'Le titre fait 80 caractères au maximum.'; end if;
  if length(b) < 10 then return 'Explique un peu plus ton idée (10 caractères au moins).'; end if;
  if length(b) > 500 then return '500 caractères au maximum.'; end if;
  if (t || ' ' || b) ~* '(https?://|www\.|discord\.(gg|com)|[a-z0-9-]+\.(com|fr|net|org|gg|io|be|ch|xyz|ru|ly|me|tv)(/|\s|$))' then return 'Les liens ne sont pas autorisés dans les idées.'; end if;
  if u is not null then
    select pseudo, suspended_at into pr from profiles where id = u;
    if found and public.susp(u) then return 'Ton compte est suspendu.'; end if;
    select * into sa from chat_sanctions where user_id = u;
    if found and (sa.banned or sa.mute_until > now()) then return 'Tu ne peux pas envoyer d''idée pour le moment.'; end if;
    nm := coalesce(pr.pseudo, left(btrim(coalesce(p_name, '')), 24));
  else
    nm := left(btrim(coalesce(p_name, '')), 24);
  end if;
  if coalesce(nm, '') = '' then nm := 'Joueur'; end if;
  inf := nullif(left(btrim(coalesce(p_info, '')), 40), ''); -- « niv. 42 · Iop », envoyé par le jeu
  k := coalesce(u::text, 'g:' || g);
  if exists (select 1 from ideas where coalesce(user_id::text, 'g:' || guest) = k and created_at > now() - interval '1 minute') then
    return 'Une idée par minute : réessaie un peu plus tard.';
  end if;
  if (select count(*) from ideas where coalesce(user_id::text, 'g:' || guest) = k and created_at > now() - interval '1 day') >= 10 then
    return 'Tu as déjà envoyé 10 idées aujourd''hui : merci ! Reviens demain.';
  end if;
  if u is null and (select count(*) from ideas where user_id is null and created_at > now() - interval '1 hour') >= 30 then
    return 'Beaucoup d''idées arrivent en ce moment : réessaie dans un moment.';
  end if;
  if exists (select 1 from ideas where lower(title) = lower(t) and created_at > now() - interval '1 day') then
    return 'Une idée avec ce titre vient déjà d''être proposée.';
  end if;
  insert into ideas (user_id, guest, pseudo, info, tag, title, body) values (u, g, nm, inf, p_tag, t, b);
  return null;
end $$;
revoke all on function public.idea_send(text, text, text, text, text, text) from public;
grant execute on function public.idea_send(text, text, text, text, text, text) to anon, authenticated;

-- ---------- panel admin (équipe : lire ; Mathis : masquer) ----------
create or replace function public.adm_ideas() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(false);
  return (select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (
    select id, pseudo, info, tag, title, body, hidden, relayed_at, url, created_at, (user_id is null) as guest
    from ideas order by id desc limit 200) x);
end $$;

-- Masquer une idée : elle n'est plus publiée sur Discord (si elle y est déjà, la supprimer à la main sur Discord).
create or replace function public.adm_idea_hide(p_id bigint, p_on boolean) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(false);
  update ideas set hidden = p_on where id = p_id;
  perform public.alog(format(case when p_on then 'idée masquée : n°%s' else 'idée réaffichée : n°%s' end, p_id));
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_ideas()', 'adm_idea_hide(bigint, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
