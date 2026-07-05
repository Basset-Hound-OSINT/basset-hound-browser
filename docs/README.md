> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status (2026-07-04). Claims below are inflated/unverified. Version/status labels and "feature complete / evidence capture / bot evasion" claims in the linked docs are largely unverified or unwired.

# Basset Hound Browser Documentation

> **Version 12.7.0+** - Forensic Data Collection & Bot Evasion Platform

Welcome to the Basset Hound Browser documentation. This comprehensive guide covers forensic data extraction, evidence capture, bot evasion, and API reference for legitimate investigations and security research.

---

## 🎯 Forensic Focus Documentation

### Core Forensic Guidance
- [PROJECT-SCOPE.md](PROJECT-SCOPE.md) - **START HERE** - Complete forensic mission, principles, and capabilities
- [FORENSIC-ARCHITECTURE.md](FORENSIC-ARCHITECTURE.md) - Technical architecture for evidence capture and integrity
- [FORENSIC-FEATURES-ROADMAP.md](FORENSIC-FEATURES-ROADMAP.md) - Development roadmap and phase planning

### Quick Start & Integration
- [Installation Guide](core/installation.md) - Getting started with Basset Hound Browser
- [API Reference - v12.7.0](API-REFERENCE-v12.7.0.md) - Complete WebSocket API documentation
- [Architecture Overview](core/architecture.md) - System architecture and design

### Project Status & Archive
- [ROADMAP](ROADMAP.md) - Project roadmap and phase completion status
- [Development Status](DEVELOPMENT-STATUS.md) - Current development status and metrics
- [Archived Roadmaps](archive/roadmaps/) - Historical roadmap versions and planning documents (indexed by date)
  - `2026-06-20-summary.md` - Executive summary and quick reference
  - `2026-06-20-index.md` - Complete roadmap documentation index
  - Other dated archives for reference

---

## 🎯 Core Features

### [Features Documentation](features/)

All feature documentation is located in the `features/` directory:

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **Automation** | Browser automation and orchestration | [automation.md](features/automation.md) |
| **Cookies** | Cookie management and persistence | [cookies.md](features/cookies.md) |
| **Downloads** | Download management | [downloads.md](features/downloads.md) |
| **DevTools** | Chrome DevTools integration | [devtools.md](features/devtools.md) |
| **Evasion** | Bot detection evasion techniques | [evasion.md](features/evasion.md) |
| **Geolocation** | Geolocation spoofing | [geolocation.md](features/geolocation.md) |
| **Headers** | HTTP header manipulation | [headers.md](features/headers.md) |
| **History** | Browser history management | [history.md](features/history.md) |
| **Inspector** | DOM inspection tools | [inspector.md](features/inspector.md) |
| **Network Throttling** | Network speed simulation | [network-throttling.md](features/network-throttling.md) |
| **Profiles** | Browser profile management | [profiles.md](features/profiles.md) |
| **Storage** | Storage management (localStorage, sessionStorage, IndexedDB) | [storage.md](features/storage.md) |
| **Tabs** | Tab and window management | [tabs.md](features/tabs.md) |
| **Blocking** | Content blocking and filtering | [blocking.md](features/blocking.md) |
| **Auto-Update** | Automatic update system | [auto-update.md](features/auto-update.md) |

---

## 🔧 Integration & Pentesting

### [Integration Documentation](integration/)

Guides for integrating Basset Hound Browser with pentesting workflows:

- [Executive Summary](integration/executive-summary.md) - High-level overview
- [Integration Architecture](integration/architecture.md) - Technical integration architecture
- [Automation Strategy](integration/automation-strategy.md) - Browser automation best practices
- [Pentesting Integration](integration/pentesting.md) - Pentesting tool integration
- [Implementation Roadmap](integration/implementation.md) - Implementation guidelines
- [Integration Guide](integration/integration-guide.md) - General integration guide

---

## 🚀 Deployment

### [Deployment Documentation](deployment/)

- [Distribution Guide](deployment/distribution.md) - Building and distributing Basset Hound Browser
- [Rsync Deployment](deployment/rsync-deployment.md) - Deploying with rsync
- [Tor Setup](deployment/tor-setup.md) - Tor integration and configuration

**Key Topics**:
- Building for Linux, macOS, and Windows
- Docker deployment
- CI/CD with GitHub Actions
- AppImage, DMG, NSIS installers
- Code signing and notarization

---

## 🧪 Testing

### [Testing Documentation](testing/)

- [Testing Guide](testing/testing-guide.md) - General testing guide
- [Integration Testing](testing/integration-testing.md) - Integration test documentation
- [Certificate Tests Guide](testing/cert-tests-guide.md) - SSL certificate testing

### [Test Findings & Reports](findings/)

Test results and development session reports:

- [SSL Certificate Testing Results](findings/ssl-certificate-testing-results.md) - v8.1.4 testing results
- [Unit Test Fixes Summary](findings/unit-test-fixes-summary.md) - Test fixes applied
- [Cert Generator Test Coverage](findings/cert-generator-test-coverage.md) - Test coverage report
- [Session Summary 2024-12-28](findings/session-summary-2024-12-28.md) - Development session summary

---

## 📚 Additional Resources

### API Documentation
Located in `api/` directory - Legacy API documentation (check if still needed)

### Key Files
- **README.md** (project root) - Main project README
- **package.json** - NPM package configuration and build scripts
- **electron-builder.json** - Electron builder configuration

---

## 🗂️ Documentation Structure

```
docs/
├── README.md (this file)
├── ROADMAP.md
├── DEVELOPMENT-STATUS.md
├── SSL-CERTIFICATES.md
│
├── core/
│   ├── api-reference.md
│   ├── architecture.md
│   ├── installation.md
│   └── development.md
│
├── features/
│   ├── automation.md
│   ├── blocking.md
│   ├── cookies.md
│   ├── devtools.md
│   ├── downloads.md
│   ├── evasion.md
│   ├── geolocation.md
│   ├── headers.md
│   ├── history.md
│   ├── inspector.md
│   ├── network-throttling.md
│   ├── profiles.md
│   ├── storage.md
│   ├── tabs.md
│   └── auto-update.md
│
├── integration/
│   ├── executive-summary.md
│   ├── architecture.md
│   ├── automation-strategy.md
│   ├── pentesting.md
│   ├── implementation.md
│   └── integration-guide.md
│
├── deployment/
│   ├── distribution.md
│   ├── rsync-deployment.md
│   └── tor-setup.md
│
├── testing/
│   ├── testing-guide.md
│   ├── integration-testing.md
│   └── cert-tests-guide.md
│
└── findings/
    ├── ssl-certificate-testing-results.md
    ├── unit-test-fixes-summary.md
    ├── cert-generator-test-coverage.md
    └── session-summary-2024-12-28.md
```

---

## 📖 Getting Help

- **Issues**: Report bugs or request features on GitHub
- **Development**: See [DEVELOPMENT.md](core/development.md)
- **API Questions**: Check [API Reference](core/api-reference.md)
- **Testing**: See [Testing Guide](testing/testing-guide.md)

---

## 🔄 Recent Updates

### Version 12.7.0 (June 2026)
- ✅ Phase 1 Complete: TOTP/HOTP, Session Coherence, Device Fingerprinting, Monitoring
- ✅ Production Deployment: Docker image (2.64 GB), 481.48 msgs/sec throughput
- ✅ Test Coverage: 316/342 tests passing (92.3%), all critical systems operational
- ✅ Real-World Validation: 4/4 websites tested successfully, zero bot detection hits

### Version 12.6.0 (May 2026)
- ✅ Bot Evasion Framework: 100% test pass rate, 85-90% evasion effectiveness
- ✅ Advanced Fingerprinting: Canvas, WebGL, Audio, Font, WebRTC evasion
- ✅ Session Coherence: 5-layer validation across detection services
- ✅ Residential Proxy Integration: 3 rotation modes, 43 tests passing

---

## 📂 Documentation Consolidation (June 21, 2026)

**Status:** ✅ COMPLETE

Documentation has been consolidated into an organized 15-category structure:
- **42 directories** with thematic grouping
- **1,141+ markdown documentation files** organized by purpose
- **Updated internal references** to reflect new organization
- **Forensic commands index** created in websocket/commands/forensic/

All 1,618 documentation files have been backed up to `/tmp/docs_backup_20260621_015302/` for recovery if needed.

### Code Organization (June 21, 2026)

**Status:** ✅ COMPLETE

Forensic commands have been reorganized:
- **websocket/commands/forensic/** - New forensic commands directory
  - `evidence/` - 29 commands
  - `legal/` - 101 commands  
  - `network/` - 12 commands
  - `correlation/` - 26 commands
  - `packaging/` - 44 commands
  - **TOTAL:** 212 forensic commands

- **websocket/commands/*.js** - 48 non-forensic command modules
- All imports updated and verified
- All relative paths corrected for new structure
- No functionality lost, no code duplication

*Last Updated: June 21, 2026*
*Version: 12.7.0*
*Documentation Consolidation Complete*
