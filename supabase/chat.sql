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
-- 0.1.50.2 : message épinglé en haut du chat (vide = aucun) ; pin_chs = salons (g, c, v, m) ; pin_at change à chaque
-- modification, pour le remontrer aux joueurs qui l'avaient fermé
alter table public.chat_settings add column if not exists pin_body text not null default 'Une idée pour améliorer Idlus ? Partagez-la ici ou dans la Boîte à idées, chaque proposition est lue et peut finir dans le jeu !';
alter table public.chat_settings add column if not exists pin_chs text not null default 'g';
alter table public.chat_settings add column if not exists pin_at timestamptz not null default now();
-- 2.1.36 (panel par serveur) : message épinglé du salon Monocompte ('m'), à part de celui du Classique (pin_body, salons g, c, v).
-- Colonnes ajoutées sans réécrire la table ; à la création, il reprend le message du Classique s'il était épinglé sur 'm'.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chat_settings' and column_name = 'pin_m_body') then
    alter table public.chat_settings add column pin_m_body text not null default '';
    update public.chat_settings set pin_m_body = pin_body where 'm' = any (string_to_array(pin_chs, ','));
  end if;
end $$;
alter table public.chat_settings add column if not exists pin_m_at timestamptz not null default now();
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
-- ch : 'g' = général (Général Classique), 'c' = commerce, 'v' = PvP (0.1.48.2), 'm' = Général Monocompte (testeurs et admin,
-- voir chat_mono_ok), 'p' = privé. kind : 'msg' (joueur), 'ann' (annonce automatique ou de Mathis).
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
-- Salon 'm' (Général Monocompte) : lu et écrit seulement par les comptes qui ont accès au Monocompte (mono.testeurs ou
-- public.admins, comme mono.acces de monocompte.sql). Sans espace Monocompte sur la base (pas de table mono.testeurs) :
-- refusé à tout le monde. Fonction en plpgsql : chat.sql se charge avant monocompte.sql, la table n'est lue qu'à l'appel.
create or replace function public.chat_mono_ok() returns boolean language plpgsql stable security definer set search_path = public
as $$ declare u uuid := auth.uid(); begin
  if u is null or to_regclass('mono.testeurs') is null then return false; end if;
  return exists (select 1 from mono.testeurs where user_id = u) or exists (select 1 from public.admins where user_id = u);
end $$;
revoke all on function public.chat_mono_ok() from public;
grant execute on function public.chat_mono_ok() to anon, authenticated;
-- 2.1.35.3 : profils Classique et Monocompte séparés dans le chat. Le salon 'm' montre le héros Monocompte du joueur (saison
-- en cours : 'ouverte' ou 'cloture'), jamais son profil Classique (ladder) : classe et niveau de la dernière partie validée
-- par le Bouclier (mono.parties_ok.resume), à défaut de la partie envoyée (mono.parties.meta) ; titre actif du héros de la
-- partie Monocompte (meta.title, comme ladder.title pour le Classique). Pas de héros Monocompte : classe vide, niveau 1, sans
-- titre. Comme chat_mono_ok : plpgsql, tables du schéma mono lues seulement à l'appel, rien sans monocompte.sql.
-- Renvoie { s, nom (saison), cls, lvl, title, hero (nom du héros) }.
create or replace function public.chat_mono_hero(u uuid) returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare s record; r jsonb; m jsonb; c text; l text; t text; n text;
  vide jsonb := jsonb_build_object('s', null, 'nom', null, 'cls', null, 'lvl', 1, 'title', null, 'hero', null); begin
  if u is null or to_regclass('mono.saisons') is null or to_regclass('mono.parties') is null then return vide; end if;
  select id, nom into s from mono.saisons where etat in ('ouverte', 'cloture') order by id desc limit 1;
  if not found then return vide; end if;
  if to_regclass('mono.parties_ok') is not null then select k.resume into r from mono.parties_ok k where k.user_id = u and k.saison = s.id; end if;
  select p.meta into m from mono.parties p where p.user_id = u and p.saison = s.id;
  if r is null and m is null then return vide || jsonb_build_object('s', s.id, 'nom', s.nom); end if;
  c := coalesce(nullif(r ->> 'classe', ''), nullif(m ->> 'hc', ''), nullif(m ->> 'main', ''));
  l := coalesce(r ->> 'niveau', m ->> 'hl', m ->> 'mainLvl');
  t := nullif(btrim(coalesce(m ->> 'title', '')), '');
  n := coalesce(nullif(r ->> 'nom', ''), nullif(m ->> 'hn', ''));
  return jsonb_build_object('s', s.id, 'nom', s.nom, 'cls', case when c ~ '^[a-z]{2,12}$' then c end,
    'lvl', case when l ~ '^[0-9]{1,4}$' then least(greatest(l::int, 1), 200) else 1 end, 'title', left(t, 40), 'hero', left(n, 20));
end $$;
revoke all on function public.chat_mono_hero(uuid) from public, anon, authenticated;
-- Carte Monocompte d'un joueur (clic sur son pseudo dans le salon 'm') : seulement pour un compte qui a accès au salon.
create or replace function public.chat_mono_profil(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare ps text; begin
  if not public.chat_mono_ok() then return null; end if;
  select pseudo into ps from profiles where id = p_user;
  if not found then return null; end if;
  return public.chat_mono_hero(p_user) || jsonb_build_object('u', p_user, 'pseudo', ps);
end $$;
revoke all on function public.chat_mono_profil(uuid) from public, anon;
grant execute on function public.chat_mono_profil(uuid) to authenticated;
drop policy if exists "chat lisible" on public.chat_msgs;
create policy "chat lisible" on public.chat_msgs for select using (ch in ('g', 'c', 'v') or (ch = 'm' and (select public.chat_mono_ok())) or user_id = auth.uid() or to_id = auth.uid());
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
-- 2.1.36 (panel par serveur) : serveur de l'annonce. null = Classique (toutes les annonces d'avant, les annonces en boucle, la
-- pluie de kamas), 'm' = Monocompte (adm_announce_mono). Le jeu montre le bandeau seulement aux parties du même serveur.
alter table public.announces add column if not exists srv text;

-- ---------- journal du panel admin ----------
create table if not exists public.admin_log (id bigint generated always as identity primary key, at timestamptz not null default now(), by_user uuid, txt text);
alter table public.admin_log enable row level security;
create or replace function public.alog(t text) returns void language sql security definer set search_path = public
  as $$ insert into public.admin_log (by_user, txt) values (auth.uid(), t) $$;
revoke all on function public.alog(text) from public, anon, authenticated;

-- ---------- envoyer un message ----------
-- Renvoie null si le message est parti, sinon la raison du refus (affichée sous la zone de texte).
-- 0.1.48.2 : p_ch choisit le salon public ('g' général, 'c' commerce, 'v' PvP, 'm' Général Monocompte) ; le commerce est limité à un message toutes les 30 s.
drop function if exists public.chat_send(text, uuid, jsonb);
create or replace function public.chat_send(p_body text, p_to uuid default null, p_item jsonb default null, p_ch text default 'g')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid(); pr record; sa record; lad record; st record; last record; mh jsonb;
  b text := btrim(coalesce(p_body, '')); best int; c text := case when p_to is not null then 'p' when p_ch in ('c', 'v', 'm') then p_ch else 'g' end;
begin
  if me is null then return 'Connecte-toi pour écrire.'; end if;
  if c = 'm' and not public.chat_mono_ok() then return 'Ce salon est réservé aux joueurs du Monocompte.'; end if;
  select pseudo, suspended_at into pr from profiles where id = me;
  if not found then return 'Choisis d''abord un pseudo.'; end if;
  if public.susp(me) then return 'Ton compte est suspendu.'; end if;
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
  if c = 'm' then mh := public.chat_mono_hero(me); end if; -- 2.1.35.3 : salon Monocompte : héros Monocompte, jamais le profil Classique
  if coalesce(st.min_level, 0) > 0 and c = 'm' then
    if coalesce((mh ->> 'lvl')::int, 1) < st.min_level then return format('Il faut un héros au niveau %s pour écrire.', st.min_level); end if;
  elsif coalesce(st.min_level, 0) > 0 then
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
  -- 'm' : héros Monocompte (data.mono : le jeu sait que cls, lvl et title viennent du Monocompte, pas du Classique)
  if c = 'm' then
    insert into chat_msgs (ch, user_id, to_id, pseudo, cls, lvl, title, body, item, data)
      values (c, me, null, pr.pseudo, mh ->> 'cls', coalesce((mh ->> 'lvl')::int, 1), mh ->> 'title', b, p_item, jsonb_build_object('mono', true, 's', mh -> 's'));
  else
    insert into chat_msgs (ch, user_id, to_id, pseudo, cls, lvl, title, body, item)
      values (c, me, p_to, pr.pseudo, lad.main, coalesce(lad.main_lvl, 1), lad.title, b, p_item);
  end if;
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
  select * into m from chat_msgs where id = p_msg and kind = 'msg' and (ch in ('g', 'c', 'v') or (ch = 'm' and public.chat_mono_ok()) or to_id = auth.uid());
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
-- Tickets #158, #159 : « Grougaloragran, Crâ de Bozoman, atteint le niveau 200 ! » en boucle dans les Hauts faits.
-- Les héros étaient appariés par classe + nom ; les noms par défaut sont tirés d'une liste de 16 (js/data.js), donc deux Crâ
-- « Grougaloragran » (un niveau 200, l'autre non) donnaient une paire « 200 maintenant, moins de 200 avant » à CHAQUE envoi.
-- Même boucle quand deux appareils envoient tour à tour une partie récente et une plus ancienne. Désormais :
-- - on compte par classe + nom (+ Renaissance pour le niveau 200) au lieu de comparer chaque paire ;
-- - ann_marks garde, par compte, le plus haut déjà annoncé : une annonce ne repart que si on le dépasse.
create table if not exists public.ann_marks (
  user_id uuid not null,
  k text not null,
  n int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table public.ann_marks enable row level security; -- aucune lecture directe : seulement par ladder_ann

-- Vrai si p_now dépasse à la fois l'envoi précédent (p_seen) et le plus haut déjà annoncé ; garde le plus haut des trois.
create or replace function public.ann_mark(p_user uuid, p_k text, p_seen int, p_now int) returns boolean language plpgsql security definer set search_path = public
as $$ declare m int; begin
  insert into ann_marks (user_id, k, n) values (p_user, p_k, 0) on conflict do nothing;
  select n into m from ann_marks where user_id = p_user and k = p_k for update;
  if greatest(p_seen, p_now) > m then update ann_marks set n = greatest(p_seen, p_now), at = now() where user_id = p_user and k = p_k; end if;
  return p_now > greatest(m, p_seen);
end $$;
revoke all on function public.ann_mark(uuid, text, int, int) from public, anon, authenticated;

create or replace function public.ladder_ann() returns trigger language plpgsql security definer set search_path = public
as $$ declare x record; d text; begin
  if new.flagged then return new; end if;
  -- Renaissance : plus haute Renaissance par classe + nom (héros déjà présents à l'envoi précédent)
  for x in
    with nh as (select n->>'cls' cls, coalesce(n->>'name', '') nm, coalesce((n->>'ren')::int, 0) rn from jsonb_array_elements(new.heroes) n),
         oh as (select o->>'cls' cls, coalesce(o->>'name', '') nm, coalesce((o->>'ren')::int, 0) rn from jsonb_array_elements(old.heroes) o)
    select nh.cls, nh.nm, max(nh.rn) rn, (select max(oh.rn) from oh where oh.cls = nh.cls and oh.nm = nh.nm) orn
    from nh where exists (select 1 from oh where oh.cls = nh.cls and oh.nm = nh.nm) group by nh.cls, nh.nm
  loop
    if x.rn > x.orn and public.ann_mark(new.user_id, 'ren:' || x.cls || ':' || x.nm, x.orn, x.rn) then
      perform public.chat_ann(new.user_id, jsonb_build_object('t', 'ren', 'cls', x.cls, 'name', x.nm, 'n', x.rn));
    end if;
  end loop;
  -- Niveau 200 : nombre de héros au niveau 200 par classe + nom + Renaissance (« (encore) » après une Renaissance)
  for x in
    with nh as (select n->>'cls' cls, coalesce(n->>'name', '') nm, coalesce((n->>'ren')::int, 0) rn, coalesce((n->>'lvl')::int, 1) lv from jsonb_array_elements(new.heroes) n),
         oh as (select o->>'cls' cls, coalesce(o->>'name', '') nm, coalesce((o->>'ren')::int, 0) rn, coalesce((o->>'lvl')::int, 1) lv from jsonb_array_elements(old.heroes) o)
    select nh.cls, nh.nm, nh.rn, count(*)::int c, (select count(*)::int from oh where oh.cls = nh.cls and oh.nm = nh.nm and oh.rn = nh.rn and oh.lv >= 200) oc
    from nh where nh.lv >= 200 and exists (select 1 from oh where oh.cls = nh.cls and oh.nm = nh.nm) group by nh.cls, nh.nm, nh.rn
  loop
    if x.c > x.oc and public.ann_mark(new.user_id, 'l200:' || x.cls || ':' || x.nm || ':' || x.rn, x.oc, x.c) then
      perform public.chat_ann(new.user_id, jsonb_build_object('t', 'lvl200', 'cls', x.cls, 'name', x.nm, 'ren', x.rn));
    end if;
  end loop;
  for d in select jsonb_array_elements_text(new.dofus) except select jsonb_array_elements_text(old.dofus) loop
    if public.ann_mark(new.user_id, 'dofus:' || d, 0, 1) then perform public.chat_ann(new.user_id, jsonb_build_object('t', 'dofus', 'id', d)); end if;
  end loop;
  return new;
end $$;
drop trigger if exists ladder_chat on public.ladder;
create trigger ladder_chat after update on public.ladder for each row execute function public.ladder_ann();
-- Tickets #158, #159 : les annonces répétées encore dans le chat (moins de 48 h) sont effacées, la première de chaque reste ;
-- et ce qui a déjà été annoncé est noté dans ann_marks (sinon la prochaine alternance l'annoncerait encore une fois)
delete from public.chat_msgs c using (
  select id, row_number() over (partition by user_id, data order by id) r from public.chat_msgs
  where kind = 'ann' and data->>'t' in ('lvl200', 'ren', 'dofus')
) x where c.id = x.id and x.r > 1;
insert into public.ann_marks (user_id, k, n)
  select user_id, k, max(n) from (
    select user_id, 'l200:' || (data->>'cls') || ':' || coalesce(data->>'name', '') || ':' || coalesce((data->>'ren')::int, 0) k, 1 n from public.chat_msgs where kind = 'ann' and data->>'t' = 'lvl200'
    union all select user_id, 'ren:' || (data->>'cls') || ':' || coalesce(data->>'name', ''), coalesce((data->>'n')::int, 0) from public.chat_msgs where kind = 'ann' and data->>'t' = 'ren'
    union all select user_id, 'dofus:' || (data->>'id'), 1 from public.chat_msgs where kind = 'ann' and data->>'t' = 'dofus'
  ) a where user_id is not null group by user_id, k
on conflict (user_id, k) do update set n = greatest(ann_marks.n, excluded.n);

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
  perform public.susp_lift(); -- 2.1.18 : suspensions finies levées
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p.id, p.pseudo, p.created_at, p.suspended_at, p.suspended_until, l.main cls, l.level, l.playtime, l.heroes, l.flagged, coalesce(l.suspect, false) suspect, l.flag_reason, coalesce(l.verified, false) verified,
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
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select id, body, created_at from chat_msgs where user_id = p_user and ch in ('g', 'c', 'v', 'm') and kind = 'msg' order by id desc limit 15) x);
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
  if not p_on then update saves_ok set accept = true where user_id = p_user; end if; -- 2.1.4 « Bouclier du serveur » : la partie retenue est acceptée à son prochain envoi
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

-- 2.1.18 : p_jours = durée de la suspension (null = définitive) ; « Rétablir » remet aussi le compte dans les classements
drop function if exists public.adm_suspend(uuid, boolean);
create or replace function public.adm_suspend(p_user uuid, p_on boolean, p_jours int default null) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  if exists (select 1 from admins where user_id = p_user) then raise exception 'impossible sur Mathis'; end if;
  if p_jours is not null and (p_jours < 1 or p_jours > 365) then raise exception 'durée invalide'; end if;
  update profiles set suspended_at = case when p_on then now() end, suspended_until = case when p_on and p_jours is not null then now() + make_interval(days => p_jours) end where id = p_user;
  if p_on then update ladder set flagged = true, flag_reason = 'compte suspendu' where user_id = p_user;
  else update ladder set flagged = false, flag_reason = null where user_id = p_user and flag_reason = 'compte suspendu'; end if;
  perform public.alog(format(case when not p_on then 'compte de %s rétabli' when p_jours is null then 'compte de %s suspendu' else 'compte de %s suspendu ' || p_jours || ' jour(s)' end, public.pseudo_of(p_user)));
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
  c text := array_to_string(array(select x from unnest(string_to_array(coalesce(p_chs, ''), ',')) x where x in ('g', 'c', 'v')), ','); begin -- 2.1.36 : 'm' a son propre message (adm_pin_mono)
  perform public.adm_need(true);
  update chat_settings set pin_body = b, pin_chs = case when c = '' then 'g' else c end, pin_at = now() where id = 1;
  perform public.alog(case when b = '' then 'message épinglé retiré' else format('message épinglé : « %s »', left(b, 60)) end);
end $$;

-- 2.1.36 (panel par serveur) : message épinglé du salon Monocompte
create or replace function public.adm_pin_mono(p_body text) returns void language plpgsql security definer set search_path = public
as $$ declare b text := left(btrim(coalesce(p_body, '')), 200); begin
  perform public.adm_need(true);
  update chat_settings set pin_m_body = b, pin_m_at = now() where id = 1;
  perform public.alog(case when b = '' then 'message épinglé Monocompte retiré' else format('message épinglé Monocompte : « %s »', left(b, 60)) end);
end $$;

create or replace function public.adm_announce(p_body text, p_banner boolean, p_chat boolean, p_hours int) returns void language plpgsql security definer set search_path = public
as $$ declare b text := left(btrim(p_body), 300); begin
  perform public.adm_need(true);
  if b = '' then raise exception 'annonce vide'; end if;
  if p_banner then insert into announces (body, banner, until) values (b, true, case when p_hours > 0 then now() + make_interval(hours => p_hours) end); end if;
  if p_chat then insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', auth.uid(), public.pseudo_of(auth.uid()), 'ann', b, jsonb_build_object('t', 'admin', 'banner', p_banner)); end if;
  perform public.alog(format('annonce publiée : « %s »', left(b, 60)));
end $$;
-- 2.1.36 (panel par serveur) : annonce Monocompte : bandeau montré seulement dans une partie Monocompte, message dans le salon 'm'
create or replace function public.adm_announce_mono(p_body text, p_banner boolean, p_chat boolean, p_hours int) returns void language plpgsql security definer set search_path = public
as $$ declare b text := left(btrim(coalesce(p_body, '')), 300); begin
  perform public.adm_need(true);
  if b = '' then raise exception 'annonce vide'; end if;
  if p_banner then insert into announces (body, banner, until, srv) values (b, true, case when p_hours > 0 then now() + make_interval(hours => p_hours) end, 'm'); end if;
  if p_chat then insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('m', auth.uid(), public.pseudo_of(auth.uid()), 'ann', b, jsonb_build_object('t', 'admin', 'banner', p_banner)); end if;
  perform public.alog(format('annonce Monocompte publiée : « %s »', left(b, 60)));
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
  delete from chat_msgs where user_id = p_user and kind = 'msg' and ch in ('g', 'c', 'v', 'm');
  get diagnostics n = row_count;
  perform public.alog(format('%s messages de %s effacés', n, public.pseudo_of(p_user)));
  return n;
end $$;
create or replace function public.adm_chat_clear(p_ch text) returns int language plpgsql security definer set search_path = public
as $$ declare n int; begin
  perform public.adm_need(true);
  if p_ch not in ('g', 'c', 'v', 'm') then raise exception 'salon inconnu'; end if;
  delete from chat_msgs where ch = p_ch and kind = 'msg';
  get diagnostics n = row_count;
  perform public.alog(format('salon %s vidé (%s messages)', case p_ch when 'g' then 'Général' when 'c' then 'Commerce' when 'm' then 'Monocompte' else 'PvP' end, n));
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
    'adm_rename(uuid, text)', 'adm_suspend(uuid, boolean, int)', 'adm_reports()', 'adm_report_close(uuid)', 'adm_flagged()', 'adm_settings(int, int)',
    'adm_announce(text, boolean, boolean, int)', 'adm_pin(text, text)', 'adm_announce_end(bigint)', 'adm_pin_mono(text)', 'adm_announce_mono(text, boolean, boolean, int)', 'adm_mods()', 'adm_set_mod(text, boolean)'] loop
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
  if susp is not null and public.susp(me) then return 'Compte suspendu : pas de changement de pseudo.'; end if;
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
