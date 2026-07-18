#!/bin/bash
set -euo pipefail

# ──────────────────────────────────────────────
# Family Portfolio — Oracle Cloud Setup Script
# Run as: sudo bash setup.sh
# Tested on: Ubuntu 22.04 / 24.04 (Oracle Cloud)
# ──────────────────────────────────────────────

APP_DIR="/opt/familyportfolio"
REPO_URL="https://github.com/Mouny-veera/FamilyPortfolio.git"
DOMAIN=""  # Set if you have a domain, leave empty for IP-only

echo "========================================="
echo " Family Portfolio — Server Setup"
echo "========================================="

# 1. System packages
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx certbot python3-certbot-nginx curl git

# 2. Install Node.js 20 (for building frontend)
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
    echo "[2/8] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
else
    echo "[2/8] Node.js already installed: $(node -v)"
fi

# 3. Clone or update repo
if [ -d "$APP_DIR/.git" ]; then
    echo "[3/8] Updating existing repo..."
    cd "$APP_DIR"
    git pull origin main
else
    echo "[3/8] Cloning repo..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 4. Python venv + dependencies
echo "[4/8] Setting up Python environment..."
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --quiet --upgrade pip
"$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"

# 5. Build frontend
echo "[5/8] Building frontend..."
cd "$APP_DIR/frontend"
npm install --silent
npm run build

# 6. Create .env if it doesn't exist
if [ ! -f "$APP_DIR/.env" ]; then
    echo "[6/8] Creating .env file (you need to fill in the values)..."
    JWT_SECRET=$(openssl rand -hex 32)
    cat > "$APP_DIR/.env" << EOF
# Generated during setup — fill in the values
GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_ID=
JWT_SECRET=$JWT_SECRET
API_TOKEN=
EOF
    echo "  ⚠  IMPORTANT: Edit $APP_DIR/.env and add your GOOGLE_CLIENT_ID"
else
    echo "[6/8] .env already exists, keeping it"
fi

# Create data directory if missing
mkdir -p "$APP_DIR/data"
if [ ! -f "$APP_DIR/data/config.json" ]; then
    cat > "$APP_DIR/data/config.json" << 'EOF'
{
  "allowed_emails": []
}
EOF
    echo "  ⚠  IMPORTANT: Edit $APP_DIR/data/config.json and add family email addresses"
fi

# 7. Set up systemd service
echo "[7/8] Configuring systemd service..."
cp "$APP_DIR/deploy/familyportfolio.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable familyportfolio
systemctl restart familyportfolio

# 8. Set up Nginx
echo "[8/8] Configuring Nginx..."
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/familyportfolio
ln -sf /etc/nginx/sites-available/familyportfolio /etc/nginx/sites-enabled/familyportfolio
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Fix permissions
chown -R ubuntu:ubuntu "$APP_DIR"

# Open firewall ports (Oracle Cloud uses iptables)
echo "Opening firewall ports..."
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
netfilter-persistent save 2>/dev/null || true

echo ""
echo "========================================="
echo " Setup Complete!"
echo "========================================="
echo ""
echo "Your app is running at: http://$(curl -s ifconfig.me)"
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env — add GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID"
echo "  2. Edit $APP_DIR/data/config.json — add family email addresses to allowed_emails"
echo "  3. Rebuild frontend after adding VITE_GOOGLE_CLIENT_ID:"
echo "       cd $APP_DIR/frontend && npm run build"
echo "  4. Restart backend: sudo systemctl restart familyportfolio"
echo ""
echo "For HTTPS (recommended):"
echo "  sudo certbot --nginx -d yourdomain.com"
echo ""
echo "Or use free DuckDNS domain:"
echo "  1. Go to https://www.duckdns.org and claim a subdomain"
echo "  2. Point it to your server IP"
echo "  3. Run: sudo certbot --nginx -d yourname.duckdns.org"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status familyportfolio   # Check backend status"
echo "  sudo journalctl -u familyportfolio -f   # View backend logs"
echo "  sudo systemctl restart familyportfolio   # Restart backend"
echo ""
