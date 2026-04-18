import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Portal } from './pages/Portal';
import { Clients } from './pages/admin/Clients';
import { Identities } from './pages/admin/Identities';
import { SyncDashboard } from './pages/admin/SyncDashboard';
import { Login } from './pages/auth/Login';

import { Logs } from './pages/admin/Logs';
import { Settings } from './pages/admin/Settings';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="*" element={
          <Shell>
            <Routes>
              <Route path="/" element={<Portal />} />
              <Route path="/admin/clients" element={<Clients />} />
              <Route path="/admin/users" element={<Identities />} />
              <Route path="/admin/settings" element={<Settings />} />
              <Route path="/admin/logs" element={<Logs />} />
              <Route path="/admin/sync" element={<SyncDashboard />} />
            </Routes>
          </Shell>
        } />
      </Routes>
    </Router>
  );
};

export default App;
