# API Reference

Base URL: `http://172.25.2.51:<backend-nodeport>`

## Models

### GET /api/models

Returns all supported AI models.

**Response 200:**
```json
[
  {
    "id": "llama2",
    "name": "LLaMA 2 7B",
    "size": "3.8GB",
    "ram_required": "6GB",
    "description": "Meta's open-source large language model.",
    "speed_note": "~2-5 tokens/sec on CPU"
  }
]
```

### GET /api/models/:id

Returns a single model by ID. Returns 404 if not found.

## Deployments

### POST /api/deployments

Create a new model deployment.

**Request:**
```json
{
  "model_name": "llama2",
  "cpu_request": "2000m",
  "cpu_limit": "4000m",
  "memory_request": "4Gi",
  "memory_limit": "8Gi",
  "replicas": 1
}
```

**Validation rules:**
- `model_name` — must exist in models registry
- `cpu_request`, `cpu_limit` — format: `/^\d+m$/` (e.g., `2000m`)
- `memory_request`, `memory_limit` — format: `/^\d+[GM]i$/` (e.g., `4Gi`, `512Mi`)
- `replicas` — integer 1-10
- `cpu_request` must not exceed `cpu_limit`
- `memory_request` must not exceed `memory_limit` (same unit)

**Response 201:**
```json
{
  "deployment_id": "deploy-1710834567890-a1b2c3",
  "model_name": "llama2",
  "status": "pending",
  "sync_status": "synced",
  "message": "Deployment created and sync triggered."
}
```

**Response 400 (validation error):**
```json
{
  "error": "Validation failed",
  "details": ["cpu_request '5000' is invalid. Must be digits + 'm'"]
}
```

### GET /api/deployments

List all deployments, newest first.

**Response 200:**
```json
[
  {
    "deployment_id": "deploy-1710834567890-a1b2c3",
    "model_name": "llama2",
    "cpu_request": "2000m",
    "cpu_limit": "4000m",
    "memory_request": "4Gi",
    "memory_limit": "8Gi",
    "replicas": 1,
    "status": "running",
    "sync_status": "synced",
    "api_endpoint": "http://172.25.2.52:30123",
    "node_port": 30123,
    "created_at": "2026-03-19T10:00:00.000Z",
    "updated_at": "2026-03-19T10:05:00.000Z"
  }
]
```

**Status values:** `pending` → `deploying` → `running` | `failed` | `deleted`

### GET /api/deployments/:id

Returns a single deployment. 404 if not found.

### DELETE /api/deployments/:id

Delete a deployment. Removes the manifest from Git, triggers ArgoCD sync, marks as deleted in DB.

**Response 200:**
```json
{
  "message": "Deployment deleted",
  "deployment_id": "deploy-1710834567890-a1b2c3"
}
```

## Ollama Model Endpoints

Once a model is running, its API is available at the `api_endpoint` URL.

### POST {api_endpoint}/api/generate

```json
{
  "model": "llama2",
  "prompt": "Hello, how are you?",
  "stream": false
}
```

### POST {api_endpoint}/api/chat

```json
{
  "model": "llama2",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}
```

### GET {api_endpoint}/api/tags

Returns list of loaded models (used for health checks).
