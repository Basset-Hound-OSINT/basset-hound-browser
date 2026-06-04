# Kubernetes Deployment Guide - Basset Hound Browser

**Document Version:** 1.0  
**Last Updated:** June 4, 2026  
**Classification:** Internal Operations  
**Audience:** DevOps, Infrastructure Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [Cluster Setup](#cluster-setup)
3. [Deployment Architecture](#deployment-architecture)
4. [Deployment Manifests](#deployment-manifests)
5. [Service Configuration](#service-configuration)
6. [Ingress Setup](#ingress-setup)
7. [StatefulSet for Data Services](#statefulset-for-data-services)
8. [Horizontal Pod Autoscaling](#horizontal-pod-autoscaling)
9. [Resource Management](#resource-management)
10. [Pod Security](#pod-security)
11. [Network Policies](#network-policies)
12. [Monitoring & Observability](#monitoring--observability)
13. [Operational Procedures](#operational-procedures)
14. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying Basset Hound Browser to Kubernetes, enabling:
- Scalable, container-orchestrated deployment
- Automatic load balancing and service discovery
- Horizontal Pod Autoscaling (HPA) for dynamic capacity
- Health monitoring and self-healing
- Rolling updates with zero downtime
- Resource quotas and isolation
- Security policies and RBAC

### Prerequisites

- Kubernetes cluster v1.24+ running
- kubectl configured with cluster access
- Helm 3.0+ (optional, for templating)
- Docker image pushed to registry (v12.0.0)
- Persistent storage provisioner (for data)
- Metrics server for HPA (optional)
- Ingress controller deployed (for external access)

### Architecture Overview

```
┌─────────────────────────────────────────┐
│       Kubernetes Cluster (1.24+)        │
├─────────────────────────────────────────┤
│  Namespace: basset-hound-browser        │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │  Ingress (nginx, path-based)    │  │
│  │  *.basset-hound.com/api/*       │  │
│  └────────────┬────────────────────┘  │
│               │                       │
│  ┌────────────▼────────────────────┐  │
│  │  Service (LoadBalancer or ClIP) │  │
│  │  basset-hound-api:8765          │  │
│  └────────────┬────────────────────┘  │
│               │                       │
│  ┌────────────▼────────────────────┐  │
│  │  Deployment: basset-hound       │  │
│  │  Replicas: 3-10 (auto-scaled)   │  │
│  │                                 │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ Pod (Replica 1)          │  │  │
│  │  │ - Container: basset:v12  │  │  │
│  │  │ - Port: 8765             │  │  │
│  │  │ - Resources: CPU/Memory  │  │  │
│  │  │ - Health checks: L/R     │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                 │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ Pod (Replica 2)          │  │  │
│  │  │ ...                      │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                 │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ Pod (Replica N)          │  │  │
│  │  │ ...                      │  │  │
│  │  └──────────────────────────┘  │  │
│  └─────────────────────────────────┘  │
│               │                       │
│  ┌────────────▼────────────────────┐  │
│  │ PersistentVolumeClaim (data)    │  │
│  │ - Storage: 50Gi                 │  │
│  │ - Class: fast-ssd               │  │
│  └─────────────────────────────────┘  │
│               │                       │
│  ┌────────────▼────────────────────┐  │
│  │  StatefulSet (if using)         │  │
│  │  - Redis/Database               │  │
│  └─────────────────────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │  HPA (Horizontal Pod Autoscaler)│  │
│  │  Min: 3, Max: 10 replicas       │  │
│  │  Target CPU: 70%                │  │
│  │  Target Memory: 80%             │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Cluster Setup

### 1. Create Namespace

```bash
# Create dedicated namespace for Basset Hound
kubectl create namespace basset-hound-browser

# Set as default namespace (optional)
kubectl config set-context --current --namespace=basset-hound-browser

# Verify namespace created
kubectl get namespace basset-hound-browser
```

### 2. Create Container Registry Secret

```bash
# If using private Docker registry
kubectl create secret docker-registry regcred \
  --docker-server=registry.company.com \
  --docker-username=<username> \
  --docker-password=<password> \
  --docker-email=<email> \
  -n basset-hound-browser

# For Docker Hub
kubectl create secret docker-registry dockerhub \
  --docker-server=docker.io \
  --docker-username=<username> \
  --docker-password=<token> \
  --docker-email=<email> \
  -n basset-hound-browser

# List secrets
kubectl get secrets -n basset-hound-browser
```

### 3. Create Storage Class

```bash
# For AWS (using EBS)
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: basset-ssd
  namespace: basset-hound-browser
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
allowVolumeExpansion: true
reclaimPolicy: Retain
EOF

# For GCP (using GKE)
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: basset-ssd
  namespace: basset-hound-browser
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: regional-pd
allowVolumeExpansion: true
reclaimPolicy: Retain
EOF

# For Azure
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: basset-ssd
  namespace: basset-hound-browser
provisioner: kubernetes.io/azure-disk
parameters:
  storageaccounttype: Premium_LRS
  kind: Managed
allowVolumeExpansion: true
reclaimPolicy: Retain
EOF

# Verify storage class
kubectl get storageclasses
```

### 4. Create ConfigMap for Configuration

```bash
# Create config directory
mkdir -p basset-config

# Create application config (adjust as needed)
cat > basset-config/app.conf <<EOF
# Basset Hound Browser Configuration
LOG_LEVEL=info
ENABLE_TOR=true
ENABLE_PROXY=true
COMPRESSION_ENABLED=true
MAX_CONCURRENT_SESSIONS=100
HEALTH_CHECK_INTERVAL=30
EOF

# Create ConfigMap
kubectl create configmap basset-config \
  --from-file=basset-config/ \
  -n basset-hound-browser

# Verify ConfigMap
kubectl get configmap basset-config -n basset-hound-browser -o yaml
```

### 5. Create Secrets for Sensitive Data

```bash
# Create Secret for credentials (adjust paths)
kubectl create secret generic basset-secrets \
  --from-file=tls.crt=./certs/tls.crt \
  --from-file=tls.key=./certs/tls.key \
  --from-literal=db_password=SecurePassword123 \
  --from-literal=api_token=your-api-token \
  -n basset-hound-browser

# Verify secret (data not shown)
kubectl get secret basset-secrets -n basset-hound-browser
```

---

## Deployment Architecture

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound
  namespace: basset-hound-browser
  labels:
    app: basset-hound
    version: v12.0.0
    component: browser
spec:
  # Replicas: Start with 3, HPA will scale to 10
  replicas: 3
  
  # Rolling update strategy
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1           # One extra pod during update
      maxUnavailable: 0     # Never take down a pod during update (zero downtime)
  
  selector:
    matchLabels:
      app: basset-hound
  
  # Pod template
  template:
    metadata:
      labels:
        app: basset-hound
        version: v12.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8765"
        prometheus.io/path: "/metrics"
    
    spec:
      # Service account
      serviceAccountName: basset-hound-sa
      
      # Image pull secrets
      imagePullSecrets:
        - name: regcred
      
      # Init containers (for setup/validation)
      initContainers:
        - name: wait-for-storage
          image: busybox:latest
          command: ['sh', '-c', 'until [ -d /data ]; do echo waiting for data dir; sleep 1; done']
          volumeMounts:
            - name: data
              mountPath: /data
      
      # Main container
      containers:
        - name: basset-hound
          image: registry.company.com/basset-hound:v12.0.0
          imagePullPolicy: IfNotPresent
          
          # Ports
          ports:
            - name: websocket
              containerPort: 8765
              protocol: TCP
              # Expose for service discovery
          
          # Environment variables
          env:
            - name: INSTANCE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
            
            - name: NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
            
            # From ConfigMap
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: basset-config
                  key: LOG_LEVEL
            
            - name: ENABLE_TOR
              valueFrom:
                configMapKeyRef:
                  name: basset-config
                  key: ENABLE_TOR
            
            # From Secrets
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: basset-secrets
                  key: db_password
            
            - name: API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: basset-secrets
                  key: api_token
          
          # Resource requests & limits
          resources:
            requests:
              cpu: 500m           # Minimum CPU guarantee
              memory: 512Mi       # Minimum memory guarantee
            limits:
              cpu: 2000m          # Maximum CPU allowed
              memory: 2Gi         # Maximum memory allowed
          
          # Liveness probe (restart if unhealthy)
          livenessProbe:
            httpGet:
              path: /health
              port: websocket
              scheme: HTTP
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          
          # Readiness probe (remove from service if not ready)
          readinessProbe:
            httpGet:
              path: /health
              port: websocket
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2
          
          # Startup probe (for slower containers)
          startupProbe:
            httpGet:
              path: /health
              port: websocket
              scheme: HTTP
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 30  # 5 minutes to start
          
          # Volume mounts
          volumeMounts:
            - name: data
              mountPath: /data
            - name: config
              mountPath: /etc/basset
              readOnly: true
      
      # Pod security context
      securityContext:
        fsGroup: 1000
        runAsNonRoot: true
        runAsUser: 1000
      
      # Volumes
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: basset-data-pvc
        
        - name: config
          configMap:
            name: basset-config
            defaultMode: 0644
      
      # Pod anti-affinity (spread pods across nodes)
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - basset-hound
                topologyKey: kubernetes.io/hostname
        
        # Node affinity (prefer specific node pools)
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 50
              preference:
                matchExpressions:
                  - key: node-role
                    operator: In
                    values:
                      - compute
```

### Deployment Apply Procedure

```bash
# Apply deployment
kubectl apply -f deployment.yaml -n basset-hound-browser

# Watch rollout progress
kubectl rollout status deployment/basset-hound -n basset-hound-browser

# Check pod status
kubectl get pods -n basset-hound-browser

# Check deployment status
kubectl describe deployment basset-hound -n basset-hound-browser

# Check for errors
kubectl logs -n basset-hound-browser -l app=basset-hound --tail=50
```

---

## Service Configuration

### ClusterIP Service (Internal)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: basset-hound-internal
  namespace: basset-hound-browser
  labels:
    app: basset-hound
spec:
  type: ClusterIP
  selector:
    app: basset-hound
  ports:
    - name: websocket
      port: 8765
      targetPort: websocket
      protocol: TCP
```

### LoadBalancer Service (External)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: basset-hound-lb
  namespace: basset-hound-browser
  labels:
    app: basset-hound
spec:
  type: LoadBalancer
  
  # Port allocation (choose one)
  # For AWS NLB: use externalTrafficPolicy: Local for better performance
  # externalTrafficPolicy: Local
  
  selector:
    app: basset-hound
  
  ports:
    - name: websocket
      port: 8765
      targetPort: websocket
      protocol: TCP
  
  # Session affinity (optional)
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600
```

### Service Discovery

```bash
# Get service IP
kubectl get svc basset-hound-lb -n basset-hound-browser

# Get external IP (may take time)
kubectl get svc basset-hound-lb -n basset-hound-browser -w

# DNS name (internal)
basset-hound-internal.basset-hound-browser.svc.cluster.local:8765

# Test connectivity
kubectl run -it --rm curl --image=curlimages/curl --restart=Never -- \
  curl http://basset-hound-internal.basset-hound-browser.svc.cluster.local:8765/health
```

---

## Ingress Setup

### NGINX Ingress Controller

```bash
# Install NGINX Ingress Controller (if not present)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

### Ingress Manifest

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basset-hound-ingress
  namespace: basset-hound-browser
  annotations:
    # NGINX specific annotations
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    
    # WebSocket support
    nginx.ingress.kubernetes.io/websocket-services: basset-hound-internal
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    
    # Rate limiting (optional)
    nginx.ingress.kubernetes.io/limit-rps: "100"
    
    # Security headers
    nginx.ingress.kubernetes.io/add-headers: basset-hound-browser/security-headers
    
    # SSL redirect
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  # TLS configuration
  tls:
    - hosts:
        - basset.company.com
        - api.basset.company.com
      secretName: basset-tls-cert
  
  # Routing rules
  rules:
    # Main domain
    - host: basset.company.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: basset-hound-internal
                port:
                  number: 8765
    
    # API subdomain
    - host: api.basset.company.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: basset-hound-internal
                port:
                  number: 8765
```

### Security Headers ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-headers
  namespace: basset-hound-browser
data:
  X-Frame-Options: "DENY"
  X-Content-Type-Options: "nosniff"
  X-XSS-Protection: "1; mode=block"
  Referrer-Policy: "strict-origin-when-cross-origin"
  Content-Security-Policy: "default-src 'self'; connect-src 'self' wss://;"
```

---

## StatefulSet for Data Services

### StatefulSet Manifest (for Redis/Database)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: basset-data
  namespace: basset-hound-browser
spec:
  serviceName: basset-data
  replicas: 3
  
  selector:
    matchLabels:
      app: basset-data
  
  template:
    metadata:
      labels:
        app: basset-data
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app
                    operator: In
                    values:
                      - basset-data
              topologyKey: kubernetes.io/hostname
      
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - name: redis
              containerPort: 6379
          
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          
          volumeMounts:
            - name: data
              mountPath: /data
          
          livenessProbe:
            exec:
              command:
                - redis-cli
                - ping
            initialDelaySeconds: 10
            periodSeconds: 10
  
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: basset-ssd
        resources:
          requests:
            storage: 10Gi
```

---

## Horizontal Pod Autoscaling

### HPA Manifest

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: basset-hound-hpa
  namespace: basset-hound-browser
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: basset-hound
  
  minReplicas: 3
  maxReplicas: 10
  
  metrics:
    # CPU-based scaling
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70  # Scale at 70% CPU
    
    # Memory-based scaling
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80  # Scale at 80% memory
    
    # Custom metric (if using Prometheus)
    - type: Pods
      pods:
        metric:
          name: websocket_connections
        target:
          type: AverageValue
          averageValue: "100"  # 100 connections per pod
  
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60  # Max 50% reduction per minute
    
    scaleUp:
      stabilizationWindowSeconds: 30   # Wait 30s before scaling up
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30  # Max 100% increase per 30 seconds
        - type: Pods
          value: 2
          periodSeconds: 30  # Max 2 pods per 30 seconds
      selectPolicy: Max  # Use policy with highest change
```

### Monitor HPA

```bash
# Check HPA status
kubectl get hpa -n basset-hound-browser

# Watch HPA in action
kubectl get hpa basset-hound-hpa -n basset-hound-browser -w

# Get detailed status
kubectl describe hpa basset-hound-hpa -n basset-hound-browser

# Check metrics server
kubectl get deployment metrics-server -n kube-system
```

---

## Resource Management

### Resource Quotas

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: basset-hound-browser
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: basset-quota
  namespace: basset-hound-browser
spec:
  hard:
    requests.cpu: "20"           # Total CPU request limit
    requests.memory: "40Gi"      # Total memory request limit
    limits.cpu: "50"             # Total CPU limit
    limits.memory: "100Gi"       # Total memory limit
    pods: "100"                  # Max number of pods
    services.loadbalancers: "2"  # Max load balancers
    persistentvolumeclaims: "10" # Max PVCs
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: basset-network-policy
  namespace: basset-hound-browser
spec:
  podSelector:
    matchLabels:
      app: basset-hound
  
  policyTypes:
    - Ingress
    - Egress
  
  ingress:
    # Allow from ingress controller
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8765
    
    # Allow from same namespace
    - from:
        - podSelector:
            matchLabels:
              app: basset-hound
      ports:
        - protocol: TCP
          port: 8765
  
  egress:
    # Allow DNS
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
    
    # Allow HTTPS
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443
    
    # Allow HTTP
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 80
    
    # Allow to databases/external services
    - to:
        - podSelector:
            matchLabels:
              app: basset-data
      ports:
        - protocol: TCP
          port: 6379
```

---

## Pod Security

### Pod Security Policy

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: basset-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  runAsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1000
        max: 65535
  seLinux:
    rule: 'MustRunAs'
    seLinuxOptions:
      level: "s0:c123,c456"
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1000
        max: 65535
  readOnlyRootFilesystem: false
  hostNetwork: false
  hostIPC: false
  hostPID: false
```

### Service Account & RBAC

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: basset-hound-sa
  namespace: basset-hound-browser
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: basset-hound-role
  namespace: basset-hound-browser
rules:
  # Read ConfigMaps
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
  
  # Read Secrets
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
  
  # Read Pods (for discovery)
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: basset-hound-rolebinding
  namespace: basset-hound-browser
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: basset-hound-role
subjects:
  - kind: ServiceAccount
    name: basset-hound-sa
    namespace: basset-hound-browser
```

---

## Monitoring & Observability

### Prometheus ServiceMonitor (for Prometheus Operator)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: basset-hound
  namespace: basset-hound-browser
  labels:
    app: basset-hound
spec:
  selector:
    matchLabels:
      app: basset-hound
  
  endpoints:
    - port: websocket
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
```

### PrometheusRule for Alerting

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: basset-hound-alerts
  namespace: basset-hound-browser
spec:
  groups:
    - name: basset-hound.rules
      interval: 30s
      rules:
        # High error rate
        - alert: BassetHighErrorRate
          expr: |
            (sum(rate(http_requests_failed_total[5m])) 
             / sum(rate(http_requests_total[5m]))) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Basset error rate > 5%"
            value: "{{ $value | humanizePercentage }}"
        
        # High latency
        - alert: BassetHighLatency
          expr: |
            histogram_quantile(0.95, 
              rate(request_duration_seconds_bucket[5m])) > 1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Basset p95 latency > 1s"
        
        # Pod restart loop
        - alert: BassetPodRestartLoop
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Basset pod in restart loop"
        
        # Memory usage
        - alert: BassetHighMemory
          expr: |
            (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Basset using > 90% memory"
```

---

## Operational Procedures

### Rolling Update

```bash
# Update image
kubectl set image deployment/basset-hound \
  basset-hound=registry.company.com/basset-hound:v12.1.0 \
  -n basset-hound-browser

# Watch rollout
kubectl rollout status deployment/basset-hound -n basset-hound-browser -w

# Check history
kubectl rollout history deployment/basset-hound -n basset-hound-browser

# Rollback if needed
kubectl rollout undo deployment/basset-hound -n basset-hound-browser
```

### Scale Manually

```bash
# Scale to specific number of replicas
kubectl scale deployment basset-hound --replicas=5 -n basset-hound-browser

# Check current replicas
kubectl get deployment basset-hound -n basset-hound-browser
```

### Port Forwarding for Testing

```bash
# Forward local port to service
kubectl port-forward svc/basset-hound-internal 8765:8765 -n basset-hound-browser

# Now connect to localhost:8765
curl http://localhost:8765/health
```

### Pod Logs

```bash
# Get logs from one pod
kubectl logs <pod-name> -n basset-hound-browser

# Stream logs
kubectl logs -f <pod-name> -n basset-hound-browser

# Get logs from all pods
kubectl logs -l app=basset-hound -n basset-hound-browser --all-containers=true

# Previous logs (if pod crashed)
kubectl logs <pod-name> --previous -n basset-hound-browser
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n basset-hound-browser

# Check events
kubectl get events -n basset-hound-browser --sort-by='.lastTimestamp'

# Common issues:
# - ImagePullBackOff: Registry credentials wrong
# - CrashLoopBackOff: Container fails to start
# - Pending: Not enough resources or PVC not bound
```

### Resource Constraints

```bash
# Check node resources
kubectl top nodes

# Check pod resource usage
kubectl top pods -n basset-hound-browser

# Check resource requests vs available
kubectl describe nodes | grep -A 5 "Allocated resources"

# If no resources:
# 1. Add more nodes to cluster
# 2. Reduce replica count
# 3. Reduce resource requests
```

### PVC Not Binding

```bash
# Check PVC status
kubectl get pvc -n basset-hound-browser

# Check PV status
kubectl get pv

# If "Pending":
# - Storage class may not exist
# - Storage provisioner not running
# - Disk quota exceeded

# Check storage class
kubectl get storageclass
```

---

## Document Status

**Version:** 1.0  
**Created:** June 4, 2026  
**Last Updated:** June 4, 2026  
**Status:** Production Ready  
**Classification:** Internal Operations  

---

**End of Kubernetes Deployment Guide**
