# WebSocket Secure (WSS) / TLS Setup Guide

**Version:** 1.0  
**Last Updated:** June 21, 2026  
**Status:** Production Ready

## Overview

This guide covers enabling secure WebSocket connections (WSS) in Basset Hound Browser. The browser supports both:

- **WS (WebSocket)** - Unencrypted, development/internal use
- **WSS (WebSocket Secure)** - Encrypted with TLS 1.2+, production recommended

The implementation uses Node.js HTTPS server with TLS certificates, compatible with:
- Self-signed certificates (development)
- Let's Encrypt (production, automated)
- Corporate CA certificates (enterprise)

---

## Quick Start: Development (5 minutes)

### 1. Generate Self-Signed Certificate

```bash
# Generate 365-day self-signed certificate for localhost
node -e "
const { WebSocketServer } = require('./websocket/server');
const certs = WebSocketServer.generateSelfSignedCert(
  './certs',
  { commonName: 'localhost', days: 365 }
);
console.log('Generated:', certs);
"
```

**Output:**
```
Generated: {
  certPath: '/path/to/certs/localhost.crt',
  keyPath: '/path/to/certs/localhost.key'
}
```

### 2. Set Environment Variables

```bash
export BASSET_WS_SSL_ENABLED=true
export BASSET_WS_SSL_CERT=/path/to/certs/localhost.crt
export BASSET_WS_SSL_KEY=/path/to/certs/localhost.key
```

### 3. Start the Browser

```bash
npm start
# Server logs: [WebSocket] Listening on wss://0.0.0.0:8765
```

### 4. Connect Client (Node.js)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('wss://localhost:8765', {
  rejectUnauthorized: false  // Accept self-signed cert (dev only!)
});

ws.on('open', () => {
  console.log('Connected via WSS');
  ws.send(JSON.stringify({ command: 'ping' }));
});
```

---

## Environment Variables Reference

### Core TLS Settings

```bash
# Enable/disable WSS (defaults to false in dev, true in production)
BASSET_WS_SSL_ENABLED=true|false

# Path to TLS certificate (PEM format)
BASSET_WS_SSL_CERT=/etc/basset/certs/cert.pem

# Path to TLS private key (PEM format)
BASSET_WS_SSL_KEY=/etc/basset/certs/key.pem

# Path to CA certificate for client verification (optional)
BASSET_WS_SSL_CA=/etc/basset/certs/ca.pem
```

### Production Defaults

In production (`NODE_ENV=production`):
- `BASSET_WS_SSL_ENABLED` defaults to `true`
- WSS is required unless explicitly disabled
- Missing certs fallback to WS with warning

---

## Development Setup: Self-Signed Certificates

### Option A: Using CLI Command

```bash
# Using Node.js
node -e "
const { WebSocketServer } = require('./websocket/server');
const certs = WebSocketServer.generateSelfSignedCert('./certs', {
  commonName: 'localhost',
  days: 365
});
"
```

### Option B: Using OpenSSL (Manual)

```bash
mkdir -p certs
cd certs

# Generate private key (2048-bit RSA)
openssl genrsa -out localhost.key 2048

# Generate certificate (365 days validity)
openssl req -new -x509 -key localhost.key -out localhost.crt -days 365 \
  -subj "/CN=localhost/O=Basset Hound/C=US"

cd ..
```

### Option C: Docker Environment

```dockerfile
FROM node:18-alpine

# Generate certs during image build
RUN mkdir -p /app/certs && \
    openssl genrsa -out /app/certs/localhost.key 2048 && \
    openssl req -new -x509 -key /app/certs/localhost.key \
      -out /app/certs/localhost.crt -days 365 \
      -subj "/CN=localhost/O=Basset Hound/C=US"

ENV BASSET_WS_SSL_ENABLED=true
ENV BASSET_WS_SSL_CERT=/app/certs/localhost.crt
ENV BASSET_WS_SSL_KEY=/app/certs/localhost.key

WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

### Verify Self-Signed Certificate

```bash
# Check certificate validity
openssl x509 -in certs/localhost.crt -text -noout

# Test connection
openssl s_client -connect localhost:8765 -showcerts

# Expected output:
# Verify return code: 0 (ok)
# Verify return code: 18 (self-signed certificate)
```

---

## Production Setup: Let's Encrypt

### Automated Setup with Certbot

```bash
#!/bin/bash
# setup-letsencrypt.sh

DOMAIN="browser.example.com"
EMAIL="admin@example.com"
CERT_DIR="/etc/basset/certs"

# Install certbot
apt-get update && apt-get install -y certbot

# Generate certificate (requires port 80/443 temporarily)
certbot certonly --standalone \
  --agree-tos \
  -m $EMAIL \
  -d $DOMAIN

# Copy certs to basset directory
mkdir -p $CERT_DIR
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_DIR/cert.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERT_DIR/key.pem
chown -R basset:basset $CERT_DIR
chmod 600 $CERT_DIR/*.pem

# Set environment variables
cat > /etc/systemd/system/basset-hound.service <<EOF
[Unit]
Description=Basset Hound Browser
After=network.target

[Service]
Type=simple
User=basset
WorkingDirectory=/opt/basset-hound
Environment="BASSET_WS_SSL_ENABLED=true"
Environment="BASSET_WS_SSL_CERT=$CERT_DIR/cert.pem"
Environment="BASSET_WS_SSL_KEY=$CERT_DIR/key.pem"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl restart basset-hound
```

### Auto-Renewal with systemd Timer

```bash
# Create renewal script
cat > /usr/local/bin/renew-basset-certs.sh <<'EOF'
#!/bin/bash
certbot renew --quiet
cp /etc/letsencrypt/live/browser.example.com/fullchain.pem /etc/basset/certs/cert.pem
cp /etc/letsencrypt/live/browser.example.com/privkey.pem /etc/basset/certs/key.pem
systemctl restart basset-hound
EOF

chmod +x /usr/local/bin/renew-basset-certs.sh

# Create timer unit
cat > /etc/systemd/system/basset-renew-certs.timer <<EOF
[Unit]
Description=Renew Basset Hound TLS Certificates Daily
Requires=basset-renew-certs.service

[Timer]
OnCalendar=daily
OnBootSec=1h
AccuracySec=12h

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/basset-renew-certs.service <<EOF
[Unit]
Description=Renew Basset Hound TLS Certificates
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/renew-basset-certs.sh
EOF

systemctl daemon-reload
systemctl enable basset-renew-certs.timer
systemctl start basset-renew-certs.timer
```

### Docker with Let's Encrypt

```dockerfile
FROM node:18-alpine

RUN apk add --no-cache certbot openssl

WORKDIR /app

# Volumes for persistent certificate storage
VOLUME ["/etc/letsencrypt", "/app/certs"]

# Startup script handles cert generation
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

COPY . .
RUN npm install

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]
```

**docker-entrypoint.sh:**
```bash
#!/bin/sh
set -e

DOMAIN=${TLS_DOMAIN:-localhost}
EMAIL=${TLS_EMAIL:-admin@example.com}

# Generate certs if not found
if [ ! -f "/app/certs/cert.pem" ]; then
  if [ "$TLS_USE_LETSENCRYPT" = "true" ]; then
    # Let's Encrypt (requires internet + port 80)
    certbot certonly --standalone \
      --agree-tos -m $EMAIL -d $DOMAIN --non-interactive
    
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /app/certs/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /app/certs/key.pem
  else
    # Self-signed fallback
    openssl genrsa -out /app/certs/key.pem 2048
    openssl req -new -x509 -key /app/certs/key.pem \
      -out /app/certs/cert.pem -days 365 \
      -subj "/CN=$DOMAIN/O=Basset Hound/C=US"
  fi
fi

# Start application
exec "$@"
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  basset-hound:
    build: .
    ports:
      - "8765:8765"
    environment:
      - NODE_ENV=production
      - BASSET_WS_SSL_ENABLED=true
      - BASSET_WS_SSL_CERT=/app/certs/cert.pem
      - BASSET_WS_SSL_KEY=/app/certs/key.pem
      - TLS_DOMAIN=browser.example.com
      - TLS_USE_LETSENCRYPT=true
      - TLS_EMAIL=admin@example.com
    volumes:
      - ./certs:/app/certs
      - /etc/letsencrypt:/etc/letsencrypt
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
# Certs auto-generated, accessible at wss://browser.example.com:8765
```

---

## Kubernetes Setup

### Secret Management

```bash
# Create TLS secret from existing certificates
kubectl create secret tls basset-hound-tls \
  --cert=./certs/cert.pem \
  --key=./certs/key.pem \
  -n basset-hound

# Verify secret
kubectl describe secret basset-hound-tls -n basset-hound
```

### Deployment with TLS

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound
  namespace: basset-hound
spec:
  replicas: 3
  selector:
    matchLabels:
      app: basset-hound
  template:
    metadata:
      labels:
        app: basset-hound
    spec:
      containers:
      - name: basset-hound
        image: basset-hound:latest
        ports:
        - containerPort: 8765
          name: wss
        env:
        - name: NODE_ENV
          value: production
        - name: BASSET_WS_SSL_ENABLED
          value: "true"
        - name: BASSET_WS_SSL_CERT
          value: /etc/basset-tls/certs/cert.pem
        - name: BASSET_WS_SSL_KEY
          value: /etc/basset-tls/certs/key.pem
        volumeMounts:
        - name: tls-certs
          mountPath: /etc/basset-tls/certs
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: 8765
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: tls-certs
        secret:
          secretName: basset-hound-tls
```

**service.yaml:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: basset-hound
  namespace: basset-hound
spec:
  type: LoadBalancer
  ports:
  - port: 8765
    targetPort: wss
    protocol: TCP
    name: wss
  selector:
    app: basset-hound
```

### Ingress with TLS Termination

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basset-hound
  namespace: basset-hound
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - browser.example.com
    secretName: basset-hound-tls
  rules:
  - host: browser.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: basset-hound
            port:
              number: 8765
```

---

## Client Connection Examples

### Node.js Client

**basic-connection.js:**
```javascript
const WebSocket = require('ws');

// Production: Validate certificate
const ws = new WebSocket('wss://browser.example.com:8765', {
  rejectUnauthorized: true  // Validate server cert
});

// Development: Accept self-signed
// const ws = new WebSocket('wss://localhost:8765', {
//   rejectUnauthorized: false
// });

ws.on('open', () => {
  console.log('Connected via WSS');
  
  ws.send(JSON.stringify({
    command: 'ping'
  }));
});

ws.on('message', (data) => {
  console.log('Server response:', JSON.parse(data));
});

ws.on('error', (err) => {
  console.error('Connection error:', err.message);
});
```

### Python Client (with Self-Signed Cert)

```python
import websocket
import ssl
import json

# Disable certificate verification for self-signed certs
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

def on_message(ws, message):
    print('Server:', json.loads(message))

def on_error(ws, error):
    print('Error:', error)

def on_open(ws):
    print('Connected via WSS')
    ws.send(json.dumps({'command': 'ping'}))

# Development (self-signed)
ws = websocket.WebSocketApp(
    'wss://localhost:8765',
    on_message=on_message,
    on_error=on_error,
    on_open=on_open
)
ws.run_forever(sslopt={'cert_reqs': ssl.CERT_NONE})

# Production (verified cert)
# ws = websocket.WebSocketApp('wss://browser.example.com:8765', ...)
# ws.run_forever()
```

### cURL WebSocket Test

```bash
# Requires websocat or similar tool
brew install websocat  # macOS
apt-get install websocat  # Linux

# Test WSS connection
websocat -t wss://localhost:8765 --insecure

# Send command
{"command":"ping"}
# Response: {"success":true}
```

### Browser JavaScript

```javascript
// Note: Browser WebSocket doesn't allow custom certs
// Must either:
// 1. Use valid, signed certificate
// 2. Access via proxy/reverse proxy with valid cert

// Development (via localhost)
const ws = new WebSocket('wss://localhost:8765');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({command: 'ping'}));
};

ws.onmessage = (event) => {
  console.log('Response:', JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

---

## Certificate Troubleshooting

### Issue: "certificate not found"

```
Error: SSL certificate file not found: /path/to/cert.pem
```

**Solution:**
```bash
# Verify files exist
ls -la /path/to/cert.pem /path/to/key.pem

# Check environment variables
echo $BASSET_WS_SSL_CERT
echo $BASSET_WS_SSL_KEY

# Verify permissions
chmod 644 /path/to/cert.pem
chmod 600 /path/to/key.pem
```

### Issue: "certificate verify failed"

```
Error: certificate verify failed: self-signed certificate
```

**Solution (Development):**
```javascript
// Accept self-signed certificate
const ws = new WebSocket('wss://localhost:8765', {
  rejectUnauthorized: false
});
```

**Solution (Production):**
```bash
# Use valid, signed certificate
export BASSET_WS_SSL_CERT=/path/to/valid/cert.pem
export BASSET_WS_SSL_KEY=/path/to/valid/key.pem
```

### Issue: "ECONNREFUSED"

```
Error: connect ECONNREFUSED 127.0.0.1:8765
```

**Solution:**
```bash
# Check if server is listening
netstat -tlnp | grep 8765

# Check logs for startup errors
npm start 2>&1 | grep -i "ssl\|certificate"

# Verify certificate is valid
openssl x509 -in $BASSET_WS_SSL_CERT -text -noout | head -20
```

### Issue: "Invalid certificate format"

```
Error: Invalid certificate format: Expected PEM format with BEGIN CERTIFICATE header
```

**Solution:**
```bash
# Verify PEM format
head -1 /path/to/cert.pem
# Should print: -----BEGIN CERTIFICATE-----

# Convert DER to PEM
openssl x509 -inform DER -in cert.der -out cert.pem

# Verify key format
head -1 /path/to/key.pem
# Should print: -----BEGIN RSA PRIVATE KEY----- or -----BEGIN PRIVATE KEY-----
```

---

## Performance Considerations

### TLS Overhead

- **Handshake:** ~100ms per connection (one-time)
- **Per-message overhead:** <1ms
- **Compression:** 70-93% bandwidth reduction (outweighs TLS overhead)

### Optimization Tips

1. **Connection Pooling:** Reuse connections to amortize handshake cost
2. **Session Resumption:** Enable TLS session caching
3. **Certificate Pinning:** Cache cert in client for faster validation

### Monitoring TLS Connections

```javascript
// Access TLS info via WebSocket server
const tlsInfo = {
  enabled: server.isSslEnabled(),
  protocol: server.getProtocol(),
  connectionUrl: server.getConnectionUrl('browser.example.com'),
  activeCertPath: server.sslActive ? server.sslCertPath : null
};

console.log('TLS Configuration:', tlsInfo);
```

---

## Security Best Practices

### Certificate Management

✅ **DO:**
- Use strong RSA keys (2048+ bits)
- Set restrictive file permissions (600 for keys)
- Rotate certificates annually
- Use Let's Encrypt for automatic renewal
- Monitor certificate expiration

❌ **DON'T:**
- Commit certificates to version control
- Use default/weak passphrases
- Share private keys
- Run self-signed in production
- Ignore certificate warnings

### Connection Security

✅ **DO:**
- Always verify certificates in production
- Use TLS 1.2+ only
- Implement rate limiting
- Enable authentication tokens
- Monitor failed connection attempts

❌ **DON'T:**
- Set `rejectUnauthorized: false` in production
- Accept self-signed certificates without verification
- Allow plaintext WS in production
- Skip authentication for security

### Configuration

```bash
# Secure environment setup
# .env.production
BASSET_WS_SSL_ENABLED=true
BASSET_WS_SSL_CERT=/etc/basset/certs/cert.pem
BASSET_WS_SSL_KEY=/etc/basset/certs/key.pem
BASSET_WS_TOKEN=<strong-random-token>
NODE_ENV=production

# Never in version control
# .gitignore
certs/
.env.production
*.key
```

---

## Monitoring & Health Checks

### Health Endpoint

```bash
# Check server health over HTTPS
curl -k https://localhost:8765/health

# Expected response (200 OK):
# {
#   "status": "healthy",
#   "websocket": "ready",
#   "ssl": true,
#   "protocol": "wss"
# }
```

### Monitoring Script

```javascript
// monitor-tls.js
const https = require('https');

const options = {
  hostname: 'browser.example.com',
  port: 8765,
  path: '/health',
  method: 'GET',
  rejectUnauthorized: true
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Protocol: ${res.socket.getProtocol()}`);
  console.log(`Cipher: ${res.socket.getCipher().name}`);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Health:', JSON.parse(data));
  });
});

req.on('error', console.error);
req.end();
```

### Prometheus Metrics

```bash
# Access metrics endpoint
curl https://localhost:8765/metrics

# Expected metrics:
# websocket_connections_total 150
# websocket_ssl_handshakes_total 150
# websocket_ssl_failures_total 2
# tls_certificate_expiry_seconds 15778800
```

---

## Troubleshooting Checklist

```
[ ] Certificate files exist and readable
[ ] Private key permissions are 600
[ ] Environment variables set correctly
[ ] Certificate not expired (openssl x509 -noout -dates)
[ ] Server logs show "wss://" (not "ws://")
[ ] Client uses correct protocol (wss:// not ws://)
[ ] Firewall allows port 8765
[ ] Self-signed cert acceptance enabled in dev
[ ] Valid, signed cert in production
[ ] No mixed content warnings (if in browser)
```

---

## Quick Reference

| Scenario | Command |
|----------|---------|
| Generate self-signed cert | `WebSocketServer.generateSelfSignedCert('./certs')` |
| Check cert validity | `openssl x509 -noout -dates -in cert.pem` |
| Get cert info | `openssl x509 -text -noout -in cert.pem` |
| Test WSS connection | `websocat -t wss://localhost:8765` |
| Enable in .env | `BASSET_WS_SSL_ENABLED=true` |
| Renew Let's Encrypt | `certbot renew --quiet` |
| Check listening port | `netstat -tlnp \| grep 8765` |
| Monitor TLS | `curl -k https://localhost:8765/health` |

---

## Related Documentation

- [API-REFERENCE.md](./API-REFERENCE.md) - Full WebSocket API
- [SCOPE.md](architecture/SCOPE.md) - Architecture and scope
- [DEPLOYMENT-COMPLETE-2026-05-11.md](archives/deployment-reports/DEPLOYMENT-COMPLETE-2026-05-11.md) - Production deployment

---

## Support

For issues, questions, or contributions:
- GitHub Issues: [Report bug](https://github.com/basset-hound/basset-hound-browser/issues)
- Documentation: [Full docs](./README.md)
- Contact: gnelsonerau@gmail.com
