#!/bin/bash
# Script to update CentralAuth on the remote VPS
# This handles pulling updates, migrating the database, building the Vite frontend,
# fixing WebKit regex lookbehind errors (supporting older devices), and restarting the service.

set -e

echo "============================================="
echo "   UPDATING CENTRALAUTH ON REMOTE VPS        "
echo "============================================="

# 1. Pull latest code from Git
echo "[1/5] Pulling latest code from repository..."
git pull

# 2. Activate virtual environment and install dependencies
echo "[2/5] Updating python dependencies..."
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo " [!] Virtual environment (venv/.venv) not found. Skipping activation."
fi
pip install -r requirements.txt

# 3. Run database migrations
echo "[3/5] Checking and running database migrations..."
if [ -f "alembic.ini" ]; then
    alembic upgrade head
else
    # Fallback to direct script if exists
    python update_db.py || true
    python seed_telegram_templates.py || true
    python seed_timehack_client.py || true
fi

# 4. Rebuild Vite frontend (including compilation targets and lookbehind fixes for older WebKit devices)
echo "[4/5] Building Vite frontend and fixing WebKit regex lookbehinds..."
if [ -f "build_vite.py" ]; then
    python build_vite.py
else
    echo " [!] build_vite.py not found. Running fallback build..."
    cd central-auth-studio
    npm install
    npm run build
    cd ..
fi

# 5. Restart system service
echo "[5/5] Restarting CentralAuth systemd service..."
if systemctl list-units --type=service | grep -q "centralauth"; then
    echo " [+] Restarting centralauth.service via systemctl..."
    sudo systemctl restart centralauth
elif pm2 list | grep -q "centralauth"; then
    echo " [+] Restarting centralauth via PM2..."
    pm2 restart centralauth
else
    echo " [!] No active systemd service or PM2 process named 'centralauth' found."
    echo "     Please restart your server process manually."
fi

echo "============================================="
echo "   CENTRALAUTH UPDATE COMPLETED SUCCESSFULLY!"
echo "============================================="
