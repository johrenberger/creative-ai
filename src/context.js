/**
 * Context Module
 * Project state and context management
 */

import { getDb } from './db.js';

export function setContext(key, value, type = 'string', project = 'global', updatedBy = 'system') {
  const database = getDb();
  
  const dbType = type === 'object' ? 'json' : type;
  const dbValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  
  const stmt = database.prepare(`
    INSERT INTO context (key, value, type, project, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      type = excluded.type,
      project = excluded.project,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(key, dbValue, dbType, project, updatedBy);
  
  return getContext(key);
}

export function getContext(key) {
  const database = getDb();
  const row = database.prepare('SELECT * FROM context WHERE key = ?').get(key);
  
  if (!row) return null;
  
  return {
    ...row,
    value: row.type === 'json' ? JSON.parse(row.value) : row.value
  };
}

export function getAllContext(project = null) {
  const database = getDb();
  
  let query = 'SELECT * FROM context';
  const params = [];
  
  if (project) {
    query += ' WHERE project = ? OR project = "global"';
    params.push(project);
  }
  
  query += ' ORDER BY key ASC';
  
  const rows = database.prepare(query).all(...params);
  
  return rows.map(row => ({
    ...row,
    value: row.type === 'json' ? JSON.parse(row.value) : row.value
  }));
}

export function deleteContext(key) {
  const database = getDb();
  const result = database.prepare('DELETE FROM context WHERE key = ?').run(key);
  return result.changes > 0;
}

export function getContextHistory(key, limit = 20) {
  // Note: We're using a simple approach here since SQLite doesn't have native change tracking
  // In production, consider using audit tables or WAL snapshots
  const database = getDb();
  const row = database.prepare('SELECT * FROM context WHERE key = ?').get(key);
  
  if (!row) return [];
  
  return [{
    ...row,
    value: row.type === 'json' ? JSON.parse(row.value) : row.value,
    updated_at: row.updated_at
  }];
}

export function setPreference(key, value) {
  const database = getDb();
  
  const stmt = database.prepare(`
    INSERT INTO preferences (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(key, value);
  return getPreference(key);
}

export function getPreference(key, defaultValue = null) {
  const database = getDb();
  const row = database.prepare('SELECT value FROM preferences WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function getAllPreferences() {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM preferences ORDER BY key ASC').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export default { setContext, getContext, getAllContext, deleteContext, getContextHistory, setPreference, getPreference, getAllPreferences };