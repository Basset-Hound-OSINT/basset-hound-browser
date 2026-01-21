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
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
RUN groupadd -r basset && useradd -r -g basset basset \
    && chown -R basset:basset /app

# Create directory for Xvfb lock files
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

# Expose WebSocket port
EXPOSE 8765

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Add node_modules/.bin to PATH\n\
export PATH="/app/node_modules/.bin:$PATH"\n\
\n\
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
