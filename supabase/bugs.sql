-- ============================================================================
-- Idlus — signalement des bugs (1.1.1.3). Appliqué automatiquement par le workflow « Serveur en ligne »
-- après chat.sql (il s'appuie sur adm_need, alog, chat_sanctions) ; relançable sans danger.
-- Un joueur (avec ou sans compte) décrit un bug depuis le bouton « Signaler un bug » ; le jeu joint un
-- diagnostic (version, appareil, page ouverte, résumé de la partie, dernières erreurs). Le workflow
-- « Bugs signalés » en fait un ticket GitHub (sans pseudo), que Claude reprend pour corriger le bug, et un fil dans le
-- forum #bugs du Discord,
-- puis il recopie ici où en est le ticket (corrigé dans telle version…) : le joueur le voit dans le jeu.
-- Personne ne lit la table directement : tout passe par les fonctions ci-dessous.
-- ============================================================================

create table if not exists public.bugs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  guest text,
  pseudo text not null,
  version text,
  page text,
  device text,
  what text not null check (length(what) between 10 and 1000),
  expected text check (expected is null or length(expected) <= 500),
  diag text check (diag is null or length(diag) <= 4000),
  status text not null default 'nouveau' check (status in ('nouveau', 'transmis', 'en_cours', 'corrige', 'pas_un_bug', 'a_voir')),
  issue int,
  discord text, -- fil du forum #bugs du Discord
  fixed_in text,
  note text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists bugs_who on public.bugs (coalesce(user_id::text, 'g:' || guest), created_at desc);
create index if not exists bugs_wait on public.bugs (id) where issue is null and status = 'nouveau';
alter table public.bugs enable row level security; -- aucune règle : personne ne lit la table directement

-- ---------- signaler un bug (joueurs, avec ou sans compte) ----------
-- Renvoie {"id": n} si le signalement est enregistré, sinon {"err": "message à montrer au joueur"}.
create or replace function public.bug_send(p_what text, p_expected text default null, p_page text default null, p_version text default null,
  p_device text default null, p_diag text default null, p_guest text default null, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$ declare
  u uuid := auth.uid();
  g text := case when auth.uid() is null then left(btrim(coalesce(p_guest, '')), 64) end;
  w text := btrim(coalesce(p_what, ''));
  x text := nullif(btrim(coalesce(p_expected, '')), '');
  nm text; k text; pr record; sa record; nid bigint;
begin
  if u is null and (g is null or length(g) < 8) then return jsonb_build_object('err', 'Impossible d''envoyer le signalement pour le moment.'); end if;
  if length(w) < 10 then return jsonb_build_object('err', 'Décris un peu plus le bug (10 caractères au moins).'); end if;
  if length(w) > 1000 then return jsonb_build_object('err', '1 000 caractères au maximum.'); end if;
  if length(coalesce(x, '')) > 500 then return jsonb_build_object('err', '500 caractères au maximum pour ce que tu attendais.'); end if;
  if (w || ' ' || coalesce(x, '')) ~* '(https?://|www\.|discord\.(gg|com))' then return jsonb_build_object('err', 'Les liens ne sont pas autorisés dans les signalements.'); end if;
  if u is not null then
    select pseudo, suspended_at into pr from profiles where id = u;
    if found and pr.suspended_at is not null then return jsonb_build_object('err', 'Ton compte est suspendu.'); end if;
    select * into sa from chat_sanctions where user_id = u;
    if found and sa.banned then return jsonb_build_object('err', 'Tu ne peux pas signaler de bug pour le moment.'); end if;
    nm := coalesce(pr.pseudo, left(btrim(coalesce(p_name, '')), 24));
  else
    nm := left(btrim(coalesce(p_name, '')), 24);
  end if;
  if coalesce(nm, '') = '' then nm := 'Joueur'; end if;
  k := coalesce(u::text, 'g:' || g);
  if exists (select 1 from bugs where coalesce(user_id::text, 'g:' || guest) = k and created_at > now() - interval '2 minutes') then
    return jsonb_build_object('err', 'Un signalement toutes les 2 minutes : réessaie un peu plus tard.');
  end if;
  if (select count(*) from bugs where coalesce(user_id::text, 'g:' || guest) = k and created_at > now() - interval '1 day') >= 15 then
    return jsonb_build_object('err', 'Tu as déjà signalé 15 bugs aujourd''hui : merci beaucoup ! Reviens demain.');
  end if;
  if u is null and (select count(*) from bugs where user_id is null and created_at > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('err', 'Beaucoup de signalements arrivent en ce moment : réessaie dans un moment.');
  end if;
  if exists (select 1 from bugs where coalesce(user_id::text, 'g:' || guest) = k and lower(what) = lower(w) and created_at > now() - interval '1 day') then
    return jsonb_build_object('err', 'Tu as déjà envoyé ce signalement aujourd''hui.');
  end if;
  insert into bugs (user_id, guest, pseudo, version, page, device, what, expected, diag)
  values (u, g, nm, left(btrim(coalesce(p_version, '')), 20), left(btrim(coalesce(p_page, '')), 80), left(btrim(coalesce(p_device, '')), 80), w, x, left(p_diag, 4000))
  returning id into nid;
  return jsonb_build_object('id', nid);
end $$;
revoke all on function public.bug_send(text, text, text, text, text, text, text, text) from public;
grant execute on function public.bug_send(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------- mes signalements (où en est la correction) ----------
create or replace function public.bug_mine(p_guest text default null) returns jsonb language plpgsql security definer set search_path = public
as $$ declare k text := coalesce(auth.uid()::text, 'g:' || left(btrim(coalesce(p_guest, '')), 64));
begin
  if auth.uid() is null and length(coalesce(p_guest, '')) < 8 then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (
    select id, left(what, 120) as what, status, fixed_in, note, created_at, updated_at
    from bugs where coalesce(user_id::text, 'g:' || guest) = k order by id desc limit 10) x);
end $$;
revoke all on function public.bug_mine(text) from public;
grant execute on function public.bug_mine(text) to anon, authenticated;

-- ---------- panel admin (lecture ; l'état suit le ticket GitHub) ----------
create or replace function public.adm_bugs() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(false);
  return (select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (
    select id, pseudo, version, page, device, what, expected, status, issue, fixed_in, note, created_at, (user_id is null) as guest
    from bugs order by id desc limit 200) x);
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_bugs()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
