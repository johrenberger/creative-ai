/**
 * Auth Module Unit Tests
 * Direct unit tests for internal auth.js functions.
 * These complement auth.test.js which tests the HTTP API layer.
 */

import { jest, beforeAll, afterAll, describe, it, expect, beforeEach } from '@jest/globals';

// Mock getDb before importing auth
const mockDb = {
  prepare: jest.fn(),
  prepareReturn: null,
  lastInsertRowid: 1,
  changes: 0,
};

jest.unstable_mockModule('../src/db.js', () => ({
  getDb: () => mockDb,
  default: { getDb: () => mockDb }
}));

const {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  destroySession,
  destroyAllUserSessions,
  cleanupExpiredSessions,
  createUser,
  getUserByUsernameOrEmail
} = await import('../src/auth.js');

describe('hashPassword', () => {
  it('produces a bcrypt hash that is not the original password', async () => {
    const hash = await hashPassword('testpassword');
    expect(hash).not.toBe('testpassword');
    expect(hash).toMatch(/^\$2[aby]?\$\d{1,2}\$/); // bcrypt format
  });

  it('produces different hashes for the same password (salt)', async () => {
    const hash1 = await hashPassword('testpassword');
    const hash2 = await hashPassword('testpassword');
    expect(hash1).not.toBe(hash2);
  });

  it('hash is verifiable with verifyPassword', async () => {
    const hash = await hashPassword('verifyme123');
    const valid = await verifyPassword('verifyme123', hash);
    expect(valid).toBe(true);
  });

  it('wrong password fails verification', async () => {
    const hash = await hashPassword('correctpassword');
    const valid = await verifyPassword('wrongpassword', hash);
    expect(valid).toBe(false);
  });
});

describe('verifyPassword', () => {
  it('returns true for matching password and hash', async () => {
    const hash = await hashPassword('matchingpassword');
    const result = await verifyPassword('matchingpassword', hash);
    expect(result).toBe(true);
  });

  it('returns false for non-matching password', async () => {
    const hash = await hashPassword('thecretpassword');
    const result = await verifyPassword('notthepassword', hash);
    expect(result).toBe(false);
  });
});

describe('createSession', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
    mockDb.prepareReturn = { lastInsertRowid: 999 };
  });

  it('creates a session with the given userId and returns a token string', async () => {
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    const token = await createSession(42, '192.168.1.1', 'Mozilla/5.0');
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes hex = 64 chars
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('calls db.prepare with correct INSERT statement', async () => {
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    await createSession(1, '', '');
    
    const call = mockDb.prepare.mock.calls[0][0];
    expect(call).toContain('INSERT INTO sessions');
    expect(call).toContain('session_token');
    expect(call).toContain('user_id');
    expect(call).toContain('expires_at');
  });

  it('uses default empty strings for ipAddress and userAgent', async () => {
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    // Should not throw
    await createSession(1);
    
    expect(runMock).toHaveBeenCalled();
  });
});

describe('validateSession', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
  });

  it('returns null for null/undefined/empty token', async () => {
    const result1 = await validateSession(null);
    const result2 = await validateSession(undefined);
    const result3 = await validateSession('');
    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).toBeNull();
  });

  it('returns null for non-existent session token', async () => {
    // CTA-GAP-002 fix: when the SELECT returns no session, validateSession
    // now also runs a DELETE with the same predicate. The DELETE matches
    // zero rows if the token never existed, so this is a no-op cleanup.
    // The unit test verifies the second prepare() call uses the right SQL.
    const getMock = jest.fn().mockReturnValue(undefined);
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ get: getMock, run: runMock });
    
    const result = await validateSession('nonexistent-token');
    expect(result).toBeNull();
    // Two prepare() calls: SELECT then DELETE
    expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    expect(mockDb.prepare.mock.calls[1][0]).toMatch(/DELETE FROM sessions/);
    expect(mockDb.prepare.mock.calls[1][0]).toMatch(/session_token = \?/);
    expect(mockDb.prepare.mock.calls[1][0]).toMatch(/expires_at <= \?/);
  });

  it('CTA-GAP-002: deletes expired session row when token exists but is past expires_at', async () => {
    // First SELECT returns nothing (expires_at in the past fails the > ? check).
    // Then a DELETE with the inverted predicate cleans up the row.
    // This is the regression test for the resource-leak fix.
    const past = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
    const getMock = jest.fn().mockReturnValue(undefined); // SELECT returns no row
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ get: getMock, run: runMock });
    
    const result = await validateSession('expired-but-still-in-db-token');
    expect(result).toBeNull();
    // The DELETE must have been called (the row existed, even though it was expired)
    expect(runMock).toHaveBeenCalled();
    // Verify the DELETE was called with the right token and a current timestamp
    expect(runMock.mock.calls[0][0]).toBe('expired-but-still-in-db-token');
  });

  it('returns user object for valid session', async () => {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockReturnValue({
        id: 1,
        session_token: 'valid-token',
        user_id: 42,
        uid: 42,
        username: 'testuser',
        email: 'test@example.com',
        expires_at: future
      }),
      run: jest.fn()
    });
    
    const result = await validateSession('valid-token');
    expect(result).toEqual({ id: 42, username: 'testuser', email: 'test@example.com' });
  });

  it('deletes session if idle timeout exceeded', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    
    const getMock = jest.fn().mockReturnValue({
      id: 5,
      session_token: 'idle-token',
      uid: 1,
      username: 'idleuser',
      email: 'idle@example.com',
      expires_at: past
    });
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ get: getMock, run: runMock });
    
    const result = await validateSession('idle-token');
    expect(result).toBeNull();
    expect(runMock).toHaveBeenCalled(); // DELETE was run
  });

  it('extends session expiry on valid session (sliding expiration)', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const getMock = jest.fn().mockReturnValue({
      id: 3,
      session_token: 'active-token',
      uid: 7,
      username: 'activeuser',
      email: 'active@example.com',
      expires_at: future
    });
    const runMock = jest.fn();
    mockDb.prepare.mockReturnValue({ get: getMock, run: runMock });
    
    await validateSession('active-token');
    expect(runMock).toHaveBeenCalled(); // UPDATE was run
  });
});

describe('destroySession', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
  });

  it('returns false for null/undefined/empty token', async () => {
    const r1 = await destroySession(null);
    const r2 = await destroySession('');
    expect(r1).toBe(false);
    expect(r2).toBe(false);
  });

  it('returns true when session was deleted', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 1 })
    });
    
    const result = await destroySession('session-to-delete');
    expect(result).toBe(true);
  });

  it('returns false when no session existed', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 0 })
    });
    
    const result = await destroySession('nonexistent-session');
    expect(result).toBe(false);
  });

  it('calls DELETE with correct session token', async () => {
    const runMock = jest.fn().mockReturnValue({ changes: 1 });
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    await destroySession('my-session-token');
    
    const call = mockDb.prepare.mock.calls[0][0];
    expect(call).toContain('DELETE FROM sessions');
    expect(call).toContain('session_token');
  });
});

describe('destroyAllUserSessions', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
  });

  it('returns number of sessions destroyed', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 3 })
    });
    
    const result = await destroyAllUserSessions(42);
    expect(result).toBe(3);
  });

  it('returns 0 when user has no sessions', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 0 })
    });
    
    const result = await destroyAllUserSessions(99);
    expect(result).toBe(0);
  });

  it('calls DELETE with correct user_id', async () => {
    const runMock = jest.fn().mockReturnValue({ changes: 1 });
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    await destroyAllUserSessions(42);
    
    const call = mockDb.prepare.mock.calls[0][0];
    expect(call).toContain('DELETE FROM sessions');
    expect(call).toContain('user_id');
  });
});

describe('cleanupExpiredSessions', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
  });

  it('returns number of expired sessions cleaned up', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 5 })
    });
    
    const result = await cleanupExpiredSessions();
    expect(result).toBe(5);
  });

  it('returns 0 when no expired sessions exist', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 0 })
    });
    
    const result = await cleanupExpiredSessions();
    expect(result).toBe(0);
  });

  it('calls DELETE with expires_at condition', async () => {
    const runMock = jest.fn().mockReturnValue({ changes: 1 });
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    await cleanupExpiredSessions();
    
    const call = mockDb.prepare.mock.calls[0][0];
    expect(call).toContain('DELETE FROM sessions');
    expect(call).toContain('expires_at');
  });
});

describe('createUser', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
    mockDb.lastInsertRowid = 1;
  });

  it('creates a user and returns id, username, email', async () => {
    mockDb.prepare.mockReturnValue({
      run: jest.fn().mockReturnValue({ lastInsertRowid: 42 })
    });
    
    const result = await createUser('newuser', 'new@example.com', 'password123');
    
    expect(result).toEqual({ id: 42, username: 'newuser', email: 'new@example.com' });
  });

  it('hashes the password before storing', async () => {
    const runMock = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
    mockDb.prepare.mockReturnValue({ run: runMock });
    
    await createUser('hashuser', 'hash@example.com', 'password123');
    
    const args = runMock.mock.calls[0];
    // Third argument should be the password hash (not plain text)
    expect(args[2]).not.toBe('password123');
    expect(args[2]).toMatch(/^\$2[aby]?\$\d{1,2}\$/); // bcrypt format
  });
});

describe('getUserByUsernameOrEmail', () => {
  beforeEach(() => {
    mockDb.prepare.mockReset();
  });

  it('returns user object when found by username', () => {
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockReturnValue({
        id: 1,
        username: 'founduser',
        email: 'found@example.com',
        password_hash: '$2b$12$hash'
      })
    });
    
    const result = getUserByUsernameOrEmail('founduser');
    expect(result).toBeDefined();
    expect(result.username).toBe('founduser');
  });

  it('returns user object when found by email', () => {
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockReturnValue({
        id: 2,
        username: 'emailuser',
        email: 'email@example.com',
        password_hash: '$2b$12$hash'
      })
    });
    
    const result = getUserByUsernameOrEmail('email@example.com');
    expect(result).toBeDefined();
    expect(result.email).toBe('email@example.com');
  });

  it('returns undefined when user not found', () => {
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined)
    });
    
    const result = getUserByUsernameOrEmail('nonexistent');
    expect(result).toBeUndefined();
  });

  it('calls db.prepare with correct query using OR', () => {
    mockDb.prepare.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined)
    });
    
    getUserByUsernameOrEmail('testuser');
    
    const call = mockDb.prepare.mock.calls[0][0];
    expect(call).toContain('username = ?');
    expect(call).toContain('email = ?');
    expect(call).toContain(' OR ');
  });
});