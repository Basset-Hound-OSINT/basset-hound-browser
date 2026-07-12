# Wave 16: Kubernetes Deployment Architecture

**Date:** June 2, 2026  
**Phase:** Architecture Design (Phase 3)  
**Duration:** 2 hours design  
**Status:** Detailed Design - Architecture Planning Only

---

## Executive Summary

This document defines Kubernetes deployment architecture for Basset Hound Browser. This is ARCHITECTURE DESIGN ONLY - no actual Kubernetes infrastructure is created or scaled during Wave 16 planning. Implementation occurs in Wave 16 execution phase.

---

## Kubernetes Cluster Design

### Multi-Region Cluster Topology

```
AWS Region: us-east-1
└─ EKS Cluster: basset-hound-us-prod
   ├─ Node Group: compute-default (m5.2xlarge, on-demand)
   │  ├─ Node 1 (max 30 pods)
   │  ├─ Node 2 (max 30 pods)
   │  └─ Node 3 (max 30 pods)
   │
   ├─ Node Group: compute-spot (m5.2xlarge, spot 70% discount)
   │  ├─ Node 1-10 (auto-scaling, scale-based)
   │  └─ Fallback to on-demand if spot unavailable
   │
   └─ Node Group: database (r5.2xlarge, memory-optimized)
      ├─ Node 1 (PostgreSQL primary)
      └─ Node 2 (Redis Sentinel)

AWS Region: eu-west-1
└─ EKS Cluster: basset-hound-eu-dr
   ├─ Node Group: compute-default (m5.2xlarge, on-demand)
   │  ├─ Node 1 (max 30 pods)
   │  └─ Node 2 (max 30 pods)
   │
   └─ Node Group: database (r5.2xlarge)
      ├─ Node 1 (PostgreSQL replica)
      └─ Node 2 (Redis Sentinel replica)
```

### Namespace Organization

```
kube-system
  ├─ kube-apiserver
  ├─ kube-controller-manager
  ├─ kube-scheduler
  └─ coredns, etcd, etc.

kube-monitoring
  ├─ prometheus
  ├─ grafana
  ├─ alertmanager
  └─ node-exporter, kube-state-metrics

kube-logging
  ├─ elasticsearch
  ├─ logstash
  ├─ kibana
  └─ filebeat

kube-ingress
  ├─ nginx-ingress-controller
  ├─ cert-manager
  └─ external-dns

basset-hound-prod
  ├─ Deployments: basset-hound-browser (stateless app)
  ├─ StatefulSets: postgres, redis-sentinel
  ├─ Services: internal, external
  ├─ ConfigMaps: configuration
  ├─ Secrets: credentials, certificates
  └─ PersistentVolumeClaims: storage

basset-hound-staging
  ├─ Same structure as prod (smaller scale)
  └─ 1-2 instance replicas

basset-hound-dev
  └─ Developer namespaces (ephemeral)
```

---

## Deployment Configuration (Helm)

### Helm Chart Structure

```
basset-hound-browser/
├─ Chart.yaml
│  version: 1.0.0
│  appVersion: 12.0.0
│
├─ values.yaml
│  prod: replicas=10, resources=high
│  staging: replicas=3, resources=medium
│  dev: replicas=1, resources=low
│
├─ values-prod.yaml
│  # Production overrides
│  replicas: 10
│  resources:
│    requests: { cpu: 1000m, memory: 2Gi }
│    limits: { cpu: 2000m, memory: 4Gi }
│
├─ templates/
│  ├─ deployment.yaml
│  ├─ service.yaml
│  ├─ configmap.yaml
│  ├─ secrets.yaml
│  ├─ hpa.yaml
│  ├─ pdb.yaml (pod disruption budget)
│  └─ network-policy.yaml
│
└─ hooks/
   ├─ pre-upgrade.yaml (validation)
   └─ post-upgrade.yaml (smoke tests)
```

### Deployment Specification

**File: `templates/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound-browser
  namespace: basset-hound-prod
  labels:
    app: basset-hound-browser
    version: 12.0.0
    managed-by: helm

spec:
  replicas: {{ .Values.replicas }}  # 10 in prod
  
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Add 1 new pod before removing old
      maxUnavailable: 0  # Never have 0 instances (HA)
  
  selector:
    matchLabels:
      app: basset-hound-browser
  
  template:
    metadata:
      labels:
        app: basset-hound-browser
        version: 12.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8765"
        prometheus.io/path: "/metrics"
    
    spec:
      # High availability: spread pods across nodes
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
                  - basset-hound-browser
              topologyKey: kubernetes.io/hostname
      
      # Graceful shutdown
      terminationGracePeriodSeconds: 30
      
      # Service account with RBAC
      serviceAccountName: basset-hound-browser
      
      containers:
      - name: app
        image: basset-hound-browser:12.0.0
        imagePullPolicy: IfNotPresent
        
        ports:
        - name: websocket
          containerPort: 8765
          protocol: TCP
        - name: metrics
          containerPort: 9090
          protocol: TCP
        
        # Resource limits (per instance)
        resources:
          requests:
            cpu: 1000m          # 1 vCPU minimum
            memory: 2Gi         # 2 GB minimum
            ephemeral-storage: 5Gi
          limits:
            cpu: 2000m          # 2 vCPU maximum
            memory: 4Gi         # 4 GB maximum
            ephemeral-storage: 10Gi
        
        # Environment configuration
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: basset-hound-config
              key: redis.host
        - name: REDIS_PORT
          valueFrom:
            configMapKeyRef:
              name: basset-hound-config
              key: redis.port
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: basset-hound-config
              key: db.host
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: basset-hound-secrets
              key: db.user
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: basset-hound-secrets
              key: db.password
        - name: JAEGER_AGENT_HOST
          value: "jaeger-agent.kube-monitoring"
        - name: JAEGER_AGENT_PORT
          value: "6831"
        
        # Liveness probe (is container alive?)
        livenessProbe:
          httpGet:
            path: /health/live
            port: websocket
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 2
          successThreshold: 1
          failureThreshold: 3
        
        # Readiness probe (ready to serve traffic?)
        readinessProbe:
          httpGet:
            path: /health/ready
            port: websocket
            scheme: HTTP
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 1
          successThreshold: 1
          failureThreshold: 2
        
        # Startup probe (has app started?)
        startupProbe:
          httpGet:
            path: /health/live
            port: websocket
          failureThreshold: 30
          periodSeconds: 10
        
        # Graceful shutdown
        lifecycle:
          preStop:
            exec:
              command:
              - /bin/sh
              - -c
              - sleep 15 && kill 1  # 15 sec drain period
        
        # Security context
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          capabilities:
            drop:
            - ALL
        
        # Volume mounts
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/cache
      
      # Pod-level security context
      securityContext:
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
      
      # Volumes
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
        sizeLimit: 1Gi
```

---

## Horizontal Pod Autoscaler (HPA)

**File: `templates/hpa.yaml`**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: basset-hound-browser
  namespace: basset-hound-prod

spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: basset-hound-browser
  
  minReplicas: 2    # Always run 2 (HA)
  maxReplicas: 20   # Never exceed 20 (cost limit)
  
  metrics:
  # Scale on CPU usage
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale up if >70%
  
  # Scale on memory usage
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Scale up if >80%
  
  # Scale on custom metric (connections)
  - type: Pods
    pods:
      metric:
        name: basset_connections
      target:
        type: AverageValue
        averageValue: "250"  # Scale if >250 connections/pod
  
  # Scale on custom metric (message rate)
  - type: Pods
    pods:
      metric:
        name: basset_msg_rate
      target:
        type: AverageValue
        averageValue: "600"  # Scale if >600 msg/sec/pod
  
  behavior:
    # Scale up aggressively
    scaleUp:
      stabilizationWindowSeconds: 0  # React immediately
      policies:
      - type: Percent
        value: 100  # Double the replicas
        periodSeconds: 15
      - type: Pods
        value: 2    # Or add 2 pods
        periodSeconds: 15
      selectPolicy: Max  # Use whichever is more aggressive
    
    # Scale down conservatively
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 minutes
      policies:
      - type: Percent
        value: 50   # Remove 50% of replicas
        periodSeconds: 60
      - type: Pods
        value: 1    # Or remove 1 pod
        periodSeconds: 60
      selectPolicy: Min  # Use whichever removes fewer pods
```

**HPA Behavior:**

| Scenario | Response | Timeline |
|----------|----------|----------|
| CPU 70-75% | Add 1 instance | 15 seconds |
| CPU >85% | Double instances | 15 seconds |
| Connections >250 | Add 1 instance | 15 seconds |
| CPU <30% for 5m | Remove 1 instance | 5+ minutes |

---

## Pod Disruption Budget (PDB)

**File: `templates/pdb.yaml`**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: basset-hound-browser
  namespace: basset-hound-prod

spec:
  minAvailable: 2  # Always keep 2 pods available
  selector:
    matchLabels:
      app: basset-hound-browser
  
  # Protect against voluntary disruptions
  # (cluster upgrades, node drains, etc.)
```

**Effect:** Even during cluster maintenance, 2 pods remain available for traffic.

---

## Network Policies

**File: `templates/network-policy.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: basset-hound-browser
  namespace: basset-hound-prod

spec:
  podSelector:
    matchLabels:
      app: basset-hound-browser
  
  policyTypes:
  - Ingress
  - Egress
  
  # Ingress: Accept traffic from load balancer only
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kube-ingress
    ports:
    - protocol: TCP
      port: 8765
  
  # Egress: Allow outbound to specific services
  egress:
  # Allow to Redis
  - to:
    - podSelector:
        matchLabels:
          app: redis-sentinel
    ports:
    - protocol: TCP
      port: 6379
  
  # Allow to PostgreSQL
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  
  # Allow DNS (CoreDNS)
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  
  # Allow to external APIs (if needed)
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32  # Block AWS metadata service
    ports:
    - protocol: TCP
      port: 443
```

---

## StatefulSet for Databases

**File: `templates/statefulset-postgres.yaml`**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-primary
  namespace: basset-hound-prod

spec:
  serviceName: postgres  # Headless service
  replicas: 1  # Primary only (replicas are read-only)
  
  selector:
    matchLabels:
      app: postgres
  
  template:
    metadata:
      labels:
        app: postgres
    
    spec:
      containers:
      - name: postgres
        image: postgres:14
        ports:
        - containerPort: 5432
        
        env:
        - name: POSTGRES_DB
          value: basset_hound
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: password
        
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
      
      # Affinity: run on dedicated node
      affinity:
        nodeSelector:
          node-type: database
  
  # Persistent volume claim
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
```

---

## Service Configuration

**File: `templates/service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: basset-hound-browser
  namespace: basset-hound-prod

spec:
  type: ClusterIP  # Internal only (exposed via ingress)
  selector:
    app: basset-hound-browser
  
  ports:
  - name: websocket
    port: 8765
    targetPort: 8765
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  
  # Load balancing algorithm
  sessionAffinity: None  # Round-robin (sticky via haproxy)
  
  # Service discovery
  clusterIP: 10.0.0.100
```

---

## Configuration & Secrets

**ConfigMap Example:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: basset-hound-config
  namespace: basset-hound-prod

data:
  redis.host: "redis-sentinel.basset-hound-prod.svc.cluster.local"
  redis.port: "26379"
  db.host: "postgres-primary.basset-hound-prod.svc.cluster.local"
  db.port: "5432"
  db.name: "basset_hound"
  monitoring.enabled: "true"
  monitoring.sample_rate: "0.1"
```

**Secrets Example:**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: basset-hound-secrets
  namespace: basset-hound-prod

type: Opaque
data:
  db.user: YmFzc2V0X3VzZXI=  # base64: basset_user
  db.password: c2VjdXJlUGFzczEyMw==  # base64: securePass123
  api.key: YWJjZGVmMTIzNDU2  # base64: abcdef123456
```

---

## Cluster Autoscaling

**Cluster Autoscaler Configuration:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler-status
  namespace: kube-system

data:
  nodes.max: "30"        # Max nodes in cluster
  nodes.min: "3"         # Min nodes for HA
  scale-down-enabled: "true"
  scale-down-delay-after-add: "10m"
  scale-down-delay-after-failure: "3m"
  skip-nodes-with-system-pods: "false"
```

---

## Deployment Procedure

```bash
# 1. Build and push Docker image
docker build -t basset-hound-browser:12.0.0 .
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/basset-hound-browser:12.0.0

# 2. Create/update Helm release
helm upgrade --install basset-hound-browser ./helm/charts/basset-hound-browser \
  --namespace basset-hound-prod \
  --values helm/values-prod.yaml \
  --set image.tag=12.0.0

# 3. Verify deployment
kubectl rollout status deployment/basset-hound-browser -n basset-hound-prod

# 4. Monitor pods
kubectl get pods -n basset-hound-prod
kubectl logs -f deployment/basset-hound-browser -n basset-hound-prod
```

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | WAVE-16-PHASE-3-KUBERNETES |
| Version | 1.0 |
| Status | Draft (Architecture Planning Only) |
| Created | June 2, 2026 |
| Owner | Architecture Team |

---

**Next Document:** `/docs/wave16/07-EXECUTION-PLAN.md`
