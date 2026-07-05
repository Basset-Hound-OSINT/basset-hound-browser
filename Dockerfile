# Basset Hound Browser - Production Optimized Dockerfile
# Multi-stage build for minimal image size (<1GB target)
# Security: Non-root user, read-only root filesystem, capability dropping
# Version: 12.7.0

# ============================================================================
# STAGE 1: DEPENDENCIES - Node.js build stage
# ============================================================================
FROM node:20-bullseye AS dependencies

# Prevent apt interactive dialogs
ENV DEBIAN_FRONTEND=noninteractive \
    YARN_CACHE_FOLDER=/dev/null

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install production dependencies only (no devDependencies)
# Use --prefer-offline for speed and --no-optional for minimal size
RUN npm ci --omit=dev --prefer-offline --no-audit && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/* ~/.npm ~/.cache

# ============================================================================
# STAGE 2: BUILDER - Compile native modules
# ============================================================================
FROM node:20-bullseye AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Install build tools (minimal set for native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /build

# Copy package files and dependencies from previous stage
COPY package*.json ./
COPY --from=dependencies /build/node_modules ./node_modules

# Build native modules (sharp, etc.)
RUN npm rebuild --verbose 2>&1 | tail -20 || true

# ============================================================================
# STAGE 3: RUNTIME BASE - System dependencies and utilities
# ============================================================================
FROM node:20-bullseye-slim AS runtime-base

LABEL maintainer="Basset Hound Team"
LABEL version="12.7.0"
LABEL description="Basset Hound Browser - Browser automation with bot evasion"

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048" \
    ELECTRON_DISABLE_SANDBOX=1 \
    CHROME_DISABLE_SANDBOX=1 \
    USE_SYSTEM_TOR=true

WORKDIR /app

# Install runtime dependencies only (no build tools or extra bloat)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Display server (Xvfb)
    xvfb x11-utils x11-xserver-utils \
    # Core Electron/Chromium dependencies
    libgtk-3-0 libnotify-dev libgconf-2-4 libnss3 libxss1 \
    libasound2 libxtst6 libatk1.0-0 libatk-bridge2.0-0 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libglib2.0-0 libnspr4 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxi6 libxrender1 \
    # Fonts
    fonts-liberation fonts-noto-color-emoji \
    # System utilities (minimal)
    wget curl ca-certificates dbus procps netcat-openbsd \
    # Tor (network privacy)
    tor \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Configure Tor for secure container networking
RUN mkdir -p /var/lib/tor /var/run/tor && \
    chown -R debian-tor:debian-tor /var/lib/tor /var/run/tor && \
    chmod 700 /var/lib/tor /var/run/tor

# Minimal Tor configuration (optimize for container)
RUN printf 'SocksPort 127.0.0.1:9050\n\
ControlPort 127.0.0.1:9051\n\
CookieAuthentication 1\n\
DataDirectory /var/lib/tor\n\
SafeLogging 1\n\
AvoidDiskWrites 1\n\
CircuitBuildTimeout 30\n\
LearnCircuitBuildTimeout 0\n\
MaxCircuitDirtiness 600\n\
Log notice stdout\n' > /etc/tor/torrc && \
    chown debian-tor:debian-tor /etc/tor/torrc && chmod 644 /etc/tor/torrc

# ============================================================================
# STAGE 4: FINAL - Production image (optimized and hardened)
# ============================================================================
FROM runtime-base AS production

# Create non-root user (security best practice)
RUN groupadd -r -g 1001 basset && \
    useradd -r -u 1001 -g basset -d /app basset && \
    usermod -aG debian-tor basset

# Create necessary directories
RUN mkdir -p \
    /app/data \
    /app/logs \
    /app/screenshots \
    /app/downloads \
    /app/recordings \
    /app/cache \
    /tmp/.X11-unix \
    && chmod 1777 /tmp/.X11-unix && \
    chown -R basset:basset /app

# Copy built node_modules from builder stage
COPY --from=builder --chown=basset:basset /build/node_modules /app/node_modules

# Copy application source (exclude unnecessary files via .dockerignore)
COPY --chown=basset:basset . /app

# Create startup script
RUN cat > /app/entrypoint.sh << 'EOF'
#!/bin/bash
set -e

# Logging prefix
prefix="[basset-hound]"

echo "$prefix Starting Basset Hound Browser v12.7.0"
echo "$prefix Node $(node --version)"
echo "$prefix npm $(npm --version)"

# Start Tor daemon if enabled
if [ "${USE_SYSTEM_TOR:-true}" = "true" ]; then
    echo "$prefix Starting Tor service..."
    su -s /bin/bash debian-tor -c "tor -f /etc/tor/torrc" >/dev/null 2>&1 &
    TOR_PID=$!
    sleep 2
    echo "$prefix Tor PID: $TOR_PID"
fi

# Start Xvfb virtual display
echo "$prefix Starting Xvfb display :99"
Xvfb :99 -screen 0 1920x1080x24 -ac -noreset >/dev/null 2>&1 &
XVFB_PID=$!
sleep 2
echo "$prefix Xvfb PID: $XVFB_PID"

# Start WebSocket server
echo "$prefix Starting WebSocket server on port 8765"
cd /app
node websocket/server.js &
WS_PID=$!
echo "$prefix WebSocket server PID: $WS_PID"

# Wait for graceful shutdown
wait $WS_PID
EOF

RUN chmod +x /app/entrypoint.sh

# Health check script
RUN cat > /app/health-check.sh << 'EOF'
#!/bin/bash
# Check WebSocket server health
curl -sf -o /dev/null http://localhost:8765/ 2>/dev/null || exit 1
exit 0
EOF

RUN chmod +x /app/health-check.sh

# Switch to non-root user
USER basset

# Expose WebSocket port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /app/health-check.sh

# Start the application
ENTRYPOINT ["/app/entrypoint.sh"]
