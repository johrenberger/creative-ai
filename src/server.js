/**
 * CTI Server
 * Clawdexter's Thinking Interface - Express API + WebSocket
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
const _readFileSync = () => { /* kept for future schema versioning */ };
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHmac } from 'crypto';

import { initializeDatabase, getSchemaStats, closeDatabase } from './db.js';
import * as tasks from './tasks.js';
import * as context from './context.js';
import * as memory from './memory.js';
import * as bridge from './bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.CTI_PORT || 3456;
const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://cti.clawdexter.tech'],
      connectSrc: ["'self'", 'wss:', 'https://cti.clawdexter.tech'],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true }
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' }
});
app.use('/api/', limiter);

// Input validation helper
function validateRequired(body, fields) {
  const missing = fields.filter(f => !body[f]);
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  return { valid: true };
}

// Sanitize string inputs
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim().slice(0, 10000);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
    stats: getSchemaStats()
  });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    tasks: tasks.getTaskStats(),
    memories: memory.getMemoryStats(),
    exchanges: bridge.getExchangeStats(),
    preferences: context.getAllPreferences()
  });
});

// ============ TASKS ============

app.post('/api/tasks', (req, res) => {
  const validation = validateRequired(req.body, ['title']);
  if (!validation.valid) return res.status(400).json(validation);

  try {
    const task = tasks.createTask({
      title: sanitize(req.body.title),
      description: sanitize(req.body.description || ''),
      priority: Math.min(10, Math.max(1, parseInt(req.body.priority) || 5)),
      urgency: Math.min(10, Math.max(1, parseInt(req.body.urgency) || 5)),
      project: sanitize(req.body.project || 'general'),
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(sanitize) : [],
      createdBy: sanitize(req.body.createdBy || 'justin')
    });

    broadcast({ type: 'task_created', data: task });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks', (req, res) => {
  try {
    const result = tasks.getTasks({
      status: req.query.status,
      project: req.query.project,
      assignedTo: req.query.assignedTo,
      limit: Math.min(100, parseInt(req.query.limit) || 50)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id', (req, res) => {
  try {
    const task = tasks.getTask(parseInt(req.params.id));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', (req, res) => {
  try {
    const task = tasks.updateTask(parseInt(req.params.id), req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    broadcast({ type: 'task_updated', data: task });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const deleted = tasks.deleteTask(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    broadcast({ type: 'task_deleted', data: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CONTEXT ============

app.post('/api/context', (req, res) => {
  if (!req.body.key) return res.status(400).json({ error: 'Missing required field: key' });

  try {
    const ctx = context.setContext(
      sanitize(req.body.key),
      req.body.value,
      req.body.type || 'string',
      sanitize(req.body.project || 'global'),
      sanitize(req.body.updatedBy || 'system')
    );
    broadcast({ type: 'context_updated', data: ctx });
    res.json(ctx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/context', (req, res) => {
  try {
    const result = context.getAllContext(req.query.project);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/context/:key', (req, res) => {
  try {
    const ctx = context.getContext(req.params.key);
    if (!ctx) return res.status(404).json({ error: 'Context not found' });
    res.json(ctx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/context/:key', (req, res) => {
  try {
    const deleted = context.deleteContext(req.params.key);
    if (!deleted) return res.status(404).json({ error: 'Context not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ MEMORY ============

app.post('/api/memory', (req, res) => {
  const validation = validateRequired(req.body, ['content']);
  if (!validation.valid) return res.status(400).json(validation);

  try {
    const mem = memory.storeMemory({
      content: sanitize(req.body.content),
      type: req.body.type || 'note',
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(sanitize) : [],
      project: sanitize(req.body.project || 'global'),
      confidence: Math.min(1, Math.max(0, parseFloat(req.body.confidence) || 0.8)),
      source: sanitize(req.body.source || 'interaction')
    });

    broadcast({ type: 'memory_stored', data: mem });
    res.status(201).json(mem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory/search', (req, res) => {
  try {
    const results = memory.searchMemories(
      req.query.q || '',
      {
        type: req.query.type,
        project: req.query.project,
        limit: Math.min(50, parseInt(req.query.limit) || 20)
      }
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory/recent', (req, res) => {
  try {
    const results = memory.getRecentMemories(Math.min(50, parseInt(req.query.limit) || 10));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory/:id', (req, res) => {
  try {
    const mem = memory.getMemory(parseInt(req.params.id));
    if (!mem) return res.status(404).json({ error: 'Memory not found' });
    res.json(mem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/memory/:id', (req, res) => {
  try {
    const mem = memory.updateMemory(parseInt(req.params.id), req.body);
    if (!mem) return res.status(404).json({ error: 'Memory not found' });
    res.json(mem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memory/:id', (req, res) => {
  try {
    const deleted = memory.deleteMemory(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Memory not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ BRIDGE ============

app.post('/api/bridge/message', (req, res) => {
  const validation = validateRequired(req.body, ['exchangeType', 'subject', 'content']);
  if (!validation.valid) return res.status(400).json(validation);

  if (!bridge.EXCHANGE_TYPES[req.body.exchangeType.toUpperCase()]) {
    return res.status(400).json({
      error: `Invalid exchange type. Valid types: ${Object.keys(bridge.EXCHANGE_TYPES).join(', ')}`
    });
  }

  try {
    const exchange = bridge.createExchange({
      exchangeType: req.body.exchangeType,
      subject: sanitize(req.body.subject),
      content: sanitize(req.body.content),
      intent: sanitize(req.body.intent || ''),
      impact: sanitize(req.body.impact || ''),
      priority: req.body.priority || 'normal',
      createdBy: sanitize(req.body.createdBy || 'justin'),
      responseBy: sanitize(req.body.responseBy || 'clawdexter')
    });

    broadcast({ type: 'exchange_created', data: exchange });
    res.status(201).json(exchange);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bridge/exchange', (req, res) => {
  try {
    const results = bridge.getExchanges({
      status: req.query.status,
      exchangeType: req.query.type,
      priority: req.query.priority,
      limit: Math.min(100, parseInt(req.query.limit) || 50)
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bridge/exchange/:id', (req, res) => {
  try {
    const exchange = bridge.getExchange(parseInt(req.params.id));
    if (!exchange) return res.status(404).json({ error: 'Exchange not found' });
    res.json(exchange);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bridge/exchange/:id/respond', (req, res) => {
  if (!req.body.response) return res.status(400).json({ error: 'Missing required field: response' });

  try {
    bridge.respondToExchange(parseInt(req.params.id), sanitize(req.body.response), sanitize(req.body.responder || 'clawdexter'))
      .then(exchange => {
        if (!exchange) return res.status(404).json({ error: 'Exchange not found or already responded' });
        broadcast({ type: 'exchange_responded', data: exchange });
        res.json(exchange);
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bridge/exchange/:id/close', (req, res) => {
  try {
    const closed = bridge.closeExchange(parseInt(req.params.id));
    if (!closed) return res.status(404).json({ error: 'Exchange not found' });
    broadcast({ type: 'exchange_closed', data: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bridge/exchange/:id/escalate', (req, res) => {
  try {
    const exchange = bridge.escalateExchange(parseInt(req.params.id));
    if (!exchange) return res.status(404).json({ error: 'Exchange not found' });
    broadcast({ type: 'exchange_escalated', data: exchange });
    res.json(exchange);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PREFERENCES ============

app.get('/api/preferences', (req, res) => {
  try {
    res.json(context.getAllPreferences());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/preferences', (req, res) => {
  if (!req.body.key) return res.status(400).json({ error: 'Missing required field: key' });

  try {
    const pref = context.setPreference(sanitize(req.body.key), sanitize(req.body.value || ''));
    res.json(pref);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ WEBHOOK ============

const _WEBHOOK_SECRET = process.env.CTI_WEBHOOK_SECRET || '';

function _verifyWebhookSignature(req) {
  if (!_WEBHOOK_SECRET) return false; // Secret required — no bypass
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  const hmac = createHmac('sha256', _WEBHOOK_SECRET);
  hmac.update(JSON.stringify(req.body));
  const expected = `sha256=${hmac.digest('hex')}`;
  return sig === expected;
}

// Webhook signature left in source for future use — not called in current flow
void _verifyWebhookSignature;

// ============ IMAGE PROXY (avoids mixed content warnings) ============

app.get('/img', async (req, res) => {
  let url;
  try {
    url = new URL(atob(req.query.url));
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return res.status(400).json({ error: 'Disallowed protocol' });
  }

  // Block private network targets (SSRF hardening)
  const hostname = url.hostname.toLowerCase();
  const isPrivate = [
    hostname === 'localhost',
    hostname.startsWith('127.'),
    hostname.startsWith('10.'),
    hostname.startsWith('172.16') || (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31),
    hostname.startsWith('192.168.'),
    hostname === '0.0.0.0',
    hostname === '[::1]',
    hostname.endsWith('.local')
  ].some(Boolean);

  if (isPrivate) {
    return res.status(403).json({ error: 'Forbidden: private network target' });
  }

  try {
    const r = await fetch(url.toString(), {
      headers: { 'User-Agent': 'CTI-ImageProxy/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return res.status(502).json({ error: 'Upstream error' });

    const contentType = r.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Not an image' });
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    r.body.pipe(res);
  } catch {
    res.status(502).json({ error: 'Fetch failed' });
  }
});

// ============ STATIC FILES ============

app.use(express.static(join(__dirname, '..', 'public')));

// ============ WEBSOCKET ============

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('✓ WebSocket client connected');

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (_wsErr) => {
    console.error('WebSocket error:', _wsErr.message);
    clients.delete(ws);
  });
});

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

// ============ STARTUP ============

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  closeDatabase();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  closeDatabase();
  server.close(() => process.exit(0));
});

initializeDatabase();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   CTI v1.0.0 - Thinking Interface          ║
╠═══════════════════════════════════════════╣
║   HTTP:  http://localhost:${PORT}             ║
║   WS:    ws://localhost:${PORT}/ws            ║
║   Stats: http://localhost:${PORT}/api/stats  ║
╚═══════════════════════════════════════════╝
  `);
});

export { app, server, broadcast };
