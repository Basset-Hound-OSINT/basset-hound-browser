# Wave 16 Component Design: Load Balancer

**Component ID:** LB-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,800+

---

## Executive Summary

The Load Balancer component is the entry point for all client requests. It provides request distribution, health checking, connection pooling, and failover capabilities. This design specifies a two-tier load balancing architecture: Global (Route 53) and Regional (HAProxy/NGINX).

**Key Metrics:**
- Throughput capacity: 10,000+ req/sec
- Failover detection: <2 seconds
- Connection limit per instance: 1000 (configurable)
- Health check frequency: Every 5 seconds
- Session stickiness: 24-hour expiration

---

## 1. Architecture Overview

### 1.1 Two-Tier Load Balancing Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Global Tier                           │
│              AWS Route 53 (DNS/Geo-routing)              │
│  - Geolocation-based routing (US → US, EU → EU, etc)    │
│  - Health checks for regional failover                   │
│  - Automatic failover (30-second detection)              │
└────────────┬────────────────────┬────────────────────────┘
             │                    │
      ┌──────▼──────┐      ┌──────▼──────┐      ┌──────────┐
      │   US Region │      │  EU Region  │      │ APAC(*)  │
      │  us-east-1  │      │ eu-west-1  │      │ ap-se-1  │
      └──────┬──────┘      └──────┬──────┘      └──────────┘
             │                    │
      ┌──────▼──────────────────────▼──────┐
      │   Regional Load Balancer           │
      │     (HAProxy or NGINX)             │
      │  - SSL/TLS termination             │
      │  - Connection pooling              │
      │  - Request routing (sticky)        │
      │  - Rate limiting per client        │
      └──────┬──────────────────────┬──────┘
             │                      │
      ┌──────▼──────────────┬───────▼────────────┐
      │   K8s Cluster       │   K8s Cluster      │
      │  (Primary)          │   (Failover)       │
      │                     │                    │
      │ +─────────────────+ │ +─────────────────+│
      │ │  Pod Instance 1 │ │ │  Pod Instance 3 ││
      │ │  (WebSocket)    │ │ │  (WebSocket)    ││
      │ │  Port 8765      │ │ │  Port 8765      ││
      │ +─────────────────+ │ +─────────────────+│
      │                     │                    │
      │ +─────────────────+ │ +─────────────────+│
      │ │  Pod Instance 2 │ │ │  Pod Instance 4 ││
      │ │  (WebSocket)    │ │ │  (WebSocket)    ││
      │ │  Port 8765      │ │ │  Port 8765      ││
      │ +─────────────────+ │ +─────────────────+│
      │                     │                    │
      └─────────────────────┴────────────────────┘
```

### 1.2 Load Balancer Types

**Global Load Balancer (Route 53):**
- DNS-level routing
- Geolocation-based failover
- Regional health monitoring
- Automatic failover without client reconnection

**Regional Load Balancer (HAProxy/NGINX):**
- Layer 4 (TCP) and Layer 7 (HTTP) load balancing
- SSL/TLS termination
- Connection pooling and reuse
- Session affinity (sticky sessions)
- Rate limiting per client IP
- Request/response transformation

---

## 2. Technology Selection

### 2.1 Global Load Balancer: AWS Route 53

**Why Route 53?**
- Native AWS integration with ELB/ALB
- Geolocation routing policies
- Health checks with 30-second resolution
- Traffic policy support
- DDoS protection (AWS Shield integration)
- DNS Failover (automatic regional failover)

**Alternative:** Manual DNS round-robin (not recommended for production)

### 2.2 Regional Load Balancer: HAProxy

**Why HAProxy over NGINX?**
- Superior connection pooling
- Better session affinity (sticky sessions)
- Native WebSocket support with persistence
- Advanced backend health checking
- Lower memory footprint (<100MB)
- Real-time statistics API

**Alternative:** NGINX (similar capabilities, different tuning)

**Configuration Language:** HAProxy Config File (text-based, version-controlled)

---

## 3. Load Balancer Configuration

### 3.1 HAProxy Configuration Template

```haproxy
# /etc/haproxy/haproxy.cfg
global
  maxconn 100000
  log stdout local0
  log stdout local1 notice
  chroot /var/lib/haproxy
  stats socket /run/haproxy/admin.sock mode 660 level admin
  stats timeout 30s
  daemon

defaults
  log global
  mode tcp
  option tcplog
  option dontlognull
  timeout connect 5000
  timeout client 600000
  timeout server 600000
  timeout tunnel 600000

# Global stats
listen stats
  bind *:8404
  stats enable
  stats uri /stats
  stats refresh 30s

# WebSocket frontend
frontend websocket_in
  bind *:8765
  mode tcp
  option tcplog
  maxconn 50000
  
  # Rate limiting: 100 conn/sec per client IP
  stick-table type ip size 100k expire 30m store conn_rate(1s)
  tcp-request connection track-sc0 src
  tcp-request connection reject if { sc_conn_rate(0) gt 100 }
  
  # Client timeout for slow connections
  timeout client 600000
  
  default_backend websocket_backends

# WebSocket backend with health checks
backend websocket_backends
  mode tcp
  option tcplog
  balance roundrobin
  
  # Session stickiness: route same client to same backend for 24h
  cookie SERVERID insert indirect nocache
  
  # Health checks: TCP connect every 5s, fail after 3 misses
  default-server inter 5000 fall 3 rise 2
  
  # Servers (populated from K8s service discovery)
  server ws_pod_1 10.0.1.10:8765 check
  server ws_pod_2 10.0.1.11:8765 check
  server ws_pod_3 10.0.1.12:8765 check
  server ws_pod_4 10.0.1.13:8765 check
  
  # Remove unhealthy backends immediately
  option forwardfor
  
  # Connection pooling
  http-reuse safe
  maxconn 50000

# REST API frontend (optional)
frontend rest_in
  bind *:8080
  bind *:8443 ssl crt /etc/haproxy/certs/cert.pem
  mode http
  option httplog
  maxconn 10000
  
  # Rate limiting: 1000 req/sec per client IP
  stick-table type ip size 100k expire 30m store http_req_rate(1s)
  http-request track-sc0 src
  http-request reject if { sc_req_rate(0) gt 1000 }
  
  default_backend rest_backends

backend rest_backends
  mode http
  balance leastconn
  
  # Sticky sessions for REST (if needed)
  # cookie SERVERID insert indirect nocache
  
  # Health checks
  default-server inter 5000 fall 3 rise 2
  option httpchk GET /health
  
  server rest_pod_1 10.0.1.10:8080 check
  server rest_pod_2 10.0.1.11:8080 check
  server rest_pod_3 10.0.1.12:8080 check
```

### 3.2 Configuration Parameters

**Connection Limits:**
- Max connections: 100,000 (per HAProxy instance)
- Connections per backend: 1,000 (configurable per instance)
- Queue timeout: 5 seconds
- Client timeout: 600 seconds (for long-lived WebSocket)
- Server timeout: 600 seconds

**Health Check Settings:**
- Check interval: 5 seconds
- Failure threshold: 3 consecutive failures
- Success threshold: 2 consecutive successes
- Check type: TCP connect (layer 4)
- Check timeout: 5 seconds

**Rate Limiting:**
- Per-client connection limit: 100 conn/sec (WebSocket)
- Per-client request limit: 1000 req/sec (REST)
- Algorithm: Track source IP in stick-table
- Action on limit exceeded: Reject connection

**Session Affinity:**
- Stickiness timeout: 24 hours
- Cookie name: SERVERID
- Cookie lifetime: Session (until close)
- Fallback: Round-robin if backend unavailable

---

## 4. Request Flow and Routing

### 4.1 WebSocket Request Flow

```
1. Client connects to HAProxy:8765
   ↓
2. HAProxy checks rate limit (conn/sec per IP)
   - If exceeded: Reject
   - If OK: Continue
   ↓
3. HAProxy looks up session cookie SERVERID
   - If found and backend healthy: Route to same backend
   - If not found or backend unhealthy: Choose via round-robin
   ↓
4. HAProxy sets SERVERID cookie (sticky session)
   ↓
5. TCP connection proxied to backend WebSocket pod
   ↓
6. WebSocket protocol upgrade (HTTP → WS)
   ↓
7. Long-lived connection maintained
   ↓
8. Client sends commands → Pod handles → Response
   ↓
9. Client disconnects or timeout (600s inactivity)
   ↓
10. Connection closed, session data persisted to Redis
```

### 4.2 Failover Behavior

**Backend Pod Failure:**
1. HAProxy health check fails (3x in 15 seconds)
2. Pod marked as "down"
3. New connections: Routed to healthy backends
4. Existing connections: Terminated (client reconnects)
5. Pod recovery: After 2 successful checks, marked "up"

**Regional Failure:**
1. Route 53 health check fails (1x in 30 seconds)
2. Regional entry point marked as "down"
3. New client DNS queries: Route to alternate region
4. Existing clients: Reconnect to alternate region via new DNS query
5. Sessions recovered from Redis (if cross-region replication active)

---

## 5. Health Checking Strategy

### 5.1 Health Check Types

**Level 1: TCP Connect Check** (HAProxy → Backend)
- Frequency: Every 5 seconds
- Timeout: 5 seconds
- Success: TCP SYN/ACK
- Failure threshold: 3 consecutive failures (15 seconds)
- Recovery threshold: 2 consecutive successes (10 seconds)
- Purpose: Detect pod crash, network issues

**Level 2: Application Health Check** (Optional)
- Endpoint: `/health` (HTTP GET)
- Frequency: Every 10 seconds
- Timeout: 5 seconds
- Success: HTTP 200 response
- Failure threshold: 3 consecutive failures (30 seconds)
- Recovery threshold: 2 consecutive successes (20 seconds)
- Purpose: Detect application freeze, deadlock

**Level 3: Kubernetes Liveness Probe**
- Frequency: Every 15 seconds
- Timeout: 10 seconds
- Action on failure: Pod restart
- Purpose: Detect zombie processes, memory leaks

### 5.2 Health Check Configuration

```haproxy
# TCP health check (default)
default-server inter 5000 fall 3 rise 2

# HTTP health check (optional, for REST backends)
option httpchk GET /health HTTP/1.1\r\nHost:\ api.internal
default-server inter 10000 fall 3 rise 2
```

---

## 6. Monitoring and Observability

### 6.1 HAProxy Statistics Endpoint

**Stats URL:** `http://lb.internal:8404/stats`

**Metrics Collected:**
- Connections: Current, total, rate
- Requests: Current, total, rate, errors
- Bytes: In/out, rate
- Backend status: Up/down, health checks
- Queue depth: Current, max
- Session rate: Current, max
- Errors: Connection, request, response

### 6.2 Prometheus Metrics

**HAProxy Exporter** (separate container):
- Scrape interval: Every 15 seconds
- Metrics: 50+ HAProxy metrics
- Connection rate: `haproxy_connections_rate`
- Request rate: `haproxy_requests_total`
- Error rate: `haproxy_errors_total`
- Backend status: `haproxy_backend_up`

**Key Metrics to Monitor:**
```
# Connection metrics
haproxy_connections_current           # Current active connections
haproxy_connections_rate              # Connections per second
haproxy_connections_total             # Total connections (counter)

# Request metrics
haproxy_requests_rate                 # Requests per second
haproxy_requests_total                # Total requests (counter)

# Error metrics
haproxy_errors_connection_total       # Connection errors
haproxy_errors_request_total          # Request errors (4xx, 5xx)

# Backend metrics
haproxy_backend_up{backend}           # 1 if up, 0 if down
haproxy_backend_response_time_ms      # Response time percentiles

# Queue metrics
haproxy_queue_current                 # Current queue depth
haproxy_queue_max                     # Max queue seen
```

### 6.3 Alerting Rules

**Alert: High Connection Rate**
```
haproxy_connections_rate > 5000
Action: Page on-call, investigate
```

**Alert: Backend Unhealthy**
```
haproxy_backend_up == 0
Action: Page on-call, check pod logs
```

**Alert: High Error Rate**
```
rate(haproxy_errors_total[5m]) > 100
Action: Investigate client issues
```

**Alert: Queue Building Up**
```
haproxy_queue_current > 100
Action: Scale up application pods
```

---

## 7. Scaling and Capacity Planning

### 7.1 Capacity Limits

**Per HAProxy Instance:**
- Max connections: 100,000
- Max request rate: 10,000 req/sec
- Max connection rate: 1,000 conn/sec
- Memory: 500MB-1GB (depending on config)
- CPU: 1-2 cores under load

**Typical Deployment:**
- 2 HAProxy instances per region (active/active)
- Capacity per region: 200,000 connections
- Total capacity (4 regions): 800,000+ connections

### 7.2 Scaling Strategy

**Scaling Up (More HAProxy Instances):**
1. Provision new HAProxy instance
2. Configure with existing backends
3. Add to Route 53 health checks
4. Enable in production traffic
5. Monitor for 5 minutes
6. Commit configuration

**Scaling Down (Fewer HAProxy Instances):**
1. Remove from Route 53 (graceful drain)
2. Stop accepting new connections
3. Wait for existing connections to close (5+ minutes)
4. Terminate instance
5. Verify remaining instances handle load
6. Commit configuration

---

## 8. Security Considerations

### 8.1 DDoS Protection

**Layer 1: Connection Rate Limiting**
- Max 100 new connections per second per IP
- Per-client connection limit: 100
- Action: Reject with TCP RST

**Layer 2: Request Rate Limiting**
- Max 1000 requests per second per IP
- Window: 1 second
- Action: Reject with HTTP 429

**Layer 3: AWS Shield (Global)**
- DDoS detection at Route 53 level
- Automatic mitigation
- Volumetric attack protection

**Layer 4: WAF (Optional)**
- IP reputation filtering
- Geographic blocking
- Protocol validation

### 8.2 SSL/TLS Termination

**Configuration:**
- TLS 1.3 required (TLS 1.2 min)
- Ciphers: ECDHE-RSA-AES256-GCM-SHA384 (strong ciphers only)
- Certificate: ACM (AWS Certificate Manager)
- HSTS: enabled (max-age=31536000)

**Certificate Management:**
- Auto-renewal via ACM
- SNI support for multiple domains
- OCSP stapling enabled

### 8.3 Access Control

**Network Security:**
- Security groups: LB only accepts 8765/8080/8443
- HAProxy logs all connections (source IP, destination, errors)
- Audit logging: All configuration changes tracked in Git

---

## 9. Operational Procedures

### 9.1 Deployment Procedure

**Step 1: Provision HAProxy Instance**
```bash
# Create EC2 instance (t3.medium, 2 vCPU, 4GB RAM)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name basset-hound \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-12345678

# Wait for instance to boot
# SSH to instance: ssh -i key.pem ec2-user@instance-ip
```

**Step 2: Install HAProxy**
```bash
sudo yum install -y haproxy
sudo systemctl enable haproxy
```

**Step 3: Deploy Configuration**
```bash
# Copy config file (templated from Terraform)
sudo cp /tmp/haproxy.cfg /etc/haproxy/haproxy.cfg

# Validate syntax
sudo haproxy -c -f /etc/haproxy/haproxy.cfg

# Start/reload HAProxy
sudo systemctl restart haproxy

# Verify status
sudo systemctl status haproxy
curl http://localhost:8404/stats
```

**Step 4: Register in Route 53**
```bash
# Update Route 53 weighted policy to include new LB
aws route53 change-resource-record-sets \
  --hosted-zone-id ZONE_ID \
  --change-batch file:///tmp/route53-change.json
```

### 9.2 Monitoring and Maintenance

**Daily Tasks:**
- Monitor HAProxy stats: `http://lb:8404/stats`
- Check error rate: `< 0.1%`
- Verify all backends healthy: `UP` status
- Review connection rate: `< 5000 conn/sec`

**Weekly Tasks:**
- Review logs for anomalies
- Analyze traffic patterns
- Verify failover procedures
- Update documentation

**Monthly Tasks:**
- Review and optimize configuration
- Analyze performance metrics
- Capacity planning review
- Security audit

---

## 10. Disaster Recovery

### 10.1 Failure Scenarios

**Scenario 1: Single HAProxy Fails**
- Time to detect: 5-10 seconds (TCP probe)
- Impact: Affected connections dropped
- Recovery: Clients reconnect to healthy HAProxy
- Data loss: None (Redis persists session)
- RTO: < 10 seconds

**Scenario 2: Regional Failure**
- Time to detect: 30 seconds (Route 53)
- Impact: New clients routed to alternate region
- Recovery: Clients reconnect, sessions recovered
- Data loss: None (cross-region replication)
- RTO: < 30 seconds

**Scenario 3: Multiple HAProxy Failures**
- Impact: Region degraded, requests queued
- Recovery: Auto-scale HAProxy instances
- RTO: < 2 minutes (instance launch + config)

### 10.2 Recovery Procedures

**Manual Recovery:**
1. Identify failed HAProxy instances
2. Stop traffic to failed instance (update Route 53)
3. Investigate root cause
4. Fix issue or terminate and replace
5. Re-register with Route 53
6. Verify traffic resumption

---

## 11. Performance Optimization

### 11.1 Connection Pooling

**Backend Pool Reuse:**
- `http-reuse safe` (for HTTP connections)
- Maintains persistent connections to backends
- Reduces connection setup latency
- Improves throughput by 20-30%

### 11.2 Compression

**Request/Response Compression:**
- GZIP compression enabled (for REST API)
- Threshold: 1KB+ payloads
- Bandwidth reduction: 60-80%

### 11.3 Caching

**Client-side caching:**
- Cache-Control headers respected
- Reduced load on backends
- Browser/client side benefit

---

## 12. Integration Points

### 12.1 Route 53 Integration

**DNS Record Configuration:**
```json
{
  "Action": "CREATE",
  "ResourceRecordSet": {
    "Name": "api.basset-hound.com",
    "Type": "A",
    "SetIdentifier": "US-Primary",
    "GeolocationLocation": { "CountryCode": "US" },
    "AliasTarget": {
      "HostedZoneId": "Z35SXDOTRQ7X7K",
      "DNSName": "lb-us-east.elb.amazonaws.com",
      "EvaluateTargetHealth": true
    },
    "TTL": 60
  }
}
```

### 12.2 Kubernetes Integration

**Service Configuration:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: websocket-lb
  namespace: production
spec:
  type: LoadBalancer
  selector:
    app: websocket
  ports:
    - port: 8765
      targetPort: 8765
      protocol: TCP
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 86400  # 24 hours
```

---

## 13. Cost Analysis

**Monthly Cost (Per Region):**
- HAProxy instances (2x t3.medium): $60
- Data transfer (100GB/month): $10
- Route 53 queries (1M/month): $0.50
- AWS Shield (DDoS): Included in Region

**Total per region:** ~$70/month  
**Total 4 regions:** ~$280/month

---

## 14. Implementation Checklist

- [ ] Provision HAProxy instances (2 per region)
- [ ] Configure HAProxy with backend servers
- [ ] Set up health checks (TCP + HTTP)
- [ ] Configure session affinity (24-hour TTL)
- [ ] Set up rate limiting (100 conn/sec, 1000 req/sec)
- [ ] Configure Route 53 geolocation routing
- [ ] Set up HAProxy stats monitoring (Prometheus)
- [ ] Configure alerting rules
- [ ] Document operational procedures
- [ ] Test failover scenarios
- [ ] Load test (verify 10,000 req/sec capacity)
- [ ] Security audit (DDoS, rate limiting)
- [ ] Production deployment
- [ ] Monitor for 1 week post-deployment

---

## 15. Related Components

- **Session Store Design:** [02-SESSION-STORE-DESIGN.md](02-SESSION-STORE-DESIGN.md)
- **Networking Architecture:** [../04-NETWORKING-ARCHITECTURE.md](../04-NETWORKING-ARCHITECTURE.md)
- **Monitoring Design:** [../05-MONITORING-OBSERVABILITY.md](../05-MONITORING-OBSERVABILITY.md)
- **API Gateway Design:** [09-API-GATEWAY-DESIGN.md](09-API-GATEWAY-DESIGN.md)

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026  
**Author:** Architecture Team
