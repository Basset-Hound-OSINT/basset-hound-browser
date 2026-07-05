# Docker Quick Start

Get Basset Hound Browser running in Docker in 5 minutes.

## Prerequisites

- Docker installed: https://docs.docker.com/get-docker/
- Docker Compose (optional, but recommended)

## Quick Start (Development)

```bash
# Build development image
docker build -f Dockerfile.dev -t basset-hound:dev .

# Run development container
docker run -p 8765:8765 basset-hound:dev
```

Verify it's running:
```bash
curl http://localhost:8765/api/diagnostics
```

## Quick Start (Production)

```bash
# Build production image
docker build -f Dockerfile.prod -t basset-hound:prod .

# Run production container (detached)
docker run -p 8765:8765 -d --name basset-hound basset-hound:prod
```

Verify it's running:
```bash
curl http://localhost:8765/api/diagnostics
```

Stop the container:
```bash
docker stop basset-hound
docker rm basset-hound
```

## Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  basset-hound:
    build:
      context: .
      dockerfile: Dockerfile.dev  # Or Dockerfile.prod
    ports:
      - "8765:8765"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - WEBSOCKET_PORT=8765
    volumes:
      - ./:/app  # For development only
    restart: unless-stopped
```

Run with Compose:

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Common Docker Commands

### Development Workflow

```bash
# Build and run
docker build -f Dockerfile.dev -t basset-hound:dev .
docker run -p 8765:8765 basset-hound:dev

# Rebuild after code changes
docker build -f Dockerfile.dev -t basset-hound:dev --no-cache .
docker run -p 8765:8765 basset-hound:dev
```

### Production Setup

```bash
# Build optimized image
docker build -f Dockerfile.prod -t basset-hound:prod .

# Run in background
docker run -d \
  -p 8765:8765 \
  --name basset-hound \
  --restart always \
  basset-hound:prod

# View logs
docker logs -f basset-hound

# Stop
docker stop basset-hound
docker rm basset-hound
```

### Port Forwarding

By default, Docker maps port 8765 to your host machine. To use a different port:

```bash
# Map container port 8765 to host port 9000
docker run -p 9000:8765 basset-hound:dev

# Now connect to ws://localhost:9000
```

### Networking

Connect to the official Docker network:

```bash
docker network create basset-hound-browser

docker run -d \
  --network basset-hound-browser \
  --name basset-hound \
  -p 8765:8765 \
  basset-hound:prod
```

Other containers can now connect via:
```
ws://basset-hound:8765
```

### Volume Mounting

For development with live code changes:

```bash
docker run -d \
  -p 8765:8765 \
  -v $(pwd):/app \
  basset-hound:dev
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 8765
lsof -i :8765

# Kill the process (on macOS/Linux)
kill -9 <PID>

# Or use a different port
docker run -p 9000:8765 basset-hound:dev
```

### Can't Connect to Container

```bash
# Check container is running
docker ps

# Check logs for errors
docker logs <container-id>

# Try connecting to the container's IP directly
docker inspect <container-id> | grep IPAddress
```

### Out of Memory

```bash
# Limit memory usage
docker run -m 2g -p 8765:8765 basset-hound:dev

# Or increase Docker's available memory in settings
```

## Environment Variables

### Development

```bash
docker run \
  -e NODE_ENV=development \
  -e LOG_LEVEL=debug \
  -e ELECTRON_ENABLE_LOGGING=true \
  -p 8765:8765 \
  basset-hound:dev
```

### Production

```bash
docker run \
  -e NODE_ENV=production \
  -e LOG_LEVEL=error \
  -e WEBSOCKET_PORT=8765 \
  -e RATE_LIMIT=true \
  -e SECURITY_STRICT=true \
  -p 8765:8765 \
  basset-hound:prod
```

## Next Steps

- **[Run Your First Command](FIRST-COMMAND.md)** — Test with a simple WebSocket command
- **[Installation & Setup](INSTALLATION.md)** — Install locally with npm
- **[Docker Deployment Guide](../deployment/DOCKER-DEPLOYMENT.md)** — Production Docker setup

## Getting Help

- [Docker Issues](../troubleshooting/DOCKER-ISSUES.md)
- [Connection Issues](../troubleshooting/CONNECTION-ISSUES.md)
- [FAQ](../troubleshooting/FAQ.md)

---

**Image Sizes (Approximate)**
- Development: 3.5 GB (includes DevTools, verbose logging)
- Production: 2.6 GB (optimized, minimal logging)
