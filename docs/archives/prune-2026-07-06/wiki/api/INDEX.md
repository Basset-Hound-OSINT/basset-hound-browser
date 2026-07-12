# API Reference - /docs/wiki/api/

Complete WebSocket API documentation for browser control integration.

## Canonical API Documentation (Primary Reference)

**Start here for authoritative information:**

- **Overview & Navigation:** [API-DOCUMENTATION-SUMMARY.md](../../API-DOCUMENTATION-SUMMARY.md) — Feature overview, version info, audience routing
- **Specification:** [openapi.yaml](../../openapi.yaml) — Complete OpenAPI 3.0.3 spec with all 164 commands
- **Version History:** [API-VERSIONS.md](../../API-VERSIONS.md) — Changelog, breaking changes, deprecation policy
- **Getting Started:** [QUICK-START-GUIDE.md](../../QUICK-START-GUIDE.md) — Installation, first command, 5-10 minutes
- **Code Examples:** [EXAMPLES.md](../../EXAMPLES.md) — Working examples in Node.js, Python, cURL
- **Deployment:** [INTEGRATION-GUIDE.md](../../INTEGRATION-GUIDE.md) — Production setup, SDKs, monitoring

**Complete Index:** See [API-DOCUMENTATION-INDEX.md](../../API-DOCUMENTATION-INDEX.md) for navigation by use case

---

## Wiki Reference Files (Detailed Organization)

This directory provides detailed reference organized by topic:

- `OVERVIEW.md` - API overview and core concepts
- `COMPLETE-REFERENCE.md` - Command listing organized by type
- `COMMAND-CATEGORIES.md` - Commands organized by functional category
- `WEBSOCKET-PROTOCOL.md` - WebSocket protocol specifications and details
- `ERROR-CODES.md` - Error codes, status codes, and troubleshooting

## Quick Facts

- **Commands:** 164 WebSocket operations
- **Protocol:** WebSocket (default port 8765)
- **Features:** Navigation, extraction, screenshots, bot evasion, fingerprinting, proxy control
- **Response Format:** JSON with structured error handling
- **Authentication:** Token-based session management

## Command Categories

The API is organized into functional categories:
- Navigation and page control
- Content extraction and inspection
- Screenshots and visual capture
- Bot detection evasion
- Device fingerprinting
- Proxy and network management
- Session and profile management
- Monitoring and metrics

## Finding What You Need

| I want to... | Go to... | Time |
|---|---|---|
| Get started quickly | [QUICK-START-GUIDE.md](../../QUICK-START-GUIDE.md) | 5-10 min |
| See code examples | [EXAMPLES.md](../../EXAMPLES.md) | Varies |
| Understand all features | [API-DOCUMENTATION-SUMMARY.md](../../API-DOCUMENTATION-SUMMARY.md) | 15 min |
| Find a specific command | [openapi.yaml](../../openapi.yaml) or [COMPLETE-REFERENCE.md](COMPLETE-REFERENCE.md) | 2-5 min |
| Deploy to production | [INTEGRATION-GUIDE.md](../../INTEGRATION-GUIDE.md) | 30+ min |
| Check version info | [API-VERSIONS.md](../../API-VERSIONS.md) | 5 min |
| Learn the protocol | [WEBSOCKET-PROTOCOL.md](WEBSOCKET-PROTOCOL.md) | 10 min |
| Understand errors | [ERROR-CODES.md](ERROR-CODES.md) | 5 min |

---

**Architecture:** Hub-and-spoke model  
**Hub:** `/docs/` canonical documents (single source of truth)  
**Spokes:** `/docs/wiki/api/` reference documents (detailed organization)  
**Archive:** `/docs/archive/deprecated/` (historical reference)  

**Total Files:** 11 (6 here + 5 canonical) | **Purpose:** API Documentation | **Updated:** 2026-06-22
