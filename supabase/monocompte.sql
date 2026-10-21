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

-- ---------- partie validée par le Bouclier Monocompte (étape 5) ----------
-- Contrat avec les classements de saison, la Couronne, le Serment de fer et les amis (supabase/mono_social.sql) :
-- seule une partie acceptée par le Bouclier (fonction serveur « mono ») arrive ici, avec le résumé calculé par le serveur
-- (niveau, classe, nom, Dofus du Phénix, meilleurs temps en donjon de groupe, serment, camp, rang, défis réussis).
-- Une partie refusée n'écrase jamais celle-ci. bilan et res : ce que le Bouclier compare d'une partie validée à la suivante.
create table if not exists mono.parties_ok (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  data text not null,
  resume jsonb not null default '{}'::jsonb,
  bilan jsonb not null default '{}'::jsonb,
  res numeric,
  src_at timestamptz,
  accept boolean not null default false,
  at timestamptz not null default now(),
  primary key (user_id, saison)
);
-- journal des refus du Bouclier (panel de Mathis) ; un compte refusé après sa dernière validation a ses échanges en pause
create table if not exists mono.bouclier (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null,
  why text not null,
  at timestamptz not null default now()
);
create index if not exists bouclier_user on mono.bouclier (user_id, saison, at);
-- bons de butin (6a) : un par combat et par joueur, créés seulement par le serveur. Solo : « j<jour>:<activité>:<rang> », lu dans
-- la partie validée (le rang du gain dans la journée) ; groupes en direct : « g:<combat> » (Bureau des Aventuriers, plus tard).
-- La seule source des Éclats d'activité (mono.eclats.source = 'bon:' || combat) : le même combat ne paie jamais deux fois.
create table if not exists mono.bons (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  combat text not null check (length(combat) between 3 and 120),
  kind text not null,
  jour int not null,
  n int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, saison, combat)
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
-- 6a : hdv_retour = Éclats mis en vente rendus au vendeur (annonce retirée, expirée ou fermée à la fin de saison)
alter table mono.eclats drop constraint if exists eclats_origine_check;
alter table mono.eclats add constraint eclats_origine_check check (origine in ('act', 'defi', 'boutique', 'hdv_vente', 'hdv_achat', 'hdv_retour', 'echange_envoi', 'echange_recu', 'correction'));
alter table mono.eclats drop constraint if exists eclats_signe;
alter table mono.eclats add constraint eclats_signe check (case when origine in ('act', 'defi', 'hdv_achat', 'hdv_retour', 'echange_recu') then n > 0 when origine in ('boutique', 'hdv_vente', 'echange_envoi') then n < 0 else true end);

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
alter table mono.defis add column if not exists need int; -- progression à atteindre (js/saison1.js, TF.DEFIS[].need), vérifiée par le serveur
-- Saison 1 (js/saison1.js, TF.DEFIS et TF.REW) : 400 par manche, 1 600 en tout. Aucun titre de défi n'est encore défini.
insert into mono.defis (contenu, defi, palier, manche, n)
  select 1, d.id, p.i, d.m, (case d.c when 0 then array[40, 56, 64] else array[30, 42, 48] end)[p.i + 1]
  from (values ('d1', 1, 0), ('d2', 1, 1), ('d3', 1, 2), ('d4', 2, 0), ('d5', 2, 1), ('d6', 2, 2), ('d7', 3, 0), ('d8', 3, 1), ('d9', 3, 2), ('d10', 4, 0), ('d11', 4, 1), ('d12', 4, 2)) d (id, m, c),
       (values (0), (1), (2)) p (i)
  on conflict (contenu, defi, palier) do update set manche = excluded.manche, n = excluded.n;
update mono.defis x set need = v.need[x.palier + 1] from (values ('d1', array[10, 25, 50]), ('d2', array[40, 70, 100]), ('d3', array[1, 5, 15]), ('d4', array[5, 15, 30]),
  ('d5', array[30, 100, 250]), ('d6', array[5, 20, 50]), ('d7', array[4, 6, 8]), ('d8', array[50, 200, 500]), ('d9', array[5, 20, 50]), ('d10', array[6, 7, 8]),
  ('d11', array[1, 5, 15]), ('d12', array[2, 5, 10])) v (defi, need) where x.contenu = 1 and x.defi = v.defi;

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

-- ---------- 6a : opérations du serveur, objets numérotés, HdV de saison, offres d'achat, échanges ----------
create table if not exists mono.ops (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id),
  payload jsonb not null,         -- { k, res|runes|cons: {nom: n}, rm: [uid], add: [objet], rmM|rmP, addM|addP, tf: n (affichage), col: {objet: n} }
  txt text,
  at timestamptz not null default now()
);
create index if not exists ops_user on mono.ops (user_id, saison, id);

create table if not exists mono.objets (
  sn bigint generated always as identity primary key,
  saison int not null references mono.saisons (id),
  tpl text not null,
  owner uuid references auth.users (id) on delete set null, -- null : en vente (hdv)
  hdv bigint,
  at timestamptz not null default now()
);
create index if not exists objets_owner on mono.objets (owner, saison);
-- objets, montures et familiers sortis d'une partie (vendus ou échangés) : uid de la partie et opération qui les a retirés
create table if not exists mono.sortis (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null,
  uid bigint not null,
  tpl text not null,
  op bigint not null,
  sn bigint,
  at timestamptz not null default now(),
  primary key (user_id, saison, uid)
);
alter table mono.collection add column if not exists hdv bigint; -- objet de collection en vente

create table if not exists mono.hdv (
  id bigint generated always as identity primary key,
  saison int not null references mono.saisons (id),
  monde text not null check (monde in ('s', 'e')),
  seller uuid not null references auth.users (id) on delete cascade,
  cat text not null check (cat in ('eq', 'res', 'rune', 'cons', 'mt', 'pet', 'tf', 'col')),
  key text not null,
  name text not null,
  lvl int not null default 0,
  slot text,
  qty int not null default 1 check (qty > 0),
  price bigint not null check (price > 0),
  item jsonb,
  ref bigint,                     -- numéro de l'objet (eq) ou de l'objet de collection (col)
  status text not null default 'open' check (status in ('open', 'sold', 'gone')),
  buyer uuid,
  motif text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  closed_at timestamptz
);
create index if not exists hdv_open on mono.hdv (saison, monde, key, price) where status = 'open';
create index if not exists hdv_seller on mono.hdv (seller, saison, status);
create table if not exists mono.ventes (
  id bigint generated always as identity primary key,
  saison int not null, monde text not null,
  key text not null, cat text not null, name text, qty int not null, price bigint not null,
  seller uuid not null, buyer uuid not null,
  at timestamptz not null default now()
);
create index if not exists ventes_seller on mono.ventes (seller, saison, monde);
create index if not exists ventes_key on mono.ventes (saison, monde, key, at);
create table if not exists mono.ordres (
  id bigint generated always as identity primary key,
  saison int not null references mono.saisons (id),
  monde text not null check (monde in ('s', 'e')),
  buyer uuid not null references auth.users (id) on delete cascade,
  cat text not null check (cat in ('res', 'rune', 'cons', 'tf')),
  key text not null, name text not null, lvl int not null default 0, slot text,
  qty int not null, filled int not null default 0, price bigint not null, held bigint not null,
  status text not null default 'open' check (status in ('open', 'done', 'gone')),
  created_at timestamptz not null default now(), expires_at timestamptz not null, closed_at timestamptz
);
create index if not exists ordres_open on mono.ordres (saison, monde, key, price desc) where status = 'open';
create table if not exists mono.echanges (
  id bigint generated always as identity primary key,
  saison int not null references mono.saisons (id),
  monde text not null check (monde in ('s', 'e')),
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  offer_a jsonb not null default '{}'::jsonb, offer_b jsonb not null default '{}'::jsonb,
  ok_a boolean not null default false, ok_b boolean not null default false,
  ver int not null default 0,
  status text not null default 'open' check (status in ('open', 'done', 'cancel')),
  note text,
  updated_at timestamptz not null default now()
);
create index if not exists echanges_open on mono.echanges (saison, status);

do $$ declare t text; begin
  foreach t in array array['parties_ok', 'bouclier', 'bons', 'ops', 'objets', 'sortis', 'hdv', 'ventes', 'ordres', 'echanges'] loop
    execute format('alter table mono.%I enable row level security', t);
    execute format('revoke all on mono.%I from public, anon, authenticated', t);
  end loop;
  foreach t in array array['parties_ok', 'bons', 'ops'] loop
    execute format('grant select on mono.%I to authenticated', t);
    execute format('drop policy if exists "lire ses lignes" on mono.%I', t);
    execute format('create policy "lire ses lignes" on mono.%I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

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

-- fin de la saison (minuit à Paris, après le jour 56) ; gel (P-E1) : plus de nouvelle offre à l'HdV, d'ordre ni d'échange
-- dans les 24 dernières heures, ni une fois la saison en clôture
create or replace function mono.fin(p_s int) returns timestamptz language sql stable set search_path = mono, public
as $$ select (((x.debut at time zone 'Europe/Paris')::date + x.duree_j)::timestamp at time zone 'Europe/Paris') from mono.saisons x where x.id = p_s $$;
create or replace function mono.gel(p_s int) returns boolean language sql stable set search_path = mono, public
as $$ select coalesce((select x.etat <> 'ouverte' or mono.date_saison(x.id) >= mono.fin(x.id) - interval '24 hours' from mono.saisons x where x.id = p_s), true) $$;

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
-- p_jour (6a, bons de butin) : jour de saison du gain (un jour déjà passé, jamais un jour à venir) ; sans lui, le jour de la date de saison.
drop function if exists mono.mouvement(uuid, int, int, text, text, text);
create or replace function mono.mouvement(u uuid, p_s int, p_n int, p_origine text, p_source text, p_quoi text default null, p_jour int default null)
returns int language plpgsql security definer set search_path = mono, public
as $$ declare t timestamptz; j int; w int; g int; dmax int; dj int; s0 int; jg int; begin
  if u is null or p_s is null or p_n is null or p_n = 0 then return 0; end if;
  perform mono.verrou(u);
  if exists (select 1 from mono.eclats where user_id = u and saison = p_s and source = p_source) then return 0; end if;
  t := mono.date_saison(p_s); j := mono.jour_de(p_s, t); w := mono.semaine_de(j);
  g := p_n;
  if p_origine = 'act' then
    select max_jour into dmax from mono.act_regles where kind = p_quoi;
    jg := coalesce(p_jour, j);
    if dmax is null or j < 1 or j > 56 or jg < 1 or jg > j then return 0; end if;
    j := jg;
    select coalesce(sum(n), 0) into dj from mono.eclats where user_id = u and saison = p_s and origine = 'act' and quoi = p_quoi and jour = j;
    g := least(p_n, dmax - dj, mono.quota(w) - mono.genere(u, p_s));
    if g <= 0 then return 0; end if;
  elsif p_n < 0 then
    s0 := mono.solde(u, p_s);
    if s0 + p_n < 0 then raise exception 'solde insuffisant (% Éclats du Temps)', s0; end if;
  end if;
  insert into mono.eclats (user_id, saison, n, origine, source, quoi, jour, semaine, date_saison) values (u, p_s, g, p_origine, p_source, p_quoi, j, mono.semaine_de(j), t);
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
  -- la dernière partie validée par le Bouclier (étape 5) ; une partie jamais validée part telle quelle, marquée « non validée »
  insert into mono.eternel (user_id, saison, data, meta, game_version, partie_at)
    select k.user_id, k.saison, k.data, coalesce(p.meta, '{}'::jsonb) || jsonb_build_object('valide', true), p.game_version, k.src_at from mono.parties_ok k left join mono.parties p on p.user_id = k.user_id and p.saison = k.saison
      where k.user_id = u and k.saison = p_s
    on conflict (user_id, saison) do nothing;
  insert into mono.eternel (user_id, saison, data, meta, game_version, partie_at)
    select user_id, saison, data, meta || jsonb_build_object('valide', false), game_version, updated_at from mono.parties where user_id = u and saison = p_s
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
  -- 6c : saison en clôture ou finie (la plus récente) : le jeu le sait et passe son héros dans l'Éternel
  if s is null then s := (select id from mono.saisons where etat in ('cloture', 'finie') order by debut desc limit 1); end if;
  if s is null then return jsonb_build_object('ok', true, 'saison', null); end if;
  select * into x from mono.saisons where id = s; t := mono.date_saison(s); j := mono.jour_de(s, t);
  return jsonb_build_object('ok', true, 'admin', exists (select 1 from public.admins where user_id = auth.uid()),
    'saison', jsonb_build_object('id', x.id, 'nom', x.nom, 'theme', x.theme, 'debut', x.debut, 'etat', x.etat, 'test', x.test, 'fin', mono.fin(x.id)),
    'date', t, 'jour', j, 'semaine', mono.semaine_de(least(j, 56)), 'manche', mono.manche_de(least(j, 56)), 'gel', mono.gel(s),
    -- 6c : le jeu suit la date de saison du serveur (horloge de test comprise) : vitesse et pause
    'clk', jsonb_build_object('v', case when x.test then x.clk_vitesse else 1 end, 'pause', x.test and x.clk_pause), 'srv', now());
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
create or replace function mono.push(u uuid, p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text language plpgsql security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); r timestamptz; jr date := (now() at time zone 'Europe/Paris')::date; begin
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
-- Envoi direct (étape 4) : la partie brute sert à la synchro entre appareils. Le jeu envoie par la fonction serveur « mono »,
-- qui vérifie chaque envoi (Bouclier) ; une partie envoyée ici est vérifiée au prochain appel de la fonction. Rien ne lit la
-- partie brute pour un gain, un échange ou un classement : seulement mono.parties_ok.
create or replace function public.mono_push(p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text language plpgsql security definer set search_path = mono, public
as $$ begin return mono.push(mono.need(), p_data, p_meta, p_version, p_device, p_expected, p_force); end $$;

-- Effacer sa partie de la saison (recommencer un héros) : les copies des 14 jours et le registre restent.
create or replace function public.mono_delete() returns void language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  perform mono.verrou(u);
  delete from mono.parties where user_id = u and saison = mono.saison_ouverte();
  delete from mono.parties_ok where user_id = u and saison = mono.saison_ouverte(); -- le nouveau héros repart de zéro (le registre, les bons et les opérations restent)
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

-- 6a : les Éclats d'activité ne viennent plus d'une source donnée par le jeu (ancienne fonction mono_eclats_activite) : seulement
-- des bons de butin créés par le serveur (mono.bon, appelé à chaque partie validée par le Bouclier et par les combats du serveur).
drop function if exists public.mono_eclats_activite(text, int, text);

-- Progression d'un défi d'après le serveur : le défi 6 « Marché des échos » est compté sur l'HdV de saison (lots vendus à
-- d'autres joueurs, comptés seulement à partir de 3 acheteurs différents) ; les autres sont lus dans le résumé de la dernière
-- partie validée par le Bouclier (qui plafonne leur progression par heure réelle) ; le défi 12 attend les groupes en direct.
create or replace function mono.defi_prog(u uuid, p_s int, p_defi text) returns int language sql stable security definer set search_path = mono, public
as $$ select case p_defi
  when 'd6' then (select case when count(distinct buyer) >= 3 then count(*) else 0 end from mono.ventes where seller = u and saison = p_s and monde = 's' and buyer <> u)::int
  when 'd12' then 0
  else coalesce((select case when (resume -> 'defis' ->> p_defi) ~ '^\d{1,9}$' then (resume -> 'defis' ->> p_defi)::int end from mono.parties_ok where user_id = u and saison = p_s), 0) end $$;

-- Paie un palier de défi : une seule fois par défi et par palier, dans l'ordre, une fois sa manche ouverte, la progression
-- atteinte d'après le serveur ; hors quota. Le titre du défi (s'il y en a un) devient un droit partagé du compte.
create or replace function mono.payer_defi(u uuid, p_s int, p_defi text, p_palier int) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare x mono.defis%rowtype; c int; j int; g int; begin
  select contenu into c from mono.saisons where id = p_s;
  select * into x from mono.defis where contenu = c and defi = p_defi and palier = p_palier;
  if not found then return jsonb_build_object('err', 'Défi inconnu.', 'n', 0); end if;
  j := mono.jour_de(p_s, mono.date_saison(p_s));
  if mono.manche_de(j) < x.manche then return jsonb_build_object('err', 'Ce défi n''est pas encore ouvert.', 'n', 0); end if;
  perform mono.verrou(u);
  if p_palier > 0 and not exists (select 1 from mono.eclats where user_id = u and saison = p_s and source = format('defi:%s:%s', p_defi, p_palier - 1)) then
    return jsonb_build_object('err', 'Palier précédent pas encore obtenu.', 'n', 0);
  end if;
  if exists (select 1 from mono.eclats where user_id = u and saison = p_s and source = format('defi:%s:%s', p_defi, p_palier)) then return jsonb_build_object('ok', true, 'n', 0); end if;
  if x.need is not null and mono.defi_prog(u, p_s, p_defi) < x.need then
    return jsonb_build_object('err', 'Progression pas encore validée par le serveur.', 'n', 0, 'prog', mono.defi_prog(u, p_s, p_defi), 'need', x.need);
  end if;
  g := mono.mouvement(u, p_s, x.n, 'defi', format('defi:%s:%s', p_defi, p_palier), p_defi);
  if g > 0 and x.titre is not null then
    insert into mono.cosm_droits (user_id, cle, source, saison) values (u, 'titre:' || x.titre, format('defi:%s:%s', p_defi, p_palier), p_s) on conflict (user_id, cle) do nothing;
  end if;
  return jsonb_build_object('ok', true, 'n', g);
end $$;
-- Tous les paliers atteints (appelé après chaque partie validée et chaque vente à l'HdV de saison)
create or replace function mono.payer_defis(u uuid, p_s int) returns int language plpgsql security definer set search_path = mono, public
as $$ declare d record; r jsonb; tot int := 0; begin
  if not mono.saison_en_jeu(p_s) then return 0; end if;
  for d in select x.defi, x.palier from mono.defis x join mono.saisons z on z.contenu = x.contenu and z.id = p_s order by x.defi, x.palier loop
    r := mono.payer_defi(u, p_s, d.defi, d.palier); tot := tot + coalesce((r ->> 'n')::int, 0);
  end loop;
  return tot;
end $$;

-- Défi saisonnier demandé par le jeu (le serveur paie aussi tout seul après chaque partie validée)
create or replace function public.mono_eclats_defi(p_defi text, p_palier int) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); r jsonb; begin
  if public.susp(u) then return jsonb_build_object('err', 'Compte suspendu.'); end if;
  if s is null or not mono.saison_en_jeu(s) then return jsonb_build_object('err', 'La saison est fermée.', 'n', 0); end if;
  r := mono.payer_defi(u, s, p_defi, p_palier);
  if r ? 'err' then return r; end if;
  return mono.etat(u, s) || r;
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

-- Fin de saison (6c) : la saison passe en clôture (plus d'envoi, plus d'achat ni d'échange), puis le marché de la saison
-- est fermé par lots (chaque annonce et chaque offre d'achat rendue une fois), puis les parties passent par lots dans
-- l'Éternel. Chaque appel fait un lot dans une transaction ; reprenable après une coupure (relancer jusqu'à etat = 'finie').
-- Les Éclats restent dans le registre de la saison (règle 9 : utilisables dans la Boutique d'Archives, jamais dans une autre saison).
create or replace function public.mono_adm_fin_saison(p_saison int, p_lot int default 500) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare n int := 0; r record; left_ int; m jsonb; begin
  perform mono.need_admin();
  if not exists (select 1 from mono.saisons where id = p_saison and etat in ('ouverte', 'cloture', 'finie')) then raise exception 'saison inconnue ou pas ouverte'; end if;
  update mono.saisons set etat = 'cloture' where id = p_saison and etat = 'ouverte';
  m := mono.cloture_marche(p_saison, p_lot);
  if (m ->> 'reste')::int > 0 or (m ->> 'annonces')::int + (m ->> 'ordres')::int >= greatest(1, p_lot) then
    return jsonb_build_object('etape', 'marche', 'marche', m, 'passees', 0, 'reste', (select count(*) from mono.parties where saison = p_saison), 'etat', 'cloture'); end if;
  for r in select user_id from mono.parties where saison = p_saison order by user_id limit greatest(1, p_lot) loop
    perform mono.vers_eternel(r.user_id, p_saison); n := n + 1;
  end loop;
  select count(*) into left_ from mono.parties where saison = p_saison;
  if left_ = 0 then update mono.saisons set etat = 'finie' where id = p_saison and etat = 'cloture'; end if;
  return jsonb_build_object('etape', 'eternel', 'marche', m, 'passees', n, 'reste', left_, 'etat', (select etat from mono.saisons where id = p_saison));
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

-- ============================================================================
-- Étapes 5, 6a et 6c : Bouclier Monocompte (côté base), bons de butin, économie de saison (HdV, ordres, échanges),
-- fin de saison du marché. Règles de l'HdV : celles du Classique (supabase/hdv.sql, P-E2) : taxe de 2 % à la mise en vente,
-- 20 annonces de 14 jours, lots de 1, 10 ou 100, offres d'achat de 3, 7 ou 14 jours (10 au plus), échanges directs (12 objets
-- et bêtes au plus, un par minute), montures et familiers. En plus au Monocompte :
--   - tout part de la dernière partie validée par le Bouclier (mono.parties_ok), jamais de la partie brute ;
--   - chaque achat, vente, offre et échange est UNE opération du serveur (une transaction : kamas, objets et Éclats ensemble) ;
--   - Éclats du Temps échangeables (registre : hdv_vente à la mise en vente, hdv_achat à l'achat, hdv_retour s'ils reviennent,
--     echange_envoi / echange_recu), jamais créés ; ni vente directe ni marchand (il n'y a ici que l'HdV et l'échange) ;
--   - objets de collection de la Boutique temporelle échangeables (mono.collection change de propriétaire) ;
--   - aucun objet lié au compte : Dofus, trophées, équipements de rang (Arsenal) ; les cosmétiques de la boutique sont des droits ;
--   - numéro unique (mono.objets.sn) donné par le serveur à un objet à sa première vente ou son premier échange, gardé ensuite :
--     le Bouclier refuse une partie qui porte un objet numéroté d'un autre joueur, ou un objet sorti de son sac (mono.sortis) ;
--   - HdV de saison (monde « s ») et HdV de l'Éternel (monde « e », une par saison finie) séparés ;
--   - gel des nouvelles offres 24 h avant la fin de saison (P-E1), puis clôture atomique et reprenable (6c).
-- ============================================================================

-- ---------- Bouclier : ce qui ne change jamais après une validation ----------
-- Contrat avec supabase/mono_social.sql (classements, Couronne, Serment de fer, amis) : appelée après chaque partie validée,
-- avec le résumé calculé par le serveur. Vide ici : l'autre fichier la redéfinit (create or replace, mêmes paramètres).
create or replace function mono.apres_validation(user_id uuid, saison int, resume jsonb) returns void language plpgsql security definer set search_path = mono, public
as $$ begin end $$;

-- Bon de butin : un par combat et par joueur ; paie les Éclats d'activité (borne du jour du combat, quota de la semaine).
-- Un bon qui ne paie rien (borne ou quota atteints) n'est pas gardé : le même combat pourra payer quand le quota s'ouvre.
create or replace function mono.bon(u uuid, p_s int, p_kind text, p_combat text, p_n int, p_jour int default null) returns int
language plpgsql security definer set search_path = mono, public
as $$ declare g int; j int; begin
  if u is null or p_combat is null or p_n is null or p_n < 1 or not mono.saison_en_jeu(p_s) then return 0; end if;
  perform mono.verrou(u);
  if exists (select 1 from mono.bons where user_id = u and saison = p_s and combat = p_combat) then return 0; end if;
  j := coalesce(p_jour, mono.jour_de(p_s, mono.date_saison(p_s)));
  g := mono.mouvement(u, p_s, p_n, 'act', 'bon:' || p_combat, p_kind, j);
  if g > 0 then insert into mono.bons (user_id, saison, combat, kind, jour, n) values (u, p_s, p_combat, p_kind, j, g); end if;
  return g;
end $$;
-- Bons d'une partie validée : p_acts = [{ j, k, n }] (gains de la journée j pour l'activité k, d'après la partie) ;
-- un bon par rang de gain dans la journée (« j3:dj:5 » = 5e Éclat de donjon du jour 3), jamais au-delà de la borne du jour.
create or replace function mono.bons_partie(u uuid, p_s int, p_acts jsonb) returns int language plpgsql security definer set search_path = mono, public
as $$ declare a record; mx int; deja int; r int; g int; tot int := 0; gain int; begin
  if p_acts is null or jsonb_typeof(p_acts) <> 'array' then return 0; end if;
  for a in select (x ->> 'j')::int j, x ->> 'k' k, least(coalesce((x ->> 'n')::int, 0), 100) n from jsonb_array_elements(p_acts) x
      where (x ->> 'j') ~ '^\d{1,2}$' and (x ->> 'n') ~ '^\d{1,4}$' and (x ->> 'k') ~ '^[a-z]{2,8}$' order by 1, 2 loop
    select max_jour into mx from mono.act_regles where kind = a.k; if mx is null then continue; end if;
    select count(*) into deja from mono.bons where user_id = u and saison = p_s and kind = a.k and jour = a.j;
    for r in deja + 1 .. least(a.n, mx) loop
      g := mono.bon(u, p_s, a.k, format('j%s:%s:%s', a.j, a.k, r), 1, a.j);
      exit when g = 0; tot := tot + g;
    end loop;
  end loop;
  return tot;
end $$;

-- ---------- outils du marché ----------
create or replace function mono.err(t text) returns jsonb language sql immutable as $$ select jsonb_build_object('err', t) $$;
create or replace function mono.pseudo(u uuid) returns text language sql stable security definer set search_path = mono, public as $$ select pseudo from public.profiles where id = u $$;
-- monde de la saison : 's' saison en cours (ouverte ou en clôture), 'e' Éternel (saison finie)
create or replace function mono.monde(p_s int) returns text language sql stable set search_path = mono, public
as $$ select case etat when 'finie' then 'e' when 'prevue' then null else 's' end from mono.saisons where id = p_s $$;
-- nouvelles offres refusées : saison gelée (24 h avant la fin) ou fermée ; l'Éternel n'a pas de gel
create or replace function mono.marche_gele(p_s int) returns boolean language sql stable set search_path = mono, public
as $$ select case mono.monde(p_s) when 's' then mono.gel(p_s) when 'e' then false else true end $$;
-- achats, ventes à une offre, échanges : jusqu'à la clôture
create or replace function mono.marche_ouvert(p_s int) returns boolean language sql stable set search_path = mono, public
as $$ select coalesce((select etat = 'ouverte' or etat = 'finie' from mono.saisons where id = p_s), false) $$;
-- la saison visée : celle donnée (Éternel) ou la saison ouverte
create or replace function mono.saison_de(p_saison int) returns int language sql stable set search_path = mono, public
as $$ select coalesce(p_saison, mono.saison_ouverte()) $$;

-- partie de référence : la dernière partie validée (saison) ou la partie de l'Éternel
create or replace function mono.base(u uuid, p_s int) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare d jsonb; m text := mono.monde(p_s); begin
  if u is null then raise exception 'non connecté'; end if;
  if public.susp(u) then raise exception 'Compte suspendu.'; end if;
  if m is null then raise exception 'Pas d''hôtel de vente pour cette saison.'; end if;
  if m = 's' then
    if exists (select 1 from mono.bouclier b where b.user_id = u and b.saison = p_s and b.at > coalesce((select k.at from mono.parties_ok k where k.user_id = u and k.saison = p_s), '-infinity'::timestamptz)) then
      raise exception 'Ta partie est en vérification : les échanges sont bloqués en attendant.'; end if;
    select data::jsonb into d from mono.parties_ok where user_id = u and saison = p_s;
    if d is null then raise exception 'Ta partie n''est pas encore validée par le serveur : attends quelques secondes.'; end if;
  else
    select data::jsonb into d from mono.eternel where user_id = u and saison = p_s;
    if d is null then raise exception 'L''hôtel de vente de l''Éternel est réservé aux héros de cette saison.'; end if;
  end if;
  if coalesce((d ->> 'panelUsed')::boolean, false) then raise exception 'Partie retouchée par le panel de test : tu peux regarder, mais pas vendre ni acheter.'; end if;
  return d;
end $$;
create or replace function mono.cursor(d jsonb) returns bigint language sql immutable
as $$ select coalesce(case when (d -> 'hdv' ->> 'op') ~ '^\d{1,15}$' then (d -> 'hdv' ->> 'op')::bigint end, 0) $$;
create or replace function mono.kamas(u uuid, p_s int, d jsonb) returns numeric language sql stable security definer set search_path = mono, public
as $$ select coalesce(case when (d ->> 'kamas') ~ '^\d{1,15}(\.\d+)?$' then (d ->> 'kamas')::numeric end, 0)
  + coalesce((select sum((o.payload ->> 'k')::numeric) from mono.ops o where o.user_id = u and o.saison = p_s and o.id > mono.cursor(d)), 0) $$;
create or replace function mono.qty(u uuid, p_s int, d jsonb, b text, k text) returns numeric language sql stable security definer set search_path = mono, public
as $$ select coalesce(case when (d -> b ->> k) ~ '^\d{1,12}(\.\d+)?$' then (d -> b ->> k)::numeric end, 0)
  + coalesce((select sum((o.payload -> b ->> k)::numeric) from mono.ops o where o.user_id = u and o.saison = p_s and o.id > mono.cursor(d)), 0) $$;
create or replace function mono.bucket(c text) returns text language sql immutable as $$ select case c when 'res' then 'res' when 'rune' then 'runes' when 'cons' then 'cons' end $$;
create or replace function mono.tf_res() returns text language sql immutable as $$ select 'Éclat du Temps'::text $$;
-- objets jamais échangeables au Monocompte : Dofus (dont le Phénix), trophées, équipements de rang de l'Arsenal (liés au compte)
create or replace function mono.bloque(tpl text) returns boolean language sql immutable as $$ select coalesce(tpl, '') ~ '^(dofus_|trophee_|hon_)' $$;
create or replace function mono.tax(p bigint) returns bigint language sql immutable as $$ select greatest(1, ceil(p * 0.02))::bigint $$;
create or replace function mono.otax(p numeric) returns bigint language sql immutable as $$ select case when p <= 0 then 0 else ceil(p * 0.02) end::bigint $$;
create or replace function mono.op(u uuid, p_s int, p jsonb, t text) returns bigint language plpgsql security definer set search_path = mono, public
as $$ declare i bigint; begin insert into mono.ops (user_id, saison, payload, txt) values (u, p_s, p, t) returning id into i; return i; end $$;
create or replace function mono.ops_after(u uuid, p_s int, p_after bigint) returns jsonb language sql stable security definer set search_path = mono, public
as $$ select coalesce(jsonb_agg(jsonb_build_object('id', id, 'p', payload, 't', txt) order by id), '[]'::jsonb)
  from (select * from mono.ops where user_id = u and saison = p_s and id > coalesce(p_after, 0) order by id limit 300) o $$;
create or replace function mono.uniq(a jsonb) returns jsonb language sql immutable
as $$ select case when jsonb_typeof(a) = 'array' and jsonb_array_length(a) > 0 then (select jsonb_agg(distinct (v #>> '{}')::bigint) from jsonb_array_elements(a) v where (v #>> '{}') ~ '^\d{1,15}$') end $$;

-- Objet échangeable ? Renvoie l'objet (sans uid) ou lève une erreur.
create or replace function mono.item(u uuid, p_s int, d jsonb, p_uid bigint) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare it jsonb; begin
  it := d -> 'items' -> (p_uid::text);
  if it is null or jsonb_typeof(it) <> 'object' then raise exception 'Objet introuvable dans ta partie validée : attends quelques secondes et réessaie.'; end if;
  if exists (select 1 from mono.sortis where user_id = u and saison = p_s and uid = p_uid) then raise exception 'Cet objet n''est plus dans ton sac.'; end if;
  if coalesce((it ->> 'locked')::boolean, false) then raise exception 'Objet verrouillé : déverrouille-le d''abord.'; end if;
  if mono.bloque(it ->> 'tpl') or coalesce((it ->> 'merc')::boolean, false) then raise exception 'Les Dofus, les trophées et les objets liés au compte ne s''échangent pas.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d -> 'chars', '[]'::jsonb)) c, jsonb_each_text(coalesce(c -> 'equip', '{}'::jsonb)) e where e.value = p_uid::text) then raise exception 'Objet équipé : retire-le d''abord.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d -> 'chars', '[]'::jsonb)) c, jsonb_array_elements(coalesce(c -> 'gear', '[]'::jsonb)) g, jsonb_each_text(coalesce(g -> 'eq', '{}'::jsonb)) e where e.value = p_uid::text) then raise exception 'Objet utilisé dans un équipement enregistré : retire-le d''abord.'; end if;
  if it ? 'sn' and not exists (select 1 from mono.objets where sn = (it ->> 'sn')::bigint and owner = u and saison = p_s) then raise exception 'Cet objet numéroté n''est pas à toi.'; end if;
  return it - 'uid' - 'locked' - 'well' - 'fmLog';
end $$;
-- Monture ou familier échangeable ? (règles du Classique, 2.1.30)
create or replace function mono.beast(u uuid, p_s int, d jsonb, p_cat text, p_uid bigint) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare b jsonb; x text := p_uid::text; begin
  b := case p_cat when 'mt' then d -> 'mounts' -> x when 'pet' then d -> 'pets' -> x end;
  if b is null or jsonb_typeof(b) <> 'object' then raise exception '% introuvable dans ta partie validée.', case p_cat when 'mt' then 'Monture' else 'Familier' end; end if;
  if exists (select 1 from mono.sortis where user_id = u and saison = p_s and uid = -p_uid - (case p_cat when 'mt' then 0 else 1000000000 end)) then raise exception 'Cette bête n''est plus à toi.'; end if;
  if p_cat = 'mt' then
    if exists (select 1 from jsonb_array_elements(coalesce(d -> 'chars', '[]'::jsonb)) c where c ->> 'mount' = x) then raise exception 'Monture montée : descends d''abord.'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(d -> 'enclos' -> 'pairs', '[]'::jsonb)) y where y ->> 'a' = x or y ->> 'b' = x) then raise exception 'Monture à l''enclos : annule d''abord le couple.'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(d -> 'elev' -> 'bal', '[]'::jsonb)) y where y ->> 'uid' = x) then raise exception 'Monture en balade : attends son retour.'; end if;
    if coalesce(b ->> 'sp', '') not in ('dd', 'mu', 'vk') or coalesce(b ->> 'c', '') = '' then raise exception 'Monture illisible : elle ne peut pas être vendue.'; end if;
    return b - 'uid' - 'nm' - 'res' - 'got';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d -> 'chars', '[]'::jsonb)) c where c ->> 'pet' = x) then raise exception 'Familier porté : retire-le d''abord.'; end if;
  if b ->> 'id' = 'chacha_dore' then raise exception 'Le Chacha Doré ne s''échange pas.'; end if;
  if coalesce(b ->> 'id', '') = '' then raise exception 'Familier illisible : il ne peut pas être vendu.'; end if;
  return b - 'uid' - 'got' - 'skin';
end $$;
-- uid des bêtes dans mono.sortis : montures en -uid, familiers en -uid - 1 000 000 000 (les objets gardent leur uid)
create or replace function mono.sortir(u uuid, p_s int, p_uid bigint, p_tpl text, p_op bigint, p_sn bigint default null) returns void language sql security definer set search_path = mono, public
as $$ insert into mono.sortis (user_id, saison, uid, tpl, op, sn) values (u, p_s, p_uid, p_tpl, p_op, p_sn) on conflict do nothing $$;
-- numéro unique d'un objet échangeable : donné à sa première vente ou son premier échange, gardé ensuite
create or replace function mono.numero(p_s int, it jsonb, p_owner uuid) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare n bigint; begin
  if it ? 'sn' then return it; end if;
  insert into mono.objets (saison, tpl, owner) values (p_s, it ->> 'tpl', p_owner) returning sn into n;
  return it || jsonb_build_object('sn', n);
end $$;

-- ce qui revient au vendeur d'une annonce, et ce que reçoit l'acheteur (une bête achetée est marquée b, comme au Classique)
create or replace function mono.back(L mono.hdv) returns jsonb language sql immutable
as $$ select case L.cat when 'eq' then jsonb_build_object('add', jsonb_build_array(L.item)) when 'mt' then jsonb_build_object('addM', jsonb_build_array(L.item))
  when 'pet' then jsonb_build_object('addP', jsonb_build_array(L.item)) when 'tf' then jsonb_build_object('tf', L.qty) when 'col' then jsonb_build_object('col', jsonb_build_object(L.key, 1))
  else jsonb_build_object(mono.bucket(L.cat), jsonb_build_object(L.key, L.qty)) end $$;
create or replace function mono.buyer(L mono.hdv) returns jsonb language sql immutable
as $$ select case when L.cat in ('mt', 'pet') then jsonb_build_object(case L.cat when 'mt' then 'addM' else 'addP' end, jsonb_build_array(L.item || '{"b": 1}'::jsonb)) else mono.back(L) end $$;
create or replace function mono.lbl(L mono.hdv) returns text language sql immutable as $$ select L.name || case when L.qty > 1 then ' ×' || L.qty else '' end $$;

-- Rend une annonce à son vendeur, UNE seule fois (annonce retirée, expirée, ou fermée à la fin de saison) : objet, bête,
-- ressources, Éclats du Temps ou objet de collection reviennent dans la même transaction que la fermeture.
create or replace function mono.rendre(p_id bigint, p_motif text) returns boolean language plpgsql security definer set search_path = mono, public
as $$ declare L mono.hdv; begin
  update mono.hdv set status = 'gone', closed_at = now(), motif = p_motif where id = p_id and status = 'open' returning * into L;
  if L.id is null then return false; end if;
  perform mono.op(L.seller, L.saison, mono.back(L), p_motif || ', revenu dans ton sac : ' || mono.lbl(L));
  if L.cat = 'tf' then perform mono.mouvement(L.seller, L.saison, L.qty, 'hdv_retour', 'hdv:' || L.id || ':retour', 'hdv'); end if;
  if L.cat = 'col' then update mono.collection set hdv = null where id = L.ref; end if;
  if L.cat = 'eq' and L.ref is not null then update mono.objets set owner = L.seller, hdv = null where sn = L.ref; end if;
  return true;
end $$;
create or replace function mono.expire(p_s int) returns void language plpgsql security definer set search_path = mono, public
as $$ declare i bigint; begin
  for i in select id from mono.hdv where saison = p_s and status = 'open' and expires_at < now() order by id limit 200 for update skip locked loop perform mono.rendre(i, 'Annonce expirée'); end loop;
end $$;
-- Ferme une offre d'achat et rend ce qui n'a pas servi, UNE seule fois
create or replace function mono.ordre_fermer(p_id bigint, p_st text, p_why text) returns boolean language plpgsql security definer set search_path = mono, public
as $$ declare O mono.ordres; back bigint; begin
  update mono.ordres set status = p_st, closed_at = now() where id = p_id and status = 'open' returning * into O;
  if O.id is null then return false; end if;
  back := O.held - O.filled * O.price - mono.otax(O.filled * O.price);
  if back > 0 then perform mono.op(O.buyer, O.saison, jsonb_build_object('k', back), p_why || ' : ' || O.name || ' (' || O.filled || ' / ' || O.qty || ' reçus), kamas restants rendus'); end if;
  return true;
end $$;
create or replace function mono.ordre_expire(p_s int) returns void language plpgsql security definer set search_path = mono, public
as $$ declare i bigint; begin
  for i in select id from mono.ordres where saison = p_s and status = 'open' and expires_at < now() order by id limit 200 for update skip locked loop perform mono.ordre_fermer(i, 'gone', 'Offre d''achat terminée'); end loop;
end $$;

-- ---------- HdV de saison (et de l'Éternel) : fonctions du jeu, mêmes paramètres que celles du Classique (+ p_saison pour l'Éternel) ----------
create or replace function public.mono_hdv_sync(p_after bigint, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  if mono.marche_ouvert(s) then perform mono.expire(s); perform mono.ordre_expire(s); end if;
  return jsonb_build_object('ops', mono.ops_after(u, s, p_after), 'registre', mono.etat(u, s));
end $$;

create or replace function public.mono_hdv_list(p_after bigint, p_cat text, p_key text, p_uid bigint, p_lot int, p_n int, p_price bigint, p_name text, p_lvl int, p_slot text, p_saison int default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); m text; d jsonb; it jsonb; b text; tax bigint; n int := greatest(1, coalesce(p_n, 1)); c text := p_cat; lid bigint; opid bigint; i int; cl mono.collection; begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  begin d := mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  perform mono.verrou(u); m := mono.monde(s);
  if mono.marche_gele(s) then return mono.err('Fin de saison dans moins de 24 h : l''hôtel de vente n''accepte plus de nouvelle annonce.'); end if;
  if p_price is null or p_price < 1 or p_price > 2000000000 then return mono.err('Prix invalide.'); end if;
  if n > 20 then return mono.err('20 lots au maximum d''un coup.'); end if;
  if (select count(*) from mono.hdv where seller = u and saison = s and monde = m and status = 'open') + n > 20 then return mono.err('Plus de place : 20 ventes à la fois au maximum.'); end if;
  if c = 'res' and p_key = mono.tf_res() then c := 'tf'; end if;
  tax := mono.tax(p_price);
  if mono.kamas(u, s, d) < tax * n then return mono.err('Pas assez de kamas pour la taxe de mise en vente.'); end if;
  if c = 'eq' then
    begin it := mono.item(u, s, d, p_uid); exception when raise_exception then return mono.err(sqlerrm); end;
    it := mono.numero(s, it, u);
    insert into mono.hdv (saison, monde, seller, cat, key, name, lvl, slot, qty, price, item, ref) values (s, m, u, 'eq', it ->> 'tpl', left(coalesce(p_name, it ->> 'tpl'), 80), coalesce(p_lvl, 0), left(p_slot, 20), 1, p_price, it, (it ->> 'sn')::bigint) returning id into lid;
    update mono.objets set owner = null, hdv = lid where sn = (it ->> 'sn')::bigint;
    opid := mono.op(u, s, jsonb_build_object('k', -tax, 'rm', jsonb_build_array(p_uid)), 'Mis en vente : ' || coalesce(p_name, it ->> 'tpl'));
    perform mono.sortir(u, s, p_uid, it ->> 'tpl', opid, (it ->> 'sn')::bigint);
  elsif c in ('res', 'rune', 'cons') then
    b := mono.bucket(c);
    if p_lot not in (1, 10, 100) then return mono.err('Lots de 1, 10 ou 100.'); end if;
    if p_key is null or mono.bloque(p_key) then return mono.err('Cette ressource ne s''échange pas.'); end if;
    if mono.qty(u, s, d, b, p_key) < p_lot * n then return mono.err('Tu n''en as pas assez (ou ta partie validée n''est pas encore à jour).'); end if;
    insert into mono.hdv (saison, monde, seller, cat, key, name, lvl, slot, qty, price) select s, m, u, c, p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), p_lot, p_price from generate_series(1, n);
    perform mono.op(u, s, jsonb_build_object('k', -tax * n, b, jsonb_build_object(p_key, -p_lot * n)), 'Mis en vente : ' || n || ' × ' || p_key || ' ×' || p_lot);
  elsif c = 'tf' then
    if p_lot not in (1, 10, 100) then return mono.err('Lots de 1, 10 ou 100.'); end if;
    if mono.solde(u, s) < p_lot * n then return mono.err('Pas assez d''Éclats du Temps.'); end if;
    for i in 1 .. n loop
      insert into mono.hdv (saison, monde, seller, cat, key, name, lvl, qty, price) values (s, m, u, 'tf', mono.tf_res(), mono.tf_res(), 1, p_lot, p_price) returning id into lid;
      perform mono.mouvement(u, s, -p_lot, 'hdv_vente', 'hdv:' || lid || ':mise', 'hdv');
    end loop;
    perform mono.op(u, s, jsonb_build_object('k', -tax * n, 'tf', -p_lot * n), 'Mis en vente : ' || n || ' × ' || mono.tf_res() || ' ×' || p_lot);
  elsif c = 'col' then
    select * into cl from mono.collection where id = p_uid and user_id = u and saison = s and hdv is null for update;
    if cl.id is null then return mono.err('Objet de collection introuvable.'); end if;
    insert into mono.hdv (saison, monde, seller, cat, key, name, lvl, qty, price, item, ref) values (s, m, u, 'col', cl.objet, left(coalesce(p_name, cl.objet), 80), 0, 1, p_price, jsonb_build_object('objet', cl.objet, 'numero', cl.numero), cl.id) returning id into lid;
    update mono.collection set hdv = lid where id = cl.id;
    perform mono.op(u, s, jsonb_build_object('k', -tax, 'col', jsonb_build_object(cl.objet, -1)), 'Mis en vente : ' || coalesce(p_name, cl.objet));
  elsif c in ('mt', 'pet') then
    begin it := mono.beast(u, s, d, c, p_uid); exception when raise_exception then return mono.err(sqlerrm); end;
    insert into mono.hdv (saison, monde, seller, cat, key, name, lvl, slot, qty, price, item) values (s, m, u, c, case c when 'mt' then (it ->> 'sp') || ':' || (it ->> 'c') else it ->> 'id' end,
      left(coalesce(p_name, it ->> 'id', it ->> 'sp'), 80), coalesce(p_lvl, 1), case c when 'mt' then it ->> 'sp' else left(p_slot, 20) end, 1, p_price, it);
    opid := mono.op(u, s, jsonb_build_object('k', -tax, case c when 'mt' then 'rmM' else 'rmP' end, jsonb_build_array(p_uid)), 'Mis en vente : ' || coalesce(p_name, c));
    perform mono.sortir(u, s, -p_uid - (case c when 'mt' then 0 else 1000000000 end), c, opid);
  else return mono.err('Catégorie inconnue.');
  end if;
  return jsonb_build_object('ok', true, 'ops', mono.ops_after(u, s, p_after), 'registre', mono.etat(u, s));
end $$;

-- Achat : UNE opération (kamas de l'acheteur et du vendeur, objet, bête, ressources, Éclats ou objet de collection)
create or replace function public.mono_hdv_buy(p_after bigint, p_id bigint, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); d jsonb; L mono.hdv; who text; begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  begin d := mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  if not mono.marche_ouvert(s) then return mono.err('L''hôtel de vente de la saison est fermé.'); end if;
  perform mono.verrou(u);
  select * into L from mono.hdv where id = p_id and saison = s and monde = mono.monde(s) for update;
  if L.id is null or L.status <> 'open' or L.expires_at < now() then return mono.err('Trop tard : quelqu''un l''a déjà acheté ou l''annonce est terminée.'); end if;
  if L.seller = u then return mono.err('C''est ta propre annonce.'); end if;
  if mono.kamas(u, s, d) < L.price then return mono.err('Pas assez de kamas.'); end if;
  update mono.hdv set status = 'sold', buyer = u, closed_at = now() where id = L.id;
  who := coalesce(mono.pseudo(u), 'un joueur');
  perform mono.op(u, s, mono.buyer(L) || jsonb_build_object('k', -L.price), 'Acheté : ' || mono.lbl(L));
  perform mono.op(L.seller, s, jsonb_build_object('k', L.price, 'sold', L.id), 'Vendu à ' || who || ' : ' || mono.lbl(L));
  if L.cat = 'tf' then perform mono.mouvement(u, s, L.qty, 'hdv_achat', 'hdv:' || L.id, 'hdv'); end if;
  if L.cat = 'col' then update mono.collection set user_id = u, hdv = null where id = L.ref; end if;
  if L.cat = 'eq' and L.ref is not null then update mono.objets set owner = u, hdv = null where sn = L.ref; end if;
  insert into mono.ventes (saison, monde, key, cat, name, qty, price, seller, buyer) values (s, L.monde, L.key, L.cat, L.name, L.qty, L.price, L.seller, u);
  if L.monde = 's' then perform mono.payer_defis(L.seller, s); end if; -- défi 6 « Marché des échos », compté par le serveur
  return jsonb_build_object('ok', true, 'ops', mono.ops_after(u, s, p_after), 'registre', mono.etat(u, s));
end $$;

create or replace function public.mono_hdv_cancel(p_after bigint, p_id bigint, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  perform mono.verrou(u);
  if not exists (select 1 from mono.hdv where id = p_id and seller = u and saison = s and status = 'open') or not mono.rendre(p_id, 'Retiré de la vente') then return mono.err('Annonce introuvable ou déjà vendue.'); end if;
  return jsonb_build_object('ok', true, 'ops', mono.ops_after(u, s, p_after), 'registre', mono.etat(u, s));
end $$;

create or replace function public.mono_hdv_reprice(p_after bigint, p_id bigint, p_price bigint, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); d jsonb; L mono.hdv; tax bigint; begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  begin d := mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  perform mono.verrou(u);
  if mono.marche_gele(s) then return mono.err('Fin de saison dans moins de 24 h : les prix ne changent plus.'); end if;
  if p_price is null or p_price < 1 or p_price > 2000000000 then return mono.err('Prix invalide.'); end if;
  select * into L from mono.hdv where id = p_id and seller = u and saison = s and status = 'open' for update;
  if L.id is null then return mono.err('Annonce introuvable ou déjà vendue.'); end if;
  tax := mono.tax(p_price);
  if mono.kamas(u, s, d) < tax then return mono.err('Pas assez de kamas pour la taxe.'); end if;
  update mono.hdv set price = p_price where id = L.id;
  perform mono.op(u, s, jsonb_build_object('k', -tax), 'Nouveau prix : ' || L.name);
  return jsonb_build_object('ok', true, 'ops', mono.ops_after(u, s, p_after));
end $$;

-- lectures (testeurs seulement) : tableau, offres d'une clé, courbe, mes annonces, mes achats
create or replace function public.mono_hdv_market(p_cat text, p_q text, p_slot text, p_keys text[], p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); m text := mono.monde(s); begin
  return (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select jsonb_build_object('key', l.key, 'cat', min(case l.cat when 'tf' then 'res' else l.cat end), 'name', min(l.name), 'lvl', max(l.lvl), 'slot', min(l.slot), 'n', count(*), 'qty', sum(l.qty),
      'unit', round(min(l.price::numeric / l.qty), 2), 'p1', min(l.price) filter (where l.qty = 1), 'p10', min(l.price) filter (where l.qty = 10), 'p100', min(l.price) filter (where l.qty = 100),
      'avg', (select round(sum(v.price)::numeric / nullif(sum(v.qty), 0), 1) from mono.ventes v where v.saison = s and v.monde = m and v.key = l.key and v.at > now() - interval '14 days')) r
    from mono.hdv l where l.saison = s and l.monde = m and l.status = 'open' and l.expires_at > now()
      and (p_keys is null or l.key = any(p_keys)) and (l.cat = p_cat or (p_cat = 'res' and l.cat = 'tf') or ((p_cat is null or p_cat = '') and l.cat <> 'col'))
      and (p_slot is null or p_slot = '' or l.slot = p_slot) and (p_q is null or p_q = '' or l.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
    group by l.key limit 400) x);
end $$;
create or replace function public.mono_hdv_offers(p_key text, p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'qty', qty, 'price', price, 'item', item, 'exp', expires_at, 'mine', seller = u) order by price::numeric / qty, id), '[]'::jsonb)
    from (select * from mono.hdv where saison = s and monde = mono.monde(s) and key = p_key and status = 'open' and expires_at > now() order by price::numeric / qty, id limit 60) x);
end $$;
create or replace function public.mono_hdv_history(p_key text, p_days int, p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); m text := mono.monde(s); begin
  return jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', dd, 'u', uu, 'q', qq) order by dd) from (select date_trunc('day', at)::date dd, round(sum(price)::numeric / sum(qty), 1) uu, sum(qty) qq
      from mono.ventes where saison = s and monde = m and key = p_key and at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 30)) group by 1) z), '[]'::jsonb),
    'avg', (select round(sum(price)::numeric / nullif(sum(qty), 0), 1) from mono.ventes where saison = s and monde = m and key = p_key and at > now() - interval '14 days'),
    'week', (select coalesce(sum(qty), 0) from mono.ventes where saison = s and monde = m and key = p_key and at > now() - interval '7 days'));
end $$;
create or replace function public.mono_hdv_mine(p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  return jsonb_build_object(
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cat', case cat when 'tf' then 'res' else cat end, 'key', key, 'name', name, 'qty', qty, 'price', price, 'item', item, 'exp', expires_at) order by id desc) from mono.hdv where seller = u and saison = s and status = 'open'), '[]'::jsonb),
    'sold', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cat', case cat when 'tf' then 'res' else cat end, 'key', key, 'name', name, 'qty', qty, 'price', price, 'item', item, 'at', closed_at, 'buyer', mono.pseudo(buyer)) order by closed_at desc)
      from (select * from mono.hdv where seller = u and saison = s and status = 'sold' and closed_at > now() - interval '7 days' order by closed_at desc limit 40) z), '[]'::jsonb));
end $$;
create or replace function public.mono_hdv_bought(p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  return (select coalesce(jsonb_agg(jsonb_build_object('cat', case cat when 'tf' then 'res' else cat end, 'key', key, 'name', name, 'qty', qty, 'price', price, 'at', at, 'seller', mono.pseudo(seller)) order by at desc), '[]'::jsonb)
    from (select * from mono.ventes where buyer = u and saison = s and at > now() - interval '7 days' order by at desc limit 40) z);
end $$;

-- ---------- offres d'achat ----------
create or replace function public.mono_hdv_order_new(p_after bigint, p_cat text, p_key text, p_qty int, p_price bigint, p_days int, p_name text, p_lvl int, p_slot text, p_saison int default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); m text; d jsonb; tot numeric; held bigint; c text := p_cat; begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  begin d := mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  perform mono.verrou(u); m := mono.monde(s);
  if mono.marche_gele(s) then return mono.err('Fin de saison dans moins de 24 h : plus de nouvelle offre d''achat.'); end if;
  if c = 'res' and p_key = mono.tf_res() then c := 'tf'; end if;
  if c not in ('res', 'rune', 'cons', 'tf') then return mono.err('Les offres d''achat portent sur les ressources, runes, consommables et Éclats du Temps.'); end if;
  if p_key is null or p_key = '' or mono.bloque(p_key) then return mono.err('Cette ressource ne s''échange pas.'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then return mono.err('Quantité invalide (1 à 100 000).'); end if;
  if p_price is null or p_price < 1 then return mono.err('Prix invalide.'); end if;
  if p_days not in (3, 7, 14) then return mono.err('Durée de 3, 7 ou 14 jours.'); end if;
  tot := p_qty::numeric * p_price;
  if tot > 2000000000 then return mono.err('Offre trop grosse (2 milliards de kamas au maximum).'); end if;
  if (select count(*) from mono.ordres where buyer = u and saison = s and status = 'open') >= 10 then return mono.err('10 offres d''achat à la fois au maximum.'); end if;
  if exists (select 1 from mono.ordres where buyer = u and saison = s and status = 'open' and key = p_key) then return mono.err('Tu as déjà une offre pour cette ressource : retire-la d''abord.'); end if;
  held := tot + mono.otax(tot);
  if mono.kamas(u, s, d) < held then return mono.err('Pas assez de kamas : il faut mettre de côté ' || held || ' kamas.'); end if;
  insert into mono.ordres (saison, monde, buyer, cat, key, name, lvl, slot, qty, price, held, expires_at)
    values (s, m, u, c, p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), p_qty, p_price, held, now() + make_interval(days => p_days));
  perform mono.op(u, s, jsonb_build_object('k', -held), 'Offre d''achat : ' || p_qty || ' × ' || coalesce(p_name, p_key) || ' à ' || p_price || ' l''unité (kamas mis de côté)');
  return jsonb_build_object('ok', true, 'ops', mono.ops_after(u, s, p_after));
end $$;
create or replace function public.mono_hdv_order_cancel(p_after bigint, p_id bigint, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  perform mono.verrou(u);
  if not exists (select 1 from mono.ordres where id = p_id and buyer = u and saison = s and status = 'open') or not mono.ordre_fermer(p_id, 'gone', 'Offre d''achat retirée') then return mono.err('Offre introuvable ou déjà terminée.'); end if;
  return jsonb_build_object('ok', true, 'ops', mono.ops_after(u, s, p_after));
end $$;
-- Vendre à une offre : UNE opération (kamas, ressources ou Éclats du Temps des deux côtés)
create or replace function public.mono_hdv_order_fill(p_after bigint, p_id bigint, p_qty int, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); d jsonb; O mono.ordres; b text; n int; pay bigint; who text; f0 int; begin
  if s is null then return mono.err('Hôtel de vente fermé.'); end if;
  begin d := mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  if not mono.marche_ouvert(s) then return mono.err('L''hôtel de vente de la saison est fermé.'); end if;
  perform mono.verrou(u);
  select * into O from mono.ordres where id = p_id and saison = s for update;
  if O.id is null or O.status <> 'open' or O.expires_at < now() then return mono.err('Trop tard : cette offre est terminée.'); end if;
  if O.buyer = u then return mono.err('C''est ta propre offre.'); end if;
  n := least(coalesce(p_qty, 0), O.qty - O.filled);
  if n < 1 then return mono.err('Quantité invalide.'); end if;
  if O.cat = 'tf' then if mono.solde(u, s) < n then return mono.err('Pas assez d''Éclats du Temps.'); end if;
  else b := mono.bucket(O.cat); if mono.qty(u, s, d, b, O.key) < n then return mono.err('Tu n''en as pas assez (ou ta partie validée n''est pas encore à jour).'); end if; end if;
  pay := n * O.price; who := coalesce(mono.pseudo(u), 'un joueur'); f0 := O.filled;
  update mono.ordres set filled = filled + n where id = O.id returning * into O;
  if O.cat = 'tf' then
    perform mono.mouvement(u, s, -n, 'hdv_vente', 'ord:' || O.id || ':' || f0, 'ordre');
    perform mono.mouvement(O.buyer, s, n, 'hdv_achat', 'ord:' || O.id || ':' || f0, 'ordre');
    perform mono.op(u, s, jsonb_build_object('k', pay, 'tf', -n), 'Vendu à une offre d''achat : ' || n || ' × ' || O.name);
    perform mono.op(O.buyer, s, jsonb_build_object('tf', n, 'got', O.id), 'Offre d''achat : ' || who || ' t''a vendu ' || n || ' × ' || O.name || ' (' || O.filled || ' / ' || O.qty || ')');
  else
    perform mono.op(u, s, jsonb_build_object('k', pay, b, jsonb_build_object(O.key, -n)), 'Vendu à une offre d''achat : ' || n || ' × ' || O.name);
    perform mono.op(O.buyer, s, jsonb_build_object(b, jsonb_build_object(O.key, n), 'got', O.id), 'Offre d''achat : ' || who || ' t''a vendu ' || n || ' × ' || O.name || ' (' || O.filled || ' / ' || O.qty || ')');
  end if;
  insert into mono.ventes (saison, monde, key, cat, name, qty, price, seller, buyer) values (s, O.monde, O.key, O.cat, O.name, n, pay, u, O.buyer);
  if O.filled >= O.qty then perform mono.ordre_fermer(O.id, 'done', 'Offre d''achat complète'); end if;
  return jsonb_build_object('ok', true, 'n', n, 'k', pay, 'ops', mono.ops_after(u, s, p_after), 'registre', mono.etat(u, s));
end $$;
create or replace function public.mono_hdv_orders_list(p_key text, p_q text, p_cat text, p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', case cat when 'tf' then 'res' else cat end, 'key', key, 'name', name, 'lvl', lvl, 'left', qty - filled, 'qty', qty, 'price', price, 'exp', expires_at, 'mine', buyer = u) order by price desc, id), '[]'::jsonb)
    from (select * from mono.ordres where saison = s and monde = mono.monde(s) and status = 'open' and expires_at > now()
      and (p_key is null or p_key = '' or key = p_key) and (p_cat is null or p_cat = '' or cat = p_cat or (p_cat = 'res' and cat = 'tf'))
      and (p_q is null or p_q = '' or name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%') order by price desc, id limit 120) x);
end $$;
create or replace function public.mono_hdv_orders_mine(p_saison int default null) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', case cat when 'tf' then 'res' else cat end, 'key', key, 'name', name, 'qty', qty, 'filled', filled, 'price', price, 'held', held, 'st', status, 'exp', expires_at, 'at', closed_at) order by status <> 'open', coalesce(closed_at, created_at) desc), '[]'::jsonb)
    from (select * from mono.ordres where buyer = u and saison = s and (status = 'open' or closed_at > now() - interval '7 days') order by id desc limit 40) x);
end $$;

-- ---------- échanges directs ----------
-- Offre : { k, items: [uid], mounts: [uid], pets: [uid], res|runes|cons: {nom: n}, tf: n (Éclats du Temps), col: [n° d'objet de collection] }
-- Renvoie ce que l'autre reçoit : { items: [{ uid, it }], mounts: [bête], pets: [bête] }
create or replace function mono.echange_check(u uuid, p_s int, d jsonb, o jsonb) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare oi jsonb := '[]'::jsonb; om jsonb := '[]'::jsonb; op_ jsonb := '[]'::jsonb; x jsonb; b text; e record; begin
  if coalesce((o ->> 'k')::numeric, 0) < 0 or coalesce((o ->> 'tf')::numeric, 0) < 0 then raise exception 'Montant invalide.'; end if;
  if mono.kamas(u, p_s, d) < coalesce((o ->> 'k')::numeric, 0) then raise exception 'Pas assez de kamas.'; end if;
  if mono.solde(u, p_s) < coalesce((o ->> 'tf')::int, 0) then raise exception 'Pas assez d''Éclats du Temps.'; end if;
  for x in select * from jsonb_array_elements(coalesce(o -> 'items', '[]'::jsonb)) loop oi := oi || jsonb_build_array(jsonb_build_object('uid', (x #>> '{}')::bigint, 'it', mono.item(u, p_s, d, (x #>> '{}')::bigint))); end loop;
  for x in select * from jsonb_array_elements(coalesce(o -> 'mounts', '[]'::jsonb)) loop om := om || jsonb_build_array(mono.beast(u, p_s, d, 'mt', (x #>> '{}')::bigint) || '{"b": 1}'::jsonb); end loop;
  for x in select * from jsonb_array_elements(coalesce(o -> 'pets', '[]'::jsonb)) loop op_ := op_ || jsonb_build_array(mono.beast(u, p_s, d, 'pet', (x #>> '{}')::bigint) || '{"b": 1}'::jsonb); end loop;
  for x in select * from jsonb_array_elements(coalesce(o -> 'col', '[]'::jsonb)) loop
    if not exists (select 1 from mono.collection where id = (x #>> '{}')::bigint and user_id = u and saison = p_s and hdv is null) then raise exception 'Objet de collection introuvable.'; end if; end loop;
  foreach b in array array['res', 'runes', 'cons'] loop
    for e in select * from jsonb_each_text(coalesce(o -> b, '{}'::jsonb)) loop
      if e.value !~ '^\d{1,9}$' or e.value::numeric <= 0 then raise exception 'Quantité invalide.'; end if;
      if mono.bloque(e.key) or e.key = mono.tf_res() then raise exception '% ne s''échange pas ainsi.', e.key; end if;
      if mono.qty(u, p_s, d, b, e.key) < e.value::numeric then raise exception 'Pas assez de % (ou ta partie validée n''est pas encore à jour).', e.key; end if;
    end loop;
  end loop;
  return jsonb_build_object('items', oi, 'mounts', om, 'pets', op_);
end $$;
-- ce qu'un joueur donne (négatif) et reçoit, en une seule opération
create or replace function mono.echange_op(mine jsonb, theirs jsonb, recu jsonb) returns jsonb language sql immutable
as $$ select jsonb_strip_nulls(jsonb_build_object(
  'k', coalesce((theirs ->> 'k')::numeric, 0) - coalesce((mine ->> 'k')::numeric, 0),
  'rm', mine -> 'items', 'rmM', mine -> 'mounts', 'rmP', mine -> 'pets',
  'add', case when jsonb_array_length(recu -> 'items') > 0 then (select jsonb_agg(x -> 'it') from jsonb_array_elements(recu -> 'items') x) end,
  'addM', case when jsonb_array_length(recu -> 'mounts') > 0 then recu -> 'mounts' end, 'addP', case when jsonb_array_length(recu -> 'pets') > 0 then recu -> 'pets' end,
  'tf', nullif(coalesce((theirs ->> 'tf')::int, 0) - coalesce((mine ->> 'tf')::int, 0), 0),
  'res', (select jsonb_object_agg(key, v) from (select key, sum(v) v from (select key, -value::numeric v from jsonb_each_text(coalesce(mine -> 'res', '{}')) union all select key, value::numeric from jsonb_each_text(coalesce(theirs -> 'res', '{}'))) a group by key) z),
  'runes', (select jsonb_object_agg(key, v) from (select key, sum(v) v from (select key, -value::numeric v from jsonb_each_text(coalesce(mine -> 'runes', '{}')) union all select key, value::numeric from jsonb_each_text(coalesce(theirs -> 'runes', '{}'))) a group by key) z),
  'cons', (select jsonb_object_agg(key, v) from (select key, sum(v) v from (select key, -value::numeric v from jsonb_each_text(coalesce(mine -> 'cons', '{}')) union all select key, value::numeric from jsonb_each_text(coalesce(theirs -> 'cons', '{}'))) a group by key) z))) $$;

create or replace function public.mono_trade_start(p_pseudo text, p_saison int default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_de(p_saison); v uuid; i bigint; begin
  if s is null then return mono.err('Échanges fermés.'); end if;
  begin perform mono.base(u, s); exception when raise_exception then return mono.err(sqlerrm); end;
  if mono.marche_gele(s) then return mono.err('Fin de saison dans moins de 24 h : plus de nouvel échange.'); end if;
  select id into v from public.profiles where lower(pseudo) = lower(btrim(p_pseudo));
  if v is null or not mono.acces(v) then return mono.err('Joueur introuvable sur le serveur Monocompte.'); end if;
  if v = u then return mono.err('Tu ne peux pas échanger avec toi-même.'); end if;
  if mono.monde(s) = 's' and not exists (select 1 from mono.parties_ok where user_id = v and saison = s) then return mono.err('Ce joueur n''a pas encore de héros validé cette saison.'); end if;
  if mono.monde(s) = 'e' and not exists (select 1 from mono.eternel where user_id = v and saison = s) then return mono.err('Ce joueur n''a pas de héros de cette saison dans l''Éternel.'); end if;
  update mono.echanges set status = 'cancel', note = 'annulé', updated_at = now() where status = 'open' and (a = u or b = u);
  insert into mono.echanges (saison, monde, a, b) values (s, mono.monde(s), u, v) returning id into i;
  return jsonb_build_object('ok', true, 'id', i);
end $$;
create or replace function public.mono_trade_state() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  return coalesce((select jsonb_build_object('id', t.id, 'me', case when t.a = u then 'a' else 'b' end, 'pa', mono.pseudo(t.a), 'pb', mono.pseudo(t.b),
      'oa', t.offer_a, 'ob', t.offer_b, 'ka', t.ok_a, 'kb', t.ok_b, 'ver', t.ver, 'st', t.status, 'note', t.note, 'saison', t.saison, 'monde', t.monde,
      'ia', (select coalesce(jsonb_agg(jsonb_build_object('uid', x, 'it', (k.data::jsonb) -> 'items' -> (x #>> '{}'))), '[]'::jsonb) from mono.parties_ok k, jsonb_array_elements(coalesce(t.offer_a -> 'items', '[]')) x where k.user_id = t.a and k.saison = t.saison),
      'ib', (select coalesce(jsonb_agg(jsonb_build_object('uid', x, 'it', (k.data::jsonb) -> 'items' -> (x #>> '{}'))), '[]'::jsonb) from mono.parties_ok k, jsonb_array_elements(coalesce(t.offer_b -> 'items', '[]')) x where k.user_id = t.b and k.saison = t.saison),
      'ma', '[]'::jsonb, 'mb', '[]'::jsonb, 'fa', '[]'::jsonb, 'fb', '[]'::jsonb)
    from mono.echanges t where (t.a = u or t.b = u) and (t.status = 'open' and t.updated_at > now() - interval '15 minutes' or t.updated_at > now() - interval '20 seconds')
    order by t.id desc limit 1), 'null'::jsonb);
end $$;
create or replace function public.mono_trade_offer(p_id bigint, p_offer jsonb) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); t mono.echanges; o jsonb; r jsonb; tf int; begin
  select * into t from mono.echanges where id = p_id and status = 'open' and (a = u or b = u) for update;
  if t.id is null then return mono.err('Échange terminé.'); end if;
  r := coalesce(p_offer -> 'res', '{}'::jsonb); tf := greatest(0, coalesce(case when (p_offer ->> 'tf') ~ '^\d{1,9}$' then (p_offer ->> 'tf')::int end, 0));
  if r ? mono.tf_res() then tf := tf + greatest(0, coalesce(case when (r ->> mono.tf_res()) ~ '^\d{1,9}$' then (r ->> mono.tf_res())::int end, 0)); r := r - mono.tf_res(); end if; -- Éclats posés comme une ressource du sac
  o := jsonb_strip_nulls(jsonb_build_object('k', greatest(0, coalesce(case when (p_offer ->> 'k') ~ '^\d{1,15}$' then (p_offer ->> 'k')::bigint end, 0)), 'items', mono.uniq(p_offer -> 'items'),
    'mounts', mono.uniq(p_offer -> 'mounts'), 'pets', mono.uniq(p_offer -> 'pets'), 'col', mono.uniq(p_offer -> 'col'), 'tf', nullif(tf, 0),
    'res', nullif(r, '{}'::jsonb), 'runes', p_offer -> 'runes', 'cons', p_offer -> 'cons'));
  if jsonb_array_length(coalesce(o -> 'items', '[]')) + jsonb_array_length(coalesce(o -> 'mounts', '[]')) + jsonb_array_length(coalesce(o -> 'pets', '[]')) + jsonb_array_length(coalesce(o -> 'col', '[]')) > 12 then return mono.err('12 objets et bêtes au maximum.'); end if;
  if t.a = u then update mono.echanges set offer_a = o, ok_a = false, ok_b = false, ver = ver + 1, updated_at = now() where id = t.id;
  else update mono.echanges set offer_b = o, ok_a = false, ok_b = false, ver = ver + 1, updated_at = now() where id = t.id; end if;
  return jsonb_build_object('ok', true);
end $$;
-- Les deux ont validé : UN échange (kamas, objets, bêtes, ressources, Éclats du Temps et objets de collection des deux côtés)
-- dans une seule transaction : coupé au milieu, rien n'a bougé.
create or replace function public.mono_trade_ok(p_id bigint, p_ver int, p_after bigint) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); t mono.echanges; da jsonb; db jsonb; ia jsonb; ib jsonb; x jsonb; oa bigint; ob bigint; s int; begin
  select * into t from mono.echanges where id = p_id and status = 'open' and (a = u or b = u) for update;
  if t.id is null then return mono.err('Échange terminé.'); end if;
  s := t.saison;
  if t.ver <> p_ver then return mono.err('L''offre vient de changer : vérifie-la avant de valider.'); end if;
  if not mono.marche_ouvert(s) then update mono.echanges set status = 'cancel', note = 'fin de saison' where id = t.id; return mono.err('Les échanges de la saison sont fermés.'); end if;
  if t.a = u then update mono.echanges set ok_a = true, updated_at = now() where id = t.id returning * into t;
  else update mono.echanges set ok_b = true, updated_at = now() where id = t.id returning * into t; end if;
  if not (t.ok_a and t.ok_b) then return jsonb_build_object('ok', true, 'wait', true); end if;
  perform mono.verrou(least(t.a::text, t.b::text)::uuid); perform mono.verrou(greatest(t.a::text, t.b::text)::uuid);
  if exists (select 1 from mono.ops o where o.user_id in (t.a, t.b) and o.saison = s and o.txt like 'Échange avec %' and o.at > now() - interval '1 minute') then
    update mono.echanges set ok_a = false, ok_b = false where id = t.id; return mono.err('Un échange par minute au maximum : réessaie dans un instant.'); end if;
  begin
    da := mono.base(t.a, s); db := mono.base(t.b, s);
    ia := mono.echange_check(t.a, s, da, t.offer_a); ib := mono.echange_check(t.b, s, db, t.offer_b);
  exception when raise_exception then
    update mono.echanges set ok_a = false, ok_b = false where id = t.id;
    return mono.err(sqlerrm);
  end;
  -- numéros des objets donnés (premier échange : le serveur leur en donne un), puis le nouveau propriétaire
  ia := jsonb_set(ia, '{items}', coalesce((select jsonb_agg(jsonb_build_object('uid', y -> 'uid', 'it', mono.numero(s, y -> 'it', t.a))) from jsonb_array_elements(ia -> 'items') y), '[]'::jsonb));
  ib := jsonb_set(ib, '{items}', coalesce((select jsonb_agg(jsonb_build_object('uid', y -> 'uid', 'it', mono.numero(s, y -> 'it', t.b))) from jsonb_array_elements(ib -> 'items') y), '[]'::jsonb));
  oa := mono.op(t.a, s, mono.echange_op(t.offer_a, t.offer_b, ib) || case when t.offer_b ? 'col' or t.offer_a ? 'col' then jsonb_build_object('col', '{}'::jsonb) else '{}'::jsonb end, 'Échange avec ' || coalesce(mono.pseudo(t.b), 'un joueur'));
  ob := mono.op(t.b, s, mono.echange_op(t.offer_b, t.offer_a, ia) || case when t.offer_b ? 'col' or t.offer_a ? 'col' then jsonb_build_object('col', '{}'::jsonb) else '{}'::jsonb end, 'Échange avec ' || coalesce(mono.pseudo(t.a), 'un joueur'));
  for x in select * from jsonb_array_elements(ia -> 'items') loop update mono.objets set owner = t.b where sn = (x -> 'it' ->> 'sn')::bigint; perform mono.sortir(t.a, s, (x ->> 'uid')::bigint, x -> 'it' ->> 'tpl', oa, (x -> 'it' ->> 'sn')::bigint); end loop;
  for x in select * from jsonb_array_elements(ib -> 'items') loop update mono.objets set owner = t.a where sn = (x -> 'it' ->> 'sn')::bigint; perform mono.sortir(t.b, s, (x ->> 'uid')::bigint, x -> 'it' ->> 'tpl', ob, (x -> 'it' ->> 'sn')::bigint); end loop;
  for x in select * from jsonb_array_elements(coalesce(t.offer_a -> 'mounts', '[]')) loop perform mono.sortir(t.a, s, -(x #>> '{}')::bigint, 'mt', oa); end loop;
  for x in select * from jsonb_array_elements(coalesce(t.offer_b -> 'mounts', '[]')) loop perform mono.sortir(t.b, s, -(x #>> '{}')::bigint, 'mt', ob); end loop;
  for x in select * from jsonb_array_elements(coalesce(t.offer_a -> 'pets', '[]')) loop perform mono.sortir(t.a, s, -(x #>> '{}')::bigint - 1000000000, 'pet', oa); end loop;
  for x in select * from jsonb_array_elements(coalesce(t.offer_b -> 'pets', '[]')) loop perform mono.sortir(t.b, s, -(x #>> '{}')::bigint - 1000000000, 'pet', ob); end loop;
  if coalesce((t.offer_a ->> 'tf')::int, 0) > 0 then perform mono.mouvement(t.a, s, -(t.offer_a ->> 'tf')::int, 'echange_envoi', 'ech:' || t.id || ':a', 'echange'); perform mono.mouvement(t.b, s, (t.offer_a ->> 'tf')::int, 'echange_recu', 'ech:' || t.id || ':a', 'echange'); end if;
  if coalesce((t.offer_b ->> 'tf')::int, 0) > 0 then perform mono.mouvement(t.b, s, -(t.offer_b ->> 'tf')::int, 'echange_envoi', 'ech:' || t.id || ':b', 'echange'); perform mono.mouvement(t.a, s, (t.offer_b ->> 'tf')::int, 'echange_recu', 'ech:' || t.id || ':b', 'echange'); end if;
  update mono.collection set user_id = t.b where id in (select (y #>> '{}')::bigint from jsonb_array_elements(coalesce(t.offer_a -> 'col', '[]')) y) and user_id = t.a and hdv is null;
  update mono.collection set user_id = t.a where id in (select (y #>> '{}')::bigint from jsonb_array_elements(coalesce(t.offer_b -> 'col', '[]')) y) and user_id = t.b and hdv is null;
  update mono.echanges set status = 'done', note = 'fait', updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'done', true, 'ops', mono.ops_after(u, s, p_after), 'registre', mono.etat(u, s));
end $$;
create or replace function public.mono_trade_cancel(p_id bigint) returns void language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  update mono.echanges set status = 'cancel', note = 'annulé par ' || coalesce(mono.pseudo(u), 'un joueur'), updated_at = now() where id = p_id and status = 'open' and (a = u or b = u);
end $$;

-- ---------- 6c : clôture du marché de la saison (atomique par lot, reprenable) ----------
-- Chaque annonce et chaque offre d'achat ouverte est rendue UNE seule fois (mono.rendre et mono.ordre_fermer ne ferment
-- qu'une ligne encore ouverte, dans la même transaction que ce qu'elles rendent) ; les échanges en cours sont annulés.
-- Une coupure au milieu d'un lot annule le lot entier ; relancée, la clôture reprend où elle en était.
create or replace function mono.cloture_marche(p_s int, p_lot int) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare i bigint; n int := 0; o int := 0; reste int; begin
  for i in select id from mono.hdv where saison = p_s and monde = 's' and status = 'open' order by id limit greatest(1, p_lot) loop
    if mono.rendre(i, 'Fin de saison : annonce fermée') then n := n + 1; end if;
  end loop;
  for i in select id from mono.ordres where saison = p_s and monde = 's' and status = 'open' order by id limit greatest(0, greatest(1, p_lot) - n) loop
    if mono.ordre_fermer(i, 'gone', 'Fin de saison : offre d''achat fermée') then o := o + 1; end if;
  end loop;
  update mono.echanges set status = 'cancel', note = 'fin de saison', updated_at = now() where saison = p_s and monde = 's' and status = 'open';
  select (select count(*) from mono.hdv where saison = p_s and monde = 's' and status = 'open') + (select count(*) from mono.ordres where saison = p_s and monde = 's' and status = 'open') into reste;
  return jsonb_build_object('annonces', n, 'ordres', o, 'reste', reste);
end $$;

-- ============================================================================
-- Fonction serveur « mono » (supabase/functions/mono, rôle service_role seulement) : Bouclier Monocompte
-- ============================================================================
-- Envoi de la partie d'un compte (même logique que mono_push), suivi par la fonction de la vérification du Bouclier.
create or replace function public.mono_srv_push(p_user uuid, p_data text, p_meta jsonb, p_version text, p_device text, p_expected text, p_force boolean default false)
returns text language plpgsql security definer set search_path = mono, public
as $$ begin
  if not mono.acces(p_user) then raise exception 'espace Monocompte réservé aux testeurs'; end if;
  return mono.push(p_user, p_data, p_meta, p_version, p_device, p_expected, p_force);
end $$;
-- Tout ce que le Bouclier lit pour un compte : saison (début, date de saison), partie envoyée, dernière partie validée,
-- registre des Éclats (solde, générés, plus haut solde de la saison), objets numérotés, objets sortis, opérations du serveur
create or replace function public.mono_srv_etat(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); k mono.parties_ok; op0 bigint; begin
  if s is null then return mono.err('saison Monocompte fermée'); end if;
  if not mono.acces(p_user) then return mono.err('espace Monocompte réservé aux testeurs'); end if;
  select * into k from mono.parties_ok where user_id = p_user and saison = s;
  op0 := coalesce(case when (k.bilan ->> 'op') ~ '^\d{1,15}$' then (k.bilan ->> 'op')::bigint end, 0);
  return jsonb_build_object(
    'admin', exists (select 1 from public.admins where user_id = p_user), 'susp', public.susp(p_user),
    'saison', (select jsonb_build_object('id', x.id, 'debut', round(extract(epoch from x.debut) * 1000), 'date', round(extract(epoch from mono.date_saison(x.id)) * 1000), 'test', x.test) from mono.saisons x where x.id = s),
    'partie', (select jsonb_build_object('data', p.data, 'at', to_char(p.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'ms', round(extract(epoch from p.updated_at) * 1000)) from mono.parties p where p.user_id = p_user and p.saison = s),
    'ok', case when k.user_id is null then null else jsonb_build_object('bilan', k.bilan, 'res', k.res, 'accept', k.accept, 'src_at', to_char(k.src_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'src_ms', round(extract(epoch from k.src_at) * 1000)) end,
    'reg', jsonb_build_object('solde', mono.solde(p_user, s), 'genere', mono.genere(p_user, s),
      'max', (select coalesce(max(c), 0) from (select sum(n) over (order by id) c from mono.eclats where user_id = p_user and saison = s) z)),
    'objets', coalesce((select jsonb_object_agg(sn::text, op) from mono.sortis where user_id = p_user and saison = s and sn is not null), '{}'::jsonb)
      || coalesce((select jsonb_object_agg(sn::text, true) from mono.objets where owner = p_user and saison = s), '{}'::jsonb),
    'sortis', coalesce((select jsonb_agg(jsonb_build_object('uid', uid, 'tpl', tpl, 'op', op)) from mono.sortis where user_id = p_user and saison = s and uid > 0), '[]'::jsonb),
    'ops', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'p', payload) order by id) from (select * from mono.ops where user_id = p_user and saison = s and id > op0 order by id limit 2000) z), '[]'::jsonb));
end $$;
-- Partie acceptée : elle devient la partie validée (seulement si c'est bien celle qui a été vérifiée), puis bons de butin,
-- défis atteints, et mono.apres_validation (classements de saison…)
create or replace function public.mono_srv_valider(p_user uuid, p_src_at text, p_resume jsonb, p_bilan jsonb, p_res numeric, p_acts jsonb) returns jsonb
language plpgsql security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); p mono.parties; g int; d int; begin
  if s is null then return mono.err('saison Monocompte fermée'); end if;
  perform mono.verrou(p_user);
  select * into p from mono.parties where user_id = p_user and saison = s;
  if p.user_id is null or p.updated_at <> p_src_at::timestamptz then return mono.err('partie changée pendant la vérification'); end if;
  insert into mono.parties_ok (user_id, saison, data, resume, bilan, res, src_at, accept, at) values (p_user, s, p.data, coalesce(p_resume, '{}'), coalesce(p_bilan, '{}'), p_res, p.updated_at, false, now())
    on conflict (user_id, saison) do update set data = excluded.data, resume = excluded.resume, bilan = excluded.bilan, res = excluded.res, src_at = excluded.src_at, accept = false, at = excluded.at;
  g := case when mono.saison_en_jeu(s) then mono.bons_partie(p_user, s, p_acts) else 0 end;
  d := mono.payer_defis(p_user, s);
  perform mono.apres_validation(p_user, s, coalesce(p_resume, '{}'));
  return mono.etat(p_user, s) || jsonb_build_object('ok', true, 'bons', g, 'payes', d);
end $$;
-- Partie refusée : notée pour le panel (une fois par heure pour la même raison) ; la partie validée ne change pas
create or replace function public.mono_srv_refus(p_user uuid, p_why text) returns void language plpgsql security definer set search_path = mono, public
as $$ declare s int := mono.saison_ouverte(); begin
  if s is null then return; end if;
  if exists (select 1 from mono.bouclier where user_id = p_user and saison = s and why = left(p_why, 300) and at > now() - interval '1 hour') then
    update mono.bouclier set at = now() where id = (select max(id) from mono.bouclier where user_id = p_user and saison = s and why = left(p_why, 300)); return; end if;
  insert into mono.bouclier (user_id, saison, why) values (p_user, s, left(p_why, 300));
end $$;
-- Panel : refus du Bouclier ; « C'est bon » de Mathis (la prochaine partie passe le contrôle des gains, jamais celui de l'impossible)
create or replace function public.mono_adm_bouclier() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('user', b.user_id, 'pseudo', mono.pseudo(b.user_id), 'saison', b.saison, 'why', b.why, 'at', b.at) order by b.at desc), '[]'::jsonb) from (select * from mono.bouclier order by at desc limit 100) b);
end $$;
create or replace function public.mono_adm_accepter(p_user uuid) returns text language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  update mono.parties_ok set accept = true where user_id = p_user and saison = mono.saison_ouverte();
  if not found then return 'Pas de partie validée cette saison.'; end if;
  delete from mono.bouclier where user_id = p_user and saison = mono.saison_ouverte();
  return null;
end $$;

-- ---------- droits d'appel ----------
-- fonctions internes : personne (seul le propriétaire, via les fonctions ci-dessus)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'mono' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (p.proname like 'mono\_%' or p.proname = 'cosm_mine') and p.proname not like 'mono\_srv\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  -- fonctions du Bouclier (mono_srv_*) : la fonction serveur « mono » seulement (rôle service_role)
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'mono\_srv\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;
