# Wave 16 Component Design: Integration Hub

**Component ID:** IH-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,500+

---

## Executive Summary

The Integration Hub provides abstracted interfaces to external platforms (Slack, Zapier, IFTTT, PagerDuty, Teams). Handles rate limiting, error recovery, and provider-agnostic event routing.

**Key Metrics:**
- Providers: 10+ integrations
- Throughput: 5,000+ notifications/sec
- Latency: <2 seconds
- Success rate: >99%
- Rate limit compliance: Per-provider

---

## 1. Architecture

### 1.1 Integration Hub Topology

```
Event Alert
      │
      ▼
┌──────────────────────┐
│ Alert Dispatcher     │
│ (Routes by provider) │
└──────────────────────┘
      │
      ├─────────────┬────────────┬──────────┬─────┐
      │             │            │          │     │
      ▼             ▼            ▼          ▼     ▼
  ┌────────┐   ┌────────┐   ┌───────┐  ┌──────┐ ...
  │ Slack  │   │ Email  │   │Zapier │  │ Teams │
  │Plugin  │   │Plugin  │   │Plugin │  │Plugin │
  └────────┘   └────────┘   └───────┘  └──────┘
      │             │            │          │
      ▼             ▼            ▼          ▼
  API Rate      SMTP           API Rate   API Rate
  Limiter       Queue          Limiter    Limiter
      │             │            │          │
      ▼             ▼            ▼          ▼
  External       External    External  External
  Provider       Provider    Provider  Provider
```

---

## 2. Provider Abstraction

**Common Interface:**
```python
class IntegrationProvider(ABC):
    @abstractmethod
    def send(self, event: Alert) -> bool:
        """Send alert to provider"""
        pass
    
    @abstractmethod
    def validate_config(self) -> bool:
        """Validate credentials"""
        pass
    
    @abstractmethod
    def get_rate_limit(self) -> Tuple[int, int]:
        """Returns (limit, window_seconds)"""
        pass
```

---

## 3. Provider Implementations

**Slack:**
```python
class SlackIntegration(IntegrationProvider):
    def send(self, event: Alert) -> bool:
        # Rate limit: 60 msg/min
        payload = {
            "text": event.message,
            "blocks": [
                {"type": "section", "text": {"type": "mrkdwn", "text": event.message}},
                {"type": "divider"},
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Severity:*\n{event.severity}"},
                        {"type": "mrkdwn", "text": f"*Time:*\n{event.timestamp}"}
                    ]
                }
            ]
        }
        response = requests.post(self.webhook_url, json=payload)
        return response.status_code == 200
    
    def get_rate_limit(self) -> Tuple[int, int]:
        return (60, 60)  # 60 messages per 60 seconds
```

**Email:**
```python
class EmailIntegration(IntegrationProvider):
    def send(self, event: Alert) -> bool:
        # Rate limit: 100 emails/min (via SMTP)
        msg = MIMEText(event.body)
        msg['Subject'] = event.title
        msg['From'] = self.from_address
        msg['To'] = event.recipient
        
        with smtplib.SMTP_SSL(self.smtp_host, 465) as server:
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
        
        return True
    
    def get_rate_limit(self) -> Tuple[int, int]:
        return (100, 60)  # 100 emails per 60 seconds
```

**PagerDuty:**
```python
class PagerDutyIntegration(IntegrationProvider):
    def send(self, event: Alert) -> bool:
        # Rate limit: 100 events/min (per integration key)
        payload = {
            "routing_key": self.routing_key,
            "event_action": "trigger",
            "payload": {
                "summary": event.title,
                "severity": event.severity.lower(),
                "source": "Basset Hound",
                "custom_details": {
                    "task_id": event.task_id,
                    "change_type": event.change_type
                }
            }
        }
        response = requests.post(
            "https://events.pagerduty.com/v2/enqueue",
            json=payload
        )
        return response.status_code == 202
    
    def get_rate_limit(self) -> Tuple[int, int]:
        return (100, 60)
```

---

## 4. Rate Limiting

**Per-Provider Rate Limiter:**
```python
class RateLimiter:
    def __init__(self, limit: int, window: int):
        self.limit = limit
        self.window = window
        self.redis = redis.Redis()
    
    def is_allowed(self, key: str) -> bool:
        current = self.redis.incr(f"ratelimit:{key}")
        if current == 1:
            self.redis.expire(f"ratelimit:{key}", self.window)
        return current <= self.limit
```

---

## 5. Error Handling

**Retry Policy:**
```
Transient Errors (429, 5xx):
  Retry with exponential backoff (1s, 2s, 4s, 8s)
  Max retries: 3

Permanent Errors (4xx, invalid config):
  Do not retry
  Log error, send alert to admin

Network Timeout:
  Treat as transient, retry
```

---

## 6. Configuration

**Per User/Task:**
```json
{
  "integrations": [
    {
      "provider": "slack",
      "enabled": true,
      "config": {
        "webhook_url": "https://hooks.slack.com/...",
        "channel": "#alerts"
      },
      "filters": {
        "min_severity": "high",
        "event_types": ["change.detected", "alert.triggered"]
      }
    },
    {
      "provider": "email",
      "enabled": true,
      "config": {
        "recipient": "admin@example.com"
      },
      "filters": {
        "min_severity": "critical"
      }
    }
  ]
}
```

---

## 7. Monitoring

**Integration Metrics:**
```
integration_events_sent_total         # Events sent
integration_events_failed_total       # Failed sends
integration_provider_latency          # Time per provider
integration_rate_limit_hits           # Rate limit violations
integration_retry_attempts            # Retry count
```

---

## 8. Cost Analysis

**Monthly Cost:**
- Integration hub pods: $200
- External API costs: Varies per provider
- Total: ~$200-500/month

---

## 9. Implementation Checklist

- [ ] Design provider abstraction
- [ ] Implement core integrations (Slack, Email, PagerDuty)
- [ ] Implement rate limiting per provider
- [ ] Configure retry logic
- [ ] Set up credential management
- [ ] Create configuration UI
- [ ] Set up Prometheus metrics
- [ ] Test each integration
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
