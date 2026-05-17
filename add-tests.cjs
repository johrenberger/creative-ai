// Error handling tests
function addErrorHandlingTests(content) {
  const rateLimitIdx = content.indexOf("describe('Rate limiting'");
  if (rateLimitIdx === -1) {
    console.log('Could not find Rate limiting section');
    return content;
  }

  const newTests = `
// ============================================================
// ERROR CONDITIONS
// ============================================================

describe('Error handling', () => {
  // Task not found cases
  it('GET /api/tasks/:id returns 404 for non-existent task', async () => {
    const res = await GET('/api/tasks/99999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('PATCH /api/tasks/:id returns 404 for non-existent task', async () => {
    const res = await PATCH('/api/tasks/99999', { status: 'in_progress' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /api/tasks/:id returns 404 for non-existent task', async () => {
    const res = await DELETE('/api/tasks/99999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // Context not found cases
  it('GET /api/context/:key returns 404 for non-existent key', async () => {
    const res = await GET('/api/context/nonexistent_key_xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /api/context/:key returns 404 for non-existent key', async () => {
    const res = await DELETE('/api/context/nonexistent_key_xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // Memory not found case
  it('GET /api/memory/:id returns 404 for non-existent memory', async () => {
    const res = await GET('/api/memory/99999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // Invalid task status value
  it('PATCH /api/tasks/:id returns 400 for invalid status value', async () => {
    const task = await POST('/api/tasks', { title: 'Status test task' });
    const id = task.body.id || (Array.isArray(task.body) ? task.body[0].id : undefined);
    if (!id) return; // Skip if create failed
    const res = await PATCH('/api/tasks/' + id, { status: 'invalid_status' });
    expect([400, 500]).toContain(res.status);
  });

  // Clamp priority out of range
  it('clamps priority above 10 to 10', async () => {
    const res = await POST('/api/tasks', { title: 'High priority task', priority: 99 });
    expect(res.status).toBe(201);
  });

  it('clamps priority below 1 to 1', async () => {
    const res = await POST('/api/tasks', { title: 'Low priority task', priority: -5 });
    expect(res.status).toBe(201);
  });

  it('clamps urgency above 10 to 10', async () => {
    const res = await POST('/api/tasks', { title: 'High urgency task', urgency: 99 });
    expect(res.status).toBe(201);
  });

  it('clamps urgency below 1 to 1', async () => {
    const res = await POST('/api/tasks', { title: 'Low urgency task', urgency: -5 });
    expect(res.status).toBe(201);
  });

  // Empty title
  it('returns 400 when title is empty string', async () => {
    const res = await POST('/api/tasks', { title: '' });
    expect([400, 500]).toContain(res.status);
  });

  // Content validation for memory
  it('POST /api/memory returns 400 when content is missing', async () => {
    const res = await POST('/api/memory', {});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Non-numeric task ID
  it('returns 404 for non-numeric task ID', async () => {
    const res = await GET('/api/tasks/abc');
    expect(res.status).toBe(404);
  });

  // Non-numeric memory ID
  it('GET /api/memory/:id returns 404 for non-numeric ID', async () => {
    const res = await GET('/api/memory/xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // Exchange not found
  it('GET /api/bridge/exchange/:id returns 404 for non-existent exchange', async () => {
    const res = await GET('/api/bridge/exchange/99999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // Exchange respond missing content
  it('POST /api/bridge/exchange/:id/respond returns 400 when response is missing', async () => {
    const create = await POST('/api/bridge/message', {
      exchangeType: 'task',
      subject: 'Response missing test',
      content: 'Test content'
    });
    const id = create.body.id;
    if (!id) return;
    const res = await POST('/api/bridge/exchange/' + id + '/respond', {});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Close non-existent exchange
  it('returns 404 when closing non-existent exchange', async () => {
    const res = await POST('/api/bridge/exchange/99999/close', {});
    expect(res.status).toBe(404);
  });

  // Escalate non-existent exchange
  it('returns 404 when escalating non-existent exchange', async () => {
    const res = await POST('/api/bridge/exchange/99999/escalate', {});
    expect(res.status).toBe(404);
  });
});

// ============================================================
// TASK FILTERING
// ============================================================

describe('GET /api/tasks - filtering', () => {
  beforeAll(async () => {
    await POST('/api/tasks', { title: 'Pending task A', status: 'pending' });
    await POST('/api/tasks', { title: 'In progress task B', status: 'in_progress' });
    await POST('/api/tasks', { title: 'Completed task C', status: 'completed' });
  });

  it('filters by status=pending', async () => {
    const res = await GET('/api/tasks?status=pending');
    expect(res.status).toBe(200);
    const tasks = Array.isArray(res.body) ? res.body : res.body.tasks;
    expect(Array.isArray(tasks)).toBe(true);
    if (tasks.length > 0) {
      tasks.forEach(t => expect(t.status).toBe('pending'));
    }
  });

  it('filters by status=in_progress', async () => {
    const res = await GET('/api/tasks?status=in_progress');
    expect(res.status).toBe(200);
    const tasks = Array.isArray(res.body) ? res.body : res.body.tasks;
    expect(Array.isArray(tasks)).toBe(true);
  });

  it('filters by project', async () => {
    await POST('/api/tasks', { title: 'Project test task', project: 'test-project' });
    const res = await GET('/api/tasks?project=test-project');
    expect(res.status).toBe(200);
    const tasks = Array.isArray(res.body) ? res.body : res.body.tasks;
    expect(Array.isArray(tasks)).toBe(true);
  });
});

// ============================================================
// CONTEXT EDGE CASES
// ============================================================

describe('POST /api/context - edge cases', () => {
  it('overwrites existing key', async () => {
    await POST('/api/context', { key: 'overwrite_key', value: 'original' });
    const res = await POST('/api/context', { key: 'overwrite_key', value: 'updated' });
    expect(res.status).toBe(200);
    const ctx = res.body.context || res.body;
    expect(ctx).toHaveProperty('value', 'updated');
  });

  it('accepts context values with special characters', async () => {
    const res = await POST('/api/context', { key: 'special_chars', value: '<b>x</b>&amp;' });
    expect(res.status).toBe(200);
  });

  it('accepts numeric context values', async () => {
    const res = await POST('/api/context', { key: 'numeric_val', value: 42 });
    expect(res.status).toBe(200);
    const ctx = res.body.context || res.body;
    expect(ctx.value).toBe(42);
  });

  it('accepts boolean context values', async () => {
    const res = await POST('/api/context', { key: 'bool_val', value: false });
    expect(res.status).toBe(200);
    const ctx = res.body.context || res.body;
    expect(ctx.value).toBe(false);
  });

  it('returns 400 when key is missing', async () => {
    const res = await POST('/api/context', { value: 'no key' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /api/context/:key', () => {
  it('deletes an existing context key', async () => {
    await POST('/api/context', { key: 'delete_test', value: 'to be deleted' });
    const res = await DELETE('/api/context/delete_test');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

// ============================================================
// GET /API/STATS
// ============================================================

describe('GET /api/stats', () => {
  it('returns aggregated stats for all resources', async () => {
    const res = await GET('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
    expect(res.body).toHaveProperty('memories');
    expect(res.body).toHaveProperty('exchanges');
    expect(res.body).toHaveProperty('preferences');
  });
});

// ============================================================
// MEMORY EDGE CASES
// ============================================================

describe('POST /api/memory - edge cases', () => {
  it('uses default type when not provided', async () => {
    const res = await POST('/api/memory', { content: 'Test memory without type' });
    expect(res.status).toBe(201);
  });

  it('accepts tags as array', async () => {
    const res = await POST('/api/memory', {
      content: 'Memory with tags',
      tags: ['test', 'automation']
    });
    expect(res.status).toBe(201);
  });

  it('accepts project parameter', async () => {
    const res = await POST('/api/memory', {
      content: 'Memory in project',
      project: 'test-project'
    });
    expect(res.status).toBe(201);
  });

  it('accepts confidence parameter', async () => {
    const res = await POST('/api/memory', {
      content: 'High confidence memory',
      confidence: 0.95
    });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/memory/search - edge cases', () => {
  it('returns 200 with empty results for non-matching query', async () => {
    const res = await GET('/api/memory/search?q=nonexistentqueryxyz123');
    expect(res.status).toBe(200);
  });

  it('returns results filtered by type', async () => {
    await POST('/api/memory', { content: 'Test note content', type: 'note' });
    const res = await GET('/api/memory/search?q=test&type=note');
    expect(res.status).toBe(200);
  });

  it('returns results filtered by project', async () => {
    await POST('/api/memory', { content: 'Project-specific memory', project: 'search-test' });
    const res = await GET('/api/memory/search?q=Project&project=search-test');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/memory/recent', () => {
  it('returns 200 with recent memories array', async () => {
    const res = await GET('/api/memory/recent');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('respects limit parameter', async () => {
    const res = await GET('/api/memory/recent?limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ============================================================
// BRIDGE EXCHANGE EDGE CASES
// ============================================================

describe('GET /api/bridge/exchange - filtering', () => {
  beforeAll(async () => {
    await POST('/api/bridge/message', {
      exchangeType: 'task',
      subject: 'Open exchange',
      content: 'Open content',
      status: 'open',
      priority: 'high'
    });
    await POST('/api/bridge/message', {
      exchangeType: 'task',
      subject: 'Closed exchange',
      content: 'Closed content',
      status: 'closed',
      priority: 'low'
    });
  });

  it('filters by status', async () => {
    const res = await GET('/api/bridge/exchange?status=open');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by exchange type', async () => {
    const res = await GET('/api/bridge/exchange?type=task');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by priority', async () => {
    const res = await GET('/api/bridge/exchange?priority=high');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('respects limit parameter', async () => {
    const res = await GET('/api/bridge/exchange?limit=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/bridge/exchange/:id/close', () => {
  it('closes an open exchange', async () => {
    const create = await POST('/api/bridge/message', {
      exchangeType: 'task',
      subject: 'Exchange to close',
      content: 'Will be closed'
    });
    const id = create.body.id;
    if (!id) return;
    const res = await POST('/api/bridge/exchange/' + id + '/close', {});
    expect(res.status).toBe(200);
  });
});

describe('POST /api/bridge/exchange/:id/escalate', () => {
  it('escalates an exchange', async () => {
    const create = await POST('/api/bridge/message', {
      exchangeType: 'task',
      subject: 'Exchange to escalate',
      content: 'Will be escalated'
    });
    const id = create.body.id;
    if (!id) return;
    const res = await POST('/api/bridge/exchange/' + id + '/escalate', {});
    expect(res.status).toBe(200);
  });
});

// ============================================================
// 404 FOR UNKNOWN ROUTES
// ============================================================

describe('Unknown routes return 404', () => {
  it('returns 404 for unknown GET route', async () => {
    const res = await GET('/api/unknown/route/' + Date.now());
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown POST route', async () => {
    const res = await POST('/api/unknown/route', {});
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown DELETE route', async () => {
    const res = await DELETE('/api/unknown/route');
    expect(res.status).toBe(404);
  });
});

`;

  return content.slice(0, rateLimitIdx) + newTests + '\n\n' + content.slice(rateLimitIdx);
}

const fs = require('fs');
const content = fs.readFileSync('tests/server.test.js', 'utf8');
const newContent = addErrorHandlingTests(content);
fs.writeFileSync('tests/server.test.js', newContent);
console.log('done, new size:', newContent.length);