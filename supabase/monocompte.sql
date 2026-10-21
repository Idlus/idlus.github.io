-- ============================================================================
-- Idlus — espace Monocompte isolé (étape 4 du plan) et registre des Éclats du Temps (étape 6b).
-- DÉPLOIEMENT MANUEL SEULEMENT (décision 6A) : ce fichier n'est PAS dans la liste « tous » de
-- .github/workflows/supabase.yml et ne doit jamais y entrer. Il se passe à la main, après l'autorisation
-- écrite de Mathis (étape 9 : « Installe le lot 3 Monocompte sur le serveur »). Relançable sans danger.
-- Il s'appuie sur schema.sql (profiles, susp) et classements.sql (admins, is_admin), déjà en place.
--
-- Choix du schéma : toutes les TABLES vivent dans un schéma séparé « mono », que l'API du serveur (PostgREST)
-- n'expose pas : le navigateur ne peut ni les lire ni les écrire directement, même en cas d'erreur de règle.
-- Les seules entrées sont des FONCTIONS « security definer » du schéma public, préfixées mono_ (et cosm_mine),
-- car l'API n'appelle que les fonctions des schémas exposés (exposer « mono » demanderait de changer la
-- configuration du serveur, PGRST_DB_SCHEMAS, ce qu'on évite). Rien n'est modifié dans les tables, règles
-- et déclencheurs du Classique (le test tests/monocompte_sql.test.js compare le schéma public avant/après).
-- En plus : RLS activé partout, lecture de ses seules lignes, aucune écriture directe pour anon/authenticated.
--
-- Mise en route (à la main, panel ou SQL, compte admin) :
--   select mono_adm_saison(0, 'Saison de test', '2026-11-02 00:00 Europe/Paris', true, 'ouverte');  -- saison de test (horloge de test permise)
--   select mono_adm_testeur('Pseudo', true);                                                          -- ouvrir l'accès à un testeur
-- ============================================================================

create schema if not exists mono;
revoke all on schema mono from public, anon;
grant usage on schema mono to authenticated;

-- ---------- saisons ----------
-- Durées réelles fixes (56 jours, manches de 14 jours, semaines de 7 jours). contenu = défis et boutique utilisés
-- (1 : « Les Fragments du Temps »), pour qu'une saison de test reprenne le contenu de la Saison 1.
-- Horloge de test (section 6.4) : seulement si test = vrai. date de saison = clk_t + (maintenant - clk_ref) × vitesse,
-- figée sur clk_t en pause ; hors test, la date de saison est l'heure réelle et les réglages sont interdits.
create table if not exists mono.saisons (
  id int primary key check (id >= 0),
  nom text not null check (length(nom) between 1 and 60),
  theme text,
  contenu int not null default 1,
  debut timestamptz not null,
  duree_j int not null default 56 check (duree_j = 56),
  manche_j int not null default 14 check (manche_j = 14),
  semaine_j int not null default 7 check (semaine_j = 7),
  etat text not null default 'prevue' check (etat in ('prevue', 'ouverte', 'cloture', 'finie')),
  test boolean not null default false,
  clk_vitesse numeric not null default 1 check (clk_vitesse in (1, 24, 168)),
  clk_t timestamptz,
  clk_ref timestamptz,
  clk_pause boolean not null default false,
  at timestamptz not null default now(),
  constraint horloge_test_seulement check (test or (clk_vitesse = 1 and clk_t is null and clk_ref is null and not clk_pause))
);
create unique index if not exists saisons_une_ouverte on mono.saisons ((true)) where etat in ('ouverte', 'cloture');

-- ---------- testeurs : seuls ces comptes (et l'admin) entrent dans l'espace Monocompte ----------
create table if not exists mono.testeurs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  par uuid,
  at timestamptz not null default now()
);

-- ---------- parties : une par compte et par saison ----------
create table if not exists mono.parties (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  data text not null check (length(data) < 3000000),
  meta jsonb not null default '{}'::jsonb,
  game_version text,
  device text,
  updated_at timestamptz not null default now(),
  primary key (user_id, saison)
);

-- ---------- copies journalières : une par compte et par jour (heure de Paris), 14 jours ----------
-- La première partie reçue du jour est gardée (un envoi plus tard dans la journée ne la remplace pas).
create table if not exists mono.copies (
  user_id uuid not null references auth.users (id) on delete cascade,
  jour date not null,
  saison int not null,
  data text not null,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  primary key (user_id, jour)
);

-- ---------- Éternel : la partie d'une saison finie (lecture seule pour le joueur) ----------
create table if not exists mono.eternel (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  data text not null,
  meta jsonb not null default '{}'::jsonb,
  game_version text,
  partie_at timestamptz,
  at timestamptz not null default now(),
  primary key (user_id, saison)
);

-- ---------- registre des Éclats du Temps (6b) ----------
-- Une ligne par mouvement ; solde = somme des lignes ; la sauvegarde n'en garde qu'une copie.
-- origine : act (activités : seul compté dans le quota), defi (hors quota), boutique (dépense, retirée de la circulation),
-- hdv_vente / hdv_achat et echange_envoi / echange_recu (entre joueurs, hors quota, sans création), correction (Mathis).
-- source : unique par compte et par saison : la même source n'est jamais créditée deux fois.
-- jour et semaine : jour et semaine de la saison à la date de saison, comptés en heure de Paris (changements d'heure compris).
create table if not exists mono.eclats (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  n int not null check (n <> 0 and abs(n) <= 100000),
  origine text not null check (origine in ('act', 'defi', 'boutique', 'hdv_vente', 'hdv_achat', 'echange_envoi', 'echange_recu', 'correction')),
  source text not null check (length(source) between 3 and 160),
  quoi text,
  jour int,
  semaine int,
  date_saison timestamptz,
  at timestamptz not null default now(),
  constraint eclats_signe check (case when origine in ('act', 'defi', 'hdv_achat', 'echange_recu') then n > 0 when origine in ('boutique', 'hdv_vente', 'echange_envoi') then n < 0 else true end),
  constraint eclats_source_unique unique (user_id, saison, source)
);
create index if not exists eclats_user on mono.eclats (user_id, saison, origine);

-- gains d'activité : par jour de saison (20 en tout), dans le quota de 100 par semaine cumulable (800 sur 56 jours)
create table if not exists mono.act_regles (
  kind text primary key,
  max_jour int not null check (max_jour > 0)
);
insert into mono.act_regles (kind, max_jour) values ('dj', 8), ('arch', 6), ('job', 4), ('grp', 2)
  on conflict (kind) do update set max_jour = excluded.max_jour;

-- défis saisonniers : montant par palier (0 bronze, 1 argent, 2 or), manche d'ouverture, titre éventuel (droit partagé)
create table if not exists mono.defis (
  contenu int not null,
  defi text not null,
  palier int not null check (palier between 0 and 2),
  manche int not null check (manche between 1 and 4),
  n int not null check (n > 0),
  titre text,
  primary key (contenu, defi, palier)
);
-- Saison 1 (js/saison1.js, TF.DEFIS et TF.REW) : 400 par manche, 1 600 en tout. Aucun titre de défi n'est encore défini.
insert into mono.defis (contenu, defi, palier, manche, n)
  select 1, d.id, p.i, d.m, (case d.c when 0 then array[40, 56, 64] else array[30, 42, 48] end)[p.i + 1]
  from (values ('d1', 1, 0), ('d2', 1, 1), ('d3', 1, 2), ('d4', 2, 0), ('d5', 2, 1), ('d6', 2, 2), ('d7', 3, 0), ('d8', 3, 1), ('d9', 3, 2), ('d10', 4, 0), ('d11', 4, 1), ('d12', 4, 2)) d (id, m, c),
       (values (0), (1), (2)) p (i)
  on conflict (contenu, defi, palier) do update set manche = excluded.manche, n = excluded.n;

-- Boutique temporelle (5A, 2 200 en tout) : cle = droit cosmétique partagé du compte ; les objets de collection
-- (échangeables) n'en donnent jamais.
create table if not exists mono.boutique (
  contenu int not null,
  objet text not null,
  prix int not null check (prix > 0),
  cle text,
  numerote boolean not null default false,
  primary key (contenu, objet)
);
insert into mono.boutique (contenu, objet, prix, cle, numerote) values
  (1, 'emb', 200, 'tf_emb', false), (1, 'orn', 300, 'gift_o_tf_orn', false), (1, 'cadre', 350, 'gift_f_tf_cadre', false),
  (1, 'aura', 600, 'tf_aura', false), (1, 'sab', 250, null, false), (1, 'cri', 500, null, true)
  on conflict (contenu, objet) do update set prix = excluded.prix, cle = excluded.cle, numerote = excluded.numerote;

-- objets de collection achetés (échangeables, sans droit) ; le Cristal intemporel est numéroté par le serveur
create table if not exists mono.collection (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  objet text not null,
  numero int,
  at timestamptz not null default now(),
  unique (saison, objet, numero)
);

-- ---------- droits cosmétiques partagés du compte (lot 2, point 8) ----------
-- Une ligne par compte et par clé, sans doublon. Écrits seulement par le registre (achat en Boutique temporelle :
-- emblème, ornement, cadre, aura ; titres des défis de Saison 1) et plus tard par la fin de saison (6c).
create table if not exists mono.cosm_droits (
  user_id uuid not null references auth.users (id) on delete cascade,
  cle text not null check (length(cle) between 2 and 80),
  source text not null,
  saison int,
  at timestamptz not null default now(),
  primary key (user_id, cle)
);

-- ---------- règles : RLS partout, lecture de ses seules lignes, aucune écriture directe ----------
do $$ declare t text; begin
  foreach t in array array['saisons', 'testeurs', 'parties', 'copies', 'eternel', 'eclats', 'act_regles', 'defis', 'boutique', 'collection', 'cosm_droits'] loop
    execute format('alter table mono.%I enable row level security', t);
    execute format('revoke all on mono.%I from public, anon, authenticated', t);
    execute format('grant select on mono.%I to authenticated', t);
  end loop;
  foreach t in array array['testeurs', 'parties', 'copies', 'eternel', 'eclats', 'collection', 'cosm_droits'] loop
    execute format('drop policy if exists "lire ses lignes" on mono.%I', t);
    execute format('create policy "lire ses lignes" on mono.%I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
  foreach t in array array['saisons', 'act_regles', 'defis', 'boutique'] loop
    execute format('drop policy if exists "lisible" on mono.%I', t);
    execute format('create policy "lisible" on mono.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- ============================================================================
-- Fonctions internes (schéma mono, jamais appelables par le navigateur)
-- ============================================================================

-- date de saison : l'heure réelle, ou l'horloge de test d'une saison de test
create or replace function mono.date_saison(p_s int) returns timestamptz language sql stable set search_path = mono, public
as $$ select case when x.test and x.clk_t is not null then case when x.clk_pause then x.clk_t else x.clk_t + (now() - x.clk_ref) * x.clk_vitesse end else now() end
  from mono.saisons x where x.id = p_s $$;
-- jour de saison (1 = premier jour) à une date, en heure de Paris : un jour commence toujours à minuit à Paris,
-- même la semaine du changement d'heure (le dernier dimanche d'octobre dure 25 h)
create or replace function mono.jour_de(p_s int, p_t timestamptz) returns int language sql stable set search_path = mono, public
as $$ select ((p_t at time zone 'Europe/Paris')::date - (x.debut at time zone 'Europe/Paris')::date) + 1 from mono.saisons x where x.id = p_s $$;
create or replace function mono.semaine_de(p_jour int) returns int language sql immutable
as $$ select case when p_jour < 1 then 0 else (p_jour - 1) / 7 + 1 end $$;
create or replace function mono.manche_de(p_jour int) returns int language sql immutable
as $$ select case when p_jour < 1 then 0 else least(4, (p_jour - 1) / 14 + 1) end $$;
-- la saison ouverte (null s'il n'y en a pas)
create or replace function mono.saison_ouverte() returns int language sql stable set search_path = mono, public
as $$ select id from mono.saisons where etat = 'ouverte' $$;
-- saison en cours de jeu : ouverte et date de saison entre le jour 1 et le jour 56
create or replace function mono.saison_en_jeu(p_s int) returns boolean language sql stable set search_path = mono, public
as $$ select coalesce((select etat = 'ouverte' and mono.jour_de(id, mono.date_saison(id)) between 1 and duree_j from mono.saisons where id = p_s), false) $$;

create or replace function mono.acces(u uuid) returns boolean language sql stable security definer set search_path = mono, public
as $$ select u is not null and (exists (select 1 from mono.testeurs where user_id = u) or exists (select 1 from public.admins where user_id = u)) $$;
create or replace function mono.need() returns uuid language plpgsql stable security definer set search_path = mono, public
as $$ begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if not mono.acces(auth.uid()) then raise exception 'espace Monocompte réservé aux testeurs'; end if;
  return auth.uid();
end $$;
create or replace function mono.need_admin() returns void language plpgsql stable security definer set search_path = mono, public
as $$ begin
  if auth.uid() is null or not exists (select 1 from public.admins where user_id = auth.uid()) then raise exception 'réservé à Mathis'; end if;
end $$;
-- verrou par compte (crédits, achats, envois) : deux appels en même temps passent l'un après l'autre
create or replace function mono.verrou(u uuid) returns void language sql set search_path = mono, public
as $$ select pg_advisory_xact_lock(hashtextextended('mono:' || u::text, 0)) $$;

create or replace function mono.solde(u uuid, p_s int) returns int language sql stable set search_path = mono, public
as $$ select coalesce(sum(n), 0)::int from mono.eclats where user_id = u and saison = p_s $$;
-- Éclats générés par les activités : le quota ne compte que ceux-là (jamais le solde ; dépenses, ventes, échanges n'y touchent pas)
create or replace function mono.genere(u uuid, p_s int) returns int language sql stable set search_path = mono, public
as $$ select coalesce(sum(n), 0)::int from mono.eclats where user_id = u and saison = p_s and origine = 'act' $$;
-- quota débloqué à une semaine de saison : 100 par semaine, cumulable, 800 au plus
create or replace function mono.quota(p_semaine int) returns int language sql immutable
as $$ select least(800, 100 * greatest(0, least(8, p_semaine))) $$;

-- Un mouvement du registre. Renvoie le nombre d'Éclats réellement passés (0 : source déjà vue, ou rien de possible).
-- act : bornes du jour (par activité) puis quota cumulé ; montants négatifs : jamais plus que le solde.
-- Utilisé par les fonctions ci-dessous, puis par l'HdV de saison et les échanges (6a) et la fin de saison (6c).
create or replace function mono.mouvement(u uuid, p_s int, p_n int, p_origine text, p_source text, p_quoi text default null)
returns int language plpgsql security definer set search_path = mono, public
as $$ declare t timestamptz; j int; w int; g int; dmax int; dj int; s0 int; begin
  if u is null or p_s is null or p_n is null or p_n = 0 then return 0; end if;
  perform mono.verrou(u);
  if exists (select 1 from mono.eclats where user_id = u and saison = p_s and source = p_source) then return 0; end if;
  t := mono.date_saison(p_s); j := mono.jour_de(p_s, t); w := mono.semaine_de(j);
  g := p_n;
  if p_origine = 'act' then
    select max_jour into dmax from mono.act_regles where kind = p_quoi;
    if dmax is null or j < 1 or j > 56 then return 0; end if;
    select coalesce(sum(n), 0) into dj from mono.eclats where user_id = u and saison = p_s and origine = 'act' and quoi = p_quoi and jour = j;
    g := least(p_n, dmax - dj, mono.quota(w) - mono.genere(u, p_s));
    if g <= 0 then return 0; end if;
  elsif p_n < 0 then
    s0 := mono.solde(u, p_s);
    if s0 + p_n < 0 then raise exception 'solde insuffisant (% Éclats du Temps)', s0; end if;
  end if;
  insert into mono.eclats (user_id, saison, n, origine, source, quoi, jour, semaine, date_saison) values (u, p_s, g, p_origine, p_source, p_quoi, j, w, t);
  return g;
end $$;

-- état du registre pour un compte et une saison (ce que le jeu affiche)
create or replace function mono.etat(u uuid, p_s int) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare t timestamptz; j int; w int; begin
  if p_s is null then return jsonb_build_object('saison', null); end if;
  t := mono.date_saison(p_s); j := mono.jour_de(p_s, t); w := mono.semaine_de(least(j, 56));
  return jsonb_build_object('saison', p_s, 'date', t, 'jour', j, 'semaine', w, 'manche', mono.manche_de(least(j, 56)),
    'solde', mono.solde(u, p_s), 'genere', mono.genere(u, p_s), 'quota', mono.quota(w),
    'reste', greatest(0, mono.quota(w) - mono.genere(u, p_s)),
    'auj', (select coalesce(jsonb_object_agg(quoi, s), '{}'::jsonb) from (select quoi, sum(n) s from mono.eclats where user_id = u and saison = p_s and origine = 'act' and jour = j group by quoi) x),
    'defis', (select coalesce(jsonb_agg(source order by id), '[]'::jsonb) from mono.eclats where user_id = u and saison = p_s and origine = 'defi'),
    'achats', (select coalesce(jsonb_agg(quoi order by id), '[]'::jsonb) from mono.eclats where user_id = u and saison = p_s and origine = 'boutique'));
end $$;

-- passage d'une partie à l'Éternel (reprenable : rejoué, il ne fait rien de plus)
create or replace function mono.vers_eternel(u uuid, p_s int) returns boolean language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.verrou(u);
  insert into mono.eternel (user_id, saison, data, meta, game_version, partie_at)
    select user_id, saison, data, meta, game_version, updated_at from mono.parties where user_id = u and saison = p_s
    on conflict (user_id, saison) do nothing;
  delete from mono.parties where user_id = u and saison = p_s;
  return found;
end $$;

-- ============================================================================
-- Fonctions du jeu (schéma public, préfixe mono_) : les seules portes d'entrée
-- ============================================================================

-- Accès du compte : { ok, admin, saison: {...}, date, jour, semaine, manche }. ok = faux pour un compte non autorisé.
create or replace function public.mono_acces() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); x mono.saisons%rowtype; t timestamptz; j int; begin
  if auth.uid() is null or not mono.acces(auth.uid()) then return jsonb_build_object('ok', false); end if;
  if s is null then return jsonb_build_object('ok', true, 'saison', null); end if;
  select * into x from mono.saisons where id = s; t := mono.date_saison(s); j := mono.jour_de(s, t);
  return jsonb_build_object('ok', true, 'admin', exists (select 1 from public.admins where user_id = auth.uid()),
    'saison', jsonb_build_object('id', x.id, 'nom', x.nom, 'theme', x.theme, 'debut', x.debut, 'etat', x.etat, 'test', x.test),
    'date', t, 'jour', j, 'semaine', mono.semaine_de(least(j, 56)), 'manche', mono.manche_de(least(j, 56)));
end $$;

-- Date de la partie en ligne de la saison ouverte, au même format que push_save (comparaison exacte).
create or replace function public.mono_info() returns table (updated_at text, meta jsonb, device text, game_version text, saison int)
language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  return query select to_char(p.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), p.meta, p.device, p.game_version, p.saison
    from mono.parties p where p.user_id = u and p.saison = mono.saison_ouverte();
end $$;

create or replace function public.mono_pull() returns text language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  return (select data from mono.parties where user_id = u and saison = mono.saison_ouverte());
end $$;

-- Envoi de la partie (même logique que push_save) : p_expected = date de la version en ligne connue de l'appareil ;
-- si elle a changé (autre appareil), rien n'est écrit et la fonction renvoie null (le jeu demande quelle version garder).
-- Compte suspendu : refusé. Saison fermée : refusé. Partie remise par Mathis (meta.remise) : pas d'envoi forcé par-dessus.
create or replace function public.mono_push(p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); r timestamptz; jr date := (now() at time zone 'Europe/Paris')::date; begin
  if public.susp(u) then raise exception 'compte suspendu'; end if;
  if s is null then raise exception 'saison Monocompte fermée'; end if;
  if p_data is null or length(p_data) >= 3000000 then raise exception 'partie trop grande'; end if;
  perform mono.verrou(u);
  if p_force and exists (select 1 from mono.parties where user_id = u and saison = s and meta ? 'remise') then p_force := false; end if;
  if p_force then
    insert into mono.parties (user_id, saison, data, meta, game_version, device, updated_at)
      values (u, s, p_data, coalesce(p_meta, '{}'::jsonb), p_version, p_device, clock_timestamp())
      on conflict (user_id, saison) do update set data = excluded.data, meta = excluded.meta, game_version = excluded.game_version, device = excluded.device, updated_at = excluded.updated_at
      returning updated_at into r;
  elsif p_expected is null then
    insert into mono.parties (user_id, saison, data, meta, game_version, device, updated_at)
      values (u, s, p_data, coalesce(p_meta, '{}'::jsonb), p_version, p_device, clock_timestamp())
      on conflict (user_id, saison) do nothing
      returning updated_at into r;
  else
    update mono.parties set data = p_data, meta = coalesce(p_meta, '{}'::jsonb), game_version = p_version, device = p_device, updated_at = clock_timestamp()
      where user_id = u and saison = s and updated_at = p_expected::timestamptz
      returning updated_at into r;
  end if;
  if r is not null then
    -- copie du jour (la première reçue), puis seulement les 14 derniers jours
    insert into mono.copies (user_id, jour, saison, data, meta) values (u, jr, s, p_data, coalesce(p_meta, '{}'::jsonb)) on conflict (user_id, jour) do nothing;
    delete from mono.copies where user_id = u and jour <= jr - 14;
  end if;
  return to_char(r at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
end $$;

-- Effacer sa partie de la saison (recommencer un héros) : les copies des 14 jours et le registre restent.
create or replace function public.mono_delete() returns void language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  perform mono.verrou(u);
  delete from mono.parties where user_id = u and saison = mono.saison_ouverte();
end $$;

-- Ses copies journalières (jour, heure, niveau) et une copie précise
create or replace function public.mono_copies() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  return (select coalesce(jsonb_agg(jsonb_build_object('jour', jour, 'saison', saison, 'at', at, 'lvl', meta -> 'lvl') order by jour desc), '[]'::jsonb) from mono.copies where user_id = u);
end $$;
create or replace function public.mono_copie(p_jour date) returns text language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin return (select data from mono.copies where user_id = u and jour = p_jour); end $$;

-- Éternel : ses héros des saisons passées (lecture seule)
create or replace function public.mono_eternel() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  return (select coalesce(jsonb_agg(jsonb_build_object('saison', e.saison, 'nom', x.nom, 'at', e.at, 'meta', e.meta, 'solde', mono.solde(u, e.saison)) order by e.saison), '[]'::jsonb)
    from mono.eternel e join mono.saisons x on x.id = e.saison where e.user_id = u);
end $$;
create or replace function public.mono_eternel_pull(p_saison int) returns text language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin return (select data from mono.eternel where user_id = u and saison = p_saison); end $$;

-- ---------- registre des Éclats du Temps ----------
-- état : solde, Éclats générés, quota débloqué, reste, gains du jour par activité, défis payés, achats (p_saison : une saison
-- finie, pour l'Éternel ; null : la saison ouverte)
create or replace function public.mono_eclats_etat(p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin return mono.etat(u, coalesce(p_saison, mono.saison_ouverte())); end $$;

-- Gain d'activité : le serveur applique la borne du jour et le quota (le jeu ne fait que proposer).
-- p_source : identifiant du gain donné par le jeu (une source déjà vue ne paie jamais deux fois).
create or replace function public.mono_eclats_activite(p_kind text, p_n int, p_source text) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); g int; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.', 'n', 0); end if;
  if p_n is null or p_n < 1 or p_n > 20 then return jsonb_build_object('err', 'Gain illisible.', 'n', 0); end if;
  if p_source is null or p_source !~ '^[A-Za-z0-9:_.-]{3,120}$' then return jsonb_build_object('err', 'Source illisible.', 'n', 0); end if;
  g := mono.mouvement(u, s, p_n, 'act', 'act:' || p_source, p_kind);
  return mono.etat(u, s) || jsonb_build_object('ok', true, 'n', g);
end $$;

-- Défi saisonnier : une seule fois par défi et par palier, dans l'ordre, une fois sa manche ouverte ; hors quota.
-- Le titre du défi (s'il y en a un) devient un droit partagé du compte.
-- (La vérification de la progression elle-même par le serveur arrive avec la partie serveur de la Saison 1, F2.)
create or replace function public.mono_eclats_defi(p_defi text, p_palier int) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); x mono.defis%rowtype; c int; j int; g int; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.', 'n', 0); end if;
  select contenu into c from mono.saisons where id = s;
  select * into x from mono.defis where contenu = c and defi = p_defi and palier = p_palier;
  if not found then return jsonb_build_object('err', 'Défi inconnu.', 'n', 0); end if;
  j := mono.jour_de(s, mono.date_saison(s));
  if mono.manche_de(j) < x.manche then return jsonb_build_object('err', 'Ce défi n''est pas encore ouvert.', 'n', 0); end if;
  perform mono.verrou(u);
  if p_palier > 0 and not exists (select 1 from mono.eclats where user_id = u and saison = s and source = format('defi:%s:%s', p_defi, p_palier - 1)) then
    return jsonb_build_object('err', 'Palier précédent pas encore obtenu.', 'n', 0);
  end if;
  g := mono.mouvement(u, s, x.n, 'defi', format('defi:%s:%s', p_defi, p_palier), p_defi);
  if g > 0 and x.titre is not null then
    insert into mono.cosm_droits (user_id, cle, source, saison) values (u, 'titre:' || x.titre, format('defi:%s:%s', p_defi, p_palier), s) on conflict (user_id, cle) do nothing;
  end if;
  return mono.etat(u, s) || jsonb_build_object('ok', true, 'n', g);
end $$;

-- Achat en Boutique temporelle (saison ouverte) ou en Boutique d'Archives (p_saison : saison finie, dans l'Éternel) :
-- UNE seule opération : débit du registre + droit cosmétique (lié au compte) ou objet de collection (échangeable, sans droit).
create or replace function public.mono_boutique_achat(p_objet text, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int; c int; x mono.boutique%rowtype; no int; sol int; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  s := coalesce(p_saison, mono.saison_ouverte());
  if s is null then return jsonb_build_object('err', 'La boutique est fermée.'); end if;
  if s = mono.saison_ouverte() then
    if not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La boutique est fermée.'); end if;
  elsif not exists (select 1 from mono.saisons where id = s and etat = 'finie') or not exists (select 1 from mono.eternel where user_id = u and saison = s) then
    return jsonb_build_object('err', 'La Boutique d''Archives est réservée à l''Éternel.');
  end if;
  select contenu into c from mono.saisons where id = s;
  select * into x from mono.boutique where contenu = c and objet = p_objet;
  if not found then return jsonb_build_object('err', 'Objet inconnu.'); end if;
  perform mono.verrou(u);
  if x.cle is not null and exists (select 1 from mono.cosm_droits where user_id = u and cle = x.cle) then return jsonb_build_object('err', 'Tu l''as déjà : il est lié à ton compte.'); end if;
  if exists (select 1 from mono.eclats where user_id = u and saison = s and source = 'boutique:' || p_objet) then return jsonb_build_object('err', 'Déjà acheté cette saison.'); end if;
  sol := mono.solde(u, s);
  if sol < x.prix then return jsonb_build_object('err', format('Il faut %s Éclats du Temps.', x.prix)); end if;
  perform mono.mouvement(u, s, -x.prix, 'boutique', 'boutique:' || p_objet, p_objet);
  if x.cle is not null then
    insert into mono.cosm_droits (user_id, cle, source, saison) values (u, x.cle, 'boutique:' || p_objet, s);
  else
    if x.numerote then
      perform pg_advisory_xact_lock(hashtextextended('mono-num:' || s || ':' || p_objet, 0));
      select coalesce(max(numero), 0) + 1 into no from mono.collection where saison = s and objet = p_objet;
    end if;
    insert into mono.collection (user_id, saison, objet, numero) values (u, s, p_objet, no);
  end if;
  return mono.etat(u, s) || jsonb_build_object('ok', true, 'objet', p_objet, 'droit', x.cle, 'numero', no);
end $$;

-- Droits cosmétiques partagés du compte (Garde-robe) : lus par leur propriétaire seulement
create or replace function public.cosm_mine() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('cle', cle, 'source', source, 'saison', saison, 'at', at) order by at), '[]'::jsonb) from mono.cosm_droits where user_id = auth.uid());
end $$;

-- ============================================================================
-- Panel de Mathis (admin seulement)
-- ============================================================================

-- Créer ou modifier une saison. p_test : saison de test (horloge de test permise). Une seule saison ouverte à la fois.
-- Une saison finie ne change plus. Une saison qui n'est plus de test perd son horloge de test.
create or replace function public.mono_adm_saison(p_id int, p_nom text, p_debut timestamptz, p_test boolean, p_etat text default 'prevue', p_theme text default null, p_contenu int default 1)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  if coalesce(p_etat, 'prevue') = 'finie' then raise exception 'une saison se finit avec mono_adm_fin_saison'; end if;
  if exists (select 1 from mono.saisons where id = p_id and etat = 'finie') then raise exception 'saison finie : elle ne change plus'; end if;
  insert into mono.saisons (id, nom, theme, contenu, debut, test, etat) values (p_id, p_nom, p_theme, coalesce(p_contenu, 1), p_debut, coalesce(p_test, false), coalesce(p_etat, 'prevue'))
    on conflict (id) do update set nom = excluded.nom, theme = coalesce(excluded.theme, mono.saisons.theme), contenu = excluded.contenu, debut = excluded.debut, test = excluded.test, etat = excluded.etat,
      clk_vitesse = case when excluded.test then mono.saisons.clk_vitesse else 1 end, clk_t = case when excluded.test then mono.saisons.clk_t end,
      clk_ref = case when excluded.test then mono.saisons.clk_ref end, clk_pause = excluded.test and mono.saisons.clk_pause;
  return (select to_jsonb(x) from mono.saisons x where id = p_id);
end $$;

-- Horloge de test (section 6.4) : vitesse ×1, ×24 ou ×168, « avancer au jour N » (vers l'avant seulement), pause.
-- Refusée hors d'une saison de test.
create or replace function public.mono_adm_horloge(p_vitesse numeric default null, p_jour int default null, p_pause boolean default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); x mono.saisons%rowtype; t timestamptz; cible timestamptz; begin
  perform mono.need_admin();
  select * into x from mono.saisons where id = s;
  if not found or not x.test then raise exception 'horloge de test refusée hors de l''espace de test'; end if;
  if p_vitesse is not null and p_vitesse not in (1, 24, 168) then raise exception 'vitesse inconnue'; end if;
  t := mono.date_saison(s); -- on repart de la date de saison actuelle (la vitesse ne change que la suite)
  if p_jour is not null then
    cible := ((x.debut at time zone 'Europe/Paris')::date + (greatest(1, least(57, p_jour)) - 1))::timestamp at time zone 'Europe/Paris';
    if cible < t then raise exception 'l''horloge de test n''avance que vers l''avant'; end if;
    t := cible;
  end if;
  update mono.saisons set clk_t = t, clk_ref = now(), clk_vitesse = coalesce(p_vitesse, clk_vitesse), clk_pause = coalesce(p_pause, clk_pause) where id = s;
  return mono.etat(auth.uid(), s) || jsonb_build_object('vitesse', coalesce(p_vitesse, x.clk_vitesse), 'pause', coalesce(p_pause, x.clk_pause));
end $$;

-- Testeurs : ouvrir ou fermer l'accès d'un compte (par son pseudo) ; liste
create or replace function public.mono_adm_testeur(p_pseudo text, p_on boolean) returns text language plpgsql security definer set search_path = mono, public
as $$ declare u uuid; begin
  perform mono.need_admin();
  select id into u from public.profiles where lower(pseudo) = lower(btrim(p_pseudo));
  if u is null then return 'Pseudo inconnu.'; end if;
  if p_on then insert into mono.testeurs (user_id, par) values (u, auth.uid()) on conflict (user_id) do nothing;
  else delete from mono.testeurs where user_id = u; end if;
  return null;
end $$;
create or replace function public.mono_adm_testeurs() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.user_id, 'pseudo', p.pseudo, 'at', t.at) order by t.at), '[]'::jsonb) from mono.testeurs t left join public.profiles p on p.id = t.user_id);
end $$;

-- Fin de saison, étape « passage à l'Éternel » (la clôture de l'HdV, des ordres et des échanges, 6c, se fera avant) :
-- la saison passe en clôture (plus d'envoi), puis les parties passent par lots dans l'Éternel ; reprenable après une coupure.
-- Les Éclats restent dans le registre de la saison (règle 9 : utilisables dans la Boutique d'Archives, jamais dans une autre saison).
create or replace function public.mono_adm_fin_saison(p_saison int, p_lot int default 500) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare n int := 0; r record; left_ int; begin
  perform mono.need_admin();
  if not exists (select 1 from mono.saisons where id = p_saison and etat in ('ouverte', 'cloture', 'finie')) then raise exception 'saison inconnue ou pas ouverte'; end if;
  update mono.saisons set etat = 'cloture' where id = p_saison and etat = 'ouverte';
  for r in select user_id from mono.parties where saison = p_saison order by user_id limit greatest(1, p_lot) loop
    perform mono.vers_eternel(r.user_id, p_saison); n := n + 1;
  end loop;
  select count(*) into left_ from mono.parties where saison = p_saison;
  if left_ = 0 then update mono.saisons set etat = 'finie' where id = p_saison and etat = 'cloture'; end if;
  return jsonb_build_object('passees', n, 'reste', left_, 'etat', (select etat from mono.saisons where id = p_saison));
end $$;

-- Remettre la partie d'un joueur à une de ses copies journalières (marque « remise » : l'appareil doit la reprendre)
create or replace function public.mono_adm_restaurer(p_user uuid, p_jour date) returns text language plpgsql security definer set search_path = mono, public
as $$ declare c mono.copies%rowtype; begin
  perform mono.need_admin();
  select * into c from mono.copies where user_id = p_user and jour = p_jour;
  if not found then return 'Pas de copie ce jour-là.'; end if;
  if c.saison is distinct from mono.saison_ouverte() then return 'Cette copie est d''une autre saison.'; end if;
  perform mono.verrou(p_user);
  insert into mono.parties (user_id, saison, data, meta, updated_at) values (p_user, c.saison, c.data, c.meta || jsonb_build_object('remise', p_jour), clock_timestamp())
    on conflict (user_id, saison) do update set data = excluded.data, meta = excluded.meta, updated_at = excluded.updated_at;
  return null;
end $$;

-- ---------- droits d'appel ----------
-- fonctions internes : personne (seul le propriétaire, via les fonctions ci-dessus)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'mono' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (p.proname like 'mono\_%' or p.proname = 'cosm_mine') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
