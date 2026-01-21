# Docker Container System-Level Tor Setup Research

**Date**: January 21, 2026
**Project**: Basset Hound Browser
**Status**: Research Document
**Author**: Development Team

---

## Executive Summary

This document provides comprehensive research for setting up system-level Tor in the basset-hound-browser Docker container as an alternative to the current portable/embedded Tor approach. The current Dockerfile uses `node:20-bullseye` (Debian Bullseye) as the base image.

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Installing Tor in Docker Container](#installing-tor-in-docker-container)
3. [Configuring Tor Automatic Startup](#configuring-tor-automatic-startup)
4. [SOCKS Proxy Configuration (Port 9050)](#socks-proxy-configuration-port-9050)
5. [Basset Hound Browser Permission Requirements](#basset-hound-browser-permission-requirements)
6. [Pros and Cons: System Tor vs Embedded/Portable Tor](#pros-and-cons-system-tor-vs-embeddedportable-tor)
7. [Recommendations](#recommendations)
8. [Implementation Plan](#implementation-plan)

---

## 1. Current Architecture Overview

### Current Dockerfile Base
The existing Dockerfile at `/home/devel/basset-hound-browser/Dockerfile` uses:

```dockerfile
FROM node:20-bullseye
```

This is a Debian Bullseye-based image, which provides excellent compatibility with the official Tor Project repositories.

### Current Tor Integration
The project currently supports two Tor modes:

1. **Embedded Tor** (`tor-auto-setup.js`): Downloads and runs Tor Expert Bundle at runtime
2. **External Tor** (`tor.js`): Connects to an existing Tor instance on the host

**Current embedded Tor approach** (from `utils/tor-auto-setup.js`):
- Downloads Tor Expert Bundle v15.0.3 (Tor daemon v0.4.8.21)
- Platform-specific downloads from archive.torproject.org
- Self-contained with pluggable transports (obfs4, meek, snowflake)
- Stores data in `/app/bin/tor/`

### Key Configuration (from `proxy/tor.js`)
- SOCKS Host: `127.0.0.1`
- SOCKS Port: `9050`
- Control Host: `127.0.0.1`
- Control Port: `9051`

---

## 2. Installing Tor in Docker Container

### Option A: Debian Package Installation (Recommended for Bullseye Base)

Since the Dockerfile already uses `node:20-bullseye`, installing Tor from Debian packages is straightforward.

#### Method 1: Official Tor Project Repository (Latest Version)

```dockerfile
# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https \
    gpg \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Add Tor Project GPG key and repository
RUN wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --dearmor -o /usr/share/keyrings/tor-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org bullseye main" > /etc/apt/sources.list.d/tor.list

# Install Tor
RUN apt-get update && apt-get install -y --no-install-recommends \
    tor \
    deb.torproject.org-keyring \
    obfs4proxy \
    && rm -rf /var/lib/apt/lists/*
```

**Resulting Version**: Tor 0.4.8.x (latest stable from Tor Project)

#### Method 2: Debian Default Repository (Simpler, Older Version)

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    tor \
    && rm -rf /var/lib/apt/lists/*
```

**Resulting Version**: Tor version available in Debian Bullseye repositories (may be older)

### Option B: Alpine Linux Alternative

If switching to Alpine for smaller image size:

```dockerfile
FROM alpine:latest

RUN apk add --no-cache tor curl
```

**Note**: This would require significant changes to the Dockerfile since the current base is Debian.

### Package Dependencies

For Debian Bullseye, Tor installation adds approximately:
- `tor` - Main daemon (~2MB)
- `libevent-2.1-7` - Event notification library
- `libseccomp2` - Seccomp filter library
- `obfs4proxy` - Pluggable transport (~8MB, optional)

Total additional size: ~15-25MB depending on transport selection.

---

## 3. Configuring Tor Automatic Startup

Docker containers typically run a single main process. Since basset-hound-browser needs both Tor and the Electron application, there are several approaches:

### Approach 1: Bash Script with Background Process (Current Pattern)

The existing entrypoint already starts Xvfb in the background. Tor can be added similarly:

```bash
#!/bin/bash
set -e

# Start Tor in the background
echo "Starting Tor daemon..."
tor -f /etc/tor/torrc &
TOR_PID=$!

# Wait for Tor to bootstrap
for i in {1..30}; do
    if curl -s --socks5 127.0.0.1:9050 --max-time 5 https://check.torproject.org/api/ip >/dev/null 2>&1; then
        echo "Tor is ready"
        break
    fi
    echo "Waiting for Tor... ($i/30)"
    sleep 2
done

# Start Xvfb virtual display
Xvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION:-1920x1080x24} -ac &
XVFB_PID=$!

# Start Electron
exec electron . --headless --disable-gpu --no-sandbox --virtual-display "$@"
```

### Approach 2: Using Tini Init System

Tini is recommended for proper signal handling in containers:

```dockerfile
# Install tini
RUN apt-get update && apt-get install -y --no-install-recommends tini

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
```

Alternatively, use Docker's built-in init:
```bash
docker run --init basset-hound-browser
```

### Approach 3: Supervisord for Multi-Process Management

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends supervisor

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord"]
```

**supervisord.conf**:
```ini
[supervisord]
nodaemon=true
user=root

[program:tor]
command=/usr/bin/tor -f /etc/tor/torrc
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
user=debian-tor

[program:xvfb]
command=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
user=root

[program:basset-hound]
command=/app/node_modules/.bin/electron . --headless --disable-gpu --no-sandbox --virtual-display
directory=/app
autorestart=false
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
user=basset
environment=DISPLAY=":99",ELECTRON_DISABLE_SANDBOX="1"
```

### Recommended: Approach 1 (Simple Background Process)

The bash script approach aligns with the existing Dockerfile pattern and avoids additional complexity.

---

## 4. SOCKS Proxy Configuration (Port 9050)

### Tor Configuration File (`/etc/tor/torrc`)

Create a custom torrc for container use:

```
# Basset Hound Browser - Docker Container Tor Configuration
# Generated for container deployment

#######################################
# Network Configuration
#######################################

# SOCKS5 proxy for browser connections
SocksPort 127.0.0.1:9050

# Control port for circuit management (TorManager integration)
ControlPort 127.0.0.1:9051

# DNS port (optional)
DNSPort 127.0.0.1:9053

#######################################
# Data Storage
#######################################

# Data directory (inside container)
DataDirectory /var/lib/tor

# Avoid excessive disk writes
AvoidDiskWrites 1

#######################################
# Authentication
#######################################

# Use cookie authentication (simpler for local use)
CookieAuthentication 1

# Alternatively, use hashed password:
# HashedControlPassword 16:YOUR_HASHED_PASSWORD_HERE

#######################################
# Security
#######################################

# Restrict SOCKS connections to localhost only
SocksPolicy accept 127.0.0.1
SocksPolicy reject *

# Safe logging (don't log sensitive data)
SafeLogging 1

#######################################
# Performance
#######################################

# Circuit build timeout (seconds)
CircuitBuildTimeout 30

# Disable learning for predictable behavior
LearnCircuitBuildTimeout 0

# Maximum circuit age
MaxCircuitDirtiness 600

#######################################
# Logging
#######################################

# Log to stdout for Docker log aggregation
Log notice stdout
```

### Dockerfile Configuration Steps

```dockerfile
# Copy custom torrc
COPY torrc /etc/tor/torrc

# Set correct ownership and permissions
RUN chown debian-tor:debian-tor /etc/tor/torrc \
    && chmod 644 /etc/tor/torrc \
    && mkdir -p /var/lib/tor \
    && chown -R debian-tor:debian-tor /var/lib/tor \
    && chmod 700 /var/lib/tor
```

---

## 5. Basset Hound Browser Permission Requirements

### Electron SOCKS Proxy Configuration

The existing `TorManager` class in `/home/devel/basset-hound-browser/proxy/tor.js` is already designed to work with system Tor. No code changes are required for basic functionality.

Key integration points:

```javascript
// From TorManager.getProxyRules()
return `socks5://${this.socksHost}:${this.socksPort}`;
// Returns: "socks5://127.0.0.1:9050"
```

### Control Port Access

For advanced features (new identity, circuit info), the application needs access to the control port:

1. **Cookie Authentication**: The application user needs read access to the cookie file
   ```dockerfile
   # Add basset user to debian-tor group for cookie access
   RUN usermod -aG debian-tor basset
   ```

2. **Password Authentication**: Configure in torrc
   ```
   HashedControlPassword 16:YOUR_HASH
   ```
   And set in environment:
   ```dockerfile
   ENV TOR_CONTROL_PASSWORD=your_password
   ```

### DNS Leak Prevention

Electron requires special handling to prevent DNS leaks:

```javascript
// Command line flags for Electron
app.commandLine.appendSwitch('proxy-server', 'socks5://127.0.0.1:9050');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND , EXCLUDE 127.0.0.1');
```

The existing `AdvancedTorManager` handles this correctly.

### Container Network Considerations

- **No special network permissions required** for localhost Tor access
- The existing `cap_add: SYS_ADMIN` in docker-compose.yml is for Electron sandbox, not Tor
- No firewall changes needed as everything runs on localhost

---

## 6. Pros and Cons: System Tor vs Embedded/Portable Tor

### System Tor (apt-get installed in container)

#### Pros

| Advantage | Description |
|-----------|-------------|
| **Smaller image size** | Shared libraries, no duplicate binaries (~15MB vs ~80MB for embedded bundle) |
| **System integration** | Standard paths, systemd/init.d integration, proper service management |
| **Automatic updates** | Security patches via apt-get upgrade during image rebuild |
| **Consistent configuration** | Standard `/etc/tor/torrc` location, familiar to administrators |
| **Better process management** | Proper signal handling, zombie reaping with init system |
| **Official package** | Maintained by Tor Project, properly tested for the distribution |
| **Shared resources** | GeoIP databases, certificates shared with system |
| **Logging integration** | Works with Docker log drivers, journald, syslog |

#### Cons

| Disadvantage | Description |
|--------------|-------------|
| **Version lag** | Debian packages may lag behind latest Tor releases |
| **Less portable** | Tied to specific base image (Debian vs Alpine) |
| **Build complexity** | Requires repository setup, GPG key management |
| **User permissions** | Need to manage debian-tor user/group for cookie auth |
| **Startup dependency** | Must ensure Tor starts before application |

### Embedded/Portable Tor (Current approach)

#### Pros

| Advantage | Description |
|-----------|-------------|
| **Latest version** | Always uses specified Tor Expert Bundle version (currently v15.0.3) |
| **Self-contained** | All dependencies included, no external repository needed |
| **Cross-platform** | Same approach works on Linux, macOS, Windows |
| **Full transport support** | Includes all pluggable transports (lyrebird, conjure) |
| **No root required** | Can run entirely as non-root user |
| **Flexible location** | Binary stored in application directory (`/app/bin/tor/`) |
| **Easy updates** | Just change version constant in `tor-auto-setup.js` |

#### Cons

| Disadvantage | Description |
|--------------|-------------|
| **Larger image size** | Each container carries full Tor bundle (~80MB extracted) |
| **Download on first run** | Initial startup delay for auto-setup (~30-60 seconds) |
| **Library path issues** | May need LD_LIBRARY_PATH configuration |
| **Duplicate resources** | Each container has own GeoIP databases |
| **Manual updates** | Must update code to change Tor version |
| **Security patching** | Requires code change, not simple apt upgrade |
| **Build time download** | May fail if archive.torproject.org is unreachable |

### Comparison Summary

| Factor | System Tor | Embedded Tor | Winner |
|--------|------------|--------------|--------|
| Image size | ~15MB added | ~80MB added | System |
| Startup time | Fast (pre-installed) | Slow first run | System |
| Version control | Debian/Tor Project | Developer | Embedded |
| Maintenance | apt-get upgrade | Code change | System |
| Portability | Debian-specific | Cross-platform | Embedded |
| Complexity | Moderate | Low | Embedded |
| Production use | Preferred | Development | System |
| Air-gapped deploy | Works | Needs download | System |

---

## 7. Recommendations

### For Docker/Production Deployment

**Recommendation: Use System Tor**

Rationale:
1. **Smaller image footprint** reduces storage and transfer costs
2. **Faster container startup** as Tor is pre-installed
3. **Security updates** can be applied with standard apt-get upgrade
4. **Better suited for orchestration** (Kubernetes, Docker Swarm)
5. **Consistent with container best practices** (immutable infrastructure)

### For Development/Testing

**Keep Embedded Tor as an option**

Rationale:
1. **Easy local development** without system Tor installation
2. **Version pinning** for reproducible builds
3. **Cross-platform development** on macOS/Windows

### Hybrid Approach (Best of Both)

Implement detection logic in the application:

```javascript
// In main.js or tor initialization
const systemTorAvailable = await checkSystemTor();
const embeddedTorAvailable = await checkEmbeddedTor();

if (process.env.USE_SYSTEM_TOR === 'true' && systemTorAvailable) {
  await torManager.connectExisting({ socksPort: 9050, controlPort: 9051 });
} else if (embeddedTorAvailable) {
  await embeddedTorManager.start();
} else {
  // Download and setup embedded Tor
  await torAutoSetup.ensureEmbeddedTor();
  await embeddedTorManager.start();
}
```

---

## 8. Implementation Plan

### Phase 1: Dockerfile Modifications

1. Add Tor package installation to Dockerfile
2. Create container-optimized torrc configuration
3. Update entrypoint script to start Tor
4. Add health check for Tor connectivity

### Phase 2: Configuration Options

1. Add environment variable `USE_SYSTEM_TOR` (default: true in Docker)
2. Keep embedded Tor code for fallback
3. Update docker-compose.yml with Tor volume mount (optional)

### Phase 3: Testing

1. Build test image with system Tor
2. Verify SOCKS proxy functionality
3. Test control port commands (new identity, circuit info)
4. Performance comparison (startup time, memory usage)
5. Security audit (no DNS leaks, proper isolation)

### Proposed Dockerfile Changes (Preview)

```dockerfile
# === TOR INSTALLATION ===
# Add Tor Project repository for latest stable version
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https \
    gpg \
    && wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc \
       | gpg --dearmor -o /usr/share/keyrings/tor-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org bullseye main" \
       > /etc/apt/sources.list.d/tor.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       tor \
       deb.torproject.org-keyring \
       obfs4proxy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy Tor configuration
COPY docker/torrc /etc/tor/torrc

# Configure Tor permissions
RUN chown debian-tor:debian-tor /etc/tor/torrc \
    && chmod 644 /etc/tor/torrc

# Add basset user to debian-tor group for control port access
RUN usermod -aG debian-tor basset
```

### Updated Entrypoint Script (Preview)

```bash
#!/bin/bash
set -e

export PATH="/app/node_modules/.bin:$PATH"

# Start Tor if USE_SYSTEM_TOR is enabled (default: true)
if [ "${USE_SYSTEM_TOR:-true}" = "true" ]; then
    echo "Starting system Tor daemon..."
    tor -f /etc/tor/torrc &
    TOR_PID=$!

    # Wait for Tor to be ready
    echo "Waiting for Tor to bootstrap..."
    TIMEOUT=60
    COUNTER=0
    while [ $COUNTER -lt $TIMEOUT ]; do
        if nc -z 127.0.0.1 9050 2>/dev/null; then
            echo "Tor SOCKS proxy is ready on port 9050"
            break
        fi
        COUNTER=$((COUNTER+1))
        sleep 1
    done

    if [ $COUNTER -eq $TIMEOUT ]; then
        echo "WARNING: Tor failed to start within ${TIMEOUT}s"
    fi
fi

# Start Xvfb virtual display
echo "Starting Xvfb on display ${DISPLAY}..."
Xvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION:-1920x1080x24} -ac &
XVFB_PID=$!

sleep 2

if ! xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; then
    echo "ERROR: Failed to start Xvfb"
    exit 1
fi

echo "Xvfb started successfully"
echo "Starting Basset Hound Browser in headless mode..."
exec electron . --headless --disable-gpu --no-sandbox --virtual-display "$@"
```

---

## References

### Official Documentation
- [Tor Project Installation Guide](https://support.torproject.org/little-t-tor/getting-started/installing/)
- [Debian Tor Package](https://packages.debian.org/bullseye/tor)
- [Docker Multi-Process Containers](https://docs.docker.com/engine/containers/multi-service_container/)
- [Tini Init System](https://github.com/krallin/tini)

### Alpine Linux Resources
- [Alpine Tor Package](https://pkgs.alpinelinux.org/package/edge/community/x86/tor)
- [Alpine Tor Wiki](https://wiki.alpinelinux.org/wiki/Tor)

### Docker Tor Images
- [zuazo/alpine-tor-docker](https://github.com/zuazo/alpine-tor-docker)
- [andrius/alpine-tor](https://github.com/andrius/alpine-tor)
- [Barney Buffet Docker Tor](https://barneybuffet.github.io/docker-tor/)

### Electron Proxy Configuration
- [Electron ProxyConfig](https://www.electronjs.org/docs/latest/api/structures/proxy-config)
- [Electron Proxy Agent](https://www.npmjs.com/package/electron-proxy-agent)

---

## Conclusion

System-level Tor installation is recommended for the Docker deployment of basset-hound-browser. It provides:

1. **Smaller image size** (~65MB savings)
2. **Faster startup** (no download required)
3. **Better security** (standard update path)
4. **Production readiness** (proper service management)

The existing TorManager code requires no modifications and will work seamlessly with system Tor running on `127.0.0.1:9050` (SOCKS) and `127.0.0.1:9051` (Control).

The embedded Tor functionality should be retained for development use and as a fallback mechanism when system Tor is unavailable.

---

*Document created: January 21, 2026*
*For Basset Hound Browser Docker Deployment*
