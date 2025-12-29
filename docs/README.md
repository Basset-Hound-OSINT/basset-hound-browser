# Basset Hound Browser Documentation

> **Version 8.1.4** - Advanced Browser Automation & Pentesting Platform

Welcome to the Basset Hound Browser documentation. This comprehensive guide covers all aspects of the browser automation platform, from basic usage to advanced pentesting integration.

---

## 📋 Table of Contents

### Quick Start
- [Installation Guide](core/installation.md) - Getting started with Basset Hound Browser
- [API Reference](core/api-reference.md) - Complete WebSocket API documentation
- [Architecture Overview](core/architecture.md) - System architecture and design
- [Development Guide](core/development.md) - Contributing and development setup

### Project Status
- [ROADMAP](ROADMAP.md) - Project roadmap and phase completion status
- [Development Status](DEVELOPMENT-STATUS.md) - Current development status and metrics
- [SSL Certificates](SSL-CERTIFICATES.md) - SSL certificate auto-generation (v8.1.4)

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

### Version 8.1.4 (December 2024)
- ✅ SSL Certificate Auto-Generation
- ✅ Comprehensive test suite for certificate management
- ✅ Documentation reorganization
- ✅ Unit test fixes (profiles, storage, SSL connection)

### Version 8.1.3 (December 2024)
- ✅ Test suite improvements (903/1011 passing)
- ✅ Fixed randomness-based test tolerances
- ✅ Platform-dependent test improvements

### Version 8.1.2 (December 2024)
- ✅ Security fixes verification
- ✅ IPC timeout handling
- ✅ JSON escaping for injection prevention

---

*Last Updated: December 28, 2024*
*Version: 8.1.4*
