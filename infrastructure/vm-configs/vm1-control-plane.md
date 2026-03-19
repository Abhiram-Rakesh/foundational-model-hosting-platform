# VM1 — Control Plane (rke2-control)

| Setting | Value |
|---------|-------|
| **Hostname** | rke2-control |
| **IP Address** | 172.25.2.51 |
| **vCPUs** | 4 |
| **RAM** | 16 GB (16384 MB) |
| **Disk** | 100 GB (Thin Provisioned) |
| **OS** | Ubuntu 22.04 LTS Server |
| **Role** | RKE2 Server (Kubernetes control plane) |

## What Runs Here

- Kubernetes API Server, etcd, Scheduler, Controller Manager
- ArgoCD (GitOps controller)
- PostgreSQL (application database)
- Backend API (Express.js)
- Frontend (React + Nginx)
- Longhorn Manager

## Key Ports

| Port | Service |
|------|---------|
| 22 | SSH |
| 6443 | Kubernetes API |
| 9345 | RKE2 Supervisor |
| 10250 | Kubelet |
| 2379-2380 | etcd |
| 30000-32767 | NodePort range |
