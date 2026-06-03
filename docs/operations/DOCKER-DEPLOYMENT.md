# Docker Deployment Guide

**Version:** 12.2.0  
**Last Updated:** June 2, 2026  
**Status:** Production Ready  
**Audience:** DevOps Engineers, System Administrators

---

## Table of Contents

1. [Overview](#overview)
2. [Docker Image Build](#docker-image-build)
3. [Docker Registry](#docker-registry)
4. [Docker Runtime Configuration](#docker-runtime-configuration)
5. [Networking & Storage](#networking--storage)
6. [Security Hardening](#security-hardening)
7. [Performance Tuning](#performance-tuning)

---

## Overview

This guide provides detailed procedures for building, pushing, and running Basset Hound Browser in Docker environments.

### Docker Architecture

```
┌─────────────────────────────────────────┐
│ Host System (Linux/macOS/Windows)       │
├─────────────────────────────────────────┤
│ Docker Engine                           │
│ ├─ Docker Daemon                        │
│ ├─ Docker CLI                           │
│ └─ containerd (runtime)                 │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Container Image Build                │ │
│ ├─────────────────────────────────────┤ │
│ │ Dockerfile                           │ │
│ │ ├─ Base Image: node:20-bullseye     │ │
│ │ ├─ System deps (50+ packages)       │ │
│ │ ├─ Tor daemon                        │ │
│ │ ├─ Xvfb display server              │ │
│ │ ├─ Application files                │ │
│ │ └─ Entrypoint script                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Running Container                    │ │
│ ├─────────────────────────────────────┤ │
│ │ ├─ WebSocket Server (:8765)         │ │
│ │ ├─ Tor Daemon (9050/9051)           │ │
│ │ ├─ Xvfb Display (:99)               │ │
│ │ ├─ Electron Browser                 │ │
│ │ ├─ Volume Mounts (data, profiles)   │ │
│ │ └─ Resource Limits (CPU, Memory)    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Docker Image Build

### Build from Source

```bash
# Navigate to project root
cd /home/devel/basset-hound-browser

# Build image with default tag
docker build -t basset-hound-browser:12.2.0 .

# Or build with latest tag
docker build -t basset-hound-browser:latest .

# Or build with multiple tags
docker build \
  -t basset-hound-browser:12.2.0 \
  -t basset-hound-browser:latest \
  .
```

**Build Time**: 3-10 minutes (depends on cache)

**Build Output**:
```
[+] Building 45.3s (18/18) FINISHED
 => [internal] load build definition from Dockerfile
 => [base 1/1] FROM node:20-bullseye
 => [dependencies] RUN apt-get update && apt-get install...
 ...
 => exporting to image
 => => naming to docker.io/basset-hound-browser:12.2.0
```

### Build with Custom Options

```bash
# Build with no cache (force rebuild)
docker build --no-cache -t basset-hound-browser:12.2.0 .

# Build with build arguments
docker build \
  --build-arg NODE_VERSION=20 \
  --build-arg DISPLAY=:99 \
  -t basset-hound-browser:12.2.0 \
  .

# Build with progress output
docker build --progress=plain -t basset-hound-browser:12.2.0 .
```

### Verify Build

```bash
# List images
docker images | grep basset-hound-browser

# Inspect image details
docker inspect basset-hound-browser:12.2.0

# Get image size
docker images --format "table {{.Repository}}\t{{.Size}}" | \
  grep basset-hound-browser

# Expected: ~2.6GB for image
```

### Optimize Build

```dockerfile
# In Dockerfile - Best practices:

# 1. Use specific base image version
FROM node:20-bullseye

# 2. Combine RUN commands to reduce layers
RUN apt-get update && \
    apt-get install -y package1 package2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 3. Copy only needed files
COPY package*.json ./
RUN npm install
COPY . .

# 4. Minimize layer count
# Good: 15-20 layers
# Bad: 50+ layers (too many)
```

---

## Docker Registry

### Push to Docker Hub

**Prerequisites**:
```bash
# Login to Docker Hub
docker login

# Expected: Username and password prompt
```

**Push Image**:
```bash
# Tag image for Hub
docker tag basset-hound-browser:12.2.0 \
  yourusername/basset-hound-browser:12.2.0

# Push to Hub
docker push yourusername/basset-hound-browser:12.2.0

# Verify push
docker pull yourusername/basset-hound-browser:12.2.0
```

### Push to Private Registry

```bash
# Tag for private registry
docker tag basset-hound-browser:12.2.0 \
  registry.example.com/basset-hound-browser:12.2.0

# Login to private registry
docker login registry.example.com

# Push image
docker push registry.example.com/basset-hound-browser:12.2.0

# Verify
curl https://registry.example.com/v2/basset-hound-browser/tags/list
```

### Export & Import

```bash
# Save image to file
docker save basset-hound-browser:12.2.0 | \
  gzip > basset-hound-browser-12.2.0.tar.gz

# Verify size
ls -lh basset-hound-browser-12.2.0.tar.gz
# Expected: ~800MB-1GB

# Transfer to different system
scp basset-hound-browser-12.2.0.tar.gz user@host:/tmp/

# Load image on target
docker load -i basset-hound-browser-12.2.0.tar.gz

# Verify
docker images | grep basset-hound-browser
```

---

## Docker Runtime Configuration

### Basic Docker Run

```bash
# Minimal run command
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  basset-hound-browser:12.2.0

# With environment variables
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  -e DISPLAY=:99 \
  -e ELECTRON_DISABLE_SANDBOX=1 \
  basset-hound-browser:12.2.0

# With volume mounts
docker run -d \
  --name basset-hound-browser \
  -p 8765:8765 \
  -v basset-data:/app/data \
  -v $(pwd)/screenshots:/app/screenshots \
  basset-hound-browser:12.2.0

# Full production configuration
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  --restart unless-stopped \
  -p 8765:8765 \
  -e DISPLAY=:99 \
  -e SCREEN_RESOLUTION=1920x1080x24 \
  -e ELECTRON_DISABLE_SANDBOX=1 \
  -v basset-data:/app/data \
  -v $(pwd)/downloads:/app/downloads \
  -v $(pwd)/screenshots:/app/screenshots \
  --cap-drop=ALL \
  --cap-add=SYS_ADMIN \
  --security-opt no-new-privileges:true \
  --pids-limit=256 \
  --ulimit nofile=65535:65535 \
  --memory=2g \
  --memory-swap=2g \
  --cpus=2 \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  basset-hound-browser:12.2.0
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  basset-hound-browser:
    build:
      context: .
      dockerfile: Dockerfile
    image: basset-hound-browser:12.2.0
    container_name: basset-hound-browser
    
    # Restart policy
    restart: unless-stopped
    
    # Network configuration
    networks:
      - basset-hound-browser
    ports:
      - "8765:8765"
    
    # Environment
    environment:
      DISPLAY: :99
      SCREEN_RESOLUTION: 1920x1080x24
      ELECTRON_DISABLE_SANDBOX: '1'
      BASSET_LOG_LEVEL: info
      # BASSET_WS_PORT: 8765  # Override if needed
    
    # Volume mounts
    volumes:
      - basset-data:/app/data
      - ./downloads:/app/downloads
      - ./screenshots:/app/screenshots
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    
    # Security
    cap_drop:
      - ALL
    cap_add:
      - SYS_ADMIN
    security_opt:
      - no-new-privileges:true
    read_only: false
    
    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    
    # Health check
    healthcheck:
      test: curl -f http://localhost:8765 || exit 1
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

volumes:
  basset-data:
    driver: local

networks:
  basset-hound-browser:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## Networking & Storage

### Network Configuration

```bash
# Create custom network (if not using docker-compose)
docker network create basset-hound-browser \
  --driver bridge \
  --subnet 172.20.0.0/16

# List networks
docker network ls

# Inspect network
docker network inspect basset-hound-browser

# Connect container to network
docker network connect basset-hound-browser basset-hound-browser
```

### Volume Management

```bash
# Create volume
docker volume create basset-data

# List volumes
docker volume ls

# Inspect volume
docker volume inspect basset-data

# Mount volume to container
docker run -v basset-data:/app/data basset-hound-browser:12.2.0

# Backup volume
docker run --rm \
  -v basset-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/data.tar.gz /data

# Restore volume
docker volume rm basset-data
docker volume create basset-data
docker run --rm \
  -v basset-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/data.tar.gz -C /
```

### Storage Drivers

```bash
# Check current driver
docker info | grep "Storage Driver"

# Common drivers:
# - overlay2 (recommended for production)
# - btrfs (for advanced features)
# - aufs (legacy)

# Configure in /etc/docker/daemon.json
{
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
```

---

## Security Hardening

### Container Security

```bash
# Run with read-only root filesystem
docker run --read-only \
  -v /app/data:/app/data \
  basset-hound-browser:12.2.0

# Drop all capabilities
docker run --cap-drop=ALL \
  basset-hound-browser:12.2.0

# Add only needed capabilities
docker run --cap-add=SYS_ADMIN \
  basset-hound-browser:12.2.0

# Run as non-root user
docker run --user basset:basset \
  basset-hound-browser:12.2.0

# No new privileges
docker run --security-opt no-new-privileges:true \
  basset-hound-browser:12.2.0

# Disable seccomp (if needed)
docker run --security-opt seccomp=unconfined \
  basset-hound-browser:12.2.0
```

### Image Security

```bash
# Scan image for vulnerabilities
docker scan basset-hound-browser:12.2.0

# Run trivy scan
trivy image basset-hound-browser:12.2.0

# Sign image (if using Docker Content Trust)
docker trust signer add --key <key-path> mykey basset-hound-browser:12.2.0

# Push signed image
docker push basset-hound-browser:12.2.0
```

### Registry Security

```bash
# Use HTTPS only
# Configure in /etc/docker/daemon.json:
{
  "insecure-registries": [],
  "registry-mirrors": []
}

# Store credentials securely
docker login --username=user --password-stdin registry.example.com
# Credentials stored in ~/.docker/config.json (encrypted by credential helper)

# Use credential helper
{
  "credsStore": "pass"  # or osxkeychain, wincred
}
```

---

## Performance Tuning

### Docker Daemon Optimization

```bash
# Edit /etc/docker/daemon.json
{
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10,
  "ipv6": false,
  "icc": true,
  "bridge": "docker0"
}

# Restart daemon
sudo systemctl restart docker
```

### Container Resource Limits

```bash
# Memory limits
docker run --memory=2g --memory-swap=2g basset-hound-browser

# CPU limits
docker run --cpus=2 basset-hound-browser

# CPU shares (relative weighting)
docker run --cpu-shares=1024 basset-hound-browser

# Block I/O
docker run --blkio-weight=300 basset-hound-browser

# Ulimits
docker run --ulimit nofile=65535:65535 basset-hound-browser
```

### Monitoring Performance

```bash
# Real-time stats
docker stats basset-hound-browser

# Detailed stats
docker stats --no-stream --format \
  "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Event monitoring
docker events --filter container=basset-hound-browser

# Inspect system resources
docker system df
docker system info
```

---

## Troubleshooting Docker Issues

### Build Fails

```bash
# Show detailed build output
docker build --progress=plain -t basset-hound-browser:12.2.0 .

# Build specific stage
docker build --target <stage-name> -t basset-hound-browser:12.2.0 .

# Use BuildKit for better caching
DOCKER_BUILDKIT=1 docker build -t basset-hound-browser:12.2.0 .
```

### Runtime Issues

```bash
# Check logs
docker logs basset-hound-browser

# Follow logs
docker logs -f basset-hound-browser

# Get logs since specific time
docker logs --since 2h basset-hound-browser

# View with timestamps
docker logs -t basset-hound-browser

# Interactive shell
docker exec -it basset-hound-browser /bin/bash

# Debug running container
docker run -it --rm \
  --volumes-from basset-hound-browser \
  basset-hound-browser:12.2.0 /bin/bash
```

### Storage Issues

```bash
# Check storage usage
docker system df
docker volume ls -f dangling=true
docker image ls -f dangling=true

# Remove unused data
docker system prune -a --volumes

# Check volume content
docker run --rm -v basset-data:/data alpine ls -la /data

# Repair volume
docker run --rm -v basset-data:/data alpine fsck /data || true
```

---

**End of Docker Deployment Guide**

