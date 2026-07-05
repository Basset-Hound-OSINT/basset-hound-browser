# Data Directory Pattern for RAG Bootstrap

**Date**: 2026-01-30
**Source Projects**: ResearchHub, BluePlan

## Overview

This document describes the standardized data directory pattern adopted from ResearchHub and applied to RAG Bootstrap. The pattern provides a consistent, organized approach to storing runtime data that is:

- **Git-ignored**: All data excluded from version control
- **Visible**: Stored on filesystem (not hidden in Docker named volumes)
- **Organized**: Categorized by function (docker, cache, logs, etc.)
- **Portable**: Easy to backup, migrate, or inspect

## Directory Structure

```
data/
├── docker/                 # Docker service persistent data
│   ├── postgres/          # PostgreSQL database files
│   └── redis/             # Redis AOF persistence
├── cache/                  # Application caches
│   └── embeddings/        # Embedding vector caches
├── logs/                   # Application and service logs
├── exports/                # Generated exports (reports, backups)
└── registry/               # Metadata registries (JSON files)
```

## Implementation

### docker-compose.yml

Uses **bind mounts** instead of named volumes:

```yaml
services:
  init:
    # Creates directories on first startup
    command: |
      sh -c '
        mkdir -p /data/docker/{postgres,redis}
        mkdir -p /data/cache/embeddings
        mkdir -p /data/{logs,exports,registry}
        chmod -R 777 /data
      '
    volumes:
      - ./data:/data

  postgres:
    depends_on:
      init:
        condition: service_completed_successfully
    volumes:
      - ./data/docker/postgres:/var/lib/postgresql/data

  redis:
    depends_on:
      init:
        condition: service_completed_successfully
    volumes:
      - ./data/docker/redis:/data
```

### .gitignore

```gitignore
# Centralized Data Directory
# All runtime data is stored here and excluded from git
data/
```

### deploy.sh

Creates directories before Docker starts (for pre-inspection):

```bash
ensure_data_directories() {
    mkdir -p "${SCRIPT_DIR}/data/docker/postgres"
    mkdir -p "${SCRIPT_DIR}/data/docker/redis"
    mkdir -p "${SCRIPT_DIR}/data/cache/embeddings"
    mkdir -p "${SCRIPT_DIR}/data/logs"
    mkdir -p "${SCRIPT_DIR}/data/exports"
    mkdir -p "${SCRIPT_DIR}/data/registry"
}
```

## Benefits

### 1. Visibility
- Data is visible on the filesystem
- Can inspect PostgreSQL files directly
- Easy to check Redis persistence
- No need for `docker volume inspect`

### 2. Backup & Migration
```bash
# Backup entire data directory
tar -czvf rag-backup.tar.gz data/

# Restore
tar -xzvf rag-backup.tar.gz
```

### 3. Clean Deployments
- Fresh clone = fresh data (data/ is gitignored)
- No orphaned Docker volumes
- Reproducible across environments

### 4. Multi-Instance Support
- Each project copy has its own data/
- No volume name conflicts
- Network names are auto-incremented

## Category Purposes

| Directory | Purpose | Persistence | Growth |
|-----------|---------|-------------|--------|
| docker/postgres | Database files | Permanent | Slow |
| docker/redis | Embedding cache | Permanent | Medium |
| cache/embeddings | File-based caches | Ephemeral | Fast |
| logs | Application logs | Temporary | Linear |
| exports | Generated outputs | Per-request | Variable |
| registry | Metadata indices | Permanent | Slow |

## Comparison with Previous Approach

### Before (Named Volumes)
```yaml
volumes:
  pgdata:        # Hidden in Docker
  redisdata:     # Hidden in Docker
```

**Issues**:
- Data hidden in `/var/lib/docker/volumes/`
- Requires root to inspect
- Volume names can conflict across projects
- Hard to backup without Docker commands

### After (Bind Mounts)
```yaml
volumes:
  - ./data/docker/postgres:/var/lib/postgresql/data
  - ./data/docker/redis:/data
```

**Benefits**:
- Data visible at `./data/`
- User-owned, no root needed
- No name conflicts (per-project)
- Standard filesystem backup

## Source: ResearchHub Pattern

ResearchHub uses an extended version with:
- `data/workspaces/` - Multi-tenant isolation (UUID-based)
- `data/uploads/` - User-provided content
- `data/state/` - Job checkpoints for resumption
- `data/client_registry.json` - API client tracking

RAG Bootstrap uses a simplified subset appropriate for its single-tenant design.

## Future Considerations

### Potential Extensions
1. **data/state/** - For batch processing checkpoints (if auto-ingest is added)
2. **data/uploads/** - For user-uploaded documents (if web upload is added)
3. **data/registry/pdf_hash_registry.json** - For deduplication tracking

### Configuration
The data directory location could be made configurable via environment variable:
```bash
RAG_DATA_DIR=${RAG_DATA_DIR:-./data}
```

This would allow external storage mounts while maintaining the same structure.

## Related Documents

- [Embedding Model Selection](embedding-model-selection-2026.md) - Model choice rationale
- ResearchHub docs (`~/researchhub/docs/`, external project) - Extended data pattern reference
- BluePlan findings (`~/blueplan/docs/findings/`, external project) - PDF ingestion lessons
