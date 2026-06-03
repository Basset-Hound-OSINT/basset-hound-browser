# Wave 16 Component Design: Webhook Delivery System

**Component ID:** WH-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1 hour  
**Lines:** 1,000+

---

## Executive Summary

The Webhook system provides reliable async notification delivery to external systems. Supports 10,000+ webhooks with at-least-once semantics, exponential backoff retries, and signature verification.

**Key Metrics:**
- Throughput: 10,000 webhooks/sec
- Latency: <100ms (delivery)
- Retry window: Up to 24 hours
- Signature: HMAC-SHA256
- Success rate: >99.5%

---

## 1. Architecture

### 1.1 Webhook Delivery Pipeline

```
Event Triggered
      │
      ▼
┌──────────────────────┐
│ Message Queue        │  (RabbitMQ)
│ webhooks:dispatch    │
└──────────────────────┘
      │
      ▼
┌──────────────────────┐
│ Webhook Worker       │  (5-20 replicas)
│ (HTTP POST)          │
└──────────────────────┘
      │
      ▼
┌──────────────────────┐
│ External Webhook URL │  (customer's system)
│ (HTTP 200 OK)        │
└──────────────────────┘
      │
   Success?
      │
   ┌──┴──┐
   YES  NO
   │    │
   ▼    ▼
 [ACK] [Retry with backoff]
        (exponential: 1s, 2s, 4s, 8s... up to 24h)
```

---

## 2. Webhook Event Schema

```json
{
  "id": "evt_webhook_abc123",
  "event_type": "change.detected",
  "timestamp": 1717416000,
  "data": {
    "task_id": "task_def456",
    "change_id": "ch_ghi789",
    "change_type": "HTML_MODIFIED",
    "severity": "high",
    "url": "https://example.com",
    "detected_at": 1717415900
  },
  "metadata": {
    "retry_count": 0,
    "attempt": 1
  }
}
```

---

## 3. Delivery Guarantee & Retries

**Retry Strategy:**
```
Attempt 1: Immediate (send)
Attempt 2: After 1 second
Attempt 3: After 2 seconds
Attempt 4: After 4 seconds
Attempt 5: After 8 seconds
Attempt 6: After 16 seconds
Attempt 7: After 32 seconds
Attempt 8: After 1 minute
Attempt 9: After 2 minutes
Attempt 10: After 4 minutes
... (exponential backoff)
Attempt N: After 24 hours → Give up (DLQ)

Success Criteria:
- HTTP 200-299 status
- Response within 30 seconds
- Valid HMAC signature
```

**Dead-Letter Queue (DLQ):**
- After 24 hours of retries, move to DLQ
- Store for manual inspection
- Send admin alert
- Allow manual retry via admin API

---

## 4. Signature Verification

**HMAC-SHA256 Signature:**
```
Signature Header: X-Webhook-Signature

Computation:
  secret = webhook_secret_key
  body = JSON body (raw string)
  timestamp = X-Webhook-Timestamp header
  
  hmac_input = timestamp + "." + body
  signature = HMAC-SHA256(hmac_input, secret)
  
Header Format:
  X-Webhook-Signature: v1,sha256=<hexdigest>
  X-Webhook-Timestamp: 1717416000
```

**Client Verification (Python):**
```python
import hmac
import hashlib

def verify_webhook(request):
    signature = request.headers['X-Webhook-Signature']
    timestamp = request.headers['X-Webhook-Timestamp']
    body = request.get_data()
    secret = os.environ['WEBHOOK_SECRET']
    
    # Verify timestamp (prevent replay)
    if abs(time.time() - int(timestamp)) > 300:
        return False  # Reject old signatures
    
    # Verify signature
    expected_sig = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_sig)
```

---

## 5. Configuration

**Webhook Configuration (per user/task):**
```json
{
  "webhook_id": "wh_abc123",
  "user_id": "user_def456",
  "task_id": "task_ghi789",
  "url": "https://customer.com/webhooks/basset",
  "events": ["change.detected", "alert.triggered"],
  "enabled": true,
  "secret": "sk_test_xyz789...",
  "headers": {
    "X-Custom-Header": "value"
  },
  "retry_policy": {
    "max_attempts": 24,
    "timeout_seconds": 30,
    "backoff_multiplier": 2
  }
}
```

---

## 6. Monitoring

**Webhook Metrics:**
```
webhook_deliveries_total             # Total deliveries
webhook_deliveries_success_total     # Successful
webhook_deliveries_failed_total      # Failed
webhook_delivery_latency_seconds     # Time to deliver
webhook_retry_attempts_total         # Retry count
webhook_dlq_messages_total           # Dead-letter queue
```

**Alerting:**
```
# Alert: High failure rate
rate(webhook_deliveries_failed[5m]) / rate(webhook_deliveries_total[5m]) > 0.05
Action: Investigate, check customer URLs
```

---

## 7. Cost Analysis

**Monthly Cost:**
- Webhook worker pods (10-20): $300
- Message queue: $50
- Monitoring: $50
- Total: ~$400/month

---

## 8. Implementation Checklist

- [ ] Design webhook table schema
- [ ] Implement webhook dispatcher
- [ ] Implement HMAC signature generation
- [ ] Implement retry logic (exponential backoff)
- [ ] Set up DLQ for failed deliveries
- [ ] Create admin API for webhook management
- [ ] Implement signature verification guide
- [ ] Set up Prometheus metrics
- [ ] Load test (10,000 webhooks/sec)
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
