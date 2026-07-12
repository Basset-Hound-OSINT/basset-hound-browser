# Basset Hound Browser - Modules Documentation Index
**Version:** 12.2.0
**Status:** Complete
**Total Modules Documented:** 44
**Last Updated:** June 13, 2026

## Module Documentation Organization

All source modules are documented with:
- Module purpose and scope
- File structure and key classes
- Public API reference
- Integration points
- Configuration options
- Common usage patterns
- Troubleshooting guide

---

## Core Modules (Essential)

### 1. Core Framework (6 files)
**Path:** `src/core/`
- **Purpose:** Core browser functionality and Electron integration
- **Key Files:** main.js, browser-context.js, event-dispatcher.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Core Module Guide](./core-module-guide.md)

### 2. Session Management (8 files)
**Path:** `src/session/` + `src/sessions/`
- **Purpose:** Browser session lifecycle, state persistence, coherence validation
- **Key Files:** session-manager.js, session-store.js, coherence-validator.js
- **Status:** Production-ready (v12.1+)
- **Features:** 5-layer coherence validation, persistent state, multi-instance support
- **Documentation:** [Session Management Guide](./session-management-guide.md)

### 3. WebSocket API (2 files)
**Path:** `src/api/`
- **Purpose:** External API interface, command routing, response handling
- **Key Files:** service-registry.js, api-router.js
- **Status:** Production-ready (v12.0+)
- **Commands:** 164 total WebSocket commands
- **Documentation:** [API Layer Guide](./api-layer-guide.md)

### 4. Authentication & Authorization (2 files)
**Path:** `src/auth/` + `src/authentication/`
- **Purpose:** Token-based authentication, role-based access control
- **Key Files:** auth-manager.js, token-validator.js
- **Status:** Production-ready (v12.1+)
- **Features:** JWT support, API key management, session tokens
- **Documentation:** [Authentication Guide](./authentication-guide.md)

---

## Bot Evasion & Anti-Detection (25 files)

### 5. Evasion Framework (14 files)
**Path:** `src/evasion/`
- **Purpose:** Multi-layer bot detection evasion
- **Key Files:** evasion-coordinator.js, fingerprint-profiles.js, behavior-simulator.js
- **Status:** Production-ready (v12.2+) - Advanced
- **Features:** Canvas/WebGL/WebRTC evasion, behavioral AI, detection service bypass
- **Effectiveness:** 85-90% against major detection services
- **Documentation:** [Evasion Framework Guide](./evasion-framework-guide.md)

### 6. Fingerprint Profiles (Advanced)
**Path:** `src/evasion/profiles/`
- **Purpose:** Device fingerprint spoofing and rotation
- **Key Files:** fingerprint-loader.js, profile-mixer.js
- **Status:** Production-ready (v12.1+)
- **Profiles:** 500+ realistic device profiles
- **Documentation:** [Fingerprinting Guide](./fingerprinting-guide.md)

### 7. Behavioral Simulation (1 file)
**Path:** `src/behavior/`
- **Purpose:** Human-like interaction simulation
- **Key Files:** behavior-simulator.js
- **Status:** Production-ready (v12.2+)
- **Features:** Natural click delays, scroll patterns, mouse movements
- **Documentation:** [Behavioral Simulation Guide](./behavioral-simulation-guide.md)

### 8. Detection Service Integration (11 files)
**Path:** `src/detection/`
- **Purpose:** Detection service abstraction and response handling
- **Key Files:** detection-provider.js, service-registry.js, honeypot-detector.js
- **Status:** Production-ready (v12.1+)
- **Services:** 20+ detection services integrated
- **Documentation:** [Detection Services Guide](./detection-services-guide.md)

---

## Network & Proxy Management (21 files)

### 9. Proxy Management (21 files)
**Path:** `src/proxy/`
- **Purpose:** Comprehensive proxy handling, rotation, and optimization
- **Key Files:** proxy-manager.js, rotation-strategy.js, tor-manager.js
- **Status:** Production-ready (v12.1+)
- **Features:** HTTP/HTTPS/SOCKS4/5, residential proxy rotation, Tor integration
- **Rotation Modes:** Geolocation-based, performance-based, sequential
- **Documentation:** [Proxy Management Guide](./proxy-management-guide.md)

### 10. Tor Integration (Part of Proxy)
**Features:** Master switch (ON/OFF/AUTO), circuit management, onion routing
- **Documentation:** [Tor Integration Guide](./tor-integration-guide.md)

### 11. Residential Proxy Rotation (Part of Proxy)
**Features:** 3 rotation modes, performance metrics, failure handling
- **Documentation:** See Proxy Management Guide

---

## Data Extraction & Analysis (18 files)

### 12. Data Extraction (3 files)
**Path:** `src/extraction/`
- **Purpose:** HTML/text/image/metadata extraction, DOM caching
- **Key Files:** dom-extractor.js, dom-cache.js, batch-extractor.js
- **Status:** Production-ready (v12.0+)
- **Cache:** Integrated DOM cache for performance
- **Documentation:** [Extraction Module Guide](./extraction-module-guide.md)

### 13. Analysis & Detection (7 files)
**Path:** `src/analysis/`
- **Purpose:** Technology detection, forensic analysis, signature detection
- **Key Files:** tech-detector.js, forensic-report-generator.js, signature-loader.js
- **Status:** Production-ready (v12.2+)
- **Features:** 2000+ tech signatures, forensic chain-of-custody, change detection
- **Documentation:** [Analysis Module Guide](./analysis-module-guide.md)

### 14. Reporting (1 file)
**Path:** `src/reporting/`
- **Purpose:** Report generation and formatting
- **Key Files:** report-generator.js
- **Status:** Production-ready (v12.0+)
- **Formats:** JSON, PDF, HTML, CSV
- **Documentation:** [Reporting Guide](./reporting-guide.md)

### 15. Data Processing (7 files)
**Path:** `src/data/`
- **Purpose:** Data transformation, validation, caching
- **Key Files:** data-processor.js, data-validator.js, cache-manager.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Data Processing Guide](./data-processing-guide.md)

---

## Performance & Optimization (19 files)

### 16. Performance Optimization (19 files)
**Path:** `src/optimization/`
- **Purpose:** Request deduplication, caching, batching, compression
- **Key Files:** request-deduplicator.js, message-batcher.js, buffer-manager.js
- **Status:** Production-ready (v12.0+)
- **Improvements:** 70-93% compression, 22-27% throughput gain, 60-80% memory reduction
- **Documentation:** [Performance Optimization Guide](./performance-optimization-guide.md)

---

## Infrastructure & Operations (32 files)

### 17. Infrastructure Layer (9 files)
**Path:** `src/infrastructure/`
- **Purpose:** Container orchestration, health checks, resource management
- **Key Files:** container-manager.js, health-check.js, resource-monitor.js
- **Status:** Production-ready (v12.0+)
- **Features:** Docker support, Kubernetes-ready, multi-instance coordination
- **Documentation:** [Infrastructure Guide](./infrastructure-guide.md)

### 18. Monitoring & Observability (25 files)
**Path:** `src/monitoring/` + `src/observability/`
- **Purpose:** Performance metrics, health monitoring, observability
- **Key Files:** metrics-collector.js, health-monitor.js, event-logger.js
- **Status:** Production-ready (v12.1+)
- **Metrics:** 50+ monitored metrics, real-time dashboards
- **Documentation:** [Monitoring & Observability Guide](./monitoring-observability-guide.md)

### 19. Queuing & Message Handling (4 files)
**Path:** `src/queuing/`
- **Purpose:** Message queuing, priority handling, batch processing
- **Key Files:** queue-manager.js, priority-queue.js, message-handler.js
- **Status:** Production-ready (v12.0+)
- **Features:** Priority queues, batch coalescing, flow control
- **Documentation:** [Queuing Guide](./queuing-guide.md)

### 20. Task Scheduling (2 files)
**Path:** `src/tasks/`
- **Purpose:** Background job scheduling, task management
- **Key Files:** task-scheduler.js, background-jobs.js
- **Status:** Production-ready (v12.1+)
- **Features:** Cron scheduling, job persistence, retry logic
- **Documentation:** [Task Scheduling Guide](./task-scheduling-guide.md)

---

## Integrations & Extensions (17 files)

### 21. Platform Integrations (9 files)
**Path:** `src/integrations/`
- **Purpose:** External platform integration (Slack, email, webhooks)
- **Key Files:** integration-manager.js, platform-adapter.js
- **Status:** Production-ready (v12.1+)
- **Platforms:** Slack, email, webhooks, cloud storage
- **Documentation:** [Integrations Guide](./integrations-guide.md)

### 22. Onboarding & Customer Success (8 files)
**Path:** `src/onboarding/`
- **Purpose:** User onboarding flows, configuration wizards, tutorials
- **Key Files:** onboarding-flow.js, setup-wizard.js
- **Status:** Production-ready (v12.1+)
- **Features:** Interactive onboarding, deployment validation
- **Documentation:** [Onboarding Guide](./onboarding-guide.md)

### 23. Support Systems (8 files)
**Path:** `src/support/`
- **Purpose:** Support portal, ticket management, escalation handling
- **Key Files:** support-portal.js, ticket-manager.js, sla-engine.js
- **Status:** Production-ready (v12.2+)
- **Features:** Ticket tracking, SLA monitoring, knowledge base
- **Documentation:** [Support Systems Guide](./support-systems-guide.md)

---

## Advanced Features (18 files)

### 24. Advanced Features (12 files)
**Path:** `src/advanced/`
- **Purpose:** Advanced capabilities (custom validators, forensics enhancements)
- **Key Files:** advanced-validator.js, forensic-enhancer.js
- **Status:** Production-ready (v12.2+)
- **Documentation:** [Advanced Features Guide](./advanced-features-guide.md)

### 25. Forensics & Evidence Management (3 files)
**Path:** `src/forensics/`
- **Purpose:** Evidence collection, chain of custody, forensic analysis
- **Key Files:** forensic-collector.js, chain-of-custody.js
- **Status:** Production-ready (v12.1+)
- **Features:** Immutable evidence logging, audit trails
- **Documentation:** [Forensics Guide](./forensics-guide.md)

### 26. Export & Data Management (8 files)
**Path:** `src/export/`
- **Purpose:** Data export, format conversion, multi-format output
- **Key Files:** export-manager.js, format-converter.js
- **Status:** Production-ready (v12.0+)
- **Formats:** JSON, CSV, PDF, XML, XLSX
- **Documentation:** [Export Guide](./export-guide.md)

### 27. Compliance Framework (3 files)
**Path:** `src/compliance/`
- **Purpose:** GDPR/HIPAA/SOC2 compliance validation
- **Key Files:** gdpr-compliance.js, hipaa-compliance.js, soc2-compliance.js
- **Status:** Production-ready (v12.1+)
- **Standards:** GDPR, HIPAA, SOC2, CCPA
- **Documentation:** [Compliance Guide](./compliance-guide.md)

---

## Utility & Support (24 files)

### 28. Caching Layer (6 files)
**Path:** `src/cache/` + `src/caching/`
- **Purpose:** Multi-level caching (memory, disk, distributed)
- **Key Files:** cache-manager.js, distributed-cache.js
- **Status:** Production-ready (v12.0+)
- **Strategy:** LRU with TTL, distributed coordination
- **Documentation:** [Caching Guide](./caching-guide.md)

### 29. Validation Framework (1 file)
**Path:** `src/validation/`
- **Purpose:** Input validation, schema enforcement
- **Key Files:** validator.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Validation Guide](./validation-guide.md)

### 30. Utility Functions (11 files)
**Path:** `src/utils/`
- **Purpose:** Helper functions, common utilities
- **Key Files:** string-utils.js, array-utils.js, crypto-utils.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Utilities Reference](./utilities-reference.md)

### 31. Services Layer (5 files)
**Path:** `src/services/`
- **Purpose:** Business logic services, domain operations
- **Key Files:** service-manager.js, operation-handler.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Services Guide](./services-guide.md)

---

## Specialized Modules (6 files)

### 32. Dark Web Integration (1 file)
**Path:** `src/darkweb/`
- **Purpose:** Tor hidden service investigation
- **Key Files:** tor-investigation.js
- **Status:** Production-ready (v12.1+)
- **Documentation:** [Dark Web Guide](./darkweb-guide.md)

### 33. Agent Orchestration (3 files)
**Path:** `src/agents/`
- **Purpose:** Multi-agent coordination, palletai integration
- **Key Files:** agent-coordinator.js, agent-pool.js
- **Status:** Production-ready (v12.2+)
- **Features:** Agent pooling, load balancing, fault tolerance
- **Documentation:** [Agent Orchestration Guide](./agent-orchestration-guide.md)

### 34. Dashboard Systems (7 files)
**Path:** `src/dashboard/` + `src/dashboards/`
- **Purpose:** Real-time dashboards, monitoring UI, metrics visualization
- **Key Files:** dashboard-engine.js, metric-renderer.js
- **Status:** Production-ready (v12.2+)
- **Dashboards:** Performance, Security, Operations, Analytics
- **Documentation:** [Dashboard Guide](../customer-success/DASHBOARD-GUIDE.md)

### 35. Streaming & Recording (4 files)
**Path:** `src/streaming/` + `src/recording/`
- **Purpose:** Event streaming, session recording, log streaming
- **Key Files:** stream-manager.js, recorder.js
- **Status:** Production-ready (v12.1+)
- **Documentation:** [Streaming & Recording Guide](./streaming-recording-guide.md)

### 36. Screenshot Management (2 files)
**Path:** `src/screenshots/`
- **Purpose:** Efficient screenshot capture and storage
- **Key Files:** enhanced-capture.js, parallel-processor.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Screenshots Guide](./screenshots-guide.md)

### 37. Search Functionality (2 files)
**Path:** `src/search/`
- **Purpose:** Full-text search, evidence discovery
- **Key Files:** search-engine.js, indexer.js
- **Status:** Production-ready (v12.1+)
- **Documentation:** [Search Guide](./search-guide.md)

### 38. Execution Environment (1 file)
**Path:** `src/execution/`
- **Purpose:** JavaScript execution context management
- **Key Files:** executor.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Execution Guide](./execution-guide.md)

### 39. Resource Pooling (1 file)
**Path:** `src/pool/`
- **Purpose:** Connection pool management
- **Key Files:** pool-manager.js
- **Status:** Production-ready (v12.0+)
- **Documentation:** [Pooling Guide](./pooling-guide.md)

### 40. Mesh Networking (1 file)
**Path:** `src/mesh/`
- **Purpose:** Peer-to-peer mesh communication
- **Key Files:** mesh-manager.js
- **Status:** Production-ready (v12.2+)
- **Documentation:** [Mesh Networking Guide](./mesh-networking-guide.md)

---

## Module Dependency Map

### Core Dependencies (All modules depend on)
- Core framework
- Utilities
- Validation

### Execution Dependencies
- Core → Session Management
- Session Management → Authentication
- Core → API Layer
- API Layer → All command handlers

### Feature Dependencies
- Evasion → Fingerprinting
- Evasion → Behavioral Simulation
- Evasion → Detection Services
- Proxy → Evasion (for coordinated rotation)
- Data Extraction → Analysis → Reporting

### Operational Dependencies
- All modules → Monitoring & Observability
- All modules → Queuing & Message Handling
- Infrastructure → Task Scheduling
- Integrations → Support Systems

---

## Quick Reference Tables

### Module Status Summary
| Category | Count | v12.2 Ready | Documentation |
|----------|-------|------------|-----------------|
| Core | 6 | ✓ | Complete |
| Bot Evasion | 25 | ✓ | Complete |
| Network | 21 | ✓ | Complete |
| Data Ops | 18 | ✓ | Complete |
| Performance | 19 | ✓ | Complete |
| Infrastructure | 32 | ✓ | Complete |
| Integrations | 17 | ✓ | Complete |
| Advanced | 18 | ✓ | Complete |
| Utilities | 24 | ✓ | Complete |
| Specialized | 6 | ✓ | Complete |
| **TOTAL** | **44** | **✓** | **Complete** |

### File Count by Category
- Core: 6 files
- Bot Evasion: 25 files
- Network & Proxy: 21 files
- Data & Analysis: 18 files
- Performance: 19 files
- Infrastructure: 32 files
- Integrations: 17 files
- Advanced: 18 files
- Utilities: 24 files
- Specialized: 6 files

---

## Documentation Navigation Guide

### For Developers
1. Start: [Core Module Guide](./core-module-guide.md)
2. Understand: [Module Dependency Map](#module-dependency-map)
3. Implement: Individual module guides for features needed

### For System Operators
1. Start: [Infrastructure Guide](./infrastructure-guide.md)
2. Deploy: [Deployment Guide](/docs/DEPLOYMENT-GUIDE.md)
3. Monitor: [Monitoring & Observability Guide](./monitoring-observability-guide.md)
4. Troubleshoot: [Module Troubleshooting Guides](./TROUBLESHOOTING-MODULES.md)

### For Security Teams
1. Start: [Security Hardening Guide](/docs/security/HARDENING-GUIDE.md)
2. Review: [Compliance Guide](./compliance-guide.md)
3. Implement: [Evasion & Detection Guides](./evasion-framework-guide.md)
4. Monitor: [Security Monitoring](../archives/prune-2026-07-06/wiki/deployment/MONITORING.md)

### For Integration Partners
1. Start: [Integrations Guide](./integrations-guide.md)
2. Design: [Custom Integration Guide](/docs/CUSTOM-INTEGRATION-GUIDE.md)
3. Implement: Platform-specific integration guides

---

## Related Documentation

- **API Reference:** `/docs/API-REFERENCE-COMPLETE.md`
- **Deployment Guide:** `/docs/DEPLOYMENT-GUIDE.md`
- **Performance Guide:** `/docs/advanced/PERFORMANCE-TUNING-GUIDE.md` (upcoming)
- **Security Guide:** `/docs/security/HARDENING-GUIDE.md`
- **Research:** `/docs/research/` (deep-dive analysis)

---

**Documentation Index Generated:** June 13, 2026
**Status:** Ready for production use
**Version Coverage:** v12.2.0 and earlier
