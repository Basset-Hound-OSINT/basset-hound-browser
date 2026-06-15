# Basset Hound Browser - Release Notes v12.3.0

**Release Date**: June 14, 2026  
**Status**: Dual Deployment Infrastructure Ready

## Summary

v12.3.0 introduces the dual deployment infrastructure with strict separation between production (v12.2.0 stable) and development (v12.3.0+ latest) environments.

## New Features

### 1. Production Deployment Infrastructure

- **Version Lock**: v12.2.0 locked for quarterly updates only
- **SLA**: 99.9% uptime guarantee
- **Canary Deployments**: Safe rolling updates with automatic rollback
- **Backup Strategy**: Daily snapshots with 30-day retention
- **Health Monitoring**: Comprehensive health checks (7 metrics)

### 2. Development Deployment Infrastructure

- **Auto-Deploy**: Continuous deployment from main branch
- **Weekly Updates**: Latest code deployed automatically
- **Hot Reload**: Source code changes reflected immediately
- **Debug Mode**: Full debugging enabled by default
- **Experimental Features**: All feature flags enabled

### 3. Deployment Scripts

#### Production (`./scripts/deploy-production.sh`)
- Basic deployment
- Canary deployment (recommended)
- Forced deployment (emergency only)
- Automatic backup and rollback on failure

#### Development (`./scripts/deploy-development.sh`)
- Quick deployment (< 30 seconds)
- Rebuild from scratch
- Watch mode for logs
- Automatic source code mounting

### 4. Health Check Scripts

#### Production (`./scripts/health-check-prod.sh`)
- 7-point health verification
- Alert webhook support
- SLA compliance checking
- Memory/resource monitoring

#### Development (`./scripts/health-check-dev.sh`)
- Quick health verification
- Continuous watch mode
- Development-specific checks
- Minimal overhead

### 5. Rollback Infrastructure

- **Automatic Rollback**: On deployment failure
- **Emergency Rollback**: Manual rollback to v12.1.0
- **Version Flexibility**: Rollback to any previous version
- **Data Preservation**: All production data preserved
- **Recovery Snapshots**: Created before each rollback

### 6. Configuration Management

#### Production Config (`config/production.env`)
- Version-locked at v12.2.0
- Strict security settings
- Conservative feature flags
- Database schema v12.2.0

#### Development Config (`config/development.env`)
- Version: latest (12.3.0+)
- All experimental features enabled
- Debug logging
- Testing configuration

### 7. Docker Compose Files

#### Production (`docker-compose.production.yml`)
- Image: `basset-hound-browser:v12.2.0`
- Port: 8765 (public)
- Resource limits: 2GB memory, 2 CPUs
- Restart policy: on-failure:5
- Separate volumes (basset-prod-*)

#### Development (`docker-compose.development.yml`)
- Image: `basset-hound-browser:latest`
- Port: 8766 (internal)
- Resource limits: 4GB memory, 4 CPUs
- Source code mounts for hot reload
- Separate volumes (basset-dev-*)

## Breaking Changes

None - v12.3.0 is a deployment infrastructure update with no application code changes.

## Migration Guide

### From Single Deployment to Dual Deployment

1. **Backup existing deployment**
   ```bash
   docker-compose down
   docker volume ls
   docker volume inspect basset-prod-data
   ```

2. **Deploy production (v12.2.0)**
   ```bash
   ./scripts/deploy-production.sh --canary
   ```

3. **Deploy development (v12.3.0+)**
   ```bash
   ./scripts/deploy-development.sh
   ```

4. **Verify both environments**
   ```bash
   ./scripts/health-check-prod.sh --verbose
   ./scripts/health-check-dev.sh --verbose
   ```

## Performance Metrics

### Production (v12.2.0)
- **SLA**: 99.9% uptime
- **Deployment Time**: 2-3 minutes
- **Startup Time**: < 60 seconds
- **Health Check**: 30-second intervals
- **Memory Limit**: 2GB

### Development (v12.3.0+)
- **Auto-Deploy**: < 30 seconds
- **Startup Time**: < 30 seconds
- **Health Check**: 15-second intervals
- **Memory Limit**: 4GB

## Files Changed

### New Files
- `config/production.env`
- `config/development.env`
- `docker-compose.production.yml`
- `docker-compose.development.yml`
- `scripts/deploy-production.sh`
- `scripts/deploy-development.sh`
- `scripts/health-check-prod.sh`
- `scripts/health-check-dev.sh`
- `scripts/rollback-production.sh`
- `docs/DEPLOYMENT-RUNBOOK-v12.3.0.md`
- `RELEASE-NOTES-v12.3.0.md`

### Modified Files
- None (v12.3.0 is deployment infrastructure only)

## Quality Gates Met

- [x] Production scripts tested and working
- [x] Development auto-deploy configured
- [x] Health checks operational
- [x] Both environments isolated
- [x] Rollback procedures functional
- [x] Documentation complete

## Known Issues

None

## Future Improvements (v12.4.0+)

1. **Enhanced Monitoring**
   - Prometheus + Grafana integration
   - Real-time alerting
   - Performance trending

2. **Multi-Region Deployment**
   - Regional failover
   - Geographic distribution
   - Load balancing

3. **Automated Testing**
   - Canary automated testing
   - Regression test suite
   - Performance benchmarking

4. **Advanced Rollback**
   - Blue-green deployments
   - Zero-downtime updates
   - Database migration support

## Support

For deployment issues:

1. Check logs:
   ```bash
   docker logs basset-hound-browser-prod
   docker logs basset-hound-browser-dev
   ```

2. Run health checks:
   ```bash
   ./scripts/health-check-prod.sh --verbose
   ./scripts/health-check-dev.sh --verbose
   ```

3. Review documentation:
   - `docs/DEPLOYMENT-RUNBOOK-v12.3.0.md`
   - Script help: `--help` flag on deployment scripts

## Handoff

Handoff document: `docs/handoffs/DUAL-DEPLOYMENT-SETUP-COMPLETE-2026-06-14.md`

Key deliverables:
- Production deployment (v12.2.0) ready to execute
- Development deployment (v12.3.0+) auto-deploying
- Monitoring for both environments
- Rollback capability
- Complete documentation
