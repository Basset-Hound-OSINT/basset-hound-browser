# Tor Setup Guide for Basset Hound Browser

This comprehensive guide covers installing, configuring, and integrating Tor with Basset Hound Browser for anonymous browsing and network privacy.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Instructions](#installation-instructions)
  - [Ubuntu/Debian](#ubuntudebian)
  - [Fedora/RHEL](#fedorarhel)
  - [macOS](#macos)
  - [Windows](#windows)
  - [Docker](#docker)
- [Configuration](#configuration)
  - [Enable ControlPort](#enable-controlport)
  - [Authentication Setup](#authentication-setup)
  - [Bridge Configuration](#bridge-configuration)
  - [Sample torrc Configuration](#sample-torrc-configuration)
- [Verification](#verification)
  - [Check Service Status](#check-service-status)
  - [Test SOCKS Proxy](#test-socks-proxy)
  - [Test Control Port Connection](#test-control-port-connection)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Integration with Basset Hound Browser](#integration-with-basset-hound-browser)

---

## Prerequisites

### System Requirements

Before installing Tor, ensure your system meets the following requirements:

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 256 MB | 512 MB+ |
| Disk Space | 100 MB | 500 MB+ |
| Network | Stable internet connection | Broadband connection |
| Ports | 9050 (SOCKS), 9051 (Control) available | Additional ports for bridges |

### Software Requirements

- **Operating System**: Linux (Ubuntu 18.04+, Debian 10+, Fedora 32+, RHEL 8+), macOS 10.14+, or Windows 10+
- **Node.js**: 16.x or later (for Basset Hound Browser)
- **curl or wget**: For testing and downloading

### Network Requirements

Ensure the following ports are accessible:

| Port | Protocol | Purpose |
|------|----------|---------|
| 9050 | TCP | SOCKS5 proxy (default) |
| 9051 | TCP | Control port |
| 9053 | UDP | DNS resolution (optional) |
| 443/80 | TCP | Bridge connections (if using bridges) |

---

## Installation Instructions

### Ubuntu/Debian

The recommended method is to use the official Tor Project repository for the latest stable version.

#### Step 1: Add the Tor Project Repository

```bash
# Install required packages
sudo apt update
sudo apt install -y apt-transport-https gpg

# Add the Tor Project GPG key
wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --dearmor | sudo tee /usr/share/keyrings/tor-archive-keyring.gpg >/dev/null

# Determine your distribution codename
DISTRO=$(lsb_release -cs)

# Add the Tor repository
echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org ${DISTRO} main" | sudo tee /etc/apt/sources.list.d/tor.list

# For Ubuntu 22.04 (Jammy) or Debian 12 (Bookworm), use:
# echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org jammy main" | sudo tee /etc/apt/sources.list.d/tor.list
```

#### Step 2: Install Tor

```bash
# Update package lists
sudo apt update

# Install Tor and related packages
sudo apt install -y tor deb.torproject.org-keyring

# Optional: Install obfs4proxy for bridge support
sudo apt install -y obfs4proxy
```

#### Step 3: Start and Enable Tor Service

```bash
# Start the Tor service
sudo systemctl start tor

# Enable Tor to start on boot
sudo systemctl enable tor

# Check the status
sudo systemctl status tor
```

#### Alternative: Using the Default Repositories

For a simpler but potentially older version:

```bash
sudo apt update
sudo apt install -y tor
sudo systemctl start tor
sudo systemctl enable tor
```

---

### Fedora/RHEL

#### Fedora Installation

```bash
# Install Tor from Fedora repositories
sudo dnf install -y tor

# Install obfs4 for bridge support
sudo dnf install -y obfs4

# Start and enable the Tor service
sudo systemctl start tor
sudo systemctl enable tor

# Check status
sudo systemctl status tor
```

#### RHEL/CentOS Installation

```bash
# Enable EPEL repository
sudo dnf install -y epel-release

# Install Tor
sudo dnf install -y tor

# Start and enable the Tor service
sudo systemctl start tor
sudo systemctl enable tor

# Check status
sudo systemctl status tor
```

#### Building from Source (for latest version)

```bash
# Install build dependencies
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y libevent-devel openssl-devel zlib-devel

# Download Tor source
cd /tmp
wget https://dist.torproject.org/tor-0.4.8.10.tar.gz
tar xzf tor-0.4.8.10.tar.gz
cd tor-0.4.8.10

# Build and install
./configure
make
sudo make install

# Create systemd service (if needed)
sudo cp contrib/tor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start tor
sudo systemctl enable tor
```

---

### macOS

#### Using Homebrew (Recommended)

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Tor
brew install tor

# Install obfs4proxy for bridge support
brew install obfs4proxy

# Start Tor as a service
brew services start tor

# Or run Tor manually
tor
```

#### Verify Installation

```bash
# Check if Tor is running
brew services list | grep tor

# Test the SOCKS proxy
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

#### Configuration File Location

The Tor configuration file on macOS is typically located at:

- Homebrew: `/usr/local/etc/tor/torrc` or `/opt/homebrew/etc/tor/torrc` (Apple Silicon)
- Manual: `~/.tor/torrc`

```bash
# Create/edit the torrc file
nano $(brew --prefix)/etc/tor/torrc
```

---

### Windows

#### Using the Tor Expert Bundle

The Tor Expert Bundle provides Tor without the Tor Browser, ideal for integration with other applications.

##### Step 1: Download the Expert Bundle

1. Visit the official Tor download page: https://www.torproject.org/download/tor/
2. Download the **Windows Expert Bundle** (not Tor Browser)
3. Extract the archive to a permanent location, e.g., `C:\Tor`

##### Step 2: Configure Tor

Create a `torrc` file in the Tor directory:

```batch
# Create the torrc file
cd C:\Tor
notepad torrc
```

Add the following configuration:

```
SocksPort 127.0.0.1:9050
ControlPort 127.0.0.1:9051
CookieAuthentication 1
DataDirectory C:\Tor\Data
Log notice file C:\Tor\Logs\tor.log
```

Create required directories:

```batch
mkdir C:\Tor\Data
mkdir C:\Tor\Logs
```

##### Step 3: Run Tor

```batch
# Start Tor from command prompt
cd C:\Tor\Tor
tor.exe -f ..\torrc
```

##### Step 4: Install as a Windows Service (Optional)

```batch
# Open Command Prompt as Administrator
# Install Tor as a service
"C:\Tor\Tor\tor.exe" --service install -options -f "C:\Tor\torrc"

# Start the service
sc start Tor

# Configure to start automatically
sc config Tor start=auto
```

##### Using Chocolatey Package Manager

```powershell
# Install Chocolatey (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install Tor
choco install tor -y

# Tor will be installed to C:\ProgramData\chocolatey\lib\tor\tools\Tor
```

---

### Docker

#### Using Official Tor Docker Image

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  tor:
    image: dperson/torproxy
    container_name: tor-proxy
    restart: unless-stopped
    ports:
      - "9050:9050"   # SOCKS5 proxy
      - "9051:9051"   # Control port
    environment:
      - TOR_NewCircuitPeriod=30
      - TOR_MaxCircuitDirtiness=600
    volumes:
      - tor-data:/var/lib/tor
      - ./torrc:/etc/tor/torrc:ro
    healthcheck:
      test: ["CMD", "curl", "-s", "--socks5", "localhost:9050", "https://check.torproject.org/api/ip"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  tor-data:
```

Create a custom `torrc` file:

```
SocksPort 0.0.0.0:9050
ControlPort 0.0.0.0:9051
CookieAuthentication 0
HashedControlPassword 16:872860B76453A77D60CA2BB8C1A7042072093276A3D701AD684053EC4C
DataDirectory /var/lib/tor
Log notice stdout
```

Start the container:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f tor

# Test connection
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

#### Custom Dockerfile

Create a `Dockerfile`:

```dockerfile
FROM alpine:latest

RUN apk add --no-cache tor curl

# Create tor user
RUN adduser -D -s /bin/sh tor

# Create data directory
RUN mkdir -p /var/lib/tor && chown -R tor:tor /var/lib/tor

# Copy configuration
COPY torrc /etc/tor/torrc
RUN chown tor:tor /etc/tor/torrc

USER tor

EXPOSE 9050 9051

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -s --socks5 localhost:9050 https://check.torproject.org/api/ip || exit 1

CMD ["tor", "-f", "/etc/tor/torrc"]
```

Build and run:

```bash
docker build -t tor-custom .
docker run -d --name tor-proxy -p 9050:9050 -p 9051:9051 tor-custom
```

---

## Configuration

### Enable ControlPort

The ControlPort allows Basset Hound Browser to manage Tor circuits, request new identities, and monitor the connection.

Edit your `torrc` file:

```bash
# Linux
sudo nano /etc/tor/torrc

# macOS (Homebrew)
nano $(brew --prefix)/etc/tor/torrc

# Windows
notepad C:\Tor\torrc
```

Add or uncomment the following line:

```
ControlPort 9051
```

For network access (not recommended for production):

```
ControlPort 0.0.0.0:9051
```

Restart Tor after making changes:

```bash
# Linux
sudo systemctl restart tor

# macOS
brew services restart tor

# Windows (service)
sc stop Tor && sc start Tor
```

### Authentication Setup

Tor supports two authentication methods for the control port:

#### Method 1: Cookie Authentication (Recommended for Local Use)

Cookie authentication is simpler and more secure for local applications:

```
CookieAuthentication 1
CookieAuthFile /var/lib/tor/control_auth_cookie
```

The cookie file will be created automatically when Tor starts. Basset Hound Browser can read this file to authenticate.

**Important**: Ensure your application user has read access to the cookie file:

```bash
# Linux: Add user to tor group
sudo usermod -aG tor $(whoami)

# Or adjust permissions (less secure)
sudo chmod 644 /var/lib/tor/control_auth_cookie
```

#### Method 2: Password Authentication

For remote access or when cookie authentication is not feasible:

##### Step 1: Generate a Hashed Password

```bash
# Linux/macOS
tor --hash-password "your_secure_password"

# Windows
"C:\Tor\Tor\tor.exe" --hash-password "your_secure_password"
```

This outputs something like:

```
16:AF4F58EB9DBF5A6E8CCBB1E0D59EFE4B9D02E57D3DD47C2C9D17A6D7F4
```

##### Step 2: Configure torrc

```
ControlPort 9051
HashedControlPassword 16:AF4F58EB9DBF5A6E8CCBB1E0D59EFE4B9D02E57D3DD47C2C9D17A6D7F4
```

**Note**: Replace the hash with your generated hash.

### Bridge Configuration

Bridges help bypass Tor blocking in censored regions. They are unlisted Tor relays that make it harder to detect Tor usage.

#### Basic Bridge Configuration

```
UseBridges 1
Bridge 192.0.2.1:443
Bridge 198.51.100.1:9001
```

#### obfs4 Bridges (Recommended)

obfs4 provides protocol obfuscation to disguise Tor traffic:

```
UseBridges 1
ClientTransportPlugin obfs4 exec /usr/bin/obfs4proxy

Bridge obfs4 192.0.2.1:443 FINGERPRINT cert=CERTIFICATE iat-mode=0
Bridge obfs4 198.51.100.1:9001 FINGERPRINT cert=CERTIFICATE iat-mode=0
```

#### Getting Bridges

1. **Web**: Visit https://bridges.torproject.org/
2. **Email**: Send an email to `bridges@torproject.org` with "get transport obfs4" in the body
3. **Built-in**: Basset Hound Browser includes built-in bridge configurations

#### Snowflake Bridges

Snowflake uses WebRTC for censorship circumvention:

```
UseBridges 1
ClientTransportPlugin snowflake exec /usr/bin/snowflake-client

Bridge snowflake 192.0.2.3:80 FINGERPRINT fingerprint=FINGERPRINT url=https://snowflake-broker.torproject.net.global.prod.fastly.net/ front=cdn.sstatic.net ice=stun:stun.l.google.com:19302
```

### Sample torrc Configuration

Here is a complete, well-commented `torrc` configuration for use with Basset Hound Browser:

```
## Basset Hound Browser - Tor Configuration
## Location: /etc/tor/torrc (Linux), $(brew --prefix)/etc/tor/torrc (macOS)

#######################################
# Basic Configuration
#######################################

# SOCKS5 proxy port for browser connections
SocksPort 127.0.0.1:9050

# Control port for circuit management
ControlPort 127.0.0.1:9051

# DNS resolution port (optional)
DNSPort 9053

# Data directory for Tor state
DataDirectory /var/lib/tor

#######################################
# Authentication
#######################################

# Option 1: Cookie authentication (recommended for local use)
CookieAuthentication 1
CookieAuthFile /var/lib/tor/control_auth_cookie

# Option 2: Password authentication (uncomment and replace hash)
# HashedControlPassword 16:YOUR_HASHED_PASSWORD_HERE

#######################################
# Logging
#######################################

# Log level: debug, info, notice, warn, err
Log notice file /var/log/tor/notices.log
Log notice stdout

#######################################
# Performance Tuning
#######################################

# Time before building a new circuit (seconds)
CircuitBuildTimeout 30

# Disable learning circuit build timeout
LearnCircuitBuildTimeout 0

# How long before circuits are considered dirty (seconds)
MaxCircuitDirtiness 600

# Bandwidth limits (optional, uncomment to limit)
# RelayBandwidthRate 1 MBytes
# RelayBandwidthBurst 2 MBytes

#######################################
# Exit Node Configuration (Optional)
#######################################

# Prefer exit nodes in specific countries
# ExitNodes {us},{de},{nl},{fr},{gb}

# Exclude exit nodes in specific countries
# ExcludeExitNodes {cn},{ru},{ir}

# Strictly enforce exit node preferences
# StrictNodes 1

#######################################
# Entry Node Configuration (Optional)
#######################################

# Prefer entry nodes in specific countries
# EntryNodes {de},{nl},{ch}

#######################################
# Bridge Configuration (Optional)
#######################################

# Enable bridges (uncomment all lines in this section)
# UseBridges 1
# ClientTransportPlugin obfs4 exec /usr/bin/obfs4proxy

# Add your bridges here (get from bridges.torproject.org)
# Bridge obfs4 IP:PORT FINGERPRINT cert=CERT iat-mode=0

#######################################
# Isolation (Optional)
#######################################

# Additional SOCKS ports with isolation flags
# SocksPort 127.0.0.1:9051 IsolateClientAddr IsolateSOCKSAuth
# SocksPort 127.0.0.1:9052 IsolateClientAddr IsolateSOCKSAuth
# SocksPort 127.0.0.1:9053 IsolateClientAddr IsolateSOCKSAuth

#######################################
# Security Settings
#######################################

# Disable client port connections from external hosts
SocksPolicy accept 127.0.0.1
SocksPolicy reject *

# Avoid disk writes where possible
AvoidDiskWrites 1

# Safe logging (do not log sensitive data)
SafeLogging 1
```

---

## Verification

### Check Service Status

#### Linux (systemd)

```bash
# Check if Tor is running
sudo systemctl status tor

# Expected output should show "active (running)"
# Example:
# ● tor.service - Anonymizing overlay network for TCP
#    Loaded: loaded (/lib/systemd/system/tor.service; enabled)
#    Active: active (running) since ...

# Check Tor process
ps aux | grep tor

# View recent logs
sudo journalctl -u tor -n 50

# Check bootstrap status
sudo tail -f /var/log/tor/notices.log | grep -i bootstrap
```

#### macOS

```bash
# Check Homebrew service status
brew services list | grep tor

# Check process
pgrep -l tor

# View logs
tail -f /usr/local/var/log/tor.log
```

#### Windows

```batch
# Check service status
sc query Tor

# Check if tor.exe is running
tasklist | findstr tor
```

### Test SOCKS Proxy

#### Using curl

```bash
# Test SOCKS5 proxy connection
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip

# Expected output: {"IsTor":true,"IP":"<exit_node_ip>"}

# Alternative: Get your Tor exit IP
curl --socks5 127.0.0.1:9050 https://api.ipify.org

# Verbose test with connection timing
curl -v --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

#### Using Python

```python
import requests

# Configure SOCKS proxy
proxies = {
    'http': 'socks5h://127.0.0.1:9050',
    'https': 'socks5h://127.0.0.1:9050'
}

# Test connection
try:
    response = requests.get('https://check.torproject.org/api/ip', proxies=proxies, timeout=30)
    data = response.json()
    print(f"Connected to Tor: {data['IsTor']}")
    print(f"Exit IP: {data['IP']}")
except Exception as e:
    print(f"Connection failed: {e}")
```

#### Using netcat

```bash
# Test if SOCKS port is open
nc -zv 127.0.0.1 9050

# Expected output:
# Connection to 127.0.0.1 9050 port [tcp/*] succeeded!
```

### Test Control Port Connection

#### Using netcat/telnet

```bash
# Connect to control port
nc 127.0.0.1 9051

# Authenticate (if using password)
AUTHENTICATE "your_password"

# Should receive: 250 OK

# Get Tor version
GETINFO version

# Get bootstrap status
GETINFO status/bootstrap-phase

# Request new identity
SIGNAL NEWNYM

# Quit
QUIT
```

#### Using Python (stem library)

```python
from stem import Signal
from stem.control import Controller

# Connect to control port
try:
    with Controller.from_port(port=9051) as controller:
        # Authenticate (cookie or password)
        controller.authenticate()  # Uses cookie auth by default
        # Or: controller.authenticate(password="your_password")

        # Get Tor version
        print(f"Tor version: {controller.get_version()}")

        # Check if connected
        print(f"Is alive: {controller.is_alive()}")

        # Get circuit info
        for circuit in controller.get_circuits():
            if circuit.status == 'BUILT':
                print(f"Circuit {circuit.id}: {' -> '.join(circuit.path)}")

        # Request new identity
        controller.signal(Signal.NEWNYM)
        print("New identity requested!")

except Exception as e:
    print(f"Connection failed: {e}")
```

Install the stem library:

```bash
pip install stem
```

#### Complete Verification Script

Save as `verify_tor.sh`:

```bash
#!/bin/bash

echo "=== Tor Verification Script ==="
echo ""

# Check 1: Service status
echo "[1/4] Checking Tor service..."
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet tor; then
        echo "  ✓ Tor service is running"
    else
        echo "  ✗ Tor service is NOT running"
        echo "  Try: sudo systemctl start tor"
        exit 1
    fi
elif command -v pgrep &> /dev/null; then
    if pgrep -x tor > /dev/null; then
        echo "  ✓ Tor process is running"
    else
        echo "  ✗ Tor process is NOT running"
        exit 1
    fi
fi

# Check 2: SOCKS port
echo ""
echo "[2/4] Testing SOCKS proxy (port 9050)..."
if nc -z 127.0.0.1 9050 2>/dev/null; then
    echo "  ✓ SOCKS port 9050 is open"
else
    echo "  ✗ SOCKS port 9050 is NOT open"
    exit 1
fi

# Check 3: Control port
echo ""
echo "[3/4] Testing Control port (port 9051)..."
if nc -z 127.0.0.1 9051 2>/dev/null; then
    echo "  ✓ Control port 9051 is open"
else
    echo "  ✗ Control port 9051 is NOT open"
    echo "  Ensure 'ControlPort 9051' is in your torrc"
fi

# Check 4: Tor exit IP
echo ""
echo "[4/4] Verifying Tor connection..."
if command -v curl &> /dev/null; then
    RESPONSE=$(curl -s --socks5 127.0.0.1:9050 --max-time 30 https://check.torproject.org/api/ip 2>/dev/null)
    if [[ $RESPONSE == *"IsTor"* ]]; then
        IS_TOR=$(echo $RESPONSE | grep -o '"IsTor":[^,]*' | cut -d':' -f2)
        EXIT_IP=$(echo $RESPONSE | grep -o '"IP":"[^"]*"' | cut -d'"' -f4)
        if [[ $IS_TOR == "true" ]]; then
            echo "  ✓ Successfully connected through Tor"
            echo "  Exit IP: $EXIT_IP"
        else
            echo "  ✗ NOT connected through Tor"
            exit 1
        fi
    else
        echo "  ✗ Failed to verify Tor connection"
        exit 1
    fi
else
    echo "  ⚠ curl not available, skipping Tor verification"
fi

echo ""
echo "=== All checks passed! Tor is ready for use ==="
```

Make it executable and run:

```bash
chmod +x verify_tor.sh
./verify_tor.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Tor fails to start

**Symptoms**: `systemctl status tor` shows failed state

**Solutions**:

```bash
# Check for configuration errors
tor --verify-config

# Check logs for specific errors
sudo journalctl -u tor -n 100

# Common fixes:
# 1. Fix permissions on data directory
sudo chown -R debian-tor:debian-tor /var/lib/tor
sudo chmod 700 /var/lib/tor

# 2. Check if ports are in use
sudo lsof -i :9050
sudo lsof -i :9051

# 3. Validate torrc syntax
tor --verify-config -f /etc/tor/torrc
```

#### Issue: Control port connection refused

**Symptoms**: Cannot connect to port 9051

**Solutions**:

```bash
# Ensure ControlPort is enabled in torrc
grep -i "controlport" /etc/tor/torrc

# Add if missing
echo "ControlPort 9051" | sudo tee -a /etc/tor/torrc

# Restart Tor
sudo systemctl restart tor

# Verify port is listening
sudo ss -tlnp | grep 9051
```

#### Issue: Authentication failed (515 error)

**Symptoms**: `515 Authentication failed` when connecting to control port

**Solutions**:

```bash
# For cookie authentication:
# Check cookie file exists and is readable
ls -la /var/lib/tor/control_auth_cookie

# Add user to tor group
sudo usermod -aG tor $(whoami)
# Log out and back in for group changes to take effect

# For password authentication:
# Regenerate the hashed password
tor --hash-password "your_password"
# Update torrc with new hash

# Restart Tor
sudo systemctl restart tor
```

#### Issue: Connection timeout through SOCKS proxy

**Symptoms**: Connections through Tor time out or fail

**Solutions**:

```bash
# Check bootstrap status
sudo grep -i bootstrap /var/log/tor/notices.log

# If stuck at low percentage, Tor may be blocked
# Try using bridges:
# 1. Get bridges from bridges.torproject.org
# 2. Add to torrc:
#    UseBridges 1
#    Bridge obfs4 ...

# Check firewall rules
sudo iptables -L -n | grep -E "9050|9051"

# If using UFW:
sudo ufw allow 9050/tcp
sudo ufw allow 9051/tcp

# Increase timeouts in torrc
echo "CircuitBuildTimeout 60" | sudo tee -a /etc/tor/torrc
```

#### Issue: Slow connections

**Symptoms**: Tor connections are very slow

**Solutions**:

```bash
# Check current circuit
# Use stem or nyx to view circuit details

# Force new circuit
echo -e 'AUTHENTICATE ""\nSIGNAL NEWNYM\nQUIT' | nc localhost 9051

# Optimize torrc:
# Add these settings:
CircuitBuildTimeout 20
LearnCircuitBuildTimeout 0
MaxCircuitDirtiness 300

# Prefer faster exit nodes
ExitNodes {de},{nl},{se},{ch}

# Restart Tor
sudo systemctl restart tor
```

#### Issue: "Tor is not running" in browser

**Symptoms**: Basset Hound Browser reports Tor is not available

**Solutions**:

```bash
# Verify Tor is running
ps aux | grep tor

# Check SOCKS port from browser's perspective
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip

# Ensure browser is configured correctly
# Default settings:
# - SOCKS Host: 127.0.0.1
# - SOCKS Port: 9050
# - Control Port: 9051
```

#### Issue: Bridges not working

**Symptoms**: Tor cannot connect when using bridges

**Solutions**:

```bash
# Verify obfs4proxy is installed
which obfs4proxy

# Install if missing (Ubuntu/Debian)
sudo apt install obfs4proxy

# Verify bridge configuration in torrc
grep -i "bridge" /etc/tor/torrc

# Check obfs4proxy is correctly configured
# ClientTransportPlugin obfs4 exec /usr/bin/obfs4proxy

# Try different bridges
# Get new bridges from bridges.torproject.org

# Check for clock skew (important for Tor)
date
# Sync time if needed
sudo ntpdate pool.ntp.org
```

### Debug Mode

Enable detailed logging for troubleshooting:

```
# Add to torrc
Log debug file /var/log/tor/debug.log
Log info file /var/log/tor/info.log
```

Monitor logs:

```bash
sudo tail -f /var/log/tor/debug.log
```

---

## Security Considerations

### Best Practices for Tor Usage

#### 1. Keep Tor Updated

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade tor

# Fedora
sudo dnf upgrade tor

# macOS
brew upgrade tor
```

Always use the latest stable version to ensure you have security patches.

#### 2. Secure Configuration

```
# Restrict SOCKS connections to localhost only
SocksPort 127.0.0.1:9050
SocksPolicy accept 127.0.0.1
SocksPolicy reject *

# Restrict control port access
ControlPort 127.0.0.1:9051

# Enable safe logging
SafeLogging 1

# Avoid writing to disk unnecessarily
AvoidDiskWrites 1
```

#### 3. Protect Control Port

- **Never** expose the control port to the network (`ControlPort 0.0.0.0:9051`)
- Use cookie authentication for local applications
- Use strong hashed passwords for any remote access
- Consider firewall rules to restrict access

```bash
# Firewall rule example (iptables)
sudo iptables -A INPUT -p tcp --dport 9051 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 9051 -j DROP
```

#### 4. DNS Leak Prevention

Configure your system to use Tor for DNS resolution:

```
# In torrc
DNSPort 9053
AutomapHostsOnResolve 1
AutomapHostsSuffixes .exit,.onion
```

Configure applications to use Tor's DNS:

```bash
# Use torsocks for transparent proxying
torsocks curl https://example.com
```

#### 5. Application Isolation

- Use different SOCKS ports for different applications
- Enable stream isolation in torrc:

```
SocksPort 127.0.0.1:9050 IsolateClientAddr IsolateSOCKSAuth
SocksPort 127.0.0.1:9051 IsolateClientAddr IsolateSOCKSAuth
```

#### 6. Monitor for Anomalies

```bash
# Install nyx for Tor monitoring
pip install nyx

# Run nyx
nyx
```

### What NOT to Do

1. **Don't enable JavaScript indiscriminately** on .onion sites
2. **Don't log into personal accounts** over Tor
3. **Don't torrent over Tor** - it can deanonymize you and overloads the network
4. **Don't run Tor as root** unless absolutely necessary
5. **Don't ignore Tor Browser warnings** about security
6. **Don't mix Tor and non-Tor traffic** in the same browser session

### Threat Model Considerations

| Threat | Mitigation |
|--------|------------|
| Traffic analysis | Use bridges with obfs4 |
| Exit node monitoring | Use HTTPS for all connections |
| Malicious relays | Keep Tor updated; use only trusted .onion services |
| Browser fingerprinting | Use standardized window sizes; disable JavaScript |
| Timing correlation | Don't make identifiable patterns; use new identity regularly |
| Local monitoring | Use encrypted storage; consider Tails OS |

---

## Integration with Basset Hound Browser

Basset Hound Browser provides comprehensive Tor integration through its WebSocket API. This section covers all available Tor-related commands and configuration options.

### Connecting to an Existing Tor Instance

The simplest method is to connect to a Tor instance running on your system:

```json
{
  "id": "1",
  "command": "tor_connect_existing",
  "socksHost": "127.0.0.1",
  "socksPort": 9050,
  "controlHost": "127.0.0.1",
  "controlPort": 9051,
  "controlPassword": "your_password"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "message": "Connected to existing Tor instance",
  "exitIp": "185.xxx.xxx.xxx",
  "exitCountry": "NL"
}
```

### Starting Tor from Within the Browser

Basset Hound Browser can manage its own Tor process:

```json
{
  "id": "1",
  "command": "tor_start",
  "torBinaryPath": "/usr/bin/tor",
  "dataDirectory": "/home/user/.basset-hound/tor"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "message": "Tor started and connected",
  "pid": 12345
}
```

### Checking Tor Status

```json
{
  "id": "1",
  "command": "tor_status"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "status": {
    "state": "connected",
    "connected": true,
    "processRunning": true,
    "pid": 12345,
    "bootstrapProgress": 100,
    "bootstrapPhase": "Done",
    "controlConnected": true,
    "authenticated": true,
    "socks": {
      "host": "127.0.0.1",
      "port": 9050
    },
    "control": {
      "host": "127.0.0.1",
      "port": 9051
    },
    "exitNode": {
      "ip": "185.xxx.xxx.xxx",
      "country": "NL"
    }
  }
}
```

### Requesting a New Identity

Change your Tor circuit to get a new exit IP:

```json
{
  "id": "1",
  "command": "tor_rebuild_circuit"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "message": "New Tor circuit established",
  "exitIp": "104.xxx.xxx.xxx",
  "exitCountry": "DE",
  "circuitChangeCount": 5
}
```

### Circuit Information

#### Get All Circuits

```json
{
  "id": "1",
  "command": "tor_get_circuits"
}
```

#### Get Circuit Path Details

```json
{
  "id": "1",
  "command": "tor_get_circuit_path",
  "circuitId": "123"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "circuitId": "123",
  "status": "BUILT",
  "purpose": "GENERAL",
  "path": [
    {
      "hop": 1,
      "role": "Guard",
      "fingerprint": "ABC123...",
      "nickname": "GuardNode1",
      "address": "192.0.2.1",
      "country": "DE"
    },
    {
      "hop": 2,
      "role": "Middle",
      "fingerprint": "DEF456...",
      "nickname": "MiddleNode1",
      "address": "198.51.100.1",
      "country": "NL"
    },
    {
      "hop": 3,
      "role": "Exit",
      "fingerprint": "GHI789...",
      "nickname": "ExitNode1",
      "address": "203.0.113.1",
      "country": "SE"
    }
  ]
}
```

### Exit Node Control

#### Set Exit Countries

Restrict exit nodes to specific countries:

```json
{
  "id": "1",
  "command": "tor_set_exit_country",
  "countries": ["US", "DE", "NL"]
}
```

#### Exclude Countries

Block exit nodes from specific countries:

```json
{
  "id": "1",
  "command": "tor_exclude_countries",
  "countries": ["CN", "RU", "IR"]
}
```

#### Set Entry Countries

```json
{
  "id": "1",
  "command": "tor_set_entry_country",
  "countries": ["DE", "CH"]
}
```

#### Clear Restrictions

```json
{
  "id": "1",
  "command": "tor_clear_exit_restrictions"
}
```

#### Get Available Country Codes

```json
{
  "id": "1",
  "command": "tor_get_country_codes"
}
```

### Bridge Configuration

#### Enable Bridges

```json
{
  "id": "1",
  "command": "tor_enable_bridges",
  "transport": "obfs4",
  "useBuiltin": true
}
```

#### Add Custom Bridge

```json
{
  "id": "1",
  "command": "tor_add_bridge",
  "bridge": "obfs4 192.0.2.1:443 FINGERPRINT cert=CERT iat-mode=0"
}
```

#### Set Transport Type

```json
{
  "id": "1",
  "command": "tor_set_transport",
  "transport": "snowflake",
  "useBuiltin": true
}
```

Available transports:
- `none` - Direct Tor connection
- `obfs4` - Obfuscated protocol (most common)
- `meek` - Domain fronting via Azure
- `snowflake` - WebRTC-based circumvention
- `webtunnel` - HTTPS-based tunneling

#### Disable Bridges

```json
{
  "id": "1",
  "command": "tor_disable_bridges"
}
```

### Stream Isolation

Isolate traffic from different sources:

#### Set Isolation Mode

```json
{
  "id": "1",
  "command": "tor_set_isolation",
  "mode": "per_tab"
}
```

Modes:
- `none` - No isolation
- `per_tab` - Each browser tab uses separate circuit
- `per_domain` - Each domain uses separate circuit
- `per_session` - Each session uses separate circuit

#### Get Isolated Port

```json
{
  "id": "1",
  "command": "tor_get_isolated_port",
  "key": "tab-123"
}
```

### Onion Services

#### Create Onion Service

Host a hidden service:

```json
{
  "id": "1",
  "command": "tor_create_onion_service",
  "port": 80,
  "targetPort": 8080,
  "targetHost": "127.0.0.1"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "address": "abcdefghijklmnopqrstuvwxyz234567890123456789012345678.onion",
  "serviceId": "abcdefghijklmnopqrstuvwxyz234567890123456789012345678",
  "port": 80,
  "targetPort": 8080,
  "version": 3
}
```

#### List Onion Services

```json
{
  "id": "1",
  "command": "tor_list_onion_services"
}
```

#### Remove Onion Service

```json
{
  "id": "1",
  "command": "tor_remove_onion_service",
  "serviceId": "abcdefghijklmnopqrstuvwxyz234567890123456789012345678"
}
```

#### Check if URL is Onion

```json
{
  "id": "1",
  "command": "tor_is_onion_url",
  "url": "http://example.onion/page"
}
```

### Network Statistics

#### Get Bandwidth

```json
{
  "id": "1",
  "command": "tor_get_bandwidth"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "bytesRead": 1048576,
  "bytesWritten": 524288,
  "bytesReadFormatted": "1 MB",
  "bytesWrittenFormatted": "512 KB"
}
```

#### Check Connection

Verify Tor is working:

```json
{
  "id": "1",
  "command": "tor_check_connection"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "ip": "185.xxx.xxx.xxx",
  "isTor": true,
  "message": "Connected through Tor"
}
```

#### Get Network Consensus

```json
{
  "id": "1",
  "command": "tor_get_consensus"
}
```

### Proxy Configuration

#### Get Proxy Config

```json
{
  "id": "1",
  "command": "tor_get_proxy_config",
  "isolationKey": "tab-123"
}
```

**Response:**

```json
{
  "id": "1",
  "success": true,
  "config": {
    "host": "127.0.0.1",
    "port": 9050,
    "type": "socks5"
  },
  "rules": "socks5://127.0.0.1:9050"
}
```

### Complete Python Integration Example

```python
import asyncio
import websockets
import json

class BassetHoundTorClient:
    def __init__(self, uri="ws://localhost:8765"):
        self.uri = uri
        self.ws = None
        self.request_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.uri)
        # Wait for connection message
        await self.ws.recv()

    async def send(self, command, **params):
        self.request_id += 1
        message = {
            "id": str(self.request_id),
            "command": command,
            **params
        }
        await self.ws.send(json.dumps(message))
        response = json.loads(await self.ws.recv())

        if not response.get("success"):
            raise Exception(f"Command failed: {response.get('error')}")

        return response

    async def connect_tor(self, socks_port=9050, control_port=9051, password=None):
        params = {
            "socksHost": "127.0.0.1",
            "socksPort": socks_port,
            "controlHost": "127.0.0.1",
            "controlPort": control_port
        }
        if password:
            params["controlPassword"] = password
        return await self.send("tor_connect_existing", **params)

    async def new_identity(self):
        return await self.send("tor_rebuild_circuit")

    async def get_status(self):
        return await self.send("tor_status")

    async def set_exit_country(self, countries):
        if isinstance(countries, str):
            countries = [countries]
        return await self.send("tor_set_exit_country", countries=countries)

    async def get_circuit_path(self, circuit_id=None):
        params = {}
        if circuit_id:
            params["circuitId"] = circuit_id
        return await self.send("tor_get_circuit_path", **params)

    async def check_connection(self):
        return await self.send("tor_check_connection")

    async def close(self):
        if self.ws:
            await self.ws.close()

async def main():
    client = BassetHoundTorClient()

    try:
        # Connect to browser
        await client.connect()
        print("Connected to Basset Hound Browser")

        # Connect to Tor
        result = await client.connect_tor()
        print(f"Tor connected: {result}")

        # Get status
        status = await client.get_status()
        print(f"Exit IP: {status['status']['exitNode']['ip']}")

        # Set exit country to Germany
        await client.set_exit_country("DE")
        print("Set exit country to Germany")

        # Request new identity
        new_id = await client.new_identity()
        print(f"New identity: {new_id['exitIp']}")

        # Get circuit path
        path = await client.get_circuit_path()
        print("Circuit path:")
        for node in path.get("path", []):
            print(f"  {node['hop']}. {node['role']}: {node['nickname']} ({node['country']})")

        # Verify connection
        check = await client.check_connection()
        print(f"Tor verified: {check['isTor']}, IP: {check['ip']}")

    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### JavaScript/Node.js Integration Example

```javascript
const WebSocket = require('ws');

class BassetHoundTorClient {
  constructor(uri = 'ws://localhost:8765') {
    this.uri = uri;
    this.ws = null;
    this.requestId = 0;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.uri);

      this.ws.on('open', () => {
        console.log('Connected to Basset Hound Browser');
      });

      this.ws.on('message', (data) => {
        const response = JSON.parse(data);

        if (response.type === 'status' && response.message === 'connected') {
          resolve();
          return;
        }

        if (response.id && this.pending.has(response.id)) {
          const { resolve: res, reject: rej } = this.pending.get(response.id);
          this.pending.delete(response.id);

          if (response.success) {
            res(response);
          } else {
            rej(new Error(response.error));
          }
        }
      });

      this.ws.on('error', reject);
    });
  }

  send(command, params = {}) {
    return new Promise((resolve, reject) => {
      this.requestId++;
      const id = String(this.requestId);

      this.pending.set(id, { resolve, reject });

      this.ws.send(JSON.stringify({
        id,
        command,
        ...params
      }));
    });
  }

  async connectTor(options = {}) {
    return this.send('tor_connect_existing', {
      socksHost: options.socksHost || '127.0.0.1',
      socksPort: options.socksPort || 9050,
      controlHost: options.controlHost || '127.0.0.1',
      controlPort: options.controlPort || 9051,
      controlPassword: options.controlPassword
    });
  }

  async newIdentity() {
    return this.send('tor_rebuild_circuit');
  }

  async getStatus() {
    return this.send('tor_status');
  }

  async setExitCountry(countries) {
    const countryList = Array.isArray(countries) ? countries : [countries];
    return this.send('tor_set_exit_country', { countries: countryList });
  }

  async getCircuitPath(circuitId = null) {
    const params = circuitId ? { circuitId } : {};
    return this.send('tor_get_circuit_path', params);
  }

  async checkConnection() {
    return this.send('tor_check_connection');
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const client = new BassetHoundTorClient();

  try {
    await client.connect();

    // Connect to Tor
    const torResult = await client.connectTor();
    console.log('Tor connected:', torResult);

    // Get status
    const status = await client.getStatus();
    console.log('Exit IP:', status.status.exitNode.ip);

    // Set exit country
    await client.setExitCountry('NL');
    console.log('Exit country set to Netherlands');

    // New identity
    const newId = await client.newIdentity();
    console.log('New exit IP:', newId.exitIp);

    // Get circuit path
    const path = await client.getCircuitPath();
    console.log('Circuit path:');
    path.path.forEach(node => {
      console.log(`  ${node.hop}. ${node.role}: ${node.nickname} (${node.country})`);
    });

    // Verify
    const check = await client.checkConnection();
    console.log(`Tor verified: ${check.isTor}, IP: ${check.ip}`);

  } finally {
    client.close();
  }
}

main().catch(console.error);
```

---

## Additional Resources

- **Tor Project Official Documentation**: https://www.torproject.org/docs/
- **Tor Manual**: https://2019.www.torproject.org/docs/tor-manual.html.en
- **Tor Metrics**: https://metrics.torproject.org/
- **Onion Services Best Practices**: https://community.torproject.org/onion-services/
- **Stem (Python Tor Controller)**: https://stem.torproject.org/
- **Nyx (Tor Status Monitor)**: https://nyx.torproject.org/

---

*This documentation is part of the Basset Hound Browser project. For issues or contributions, please visit the project repository.*
