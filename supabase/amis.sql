-- ============================================================================
-- Idlus — système d'amis, pour le Classique et le Monocompte (même compte). Lot 2, point 10 ; décisions de Mathis du 21/10
-- (1A 2A 3A 4A, maquette validée) :
--   - demande à accepter, envoyée depuis un pseudo (chat, classements, guilde) ou en tapant un pseudo ;
--   - on voit si l'ami est en ligne, son mode (Classique ou Monocompte), son niveau et s'il « cherche un groupe » ;
--   - invitation dans un groupe ou un rendez-vous du Bureau (le Bureau viendra plus tard : l'appel est prêt) ;
--   - message privé : les messages privés du chat (chat_send) ; renfort : supabase/mono_social.sql (Monocompte) ;
--   - 100 amis au plus, mode invisible ;
--   - un joueur bloqué ne peut plus envoyer de demande ni écrire : « bloquer » = la liste des ignorés du chat
--     (public.ignores, supabase/chat.sql), que chat_send lit déjà pour les messages privés.
-- Liste tenue par le serveur : RLS activé, AUCUN droit direct sur les tables (ni lecture ni écriture) pour anon et
-- authenticated ; tout passe par les fonctions « security definer » amis_* ci-dessous, qui ne montrent à chacun que
-- ses propres amis, demandes et invitations.
-- S'appuie sur schema.sql (profiles, susp), classements.sql (ladder) et chat.sql (ignores). Relançable sans danger.
-- ORDRE DE CHARGEMENT DU MONOCOMPTE (unique, à la main, chaque fichier relançable sans danger) :
--   1. supabase/monocompte.sql   espace mono, Bouclier, défis ; crée mono.apres_validation, mono.etat_social et
--                                mono.defi_d12 VIDES seulement s'ils n'existent pas (le relancer n'efface rien d'après) ;
--   2. supabase/amis.sql         amis (Classique et Monocompte), blocage = public.ignores (chat.sql) ;
--   3. supabase/mono_social.sql  redéfinit mono.apres_validation (classements, Couronne, renfort) et mono.etat_social ;
--   4. supabase/mono_bureau.sql  Bureau des Aventuriers ; redéfinit mono.defi_d12 (défi 12) ; lit les amis et le blocage.
-- Aucune fonction n'est définie avec un vrai corps dans deux fichiers : chaque crochet a un seul propriétaire
-- (vérifié par tests/bureau_sql.test.js, qui charge les quatre fichiers dans cet ordre puis relance monocompte.sql).
-- DÉPLOIEMENT : pas encore dans la liste automatique de .github/workflows/supabase.yml (à ajouter à la publication,
-- après chat.sql, avec l'accord de Mathis).
-- ============================================================================

create table if not exists public.amis (
  user_id uuid not null references auth.users (id) on delete cascade,
  ami uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (user_id, ami),
  constraint amis_pas_soi check (user_id <> ami)
);
create index if not exists amis_ami on public.amis (ami);

create table if not exists public.amis_demandes (
  de uuid not null references auth.users (id) on delete cascade,
  a uuid not null references auth.users (id) on delete cascade,
  src text not null default 'pseudo' check (src in ('pseudo', 'chat', 'classement', 'guilde', 'groupe')),
  at timestamptz not null default now(),
  primary key (de, a),
  constraint demandes_pas_soi check (de <> a)
);
create index if not exists amis_demandes_a on public.amis_demandes (a);

-- présence : battement envoyé par le jeu (toutes les minutes) ; en ligne = vu il y a moins de 3 minutes
create table if not exists public.amis_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vu timestamptz,
  mode text check (mode in ('cl', 'mo')),
  lvl int check (lvl between 1 and 200),
  cls text check (cls ~ '^[a-z]{2,12}$'),
  cherche boolean not null default false,
  invisible boolean not null default false
);

-- invitations : groupe (Monocompte) ou rendez-vous du Bureau des Aventuriers ; valables 15 minutes
create table if not exists public.amis_invits (
  id bigint generated always as identity primary key,
  de uuid not null references auth.users (id) on delete cascade,
  a uuid not null references auth.users (id) on delete cascade,
  quoi text not null check (quoi in ('groupe', 'rdv')),
  data jsonb,
  etat text not null default 'envoyee' check (etat in ('envoyee', 'acceptee', 'refusee')),
  at timestamptz not null default now()
);
create index if not exists amis_invits_a on public.amis_invits (a, at desc);

-- 22/10 (Mathis, « 3B ») : listes d'amis séparées entre le Classique (srv 'c') et le Monocompte (srv 'm'). Au premier passage,
-- les amitiés et demandes d'avant (communes aux deux) sont gardées des deux côtés ; les invitations (groupe, rendez-vous) sont
-- du Monocompte. La présence et le blocage (public.ignores) restent ceux du compte.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'amis' and column_name = 'srv') then
    alter table public.amis add column srv text not null default 'c' check (srv in ('c', 'm'));
    alter table public.amis drop constraint amis_pkey;
    alter table public.amis add primary key (user_id, ami, srv);
    insert into public.amis (user_id, ami, at, srv) select user_id, ami, at, 'm' from public.amis where srv = 'c';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'amis_demandes' and column_name = 'srv') then
    alter table public.amis_demandes add column srv text not null default 'c' check (srv in ('c', 'm'));
    alter table public.amis_demandes drop constraint amis_demandes_pkey;
    alter table public.amis_demandes add primary key (de, a, srv);
    insert into public.amis_demandes (de, a, src, at, srv) select de, a, src, at, 'm' from public.amis_demandes where srv = 'c';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'amis_invits' and column_name = 'srv') then
    alter table public.amis_invits add column srv text not null default 'm' check (srv in ('c', 'm'));
  end if;
end $$;

do $$ declare t text; begin
  foreach t in array array['amis', 'amis_demandes', 'amis_presence', 'amis_invits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- ---------- fonctions internes ----------
-- anciennes signatures (avant la séparation Classique / Monocompte) : remplacées par celles qui prennent le serveur
drop function if exists public.amis_n(uuid);
drop function if exists public.amis_sont(uuid, uuid);
drop function if exists public.amis_lier(uuid, uuid);
drop function if exists public.amis_demander(uuid, text, text);
drop function if exists public.amis_repondre(uuid, boolean);
drop function if exists public.amis_annuler(uuid);
drop function if exists public.amis_retirer(uuid);
drop function if exists public.amis_liste();
drop function if exists public.amis_inviter(uuid, text, jsonb);
create or replace function public.amis_moi() returns uuid language plpgsql stable security definer set search_path = public
as $$ begin
  if auth.uid() is null then raise exception 'Connecte-toi pour gérer tes amis.'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'Choisis d''abord un pseudo.'; end if;
  return auth.uid();
end $$;
-- serveur d'une liste : 'm' (Monocompte) ou 'c' (Classique, par défaut)
create or replace function public.amis_srv(p text) returns text language sql immutable as $$ select case when p = 'm' then 'm' else 'c' end $$;
create or replace function public.amis_n(u uuid, s text) returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from public.amis where user_id = u and srv = public.amis_srv(s) $$;
create or replace function public.amis_sont(u uuid, v uuid, s text default 'c') returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.amis where user_id = u and ami = v and srv = public.amis_srv(s)) $$;
-- v a bloqué u (u ne peut plus lui envoyer de demande ni lui écrire)
create or replace function public.amis_bloque(v uuid, u uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.ignores where user_id = v and other = u) $$;
create or replace function public.amis_en_ligne(u uuid) returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select not invisible and vu > now() - interval '3 minutes' from public.amis_presence where user_id = u), false) $$;
create or replace function public.amis_cible(p_user uuid, p_pseudo text) returns uuid language sql stable security definer set search_path = public
as $$ select coalesce(p_user, (select id from public.profiles where lower(pseudo) = lower(btrim(coalesce(p_pseudo, ''))) limit 1)) $$;
-- devenir amis (les deux lignes) : 100 amis au plus de chaque côté ; enlève les demandes dans les deux sens
create or replace function public.amis_lier(u uuid, v uuid, s text) returns text language plpgsql security definer set search_path = public
as $$ begin
  s := public.amis_srv(s);
  perform pg_advisory_xact_lock(hashtextextended('amis:' || s || least(u, v)::text || greatest(u, v)::text, 0));
  if public.amis_n(u, s) >= 100 then return 'Tu as déjà 100 amis.'; end if;
  if public.amis_n(v, s) >= 100 then return 'Ce joueur a déjà 100 amis.'; end if;
  insert into public.amis (user_id, ami, srv) values (u, v, s), (v, u, s) on conflict do nothing;
  delete from public.amis_demandes where srv = s and ((de = u and a = v) or (de = v and a = u));
  return null;
end $$;

-- ---------- fonctions du jeu ----------
-- p_srv : 'm' depuis une partie Monocompte (js/amis.js), 'c' sinon : chaque serveur a sa liste d'amis et ses demandes.
-- Envoyer une demande (par l'identifiant d'un joueur montré dans le chat, les classements ou la guilde, ou par pseudo).
-- Si l'autre joueur nous avait déjà demandé, vous devenez amis tout de suite.
create or replace function public.amis_demander(p_user uuid default null, p_pseudo text default null, p_src text default 'pseudo', p_srv text default 'c')
returns jsonb language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); v uuid := public.amis_cible(p_user, p_pseudo); e text; s text := public.amis_srv(p_srv); begin
  if public.susp(me) then return jsonb_build_object('err', 'Ton compte est suspendu.'); end if;
  if v is null or not exists (select 1 from public.profiles where id = v) then return jsonb_build_object('err', 'Pseudo inconnu.'); end if;
  if v = me then return jsonb_build_object('err', 'Tu ne peux pas t''ajouter toi-même.'); end if;
  if public.amis_bloque(me, v) then return jsonb_build_object('err', 'Tu as bloqué ce joueur : débloque-le d''abord.'); end if;
  if public.amis_bloque(v, me) then return jsonb_build_object('err', 'Ce joueur ne reçoit pas de demandes.'); end if;
  if public.amis_sont(me, v, s) then return jsonb_build_object('err', 'Vous êtes déjà amis.'); end if;
  if exists (select 1 from public.amis_demandes where de = v and a = me and srv = s) then
    e := public.amis_lier(me, v, s); if e is not null then return jsonb_build_object('err', e); end if;
    return jsonb_build_object('ok', true, 'etat', 'amis');
  end if;
  if exists (select 1 from public.amis_demandes where de = me and a = v and srv = s) then return jsonb_build_object('err', 'Demande déjà envoyée.'); end if;
  if public.amis_n(me, s) >= 100 then return jsonb_build_object('err', 'Tu as déjà 100 amis.'); end if;
  if public.amis_n(v, s) >= 100 then return jsonb_build_object('err', 'Ce joueur a déjà 100 amis.'); end if;
  if (select count(*) from public.amis_demandes where de = me and srv = s) >= 50 then return jsonb_build_object('err', 'Tu as déjà 50 demandes en attente : attends leurs réponses.'); end if;
  if (select count(*) from public.amis_demandes where a = v and srv = s) >= 100 then return jsonb_build_object('err', 'Ce joueur a trop de demandes en attente.'); end if;
  insert into public.amis_demandes (de, a, src, srv) values (me, v, case when p_src in ('pseudo', 'chat', 'classement', 'guilde', 'groupe') then p_src else 'pseudo' end, s);
  return jsonb_build_object('ok', true, 'etat', 'envoyee');
end $$;

-- Accepter ou refuser une demande reçue
create or replace function public.amis_repondre(p_de uuid, p_ok boolean, p_srv text default 'c') returns jsonb language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); e text; s text := public.amis_srv(p_srv); begin
  if not exists (select 1 from public.amis_demandes where de = p_de and a = me and srv = s) then return jsonb_build_object('err', 'Cette demande n''existe plus.'); end if;
  if not coalesce(p_ok, false) then delete from public.amis_demandes where de = p_de and a = me and srv = s; return jsonb_build_object('ok', true, 'etat', 'refusee'); end if;
  e := public.amis_lier(me, p_de, s); if e is not null then return jsonb_build_object('err', e); end if;
  return jsonb_build_object('ok', true, 'etat', 'amis');
end $$;

create or replace function public.amis_annuler(p_a uuid, p_srv text default 'c') returns jsonb language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); begin
  delete from public.amis_demandes where de = me and a = p_a and srv = public.amis_srv(p_srv); return jsonb_build_object('ok', found);
end $$;

create or replace function public.amis_retirer(p_ami uuid, p_srv text default 'c') returns jsonb language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); s text := public.amis_srv(p_srv); ok boolean; begin
  delete from public.amis where srv = s and ((user_id = me and ami = p_ami) or (user_id = p_ami and ami = me)); ok := found;
  delete from public.amis_invits where srv = s and ((de = me and a = p_ami) or (de = p_ami and a = me));
  return jsonb_build_object('ok', ok);
end $$;

-- Bloquer (ou débloquer) : le joueur bloqué ne peut plus envoyer de demande ni écrire en privé ; l'amitié, les demandes et
-- les invitations entre vous sont effacées, sur les deux serveurs. C'est la même liste que « Ignorer » dans le chat.
create or replace function public.amis_bloquer(p_user uuid default null, p_pseudo text default null, p_on boolean default true)
returns jsonb language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); v uuid := public.amis_cible(p_user, p_pseudo); begin
  if v is null or not exists (select 1 from public.profiles where id = v) then return jsonb_build_object('err', 'Pseudo inconnu.'); end if;
  if v = me then return jsonb_build_object('err', 'Tu ne peux pas te bloquer toi-même.'); end if;
  if coalesce(p_on, true) then
    insert into public.ignores (user_id, other) values (me, v) on conflict do nothing;
    delete from public.amis where (user_id = me and ami = v) or (user_id = v and ami = me);
    delete from public.amis_demandes where (de = me and a = v) or (de = v and a = me);
    delete from public.amis_invits where (de = me and a = v) or (de = v and a = me);
  else
    delete from public.ignores where user_id = me and other = v;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Présence (toutes les minutes, depuis le jeu) : mode de la partie ouverte, niveau du héros principal, classe
create or replace function public.amis_presence(p_mode text, p_lvl int, p_cls text, p_cherche boolean default null) returns void
language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); begin
  insert into public.amis_presence (user_id, vu, mode, lvl, cls, cherche)
    values (me, now(), case when p_mode in ('cl', 'mo') then p_mode end, greatest(1, least(200, coalesce(p_lvl, 1))), case when p_cls ~ '^[a-z]{2,12}$' then p_cls end, coalesce(p_cherche, false))
    on conflict (user_id) do update set vu = now(), mode = excluded.mode, lvl = excluded.lvl, cls = coalesce(excluded.cls, amis_presence.cls),
      cherche = case when p_cherche is null then amis_presence.cherche else p_cherche end;
end $$;
-- Réglages : invisible (tes amis te voient hors ligne et ne peuvent pas t'inviter), « je cherche un groupe »
create or replace function public.amis_reglages(p_invisible boolean default null, p_cherche boolean default null) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); begin
  insert into public.amis_presence (user_id, invisible, cherche) values (me, coalesce(p_invisible, false), coalesce(p_cherche, false))
    on conflict (user_id) do update set invisible = coalesce(p_invisible, amis_presence.invisible), cherche = coalesce(p_cherche, amis_presence.cherche);
  return (select jsonb_build_object('invisible', invisible, 'cherche', cherche) from public.amis_presence where user_id = me);
end $$;

-- Ma liste : amis (en ligne, mode, niveau, cherche un groupe), demandes reçues et envoyées, bloqués, invitations reçues.
-- Un ami invisible apparaît hors ligne, sans mode ni « cherche un groupe ».
create or replace function public.amis_liste(p_srv text default 'c') returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); s text := public.amis_srv(p_srv); begin
  return jsonb_build_object(
    'max', 100,
    'moi', coalesce((select jsonb_build_object('invisible', invisible, 'cherche', cherche) from public.amis_presence where user_id = me), jsonb_build_object('invisible', false, 'cherche', false)),
    'amis', (select coalesce(jsonb_agg(x order by x->>'on' desc, lower(x->>'p')), '[]'::jsonb) from (
      select jsonb_build_object('u', a.ami, 'p', p.pseudo, 'at', a.at,
        'on', public.amis_en_ligne(a.ami),
        'vu', case when coalesce(pr.invisible, false) then null else pr.vu end,
        'mode', case when public.amis_en_ligne(a.ami) then pr.mode end,
        'cherche', public.amis_en_ligne(a.ami) and coalesce(pr.cherche, false),
        'lvl', coalesce(pr.lvl, l.main_lvl), 'cls', coalesce(pr.cls, l.main)) x
      from public.amis a join public.profiles p on p.id = a.ami left join public.amis_presence pr on pr.user_id = a.ami left join public.ladder l on l.user_id = a.ami
      where a.user_id = me and a.srv = s) q),
    'recues', (select coalesce(jsonb_agg(jsonb_build_object('u', d.de, 'p', p.pseudo, 'src', d.src, 'at', d.at, 'lvl', coalesce(pr.lvl, l.main_lvl), 'cls', coalesce(pr.cls, l.main)) order by d.at desc), '[]'::jsonb)
      from public.amis_demandes d join public.profiles p on p.id = d.de left join public.amis_presence pr on pr.user_id = d.de left join public.ladder l on l.user_id = d.de where d.a = me and d.srv = s),
    'envoyees', (select coalesce(jsonb_agg(jsonb_build_object('u', d.a, 'p', p.pseudo, 'at', d.at) order by d.at desc), '[]'::jsonb)
      from public.amis_demandes d join public.profiles p on p.id = d.a where d.de = me and d.srv = s),
    'bloques', (select coalesce(jsonb_agg(jsonb_build_object('u', i.other, 'p', p.pseudo) order by lower(p.pseudo)), '[]'::jsonb)
      from public.ignores i join public.profiles p on p.id = i.other where i.user_id = me),
    'invits', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'u', v.de, 'p', p.pseudo, 'quoi', v.quoi, 'data', v.data, 'at', v.at) order by v.at desc), '[]'::jsonb)
      from public.amis_invits v join public.profiles p on p.id = v.de where v.a = me and v.srv = s and v.etat = 'envoyee' and v.at > now() - interval '15 minutes'));
end $$;

-- Inviter un ami dans son groupe (Monocompte) ou à un rendez-vous du Bureau : ami en ligne et visible seulement
create or replace function public.amis_inviter(p_ami uuid, p_quoi text, p_data jsonb default null, p_srv text default 'c') returns jsonb
language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); n bigint; s text := public.amis_srv(p_srv); begin
  if p_quoi not in ('groupe', 'rdv') then return jsonb_build_object('err', 'Invitation inconnue.'); end if;
  if not public.amis_sont(me, p_ami, s) then return jsonb_build_object('err', 'Ce joueur n''est pas dans tes amis.'); end if;
  if not public.amis_en_ligne(p_ami) then return jsonb_build_object('err', 'Ce joueur n''est pas en ligne.'); end if;
  if p_quoi = 'groupe' and coalesce((select mode from public.amis_presence where user_id = p_ami), '') <> 'mo' then return jsonb_build_object('err', 'Les groupes se jouent au Monocompte : ton ami n''y est pas en ce moment.'); end if;
  if p_data is not null and length(p_data::text) > 1000 then return jsonb_build_object('err', 'Invitation trop longue.'); end if;
  if exists (select 1 from public.amis_invits where de = me and at > now() - interval '5 seconds') then return jsonb_build_object('err', 'Doucement : une invitation toutes les 5 secondes.'); end if;
  delete from public.amis_invits where de = me and a = p_ami and quoi = p_quoi and etat = 'envoyee';
  insert into public.amis_invits (de, a, quoi, data, srv) values (me, p_ami, p_quoi, p_data, s) returning id into n;
  delete from public.amis_invits where at < now() - interval '1 day';
  return jsonb_build_object('ok', true, 'id', n);
end $$;
create or replace function public.amis_invit_repondre(p_id bigint, p_ok boolean) returns jsonb language plpgsql security definer set search_path = public
as $$ declare me uuid := public.amis_moi(); v public.amis_invits%rowtype; begin
  select * into v from public.amis_invits where id = p_id and a = me and etat = 'envoyee' and at > now() - interval '15 minutes';
  if not found then return jsonb_build_object('err', 'Cette invitation n''est plus valable.'); end if;
  update public.amis_invits set etat = case when coalesce(p_ok, false) then 'acceptee' else 'refusee' end where id = p_id;
  return jsonb_build_object('ok', true, 'de', v.de, 'quoi', v.quoi, 'data', v.data);
end $$;

-- ---------- droits d'appel ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'amis\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('amis_demander', 'amis_repondre', 'amis_annuler', 'amis_retirer', 'amis_bloquer', 'amis_presence', 'amis_reglages', 'amis_liste', 'amis_inviter', 'amis_invit_repondre') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
