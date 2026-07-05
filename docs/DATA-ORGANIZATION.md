# Data Organization: Ephemeral vs Persistent

**Version:** 1.0  
**Last Updated:** June 21, 2026  
**Status:** Operational  

## Overview

Basset Hound Browser distinguishes between **persistent repository data** (tracked in git) and **ephemeral operational data** (generated at runtime, kept locally). This document clarifies the organization strategy.

## Repository Structure (Persistent - Tracked in Git)

### Source Code & Configuration
- `src/` - Application source code
- `websocket/` - WebSocket server implementation
- `mcp/` - Model Context Protocol server
- `extraction/` - Extraction modules
- `evasion/` - Evasion framework modules
- `proxy/` - Proxy management modules
- `scripts/` - Deployment and utility scripts
- `config/` - Configuration files
- `docs/` - Documentation and guides
- `tests/` - Test suites
- `examples/` - Integration examples
- `assets/` - Static assets

### What's NOT in Repository (Gitignored)
Generated, temporary, and operational data directories:
- `.claude/` - Claude Code settings (local agent state)
- `.basset-hound/` - Browser operational data
- `blocking-data/` - Request blocking rules (generated)
- `backups/` - Backup files (ephemeral)
- `tmp/` - General temporary files

## Data Storage Strategy

### Local Operational Directories (Not in Git)

These directories are created locally and managed outside version control:

```
.claude/
  ├── settings.json           # Local Claude Code config
  ├── settings.local.json     # User overrides
  └── .gitkeep               # Preserve directory in git

.basset-hound/
  ├── screenshots/           # Session screenshots
  ├── videos/               # Recorded sessions
  ├── snapshots/            # Page snapshots
  ├── sessions/             # Session recordings
  ├── reports/              # Generated forensic reports
  ├── metadata/             # Extracted metadata
  ├── audit/                # Audit logs
  ├── monitoring/           # Monitoring data
  ├── incidents/            # Incident records
  └── .gitkeep             # Preserve directory in git

blocking-data/
  ├── rules/                # Generated blocking rules
  └── .gitkeep             # Preserve directory in git

backups/
  ├── profiles/             # Browser profile backups
  ├── sessions/             # Session backups
  └── .gitkeep             # Preserve directory in git
```

### Temporary Runtime Data (tmp/)

Runtime-generated data should use the standard `tmp/` directory:

```
tmp/
  ├── .basset-hound/        # Runtime browser data (mirrors .basset-hound structure)
  ├── blocking-data/        # Runtime blocking data
  ├── test-screenshots/     # Test output screenshots
  ├── test-results/         # Test execution results
  └── .gitkeep             # Preserve directory in git
```

## Code Implementation

### Path References in Source Code

All code that generates operational data uses paths with `tmp/` prefix:

```javascript
// Correct: Uses tmp/ for runtime data
const screenshotDir = path.join(
  require('os').homedir(),
  'tmp',
  '.basset-hound',
  'screenshots'
);

const reportDir = path.join(
  process.cwd(),
  'tmp',
  '.basset-hound',
  'reports'
);

// Correct: Uses process.cwd() + tmp for server operations
const cacheDir = path.join(process.cwd(), 'tmp', '.basset-hound', 'screenshots');
```

### Updated Files

The following files have been updated to use `tmp/` paths:

**Screenshots & Video:**
- `src/screenshots/enhanced-capture.js`
- `src/recording/video-player.js`
- `src/recording/video-storage.js`
- `src/recording/video-encoder.js`

**Analysis & Reports:**
- `src/analysis/forensic-report-generator.js`
- `src/analysis/change-detector.js`
- `src/reporting/report-generator.js`
- `src/reporting/forensic-generator.js`
- `src/core/base-report-generator.js`

**Session Management:**
- `src/session/session-recorder.js`

**Metadata & Forensics:**
- `src/forensics/metadata-extractor.js`

**Security & Monitoring:**
- `src/security/session-encryptor.js`
- `src/security/path-validator.js`
- `src/security/audit-logger.js`
- `src/security/enhanced-audit-log.js`
- `src/monitoring/incident-tracker.js`
- `src/monitoring/monitor-manager.js`
- `src/monitoring/monitoring-orchestrator.js`
- `src/monitoring/monitoring-service.js`

**Infrastructure:**
- `src/infrastructure/health-check-enhanced.js`
- `websocket/server.js`

## Gitignore Configuration

The `.gitignore` file explicitly ignores operational directories while preserving them:

```gitignore
# Claude Code and project-specific settings (keep directories, ignore contents)
.claude/**/*
!.claude/.gitkeep

.basset-hound/**/*
!.basset-hound/.gitkeep

blocking-data/**/*
!blocking-data/.gitkeep

backups/**/*
!backups/.gitkeep

# Temporary files and directories (KEEP MINIMAL AT ROOT)
/tmp/**/*
!/tmp/
!/tmp/.gitkeep
```

## Benefits of This Approach

### 1. **Clean Repository**
- Only essential source code and configuration tracked
- Generated data doesn't clutter git history
- Smaller clone size and faster operations

### 2. **Local Development**
- Developers can maintain local operational state
- No conflicts between team members' generated data
- Easy cleanup (just delete `tmp/` and local directories)

### 3. **Docker Deployment**
- Container images don't include runtime data
- Containers are stateless and reproducible
- Volumes can mount ephemeral data directories

### 4. **Forensic Integrity**
- Operational data preserved outside version control
- Session recordings and reports maintained locally
- Chain of custody documentation in `.basset-hound/`

### 5. **Easy Reset**
```bash
# Clean all ephemeral data
rm -rf tmp/ .basset-hound/ blocking-data/ backups/

# Repository remains clean and functional
```

## Directory Initialization

When the browser starts, it automatically creates necessary directories:

```javascript
ensureDirectory() {
  if (!fs.existsSync(this.reportDir)) {
    fs.mkdirSync(this.reportDir, { recursive: true });
  }
}
```

This pattern is used across all modules, ensuring directories exist when needed.

## Monitoring & Health Checks

Health checks that verify filesystem access use the standard paths:

```javascript
const tmpFile = `/tmp/.basset-hound/health-${Date.now()}`;
await fs.writeFile(tmpFile, 'health-check');
await fs.unlink(tmpFile);
```

## Migration from Old Structure

If you have existing data in root-level directories:

```bash
# Move existing data to appropriate locations
mkdir -p tmp/.basset-hound
mv .basset-hound/* tmp/.basset-hound/ 2>/dev/null || true

# Backup old sessions if needed
mkdir -p backups
mv sessions/ backups/sessions 2>/dev/null || true

# Clean up
rm -rf .basset-hound/* blocking-data/* 2>/dev/null || true
```

## Docker Volume Mounting

For containerized deployment, mount ephemeral data:

```yaml
# docker-compose.yml example
services:
  basset-hound:
    image: basset-hound-browser:12.8.0
    volumes:
      - ./reports:/app/tmp/.basset-hound/reports
      - ./screenshots:/app/tmp/.basset-hound/screenshots
      - ./sessions:/app/tmp/.basset-hound/sessions
```

## Summary

| Data Type | Location | Tracked | Persistent | Purpose |
|-----------|----------|---------|-----------|---------|
| Source Code | `src/`, `websocket/` | ✅ Yes | ✅ Yes | Application logic |
| Configuration | `config/` | ✅ Yes | ✅ Yes | Deployment settings |
| Documentation | `docs/` | ✅ Yes | ✅ Yes | Guides & references |
| Tests | `tests/` | ✅ Yes | ✅ Yes | Test suites |
| Screenshots | `tmp/.basset-hound/screenshots` | ❌ No | ❌ No | Runtime captures |
| Reports | `tmp/.basset-hound/reports` | ❌ No | ❌ No | Generated analysis |
| Sessions | `tmp/.basset-hound/sessions` | ❌ No | ❌ No | Session recordings |
| Settings | `.claude/` | ❌ No | ✅ Yes | Local agent config |
| Monitoring | `tmp/.basset-hound/monitoring` | ❌ No | ❌ No | Runtime metrics |

---

**Last Verified:** June 21, 2026  
**Next Review:** After major version release
