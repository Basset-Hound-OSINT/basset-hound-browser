# TLS/SSL Setup for Secure WebSocket (WSS)

Comprehensive guide to setting up TLS/SSL certificates for secure WebSocket connections (wss://).

## Quick Start

### 1. Environment Variables

Set these in your `.env` file:

```bash
# Enable TLS/SSL
BASSET_WS_SSL_ENABLED=true

# Certificate paths (absolute or Docker-mounted paths)
BASSET_WS_SSL_CERT=/etc/basset/certs/cert.pem
BASSET_WS_SSL_KEY=/etc/basset/certs/key.pem

# Optional: Client certificate verification
BASSET_WS_SSL_CA=/etc/basset/certs/ca.pem
```

### 2. Verify Server is Running

```bash
openssl s_client -connect localhost:8765
```

## Self-Signed Certificate (Development)

Quick setup for local testing without a domain.

```bash
# Generate RSA 4096-bit key and certificate (valid 365 days)
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365 \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Verify generated files
ls -la cert.pem key.pem

# Set secure permissions
chmod 600 key.pem  # Read-only for key
chmod 644 cert.pem # Readable certificate
```

**Usage:**
```bash
export BASSET_WS_SSL_CERT=/path/to/cert.pem
export BASSET_WS_SSL_KEY=/path/to/key.pem
export BASSET_WS_SSL_ENABLED=true
npm start
```

## Let's Encrypt Certificate (Production)

Free, automated certificates from Let's Encrypt with auto-renewal.

### Prerequisites
- Domain name pointing to your server
- Port 80 accessible (for standalone certbot)

### Installation

```bash
# Install certbot (Let's Encrypt client)
sudo apt-get update
sudo apt-get install certbot

# Obtain certificate (standalone mode)
sudo certbot certonly --standalone -d yourdomain.com

# Or with webroot (if you have existing web server)
sudo certbot certonly --webroot -w /var/www/html -d yourdomain.com
```

### Setup Application

```bash
# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /etc/basset/certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /etc/basset/certs/key.pem

# Set permissions
sudo chmod 644 /etc/basset/certs/cert.pem
sudo chmod 600 /etc/basset/certs/key.pem
sudo chown nobody:nogroup /etc/basset/certs/key.pem  # Restrict access

# Set environment variables
export BASSET_WS_SSL_ENABLED=true
export BASSET_WS_SSL_CERT=/etc/basset/certs/cert.pem
export BASSET_WS_SSL_KEY=/etc/basset/certs/key.pem
```

### Auto-Renewal

```bash
# Edit crontab
sudo crontab -e

# Add renewal task (runs daily at 2 AM)
0 2 * * * certbot renew --quiet --post-hook "systemctl restart basset-hound-browser"
```

### Renewal Without Service Restart

```bash
# Manual renewal
sudo certbot renew --force-renewal

# Check renewal status
sudo certbot renew --dry-run
```

## Commercial Certificates (DigiCert, Comodo, etc.)

### Obtain Certificate

1. Purchase SSL certificate from provider
2. Generate CSR (Certificate Signing Request):
   ```bash
   openssl req -new -newkey rsa:4096 -nodes \
     -keyout key.pem -out csr.pem \
     -subj "/C=US/ST=State/L=City/O=Org/CN=yourdomain.com"
   ```
3. Submit CSR to provider
4. Receive certificate (cert.pem) and chain (chain.pem)

### Installation

```bash
# If provider gives separate chain, combine with certificate
cat cert.pem chain.pem > cert-full.pem

# Use combined certificate
export BASSET_WS_SSL_CERT=/path/to/cert-full.pem
export BASSET_WS_SSL_KEY=/path/to/key.pem
export BASSET_WS_SSL_ENABLED=true
```

## Docker Deployment

### Dockerfile Setup

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy application
COPY . .

# Install dependencies
RUN npm install

# Create certificate directory
RUN mkdir -p /etc/basset/certs

# Copy certificates (using Docker secrets or build args)
COPY cert.pem /etc/basset/certs/cert.pem
COPY key.pem /etc/basset/certs/key.pem

# Set secure permissions
RUN chmod 644 /etc/basset/certs/cert.pem && \
    chmod 600 /etc/basset/certs/key.pem

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const https=require('https'),fs=require('fs');https.globalAgent.options.rejectUnauthorized=false;https.get('https://localhost:8765/health',r=>process.exit(r.statusCode===200?0:1)).on('error',e=>process.exit(1))"

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  basset-hound:
    build: .
    ports:
      - "8765:8765"
    volumes:
      - ./certs:/etc/basset/certs:ro  # Read-only mount
    environment:
      NODE_ENV: production
      BASSET_WS_SSL_ENABLED: "true"
      BASSET_WS_SSL_CERT: /etc/basset/certs/cert.pem
      BASSET_WS_SSL_KEY: /etc/basset/certs/key.pem
      WS_PORT: 8765
      LOG_LEVEL: info
    restart: unless-stopped
    networks:
      - basset-network

networks:
  basset-network:
    driver: bridge
```

### Docker Secrets (Production)

For Docker Swarm or Kubernetes:

```yaml
services:
  basset-hound:
    image: basset-hound:latest
    ports:
      - "8765:8765"
    environment:
      BASSET_WS_SSL_ENABLED: "true"
      BASSET_WS_SSL_CERT: /run/secrets/server_cert
      BASSET_WS_SSL_KEY: /run/secrets/server_key
    secrets:
      - server_cert
      - server_key
    restart: unless-stopped

secrets:
  server_cert:
    external: true
  server_key:
    external: true
```

Create secrets:
```bash
docker secret create server_cert cert.pem
docker secret create server_key key.pem
```

## Client Connection Examples

### Python (with ssl verification disabled for self-signed)

```python
import websockets
import ssl
import asyncio

async def connect():
    # For self-signed certificates
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    # For production with valid certificates
    # ssl_context = ssl.create_default_context()  # Uses system CA certificates
    
    async with websockets.connect(
        "wss://localhost:8765",
        ssl=ssl_context
    ) as ws:
        await ws.send('{"command": "status"}')
        response = await ws.recv()
        print(f"Response: {response}")

asyncio.run(connect())
```

### Node.js Client

```javascript
const WebSocket = require('ws');
const https = require('https');

// For self-signed certificates
const agent = new https.Agent({
  rejectUnauthorized: false  // Only for self-signed certs!
});

const ws = new WebSocket('wss://localhost:8765', {
  agent: agent
});

ws.on('open', () => {
  ws.send(JSON.stringify({ command: 'status' }));
});

ws.on('message', (data) => {
  console.log('Received:', data);
  ws.close();
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### JavaScript Browser

```javascript
// Modern browsers support WSS natively
const ws = new WebSocket('wss://yourdomain.com:8765');

ws.onopen = () => {
  ws.send(JSON.stringify({ command: 'status' }));
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### curl/openssl Testing

```bash
# Test TLS handshake
openssl s_client -connect localhost:8765 -showcerts

# Interactive test with openssl
openssl s_client -connect yourdomain.com:8765 -quiet
# Then type: Ctrl+C to exit

# Test with client certificate (if required)
openssl s_client -connect localhost:8765 \
  -cert client-cert.pem \
  -key client-key.pem \
  -CAfile ca-cert.pem
```

## Certificate Verification

### View Certificate Details

```bash
# Display certificate information
openssl x509 -in cert.pem -text -noout

# Check certificate validity
openssl x509 -in cert.pem -noout -dates

# Verify certificate chain
openssl verify -CAfile chain.pem cert.pem
```

### Verify Key Format

```bash
# Check RSA key
openssl rsa -in key.pem -check

# Check if key matches certificate
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
# (both md5 hashes should be identical)
```

## Troubleshooting

### Certificate File Not Found

```
Error: SSL certificate file not found: /etc/basset/certs/cert.pem
```

**Solutions:**
1. Verify file exists: `ls -la /etc/basset/certs/`
2. Check file permissions: `stat cert.pem`
3. Verify environment variables: `env | grep BASSET_WS_SSL`
4. Check Docker volume mounts: `docker inspect <container> | grep -A 10 Mounts`

### Invalid Certificate Format

```
Error: Invalid certificate format: Expected PEM format with BEGIN CERTIFICATE header
```

**Solutions:**
1. Verify format: `head -n 1 cert.pem`
   - Should start with `-----BEGIN CERTIFICATE-----`
2. Convert from DER format if needed:
   ```bash
   openssl x509 -inform DER -in cert.der -out cert.pem
   ```

### SSL Handshake Failed

```
Error: CERT_HAS_EXPIRED or SELF_SIGNED_CERT_IN_CHAIN
```

**Solutions:**
1. Check certificate expiry: `openssl x509 -in cert.pem -noout -dates`
2. For self-signed, disable verification in client (development only)
3. Renew certificate: `sudo certbot renew`

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:8765
```

**Solutions:**
1. Verify server is running: `netstat -tlnp | grep 8765`
2. Check firewall: `sudo ufw status`
3. Allow port: `sudo ufw allow 8765`
4. Verify TLS is enabled: `echo $BASSET_WS_SSL_ENABLED`

### Certificate Path Validation Failed

```
Error: SSL certificate path validation failed
```

**Solutions:**
1. Use absolute paths (not relative)
2. Ensure paths are readable: `ls -la <path>`
3. Check for symlink issues: `readlink -f <path>`

## Security Best Practices

1. **Key Permissions**: Always `chmod 600 key.pem`
2. **Certificate Permissions**: `chmod 644 cert.pem`
3. **Strong Keys**: Use minimum RSA-4096 or ECDP-256
4. **Regular Updates**: Update certificates before expiry
5. **Disable HTTP**: Use only WSS in production (never WS over network)
6. **Client Verification**: Enable mutual TLS (mTLS) when needed
7. **Certificate Pinning**: Pin certificates for client applications

## Performance Notes

- TLS adds ~5-10% CPU overhead
- Per-connection memory: ~1-2 MB (vs 0.5 MB for WS)
- Message throughput: No impact (transparent encryption)
- Compression: Works seamlessly with TLS

## Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BASSET_WS_SSL_ENABLED` | boolean | auto (true in prod) | Enable SSL/TLS |
| `BASSET_WS_SSL_CERT` | string | null | Path to certificate.pem |
| `BASSET_WS_SSL_KEY` | string | null | Path to key.pem |
| `BASSET_WS_SSL_CA` | string | null | Path to CA cert for client verification |
| `NODE_ENV` | string | development | Set to 'production' to enable TLS by default |

## Testing

Run the comprehensive test suite:

```bash
# Test both WS and WSS
node tests/tls-connection-test.js --both

# Test WSS only
node tests/tls-connection-test.js --wss

# Test with specific certificate
node tests/tls-connection-test.js --wss \
  --cert /path/to/cert.pem \
  --key /path/to/key.pem
```

See [tls-implementation.md](../findings/tls-implementation.md) for detailed test results.

## Related Documentation

- **[TLS Implementation Details](../findings/tls-implementation.md)** - Architecture and testing
- **[Docker Deployment](DOCKER-DEPLOYMENT.md)** - Docker-specific setup
- **[Rate Limiting & Security](RATE-LIMITING-SECURITY.md)** - Security configuration
- **[Monitoring](MONITORING.md)** - Health checks and metrics
- **[Pre-Deployment Checklist](PRE-DEPLOYMENT-CHECKLIST.md)** - Production validation

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs: `docker logs <container-id> | grep -i tls`
3. Test with openssl: `openssl s_client -connect <host>:<port>`
4. Verify environment: `docker inspect <container> -f '{{.Config.Env}}'`
