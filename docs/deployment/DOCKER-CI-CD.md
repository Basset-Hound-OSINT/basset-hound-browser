# Basset Hound Browser - Docker CI/CD Integration

## Overview

This guide provides CI/CD integration patterns for automated Docker builds, testing, and deployment.

## GitHub Actions Integration

### Build and Push Workflow

Create `.github/workflows/docker-build.yml`:

```yaml
name: Docker Build and Push

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./config/docker/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Test Workflow

Create `.github/workflows/docker-test.yml`:

```yaml
name: Docker Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker
        uses: docker/setup-buildx-action@v2

      - name: Build test image
        run: docker build -f config/docker/Dockerfile -t basset-hound-browser:test .

      - name: Run validation tests
        run: ./scripts/docker/test.sh

      - name: Run integration tests
        run: |
          docker-compose -f config/docker/docker-compose.test.yml up --abort-on-container-exit
          docker-compose -f config/docker/docker-compose.test.yml logs

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: docker-test-results
          path: tests/results/
```

## GitLab CI Integration

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - test
  - deploy

variables:
  REGISTRY: registry.gitlab.com
  IMAGE: $REGISTRY/$CI_PROJECT_PATH
  IMAGE_TAG: $CI_COMMIT_SHA

build:docker:
  stage: build
  image: docker:24.0
  services:
    - docker:24.0-dind
  script:
    - docker build -f config/docker/Dockerfile -t $IMAGE:$IMAGE_TAG .
    - docker push $IMAGE:$IMAGE_TAG
  only:
    - main
    - develop

test:docker:
  stage: test
  image: docker:24.0
  services:
    - docker:24.0-dind
  script:
    - docker build -f config/docker/Dockerfile -t basset-hound-browser:test .
    - docker-compose -f config/docker/docker-compose.test.yml up --abort-on-container-exit
  artifacts:
    paths:
      - tests/results/
    expire_in: 30 days

deploy:production:
  stage: deploy
  image: docker:24.0
  script:
    - docker pull $IMAGE:$IMAGE_TAG
    - docker tag $IMAGE:$IMAGE_TAG $IMAGE:latest
    - docker push $IMAGE:latest
  environment:
    name: production
  only:
    - tags
    - main
```

## Docker Registry

### Build and Push to Docker Hub

```bash
# Login
docker login

# Build
docker build -f config/docker/Dockerfile -t username/basset-hound-browser:12.0.0 .

# Push
docker push username/basset-hound-browser:12.0.0

# Tag as latest
docker tag username/basset-hound-browser:12.0.0 username/basset-hound-browser:latest
docker push username/basset-hound-browser:latest
```

### Build and Push to Private Registry

```bash
# Login to private registry
docker login registry.example.com

# Build with registry tag
docker build \
  -f config/docker/Dockerfile \
  -t registry.example.com/basset-hound-browser:12.0.0 .

# Push to private registry
docker push registry.example.com/basset-hound-browser:12.0.0
```

## Multi-Architecture Builds

For ARM64 and x86_64 support:

```bash
# Enable buildx
docker buildx create --name multibuilder
docker buildx use multibuilder

# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f config/docker/Dockerfile \
  -t registry.example.com/basset-hound-browser:12.0.0 \
  --push .
```

## Testing in CI/CD

### Automated Tests

```bash
# Unit tests
docker-compose -f config/docker/docker-compose.test.yml exec \
  basset-hound-browser npm run test:unit

# Integration tests
docker-compose -f config/docker/docker-compose.test.yml exec \
  basset-hound-browser npm run test:integration

# Bot detection tests
docker-compose -f config/docker/docker-compose.test.yml exec \
  basset-hound-browser npm run test:bot-detection

# Coverage report
docker-compose -f config/docker/docker-compose.test.yml exec \
  basset-hound-browser npm run test:coverage
```

### Health Checks in CI

```bash
#!/bin/bash
set -e

# Build image
docker build -f config/docker/Dockerfile -t basset-hound-browser:test .

# Start container
docker run -d --name test-container basset-hound-browser:test

# Wait for health
echo "Waiting for container health..."
for i in {1..30}; do
  if docker exec test-container /app/health-check.sh; then
    echo "Container is healthy"
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo "Container failed to become healthy"
exit 1
```

## Deployment Patterns

### Staging Deployment

```yaml
deploy:staging:
  stage: deploy
  environment:
    name: staging
  script:
    - ./scripts/docker/build.sh --tag staging
    - docker tag basset-hound-browser:staging basset-hound-browser:prod-staging
    - docker-compose -f config/docker/docker-compose.yml down
    - docker-compose -f config/docker/docker-compose.yml up -d
  only:
    - develop
```

### Blue-Green Deployment

```bash
#!/bin/bash
# Deploy to green environment
CURRENT=$(docker-compose ps -q)
COMPOSE_PROJECT_NAME=green docker-compose -f config/docker/docker-compose.yml up -d

# Health check
sleep 30
if docker inspect $(docker-compose ps -q --filter name=green) --format='{{.State.Health.Status}}' | grep -q healthy; then
  # Switch traffic to green
  docker-compose down
  docker-compose -f docker-compose.yml rename green basset-hound-browser-prod
else
  # Rollback
  docker-compose -p green down
  echo "Deployment failed, rolled back"
  exit 1
fi
```

### Canary Deployment

```yaml
deploy:canary:
  stage: deploy
  environment:
    name: canary
  script:
    - ./scripts/docker/build.sh --tag canary
    - docker run -d --name basset-hound-browser-canary basset-hound-browser:canary
    - sleep 30
    - docker exec basset-hound-browser-canary /app/health-check.sh
    - if [ $? -eq 0 ]; then
        docker tag basset-hound-browser:canary basset-hound-browser:latest
      else
        docker rm -f basset-hound-browser-canary
        exit 1
      fi
  only:
    - main
```

## Continuous Deployment

### Auto-Deploy on Tag

```bash
#!/bin/bash
# Triggered by git tag

VERSION=${CI_COMMIT_TAG#v}
IMAGE="basset-hound-browser:$VERSION"

# Build
docker build -f config/docker/Dockerfile -t $IMAGE .

# Test
./scripts/docker/test.sh

# Push to registry
docker push $IMAGE
docker tag $IMAGE basset-hound-browser:latest
docker push basset-hound-browser:latest

# Deploy to production
docker pull $IMAGE
docker stop basset-hound-browser || true
docker rm basset-hound-browser || true
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  --restart unless-stopped \
  $IMAGE
```

## Rollback Procedures

### Automatic Rollback

```bash
#!/bin/bash
# Rollback to previous version

PREVIOUS_IMAGE=$(docker images basset-hound-browser --format "{{.Repository}}:{{.Tag}}" | head -2 | tail -1)

if [ -z "$PREVIOUS_IMAGE" ]; then
  echo "No previous image found"
  exit 1
fi

echo "Rolling back to $PREVIOUS_IMAGE"
docker stop basset-hound-browser
docker rm basset-hound-browser
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  --restart unless-stopped \
  $PREVIOUS_IMAGE

# Verify
sleep 10
if docker exec basset-hound-browser /app/health-check.sh; then
  echo "Rollback successful"
else
  echo "Rollback failed"
  exit 1
fi
```

## Monitoring in CI/CD

### Metrics Collection

```bash
# Collect pre-deployment metrics
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}" > metrics.before

# Deploy
docker-compose up -d

# Collect post-deployment metrics
sleep 30
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}" > metrics.after

# Compare
diff metrics.before metrics.after
```

### Artifact Collection

```yaml
test:integration:
  script:
    - docker-compose -f config/docker/docker-compose.test.yml up --abort-on-container-exit
  artifacts:
    when: always
    paths:
      - tests/results/
      - coverage/
    reports:
      junit: tests/results/junit.xml
      coverage_report:
        coverage_format: cobertura
        path_prefix: ./
        paths:
          - coverage/cobertura-coverage.xml
```

## Security in CI/CD

### Image Scanning

```bash
# Scan for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image basset-hound-browser:latest

# Scan with detailed output
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --severity CRITICAL,HIGH basset-hound-browser:latest
```

### Secret Management

```yaml
build:
  script:
    - docker build \
        --build-arg REGISTRY_TOKEN=$REGISTRY_TOKEN \
        -f config/docker/Dockerfile \
        -t $IMAGE .
  secrets:
    - REGISTRY_TOKEN
```

## Best Practices

1. **Use base image tags** (not `latest`) for reproducibility
2. **Scan images** for vulnerabilities before pushing
3. **Test in CI/CD** before deploying to production
4. **Maintain version tags** for rollback capability
5. **Use secrets management** for sensitive data
6. **Monitor deployments** with health checks
7. **Implement gradual rollouts** (canary/blue-green)
8. **Archive test results** for compliance
9. **Use artifact caching** to speed up builds
10. **Document deployment procedures** thoroughly
