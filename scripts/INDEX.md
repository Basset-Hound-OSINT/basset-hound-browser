# Scripts Index

**Last Updated:** May 11, 2026  
**Version:** 11.3.0

---

## Overview

This directory contains build, deployment, installation, and utility scripts for Basset Hound Browser.

---

## Installation Scripts

### `/install/`
Installation and setup utilities:
- **Dependency installation** - npm/system package setup
- **Environment configuration** - Config file generation
- **Initialization** - First-time setup procedures

---

## Deployment Scripts

### Core Deployment
- `deploy.sh` - Production deployment script
  - Build verification
  - Docker image creation
  - Container orchestration
  - Health checks
  - Rollback support

- `redeploy.sh` - Redeployment script
  - Previous version detection
  - Minimal downtime redeploy
  - State preservation
  - Health verification

### Monitoring & Operations
- `setup-monitoring.sh` - Monitoring setup
  - Prometheus integration
  - Alert configuration
  - Metric collection
  - Dashboard setup

---

## Build Scripts

### Build Process
- Build verification
- Artifact generation
- Docker image creation
- Package preparation

### Execution
```bash
npm run build        # Build production artifacts
npm run package      # Create distribution packages
```

---

## Development Scripts

### Available via npm
```bash
npm start            # Start development server
npm test             # Run test suite
npm run dev          # Development mode with hot reload
npm run lint         # Code quality checks
npm run format       # Code formatting
```

---

## Testing & Validation Scripts

### Test Execution
Located in `/tests/` directory:
- `comprehensive-integration-test.js` - Full integration validation
- `load-test-v12.js` - Load testing
- `comprehensive-performance-analysis.js` - Performance analysis
- `stability-stress-test-v12.js` - Stability testing

### Running Tests
```bash
npm test                                    # All tests
node tests/comprehensive-integration-test.js # Integration
node tests/load-test-v12.js                 # Load test
```

---

## Utility Scripts

### Common Tasks

**Start Application**
```bash
npm start
```

**Docker Deployment**
```bash
docker build -t basset-hound .
docker run -p 8765:8765 basset-hound
```

**Configuration**
```bash
cp config.example.yaml config.yaml
# Edit config.yaml as needed
```

---

## Script Categories

### Deployment
- Full production deployment
- Staging deployment
- Canary rollout
- Rollback procedures

### Installation
- First-time setup
- Dependency installation
- Environment initialization

### Monitoring
- Alert setup
- Metric collection
- Health checking
- Log aggregation

### Development
- Development server
- Code building
- Testing

### Operations
- Health checks
- Service restart
- Log rotation
- Cleanup procedures

---

## Script Conventions

### Naming
- `*.sh` - Bash scripts
- `deploy.sh` - Deployment scripts
- `setup-*.sh` - Setup scripts
- `test-*.js` - Test scripts

### Error Handling
- Exit codes for failures
- Clear error messages
- Logging to stderr
- Graceful degradation

### Dependencies
- Minimal external dependencies
- Clear prerequisite checking
- Installation helpers

---

## Deployment Workflow

### Pre-Deployment
1. Run test suite
2. Build artifacts
3. Create Docker image
4. Tag version

### Deployment
1. Execute `deploy.sh`
2. Verify health checks
3. Monitor metrics
4. Validate functionality

### Post-Deployment
1. Run integration tests
2. Check logs
3. Monitor resources
4. Verify monitoring

---

## Quick Commands

### Development
```bash
npm start              # Start dev server
npm test               # Run tests
npm run lint           # Code quality
```

### Production Build
```bash
npm run build          # Build production
docker build -t basset-hound . # Create image
docker run -p 8765:8765 basset-hound # Run
```

### Deployment
```bash
./scripts/deploy.sh              # Full deploy
./scripts/redeploy.sh            # Redeploy
./scripts/setup-monitoring.sh    # Setup monitoring
```

### Testing
```bash
npm test                              # All tests
node tests/load-test-v12.js           # Load test
node tests/comprehensive-integration-test.js # Integration
```

---

## Environment Variables

### Deployment
- `NODE_ENV` - Environment (production/development)
- `PORT` - WebSocket port (default: 8765)
- `DEBUG` - Debug logging
- `LOG_LEVEL` - Logging verbosity

### Configuration Files
- `config.yaml` - Application configuration
- `.env` - Environment variables
- `docker-compose.yml` - Docker orchestration

---

## Troubleshooting

### Common Issues
- Port conflicts - Change PORT variable
- Permission denied - Check script execution permissions
- Missing dependencies - Run installation scripts
- Build failures - Check Node.js version compatibility

### Debug Mode
```bash
DEBUG=* npm start          # All debug logs
DEBUG=websocket:* npm start # WebSocket only
```

---

## References

- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/deployment/` - Deployment documentation
- `docs/runbooks/` - Operational runbooks
- `docs/monitoring/` - Monitoring setup

---

## Version History

### v11.3.0 (May 2026)
- Phase 1 & 2 completion
- Enhanced monitoring setup
- Production deployment validation

### v11.2.0 (May 2026)
- Docker deployment scripts
- Monitoring integration
- Canary deployment support

### v11.1.0 (Jan-May 2026)
- Basic deployment scripts
- Environment configuration

---

**Status:** ✅ Production Ready  
**Last Updated:** May 11, 2026  
**Maintained By:** Development Team
