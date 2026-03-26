# Troubleshooting

## Common Issues

### Bastion can't ping VM (100% packet loss after setting static IP)

**Cause:** VM has two network adapters (internet + VM Network) and the static IP was assigned to the internet adapter (`ens160`) instead of the VM Network adapter (`ens192`).

**Fix:** Edit `/etc/netplan/00-installer-config.yaml` from the ESXi console and split the config across both adapters:

```yaml
network:
  version: 2
  ethernets:
    ens160:        # internet adapter — DHCP handles the default route
      dhcp4: true
    ens192:        # VM Network adapter — check name with: ip link show
      dhcp4: false
      addresses:
        - 172.25.2.51/24   # 172.25.2.52 for VM2
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

> Do **not** add a `routes: default` block to `ens192`. It will redirect all traffic (including internet) through the VM Network adapter, breaking outbound connectivity.

```bash
sudo netplan apply
```

### ArgoCD "account does not have apiKey capability"

**Cause:** The admin account does not have the `apiKey` capability enabled by default.

**Fix:**
```bash
kubectl -n argocd patch configmap argocd-cm \
  --type merge \
  -p '{"data":{"accounts.admin":"apiKey,login"}}'
```

No restart needed — retry generating the token in the UI immediately.

### Docker Hub push fails with "insufficient_scope"

**Cause:** The Docker Hub access token was created with **Read-only** permission. Pushing images requires **Read & Write**.

**Fix:** Delete the old token in Docker Hub → **Account Settings → Security**, create a new one with **Read & Write** permission, then:
```bash
docker login   # use new token
```

Also recreate the Kubernetes pull secrets with the new token:
```bash
kubectl delete secret dockerhub-secret -n user-1
kubectl delete secret dockerhub-secret -n default

kubectl create secret docker-registry dockerhub-secret \
  --docker-username=YOUR_USERNAME \
  --docker-password=NEW_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n user-1

kubectl create secret docker-registry dockerhub-secret \
  --docker-username=YOUR_USERNAME \
  --docker-password=NEW_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n default
```

### Deploy fails with "git clone /app/repo does not exist"

**Cause:** `GIT_REPO_URL` env var is missing from the backend deployment manifest, so the backend tries to clone a local path instead of GitHub.

**Fix:** Ensure `GIT_REPO_URL`, `GIT_USERNAME`, and `ARGOCD_APP_NAME` are set in `backend-deployment.yaml` and reapply:

```bash
kubectl apply -f k8s-manifests/backend/backend-deployment.yaml
kubectl rollout restart deployment ml-platform-backend -n default
```

### Model dropdown is blank on New Deployment page

**Cause:** The frontend is pointing to the wrong backend NodePort. The fallback URL in `api.js` may not match the actual assigned NodePort.

**Fix:** Check the actual backend NodePort:
```bash
kubectl get svc ml-platform-backend -n default
```

Update `frontend/src/services/api.js` with the correct port, rebuild and redeploy:
```bash
cd ~/foundational-model-hosting-platform/frontend
npm install
docker build -t cloudseederabhi/ml-platform-frontend:latest .
docker push cloudseederabhi/ml-platform-frontend:latest
kubectl rollout restart deployment ml-platform-frontend -n default
```

### kubectl not found inside backend container

**Cause:** The backend Dockerfile did not include `kubectl`, which is required for pod status polling.

**Fix:** The Dockerfile now installs `kubectl` during the build. Rebuild the backend image and redeploy.

### Pods stuck in `InvalidImageName`

**Cause:** The deployment manifests still contain the `YOUR_DOCKERHUB_USERNAME` placeholder instead of the actual Docker Hub username.

**Fix:** Update the image field in both manifests and reapply:
```bash
kubectl apply -f k8s-manifests/backend/backend-deployment.yaml
kubectl apply -f k8s-manifests/frontend/frontend-deployment.yaml
```

### Docker build fails — "package-lock.json not found"

**Cause:** `npm ci` in the Dockerfile requires a `package-lock.json` file which isn't committed to the repo.

**Fix:** Run `npm install` locally first to generate it, then build:
```bash
npm install
docker build -t cloudseederabhi/ml-platform-backend:latest .
```

### rke2-agent fails with "Invalid CA hash length"

**Cause:** The join token in `/etc/rancher/rke2/config.yaml` on VM2 was copy-pasted and got truncated. The token is 108 characters — losing even one character causes this error.

**Fix:** Rewrite the config from VM1 without copy-paste:

```bash
TOKEN=$(sudo cat /var/lib/rancher/rke2/server/node-token | tr -d '\n') && ssh ubuntu@172.25.2.52 "sudo tee /etc/rancher/rke2/config.yaml << 'EOF'
server: https://172.25.2.51:9345
token: ${TOKEN}
node-name: rke2-worker
node-ip: 172.25.2.52
EOF"
```

Verify token length (should return `109`):
```bash
ssh ubuntu@172.25.2.52 "sudo grep token /etc/rancher/rke2/config.yaml | awk '{print \$2}' | wc -c"
```

Then restart the agent:
```bash
ssh ubuntu@172.25.2.52 "sudo systemctl restart rke2-agent"
```

### No internet after reboot (ping 8.8.8.8 fails, 172.25.2.x still reachable)

**Cause:** A `default` route was added to the VM Network adapter (`ens192`) in netplan, overriding the DHCP default route from the internet adapter (`ens160`). All outbound traffic routes through the wrong adapter.

**Fix:** Remove the `routes` block from `ens192` in `/etc/netplan/00-installer-config.yaml` and re-apply:

```bash
sudo netplan apply
ping 8.8.8.8   # should work immediately
```

### Pod stuck in `Pending` state

**Cause:** Insufficient resources or node taint preventing scheduling.

**Debug:**
```bash
kubectl describe pod <pod-name> -n user-1
# Look at the Events section at the bottom
```

**Fixes:**
- If "Insufficient cpu/memory": reduce resource requests in the deployment form, or use a smaller model
- If "0/2 nodes are available: 1 node(s) had untolerated taint": remove the control plane taint:
  ```bash
  kubectl taint nodes rke2-control node-role.kubernetes.io/control-plane:NoSchedule-
  ```

### `ImagePullBackOff` or `ErrImagePull`

**Cause:** Kubernetes can't pull the container image (usually missing Docker Hub credentials).

**Debug:**
```bash
kubectl describe pod <pod-name> -n user-1
# Look for "Failed to pull image" in events
```

**Fix:** Create the Docker Hub secret in the correct namespace:
```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=USER --docker-password=TOKEN --docker-email=EMAIL \
  -n user-1
```

### Model download takes forever or fails

**Cause:** The pod can't resolve or reach `registry.ollama.ai`.

**Debug:**
```bash
kubectl logs <pod-name> -c pull-model -n user-1
kubectl exec -it <pod-name> -n user-1 -- nslookup registry.ollama.ai
```

**Fix:** Check DNS resolution and outbound HTTPS from inside the pod:
```bash
kubectl run test --rm -it --image=busybox -- wget -O- https://registry.ollama.ai
```

### `CrashLoopBackOff`

**Cause:** Usually Ollama running out of memory (OOMKilled).

**Debug:**
```bash
kubectl describe pod <pod-name> -n user-1
# Look for "OOMKilled" in container state
```

**Fix:** Increase memory limits or use a smaller model. Phi-2 and Gemma 2B only need ~3GB.

### ArgoCD sync fails

**Debug:** Check the ArgoCD UI → click on the `ml-platform` application → check the sync status and any error messages.

**Common causes:**
- Git repo auth expired: update the PAT in ArgoCD Settings → Repositories
- Invalid YAML: check the manifest file for syntax errors
- RBAC: ArgoCD doesn't have permissions → apply `k8s-manifests/rbac/argocd-rbac.yaml`

### Frontend can't reach backend

**Debug:** Open browser dev tools → Network tab → check for failed requests.

**Fixes:**
- Verify the backend service is running: `kubectl get svc ml-platform-backend`
- Check that `VITE_API_URL` in the frontend points to the correct NodePort
- Ensure backend has CORS enabled (it does by default with `app.use(cors())`)

### `kubectl` commands hang or timeout

**Cause:** RKE2 server not running.

**Fix:**
```bash
# On VM1
sudo systemctl status rke2-server
sudo systemctl restart rke2-server
sudo journalctl -u rke2-server -f
```

### Nodes show `NotReady`

**Fix:**
```bash
# Check agent on VM2
ssh ubuntu@172.25.2.52
sudo systemctl status rke2-agent
sudo journalctl -u rke2-agent --since "5 min ago"
sudo systemctl restart rke2-agent
```

## Useful Debug Commands

```bash
# Cluster overview
kubectl get nodes -o wide
kubectl get pods -A
kubectl get svc -A

# Events (sorted by time)
kubectl get events -n user-1 --sort-by=.metadata.creationTimestamp

# Resource usage
kubectl top nodes
kubectl top pods -n user-1

# Describe a problematic resource
kubectl describe pod <name> -n <namespace>
kubectl describe svc <name> -n <namespace>

# Follow logs
kubectl logs -f <pod> -c <container> -n <namespace>

# Interactive shell in a pod
kubectl exec -it <pod> -n <namespace> -- /bin/sh

# ArgoCD status
kubectl get applications -n argocd
```

## Nuclear Options (Last Resort)

### Restart everything
```bash
# VM1
sudo systemctl restart rke2-server

# VM2
sudo systemctl restart rke2-agent

# Wait 3-5 minutes, then check
kubectl get nodes
kubectl get pods -A
```

### Restore from ESXi snapshot
If everything is broken, restore both VMs to a known-good snapshot:
1. ESXi web client → right-click VM → Snapshots → Manage → Restore
2. Power on both VMs
3. Wait for RKE2 services to start automatically
4. Verify: `kubectl get nodes && kubectl get pods -A`
