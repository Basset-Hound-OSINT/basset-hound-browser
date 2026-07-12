# Rate Limiting & Security

Production security configuration and rate limiting.

## Rate Limiting

Enable in production:

```bash
export RATE_LIMIT=true
npm start:prod
```

Default limits:
- Per IP: 100 requests/minute
- Per connection: 10 concurrent commands
- Payload size: 10 MB

## Configuration

In `.env.prod`:

```bash
RATE_LIMIT=true
RATE_LIMIT_WINDOW=60000          # 1 minute
RATE_LIMIT_MAX_REQUESTS=100      # per window
RATE_LIMIT_MAX_PAYLOAD=10485760  # 10 MB
```

## Request Validation

- All requests must be valid JSON
- Must have `id` and `command` fields
- Command must be known
- Parameters validated per command

## Security Headers

Auto-added to all responses:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

## CORS Configuration

Enable only trusted origins:

```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://yourdomain.com'
}));
```

## Authentication (Optional)

Implement token-based auth:

```python
async with websockets.connect("ws://localhost:8765") as ws:
    await ws.send(json.dumps({
        "id": "1",
        "command": "authenticate",
        "token": "your-api-token"
    }))
    # Must authenticate before other commands
```

## Network Security

Run behind reverse proxy (nginx):

```nginx
upstream basset-hound {
  server localhost:8765;
}

server {
  listen 443 ssl;
  server_name yourdomain.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://basset-hound;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Firewall Rules

Allow only necessary traffic:

```bash
# Allow WebSocket from trusted IPs
ufw allow from 10.0.0.0/8 to any port 8765

# Deny all other traffic
ufw default deny incoming
```

## Best Practices

1. **Never expose on public internet** (unless using reverse proxy + auth)
2. **Use HTTPS/WSS** in production
3. **Implement rate limiting** to prevent abuse
4. **Monitor access logs** for suspicious activity
5. **Regularly update** npm dependencies
6. **Run as non-root user** in Docker
7. **Disable debug mode** in production

## Audit Trail

Enable audit logging:

```bash
export AUDIT_LOG=true
npm start:prod
```

Logs all commands to `audit.log`.

## See Also

- **[TLS Setup](TLS-SETUP.md)** - Secure WebSocket
- **[Pre-Deployment Checklist](PRE-DEPLOYMENT-CHECKLIST.md)** - Security validation
- **[Security Guide](../../SECURITY.md)** - Detailed security info
