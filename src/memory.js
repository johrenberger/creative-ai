/**
 * Memory Module
 * Structured knowledge storage and retrieval
 */

import { getDb } from './db.js';

export function storeMemory({ content, type = 'note', tags = [], project = 'global', confidence = 0.8, source = 'interaction' }) {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO memories (content, type, tags, project, confidence, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(content, type, JSON.stringify(tags), project, confidence, source);

  return {
    id: result.lastInsertRowid,
    content,
    type,
    tags,
    project,
    confidence,
    source,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    access_count: 0
  };
}

export function searchMemories(query, { type, _tags, project, _limit = 20 } = {}) {
  const database = getDb();

  let sql = 'SELECT * FROM memories WHERE 1=1';
  const params = [];

  if (query) {
    sql += ' AND content LIKE ?';
    params.push(`%${query}%`);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  if (project) {
    sql += ' AND (project = ? OR project = "global")';
    params.push(project);
  }

  sql += ' ORDER BY access_count DESC, created_at DESC LIMIT ?';
  params.push(_limit);

  const rows = database.prepare(sql).all(...params);

  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]')
  }));
}

export function getMemory(id) {
  const database = getDb();

  // Increment access count
  database.prepare('UPDATE memories SET access_count = access_count + 1, accessed_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  const row = database.prepare('SELECT * FROM memories WHERE id = ?').get(id);

  if (!row) return null;

  return {
    ...row,
    tags: JSON.parse(row.tags || '[]')
  };
}

export function updateMemory(id, updates) {
  const database = getDb();
  const allowedFields = ['content', 'type', 'tags', 'project', 'confidence'];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'tags' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return null;

  values.push(id);

  const stmt = database.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  return result.changes > 0 ? getMemory(id) : null;
}

export function deleteMemory(id) {
  const database = getDb();
  const result = database.prepare('DELETE FROM memories WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getMemoryStats() {
  const database = getDb();

  const total = database.prepare('SELECT COUNT(*) as count FROM memories').get().count;
  const byType = database.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type').all();
  const topAccessed = database.prepare('SELECT id, content, access_count FROM memories ORDER BY access_count DESC LIMIT 5').all();

  return {
    total,
    byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
    topAccessed
  };
}

export function getRecentMemories(limit = 10) {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?').all(limit);

  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]')
  }));
}

export default { storeMemory, searchMemories, getMemory, updateMemory, deleteMemory, getMemoryStats, getRecentMemories };
