#!/bin/bash
# =============================================================================
# Tor Installation Script for Basset Hound Browser
# =============================================================================
# Installs Tor from the official Tor Project repository and configures it
# with ControlPort enabled for programmatic access.
#
# OFFICIALLY SUPPORTED: Ubuntu 22.04 LTS (jammy)
#
# This script is tested and maintained for Ubuntu 22.04 LTS.
# For other platforms, see: docs/deployment/TOR-SETUP-GUIDE.md
#
# The script may work on other Debian-based systems but is not officially
# supported. For other operating systems (Fedora, Arch, macOS, Windows),
# please refer to the cross-platform setup guide.
#
# Usage: Run with sudo - sudo ./install-tor.sh
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script info
SCRIPT_NAME="install-tor.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_step() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_ID="${ID}"
        OS_VERSION_ID="${VERSION_ID:-}"
        OS_CODENAME="${VERSION_CODENAME:-}"

        case "$OS_ID" in
            ubuntu|debian|linuxmint|pop)
                OS_FAMILY="debian"
                PKG_MANAGER="apt-get"
                ;;
            fedora|rhel|centos|rocky|almalinux)
                OS_FAMILY="redhat"
                if command -v dnf &>/dev/null; then
                    PKG_MANAGER="dnf"
                else
                    PKG_MANAGER="yum"
                fi
                ;;
            *)
                log_error "Unsupported Linux distribution: $OS_ID"
                exit 1
                ;;
        esac
    elif [[ "$(uname)" == "Darwin" ]]; then
        OS_ID="macos"
        OS_FAMILY="macos"
        PKG_MANAGER="brew"
    else
        log_error "Unable to detect operating system"
        exit 1
    fi

    log_info "Detected OS: $OS_ID (Family: $OS_FAMILY)"
}

command_exists() {
    command -v "$1" &>/dev/null
}

# =============================================================================
# Pre-Installation Checks
# =============================================================================

check_tor_installed() {
    log_step "Checking for existing Tor installation"

    if command_exists tor; then
        local tor_version
        tor_version=$(tor --version 2>/dev/null | head -1 || echo "unknown")
        log_info "Tor is already installed: $tor_version"

        # Check if SOCKS port is listening
        if ss -tlnp 2>/dev/null | grep -q ":9050 " || netstat -tlnp 2>/dev/null | grep -q ":9050 "; then
            log_success "Tor SOCKS proxy is running on port 9050"
        fi

        # Check if control port is listening
        if ss -tlnp 2>/dev/null | grep -q ":9051 " || netstat -tlnp 2>/dev/null | grep -q ":9051 "; then
            log_success "Tor control port is running on port 9051"
        fi

        # Check for Basset Hound configuration
        local torrc_path="/etc/tor/torrc"
        if [[ -f "$torrc_path" ]] && grep -q "Basset Hound Browser" "$torrc_path" 2>/dev/null; then
            log_success "Basset Hound Tor configuration already present"
            echo ""
            echo -e "${GREEN}Tor is already fully configured for Basset Hound Browser.${NC}"
            echo "No installation needed. Use --force to reinstall."
            echo ""
            return 0
        else
            log_info "Tor is installed but Basset Hound configuration is missing"
            log_info "Will add configuration..."
            return 2  # Installed but needs configuration
        fi
    fi

    log_info "Tor is not installed"
    return 1
}

# =============================================================================
# Installation Functions
# =============================================================================

install_prerequisites_debian() {
    log_step "Installing prerequisites (Debian/Ubuntu)"

    apt-get update || {
        log_error "Failed to update package lists"
        exit 1
    }

    apt-get install -y apt-transport-https gpg wget curl netcat-openbsd || {
        log_error "Failed to install prerequisites"
        exit 1
    }

    log_success "Prerequisites installed"
}

install_prerequisites_redhat() {
    log_step "Installing prerequisites (Red Hat/Fedora)"

    $PKG_MANAGER install -y epel-release 2>/dev/null || true
    $PKG_MANAGER install -y wget curl nc || {
        log_error "Failed to install prerequisites"
        exit 1
    }

    log_success "Prerequisites installed"
}

install_prerequisites_macos() {
    log_step "Installing prerequisites (macOS)"

    if ! command_exists brew; then
        log_error "Homebrew is required but not installed"
        log_info "Install with: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi

    log_success "Prerequisites available (Homebrew)"
}

add_tor_repo_debian() {
    log_step "Adding official Tor Project repository"

    # Determine codename
    local codename="$OS_CODENAME"
    if [[ -z "$codename" ]]; then
        # Fallback for systems without VERSION_CODENAME
        codename=$(lsb_release -cs 2>/dev/null || echo "jammy")
    fi

    log_info "Using codename: $codename"

    # Add GPG key
    log_info "Adding Tor Project GPG key..."
    wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --dearmor > /usr/share/keyrings/tor-archive-keyring.gpg || {
        log_error "Failed to add Tor GPG key"
        exit 1
    }

    # Add repository
    log_info "Adding Tor repository..."
    cat > /etc/apt/sources.list.d/tor.list << EOF
deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org ${codename} main
deb-src [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org ${codename} main
EOF

    apt-get update || {
        log_error "Failed to update package lists after adding Tor repo"
        exit 1
    }

    log_success "Tor repository added"
}

install_tor_debian() {
    log_step "Installing Tor (Debian/Ubuntu)"

    apt-get install -y tor tor-geoipdb deb.torproject.org-keyring || {
        log_error "Failed to install Tor packages"
        exit 1
    }

    log_success "Tor installed"
}

install_tor_redhat() {
    log_step "Installing Tor (Red Hat/Fedora)"

    $PKG_MANAGER install -y tor || {
        log_error "Failed to install Tor"
        exit 1
    }

    log_success "Tor installed"
}

install_tor_macos() {
    log_step "Installing Tor (macOS)"

    brew install tor || {
        log_error "Failed to install Tor via Homebrew"
        exit 1
    }

    log_success "Tor installed"
}

configure_tor() {
    log_step "Configuring Tor"

    local torrc_path
    local tor_user
    local tor_data_dir
    local tor_log_dir

    case "$OS_FAMILY" in
        debian)
            torrc_path="/etc/tor/torrc"
            tor_user="debian-tor"
            tor_data_dir="/var/lib/tor"
            tor_log_dir="/var/log/tor"
            ;;
        redhat)
            torrc_path="/etc/tor/torrc"
            tor_user="toranon"
            tor_data_dir="/var/lib/tor"
            tor_log_dir="/var/log/tor"
            ;;
        macos)
            torrc_path="/usr/local/etc/tor/torrc"
            # On macOS with Homebrew, create config if it doesn't exist
            if [[ ! -f "$torrc_path" ]]; then
                mkdir -p "$(dirname "$torrc_path")"
                touch "$torrc_path"
            fi
            tor_user=""
            tor_data_dir="$HOME/.tor"
            tor_log_dir="$HOME/.tor"
            ;;
    esac

    # Backup original config if it exists
    if [[ -f "$torrc_path" ]]; then
        cp "$torrc_path" "${torrc_path}.backup.$(date +%Y%m%d%H%M%S)"
        log_info "Backed up existing torrc"
    fi

    # Generate hashed password
    CONTROL_PASSWORD="basset-hound-password"
    log_info "Generating hashed control password..."
    HASHED_PASSWORD=$(tor --hash-password "$CONTROL_PASSWORD" 2>/dev/null) || {
        log_error "Failed to generate hashed password"
        exit 1
    }

    # Check if our config block already exists
    if grep -q "## Basset Hound Browser Tor Configuration" "$torrc_path" 2>/dev/null; then
        log_warning "Basset Hound configuration already exists in torrc, skipping..."
    else
        # Append configuration
        cat >> "$torrc_path" << EOF

## Basset Hound Browser Tor Configuration
## Added by install-tor.sh on $(date)

# SOCKS proxy port (default)
SocksPort 9050

# Control port for programmatic access
ControlPort 9051

# Control port authentication using hashed password
# Password: basset-hound-password (change this in production!)
HashedControlPassword $HASHED_PASSWORD

# Also enable cookie authentication (provides both methods)
CookieAuthentication 1

# Allow connections from localhost only
SocksPolicy accept 127.0.0.1
SocksPolicy reject *

# Data directory
DataDirectory $tor_data_dir

# Log configuration
Log notice file ${tor_log_dir}/notices.log
EOF
        log_success "Tor configuration added"
    fi

    # Set permissions (Linux only)
    if [[ "$OS_FAMILY" != "macos" ]]; then
        log_info "Setting permissions..."

        # Create log directory if it doesn't exist
        mkdir -p "$tor_log_dir"

        if id "$tor_user" &>/dev/null; then
            chown -R "$tor_user:$tor_user" "$tor_data_dir" 2>/dev/null || true
            chown -R "$tor_user:$tor_user" "$tor_log_dir" 2>/dev/null || true
            chmod 700 "$tor_data_dir" 2>/dev/null || true
        fi
    fi
}

start_tor_service() {
    log_step "Starting Tor service"

    case "$OS_FAMILY" in
        debian|redhat)
            systemctl enable tor || {
                log_warning "Failed to enable Tor service"
            }
            systemctl restart tor || {
                log_error "Failed to start Tor service"
                exit 1
            }
            log_info "Waiting for Tor to start..."
            sleep 5
            ;;
        macos)
            brew services start tor || {
                log_error "Failed to start Tor service"
                exit 1
            }
            log_info "Waiting for Tor to start..."
            sleep 5
            ;;
    esac

    log_success "Tor service started"
}

verify_tor() {
    log_step "Verifying Tor installation"

    local success=true

    # Check service status (Linux)
    if [[ "$OS_FAMILY" != "macos" ]]; then
        log_info "Checking Tor service status..."
        if systemctl is-active --quiet tor; then
            log_success "Tor service is running"
        else
            log_error "Tor service is not running"
            success=false
        fi
    fi

    # Check SOCKS port
    log_info "Checking SOCKS port (9050)..."
    if ss -tlnp 2>/dev/null | grep -q ":9050 " || netstat -tlnp 2>/dev/null | grep -q ":9050 "; then
        log_success "SOCKS port 9050 is listening"
    else
        log_warning "SOCKS port 9050 may not be ready yet"
    fi

    # Check Control port
    log_info "Checking Control port (9051)..."
    if ss -tlnp 2>/dev/null | grep -q ":9051 " || netstat -tlnp 2>/dev/null | grep -q ":9051 "; then
        log_success "Control port 9051 is listening"
    else
        log_warning "Control port 9051 may not be ready yet"
    fi

    # Test SOCKS proxy
    if command_exists curl; then
        log_info "Testing SOCKS proxy connection..."
        if curl --socks5 127.0.0.1:9050 --connect-timeout 30 -s https://check.torproject.org/api/ip >/dev/null 2>&1; then
            log_success "SOCKS proxy is working"
        else
            log_warning "SOCKS proxy test failed (may need more time to bootstrap)"
        fi
    fi

    # Test control port
    if command_exists nc; then
        log_info "Testing Control port..."
        local response
        response=$(echo -e "AUTHENTICATE \"$CONTROL_PASSWORD\"\r\nGETINFO version\r\nQUIT" | nc -w 5 127.0.0.1 9051 2>/dev/null || true)
        if echo "$response" | grep -q "250"; then
            log_success "Control port authentication working"
        else
            log_warning "Control port test inconclusive"
        fi
    fi

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

print_summary() {
    log_step "Installation Summary"

    echo ""
    echo -e "${GREEN}Tor has been successfully installed and configured!${NC}"
    echo ""
    echo "Configuration:"
    echo "  - SOCKS Proxy:      127.0.0.1:9050"
    echo "  - Control Port:     127.0.0.1:9051"
    echo "  - Control Password: $CONTROL_PASSWORD"
    echo "  - Cookie Auth:      Enabled"
    echo ""

    case "$OS_FAMILY" in
        debian)
            echo "Config file: /etc/tor/torrc"
            echo "Log file:    /var/log/tor/notices.log"
            echo ""
            echo "Useful commands:"
            echo "  Check status:  systemctl status tor"
            echo "  Restart:       systemctl restart tor"
            echo "  View logs:     tail -f /var/log/tor/notices.log"
            ;;
        redhat)
            echo "Config file: /etc/tor/torrc"
            echo "Log file:    /var/log/tor/notices.log"
            echo ""
            echo "Useful commands:"
            echo "  Check status:  systemctl status tor"
            echo "  Restart:       systemctl restart tor"
            echo "  View logs:     tail -f /var/log/tor/notices.log"
            ;;
        macos)
            echo "Config file: /usr/local/etc/tor/torrc"
            echo ""
            echo "Useful commands:"
            echo "  Check status:  brew services list"
            echo "  Restart:       brew services restart tor"
            ;;
    esac
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo "========================================"
    echo "  Basset Hound Browser - Tor Installer"
    echo "========================================"
    echo ""

    # Parse arguments
    local force_install=false
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force|-f)
                force_install=true
                shift
                ;;
            -h|--help)
                echo "Usage: $SCRIPT_NAME [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --force, -f    Force reinstall even if already installed"
                echo "  -h, --help     Show this help message"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Check if running as root (not needed for macOS with Homebrew)
    if [[ "$(uname)" != "Darwin" ]]; then
        check_root
    fi

    # Detect operating system
    detect_os

    # Check for existing installation
    local install_status=1
    check_tor_installed && install_status=0 || install_status=$?

    if [[ $install_status -eq 0 && "$force_install" != "true" ]]; then
        # Fully installed and configured - skip
        log_success "Tor is already installed and configured. Skipping."
        exit 0
    fi

    local needs_install=true
    if [[ $install_status -eq 2 ]]; then
        # Installed but needs configuration
        needs_install=false
    fi

    # Install based on OS family (only if needed)
    if [[ "$needs_install" == "true" || "$force_install" == "true" ]]; then
        case "$OS_FAMILY" in
            debian)
                install_prerequisites_debian
                add_tor_repo_debian
                install_tor_debian
                ;;
            redhat)
                install_prerequisites_redhat
                install_tor_redhat
                ;;
            macos)
                install_prerequisites_macos
                install_tor_macos
                ;;
        esac
    fi

    # Configure Tor
    configure_tor

    # Start service
    start_tor_service

    # Verify installation
    verify_tor

    # Print summary
    print_summary

    log_success "Tor installation completed!"
    exit 0
}

# Run main function
main "$@"
