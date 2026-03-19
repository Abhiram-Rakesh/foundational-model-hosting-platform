#!/bin/bash
# ============================================================================
# setup-worker.sh
# Run this on VM2 (rke2-worker) after a fresh Ubuntu 22.04 install.
# Usage: chmod +x setup-worker.sh && sudo ./setup-worker.sh <JOIN_TOKEN>
# ============================================================================

set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: sudo ./setup-worker.sh <JOIN_TOKEN>"
    echo ""
    echo "Get the token from VM1:"
    echo "  sudo cat /var/lib/rancher/rke2/server/node-token"
    exit 1
fi

JOIN_TOKEN="$1"

echo "============================================"
echo "  VM2 Worker Node Setup"
echo "============================================"

# --- Hostname ---
echo "[1/8] Setting hostname..."
hostnamectl set-hostname rke2-worker

# --- Disable Swap ---
echo "[2/8] Disabling swap..."
swapoff -a
sed -i '/ swap / s/^\(.*\)$/#\1/' /etc/fstab

# --- Update Packages ---
echo "[3/8] Updating packages..."
apt update && apt upgrade -y

# --- Install Prerequisites ---
echo "[4/8] Installing prerequisites..."
apt install -y curl wget git open-iscsi nfs-common
systemctl enable iscsid && systemctl start iscsid

# --- Set Timezone ---
echo "[5/8] Setting timezone..."
timedatectl set-timezone Asia/Kolkata

# --- Disable Firewall ---
echo "[6/8] Disabling UFW (will harden later)..."
ufw disable || true

# --- Install RKE2 Agent ---
echo "[7/8] Installing RKE2 agent..."
curl -sfL https://get.rke2.io | INSTALL_RKE2_TYPE="agent" sh -

# --- Create Config ---
echo "[8/8] Creating RKE2 config..."
mkdir -p /etc/rancher/rke2
cat > /etc/rancher/rke2/config.yaml <<EOF
server: https://172.25.2.51:9345
token: ${JOIN_TOKEN}
node-name: rke2-worker
node-ip: 172.25.2.52
EOF

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Set static IP via netplan"
echo "  2. sudo systemctl enable rke2-agent"
echo "  3. sudo systemctl start rke2-agent"
echo "  4. On VM1, verify: kubectl get nodes"
echo "============================================"
