# VM2 — Worker Node (rke2-worker)

| Setting | Value |
|---------|-------|
| **Hostname** | rke2-worker |
| **IP Address** | 172.25.2.52 |
| **vCPUs** | 12 |
| **RAM** | 32 GB (32768 MB) |
| **Disk** | 150 GB (Thin Provisioned) |
| **OS** | Ubuntu 22.04 LTS Server |
| **Role** | RKE2 Agent (Kubernetes worker node) |

## What Runs Here

- Ollama model pods (the heavy workloads)
- Longhorn storage replicas
- shared-models-pvc (25Gi — stores downloaded AI models, single replica)

## Key Ports

| Port | Service |
|------|---------|
| 22 | SSH |
| 10250 | Kubelet |
| 30000-32767 | NodePort range (Ollama endpoints exposed here) |

## Resource Budget

With 32 GB RAM and 12 vCPUs, approximate parallel capacity:

| Model | RAM per instance | Max parallel |
|-------|-----------------|-------------|
| Phi-2 / Gemma 2B | ~3 GB | ~8 |
| LLaMA 2 7B | ~6 GB | ~4 |
| Mistral 7B | ~6 GB | ~4 |

Leave ~8 GB for system overhead and Longhorn.
