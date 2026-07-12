# Docker Deployment

Production Docker deployment guide.

## Build Production Image

```bash
docker build -f Dockerfile.prod -t basset-hound:prod .
```

## Run Container

```bash
docker run -d \
  -p 8765:8765 \
  --name basset-hound \
  --restart always \
  basset-hound:prod
```

## Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  basset-hound:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: basset-hound
    ports:
      - "8765:8765"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=error
      - WEBSOCKET_PORT=8765
      - RATE_LIMIT=true
      - SECURITY_STRICT=true
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/api/diagnostics"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Networking

Connect multiple containers:

```bash
# Create network
docker network create basset-hound-network

# Run with network
docker run -d \
  --network basset-hound-network \
  --name basset-hound \
  -p 8765:8765 \
  basset-hound:prod
```

## Volume Mounting

Persistent logs:

```bash
docker run -d \
  -v basset-hound-logs:/app/logs \
  -p 8765:8765 \
  basset-hound:prod
```

## Environment Variables

```bash
docker run -d \
  -e NODE_ENV=production \
  -e LOG_LEVEL=error \
  -e WEBSOCKET_PORT=8765 \
  -e RATE_LIMIT=true \
  -p 8765:8765 \
  basset-hound:prod
```

## Health Checks

Container health check endpoint:

```bash
curl http://localhost:8765/api/diagnostics
```

## Monitoring

View logs:
```bash
docker logs -f basset-hound
```

Container stats:
```bash
docker stats basset-hound
```

## Troubleshooting

**Container won't start:**
```bash
docker logs basset-hound
```

**Port already in use:**
```bash
docker run -p 9000:8765 basset-hound:prod
```

**Container out of memory:**
```bash
docker run -m 2g basset-hound:prod
```

## See Also

- **[Pre-Deployment Checklist](PRE-DEPLOYMENT-CHECKLIST.md)**
- **[TLS Setup](TLS-SETUP.md)** - Secure deployment
- **[Monitoring](MONITORING.md)** - Health and metrics
