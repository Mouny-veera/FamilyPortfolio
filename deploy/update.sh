#!/bin/bash
set -euo pipefail

# Quick update script — run after pushing new code to GitHub
# Usage: sudo bash /opt/familyportfolio/deploy/update.sh

APP_DIR="/opt/familyportfolio"
cd "$APP_DIR"

echo "Pulling latest code..."
git pull origin main

echo "Updating Python dependencies..."
"$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"

echo "Building frontend..."
cd "$APP_DIR/frontend"
npm install --silent
npm run build

# nginx config that must track the repo. Only additive snippets belong here —
# never the site config, which certbot owns and rewrote to add TLS. Reloads only
# when something actually changed, and only if nginx accepts the result.
echo "Checking nginx snippets..."
NGINX_SNIPPET="/etc/nginx/conf.d/familyportfolio-upload-size.conf"
if ! cmp -s "$APP_DIR/deploy/nginx-upload-size.conf" "$NGINX_SNIPPET"; then
    cp "$APP_DIR/deploy/nginx-upload-size.conf" "$NGINX_SNIPPET"
    if nginx -t; then
        systemctl reload nginx
        echo "  nginx snippet updated and reloaded."
    else
        rm -f "$NGINX_SNIPPET"
        echo "  nginx rejected the snippet — removed it, nginx left untouched." >&2
        exit 1
    fi
else
    echo "  nginx snippets already current."
fi

echo "Restarting backend..."
systemctl restart familyportfolio

echo "Done! App updated and running."
