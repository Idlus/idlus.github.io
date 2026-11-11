select coalesce(i.provider, 'aucun') fournisseur, count(distinct u.id) comptes,
  count(distinct u.id) filter (where u.created_at > now() - interval '7 days') nouveaux_7j,
  count(distinct u.id) filter (where u.phone is not null and u.phone <> '') avec_telephone,
  count(distinct u.id) filter (where u.is_anonymous) anonymes,
  count(distinct u.id) filter (where not exists (select 1 from public.profiles p where p.id = u.id)) sans_pseudo
from auth.users u left join auth.identities i on i.user_id = u.id
group by 1 order by 2 desc
