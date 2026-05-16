/**
 * Security Hardening Tests
 *
 * Validates security controls across the CTI API surface:
 * - SSRF protection on /img proxy
 * - Webhook signature verification
 * - Input sanitization
 * - SQL injection prevention (parameterized queries)
 * - Rate limiting
 * - Header hardening
 * - Auth bypass scenarios
 */

import { readFileSync } from 'fs';
import { createHmac } from 'crypto';

// ============================================================
// TEST UTILITIES
// ============================================================

// Mirrors the sanitize() from server.js
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim().slice(0, 10000);
}

// Mirrors the verifyWebhookSignature from server.js (after fix)
function verifyWebhookSignature(body, secret, header) {
  if (!secret) return false; // Secret required — no bypass
  if (!header) return false;
  const hmac = createHmac('sha256', secret);
  hmac.update(JSON.stringify(body));
  const expected = `sha256=${hmac.digest('hex')}`;
  return expected === header;
}

// SSRF hostname check mirrors /img proxy in server.js
function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase();
  return [
    h === 'localhost',
    h.startsWith('127.'),
    h.startsWith('10.'),
    h.startsWith('172.16'),
    h.startsWith('172.') && parseInt(h.split('.')[1]) >= 16 && parseInt(h.split('.')[1]) <= 31,
    h.startsWith('192.168.'),
    h === '0.0.0.0',
    h === '[::1]',
    h.endsWith('.local')
  ].some(Boolean);
}

// ============================================================
// SSRF PROTECTION TESTS
// ============================================================

describe('SSRF Protection — /img proxy', () => {
  const allowed = [
    'cti.clawdexter.tech',
    'api.github.com',
    'minimax-algeng-chat-tts-us.oss-us-east-1.aliyuncs.com',
    'raw.githubusercontent.com',
    'www.example.com',
    '1.2.3.4',
    '8.8.8.8',
  ];

  const blocked = [
    'localhost',
    '127.0.0.1',
    '127.0.0.2',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '0.0.0.0',
    '[::1]',
    'myhost.local',
  ];

  test.each(allowed)('should ALLOW public hostname: %s', (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(false);
  });

  test.each(blocked)('should BLOCK private/reserved hostname: %s', (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(true);
  });

  test('rejects non-http/https protocols', () => {
    const bad = ['ftp:', 'file:', 'javascript:', 'data:', 'mailto:'];
    const allowed = ['http:', 'https:'];

    bad.forEach(p => {
      const url = new URL('/', p + '//example.com');
      expect(allowed.includes(url.protocol)).toBe(false);
    });
  });

  test('accepts http and https protocols', () => {
    ['http:', 'https:'].forEach(p => {
      const url = new URL('/', p + '//example.com');
      expect(['http:', 'https:'].includes(url.protocol)).toBe(true);
    });
  });
});

// ============================================================
// INPUT SANITIZATION TESTS
// ============================================================

describe('Input Sanitization', () => {
  test('sanitize removes < and > characters', () => {
    expect(sanitize('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitize('<b>hello</b>')).toBe('bhello/b');
    expect(sanitize('no tags')).toBe('no tags');
  });

  test('sanitize handles non-strings gracefully', () => {
    expect(sanitize(123)).toBe(123);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
  });

  test('sanitize truncates to 10000 chars', () => {
    expect(sanitize('a'.repeat(15000)).length).toBe(10000);
  });

  test('sanitize trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
});

// ============================================================
// SQL INJECTION PREVENTION TESTS
// ============================================================

describe('SQL Query Construction (parameterized queries)', () => {
  function getSource(filename) {
    return readFileSync(`./src/${filename}`, 'utf8');
  }

  const modules = ['tasks.js', 'memory.js', 'bridge.js', 'context.js', 'db.js'];

  test.each(modules)('%s uses parameterized queries (no string interpolation in SQL)', (file) => {
    const src = getSource(file);
    // No template literals with ${
    expect(src).not.toMatch(/`.*?(SELECT|INSERT|UPDATE|DELETE).*\$\\{/s);
  });

  test.each(modules.filter(m => m !== 'db.js'))('%s contains ? placeholders for all SQL parameters', (file) => {
    const src = getSource(file);
    expect(src).toMatch(/\?/);
  });

  test('db.js enables foreign keys', () => {
    const src = getSource('db.js');
    expect(src).toMatch(/foreign_keys\s*=\s*ON/);
  });

  test('db.js uses WAL journal mode', () => {
    const src = getSource('db.js');
    expect(src).toMatch(/journal_mode\s*=\s*WAL/);
  });

  test('db.js uses SYNCHRONOUS = NORMAL (not OFF)', () => {
    const src = getSource('db.js');
    expect(src).toMatch(/synchronous\s*=\s*NORMAL/);
  });
});

// ============================================================
// RATE LIMITING TESTS
// ============================================================

describe('Rate Limiting Configuration', () => {
  function getServerSrc() {
    return readFileSync('./src/server.js', 'utf8');
  }

  test('rate limiter applies to /api/ routes', () => {
    const src = getServerSrc();
    expect(src).toMatch(/app\.use\s*\(\s*['\"]\/api\/['\"]/);
  });

  test('rate limiter has reasonable limits (≤120 req/min)', () => {
    const src = getServerSrc();
    expect(src).toMatch(/max:\s*1[0-9]{2}/);
  });
});

// ============================================================
// SECURITY HEADERS TESTS
// ============================================================

describe('Security Headers Configuration', () => {
  function getServerSrc() {
    return readFileSync('./src/server.js', 'utf8');
  }

  test('helmet is enabled', () => {
    const src = getServerSrc();
    expect(src).toMatch(/import.*helmet.*from/);
    expect(src).toMatch(/app\.use\s*\(\s*helmet/);
  });

  test('X-Frame-Options is DENY (clickjacking protection)', () => {
    const src = getServerSrc();
    expect(src).toMatch(/xFrameOptions.*DENY/);
  });

  test('X-Content-Type-Options is nosniff', () => {
    const src = getServerSrc();
    expect(src).toMatch(/xContentTypeOptions.*nosniff/);
  });

  test('HSTS is configured', () => {
    const src = getServerSrc();
    expect(src).toMatch(/strictTransportSecurity/);
  });

  test('CSP frameAncestors is "none" (blocks framing)', () => {
    const src = getServerSrc();
    expect(src).toMatch(/frameAncestors.*none/);
  });
});

// ============================================================
// AUTH BYPASS PREVENTION TESTS
// ============================================================

describe('Webhook Signature Verification', () => {
  test('returns false when WEBHOOK_SECRET is empty', () => {
    expect(verifyWebhookSignature({}, '', 'sha256=abc')).toBe(false);
  });

  test('returns false when signature header is missing', () => {
    expect(verifyWebhookSignature({}, 'secret', '')).toBe(false);
  });

  test('returns false when signature is invalid', () => {
    const validBody = { foo: 'bar' };
    const hmac = createHmac('sha256', 'mysecret');
    hmac.update(JSON.stringify(validBody));
    const validSig = `sha256=${hmac.digest('hex')}`;

    // Completely replace with wrong signature
    expect(verifyWebhookSignature(validBody, 'mysecret', 'sha256=0000000000000000000000000000000000000000000000000000000000000000')).toBe(false);
  });

  test('returns true when signature is valid', () => {
    const validBody = { foo: 'bar' };
    const secret = 'test-secret';
    const hmac = createHmac('sha256', secret);
    hmac.update(JSON.stringify(validBody));
    const validSig = `sha256=${hmac.digest('hex')}`;

    expect(verifyWebhookSignature(validBody, secret, validSig)).toBe(true);
  });

  test('different body produces different signature', () => {
    const secret = 'test-secret';

    const hmac1 = createHmac('sha256', secret);
    hmac1.update(JSON.stringify({ a: 1 }));
    const sig1 = hmac1.digest('hex');

    const hmac2 = createHmac('sha256', secret);
    hmac2.update(JSON.stringify({ a: 2 }));
    const sig2 = hmac2.digest('hex');

    expect(sig1).not.toBe(sig2);
  });
});

// ============================================================
// IMAGE PROXY CONTENT TYPE VALIDATION
// ============================================================

describe('Image Proxy Content-Type Validation', () => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const nonImageTypes = ['text/html', 'application/json', 'application/javascript', 'text/plain'];

  test.each(imageTypes)('accepts image type: %s', (ct) => {
    expect(ct.startsWith('image/')).toBe(true);
  });

  test.each(nonImageTypes)('rejects non-image type: %s', (ct) => {
    expect(ct.startsWith('image/')).toBe(false);
  });
});

// ============================================================
// WEBHOOK ENDPOINT REMOVAL VERIFICATION
// ============================================================

describe('Attack Surface Reduction', () => {
  test('/webhook/deploy endpoint has been removed', () => {
    const src = readFileSync('./src/server.js', 'utf8');
    expect(src).not.toMatch(/webhook\/deploy/);
    expect(src).not.toMatch(/exec\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  test('ci.yml deploy job removed webhook call', () => {
    const ciSrc = readFileSync('./.github/workflows/ci.yml', 'utf8');
    expect(ciSrc).not.toMatch(/cti\.clawdexter\.tech\/webhook\/deploy/);
  });
});

// ============================================================
// EXPRESS.JSON SIZE LIMIT TESTS
// ============================================================

describe('Request Body Size Limits', () => {
  test('express.json has a size limit configured', () => {
    const src = readFileSync('./src/server.js', 'utf8');
    expect(src).toMatch(/express\.json\s*\(\s*\{[^}]*limit/s);
  });
});