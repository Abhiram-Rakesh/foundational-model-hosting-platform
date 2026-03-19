# Quick Setup Guide

Condensed version of the README for experienced users.

## 1. VMs (15 min)

Create 2 VMs in ESXi:
- VM1: `rke2-control` — 4 vCPU, 16GB RAM, 100GB disk, IP 172.25.2.51
- VM2: `rke2-worker` — 16 vCPU, 48GB RAM, 200GB disk, IP 172.25.2.52

Install Ubuntu 22.04 on both. Run setup scripts:

```bash
# VM1
sudo ./infrastructure/scripts/setup-control-plane.sh

# VM2 (pass the join token from VM1)
sudo ./infrastructure/scripts/setup-worker.sh <TOKEN>
```

## 2. RKE2 Cluster (10 min)

```bash
# VM1
sudo systemctl enable --now rke2-server
export PATH=$PATH:/var/lib/rancher/rke2/bin
export KUBECONFIG=/etc/rancher/rke2/rke2.yaml
kubectl get nodes

# VM2
sudo systemctl enable --now rke2-agent

# VM1 — remove taint
kubectl taint nodes rke2-control node-role.kubernetes.io/control-plane:NoSchedule-
```

## 3. Add-ons (20 min)

```bash
# Longhorn
kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/v1.6.0/deploy/longhorn.yaml

# ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# PostgreSQL
helm install postgres bitnami/postgresql --set auth.postgresPassword=SECRET --set auth.database=ml_platform

# Create table (see README for SQL)
# Create namespace + PVC + secrets (see README)
```

## 4. ArgoCD App

```bash
kubectl apply -f k8s-manifests/argocd/ml-platform-app.yaml
```

## 5. Backend + Frontend

```bash
cd backend && docker build -t user/ml-platform-backend:latest . && docker push ...
cd frontend && docker build -t user/ml-platform-frontend:latest . && docker push ...

kubectl apply -f k8s-manifests/backend/backend-deployment.yaml
kubectl apply -f k8s-manifests/frontend/frontend-deployment.yaml
```

## 6. Test

Open `http://172.25.2.51:<frontend-nodeport>` → Deploy a model → Watch it come up.
