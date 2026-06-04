# Basset Hound Browser - Web Dashboard

Enterprise-grade web dashboard for competitor monitoring with real-time change detection, alerting, and comparative analysis.

## Overview

The Basset Hound Dashboard is a React-based web application that provides a modern, responsive interface to the Basset Hound Browser's monitoring capabilities. It enables teams to:

- Monitor 50+ competitors simultaneously
- Detect and track competitive changes in real-time
- Manage alerts with severity-based filtering
- Compare competitor metrics side-by-side
- Customize views and preferences

## Features

### Core Capabilities

- **Real-time Monitoring**: Live change detection with WebSocket streaming
- **Comprehensive Alerts**: Automatic severity classification and batch management
- **Competitor Comparison**: Side-by-side analysis of up to 4 competitors
- **Change Timeline**: Chronological view of all detected changes
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Theme Support**: Light and dark mode with persistent preferences
- **Offline Support**: Messages queue during disconnection

### Technical Features

- Auto-reconnecting WebSocket client with exponential backoff
- 5-minute intelligent caching for performance
- Component-based architecture with React hooks
- Comprehensive test coverage (unit & integration)
- WCAG 2.1 AA accessibility compliance
- Production-ready error handling

## Installation

### Prerequisites

- Node.js 16+ and npm/yarn
- Basset Hound Browser server running on `localhost:8765`

### Setup

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development

### Project Structure

```
web/
├── src/
│   ├── components/          # React components
│   │   ├── DashboardLayout.jsx
│   │   ├── MonitorList.jsx
│   │   ├── ChangeTimeline.jsx
│   │   ├── AlertPanel.jsx
│   │   ├── ComparisonView.jsx
│   │   └── ConnectionStatus.jsx
│   ├── pages/               # Page components
│   │   ├── DashboardPage.jsx
│   │   ├── MonitorsPage.jsx
│   │   ├── AlertsPage.jsx
│   │   └── SettingsPage.jsx
│   ├── services/            # API & WebSocket
│   │   ├── websocket-client.js
│   │   └── dashboard-api.js
│   ├── hooks/               # Custom React hooks
│   │   ├── useWebSocket.js
│   │   ├── useTheme.js
│   │   └── useDashboard.js
│   ├── styles/              # CSS files
│   │   └── *.css
│   ├── App.jsx
│   └── index.jsx
├── public/
│   └── index.html
├── __tests__/
│   ├── unit/
│   │   └── components.test.js
│   └── integration/
│       └── dashboard.integration.test.js
├── vite.config.js
├── jest.config.js
└── package.json
```

### Component Architecture

```
App
├── DashboardLayout (header, sidebar, navigation)
│   ├── Header (title, connection status, theme toggle)
│   ├── Sidebar (navigation menu)
│   └── Main Content
│       ├── DashboardPage
│       │   ├── StatsGrid
│       │   └── Tabs (Overview, Timeline, Alerts, Comparison)
│       ├── MonitorsPage
│       │   ├── MonitorForm
│       │   └── MonitorList
│       ├── AlertsPage
│       │   ├── AlertStats
│       │   └── AlertPanel
│       └── SettingsPage
└── ConnectionStatus (floating indicator)
```

### Services

#### WebSocket Client (`src/services/websocket-client.js`)

Low-level WebSocket management with:
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- Request/response matching with timeouts
- Event subscription system
- Heartbeat keep-alive

**Usage:**
```javascript
import { getWebSocketClient } from '@services/websocket-client';

const ws = getWebSocketClient('ws://localhost:8765');
await ws.send('get_dashboard_data', {});
```

#### Dashboard API (`src/services/dashboard-api.js`)

High-level API wrapper with:
- Domain-specific methods (getMonitors, createAlert, etc.)
- Intelligent caching with TTL
- Error handling and retry logic
- Real-time subscription methods

**Usage:**
```javascript
import { getDashboardAPI } from '@services/dashboard-api';

const api = getDashboardAPI();
const monitors = await api.getMonitors();
const unsubscribe = api.subscribeToAlerts((alert) => {
  console.log('New alert:', alert);
});
```

### Custom Hooks

#### `useWebSocket()`

Manages WebSocket connection lifecycle:
```javascript
const { isConnected, error, send, subscribe } = useWebSocket();
```

#### `useTheme()`

Manages light/dark theme with persistence:
```javascript
const { theme, toggleTheme, isDark, isLight } = useTheme();
```

#### `useDashboard()`

Manages all dashboard state and operations:
```javascript
const {
  monitors,
  alerts,
  timeline,
  metrics,
  loading,
  error,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  markAlertRead,
  dismissAlert,
} = useDashboard();
```

## API Integration

### WebSocket Commands

All commands follow this pattern:

```javascript
// Request
{
  "command": "command_name",
  "params": { /* parameters */ },
  "timestamp": 1234567890,
  "requestId": "req_xxx"
}

// Response
{
  "requestId": "req_xxx",
  "success": true,
  "data": { /* response data */ },
  "timestamp": 1234567890
}
```

### Supported Commands

- `get_dashboard_data` - Full dashboard snapshot
- `get_monitors` - List all monitors
- `create_monitor` - Create new monitor
- `update_monitor` - Update monitor config
- `delete_monitor` - Remove monitor
- `get_dashboard_alerts` - List alerts with filters
- `mark_alert_read` - Mark single alert as read
- `batch_mark_alerts_read` - Bulk mark as read
- `acknowledge_alert` - Acknowledge alert
- `batch_acknowledge_alerts` - Bulk acknowledge
- `dismiss_alert` - Dismiss alert
- `batch_dismiss_alerts` - Bulk dismiss
- `get_competitor_comparison` - Compare monitors
- `get_dashboard_timeline` - Change history
- `create_dashboard_view` - Create custom view
- `get_dashboard_view` - Render view

See `/docs/API-REFERENCE.md` for complete API documentation.

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm test:unit

# Run integration tests only
npm test:integration

# Run tests with coverage
npm test:coverage

# Watch mode
npm test:watch
```

### Test Coverage

- **Unit Tests**: 40+ component tests
- **Integration Tests**: 20+ API and flow tests
- **Coverage Target**: 60%+ across all files

### Writing Tests

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '@components/MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  test('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
```

## Styling

### Design System

Colors (CSS Variables):
```css
--color-primary: #3b82f6        /* Blue */
--color-success: #10b981        /* Green */
--color-warning: #f59e0b        /* Orange */
--color-danger: #ef4444         /* Red */
--color-critical: #dc2626       /* Dark Red */
```

Spacing:
```css
--spacing-xs: 0.25rem (4px)
--spacing-sm: 0.5rem (8px)
--spacing-md: 1rem (16px)
--spacing-lg: 1.5rem (24px)
--spacing-xl: 2rem (32px)
```

### Responsive Breakpoints

- **Desktop**: Full layout (1024px+)
- **Tablet**: Adjusted layout (768px - 1024px)
- **Mobile**: Stacked layout (<768px)

### Dark Mode

Automatically applied based on system preference or user selection. All components support both light and dark modes via CSS variables.

## Performance Optimization

### Caching Strategy

- Dashboard data: 5-minute TTL
- Automatic cache invalidation on mutations
- LRU eviction for 100-item limit
- Target hit rate: 60-80%

### Lazy Loading

- Route-based code splitting
- Component-level lazy loading
- Image optimization
- WebSocket message batching

### Bundle Size

- Main: ~150KB (gzipped)
- Vendor: ~180KB (gzipped)
- Charts: ~85KB (gzipped)

## Deployment

### Production Build

```bash
npm run build
```

Creates optimized bundle in `/dist/` directory:
- Minified JavaScript
- Source maps for debugging
- Vendor chunk separation
- Asset optimization

### Deployment Options

1. **Static Hosting** (Vercel, Netlify, S3)
   - Run `npm run build`
   - Deploy `/dist/` contents
   - Configure API proxy to backend

2. **Docker**
   ```dockerfile
   FROM node:16 as builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm install && npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

3. **Self-Hosted**
   - Deploy to your server
   - Configure reverse proxy
   - Set up HTTPS/TLS

## Configuration

### Environment Variables

```bash
# .env.local
VITE_API_URL=http://localhost:8765
VITE_WS_URL=ws://localhost:8765
VITE_API_TIMEOUT=30000
```

### Settings (localStorage)

```javascript
{
  "theme": "light",           // or "dark"
  "autoRefresh": true,
  "refreshInterval": 30000,   // milliseconds
  "alertNotifications": true,
  "compactMode": false,
  "colorBlindMode": false
}
```

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Reduced motion support

## Troubleshooting

### WebSocket Connection Issues

```javascript
// Check connection status
const ws = getWebSocketClient();
console.log(ws.getStatus());

// Manually reconnect
await ws.connect();
```

### Performance Issues

- Check browser console for errors
- Clear browser cache/storage
- Verify backend is running
- Check network tab in DevTools

### State Management Issues

- Clear localStorage: `localStorage.clear()`
- Reset cache: `api.clearCache()`
- Reload page with Ctrl+Shift+Delete

## Contributing

### Code Style

- ESLint configuration: `.eslintrc`
- Prettier formatting: `.prettierrc`
- Auto-format: `npm run lint`

### Git Workflow

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test
3. Create pull request
4. Merge after review

### Commit Messages

```
type(scope): description

feature(dashboard): add monitor comparison view
fix(alerts): correct severity filtering
docs(readme): update API documentation
test(components): add MonitorList tests
```

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests:
- Create a GitHub issue
- Contact: support@basset-hound.com
- Documentation: `/docs/`

## Changelog

### v1.0.0 (2026-06-03)

**Initial Release**
- Dashboard MVP with full feature set
- Real-time WebSocket integration
- Responsive UI (desktop/tablet/mobile)
- Light/dark theme support
- 60+ component tests
- Full API integration
- Production-ready deployment

---

**Built with React 18, Vite, and Jest**  
**Designed for Basset Hound Browser v12.0.0+**
