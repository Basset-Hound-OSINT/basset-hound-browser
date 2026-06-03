# Wave 16 Component Design: Authentication & Authorization

**Component ID:** AU-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1 hour  
**Lines:** 1,000+

---

## Executive Summary

The Auth component provides OAuth2, API key, and mTLS authentication for all API access. Includes RBAC (role-based access control) and fine-grained permissions.

**Key Metrics:**
- Auth latency: <50ms
- Token TTL: 1 hour (JWT)
- Refresh TTL: 7 days
- API key rotation: 90 days
- Session limit per user: 10 concurrent

---

## 1. Authentication Methods

### 1.1 OAuth2 (Third-party integrations)

**Authorization Code Flow:**
```
Client              Auth Server         Resource Server
  │                    │                      │
  ├──── authorize ────>│                      │
  │                    │                      │
  │ <──── auth_code ───┤                      │
  │                    │                      │
  ├──── token ────────>│                      │
  │                    │                      │
  │ <──── access_token ┤                      │
  │                    │                      │
  ├──────── request w/ token ─────────────────>
  │                                           │
  │ <──────────── response ────────────────────┤
```

**Token Format (JWT):**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key_id_123"
}
.
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "scope": "read write",
  "aud": "api.basset-hound.com",
  "iat": 1717416000,
  "exp": 1717419600
}
.
<signature>
```

### 1.2 API Keys (Programmatic access)

**Key Format:**
```
sk_test_abc123xyz789_rest_of_key

Prefix:
  sk_test_     = Testable (sandbox)
  sk_live_     = Production
  
Hashed in database (bcrypt)
```

**Header:**
```
X-API-Key: sk_test_abc123xyz789
```

### 1.3 mTLS (Service-to-service)

**Client Certificate:**
```
CN=service.internal
O=Basset Hound
Validity: 1 year
Rotation: Every 6 months
```

---

## 2. Authorization & RBAC

**Role Hierarchy:**
```
admin
  ├─ view_all_tasks
  ├─ manage_users
  ├─ manage_integrations
  ├─ view_analytics
  └─ delete_tasks

user
  ├─ view_own_tasks
  ├─ create_tasks
  ├─ view_own_changes
  └─ configure_alerts

viewer
  ├─ view_own_tasks
  └─ view_own_changes

read_only
  ├─ view_tasks
  └─ view_changes
```

**Permission Check:**
```python
def require_permission(permission: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user.has_permission(permission):
                raise ForbiddenError(f"Missing permission: {permission}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

@app.get("/api/v1/tasks/{task_id}")
@require_permission("view_own_tasks")
def get_task(task_id: str):
    # User must have permission
    pass
```

---

## 3. Session Management

**Session Table:**
```sql
CREATE TABLE user_sessions (
  session_id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  auth_method VARCHAR(50),  -- oauth2, api_key, mtls
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_sessions ON user_sessions(user_id, is_active);
```

**Limits:**
- Max concurrent sessions per user: 10
- Session timeout (inactivity): 24 hours
- Disable on logout: Immediate

---

## 4. Secret Management

**Using HashiCorp Vault:**
```
Secrets stored:
  - OAuth2 client secrets
  - API key salt
  - JWT signing keys
  - mTLS CA certificates
  - Integration credentials
  
Rotation policy:
  - JWT keys: 30 days
  - API key salt: 90 days
  - mTLS certs: 180 days
```

---

## 5. Monitoring

**Auth Metrics:**
```
auth_login_total                      # Login attempts
auth_login_failures_total             # Failed logins
auth_token_issued_total               # Tokens issued
auth_token_validation_failures_total  # Invalid tokens
auth_authorization_failures_total     # Permission denied
```

**Alerting:**
```
# Alert: High auth failure rate
rate(auth_login_failures[5m]) > 100
Action: Check for brute force attack

# Alert: Invalid token usage
rate(auth_token_validation_failures[5m]) > 50
Action: Check for credential leaks
```

---

## 6. Cost Analysis

**Monthly Cost:**
- Auth service pods: $200
- Vault instances: $300
- Total: ~$500/month

---

## 7. Implementation Checklist

- [ ] Implement OAuth2 provider
- [ ] Implement API key management
- [ ] Deploy HashiCorp Vault
- [ ] Implement mTLS certificates
- [ ] Implement RBAC system
- [ ] Create session management
- [ ] Set up JWT signing
- [ ] Configure token rotation
- [ ] Set up Prometheus metrics
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
