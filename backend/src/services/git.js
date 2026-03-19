/**
 * src/services/git.js — Git operations (write, add, commit, push)
 *
 * The backend writes Kubernetes manifest files into a local clone of the
 * GitHub repository, then commits and pushes. ArgoCD watches that repo
 * and applies any changes to the cluster.
 *
 * This module uses child_process.execSync for simplicity. In production,
 * you might want to use a library like simple-git for better error handling.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// The local path where the Git repo is cloned inside the container
const REPO_PATH = process.env.GIT_REPO_PATH || "/app/repo";

/**
 * Ensure the Git repo is cloned and configured.
 * Called once at startup and before any write operations.
 */
function ensureRepo() {
  const gitDir = path.join(REPO_PATH, ".git");

  if (!fs.existsSync(gitDir)) {
    console.log("[GIT] Cloning repository...");

    const username = process.env.GIT_USERNAME || "git";
    const token = process.env.GIT_TOKEN || "";
    const repoUrl = process.env.GIT_REPO_URL || "";

    // Embed token in URL for HTTPS auth:
    // https://username:token@github.com/user/repo.git
    const authedUrl = repoUrl.replace(
      "https://",
      `https://${username}:${token}@`
    );

    execSync(`git clone ${authedUrl} ${REPO_PATH}`, { stdio: "pipe" });
    execSync(`git config user.name "ML Platform Backend"`, { cwd: REPO_PATH });
    execSync(`git config user.email "backend@ml-platform.local"`, { cwd: REPO_PATH });

    console.log("[GIT] Repository cloned successfully");
  } else {
    // Pull latest to avoid conflicts
    try {
      execSync("git pull --rebase origin main", { cwd: REPO_PATH, stdio: "pipe" });
    } catch (err) {
      console.warn("[GIT] Pull failed (may be OK if no remote changes):", err.message);
    }
  }
}

/**
 * Write a manifest file to the Git repo.
 * Creates directories if they don't exist.
 *
 * @param {string} dirPath  - Relative directory path (e.g., "k8s-manifests/manifests/user-1/deploy-xxx")
 * @param {string} fileName - File name (e.g., "deployment.yaml")
 * @param {string} content  - YAML content to write
 */
async function writeManifest(dirPath, fileName, content) {
  ensureRepo();

  const fullDir = path.join(REPO_PATH, dirPath);
  const fullPath = path.join(fullDir, fileName);

  // Create directory tree if it doesn't exist
  fs.mkdirSync(fullDir, { recursive: true });

  // Write the manifest file
  fs.writeFileSync(fullPath, content, "utf-8");

  console.log(`[GIT] Wrote manifest: ${dirPath}/${fileName}`);
}

/**
 * Remove a manifest directory from the Git repo.
 *
 * @param {string} dirPath - Relative directory path to remove
 */
async function removeManifest(dirPath) {
  ensureRepo();

  const fullDir = path.join(REPO_PATH, dirPath);

  if (fs.existsSync(fullDir)) {
    fs.rmSync(fullDir, { recursive: true, force: true });
    console.log(`[GIT] Removed directory: ${dirPath}`);
  } else {
    console.warn(`[GIT] Directory not found (already deleted?): ${dirPath}`);
  }
}

/**
 * Stage all changes, commit with a message, and push to origin main.
 *
 * @param {string} message - Commit message
 */
async function commitAndPush(message) {
  ensureRepo();

  try {
    // Stage all changes (new files, modifications, deletions)
    execSync("git add -A", { cwd: REPO_PATH, stdio: "pipe" });

    // Check if there are actually any changes to commit
    try {
      execSync("git diff --cached --quiet", { cwd: REPO_PATH, stdio: "pipe" });
      // If the above succeeds (exit 0), there are no staged changes
      console.log("[GIT] No changes to commit");
      return;
    } catch {
      // Exit code 1 means there ARE differences — this is the normal path
    }

    // Commit
    const timestamp = new Date().toISOString();
    execSync(`git commit -m "${message} [${timestamp}]"`, {
      cwd: REPO_PATH,
      stdio: "pipe",
    });

    // Push
    execSync("git push origin main", { cwd: REPO_PATH, stdio: "pipe" });

    console.log(`[GIT] Pushed: "${message}"`);
  } catch (err) {
    console.error("[GIT] Commit/push failed:", err.message);
    throw new Error(`Git operation failed: ${err.message}`);
  }
}

module.exports = {
  writeManifest,
  removeManifest,
  commitAndPush,
  ensureRepo,
};
