-- ============================================================================
-- Idlus — clés bêta du Monocompte (demande de Mathis : des clés à donner aux joueurs pour entrer dans la bêta).
-- DÉPLOIEMENT MANUEL SEULEMENT, comme monocompte.sql : ce fichier n'est PAS dans la liste « tous » de
-- .github/workflows/supabase.yml et ne doit jamais y entrer. Il se charge APRÈS monocompte.sql (il utilise mono.testeurs,
-- mono.need_admin, mono.err, mono.verrou) ; dans l'ordre du Monocompte : monocompte.sql → amis.sql → mono_social.sql →
-- mono_bureau.sql → mono_cles.sql. Relançable sans danger : il ne supprime ni ne vide rien.
--
-- Une clé (MONO-XXXX-XXXX) ouvre l'espace Monocompte à UN compte : la fonction du joueur mono_cle_utiliser l'inscrit dans
-- mono.testeurs (comme mono_adm_testeur). Retirer un testeur reste mono_adm_testeur(pseudo, false) ; sa clé reste utilisée,
-- et un compte qui a déjà utilisé une clé n'en utilise pas une deuxième.
-- Savoir si on est testeur : public.mono_acces() (monocompte.sql) le dit déjà ({ ok }), aucune fonction en plus.
--
-- Panel (compte admin) :
--   select mono_adm_cles_creer(20, 'Vague 1');   -- 20 clés du lot « Vague 1 » (1 à 100 par appel)
--   select mono_adm_cles();                       -- toutes les clés : libres, utilisées (pseudo, date), annulées
--   select mono_adm_cle_annuler('MONO-ABCD-EFGH'); -- une clé libre ne sert plus
-- ============================================================================

-- ---------- tables (schéma mono, jamais exposé par l'API) ----------
create table if not exists mono.cles (
  code text primary key check (code ~ '^MONO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  cree_par uuid,
  cree_a timestamptz not null default now(),
  lot text check (lot is null or length(lot) <= 60),
  annulee boolean not null default false,
  utilisee_par uuid unique, -- pas de clé étrangère : un compte effacé laisse sa clé utilisée
  utilisee_a timestamptz
);
-- journal des essais ratés (5 par heure et par compte)
create table if not exists mono.cles_essais (
  id bigserial primary key,
  user_id uuid not null,
  saisie text,
  at timestamptz not null default now()
);
create index if not exists cles_essais_user on mono.cles_essais (user_id, at);

do $$ declare t text; begin
  foreach t in array array['cles', 'cles_essais'] loop
    execute format('alter table mono.%I enable row level security', t);
    execute format('revoke all on mono.%I from public, anon, authenticated', t); -- aucune lecture ni écriture directe
  end loop;
  revoke all on sequence mono.cles_essais_id_seq from public, anon, authenticated;
end $$;

-- ---------- fonctions internes ----------
-- saisie du joueur → MONO-XXXX-XXXX (majuscules, sans espaces ni tirets ; « MONO » peut être omis), null si le format est faux
create or replace function mono.cle_norm(p text) returns text language sql immutable
as $$ select case when x ~ '^[A-HJ-NP-Z2-9]{8}$' then 'MONO-' || substr(x, 1, 4) || '-' || substr(x, 5, 4) end
  from (select regexp_replace(regexp_replace(upper(coalesce(p, '')), '[\s\-–—_.]', '', 'g'), '^MONO', '') x) s $$;
-- 8 caractères tirés au hasard dans un alphabet sans caractères ambigus (ni 0/O, ni 1/I) : 32 lettres et chiffres
create or replace function mono.cle_alea() returns text language plpgsql volatile set search_path = mono, public
as $$ declare a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; h text; r text := ''; i int; begin
  if to_regprocedure('gen_random_uuid()') is not null then h := md5(gen_random_uuid()::text || clock_timestamp()::text);
  else h := md5(random()::text || clock_timestamp()::text || random()::text); end if;
  for i in 0..7 loop r := r || substr(a, (('x' || substr(h, i * 2 + 1, 2))::bit(8)::int % 32) + 1, 1); end loop; -- 256 = 8 × 32 : sans biais
  return r;
end $$;

-- ---------- panel de Mathis (admin seulement) ----------
create or replace function public.mono_adm_cles_creer(p_n int, p_lot text default null) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare L text[] := '{}'; c text; essais int := 0; lot_ text := nullif(left(btrim(coalesce(p_lot, '')), 60), ''); begin
  perform mono.need_admin();
  if p_n is null or p_n < 1 or p_n > 100 then raise exception 'de 1 à 100 clés à la fois'; end if;
  while coalesce(array_length(L, 1), 0) < p_n loop
    essais := essais + 1; if essais > p_n * 20 then raise exception 'tirage des clés impossible'; end if;
    c := mono.cle_alea(); c := 'MONO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
    insert into mono.cles (code, cree_par, lot) values (c, auth.uid(), lot_) on conflict (code) do nothing;
    if found then L := L || c; end if;
  end loop;
  return to_jsonb(L);
end $$;
create or replace function public.mono_adm_cles() returns jsonb language plpgsql stable security definer set search_path = mono, public
as $$ begin
  perform mono.need_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('code', k.code, 'lot', k.lot, 'annulee', k.annulee, 'cree', k.cree_a, 'user', k.utilisee_par,
      'pseudo', p.pseudo, 'at', k.utilisee_a, 'testeur', exists (select 1 from mono.testeurs t where t.user_id = k.utilisee_par))
    order by k.cree_a desc, k.code), '[]'::jsonb)
    from mono.cles k left join public.profiles p on p.id = k.utilisee_par);
end $$;
-- annuler une clé libre (une clé utilisée reste : retirer le testeur, c'est mono_adm_testeur). Renvoie null si c'est fait.
create or replace function public.mono_adm_cle_annuler(p_code text) returns text language plpgsql security definer set search_path = mono, public
as $$ declare k mono.cles%rowtype; begin
  perform mono.need_admin();
  select * into k from mono.cles where code = mono.cle_norm(p_code) for update;
  if not found then return 'Clé inconnue.'; end if;
  if k.utilisee_par is not null then return 'Clé déjà utilisée : retire plutôt le testeur.'; end if;
  update mono.cles set annulee = true where code = k.code;
  return null;
end $$;

-- ---------- le joueur entre sa clé (Options › Compte › Bêta Monocompte) ----------
-- { ok: true, msg } (deja: true si le compte était déjà testeur : aucune clé n'est prise) ou { err }
create or replace function public.mono_cle_utiliser(p_code text) returns jsonb language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := auth.uid(); c text; k mono.cles%rowtype; rate constant text := 'Trop d''essais ratés : réessaie dans une heure.'; begin
  if u is null then return mono.err('Connecte-toi d''abord.'); end if;
  if btrim(coalesce(p_code, '')) = '' then return mono.err('Entre ta clé.'); end if;
  perform mono.verrou(u); -- deux essais du même compte passent l'un après l'autre
  if mono.acces(u) then return jsonb_build_object('ok', true, 'deja', true, 'msg', 'Tu es déjà testeur.'); end if;
  if (select count(*) from mono.cles_essais where user_id = u and at > now() - interval '1 hour') >= 5 then return mono.err(rate); end if;
  if exists (select 1 from mono.cles where utilisee_par = u) then return mono.err('Ce compte a déjà utilisé une clé.'); end if;
  c := mono.cle_norm(p_code);
  if c is not null then
    perform pg_advisory_xact_lock(hashtextextended('mono-cle:' || c, 0));
    select * into k from mono.cles where code = c for update; -- deux comptes sur la même clé : un seul gagne
  end if;
  if c is null or k.code is null then
    insert into mono.cles_essais (user_id, saisie) values (u, left(p_code, 40)); return mono.err('Clé inconnue.'); end if;
  if k.annulee then insert into mono.cles_essais (user_id, saisie) values (u, c); return mono.err('Cette clé a été annulée.'); end if;
  if k.utilisee_par is not null then insert into mono.cles_essais (user_id, saisie) values (u, c); return mono.err('Cette clé a déjà été utilisée.'); end if;
  update mono.cles set utilisee_par = u, utilisee_a = now() where code = c;
  insert into mono.testeurs (user_id, par) values (u, null) on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true, 'msg', 'Bienvenue dans la bêta Monocompte !');
end $$;

-- ---------- droits d'appel (même règle que monocompte.sql, pour les fonctions de ce fichier seulement) ----------
revoke all on function mono.cle_norm(text), mono.cle_alea() from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['public.mono_adm_cles_creer(int, text)', 'public.mono_adm_cles()', 'public.mono_adm_cle_annuler(text)', 'public.mono_cle_utiliser(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
