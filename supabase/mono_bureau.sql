-- ============================================================================
-- Idlus — Bureau des Aventuriers du serveur Monocompte : groupes en direct (salons, recherche, invitations, combat de groupe
-- calculé par le serveur, butin), expéditions programmées, rendez-vous communautaires.
-- Cahier des charges : maquette validée du Bureau (19/10) et plan directeur, section 5.5 (choix 1B 2A 3A 4A 5A 6A 7A 8C 9B 10A 11A).
-- DÉPLOIEMENT MANUEL SEULEMENT (même règle que monocompte.sql : jamais dans le workflow). Relançable sans danger.
-- ORDRE DE CHARGEMENT DU MONOCOMPTE (unique, à la main, chaque fichier relançable sans danger) :
--   1. supabase/monocompte.sql   espace mono, Bouclier, défis ; crée mono.apres_validation, mono.etat_social et
--                                mono.defi_d12 VIDES seulement s'ils n'existent pas (le relancer n'efface rien d'après) ;
--   2. supabase/amis.sql         amis (Classique et Monocompte), blocage = public.ignores (chat.sql) ;
--   3. supabase/mono_social.sql  redéfinit mono.apres_validation (classements, Couronne, renfort) et mono.etat_social ;
--   4. supabase/mono_bureau.sql  Bureau des Aventuriers ; redéfinit mono.defi_d12 (défi 12) ; lit les amis et le blocage.
-- Aucune fonction n'est définie avec un vrai corps dans deux fichiers : chaque crochet a un seul propriétaire
-- (vérifié par tests/bureau_sql.test.js, qui charge les quatre fichiers dans cet ordre puis relance monocompte.sql).
-- Ici (4) : mono.defi_d12 (défi 12) ; s'appuie sur public.amis_sont et public.amis_bloque (amis.sql) : invitation directe
-- réservée aux amis acceptés non bloqués, salon refusé au joueur bloqué par un membre ; copies de renfort refusées en groupe.
--
-- Principes :
--   - toutes les tables dans le schéma « mono » (invisible de l'API) ; seules entrées : les fonctions mono_bureau_* (joueurs),
--     mono_adm_bureau* (Mathis) et mono_srv_bureau_* (fonction serveur « mono », rôle service_role) ;
--   - chaque action verrouille la ligne du salon (ou de l'invitation, du combat) qu'elle change : deux joueurs ne prennent
--     jamais la même place, un salon ne lance jamais deux combats ;
--   - le combat de groupe est calculé par la fonction serveur « mono » (route { bureau: { combat } }) avec les PHOTOS des
--     héros construites depuis mono.parties_ok (la dernière partie validée par le Bouclier), jamais envoyées par le jeu ;
--     graine tirée par la base ; résultat enregistré ; un butin par joueur, récupéré une seule fois ;
--   - toutes les heures sont celles du serveur ; les créneaux de rendez-vous sont en heure de Paris ;
--   - pas encore d'horloge du serveur (planificateur) : l'entretien (invitations expirées, places gardées, transitions,
--     ouverture des expéditions, grâce…) se fait à chaque appel (mono.bureau_menage). mono_srv_bureau_horloge() est prête
--     pour le planificateur, qui attend l'accord de Mathis (« installe l'horloge du serveur ») ;
--   - créneaux de rendez-vous (12 h 30, 18 h 30, 20 h 30) et messages privés Discord : en réglage, DÉSACTIVÉS par défaut.
-- ============================================================================

-- ---------- réglages (Mathis, panneau) ----------
create table if not exists mono.bureau_reglages (cle text primary key, v jsonb not null, at timestamptz not null default now());
insert into mono.bureau_reglages (cle, v) values
  ('invit_s', '60'), ('place_s', '120'), ('deco_s', '20'), ('transition_s', '60'), ('grace_s', '300'), ('ouverture_min', '10'),
  ('attente_s', '120'), ('calcul_s', '60'), ('annonces', '2'), ('jours', '7'), ('inscriptions', '3'), ('liste_attente', '2'),
  ('rdv', 'false'), ('rdv_min', '60'), ('mp', 'false'), ('suspects_n', '6')
  on conflict (cle) do nothing;

-- ---------- recherche « Jouer maintenant » ----------
create table if not exists mono.bureau_recherches (
  user_id uuid primary key references auth.users (id) on delete cascade,
  saison int not null,
  donjons text[] not null,
  stasis int not null check (stasis between 1 and 15),
  flex int not null default 0 check (flex between 0 and 2),
  auto boolean not null default true,
  version text,
  depuis timestamptz not null default now(),
  at timestamptz not null default now()
);

-- ---------- salons ----------
-- etat : invitation (salon automatique en attente des réponses), ouvert, transition (60 s avant le combat), combat, ferme
create table if not exists mono.bureau_salons (
  id bigint generated always as identity primary key,
  saison int not null,
  etat text not null default 'ouvert' check (etat in ('invitation', 'ouvert', 'transition', 'combat', 'ferme')),
  chef uuid references auth.users (id) on delete set null,
  did text, stasis int check (stasis between 1 and 15), cle text,
  public boolean not null default true,
  remplacants boolean not null default true,
  version text,
  expedition bigint,
  h_fait boolean not null default false, grace_fait boolean not null default false,
  seq int not null default 0,
  motif text,
  created_at timestamptz not null default now(), maj_at timestamptz not null default now(), ferme_at timestamptz
);
create index if not exists bureau_salons_ouverts on mono.bureau_salons (saison, etat) where etat <> 'ferme';
-- une seule place par compte (index unique sur user_id) ; vu_at : dernier signe de vie (null = pas encore venu, expédition)
create table if not exists mono.bureau_membres (
  salon bigint not null references mono.bureau_salons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  arrive_at timestamptz not null default now(),
  vu_at timestamptz,
  pret boolean not null default false,
  version text,
  onglet text,
  smin int, smax int,
  primary key (salon, user_id)
);
create unique index if not exists bureau_une_place on mono.bureau_membres (user_id);

-- ---------- invitations (60 s) ----------
create table if not exists mono.bureau_invitations (
  id bigint generated always as identity primary key,
  salon bigint not null references mono.bureau_salons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  par uuid,                 -- null : rencontre automatique (ou liste d'attente d'une expédition)
  quoi text not null default 'auto' check (quoi in ('auto', 'ami', 'remplacant', 'attente')),
  recherche jsonb,          -- la recherche du joueur, rendue s'il est le seul à accepter
  etat text not null default 'attente' check (etat in ('attente', 'oui', 'non', 'expiree', 'annulee')),
  expire_at timestamptz not null,
  at timestamptz not null default now()
);
create index if not exists bureau_invit_user on mono.bureau_invitations (user_id, etat);
create index if not exists bureau_invit_salon on mono.bureau_invitations (salon, etat);

-- ---------- combats de groupe ----------
-- etat : transition (chacun confirme en 60 s), calcul (la fonction serveur joue le combat), fini, annule
create table if not exists mono.bureau_combats (
  id bigint generated always as identity primary key,
  salon bigint not null references mono.bureau_salons (id) on delete cascade,
  saison int not null,
  did text not null, stasis int not null,
  seed bigint not null,
  etat text not null default 'transition' check (etat in ('transition', 'calcul', 'fini', 'annule')),
  lance_par uuid,
  lance_at timestamptz not null default now(),
  transition_fin timestamptz not null,
  calc_at timestamptz,
  debut_at timestamptz, fin_at timestamptz, duree_ms int,
  win boolean,
  manche int,
  snaps text, result text,       -- texte (ordre des clés gardé) : le jeu rejoue exactement les mêmes photos
  motif text
);
create unique index if not exists bureau_un_combat on mono.bureau_combats (salon) where etat in ('transition', 'calcul');
create table if not exists mono.bureau_combat_membres (
  combat bigint not null references mono.bureau_combats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  confirme_at timestamptz,
  primary key (combat, user_id)
);
create index if not exists bureau_cm_user on mono.bureau_combat_membres (user_id);
-- butin : un par combat et par joueur (son numéro), récupéré une seule fois
create table if not exists mono.bureau_butins (
  combat bigint not null references mono.bureau_combats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pris_at timestamptz,
  primary key (combat, user_id)
);

-- ---------- journal et discussion du salon (7A : chat libre, modération du chat actuel) ----------
create table if not exists mono.bureau_journal (
  id bigint generated always as identity primary key, salon bigint not null references mono.bureau_salons (id) on delete cascade,
  txt text not null, at timestamptz not null default now());
create index if not exists bureau_journal_salon on mono.bureau_journal (salon, id);
create table if not exists mono.bureau_msgs (
  id bigint generated always as identity primary key, salon bigint not null references mono.bureau_salons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade, body text not null check (length(body) between 1 and 200),
  at timestamptz not null default now());
create index if not exists bureau_msgs_salon on mono.bureau_msgs (salon, id);

-- ---------- expéditions programmées (10A : 2 annonces, 7 jours, 3 inscriptions, 2 places d'attente) ----------
create table if not exists mono.bureau_expeditions (
  id bigint generated always as identity primary key,
  saison int not null,
  org uuid not null references auth.users (id) on delete cascade,
  did text not null, stasis int not null check (stasis between 1 and 15),
  heure timestamptz not null,
  places int not null check (places between 2 and 4),
  note text check (length(note) <= 120),
  etat text not null default 'annoncee' check (etat in ('annoncee', 'ouverte', 'partie', 'annulee', 'vide')),
  salon bigint,
  motif text,
  created_at timestamptz not null default now()
);
create index if not exists bureau_exp_heure on mono.bureau_expeditions (saison, etat, heure);
create table if not exists mono.bureau_inscriptions (
  expedition bigint not null references mono.bureau_expeditions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attente boolean not null default false,
  at timestamptz not null default clock_timestamp(),
  primary key (expedition, user_id)
);

-- ---------- rendez-vous communautaires (11A : créneaux dans le panneau, heure de Paris, désactivés avant validation) ----------
create table if not exists mono.bureau_creneaux (
  id int primary key, heure time not null, nom text not null, actif boolean not null default false
);
insert into mono.bureau_creneaux (id, heure, nom, actif) values (1, '12:30', 'Rendez-vous de midi', false), (2, '18:30', 'Rendez-vous du soir', false),
  (3, '20:30', 'Rendez-vous d''avant le Boss de saison', false) on conflict (id) do nothing;
create table if not exists mono.bureau_intentions (
  creneau int not null references mono.bureau_creneaux (id) on delete cascade, jour date not null,
  user_id uuid not null references auth.users (id) on delete cascade, at timestamptz not null default now(),
  primary key (creneau, jour, user_id)
);

-- ---------- appareils (5A : identifiant gardé par le jeu + compte Discord ; décision finale de Mathis) ----------
create table if not exists mono.bureau_appareils (
  user_id uuid not null references auth.users (id) on delete cascade, appareil text not null check (length(appareil) between 8 and 64),
  at timestamptz not null default now(), primary key (user_id, appareil));
create index if not exists bureau_appareils_app on mono.bureau_appareils (appareil);
-- paires autorisées par Mathis malgré un appareil commun (famille, colocation…)
create table if not exists mono.bureau_paires_ok (a uuid not null, b uuid not null, at timestamptz not null default now(), primary key (a, b));

-- ---------- préférences et messages privés Discord (9B, préparés mais désactivés : réglage « mp ») ----------
create table if not exists mono.bureau_prefs (user_id uuid primary key references auth.users (id) on delete cascade, mp boolean not null default false);
create table if not exists mono.bureau_mp (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users (id) on delete cascade,
  txt text not null, at timestamptz not null default now(), envoye_at timestamptz);

-- ---------- photo de la progression (cache, recalculé quand la partie validée change) ----------
create table if not exists mono.bureau_heros (
  user_id uuid not null, saison int not null, src_at timestamptz, stasis jsonb not null default '{}'::jsonb, primary key (user_id, saison));

do $$ declare t text; begin
  foreach t in array array['bureau_reglages', 'bureau_recherches', 'bureau_salons', 'bureau_membres', 'bureau_invitations', 'bureau_combats', 'bureau_combat_membres',
      'bureau_butins', 'bureau_journal', 'bureau_msgs', 'bureau_expeditions', 'bureau_inscriptions', 'bureau_creneaux', 'bureau_intentions', 'bureau_appareils',
      'bureau_paires_ok', 'bureau_prefs', 'bureau_mp', 'bureau_heros'] loop
    execute format('alter table mono.%I enable row level security', t);
    execute format('revoke all on mono.%I from public, anon, authenticated', t); -- aucune lecture ni écriture directe : seulement les fonctions
  end loop;
end $$;

-- ============================================================================
-- Outils internes (schéma mono)
-- ============================================================================
create or replace function mono.bcfg(c text) returns jsonb language sql stable security definer set search_path = mono, public
as $$ select v from mono.bureau_reglages where cle = c $$;
create or replace function mono.bn(c text) returns numeric language sql stable security definer set search_path = mono, public
as $$ select coalesce((select (v #>> '{}')::numeric from mono.bureau_reglages where cle = c and jsonb_typeof(v) = 'number'), 0) $$;
create or replace function mono.bon_(c text) returns boolean language sql stable security definer set search_path = mono, public
as $$ select coalesce((select v = 'true'::jsonb from mono.bureau_reglages where cle = c), false) $$;
create or replace function mono.bsec(c text) returns interval language sql stable security definer set search_path = mono, public
as $$ select make_interval(secs => mono.bn(c)::double precision) $$;

-- saison où l'on joue (ouverte, entre le jour 1 et le jour 56), sinon null
create or replace function mono.bureau_saison() returns int language sql stable security definer set search_path = mono, public
as $$ select s from (select mono.saison_ouverte() s) x where s is not null and mono.saison_en_jeu(s) $$;

-- Pourquoi ce compte ne peut ni chercher, ni rejoindre, ni s'inscrire (null : il peut)
create or replace function mono.bureau_bloque(u uuid, p_s int) returns text language plpgsql security definer set search_path = mono, public
as $$ declare k mono.parties_ok%rowtype; begin
  if p_s is null then return 'La saison Monocompte est fermée.'; end if;
  if public.susp(u) then return 'Compte suspendu.'; end if;
  select * into k from mono.parties_ok where user_id = u and saison = p_s;
  if k.user_id is null then return 'Ton héros n''est pas encore validé par le serveur : attends quelques secondes.'; end if;
  if exists (select 1 from mono.bouclier b where b.user_id = u and b.saison = p_s and b.at > k.at) then return 'Ta partie est en vérification : le Bureau attend la décision.'; end if;
  return null;
end $$;

-- stasis les plus hautes réussies (cache de la partie validée)
create or replace function mono.bureau_smax(u uuid, p_s int, p_did text) returns int language plpgsql security definer set search_path = mono, public
as $$ declare k mono.parties_ok%rowtype; h mono.bureau_heros%rowtype; st jsonb; begin
  select * into k from mono.parties_ok where user_id = u and saison = p_s;
  if k.user_id is null then return 0; end if;
  select * into h from mono.bureau_heros where user_id = u and saison = p_s;
  if h.user_id is null or h.src_at is distinct from k.src_at then
    begin st := coalesce((select jsonb_object_agg(key, coalesce(case when (value ->> 'max') ~ '^\d{1,2}$' then (value ->> 'max')::int end, 0))
      from jsonb_each(case when jsonb_typeof(k.data::jsonb -> 'stasis') = 'object' then k.data::jsonb -> 'stasis' else '{}'::jsonb end)), '{}'::jsonb);
    exception when others then st := '{}'::jsonb; end;
    insert into mono.bureau_heros (user_id, saison, src_at, stasis) values (u, p_s, k.src_at, st)
      on conflict (user_id, saison) do update set src_at = excluded.src_at, stasis = excluded.stasis;
    return coalesce((st ->> p_did)::int, 0);
  end if;
  return coalesce((h.stasis ->> p_did)::int, 0);
end $$;

create or replace function mono.bureau_appareil(u uuid, p_app text) returns void language sql security definer set search_path = mono, public
as $$ insert into mono.bureau_appareils (user_id, appareil) select u, p_app where p_app is not null and length(p_app) between 8 and 64
  on conflict (user_id, appareil) do update set at = now() $$;
-- deux comptes vus sur le même appareil (sauf paire autorisée par Mathis) : jamais dans le même salon
create or replace function mono.bureau_meme_appareil(a uuid, b uuid) returns boolean language sql stable security definer set search_path = mono, public
as $$ select a <> b and exists (select 1 from mono.bureau_appareils x join mono.bureau_appareils y on y.appareil = x.appareil and y.user_id = b where x.user_id = a)
  and not exists (select 1 from mono.bureau_paires_ok where (bureau_paires_ok.a = $1 and bureau_paires_ok.b = $2) or (bureau_paires_ok.a = $2 and bureau_paires_ok.b = $1)) $$;
create or replace function mono.bureau_conflit(p_salon bigint, u uuid) returns boolean language sql stable security definer set search_path = mono, public
as $$ select exists (select 1 from mono.bureau_membres m where m.salon = p_salon and mono.bureau_meme_appareil(m.user_id, u)) $$;

create or replace function mono.bureau_present(m mono.bureau_membres) returns boolean language sql stable security definer set search_path = mono, public
as $$ select m.vu_at is not null and m.vu_at > now() - mono.bsec('deco_s') $$;
-- chef effectif (8C) : le chef s'il est connecté, sinon le plus ancien connecté (chef provisoire, rôle rendu à son retour)
create or replace function mono.bureau_chef(p_salon bigint) returns uuid language sql stable security definer set search_path = mono, public
as $$ select coalesce(
  (select s.chef from mono.bureau_salons s join mono.bureau_membres m on m.salon = s.id and m.user_id = s.chef where s.id = p_salon and mono.bureau_present(m)),
  (select m.user_id from mono.bureau_membres m where m.salon = p_salon and mono.bureau_present(m) order by m.arrive_at, m.user_id limit 1),
  (select chef from mono.bureau_salons where id = p_salon)) $$;

create or replace function mono.bureau_log(p_salon bigint, t text) returns void language sql security definer set search_path = mono, public
as $$ insert into mono.bureau_journal (salon, txt) values (p_salon, left(t, 200)); update mono.bureau_salons set seq = seq + 1, maj_at = now() where id = p_salon $$;
create or replace function mono.bureau_nom(u uuid) returns text language sql stable security definer set search_path = mono, public
as $$ select coalesce(mono.pseudo(u), 'un joueur') $$;

-- message privé Discord (9B) : seulement si le réglage « mp » est activé ET si le joueur l'a demandé ; rien n'est envoyé d'ici
create or replace function mono.bureau_notifier(u uuid, t text) returns void language sql security definer set search_path = mono, public
as $$ insert into mono.bureau_mp (user_id, txt) select u, left(t, 300) where mono.bon_('mp') and exists (select 1 from mono.bureau_prefs where user_id = u and mp) $$;

-- Défi 12 « Rendez-vous du temps » (contrat avec js/saison1.js, need [2, 5, 10] joueurs) : nombre de joueurs DIFFÉRENTS avec qui
-- le compte a fini (victoire) un donjon de groupe en direct pendant la manche IV de la saison. Seule source de la progression.
create or replace function mono.bureau_d12(u uuid, p_s int) returns int language sql stable security definer set search_path = mono, public
as $$ select count(distinct o.user_id)::int from mono.bureau_combat_membres m join mono.bureau_combats c on c.id = m.combat
  join mono.bureau_combat_membres o on o.combat = c.id and o.user_id <> u
  where m.user_id = u and c.saison = p_s and c.etat = 'fini' and c.win and c.manche = 4 $$;
-- Branchement : mono.defi_prog (monocompte.sql) lit le défi 12 dans le crochet mono.defi_d12, créé vide par monocompte.sql
-- seulement s'il n'existe pas : relancer monocompte.sql ne débranche donc pas le Bureau (mono.defi_prog n'est plus redéfinie ici).
create or replace function mono.defi_d12(u uuid, p_s int) returns int language sql stable security definer set search_path = mono, public
as $$ select mono.bureau_d12(u, p_s) $$;

-- ---------- amis et blocage (supabase/amis.sql) ----------
-- un membre du salon a bloqué ce joueur (liste des ignorés du chat) : le salon lui est fermé
create or replace function mono.bureau_bloque_par(p_salon bigint, u uuid) returns boolean language sql stable security definer set search_path = mono, public
as $$ select exists (select 1 from mono.bureau_membres m where m.salon = p_salon and public.amis_bloque(m.user_id, u)) $$;
-- rencontre automatique : jamais ensemble si l'un a bloqué l'autre
create or replace function mono.bureau_brouille(a uuid, b uuid) returns boolean language sql stable security definer set search_path = mono, public
as $$ select public.amis_bloque(a, b) or public.amis_bloque(b, a) $$;

-- ---------- sortir d'un salon (départ, place perdue, exclusion par la grâce) ----------
create or replace function mono.bureau_sortir(p_salon bigint, u uuid, p_txt text) returns void language plpgsql security definer set search_path = mono, public
as $$ declare s mono.bureau_salons%rowtype; c mono.bureau_combats%rowtype; nouveau uuid; begin
  select * into s from mono.bureau_salons where id = p_salon;
  delete from mono.bureau_membres where salon = p_salon and user_id = u;
  if not found then return; end if;
  perform mono.bureau_log(p_salon, p_txt);
  -- pendant la transition : un départ annule le lancement (règle validée) ; pendant le combat : le héros finit en automatique
  select * into c from mono.bureau_combats where salon = p_salon and etat = 'transition';
  if c.id is not null and exists (select 1 from mono.bureau_combat_membres where combat = c.id and user_id = u) then
    perform mono.bureau_annuler(c.id, mono.bureau_nom(u) || ' est parti : lancement annulé.', null);
  end if;
  if not exists (select 1 from mono.bureau_membres where salon = p_salon) then
    update mono.bureau_salons set etat = 'ferme', ferme_at = now(), motif = coalesce(motif, 'salon vide') where id = p_salon and etat <> 'ferme';
    update mono.bureau_invitations set etat = 'annulee' where salon = p_salon and etat = 'attente';
    return;
  end if;
  if s.chef = u then -- le membre présent depuis le plus longtemps devient chef (règle validée)
    select m.user_id into nouveau from mono.bureau_membres m where m.salon = p_salon order by mono.bureau_present(m) desc, m.arrive_at, m.user_id limit 1;
    update mono.bureau_salons set chef = nouveau where id = p_salon;
    perform mono.bureau_log(p_salon, mono.bureau_nom(nouveau) || ' devient chef du salon.');
  end if;
end $$;

-- Lancement annulé pour tous : ceux qui n'ont pas confirmé (ou p_qui) ne sont plus prêts, les autres le restent
create or replace function mono.bureau_annuler(p_combat bigint, p_txt text, p_qui uuid[]) returns void language plpgsql security definer set search_path = mono, public
as $$ declare c mono.bureau_combats%rowtype; begin
  update mono.bureau_combats set etat = 'annule', motif = left(p_txt, 200) where id = p_combat and etat in ('transition', 'calcul') returning * into c;
  if c.id is null then return; end if;
  update mono.bureau_membres m set pret = false where m.salon = c.salon and (
    (p_qui is not null and m.user_id = any(p_qui))
    or (p_qui is null and exists (select 1 from mono.bureau_combat_membres x where x.combat = c.id and x.user_id = m.user_id and x.confirme_at is null)));
  update mono.bureau_salons set etat = 'ouvert' where id = c.salon and etat = 'transition';
  perform mono.bureau_log(c.salon, p_txt);
end $$;

-- ---------- recherche : rendue en tête de file ----------
create or replace function mono.bureau_rendre_recherche(u uuid, r jsonb) returns void language plpgsql security definer set search_path = mono, public
as $$ begin
  if r is null or exists (select 1 from mono.bureau_membres where user_id = u) then return; end if;
  insert into mono.bureau_recherches (user_id, saison, donjons, stasis, flex, auto, version, depuis)
    values (u, (r ->> 'saison')::int, array(select jsonb_array_elements_text(r -> 'donjons')), (r ->> 'stasis')::int, (r ->> 'flex')::int, coalesce((r ->> 'auto')::boolean, true), r ->> 'version', (r ->> 'depuis')::timestamptz)
    on conflict (user_id) do nothing;
end $$;
create or replace function mono.bureau_rjson(x mono.bureau_recherches) returns jsonb language sql immutable
as $$ select jsonb_build_object('saison', x.saison, 'donjons', to_jsonb(x.donjons), 'stasis', x.stasis, 'flex', x.flex, 'auto', x.auto, 'version', x.version, 'depuis', x.depuis) $$;

-- Salon automatique : toutes les réponses reçues (ou délai passé). Au moins 2 « oui » : le salon s'ouvre. Un seul : pas de salon
-- à 1, celui qui a accepté retourne en tête de recherche. Ceux qui n'ont pas répondu (ou ont refusé) sortent de la recherche.
create or replace function mono.bureau_resoudre(p_salon bigint) returns void language plpgsql security definer set search_path = mono, public
as $$ declare s mono.bureau_salons%rowtype; n int; r record; begin
  select * into s from mono.bureau_salons where id = p_salon and etat = 'invitation' for update;
  if s.id is null then return; end if;
  if exists (select 1 from mono.bureau_invitations where salon = p_salon and etat = 'attente' and expire_at > now()) then return; end if;
  update mono.bureau_invitations set etat = 'expiree' where salon = p_salon and etat = 'attente';
  select count(*) into n from mono.bureau_membres where salon = p_salon;
  if n >= 2 then
    if not exists (select 1 from mono.bureau_membres where salon = p_salon and user_id = s.chef) then
      update mono.bureau_salons set chef = (select user_id from mono.bureau_membres m where m.salon = p_salon order by (select i.recherche ->> 'depuis' from mono.bureau_invitations i where i.salon = p_salon and i.user_id = m.user_id order by i.id desc limit 1), m.arrive_at limit 1) where id = p_salon;
    end if;
    update mono.bureau_salons set etat = 'ouvert', created_at = now() where id = p_salon;
    perform mono.bureau_log(p_salon, format('Salon formé à %s joueurs. Attente conseillée : 2 minutes pour d''autres joueurs, départ anticipé possible.', n));
    return;
  end if;
  for r in select m.user_id, (select i.recherche from mono.bureau_invitations i where i.salon = p_salon and i.user_id = m.user_id order by i.id desc limit 1) rech
      from mono.bureau_membres m where m.salon = p_salon loop
    delete from mono.bureau_membres where salon = p_salon and user_id = r.user_id;
    perform mono.bureau_rendre_recherche(r.user_id, r.rech);
  end loop;
  update mono.bureau_salons set etat = 'ferme', ferme_at = now(), motif = 'pas assez de réponses' where id = p_salon;
end $$;

-- ---------- entretien (à chaque appel ; le planificateur pourra l'appeler aussi) ----------
create or replace function mono.bureau_menage() returns void language plpgsql security definer set search_path = mono, public
as $$ declare r record; s int := mono.saison_ouverte(); sid bigint; n int; libres int; begin
  if not pg_try_advisory_xact_lock(hashtextextended('mono:bureau:menage', 0)) then return; end if;
  -- 1. invitations arrivées à échéance (60 s) ; salons automatiques résolus
  for r in select distinct i.salon from mono.bureau_invitations i where i.etat = 'attente' and i.expire_at <= now() loop
    update mono.bureau_invitations set etat = 'expiree' where salon = r.salon and etat = 'attente' and expire_at <= now();
    perform mono.bureau_resoudre(r.salon);
  end loop;
  -- 2. transitions de 60 s dépassées : lancement annulé pour tous
  for r in select id from mono.bureau_combats where etat = 'transition' and transition_fin < now() loop
    perform mono.bureau_annuler(r.id, 'Transition de 60 s dépassée : lancement annulé, ceux qui n''ont pas confirmé ne sont plus prêts.', null);
  end loop;
  -- calcul abandonné (fonction serveur coupée plusieurs fois) : annulé au bout de 5 minutes
  for r in select id from mono.bureau_combats where etat = 'calcul' and calc_at < now() - interval '5 minutes' loop
    perform mono.bureau_annuler(r.id, 'Le serveur n''a pas pu jouer le combat : lancement annulé.', array[]::uuid[]);
  end loop;
  -- 3. combat fini (heure de fin passée) : le salon reste ouvert, chacun doit reconfirmer « Prêt »
  for r in select x.id from mono.bureau_salons x where x.etat = 'combat' and not exists (select 1 from mono.bureau_combats c where c.salon = x.id and c.etat = 'fini' and c.fin_at > now())
      for update skip locked loop
    update mono.bureau_salons set etat = 'ouvert' where id = r.id; update mono.bureau_membres set pret = false where salon = r.id;
    perform mono.bureau_log(r.id, 'Combat terminé. Le chef peut proposer de rejouer, changer de stasis ou de donjon.');
  end loop;
  -- 4. places gardées 2 minutes (avant le combat) : au-delà, la place est libérée ; jamais pendant un combat
  for r in select m.salon, m.user_id from mono.bureau_membres m join mono.bureau_salons x on x.id = m.salon
      where x.etat in ('ouvert', 'invitation') and m.vu_at is not null and m.vu_at < now() - mono.bsec('place_s') loop
    perform mono.bureau_sortir(r.salon, r.user_id, mono.bureau_nom(r.user_id) || ' a perdu sa place (déconnecté plus de 2 minutes).');
  end loop;
  -- 5. comptes suspendus ou en vérification : ni recherche ni inscription
  delete from mono.bureau_recherches x where s is null or x.saison <> s or mono.bureau_bloque(x.user_id, x.saison) is not null;
  delete from mono.bureau_inscriptions i using mono.bureau_expeditions e where e.id = i.expedition and e.etat = 'annoncee' and mono.bureau_bloque(i.user_id, e.saison) is not null;
  -- 6. expéditions : salon ouvert à H−10 ; à l'heure, chef = premier inscrit présent si l'organisateur est absent ; grâce de 5 min
  for r in select * from mono.bureau_expeditions e where e.etat = 'annoncee' and e.heure - make_interval(mins => mono.bn('ouverture_min')::int) <= now() for update skip locked loop
    insert into mono.bureau_salons (saison, etat, chef, did, stasis, public, remplacants, expedition) values (r.saison, 'ouvert', r.org, r.did, r.stasis, false, false, r.id) returning id into sid;
    insert into mono.bureau_membres (salon, user_id, arrive_at) select sid, i.user_id, i.at from mono.bureau_inscriptions i
      where i.expedition = r.id and not i.attente and not exists (select 1 from mono.bureau_membres m where m.user_id = i.user_id) order by i.at;
    update mono.bureau_expeditions set etat = 'ouverte', salon = sid where id = r.id;
    perform mono.bureau_log(sid, format('Expédition ouverte : départ à l''heure, avec 2, 3 ou 4 joueurs. Grâce de 5 minutes pour les absents.'));
    perform mono.bureau_notifier(i.user_id, 'Ton expédition du Bureau des Aventuriers ouvre : départ dans 10 minutes.') from mono.bureau_inscriptions i where i.expedition = r.id and not i.attente;
  end loop;
  for r in select x.* from mono.bureau_salons x join mono.bureau_expeditions e on e.id = x.expedition where x.etat <> 'ferme' and not x.h_fait and e.heure <= now() for update of x skip locked loop
    update mono.bureau_salons set h_fait = true where id = r.id;
    if not exists (select 1 from mono.bureau_membres m where m.salon = r.id and m.user_id = r.chef and mono.bureau_present(m)) then
      update mono.bureau_salons set chef = coalesce((select m.user_id from mono.bureau_membres m where m.salon = r.id and mono.bureau_present(m) order by m.arrive_at, m.user_id limit 1), chef) where id = r.id;
      perform mono.bureau_log(r.id, 'L''organisateur est absent à l''heure : le premier inscrit présent devient chef.');
    end if;
  end loop;
  for r in select x.*, e.places from mono.bureau_salons x join mono.bureau_expeditions e on e.id = x.expedition
      where x.etat <> 'ferme' and not x.grace_fait and e.heure + mono.bsec('grace_s') <= now() for update of x skip locked loop
    update mono.bureau_salons set grace_fait = true where id = r.id;
    if not exists (select 1 from mono.bureau_membres m where m.salon = r.id and m.vu_at is not null) and not exists (select 1 from mono.bureau_combats c where c.salon = r.id) then
      delete from mono.bureau_membres where salon = r.id;
      update mono.bureau_salons set etat = 'ferme', ferme_at = now(), motif = 'personne n''est venu' where id = r.id;
      update mono.bureau_expeditions set etat = 'vide', motif = 'Personne n''est venu.' where id = r.expedition;
      continue;
    end if;
    perform mono.bureau_sortir(r.id, m.user_id, mono.bureau_nom(m.user_id) || ' n''est pas venu : sa place est libérée.') from mono.bureau_membres m where m.salon = r.id and m.vu_at is null;
    -- la liste d'attente remplit les places libérées (invitation de 60 s)
    select r.places - count(*) into libres from mono.bureau_membres where salon = r.id;
    insert into mono.bureau_invitations (salon, user_id, quoi, expire_at)
      select r.id, i.user_id, 'attente', now() + mono.bsec('invit_s') from mono.bureau_inscriptions i
      where i.expedition = r.expedition and i.attente and not exists (select 1 from mono.bureau_membres m where m.user_id = i.user_id) order by i.at limit greatest(0, libres);
  end loop;
  -- 7. salons dont la saison n'est plus en jeu : fermés (un combat déjà calculé reste à récupérer)
  update mono.bureau_salons set etat = 'ferme', ferme_at = now(), motif = 'saison fermée' where etat in ('ouvert', 'invitation') and (s is null or saison <> s);
  delete from mono.bureau_membres m using mono.bureau_salons x where x.id = m.salon and x.etat = 'ferme';
end $$;

-- ---------- rencontre automatique ----------
-- À chaque nouvelle recherche : d'abord une place libre dans un salon qui accepte des remplaçants (même donjon, stasis dans la
-- plage du joueur) ; sinon un groupe de 2 à 4 autour du donjon qui réunit le plus de joueurs (puis la stasis commune la plus
-- haute), chef = celui qui cherche depuis le plus longtemps. Les recherches sont retirées au moment où les invitations partent.
create or replace function mono.bureau_rencontre(u uuid) returns bigint language plpgsql security definer set search_path = mono, public
as $$ declare me mono.bureau_recherches%rowtype; d text; best_d text; best_ids uuid[]; best_k int; ids uuid[]; lo int; hi int; k int; r record; sid bigint; x record; ok boolean; begin
  perform pg_advisory_xact_lock(hashtextextended('mono:bureau:rencontre', 0));
  select * into me from mono.bureau_recherches where user_id = u for update;
  if me.user_id is null or not me.auto then return null; end if;
  -- salon qui cherche un remplaçant
  select sl.id, sl.did, sl.stasis into r from mono.bureau_salons sl
    where sl.saison = me.saison and sl.etat = 'ouvert' and sl.remplacants and sl.expedition is null and sl.did = any(me.donjons)
      and sl.stasis between me.stasis - me.flex and me.stasis + me.flex
      and (select count(*) from mono.bureau_membres m where m.salon = sl.id) + (select count(*) from mono.bureau_invitations i where i.salon = sl.id and i.etat = 'attente') < 4
      and not mono.bureau_conflit(sl.id, u) and not exists (select 1 from mono.bureau_membres bm where bm.salon = sl.id and mono.bureau_brouille(bm.user_id, u))
      and (sl.version is null or me.version is null or sl.version = me.version)
    order by sl.created_at limit 1 for update skip locked;
  if r.id is not null then
    insert into mono.bureau_invitations (salon, user_id, quoi, recherche, expire_at) values (r.id, u, 'remplacant', mono.bureau_rjson(me), now() + mono.bsec('invit_s'));
    delete from mono.bureau_recherches where user_id = u;
    perform mono.bureau_log(r.id, 'Un remplaçant est invité.');
    perform mono.bureau_notifier(u, 'Le Bureau des Aventuriers t''a trouvé une place : 60 secondes pour accepter.');
    return r.id;
  end if;
  -- nouveau groupe
  foreach d in array me.donjons loop
    ids := array[u]; lo := me.stasis - me.flex; hi := me.stasis + me.flex;
    for x in select * from mono.bureau_recherches o where o.user_id <> u and o.saison = me.saison and o.auto and d = any(o.donjons)
        and (o.version is null or me.version is null or o.version = me.version) order by o.depuis, o.user_id loop
      exit when array_length(ids, 1) >= 4;
      if greatest(lo, x.stasis - x.flex) > least(hi, x.stasis + x.flex) then continue; end if;
      ok := true;
      for k in 1 .. array_length(ids, 1) loop if mono.bureau_meme_appareil(ids[k], x.user_id) or mono.bureau_brouille(ids[k], x.user_id) then ok := false; end if; end loop;
      if not ok then continue; end if;
      ids := ids || x.user_id; lo := greatest(lo, x.stasis - x.flex); hi := least(hi, x.stasis + x.flex);
    end loop;
    if array_length(ids, 1) < 2 then continue; end if;
    -- stasis commune la plus haute qui respecte la règle 4A (un membre a réussi la stasis précédente)
    k := null;
    for n in reverse least(hi, 15) .. greatest(lo, 1) loop
      if n = 1 or exists (select 1 from unnest(ids) z where mono.bureau_smax(z, me.saison, d) >= n - 1) then k := n; exit; end if;
    end loop;
    if k is null then continue; end if;
    if best_ids is null or array_length(ids, 1) > array_length(best_ids, 1) or (array_length(ids, 1) = array_length(best_ids, 1) and k > best_k) then
      best_d := d; best_ids := ids; best_k := k; end if;
  end loop;
  if best_ids is null then return null; end if;
  insert into mono.bureau_salons (saison, etat, chef, did, stasis, version) values (me.saison, 'invitation',
    (select user_id from mono.bureau_recherches where user_id = any(best_ids) order by depuis, user_id limit 1), best_d, best_k, me.version) returning id into sid;
  insert into mono.bureau_invitations (salon, user_id, quoi, recherche, expire_at)
    select sid, rq.user_id, 'auto', mono.bureau_rjson(rq), now() + mono.bsec('invit_s') from mono.bureau_recherches rq where rq.user_id = any(best_ids);
  delete from mono.bureau_recherches where user_id = any(best_ids);
  perform mono.bureau_log(sid, format('Le Bureau a trouvé %s joueurs compatibles : chacun a 60 secondes pour accepter.', array_length(best_ids, 1)));
  perform mono.bureau_notifier(z, 'Le Bureau des Aventuriers t''a trouvé un groupe : 60 secondes pour accepter.') from unnest(best_ids) z;
  return sid;
end $$;

-- le membre qui agit (2 onglets : une seule place par compte, le second onglet regarde seulement)
create or replace function mono.bureau_moi(u uuid, p_onglet text) returns mono.bureau_membres language plpgsql security definer set search_path = mono, public
as $$ declare m mono.bureau_membres%rowtype; begin
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then raise exception 'Tu n''es dans aucun salon.'; end if;
  if p_onglet is not null and m.onglet is not null and m.onglet <> p_onglet and mono.bureau_present(m) then
    raise exception 'Ton salon est ouvert dans un autre onglet : celui-ci regarde seulement.'; end if;
  update mono.bureau_membres set vu_at = now(), onglet = coalesce(p_onglet, onglet) where salon = m.salon and user_id = u returning * into m;
  return m;
end $$;

-- entrée d'un joueur dans un salon (après les contrôles) ; sa recherche est retirée
create or replace function mono.bureau_entrer(p_salon bigint, u uuid, p_onglet text, smin int default null, smax int default null) returns void language plpgsql security definer set search_path = mono, public
as $$ begin
  insert into mono.bureau_membres (salon, user_id, vu_at, onglet, smin, smax) values (p_salon, u, now(), p_onglet, smin, smax);
  delete from mono.bureau_recherches where user_id = u;
  update mono.bureau_invitations set etat = 'annulee' where user_id = u and etat = 'attente' and salon <> p_salon;
  perform mono.bureau_log(p_salon, mono.bureau_nom(u) || ' rejoint le salon.');
end $$;

-- ============================================================================
-- État complet (et signe de vie) : le jeu le redemande toutes les quelques secondes, et après une coupure
-- ============================================================================
create or replace function mono.bureau_etat(u uuid, p_onglet text) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare s int := mono.bureau_saison(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; c mono.bureau_combats%rowtype; me mono.bureau_recherches%rowtype;
  spect boolean := false; sal jsonb := null; chef uuid; begin
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is not null then
    if p_onglet is not null and m.onglet is not null and m.onglet <> p_onglet and mono.bureau_present(m) then spect := true;
    else update mono.bureau_membres set vu_at = now(), onglet = coalesce(p_onglet, onglet) where salon = m.salon and user_id = u; end if;
    select * into x from mono.bureau_salons where id = m.salon;
    select * into c from mono.bureau_combats where salon = x.id and etat <> 'annule' order by id desc limit 1;
    chef := mono.bureau_chef(x.id);
    sal := jsonb_build_object('id', x.id, 'etat', x.etat, 'did', x.did, 'stasis', x.stasis, 'cle', x.cle, 'public', x.public, 'remplacants', x.remplacants, 'version', x.version,
      'expedition', x.expedition, 'heure', (select heure from mono.bureau_expeditions where id = x.expedition), 'seq', x.seq,
      'chef', chef, 'titulaire', x.chef, 'provisoire', chef is distinct from x.chef, 'cree', x.created_at, 'attente_fin', x.created_at + mono.bsec('attente_s'),
      'membres', (select coalesce(jsonb_agg(jsonb_build_object('user', y.user_id, 'pseudo', mono.bureau_nom(y.user_id), 'arrive', y.arrive_at, 'pret', y.pret,
          'present', mono.bureau_present(y), 'venu', y.vu_at is not null, 'chef', y.user_id = chef, 'moi', y.user_id = u, 'version', y.version,
          'place_fin', case when y.vu_at is not null and not mono.bureau_present(y) then y.vu_at + mono.bsec('place_s') end, 'smin', y.smin, 'smax', y.smax) order by y.arrive_at, y.user_id), '[]'::jsonb)
        from mono.bureau_membres y where y.salon = x.id),
      'invites', (select coalesce(jsonb_agg(jsonb_build_object('pseudo', mono.bureau_nom(i.user_id), 'expire', i.expire_at, 'quoi', i.quoi)), '[]'::jsonb)
        from mono.bureau_invitations i where i.salon = x.id and i.etat = 'attente'),
      'combat', case when c.id is null then null else jsonb_build_object('id', c.id, 'etat', c.etat, 'did', c.did, 'stasis', c.stasis, 'transition_fin', c.transition_fin,
          'membres', (select jsonb_agg(jsonb_build_object('user', z.user_id, 'pseudo', mono.bureau_nom(z.user_id), 'ok', z.confirme_at is not null) order by z.user_id) from mono.bureau_combat_membres z where z.combat = c.id),
          'debut', c.debut_at, 'fin', c.fin_at, 'win', case when c.etat = 'fini' then c.win end,
          'seed', case when c.etat = 'fini' then c.seed end, 'snaps', case when c.etat = 'fini' then c.snaps end, 'duree', c.duree_ms,
          'at', floor(extract(epoch from c.lance_at))::bigint * 1000) end,
      'journal', (select coalesce(jsonb_agg(jsonb_build_object('t', j.txt, 'at', j.at) order by j.id), '[]'::jsonb) from (select * from mono.bureau_journal where salon = x.id order by id desc limit 20) j),
      'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'p', mono.bureau_nom(g.user_id), 'b', g.body, 'at', g.at, 'moi', g.user_id = u) order by g.id), '[]'::jsonb)
        from (select * from mono.bureau_msgs where salon = x.id order by id desc limit 30) g));
  end if;
  select * into me from mono.bureau_recherches where user_id = u;
  return jsonb_build_object('now', now(), 'saison', s, 'bloque', mono.bureau_bloque(u, s), 'spectateur', spect,
    'recherche', case when me.user_id is null then null else mono.bureau_rjson(me) || jsonb_build_object(
      'compatibles', (select count(*) from mono.bureau_recherches o where o.user_id <> u and o.saison = me.saison and o.donjons && me.donjons and abs(o.stasis - me.stasis) <= o.flex + me.flex),
      'avec_flex', (select count(*) from mono.bureau_recherches o where o.user_id <> u and o.saison = me.saison and o.donjons && me.donjons and abs(o.stasis - me.stasis) <= o.flex + least(2, me.flex + 1))) end,
    'compteurs', jsonb_build_object('total', (select count(*) from mono.bureau_recherches where saison = s),
      'donjons', (select coalesce(jsonb_object_agg(d, n), '{}'::jsonb) from (select d, count(*) n from mono.bureau_recherches, unnest(donjons) d where saison = s group by d) z)),
    'invitations', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'salon', i.salon, 'quoi', i.quoi, 'par', case when i.par is not null then mono.bureau_nom(i.par) end, 'expire', i.expire_at,
        'did', y.did, 'stasis', y.stasis, 'membres', (select coalesce(jsonb_agg(mono.bureau_nom(z.user_id)), '[]'::jsonb) from mono.bureau_invitations z where z.salon = i.salon and z.user_id <> u and z.etat in ('attente', 'oui'))) order by i.id), '[]'::jsonb)
      from mono.bureau_invitations i join mono.bureau_salons y on y.id = i.salon where i.user_id = u and i.etat = 'attente' and i.expire_at > now()),
    'manquees', (select coalesce(jsonb_agg(jsonb_build_object('at', i.expire_at, 'par', case when i.par is not null then mono.bureau_nom(i.par) end, 'quoi', i.quoi) order by i.id desc), '[]'::jsonb)
      from (select * from mono.bureau_invitations where user_id = u and etat = 'expiree' and expire_at > now() - interval '1 day' order by id desc limit 5) i),
    'butins', (select coalesce(jsonb_agg(jsonb_build_object('combat', c2.id, 'did', c2.did, 'stasis', c2.stasis, 'fin', c2.fin_at, 'win', c2.win) order by c2.id), '[]'::jsonb)
      from mono.bureau_butins b join mono.bureau_combats c2 on c2.id = b.combat where b.user_id = u and b.pris_at is null),
    'salon', sal);
end $$;

-- ============================================================================
-- Fonctions du jeu (testeurs seulement, comme tout l'espace Monocompte)
-- ============================================================================
create or replace function public.mono_bureau_etat(p_onglet text default null, p_appareil text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  perform mono.bureau_menage();
  perform mono.bureau_appareil(u, p_appareil);
  return mono.bureau_etat(u, p_onglet);
end $$;

-- « Jouer maintenant » : plusieurs donjons, stasis voulue et flexibilité (exacte, ±1, ±2), recherche automatique ou non
create or replace function public.mono_bureau_chercher(p_donjons text[], p_stasis int, p_flex int, p_auto boolean, p_version text, p_appareil text default null, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); b text; ds text[]; begin
  perform mono.bureau_menage();
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if exists (select 1 from mono.bureau_membres where user_id = u) then return mono.err('Tu es déjà dans un salon : quitte-le d''abord.'); end if;
  ds := array(select distinct x from unnest(coalesce(p_donjons, '{}')) x where x ~ '^[a-z0-9_]{2,40}$');
  if cardinality(ds) < 1 or cardinality(ds) > 12 then return mono.err('Choisis de 1 à 12 donjons.'); end if;
  if p_stasis is null or p_stasis not between 1 and 15 then return mono.err('Stasis de 1 à 15.'); end if;
  if p_flex is null or p_flex not between 0 and 2 then return mono.err('Flexibilité : exacte, ±1 ou ±2.'); end if;
  perform mono.verrou(u);
  perform mono.bureau_appareil(u, p_appareil);
  insert into mono.bureau_recherches (user_id, saison, donjons, stasis, flex, auto, version) values (u, s, ds, p_stasis, p_flex, coalesce(p_auto, true), left(p_version, 20))
    on conflict (user_id) do update set saison = excluded.saison, donjons = excluded.donjons, stasis = excluded.stasis, flex = excluded.flex, auto = excluded.auto, version = excluded.version, at = now();
  perform mono.bureau_rencontre(u);
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;
create or replace function public.mono_bureau_annuler_recherche() returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  delete from mono.bureau_recherches where user_id = u;
  return jsonb_build_object('ok', true);
end $$;

-- Liste des salons ouverts (recherche manuelle)
create or replace function public.mono_bureau_salons() returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); begin
  perform mono.bureau_menage();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'etat', x.etat, 'did', x.did, 'stasis', x.stasis, 'chef', mono.bureau_nom(mono.bureau_chef(x.id)),
      'n', (select count(*) from mono.bureau_membres m where m.salon = x.id), 'pseudos', (select jsonb_agg(mono.bureau_nom(m.user_id) order by m.arrive_at) from mono.bureau_membres m where m.salon = x.id),
      'cree', x.created_at, 'version', x.version) order by x.created_at), '[]'::jsonb)
    from mono.bureau_salons x where x.saison = s and x.public and x.expedition is null and x.etat in ('ouvert', 'transition', 'combat')
      and (select count(*) from mono.bureau_membres m where m.salon = x.id) < 4 and not mono.bureau_bloque_par(x.id, u));
end $$;

-- Créer son salon (sans recherche)
create or replace function public.mono_bureau_creer(p_did text, p_stasis int, p_public boolean, p_version text, p_appareil text default null, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); b text; sid bigint; begin
  perform mono.bureau_menage();
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if p_did is not null and p_did !~ '^[a-z0-9_]{2,40}$' then return mono.err('Donjon inconnu.'); end if;
  if p_stasis is not null and p_stasis not between 1 and 15 then return mono.err('Stasis de 1 à 15.'); end if;
  perform mono.verrou(u);
  if exists (select 1 from mono.bureau_membres where user_id = u) then return mono.err('Tu es déjà dans un salon : quitte-le d''abord.'); end if;
  perform mono.bureau_appareil(u, p_appareil);
  insert into mono.bureau_salons (saison, etat, chef, did, stasis, public, version) values (s, 'ouvert', u, p_did, case when p_did is null then null else coalesce(p_stasis, 1) end, coalesce(p_public, true), left(p_version, 20)) returning id into sid;
  perform mono.bureau_entrer(sid, u, p_onglet);
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Rejoindre un salon de la liste (verrou sur la ligne du salon : deux joueurs ne prennent jamais la même place)
create or replace function public.mono_bureau_rejoindre(p_salon bigint, p_version text, p_appareil text default null, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); b text; x mono.bureau_salons%rowtype; begin
  perform mono.bureau_menage();
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  perform mono.verrou(u);
  perform mono.bureau_appareil(u, p_appareil);
  if exists (select 1 from mono.bureau_membres where user_id = u) then return mono.err('Tu es déjà dans un salon : quitte-le d''abord.'); end if;
  select * into x from mono.bureau_salons where id = p_salon for update;
  if x.id is null or x.etat not in ('ouvert', 'transition', 'combat') or x.saison <> s then return mono.err('Ce salon n''existe plus.'); end if;
  -- salon privé : sur invitation, ou inscrit à l'expédition (déjà dans un autre salon à l'ouverture, il la rejoint ensuite)
  if not x.public and not exists (select 1 from mono.bureau_invitations i where i.salon = x.id and i.user_id = u and i.etat = 'attente')
     and not exists (select 1 from mono.bureau_inscriptions i where x.expedition is not null and i.expedition = x.expedition and i.user_id = u and not i.attente) then return mono.err('Ce salon est privé.'); end if;
  if (select count(*) from mono.bureau_membres where salon = x.id) >= 4 then return mono.err('Salon complet : 4 joueurs au plus.'); end if;
  if mono.bureau_conflit(x.id, u) then return mono.err('Un compte du même appareil est déjà dans ce salon.'); end if;
  if mono.bureau_bloque_par(x.id, u) then return mono.err('Ce salon ne t''est pas ouvert.'); end if; -- bloqué par un membre
  perform mono.bureau_entrer(x.id, u, p_onglet);
  update mono.bureau_membres set version = left(p_version, 20) where salon = x.id and user_id = u;
  if x.etat <> 'ouvert' then perform mono.bureau_log(x.id, mono.bureau_nom(u) || ' attend le combat suivant.'); end if;
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Répondre à une invitation (60 s)
create or replace function public.mono_bureau_repondre(p_invit bigint, p_oui boolean, p_version text default null, p_appareil text default null, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); i mono.bureau_invitations%rowtype; x mono.bureau_salons%rowtype; b text; r jsonb; begin
  perform mono.bureau_menage();
  perform mono.bureau_appareil(u, p_appareil);
  select * into i from mono.bureau_invitations where id = p_invit and user_id = u;
  if i.id is null then return mono.err('Invitation introuvable.'); end if;
  select * into x from mono.bureau_salons where id = i.salon for update; -- le salon d'abord (même ordre partout)
  select * into i from mono.bureau_invitations where id = p_invit for update;
  if i.etat <> 'attente' or i.expire_at <= now() then return mono.err('Invitation expirée.'); end if;
  if not coalesce(p_oui, false) then
    update mono.bureau_invitations set etat = 'non' where id = i.id;
    if x.etat = 'invitation' then perform mono.bureau_resoudre(x.id); end if;
    return jsonb_build_object('ok', true);
  end if;
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if exists (select 1 from mono.bureau_membres where user_id = u) then return mono.err('Tu es déjà dans un salon : quitte-le d''abord.'); end if;
  if x.etat not in ('invitation', 'ouvert', 'transition', 'combat') then return mono.err('Ce salon n''existe plus.'); end if;
  if (select count(*) from mono.bureau_membres where salon = x.id) >= 4 then return mono.err('Salon complet : 4 joueurs au plus.'); end if;
  if mono.bureau_conflit(x.id, u) then return mono.err('Un compte du même appareil est déjà dans ce salon.'); end if;
  if mono.bureau_bloque_par(x.id, u) then return mono.err('Ce salon ne t''est pas ouvert.'); end if; -- bloqué par un membre arrivé entre-temps
  update mono.bureau_invitations set etat = 'oui' where id = i.id;
  r := i.recherche;
  perform mono.bureau_entrer(x.id, u, p_onglet, case when r is not null then (r ->> 'stasis')::int - (r ->> 'flex')::int end, case when r is not null then (r ->> 'stasis')::int + (r ->> 'flex')::int end);
  update mono.bureau_membres set version = left(p_version, 20) where salon = x.id and user_id = u;
  if x.etat = 'invitation' then perform mono.bureau_resoudre(x.id); end if;
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Inviter un joueur (Bureau.inviter, bouton « Inviter » de la page Amis) : crée son salon s'il n'en a pas. Seulement un ami
-- accepté (amis.sql), sans blocage d'un côté ni de l'autre ; la recherche et les salons ouverts restent ouverts à tous.
create or replace function public.mono_bureau_inviter(p_user uuid, p_version text default null, p_appareil text default null, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); b text; m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; sid bigint; begin
  perform mono.bureau_menage();
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if p_user is null or p_user = u then return mono.err('Joueur introuvable.'); end if;
  if not (public.amis_sont(u, p_user) and public.amis_sont(p_user, u)) or mono.bureau_brouille(u, p_user) then
    return mono.err('Tu ne peux inviter directement que tes amis.'); end if;
  if not mono.acces(p_user) or mono.bureau_bloque(p_user, s) is not null then return mono.err('Ce joueur ne peut pas rejoindre de groupe en ce moment.'); end if;
  perform mono.verrou(u);
  perform mono.bureau_appareil(u, p_appareil);
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then
    insert into mono.bureau_salons (saison, etat, chef, public, version) values (s, 'ouvert', u, false, left(p_version, 20)) returning id into sid;
    perform mono.bureau_entrer(sid, u, p_onglet);
  else begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end; sid := m.salon; end if;
  select * into x from mono.bureau_salons where id = sid for update;
  if exists (select 1 from mono.bureau_membres where user_id = p_user and salon = sid) then return mono.err('Ce joueur est déjà dans ton salon.'); end if;
  if exists (select 1 from mono.bureau_membres where user_id = p_user) then return mono.err('Ce joueur est déjà dans un autre salon.'); end if;
  if mono.bureau_conflit(sid, p_user) then return mono.err('Ce compte est vu sur le même appareil qu''un membre du salon.'); end if;
  if mono.bureau_bloque_par(sid, p_user) then return mono.err('Ce joueur ne peut pas rejoindre ton salon.'); end if;
  if exists (select 1 from mono.bureau_invitations where salon = sid and user_id = p_user and etat = 'attente' and expire_at > now()) then return mono.err('Invitation déjà envoyée.'); end if;
  if (select count(*) from mono.bureau_membres where salon = sid) + (select count(*) from mono.bureau_invitations where salon = sid and etat = 'attente') >= 4 then return mono.err('Salon complet : 4 joueurs au plus.'); end if;
  insert into mono.bureau_invitations (salon, user_id, par, quoi, expire_at) values (sid, p_user, u, 'ami', now() + mono.bsec('invit_s'));
  perform mono.bureau_log(sid, mono.bureau_nom(u) || ' invite ' || mono.bureau_nom(p_user) || '.');
  perform mono.bureau_notifier(p_user, mono.bureau_nom(u) || ' t''invite dans son groupe du Bureau des Aventuriers : 60 secondes pour accepter.');
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

create or replace function public.mono_bureau_quitter(p_onglet text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; begin
  perform mono.bureau_menage();
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return jsonb_build_object('ok', true); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  perform mono.bureau_sortir(x.id, u, mono.bureau_nom(u) || case when x.etat = 'combat' then ' quitte le salon : son héros finit le combat en automatique, son butin l''attend.' else ' quitte le salon.' end);
  return jsonb_build_object('ok', true);
end $$;

-- « Prêt » (1B : jamais pendant un donjon solo ; même version du jeu ; plage de stasis du joueur ; clé du donjon)
create or replace function public.mono_bureau_pret(p_on boolean, p_version text, p_solo boolean default false, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; c mono.bureau_combats%rowtype; b text; d jsonb; begin
  perform mono.bureau_menage();
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return mono.err('Tu n''es dans aucun salon.'); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  if not coalesce(p_on, false) then
    update mono.bureau_membres set pret = false where salon = x.id and user_id = u;
    select * into c from mono.bureau_combats where salon = x.id and etat = 'transition';
    if c.id is not null and exists (select 1 from mono.bureau_combat_membres where combat = c.id and user_id = u) then
      perform mono.bureau_annuler(c.id, mono.bureau_nom(u) || ' n''est plus prêt : lancement annulé.', array[u]); end if;
    perform mono.bureau_log(x.id, mono.bureau_nom(u) || ' n''est plus prêt.');
    return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
  end if;
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if x.etat <> 'ouvert' then return mono.err(case x.etat when 'transition' then 'Lancement en cours : attends le combat suivant.' when 'combat' then 'Combat en cours : attends sa fin.' else 'Le salon n''est pas encore formé.' end); end if;
  if x.did is null then return mono.err('Le chef doit d''abord proposer un donjon.'); end if;
  if coalesce(p_solo, false) then return mono.err('Termine ton donjon solo d''abord : tu pourras te mettre « Prêt » ensuite.'); end if;
  if x.version is not null and coalesce(p_version, '') <> x.version then return mono.err(format('Version du jeu différente (salon : %s) : recharge la page.', x.version)); end if;
  if (m.smin is not null and x.stasis < m.smin) or (m.smax is not null and x.stasis > m.smax) then return mono.err(format('Stasis %s hors de ta recherche (%s à %s).', x.stasis, m.smin, m.smax)); end if;
  if x.cle is not null then
    select data::jsonb into d from mono.parties_ok where user_id = u and saison = s;
    if mono.qty(u, s, d, 'res', x.cle) < 1 then return mono.err('Il te faut la clé du donjon : ' || x.cle || '.'); end if;
  end if;
  update mono.bureau_membres set pret = true, version = left(p_version, 20) where salon = x.id and user_id = u;
  perform mono.bureau_log(x.id, mono.bureau_nom(u) || ' est prêt.');
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Proposition du chef (donjon, stasis) : tout le monde doit reconfirmer « Prêt » ; jamais pendant la transition
create or replace function public.mono_bureau_proposer(p_did text, p_stasis int, p_cle text, p_version text, p_onglet text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; begin
  perform mono.bureau_menage();
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return mono.err('Tu n''es dans aucun salon.'); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  if mono.bureau_chef(x.id) <> u then return mono.err('Seul le chef propose le donjon et la stasis.'); end if;
  if x.etat = 'transition' then return mono.err('Impossible pendant la transition : elle se termine ou s''annule d''abord.'); end if;
  if x.etat <> 'ouvert' then return mono.err('Attends la fin du combat.'); end if;
  if x.expedition is not null then return mono.err('Le donjon d''une expédition est celui de l''annonce.'); end if;
  if p_did is null or p_did !~ '^[a-z0-9_]{2,40}$' then return mono.err('Donjon inconnu.'); end if;
  if p_stasis is null or p_stasis not between 1 and 15 then return mono.err('Stasis de 1 à 15.'); end if;
  if p_stasis > 1 and not exists (select 1 from mono.bureau_membres y where y.salon = x.id and mono.bureau_smax(y.user_id, x.saison, p_did) >= p_stasis - 1) then
    return mono.err(format('Il faut au moins un membre qui a réussi la stasis %s de ce donjon.', p_stasis - 1)); end if;
  update mono.bureau_salons set did = p_did, stasis = p_stasis, cle = left(p_cle, 80), version = coalesce(left(p_version, 20), version) where id = x.id;
  update mono.bureau_membres set pret = false where salon = x.id;
  perform mono.bureau_log(x.id, format('%s propose : stasis %s. Tout le monde doit reconfirmer « Prêt ».', mono.bureau_nom(u), p_stasis));
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Réglages du salon (chef) : visible dans la liste, remplaçants automatiques
create or replace function public.mono_bureau_reglage_salon(p_public boolean, p_remplacants boolean, p_onglet text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; begin
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return mono.err('Tu n''es dans aucun salon.'); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  if mono.bureau_chef(x.id) <> u then return mono.err('Réservé au chef.'); end if;
  update mono.bureau_salons set public = coalesce(p_public, public) and expedition is null, remplacants = coalesce(p_remplacants, remplacants) and expedition is null where id = x.id;
  perform mono.bureau_log(x.id, 'Réglages du salon changés.');
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Transmettre le rôle de chef
create or replace function public.mono_bureau_chef(p_user uuid, p_onglet text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; begin
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return mono.err('Tu n''es dans aucun salon.'); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  if mono.bureau_chef(x.id) <> u then return mono.err('Réservé au chef.'); end if;
  if not exists (select 1 from mono.bureau_membres where salon = x.id and user_id = p_user) or p_user = u then return mono.err('Ce joueur n''est pas dans le salon.'); end if;
  update mono.bureau_salons set chef = p_user where id = x.id;
  perform mono.bureau_log(x.id, mono.bureau_nom(u) || ' transmet le rôle de chef à ' || mono.bureau_nom(p_user) || '.');
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true);
end $$;

-- Lancer (chef effectif) : les présents prêts partent (2 à 4) ; un absent garde sa place ; transition de 60 s
create or replace function public.mono_bureau_lancer(p_onglet text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; n int; cid bigint; e mono.bureau_expeditions%rowtype; b text; begin
  perform mono.bureau_menage();
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return mono.err('Tu n''es dans aucun salon.'); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  if mono.bureau_chef(x.id) <> u then return mono.err('Seul le chef lance le combat.'); end if;
  if x.etat <> 'ouvert' then return mono.err(case x.etat when 'transition' then 'Lancement déjà en cours.' when 'combat' then 'Combat déjà en cours.' else 'Le salon n''est pas encore formé.' end); end if;
  if x.did is null then return mono.err('Propose d''abord un donjon.'); end if;
  if x.expedition is not null then select * into e from mono.bureau_expeditions where id = x.expedition;
    if e.heure > now() then return mono.err('Expédition : départ à l''heure annoncée, pas avant.'); end if; end if;
  select count(*) into n from mono.bureau_membres y where y.salon = x.id and y.pret and mono.bureau_present(y);
  if not exists (select 1 from mono.bureau_membres y where y.salon = x.id and y.user_id = u and y.pret) then return mono.err('Mets-toi « Prêt » d''abord.'); end if;
  if exists (select 1 from mono.bureau_membres y where y.salon = x.id and mono.bureau_present(y) and not y.pret) then return mono.err('Tous les joueurs présents doivent être prêts.'); end if;
  if n < 2 then return mono.err('Il faut au moins 2 joueurs présents et prêts.'); end if;
  if x.stasis > 1 and not exists (select 1 from mono.bureau_membres y where y.salon = x.id and y.pret and mono.bureau_present(y) and mono.bureau_smax(y.user_id, x.saison, x.did) >= x.stasis - 1) then
    return mono.err(format('Il faut au moins un joueur qui a réussi la stasis %s de ce donjon.', x.stasis - 1)); end if;
  insert into mono.bureau_combats (salon, saison, did, stasis, seed, lance_par, transition_fin) values (x.id, x.saison, x.did, x.stasis, floor(random() * 4294967295)::bigint, u, now() + mono.bsec('transition_s'))
    returning id into cid;
  insert into mono.bureau_combat_membres (combat, user_id) select cid, y.user_id from mono.bureau_membres y where y.salon = x.id and y.pret and mono.bureau_present(y);
  update mono.bureau_salons set etat = 'transition' where id = x.id;
  if x.expedition is not null then update mono.bureau_expeditions set etat = 'partie' where id = x.expedition and etat = 'ouverte'; end if;
  perform mono.bureau_log(x.id, format('%s lance le combat à %s : chacun a 60 secondes pour terminer son action solo.', mono.bureau_nom(u), n));
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true, 'combat', cid);
end $$;

-- Confirmer la transition : la dernière partie validée doit dater d'après le lancement (photo prise après une dernière sauvegarde)
create or replace function public.mono_bureau_confirmer(p_onglet text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); m mono.bureau_membres%rowtype; x mono.bureau_salons%rowtype; c mono.bureau_combats%rowtype; k mono.parties_ok%rowtype; b text; begin
  perform mono.bureau_menage();
  select * into m from mono.bureau_membres where user_id = u;
  if m.salon is null then return mono.err('Tu n''es dans aucun salon.'); end if;
  select * into x from mono.bureau_salons where id = m.salon for update;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  select * into c from mono.bureau_combats where salon = x.id and etat = 'transition' for update;
  if c.id is null then return mono.err('Aucun lancement en cours.'); end if;
  if not exists (select 1 from mono.bureau_combat_membres where combat = c.id and user_id = u) then return mono.err('Tu attends le combat suivant.'); end if;
  b := mono.bureau_bloque(u, c.saison); if b is not null then return mono.err(b); end if;
  select * into k from mono.parties_ok where user_id = u and saison = c.saison;
  if k.src_at is null or k.src_at < c.lance_at then return mono.err('Ta partie n''est pas encore validée depuis le lancement : sauvegarde en cours.'); end if;
  update mono.bureau_combat_membres set confirme_at = coalesce(confirme_at, now()) where combat = c.id and user_id = u;
  return mono.bureau_etat(u, p_onglet) || jsonb_build_object('ok', true, 'calcul', not exists (select 1 from mono.bureau_combat_membres where combat = c.id and confirme_at is null), 'combat', c.id);
end $$;

-- Récupérer son butin (une seule fois, après la fin du combat) : le jeu rejoue le combat (même graine) et donne le butin
create or replace function public.mono_bureau_butin(p_combat bigint) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); b mono.bureau_butins%rowtype; c mono.bureau_combats%rowtype; begin
  select * into b from mono.bureau_butins where combat = p_combat and user_id = u for update;
  if b.combat is null then return mono.err('Aucun butin pour toi dans ce combat.'); end if;
  if b.pris_at is not null then return mono.err('Butin déjà récupéré.'); end if;
  select * into c from mono.bureau_combats where id = p_combat;
  if c.etat <> 'fini' then return mono.err('Combat pas encore joué.'); end if;
  if c.fin_at > now() then return mono.err('Le combat n''est pas fini : le butin arrive à la fin.'); end if;
  update mono.bureau_butins set pris_at = now() where combat = p_combat and user_id = u;
  return jsonb_build_object('ok', true, 'combat', c.id, 'did', c.did, 'stasis', c.stasis, 'seed', c.seed, 'win', c.win, 'result', c.result,
    'ids', (select coalesce(jsonb_agg(z.user_id order by z.user_id), '[]'::jsonb) from mono.bureau_combat_membres z where z.combat = c.id and z.user_id <> u));
end $$;

-- Discussion du salon (7A) : 200 caractères, un message toutes les 2 s, joueurs muets ou bannis du chat refusés
create or replace function public.mono_bureau_dire(p_txt text, p_onglet text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); m mono.bureau_membres%rowtype; t text := btrim(coalesce(p_txt, '')); mute boolean := false; begin
  if public.susp(u) then return mono.err('Compte suspendu.'); end if;
  begin m := mono.bureau_moi(u, p_onglet); exception when raise_exception then return mono.err(sqlerrm); end;
  if length(t) < 1 or length(t) > 200 then return mono.err('Message de 1 à 200 caractères.'); end if;
  if to_regclass('public.chat_sanctions') is not null then
    execute 'select exists (select 1 from public.chat_sanctions where user_id = $1 and (coalesce(banned, false) or mute_until > now()))' into mute using u;
    if mute then return mono.err('Tu ne peux pas écrire dans le chat en ce moment.'); end if;
  end if;
  if exists (select 1 from mono.bureau_msgs where user_id = u and at > now() - interval '2 seconds') then return mono.err('Doucement : un message toutes les 2 secondes.'); end if;
  insert into mono.bureau_msgs (salon, user_id, body) values (m.salon, u, t);
  update mono.bureau_salons set seq = seq + 1 where id = m.salon;
  return jsonb_build_object('ok', true);
end $$;

-- Préférences : message privé du bot Discord (9B ; rien n'est envoyé tant que Mathis n'active pas le réglage « mp »)
create or replace function public.mono_bureau_prefs(p_mp boolean) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  if p_mp is not null then insert into mono.bureau_prefs (user_id, mp) values (u, p_mp) on conflict (user_id) do update set mp = excluded.mp; end if;
  return jsonb_build_object('mp', coalesce((select mp from mono.bureau_prefs where user_id = u), false), 'mp_actif', mono.bon_('mp'));
end $$;

-- ============================================================================
-- Expéditions programmées
-- ============================================================================
create or replace function public.mono_bureau_exp_creer(p_did text, p_stasis int, p_heure timestamptz, p_places int, p_note text default null)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); b text; eid bigint; begin
  perform mono.bureau_menage();
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if p_did is null or p_did !~ '^[a-z0-9_]{2,40}$' then return mono.err('Donjon inconnu.'); end if;
  if p_stasis is null or p_stasis not between 1 and 15 then return mono.err('Stasis de 1 à 15.'); end if;
  if p_places is null or p_places not between 2 and 4 then return mono.err('Départ à 2, 3 ou 4 joueurs.'); end if;
  if p_heure is null or p_heure < now() + make_interval(mins => mono.bn('ouverture_min')::int) then return mono.err('L''expédition doit partir dans plus de ' || mono.bn('ouverture_min')::int || ' minutes.'); end if;
  if p_heure > now() + make_interval(days => mono.bn('jours')::int) then return mono.err('7 jours à l''avance au plus.'); end if;
  if mono.date_saison(s) + (p_heure - now()) >= mono.fin(s) then return mono.err('Pas d''expédition après la fin de la saison.'); end if;
  perform mono.verrou(u);
  if (select count(*) from mono.bureau_expeditions where org = u and etat in ('annoncee', 'ouverte')) >= mono.bn('annonces') then return mono.err('2 annonces actives au plus.'); end if;
  if (select count(*) from mono.bureau_inscriptions i join mono.bureau_expeditions e on e.id = i.expedition where i.user_id = u and e.etat in ('annoncee', 'ouverte')) >= mono.bn('inscriptions') then
    return mono.err('3 inscriptions à la fois au plus (ton annonce compte).'); end if;
  insert into mono.bureau_expeditions (saison, org, did, stasis, heure, places, note) values (s, u, p_did, p_stasis, p_heure, p_places, nullif(left(btrim(coalesce(p_note, '')), 120), '')) returning id into eid;
  insert into mono.bureau_inscriptions (expedition, user_id) values (eid, u);
  return jsonb_build_object('ok', true, 'id', eid);
end $$;

-- L'organisateur annule (jusqu'à l'ouverture du salon) : les inscrits le voient et sont prévenus
create or replace function public.mono_bureau_exp_annuler(p_id bigint) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); e mono.bureau_expeditions%rowtype; begin
  perform mono.bureau_menage();
  select * into e from mono.bureau_expeditions where id = p_id for update;
  if e.id is null or e.org <> u then return mono.err('Expédition introuvable.'); end if;
  if e.etat <> 'annoncee' then return mono.err('Le salon est déjà ouvert : l''expédition ne s''annule plus.'); end if;
  update mono.bureau_expeditions set etat = 'annulee', motif = 'Annulée par l''organisateur.' where id = e.id;
  perform mono.bureau_notifier(i.user_id, 'Une expédition du Bureau des Aventuriers où tu étais inscrit est annulée.') from mono.bureau_inscriptions i where i.expedition = e.id and i.user_id <> u;
  return jsonb_build_object('ok', true);
end $$;

-- S'inscrire (même organisateur hors ligne) ou se désinscrire ; liste d'attente de 2 places
create or replace function public.mono_bureau_exp_inscrire(p_id bigint, p_on boolean) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.bureau_saison(); e mono.bureau_expeditions%rowtype; b text; n int; w int; warn text := null; was mono.bureau_inscriptions%rowtype; begin
  perform mono.bureau_menage();
  select * into e from mono.bureau_expeditions where id = p_id for update;
  if e.id is null then return mono.err('Expédition introuvable.'); end if;
  if not coalesce(p_on, false) then
    if e.org = u then return mono.err('Tu organises cette expédition : annule-la plutôt.'); end if;
    delete from mono.bureau_inscriptions where expedition = e.id and user_id = u returning * into was;
    if was.user_id is not null and not was.attente and e.etat = 'annoncee' then -- la première place d'attente monte
      update mono.bureau_inscriptions set attente = false where expedition = e.id and user_id = (select user_id from mono.bureau_inscriptions where expedition = e.id and attente order by at limit 1);
    end if;
    return jsonb_build_object('ok', true);
  end if;
  b := mono.bureau_bloque(u, s); if b is not null then return mono.err(b); end if;
  if e.etat <> 'annoncee' or e.saison <> s then return mono.err('Inscriptions fermées pour cette expédition.'); end if;
  if exists (select 1 from mono.bureau_inscriptions where expedition = e.id and user_id = u) then return mono.err('Tu es déjà inscrit.'); end if;
  if (select count(*) from mono.bureau_inscriptions i join mono.bureau_expeditions x on x.id = i.expedition where i.user_id = u and x.etat in ('annoncee', 'ouverte')) >= mono.bn('inscriptions') then
    return mono.err('3 inscriptions à la fois au plus.'); end if;
  if exists (select 1 from mono.bureau_inscriptions i where i.expedition = e.id and mono.bureau_meme_appareil(i.user_id, u)) then return mono.err('Un compte du même appareil est déjà inscrit.'); end if;
  select count(*) filter (where not attente), count(*) filter (where attente) into n, w from mono.bureau_inscriptions where expedition = e.id;
  if n >= e.places and w >= mono.bn('liste_attente') then return mono.err('Complète, liste d''attente comprise.'); end if;
  insert into mono.bureau_inscriptions (expedition, user_id, attente) values (e.id, u, n >= e.places);
  -- prévenu à l'inscription : il garde sa place, la règle 4A s'applique au départ
  if e.stasis > 1 and mono.bureau_smax(u, s, e.did) < e.stasis - 1 then
    warn := format('Tu n''as pas encore réussi la stasis %s de ce donjon : au départ, il faudra qu''un autre joueur l''ait réussie.', e.stasis - 1); end if;
  return jsonb_build_object('ok', true, 'attente', n >= e.places, 'avertissement', warn);
end $$;

create or replace function public.mono_bureau_expeditions() returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte(); begin
  perform mono.bureau_menage();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'did', e.did, 'stasis', e.stasis, 'heure', e.heure, 'places', e.places, 'note', e.note, 'etat', e.etat, 'motif', e.motif,
      'org', mono.bureau_nom(e.org), 'moi_org', e.org = u, 'salon', e.salon,
      'inscrits', (select coalesce(jsonb_agg(mono.bureau_nom(i.user_id) order by i.at), '[]'::jsonb) from mono.bureau_inscriptions i where i.expedition = e.id and not i.attente),
      'attente', (select coalesce(jsonb_agg(mono.bureau_nom(i.user_id) order by i.at), '[]'::jsonb) from mono.bureau_inscriptions i where i.expedition = e.id and i.attente),
      'moi', (select case when i.attente then 'attente' else 'inscrit' end from mono.bureau_inscriptions i where i.expedition = e.id and i.user_id = u)) order by e.heure, e.id), '[]'::jsonb)
    from mono.bureau_expeditions e where e.saison = s and (e.etat in ('annoncee', 'ouverte', 'partie') and e.heure > now() - interval '2 hours'
      or (e.etat in ('annulee', 'vide') and e.heure > now() - interval '1 day' and exists (select 1 from mono.bureau_inscriptions i where i.expedition = e.id and i.user_id = u))));
end $$;

-- ============================================================================
-- Rendez-vous communautaires (11A) : créneaux en heure de Paris, « Je pense venir » sans engagement ni récompense
-- ============================================================================
-- prochaine occurrence d'un créneau (en cours pendant rdv_min minutes)
create or replace function mono.bureau_rdv_at(h time) returns timestamptz language sql stable set search_path = mono, public
as $$ select case when (((now() at time zone 'Europe/Paris')::date + h) at time zone 'Europe/Paris') + make_interval(mins => mono.bn('rdv_min')::int) > now()
  then ((now() at time zone 'Europe/Paris')::date + h) at time zone 'Europe/Paris'
  else (((now() at time zone 'Europe/Paris')::date + 1 + h) at time zone 'Europe/Paris') end $$;
create or replace function public.mono_bureau_rdv() returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); begin
  if not mono.bon_('rdv') then return jsonb_build_object('actif', false, 'creneaux', '[]'::jsonb); end if;
  return jsonb_build_object('actif', true, 'creneaux', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom, 'heure', to_char(c.heure, 'HH24:MI'), 'at', t.at,
      'en_cours', t.at <= now(), 'fin', t.at + make_interval(mins => mono.bn('rdv_min')::int),
      'venir', (select count(*) from mono.bureau_intentions i where i.creneau = c.id and i.jour = (t.at at time zone 'Europe/Paris')::date),
      'moi', exists (select 1 from mono.bureau_intentions i where i.creneau = c.id and i.jour = (t.at at time zone 'Europe/Paris')::date and i.user_id = u),
      'en_recherche', case when t.at <= now() then (select count(*) from mono.bureau_recherches) end) order by t.at), '[]'::jsonb)
    from mono.bureau_creneaux c cross join lateral (select mono.bureau_rdv_at(c.heure) at) t where c.actif));
end $$;
create or replace function public.mono_bureau_rdv_venir(p_creneau int, p_on boolean) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); c mono.bureau_creneaux%rowtype; j date; begin
  select * into c from mono.bureau_creneaux where id = p_creneau and actif;
  if c.id is null or not mono.bon_('rdv') then return mono.err('Créneau inconnu.'); end if;
  j := (mono.bureau_rdv_at(c.heure) at time zone 'Europe/Paris')::date;
  if coalesce(p_on, false) then insert into mono.bureau_intentions (creneau, jour, user_id) values (c.id, j, u) on conflict do nothing;
  else delete from mono.bureau_intentions where creneau = c.id and jour = j and user_id = u; end if;
  return public.mono_bureau_rdv();
end $$;

-- ============================================================================
-- Panneau de Mathis
-- ============================================================================
create or replace function public.mono_adm_bureau() returns jsonb language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  perform mono.bureau_menage();
  return jsonb_build_object(
    'reglages', (select jsonb_object_agg(cle, v) from mono.bureau_reglages),
    'creneaux', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'heure', to_char(heure, 'HH24:MI'), 'nom', nom, 'actif', actif) order by heure), '[]'::jsonb) from mono.bureau_creneaux),
    'salons', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'etat', x.etat, 'did', x.did, 'stasis', x.stasis, 'expedition', x.expedition,
        'membres', (select jsonb_agg(mono.bureau_nom(m.user_id)) from mono.bureau_membres m where m.salon = x.id)) order by x.id), '[]'::jsonb) from mono.bureau_salons x where x.etat <> 'ferme'),
    'expeditions', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'org', mono.bureau_nom(e.org), 'did', e.did, 'stasis', e.stasis, 'heure', e.heure, 'etat', e.etat,
        'n', (select count(*) from mono.bureau_inscriptions i where i.expedition = e.id)) order by e.heure), '[]'::jsonb) from mono.bureau_expeditions e where e.etat in ('annoncee', 'ouverte')),
    -- groupes suspects (5A : indices, jamais de sanction automatique) : mêmes paires souvent ensemble (7 jours), comptes vus sur un même appareil
    'suspects', (select coalesce(jsonb_agg(jsonb_build_object('a', mono.bureau_nom(a), 'b', mono.bureau_nom(b), 'combats', n) order by n desc), '[]'::jsonb) from (
        select x.user_id a, y.user_id b, count(*) n from mono.bureau_combat_membres x join mono.bureau_combat_membres y on y.combat = x.combat and y.user_id > x.user_id
          join mono.bureau_combats c on c.id = x.combat where c.etat = 'fini' and c.debut_at > now() - interval '7 days' group by 1, 2 having count(*) >= mono.bn('suspects_n') limit 50) z),
    'appareils', (select coalesce(jsonb_agg(jsonb_build_object('a', mono.bureau_nom(a), 'b', mono.bureau_nom(b), 'ua', a, 'ub', b, 'ok', exists (select 1 from mono.bureau_paires_ok p where p.a = z.a and p.b = z.b))), '[]'::jsonb) from (
        select distinct least(x.user_id, y.user_id) a, greatest(x.user_id, y.user_id) b from mono.bureau_appareils x join mono.bureau_appareils y on y.appareil = x.appareil and y.user_id <> x.user_id limit 50) z));
end $$;
create or replace function public.mono_adm_bureau_reglage(p_cle text, p_v jsonb) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  if not exists (select 1 from mono.bureau_reglages where cle = p_cle) then raise exception 'réglage inconnu'; end if;
  if jsonb_typeof(p_v) <> jsonb_typeof((select v from mono.bureau_reglages where cle = p_cle)) then raise exception 'type de réglage incorrect'; end if;
  update mono.bureau_reglages set v = p_v, at = now() where cle = p_cle;
  return (select jsonb_object_agg(cle, v) from mono.bureau_reglages);
end $$;
create or replace function public.mono_adm_bureau_creneau(p_id int, p_heure time, p_nom text, p_actif boolean) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  if p_id is null or p_id < 1 then raise exception 'créneau inconnu'; end if;
  if p_heure is null and p_nom is null and p_actif is null then delete from mono.bureau_creneaux where id = p_id;
  else insert into mono.bureau_creneaux (id, heure, nom, actif) values (p_id, coalesce(p_heure, '20:30'), coalesce(left(p_nom, 60), 'Rendez-vous'), coalesce(p_actif, false))
    on conflict (id) do update set heure = coalesce(p_heure, mono.bureau_creneaux.heure), nom = coalesce(left(p_nom, 60), mono.bureau_creneaux.nom), actif = coalesce(p_actif, mono.bureau_creneaux.actif); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'heure', to_char(heure, 'HH24:MI'), 'nom', nom, 'actif', actif) order by heure), '[]'::jsonb) from mono.bureau_creneaux);
end $$;
create or replace function public.mono_adm_bureau_exp_annuler(p_id bigint, p_motif text) returns text language plpgsql security definer set search_path = mono, public
as $$ declare e mono.bureau_expeditions%rowtype; begin
  perform mono.need_admin();
  select * into e from mono.bureau_expeditions where id = p_id for update;
  if e.id is null or e.etat not in ('annoncee', 'ouverte') then return 'Expédition introuvable ou déjà partie.'; end if;
  update mono.bureau_expeditions set etat = 'annulee', motif = coalesce(nullif(left(p_motif, 120), ''), 'Annulée par Mathis.') where id = e.id;
  if e.salon is not null then delete from mono.bureau_membres where salon = e.salon; update mono.bureau_salons set etat = 'ferme', ferme_at = now(), motif = 'annulée par Mathis' where id = e.salon and etat in ('ouvert', 'invitation'); end if;
  perform mono.bureau_notifier(i.user_id, 'Une expédition du Bureau des Aventuriers où tu étais inscrit est annulée.') from mono.bureau_inscriptions i where i.expedition = e.id;
  return null;
end $$;
-- 5A : décision finale de Mathis sur deux comptes vus sur le même appareil (p_ok : ils peuvent jouer ensemble)
create or replace function public.mono_adm_bureau_paire(p_a uuid, p_b uuid, p_ok boolean) returns text language plpgsql security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  if p_ok then insert into mono.bureau_paires_ok (a, b) values (least(p_a::text, p_b::text)::uuid, greatest(p_a::text, p_b::text)::uuid) on conflict do nothing;
  else delete from mono.bureau_paires_ok where a = least(p_a::text, p_b::text)::uuid and b = greatest(p_a::text, p_b::text)::uuid; end if;
  return null;
end $$;

-- ============================================================================
-- Fonction serveur « mono » (route { bureau: { combat } }, rôle service_role) : le combat de groupe
-- ============================================================================
-- Photos : verrou sur le combat, une seule fonction le calcule (les autres attendent le résultat) ; reprise après une coupure
-- (même graine, même résultat). Renvoie les parties validées des joueurs (jamais rien du navigateur).
create or replace function public.mono_srv_bureau_photos(p_user uuid, p_combat bigint) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare c mono.bureau_combats%rowtype; begin
  perform mono.bureau_menage();
  select * into c from mono.bureau_combats where id = p_combat for update;
  if c.id is null or not exists (select 1 from mono.bureau_membres where salon = c.salon and user_id = p_user) and not exists (select 1 from mono.bureau_combat_membres where combat = c.id and user_id = p_user) then
    return mono.err('combat inconnu'); end if;
  if c.etat = 'fini' then return jsonb_build_object('deja', true, 'combat', c.id); end if;
  if c.etat = 'annule' then return mono.err(coalesce(c.motif, 'lancement annulé')); end if;
  if c.etat = 'calcul' and c.calc_at > now() - mono.bsec('calcul_s') then return jsonb_build_object('attente', true, 'combat', c.id); end if;
  if c.etat = 'transition' and exists (select 1 from mono.bureau_combat_membres where combat = c.id and confirme_at is null) then return mono.err('tout le monde n''a pas encore confirmé'); end if;
  update mono.bureau_combats set etat = 'calcul', calc_at = now() where id = c.id;
  return jsonb_build_object('combat', c.id, 'did', c.did, 'stasis', c.stasis, 'seed', c.seed, 'at', floor(extract(epoch from c.lance_at))::bigint * 1000,
    'membres', (select jsonb_agg(jsonb_build_object('user', z.user_id, 'pseudo', mono.bureau_nom(z.user_id), 'data', k.data) order by z.user_id)
      from mono.bureau_combat_membres z left join mono.parties_ok k on k.user_id = z.user_id and k.saison = c.saison where z.combat = c.id));
end $$;

-- Résultat du combat joué par la fonction serveur. p_exclus : [{ user, why }] (donjon pas débloqué, donjon solo en cours,
-- héros illisible…) : lancement annulé pour tous, ces joueurs ne sont plus prêts. Sinon : clé de chaque joueur retirée (une
-- opération du serveur), combat enregistré, un butin par joueur, bons de butin et défis (dont le défi 12) pour une victoire.
drop function if exists public.mono_srv_bureau_resultat(bigint, jsonb, jsonb, int, text, jsonb);
create or replace function public.mono_srv_bureau_resultat(p_combat bigint, p_snaps text, p_result text, p_duree_ms int, p_cle text, p_exclus jsonb)
returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare c mono.bureau_combats%rowtype; z record; d jsonb; ex uuid[] := '{}'; why text := ''; w boolean; j int; begin
  select * into c from mono.bureau_combats where id = p_combat for update;
  if c.id is null or c.etat <> 'calcul' then return mono.err('combat pas en calcul'); end if;
  for z in select (e ->> 'user')::uuid u, e ->> 'why' w from jsonb_array_elements(coalesce(p_exclus, '[]'::jsonb)) e loop
    ex := ex || z.u; why := why || mono.bureau_nom(z.u) || ' : ' || left(coalesce(z.w, 'refusé'), 80) || '. '; end loop;
  -- clé du donjon : dans la partie validée de chacun (plus ce que le serveur lui a donné depuis)
  if p_cle is not null then
    for z in select m.user_id from mono.bureau_combat_membres m where m.combat = c.id and not (m.user_id = any(ex)) loop
      select data::jsonb into d from mono.parties_ok where user_id = z.user_id and saison = c.saison;
      if d is null or mono.qty(z.user_id, c.saison, d, 'res', p_cle) < 1 then ex := ex || z.user_id; why := why || mono.bureau_nom(z.user_id) || ' : pas de clé. '; end if;
    end loop;
  end if;
  if cardinality(ex) > 0 then
    perform mono.bureau_annuler(c.id, 'Lancement annulé. ' || why, ex);
    return jsonb_build_object('ok', false, 'annule', true, 'why', why);
  end if;
  if p_duree_ms is null or p_duree_ms < 0 or p_duree_ms > 3 * 3600 * 1000 then return mono.err('durée impossible'); end if;
  if p_snaps is null or p_result is null then return mono.err('combat incomplet'); end if;
  -- copie de renfort d'un ami (mono_social.sql : rf, renfort, snap) ou mercenaire : jamais dans un groupe de joueurs ; une
  -- photo par joueur du combat (la fonction serveur n'en envoie pas d'autre)
  begin d := p_snaps::jsonb; exception when others then d := null; end;
  if d is null or jsonb_typeof(d) <> 'array' or jsonb_array_length(d) <> (select count(*) from mono.bureau_combat_membres where combat = c.id)
     or exists (select 1 from jsonb_array_elements(d) e where jsonb_typeof(e) <> 'object' or e ? 'rf' or e ? 'renfort' or e ? 'snap' or coalesce(e ->> 'merc', '0') not in ('0', 'false')) then
    perform mono.bureau_annuler(c.id, 'Lancement annulé : la copie d''un renfort (ou un mercenaire) ne joue jamais dans un groupe de joueurs.', '{}');
    return jsonb_build_object('ok', false, 'annule', true, 'err', 'renfort refusé en groupe');
  end if;
  w := coalesce((p_result::jsonb ->> 'done')::boolean, false);
  j := mono.jour_de(c.saison, mono.date_saison(c.saison));
  if p_cle is not null then
    for z in select m.user_id from mono.bureau_combat_membres m where m.combat = c.id loop
      perform mono.op(z.user_id, c.saison, jsonb_build_object('res', jsonb_build_object(p_cle, -1)), 'Clé utilisée : donjon de groupe du Bureau des Aventuriers');
    end loop;
  end if;
  update mono.bureau_combats set etat = 'fini', snaps = p_snaps, result = p_result, duree_ms = p_duree_ms, win = w, manche = mono.manche_de(least(j, 56)),
    debut_at = now(), fin_at = now() + make_interval(secs => p_duree_ms / 1000.0) where id = c.id returning * into c;
  insert into mono.bureau_butins (combat, user_id) select c.id, m.user_id from mono.bureau_combat_membres m where m.combat = c.id on conflict do nothing;
  update mono.bureau_salons set etat = 'combat' where id = c.salon;
  for z in select m.user_id from mono.bureau_combat_membres m where m.combat = c.id loop
    if w then perform mono.bon(z.user_id, c.saison, 'grp', 'g:' || c.id, 1); end if; -- Éclats « donjons en groupe » : un bon par combat et par joueur
    perform mono.payer_defis(z.user_id, c.saison); -- défi 12 (et les autres) d'après le serveur
  end loop;
  perform mono.bureau_log(c.salon, case when w then 'Combat lancé : tout le monde le regarde en direct.' else 'Combat lancé.' end);
  return jsonb_build_object('ok', true, 'combat', c.id, 'debut', c.debut_at, 'fin', c.fin_at, 'win', w);
end $$;

-- Horloge du serveur (planificateur, pas encore installé : accord de Mathis) : l'entretien sans aucun joueur connecté
create or replace function public.mono_srv_bureau_horloge() returns void language plpgsql security definer set search_path = mono, public
as $$ begin perform mono.bureau_menage(); end $$;
-- Messages privés Discord à envoyer (9B) : vide tant que le réglage « mp » est coupé. Marqués envoyés à la lecture.
create or replace function public.mono_srv_bureau_mp(p_lim int default 50) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare r jsonb; begin
  if not mono.bon_('mp') then return '[]'::jsonb; end if;
  with x as (update mono.bureau_mp set envoye_at = now() where id in (select id from mono.bureau_mp where envoye_at is null order by id limit greatest(1, least(p_lim, 200))) returning *)
  select coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'txt', txt) order by id), '[]'::jsonb) into r from x;
  return r;
end $$;

-- ---------- droits d'appel (même règle que monocompte.sql) ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'mono' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (p.proname like 'mono\_bureau\_%' or p.proname like 'mono\_adm\_bureau%') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'mono\_srv\_bureau\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;
