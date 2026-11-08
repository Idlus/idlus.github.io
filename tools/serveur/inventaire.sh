# Inventaire de la machine (lecture seule, 08/11/2026) : ce qui tourne sur le VPS avant d'y ajouter le serveur de Diablofus.
# Lancé par l'étape « inventaire-machine » du workflow Serveur OVH. Ne modifie rien et n'affiche aucun secret (pas de .env).
s() { echo; echo "== $*"; }
s "Système"; . /etc/os-release; echo "$PRETTY_NAME, noyau $(uname -r)"; uptime; nproc; free -m; swapon --show; df -h / /home /opt 2>/dev/null; timedatectl | grep -i 'time zone'
s "Serveurs web sur la machine (hors Docker)"; for u in nginx apache2 caddy httpd lighttpd haproxy traefik; do printf '%s : %s / %s\n' "$u" "$(systemctl is-active $u 2>/dev/null)" "$(command -v $u || echo absent)"; done; ls /etc/nginx/sites-enabled /etc/caddy 2>&1 | head
s "Node et npm (hors Docker)"; for b in node nodejs npm npx pm2 bun deno; do printf '%s : %s\n' "$b" "$(command -v $b || echo absent)"; done; node -v 2>&1 | head -1; dpkg -l 2>/dev/null | awk '/^ii/ && ($2 ~ /^(nodejs|npm|nginx|caddy|sqlite3|docker|containerd|ufw|fail2ban)/) {print $2, $3}'; ls -d /root/.nvm /home/*/.nvm /usr/local/n 2>/dev/null; snap list 2>/dev/null | head
s "Docker"; docker version --format 'Docker {{.Server.Version}}' 2>&1 | head -1; docker compose version 2>&1; cat /etc/docker/daemon.json 2>/dev/null || echo "pas de /etc/docker/daemon.json"
s "Conteneurs (nom, image, état, ports publiés)"; docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}'
s "Conso par conteneur (instantané)"; docker stats --no-stream --format '{{.Name}} | CPU {{.CPUPerc}} | mém {{.MemUsage}} ({{.MemPerc}})'
s "Limites mémoire/CPU posées sur les conteneurs"; docker ps -q | xargs -r docker inspect --format '{{.Name}} mem={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}} restart={{.HostConfig.RestartPolicy.Name}}'
s "Réseaux Docker"; docker network ls --format '{{.Name}} {{.Driver}}'; for n in $(docker network ls -q); do docker network inspect $n --format '{{.Name}} : {{range .IPAM.Config}}{{.Subnet}} passerelle {{.Gateway}}{{end}}'; done
s "Caddy en service : conteneur, Caddyfile actuel, extra_hosts"; c=$(docker ps --format '{{.Names}}' | grep -i caddy | head -1); echo "conteneur : ${c:-aucun}"; [ -n "$c" ] && docker inspect "$c" --format 'image={{.Config.Image}} réseau={{.HostConfig.NetworkMode}} extra_hosts={{.HostConfig.ExtraHosts}} volumes={{range .Mounts}}{{.Source}}->{{.Destination}} {{end}}'; cat volumes/proxy/caddy/Caddyfile 2>&1; grep -n -A25 'caddy' docker-compose.caddy.yml 2>/dev/null | grep -viE 'password|secret|key' | head -40
s "Ports en écoute (TCP)"; ss -tlnpH | awk '{print $4, $6}' | sed 's/users:((//; s/,pid=[0-9]*,fd=[0-9]*//g; s/))//' | sort -u
s "Ports en écoute (UDP)"; ss -ulnpH | awk '{print $4, $6}' | sed 's/users:((//; s/,pid=[0-9]*,fd=[0-9]*//g; s/))//' | sort -u
s "Port 3100 libre ?"; ss -tlnH "sport = :3100" | grep -q . && echo "3100 PRIS" || echo "3100 libre"
s "Pare-feu ufw"; ufw status verbose 2>&1; s "Règles Docker dans iptables (DOCKER-USER)"; iptables -S DOCKER-USER 2>&1 | head
s "fail2ban"; fail2ban-client status 2>&1 | head; fail2ban-client status sshd 2>&1 | grep -iE 'currently|total' 
s "SSH (réglages, sans clés)"; sshd -T 2>/dev/null | grep -iE '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|allowusers|maxauthtries) '; ls /etc/ssh/sshd_config.d/
s "Utilisateurs avec un shell"; awk -F: '$7 ~ /(bash|sh|zsh)$/ {print $1, $3, $6}' /etc/passwd; ls /home; getent group sudo docker
s "Tâches planifiées"; ls -l /etc/cron.d; for f in /etc/cron.d/idlus*; do echo "-- $f"; grep -v '^#' "$f"; done; crontab -l 2>&1 | grep -v '^#' | head; systemctl list-timers --no-pager | head -20
s "Services systemd en marche (hors système)"; systemctl list-units --type=service --state=running --no-pager --no-legend | awk '{print $1}' | grep -vE '^(systemd-|dbus|getty|serial-getty|polkit|rsyslog|cron|ssh|user@|udisks|networkd|multipathd|ModemManager|unattended|snapd|qemu-guest|chrony|irqbalance)' ; systemctl --failed --no-pager --no-legend
s "Mises à jour automatiques et redémarrages"; cat /etc/apt/apt.conf.d/20auto-upgrades; grep -hE '^\s*Unattended-Upgrade::Automatic-Reboot' /etc/apt/apt.conf.d/* 2>/dev/null || echo "Automatic-Reboot non réglé (par défaut : pas de redémarrage)"; [ -f /var/run/reboot-required ] && echo "redémarrage en attente" || echo "pas de redémarrage en attente"
s "Sauvegardes et place disque"; ls -lh /opt/idlus/sauvegardes | tail -5; du -sh /opt/idlus/sauvegardes /var/lib/docker /opt/idlus/supabase/volumes/db 2>/dev/null; journalctl --disk-usage 2>/dev/null; tail -3 /var/log/idlus-sauvegarde.log 2>/dev/null
s "Mémoire et processeur sur 30 s (vmstat 5 x 6)"; vmstat -S M 5 6
s "Pression mémoire (PSI)"; cat /proc/pressure/memory /proc/pressure/cpu 2>/dev/null
s "DNS de api.diablofus.com vu du serveur"; getent hosts api.diablofus.com || echo "ne résout pas encore"
