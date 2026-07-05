# DEPLOYMENT RUNBOOK
**Basset Hound Browser v12.7.0**  
**Last Updated**: June 21, 2026  
**Status**: Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Docker-Compose Deployment](#docker-compose-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Verification Steps](#verification-steps)
7. [Rollback Procedures](#rollback-procedures)
8. [Deployment Troubleshooting](#deployment-troubleshooting)

---

## Overview

This runbook covers production deployment of Basset Hound Browser using Docker Compose (recommended for single-node) and Kubernetes (recommended for multi-node/cloud).

**Deployment Architecture**:
- **Service**: Basset Hound Browser WebSocket API
- **Port**: 8765 (WebSocket)
- **Image**: `basset-hound-browser:12.7.0`
- **Container Runtime**: Docker
- **Restart Policy**: Auto-restart on failure
- **Health Check**: HTTP health endpoint at `/health`
- **Resource Limits**: 2.0 CPU cores, 2GB RAM

---

## Prerequisites

### Required Tools
- Docker >= 20.10.x
- Docker Compose >= 2.0.0 (for Docker Compose deployment)
- kubectl >= 1.24.x (for Kubernetes deployment)
- helm >= 3.10.x (optional, for Helm deployments)
- bash >= 4.0
- curl/wget for health checks
- jq for JSON parsing

### System Requirements
- **CPU**: Minimum 2 cores (4+ recommended for production)
- **Memory**: Minimum 4GB RAM (8GB+ recommended)
- **Disk**: Minimum 20GB free space for data/logs/cache
- **OS**: Linux (Ubuntu 20.04+ recommended, CentOS 8+, Debian 11+)

### Network Requirements
- Port 8765 accessible (WebSocket API)
- Port 9090 accessible (Prometheus metrics, optional)
- Outbound HTTP/HTTPS for external APIs
- For Tor-based requests: Tor network access (included in container)

### Pre-Deployment System Checks

```bash
# Check Docker installation
docker --version
docker-compose --version
docker ps  # Verify daemon is running

# Check system resources
free -h    # Memory
df -h /    # Disk space
nproc      # CPU cores

# Verify network connectivity
curl -I https://www.google.com  # External connectivity
netstat -tuln | grep 8765       # Ensure port not in use
```

### Environment Setup

```bash
# Create environment file for Docker Compose
cat > /path/to/basset-hound-browser/.env.production << 'EOF'
# Runtime
NODE_ENV=production
LOG_LEVEL=info

# Network
WS_PORT=8765
ENVIRONMENT=production

# Display
SCREEN_RESOLUTION=1920x1080x24

# Resource limits
CONTAINER_CPU_LIMIT=2.0
CONTAINER_MEMORY_LIMIT=2G
CONTAINER_CPU_RESERVED=0.5
CONTAINER_MEMORY_RESERVED=512M

# Node.js optimization
NODE_MAX_MEMORY=2048

# Optional: Tor configuration
USE_SYSTEM_TOR=true

# Optional: Authentication (currently disabled in dev)
# BASSET_WS_TOKEN=your-secret-token-here

# Optional: SSL/TLS (for production)
# BASSET_WS_SSL_ENABLED=false
# BASSET_WS_SSL_CERT=/run/secrets/server_cert
# BASSET_WS_SSL_KEY=/run/secrets/server_key
EOF

# Verify environment file
cat /path/to/basset-hound-browser/.env.production
```

---

## Pre-Deployment Checklist

Execute this checklist before any deployment:

- [ ] **Version Control**: Current branch clean, no uncommitted changes
  ```bash
  git status
  ```

- [ ] **Image Built Locally**: Docker image successfully built
  ```bash
  docker images | grep basset-hound-browser:12.7.0
  ```

- [ ] **Network Available**: Required network exists or will be created
  ```bash
  docker network ls | grep basset-hound
  ```

- [ ] **Port Available**: Target port 8765 is not in use
  ```bash
  sudo netstat -tuln | grep 8765
  ```

- [ ] **Disk Space**: At least 20GB free space
  ```bash
  df -h / | awk 'NR==2 {print $4}'
  ```

- [ ] **Backups Created**: Existing data backed up (for upgrades)
  ```bash
  docker volume ls | grep basset
  # Backup existing volumes if present
  ```

- [ ] **Configuration Valid**: Docker Compose file syntax correct
  ```bash
  docker-compose -f docker-compose.yml config > /dev/null
  ```

- [ ] **Environment File Ready**: `.env.production` exists and is valid
  ```bash
  test -f .env.production && echo "OK" || echo "MISSING"
  ```

- [ ] **Rollback Plan**: Rollback version and procedure documented
  ```bash
  # Document current version
  # Identify rollback target
  ```

---

## Docker-Compose Deployment

### Step 1: Build the Docker Image

```bash
cd /home/devel/basset-hound-browser

# Option A: Build from local source
docker build -f Dockerfile -t basset-hound-browser:12.7.0 .

# Option B: Pull pre-built image from registry (if available)
docker pull registry.example.com/basset-hound-browser:12.7.0

# Verify build
docker images | grep basset-hound-browser:12.7.0
```

**Build Verification**:
- Image size should be 1-2GB (multi-stage optimization)
- Image should have all required runtime dependencies
- Build should complete in 5-10 minutes

### Step 2: Create Required Networks and Volumes

```bash
# Create Docker network
docker network create basset-hound-browser

# Verify network created
docker network ls | grep basset-hound-browser

# Create volumes (docker-compose will auto-create, but verify)
docker volume create basset-data
docker volume create basset-logs
docker volume create basset-cache
docker volume create basset-screenshots
docker volume create basset-downloads
docker volume create basset-recordings

# Verify volumes
docker volume ls | grep basset
```

### Step 3: Deploy with Docker Compose

```bash
# Navigate to project root
cd /home/devel/basset-hound-browser

# Start the container stack
docker-compose -f docker-compose.yml up -d

# Or with custom environment file
docker-compose --env-file .env.production -f docker-compose.yml up -d

# Monitor container startup (first 30 seconds)
docker-compose logs -f

# Stop after 30 seconds (Ctrl+C)
```

### Step 4: Monitor Initial Startup

```bash
# Check container status (should be "Up")
docker-compose ps

# Expected output:
# NAME                        STATUS              PORTS
# basset-hound-browser        Up (healthy)        0.0.0.0:8765->8765/tcp

# Monitor logs during startup
docker logs -f basset-hound-browser

# Watch for key startup messages:
# "[basset-hound] Starting Basset Hound Browser v12.7.0"
# "[basset-hound] Starting Xvfb display :99"
# "[basset-hound] Starting WebSocket server on port 8765"
# Should see Tor startup messages if enabled
```

### Step 5: Verify Health Endpoints

```bash
# Wait 10-15 seconds for full startup
sleep 15

# Check liveness (process alive)
curl -s http://localhost:8765/alive | jq '.'

# Check readiness (can accept traffic)
curl -s http://localhost:8765/ready | jq '.'

# Check health status
curl -s http://localhost:8765/health | jq '.'

# Expected health response:
# {
#   "status": "healthy",
#   "uptime": 12.34,
#   "timestamp": "2026-06-21T14:30:45Z"
# }
```

---

## Kubernetes Deployment

### Step 1: Prepare Kubernetes Environment

```bash
# Check kubectl connectivity
kubectl cluster-info
kubectl get nodes

# Create namespace
kubectl create namespace basset-hound --dry-run=client -o yaml | kubectl apply -f -

# Verify namespace
kubectl get namespace basset-hound
```

### Step 2: Create ConfigMap and Secrets

```bash
# Create ConfigMap for application configuration
kubectl create configmap basset-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=NODE_ENV=production \
  -n basset-hound --dry-run=client -o yaml | kubectl apply -f -

# Create Secret for sensitive data (SSL certs, tokens)
# First, prepare certificate files
kubectl create secret tls basset-tls \
  --cert=path/to/server.crt \
  --key=path/to/server.key \
  -n basset-hound --dry-run=client -o yaml | kubectl apply -f -

# Verify ConfigMap and Secret
kubectl get configmap -n basset-hound
kubectl get secret -n basset-hound
```

### Step 3: Apply Kubernetes Manifests

```bash
cd /home/devel/basset-hound-browser

# Apply in correct order:

# 1. RBAC (Role-Based Access Control)
kubectl apply -f infrastructure/kubernetes/rbac.yaml

# 2. Persistent Volumes
kubectl apply -f infrastructure/kubernetes/pvc.yaml

# 3. ConfigMaps
kubectl apply -f infrastructure/kubernetes/configmap.yaml

# 4. Deployment (main application)
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# 5. Service (expose port)
kubectl apply -f infrastructure/kubernetes/service.yaml

# 6. Horizontal Pod Autoscaler (optional but recommended)
kubectl apply -f infrastructure/kubernetes/hpa.yaml

# 7. Ingress (optional, for external HTTP/HTTPS access)
# kubectl apply -f infrastructure/kubernetes/ingress.yaml

# Verify all resources created
kubectl get all -n basset-hound
```

### Step 4: Monitor Kubernetes Deployment

```bash
# Watch deployment rollout
kubectl rollout status deployment/basset-hound-browser -n basset-hound

# Monitor pod startup
kubectl get pods -n basset-hound -w

# Expected pod status progression:
# Pending -> ContainerCreating -> Running -> Ready

# View detailed pod information
kubectl describe pod <pod-name> -n basset-hound

# Check pod logs
kubectl logs -f <pod-name> -n basset-hound

# Check events for errors
kubectl get events -n basset-hound --sort-by='.lastTimestamp'
```

### Step 5: Verify Kubernetes Deployment

```bash
# Check deployment status
kubectl get deployment -n basset-hound
kubectl describe deployment basset-hound-browser -n basset-hound

# Check service status
kubectl get svc -n basset-hound
kubectl describe svc basset-hound-browser-service -n basset-hound

# Port-forward for testing (if not using Ingress)
kubectl port-forward svc/basset-hound-browser-service 8765:8765 -n basset-hound &

# Test health endpoint
curl -s http://localhost:8765/health | jq '.'

# Check HPA status (if enabled)
kubectl get hpa -n basset-hound
kubectl describe hpa basset-hound-browser-hpa -n basset-hound
```

### Step 6: Helm Deployment (Alternative)

```bash
# Install using Helm
helm install basset-hound \
  infrastructure/helm/basset-hound-browser/ \
  --namespace basset-hound \
  --create-namespace \
  --values infrastructure/helm/basset-hound-browser/values.yaml

# Or with custom values
helm install basset-hound \
  infrastructure/helm/basset-hound-browser/ \
  --namespace basset-hound \
  --set replicaCount=3 \
  --set resources.limits.memory=2Gi

# Verify Helm installation
helm status basset-hound -n basset-hound
helm list -n basset-hound

# Upgrade Helm release
helm upgrade basset-hound \
  infrastructure/helm/basset-hound-browser/ \
  -n basset-hound

# Rollback Helm release
helm rollback basset-hound -n basset-hound
```

---

## Verification Steps

### Complete Deployment Verification Checklist

Execute all these steps to verify successful deployment:

#### 1. Container/Pod Status
```bash
# Docker Compose
docker-compose ps
docker-compose logs | tail -20

# Kubernetes
kubectl get pods -n basset-hound
kubectl logs -l app=basset-hound-browser -n basset-hound --tail=20
```

Expected: All containers in "Running" state, no error logs.

#### 2. Health Endpoints
```bash
# Check all health probes
curl -s http://localhost:8765/alive | jq '.status'
curl -s http://localhost:8765/ready | jq '.ready'
curl -s http://localhost:8765/health | jq '.status'

# Tor status (if enabled)
curl -s http://localhost:8765/tor-status | jq '.'
```

Expected: All return success/healthy status.

#### 3. WebSocket Connectivity
```bash
# Test WebSocket connection
wscat -c ws://localhost:8765

# Or use curl to test HTTP upgrade
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8765/
```

Expected: WebSocket upgrade successful (HTTP 101).

#### 4. Port Accessibility
```bash
# Test port is accessible
nc -zv localhost 8765

# Test from another host (if deployed remotely)
nc -zv <hostname> 8765
```

Expected: Connection established.

#### 5. Resource Usage
```bash
# Check CPU/Memory usage
docker stats basset-hound-browser --no-stream

# Kubernetes
kubectl top pod -n basset-hound
kubectl top node

# Expected memory usage: 400-800MB under idle
# Expected CPU under idle: <5%
```

#### 6. Volume/Storage
```bash
# Docker: Check volumes mounted
docker inspect basset-hound-browser | jq '.Mounts'

# Kubernetes: Check PVCs
kubectl get pvc -n basset-hound
kubectl describe pvc basset-data -n basset-hound
```

Expected: All volumes mounted and accessible.

#### 7. Network Connectivity
```bash
# Test external connectivity (for proxy features)
docker exec basset-hound-browser curl -I https://www.google.com

# Test Tor connectivity (if enabled)
curl -s -x socks5://localhost:9050 http://check.torproject.org/api/ip
```

Expected: External connectivity works.

#### 8. Metrics Availability
```bash
# Check Prometheus metrics (if enabled)
curl -s http://localhost:9090/metrics | head -20
```

Expected: Prometheus metrics available (optional).

#### 9. Log Aggregation
```bash
# Docker: Check log files
docker logs basset-hound-browser | grep -i "error\|warn" | tail -10

# Kubernetes: Check aggregated logs
kubectl logs -l app=basset-hound-browser -n basset-hound --tail=20
```

Expected: No critical errors in recent logs.

#### 10. Functional Verification
```bash
# Test basic WebSocket command
cat > test-ws.js << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected to WebSocket');
  
  // Send a simple test command
  ws.send(JSON.stringify({
    id: 1,
    command: 'get_browser_info'
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data);
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('Timeout - no response');
  process.exit(1);
}, 5000);
EOF

node test-ws.js
```

Expected: Receives browser info response.

---

## Rollback Procedures

### Scenario 1: Immediate Rollback (Before Old Container Stopped)

```bash
# If old container still running, revert to previous version
docker-compose down
docker-compose -f docker-compose.old.yml up -d

# Verify rollback
docker-compose logs | tail -20
curl -s http://localhost:8765/health | jq '.'
```

### Scenario 2: Rollback After Failure

```bash
# Stop failed deployment
docker-compose down

# Restore from backup (if applicable)
BACKUP_DIR="/path/to/backup"
docker volume create basset-data-restore
docker run --rm -v basset-data-restore:/restore -v "$BACKUP_DIR":/backup \
  alpine tar xzf /backup/backup.tar.gz -C /restore

# Start with previous version
docker run -d --name basset-hound-browser \
  -v basset-data-restore:/app/data \
  basset-hound-browser:12.2.0

# Verify restored state
docker logs basset-hound-browser
```

### Scenario 3: Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/basset-hound-browser -n basset-hound

# Rollback to previous version
kubectl rollout undo deployment/basset-hound-browser -n basset-hound

# Monitor rollback progress
kubectl rollout status deployment/basset-hound-browser -n basset-hound -w

# Verify rollback
kubectl logs -l app=basset-hound-browser -n basset-hound --tail=20
```

### Scenario 4: Data Recovery from Backup

```bash
# List available backups
ls -lah backups/

# Restore specific backup
./infrastructure/scripts/recovery-automation.sh --restore /path/to/backup

# Verify restored data
docker exec basset-hound-browser ls -la /app/data
```

### Rollback Verification

After rollback, verify functionality:

```bash
# Health check
curl -s http://localhost:8765/health | jq '.'

# Container logs
docker logs basset-hound-browser | grep -i "error\|warn"

# Smoke test WebSocket
# Test basic commands to ensure functionality
```

---

## Deployment Troubleshooting

### Problem: Container fails to start

**Symptoms**: Container exits immediately, status shows "Exited"

```bash
# Check logs
docker logs basset-hound-browser
docker logs --tail=50 basset-hound-browser | tail -20

# Common causes and solutions:
# 1. Missing environment variables
docker-compose config | grep -A 10 environment

# 2. Port already in use
sudo netstat -tuln | grep 8765
# Solution: Stop other service or change port

# 3. Insufficient disk space
df -h /

# 4. Missing volumes
docker volume ls | grep basset
# Solution: docker volume create basset-data
```

### Problem: Health check fails

**Symptoms**: Container runs but health check returns unhealthy

```bash
# Check health endpoint directly
curl -v http://localhost:8765/health

# Check WebSocket server logs
docker logs basset-hound-browser | grep -i websocket

# Check system resources
docker stats basset-hound-browser --no-stream

# Possible causes:
# 1. WebSocket server not started
docker exec basset-hound-browser ps aux | grep websocket

# 2. Port not bound
docker exec basset-hound-browser netstat -tuln | grep 8765

# 3. Too few resources
# Increase memory/CPU limits in docker-compose.yml
```

### Problem: High memory usage

**Symptoms**: Memory usage exceeds limits, container killed

```bash
# Monitor memory usage
docker stats basset-hound-browser --no-stream

# Check for memory leaks
docker logs basset-hound-browser | grep -i "memory\|heap"

# Restart container to free memory
docker restart basset-hound-browser

# Solutions:
# 1. Increase memory limit in docker-compose.yml
#    Change: memory: 2G to memory: 4G

# 2. Check for stuck processes
docker exec basset-hound-browser ps aux

# 3. Review recent WebSocket commands
docker logs basset-hound-browser | tail -100 | grep -i screenshot
```

### Problem: WebSocket connection refused

**Symptoms**: Cannot connect to WebSocket API

```bash
# Check service is listening
docker exec basset-hound-browser netstat -tuln | grep 8765

# Check firewall
sudo firewall-cmd --list-ports  # For firewalld
sudo ufw status                  # For ufw

# Allow port through firewall
sudo firewall-cmd --add-port=8765/tcp --permanent
sudo firewall-cmd --reload

# Test connectivity
telnet localhost 8765
nc -zv localhost 8765
```

### Problem: Deployment hangs

**Symptoms**: Deployment stuck waiting for container to be ready

```bash
# Check container logs
docker logs basset-hound-browser

# Check Xvfb (display server)
docker exec basset-hound-browser ps aux | grep Xvfb

# If Xvfb not running, check display error
docker exec basset-hound-browser Xvfb :99 -screen 0 1920x1080x24

# Check Tor startup (if enabled)
docker logs basset-hound-browser | grep -i tor

# Increase health check timeout in docker-compose.yml
# Change: start_period: 40s to start_period: 60s
```

### Problem: Kubernetes pod not starting

**Symptoms**: Pod stuck in Pending/ContainerCreating

```bash
# Check pod events
kubectl describe pod <pod-name> -n basset-hound

# Check resource availability
kubectl describe node
kubectl top node

# Check image availability
kubectl get events -n basset-hound --sort-by='.lastTimestamp'

# If image pull fails
kubectl set image deployment/basset-hound-browser \
  basset=basset-hound-browser:12.7.0 -n basset-hound

# Check PVC binding
kubectl describe pvc -n basset-hound
```

### Emergency Restart

If all else fails, perform a complete restart:

```bash
# Docker Compose
docker-compose down
sleep 5
docker-compose up -d
sleep 20
curl -s http://localhost:8765/health

# Kubernetes
kubectl delete deployment basset-hound-browser -n basset-hound
sleep 10
kubectl apply -f infrastructure/kubernetes/deployment.yaml
kubectl rollout status deployment/basset-hound-browser -n basset-hound
```

---

## Quick Reference Commands

```bash
# Status
docker-compose ps
docker-compose logs -f

# Management
docker-compose up -d      # Start
docker-compose down        # Stop
docker-compose restart     # Restart
docker-compose pause       # Pause
docker-compose unpause     # Resume

# Verification
curl http://localhost:8765/health
curl http://localhost:8765/ready
curl http://localhost:8765/alive

# Debugging
docker exec basset-hound-browser bash
docker logs --tail=100 basset-hound-browser
docker inspect basset-hound-browser

# Cleanup (WARNING: Deletes data!)
docker-compose down -v     # Remove containers and volumes
docker volume prune        # Remove unused volumes
docker image prune         # Remove unused images
```

---

## Deployment Success Criteria

Deployment is successful when:

- [ ] All containers/pods in "Running" state
- [ ] Health check endpoint returns 200 OK
- [ ] WebSocket connectivity test passes
- [ ] No error messages in logs
- [ ] Memory usage < 1GB
- [ ] CPU usage < 50%
- [ ] Port 8765 accessible from client machines
- [ ] Metrics endpoint available (optional)
- [ ] All required volumes mounted
- [ ] No pending restarts

---

## Support and Escalation

If deployment fails after troubleshooting:

1. **Collect diagnostic information**:
   ```bash
   docker-compose logs > deployment.log
   docker stats --no-stream > resources.log
   docker-compose ps > status.log
   ```

2. **Check recent changes**:
   ```bash
   git log --oneline -10
   git diff HEAD~1 Dockerfile
   ```

3. **Review infrastructure documentation**:
   - See `/docs/infrastructure/README.md`
   - Check `/docs/operations/RUNBOOK-MONITORING.md` for metrics

4. **Escalate if needed**:
   - Contact DevOps team with diagnostic logs
   - Reference this runbook section and symptoms
   - Include docker-compose.yml and environment configuration

---

## Related Documentation

- [Monitoring Runbook](./RUNBOOK-MONITORING.md)
- [Scaling Runbook](./RUNBOOK-SCALING.md)
- [Maintenance Runbook](./RUNBOOK-MAINTENANCE.md)
- [Troubleshooting Runbook](./RUNBOOK-TROUBLESHOOTING.md)
- [Infrastructure README](../infrastructure/README.md)
- [API Reference](../API-REFERENCE.md)
