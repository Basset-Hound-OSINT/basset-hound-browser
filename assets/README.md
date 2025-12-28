# Basset Hound Browser - Assets

This directory contains application icons and assets for the Basset Hound Browser.

## Icon Files

For electron-builder to create proper installers, the following icon files are needed:

| File | Platform | Size | Format |
|------|----------|------|--------|
| `icon.ico` | Windows | Multi-resolution | ICO (16x16, 32x32, 48x48, 64x64, 128x128, 256x256) |
| `icon.icns` | macOS | Multi-resolution | ICNS (16x16 to 1024x1024) |
| `icon.png` | Linux | 512x512 | PNG |

## Generating Icons

### Option 1: Using the generate-icons.sh script

```bash
cd /home/devel/basset-hound-browser
./assets/generate-icons.sh
```

This requires ImageMagick to be installed:
- Ubuntu/Debian: `sudo apt-get install imagemagick`
- macOS: `brew install imagemagick`
- Fedora/RHEL: `sudo dnf install ImageMagick`

### Option 2: Manual Conversion

1. Create a 1024x1024 PNG master icon
2. Use online tools like:
   - https://cloudconvert.com/svg-to-ico
   - https://iconverticons.com/online/

### Option 3: Use electron-icon-builder

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./icon.svg --output=./
```

## Source Files

- `icon.svg` - Source vector logo (512x512)

## Placeholder Icons

If you just want to test the build without proper icons:

```bash
# Create a simple placeholder PNG
convert -size 512x512 xc:'#2D3748' -fill '#4299E1' -draw "circle 256,256 256,50" icon.png

# For Windows (requires icotool from icoutils)
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# For macOS (requires png2icns from libicns)
png2icns icon.icns icon.png
```

## Branding Guidelines

The Basset Hound Browser logo represents:
- **Brown/Earth tones**: The loyal basset hound
- **Blue accent**: Technology and trust
- **Magnifying glass**: OSINT and investigation focus
