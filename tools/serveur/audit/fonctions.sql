select n.nspname sch, p.proname fn, pg_get_function_identity_arguments(p.oid) args, p.prosecdef secdef,
  has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth,
  position('auth.uid()' in p.prosrc) > 0 uid, (p.prosrc ~* 'is_admin|admins|adm_|is_mod|est_admin') admin_chk,
  (p.prosrc ~* '\m(insert|update|delete)\M') ecrit, length(p.prosrc) taille
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 's1', 'mono') and p.prokind = 'f'
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  and p.prosecdef
order by (not has_function_privilege('anon', p.oid, 'execute')), (position('auth.uid()' in p.prosrc) > 0), n.nspname, p.proname
