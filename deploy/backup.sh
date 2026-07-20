#!/bin/bash
set -euo pipefail

# Daily database backup to Google Cloud Storage
# Usage: bash /opt/familyportfolio/deploy/backup.sh
# Cron:  0 20 * * * /opt/familyportfolio/deploy/backup.sh >> /var/log/familyportfolio-backup.log 2>&1

APP_DIR="/opt/familyportfolio"
DB_PATH="$APP_DIR/data/portfolio.db"
CONFIG_PATH="$APP_DIR/data/config.json"
BUCKET="gs://familyportfolio-backups"
DATE=$(date +%Y%m%d)
KEEP_DAYS=30

if [ ! -f "$DB_PATH" ]; then
    echo "$(date): ERROR — database not found at $DB_PATH"
    exit 1
fi

# Use SQLite's .backup for a consistent snapshot (safe even while app is running)
BACKUP_FILE="/tmp/portfolio_${DATE}.db"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
gzip -f "$BACKUP_FILE"

# Upload DB backup
gsutil -q cp "${BACKUP_FILE}.gz" "${BUCKET}/db/portfolio_${DATE}.db.gz"
echo "$(date): DB backup uploaded — portfolio_${DATE}.db.gz"

# Upload config (contains Fyers credentials, member list)
gsutil -q cp "$CONFIG_PATH" "${BUCKET}/config/config_${DATE}.json"
echo "$(date): Config backup uploaded — config_${DATE}.json"

# Clean up local temp
rm -f "${BACKUP_FILE}.gz"

# Delete backups older than KEEP_DAYS from GCS
CUTOFF=$(date -d "-${KEEP_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${KEEP_DAYS}d +%Y%m%d)
gsutil ls "${BUCKET}/db/" 2>/dev/null | while read -r file; do
    FILE_DATE=$(echo "$file" | grep -oP '\d{8}' | tail -1)
    if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF" ] 2>/dev/null; then
        gsutil -q rm "$file"
        echo "$(date): Deleted old backup — $(basename "$file")"
    fi
done

echo "$(date): Backup complete"
