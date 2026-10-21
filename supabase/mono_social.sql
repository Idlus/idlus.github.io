-- ============================================================================
-- Idlus — Monocompte : classements de saison, Couronne du Temps, Serment de fer, renfort d'un ami et défi de la mutation
-- de la semaine (lot 2, points 9, 10 et 11 ; « Saison plus » ; décisions de Mathis du 21/10, maquette validée).
-- DÉPLOIEMENT MANUEL SEULEMENT, comme supabase/monocompte.sql : jamais dans la liste automatique de
-- .github/workflows/supabase.yml. Ordre : monocompte.sql (avec mono.parties_ok et mono.apres_validation du Bouclier
-- Monocompte), puis amis.sql, puis CE fichier. Relancer monocompte.sql remet mono.apres_validation à vide : relancer
-- ce fichier juste après. Relançable sans danger.
--
-- Contrat avec le Bouclier Monocompte (autre chantier) : après chaque partie validée, il appelle
--   mono.apres_validation(user_id, saison, resume)
-- avec le résumé calculé par le serveur (mono.parties_ok.resume). Ce fichier redéfinit cette fonction pour tenir les
-- classements, à partir du résumé seulement (jamais de ce que le navigateur dit). Clés lues (les variantes entre
-- parenthèses sont acceptées) :
--   niveau (lvl), classe (cls), nom ;
--   phenix : { etape: étapes faites de la quête (5 = Dofus obtenu), renaissances } (ou un nombre déjà calculé) ;
--   grp : meilleurs temps de donjon de groupe par stasis, { "9": { ms (t), at }, ... } ou [ { k, ms (t), at }, ... ] ;
--         at = date de saison du donjon (semaine en heure de Paris, changement d'heure compris) ;
--   serment : "fer" sous Serment de fer tenu ; aide : { sab, merc, ren } (sauvegarde : S.mono.aide, js/monoplus.js) ;
--   camp, rang, defis.
-- Classements (lus seulement sur la partie validée) : niveau du héros, avancée du Dofus du Phénix, meilleur temps en
-- donjon de groupe (stasis la plus haute, puis le temps), Serment de fer (à part : une partie qui montre une aide en
-- sort pour toute la saison, comme une partie qui renonce au serment).
-- Couronne du Temps : une seule pour le serveur Monocompte. Elle va au meilleur temps en donjon de groupe à la stasis la
-- plus haute d'une semaine de saison, et se porte pendant toute la semaine suivante : elle change de tête le lundi à
-- 00 h 00, heure de Paris, à la date de saison du serveur (horloge de test comprise). Cosmétique.
-- Aura de fer : droit partagé du compte (mono.cosm_droits, clé fer_aura) quand la partie passe dans l'Éternel sous un
-- serment tenu.
-- ============================================================================

-- ---------- classements de saison : une ligne par compte et par saison, tenue par mono.apres_validation ----------
create table if not exists mono.lb_saison (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  nom text, cls text, niveau int, phenix numeric,
  grp_k int, grp_ms int, grp_at timestamptz,
  serment text, fer boolean not null default false, fer_perdu boolean not null default false,
  camp text, rang int, defis int,
  resume jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  primary key (user_id, saison)
);
-- meilleur donjon de groupe de chaque semaine de saison (Couronne du Temps)
create table if not exists mono.grp_semaine (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  semaine int not null check (semaine between 1 and 8),
  k int not null, ms int not null check (ms > 0), at timestamptz not null,
  primary key (user_id, saison, semaine)
);
-- renfort : la photo du héros d'un joueur (publiée depuis sa partie, vérifiée sur sa partie validée), et le compteur
-- cosmétique de ses aides (aucun gain)
create table if not exists mono.renforts (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  snap jsonb not null, niveau int not null, cls text not null,
  aides int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, saison)
);
create table if not exists mono.renfort_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ami uuid not null references auth.users (id) on delete cascade,
  saison int not null,
  at timestamptz not null default now()
);
create index if not exists renfort_log_u on mono.renfort_log (user_id, ami, at desc);

-- défi de groupe de la mutation de la semaine : payé par le registre (mono_eclats_activite, activité « mut »), dans le quota,
-- une source par semaine (le jeu envoie « s<saison>-w<semaine>-mut ») ; 20 Éclats au plus par jour pour cette activité
insert into mono.act_regles (kind, max_jour) values ('mut', 20) on conflict (kind) do update set max_jour = excluded.max_jour;

do $$ declare t text; begin
  foreach t in array array['lb_saison', 'grp_semaine', 'renforts', 'renfort_log'] loop
    execute format('alter table mono.%I enable row level security', t);
    execute format('revoke all on mono.%I from public, anon, authenticated', t);
    execute format('grant select on mono.%I to authenticated', t);
    execute format('drop policy if exists "lire ses lignes" on mono.%I', t);
    execute format('create policy "lire ses lignes" on mono.%I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ============================================================================
-- Fonctions internes (schéma mono)
-- ============================================================================
create or replace function mono.num(j jsonb) returns numeric language sql immutable
as $$ select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric when jsonb_typeof(j) = 'string' and (j #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (j #>> '{}')::numeric end $$;
create or replace function mono.ts(j jsonb) returns timestamptz language plpgsql stable
as $$ begin
  if jsonb_typeof(j) = 'number' then return to_timestamp((j #>> '{}')::numeric / 1000); end if; -- millisecondes du jeu
  if jsonb_typeof(j) = 'string' then return (j #>> '{}')::timestamptz; end if;
  return null;
exception when others then return null;
end $$;
-- avancée du Phénix : étapes × 1000 + renaissances (un nombre déjà calculé est gardé)
create or replace function mono.phenix_score(r jsonb) returns numeric language sql immutable
as $$ select case when jsonb_typeof(r -> 'phenix') in ('number', 'string') then mono.num(r -> 'phenix')
  when jsonb_typeof(r -> 'phenix') = 'object' then coalesce(mono.num(r -> 'phenix' -> 'score'),
    coalesce(mono.num(r -> 'phenix' -> 'etape'), mono.num(r -> 'phenix' -> 'etapes'), mono.num(r -> 'phenix' -> 'step'), 0) * 1000
    + coalesce(mono.num(r -> 'phenix' -> 'renaissances'), mono.num(r -> 'phenix' -> 'phx'), 0)) end $$;
-- les temps de donjon de groupe du résumé : une ligne par stasis (k, ms, at)
create or replace function mono.grp_rows(r jsonb) returns table (k int, ms int, at timestamptz) language sql stable
as $$
  select x.k::int, x.ms::int, x.at from (
    select mono.num(to_jsonb(e.key)) k, coalesce(mono.num(e.value -> 'ms'), mono.num(e.value -> 't')) ms, mono.ts(e.value -> 'at') at
      from jsonb_each(case when jsonb_typeof(coalesce(r -> 'grp', r -> 'donjons_groupe')) = 'object' then coalesce(r -> 'grp', r -> 'donjons_groupe') else '{}'::jsonb end) e
    union all
    select mono.num(e -> 'k'), coalesce(mono.num(e -> 'ms'), mono.num(e -> 't')), mono.ts(e -> 'at')
      from jsonb_array_elements(case when jsonb_typeof(coalesce(r -> 'grp', r -> 'donjons_groupe')) = 'array' then coalesce(r -> 'grp', r -> 'donjons_groupe') else '[]'::jsonb end) e
  ) x where x.k between 1 and 20 and x.ms > 0 and x.ms < 86400000
$$;
-- aides reçues d'après le résumé (Sablier, mercenaire, renfort)
create or replace function mono.aide_de(r jsonb) returns numeric language sql immutable
as $$ select coalesce(mono.num(r -> 'aide' -> 'sab'), mono.num(r -> 'sablier'), 0) + coalesce(mono.num(r -> 'aide' -> 'merc'), mono.num(r -> 'mercenaire'), 0) + coalesce(mono.num(r -> 'aide' -> 'ren'), mono.num(r -> 'renfort'), 0) $$;

-- Redéfinie ici (contrat avec le Bouclier Monocompte) : appelée après chaque partie validée.
drop function if exists mono.apres_validation(uuid, int, jsonb);
create function mono.apres_validation(p_user uuid, p_saison int, p_resume jsonb) returns void language plpgsql security definer set search_path = mono, public
as $$ declare r jsonb := coalesce(p_resume, '{}'::jsonb); b record; old mono.lb_saison%rowtype; fer_now boolean; perdu boolean; g record; w int; begin
  if p_user is null or p_saison is null then return; end if;
  select x.k, x.ms, x.at into b from mono.grp_rows(r) x order by x.k desc, x.ms asc, x.at asc nulls last limit 1;
  select * into old from mono.lb_saison where user_id = p_user and saison = p_saison;
  fer_now := coalesce(r ->> 'serment', '') = 'fer' and mono.aide_de(r) = 0;
  -- sortie du classement de fer pour toute la saison : aide vue sous serment, ou abandon après l'avoir tenu
  perdu := coalesce(old.fer_perdu, false) or (coalesce(r ->> 'serment', '') = 'fer' and mono.aide_de(r) > 0) or (coalesce(old.fer, false) and not fer_now);
  insert into mono.lb_saison (user_id, saison, nom, cls, niveau, phenix, grp_k, grp_ms, grp_at, serment, fer, fer_perdu, camp, rang, defis, resume, at)
    values (p_user, p_saison, left(r ->> 'nom', 40), left(coalesce(r ->> 'classe', r ->> 'cls'), 12), greatest(1, least(200, coalesce(mono.num(r -> 'niveau'), mono.num(r -> 'lvl'), 1)))::int,
      mono.phenix_score(r), b.k, b.ms, b.at, left(r ->> 'serment', 10), fer_now and not perdu, perdu, left(r ->> 'camp', 20), mono.num(r -> 'rang')::int,
      coalesce(mono.num(r -> 'defis'), case when jsonb_typeof(r -> 'defis') = 'array' then jsonb_array_length(r -> 'defis') end)::int, r, now())
    on conflict (user_id, saison) do update set nom = excluded.nom, cls = excluded.cls, niveau = excluded.niveau, phenix = excluded.phenix,
      grp_k = excluded.grp_k, grp_ms = excluded.grp_ms, grp_at = excluded.grp_at, serment = excluded.serment, fer = excluded.fer, fer_perdu = excluded.fer_perdu,
      camp = excluded.camp, rang = excluded.rang, defis = excluded.defis, resume = excluded.resume, at = excluded.at;
  -- meilleur de chaque semaine (date de saison du donjon, semaine comptée en heure de Paris)
  for g in select x.k, x.ms, x.at from mono.grp_rows(r) x where x.at is not null loop
    w := mono.semaine_de(mono.jour_de(p_saison, g.at));
    if w between 1 and 8 then
      insert into mono.grp_semaine (user_id, saison, semaine, k, ms, at) values (p_user, p_saison, w, g.k, g.ms, g.at)
        on conflict (user_id, saison, semaine) do update set k = excluded.k, ms = excluded.ms, at = excluded.at
        where excluded.k > grp_semaine.k or (excluded.k = grp_semaine.k and excluded.ms < grp_semaine.ms);
    end if;
  end loop;
end $$;

-- semaine de saison en cours (1 à 8 ; 9 après le jour 56)
create or replace function mono.semaine_now(p_s int) returns int language sql stable set search_path = mono, public
as $$ select mono.semaine_de(least(63, greatest(1, mono.jour_de(p_s, mono.date_saison(p_s))))) $$;
-- meilleur d'une semaine : stasis la plus haute, puis le temps, puis le premier arrivé
create or replace function mono.tete(p_s int, p_w int) returns uuid language sql stable set search_path = mono, public
as $$ select user_id from mono.grp_semaine where saison = p_s and semaine = p_w order by k desc, ms asc, at asc, user_id limit 1 $$;
-- porteur de la Couronne du Temps : le meilleur de la semaine d'avant
create or replace function mono.porteur(p_s int) returns uuid language sql stable set search_path = mono, public
as $$ select mono.tete(p_s, mono.semaine_now(p_s) - 1) $$;
-- semaines où ce compte a porté la couronne (jusqu'à maintenant)
create or replace function mono.couronnes(u uuid, p_s int) returns int language sql stable set search_path = mono, public
as $$ select count(*)::int from generate_series(1, least(8, mono.semaine_now(p_s) - 1)) w where mono.tete(p_s, w) = u $$;
-- saison à montrer : l'ouverte, sinon la dernière en clôture ou finie
create or replace function mono.saison_vue() returns int language sql stable set search_path = mono, public
as $$ select coalesce(mono.saison_ouverte(), (select max(id) from mono.saisons where etat in ('cloture', 'finie'))) $$;
create or replace function mono.pseudo(u uuid) returns text language sql stable security definer set search_path = mono, public
as $$ select pseudo from public.profiles where id = u $$;
-- prochain lundi 00 h 00 à Paris (date de saison), quand la couronne change de tête
create or replace function mono.change_at(p_s int) returns timestamptz language sql stable set search_path = mono, public
as $$ select (((x.debut at time zone 'Europe/Paris')::date + 7 * mono.semaine_now(p_s))::timestamp at time zone 'Europe/Paris') from mono.saisons x where x.id = p_s $$;

-- ============================================================================
-- Fonctions du jeu
-- ============================================================================
-- Un classement de saison : p_type = 'niveau' | 'phenix' | 'grp' | 'fer'. Lignes : rang, joueur, héros, score ; « moi » : ma ligne.
create or replace function public.mono_classement(p_type text, p_saison int default null, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := coalesce(p_saison, mono.saison_vue()); c uuid; rows jsonb; me jsonb; begin
  if p_type not in ('niveau', 'phenix', 'grp', 'fer') then raise exception 'classement inconnu'; end if;
  if s is null then return jsonb_build_object('saison', null, 'rows', '[]'::jsonb); end if;
  c := mono.porteur(s);
  with t as (
    select l.*, row_number() over (order by
        case p_type when 'niveau' then l.niveau::numeric when 'phenix' then l.phenix when 'grp' then l.grp_k::numeric when 'fer' then l.niveau::numeric end desc nulls last,
        case p_type when 'grp' then l.grp_ms::numeric when 'phenix' then -l.niveau when 'fer' then -coalesce(l.phenix, 0) else 0 end asc nulls last,
        l.at asc, l.user_id) rk
      from mono.lb_saison l
      where l.saison = s and (p_type <> 'grp' or l.grp_k is not null) and (p_type <> 'phenix' or l.phenix is not null) and (p_type <> 'fer' or (l.fer and not l.fer_perdu))
        and not exists (select 1 from public.ladder d where d.user_id = l.user_id and d.flagged)
  ), j as (
    select rk, jsonb_build_object('rang', rk, 'u', user_id, 'p', mono.pseudo(user_id), 'nom', nom, 'cls', cls, 'niveau', niveau, 'phenix', phenix,
      'k', grp_k, 'ms', grp_ms, 'at', grp_at, 'fer', fer and not fer_perdu, 'couronne', user_id = c) o, user_id from t
  )
  select (select coalesce(jsonb_agg(o order by rk), '[]'::jsonb) from j where rk <= greatest(1, least(100, coalesce(p_limit, 50)))),
         (select o from j where user_id = u) into rows, me;
  return jsonb_build_object('saison', s, 'type', p_type, 'rows', rows, 'moi', me);
end $$;

-- La Couronne du Temps : porteur (meilleur de la semaine d'avant), en tête cette semaine, prochain changement
create or replace function public.mono_couronne() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_vue(); w int; pt uuid; tt uuid; begin
  if s is null then return jsonb_build_object('saison', null); end if;
  w := mono.semaine_now(s); pt := mono.porteur(s); tt := mono.tete(s, least(8, w));
  return jsonb_build_object('saison', s, 'semaine', w, 'date', mono.date_saison(s), 'change_at', case when w <= 8 then mono.change_at(s) end,
    'porteur', (select jsonb_build_object('u', g.user_id, 'p', mono.pseudo(g.user_id), 'k', g.k, 'ms', g.ms, 'semaine', g.semaine, 'nom', l.nom, 'cls', l.cls, 'niveau', l.niveau)
      from mono.grp_semaine g left join mono.lb_saison l on l.user_id = g.user_id and l.saison = s where g.saison = s and g.semaine = w - 1 and g.user_id = pt),
    'en_tete', case when w <= 8 then (select jsonb_build_object('u', g.user_id, 'p', mono.pseudo(g.user_id), 'k', g.k, 'ms', g.ms, 'nom', l.nom, 'cls', l.cls, 'niveau', l.niveau)
      from mono.grp_semaine g left join mono.lb_saison l on l.user_id = g.user_id and l.saison = s where g.saison = s and g.semaine = w and g.user_id = tt) end,
    'moi', mono.couronnes(u, s));
end $$;

-- Pour la petite couronne à côté du pseudo, partout (chat, amis, classements, Classique compris) : seulement le porteur
create or replace function public.couronne_temps() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare s int := mono.saison_vue(); pt uuid; begin
  if s is null then return null; end if;
  pt := mono.porteur(s); if pt is null then return null; end if;
  return jsonb_build_object('u', pt, 'p', mono.pseudo(pt), 'semaine', mono.semaine_now(s));
end $$;

-- Bilan de fin de saison : rang au classement de donjon de groupe, semaines couronné, serment tenu
create or replace function public.mono_bilan(p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := coalesce(p_saison, mono.saison_vue()); l mono.lb_saison%rowtype; rk int; begin
  if s is null then return jsonb_build_object('saison', null); end if;
  select * into l from mono.lb_saison where user_id = u and saison = s;
  if found and l.grp_k is not null then
    select count(*) + 1 into rk from mono.lb_saison x where x.saison = s and x.grp_k is not null and (x.grp_k > l.grp_k or (x.grp_k = l.grp_k and (x.grp_ms < l.grp_ms or (x.grp_ms = l.grp_ms and x.at < l.at))));
  end if;
  return jsonb_build_object('saison', s, 'rang_grp', rk, 'couronnes', mono.couronnes(u, s), 'fer', coalesce(l.fer and not l.fer_perdu, false), 'niveau', l.niveau);
end $$;

-- ---------- renfort d'un ami ----------
-- Publier la photo de son héros (js/monoplus.js, E.monoSnap) : acceptée seulement si elle correspond à la partie validée
-- (même classe, niveau au plus celui du résumé).
create or replace function public.mono_renfort_publier(p_snap jsonb) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); l mono.lb_saison%rowtype; n int; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.'); end if;
  if p_snap is null or jsonb_typeof(p_snap) <> 'object' or length(p_snap::text) > 40000 then return jsonb_build_object('err', 'Photo illisible.'); end if;
  select * into l from mono.lb_saison where user_id = u and saison = s;
  if not found then return jsonb_build_object('err', 'Ta partie n''est pas encore validée par le serveur.'); end if;
  n := mono.num(p_snap -> 'lvl')::int;
  if (p_snap ->> 'cls') is distinct from l.cls or n is null or n < 1 or n > l.niveau then return jsonb_build_object('err', 'La photo ne correspond pas à ta partie validée.'); end if;
  insert into mono.renforts (user_id, saison, snap, niveau, cls) values (u, s, p_snap, n, l.cls)
    on conflict (user_id, saison) do update set snap = excluded.snap, niveau = excluded.niveau, cls = excluded.cls, at = now();
  return jsonb_build_object('ok', true);
end $$;
-- Les renforts disponibles : ceux de mes amis (supabase/amis.sql) pour la saison ouverte ; et mes propres aides (compteur)
create or replace function public.mono_renforts() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); begin
  if s is null then return jsonb_build_object('amis', '[]'::jsonb, 'aides', 0); end if;
  return jsonb_build_object(
    'amis', (select coalesce(jsonb_agg(jsonb_build_object('u', r.user_id, 'p', mono.pseudo(r.user_id), 'cls', r.cls, 'lvl', r.niveau, 'snap', r.snap, 'at', r.at) order by r.niveau desc), '[]'::jsonb)
      from mono.renforts r join public.amis a on a.user_id = u and a.ami = r.user_id where r.saison = s),
    'aides', coalesce((select aides from mono.renforts where user_id = u and saison = s), 0));
end $$;
-- Le renfort d'un ami a été pris : son compteur cosmétique monte (au plus une fois toutes les 2 minutes par ami). Aucun gain.
create or replace function public.mono_renfort_utiliser(p_ami uuid) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); begin
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.'); end if;
  if not exists (select 1 from public.amis where user_id = u and ami = p_ami) then return jsonb_build_object('err', 'Ce joueur n''est pas dans tes amis.'); end if;
  if not exists (select 1 from mono.renforts where user_id = p_ami and saison = s) then return jsonb_build_object('err', 'Ce renfort n''est pas disponible.'); end if;
  perform mono.verrou(u);
  if exists (select 1 from mono.renfort_log where user_id = u and ami = p_ami and at > now() - interval '2 minutes') then return jsonb_build_object('ok', true, 'compte', false); end if;
  insert into mono.renfort_log (user_id, ami, saison) values (u, p_ami, s);
  update mono.renforts set aides = aides + 1 where user_id = p_ami and saison = s;
  delete from mono.renfort_log where at < now() - interval '1 day';
  return jsonb_build_object('ok', true, 'compte', true);
end $$;

-- ---------- aura de fer : au passage dans l'Éternel sous un serment tenu ----------
create or replace function mono.fer_aura_eternel() returns trigger language plpgsql security definer set search_path = mono, public
as $$ begin
  if exists (select 1 from mono.lb_saison where user_id = new.user_id and saison = new.saison and fer and not fer_perdu) then
    insert into mono.cosm_droits (user_id, cle, source, saison) values (new.user_id, 'fer_aura', 'serment:' || new.saison, new.saison) on conflict (user_id, cle) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists fer_aura on mono.eternel;
create trigger fer_aura after insert on mono.eternel for each row execute function mono.fer_aura_eternel();
-- rattrapage (panel de Mathis) : redonner les auras de fer d'une saison finie
create or replace function public.mono_adm_fer_auras(p_saison int) returns int language plpgsql security definer set search_path = mono, public
as $$ declare n int; begin
  perform mono.need_admin();
  insert into mono.cosm_droits (user_id, cle, source, saison)
    select l.user_id, 'fer_aura', 'serment:' || p_saison, p_saison from mono.lb_saison l join mono.eternel e on e.user_id = l.user_id and e.saison = l.saison
    where l.saison = p_saison and l.fer and not l.fer_perdu on conflict (user_id, cle) do nothing;
  get diagnostics n = row_count; return n;
end $$;

-- ---------- droits d'appel ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'mono' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('mono_classement', 'mono_couronne', 'mono_bilan', 'mono_renfort_publier', 'mono_renforts', 'mono_renfort_utiliser', 'mono_adm_fer_auras') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  revoke all on function public.couronne_temps() from public;
  grant execute on function public.couronne_temps() to anon, authenticated;
end $$;
