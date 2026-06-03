# Backup & Restore Runbook

**Version:** 12.2.0  
**Last Updated:** June 2, 2026  
**Status:** Production Ready  
**Audience:** DevOps Engineers, System Administrators

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Manual Backup Procedures](#manual-backup-procedures)
4. [Automated Backup Configuration](#automated-backup-configuration)
5. [Restore Procedures](#restore-procedures)
6. [Backup Verification](#backup-verification)
7. [Disaster Recovery](#disaster-recovery)

---

## Overview

This runbook provides comprehensive backup and restore procedures for the Basset Hound Browser service, protecting against data loss and enabling rapid recovery.

### Components to Backup

| Component | Type | Size | Criticality | Backup Frequency |
|-----------|------|------|-------------|------------------|
| **Data Volume** | Docker Volume | 100MB-1GB | Critical | Daily |
| **Application Files** | Code | 500MB | Medium | Weekly |
| **Configuration** | Config Files | <1MB | Critical | Real-time |
| **Logs** | Text | 100MB-500MB | Medium | Daily |
| **Screenshots/Evidence** | Binary | 1GB-5GB | High | Weekly |
| **Database** | SQLite | 10MB-100MB | Critical | Daily |

### Backup Targets

```
┌─────────────────────────────────────┐
│ Basset Hound Browser Container      │
├─────────────────────────────────────┤
│ Data Volume (basset-data)           │ ─┐
│ Configuration Files                 │  │
│ Logs (/app/logs)                    │  ├──> Local Storage (NAS)
│ Screenshots (/app/screenshots)      │  │
│ Database (/app/data/db.sqlite)      │  │
└─────────────────────────────────────┘ ─┤
                                        │
                                        ├──> Offsite Storage (S3)
                                        │
                                        └──> Archive (Tape)
```

---

## Backup Strategy

### RPO & RTO Targets

| Scenario | RPO | RTO | Backup Type |
|----------|-----|-----|-------------|
| **Normal Operation** | 24 hours | 1 hour | Incremental |
| **Partial Data Loss** | 1 hour | 30 minutes | Differential |
| **Complete Failure** | 1 hour | 4 hours | Full + Incremental |

### Backup Retention Policy

```
Daily Backups:      Keep 7 days (last 7 days)
Weekly Backups:     Keep 4 weeks (1 month)
Monthly Backups:    Keep 12 months (1 year)
Yearly Backups:     Keep indefinitely (archive)

Total Storage Required: ~50GB for 1 year retention
```

### Backup Locations

1. **Local Backup** (NAS/Local Storage)
   - Location: `/backups/basset-hound/`
   - Retention: 30 days
   - Access: Fast (LAN)
   - Purpose: Quick recovery

2. **Offsite Backup** (Cloud/S3)
   - Location: `s3://basset-hound-backups/`
   - Retention: 90 days
   - Access: Medium (Internet)
   - Purpose: Disaster recovery

3. **Archive Backup** (Tape/Cold Storage)
   - Location: Tape vault
   - Retention: 7 years
   - Access: Slow (Manual retrieval)
   - Purpose: Compliance/Legal

---

## Manual Backup Procedures

### Procedure 1: Quick Backup (Data Volume Only)

Use this for regular daily backups.

**Time Required**: 2-5 minutes

**Steps**:

```bash
#!/bin/bash

BACKUP_DIR="/backups/basset-hound"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-data-$TIMESTAMP"

# 1. Create backup directory
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
echo "✓ Created backup directory: $BACKUP_DIR/$BACKUP_NAME"

# 2. Backup data volume
echo "Backing up data volume..."
docker run --rm \
  -v basset-data:/source \
  -v "$BACKUP_DIR/$BACKUP_NAME":/backup \
  alpine tar czf /backup/data.tar.gz /source

if [ $? -eq 0 ]; then
    echo "✓ Data volume backed up"
else
    echo "✗ Failed to backup data volume"
    exit 1
fi

# 3. Get backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME" | awk '{print $1}')
echo "Backup size: $BACKUP_SIZE"

# 4. Create manifest
cat > "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt" <<EOF
Backup Name: $BACKUP_NAME
Date: $(date)
Size: $BACKUP_SIZE
Contents:
  - data.tar.gz: Application data volume

Container Version: $(docker inspect basset-hound-browser \
  --format='{{.Config.Image}}')
EOF

echo "✓ Quick backup completed successfully"
echo "  Location: $BACKUP_DIR/$BACKUP_NAME"
```

### Procedure 2: Full Backup (All Components)

Use this for weekly or pre-deployment backups.

**Time Required**: 10-15 minutes

**Steps**:

```bash
#!/bin/bash

BACKUP_DIR="/backups/basset-hound"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-full-$TIMESTAMP"
CONTAINER="basset-hound-browser"

mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
echo "=== Full Backup Starting ===" 
echo "Backup: $BACKUP_NAME"
echo ""

# 1. Backup data volume
echo "[1/5] Backing up data volume..."
docker run --rm \
  -v basset-data:/source \
  -v "$BACKUP_DIR/$BACKUP_NAME":/backup \
  alpine tar czf /backup/data.tar.gz /source
echo "✓ Data volume backed up"

# 2. Backup configuration
echo "[2/5] Backing up configuration..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME/config"
cp -r ./config/* "$BACKUP_DIR/$BACKUP_NAME/config/" 2>/dev/null || true
cp docker-compose.yml "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
cp .env "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
echo "✓ Configuration backed up"

# 3. Backup application code
echo "[3/5] Backing up application code..."
docker run --rm \
  -v "$(pwd)":/app \
  -v "$BACKUP_DIR/$BACKUP_NAME":/backup \
  alpine tar czf /backup/app-code.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.docker \
  /app
echo "✓ Application code backed up"

# 4. Backup logs
echo "[4/5] Backing up logs..."
docker logs "$CONTAINER" > "$BACKUP_DIR/$BACKUP_NAME/logs.txt" 2>&1
echo "✓ Logs backed up"

# 5. Backup container metadata
echo "[5/5] Backing up container metadata..."
docker inspect "$CONTAINER" > "$BACKUP_DIR/$BACKUP_NAME/container-config.json"
docker network inspect basset-hound-browser > "$BACKUP_DIR/$BACKUP_NAME/network-config.json" 2>/dev/null || true
echo "✓ Container metadata backed up"

# 6. Create comprehensive manifest
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME" | awk '{print $1}')
cat > "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt" <<EOF
=== Full Backup Manifest ===
Backup Name: $BACKUP_NAME
Date: $(date)
Size: $BACKUP_SIZE
Duration: $(date -d @$SECONDS +%H:%M:%S)

Contents:
  - data.tar.gz: Application data volume (~$(du -sh "$BACKUP_DIR/$BACKUP_NAME/data.tar.gz" 2>/dev/null | awk '{print $1}' || echo 'N/A'))
  - app-code.tar.gz: Application source code
  - config/: Configuration files
  - docker-compose.yml: Docker Compose configuration
  - .env: Environment variables
  - logs.txt: Recent container logs
  - container-config.json: Docker container configuration
  - network-config.json: Docker network configuration

Container Information:
  Image: $(docker inspect "$CONTAINER" --format='{{.Config.Image}}')
  Started: $(docker inspect "$CONTAINER" --format='{{.State.StartedAt}}')

Restoration Instructions:
  1. Extract backup: tar xzf $BACKUP_NAME.tar.gz
  2. Restore data: See RESTORE-RUNBOOK.md
  3. Verify: Run health checks

Verification Hash: $(tar czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME" 2>/dev/null && md5sum "$BACKUP_DIR/$BACKUP_NAME.tar.gz")
EOF

echo ""
echo "=== Full Backup Complete ==="
echo "Location: $BACKUP_DIR/$BACKUP_NAME"
echo "Size: $BACKUP_SIZE"
echo "✓ Ready for recovery"
```

### Procedure 3: Incremental Backup (Changes Only)

Use this for frequent backups with minimal storage usage.

**Time Required**: 1-3 minutes

**Steps**:

```bash
#!/bin/bash

BACKUP_DIR="/backups/basset-hound"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-incremental-$TIMESTAMP"
CONTAINER="basset-hound-browser"

# Get last full backup date
LAST_FULL=$(ls -t "$BACKUP_DIR"/backup-full-* 2>/dev/null | head -1 | xargs basename)
LAST_FULL_DATE=$(date -d "${LAST_FULL#backup-full-}" +%s 2>/dev/null || date +%s)

mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
echo "Creating incremental backup since: $(date -d @$LAST_FULL_DATE)"

# Backup only changed files since last full backup
docker run --rm \
  -v basset-data:/source \
  -v "$BACKUP_DIR/$BACKUP_NAME":/backup \
  alpine tar czf /backup/data-incremental.tar.gz \
  --newer-mtime-than="$(date -d @$LAST_FULL_DATE +%Y-%m-%d)" \
  /source 2>/dev/null || \
  docker run --rm \
    -v basset-data:/source \
    -v "$BACKUP_DIR/$BACKUP_NAME":/backup \
    alpine tar czf /backup/data-incremental.tar.gz /source

# Backup logs only new entries
docker logs "$CONTAINER" --since "$(date -d @$LAST_FULL_DATE -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$BACKUP_DIR/$BACKUP_NAME/logs-incremental.txt" 2>&1

# Create manifest
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME" | awk '{print $1}')
cat > "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt" <<EOF
Incremental Backup: $BACKUP_NAME
Base Backup: $LAST_FULL
Size: $BACKUP_SIZE
Date: $(date)

To restore:
  1. Restore last full backup: $LAST_FULL
  2. Extract incremental: tar xzf data-incremental.tar.gz
  3. Verify data integrity
EOF

echo "✓ Incremental backup completed"
echo "  Base: $LAST_FULL"
echo "  Size: $BACKUP_SIZE"
```

### Procedure 4: Backup to Cloud (S3)

**Prerequisites**:
- AWS CLI configured
- S3 bucket exists
- IAM credentials with S3 access

**Steps**:

```bash
#!/bin/bash

# Configuration
AWS_BUCKET="basset-hound-backups"
AWS_REGION="us-east-1"
LOCAL_BACKUP="/backups/basset-hound/backup-full-$(date +%Y%m%d-%H%M%S)"

# 1. Create local backup first
echo "Creating local backup..."
bash ./backup-procedures.sh full
# (Would call full backup procedure above)

# 2. Upload to S3
echo "Uploading to S3..."
aws s3 sync "$LOCAL_BACKUP" \
  "s3://$AWS_BUCKET/$(basename "$LOCAL_BACKUP")" \
  --region "$AWS_REGION" \
  --sse AES256 \
  --storage-class STANDARD_IA

if [ $? -eq 0 ]; then
    echo "✓ Backup uploaded to S3"
    
    # 3. Verify upload
    echo "Verifying backup in S3..."
    aws s3 ls "s3://$AWS_BUCKET/$(basename "$LOCAL_BACKUP")/" \
      --recursive --summarize
    
    # 4. Set lifecycle policy to move to Glacier after 90 days
    # (Already configured in S3 bucket policy)
else
    echo "✗ Failed to upload backup to S3"
    exit 1
fi

echo "✓ Cloud backup completed"
```

---

## Automated Backup Configuration

### Option 1: Cron-based Backups

Create: `/etc/cron.d/basset-hound-backups`

```bash
# Basset Hound Browser Automated Backups

# Daily backup at 2 AM
0 2 * * * root /usr/local/bin/basset-hound-backup-daily.sh >> /var/log/basset-hound-backup-daily.log 2>&1

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 root /usr/local/bin/basset-hound-backup-full.sh >> /var/log/basset-hound-backup-full.log 2>&1

# Hourly incremental backup (optional)
0 * * * * root /usr/local/bin/basset-hound-backup-incremental.sh >> /var/log/basset-hound-backup-incremental.log 2>&1

# Daily cleanup: remove backups older than 30 days
0 4 * * * root find /backups/basset-hound -type d -name 'backup-*' -mtime +30 -exec rm -rf {} \; 2>/dev/null
```

Create: `/usr/local/bin/basset-hound-backup-daily.sh`

```bash
#!/bin/bash

set -e

BACKUP_DIR="/backups/basset-hound"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOGFILE="/var/log/basset-hound-backup-daily.log"

{
    echo "=== Daily Backup Started: $(date) ==="
    
    # Create backup
    mkdir -p "$BACKUP_DIR/backup-daily-$TIMESTAMP"
    
    docker run --rm \
      -v basset-data:/source \
      -v "$BACKUP_DIR/backup-daily-$TIMESTAMP":/backup \
      alpine tar czf /backup/data.tar.gz /source
    
    # Verify backup
    if [ -f "$BACKUP_DIR/backup-daily-$TIMESTAMP/data.tar.gz" ]; then
        SIZE=$(du -sh "$BACKUP_DIR/backup-daily-$TIMESTAMP/data.tar.gz" | awk '{print $1}')
        echo "✓ Backup successful: $SIZE"
    else
        echo "✗ Backup failed"
        exit 1
    fi
    
    echo "=== Daily Backup Completed: $(date) ==="
} | tee -a "$LOGFILE"
```

Make scripts executable:

```bash
chmod +x /usr/local/bin/basset-hound-backup-*.sh
```

### Option 2: Docker-based Backup Service

Create: `/home/devel/basset-hound-browser/docker-compose.backup.yml`

```yaml
version: '3.8'

services:
  backup:
    image: alpine:latest
    volumes:
      - basset-data:/data:ro
      - /backups/basset-hound:/backup
    entrypoint: |
      /bin/sh -c '
        while true; do
          TIMESTAMP=$$(date +%Y%m%d-%H%M%S)
          echo "Starting backup: $$TIMESTAMP"
          tar czf /backup/backup-$$TIMESTAMP.tar.gz /data
          find /backup -name "backup-*.tar.gz" -mtime +30 -delete
          echo "Backup completed. Sleeping 24 hours..."
          sleep 86400
        done
      '
    restart: unless-stopped
    networks:
      - basset-hound-browser

volumes:
  basset-data:
    external: true

networks:
  basset-hound-browser:
    external: true
```

Start the backup service:

```bash
docker-compose -f docker-compose.backup.yml up -d
```

---

## Restore Procedures

### Procedure 1: Restore Data Volume

**Scenario**: Data volume is corrupted or lost

**Time Required**: 5-10 minutes

**Steps**:

```bash
#!/bin/bash

set -e

BACKUP_FILE="$1"  # Path to backup archive
CONTAINER="basset-hound-browser"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path-to-backup-file>"
    echo "Example: $0 /backups/basset-hound/backup-full-20260602-120000/data.tar.gz"
    exit 1
fi

echo "=== Restore Data Volume ==="
echo "Backup: $BACKUP_FILE"
echo ""

# 1. Stop container
echo "[1/4] Stopping container..."
docker-compose stop -t 10
echo "✓ Container stopped"

# 2. Remove current volume (optional, with confirmation)
echo "[2/4] Current volume will be replaced"
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled"
    exit 1
fi

docker volume rm basset-data || true
echo "✓ Old volume removed"

# 3. Restore from backup
echo "[3/4] Restoring data from backup..."
docker volume create basset-data
docker run --rm \
  -v basset-data:/data \
  -v "$(dirname "$BACKUP_FILE")":/backup \
  alpine tar xzf "/backup/$(basename "$BACKUP_FILE")" -C /

echo "✓ Data restored"

# 4. Restart container
echo "[4/4] Starting container..."
docker-compose up -d
sleep 5

# 5. Verify
if docker exec "$CONTAINER" test -d /app/data; then
    echo "✓ Data directory verified"
    echo ""
    echo "=== Restore Completed Successfully ==="
    echo "Container: $CONTAINER"
    echo "Data directory: /app/data"
else
    echo "✗ Restore verification failed"
    exit 1
fi
```

### Procedure 2: Full System Restore

**Scenario**: Complete system failure (container and volumes lost)

**Time Required**: 30-45 minutes

**Steps**:

```bash
#!/bin/bash

set -e

BACKUP_DIR="$1"  # Full backup directory
if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
    echo "Usage: $0 <path-to-backup-directory>"
    echo "Example: $0 /backups/basset-hound/backup-full-20260602-120000"
    exit 1
fi

echo "=== Full System Restore ==="
echo "Backup: $BACKUP_DIR"
echo ""

# 1. Stop existing services
echo "[1/6] Stopping existing services..."
docker-compose down 2>/dev/null || true
docker volume rm basset-data 2>/dev/null || true
echo "✓ Services stopped"

# 2. Restore configuration
echo "[2/6] Restoring configuration..."
if [ -f "$BACKUP_DIR/docker-compose.yml" ]; then
    cp "$BACKUP_DIR/docker-compose.yml" .
fi
if [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" .
fi
if [ -d "$BACKUP_DIR/config" ]; then
    cp -r "$BACKUP_DIR/config"/* ./config/
fi
echo "✓ Configuration restored"

# 3. Restore application code
echo "[3/6] Restoring application code..."
if [ -f "$BACKUP_DIR/app-code.tar.gz" ]; then
    tar xzf "$BACKUP_DIR/app-code.tar.gz" --exclude=node_modules
    npm install
fi
echo "✓ Application code restored"

# 4. Restore data volume
echo "[4/6] Restoring data volume..."
docker volume create basset-data
if [ -f "$BACKUP_DIR/data.tar.gz" ]; then
    docker run --rm \
      -v basset-data:/data \
      -v "$BACKUP_DIR":/backup \
      alpine tar xzf /backup/data.tar.gz -C /
fi
echo "✓ Data volume restored"

# 5. Rebuild and start
echo "[5/6] Building Docker image..."
docker-compose build --no-cache
echo "✓ Docker image built"

echo "[6/6] Starting services..."
docker-compose up -d
sleep 10
echo "✓ Services started"

# 7. Verify
echo ""
echo "=== Verification ==="
if docker ps | grep -q basset-hound-browser; then
    echo "✓ Container is running"
fi

if docker logs basset-hound-browser | grep -q "WebSocket server"; then
    echo "✓ WebSocket server started"
fi

if docker exec basset-hound-browser test -d /app/data; then
    echo "✓ Data directory verified"
fi

echo ""
echo "=== Full System Restore Completed ==="
```

### Procedure 3: Restore from Cloud Backup

**Prerequisites**: AWS CLI configured, S3 backup available

**Steps**:

```bash
#!/bin/bash

set -e

# Configuration
AWS_BUCKET="basset-hound-backups"
AWS_REGION="us-east-1"
BACKUP_DATE="$1"  # e.g., 20260602-120000

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup-date>"
    echo "Example: $0 20260602-120000"
    echo ""
    echo "Available backups:"
    aws s3 ls "s3://$AWS_BUCKET/" --region "$AWS_REGION"
    exit 1
fi

echo "=== Restore from Cloud Backup ==="
echo "Backup: backup-full-$BACKUP_DATE"
echo ""

# 1. Download backup from S3
echo "[1/4] Downloading backup from S3..."
LOCAL_DIR="/tmp/backup-restore-$BACKUP_DATE"
mkdir -p "$LOCAL_DIR"

aws s3 sync \
  "s3://$AWS_BUCKET/backup-full-$BACKUP_DATE" \
  "$LOCAL_DIR" \
  --region "$AWS_REGION"

if [ ! -f "$LOCAL_DIR/data.tar.gz" ]; then
    echo "✗ Backup download failed"
    exit 1
fi

echo "✓ Backup downloaded"

# 2-7. Run full restore
echo "[2/4] Running full restore..."
bash ./restore-full.sh "$LOCAL_DIR"

# 3. Cleanup
echo "Cleaning up temporary files..."
rm -rf "$LOCAL_DIR"

echo "✓ Cloud restore completed"
```

---

## Backup Verification

### Verify Backup Integrity

```bash
#!/bin/bash

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "=== Backup Verification ==="
echo "File: $BACKUP_FILE"
echo ""

# 1. Check file exists and is readable
echo "[1/5] Checking file..."
if [ ! -r "$BACKUP_FILE" ]; then
    echo "✗ File not readable"
    exit 1
fi
echo "✓ File is readable"

# 2. Check file size
SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
echo "[2/5] Size: $SIZE"

# 3. Verify tar integrity
echo "[3/5] Verifying tar integrity..."
if tar tzf "$BACKUP_FILE" >/dev/null 2>&1; then
    echo "✓ Tar file is valid"
else
    echo "✗ Tar file is corrupted"
    exit 1
fi

# 4. Test restore (dry-run)
echo "[4/5] Testing restore (dry-run)..."
if tar tzf "$BACKUP_FILE" | head -20; then
    echo "✓ Can read backup contents"
fi

# 5. Calculate checksum
echo "[5/5] Calculating checksum..."
CHECKSUM=$(md5sum "$BACKUP_FILE" | awk '{print $1}')
echo "MD5: $CHECKSUM"

# Save verification report
cat > "${BACKUP_FILE%.tar.gz}-verification.txt" <<EOF
Backup Verification Report
Generated: $(date)
File: $(basename "$BACKUP_FILE")
Size: $SIZE
MD5: $CHECKSUM
Status: VERIFIED ✓

To restore this backup:
  tar xzf $BACKUP_FILE
EOF

echo ""
echo "✓ Backup verification completed"
echo "Report: ${BACKUP_FILE%.tar.gz}-verification.txt"
```

### Restore Test (Dry-Run)

```bash
#!/bin/bash

BACKUP_FILE="$1"
TEST_DIR="/tmp/backup-test-$$"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "=== Test Restore (Dry-Run) ==="
echo ""

# 1. Create test directory
mkdir -p "$TEST_DIR"
echo "[1/3] Extracting to test directory..."

# 2. Extract backup
tar xzf "$BACKUP_FILE" -C "$TEST_DIR"

if [ $? -eq 0 ]; then
    echo "✓ Extraction successful"
else
    echo "✗ Extraction failed"
    rm -rf "$TEST_DIR"
    exit 1
fi

# 3. Verify contents
echo "[2/3] Verifying contents..."
if [ -d "$TEST_DIR/app/data" ]; then
    FILE_COUNT=$(find "$TEST_DIR/app/data" -type f | wc -l)
    echo "✓ Data directory found ($FILE_COUNT files)"
fi

# 4. Calculate restore size
RESTORE_SIZE=$(du -sh "$TEST_DIR" | awk '{print $1}')
echo "[3/3] Restore size would be: $RESTORE_SIZE"

# Cleanup
rm -rf "$TEST_DIR"

echo ""
echo "✓ Test restore completed successfully"
echo "Backup is safe to restore"
```

---

## Disaster Recovery

### Disaster Scenario 1: Data Volume Corruption

**Symptoms**: 
- Container won't start
- Errors about corrupted files
- Data directory inaccessible

**Recovery**:

```bash
# 1. Check backup availability
ls -lt /backups/basset-hound/backup-* | head -5

# 2. Restore latest backup
bash restore-data-volume.sh /backups/basset-hound/backup-full-*/data.tar.gz

# 3. Verify
docker exec basset-hound-browser ls -la /app/data
```

### Disaster Scenario 2: Container Image Unavailable

**Symptoms**:
- Docker image deleted or corrupted
- Cannot pull image from registry
- Build fails

**Recovery**:

```bash
# 1. Check if backup image exists
docker images | grep basset-hound-browser

# 2. If not, rebuild from source
docker-compose build --no-cache

# 3. Or restore from backup
# docker load -i /backups/basset-hound/docker-image-backup.tar
```

### Disaster Scenario 3: Complete Disk Failure

**Symptoms**:
- All local data lost
- Docker volumes deleted
- System unrecoverable

**Recovery**:

```bash
# 1. Restore from offsite backup (S3)
bash restore-from-cloud-backup.sh 20260602-120000

# 2. Or restore from archive tape
# Mount tape and extract backup

# 3. Rebuild system from restore
docker-compose build
docker-compose up -d

# 4. Verify all data is restored
docker exec basset-hound-browser \
  test -d /app/data && echo "✓ Data restored"
```

---

## Troubleshooting Backup/Restore Issues

### Issue: Backup File Too Large

**Symptoms**: Backup exceeds 5GB

**Solution**:
```bash
# Exclude unnecessary files
tar czf backup.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=screenshots \
  /app
```

### Issue: Restore Fails with "Permission Denied"

**Symptoms**: Error during tar extraction

**Solution**:
```bash
# Run restore with proper permissions
docker run --rm --user root \
  -v basset-data:/data \
  -v /backup:/backup \
  alpine tar xzf /backup/data.tar.gz -C /

# Or fix permissions after restore
docker exec basset-hound-browser \
  chown -R basset:basset /app/data
```

### Issue: S3 Upload Fails

**Symptoms**: AWS CLI error during upload

**Solution**:
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check S3 bucket permissions
aws s3 ls s3://basset-hound-backups/

# Try with verbose output
aws s3 sync . s3://basset-hound-backups/ --debug
```

---

**End of Backup & Restore Runbook**

