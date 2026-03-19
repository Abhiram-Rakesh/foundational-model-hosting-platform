#!/bin/bash
# ============================================================================
# setup-control-plane.sh
# Run this on VM1 (rke2-control) after a fresh Ubuntu 22.04 install.
# Usage: chmod +x setup-control-plane.sh && sudo ./setup-control-plane.sh
# ============================================================================

set -euo pipefail

echo "============================================"
echo "  VM1 Control Plane Setup"
echo "============================================"

# --- Hostname ---
echo "[1/8] Setting hostname..."
hostnamectl set-hostname rke2-control

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

# --- Install RKE2 Server ---
echo "[7/8] Installing RKE2 server..."
curl -sfL https://get.rke2.io | sh -

# --- Create Config ---
echo "[8/8] Creating RKE2 config..."
mkdir -p /etc/rancher/rke2
cat > /etc/rancher/rke2/config.yaml <<EOF
write-kubeconfig-mode: "0644"
tls-san:
  - 172.25.2.51
  - rke2-control
node-name: rke2-control
node-ip: 172.25.2.51
EOF

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Set static IP via netplan"
echo "  2. sudo systemctl enable rke2-server"
echo "  3. sudo systemctl start rke2-server"
echo "  4. Wait 2-5 minutes, then:"
echo "     export PATH=\$PATH:/var/lib/rancher/rke2/bin"
echo "     export KUBECONFIG=/etc/rancher/rke2/rke2.yaml"
echo "     kubectl get nodes"
echo "============================================"
