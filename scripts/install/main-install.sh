#!/bin/bash
# =============================================================================
# Basset Hound Browser - Main Installation Script
# =============================================================================
# Orchestrates the installation of all components needed for the Basset Hound
# Browser. Detects the operating system and calls individual install scripts.
#
# OFFICIALLY SUPPORTED: Ubuntu 22.04 LTS (jammy)
#
# This script is tested and maintained for Ubuntu 22.04 LTS.
# For other platforms, see: docs/deployment/TOR-SETUP-GUIDE.md
#
# Usage: sudo ./main-install.sh [OPTIONS]
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script info
SCRIPT_NAME="main-install.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="1.0.0"

# Installation flags
INSTALL_TOR=false
INSTALL_NODE=false
INSTALL_ELECTRON_DEPS=false
INSTALL_XVFB=false
INSTALL_ALL=false
DRY_RUN=false
VERBOSE=false
FORCE_INSTALL=false

# Results tracking
declare -A INSTALL_RESULTS
INSTALL_START_TIME=""

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
    echo -e "${CYAN}${BOLD}>>> $1${NC}"
    echo ""
}

log_header() {
    echo ""
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}============================================${NC}"
    echo ""
}

show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
    ____                       __     __  __                       __
   / __ ) ____ _ _____ _____ / /_   / / / /____   __  __ ____   __/ /
  / __  |/ __ `// ___// ___// _ \ / /_/ // __ \ / / / // __ \ / _  /
 / /_/ // /_/ /(__  )(__  )/  __// __  // /_/ // /_/ // / / // /_/ /
/_____/ \__,_//____//____/ \___//_/ /_/ \____/ \__,_//_/ /_/ \__,_/

    ____
   / __ ) _____ ____  _      __ _____ ___   _____
  / __  |/ ___// __ \| | /| / // ___// _ \ / ___/
 / /_/ // /   / /_/ /| |/ |/ /(__  )/  __// /
/_____//_/    \____/ |__/|__//____/ \___//_/

EOF
    echo -e "${NC}"
    echo -e "  ${BOLD}Basset Hound Browser - Installation Script v${VERSION}${NC}"
    echo ""
}

show_help() {
    echo "Usage: sudo $SCRIPT_NAME [OPTIONS]"
    echo ""
    echo "Installation Options:"
    echo "  --tor              Install Tor with control port"
    echo "  --node             Install Node.js via nvm"
    echo "  --electron-deps    Install Electron system dependencies"
    echo "  --xvfb             Install Xvfb for headless mode"
    echo "  --all              Install all components"
    echo ""
    echo "General Options:"
    echo "  --force, -f        Force reinstall even if already installed"
    echo "  --dry-run          Show what would be installed without installing"
    echo "  --verbose          Enable verbose output"
    echo "  -h, --help         Show this help message"
    echo "  -v, --version      Show version information"
    echo ""
    echo "Examples:"
    echo "  sudo ./main-install.sh --all              # Install everything"
    echo "  sudo ./main-install.sh --node --tor       # Install Node.js and Tor"
    echo "  sudo ./main-install.sh --electron-deps    # Install Electron deps only"
    echo "  ./main-install.sh --dry-run --all         # Preview full installation"
    echo "  sudo ./main-install.sh --all --force      # Reinstall everything"
    echo ""
    echo "Notes:"
    echo "  - Run with sudo for system packages (Electron deps, Tor, Xvfb)"
    echo "  - nvm/Node.js and npm packages are installed for the SUDO_USER, not root"
    echo "  - This ensures the regular user can run the browser without permission issues"
    echo "  - On macOS, some components may not be available"
    echo "  - Individual scripts can also be run directly"
    echo "  - Scripts are idempotent: running multiple times is safe"
    echo ""
    echo "Permission Model:"
    echo "  - System packages (apt/dnf): Installed system-wide by root"
    echo "  - nvm/Node.js: Installed in \$HOME/.nvm of the user who ran sudo"
    echo "  - npm packages: Installed as the user, owned by user"
    echo "  - Browser can be run without sudo after installation"
    echo ""
}

show_version() {
    echo "Basset Hound Browser Installer v${VERSION}"
    echo "Script location: ${SCRIPT_DIR}"
}

parse_args() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --tor)
                INSTALL_TOR=true
                shift
                ;;
            --node)
                INSTALL_NODE=true
                shift
                ;;
            --electron-deps)
                INSTALL_ELECTRON_DEPS=true
                shift
                ;;
            --xvfb)
                INSTALL_XVFB=true
                shift
                ;;
            --all)
                INSTALL_ALL=true
                INSTALL_TOR=true
                INSTALL_NODE=true
                INSTALL_ELECTRON_DEPS=true
                INSTALL_XVFB=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force|-f)
                FORCE_INSTALL=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                show_version
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo ""
                show_help
                exit 1
                ;;
        esac
    done
}

check_root() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi

    if [[ $EUID -ne 0 ]]; then
        # On macOS, some things don't need root
        if [[ "$(uname)" == "Darwin" ]]; then
            log_warning "Running without sudo on macOS"
            log_info "Some components may require elevated privileges"
            return 0
        fi

        log_error "This script must be run as root (use sudo)"
        log_info "Example: sudo $0 --all"
        exit 1
    fi
}

detect_os() {
    log_step "Detecting Operating System"

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_ID="${ID}"
        OS_NAME="${NAME}"
        OS_VERSION="${VERSION_ID:-}"
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
                OS_FAMILY="unknown"
                PKG_MANAGER=""
                log_warning "Unsupported distribution: $OS_ID"
                ;;
        esac
    elif [[ "$(uname)" == "Darwin" ]]; then
        OS_ID="macos"
        OS_NAME="macOS"
        OS_VERSION=$(sw_vers -productVersion)
        OS_FAMILY="macos"
        PKG_MANAGER="brew"
    else
        OS_ID="unknown"
        OS_NAME="Unknown"
        OS_VERSION=""
        OS_FAMILY="unknown"
        PKG_MANAGER=""
    fi

    echo "  Operating System: ${OS_NAME}"
    echo "  Version:          ${OS_VERSION}"
    echo "  Family:           ${OS_FAMILY}"
    echo "  Package Manager:  ${PKG_MANAGER}"
    echo ""

    # Check for WSL
    if grep -qi microsoft /proc/version 2>/dev/null; then
        log_info "Running on Windows Subsystem for Linux (WSL)"
    fi

    # Check for Docker
    if [[ -f /.dockerenv ]]; then
        log_info "Running inside Docker container"
    fi
}

check_prerequisites() {
    log_step "Checking Prerequisites"

    local missing=()
    local critical_missing=()
    local auto_install_missing=()

    # Critical prerequisites that cannot be auto-installed
    # These require the user to take action before the script can continue

    # Check for package manager
    case "$OS_FAMILY" in
        debian)
            if ! command -v apt-get &>/dev/null; then
                critical_missing+=("apt-get (package manager)")
            fi
            ;;
        redhat)
            if ! command -v dnf &>/dev/null && ! command -v yum &>/dev/null; then
                critical_missing+=("dnf or yum (package manager)")
            fi
            ;;
        macos)
            if ! command -v brew &>/dev/null; then
                critical_missing+=("brew (Homebrew)")
            fi
            ;;
    esac

    # Check for git (required for nvm installation)
    if ! command -v git &>/dev/null; then
        auto_install_missing+=("git")
    fi

    # Check for curl or wget (at least one is required)
    if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
        auto_install_missing+=("curl")
    fi

    # Check for basic build tools needed for some npm packages
    if [[ "$OS_FAMILY" == "debian" || "$OS_FAMILY" == "redhat" ]]; then
        if ! command -v make &>/dev/null; then
            auto_install_missing+=("make")
        fi
        if ! command -v gcc &>/dev/null && ! command -v cc &>/dev/null; then
            auto_install_missing+=("gcc")
        fi
    fi

    # Report critical missing prerequisites and exit
    if [[ ${#critical_missing[@]} -gt 0 ]]; then
        log_error "Critical prerequisites missing!"
        echo ""
        echo "The following critical tools are required but not found:"
        for tool in "${critical_missing[@]}"; do
            echo "  - $tool"
        done
        echo ""
        echo "Please install these before running this script:"
        echo ""
        case "$OS_FAMILY" in
            debian)
                echo "  This script requires apt-get which should be available on Debian/Ubuntu."
                echo "  If you're on a different distribution, please check your package manager."
                ;;
            redhat)
                echo "  This script requires dnf or yum which should be available on Fedora/RHEL/CentOS."
                echo "  If you're on a different distribution, please check your package manager."
                ;;
            macos)
                echo "  Install Homebrew from: https://brew.sh"
                echo "  Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
                ;;
            *)
                echo "  Your operating system ($OS_ID) is not supported by this installer."
                echo "  Supported: Ubuntu, Debian, Fedora, RHEL, CentOS, macOS"
                ;;
        esac
        echo ""
        exit 1
    fi

    # Show what we found
    echo "  Checking package manager... $(command -v apt-get || command -v dnf || command -v yum || command -v brew) ✓"
    command -v git &>/dev/null && echo "  Checking git... $(command -v git) ✓"
    command -v curl &>/dev/null && echo "  Checking curl... $(command -v curl) ✓"
    command -v wget &>/dev/null && echo "  Checking wget... $(command -v wget) ✓"
    echo ""

    # Handle auto-installable prerequisites
    if [[ ${#auto_install_missing[@]} -gt 0 ]]; then
        log_warning "Missing prerequisites: ${auto_install_missing[*]}"
        echo ""

        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would install: ${auto_install_missing[*]}"
            return 0
        fi

        # Check if we can auto-install (need root for system packages)
        if [[ $EUID -ne 0 ]]; then
            log_error "Cannot auto-install prerequisites without root access"
            echo ""
            echo "Please install the following packages manually before running this script:"
            echo ""
            case "$OS_FAMILY" in
                debian)
                    echo "  sudo apt-get update"
                    echo "  sudo apt-get install -y ${auto_install_missing[*]}"
                    ;;
                redhat)
                    echo "  sudo $PKG_MANAGER install -y ${auto_install_missing[*]}"
                    ;;
                macos)
                    echo "  brew install ${auto_install_missing[*]}"
                    ;;
            esac
            echo ""
            echo "Then run this script again with sudo:"
            echo "  sudo $0 $*"
            echo ""
            exit 1
        fi

        log_info "Attempting to install missing prerequisites..."
        echo ""

        case "$OS_FAMILY" in
            debian)
                apt-get update && apt-get install -y "${auto_install_missing[@]}" || {
                    log_error "Failed to install prerequisites"
                    echo ""
                    echo "Please install manually:"
                    echo "  sudo apt-get update && sudo apt-get install -y ${auto_install_missing[*]}"
                    exit 1
                }
                ;;
            redhat)
                $PKG_MANAGER install -y "${auto_install_missing[@]}" || {
                    log_error "Failed to install prerequisites"
                    echo ""
                    echo "Please install manually:"
                    echo "  sudo $PKG_MANAGER install -y ${auto_install_missing[*]}"
                    exit 1
                }
                ;;
            macos)
                brew install "${auto_install_missing[@]}" || {
                    log_error "Failed to install prerequisites"
                    echo ""
                    echo "Please install manually:"
                    echo "  brew install ${auto_install_missing[*]}"
                    exit 1
                }
                ;;
        esac

        log_success "Prerequisites installed successfully"
    else
        log_success "All prerequisites are available"
    fi
}

# =============================================================================
# Installation Functions
# =============================================================================

run_install_script() {
    local script_name="$1"
    local display_name="$2"
    local script_path="${SCRIPT_DIR}/${script_name}"

    log_step "Installing ${display_name}"

    if [[ ! -f "$script_path" ]]; then
        log_error "Installation script not found: $script_path"
        INSTALL_RESULTS["$display_name"]="FAILED (script not found)"
        return 1
    fi

    if [[ ! -x "$script_path" ]]; then
        log_info "Making script executable: $script_path"
        chmod +x "$script_path"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would execute: $script_path"
        INSTALL_RESULTS["$display_name"]="SKIPPED (dry run)"
        return 0
    fi

    # Build arguments
    local script_args=()
    if [[ "$FORCE_INSTALL" == "true" ]]; then
        script_args+=("--force")
    fi

    # Run the script
    if "$script_path" "${script_args[@]}"; then
        INSTALL_RESULTS["$display_name"]="SUCCESS"
        return 0
    else
        # Check if it was skipped (exit 0 with message about already installed)
        INSTALL_RESULTS["$display_name"]="FAILED"
        return 1
    fi
}

install_tor() {
    if [[ "$INSTALL_TOR" == "true" ]]; then
        run_install_script "install-tor.sh" "Tor"
    fi
}

install_node() {
    if [[ "$INSTALL_NODE" == "true" ]]; then
        run_install_script "install-node.sh" "Node.js"
    fi
}

install_electron_deps() {
    if [[ "$INSTALL_ELECTRON_DEPS" == "true" ]]; then
        if [[ "$OS_FAMILY" == "macos" ]]; then
            log_info "Electron dependencies are included with the framework on macOS"
            INSTALL_RESULTS["Electron Dependencies"]="SKIPPED (not needed on macOS)"
        else
            run_install_script "install-electron-deps.sh" "Electron Dependencies"
        fi
    fi
}

install_xvfb() {
    if [[ "$INSTALL_XVFB" == "true" ]]; then
        if [[ "$OS_FAMILY" == "macos" ]]; then
            log_info "Xvfb is not available on macOS"
            log_info "Use headless Chrome/Electron flags instead"
            INSTALL_RESULTS["Xvfb"]="SKIPPED (not available on macOS)"
        else
            run_install_script "install-xvfb.sh" "Xvfb"
        fi
    fi
}

# =============================================================================
# Post-Installation
# =============================================================================

install_npm_dependencies() {
    log_step "Installing NPM Dependencies"

    local project_root
    project_root="$(cd "${SCRIPT_DIR}/../.." && pwd)"

    if [[ ! -f "${project_root}/package.json" ]]; then
        log_warning "package.json not found at ${project_root}"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run: npm install in ${project_root}"
        return 0
    fi

    # Determine target user (the user who will run the browser)
    local target_user target_home
    if [[ -n "${SUDO_USER:-}" ]]; then
        target_user="$SUDO_USER"
        target_home=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    else
        target_user="$(whoami)"
        target_home="$HOME"
    fi

    local nvm_dir="${target_home}/.nvm"

    # npm install must run as the target user, not root
    # This ensures node_modules are owned by the user
    # Also run npm audit fix --force to automatically fix all vulnerabilities
    local npm_script="
        export NVM_DIR=\"$nvm_dir\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
        cd '$project_root'

        # Install dependencies
        echo 'Installing npm dependencies...'
        npm install

        # Automatically fix ALL vulnerabilities including breaking changes
        echo ''
        echo 'Running npm audit fix --force to resolve all vulnerabilities...'
        npm audit fix --force 2>/dev/null || true

        # Verify the fix worked
        echo ''
        echo 'Verifying vulnerabilities are resolved...'
        npm audit 2>/dev/null || echo 'Note: Some vulnerabilities may still exist if packages have no fix available'
    "

    log_info "Running npm install as $target_user in ${project_root}..."

    if [[ -n "${SUDO_USER:-}" ]]; then
        # Running as root via sudo - install as the original user
        su - "$target_user" -c "$npm_script" || {
            log_warning "npm install failed - you may need to run it manually"
            log_info "Run: cd $project_root && npm install"
            return 1
        }
    else
        # Running as regular user
        bash -c "$npm_script" || {
            log_warning "npm install failed - you may need to run it manually"
            return 1
        }
    fi

    log_success "NPM dependencies installed"
}

# =============================================================================
# Summary and Reporting
# =============================================================================

print_installation_plan() {
    log_step "Installation Plan"

    echo "The following components will be installed:"
    echo ""

    [[ "$INSTALL_TOR" == "true" ]] && echo "  [x] Tor (with control port)"
    [[ "$INSTALL_TOR" == "false" ]] && echo "  [ ] Tor"

    [[ "$INSTALL_NODE" == "true" ]] && echo "  [x] Node.js (via nvm)"
    [[ "$INSTALL_NODE" == "false" ]] && echo "  [ ] Node.js"

    [[ "$INSTALL_ELECTRON_DEPS" == "true" ]] && echo "  [x] Electron Dependencies"
    [[ "$INSTALL_ELECTRON_DEPS" == "false" ]] && echo "  [ ] Electron Dependencies"

    [[ "$INSTALL_XVFB" == "true" ]] && echo "  [x] Xvfb (headless display)"
    [[ "$INSTALL_XVFB" == "false" ]] && echo "  [ ] Xvfb"

    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN MODE] No changes will be made${NC}"
        echo ""
    fi
}

print_summary() {
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - INSTALL_START_TIME))

    log_header "Installation Summary"

    echo "Results:"
    echo ""

    local success_count=0
    local failed_count=0
    local skipped_count=0

    for component in "${!INSTALL_RESULTS[@]}"; do
        local result="${INSTALL_RESULTS[$component]}"
        local status_color

        case "$result" in
            SUCCESS)
                status_color="${GREEN}"
                ((success_count++))
                ;;
            FAILED*)
                status_color="${RED}"
                ((failed_count++))
                ;;
            SKIPPED*)
                status_color="${YELLOW}"
                ((skipped_count++))
                ;;
            *)
                status_color="${NC}"
                ;;
        esac

        printf "  %-25s ${status_color}%s${NC}\n" "$component:" "$result"
    done

    echo ""
    echo "----------------------------------------"
    echo "  Successful: ${success_count}"
    echo "  Failed:     ${failed_count}"
    echo "  Skipped:    ${skipped_count}"
    echo "  Duration:   ${duration} seconds"
    echo "----------------------------------------"
    echo ""

    if [[ $failed_count -gt 0 ]]; then
        log_warning "Some installations failed. Check the logs above for details."
    elif [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run completed. Run without --dry-run to perform installation."
    else
        log_success "Installation completed successfully!"
    fi

    echo ""
    echo "Next Steps:"
    echo "  1. Open a new terminal or run: source ~/.bashrc"
    echo "  2. Navigate to the project: cd ${SCRIPT_DIR}/../.."
    echo "  3. Install dependencies: npm install"
    echo "  4. Start the browser: npm start"
    echo ""

    if [[ "$INSTALL_XVFB" == "true" && "$OS_FAMILY" != "macos" ]]; then
        echo "For headless mode:"
        echo "  export DISPLAY=:99"
        echo "  npm start"
        echo ""
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Show banner
    show_banner

    # Parse command line arguments
    parse_args "$@"

    # Check if running as root
    check_root

    # Record start time
    INSTALL_START_TIME=$(date +%s)

    # Detect OS
    detect_os

    # Check prerequisites
    check_prerequisites

    # Show installation plan
    print_installation_plan

    # Confirm if not dry run
    if [[ "$DRY_RUN" == "false" ]]; then
        echo -n "Proceed with installation? [y/N] "
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "Installation cancelled"
            exit 0
        fi
        echo ""
    fi

    # Run installations in order
    # Order matters: Electron deps first, then Node, then others
    install_electron_deps
    install_node
    install_tor
    install_xvfb

    # Install NPM dependencies if Node was installed
    if [[ "$INSTALL_NODE" == "true" && "$DRY_RUN" == "false" ]]; then
        install_npm_dependencies
    fi

    # Print summary
    print_summary

    # Exit with appropriate code
    local exit_code=0
    for result in "${INSTALL_RESULTS[@]}"; do
        if [[ "$result" == FAILED* ]]; then
            exit_code=1
            break
        fi
    done

    exit $exit_code
}

# Run main function
main "$@"
