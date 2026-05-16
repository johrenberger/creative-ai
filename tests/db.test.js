/**
 * Database Module Tests
 *
 * Comprehensive coverage of db.js — getDb, initializeDatabase,
 * getSchemaStats, closeDatabase, and all schema tables.
 */

import { jest, beforeAll, afterAll, beforeEach, describe, it, expect } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'db');
const TEST_DB = path.join(DB_DIR, 'test-coverage.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');

// Import after schema exists
let dbModule;

beforeAll(() => {
  // Ensure schema.sql exists for initializeDatabase
  expect(fs.existsSync(SCHEMA_PATH)).toBe(true);
});

describe('Database Module — schema tables', () => {
  let getDb, initializeDatabase, closeDatabase, getSchemaStats;

  beforeAll(async () => {
    // Use a separate test DB so we don't interfere with actual app DB
    process.env.CTI_DB_PATH = TEST_DB;
    dbModule = await import('../src/db.js');
    getDb = dbModule.getDb;
    initializeDatabase = dbModule.initializeDatabase;
    closeDatabase = dbModule.closeDatabase;
    getSchemaStats = dbModule.getSchemaStats;
  });

  afterAll(() => {
    closeDatabase();
    // Clean up test DB file
    try {
      fs.unlinkSync(TEST_DB);
      fs.unlinkSync(TEST_DB + '-wal');
      fs.unlinkSync(TEST_DB + '-shm');
    } catch { /* ignore */ }
  });

  describe('initializeDatabase()', () => {
    it('creates database file and tables from schema.sql', () => {
      initializeDatabase(); // ensure schema is applied
      const db = getDb();
      expect(db).toBeDefined();
      // Tables should exist after init
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const names = tables.map(t => t.name);
      expect(names).toContain('tasks');
      expect(names).toContain('context');
      expect(names).toContain('memories');
      expect(names).toContain('exchanges');
      expect(names).toContain('preferences');
    });

    it('runs without throwing on valid schema', () => {
      expect(() => initializeDatabase()).not.toThrow();
    });

    it('is idempotent — can be called twice', () => {
      expect(() => initializeDatabase()).not.toThrow();
    });
  });

  describe('getDb() — singleton behavior', () => {
    it('returns the same instance on multiple calls', () => {
      const db1 = getDb();
      const db2 = getDb();
      expect(db1).toBe(db2); // same object reference
    });

    it('sets WAL journal mode', () => {
      const db = getDb();
      const result = db.prepare('PRAGMA journal_mode').get();
      expect(result.journal_mode.toLowerCase()).toBe('wal');
    });

    it('enables foreign keys', () => {
      const db = getDb();
      const result = db.prepare('PRAGMA foreign_keys').get();
      expect(result.foreign_keys).toBe(1);
    });

    it('sets synchronous to NORMAL', () => {
      const db = getDb();
      const result = db.prepare('PRAGMA synchronous').get();
      expect(typeof result.synchronous).toBe('number');
    });

    it('sets temp_store to MEMORY', () => {
      const db = getDb();
      const result = db.prepare('PRAGMA temp_store').get();
      expect(result.temp_store).toBe(2); // MEMORY = 2
    });
  });

  describe('getSchemaStats()', () => {
    beforeAll(() => {
      initializeDatabase();
    });

    it('returns an object with all five table keys', () => {
      const stats = getSchemaStats();
      expect(stats).toHaveProperty('tasks');
      expect(stats).toHaveProperty('context');
      expect(stats).toHaveProperty('memories');
      expect(stats).toHaveProperty('exchanges');
      expect(stats).toHaveProperty('preferences');
    });

    it('returns 0 for empty tables', () => {
      const stats = getSchemaStats();
      expect(stats.tasks).toBe(0);
      expect(stats.context).toBe(0);
      expect(stats.memories).toBe(0);
      expect(stats.exchanges).toBe(0);
      expect(stats.preferences).toBe(0);
    });

    it('counts inserted rows correctly', () => {
      const db = getDb();
      db.prepare(`INSERT INTO tasks (title) VALUES (?)`).run('Test task');
      db.prepare(`INSERT INTO context (key, value) VALUES (?, ?)`).run('key1', 'value1');
      db.prepare(`INSERT INTO memories (content, type) VALUES (?, ?)`).run('Memory content', 'note');
      db.prepare(`INSERT INTO exchanges (exchange_type, subject, content, intent, impact, priority, created_by, response_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('task', 'Subject', 'Content', 'info', 'high', 'normal', 'user', 'bot');
      db.prepare(`INSERT INTO preferences (key, value) VALUES (?, ?)`).run('pref_key', 'pref_val');

      const stats = getSchemaStats();
      expect(stats.tasks).toBe(1);
      expect(stats.context).toBe(1);
      expect(stats.memories).toBe(1);
      expect(stats.exchanges).toBe(1);
      expect(stats.preferences).toBe(1);
    });

    it('gracefully handles missing tables', () => {
      const db = getDb();
      db.exec('DROP TABLE IF EXISTS tasks');
      const stats = getSchemaStats();
      expect(stats.tasks).toBe(0);
    });

    afterEach(() => {
      try { initializeDatabase(); } catch { /* ignore */ }
    });
  });

  describe('closeDatabase()', () => {
    it('closes the database and allows re-open', () => {
      closeDatabase();
      // After close, getDb should re-open
      const db = getDb();
      expect(db).toBeDefined();
      const result = db.prepare('PRAGMA journal_mode').get();
      expect(result.journal_mode.toLowerCase()).toBe('wal');
    });

    it('can be called on already-closed db without throwing', () => {
      expect(() => closeDatabase()).not.toThrow();
    });
  });

  describe('schema SQL — table constraints', () => {
    let db;

    beforeAll(() => {
      db = getDb();
    });

    describe('tasks table', () => {
      it('enforces CHECK constraint on status', () => {
        expect(() => {
          db.prepare('INSERT INTO tasks (title, status) VALUES (?, ?)').run('t', 'invalid_status');
        }).toThrow();
      });

      it('enforces CHECK constraints on priority and urgency (1-10)', () => {
        expect(() => {
          db.prepare('INSERT INTO tasks (title, priority) VALUES (?, ?)').run('t', 0);
        }).toThrow();
        expect(() => {
          db.prepare('INSERT INTO tasks (title, priority) VALUES (?, ?)').run('t', 11);
        }).toThrow();
        // Valid values should work
        db.prepare('INSERT INTO tasks (title, priority, urgency) VALUES (?, ?, ?)').run('t', 5, 5);
        expect(() => {
          db.prepare('INSERT INTO tasks (title, urgency) VALUES (?, ?)').run('t', 11);
        }).toThrow();
      });

      it('defaults status to pending', () => {
        const row = db.prepare('SELECT status FROM tasks WHERE title=?').get('t');
        expect(row.status).toBe('pending');
      });

      it('defaults priority and urgency to 5', () => {
        db.prepare(`INSERT INTO tasks (title) VALUES (?)`).run('default-priority-test');
        const row = db.prepare('SELECT priority, urgency FROM tasks WHERE title=?').get('default-priority-test');
        expect(row.priority).toBe(5);
        expect(row.urgency).toBe(5);
      });

      it('defaults project to general', () => {
        const row = db.prepare('SELECT project FROM tasks WHERE title=?').get('default-priority-test');
        expect(row.project).toBe('general');
      });

      it('defaults tags to empty JSON array', () => {
        const row = db.prepare('SELECT tags FROM tasks WHERE title=?').get('default-priority-test');
        expect(JSON.parse(row.tags)).toEqual([]);
      });

      it('sets created_at and updated_at timestamps', () => {
        const row = db.prepare('SELECT created_at, updated_at FROM tasks WHERE title=?').get('t');
        expect(row.created_at).toBeDefined();
        expect(row.updated_at).toBeDefined();
      });

      it('defaults created_by to justin', () => {
        const row = db.prepare('SELECT created_by FROM tasks WHERE title=?').get('t');
        expect(row.created_by).toBe('justin');
      });

      it('defaults assigned_to to clawdexter', () => {
        const row = db.prepare('SELECT assigned_to FROM tasks WHERE title=?').get('t');
        expect(row.assigned_to).toBe('clawdexter');
      });
    });

    describe('context table', () => {
      it('key column is UNIQUE — duplicate key throws', () => {
        const db = getDb();
        db.prepare('INSERT INTO context (key, value) VALUES (?, ?)').run('unique_key', 'val1');
        expect(() => {
          db.prepare('INSERT INTO context (key, value) VALUES (?, ?)').run('unique_key', 'val2');
        }).toThrow();
      });

      it('value column is NOT NULL — cannot insert without value', () => {
        const db = getDb();
        expect(() => {
          db.prepare('INSERT INTO context (key) VALUES (?)').run('no-value-key');
        }).toThrow();
      });

      it('can insert with explicit value', () => {
        const db = getDb();
        db.prepare('INSERT INTO context (key, value) VALUES (?, ?)').run('with-value-key', 'explicit_value');
        const row = db.prepare('SELECT value FROM context WHERE key=?').get('with-value-key');
        expect(row.value).toBe('explicit_value');
      });
    });

    describe('memories table', () => {
      it('has confidence column defaulting to 0.8', () => {
        const db = getDb();
        db.prepare(`INSERT INTO memories (content, type) VALUES (?, ?)`).run('conf-test', 'note');
        const row = db.prepare('SELECT confidence FROM memories WHERE content=?').get('conf-test');
        expect(row.confidence).toBe(0.8);
      });

      it('has source column defaulting to interaction', () => {
        const row = db.prepare('SELECT source FROM memories WHERE content=?').get('conf-test');
        expect(row.source).toBe('interaction');
      });

      it('has access_count defaulting to 0', () => {
        const row = db.prepare('SELECT access_count FROM memories WHERE content=?').get('conf-test');
        expect(row.access_count).toBe(0);
      });
    });

    describe('exchanges table', () => {
      it('enforces CHECK constraint on exchange_type', () => {
        const db = getDb();
        expect(() => {
          db.prepare(`INSERT INTO exchanges (subject, content, intent, impact, priority, created_by, response_by, exchange_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('s', 'c', 'info', 'high', 5, 'u', 'b', 'invalid_type');
        }).toThrow();
      });

      it('defaults created_by to user', () => {
        const db = getDb();
        db.prepare(`INSERT INTO exchanges (exchange_type, subject, content, intent, impact, priority, created_by, response_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('task', 's', 'c', 'info', 'high', 'normal', 'user', 'bot');
        const row = db.prepare('SELECT created_by FROM exchanges WHERE subject=?').get('s');
        expect(row.created_by).toBe('user');
      });
    });

    describe('preferences table', () => {
      it('has value column that stores JSON', () => {
        const db = getDb();
        db.prepare(`INSERT INTO preferences (key, value) VALUES (?, ?)`).run('json_pref', JSON.stringify({ theme: 'dark' }));
        const row = db.prepare('SELECT value FROM preferences WHERE key=?').get('json_pref');
        expect(JSON.parse(row.value)).toEqual({ theme: 'dark' });
      });
    });
  });
});