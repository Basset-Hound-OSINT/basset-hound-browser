# Wave 16 Component Design: Security

**Component ID:** SE-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1 hour  
**Lines:** 1,000+

---

## Executive Summary

The Security component ensures confidentiality, integrity, and availability through encryption, secret management, audit logging, and compliance controls. Targets GDPR, HIPAA, and SOC 2 compliance.

**Key Metrics:**
- TLS version: 1.3 minimum
- Encryption: AES-256-GCM at rest
- Secret rotation: 30-90 days
- Audit log retention: 7 years
- Security scanning: Continuous

---

## 1. Encryption

### 1.1 In Transit (TLS)

**Configuration:**
```
TLS 1.3 minimum
Ciphers: ECDHE-RSA-AES256-GCM-SHA384 (only strong)
HSTS: max-age=31536000

Certificate:
  Provider: AWS Certificate Manager (ACM)
  Type: Wildcard (*.basset-hound.com)
  Rotation: Automatic (ACM handles)
  Pinning: Optional for mobile apps
```

### 1.2 At Rest (Data)

**Database Encryption:**
```
RDS: Encryption enabled
  - Algorithm: AES-256
  - Key storage: AWS KMS
  - Rotation: Automatic (yearly)

EBS Volumes:
  - Encrypted by default
  - KMS key managed by AWS

S3 Buckets:
  - Server-side encryption: AES-256
  - KMS key per bucket
```

---

## 2. Secret Management (Vault)

**Secrets Stored:**
```
/secret/basset-hound/
  ├─ oauth2_client_secret
  ├─ api_key_salt
  ├─ jwt_signing_key
  ├─ database_credentials
  ├─ redis_password
  ├─ webhook_signing_secret
  └─ integration_credentials
```

**Key Rotation:**
```
JWT Keys:      Rotate every 30 days
API Key Salt:  Rotate every 90 days
mTLS Certs:    Rotate every 180 days
DB Passwords:  Rotate every 90 days
```

**Access Control:**
```
Policy: only-for-basset-websocket-pods
Condition: Must be running in production namespace
Lease: 1 hour with auto-renewal
Audit: All accesses logged
```

---

## 3. Audit Logging

**Immutable Audit Log:**
```sql
CREATE TABLE audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  user_id VARCHAR(100),
  action VARCHAR(50),
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50),
  signed_hash VARCHAR(64)
);

-- Immutability: INSERT only, no UPDATE/DELETE
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_policy ON audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY audit_select ON audit_log
  FOR SELECT USING (true);
-- No UPDATE/DELETE policies
```

**Chained Hash Verification:**
```
Row 1: hash_1 = HASH(timestamp + action + prev_hash)
Row 2: hash_2 = HASH(timestamp + action + hash_1)
Row 3: hash_3 = HASH(timestamp + action + hash_2)

To verify integrity:
  1. Recalculate each hash
  2. Verify chain (each hash depends on previous)
  3. If any mismatch, tampering detected
```

---

## 4. Network Security

**Security Groups (AWS):**
```
Load Balancer (ALB):
  - Inbound: 443 (HTTPS), 80 (HTTP redirect)
  - Outbound: To app servers (8765)

Application Servers:
  - Inbound: 8765 (from LB), 22 (SSH, bastion only)
  - Outbound: To Redis, DB, external APIs

Database:
  - Inbound: 5432 (from app servers only)
  - Outbound: To S3 (backups)

Redis:
  - Inbound: 6379 (from app servers), 26379 (sentinel)
  - Outbound: None
```

**Network Policies (Kubernetes):**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: basset-ingress
spec:
  podSelector:
    matchLabels:
      app: websocket
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 8765
```

---

## 5. DDoS Protection

**AWS Shield (Layer 3-4):**
- Automatic volumetric attack mitigation
- Managed by AWS (no configuration needed)
- Standard: Included free
- Advanced: Optional ($3000/month)

**AWS WAF (Layer 7):**
```
Rules:
  - IP Reputation (block malicious IPs)
  - Geo-blocking (block specific countries)
  - Rate limiting (100 req/sec per IP)
  - SQL injection patterns
  - XSS patterns
```

---

## 6. Compliance

**GDPR Compliance:**
```
Data Privacy:
  - Explicit user consent required
  - Right to be forgotten (data deletion)
  - Data breach notification (72 hours)
  - Privacy policy updated and available

Personal Data:
  - Encrypted at rest
  - Encrypted in transit
  - Audit logging enabled
  - Retention: Configurable (max 90 days recommended)
```

**HIPAA Compliance (if applicable):**
```
Covered entity requirements:
  - Business Associate Agreement (BAA)
  - Encryption (at rest and in transit)
  - Audit controls
  - Access controls
  - Secure data destruction
```

**SOC 2 Compliance:**
```
Audited by: Third-party auditor
Controls:
  - Security (access control, data protection)
  - Availability (99.95% uptime SLA)
  - Processing integrity (error detection)
  - Confidentiality (data protection)
  - Privacy (personal data handling)

Audit frequency: Annual
Report: Confidential, shared with customers under NDA
```

---

## 7. Vulnerability Management

**Continuous Scanning:**
```
Container Images:
  - Trivy (image scanning)
  - Registry: Scan on push
  - Frequency: Weekly for stored images
  - Threshold: Block high/critical severities

Dependencies:
  - Snyk (dependency scanning)
  - Frequency: Daily
  - Threshold: Block high/critical severities

Code:
  - SAST (static analysis): SonarQube
  - Frequency: On every commit
  - Threshold: Block on critical issues
```

**Incident Response:**
```
High severity vulnerability found
  │
  ├─> Assess exploitability
  │
  ├─> Patch or mitigate
  │
  ├─> Test in staging
  │
  ├─> Deploy to production
  │
  └─> Monitor for exploitation
  
Target time to patch: 48 hours (critical)
```

---

## 8. Cost Analysis

**Monthly Cost:**
- Vault instances: $300
- AWS Shield Advanced: $250
- AWS WAF: $50
- Security scanning tools: $100
- Total: ~$700/month

---

## 9. Implementation Checklist

- [ ] Deploy HashiCorp Vault
- [ ] Enable TLS 1.3 everywhere
- [ ] Enable encryption at rest (RDS, S3, EBS)
- [ ] Implement audit logging
- [ ] Set up network policies
- [ ] Deploy AWS Shield Advanced
- [ ] Deploy AWS WAF
- [ ] Set up vulnerability scanning (Trivy, Snyk)
- [ ] Implement secret rotation
- [ ] Document security procedures
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
