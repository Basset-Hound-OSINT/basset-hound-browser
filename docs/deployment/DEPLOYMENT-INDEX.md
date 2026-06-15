# Basset Hound Browser - Dual Deployment Infrastructure Index

**Version**: v12.3.0  
**Date**: June 14, 2026  
**Status**: COMPLETE - READY FOR PRODUCTION

## Quick Links

### Start Here
1. **[DUAL-DEPLOYMENT-INFRASTRUCTURE-SUMMARY.txt](DUAL-DEPLOYMENT-INFRASTRUCTURE-SUMMARY.txt)** - Executive overview
2. **[RELEASE-NOTES-v12.3.0.md](RELEASE-NOTES-v12.3.0.md)** - What's new in v12.3.0

### Documentation
- **[docs/DEPLOYMENT-RUNBOOK-v12.3.0.md](docs/DEPLOYMENT-RUNBOOK-v12.3.0.md)** - Complete runbook
- **[docs/handoffs/DUAL-DEPLOYMENT-SETUP-COMPLETE-2026-06-14.md](docs/handoffs/DUAL-DEPLOYMENT-SETUP-COMPLETE-2026-06-14.md)** - Handoff document

## Directory Structure

```
/home/devel/basset-hound-browser/
├── config/
│   ├── production.env           # v12.2.0 production settings
│   └── development.env          # v12.3.0+ development settings
│
├── docker-compose.production.yml    # v12.2.0 stable deployment
├── docker-compose.development.yml   # v12.3.0+ latest deployment
│
├── scripts/
│   ├── deploy-production.sh     # Production deployment (with canary)
│   ├── deploy-development.sh    # Development auto-deploy
│   ├── health-check-prod.sh     # Production health checks
│   ├── health-check-dev.sh      # Development health checks
│   └── rollback-production.sh   # Emergency rollback
│
├── docs/
│   ├── DEPLOYMENT-RUNBOOK-v12.3.0.md
│   └── handoffs/
│       └── DUAL-DEPLOYMENT-SETUP-COMPLETE-2026-06-14.md
│
├── DEPLOYMENT-INDEX.md          # This file
├── DUAL-DEPLOYMENT-INFRASTRUCTURE-SUMMARY.txt
└── RELEASE-NOTES-v12.3.0.md
```

## Production Environment (v12.2.0)

### Configuration
- **Env File**: `config/production.env`
- **Compose File**: `docker-compose.production.yml`
- **Image**: `basset-hound-browser:v12.2.0`
- **Port**: 8765 (public)

### Deployment
```bash
# Basic deployment
./scripts/deploy-production.sh

# Safe canary deployment (RECOMMENDED)
./scripts/deploy-production.sh --canary

# Health check
./scripts/health-check-prod.sh --verbose

# Emergency rollback
./scripts/rollback-production.sh
```

### Features
- Version-locked at v12.2.0
- Quarterly update cycle
- Canary deployments
- Automatic backups (30-day retention)
- 99.9% SLA monitoring
- 7-point health checks
- Alert webhook support

### Networking
- Network: `basset-hound-prod`
- WebSocket Port: 8765 (public)
- Metrics Port: 9090
- Tor Control: 9051

## Development Environment (v12.3.0+)

### Configuration
- **Env File**: `config/development.env`
- **Compose File**: `docker-compose.development.yml`
- **Image**: `basset-hound-browser:latest`
- **Port**: 8766 (internal)

### Deployment
```bash
# Standard deployment
./scripts/deploy-development.sh

# Rebuild from scratch
./scripts/deploy-development.sh --rebuild

# Watch deployment logs
./scripts/deploy-development.sh --watch

# Health check
./scripts/health-check-dev.sh --watch
```

### Features
- Latest code (v12.3.0+)
- Weekly auto-deploy from main
- Hot reload on source changes
- Full debug logging
- All experimental features
- Quick startup (< 30 seconds)

### Networking
- Network: `basset-hound-dev`
- WebSocket Port: 8766 (internal)
- Tor SOCKS: 9050
- Tor Control: 9051
- Metrics Port: 9091

## Health Checks

### Production
```bash
./scripts/health-check-prod.sh
./scripts/health-check-prod.sh --verbose
./scripts/health-check-prod.sh --alert-webhook https://example.com/webhook
```

Checks:
1. Container is running
2. WebSocket health endpoint
3. Readiness endpoint
4. Memory usage (< 80%)
5. Volume mounts
6. Network connectivity
7. Prometheus metrics

### Development
```bash
./scripts/health-check-dev.sh
./scripts/health-check-dev.sh --verbose
./scripts/health-check-dev.sh --watch
```

Checks:
1. Container is running
2. WebSocket health endpoint
3. Container resource usage
4. Volume mounts
5. Prometheus metrics

## Rollback Procedures

### Emergency Rollback
```bash
# Interactive (with confirmation)
./scripts/rollback-production.sh

# Force rollback (no confirmation)
./scripts/rollback-production.sh --force

# Rollback to specific version
./scripts/rollback-production.sh --to-version 12.0.0 --force
```

Rollback to: v12.1.0 (default)

## Configuration Details

### Production (config/production.env)
- NODE_ENV: production
- LOG_LEVEL: info
- SECURITY_MODE: strict
- Memory Limit: 1900MB
- CPU Limit: 2 cores
- Health Check: 30-second intervals

### Development (config/development.env)
- NODE_ENV: development
- LOG_LEVEL: debug
- SECURITY_MODE: development
- Memory Limit: 3800MB
- CPU Limit: 4 cores
- Health Check: 15-second intervals

## Endpoints

| Component | Production | Development |
|-----------|-----------|-------------|
| WebSocket | ws://localhost:8765 | ws://localhost:8766 |
| Health | http://localhost:8765/health | http://localhost:8765/health |
| Ready | http://localhost:8765/ready | http://localhost:8765/ready |
| Metrics | http://localhost:9090/metrics | http://localhost:9091/metrics |

## Common Commands

### Production Management
```bash
# Deploy
./scripts/deploy-production.sh --canary

# Monitor
./scripts/health-check-prod.sh --verbose

# Rollback
./scripts/rollback-production.sh

# Logs
docker logs basset-hound-browser-prod
docker logs -f basset-hound-browser-prod

# Stats
docker stats basset-hound-browser-prod

# Stop/Start
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Development Management
```bash
# Deploy
./scripts/deploy-development.sh --rebuild

# Monitor
./scripts/health-check-dev.sh --watch

# Logs
docker logs -f basset-hound-browser-dev

# Stats
docker stats basset-hound-browser-dev

# Stop/Start
docker-compose -f docker-compose.development.yml down
docker-compose -f docker-compose.development.yml up -d
```

## Troubleshooting

### Container Won't Start
```bash
docker logs basset-hound-browser-prod
docker images | grep basset-hound-browser
netstat -tlnp | grep 8765
```

### Health Check Fails
```bash
./scripts/health-check-prod.sh --verbose
curl -v http://localhost:8765/health
docker stats basset-hound-browser-prod
```

### Memory Too High
```bash
docker stats --no-stream basset-hound-browser-prod
docker exec basset-hound-browser-prod ps aux
```

## Update Schedule

**Production**: Quarterly (v12.2.0 locked)
- Q2 2026: v12.2.0 (Current)
- Q3 2026: v12.3.0 (Target Aug 15)
- Q4 2026: v12.4.0 (Planned Nov 15)

**Development**: Weekly (Latest v12.3.0+)
- Auto-deployed from main branch

## Support Resources

1. **docs/DEPLOYMENT-RUNBOOK-v12.3.0.md** - Comprehensive runbook
2. **RELEASE-NOTES-v12.3.0.md** - Features and changelog
3. **docs/handoffs/DUAL-DEPLOYMENT-SETUP-COMPLETE-2026-06-14.md** - Handoff guide
4. **DUAL-DEPLOYMENT-INFRASTRUCTURE-SUMMARY.txt** - Quick reference

## Quality Gates

All quality gates met:
- ✓ Production scripts working
- ✓ Development auto-deploy configured
- ✓ Health checks operational
- ✓ Environments isolated
- ✓ Rollback procedures functional
- ✓ Documentation complete

## Status

**COMPLETE - READY FOR PRODUCTION OPERATIONS**

All infrastructure components are in place and ready for deployment.

---

**Created**: June 14, 2026  
**Last Updated**: June 14, 2026
