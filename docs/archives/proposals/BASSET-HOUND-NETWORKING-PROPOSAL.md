# Basset Hound Networking - Project Proposal

**Version:** 1.0.0
**Date:** January 9, 2026
**Status:** PROPOSAL
**Author:** Basset Hound Team

---

## Executive Summary

Basset Hound Networking is a proposed standalone MCP (Model Context Protocol) server that extracts all network infrastructure capabilities from Basset Hound Browser into a dedicated, reusable service. This separation provides:

- **Modularity**: Network infrastructure as an independent service
- **Reusability**: Any application can leverage proxy/VPN/Tor capabilities via MCP
- **Scalability**: Dedicated resource management and optimization for network operations
- **Maintainability**: Clear separation of concerns between browser automation and network infrastructure
- **Monetization**: Clear FREE vs PAID feature tiers for sustainable development

The project will provide proxy pool management, VPN configuration, SSH tunneling, Tor integration, and multi-hop network chains through a clean MCP interface that can be consumed by Basset Hound Browser, AI agents, and other OSINT tools.

---

## Problem Statement

### Current Architecture Issues

**In Basset Hound Browser (as of v10.6.0):**
- Network infrastructure features are tightly coupled with browser code
- Proxy management (`proxy/proxy-pool.js`, `proxy/tor.js`) is browser-specific
- No reusability: Other OSINT tools cannot leverage the proxy infrastructure
- Resource overhead: Browser process manages both UI and network infrastructure
- Limited scalability: Single-threaded proxy pool management
- Difficult monetization: Network features mixed with core browser features

### Pain Points for Users

1. **OSINT Researchers**: Need proxy rotation across multiple tools (browser, API clients, scrapers)
2. **Security Teams**: Require centralized network policy management across toolchains
3. **Developers**: Want to add proxy/VPN capabilities to custom tools without reinventing the wheel
4. **Enterprise Users**: Need audit trails and centralized control of network infrastructure

### Market Opportunity

Based on 2026 OSINT requirements research:
- VPN usage is **indispensable** for OSINT operational security
- Proxy rotation is **essential** for avoiding detection and rate limits
- SSH tunneling provides **flexibility** for compartmentalized investigations
- Multi-hop VPN configurations enable **advanced anonymity** for sensitive work
- No-logs VPN providers with **multi-country servers** are professional requirements

**Gap in Market**: No standalone network infrastructure server designed specifically for OSINT toolchains with MCP integration.

---

## Project Scope

### In Scope ✅

#### 1. Proxy Infrastructure
- **Proxy pool management**: Add, remove, health check, rotate proxies
- **Rotation strategies**: Round-robin, random, fastest, least-used, weighted, geo-based
- **Proxy types**: HTTP, HTTPS, SOCKS4, SOCKS5
- **Authentication**: Username/password authentication for proxies
- **Geographic targeting**: Country/region/city-based proxy selection
- **Health monitoring**: Automatic health checks with configurable intervals
- **Performance tracking**: Latency, success rates, response times
- **Automatic failover**: Switch on proxy failure
- **Blacklist/whitelist**: Manual proxy management
- **Rate limiting**: Per-proxy rate limits to avoid detection

#### 2. Tor Integration
- **Tor circuit management**: New identity, rebuild circuits
- **Exit node selection**: Country-based exit node control
- **Bridge support**: obfs4, meek, snowflake transports for censored networks
- **Stream isolation**: Per-application, per-domain isolation
- **Onion service support**: Connect to .onion services
- **Circuit health monitoring**: Check circuit status and exit IP
- **Control port management**: Authenticate and control Tor daemon
- **Embedded Tor option**: Optional bundled Tor daemon

#### 3. VPN Management
- **VPN configuration**: Import OpenVPN, WireGuard configurations
- **VPN lifecycle**: Connect, disconnect, status monitoring
- **Kill switch**: Automatic disconnect on VPN failure
- **DNS leak prevention**: Ensure all DNS queries through VPN
- **VPN pool management**: Multiple VPN providers with rotation
- **Connection health**: Monitor VPN connection stability
- **Bandwidth monitoring**: Track VPN usage and performance
- **Multi-provider support**: Integrate with NordVPN, ProtonVPN, Mullvad APIs

#### 4. SSH Tunnel Management
- **SSH tunnel creation**: Local, remote, dynamic forwarding
- **Key-based authentication**: SSH key management
- **Multi-hop tunnels**: Chain SSH tunnels for enhanced anonymity
- **Port forwarding**: Forward specific ports through SSH tunnels
- **Connection persistence**: Auto-reconnect on SSH tunnel failure
- **Credential management**: Secure storage of SSH credentials
- **Tunnel health checks**: Monitor SSH tunnel status

#### 5. Multi-Hop Network Chains
- **Chain builder**: Create proxy → VPN → Tor chains
- **Chain templates**: Pre-configured chains for different risk levels
- **Chain validation**: Test chain connectivity before use
- **Chain rotation**: Rotate entire chains periodically
- **Performance optimization**: Choose fastest chain combinations
- **Failure handling**: Fallback chains on component failure

#### 6. Network Policy Management
- **Domain-specific routing**: Route specific domains through specific proxies/VPNs
- **Geofencing rules**: Restrict connections to/from specific countries
- **Rate limiting policies**: Per-domain, per-proxy rate limits
- **Allowlist/blocklist**: Domain and IP filtering
- **Audit logging**: Complete network activity logs
- **Compliance modes**: GDPR, SOC2-compliant logging

#### 7. MCP Server Interface
- **MCP protocol compliance**: Full MCP 2025-11-25 spec implementation
- **Tool-based API**: MCP tools for all network operations
- **Resource exposure**: Network status, proxy lists, VPN configs as MCP resources
- **Authentication**: Token-based MCP authentication
- **Transport options**: stdio, HTTP+SSE transports
- **Error handling**: Structured error responses

#### 8. Integration Points
- **Basset Hound Browser**: Primary consumer of networking services
- **AI Agents**: Claude Desktop, palletai via MCP
- **REST API**: HTTP API for non-MCP clients
- **CLI tools**: Command-line interface for testing and management
- **Configuration files**: Import/export network configurations

### Out of Scope ❌

- ❌ **Browser automation**: Handled by Basset Hound Browser
- ❌ **Data extraction**: Not a networking concern
- ❌ **OSINT analysis**: Intelligence work, not infrastructure
- ❌ **Investigation management**: Workflow concerns
- ❌ **Evidence collection**: Forensic concerns
- ❌ **Web scraping**: Application layer functionality

---

## Features Breakdown

### FREE Features (Open Source Core)

**Tier: Community Edition**

| Feature | Description | Use Case |
|---------|-------------|----------|
| Basic proxy management | Add/remove/rotate up to 10 proxies | Hobbyist OSINT |
| HTTP/HTTPS proxies | Standard proxy support | Basic anonymization |
| Tor integration | Connect to Tor, new identity | Anonymous browsing |
| Round-robin rotation | Simple rotation strategy | Basic rotation |
| Manual proxy testing | Test individual proxies | Proxy validation |
| SSH tunneling | Basic SSH tunnel support | Simple tunneling |
| Configuration export/import | Save/load proxy lists | Backup configs |
| CLI interface | Command-line management | Scripting |
| Basic health checks | Ping proxies for availability | Uptime monitoring |
| Single-hop chains | Proxy OR VPN OR Tor | Basic anonymization |

**Limitations:**
- Maximum 10 proxies in pool
- Manual proxy management only
- Basic rotation strategies (round-robin, random)
- No automatic health monitoring
- No VPN provider integrations
- Community support only

### PAID Features (Professional & Enterprise)

**Tier 1: Professional Edition ($29/month)**

| Feature | Description | Use Case |
|---------|-------------|----------|
| Unlimited proxy pool | No proxy limit | Large-scale operations |
| Advanced rotation | Fastest, geo-based, weighted | Optimized performance |
| Automatic health monitoring | Scheduled health checks with alerts | Production reliability |
| SOCKS4/5 support | Full proxy type support | Advanced anonymization |
| VPN pool management | Multiple VPN configurations | VPN rotation |
| OpenVPN support | OpenVPN config import | Standard VPNs |
| Geographic targeting | Country/region/city filtering | Location-specific OSINT |
| Performance tracking | Detailed latency/success metrics | Optimization insights |
| REST API access | HTTP API for integrations | Custom tooling |
| Email support | Priority email support | Professional assistance |
| Multi-hop chains (2-hop) | Proxy → VPN or VPN → Tor | Enhanced anonymity |
| Automatic failover | Auto-switch on proxy failure | High availability |

**Tier 2: Enterprise Edition ($199/month)**

| Feature | Description | Use Case |
|---------|-------------|----------|
| **All Professional features** | | |
| WireGuard support | Modern VPN protocol | High-performance VPNs |
| Multi-hop chains (3+ hops) | Complex proxy → VPN → Tor chains | Maximum anonymity |
| VPN provider APIs | NordVPN, ProtonVPN, Mullvad integration | Managed VPN pools |
| SSH multi-hop tunnels | Chain SSH tunnels | Advanced tunneling |
| Domain-specific routing | Route specific domains via specific proxies | Granular control |
| Geofencing rules | Country-based routing policies | Compliance |
| Advanced rate limiting | Per-domain, adaptive rate limiting | Anti-detection |
| Audit logging | Complete network activity logs | Compliance/forensics |
| Team management | Multi-user access with roles | Team collaboration |
| SSO integration | SAML, OAuth SSO | Enterprise auth |
| 24/7 phone support | Round-the-clock support | Mission-critical ops |
| On-premise deployment | Self-hosted option | Data sovereignty |
| SLA guarantee | 99.9% uptime SLA | Production reliability |

**Tier 3: Enterprise Plus (Custom Pricing)**

| Feature | Description | Use Case |
|---------|-------------|----------|
| **All Enterprise features** | | |
| Custom integrations | Bespoke integrations with internal tools | Enterprise workflows |
| Dedicated infrastructure | Isolated network infrastructure | Security/performance |
| Custom SLA | Negotiated SLA terms | Critical operations |
| Professional services | Implementation consulting | Deployment assistance |
| Custom development | Feature development for specific needs | Unique requirements |
| Managed service | Fully managed by Basset Hound team | Hands-off operation |

---

## Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Basset     │  │  AI Agents   │  │   Custom     │          │
│  │   Hound      │  │  (Claude,    │  │   OSINT      │          │
│  │   Browser    │  │   palletai)  │  │   Tools      │          │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘          │
│         │                 │                   │                  │
└─────────┼─────────────────┼───────────────────┼──────────────────┘
          │                 │                   │
          │                 │                   │
    MCP Protocol      MCP Protocol        REST API
          │                 │                   │
          └─────────────────┴───────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────────┐
│              BASSET HOUND NETWORKING (MCP SERVER)                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    MCP SERVER LAYER                         │ │
│  │  - Tool registration (90+ MCP tools)                        │ │
│  │  - Resource exposure (proxy lists, VPN configs, stats)     │ │
│  │  - Authentication (token-based)                             │ │
│  │  - Transport handling (stdio, HTTP+SSE)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   CORE SERVICES LAYER                       │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │  Proxy Pool  │  │     Tor      │  │     VPN      │     │ │
│  │  │   Manager    │  │   Manager    │  │   Manager    │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │     SSH      │  │  Multi-Hop   │  │   Network    │     │ │
│  │  │   Tunnels    │  │    Chains    │  │    Policy    │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │                                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 INFRASTRUCTURE LAYER                        │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │   Health     │  │    Metrics   │  │    Audit     │     │ │
│  │  │  Monitoring  │  │  Collection  │  │   Logging    │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │   Config     │  │  Connection  │  │   License    │     │ │
│  │  │  Management  │  │     Pool     │  │  Validation  │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │                                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────────┐
│                    NETWORK LAYER                                 │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Proxy   │  │   Tor    │  │   VPN    │  │   SSH    │        │
│  │  Servers │  │  Daemon  │  │  Tunnels │  │  Tunnels │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Architecture

#### 1. Proxy Pool Manager

**Responsibilities:**
- Manage collection of proxies with metadata (host, port, type, country, tags)
- Implement rotation strategies (round-robin, random, fastest, geo-based, weighted)
- Health monitoring with configurable intervals
- Performance tracking (latency, success rate, response time)
- Automatic failover on proxy failure
- Blacklist/whitelist management
- Rate limiting per proxy

**Key Classes:**
```python
class ProxyPool:
    - add_proxy(config: ProxyConfig) -> Proxy
    - remove_proxy(proxy_id: str) -> bool
    - get_next_proxy(filters: ProxyFilters) -> Proxy
    - set_rotation_strategy(strategy: RotationStrategy)
    - test_proxy_health(proxy_id: str) -> HealthResult
    - blacklist_proxy(proxy_id: str, duration: int)
    - get_proxy_stats(proxy_id: str) -> ProxyStats
    - start_health_monitoring()
    - stop_health_monitoring()

class Proxy:
    - id: str
    - host: str
    - port: int
    - type: ProxyType (HTTP, HTTPS, SOCKS4, SOCKS5)
    - username: str | None
    - password: str | None
    - country: str | None
    - region: str | None
    - city: str | None
    - tags: List[str]
    - status: ProxyStatus (HEALTHY, DEGRADED, UNHEALTHY, BLACKLISTED)
    - metrics: ProxyMetrics
    - record_success(response_time: float)
    - record_failure(error: Exception)
    - is_available() -> bool
```

**Data Flow:**
1. Client requests proxy via MCP tool `network_get_next_proxy`
2. ProxyPool selects proxy based on rotation strategy and filters
3. Proxy marked as "in use", rate limit checked
4. Client receives proxy configuration
5. Client reports success/failure back to pool
6. Pool updates proxy metrics and adjusts health status

#### 2. Tor Manager

**Responsibilities:**
- Connect to Tor daemon via control port
- Authenticate with control port
- Request new identity (new circuit)
- Select exit nodes by country
- Configure bridges (obfs4, meek, snowflake)
- Stream isolation (per-domain, per-app)
- Monitor circuit status
- Check exit IP

**Key Classes:**
```python
class TorManager:
    - connect(control_port: int, password: str) -> bool
    - disconnect()
    - new_identity() -> Circuit
    - set_exit_node(country: str) -> bool
    - configure_bridge(bridge_config: BridgeConfig)
    - get_circuit_info() -> CircuitInfo
    - check_exit_ip() -> str
    - enable_stream_isolation(mode: IsolationMode)
    - get_tor_status() -> TorStatus

class Circuit:
    - id: str
    - status: CircuitStatus
    - path: List[Node]
    - exit_node: Node
    - built_at: datetime
    - is_ready() -> bool
```

**Data Flow:**
1. Client requests Tor connection via `network_connect_tor`
2. TorManager authenticates with Tor control port
3. Client requests new identity via `network_tor_new_identity`
4. TorManager signals Tor daemon to build new circuit
5. Circuit info returned to client
6. Client uses Tor SOCKS5 proxy (127.0.0.1:9050)

#### 3. VPN Manager

**Responsibilities:**
- Import OpenVPN/WireGuard configurations
- Connect/disconnect VPN tunnels
- Monitor VPN connection health
- Kill switch on VPN failure
- DNS leak prevention
- VPN pool management (multiple providers)
- Bandwidth monitoring
- Integration with VPN provider APIs

**Key Classes:**
```python
class VPNManager:
    - import_config(config_file: str, type: VPNType) -> VPNConfig
    - connect_vpn(config_id: str) -> VPNConnection
    - disconnect_vpn(connection_id: str) -> bool
    - get_vpn_status(connection_id: str) -> VPNStatus
    - enable_kill_switch()
    - check_dns_leak() -> bool
    - add_to_pool(config: VPNConfig)
    - rotate_vpn() -> VPNConnection
    - integrate_provider(provider: VPNProvider, api_key: str)

class VPNConnection:
    - id: str
    - config: VPNConfig
    - status: ConnectionStatus (CONNECTING, CONNECTED, DISCONNECTED, ERROR)
    - connected_at: datetime
    - exit_ip: str
    - dns_servers: List[str]
    - bandwidth: BandwidthStats
    - is_connected() -> bool
```

**Data Flow:**
1. Client imports VPN config via `network_import_vpn_config`
2. VPNManager validates and stores config
3. Client connects via `network_connect_vpn`
4. VPNManager spawns VPN client process (OpenVPN/WireGuard)
5. Health monitoring ensures connection stability
6. Client receives VPN status and exit IP

#### 4. SSH Tunnel Manager

**Responsibilities:**
- Create SSH tunnels (local, remote, dynamic forwarding)
- Key-based authentication
- Multi-hop SSH chains
- Port forwarding
- Connection persistence with auto-reconnect
- Credential management

**Key Classes:**
```python
class SSHTunnelManager:
    - create_tunnel(config: SSHTunnelConfig) -> SSHTunnel
    - create_multi_hop(hops: List[SSHHop]) -> MultiHopTunnel
    - close_tunnel(tunnel_id: str) -> bool
    - get_tunnel_status(tunnel_id: str) -> TunnelStatus
    - forward_port(tunnel_id: str, local_port: int, remote_port: int)
    - add_ssh_key(key_path: str, passphrase: str | None)

class SSHTunnel:
    - id: str
    - host: str
    - port: int
    - user: str
    - auth_method: AuthMethod (PASSWORD, KEY)
    - local_port: int
    - remote_port: int
    - status: TunnelStatus
    - created_at: datetime
    - is_active() -> bool
```

**Data Flow:**
1. Client creates tunnel via `network_create_ssh_tunnel`
2. SSHTunnelManager establishes SSH connection
3. Port forwarding configured
4. Tunnel info returned with local port
5. Client uses localhost:local_port for requests
6. SSHTunnelManager monitors connection health

#### 5. Multi-Hop Chain Manager

**Responsibilities:**
- Build complex proxy → VPN → Tor chains
- Chain templates for different risk levels
- Validate chain connectivity
- Rotate entire chains
- Performance optimization
- Failure handling with fallback chains

**Key Classes:**
```python
class ChainManager:
    - create_chain(components: List[ChainComponent]) -> Chain
    - create_from_template(template: ChainTemplate) -> Chain
    - validate_chain(chain_id: str) -> ValidationResult
    - activate_chain(chain_id: str) -> bool
    - rotate_chain(chain_id: str) -> Chain
    - get_chain_status(chain_id: str) -> ChainStatus
    - set_fallback_chain(chain_id: str, fallback_id: str)

class Chain:
    - id: str
    - components: List[ChainComponent]
    - status: ChainStatus
    - active: bool
    - performance: ChainPerformance
    - test_connectivity() -> bool
```

**Chain Templates:**
- **Stealth Mode**: Proxy → VPN → Tor (maximum anonymity)
- **Balanced**: VPN → Proxy (good anonymity, better performance)
- **Fast**: Proxy only (minimal latency)
- **Multi-Hop VPN**: VPN1 → VPN2 → Proxy
- **Tor Bridge**: Bridge → Tor (censorship circumvention)

**Data Flow:**
1. Client creates chain via `network_create_chain`
2. ChainManager orchestrates component activation
3. Chain validated end-to-end
4. Client receives chain configuration
5. Client uses chain for network requests
6. Chain performance monitored continuously

#### 6. Network Policy Manager

**Responsibilities:**
- Domain-specific routing rules
- Geofencing (country-based restrictions)
- Rate limiting policies
- Allowlist/blocklist
- Audit logging
- Compliance modes (GDPR, SOC2)

**Key Classes:**
```python
class PolicyManager:
    - create_policy(policy: NetworkPolicy) -> str
    - apply_policy(policy_id: str) -> bool
    - remove_policy(policy_id: str) -> bool
    - route_domain(domain: str, proxy_id: str)
    - add_geofence(rule: GeofenceRule)
    - set_rate_limit(domain: str, requests_per_min: int)
    - add_to_allowlist(domain: str)
    - add_to_blocklist(domain: str)
    - get_audit_log(filters: AuditFilters) -> List[AuditEvent]

class NetworkPolicy:
    - id: str
    - name: str
    - rules: List[PolicyRule]
    - active: bool
    - created_at: datetime
```

**Data Flow:**
1. Admin creates policy via `network_create_policy`
2. Policy rules evaluated on each network request
3. Requests routed through appropriate proxy/VPN based on policy
4. Audit events logged for compliance
5. Policy violations trigger alerts

---

## MCP API Design

### MCP Tools (90+ tools organized by category)

#### Proxy Pool Management (20 tools)

```
network_add_proxy
  - description: Add proxy to pool
  - parameters: {host, port, type, username?, password?, country?, region?, city?, tags?}
  - returns: {proxy_id, status}

network_remove_proxy
  - description: Remove proxy from pool
  - parameters: {proxy_id}
  - returns: {success}

network_get_next_proxy
  - description: Get next proxy based on rotation strategy
  - parameters: {filters?: {country?, region?, city?, type?, tags?, min_success_rate?, max_response_time?}}
  - returns: {proxy_id, host, port, type, country, metrics}

network_set_rotation_strategy
  - description: Set proxy rotation strategy
  - parameters: {strategy: "round-robin" | "random" | "fastest" | "least-used" | "weighted" | "geo-based"}
  - returns: {success}

network_test_proxy_health
  - description: Test individual proxy health
  - parameters: {proxy_id}
  - returns: {healthy, response_time, error?}

network_test_all_proxies
  - description: Test all proxies in pool
  - parameters: {}
  - returns: {tested, healthy, unhealthy, results[]}

network_blacklist_proxy
  - description: Blacklist proxy temporarily
  - parameters: {proxy_id, duration_seconds?, reason?}
  - returns: {success}

network_whitelist_proxy
  - description: Remove proxy from blacklist
  - parameters: {proxy_id}
  - returns: {success}

network_get_proxy_stats
  - description: Get proxy statistics
  - parameters: {proxy_id}
  - returns: {success_count, failure_count, avg_response_time, success_rate, last_used, status}

network_get_pool_stats
  - description: Get overall pool statistics
  - parameters: {}
  - returns: {total_proxies, healthy, degraded, unhealthy, blacklisted, rotation_strategy}

network_list_proxies
  - description: List all proxies
  - parameters: {filters?: {country?, status?, type?}}
  - returns: {proxies[]}

network_get_proxies_by_country
  - description: Get proxies for specific country
  - parameters: {country}
  - returns: {proxies[]}

network_start_health_monitoring
  - description: Start automatic health checks
  - parameters: {interval_seconds?}
  - returns: {success}

network_stop_health_monitoring
  - description: Stop automatic health checks
  - parameters: {}
  - returns: {success}

network_configure_proxy_pool
  - description: Configure pool settings
  - parameters: {health_check_interval?, health_check_url?, auto_blacklist?, failure_threshold?}
  - returns: {success}

network_import_proxy_list
  - description: Import multiple proxies
  - parameters: {proxies[], format?: "json" | "csv" | "txt"}
  - returns: {imported, failed, errors[]}

network_export_proxy_list
  - description: Export proxy list
  - parameters: {format?: "json" | "csv" | "txt"}
  - returns: {data}

network_clear_proxy_pool
  - description: Remove all proxies
  - parameters: {}
  - returns: {success, removed_count}

network_record_proxy_success
  - description: Record successful proxy usage
  - parameters: {proxy_id, response_time_ms}
  - returns: {success}

network_record_proxy_failure
  - description: Record proxy failure
  - parameters: {proxy_id, error}
  - returns: {success}
```

#### Tor Management (12 tools)

```
network_connect_tor
  - description: Connect to Tor control port
  - parameters: {control_host?, control_port?, password?}
  - returns: {success, tor_version}

network_disconnect_tor
  - description: Disconnect from Tor
  - parameters: {}
  - returns: {success}

network_tor_new_identity
  - description: Request new Tor circuit
  - parameters: {}
  - returns: {success, circuit_id, exit_node}

network_tor_set_exit_node
  - description: Set exit node by country
  - parameters: {country_code}
  - returns: {success, exit_node}

network_tor_configure_bridge
  - description: Configure Tor bridge
  - parameters: {bridge_type: "obfs4" | "meek" | "snowflake", bridge_address?}
  - returns: {success}

network_tor_get_circuit_info
  - description: Get current circuit information
  - parameters: {}
  - returns: {circuit_id, path[], exit_node, status}

network_tor_check_exit_ip
  - description: Check current Tor exit IP
  - parameters: {}
  - returns: {ip, country}

network_tor_enable_stream_isolation
  - description: Enable stream isolation
  - parameters: {mode: "per-domain" | "per-app"}
  - returns: {success}

network_tor_get_status
  - description: Get Tor daemon status
  - parameters: {}
  - returns: {connected, version, circuits_active, exit_node}

network_tor_rebuild_circuit
  - description: Force circuit rebuild
  - parameters: {}
  - returns: {success, new_circuit_id}

network_tor_get_bridges
  - description: Get configured bridges
  - parameters: {}
  - returns: {bridges[]}

network_tor_test_connection
  - description: Test Tor connectivity
  - parameters: {}
  - returns: {reachable, response_time}
```

#### VPN Management (15 tools)

```
network_import_vpn_config
  - description: Import VPN configuration
  - parameters: {config_file, type: "openvpn" | "wireguard", name?}
  - returns: {config_id, name}

network_connect_vpn
  - description: Connect to VPN
  - parameters: {config_id}
  - returns: {connection_id, status, exit_ip}

network_disconnect_vpn
  - description: Disconnect VPN
  - parameters: {connection_id}
  - returns: {success}

network_get_vpn_status
  - description: Get VPN connection status
  - parameters: {connection_id}
  - returns: {status, exit_ip, connected_at, bandwidth}

network_enable_vpn_kill_switch
  - description: Enable kill switch
  - parameters: {}
  - returns: {success}

network_disable_vpn_kill_switch
  - description: Disable kill switch
  - parameters: {}
  - returns: {success}

network_check_dns_leak
  - description: Check for DNS leaks
  - parameters: {}
  - returns: {dns_leak_detected, dns_servers[]}

network_add_vpn_to_pool
  - description: Add VPN to pool for rotation
  - parameters: {config_id}
  - returns: {success}

network_rotate_vpn
  - description: Switch to next VPN in pool
  - parameters: {}
  - returns: {connection_id, exit_ip}

network_integrate_vpn_provider
  - description: Integrate VPN provider API
  - parameters: {provider: "nordvpn" | "protonvpn" | "mullvad", api_key}
  - returns: {success, available_servers}

network_list_vpn_configs
  - description: List all VPN configurations
  - parameters: {}
  - returns: {configs[]}

network_delete_vpn_config
  - description: Delete VPN configuration
  - parameters: {config_id}
  - returns: {success}

network_get_vpn_bandwidth
  - description: Get VPN bandwidth stats
  - parameters: {connection_id}
  - returns: {bytes_sent, bytes_received, duration}

network_test_vpn_speed
  - description: Test VPN connection speed
  - parameters: {config_id}
  - returns: {download_mbps, upload_mbps, latency}

network_export_vpn_config
  - description: Export VPN configuration
  - parameters: {config_id}
  - returns: {config_data}
```

#### SSH Tunnel Management (12 tools)

```
network_create_ssh_tunnel
  - description: Create SSH tunnel
  - parameters: {host, port, user, auth_method: "password" | "key", credentials, local_port?, remote_host?, remote_port?}
  - returns: {tunnel_id, local_port}

network_close_ssh_tunnel
  - description: Close SSH tunnel
  - parameters: {tunnel_id}
  - returns: {success}

network_create_multi_hop_ssh
  - description: Create multi-hop SSH tunnel
  - parameters: {hops[]}
  - returns: {tunnel_id, final_local_port}

network_get_ssh_tunnel_status
  - description: Get tunnel status
  - parameters: {tunnel_id}
  - returns: {status, local_port, remote_port, connected_at}

network_forward_ssh_port
  - description: Forward port through SSH tunnel
  - parameters: {tunnel_id, local_port, remote_port}
  - returns: {success}

network_add_ssh_key
  - description: Add SSH private key
  - parameters: {key_name, key_data, passphrase?}
  - returns: {key_id}

network_remove_ssh_key
  - description: Remove SSH key
  - parameters: {key_id}
  - returns: {success}

network_list_ssh_keys
  - description: List stored SSH keys
  - parameters: {}
  - returns: {keys[]}

network_list_ssh_tunnels
  - description: List active tunnels
  - parameters: {}
  - returns: {tunnels[]}

network_test_ssh_connection
  - description: Test SSH connectivity
  - parameters: {host, port, user, auth_method, credentials}
  - returns: {reachable, latency}

network_enable_ssh_keep_alive
  - description: Enable SSH keep-alive
  - parameters: {tunnel_id, interval_seconds}
  - returns: {success}

network_reconnect_ssh_tunnel
  - description: Reconnect SSH tunnel
  - parameters: {tunnel_id}
  - returns: {success}
```

#### Multi-Hop Chain Management (10 tools)

```
network_create_chain
  - description: Create multi-hop network chain
  - parameters: {components[]: [{type: "proxy" | "vpn" | "tor", id}]}
  - returns: {chain_id, status}

network_create_chain_from_template
  - description: Create chain from template
  - parameters: {template: "stealth" | "balanced" | "fast" | "multi-hop-vpn" | "tor-bridge"}
  - returns: {chain_id, components[]}

network_activate_chain
  - description: Activate network chain
  - parameters: {chain_id}
  - returns: {success, exit_ip}

network_deactivate_chain
  - description: Deactivate network chain
  - parameters: {chain_id}
  - returns: {success}

network_validate_chain
  - description: Test chain connectivity
  - parameters: {chain_id}
  - returns: {valid, errors[], latency}

network_rotate_chain
  - description: Rotate to new chain components
  - parameters: {chain_id}
  - returns: {success, new_components[]}

network_get_chain_status
  - description: Get chain status
  - parameters: {chain_id}
  - returns: {status, active, components[], performance}

network_set_fallback_chain
  - description: Set fallback chain
  - parameters: {chain_id, fallback_chain_id}
  - returns: {success}

network_list_chains
  - description: List all chains
  - parameters: {}
  - returns: {chains[]}

network_delete_chain
  - description: Delete chain
  - parameters: {chain_id}
  - returns: {success}
```

#### Network Policy Management (12 tools)

```
network_create_policy
  - description: Create network policy
  - parameters: {name, rules[]}
  - returns: {policy_id}

network_apply_policy
  - description: Apply network policy
  - parameters: {policy_id}
  - returns: {success}

network_remove_policy
  - description: Remove policy
  - parameters: {policy_id}
  - returns: {success}

network_route_domain
  - description: Route domain through specific proxy
  - parameters: {domain, proxy_id}
  - returns: {success}

network_add_geofence
  - description: Add geofencing rule
  - parameters: {rule_type: "allow" | "block", countries[]}
  - returns: {rule_id}

network_set_rate_limit
  - description: Set rate limit for domain
  - parameters: {domain, requests_per_minute}
  - returns: {success}

network_add_to_allowlist
  - description: Add domain to allowlist
  - parameters: {domain}
  - returns: {success}

network_add_to_blocklist
  - description: Add domain to blocklist
  - parameters: {domain}
  - returns: {success}

network_get_audit_log
  - description: Get audit log
  - parameters: {filters?: {start_date?, end_date?, event_type?, user?}}
  - returns: {events[]}

network_export_audit_log
  - description: Export audit log
  - parameters: {format: "json" | "csv", filters?}
  - returns: {data}

network_list_policies
  - description: List all policies
  - parameters: {}
  - returns: {policies[]}

network_get_policy_violations
  - description: Get policy violation events
  - parameters: {policy_id, limit?}
  - returns: {violations[]}
```

#### System & Configuration (9 tools)

```
network_get_system_status
  - description: Get overall system status
  - parameters: {}
  - returns: {version, uptime, proxies_active, vpns_active, tor_connected, chains_active}

network_get_license_info
  - description: Get license information
  - parameters: {}
  - returns: {tier: "free" | "professional" | "enterprise", features[], expires_at?}

network_configure_health_checks
  - description: Configure health check settings
  - parameters: {interval_seconds?, timeout_seconds?, test_url?}
  - returns: {success}

network_import_config
  - description: Import system configuration
  - parameters: {config_data, format: "json" | "yaml"}
  - returns: {success}

network_export_config
  - description: Export system configuration
  - parameters: {format: "json" | "yaml"}
  - returns: {config_data}

network_get_metrics
  - description: Get system metrics
  - parameters: {}
  - returns: {total_requests, successful_requests, failed_requests, avg_latency}

network_reset_metrics
  - description: Reset system metrics
  - parameters: {}
  - returns: {success}

network_enable_debug_mode
  - description: Enable debug logging
  - parameters: {}
  - returns: {success}

network_disable_debug_mode
  - description: Disable debug logging
  - parameters: {}
  - returns: {success}
```

### MCP Resources (Exposed Data)

Resources provide read-only access to system state:

```
network://proxies
  - List of all proxies with current status
  - Updated every 10 seconds

network://proxies/healthy
  - List of healthy proxies only
  - Filtered view of network://proxies

network://vpn-configs
  - List of imported VPN configurations
  - Static list, updated on import/delete

network://chains
  - List of configured network chains
  - Updated on chain create/delete

network://policies
  - List of active network policies
  - Updated on policy create/delete

network://metrics
  - Real-time system metrics
  - Updated every 5 seconds

network://audit-log
  - Recent audit events (last 1000)
  - Rolling window of events
```

---

## Integration with Basset Hound Browser

### Communication Flow

```
┌─────────────────────────────────────────────────────┐
│         Basset Hound Browser (Electron)              │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │         Browser Session Manager                 │ │
│  │  - Manages browser profiles                     │ │
│  │  - Coordinates network requests                 │ │
│  └───────────────────┬────────────────────────────┘ │
│                      │                               │
│                      │ getProxy()                    │
│                      │                               │
│  ┌───────────────────▼────────────────────────────┐ │
│  │     MCP Client for Networking                   │ │
│  │  - Connects to Basset Hound Networking          │ │
│  │  - Requests proxies/VPNs as needed              │ │
│  │  - Reports success/failure back                 │ │
│  └───────────────────┬────────────────────────────┘ │
│                      │                               │
└──────────────────────┼───────────────────────────────┘
                       │
                       │ MCP Protocol (stdio/HTTP)
                       │
┌──────────────────────▼───────────────────────────────┐
│      Basset Hound Networking (MCP Server)            │
│                                                      │
│  - Receives proxy request from browser              │
│  - Selects proxy based on rotation strategy         │
│  - Returns proxy configuration                      │
│  - Receives success/failure reports                 │
│  - Updates proxy health metrics                     │
└──────────────────────────────────────────────────────┘
```

### Integration Scenarios

#### Scenario 1: Simple Proxy Rotation

**Browser Side:**
```javascript
// In Basset Hound Browser
const NetworkingClient = require('./mcp-clients/networking-client');
const networkClient = new NetworkingClient();

async function navigateWithProxy(url) {
  // Request next proxy from networking server
  const proxy = await networkClient.call('network_get_next_proxy', {
    filters: { country: 'US', min_success_rate: 0.8 }
  });

  // Configure browser session with proxy
  await session.setProxy({
    proxyRules: `${proxy.type}://${proxy.host}:${proxy.port}`
  });

  // Navigate to URL
  try {
    await webContents.loadURL(url);

    // Report success back to networking server
    await networkClient.call('network_record_proxy_success', {
      proxy_id: proxy.id,
      response_time_ms: 234
    });
  } catch (error) {
    // Report failure
    await networkClient.call('network_record_proxy_failure', {
      proxy_id: proxy.id,
      error: error.message
    });
  }
}
```

#### Scenario 2: Tor Integration

**Browser Side:**
```javascript
// In Basset Hound Browser
async function enableTor() {
  // Connect to Tor via networking server
  await networkClient.call('network_connect_tor', {});

  // Get Tor proxy configuration
  const torStatus = await networkClient.call('network_tor_get_status', {});

  // Configure browser to use Tor
  await session.setProxy({
    proxyRules: 'socks5://127.0.0.1:9050'
  });

  console.log(`Tor enabled. Exit IP: ${torStatus.exit_ip}`);
}

async function newTorIdentity() {
  // Request new Tor circuit
  const circuit = await networkClient.call('network_tor_new_identity', {});

  console.log(`New circuit: ${circuit.exit_node}`);

  // Browser continues using same proxy, but with new circuit
}
```

#### Scenario 3: Multi-Hop Chain

**Browser Side:**
```javascript
// In Basset Hound Browser
async function enableStealthMode() {
  // Create stealth chain from template: Proxy → VPN → Tor
  const chain = await networkClient.call('network_create_chain_from_template', {
    template: 'stealth'
  });

  // Activate the chain
  await networkClient.call('network_activate_chain', {
    chain_id: chain.id
  });

  // Validate chain connectivity
  const validation = await networkClient.call('network_validate_chain', {
    chain_id: chain.id
  });

  if (validation.valid) {
    // Configure browser to use the chain's final endpoint
    // (Tor SOCKS proxy in this case)
    await session.setProxy({
      proxyRules: 'socks5://127.0.0.1:9050'
    });

    console.log(`Stealth mode enabled. Latency: ${validation.latency}ms`);
  }
}
```

### Configuration in Basset Hound Browser

**New configuration section in browser:**

```javascript
// config/networking.js
module.exports = {
  networking: {
    // MCP connection to Basset Hound Networking
    mcp: {
      enabled: true,
      transport: 'stdio',  // or 'http'
      command: 'basset-hound-networking',
      args: ['--config', '/path/to/networking-config.json']
    },

    // Fallback to local proxy management if networking server unavailable
    fallback: {
      enabled: true,
      proxies: []  // Minimal proxy list for emergency use
    },

    // Automatic proxy rotation
    autoRotate: {
      enabled: true,
      strategy: 'geo-based',
      interval: 300000  // 5 minutes
    }
  }
};
```

### Migration Path

#### Phase 1: Parallel Operation (Weeks 1-2)
- Keep existing proxy code in browser
- Add MCP client for networking
- Browser uses both systems (new for testing, old for production)
- Validate networking server with test traffic

#### Phase 2: Feature Parity (Weeks 3-4)
- Ensure networking server has all features from browser
- Add integration tests
- Fix any bugs discovered during testing

#### Phase 3: Gradual Migration (Weeks 5-6)
- Switch browser to use networking server by default
- Keep fallback to local proxy code
- Monitor for issues in production

#### Phase 4: Cleanup (Weeks 7-8)
- Remove old proxy code from browser
- Update documentation
- Announce networking server as standalone product

### Benefits for Browser Integration

1. **Reduced Browser Complexity**: Remove 5,000+ lines of proxy/network code
2. **Better Performance**: Dedicated process for network management
3. **Shared Infrastructure**: Multiple browser instances share same proxy pool
4. **Centralized Management**: Single source of truth for network configuration
5. **Easier Updates**: Update network infrastructure without browser restart

---

## Technology Stack

### Backend (MCP Server)

**Primary Language: Python 3.11+**
- **Rationale**: Excellent MCP library support (fastmcp), async capabilities, strong networking libraries

**Core Framework:**
- **fastmcp**: MCP server framework (official Anthropic library)
  - Provides decorator-based tool registration
  - Handles stdio/HTTP transports
  - Built-in authentication support

**Networking Libraries:**
- **aiohttp**: Async HTTP client/server
- **asyncssh**: Async SSH library for tunneling
- **asyncpg**: PostgreSQL async driver for audit logging
- **pydantic**: Data validation and settings management
- **requests**: Synchronous HTTP for health checks

**VPN Integration:**
- **python-openvpn**: OpenVPN control
- **wireguard**: WireGuard integration

**Tor Integration:**
- **stem**: Tor control port library

**Proxy Management:**
- Custom proxy pool implementation
- **redis** (optional): For distributed proxy pool state

**Testing:**
- **pytest**: Test framework
- **pytest-asyncio**: Async test support
- **pytest-mock**: Mocking support
- **pytest-cov**: Coverage reporting

### Database

**SQLite for Free Tier:**
- Lightweight, no server required
- Stores proxy configurations, health metrics, audit logs
- Good for single-user deployments

**PostgreSQL for Paid Tiers:**
- Robust, scalable
- Better concurrency for multi-user
- Advanced audit logging with partitioning
- Replication support for Enterprise

**Redis for Caching:**
- Proxy health status cache
- Rate limiting state
- Distributed lock for multi-instance deployments

### Configuration

**YAML/JSON Configuration Files:**
```yaml
# networking-config.yaml
server:
  host: 127.0.0.1
  port: 3000
  transport: stdio  # or http

database:
  type: sqlite  # or postgresql
  path: ~/.basset-hound-networking/networking.db

licensing:
  tier: free  # professional, enterprise
  license_key: null

proxy_pool:
  health_check_interval: 300  # seconds
  health_check_url: https://www.google.com
  auto_blacklist: true
  failure_threshold: 5

tor:
  control_port: 9051
  socks_port: 9050
  control_password: null

vpn:
  openvpn_binary: /usr/sbin/openvpn
  wireguard_binary: /usr/bin/wg

audit:
  enabled: true
  retention_days: 90

rate_limiting:
  default_requests_per_minute: 60
  per_domain_limits: {}
```

### Deployment Options

#### Development
```bash
# Install from source
git clone https://github.com/basset-hound/networking.git
cd networking
pip install -e .
basset-hound-networking --config config.yaml
```

#### Production (Free/Professional)
```bash
# Install via pip
pip install basset-hound-networking

# Run as systemd service
sudo systemctl start basset-hound-networking
```

#### Enterprise (Docker)
```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    openvpn \
    wireguard \
    tor \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app
WORKDIR /app

EXPOSE 3000

CMD ["basset-hound-networking", "--config", "/config/networking.yaml"]
```

#### Enterprise (Kubernetes)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound-networking
spec:
  replicas: 3
  selector:
    matchLabels:
      app: basset-hound-networking
  template:
    metadata:
      labels:
        app: basset-hound-networking
    spec:
      containers:
      - name: networking
        image: basset-hound/networking:latest
        ports:
        - containerPort: 3000
        env:
        - name: DB_HOST
          value: postgresql-service
        - name: REDIS_HOST
          value: redis-service
        volumeMounts:
        - name: config
          mountPath: /config
        - name: vpn-configs
          mountPath: /vpn-configs
      volumes:
      - name: config
        configMap:
          name: networking-config
      - name: vpn-configs
        persistentVolumeClaim:
          claimName: vpn-configs-pvc
```

---

## Roadmap

### Phase 1: Foundation (Months 1-2)

**Goal:** Core proxy pool management with MCP interface

**Deliverables:**
- MCP server scaffold with fastmcp
- Proxy pool implementation (ProxyPool, Proxy classes)
- Rotation strategies (round-robin, random, fastest)
- Health monitoring
- SQLite database for free tier
- Basic authentication
- 20 proxy management MCP tools
- Unit tests (80% coverage)
- Documentation

**Success Criteria:**
- Can add/remove/rotate proxies via MCP
- Health monitoring detects unhealthy proxies
- Basset Hound Browser successfully integrates via MCP
- All tests passing

### Phase 2: Tor Integration (Month 3)

**Goal:** Full Tor support with circuit management

**Deliverables:**
- Tor control port connection
- New identity functionality
- Exit node selection
- Bridge configuration (obfs4, meek, snowflake)
- Stream isolation
- Circuit monitoring
- 12 Tor management MCP tools
- Integration tests with Tor daemon
- Tor setup documentation

**Success Criteria:**
- Can connect to Tor and request new identities
- Exit node selection works
- Bridge configuration tested on censored network
- Basset Hound Browser can use Tor via networking server

### Phase 3: VPN Management (Month 4)

**Goal:** OpenVPN and WireGuard support

**Deliverables:**
- OpenVPN config import/export
- WireGuard config import/export
- VPN connection lifecycle (connect/disconnect)
- Kill switch implementation
- DNS leak prevention
- VPN pool for rotation
- 15 VPN management MCP tools
- VPN provider documentation

**Success Criteria:**
- Can import and connect to OpenVPN configs
- Can import and connect to WireGuard configs
- Kill switch prevents leaks on VPN failure
- VPN rotation works correctly

### Phase 4: SSH Tunnels (Month 5)

**Goal:** SSH tunneling with multi-hop support

**Deliverables:**
- SSH tunnel creation (local, remote, dynamic)
- Key-based authentication
- Multi-hop SSH chains
- Port forwarding
- Connection persistence
- 12 SSH tunnel MCP tools
- SSH key management

**Success Criteria:**
- Can create SSH tunnels with password and key auth
- Multi-hop chains work correctly
- Auto-reconnect on connection failure

### Phase 5: Multi-Hop Chains (Month 6)

**Goal:** Complex network chains (proxy → VPN → Tor)

**Deliverables:**
- Chain manager implementation
- Chain templates (stealth, balanced, fast, etc.)
- Chain validation
- Chain rotation
- Fallback chain support
- Performance optimization
- 10 chain management MCP tools

**Success Criteria:**
- Can create and activate complex chains
- Chain validation detects connectivity issues
- Chain rotation works without disruption
- Templates provide ready-to-use chains

### Phase 6: Network Policy (Month 7)

**Goal:** Policy-based routing and compliance

**Deliverables:**
- Policy manager implementation
- Domain-specific routing
- Geofencing rules
- Rate limiting
- Allowlist/blocklist
- Audit logging
- PostgreSQL migration for paid tiers
- 12 policy management MCP tools
- Compliance documentation (GDPR, SOC2)

**Success Criteria:**
- Policies enforce routing rules correctly
- Geofencing blocks/allows based on country
- Rate limiting prevents abuse
- Audit logs meet compliance requirements

### Phase 7: Enterprise Features (Month 8)

**Goal:** Enterprise deployment and management

**Deliverables:**
- Team management (multi-user support)
- Role-based access control (RBAC)
- SSO integration (SAML, OAuth)
- REST API alongside MCP
- Docker deployment
- Kubernetes deployment
- Monitoring (Prometheus metrics)
- High availability setup
- Load balancing documentation

**Success Criteria:**
- Multi-user teams work with RBAC
- SSO authentication works
- Docker deployment tested
- Kubernetes deployment tested
- Monitoring dashboards functional

### Phase 8: VPN Provider APIs (Month 9)

**Goal:** Native integration with VPN providers

**Deliverables:**
- NordVPN API integration
- ProtonVPN API integration
- Mullvad API integration
- Auto-configuration from provider APIs
- Server selection based on load/distance
- Provider rotation
- Provider-specific documentation

**Success Criteria:**
- Can authenticate with each provider API
- Can fetch server list and connect
- Provider rotation works correctly

### Phase 9: Polish & Optimization (Month 10)

**Goal:** Performance, reliability, documentation

**Deliverables:**
- Performance optimization (connection pooling, caching)
- Redis integration for distributed state
- Comprehensive error handling
- Retry logic with exponential backoff
- User documentation (getting started, tutorials)
- API reference documentation
- Video tutorials
- Migration guides
- CLI tool enhancements

**Success Criteria:**
- Latency reduced by 30%
- Error handling covers all edge cases
- Documentation is complete and clear
- CLI tool is intuitive

### Phase 10: Beta Testing (Month 11)

**Goal:** Real-world testing with early adopters

**Deliverables:**
- Beta program launch
- Bug fixes from beta feedback
- Performance tuning based on real usage
- Integration testing with multiple clients
- Security audit

**Success Criteria:**
- 50+ beta testers providing feedback
- All critical bugs fixed
- Security audit passed
- Performance meets SLA targets

### Phase 11: Launch (Month 12)

**Goal:** Public launch with FREE and PAID tiers

**Deliverables:**
- Marketing website
- Pricing page
- Payment integration (Stripe)
- License key system
- Tier enforcement (feature gating)
- Launch blog post
- Social media campaign
- Announce to OSINT community

**Success Criteria:**
- Website live with clear messaging
- Payment system works
- License tiers enforced correctly
- 1000+ downloads in first month

---

## Benefits of Separation

### Technical Benefits

1. **Modularity**: Network infrastructure is a standalone service
   - Can be used by any application, not just browser
   - Clear API boundaries (MCP protocol)
   - Independent versioning and releases

2. **Scalability**: Dedicated process for network operations
   - No competition for browser UI thread
   - Can scale horizontally (multiple instances)
   - Dedicated resource management (CPU, memory)

3. **Maintainability**: Single responsibility
   - Easier to debug network issues
   - Smaller codebase per project
   - Clearer separation of concerns

4. **Testability**: Isolated testing
   - Test network features without browser
   - Mock network server for browser tests
   - Integration tests are cleaner

5. **Performance**: Optimized for network operations
   - Connection pooling across clients
   - Shared proxy pool (no duplicate health checks)
   - Better caching strategies

### Business Benefits

1. **Reusability**: Multiple products can use networking server
   - Basset Hound Browser
   - Custom OSINT tools
   - API clients
   - Scrapers
   - Any MCP-compatible application

2. **Monetization**: Clear value proposition
   - FREE tier for hobbyists (marketing funnel)
   - Professional tier for individuals ($29/month)
   - Enterprise tier for teams ($199/month)
   - Custom tier for large organizations

3. **Market Positioning**: Standalone product with unique value
   - Only MCP-native network infrastructure server
   - Specifically designed for OSINT use cases
   - Comprehensive feature set (proxy + VPN + Tor + SSH)

4. **Reduced Browser Maintenance**: Smaller browser codebase
   - Faster releases for browser
   - Less complexity in browser code
   - Easier onboarding for new contributors

5. **Enterprise Appeal**: Centralized network control
   - Single management plane for all tools
   - Audit trail across entire toolchain
   - Compliance features (GDPR, SOC2)

### User Benefits

1. **Consistency**: Same network infrastructure across all tools
   - Unified proxy management
   - Centralized configuration
   - No duplicate work

2. **Flexibility**: Use networking server with any tool
   - Not locked into Basset Hound Browser
   - Integrate with custom scripts
   - Build new tools on top of networking

3. **Reliability**: Dedicated focus on network reliability
   - Better health monitoring
   - Automatic failover
   - Connection persistence

4. **Performance**: Shared resources across applications
   - Single proxy pool for all tools
   - Cached health checks
   - Optimized connection pooling

5. **Security**: Centralized security controls
   - One place to configure network policies
   - Audit trail for all network activity
   - Compliance built-in

---

## Migration Path from Browser

### Current State (Basset Hound Browser v10.6.0)

**Network-related code in browser:**
- `proxy/proxy-pool.js` (~870 lines)
- `proxy/manager.js` (~500 lines)
- `proxy/tor.js` (~400 lines)
- `proxy/tor-advanced.js` (~600 lines)
- `websocket/commands/proxy-pool-commands.js` (~300 lines)
- `tests/unit/proxy-pool.test.js` (~400 lines)
- `tests/unit/tor-manager.test.js` (~300 lines)

**Total: ~3,370 lines of proxy/network code in browser**

### Migration Steps

#### Step 1: Create Networking Server (Months 1-3)
- Develop standalone MCP server
- Port existing proxy pool code to server
- Add Tor integration to server
- Implement MCP API (20+ proxy tools, 12 Tor tools)
- Test independently of browser

#### Step 2: Add MCP Client to Browser (Month 4)
- Install fastmcp client in browser
- Create networking MCP client wrapper
- Add configuration for networking server
- Keep existing code, add new code path

#### Step 3: Parallel Operation (Month 5)
- Browser has two code paths:
  - Old: Direct proxy management
  - New: MCP client to networking server
- Feature flag to switch between paths
- Test new path with subset of users

#### Step 4: Feature Parity Testing (Month 6)
- Comprehensive integration tests
- Performance benchmarks (old vs new)
- Ensure all features work via MCP
- Fix any bugs discovered

#### Step 5: Switch Default (Month 7)
- Change default to use networking server
- Old code path still available as fallback
- Monitor for issues

#### Step 6: Deprecate Old Code (Month 8)
- Announce deprecation of local proxy code
- Provide migration guide
- Keep fallback for one more release

#### Step 7: Remove Old Code (Month 9)
- Delete old proxy/network code from browser
- Update documentation
- Release clean version

**Result:**
- Browser codebase reduced by ~3,370 lines
- Network features improved in standalone server
- Both projects benefit from separation

---

## Risk Analysis & Mitigation

### Technical Risks

#### Risk 1: MCP Protocol Immaturity
**Severity:** Medium
**Probability:** Low
**Impact:** MCP spec changes break compatibility

**Mitigation:**
- Use official fastmcp library (maintained by Anthropic)
- Implement versioning for MCP interface
- Maintain backward compatibility for 2 major versions
- Monitor MCP spec releases and roadmap

#### Risk 2: Network Dependency
**Severity:** High
**Probability:** Medium
**Impact:** If networking server crashes, browser loses proxy capabilities

**Mitigation:**
- Implement health checks in browser
- Keep minimal fallback proxy code in browser
- Auto-restart networking server on crash
- Graceful degradation (direct connection if server unavailable)

#### Risk 3: Performance Overhead
**Severity:** Medium
**Probability:** Low
**Impact:** MCP communication adds latency vs. in-process proxy management

**Mitigation:**
- Benchmark MCP latency vs. local code
- Use stdio transport (faster than HTTP)
- Implement connection pooling
- Cache frequently-used data (proxy lists, health status)
- Target: <10ms overhead for proxy selection

#### Risk 4: Integration Complexity
**Severity:** Medium
**Probability:** Medium
**Impact:** Difficult to integrate for third-party tools

**Mitigation:**
- Provide SDKs for common languages (Python, Node.js, Go)
- Comprehensive documentation with examples
- Video tutorials
- REST API as alternative to MCP
- CLI tool for testing

### Business Risks

#### Risk 5: Market Adoption
**Severity:** High
**Probability:** Medium
**Impact:** Users don't adopt standalone networking server

**Mitigation:**
- FREE tier with generous limits (attract users)
- Clear value proposition (unique features)
- Basset Hound Browser as flagship customer (validation)
- Marketing to OSINT community
- Open source core (build community)

#### Risk 6: Competition
**Severity:** Medium
**Probability:** Medium
**Impact:** Competitors release similar tools

**Mitigation:**
- First-mover advantage (no MCP network server exists today)
- Focus on OSINT-specific features
- Tight integration with Basset Hound ecosystem
- Rapid feature development
- Community building

#### Risk 7: Monetization
**Severity:** High
**Probability:** Low
**Impact:** Users don't convert to paid tiers

**Mitigation:**
- Clear feature differentiation (FREE vs PAID)
- FREE tier is useful but limited (10 proxies)
- Professional tier is affordable ($29/month)
- Enterprise tier targets companies (budget available)
- Freemium model proven in OSINT space

#### Risk 8: Support Burden
**Severity:** Medium
**Probability:** High
**Impact:** High support volume from free users

**Mitigation:**
- Comprehensive documentation
- Community forum (users help each other)
- FAQ and troubleshooting guide
- Email support only for paid tiers
- Automated onboarding

### Legal/Compliance Risks

#### Risk 9: Proxy Abuse
**Severity:** High
**Probability:** Medium
**Impact:** Users abuse proxies for illegal activities

**Mitigation:**
- Terms of Service prohibiting illegal use
- Audit logging (evidence if subpoenaed)
- Abuse detection (unusual patterns)
- Cooperation with law enforcement
- Clear acceptable use policy

#### Risk 10: GDPR/Privacy Compliance
**Severity:** High
**Probability:** Low
**Impact:** Violations of privacy regulations

**Mitigation:**
- Audit logging is optional (can be disabled)
- Data retention policies (90 days default)
- Data export/deletion capabilities
- Privacy policy
- GDPR compliance mode

---

## Success Metrics

### Technical Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| MCP tool count | 90+ tools | Count tools in server code |
| API response time | <50ms (p95) | Prometheus metrics |
| Proxy selection latency | <10ms | Benchmarks |
| Health check success rate | >95% | Monitoring |
| Test coverage | >80% | pytest-cov |
| Uptime | >99.5% | Monitoring |

### Business Metrics

| Metric | Target (Year 1) | Measurement Method |
|--------|-----------------|-------------------|
| Total users | 5,000+ | Registration count |
| Free tier users | 4,000+ | License tier breakdown |
| Professional users | 800+ | Active subscriptions |
| Enterprise users | 200+ | Active subscriptions |
| Monthly revenue | $50,000+ | Stripe dashboard |
| Churn rate | <5% | Subscription analytics |

### User Satisfaction Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| NPS score | >40 | Quarterly surveys |
| GitHub stars | 1,000+ | GitHub metrics |
| Documentation rating | >4.5/5 | Doc feedback |
| Support ticket response time | <24 hours | Help desk metrics |
| Integration success rate | >90% | Onboarding analytics |

### Growth Metrics

| Metric | Quarter 1 | Quarter 2 | Quarter 3 | Quarter 4 |
|--------|-----------|-----------|-----------|-----------|
| New users | 500 | 1,200 | 1,800 | 1,500 |
| Conversions (Free→Paid) | 10% | 15% | 18% | 20% |
| Revenue | $5K | $15K | $30K | $50K+ |

---

## Competitive Analysis

### Existing Solutions

#### 1. Proxy Management Tools
**Examples:** ProxyMesh, Bright Data, Smartproxy

**Strengths:**
- Large proxy pools
- Geographic coverage
- Reliable infrastructure

**Weaknesses:**
- No MCP integration
- Not designed for OSINT
- Expensive (starts at $75/month)
- No VPN/Tor integration
- No multi-hop chains

**Our Advantage:**
- MCP-native (AI agent integration)
- OSINT-specific features
- Comprehensive (proxy + VPN + Tor + SSH)
- More affordable ($29/month professional)
- Multi-hop chain support

#### 2. VPN Services
**Examples:** NordVPN, ProtonVPN, Mullvad

**Strengths:**
- Easy to use
- Large server networks
- Good performance

**Weaknesses:**
- No API integration (or limited)
- No proxy pool management
- No MCP support
- Not designed for automation
- Single-hop only

**Our Advantage:**
- API-first design
- MCP integration
- Combines VPN + proxy
- Multi-hop chains
- Automation-friendly

#### 3. Tor Browser
**Examples:** Tor Browser Bundle, Brave (Tor mode)

**Strengths:**
- Strong anonymity
- Free and open source
- Large network

**Weaknesses:**
- Manual circuit management
- No API/MCP
- Slow performance
- Browser-specific
- No proxy integration

**Our Advantage:**
- Programmatic Tor control
- MCP integration
- Combine Tor with VPN/proxy
- Faster (can use Tor only when needed)
- Automation-friendly

#### 4. SSH Tunnel Tools
**Examples:** autossh, sshuttle

**Strengths:**
- Reliable SSH tunneling
- Open source

**Weaknesses:**
- CLI only
- No MCP integration
- No proxy pool
- Manual management
- No health monitoring

**Our Advantage:**
- MCP API for SSH tunnels
- Integrated with proxy/VPN
- Automatic reconnection
- Health monitoring
- Multi-hop chains

### Market Gap

**No existing solution provides:**
- MCP-native network infrastructure
- Unified proxy + VPN + Tor + SSH management
- OSINT-specific feature set
- Multi-hop chain builder
- AI agent integration

**Basset Hound Networking fills this gap.**

---

## Conclusion

Basset Hound Networking represents a strategic separation of concerns that benefits both the browser and the broader OSINT community. By extracting network infrastructure into a standalone MCP server, we create:

1. **A reusable service** that any tool can leverage via MCP
2. **A monetizable product** with clear FREE and PAID tiers
3. **A simpler browser** with reduced complexity
4. **A better user experience** with centralized network management
5. **A unique market position** as the only MCP-native network infrastructure server

The project is technically feasible (10 months to launch), financially viable ($50K+ MRR target), and strategically sound (separation of concerns, clear API boundaries).

**Recommendation: Proceed with development.**

---

## Next Steps

### Immediate Actions (Week 1)

1. **Validate proposal with stakeholders**
   - Review with Basset Hound Browser team
   - Review with palletai team
   - Gather feedback from OSINT community

2. **Finalize architecture**
   - Detailed design documents
   - API specification (all 90+ MCP tools)
   - Database schema design

3. **Set up development environment**
   - Create GitHub repository
   - Set up CI/CD pipeline
   - Configure project management (issues, milestones)

### Month 1 Deliverables

1. **Project setup**
   - Repository structure
   - Development environment
   - CI/CD pipeline

2. **Core infrastructure**
   - MCP server scaffold
   - Database setup (SQLite)
   - Configuration system

3. **Proxy pool MVP**
   - ProxyPool and Proxy classes
   - Round-robin rotation
   - Basic health checks
   - 5-10 MCP tools

### Go/No-Go Decision Point (End of Month 2)

**Criteria for proceeding:**
- Core proxy pool working
- MCP integration functional
- Basset Hound Browser successfully integrated
- All tests passing
- Performance acceptable (<10ms overhead)

If criteria met: Proceed to Phase 2 (Tor integration)
If criteria not met: Re-evaluate or pivot

---

## Appendix A: MCP Tool Specifications

*[Detailed specifications for all 90+ MCP tools would go here in full documentation]*

Example:

```
Tool: network_add_proxy
Description: Add proxy to pool
Parameters:
  - host: string (required) - Proxy hostname or IP
  - port: integer (required) - Proxy port (1-65535)
  - type: enum (required) - Proxy type: HTTP, HTTPS, SOCKS4, SOCKS5
  - username: string (optional) - Authentication username
  - password: string (optional) - Authentication password
  - country: string (optional) - Country code (ISO 3166-1 alpha-2)
  - region: string (optional) - Region/state
  - city: string (optional) - City
  - tags: array[string] (optional) - Custom tags for filtering
Returns:
  - proxy_id: string - Unique proxy identifier
  - status: string - Current proxy status (HEALTHY, DEGRADED, etc.)
Errors:
  - INVALID_HOST: Host is not a valid hostname or IP
  - INVALID_PORT: Port is out of range
  - INVALID_TYPE: Proxy type not supported
  - DUPLICATE_PROXY: Proxy already exists in pool
Example:
  Input:
    {
      "host": "proxy.example.com",
      "port": 8080,
      "type": "HTTP",
      "country": "US",
      "tags": ["residential", "fast"]
    }
  Output:
    {
      "proxy_id": "http://proxy.example.com:8080",
      "status": "HEALTHY"
    }
```

---

## Appendix B: Database Schema

*[Complete database schema would go here in full documentation]*

Example tables:

```sql
-- Proxies table
CREATE TABLE proxies (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    type TEXT NOT NULL,
    username TEXT,
    password TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    tags TEXT,  -- JSON array
    status TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    average_response_time REAL DEFAULT 0,
    last_used TIMESTAMP,
    last_checked TIMESTAMP,
    last_success TIMESTAMP,
    last_failure TIMESTAMP,
    blacklisted_until TIMESTAMP,
    blacklist_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(host, port, type)
);

-- VPN configurations table
CREATE TABLE vpn_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- openvpn, wireguard
    config_data TEXT NOT NULL,  -- Full config file content
    country TEXT,
    provider TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SSH tunnels table
CREATE TABLE ssh_tunnels (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    user TEXT NOT NULL,
    auth_method TEXT NOT NULL,  -- password, key
    local_port INTEGER,
    remote_port INTEGER,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Network chains table
CREATE TABLE chains (
    id TEXT PRIMARY KEY,
    name TEXT,
    components TEXT NOT NULL,  -- JSON array
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    user_id TEXT,
    resource_type TEXT,
    resource_id TEXT,
    action TEXT NOT NULL,
    details TEXT,  -- JSON
    success BOOLEAN NOT NULL
);
```

---

## Appendix C: REST API (Alternative to MCP)

For clients that don't support MCP, provide REST API:

```
POST /api/v1/proxies
  - Add proxy to pool

GET /api/v1/proxies
  - List all proxies

GET /api/v1/proxies/:id
  - Get proxy details

DELETE /api/v1/proxies/:id
  - Remove proxy

POST /api/v1/proxies/next
  - Get next proxy (with filters)

POST /api/v1/tor/connect
  - Connect to Tor

POST /api/v1/tor/new-identity
  - Request new Tor circuit

POST /api/v1/vpn/import
  - Import VPN config

POST /api/v1/vpn/connect
  - Connect to VPN

POST /api/v1/chains
  - Create network chain

POST /api/v1/chains/:id/activate
  - Activate chain
```

---

## References & Sources

### OSINT Network Infrastructure Requirements
- [VPN Providers for OSINT](https://github.com/The-Osint-Toolbox/VPN-Providers) - The OSINT Toolbox
- [Unveiling the Power of VPNs for OSINT Professionals](https://osint.org/unveiling-the-power-of-vpns-how-osint-professionals-can-stay-anonymous-and-secure-online/) - OSINT.org
- [VPN Guidance for OSINT](https://osint.tools/vpn-guidnace) - osint.tools
- [tfvpn - Self-hosted VPN for OSINT Investigations](https://osint.fans/tfvpn-for-osint-investigations) - OSINT Fans
- [OSINT Detailed Guide for 2026](https://mainekhacker.medium.com/osint-detailed-guide-for-2026-367dd20249bf) - Medium
- [Effective Use of VPN in OSINT](https://www.cqcore.uk/effective-use-of-a-vpn-in-osint/) - CQCore

### MCP Architecture & Best Practices
- [MCP Best Practices: Architecture & Implementation Guide](https://modelcontextprotocol.info/docs/best-practices/) - Model Context Protocol
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) - Official Spec
- [MCP Architecture: Design Philosophy & Engineering Principles](https://modelcontextprotocol.info/docs/concepts/architecture/) - Model Context Protocol
- [Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) - Anthropic
- [MCP Server: Essential Guide for AI Engineers](https://skywork.ai/skypage/en/Model-Context-Protocol-(MCP)-Server-An-Essential-Guide-for-AI-Engineers/1970685238072897536) - Skywork AI
- [MCP Architecture, Components & Workflow](https://www.kubiya.ai/blog/model-context-protocol-mcp-architecture-components-and-workflow) - Kubiya

---

**End of Proposal**

*For questions or feedback, contact: [your-email@basset-hound.dev]*
