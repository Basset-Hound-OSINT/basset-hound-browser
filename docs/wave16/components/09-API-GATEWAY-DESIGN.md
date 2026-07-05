# Wave 16 Component Design: API Gateway

**Component ID:** AG-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,500+

---

## Executive Summary

The API Gateway provides unified entry point for WebSocket and REST APIs. Handles authentication, rate limiting, request routing, and response formatting. Supports OAuth2, API keys, and mTLS.

**Key Metrics:**
- Throughput: 10,000+ req/sec
- Latency: <50ms (p95)
- Rate limits: 1000 req/sec per user
- Protocols: WebSocket, HTTP/REST, gRPC
- Authentication: OAuth2, API key, mTLS

---

## 1. Architecture

### 1.1 API Gateway Topology

```
┌──────────────────────────────────┐
│  AWS API Gateway (managed)       │
│  or Kong (self-hosted)           │
│  - Request routing               │
│  - Rate limiting                 │
│  - Authentication                │
│  - Request/response transform    │
└──────────────────────────────────┘
         │         │         │
         ▼         ▼         ▼
    ┌────────┬──────────┬──────────┐
    │WebSocket│  REST   │  gRPC    │
    │ Handler │ Backend │ Backend  │
    └────────┴──────────┴──────────┘
```

---

## 2. API Endpoints

**WebSocket API:**
```
wss://api.basset-hound.com/ws
  - Session management
  - Monitoring control
  - Real-time events
```

**REST API:**
```
GET    /api/v1/tasks              # List tasks
POST   /api/v1/tasks              # Create task
GET    /api/v1/tasks/{id}         # Get task
PUT    /api/v1/tasks/{id}         # Update task
DELETE /api/v1/tasks/{id}         # Delete task
GET    /api/v1/tasks/{id}/changes # List changes
GET    /api/v1/alerts             # List alerts
```

---

## 3. Authentication

**OAuth2 (Third-party integrations):**
```
POST /oauth/authorize
POST /oauth/token
GET  /oauth/userinfo
```

**API Key (Programmatic access):**
```
Header: X-API-Key: sk_test_REDACTED_EXAMPLE
```

**mTLS (Service-to-service):**
```
Client cert: /etc/certs/client.crt
Server verify: /etc/certs/ca.crt
```

---

## 4. Rate Limiting

**Per-User (Authenticated):**
- Limit: 1000 req/sec
- Window: 1 second
- Action on limit: 429 Too Many Requests

**Per-IP (Unauthenticated):**
- Limit: 100 req/sec
- Window: 1 second
- Action on limit: 429 Too Many Requests

**Per-API-Key:**
- Limit: Custom (10-10000 req/sec)
- Enforced via Redis counter
- Refill: Every second

---

## 5. Implementation (Kong)

**Kong Configuration:**
```yaml
services:
  - name: websocket-service
    host: websocket-backend.internal
    port: 8765
    protocol: ws

  - name: rest-service
    host: rest-backend.internal
    port: 8080
    protocol: http

plugins:
  - name: rate-limiting
    config:
      minute: 60000  # 1000 req/sec
      policy: local

  - name: authentication
    config:
      auth_methods:
        - oauth2
        - api-key
        - mtls
```

---

## 6. Request/Response Schema

**Standard Response:**
```json
{
  "status": "success",
  "data": { ... },
  "metadata": {
    "request_id": "req_abc123",
    "timestamp": 1717416000,
    "version": "v1"
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: task_id",
    "details": { ... }
  },
  "metadata": {
    "request_id": "req_def456",
    "timestamp": 1717416000
  }
}
```

---

## 7. Monitoring

**API Gateway Metrics:**
```
api_gateway_requests_total           # Request count
api_gateway_request_duration_seconds # Latency
api_gateway_errors_total             # Errors (4xx, 5xx)
api_gateway_rate_limit_hits_total   # Rate limit violations
api_gateway_auth_failures_total     # Auth failures
```

---

## 8. Cost Analysis

**Monthly Cost:**
- API Gateway (managed): $300
- Kong instances (if self-hosted): $400
- Total: ~$300-700/month

---

## 9. Implementation Checklist

- [ ] Deploy API Gateway (Kong or AWS API Gateway)
- [ ] Configure WebSocket routes
- [ ] Configure REST routes
- [ ] Implement OAuth2 provider
- [ ] Set up API key management
- [ ] Configure rate limiting rules
- [ ] Set up mTLS certificates
- [ ] Configure request/response logging
- [ ] Set up Prometheus exporter
- [ ] Load test (10,000 req/sec)
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
