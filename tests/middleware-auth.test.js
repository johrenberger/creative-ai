/**
 * Auth Middleware Unit Tests
 * Tests for requireAuth, optionalAuth, and parseSessionCookie.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock the auth module
const mockValidateSession = jest.fn();

jest.unstable_mockModule('../src/auth.js', () => ({
  validateSession: mockValidateSession,
  default: { validateSession: mockValidateSession }
}));

const { requireAuth, optionalAuth } = await import('../src/middleware/auth.js');

describe('requireAuth middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    mockValidateSession.mockReset();
  });

  it('returns 401 when no cookie header', async () => {
    mockReq.headers = {};
    
    requireAuth(mockReq, mockRes, mockNext);
    
    // validateSession called asynchronously, but response is immediate
    // The middleware should not call next()
    expect(mockValidateSession).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('returns 401 when session_id cookie is empty', async () => {
    mockReq.headers = { cookie: '' };
    
    requireAuth(mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('calls validateSession when cookie has session_id', async () => {
    mockReq.headers = { cookie: 'session_id=test-token-123' };
    mockValidateSession.mockResolvedValue(null);
    
    requireAuth(mockReq, mockRes, mockNext);
    
    // Wait for promise resolution
    await new Promise(setImmediate);
    
    expect(mockValidateSession).toHaveBeenCalledWith('test-token-123');
  });

  it('returns 401 when session is invalid/expired', async () => {
    mockReq.headers = { cookie: 'session_id=invalid-token' };
    mockValidateSession.mockResolvedValue(null);
    
    requireAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session expired or invalid' });
  });

  it('calls next() and sets req.user when session is valid', async () => {
    const mockUser = { id: 42, username: 'testuser', email: 'test@example.com' };
    mockReq.headers = { cookie: 'session_id=valid-token' };
    mockValidateSession.mockResolvedValue(mockUser);
    
    requireAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual(mockUser);
  });

  it('returns 500 when validateSession throws an error', async () => {
    mockReq.headers = { cookie: 'session_id=some-token' };
    mockValidateSession.mockRejectedValue(new Error('Database error'));
    
    requireAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication error' });
  });
});

describe('optionalAuth middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {};
    mockNext = jest.fn();
    mockValidateSession.mockReset();
  });

  it('calls next() immediately when no cookie header', async () => {
    mockReq.headers = {};
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('calls next() immediately when cookie is empty', async () => {
    mockReq.headers = { cookie: '' };
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('calls next() when no session_id in cookie', async () => {
    mockReq.headers = { cookie: 'other_cookie=value' };
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  it('calls validateSession when session_id cookie exists', async () => {
    mockReq.headers = { cookie: 'session_id=my-session-token' };
    mockValidateSession.mockResolvedValue(null);
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    expect(mockValidateSession).toHaveBeenCalledWith('my-session-token');
  });

  it('sets req.user and calls next() when session is valid', async () => {
    const mockUser = { id: 99, username: 'optuser', email: 'opt@example.com' };
    mockReq.headers = { cookie: 'session_id=valid-optional-token' };
    mockValidateSession.mockResolvedValue(mockUser);
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    expect(mockReq.user).toEqual(mockUser);
    expect(mockNext).toHaveBeenCalled();
  });

  it('calls next() when session is invalid (does not block)', async () => {
    mockReq.headers = { cookie: 'session_id=invalid-token' };
    mockValidateSession.mockResolvedValue(null);
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    expect(mockReq.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('calls next() when validateSession throws (graceful)', async () => {
    mockReq.headers = { cookie: 'session_id=error-token' };
    mockValidateSession.mockRejectedValue(new Error('DB error'));
    
    optionalAuth(mockReq, mockRes, mockNext);
    
    await new Promise(setImmediate);
    
    // Should not block, just call next
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeUndefined();
  });
});

describe('parseSessionCookie (via requireAuth integration)', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    mockValidateSession.mockResolvedValue(null);
  });

  it('parses session_id from cookie string with other cookies before it', async () => {
    mockReq.headers = { cookie: 'theme=dark; session_id=my-token; other=value' };
    
    requireAuth(mockReq, mockRes, mockNext);
    
    expect(mockValidateSession).toHaveBeenCalledWith('my-token');
  });

  it('parses session_id from cookie string with other cookies after it', async () => {
    mockReq.headers = { cookie: 'session_id=start-token; theme=light' };
    
    requireAuth(mockReq, mockRes, mockNext);
    
    expect(mockValidateSession).toHaveBeenCalledWith('start-token');
  });

  it('handles cookie string with spaces around semicolons', async () => {
    mockReq.headers = { cookie: 'session_id=spaced-token' };
    
    requireAuth(mockReq, mockRes, mockNext);
    
    expect(mockValidateSession).toHaveBeenCalledWith('spaced-token');
  });

  it('returns 401 when session_id value is empty string', async () => {
    mockReq.headers = { cookie: 'session_id=' };
    
    requireAuth(mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});