# Basset Hound Browser - Headless Docker Container
# Runs the Electron browser in headless mode with Xvfb virtual display

FROM node:20-bullseye

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_SANDBOX=1

# Install system dependencies for Electron and Xvfb
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
    # Utilities
    wget \
    ca-certificates \
    procps \
    dbus \
    # For Tor repository setup
    apt-transport-https \
    gpg \
    netcat-openbsd \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# === TOR INSTALLATION ===
# Install Tor from Debian repository (stable version for Bullseye)
# Note: Tor Project's bullseye repo is no longer available, using Debian default
# obfs4proxy is not available in Bullseye, but embedded Tor can be used as fallback for bridges
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    tor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configure Tor for container use
RUN echo '# Basset Hound Browser - Docker Container Tor Configuration\n\
\n\
# SOCKS5 proxy for browser connections\n\
SocksPort 127.0.0.1:9050\n\
\n\
# Control port for circuit management (TorManager integration)\n\
ControlPort 127.0.0.1:9051\n\
\n\
# Data directory\n\
DataDirectory /var/lib/tor\n\
\n\
# Use cookie authentication for control port\n\
CookieAuthentication 1\n\
CookieAuthFile /var/lib/tor/control_auth_cookie\n\
CookieAuthFileGroupReadable 1\n\
\n\
# Restrict SOCKS connections to localhost only\n\
SocksPolicy accept 127.0.0.1\n\
SocksPolicy reject *\n\
\n\
# Safe logging\n\
SafeLogging 1\n\
\n\
# Avoid excessive disk writes\n\
AvoidDiskWrites 1\n\
\n\
# Circuit settings for predictable behavior\n\
CircuitBuildTimeout 30\n\
LearnCircuitBuildTimeout 0\n\
MaxCircuitDirtiness 600\n\
\n\
# Log to stdout for Docker log aggregation\n\
Log notice stdout\n\
' > /etc/tor/torrc \
    && chown debian-tor:debian-tor /etc/tor/torrc \
    && chmod 644 /etc/tor/torrc \
    && mkdir -p /var/lib/tor \
    && chown -R debian-tor:debian-tor /var/lib/tor \
    && chmod 700 /var/lib/tor

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including electron)
RUN npm install

# Copy application files
COPY . .

# Create runtime directories that need to be writable
RUN mkdir -p /app/automation/saved \
    /app/recordings/screenshots \
    /app/recordings/data \
    /app/bin/tor \
    /app/data \
    /app/screenshots \
    /app/downloads \
    /app/blocking-data

# Create non-root user for security
# Add basset user to debian-tor group for control port cookie authentication access
RUN groupadd -r basset && useradd -r -g basset basset \
    && usermod -aG debian-tor basset \
    && chown -R basset:basset /app

# Create directory for Xvfb lock files
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

# Expose WebSocket port
EXPOSE 8765

# Create startup script with Tor startup before Electron
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Add node_modules/.bin to PATH\n\
export PATH="/app/node_modules/.bin:$PATH"\n\
\n\
# === START TOR DAEMON ===\n\
# Start Tor if USE_SYSTEM_TOR is enabled (default: true)\n\
if [ "${USE_SYSTEM_TOR:-true}" = "true" ]; then\n\
    echo "Starting system Tor daemon as debian-tor user..."\n\
    # Run Tor as debian-tor user (required for proper permissions)\n\
    su -s /bin/bash debian-tor -c "tor -f /etc/tor/torrc" &\n\
    TOR_PID=$!\n\
    \n\
    # Wait for Tor SOCKS proxy to be ready\n\
    echo "Waiting for Tor to bootstrap..."\n\
    TIMEOUT=60\n\
    COUNTER=0\n\
    while [ $COUNTER -lt $TIMEOUT ]; do\n\
        if nc -z 127.0.0.1 9050 2>/dev/null; then\n\
            echo "Tor SOCKS proxy is ready on 127.0.0.1:9050"\n\
            break\n\
        fi\n\
        COUNTER=$((COUNTER+1))\n\
        sleep 1\n\
    done\n\
    \n\
    if [ $COUNTER -eq $TIMEOUT ]; then\n\
        echo "WARNING: Tor failed to start within ${TIMEOUT}s, falling back to embedded Tor"\n\
    else\n\
        # Also verify control port is available\n\
        if nc -z 127.0.0.1 9051 2>/dev/null; then\n\
            echo "Tor control port is ready on 127.0.0.1:9051"\n\
        else\n\
            echo "WARNING: Tor control port not available"\n\
        fi\n\
    fi\n\
else\n\
    echo "USE_SYSTEM_TOR=false, skipping system Tor (will use embedded Tor)"\n\
fi\n\
\n\
# === START XVFB ===\n\
# Start Xvfb virtual display\n\
echo "Starting Xvfb on display ${DISPLAY}..."\n\
Xvfb ${DISPLAY} -screen 0 ${SCREEN_RESOLUTION:-1920x1080x24} -ac &\n\
XVFB_PID=$!\n\
\n\
# Wait for Xvfb to be ready\n\
sleep 2\n\
\n\
# Verify display is available\n\
if ! xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; then\n\
    echo "ERROR: Failed to start Xvfb"\n\
    exit 1\n\
fi\n\
\n\
echo "Xvfb started successfully"\n\
\n\
# === START ELECTRON ===\n\
# Start the Electron browser in headless mode\n\
echo "Starting Basset Hound Browser in headless mode..."\n\
exec electron . --headless --disable-gpu --no-sandbox --virtual-display "$@"\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Health check - verify WebSocket server is responding (returns 426 Upgrade Required for HTTP)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -s -o /dev/null -w "%{http_code}" http://localhost:8765 | grep -q "426" || exit 1

# Use the startup script as entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command (can be overridden)
CMD []
