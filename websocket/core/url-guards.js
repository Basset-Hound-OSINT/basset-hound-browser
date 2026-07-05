// ==========================================
// .onion Domain Detection
// ==========================================

/**
 * Check if a URL is a .onion domain
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is a .onion domain
 */
function isOnionUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.onion');
  } catch {
    // Fallback for malformed URLs - check if .onion appears in the string
    return url.includes('.onion');
  }
}

/**
 * Check if Tor mode is enabled at startup
 * @returns {boolean} True if Tor mode is enabled
 */
function isTorModeEnabled() {
  const args = process.argv;
  return (
    process.env.TOR_MODE === '1' ||
    process.env.TOR_MODE === 'true' ||
    args.includes('--tor-mode')
  );
}

/**
 * Check URL and return error if .onion without Tor mode
 * @param {string} url - The URL to check
 * @returns {Object|null} Error object if .onion without Tor mode, null otherwise
 */
function checkOnionWithoutTor(url) {
  if (isOnionUrl(url) && !isTorModeEnabled()) {
    return {
      success: false,
      error: '.onion domains require TOR_MODE=1 at startup.',
      suggestion: 'Restart with TOR_MODE=1 or --tor-mode flag.',
      url
    };
  }
  return null;
}

/**
 * H-1 SSRF guard.
 *
 * Modeled on the Obscura obscura-net SSRF design
 * (docs/research/obscura/crates/obscura-net.md §3): a single deny-set predicate
 * reused for the literal-host check and the DNS-resolution check "so the literal-host
 * check and the DNS-resolution check can never disagree", IPv4-mapped IPv6 unwrapping,
 * plus env escape hatches that are default-closed / opt-in.
 *
 * Blocks, unless explicitly opted in via env:
 *   - non-http(s) schemes; file:// (opt-in: BASSET_WS_ALLOW_FILE=1)
 *   - loopback, RFC1918, link-local (169.254.0.0/16 incl. 169.254.169.254 cloud
 *     metadata), unspecified/broadcast IPv4; ::1, ::, fc00::/7 (incl. fd00::/8),
 *     fe80::/10 IPv6, incl. IPv4-mapped forms — opt-in: BASSET_WS_ALLOW_PRIVATE_NETWORK=1
 */
function _ssrfEnvFlag(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function _isForbiddenIPv4(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
  if ([a, b, c, d].some(n => n > 255)) return false;
  if (a === 0) return true;                            // 0.0.0.0/8 unspecified
  if (a === 127) return true;                          // loopback 127.0.0.0/8
  if (a === 10) return true;                           // RFC1918 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;    // RFC1918 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // RFC1918 192.168.0.0/16
  if (a === 169 && b === 254) return true;             // link-local 169.254/16 (incl. metadata)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true; // broadcast
  return false;
}

// Parse an IPv6 literal (incl. embedded IPv4 tail and :: compression) to 16 bytes.
// Returns Uint8Array(16) or null. Kept faithful to the Obscura approach of unwrapping
// IPv4-mapped/compatible forms so bracketed hex forms cannot slip past the deny-set.
function _ipv6ToBytes(input) {
  let s = String(input).toLowerCase();
  const pct = s.indexOf('%');
  if (pct !== -1) s = s.slice(0, pct); // strip zone id
  // Fold an embedded dotted-quad IPv4 tail (::ffff:1.2.3.4) into two hex groups.
  const v4m = /:((?:\d{1,3}\.){3}\d{1,3})$/.exec(s);
  if (v4m) {
    const parts = v4m[1].split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n > 255)) return null;
    const g1 = ((parts[0] << 8) | parts[1]).toString(16);
    const g2 = ((parts[2] << 8) | parts[3]).toString(16);
    s = s.slice(0, v4m.index + 1) + g1 + ':' + g2;
  }
  const dbl = s.split('::');
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(':') : [];
  let groups;
  if (dbl.length === 2) {
    const tail = dbl[1] ? dbl[1].split(':') : [];
    const missing = 8 - (head.length + tail.length);
    if (missing < 1) return null;
    groups = head.concat(Array(missing).fill('0'), tail);
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const g = groups[i] === '' ? '0' : groups[i];
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    bytes[i * 2] = (v >> 8) & 0xff;
    bytes[i * 2 + 1] = v & 0xff;
  }
  return bytes;
}

function _isForbiddenIPv6(ip) {
  const b = _ipv6ToBytes(ip);
  if (!b) {
    const a = String(ip).toLowerCase();
    return a === '::1' || a === '::';
  }
  if (b.every(x => x === 0)) return true;                               // :: unspecified
  if (b.slice(0, 15).every(x => x === 0) && b[15] === 1) return true;   // ::1 loopback
  // IPv4-mapped ::ffff:a.b.c.d -> unwrap and re-check v4
  if (b.slice(0, 10).every(x => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return _isForbiddenIPv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // IPv4-compatible ::a.b.c.d (first 12 bytes zero, not :: / ::1)
  if (b.slice(0, 12).every(x => x === 0) && !(b[12] === 0 && b[13] === 0 && b[14] === 0)) {
    return _isForbiddenIPv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  if ((b[0] & 0xfe) === 0xfc) return true;                              // fc00::/7 ULA (incl fd00::/8)
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;             // fe80::/10 link-local
  return false;
}

/**
 * Validate a navigation URL against the SSRF deny-set.
 * @param {string} url
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
async function validateNavigationUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return { allowed: false, reason: `Invalid URL: ${err.message}` };
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  const allowFile = _ssrfEnvFlag('BASSET_WS_ALLOW_FILE');
  const allowPrivate = _ssrfEnvFlag('BASSET_WS_ALLOW_PRIVATE_NETWORK');

  // Scheme allowlist
  if (scheme === 'file') {
    if (!allowFile) {
      return { allowed: false, reason: 'SSRF guard: file:// scheme is blocked. Set BASSET_WS_ALLOW_FILE=1 to permit.' };
    }
    return { allowed: true }; // file:// has no network host to resolve
  }
  if (scheme !== 'http' && scheme !== 'https') {
    return { allowed: false, reason: `SSRF guard: scheme "${scheme}:" is blocked. Only http/https (and opt-in file://) are permitted.` };
  }

  if (allowPrivate) {
    return { allowed: true };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Reject loopback host names by name (Obscura: localhost / *.localhost)
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { allowed: false, reason: `SSRF guard: host "${hostname}" is a loopback name and is blocked. Set BASSET_WS_ALLOW_PRIVATE_NETWORK=1 to permit.` };
  }

  const net = require('net');
  const ipKind = net.isIP(hostname);
  if (ipKind === 4) {
    if (_isForbiddenIPv4(hostname)) {
      return { allowed: false, reason: `SSRF guard: address ${hostname} is in a blocked range (loopback/RFC1918/link-local/metadata). Set BASSET_WS_ALLOW_PRIVATE_NETWORK=1 to permit.` };
    }
    return { allowed: true };
  }
  if (ipKind === 6) {
    if (_isForbiddenIPv6(hostname)) {
      return { allowed: false, reason: `SSRF guard: address ${hostname} is in a blocked range (loopback/ULA/link-local). Set BASSET_WS_ALLOW_PRIVATE_NETWORK=1 to permit.` };
    }
    return { allowed: true };
  }

  // Hostname: resolve and check every returned address (DNS-rebinding defense)
  const dns = require('dns').promises;
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    // Unresolvable host cannot reach an internal service; let navigation fail naturally.
    return { allowed: true };
  }
  for (const a of addresses) {
    if (a.family === 4 && _isForbiddenIPv4(a.address)) {
      return { allowed: false, reason: `SSRF guard: host "${hostname}" resolves to blocked address ${a.address}. Set BASSET_WS_ALLOW_PRIVATE_NETWORK=1 to permit.` };
    }
    if (a.family === 6 && _isForbiddenIPv6(a.address)) {
      return { allowed: false, reason: `SSRF guard: host "${hostname}" resolves to blocked address ${a.address}. Set BASSET_WS_ALLOW_PRIVATE_NETWORK=1 to permit.` };
    }
  }
  return { allowed: true };
}

module.exports = {
  isOnionUrl,
  isTorModeEnabled,
  checkOnionWithoutTor,
  _ssrfEnvFlag,
  _isForbiddenIPv4,
  _ipv6ToBytes,
  _isForbiddenIPv6,
  validateNavigationUrl
};
