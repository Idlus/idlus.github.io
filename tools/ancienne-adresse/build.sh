# Génère les pages de l'ancienne adresse (dépôt Mathiss29/idlus, branche main, GitHub Pages).
# Usage : sh tools/ancienne-adresse/build.sh <dossier de sortie>
set -e; D="$(dirname "$0")"; O="${1:-out}"; mkdir -p "$O/beta"
NEW="${NEW:-https://idlus.github.io/}"
sed -e "s#__NEW__#$NEW#g" -e "s#__NEW_TXT__#idlus.github.io#g" -e "s#__KEY__#dofousxen-save#g" "$D/page.tmpl" > "$O/index.html"
cp "$O/index.html" "$O/404.html"
sed -e "s#__NEW__#${NEW}beta/#g" -e "s#__NEW_TXT__#idlus.github.io/beta#g" -e "s#__KEY__#dofousxen-save-beta#g" "$D/page.tmpl" > "$O/beta/index.html"
# un service worker qui se désinstalle : les joueurs qui ont installé l'ancienne version ne restent pas bloqués dessus
for f in "$O/sw.js" "$O/beta/sw.js"; do echo 'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.matchAll()).then(cs=>cs.forEach(c=>c.navigate(c.url)))));' > "$f"; done
echo "Pages générées dans $O"
