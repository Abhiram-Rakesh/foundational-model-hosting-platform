import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import DeploymentsList from './pages/DeploymentsList';
import NewDeployment from './pages/NewDeployment';
import Navbar from './components/Navbar';

/**
 * App — Root component
 *
 * Sets up React Router with two pages:
 *   / → DeploymentsList (dashboard)
 *   /new → NewDeployment (deployment form)
 */
function App() {
  return (
    <BrowserRouter>
      {/* Global styles (inline for single-file simplicity) */}
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
          background: #0f172a;
          color: #e2e8f0;
          min-height: 100vh;
        }

        a { color: #60a5fa; text-decoration: none; }
        a:hover { text-decoration: underline; }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        .btn-primary:hover { background: #2563eb; }
        .btn-primary:disabled { background: #475569; cursor: not-allowed; }

        .btn-danger {
          background: #dc2626;
          color: white;
        }
        .btn-danger:hover { background: #b91c1c; }

        .btn-ghost {
          background: transparent;
          color: #94a3b8;
          border: 1px solid #334155;
        }
        .btn-ghost:hover { background: #1e293b; color: #e2e8f0; }

        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 24px;
        }

        input, select {
          width: 100%;
          padding: 10px 14px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus, select:focus { border-color: #3b82f6; }

        label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .error-text { color: #f87171; font-size: 12px; margin-top: 4px; }
        .success-text { color: #4ade80; }
      `}</style>

      <Navbar />

      <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <Routes>
          <Route path="/" element={<DeploymentsList />} />
          <Route path="/new" element={<NewDeployment />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
