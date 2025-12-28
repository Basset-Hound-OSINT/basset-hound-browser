#!/bin/bash
# =============================================================================
# Xvfb Installation Script for Basset Hound Browser
# =============================================================================
# Installs Xvfb (X Virtual Frame Buffer) for headless mode operation.
# Enables running Electron/GUI applications without a physical display.
#
# Supported: Ubuntu/Debian, Fedora/RHEL/CentOS
# Usage: Run with sudo - sudo ./install-xvfb.sh
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script info
SCRIPT_NAME="install-xvfb.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
DISPLAY_NUM="${DISPLAY_NUM:-99}"
SCREEN_RESOLUTION="${SCREEN_RESOLUTION:-1920x1080x24}"

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
        log_error "Xvfb is not available on macOS"
        log_info "For headless testing on macOS, consider using headless Chrome/Electron flags"
        exit 1
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

check_xvfb_installed() {
    log_step "Checking for existing Xvfb installation"

    if command_exists Xvfb; then
        local xvfb_version
        xvfb_version=$(Xvfb -version 2>&1 | head -1 || echo "version unknown")
        log_info "Xvfb is already installed: $xvfb_version"

        # Check if systemd service exists
        local service_exists=false
        if [[ -f "/etc/systemd/system/xvfb.service" ]]; then
            service_exists=true
            log_info "Xvfb systemd service exists"
        fi

        # Check if helper scripts exist
        local scripts_exist=false
        if [[ -x "/usr/local/bin/start-xvfb" ]] && [[ -x "/usr/local/bin/stop-xvfb" ]]; then
            scripts_exist=true
            log_info "Xvfb helper scripts exist"
        fi

        if [[ "$service_exists" == "true" && "$scripts_exist" == "true" ]]; then
            log_success "Xvfb is fully installed and configured"
            echo ""
            echo -e "${GREEN}Xvfb is already installed and configured.${NC}"
            echo "  Binary:  $(command -v Xvfb)"
            echo "  Service: xvfb.service"
            echo "  Scripts: start-xvfb, stop-xvfb, xvfb-run-basset"
            echo ""
            echo "No installation needed. Use --force to reinstall."
            echo ""
            return 0
        else
            log_info "Xvfb is installed but configuration is incomplete"
            return 2  # Needs configuration
        fi
    fi

    log_info "Xvfb is not installed"
    return 1
}

# =============================================================================
# Installation Functions
# =============================================================================

install_xvfb_debian() {
    log_step "Installing Xvfb (Debian/Ubuntu)"

    log_info "Updating package lists..."
    apt-get update || {
        log_error "Failed to update package lists"
        exit 1
    }

    log_info "Installing Xvfb and related packages..."

    local packages=(
        "xvfb"
        "x11-utils"
        "x11-xserver-utils"
        "xfonts-base"
        "xfonts-100dpi"
        "xfonts-75dpi"
        "xfonts-scalable"
        "libgl1-mesa-dri"
        "libgl1-mesa-glx"
    )

    apt-get install -y "${packages[@]}" || {
        log_error "Failed to install Xvfb packages"
        exit 1
    }

    log_success "Xvfb installed"
}

install_xvfb_redhat() {
    log_step "Installing Xvfb (Red Hat/Fedora)"

    log_info "Installing Xvfb and related packages..."

    local packages=(
        "xorg-x11-server-Xvfb"
        "xorg-x11-utils"
        "xorg-x11-fonts-100dpi"
        "xorg-x11-fonts-75dpi"
        "xorg-x11-fonts-Type1"
        "xorg-x11-fonts-misc"
        "mesa-dri-drivers"
        "mesa-libGL"
    )

    $PKG_MANAGER install -y "${packages[@]}" || {
        log_error "Failed to install Xvfb packages"
        exit 1
    }

    log_success "Xvfb installed"
}

# =============================================================================
# Systemd Service Setup
# =============================================================================

create_systemd_service() {
    log_step "Creating Xvfb systemd service"

    local service_file="/etc/systemd/system/xvfb.service"

    cat > "$service_file" << EOF
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :${DISPLAY_NUM} -screen 0 ${SCREEN_RESOLUTION} -ac +extension GLX +render -noreset
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    log_info "Reloading systemd daemon..."
    systemctl daemon-reload

    log_success "Systemd service created at $service_file"
}

enable_xvfb_service() {
    log_step "Enabling Xvfb service"

    systemctl enable xvfb || {
        log_warning "Failed to enable Xvfb service"
    }

    log_success "Xvfb service enabled"
}

start_xvfb_service() {
    log_step "Starting Xvfb service"

    # Stop any existing Xvfb on this display
    pkill -f "Xvfb :${DISPLAY_NUM}" 2>/dev/null || true

    systemctl start xvfb || {
        log_warning "Failed to start Xvfb via systemctl"
        log_info "Trying to start Xvfb manually..."

        Xvfb ":${DISPLAY_NUM}" -screen 0 "${SCREEN_RESOLUTION}" -ac +extension GLX +render -noreset &
        sleep 2
    }

    log_success "Xvfb service started"
}

# =============================================================================
# Helper Scripts
# =============================================================================

create_helper_scripts() {
    log_step "Creating helper scripts"

    local script_dir="/usr/local/bin"

    # Create xvfb-run-basset script
    cat > "${script_dir}/xvfb-run-basset" << 'EOF'
#!/bin/bash
# Wrapper script to run commands with Xvfb display
# Usage: xvfb-run-basset <command>

DISPLAY_NUM="${XVFB_DISPLAY:-99}"
export DISPLAY=":${DISPLAY_NUM}"

# Check if Xvfb is running
if ! pgrep -f "Xvfb :${DISPLAY_NUM}" > /dev/null; then
    echo "Starting Xvfb on display :${DISPLAY_NUM}..."
    Xvfb ":${DISPLAY_NUM}" -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
    XVFB_PID=$!
    sleep 2
    trap "kill $XVFB_PID 2>/dev/null" EXIT
fi

exec "$@"
EOF
    chmod +x "${script_dir}/xvfb-run-basset"

    # Create start-xvfb script
    cat > "${script_dir}/start-xvfb" << 'EOF'
#!/bin/bash
# Start Xvfb server
# Usage: start-xvfb [display_number] [resolution]

DISPLAY_NUM="${1:-99}"
RESOLUTION="${2:-1920x1080x24}"

# Kill any existing Xvfb on this display
pkill -f "Xvfb :${DISPLAY_NUM}" 2>/dev/null || true
sleep 1

echo "Starting Xvfb on display :${DISPLAY_NUM} with resolution ${RESOLUTION}..."
Xvfb ":${DISPLAY_NUM}" -screen 0 "${RESOLUTION}" -ac +extension GLX +render -noreset &

sleep 2

if pgrep -f "Xvfb :${DISPLAY_NUM}" > /dev/null; then
    echo "Xvfb started successfully on display :${DISPLAY_NUM}"
    echo "Set DISPLAY=:${DISPLAY_NUM} to use it"
else
    echo "Failed to start Xvfb"
    exit 1
fi
EOF
    chmod +x "${script_dir}/start-xvfb"

    # Create stop-xvfb script
    cat > "${script_dir}/stop-xvfb" << 'EOF'
#!/bin/bash
# Stop Xvfb server
# Usage: stop-xvfb [display_number]

DISPLAY_NUM="${1:-99}"

echo "Stopping Xvfb on display :${DISPLAY_NUM}..."
pkill -f "Xvfb :${DISPLAY_NUM}" 2>/dev/null

if pgrep -f "Xvfb :${DISPLAY_NUM}" > /dev/null; then
    echo "Warning: Xvfb may still be running"
else
    echo "Xvfb stopped successfully"
fi
EOF
    chmod +x "${script_dir}/stop-xvfb"

    log_success "Helper scripts created in ${script_dir}"
}

# =============================================================================
# Environment Setup
# =============================================================================

create_env_file() {
    log_step "Creating environment configuration"

    local env_file="/etc/profile.d/xvfb-basset.sh"

    cat > "$env_file" << EOF
# Basset Hound Browser - Xvfb Display Configuration
# This file is sourced by login shells

# Default Xvfb display for headless operation
export XVFB_DISPLAY=${DISPLAY_NUM}

# Uncomment to automatically use Xvfb display
# export DISPLAY=:${DISPLAY_NUM}
EOF

    chmod +x "$env_file"

    log_success "Environment file created at $env_file"
}

# =============================================================================
# Verification
# =============================================================================

verify_installation() {
    log_step "Verifying installation"

    # Check Xvfb binary
    if command_exists Xvfb; then
        local xvfb_version
        xvfb_version=$(Xvfb -version 2>&1 | head -1 || echo "version unknown")
        log_success "Xvfb is installed: $xvfb_version"
    else
        log_error "Xvfb binary not found"
        exit 1
    fi

    # Check xvfb-run (wrapper script included with package)
    if command_exists xvfb-run; then
        log_success "xvfb-run is available"
    else
        log_warning "xvfb-run not found (may need to install separately)"
    fi

    # Check service status
    if systemctl is-active --quiet xvfb 2>/dev/null; then
        log_success "Xvfb service is running"
    else
        log_warning "Xvfb service is not running (start with: systemctl start xvfb)"
    fi

    # Test Xvfb
    log_info "Testing Xvfb..."
    local test_display=":98"

    Xvfb "$test_display" -screen 0 640x480x8 &
    local test_pid=$!
    sleep 2

    if ps -p $test_pid > /dev/null 2>&1; then
        log_success "Xvfb test passed - can create virtual display"
        kill $test_pid 2>/dev/null || true
    else
        log_warning "Xvfb test may have failed"
    fi

    log_success "Verification complete"
}

print_summary() {
    log_step "Installation Summary"

    echo ""
    echo -e "${GREEN}Xvfb has been successfully installed!${NC}"
    echo ""
    echo "Configuration:"
    echo "  - Default Display:    :${DISPLAY_NUM}"
    echo "  - Screen Resolution:  ${SCREEN_RESOLUTION}"
    echo "  - Service:            xvfb.service"
    echo ""
    echo "Helper Scripts:"
    echo "  - start-xvfb [display] [resolution]  # Start Xvfb server"
    echo "  - stop-xvfb [display]                # Stop Xvfb server"
    echo "  - xvfb-run-basset <command>          # Run command with Xvfb"
    echo ""
    echo "Service Commands:"
    echo "  - systemctl start xvfb    # Start service"
    echo "  - systemctl stop xvfb     # Stop service"
    echo "  - systemctl status xvfb   # Check status"
    echo ""
    echo "Usage with Basset Hound Browser:"
    echo "  export DISPLAY=:${DISPLAY_NUM}"
    echo "  npm start"
    echo ""
    echo "Or use the wrapper:"
    echo "  xvfb-run-basset npm start"
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo "============================================"
    echo "  Basset Hound Browser - Xvfb Installer"
    echo "============================================"
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

    # Check if running as root
    check_root

    # Detect operating system
    detect_os

    # Check for existing installation
    local install_status=1
    check_xvfb_installed && install_status=0 || install_status=$?

    if [[ $install_status -eq 0 && "$force_install" != "true" ]]; then
        # Fully installed - skip
        log_success "Xvfb is already installed and configured. Skipping."
        exit 0
    fi

    local needs_package_install=true
    if [[ $install_status -eq 2 ]]; then
        # Xvfb package installed, just needs configuration
        needs_package_install=false
    fi

    # Install based on OS family (only if needed)
    if [[ "$needs_package_install" == "true" || "$force_install" == "true" ]]; then
        case "$OS_FAMILY" in
            debian)
                install_xvfb_debian
                ;;
            redhat)
                install_xvfb_redhat
                ;;
        esac
    fi

    # Create systemd service
    create_systemd_service

    # Enable service
    enable_xvfb_service

    # Create helper scripts
    create_helper_scripts

    # Create environment file
    create_env_file

    # Start service
    start_xvfb_service

    # Verify installation
    verify_installation

    # Print summary
    print_summary

    log_success "Xvfb installation completed!"
    exit 0
}

# Run main function
main "$@"
