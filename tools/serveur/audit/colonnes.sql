select c.table_schema sch, c.table_name tbl, string_agg(c.column_name, ',' order by c.ordinal_position) cols
from information_schema.columns c join pg_class k on k.relname = c.table_name and k.relnamespace::regnamespace::text = c.table_schema
where c.table_schema in ('public', 's1', 'mono') and (has_table_privilege('anon', k.oid, 'select') or has_table_privilege('authenticated', k.oid, 'select'))
  and (k.relkind <> 'r' or not k.relrowsecurity)
  and c.column_name ~* '^(data|email|ip|device|cle|key|token|secret|meta|bilan|why|code)$'
group by 1, 2 order by 1, 2
