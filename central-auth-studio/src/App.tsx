import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Portal } from './pages/Portal';
import { Clients } from './pages/admin/Clients';
import { Identities } from './pages/admin/Identities';
import { SyncDashboard } from './pages/admin/SyncDashboard';
import { Login } from './pages/auth/Login';
import { LandingPage } from './pages/LandingPage';
import { AIChatConsole } from './pages/admin/AIChatConsole';
import { QueueDashboard } from './pages/admin/QueueDashboard';
import { TTSConsole } from './pages/admin/TTSConsole';

import { Logs } from './pages/admin/Logs';
import { Settings as AdminSettings } from './pages/admin/Settings';
import { Settings as UserSettings } from './pages/Settings';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="*" element={
          <Shell>
            <Routes>
              <Route path="/portal" element={<Portal />} />
              <Route path="/admin/aichat" element={<AIChatConsole defaultTab="chat" />} />
              <Route path="/admin/ai-settings" element={<AIChatConsole defaultTab="keys" />} />
              <Route path="/admin/queue" element={<QueueDashboard />} />
              <Route path="/admin/tts" element={<TTSConsole />} />
              <Route path="/admin/clients" element={<Clients />} />
              <Route path="/admin/users" element={<Identities />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/settings" element={<UserSettings />} />
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
