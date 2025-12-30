#!/bin/bash
# =============================================================================
# Node.js Installation Script for Basset Hound Browser
# =============================================================================
# Installs Node.js via nvm (Node Version Manager) for better version control.
#
# OFFICIALLY SUPPORTED: Ubuntu 22.04 LTS (jammy)
#
# This script is tested and maintained for Ubuntu 22.04 LTS.
# It may work on other systems but is not officially supported.
#
# Usage: Run with sudo - sudo ./install-node.sh
#        Or for current user only: ./install-node.sh --user
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script info
SCRIPT_NAME="install-node.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
NODE_VERSION="${NODE_VERSION:-20}"  # Default to Node.js 20 LTS
NVM_VERSION="${NVM_VERSION:-0.39.7}"
INSTALL_FOR_USER=false

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

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_ID="${ID}"

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
                OS_FAMILY="unknown"
                PKG_MANAGER=""
                ;;
        esac
    elif [[ "$(uname)" == "Darwin" ]]; then
        OS_ID="macos"
        OS_FAMILY="macos"
        PKG_MANAGER="brew"
    else
        OS_FAMILY="unknown"
        PKG_MANAGER=""
    fi

    log_info "Detected OS: $OS_ID (Family: $OS_FAMILY)"
}

command_exists() {
    command -v "$1" &>/dev/null
}

FORCE_INSTALL=false

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --user)
                INSTALL_FOR_USER=true
                shift
                ;;
            --version)
                NODE_VERSION="$2"
                shift 2
                ;;
            --nvm-version)
                NVM_VERSION="$2"
                shift 2
                ;;
            --force|-f)
                FORCE_INSTALL=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    echo "Usage: $SCRIPT_NAME [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --user           Install for current user only (no sudo required)"
    echo "  --version VER    Node.js version to install (default: $NODE_VERSION)"
    echo "  --nvm-version V  NVM version to install (default: $NVM_VERSION)"
    echo "  --force, -f      Force reinstall even if already installed"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  sudo ./install-node.sh                 # System-wide prerequisites + nvm"
    echo "  ./install-node.sh --user               # Install nvm for current user"
    echo "  sudo ./install-node.sh --version 18    # Install Node.js 18"
    echo "  sudo ./install-node.sh --force         # Force reinstall"
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

    apt-get install -y curl wget git build-essential || {
        log_error "Failed to install prerequisites"
        exit 1
    }

    log_success "Prerequisites installed"
}

install_prerequisites_redhat() {
    log_step "Installing prerequisites (Red Hat/Fedora)"

    $PKG_MANAGER groupinstall -y "Development Tools" 2>/dev/null || \
    $PKG_MANAGER install -y gcc gcc-c++ make || {
        log_error "Failed to install development tools"
        exit 1
    }

    $PKG_MANAGER install -y curl wget git || {
        log_error "Failed to install prerequisites"
        exit 1
    }

    log_success "Prerequisites installed"
}

install_prerequisites_macos() {
    log_step "Checking prerequisites (macOS)"

    # Check for Xcode Command Line Tools
    if ! xcode-select -p &>/dev/null; then
        log_info "Installing Xcode Command Line Tools..."
        xcode-select --install || {
            log_warning "Please install Xcode Command Line Tools manually"
        }
    fi

    log_success "Prerequisites available"
}

check_existing_node() {
    log_step "Checking for existing Node.js installation"

    get_target_user

    local nvm_dir="${TARGET_HOME}/.nvm"

    # Check if nvm is installed
    if [[ -d "$nvm_dir" ]] && [[ -s "${nvm_dir}/nvm.sh" ]]; then
        log_info "NVM is already installed at $nvm_dir"

        # Check if Node.js is installed via nvm
        local node_check_script="
            export NVM_DIR=\"$nvm_dir\"
            [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
            node --version 2>/dev/null || echo 'not-installed'
        "

        local node_version
        if [[ -n "${SUDO_USER:-}" ]]; then
            node_version=$(su - "$TARGET_USER" -c "$node_check_script" 2>/dev/null || echo "not-installed")
        else
            node_version=$(bash -c "$node_check_script" 2>/dev/null || echo "not-installed")
        fi

        if [[ "$node_version" != "not-installed" && "$node_version" != "" ]]; then
            log_success "Node.js $node_version is already installed via NVM"
            echo ""
            echo -e "${GREEN}Node.js is already installed and configured.${NC}"
            echo "  NVM Directory: $nvm_dir"
            echo "  Node Version:  $node_version"
            echo "  User:          $TARGET_USER"
            echo ""
            echo "No installation needed. Use --force to reinstall."
            echo ""
            return 0
        else
            log_info "NVM is installed but Node.js is not installed"
            return 2  # NVM exists but no Node.js
        fi
    fi

    # Check for system Node.js (not managed by nvm)
    if command_exists node; then
        local current_version
        current_version=$(node --version 2>/dev/null || echo "unknown")
        log_warning "System Node.js $current_version is installed (not via NVM)"
        log_info "Will install NVM-managed Node.js alongside"
        return 1
    fi

    log_info "No Node.js installation found"
    return 1
}

get_target_user() {
    # Determine which user to install nvm for
    if [[ -n "${SUDO_USER:-}" ]]; then
        TARGET_USER="$SUDO_USER"
        TARGET_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    else
        TARGET_USER="$(whoami)"
        TARGET_HOME="$HOME"
    fi

    log_info "Target user: $TARGET_USER"
    log_info "Target home: $TARGET_HOME"
}

install_nvm() {
    log_step "Installing NVM (Node Version Manager)"

    get_target_user

    local nvm_dir="${TARGET_HOME}/.nvm"
    local install_script="https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh"

    # Check if nvm already installed
    if [[ -d "$nvm_dir" ]]; then
        log_warning "NVM directory already exists at $nvm_dir"
        log_info "Updating NVM..."
    fi

    # Download and run install script
    log_info "Downloading NVM v${NVM_VERSION}..."

    if [[ -n "${SUDO_USER:-}" ]]; then
        # Running as root via sudo - install for the original user
        su - "$TARGET_USER" -c "curl -o- '$install_script' | bash" || {
            log_error "Failed to install NVM"
            exit 1
        }
    else
        # Running as regular user
        curl -o- "$install_script" | bash || {
            log_error "Failed to install NVM"
            exit 1
        }
    fi

    log_success "NVM installed to $nvm_dir"
}

install_node_via_nvm() {
    log_step "Installing Node.js $NODE_VERSION via NVM"

    get_target_user

    local nvm_dir="${TARGET_HOME}/.nvm"

    # Source nvm and install Node.js
    local nvm_script="
        export NVM_DIR=\"$nvm_dir\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
        nvm install $NODE_VERSION
        nvm use $NODE_VERSION
        nvm alias default $NODE_VERSION
        node --version
        npm --version
    "

    if [[ -n "${SUDO_USER:-}" ]]; then
        su - "$TARGET_USER" -c "$nvm_script" || {
            log_error "Failed to install Node.js via NVM"
            exit 1
        }
    else
        bash -c "$nvm_script" || {
            log_error "Failed to install Node.js via NVM"
            exit 1
        }
    fi

    log_success "Node.js $NODE_VERSION installed"
}

setup_shell_integration() {
    log_step "Setting up shell integration"

    get_target_user

    local nvm_dir="${TARGET_HOME}/.nvm"

    # NVM install script should have already added the necessary lines
    # Just verify they exist

    local shell_files=(".bashrc" ".zshrc" ".profile")
    local nvm_lines_found=false

    for shell_file in "${shell_files[@]}"; do
        local full_path="${TARGET_HOME}/${shell_file}"
        if [[ -f "$full_path" ]]; then
            if grep -q "NVM_DIR" "$full_path"; then
                log_info "NVM configuration found in $shell_file"
                nvm_lines_found=true
            fi
        fi
    done

    if [[ "$nvm_lines_found" == "false" ]]; then
        log_warning "NVM shell configuration not found in standard files"
        log_info "You may need to add the following to your shell profile:"
        echo ""
        echo "    export NVM_DIR=\"$nvm_dir\""
        echo "    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\""
        echo "    [ -s \"\$NVM_DIR/bash_completion\" ] && . \"\$NVM_DIR/bash_completion\""
        echo ""
    fi

    log_success "Shell integration complete"
}

verify_installation() {
    log_step "Verifying installation"

    get_target_user

    local nvm_dir="${TARGET_HOME}/.nvm"

    local verify_script="
        export NVM_DIR=\"$nvm_dir\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"

        echo \"NVM Version: \$(nvm --version)\"
        echo \"Node.js Version: \$(node --version)\"
        echo \"NPM Version: \$(npm --version)\"
        echo \"Node Path: \$(which node)\"
        echo \"NPM Path: \$(which npm)\"
    "

    echo ""
    if [[ -n "${SUDO_USER:-}" ]]; then
        su - "$TARGET_USER" -c "$verify_script"
    else
        bash -c "$verify_script"
    fi

    log_success "Installation verified"
}

print_summary() {
    log_step "Installation Summary"

    get_target_user

    local nvm_dir="${TARGET_HOME}/.nvm"

    echo ""
    echo -e "${GREEN}Node.js has been successfully installed via NVM!${NC}"
    echo ""
    echo "Installation details:"
    echo "  - NVM Version:  v${NVM_VERSION}"
    echo "  - Node Version: ${NODE_VERSION}"
    echo "  - NVM Directory: ${nvm_dir}"
    echo "  - User: ${TARGET_USER}"
    echo ""
    echo "To use Node.js in a new terminal session:"
    echo "  1. Open a new terminal, or"
    echo "  2. Run: source ~/.bashrc (or ~/.zshrc for Zsh)"
    echo ""
    echo "Useful NVM commands:"
    echo "  nvm list              # List installed versions"
    echo "  nvm install <version> # Install a specific version"
    echo "  nvm use <version>     # Switch to a version"
    echo "  nvm alias default <v> # Set default version"
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo "=========================================="
    echo "  Basset Hound Browser - Node.js Installer"
    echo "=========================================="
    echo ""

    # Parse command line arguments
    parse_args "$@"

    # Detect operating system
    detect_os

    # Check for existing installation first
    local install_status=1
    check_existing_node && install_status=0 || install_status=$?

    if [[ $install_status -eq 0 && "$FORCE_INSTALL" != "true" ]]; then
        # Fully installed - skip
        log_success "Node.js is already installed. Skipping."
        exit 0
    fi

    # Install prerequisites (needs root on Linux)
    if [[ "$INSTALL_FOR_USER" == "false" ]]; then
        if [[ $EUID -ne 0 && "$OS_FAMILY" != "macos" ]]; then
            log_error "This script requires sudo to install system prerequisites"
            log_info "Use --user flag to install nvm for current user only"
            exit 1
        fi

        case "$OS_FAMILY" in
            debian)
                install_prerequisites_debian
                ;;
            redhat)
                install_prerequisites_redhat
                ;;
            macos)
                install_prerequisites_macos
                ;;
        esac
    fi

    # Install NVM (skip if already installed and not forcing)
    if [[ $install_status -ne 2 || "$FORCE_INSTALL" == "true" ]]; then
        install_nvm
    else
        log_info "NVM already installed, skipping NVM installation"
    fi

    # Install Node.js
    install_node_via_nvm

    # Setup shell integration
    setup_shell_integration

    # Verify installation
    verify_installation

    # Print summary
    print_summary

    log_success "Node.js installation completed!"
    exit 0
}

# Run main function
main "$@"
