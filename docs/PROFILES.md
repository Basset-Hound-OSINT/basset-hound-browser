# Profile Management API

The Profile Management module provides comprehensive browser profile management for the Basset Hound Browser. Each profile maintains isolated fingerprint settings, cookies, storage, user agent, and proxy configuration.

## Overview

The Profile Management system enables:
- Creating and managing multiple browser identities
- Isolated storage (cookies, localStorage) per profile
- Custom fingerprint configuration
- User agent management
- Proxy settings per profile
- Profile import/export
- Fingerprint randomization
- Profile persistence to disk

## Module Locations

```
basset-hound-browser/profiles/manager.js  - Profile and ProfileManager classes
basset-hound-browser/profiles/storage.js  - ProfileStorage class for persistence
```

---

## Profile Class

The `Profile` class represents a single browser profile with all its settings.

### Constructor

```javascript
const { Profile } = require('./profiles/manager');

const profile = new Profile({
  id: 'custom-id',              // Optional: auto-generated UUID if not provided
  name: 'My Profile',           // Optional: default "Profile {timestamp}"
  userAgent: 'Mozilla/5.0...',  // Optional: randomly generated if not provided
  fingerprint: {...},           // Optional: randomly generated if not provided
  proxy: {...},                 // Optional: null if not provided
  cookies: [],                  // Optional: empty array if not provided
  localStorage: {},             // Optional: empty object if not provided
  partition: 'persist:custom'   // Optional: auto-generated based on ID
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique profile identifier (UUID) |
| `name` | string | Human-readable profile name |
| `createdAt` | string | ISO timestamp of creation |
| `updatedAt` | string | ISO timestamp of last update |
| `userAgent` | string | User agent string |
| `fingerprint` | Object | Fingerprint configuration |
| `proxy` | Object/null | Proxy configuration |
| `cookies` | Array | Stored cookies |
| `localStorage` | Object | Stored localStorage data |
| `partition` | string | Electron session partition |
| `isActive` | boolean | Whether profile is currently active |

### Fingerprint Structure

```javascript
profile.fingerprint = {
  // Screen and viewport
  viewport: {
    width: 1920,
    height: 1080
  },
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24
  },

  // Platform and language
  platform: 'Win32',
  languages: ['en-US', 'en'],

  // Timezone
  timezone: 'America/New_York',

  // WebGL
  webgl: {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080...)'
  },

  // Hardware
  hardwareConcurrency: 8,
  deviceMemory: 16,

  // Noise factors
  canvasNoise: 5,          // 0-9 for canvas fingerprint variation
  audioNoise: '0.0000123'  // Audio context noise factor
};
```

### Proxy Structure

```javascript
profile.proxy = {
  host: 'proxy.example.com',
  port: 8080,
  type: 'http',  // 'http', 'https', 'socks4', 'socks5'
  auth: {
    username: 'user',
    password: 'pass'
  }
};
```

### Methods

#### generateRandomUserAgent()

Generate a random user agent string.

```javascript
const userAgent = profile.generateRandomUserAgent();
```

**Returns:** `string` - Random user agent from predefined list

#### generateRandomFingerprint()

Generate random fingerprint settings.

```javascript
const fingerprint = profile.generateRandomFingerprint();
```

**Returns:** `Object` - Random fingerprint configuration

#### update(updates)

Update profile settings.

```javascript
profile.update({
  name: 'New Name',
  userAgent: 'Custom User Agent',
  fingerprint: { timezone: 'Europe/London' },
  proxy: { host: 'newproxy.com', port: 8080 }
});
```

**Parameters:**
- `updates` (Object) - Settings to update (name, userAgent, fingerprint, proxy, cookies, localStorage)

#### toJSON()

Convert to a plain object for serialization.

```javascript
const data = profile.toJSON();
```

**Returns:** `Object` - Plain object representation

#### Profile.fromJSON(data)

Create a Profile instance from stored data (static method).

```javascript
const profile = Profile.fromJSON(storedData);
```

**Parameters:**
- `data` (Object) - Stored profile data

**Returns:** `Profile` - New Profile instance

---

## ProfileManager Class

The `ProfileManager` class manages multiple browser profiles.

### Constructor

```javascript
const { ProfileManager } = require('./profiles/manager');

const profileManager = new ProfileManager(
  '/path/to/data',  // Data path for storage
  mainWindow        // Optional: BrowserWindow reference
);
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `storage` | ProfileStorage | Storage handler instance |
| `mainWindow` | BrowserWindow | Main window reference |
| `profiles` | Map | Map of profile ID to Profile instance |
| `activeProfileId` | string/null | Currently active profile ID |
| `activeSession` | Session/null | Currently active Electron session |

### Methods

#### setMainWindow(mainWindow)

Set the main window reference.

```javascript
profileManager.setMainWindow(mainWindow);
```

#### loadProfiles()

Load all profiles from storage. Called automatically on construction.

```javascript
profileManager.loadProfiles();
```

---

## Profile CRUD Operations

### createProfile(options)

Create a new profile.

```javascript
const result = profileManager.createProfile({
  name: 'Investigation Profile',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  fingerprint: {
    timezone: 'America/Los_Angeles',
    languages: ['en-US']
  },
  proxy: {
    host: 'proxy.example.com',
    port: 8080
  }
});
```

**Parameters:**
- `options` (Object, optional) - Profile configuration options

**Returns:**
```javascript
{
  success: true,
  profile: {
    id: 'uuid-v4',
    name: 'Investigation Profile',
    createdAt: '2025-01-15T10:30:00Z',
    ...
  }
}
// Or on error:
{ success: false, error: 'Error message' }
```

### deleteProfile(profileId)

Delete a profile.

```javascript
const result = await profileManager.deleteProfile('profile-id');
```

**Parameters:**
- `profileId` (string) - Profile identifier

**Returns:**
```javascript
{ success: true }
// Or on error:
{ success: false, error: 'Profile not found' }
```

**Notes:**
- Clears associated Electron session data
- Removes from storage and index
- Clears active profile if deleted

### getProfile(profileId)

Get a profile by ID with additional metadata.

```javascript
const result = profileManager.getProfile('profile-id');
```

**Parameters:**
- `profileId` (string) - Profile identifier

**Returns:**
```javascript
{
  success: true,
  profile: {
    id: 'profile-id',
    name: 'My Profile',
    ...
    isActive: true,
    cookieCount: 12,
    localStorageKeys: 5
  }
}
```

### listProfiles()

List all profiles with summary information.

```javascript
const result = profileManager.listProfiles();
```

**Returns:**
```javascript
{
  success: true,
  profiles: [
    {
      id: 'profile-id-1',
      name: 'Profile 1',
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-01-15T11:00:00Z',
      isActive: true,
      userAgent: 'Mozilla/5.0...',  // Truncated to 50 chars
      hasProxy: false
    },
    ...
  ],
  activeProfileId: 'profile-id-1',
  totalCount: 5
}
```

### updateProfile(profileId, updates)

Update profile settings.

```javascript
const result = profileManager.updateProfile('profile-id', {
  name: 'Updated Name',
  proxy: null  // Remove proxy
});
```

**Parameters:**
- `profileId` (string) - Profile identifier
- `updates` (Object) - Updates to apply

**Returns:**
```javascript
{
  success: true,
  profile: {...}
}
```

**Notes:**
- If updating the active profile, changes are applied immediately to the session

---

## Profile Switching

### switchProfile(profileId)

Switch to a different profile.

```javascript
const result = await profileManager.switchProfile('profile-id');
```

**Parameters:**
- `profileId` (string) - Profile identifier

**Returns:**
```javascript
{
  success: true,
  profile: {...},
  partition: 'persist:profile-uuid'
}
```

**Actions performed:**
1. Saves current profile state (cookies)
2. Creates/retrieves Electron session for new profile
3. Applies profile settings (user agent, proxy, cookies)
4. Configures request headers based on fingerprint
5. Updates active profile
6. Sends 'profile-changed' event to main window

### getActiveProfile()

Get the currently active profile.

```javascript
const profile = profileManager.getActiveProfile();
```

**Returns:** `Profile|null` - Active profile or null

### getActivePartition()

Get the active profile's partition string.

```javascript
const partition = profileManager.getActivePartition();
// Returns: 'persist:profile-uuid' or ''
```

---

## Profile Export/Import

### exportProfile(profileId)

Export a profile for backup or sharing.

```javascript
const result = await profileManager.exportProfile('profile-id');
```

**Parameters:**
- `profileId` (string) - Profile identifier

**Returns:**
```javascript
{
  success: true,
  data: {
    version: '1.0',
    exportedAt: '2025-01-15T10:30:00Z',
    profile: {...},
    cookies: [...],
    localStorage: {...}
  }
}
```

### importProfile(importData)

Import a previously exported profile.

```javascript
const result = await profileManager.importProfile(exportData.data);
```

**Parameters:**
- `importData` (Object) - Exported profile data

**Returns:**
```javascript
{
  success: true,
  profile: {
    id: 'new-uuid',  // New ID assigned
    name: 'Original Name (Imported)',
    originalId: 'old-uuid',
    importedAt: '2025-01-15T10:30:00Z',
    ...
  }
}
```

**Notes:**
- Creates a new profile with a new ID
- Appends " (Imported)" to the name
- Preserves original fingerprint, cookies, and localStorage

---

## Fingerprint Management

### randomizeFingerprint(profileId)

Generate new random fingerprint and user agent for a profile.

```javascript
const result = profileManager.randomizeFingerprint('profile-id');
```

**Parameters:**
- `profileId` (string) - Profile identifier

**Returns:**
```javascript
{
  success: true,
  profile: {...}  // Updated profile with new fingerprint
}
```

**Notes:**
- Generates new random fingerprint values
- Generates new random user agent
- Applies immediately if profile is active

### getEvasionScript(profileId)

Get the fingerprint evasion script for a profile.

```javascript
const script = profileManager.getEvasionScript('profile-id');
```

**Parameters:**
- `profileId` (string, optional) - Profile ID (uses active profile if not provided)

**Returns:** `string` - JavaScript evasion script

---

## Session Management

### applyProfileToSession(profile, electronSession)

Apply profile settings to an Electron session.

```javascript
await profileManager.applyProfileToSession(profile, session);
```

**Actions performed:**
1. Sets user agent
2. Configures proxy if specified
3. Loads cookies from profile
4. Configures Accept-Language header based on fingerprint languages
5. Removes CSP headers from responses

### buildProxyRules(proxy)

Build proxy rules string from proxy configuration.

```javascript
const rules = profileManager.buildProxyRules({
  host: 'proxy.example.com',
  port: 8080,
  type: 'socks5',
  auth: { username: 'user', password: 'pass' }
});
// Returns: 'socks5://user:pass@proxy.example.com:8080'
```

### saveActiveProfileState()

Save the current active profile's state (cookies).

```javascript
await profileManager.saveActiveProfileState();
```

---

## Lifecycle Methods

### cleanup()

Save all profiles and cleanup resources.

```javascript
await profileManager.cleanup();
```

---

## ProfileStorage Class

The `ProfileStorage` class handles persistence of profiles to disk.

### Constructor

```javascript
const ProfileStorage = require('./profiles/storage');

const storage = new ProfileStorage('/path/to/data');
```

### Storage Paths

| Path | Description |
|------|-------------|
| `{dataPath}/profiles/` | Profile files directory |
| `{dataPath}/profiles-index.json` | Index of all profiles |
| `{dataPath}/profiles/{id}.json` | Individual profile data |
| `{dataPath}/profiles/{id}/cookies.json` | Profile cookies |
| `{dataPath}/profiles/{id}/localStorage.json` | Profile localStorage |

### Index Methods

#### loadIndex()

Load the profiles index.

```javascript
const index = storage.loadIndex();
```

**Returns:**
```javascript
{
  profiles: ['id1', 'id2', ...],
  activeProfileId: 'id1',
  lastModified: '2025-01-15T10:30:00Z'
}
```

#### saveIndex(index)

Save the profiles index.

```javascript
storage.saveIndex({
  profiles: ['id1', 'id2'],
  activeProfileId: 'id1'
});
```

### Profile CRUD

#### loadProfile(profileId)

Load a profile from disk.

```javascript
const profileData = storage.loadProfile('profile-id');
```

**Returns:** `Object|null` - Profile data or null if not found

#### saveProfile(profileId, profileData)

Save a profile to disk.

```javascript
storage.saveProfile('profile-id', {
  id: 'profile-id',
  name: 'My Profile',
  ...
});
```

#### deleteProfile(profileId)

Delete a profile from disk.

```javascript
storage.deleteProfile('profile-id');
```

#### listProfiles()

List all profiles from disk.

```javascript
const profiles = storage.listProfiles();
```

**Returns:**
```javascript
[
  { id: 'id1', name: 'Profile 1', createdAt: '...', savedAt: '...' },
  ...
]
```

#### profileExists(profileId)

Check if a profile exists.

```javascript
const exists = storage.profileExists('profile-id');
```

### Cookie Storage

#### saveCookies(profileId, cookies)

Save cookies for a profile.

```javascript
storage.saveCookies('profile-id', cookies);
```

#### loadCookies(profileId)

Load cookies for a profile.

```javascript
const cookies = storage.loadCookies('profile-id');
```

### LocalStorage Management

#### saveLocalStorage(profileId, localStorage)

Save localStorage for a profile.

```javascript
storage.saveLocalStorage('profile-id', { 'origin': { 'key': 'value' } });
```

#### loadLocalStorage(profileId)

Load localStorage for a profile.

```javascript
const localStorage = storage.loadLocalStorage('profile-id');
```

### Export/Import

#### exportProfile(profileId)

Export a complete profile with all data.

```javascript
const exportData = storage.exportProfile('profile-id');
```

#### importProfile(exportData, newId)

Import a profile from exported data.

```javascript
const profileId = storage.importProfile(exportData, 'custom-id');
```

### Utilities

#### getStats()

Get storage statistics.

```javascript
const stats = storage.getStats();
```

**Returns:**
```javascript
{
  profileCount: 5,
  totalSize: 125000,  // bytes
  profiles: [
    { id: 'id1', size: 25000, modified: Date },
    ...
  ]
}
```

#### cleanup()

Clean up orphaned data (directories without profile files).

```javascript
storage.cleanup();
```

---

## WebSocket Commands

### create_profile

```json
{
  "command": "create_profile",
  "name": "OSINT Profile 1",
  "userAgent": "Mozilla/5.0...",
  "fingerprint": {
    "timezone": { "name": "America/Los_Angeles" },
    "languages": ["en-US"]
  },
  "proxy": {
    "host": "proxy.example.com",
    "port": 8080
  }
}
```

### delete_profile

```json
{
  "command": "delete_profile",
  "profileId": "abc123-def456"
}
```

### get_profile

```json
{
  "command": "get_profile",
  "profileId": "abc123-def456"
}
```

### list_profiles

```json
{
  "command": "list_profiles"
}
```

### switch_profile

```json
{
  "command": "switch_profile",
  "profileId": "abc123-def456"
}
```

### update_profile

```json
{
  "command": "update_profile",
  "profileId": "abc123-def456",
  "updates": {
    "name": "Updated Name",
    "proxy": null
  }
}
```

### export_profile

```json
{
  "command": "export_profile",
  "profileId": "abc123-def456"
}
```

### import_profile

```json
{
  "command": "import_profile",
  "data": {
    "version": "1.0",
    "profile": {...},
    "cookies": [...],
    "localStorage": {...}
  }
}
```

### randomize_profile_fingerprint

```json
{
  "command": "randomize_profile_fingerprint",
  "profileId": "abc123-def456"
}
```

### get_active_profile

```json
{
  "command": "get_active_profile"
}
```

### get_profile_evasion_script

```json
{
  "command": "get_profile_evasion_script",
  "profileId": "abc123-def456"
}
```

---

## Code Examples

### Basic Profile Management

```javascript
const { ProfileManager } = require('./profiles/manager');

const manager = new ProfileManager('./data');

// Create a profile
const { profile } = manager.createProfile({
  name: 'Investigation 1',
  fingerprint: {
    timezone: 'Europe/London',
    languages: ['en-GB', 'en']
  }
});

// Switch to the profile
await manager.switchProfile(profile.id);

// Update profile
manager.updateProfile(profile.id, {
  name: 'Investigation 1 - Updated'
});

// List all profiles
const { profiles } = manager.listProfiles();
console.log(`${profiles.length} profiles available`);
```

### Profile Export/Import

```javascript
// Export profile
const { data } = await manager.exportProfile(profileId);

// Save to file (using fs)
const fs = require('fs').promises;
await fs.writeFile('profile-backup.json', JSON.stringify(data, null, 2));

// Import from file
const importData = JSON.parse(await fs.readFile('profile-backup.json', 'utf8'));
const { profile } = await manager.importProfile(importData);
console.log('Imported as:', profile.name);
```

### WebSocket Client (Python)

```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8765")

# Create a profile
ws.send(json.dumps({
    "command": "create_profile",
    "name": "OSINT Investigation",
    "fingerprint": {
        "timezone": "America/New_York"
    }
}))
response = json.loads(ws.recv())
profile_id = response["profile"]["id"]

# Switch to the profile
ws.send(json.dumps({
    "command": "switch_profile",
    "profileId": profile_id
}))

# Randomize fingerprint periodically
ws.send(json.dumps({
    "command": "randomize_profile_fingerprint",
    "profileId": profile_id
}))

ws.close()
```

### Using Profiles with Custom Sessions

```javascript
const { session } = require('electron');

// Get the active profile's partition
const partition = manager.getActivePartition();

// Create BrowserView with profile session
const view = new BrowserView({
  webPreferences: {
    partition: partition
  }
});
```

---

## Configuration

### Fingerprint Options

The following are randomly selected from predefined lists when generating fingerprints:

**User Agents:** Chrome, Firefox, Safari on Windows, macOS, Linux

**Viewports:**
- 1920x1080, 1440x900, 1366x768, 1536x864, 2560x1440, etc.

**Platforms:**
- Win32, MacIntel, Linux x86_64

**Languages:**
- ['en-US', 'en'], ['en-GB', 'en'], ['de-DE', 'de', 'en'], etc.

**Timezones:**
- America/New_York, America/Los_Angeles, Europe/London, Asia/Tokyo, etc.

**WebGL Renderers:**
- Various NVIDIA, AMD, Intel GPU strings

**Hardware:**
- CPU cores: 4, 8, 12, 16
- Device memory: 4, 8, 16, 32 GB

---

## Events

The ProfileManager sends events to the main window:

```javascript
// In main process
profileManager.mainWindow.webContents.send('profile-changed', {
  profileId: 'abc123',
  profile: {...}
});

// In renderer process (via preload)
window.electronAPI.onProfileChanged((data) => {
  console.log('Profile changed:', data.profileId);
});
```

---

## Error Handling

All methods return objects with a `success` boolean:

```javascript
const result = await manager.switchProfile('invalid-id');

if (!result.success) {
  console.error('Error:', result.error);
  // Error: "Profile not found"
}
```

Common errors:
- `"Profile not found"` - Profile ID doesn't exist
- `"Invalid import data: missing profile"` - Import data malformed
- Session errors during profile switch
