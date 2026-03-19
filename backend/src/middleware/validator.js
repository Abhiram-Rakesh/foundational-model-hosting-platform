/**
 * src/middleware/validator.js — Input validation
 *
 * Validates deployment creation requests before they reach the database
 * or Git. Returns an array of error messages (empty = valid).
 */

const models = require("../config/models.json");

// CPU format: digits followed by "m" (millicores), e.g., "2000m"
const CPU_REGEX = /^\d+m$/;

// Memory format: digits followed by Gi or Mi, e.g., "4Gi", "512Mi"
const MEMORY_REGEX = /^\d+[GM]i$/;

/**
 * Validate a deployment creation request body.
 *
 * @param {Object} body - Request body
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateDeploymentInput(body) {
  const errors = [];

  // --- model_name ---
  if (!body.model_name) {
    errors.push("model_name is required");
  } else {
    const validModel = models.find((m) => m.id === body.model_name);
    if (!validModel) {
      const validIds = models.map((m) => m.id).join(", ");
      errors.push(`model_name '${body.model_name}' is not supported. Valid models: ${validIds}`);
    }
  }

  // --- cpu_request ---
  if (!body.cpu_request) {
    errors.push("cpu_request is required (e.g., '2000m')");
  } else if (!CPU_REGEX.test(body.cpu_request)) {
    errors.push(`cpu_request '${body.cpu_request}' is invalid. Must be digits + 'm' (e.g., '2000m')`);
  }

  // --- cpu_limit ---
  if (!body.cpu_limit) {
    errors.push("cpu_limit is required (e.g., '4000m')");
  } else if (!CPU_REGEX.test(body.cpu_limit)) {
    errors.push(`cpu_limit '${body.cpu_limit}' is invalid. Must be digits + 'm' (e.g., '4000m')`);
  }

  // --- memory_request ---
  if (!body.memory_request) {
    errors.push("memory_request is required (e.g., '4Gi')");
  } else if (!MEMORY_REGEX.test(body.memory_request)) {
    errors.push(`memory_request '${body.memory_request}' is invalid. Must be digits + 'Gi' or 'Mi' (e.g., '4Gi')`);
  }

  // --- memory_limit ---
  if (!body.memory_limit) {
    errors.push("memory_limit is required (e.g., '8Gi')");
  } else if (!MEMORY_REGEX.test(body.memory_limit)) {
    errors.push(`memory_limit '${body.memory_limit}' is invalid. Must be digits + 'Gi' or 'Mi' (e.g., '8Gi')`);
  }

  // --- replicas ---
  if (body.replicas === undefined || body.replicas === null) {
    errors.push("replicas is required (1-10)");
  } else {
    const replicas = parseInt(body.replicas);
    if (isNaN(replicas) || replicas < 1 || replicas > 10) {
      errors.push(`replicas must be an integer between 1 and 10 (got: ${body.replicas})`);
    }
  }

  // --- Cross-field validation ---
  if (body.cpu_request && body.cpu_limit) {
    const req = parseInt(body.cpu_request);
    const lim = parseInt(body.cpu_limit);
    if (!isNaN(req) && !isNaN(lim) && req > lim) {
      errors.push("cpu_request cannot exceed cpu_limit");
    }
  }

  if (body.memory_request && body.memory_limit) {
    const reqNum = parseInt(body.memory_request);
    const limNum = parseInt(body.memory_limit);
    const reqUnit = body.memory_request.replace(/\d+/, "");
    const limUnit = body.memory_limit.replace(/\d+/, "");
    if (reqUnit === limUnit && !isNaN(reqNum) && !isNaN(limNum) && reqNum > limNum) {
      errors.push("memory_request cannot exceed memory_limit");
    }
  }

  return errors;
}

module.exports = { validateDeploymentInput };
