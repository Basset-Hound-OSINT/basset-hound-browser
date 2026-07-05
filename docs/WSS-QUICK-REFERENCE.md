# WebSocket Secure (WSS) - Quick Reference Card

**Last Updated:** June 21, 2026

## ⚡ 30-Second Setup

### Development (Self-Signed)
```bash
# 1. Generate certificate
node -e "const {WebSocketServer} = require('./websocket/server'); 
const c = WebSocketServer.generateSelfSignedCert('./certs'); 
console.log(c);"

# 2. Set environment variables
export BASSET_WS_SSL_ENABLED=true
export BASSET_WS_SSL_CERT=$(pwd)/certs/localhost.crt
export BASSET_WS_SSL_KEY=$(pwd)/certs/localhost.key

# 3. Start server
npm start

# 4. Test connection
node examples/tls-client.js dev ping
```

### Production (Let's Encrypt)
```bash
# 1. Install certbot
apt-get install certbot

# 2. Generate certificate
certbot certonly --standalone -d browser.example.com

# 3. Set environment variables
export BASSET_WS_SSL_ENABLED=true
export BASSET_WS_SSL_CERT=/etc/letsencrypt/live/browser.example.com/fullchain.pem
export BASSET_WS_SSL_KEY=/etc/letsencrypt/live/browser.example.com/privkey.pem

# 4. Start server
NODE_ENV=production npm start
```

### Docker
```bash
# Run setup script
bash examples/docker-tls-setup.sh dev        # Development
bash examples/docker-tls-setup.sh prod --domain browser.example.com

# Start container
docker-compose up -d

# Test
docker-compose exec basset-hound curl -k https://localhost:8765/health
```

---

## 🔧 Environment Variables

```bash
BASSET_WS_SSL_ENABLED=true|false                    # Enable WSS
BASSET_WS_SSL_CERT=/path/to/cert.pem                # Server certificate
BASSET_WS_SSL_KEY=/path/to/key.pem                  # Private key
BASSET_WS_SSL_CA=/path/to/ca.pem                    # CA cert (optional, for client auth)
NODE_ENV=production                                  # Auto-enable WSS in prod
```

---

## 🧪 Testing Commands

| Task | Command |
|------|---------|
| Test WSS connection | `node examples/tls-client.js dev ping` |
| Interactive mode | `node examples/tls-client.js dev` |
| Python client | `python3 examples/tls-client.py dev ping` |
| Check cert validity | `openssl x509 -noout -dates -in cert.pem` |
| View cert details | `openssl x509 -text -noout -in cert.pem` |
| Health check | `curl -k https://localhost:8765/health` |
| Test with websocat | `websocat -t wss://localhost:8765 --insecure` |

---

## 📋 Certificate Management

### Generate Self-Signed (Development)
```bash
mkdir -p certs
openssl genrsa -out certs/localhost.key 2048
openssl req -new -x509 -key certs/localhost.key \
  -out certs/localhost.crt -days 365 \
  -subj "/CN=localhost"
```

### Renew Let's Encrypt
```bash
certbot renew --quiet
cp /etc/letsencrypt/live/browser.example.com/fullchain.pem /etc/basset/certs/cert.pem
cp /etc/letsencrypt/live/browser.example.com/privkey.pem /etc/basset/certs/key.pem
systemctl restart basset-hound
```

### Verify Certificate Chain
```bash
# Check certificate is valid
openssl verify -CAfile ca.pem server-cert.pem

# Check expiration
openssl x509 -noout -dates -in cert.pem

# Get fingerprint
openssl x509 -noout -fingerprint -sha256 -in cert.pem
```

---

## 🎯 Client Examples

### Node.js
```javascript
const WebSocket = require('ws');

// Development: Accept self-signed
const ws = new WebSocket('wss://localhost:8765', {
  rejectUnauthorized: false
});

// Production: Validate certificate
const ws = new WebSocket('wss://browser.example.com:8765', {
  rejectUnauthorized: true
});

ws.on('open', () => ws.send(JSON.stringify({command: 'ping'})));
ws.on('message', (data) => console.log(JSON.parse(data)));
```

### Python
```python
import websocket
import ssl

# Production
ws = websocket.WebSocketApp('wss://browser.example.com:8765')
ws.run_forever()

# Development (self-signed)
ws = websocket.WebSocketApp('wss://localhost:8765')
ws.run_forever(sslopt={'cert_reqs': ssl.CERT_NONE})
```

### cURL
```bash
# Simple GET request to health endpoint
curl -k https://localhost:8765/health

# With certificate
curl --cert client.crt --key client.key https://localhost:8765/health
```

---

## 🚀 Docker Deployment

### Development Setup
```bash
bash examples/docker-tls-setup.sh dev
docker-compose up -d
curl -k https://localhost:8765/health
```

### Production with Let's Encrypt
```bash
bash examples/docker-tls-setup.sh prod \
  --domain browser.example.com \
  --email admin@example.com

docker-compose up -d
```

### Verify
```bash
docker-compose logs basset-hound
docker-compose exec basset-hound curl -k https://localhost:8765/health
```

---

## ⚠️ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `certificate not found` | Check paths: `ls -la $BASSET_WS_SSL_CERT` |
| `certificate verify failed` | Use `rejectUnauthorized: false` in dev |
| `EADDRINUSE: port 8765 in use` | Kill process: `lsof -i :8765 \| kill -9` |
| `Invalid certificate format` | Use PEM format, check header |
| `certificate expired` | Regenerate or renew with certbot |
| Connection refused | Is server running? `netstat -tlnp \| grep 8765` |

---

## 🔐 Security Checklist

- [ ] Certificate validity: `openssl x509 -noout -dates -in cert.pem`
- [ ] Key permissions: `ls -la key.pem` (should be 600)
- [ ] No plaintext WS in production
- [ ] Validate certificates in production
- [ ] Setup certificate auto-renewal
- [ ] Monitor certificate expiration
- [ ] Don't commit certs to version control
- [ ] Use strong passphrases for keys

---

## 📚 Documentation Links

| Document | Purpose |
|----------|---------|
| [TLS-SETUP.md](./TLS-SETUP.md) | Complete TLS setup guide |
| [WSS-IMPLEMENTATION-SUMMARY.md](./WSS-IMPLEMENTATION-SUMMARY.md) | Implementation details |
| examples/tls-client.js | Node.js client example |
| examples/tls-client.py | Python client example |
| examples/tls-client-cert-auth.js | mTLS client example |
| examples/docker-tls-setup.sh | Docker setup script |

---

## 🆘 Quick Diagnostics

```bash
# Show current WSS configuration
npm start 2>&1 | grep -i "ssl\|websocket\|wss"

# Check certificates exist
echo "Certificate: $(test -f $BASSET_WS_SSL_CERT && echo '✓' || echo '✗')"
echo "Key: $(test -f $BASSET_WS_SSL_KEY && echo '✓' || echo '✗')"

# Test connection
node examples/tls-client.js dev ping

# View server logs
docker logs basset-hound | grep -i ssl

# Check port listening
lsof -i :8765 || netstat -tlnp | grep 8765
```

---

## 🔄 Workflow Examples

### Complete Dev → Prod Migration

```bash
# 1. Develop locally with self-signed
bash examples/docker-tls-setup.sh dev
docker-compose up -d

# 2. Test with client
node examples/tls-client.js dev ping

# 3. Deploy to production with Let's Encrypt
bash examples/docker-tls-setup.sh prod --domain browser.example.com
docker-compose up -d

# 4. Verify production
curl -k https://browser.example.com:8765/health

# 5. Setup auto-renewal
systemctl enable basset-renew-certs.timer
```

### Kubernetes Deployment

```bash
# 1. Create secret
kubectl create secret tls basset-hound-tls \
  --cert=fullchain.pem --key=privkey.pem

# 2. Deploy
kubectl apply -f deployment.yaml

# 3. Verify
kubectl port-forward svc/basset-hound 8765:8765
curl -k https://localhost:8765/health
```

---

## 💡 Pro Tips

1. **Use environment variables:** Makes switching between dev/prod easier
2. **Monitor certificate expiration:** Set calendar reminders, use monitoring
3. **Test before deploying:** Always test WSS with client before production
4. **Keep key files private:** Never commit to version control
5. **Automate renewal:** Use systemd timers or Kubernetes CronJobs
6. **Log TLS errors:** Monitor logs for certificate-related issues
7. **Use strong ciphers:** Modern TLS 1.2+ with strong ciphers
8. **Enable OCSP stapling:** Reduce verification latency in production

---

## 🎓 Learning Path

1. **Understand WSS:** Read TLS-SETUP.md introduction
2. **Setup dev environment:** Follow 30-second setup above
3. **Test with examples:** Run tls-client.js examples
4. **Learn certificate management:** Generate self-signed certs
5. **Deploy to production:** Use Let's Encrypt setup
6. **Monitor & maintain:** Setup auto-renewal and monitoring

---

## Version & Status

- **Implementation Status:** ✅ Complete & Production Ready
- **Last Updated:** June 21, 2026
- **Server Version:** v12.0.0+
- **TLS Version:** 1.2+ (1.3 recommended)
- **Support:** gnelsonerau@gmail.com

---

**Quick Tip:** Save this reference as a bookmark or print it out for quick access!
