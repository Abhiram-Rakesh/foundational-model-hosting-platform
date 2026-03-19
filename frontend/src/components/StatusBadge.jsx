import React from 'react';

/**
 * StatusBadge — Color-coded deployment status indicator
 */
const STATUS_STYLES = {
  pending:   { bg: '#854d0e', color: '#fef08a', label: 'Pending' },
  deploying: { bg: '#1e40af', color: '#93c5fd', label: 'Deploying' },
  running:   { bg: '#166534', color: '#86efac', label: 'Running' },
  failed:    { bg: '#991b1b', color: '#fca5a5', label: 'Failed' },
  deleted:   { bg: '#374151', color: '#9ca3af', label: 'Deleted' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: style.bg,
      color: style.color,
    }}>
      {style.label}
    </span>
  );
}

export default StatusBadge;
