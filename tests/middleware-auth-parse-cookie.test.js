/**
 * parseSessionCookie Unit Tests (AUTO-GENERATED as part of CTA-GAP-005 refactor)
 *
 * Generated for: component-test-generation follow-up
 * Run: fix/cta-gap-005-parseSessionCookie-refactor
 * Source: src/middleware/auth.js
 *
 * Why this file exists:
 *   After exporting parseSessionCookie from src/middleware/auth.js, we need
 *   unit tests that exercise the function directly (not through the HTTP
 *   boundary). The existing tests/middleware-auth.test.js mocks the auth module
 *   via jest.unstable_mockModule, which doesn't work for testing the
 *   un-mocked exported function. This file is a separate suite that imports
 *   parseSessionCookie as a real module and tests it in isolation.
 *
 * If you change the regex in parseSessionCookie, this file is your canary.
 */

import { describe, it, expect } from '@jest/globals';
import { parseSessionCookie } from '../src/middleware/auth.js';

describe('parseSessionCookie (exported, CTA-GAP-005 refactor)', () => {
  it('returns null for null/empty/undefined header', () => {
    expect(parseSessionCookie(null)).toBeNull();
    expect(parseSessionCookie('')).toBeNull();
    expect(parseSessionCookie(undefined)).toBeNull();
  });

  it('extracts session_id from a cookie string with only that key', () => {
    expect(parseSessionCookie('session_id=abc123')).toBe('abc123');
  });

  it('extracts session_id when there are other cookies before it', () => {
    expect(parseSessionCookie('theme=dark; session_id=abc123')).toBe('abc123');
  });

  it('extracts session_id when there are other cookies after it', () => {
    expect(parseSessionCookie('session_id=abc123; locale=en-US')).toBe('abc123');
  });

  it('handles whitespace around semicolons', () => {
    expect(parseSessionCookie('theme=dark; session_id=abc123; locale=en')).toBe('abc123');
    expect(parseSessionCookie('theme=dark;session_id=abc123;locale=en')).toBe('abc123');
  });

  it('returns null when no session_id key is present', () => {
    expect(parseSessionCookie('theme=dark; locale=en-US')).toBeNull();
  });

  it('returns empty string when session_id= is empty (preserves falsy value)', () => {
    // parseSessionCookie returns match[1] which is "" for session_id=
    // The downstream consumer (requireAuth in middleware/auth.js) handles
    // this with an explicit empty-string check before calling validateSession.
    expect(parseSessionCookie('session_id=')).toBe('');
  });

  it('preserves URL-encoded characters in the token value', () => {
    // Tokens are hex strings, but the parser is permissive; any chars are valid
    // until the next semicolon.
    expect(parseSessionCookie('session_id=abc%20def%20ghi')).toBe('abc%20def%20ghi');
  });
});
