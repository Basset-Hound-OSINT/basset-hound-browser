# CI/CD Workflows

This directory contains GitHub Actions workflows that automate testing, building, and deployment of the Basset Hound Browser project.

## Workflow Overview

### 1. Build Pipeline (`build.yml`)
**Trigger:** Push to main/develop, Pull Requests
**Purpose:** Compile, lint, and type-check the codebase
**Steps:**
- Install dependencies
- Run linter
- Type checking
- Build distribution
- Upload build artifacts

**Status Badge:** [![Build & Lint](../../workflows/Build%20&%20Lint/badge.svg)](../../actions/workflows/build.yml)

### 2. Test Suite (`test.yml`)
**Trigger:** Push to main/develop, Pull Requests
**Purpose:** Run comprehensive test coverage
**Test Types:**
- Unit Tests (Jest)
- Integration Tests (60s timeout)
- Bot Detection Tests (120s timeout)
- Evasion Framework Tests
- Coverage reporting

**Outputs:**
- Coverage reports (codecov integration)
- Test result artifacts
- JUnit XML reports

### 3. Security Scanning (`security.yml`)
**Trigger:** Push, Pull Requests, Daily (2am UTC)
**Purpose:** Scan for security vulnerabilities
**Scans:**
- NPM Audit (dependency vulnerabilities)
- Dependency Analysis (versions, updates)
- CodeQL Analysis (code security)
- Container Image Scan (Trivy)

**Action:** Fails on HIGH/CRITICAL vulnerabilities (can be configured)

### 4. Docker Build (`docker.yml`)
**Trigger:** Push to main/develop, Docker file changes, Tag pushes
**Purpose:** Build and push Docker images
**Registries:**
- Docker Hub (if credentials configured)
- GitHub Container Registry (GHCR)

**Features:**
- Multi-platform support
- Automated tagging (branch, version, SHA)
- Layer caching for speed
- Container security scanning
- Smoke tests

### 5. Deployment Pipeline (`deploy.yml`)
**Trigger:** Workflow completion (success), Manual dispatch
**Purpose:** Deploy to staging/production
**Stages:**
1. Readiness check (verify all upstream workflows passed)
2. Staging deployment (automatic)
3. Production deployment (requires manual approval)
4. Smoke tests (post-deployment verification)
5. Rollback (automatic on failure)

**Requirements:**
- Main branch only
- All upstream checks passing
- Production: Manual approval via workflow_dispatch

### 6. Performance Testing (`performance.yml`)
**Trigger:** Daily at 3am UTC, Manual dispatch
**Purpose:** Track performance regressions
**Tests:**
- Performance regression tests
- Load testing (10, 50, 200 concurrent)
- Benchmark comparison
- Trend analysis

**Metrics Tracked:**
- WebSocket connection time
- Message throughput
- Memory usage
- CPU usage
- Screenshot generation time

## Quick Start

### Enable Workflows
Workflows are automatically enabled when `.github/workflows/*.yml` files are present and pushed to the repository.

### Configure Secrets
Required secrets for full functionality:

```bash
# For Docker Hub push
DOCKERHUB_USERNAME=<your-username>
DOCKERHUB_TOKEN=<your-token>

# For private registries
REGISTRY_URL=<registry-url>
REGISTRY_USERNAME=<username>
REGISTRY_PASSWORD=<password>
```

Set secrets in GitHub:
1. Go to Settings > Secrets and variables > Actions
2. Add each secret (use "New repository secret")
3. Name exactly as shown above

### Manual Workflow Triggers

Trigger workflows manually:
```bash
# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy to production (requires approval)
gh workflow run deploy.yml -f environment=production -f version=12.0.0

# Run performance tests
gh workflow run performance.yml
```

## Workflow Dependencies

Workflows are chained for efficiency:

```
build.yml ──┐
           ├──> test.yml ──────┐
security.yml                  ├──> deploy.yml
docker.yml ────────────────┘
```

**Rule:** Deployment only proceeds if all upstream workflows succeed.

## Status Checks

GitHub branch protection rules recommend:
- ✅ Build & Lint
- ✅ Test Suite
- ✅ Security Scanning
- ✅ Docker Build

These ensure code quality before merging to main.

## Local Testing

Run workflows locally to debug:

```bash
# Run test suite
./scripts/run-tests.sh all

# Run specific test type
./scripts/run-tests.sh unit
./scripts/run-tests.sh integration
./scripts/run-tests.sh bot-detection

# Deploy locally with Docker
./scripts/docker-deploy.sh
```

## Test Coverage

**Coverage Requirements:**
- Minimum: 50% (configurable in `package.json`)
- Target: 70%
- Critical paths: 85%+

Coverage reports uploaded to [Codecov](https://codecov.io) when enabled.

## Artifact Retention

| Artifact | Retention | Purpose |
|----------|-----------|---------|
| Build artifacts | 7 days | Quick rollback |
| Test results | 30 days | Trend analysis |
| Security reports | 30 days | Audit trail |
| Deployment records | 90 days | Compliance |
| Performance metrics | 90 days | Long-term trends |

## Troubleshooting

### Workflow Failed
1. Click workflow name in Actions tab
2. Review "Logs" for each step
3. Check artifact outputs
4. Common issues:
   - Dependency version conflicts: Run `npm ci` locally
   - Test timeout: Increase timeout in workflow
   - Port in use: Kill process on port 8765

### Test Failures
```bash
# Run test locally with verbose output
npm run test:unit -- --verbose

# Run specific test file
npm run test:unit -- tests/unit/specific-test.js

# Run with coverage
npm run test:unit -- --coverage
```

### Docker Build Failures
```bash
# Build image locally
docker build -t basset-hound-browser:test .

# Debug container
docker run -it basset-hound-browser:test /bin/bash
```

### Deployment Issues
Check logs:
```bash
# View container logs
docker logs basset-hound-browser

# Check health
docker inspect basset-hound-browser --format='{{.State.Health.Status}}'
```

## Performance Optimization

### Cache Strategy
- Node modules are cached between runs
- Docker layers are cached in registry
- Artifacts expire after configured retention

### Parallel Execution
- Unit tests run in parallel
- Integration tests run independently
- Load tests are sequential

### Timeout Management
- Unit tests: 10s timeout
- Integration tests: 60s timeout
- Bot detection tests: 120s timeout
- Docker build: 30m timeout

## Security Best Practices

1. **Secrets Management**
   - Never commit secrets to repo
   - Use GitHub Secrets for all credentials
   - Rotate credentials regularly

2. **Container Security**
   - Run Trivy scan on all images
   - Address HIGH/CRITICAL vulnerabilities
   - Use signed images when possible

3. **Access Control**
   - Limit production deployment to maintainers
   - Require code review before merge
   - Enable branch protection rules

4. **Audit Trail**
   - Keep deployment records (90 days)
   - Review workflow logs regularly
   - Monitor security scan results

## Integration Points

### Codecov
Coverage reports automatically uploaded:
- View at: https://codecov.io/gh/YOUR_ORG/basset-hound-browser

### GitHub Pages
Deploy documentation:
```yaml
# Add to workflow to publish docs
- name: Deploy docs
  uses: actions/deploy-pages@v2
  if: github.ref == 'refs/heads/main'
```

### Slack Notifications
Post workflow status:
```bash
gh api repos/{owner}/{repo}/actions/runs \
  -H "Accept: application/vnd.github+json"
```

## Maintenance

### Weekly Tasks
- Review test failures and fix flaky tests
- Check security scan results
- Monitor performance trends

### Monthly Tasks
- Update workflow documentation
- Review and update cron schedules
- Audit workflow permissions

### Quarterly Tasks
- Review artifact retention policies
- Evaluate new GitHub Actions
- Plan capacity for test infrastructure

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Jest Testing](https://jestjs.io/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [CodeQL Analysis](https://codeql.github.com/)

---

**Last Updated:** 2026-06-13
**Version:** 1.0.0
