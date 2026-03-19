import React from 'react';
import StatusBadge from './StatusBadge';

/**
 * DeploymentCard — Displays a single deployment's info
 */
function DeploymentCard({ deployment, onDelete }) {
  const {
    deployment_id,
    model_name,
    cpu_request,
    cpu_limit,
    memory_request,
    memory_limit,
    replicas,
    status,
    api_endpoint,
    created_at,
  } = deployment;

  const isTerminal = status === 'running' || status === 'failed' || status === 'deleted';
  const createdDate = new Date(created_at).toLocaleString();

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              {model_name}
            </h3>
            <StatusBadge status={status} />
          </div>
          <p style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
            {deployment_id}
          </p>
        </div>

        {status !== 'deleted' && (
          <button
            className="btn btn-danger"
            style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={() => onDelete(deployment_id)}
          >
            Delete
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <InfoCell label="CPU" value={`${cpu_request} / ${cpu_limit}`} />
        <InfoCell label="Memory" value={`${memory_request} / ${memory_limit}`} />
        <InfoCell label="Replicas" value={replicas} />
        <InfoCell label="Created" value={createdDate} />
      </div>

      {api_endpoint && status === 'running' && (
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 12, color: '#64748b', marginRight: 8 }}>API Endpoint:</span>
            <a
              href={api_endpoint}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'monospace', fontSize: 14 }}
            >
              {api_endpoint}
            </a>
          </div>
          <span style={{ fontSize: 11, color: '#4ade80' }}>● Live</span>
        </div>
      )}

      {(status === 'pending' || status === 'deploying') && (
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Spinner />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            {status === 'pending' ? 'Waiting for pod to be scheduled...' : 'Model is loading into memory...'}
          </span>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 16,
      height: 16,
      border: '2px solid #334155',
      borderTopColor: '#3b82f6',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default DeploymentCard;
