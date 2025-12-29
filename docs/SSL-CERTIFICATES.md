# SSL Certificate Auto-Generation

Basset Hound Browser includes automatic SSL certificate generation for the WebSocket server, enabling secure WSS (WebSocket Secure) connections without requiring manual certificate management.

## Overview

When SSL is enabled for the WebSocket server but no certificate paths are provided, Basset Hound Browser will automatically:

1. **Generate self-signed SSL certificates** on first run
2. **Store certificates** in a local directory next to the application
3. **Reuse certificates** on subsequent runs
4. **Renew certificates** automatically when they expire (< 30 days remaining)

## How It Works

### Certificate Generation Methods

The certificate generator tries multiple methods in order of preference:

1. **OpenSSL** (preferred) - Creates fully compliant X.509 certificates
   - Requires OpenSSL to be installed on the system
   - Generates production-quality certificates

2. **node-forge** (fallback) - Pure JavaScript X.509 generation
   - No external dependencies required
   - Requires `node-forge` package to be installed

3. **Node.js crypto** (last resort) - Simplified certificate structure
   - Uses built-in Node.js crypto module
   - May not work with all SSL clients

### Certificate Storage

Certificates are stored in the following locations:

- **Development mode**: `./certs/` (in project root)
- **Production mode**: `~/.config/basset-hound-browser/certs/` (user data directory)
- **Custom location**: Configure via `server.ssl.certsDir` in config file

### Generated Files

The following files are created:

- `ca-key.pem` - Certificate Authority private key
- `ca.pem` - Certificate Authority certificate
- `key.pem` - Server private key
- `cert.pem` - Server certificate (signed by CA)
- `openssl.cnf` - OpenSSL configuration file (if OpenSSL is used)

## Configuration

### Enable SSL with Auto-Generation

#### Via Config File (config.yaml)

```yaml
server:
  port: 8765
  ssl:
    enabled: true
    # Leave certPath and keyPath empty for auto-generation
    certPath: null
    keyPath: null
    caPath: null
```

#### Via Environment Variables

```bash
export BASSET_WS_SSL_ENABLED=true
# Don't set BASSET_WS_SSL_CERT and BASSET_WS_SSL_KEY for auto-generation
```

#### Via Command Line

```bash
npm start -- --server.ssl.enabled=true
```

### Use Custom Certificates

If you have your own SSL certificates, specify the paths:

```yaml
server:
  ssl:
    enabled: true
    certPath: /path/to/your/cert.pem
    keyPath: /path/to/your/key.pem
    caPath: /path/to/your/ca.pem  # Optional
```

### Custom Certificate Directory

Specify a custom location for auto-generated certificates:

```yaml
server:
  ssl:
    enabled: true
    certsDir: /custom/path/to/certs
```

## Certificate Details

### Certificate Properties

Auto-generated certificates include:

- **Validity**: 365 days (configurable)
- **Key Size**: 2048-bit RSA (configurable)
- **Algorithm**: SHA-256
- **Organization**: "Basset Hound Browser"
- **Common Name**: "localhost"
- **Subject Alternative Names**:
  - DNS: localhost, *.localhost
  - IP: 127.0.0.1, ::1

### Certificate Chain

The auto-generated certificates form a simple chain:

```
Root CA (self-signed)
  └── Server Certificate (signed by Root CA)
```

## Connecting to WSS Server

### Trust the Self-Signed Certificate

Since auto-generated certificates are self-signed, clients must trust them:

#### Node.js/JavaScript Client

```javascript
const WebSocket = require('ws');
const fs = require('fs');

// Option 1: Disable certificate validation (NOT recommended for production)
const ws = new WebSocket('wss://localhost:8765', {
  rejectUnauthorized: false
});

// Option 2: Trust the CA certificate
const ws = new WebSocket('wss://localhost:8765', {
  ca: fs.readFileSync('/path/to/ca.pem')
});
```

#### Python Client

```python
import websockets
import ssl
import asyncio

# Option 1: Disable certificate validation (NOT recommended for production)
ssl_context = ssl._create_unverified_context()

async with websockets.connect('wss://localhost:8765', ssl=ssl_context) as ws:
    await ws.send('{"command": "ping"}')

# Option 2: Trust the CA certificate
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ssl_context.load_verify_locations('/path/to/ca.pem')

async with websockets.connect('wss://localhost:8765', ssl=ssl_context) as ws:
    await ws.send('{"command": "ping"}')
```

#### curl

```bash
# Option 1: Disable certificate validation
curl -k wss://localhost:8765

# Option 2: Trust the CA certificate
curl --cacert /path/to/ca.pem wss://localhost:8765
```

## Certificate Management

### View Certificate Information

The certificate generator logs certificate details on startup:

```
[CertificateManager] SSL certificates ready: {
  certPath: '/home/user/.config/basset-hound-browser/certs/cert.pem',
  keyPath: '/home/user/.config/basset-hound-browser/certs/key.pem',
  caPath: '/home/user/.config/basset-hound-browser/certs/ca.pem',
  location: '/home/user/.config/basset-hound-browser/certs'
}
```

You can also view certificate details using OpenSSL:

```bash
# View server certificate
openssl x509 -in cert.pem -text -noout

# Verify certificate chain
openssl verify -CAfile ca.pem cert.pem
```

### Manually Regenerate Certificates

To regenerate certificates, simply delete the existing ones and restart the application:

```bash
# Delete auto-generated certificates
rm -rf ~/.config/basset-hound-browser/certs/

# Restart the application
npm start
```

### Certificate Renewal

Certificates are automatically checked on startup and renewed if:

- Certificate files are missing
- Certificate is expired or expires within 30 days
- Certificate is invalid or corrupted

## Security Considerations

### Development vs Production

#### Development

Auto-generated certificates are ideal for:
- Local development and testing
- Internal network usage
- Bot automation where SSL is required but not for security

#### Production

For production deployments, consider:

1. **Use proper CA-signed certificates** (Let's Encrypt, commercial CA)
2. **Implement certificate pinning** in your clients
3. **Rotate certificates regularly**
4. **Monitor certificate expiration**
5. **Use strong authentication** in addition to SSL

### Self-Signed Certificate Warnings

Self-signed certificates will trigger warnings in:
- Web browsers
- Some SSL clients
- Security auditing tools

This is expected behavior. Clients must explicitly trust the CA certificate or disable certificate validation.

### Permissions

Certificate private keys are stored with restrictive permissions (0600) to prevent unauthorized access.

## Troubleshooting

### OpenSSL Not Found

If OpenSSL is not available, the generator will fall back to node-forge or Node.js crypto:

```
[CertGenerator] OpenSSL not found, using Node.js crypto fallback
[CertGenerator] WARNING: Created simplified certificates using Node.js crypto
[CertGenerator] For production use, install OpenSSL or add node-forge to dependencies
```

To install OpenSSL:

```bash
# Ubuntu/Debian
sudo apt-get install openssl

# macOS
brew install openssl

# Windows (via Chocolatey)
choco install openssl
```

### Certificate Generation Failed

If certificate generation fails completely:

```
[CertificateManager] Failed to generate SSL certificates: <error message>
[CertificateManager] Continuing without SSL...
```

Check:
1. Write permissions on the certificate directory
2. Sufficient disk space
3. OpenSSL installation (if using OpenSSL method)
4. Node.js version (crypto.generateKeyPairSync requires Node 10.12.0+)

### SSL Connection Fails

If clients cannot connect via WSS:

1. **Verify SSL is enabled**: Check `server.ssl.enabled` in config
2. **Check certificate paths**: Ensure certificates were generated successfully
3. **Trust the CA**: Configure clients to trust `ca.pem`
4. **Check firewall**: Ensure port 8765 is accessible
5. **Test with curl**: `curl -k wss://localhost:8765`

### Certificate Expired

If you see certificate expiration warnings:

```
[CertGenerator] Certificate expires in X days, will regenerate
```

Restart the application to trigger automatic renewal, or manually delete and regenerate certificates.

## Advanced Configuration

### Custom Certificate Properties

You can customize certificate properties by modifying `utils/cert-generator.js`:

```javascript
const certGenerator = new CertificateGenerator({
  validityDays: 730,  // 2 years
  keySize: 4096,      // 4096-bit RSA
  organization: 'My Company',
  commonName: 'myserver.local'
});
```

### Integration with External CA

For enterprise environments, you can integrate with an external CA:

```javascript
// In main.js, replace auto-generation with your CA integration
const certs = await fetchCertificatesFromCA();
sslCertPath = certs.certPath;
sslKeyPath = certs.keyPath;
sslCaPath = certs.caPath;
```

## Related Documentation

- [WebSocket Server Configuration](./WEBSOCKET.md)
- [Security & Authentication](./SECURITY.md)
- [Configuration System](./CONFIGURATION.md)
- [Distribution & Deployment](./DISTRIBUTION.md)

## Examples

### Development Setup with Auto-Generated Certificates

```yaml
# config.yaml
server:
  port: 8765
  ssl:
    enabled: true  # Certificates will be auto-generated
```

```bash
npm start
```

### Production Setup with Let's Encrypt

```yaml
# config.yaml
server:
  port: 8765
  ssl:
    enabled: true
    certPath: /etc/letsencrypt/live/example.com/fullchain.pem
    keyPath: /etc/letsencrypt/live/example.com/privkey.pem
```

### Custom Certificate Location for Portable App

```yaml
# config.yaml
server:
  ssl:
    enabled: true
    certsDir: ./portable-certs  # Relative to app directory
```

This ensures certificates are stored alongside the portable AppImage/binary.

## Changelog

- **v8.1.4** - Initial implementation of SSL certificate auto-generation
  - OpenSSL, node-forge, and Node.js crypto support
  - Automatic certificate renewal
  - Configurable storage location

---

**Last Updated**: December 2024
**Version**: 8.1.4
