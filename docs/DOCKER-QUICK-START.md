# Basset Hound Browser - Docker Quick Start Guide

## Overview

This guide provides quick-start instructions for running the Basset Hound Browser in Docker for different environments (development, testing, production).

## Prerequisites

- Docker >= 20.10
- Docker Compose >= 1.29
- 4GB+ RAM available (8GB+ recommended for production)
- Linux kernel with support for Xvfb virtual display

## Quick Start (5 minutes)

### Production Deployment

```bash
# Single command quick start
cd /path/to/basset-hound-browser
./scripts/docker/quick-start.sh --prod

# Or use docker-compose directly
cd config/docker
docker-compose up -d

# Verify
docker-compose logs
```

Access the WebSocket API at: `ws://localhost:8765`

### Development Environment

```bash
# Start with source code hot-reload
./scripts/docker/quick-start.sh --dev

# Follow logs
docker-compose -f config/docker/docker-compose.dev.yml logs -f

# Modify source code and changes reload automatically
```

### Testing Environment

```bash
# Run with test configuration
./scripts/docker/quick-start.sh --test

# Run integration tests
docker-compose -f config/docker/docker-compose.test.yml exec basset-hound-browser npm test
```

## Building the Docker Image

### Standard Build
```bash
./scripts/docker/build.sh
```

### Build without Cache (fresh dependencies)
```bash
./scripts/docker/build.sh --no-cache
```

### Build with Custom Tag
```bash
./scripts/docker/build.sh --tag 12.1.0
```

## Docker Compose Modes

### Production (docker-compose.yml)
- **Features:** High availability, strict security, monitoring
- **Resource Limits:** 2 CPU, 2GB RAM (reservations: 0.5 CPU, 512MB)
- **Restart Policy:** on-failure:5
- **Logging:** 10MB max per file, 5 files retained
- **Use Case:** Production deployments

```bash
docker-compose up -d
```

### Development (docker-compose.dev.yml)
- **Features:** Hot reload, extensive logging, debug mode
- **Resource Limits:** 4 CPU, 4GB RAM (reservations: 1 CPU, 1GB)
- **Restart Policy:** on-failure:3
- **Logging:** 50MB max per file, 5 files retained
- **Use Case:** Local development with live code reload

```bash
docker-compose -f config/docker/docker-compose.dev.yml up
```

### Testing (docker-compose.test.yml)
- **Features:** Fast startup, isolated environment, comprehensive logging
- **Resource Limits:** 2 CPU, 2GB RAM (reservations: 0.5 CPU, 512M)
- **Restart Policy:** on-failure:10
- **Logging:** 100MB max per file, 10 files retained
- **Use Case:** Integration testing and CI/CD

```bash
docker-compose -f config/docker/docker-compose.test.yml up --abort-on-container-exit
```

## Ports and Services

| Service | Port | Mode | Purpose |
|---------|------|------|---------|
| WebSocket API | 8765 | All | Browser control interface |
| Tor SOCKS | 9050 | Dev/Test | Anonymization proxy |
| Tor Control | 9051 | Dev/Test | Circuit management |

## Volume Mounts

### Production
- `/app/data` - Persistent application data
- `/app/logs` - Application logs
- `/app/downloads` - Downloaded files
- `/app/screenshots` - Captured screenshots

### Development
- `/app/src` - Source code (hot-reload)
- `/app/websocket` - WebSocket implementation
- `/app/evasion` - Evasion modules
- `/app/extraction` - Extraction modules
- `/app/proxy` - Proxy management
- `/app/blocking` - Request blocking
- `/app/data` - Development data

### Testing
- `/app/data` - Isolated test data
- `/app/screenshots` - Test screenshots
- `/app/logs` - Test logs
- `/app/tests` - Test suite

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | production | Runtime environment |
| `LOG_LEVEL` | info | Logging verbosity |
| `DISPLAY` | :99 | Virtual display number |
| `SCREEN_RESOLUTION` | 1920x1080x24 | Virtual screen dimensions |
| `ELECTRON_DISABLE_SANDBOX` | 1 | Disable Electron sandbox |
| `USE_SYSTEM_TOR` | true | Use system Tor daemon |

## Monitoring and Logs

### View Real-time Logs
```bash
# Production
docker-compose logs -f

# Development
docker-compose -f config/docker/docker-compose.dev.yml logs -f

# Test
docker-compose -f config/docker/docker-compose.test.yml logs -f

# Show last 100 lines
docker-compose logs --tail 100
```

### Container Health Status
```bash
docker-compose ps

# Detailed health info
docker inspect $(docker-compose ps -q) --format='{{.State.Health.Status}}'
```

### Resource Usage
```bash
docker stats

# Monitor specific container
docker stats basset-hound-browser-prod
```

## Common Commands

### Stop Application
```bash
docker-compose stop
# or
docker-compose -f config/docker/docker-compose.dev.yml stop
```

### Restart Application
```bash
docker-compose restart
```

### Remove Containers and Volumes
```bash
docker-compose down
# Also remove volumes
docker-compose down -v
```

### Clean Up
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Full cleanup (caution!)
docker system prune -a
```

## Testing the Installation

### Validation Test
```bash
./scripts/docker/test.sh
```

### Build Test
```bash
./scripts/docker/test.sh --build
```

### Full Test Suite
```bash
./scripts/docker/test.sh --full
```

## Troubleshooting

### Container Fails to Start

1. Check Docker daemon:
```bash
docker ps
```

2. View container logs:
```bash
docker-compose logs basset-hound-browser
```

3. Rebuild image:
```bash
./scripts/docker/build.sh --no-cache
```

### WebSocket Not Responding

1. Verify container is running:
```bash
docker-compose ps
```

2. Check health:
```bash
docker-compose exec basset-hound-browser curl http://localhost:8765
```

3. Restart container:
```bash
docker-compose restart
```

### Port Already in Use

1. Find process using port:
```bash
lsof -i :8765
```

2. Either stop the process or use different port:
```bash
docker-compose down
docker-compose up -d -p 9999:8765
```

### High Memory Usage

1. Check current usage:
```bash
docker stats
```

2. Adjust resource limits in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 4G
```

3. Restart:
```bash
docker-compose restart
```

### Tor Connection Issues

If Tor fails to bootstrap:

1. Check Tor status:
```bash
docker-compose exec basset-hound-browser netstat -an | grep 9050
```

2. View Tor logs:
```bash
docker-compose logs | grep -i tor
```

3. Disable Tor if not needed:
```bash
docker-compose exec -e USE_SYSTEM_TOR=false basset-hound-browser bash
```

## Performance Tips

### Image Size Optimization
- Multi-stage build reduces final image from ~3.5GB to ~2.6GB
- Unused build dependencies removed at each stage

### Caching Strategy
- Layer caching optimizes rebuild times
- Dependencies cached independently of source code
- Use `--no-cache` only when necessary

### Resource Optimization
- Production: 2 CPU, 2GB RAM (tests pass at 200+ concurrent)
- Development: 4 CPU, 4GB RAM (for hot-reload responsiveness)
- Testing: 2 CPU, 2GB RAM (isolated environment)

### Network Optimization
- Compression: 70-93% bandwidth reduction
- Latency: <2ms P99 response time
- Throughput: 481 msgs/sec (50 concurrent), 285 msgs/sec (200 concurrent)

## SSL/TLS Configuration

To enable HTTPS for WebSocket connections:

1. Create certificates:
```bash
mkdir -p config/docker/certs
openssl req -x509 -newkey rsa:4096 -nodes -out config/docker/certs/server.crt -keyout config/docker/certs/server.key -days 365
```

2. Uncomment in docker-compose.yml:
```yaml
environment:
  - BASSET_WS_SSL_ENABLED=true
  - BASSET_WS_SSL_CERT=/run/secrets/server_cert
  - BASSET_WS_SSL_KEY=/run/secrets/server_key
volumes:
  - ./certs:/app/certs:ro
```

3. Restart:
```bash
docker-compose restart
```

## Integration with External Systems

### Network Communication
Containers can communicate via Docker network `basset-hound-prod`:

```bash
# From another container on the same network
curl http://basset-hound-browser-prod:8765
```

### Volume Mounting for External Data
```bash
docker-compose exec basset-hound-browser ls /app/downloads
```

### Environment File
Create `.env` file for secret configuration:

```bash
BASSET_WS_TOKEN=your-secret-token
BASSET_WS_SSL_ENABLED=true
```

Then reference in docker-compose.yml:
```yaml
environment:
  - BASSET_WS_TOKEN=${BASSET_WS_TOKEN}
```

## Next Steps

- See [DOCKER-ADVANCED.md](DOCKER-ADVANCED.md) for advanced configuration
- Check [API-REFERENCE.md](API-REFERENCE.md) for WebSocket API details
- Review [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for production setup

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review troubleshooting section above
3. Check project documentation in `/docs`
4. Open an issue with error details and logs

## Additional Resources

- Docker Documentation: https://docs.docker.com
- Electron Documentation: https://www.electronjs.org/docs
- Tor Documentation: https://www.torproject.org/docs/
