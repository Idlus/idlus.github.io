# Installation du serveur de Diablofus à côté d'Idlus (blocs 1 à 4 de serveur/LISEZMOI.md du dépôt Mathiss29/dofus-diablo).
# Demande écrite de Mathis du 08/11/2026 (« Peux-tu lancer les blocs 1 à 5 par ton workflow SSH ? »), commandes relues.
# Lancé en root par l'étape « diablofus-installer » du workflow Serveur OVH. Rejouable : ce qui est déjà en place est gardé.
# Ne touche ni à Docker, ni à Caddy, ni à ufw, ni à /opt/idlus. Le jeton du tunnel (variable JETON) n'est jamais affiché.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l NEEDRESTART_SUSPEND=1   # apt ne redémarre aucun service (Docker !)
s() { echo; echo "== $*"; }
B=https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation
for c in git rsync curl sha256sum; do command -v $c >/dev/null || { echo "$c absent" >&2; exit 1; }; done
avant=$(docker ps -q | wc -l)

s "Bloc 1 : utilisateur diablofus et dossiers"
id diablofus >/dev/null 2>&1 || adduser --system --group --home /home/diablofus --shell /bin/bash diablofus
sudo -u diablofus mkdir -p /home/diablofus/app /home/diablofus/donnees
chmod 750 /home/diablofus
id diablofus; id -nG diablofus | grep -qw docker && { echo "diablofus est dans le groupe docker : arrêt" >&2; exit 1; } || true

s "Bloc 2 : Node 22 dans /home/diablofus/node"
if [ ! -x /home/diablofus/node/bin/node ]; then
  sudo -u diablofus -H bash -c '
    set -e; cd ~
    B=https://nodejs.org/dist/latest-v22.x
    F=$(curl -fsSL $B/SHASUMS256.txt | grep -o "node-v22[^ ]*-linux-x64.tar.xz")
    curl -fsSLO $B/$F
    curl -fsSL $B/SHASUMS256.txt | grep " $F\$" | sha256sum -c -
    mkdir -p node && tar -xJf $F -C node --strip-components=1 && rm $F'
fi
/home/diablofus/node/bin/node -v

s "Bloc 3 : service, droit de redémarrage, mise à jour automatique (fichiers relus le 08/11, empreintes vérifiées)"
T=$(mktemp -d); cd "$T"
for f in diablofus.service sudoers-diablofus diablofus-maj.service diablofus-maj.timer maj.sh; do curl -fsSLO "$B/$f"; done
sha256sum -c - <<'SUM'
eeab1c3fa3ef59c271c67be5adc0adb6118f61f135ece0fb5f83d4d5662e2e78  diablofus.service
444195b150a0b2733c4693693af15fc0a4218b3f6f6a7986b95ad1488edf6aac  sudoers-diablofus
ff8712ddf4fed258fc004a0ca198d589ba0f4d12875de7866adf551742b90ef2  diablofus-maj.service
bfa0ac0506f494441317a4932ade7a20a36bf25ba35859aa5fc5ab2ef1ed6c6c  diablofus-maj.timer
fcc732b11c3d0953e86021ddb8c0e1d58e80827a660ab07c72595fda975b5a1c  maj.sh
SUM
cmp -s diablofus.service /etc/systemd/system/diablofus.service && change= || change=1   # 08/11 18h : 1 Go → 2 Go (PR #228)
install -m 644 diablofus.service diablofus-maj.service diablofus-maj.timer /etc/systemd/system/
visudo -cf sudoers-diablofus && install -m 440 sudoers-diablofus /etc/sudoers.d/diablofus
# 08/11 : maj.sh rangé hors du dossier de diablofus (qui pourrait sinon le remplacer), ancien fichier retiré
install -D -o root -g root -m 755 maj.sh /usr/local/lib/diablofus/maj.sh
rm -f /home/diablofus/maj.sh
systemctl daemon-reload && systemctl enable diablofus && systemctl enable --now diablofus-maj.timer
[ -n "$change" ] && systemctl is-active -q diablofus && { echo "service modifié : redémarrage de Diablofus"; systemctl restart diablofus; }
systemctl start diablofus-maj.service || { journalctl -u diablofus-maj -n 30 --no-pager; exit 1; }
sleep 4; systemctl is-active diablofus || { journalctl -u diablofus -n 30 --no-pager; exit 1; }
curl -fsS -m 5 http://127.0.0.1:3100/sante; echo
journalctl -u diablofus-maj -n 5 --no-pager

if [ -n "${JETON:-}" ]; then
  s "Bloc 4 : tunnel Cloudflare (api.diablofus.com)"
  if ! command -v cloudflared >/dev/null; then
    mkdir -p --mode=0755 /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg > /usr/share/keyrings/cloudflare-main.gpg
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
    apt-get update -q && apt-get install -yq cloudflared
  fi
  cloudflared --version
  if [ ! -f /etc/systemd/system/cloudflared.service ]; then cloudflared service install "$JETON" >/dev/null 2>&1 || { echo "cloudflared service install a échoué (jeton ?)" >&2; exit 1; }; fi
  curl -fsSLO "$B/cloudflared-limites.conf"
  echo "573b667d1d58f56a25876002ee1e25fd960b564cae3169075add238692347509  cloudflared-limites.conf" | sha256sum -c -
  if ! cmp -s cloudflared-limites.conf /etc/systemd/system/cloudflared.service.d/limites.conf; then
    install -D -m 644 cloudflared-limites.conf /etc/systemd/system/cloudflared.service.d/limites.conf
    systemctl daemon-reload && systemctl restart cloudflared
  else echo "limites du tunnel déjà en place (tunnel non redémarré)"; fi
  sleep 2; systemctl is-active cloudflared
  journalctl -u cloudflared -n 15 --no-pager | grep -iE 'registered|error|connection' | sed -E 's/token[^ ]*//Ig' | tail -8 || true
  curl -fsS -m 10 https://api.diablofus.com/sante && echo || echo "api.diablofus.com ne répond pas encore (DNS ou Public Hostname ?)"
else
  echo; echo "Bloc 4 sauté : secret DIABLOFUS_TUNNEL_TOKEN absent."
fi
cd /; rm -rf "$T"

s "Idlus après l'installation"
echo "conteneurs en marche : avant $avant, après $(docker ps -q | wc -l)"; docker ps --format '{{.Names}} {{.Status}}' | grep -v healthy || true
free -m | sed -n 2p; systemctl show diablofus -p MemoryCurrent -p MemoryMax -p CPUQuotaPerSecUSec
ss -tlnH | awk '{print $4}' | sort -u | tr '\n' ' '; echo
