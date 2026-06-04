# Basset Hound Mobile Dashboard

React Native mobile application for Basset Hound Browser competitor monitoring on iOS and Android.

## Overview

The Basset Hound Mobile Dashboard provides a native iOS and Android interface for monitoring competitor activity, tracking changes, managing alerts, and controlling monitors in real-time. It integrates with the Basset Hound Browser backend via WebSocket for real-time updates and includes offline support for seamless operation regardless of network connectivity.

## Features

### Core Features
- **Real-time Dashboard** - Live monitoring of competitor activity
- **Monitor Management** - Create, update, and delete monitors
- **Alert System** - Comprehensive alert management with severity levels
- **Timeline View** - Historical tracking of all changes
- **Settings Management** - Customizable user preferences
- **Offline Support** - Full functionality with cached data when offline
- **Push Notifications** - Alert notifications on device
- **Search & Filter** - Advanced filtering capabilities

### Platform-Specific Features
- **iOS**
  - Safe area handling for notch/Dynamic Island
  - iOS-style navigation and gestures
  - Haptic feedback on actions
  - TestFlight beta distribution
  - App Store deployment

- **Android**
  - Material Design 3 styling
  - Android back button handling
  - Android-specific permissions
  - Google Play Console distribution
  - Android 11+ compliance

## Project Structure

```
mobile/
├── src/
│   ├── api/
│   │   ├── dashboard-api.ts        # High-level API service with caching
│   │   └── websocket-client.ts     # WebSocket client with auto-reconnect
│   ├── components/
│   │   ├── MonitorCard.tsx         # Monitor display component
│   │   ├── AlertListItem.tsx       # Alert list item component
│   │   ├── ConnectionStatus.tsx    # Connection indicator
│   │   └── StatCard.tsx            # Statistics display card
│   ├── hooks/
│   │   ├── useDashboard.ts         # Main dashboard hook
│   │   └── useTheme.ts             # Theme and styling hook
│   ├── screens/
│   │   ├── DashboardScreen.tsx     # Overview screen
│   │   ├── MonitorsScreen.tsx      # Monitors list screen
│   │   ├── AlertsScreen.tsx        # Alerts management screen
│   │   └── SettingsScreen.tsx      # User settings screen
│   ├── state/
│   │   └── store.ts                # Zustand state management
│   ├── navigation/
│   │   └── RootNavigator.tsx       # Tab navigation structure
│   ├── __tests__/
│   │   ├── hooks/
│   │   ├── components/
│   │   └── state/
│   ├── App.tsx                     # Main app component
│   └── index.tsx                   # Entry point
├── ios/                            # iOS native code
├── android/                        # Android native code
├── package.json
├── tsconfig.json
├── jest.config.js
├── .babelrc
└── .eslintrc

```

## Development Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- Xcode 14+ (for iOS development)
- Android Studio 2022+ (for Android development)
- React Native CLI or Expo CLI
- iOS Simulator or physical iOS device
- Android Emulator or physical Android device

### Installation

```bash
# Install dependencies
npm install

# Or with yarn
yarn install
```

### Running the App

#### iOS Development
```bash
# Start Metro bundler (if not already running)
npm start

# In another terminal, run iOS app
npm run ios:dev

# Or directly with React Native
react-native run-ios

# Run on specific device
react-native run-ios --device "iPhone Simulator"
```

#### Android Development
```bash
# Start Metro bundler (if not already running)
npm start

# In another terminal, run Android app
npm run android:dev

# Or directly with React Native
react-native run-android
```

### Development Server

```bash
# Start Metro bundler on port 8081
npm start

# With additional options
npm start -- --reset-cache
```

## Configuration

### API Configuration
Update the WebSocket URL in `src/api/websocket-client.ts`:

```typescript
const DEFAULT_WS_URL = 'ws://your-server:8765';
```

For different environments, use environment variables:
```bash
WS_URL=ws://production-server:8765 npm run build:android
```

### Environment Setup

Create `.env` files for environment-specific configuration:

```env
# .env.development
WS_URL=ws://localhost:8765
API_TIMEOUT=30000
LOG_LEVEL=debug

# .env.production
WS_URL=ws://api.production.com:8765
API_TIMEOUT=30000
LOG_LEVEL=error
```

## State Management

### Zustand Store
The app uses Zustand for state management with the following structure:

```typescript
// Accessing store
const { monitors, alerts, settings } = useDashboardStore();

// Updating state
const { setMonitors, addAlert } = useDashboardStore();

// Persisting settings
await useDashboardStore.getState().saveSettings();
```

### Store Operations

```typescript
// Monitors
addMonitor(monitor)
updateMonitor(monitorId, updates)
removeMonitor(monitorId)
getMonitor(monitorId)
setMonitors(monitors)

// Alerts
addAlert(alert)
markAlertRead(alertId)
dismissAlert(alertId)
getUnreadCount()
getCriticalCount()
setAlerts(alerts)

// Timeline
addChange(change)
setTimeline(timeline)
clearTimeline()

// Settings
updateSettings(updates)
getSetting(key)
saveSettings()
loadSettings()
```

## API Integration

### WebSocket Client
The `WebSocketClient` handles all WebSocket communication:

- **Auto-reconnection** with exponential backoff
- **Message queuing** while disconnected
- **Heartbeat** to maintain connection
- **Request/response** matching with IDs
- **Broadcast** subscriptions for real-time updates

```typescript
const ws = getWebSocketClient();
await ws.connect();

// Send command
const response = await ws.send('get_monitors', {});

// Subscribe to updates
ws.subscribe('dashboard_change', (data) => {
  console.log('Change detected:', data);
});
```

### Dashboard API
High-level API wrapper with caching and offline support:

```typescript
const api = getDashboardAPI();

// Initialize offline storage
await api.initializeOfflineStorage();

// Fetch data (uses cache if valid)
const monitors = await api.getMonitors();
const alerts = await api.getAlerts();

// Perform actions
await api.createMonitor(config);
await api.markAlertRead(alertId);

// Offline mode
if (api.isOfflineMode()) {
  console.log('Operating in offline mode');
}
```

## Theming

### Light/Dark Theme Support
Theme is managed through the `useTheme()` hook:

```typescript
const theme = useTheme();

// Access colors
theme.colors.primary
theme.colors.background
theme.colors.success

// Access spacing
theme.spacing.xs  // 4px
theme.spacing.md  // 12px
theme.spacing.xl  // 24px

// Access shadows
theme.shadow.sm
theme.shadow.md
```

### Theme Toggle
Users can toggle between light and dark themes in Settings:

```typescript
updateSettings({ theme: 'light' | 'dark' })
```

## Offline Support

The app provides seamless offline functionality:

1. **Local Caching** - Data cached via AsyncStorage
2. **Offline Detection** - Network status monitoring
3. **Queue Management** - Actions queued while offline
4. **Sync on Reconnect** - Automatic synchronization

```typescript
// Check offline status
const { isOffline } = useDashboard();

// Work with cached data
const cachedMonitors = await api.getMonitors(); // Returns cached data if offline

// Offline mode indicator
<ConnectionStatus status={connectionStatus} isOffline={isOffline} />
```

## Navigation

### Tab Navigation Structure
- **Dashboard** - Overview and metrics
- **Monitors** - List and management
- **Alerts** - Alert handling
- **Settings** - User preferences

Each tab uses stack navigation for additional screens.

### Navigation Usage
```typescript
// Navigate between tabs
navigation.navigate('Monitors');

// Navigate within stack
navigation.push('MonitorDetail', { monitorId: '123' });

// Go back
navigation.goBack();
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Structure

```
src/__tests__/
├── components/        # Component tests
├── hooks/            # Hook tests
├── state/            # Store tests
└── integration/      # Integration tests
```

### Example Test

```typescript
describe('useDashboard Hook', () => {
  it('should refresh dashboard data', async () => {
    const { result } = renderHook(() => useDashboard());
    
    await act(async () => {
      await result.current.refreshData();
    });
    
    expect(result.current.loading).toBe(false);
  });
});
```

## Building for Production

### iOS Build

```bash
# Create archive
npm run ios:build

# Or use Xcode directly
cd ios
xcodebuild -workspace BassetHoundMobile.xcworkspace \
  -scheme BassetHoundMobile \
  -configuration Release \
  -archivePath build/BassetHound.xcarchive \
  archive
```

### Android Build

```bash
# Create release APK
npm run android:build

# Or use Gradle directly
cd android
./gradlew assembleRelease

# Create App Bundle (for Play Store)
./gradlew bundleRelease
```

## Distribution

### iOS Distribution
1. **TestFlight Beta**
   - Archive app in Xcode
   - Upload to TestFlight
   - Invite beta testers

2. **App Store Release**
   - Prepare screenshots and description
   - Upload build to App Store Connect
   - Submit for review

### Android Distribution
1. **Google Play Console Beta**
   - Upload APK/AAB to internal testing
   - Invite beta testers

2. **Play Store Release**
   - Prepare store listing
   - Upload release build
   - Submit for review

## Performance Optimization

### Memory Management
- Lazy loading of screens
- Image optimization
- Cache size limits
- Proper cleanup in useEffect

### Network Optimization
- Message compression
- Request batching
- Cache TTL management
- Bandwidth-efficient payloads

### Battery Optimization
- Efficient polling intervals
- Background task limitation
- Sensor usage optimization

## Security

### Data Protection
- TLS/SSL for WebSocket
- Local data encryption
- Secure token storage
- API key management

### Permission Handling
```typescript
// iOS permissions
<key>NSCameraUsageDescription</key>
<string>Camera access for QR code scanning</string>

// Android permissions
<uses-permission android:name="android.permission.CAMERA" />
```

## Troubleshooting

### Common Issues

**WebSocket Connection Failed**
```typescript
// Check connection URL
const ws = getWebSocketClient('ws://correct-url:8765');

// Check network status
await NetInfo.fetch();
```

**Data Not Updating**
```typescript
// Refresh manually
await refreshData();

// Check cache validity
const valid = api.isValidCache('key');
```

**Performance Issues**
```bash
# Profile app performance
npm start -- --interactive

# Monitor memory usage in DevTools
```

## Contributing

1. Follow TypeScript strict mode
2. Use provided hooks and utilities
3. Write tests for new features
4. Follow code style with Prettier
5. Document complex logic

## License

MIT

## Support

For issues and questions, refer to the main Basset Hound Browser documentation or create an issue in the project repository.
