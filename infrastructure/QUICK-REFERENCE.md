# Basset Hound Browser Infrastructure - Quick Reference

## Docker

### Build
```bash
docker build -f infrastructure/docker/Dockerfile.multi-stage \
  -t basset-hound-browser:12.0.0 .
```

### Dev Environment
```bash
docker-compose -f infrastructure/docker/docker-compose.dev.yml up
```

### Production
```bash
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

### Testing
```bash
docker-compose -f infrastructure/docker/docker-compose.test.yml up \
  --abort-on-container-exit
```

## Kubernetes

### Setup
```bash
# Create namespace
kubectl create namespace basset-hound

# Apply security
kubectl apply -f infrastructure/kubernetes/rbac.yaml

# Apply storage
kubectl apply -f infrastructure/kubernetes/pvc.yaml

# Deploy
kubectl apply -f infrastructure/kubernetes/deployment.yaml
kubectl apply -f infrastructure/kubernetes/service.yaml
kubectl apply -f infrastructure/kubernetes/hpa.yaml
```

### Monitor
```bash
kubectl get pods -n basset-hound
kubectl logs -f <pod-name> -n basset-hound
kubectl describe pod <pod-name> -n basset-hound
```

### Scale
```bash
kubectl scale deployment basset-hound-browser \
  --replicas=5 -n basset-hound
```

### Update
```bash
kubectl set image deployment/basset-hound-browser \
  basset-hound-browser=basset-hound-browser:12.1.0 \
  -n basset-hound
```

## Helm

### Install
```bash
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound --create-namespace
```

### Upgrade
```bash
helm upgrade basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound
```

### Rollback
```bash
helm rollback basset-hound -n basset-hound
```

### Validate
```bash
helm lint infrastructure/helm/basset-hound-browser/
helm template basset-hound infrastructure/helm/basset-hound-browser/
```

## Deployment

### Canary
```bash
./infrastructure/scripts/canary-deployment.sh
```

### Rolling
```bash
./infrastructure/scripts/rolling-deployment.sh
```

## Backup & Recovery

### Backup
```bash
# Full backup
./infrastructure/scripts/backup-automation.sh --full

# Incremental
./infrastructure/scripts/backup-automation.sh --incremental

# Verify
./infrastructure/scripts/backup-automation.sh --verify /path/to/backup
```

### Recover
```bash
# List
./infrastructure/scripts/recovery-automation.sh --list

# Restore
./infrastructure/scripts/recovery-automation.sh --restore /path/to/backup
```

## Monitoring

### Single Report
```bash
./infrastructure/scripts/infrastructure-monitoring.sh --report
```

### Continuous (10 min)
```bash
./infrastructure/scripts/infrastructure-monitoring.sh --continuous
```

### Custom Duration
```bash
./infrastructure/scripts/infrastructure-monitoring.sh --continuous 600
```

## Common Tasks

### View Docker logs
```bash
docker logs basset-hound-browser
docker logs -f basset-hound-browser  # Follow
```

### Check Kubernetes health
```bash
kubectl get events -n basset-hound
kubectl top pods -n basset-hound
kubectl top nodes
```

### Exec into container
```bash
# Docker
docker exec -it basset-hound-browser bash

# Kubernetes
kubectl exec -it <pod-name> -n basset-hound -- bash
```

### Check WebSocket
```bash
# Local
curl http://localhost:8765

# Kubernetes pod
kubectl exec -it <pod-name> -n basset-hound -- \
  curl http://localhost:8765
```

### View pod status
```bash
kubectl describe pod <pod-name> -n basset-hound
kubectl get pod <pod-name> -n basset-hound -o yaml
```

### Check persistent volumes
```bash
kubectl get pvc -n basset-hound
kubectl describe pvc <pvc-name> -n basset-hound
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs basset-hound-browser

# Check health
docker ps --all
docker inspect basset-hound-browser
```

### Pod pending
```bash
# Check events
kubectl describe pod <pod-name> -n basset-hound

# Check storage
kubectl get pvc -n basset-hound
kubectl describe pvc <pvc-name> -n basset-hound

# Check resources
kubectl describe nodes
```

### High resource usage
```bash
# Monitor
./infrastructure/scripts/infrastructure-monitoring.sh --continuous

# Check thresholds
kubectl describe hpa -n basset-hound

# Scale manually
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound
```

### WebSocket connectivity issues
```bash
# Test from pod
kubectl exec -it <pod-name> -n basset-hound -- bash
curl http://localhost:8765

# Port forward for local testing
kubectl port-forward <pod-name> 8765:8765 -n basset-hound

# Check network policies
kubectl get networkpolicies -n basset-hound
kubectl describe networkpolicy <policy-name> -n basset-hound
```

## Configuration Reference

### Environment Variables (docker-compose)
- `NODE_ENV` - development|production|test
- `LOG_LEVEL` - debug|info|warn|error
- `DISPLAY` - :99 (Xvfb display)
- `SCREEN_RESOLUTION` - 1920x1080x24
- `ELECTRON_DISABLE_SANDBOX` - 1 (required)
- `USE_SYSTEM_TOR` - true|false

### Kubernetes Resource Limits
```yaml
requests:
  cpu: 500m
  memory: 512Mi
limits:
  cpu: 2000m
  memory: 2Gi
```

### Helm Values Override
```bash
helm install basset-hound infrastructure/helm/basset-hound-browser/ \
  -n basset-hound \
  --set replicaCount=5 \
  --set resources.limits.memory=4Gi \
  --set autoscaling.maxReplicas=20
```

## Useful Commands

### Get all resources
```bash
kubectl get all -n basset-hound
```

### Watch deployment progress
```bash
kubectl rollout status deployment/basset-hound-browser -n basset-hound
```

### View deployment history
```bash
kubectl rollout history deployment/basset-hound-browser -n basset-hound
```

### Export configuration
```bash
kubectl get deployment basset-hound-browser -n basset-hound -o yaml > deployment-backup.yaml
```

### Cleanup
```bash
# Remove deployment
kubectl delete deployment basset-hound-browser -n basset-hound

# Remove namespace
kubectl delete namespace basset-hound

# Remove Docker containers
docker stop basset-hound-browser
docker rm basset-hound-browser

# Remove Docker image
docker rmi basset-hound-browser:12.0.0
```

## Monitoring Metrics

Key metrics to track:
- CPU usage (target: <70%)
- Memory usage (target: <80%)
- Disk usage (target: <90%)
- WebSocket connectivity (should be 100%)
- Container restart count (should be 0)
- Error rate (should be <5%)

View metrics:
```bash
./infrastructure/scripts/infrastructure-monitoring.sh --report
```

## Performance Tuning

### Adjust replicas
```bash
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound
```

### Modify HPA limits
Edit values.yaml:
```yaml
autoscaling:
  minReplicas: 2
  maxReplicas: 20
  targetCPUUtilizationPercentage: 60
```

### Increase memory
```bash
kubectl set resources deployment basset-hound-browser \
  --limits=memory=4Gi -n basset-hound
```

### Adjust storage size
Modify PVC in kubernetes/pvc.yaml, then:
```bash
kubectl patch pvc basset-hound-data-pvc \
  -n basset-hound \
  -p '{"spec":{"resources":{"requests":{"storage":"30Gi"}}}}'
```

## Security

### Enable TLS
1. Create certificates:
```bash
kubectl create secret tls basset-hound-tls \
  --cert=path/to/cert.crt \
  --key=path/to/key.key \
  -n basset-hound
```

2. Update deployment to use TLS

### View RBAC policies
```bash
kubectl describe role basset-hound-browser -n basset-hound
kubectl describe rolebinding basset-hound-browser -n basset-hound
```

### Check pod security
```bash
kubectl get pod <pod-name> -n basset-hound -o yaml | grep -A 20 "securityContext"
```

## Version Info

- Dockerfile: v12.0.0
- Kubernetes: v1.20+
- Helm: v3+
- Infrastructure module: v12.0.0

Last updated: 2024-06-13
