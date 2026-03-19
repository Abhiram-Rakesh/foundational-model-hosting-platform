import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Navbar — Top navigation bar
 */
function Navbar() {
  const location = useLocation();

  return (
    <nav style={{
      background: '#1e293b',
      borderBottom: '1px solid #334155',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
      }}>
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          color: '#e2e8f0',
        }}>
          <span style={{ fontSize: 24 }}>🧠</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>ML Platform</span>
        </Link>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/" className="btn btn-ghost" style={{
            background: location.pathname === '/' ? '#334155' : undefined,
          }}>
            Deployments
          </Link>
          <Link to="/new" className="btn btn-primary">
            + New Deployment
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
