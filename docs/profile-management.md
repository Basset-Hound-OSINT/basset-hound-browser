# Profile/Identity Management

The Basset Hound Browser includes a comprehensive profile management system that allows you to create, manage, and switch between multiple browser identities. Each profile maintains its own isolated fingerprint, cookies, local storage, user agent, timezone, and proxy settings.

## Overview

Browser profiles are essential for OSINT work where you need to:
- Maintain multiple distinct identities
- Avoid browser fingerprinting detection
- Keep investigations separate with isolated storage
- Quickly switch between different personas
- Import/export identity configurations

## Features

Each profile includes:
- **User Agent**: Custom or randomly generated
- **Fingerprint Settings**:
  - Screen resolution and viewport
  - Canvas fingerprint noise
  - WebGL vendor/renderer
  - Audio context noise
  - Hardware concurrency
  - Device memory
  - Platform
  - Languages
  - Timezone
- **Isolated Storage**:
  - Cookies
  - Local storage
  - Session storage
- **Proxy Settings**: Per-profile proxy configuration

## API Reference

### Renderer Process (electronAPI)

```javascript
// Create a new profile
const result = await window.electronAPI.createProfile({
  name: 'OSINT Investigation 1',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  fingerprint: {
    timezone: { name: 'America/New_York', offset: 300 },
    languages: ['en-US', 'en']
  },
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    type: 'http',
    auth: { username: 'user', password: 'pass' }
  }
});
// Returns: { success: true, profile: {...} }

// List all profiles
const profiles = await window.electronAPI.listProfiles();
// Returns: { success: true, profiles: [...], activeProfileId: 'xxx', totalCount: 5 }

// Get a specific profile
const profile = await window.electronAPI.getProfile('profile-id');
// Returns: { success: true, profile: {...}, isActive: false, cookieCount: 12, localStorageKeys: 5 }

// Switch to a profile
const result = await window.electronAPI.switchProfile('profile-id');
// Returns: { success: true, profile: {...}, partition: 'persist:profile-xxx' }

// Update profile settings
await window.electronAPI.updateProfile('profile-id', {
  name: 'New Name',
  userAgent: 'New User Agent',
  fingerprint: { timezone: { name: 'Europe/London', offset: 0 } }
});

// Delete a profile
await window.electronAPI.deleteProfile('profile-id');

// Randomize a profile's fingerprint
await window.electronAPI.randomizeProfileFingerprint('profile-id');

// Export a profile
const exportData = await window.electronAPI.exportProfile('profile-id');
// Returns: { success: true, data: { version: '1.0', profile: {...}, cookies: [...], localStorage: {...} } }

// Import a profile
const imported = await window.electronAPI.importProfile(exportData.data);
// Returns: { success: true, profile: {...} }

// Get the active profile
const active = await window.electronAPI.getActiveProfile();

// Get profile evasion script
const script = await window.electronAPI.getProfileEvasionScript('profile-id');

// Listen for profile changes
window.electronAPI.onProfileChanged((data) => {
  console.log('Profile changed:', data.profileId, data.profile);
});
```

### WebSocket Commands

All commands are sent as JSON objects with a `command` field:

```json
{ "command": "create_profile", "name": "My Profile" }
```

#### create_profile
Create a new browser profile.

```json
{
  "command": "create_profile",
  "name": "OSINT Profile 1",
  "userAgent": "Mozilla/5.0...",
  "fingerprint": {
    "timezone": { "name": "America/Los_Angeles", "offset": 480 },
    "languages": ["en-US"],
    "screen": { "width": 1920, "height": 1080 }
  },
  "proxy": {
    "host": "proxy.example.com",
    "port": 8080,
    "type": "socks5"
  }
}
```

#### delete_profile
Delete a profile by ID.

```json
{
  "command": "delete_profile",
  "profileId": "abc123-def456"
}
```

#### get_profile
Get detailed information about a profile.

```json
{
  "command": "get_profile",
  "profileId": "abc123-def456"
}
```

#### list_profiles
List all available profiles.

```json
{
  "command": "list_profiles"
}
```

Response:
```json
{
  "success": true,
  "profiles": [
    {
      "id": "abc123-def456",
      "name": "OSINT Profile 1",
      "createdAt": "2025-01-15T10:30:00Z",
      "isActive": true,
      "hasProxy": false
    }
  ],
  "activeProfileId": "abc123-def456",
  "totalCount": 1
}
```

#### switch_profile
Switch to a different profile.

```json
{
  "command": "switch_profile",
  "profileId": "abc123-def456"
}
```

#### update_profile
Update profile settings.

```json
{
  "command": "update_profile",
  "profileId": "abc123-def456",
  "updates": {
    "name": "Updated Profile Name",
    "proxy": null
  }
}
```

#### export_profile
Export a profile for backup or sharing.

```json
{
  "command": "export_profile",
  "profileId": "abc123-def456"
}
```

#### import_profile
Import a previously exported profile.

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

#### randomize_profile_fingerprint
Generate new random fingerprint settings for a profile.

```json
{
  "command": "randomize_profile_fingerprint",
  "profileId": "abc123-def456"
}
```

#### get_active_profile
Get the currently active profile.

```json
{
  "command": "get_active_profile"
}
```

#### get_profile_evasion_script
Get the JavaScript evasion script configured for a profile.

```json
{
  "command": "get_profile_evasion_script",
  "profileId": "abc123-def456"
}
```

## Profile Structure

Each profile contains the following data:

```javascript
{
  id: "uuid-v4-string",
  name: "Profile Name",
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-01-15T10:30:00Z",
  partition: "persist:profile-uuid",

  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",

  fingerprint: {
    viewport: { width: 1920, height: 1080 },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelDepth: 24
    },
    platform: "Win32",
    languages: ["en-US", "en"],
    timezone: {
      name: "America/New_York",
      offset: 300
    },
    webgl: {
      vendor: "Google Inc. (NVIDIA)",
      renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1080...)"
    },
    hardwareConcurrency: 8,
    deviceMemory: 16,
    canvasNoise: 5,
    audioNoise: "0.0000123456"
  },

  proxy: {
    host: "proxy.example.com",
    port: 8080,
    type: "http",  // http, https, socks4, socks5
    auth: {
      username: "user",
      password: "pass"
    }
  }
}
```

## Storage Location

Profiles are stored in the user data directory:
- **Profile Index**: `{userData}/profiles/profiles-index.json`
- **Profile Data**: `{userData}/profiles/{profileId}.json`
- **Profile Cookies**: `{userData}/profiles/{profileId}/cookies.json`
- **Profile LocalStorage**: `{userData}/profiles/{profileId}/localStorage.json`

## Best Practices

### 1. Create Profiles for Each Investigation
Keep investigations isolated by creating a separate profile for each.

```javascript
const investigation = await window.electronAPI.createProfile({
  name: 'Investigation: Target Company',
});
await window.electronAPI.switchProfile(investigation.profile.id);
```

### 2. Randomize Fingerprints Periodically
Change fingerprints to avoid detection patterns:

```javascript
await window.electronAPI.randomizeProfileFingerprint(profileId);
```

### 3. Export Profiles for Backup
Regular backups ensure you don't lose investigation context:

```javascript
const backup = await window.electronAPI.exportProfile(profileId);
// Save backup.data to a file
```

### 4. Use Realistic Fingerprints
When creating custom fingerprints, use realistic combinations that won't trigger anomaly detection.

### 5. Match User Agent with Fingerprint
Ensure the user agent matches the fingerprint settings (e.g., Windows UA with Win32 platform).

## Events

The profile system emits events when profiles change:

```javascript
window.electronAPI.onProfileChanged((data) => {
  console.log('New profile:', data.profile.name);
  console.log('Partition:', data.partition);
});
```

## Error Handling

All API calls return objects with a `success` field:

```javascript
const result = await window.electronAPI.deleteProfile('invalid-id');
if (!result.success) {
  console.error('Error:', result.error);
  // Error: "Profile not found"
}
```

## Integration with Other Features

Profiles integrate with:
- **Cookies**: Profile-specific cookie jars
- **Session Management**: Each profile has its own Electron session
- **Proxy Manager**: Per-profile proxy settings
- **Fingerprint Evasion**: Profile-specific evasion scripts
- **User Agent Rotation**: Profile-aware user agent management
