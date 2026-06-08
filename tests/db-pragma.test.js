/**
 * Database Module — Pragma and Re-init Tests (AUTO-GENERATED)
 *
 * Generated for: component-test-generation P2-drain run
 * Closes: CTA-GAP-010 (P2/T1/unit) — db.js initializeDatabase PRAGMA behavior
 * Source: src/db.js
 * Run: test-generation/ctg-p2-20260608-220555
 *
 * Why a NEW file:
 *   The existing tests/db.test.js has describe.skip on the top-level suite
 *   with a stale comment ("native module ESM registration failure") that is
 *   no longer accurate. The skip is from an older Node version. The file
 *   also references TEST_DB and fs without importing them, so it would not
 *   run even if un-skipped. Rather than un-skip a broken file, this new file
 *   exercises the gap directly with a :memory: database and a clean
 *   beforeAll/afterAll pattern.
 *
 * If tests/db.test.js is fixed in the future, this file can be merged back
 * into it. For now, the two test files are independent.
 *
 * DO NOT EDIT this header — the generator relies on it for audit.
 */

import { jest, beforeAll, afterAll, beforeEach, describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

let initializeDatabase, getDb, closeDatabase, getSchemaStats;

beforeAll(async () => {
  process.env.CTI_DB_PATH = ':memory:';
  const dbModule = await import('../src/db.js');
  initializeDatabase = dbModule.initializeDatabase;
  getDb = dbModule.getDb;
  closeDatabase = dbModule.closeDatabase;
  getSchemaStats = dbModule.getSchemaStats;
});

afterAll(() => {
  if (closeDatabase) closeDatabase();
});

beforeEach(() => {
  // Reset DB between tests so each test gets a clean schema.
  // The db module is a singleton, so close + re-init is the only way.
  closeDatabase();
});

// ============================================================
// CTA-GAP-010: initializeDatabase() called twice on the same DB
// Trigger: Call initializeDatabase() twice on the same DB path
// Expected: No error; schema is unchanged; foreign_keys pragma still on
// ============================================================
describe('initializeDatabase() — re-init behavior (auto: CTA-GAP-010)', () => {
  it('first call creates the schema and applies PRAGMAs', () => {
    initializeDatabase();
    const db = getDb();

    // Schema applied
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    expect(tables).toContain('tasks');
    expect(tables).toContain('context');
    expect(tables).toContain('memories');
    expect(tables).toContain('exchanges');
    expect(tables).toContain('preferences');

    // PRAGMAs applied
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('synchronous', { simple: true })).toBe(1); // NORMAL = 1
    expect(db.pragma('temp_store', { simple: true })).toBe(2);  // MEMORY = 2
  });

  it('second call on the same DB path does not throw', () => {
    initializeDatabase();
    const db = getDb();
    expect(() => initializeDatabase()).not.toThrow();
  });

  it('second call leaves the schema unchanged (CREATE TABLE IF NOT EXISTS is idempotent)', () => {
    initializeDatabase();
    const db = getDb();
    const tablesBefore = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    // Insert a row to verify the table is usable across re-inits
    db.prepare("INSERT INTO context (key, value, type, project, updated_by) VALUES (?, ?, ?, ?, ?)").run(
      'reinit-test', 'value1', 'string', 'global', 'system'
    );

    // Re-init
    expect(() => initializeDatabase()).not.toThrow();

    // Schema unchanged
    const tablesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    expect(tablesAfter.sort()).toEqual(tablesBefore.sort());

    // Row survived (the DB was not wiped)
    const row = db.prepare("SELECT value FROM context WHERE key = ?").get('reinit-test');
    expect(row).toBeDefined();
    expect(row.value).toBe('value1');
  });

  it('foreign_keys pragma is still on after re-init', () => {
    initializeDatabase();
    const db = getDb();
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    initializeDatabase();
    expect(getDb().pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('applyPragmas() — direct PRAGMA values (auto: CTA-GAP-010)', () => {
  it('synchronous is NORMAL (1) not FULL (2) — performance choice', () => {
    initializeDatabase();
    expect(getDb().pragma('synchronous', { simple: true })).toBe(1);
  });

  it('temp_store is MEMORY (2) for in-memory temp tables', () => {
    initializeDatabase();
    expect(getDb().pragma('temp_store', { simple: true })).toBe(2);
  });

  it('mmap_size is set to 256MB (268435456) for read performance — verified via source inspection', () => {
    // mmap_size is a non-functional performance pragma. :memory: DBs may return
    // different values from the PRAGMA query (often 0 because mmap is not
    // supported for in-memory DBs). Verifying the source code intent is more
    // reliable than the runtime PRAGMA value.
    const src = readFileSync('./src/db.js', 'utf8');
    expect(src).toMatch(/mmap_size = 268435456/);
  });
});

describe('getSchemaStats() (auto: CTA-GAP-010)', () => {
  it('returns row counts for the core tables', () => {
    initializeDatabase();
    const db = getDb();
    // Insert a known number of rows in each table so we can assert counts
    db.prepare("INSERT INTO tasks (title) VALUES (?), (?), (?)").run('a', 'b', 'c');
    db.prepare("INSERT INTO context (key, value, type, project, updated_by) VALUES (?, ?, ?, ?, ?)").run('k1', 'v1', 'string', 'p', 'u');
    db.prepare("INSERT INTO memories (content, type) VALUES (?, ?)").run('mem1', 'note');

    const stats = getSchemaStats();
    expect(stats.tasks).toBe(3);
    expect(stats.context).toBe(1);
    expect(stats.memories).toBe(1);
    expect(stats.exchanges).toBe(0);
    expect(stats.preferences).toBe(0);
  });
});
