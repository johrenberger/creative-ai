/**
 * Authentication Middleware
 * Protects routes that require a valid session.
 */

import { validateSession } from '../auth.js';

/**
 * Express middleware that requires a valid session.
 * Reads session token from Cookie header.
 * Attaches req.user = {id, username, email} if valid.
 * Returns 401 if missing/invalid, otherwise calls next().
 */
export function requireAuth(req, res, next) {
  const token = parseSessionCookie(req.headers.cookie || '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  validateSession(token).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    req.user = user;
    next();
  }).catch(_err => {
    res.status(500).json({ error: 'Authentication error' });
  });
}

/**
 * Optional auth middleware — attaches user if valid session exists, but doesn't block.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(req, res, next) {
  const token = parseSessionCookie(req.headers.cookie || '');

  if (!token) {
    return next();
  }

  validateSession(token).then(user => {
    if (user) {
      req.user = user;
    }
    next();
  }).catch(() => next());
}

/**
 * Parse session_token from Cookie header string.
 * @param {string} cookieHeader
 * @returns {string|null}
 */
function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session_id=([^;]*)/);
  return match ? match[1] : null;
}
