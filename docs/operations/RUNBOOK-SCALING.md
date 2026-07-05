# SCALING RUNBOOK
**Basset Hound Browser v12.7.0**  
**Last Updated**: June 21, 2026  
**Status**: Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [When to Scale](#when-to-scale)
3. [Scaling Triggers and Metrics](#scaling-triggers-and-metrics)
4. [Pre-Scaling Checklist](#pre-scaling-checklist)
5. [Docker Compose Scaling](#docker-compose-scaling)
6. [Kubernetes Scaling](#kubernetes-scaling)
7. [Load Balancing Setup](#load-balancing-setup)
8. [Verification and Testing](#verification-and-testing)
9. [Scaling Down Procedures](#scaling-down-procedures)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This runbook covers horizontal scaling (adding more instances) of Basset Hound Browser to handle increased load.

**Scaling Targets**:
- Increase concurrent WebSocket connections
- Increase throughput (commands per second)
- Improve availability and fault tolerance
- Support multiple geographic regions

**Current Capacity (Single Instance)**:
- Concurrent connections: 200+ with 100% success
- Throughput: 285.45 messages/sec @ 200 concurrent
- Memory usage: ~1.15% of available
- CPU usage: ~18% under load
- Latency: <2ms P99

**Recommended Scaling Strategy**:
- 1-2 instances: Development/staging
- 3-5 instances: Production with HA
- 5-10+ instances: High-traffic production

---

## When to Scale

### Scaling Triggers

Scale UP when:
- **CPU Usage**: > 70% sustained for > 5 minutes
- **Memory Usage**: > 80% sustained
- **Connection Queue**: Pending connections > 50
- **Error Rate**: > 1% of requests failing
- **Latency**: P95 latency > 100ms
- **Planned Capacity**: Expecting traffic spike (events, campaigns)

Scale DOWN when:
- **CPU Usage**: < 20% for > 15 minutes
- **Memory Usage**: < 30%
- **Connection Count**: < 10% of capacity
- **Idle Time**: No connections for > 10 minutes
- **Cost Optimization**: Planned maintenance windows

---

## Scaling Triggers and Metrics

### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU Usage | > 70% for 5 min | Scale UP |
| Memory Usage | > 80% | Scale UP |
| Connection Queue | > 50 pending | Scale UP |
| Error Rate | > 1% | Scale UP or Debug |
| Latency P95 | > 100ms | Scale UP |
| Latency P99 | > 500ms | Scale UP + Debug |
| Disk I/O | > 80% | Add disk or Scale |
| Goroutines (if applicable) | > 1000 | Scale or Debug memory leak |

### Capacity Planning Formula

```
Required Instances = ceil((Expected Connections / 200) * 1.5)
                   = ceil((Expected Throughput / 285.45) * 1.5)

Example:
- For 1000 concurrent connections: ceil((1000/200)*1.5) = 8 instances
- For 1000 msg/sec throughput: ceil((1000/285.45)*1.5) = 6 instances
```

---

## Pre-Scaling Checklist

Before scaling, verify:

- [ ] **Current Capacity**: Monitor metrics for 5+ minutes to confirm sustained high load
  ```bash
  docker stats basset-hound-browser --no-stream
  kubectl top pod -n basset-hound
  ```

- [ ] **Load Balancer**: Load balancer configured and healthy (for K8s scaling)
  ```bash
  kubectl get svc -n basset-hound
  helm status basset-hound -n basset-hound
  ```

- [ ] **Storage**: Sufficient persistent storage available
  ```bash
  kubectl get pvc -n basset-hound
  df -h /
  ```

- [ ] **Network**: Network bandwidth sufficient
  ```bash
  # Check network interface stats
  ethtool -S eth0 | grep -i "dropped\|error"
  ```

- [ ] **Node Resources** (K8s): Nodes have capacity
  ```bash
  kubectl describe nodes
  kubectl top nodes
  ```

- [ ] **Backup Created**: Data backed up before major scaling
  ```bash
  ./infrastructure/scripts/backup-automation.sh --full
  ```

- [ ] **Deployment Health**: All current instances healthy
  ```bash
  docker-compose ps
  kubectl get pods -n basset-hound
  ```

- [ ] **Monitoring Active**: Metrics collection running
  ```bash
  curl -s http://localhost:9090/metrics | head -5
  ```

---

## Docker Compose Scaling

Docker Compose doesn't natively support multi-instance scaling with load balancing. For production, use **Kubernetes** or implement manual load balancing with **HAProxy/Nginx**.

### Manual Docker Compose Scaling

#### Step 1: Prepare Scaled Configuration

Create a new docker-compose file for multiple instances:

```yaml
# docker-compose.scale.yml
version: '3.9'

services:
  basset-1:
    image: basset-hound-browser:12.7.0
    container_name: basset-hound-browser-1
    ports:
      - "8765:8765"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - basset-data-1:/app/data
      - basset-logs:/app/logs
    restart: on-failure:5
    healthcheck:
      test: ["CMD", "/app/health-check.sh"]
      interval: 30s
      timeout: 10s
      retries: 3

  basset-2:
    image: basset-hound-browser:12.7.0
    container_name: basset-hound-browser-2
    ports:
      - "8766:8765"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - basset-data-2:/app/data
      - basset-logs:/app/logs
    restart: on-failure:5
    healthcheck:
      test: ["CMD", "/app/health-check.sh"]
      interval: 30s
      timeout: 10s
      retries: 3

  basset-3:
    image: basset-hound-browser:12.7.0
    container_name: basset-hound-browser-3
    ports:
      - "8767:8765"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - basset-data-3:/app/data
      - basset-logs:/app/logs
    restart: on-failure:5
    healthcheck:
      test: ["CMD", "/app/health-check.sh"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Load Balancer (Nginx)
  nginx-lb:
    image: nginx:latest
    container_name: basset-lb
    ports:
      - "8764:8764"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - basset-1
      - basset-2
      - basset-3
    restart: always

volumes:
  basset-data-1:
  basset-data-2:
  basset-data-3:
  basset-logs:
```

#### Step 2: Create Load Balancer Configuration

Create `nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # WebSocket upstream
    upstream basset_backend {
        least_conn;
        server basset-1:8765 max_fails=2 fail_timeout=10s;
        server basset-2:8765 max_fails=2 fail_timeout=10s;
        server basset-3:8765 max_fails=2 fail_timeout=10s;
    }

    # WebSocket server
    server {
        listen 8764;
        server_name _;

        # WebSocket proxy
        location / {
            proxy_pass http://basset_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket timeouts
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
            
            # Connection upgrade
            proxy_buffering off;
        }

        # Health check endpoint
        location /health {
            access_log off;
            proxy_pass http://basset_backend;
        }
    }
}
```

#### Step 3: Start Scaled Stack

```bash
# Stop old stack
docker-compose down

# Start new scaled stack
docker-compose -f docker-compose.scale.yml up -d

# Verify all instances running
docker-compose -f docker-compose.scale.yml ps

# Expected output:
# basset-hound-browser-1   Up (healthy)
# basset-hound-browser-2   Up (healthy)
# basset-hound-browser-3   Up (healthy)
# basset-lb                Up
```

#### Step 4: Verify Load Balancer

```bash
# Test load balancer
curl -I http://localhost:8764/health
curl http://localhost:8764/health | jq '.'

# Test WebSocket through load balancer
wscat -c ws://localhost:8764

# Check connection distribution (run 3 commands to see load balancing)
for i in {1..3}; do
  curl -s http://localhost:8764/health | jq '.container_id'
done
# Should see different container IDs
```

---

## Kubernetes Scaling

### Option 1: Manual Scaling

#### Step 1: Scale Deployment Replicas

```bash
# Scale to N replicas
kubectl scale deployment basset-hound-browser \
  --replicas=5 \
  -n basset-hound

# Verify scaling
kubectl get deployment -n basset-hound
kubectl get pods -n basset-hound

# Watch scaling progress
kubectl get pods -n basset-hound -w
```

#### Step 2: Monitor Scaling Progress

```bash
# Check rollout status
kubectl rollout status deployment/basset-hound-browser -n basset-hound

# View pod distribution across nodes
kubectl get pods -n basset-hound -o wide

# Monitor resource usage during scaling
kubectl top pod -n basset-hound
kubectl top nodes
```

### Option 2: Horizontal Pod Autoscaler (HPA)

HPA automatically scales based on metrics.

#### Step 1: Verify HPA Enabled

```bash
# Check if HPA exists
kubectl get hpa -n basset-hound

# If not, create it
kubectl apply -f infrastructure/kubernetes/hpa.yaml

# Verify HPA
kubectl describe hpa basset-hound-browser-hpa -n basset-hound
```

#### Step 2: Configure HPA Metrics

Edit HPA configuration to set scaling policies:

```bash
kubectl edit hpa basset-hound-browser-hpa -n basset-hound
```

Configure these values:

```yaml
spec:
  minReplicas: 2              # Minimum 2 instances
  maxReplicas: 10             # Maximum 10 instances
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale up when CPU > 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Scale up when memory > 80%
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100              # Double instances
        periodSeconds: 30
      - type: Pods
        value: 2                # Or add 2 pods
        periodSeconds: 30
      selectPolicy: Max         # Apply fastest policy
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50               # Reduce by 50%
        periodSeconds: 60
```

#### Step 3: Verify HPA Metrics

```bash
# HPA requires metrics server
kubectl get deployment metrics-server -n kube-system

# If not installed, install metrics-server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Wait for metrics to be available
kubectl top nodes
kubectl top pods -n basset-hound

# Monitor HPA status
kubectl get hpa -n basset-hound --watch
```

#### Step 4: Test HPA Scaling

Generate load and watch HPA scale:

```bash
# Generate load (in separate terminal)
# Run load test that sends many WebSocket commands
./scripts/load-test.sh --duration 120 --concurrent 50

# Watch HPA and pods scale
kubectl get hpa -n basset-hound -w
kubectl get pods -n basset-hound -w

# Check HPA detailed status
kubectl describe hpa basset-hound-browser-hpa -n basset-hound
```

### Option 3: Manual Scaling with Helm

```bash
# Scale using Helm values
helm upgrade basset-hound \
  infrastructure/helm/basset-hound-browser/ \
  -n basset-hound \
  --set replicaCount=5

# Verify
helm values basset-hound -n basset-hound | grep replicaCount
kubectl get pods -n basset-hound
```

---

## Load Balancing Setup

### Kubernetes Service Load Balancing

Kubernetes automatically distributes traffic across pods.

#### Verify Service Configuration

```bash
# Check service type
kubectl get svc -n basset-hound
kubectl describe svc basset-hound-browser-service -n basset-hound

# Expected output shows:
# Type: ClusterIP or LoadBalancer or NodePort
# Selector: app=basset-hound-browser
# Endpoints: IP:8765 (list of all pod IPs)
```

#### Load Balancing Algorithms

Kubernetes service uses round-robin by default. To configure:

```bash
# Edit service load balancing policy
kubectl edit svc basset-hound-browser-service -n basset-hound
```

Options:
- **RoundRobin** (default): Evenly distribute requests
- **ClientIP**: Same client always goes to same pod (session affinity)

```yaml
spec:
  sessionAffinity: None        # RoundRobin
  sessionAffinity: ClientIP    # Sticky sessions
```

### External Load Balancing

#### Option 1: LoadBalancer Service Type

```yaml
apiVersion: v1
kind: Service
metadata:
  name: basset-lb
  namespace: basset-hound
spec:
  type: LoadBalancer
  selector:
    app: basset-hound-browser
  ports:
    - protocol: TCP
      port: 8765
      targetPort: 8765
  # Optional: Load balancer IP (if available)
  # loadBalancerIP: 10.0.0.1
```

#### Option 2: Ingress Load Balancing

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basset-ingress
  namespace: basset-hound
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - basset.example.com
      secretName: basset-tls
  rules:
    - host: basset.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: basset-hound-browser-service
                port:
                  number: 8765
```

#### Option 3: DNS Load Balancing

For multiple clusters or geographic distribution:

```bash
# Create DNS A record pointing to multiple backend IPs
# Clients connect to domain, DNS returns multiple IPs
# Client WebSocket libraries handle reconnection

# Example: basset.example.com A record:
# 10.0.0.10
# 10.0.0.11
# 10.0.0.12
```

---

## Verification and Testing

### Post-Scaling Verification

#### 1. Pod Status

```bash
# Check all pods healthy
kubectl get pods -n basset-hound -o wide
# Expected: All should be Running and Ready

# Check pod events
kubectl get events -n basset-hound
# Expected: No errors or warnings
```

#### 2. Service Connectivity

```bash
# Verify service endpoints
kubectl get endpoints -n basset-hound

# Test service connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://basset-hound-browser-service:8765/health

# Test from external (if LoadBalancer)
curl http://<load-balancer-ip>:8765/health
```

#### 3. Load Distribution

Test that load is distributed across instances:

```bash
# Generate 10 requests and check distribution
for i in {1..10}; do
  curl -s http://localhost:8765/pod-id | jq '.pod_name'
done

# Should see multiple different pod names
```

#### 4. Performance Metrics

```bash
# Check resource usage across pods
kubectl top pods -n basset-hound

# Expected:
# Each pod: 400-800MB memory, <10% CPU (idle)

# Check total capacity
kubectl top nodes
# Should have plenty of free resources
```

#### 5. Load Testing

Run comprehensive load test after scaling:

```bash
# Run load test
./scripts/load-test.sh \
  --duration 300 \
  --concurrent 100 \
  --rps 500

# Monitor metrics during test
kubectl get hpa -n basset-hound -w  # In separate terminal

# Check results
# - Error rate: < 1%
# - Latency P95: < 100ms
# - All pods healthy: kubectl get pods -n basset-hound
```

#### 6. Failover Testing

Test that system handles pod failures:

```bash
# Kill a random pod
kubectl delete pod <pod-name> -n basset-hound

# Verify service remains accessible
curl http://localhost:8765/health

# Check pod is automatically restarted
kubectl get pods -n basset-hound -w
# Should see new pod created

# Verify endpoints updated
kubectl get endpoints -n basset-hound
```

---

## Scaling Down Procedures

### Planned Scale Down

#### Step 1: Drain Traffic from Pods

```bash
# For graceful shutdown, set pod termination grace period
kubectl set env deployment/basset-hound-browser \
  GRACEFUL_SHUTDOWN=30s \
  -n basset-hound

# Apply new deployment
kubectl apply -f infrastructure/kubernetes/deployment.yaml
```

#### Step 2: Reduce Replicas

```bash
# Reduce to N replicas
kubectl scale deployment basset-hound-browser \
  --replicas=2 \
  -n basset-hound

# Monitor pod termination (should take ~30s each)
kubectl get pods -n basset-hound -w
```

#### Step 3: Verify Resources Released

```bash
# Check node resources freed
kubectl top nodes

# Check remaining pods healthy
kubectl get pods -n basset-hound -o wide

# Verify service still operational
curl http://localhost:8765/health
```

### Emergency Scale Down

If pods are stuck or not terminating:

```bash
# Force delete stuck pods (30s timeout exceeded)
kubectl delete pod <pod-name> \
  --grace-period=0 \
  --force \
  -n basset-hound

# Verify replacement scheduled
kubectl get pods -n basset-hound
```

### Auto-Scaling Adjustment

If HPA is scaling incorrectly:

```bash
# Disable HPA temporarily
kubectl patch hpa basset-hound-browser-hpa \
  -p '{"spec":{"minReplicas":2,"maxReplicas":2}}' \
  -n basset-hound

# Or delete and recreate with corrected values
kubectl delete hpa basset-hound-browser-hpa -n basset-hound
kubectl apply -f infrastructure/kubernetes/hpa-corrected.yaml
```

---

## Troubleshooting

### Problem: Pods not scaling

**Symptoms**: Metrics high but replicas not increasing

```bash
# Check HPA status
kubectl describe hpa basset-hound-browser-hpa -n basset-hound

# Common issues:
# 1. Metrics server not installed
kubectl get deployment metrics-server -n kube-system

# 2. Metrics not available
kubectl top pods -n basset-hound
# If no metrics, wait 2-3 minutes for metrics to be collected

# 3. HPA min/max incorrectly configured
kubectl get hpa -n basset-hound -o yaml | grep -A 2 "min\|max"

# Solution:
# Wait for metrics or force immediate scale
kubectl scale deployment basset-hound-browser \
  --replicas=5 -n basset-hound
```

### Problem: Uneven Load Distribution

**Symptoms**: Some pods getting high traffic, others idle

```bash
# Check service endpoints
kubectl get endpoints -n basset-hound

# Verify all pods healthy
kubectl get pods -n basset-hound

# Check service session affinity
kubectl describe svc basset-hound-browser-service -n basset-hound

# If using session affinity, connections stick to same pod
# Solution: Disable or adjust session timeout
kubectl patch svc basset-hound-browser-service \
  -p '{"spec":{"sessionAffinity":"None"}}' \
  -n basset-hound
```

### Problem: Pod crashes after scaling

**Symptoms**: Pods in CrashLoopBackOff after scale up

```bash
# Check pod logs
kubectl logs <pod-name> -n basset-hound

# Common causes:
# 1. Insufficient resources
kubectl top nodes
# Solution: Add more nodes or reduce replica count

# 2. Application error
kubectl logs <pod-name> -n basset-hound --previous
# Solution: Debug application error

# 3. PVC binding issue
kubectl describe pvc -n basset-hound
# Solution: Verify storage class and resources
```

### Problem: Service Not Accessible After Scaling

**Symptoms**: Health check fails on some scaled endpoints

```bash
# Check endpoint health
kubectl get endpoints -n basset-hound

# Test each endpoint
for ip in $(kubectl get endpoints basset-hound-browser-service \
  -n basset-hound -o jsonpath='{.subsets[].addresses[].ip}'); do
  echo "Testing $ip"
  curl -s http://$ip:8765/health
done

# Fix unhealthy endpoints
kubectl delete pod <pod-name> -n basset-hound
kubectl get pods -n basset-hound -w  # Wait for replacement
```

### Problem: High Memory After Scaling

**Symptoms**: Memory usage exceeds expected

```bash
# Check memory per pod
kubectl top pods -n basset-hound --sort-by=memory

# If one pod using too much:
# 1. Check for memory leak
kubectl logs <pod-name> -n basset-hound | grep -i "memory\|heap"

# 2. Restart pod
kubectl delete pod <pod-name> -n basset-hound

# 3. Monitor memory trend
kubectl top pod <pod-name> -n basset-hound --containers
```

---

## Quick Reference Commands

```bash
# View current replicas
kubectl get deployment basset-hound-browser -n basset-hound

# Scale manually
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound

# Patch deployment image
kubectl set image deployment/basset-hound-browser \
  basset=basset-hound-browser:12.7.0 -n basset-hound

# Monitor scaling
kubectl get pods -n basset-hound -w
kubectl top pod -n basset-hound

# Check HPA status
kubectl get hpa -n basset-hound
kubectl describe hpa basset-hound-browser-hpa -n basset-hound

# Edit HPA config
kubectl edit hpa basset-hound-browser-hpa -n basset-hound

# View metrics
kubectl top nodes
kubectl top pods -n basset-hound

# Load test
./scripts/load-test.sh --duration 300 --concurrent 100
```

---

## Scaling Success Criteria

Scaling is successful when:

- [ ] All pods in Running state
- [ ] Health checks passing on all pods
- [ ] Load distributed across pods (round-robin verified)
- [ ] No error rate increase
- [ ] Latency maintained or improved
- [ ] Memory usage reasonable (< 800MB per pod)
- [ ] CPU usage increased but < 70%
- [ ] Service endpoints all healthy
- [ ] Load test passes with new concurrent capacity
- [ ] No pod failures during scaling

---

## Related Documentation

- [Deployment Runbook](./RUNBOOK-DEPLOYMENT.md)
- [Monitoring Runbook](./RUNBOOK-MONITORING.md)
- [Maintenance Runbook](./RUNBOOK-MAINTENANCE.md)
- [Infrastructure README](../infrastructure/README.md)
- [Performance Baseline](../PERFORMANCE-BASELINE-SUMMARY.md)
