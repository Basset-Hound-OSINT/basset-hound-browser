# Web Dashboard Development Guide

Comprehensive guide for developing and extending the Basset Hound Browser web dashboard.

## Getting Started

### Quick Start

```bash
# Clone and setup
cd web
npm install

# Development server
npm run dev

# Open browser
open http://localhost:3000
```

The development server includes:
- Hot module reload (HMR) for instant updates
- Source maps for debugging
- API proxy to `localhost:8765`
- HTTPS support

### Development Workflow

1. **Start dev server**: `npm run dev`
2. **Open in browser**: http://localhost:3000
3. **Make changes** to src files (auto-reloads)
4. **Check console** for errors
5. **Run tests**: `npm test` (in separate terminal)
6. **Build check**: `npm run build`

## Architecture Deep Dive

### Layered Architecture

```
Presentation Layer (Components)
    ↓ (uses)
State Management Layer (Hooks)
    ↓ (uses)
Service Layer (API Client)
    ↓ (uses)
Protocol Layer (WebSocket)
    ↓ (communicates)
Backend Server
```

### Data Flow

```
Backend Event
    ↓
WebSocket Broadcast
    ↓
WebSocket Client (subscribes)
    ↓
Dashboard API (notifies)
    ↓
Hook State (updates)
    ↓
Component Re-render (React)
    ↓
UI Update
```

### State Management Pattern

The dashboard uses React hooks for state management:

```javascript
function Page() {
  // 1. Fetch from API with useDashboard hook
  const { monitors, alerts, loading } = useDashboard();
  
  // 2. Local UI state with useState
  const [filter, setFilter] = useState('all');
  
  // 3. Compute derived state with useMemo
  const filtered = useMemo(() => {
    return monitors.filter(m => m.status === filter);
  }, [monitors, filter]);
  
  // 4. Side effects with useEffect
  useEffect(() => {
    console.log('Monitors updated:', monitors);
  }, [monitors]);
  
  // 5. Render
  return <MonitorList monitors={filtered} />;
}
```

## Component Development

### Creating a New Component

1. **Create component file**:
```javascript
// src/components/MyComponent.jsx
function MyComponent({ prop1, onAction }) {
  return <div>{/* content */}</div>;
}

export default MyComponent;
```

2. **Create styling**:
```css
/* src/styles/MyComponent.css */
.my-component {
  display: flex;
  gap: var(--spacing-md);
}
```

3. **Import in parent**:
```javascript
import MyComponent from '@components/MyComponent';
```

### Component Best Practices

```javascript
/**
 * Format: JSDoc comments for documentation
 * 
 * This component displays a list of items with sorting and filtering.
 * 
 * @param {Array} items - Array of items to display
 * @param {Function} onSelect - Callback when item is selected
 * @param {boolean} loading - Loading state
 * @returns {JSX.Element}
 */
function ItemList({ items = [], onSelect, loading = false }) {
  // 1. Hooks (always at top)
  const [sortBy, setSortBy] = useState('name');
  const [searchText, setSearchText] = useState('');
  
  // 2. Computed values (use useMemo for expensive operations)
  const sorted = useMemo(() => {
    return items
      .filter(item => item.name.includes(searchText))
      .sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
  }, [items, sortBy, searchText]);
  
  // 3. Event handlers (wrap in useCallback if passed as props)
  const handleSelect = useCallback((item) => {
    onSelect?.(item);
  }, [onSelect]);
  
  // 4. Render (early return for loading/empty states)
  if (loading) return <LoadingSpinner />;
  if (items.length === 0) return <EmptyState />;
  
  return (
    <div className="item-list">
      {/* Implementation */}
    </div>
  );
}

export default ItemList;
```

### Component Testing

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '@components/MyComponent';

describe('MyComponent', () => {
  // Setup
  const defaultProps = {
    items: [],
    onSelect: jest.fn(),
  };

  // Tests
  test('renders with items', () => {
    const props = {
      ...defaultProps,
      items: [{ id: 1, name: 'Item 1' }],
    };
    render(<MyComponent {...props} />);
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  test('calls onSelect when item clicked', async () => {
    const user = userEvent.setup();
    const props = {
      ...defaultProps,
      items: [{ id: 1, name: 'Item 1' }],
    };
    render(<MyComponent {...props} />);

    await user.click(screen.getByText('Item 1'));

    expect(props.onSelect).toHaveBeenCalledWith({ id: 1, name: 'Item 1' });
  });

  test('renders empty state when no items', () => {
    render(<MyComponent {...defaultProps} />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });
});
```

## Hook Development

### Creating Custom Hooks

```javascript
// src/hooks/useFetch.js
import { useState, useEffect } from 'react';

/**
 * Hook for fetching data with loading and error states
 * @param {Function} fetcher - Async function that returns data
 * @param {Array} dependencies - Dependencies array for useEffect
 * @returns {Object} { data, loading, error }
 */
export function useFetch(fetcher, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true; // Cleanup to prevent memory leak
    };
  }, dependencies);

  return { data, loading, error };
}
```

### Hook Usage

```javascript
function MyPage() {
  const { data: monitors, loading, error } = useFetch(
    async () => {
      const api = getDashboardAPI();
      return api.getMonitors();
    },
    [] // Only fetch once on mount
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <MonitorList monitors={monitors} />;
}
```

## Styling Guide

### CSS Architecture

The dashboard uses a custom property-based design system:

```css
/* Define at root level */
:root {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --spacing-md: 1rem;
  --border-radius: 0.375rem;
}

/* Use in components */
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
}

/* Support dark mode */
[data-theme='dark'] {
  --color-bg: #0f172a;
  --color-text: #f1f5f9;
}
```

### Responsive Design

```css
/* Mobile-first approach */
.container {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .container {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .container {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## API Integration

### Adding a New API Method

1. **Add method to DashboardAPI**:
```javascript
// src/services/dashboard-api.js
async newFeatureData(params = {}) {
  const response = await this.ws.send('get_new_feature', params);
  return response;
}
```

2. **Use in hook**:
```javascript
// src/hooks/useNewFeature.js
export function useNewFeature() {
  const [data, setData] = useState(null);
  const api = getDashboardAPI();

  useEffect(() => {
    api.newFeatureData().then(setData);
  }, [api]);

  return data;
}
```

3. **Use in component**:
```javascript
function NewFeatureComponent() {
  const data = useNewFeature();
  return <div>{data?.message}</div>;
}
```

### Error Handling

```javascript
async function loadData() {
  try {
    const data = await api.getMonitors();
    setData(data);
  } catch (error) {
    // Log to monitoring service
    console.error('Failed to load monitors:', error);
    
    // Show user-friendly error
    setError('Failed to load monitors. Please try again.');
    
    // Optional: retry logic
    setTimeout(() => retryLoad(), 5000);
  }
}
```

## Testing Strategy

### Unit Tests

Test individual components in isolation:

```javascript
test('component renders with props', () => {
  render(<Component prop="value" />);
  expect(screen.getByText('Expected')).toBeInTheDocument();
});
```

### Integration Tests

Test multiple components working together:

```javascript
test('full user flow: create, update, delete', async () => {
  const user = userEvent.setup();
  
  // 1. Create
  render(<MonitorsPage />);
  await user.click(screen.getByText('Add Monitor'));
  await user.type(screen.getByLabelText('Name'), 'Amazon');
  await user.click(screen.getByText('Create'));
  
  // 2. Update
  await user.click(screen.getByTitle('Edit'));
  // ... edit form
  
  // 3. Delete
  await user.click(screen.getByTitle('Delete'));
  expect(screen.queryByText('Amazon')).not.toBeInTheDocument();
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test components.test.js

# Watch mode (re-run on changes)
npm test -- --watch

# Coverage report
npm test -- --coverage

# Update snapshots
npm test -- -u
```

## Performance Optimization

### Profiling

```javascript
// Use React DevTools Profiler
import { Profiler } from 'react';

<Profiler id="MyComponent" onRender={callback}>
  <MyComponent />
</Profiler>
```

### Optimization Techniques

1. **Memoization**:
```javascript
const Component = React.memo(function MyComponent({ data }) {
  return <div>{data}</div>;
});
```

2. **Code Splitting**:
```javascript
const Dashboard = React.lazy(() => import('./DashboardPage'));

<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

3. **Caching**:
```javascript
const api = getDashboardAPI();
const data = await api.getMonitors(); // Cached for 5 minutes
```

## Debugging

### Browser DevTools

1. **Inspect Element**: F12 or Cmd+Opt+I
2. **Console**: View logs and run commands
3. **Network**: Monitor API calls
4. **React DevTools**: Inspect component hierarchy
5. **Redux DevTools**: (if using Redux)

### Common Issues

**WebSocket not connecting:**
```javascript
const ws = getWebSocketClient();
console.log(ws.getStatus()); // Check { isConnected, queuedMessages }
```

**Component not updating:**
```javascript
// Check if hook dependencies are correct
useEffect(() => {
  console.log('Effect ran');
}, [dependency]); // Add missing dependencies
```

**Styling issues:**
```css
/* Check for z-index conflicts */
.modal {
  z-index: 1000; /* Must be higher than other elements */
}

/* Use !important only as last resort */
.override {
  color: red !important;
}
```

## Deployment Checklist

- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run lint` - no linting errors
- [ ] Run `npm run build` - successful build
- [ ] Test production build locally: `npm run preview`
- [ ] Check browser compatibility
- [ ] Verify API connectivity
- [ ] Update documentation
- [ ] Create git tag/release
- [ ] Deploy to staging first
- [ ] Verify in production

## Resources

- [React Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Jest Testing](https://jestjs.io)
- [Testing Library](https://testing-library.com)
- [MDN Web Docs](https://developer.mozilla.org)

## Getting Help

1. Check existing issues on GitHub
2. Review component documentation
3. Look at similar working components
4. Check browser console for errors
5. Ask in team chat or create issue

---

**Last Updated**: June 3, 2026  
**Version**: 1.0.0
