/**
 * src/routes/deployments.js — CRUD for /api/deployments
 *
 * This is the most important file in the backend. It handles:
 *   POST   /api/deployments      — Create a new model deployment
 *   GET    /api/deployments      — List all deployments
 *   GET    /api/deployments/:id  — Get a single deployment
 *   DELETE /api/deployments/:id  — Delete a deployment
 *
 * The POST flow:
 *   1. Validate input (model exists, resource format correct, replicas 1-10)
 *   2. Generate a unique deployment_id
 *   3. INSERT into PostgreSQL with status=pending
 *   4. Generate a Kubernetes manifest YAML from template
 *   5. Write the manifest file to the local Git repo clone
 *   6. git add, commit, push
 *   7. Trigger ArgoCD sync via its REST API
 *   8. Return 201 with the deployment_id
 *
 * The DELETE flow:
 *   1. Remove the manifest directory from the Git repo
 *   2. git add, commit, push
 *   3. Trigger ArgoCD sync (ArgoCD will delete the K8s resources)
 *   4. UPDATE PostgreSQL status to "deleted"
 */

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../services/db");
const git = require("../services/git");
const argocd = require("../services/argocd");
const manifestGenerator = require("../services/manifest-generator");
const { validateDeploymentInput } = require("../middleware/validator");
const models = require("../config/models.json");

// ---------------------------------------------------------------------------
// POST /api/deployments — Create a new deployment
// ---------------------------------------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    // --- Step 1: Validate input ---
    const errors = validateDeploymentInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const { model_name, cpu_request, cpu_limit, memory_request, memory_limit, replicas } = req.body;

    // Verify model exists in registry
    const model = models.find((m) => m.id === model_name);
    if (!model) {
      return res.status(400).json({ error: `Model '${model_name}' is not supported` });
    }

    // --- Step 2: Generate deployment ID ---
    // Format: deploy-<timestamp>-<short-uuid>
    const timestamp = Date.now();
    const shortId = uuidv4().split("-")[0];
    const deploymentId = `deploy-${timestamp}-${shortId}`;

    console.log(`[DEPLOY] Creating deployment: ${deploymentId} (model: ${model_name})`);

    // --- Step 3: Insert into PostgreSQL ---
    const insertQuery = `
      INSERT INTO deployments
        (deployment_id, model_name, cpu_request, cpu_limit,
         memory_request, memory_limit, replicas, status, sync_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending')
      RETURNING *
    `;
    const result = await db.query(insertQuery, [
      deploymentId, model_name, cpu_request, cpu_limit,
      memory_request, memory_limit, replicas,
    ]);

    console.log(`[DEPLOY] DB record created: ${deploymentId}`);

    // --- Step 4: Generate Kubernetes manifest ---
    const manifest = manifestGenerator.generate({
      deploymentId,
      modelName: model_name,
      cpuRequest: cpu_request,
      cpuLimit: cpu_limit,
      memoryRequest: memory_request,
      memoryLimit: memory_limit,
      replicas,
      namespace: "user-1",
    });

    console.log(`[DEPLOY] Manifest generated for ${deploymentId}`);

    // --- Step 5: Write manifest to Git repo ---
    const manifestPath = `k8s-manifests/manifests/user-1/${deploymentId}`;
    await git.writeManifest(manifestPath, "deployment.yaml", manifest);

    console.log(`[DEPLOY] Manifest written to ${manifestPath}/deployment.yaml`);

    // --- Step 6: Git add, commit, push ---
    await git.commitAndPush(`Deploy ${deploymentId} (${model_name})`);

    // Update sync status in DB
    await db.query(
      `UPDATE deployments SET sync_status = 'synced', updated_at = NOW() WHERE deployment_id = $1`,
      [deploymentId]
    );

    console.log(`[DEPLOY] Git push complete for ${deploymentId}`);

    // --- Step 7: Trigger ArgoCD sync ---
    try {
      await argocd.triggerSync();
      console.log(`[DEPLOY] ArgoCD sync triggered for ${deploymentId}`);
    } catch (syncErr) {
      // ArgoCD sync failure is non-fatal — it will auto-sync eventually
      console.error(`[DEPLOY] ArgoCD sync trigger failed (non-fatal):`, syncErr.message);
    }

    // --- Step 8: Return response ---
    res.status(201).json({
      deployment_id: deploymentId,
      model_name,
      status: "pending",
      sync_status: "synced",
      message: "Deployment created and sync triggered. Poll GET /api/deployments for status updates.",
    });

  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/deployments — List all deployments
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM deployments ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/deployments/:id — Get a single deployment
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM deployments WHERE deployment_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Deployment not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/deployments/:id — Delete a deployment
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res, next) => {
  try {
    const deploymentId = req.params.id;

    // Verify deployment exists
    const existing = await db.query(
      `SELECT * FROM deployments WHERE deployment_id = $1`,
      [deploymentId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    console.log(`[DELETE] Removing deployment: ${deploymentId}`);

    // --- Remove manifest from Git repo ---
    const manifestPath = `k8s-manifests/manifests/user-1/${deploymentId}`;
    await git.removeManifest(manifestPath);
    await git.commitAndPush(`Delete ${deploymentId}`);

    console.log(`[DELETE] Git push complete for ${deploymentId}`);

    // --- Trigger ArgoCD sync ---
    try {
      await argocd.triggerSync();
      console.log(`[DELETE] ArgoCD sync triggered for ${deploymentId}`);
    } catch (syncErr) {
      console.error(`[DELETE] ArgoCD sync trigger failed (non-fatal):`, syncErr.message);
    }

    // --- Update DB ---
    await db.query(
      `UPDATE deployments SET status = 'deleted', sync_status = 'synced', updated_at = NOW() WHERE deployment_id = $1`,
      [deploymentId]
    );

    res.json({
      message: "Deployment deleted",
      deployment_id: deploymentId,
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
