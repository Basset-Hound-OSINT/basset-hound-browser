# Basset Hound Browser - Rsync Deployment Guide

## Overview

This document covers rsync commands and techniques for deploying the Basset Hound Browser to remote servers.

---

## Basic Rsync Command

```bash
rsync -avz --exclude='node_modules' --exclude='.git' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/path/to/destination/
```

### Flags Explained

| Flag | Description |
|------|-------------|
| `-a` | Archive mode (preserves permissions, timestamps, symlinks) |
| `-v` | Verbose output |
| `-z` | Compress data during transfer |
| `--exclude` | Exclude specified patterns |

---

## Recommended Excludes

```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='coverage' \
  --exclude='.DS_Store' \
  /home/devel/basset-hound-browser/ \
  user@remote-server:/destination/
```

---

## Using an Exclude File

Create a `.rsync-exclude` file in the project root:

```
# .rsync-exclude
node_modules/
.git/
dist/
*.log
.env
.env.*
coverage/
.DS_Store
*.tmp
*.swp
.idea/
.vscode/
```

Then use it with:

```bash
rsync -avz --exclude-from='.rsync-exclude' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/destination/
```

---

## Common Deployment Scenarios

### 1. Initial Full Sync

```bash
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

### 2. Dry Run (Preview Changes)

```bash
rsync -avzn \
  --exclude='node_modules' \
  --exclude='.git' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

The `-n` flag performs a dry run without making changes.

### 3. Delete Files Not in Source

```bash
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

**Warning**: `--delete` removes files on the destination that don't exist in the source.

### 4. Sync Only Source Code

```bash
rsync -avz \
  --include='*.js' \
  --include='*.json' \
  --include='*.html' \
  --include='*.css' \
  --include='*.md' \
  --include='*/' \
  --exclude='*' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

### 5. Bandwidth Limited Sync

```bash
rsync -avz --bwlimit=1000 \
  --exclude='node_modules' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

Limits transfer to 1000 KB/s.

---

## SSH Configuration

### Using a Specific SSH Key

```bash
rsync -avz -e "ssh -i ~/.ssh/id_rsa_server" \
  --exclude='node_modules' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

### Using a Non-Standard SSH Port

```bash
rsync -avz -e "ssh -p 2222" \
  --exclude='node_modules' \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

---

## Deployment Script

Create a `deploy.sh` script in the project root:

```bash
#!/bin/bash

# Configuration
REMOTE_USER="user"
REMOTE_HOST="192.168.0.7"
REMOTE_PATH="/opt/basset-hound-browser"
LOCAL_PATH="/home/devel/basset-hound-browser/"

# Excludes
EXCLUDES=(
  "node_modules"
  ".git"
  "dist"
  "*.log"
  ".env"
  "coverage"
)

# Build exclude arguments
EXCLUDE_ARGS=""
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude='$pattern'"
done

# Perform sync
echo "Deploying to $REMOTE_HOST..."
eval rsync -avz --progress $EXCLUDE_ARGS "$LOCAL_PATH" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

# Optional: Run post-deploy commands on remote
# ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && npm install && npm run build"

echo "Deployment complete!"
```

Make it executable:

```bash
chmod +x deploy.sh
```

---

## Pulling from Remote

To pull changes from the remote server to local:

```bash
rsync -avz \
  --exclude='node_modules' \
  user@192.168.0.7:/opt/basset-hound-browser/ \
  /home/devel/basset-hound-browser/
```

---

## Troubleshooting

### Permission Denied

```bash
# Use sudo on remote for permission issues
rsync -avz --rsync-path="sudo rsync" \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

### Preserve Ownership (as root)

```bash
rsync -avz --chown=appuser:appgroup \
  /home/devel/basset-hound-browser/ \
  user@192.168.0.7:/opt/basset-hound-browser/
```

### Check Connection

```bash
# Test SSH connection first
ssh user@192.168.0.7 "echo 'Connection successful'"
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `rsync -avz src/ dest/` | Basic sync |
| `rsync -avzn src/ dest/` | Dry run (preview) |
| `rsync -avz --delete src/ dest/` | Sync and delete extra files |
| `rsync -avz --progress src/ dest/` | Show progress |
| `rsync -avz --bwlimit=1000 src/ dest/` | Limit bandwidth |
| `rsync -avz -e "ssh -p 2222" src/ dest/` | Custom SSH port |

---

*Last Updated: December 2024*
