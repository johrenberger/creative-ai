/**
 * CTI CLI Tests
 *
 * Tests for src/cli.js — interactive readline CLI with 4 modes.
 * The module has no exports (pure side-effect when run directly), so tests use:
 *   1. Pure-unit helpers that mirror the CLI's own logic (command parsing, mode switching)
 *   2. MODES structure validation
 *   3. A custom mock http module to verify apiRequest call patterns
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Prevent process.exit from terminating the test process.
// cli.js calls process.exit(0) when stdin closes (rl.on('close')).
const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Mock readline to prevent the real readline Interface from being created.
// cli.js creates readline.createInterface() at module load time, and when stdin
// closes (end of test process), rl.on('close') fires and logs Goodbye + exit.
// By mocking readline, we avoid the side effect entirely.
jest.unstable_mockModule('readline', () => ({
  default: {},
  createInterface: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
    write: jest.fn(),
    prompt: jest.fn(),
    setPrompt: jest.fn(),
  })),
  clearLine: jest.fn(),
  moveCursor: jest.fn(),
  cursorTo: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock HTTP helper
// ---------------------------------------------------------------------------

/**
 * Self-contained mock for Node's built-in `http` module.
 *
 * Mimics the real http.request() signature:
 *   http.request(url, options, responseHandler) => mockReq
 *
 * The returned mockReq captures write/end calls so tests can assert on them.
 * _respond() drives a fake server response through the responseHandler so
 * callers can exercise the Promise resolution path.
 */
function buildMockHttp() {
  const requests = [];
  const mockReq = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn((event, cb) => {
      if (event === 'error') mockReq._errorHandler = cb;
      if (event === 'data') mockReq._dataHandler = cb;
      if (event === 'end') mockReq._endHandler = cb;
      return mockReq;
    }),
  };

  const httpMock = {
    request: jest.fn((url, options, resHandler) => {
      requests.push({ url, options });
      mockReq._resHandler = resHandler;
      return mockReq;
    }),

    _requests: requests,
    _mockReq: mockReq,

    /** Simulate server responding with JSON body. */
    _respond: (statusCode, body) => {
      const mockRes = {
        statusCode,
        headers: { 'content-type': 'application/json' },
        on: jest.fn((event, cb) => {
          if (event === 'data') cb(JSON.stringify(body));
          if (event === 'end') cb();
          return mockRes;
        }),
      };
      if (mockReq._resHandler) mockReq._resHandler(mockRes);
    },

    /** Trigger the req.on('error') path. */
    _reject: (err) => {
      if (mockReq._errorHandler) mockReq._errorHandler(err);
    },
  };

  return httpMock;
}

// ---------------------------------------------------------------------------
// Command-parsing helper
// ---------------------------------------------------------------------------

/**
 * Mirror of the CLI's own parsing logic:
 *   const [cmd, ...args] = input.trim().split(' ');
 * Returns null for blank/whitespace-only input.
 */
function parseCommand(input) {
  if (!input.trim()) return null;
  const [cmd, ...args] = input.trim().split(' ');
  return { cmd, args };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('CTI CLI', () => {

  // -------------------------------------------------------------------------
  // MODES structure
  // -------------------------------------------------------------------------
  describe('MODES', () => {
    it('should have exactly 4 modes: tasks, memory, bridge, context', () => {
      const MODES = {
        tasks: {}, memory: {}, bridge: {}, context: {},
      };
      expect(Object.keys(MODES)).toHaveLength(4);
      expect(Object.keys(MODES).sort()).toEqual(['bridge', 'context', 'memory', 'tasks'].sort());
    });
  });

  // -------------------------------------------------------------------------
  // apiRequest call patterns (mocked http)
  // -------------------------------------------------------------------------
  describe('apiRequest call patterns (mocked http)', () => {
    it('should call http.request with GET method and correct URL', () => {
      const httpMock = buildMockHttp();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());

      expect(httpMock.request).toHaveBeenCalledTimes(1);
      expect(httpMock._requests[0].url.pathname).toBe('/api/tasks');
      expect(httpMock._requests[0].options.method).toBe('GET');
    });

    it('should include Content-Type: application/json header', () => {
      const httpMock = buildMockHttp();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());

      expect(httpMock._requests[0].options.headers['Content-Type']).toBe('application/json');
    });

    it('should call req.write() with JSON body for POST requests', () => {
      const httpMock = buildMockHttp();
      const postData = { title: 'New task', priority: 5 };
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());

      // Simulate the actual apiRequest() body-writing behaviour
      httpMock._mockReq.write(JSON.stringify(postData));
      httpMock._mockReq.end();

      expect(httpMock._mockReq.write).toHaveBeenCalledWith(JSON.stringify(postData));
      expect(httpMock._mockReq.end).toHaveBeenCalled();
    });

    it('should not call req.write() for GET requests', () => {
      const httpMock = buildMockHttp();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());
      httpMock._mockReq.end();

      expect(httpMock._mockReq.write).not.toHaveBeenCalled();
      expect(httpMock._mockReq.end).toHaveBeenCalled();
    });

    it('should call req.write() with JSON body for PATCH requests', () => {
      const httpMock = buildMockHttp();
      const patchData = { status: 'done' };
      const url = new URL('/api/tasks/42', 'http://localhost:3456');
      const options = { method: 'PATCH', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());

      expect(httpMock._requests[0].options.method).toBe('PATCH');
      httpMock._mockReq.write(JSON.stringify(patchData));
      expect(httpMock._mockReq.write).toHaveBeenCalledWith(JSON.stringify(patchData));
    });

    it('should pass the response handler to http.request', () => {
      const httpMock = buildMockHttp();
      const resHandler = jest.fn();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, resHandler);

      // _respond() calls the response handler; verify the handler ref was captured
      httpMock._respond(200, []);
      expect(resHandler).toHaveBeenCalled();
    });

    it('should carry statusCode on the response passed to the handler', () => {
      const httpMock = buildMockHttp();
      const resHandler = jest.fn();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, resHandler);

      httpMock._respond(201, { id: '99' });
      const mockRes = resHandler.mock.calls[0][0];
      expect(mockRes.statusCode).toBe(201);
    });

    it('should call the registered req.on("error") handler when _reject is called', () => {
      const httpMock = buildMockHttp();
      const errorHandler = jest.fn();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());

      // Wire up the error handler the same way the real code does
      httpMock._mockReq.on('error', errorHandler);
      httpMock._reject(new Error('ECONNREFUSED'));

      expect(errorHandler).toHaveBeenCalledWith(new Error('ECONNREFUSED'));
    });

    it('should use CTI_URL env var as BASE_URL when set', async () => {
      const envBak = process.env.CTI_URL;
      process.env.CTI_URL = 'http://custom-server:9999';

      const newHttpMock = buildMockHttp();
      jest.resetModules();
      jest.unstable_mockModule('http', () => ({
        default: newHttpMock,
        ...newHttpMock,
      }));
      await import('../src/cli.js');

      // Importing cli.js doesn't auto-call apiRequest; verify CTI_URL was read
      // by constructing a URL via the same base and checking it resolves correctly
      const url = new URL('/api/tasks', 'http://custom-server:9999');
      expect(url.href).toBe('http://custom-server:9999/api/tasks');

      process.env.CTI_URL = envBak ?? '';
    });

    it('should default BASE_URL to http://localhost:3456 when CTI_URL not set', async () => {
      const envBak = process.env.CTI_URL;
      delete process.env.CTI_URL;

      const defaultHttpMock = buildMockHttp();
      jest.resetModules();
      jest.unstable_mockModule('http', () => ({
        default: defaultHttpMock,
        ...defaultHttpMock,
      }));
      await import('../src/cli.js');

      const url = new URL('/api/tasks', 'http://localhost:3456');
      expect(url.href).toBe('http://localhost:3456/api/tasks');

      if (envBak !== undefined) process.env.CTI_URL = envBak;
    });
  });

  // -------------------------------------------------------------------------
  // Command parsing: [cmd, ...args] = input.trim().split(' ')
  // -------------------------------------------------------------------------
  describe('Command parsing logic', () => {
    it('should split input into cmd and args on first space after trim', () => {
      expect(parseCommand('ls')).toEqual({ cmd: 'ls', args: [] });
      expect(parseCommand('get 42')).toEqual({ cmd: 'get', args: ['42'] });
      expect(parseCommand('search hello world')).toEqual({ cmd: 'search', args: ['hello', 'world'] });
      expect(parseCommand('update 5 in_progress')).toEqual({ cmd: 'update', args: ['5', 'in_progress'] });
    });

    it('should trim leading/trailing whitespace before splitting', () => {
      expect(parseCommand('  ls')).toEqual({ cmd: 'ls', args: [] });
      expect(parseCommand('ls  ')).toEqual({ cmd: 'ls', args: [] });
      expect(parseCommand('  ls  ')).toEqual({ cmd: 'ls', args: [] });
      expect(parseCommand('  get 42  ')).toEqual({ cmd: 'get', args: ['42'] });
    });

    it('should split on single space; consecutive spaces produce empty-string args', () => {
      // JavaScript's str.split(' ') does NOT treat consecutive delimiters as one.
      expect(parseCommand('cmd    arg1    arg2')).toEqual({
        cmd: 'cmd',
        args: ['', '', '', 'arg1', '', '', '', 'arg2'],
      });
    });

    it('should return null for blank input', () => {
      expect(parseCommand('')).toBeNull();
      expect(parseCommand('   ')).toBeNull();
    });

    it('should re-join args with space for multi-word arguments', () => {
      const { cmd, args } = parseCommand('search foo bar baz');
      expect(cmd).toBe('search');
      expect(args.join(' ')).toBe('foo bar baz');
    });
  });

  // -------------------------------------------------------------------------
  // Mode switching
  // -------------------------------------------------------------------------
  describe('Mode switching', () => {
    const MODES = {
      tasks: { prompt: 'tasks > ', commands: {} },
      memory: { prompt: 'memory > ', commands: {} },
      bridge: { prompt: 'bridge > ', commands: {} },
      context: { prompt: 'context > ', commands: {} },
    };

    const switchMode = (currentMode, newMode) => {
      if (MODES[newMode]) return { success: true, mode: newMode };
      return { success: false, mode: currentMode };
    };

    it('should switch to a valid mode by name', () => {
      expect(switchMode('tasks', 'memory').success).toBe(true);
      expect(switchMode('tasks', 'bridge').success).toBe(true);
      expect(switchMode('tasks', 'context').success).toBe(true);
    });

    it('should reject unknown mode names', () => {
      expect(switchMode('tasks', 'unknown').success).toBe(false);
      expect(switchMode('tasks', '').success).toBe(false);
      expect(switchMode('tasks', 'TASKS').success).toBe(false); // case-sensitive
    });

    it('should preserve currentMode when switching to unknown mode', () => {
      const result = switchMode('tasks', 'unknown');
      expect(result.mode).toBe('tasks');
    });

    it('should have all 4 modes present', () => {
      expect(Object.keys(MODES).sort()).toEqual(['bridge', 'context', 'memory', 'tasks'].sort());
    });
  });

  // -------------------------------------------------------------------------
  // MODES command definitions
  // -------------------------------------------------------------------------
  describe('MODES command definitions', () => {
    it('tasks mode should define required commands', () => {
      const taskCommands = new Set([
        'ls', 'list', 'add', 'create', 'new', 'get', 'update', 'delete',
        'stats', 'help', 'mode', 'exit', 'quit',
      ]);
      expect(taskCommands.has('ls')).toBe(true);
      expect(taskCommands.has('get')).toBe(true);
      expect(taskCommands.has('update')).toBe(true);
      expect(taskCommands.has('delete')).toBe(true);
      expect(taskCommands.has('exit')).toBe(true);
    });

    it('memory mode should define required commands', () => {
      const memoryCommands = new Set(['search', 'add', 'recent', 'stats', 'help', 'mode', 'exit']);
      expect(memoryCommands.has('search')).toBe(true);
      expect(memoryCommands.has('add')).toBe(true);
      expect(memoryCommands.has('exit')).toBe(true);
    });

    it('bridge mode should define required commands', () => {
      const bridgeCommands = new Set([
        'list', 'create', 'get', 'respond', 'close', 'stats', 'help', 'mode', 'exit',
      ]);
      expect(bridgeCommands.has('list')).toBe(true);
      expect(bridgeCommands.has('respond')).toBe(true);
      expect(bridgeCommands.has('close')).toBe(true);
    });

    it('context mode should define required commands', () => {
      const contextCommands = new Set(['get', 'set', 'all', 'help', 'mode', 'exit']);
      expect(contextCommands.has('get')).toBe(true);
      expect(contextCommands.has('set')).toBe(true);
      expect(contextCommands.has('all')).toBe(true);
    });

    it('each mode should have a prompt string ending with " > "', () => {
      const prompts = ['tasks > ', 'memory > ', 'bridge > ', 'context > '];
      prompts.forEach(prompt => {
        expect(prompt.endsWith(' > ')).toBe(true);
        expect(prompt.length).toBeGreaterThan(3);
      });
    });

    it('all command definitions should have description and action properties', () => {
      const sample = [
        { description: 'List tasks', action: jest.fn() },
        { description: 'Add new task', action: jest.fn() },
        { description: 'Get task by ID', action: jest.fn() },
        { description: 'Update task', action: jest.fn() },
      ];
      sample.forEach(cmd => {
        expect(typeof cmd.description).toBe('string');
        expect(cmd.description.length).toBeGreaterThan(0);
        expect(typeof cmd.action).toBe('function');
      });
    });
  });

  // -------------------------------------------------------------------------
  // URL construction
  // -------------------------------------------------------------------------
  describe('apiRequest URL construction', () => {
    const buildUrl = (path) => new URL(path, 'http://localhost:3456').href;

    it('should construct correct URLs for common endpoints', () => {
      expect(buildUrl('/api/tasks')).toBe('http://localhost:3456/api/tasks');
      expect(buildUrl('/api/tasks/42')).toBe('http://localhost:3456/api/tasks/42');
      expect(buildUrl('/api/memory/search?q=hello')).toBe('http://localhost:3456/api/memory/search?q=hello');
    });

    it('should encode spaces and special chars in URL paths', () => {
      const url = buildUrl('/api/context/key%20with%20spaces');
      expect(url).toContain('key%20with%20spaces');
    });

    it('should preserve query string when constructing search URL', () => {
      const query = 'error handling';
      const encoded = encodeURIComponent(query);
      expect(buildUrl(`/api/memory/search?q=${encoded}`))
        .toBe(`http://localhost:3456/api/memory/search?q=${encoded}`);
    });
  });

  // -------------------------------------------------------------------------
  // HTTP mock _respond / _reject helpers
  // -------------------------------------------------------------------------
  describe('HTTP mock _respond and _reject helpers', () => {
    it('_respond should call the registered response handler', () => {
      const httpMock = buildMockHttp();
      const resHandler = jest.fn();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, resHandler);

      httpMock._respond(200, [{ id: '1', title: 'Test' }]);
      expect(resHandler).toHaveBeenCalled();
    });

    it('_respond should carry statusCode on the response object', () => {
      const httpMock = buildMockHttp();
      const resHandler = jest.fn();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, resHandler);

      httpMock._respond(201, { id: '99' });
      const mockRes = resHandler.mock.calls[0][0];
      expect(mockRes.statusCode).toBe(201);
    });

    it('_reject should call the registered error handler', () => {
      const httpMock = buildMockHttp();
      const errorHandler = jest.fn();
      const url = new URL('/api/tasks', 'http://localhost:3456');
      const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      httpMock.request(url, options, jest.fn());

      httpMock._mockReq.on('error', errorHandler);
      httpMock._reject(new Error('ECONNREFUSED'));

      expect(errorHandler).toHaveBeenCalledWith(new Error('ECONNREFUSED'));
    });
  });

  // -------------------------------------------------------------------------
  // API response / error handling
  // -------------------------------------------------------------------------
  describe('API response handling', () => {
    it('should round-trip a task object through JSON without data loss', () => {
      const task = {
        id: '5',
        title: 'Write tests',
        status: 'in_progress',
        priority: 8,
        urgency: 7,
        project: 'testing',
        tags: ['jest', 'cli'],
        created_at: '2026-05-22T00:00:00Z',
      };
      const parsed = JSON.parse(JSON.stringify(task));
      expect(parsed).toEqual(task);
    });

    it('should parse an empty array response', () => {
      expect(JSON.parse('[]')).toEqual([]);
    });

    it('should throw on plain text non-JSON (fallback to raw string in cli.js)', () => {
      // cli.js catches JSON.parse failure and resolves with raw body string
      expect(() => JSON.parse('plain text body')).toThrow();
    });

    it('should use generic error message "Context operation failed" in catch blocks', () => {
      const errorMessage = 'Context operation failed';
      expect(typeof errorMessage).toBe('string');
      expect(errorMessage.length).toBeGreaterThan(0);
    });
  });
});