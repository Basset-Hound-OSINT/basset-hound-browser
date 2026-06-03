# Wave 16 Component Design: Message Queue

**Component ID:** MQ-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,500+

---

## Executive Summary

The Message Queue provides reliable async task processing with 1000+ msg/sec throughput. Uses RabbitMQ with multiple queues for monitoring tasks, alerts, webhooks, and forensic analysis.

**Key Metrics:**
- Throughput: 1,000+ msg/sec
- Latency: <100ms (queue to processing)
- Reliability: At-least-once delivery
- Queues: 8 (monitoring, alerts, webhooks, forensics, etc)
- DLQ: Failed messages after 3 retries

---

## 1. Architecture

### 1.1 Queue Topology

```
┌────────────────────────────────────────┐
│      RabbitMQ Cluster                  │
│  - Master broker                       │
│  - 2 replica brokers (HA)              │
│  - 8 queues                            │
└────────────────────────────────────────┘
      │         │         │
  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐
  │Queue1│  │Queue2│  │Queue3│  ...
  │      │  │      │  │      │
  └──────┘  └──────┘  └──────┘
      │         │         │
  ┌───▼─────┴───▼─────┴───▼────┐
  │  Worker Pool                │
  │  (K8s jobs)                 │
  │  - 5-20 workers             │
  │  - Auto-scaling             │
  └─────────────────────────────┘
```

### 1.2 Queue Types

**1. monitoring:tasks** - Scheduled monitoring checks
**2. alerts:send** - Alert notifications
**3. webhooks:dispatch** - Webhook deliveries
**4. forensics:analyze** - Forensic analysis jobs
**5. reports:generate** - Report generation
**6. cleanup:expired** - Session cleanup
**7. backups:create** - Database backups
**8. dlq (dead-letter)** - Failed messages

---

## 2. Message Schema

**Monitoring Task Message:**
```json
{
  "message_id": "msg_abc123",
  "task_id": "task_def456",
  "type": "MONITORING_CHECK",
  "payload": {
    "url": "https://example.com",
    "timeout": 30,
    "follow_redirects": true
  },
  "retry_count": 0,
  "scheduled_at": 1717416000,
  "expires_at": 1717416060
}
```

---

## 3. Processing Pipeline

```
Message Published
      │
      ▼
┌──────────────────┐
│  Queue (RabbitMQ)│  Persistent, replicated
└──────────────────┘
      │
      ▼
┌──────────────────┐
│  Worker Node     │  Consume, process
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Success/Failure? │
└──────────────────┘
    │         │
   YES       NO
    │         │
    ▼         ▼
[ACK]    [Retry <3x]
         or [DLQ]
```

---

## 4. Configuration

**RabbitMQ Configuration:**
```ini
[rabbit]
  num_heartbeats = 60
  frame_max = 131072
  
[rabbitmq_management]
  tcp_port = 15672

[rabbitmq_queue_master_location]
  queue_master_locator = min-masters
```

**Queue Declaration (Python):**
```python
import pika

channel = pika.BlockingConnection().channel()

# Declare durable queues
for queue_name in ['monitoring:tasks', 'alerts:send', 'webhooks:dispatch']:
    channel.queue_declare(
        queue=queue_name,
        durable=True,
        arguments={
            'x-message-ttl': 3600000,  # 1 hour TTL
            'x-max-length': 100000,     # Max 100k messages
            'x-dead-letter-exchange': 'dlx',
            'x-dead-letter-routing-key': 'dlq'
        }
    )

# Dead-letter queue
channel.queue_declare(
    queue='dlq',
    durable=True
)
```

---

## 5. Worker Implementation

**Worker Pseudocode:**
```python
def process_monitoring_task(msg):
    task = json.loads(msg.body)
    try:
        # Execute monitoring check
        result = check_url(task['url'], timeout=task['timeout'])
        
        # Store result
        store_check_result(task['task_id'], result)
        
        # Acknowledge message
        msg.ack()
    except Exception as e:
        if msg.retry_count < 3:
            # Requeue with backoff
            msg.retry_count += 1
            requeue_message(msg, delay=2**msg.retry_count)
        else:
            # Send to DLQ
            msg.nack(requeue=False)
```

**Worker Scaling:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 5
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: rabbitmq_queue_depth
      target:
        type: AverageValue
        averageValue: "100"
```

---

## 6. Monitoring

**Queue Metrics:**
```
rabbitmq_queue_messages_total           # Total messages
rabbitmq_queue_messages_ready           # Ready to consume
rabbitmq_queue_messages_unacked         # Unacknowledged
rabbitmq_queue_consumers                # Consumer count

# Worker metrics
worker_messages_processed_total         # Processed
worker_messages_failed_total            # Failed
worker_processing_duration_seconds      # Latency
```

**Alerting:**
```
# Alert: Queue depth increasing
rate(rabbitmq_queue_messages[5m]) > 1000
Action: Scale up workers

# Alert: High failure rate
rate(worker_messages_failed[5m]) / rate(worker_messages_processed[5m]) > 0.05
Action: Investigate errors
```

---

## 7. Cost Analysis

**Monthly Cost:**
- RabbitMQ broker (t3.xlarge): $300
- Storage (100GB): $25
- Network: $10
- Total: ~$335/month

---

## 8. Implementation Checklist

- [ ] Deploy RabbitMQ cluster
- [ ] Create 8 queues with DLQ
- [ ] Implement workers (5 replicas)
- [ ] Configure HPA for workers
- [ ] Set up Prometheus exporter
- [ ] Configure alerting rules
- [ ] Test failover (broker crash)
- [ ] Load test (1000+ msg/sec)
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
