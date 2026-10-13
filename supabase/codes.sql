-- ============================================================================
-- Idlus — codes cadeaux gérés par le serveur (0.1.26). Appliqué automatiquement par le
-- workflow « Serveur en ligne » après chat.sql (il s'appuie sur adm_need, alog et pseudo_of) ;
-- relançable sans danger.
-- Mathis crée les codes dans son panel admin (onglet « Codes cadeaux ») : récompenses, nombre
-- d'utilisations, date de fin. Les codes ne sont lisibles par personne d'autre : le jeu demande
-- seulement à gift_redeem si un code existe, et reçoit les récompenses s'il est valable.
-- Récompense (jsonb, même forme que les anciens codes IDLUS-…) : k kamas, r ressources [[nom, n]],
-- c consommables [[id, n]], i objets [[modèle, n]], t titre, o ornement.
-- ============================================================================

create table if not exists public.gift_codes (
  code text primary key check (code ~ '^[A-Z0-9]{4,20}$'),
  reward jsonb not null default '{}'::jsonb,
  msg text,
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  ends date,
  accounts_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.gift_codes enable row level security; -- aucune règle : personne ne lit la table directement

-- Une ligne par utilisation : un compte (user_id) ou une partie sans compte (guest, identifiant tiré au hasard par le jeu).
create table if not exists public.gift_uses (
  id bigint generated always as identity primary key,
  code text not null references public.gift_codes (code) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  guest text,
  at timestamptz not null default now()
);
create unique index if not exists gift_uses_user on public.gift_uses (code, user_id) where user_id is not null;
create unique index if not exists gift_uses_guest on public.gift_uses (code, guest) where guest is not null;
alter table public.gift_uses enable row level security;

-- Essais ratés récents, pour qu'on ne puisse pas deviner les codes en essayant au hasard.
create table if not exists public.gift_tries (who text not null, at timestamptz not null default now());
create index if not exists gift_tries_who on public.gift_tries (who, at desc);
alter table public.gift_tries enable row level security;

-- ---------- utiliser un code (joueurs, avec ou sans compte) ----------
create or replace function public.gift_redeem(p_code text, p_guest text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  u uuid := auth.uid();
  g text := case when auth.uid() is null then left(btrim(coalesce(p_guest, '')), 64) end;
  k text; x gift_codes%rowtype;
begin
  if u is null and (g is null or length(g) < 8) then return jsonb_build_object('err', 'Impossible de vérifier ce code pour le moment.'); end if;
  k := coalesce(u::text, 'g:' || g);
  delete from gift_tries where at < now() - interval '1 day';
  if (select count(*) from gift_tries where who = k and at > now() - interval '10 minutes') >= 10 then
    return jsonb_build_object('err', 'Trop d''essais d''un coup : réessaie dans quelques minutes.');
  end if;
  select * into x from gift_codes where code = c;
  if not found or not x.active then
    insert into gift_tries (who) values (k);
    return jsonb_build_object('err', 'Ce code n''existe pas.');
  end if;
  if x.ends is not null and (now() at time zone 'Europe/Paris')::date > x.ends then
    return jsonb_build_object('err', format('Ce code a expiré le %s.', to_char(x.ends, 'DD/MM/YYYY')));
  end if;
  if x.accounts_only and u is null then return jsonb_build_object('err', 'Ce code est réservé aux joueurs avec un compte.'); end if;
  if exists (select 1 from gift_uses where code = c and ((u is not null and user_id = u) or (g is not null and guest = g))) then
    return jsonb_build_object('err', 'Tu as déjà utilisé ce code.');
  end if;
  update gift_codes set uses = uses + 1 where code = c and (max_uses is null or uses < max_uses);
  if not found then return jsonb_build_object('err', 'Ce code a déjà été utilisé par tous les joueurs prévus.'); end if;
  begin
    insert into gift_uses (code, user_id, guest) values (c, u, g);
  exception when unique_violation then
    update gift_codes set uses = uses - 1 where code = c;
    return jsonb_build_object('err', 'Tu as déjà utilisé ce code.');
  end;
  return jsonb_build_object('ok', true, 'code', c, 'reward', x.reward, 'msg', x.msg);
end $$;
revoke all on function public.gift_redeem(text, text) from public;
grant execute on function public.gift_redeem(text, text) to anon, authenticated;

-- ---------- codes déjà utilisés par ce joueur (1.0.6.3) ----------
-- Le jeu redonne au chargement les récompenses d'un code utilisé dont la partie n'a pas gardé la trace
-- (réponse perdue en route, autre onglet ou autre appareil qui a écrasé la sauvegarde…).
create or replace function public.gift_mine(p_guest text default null) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare
  u uuid := auth.uid();
  g text := case when auth.uid() is null then left(btrim(coalesce(p_guest, '')), 64) end;
begin
  if u is null and (g is null or length(g) < 8) then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'reward', c.reward, 'msg', c.msg) order by gu.at), '[]'::jsonb)
    from gift_uses gu join gift_codes c on c.code = gu.code
    where (u is not null and gu.user_id = u) or (g is not null and gu.guest = g));
end $$;
revoke all on function public.gift_mine(text) from public;
grant execute on function public.gift_mine(text) to anon, authenticated;

-- ---------- panel admin (Mathis seulement) ----------
create or replace function public.adm_gifts() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select code, reward, msg, max_uses, uses, ends, accounts_only, active, created_at,
      (ends is not null and (now() at time zone 'Europe/Paris')::date > ends) as expired
    from gift_codes) x);
end $$;

create or replace function public.adm_gift_create(p_code text, p_reward jsonb, p_max int, p_ends date, p_accounts boolean, p_msg text, p_announce boolean)
returns text language plpgsql security definer set search_path = public
as $$ declare c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')); m text := nullif(left(btrim(coalesce(p_msg, '')), 120), ''); begin
  perform public.adm_need(true);
  if c !~ '^[A-Z0-9]{4,20}$' then return 'Le code doit faire 4 à 20 lettres ou chiffres, sans espace ni accent.'; end if;
  if exists (select 1 from gift_codes where code = c) then return 'Ce code existe déjà.'; end if;
  if p_reward is null or p_reward = '{}'::jsonb then return 'Ajoute au moins une récompense.'; end if;
  if p_max is not null and p_max < 1 then return 'Le nombre d''utilisations doit être au moins 1.'; end if;
  insert into gift_codes (code, reward, msg, max_uses, ends, accounts_only) values (c, p_reward, m, p_max, p_ends, coalesce(p_accounts, false));
  if p_announce then
    insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', auth.uid(), public.pseudo_of(auth.uid()), 'ann',
      format('Code cadeau : %s%s', c, case when p_ends is not null then format(' (jusqu''au %s)', to_char(p_ends, 'DD/MM')) else '' end), jsonb_build_object('t', 'admin'));
  end if;
  perform public.alog(format('code cadeau créé : %s', c));
  return null;
end $$;

create or replace function public.adm_gift_set(p_code text, p_active boolean) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  update gift_codes set active = p_active where code = upper(p_code);
  perform public.alog(format(case when p_active then 'code cadeau réactivé : %s' else 'code cadeau désactivé : %s' end, upper(p_code)));
end $$;

create or replace function public.adm_gift_users(p_code text) returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  return jsonb_build_object(
    'players', (select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) from (
      select coalesce(p.pseudo, 'compte supprimé') pseudo, gu.at from gift_uses gu left join profiles p on p.id = gu.user_id
      where gu.code = upper(p_code) and gu.guest is null order by gu.at desc limit 200) x),
    'guests', (select count(*) from gift_uses where code = upper(p_code) and guest is not null));
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_gifts()', 'adm_gift_create(text, jsonb, int, date, boolean, text, boolean)', 'adm_gift_set(text, boolean)', 'adm_gift_users(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
