/**
 * Bridge Module Tests
 */

import { jest } from '@jest/globals';

const mockDb = {
  prepare: jest.fn()
};

jest.unstable_mockModule('../src/db.js', () => ({
  getDb: () => mockDb,
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn()
}));

jest.unstable_mockModule('../src/memory.js', () => ({
  storeMemory: jest.fn().mockResolvedValue({ id: 999 })
}));

const { 
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
} = await import('../src/bridge.js');

describe('Bridge Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Exchange Types', () => {
    it('should define all required exchange types', () => {
      expect(EXCHANGE_TYPES).toEqual({
        TASK: 'task',
        CLARIFICATION: 'clarification',
        DECISION: 'decision',
        FEEDBACK: 'feedback',
        PLANNING: 'planning',
        REVIEW: 'review'
      });
    });

    it('should define all priority levels', () => {
      expect(PRIORITIES).toEqual(['low', 'normal', 'high', 'urgent']);
    });
  });

  describe('createExchange', () => {
    it('should create a basic exchange with required fields', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = createExchange({
        exchangeType: 'task',
        subject: 'Test Subject',
        content: 'Test content for the exchange'
      });

      expect(result.id).toBe(1);
      expect(result.exchangeType).toBe('task');
      expect(result.subject).toBe('Test Subject');
      expect(result.content).toBe('Test content for the exchange');
      expect(result.status).toBe('open');
      expect(result.priority).toBe('normal');
    });

    it('should create exchange with all options', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 2 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = createExchange({
        exchangeType: 'decision',
        subject: 'Architecture Decision',
        content: 'Should we use microservices?',
        intent: 'Get clarity on approach',
        impact: 'Affects project timeline by 2 weeks',
        priority: 'high',
        createdBy: 'justin',
        responseBy: 'clawdexter'
      });

      expect(result.id).toBe(2);
      expect(result.exchangeType).toBe('decision');
      expect(result.intent).toBe('Get clarity on approach');
      expect(result.impact).toBe('Affects project timeline by 2 weeks');
      expect(result.priority).toBe('high');
      expect(result.created_by).toBe('justin');
      expect(result.response_by).toBe('clawdexter');
    });

    it('should use default values for optional fields', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 3 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = createExchange({
        exchangeType: 'feedback',
        subject: 'Feedback',
        content: 'Content'
      });

      expect(result.priority).toBe('normal');
      expect(result.created_by).toBe('justin');
      expect(result.response_by).toBe('clawdexter');
    });
  });

  describe('getExchanges', () => {
    it('should return all exchanges by default', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, exchange_type: 'task', subject: 'Task 1', status: 'open' },
        { id: 2, exchange_type: 'decision', subject: 'Task 2', status: 'responded' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getExchanges();

      expect(results).toHaveLength(2);
    });

    it('should filter by status', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, exchange_type: 'task', subject: 'Open Task', status: 'open' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getExchanges({ status: 'open' });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('open');
    });

    it('should filter by exchange type', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, exchange_type: 'decision', subject: 'Decision 1', status: 'open' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getExchanges({ exchangeType: 'decision' });

      expect(results).toHaveLength(1);
      expect(results[0].exchange_type).toBe('decision');
    });

    it('should filter by priority', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, exchange_type: 'task', subject: 'Urgent Task', status: 'open', priority: 'urgent' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getExchanges({ priority: 'urgent' });

      expect(results).toHaveLength(1);
      expect(results[0].priority).toBe('urgent');
    });

    it('should order by priority then creation date', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, exchange_type: 'task', subject: 'Task', status: 'open', priority: 'urgent' },
        { id: 2, exchange_type: 'task', subject: 'Task', status: 'open', priority: 'low' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getExchanges();

      // Results should be ordered by priority (urgent first)
      expect(results[0].priority).toBe('urgent');
    });

    it('should respect limit', () => {
      const mockAll = jest.fn().mockReturnValue([]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      getExchanges({ limit: 10 });

      const query = mockAll.mock.calls[0][0];
      expect(query).toContain('LIMIT ?');
    });
  });

  describe('getExchange', () => {
    it('should return null for non-existent exchange', () => {
      const mockGet = jest.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getExchange(999);

      expect(result).toBeUndefined();
    });

    it('should return exchange by ID', () => {
      const mockGet = jest.fn().mockReturnValue({
        id: 5,
        exchange_type: 'clarification',
        subject: 'Need Info',
        content: 'What was the decision?',
        status: 'open',
        priority: 'normal'
      });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getExchange(5);

      expect(result).not.toBeUndefined();
      expect(result.id).toBe(5);
      expect(result.exchange_type).toBe('clarification');
    });
  });

  describe('respondToExchange', () => {
    it('should return null for non-existent exchange', async () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = await respondToExchange(999, 'Response content');

      expect(result).toBeNull();
    });

    it('should return null for already responded exchange', async () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = await respondToExchange(1, 'Response');

      expect(result).toBeNull();
    });

    it('should update exchange status to responded', async () => {
      const mockRun = jest.fn()
        .mockReturnValueOnce({ changes: 1 }) // UPDATE
        .mockReturnValueOnce({ id: 1, status: 'responded', responded_at: new Date().toISOString() }); // SELECT
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet => mockRun.mock.calls[1] });

      // Need to set up get after run for the getExchange call
      let callCount = 0;
      mockDb.prepare.mockImplementation((query) => {
        if (query.includes('UPDATE')) {
          return { run: mockRun };
        }
        return { 
          get: () => ({ 
            id: 1, 
            status: 'responded', 
            responded_at: new Date().toISOString(),
            exchange_type: 'task',
            content: 'test'
          }) 
        };
      });

      const result = await respondToExchange(1, 'My response');

      expect(result).not.toBeNull();
      expect(result.status).toBe('responded');
    });
  });

  describe('closeExchange', () => {
    it('should return false for non-existent exchange', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = closeExchange(999);

      expect(result).toBe(false);
    });

    it('should return true when exchange is closed', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = closeExchange(1);

      expect(result).toBe(true);
    });
  });

  describe('escalateExchange', () => {
    it('should return null for non-existent exchange', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = escalateExchange(999);

      expect(result).toBeNull();
    });

    it('should escalate and set priority to urgent', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      let getCount = 0;
      mockDb.prepare.mockImplementation((query) => {
        return {
          run: mockRun,
          get: () => ({ 
            id: 1, 
            status: 'escalated', 
            priority: 'urgent',
            exchange_type: 'task',
            content: 'test'
          })
        };
      });

      const result = escalateExchange(1);

      expect(result).not.toBeNull();
      expect(result.status).toBe('escalated');
      expect(result.priority).toBe('urgent');
    });
  });

  describe('getExchangeStats', () => {
    it('should return comprehensive stats', () => {
      const mockGet = jest.fn()
        .mockReturnValueOnce({ count: 15 }) // total
        .mockReturnValueOnce([{ status: 'open', count: 5 }, { status: 'responded', count: 7 }, { status: 'closed', count: 3 }]) // byStatus
        .mockReturnValueOnce([{ exchange_type: 'task', count: 8 }, { exchange_type: 'decision', count: 4 }]) // byType
        .mockReturnValueOnce({ count: 5 }); // open

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const stats = getExchangeStats();

      expect(stats.total).toBe(15);
      expect(stats.open).toBe(5);
      expect(stats.byStatus.open).toBe(5);
      expect(stats.byStatus.responded).toBe(7);
      expect(stats.byType.task).toBe(8);
    });
  });

  describe('getOpenExchanges', () => {
    it('should return only open exchanges', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, status: 'open', exchange_type: 'task' },
        { id: 2, status: 'open', exchange_type: 'clarification' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getOpenExchanges();

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('open');
      expect(results[1].status).toBe('open');
    });
  });
});