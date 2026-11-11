select n.nspname sch, c.relname tbl, has_table_privilege('anon', c.oid, 'select') anon, has_table_privilege('authenticated', c.oid, 'select') auth,
  c.relrowsecurity rls, (select count(*) from pg_policy p where p.polrelid = c.oid) nb_pol
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 's1', 'mono') and c.relkind in ('r','v','m','p')
  and c.relname ~* 'cle|key|secret|token|config|admin|code|vote|webhook|param|reglage'
order by 1, 2
