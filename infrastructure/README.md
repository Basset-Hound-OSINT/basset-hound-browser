# Basset Hound Browser - Infrastructure as Code

Comprehensive Infrastructure as Code (IaC) and deployment automation for Basset Hound Browser, providing production-ready Kubernetes, Docker, and deployment automation solutions.

## Overview

This infrastructure module provides:

- **Multi-Stage Docker** - Optimized, secure container images
- **Docker Compose** - Development, production, and testing configurations
- **Kubernetes IaC** - Complete K8s manifests for production deployment
- **Helm Charts** - Production-ready Helm packages
- **Deployment Scripts** - Canary and rolling deployment automation
- **Backup & Recovery** - Automated backup and disaster recovery
- **Monitoring** - Infrastructure and application monitoring

## Directory Structure

```
infrastructure/
├── docker/
│   ├── Dockerfile.multi-stage      # Optimized multi-stage Dockerfile
│   ├── docker-compose.dev.yml      # Development environment
│   ├── docker-compose.prod.yml     # Production environment
│   └── docker-compose.test.yml     # Testing environment
│
├── kubernetes/
│   ├── deployment.yaml             # Main deployment configuration
│   ├── service.yaml                # Service definitions
│   ├── statefulset.yaml            # Stateful deployment option
│   ├── configmap.yaml              # ConfigMap configurations
│   ├── hpa.yaml                    # Horizontal Pod Autoscaler
│   ├── rbac.yaml                   # RBAC and security
│   ├── pvc.yaml                    # Persistent Volume Claims
│   └── ingress.yaml                # Ingress configuration (optional)
│
├── helm/basset-hound-browser/
│   ├── Chart.yaml                  # Helm chart metadata
│   ├── values.yaml                 # Default values
│   └── templates/                  # Helm templates
│
└── scripts/
    ├── canary-deployment.sh        # Canary deployment automation
    ├── rolling-deployment.sh       # Rolling deployment automation
    ├── backup-automation.sh        # Backup automation
    ├── recovery-automation.sh      # Disaster recovery
    └── infrastructure-monitoring.sh # Monitoring and alerting
```

## Quick Start

### Docker Development

```bash
# Build multi-stage image
docker build -f infrastructure/docker/Dockerfile.multi-stage -t basset-hound-browser:12.0.0 .

# Run development environment
docker-compose -f infrastructure/docker/docker-compose.dev.yml up

# Run production environment
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d

# Run integration tests
docker-compose -f infrastructure/docker/docker-compose.test.yml up --abort-on-container-exit
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace basset-hound

# Apply RBAC and security policies
kubectl apply -f infrastructure/kubernetes/rbac.yaml

# Apply PVC configuration
kubectl apply -f infrastructure/kubernetes/pvc.yaml

# Apply ConfigMap
kubectl apply -f infrastructure/kubernetes/configmap.yaml

# Deploy application
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# Apply service
kubectl apply -f infrastructure/kubernetes/service.yaml

# Enable autoscaling
kubectl apply -f infrastructure/kubernetes/hpa.yaml
```

### Helm Deployment

```bash
# Install using Helm
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  --namespace basset-hound \
  --create-namespace \
  --values infrastructure/helm/basset-hound-browser/values.yaml

# Upgrade deployment
helm upgrade basset-hound infrastructure/helm/basset-hound-browser/ \
  --namespace basset-hound

# Verify installation
helm list -n basset-hound
helm status basset-hound -n basset-hound
```

## Phase 1: Docker Optimization

### Multi-Stage Dockerfile

The `Dockerfile.multi-stage` provides:

- **Builder Stage** - Compiles dependencies with full build tools
- **Runtime Base Stage** - Minimal runtime environment
- **Production Stage** - Final hardened image

**Benefits:**
- 40-50% image size reduction (build tools excluded)
- Improved security (no build tools in production)
- Better layer caching for faster builds
- Optimized startup time

**Building:**
```bash
docker build -f infrastructure/docker/Dockerfile.multi-stage \
  -t basset-hound-browser:12.0.0 .
```

### Docker Compose Configurations

#### Development (`docker-compose.dev.yml`)
- Hot reload via volume mounts
- Debug logging enabled
- 4GB memory allocation
- Source code mounted for development

```bash
docker-compose -f infrastructure/docker/docker-compose.dev.yml up
```

#### Production (`docker-compose.prod.yml`)
- Strict security constraints
- Resource limits (2GB memory)
- Auto-restart policy
- Persistent volumes only
- Health checks enabled

```bash
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

#### Testing (`docker-compose.test.yml`)
- Fast startup configuration
- Isolated test environment
- Comprehensive logging
- Test volume mounts

```bash
docker-compose -f infrastructure/docker/docker-compose.test.yml up \
  --abort-on-container-exit
```

## Phase 2: Kubernetes Infrastructure

### Deployment Configuration

The `deployment.yaml` provides:

- Rolling update strategy (0 downtime)
- 3 replicas by default
- Pod anti-affinity for distribution
- Liveness, readiness, and startup probes
- Security context with non-root user
- Resource requests and limits
- ConfigMap integration

**Verify deployment:**
```bash
kubectl get deployment -n basset-hound
kubectl get pods -n basset-hound
kubectl describe pod <pod-name> -n basset-hound
```

### StatefulSet Option

For stateful deployments requiring persistent identity and ordered deployment:

```bash
kubectl apply -f infrastructure/kubernetes/statefulset.yaml
```

**StatefulSet provides:**
- Persistent pod identity
- Ordered startup/shutdown
- PVC per replica
- Suitable for session persistence

### Horizontal Pod Autoscaler

Automatically scales replicas based on metrics:

```bash
# Scale based on CPU and memory
kubectl apply -f infrastructure/kubernetes/hpa.yaml

# Monitor autoscaling
kubectl get hpa -n basset-hound
kubectl describe hpa -n basset-hound
```

### Security and RBAC

Complete RBAC configuration with:

- ServiceAccount with minimal permissions
- Role-based access control
- Network policies
- Pod security context
- Non-root user execution

```bash
kubectl apply -f infrastructure/kubernetes/rbac.yaml
```

### Persistent Storage

PVC definitions for all data types:

```bash
kubectl apply -f infrastructure/kubernetes/pvc.yaml

# Verify storage
kubectl get pvc -n basset-hound
```

## Phase 3: Deployment Automation

### Canary Deployment

Progressive rollout with health verification:

```bash
./infrastructure/scripts/canary-deployment.sh
```

**Process:**
1. Launch canary instance
2. Monitor health (60s timeout)
3. Shift traffic gradually (10% → 100%)
4. Promote to stable on success
5. Rollback on failure

**Configuration:**
- `CANARY_WEIGHT` - Starting traffic percentage
- `DURATION` - Monitoring duration
- `ERROR_RATE_THRESHOLD` - Error threshold for rollback

**Output:**
- Logs to `logs/canary-deployment-TIMESTAMP.log`
- Success/failure status
- Automatic rollback on issues

### Rolling Deployment

Zero-downtime rolling update:

```bash
./infrastructure/scripts/rolling-deployment.sh
```

**Process:**
1. Validate Docker image
2. Update replicas in batches
3. Health check each new instance
4. Wait for readiness before next batch
5. Verify final deployment health

**Configuration:**
- `TOTAL_REPLICAS` - Number of replicas
- `BATCH_SIZE` - Replicas updated simultaneously
- `HEALTH_CHECK_TIMEOUT` - Health check timeout

**Output:**
- Detailed logs with progress
- Per-replica status
- Final deployment health report

## Phase 4: Backup and Recovery

### Automated Backup

Supports full and incremental backups:

```bash
# Full backup
./infrastructure/scripts/backup-automation.sh --full

# Incremental backup (since last backup)
./infrastructure/scripts/backup-automation.sh --incremental

# Verify backup integrity
./infrastructure/scripts/backup-automation.sh --verify /path/to/backup
```

**Features:**
- Full and incremental modes
- Compression with configurable level
- Automatic retention enforcement (30 days)
- Backup manifest with checksums
- Archive integrity verification

**Backup includes:**
- Application data
- Configuration
- Logs
- Container data

**Output:**
- Backups in `backups/full-*` or `backups/incremental-*`
- Manifest file with metadata
- Detailed logging

### Disaster Recovery

Quick recovery from backups:

```bash
# List available backups
./infrastructure/scripts/recovery-automation.sh --list

# Verify backup before recovery
./infrastructure/scripts/recovery-automation.sh --verify /path/to/backup

# Restore from backup
./infrastructure/scripts/recovery-automation.sh --restore /path/to/backup
```

**Recovery process:**
1. Create snapshots of current state
2. Validate backup integrity
3. Stop running containers
4. Extract and restore files
5. Verify restored data
6. Restart application
7. Cleanup temporary artifacts

**Features:**
- Pre-recovery snapshots
- Data integrity verification
- Automatic restart after recovery
- Recovery artifact preservation

## Phase 5: Infrastructure Monitoring

Comprehensive infrastructure monitoring:

```bash
# Single health report
./infrastructure/scripts/infrastructure-monitoring.sh --report

# Continuous monitoring (10 minutes)
./infrastructure/scripts/infrastructure-monitoring.sh --continuous

# Custom duration
./infrastructure/scripts/infrastructure-monitoring.sh --continuous 300
```

**Monitors:**
- Container status and health
- CPU usage (threshold: 80%)
- Memory usage (threshold: 85%)
- Disk space (threshold: 90%)
- WebSocket connectivity
- System load
- Container restart count

**Output:**
- JSON metrics file
- Text report
- Real-time monitoring display
- Alert generation on threshold

**Metrics collected:**
```json
{
  "timestamp": "2024-06-13T15:30:45Z",
  "container": "basset-hound-browser",
  "status": "running",
  "health": "healthy",
  "cpu_percent": 45.2,
  "memory_percent": 62.5,
  "websocket_healthy": true,
  "restart_count": 0,
  "disk_percent": 65,
  "system_load": "2.34"
}
```

## Helm Charts

### Installation

```bash
# Install with default values
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound --create-namespace

# Install with custom values
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound \
  -f custom-values.yaml

# Dry-run to preview changes
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound --dry-run --debug
```

### Customization

Edit `values.yaml` or use `--set` flags:

```bash
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound \
  --set replicaCount=5 \
  --set resources.limits.memory=4Gi \
  --set autoscaling.maxReplicas=20
```

### Upgrades

```bash
# Upgrade with new values
helm upgrade basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound \
  -f new-values.yaml

# Rollback to previous release
helm rollback basset-hound -n basset-hound

# View release history
helm history basset-hound -n basset-hound
```

## Testing and Validation

### Docker Compose Tests

```bash
# Run all tests
docker-compose -f infrastructure/docker/docker-compose.test.yml up

# Interactive testing
docker exec -it basset-hound-browser-test bash

# View logs
docker-compose -f infrastructure/docker/docker-compose.test.yml logs -f
```

### Kubernetes Validation

```bash
# Validate YAML
kubectl apply --dry-run=client -f infrastructure/kubernetes/*.yaml

# Check pod status
kubectl get pods -n basset-hound -o wide

# View pod events
kubectl describe pod <pod-name> -n basset-hound

# Stream logs
kubectl logs -f <pod-name> -n basset-hound

# Execute commands in pod
kubectl exec -it <pod-name> -n basset-hound -- bash
```

### Helm Validation

```bash
# Lint chart
helm lint infrastructure/helm/basset-hound-browser/

# Template rendering
helm template basset-hound infrastructure/helm/basset-hound-browser/

# Dry-run installation
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound --dry-run --debug
```

## Monitoring and Alerts

### Prometheus Integration

Enable Prometheus monitoring:

```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
```

### Logging Integration

Configure ELK or Loki:

```yaml
logging:
  enabled: true
  driver: "json-file"
  options:
    max-size: "10m"
```

### Alert Rules

Create Prometheus alert rules for:
- Container unavailability
- High CPU/memory usage
- WebSocket connectivity issues
- Persistent storage issues

## Security Best Practices

1. **Container Security**
   - Non-root user (UID 1000)
   - Read-only root filesystem
   - Minimal capabilities (SYS_ADMIN only)
   - Security scanning in CI/CD

2. **Kubernetes Security**
   - RBAC policies
   - Network policies
   - Pod security policies
   - Secrets encryption

3. **Data Security**
   - Encrypted backups
   - TLS for WebSocket (optional)
   - Secure credential storage
   - Regular security audits

## Troubleshooting

### Container Issues

```bash
# View logs
docker logs basset-hound-browser

# Check health
docker inspect basset-hound-browser | jq '.State.Health'

# Restart container
docker restart basset-hound-browser
```

### Kubernetes Issues

```bash
# Check pod status
kubectl describe pod <pod-name> -n basset-hound

# View events
kubectl get events -n basset-hound

# Check resource availability
kubectl describe node

# Check persistent volumes
kubectl get pv -n basset-hound
```

### Deployment Issues

```bash
# Check deployment status
kubectl rollout status deployment/basset-hound-browser -n basset-hound

# View rollout history
kubectl rollout history deployment/basset-hound-browser -n basset-hound

# Rollback to previous version
kubectl rollout undo deployment/basset-hound-browser -n basset-hound
```

## Performance Tuning

### Resource Optimization

```yaml
resources:
  limits:
    cpu: 2000m      # Adjust based on workload
    memory: 2Gi     # Increase for large operations
  requests:
    cpu: 500m       # Ensure adequate reservation
    memory: 512Mi
```

### Scaling Configuration

```yaml
autoscaling:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Storage Optimization

```yaml
persistence:
  data:
    size: 20Gi      # Adjust based on usage
    storageClass: "fast"  # Use faster storage class
```

## Production Checklist

- [ ] Docker image tested in all environments
- [ ] Kubernetes manifests validated
- [ ] RBAC policies reviewed
- [ ] Resource limits configured
- [ ] Persistent storage configured
- [ ] Monitoring enabled
- [ ] Backup automation running
- [ ] Health checks verified
- [ ] Security scanning passed
- [ ] Load testing completed
- [ ] Disaster recovery tested
- [ ] Documentation updated

## Support and Documentation

- **Issues**: Open GitHub issues for bugs/features
- **Documentation**: See `/docs` directory for detailed guides
- **Examples**: Check example deployments in this directory
- **Community**: Join Basset Hound community channels

## License

See LICENSE file in project root.

## Version

Infrastructure Module: v12.0.0
Application Version: 12.0.0
Last Updated: 2024-06-13
