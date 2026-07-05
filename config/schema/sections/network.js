/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Network and proxy configuration',
  properties: {
    proxy: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.network.proxy.enabled,
          description: 'Enable proxy'
        }),
        type: field({
          type: Types.STRING,
          default: defaults.network.proxy.type,
          description: 'Proxy type',
          enum: ['http', 'https', 'socks4', 'socks5']
        }),
        host: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.network.proxy.host,
          description: 'Proxy host'
        }),
        port: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.network.proxy.port,
          description: 'Proxy port',
          min: 1,
          max: 65535
        }),
        username: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.network.proxy.username,
          description: 'Proxy username'
        }),
        password: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.network.proxy.password,
          description: 'Proxy password'
        }),
        bypassList: field({
          type: Types.ARRAY,
          default: defaults.network.proxy.bypassList,
          description: 'List of hosts to bypass proxy',
          items: { type: Types.STRING }
        })
      }
    }),
    tor: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.network.tor.enabled,
          description: 'Enable Tor'
        }),
        socksPort: field({
          type: Types.NUMBER,
          default: defaults.network.tor.socksPort,
          description: 'Tor SOCKS port',
          min: 1,
          max: 65535
        }),
        controlPort: field({
          type: Types.NUMBER,
          default: defaults.network.tor.controlPort,
          description: 'Tor control port',
          min: 1,
          max: 65535
        }),
        dataDirectory: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.network.tor.dataDirectory,
          description: 'Tor data directory'
        })
      }
    }),
    proxyChain: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.network.proxyChain.enabled,
          description: 'Enable proxy chain'
        }),
        proxies: field({
          type: Types.ARRAY,
          default: defaults.network.proxyChain.proxies,
          description: 'List of proxies in chain',
          items: { type: Types.OBJECT }
        })
      }
    }),
    throttling: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.network.throttling.enabled,
          description: 'Enable network throttling'
        }),
        preset: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.network.throttling.preset,
          description: 'Throttling preset',
          enum: [null, 'slow3G', 'fast3G', '4G', 'offline', 'custom']
        }),
        download: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.network.throttling.download,
          description: 'Download speed in bytes/second'
        }),
        upload: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.network.throttling.upload,
          description: 'Upload speed in bytes/second'
        }),
        latency: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.network.throttling.latency,
          description: 'Network latency in milliseconds'
        })
      }
    }),
    interception: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.network.interception.enabled,
          description: 'Enable request interception'
        }),
        blockAds: field({
          type: Types.BOOLEAN,
          default: defaults.network.interception.blockAds,
          description: 'Block advertisements'
        }),
        blockTrackers: field({
          type: Types.BOOLEAN,
          default: defaults.network.interception.blockTrackers,
          description: 'Block trackers'
        }),
        blockImages: field({
          type: Types.BOOLEAN,
          default: defaults.network.interception.blockImages,
          description: 'Block images'
        }),
        customRules: field({
          type: Types.ARRAY,
          default: defaults.network.interception.customRules,
          description: 'Custom interception rules',
          items: { type: Types.OBJECT }
        })
      }
    }),
    certificates: field({
      type: Types.OBJECT,
      properties: {
        ignoreCertificateErrors: field({
          type: Types.BOOLEAN,
          default: defaults.network.certificates.ignoreCertificateErrors,
          description: 'Ignore certificate errors'
        }),
        clientCertificates: field({
          type: Types.ARRAY,
          default: defaults.network.certificates.clientCertificates,
          description: 'Client certificates',
          items: { type: Types.OBJECT }
        })
      }
    }),
    headers: field({
      type: Types.OBJECT,
      properties: {
        customHeaders: field({
          type: Types.OBJECT,
          default: defaults.network.headers.customHeaders,
          description: 'Custom headers to add'
        }),
        removeHeaders: field({
          type: Types.ARRAY,
          default: defaults.network.headers.removeHeaders,
          description: 'Headers to remove',
          items: { type: Types.STRING }
        }),
        acceptLanguage: field({
          type: Types.STRING,
          default: defaults.network.headers.acceptLanguage,
          description: 'Accept-Language header value'
        }),
        acceptEncoding: field({
          type: Types.STRING,
          default: defaults.network.headers.acceptEncoding,
          description: 'Accept-Encoding header value'
        })
      }
    })
  }
});
