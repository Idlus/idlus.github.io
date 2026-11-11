select schemaname sch, tablename tbl, policyname pol, cmd, array_to_string(roles, ',') roles,
  regexp_replace(coalesce(qual, '-'), '\s+', ' ', 'g') lecture, regexp_replace(coalesce(with_check, '-'), '\s+', ' ', 'g') ecriture
from pg_policies
where schemaname in ('public', 's1', 'mono')
order by (qual ~* 'auth\.uid\(\)'), 1, 2, 3
