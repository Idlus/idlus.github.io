-- 22/10/2026 : messages privés de Xener à Ley et Zoubilus après le retrait des gains du Classique (choix écrit de Mathis « a et préviens les »).
\set ON_ERROR_STOP on
begin;
insert into public.chat_msgs (ch, user_id, to_id, pseudo, body)
select 'p', x.id, p.id, x.pseudo, case lower(p.pseudo)
  when 'ley' then 'Salut Ley ! Un bug de la bêta faisait arriver des kamas du Classique dans ta partie Monocompte. Ces kamas et le Havre-Sac acheté avec ont été retirés. Corrigé en 2.1.37.3, merci de tester !'
  else 'Salut Zoubilus ! Un bug de la bêta faisait arriver des kamas du Classique dans ta partie Monocompte. Ces kamas et le Havre-Sac acheté avec ont été retirés. Corrigé en 2.1.37.3, merci de tester !' end
from public.profiles p, public.profiles x where lower(p.pseudo) in ('ley', 'zoubilus') and lower(x.pseudo) = 'xener';
commit;
select count(*) messages from public.chat_msgs where ch = 'p' and created_at > now() - interval '1 minute' and pseudo = 'Xener';
