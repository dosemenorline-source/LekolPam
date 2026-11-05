#!/bin/sh
# Démarrage avec droits réduits : le serveur tourne sous l'utilisateur « node »,
# pas root. Seul le dossier uploads (éventuellement un volume Railway, créé
# par root) lui est rendu accessible en écriture ; le code reste en lecture
# seule pour lui.
set -e
UPLOADS=/app/backend/uploads
mkdir -p "$UPLOADS"
if [ "$(id -u)" = "0" ] && command -v setpriv >/dev/null 2>&1; then
  chown -R node:node "$UPLOADS"
  exec setpriv --reuid=node --regid=node --init-groups node src/server.js
fi
exec node src/server.js
