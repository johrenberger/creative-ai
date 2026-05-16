/**
 * SQL Query Validation Tests
 * 
 * These tests actually execute the SQL queries against an in-memory SQLite DB
 * to verify query syntax and schema assumptions.
 */

import Database from 'better-sqlite3';
import { jest } from '@jest/globals';

let db;

beforeAll(() => {
  db = new Database(':memory:');
});

afterAll(() => {
  db.close();
});

describe('SQL Query Validation', () => {
  
  describe('tasks table schema', () => {
    beforeAll(() => {
      db.exec(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          priority INTEGER DEFAULT 5,
          urgency INTEGER DEFAULT 5,
          project TEXT,
          tags TEXT,
          created_by TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
    });

    it('should query tasks by status with single quotes', () => {
      const stmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending' AND urgency >= 8");
      const result = stmt.get();
      expect(result.count).toBe(0);
    });

    it('should group tasks by status', () => {
      const stmt = db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status');
      const result = stmt.all();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should insert and query a task', () => {
      db.prepare(`
        INSERT INTO tasks (id, title, status, urgency)
        VALUES (?, ?, ?, ?)
      `).run('test-1', 'Test Task', 'pending', 9);
      
      const stmt = db.prepare("SELECT * FROM tasks WHERE status = 'pending'");
      const tasks = stmt.all();
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Test Task');
    });
  });

  describe('exchanges table schema', () => {
    beforeAll(() => {
      db.exec(`
        CREATE TABLE exchanges (
          id TEXT PRIMARY KEY,
          exchange_type TEXT,
          status TEXT DEFAULT 'open',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
    });

    it('should query exchanges by status with single quotes', () => {
      const stmt = db.prepare("SELECT COUNT(*) as count FROM exchanges WHERE status = 'open'");
      const result = stmt.get();
      expect(result.count).toBe(0);
    });

    it('should group exchanges by status', () => {
      const stmt = db.prepare('SELECT status, COUNT(*) as count FROM exchanges GROUP BY status');
      const result = stmt.all();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('context table schema', () => {
    beforeAll(() => {
      db.exec(`
        CREATE TABLE context (
          key TEXT PRIMARY KEY,
          value TEXT,
          project TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
    });

    it('should query context with global fallback using single quotes', () => {
      const stmt = db.prepare("SELECT * FROM context WHERE project = ? OR project = 'global'");
      const result = stmt.all('test-project');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle project-specific context', () => {
      db.prepare("INSERT INTO context (key, value, project) VALUES (?, ?, 'global')")
        .run('test-key', 'test-value');
      
      const stmt = db.prepare("SELECT * FROM context WHERE project = ? OR project = 'global'");
      const rows = stmt.all('my-project');
      expect(rows.length).toBe(1);
      expect(rows[0].key).toBe('test-key');
    });
  });

  describe('memory table schema', () => {
    beforeAll(() => {
      db.exec(`
        CREATE TABLE memory (
          id TEXT PRIMARY KEY,
          content TEXT,
          type TEXT,
          tags TEXT,
          project TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
    });

    it('should search memory by content', () => {
      db.prepare("INSERT INTO memory (id, content, type) VALUES (?, ?, ?)")
        .run('mem-1', 'test memory content', 'note');
      
      const stmt = db.prepare("SELECT * FROM memory WHERE content LIKE ?");
      const results = stmt.all('%test%');
      expect(results.length).toBe(1);
    });

    it('should filter memory by type', () => {
      const stmt = db.prepare("SELECT * FROM memory WHERE type = ?");
      const results = stmt.all('note');
      expect(Array.isArray(results)).toBe(true);
    });
  });
});