# Webhook Discord « Ladder » de Diablofus (annonces du classement dans #annonces, LISEZMOI de dofus-diablo, section Classement).
# Ajoute ou remplace la ligne DISCORD_ANNONCES de /etc/diablofus/discord.env (root 600, lu par systemd seulement),
# puis redémarre Diablofus. L'URL n'est jamais affichée. Rien d'Idlus n'est touché.
set -euo pipefail
f=/etc/diablofus/discord.env
[ -n "${LADDER:-}" ] || { echo "Secret DIABLOFUS_LADDER_WEBHOOK vide." >&2; exit 1; }
[ -f "$f" ] || { echo "$f absent : lancer d'abord l'étape diablofus-installer." >&2; exit 1; }
n=$(mktemp); chmod 600 "$n"
grep -v '^DISCORD_ANNONCES=' "$f" > "$n" || true
printf 'DISCORD_ANNONCES=%s\n' "$LADDER" >> "$n"
if cmp -s "$n" "$f"; then rm -f "$n"; echo "Webhook Ladder déjà en place (Diablofus non redémarré)"
else install -o root -g root -m 600 "$n" "$f"; rm -f "$n"; echo "Webhook Ladder posé : redémarrage de Diablofus"; systemctl restart diablofus; fi
ls -l "$f" | awk '{print $1, $3, $4}'
echo "Lignes du fichier (noms seulement) : $(cut -d= -f1 "$f" | tr '\n' ' ')"
sleep 4; systemctl is-active diablofus || sleep 4; systemctl is-active diablofus || { journalctl -u diablofus -n 30 --no-pager | sed -E 's#webhooks/[^ "]*#webhooks/***#g'; exit 1; }
curl -fsS -m 5 http://127.0.0.1:3100/sante; echo
echo "== Classement (début)"; curl -fsS -m 5 http://127.0.0.1:3100/classement | head -c 400; echo
echo "== Journal récent (Discord, annonces, classement)"
journalctl -u diablofus --since '-2 min' --no-pager | grep -iE 'discord|annonce|classement|webhook|erreur|error' | sed -E 's#webhooks/[^ "]*#webhooks/***#g' | tail -15 || true
