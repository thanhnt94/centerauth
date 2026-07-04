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
import { AIFailoverManager } from './pages/admin/AIFailoverManager';
import { MediaConsole } from './pages/admin/MediaConsole';

import { Logs } from './pages/admin/Logs';
import { Settings as AdminSettings } from './pages/admin/Settings';
import { Settings as UserSettings } from './pages/Settings';
import { QueueSettings } from './pages/admin/QueueSettings';

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
              <Route path="/admin/ai-failover" element={<AIFailoverManager />} />
              <Route path="/admin/queue" element={<QueueDashboard />} />
              <Route path="/admin/queue-settings" element={<QueueSettings />} />
              <Route path="/admin/tts" element={<TTSConsole defaultTab="playground" />} />
              <Route path="/admin/tts-settings" element={<TTSConsole defaultTab="settings" />} />
              <Route path="/admin/image-search" element={<MediaConsole defaultTab="search" />} />
              <Route path="/admin/images" element={<MediaConsole defaultTab="library" />} />
              <Route path="/admin/image-settings" element={<MediaConsole defaultTab="settings" />} />
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
