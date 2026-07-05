# WSS Implementation Architecture & Diagram

**Date:** June 21, 2026  
**Version:** 1.0  
**Status:** Complete

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BASSET HOUND BROWSER WSS ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────────────────┘

                               CLIENT SIDE
                          ─────────────────

   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │  Node.js Client  │  │  Python Client   │  │  Browser Client  │
   │  (tls-client.js) │  │ (tls-client.py)  │  │   (JavaScript)   │
   └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
            │                      │                      │
            │                      │                      │
            ├──────────────────────┼──────────────────────┤
            │                      │                      │
            │    WebSocket Secure (WSS)                  │
            │    wss://host:8765                          │
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
            ┌─────────────────┐         ┌──────────────────┐
            │  TLS Handshake  │         │  Certificate    │
            │  - Exchange key │         │  Validation     │
            │  - Verify cert  │         │  - Check expiry │
            │  - Establish    │         │  - Verify chain │
            │    secure link  │         │  - Check CN/SAN │
            └─────────────────┘         └──────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  Encrypted Link  │
                         │  Ready for Data  │
                         └──────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
            ┌──────────────────────────┐  ┌────────────────┐
            │  Command Messages         │  │  Response Data │
            │  - ping                   │  │  - JSON        │
            │  - navigate               │  │  - Binary      │
            │  - screenshot             │  │  - Compressed  │
            │  - [164+ commands]        │  │  - Encrypted   │
            └──────────────────────────┘  └────────────────┘


                            SERVER SIDE
                       ────────────────────

                      ┌─────────────────────┐
                      │   WebSocket Server  │
                      │  websocket/server.js│
                      │    (11,800 lines)   │
                      └──────────┬──────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
         ┌──────────▼───────────┐   ┌─────────▼────────────┐
         │  HTTPS Server        │   │  HTTP Server         │
         │  (TLS Enabled)       │   │  (Development only)  │
         │  Port: 8765          │   │  Port: 8765          │
         │  Protocol: wss://    │   │  Protocol: ws://     │
         └──────────┬───────────┘   └─────────┬────────────┘
                    │                         │
       ┌────────────▴─────────────┬──────────┘
       │                          │
       ▼                          ▼
┌──────────────────┐      ┌──────────────────┐
│  SSL/TLS Layer   │      │  HTTP Handler    │
│  - TLS 1.2/1.3   │      │  - Health Check  │
│  - Ciphers: HIGH │      │  - Diagnostics   │
│  - PFS enabled   │      │  - Compression   │
└────────┬─────────┘      └──────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │  Certificate Management          │
    ├──────────────────────────────────┤
    │  Configuration:                  │
    │  ├─ BASSET_WS_SSL_ENABLED        │
    │  ├─ BASSET_WS_SSL_CERT (path)    │
    │  ├─ BASSET_WS_SSL_KEY (path)     │
    │  └─ BASSET_WS_SSL_CA (optional)  │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │  Certificate Loading             │
    ├──────────────────────────────────┤
    │  _loadSslCertificates():         │
    │  ├─ Validate paths               │
    │  ├─ Verify PEM format            │
    │  ├─ Load server cert             │
    │  ├─ Load private key             │
    │  └─ Optional: Load CA cert       │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │  WebSocket Server                │
    ├──────────────────────────────────┤
    │  new WebSocket.Server({          │
    │    server: httpsServer,          │
    │    maxPayload: 100MB,            │
    │    compression: enabled          │
    │  })                              │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │  Command Processing              │
    ├──────────────────────────────────┤
    │  CommandDispatcher:              │
    │  ├─ 164 WebSocket commands       │
    │  ├─ Rate limiting                │
    │  ├─ Authentication               │
    │  └─ Response serialization       │
    └──────────────────────────────────┘
```

---

## Certificate Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    CERTIFICATE MANAGEMENT FLOW                  │
└────────────────────────────────────────────────────────────────┘


DEVELOPMENT PATH (Self-Signed)
──────────────────────────────

    ┌─────────────────┐
    │  User Decision  │
    │  "dev env"      │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ Option A: Script Generation     │
    │ docker-tls-setup.sh dev         │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ Option B: Manual (OpenSSL)      │
    │ openssl genrsa -out key 2048    │
    │ openssl req -new -x509 ...      │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ Option C: Node.js API           │
    │ WebSocketServer.generateSelf... │
    │   SignedCert('./certs')         │
    └────────┬────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Certificate Output:          │
    │ cert.crt (public)            │
    │ key.pem (private, 600 perms) │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Set Environment Variables    │
    │ BASSET_WS_SSL_ENABLED=true   │
    │ BASSET_WS_SSL_CERT=path      │
    │ BASSET_WS_SSL_KEY=path       │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Start Server                 │
    │ npm start                    │
    │ ↓                            │
    │ Listening on wss://...       │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Client Connection            │
    │ rejectUnauthorized: false    │
    │ (Accept self-signed)         │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ ✅ Secure Connection Ready   │
    └──────────────────────────────┘


PRODUCTION PATH (Let's Encrypt)
───────────────────────────────

    ┌─────────────────┐
    │  User Decision  │
    │  "prod env"     │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ Install Certificate Tool        │
    │ apt-get install certbot         │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ Generate Certificate            │
    │ certbot certonly --standalone   │
    │ -d browser.example.com          │
    └────────┬────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Certificate Output:          │
    │ fullchain.pem (public)       │
    │ privkey.pem (private, 600)   │
    │ /etc/letsencrypt/live/...    │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Copy to App Directory        │
    │ cp fullchain.pem cert.pem    │
    │ cp privkey.pem key.pem       │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Set Environment Variables    │
    │ NODE_ENV=production          │
    │ BASSET_WS_SSL_ENABLED=true   │
    │ BASSET_WS_SSL_CERT=path      │
    │ BASSET_WS_SSL_KEY=path       │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Setup Auto-Renewal           │
    │ systemctl enable renew timer  │
    │ certbot auto-renewal: 90 days│
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Start Server                 │
    │ npm start                    │
    │ ↓                            │
    │ Listening on wss://...       │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Client Connection            │
    │ rejectUnauthorized: true     │
    │ (Validate certificate)       │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Certificate Renewal Cycle    │
    │ Every 90 days (auto)         │
    │ Zero-downtime reload         │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ ✅ Production Ready          │
    │    Always Valid Certificate  │
    └──────────────────────────────┘


ENTERPRISE PATH (Custom CA)
──────────────────────────

    ┌─────────────────┐
    │  User Decision  │
    │  "enterprise"   │
    └────────┬────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Obtain Corporate Cert        │
    │ from Internal CA              │
    │ or third-party authority      │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Copy to App Directory        │
    │ cp corporate-cert.pem        │
    │ cp corporate-key.pem         │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Optional: Client Auth        │
    │ Copy CA certificate          │
    │ for client verification      │
    │ BASSET_WS_SSL_CA=path        │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Integrate with PKI           │
    │ Setup certificate renewal    │
    │ through corporate tools      │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Client Connection            │
    │ Load CA certificate          │
    │ Load client certificate      │
    │ (mTLS mutual auth)           │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ ✅ Enterprise Secure         │
    │    with mTLS Authentication  │
    └──────────────────────────────┘
```

---

## Data Flow During WSS Communication

```
┌─────────────────────────────────────────────────────────────┐
│              WEBSOCKET SECURE MESSAGE FLOW                    │
└─────────────────────────────────────────────────────────────┘


CLIENT SENDS COMMAND
────────────────────

    Client Code:
    ws.send(JSON.stringify({
      command: 'navigate',
      url: 'https://example.com'
    }))
            │
            ▼
    ┌─────────────────────┐
    │  JSON Serialization │
    │  {string}           │
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Message Compression (optional) │
    │  - perMessageDeflate            │
    │  - Reduce by 70-93%             │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  TLS/SSL Encryption             │
    │  - Algorithm: AES-256           │
    │  - MAC: SHA256                  │
    │  - Key: Negotiated in handshake │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Transmission over HTTPS        │
    │  - Port 8765                    │
    │  - TCP/IP stack                 │
    │  - Network transport            │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  SERVER RECEIVES                │
    └─────────────────────────────────┘


SERVER RECEIVES COMMAND
──────────────────────

    ┌─────────────────────────────────┐
    │  TLS/SSL Decryption             │
    │  - Using private key            │
    │  - Verify MAC                   │
    │  - Reconstruct message          │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Message Decompression          │
    │  - If compressed flag set       │
    │  - Restore original size        │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  JSON Parsing                   │
    │  - Validate JSON format         │
    │  - Extract command and args     │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Command Processing             │
    │  - Rate limit check             │
    │  - Authentication verify        │
    │  - Command validation           │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Command Execution              │
    │  - Navigate to URL              │
    │  - Take screenshot              │
    │  - [164 command handlers]       │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Response Generation            │
    │  {                              │
    │    success: true,               │
    │    data: {...},                 │
    │    timestamp: ...               │
    │  }                              │
    └────────┬────────────────────────┘
             │
             ▼


SERVER SENDS RESPONSE
─────────────────────

    ┌─────────────────────────────────┐
    │  JSON Serialization             │
    │  - Response object to string    │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Response Serialization         │
    │  - Template caching             │
    │  - Buffer pooling               │
    │  - Optimize size                │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Message Compression (optional) │
    │  - Large responses compressed   │
    │  - Threshold: 1KB               │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  TLS/SSL Encryption             │
    │  - Same cipher as inbound       │
    │  - MAC generation               │
    │  - Encapsulation                │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Transmission to Client         │
    │  - TCP/IP delivery              │
    │  - Acknowledgment               │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  CLIENT RECEIVES RESPONSE       │
    └─────────────────────────────────┘


CLIENT RECEIVES RESPONSE
────────────────────────

    ┌─────────────────────────────────┐
    │  TLS/SSL Decryption             │
    │  - Using negotiated keys        │
    │  - Verify integrity             │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Message Decompression          │
    │  - If compression flag set      │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  JSON Parsing                   │
    │  - Parse response object        │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  Handler Invocation             │
    │  ws.onmessage(event)            │
    │  - Application processes data   │
    │  - Callback execution           │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  ✅ Communication Complete      │
    │     Next command ready          │
    └─────────────────────────────────┘
```

---

## Security Layer Visualization

```
┌──────────────────────────────────────────────────────────────┐
│                 SECURITY LAYERS (WSS)                        │
└──────────────────────────────────────────────────────────────┘


    APPLICATION LAYER
    ────────────────
    ┌────────────────────────────────┐
    │  WebSocket API Commands        │
    │  - 164 commands available      │
    │  - Authentication required     │
    │  - Rate limiting               │
    └────────────────────────────────┘


    WEBSOCKET LAYER
    ───────────────
    ┌────────────────────────────────┐
    │  WebSocket Protocol            │
    │  - Message framing             │
    │  - Compression (optional)      │
    │  - Connection management       │
    └────────────────────────────────┘


    TLS/SSL LAYER  ← Primary Security
    ──────────────
    ┌────────────────────────────────┐
    │  Encryption                    │
    │  ├─ Algorithm: AES-256-GCM     │
    │  ├─ Mode: Authenticated        │
    │  └─ Key size: 256 bits         │
    │                                │
    │  Authentication                │
    │  ├─ Certificate validation     │
    │  ├─ Public key infrastructure  │
    │  └─ X.509 chain verification   │
    │                                │
    │  Key Exchange                  │
    │  ├─ Method: ECDHE              │
    │  ├─ Forward Secrecy: Yes       │
    │  └─ Ephemeral keys             │
    │                                │
    │  Integrity                     │
    │  ├─ MAC: SHA-256               │
    │  ├─ AEAD: Authenticated        │
    │  └─ Tamper detection           │
    └────────────────────────────────┘


    CERTIFICATE LAYER
    ─────────────────
    ┌────────────────────────────────┐
    │  Server Certificate            │
    │  ├─ X.509 v3                   │
    │  ├─ Subject CN validation      │
    │  ├─ Issuer verification        │
    │  ├─ Date validation (expiry)   │
    │  └─ Key size: 2048+ bits       │
    │                                │
    │  Optional: Client Certificate  │
    │  ├─ Mutual TLS (mTLS)          │
    │  ├─ Client authentication      │
    │  └─ Certificate chain          │
    │                                │
    │  Optional: CA Certificate      │
    │  ├─ Chain verification         │
    │  ├─ Trust anchoring            │
    │  └─ Intermediate CA support    │
    └────────────────────────────────┘


    TRANSPORT LAYER
    ───────────────
    ┌────────────────────────────────┐
    │  TCP/IP Network                │
    │  ├─ Connection integrity       │
    │  ├─ Ordered delivery           │
    │  └─ Error detection            │
    └────────────────────────────────┘


    ┌────────────────────────────────┐
    │  ✅ MULTI-LAYER SECURITY       │
    │     No single point of failure  │
    └────────────────────────────────┘
```

---

## File Organization

```
basset-hound-browser/
├── websocket/
│   ├── server.js                    ← WSS Implementation (existing)
│   │   ├── Configuration (lines 925-933)
│   │   ├── SSL Server Startup (lines 1438-1482)
│   │   ├── Certificate Loading (lines 1981-2058)
│   │   └── Helper Methods
│   └── ... other files
│
├── docs/
│   ├── TLS-SETUP.md                 ← Production guide (NEW)
│   ├── WSS-IMPLEMENTATION-SUMMARY.md ← Technical details (NEW)
│   ├── WSS-QUICK-REFERENCE.md       ← Quick reference (NEW)
│   └── WSS-ARCHITECTURE-DIAGRAM.md  ← This file (NEW)
│
├── examples/
│   ├── tls-client.js                ← Node.js client (NEW)
│   ├── tls-client-cert-auth.js      ← mTLS client (NEW)
│   ├── tls-client.py                ← Python client (NEW)
│   ├── docker-tls-setup.sh          ← Setup script (NEW)
│   └── ... other examples
│
├── docker-compose.yml               ← Can use TLS (existing)
├── Dockerfile                       ← Can use TLS (existing)
└── ... other files

CERTIFICATE STORAGE LOCATIONS
──────────────────────────────

Development:
  ./certs/
    ├── localhost.crt
    ├── localhost.key
    ├── cert.pem                     ← Symlink
    └── key.pem                      ← Symlink

Production (Linux):
  /etc/letsencrypt/
    └── live/
        └── browser.example.com/
            ├── fullchain.pem        → /etc/basset/certs/cert.pem
            └── privkey.pem          → /etc/basset/certs/key.pem

Docker:
  /app/certs/                        (volume mount)
    ├── cert.pem
    └── key.pem

Kubernetes:
  basset-hound-tls secret
    ├── cert.pem
    └── key.pem
```

---

## Implementation Checklist

```
✅ SERVER-SIDE WSS IMPLEMENTATION
  ├─ ✅ WebSocket server with TLS/SSL
  ├─ ✅ HTTPS server creation
  ├─ ✅ Certificate loading and validation
  ├─ ✅ Error handling and fallback
  ├─ ✅ Health check endpoints
  ├─ ✅ Logging and monitoring
  └─ ✅ Performance optimization

✅ CERTIFICATE MANAGEMENT
  ├─ ✅ Self-signed cert generation
  ├─ ✅ Let's Encrypt integration
  ├─ ✅ Custom CA support
  ├─ ✅ Client certificate auth (mTLS)
  ├─ ✅ Certificate validation
  ├─ ✅ Chain verification
  └─ ✅ Auto-renewal setup

✅ CLIENT IMPLEMENTATIONS
  ├─ ✅ Node.js client (tls-client.js)
  ├─ ✅ Python client (tls-client.py)
  ├─ ✅ mTLS client (tls-client-cert-auth.js)
  └─ ✅ Browser JavaScript examples

✅ DEPLOYMENT AUTOMATION
  ├─ ✅ Docker setup script
  ├─ ✅ Docker Compose config
  ├─ ✅ Dockerfile with TLS
  ├─ ✅ Kubernetes integration
  ├─ ✅ Nginx reverse proxy
  └─ ✅ systemd timer setup

✅ DOCUMENTATION
  ├─ ✅ Production setup guide (TLS-SETUP.md)
  ├─ ✅ Implementation details (WSS-IMPLEMENTATION-SUMMARY.md)
  ├─ ✅ Quick reference (WSS-QUICK-REFERENCE.md)
  ├─ ✅ Architecture diagram (this file)
  ├─ ✅ Example clients
  ├─ ✅ Troubleshooting guides
  └─ ✅ Best practices

✅ SECURITY
  ├─ ✅ TLS 1.2+ requirement
  ├─ ✅ Certificate validation
  ├─ ✅ Path security checks
  ├─ ✅ No key logging
  ├─ ✅ Restrictive permissions
  ├─ ✅ mTLS support
  └─ ✅ Error handling

✅ TESTING & VALIDATION
  ├─ ✅ Code review completed
  ├─ ✅ Example clients tested
  ├─ ✅ Docker integration verified
  ├─ ✅ Kubernetes patterns validated
  ├─ ✅ Performance benchmarked
  └─ ✅ Documentation reviewed

Status: ✅ COMPLETE & PRODUCTION READY
```

---

## Related Documentation

- **TLS-SETUP.md** - Complete production deployment guide
- **WSS-IMPLEMENTATION-SUMMARY.md** - Technical implementation details
- **WSS-QUICK-REFERENCE.md** - Quick lookup cheat sheet
- **examples/tls-client.js** - Node.js client implementation
- **examples/tls-client.py** - Python client implementation
- **examples/docker-tls-setup.sh** - Automated setup script

---

**Status:** Complete | **Date:** June 21, 2026 | **Version:** 1.0
