# Incident Response Decision Trees

**Document Version:** 1.0  
**Date:** June 21, 2026  
**Purpose:** Visual decision trees for incident classification and response  
**Format:** ASCII diagrams with decision points and outcomes

---

## Master Incident Classification Tree

```
┌─────────────────────────────────────────────────────────────┐
│ ALERT TRIGGERED / INCIDENT DETECTED                        │
│ (Alert name, time, threshold, value)                       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├─ UNAVAILABLE / NOT RESPONDING?
               │  │
               │  ├─ WebSocket connections == 0
               │  ├─ All health checks failing
               │  ├─ Load balancer all down
               │  └─ → Go to UNAVAILABILITY TREE
               │
               ├─ ERROR RATE SPIKING?
               │  │
               │  ├─ Error rate > 2%
               │  ├─ CRITICAL errors detected
               │  ├─ Specific error type spike
               │  └─ → Go to ERROR RATE TREE
               │
               ├─ MEMORY USAGE HIGH?
               │  │
               │  ├─ Memory > 80%
               │  ├─ Memory climbing rapidly
               │  ├─ Memory > 85% (critical)
               │  └─ → Go to MEMORY TREE
               │
               ├─ LATENCY DEGRADED / SLOW?
               │  │
               │  ├─ p95 latency > 150% baseline
               │  ├─ Request timeouts increasing
               │  ├─ Throughput declining
               │  └─ → Go to PERFORMANCE TREE
               │
               ├─ SUSPICIOUS ACTIVITY / SECURITY ISSUE?
               │  │
               │  ├─ Unauthorized access attempts
               │  ├─ Data exfiltration detected
               │  ├─ Malicious patterns in logs
               │  └─ → Go to SECURITY TREE
               │
               ├─ INFRASTRUCTURE ISSUE?
               │  │
               │  ├─ Docker daemon failing
               │  ├─ Container filesystem full
               │  ├─ Network connectivity lost
               │  └─ → Go to INFRASTRUCTURE TREE
               │
               └─ UNKNOWN / MULTIPLE ISSUES?
                  │
                  ├─ Create incident ID: INC-[YYYYMMDD]-[XXXX]
                  ├─ Page on-call SRE for triage
                  ├─ Collect diagnostics
                  └─ → Re-classify once root cause identified
```

---

## Decision Tree 1: Unavailability

```
┌─────────────────────────────────────────────────────┐
│ SERVICE UNAVAILABILITY INCIDENT                    │
│ (Service not responding)                           │
└──────────────┬──────────────────────────────────────┘
               │
               ├─ QUICK CHECK (15 seconds)
               │  curl http://localhost:8765/health
               │  docker ps -a | grep basset
               │
               └─ Are ANY instances responding?
                  │
                  ├─ YES (Partial - 1-25% responding)
                  │  │
                  │  ├─ SEVERITY: P2 (High)
                  │  │
                  │  ├─ Is there a pattern to what's down?
                  │  │  │
                  │  │  ├─ Specific instances? (not others)
                  │  │  │  └─ Single instance issue
                  │  │  │     ├─ Restart that instance
                  │  │  │     ├─ Check its logs
                  │  │  │     ├─ Investigate failure reason
                  │  │  │     └─ Re-assess
                  │  │  │
                  │  │  ├─ Random/rotating instances?
                  │  │  │  └─ Cascading failure pattern
                  │  │  │     ├─ Check for resource exhaustion
                  │  │  │     ├─ Check for dependency failure
                  │  │  │     ├─ Check for load spike
                  │  │  │     └─ May need fleet action
                  │  │  │
                  │  │  └─ Load balancer issue?
                  │  │     └─ Instances up but LB can't reach them
                  │  │        ├─ Check LB configuration
                  │  │        ├─ Check network connectivity
                  │  │        ├─ Check firewall rules
                  │  │        └─ Fix connectivity
                  │  │
                  │  └─ RESOLUTION:
                  │     ├─ Restart failed instance(s)
                  │     ├─ Monitor recovery
                  │     ├─ If instance fails to recover
                  │     │  └─ Drain from LB
                  │     │  └─ Investigate root cause
                  │     │  └─ May need provisioning team
                  │     └─ If successful
                  │        └─ Verify all customers recovered
                  │
                  └─ NO (Complete - 0% responding)
                     │
                     ├─ SEVERITY: P1 (Critical)
                     ├─ ESCALATION: Page SRE Lead + Tech Lead
                     │
                     ├─ Is this a Docker/container issue?
                     │  │
                     │  ├─ docker ps shows containers running?
                     │  │  │
                     │  │  ├─ YES, running
                     │  │  │  └─ But unresponsive
                     │  │  │     ├─ Check process alive: docker top
                     │  │  │     ├─ Check logs for crash: docker logs
                     │  │  │     ├─ Try restart: docker restart
                     │  │  │     └─ If restart fails → CRITICAL BUG
                     │  │  │
                     │  │  └─ NO, not running
                     │  │     └─ Containers crashed or stopped
                     │  │        ├─ docker logs [last 50 lines]
                     │  │        ├─ Check for resource limits
                     │  │        ├─ docker start [container]
                     │  │        ├─ Wait 30 seconds
                     │  │        └─ Verify startup
                     │  │
                     │  └─ Is Docker daemon itself failing?
                     │     │
                     │     ├─ docker info fails?
                     │     │  └─ Docker daemon down
                     │     │     ├─ Check disk space
                     │     │     ├─ Check /var/lib/docker
                     │     │     ├─ systemctl restart docker
                     │     │     └─ Wait and verify
                     │     │
                     │     └─ Can't reach Docker daemon?
                     │        └─ Network/permission issue
                     │           ├─ Check credentials
                     │           ├─ Check socket permissions
                     │           ├─ May need sudo
                     │           └─ Escalate to infrastructure
                     │
                     ├─ Is this a port/firewall issue?
                     │  │
                     │  ├─ netstat -tlnp | grep 8765
                     │  │  │
                     │  │  ├─ Port listening?
                     │  │  │  ├─ YES → Port is open
                     │  │  │  │   └─ But can't reach from outside?
                     │  │  │  │      ├─ iptables rules blocking?
                     │  │  │  │      ├─ Firewall blocking?
                     │  │  │  │      ├─ Security group blocking?
                     │  │  │  │      └─ Fix firewall rules
                     │  │  │  │
                     │  │  │  └─ NO → Port not listening
                     │  │  │     └─ Application not bound to port
                     │  │  │        ├─ Is process running?
                     │  │  │        ├─ Did it crash on startup?
                     │  │  │        ├─ Check logs for bind error
                     │  │  │        └─ Restart and monitor
                     │  │  │
                     │  │  └─ Port in use by other process?
                     │  │     ├─ lsof -i :8765
                     │  │     ├─ Kill conflicting process
                     │  │     ├─ Restart basset
                     │  │     └─ Verify recovery
                     │  │
                     │  └─ RESOLUTION:
                     │     └─ Fix firewall/network issues
                     │
                     └─ CRITICAL ACTIONS:
                        ├─ Notify #incidents #all-hands
                        ├─ Create incident record
                        ├─ Establish war room
                        ├─ Collect all diagnostics
                        ├─ All recovery attempts (above)
                        ├─ If all fail → Escalate to infrastructure
                        ├─ Monitor for recovery
                        └─ Post all-clear when resolved
```

---

## Decision Tree 2: High Error Rate

```
┌──────────────────────────────────────────────────────┐
│ HIGH ERROR RATE INCIDENT                            │
│ (Error rate spike detected)                         │
└──────────────┬───────────────────────────────────────┘
               │
               ├─ QUICK CHECK (1 min)
               │  ├─ curl 'http://prometheus:9090/...' [error_rate_query]
               │  ├─ docker logs --tail=100 | grep ERROR
               │  └─ docker stats --no-stream [memory/cpu]
               │
               └─ What's the error rate?
                  │
                  ├─ ERROR RATE > 10% for 2+ min?
                  │  │
                  │  ├─ YES
                  │  │  └─ SEVERITY: P1 (Critical)
                  │  │     └─ Go to CRITICAL ERROR RESPONSE (below)
                  │  │
                  │  └─ NO, but > 5% for 5+ min?
                  │     └─ SEVERITY: P2 (High)
                  │        └─ Go to HIGH ERROR RESPONSE (below)
                  │
                  │
                  ├─ ─────────────────────────────────────────
                  │ CRITICAL ERROR RESPONSE (> 10%)
                  │ ─────────────────────────────────────────
                  │
                  ├─ Get error details (1 min)
                  │  │
                  │  ├─ What error types?
                  │  │  │
                  │  │  ├─ MemoryError / OutOfMemory
                  │  │  │  └─ → Go to MEMORY INCIDENT response
                  │  │  │
                  │  │  ├─ ConnectionError / NetworkError
                  │  │  │  └─ External dependency down?
                  │  │  │     ├─ Check dependency health
                  │  │  │     ├─ If down, wait for recovery
                  │  │  │     ├─ If up, debug connection
                  │  │  │     └─ May need escalation
                  │  │  │
                  │  │  ├─ TimeoutError
                  │  │  │  └─ Is load/latency high?
                  │  │  │     ├─ YES → Performance issue
                  │  │  │     │  └─ Restart or scale
                  │  │  │     └─ NO → Timeout threshold too low?
                  │  │  │        └─ May need config adjustment
                  │  │  │
                  │  │  ├─ ValidationError / ParseError
                  │  │  │  └─ Input data format changed?
                  │  │  │     ├─ Check recent deployments
                  │  │  │     ├─ May need rollback
                  │  │  │     └─ OR input validation issue
                  │  │  │
                  │  │  └─ SystemError / Internal Error
                  │  │     └─ Application bug?
                  │  │        ├─ Check stack traces
                  │  │        ├─ Check deployment timing
                  │  │        ├─ May need rollback
                  │  │        └─ OR restart to clear corrupted state
                  │  │
                  │  └─ Is error systematic or sporadic?
                  │     │
                  │     ├─ ALL COMMANDS failing?
                  │     │  └─ Systematic issue → Critical bug
                  │     │     ├─ DECISION POINT:
                  │     │     ├─ Known bug with fix? → Deploy fix
                  │     │     ├─ Unknown bug? → Rollback
                  │     │     └─ External dependency issue? → Wait
                  │     │
                  │     └─ Specific command(s) failing?
                  │        └─ Feature issue
                  │           ├─ Other commands working? YES
                  │           ├─ Service not fully down
                  │           ├─ Can restart to isolate
                  │           ├─ Can deploy targeted fix
                  │           └─ May not need rollback
                  │
                  ├─ DECISION: Action to take?
                  │  │
                  │  ├─ Option 1: RESTART
                  │  │  ├─ Use if: Resource issue, cache corruption
                  │  │  ├─ docker restart basset-hound-browser
                  │  │  ├─ Wait 30 sec, verify recovery
                  │  │  └─ If error rate drops → Success
                  │  │
                  │  ├─ Option 2: ROLLBACK
                  │  │  ├─ Use if: Deployment-related bug
                  │  │  ├─ See ROLLBACK-RUNBOOK.md
                  │  │  └─ Coordinate with Tech Lead
                  │  │
                  │  ├─ Option 3: ESCALATE
                  │  │  ├─ Use if: Unknown cause
                  │  │  ├─ Page Tech Lead + Infrastructure
                  │  │  └─ Provide diagnostics
                  │  │
                  │  └─ Option 4: WAIT
                  │     ├─ Use if: External dependency issue
                  │     ├─ Monitor external service health
                  │     └─ When external recovers, should auto-recover
                  │
                  │
                  └─ ─────────────────────────────────────────
                     HIGH ERROR RESPONSE (5-10%)
                     ─────────────────────────────────────────
                     │
                     ├─ Get error details (same as critical above)
                     │
                     ├─ DECISION: Is this acceptable?
                     │  │
                     │  ├─ Known issue with workaround?
                     │  │  └─ Document and monitor
                     │  │
                     │  ├─ New error spike?
                     │  │  ├─ YES → Escalate like critical
                     │  │  └─ NO → May indicate trend
                     │  │
                     │  └─ Trending up or stabilizing?
                     │     ├─ TRENDING UP → Escalate
                     │     └─ STABLE → Monitor and investigate
                     │
                     └─ MONITOR FOR 30 MIN:
                        ├─ Does rate drop back to baseline?
                        │  ├─ YES → Temporary issue, continue monitoring
                        │  └─ NO → Escalate to P1 procedures
                        │
                        ├─ Does rate stay elevated?
                        │  └─ YES → Investigate root cause
                        │     ├─ Check for pattern
                        │     ├─ Check for ongoing load
                        │     ├─ Check logs for clues
                        │     └─ May need deployment/fix
                        │
                        └─ Does rate trend higher?
                           └─ YES → ESCALATE, treat as P1
```

---

## Decision Tree 3: High Memory

```
┌─────────────────────────────────────────────────────┐
│ HIGH MEMORY INCIDENT                                │
│ (Memory usage spike detected)                       │
└──────────────┬──────────────────────────────────────┘
               │
               ├─ QUICK CHECK (1 min)
               │  ├─ docker stats --no-stream [MEMORY field]
               │  ├─ docker exec [container] free -h
               │  └─ Check memory % threshold
               │
               └─ What's the memory state?
                  │
                  ├─ MEMORY > 85% for 2+ min?
                  │  │
                  │  ├─ YES
                  │  │  └─ SEVERITY: P1 (Critical)
                  │  │     └─ IMMEDIATE RESTART
                  │  │        ├─ Notify: Post to #incidents
                  │  │        ├─ Backup: docker cp state
                  │  │        ├─ Action: docker restart
                  │  │        ├─ Wait: 30 seconds
                  │  │        ├─ Verify: docker stats
                  │  │        └─ If recovered, go to INVESTIGATION
                  │  │           If not recovered, escalate
                  │  │
                  │  └─ NO, but 80-85% for 5+ min?
                  │     └─ SEVERITY: P3 (Medium)
                  │        └─ Go to ELEVATED MEMORY (below)
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ ELEVATED MEMORY RESPONSE (80-85%)
                  │ ────────────────────────────────────────
                  │
                  ├─ Is memory climbing?
                  │  │
                  │  ├─ YES (Growing > 10% per hour)
                  │  │  │
                  │  │  ├─ MEMORY LEAK SUSPECTED
                  │  │  │
                  │  │  ├─ Estimate time to OOM
                  │  │  │  │
                  │  │  │  ├─ Growth rate: [%]/hour
                  │  │  │  ├─ Current: [%] of limit
                  │  │  │  ├─ ETA to 100%: [time]
                  │  │  │  │
                  │  │  │  ├─ < 1 hour?
                  │  │  │  │  └─ URGENT → Restart soon
                  │  │  │  │
                  │  │  │  ├─ 1-4 hours?
                  │  │  │  │  └─ Can investigate and fix
                  │  │  │  │
                  │  │  │  └─ > 4 hours?
                  │  │  │     └─ Can monitor and schedule restart
                  │  │  │
                  │  │  └─ LEAK INVESTIGATION
                  │  │     ├─ Collect heap dump
                  │  │     │  docker exec [container] node -e \
                  │  │     │    "require('v8').writeHeapSnapshot(...)"
                  │  │     │
                  │  │     ├─ Analyze with DevTools or clinic.js
                  │  │     │
                  │  │     ├─ Identify leak source
                  │  │     │  ├─ Event listener not removed?
                  │  │     │  ├─ Cache not flushed?
                  │  │     │  ├─ Timer not cleared?
                  │  │     │  ├─ Large object retained?
                  │  │     │  └─ Global reference not cleaned?
                  │  │     │
                  │  │     └─ Action:
                  │  │        ├─ If fix is simple → Deploy fix
                  │  │        ├─ If fix is complex → Schedule restart
                  │  │        ├─ Set aggressive restart schedule
                  │  │        └─ Document for v12.8.0 fix
                  │  │
                  │  └─ NO (Memory stable or decreasing)
                  │     │
                  │     ├─ Temporary spike, now recovered?
                  │     │  │
                  │     │  ├─ YES
                  │     │  │  └─ Investigation mode
                  │     │  │     ├─ What caused the spike?
                  │     │  │     ├─ Large screenshot capture?
                  │     │  │     ├─ Bulk operation?
                  │     │  │     ├─ Concurrent load?
                  │     │  │     └─ Document for future reference
                  │     │  │
                  │     │  └─ NO
                  │     │     └─ Memory high but stable
                  │     │        ├─ Is baseline higher than expected?
                  │     │        ├─ May need baseline adjustment
                  │     │        ├─ Or may indicate bloat
                  │     │        └─ Schedule investigation
                  │     │
                  │     └─ Monitor for next 30 min
                  │        ├─ If memory further decreases
                  │        │  └─ No action needed
                  │        │
                  │        ├─ If memory stabilizes high
                  │        │  └─ Investigate cause
                  │        │
                  │        └─ If memory climbs again
                  │           └─ Go to LEAK INVESTIGATION
                  │
                  │
                  └─ ────────────────────────────────────────
                     POST-RESTART ACTIONS
                     ────────────────────────────────────────
                     │
                     ├─ Verify startup
                     │  ├─ Container running?
                     │  ├─ Health check passing?
                     │  ├─ Services responsive?
                     │  └─ No errors in logs?
                     │
                     ├─ Monitor for 1 hour
                     │  ├─ Memory staying normal?
                     │  ├─ Error rate normal?
                     │  ├─ Performance normal?
                     │  └─ Logs clean?
                     │
                     ├─ If all good
                     │  └─ Investigate root cause
                     │     ├─ Was it temporary spike?
                     │     ├─ Was it memory leak?
                     │     ├─ Was it specific workload?
                     │     └─ Implement fix if systematic
                     │
                     └─ If memory high again soon
                        └─ Escalate
                           ├─ Systematic memory leak
                           ├─ Need permanent fix
                           ├─ May need v12.7.1 patch
                           └─ Or more aggressive monitoring
```

---

## Decision Tree 4: Performance Degradation

```
┌───────────────────────────────────────────────────────┐
│ PERFORMANCE DEGRADATION INCIDENT                     │
│ (Latency spike or timeout increase detected)        │
└──────────────┬────────────────────────────────────────┘
               │
               ├─ QUICK CHECK (1 min)
               │  ├─ Get latency p95: histogram_quantile(0.95, latency_ms)
               │  ├─ Get baseline: [baseline_value] ms
               │  ├─ Calculate ratio: current / baseline
               │  └─ docker stats --no-stream [CPU/MEM/DISK]
               │
               └─ What's the performance state?
                  │
                  ├─ p95 latency > 200% of baseline for 5+ min?
                  │  │
                  │  ├─ YES
                  │  │  └─ SEVERITY: P2 (High)
                  │  │     └─ Go to SEVERE PERFORMANCE (below)
                  │  │
                  │  └─ NO, but > 150% for 10+ min?
                  │     └─ SEVERITY: P3 (Medium)
                  │        └─ Go to ELEVATED LATENCY (below)
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ SEVERE PERFORMANCE RESPONSE (> 200%)
                  │ ────────────────────────────────────────
                  │
                  ├─ Which command(s) are slow?
                  │  │
                  │  ├─ docker logs --since=10m | grep duration \
                  │  │    | awk '{print [command]}' | sort | uniq -c
                  │  │
                  │  ├─ All commands slow?
                  │  │  └─ System-level issue
                  │  │     └─ Go to BOTTLENECK IDENTIFICATION
                  │  │
                  │  └─ Specific command slow?
                  │     └─ Command-level issue
                  │        ├─ Is it screenshot? (expected to be slower)
                  │        ├─ Is it navigate? (can be variable)
                  │        ├─ Is it something fast normally?
                  │        └─ Check command implementation
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ BOTTLENECK IDENTIFICATION
                  │ ────────────────────────────────────────
                  │
                  ├─ Check each resource
                  │  │
                  │  ├─ CPU Usage
                  │  │  ├─ docker stats [CPU %]
                  │  │  ├─ > 80%? YES
                  │  │  │  └─ CPU-BOUND RESPONSE (see below)
                  │  │  │
                  │  │  └─ > 80%? NO
                  │  │     └─ Continue checking other resources
                  │  │
                  │  ├─ Memory Usage
                  │  │  ├─ docker stats [MEM %]
                  │  │  ├─ > 85%? YES
                  │  │  │  └─ MEMORY-BOUND RESPONSE (see below)
                  │  │  │
                  │  │  └─ > 85%? NO
                  │  │     └─ Continue checking other resources
                  │  │
                  │  ├─ Disk I/O
                  │  │  ├─ docker exec [container] iostat -x 1 2
                  │  │  ├─ > 200 MB/s? YES
                  │  │  │  └─ DISK-BOUND RESPONSE (see below)
                  │  │  │
                  │  │  └─ > 200 MB/s? NO
                  │  │     └─ Continue checking
                  │  │
                  │  └─ Network
                  │     ├─ docker exec [container] iftop
                  │     ├─ Saturation? YES
                  │     │  └─ NETWORK-BOUND RESPONSE (see below)
                  │     │
                  │     └─ Saturation? NO
                  │        └─ May be application-level issue
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ CPU-BOUND RESPONSE
                  │ ────────────────────────────────────────
                  │
                  ├─ What's using CPU?
                  │  ├─ docker exec [container] ps aux | sort -k3 -nr | head -5
                  │  ├─ [Node process] using most CPU?
                  │  │  └─ JavaScript execution is CPU-bound
                  │  │     ├─ Is there a hot loop?
                  │  │     ├─ Is regex doing backtracking?
                  │  │     ├─ Is crypto operation running?
                  │  │     └─ Profile to find issue
                  │  │
                  │  └─ Other process?
                  │     └─ Contention from other workload
                  │        └─ Isolate/restart container
                  │
                  ├─ Action:
                  │  │
                  │  ├─ Can optimize code? YES
                  │  │  └─ Deploy optimization
                  │  │
                  │  └─ Need to reduce load? YES
                  │     ├─ Scale horizontally
                  │     ├─ Or restart to clear state
                  │     └─ docker restart basset-hound-browser
                  │
                  ├─ Verify recovery
                  │  ├─ Wait 30 seconds for startup
                  │  ├─ Get new latency metrics
                  │  ├─ Should return toward baseline
                  │  └─ If not, escalate
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ MEMORY-BOUND RESPONSE
                  │ ────────────────────────────────────────
                  │
                  ├─ If Memory > 85%
                  │  └─ → Go to MEMORY INCIDENT (Memory Tree)
                  │
                  ├─ If Memory 80-85%
                  │  ├─ Restart to clear memory
                  │  └─ docker restart basset-hound-browser
                  │
                  ├─ Verify recovery
                  │  ├─ Wait 30 seconds
                  │  ├─ Check latency metrics
                  │  ├─ Check memory after restart
                  │  └─ Both should improve
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ DISK-BOUND RESPONSE
                  │ ────────────────────────────────────────
                  │
                  ├─ What's causing disk I/O?
                  │  ├─ docker exec [container] lsof -p [pid] | grep REG
                  │  ├─ Log file growing? YES
                  │  │  ├─ Check log size: du -sh /app/logs
                  │  │  ├─ Archive/rotate if needed
                  │  │  └─ Consider reducing log level
                  │  │
                  │  ├─ Cache file bloat? YES
                  │  │  ├─ Clear cache: rm -rf /app/cache/*
                  │  │  ├─ Or reduce cache TTL
                  │  │  └─ May need restart
                  │  │
                  │  └─ Temporary file bloat? YES
                  │     ├─ Clear temp: rm -rf /tmp/*
                  │     ├─ Screenshot cache? Check /app/tmp
                  │     └─ May need cleanup script
                  │
                  ├─ Action:
                  │  ├─ Clear cache/temp → Restart
                  │  ├─ Monitor disk I/O
                  │  └─ Verify latency recovers
                  │
                  │
                  ├─ ────────────────────────────────────────
                  │ NETWORK-BOUND RESPONSE
                  │ ────────────────────────────────────────
                  │
                  ├─ Is this expected?
                  │  ├─ Large file transfer? YES
                  │  │  └─ Expected behavior, not an issue
                  │  │
                  │  └─ Large file transfer? NO
                  │     └─ Investigate connection leak
                  │        ├─ netstat -tlnp | grep ESTABLISHED | wc -l
                  │        ├─ Too many connections?
                  │        ├─ Restart to clean up
                  │        └─ Check for connection leak in code
                  │
                  │
                  └─ ────────────────────────────────────────
                     ELEVATED LATENCY RESPONSE (150-200%)
                     ────────────────────────────────────────
                     │
                     ├─ Monitor for next 10 minutes
                     │  ├─ Is latency trending down? → Continue monitoring
                     │  ├─ Is latency stable? → Investigate
                     │  └─ Is latency trending up? → Escalate to P2
                     │
                     ├─ If stable, investigate cause
                     │  ├─ Load increase?
                     │  ├─ One-time large operation?
                     │  ├─ External latency (network)?
                     │  └─ Code change (check git log)
                     │
                     └─ Decide on action
                        ├─ If temporary load → No action
                        ├─ If code issue → Deploy fix
                        ├─ If baseline changed → Update threshold
                        └─ If unknown → Schedule investigation
```

---

## Decision Tree 5: Security Incident

```
┌──────────────────────────────────────────────────────┐
│ SECURITY INCIDENT DETECTED                          │
│ (Suspicious activity, unauthorized access detected) │
└──────────────┬───────────────────────────────────────┘
               │
               ├─ CRITICAL: DO NOT MODIFY SYSTEMS
               │  Preserve forensic evidence!
               │
               ├─ QUICK CHECK (1 min)
               │  └─ Type of incident?
               │
               └─ What type of security incident?
                  │
                  ├─ UNAUTHORIZED ACCESS ATTEMPT
                  │  │
                  │  ├─ SEVERITY: P1 (Critical)
                  │  │
                  │  ├─ Quick actions
                  │  │  ├─ Identify source IP
                  │  │  ├─ Block at firewall (if malicious)
                  │  │  │  iptables -A INPUT -s [IP] -j DROP
                  │  │  │
                  │  │  ├─ Check what was accessed
                  │  │  │  docker logs | grep "[malicious-ip]"
                  │  │  │
                  │  │  ├─ Preserve logs
                  │  │  │  docker logs > /tmp/security-logs.txt
                  │  │  │
                  │  │  └─ Notify: #security #incidents #cto
                  │  │
                  │  ├─ Investigation
                  │  │  ├─ Successful breach? (Check for data access)
                  │  │  ├─ Credential compromise? (Force password resets)
                  │  │  ├─ Persistence? (Check for backdoors)
                  │  │  └─ Scope? (Audit full access logs)
                  │  │
                  │  └─ Remediation
                  │     ├─ Block source IP
                  │     ├─ Rotate all credentials
                  │     ├─ Audit access logs
                  │     ├─ Check for privilege escalation
                  │     └─ Deploy additional logging/monitoring
                  │
                  │
                  ├─ DATA EXFILTRATION DETECTED
                  │  │
                  │  ├─ SEVERITY: P1 (Critical)
                  │  │
                  │  ├─ IMMEDIATE CONTAINMENT
                  │  │  ├─ Identify exfiltration destination
                  │  │  │  docker exec [container] netstat -tlnp | grep ESTABLISHED
                  │  │  │
                  │  │  ├─ Block destination
                  │  │  │  iptables -A OUTPUT -d [dest-ip] -j DROP
                  │  │  │
                  │  │  ├─ Identify what data
                  │  │  │  docker logs | grep "large\|bulk\|export"
                  │  │  │
                  │  │  ├─ Preserve evidence
                  │  │  │  tar czf /tmp/exfil-evidence.tar.gz \
                  │  │  │    /app /var/log [relevant files]
                  │  │  │
                  │  │  └─ Notify: #security #incidents #cto
                  │  │
                  │  ├─ Investigation
                  │  │  ├─ What data was exfiltrated?
                  │  │  │  ├─ User data?
                  │  │  │  ├─ Internal data?
                  │  │  │  ├─ Credentials?
                  │  │  │  └─ Intellectual property?
                  │  │  │
                  │  │  ├─ How much data?
                  │  │  │  └─ Estimate impact scope
                  │  │  │
                  │  │  ├─ How long has it been happening?
                  │  │  │  └─ Check logs from weeks back
                  │  │  │
                  │  │  └─ Who was affected?
                  │  │     └─ Determine customer/user impact
                  │  │
                  │  └─ Response
                  │     ├─ Legal team → Breach notification
                  │     ├─ Customers → Communication plan
                  │     ├─ Regulators → Compliance reporting
                  │     ├─ Systems → Rotate credentials
                  │     └─ Monitoring → Verify no ongoing exfil
                  │
                  │
                  ├─ CODE INJECTION / MALWARE DETECTED
                  │  │
                  │  ├─ SEVERITY: P1 (Critical)
                  │  │
                  │  ├─ IMMEDIATE ISOLATION
                  │  │  ├─ docker kill basset-hound-browser --force
                  │  │  │  (Don't restart from image yet)
                  │  │  │
                  │  │  ├─ Preserve container
                  │  │  │  docker commit basset-hound-browser \
                  │  │  │    basset-hound-browser:infected-[timestamp]
                  │  │  │
                  │  │  ├─ Preserve filesystem
                  │  │  │  docker cp [id]:/app /tmp/infected-app
                  │  │  │  docker cp [id]:/var/log /tmp/infected-logs
                  │  │  │
                  │  │  └─ Notify: #security #incidents #cto
                  │  │
                  │  ├─ Investigation
                  │  │  ├─ What was injected?
                  │  │  │  ├─ Backdoor?
                  │  │  │  ├─ Cryptominer?
                  │  │  │  ├─ Wiper?
                  │  │  │  └─ Persistence mechanism?
                  │  │  │
                  │  │  ├─ How did it get in?
                  │  │  │  ├─ Vulnerability in code?
                  │  │  │  ├─ Supply chain compromise?
                  │  │  │  ├─ Lateral movement?
                  │  │  │  └─ Insider threat?
                  │  │  │
                  │  │  ├─ How long was it there?
                  │  │  │  └─ Timeline analysis
                  │  │  │
                  │  │  └─ What did it do?
                  │  │     ├─ CPU/disk usage suspicious?
                  │  │     ├─ Network connections suspicious?
                  │  │     ├─ Processes created?
                  │  │     └─ Data accessed?
                  │  │
                  │  └─ Remediation
                  │     ├─ Full code audit
                  │     ├─ Revert to clean image
                  │     ├─ Deploy from clean build
                  │     ├─ Comprehensive monitoring
                  │     └─ Incident review for cause
                  │
                  │
                  ├─ CREDENTIAL COMPROMISE
                  │  │
                  │  ├─ SEVERITY: P1 (Critical)
                  │  │
                  │  ├─ IMMEDIATE RESPONSE
                  │  │  ├─ Identify compromised credential
                  │  │  │  (API key? Service account? Other?)
                  │  │  │
                  │  │  ├─ ROTATE IMMEDIATELY
                  │  │  │  ├─ Generate new credential
                  │  │  │  ├─ Update application
                  │  │  │  ├─ Restart service
                  │  │  │  └─ Verify functionality
                  │  │  │
                  │  │  ├─ REVOKE OLD CREDENTIAL
                  │  │  │  └─ Ensure attacker can't use it
                  │  │  │
                  │  │  ├─ AUDIT ACCESS
                  │  │  │  └─ What did attacker do with credential?
                  │  │  │
                  │  │  └─ Notify: #security #incidents
                  │  │
                  │  ├─ Investigation
                  │  │  ├─ How was credential exposed?
                  │  │  │  ├─ In git history?
                  │  │  │  ├─ In logs?
                  │  │  │  ├─ In config file?
                  │  │  │  ├─ Exfiltrated from app?
                  │  │  │  └─ Phishing/social engineering?
                  │  │  │
                  │  │  ├─ How long was it exposed?
                  │  │  │  └─ Timeline analysis
                  │  │  │
                  │  │  └─ Other credentials at risk?
                  │  │     ├─ Audit all secrets
                  │  │     ├─ Rotate anything exposed
                  │  │     └─ Implement secrets scanning
                  │  │
                  │  └─ Remediation
                  │     ├─ Rotate ALL credentials
                  │     ├─ Git history audit for exposed secrets
                  │     ├─ Implement secret scanning in CI/CD
                  │     ├─ Improve secret storage (vaults, etc)
                  │     └─ Audit access logs with old credentials
                  │
                  │
                  └─ UNKNOWN SECURITY ISSUE
                     │
                     ├─ SEVERITY: P1 (Critical)
                     │
                     ├─ ESCALATE IMMEDIATELY
                     │  ├─ Security team lead
                     │  ├─ Incident commander
                     │  ├─ CTO
                     │  └─ Legal (if unclear)
                     │
                     ├─ PRESERVE EVIDENCE
                     │  ├─ Don't touch systems
                     │  ├─ Collect diagnostics
                     │  ├─ Save logs
                     │  └─ Let security team take over
                     │
                     └─ Security team will determine next steps
```

---

## Escalation Matrix

```
INCIDENT SEVERITY ESCALATION

P1 (CRITICAL)
├─ Immediate actions
│  ├─ Page on-call SRE (within 2 min)
│  ├─ Page on-call Tech Lead (within 5 min)
│  ├─ Page Engineering Manager (within 10 min)
│  ├─ Establish war room
│  └─ Post status every 5 minutes
│
├─ If not resolved in 30 min
│  └─ Page VP Engineering
│
└─ If not resolved in 1 hour
   └─ CTO notification + executive decision

P2 (HIGH)
├─ Immediate actions
│  ├─ Page on-call SRE (within 5 min)
│  ├─ Notify Engineering Manager
│  ├─ Slack notification to #incidents
│  └─ Post status every 15 minutes
│
├─ If not resolved in 1 hour
│  └─ Page Tech Lead
│
└─ If not resolved in 4 hours
   └─ Executive escalation

P3 (MEDIUM)
├─ Create ticket
├─ Slack notification to #incidents
├─ Assign to on-call (or follow-up)
├─ Post status every 30 minutes
└─ If escalates to P2 → Follow P2 procedures

P4 (LOW)
├─ Create ticket
├─ Can batch with other work
├─ Scheduled fix
└─ No escalation needed
```

---

**End of Decision Trees**

Use these diagrams to quickly navigate incident response during real incidents. Print them or keep them accessible during on-call rotation.
