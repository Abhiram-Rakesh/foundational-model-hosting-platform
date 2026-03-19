import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getDeployments, deleteDeployment } from '../services/api';
import DeploymentCard from '../components/DeploymentCard';

/**
 * DeploymentsList — Main dashboard page
 *
 * Shows all deployments. Polls every 5 seconds while any deployment
 * is in a non-terminal state (pending or deploying). Stops polling
 * when all deployments are running, failed, or deleted.
 */
function DeploymentsList() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchDeployments = async () => {
    try {
      const res = await getDeployments();
      setDeployments(res.data);
      setError(null);

      // Check if we need to keep polling
      const hasActiveDeployments = res.data.some(
        (d) => d.status === 'pending' || d.status === 'deploying'
      );

      if (hasActiveDeployments && !intervalRef.current) {
        // Start polling
        intervalRef.current = setInterval(fetchDeployments, 5000);
      } else if (!hasActiveDeployments && intervalRef.current) {
        // Stop polling — all deployments are terminal
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (err) {
      setError('Failed to load deployments. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
    // Start initial poll
    intervalRef.current = setInterval(fetchDeployments, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleDelete = async (deploymentId) => {
    if (!window.confirm(`Delete deployment ${deploymentId}?`)) return;

    try {
      await deleteDeployment(deploymentId);
      // Refresh immediately
      fetchDeployments();
    } catch (err) {
      alert('Failed to delete deployment: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
        Loading deployments...
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
            Deployments
          </h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            {deployments.length} total ·{' '}
            {deployments.filter((d) => d.status === 'running').length} running
          </p>
        </div>
        <Link to="/new" className="btn btn-primary">+ New Deployment</Link>
      </div>

      {error && (
        <div style={{
          background: '#450a0a',
          border: '1px solid #991b1b',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          color: '#fca5a5',
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {deployments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
            No deployments yet
          </h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Deploy your first AI model to get started.
          </p>
          <Link to="/new" className="btn btn-primary">Deploy a Model</Link>
        </div>
      ) : (
        deployments.map((d) => (
          <DeploymentCard
            key={d.deployment_id}
            deployment={d}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}

export default DeploymentsList;
