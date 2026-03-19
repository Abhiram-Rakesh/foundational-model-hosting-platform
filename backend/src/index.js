/**
 * src/index.js — Express server entry point
 *
 * This is where everything starts. It sets up middleware (CORS, JSON parsing,
 * logging), mounts the API routes, starts the background status polling loop,
 * and listens on the configured port.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const modelsRouter = require("./routes/models");
const deploymentsRouter = require("./routes/deployments");
const errorHandler = require("./middleware/errorHandler");
const { startStatusPoller } = require("./services/k8s");

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Allow requests from any origin (the frontend runs on a different NodePort)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Simple request logger — prints every incoming request with a timestamp
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/models", modelsRouter);
app.use("/api/deployments", deploymentsRouter);

// Health check endpoint (used by K8s liveness/readiness probes)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Error handling (must be after routes)
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`============================================`);
  console.log(`  ML Platform Backend running on port ${PORT}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`============================================`);

  // Start the background loop that polls Kubernetes for pod status updates.
  // This runs every 10 seconds and checks if any "pending" deployments
  // have become "running" (pod Ready) or "failed".
  startStatusPoller();
});
