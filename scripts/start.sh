#!/bin/bash
# Start Family Portfolio for Tailscale / LAN access
# Usage: ./scripts/start.sh
#
# The backend serves the pre-built frontend at /
# Access from any device on your Tailscale network: http://<tailscale-ip>:8000

set -e
cd "$(dirname "$0")/.."

if [ ! -d "frontend/dist" ]; then
  echo "Building frontend..."
  (cd frontend && npm run build)
fi

echo ""
echo "Starting Family Portfolio..."
echo "  Local:     http://localhost:8000"

TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || true)
if [ -n "$TAILSCALE_IP" ]; then
  echo "  Tailscale: http://$TAILSCALE_IP:8000"
else
  echo "  (Tailscale not running — install from https://tailscale.com/download)"
fi

echo ""
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
