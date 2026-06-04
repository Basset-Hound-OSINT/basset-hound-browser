import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import '../styles/SettingsPage.css';

/**
 * Application settings page
 */
function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    autoRefresh: true,
    refreshInterval: 30000,
    alertNotifications: true,
    compactMode: false,
    colorBlindMode: false,
  });

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (updated) => {
    const newSettings = { ...settings, ...updated };
    setSettings(newSettings);
    localStorage.setItem('app-settings', JSON.stringify(newSettings));
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-container">
        {/* Appearance Settings */}
        <section className="settings-section">
          <h2>Appearance</h2>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-label">
                <label>Theme</label>
                <p className="setting-description">
                  Current theme: <strong>{theme === 'light' ? 'Light' : 'Dark'}</strong>
                </p>
              </div>
              <button className="btn-toggle" onClick={toggleTheme}>
                {theme === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="compactMode">Compact Mode</label>
                <p className="setting-description">Reduce spacing and use smaller text</p>
              </div>
              <input
                id="compactMode"
                type="checkbox"
                checked={settings.compactMode}
                onChange={(e) => saveSettings({ compactMode: e.target.checked })}
                className="setting-checkbox"
              />
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="colorBlindMode">Color Blind Mode</label>
                <p className="setting-description">
                  Use colorblind-friendly color schemes
                </p>
              </div>
              <input
                id="colorBlindMode"
                type="checkbox"
                checked={settings.colorBlindMode}
                onChange={(e) => saveSettings({ colorBlindMode: e.target.checked })}
                className="setting-checkbox"
              />
            </div>
          </div>
        </section>

        {/* Behavior Settings */}
        <section className="settings-section">
          <h2>Behavior</h2>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="autoRefresh">Auto-Refresh</label>
                <p className="setting-description">
                  Automatically refresh dashboard data
                </p>
              </div>
              <input
                id="autoRefresh"
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => saveSettings({ autoRefresh: e.target.checked })}
                className="setting-checkbox"
              />
            </div>

            {settings.autoRefresh && (
              <div className="setting-item">
                <div className="setting-label">
                  <label htmlFor="refreshInterval">Refresh Interval (seconds)</label>
                  <p className="setting-description">
                    How often to refresh dashboard data
                  </p>
                </div>
                <input
                  id="refreshInterval"
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={settings.refreshInterval / 1000}
                  onChange={(e) =>
                    saveSettings({ refreshInterval: e.target.value * 1000 })
                  }
                  className="setting-input"
                />
              </div>
            )}

            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="alertNotifications">Alert Notifications</label>
                <p className="setting-description">
                  Show browser notifications for new alerts
                </p>
              </div>
              <input
                id="alertNotifications"
                type="checkbox"
                checked={settings.alertNotifications}
                onChange={(e) => saveSettings({ alertNotifications: e.target.checked })}
                className="setting-checkbox"
              />
            </div>
          </div>
        </section>

        {/* Server Settings */}
        <section className="settings-section">
          <h2>Server Connection</h2>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-label">
                <label>WebSocket URL</label>
                <p className="setting-description">ws://localhost:8765</p>
              </div>
              <code className="setting-code">ws://localhost:8765</code>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <label>API Timeout</label>
                <p className="setting-description">Request timeout (milliseconds)</p>
              </div>
              <input
                type="number"
                defaultValue="30000"
                disabled
                className="setting-input disabled"
              />
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section">
          <h2>About</h2>
          <div className="about-info">
            <div className="about-item">
              <span className="about-label">Application</span>
              <span className="about-value">Basset Hound Dashboard</span>
            </div>
            <div className="about-item">
              <span className="about-label">Version</span>
              <span className="about-value">1.0.0</span>
            </div>
            <div className="about-item">
              <span className="about-label">Environment</span>
              <span className="about-value">Production</span>
            </div>
            <div className="about-item">
              <span className="about-label">License</span>
              <span className="about-value">MIT</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SettingsPage;
