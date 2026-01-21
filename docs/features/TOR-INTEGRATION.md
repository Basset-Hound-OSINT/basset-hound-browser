# Tor Integration Guide for Basset Hound Browser

## Overview

Basset Hound Browser provides comprehensive Tor integration for anonymous browsing, circuit management, and onion service access. This document explains the two modes of operation and answers common questions about Tor configuration.

---

## Table of Contents

- [How Tor Integration Works](#how-tor-integration-works)
- [Two Modes of Operation](#two-modes-of-operation)
- [Using System Tor](#using-system-tor)
- [Using Embedded Tor](#using-embedded-tor)
- [Configuration Options](#configuration-options)
- [WebSocket API Commands](#websocket-api-commands)
- [FAQs](#faqs)

---

## How Tor Integration Works

### The Key Question: Why Doesn't Tor Browser Need Installation?

**Tor Browser Bundle** includes:
1. **Embedded Tor Binary** - A portable Tor executable that runs in user space
2. **User-writable Data Directory** - Stores config and state in local folder (no system paths)
3. **Pre-configured torrc** - No system permissions required

**Key insight**: Tor Browser doesn't use the *system* Tor service—it runs its *own* Tor process from the application folder.

### Basset Hound Browser Options

| Mode | Permissions | Entry/Exit Control | Restart Required |
|------|-------------|-------------------|------------------|
| **System Tor** | Needs sudo to modify `/etc/tor/torrc` | Yes, but requires service restart | Yes |
| **Embedded Tor** | No permissions needed | Full control, change on-the-fly | Just process restart (no sudo) |

---

## Two Modes of Operation

### Mode 1: System Tor (Default)

Uses the Tor service installed on your system (e.g., via `apt install tor`).

**Pros:**
- Tor is always running in background
- Managed by systemd (auto-start, logging)
- Other apps can share the same Tor connection
- Lower memory footprint (single Tor process)

**Cons:**
- Requires sudo to install
- Requires sudo to change torrc configuration
- Must restart Tor service to apply changes

**Configuration files:**
- `/etc/tor/torrc` - Main configuration
- `/var/lib/tor/` - Data directory

### Mode 2: Embedded Tor (Portable)

Basset Hound Browser can spawn its own Tor process.

**Pros:**
- No system installation needed
- No sudo/root required
- Full control over configuration
- Change entry/exit nodes without service restart
- Isolated from other applications

**Cons:**
- Uses more memory (separate Tor process)
- Must manage Tor process lifecycle
- Need Tor binary available

**Configuration:**
- `~/.local/share/basset-hound-browser/tor/` - Data directory
- Dynamically generated `torrc` file

---

## Using System Tor

### Installation (Ubuntu 22.04)

```bash
cd basset-hound-browser
sudo ./scripts/install/install-tor.sh
```

This configures Tor with:
- SOCKS proxy on port 9050
- Control port on port 9051
- Password authentication

### Connecting to System Tor

```javascript
// Via WebSocket API
{
  "command": "tor_connect_existing",
  "socksPort": 9050,
  "controlPort": 9051,
  "password": "basset-hound-password"
}
```

### Changing Entry/Exit Nodes (System Tor)

**Requires editing `/etc/tor/torrc` and restarting:**

```bash
# Edit config
sudo nano /etc/tor/torrc

# Add exit node restriction
ExitNodes {us},{de},{nl}
StrictNodes 1

# Restart service
sudo systemctl restart tor
```

**Via WebSocket API (requires Tor restart):**

```javascript
// Set exit country
{ "command": "tor_set_exit_country", "countries": ["us", "de"] }

// Then restart Tor to apply
{ "command": "tor_restart" }
```

---

## Using Embedded Tor

### Starting Embedded Tor

```javascript
// Start Tor with custom configuration
{
  "command": "tor_start",
  "config": {
    "exitCountries": ["us", "de", "nl"],
    "excludeCountries": ["ru", "cn"],
    "useBridges": false
  }
}
```

### Changing Configuration On-the-Fly

With embedded Tor, you can change configuration without system permissions:

```javascript
// Change exit country (applies immediately after circuit rebuild)
{ "command": "tor_set_exit_country", "countries": ["de"] }

// Get new circuit with new exit
{ "command": "tor_rebuild_circuit" }
```

### Where Embedded Tor Stores Data

| Platform | Data Directory |
|----------|----------------|
| Linux | `~/.local/share/basset-hound-browser/tor/` |
| macOS | `~/Library/Application Support/basset-hound-browser/tor/` |
| Windows | `%APPDATA%/basset-hound-browser/tor/` |

---

## Configuration Options

### SOCKS Proxy Configuration

Set the browser to route traffic through Tor:

```javascript
// Route all browser traffic through Tor SOCKS proxy
{
  "command": "set_proxy",
  "host": "127.0.0.1",
  "port": 9050,
  "type": "socks5"
}
```

### Exit Node Selection

Control which countries your traffic exits from:

```javascript
// Allow only specific exit countries
{ "command": "tor_set_exit_country", "countries": ["us", "de", "nl", "ch"] }

// Exclude specific countries
{ "command": "tor_exclude_countries", "countries": ["ru", "cn", "ir"] }

// Enforce restrictions strictly
{ "command": "tor_configure", "config": { "strictNodes": true } }
```

### Entry Node Selection

Control which countries your traffic enters through:

```javascript
// Set preferred entry countries
{ "command": "tor_set_entry_country", "countries": ["ch", "de", "nl"] }
```

### Bridge Configuration (Censorship Circumvention)

For use in countries that block Tor:

```javascript
// Enable built-in bridges
{ "command": "tor_enable_bridges", "useBuiltin": true, "transport": "obfs4" }

// Add custom bridge
{
  "command": "tor_add_bridge",
  "bridge": "obfs4 192.168.1.1:443 FINGERPRINT cert=... iat-mode=0"
}
```

### Stream Isolation

Prevent correlation between different browsing sessions:

```javascript
// Isolate streams per tab
{ "command": "tor_set_isolation", "mode": "per_tab" }

// Isolate streams per domain
{ "command": "tor_set_isolation", "mode": "per_domain" }
```

---

## WebSocket API Commands

### Connection Management

| Command | Description | Parameters |
|---------|-------------|------------|
| `tor_start` | Start embedded Tor | `config` (optional) |
| `tor_stop` | Stop embedded Tor | - |
| `tor_restart` | Restart Tor | - |
| `tor_connect_existing` | Connect to system Tor | `socksPort`, `controlPort`, `password` |
| `tor_status` | Get Tor status | - |
| `tor_check_connection` | Verify Tor is working | - |

### Circuit Management

| Command | Description | Parameters |
|---------|-------------|------------|
| `tor_get_circuits` | List all circuits | - |
| `tor_get_circuit_path` | Get current circuit path | - |
| `tor_rebuild_circuit` | Get new identity (NEWNYM) | - |
| `tor_new_identity` | Get new identity (alias) | - |
| `tor_close_circuit` | Close specific circuit | `circuitId` |

### Node Selection

| Command | Description | Parameters |
|---------|-------------|------------|
| `tor_set_exit_country` | Set exit countries | `countries` (array) |
| `tor_set_entry_country` | Set entry countries | `countries` (array) |
| `tor_exclude_countries` | Exclude countries | `countries` (array) |
| `tor_clear_exit_restrictions` | Clear all restrictions | - |
| `tor_get_exit_info` | Get current exit node details | - |
| `tor_get_country_codes` | List available codes | - |

### Bridge Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `tor_enable_bridges` | Enable bridge mode | `useBuiltin`, `transport` |
| `tor_add_bridge` | Add custom bridge | `bridge` |
| `tor_disable_bridges` | Disable bridges | - |
| `tor_set_transport` | Set pluggable transport | `transport` |
| `tor_get_transports` | List available transports | - |

### Statistics

| Command | Description | Parameters |
|---------|-------------|------------|
| `tor_get_bandwidth` | Get bandwidth stats | - |
| `tor_get_exit_ip` | Get current exit IP | - |

---

## FAQs

### Q: Does changing entry/exit nodes require root permissions?

**System Tor**: Yes, you need sudo to edit `/etc/tor/torrc` and restart the service.

**Embedded Tor**: No, changes are made to a user-space configuration file.

### Q: Can I change Tor configuration without restarting?

**For most settings**: No, Tor reads its configuration at startup. Changes require restart.

**For circuit changes**: Yes! `SIGNAL NEWNYM` gives you a new circuit without restart.

**For exit country changes**: The `ExitNodes` directive requires restart to take effect, but you can signal for a new circuit.

### Q: How does Tor Browser work without installation?

Tor Browser includes:
1. A portable Tor binary in the application folder
2. A `torrc` file in the user's profile
3. A data directory in the user's profile

It spawns Tor as a subprocess and manages it entirely in user space.

### Q: Can Basset Hound Browser do the same?

**Yes!** The `AdvancedTorManager` class supports:
- Finding system Tor binary (`/usr/bin/tor`)
- Spawning Tor as a subprocess
- Generating torrc dynamically
- Managing Tor lifecycle without root

### Q: What's the difference between SOCKS proxy and Control port?

| Port | Purpose |
|------|---------|
| **9050 (SOCKS)** | Routes your web traffic through Tor |
| **9051 (Control)** | Programmatic control (circuits, identity, config) |

You need SOCKS for browsing; you need Control for management.

### Q: How do I verify I'm using Tor?

```javascript
// Check exit IP
{ "command": "tor_check_connection" }

// Or via curl
// curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

### Q: What are pluggable transports?

Protocols that disguise Tor traffic to bypass censorship:

| Transport | Description |
|-----------|-------------|
| **obfs4** | Obfuscated traffic (looks random) |
| **meek** | Traffic through CDN (looks like cloud service) |
| **snowflake** | WebRTC-based (uses browser peers) |

---

## Supported Country Codes

For exit/entry node selection:

| Code | Country | Code | Country |
|------|---------|------|---------|
| US | United States | DE | Germany |
| NL | Netherlands | FR | France |
| GB | United Kingdom | CH | Switzerland |
| SE | Sweden | NO | Norway |
| FI | Finland | AT | Austria |
| CA | Canada | AU | Australia |
| JP | Japan | SG | Singapore |
| HK | Hong Kong | RO | Romania |
| CZ | Czech Republic | PL | Poland |
| IS | Iceland | LU | Luxembourg |
| BE | Belgium | IE | Ireland |
| ES | Spain | IT | Italy |
| PT | Portugal | BR | Brazil |
| MX | Mexico | AR | Argentina |
| CL | Chile | CO | Colombia |

---

## Test Results (December 29, 2024)

All Tor integration tests passed:

```
✅ SOCKS Port (9050)         PASS - Port is open
✅ Control Port (9051)       PASS - Port is open
✅ Authentication            PASS - Tor version: 0.4.8.21
✅ Circuit Retrieval         PASS - 18 built circuits
✅ New Identity (NEWNYM)     PASS - Signal sent successfully
✅ Tor Exit IP               PASS - Exit IP: 45.84.107.47 (Confirmed Tor)
```

---

## Related Documentation

- [TOR-SETUP-GUIDE.md](../deployment/TOR-SETUP-GUIDE.md) - Cross-platform installation
- [PROXY.md](PROXY.md) - General proxy configuration
- [API.md](../core/API.md) - WebSocket API reference

---

*Last Updated: December 29, 2024*
*For Basset Hound Browser v8.1.4*
