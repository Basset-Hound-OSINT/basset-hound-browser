# Tor Installation Guide for Ubuntu 22.04 LTS

**Installation Date**: December 29, 2024
**Tor Version Installed**: 0.4.8.21
**Status**: ✅ **VERIFIED WORKING**

---

## Installation Summary

| Component | Status | Details |
|-----------|--------|---------|
| Tor Package | ✅ Installed | v0.4.8.21 from official Tor Project repository |
| SOCKS Proxy | ✅ Running | Port 9050, verified with torproject.org |
| Control Port | ✅ Running | Port 9051, authenticated successfully |
| Service | ✅ Enabled | Auto-starts on boot |
| Bootstrap | ✅ 100% | Fully connected to Tor network |

**Exit IP Verified**: `109.70.100.2` (Tor exit node confirmed by check.torproject.org)

---

## Quick Installation (Recommended)

Run this command in your terminal:

```bash
cd ~/basset-hound-browser
sudo ./scripts/install/install-tor.sh
```

Enter your password when prompted. The script will handle everything automatically.

---

## Manual Installation Steps (Verified Working)

The following steps were tested and verified on Ubuntu 22.04 LTS on December 29, 2024:

### Step 1: Install Prerequisites

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https gpg wget curl netcat-openbsd
```

### Step 2: Add Official Tor Project Repository

```bash
# Add GPG key
wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | sudo gpg --dearmor -o /usr/share/keyrings/tor-archive-keyring.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org jammy main" | sudo tee /etc/apt/sources.list.d/tor.list

# Update package lists
sudo apt-get update
```

### Step 3: Install Tor

```bash
sudo apt-get install -y tor deb.torproject.org-keyring
```

### Step 4: Configure Tor for Basset Hound Browser

Create the configuration by running:

```bash
# Backup existing config
sudo cp /etc/tor/torrc /etc/tor/torrc.backup

# Generate hashed password for control port
# Using default password: basset-hound-password
HASHED_PASSWORD=$(tor --hash-password "basset-hound-password" 2>/dev/null)

# Add Basset Hound configuration
sudo tee -a /etc/tor/torrc > /dev/null << EOF

# =============================================================================
# Basset Hound Browser Configuration
# Added: $(date)
# =============================================================================

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

# Log configuration
Log notice file /var/log/tor/notices.log

# Data directory
DataDirectory /var/lib/tor
EOF
```

### Step 5: Restart Tor Service

```bash
sudo systemctl restart tor
sudo systemctl enable tor
```

### Step 6: Verify Installation

```bash
# Check service status
sudo systemctl status tor

# Check Tor version
tor --version

# Test SOCKS proxy (should return a Tor exit IP)
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip

# Test control port
echo -e 'AUTHENTICATE "basset-hound-password"\r\nGETINFO version\r\nQUIT' | nc localhost 9051
```

---

## Actual Installation Output (December 29, 2024)

### Service Status
```
● tor@default.service - Anonymizing overlay network for TCP
     Loaded: loaded (/lib/systemd/system/tor@default.service; enabled-runtime)
     Active: active (running) since Mon 2025-12-29 16:18:20 EST
   Main PID: 82359 (tor)
     Memory: 122.8M

Dec 29 16:18:26 pwnstar Tor[82359]: Bootstrapped 100% (done): Done
```

### SOCKS Proxy Test
```bash
$ curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
{"IsTor":true,"IP":"109.70.100.2"}
```
✅ **Tor exit IP confirmed!**

### Control Port Test
```bash
$ echo -e 'AUTHENTICATE "basset-hound-password"\r\nGETINFO version\r\nQUIT' | nc localhost 9051
250 OK
250-version=0.4.8.21
250 OK
250 closing connection
```
✅ **Authentication successful!**

### Ports Verified
```bash
$ ss -tlnp | grep -E '9050|9051'
LISTEN  127.0.0.1:9051  # Control port
LISTEN  127.0.0.1:9050  # SOCKS proxy
```

---

## Ports Used

| Port | Protocol | Purpose |
|------|----------|---------|
| 9050 | SOCKS5 | Tor proxy for browsing |
| 9051 | TCP | Control port for programmatic access |

---

## Security Notes

1. **Default Password**: The default control port password is `basset-hound-password`. Change this for production use!

2. **Generate New Password**:
   ```bash
   # Generate hashed password
   tor --hash-password "your-secure-password"

   # Update /etc/tor/torrc with the new hash
   sudo nano /etc/tor/torrc

   # Restart Tor
   sudo systemctl restart tor
   ```

3. **Firewall**: Tor only listens on localhost by default. No firewall changes needed.

4. **Logs**: Tor logs are stored at `/var/log/tor/notices.log`

---

## Troubleshooting

### Tor service won't start
```bash
# Check logs
sudo journalctl -u tor -f

# Check config syntax
sudo tor --verify-config
```

### SOCKS proxy not responding
```bash
# Check if port is open
ss -tlnp | grep 9050

# Restart service
sudo systemctl restart tor
```

### Control port authentication fails
```bash
# Regenerate password hash
HASH=$(tor --hash-password "basset-hound-password")
echo "HashedControlPassword $HASH"

# Update /etc/tor/torrc and restart
sudo systemctl restart tor
```

### Permission issues
```bash
# Fix ownership
sudo chown -R debian-tor:debian-tor /var/lib/tor
sudo chmod 700 /var/lib/tor
```

---

## Uninstallation

To completely remove Tor:

```bash
sudo systemctl stop tor
sudo apt-get remove --purge tor deb.torproject.org-keyring
sudo rm -rf /etc/tor /var/lib/tor /var/log/tor
sudo rm /etc/apt/sources.list.d/tor.list
sudo rm /usr/share/keyrings/tor-archive-keyring.gpg
```

---

## Integration with Basset Hound Browser

Once Tor is installed and running, you can use these WebSocket commands:

```javascript
// Check Tor connection
{ "command": "tor_check_connection" }

// Get circuit path
{ "command": "tor_get_circuit_path" }

// Set exit country
{ "command": "tor_set_exit_country", "countries": ["us", "de", "nl"] }

// Get new identity (new circuit)
{ "command": "tor_rebuild_circuit" }

// Get bandwidth stats
{ "command": "tor_get_bandwidth" }
```

---

*Document created: December 28, 2024*
*For Basset Hound Browser v8.1.4*
