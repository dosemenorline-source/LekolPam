#!/bin/sh
# Sauvegarde complète de la base (structure + données), compressée et datée.
#
#   Usage : MYSQL_URL="mysql://user:motdepasse@hote:port/lekol_pam" ./scripts/sauvegarde-db.sh [dossier]
#
# Railway : l'URL se trouve dans le service MySQL → Variables → MYSQL_PUBLIC_URL.
# Le fichier produit contient TOUTES les données personnelles de l'école :
# le garder hors du dépôt Git, dans un endroit chiffré, et supprimer les
# anciennes copies (le script ne garde que les 14 plus récentes du dossier).
set -eu
: "${MYSQL_URL:?Définissez MYSQL_URL (mysql://utilisateur:motdepasse@hote:port/base)}"
DOSSIER="${1:-./sauvegardes}"
mkdir -p "$DOSSIER"
chmod 700 "$DOSSIER"

# Découpe de l'URL sans jamais afficher le mot de passe
PROTO_RETIRE="${MYSQL_URL#*://}"
IDENTIFIANTS="${PROTO_RETIRE%%@*}"
HOTE_PORT_BASE="${PROTO_RETIRE#*@}"
UTILISATEUR="${IDENTIFIANTS%%:*}"
MOTDEPASSE="${IDENTIFIANTS#*:}"
HOTE_PORT="${HOTE_PORT_BASE%%/*}"
BASE="${HOTE_PORT_BASE#*/}"
HOTE="${HOTE_PORT%%:*}"
PORT="${HOTE_PORT#*:}"

CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "$HOTE" "$PORT" "$UTILISATEUR" "$MOTDEPASSE" > "$CNF"

FICHIER="$DOSSIER/lekol_pam_$(date +%Y%m%d_%H%M%S).sql.gz"
mysqldump --defaults-extra-file="$CNF" --single-transaction --routines --triggers \
  --no-tablespaces "$BASE" | gzip -9 > "$FICHIER"
chmod 600 "$FICHIER"
echo "Sauvegarde écrite : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

# Rotation : garde les 14 plus récentes
ls -1t "$DOSSIER"/lekol_pam_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
