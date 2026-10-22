-- ============================================================================
-- Idlus — Monocompte : classements de saison, Couronne du Temps, Serment de fer, renfort d'un ami et défi de la mutation
-- de la semaine (lot 2, points 9, 10 et 11 ; « Saison plus » ; décisions de Mathis du 21/10, maquette validée).
-- DÉPLOIEMENT MANUEL SEULEMENT, comme supabase/monocompte.sql : jamais dans la liste automatique de
-- .github/workflows/supabase.yml.
-- ORDRE DE CHARGEMENT DU MONOCOMPTE (unique, à la main, chaque fichier relançable sans danger) :
--   1. supabase/monocompte.sql   espace mono, Bouclier, défis ; crée mono.apres_validation, mono.etat_social et
--                                mono.defi_d12 VIDES seulement s'ils n'existent pas (le relancer n'efface rien d'après) ;
--   2. supabase/amis.sql         amis (Classique et Monocompte), blocage = public.ignores (chat.sql) ;
--   3. supabase/mono_social.sql  redéfinit mono.apres_validation (classements, Couronne, renfort) et mono.etat_social ;
--   4. supabase/mono_bureau.sql  Bureau des Aventuriers ; redéfinit mono.defi_d12 (défi 12) ; lit les amis et le blocage.
-- Aucune fonction n'est définie avec un vrai corps dans deux fichiers : chaque crochet a un seul propriétaire
-- (vérifié par tests/bureau_sql.test.js, qui charge les quatre fichiers dans cet ordre puis relance monocompte.sql).
-- Ici (3) : mono.apres_validation (classements, Couronne, copie du héros pour le renfort) et mono.etat_social (renforts
-- pris, lus par le Bouclier). mono_bureau.sql ne touche à aucune des deux.
-- La version de monocompte.sql de mono.apres_validation est vide (le Bouclier fait ses bons de butin et ses défis dans
-- mono_srv_valider, avant de l'appeler) : celle d'ici n'a donc rien à reprendre d'elle.
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
-- renfort : la copie du héros d'un joueur, construite par le serveur (le Bouclier la calcule dans le résumé de la partie
-- validée, clé « renfort » : jamais ce que le navigateur envoie), recopiée à chaque partie validée ; et le compteur
-- cosmétique de ses aides (aucun gain)
create table if not exists mono.renforts (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  snap jsonb not null, niveau int not null, cls text not null,
  aides int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, saison)
);
alter table mono.renforts add column if not exists hero int;
delete from mono.renforts where hero is null; -- anciennes photos envoyées par le jeu (avant la copie du serveur) : effacées
-- renforts pris : un par donjon solo, avec la copie donnée par le serveur (le Bouclier refuse une partie dont le renfort
-- n'est pas l'une d'elles) ; compteur de l'ami : au plus une fois toutes les 2 minutes
create table if not exists mono.renfort_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ami uuid not null references auth.users (id) on delete cascade,
  saison int not null,
  at timestamptz not null default now()
);
alter table mono.renfort_log add column if not exists did text;
alter table mono.renfort_log add column if not exists stasis int;
alter table mono.renfort_log add column if not exists snap jsonb;
alter table mono.renfort_log add column if not exists compte boolean not null default true;
create index if not exists renfort_log_u on mono.renfort_log (user_id, ami, at desc);

-- défi de groupe de la mutation de la semaine : payé par des bons de butin (mono.bons_partie, activité « mut », ligne
-- « act:<jour>:mut » du registre provisoire de la partie validée), dans le quota ; 20 Éclats au plus par semaine de saison
insert into mono.act_regles (kind, max_jour, max_semaine) values ('mut', 20, 20) on conflict (kind) do update set max_jour = excluded.max_jour, max_semaine = excluded.max_semaine;

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

-- copie du héros d'un joueur pour le renfort, prise dans le résumé de sa partie validée (clé « renfort », calculée par le
-- Bouclier : js/verify_mono.js, VM.renfort). p_hero : le héros choisi (au plus son identifiant, jamais son contenu) ;
-- p_creer : publier (sinon seulement mettre à jour une copie déjà prêtée). Renvoie null, ou la raison d'un refus.
create or replace function mono.renfort_copier(p_user uuid, p_saison int, p_resume jsonb, p_hero int, p_creer boolean) returns text
language plpgsql security definer set search_path = mono, public
as $$ declare c jsonb := p_resume -> 'renfort'; n int; k text; h int; begin
  if not p_creer and not exists (select 1 from mono.renforts where user_id = p_user and saison = p_saison) then return null; end if;
  if c is null or jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'st') <> 'object' or jsonb_typeof(c -> 'sp') <> 'array' or length(c::text) > 40000 then
    if not p_creer then delete from mono.renforts where user_id = p_user and saison = p_saison; end if;
    return 'Ton héros n''est pas dans ta partie validée.'; end if;
  n := mono.num(c -> 'lvl')::int; k := c ->> 'cls'; h := mono.num(c -> 'hid')::int;
  if n is null or n < 1 or n > 200 or k is null or k !~ '^[a-z]{2,12}$' then return 'Ton héros n''est pas dans ta partie validée.'; end if;
  if p_hero is not null and h is distinct from p_hero then return 'Ce héros n''est pas dans ta partie validée.'; end if;
  insert into mono.renforts (user_id, saison, snap, niveau, cls, hero) values (p_user, p_saison, c, n, k, h)
    on conflict (user_id, saison) do update set snap = excluded.snap, niveau = excluded.niveau, cls = excluded.cls, hero = excluded.hero, at = now();
  return null;
end $$;

-- Redéfinie ici (contrat avec le Bouclier Monocompte) : appelée après chaque partie validée.
drop function if exists mono.apres_validation(uuid, int, jsonb);
create function mono.apres_validation(p_user uuid, p_saison int, p_resume jsonb) returns void language plpgsql security definer set search_path = mono, public
as $$ declare r jsonb := coalesce(p_resume, '{}'::jsonb) - 'renfort'; b record; old mono.lb_saison%rowtype; fer_now boolean; perdu boolean; g record; w int; begin
  if p_user is null or p_saison is null then return; end if;
  -- copie du héros pour le renfort : refaite depuis chaque partie validée (seulement pour un joueur qui la prête)
  perform mono.renfort_copier(p_user, p_saison, coalesce(p_resume, '{}'::jsonb), null, false);
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
-- mono.pseudo(u) : définie par monocompte.sql (chargé avant).
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
-- Prêter son héros : le serveur copie le héros de la dernière partie validée (mono.parties_ok.resume -> 'renfort', calculé
-- par le Bouclier). Le jeu n'envoie au plus que l'identifiant du héros choisi, jamais son contenu.
drop function if exists public.mono_renfort_publier(jsonb);
create or replace function public.mono_renfort_publier(p_hero int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); r jsonb; e text; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.'); end if;
  select resume into r from mono.parties_ok where user_id = u and saison = s;
  if r is null then return jsonb_build_object('err', 'Ta partie n''est pas encore validée par le serveur.'); end if;
  e := mono.renfort_copier(u, s, r, p_hero, true);
  if e is not null then return jsonb_build_object('err', e); end if;
  return jsonb_build_object('ok', true);
end $$;
-- le renfort que u peut prendre chez v : null s'il est possible, sinon la raison (amis acceptés des deux côtés, aucun blocage,
-- copie prêtée tirée d'une partie validée, serment de fer, écart de niveau avec la partie validée de u)
create or replace function mono.renfort_refus(u uuid, v uuid, s int) returns text language plpgsql stable security definer set search_path = mono, public
as $$ declare me jsonb; rn mono.renforts%rowtype; lv int; begin
  if v is null or v = u then return 'Ce renfort n''est pas disponible.'; end if;
  if not (public.amis_sont(u, v, 'm') and public.amis_sont(v, u, 'm')) then return 'Ce joueur n''est pas dans tes amis.'; end if;
  if public.amis_bloque(u, v) or public.amis_bloque(v, u) then return 'Ce joueur n''est pas dans tes amis.'; end if;
  select * into rn from mono.renforts where user_id = v and saison = s;
  if rn.user_id is null or not exists (select 1 from mono.parties_ok where user_id = v and saison = s) or public.susp(v) then return 'Ce renfort n''est pas disponible.'; end if;
  select resume into me from mono.parties_ok where user_id = u and saison = s;
  if me is null then return 'Ta partie n''est pas encore validée par le serveur.'; end if;
  if coalesce(me ->> 'serment', me -> 'serment' ->> 't', '') = 'fer' then return 'Serment de fer : pas de renfort pendant la saison.'; end if;
  lv := coalesce(mono.num(me -> 'niveau'), mono.num(me -> 'lvl'), 1)::int;
  -- 22/10 (ticket #144) : le niveau compté est celui de la dernière partie validée, pas celui du jeu : le message le dit
  if rn.niveau > lv + 10 then return format('Le héros de ton ami (niveau %s) est trop fort : le serveur compte ton héros au niveau %s, celui de ta dernière partie validée (10 niveaux d''écart au plus).', rn.niveau, lv); end if;
  return null;
end $$;
-- Les renforts disponibles : ceux de mes amis (supabase/amis.sql) pour la saison ouverte, copies du serveur ; et mes aides
create or replace function public.mono_renforts() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); begin
  if s is null then return jsonb_build_object('amis', '[]'::jsonb, 'aides', 0); end if;
  return jsonb_build_object(
    'amis', (select coalesce(jsonb_agg(jsonb_build_object('u', r.user_id, 'p', mono.pseudo(r.user_id), 'cls', r.cls, 'lvl', r.niveau, 'snap', r.snap, 'at', r.at, 'err', mono.renfort_refus(u, r.user_id, s)) order by r.niveau desc), '[]'::jsonb)
      from mono.renforts r join public.amis a on a.user_id = u and a.ami = r.user_id and a.srv = 'm'
      where r.saison = s and not public.amis_bloque(u, r.user_id) and not public.amis_bloque(r.user_id, u) and exists (select 1 from mono.parties_ok k where k.user_id = r.user_id and k.saison = s)),
    'prete', exists (select 1 from mono.renforts where user_id = u and saison = s),
    'aides', coalesce((select aides from mono.renforts where user_id = u and saison = s), 0));
end $$;
-- Prendre le renfort d'un ami pour un donjon solo : le serveur rend SA copie (celle que le combat utilise) et la note ;
-- le Bouclier refuse ensuite une partie dont le renfort n'est pas une copie rendue ici. L'un ou l'autre : jamais avec un
-- mercenaire (p_merc), jamais dans un groupe (p_groupe). Aucun gain pour l'ami : un compteur cosmétique (2 minutes).
drop function if exists public.mono_renfort_utiliser(uuid);
create or replace function public.mono_renfort_prendre(p_ami uuid, p_did text default null, p_stasis int default null, p_merc text default null, p_groupe text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); e text; rn mono.renforts%rowtype; cpt boolean; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.'); end if;
  if nullif(btrim(coalesce(p_groupe, '')), '') is not null then return jsonb_build_object('err', 'Le renfort d''un ami se prend seulement en donjon solo, pas en groupe.'); end if;
  if nullif(btrim(coalesce(p_merc, '')), '') is not null then return jsonb_build_object('err', 'Renfort ou mercenaire : l''un ou l''autre, jamais les deux.'); end if;
  if p_did is not null and (length(p_did) > 40 or p_stasis is null or p_stasis < 1 or p_stasis > 30) then return jsonb_build_object('err', 'Donjon inconnu.'); end if;
  e := mono.renfort_refus(u, p_ami, s);
  if e is not null then return jsonb_build_object('err', e); end if;
  perform mono.verrou(u);
  select * into rn from mono.renforts where user_id = p_ami and saison = s;
  cpt := not exists (select 1 from mono.renfort_log where user_id = u and ami = p_ami and compte and at > now() - interval '2 minutes');
  delete from mono.renfort_log where at < now() - interval '2 days';
  insert into mono.renfort_log (user_id, ami, saison, did, stasis, snap, compte) values (u, p_ami, s, p_did, p_stasis, rn.snap, cpt);
  if cpt then update mono.renforts set aides = aides + 1 where user_id = p_ami and saison = s; end if;
  return jsonb_build_object('ok', true, 'compte', cpt, 'u', p_ami, 'p', mono.pseudo(p_ami), 'snap', rn.snap);
end $$;
-- Pour le Bouclier (mono_srv_etat) : les copies rendues à ce compte ces 2 derniers jours
create or replace function mono.etat_social(p_user uuid, p_s int) returns jsonb language sql stable security definer set search_path = mono, public
as $$ select jsonb_build_object('renforts', coalesce((select jsonb_agg(jsonb_build_object('u', l.ami, 'snap', l.snap) order by l.id desc)
  from (select * from mono.renfort_log where user_id = p_user and saison = p_s and snap is not null and at > now() - interval '2 days' order by id desc limit 50) l), '[]'::jsonb)) $$;

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
      where n.nspname = 'public' and p.proname in ('mono_classement', 'mono_couronne', 'mono_bilan', 'mono_renfort_publier', 'mono_renforts', 'mono_renfort_prendre', 'mono_adm_fer_auras') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  revoke all on function public.couronne_temps() from public;
  grant execute on function public.couronne_temps() to anon, authenticated;
end $$;
