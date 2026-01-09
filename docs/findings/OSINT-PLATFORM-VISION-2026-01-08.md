# OSINT Platform Vision: basset-hound-browser Integration

**Date:** 2026-01-08
**Reference:** See `/home/devel/basset-hound/docs/findings/VISION-RESEARCH-2026-01-08.md` for comprehensive research

---

## Executive Summary

This document outlines the strategic integration of basset-hound-browser into the basset-hound OSINT investigation platform. The browser serves as the **automated browser with anti-detection capabilities** for AI agent-driven investigations.

---

## Project Scope

### Core Mission
- Provide full browser automation (navigate, click, fill, extract)
- Evade bot detection through comprehensive fingerprint spoofing
- Isolate browser profiles for sock puppet identity management
- Integrate proxy and Tor routing for anonymity
- Expose capabilities via MCP server for AI agent control

### NOT in Scope
- Entity storage and relationship management (handled by basset-hound)
- Chrome extension features for manual users (handled by autofill-extension)
- AI agent logic and decision making (handled by palletai)

---

## Integration Points

### With basset-hound (Entity Storage)
| Integration | Method | Purpose |
|-------------|--------|---------|
| Entity data fetch | REST API | Get sock puppet credentials for login |
| Data ingestion | REST API | Store extracted OSINT data |
| Provenance recording | REST API | Document capture source and method |

### With palletai (AI Agents)
| Integration | Method | Purpose |
|-------------|--------|---------|
| Browser control | MCP Server | AI agent navigates, fills forms, captures data |
| Profile management | MCP Server | AI agent switches sock puppet profiles |
| Evidence capture | MCP Server | AI agent triggers screenshots/archives |

### With autofill-extension
| Integration | Method | Purpose |
|-------------|--------|---------|
| Coordination | Message passing | Avoid conflicts when both active |
| Data sharing | Shared storage | Pass detected data to automation |

---

## Key Capabilities for OSINT

### 1. MCP Server for AI Agents (Roadmap Phase 15)
Expose browser automation as MCP tools for palletai agents:

| Tool | Description |
|------|-------------|
| `navigate(url)` | Navigate with anti-detection active |
| `fill_form(fields)` | Fill form fields with specified data |
| `fill_form_with_entity(entity_id)` | Auto-fill from basset-hound entity |
| `screenshot()` | Capture with metadata and hash |
| `extract_data()` | Extract OSINT data from current page |
| `ingest_to_entity(entity_id, data)` | Store extracted data to entity |

### 2. Sock Puppet Profile Integration (Roadmap Phase 16)
- Create isolated browser profiles per identity
- Link profiles to basset-hound SOCK_PUPPET entities
- Automatic fingerprint assignment per profile
- Proxy/Tor configuration per identity
- Session isolation and cookie management

### 3. Enhanced Bot Detection Evasion (Roadmap Phase 17)
- TLS/JA3 fingerprint rotation
- Behavioral AI simulation (human-like patterns)
- Dynamic fingerprint adaptation based on detection
- Residential proxy integration
- Detection monitoring and alerts

### 4. Evidence Collection (Roadmap Phase 18)
- Forensically-sound screenshot capture
- WARC format page archiving
- Hash verification for integrity
- Metadata preservation (timestamp, URL, profile)
- Chain of custody documentation

---

## Anti-Detection Status

### Currently Implemented
- Canvas fingerprint spoofing
- WebGL renderer/vendor spoofing
- Audio fingerprint spoofing
- Screen/timezone spoofing
- Human behavior simulation (Bezier curves)
- 70+ user agent rotation
- Proxy/Tor integration
- Profile isolation

### Gaps to Address (Phase 17)
- TLS/JA3 fingerprint spoofing
- Behavioral AI adaptation
- WebRTC leak prevention
- Font fingerprint spoofing

---

## Sock Puppet Workflow

```
┌─────────────────┐
│ palletai Agent  │
│ needs to login  │
│ as sock puppet  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Query basset-   │────▶│ Get SOCK_PUPPET  │
│ hound for       │     │ entity with      │
│ identity        │     │ credentials      │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Browser MCP:    │────▶│ Load isolated    │
│ switch_profile  │     │ browser profile  │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Browser MCP:    │────▶│ Navigate with    │
│ navigate        │     │ anti-detection   │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Browser MCP:    │────▶│ Fill credentials │
│ fill_with_      │     │ from entity      │
│ entity          │     │                  │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Perform         │
│ investigation   │
│ actions         │
└─────────────────┘
```

---

## MCP Server Design (Phase 15)

### Connection
```python
# palletai agent connects to browser MCP
mcp_client = MCPClient("ws://localhost:8765/mcp")

# Execute browser actions
result = await mcp_client.call("navigate", {"url": "https://target.com"})
result = await mcp_client.call("screenshot", {})
result = await mcp_client.call("extract_data", {})
```

### Tool Schema
```json
{
  "navigate": {
    "description": "Navigate to URL with anti-detection",
    "parameters": {
      "url": {"type": "string", "required": true},
      "wait_for": {"type": "string", "description": "CSS selector to wait for"}
    }
  },
  "fill_form_with_entity": {
    "description": "Fill form using basset-hound entity data",
    "parameters": {
      "entity_id": {"type": "string", "required": true},
      "field_mapping": {"type": "object", "description": "CSS selector to entity field mapping"}
    }
  }
}
```

---

## Security Considerations

1. **Profile Isolation**
   - Separate cookies, storage, cache per profile
   - Different fingerprints per identity
   - No data leakage between sessions

2. **Credential Security**
   - Never cache credentials locally
   - Fetch on-demand from basset-hound
   - Clear memory after use

3. **Network Security**
   - Proxy/Tor for anonymity
   - DNS leak prevention
   - WebRTC leak prevention

4. **Evidence Integrity**
   - Hash all captures immediately
   - Preserve original metadata
   - Document chain of custody

---

## Related Documents

- Full vision research: `/home/devel/basset-hound/docs/findings/VISION-RESEARCH-2026-01-08.md`
- basset-hound roadmap: `/home/devel/basset-hound/docs/ROADMAP.md`
- basset-hound-browser roadmap: `/home/devel/basset-hound-browser/docs/ROADMAP.md`
