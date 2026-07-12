# Path Traversal Prevention Guide

**Version:** 12.1.0  
**Status:** Production Ready  
**Last Updated:** May 31, 2026  
**Critical Security Feature - Wave 12**

---

## Table of Contents

1. [Overview](#overview)
2. [What is Path Traversal?](#what-is-path-traversal)
3. [Real-World Impact on Browser Automation](#real-world-impact-on-browser-automation)
4. [How Basset Hound Prevents Path Traversal](#how-basset-hound-prevents-path-traversal)
5. [Implementation Details](#implementation-details)
6. [Configuration and Verification](#configuration-and-verification)
7. [Testing Path Traversal Prevention](#testing-path-traversal-prevention)
8. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
9. [Compliance Implications](#compliance-implications)
10. [Related Security Features](#related-security-features)

---

## Overview

Path traversal (also known as directory traversal) is a critical security vulnerability that allows attackers to access files and directories outside the intended scope. In Basset Hound Browser, which operates with file system access via the WebSocket API, path traversal prevention is essential to ensure that:

- Browser automation commands cannot escape sandboxed directories
- User data remains isolated between profiles
- System files remain protected from automated access
- Download operations are restricted to designated locations

This guide details how Basset Hound prevents path traversal attacks and how to configure and verify these protections.

---

## What is Path Traversal?

### Definition

Path traversal is a vulnerability where user input containing path navigation sequences (like `../`) is used to access files outside the intended directory structure.

### Common Attack Sequences

Attackers use various patterns to navigate the file system:

```
../                              # Parent directory
..\\                             # Windows path traversal
....//                           # Double-encoded traversal
..%2f                            # URL-encoded traversal
..%252f                          # Double URL-encoded
....\                            # Backslash variants
%00                              # Null byte (legacy)
/etc/passwd                      # Absolute paths
../../etc/shadow                 # Multi-level traversal
```

### Example Attack Scenarios

**Scenario 1: Download Directory Escape**
```javascript
// Malicious command attempting to write to parent directory
{
  "command": "download_file",
  "url": "https://example.com/malicious.exe",
  "path": "../../windows/system32/malicious.exe"  // BLOCKED
}
```

**Scenario 2: Cookie File Access**
```javascript
// Attempting to read another profile's cookies
{
  "command": "get_cookies",
  "profile": "default",
  "path": "../../../other_profile/cookies.json"  // BLOCKED
}
```

**Scenario 3: Configuration File Manipulation**
```javascript
// Attempting to modify system configuration
{
  "command": "execute_script",
  "script": "readFile('../../config/system.conf')"  // BLOCKED
}
```

---

## Real-World Impact on Browser Automation

### Why Path Traversal Matters for Basset Hound

Basset Hound Browser provides powerful file system access through its WebSocket API:

- **Download Management**: Files are saved to configured directories
- **Profile Management**: Each profile maintains isolated cookies, storage, and data
- **Script Execution**: JavaScript execution can access local files
- **Session Recording**: Session data is stored on disk
- **Evidence Export**: Forensic data is exported to files

If path traversal is not prevented, an attacker could:

1. **Escape Download Sandbox** - Save malicious files to system directories
2. **Access Other Profiles** - Read sensitive data from other browser profiles
3. **Modify Configuration** - Change browser settings or security policies
4. **Exfiltrate Data** - Access and copy sensitive files from the system
5. **Execute Malicious Code** - Place scripts in startup directories

### Attack Surface in Basset Hound

Commands susceptible to path traversal attacks:

- `download_file` - File writing operations
- `upload_profile` - Profile import operations
- `load_script` - Script loading from disk
- `export_session` - Session data export
- `get_file` - File reading operations
- `save_cookies` - Cookie export operations
- `execute_script` - Dynamic file access via JavaScript

---

## How Basset Hound Prevents Path Traversal

### Multi-Layer Defense Strategy

Basset Hound implements path traversal prevention through five complementary layers:

#### Layer 1: Path Normalization and Validation

All file paths are normalized to remove traversal sequences:

```javascript
// Input: "../../sensitive/file.txt"
// Normalized: "sensitive/file.txt"
// Canonical: "/safe/directory/sensitive/file.txt"
```

The system:
- Resolves all `..` sequences
- Converts backslashes to forward slashes (Windows compatibility)
- Handles URL-encoded sequences (`%2f`, `%2e`)
- Resolves double-encoded sequences
- Removes null bytes (`%00`)

#### Layer 2: Sandbox Directory Enforcement

Every file operation is restricted to a designated sandbox directory:

```javascript
// Safe directory: /home/user/.basset-hound/profiles/default/
// Requested file: ../../../etc/passwd
// 
// After normalization and validation:
// Resolved path: /etc/passwd
// Is under safe dir? NO ❌ BLOCKED
```

The system verifies that the final resolved path is within the sandbox:

```javascript
function isSafePath(requestedPath, sandboxDir) {
  const resolvedPath = path.resolve(sandboxDir, requestedPath);
  const normalized = path.normalize(resolvedPath);
  
  return normalized.startsWith(path.normalize(sandboxDir));
}
```

#### Layer 3: Input Validation and Sanitization

All user-provided paths are validated before processing:

- **Whitelist Characters**: Only alphanumeric, hyphen, underscore, slash, dot
- **Disallow Patterns**: Rejects sequences like `..`, `~`, environment variables
- **Length Limits**: Maximum path length enforced
- **Encoding Validation**: Detects and rejects suspicious encoding patterns

```javascript
// Validation rules
const DANGEROUS_PATTERNS = [
  /\.\.\//,           // ../
  /\.\.\\/,           // ..\
  /^~\//,             // ~/
  /\$\{.*\}/,         // ${...}
  /%00/,              // Null byte
  /[<>"|?*\x00-\x1f]/ // Invalid characters
];

function validatePath(input) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      throw new Error(`Invalid path: contains dangerous pattern`);
    }
  }
}
```

#### Layer 4: Profile-Level Isolation

Browser profiles are isolated from each other:

```javascript
// Each profile has its own sandbox
/home/user/.basset-hound/
├── profiles/
│   ├── default/          # Isolated sandbox
│   │   ├── cookies.json
│   │   ├── storage/
│   │   └── downloads/
│   ├── social_media/     # Isolated sandbox
│   │   ├── cookies.json
│   │   ├── storage/
│   │   └── downloads/
│   └── research/         # Isolated sandbox
```

File operations in one profile cannot access another profile's files:

```javascript
// Profile: 'default'
// Requested path: 'cookies.json'
// 
// Safe directory: /home/user/.basset-hound/profiles/default/
// Resolved: /home/user/.basset-hound/profiles/default/cookies.json ✅
//
// Requested path: '../social_media/cookies.json'
// Resolved: /home/user/.basset-hound/profiles/social_media/cookies.json ❌ BLOCKED
```

#### Layer 5: Command Authorization and Rate Limiting

File operations require proper authorization:

- **HMAC Signatures**: Every file operation request must be signed
- **Command Authorization**: Only authorized commands can access files
- **Rate Limiting**: Excessive file operation requests are rate-limited
- **Audit Logging**: All file operations are logged for compliance

See Command Authorization Guide for details.

---

## Implementation Details

### Technical Architecture

#### Path Resolution Flow

```
User Request
    ↓
1. Input Validation
    - Check for dangerous patterns
    - Validate encoding
    ↓ (Pass)
2. Path Normalization
    - Resolve .. sequences
    - Decode URL encoding
    - Normalize separators
    ↓
3. Absolute Path Resolution
    - Resolve relative paths using sandbox base
    ↓
4. Sandbox Verification
    - Verify path is within sandbox
    ↓ (Pass)
5. Stat Check (security check)
    - Verify file exists and type
    - Verify permissions
    ↓ (Pass)
6. Audit Log
    - Log file operation
    ↓
7. Execute Operation
    - Read/Write/Delete file
```

### Code Examples

#### Safe File Read Implementation

```javascript
const path = require('path');
const fs = require('fs').promises;

async function safeReadFile(sandboxDir, userPath) {
  try {
    // Layer 1: Validate input
    validatePathInput(userPath);
    
    // Layer 2: Normalize path
    const normalized = path.normalize(userPath);
    
    // Layer 3: Resolve against sandbox
    const resolved = path.resolve(sandboxDir, normalized);
    
    // Layer 4: Verify within sandbox
    const real = await fs.realpath(resolved);
    const realSandbox = await fs.realpath(sandboxDir);
    
    if (!real.startsWith(realSandbox + path.sep) && 
        real !== realSandbox) {
      throw new Error('Path traversal attempt detected');
    }
    
    // Layer 5: Check file permissions
    const stats = await fs.stat(real);
    if (!stats.isFile()) {
      throw new Error('Not a file');
    }
    
    // Layer 6: Audit log
    auditLog('FILE_READ', { path: real, profile: sandboxDir });
    
    // Layer 7: Read file
    return await fs.readFile(real, 'utf-8');
  } catch (error) {
    auditLog('FILE_READ_FAILED', { 
      path: userPath, 
      reason: error.message 
    });
    throw error;
  }
}

function validatePathInput(userPath) {
  // Check length
  if (userPath.length > 1024) {
    throw new Error('Path too long');
  }
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /\.\./,              // Parent directory
    /^\//, /^[a-z]:/,   // Absolute paths
    /\$\{/, /\$\(/,     // Variable expansion
    /`/,                 // Command substitution
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(userPath)) {
      throw new Error('Invalid path pattern detected');
    }
  }
  
  // Check for null bytes
  if (userPath.includes('\0')) {
    throw new Error('Null byte in path');
  }
}
```

#### Safe Download Implementation

```javascript
async function safeDownloadFile(profile, url, filename) {
  try {
    // Get profile's download sandbox
    const downloadDir = getProfileDownloadDir(profile);
    
    // Validate filename (not full path)
    if (!filename || filename.includes('/') || 
        filename.includes('\\') || filename.includes('..')) {
      throw new Error('Invalid filename');
    }
    
    // Create safe download path
    const downloadPath = path.join(downloadDir, filename);
    
    // Verify it's still in sandbox
    const resolved = await fs.realpath(path.dirname(downloadPath));
    const sandboxReal = await fs.realpath(downloadDir);
    
    if (!resolved.startsWith(sandboxReal)) {
      throw new Error('Download path outside sandbox');
    }
    
    // Perform download
    const response = await fetch(url);
    const buffer = await response.buffer();
    await fs.writeFile(downloadPath, buffer);
    
    // Audit log
    auditLog('DOWNLOAD', { 
      url, 
      path: downloadPath, 
      profile,
      size: buffer.length 
    });
    
    return { success: true, path: downloadPath };
  } catch (error) {
    auditLog('DOWNLOAD_FAILED', { url, filename, reason: error.message });
    throw error;
  }
}
```

### Security Boundaries

#### Protected Resources

The following are protected from path traversal attacks:

1. **System Directories**
   - `/bin`, `/sbin`, `/usr/bin`, `/usr/sbin`
   - `/etc`, `/sys`, `/proc`
   - Windows: `C:\Windows`, `C:\Program Files`

2. **User Home Directory**
   - Files outside `.basset-hound` directory
   - SSH keys, credentials
   - Other application data

3. **Other Profiles' Directories**
   - Cross-profile file access blocked
   - Cookies and storage isolated

4. **System Configuration**
   - Tor configuration files
   - Browser configuration files
   - Security settings

#### Protected Operations

1. **Download Operations** - Files saved only to designated download folder
2. **Script Loading** - Scripts loaded only from profile's script directory
3. **Profile Import** - Profile data imported to isolated profile directory
4. **Session Export** - Session data exported to profile directory only
5. **Evidence Export** - Evidence stored in forensics sandbox

---

## Configuration and Verification

### Default Configuration

Basset Hound comes with secure defaults:

```javascript
// Default sandbox directories
const DEFAULT_SANDBOXES = {
  downloads: '~/.basset-hound/profiles/{profile}/downloads/',
  scripts: '~/.basset-hound/profiles/{profile}/scripts/',
  profiles: '~/.basset-hound/profiles/{profile}/',
  sessions: '~/.basset-hound/sessions/',
  evidence: '~/.basset-hound/evidence/',
  temp: '~/.basset-hound/temp/'
};

// Default validation rules
const VALIDATION_CONFIG = {
  maxPathLength: 1024,
  maxFilenameLength: 255,
  allowedCharacters: /^[a-zA-Z0-9._\-\/]*$/,
  blockAbsolutePaths: true,
  blockSymlinks: false,  // Note: symlinks are analyzed, not followed
  enableAuditLog: true
};
```

### Verifying Configuration

Check that path traversal prevention is enabled:

```bash
# Check for audit logs of blocked attempts
tail -f ~/.basset-hound/logs/security.log | grep "PATH_TRAVERSAL"

# Verify sandbox directories exist and are correct
ls -la ~/.basset-hound/profiles/default/

# Check file permissions (should be 700 or 755)
stat ~/.basset-hound/profiles/default/
```

### WebSocket Command Testing

Test path traversal prevention via the WebSocket API:

```python
import json
import asyncio
import websockets

async def test_path_traversal():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Test 1: Normal path (should succeed)
        cmd = {
            "id": "1",
            "command": "get_file",
            "profile": "default",
            "path": "data/myfile.txt"
        }
        await ws.send(json.dumps(cmd))
        response = json.loads(await ws.recv())
        print(f"Test 1 (normal): {response}")
        
        # Test 2: Path traversal attempt (should be blocked)
        cmd = {
            "id": "2",
            "command": "get_file",
            "profile": "default",
            "path": "../../etc/passwd"
        }
        await ws.send(json.dumps(cmd))
        response = json.loads(await ws.recv())
        print(f"Test 2 (traversal): {response}")
        # Expected: error about invalid path

asyncio.run(test_path_traversal())
```

---

## Testing Path Traversal Prevention

### Unit Tests

Basset Hound includes comprehensive unit tests for path traversal prevention:

```bash
# Run path traversal tests
npm test -- tests/unit/security/path-traversal.test.js

# Test output
PASS tests/unit/security/path-traversal.test.js
  Path Traversal Prevention
    ✓ allows normal paths (5ms)
    ✓ blocks .. sequences (3ms)
    ✓ blocks absolute paths (2ms)
    ✓ blocks encoded sequences (4ms)
    ✓ blocks double-encoded sequences (3ms)
    ✓ blocks null bytes (2ms)
    ✓ validates symlinks (8ms)
    ✓ prevents cross-profile access (6ms)
```

### Integration Tests

Test path traversal prevention in real WebSocket scenarios:

```bash
# Run integration tests
npm test -- tests/integration/security/path-traversal-integration.test.js

# Tests cover:
# - File download with path traversal
# - Profile import with path traversal
# - Script loading with path traversal
# - Cookie import/export with path traversal
# - Session export with path traversal
```

### Manual Testing Checklist

```markdown
## Path Traversal Prevention Manual Test Checklist

### Download Operations
- [ ] Normal download saves to downloads folder
- [ ] Download with ../ in filename is blocked
- [ ] Download with absolute path is blocked
- [ ] Download with %2e%2e/ is blocked

### File Operations
- [ ] Read file from profile works
- [ ] Read file with ../ is blocked
- [ ] Read file from other profile is blocked
- [ ] Read system file is blocked

### Profile Operations
- [ ] Create profile succeeds
- [ ] Import profile with ../ in path is blocked
- [ ] Switch between profiles works
- [ ] Profile isolation verified

### Script Execution
- [ ] Load script from scripts folder works
- [ ] Load script from parent directory is blocked
- [ ] Execute script that accesses ../ is blocked

### Audit Logging
- [ ] Successful operations are logged
- [ ] Blocked operations are logged
- [ ] Log entries include path and reason
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Only Blocking `../`

**Wrong:**
```javascript
function isSafePath(path) {
  return !path.includes('../');  // Insufficient!
}
```

**Why it fails:** Doesn't catch:
- `..\\` (Windows)
- `....//` (double encoding)
- `..%2f` (URL encoding)
- Symlinks to parent directories

**Right:**
```javascript
// Normalize first, then verify within sandbox
const normalized = path.normalize(userPath);
const resolved = path.resolve(sandboxDir, normalized);
return resolved.startsWith(sandboxDir);
```

### ❌ Mistake 2: Trusting User Input Without Validation

**Wrong:**
```javascript
async function saveFile(dir, name, content) {
  const fullPath = path.join(dir, name);  // No validation!
  await fs.writeFile(fullPath, content);
}
```

**Right:**
```javascript
async function saveFile(dir, name, content) {
  // Validate name
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Invalid filename');
  }
  const fullPath = path.join(dir, name);
  // Verify still in sandbox
  const resolved = await fs.realpath(fullPath);
  if (!resolved.startsWith(await fs.realpath(dir))) {
    throw new Error('Path traversal attempt');
  }
  await fs.writeFile(fullPath, content);
}
```

### ❌ Mistake 3: Following Symlinks

**Wrong:**
```javascript
const content = fs.readFileSync(userPath);  // May follow symlink to /etc/passwd
```

**Right:**
```javascript
// Check if path is symlink before reading
const stats = fs.lstatSync(userPath, { throwIfNoEntry: false });
if (stats && stats.isSymbolicLink()) {
  throw new Error('Symlinks not allowed');
}
const content = fs.readFileSync(userPath);
```

### ❌ Mistake 4: Insufficient Encoding Handling

**Wrong:**
```javascript
if (path.includes('..')) {
  throw new Error('Path traversal');
}
// But %2e%2e/ will pass!
```

**Right:**
```javascript
// Decode first
const decoded = decodeURIComponent(userPath);
if (decoded.includes('..')) {
  throw new Error('Path traversal');
}
// Also check double-encoded
const doubleDecoded = decodeURIComponent(decoded);
if (doubleDecoded.includes('..')) {
  throw new Error('Path traversal');
}
```

### ❌ Mistake 5: Not Logging Failed Attempts

**Wrong:**
```javascript
try {
  const file = readFile(userPath);
} catch (e) {
  return { error: 'File not found' };  // Silent failure
}
```

**Right:**
```javascript
try {
  const file = readFile(userPath);
} catch (e) {
  auditLog('FILE_OPERATION_FAILED', {
    path: userPath,
    reason: e.message,
    timestamp: new Date(),
    source: getClientIP()
  });
  return { error: 'Access denied' };
}
```

---

## Compliance Implications

### Regulatory Requirements

Path traversal prevention is required for compliance with:

#### **OWASP Top 10**
- **A01:2021 - Broken Access Control** - Path traversal allows unauthorized file access
- **A03:2021 - Injection** - Path traversal is a type of injection attack

#### **CWE (Common Weakness Enumeration)**
- **CWE-22: Improper Limitation of a Pathname to a Restricted Directory** (Path Traversal)
- Ranked in CWE Top 25

#### **PCI DSS**
- Requirement 6.5.8: Improper access control
- Requirement 10.3: Logging and monitoring of access

#### **ISO/IEC 27001**
- A.14.2.1: Secure development policy
- A.12.4.1: Event logging

### Audit Logging

All file operations are logged for compliance:

```json
{
  "timestamp": "2026-05-31T14:23:45Z",
  "event": "FILE_OPERATION",
  "command": "download_file",
  "profile": "default",
  "requested_path": "../../etc/passwd",
  "result": "BLOCKED",
  "reason": "Path traversal attempt detected",
  "blocked_pattern": "..",
  "client_ip": "127.0.0.1",
  "authorization_header_present": true,
  "hmac_valid": true
}
```

### Incident Response

If path traversal attempts are detected:

1. **Alert**: Security team is notified of suspicious activity
2. **Block**: Client may be rate-limited or blocked
3. **Investigate**: Review audit logs and access patterns
4. **Remediate**: Update firewall rules or client configuration if needed

---

## Related Security Features

For a complete security picture, see these related features:

### 🔒 Command Authorization
- HMAC-based request signing
- Role-based access control
- Per-command authorization

**Guide:** COMMAND-AUTHORIZATION.md

### 🔒 Input Validation Framework
- Comprehensive sanitization
- Type checking
- Format validation

**Guide:** [INPUT-VALIDATION-GUIDE.md](../guides/user-guides/VALIDATION-INTEGRATION-GUIDE.md)

### 🔒 JavaScript Execution Safety
- Sandboxed execution environment
- Resource limits
- API restrictions

**Guide:** JS-EXECUTOR-SAFETY.md

### 🔒 HMAC Authentication
- Request signing
- Replay attack prevention
- Integrity verification

**Guide:** HMAC-AUTHENTICATION.md

### 🔒 Data Cleaning
- Sensitive data redaction
- Log sanitization
- Export data masking

**Guide:** DATA-CLEANING.md

---

## Quick Reference

### Test Path Traversal Prevention

```bash
# Quick security check
npm test -- --testNamePattern="path traversal"

# Manual test against running instance
curl -X POST http://localhost:8765 \
  -d '{"command":"get_file","path":"../../etc/passwd"}' \
  -H "Content-Type: application/json"
# Expected: error response
```

### Common Patterns Blocked

| Pattern | Detection |
|---------|-----------|
| `../` | Parent directory |
| `..\\` | Windows path traversal |
| `....//` | Double encoding |
| `..%2f` | URL-encoded traversal |
| `/etc/passwd` | Absolute path |
| `~/.ssh/id_rsa` | Home directory escape |
| `$HOME/file` | Variable expansion |
| `` `cat /etc/passwd` `` | Command substitution |

### Debugging Path Traversal Issues

If legitimate paths are being blocked:

1. **Check the path**: Ensure it doesn't contain `..` or other traversal sequences
2. **Use relative paths**: Use paths relative to the profile's directory
3. **Check URL encoding**: Browser may double-encode paths in requests
4. **Review logs**: Check `/var/log/basset-hound/security.log` for details

Example safe path formats:
```
✅ data/myfile.txt
✅ scripts/automation.js
✅ downloads/document.pdf
✅ ./storage/cookies.json

❌ ../other_profile/data.txt
❌ /etc/passwd
❌ ../../sensitive/file
```

---

## Support and Reporting

For security issues related to path traversal prevention:

1. **Report to Security Team**: security@basset-hound-project.org
2. **Check Audit Logs**: `/var/log/basset-hound/security.log`
3. **Review Documentation**: [Security Index](INDEX.md)
4. **Contact Support**: For operational questions

---

**Document Version:** 12.1.0  
**Last Updated:** May 31, 2026  
**Status:** Production Ready  
**Classification:** Public
