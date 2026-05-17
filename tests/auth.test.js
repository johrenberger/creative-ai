/**
 * Authentication Tests
 * Tests for login, logout, session management, password handling.
 */

import { jest, beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import request from 'supertest';

let app, closeDatabase;

beforeAll(async () => {
  process.env.CTI_DB_PATH = ':memory:';
  const serverModule = await import('../src/server.js');
  app = serverModule.app;
  closeDatabase = serverModule.closeDatabase;

  const db = await import('../src/db.js');
  db.initializeDatabase();
});

// ============================================================
// REGISTRATION
// ============================================================

describe('POST /api/auth/register', () => {
  it('registers a new user with 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@example.com', password: 'securepassword123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('username', 'testuser');
    expect(res.body).toHaveProperty('email', 'test@example.com');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'securepassword123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('username');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'securepassword123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('email');
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('8 characters');
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'notanemail', password: 'securepassword123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('email');
  });

  it('returns 409 when username already exists', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicateuser', email: 'first@example.com', password: 'securepassword123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicateuser', email: 'second@example.com', password: 'securepassword123' });
    expect(res.status).toBe(409);
  });
});

// ============================================================
// LOGIN
// ============================================================

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'logintest', email: 'login@example.com', password: 'testpassword123' });
  });

  it('logs in with valid credentials and sets session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'testpassword123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'logintest');
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('session_id=');
    expect(cookie).toContain('HttpOnly');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid credentials');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'somepassword' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'testpassword123' });
    expect(res.status).toBe(400);
  });
});

// ============================================================
// SESSION
// ============================================================

describe('GET /api/auth/session', () => {
  it('returns authenticated: false with no session cookie', async () => {
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('authenticated', false);
  });

  it('returns authenticated: false for invalid session cookie', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Cookie', 'session_id=invalidtoken123');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('authenticated', false);
  });
});

// ============================================================
// LOGOUT
// ============================================================

describe('POST /api/auth/logout', () => {
  it('returns success even with no session', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('clears session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'session_id=testtoken');
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('session_id=');
    // Express clearCookie uses Expires= epoch instead of Max-Age=0
    expect(cookie).toMatch(/Max-Age=0|Expires=.*1970/);
  });
});

// ============================================================
// PROTECTED ROUTES
// ============================================================

describe('Protected route enforcement', () => {
  it('GET /api/tasks returns 401 without session', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('POST /api/tasks returns 401 without session', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test task' });
    expect(res.status).toBe(401);
  });

  it('GET /api/context returns 401 without session', async () => {
    const res = await request(app).get('/api/context');
    expect(res.status).toBe(401);
  });

  it('POST /api/memory returns 401 without session', async () => {
    const res = await request(app)
      .post('/api/memory')
      .send({ content: 'Test memory' });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// FULL AUTH FLOW (login → use → logout → verify invalid)
// ============================================================

describe('Full auth flow', () => {
  it('complete flow: register → login → access protected route → logout → denied', async () => {
    // Register
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'flowtest', email: 'flow@example.com', password: 'flowpassword123' });
    expect(reg.status).toBe(201);

    // Login
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'flowtest', password: 'flowpassword123' });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'][0];

    // Access protected route with session
    const tasks = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookie);
    expect(tasks.status).toBe(200);

    // Logout
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(logout.status).toBe(200);

    // Try to access protected route after logout — should fail
    const clearedCookie = logout.headers['set-cookie'][0];
    const tasksAfterLogout = await request(app)
      .get('/api/tasks')
      .set('Cookie', clearedCookie);
    expect(tasksAfterLogout.status).toBe(401);
  });
});