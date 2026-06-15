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
    && useradd -r -g basset -u 1001 basset \
    && usermod -aG debian-tor basset \
    && chown -R basset:basset /app

# Create startup script - start services and WebSocket server
# P1-001 FIX: Start Xvfb BEFORE any Node.js code runs
RUN printf '#!/bin/bash\nset -e\n\nexport PATH="/app/node_modules/.bin:$PATH"\n\necho "[startup] Container environment ready"\necho "[startup] WebSocket server port: 8765"\necho "[startup] Node version: $(node --version)"\necho "[startup] Electron version: $(electron --version)"\necho "[startup] Tor status: ${USE_SYSTEM_TOR:-true}"\necho "[startup] Display: ${DISPLAY}"\necho "[startup]"\n\n# P1-001: Start Xvfb virtual display FIRST before any app code\n# This is critical for Electron to start in Docker\necho "[startup] Starting Xvfb virtual display..."\nXvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION:-1920x1080x24} -ac -noreset 2>&1 >/dev/null &\nXVFB_PID=$!\necho "[startup] Xvfb started (PID: $XVFB_PID)"\nsleep 1  # Give Xvfb time to initialize\n\n# Verify Xvfb is running\nif ! kill -0 $XVFB_PID 2>/dev/null; then\n    echo "[startup] ERROR: Xvfb failed to start!"\n    exit 1\nfi\necho "[startup] Xvfb verified running on $DISPLAY"\n\n# Start Tor if enabled\nif [ "${USE_SYSTEM_TOR:-true}" = "true" ]; then\n    echo "[startup] Starting Tor daemon..."\n    sudo -u debian-tor tor -f /etc/tor/torrc >/dev/null 2>&1 &\n    sleep 2\nfi\n\necho "[startup] Services initialized - starting WebSocket server"\necho "[startup] Starting Electron + Node.js WebSocket server..."\n\n# Start app with Xvfb display set\n# The app will initialize Electron which requires a display (now provided by Xvfb)\ncd /app && npm start\n' > /app/docker-entrypoint.sh && \
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
RUN chmod +x /app/health-check.sh

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
