# System Tor Installation Guide

This guide explains how to install and configure system Tor for use with Basset Hound Browser.

## Default Behavior

By default, Basset Hound Browser uses **embedded Tor**, which is automatically downloaded on first use. This requires no additional setup.

To use system-installed Tor instead, run the browser with:
```bash
npm start -- --tor --system-tor
```

## Why Use System Tor?

- **Already running**: If you have Tor running as a system service
- **Shared circuit**: Share Tor circuits with other applications
- **Custom configuration**: Use your own torrc configuration
- **Resource efficiency**: Avoid running multiple Tor instances

## Installation by Platform

### Ubuntu/Debian

```bash
# Install Tor
sudo apt update
sudo apt install tor

# Start and enable the service
sudo systemctl start tor
sudo systemctl enable tor

# Verify it's running
sudo systemctl status tor
```

### Fedora/RHEL/CentOS

```bash
# Install Tor
sudo dnf install tor

# Start and enable the service
sudo systemctl start tor
sudo systemctl enable tor

# Verify it's running
sudo systemctl status tor
```

### Arch Linux

```bash
# Install Tor
sudo pacman -S tor

# Start and enable the service
sudo systemctl start tor
sudo systemctl enable tor
```

### macOS (Homebrew)

```bash
# Install Tor
brew install tor

# Start as a service
brew services start tor

# Or run manually
tor
```

### macOS (MacPorts)

```bash
# Install Tor
sudo port install tor

# Start the service
sudo port load tor
```

### Windows

1. Download the Tor Expert Bundle from https://www.torproject.org/download/tor/
2. Extract to a permanent location (e.g., `C:\Tor`)
3. Run `tor.exe` or set up as a service:

```powershell
# Create as a Windows service (run as Administrator)
sc create Tor binPath= "C:\Tor\tor\tor.exe -f C:\Tor\torrc"
sc start Tor
```

### Docker

```dockerfile
# Add to your Dockerfile
RUN apt-get update && apt-get install -y tor
```

Or use a separate Tor container:
```yaml
# docker-compose.yml
services:
  tor:
    image: osminogin/tor-simple
    ports:
      - "9050:9050"
      - "9051:9051"
```

## Configuration

### Default Ports

System Tor typically uses:
- **SOCKS Port**: 9050
- **Control Port**: 9051

### Custom torrc

If you need custom settings, edit the torrc file:

**Linux**: `/etc/tor/torrc`
**macOS (Homebrew)**: `/usr/local/etc/tor/torrc` or `/opt/homebrew/etc/tor/torrc`
**Windows**: `C:\Tor\torrc` (or wherever you extracted)

Example torrc additions:
```
# Allow connections from Basset Hound Browser
SocksPort 9050
ControlPort 9051
CookieAuthentication 1

# Optional: Enable DNS over Tor
DNSPort 9053

# Optional: Custom data directory
DataDirectory /var/lib/tor
```

After editing, restart Tor:
```bash
sudo systemctl restart tor
```

### Control Port Authentication

For advanced features (circuit management, identity changes), enable control port authentication:

**Cookie Authentication** (recommended):
```
ControlPort 9051
CookieAuthentication 1
CookieAuthFile /var/run/tor/control.authcookie
```

**Password Authentication**:
```bash
# Generate a hashed password
tor --hash-password your_password

# Add to torrc
ControlPort 9051
HashedControlPassword <output from above>
```

## Verifying the Installation

### Check if Tor is running

```bash
# Linux/macOS
sudo systemctl status tor
# or
ps aux | grep tor

# Windows (PowerShell)
Get-Process tor
# or
sc query Tor
```

### Test SOCKS connectivity

```bash
# Test with curl
curl --socks5-hostname localhost:9050 https://check.torproject.org/api/ip

# Should return: {"IsTor": true, "IP": "..."}
```

### Test from Basset Hound Browser

```bash
# Start with system Tor
npm start -- --tor --system-tor

# The browser will connect through your system Tor daemon
```

## Troubleshooting

### "Connection refused" on port 9050

1. Ensure Tor is running:
   ```bash
   sudo systemctl start tor
   ```

2. Check if it's listening:
   ```bash
   ss -tlnp | grep 9050
   # or
   netstat -tlnp | grep 9050
   ```

3. Check torrc for correct SocksPort configuration

### "Authentication required" for control port

1. Check cookie file permissions:
   ```bash
   ls -la /var/run/tor/control.authcookie
   ```

2. Add your user to the tor group:
   ```bash
   sudo usermod -aG debian-tor $USER
   # or
   sudo usermod -aG tor $USER
   ```

3. Log out and back in for group changes to take effect

### Tor takes too long to start

1. Check network connectivity
2. Look at Tor logs:
   ```bash
   sudo journalctl -u tor -f
   ```
3. Try using bridges if Tor is blocked in your region

### "No route to host" errors

1. Check firewall rules:
   ```bash
   sudo iptables -L
   ```

2. Ensure localhost connections are allowed:
   ```bash
   sudo iptables -A INPUT -i lo -j ACCEPT
   ```

## Using with Basset Hound Browser

### Command Line Options

```bash
# Use system Tor (instead of embedded)
npm start -- --tor --system-tor

# Custom SOCKS port
npm start -- --proxy socks5://localhost:9050

# Disable auto-download of embedded Tor
npm start -- --tor --system-tor --no-tor-auto-download
```

### Configuration File

```yaml
# config.yaml
network:
  tor:
    enabled: true
    useSystem: true
    useEmbedded: false
    socksPort: 9050
    controlPort: 9051
```

### Environment Variables

```bash
export BASSET_NETWORK_TOR_ENABLED=true
export BASSET_NETWORK_TOR_USE_SYSTEM=true
npm start
```

## Security Considerations

1. **Isolate Tor traffic**: Don't mix Tor and non-Tor traffic
2. **Keep Tor updated**: Security fixes are released regularly
3. **Use bridges if needed**: For censored regions
4. **Check for leaks**: Use check.torproject.org regularly
5. **Don't run as root**: Use a dedicated user for the Tor daemon

## Additional Resources

- [Tor Project Documentation](https://www.torproject.org/docs/documentation.html)
- [Tor Manual (torrc options)](https://manpages.debian.org/testing/tor/torrc.5.en.html)
- [Tor Support Portal](https://support.torproject.org/)
