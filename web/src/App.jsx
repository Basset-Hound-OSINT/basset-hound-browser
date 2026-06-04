import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useWebSocket } from './hooks/useWebSocket';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import MonitorsPage from './pages/MonitorsPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import ConnectionStatus from './components/ConnectionStatus';
import './styles/App.css';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { isConnected } = useWebSocket();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = `${theme}-mode`;

    // Simulate initialization
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [theme]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Initializing Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="app-wrapper" data-theme={theme}>
      <DashboardLayout
        theme={theme}
        onThemeToggle={toggleTheme}
        connectionStatus={isConnected ? 'connected' : 'disconnected'}
      >
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/monitors" element={<MonitorsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </DashboardLayout>
      <ConnectionStatus isConnected={isConnected} />
    </div>
  );
}

export default App;
