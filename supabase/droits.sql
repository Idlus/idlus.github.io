-- ============================================================================
-- 05/11/2026 (fil « Grand nettoyage des bugs et failles ») : droits d'écriture des joueurs sur les tables.
-- Supabase donne par défaut aux rôles du jeu (anon, authenticated) le droit d'écrire dans toutes les tables. Ces droits ne
-- servaient à rien (les règles RLS refusent déjà toute écriture directe : le jeu passe par les fonctions du serveur), mais
-- une règle ou une vue ajoutée trop vite un jour les aurait rendus dangereux. On les retire partout (public, s1, mono),
-- sauf les deux écritures directes voulues : créer son pseudo (profiles) et ignorer un joueur (ignores).
-- La lecture ne change pas. Les fonctions du serveur (security definer) et les fonctions Edge (service_role) non plus.
-- Installé par l'étape « droits-ecriture » de Serveur OVH (sauvegarde de la base avant). Relançable sans danger.
-- ============================================================================
do $$ declare r record; begin
  for r in select n.nspname sch, c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname in ('public', 's1', 'mono') and c.relkind in ('r', 'v', 'm', 'p', 'f') loop
    execute format('revoke insert, update, delete, truncate, references, trigger on %I.%I from anon, authenticated', r.sch, r.t);
  end loop;
  if to_regclass('public.profiles') is not null then grant insert on public.profiles to authenticated; end if;
  if to_regclass('public.ignores') is not null then grant insert, delete on public.ignores to authenticated; end if;
end $$;
-- 11/11/2026 (fil « Vérifier la sécurité des données du jeu ») : les tables et vues créées APRÈS le 05/11 avaient de nouveau
-- reçu les droits d'écriture par défaut de Supabase (public.vote_ji_claims, vues s1.lb_defi*). On retire aussi ces droits
-- « par défaut » : une future table ne donne plus aux joueurs que la lecture (que ses règles RLS filtrent toujours).
do $$ declare r text; s text; begin
  foreach r in array array['postgres', 'supabase_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then continue; end if;
    foreach s in array array['public', 's1', 'mono'] loop
      if to_regnamespace(s) is null then continue; end if;
      begin
        execute format('alter default privileges for role %I in schema %I revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated', r, s);
      exception when insufficient_privilege then raise notice 'droits par défaut de % non modifiables ici', r;
      end;
    end loop;
  end loop;
end $$;
