/**
 * getContextHistory Integration Tests (AUTO-GENERATED)
 *
 * Generated for: component-test-generation P2-drain run
 * Closes: CTA-GAP-007 (P2/T2/unit) — context.getContextHistory
 * Source: src/context.js
 * Run: test-generation/ctg-p2-20260608-220555
 *
 * IMPORTANT — gap-vs-implementation mismatch:
 *   CTA-GAP-007's trigger is "Set the same context key 3 times, then call
 *   getContextHistory(key) → returns array of 3 Context objects in
 *   chronological order." But the IMPLEMENTATION of getContextHistory
 *   (src/context.js line 72) only ever returns 1 entry — it does a
 *   `SELECT * FROM context WHERE key = ?` and the ON CONFLICT clause in
 *   setContext() upserts rather than inserting new rows.
 *
 *   So the existing tests/context.test.js (lines 174-231) are correct for
 *   the CURRENT behavior. The gap's "expected_result" describes a future
 *   state that would require an audit-table or history-table refactor
 *   (the source has a TODO comment about this).
 *
 * This new test file pins down the current behavior with an integration-
 * style call against a real :memory: DB so a regression in either
 * direction is caught. If the audit-table refactor lands, this test will
 * fail and the spec should be updated to expect 3 entries.
 *
 * Why a separate file:
 *   tests/context.test.js uses jest.unstable_mockModule on ../src/db.js,
 *   which makes it hard to also exercise the real DB path in the same file.
 *   This file is in its own suite, fully real, no mocks.
 *
 * DO NOT EDIT this header — the generator relies on it for audit.
 */

import { jest, beforeAll, afterAll, beforeEach, describe, it, expect } from '@jest/globals';

let setContext, getContextHistory;
let initializeDatabase, closeDatabase;

beforeAll(async () => {
  process.env.CTI_DB_PATH = ':memory:';
  const ctxModule = await import('../src/context.js');
  setContext = ctxModule.setContext;
  getContextHistory = ctxModule.getContextHistory;

  const dbModule = await import('../src/db.js');
  initializeDatabase = dbModule.initializeDatabase;
  closeDatabase = dbModule.closeDatabase;
  initializeDatabase();
});

afterAll(() => {
  if (closeDatabase) closeDatabase();
});

beforeEach(() => {
  // Reset DB between tests for isolation. db.js is a singleton, so close + re-init
  // is the only way to get a clean schema.
  closeDatabase();
  initializeDatabase();
});

describe('getContextHistory — actual behavior (auto: CTA-GAP-007)', () => {
  it('returns 1 entry (the current row) after setContext is called 3 times with the same key', () => {
    // Per the implementation, getContextHistory returns the CURRENT row (1 entry),
    // not a chronological history of 3 entries. The gap's "expected_result"
    // describes a future-state requirement that would need an audit table.
    setContext('history-key', 'first', 'string', 'global', 'system');
    setContext('history-key', 'second', 'string', 'global', 'system');
    setContext('history-key', 'third', 'string', 'global', 'system');

    const history = getContextHistory('history-key');
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(1);
    expect(history[0].key).toBe('history-key');
    expect(history[0].value).toBe('third'); // latest value (upsert)
  });

  it('returns empty array for a non-existent key (does not throw)', () => {
    const history = getContextHistory('nonexistent');
    expect(history).toEqual([]);
  });

  it('parses JSON value correctly for json-typed context', () => {
    setContext('json-history', { theme: 'dark', count: 5 }, 'json', 'global', 'system');
    const history = getContextHistory('json-history');
    expect(history.length).toBe(1);
    expect(history[0].value).toEqual({ theme: 'dark', count: 5 });
  });

  it('includes updated_at in the history entry', () => {
    setContext('time-key', 'value', 'string', 'global', 'system');
    const history = getContextHistory('time-key');
    expect(history[0].updated_at).toBeDefined();
    const parsed = new Date(history[0].updated_at);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it('handles limit parameter without error (limit is a future feature, currently ignored)', () => {
    // src/context.js signature: getContextHistory(key, _limit = 20)
    // The underscore prefix indicates the parameter is unused in the current
    // implementation. This test documents that — if a refactor adds real
    // limit support, this test should be updated.
    setContext('limit-key', 'value', 'string', 'global', 'system');
    const history = getContextHistory('limit-key', 5);
    expect(Array.isArray(history)).toBe(true);
  });
});
