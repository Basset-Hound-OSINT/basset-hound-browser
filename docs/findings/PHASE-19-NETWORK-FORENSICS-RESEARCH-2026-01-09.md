# Phase 19: Enhanced Network Forensics Research & Implementation Plan

**Date:** January 9, 2026
**Author:** Claude Code
**Phase:** 19 - Enhanced Network Forensics

---

## Executive Summary

This document provides comprehensive research findings and implementation guidance for Phase 19 of basset-hound-browser, which aims to expand network forensic capabilities beyond basic HAR capture. The phase focuses on five critical areas:

1. **WebSocket Message Capture** - Full bidirectional message logging with timing
2. **WebRTC Connection Logging** - Peer connection tracking, ICE candidates, STUN/TURN details
3. **DNS Query Capture** - DNS resolution timing and response logging
4. **Certificate Chain Extraction** - Complete TLS certificate analysis including OCSP/CRL
5. **HTTP/2 and HTTP/3 Details** - Protocol-level metrics including QUIC and server push

### Current State Analysis

The existing network capture system in `network-analysis/manager.js` uses Electron's `webRequest` API for HTTP/HTTPS traffic capture. This provides:

- HTTP request/response headers
- Status codes and timing
- Request/response size tracking
- Basic security analysis
- Resource type filtering

**Gaps identified:**
- No WebSocket frame-level capture
- No WebRTC connection tracking
- No DNS-level query logging
- Basic certificate capture (hostname only)
- No HTTP/2 stream details
- No HTTP/3/QUIC protocol information

---

## 1. WebSocket Message Capture

### Technical Overview

WebSocket connections upgrade from HTTP and provide full-duplex communication channels. Standard `webRequest` API does not capture frame-level data after the upgrade handshake.

### Implementation Approach

**Method 1: Chrome DevTools Protocol (CDP) - RECOMMENDED**

CDP provides the most comprehensive WebSocket monitoring through the Network domain:

```javascript
// Enable network tracking
await webContents.debugger.sendCommand('Network.enable');

// Listen for WebSocket events
webContents.debugger.on('message', (event, method, params) => {
  switch (method) {
    case 'Network.webSocketCreated':
      // WebSocket connection initiated
      // params: { requestId, url, initiator }
      break;

    case 'Network.webSocketWillSendHandshakeRequest':
      // Capture upgrade request headers
      // params: { requestId, timestamp, wallTime, request }
      break;

    case 'Network.webSocketHandshakeResponseReceived':
      // Capture upgrade response headers
      // params: { requestId, timestamp, response }
      break;

    case 'Network.webSocketFrameSent':
      // Outgoing frame (client -> server)
      // params: { requestId, timestamp, response }
      // response: { opcode, mask, payloadData }
      break;

    case 'Network.webSocketFrameReceived':
      // Incoming frame (server -> client)
      // params: { requestId, timestamp, response }
      // response: { opcode, mask, payloadData }
      break;

    case 'Network.webSocketFrameError':
      // Frame error occurred
      // params: { requestId, timestamp, errorMessage }
      break;

    case 'Network.webSocketClosed':
      // Connection closed
      // params: { requestId, timestamp }
      break;
  }
});
```

**Method 2: JavaScript Instrumentation (Alternative)**

Inject JavaScript to wrap native WebSocket constructor:

```javascript
(function() {
  const OriginalWebSocket = window.WebSocket;
  const capturedConnections = new Map();

  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    const connectionId = generateId();

    const metadata = {
      id: connectionId,
      url: url,
      protocols: protocols,
      createdAt: Date.now(),
      messages: []
    };

    capturedConnections.set(connectionId, metadata);

    // Intercept send
    const originalSend = ws.send.bind(ws);
    ws.send = function(data) {
      metadata.messages.push({
        direction: 'sent',
        timestamp: Date.now(),
        data: data,
        type: typeof data,
        size: data.length || data.byteLength || 0
      });
      return originalSend(data);
    };

    // Intercept onmessage
    const originalOnMessage = ws.onmessage;
    Object.defineProperty(ws, 'onmessage', {
      set: function(handler) {
        originalOnMessage = function(event) {
          metadata.messages.push({
            direction: 'received',
            timestamp: Date.now(),
            data: event.data,
            type: typeof event.data,
            size: event.data.length || event.data.byteLength || 0
          });
          if (handler) handler(event);
        };
      }
    });

    // Intercept addEventListener
    const originalAddEventListener = ws.addEventListener.bind(ws);
    ws.addEventListener = function(type, listener, options) {
      if (type === 'message') {
        const wrappedListener = function(event) {
          metadata.messages.push({
            direction: 'received',
            timestamp: Date.now(),
            data: event.data,
            type: typeof event.data,
            size: event.data.length || event.data.byteLength || 0
          });
          listener(event);
        };
        return originalAddEventListener(type, wrappedListener, options);
      }
      return originalAddEventListener(type, listener, options);
    };

    return ws;
  };

  // Expose captured data
  window.__getWebSocketCapture = () => Array.from(capturedConnections.values());
})();
```

### Data Structure

```javascript
{
  connectionId: 'ws_1704834567890_abc123',
  url: 'wss://example.com/socket',
  protocols: ['chat', 'superchat'],
  initiator: 'https://example.com/app.js',

  handshake: {
    request: {
      timestamp: 1704834567890,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Protocol': 'chat, superchat'
      }
    },
    response: {
      timestamp: 1704834567920,
      statusCode: 101,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Accept': 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
        'Sec-WebSocket-Protocol': 'chat'
      }
    },
    duration: 30
  },

  frames: [
    {
      frameId: 'frame_1',
      direction: 'sent',  // or 'received'
      timestamp: 1704834568000,
      opcode: 1,  // 1=text, 2=binary, 8=close, 9=ping, 10=pong
      masked: true,
      payloadLength: 256,
      payloadData: 'base64_encoded_or_text',
      isBinary: false
    }
  ],

  closeInfo: {
    timestamp: 1704834570000,
    code: 1000,
    reason: 'Normal closure',
    wasClean: true
  },

  statistics: {
    totalFramesSent: 42,
    totalFramesReceived: 38,
    totalBytesSent: 12560,
    totalBytesReceived: 98340,
    duration: 2110,
    pingCount: 5,
    pongCount: 5
  }
}
```

### Privacy Considerations

1. **Payload Sensitivity**: WebSocket messages may contain:
   - Authentication tokens
   - Personal information
   - Session identifiers
   - Private communications

2. **Mitigation Strategies**:
   - Optional payload redaction (capture metadata only)
   - PII detection and automatic masking
   - Configurable capture depth
   - Clear user consent for full capture

3. **Storage Considerations**:
   - Large message payloads can fill memory quickly
   - Implement circular buffer with size limits
   - Optional compression for stored payloads
   - Automatic cleanup of old connections

### Implementation Complexity

- **Effort**: Medium (3-5 days)
- **CDP Integration**: Low complexity (APIs well documented)
- **Storage Management**: Medium complexity (memory concerns)
- **Privacy Handling**: Medium complexity (requires careful design)

---

## 2. WebRTC Connection Logging

### Technical Overview

WebRTC (Web Real-Time Communication) enables peer-to-peer audio, video, and data streaming in browsers. Connection establishment involves:

1. **Session Description Protocol (SDP)** negotiation
2. **ICE (Interactive Connectivity Establishment)** candidate gathering
3. **STUN/TURN server queries** for NAT traversal
4. **DTLS handshake** for secure transport

### Implementation Approach

**Method 1: RTCPeerConnection Instrumentation (RECOMMENDED)**

Wrap native RTCPeerConnection to capture all events:

```javascript
(function() {
  const OriginalRTCPeerConnection = window.RTCPeerConnection;
  const capturedConnections = new Map();

  window.RTCPeerConnection = function(configuration, constraints) {
    const pc = new OriginalRTCPeerConnection(configuration, constraints);
    const connectionId = generateId();

    const metadata = {
      id: connectionId,
      createdAt: Date.now(),
      configuration: configuration,
      constraints: constraints,

      iceServers: configuration?.iceServers || [],
      localDescription: null,
      remoteDescription: null,

      localCandidates: [],
      remoteCandidates: [],

      connectionState: 'new',
      iceConnectionState: 'new',
      iceGatheringState: 'new',
      signalingState: 'stable',

      dataChannels: [],
      transceivers: [],

      statistics: {
        candidatePairsChecked: 0,
        candidatePairsSucceeded: 0,
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0
      },

      events: []
    };

    capturedConnections.set(connectionId, metadata);

    // Capture ICE candidates
    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        const candidate = {
          timestamp: Date.now(),
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,

          // Parse candidate string
          type: extractCandidateType(event.candidate.candidate),
          protocol: extractProtocol(event.candidate.candidate),
          address: extractAddress(event.candidate.candidate),
          port: extractPort(event.candidate.candidate),
          priority: extractPriority(event.candidate.candidate),
          relatedAddress: extractRelatedAddress(event.candidate.candidate),
          relatedPort: extractRelatedPort(event.candidate.candidate)
        };

        metadata.localCandidates.push(candidate);
        metadata.events.push({
          type: 'icecandidate',
          timestamp: Date.now(),
          candidateId: candidate.candidate
        });
      }
    });

    // Capture connection state changes
    pc.addEventListener('connectionstatechange', () => {
      metadata.connectionState = pc.connectionState;
      metadata.events.push({
        type: 'connectionstatechange',
        timestamp: Date.now(),
        state: pc.connectionState
      });
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      metadata.iceConnectionState = pc.iceConnectionState;
      metadata.events.push({
        type: 'iceconnectionstatechange',
        timestamp: Date.now(),
        state: pc.iceConnectionState
      });
    });

    pc.addEventListener('icegatheringstatechange', () => {
      metadata.iceGatheringState = pc.iceGatheringState;
      metadata.events.push({
        type: 'icegatheringstatechange',
        timestamp: Date.now(),
        state: pc.iceGatheringState
      });
    });

    pc.addEventListener('signalingstatechange', () => {
      metadata.signalingState = pc.signalingState;
      metadata.events.push({
        type: 'signalingstatechange',
        timestamp: Date.now(),
        state: pc.signalingState
      });
    });

    // Capture data channels
    pc.addEventListener('datachannel', (event) => {
      const channel = {
        label: event.channel.label,
        id: event.channel.id,
        protocol: event.channel.protocol,
        ordered: event.channel.ordered,
        maxRetransmits: event.channel.maxRetransmits,
        maxPacketLifeTime: event.channel.maxPacketLifeTime,
        createdAt: Date.now()
      };

      metadata.dataChannels.push(channel);
      metadata.events.push({
        type: 'datachannel',
        timestamp: Date.now(),
        channelLabel: event.channel.label
      });
    });

    // Wrap setLocalDescription
    const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
    pc.setLocalDescription = async function(description) {
      metadata.localDescription = {
        type: description?.type || pc.localDescription?.type,
        sdp: description?.sdp || pc.localDescription?.sdp,
        timestamp: Date.now()
      };
      metadata.events.push({
        type: 'setLocalDescription',
        timestamp: Date.now(),
        descriptionType: description?.type
      });
      return originalSetLocalDescription(description);
    };

    // Wrap setRemoteDescription
    const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = async function(description) {
      metadata.remoteDescription = {
        type: description.type,
        sdp: description.sdp,
        timestamp: Date.now()
      };
      metadata.events.push({
        type: 'setRemoteDescription',
        timestamp: Date.now(),
        descriptionType: description.type
      });
      return originalSetRemoteDescription(description);
    };

    // Wrap addIceCandidate
    const originalAddIceCandidate = pc.addIceCandidate.bind(pc);
    pc.addIceCandidate = async function(candidate) {
      if (candidate && candidate.candidate) {
        metadata.remoteCandidates.push({
          timestamp: Date.now(),
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        });
      }
      return originalAddIceCandidate(candidate);
    };

    // Periodic stats collection
    const statsInterval = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        updateStatistics(metadata, stats);
      } catch (e) {
        // Stats not available yet
      }
    }, 5000);

    // Cleanup on close
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        clearInterval(statsInterval);
      }
    });

    return pc;
  };

  window.__getRTCPeerConnectionCapture = () => Array.from(capturedConnections.values());
})();
```

**Helper Functions for Candidate Parsing:**

```javascript
function extractCandidateType(candidateString) {
  // candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host
  const match = candidateString.match(/typ\s+(\w+)/);
  return match ? match[1] : null; // host, srflx, prflx, relay
}

function extractProtocol(candidateString) {
  const match = candidateString.match(/\s+(UDP|TCP)\s+/);
  return match ? match[1].toLowerCase() : null;
}

function extractAddress(candidateString) {
  const parts = candidateString.split(' ');
  return parts[4] || null;
}

function extractPort(candidateString) {
  const parts = candidateString.split(' ');
  return parts[5] ? parseInt(parts[5]) : null;
}

function extractPriority(candidateString) {
  const parts = candidateString.split(' ');
  return parts[3] ? parseInt(parts[3]) : null;
}

function extractRelatedAddress(candidateString) {
  const match = candidateString.match(/raddr\s+([\d.]+)/);
  return match ? match[1] : null;
}

function extractRelatedPort(candidateString) {
  const match = candidateString.match(/rport\s+(\d+)/);
  return match ? parseInt(match[1]) : null;
}
```

### Data Structure

```javascript
{
  connectionId: 'rtc_1704834567890_xyz789',
  createdAt: 1704834567890,

  configuration: {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      {
        urls: 'turn:turn.example.com:3478',
        username: 'user',
        credential: 'pass',
        credentialType: 'password'
      }
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require'
  },

  localDescription: {
    type: 'offer',
    sdp: '...',
    timestamp: 1704834567900
  },

  remoteDescription: {
    type: 'answer',
    sdp: '...',
    timestamp: 1704834568100
  },

  localCandidates: [
    {
      timestamp: 1704834568000,
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host',
      type: 'host',
      protocol: 'udp',
      address: '192.168.1.100',
      port: 54321,
      priority: 2130706431
    },
    {
      timestamp: 1704834568200,
      candidate: 'candidate:2 1 UDP 1694498815 203.0.113.10 54322 typ srflx raddr 192.168.1.100 rport 54321',
      type: 'srflx',  // Server reflexive
      protocol: 'udp',
      address: '203.0.113.10',
      port: 54322,
      priority: 1694498815,
      relatedAddress: '192.168.1.100',
      relatedPort: 54321
    },
    {
      timestamp: 1704834568400,
      candidate: 'candidate:3 1 UDP 16777215 203.0.113.20 3478 typ relay raddr 203.0.113.10 rport 54322',
      type: 'relay',  // TURN relay
      protocol: 'udp',
      address: '203.0.113.20',
      port: 3478,
      priority: 16777215,
      relatedAddress: '203.0.113.10',
      relatedPort: 54322
    }
  ],

  remoteCandidates: [...],

  selectedCandidatePair: {
    local: 'candidate:2 1 UDP 1694498815 203.0.113.10 54322 typ srflx',
    remote: 'candidate:4 1 UDP 1694498815 198.51.100.10 43210 typ srflx',
    state: 'succeeded',
    priority: 9115038255631187455,
    bytesReceived: 1024000,
    bytesSent: 512000
  },

  connectionState: 'connected',
  iceConnectionState: 'connected',
  iceGatheringState: 'complete',
  signalingState: 'stable',

  dataChannels: [
    {
      label: 'chat',
      id: 0,
      protocol: '',
      ordered: true,
      maxRetransmits: null,
      maxPacketLifeTime: null,
      createdAt: 1704834568500
    }
  ],

  statistics: {
    connectionEstablishedAt: 1704834569000,
    connectionDuration: 125000,
    bytesReceived: 5120000,
    bytesSent: 2560000,
    packetsReceived: 3200,
    packetsSent: 1600,
    packetsLost: 12,
    jitter: 0.015,
    roundTripTime: 0.042,
    availableOutgoingBitrate: 2000000,
    availableIncomingBitrate: 3000000
  },

  mediaStreams: [
    {
      id: 'stream_abc123',
      tracks: [
        {
          id: 'track_video_1',
          kind: 'video',
          label: 'camera',
          enabled: true,
          muted: false,
          readyState: 'live',
          frameWidth: 1280,
          frameHeight: 720,
          frameRate: 30,
          codec: 'VP8'
        },
        {
          id: 'track_audio_1',
          kind: 'audio',
          label: 'microphone',
          enabled: true,
          muted: false,
          readyState: 'live',
          sampleRate: 48000,
          channelCount: 2,
          codec: 'opus'
        }
      ]
    }
  ],

  events: [
    { type: 'created', timestamp: 1704834567890 },
    { type: 'setLocalDescription', timestamp: 1704834567900, descriptionType: 'offer' },
    { type: 'icecandidate', timestamp: 1704834568000 },
    { type: 'icegatheringstatechange', timestamp: 1704834568400, state: 'complete' },
    { type: 'setRemoteDescription', timestamp: 1704834568100, descriptionType: 'answer' },
    { type: 'iceconnectionstatechange', timestamp: 1704834569000, state: 'connected' }
  ]
}
```

### Privacy Considerations

1. **IP Address Exposure**: ICE candidates reveal:
   - Local network addresses
   - Public IP addresses
   - TURN server addresses

2. **Media Stream Metadata**: Captures:
   - Camera/microphone labels
   - Resolution and codec information
   - No actual audio/video content

3. **Mitigation**:
   - Clear disclosure of capture
   - Option to redact IP addresses
   - No capture of actual media streams

### Implementation Complexity

- **Effort**: Medium-High (5-7 days)
- **JavaScript Instrumentation**: Medium complexity
- **Stats Parsing**: High complexity (WebRTC stats are extensive)
- **SDP Parsing**: Medium complexity (optional enhancement)

---

## 3. DNS Query Capture

### Technical Overview

DNS resolution in Chromium happens at the network stack level, before HTTP requests. Standard Electron APIs don't expose DNS-level events.

### Implementation Approaches

**Method 1: Chrome Net-Log (RECOMMENDED for Production)**

Chromium's built-in network logging captures DNS:

```javascript
// In main.js before app.ready
const { app, netLog } = require('electron');
const path = require('path');
const fs = require('fs');

// Start net-log capture
app.on('ready', async () => {
  const logPath = path.join(app.getPath('userData'), 'netlogs');

  // Start capturing
  await netLog.startLogging(logPath);

  // Later, stop and process
  app.on('before-quit', async () => {
    await netLog.stopLogging();

    // Parse the net-log JSON file
    const netLogPath = path.join(logPath, 'chrome_net_log.json');
    const netLogData = JSON.parse(fs.readFileSync(netLogPath, 'utf8'));

    // Extract DNS events
    const dnsEvents = netLogData.events.filter(e =>
      e.type === 'HOST_RESOLVER_IMPL_REQUEST' ||
      e.type === 'HOST_RESOLVER_IMPL_JOB'
    );
  });
});
```

**Net-Log DNS Event Structure:**

```json
{
  "source": {
    "id": 123,
    "start_time": "1704834567890",
    "type": "HOST_RESOLVER_IMPL_REQUEST"
  },
  "type": "HOST_RESOLVER_IMPL_REQUEST",
  "params": {
    "host": "example.com",
    "address_family": "ADDRESS_FAMILY_UNSPECIFIED",
    "allow_cached_response": true,
    "is_speculative": false,
    "network_isolation_key": "..."
  },
  "phase": 0,
  "time": "1704834567890"
}
```

**Method 2: Chrome DevTools Protocol (Limited)**

CDP doesn't directly expose DNS events, but you can infer them from request timing:

```javascript
await webContents.debugger.sendCommand('Network.enable');

webContents.debugger.on('message', (event, method, params) => {
  if (method === 'Network.requestWillBeSent') {
    // params.request.url contains the hostname
    // timing.dnsStart and timing.dnsEnd (if available) show DNS timing
    const hostname = new URL(params.request.url).hostname;

    // DNS timing from Resource Timing API (approximate)
    if (params.timing && params.timing.dnsStart >= 0) {
      const dnsQuery = {
        hostname: hostname,
        timestamp: params.wallTime * 1000,
        dnsDuration: params.timing.dnsEnd - params.timing.dnsStart
      };
    }
  }
});
```

**Method 3: System-Level DNS Capture (Advanced)**

Use platform-specific DNS monitoring:

**Linux (using dnsmasq or systemd-resolved):**
```bash
# Monitor systemd-resolved queries
journalctl -u systemd-resolved -f | grep "QUERY"
```

**macOS (using dnscrypt-proxy or local resolver):**
```bash
# Monitor DNS queries via packet capture
sudo tcpdump -i any -n port 53
```

**Windows (using Event Tracing):**
```javascript
// Use native addon to hook into Windows DNS Client ETW events
const { DNSMonitor } = require('./native/dns-monitor.node');

const monitor = new DNSMonitor();
monitor.on('query', (event) => {
  console.log('DNS Query:', event);
});
```

**Method 4: Proxy-Based DNS Capture (MOST PRACTICAL)**

Route DNS through a local proxy that logs queries:

```javascript
const dgram = require('dgram');
const dnsPacket = require('dns-packet');

class DNSProxy {
  constructor(options = {}) {
    this.localPort = options.localPort || 5353;
    this.upstreamDNS = options.upstreamDNS || '8.8.8.8';
    this.upstreamPort = 53;
    this.queries = [];
    this.socket = null;
  }

  start() {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', async (msg, rinfo) => {
      try {
        const query = dnsPacket.decode(msg);

        const queryRecord = {
          id: query.id,
          timestamp: Date.now(),
          clientAddress: rinfo.address,
          clientPort: rinfo.port,
          questions: query.questions.map(q => ({
            name: q.name,
            type: this.getTypeName(q.type),
            class: q.class
          })),
          answers: [],
          duration: 0
        };

        // Forward to upstream DNS
        const upstreamSocket = dgram.createSocket('udp4');
        const startTime = Date.now();

        upstreamSocket.send(msg, this.upstreamPort, this.upstreamDNS, (err) => {
          if (err) {
            console.error('DNS forward error:', err);
            upstreamSocket.close();
          }
        });

        upstreamSocket.on('message', (response) => {
          queryRecord.duration = Date.now() - startTime;

          const decoded = dnsPacket.decode(response);
          queryRecord.answers = decoded.answers.map(a => ({
            name: a.name,
            type: this.getTypeName(a.type),
            class: a.class,
            ttl: a.ttl,
            data: this.formatData(a)
          }));

          this.queries.push(queryRecord);

          // Send response back to client
          this.socket.send(response, rinfo.port, rinfo.address);
          upstreamSocket.close();
        });

        upstreamSocket.on('error', (err) => {
          console.error('Upstream DNS error:', err);
          upstreamSocket.close();
        });

      } catch (error) {
        console.error('DNS packet parse error:', error);
      }
    });

    this.socket.bind(this.localPort);
    console.log(`DNS Proxy listening on port ${this.localPort}`);
  }

  stop() {
    if (this.socket) {
      this.socket.close();
    }
  }

  getQueries(filter = {}) {
    let queries = [...this.queries];

    if (filter.hostname) {
      queries = queries.filter(q =>
        q.questions.some(qu => qu.name.includes(filter.hostname))
      );
    }

    if (filter.type) {
      queries = queries.filter(q =>
        q.questions.some(qu => qu.type === filter.type)
      );
    }

    return queries;
  }

  clearQueries() {
    this.queries = [];
  }

  getTypeName(type) {
    const types = {
      1: 'A',
      2: 'NS',
      5: 'CNAME',
      6: 'SOA',
      12: 'PTR',
      15: 'MX',
      16: 'TXT',
      28: 'AAAA',
      33: 'SRV',
      257: 'CAA'
    };
    return types[type] || `TYPE${type}`;
  }

  formatData(answer) {
    if (answer.type === 'A' || answer.type === 'AAAA') {
      return answer.data;
    } else if (answer.type === 'CNAME' || answer.type === 'NS' || answer.type === 'PTR') {
      return answer.data;
    } else if (answer.type === 'MX') {
      return `${answer.data.priority} ${answer.data.exchange}`;
    } else if (answer.type === 'TXT') {
      return answer.data.join(' ');
    } else if (answer.type === 'SOA') {
      return `${answer.data.mname} ${answer.data.rname}`;
    }
    return JSON.stringify(answer.data);
  }
}

// Configure Electron to use local DNS
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * 127.0.0.1:5353');
```

### Data Structure

```javascript
{
  queryId: 'dns_1704834567890_abc',
  timestamp: 1704834567890,

  request: {
    hostname: 'example.com',
    type: 'A',  // A, AAAA, CNAME, MX, TXT, NS, SOA, etc.
    class: 'IN',
    recursionDesired: true
  },

  response: {
    timestamp: 1704834567920,
    answers: [
      {
        name: 'example.com',
        type: 'A',
        class: 'IN',
        ttl: 3600,
        data: '93.184.216.34'
      }
    ],
    authorities: [
      {
        name: 'example.com',
        type: 'NS',
        class: 'IN',
        ttl: 3600,
        data: 'ns1.example.com'
      }
    ],
    additional: [
      {
        name: 'ns1.example.com',
        type: 'A',
        class: 'IN',
        ttl: 3600,
        data: '192.0.2.1'
      }
    ],
    rcode: 0,  // 0=NOERROR, 1=FORMERR, 2=SERVFAIL, 3=NXDOMAIN
    truncated: false,
    recursionAvailable: true
  },

  timing: {
    queryStartTime: 1704834567890,
    responseReceivedTime: 1704834567920,
    duration: 30
  },

  resolver: {
    server: '8.8.8.8',
    port: 53,
    protocol: 'UDP'
  },

  cached: false,
  fromHosts: false,

  relatedRequestId: 'req_1704834567890_xyz'  // Link to HTTP request
}
```

### Integration with Existing Network Capture

Link DNS queries to HTTP requests:

```javascript
// In NetworkAnalysisManager
setupDNSLinking() {
  this.dnsQueries = new Map(); // hostname -> query data

  // When DNS query completes
  this.dnsProxy.on('query', (query) => {
    const hostname = query.request.hostname;
    this.dnsQueries.set(hostname, query);
  });

  // When HTTP request starts
  this.onBeforeRequestHandler = (details, callback) => {
    const request = this.requestTracker.addRequest({...});

    // Link DNS query
    try {
      const hostname = new URL(details.url).hostname;
      const dnsQuery = this.dnsQueries.get(hostname);
      if (dnsQuery) {
        request.dnsQuery = {
          queryId: dnsQuery.queryId,
          duration: dnsQuery.timing.duration,
          resolvedAddresses: dnsQuery.response.answers
            .filter(a => a.type === 'A' || a.type === 'AAAA')
            .map(a => a.data),
          cached: dnsQuery.cached
        };
      }
    } catch (e) {
      // Invalid URL
    }

    callback({ cancel: false });
  };
}
```

### Privacy Considerations

1. **Hostname Exposure**: DNS queries reveal:
   - All domains accessed
   - Subdomains and CDN usage
   - Timing patterns

2. **No Content Capture**: DNS is metadata only (no page content)

3. **Mitigation**:
   - Optional DNS capture disable
   - Domain filtering/allowlist
   - Automatic cleanup after session

### Implementation Complexity

- **Effort**: Medium-High (5-7 days)
- **Net-Log Parsing**: Low-Medium complexity
- **DNS Proxy**: Medium-High complexity
- **Integration**: Medium complexity

---

## 4. Certificate Chain Extraction

### Technical Overview

The existing system captures basic certificate info but doesn't extract:
- Full certificate chain
- Certificate details (issuer, validity, extensions)
- OCSP/CRL revocation status
- Certificate pinning information

### Implementation Approach

**Method 1: Using session.getCertificate() (RECOMMENDED)**

Electron provides certificate details for secure connections:

```javascript
const { session } = require('electron');

async function extractCertificateChain(webContents, url) {
  return new Promise((resolve, reject) => {
    const hostname = new URL(url).hostname;

    // Get certificate from session
    const certificate = session.defaultSession.getCertificateVerifyProc();

    // Alternative: Hook into certificate error event
    webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      // certificate object contains full chain
      const certInfo = {
        data: certificate.data,
        issuerName: certificate.issuerName,
        subjectName: certificate.subjectName,
        serialNumber: certificate.serialNumber,
        validStart: certificate.validStart,
        validExpiry: certificate.validExpiry,
        fingerprint: certificate.fingerprint
      };

      resolve(certInfo);
    });
  });
}
```

**Method 2: Chrome DevTools Protocol (MORE COMPREHENSIVE)**

CDP provides detailed security info:

```javascript
await webContents.debugger.sendCommand('Network.enable');
await webContents.debugger.sendCommand('Security.enable');

webContents.debugger.on('message', (event, method, params) => {
  if (method === 'Security.securityStateChanged') {
    // params.securityState: 'unknown', 'neutral', 'insecure', 'secure', 'info', 'insecure-broken'
    // params.certificateSecurityState contains certificate details
  }

  if (method === 'Network.responseReceived') {
    const { requestId, response } = params;

    if (response.securityDetails) {
      const certChain = {
        protocol: response.securityDetails.protocol,
        keyExchange: response.securityDetails.keyExchange,
        keyExchangeGroup: response.securityDetails.keyExchangeGroup,
        cipher: response.securityDetails.cipher,
        mac: response.securityDetails.mac,

        certificateId: response.securityDetails.certificateId,
        subjectName: response.securityDetails.subjectName,
        sanList: response.securityDetails.sanList,
        issuer: response.securityDetails.issuer,
        validFrom: response.securityDetails.validFrom,
        validTo: response.securityDetails.validTo,

        signedCertificateTimestampList: response.securityDetails.signedCertificateTimestampList,
        certificateTransparencyCompliance: response.securityDetails.certificateTransparencyCompliance,

        // Get full chain
        encryptedClientHello: response.securityDetails.encryptedClientHello
      };

      // Request certificate details
      webContents.debugger.sendCommand('Security.getCertificateDetails', {
        certificateId: response.securityDetails.certificateId
      }).then(details => {
        // details contains full certificate chain
      });
    }
  }
});
```

**Method 3: Node.js TLS Module (For TLS Inspection)**

For deeper analysis, use Node.js TLS:

```javascript
const tls = require('tls');
const https = require('https');

function inspectCertificateChain(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const options = {
      host: hostname,
      port: port,
      rejectUnauthorized: false,
      requestCert: true,
      agent: false
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate(true);

      const chain = [];
      let current = cert;

      while (current) {
        chain.push({
          subject: current.subject,
          issuer: current.issuer,
          subjectaltname: current.subjectaltname,
          infoAccess: current.infoAccess,

          modulus: current.modulus,
          exponent: current.exponent,
          pubkey: current.pubkey,

          valid_from: current.valid_from,
          valid_to: current.valid_to,
          fingerprint: current.fingerprint,
          fingerprint256: current.fingerprint256,
          fingerprint512: current.fingerprint512,

          serialNumber: current.serialNumber,
          raw: current.raw.toString('base64'),

          ext_key_usage: current.ext_key_usage,
          ext_cert_type: current.ext_cert_type,
          ca: current.ca,

          // Extensions
          basicConstraints: current.ext_keyUsage,
          keyUsage: current.keyUsage,
          extKeyUsage: current.extKeyUsage
        });

        current = current.issuerCertificate;

        // Prevent infinite loop on self-signed
        if (current === cert || !current || current.fingerprint === cert.fingerprint) {
          break;
        }
      }

      socket.end();
      resolve(chain);
    });

    socket.on('error', reject);
  });
}
```

**OCSP Stapling Check:**

```javascript
function checkOCSPStapling(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const options = {
      host: hostname,
      port: port,
      requestOCSP: true,
      rejectUnauthorized: false
    };

    const socket = tls.connect(options, () => {
      const ocspResponse = socket.getOCSPResponse();

      if (ocspResponse) {
        // Parse OCSP response
        const ocsp = require('ocsp');
        ocsp.verify({
          response: ocspResponse
        }, (err, data) => {
          socket.end();

          if (err) {
            resolve({
              stapled: true,
              valid: false,
              error: err.message
            });
          } else {
            resolve({
              stapled: true,
              valid: true,
              certStatus: data.certStatus,  // 'good', 'revoked', 'unknown'
              thisUpdate: data.thisUpdate,
              nextUpdate: data.nextUpdate
            });
          }
        });
      } else {
        socket.end();
        resolve({ stapled: false });
      }
    });

    socket.on('error', reject);
  });
}
```

### Data Structure

```javascript
{
  requestId: 'req_1704834567890_xyz',
  url: 'https://example.com/page',
  hostname: 'example.com',
  timestamp: 1704834567890,

  connection: {
    protocol: 'TLS 1.3',
    cipher: 'TLS_AES_128_GCM_SHA256',
    keyExchange: 'X25519',
    keyExchangeGroup: 'X25519',
    signatureScheme: 'ecdsa_secp256r1_sha256',
    encryptedClientHello: false
  },

  certificateChain: [
    {
      // Leaf certificate (server)
      level: 0,
      subject: {
        C: 'US',
        ST: 'California',
        L: 'Los Angeles',
        O: 'Example Inc',
        CN: 'example.com'
      },
      issuer: {
        C: 'US',
        O: 'Let\'s Encrypt',
        CN: 'R3'
      },

      serialNumber: '03:F5:D2:E6:A1:23:45:67:89:AB:CD:EF',

      validity: {
        notBefore: '2026-01-01T00:00:00.000Z',
        notAfter: '2026-04-01T23:59:59.000Z',
        validDays: 90,
        daysRemaining: 82
      },

      subjectAltNames: [
        'example.com',
        '*.example.com',
        'www.example.com'
      ],

      publicKey: {
        algorithm: 'RSA',
        bits: 2048,
        exponent: 65537,
        modulus: 'C5A2...'
      },

      signature: {
        algorithm: 'sha256WithRSAEncryption',
        value: '3A:B5:...'
      },

      fingerprints: {
        sha1: '5F:AB:...',
        sha256: '8D:2C:...',
        sha512: 'A1:3E:...'
      },

      extensions: {
        keyUsage: ['digitalSignature', 'keyEncipherment'],
        extKeyUsage: ['serverAuth', 'clientAuth'],
        basicConstraints: { ca: false },
        subjectKeyIdentifier: '9A:...',
        authorityKeyIdentifier: 'B2:...',
        authorityInfoAccess: {
          ocsp: 'http://r3.o.lencr.org',
          caIssuers: 'http://r3.i.lencr.org/'
        },
        certificatePolicies: ['2.23.140.1.2.1'],
        crlDistributionPoints: ['http://r3.c.lencr.org/'],

        // CT logs
        signedCertificateTimestamps: [
          {
            version: 1,
            logId: 'pLkJkLQYWBSHuxOizGdwCjw1mAT5G9+443fNDsgN3BA=',
            timestamp: 1704834500000,
            signature: 'A3:B5:...'
          }
        ]
      },

      raw: 'base64_encoded_der_certificate'
    },
    {
      // Intermediate certificate
      level: 1,
      subject: {
        C: 'US',
        O: 'Let\'s Encrypt',
        CN: 'R3'
      },
      issuer: {
        C: 'US',
        O: 'Internet Security Research Group',
        CN: 'ISRG Root X1'
      },
      // ... similar structure
      extensions: {
        basicConstraints: { ca: true, pathLen: 0 }
      }
    },
    {
      // Root certificate
      level: 2,
      subject: {
        C: 'US',
        O: 'Internet Security Research Group',
        CN: 'ISRG Root X1'
      },
      issuer: {
        C: 'US',
        O: 'Internet Security Research Group',
        CN: 'ISRG Root X1'
      },
      selfSigned: true,
      extensions: {
        basicConstraints: { ca: true }
      }
    }
  ],

  validation: {
    trusted: true,
    validChain: true,
    revoked: false,
    expired: false,
    hostname_mismatch: false,
    self_signed: false,
    untrusted_root: false,
    weak_signature: false,

    errors: [],
    warnings: ['Certificate expires in less than 30 days']
  },

  ocsp: {
    checked: true,
    stapled: true,
    status: 'good',  // 'good', 'revoked', 'unknown'
    thisUpdate: '2026-01-09T00:00:00.000Z',
    nextUpdate: '2026-01-16T00:00:00.000Z',
    responderURL: 'http://r3.o.lencr.org'
  },

  certificateTransparency: {
    compliant: true,
    scts: [
      {
        version: 1,
        logId: 'pLkJkLQYWBSHuxOizGdwCjw1mAT5G9+443fNDsgN3BA=',
        logName: 'Google Xenon 2024',
        timestamp: '2026-01-01T00:05:00.000Z',
        verified: true
      }
    ]
  },

  pinning: {
    enforced: false,
    pins: [],
    includeSubdomains: false,
    reportUri: null
  }
}
```

### Privacy Considerations

1. **Public Information**: Certificates are public documents
2. **Hostname Linkage**: Certificate reveals visited domains
3. **No Sensitive Data**: No private keys or session data captured

### Implementation Complexity

- **Effort**: Medium (4-6 days)
- **CDP Integration**: Low-Medium complexity
- **TLS Module**: Medium complexity
- **OCSP Checking**: Medium complexity
- **Parsing/Storage**: Medium complexity

---

## 5. HTTP/2 and HTTP/3 Details

### Technical Overview

Modern web uses HTTP/2 (multiplexed over TLS) and HTTP/3 (multiplexed over QUIC/UDP). Standard APIs don't expose:
- Stream multiplexing details
- Server push events
- QUIC connection information
- Protocol negotiation (ALPN)

### Implementation Approach

**Method 1: Chrome DevTools Protocol (BEST OPTION)**

CDP exposes HTTP/2 and HTTP/3 details:

```javascript
await webContents.debugger.sendCommand('Network.enable');

webContents.debugger.on('message', (event, method, params) => {
  if (method === 'Network.responseReceived') {
    const { response } = params;

    // HTTP/2 details
    if (response.protocol === 'h2' || response.protocol === 'http/2') {
      const http2Info = {
        protocol: 'HTTP/2',
        streamId: response.streamId,

        // Frames received
        headers: response.headers,
        headersText: response.headersText,

        // Server push
        pushPromises: response.pushPromises || [],

        // Timing
        timing: response.timing,

        // Connection
        connectionId: response.connectionId,
        connectionReused: response.connectionReused,

        // Encoded sizes
        encodedDataLength: response.encodedDataLength,
        decodedBodySize: response.decodedBodySize
      };
    }

    // HTTP/3 (QUIC) details
    if (response.protocol === 'h3' || response.protocol === 'http/3') {
      const http3Info = {
        protocol: 'HTTP/3',
        quicVersion: response.quicVersion,

        // QUIC connection
        connectionId: response.connectionId,
        connectionReused: response.connectionReused,

        // 0-RTT
        wasAlternateProtocolAvailable: response.wasAlternateProtocolAvailable,
        wasFetchedViaSpdy: response.wasFetchedViaSpdy,

        // Timing
        timing: response.timing
      };
    }

    // ALPN negotiation
    if (response.securityDetails) {
      const alpn = response.securityDetails.protocol;
      // 'h2', 'h3', 'http/1.1', etc.
    }
  }

  // Server push events
  if (method === 'Network.requestWillBeSent') {
    const { request } = params;

    if (request.isLinkPreload || request.initiator?.type === 'push') {
      const serverPush = {
        requestId: params.requestId,
        pushedUrl: request.url,
        pusherId: request.pusherId,
        timestamp: params.timestamp,
        initiator: request.initiator
      };
    }
  }
});
```

**Method 2: Net-Log for Detailed Analysis**

Net-log captures low-level HTTP/2 and HTTP/3 frames:

```javascript
// Start net-log with HTTP/2 and QUIC events
await netLog.startLogging(logPath, {
  captureMode: 'IncludeSensitive',
  maxFileSize: 100 * 1024 * 1024  // 100MB
});

// Parse net-log for HTTP/2 frames
function parseHTTP2Frames(netLogData) {
  const http2Events = netLogData.events.filter(e =>
    e.type.includes('HTTP2') ||
    e.type.includes('SPDY')
  );

  const streams = new Map();

  for (const event of http2Events) {
    if (event.type === 'HTTP2_SESSION_SEND_HEADERS') {
      // Outgoing request headers
      const streamId = event.params.stream_id;
      if (!streams.has(streamId)) {
        streams.set(streamId, {
          streamId,
          headers: event.params.headers,
          startTime: event.time,
          frames: []
        });
      }
    } else if (event.type === 'HTTP2_SESSION_RECV_HEADERS') {
      // Incoming response headers
      const streamId = event.params.stream_id;
      const stream = streams.get(streamId);
      if (stream) {
        stream.responseHeaders = event.params.headers;
      }
    } else if (event.type === 'HTTP2_SESSION_RECV_DATA') {
      // Data frame received
      const streamId = event.params.stream_id;
      const stream = streams.get(streamId);
      if (stream) {
        stream.frames.push({
          type: 'DATA',
          size: event.params.size,
          timestamp: event.time
        });
      }
    } else if (event.type === 'HTTP2_SESSION_RECV_PUSH_PROMISE') {
      // Server push promise
      const streamId = event.params.stream_id;
      const promisedStreamId = event.params.promised_stream_id;
      const stream = streams.get(streamId);
      if (stream) {
        stream.pushPromises = stream.pushPromises || [];
        stream.pushPromises.push({
          promisedStreamId,
          headers: event.params.headers,
          timestamp: event.time
        });
      }
    }
  }

  return Array.from(streams.values());
}

// Parse net-log for QUIC events
function parseQUICEvents(netLogData) {
  const quicEvents = netLogData.events.filter(e =>
    e.type.includes('QUIC')
  );

  const connections = new Map();

  for (const event of quicEvents) {
    if (event.type === 'QUIC_SESSION') {
      // QUIC connection
      const connectionId = event.params.connection_id;
      connections.set(connectionId, {
        connectionId,
        peer_address: event.params.peer_address,
        quic_version: event.params.quic_version,
        startTime: event.time,
        packets: []
      });
    } else if (event.type === 'QUIC_SESSION_PACKET_SENT') {
      // Packet sent
      const connectionId = event.source.id;
      const conn = connections.get(connectionId);
      if (conn) {
        conn.packets.push({
          direction: 'sent',
          packet_number: event.params.packet_number,
          size: event.params.size,
          timestamp: event.time
        });
      }
    } else if (event.type === 'QUIC_SESSION_PACKET_RECEIVED') {
      // Packet received
      const connectionId = event.source.id;
      const conn = connections.get(connectionId);
      if (conn) {
        conn.packets.push({
          direction: 'received',
          packet_number: event.params.packet_number,
          size: event.params.size,
          timestamp: event.time
        });
      }
    }
  }

  return Array.from(connections.values());
}
```

### Data Structure

**HTTP/2 Stream Details:**

```javascript
{
  requestId: 'req_1704834567890_xyz',
  url: 'https://example.com/api/data',
  protocol: 'HTTP/2',

  connection: {
    connectionId: 42,
    connectionReused: true,
    wasAlternateProtocolAvailable: true,
    negotiatedProtocol: 'h2'
  },

  stream: {
    streamId: 3,
    priority: {
      weight: 220,
      dependsOn: 0,
      exclusive: false
    },

    frames: [
      {
        type: 'HEADERS',
        timestamp: 1704834567890,
        flags: ['END_HEADERS'],
        streamId: 3,
        headers: {
          ':method': 'GET',
          ':scheme': 'https',
          ':authority': 'example.com',
          ':path': '/api/data',
          'user-agent': '...',
          'accept': '*/*'
        },
        encodedSize: 256
      },
      {
        type: 'DATA',
        timestamp: 1704834567920,
        flags: ['END_STREAM'],
        streamId: 3,
        dataLength: 1024,
        encodedSize: 1024
      },
      {
        type: 'HEADERS',
        timestamp: 1704834567950,
        flags: ['END_HEADERS'],
        streamId: 3,
        headers: {
          ':status': '200',
          'content-type': 'application/json',
          'content-length': '2048'
        },
        encodedSize: 128
      },
      {
        type: 'DATA',
        timestamp: 1704834567960,
        flags: ['END_STREAM'],
        streamId: 3,
        dataLength: 2048,
        encodedSize: 2048
      }
    ],

    serverPushes: [
      {
        pushedStreamId: 4,
        pushedUrl: 'https://example.com/styles.css',
        promiseHeaders: {
          ':method': 'GET',
          ':scheme': 'https',
          ':authority': 'example.com',
          ':path': '/styles.css'
        },
        timestamp: 1704834567930
      }
    ]
  },

  compression: {
    requestHeadersSize: 512,
    requestHeadersEncodedSize: 256,
    compressionRatio: 0.5,

    responseHeadersSize: 384,
    responseHeadersEncodedSize: 128,
    compressionRatioResponse: 0.33
  },

  multiplexing: {
    concurrentStreams: 8,
    maxConcurrentStreams: 100,
    streamLifetime: 120
  }
}
```

**HTTP/3 (QUIC) Details:**

```javascript
{
  requestId: 'req_1704834567890_abc',
  url: 'https://example.com/api/data',
  protocol: 'HTTP/3',

  quic: {
    version: 'Q050',
    connectionId: '1a2b3c4d5e6f7890',

    // 0-RTT (zero round-trip time)
    zeroRTT: {
      available: true,
      used: true,
      earlyDataAccepted: true
    },

    // Connection migration
    migration: {
      supported: true,
      migratedPaths: []
    },

    // Congestion control
    congestionControl: {
      algorithm: 'BBR',
      currentCongestionWindow: 32768,
      smoothedRTT: 42,
      minRTT: 38,
      latestRTT: 45
    },

    // Loss recovery
    lossRecovery: {
      packetsLost: 2,
      packetsRetransmitted: 2,
      spuriousLossDetection: 0
    },

    // Flow control
    flowControl: {
      sendWindowSize: 262144,
      receiveWindowSize: 262144,
      streamLimitBidi: 100,
      streamLimitUni: 100
    },

    packets: [
      {
        packetNumber: 1,
        type: 'INITIAL',
        timestamp: 1704834567890,
        size: 1200,
        ackEliciting: true,
        frames: ['CRYPTO', 'PADDING']
      },
      {
        packetNumber: 2,
        type: 'HANDSHAKE',
        timestamp: 1704834567920,
        size: 800,
        ackEliciting: true,
        frames: ['CRYPTO', 'ACK']
      },
      {
        packetNumber: 3,
        type: '1-RTT',
        timestamp: 1704834567950,
        size: 512,
        ackEliciting: true,
        frames: ['STREAM', 'ACK']
      }
    ],

    streams: {
      streamId: 0,
      type: 'bidirectional',
      offset: 0,
      length: 2048,
      fin: true
    }
  },

  altSvc: {
    protocol: 'h3',
    host: 'example.com',
    port: 443,
    maxAge: 86400,
    persist: true
  },

  timing: {
    quicHandshakeStart: 1704834567890,
    quicHandshakeEnd: 1704834567920,
    handshakeDuration: 30,

    firstByteTime: 1704834567950,
    lastByteTime: 1704834567980,

    // 0-RTT timing advantage
    zeroRTTSavings: 30  // milliseconds saved
  }
}
```

### Privacy Considerations

1. **No Sensitive Content**: Protocol metadata only, no payloads
2. **Performance Metrics**: Useful for optimization
3. **Low Privacy Impact**: Similar to HAR files

### Implementation Complexity

- **Effort**: Medium (4-5 days)
- **CDP Integration**: Low-Medium complexity
- **Net-Log Parsing**: High complexity (extensive format)
- **Data Structure Design**: Medium complexity

---

## Implementation Plan

### Phase 19 Development Roadmap

#### Week 1: Foundation & WebSocket Capture

**Day 1-2: Architecture & Data Structures**
- [ ] Design unified forensics data model
- [ ] Create `network-forensics/` directory structure
- [ ] Implement base `ForensicsManager` class
- [ ] Design storage strategy (memory limits, persistence)

**Day 3-5: WebSocket Capture**
- [ ] Implement CDP-based WebSocket monitoring
- [ ] Create `websocket-capture.js` module
- [ ] Add WebSocket frame parser
- [ ] Implement payload redaction options
- [ ] Add WebSocket statistics tracker

**Deliverables:**
- `network-forensics/manager.js`
- `network-forensics/websocket-capture.js`
- Unit tests for WebSocket capture
- WebSocket commands: `start_websocket_capture`, `get_websocket_connections`, `export_websocket_har`

#### Week 2: WebRTC & DNS Capture

**Day 6-8: WebRTC Connection Logging**
- [ ] Implement RTCPeerConnection instrumentation
- [ ] Create `webrtc-capture.js` module
- [ ] Add ICE candidate parser
- [ ] Implement SDP parser (basic)
- [ ] Add WebRTC statistics collector

**Day 9-10: DNS Query Capture**
- [ ] Implement DNS proxy (using `dns-packet`)
- [ ] Create `dns-capture.js` module
- [ ] Integrate with network-analysis manager
- [ ] Add DNS query statistics

**Deliverables:**
- `network-forensics/webrtc-capture.js`
- `network-forensics/dns-capture.js`
- Unit tests for WebRTC and DNS
- WebSocket commands: `start_webrtc_capture`, `get_rtc_connections`, `start_dns_capture`, `get_dns_queries`

#### Week 3: Certificate & HTTP/2/3 Details

**Day 11-13: Certificate Chain Extraction**
- [ ] Implement CDP Security domain integration
- [ ] Create `certificate-extractor.js` module
- [ ] Add OCSP stapling checker
- [ ] Implement certificate validation
- [ ] Add certificate chain parser

**Day 14-15: HTTP/2 and HTTP/3 Details**
- [ ] Implement protocol detection
- [ ] Create `http2-analyzer.js` module
- [ ] Add HTTP/2 stream tracker
- [ ] Add HTTP/3 QUIC parser (net-log based)
- [ ] Implement server push detector

**Deliverables:**
- `network-forensics/certificate-extractor.js`
- `network-forensics/http2-analyzer.js`
- Unit tests
- WebSocket commands: `get_certificate_chain`, `get_http2_streams`, `get_quic_details`

#### Week 4: Integration & Testing

**Day 16-17: Integration with Existing Systems**
- [ ] Integrate with `NetworkAnalysisManager`
- [ ] Add unified export formats
- [ ] Implement forensics dashboard data
- [ ] Add memory management and cleanup

**Day 18-19: Testing & Documentation**
- [ ] Comprehensive integration tests
- [ ] Performance testing (memory usage)
- [ ] Update MCP server with new tools
- [ ] Write user documentation

**Day 20: Final Polish**
- [ ] Bug fixes
- [ ] Code review
- [ ] Performance optimization
- [ ] Release preparation

**Deliverables:**
- Complete Phase 19 implementation
- Updated MCP server
- Documentation
- Test coverage report

### File Structure

```
network-forensics/
├── manager.js                    # Main forensics manager
├── websocket-capture.js          # WebSocket frame capture
├── webrtc-capture.js            # WebRTC connection logging
├── dns-capture.js               # DNS query capture
├── certificate-extractor.js     # TLS certificate analysis
├── http2-analyzer.js            # HTTP/2 and HTTP/3 details
├── storage.js                   # Forensics data storage
└── exporters/
    ├── har-exporter.js          # Extended HAR with WebSocket
    ├── json-exporter.js         # JSON format
    └── pcap-exporter.js         # PCAP format (optional)

websocket/commands/
└── network-forensics-commands.js # New WebSocket commands

mcp/
└── tools/
    └── network_forensics.py     # MCP tools for forensics
```

### WebSocket Commands to Add

```javascript
// WebSocket Capture
'start_websocket_capture'        // Enable WebSocket logging
'stop_websocket_capture'         // Disable WebSocket logging
'get_websocket_connections'      // List all WebSocket connections
'get_websocket_frames'           // Get frames for a connection
'export_websocket_data'          // Export in various formats

// WebRTC Capture
'start_webrtc_capture'           // Enable WebRTC logging
'stop_webrtc_capture'            // Disable WebRTC logging
'get_rtc_connections'            // List all RTC peer connections
'get_rtc_candidates'             // Get ICE candidates for connection
'get_rtc_stats'                  // Get WebRTC statistics

// DNS Capture
'start_dns_capture'              // Enable DNS logging
'stop_dns_capture'               // Disable DNS logging
'get_dns_queries'                // Get DNS query log
'export_dns_data'                // Export DNS data

// Certificate Analysis
'get_certificate_chain'          // Get full certificate chain for URL
'validate_certificate'           // Validate certificate
'check_ocsp_status'              // Check OCSP revocation status
'export_certificates'            // Export certificate data

// HTTP/2 and HTTP/3
'get_http2_streams'              // Get HTTP/2 stream details
'get_server_pushes'              // Get server push events
'get_quic_connections'           // Get QUIC connection details
'export_protocol_stats'          // Export HTTP/2 and HTTP/3 stats

// Unified Forensics
'start_full_forensics'           // Enable all forensics capture
'stop_full_forensics'            // Disable all forensics capture
'get_forensics_status'           // Get capture status for all modules
'export_forensics_report'        // Export comprehensive report
'clear_forensics_data'           // Clear all forensics data
```

### MCP Tools to Add

```python
# In mcp/server.py

@mcp.tool()
async def browser_start_websocket_capture(
    redact_payloads: bool = False
) -> dict:
    """
    Start capturing WebSocket connections and messages.

    Args:
        redact_payloads: If true, only capture metadata (no message payloads)

    Returns:
        Success status and capture configuration
    """

@mcp.tool()
async def browser_get_websocket_connections() -> dict:
    """
    Get all captured WebSocket connections.

    Returns:
        List of WebSocket connections with messages and statistics
    """

@mcp.tool()
async def browser_start_webrtc_capture() -> dict:
    """
    Start capturing WebRTC peer connections.

    Returns:
        Success status
    """

@mcp.tool()
async def browser_get_rtc_connections() -> dict:
    """
    Get all captured WebRTC peer connections.

    Returns:
        List of RTC connections with ICE candidates, streams, and stats
    """

@mcp.tool()
async def browser_start_dns_capture(
    upstream_dns: str = "8.8.8.8"
) -> dict:
    """
    Start capturing DNS queries.

    Args:
        upstream_dns: Upstream DNS server to forward queries to

    Returns:
        Success status and DNS proxy configuration
    """

@mcp.tool()
async def browser_get_dns_queries(
    hostname: str = None
) -> dict:
    """
    Get captured DNS queries.

    Args:
        hostname: Filter by hostname (optional)

    Returns:
        List of DNS queries with responses and timing
    """

@mcp.tool()
async def browser_get_certificate_chain(
    url: str
) -> dict:
    """
    Get full TLS certificate chain for a URL.

    Args:
        url: URL to get certificate chain for

    Returns:
        Complete certificate chain with validation status
    """

@mcp.tool()
async def browser_get_http2_streams(
    url: str = None
) -> dict:
    """
    Get HTTP/2 stream details.

    Args:
        url: Filter by URL (optional)

    Returns:
        HTTP/2 streams with frames and server push events
    """

@mcp.tool()
async def browser_export_forensics_report(
    format: str = "json",
    include_websocket: bool = True,
    include_webrtc: bool = True,
    include_dns: bool = True,
    include_certificates: bool = True,
    include_http2: bool = True
) -> dict:
    """
    Export comprehensive network forensics report.

    Args:
        format: Export format ('json', 'har', 'html')
        include_websocket: Include WebSocket data
        include_webrtc: Include WebRTC data
        include_dns: Include DNS data
        include_certificates: Include certificate data
        include_http2: Include HTTP/2 and HTTP/3 data

    Returns:
        Forensics report in specified format
    """
```

---

## Privacy and Legal Considerations

### Privacy Impact Assessment

| Feature | Privacy Risk | Mitigation |
|---------|--------------|------------|
| WebSocket Messages | **HIGH** - May contain PII, auth tokens, private messages | Payload redaction, opt-in capture, encryption at rest |
| WebRTC ICE Candidates | **MEDIUM** - Exposes local and public IP addresses | IP masking option, clear user consent |
| DNS Queries | **MEDIUM** - Reveals browsing patterns | Query filtering, automatic cleanup |
| Certificates | **LOW** - Public information only | None required |
| HTTP/2 Streams | **LOW** - Protocol metadata only | None required |

### Legal Considerations

1. **User Consent**:
   - Clear disclosure in UI
   - Opt-in by default for sensitive captures (WebSocket payloads, WebRTC)
   - Privacy policy update

2. **Data Retention**:
   - Default: In-memory only (cleared on exit)
   - Optional: Persistent storage with encryption
   - Automatic cleanup after configurable period

3. **Compliance**:
   - GDPR: Right to access, right to deletion
   - CCPA: Data disclosure requirements
   - COPPA: No PII collection from minors

4. **Penetration Testing Context**:
   - Clear documentation that this is for authorized security testing only
   - Warning about legal implications of unauthorized use
   - Best practices for responsible disclosure

### Security Recommendations

1. **Storage**:
   - Encrypt forensics data at rest
   - Use secure file permissions
   - Implement access controls

2. **Export**:
   - Sanitize before export
   - Option to redact sensitive data
   - Secure transfer methods

3. **Access**:
   - Require authentication for forensics access
   - Audit log for forensics data access
   - Rate limiting on exports

---

## Dependencies

### NPM Packages Required

```json
{
  "dependencies": {
    "dns-packet": "^5.6.1",
    "tls": "^0.0.1",
    "ocsp": "^1.2.0"
  }
}
```

### Electron APIs Used

- `debugger` module (CDP)
- `session` module (certificates)
- `netLog` module (net-log capture)
- `webRequest` API (existing)

---

## Performance Considerations

### Memory Impact

| Feature | Memory Usage (per hour) | Mitigation |
|---------|-------------------------|------------|
| WebSocket Frames | ~50-500 MB (high frequency) | Circular buffer, frame limit |
| WebRTC Connections | ~10-50 MB | Connection limit, cleanup |
| DNS Queries | ~5-20 MB | Query limit, TTL-based cleanup |
| Certificates | ~5-10 MB | Cache with LRU eviction |
| HTTP/2 Streams | ~20-100 MB | Stream limit, frame limit |

### CPU Impact

- WebSocket instrumentation: ~2-5% overhead
- WebRTC monitoring: ~1-3% overhead
- DNS proxy: ~1-2% overhead
- Certificate extraction: ~0.5-1% overhead
- HTTP/2 parsing: ~1-3% overhead

**Total estimated overhead: 5.5-14% CPU, 90-680 MB RAM per hour**

### Optimization Strategies

1. **Lazy Initialization**: Only enable modules when needed
2. **Sampling**: Capture subset of high-frequency events
3. **Compression**: Compress old data in memory
4. **Offloading**: Move parsing to worker threads
5. **Streaming**: Stream data to disk for long sessions

---

## Testing Strategy

### Unit Tests

- [ ] WebSocket frame parsing
- [ ] WebRTC candidate parsing
- [ ] DNS packet encoding/decoding
- [ ] Certificate chain validation
- [ ] HTTP/2 frame parsing

### Integration Tests

- [ ] WebSocket capture with real connections
- [ ] WebRTC capture with peer connections
- [ ] DNS capture with actual queries
- [ ] Certificate extraction from HTTPS sites
- [ ] HTTP/2 stream tracking

### Performance Tests

- [ ] Memory usage under load
- [ ] CPU overhead measurement
- [ ] Large WebSocket message handling
- [ ] Many concurrent connections
- [ ] Long-running capture sessions

### Security Tests

- [ ] PII redaction verification
- [ ] Access control enforcement
- [ ] Encryption at rest
- [ ] Export sanitization

---

## Success Metrics

### Functional Completeness

- [ ] All 5 forensics modules implemented
- [ ] 15+ new WebSocket commands
- [ ] 10+ new MCP tools
- [ ] Export in 3+ formats (JSON, HAR, HTML)

### Quality Metrics

- [ ] 80%+ test coverage
- [ ] < 10% CPU overhead
- [ ] < 500 MB memory usage (1 hour session)
- [ ] Zero memory leaks

### Documentation

- [ ] User guide
- [ ] API documentation
- [ ] Privacy documentation
- [ ] Example use cases

---

## Future Enhancements (Phase 20+)

1. **PCAP Export**: Generate packet captures for Wireshark
2. **GraphQL Introspection**: Specialized GraphQL forensics
3. **gRPC Capture**: Capture and decode gRPC streams
4. **Server-Sent Events**: SSE message capture
5. **Request Replay**: Replay captured traffic
6. **Diff Analysis**: Compare forensics between sessions
7. **AI-Powered Analysis**: Anomaly detection in traffic patterns
8. **Timeline Visualization**: Interactive timeline of all network events

---

## References

### Technical Documentation

1. **Chrome DevTools Protocol**
   - Network Domain: https://chromedevtools.github.io/devtools-protocol/tot/Network/
   - Security Domain: https://chromedevtools.github.io/devtools-protocol/tot/Security/

2. **WebSocket Protocol**
   - RFC 6455: https://tools.ietf.org/html/rfc6455
   - Frame format specification

3. **WebRTC Standards**
   - W3C WebRTC API: https://www.w3.org/TR/webrtc/
   - ICE: RFC 8445
   - STUN: RFC 5389
   - TURN: RFC 5766

4. **DNS Protocol**
   - RFC 1035: DNS specification
   - RFC 8484: DNS over HTTPS (DoH)
   - RFC 7858: DNS over TLS (DoT)

5. **TLS/Certificates**
   - RFC 5280: X.509 certificates
   - RFC 6960: OCSP
   - RFC 6962: Certificate Transparency

6. **HTTP/2 and HTTP/3**
   - RFC 7540: HTTP/2
   - RFC 9114: HTTP/3
   - RFC 9000: QUIC

### Related Tools

- **Wireshark**: Network protocol analyzer
- **mitmproxy**: HTTPS proxy with inspection
- **Chrome DevTools**: Browser network inspector
- **HAR Analyzer**: HAR file analysis tools

---

## Conclusion

Phase 19 will transform basset-hound-browser into a comprehensive network forensics platform by adding deep visibility into:

- **WebSocket communications** (bidirectional message logging)
- **WebRTC connections** (peer-to-peer media setup)
- **DNS resolution** (query-level tracking)
- **TLS certificates** (full chain analysis with OCSP)
- **Modern protocols** (HTTP/2 multiplexing, HTTP/3 QUIC)

This forensic capability is critical for:
- Security research and penetration testing
- OSINT investigations
- Performance optimization
- Protocol debugging
- Compliance auditing

The implementation plan balances functionality, performance, and privacy through:
- Modular architecture
- Configurable capture depth
- Memory-efficient storage
- Privacy-preserving options
- Comprehensive testing

**Estimated total development time: 4 weeks (80-100 hours)**

---

*Last Updated: January 9, 2026*
