# OPERATIONAL RUNBOOKS AND HANDBOOKS
**Basset Hound Browser v12.7.0**  
**Production Operations Documentation**  
**Last Updated**: June 21, 2026

---

## Overview

This directory contains comprehensive operational runbooks and handbooks for managing Basset Hound Browser in production. All runbooks are designed for DevOps engineers, SREs, and on-call staff.

**Documentation Status**: ✅ Complete and Production Ready

---

## Quick Navigation

### For Emergency Situations (Now!)

**🚨 INCIDENT OCCURRING RIGHT NOW?**

1. **Start here**: [ON-CALL-HANDBOOK.md](./ON-CALL-HANDBOOK.md#first-response)
2. **Run diagnostics**: Follow "Quick Health Check" in [RUNBOOK-TROUBLESHOOTING.md](./RUNBOOK-TROUBLESHOOTING.md#diagnostic-framework)
3. **Find the issue**: Search [RUNBOOK-TROUBLESHOOTING.md](./RUNBOOK-TROUBLESHOOTING.md#common-issues-and-solutions) for your symptom
4. **Get help**: Use escalation path in [ON-CALL-HANDBOOK.md](./ON-CALL-HANDBOOK.md#escalation-matrix)

### For Routine Operations

**Daily**:
- Check [RUNBOOK-MONITORING.md](./RUNBOOK-MONITORING.md) - Dashboard access and key metrics
- Review alert summary in Slack #basset-hound-ops

**Weekly**:
- Run weekly maintenance tasks from [RUNBOOK-MAINTENANCE.md](./RUNBOOK-MAINTENANCE.md#regular-maintenance-schedule)
- Review health check report

**Monthly**:
- Execute monthly maintenance checklist
- Test disaster recovery procedures
- Review and tune alerts

---

## Runbook Directory

### 1. **RUNBOOK-DEPLOYMENT.md** - Deployment & Release Management
**When to use**: Deploying new versions, managing releases, rolling back

**Key sections**:
- Prerequisites and system requirements
- Docker-Compose deployment (single-node)
- Kubernetes deployment (multi-node)
- Helm deployment automation
- Complete verification procedures
- Rollback procedures and disaster recovery
- Deployment troubleshooting

**Quick links**:
- [Pre-Deployment Checklist](./RUNBOOK-DEPLOYMENT.md#pre-deployment-checklist)
- [Docker-Compose Deployment](./RUNBOOK-DEPLOYMENT.md#docker-compose-deployment)
- [Kubernetes Deployment](./RUNBOOK-DEPLOYMENT.md#kubernetes-deployment)
- [Rollback Procedures](./RUNBOOK-DEPLOYMENT.md#rollback-procedures)

**Common tasks**:
```bash
# Deploy with Docker Compose
docker-compose up -d

# Deploy with Kubernetes
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# Verify deployment
curl http://localhost:8765/health

# Rollback if needed
kubectl rollout undo deployment/basset-hound-browser -n basset-hound
```

---

### 2. **RUNBOOK-SCALING.md** - Horizontal Scaling & Load Balancing
**When to use**: High traffic, adding more instances, load balancing configuration

**Key sections**:
- When to scale (triggers and thresholds)
- Scaling metrics and capacity planning
- Docker Compose manual scaling with load balancer
- Kubernetes manual and automatic scaling (HPA)
- Load balancing setup (Kubernetes Service, Ingress, DNS)
- Verification and testing procedures
- Scaling down safely

**Quick links**:
- [Scaling Triggers](./RUNBOOK-SCALING.md#scaling-triggers-and-metrics)
- [Docker Compose Scaling](./RUNBOOK-SCALING.md#docker-compose-scaling)
- [Kubernetes Scaling](./RUNBOOK-SCALING.md#kubernetes-scaling)
- [Load Balancing Setup](./RUNBOOK-SCALING.md#load-balancing-setup)

**Common tasks**:
```bash
# Manual scale to 5 replicas
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound

# Check HPA status
kubectl get hpa -n basset-hound -w

# Monitor pod distribution
kubectl get pods -n basset-hound -o wide
```

---

### 3. **RUNBOOK-MAINTENANCE.md** - Routine Maintenance & Operational Care
**When to use**: Backup/recovery, log management, security patching, performance tuning

**Key sections**:
- Maintenance windows and scheduling
- Full and incremental backup procedures
- Data cleanup (cache, logs, old files)
- Log rotation configuration
- Security patching and dependency updates
- Certificate management (SSL/TLS)
- Performance tuning (memory, CPU, disk, network)
- Regular maintenance schedule

**Quick links**:
- [Backup Procedures](./RUNBOOK-MAINTENANCE.md#backup-procedures)
- [Data Cleanup](./RUNBOOK-MAINTENANCE.md#data-cleanup)
- [Log Rotation](./RUNBOOK-MAINTENANCE.md#log-rotation)
- [Security Patching](./RUNBOOK-MAINTENANCE.md#security-patching)
- [Maintenance Schedule](./RUNBOOK-MAINTENANCE.md#regular-maintenance-schedule)

**Common tasks**:
```bash
# Full backup
./infrastructure/scripts/backup-automation.sh --full

# Cleanup old logs
docker exec basset-hound-browser find /app/logs -mtime +30 -delete

# Check security updates
npm audit

# Daily maintenance (automated via cron)
0 1 * * * /path/to/backup-automation.sh --full
```

---

### 4. **RUNBOOK-TROUBLESHOOTING.md** - Problem Diagnosis & Resolution
**When to use**: Issues occur, need to debug, diagnose root causes

**Key sections**:
- Diagnostic framework (quick health check, extended diagnostics)
- Common issues with solutions (8 major issue categories)
- Advanced debugging techniques
- Log analysis guide
- Escalation procedures

**Issue coverage**:
1. Container won't start
2. High memory usage
3. WebSocket connection refused
4. High CPU usage
5. Health check failing
6. Pod crashes in Kubernetes
7. Slow response times
8. Disk space issues

**Quick links**:
- [Diagnostic Framework](./RUNBOOK-TROUBLESHOOTING.md#diagnostic-framework)
- [Common Issues](./RUNBOOK-TROUBLESHOOTING.md#common-issues-and-solutions)
- [Advanced Debugging](./RUNBOOK-TROUBLESHOOTING.md#advanced-debugging)
- [Escalation Procedures](./RUNBOOK-TROUBLESHOOTING.md#escalation-procedures)

**Common tasks**:
```bash
# Quick health check
basset-quick-check

# Extended diagnostics
# See diagnostic script in runbook

# Check specific issue
docker logs basset-hound-browser | grep -i "error"

# Escalate if stuck
/page @senior-engineer "Need help troubleshooting [issue]"
```

---

### 5. **RUNBOOK-MONITORING.md** - Metrics, Dashboards & Alerting
**When to use**: Understanding performance, configuring alerts, SLO tracking

**Key sections**:
- Monitoring infrastructure setup (Prometheus, Grafana)
- Dashboard access and navigation
- Key metrics and thresholds
- Alert types and common alerts
- Alert response guide for each alert type
- SLO/SLA definitions and tracking
- Creating custom dashboards

**Quick links**:
- [Accessing Dashboards](./RUNBOOK-MONITORING.md#accessing-dashboards)
- [Key Metrics](./RUNBOOK-MONITORING.md#key-metrics)
- [Understanding Alerts](./RUNBOOK-MONITORING.md#understanding-alerts)
- [Alert Response Guide](./RUNBOOK-MONITORING.md#alert-response-guide)

**Common tasks**:
```bash
# Access Grafana
http://localhost:3000  # Or port-forward if remote

# Check metrics
docker stats basset-hound-browser --no-stream
kubectl top pods -n basset-hound

# Get Prometheus query
curl 'http://localhost:9090/api/v1/query?query=websocket_connections_active'
```

---

### 6. **ON-CALL-HANDBOOK.md** - 24/7 Support & Incident Response
**When to use**: On-call rotation, incident response, after-hours support

**Key sections**:
- On-call basics (setup, expectations, handoff)
- First response procedures (alert triage, severity assessment)
- Incident management (declaring, communication, resolution)
- Common scenarios with step-by-step fixes
- After-hours support (getting help, escalation)
- Knowledge base (most common issues, quick fixes)
- Escalation matrix
- Post-incident procedures

**Quick links**:
- [First Response](./ON-CALL-HANDBOOK.md#first-response)
- [Incident Management](./ON-CALL-HANDBOOK.md#incident-management)
- [Common Scenarios](./ON-CALL-HANDBOOK.md#common-scenarios)
- [Escalation Matrix](./ON-CALL-HANDBOOK.md#escalation-matrix)

**Common tasks**:
```bash
# Acknowledge alert
# In PagerDuty: click acknowledge

# Declare incident
/incident declare "Basset service down" p1 #basset-hound-ops

# Get quick fixes
See "Knowledge Base" section for most common issues

# Escalate if needed
/page @senior-oncall "Stuck on issue for 30 min, need help"
```

---

## How to Use These Runbooks

### Step 1: Determine Your Situation

**What are you doing?**
- [ ] Deploying a new version → [RUNBOOK-DEPLOYMENT.md](./RUNBOOK-DEPLOYMENT.md)
- [ ] Scaling up/down → [RUNBOOK-SCALING.md](./RUNBOOK-SCALING.md)
- [ ] Routine maintenance → [RUNBOOK-MAINTENANCE.md](./RUNBOOK-MAINTENANCE.md)
- [ ] Troubleshooting an issue → [RUNBOOK-TROUBLESHOOTING.md](./RUNBOOK-TROUBLESHOOTING.md)
- [ ] Checking health/alerts → [RUNBOOK-MONITORING.md](./RUNBOOK-MONITORING.md)
- [ ] On-call support → [ON-CALL-HANDBOOK.md](./ON-CALL-HANDBOOK.md)

### Step 2: Find Relevant Section

Each runbook has:
- **Table of Contents** - Quick navigation
- **Quick Reference** - Common commands and troubleshooting
- **Checklists** - Step-by-step procedures
- **Troubleshooting** - Common problems and solutions

### Step 3: Execute Procedures

All procedures use:
- **Numbered steps** - Follow in order
- **Code blocks** - Copy/paste commands
- **Expected outcomes** - What should happen
- **If-then guidance** - Decision trees for branches

### Step 4: Document and Learn

- **Log what you did**: Helps future troubleshooting
- **Update runbooks**: If you find better procedures
- **Share learnings**: Post-incident, tell the team
- **Create tickets**: For improvements discovered

---

## Reference: Which Runbook for Common Tasks

| Task | Runbook | Section |
|------|---------|---------|
| Deploy new version | Deployment | [Docker-Compose Deployment](./RUNBOOK-DEPLOYMENT.md#docker-compose-deployment) |
| Deploy to Kubernetes | Deployment | [Kubernetes Deployment](./RUNBOOK-DEPLOYMENT.md#kubernetes-deployment) |
| Verify deployment | Deployment | [Verification Steps](./RUNBOOK-DEPLOYMENT.md#verification-steps) |
| Rollback version | Deployment | [Rollback Procedures](./RUNBOOK-DEPLOYMENT.md#rollback-procedures) |
| Add more instances | Scaling | [Docker-Compose Scaling](./RUNBOOK-SCALING.md#docker-compose-scaling) |
| Scale Kubernetes | Scaling | [Kubernetes Scaling](./RUNBOOK-SCALING.md#kubernetes-scaling) |
| Enable auto-scaling | Scaling | [Kubernetes HPA](./RUNBOOK-SCALING.md#option-2-horizontal-pod-autoscaler-hpa) |
| Setup load balancer | Scaling | [Load Balancing Setup](./RUNBOOK-SCALING.md#load-balancing-setup) |
| Create backup | Maintenance | [Backup Procedures](./RUNBOOK-MAINTENANCE.md#backup-procedures) |
| Restore from backup | Maintenance | [Data Cleanup](./RUNBOOK-MAINTENANCE.md#data-cleanup) |
| Cleanup old logs | Maintenance | [Log Rotation](./RUNBOOK-MAINTENANCE.md#log-rotation) |
| Apply security patches | Maintenance | [Security Patching](./RUNBOOK-MAINTENANCE.md#security-patching) |
| Diagnose issue | Troubleshooting | [Diagnostic Framework](./RUNBOOK-TROUBLESHOOTING.md#diagnostic-framework) |
| Find and fix error | Troubleshooting | [Common Issues](./RUNBOOK-TROUBLESHOOTING.md#common-issues-and-solutions) |
| Access dashboards | Monitoring | [Accessing Dashboards](./RUNBOOK-MONITORING.md#accessing-dashboards) |
| Understand metrics | Monitoring | [Key Metrics](./RUNBOOK-MONITORING.md#key-metrics) |
| Respond to alert | Monitoring | [Alert Response Guide](./RUNBOOK-MONITORING.md#alert-response-guide) |
| Handle incident | On-Call | [Incident Management](./ON-CALL-HANDBOOK.md#incident-management) |
| First response | On-Call | [First Response](./ON-CALL-HANDBOOK.md#first-response) |
| Get help on-call | On-Call | [After-Hours Support](./ON-CALL-HANDBOOK.md#after-hours-support) |

---

## Quick Reference Cards

### Emergency Contact Tree

```
Alert triggered
    ↓
[You] - On-call engineer
    ↓ (stuck after 15 min P1 / 30 min P2)
Senior on-call engineer
    ↓ (critical path affected)
Engineering manager
    ↓ (customer escalation)
VP Engineering
```

### SLA Response Times

| Severity | Alert Trigger | Acknowledge | Start Fix | Resolve |
|----------|---------------|-------------|-----------|---------|
| P1 | Critical | 5 min | 15 min | 30 min |
| P2 | High | 15 min | 1 hour | 4 hours |
| P3 | Medium | 1 hour | 4 hours | 24 hours |

### Key Metrics at a Glance

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| CPU | < 30% | 30-70% | > 70% |
| Memory | < 50% | 50-80% | > 80% |
| Disk | < 70% | 70-85% | > 85% |
| Error Rate | < 0.5% | 0.5-1% | > 1% |
| Latency P95 | < 50ms | 50-100ms | > 100ms |
| Availability | > 99.5% | 99-99.5% | < 99% |

### Common Commands Quick Reference

```bash
# Health Check
curl http://localhost:8765/health

# Container Status
docker ps | grep basset
docker stats basset-hound-browser --no-stream

# Kubernetes Status
kubectl get pods -n basset-hound
kubectl logs -f <pod-name> -n basset-hound

# View Logs
docker logs basset-hound-browser | tail -50

# Restart Service
docker restart basset-hound-browser
kubectl rollout restart deployment/basset-hound-browser -n basset-hound

# Scale
kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound

# Backup
./infrastructure/scripts/backup-automation.sh --full

# Escalate
/page @senior-oncall "Need help with [issue]"
```

---

## Additional Resources

### Related Documentation
- [Infrastructure README](../infrastructure/README.md) - Container orchestration details
- [API Reference](../API-REFERENCE.md) - WebSocket API documentation
- [SECURITY.md](../SECURITY.md) - Security features and configuration
- [PERFORMANCE Baseline](../PERFORMANCE-BASELINE-SUMMARY.md) - Performance characteristics

### External Links
- **Status Page**: https://status.basset-hound.example.com
- **Incident Tracker**: https://github.com/basset-hound/browser/issues
- **Metrics Dashboard**: http://grafana.basset-hound.example.com
- **On-Call Schedule**: https://calendar.google.com/basset-hound-oncall

### Support Contacts
- **Slack**: #basset-hound-ops
- **Email**: ops-oncall@basset-hound.example.com
- **On-Call**: See PagerDuty schedule
- **Manager**: [Name] (ops-manager@basset-hound.example.com)

---

## Continuous Improvement

### How to Improve These Runbooks

Found an issue? Want to add a section?

1. **Report issues**: [GitHub Issues](https://github.com/basset-hound/browser/issues)
2. **Suggest improvements**: [Discussion Forum](https://github.com/basset-hound/browser/discussions)
3. **Contribute corrections**: Pull requests welcome
4. **Share knowledge**: Post lessons learned in #basset-hound-ops

### Runbook Update Process

- **Monthly review**: First Monday of month
- **Quarterly deep-dive**: Comprehensive audit
- **Incident-triggered**: Update if incident reveals gaps
- **Version locked**: Each version (12.7.0) has specific runbooks

**Current runbook version**: 12.7.0  
**Last reviewed**: June 21, 2026  
**Next review**: July 21, 2026

---

## Acknowledgments

These runbooks were created based on:
- Production deployment experience (v12.0.0 - v12.7.0)
- Real incident response patterns
- Community feedback and contributions
- Best practices from industry leaders

**Maintainers**:
- DevOps Team
- SRE Team
- Platform Engineering

**Contributors**: All team members who reported issues and shared improvements

---

## License

These operational runbooks are part of Basset Hound Browser project.
See LICENSE file in project root for usage terms.

---

**Last updated**: June 21, 2026  
**Maintained by**: DevOps & SRE Team  
**For issues**: #basset-hound-ops or ops-oncall@basset-hound.example.com
