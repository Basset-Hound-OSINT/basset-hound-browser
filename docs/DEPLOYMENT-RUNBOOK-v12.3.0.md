# Basset Hound Browser - Deployment Runbook (v12.3.0)

## Overview

This runbook covers the dual deployment infrastructure for Basset Hound Browser:

- **Production Environment (v12.2.0)** - Stable, version-locked, SLA: 99.9% uptime
- **Development Environment (v12.3.0+)** - Latest code, experimental features, auto-deploys

## Architecture

### Network Topology

Production (v12.2.0):
- Port 8765: WebSocket API (Public)
- Port 9090: Prometheus metrics
- Port 9051: Tor control

Development (v12.3.0+):
- Port 8766: WebSocket API mapped (Internal)
- Port 9050: Tor SOCKS proxy
- Port 9051: Tor control
- Port 9091: Prometheus metrics

### Volumes

Production:
- `basset-prod-data` - Persistent application data (v12.2.0 schema)
- `basset-prod-logs` - Application logs
- `basset-prod-downloads` - Downloaded files
- `basset-prod-screenshots` - Screenshot artifacts

Development:
- `basset-dev-data` - Development data (separate)
- `basset-dev-logs` - Development logs
- Source code mounts for hot reload

## Production Deployment (v12.2.0)

### Basic Deployment

```bash
./scripts/deploy-production.sh
```

### Canary Deployment (Recommended)

```bash
./scripts/deploy-production.sh --canary
```

Tests in canary container before full deployment.

### Forced Deployment

```bash
./scripts/deploy-production.sh --force
```

Skips version verification (not recommended).

## Development Deployment (v12.3.0+)

### Manual Deployment

```bash
./scripts/deploy-development.sh
```

### Rebuild from Scratch

```bash
./scripts/deploy-development.sh --rebuild
```

### Watch Logs

```bash
./scripts/deploy-development.sh --watch
```

## Health Checks

### Production

```bash
./scripts/health-check-prod.sh
./scripts/health-check-prod.sh --verbose
./scripts/health-check-prod.sh --alert-webhook <url>
```

### Development

```bash
./scripts/health-check-dev.sh
./scripts/health-check-dev.sh --verbose
./scripts/health-check-dev.sh --watch
```

## Rollback

### Emergency Rollback to v12.1.0

```bash
./scripts/rollback-production.sh
```

With confirmation prompt.

### Force Rollback

```bash
./scripts/rollback-production.sh --force
```

### Rollback to Specific Version

```bash
./scripts/rollback-production.sh --to-version 12.0.0 --force
```

## Quick Commands

```bash
# Production health
./scripts/health-check-prod.sh --verbose

# Development health
./scripts/health-check-dev.sh --watch

# Container logs
docker logs basset-hound-browser-prod
docker logs -f basset-hound-browser-dev

# Container stats
docker stats basset-hound-browser-prod
docker stats basset-hound-browser-dev

# Manual management
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.development.yml restart
```

## Endpoints

| Environment | WebSocket | Health | Metrics |
|-------------|-----------|--------|---------|
| Production | ws://localhost:8765 | http://localhost:8765/health | http://localhost:9090/metrics |
| Development | ws://localhost:8766 | http://localhost:8765/health | http://localhost:9091/metrics |

## Document History

- v12.3.0 - 2026-06-14 - Dual deployment infrastructure setup
