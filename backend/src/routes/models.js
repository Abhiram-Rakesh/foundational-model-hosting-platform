/**
 * src/routes/models.js — GET /api/models
 *
 * Returns the list of supported AI models. The frontend uses this to
 * populate the model dropdown in the deployment form.
 */

const express = require("express");
const router = express.Router();
const models = require("../config/models.json");

// GET /api/models
router.get("/", (req, res) => {
  res.json(models);
});

// GET /api/models/:id — get a single model's details
router.get("/:id", (req, res) => {
  const model = models.find((m) => m.id === req.params.id);
  if (!model) {
    return res.status(404).json({ error: `Model '${req.params.id}' not found` });
  }
  res.json(model);
});

module.exports = router;
