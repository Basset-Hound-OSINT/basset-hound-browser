# Basset Hound Browser - Multi-Stage Optimized Dockerfile
# Optimizes image size, security, and caching with 3 build stages
# Stage 1: Builder - Node dependencies compilation
# Stage 2: Runtime - Minimal runtime environment
# Stage 3: Final - Hardened production image

# ============================================================================
# STAGE 1: BUILDER - Node.js dependencies and compilation
# ============================================================================
FROM node:20-bullseye AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies only needed during build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    git \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy package files for dependency resolution
COPY package*.json ./

# Install dependencies (with caching optimization)
RUN npm ci --no-optional --prefer-offline

# Build any native modules
RUN npm run build --if-present || true

# ============================================================================
# STAGE 2: RUNTIME BASE - System libraries and Tor
# ============================================================================
FROM node:20-bullseye-slim AS runtime-base

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_SANDBOX=1

# Install runtime dependencies only (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Xvfb for virtual display
    xvfb \
    # X11 utilities
    x11-utils \
    x11-xserver-utils \
    # Required libraries for Electron
    libgtk-3-0 \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libglib2.0-0 \
    libnspr4 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcursor1 \
    libxi6 \
    libxrender1 \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    # System utilities
    wget \
    ca-certificates \
    procps \
    dbus \
    netcat-openbsd \
    curl \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Tor from Debian repository
RUN apt-get update \
    && apt-get install -y --no-install-recommends tor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configure Tor for container environment
RUN echo 'SocksPort 127.0.0.1:9050\n\
ControlPort 127.0.0.1:9051\n\
DataDirectory /var/lib/tor\n\
CookieAuthentication 1\n\
CookieAuthFile /var/lib/tor/control_auth_cookie\n\
CookieAuthFileGroupReadable 1\n\
SocksPolicy accept 127.0.0.1\n\
SocksPolicy reject *\n\
SafeLogging 1\n\
AvoidDiskWrites 1\n\
CircuitBuildTimeout 30\n\
LearnCircuitBuildTimeout 0\n\
MaxCircuitDirtiness 600\n\
Log notice stdout\n' > /etc/tor/torrc \
    && chown debian-tor:debian-tor /etc/tor/torrc \
    && chmod 644 /etc/tor/torrc \
    && mkdir -p /var/lib/tor \
    && chown -R debian-tor:debian-tor /var/lib/tor \
    && chmod 700 /var/lib/tor

# ============================================================================
# STAGE 3: FINAL - Production image with optimizations
# ============================================================================
FROM runtime-base AS production

LABEL maintainer="Basset Hound Team <basset@example.com>"
LABEL version="12.0.0"
LABEL description="Basset Hound Browser - OSINT automation platform"

WORKDIR /app

# Copy pre-built node_modules from builder stage
COPY --from=builder --chown=root:root /build/node_modules ./node_modules

# Copy application source code
COPY --chown=root:root . .

# Create runtime directories with proper permissions
RUN mkdir -p \
    /app/automation/saved \
    /app/recordings/screenshots \
    /app/recordings/data \
    /app/bin/tor \
    /app/data \
    /app/screenshots \
    /app/downloads \
    /app/blocking-data \
    /app/logs \
    /tmp/.X11-unix \
    && chmod 1777 /tmp/.X11-unix

# Security hardening: Create non-root user
RUN groupadd -r basset \
    && useradd -r -g basset -u 1000 basset \
    && usermod -aG debian-tor basset \
    && chown -R basset:basset /app

# Create startup script with enhanced features
RUN cat > /app/docker-entrypoint.sh << 'EOF'
#!/bin/bash
set -e

# Redirect output to both stdout and log file
exec 1> >(tee -a /app/logs/startup.log)
exec 2>&1

export PATH="/app/node_modules/.bin:$PATH"

# Health check function
check_service() {
    local service=$1
    local port=$2
    local timeout=${3:-30}
    local counter=0

    while [ $counter -lt $timeout ]; do
        if nc -z 127.0.0.1 $port 2>/dev/null; then
            echo "✓ $service is ready on port $port"
            return 0
        fi
        counter=$((counter+1))
        sleep 1
    done

    echo "⚠ $service failed to start within ${timeout}s"
    return 1
}

# Start Tor if enabled
if [ "${USE_SYSTEM_TOR:-true}" = "true" ]; then
    echo "[startup] Starting Tor daemon..."
    su -s /bin/bash debian-tor -c "tor -f /etc/tor/torrc" &
    TOR_PID=$!
    check_service "Tor SOCKS" 9050 60 || true
    check_service "Tor Control" 9051 10 || true
else
    echo "[startup] Skipping system Tor (USE_SYSTEM_TOR=false)"
fi

# Start Xvfb virtual display
echo "[startup] Starting Xvfb on display ${DISPLAY}..."
Xvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION:-1920x1080x24} -ac -noreset &
XVFB_PID=$!
sleep 2

if ! xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; then
    echo "[error] Failed to start Xvfb"
    exit 1
fi
echo "✓ Xvfb started successfully"

# Start Basset Hound Browser
echo "[startup] Starting Basset Hound Browser..."
exec electron . --headless --disable-gpu --no-sandbox --virtual-display "$@"
EOF
chmod +x /app/docker-entrypoint.sh

# Create health check script
RUN cat > /app/health-check.sh << 'EOF'
#!/bin/bash
# Health check: verify WebSocket server is responding
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765 2>/dev/null || echo "000")
if [ "$HEALTH" = "426" ]; then
    exit 0
else
    exit 1
fi
EOF
chmod +x /app/health-check.sh

# Switch to non-root user
USER basset

# Expose WebSocket port
EXPOSE 8765

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /app/health-check.sh

# Set entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD []
