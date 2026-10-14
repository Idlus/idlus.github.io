# Lancé sur le serveur (dossier /opt/idlus/supabase) par Serveur OVH › fonctions-limites.
# 15/10/2026 : le routeur des fonctions (volumes/functions/main/index.ts, fichier d'origine de Supabase) ne donne pas de limite
# de temps de calcul aux fonctions, donc edge-runtime prend la sienne, trop courte pour « record » (3,5 Mo de code du jeu à charger,
# puis 3 combats de Boss des mondes ou un Kolizéum) : « CPU time hard limit reached », la requête est coupée et le joueur lit
# « Pas de connexion au serveur ». On donne 10 s (souple) / 20 s (dure) de calcul et 300 Mo. Sans effet si c'est déjà fait ;
# l'ancien fichier reste à côté (index.ts.avant-limites) pour revenir en arrière.
set -e
f=volumes/functions/main/index.ts
if grep -q cpuTimeSoftLimitMs "$f"; then echo "Limites déjà en place :"; else
  cp "$f" "$f.avant-limites"
  sed -i 's/^\(\s*\)const memoryLimitMb = 150$/\1const memoryLimitMb = 300\n\1const cpuTimeSoftLimitMs = 10000\n\1const cpuTimeHardLimitMs = 20000/' "$f"
  sed -i 's/^\(\s*\)workerTimeoutMs,$/\1workerTimeoutMs,\n\1cpuTimeSoftLimitMs,\n\1cpuTimeHardLimitMs,/' "$f"
  if [ "$(grep -c 'cpuTimeSoftLimitMs' "$f")" != 2 ] || [ "$(grep -c 'cpuTimeHardLimitMs' "$f")" != 2 ]; then cp "$f.avant-limites" "$f"; echo "Routeur inattendu : rien n'est changé." >&2; exit 1; fi
  docker compose restart functions >/dev/null
  echo "Limites posées, fonctions redémarrées :"
fi
grep -nE 'Limit|Timeout' "$f"
