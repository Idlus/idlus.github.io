select c.relnamespace::regnamespace sch, c.relname tbl, c.relkind k, c.relrowsecurity rls,
  string_agg(distinct g.grantee || ':' || g.privilege_type, ' ') filter (where g.privilege_type <> 'SELECT') ecriture,
  bool_or(g.grantee = 'anon' and g.privilege_type = 'SELECT') lect_anon, bool_or(g.grantee = 'authenticated' and g.privilege_type = 'SELECT') lect_auth,
  (select string_agg(pl.polname || '[' || pl.polcmd::text || ']', ' ') from pg_policy pl where pl.polrelid = c.oid) politiques
from pg_class c join information_schema.role_table_grants g on g.table_schema = c.relnamespace::regnamespace::text and g.table_name = c.relname
where c.relnamespace::regnamespace::text in ('public', 's1', 'mono') and g.grantee in ('anon', 'authenticated', 'PUBLIC') and c.relkind in ('r', 'v', 'm', 'p')
group by 1, 2, 3, 4, c.oid
having bool_or(g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')) or (bool_or(g.privilege_type = 'SELECT') and (not c.relrowsecurity or c.relkind <> 'r'))
order by 4, 1, 2
