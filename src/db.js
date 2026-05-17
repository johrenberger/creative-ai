/**
 * Database Module
 * Handles SQLite connections and schema migrations
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.CTI_DB_PATH || join(__dirname, '..', 'db', 'cti.db');

let db = null;

function applyPragmas(database) {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('synchronous = NORMAL');
  database.pragma('temp_store = MEMORY');
  database.pragma('mmap_size = 268435456');
}

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    applyPragmas(db);
  }
  return db;
}

export function initializeDatabase() {
  const database = getDb();
  const schemaPath = join(__dirname, '..', 'db', 'schema.sql');

  try {
    const schema = readFileSync(schemaPath, 'utf8');
    database.exec(schema);
    console.log('✓ Database initialized');
    return true;
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    throw err;
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function getSchemaStats() {
  const database = getDb();
  const tables = ['tasks', 'context', 'memories', 'exchanges', 'preferences'];
  const stats = {};

  for (const table of tables) {
    try {
      const result = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      stats[table] = result.count;
    } catch {
      stats[table] = 0;
    }
  }

  return stats;
}

export default { getDb, initializeDatabase, closeDatabase, getSchemaStats };
