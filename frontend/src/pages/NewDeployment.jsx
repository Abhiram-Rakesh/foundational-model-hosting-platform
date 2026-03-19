import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createDeployment } from '../services/api';
import DeploymentForm from '../components/DeploymentForm';

/**
 * NewDeployment — Model deployment creation page
 *
 * Wraps DeploymentForm with submission logic. On success, redirects
 * to the deployments list. On error, shows the error message.
 */
function NewDeployment() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', message }

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await createDeployment(formData);

      setResult({
        type: 'success',
        message: `Deployment created: ${res.data.deployment_id}`,
      });

      // Redirect to dashboard after a brief pause so the user sees the success message
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;

      setResult({
        type: 'error',
        message: details ? `${errorMsg}: ${details.join(', ')}` : errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link to="/" style={{ fontSize: 13, color: '#64748b' }}>
          ← Back to Deployments
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginTop: 8 }}>
          Deploy a Model
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Select an AI model and configure resource limits. The model will be deployed
          as a Kubernetes pod and exposed via a REST API endpoint.
        </p>
      </div>

      {/* Result message */}
      {result && (
        <div style={{
          background: result.type === 'success' ? '#052e16' : '#450a0a',
          border: `1px solid ${result.type === 'success' ? '#166534' : '#991b1b'}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          color: result.type === 'success' ? '#86efac' : '#fca5a5',
          fontSize: 14,
        }}>
          {result.type === 'success' ? '✅ ' : '❌ '}
          {result.message}
        </div>
      )}

      <div className="card">
        <DeploymentForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}

export default NewDeployment;
