#!/bin/bash
# =============================================================================
# Electron Dependencies Installation Script for Basset Hound Browser
# =============================================================================
# Installs system dependencies required for running Electron applications.
# Includes GTK, NSS, ALSA, and other essential libraries.
#
# Supported: Ubuntu/Debian, Fedora/RHEL/CentOS
# Usage: Run with sudo - sudo ./install-electron-deps.sh
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script info
SCRIPT_NAME="install-electron-deps.sh"
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
                log_info "Electron dependencies must be installed manually"
                exit 1
                ;;
        esac
    elif [[ "$(uname)" == "Darwin" ]]; then
        log_info "macOS detected - Electron dependencies are included with the framework"
        log_success "No additional dependencies needed"
        exit 0
    else
        log_error "Unable to detect operating system"
        exit 1
    fi

    log_info "Detected OS: $OS_ID (Family: $OS_FAMILY)"
}

# =============================================================================
# Pre-Installation Checks
# =============================================================================

check_electron_deps_installed() {
    log_step "Checking for existing Electron dependencies"

    # Key libraries that Electron requires
    local required_libs=(
        "libgtk-3.so"
        "libnss3.so"
        "libasound.so"
        "libatk-1.0.so"
        "libatk-bridge-2.0.so"
    )

    local missing_count=0
    local found_count=0

    for lib in "${required_libs[@]}"; do
        if ldconfig -p 2>/dev/null | grep -q "$lib"; then
            ((found_count++))
        else
            ((missing_count++))
        fi
    done

    if [[ $missing_count -eq 0 ]]; then
        log_success "All core Electron dependencies are already installed"
        echo ""
        echo -e "${GREEN}Electron dependencies are already installed.${NC}"
        echo "  Found: GTK3, NSS, ALSA, ATK, ATK-Bridge"
        echo ""
        echo "No installation needed. Use --force to reinstall."
        echo ""
        return 0
    elif [[ $found_count -gt 0 ]]; then
        log_info "Some Electron dependencies are installed ($found_count/${#required_libs[@]})"
        log_info "Will install missing dependencies..."
        return 2  # Partial installation
    fi

    log_info "Electron dependencies not found"
    return 1
}

# =============================================================================
# Debian/Ubuntu Installation
# =============================================================================

install_debian_deps() {
    log_step "Installing Electron dependencies (Debian/Ubuntu)"

    # Update package lists
    log_info "Updating package lists..."
    apt-get update || {
        log_error "Failed to update package lists"
        exit 1
    }

    # Core Electron dependencies
    log_info "Installing core dependencies..."

    local packages=(
        # GTK and GLib
        "libgtk-3-0"
        "libgtk-3-dev"
        "libglib2.0-0"
        "libglib2.0-dev"

        # NSS (Network Security Services)
        "libnss3"
        "libnss3-dev"
        "libnss3-tools"

        # ALSA (Audio)
        "libasound2"
        "libasound2-dev"

        # X11 libraries
        "libx11-6"
        "libx11-dev"
        "libx11-xcb1"
        "libxcb1"
        "libxcb1-dev"
        "libxcomposite1"
        "libxcomposite-dev"
        "libxcursor1"
        "libxcursor-dev"
        "libxdamage1"
        "libxdamage-dev"
        "libxext6"
        "libxext-dev"
        "libxfixes3"
        "libxfixes-dev"
        "libxi6"
        "libxi-dev"
        "libxrandr2"
        "libxrandr-dev"
        "libxrender1"
        "libxrender-dev"
        "libxss1"
        "libxss-dev"
        "libxtst6"
        "libxtst-dev"

        # Additional dependencies
        "libatk1.0-0"
        "libatk-bridge2.0-0"
        "libatspi2.0-0"
        "libcups2"
        "libdrm2"
        "libgbm1"
        "libpango-1.0-0"
        "libcairo2"

        # D-Bus
        "libdbus-1-3"
        "dbus"

        # Fonts
        "fonts-liberation"
        "fonts-noto-color-emoji"

        # Utilities
        "xdg-utils"
        "wget"
        "ca-certificates"
    )

    # Filter out packages that don't exist (different Ubuntu versions)
    local available_packages=()
    for pkg in "${packages[@]}"; do
        if apt-cache show "$pkg" &>/dev/null; then
            available_packages+=("$pkg")
        else
            log_warning "Package not available: $pkg (skipping)"
        fi
    done

    # Install available packages
    apt-get install -y "${available_packages[@]}" || {
        log_error "Failed to install some packages"
        log_info "Trying to install packages one by one..."

        for pkg in "${available_packages[@]}"; do
            apt-get install -y "$pkg" 2>/dev/null || log_warning "Could not install: $pkg"
        done
    }

    log_success "Debian/Ubuntu dependencies installed"
}

# =============================================================================
# Red Hat/Fedora Installation
# =============================================================================

install_redhat_deps() {
    log_step "Installing Electron dependencies (Red Hat/Fedora)"

    # Enable EPEL for CentOS/RHEL
    if [[ "$OS_ID" =~ ^(centos|rhel|rocky|almalinux)$ ]]; then
        log_info "Enabling EPEL repository..."
        $PKG_MANAGER install -y epel-release 2>/dev/null || true
    fi

    log_info "Installing dependencies..."

    local packages=(
        # GTK and GLib
        "gtk3"
        "gtk3-devel"
        "glib2"
        "glib2-devel"

        # NSS (Network Security Services)
        "nss"
        "nss-devel"
        "nss-tools"

        # ALSA (Audio)
        "alsa-lib"
        "alsa-lib-devel"

        # X11 libraries
        "libX11"
        "libX11-devel"
        "libxcb"
        "libxcb-devel"
        "libXcomposite"
        "libXcomposite-devel"
        "libXcursor"
        "libXcursor-devel"
        "libXdamage"
        "libXdamage-devel"
        "libXext"
        "libXext-devel"
        "libXfixes"
        "libXfixes-devel"
        "libXi"
        "libXi-devel"
        "libXrandr"
        "libXrandr-devel"
        "libXrender"
        "libXrender-devel"
        "libXScrnSaver"
        "libXScrnSaver-devel"
        "libXtst"
        "libXtst-devel"

        # Additional dependencies
        "atk"
        "at-spi2-atk"
        "at-spi2-core"
        "cups-libs"
        "libdrm"
        "mesa-libgbm"
        "pango"
        "cairo"

        # D-Bus
        "dbus-libs"
        "dbus"

        # Fonts
        "liberation-fonts"
        "google-noto-emoji-fonts"

        # Utilities
        "xdg-utils"
        "wget"
        "ca-certificates"
    )

    # Install packages
    $PKG_MANAGER install -y "${packages[@]}" || {
        log_error "Failed to install some packages"
        log_info "Trying to install packages one by one..."

        for pkg in "${packages[@]}"; do
            $PKG_MANAGER install -y "$pkg" 2>/dev/null || log_warning "Could not install: $pkg"
        done
    }

    log_success "Red Hat/Fedora dependencies installed"
}

# =============================================================================
# Verification
# =============================================================================

verify_installation() {
    log_step "Verifying installation"

    local missing_libs=()

    # Key libraries to check
    local libs_to_check=(
        "libgtk-3.so"
        "libnss3.so"
        "libasound.so"
        "libX11.so"
        "libxcb.so"
        "libatk-1.0.so"
        "libdbus-1.so"
    )

    for lib in "${libs_to_check[@]}"; do
        if ldconfig -p 2>/dev/null | grep -q "$lib"; then
            log_success "Found: $lib"
        else
            log_warning "Not found in ldconfig: $lib (may still be available)"
        fi
    done

    # Update library cache
    log_info "Updating library cache..."
    ldconfig 2>/dev/null || true

    log_success "Verification complete"
}

print_summary() {
    log_step "Installation Summary"

    echo ""
    echo -e "${GREEN}Electron dependencies have been installed!${NC}"
    echo ""
    echo "Installed components:"
    echo "  - GTK 3.x libraries"
    echo "  - NSS (Network Security Services)"
    echo "  - ALSA audio libraries"
    echo "  - X11/XCB libraries"
    echo "  - ATK accessibility toolkit"
    echo "  - D-Bus libraries"
    echo "  - System fonts"
    echo ""
    echo "You can now run Electron applications on this system."
    echo ""

    if [[ "$OS_FAMILY" == "debian" ]]; then
        echo "If you encounter issues, try running:"
        echo "  apt-get install -f"
        echo "  ldconfig"
    else
        echo "If you encounter issues, try running:"
        echo "  ldconfig"
    fi
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo "================================================"
    echo "  Basset Hound Browser - Electron Dependencies"
    echo "================================================"
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
    check_electron_deps_installed && install_status=0 || install_status=$?

    if [[ $install_status -eq 0 && "$force_install" != "true" ]]; then
        # Fully installed - skip
        log_success "Electron dependencies are already installed. Skipping."
        exit 0
    fi

    # Install based on OS family
    case "$OS_FAMILY" in
        debian)
            install_debian_deps
            ;;
        redhat)
            install_redhat_deps
            ;;
    esac

    # Verify installation
    verify_installation

    # Print summary
    print_summary

    log_success "Electron dependencies installation completed!"
    exit 0
}

# Run main function
main "$@"
