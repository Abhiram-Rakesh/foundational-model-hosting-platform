# VM2 — Worker Node (rke2-worker)

| Setting | Value |
|---------|-------|
| **Hostname** | rke2-worker |
| **IP Address** | 172.25.2.52 |
| **vCPUs** | 16 |
| **RAM** | 48 GB (49152 MB) |
| **Disk** | 200 GB (Thin Provisioned) |
| **OS** | Ubuntu 22.04 LTS Server |
| **Role** | RKE2 Agent (Kubernetes worker node) |

## What Runs Here

- Ollama model pods (the heavy workloads)
- Longhorn storage replicas
- shared-models-pvc (50Gi — stores downloaded AI models)

## Key Ports

| Port | Service |
|------|---------|
| 22 | SSH |
| 10250 | Kubelet |
| 30000-32767 | NodePort range (Ollama endpoints exposed here) |

## Resource Budget

With 48 GB RAM and 16 vCPUs, approximate parallel capacity:

| Model | RAM per instance | Max parallel |
|-------|-----------------|-------------|
| Phi-2 / Gemma 2B | ~3 GB | ~12 |
| LLaMA 2 7B | ~6 GB | ~6 |
| Mistral 7B | ~6 GB | ~6 |

Leave ~8 GB for system overhead and Longhorn.
