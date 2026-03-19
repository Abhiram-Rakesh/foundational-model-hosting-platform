# Architecture

## System Overview

The platform consists of six layers:

1. **Physical Layer** — HP ProLiant DL360p Gen8 running ESXi 7.0, accessible only via a Windows bastion server
2. **VM Layer** — Two Ubuntu 22.04 VMs: VM1 (control plane, 16GB/4vCPU) and VM2 (worker, 48GB/16vCPU)
3. **Kubernetes Layer** — RKE2 cluster spanning both VMs
4. **Platform Services** — ArgoCD (GitOps), Longhorn (storage), PostgreSQL (database)
5. **Application Layer** — Backend (Express.js) + Frontend (React) running as K8s pods
6. **Model Layer** — Dynamically created Ollama pods serving AI models

## Key Design Decisions

### GitOps with ArgoCD
Instead of having the backend directly `kubectl apply` manifests, we push YAML files to Git and let ArgoCD handle the reconciliation. This means Git is the single source of truth, every deployment is auditable via commit history, rollbacks are just `git revert`, and the backend doesn't need cluster-admin permissions.

### Shared PVC for Models
All Ollama pods mount the same `shared-models-pvc`. A model only downloads once — subsequent pods of the same model find it already on disk. This trades some storage isolation for massive time savings.

### initContainer Pattern
The model download (which can take 5-10 minutes) happens in an initContainer, not the main container. This keeps the main container's startup clean — it just runs `ollama serve` and finds the model already on disk.

### NodePort Exposure
We use NodePort services because this is a bare-metal environment without a cloud load balancer. Each deployed model gets a random port in 30000-32767, and the backend discovers it by querying the Kubernetes API.

## Network Flow

```
Bastion Browser → http://172.25.2.51:<frontend-nodeport>  (Frontend)
Frontend        → http://172.25.2.51:<backend-nodeport>   (Backend API)
Backend         → postgres-postgresql.default.svc:5432     (Database)
Backend         → https://argocd-server.argocd.svc:443     (ArgoCD API)
Backend         → https://github.com/...                   (Git push)
User/Client     → http://172.25.2.52:<model-nodeport>      (Ollama inference)
```
