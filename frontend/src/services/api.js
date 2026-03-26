/**
 * src/services/api.js — Axios HTTP client
 *
 * Central API client used by all pages and components.
 *
 * IMPORTANT: Set VITE_API_URL to your backend's NodePort address.
 * Find it with: kubectl get svc ml-platform-backend -o jsonpath='{.spec.ports[0].nodePort}'
 * Then set: VITE_API_URL=http://172.25.2.51:<that_port>
 *
 * Or just hardcode it below during development.
 */

import axios from 'axios';

// The backend API base URL.
// In production (inside the container), this comes from the build-time env var.
// During development, change the fallback to your actual backend NodePort.
const API_BASE = import.meta.env.VITE_API_URL || 'http://172.25.2.51:32545';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// ---- Models ----

export const getModels = () => api.get('/api/models');

// ---- Deployments ----

export const getDeployments = () => api.get('/api/deployments');

export const getDeployment = (id) => api.get(`/api/deployments/${id}`);

export const createDeployment = (data) => api.post('/api/deployments', data);

export const deleteDeployment = (id) => api.delete(`/api/deployments/${id}`);

export default api;
