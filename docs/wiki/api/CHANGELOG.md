# API Changelog & Version History

**Canonical Source:** [/docs/API-VERSIONS.md](../../API-VERSIONS.md)  
**This File:** Wiki-local reference version  
**Last Updated:** June 22, 2026

---

## Quick Version Info

| Version | Release Date | Status | Support |
|---------|--------------|--------|---------|
| 12.8.0 | 2026-06-21 | Current | Full |
| 12.7.0 | 2026-05-20 | Maintenance | Security updates only |
| 12.6.0 | 2026-04-15 | Deprecated | None |

---

## v12.8.0 (Current - June 21, 2026)

**Status:** Production Ready  
**Stability:** ✅ 100% backward compatible with v12.7.0

### Features
- Full WebSocket API with 164 commands
- DOM Snapshot Extraction (7 commands)
- JavaScript & Console Extraction (10 commands)
- Forensic Commands Phase 1 (50 commands)
- Complete screenshot/video capture capabilities
- Session coherence validation (5-layer)
- Bot evasion framework (85-90% effectiveness)
- Residential proxy integration (3 rotation modes)

### Highlights
- Enhanced error handling and validation
- Improved command stability
- Better resource management
- Comprehensive forensic capabilities

### Breaking Changes
- **None** - Fully compatible with v12.7.0

### Documentation
See [API-DOCUMENTATION-SUMMARY.md](../../API-DOCUMENTATION-SUMMARY.md) for complete overview

---

## v12.7.0 (May 20, 2026)

**Status:** Maintenance (security updates only)  
**Release Date:** May 20, 2026

### Features
- 91+ WebSocket commands
- Basic screenshot and navigation
- Session management
- Authentication support

### Breaking Changes
- None

### Deprecated in This Version
- Legacy command format (use new format)

### Migration Notes
- Upgrade recommended for bot evasion improvements
- No code changes required for existing integrations

---

## v12.6.0 and Earlier

**Status:** Unsupported  
**Recommendation:** Upgrade to v12.8.0 for production use

For detailed release notes on earlier versions, see `/docs/archive/deprecated/`

---

## Command Evolution

### Core Commands (Stable - v12.0.0+)
Always available, never change:
- **Navigation:** navigate, back, forward, reload
- **Interaction:** click, fill, type, hover, select
- **Content:** getHtml, getText, getLinks, getForms, getImages
- **Screenshots:** screenshot, elementScreenshot, fullPageScreenshot
- **Storage:** getCookies, setCookie, getLocalStorage, setLocalStorage

### Advanced Commands (v12.7.0+)
Stable, recommended for new code:
- **Video Capture:** startVideoRecording, stopVideoRecording
- **JavaScript Execution:** executeScript, executeAsyncScript
- **Network Interception:** interceptRequests, blockRequests, setRequestHeaders
- **Console Capture:** getConsoleLogs, monitorConsole
- **DOM Snapshots:** captureSnapshot, compareDOMSnapshots

### Forensic Commands (v12.8.0+)
Latest features, production-ready:
- **Evidence Collection:** captureForensicEvidence, exportForensicPackage
- **Behavioral Analysis:** analyzeUserBehavior, detectBotSignals
- **Metadata Extraction:** extractMetadata, analyzePageMetadata
- **Content Fingerprinting:** generateFingerprint, analyzeFingerprints

---

## Deprecation Policy

### Timeline
1. **Current Version (12.8.0):** All features supported
2. **N-1 Versions (12.7.0):** Receive security updates only
3. **N-2 and Earlier (12.6.0):** Deprecated, no support

### Migration Path
1. Check [INTEGRATION-GUIDE.md](../../INTEGRATION-GUIDE.md) for updated patterns
2. Review [EXAMPLES.md](../../EXAMPLES.md) for current best practices
3. Test thoroughly before deploying to production

### Breaking Change Process
Breaking changes will be announced 30 days in advance via:
1. API documentation updates
2. Deprecation notices in responses
3. GitHub releases
4. Integration guide updates

---

## API Stability Guarantees

### Guaranteed Stable
✅ Command names and parameters (core commands)  
✅ Response JSON schema  
✅ Error codes and messages  
✅ WebSocket message format  
✅ Authentication mechanisms

### Subject to Enhancement
⚠️ Command options (new optional parameters may be added)  
⚠️ Response payloads (new optional fields may be added)  
⚠️ Performance characteristics  
⚠️ Internal implementation details

---

## Support Matrix

| Version | Release Date | Support Status | Security Updates | Bug Fixes |
|---------|--------------|----------------|------------------|-----------|
| 12.8.0 | 2026-06-21 | Current | Yes | Yes |
| 12.7.0 | 2026-05-20 | Maintenance | Yes | No |
| 12.6.0 | 2026-04-15 | Deprecated | No | No |
| 12.5.0 | 2026-03-20 | Unsupported | No | No |
| Earlier | - | Unsupported | No | No |

---

## Upgrade Guide

### From 12.7.0 → 12.8.0

**No action required** - Breaking changes: None

1. Pull latest code
2. Run `npm install` to get updated dependencies
3. Test existing integrations (should work as-is)
4. Consider using new features (forensic commands, enhanced errors)

### From 12.6.0 → 12.8.0

**Recommended** - Minor code changes may be needed

1. Review [API-VERSIONS.md](../../API-VERSIONS.md) for changes between versions
2. Check [EXAMPLES.md](../../EXAMPLES.md) for updated usage patterns
3. Test integrations thoroughly
4. Deploy with monitoring enabled

### From 12.5.0 or Earlier → 12.8.0

**Major upgrade** - Recommend staged migration

1. Plan migration (see [INTEGRATION-GUIDE.md](../../INTEGRATION-GUIDE.md))
2. Set up staging environment
3. Test all integrations
4. Plan rollback procedure
5. Deploy to production during low-traffic period

---

## Release Cadence

**Current:** Minor releases every 4-6 weeks  
**Patch releases:** As needed for bugs/security  
**Major versions:** Annually (or less frequently)

### v12.9.0 Planning (Expected: July 2026)
- Performance optimizations
- Additional evasion vectors
- Enhanced monitoring capabilities

---

## Known Issues

### v12.8.0
- No known critical issues
- See [API-VERSIONS.md](../../API-VERSIONS.md) for edge cases

### v12.7.0
- Deprecated - upgrade to v12.8.0 recommended

---

## Changelog Detail

For complete detailed changelog information:

**See:** [API-VERSIONS.md](../../API-VERSIONS.md) (canonical source)

This file provides highlights. The canonical version history in the root `/docs/` directory contains:
- Detailed feature descriptions by version
- Complete breaking change history
- Deprecation timelines
- Migration notes

---

## Getting Help

**Finding what changed:**
1. Check this changelog for recent versions
2. Review [API-VERSIONS.md](../../API-VERSIONS.md) for detailed history
3. See [API-DOCUMENTATION-INDEX.md](../../API-DOCUMENTATION-INDEX.md) for migration guides

**Upgrading versions:**
1. Review migration notes above
2. Check [INTEGRATION-GUIDE.md](../../INTEGRATION-GUIDE.md) for deployment patterns
3. Test thoroughly in staging environment

**Reporting issues:**
- GitHub issues for bugs
- [QUICK-START-GUIDE.md](../../QUICK-START-GUIDE.md) troubleshooting section for common problems

---

**Last Updated:** June 22, 2026  
**API Version:** 12.8.0  
**Status:** Production Ready
