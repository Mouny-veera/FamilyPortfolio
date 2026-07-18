#!/bin/bash
set -euo pipefail

# ──────────────────────────────────────────────
# Family Portfolio — Google Cloud / Generic VPS Setup
# Run as: sudo bash setup.sh
# Tested on: Debian 12 (GCP), Ubuntu 22.04/24.04
# ──────────────────────────────────────────────

APP_DIR="/opt/familyportfolio"
REPO_URL="https://github.com/Mouny-veera/FamilyPortfolio.git"

# Detect OS user (GCP uses the logged-in user, Oracle uses ubuntu)
APP_USER="${SUDO_USER:-$(logname 2>/dev/null || echo ubuntu)}"

echo "========================================="
echo " Family Portfolio — Server Setup"
echo " Running as user: $APP_USER"
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
NODE_OPTIONS="--max-old-space-size=512" npm run build

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

# 7. Set up systemd service (patch user dynamically)
echo "[7/8] Configuring systemd service..."
sed "s/User=ubuntu/User=$APP_USER/;s/Group=ubuntu/Group=$APP_USER/" \
    "$APP_DIR/deploy/familyportfolio.service" > /etc/systemd/system/familyportfolio.service
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
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Open firewall (GCP uses VPC rules so this is a no-op there, but helps on other VPS)
if command -v ufw &>/dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
elif command -v iptables &>/dev/null; then
    iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    netfilter-persistent save 2>/dev/null || true
fi

# Create 1GB swap if RAM < 2GB (important for GCP e2-micro with 1GB RAM)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM_MB" -lt 2000 ] && [ ! -f /swapfile ]; then
    echo "Creating 1GB swap (low RAM detected: ${TOTAL_RAM_MB}MB)..."
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "========================================="
echo " Setup Complete!"
echo "========================================="
echo ""
echo "Your app is running at: http://$PUBLIC_IP"
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env — add GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID"
echo "  2. Edit $APP_DIR/data/config.json — add family email addresses to allowed_emails"
echo "  3. Rebuild frontend after adding VITE_GOOGLE_CLIENT_ID:"
echo "       cd $APP_DIR/frontend && npm run build"
echo "  4. Restart backend: sudo systemctl restart familyportfolio"
echo ""
echo "For HTTPS (required for Google Sign-In):"
echo "  Option A — Free domain via DuckDNS:"
echo "    1. Go to https://www.duckdns.org and claim a subdomain"
echo "    2. Point it to $PUBLIC_IP"
echo "    3. Run: sudo certbot --nginx -d yourname.duckdns.org"
echo ""
echo "  Option B — Your own domain:"
echo "    sudo certbot --nginx -d yourdomain.com"
echo ""
echo "After HTTPS setup, add the domain to Google Cloud Console:"
echo "  APIs & Services → Credentials → OAuth Client → Authorized origins"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status familyportfolio   # Check backend status"
echo "  sudo journalctl -u familyportfolio -f   # View backend logs"
echo "  sudo systemctl restart familyportfolio   # Restart backend"
echo ""
