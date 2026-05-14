#!/usr/bin/env node
/**
 * CTI CLI
 * Interactive command-line interface for Clawdexter's Thinking Interface
 */

import { createInterface } from 'readline';
import http from 'http';

const BASE_URL = process.env.CTI_URL || 'http://localhost:3456';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'cti > '
});

let currentMode = 'tasks';

const MODES = {
  tasks: {
    prompt: 'tasks > ',
    commands: {
      'ls': { description: 'List tasks', action: listTasks },
      'list': { description: 'List tasks', action: listTasks },
      'add': { description: 'Add new task', action: addTask },
      'create': { description: 'Add new task', action: addTask },
      'new': { description: 'Add new task', action: addTask },
      'get': { description: 'Get task by ID', action: getTask },
      'update': { description: 'Update task', action: updateTask },
      'delete': { description: 'Delete task', action: deleteTask },
      'stats': { description: 'Show task stats', action: taskStats },
      'help': { description: 'Show commands', action: showHelp },
      'mode': { description: 'Switch mode (tasks, memory, bridge, context)', action: switchMode },
      'stats': { description: 'Show all stats', action: showStats },
      'exit': { description: 'Exit CLI', action: () => process.exit(0) },
      'quit': { description: 'Exit CLI', action: () => process.exit(0) }
    }
  },
  memory: {
    prompt: 'memory > ',
    commands: {
      'search': { description: 'Search memories', action: searchMemory },
      'add': { description: 'Store new memory', action: addMemory },
      'recent': { description: 'Show recent memories', action: recentMemories },
      'stats': { description: 'Show memory stats', action: memoryStats },
      'help': { description: 'Show commands', action: showHelp },
      'mode': { description: 'Switch mode', action: switchMode },
      'exit': { description: 'Exit CLI', action: () => process.exit(0) }
    }
  },
  bridge: {
    prompt: 'bridge > ',
    commands: {
      'list': { description: 'List exchanges', action: listExchanges },
      'create': { description: 'Create exchange', action: createExchange },
      'get': { description: 'Get exchange by ID', action: getExchange },
      'respond': { description: 'Respond to exchange', action: respondToExchange },
      'close': { description: 'Close exchange', action: closeExchange },
      'stats': { description: 'Show exchange stats', action: bridgeStats },
      'help': { description: 'Show commands', action: showHelp },
      'mode': { description: 'Switch mode', action: switchMode },
      'exit': { description: 'Exit CLI', action: () => process.exit(0) }
    }
  },
  context: {
    prompt: 'context > ',
    commands: {
      'get': { description: 'Get context value', action: getContext },
      'set': { description: 'Set context value', action: setContext },
      'all': { description: 'Show all context', action: getAllContext },
      'help': { description: 'Show commands', action: showHelp },
      'mode': { description: 'Switch mode', action: switchMode },
      'exit': { description: 'Exit CLI', action: () => process.exit(0) }
    }
  }
};

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function listTasks() {
  try {
    const tasks = await apiRequest('GET', '/api/tasks');
    if (tasks.length === 0) {
      console.log('No tasks found.\n');
      return;
    }
    console.log('\n TASKS');
    console.log('─'.repeat(60));
    tasks.forEach(t => {
      const status = t.status === 'done' ? '✓' : t.status === 'in_progress' ? '→' : t.status === 'blocked' ? '⊘' : '○';
      console.log(` ${status} [${t.id}] ${t.title}`);
      console.log(`    Priority: ${t.priority} | Urgency: ${t.urgency} | Project: ${t.project}`);
    });
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function addTask() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  console.log('\n ADD TASK');
  console.log('─'.repeat(40));
  
  const title = await prompt('Title: ');
  if (!title) { console.log('Cancelled.\n'); return; }
  
  const description = await prompt('Description (optional): ');
  const project = await prompt('Project (default: general): ') || 'general';
  const priority = await prompt('Priority 1-10 (default: 5): ') || '5';
  const urgency = await prompt('Urgency 1-10 (default: 5): ') || '5';
  
  try {
    const task = await apiRequest('POST', '/api/tasks', {
      title,
      description,
      project,
      priority: parseInt(priority),
      urgency: parseInt(urgency)
    });
    console.log(`\n✓ Task created: #${task.id}\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function getTask(id) {
  if (!id) {
    const prompt = (q) => new Promise(res => rl.question(q, res));
    id = await prompt('Task ID: ');
  }
  
  try {
    const task = await apiRequest('GET', `/api/tasks/${id}`);
    console.log('\n TASK');
    console.log('─'.repeat(40));
    console.log(`Title:    ${task.title}`);
    console.log(`Status:   ${task.status}`);
    console.log(`Priority: ${task.priority}`);
    console.log(`Urgency:  ${task.urgency}`);
    console.log(`Project:  ${task.project}`);
    console.log(`Tags:     ${task.tags?.join(', ') || 'none'}`);
    console.log(`Created:  ${task.created_at}`);
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function updateTask() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  const id = await prompt('Task ID: ');
  if (!id) { console.log('Cancelled.\n'); return; }
  
  const status = await prompt('New status (pending/in_progress/blocked/done/cancelled): ');
  if (!status) { console.log('Cancelled.\n'); return; }
  
  try {
    const task = await apiRequest('PATCH', `/api/tasks/${id}`, { status });
    console.log(`\n✓ Task #${id} updated to "${status}"\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function deleteTask() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  const id = await prompt('Task ID to delete: ');
  
  try {
    await apiRequest('DELETE', `/api/tasks/${id}`);
    console.log(`\n✓ Task #${id} deleted\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function taskStats() {
  try {
    const stats = await apiRequest('GET', '/api/stats');
    console.log('\n TASK STATS');
    console.log('─'.repeat(40));
    console.log(`Total: ${stats.tasks.total}`);
    console.log('By Status:', JSON.stringify(stats.tasks.byStatus));
    console.log('By Project:', JSON.stringify(stats.tasks.byProject));
    console.log(`High Urgency: ${stats.tasks.pendingHighUrgency}\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function showStats() {
  try {
    const stats = await apiRequest('GET', '/api/stats');
    console.log('\n CTI STATS');
    console.log('═'.repeat(50));
    console.log('\n TASKS:', stats.tasks.total, stats.tasks.byStatus);
    console.log('\n MEMORIES:', stats.memories.total, stats.memories.byType);
    console.log('\n EXCHANGES:', stats.exchanges.total, 'open:', stats.exchanges.open);
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function searchMemory(query) {
  if (!query) {
    const prompt = (q) => new Promise(res => rl.question(q, res));
    query = await prompt('Search query: ');
  }
  
  try {
    const results = await apiRequest('GET', `/api/memory/search?q=${encodeURIComponent(query)}`);
    if (results.length === 0) {
      console.log('No memories found.\n');
      return;
    }
    console.log('\n MEMORIES');
    console.log('─'.repeat(60));
    results.forEach(m => {
      console.log(`[${m.type}] ${m.content.slice(0, 80)}${m.content.length > 80 ? '...' : ''}`);
      console.log(`  Tags: ${m.tags?.join(', ') || 'none'} | Accessed: ${m.access_count}x`);
    });
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function addMemory() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  console.log('\n ADD MEMORY');
  console.log('─'.repeat(40));
  
  const content = await prompt('Content: ');
  if (!content) { console.log('Cancelled.\n'); return; }
  
  const type = await prompt('Type (note/decision/preference/pattern/learning/fact, default: note): ') || 'note';
  const tags = await prompt('Tags (comma-separated): ') || '';
  
  try {
    const mem = await apiRequest('POST', '/api/memory', {
      content,
      type,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      source: 'cli'
    });
    console.log(`\n✓ Memory stored: #${mem.id}\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function recentMemories() {
  try {
    const memories = await apiRequest('GET', '/api/memory/recent');
    if (memories.length === 0) {
      console.log('No memories.\n');
      return;
    }
    console.log('\n RECENT MEMORIES');
    console.log('─'.repeat(60));
    memories.forEach(m => {
      console.log(`[${m.type}] ${m.content.slice(0, 80)}${m.content.length > 80 ? '...' : ''}`);
    });
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function memoryStats() {
  try {
    const stats = await apiRequest('GET', '/api/stats');
    console.log('\n MEMORY STATS');
    console.log('─'.repeat(40));
    console.log(`Total: ${stats.memories.total}`);
    console.log('By Type:', JSON.stringify(stats.memories.byType));
    console.log('Top Accessed:', stats.memories.topAccessed?.map(m => `(${m.access_count}x) ${m.content.slice(0, 40)}`).join(', '));
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function listExchanges() {
  try {
    const exchanges = await apiRequest('GET', '/api/bridge/exchange');
    if (exchanges.length === 0) {
      console.log('No exchanges.\n');
      return;
    }
    console.log('\n EXCHANGES');
    console.log('─'.repeat(60));
    exchanges.forEach(e => {
      const status = e.status === 'open' ? '○' : e.status === 'responded' ? '→' : e.status === 'closed' ? '✓' : '!';
      console.log(` ${status} [${e.id}] ${e.exchange_type}: ${e.subject}`);
      console.log(`    Intent: ${e.intent || 'none'} | Priority: ${e.priority}`);
    });
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function createExchange() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  console.log('\n CREATE EXCHANGE');
  console.log('─'.repeat(40));
  console.log('Types: task, clarification, decision, feedback, planning, review');
  
  const exchangeType = await prompt('Type: ');
  if (!exchangeType) { console.log('Cancelled.\n'); return; }
  
  const subject = await prompt('Subject: ');
  if (!subject) { console.log('Cancelled.\n'); return; }
  
  const content = await prompt('Content: ');
  if (!content) { console.log('Cancelled.\n'); return; }
  
  const intent = await prompt('Intent (what do you want?): ');
  const impact = await prompt('Impact (why does it matter?): ');
  const priority = await prompt('Priority (low/normal/high/urgent, default: normal): ') || 'normal';
  
  try {
    const exchange = await apiRequest('POST', '/api/bridge/message', {
      exchangeType,
      subject,
      content,
      intent,
      impact,
      priority
    });
    console.log(`\n✓ Exchange created: #${exchange.id}\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function getExchange(id) {
  if (!id) {
    const prompt = (q) => new Promise(res => rl.question(q, res));
    id = await prompt('Exchange ID: ');
  }
  
  try {
    const exchange = await apiRequest('GET', `/api/bridge/exchange/${id}`);
    console.log('\n EXCHANGE');
    console.log('─'.repeat(40));
    console.log(`Type:    ${exchange.exchange_type}`);
    console.log(`Subject: ${exchange.subject}`);
    console.log(`Status:  ${exchange.status}`);
    console.log(`Priority: ${exchange.priority}`);
    console.log(`Content: ${exchange.content}`);
    console.log(`Intent:  ${exchange.intent}`);
    console.log(`Impact:  ${exchange.impact}`);
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function respondToExchange() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  const id = await prompt('Exchange ID: ');
  if (!id) { console.log('Cancelled.\n'); return; }
  
  const response = await prompt('Response: ');
  if (!response) { console.log('Cancelled.\n'); return; }
  
  try {
    const exchange = await apiRequest('POST', `/api/bridge/exchange/${id}/respond`, { response });
    console.log(`\n✓ Response sent to exchange #${id}\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function closeExchange() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  const id = await prompt('Exchange ID to close: ');
  
  try {
    await apiRequest('POST', `/api/bridge/exchange/${id}/close`);
    console.log(`\n✓ Exchange #${id} closed\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function bridgeStats() {
  try {
    const stats = await apiRequest('GET', '/api/stats');
    console.log('\n BRIDGE STATS');
    console.log('─'.repeat(40));
    console.log(`Total: ${stats.exchanges.total} | Open: ${stats.exchanges.open}`);
    console.log('By Status:', JSON.stringify(stats.exchanges.byStatus));
    console.log('By Type:', JSON.stringify(stats.exchanges.byType));
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function getContext(key) {
  if (!key) {
    const prompt = (q) => new Promise(res => rl.question(q, res));
    key = await prompt('Context key: ');
  }
  
  try {
    const ctx = await apiRequest('GET', `/api/context/${encodeURIComponent(key)}`);
    console.log(`\n${key} = ${JSON.stringify(ctx.value)}\n`);
  } catch (err) {
    console.error('Error: Context not found');
  }
}

async function setContext() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  const key = await prompt('Key: ');
  if (!key) { console.log('Cancelled.\n'); return; }
  
  const value = await prompt('Value: ');
  if (!value) { console.log('Cancelled.\n'); return; }
  
  try {
    const ctx = await apiRequest('POST', '/api/context', { key, value });
    console.log(`\n✓ Context set: ${key} = ${value}\n`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function getAllContext() {
  try {
    const contexts = await apiRequest('GET', '/api/context');
    if (contexts.length === 0) {
      console.log('No context set.\n');
      return;
    }
    console.log('\n CONTEXT');
    console.log('─'.repeat(40));
    contexts.forEach(c => {
      console.log(`${c.key} = ${JSON.stringify(c.value)}`);
    });
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function switchMode() {
  const prompt = (q) => new Promise(res => rl.question(q, res));
  
  console.log('\nAvailable modes: tasks, memory, bridge, context');
  const mode = await prompt('Mode: ');
  
  if (MODES[mode]) {
    currentMode = mode;
    rl.setPrompt(MODES[mode].prompt);
    console.log(`Switched to ${mode} mode.\n`);
  } else {
    console.log(`Unknown mode: ${mode}\n`);
  }
}

async function showHelp() {
  const mode = MODES[currentMode];
  console.log('\n COMMANDS');
  console.log('─'.repeat(40));
  Object.entries(mode.commands).forEach(([cmd, info]) => {
    console.log(`  ${cmd.padEnd(12)} ${info.description}`);
  });
  console.log('');
}

rl.on('close', () => {
  console.log('\nGoodbye!\n');
  process.exit(0);
});

console.log(`
╔═══════════════════════════════════════════╗
║   CTI CLI v1.0.0                          ║
║   Clawdexter's Thinking Interface         ║
╠═══════════════════════════════════════════╣
║   Mode: ${currentMode.padEnd(32)}║
║   Server: ${BASE_URL.padEnd(28)}║
╚═══════════════════════════════════════════╝

Type 'help' for commands or 'mode' to switch modes.
`);

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  
  if (!input) {
    rl.prompt();
    return;
  }
  
  const [cmd, ...args] = input.split(' ');
  const mode = MODES[currentMode];
  
  if (mode.commands[cmd]) {
    try {
      await mode.commands[cmd].action(args.join(' '));
    } catch (err) {
      console.error('Error:', err.message);
    }
  } else {
    console.log(`Unknown command: ${cmd}. Type 'help' for commands.`);
  }
  
  rl.prompt();
});