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

echo "Restarting backend..."
systemctl restart familyportfolio

echo "Done! App updated and running."
