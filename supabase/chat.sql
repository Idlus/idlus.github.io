-- ============================================================================
-- Idlus — chat et panel admin (multijoueur). Appliqué automatiquement par le
-- workflow « Serveur en ligne » après schema.sql et classements.sql ; relançable sans danger.
-- Le jeu n'écrit jamais directement dans le chat : tout passe par chat_send, qui vérifie
-- le pseudo, les sanctions, les liens et le mode lent (plus de liste de mots interdits depuis 0.1.33.1).
-- ============================================================================

-- ---------- réglages (une seule ligne, modifiable dans le panel admin) ----------
create table if not exists public.chat_settings (
  id int primary key default 1 check (id = 1),
  min_level int not null default 0,
  slow_s int not null default 4
);
alter table public.chat_settings add column if not exists closed boolean not null default false; -- 1.2.10.1 : chat public fermé par Mathis
insert into public.chat_settings (id) values (1) on conflict do nothing;
alter table public.chat_settings enable row level security;
drop policy if exists "réglages lisibles" on public.chat_settings;
create policy "réglages lisibles" on public.chat_settings for select using (true);
-- 0.1.50.2 : message épinglé en haut du chat (vide = aucun) ; pin_chs = salons (g, c, v) ; pin_at change à chaque
-- modification, pour le remontrer aux joueurs qui l'avaient fermé
alter table public.chat_settings add column if not exists pin_body text not null default 'Une idée pour améliorer Idlus ? Partagez-la ici ou dans la Boîte à idées, chaque proposition est lue et peut finir dans le jeu !';
alter table public.chat_settings add column if not exists pin_chs text not null default 'g';
alter table public.chat_settings add column if not exists pin_at timestamptz not null default now();
grant select on public.chat_settings to anon, authenticated;

-- ---------- modérateurs (nommés par Mathis) ----------
create table if not exists public.mods (user_id uuid primary key references auth.users (id) on delete cascade, at timestamptz not null default now());
alter table public.mods enable row level security;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public
  as $$ select public.is_admin() or exists (select 1 from public.mods where user_id = auth.uid()) $$;
create or replace function public.my_role() returns text language sql stable security definer set search_path = public
  as $$ select case when public.is_admin() then 'admin' when exists (select 1 from public.mods where user_id = auth.uid()) then 'mod' end $$;
grant execute on function public.is_staff(), public.my_role() to authenticated;

-- ---------- messages ----------
-- ch : 'g' = général, 'c' = commerce, 'v' = PvP (0.1.48.2), 'p' = privé. kind : 'msg' (joueur), 'ann' (annonce automatique ou de Mathis).
create table if not exists public.chat_msgs (
  id bigint generated always as identity primary key,
  ch text not null default 'g',
  user_id uuid references auth.users (id) on delete cascade,
  to_id uuid references auth.users (id) on delete cascade,
  pseudo text, cls text, lvl int, title text,
  body text not null default '',
  item jsonb,
  kind text not null default 'msg',
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_msgs_ch_id on public.chat_msgs (ch, id desc);
create index if not exists chat_msgs_user on public.chat_msgs (user_id, id desc);
alter table public.chat_msgs enable row level security;
drop policy if exists "chat lisible" on public.chat_msgs;
create policy "chat lisible" on public.chat_msgs for select using (ch in ('g', 'c', 'v') or user_id = auth.uid() or to_id = auth.uid());
grant select on public.chat_msgs to anon, authenticated;
-- temps réel : les nouveaux messages arrivent tout seuls chez les joueurs
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_msgs') then
    alter publication supabase_realtime add table public.chat_msgs;
  end if;
end $$;

-- ---------- ignorer un joueur ----------
create table if not exists public.ignores (
  user_id uuid not null references auth.users (id) on delete cascade,
  other uuid not null references auth.users (id) on delete cascade,
  primary key (user_id, other)
);
alter table public.ignores enable row level security;
drop policy if exists "mes ignorés" on public.ignores;
create policy "mes ignorés" on public.ignores for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- sanctions (muet, banni du chat) ----------
create table if not exists public.chat_sanctions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mute_until timestamptz,
  banned boolean not null default false,
  reason text,
  at timestamptz not null default now()
);
alter table public.chat_sanctions enable row level security;
drop policy if exists "ma sanction" on public.chat_sanctions;
create policy "ma sanction" on public.chat_sanctions for select to authenticated using (user_id = auth.uid());

-- ---------- signalements ----------
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  msg_id bigint,
  reporter uuid references auth.users (id) on delete set null,
  target uuid references auth.users (id) on delete cascade,
  reason text, body text,
  open boolean not null default true,
  at timestamptz not null default now(),
  unique (msg_id, reporter)
);
alter table public.reports enable row level security;

-- ---------- annonces de Mathis (bandeau) ----------
create table if not exists public.announces (
  id bigint generated always as identity primary key,
  body text not null,
  banner boolean not null default true,
  until timestamptz,
  at timestamptz not null default now()
);
alter table public.announces enable row level security;
drop policy if exists "annonces lisibles" on public.announces;
create policy "annonces lisibles" on public.announces for select using (until is null or until > now());
grant select on public.announces to anon, authenticated;

-- ---------- journal du panel admin ----------
create table if not exists public.admin_log (id bigint generated always as identity primary key, at timestamptz not null default now(), by_user uuid, txt text);
alter table public.admin_log enable row level security;
create or replace function public.alog(t text) returns void language sql security definer set search_path = public
  as $$ insert into public.admin_log (by_user, txt) values (auth.uid(), t) $$;
revoke all on function public.alog(text) from public, anon, authenticated;

-- ---------- envoyer un message ----------
-- Renvoie null si le message est parti, sinon la raison du refus (affichée sous la zone de texte).
-- 0.1.48.2 : p_ch choisit le salon public ('g' général, 'c' commerce, 'v' PvP) ; le commerce est limité à un message toutes les 30 s.
drop function if exists public.chat_send(text, uuid, jsonb);
create or replace function public.chat_send(p_body text, p_to uuid default null, p_item jsonb default null, p_ch text default 'g')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid(); pr record; sa record; lad record; st record; last record;
  b text := btrim(coalesce(p_body, '')); best int; c text := case when p_to is not null then 'p' when p_ch in ('c', 'v') then p_ch else 'g' end;
begin
  if me is null then return 'Connecte-toi pour écrire.'; end if;
  select pseudo, suspended_at into pr from profiles where id = me;
  if not found then return 'Choisis d''abord un pseudo.'; end if;
  if pr.suspended_at is not null then return 'Ton compte est suspendu.'; end if;
  select * into sa from chat_sanctions where user_id = me;
  if found and sa.banned then return 'Tu ne peux plus écrire dans le chat.'; end if;
  if found and sa.mute_until > now() then return format('Tu es muet encore %s min.', ceil(extract(epoch from (sa.mute_until - now())) / 60)); end if;
  if b = '' and p_item is null then return 'Le message est vide.'; end if;
  if length(b) > 200 then return '200 caractères au maximum.'; end if;
  if p_item is not null and (length(p_item::text) > 1500 or jsonb_typeof(p_item->'tpl') <> 'string') then return 'Objet illisible.'; end if;
  if b ~* '(https?://|www\.|discord\.(gg|com)|[a-z0-9-]+\.(com|fr|net|org|gg|io|be|ch|xyz|ru|ly|me|tv)(/|\s|$))' then return 'Les liens ne sont pas autorisés dans le chat.'; end if;
  select * into st from chat_settings where id = 1;
  if coalesce(st.closed, false) and p_to is null and not public.is_staff() then return 'Le chat est fermé pour le moment.'; end if; -- 1.2.10.1 : chat fermé par Mathis (les messages privés restent ouverts)
  select * into lad from ladder where user_id = me;
  if coalesce(st.min_level, 0) > 0 then
    select coalesce(max(case when coalesce((x->>'ren')::int, 0) > 0 then 200 else coalesce((x->>'lvl')::int, 1) end), 1) into best
      from jsonb_array_elements(coalesce(lad.heroes, '[]'::jsonb)) x;
    if coalesce(best, 1) < st.min_level then return format('Il faut un héros au niveau %s pour écrire.', st.min_level); end if;
  end if;
  select body, created_at into last from chat_msgs where user_id = me and kind = 'msg' order by id desc limit 1;
  if found and last.created_at > now() - make_interval(secs => coalesce(st.slow_s, 4)) then return format('Doucement : un message toutes les %s secondes.', coalesce(st.slow_s, 4)); end if;
  if found and b <> '' and lower(last.body) = lower(b) and last.created_at > now() - interval '2 minutes' then return 'Tu viens déjà d''envoyer ce message.'; end if;
  if c = 'c' and exists (select 1 from chat_msgs where user_id = me and ch = 'c' and kind = 'msg' and created_at > now() - interval '30 seconds') then
    return 'Commerce : un message toutes les 30 secondes.';
  end if;
  if p_to is not null then
    if p_to = me then return 'Tu ne peux pas t''écrire à toi-même.'; end if;
    if not exists (select 1 from profiles where id = p_to) then return 'Ce joueur n''existe plus.'; end if;
    if exists (select 1 from ignores where user_id = p_to and other = me) then return 'Ce joueur ne reçoit pas tes messages.'; end if;
  end if;
  insert into chat_msgs (ch, user_id, to_id, pseudo, cls, lvl, title, body, item)
    values (c, me, p_to, pr.pseudo, lad.main, coalesce(lad.main_lvl, 1), lad.title, b, p_item);
  -- le chat ne garde que 48 heures de messages
  delete from chat_msgs where created_at < now() - interval '48 hours';
  return null;
end $$;
revoke all on function public.chat_send(text, uuid, jsonb, text) from public, anon;
grant execute on function public.chat_send(text, uuid, jsonb, text) to authenticated;

create or replace function public.chat_report(p_msg bigint, p_reason text)
returns text language plpgsql security definer set search_path = public
as $$
declare m record;
begin
  if auth.uid() is null then return 'Connecte-toi pour signaler.'; end if;
  select * into m from chat_msgs where id = p_msg and kind = 'msg' and (ch in ('g', 'c', 'v') or to_id = auth.uid());
  if not found then return 'Message introuvable.'; end if;
  if m.user_id = auth.uid() then return 'C''est ton propre message.'; end if;
  insert into reports (msg_id, reporter, target, reason, body) values (p_msg, auth.uid(), m.user_id, left(p_reason, 40), m.body) on conflict do nothing;
  return null;
end $$;
revoke all on function public.chat_report(bigint, text) from public, anon;
grant execute on function public.chat_report(bigint, text) to authenticated;

-- Ma situation dans le chat (muet, banni) pour l'afficher sous la zone de texte.
create or replace function public.chat_me() returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('mute_until', s.mute_until, 'banned', coalesce(s.banned, false), 'closed', coalesce((select closed from chat_settings where id = 1), false)) from (select 1) x left join chat_sanctions s on s.user_id = auth.uid() $$;
grant execute on function public.chat_me() to authenticated;

-- ---------- annonces automatiques dans le chat ----------
create or replace function public.chat_ann(p_user uuid, p_data jsonb) returns void language plpgsql security definer set search_path = public
as $$ declare pr record; lad record; begin
  select pseudo into pr from profiles where id = p_user;
  select main, main_lvl, flagged into lad from ladder where user_id = p_user;
  if lad.flagged then return; end if;
  insert into chat_msgs (ch, user_id, pseudo, cls, lvl, kind, data) values ('g', p_user, pr.pseudo, lad.main, lad.main_lvl, 'ann', p_data);
end $$;
revoke all on function public.chat_ann(uuid, jsonb) from public, anon, authenticated;

-- Les « Premiers »
create or replace function public.firsts_ann() returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if new.user_id is not null then perform public.chat_ann(new.user_id, jsonb_build_object('t', 'first', 'kind', new.kind, 'key', new.key, 'label', new.label)); end if;
  return new;
end $$;
drop trigger if exists firsts_chat on public.firsts;
create trigger firsts_chat after insert on public.firsts for each row execute function public.firsts_ann();

-- Niveau 200, Renaissance, Dofus : comparés à l'envoi précédent (pas au premier envoi d'une partie)
create or replace function public.ladder_ann() returns trigger language plpgsql security definer set search_path = public
as $$ declare x record; d text; begin
  if new.flagged then return new; end if;
  for x in
    select n->>'cls' cls, n->>'name' nm, coalesce((n->>'lvl')::int, 1) lv, coalesce((n->>'ren')::int, 0) rn,
           coalesce((o->>'lvl')::int, 1) olv, coalesce((o->>'ren')::int, 0) orn
    from jsonb_array_elements(new.heroes) n
    join jsonb_array_elements(old.heroes) o on o->>'cls' = n->>'cls' and o->>'name' = n->>'name'
  loop
    if x.rn > x.orn then perform public.chat_ann(new.user_id, jsonb_build_object('t', 'ren', 'cls', x.cls, 'name', x.nm, 'n', x.rn));
    elsif x.lv >= 200 and x.olv < 200 then perform public.chat_ann(new.user_id, jsonb_build_object('t', 'lvl200', 'cls', x.cls, 'name', x.nm, 'ren', x.rn));
    end if;
  end loop;
  for d in select jsonb_array_elements_text(new.dofus) except select jsonb_array_elements_text(old.dofus) loop
    perform public.chat_ann(new.user_id, jsonb_build_object('t', 'dofus', 'id', d));
  end loop;
  return new;
end $$;
drop trigger if exists ladder_chat on public.ladder;
create trigger ladder_chat after update on public.ladder for each row execute function public.ladder_ann();

-- ============================================================================
-- PANEL ADMIN : réservé à Mathis (is_admin) ; les modérateurs (mods) peuvent rendre muet
-- et traiter les signalements, rien de plus. Chaque action est notée dans le journal.
-- ============================================================================
-- 1.0.30 (Panel Xener) : tout le panel est réservé à Mathis, vérifié à chaque appel (adm_need, quel que soit p_admin,
-- gardé pour les appels des autres fichiers) ; les modérateurs gardent seulement les outils du chat (adm_need_chat :
-- vue d'ensemble, joueurs, messages, muet, signalements).
create or replace function public.adm_need(p_admin boolean) returns void language plpgsql stable security definer set search_path = public
as $$ begin
  if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
end $$;
revoke all on function public.adm_need(boolean) from public, anon, authenticated;
create or replace function public.adm_need_chat() returns void language plpgsql stable security definer set search_path = public
as $$ begin
  if not public.is_staff() then raise exception 'réservé à l''équipe'; end if;
end $$;
revoke all on function public.adm_need_chat() from public, anon, authenticated;
create or replace function public.pseudo_of(p uuid) returns text language sql stable security definer set search_path = public
  as $$ select pseudo from public.profiles where id = p $$;
revoke all on function public.pseudo_of(uuid) from public, anon, authenticated;

create or replace function public.adm_overview() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need_chat();
  return jsonb_build_object(
    'accounts', (select count(*) from profiles),
    'active', (select count(*) from saves where updated_at > now() - interval '24 hours'),
    'reports', (select count(distinct target) from reports where open),
    'flagged', (select count(*) from ladder where flagged),
    'suspect', (select count(*) from ladder where suspect and not flagged), -- 1.0.32.13 : signalés par la vérification, toujours classés
    'muted', (select count(*) from chat_sanctions where banned or mute_until > now()),
    'signups', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select p.id, p.pseudo, l.main cls, p.created_at at from profiles p left join ladder l on l.user_id = p.id order by p.created_at desc limit 6) x),
    'log', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select a.at, a.txt, public.pseudo_of(a.by_user) who from admin_log a order by a.id desc limit 12) x),
    'settings', (select to_jsonb(s) from chat_settings s where id = 1),
    'role', public.my_role());
end $$;

create or replace function public.adm_players(p_q text) returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need_chat();
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p.id, p.pseudo, p.created_at, p.suspended_at, l.main cls, l.level, l.playtime, l.heroes, l.flagged, coalesce(l.suspect, false) suspect, l.flag_reason, coalesce(l.verified, false) verified,
      s.updated_at last_save, cs.mute_until, coalesce(cs.banned, false) banned,
      (select count(distinct r.reporter) from reports r where r.target = p.id) reports,
      exists (select 1 from mods m where m.user_id = p.id) is_mod, exists (select 1 from admins a where a.user_id = p.id) is_admin
    from profiles p left join ladder l on l.user_id = p.id left join saves s on s.user_id = p.id left join chat_sanctions cs on cs.user_id = p.id
    where p_q is null or p_q = '' or p.pseudo ilike '%' || replace(replace(p_q, '%', ''), '_', '\_') || '%'
    order by p.created_at desc limit 20) x);
end $$;

-- Derniers messages publics d'un joueur (pas ses messages privés)
create or replace function public.adm_msgs(p_user uuid) returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need_chat();
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select id, body, created_at from chat_msgs where user_id = p_user and ch in ('g', 'c', 'v') and kind = 'msg' order by id desc limit 15) x);
end $$;

create or replace function public.adm_mute(p_user uuid, p_min int) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need_chat();
  if exists (select 1 from admins where user_id = p_user) then raise exception 'impossible sur Mathis'; end if;
  insert into chat_sanctions (user_id, mute_until, at) values (p_user, case when p_min > 0 then now() + make_interval(mins => p_min) end, now())
    on conflict (user_id) do update set mute_until = excluded.mute_until, at = now();
  perform public.alog(case when p_min > 0 then format('%s rendu muet %s', public.pseudo_of(p_user), case when p_min >= 1440 then (p_min / 1440) || ' j' when p_min >= 60 then (p_min / 60) || ' h' else p_min || ' min' end) else format('%s n''est plus muet', public.pseudo_of(p_user)) end);
end $$;

create or replace function public.adm_ban(p_user uuid, p_on boolean) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  insert into chat_sanctions (user_id, banned, at) values (p_user, p_on, now()) on conflict (user_id) do update set banned = p_on, at = now();
  perform public.alog(format(case when p_on then '%s banni du chat' else '%s peut de nouveau écrire dans le chat' end, public.pseudo_of(p_user)));
end $$;

create or replace function public.adm_flag(p_user uuid, p_on boolean) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  update ladder set flagged = p_on, suspect = false, flag_reason = case when p_on then 'décision de Mathis' end, verified = not p_on where user_id = p_user; -- 1.0.32.11 : remis = vérifié, il y reste ; 1.0.32.13 : « C'est bon » d'un signalé aussi
  perform public.alog(format(case when p_on then '%s mis en vérification' else '%s remis dans les classements' end, public.pseudo_of(p_user)));
end $$;

create or replace function public.adm_rename(p_user uuid, p_pseudo text) returns text language plpgsql security definer set search_path = public
as $$ declare old text := public.pseudo_of(p_user); begin
  perform public.adm_need(true);
  if p_pseudo !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,16}$' then return '3 à 16 caractères : lettres, chiffres, - ou _.'; end if;
  if exists (select 1 from profiles where lower(pseudo) = lower(p_pseudo) and id <> p_user) then return 'Ce pseudo est déjà pris.'; end if;
  update profiles set pseudo = p_pseudo where id = p_user;
  perform public.alog(format('%s renommé en %s', old, p_pseudo));
  return null;
end $$;

create or replace function public.adm_suspend(p_user uuid, p_on boolean) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  if exists (select 1 from admins where user_id = p_user) then raise exception 'impossible sur Mathis'; end if;
  update profiles set suspended_at = case when p_on then now() end where id = p_user;
  if p_on then update ladder set flagged = true, flag_reason = 'compte suspendu' where user_id = p_user; end if;
  perform public.alog(format(case when p_on then 'compte de %s suspendu' else 'compte de %s rétabli' end, public.pseudo_of(p_user)));
end $$;

create or replace function public.adm_reports() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need_chat();
  return (select coalesce(jsonb_agg(x order by x.last desc), '[]'::jsonb) from (
    select r.target id, public.pseudo_of(r.target) pseudo, count(distinct r.reporter) n, string_agg(distinct r.reason, ', ') reasons,
      jsonb_agg(distinct r.body) bodies, max(r.at) last, (select l.main from ladder l where l.user_id = r.target) cls
    from reports r where r.open group by r.target) x);
end $$;
create or replace function public.adm_report_close(p_user uuid) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need_chat();
  update reports set open = false where target = p_user and open;
  perform public.alog(format('signalements de %s traités', public.pseudo_of(p_user)));
end $$;

create or replace function public.adm_flagged() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select l.user_id id, p.pseudo, l.main cls, l.flag_reason reason, l.level, l.updated_at, l.flagged from ladder l join profiles p on p.id = l.user_id where l.flagged or l.suspect order by l.flagged, l.updated_at desc) x);
end $$;

create or replace function public.adm_settings(p_min_level int, p_slow int) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  update chat_settings set min_level = greatest(0, least(200, p_min_level)), slow_s = greatest(0, least(60, p_slow)) where id = 1;
  perform public.alog(format('chat : niveau minimum %s, %s s entre deux messages', p_min_level, p_slow));
end $$;

create or replace function public.adm_pin(p_body text, p_chs text) returns void language plpgsql security definer set search_path = public
as $$ declare b text := left(btrim(coalesce(p_body, '')), 200);
  c text := array_to_string(array(select x from unnest(string_to_array(coalesce(p_chs, ''), ',')) x where x in ('g', 'c', 'v')), ','); begin
  perform public.adm_need(true);
  update chat_settings set pin_body = b, pin_chs = case when c = '' then 'g' else c end, pin_at = now() where id = 1;
  perform public.alog(case when b = '' then 'message épinglé retiré' else format('message épinglé : « %s »', left(b, 60)) end);
end $$;

create or replace function public.adm_announce(p_body text, p_banner boolean, p_chat boolean, p_hours int) returns void language plpgsql security definer set search_path = public
as $$ declare b text := left(btrim(p_body), 300); begin
  perform public.adm_need(true);
  if b = '' then raise exception 'annonce vide'; end if;
  if p_banner then insert into announces (body, banner, until) values (b, true, case when p_hours > 0 then now() + make_interval(hours => p_hours) end); end if;
  if p_chat then insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', auth.uid(), public.pseudo_of(auth.uid()), 'ann', b, jsonb_build_object('t', 'admin', 'banner', p_banner)); end if;
  perform public.alog(format('annonce publiée : « %s »', left(b, 60)));
end $$;
create or replace function public.adm_announce_end(p_id bigint) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  update announces set until = now() where id = p_id;
  perform public.alog('annonce retirée');
end $$;

create or replace function public.adm_mods() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select m.user_id id, p.pseudo, l.main cls, m.at from mods m join profiles p on p.id = m.user_id left join ladder l on l.user_id = m.user_id order by m.at) x);
end $$;
create or replace function public.adm_set_mod(p_pseudo text, p_on boolean) returns text language plpgsql security definer set search_path = public
as $$ declare u uuid; begin
  perform public.adm_need(true);
  select id into u from profiles where lower(pseudo) = lower(btrim(p_pseudo));
  if u is null then return 'Aucun joueur avec ce pseudo.'; end if;
  if p_on then insert into mods (user_id) values (u) on conflict do nothing; else delete from mods where user_id = u; end if;
  perform public.alog(format(case when p_on then '%s nommé modérateur' else '%s n''est plus modérateur' end, public.pseudo_of(u)));
  return null;
end $$;

-- ---------- 1.2.10.1 : tous les droits de Mathis sur le chat ----------
-- Supprimer un message, effacer tous les messages publics d'un joueur, vider un salon, fermer le chat.
-- Réservé au compte admin (adm_need) ; les joueurs voient la suppression en direct (temps réel DELETE).
create or replace function public.adm_msg_del(p_id bigint) returns void language plpgsql security definer set search_path = public
as $$ declare m record; begin
  perform public.adm_need(true);
  delete from chat_msgs where id = p_id returning user_id, body into m;
  if m.user_id is not null then perform public.alog(format('message de %s supprimé : « %s »', public.pseudo_of(m.user_id), left(coalesce(m.body, ''), 60))); end if;
end $$;
create or replace function public.adm_msg_purge(p_user uuid) returns int language plpgsql security definer set search_path = public
as $$ declare n int; begin
  perform public.adm_need(true);
  delete from chat_msgs where user_id = p_user and kind = 'msg' and ch in ('g', 'c', 'v');
  get diagnostics n = row_count;
  perform public.alog(format('%s messages de %s effacés', n, public.pseudo_of(p_user)));
  return n;
end $$;
create or replace function public.adm_chat_clear(p_ch text) returns int language plpgsql security definer set search_path = public
as $$ declare n int; begin
  perform public.adm_need(true);
  if p_ch not in ('g', 'c', 'v') then raise exception 'salon inconnu'; end if;
  delete from chat_msgs where ch = p_ch and kind = 'msg';
  get diagnostics n = row_count;
  perform public.alog(format('salon %s vidé (%s messages)', case p_ch when 'g' then 'Général' when 'c' then 'Commerce' else 'PvP' end, n));
  return n;
end $$;
create or replace function public.adm_chat_close(p_on boolean) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  update chat_settings set closed = p_on where id = 1;
  perform public.alog(case when p_on then 'chat fermé' else 'chat rouvert' end);
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_overview()', 'adm_msg_del(bigint)', 'adm_msg_purge(uuid)', 'adm_chat_clear(text)', 'adm_chat_close(boolean)', 'adm_players(text)', 'adm_msgs(uuid)', 'adm_mute(uuid, int)', 'adm_ban(uuid, boolean)', 'adm_flag(uuid, boolean)',
    'adm_rename(uuid, text)', 'adm_suspend(uuid, boolean)', 'adm_reports()', 'adm_report_close(uuid)', 'adm_flagged()', 'adm_settings(int, int)',
    'adm_announce(text, boolean, boolean, int)', 'adm_pin(text, text)', 'adm_announce_end(bigint)', 'adm_mods()', 'adm_set_mod(text, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- 0.1.29.1 : badge du créateur et des modérateurs ----------
-- Liste publique de l'équipe (créateur = administrateur, modérateurs) : le jeu affiche le badge à côté
-- du pseudo. Elle vient du serveur, personne ne peut donc se donner le badge.
create or replace function public.staff_list() returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(jsonb_build_object('u', x.id, 'p', x.pseudo, 'r', x.r)), '[]'::jsonb) from (
  select p.id, p.pseudo, 'crea' r from admins a join profiles p on p.id = a.user_id
  union all select p.id, p.pseudo, 'mod' from mods m join profiles p on p.id = m.user_id where not exists (select 1 from admins a where a.user_id = m.user_id)) x $$;
revoke all on function public.staff_list() from public;
grant execute on function public.staff_list() to anon, authenticated;

-- Pseudos qui imitent le créateur ou l'équipe : refusés à la création et au changement de pseudo
-- (sauf pour le compte de Mathis lui-même). Chiffres remplacés par les lettres qu'ils imitent (Xen3r).
create or replace function public.pseudo_imite(p text) returns boolean language sql immutable
as $$ select n ~ '(xener|createur|idlus|ankama)' or n ~ '^(admin|modo|moderat|staff)'
  from (select regexp_replace(translate(lower(p), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ01345@$', 'aaaaaaceeeeiiiinooooouuuuyyoieasas'), '[^a-z]', '', 'g') n) t $$;
-- 0.1.50.1 : anciens pseudos réservés 30 jours après un changement (personne d'autre ne peut les prendre entre-temps).
alter table public.profiles add column if not exists pseudo_at timestamptz;
create table if not exists public.pseudo_holds (
  pseudo text primary key,            -- en minuscules
  user_id uuid not null references auth.users (id) on delete cascade,
  until timestamptz not null
);
alter table public.pseudo_holds enable row level security; -- aucune règle : seules les fonctions ci-dessous y touchent
create or replace function public.pseudo_held(p text, u uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from pseudo_holds h where h.pseudo = lower(p) and h.until > now() and h.user_id is distinct from u) $$;
revoke all on function public.pseudo_held(text, uuid) from public, anon, authenticated;
create or replace function public.pseudo_guard() returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if (tg_op = 'INSERT' or new.pseudo is distinct from old.pseudo) and public.pseudo_imite(new.pseudo)
     and not exists (select 1 from admins where user_id = new.id) then
    raise exception 'Ce pseudo n''est pas autorisé.';
  end if;
  -- 0.1.50.1 : un ancien pseudo reste réservé 30 jours à son propriétaire (sauf décision de Mathis depuis le panel)
  if (tg_op = 'INSERT' or lower(new.pseudo) is distinct from lower(old.pseudo)) and public.pseudo_held(new.pseudo, new.id)
     and not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Ce pseudo est réservé pour l''instant. Essaie-en un autre.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_pseudo_guard on public.profiles;
create trigger profiles_pseudo_guard before insert or update of pseudo on public.profiles for each row execute function public.pseudo_guard();

-- ---------- 0.1.50.1 : changer son pseudo soi-même, une fois tous les 30 jours ----------
-- Renvoie null si c'est fait, sinon la raison du refus. Les classements suivent (ils lisent le pseudo du profil) ;
-- les anciens messages du chat gardent l'ancien pseudo. L'ancien pseudo reste réservé 30 jours au joueur.
create or replace function public.pseudo_info() returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('at', pseudo_at, 'next', pseudo_at + interval '30 days') from profiles where id = auth.uid() $$;
revoke all on function public.pseudo_info() from public, anon;
grant execute on function public.pseudo_info() to authenticated;
create or replace function public.pseudo_change(p_pseudo text) returns text language plpgsql security definer set search_path = public
as $$ declare me uuid := auth.uid(); cur text; last timestamptz; susp timestamptz; begin
  if me is null then return 'Connecte-toi d''abord.'; end if;
  select pseudo, pseudo_at, suspended_at into cur, last, susp from profiles where id = me;
  if cur is null then return 'Choisis d''abord un pseudo.'; end if;
  if susp is not null then return 'Compte suspendu : pas de changement de pseudo.'; end if;
  p_pseudo := btrim(coalesce(p_pseudo, ''));
  if p_pseudo !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,16}$' then return '3 à 16 caractères : lettres, chiffres, - ou _ (pas d''espace).'; end if;
  if p_pseudo = cur then return null; end if;
  if last is not null and last > now() - interval '30 days' then
    return format('Tu pourras rechanger de pseudo le %s.', to_char((last + interval '30 days') at time zone 'Europe/Paris', 'DD/MM à HH24"h"MI'));
  end if;
  if public.pseudo_imite(p_pseudo) and not exists (select 1 from admins where user_id = me) then return 'Ce pseudo n''est pas autorisé.'; end if;
  if exists (select 1 from profiles where lower(pseudo) = lower(p_pseudo) and id <> me) then return 'Ce pseudo est déjà pris.'; end if;
  if public.pseudo_held(p_pseudo, me) then return 'Ce pseudo est réservé pour l''instant. Essaie-en un autre.'; end if;
  if lower(cur) <> lower(p_pseudo) then
    insert into pseudo_holds (pseudo, user_id, until) values (lower(cur), me, now() + interval '30 days')
      on conflict (pseudo) do update set user_id = excluded.user_id, until = excluded.until;
  end if;
  delete from pseudo_holds where pseudo = lower(p_pseudo) and user_id = me;
  delete from pseudo_holds where until < now();
  update profiles set pseudo = p_pseudo, pseudo_at = now() where id = me;
  perform public.alog(format('%s a changé de pseudo : %s', cur, p_pseudo));
  return null;
end $$;
revoke all on function public.pseudo_change(text) from public, anon;
grant execute on function public.pseudo_change(text) to authenticated;
