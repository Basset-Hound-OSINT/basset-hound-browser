# Development Blacklist
**Last Updated:** June 20, 2026  
**Status:** Active - Enforce for all development planning

---

## Overview
This document defines work items and initiatives that are **explicitly blacklisted** from development. These items are out of scope because the project has adopted an API-first architecture that prioritizes simplicity, maintainability, and user empowerment.

---

## Blacklisted Items

### 1. SDK Development (ALL LANGUAGES)

#### Item: Python SDK (basset-hound-python-client)
- **Status:** BLACKLISTED
- **Reason:** API-first approach with auto-generated documentation allows users to write Python scripts directly
- **Current State:** Any existing Python SDK code is deprecated and should not be maintained
- **Action:** Users should migrate to direct WebSocket API integration using standard `websocket` libraries
- **Alternative:** Example Python scripts demonstrating common patterns

#### Item: JavaScript/Node.js Client Library (basset-hound-js-client)
- **Status:** BLACKLISTED
- **Reason:** Users can implement JavaScript clients using standard `ws` library and auto-generated API docs
- **Current State:** Any existing JS client libraries are deprecated
- **Action:** Users should migrate to direct WebSocket integration
- **Alternative:** Example JavaScript/Node.js scripts with common integration patterns

#### Item: Go Client Library (basset-hound-go-client)
- **Status:** BLACKLISTED
- **Reason:** Auto-generated OpenAPI allows Go developers to generate clients or write directly
- **Current State:** Not started and should not be initiated
- **Action:** Do not implement
- **Alternative:** Example Go scripts demonstrating integration patterns

#### Item: Java/Spring Framework Client
- **Status:** BLACKLISTED
- **Reason:** Java ecosystem has excellent WebSocket libraries; users can integrate directly
- **Current State:** Not started and should not be initiated
- **Action:** Do not implement
- **Alternative:** Spring Boot example application showing browser integration

#### Item: Ruby SDK (basset-hound-ruby-gem)
- **Status:** BLACKLISTED
- **Reason:** Users leverage `websocket-client` gem with auto-generated API reference
- **Current State:** Not started and should not be initiated
- **Action:** Do not implement
- **Alternative:** Example Ruby scripts for common use cases

#### Item: PHP Client Library
- **Status:** BLACKLISTED
- **Reason:** PHP developers can use standard WebSocket libraries
- **Current State:** Not started and should not be initiated
- **Action:** Do not implement
- **Alternative:** Example PHP scripts for web integration

#### Item: .NET/C# Client
- **Status:** BLACKLISTED
- **Reason:** .NET has excellent WebSocket support; users can integrate directly
- **Current State:** Not started and should not be initiated
- **Action:** Do not implement
- **Alternative:** C# example application demonstrating integration

### 2. Managed Cloud Hosting

#### Item: Basset Hound Cloud Platform
- **Status:** BLACKLISTED
- **Reason:** Browser is designed as self-hosted or user-deployed via Docker
- **Current State:** Not in development
- **Action:** Do not implement cloud hosting service
- **Alternative:** Docker Compose and Kubernetes examples for user deployment

#### Item: SaaS Offering (Hosted Browser as a Service)
- **Status:** BLACKLISTED
- **Reason:** Fundamentally misaligned with forensic research use cases (data sovereignty, audit trails, etc.)
- **Current State:** Not in development
- **Action:** Do not pursue
- **Rationale:** Forensic users need full control over their data and infrastructure

#### Item: AWS/GCP/Azure Marketplace Listing
- **Status:** BLACKLISTED
- **Reason:** These are vendor lock-in risks; users deploy on their own infrastructure
- **Current State:** Not in development
- **Action:** Do not implement
- **Alternative:** Official Docker images on Docker Hub, users deploy to their cloud

### 3. Intelligence & Analysis Features

#### Item: Built-in OSINT Analysis
- **Status:** BLACKLISTED
- **Reason:** Intelligence analysis belongs in external tools, not the browser
- **Current State:** Any built-in analysis logic should be removed
- **Action:** Focus on forensic data extraction only; external systems handle analysis
- **Rationale:** Clear separation of concerns - browser extracts data, external tools analyze

#### Item: Machine Learning Models (Integrated)
- **Status:** BLACKLISTED
- **Reason:** ML models should be external services accessed via WebSocket, not embedded
- **Current State:** Bot evasion ML is external prediction service, not embedded
- **Action:** Keep external, accessible via WebSocket API commands
- **Rationale:** Easier versioning, updates, and specialized ML infrastructure

#### Item: Pattern Detection Engine
- **Status:** BLACKLISTED
- **Reason:** Pattern detection is analysis, not forensic collection
- **Current State:** Any pattern detection code belongs in external forensic tools
- **Action:** Remove from core browser; focus on data extraction
- **Rationale:** Browser extracts raw data; external tools detect patterns

#### Item: Threat Intelligence Integration
- **Status:** BLACKLISTED
- **Reason:** Integration with Shodan, Maltego, Censys, etc. belongs in external layer
- **Current State:** Any threat intel integrations should be removed
- **Action:** Keep browser as data provider; external tools integrate threat intel
- **Rationale:** Browser focuses on forensic data collection, not intelligence aggregation

#### Item: Automated Incident Classification
- **Status:** BLACKLISTED
- **Reason:** Classification and decision-making is analysis, not forensics
- **Current State:** Should not be implemented
- **Action:** Do not implement
- **Rationale:** Browser provides raw forensic data; external systems classify and respond

### 4. Case & Investigation Management

#### Item: Built-in Investigation Dashboard
- **Status:** BLACKLISTED
- **Reason:** Case management belongs in specialized external tools, not the browser
- **Current State:** Any dashboard should be kept minimal (operational only)
- **Action:** Remove investigative features; keep only operational monitoring
- **Rationale:** Separate tools handle investigation workflows

#### Item: Case Storage & Retrieval System
- **Status:** BLACKLISTED
- **Reason:** Data storage belongs in external systems, not the browser
- **Current State:** Should not be implemented
- **Action:** Do not implement
- **Rationale:** Browser is ephemeral; external tools persist investigation data

#### Item: Collaborative Investigation Features
- **Status:** BLACKLISTED
- **Reason:** Collaboration belongs in external investigation platforms
- **Current State:** Should not be implemented
- **Action:** Do not implement
- **Rationale:** Browser focuses on forensic extraction; external tools handle teamwork

#### Item: Audit Trail & Accountability System
- **Status:** BLACKLISTED
- **Reason:** Audit should be at the container/deployment level, not the browser
- **Current State:** Log API calls, not investigation workflows
- **Action:** Keep browser logs minimal; external systems handle audit logs
- **Rationale:** Better handled by deployment infrastructure and external systems

---

## What We DO Instead

### For Users Who Need SDKs
✅ **Auto-Generated API Documentation** (OpenAPI/Swagger)  
✅ **Example Scripts** in Python, JavaScript, Go, Java, etc.  
✅ **Integration Guides** for popular frameworks  
✅ **Clear Error Messages** to support integration  

Users can:
- Generate their own client code from OpenAPI spec
- Use standard WebSocket libraries in any language
- Copy and modify example scripts
- Contribute community-maintained SDKs

### For Users Who Need Cloud Hosting
✅ **Docker Image** for self-hosting  
✅ **Docker Compose Examples** for local/multi-instance deployment  
✅ **Kubernetes Manifests** for container orchestration  
✅ **Deployment Automation Scripts** for user infrastructure  

Users can:
- Deploy to AWS, GCP, Azure using Docker
- Use container orchestration platforms
- Scale to multiple instances
- Maintain full data sovereignty

### For Users Who Need Analysis
✅ **High-Quality Forensic Data Extraction** (100+ WebSocket commands)  
✅ **Raw Data Access** without filtering or interpretation  
✅ **Forensic Evidence Export** (HAR, screenshots, metadata, etc.)  
✅ **Integration Support** for analysis tools  

Users can:
- Write analysis scripts in their language
- Integrate with specialized analysis platforms
- Build custom intelligence workflows
- Maintain control over analysis logic

### For Users Who Need Case Management
✅ **Forensic Data Extraction** as core capability  
✅ **Export Formats** that integrate with case management tools  
✅ **Scriptable API** for workflow automation  
✅ **Examples** showing investigation patterns  

Users can:
- Use specialized case management platforms
- Build custom investigation workflows
- Integrate with existing business systems
- Maintain continuity across tools

---

## Enforcement

### For Planning
- Check this document before proposing new features
- **If the feature is blacklisted, propose an alternative approach** (examples, guides, API improvements)
- Escalate API-first architecture questions to project leadership

### For Implementation
- Do not start development on blacklisted items
- If a PR touches blacklisted code, request removal or refactoring
- Monitor repositories for accidental blacklisted code
- Remove deprecated SDK code in scheduled cleanup cycles

### For Agent Prompts
**All agent development instructions should include:**

> SDK development is BLACKLISTED. Focus on API quality and auto-generated documentation instead. If a feature requires an SDK, propose alternatives: (1) auto-generated client from OpenAPI, (2) example scripts in multiple languages, (3) integration guide for a specific framework.

---

## Historical Context

### Why This Decision?
1. **Reduced Maintenance Burden:** Managing SDKs across multiple languages is expensive
2. **User Empowerment:** Developers prefer control over standardized libraries
3. **Faster Innovation:** API improvements don't require SDK updates
4. **Clear Separation of Concerns:** Browser = forensic extraction; External tools = analysis/management
5. **Language Agnostic:** Auto-generated docs + examples work for any language

### What Changed?
- **Before:** Development included SDK maintenance for Python, JavaScript, and other languages
- **After:** API-first approach with auto-generated documentation and example scripts
- **Result:** Faster releases, reduced maintenance, better user autonomy

### Transition Period
- Existing SDKs deprecated; users migrate to direct WebSocket integration
- Example scripts provide migration guides
- Auto-generated API documentation is the source of truth
- Community can maintain SDKs independently

---

## Review & Updates

**Last Reviewed:** June 20, 2026  
**Next Review:** September 20, 2026 (quarterly)  
**Owner:** Project Architecture Team  
**Status:** Active and Enforced

---

## See Also
- `/docs/PROJECT-SCOPE.md` - Core project scope and principles
- `/docs/FORENSIC-FEATURES-ROADMAP.md` - Feature development roadmap with architectural decisions
- `/docs/API-REFERENCE.md` - WebSocket API command reference
- `/docs/DEPLOYMENT-AUTOMATION-GUIDE-v12.7.0.md` - Docker deployment and automation

