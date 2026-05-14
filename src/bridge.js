/**
 * Bridge Module
 * Structured communication patterns between Justin and Clawdexter
 * 
 * The Bridge enforces intentional exchanges by requiring:
 * - Subject: What is being discussed
 * - Content: The actual message
 * - Intent: What Justin wants to happen
 * - Impact: Why this matters
 */

import { getDb } from './db.js';
import { storeMemory } from './memory.js';

export function createExchange({ exchangeType, subject, content, intent = '', impact = '', priority = 'normal', createdBy = 'justin', responseBy = 'clawdexter' }) {
  const database = getDb();
  
  const stmt = database.prepare(`
    INSERT INTO exchanges (exchange_type, subject, content, intent, impact, priority, created_by, response_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(exchangeType, subject, content, intent, impact, priority, createdBy, responseBy);
  
  return {
    id: result.lastInsertRowid,
    exchangeType,
    subject,
    content,
    intent,
    impact,
    status: 'open',
    priority,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    response_by: responseBy
  };
}

export function getExchanges({ status, exchangeType, priority, limit = 50 } = {}) {
  const database = getDb();
  
  let query = 'SELECT * FROM exchanges WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (exchangeType) {
    query += ' AND exchange_type = ?';
    params.push(exchangeType);
  }
  
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  
  query += ' ORDER BY CASE priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "normal" THEN 3 WHEN "low" THEN 4 END, created_at DESC LIMIT ?';
  params.push(limit);
  
  return database.prepare(query).all(...params);
}

export function getExchange(id) {
  return getDb().prepare('SELECT * FROM exchanges WHERE id = ?').get(id);
}

export async function respondToExchange(id, response, responder = 'clawdexter') {
  const database = getDb();
  
  const stmt = database.prepare(`
    UPDATE exchanges 
    SET status = 'responded', responded_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'open'
  `);
  
  const result = stmt.run(id);
  
  if (result.changes === 0) {
    return null;
  }
  
  // Store the response as a memory
  const exchange = getExchange(id);
  if (exchange) {
    try {
      await storeMemory({
        content: `Exchange #${id} response: ${response}`,
        type: 'decision',
        tags: ['exchange-response', exchange.exchange_type],
        source: responder
      });
    } catch (e) {
      console.error('Failed to store exchange response memory:', e.message);
    }
  }
  
  return getExchange(id);
}

export function closeExchange(id) {
  const database = getDb();
  const result = database.prepare(`
    UPDATE exchanges SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
  
  return result.changes > 0;
}

export function escalateExchange(id) {
  const database = getDb();
  const result = database.prepare(`
    UPDATE exchanges SET status = 'escalated', priority = 'urgent' WHERE id = ?
  `).run(id);
  
  return result.changes > 0 ? getExchange(id) : null;
}

export function getExchangeStats() {
  const database = getDb();
  
  const total = database.prepare('SELECT COUNT(*) as count FROM exchanges').get().count;
  const byStatus = database.prepare('SELECT status, COUNT(*) as count FROM exchanges GROUP BY status').all();
  const byType = database.prepare('SELECT exchange_type, COUNT(*) as count FROM exchanges GROUP BY exchange_type').all();
  const open = database.prepare('SELECT COUNT(*) as count FROM exchanges WHERE status = "open"').get().count;
  
  return {
    total,
    open,
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
    byType: Object.fromEntries(byType.map(r => [r.exchange_type, r.count]))
  };
}

export function getOpenExchanges() {
  return getExchanges({ status: 'open' });
}

// Communication pattern templates
export const EXCHANGE_TYPES = {
  TASK: 'task',
  CLARIFICATION: 'clarification',
  DECISION: 'decision',
  FEEDBACK: 'feedback',
  PLANNING: 'planning',
  REVIEW: 'review'
};

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export default {
  createExchange,
  getExchanges,
  getExchange,
  respondToExchange,
  closeExchange,
  escalateExchange,
  getExchangeStats,
  getOpenExchanges,
  EXCHANGE_TYPES,
  PRIORITIES
};