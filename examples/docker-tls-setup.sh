#!/bin/bash

###############################################################################
# Docker WSS (WebSocket Secure) Setup Script
#
# Enables TLS/SSL for Basset Hound Browser in Docker with multiple options:
# - Development: Self-signed certificates
# - Production: Let's Encrypt with automatic renewal
# - Enterprise: Custom CA certificates
#
# Usage:
#   ./docker-tls-setup.sh dev|prod|enterprise [options]
#
# Examples:
#   ./docker-tls-setup.sh dev                                    # Dev self-signed
#   ./docker-tls-setup.sh prod --domain browser.example.com      # Prod Let's Encrypt
#   ./docker-tls-setup.sh enterprise --cert /path/to/cert.pem   # Enterprise CA
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"
DOCKER_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Defaults
ENVIRONMENT=${1:-dev}
DOMAIN=${DOMAIN:-browser.example.com}
EMAIL=${EMAIL:-admin@example.com}
CERT_DAYS=${CERT_DAYS:-365}
RSA_KEY_SIZE=${RSA_KEY_SIZE:-2048}

###############################################################################
# Utility Functions
###############################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    log_error "Command not found: $1"
    log_info "Install with: $2"
    exit 1
  fi
}

###############################################################################
# Certificate Generation
###############################################################################

generate_self_signed_cert() {
  local common_name=$1
  local days=$2
  local key_size=$3

  log_info "Generating self-signed certificate..."
  log_info "  Common Name: $common_name"
  log_info "  Days Valid: $days"
  log_info "  Key Size: $key_size bits"

  mkdir -p "$CERTS_DIR"

  openssl genrsa \
    -out "${CERTS_DIR}/${common_name}.key" \
    "$key_size" 2>/dev/null

  openssl req -new -x509 \
    -key "${CERTS_DIR}/${common_name}.key" \
    -out "${CERTS_DIR}/${common_name}.crt" \
    -days "$days" \
    -subj "/CN=${common_name}/O=Basset Hound/C=US" \
    2>/dev/null

  # Create cert symlinks for standard names
  ln -sf "${common_name}.crt" "${CERTS_DIR}/cert.pem"
  ln -sf "${common_name}.key" "${CERTS_DIR}/key.pem"

  # Fix permissions
  chmod 644 "${CERTS_DIR}/${common_name}.crt"
  chmod 600 "${CERTS_DIR}/${common_name}.key"
  chmod 644 "${CERTS_DIR}/cert.pem"
  chmod 600 "${CERTS_DIR}/key.pem"

  log_success "Certificate generated: ${CERTS_DIR}/${common_name}.crt"
  log_success "Private key: ${CERTS_DIR}/${common_name}.key"

  # Show certificate info
  log_info "Certificate details:"
  openssl x509 -in "${CERTS_DIR}/${common_name}.crt" -text -noout | \
    grep -E "Subject:|Issuer:|Not Before|Not After|Public-Key" | \
    sed 's/^/  /'
}

setup_letsencrypt() {
  local domain=$1
  local email=$2

  check_command "certbot" "apt-get install certbot (Ubuntu/Debian) or brew install certbot (macOS)"

  log_info "Setting up Let's Encrypt certificate..."
  log_info "  Domain: $domain"
  log_info "  Email: $email"

  mkdir -p "$CERTS_DIR"

  # Check if cert already exists
  if [ -d "/etc/letsencrypt/live/$domain" ]; then
    log_warn "Certificate already exists for $domain"
    log_info "Using existing certificate"
    cp "/etc/letsencrypt/live/$domain/fullchain.pem" "${CERTS_DIR}/cert.pem"
    cp "/etc/letsencrypt/live/$domain/privkey.pem" "${CERTS_DIR}/key.pem"
  else
    # Generate new certificate
    log_info "Generating new Let's Encrypt certificate (requires port 80)..."
    certbot certonly --standalone \
      --agree-tos \
      --non-interactive \
      -m "$email" \
      -d "$domain" \
      --preferred-challenges http

    cp "/etc/letsencrypt/live/$domain/fullchain.pem" "${CERTS_DIR}/cert.pem"
    cp "/etc/letsencrypt/live/$domain/privkey.pem" "${CERTS_DIR}/key.pem"
  fi

  chmod 644 "${CERTS_DIR}/cert.pem"
  chmod 600 "${CERTS_DIR}/key.pem"

  log_success "Let's Encrypt certificate installed"

  # Setup auto-renewal
  setup_renewal_timer
}

setup_renewal_timer() {
  log_info "Setting up certificate renewal timer..."

  # Create renewal script
  cat > /usr/local/bin/renew-basset-certs.sh <<'EOF'
#!/bin/bash
certbot renew --quiet
cp /etc/letsencrypt/live/browser.example.com/fullchain.pem /app/certs/cert.pem
cp /etc/letsencrypt/live/browser.example.com/privkey.pem /app/certs/key.pem
docker-compose -f /app/docker-compose.yml restart basset-hound
EOF

  chmod +x /usr/local/bin/renew-basset-certs.sh

  # Create systemd timer
  sudo tee /etc/systemd/system/basset-renew-certs.timer > /dev/null <<EOF
[Unit]
Description=Renew Basset Hound TLS Certificates Daily
Requires=basset-renew-certs.service

[Timer]
OnCalendar=daily
OnBootSec=1h
AccuracySec=12h

[Install]
WantedBy=timers.target
EOF

  sudo tee /etc/systemd/system/basset-renew-certs.service > /dev/null <<EOF
[Unit]
Description=Renew Basset Hound TLS Certificates
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/renew-basset-certs.sh
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable basset-renew-certs.timer
  sudo systemctl start basset-renew-certs.timer

  log_success "Certificate renewal timer configured"
}

setup_custom_ca_cert() {
  local cert_path=$1
  local key_path=$2

  if [ ! -f "$cert_path" ]; then
    log_error "Certificate not found: $cert_path"
    exit 1
  fi

  if [ ! -f "$key_path" ]; then
    log_error "Private key not found: $key_path"
    exit 1
  fi

  log_info "Installing custom CA certificate..."
  mkdir -p "$CERTS_DIR"

  cp "$cert_path" "${CERTS_DIR}/cert.pem"
  cp "$key_path" "${CERTS_DIR}/key.pem"

  chmod 644 "${CERTS_DIR}/cert.pem"
  chmod 600 "${CERTS_DIR}/key.pem"

  log_success "Custom certificate installed"

  # Verify certificate
  log_info "Certificate details:"
  openssl x509 -in "${CERTS_DIR}/cert.pem" -text -noout | \
    grep -E "Subject:|Issuer:|Not Before|Not After" | \
    sed 's/^/  /'
}

###############################################################################
# Docker Configuration
###############################################################################

create_env_file() {
  local env_file="${SCRIPT_DIR}/.env.docker"

  log_info "Creating Docker environment file: $env_file"

  cat > "$env_file" <<EOF
# Basset Hound Browser - Docker TLS Configuration
NODE_ENV=production

# WebSocket TLS/SSL Configuration
BASSET_WS_SSL_ENABLED=true
BASSET_WS_SSL_CERT=/app/certs/cert.pem
BASSET_WS_SSL_KEY=/app/certs/key.pem

# Server Configuration
BASSET_WS_PORT=8765
BASSET_WS_HOST=0.0.0.0

# Security
BASSET_WS_TOKEN=$(openssl rand -hex 32)

# Logging
LOG_LEVEL=info

# TLS Setup Metadata
TLS_ENVIRONMENT=$ENVIRONMENT
TLS_SETUP_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TLS_DOMAIN=$DOMAIN
EOF

  log_success "Environment file created"

  # Show token
  log_info "Generated authentication token:"
  grep "BASSET_WS_TOKEN=" "$env_file" | sed 's/^/  /'
}

create_docker_compose() {
  log_info "Creating docker-compose configuration..."

  cat > "${SCRIPT_DIR}/docker-compose.yml" <<'EOF'
version: '3.8'

services:
  basset-hound:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: basset-hound-browser
    restart: unless-stopped
    ports:
      - "8765:8765"
    volumes:
      - ./certs:/app/certs:ro
      - ./tmp:/app/tmp
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - BASSET_WS_SSL_ENABLED=true
      - BASSET_WS_SSL_CERT=/app/certs/cert.pem
      - BASSET_WS_SSL_KEY=/app/certs/key.pem
      - BASSET_WS_PORT=8765
      - BASSET_WS_HOST=0.0.0.0
    env_file:
      - .env.docker
    healthcheck:
      test: ["CMD", "curl", "-k", "-f", "https://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - basset-hound-network

  # Optional: Nginx reverse proxy with automatic redirect
  nginx:
    image: nginx:latest
    container_name: basset-hound-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./certs:/etc/nginx/certs:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - basset-hound
    networks:
      - basset-hound-network

networks:
  basset-hound-network:
    driver: bridge
EOF

  log_success "docker-compose.yml created"
}

create_dockerfile() {
  log_info "Ensuring Dockerfile exists..."

  if [ ! -f "${SCRIPT_DIR}/Dockerfile" ]; then
    cat > "${SCRIPT_DIR}/Dockerfile" <<'EOF'
FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache \
    openssl \
    curl \
    git \
    python3 \
    make \
    g++

# Copy project files
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create volume directories
RUN mkdir -p /app/certs /app/tmp /app/data && \
    chown -R node:node /app

USER node

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -k -f https://localhost:8765/health || exit 1

CMD ["npm", "start"]
EOF

    log_success "Dockerfile created"
  else
    log_info "Dockerfile already exists"
  fi
}

create_nginx_config() {
  log_info "Creating Nginx reverse proxy configuration..."

  cat > "${SCRIPT_DIR}/nginx.conf" <<'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # WebSocket proxy settings
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    upstream basset_hound {
        server basset-hound:8765;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name browser.example.com;

        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;

        # Modern TLS configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # HSTS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        location / {
            proxy_pass https://basset_hound;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_ssl_verify off;
            proxy_ssl_session_reuse on;
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # Health check endpoint
        location /health {
            proxy_pass https://basset_hound/health;
            proxy_ssl_verify off;
            access_log off;
        }
    }
}
EOF

  log_success "Nginx configuration created"
}

###############################################################################
# Main Setup Workflow
###############################################################################

setup_development() {
  log_info "Setting up DEVELOPMENT environment (self-signed certificate)..."

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --days)
        CERT_DAYS="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  # Check for OpenSSL
  check_command "openssl" "apt-get install openssl (Ubuntu/Debian) or brew install openssl (macOS)"

  # Generate certificate
  generate_self_signed_cert "$DOMAIN" "$CERT_DAYS" "$RSA_KEY_SIZE"

  # Create configuration
  create_env_file
  create_docker_compose
  create_dockerfile
  create_nginx_config

  log_success "Development setup complete!"
  show_next_steps "dev"
}

setup_production() {
  log_info "Setting up PRODUCTION environment (Let's Encrypt)..."

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        EMAIL="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  # Check for certbot
  check_command "certbot" "apt-get install certbot (Ubuntu/Debian) or brew install certbot (macOS)"

  # Setup Let's Encrypt
  setup_letsencrypt "$DOMAIN" "$EMAIL"

  # Create configuration
  create_env_file
  create_docker_compose
  create_dockerfile
  create_nginx_config

  log_success "Production setup complete!"
  show_next_steps "prod"
}

setup_enterprise() {
  log_info "Setting up ENTERPRISE environment (custom CA certificate)..."

  # Parse arguments
  CERT_PATH=""
  KEY_PATH=""

  while [[ $# -gt 0 ]]; do
    case $1 in
      --cert)
        CERT_PATH="$2"
        shift 2
        ;;
      --key)
        KEY_PATH="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  if [ -z "$CERT_PATH" ] || [ -z "$KEY_PATH" ]; then
    log_error "Enterprise mode requires --cert and --key arguments"
    exit 1
  fi

  # Install custom certificate
  setup_custom_ca_cert "$CERT_PATH" "$KEY_PATH"

  # Create configuration
  create_env_file
  create_docker_compose
  create_dockerfile
  create_nginx_config

  log_success "Enterprise setup complete!"
  show_next_steps "enterprise"
}

###############################################################################
# Display Information
###############################################################################

show_next_steps() {
  local env=$1

  echo ""
  echo "=========================================="
  echo "    Basset Hound Browser - WSS Setup"
  echo "=========================================="
  echo ""
  echo "✓ TLS/WSS configuration completed"
  echo "✓ Environment: $env"
  echo "✓ Certificate directory: $CERTS_DIR"
  echo ""
  echo "Next steps:"
  echo ""
  echo "1. Start Docker container:"
  echo "   docker-compose up -d"
  echo ""
  echo "2. Verify TLS is working:"
  echo "   curl -k https://localhost:8765/health"
  echo ""
  echo "3. Test WebSocket connection:"
  echo "   node examples/tls-client.js dev ping"
  echo ""
  echo "4. View logs:"
  echo "   docker-compose logs -f basset-hound"
  echo ""
  echo "5. Stop container:"
  echo "   docker-compose down"
  echo ""
  echo "Configuration files:"
  echo "  - .env.docker              (Environment variables)"
  echo "  - docker-compose.yml       (Docker Compose configuration)"
  echo "  - Dockerfile               (Image definition)"
  echo "  - nginx.conf               (Reverse proxy config)"
  echo ""
  echo "Certificates:"
  echo "  - $CERTS_DIR/cert.pem"
  echo "  - $CERTS_DIR/key.pem"
  echo ""

  if [ "$env" = "prod" ]; then
    echo "Certificate renewal:"
    echo "  - Setup with: systemctl enable basset-renew-certs.timer"
    echo "  - Check status: systemctl status basset-renew-certs.timer"
    echo ""
  fi

  echo "Documentation:"
  echo "  - docs/TLS-SETUP.md          (Complete TLS guide)"
  echo "  - examples/tls-client.js     (Client examples)"
  echo ""
}

show_help() {
  cat <<EOF
Docker TLS/WSS Setup Script

Usage: $0 <environment> [options]

Environments:
  dev          Development with self-signed certificate
  prod         Production with Let's Encrypt
  enterprise   Enterprise with custom CA certificate

Options (dev):
  --domain NAME        Domain for certificate (default: localhost)
  --days DAYS          Certificate validity in days (default: 365)

Options (prod):
  --domain NAME        Domain for Let's Encrypt (default: browser.example.com)
  --email EMAIL        Email for Let's Encrypt (default: admin@example.com)

Options (enterprise):
  --cert PATH          Path to certificate file (required)
  --key PATH           Path to private key file (required)

Examples:
  $0 dev
  $0 dev --domain myserver.local
  $0 prod --domain browser.example.com --email admin@example.com
  $0 enterprise --cert /path/to/cert.pem --key /path/to/key.pem

Environment Variables:
  DOMAIN               Domain for certificate
  EMAIL                Email for Let's Encrypt
  CERT_DAYS            Days valid (dev only)
  RSA_KEY_SIZE         RSA key size bits (default: 2048)

EOF
}

###############################################################################
# Main Execution
###############################################################################

main() {
  # Show help if requested
  if [ "$ENVIRONMENT" = "help" ] || [ "$ENVIRONMENT" = "-h" ] || [ "$ENVIRONMENT" = "--help" ]; then
    show_help
    exit 0
  fi

  # Check environment argument
  case "$ENVIRONMENT" in
    dev|development)
      setup_development "${@:2}"
      ;;
    prod|production)
      setup_production "${@:2}"
      ;;
    enterprise|custom)
      setup_enterprise "${@:2}"
      ;;
    *)
      log_error "Unknown environment: $ENVIRONMENT"
      show_help
      exit 1
      ;;
  esac
}

# Run if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
