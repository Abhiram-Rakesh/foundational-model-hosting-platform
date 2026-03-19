/**
 * src/services/argocd.js — ArgoCD sync trigger
 *
 * After pushing a manifest to Git, we tell ArgoCD to sync immediately
 * instead of waiting for its default 3-minute polling interval.
 *
 * We call the ArgoCD REST API:
 *   POST /api/v1/applications/{appName}/sync
 *   Authorization: Bearer <token>
 *
 * The ArgoCD server uses a self-signed TLS certificate inside the cluster,
 * so we disable certificate verification (rejectUnauthorized: false).
 * This is a known trade-off documented as technical debt.
 */

const axios = require("axios");
const https = require("https");

// Create an HTTPS agent that ignores self-signed certificate errors
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Trigger an immediate sync of the ArgoCD application.
 * This makes ArgoCD pull the latest Git commit and apply any changes.
 */
async function triggerSync() {
  const argocdUrl = process.env.ARGOCD_URL || "https://argocd-server.argocd.svc.cluster.local:443";
  const token = process.env.ARGOCD_TOKEN || "";
  const appName = process.env.ARGOCD_APP_NAME || "ml-platform";

  const url = `${argocdUrl}/api/v1/applications/${appName}/sync`;

  console.log(`[ARGOCD] Triggering sync: ${url}`);

  const response = await axios.post(
    url,
    {
      // Empty body triggers a full sync
      // You can optionally specify specific resources to sync
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
      timeout: 15000, // 15 second timeout
    }
  );

  console.log(`[ARGOCD] Sync response status: ${response.status}`);
  return response.data;
}

/**
 * Get the current status of the ArgoCD application.
 * Useful for debugging sync issues.
 */
async function getAppStatus() {
  const argocdUrl = process.env.ARGOCD_URL || "https://argocd-server.argocd.svc.cluster.local:443";
  const token = process.env.ARGOCD_TOKEN || "";
  const appName = process.env.ARGOCD_APP_NAME || "ml-platform";

  const url = `${argocdUrl}/api/v1/applications/${appName}`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    httpsAgent,
    timeout: 10000,
  });

  return {
    health: response.data.status?.health?.status,
    sync: response.data.status?.sync?.status,
    operationState: response.data.status?.operationState?.phase,
  };
}

module.exports = {
  triggerSync,
  getAppStatus,
};
