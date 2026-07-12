# Tor Setup Guide for Basset Hound Browser

This guide explains how to install and configure Tor for integration with Basset Hound Browser on various platforms.

---

## Table of Contents

- [Quick Start (Ubuntu 22.04)](#quick-start-ubuntu-2204)
- [Platform-Specific Installation](#platform-specific-installation)
  - [Ubuntu 22.04 LTS](#ubuntu-2204-lts)
  - [Debian 11/12](#debian-1112)
  - [Fedora/RHEL/CentOS](#fedorarhel-centos)
  - [Arch Linux](#arch-linux)
  - [macOS](#macos)
  - [Windows](#windows)
- [Configuration for Basset Hound Browser](#configuration-for-basset-hound-browser)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Requirements

Basset Hound Browser requires Tor to be running with:

| Component | Port | Purpose |
|-----------|------|---------|
| **SOCKS Proxy** | 9050 | Anonymous browsing through Tor network |
| **Control Port** | 9051 | Programmatic control (circuit management, exit node selection, etc.) |

---

## Quick Start (Ubuntu 22.04)

For Ubuntu 22.04 LTS, use the provided installation script:

```bash
cd basset-hound-browser
sudo ./scripts/install/install-tor.sh
```

This script automatically:
- Adds the official Tor Project repository
- Installs Tor v0.4.8.x
- Configures Control Port 9051 with password authentication
- Enables and starts the Tor service

---

## Platform-Specific Installation

### Ubuntu 22.04 LTS

**Automated Installation (Recommended)**:
```bash
sudo ./scripts/install/install-tor.sh
```

**Manual Installation**:
```bash
# Step 1: Install prerequisites
sudo apt-get update
sudo apt-get install -y apt-transport-https gpg wget curl netcat-openbsd

# Step 2: Add Tor Project repository
wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | sudo gpg --dearmor -o /usr/share/keyrings/tor-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org jammy main" | sudo tee /etc/apt/sources.list.d/tor.list

sudo apt-get update

# Step 3: Install Tor
sudo apt-get install -y tor deb.torproject.org-keyring

# Step 4: Configure (see Configuration section below)
```

---

### Debian 11/12

```bash
# Step 1: Install prerequisites
sudo apt-get update
sudo apt-get install -y apt-transport-https gpg wget curl netcat-openbsd

# Step 2: Add Tor Project repository
# For Debian 12 (bookworm):
wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | sudo gpg --dearmor -o /usr/share/keyrings/tor-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org bookworm main" | sudo tee /etc/apt/sources.list.d/tor.list

# For Debian 11 (bullseye), replace 'bookworm' with 'bullseye'

sudo apt-get update

# Step 3: Install Tor
sudo apt-get install -y tor deb.torproject.org-keyring

# Step 4: Configure (see Configuration section below)
```

---

### Fedora/RHEL/CentOS

```bash
# Fedora
sudo dnf install -y tor nc

# RHEL/CentOS (with EPEL)
sudo dnf install -y epel-release
sudo dnf install -y tor nc

# Start and enable service
sudo systemctl start tor
sudo systemctl enable tor

# Configure (see Configuration section below)
```

**Note**: On RHEL/CentOS, you may need to add the Tor Project repository for the latest version:
```bash
# Add Tor repository for RHEL/CentOS
sudo tee /etc/yum.repos.d/tor.repo << EOF
[tor]
name=Tor Project
baseurl=https://rpm.torproject.org/centos/\$releasever/\$basearch/
enabled=1
gpgcheck=1
gpgkey=https://rpm.torproject.org/centos/public_gpg.key
EOF

sudo dnf install -y tor
```

---

### Arch Linux

```bash
# Install Tor
sudo pacman -S tor

# Start and enable service
sudo systemctl start tor
sudo systemctl enable tor

# Configure (see Configuration section below)
```

---

### macOS

**Using Homebrew (Recommended)**:
```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Tor
brew install tor

# Start Tor service
brew services start tor
```

**Configuration Location**: `/usr/local/etc/tor/torrc` or `$(brew --prefix)/etc/tor/torrc`

**Create Configuration**:
```bash
# Find config location
TORRC=$(brew --prefix)/etc/tor/torrc

# Generate hashed password
HASHED_PASSWORD=$(tor --hash-password "basset-hound-password")

# Create config
cat >> "$TORRC" << EOF

# Basset Hound Browser Configuration
ControlPort 9051
HashedControlPassword $HASHED_PASSWORD
CookieAuthentication 1
EOF

# Restart Tor
brew services restart tor
```

**Verify**:
```bash
# Test SOCKS proxy
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip

# Test control port
echo -e 'AUTHENTICATE "basset-hound-password"\r\nGETINFO version\r\nQUIT' | nc localhost 9051
```

---

### Windows

**Option 1: Tor Expert Bundle (Recommended)**

1. Download the Tor Expert Bundle from: https://www.torproject.org/download/tor/
2. Extract to a folder (e.g., `C:\Tor`)
3. Create configuration file `C:\Tor\Data\Tor\torrc`:
   ```
   SocksPort 9050
   ControlPort 9051
   HashedControlPassword 16:YOUR_HASHED_PASSWORD
   CookieAuthentication 1
   DataDirectory C:\Tor\Data\Tor
   ```
4. Generate hashed password:
   ```cmd
   C:\Tor\Tor\tor.exe --hash-password "basset-hound-password"
   ```
5. Start Tor:
   ```cmd
   C:\Tor\Tor\tor.exe -f C:\Tor\Data\Tor\torrc
   ```

**Option 2: Using Windows Subsystem for Linux (WSL2)**

1. Install WSL2 with Ubuntu
2. Follow the Ubuntu installation instructions above
3. Tor will be accessible from Windows at `localhost:9050` and `localhost:9051`

**Option 3: Using Chocolatey**

```powershell
# Install Chocolatey (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install Tor
choco install tor

# Configure and start (see Windows Expert Bundle configuration above)
```

---

## Configuration for Basset Hound Browser

After installing Tor, configure the Control Port for Basset Hound Browser integration:

### Generate Password Hash

```bash
# Generate hashed password (use your own password in production!)
tor --hash-password "basset-hound-password"
# Output: 16:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Edit torrc Configuration

Add the following to your torrc file:

**Linux**: `/etc/tor/torrc`
**macOS**: `$(brew --prefix)/etc/tor/torrc`
**Windows**: `C:\Tor\Data\Tor\torrc`

```
# =============================================================================
# Basset Hound Browser Configuration
# =============================================================================

# Control port for programmatic access (required)
ControlPort 9051

# Control port authentication using hashed password
# Replace with your own hash from: tor --hash-password "your-password"
HashedControlPassword 16:YOUR_HASHED_PASSWORD_HERE

# Enable cookie authentication as backup method
CookieAuthentication 1

# Restrict SOCKS to localhost only (security)
SocksPolicy accept 127.0.0.1
SocksPolicy reject *
```

### Restart Tor

**Linux (systemd)**:
```bash
sudo systemctl restart tor
```

**Linux (init.d)**:
```bash
sudo service tor restart
```

**macOS**:
```bash
brew services restart tor
```

**Windows**:
```cmd
# Stop existing Tor process, then restart
C:\Tor\Tor\tor.exe -f C:\Tor\Data\Tor\torrc
```

---

## Verification

### Check Tor is Running

**Linux/macOS**:
```bash
# Check service status
systemctl status tor        # Linux with systemd
brew services list          # macOS

# Check ports are listening
ss -tlnp | grep -E '9050|9051'    # Linux
netstat -an | grep -E '9050|9051' # macOS
```

**Windows**:
```cmd
netstat -an | findstr "9050 9051"
```

### Test SOCKS Proxy

```bash
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

Expected output:
```json
{"IsTor":true,"IP":"xxx.xxx.xxx.xxx"}
```

### Test Control Port

```bash
echo -e 'AUTHENTICATE "basset-hound-password"\r\nGETINFO version\r\nQUIT' | nc localhost 9051
```

Expected output:
```
250 OK
250-version=0.4.x.x
250 OK
250 closing connection
```

---

## Troubleshooting

### Tor service won't start

```bash
# Check logs
sudo journalctl -u tor -f              # Linux (systemd)
sudo tail -f /var/log/tor/notices.log  # Linux (log file)
brew services log tor                   # macOS

# Verify configuration
tor --verify-config
```

### SOCKS proxy not responding

1. Check if Tor is running:
   ```bash
   ps aux | grep tor
   ```

2. Check if port is open:
   ```bash
   ss -tlnp | grep 9050
   ```

3. Check Tor bootstrap status:
   ```bash
   cat /var/lib/tor/state | grep Bootstrap
   ```

### Control port authentication fails

1. Verify password hash is correct:
   ```bash
   tor --hash-password "your-password"
   ```

2. Check torrc has correct hash:
   ```bash
   grep HashedControlPassword /etc/tor/torrc
   ```

3. Restart Tor after config changes:
   ```bash
   sudo systemctl restart tor
   ```

### Permission errors

```bash
# Fix ownership (Linux)
sudo chown -R debian-tor:debian-tor /var/lib/tor
sudo chmod 700 /var/lib/tor

# Fix ownership (macOS)
sudo chown -R $(whoami) $(brew --prefix)/var/lib/tor
```

### Firewall blocking connections

Tor only needs outbound connections. Ensure your firewall allows:
- Outbound TCP on various ports (Tor relays use many ports)
- Local connections on 127.0.0.1:9050 and 127.0.0.1:9051

---

## Security Considerations

### Change Default Password

The default password `basset-hound-password` should be changed for production:

```bash
# Generate new hash
NEW_HASH=$(tor --hash-password "your-secure-password")

# Update torrc
sudo sed -i "s/HashedControlPassword .*/HashedControlPassword $NEW_HASH/" /etc/tor/torrc

# Restart Tor
sudo systemctl restart tor
```

### Restrict Control Port Access

The default configuration restricts the Control Port to localhost. For additional security:

```
# In torrc - restrict to specific address
ControlListenAddress 127.0.0.1

# Or use Unix socket (more secure)
ControlSocket /var/run/tor/control GroupWritable
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```bash
# /etc/logrotate.d/tor
/var/log/tor/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 640 debian-tor adm
    postrotate
        systemctl reload tor
    endscript
}
```

---

## Basset Hound Browser Commands

Once Tor is configured, these WebSocket commands are available:

| Command | Description |
|---------|-------------|
| `tor_check_connection` | Verify Tor connectivity |
| `tor_get_circuit_path` | Get current circuit nodes |
| `tor_rebuild_circuit` | Get new identity |
| `tor_set_exit_country` | Set preferred exit countries |
| `tor_exclude_countries` | Exclude countries from circuits |
| `tor_add_bridge` | Add bridge relay |
| `tor_set_transport` | Set pluggable transport |
| `tor_get_bandwidth` | Get bandwidth statistics |
| `tor_set_isolation` | Configure stream isolation |

---

## Additional Resources

- [Tor Project Documentation](https://support.torproject.org/)
- [Tor Manual](https://www.torproject.org/docs/tor-manual.html)
- [Basset Hound Browser API Documentation](../core/API.md)
- [Tor Deployment Guide](./tor-deployment.md)

---

*Last Updated: December 29, 2024*
*For Basset Hound Browser v8.1.4*
