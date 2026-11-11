select 'admins' quoi, count(*) n from public.admins
union all select 'mods', count(*) from public.mods
union all select 'reglage_jwt_exp', nullif(current_setting('app.settings.jwt_exp', true), '')::int
