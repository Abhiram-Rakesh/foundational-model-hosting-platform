# 🧠 Foundational Model Hosting Platform

A self-hosted SaaS platform for deploying and managing AI foundation models (LLaMA 2, Mistral, Phi, Gemma) on bare-metal infrastructure using Kubernetes, GitOps, and Ollama.

> **Think of it as your own private Replicate / Hugging Face Inference Endpoints** — running entirely on hardware you control, behind an air-gapped ESXi server accessible only through a Windows bastion.

---

## 📑 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Hardware & Environment](#hardware--environment)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Phase 1: VM Provisioning](#phase-1-vm-provisioning-day-1)
- [Phase 2: Kubernetes Cluster Setup](#phase-2-kubernetes-cluster-setup-day-1)
- [Phase 3: Cluster Add-ons](#phase-3-cluster-add-ons-day-2)
- [Phase 4: Git Repository & ArgoCD Application](#phase-4-git-repository--argocd-application-day-2)
- [Phase 5: Backend API Development](#phase-5-backend-api-development-day-3)
- [Phase 6: Frontend Development](#phase-6-frontend-development-day-4)
- [Phase 7: End-to-End Testing](#phase-7-end-to-end-testing-day-4)
- [Phase 8: Hardening & Production Readiness](#phase-8-hardening--production-readiness-day-5)
- [How Ollama Model Provisioning Works](#how-ollama-model-provisioning-works)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Glossary](#glossary)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WINDOWS BASTION SERVER                       │
│  (Only access point — browser, SSH client, development tools)       │
│                                                                     │
│   Browser ──► ESXi Web Client (172.25.2.50)                        │
│   Browser ──► Frontend UI    (172.25.2.51:<NodePort>)              │
│   Browser ──► ArgoCD UI      (172.25.2.51:<NodePort>)              │
│   Browser ──► Longhorn UI    (172.25.2.51:<NodePort>)              │
│   PuTTY  ──► SSH to VM1     (172.25.2.51:22)                      │
│   PuTTY  ──► SSH to VM2     (172.25.2.52:22)                      │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ ESXi Internal Network
┌─────────────────────▼───────────────────────────────────────────────┐
│                   VMware ESXi 7.0 Hypervisor                        │
│              HP ProLiant DL360p Gen8 (172.25.2.50)                  │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐  │
│  │   VM1: rke2-control  │    │       VM2: rke2-worker           │  │
│  │   172.25.2.51        │    │       172.25.2.52                │  │
│  │   4 vCPU / 10GB RAM  │    │       12 vCPU / 32GB RAM        │  │
│  │   80GB Disk          │    │       150GB Disk                 │  │
│  │                      │    │                                  │  │
│  │   ┌─ K8s Control ──┐ │    │   ┌─ K8s Workloads ──────────┐  │  │
│  │   │ API Server     │ │    │   │ Ollama Pod (llama2)       │  │  │
│  │   │ etcd           │ │    │   │ Ollama Pod (mistral)      │  │  │
│  │   │ Scheduler      │ │    │   │ Ollama Pod (phi)          │  │  │
│  │   │ Controller Mgr │ │    │   │ ...more model pods...     │  │  │
│  │   └────────────────┘ │    │   └───────────────────────────┘  │  │
│  │                      │    │                                  │  │
│  │   ┌─ Shared Svcs ──┐ │    │   ┌─ Storage ────────────────┐  │  │
│  │   │ ArgoCD         │ │    │   │ Longhorn Replicas        │  │  │
│  │   │ PostgreSQL     │ │    │   │ shared-models-pvc (50Gi) │  │  │
│  │   │ Backend API    │ │    │   └───────────────────────────┘  │  │
│  │   │ Frontend       │ │    │                                  │  │
│  │   │ Longhorn Mgr   │ │    │                                  │  │
│  │   └────────────────┘ │    │                                  │  │
│  └──────────────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Deploying a Model

```
User clicks "Deploy"
       │
       ▼
Frontend ──POST /api/deployments──► Backend API
                                        │
                                        ├─► 1. Validate input
                                        ├─► 2. INSERT into PostgreSQL (status: pending)
                                        ├─► 3. Generate K8s manifest YAML
                                        ├─► 4. Write manifest to Git repo
                                        ├─► 5. git add, commit, push
                                        ├─► 6. POST to ArgoCD sync API
                                        │
                                        ▼
                                   ArgoCD detects new manifest
                                        │
                                        ├─► 7.  Create Namespace (user-1)
                                        ├─► 8.  Create Deployment + Service
                                        ├─► 9.  Scheduler assigns Pod to worker node
                                        ├─► 10. initContainer: ollama pull <model>
                                        │       (downloads ~4GB model to shared PVC)
                                        ├─► 11. Main container: ollama serve
                                        │       (loads model into RAM, serves on :11434)
                                        ├─► 12. Health probes pass → Pod Ready
                                        │
                                        ▼
                                   Backend polling loop
                                        │
                                        ├─► 13. Detect pod Running + Ready
                                        ├─► 14. Query Service for NodePort
                                        ├─► 15. UPDATE PostgreSQL (status: running,
                                        │       api_endpoint, node_port)
                                        │
                                        ▼
                                   Frontend polls GET /api/deployments
                                        │
                                        └─► 16. Shows "Running" with clickable
                                                API endpoint link
```

---

## Hardware & Environment

| Component | Details |
|-----------|---------|
| **Server** | HP ProLiant DL360p Gen8 |
| **CPU** | Intel Xeon E5-2630 v2 @ 2.60GHz (2 sockets × 6 cores = 24 logical) |
| **RAM** | 67.97 GB |
| **Hypervisor** | VMware ESXi 7.0 |
| **Access** | Windows bastion server only (no VPN, no RDP to ESXi) |

### The Bastion Constraint

The ESXi server is **completely air-gapped** from external networks. The only way to interact with it is through a Windows machine (the bastion) physically connected to the same network. This means:

- All development, testing, and operations happen from the bastion desktop
- ESXi management is via the web client in the bastion's browser
- VM access is via SSH (PuTTY) from the bastion
- All web UIs (frontend, ArgoCD, Longhorn) are opened in the bastion's browser
- Files must be transferred through the bastion (USB, SCP, ESXi datastore upload)

---

## Repository Structure

```
foundational-model-hosting-platform/
│
├── README.md                          ← You are here
├── .gitignore
│
├── docs/
│   ├── architecture.md                ← Detailed architecture explanation
│   ├── setup-guide.md                 ← Condensed quick-start
│   ├── api-reference.md               ← Full API documentation
│   └── troubleshooting.md             ← Common issues and fixes
│
├── infrastructure/
│   ├── vm-configs/
│   │   ├── vm1-control-plane.md       ← VM1 specs and setup notes
│   │   └── vm2-worker-node.md         ← VM2 specs and setup notes
│   ├── rke2/
│   │   ├── control-plane-config.yaml  ← RKE2 server config
│   │   └── worker-config.yaml         ← RKE2 agent config
│   └── scripts/
│       ├── setup-control-plane.sh     ← Automated VM1 setup
│       └── setup-worker.sh            ← Automated VM2 setup
│
├── k8s-manifests/
│   ├── argocd/
│   │   └── ml-platform-app.yaml       ← ArgoCD Application definition
│   ├── longhorn/
│   │   └── shared-models-pvc.yaml     ← Persistent volume for models
│   ├── postgres/
│   │   └── values.yaml                ← Helm values for PostgreSQL
│   ├── backend/
│   │   └── backend-deployment.yaml    ← Backend K8s Deployment + Service
│   ├── frontend/
│   │   └── frontend-deployment.yaml   ← Frontend K8s Deployment + Service
│   ├── secrets/
│   │   └── backend-secrets.yaml       ← Template (DO NOT commit real values)
│   ├── rbac/
│   │   └── argocd-rbac.yaml           ← ArgoCD ClusterRole + Binding
│   ├── quotas/
│   │   └── user-1-quota.yaml          ← ResourceQuota + LimitRange
│   └── manifests/                     ← ArgoCD watches this directory
│       └── .gitkeep                   ← (dynamically populated by backend)
│
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── index.js                   ← Express entry point
│       ├── routes/
│       │   ├── models.js              ← GET /api/models
│       │   └── deployments.js         ← CRUD /api/deployments
│       ├── services/
│       │   ├── db.js                  ← PostgreSQL connection pool
│       │   ├── git.js                 ← Git add/commit/push helpers
│       │   ├── argocd.js              ← ArgoCD sync trigger
│       │   ├── k8s.js                 ← K8s API queries (pod status, NodePort)
│       │   └── manifest-generator.js  ← Generates K8s YAML from template
│       ├── config/
│       │   └── models.json            ← Supported models registry
│       └── middleware/
│           ├── errorHandler.js        ← Global error handler
│           └── validator.js           ← Input validation middleware
│
└── frontend/
    ├── package.json
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    └── src/
        ├── App.jsx                    ← Router setup
        ├── main.jsx                   ← Entry point
        ├── pages/
        │   ├── DeploymentsList.jsx    ← Dashboard with polling
        │   └── NewDeployment.jsx      ← Model deployment form
        ├── components/
        │   ├── DeploymentCard.jsx     ← Single deployment display
        │   ├── DeploymentForm.jsx     ← Form with validation
        │   ├── StatusBadge.jsx        ← Color-coded status indicator
        │   └── Navbar.jsx             ← Navigation header
        └── services/
            └── api.js                 ← Axios HTTP client
```

---

## Prerequisites

### On the Windows Bastion Server

| Tool | Purpose | Download |
|------|---------|----------|
| **Chrome/Firefox** | ESXi web client, all web UIs | Pre-installed |
| **PuTTY** or **Windows Terminal** | SSH into VMs | putty.org |
| **WinSCP** | File transfer to VMs | winscp.net |
| **VS Code** | Code editing + integrated terminal | code.visualstudio.com |
| **Git for Windows** | Clone/push to GitHub | git-scm.com |
| **Docker Desktop** (optional) | Build container images locally | docker.com |

### Accounts Required

| Account | Purpose |
|---------|---------|
| **GitHub** | Host this repository (free tier) |
| **Docker Hub** | Store container images (free tier) |
| **ESXi root** | VM management (you should have this) |

### Downloads Required

- **Ubuntu 22.04 LTS Server ISO** — download from [ubuntu.com/download/server](https://ubuntu.com/download/server) on any internet-connected machine, then transfer to the bastion

---

## Phase 1: VM Provisioning (Day 1)

### 1.1 Upload Ubuntu ISO to ESXi

Since the ESXi server may not have internet access, transfer the ISO through the bastion:

1. Copy the Ubuntu ISO to the bastion (USB drive, network share, etc.)
2. Open Chrome on the bastion → navigate to `https://172.25.2.50`
3. Log in as `root`
4. Click **Storage** in the left sidebar → select your datastore
5. Click **Datastore browser** → **Create directory** → name it `ISOs`
6. Navigate into `ISOs/` → click **Upload** → select the Ubuntu ISO
7. Wait for upload to complete (5-15 minutes)

The ISO path will be: `[datastore1] ISOs/ubuntu-22.04.x-live-server-amd64.iso`

### 1.2 Network Plan

All components share the same ESXi virtual switch / port group as the bastion:

| Component | IP Address | Hostname | Role |
|-----------|-----------|----------|------|
| ESXi Host | 172.25.2.50 | localhost.localdomain | Hypervisor |
| Windows Bastion | 172.25.2.x | (your PC) | Management access |
| VM1 | **172.25.2.51** | rke2-control | K8s control plane |
| VM2 | **172.25.2.52** | rke2-worker | K8s worker node |

> **Note:** The IPs above assume your bastion is on the 172.25.2.0/24 subnet (matching the ESXi host at 172.25.2.50). Adjust if your network differs.

### 1.3 Resource Allocation

| Resource | VM1 (Control Plane) | VM2 (Worker Node) | Reasoning |
|----------|-------------------|-------------------|-----------|
| **RAM** | 10 GB | 32 GB | Worker loads AI models into RAM |
| **vCPUs** | 4 | 12 | Worker runs inference computation |
| **Disk** | 80 GB (thin) | 150 GB (thin) | Worker stores model files on PVC |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS | Stable, well-supported |

### 1.4 Create VM1 (Control Plane)

In the ESXi web client:

1. Click **Create / Register VM** → **Create a new virtual machine** → Next
2. **Name:** `rke2-control` | **Guest OS:** Linux / Ubuntu Linux (64-bit) → Next
3. **Select storage** → pick your datastore → Next
4. **Customize settings:**
   - CPU: **4**
   - Memory: **10240 MB**
   - Hard disk 1: **80 GB**, Thin Provisioned
   - CD/DVD Drive 1: **Datastore ISO file** → browse to your Ubuntu ISO
   - Network Adapter 1: connected to the correct port group
5. **Review** → Finish

### 1.5 Install Ubuntu on VM1

1. Right-click `rke2-control` → **Power On**
2. Click **Console → Open browser console**
3. Walk through the Ubuntu installer:
   - Language: English
   - Installation type: **Ubuntu Server (minimized)**
   - Network: accept DHCP for now (we'll set static IP after)
   - Storage: use entire disk
   - Profile: server name = `rke2-control`, username = `ubuntu`
   - **CHECK "Install OpenSSH server"** ← critical
   - Skip snaps → Done → Reboot

> ⚠️ After reboot, if it tries to boot from ISO again: power off VM → edit settings → disconnect CD/DVD drive → power on.

### 1.6 Configure VM1

SSH in from the bastion (or use ESXi console) and run these commands:

#### Set Static IP

```bash
# List all network interfaces — note all names before editing netplan
ip addr
```

> **If you have 2 adapters** (one internet, one VM Network): each adapter gets its own interface name (e.g. `ens160` and `ens192`). Assign the static IP only to the VM Network adapter. Assigning it to the internet adapter will cause 100% packet loss from the bastion.

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

**Single adapter** (VM Network only):

```yaml
network:
  version: 2
  ethernets:
    ens160:              # ← adjust to your interface name
      dhcp4: false
      addresses:
        - 172.25.2.51/24
      routes:
        - to: default
          via: 172.25.2.1    # ← adjust to your gateway
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

**Two adapters** (internet + VM Network):

```yaml
network:
  version: 2
  ethernets:
    ens160:                  # ← internet adapter — leave on DHCP
      dhcp4: true
    ens192:                  # ← VM Network adapter — set static IP
      dhcp4: false
      addresses:
        - 172.25.2.51/24
      routes:
        - to: default
          via: 172.25.2.1    # ← adjust to your gateway
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

```bash
sudo netplan apply

# Verify — 172.25.2.51/24 should appear on the VM Network adapter
ip addr show
```

Test from the bastion's Command Prompt:
```
ping 172.25.2.51
```

#### Disable Swap (Required for Kubernetes)

```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/' /etc/fstab

# Verify — swap line should show all zeros
free -h
```

#### Update Packages and Install Prerequisites

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Kolkata      # adjust to your timezone
sudo apt install -y curl wget git open-iscsi nfs-common
sudo ufw disable    # we'll harden later; K8s needs many ports
```

> `open-iscsi` and `nfs-common` are Longhorn prerequisites. Install them now so you don't forget.

#### Take ESXi Snapshot

In ESXi web client: right-click `rke2-control` → **Snapshots → Take snapshot**
- Name: `fresh-ubuntu-base`
- Description: Clean Ubuntu 22.04, static IP, swap disabled, packages updated

### 1.7 Create and Configure VM2 (Worker Node)

**Repeat the exact same process** with these differences:

| Setting | VM2 Value |
|---------|-----------|
| VM Name | `rke2-worker` |
| CPU | 12 |
| RAM | 32768 MB (32 GB) |
| Disk | 150 GB, Thin Provisioned |
| Hostname | `rke2-worker` |
| Static IP | `172.25.2.52` |
| Snapshot | `fresh-ubuntu-base` |

After both VMs are up, verify full connectivity:

```bash
# From VM1 → VM2
ping 172.25.2.52

# From VM2 → VM1
ping 172.25.2.51

# From bastion → both
ping 172.25.2.51
ping 172.25.2.52
```

All must succeed. If not, check that all machines share the same ESXi port group.

---

## Phase 2: Kubernetes Cluster Setup (Day 1)

### 2.1 What is RKE2?

RKE2 (Rancher Kubernetes Engine 2) bundles everything into a single installer: containerd (container runtime), etcd (cluster state database), CoreDNS, kube-proxy, and all control plane components. One command to install, one service to manage.

### 2.2 Install RKE2 Server on VM1

SSH into VM1:

```bash
ssh ubuntu@172.25.2.51
```

#### Download and install

```bash
curl -sfL https://get.rke2.io | sudo sh -
```

> **Air-gap note:** If VM1 has no internet, download the RKE2 tarball on an internet-connected machine, transfer through the bastion via SCP, and follow [RKE2 air-gap docs](https://docs.rke2.io/install/airgap).

#### Configure

```bash
sudo mkdir -p /etc/rancher/rke2
sudo nano /etc/rancher/rke2/config.yaml
```

Paste (this file is also at `infrastructure/rke2/control-plane-config.yaml` in this repo):

```yaml
write-kubeconfig-mode: "0644"
tls-san:
  - 172.25.2.51
  - rke2-control
node-name: rke2-control
node-ip: 172.25.2.51
```

What each line does:
- `write-kubeconfig-mode` → makes kubeconfig readable without sudo
- `tls-san` → adds IP/hostname to TLS cert so bastion can connect
- `node-name` → human-readable name in `kubectl get nodes`
- `node-ip` → which IP the cluster uses for communication

#### Start the server

```bash
sudo systemctl enable rke2-server
sudo systemctl start rke2-server

# Watch startup progress (Ctrl+C to stop)
sudo journalctl -u rke2-server -f
```

Takes 2-5 minutes on first start.

#### Set up kubectl

```bash
echo 'export PATH=$PATH:/var/lib/rancher/rke2/bin' >> ~/.bashrc
echo 'export KUBECONFIG=/etc/rancher/rke2/rke2.yaml' >> ~/.bashrc
source ~/.bashrc

# Verify
kubectl get nodes
```

You should see:
```
NAME           STATUS   ROLES                       AGE   VERSION
rke2-control   Ready    control-plane,etcd,master   5m    v1.28.x+rke2r1
```

#### Get the join token

```bash
sudo cat /var/lib/rancher/rke2/server/node-token
```

**Copy this entire string** — you'll need it for VM2.

### 2.3 Install RKE2 Agent on VM2

SSH into VM2:

```bash
ssh ubuntu@172.25.2.52
```

#### Download and install (agent mode)

```bash
curl -sfL https://get.rke2.io | INSTALL_RKE2_TYPE="agent" sudo sh -
```

#### Configure

```bash
sudo mkdir -p /etc/rancher/rke2
sudo nano /etc/rancher/rke2/config.yaml
```

Paste (also at `infrastructure/rke2/worker-config.yaml`):

```yaml
server: https://172.25.2.51:9345
token: PASTE_YOUR_TOKEN_HERE
node-name: rke2-worker
node-ip: 172.25.2.52
```

#### Start the agent

```bash
sudo systemctl enable rke2-agent
sudo systemctl start rke2-agent
sudo journalctl -u rke2-agent -f
```

### 2.4 Verify the Cluster

Back on VM1:

```bash
kubectl get nodes
```

Expected output:
```
NAME           STATUS   ROLES                       AGE   VERSION
rke2-control   Ready    control-plane,etcd,master   15m   v1.28.x+rke2r1
rke2-worker    Ready    <none>                      3m    v1.28.x+rke2r1
```

Both nodes **Ready** = your cluster is operational.

### 2.5 Remove Control Plane Taint

By default, no workloads run on the control plane. Since we only have 2 nodes, allow lighter services (ArgoCD, PostgreSQL, backend, frontend) on VM1:

```bash
kubectl taint nodes rke2-control node-role.kubernetes.io/control-plane:NoSchedule-
```

The trailing `-` removes the taint. Heavy AI model pods will still target VM2 via node selectors.

### 2.6 Snapshot

Take ESXi snapshots of both VMs: `rke2-cluster-ready`

---

## Phase 3: Cluster Add-ons (Day 2)

All commands run on **VM1** via SSH.

### 3.1 Longhorn (Persistent Storage)

#### Why Longhorn?

Pods are ephemeral — when they die, data dies with them. AI models are multi-gigabyte files. Longhorn provides persistent volumes that survive pod restarts, so models only download once.

#### Install

```bash
# Ensure prerequisite is running on both VMs
sudo systemctl enable iscsid && sudo systemctl start iscsid

# Apply Longhorn
kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/v1.6.0/deploy/longhorn.yaml

# Wait for all pods (3-5 minutes)
kubectl get pods -n longhorn-system -w
```

#### Access the Longhorn UI

```bash
kubectl -n longhorn-system patch svc longhorn-frontend \
  --type merge -p '{"spec":{"type":"NodePort"}}'

kubectl -n longhorn-system get svc longhorn-frontend
```

Open `http://172.25.2.51:<NodePort>` in the bastion's browser.

#### Set as default StorageClass

```bash
kubectl patch storageclass local-path \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'

kubectl patch storageclass longhorn \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

#### Create the shared models PVC

```bash
kubectl create namespace user-1
kubectl apply -f k8s-manifests/longhorn/shared-models-pvc.yaml
```

### 3.2 ArgoCD (GitOps Controller)

#### Why ArgoCD?

ArgoCD watches a Git repo for Kubernetes manifests. When the backend pushes a new deployment manifest, ArgoCD automatically applies it to the cluster — no manual `kubectl apply` needed. Git becomes the single source of truth.

#### Install

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods
kubectl get pods -n argocd -w
```

#### Access the ArgoCD UI

```bash
kubectl -n argocd patch svc argocd-server \
  --type merge -p '{"spec":{"type":"NodePort"}}'

# Get the port
kubectl -n argocd get svc argocd-server

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

Open `https://172.25.2.51:<NodePort>` in the bastion's browser. Login: `admin` / (password from above). **Change the password immediately.**

#### Generate an API token

In ArgoCD UI: **Settings → Accounts → admin → Tokens → Generate New**

Save this token — it becomes the `ARGOCD_TOKEN` environment variable.

### 3.3 PostgreSQL

#### Install Helm (if not bundled with RKE2)

```bash
helm version  # check if available

# If not:
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

#### Deploy PostgreSQL

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install postgres bitnami/postgresql \
  --set auth.postgresPassword=YourSecurePasswordHere \
  --set auth.database=ml_platform

# Wait for pod
kubectl get pods -l app.kubernetes.io/name=postgresql -w
```

#### Create the deployments table

```bash
kubectl exec -it postgres-postgresql-0 -- psql -U postgres -d ml_platform
```

```sql
CREATE TABLE deployments (
    deployment_id   VARCHAR(100) PRIMARY KEY,
    model_name      VARCHAR(100),
    cpu_request     VARCHAR(20),
    cpu_limit       VARCHAR(20),
    memory_request  VARCHAR(20),
    memory_limit    VARCHAR(20),
    replicas        INT,
    status          VARCHAR(50) DEFAULT 'pending',
    sync_status     VARCHAR(50) DEFAULT 'pending',
    api_endpoint    VARCHAR(200),
    node_port       INT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Verify
\dt
\q
```

Internal service address: `postgres-postgresql.default.svc.cluster.local:5432`

### 3.4 Docker Hub Pull Secret

```bash
# In user-1 namespace (for Ollama pods)
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n user-1

# In default namespace (for backend/frontend pods)
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n default
```

### 3.5 Snapshot

Take ESXi snapshots: `addons-installed`

---

## Phase 4: Git Repository & ArgoCD Application (Day 2)

### 4.1 Initialize the Repository

If you haven't already cloned this repo on VM1:

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/foundational-model-hosting-platform.git
cd foundational-model-hosting-platform
git config user.name "Your Name"
git config user.email "your@email.com"
```

### 4.2 Create a GitHub PAT

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate with `repo` scope
3. Save the token (becomes `GIT_TOKEN` env var)

Configure Git to use it:
```bash
git remote set-url origin \
  https://YOUR_USERNAME:YOUR_PAT@github.com/YOUR_USERNAME/foundational-model-hosting-platform.git
```

### 4.3 Create the ArgoCD Application

```bash
kubectl apply -f k8s-manifests/argocd/ml-platform-app.yaml
```

This tells ArgoCD to watch `k8s-manifests/manifests/` in this repo. Any YAML file pushed there will be automatically applied to the cluster.

### 4.4 Connect ArgoCD to Your Private Repo

In ArgoCD UI: **Settings → Repositories → Connect Repo**
- Method: **HTTPS**
- URL: `https://github.com/YOUR_USERNAME/foundational-model-hosting-platform.git`
- Username: your GitHub username
- Password: your PAT

---

## Phase 5: Backend API Development (Day 3)

### 5.1 Install Dependencies

```bash
cd backend
npm install
```

### 5.2 Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values
nano .env
```

### 5.3 Key Files

| File | Purpose |
|------|---------|
| `src/index.js` | Express server setup, middleware, route mounting |
| `src/routes/models.js` | `GET /api/models` — returns supported models list |
| `src/routes/deployments.js` | Full CRUD for deployments (create, list, get, delete) |
| `src/services/db.js` | PostgreSQL connection pool |
| `src/services/git.js` | Git operations (add, commit, push) |
| `src/services/argocd.js` | Triggers ArgoCD sync via REST API |
| `src/services/k8s.js` | Queries K8s API for pod status and NodePort |
| `src/services/manifest-generator.js` | Generates Kubernetes YAML from templates |
| `src/config/models.json` | Registry of supported AI models |
| `src/middleware/validator.js` | Input validation (CPU/memory format, replicas range) |
| `src/middleware/errorHandler.js` | Global error handler |

### 5.4 Build and Deploy

```bash
# Build container image
docker build -t YOUR_DOCKERHUB_USERNAME/ml-platform-backend:latest .
docker push YOUR_DOCKERHUB_USERNAME/ml-platform-backend:latest

# Deploy to cluster
kubectl apply -f ../k8s-manifests/backend/backend-deployment.yaml
```

---

## Phase 6: Frontend Development (Day 4)

### 6.1 Install Dependencies

```bash
cd frontend
npm install
```

### 6.2 Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | React Router setup (`/` = list, `/new` = form) |
| `src/pages/DeploymentsList.jsx` | Dashboard with polling, delete, status badges |
| `src/pages/NewDeployment.jsx` | Model selection form with validation |
| `src/components/DeploymentForm.jsx` | Form inputs, client-side validation |
| `src/components/DeploymentCard.jsx` | Individual deployment display |
| `src/components/StatusBadge.jsx` | Color-coded status indicator |
| `src/services/api.js` | Axios client pointing to backend NodePort |

### 6.3 Build and Deploy

```bash
docker build -t YOUR_DOCKERHUB_USERNAME/ml-platform-frontend:latest .
docker push YOUR_DOCKERHUB_USERNAME/ml-platform-frontend:latest

kubectl apply -f ../k8s-manifests/frontend/frontend-deployment.yaml
```

Frontend accessible at `http://172.25.2.51:<NodePort>` from the bastion.

---

## Phase 7: End-to-End Testing (Day 4)

### Full Flow Test

1. Open frontend at `http://172.25.2.51:<frontend-nodeport>`
2. Click **New Deployment**
3. Select **llama2** | CPU: `2000m` / `4000m` | Memory: `4Gi` / `8Gi` | Replicas: `1`
4. Click **Deploy**
5. Watch ArgoCD UI — sync triggers automatically
6. In terminal: `kubectl get pods -n user-1 -w` — watch pod phases
7. Frontend polls and shows **Running** with API endpoint

### Test the AI Endpoint

```bash
curl -X POST http://172.25.2.52:<nodeport>/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"llama2","prompt":"Hello, how are you?","stream":false}'
```

First request takes 30-60 seconds (model loading). Subsequent requests: 10-30 seconds for a full response.

### Test Delete Flow

Click **Delete** in the frontend → backend removes manifest from Git → ArgoCD syncs → K8s resources deleted → status shows **deleted**.

---

## Phase 8: Hardening & Production Readiness (Day 5)

### 8.1 Secrets

Never hardcode credentials. Store as Kubernetes Secrets:

```bash
kubectl create secret generic backend-secrets \
  --from-literal=PG_PASSWORD=YourPassword \
  --from-literal=GIT_TOKEN=YourGitToken \
  --from-literal=ARGOCD_TOKEN=YourArgoToken \
  -n default
```

### 8.2 Resource Quotas

Apply `k8s-manifests/quotas/user-1-quota.yaml` to prevent any deployment from consuming all cluster resources.

### 8.3 RBAC

Apply `k8s-manifests/rbac/argocd-rbac.yaml` to give ArgoCD minimum required permissions.

### 8.4 Observability

```bash
# Pod logs
kubectl logs -l app=ml-platform-backend -f
kubectl logs <pod> -c pull-model -n user-1
kubectl logs <pod> -c ollama-server -n user-1

# Resource usage (install metrics-server first)
kubectl top nodes
kubectl top pods -A
```

### 8.5 Disaster Recovery

#### VM Reboot Recovery
```bash
# VM1
sudo systemctl start rke2-server
# Wait 2-3 min, then verify
kubectl get nodes

# VM2
sudo systemctl start rke2-agent
```

#### Restore from Snapshot
ESXi web client → right-click VM → Snapshots → Manage snapshots → Restore to

---

## How Ollama Model Provisioning Works

This is the most important flow in the system. Here's exactly what happens when you deploy a model:

### The Pod Spec

The backend generates a Kubernetes manifest with a **two-container pod**:

```yaml
# Simplified — see manifest-generator.js for full version
spec:
  initContainers:
    - name: pull-model
      image: ollama/ollama:latest
      command: ["ollama", "pull", "llama2"]
      volumeMounts:
        - name: model-storage
          mountPath: /root/.ollama

  containers:
    - name: ollama-server
      image: ollama/ollama:latest
      command: ["ollama", "serve"]
      ports:
        - containerPort: 11434
      volumeMounts:
        - name: model-storage
          mountPath: /root/.ollama
      livenessProbe:
        httpGet: { path: /api/tags, port: 11434 }
        periodSeconds: 30
      readinessProbe:
        httpGet: { path: /api/tags, port: 11434 }
        periodSeconds: 10
        initialDelaySeconds: 30

  volumes:
    - name: model-storage
      persistentVolumeClaim:
        claimName: shared-models-pvc
```

### Step-by-Step

1. **initContainer starts** — runs `ollama pull llama2`
2. Ollama contacts `registry.ollama.ai` and downloads the GGUF model weights (~4GB for llama2) to `/root/.ollama/models/`
3. Files are written to the **shared Longhorn PVC** — they persist across pod restarts
4. initContainer exits with code 0
5. **Main container starts** — runs `ollama serve`
6. Ollama finds the model on the PVC, memory-maps it into RAM
7. HTTP server starts on port 11434 with endpoints `/api/generate`, `/api/chat`, `/api/tags`
8. **Readiness probe** hits `/api/tags` — when it returns 200, the pod is marked Ready
9. **NodePort Service** exposes port 11434 on a random port (30000-32767)
10. Backend polling detects the Running+Ready state, queries the NodePort, updates PostgreSQL

### The Shared PVC Optimization

All Ollama pods mount the **same PVC** (`shared-models-pvc`). This means:

- **First deploy of llama2:** initContainer downloads ~4GB → takes 5-10 minutes
- **Second deploy of llama2** (or replica scale-up): initContainer finds model already on PVC → skips download → starts in seconds
- **Deploy mistral:** different model, downloads to same PVC → both models now cached
- Each unique model only downloads once across all deployments

### Performance Notes

Since the Xeon E5-2630 v2 has **no GPU**, inference runs on CPU only:

| Model | Size | RAM Usage | Speed (approx.) |
|-------|------|-----------|-----------------|
| Phi-2 | 1.7 GB | ~3 GB | 8-15 tokens/sec |
| Gemma 2B | 1.4 GB | ~3 GB | 10-18 tokens/sec |
| LLaMA 2 7B | 3.8 GB | ~6 GB | 2-5 tokens/sec |
| Mistral 7B | 4.1 GB | ~6 GB | 2-5 tokens/sec |

Smaller models (Phi, Gemma) are significantly faster and recommended for demos.

---

## API Reference

### `GET /api/models`

Returns the list of supported AI models.

**Response:**
```json
[
  {
    "id": "llama2",
    "name": "LLaMA 2 7B",
    "size": "3.8GB",
    "description": "Meta's open source LLM"
  }
]
```

### `POST /api/deployments`

Creates a new model deployment.

**Request Body:**
```json
{
  "model_name": "llama2",
  "cpu_request": "2000m",
  "cpu_limit": "4000m",
  "memory_request": "4Gi",
  "memory_limit": "8Gi",
  "replicas": 1
}
```

**Validation:**
- `model_name` must exist in the models registry
- CPU format: `/^\d+m$/` (e.g., `2000m`)
- Memory format: `/^\d+[GgMm]i$/` (e.g., `4Gi`)
- Replicas: integer 1-10

**Response (201):**
```json
{
  "deployment_id": "deploy-1710834567890-a1b2c3",
  "status": "pending",
  "message": "Deployment created and sync triggered"
}
```

### `GET /api/deployments`

Returns all deployments.

**Response:**
```json
[
  {
    "deployment_id": "deploy-1710834567890-a1b2c3",
    "model_name": "llama2",
    "cpu_request": "2000m",
    "cpu_limit": "4000m",
    "memory_request": "4Gi",
    "memory_limit": "8Gi",
    "replicas": 1,
    "status": "running",
    "sync_status": "synced",
    "api_endpoint": "http://172.25.2.52:30123",
    "node_port": 30123,
    "created_at": "2026-03-19T10:00:00.000Z",
    "updated_at": "2026-03-19T10:05:00.000Z"
  }
]
```

### `GET /api/deployments/:id`

Returns a single deployment by ID.

### `DELETE /api/deployments/:id`

Removes a deployment. Deletes manifest from Git, triggers ArgoCD sync, updates DB status to `deleted`.

**Response (200):**
```json
{
  "message": "Deployment deleted",
  "deployment_id": "deploy-1710834567890-a1b2c3"
}
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| **Pod stuck `Pending`** | Insufficient CPU/memory or node taint | `kubectl describe pod <name> -n user-1` — check Events section. Remove taint or reduce resource requests |
| **`ImagePullBackOff`** | Missing `dockerhub-secret` in namespace | Create the secret in the correct namespace |
| **Model download fails** | No outbound internet from pods | Check DNS resolution and network policies. Pods need to reach `registry.ollama.ai` |
| **ArgoCD sync fails** | Git auth error or invalid YAML | Check ArgoCD app details in UI. Verify repo connection and PAT validity |
| **`CrashLoopBackOff`** | Ollama out of memory | Increase memory limits or switch to a smaller model (phi, gemma) |
| **Cannot reach NodePort** | Firewall blocking 30000-32767 | `sudo ufw allow 30000:32767/tcp` on both VMs |
| **Frontend can't reach backend** | Wrong API URL or CORS issue | Check `VITE_API_URL` in frontend. Verify backend CORS config allows bastion origin |
| **ArgoCD shows `OutOfSync`** | Manual changes made to cluster | Click Sync in ArgoCD UI to reconcile |
| **`kubectl` commands hang** | RKE2 server not running | `sudo systemctl status rke2-server` on VM1; restart if needed |
| **Nodes show `NotReady`** | Agent crashed or network issue | Check `journalctl -u rke2-agent` on VM2; restart agent |

### Useful Debug Commands

```bash
# Cluster overview
kubectl get nodes
kubectl get pods -A

# Describe a problem pod
kubectl describe pod <pod-name> -n <namespace>

# Pod logs
kubectl logs <pod-name> -c <container-name> -n <namespace>

# Events (shows scheduling, pulling, startup events)
kubectl get events -n user-1 --sort-by=.metadata.creationTimestamp

# Resource usage
kubectl top nodes
kubectl top pods -n user-1

# Check services and their NodePorts
kubectl get svc -A

# ArgoCD application status
kubectl get applications -n argocd
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **ESXi** | VMware's bare-metal hypervisor that runs VMs directly on server hardware |
| **Bastion Server** | A hardened intermediary machine that provides the only access point to a secure network |
| **VM** | Virtual Machine — a software-based computer running inside a hypervisor |
| **RKE2** | Rancher Kubernetes Engine 2 — a Kubernetes distribution bundling all dependencies |
| **Kubernetes (K8s)** | Container orchestration platform for automating deployment and scaling |
| **Pod** | Smallest deployable unit in K8s; contains one or more containers sharing network/storage |
| **Deployment** | K8s resource managing identical pod replicas with rolling updates |
| **Service** | K8s resource providing a stable network endpoint to reach pods |
| **NodePort** | Service type exposing a port (30000-32767) on every cluster node |
| **PVC** | PersistentVolumeClaim — a request for durable storage that survives pod restarts |
| **Longhorn** | Cloud-native distributed block storage for Kubernetes |
| **ArgoCD** | Declarative GitOps continuous delivery tool for Kubernetes |
| **GitOps** | Practice of using Git as the single source of truth for infrastructure state |
| **Helm** | Package manager for Kubernetes (think apt/npm but for K8s apps) |
| **Ollama** | Tool for running large language models locally with a REST API |
| **GGUF** | File format for quantized LLM weights used by Ollama/llama.cpp |
| **initContainer** | K8s container that runs before main containers; used here to pre-download models |
| **Manifest** | YAML file describing the desired state of a K8s resource |
| **etcd** | Distributed key-value store holding all Kubernetes cluster state |
| **kubelet** | Agent on every K8s node that starts pods and reports status |
| **CORS** | Cross-Origin Resource Sharing — browser security mechanism the backend must enable |

---

## License

MIT

---

## Acknowledgments

Built with [RKE2](https://docs.rke2.io/), [ArgoCD](https://argo-cd.readthedocs.io/), [Longhorn](https://longhorn.io/), [Ollama](https://ollama.ai/), [React](https://react.dev/), and [Express](https://expressjs.com/).
