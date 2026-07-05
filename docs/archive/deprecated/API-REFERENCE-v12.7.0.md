# Basset Hound Browser API Reference - v12.7.0

**Version:** 12.7.0  
**Release Date:** June 15, 2026  
**Protocol:** WebSocket (JSON messages)  
**Default Port:** 8765  
**Total Commands:** 192 (164 existing + 28 new)  
**Status:** Production Ready ✅

---

## Connection Information

### WebSocket URL

```
ws://localhost:8765     # Standard connection
wss://localhost:8765    # SSL/TLS connection (if configured)
```

### Authentication

Authentication is optional by default. When enabled:

```javascript
// Via query parameter
ws://localhost:8765?token=YOUR_TOKEN

// Via header
Authorization: Bearer YOUR_TOKEN

// Via authenticate command
{ "id": 1, "command": "authenticate", "token": "YOUR_TOKEN" }
```

---

## Message Format

### Request

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2"
}
```

### Success Response

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": false,
  "error": "Error message",
  "error_code": "ERROR_CODE",
  "recovery": { 
    "suggestion": "...", 
    "alternativeCommands": [...] 
  }
}
```

---

## NEW COMMANDS IN v12.7.0

### SECTION 1: TOTP/HOTP CREDENTIAL COMMANDS (8 commands)

---

#### Command: `generate_totp`

**Description:** Generate a time-based one-time password (TOTP) from a shared secret.

**RFC Compliance:** RFC 6238 (Time-based One-Time Password Algorithm)

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `secret` | string | Yes | - | Base32-encoded shared secret |
| `window` | integer | No | 30 | Time window in seconds (typically 30) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "1",
  command: "generate_totp",
  secret: "JBSWY3DPEBLW64TMMQ======",
  window: 30
}));
```

**Success Response:**

```json
{
  "id": "1",
  "command": "generate_totp",
  "success": true,
  "data": {
    "code": "123456",
    "remaining_seconds": 18,
    "window": 30,
    "algorithm": "SHA-1",
    "digits": 6
  }
}
```

**Error Response:**

```json
{
  "id": "1",
  "command": "generate_totp",
  "success": false,
  "error": "Invalid Base32 secret",
  "error_code": "INVALID_SECRET_FORMAT",
  "recovery": {
    "suggestion": "Ensure secret is valid Base32 (padded to multiple of 8)",
    "alternativeCommands": ["generate_secret", "encode_secret"]
  }
}
```

**Performance:** 2-3ms latency, <1KB response

**Notes:**
- Returns 6-digit code by default (configurable)
- Codes valid for entire `window` period + 1 grace period
- Remaining seconds indicates time until code changes
- Use with authenticator apps (Google Authenticator, Authy, etc.)

---

#### Command: `generate_hotp`

**Description:** Generate an HMAC-based one-time password (HOTP) using counter-based authentication.

**RFC Compliance:** RFC 4226 (HMAC-Based One-Time Password Algorithm)

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `secret` | string | Yes | - | Base32-encoded shared secret |
| `counter` | integer | Yes | - | Counter value (increment for each use) |
| `digits` | integer | No | 6 | Number of digits (4-8) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "2",
  command: "generate_hotp",
  secret: "JBSWY3DPEBLW64TMMQ======",
  counter: 42,
  digits: 6
}));
```

**Success Response:**

```json
{
  "id": "2",
  "command": "generate_hotp",
  "success": true,
  "data": {
    "code": "654321",
    "counter": 42,
    "digits": 6,
    "algorithm": "SHA-1"
  }
}
```

**Error Response:**

```json
{
  "id": "2",
  "command": "generate_hotp",
  "success": false,
  "error": "Counter must be non-negative integer",
  "error_code": "INVALID_COUNTER"
}
```

**Performance:** 2-3ms latency, <1KB response

**Notes:**
- Counter must be incremented for each successful authentication
- Useful for single-use code delivery (SMS, email)
- Server must track counter to prevent replay attacks
- Digits parameter allows 4-8 digit codes

---

#### Command: `generate_secret`

**Description:** Generate a cryptographically secure random Base32-encoded secret suitable for use with TOTP/HOTP.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `length` | integer | No | 32 | Length in bytes (16, 32, 64) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "3",
  command: "generate_secret",
  length: 32
}));
```

**Success Response:**

```json
{
  "id": "3",
  "command": "generate_secret",
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "length_bytes": 32,
    "length_base32": 52,
    "entropy_bits": 160
  }
}
```

**Performance:** <1ms latency, <1KB response

**Notes:**
- Uses cryptographically secure random generator
- Base32 output ready for use with `generate_totp` or `generate_hotp`
- Entropy sufficient for any OTP application
- Recommended length: 32 bytes (160 bits entropy)

---

#### Command: `encode_secret`

**Description:** Encode raw bytes to Base32 format for use with TOTP/HOTP algorithms.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | string | Yes | - | Raw data as base64-encoded string |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "4",
  command: "encode_secret",
  data: "SGVsbG8gV29ybGQ="  // "Hello World" in base64
}));
```

**Success Response:**

```json
{
  "id": "4",
  "command": "encode_secret",
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "input_length": 11,
    "output_length": 16,
    "padding": 6
  }
}
```

**Performance:** <1ms latency, <1KB response

**Notes:**
- Input data must be base64-encoded
- Output is Base32 suitable for TOTP/HOTP
- Automatic padding applied
- Lossless conversion

---

#### Command: `decode_secret`

**Description:** Decode Base32-encoded secret back to raw bytes (base64-encoded).

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `secret` | string | Yes | - | Base32-encoded secret |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "5",
  command: "decode_secret",
  secret: "JBSWY3DPEBLW64TMMQ======"
}));
```

**Success Response:**

```json
{
  "id": "5",
  "command": "decode_secret",
  "success": true,
  "data": {
    "data": "SGVsbG8gV29ybGQ=",  // base64-encoded raw data
    "output_length": 11,
    "input_length": 16
  }
}
```

**Performance:** <1ms latency, <1KB response

**Notes:**
- Output is base64-encoded for safe JSON transmission
- Useful for round-trip verification
- Lossless conversion

---

#### Command: `validate_totp`

**Description:** Validate a TOTP code against a shared secret, accounting for time skew.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | string | Yes | - | 6-digit TOTP code to validate |
| `secret` | string | Yes | - | Base32-encoded shared secret |
| `window` | integer | No | 30 | Time window in seconds |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "6",
  command: "validate_totp",
  code: "123456",
  secret: "JBSWY3DPEBLW64TMMQ======",
  window: 30
}));
```

**Success Response (Valid):**

```json
{
  "id": "6",
  "command": "validate_totp",
  "success": true,
  "data": {
    "valid": true,
    "time_skew": 0,
    "remaining_seconds": 15
  }
}
```

**Success Response (Invalid):**

```json
{
  "id": "6",
  "command": "validate_totp",
  "success": true,
  "data": {
    "valid": false,
    "time_skew": null,
    "reason": "Code expired or invalid"
  }
}
```

**Performance:** 3-4ms latency, <1KB response

**Notes:**
- Validates code against current and ±1 time windows to handle skew
- Returns time_skew value if valid (server clock difference)
- Use with care: only accept once per time window to prevent replay
- Recommended: Implement server-side code replay detection

---

#### Command: `validate_hotp`

**Description:** Validate an HOTP code against a shared secret and counter value.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | string | Yes | - | HOTP code to validate |
| `secret` | string | Yes | - | Base32-encoded shared secret |
| `counter` | integer | Yes | - | Expected counter value |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "7",
  command: "validate_hotp",
  code: "654321",
  secret: "JBSWY3DPEBLW64TMMQ======",
  counter: 42
}));
```

**Success Response (Valid):**

```json
{
  "id": "7",
  "command": "validate_hotp",
  "success": true,
  "data": {
    "valid": true,
    "counter": 42
  }
}
```

**Success Response (Invalid):**

```json
{
  "id": "7",
  "command": "validate_hotp",
  "success": true,
  "data": {
    "valid": false,
    "reason": "Code does not match expected counter"
  }
}
```

**Performance:** 3-4ms latency, <1KB response

**Notes:**
- Counter must match exactly (no skew like TOTP)
- Designed for single-use delivery methods
- Server must increment counter after validation
- Use for SMS/email-based authentication

---

#### Command: `generate_auth_qr`

**Description:** Generate an otpauth:// URI and optional QR code PNG image for provisioning authenticator apps.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `account_name` | string | Yes | - | Email or username (e.g., "user@example.com") |
| `issuer` | string | Yes | - | Service name (e.g., "Basset Hound Browser") |
| `secret` | string | Yes | - | Base32-encoded shared secret |
| `type` | string | No | "totp" | "totp" or "hotp" |
| `digits` | integer | No | 6 | Number of digits (4-8) |
| `period` | integer | No | 30 | Period in seconds (for TOTP) |
| `qr_size` | integer | No | 200 | QR code pixel size (100-500) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "8",
  command: "generate_auth_qr",
  account_name: "user@example.com",
  issuer: "Basset Hound Browser",
  secret: "JBSWY3DPEBLW64TMMQ======",
  type: "totp",
  digits: 6,
  period: 30,
  qr_size: 200
}));
```

**Success Response:**

```json
{
  "id": "8",
  "command": "generate_auth_qr",
  "success": true,
  "data": {
    "uri": "otpauth://totp/Basset%20Hound%20Browser:user@example.com?secret=JBSWY3DPEBLW64TMMQ%3D%3D%3D%3D%3D%3D&issuer=Basset%20Hound%20Browser&algorithm=SHA1&digits=6&period=30",
    "qr_code": "iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAA... (base64 PNG data)",
    "qr_mime": "image/png",
    "manual_entry": "JBSWY3DPEBLW64TMMQ======"
  }
}
```

**Performance:** 5-10ms latency, 10-50KB response (QR code PNG)

**Notes:**
- URI follows RFC 6238 otpauth:// standard
- QR code returned as base64-encoded PNG
- Manual entry (secret) provided as fallback
- Works with Google Authenticator, Authy, Microsoft Authenticator, etc.
- Typical use: Display QR code to user for scanning

---

### SECTION 2: SESSION PERSISTENCE COMMANDS (8 commands)

---

#### Command: `snapshot_session`

**Description:** Create a compressed snapshot of the current session state including cookies, localStorage, sessionStorage, and IndexedDB.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `include_storage` | boolean | No | true | Include localStorage, sessionStorage, IndexedDB |
| `compression_level` | integer | No | 6 | Compression level 0-9 (9 = maximum compression) |
| `exclude_domains` | array | No | [] | Domains to exclude from snapshot |
| `exclude_keys` | array | No | [] | Specific storage keys to exclude |
| `encrypt` | boolean | No | false | Enable AES-256 encryption |
| `password` | string | No | - | Encryption password (required if encrypt=true) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "1",
  command: "snapshot_session",
  include_storage: true,
  compression_level: 9,
  exclude_domains: ["analytics.google.com"],
  exclude_keys: ["password", "api_key"],
  encrypt: false
}));
```

**Success Response:**

```json
{
  "id": "1",
  "command": "snapshot_session",
  "success": true,
  "data": {
    "snapshot_id": "snap_1718424600_abc123",
    "created_at": "2026-06-15T10:30:00Z",
    "uncompressed_size": 850000,
    "compressed_size": 125000,
    "compression_ratio": "85.3%",
    "storage_types": ["cookies", "localStorage", "sessionStorage", "indexedDB"],
    "cookies_count": 45,
    "localStorage_keys": 12,
    "sessionStorage_keys": 8,
    "indexedDB_stores": 3,
    "encrypted": false
  }
}
```

**Performance:** 50-200ms (varies with session size), response <1KB

**Notes:**
- Snapshot automatically compressed (Brotli)
- Large sessions may take longer
- Stored server-side, referenced by snapshot_id
- Encryption optional for sensitive credentials
- Exclude patterns prevent credential leakage

---

#### Command: `restore_session`

**Description:** Restore session from a previous snapshot, optionally merging with current state.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `snapshot_id` | string | Yes | - | ID of snapshot to restore |
| `merge_mode` | string | No | "replace" | "replace" or "merge" |
| `password` | string | No | - | Decryption password (if snapshot encrypted) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "2",
  command: "restore_session",
  snapshot_id: "snap_1718424600_abc123",
  merge_mode: "merge",
  password: null
}));
```

**Success Response:**

```json
{
  "id": "2",
  "command": "restore_session",
  "success": true,
  "data": {
    "snapshot_id": "snap_1718424600_abc123",
    "restored_at": "2026-06-15T10:35:00Z",
    "merge_mode": "merge",
    "items_restored": 245,
    "cookies_restored": 45,
    "localStorage_restored": 12,
    "sessionStorage_restored": 8,
    "indexedDB_restored": 3,
    "merge_conflicts": 0
  }
}
```

**Error Response (Wrong Password):**

```json
{
  "id": "2",
  "command": "restore_session",
  "success": false,
  "error": "Decryption failed: invalid password",
  "error_code": "INVALID_DECRYPTION_PASSWORD"
}
```

**Performance:** 30-150ms (varies with snapshot size)

**Notes:**
- "replace" mode: Current state discarded, snapshot becomes new state
- "merge" mode: New items added, existing items updated, deletions ignored
- Merge conflicts resolved by keeping server-side values
- Restoration affects browser immediately
- Can be used for multi-step workflow recovery

---

#### Command: `list_snapshots`

**Description:** List all available session snapshots with metadata.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `filter` | string | No | - | Filter by snapshot_id pattern |
| `limit` | integer | No | 50 | Maximum snapshots to return |
| `sort` | string | No | "created_desc" | Sort order: created_asc, created_desc, size_asc, size_desc |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "3",
  command: "list_snapshots",
  limit: 10,
  sort: "created_desc"
}));
```

**Success Response:**

```json
{
  "id": "3",
  "command": "list_snapshots",
  "success": true,
  "data": {
    "snapshots": [
      {
        "snapshot_id": "snap_1718424600_abc123",
        "created_at": "2026-06-15T10:30:00Z",
        "compressed_size": 125000,
        "uncompressed_size": 850000,
        "compression_ratio": "85.3%",
        "storage_types": ["cookies", "localStorage", "sessionStorage", "indexedDB"],
        "encrypted": false
      },
      {
        "snapshot_id": "snap_1718424500_xyz789",
        "created_at": "2026-06-15T10:15:00Z",
        "compressed_size": 128000,
        "uncompressed_size": 890000,
        "compression_ratio": "85.6%",
        "storage_types": ["cookies", "localStorage"],
        "encrypted": false
      }
    ],
    "total": 42,
    "returned": 2
  }
}
```

**Performance:** <10ms latency, <50KB response

**Notes:**
- List limited to 50 snapshots by default
- Pagination available via limit/offset pattern
- Useful for audit trails and recovery planning
- Snapshots automatically cleaned up after retention period (default: 30 days)

---

#### Command: `delete_snapshot`

**Description:** Delete a specific session snapshot to free storage space.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `snapshot_id` | string | Yes | - | ID of snapshot to delete |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "4",
  command: "delete_snapshot",
  snapshot_id: "snap_1718424600_abc123"
}));
```

**Success Response:**

```json
{
  "id": "4",
  "command": "delete_snapshot",
  "success": true,
  "data": {
    "snapshot_id": "snap_1718424600_abc123",
    "deleted_at": "2026-06-15T10:40:00Z",
    "freed_space": 125000
  }
}
```

**Error Response (Not Found):**

```json
{
  "id": "4",
  "command": "delete_snapshot",
  "success": false,
  "error": "Snapshot not found",
  "error_code": "SNAPSHOT_NOT_FOUND"
}
```

**Performance:** <5ms latency

**Notes:**
- Deletion is permanent and irreversible
- Useful for cleanup of stale snapshots
- Returns freed space in bytes

---

#### Command: `get_session_size`

**Description:** Get compressed and uncompressed sizes of current session state.

**Parameters:** None

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "5",
  command: "get_session_size"
}));
```

**Success Response:**

```json
{
  "id": "5",
  "command": "get_session_size",
  "success": true,
  "data": {
    "uncompressed_size": 850000,
    "estimated_compressed_size": 127500,
    "compression_ratio": "85.0%",
    "breakdown": {
      "cookies": {
        "uncompressed": 45000,
        "compressed": 10000,
        "ratio": "77.8%"
      },
      "localStorage": {
        "uncompressed": 500000,
        "compressed": 75000,
        "ratio": "85.0%"
      },
      "sessionStorage": {
        "uncompressed": 250000,
        "compressed": 37500,
        "ratio": "85.0%"
      },
      "indexedDB": {
        "uncompressed": 55000,
        "compressed": 5000,
        "ratio": "90.9%"
      }
    }
  }
}
```

**Performance:** 10-50ms latency, <1KB response

**Notes:**
- Estimated compression based on content analysis
- Actual compression may vary ±5%
- Useful for planning snapshot strategies
- Breakdown shows per-storage-type compression

---

#### Command: `configure_persistence`

**Description:** Configure automatic session persistence rules and intervals.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `exclude_domains` | array | No | [] | Domains to always exclude |
| `exclude_keys` | array | No | [] | Storage keys to always exclude |
| `interval_minutes` | integer | No | 5 | Snapshot interval in minutes (1-60) |
| `retention_days` | integer | No | 30 | Snapshot retention in days |
| `compression_level` | integer | No | 6 | Compression level 0-9 |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "6",
  command: "configure_persistence",
  exclude_domains: ["analytics.google.com", "ads.example.com"],
  exclude_keys: ["password", "api_key", "token"],
  interval_minutes: 10,
  retention_days: 30,
  compression_level: 9
}));
```

**Success Response:**

```json
{
  "id": "6",
  "command": "configure_persistence",
  "success": true,
  "data": {
    "exclude_domains": ["analytics.google.com", "ads.example.com"],
    "exclude_keys": ["password", "api_key", "token"],
    "interval_minutes": 10,
    "retention_days": 30,
    "compression_level": 9,
    "next_snapshot_at": "2026-06-15T10:45:00Z"
  }
}
```

**Performance:** <5ms latency

**Notes:**
- Excludes prevent credential leakage
- Automatic snapshots run on schedule
- Old snapshots automatically deleted after retention period
- Can be called multiple times to update configuration

---

#### Command: `auto_persist`

**Description:** Enable or disable automatic session persistence.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `enabled` | boolean | Yes | - | Enable or disable auto-persistence |
| `interval` | integer | No | 5 | Interval in minutes (if enabling) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "7",
  command: "auto_persist",
  enabled: true,
  interval: 5
}));
```

**Success Response:**

```json
{
  "id": "7",
  "command": "auto_persist",
  "success": true,
  "data": {
    "enabled": true,
    "interval_minutes": 5,
    "next_snapshot": "2026-06-15T10:35:00Z",
    "snapshots_created": 12
  }
}
```

**Performance:** <2ms latency

**Notes:**
- Default enabled on connection
- Useful to pause persistence during debugging
- Statistics show cumulative snapshots in session

---

#### Command: `get_persistence_stats`

**Description:** Get compression and timing statistics for session persistence operations.

**Parameters:** None

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "8",
  command: "get_persistence_stats"
}));
```

**Success Response:**

```json
{
  "id": "8",
  "command": "get_persistence_stats",
  "success": true,
  "data": {
    "snapshots_total": 12,
    "snapshots_size_total": 1500000,
    "compression_ratio_average": "85.1%",
    "space_saved": 1275000,
    "snapshot_time_average_ms": 95,
    "restore_time_average_ms": 65,
    "last_snapshot": "2026-06-15T10:30:00Z",
    "auto_persist_enabled": true,
    "auto_persist_interval": 5,
    "next_scheduled": "2026-06-15T10:40:00Z"
  }
}
```

**Performance:** <5ms latency, <1KB response

**Notes:**
- Tracks all persistence operations
- Useful for performance analysis and optimization
- Space saved = sum of compression savings
- Timing averages help predict restore windows

---

### SECTION 3: EXTENDED EVASION VECTOR COMMANDS (6 commands)

---

#### Command: `set_behavioral_profile`

**Description:** Set behavioral simulation profile to mimic human-like interactions.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `profile_name` | string | Yes | - | Profile: "human_researcher", "casual_browser", "power_user", "mobile_user" |
| `intensity` | integer | No | 50 | Profile intensity 0-100 (0=disabled, 100=maximum) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "1",
  command: "set_behavioral_profile",
  profile_name: "human_researcher",
  intensity: 85
}));
```

**Success Response:**

```json
{
  "id": "1",
  "command": "set_behavioral_profile",
  "success": true,
  "data": {
    "profile_name": "human_researcher",
    "intensity": 85,
    "active_vectors": [
      "navigation_timing",
      "scroll_behavior",
      "mouse_movement",
      "typing_speed",
      "network_timing",
      "window_events",
      "memory_pressure",
      "sensor_data"
    ],
    "estimated_effectiveness": 94.2
  }
}
```

**Available Profiles:**

| Profile | Description | Vectors |
|---------|-------------|---------|
| `human_researcher` | Careful, methodical browsing with pauses | 8 vectors, high effectiveness |
| `casual_browser` | Rapid scrolling, quick decisions | 6 vectors, medium effectiveness |
| `power_user` | Fast interactions, minimal pauses | 5 vectors, lower effectiveness |
| `mobile_user` | Touch-based, swipe patterns, slower | 7 vectors, high mobile effectiveness |

**Performance:** 1-2ms latency

**Notes:**
- Each profile uses different vector combinations
- Intensity controls how aggressively vectors are applied
- Effectiveness estimates based on common detection services
- Can be changed mid-session

---

#### Command: `simulate_network_timing`

**Description:** Simulate realistic network timing patterns for fetch/XHR requests.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `latency_ms` | integer | No | 50 | Base latency in milliseconds |
| `jitter_ms` | integer | No | 10 | Latency jitter (±) in milliseconds |
| `packet_loss` | float | No | 0.0 | Packet loss percentage (0.0-5.0) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "2",
  command: "simulate_network_timing",
  latency_ms: 75,
  jitter_ms: 15,
  packet_loss: 0.5
}));
```

**Success Response:**

```json
{
  "id": "2",
  "command": "simulate_network_timing",
  "success": true,
  "data": {
    "latency_ms": 75,
    "jitter_ms": 15,
    "packet_loss": 0.5,
    "average_delay": "75-90ms",
    "realistic_for": "4G Mobile Network"
  }
}
```

**Performance:** <1ms latency

**Notes:**
- Simulates realistic 4G/mobile network conditions
- Affects fetch/XHR response timing
- Does not affect actual network
- Useful for evading network-speed-based detection

---

#### Command: `simulate_scroll_behavior`

**Description:** Set scroll behavior patterns to mimic human scrolling.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `velocity_profile` | string | No | "natural" | "smooth", "natural", "erratic", "slow" |
| `pause_frequency` | integer | No | 3 | Pause frequency per 10 scrolls (0-5) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "3",
  command: "simulate_scroll_behavior",
  velocity_profile: "natural",
  pause_frequency: 3
}));
```

**Success Response:**

```json
{
  "id": "3",
  "command": "simulate_scroll_behavior",
  "success": true,
  "data": {
    "velocity_profile": "natural",
    "pause_frequency": 3,
    "average_speed": "400-600px/sec",
    "pauses_per_10_scrolls": 3,
    "average_pause_duration": "2-5 seconds"
  }
}
```

**Performance:** <1ms latency

**Notes:**
- Velocity profiles affect scrolling speed variations
- Pause frequency mimics reading behavior
- Applied to all future scroll commands
- Can be updated mid-session

---

#### Command: `simulate_typing_speed`

**Description:** Simulate realistic typing speed with fatigue and variation.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `base_wpm` | integer | No | 60 | Base typing speed in words per minute |
| `fatigue_increase` | float | No | 1.5 | Speed increase factor over time (1.0-3.0) |
| `error_rate` | float | No | 0.5 | Typing error percentage (0.0-5.0) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "4",
  command: "simulate_typing_speed",
  base_wpm: 65,
  fatigue_increase: 2.0,
  error_rate: 0.8
}));
```

**Success Response:**

```json
{
  "id": "4",
  "command": "simulate_typing_speed",
  "success": true,
  "data": {
    "base_wpm": 65,
    "base_duration_ms_per_char": 150,
    "fatigue_increase": 2.0,
    "error_rate": 0.8,
    "realistic_for": "average_human_typist"
  }
}
```

**Performance:** <1ms latency

**Notes:**
- WPM converted to milliseconds per character
- Fatigue simulates slower typing as session progresses
- Error rate simulates and corrects typos
- Applied to fill and type_text commands

---

#### Command: `get_evasion_metrics`

**Description:** Get current evasion effectiveness scores and active vectors.

**Parameters:** None

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "5",
  command: "get_evasion_metrics"
}));
```

**Success Response:**

```json
{
  "id": "5",
  "command": "get_evasion_metrics",
  "success": true,
  "data": {
    "overall_effectiveness": 94.2,
    "behavioral_profile": "human_researcher",
    "behavioral_intensity": 85,
    "active_vectors": [
      "navigation_timing",
      "scroll_behavior",
      "mouse_movement",
      "typing_speed",
      "network_timing",
      "window_events",
      "memory_pressure",
      "sensor_data"
    ],
    "per_service": {
      "datadome": 94.0,
      "cloudflare": 95.0,
      "imperva": 93.5,
      "perimeterx": 91.8,
      "akamai": 92.5
    }
  }
}
```

**Performance:** 2-3ms latency, <1KB response

**Notes:**
- Effectiveness scores estimated from vector analysis
- Per-service scores based on known detection patterns
- Scores updated after behavioral profile changes
- Useful for optimization decisions

---

#### Command: `test_detection_vectors`

**Description:** Test current evasion vectors against known detection patterns for specific services.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `service_name` | string | Yes | - | Service: "datadome", "cloudflare", "imperva", "perimeterx", "akamai" |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "6",
  command: "test_detection_vectors",
  service_name: "cloudflare"
}));
```

**Success Response:**

```json
{
  "id": "6",
  "command": "test_detection_vectors",
  "success": true,
  "data": {
    "service": "cloudflare",
    "test_timestamp": "2026-06-15T10:30:00Z",
    "total_vectors_tested": 12,
    "vectors_passed": 12,
    "vectors_failed": 0,
    "pass_rate": "100.0%",
    "confidence_score": 98.5,
    "detected_vectors": [],
    "failed_vectors": [],
    "recommendations": []
  }
}
```

**Success Response (With Failures):**

```json
{
  "id": "6",
  "command": "test_detection_vectors",
  "success": true,
  "data": {
    "service": "cloudflare",
    "test_timestamp": "2026-06-15T10:30:00Z",
    "total_vectors_tested": 12,
    "vectors_passed": 11,
    "vectors_failed": 1,
    "pass_rate": "91.7%",
    "confidence_score": 87.3,
    "detected_vectors": ["webgl_extensions"],
    "failed_vectors": ["webgl_extensions"],
    "recommendations": [
      "Review WebGL extension list configuration",
      "Consider disabling 3D canvas operations",
      "Use mobile device profile instead"
    ]
  }
}
```

**Performance:** 100-500ms latency (includes detection service testing)

**Notes:**
- Runs actual detection patterns against current configuration
- Confidence score indicates reliability of test results
- Recommendations suggest specific fixes
- Can be run multiple times to track improvements
- Results may vary based on current behavioral profile

---

### SECTION 4: MONITORING & METRICS COMMANDS (6 commands)

---

#### Command: `get_metrics`

**Description:** Get current system performance metrics in real-time.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `metric_names` | array | No | [] | Specific metrics to return (all if empty) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "1",
  command: "get_metrics"
}));
```

**Success Response:**

```json
{
  "id": "1",
  "command": "get_metrics",
  "success": true,
  "data": {
    "timestamp": "2026-06-15T10:30:45Z",
    "cpu_usage": 12.4,
    "memory_rss": 285,
    "memory_heap": 156,
    "memory_external": 28,
    "uptime_seconds": 3600,
    "command_count": 15234,
    "error_count": 12,
    "error_rate": 0.08,
    "p50_latency": 0.8,
    "p95_latency": 2.1,
    "p99_latency": 4.8,
    "websocket_connections": 5,
    "gc_pauses_total_ms": 245,
    "health_status": "healthy"
  }
}
```

**Metrics Description:**

| Metric | Unit | Description |
|--------|------|-------------|
| `cpu_usage` | % | Current process CPU (0-100%) |
| `memory_rss` | MB | Resident set size memory |
| `memory_heap` | MB | V8 JavaScript heap usage |
| `memory_external` | MB | Native memory external to heap |
| `uptime_seconds` | sec | Process uptime in seconds |
| `command_count` | count | Total commands processed |
| `error_count` | count | Total commands with errors |
| `error_rate` | % | Error percentage in last minute |
| `p50_latency` | ms | Median command latency |
| `p95_latency` | ms | 95th percentile latency |
| `p99_latency` | ms | 99th percentile latency |
| `websocket_connections` | count | Active WebSocket connections |
| `gc_pauses_total_ms` | ms | Total garbage collection pause time |
| `health_status` | string | "healthy", "degraded", "critical" |

**Performance:** <2ms latency, <1KB response

**Notes:**
- Latency metrics reset hourly
- Memory metrics updated every 10 seconds
- CPU usage averaged over 1 minute
- Error rate calculated from last 100 commands

---

#### Command: `get_command_stats`

**Description:** Get performance statistics for specific commands or all commands.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `command_name` | string | No | - | Specific command (all if omitted) |
| `time_window` | string | No | "1hour" | "1min", "5min", "1hour", "24hour" |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "2",
  command: "get_command_stats",
  command_name: "navigate",
  time_window: "1hour"
}));
```

**Success Response:**

```json
{
  "id": "2",
  "command": "get_command_stats",
  "success": true,
  "data": {
    "command_name": "navigate",
    "time_window": "1hour",
    "count": 156,
    "success_count": 155,
    "error_count": 1,
    "success_rate": "99.4%",
    "latency_min": 100,
    "latency_max": 5200,
    "latency_avg": 1250,
    "latency_p50": 1100,
    "latency_p95": 3200,
    "latency_p99": 4800,
    "memory_impact_avg_mb": 15.2
  }
}
```

**Performance:** 5-10ms latency, <1KB response

**Notes:**
- Statistics per command type
- Time window filters historical data
- Success rate helps identify problematic commands
- Memory impact shows cleanup efficiency

---

#### Command: `enable_metrics`

**Description:** Enable metric collection for specific metric types or all.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `metric_types` | array | No | [] | Metric types to enable (all if empty) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "3",
  command: "enable_metrics",
  metric_types: ["cpu_usage", "memory_rss", "p99_latency"]
}));
```

**Success Response:**

```json
{
  "id": "3",
  "command": "enable_metrics",
  "success": true,
  "data": {
    "enabled": true,
    "metric_types": ["cpu_usage", "memory_rss", "p99_latency"],
    "collection_overhead": "0.3%"
  }
}
```

**Performance:** <1ms latency

**Notes:**
- Default: all metrics enabled
- Disabling unused metrics reduces overhead slightly
- Useful for debugging performance issues

---

#### Command: `disable_metrics`

**Description:** Disable metric collection to reduce overhead.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `metric_types` | array | No | [] | Metric types to disable (all if empty) |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "4",
  command: "disable_metrics",
  metric_types: ["cpu_usage"]
}));
```

**Success Response:**

```json
{
  "id": "4",
  "command": "disable_metrics",
  "success": true,
  "data": {
    "disabled_types": ["cpu_usage"],
    "collection_overhead": "0.2%",
    "active_metrics": ["memory_rss", "memory_heap", "p99_latency", "websocket_connections"]
  }
}
```

**Performance:** <1ms latency

**Notes:**
- Minimal performance gain from disabling individual metrics
- Disable all metrics not recommended (lose visibility)

---

#### Command: `get_health_status`

**Description:** Get comprehensive system health status summary.

**Parameters:** None

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "5",
  command: "get_health_status"
}));
```

**Success Response (Healthy):**

```json
{
  "id": "5",
  "command": "get_health_status",
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-06-15T10:30:45Z",
    "checks": {
      "websocket_connectivity": "ok",
      "memory_usage": "ok",
      "cpu_usage": "ok",
      "error_rate": "ok",
      "gc_pauses": "ok",
      "uptime": "ok"
    },
    "metrics_summary": {
      "cpu_usage": 12.4,
      "memory_rss": 285,
      "error_rate": 0.08,
      "p99_latency": 4.8
    },
    "alerts": []
  }
}
```

**Success Response (Degraded):**

```json
{
  "id": "5",
  "command": "get_health_status",
  "success": true,
  "data": {
    "status": "degraded",
    "timestamp": "2026-06-15T10:30:45Z",
    "checks": {
      "websocket_connectivity": "ok",
      "memory_usage": "warning",
      "cpu_usage": "ok",
      "error_rate": "ok",
      "gc_pauses": "warning",
      "uptime": "ok"
    },
    "alerts": [
      "Memory usage above 80% (current: 450MB)",
      "GC pauses high (last 5min: 1245ms total)"
    ]
  }
}
```

**Performance:** <5ms latency, <1KB response

**Notes:**
- Status: "healthy", "degraded", "critical"
- Alerts help identify issues before they become critical
- Checks run automatically
- Good for monitoring dashboards

---

#### Command: `export_metrics`

**Description:** Export metrics in various formats for external monitoring systems.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `format` | string | Yes | - | Format: "json", "prometheus", "influxdb" |
| `time_range` | string | No | "1hour" | "1min", "5min", "1hour", "24hour" |

**Request:**

```javascript
ws.send(JSON.stringify({
  id: "6",
  command: "export_metrics",
  format: "prometheus",
  time_range: "1hour"
}));
```

**Success Response (Prometheus Format):**

```
basset_cpu_usage 12.4
basset_memory_rss 285
basset_memory_heap 156
basset_uptime_seconds 3600
basset_command_count 15234
basset_error_rate 0.08
basset_p99_latency 4.8
basset_websocket_connections 5
basset_health_status{status="healthy"} 1
# HELP basset_command_stats Command performance statistics
# TYPE basset_command_stats gauge
basset_command_stats{command="navigate",latency_p99="4800"} 156
basset_command_stats{command="click",latency_p99="2100"} 432
```

**Success Response (InfluxDB Format):**

```
basset_metrics,host=production cpu_usage=12.4,memory_rss=285,memory_heap=156,uptime_seconds=3600,command_count=15234,error_rate=0.08,p99_latency=4.8 1718425845000
```

**Success Response (JSON Format):**

```json
{
  "format": "json",
  "time_range": "1hour",
  "timestamp": "2026-06-15T10:30:45Z",
  "metrics": [
    {"name": "cpu_usage", "value": 12.4, "unit": "%"},
    {"name": "memory_rss", "value": 285, "unit": "MB"},
    ...
  ],
  "command_stats": [
    {"command": "navigate", "count": 156, "latency_p99": 4800}
  ]
}
```

**Performance:** 10-50ms latency (varies with format and data volume)

**Notes:**
- Prometheus format suitable for Prometheus scrape
- InfluxDB format suitable for InfluxDB line protocol
- JSON format suitable for custom processing
- Used for integration with monitoring systems
- Grafana compatible (Prometheus format)

---

## COMMON USAGE PATTERNS

### Pattern 1: Multi-Factor Authentication with TOTP

```javascript
// 1. Generate QR code for user to scan
const qrResponse = await client.generateAuthQr({
  account_name: 'user@example.com',
  issuer: 'My App',
  secret: generateSecret()
});
// Display QR code to user

// 2. Later, validate TOTP code from user
const validResponse = await client.validateTotp({
  code: userEnteredCode,
  secret: sharedSecret
});

if (validResponse.data.valid) {
  // Authentication successful
}
```

### Pattern 2: Session Persistence for Multi-Step Workflows

```javascript
// 1. Start workflow
await client.navigate('https://example.com/login');
await client.fill('#username', username);
await client.fill('#password', password);
await client.click('#login');

// 2. Save session state
const snapshot = await client.snapshotSession();
sessionSnapshotId = snapshot.data.snapshot_id;

// 3. Later: Restore from snapshot
await client.restoreSession(sessionSnapshotId, 'merge');

// 4. Continue workflow without re-login
await client.navigate('https://example.com/checkout');
```

### Pattern 3: Evasion Testing and Optimization

```javascript
// 1. Set behavioral profile
await client.setBehavioralProfile('human_researcher', 85);

// 2. Run your automation
// ... perform automated tasks ...

// 3. Test against detection services
const testResults = await client.testDetectionVectors('cloudflare');

// 4. Adjust if needed
if (testResults.data.pass_rate < 90) {
  await client.setBehavioralProfile('human_researcher', 100);
}
```

### Pattern 4: Performance Monitoring and Alerting

```javascript
// 1. Enable metrics
await client.enableMetrics();

// 2. Periodically check health
setInterval(async () => {
  const health = await client.getHealthStatus();
  
  if (health.data.status !== 'healthy') {
    console.warn('Health degraded:', health.data.alerts);
    // Take remedial action
  }
}, 60000);  // Every minute

// 3. Export to monitoring system
const metrics = await client.exportMetrics('prometheus');
// Send to Prometheus server
```

---

## ERROR CODES

### Credential Commands
- `INVALID_SECRET_FORMAT` - Base32 secret is malformed
- `INVALID_COUNTER` - HOTP counter not a valid integer
- `INVALID_CODE_FORMAT` - Code doesn't match expected format
- `DECRYPTION_FAILED` - Wrong password for encrypted credentials

### Session Commands
- `SNAPSHOT_NOT_FOUND` - Snapshot ID doesn't exist
- `SNAPSHOT_EXPIRED` - Snapshot older than retention period
- `INVALID_MERGE_MODE` - Merge mode not "replace" or "merge"
- `RESTORE_FAILED` - Error during session restoration

### Evasion Commands
- `INVALID_PROFILE` - Profile name not recognized
- `INTENSITY_OUT_OF_RANGE` - Intensity not 0-100
- `INVALID_SERVICE` - Service name not recognized
- `TEST_TIMEOUT` - Detection test exceeded time limit

### Monitoring Commands
- `METRICS_DISABLED` - Requested metrics not being collected
- `INVALID_TIME_WINDOW` - Time window not recognized
- `EXPORT_FORMAT_UNSUPPORTED` - Format not supported

---

## PERFORMANCE CHARACTERISTICS

### Command Latencies (P99)

| Command | Latency | Notes |
|---------|---------|-------|
| `generate_totp` | 2-3ms | Lightweight crypto |
| `generate_hotp` | 2-3ms | Lightweight crypto |
| `snapshot_session` | 50-200ms | Depends on session size |
| `restore_session` | 30-150ms | Depends on snapshot size |
| `set_behavioral_profile` | 1-2ms | Profile switching |
| `test_detection_vectors` | 100-500ms | External service testing |
| `get_metrics` | <2ms | Local metrics collection |
| `export_metrics` | 10-50ms | Format conversion |

### Resource Usage

- **CPU impact:** <2% for all new features
- **Memory impact:** +2% baseline (+8-12MB)
- **Disk impact:** Snapshots stored on disk, retention configurable
- **Network impact:** None (all operations local)

---

## BACKWARD COMPATIBILITY

**v12.7.0 is 100% backward compatible with v12.5.0:**

- All existing 164 commands work unchanged
- No breaking changes to response formats
- All v12.5.0 documentation remains valid
- No migration required for existing clients
- New commands are opt-in

---

**Basset Hound Browser API Reference - v12.7.0**
**Last Updated: June 15, 2026**
