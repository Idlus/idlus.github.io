-- 22/10/2026 : messages privés de Xener à Ley et Zoubilus après le retrait des gains du Classique (choix écrit de Mathis « a et préviens les »).
\set ON_ERROR_STOP on
begin;
insert into public.chat_msgs (ch, user_id, to_id, pseudo, body)
select 'p', x.id, p.id, x.pseudo, case lower(p.pseudo)
  when 'ley' then 'Salut Ley ! Un bug de la bêta faisait arriver des kamas du serveur Classique dans ta partie Monocompte (vente directe, Foire…). Ces kamas et les améliorations de Havre-Sac achetées avec ont été retirés. Le bug est corrigé dans la 2.1.37.3, merci de tester !'
  else 'Salut Zoubilus ! Un bug de la bêta faisait arriver des kamas du serveur Classique dans ta partie Monocompte (vente directe, Foire…). Ces kamas et les améliorations de Havre-Sac achetées avec ont été retirés. Le bug est corrigé dans la 2.1.37.3, merci de tester !' end
from public.profiles p, public.profiles x where lower(p.pseudo) in ('ley', 'zoubilus') and lower(x.pseudo) = 'xener';
commit;
select count(*) messages from public.chat_msgs where ch = 'p' and created_at > now() - interval '1 minute' and pseudo = 'Xener';
