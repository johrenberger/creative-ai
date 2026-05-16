/**
 * Tasks Module
 * Structured task management with priority/urgency scoring
 */

import { getDb } from './db.js';

// Priority scoring: lower is more urgent
function calculatePriorityScore(priority, urgency) {
  // Weighted score: urgency matters more than priority
  return (11 - urgency) * 2 + (11 - priority);
}

export function createTask({ title, description = '', priority = 5, urgency = 5, project = 'general', tags = [], createdBy = 'justin' }) {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO tasks (title, description, priority, urgency, project, tags, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(title, description, priority, urgency, project, JSON.stringify(tags), createdBy);

  return {
    id: result.lastInsertRowid,
    title,
    description,
    status: 'pending',
    priority,
    urgency,
    project,
    tags,
    score: calculatePriorityScore(priority, urgency),
    created_at: new Date().toISOString()
  };
}

export function getTasks({ status, project, assignedTo, limit = 50 } = {}) {
  const database = getDb();

  let query = `
    SELECT *, ((11 - urgency) * 2 + (11 - priority)) as score
    FROM tasks WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (project) {
    query += ' AND project = ?';
    params.push(project);
  }

  if (assignedTo) {
    query += ' AND assigned_to = ?';
    params.push(assignedTo);
  }

  query += ' ORDER BY score ASC LIMIT ?';
  params.push(limit);

  const rows = database.prepare(query).all(...params);

  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    score: calculatePriorityScore(row.priority, row.urgency)
  }));
}

export function getTask(id) {
  const database = getDb();
  const row = database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!row) return null;

  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    score: calculatePriorityScore(row.priority, row.urgency)
  };
}

export function updateTask(id, updates) {
  const database = getDb();
  const allowedFields = ['title', 'description', 'status', 'priority', 'urgency', 'project', 'tags', 'assigned_to'];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key === 'assignedTo' ? 'assigned_to' : key === 'tags' ? 'tags' : key;
    if (allowedFields.includes(dbKey)) {
      fields.push(`${dbKey} = ?`);
      values.push(dbKey === 'tags' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = CURRENT_TIMESTAMP');

  if (updates.status === 'done') {
    fields.push('completed_at = CURRENT_TIMESTAMP');
  }

  values.push(id);

  const stmt = database.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  return result.changes > 0 ? getTask(id) : null;
}

export function deleteTask(id) {
  const database = getDb();
  const result = database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getTaskStats() {
  const database = getDb();

  const total = database.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const byStatus = database.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all();
  const byProject = database.prepare('SELECT project, COUNT(*) as count FROM tasks GROUP BY project').all();
  const pendingHighUrgency = database.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending' AND urgency >= 8").get().count;

  return {
    total,
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
    byProject: Object.fromEntries(byProject.map(r => [r.project, r.count])),
    pendingHighUrgency
  };
}

export default { createTask, getTasks, getTask, updateTask, deleteTask, getTaskStats };
