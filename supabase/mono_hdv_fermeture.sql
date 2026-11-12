-- ============================================================================
-- Idlus 3.0 — fermeture de l'HdV de saison du Monocompte (Mathis 13/11/2026, carte « Fermer aussi l'HdV de saison du Monocompte ? » :
-- « Le fermer aussi »). À lancer UNE fois au moment de publier la 3.0, après supabase/monocompte.sql (drapeau mono.hdv_ferme,
-- refus « fermé » dans mono_hdv_list, _buy, _reprice, _order_new, _order_fill) : workflow « Serveur OVH », étape « hdv-fermer ».
--   1. pose le drapeau ; 2. chaque annonce ouverte (toutes saisons, Éternel compris) revient à son vendeur (mono.rendre : objet,
--   bête, ressources, Éclats du Temps, objet de collection) ; 3. chaque offre d'achat ouverte est close, kamas restants rendus.
-- Les échanges entre joueurs restent. Relançable : il ne reste alors rien d'ouvert.
-- ============================================================================
insert into mono.hdv_ferme (id) values (1) on conflict do nothing;
do $$
declare r record; nl int := 0; no int := 0;
begin
  for r in select id, seller from mono.hdv where status = 'open' order by id loop
    perform mono.verrou(r.seller);
    if mono.rendre(r.id, 'L''Hôtel de vente ferme avec Idlus 3.0') then nl := nl + 1; end if;
  end loop;
  for r in select id, buyer from mono.ordres where status = 'open' order by id loop
    perform mono.verrou(r.buyer);
    if mono.ordre_fermer(r.id, 'gone', 'L''Hôtel de vente ferme avec Idlus 3.0') then no := no + 1; end if;
  end loop;
  raise notice 'HdV du Monocompte fermé : % annonces rendues, % offres d''achat closes', nl, no;
end $$;
