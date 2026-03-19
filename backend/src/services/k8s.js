/**
 * src/services/k8s.js — Kubernetes API queries
 *
 * This module does two things:
 *
 * 1. Runs a background polling loop (every 10 seconds) that checks the
 *    status of "pending" or "deploying" deployments by querying the
 *    Kubernetes API for pod and service status.
 *
 * 2. When a pod becomes Running+Ready, queries the associated Service
 *    for its NodePort, then updates PostgreSQL with status=running,
 *    the API endpoint URL, and the NodePort number.
 *
 * We use the K8s API via kubectl exec (simple approach) or direct HTTPS
 * calls. For simplicity, this implementation shells out to kubectl.
 */

const { execSync } = require("child_process");
const db = require("./db");

const CLUSTER_IP = process.env.CLUSTER_IP || "172.25.2.52";
const POLL_INTERVAL = 10000; // 10 seconds

/**
 * Query Kubernetes for the status of a specific deployment's pods.
 *
 * @param {string} deploymentId - The deployment ID (used as label selector)
 * @param {string} namespace - The Kubernetes namespace
 * @returns {Object} { phase, ready, containerStatuses }
 */
function getPodStatus(deploymentId, namespace) {
  try {
    // Get pods matching this deployment
    const output = execSync(
      `kubectl get pods -n ${namespace} -l app=${deploymentId} -o json`,
      { stdio: "pipe", timeout: 10000 }
    ).toString();

    const data = JSON.parse(output);

    if (!data.items || data.items.length === 0) {
      return { phase: "not_found", ready: false };
    }

    const pod = data.items[0]; // Take the first pod
    const phase = pod.status?.phase || "Unknown";

    // Check if all containers are ready
    const conditions = pod.status?.conditions || [];
    const readyCondition = conditions.find((c) => c.type === "Ready");
    const ready = readyCondition?.status === "True";

    // Check for error states
    const containerStatuses = pod.status?.containerStatuses || [];
    const waiting = containerStatuses.find(
      (cs) => cs.state?.waiting?.reason === "CrashLoopBackOff" ||
              cs.state?.waiting?.reason === "ImagePullBackOff" ||
              cs.state?.waiting?.reason === "ErrImagePull"
    );

    if (waiting) {
      return {
        phase: "failed",
        ready: false,
        reason: waiting.state.waiting.reason,
      };
    }

    return { phase, ready };
  } catch (err) {
    console.error(`[K8S] Error getting pod status for ${deploymentId}:`, err.message);
    return { phase: "error", ready: false };
  }
}

/**
 * Query the NodePort assigned to a deployment's Service.
 *
 * @param {string} deploymentId - The deployment ID (service name = {deploymentId}-svc)
 * @param {string} namespace - The Kubernetes namespace
 * @returns {number|null} The NodePort number, or null if not found
 */
function getServiceNodePort(deploymentId, namespace) {
  try {
    const output = execSync(
      `kubectl get svc ${deploymentId}-svc -n ${namespace} -o jsonpath='{.spec.ports[0].nodePort}'`,
      { stdio: "pipe", timeout: 10000 }
    ).toString().replace(/'/g, "");

    const port = parseInt(output);
    return isNaN(port) ? null : port;
  } catch (err) {
    console.error(`[K8S] Error getting NodePort for ${deploymentId}:`, err.message);
    return null;
  }
}

/**
 * The main polling loop. Called every POLL_INTERVAL milliseconds.
 * Checks all "pending" or "deploying" deployments and updates their status.
 */
async function pollDeploymentStatuses() {
  try {
    // Find all non-terminal deployments
    const result = await db.query(
      `SELECT deployment_id, model_name FROM deployments WHERE status IN ('pending', 'deploying')`
    );

    if (result.rows.length === 0) return; // Nothing to check

    for (const deployment of result.rows) {
      const { deployment_id } = deployment;
      const namespace = "user-1";

      // Query Kubernetes for pod status
      const podStatus = getPodStatus(deployment_id, namespace);

      if (podStatus.phase === "Running" && podStatus.ready) {
        // Pod is healthy! Get the NodePort.
        const nodePort = getServiceNodePort(deployment_id, namespace);

        if (nodePort) {
          const apiEndpoint = `http://${CLUSTER_IP}:${nodePort}`;

          await db.query(
            `UPDATE deployments
             SET status = 'running',
                 api_endpoint = $1,
                 node_port = $2,
                 updated_at = NOW()
             WHERE deployment_id = $3`,
            [apiEndpoint, nodePort, deployment_id]
          );

          console.log(`[K8S] Deployment ${deployment_id} is RUNNING at ${apiEndpoint}`);
        }
      } else if (podStatus.phase === "failed") {
        // Pod is in an error state
        await db.query(
          `UPDATE deployments
           SET status = 'failed',
               updated_at = NOW()
           WHERE deployment_id = $1`,
          [deployment_id]
        );

        console.log(`[K8S] Deployment ${deployment_id} FAILED: ${podStatus.reason}`);
      } else if (podStatus.phase === "Running" && !podStatus.ready) {
        // Pod is running but not ready yet (probes haven't passed)
        await db.query(
          `UPDATE deployments SET status = 'deploying', updated_at = NOW() WHERE deployment_id = $1`,
          [deployment_id]
        );
      }
      // If "not_found" or "Pending", keep status as-is and check again next cycle
    }
  } catch (err) {
    console.error("[K8S] Polling error:", err.message);
  }
}

/**
 * Start the background polling loop.
 * Called once from index.js at server startup.
 */
function startStatusPoller() {
  console.log(`[K8S] Starting status poller (every ${POLL_INTERVAL / 1000}s)`);
  setInterval(pollDeploymentStatuses, POLL_INTERVAL);
}

module.exports = {
  getPodStatus,
  getServiceNodePort,
  startStatusPoller,
};
