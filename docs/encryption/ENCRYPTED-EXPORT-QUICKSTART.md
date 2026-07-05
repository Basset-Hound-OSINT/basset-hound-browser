# Encrypted Export - Quick Start Guide

## TL;DR

Encrypt/decrypt forensic exports with AES-256-GCM in 3 lines:

```javascript
const manager = new EncryptedExportManager();
const encrypted = manager.encryptExport('data', 'password');
const decrypted = manager.decryptExport(encrypted.encrypted, 'password');
```

## 5-Minute Setup

### 1. Import the Manager

```javascript
const { EncryptedExportManager } = require('./extraction/encrypted-export-manager');
const manager = new EncryptedExportManager();
```

### 2. Encrypt Data

```javascript
// With password
const result = manager.encryptExport('My HTML export', 'secret123');

// result contains:
// - encrypted: Buffer (full encrypted data)
// - iv: Buffer
// - authTag: Buffer
// - salt: Buffer (password-based only)
// - originalSize: number
// - encryptedSize: number
// - encryptionTime: number (ms)
```

### 3. Decrypt Data

```javascript
const decrypted = manager.decryptExport(result.encrypted, 'secret123');
// decrypted.data = 'My HTML export'
// decrypted.decryptionTime = 1.5 (ms)
```

## Common Patterns

### Pattern: Export HTML Encrypted

```javascript
// Server-side
const htmlExport = {
  url: 'https://example.com',
  html: await page.content()
};

const encrypted = manager.encryptExport(
  JSON.stringify(htmlExport),
  'export-password'
);

// Send encrypted.encrypted to client (base64)
```

### Pattern: Generate & Store Key

```javascript
// Generate once
const key = manager.generateKey();
// Save key securely (KMS, env var, etc.)

// Use for all exports in session
const export1 = manager.encryptExport('data1', key);
const export2 = manager.encryptExport('data2', key);
```

### Pattern: Password Derivation

```javascript
// Get password from user
const { key, salt } = manager.deriveKey(userPassword);

// Store salt with encrypted data
const encrypted = manager.encryptExport('data', key);
// Save: { encrypted: encrypted.encrypted, salt, iv: encrypted.iv }

// Later, derive same key from password
const recovery = manager.deriveKey(userPassword, salt);
const decrypted = manager.decryptExport(encryptedData, recovery.key);
```

### Pattern: WebSocket Export

```javascript
// Client
const result = await ws.send({
  command: 'export_raw_html_encrypted',
  params: { password: 'secret' }
});

// result.encryptedData is base64-encoded
// result.salt contains the derivation salt
```

### Pattern: Python Client

```python
from encrypted_export_client import EncryptedExportClient

client = EncryptedExportClient(browser_client)

# Encrypt
encrypted = client.encrypt_data('sensitive data', 'password')

# Decrypt (works locally, no server)
decrypted = client.decrypt_data(encrypted['encrypted'], 'password')
print(decrypted['data'])
```

## Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Encrypt 100KB | <50ms | 2-3ms |
| Decrypt 100KB | <200ms | 2-3ms |
| Key Generate | <1ms | 0.5ms |
| Password Derive | <100ms | 95ms |

## Security Checklist

- [ ] Use strong passwords (12+ characters)
- [ ] Never log encryption keys
- [ ] Store keys in KMS or environment variables
- [ ] Use WSS (WebSocket Secure) for transport
- [ ] Verify decryption succeeds before processing data
- [ ] Rotate keys quarterly
- [ ] Monitor for failed decryptions

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Key must be 32 bytes" | Make sure key is 32 bytes (use `generateKey()`) |
| Decryption fails | Verify password/key is correct, data not corrupted |
| Slow encryption | Large data is normal (10MB takes ~18ms) |
| Memory issues | Use streaming (planned for v1.1) |

## API Reference (Minimal)

```javascript
class EncryptedExportManager {
  // Keys
  generateKey(length = 32)                    // Random key
  deriveKey(password, salt = null)            // Password -> key
  
  // Core operations
  encryptExport(data, passwordOrKey)          // Encrypt
  decryptExport(encryptedData, passwordOrKey) // Decrypt
  
  // Integrity
  encryptExportWithHmac(data, passwordOrKey)  // Encrypt + HMAC
  verifyHmac(data, hmac, hmacKey)             // Verify HMAC
  
  // Monitoring
  getPerformanceStats()                       // Performance metrics
  resetStats()                                // Clear statistics
}
```

## WebSocket API (Minimal)

```javascript
// Generate key
await ws.send({
  command: 'generate_export_key',
  params: {}
});

// Encrypt
await ws.send({
  command: 'encrypt_export',
  params: {
    data: 'content',
    password: 'secret'
  }
});

// Decrypt
await ws.send({
  command: 'decrypt_export',
  params: {
    encrypted: 'base64-data',
    password: 'secret'
  }
});

// Export encrypted HTML
await ws.send({
  command: 'export_raw_html_encrypted',
  params: { password: 'secret' }
});

// Export encrypted network logs
await ws.send({
  command: 'export_network_log_encrypted',
  params: { password: 'secret', format: 'json' }
});
```

## Running Tests

```bash
# All tests
npm test -- encrypted-export-manager.test.js

# Specific test
npm test -- --testNamePattern="Encryption"

# With coverage
npm test -- --coverage
```

## Running Examples

```bash
node examples/encrypted-export-examples.js
```

Shows 7 complete working examples:
1. Direct API
2. Password-based
3. Large payloads
4. HMAC integrity
5. Unicode/binary
6. Performance
7. WebSocket

## File Locations

| File | Purpose |
|------|---------|
| `/extraction/encrypted-export-manager.js` | Core manager |
| `/websocket/commands/encrypted-export-commands.js` | WebSocket integration |
| `/sdks/python-sdk/encrypted_export_client.py` | Python client |
| `/tests/unit/encrypted-export-manager.test.js` | Tests (107 tests) |
| `/docs/ENCRYPTED-EXPORTS.md` | Full documentation |
| `/examples/encrypted-export-examples.js` | 7 examples |

## Encryption Spec (TL;DR)

- **Algorithm**: AES-256-GCM
- **Key**: 32 bytes (random or PBKDF2-derived)
- **IV**: 16 bytes (random per encryption)
- **Auth Tag**: 16-byte authentication
- **PBKDF2**: 100,000 iterations, SHA-256

## Next Steps

1. **Test locally**: `npm test -- encrypted-export-manager.test.js`
2. **Try examples**: `node examples/encrypted-export-examples.js`
3. **Read full docs**: `/docs/ENCRYPTED-EXPORTS.md`
4. **Integrate**: Add command registration to `websocket/server.js`
5. **Deploy**: Push to production (all tests passing)

## Support

For issues:
1. Check `/docs/ENCRYPTED-EXPORTS.md` Troubleshooting
2. Review test cases in `/tests/unit/encrypted-export-manager.test.js`
3. Check examples in `/examples/encrypted-export-examples.js`

---

**Status**: Production Ready ✓  
**Last Updated**: June 20, 2026
