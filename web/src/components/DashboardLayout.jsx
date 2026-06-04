import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/DashboardLayout.css';

/**
 * Main dashboard layout component
 * Provides header, sidebar navigation, and content area
 */
function DashboardLayout({ theme, onThemeToggle, connectionStatus, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/monitors', label: 'Monitors', icon: '👁️' },
    { path: '/alerts', label: 'Alerts', icon: '🔔' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="dashboard-layout" data-theme={theme}>
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <h1 className="header-title">🐶 Basset Hound Browser</h1>
        </div>

        <div className="header-right">
          <div className={`connection-indicator ${connectionStatus}`}>
            <span className="indicator-dot" />
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </div>

          <button
            className="theme-toggle"
            onClick={onThemeToggle}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        {/* Sidebar */}
        <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="app-version">v1.0.0</div>
            <div className="app-status">
              Status: <span className={connectionStatus}>{connectionStatus}</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}

export default DashboardLayout;
