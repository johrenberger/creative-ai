-- Creative AI Database Schema
-- Clawdexter's Thinking Interface

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'blocked', 'done', 'cancelled')),
    priority INTEGER DEFAULT 5 CHECK(priority >= 1 AND priority <= 10),
    urgency INTEGER DEFAULT 5 CHECK(urgency >= 1 AND urgency <= 10),
    project TEXT DEFAULT 'general',
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    created_by TEXT DEFAULT 'justin',
    assigned_to TEXT DEFAULT 'clawdexter'
);

CREATE TABLE IF NOT EXISTS context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'json', 'number', 'boolean')),
    project TEXT DEFAULT 'global',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'note' CHECK(type IN ('note', 'decision', 'preference', 'pattern', 'learning', 'fact')),
    tags TEXT DEFAULT '[]',
    project TEXT DEFAULT 'global',
    confidence REAL DEFAULT 0.8 CHECK(confidence >= 0 AND confidence <= 1),
    source TEXT DEFAULT 'interaction',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exchanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange_type TEXT NOT NULL CHECK(exchange_type IN ('task', 'clarification', 'decision', 'feedback', 'planning', 'review')),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    intent TEXT DEFAULT '',
    impact TEXT DEFAULT '',
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'responded', 'closed', 'escalated')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    closed_at DATETIME,
    created_by TEXT DEFAULT 'justin',
    response_by TEXT DEFAULT 'clawdexter'
);

CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, urgency DESC);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);
CREATE INDEX IF NOT EXISTS idx_exchanges_type ON exchanges(exchange_type);