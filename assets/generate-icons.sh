#!/bin/bash
# =============================================================================
# Icon Generation Script for Basset Hound Browser
# =============================================================================
# Generates platform-specific icons from SVG source
# Requires: ImageMagick (convert command)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Check for ImageMagick
if ! command -v convert &>/dev/null; then
    log_error "ImageMagick is required but not installed"
    echo ""
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS:         brew install imagemagick"
    echo "  Fedora/RHEL:   sudo dnf install ImageMagick"
    exit 1
fi

# Check for source SVG
if [[ ! -f "icon.svg" ]]; then
    log_error "icon.svg not found in $SCRIPT_DIR"
    exit 1
fi

log_info "Generating icons from icon.svg..."

# Generate high-resolution PNG first
log_info "Creating 1024x1024 master PNG..."
convert -background none -density 1024 icon.svg -resize 1024x1024 icon-1024.png

# Generate standard PNG for Linux (512x512)
log_info "Creating icon.png (512x512) for Linux..."
convert icon-1024.png -resize 512x512 icon.png
log_success "Created icon.png"

# Generate Windows ICO with multiple resolutions
log_info "Creating icon.ico for Windows..."
convert icon-1024.png \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 icon.ico
log_success "Created icon.ico"

# Generate macOS ICNS
log_info "Creating icon.icns for macOS..."

# Check if we're on macOS and can use iconutil
if command -v iconutil &>/dev/null; then
    # macOS native method
    mkdir -p icon.iconset

    for size in 16 32 64 128 256 512; do
        convert icon-1024.png -resize ${size}x${size} "icon.iconset/icon_${size}x${size}.png"
        double=$((size * 2))
        if [[ $double -le 1024 ]]; then
            convert icon-1024.png -resize ${double}x${double} "icon.iconset/icon_${size}x${size}@2x.png"
        fi
    done

    iconutil -c icns icon.iconset -o icon.icns
    rm -rf icon.iconset
    log_success "Created icon.icns (using iconutil)"
else
    # Fallback: create a simple PNG that electron-builder can use
    # On non-macOS systems, we can't create proper ICNS without additional tools
    log_warning "iconutil not available (not on macOS)"
    log_info "Creating icon.icns placeholder (1024x1024 PNG renamed)..."

    # Check for png2icns (Linux alternative)
    if command -v png2icns &>/dev/null; then
        # Generate required PNG sizes for png2icns
        for size in 16 32 48 128 256 512 1024; do
            convert icon-1024.png -resize ${size}x${size} "icon_${size}.png"
        done
        png2icns icon.icns icon_16.png icon_32.png icon_48.png icon_128.png icon_256.png icon_512.png icon_1024.png
        rm -f icon_*.png
        log_success "Created icon.icns (using png2icns)"
    else
        # Just copy the PNG - electron-builder may handle conversion
        cp icon-1024.png icon.icns.png
        log_warning "Could not create proper ICNS - created icon.icns.png as fallback"
        log_info "For proper macOS icons, run this on macOS or install icnsutils"
    fi
fi

# Cleanup
rm -f icon-1024.png

log_success "Icon generation complete!"
echo ""
echo "Generated files:"
ls -la icon.* 2>/dev/null || true
echo ""
echo "These icons will be used by electron-builder for:"
echo "  - icon.ico:  Windows installer"
echo "  - icon.icns: macOS app bundle"
echo "  - icon.png:  Linux AppImage"
