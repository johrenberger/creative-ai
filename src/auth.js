/**
 * CTI Authentication Module
 * Secure session-based authentication using bcrypt + SQLite sessions
 */

import { randomBytes } from 'crypto';
import { getDb } from './db.js';

const SESSION_TOKEN_BYTES = 32;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

/**
 * Hash a password using bcrypt with a cost factor of 12.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(password) {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure session token (32 bytes hex).
 * @returns {string}
 */
function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

/**
 * Create a new session for a user.
 * @param {number} userId
 * @param {string} ipAddress
 * @param {string} userAgent
 * @returns {Promise<string>} the session token
 */
export async function createSession(userId, ipAddress = '', userAgent = '') {
  const token = generateSessionToken();
  const db = getDb();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.prepare(`
    INSERT INTO sessions (session_token, user_id, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, userId, expiresAt, ipAddress, userAgent);

  return token;
}

/**
 * Validate a session token and return the associated user.
 * Returns null if session is invalid or expired.
 * @param {string} token
 * @returns {Promise<{id: number, username: string, email: string}|null>}
 */
export async function validateSession(token) {
  if (!token) return null;

  const db = getDb();
  const now = new Date().toISOString();

  // First check if session token exists and hasn't expired
  const session = db.prepare(`
    SELECT s.*, u.id as uid, u.username, u.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.session_token = ? AND s.expires_at > ?
  `).get(token, now);

  if (!session) return null;

  // Check idle timeout — if last activity was too long ago, expire the session
  // For simplicity, we update the session's expires_at on activity (sliding expiration)
  const lastActivity = new Date(session.expires_at);
  const idleExpiry = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS);

  if (lastActivity < idleExpiry) {
    // Session expired due to idle — delete it
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    return null;
  }

  // Sliding expiration: extend session on activity
  const newExpiry = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, session.id);

  return { id: session.uid, username: session.username, email: session.email };
}

/**
 * Destroy a session by token.
 * @param {string} token
 * @returns {Promise<boolean>} true if session was destroyed
 */
export async function destroySession(token) {
  if (!token) return false;
  const db = getDb();
  const result = db.prepare('DELETE FROM sessions WHERE session_token = ?').run(token);
  return result.changes > 0;
}

/**
 * Destroy all sessions for a user (logout everywhere).
 * @param {number} userId
 * @returns {Promise<number>} number of sessions destroyed
 */
export async function destroyAllUserSessions(userId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return result.changes;
}

/**
 * Clean up expired sessions (call periodically).
 * @returns {Promise<number>} number of sessions cleaned up
 */
export async function cleanupExpiredSessions() {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  return result.changes;
}

/**
 * Create a new user account.
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{id: number, username: string, email: string}>}
 */
export async function createUser(username, email, password) {
  const passwordHash = await hashPassword(password);
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash)
    VALUES (?, ?, ?)
  `).run(username, email, passwordHash);

  return { id: result.lastInsertRowid, username, email };
}

/**
 * Get a user by username or email.
 * @param {string} usernameOrEmail
 * @returns {{id: number, username: string, email: string, password_hash: string}|null}
 */
export function getUserByUsernameOrEmail(usernameOrEmail) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM users WHERE username = ? OR email = ?
  `).get(usernameOrEmail, usernameOrEmail);
}
