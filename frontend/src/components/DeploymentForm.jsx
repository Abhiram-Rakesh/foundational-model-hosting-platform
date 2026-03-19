import React, { useState, useEffect } from 'react';
import { getModels } from '../services/api';

/**
 * DeploymentForm — Model selection form with client-side validation
 *
 * Fields: model selector, CPU request/limit, memory request/limit, replicas
 * Validates formats before submitting.
 */

const CPU_REGEX = /^\d+m$/;
const MEMORY_REGEX = /^\d+[GM]i$/;

function DeploymentForm({ onSubmit, isSubmitting }) {
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    model_name: '',
    cpu_request: '2000m',
    cpu_limit: '4000m',
    memory_request: '4Gi',
    memory_limit: '8Gi',
    replicas: 1,
  });

  // Fetch available models on mount
  useEffect(() => {
    getModels()
      .then((res) => {
        setModels(res.data);
        if (res.data.length > 0) {
          setForm((f) => ({ ...f, model_name: res.data[0].id }));
        }
      })
      .catch((err) => console.error('Failed to load models:', err))
      .finally(() => setLoadingModels(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'replicas' ? parseInt(value) || '' : value }));
    // Clear error for this field when user types
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errs = {};

    if (!form.model_name) errs.model_name = 'Select a model';
    if (!CPU_REGEX.test(form.cpu_request)) errs.cpu_request = 'Format: digits + m (e.g., 2000m)';
    if (!CPU_REGEX.test(form.cpu_limit)) errs.cpu_limit = 'Format: digits + m (e.g., 4000m)';
    if (!MEMORY_REGEX.test(form.memory_request)) errs.memory_request = 'Format: digits + Gi/Mi (e.g., 4Gi)';
    if (!MEMORY_REGEX.test(form.memory_limit)) errs.memory_limit = 'Format: digits + Gi/Mi (e.g., 8Gi)';

    const replicas = parseInt(form.replicas);
    if (isNaN(replicas) || replicas < 1 || replicas > 10) {
      errs.replicas = 'Must be 1-10';
    }

    // Cross-field checks
    if (!errs.cpu_request && !errs.cpu_limit) {
      if (parseInt(form.cpu_request) > parseInt(form.cpu_limit)) {
        errs.cpu_request = 'Request cannot exceed limit';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  const selectedModel = models.find((m) => m.id === form.model_name);

  return (
    <form onSubmit={handleSubmit}>
      {/* Model selector */}
      <div style={{ marginBottom: 20 }}>
        <label>Model</label>
        {loadingModels ? (
          <div style={{ color: '#64748b', padding: '10px 0' }}>Loading models...</div>
        ) : (
          <select name="model_name" value={form.model_name} onChange={handleChange}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.size})
              </option>
            ))}
          </select>
        )}
        {errors.model_name && <div className="error-text">{errors.model_name}</div>}

        {selectedModel && (
          <div style={{
            marginTop: 8,
            padding: '8px 12px',
            background: '#0f172a',
            borderRadius: 6,
            fontSize: 13,
            color: '#94a3b8',
          }}>
            {selectedModel.description} — {selectedModel.speed_note}
          </div>
        )}
      </div>

      {/* Resource fields in grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 20,
      }}>
        <Field label="CPU Request" name="cpu_request" value={form.cpu_request}
          onChange={handleChange} error={errors.cpu_request} placeholder="e.g., 2000m" />

        <Field label="CPU Limit" name="cpu_limit" value={form.cpu_limit}
          onChange={handleChange} error={errors.cpu_limit} placeholder="e.g., 4000m" />

        <Field label="Memory Request" name="memory_request" value={form.memory_request}
          onChange={handleChange} error={errors.memory_request} placeholder="e.g., 4Gi" />

        <Field label="Memory Limit" name="memory_limit" value={form.memory_limit}
          onChange={handleChange} error={errors.memory_limit} placeholder="e.g., 8Gi" />
      </div>

      {/* Replicas */}
      <div style={{ marginBottom: 24 }}>
        <Field label="Replicas" name="replicas" value={form.replicas}
          onChange={handleChange} error={errors.replicas} placeholder="1-10" type="number" />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting}
        style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: 16 }}
      >
        {isSubmitting ? (
          <>
            <span style={{
              width: 16, height: 16,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
            }} />
            Deploying...
          </>
        ) : (
          'Deploy Model'
        )}
      </button>
    </form>
  );
}

function Field({ label, name, value, onChange, error, placeholder, type = 'text' }) {
  return (
    <div>
      <label>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ borderColor: error ? '#f87171' : undefined }}
      />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

export default DeploymentForm;
