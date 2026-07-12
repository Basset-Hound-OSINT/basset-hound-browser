# Wave 16 Component Design: Stream Processing

**Component ID:** SP-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,500+

---

## Executive Summary

The Stream Processing component detects changes in real-time, aggregates them by time window, enriches with metadata, and triggers alerts. Uses Apache Kafka/Kinesis for event streaming with 50,000+ events/sec capacity.

**Key Metrics:**
- Throughput: 50,000 events/sec
- Latency: <100ms (detection to action)
- Window: 5-minute aggregation
- Processing: Exactly-once semantics
- State: Distributed checkpoint

---

## 1. Architecture

### 1.1 Stream Processing Pipeline

```
WebSocket Clients
      │
      ▼
┌───────────────────┐
│ Change Detection  │  (in WebSocket handler)
│ Event emitted     │
└───────────────────┘
      │
      ▼
┌───────────────────┐
│ Kafka Topic       │  Durable event log
│ change-events     │  (10 partitions)
└───────────────────┘
      │
      ▼
┌───────────────────┐
│ Stream Processor  │  Aggregate + Enrich
│ (Kafka Streams)   │  (5-min windows)
└───────────────────┘
      │
      ▼
┌───────────────────┐
│ Alert Engine      │  Trigger alerts
│ (rules-based)     │  (severity, type)
└───────────────────┘
      │
      ▼
┌───────────────────┐
│ Multi-destination │
│ - Dashboard       │
│ - Webhooks        │
│ - Notifications   │
│ - Database        │
└───────────────────┘
```

---

## 2. Event Schema

**Change Detected Event:**
```json
{
  "event_id": "evt_abc123",
  "task_id": "task_def456",
  "user_id": "user_ghi789",
  "event_type": "CHANGE_DETECTED",
  "change_type": "HTML_MODIFIED",
  "timestamp": 1717416000,
  "severity": "high",
  "payload": {
    "url": "https://example.com",
    "old_hash": "sha256_abc...",
    "new_hash": "sha256_def...",
    "diff": "...",
    "confidence": 0.98
  }
}
```

---

## 3. Processing Logic

**Time-Window Aggregation:**
```
Events arrive at time: t0, t0+1s, t0+2s, ...
Every 5 minutes:
  1. Collect all events in window
  2. Group by task_id
  3. Calculate statistics (count, types, severity)
  4. Emit aggregated event
  5. Check alert rules
  6. Trigger alerts if threshold exceeded
  7. Store to database
  8. Publish to dashboard
  9. Checkpoint state (for recovery)
```

**Alert Rules Engine:**
```python
def check_alert_rules(aggregated_event):
    alerts = []
    
    # Rule 1: High severity change
    if aggregated_event['severity'] == 'high':
        alerts.append({
            'type': 'HIGH_SEVERITY_CHANGE',
            'message': f"High severity change detected"
        })
    
    # Rule 2: Rapid changes (>10 in 5min)
    if aggregated_event['change_count'] > 10:
        alerts.append({
            'type': 'RAPID_CHANGES',
            'message': f"{aggregated_event['change_count']} changes in 5 minutes"
        })
    
    # Rule 3: Critical content modified
    if aggregated_event['content_type'] in ['js', 'css']:
        alerts.append({
            'type': 'CRITICAL_CONTENT',
            'message': f"Critical content ({aggregated_event['content_type']}) modified"
        })
    
    return alerts
```

---

## 4. Technology: Kafka Streams

**Topology:**
```java
StreamsBuilder builder = new StreamsBuilder();

// Source: Kafka topic
KStream<String, ChangeEvent> changeEvents = 
    builder.stream("change-events", 
        Consumed.with(Serdes.String(), changeEventSerde));

// Aggregate by task_id with 5-minute window
KTable<Windowed<String>, ChangeAggregate> aggregated = 
    changeEvents
        .groupByKey()
        .windowedBy(TimeWindows.of(Duration.ofMinutes(5)))
        .aggregate(
            ChangeAggregate::new,
            (taskId, event, aggregate) -> aggregate.add(event),
            Materialized.with(Serdes.String(), aggregateSerde));

// Enrich with metadata
KStream<String, EnrichedAggregate> enriched = 
    aggregated
        .toStream()
        .flatMap((windowed, aggregate) -> {
            String taskId = windowed.key();
            Task task = taskCache.get(taskId);
            return enrichment(aggregate, task);
        });

// Check alert rules
KStream<String, Alert> alerts = 
    enriched
        .flatMap((key, value) -> alertRulesEngine.check(value));

// Sink to outputs
alerts.to("alerts-topic");
enriched.to("timeseries-topic");

Topology topology = builder.build();
```

---

## 5. State Management

**Changelog Topic (for exactly-once):**
```
changelog-change-events-aggregate-store
  - Distributed state store backup
  - Enables recovery from failure
  - Compacted (old values deleted)
```

**Checkpoint:**
```
Offset storage:
  partition-0: offset 10000
  partition-1: offset 9950
  ...
  partition-9: offset 10100

On restart: Resume from checkpoint, no duplicate processing
```

---

## 6. Monitoring

**Stream Processing Metrics:**
```
kafka_streams_lag_total              # Consumer lag (offset)
kafka_streams_processing_rate        # Events/sec
kafka_streams_error_rate             # Errors/sec
kafka_streams_state_store_latency    # Store access time

# Aggregation metrics
aggregation_window_duration          # Time per window
aggregation_count                    # Aggregates produced
alert_rules_triggered                # Alerts generated
```

**Alerting:**
```
# Alert: High lag
kafka_streams_lag_total > 10000
Action: Add stream processors

# Alert: High error rate
rate(kafka_streams_error_rate[5m]) > 10
Action: Investigate, check logs
```

---

## 7. Scaling

**Horizontal Scaling (Kafka Partitions):**
- 10 partitions initially
- Kafka Streams auto-scales across partitions
- Increase to 20+ if throughput > 100k events/sec

**Vertical Scaling (Stream Processor Replicas):**
```yaml
replicas: 1-5  (based on lag)
HPA trigger: kafka_streams_lag_total > 5000
```

---

## 8. Cost Analysis

**Monthly Cost:**
- Kafka/Kinesis (5M events/month): $100
- Stream processor pods: $200
- Monitoring/storage: $50
- Total: ~$350/month

---

## 9. Implementation Checklist

- [ ] Set up Kafka cluster (3 brokers)
- [ ] Create topics (change-events, alerts, timeseries)
- [ ] Implement Kafka Streams topology
- [ ] Deploy stream processors (Kubernetes)
- [ ] Implement alert rules engine
- [ ] Configure exactly-once semantics
- [ ] Set up Prometheus exporter
- [ ] Configure alerting rules
- [ ] Load test (50k+ events/sec)
- [ ] Test failure and recovery
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
